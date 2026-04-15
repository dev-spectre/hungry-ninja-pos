import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { encrypt } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const user = await prisma.user.findUnique({
      where: { username },
      include: { branch: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const sessionData = {
      id: user.id,
      name: user.name,
      role: user.role,
      permissions: (user as any).permissions,
      branchId: user.branchId,
      branchName: user.branch?.name,
    };

    const token = await encrypt(sessionData);

    const res = NextResponse.json({ user: sessionData });
    res.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("Login handle error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
