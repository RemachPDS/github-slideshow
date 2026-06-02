import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ReactionType, CorrectionType } from "@/lib/types";

interface FeedbackBody {
  insightId: string;
  surprised?: boolean;
  reaction?: ReactionType;
  correctionText?: string;
  correctionType?: CorrectionType;
}

// POST /api/feedback — record surprise or resonance step
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as FeedbackBody;
  if (!body.insightId) return NextResponse.json({ error: "insightId requerido." }, { status: 400 });

  const insight = await db.insight.findUnique({ where: { id: body.insightId } });
  if (!insight) return NextResponse.json({ error: "Insight no encontrado." }, { status: 404 });

  // Upsert feedback for this insight + user (one feedback record per insight)
  const feedback = await db.feedback.upsert({
    where: {
      // compound unique not defined — find existing and update
      id: (await db.feedback.findFirst({
        where: { insightId: body.insightId, userId: session.user.id },
        select: { id: true },
      }))?.id ?? "new",
    },
    update: {
      ...(body.surprised !== undefined && { surprised: body.surprised }),
      ...(body.reaction && { reaction: body.reaction }),
      ...(body.correctionText && { correctionText: body.correctionText }),
      ...(body.correctionType && { correctionType: body.correctionType }),
    },
    create: {
      insightId: body.insightId,
      userId: session.user.id,
      surprised: body.surprised,
      reaction: body.reaction,
      correctionText: body.correctionText,
      correctionType: body.correctionType,
    },
  });

  // Update aggregate counters on the pattern
  const patternSlug = insight.pattern;
  if (body.surprised !== undefined) {
    await db.pattern.update({
      where: { slug: patternSlug },
      data: body.surprised
        ? { surprisedCount: { increment: 1 } }
        : { notSurprisedCount: { increment: 1 } },
    });
  }
  if (body.reaction) {
    const field = `${body.reaction}Count` as "yesCount" | "partialCount" | "noCount";
    await db.pattern.update({
      where: { slug: patternSlug },
      data: { [field]: { increment: 1 } },
    });
  }

  return NextResponse.json({ feedback });
}
