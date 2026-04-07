import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    const transactions = await prisma.transaction.findMany({
      where: date ? { date } : undefined,
      include: { items: true },
      orderBy: { timestamp: "desc" },
      take: 500,
    });

    const formatted = transactions.map((t) => ({
      id: t.id,
      date: t.date,
      timestamp: t.timestamp,
      total: t.total,
      paymentMode: t.paymentMode,
      items: t.items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        price: i.price,
        quantity: i.quantity,
        subtotal: i.subtotal,
      })),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, date, timestamp, total, paymentMode, items } = body;

    const transaction = await prisma.transaction.create({
      data: {
        id,
        date,
        timestamp,
        total,
        paymentMode,
        items: {
          create: items.map((item: any) => ({
            id: crypto.randomUUID(),
            productName: item.productName,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.subtotal,
            product: {
              connectOrCreate: {
                where: { id: item.productId },
                create: {
                  id: item.productId,
                  name: item.productName,
                  price: item.price,
                  active: true,
                  orderFrequency: 0,
                  category: {
                    connectOrCreate: {
                      where: { id: "uncategorized" },
                      create: {
                        id: "uncategorized",
                        name: "Uncategorized",
                        isDefault: true,
                      },
                    },
                  },
                },
              },
            },
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Failed to create transaction:", error);
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

    await prisma.$transaction([
      prisma.billItemRecord.deleteMany({ where: { transactionId: id } }),
      prisma.transaction.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
