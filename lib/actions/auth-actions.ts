"use server";

import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["STUDENT", "TEACHER", "PRINCIPAL"]),
  phone: z.string().optional(),
  country: z.string().optional(),
});

export async function registerUser(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = registerSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { firstName, middleName, lastName, email, password, role, phone, country } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email already registered" };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      firstName,
      middleName: middleName || null,
      lastName,
      email,
      hashedPassword,
      role: role as "STUDENT" | "TEACHER" | "PRINCIPAL",
      phone: phone || null,
      country: country || null,
    },
  });

  if (role === "STUDENT") {
    const count = await db.studentProfile.count();
    await db.studentProfile.create({
      data: {
        userId: user.id,
        enrollmentNo: `STU${String(count + 1).padStart(6, "0")}`,
        programId: "",
        batchId: "",
      },
    }).catch(() => {
      // Profile will be completed during onboarding
    });
  }

  if (role === "TEACHER") {
    const count = await db.teacherProfile.count();
    await db.teacherProfile.create({
      data: {
        userId: user.id,
        employeeId: `TCH${String(count + 1).padStart(6, "0")}`,
      },
    }).catch(() => {
      // Profile will be completed during onboarding
    });
  }

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
