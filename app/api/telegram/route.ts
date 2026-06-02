import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeCheckins } from "@/lib/ai";
import { classifyCorrection } from "@/lib/ai";
import { sendMessage, sendWithKeyboard, answerCallback, clearKeyboard } from "@/lib/telegram";
import { checkAndSendAuthorMoment } from "@/lib/author-moment";
import type { CheckinInput } from "@/lib/types";

// Telegram sends updates as POST to this webhook.
export async function POST(req: NextRequest) {
  const update = await req.json();

  try {
    if (update.message) await handleMessage(update.message);
    else if (update.callback_query) await handleCallback(update.callback_query);
  } catch (e) {
    console.error("telegram webhook error", e);
  }

  return NextResponse.json({ ok: true });
}

// ─── Conversation helpers ─────────────────────────────────────────────────────

interface Draft {
  currentDay: number;
  days: Array<{ day: number; time?: string; surprise?: string; preserve?: string }>;
  pendingCorrection?: { insightId: string; reaction: string };
}

async function getConv(chatId: string) {
  return db.telegramConversation.upsert({
    where: { chatId },
    update: {},
    create: { chatId, state: "idle", draft: { currentDay: 1, days: [] } },
  });
}

async function setState(chatId: string, state: string, draft?: Draft) {
  await db.telegramConversation.update({
    where: { chatId },
    data: { state, ...(draft !== undefined && { draft: draft as object }) },
  });
}

// ─── Message handler ──────────────────────────────────────────────────────────

async function handleMessage(msg: { chat: { id: number }; text?: string }) {
  const chatId = String(msg.chat.id);
  const text = (msg.text ?? "").trim();
  const conv = await getConv(chatId);
  const draft = (conv.draft ?? { currentDay: 1, days: [] }) as Draft;

  // ── /start ──
  if (text.startsWith("/start")) {
    await sendMessage(
      chatId,
      `*Mirror Engine*\n\nEspejo cognitivo — detecta lo que todavía no ves sobre vos mismo.\n\n` +
        `Para vincular tu cuenta:\n1. Abrí la app web → Ajustes → Conectar Telegram\n2. Copiá el token\n3. Enviá \`/link TU_TOKEN\` acá\n\n` +
        `Una vez vinculado: \`/checkin\` para empezar.`
    );
    return;
  }

  // ── /link TOKEN ──
  if (text.startsWith("/link ")) {
    const token = text.split(" ")[1]?.trim();
    if (!token) {
      await sendMessage(chatId, "Formato: `/link TU_TOKEN`");
      return;
    }
    const user = await db.user.findUnique({ where: { telegramLinkToken: token } });
    if (!user) {
      await sendMessage(chatId, "Token inválido o ya usado. Generá uno nuevo en Ajustes.");
      return;
    }
    await db.user.update({
      where: { id: user.id },
      data: { telegramChatId: chatId, telegramLinkToken: null },
    });
    await db.telegramConversation.update({
      where: { chatId },
      data: { userId: user.id },
    });
    await sendMessage(chatId, `✓ Cuenta vinculada. Enviá /checkin para empezar.`);
    return;
  }

  // Commands that require a linked account
  if (!conv.userId && !text.startsWith("/start") && !text.startsWith("/link")) {
    await sendMessage(chatId, "Primero vinculá tu cuenta. Enviá /start para ver las instrucciones.");
    return;
  }

  // ── /checkin ──
  if (text === "/checkin") {
    const newDraft: Draft = { currentDay: 1, days: [] };
    await setState(chatId, "day_time", newDraft);
    await sendMessage(chatId, `*Día 1*\n\n¿Qué te ocupó más tiempo hoy?`);
    return;
  }

  // ── /espejo ──
  if (text === "/espejo") {
    if (draft.days.length < 2) {
      await sendMessage(chatId, "Necesitás al menos 2 días. Usá /checkin para cargarlos.");
      return;
    }
    await runAnalysis(chatId, conv.userId!, draft);
    return;
  }

  // ── Conversation states ──

  if (conv.state === "day_time") {
    draft.days[draft.currentDay - 1] = { day: draft.currentDay, time: text };
    await setState(chatId, "day_surprise", draft);
    await sendMessage(chatId, "¿Hubo algo que salió mejor o peor de lo esperado?");
    return;
  }

  if (conv.state === "day_surprise") {
    draft.days[draft.currentDay - 1].surprise = text;
    await setState(chatId, "day_preserve", draft);
    await sendMessage(chatId, "¿Hay algo que no quisieras olvidar?");
    return;
  }

  if (conv.state === "day_preserve") {
    draft.days[draft.currentDay - 1].preserve = text;
    const n = draft.currentDay;
    const canAnalyze = n >= 2;
    await setState(chatId, "after_day", draft);
    await sendMessage(
      chatId,
      `Día ${n} guardado ✓\n\n¿Agregás otro día? (sí / no${canAnalyze ? " / /espejo para analizar ahora" : ""})`
    );
    return;
  }

  if (conv.state === "after_day") {
    const lower = text.toLowerCase();
    if (["sí", "si", "s", "yes", "y"].includes(lower)) {
      draft.currentDay += 1;
      draft.days[draft.currentDay - 1] = { day: draft.currentDay };
      await setState(chatId, "day_time", draft);
      await sendMessage(chatId, `*Día ${draft.currentDay}*\n\n¿Qué te ocupó más tiempo hoy?`);
    } else if (["no", "n"].includes(lower)) {
      if (draft.days.length < 2) {
        await sendMessage(chatId, "Necesitás al menos 2 días para analizar. ¿Agregás otro? (sí)");
      } else {
        await runAnalysis(chatId, conv.userId!, draft);
      }
    } else {
      await sendMessage(chatId, "Respondé *sí* o *no*, o usá /espejo para analizar.");
    }
    return;
  }

  if (conv.state === "pending_correction" && draft.pendingCorrection) {
    const { insightId, reaction } = draft.pendingCorrection;
    const insight = await db.insight.findUnique({ where: { id: insightId } });
    if (insight) {
      const correctionType = await classifyCorrection(insight.type, insight.insightText, text);
      await db.feedback.upsert({
        where: { insightId_userId: { insightId, userId: conv.userId! } },
        update: { reaction: reaction as "partial" | "no", correctionText: text, correctionType },
        create: {
          insightId,
          userId: conv.userId!,
          reaction: reaction as "partial" | "no",
          correctionText: text,
          correctionType,
        },
      });
      const replyText =
        correctionType === "generative"
          ? "💡 Guardado — puede ser muy valioso. Tu observación va al dataset."
          : "Guardado. Tu perspectiva ayuda a calibrar el espejo.";
      await sendMessage(chatId, replyText);

      // Check author moment if this correction is generative and originated a pattern
      await checkAndSendAuthorMoment(insight.pattern).catch(() => {});
    }
    delete draft.pendingCorrection;
    await setState(chatId, "idle", draft);
    return;
  }

  // Fallback
  await sendMessage(
    chatId,
    "No entendí. Usá:\n• /checkin — cargar días\n• /espejo — analizar\n• /start — instrucciones"
  );
}

// ─── Callback handler (inline button taps) ───────────────────────────────────

async function handleCallback(cb: {
  id: string;
  message: { chat: { id: number }; message_id: number };
  data: string;
}) {
  await answerCallback(cb.id);

  const chatId = String(cb.message.chat.id);
  const conv = await getConv(chatId);
  if (!conv.userId) return;

  const [action, insightId, value] = cb.data.split("|");

  if (action === "surprise") {
    const surprised = value === "yes";
    await db.feedback.upsert({
      where: { insightId_userId: { insightId, userId: conv.userId } },
      update: { surprised },
      create: { insightId, userId: conv.userId, surprised },
    });
    await db.insight
      .findUnique({ where: { id: insightId } })
      .then((ins) =>
        ins
          ? db.pattern.update({
              where: { slug: ins.pattern },
              data: surprised ? { surprisedCount: { increment: 1 } } : { notSurprisedCount: { increment: 1 } },
            })
          : null
      );
    await clearKeyboard(chatId, cb.message.message_id);
    await sendWithKeyboard(chatId, "¿Esto resuena?", [
      [{ text: "Sí, exacto", callback_data: `reaction|${insightId}|yes` }],
      [
        { text: "En parte", callback_data: `reaction|${insightId}|partial` },
        { text: "No aplica", callback_data: `reaction|${insightId}|no` },
      ],
    ]);
    return;
  }

  if (action === "reaction") {
    const reaction = value as "yes" | "partial" | "no";
    const insight = await db.insight.findUnique({ where: { id: insightId } });
    if (!insight) return;

    await db.feedback.upsert({
      where: { insightId_userId: { insightId, userId: conv.userId } },
      update: { reaction },
      create: { insightId, userId: conv.userId, reaction },
    });

    const field = `${reaction}Count` as "yesCount" | "partialCount" | "noCount";
    await db.pattern.update({ where: { slug: insight.pattern }, data: { [field]: { increment: 1 } } });
    await checkAndSendAuthorMoment(insight.pattern).catch(() => {});

    await clearKeyboard(chatId, cb.message.message_id);

    if (reaction === "yes") {
      await sendMessage(chatId, "✓ Guardado.");
    } else {
      const draft = (conv.draft ?? { currentDay: 1, days: [] }) as Draft;
      draft.pendingCorrection = { insightId, reaction };
      await setState(chatId, "pending_correction", draft);
      const prompt = reaction === "partial" ? "¿Qué parte es correcta y cuál no?" : "¿Qué estamos interpretando mal?";
      await sendMessage(chatId, prompt);
    }
  }
}

// ─── Analysis runner ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  attention: "Atención",
  repetition: "Repetición",
  friction: "Fricción",
  contradiction: "Contradicción",
  identity: "Identidad",
  evolution: "Evolución",
  hidden_cost: "Coste oculto",
};

async function runAnalysis(chatId: string, userId: string, draft: Draft) {
  await sendMessage(chatId, "Analizando... un momento.");

  const checkins: CheckinInput[] = draft.days
    .filter((d) => d.time && d.surprise && d.preserve)
    .map((d) => ({
      day: d.day,
      responses: { time: d.time!, surprise: d.surprise!, preserve: d.preserve! },
    }));

  const insightOutputs = await analyzeCheckins(checkins);

  const session = await db.checkinSession.create({
    data: {
      userId,
      checkins: {
        create: checkins.map((c) => ({
          userId,
          day: c.day,
          timeResponse: c.responses.time,
          surpriseResponse: c.responses.surprise,
          preserveResponse: c.responses.preserve,
        })),
      },
    },
  });

  const insights = await db.$transaction(
    insightOutputs.map((ins) =>
      db.insight.create({
        data: {
          sessionId: session.id,
          userId,
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

  await Promise.all(
    insightOutputs.map((ins) =>
      db.pattern.upsert({
        where: { slug: ins.pattern },
        update: { seenCount: { increment: 1 } },
        create: { slug: ins.pattern, name: ins.title, seenCount: 1, origin: "founder" },
      })
    )
  );

  const count = insights.length;
  await sendMessage(chatId, count === 1 ? "1 patrón detectado." : `${count} patrones detectados.`);

  for (const insight of insights) {
    const evidenceText = insight.evidence.map((e) => `_"${e}"_`).join("\n");
    const text =
      `*${TYPE_LABELS[insight.type] ?? insight.type} · ${insight.title}*\n\n` +
      `${evidenceText}\n\n${insight.insightText}\n\n_${insight.question}_`;

    await sendWithKeyboard(chatId, text, [
      [
        { text: "😮 Me sorprendió", callback_data: `surprise|${insight.id}|yes` },
        { text: "Ya lo sabía", callback_data: `surprise|${insight.id}|no` },
      ],
    ]);
  }

  await setState(chatId, "idle", { currentDay: 1, days: [] });
}
