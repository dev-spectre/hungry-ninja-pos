require("dotenv/config");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Missing DATABASE_URL");
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function env(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main() {
  const username = env("ADMIN_USERNAME", "admin");
  const password = env("ADMIN_PASSWORD", "admin");
  const name = process.env.ADMIN_NAME || "Admin";
  const branchName = process.env.ADMIN_BRANCH_NAME || "Main Branch";

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`User already exists: ${username} (${existing.role})`);
    return;
  }

  const branch =
    (await prisma.branch.findFirst({ where: { name: branchName } })) ||
    (await prisma.branch.create({ data: { name: branchName } }));

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      username,
      passwordHash,
      role: "SUPER_ADMIN",
      branchId: branch.id,
      permissions: {
        billing: { read: true, write: true, delete: true },
        history: { read: true, write: true, delete: true },
        expenses: { read: true, write: true, delete: true },
        inventory: { read: true, write: true, delete: true },
        kitchen: { read: true, write: true, delete: true },
        admin: { read: true, write: true, delete: true },
      },
    },
  });

  console.log("Created SUPER_ADMIN:");
  console.log({ id: user.id, username: user.username, branchId: user.branchId, branchName: branch.name });
  console.log("Login with:");
  console.log({ username, password });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

