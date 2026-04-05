import { db } from "@/lib/db";

export async function getOrCreateInstitutionProfile() {
  return db.institutionProfile.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}
