import { db } from "@/lib/db";

export async function getOrCreateInstitutionSettings() {
  return db.institutionSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}
