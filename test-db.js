const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  const branches = await prisma.branch.findMany();
  console.log("Branches:", branches);
  console.log("Products:", products.map(p => ({id: p.id, branchId: p.branchId})));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
