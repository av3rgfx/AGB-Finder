// Seed template kit: pnpm db:seed:kit
import { PrismaClient } from "@prisma/client";

export async function seedKitTemplates(db: PrismaClient) {
  const existing = await db.kitTemplate.findFirst({
    where: { name: "ARTECH anta-ribalta legno" },
  });
  const data = {
    name: "ARTECH anta-ribalta legno",
    description: "Pilota Fase 1d — finestra legno, mano SX/DX, verticali passo 600.",
    windowType: "ANTA_RIBALTA" as const,
    series: "ARTECH",
    rules: { engine: "artech-ar-legno", version: 1 },
    isActive: true,
    priority: 10,
  };
  if (existing) await db.kitTemplate.update({ where: { id: existing.id }, data });
  else await db.kitTemplate.create({ data });
  console.log("✓ KitTemplate ARTECH anta-ribalta legno (engine artech-ar-legno)");
}

const isMain = process.argv[1]?.endsWith("seed-kit.ts");
if (isMain) {
  const db = new PrismaClient();
  seedKitTemplates(db)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
