import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchId, getUserRole } from "@/lib/auth";

function isManager(role: string | null) {
  return !!role && (role.includes("SUPER_ADMIN") || role.includes("SHOP_MANAGER"));
}

export async function GET() {
  const branchId = await getBranchId();
  if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRole();
  if (!isManager(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tables = await prisma.table.findMany({
    where: { branchId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(tables);
}

export async function POST(req: Request) {
  const branchId = await getBranchId();
  if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRole();
  if (!isManager(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { name?: string };
  try {
    body = (await req.json()) as any;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    const table = await prisma.table.create({
      data: { name, branchId },
    });
    return NextResponse.json(table);
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Table name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

