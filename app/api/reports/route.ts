import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const reports = await prisma.dailyReport.findMany({
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

    const report = await prisma.dailyReport.upsert({
      where: { id },
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
