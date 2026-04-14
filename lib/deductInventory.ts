import type { PrismaClient } from "@prisma/client";
import { round2 } from "@/lib/utils";

export type DeductInventorySale = { productId: string; quantity: number };

export async function deductInventory(params: {
  prisma: PrismaClient;
  branchId: string;
  sales: DeductInventorySale[];
}) {
  const { prisma, branchId, sales } = params;

  if (!Array.isArray(sales) || sales.length === 0) return;

  const productIds = sales.map((s) => s.productId);
  const allIngredients = await prisma.productIngredient.findMany({
    where: {
      productId: { in: productIds },
      product: { branchId },
    },
  });

  const deductions = new Map<string, number>();
  for (const sale of sales) {
    const productIngs = allIngredients.filter((i) => i.productId === sale.productId);
    for (const ing of productIngs) {
      const amount = round2(ing.quantityNeeded * sale.quantity);
      deductions.set(ing.inventoryItemId, (deductions.get(ing.inventoryItemId) || 0) + amount);
    }
  }

  const updates = Array.from(deductions.entries()).map(([itemId, amount]) =>
    prisma.inventoryItem.update({
      where: { id: itemId, branchId },
      data: { currentStock: { decrement: amount } },
    }),
  );

  if (updates.length === 0) return;
  const anyPrisma = prisma as any;
  if (typeof anyPrisma.$transaction === "function") {
    await anyPrisma.$transaction(updates);
  } else {
    await Promise.all(updates);
  }
}

