import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { getBranchId, getUserRole } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
    try {
        const role = await getUserRole();
        const branchId = await getBranchId();

        if (role?.includes("SUPER_ADMIN")) {
            if (branchId) {
                const users = await prisma.user.findMany({ where: { branchId }, include: { branch: true } });
                return NextResponse.json(users);
            }
            const users = await prisma.user.findMany({ include: { branch: true } });
            return NextResponse.json(users);
        } else if (role?.includes("SHOP_MANAGER")) {
            const users = await prisma.user.findMany({ where: { branchId }, include: { branch: true } });
            return NextResponse.json(users);
        }

        return NextResponse.json({error: "Forbidden"}, {status: 403});
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const r = await getUserRole();
        const b = await getBranchId();
        
        const { name, username, password, role, branchId, permissions } = await req.json();

        if (r !== "SUPER_ADMIN" && r !== "SHOP_MANAGER") {
            return NextResponse.json({error: "Forbidden"}, {status: 403});
        }

        let targetBranchId: string | null = branchId === "" ? null : branchId;
        if (r === "SHOP_MANAGER") {
            if (role?.includes("SUPER_ADMIN") || role?.includes("SHOP_MANAGER")) {
                return NextResponse.json({error: "Cannot create manager or super admin"}, {status: 403});
            }
            targetBranchId = b;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                 name, username, passwordHash: hashedPassword, role, branchId: targetBranchId, permissions
            } as any
        });

        // Hide password hash before responding
        const { passwordHash: _, ...userSafe } = user;
        return NextResponse.json(userSafe, {status: 201});
    } catch (error) {
        console.error("Failed to create user:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const r = await getUserRole();
        const b = await getBranchId();
        
        const { id, name, username, password, role, branchId, permissions } = await req.json();
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        if (r !== "SUPER_ADMIN" && r !== "SHOP_MANAGER") {
            return NextResponse.json({error: "Forbidden"}, {status: 403});
        }

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({error: "User not found"}, {status: 404});

        if (existing.role.includes("SUPER_ADMIN")) {
             const originalAdmin = await prisma.user.findFirst({
                 where: { role: { contains: "SUPER_ADMIN" } },
                 orderBy: { createdAt: "asc" },
                 select: { id: true },
             });
             if (originalAdmin && originalAdmin.id === id) {
                 if (!role.includes("SUPER_ADMIN")) {
                     return NextResponse.json({ error: "Cannot downgrade original super admin" }, { status: 403 });
                 }
                 if (branchId && branchId !== "") {
                     return NextResponse.json({ error: "Original super admin must be global (no branch)" }, { status: 403 });
                 }
             }
        }

        if (r === "SHOP_MANAGER" && existing.branchId !== b) {
            return NextResponse.json({error: "Forbidden, user is not in your branch"}, {status: 403});
        }

        let targetBranchId = branchId !== undefined ? branchId : existing.branchId;
        if (r === "SHOP_MANAGER") targetBranchId = b;

        const updateData: any = { name, username, role, branchId: targetBranchId, permissions };
        if (password && password.trim() !== "") {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData
        });

        const { passwordHash: _, ...userSafe } = user;
        return NextResponse.json(userSafe, {status: 200});
    } catch (error) {
        console.error("Failed to update user:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });

        const r = await getUserRole();
        const b = await getBranchId();

        if (r !== "SUPER_ADMIN" && r !== "SHOP_MANAGER") {
            return NextResponse.json({error: "Forbidden"}, {status: 403});
        }

        const userToDelete = await prisma.user.findUnique({ where: { id } });
        if (!userToDelete) return NextResponse.json({error: "User not found"}, {status: 404});

        if (r === "SHOP_MANAGER" && userToDelete.branchId !== b) {
            return NextResponse.json({error: "Forbidden, user is not in your branch"}, {status: 403});
        }
        if (r.includes("SHOP_MANAGER") && (userToDelete.role.includes("SUPER_ADMIN") || userToDelete.role.includes("SHOP_MANAGER"))) {
             return NextResponse.json({error: "Forbidden, cannot delete manager"}, {status: 403});
        }

        // Protect the original super admin (first-created SUPER_ADMIN)
        if (userToDelete.role.includes("SUPER_ADMIN")) {
            const originalAdmin = await prisma.user.findFirst({
                where: { role: { contains: "SUPER_ADMIN" } },
                orderBy: { createdAt: "asc" },
                select: { id: true },
            });
            if (originalAdmin && originalAdmin.id === id) {
                return NextResponse.json({ error: "Cannot delete the original super admin" }, { status: 403 });
            }
        }

        await prisma.user.delete({ where: { id } });
        return NextResponse.json({success: true});

    } catch (error) {
        console.error("Failed to delete user:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
