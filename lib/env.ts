import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  /** e.g. "Intellee College <noreply@yourdomain.com>" — must be a verified sender in Resend */
  RESEND_FROM_EMAIL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  /** Vercel Blob — required in production for file uploads */
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  /** Cron secret — required to secure the /api/cron/send-emails endpoint */
  CRON_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
