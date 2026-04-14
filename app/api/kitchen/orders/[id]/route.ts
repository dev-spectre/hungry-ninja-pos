import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchId, getUserRole } from "@/lib/auth";
import { deductInventory } from "@/lib/deductInventory";
import { publish } from "@/lib/wsPublisher";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const branchId = await getBranchId();
  if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (await getUserRole()) || "";
  const allowed = role.includes("SUPER_ADMIN") || role.includes("SHOP_MANAGER") || role.includes("KITCHEN");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  let body: { action?: "ACCEPT" | "REJECT" };
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "ACCEPT" && action !== "REJECT") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const order = await prisma.customerOrder.findFirst({
    where: { id, branchId },
    include: { items: true },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "Order not pending" }, { status: 400 });
  }

  if (action === "REJECT") {
    const updated = await prisma.customerOrder.update({
      where: { id },
      data: { status: "REJECTED" },
      select: { id: true, status: true, branchId: true },
    });
    publish(updated.branchId, { type: "ORDER_UPDATED", orderId: updated.id, status: updated.status }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  // ACCEPT
  await prisma.$transaction(async (tx) => {
    await deductInventory({
      prisma: tx as any,
      branchId,
      sales: order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });

    await tx.customerOrder.update({
      where: { id },
      data: { status: "ACCEPTED" },
    });
  });

  publish(branchId, { type: "ORDER_UPDATED", orderId: id, status: "ACCEPTED" }).catch(() => {});
  return NextResponse.json({ success: true });
}

