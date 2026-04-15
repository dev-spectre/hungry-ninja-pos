import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { getBranchId } from "@/lib/auth";

export async function GET() {
  try {
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const categories = await prisma.category.findMany({
      where: { branchId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, isDefault } = body;
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const category = await prisma.category.create({
      data: { id, name, isDefault: isDefault ?? false, branchId },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Failed to create category:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name } = body;
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const category = await prisma.category.update({
      where: { id, branchId },
      data: { name },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to update category:", error);
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

    // Delete products in this category first, then the category
    const productsInCategory = await prisma.product.findMany({
      where: { categoryId: id, branchId },
      select: { id: true },
    });
    const productIds = productsInCategory.map((p) => p.id);

    await prisma.$transaction([
      ...(productIds.length > 0
        ? [
            prisma.billItemRecord.deleteMany({
              where: { productId: { in: productIds } },
            }),
            prisma.product.deleteMany({
              where: { id: { in: productIds } },
            }),
          ]
        : []),
      prisma.category.delete({ where: { id, branchId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete category:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
