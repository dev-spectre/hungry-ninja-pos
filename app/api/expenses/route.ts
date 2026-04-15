import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { getBranchId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const expenses = await prisma.expense.findMany({
      where: {
        branchId,
        ...(date ? { date } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Failed to fetch expenses:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, title, category, amount, date, notes, createdAt } = body;
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const expense = await prisma.expense.create({
      data: { id, title, category, amount, date, notes: notes || "", createdAt, branchId },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Failed to create expense:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await prisma.expense.delete({ where: { id, branchId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
