import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/patterns — return all patterns with stats, sorted by S×R
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patterns = await db.pattern.findMany({
    orderBy: { seenCount: "desc" },
    include: {
      formulations: true,
      originFeedback: {
        include: { user: { select: { email: true, profileType: true } } },
      },
    },
  });

  return NextResponse.json({ patterns });
}
