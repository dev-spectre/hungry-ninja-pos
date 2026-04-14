import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchId } from "@/lib/auth";

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function GET(req: Request) {
  const branchId = await getBranchId();
  if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const { start, end } = getTodayRange();

  const whereBase: any = {
    branchId,
    createdAt: { gte: start, lt: end },
  };

  if (status) {
    whereBase.status = status;
    if (status === "ACCEPTED") {
      whereBase.transactionId = null;
    }
  } else {
    whereBase.status = { in: ["PENDING", "ACCEPTED"] };
  }

  const orders = await prisma.customerOrder.findMany({
    where: whereBase,
    include: {
      items: true,
      table: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

