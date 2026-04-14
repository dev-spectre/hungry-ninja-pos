import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/wsPublisher";

type OrderBody = {
  qrToken: string;
  items: Array<{ productId: string; quantity: number }>;
  notes?: string;
};

export async function POST(req: Request) {
  let body: OrderBody;
  try {
    body = (await req.json()) as OrderBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const qrToken = typeof body.qrToken === "string" ? body.qrToken : "";
  const items = Array.isArray(body.items) ? body.items : [];
  const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;

  if (!qrToken || items.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (notes && notes.length > 200) {
    return NextResponse.json({ error: "Notes too long" }, { status: 400 });
  }

  const table = await prisma.table.findFirst({
    where: { qrToken, isActive: true },
    select: { id: true, name: true, branchId: true },
  });

  if (!table) {
    return NextResponse.json({ error: "Invalid table" }, { status: 404 });
  }

  const normalized = items
    .map((i) => ({
      productId: typeof i.productId === "string" ? i.productId : "",
      quantity: typeof i.quantity === "number" ? i.quantity : Number(i.quantity),
    }))
    .filter((i) => i.productId && Number.isFinite(i.quantity) && i.quantity > 0 && Number.isInteger(i.quantity));

  if (normalized.length === 0) {
    return NextResponse.json({ error: "Invalid items" }, { status: 400 });
  }

  const productIds = Array.from(new Set(normalized.map((i) => i.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, branchId: table.branchId, active: true },
    select: { id: true, name: true, price: true },
  });

  const productById = new Map(products.map((p) => [p.id, p]));

  for (const line of normalized) {
    if (!productById.has(line.productId)) {
      return NextResponse.json({ error: "Invalid product in items" }, { status: 400 });
    }
  }

  const computedItems = normalized.map((line) => {
    const p = productById.get(line.productId)!;
    const subtotal = p.price * line.quantity;
    return {
      productId: p.id,
      productName: p.name,
      productPrice: p.price,
      quantity: line.quantity,
      subtotal,
    };
  });

  const totalAmount = computedItems.reduce((s, i) => s + i.subtotal, 0);

  const order = await prisma.$transaction(async (tx) => {
    return await tx.customerOrder.create({
      data: {
        tableId: table.id,
        branchId: table.branchId,
        notes: notes || undefined,
        totalAmount,
        items: { create: computedItems },
      },
      include: {
        items: true,
        table: true,
      },
    });
  });

  publish(order.branchId, { type: "NEW_ORDER", order }).catch(() => {});

  return NextResponse.json({ success: true, orderId: order.id });
}

