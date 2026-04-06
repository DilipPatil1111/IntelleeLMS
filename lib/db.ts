import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizePgConnectionString } from "@/lib/pg-connection-url";

const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

function createPrismaClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const connectionString = normalizePgConnectionString(raw);
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Dev HMR can cache a PrismaClient from before `prisma generate`; any new model is then missing on the
 * singleton and `db.attendanceSession.findMany` (etc.) throws "Cannot read properties of undefined (reading 'findMany')".
 */
const DELEGATES_USED_APP_WIDE = [
  "batch",
  "attendanceSession",
  "attendanceRecord",
  "programCalendarSlot",
  "programEnrollment",
  "subject",
  "holiday",
  "user",
] as const;

function prismaClientIsComplete(
  client: InstanceType<typeof PrismaClient> | undefined
): client is InstanceType<typeof PrismaClient> {
  if (!client) return false;
  const c = client as unknown as Record<string, unknown>;
  return DELEGATES_USED_APP_WIDE.every((name) => typeof c[name] !== "undefined");
}

const cached = globalForPrisma.prisma;
export const db: InstanceType<typeof PrismaClient> = prismaClientIsComplete(cached)
  ? cached
  : createPrismaClient();

globalForPrisma.prisma = db;
