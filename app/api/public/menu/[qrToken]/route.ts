import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await ctx.params;

  const table = await prisma.table.findFirst({
    where: { qrToken, isActive: true },
    select: { id: true, name: true, branchId: true },
  });

  if (!table) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { branchId: table.branchId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: { branchId: table.branchId, active: true },
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    table: { id: table.id, name: table.name, branchId: table.branchId },
    categories,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      active: p.active,
      orderFrequency: p.orderFrequency,
      categoryId: p.categoryId,
      branchId: p.branchId,
      categoryName: p.category?.name ?? null,
    })),
  });
}

