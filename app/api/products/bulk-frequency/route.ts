import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { productIds } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "Invalid or empty productIds array" }, { status: 400 });
    }

    // Prisma doesn't have an atomic "increment multiple different records"
    // that returns all of them easily with one query, but updateMany can handle this
    // if all are incremented by 1.
    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: {
        orderFrequency: { increment: 1 },
      },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Failed to bulk update frequency:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
