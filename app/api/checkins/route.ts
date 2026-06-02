import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { analyzeCheckins } from "@/lib/ai";
import type { CheckinInput } from "@/lib/types";

// POST /api/checkins — create session + checkins + run analysis
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { checkins: CheckinInput[] };
  if (!body.checkins?.length || body.checkins.length < 2) {
    return NextResponse.json({ error: "Mínimo 2 días de check-in." }, { status: 400 });
  }

  // Create session + checkins in one transaction
  const checkinSession = await db.checkinSession.create({
    data: {
      userId: session.user.id,
      checkins: {
        create: body.checkins.map((c) => ({
          userId: session.user.id!,
          day: c.day,
          timeResponse: c.responses.time,
          surpriseResponse: c.responses.surprise,
          preserveResponse: c.responses.preserve,
        })),
      },
    },
  });

  // Run Claude analysis
  const insightOutputs = await analyzeCheckins(body.checkins);

  // Persist insights + upsert pattern seen count
  const insights = await db.$transaction(
    insightOutputs.map((ins) =>
      db.insight.create({
        data: {
          sessionId: checkinSession.id,
          userId: session.user.id!,
          type: ins.type,
          pattern: ins.pattern,
          title: ins.title,
          evidence: ins.evidence,
          insightText: ins.insight,
          question: ins.question,
        },
      })
    )
  );

  // Bump seen count on each pattern (upsert)
  await Promise.all(
    insightOutputs.map((ins) =>
      db.pattern.upsert({
        where: { slug: ins.pattern },
        update: { seenCount: { increment: 1 } },
        create: {
          slug: ins.pattern,
          name: ins.title,
          seenCount: 1,
          origin: "founder",
        },
      })
    )
  );

  return NextResponse.json({ sessionId: checkinSession.id, insights });
}
