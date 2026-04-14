import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchId, getUserRole } from "@/lib/auth";

function isManager(role: string | null) {
  return !!role && (role.includes("SUPER_ADMIN") || role.includes("SHOP_MANAGER"));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const branchId = await getBranchId();
  if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRole();
  if (!isManager(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  let body: { action?: string; isActive?: boolean };
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.table.findFirst({ where: { id, branchId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.action === "regenerate") {
    const qrToken = crypto.randomUUID();
    const updated = await prisma.table.update({
      where: { id },
      data: { qrToken },
    });
    return NextResponse.json(updated);
  }

  if (typeof body.isActive === "boolean") {
    const updated = await prisma.table.update({
      where: { id },
      data: { isActive: body.isActive },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}

