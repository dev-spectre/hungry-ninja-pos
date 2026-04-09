import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchId } from "@/lib/auth";

export async function GET() {
  try {
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const reports = await prisma.dailyReport.findMany({
      where: { branchId },
      orderBy: { archivedAt: "desc" },
      take: 100,
    });

    const formatted = reports.map((r) => ({
      id: r.id,
      date: r.date,
      archivedAt: r.archivedAt,
      openingCash: r.openingCash,
      totalExpenses: r.totalExpenses,
      netProfit: r.netProfit,
      transactionCount: r.transactionCount,
      summary: {
        totalSales: r.totalSales,
        cashSales: r.cashSales,
        upiSales: r.upiSales,
        cardSales: r.cardSales,
        totalItems: r.totalItems,
      },
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, date, archivedAt, openingCash, summary, totalExpenses, netProfit, transactionCount } = body;
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const report = await prisma.dailyReport.upsert({
      where: { date_branchId: { date, branchId } },
      create: {
        id,
        date,
        archivedAt,
        openingCash,
        totalSales: summary.totalSales,
        cashSales: summary.cashSales,
        upiSales: summary.upiSales,
        cardSales: summary.cardSales,
        totalItems: summary.totalItems,
        totalExpenses,
        netProfit,
        transactionCount,
        branchId,
      },
      update: {
        date,
        archivedAt,
        openingCash,
        totalSales: summary.totalSales,
        cashSales: summary.cashSales,
        upiSales: summary.upiSales,
        cardSales: summary.cardSales,
        totalItems: summary.totalItems,
        totalExpenses,
        netProfit,
        transactionCount,
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Failed to create report:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
