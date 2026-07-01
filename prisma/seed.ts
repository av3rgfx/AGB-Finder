import { PrismaClient, type UserRole, type UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";

// Own client instance: seed runs under tsx/node, so it cannot import the
// `server-only`-guarded singleton in src/server/db.ts.
const db = new PrismaClient();

export interface AdminSeedInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AdminSeedData {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string;
}

/** Build the admin row (pure). The password is hashed; plaintext never stored. */
export async function buildAdminData(
  input: AdminSeedInput,
  hash: (pw: string, rounds: number) => Promise<string> = bcrypt.hash,
): Promise<AdminSeedData> {
  const passwordHash = await hash(input.password, 12);
  return {
    email: input.email,
    firstName: input.firstName ?? "Admin",
    lastName: input.lastName ?? "UFP",
    role: "ADMIN",
    status: "ACTIVE",
    passwordHash,
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

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD sono obbligatori per il seed.");
  }

  const adminData = await buildAdminData({ email, password });
  const admin = await db.user.upsert({ where: { email }, update: {}, create: adminData });
  console.log(`✓ Admin: ${admin.email}`);

  for (const category of BASE_CATEGORIES) {
    await db.productCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }
  console.log(`✓ ${BASE_CATEGORIES.length} categorie base`);
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
