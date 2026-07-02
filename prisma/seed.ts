import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { pathToFileURL } from "node:url";
import { seedCatalog } from "./seed-catalog";

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

  const catalog = await seedCatalog(db);
  console.log(`✓ catalogo demo: ${catalog.products} prodotti in ${catalog.categories} categorie`);
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
