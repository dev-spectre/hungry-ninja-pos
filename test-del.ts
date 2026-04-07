import { prisma } from "./lib/prisma";

async function run() {
  try {
    await prisma.$transaction([
      prisma.billItemRecord.deleteMany({ where: { productId: "any" } }),
      prisma.productIngredient.deleteMany({ where: { productId: "any" } }),
      prisma.product.delete({ where: { id: "any" } }),
    ]);
    console.log("Deleted");
  } catch (e) {
    console.error("DELETE Error:", e.name, e.code, e.message);
  }
}
run();
