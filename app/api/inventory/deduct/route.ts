import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sales } = body; // Array of { productId, quantity }

    if (!Array.isArray(sales) || sales.length === 0) {
      return NextResponse.json({ success: true });
    }

    // 1. Fetch all ingredients for the products in this sale
    const productIds = sales.map(s => s.productId);
    const allIngredients = await prisma.productIngredient.findMany({
       where: { productId: { in: productIds } }
    });

    // 2. Aggregate the total amounts to deduct per inventory item
    const deductions = new Map<string, number>();
    for (const sale of sales) {
       const productIngs = allIngredients.filter((i: any) => i.productId === sale.productId);
       for (const ing of productIngs) {
          const amount = ing.quantityNeeded * sale.quantity;
          deductions.set(
             ing.inventoryItemId,
             (deductions.get(ing.inventoryItemId) || 0) + amount
          );
       }
    }

    // 3. Prepare the atomic decrements
    const updates = Array.from(deductions.entries()).map(([itemId, amount]) => 
       prisma.inventoryItem.update({
          where: { id: itemId },
          data: {
             currentStock: { decrement: amount }
          }
       })
    );

    // 4. Execute all atomically as a fast non-interactive bulk transaction
    await prisma.$transaction(updates);

    // Return the updated full inventory list so client can refresh properly
    const updatedInventory = await prisma.inventoryItem.findMany({
        orderBy: { name: "asc" }
    });
    
    return NextResponse.json(updatedInventory.map((item: any) => ({
       ...item,
       createdAt: item.createdAt.getTime()
    })));
  } catch (error) {
    console.error("Failed to deduct stock:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
