import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
// POST /api/telegram/link — generate a one-time link token for the logged-in user
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = crypto.randomUUID().replace(/-/g, "");

  await db.user.update({
    where: { id: session.user.id },
    data: { telegramLinkToken: token },
  });

  return NextResponse.json({ token });
}
