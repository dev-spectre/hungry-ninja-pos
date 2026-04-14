import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchId } from "@/lib/auth";
import { publish } from "@/lib/wsPublisher";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const branchId = await getBranchId();
  if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  let body: { transactionId?: string };
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const transactionId = typeof body.transactionId === "string" ? body.transactionId : "";
  if (!transactionId) {
    return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
  }

  const order = await prisma.customerOrder.findFirst({
    where: { id, branchId },
    select: { id: true, status: true, transactionId: true, branchId: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.transactionId) return NextResponse.json({ error: "Already billed" }, { status: 400 });
  if (order.status !== "ACCEPTED") return NextResponse.json({ error: "Order not accepted" }, { status: 400 });

  const updated = await prisma.customerOrder.update({
    where: { id },
    data: { status: "BILLED", transactionId },
    select: { id: true, status: true, branchId: true },
  });

  publish(updated.branchId, { type: "ORDER_UPDATED", orderId: updated.id, status: updated.status }).catch(() => {});
  return NextResponse.json({ success: true });
}

