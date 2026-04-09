import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("session")?.value;
  const session = await decrypt(cookie);

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: session });
}
