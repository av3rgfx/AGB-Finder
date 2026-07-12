// Seed template kit: pnpm db:seed:kit
import { PrismaClient, type MaterialType } from "@prisma/client";

type KitTemplateSeed = {
  name: string;
  description: string;
  material: MaterialType;
  rules: { engine: string; version: number };
  priority: number;
  isActive: boolean;
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
    isActive: true,
  },
  {
    name: "ARTECH anta-ribalta PVC",
    description:
      "Fase 1g Task 3 — finestra PVC (PROVVISORIO, da validare con esperto): struttura legno + 4 swap dalla cert ift EN 13126-8.",
    material: "PVC",
    rules: { engine: "artech-ar-pvc", version: 1 },
    priority: 10,
    isActive: true,
  },
  {
    // Fase 1g Task 4: ALLUMINIO gated (isActive:false). Il listino 2026 non ha
    // composizione alluminio (PLANA è cerniera complanare legno/PVC, non alu) →
    // il modulo rifiuta e il template resta inattivo finché non arrivano i dati
    // validati. Vedi docs/superpowers/kit-assunzioni/alu.md.
    name: "ARTECH anta-ribalta alluminio",
    description:
      "Fase 1g Task 4 — ALLUMINIO NON DISPONIBILE (gated): manca il listino di composizione dedicato. Da attivare con i dati validati dall'esperto.",
    material: "ALLUMINIO",
    rules: { engine: "artech-ar-alu", version: 1 },
    priority: 10,
    isActive: false,
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
      isActive: tpl.isActive,
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
