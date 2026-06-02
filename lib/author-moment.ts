import { db } from "./db";
import { sendMessage } from "./telegram";

// Minimum thresholds before sending the author moment notification.
const MIN_SEEN = 5;
const MIN_SXR = 60;

export async function checkAndSendAuthorMoment(patternSlug: string) {
  const pattern = await db.pattern.findUnique({
    where: { slug: patternSlug },
    include: {
      originFeedback: {
        include: { user: { select: { telegramChatId: true, name: true } } },
      },
    },
  });

  if (!pattern) return;
  if (pattern.origin !== "user_generative") return;
  if (pattern.authorMomentSentAt) return;
  if (pattern.seenCount < MIN_SEEN) return;
  if (!pattern.originFeedback?.user?.telegramChatId) return;

  const total = pattern.yesCount + pattern.partialCount + pattern.noCount;
  const surpriseTotal = pattern.surprisedCount + pattern.notSurprisedCount;
  if (!total || !surpriseTotal) return;

  const sxr = Math.round(
    (pattern.yesCount / total) * (pattern.surprisedCount / surpriseTotal) * 100
  );
  if (sxr < MIN_SXR) return;

  const chatId = pattern.originFeedback.user.telegramChatId;
  const message =
    `Un momento.\n\n` +
    `Hace un tiempo corregiste una interpretación del espejo. Esa corrección terminó convirtiéndose en un patrón nuevo.\n\n` +
    `El patrón se llama *${pattern.name}*.\n\n` +
    `Ya lo vieron ${pattern.seenCount} personas más y resonó con un S×R de ${sxr}.\n\n` +
    `Tu observación expandió el vocabulario del sistema.`;

  await sendMessage(chatId, message);

  await db.pattern.update({
    where: { slug: patternSlug },
    data: { authorMomentSentAt: new Date() },
  });
}
