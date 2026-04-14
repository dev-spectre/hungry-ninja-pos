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

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main() {
  const username = must("ADMIN_USERNAME");
  const newPassword = must("NEW_ADMIN_PASSWORD");
  const confirm = must("CONFIRM_RESET");

  if (confirm !== "YES") {
    throw new Error('Refusing to run. Set CONFIRM_RESET="YES" to proceed.');
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new Error(`User not found: ${username}`);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  console.log("Password reset OK for:", { username });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

