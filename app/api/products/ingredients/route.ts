import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json({ error: "Missing productId" }, { status: 400 });
    }
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const product = await prisma.product.findUnique({ where: { id: productId, branchId } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const ingredients = await prisma.productIngredient.findMany({
      where: { productId },
      include: {
        inventoryItem: true,
      },
    });

    return NextResponse.json(ingredients);
  } catch (error) {
    console.error("Failed to fetch product ingredients:", error);
    return NextResponse.json(
       { error: "Internal Server Error" },
       { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, ingredients } = body;
    // ingredients: Array of { inventoryItemId, quantityNeeded }

    if (!productId || !Array.isArray(ingredients)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const product = await prisma.product.findUnique({ where: { id: productId, branchId } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Replace all existing ingredients for this product sequentially
    // 1. Delete all existing
    await prisma.productIngredient.deleteMany({
      where: { productId },
    });

    // 2. Insert new ones
    if (ingredients.length > 0) {
      await prisma.productIngredient.createMany({
        data: ingredients.map((ing) => ({
           id: crypto.randomUUID(),
           productId,
           inventoryItemId: ing.inventoryItemId,
           quantityNeeded: ing.quantityNeeded,
        })),
      });
    }

    // 3. Return the new list populated with inventoryItems
    const result = await prisma.productIngredient.findMany({
       where: { productId },
       include: { inventoryItem: true },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update product ingredients:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
