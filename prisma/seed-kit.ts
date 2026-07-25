// Seed template kit: pnpm db:seed:kit
import { PrismaClient, type MaterialType, type WindowType } from "@prisma/client";

type KitTemplateSeed = {
  name: string;
  description: string;
  windowType: WindowType;
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
    windowType: "ANTA_RIBALTA",
    material: "LEGNO",
    rules: { engine: "artech-ar-legno", version: 1 },
    priority: 10,
    isActive: true,
  },
  {
    // DISATTIVATO 2026-07-25: la composizione ARTECH PVC non esiste nel listino
    // 2026 (i 4 codici material-specific sono solo nelle pagine-certificato ift,
    // senza prezzo). Riattivare con il «listino PVC e ALLUMINIO» — vedi
    // rules-artech-pvc.ts e docs/superpowers/kit-assunzioni/pvc.md.
    name: "ARTECH anta-ribalta PVC",
    description:
      "NON DISPONIBILE — la composizione PVC non è nel listino 2026: serve il «listino PVC e ALLUMINIO», rimando a p0849 (847).",
    windowType: "ANTA_RIBALTA",
    material: "PVC",
    rules: { engine: "artech-ar-pvc", version: 1 },
    priority: 10,
    isActive: false,
  },
  {
    // Fase 1g Task 4: ALLUMINIO gated (isActive:false). Il listino 2026 non ha
    // composizione alluminio (PLANA è cerniera complanare legno/PVC, non alu) →
    // il modulo rifiuta e il template resta inattivo finché non arrivano i dati
    // validati. Vedi docs/superpowers/kit-assunzioni/alu.md.
    name: "ARTECH anta-ribalta alluminio",
    description:
      "Fase 1g Task 4 — ALLUMINIO NON DISPONIBILE (gated): manca il listino di composizione dedicato. Da attivare con i dati validati dall'esperto.",
    windowType: "ANTA_RIBALTA",
    material: "ALLUMINIO",
    rules: { engine: "artech-ar-alu", version: 1 },
    priority: 10,
    isActive: false,
  },
  {
    // DISATTIVATO 2026-07-25: la distinta era priva del gruppo di sospensione
    // superiore (schema p0416 (414) ha 21 voci, il modulo ne generava 5) e lo schema è
    // composito → terna cerniere non decidibile. Vedi
    // rules-artech-battente-legno.ts e docs/superpowers/kit-assunzioni/battente.md.
    name: "ARTECH anta a battente legno",
    description:
      "NON DISPONIBILE — distinta incompleta (manca il gruppo di sospensione superiore): in attesa della conferma AGB sulla terna di cerniere dello schema p0416 (414).",
    windowType: "ANTA_BATTENTE",
    material: "LEGNO",
    rules: { engine: "artech-batt-legno", version: 1 },
    priority: 10,
    isActive: false,
  },
  {
    name: "ARTECH vasistas legno",
    description:
      // Riscritta 2026-07-25: la vecchia descrizione prometteva la catena DSS
      // A50190/A51400.05.03, che il modulo NON emette più (lo schema vasistas
      // non la prevede), e citava «pag.416» — la stampata, cioè la fisica
      // p0418: la fisica 416 è lo schema del BATTENTE.
      "Fase 1i — finestra vasistas (apertura a ribalta pura) anta singola legno (PROVVISORIO, da validare con l'agente): trascrizione dello schema di montaggio p0418 (416) — cremonese A50111.15 per GR + forbici A50545 per larghezza + cerniere portanti/articolazioni + incontri via colonna NOT.(GR).",
    windowType: "VASISTAS",
    material: "LEGNO",
    rules: { engine: "artech-vasistas-legno", version: 1 },
    priority: 10,
    isActive: true,
  },
];

export async function seedKitTemplates(db: PrismaClient) {
  for (const tpl of TEMPLATES) {
    const data = {
      name: tpl.name,
      description: tpl.description,
      windowType: tpl.windowType,
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
