#!/usr/bin/env npx tsx
/**
 * Admin Management Script
 * 
 * Usage:
 *   npx tsx scripts/manage-admin.ts create --username admin --password secret123 --name "Super Admin"
 *   npx tsx scripts/manage-admin.ts update --username admin --password newpass
 *   npx tsx scripts/manage-admin.ts update --username admin --new-username newadmin
 *   npx tsx scripts/manage-admin.ts show
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function getOriginalAdmin() {
  return prisma.user.findFirst({
    where: { role: { contains: "SUPER_ADMIN" } },
    orderBy: { createdAt: "asc" },
  });
}

async function createAdmin(username: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.error(`❌ Username "${username}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      username,
      passwordHash,
      role: "SUPER_ADMIN",
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

  console.log(`✅ Super Admin created`);
  console.log(`   ID:       ${user.id}`);
  console.log(`   Username: ${user.username}`);
  console.log(`   Name:     ${user.name}`);
}

async function updateAdmin(opts: { username?: string; newUsername?: string; password?: string; name?: string }) {
  const admin = await getOriginalAdmin();
  if (!admin) {
    console.error("❌ No super admin found in the database.");
    process.exit(1);
  }

  const updateData: any = {};

  if (opts.newUsername) {
    const clash = await prisma.user.findUnique({ where: { username: opts.newUsername } });
    if (clash && clash.id !== admin.id) {
      console.error(`❌ Username "${opts.newUsername}" is already taken.`);
      process.exit(1);
    }
    updateData.username = opts.newUsername;
  }

  if (opts.password) {
    updateData.passwordHash = await bcrypt.hash(opts.password, 10);
  }

  if (opts.name) {
    updateData.name = opts.name;
  }

  if (Object.keys(updateData).length === 0) {
    console.log("Nothing to update. Use --password, --new-username, or --name flags.");
    return;
  }

  const updated = await prisma.user.update({
    where: { id: admin.id },
    data: updateData,
  });

  console.log(`✅ Original Super Admin updated`);
  console.log(`   ID:       ${updated.id}`);
  console.log(`   Username: ${updated.username}`);
  console.log(`   Name:     ${updated.name}`);
  if (opts.password) console.log(`   Password: (changed)`);
}

async function showAdmin() {
  const admin = await getOriginalAdmin();
  if (!admin) {
    console.log("❌ No super admin found in the database.");
    console.log("   Run: npx tsx scripts/manage-admin.ts create --username admin --password secret --name \"Admin\"");
    return;
  }

  console.log(`🔑 Original Super Admin`);
  console.log(`   ID:        ${admin.id}`);
  console.log(`   Username:  ${admin.username}`);
  console.log(`   Name:      ${admin.name}`);
  console.log(`   Role:      ${admin.role}`);
  console.log(`   Created:   ${admin.createdAt.toISOString()}`);
  console.log(`   Branch:    ${admin.branchId ?? "(global)"}`);
}

// ── CLI Parser ──────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  function getFlag(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return undefined;
    return args[idx + 1];
  }

  try {
    switch (command) {
      case "create": {
        const username = getFlag("--username");
        const password = getFlag("--password");
        const name = getFlag("--name") ?? "Super Admin";
        if (!username || !password) {
          console.error("Usage: manage-admin.ts create --username <user> --password <pass> [--name <name>]");
          process.exit(1);
        }
        await createAdmin(username, password, name);
        break;
      }
      case "update": {
        const newUsername = getFlag("--new-username");
        const password = getFlag("--password");
        const name = getFlag("--name");
        await updateAdmin({ newUsername, password, name });
        break;
      }
      case "show": {
        await showAdmin();
        break;
      }
      default:
        console.log("Admin Management Script\n");
        console.log("Commands:");
        console.log("  create  --username <u> --password <p> [--name <n>]  Create super admin");
        console.log("  update  [--new-username <u>] [--password <p>] [--name <n>]  Update original admin");
        console.log("  show                                                Show original admin info");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
