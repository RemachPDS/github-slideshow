import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { classifyCorrection } from "@/lib/ai";
import { checkAndSendAuthorMoment } from "@/lib/author-moment";
import type { ReactionType } from "@/lib/types";

interface FeedbackBody {
  insightId: string;
  surprised?: boolean;
  reaction?: ReactionType;
  correctionText?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as FeedbackBody;
  if (!body.insightId) return NextResponse.json({ error: "insightId requerido." }, { status: 400 });

  const insight = await db.insight.findUnique({ where: { id: body.insightId } });
  if (!insight) return NextResponse.json({ error: "Insight no encontrado." }, { status: 404 });

  // Auto-classify correction when present — never trust client-sent type
  let correctionType = undefined;
  if (body.correctionText?.trim()) {
    correctionType = await classifyCorrection(
      insight.type,
      insight.insightText,
      body.correctionText.trim()
    );
  }

  // Upsert: one feedback record per (insight, user) pair
  const feedback = await db.feedback.upsert({
    where: { insightId_userId: { insightId: body.insightId, userId: session.user.id } },
    update: {
      ...(body.surprised !== undefined && { surprised: body.surprised }),
      ...(body.reaction && { reaction: body.reaction }),
      ...(body.correctionText && { correctionText: body.correctionText.trim() }),
      ...(correctionType && { correctionType }),
    },
    create: {
      insightId: body.insightId,
      userId: session.user.id,
      surprised: body.surprised,
      reaction: body.reaction,
      correctionText: body.correctionText?.trim(),
      correctionType,
    },
  });

  // Update aggregate counters on the pattern
  const slug = insight.pattern;
  if (body.surprised !== undefined) {
    await db.pattern.update({
      where: { slug },
      data: body.surprised
        ? { surprisedCount: { increment: 1 } }
        : { notSurprisedCount: { increment: 1 } },
    });
  }
  if (body.reaction) {
    const field = `${body.reaction}Count` as "yesCount" | "partialCount" | "noCount";
    await db.pattern.update({ where: { slug }, data: { [field]: { increment: 1 } } });
  }

  // Check if this pattern has earned an author moment notification
  await checkAndSendAuthorMoment(slug).catch(() => {});

  return NextResponse.json({ feedback, correctionType });
}
