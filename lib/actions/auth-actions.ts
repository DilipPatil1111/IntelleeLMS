"use server";

import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { buildRegistrationThankYouEmail, buildTeacherSelfRegistrationEmail } from "@/lib/email";
import { sendEmailWithSignature } from "@/lib/email-signature";
import { getLoginPageUrl } from "@/lib/app-url";

const registerSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    middleName: z.string().optional(),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["STUDENT", "TEACHER", "PRINCIPAL"]),
    phone: z.string().optional(),
    country: z.string().optional(),
    programId: z.string().optional(),
    batchId: z.string().optional(),
    personalStatement: z.string().optional(),
    visaStatus: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "STUDENT") {
      if (!data.programId?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please select a program to apply for.", path: ["programId"] });
      }
    }
  });

export async function registerUser(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = registerSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form" };
  }

  const {
    firstName,
    middleName,
    lastName,
    email,
    password,
    role,
    phone,
    country,
    programId,
    batchId,
    personalStatement,
    visaStatus,
  } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email already registered" };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  if (role === "STUDENT" && programId) {
    const program = await db.program.findFirst({
      where: { id: programId, isActive: true },
    });
    if (!program) {
      return { error: "Invalid or inactive program" };
    }

    let validBatchId: string | null = null;
    if (batchId?.trim()) {
      const batch = await db.batch.findFirst({
        where: { id: batchId, programId, isActive: true },
      });
      if (!batch) {
        return { error: "Selected batch does not belong to this program" };
      }
      validBatchId = batch.id;
    }

    const count = await db.studentProfile.count();
    const enrollmentNo = `STU${String(count + 1).padStart(6, "0")}`;

    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName,
          middleName: middleName || null,
          lastName,
          email,
          hashedPassword,
          role: "STUDENT",
          phone: phone || null,
          country: country || null,
          visaStatus: visaStatus?.trim() || null,
        },
      });

      await tx.studentProfile.create({
        data: {
          userId: user.id,
          enrollmentNo,
          programId,
          batchId: validBatchId,
          status: "APPLIED",
        },
      });

      await tx.programApplication.create({
        data: {
          applicantId: user.id,
          programId,
          batchId: validBatchId,
          personalStatement: personalStatement?.trim() || null,
          status: "PENDING",
        },
      });

      const loginUrl = getLoginPageUrl();
      const payload = buildRegistrationThankYouEmail({
        firstName,
        programName: program.name,
        loginUrl,
      });
      await sendEmailWithSignature({
        to: user.email,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        senderUserId: null,
      });
    });

    return { success: true };
  }

  if (role === "TEACHER") {
    const rawPrograms = formData.getAll("programIds").filter((x): x is string => typeof x === "string");
    const programIds = [...new Set(rawPrograms)].filter(Boolean);

    await db.$transaction(async (tx) => {
      const tpCount = await tx.teacherProfile.count();
      const user = await tx.user.create({
        data: {
          firstName,
          middleName: middleName || null,
          lastName,
          email,
          hashedPassword,
          role: "TEACHER",
          phone: phone || null,
          country: country || null,
        },
      });
      await tx.teacherProfile.create({
        data: {
          userId: user.id,
          employeeId: `TCH${String(tpCount + 1).padStart(6, "0")}`,
          ...(programIds.length > 0 && {
            teacherPrograms: { create: programIds.map((programId) => ({ programId })) },
          }),
        },
      });
    });

    const programs =
      programIds.length > 0
        ? await db.program.findMany({ where: { id: { in: programIds } }, select: { name: true } })
        : [];
    const loginUrl = getLoginPageUrl();
    const teacherWelcome = buildTeacherSelfRegistrationEmail({
      firstName,
      loginUrl,
      programNames: programs.map((p) => p.name),
    });
    await sendEmailWithSignature({
      to: email,
      subject: teacherWelcome.subject,
      html: teacherWelcome.html,
      text: teacherWelcome.text,
      senderUserId: null,
    });

    return { success: true };
  }

  await db.user.create({
    data: {
      firstName,
      middleName: middleName || null,
      lastName,
      email,
      hashedPassword,
      role: "PRINCIPAL",
      phone: phone || null,
      country: country || null,
    },
  });

  return { success: true };
}

export async function loginUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch {
    return { error: "Invalid email or password" };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { error: "User not found" };

  const rolePaths: Record<string, string> = {
    STUDENT: "/student",
    TEACHER: "/teacher",
    PRINCIPAL: "/principal",
  };

  redirect(rolePaths[user.role] || "/login");
}
