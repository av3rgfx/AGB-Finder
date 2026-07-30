import "server-only";
import type { PrismaClient } from "@prisma/client";

/**
 * Soglia oltre la quale lo sconto cliente produce un avviso (mai un blocco).
 *
 * Vive in `Settings` e non in una costante di codice perché è una politica
 * commerciale, non una regola tecnica: cambiarla non deve richiedere un
 * rilascio. `COMPANY_INFO` è già nell'enum `SettingCategory` e `value` è `Json`
 * con `isEncrypted` di default `false` → nessuna migrazione.
 */
const CATEGORY = "COMPANY_INFO" as const;
const KEY = "DISCOUNT_WARN_THRESHOLD";

/**
 * Vale finché nessun ADMIN ne salva una. È la **fonte unica** del default: la
 * UI lo legge da qui e non lo ricopia, altrimenti il giorno che cambia il
 * programma avviserebbe a una soglia e ne mostrerebbe un'altra.
 */
export const SOGLIA_SCONTO_DEFAULT = 40;

export type ThresholdDb = Pick<PrismaClient, "settings" | "activityLog">;

export async function getDiscountThreshold(db: ThresholdDb): Promise<number> {
  const row = await db.settings.findUnique({
    where: { category_key: { category: CATEGORY, key: KEY } },
  });
  const value: unknown = row?.value;
  // `value` è Json: il DB accetta una stringa o un oggetto senza lamentarsi.
  // Una soglia fuori scala o del tipo sbagliato non deve diventare una soglia
  // che non avvisa mai — meglio ricadere sul default.
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) {
    return value;
  }
  return SOGLIA_SCONTO_DEFAULT;
}

export async function setDiscountThreshold(
  db: ThresholdDb,
  soglia: number,
  adminUserId: string,
): Promise<number> {
  await db.settings.upsert({
    where: { category_key: { category: CATEGORY, key: KEY } },
    create: {
      category: CATEGORY,
      key: KEY,
      value: soglia,
      isEncrypted: false,
      description: "Soglia oltre la quale lo sconto cliente genera un avviso.",
      updatedBy: adminUserId,
    },
    update: { value: soglia, isEncrypted: false, updatedBy: adminUserId },
  });
  await db.activityLog.create({
    data: {
      userId: adminUserId,
      type: "SETTINGS_CHANGED",
      description: `Soglia di avviso sullo sconto impostata a ${soglia}%`,
      resourceType: "settings",
      resourceId: KEY,
    },
  });
  return soglia;
}
