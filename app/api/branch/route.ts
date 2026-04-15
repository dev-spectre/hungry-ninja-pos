import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { getUserRole } from "@/lib/auth";

export async function GET() {
   try {
       const role = await getUserRole();
        if (!role?.includes("SUPER_ADMIN")) return NextResponse.json({error: "Forbidden"}, {status: 403});
       
       const branches = await prisma.branch.findMany({ orderBy: { name: "asc" } });
       return NextResponse.json(branches);
   } catch (error) {
       console.error("Failed to fetch branches:", error);
       return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
   }
}

export async function POST(req: Request) {
   try {
       const role = await getUserRole();
        if (!role?.includes("SUPER_ADMIN")) return NextResponse.json({error: "Forbidden"}, {status: 403});
       
       const { name, address } = await req.json();
       const branch = await prisma.branch.create({
           data: { name, address: address || "" }
       });
       return NextResponse.json(branch, { status: 201 });
   } catch (error) {
       console.error("Failed to create branch:", error);
       return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
   }
}

export async function PUT(req: Request) {
   try {
       const role = await getUserRole();
        if (!role?.includes("SUPER_ADMIN")) return NextResponse.json({error: "Forbidden"}, {status: 403});

       const { id, name, address } = await req.json();
       if (!id) return NextResponse.json({ error: "Missing branch id" }, { status: 400 });

       const branch = await prisma.branch.update({
           where: { id },
           data: { name, address: address || "" },
       });
       return NextResponse.json(branch);
   } catch (error) {
       console.error("Failed to update branch:", error);
       return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
   }
}

export async function DELETE(req: Request) {
   try {
       const role = await getUserRole();
        if (!role?.includes("SUPER_ADMIN")) return NextResponse.json({error: "Forbidden"}, {status: 403});

       const { searchParams } = new URL(req.url);
       const id = searchParams.get("id");
       if (!id) return NextResponse.json({ error: "Missing branch id" }, { status: 400 });

       // Prisma schema uses onDelete: Cascade, so all related data is deleted automatically
       await prisma.branch.delete({ where: { id } });
       return NextResponse.json({ success: true });
   } catch (error) {
       console.error("Failed to delete branch:", error);
       return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
   }
}
