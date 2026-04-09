import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchId, getUserRole } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isGlobal = searchParams.get("global") === "true";
    const role = await getUserRole();

    if (isGlobal && role?.includes("SUPER_ADMIN")) {
        const items = await prisma.inventoryItem.findMany({
            include: { branch: true },
            orderBy: { name: "asc" }
        });
        const formatted = items.map(item => ({
           ...item,
           createdAt: item.createdAt.getTime()
        }));
        return NextResponse.json(formatted);
    }

    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const items = await prisma.inventoryItem.findMany({
      where: { branchId },
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
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const item = await prisma.inventoryItem.create({
      data: {
        id,
        name,
        unit,
        currentStock: currentStock ?? 0,
        lowStockThreshold: lowStockThreshold ?? 5,
        branchId,
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
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    // Filter out createdAt manually if it was passed from client to avoid type issues
    if ('createdAt' in data) {
       delete data.createdAt;
    }

    const item = await prisma.inventoryItem.update({
      where: { id, branchId },
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
    const branchId = await getBranchId();
    if (!branchId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await prisma.$transaction([
      prisma.inventoryItem.delete({ where: { id, branchId } }),
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
