const API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

type KeyboardButton = { text: string; callback_data: string };

async function tgPost(method: string, body: object) {
  await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function sendMessage(chatId: string | number, text: string) {
  await tgPost("sendMessage", { chat_id: chatId, text, parse_mode: "Markdown" });
}

export async function sendWithKeyboard(
  chatId: string | number,
  text: string,
  rows: KeyboardButton[][]
): Promise<number | undefined> {
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: rows },
    }),
  });
  const data = await res.json();
  return data.result?.message_id as number | undefined;
}

export async function answerCallback(callbackQueryId: string) {
  await tgPost("answerCallbackQuery", { callback_query_id: callbackQueryId });
}

export async function clearKeyboard(chatId: string | number, messageId: number) {
  await tgPost("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}
