import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { getBranchId } from "@/lib/auth";

export async function GET() {
  try {
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const products = await prisma.product.findMany({
      where: { branchId },
      orderBy: { orderFrequency: "desc" },
      include: { ingredients: true },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, categoryId, price, active, orderFrequency } = body;
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const product = await prisma.product.create({
      data: {
        id,
        name,
        categoryId,
        price,
        active: active ?? true,
        orderFrequency: orderFrequency ?? 0,
        branchId,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ingredients, ...data } = body;
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const product = await prisma.product.update({
      where: { id, branchId },
      data,
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      // Actually because of Cascade this is generally not needed manually, but for safety:
      // Wait we don't have straightforward way to deleteMany BillItemRecord with branchId
      // without extra relations, but product delete handles it.
      await prisma.product.delete({ where: { id, branchId } });
    } catch (e: any) {
      if (e.code === "P2025") {
        return NextResponse.json({ success: true, message: "Already deleted" });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
