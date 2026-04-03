import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Transaction } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transactions } = body as { transactions: (Transaction & { deleted?: boolean })[] };

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { message: "No transactions to sync" },
        { status: 400 }
      );
    }

    const toDelete = transactions.filter((t) => t.deleted);
    const toUpsert = transactions.filter((t) => !t.deleted);

    const deleteIds = toDelete.map((t) => t.id);

    // Delete transactions marked as deleted
    if (deleteIds.length > 0) {
      await prisma.billItemRecord.deleteMany({
        where: { transactionId: { in: deleteIds } },
      });
      await prisma.transaction.deleteMany({
        where: { id: { in: deleteIds } },
      });
    }

    // Upsert remaining transactions
    let syncedIds: string[] = [];
    if (toUpsert.length > 0) {
      const results = await prisma.$transaction(
        toUpsert.map((tx) =>
          prisma.transaction.upsert({
            where: { id: tx.id },
            create: {
              id: tx.id,
              date: tx.date,
              timestamp: tx.timestamp,
              total: tx.total,
              paymentMode: tx.paymentMode,
              items: {
                create: tx.items.map((item) => ({
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
                            }
                          }
                        }
                      }
                    }
                  }
                })),
              },
            },
            update: {},
          })
        )
      );
      syncedIds = results.map((r: { id: string }) => r.id);
    }

    return NextResponse.json({
      success: true,
      syncedCount: syncedIds.length,
      syncedIds,
      deletedIds: deleteIds,
    });
  } catch (error) {
    console.error("Failed to sync transactions:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { items: true },
      orderBy: { timestamp: 'desc' },
      take: 500
    });

    const formattedTransactions = transactions.map(t => ({
      id: t.id,
      date: t.date,
      timestamp: t.timestamp,
      total: t.total,
      paymentMode: t.paymentMode,
      items: t.items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        price: i.price,
        quantity: i.quantity,
        subtotal: i.subtotal,
      })),
      syncStatus: "synced"
    }));

    return NextResponse.json({ success: true, transactions: formattedTransactions });
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
