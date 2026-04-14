import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchId } from "@/lib/auth";
import { deductInventory } from "@/lib/deductInventory";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sales } = body; // Array of { productId, quantity }
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!Array.isArray(sales) || sales.length === 0) {
      return NextResponse.json({ success: true });
    }

    await deductInventory({ prisma, branchId, sales });

    // Return the updated full inventory list so client can refresh properly
    const updatedInventory = await prisma.inventoryItem.findMany({
        where: { branchId },
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
