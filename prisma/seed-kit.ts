// Seed template kit: pnpm db:seed:kit
import { PrismaClient, type MaterialType } from "@prisma/client";

type KitTemplateSeed = {
  name: string;
  description: string;
  material: MaterialType;
  rules: { engine: string; version: number };
  priority: number;
};

// I template puntano al modulo regole in codice (registry.ts). `material` è
// esplicito su OGNI template: il KitEngine seleziona con
// `OR: [{material: null}, {material: input.material}]` ordinando per priority —
// senza material esplicito il template legno farebbe da catch-all e
// "ombreggerebbe" quello PVC (match ambiguo, risoluzione non deterministica).
const TEMPLATES: KitTemplateSeed[] = [
  {
    name: "ARTECH anta-ribalta legno",
    description: "Pilota Fase 1d — finestra legno, mano SX/DX, verticali passo 600.",
    material: "LEGNO",
    rules: { engine: "artech-ar-legno", version: 1 },
    priority: 10,
  },
  {
    name: "ARTECH anta-ribalta PVC",
    description:
      "Fase 1g Task 3 — finestra PVC (PROVVISORIO, da validare con esperto): struttura legno + 4 swap dalla cert ift EN 13126-8.",
    material: "PVC",
    rules: { engine: "artech-ar-pvc", version: 1 },
    priority: 10,
  },
];

export async function seedKitTemplates(db: PrismaClient) {
  for (const tpl of TEMPLATES) {
    const data = {
      name: tpl.name,
      description: tpl.description,
      windowType: "ANTA_RIBALTA" as const,
      material: tpl.material,
      series: "ARTECH",
      rules: tpl.rules,
      isActive: true,
      priority: tpl.priority,
    };
    const existing = await db.kitTemplate.findFirst({ where: { name: tpl.name } });
    if (existing) await db.kitTemplate.update({ where: { id: existing.id }, data });
    else await db.kitTemplate.create({ data });
    console.log(`✓ KitTemplate ${tpl.name} (engine ${tpl.rules.engine})`);
  }
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
