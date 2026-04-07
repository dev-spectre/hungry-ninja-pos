import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: "asc" },
    });
    
    // Format dates for the frontend hook compatibility
    const formatted = items.map(item => ({
      ...item,
      createdAt: item.createdAt.getTime()
    }));
    
    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, unit, currentStock, lowStockThreshold } = body;

    const item = await prisma.inventoryItem.create({
      data: {
        id,
        name,
        unit,
        currentStock: currentStock ?? 0,
        lowStockThreshold: lowStockThreshold ?? 5,
      },
    });

    return NextResponse.json({
      ...item,
      createdAt: item.createdAt.getTime()
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create inventory item:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, currentStock, lowStockThreshold, ...data } = body;
    
    // Filter out createdAt manually if it was passed from client to avoid type issues
    if ('createdAt' in data) {
       delete data.createdAt;
    }

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...data,
        // Include updates specifically if they exist in the request
        ...(currentStock !== undefined && { currentStock }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold })
      },
    });

    return NextResponse.json({
      ...item,
      createdAt: item.createdAt.getTime()
    });
  } catch (error) {
    console.error("Failed to update inventory item:", error);
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
      prisma.productIngredient.deleteMany({ where: { inventoryItemId: id } }),
      prisma.inventoryItem.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete inventory item:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
