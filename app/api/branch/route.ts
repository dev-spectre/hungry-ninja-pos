import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserRole } from "@/lib/auth";

export async function GET() {
   try {
       const role = await getUserRole();
       if (role !== "SUPER_ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403});
       
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
       if (role !== "SUPER_ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403});
       
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
