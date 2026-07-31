import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { pathToFileURL } from "node:url";

// Own client instance: seed runs under tsx/node, so it cannot import the
// `server-only`-guarded singleton in src/server/db.ts.
const db = new PrismaClient();

export interface AdminUserData {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: "ADMIN";
  status: "ACTIVE";
  emailVerified: true;
}

/** Build the admin user row (pure). Password lives in the Account row, not here. */
export function buildAdminUserData(
  email: string,
  firstName = "Admin",
  lastName = "UFP",
): AdminUserData {
  return {
    email,
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    role: "ADMIN",
    status: "ACTIVE",
    emailVerified: true,
  };
}

/**
 * I tre clienti principali, con la geometria del serramento che ciascuno
 * produce — quella detta dall'agente e già usata come fixture in
 * `rules-artech-legno.test.ts` e `artech-geometrie.ts`.
 *
 * PERCHÉ NEL SEED. L'app è mono-azienda: il seed *è* l'installazione di
 * Utensilferramenta, non un set di dati finti. Metterli qui evita uno script e
 * uno step ops in più — `pnpm db:seed` gira già a ogni run di «Ops — Neon».
 *
 * IDEMPOTENTE E NON DISTRUTTIVO: `upsert` con `update: {}` sulla chiave unica
 * `customerCode`. Crea se manca, **non tocca se c'è** — così una correzione
 * fatta a mano dall'agente (uno sconto, un'entrata, perfino la ragione sociale)
 * sopravvive al run successivo del workflow, che altrimenti la riscriverebbe
 * ogni volta.
 *
 * NIENTE ENTRATA, NIENTE SCONTO, e non è una dimenticanza: l'entrata è la
 * **domanda 17**, ancora aperta. Inventarne una nel profilo di un cliente vero
 * sarebbe lo stesso difetto che la PR #44 ha appena chiuso — un valore che
 * nessuno ha scelto — in un posto molto più difficile da vedere. Restano NULL
 * finché l'agente non le dice, e l'etichetta del wizard dice già che il profilo
 * non è mai stato confrontato con un ordine.
 */
export const CLIENTI_NOTI = [
  { customerCode: "MC", companyName: "MC", kitGeometry: "A4_I85_B15" },
  { customerCode: "PERUZZI", companyName: "Peruzzi", kitGeometry: "A4_I9_B18" },
  { customerCode: "FOSCA", companyName: "Fosca", kitGeometry: "A12_I13_B18" },
] as const;

export const BASE_CATEGORIES = [
  { name: "Cerniere", slug: "cerniere" },
  { name: "Cremonesi e Maniglie", slug: "cremonesi-maniglie" },
  { name: "Serrature", slug: "serrature" },
  { name: "Accessori Anta Ribalta", slug: "accessori-anta-ribalta" },
  { name: "Scorrevoli", slug: "scorrevoli" },
  { name: "Guarnizioni", slug: "guarnizioni" },
];

async function seedAdmin(email: string, password: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;

  const user = await db.user.create({ data: buildAdminUserData(email) });
  // Better Auth email/password uses a "credential" account with a scrypt hash.
  await db.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: await hashPassword(password),
    },
  });
  return user;
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD sono obbligatori per il seed.");
  }

  const admin = await seedAdmin(email, password);
  console.log(`✓ Admin: ${admin.email}`);

  for (const category of BASE_CATEGORIES) {
    await db.productCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }
  console.log(`✓ ${BASE_CATEGORIES.length} categorie base`);

  for (const cliente of CLIENTI_NOTI) {
    await db.customer.upsert({
      where: { customerCode: cliente.customerCode },
      update: {}, // NON tocca chi c'è già: vedi il commento su CLIENTI_NOTI.
      create: { ...cliente },
    });
  }
  console.log(`✓ ${CLIENTI_NOTI.length} clienti noti (geometria dichiarata, entrata da rilevare)`);
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]!).href;

if (isDirectRun) {
  main()
    .then(() => console.log("Seed completato."))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => void db.$disconnect());
}
