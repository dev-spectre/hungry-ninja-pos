import { prisma } from "./lib/prisma";

async function run() {
  const sales = [{ productId: 'non-existent', quantity: 1 }];
  try {
    await prisma.$transaction(async (tx) => {
      for (const sale of sales) {
         const ingredients = await tx.productIngredient.findMany({
            where: { productId: sale.productId }
         });
         for (const ing of ingredients) {
             const amountToDeduct = Number(ing.quantityNeeded) * sale.quantity;
             await tx.inventoryItem.update({
                 where: { id: ing.inventoryItemId },
                 data: { currentStock: { decrement: amountToDeduct } }
             });
         }
      }
    });
    const items = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });
    console.log("Success:", items);
  } catch (e) {
    console.error("Crash:", e);
  }
}
run();
