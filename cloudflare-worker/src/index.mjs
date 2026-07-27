const SERVICES = {
  haircut: { name: "\u0421\u0442\u0440\u0438\u0436\u043a\u0430", staff: { alex: "\u0410\u043b\u0435\u043a\u0441\u0435\u0439", maria: "\u041c\u0430\u0440\u0438\u044f" } },
  coloring: { name: "\u041e\u043a\u0440\u0430\u0448\u0438\u0432\u0430\u043d\u0438\u0435", staff: { maria: "\u041c\u0430\u0440\u0438\u044f" } },
};

const TIMES = ["10:00", "12:00", "14:00", "16:00"];

export function callbackData(action, ...values) {
  return [action, ...values].join("|");
}

export function bookingPrompt(kind, booking, name) {
  const field = kind === "name" ? "\u0438\u043c\u044f" : "\u043d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430";
  const service = SERVICES[booking.serviceId];
  const staff = service?.staff[booking.staffId];
  if (!service || !staff || !/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || !TIMES.includes(booking.time)) return null;
  const [year, month, day] = booking.date.split("-");
  const nameLine = name === undefined ? "" : `\n\u0418\u043c\u044f: ${name}`;
  return `\u0412\u0432\u0435\u0434\u0438\u0442\u0435 ${field}.\n\n\u0423\u0441\u043b\u0443\u0433\u0430: ${service.name}\n\u041c\u0430\u0441\u0442\u0435\u0440: ${staff}\n\u0414\u0430\u0442\u0430: ${day}.${month}.${year}\n\u0412\u0440\u0435\u043c\u044f: ${booking.time}${nameLine}`;
}

export function parseBookingPrompt(text) {
  if (typeof text !== "string") return null;
  const kind = text.includes("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f.") ? "name" : text.includes("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430.") ? "phone" : null;
  const details = text.match(/\u0423\u0441\u043b\u0443\u0433\u0430: ([^\n]+)\n\u041c\u0430\u0441\u0442\u0435\u0440: ([^\n]+)\n\u0414\u0430\u0442\u0430: (\d{2})\.(\d{2})\.(\d{4})\n\u0412\u0440\u0435\u043c\u044f: (\d{2}:\d{2})(?:\n\u0418\u043c\u044f: ([^\n]+))?/);
  if (!kind || !details) return null;
  const [, serviceName, staffName, day, month, year, time, name] = details;
  const serviceId = Object.entries(SERVICES).find(([, service]) => service.name === serviceName)?.[0];
  const staffId = serviceId && Object.entries(SERVICES[serviceId].staff).find(([, staff]) => staff === staffName)?.[0];
  if (!serviceId || !staffId) return null;
  return { kind, serviceId, staffId, date: `${year}-${month}-${day}`, time, ...(name ? { name } : {}) };
}

export function welcomeKeyboard() {
  return keyboard([
    [button("\u0417\u0430\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f", callbackData("start"))],
    [{ text: "\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a\u0443", url: "https://t.me/hideki_code" }],
  ]);
}

export function nextWeekdays(from, count) {
  const result = [];
  const day = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (result.length < count) {
    day.setUTCDate(day.getUTCDate() + 1);
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) result.push(day.toISOString().slice(0, 10));
  }
  return result;
}

function keyboard(rows) {
  return { inline_keyboard: rows };
}

function button(text, data) {
  return { text, callback_data: data };
}

function dateLabel(isoDate) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "2-digit", weekday: "short", timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

function bookingText(serviceId, staffId, date, time) {
  const service = SERVICES[serviceId];
  const staff = service?.staff[staffId];
  if (!service || !staff || !TIMES.includes(time)) return null;
  return `\u0417\u0430\u043f\u0438\u0441\u044c \u043d\u0430 ${service.name}\n\u041c\u0430\u0441\u0442\u0435\u0440: ${staff}\n\u0414\u0430\u0442\u0430: ${dateLabel(date)}\n\u0412\u0440\u0435\u043c\u044f: ${time}`;
}

function contactSummary(booking, name, phone) {
  const summary = bookingText(booking.serviceId, booking.staffId, booking.date, booking.time);
  if (!summary) return null;
  return `${summary}\n\u0418\u043c\u044f: ${name}\n\u0422\u0435\u043b\u0435\u0444\u043e\u043d: ${phone}`;
}

function serviceRows() {
  return Object.entries(SERVICES).map(([id, service]) => [button(service.name, callbackData("service", id))]);
}

function welcomeText(firstName) {
  return `(\u0434\u0435\u043c\u043e-\u0432\u0435\u0440\u0441\u0438\u044f)\n\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c, ${firstName}.\n\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0441\u043b\u0443\u0433\u0443, \u0438 \u043c\u044b \u043f\u043e\u0434\u0431\u0435\u0440\u0451\u043c \u0443\u0434\u043e\u0431\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f.`;
}

async function telegram(env, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Telegram ${method} failed: ${response.status}`);
}

async function edit(env, callback, text, rows) {
  await telegram(env, "editMessageText", {
    chat_id: callback.message.chat.id,
    message_id: callback.message.message_id,
    text,
    reply_markup: keyboard(rows),
  });
}

async function sendContactPrompt(env, chatId, prompt, validation) {
  await telegram(env, "sendMessage", {
    chat_id: chatId,
    text: validation ? `${validation}\n\n${prompt}` : prompt,
    reply_markup: { force_reply: true },
  });
}

async function handleCallback(env, callback) {
  const [action, serviceId, staffId, date, time] = callback.data.split("|");
  await telegram(env, "answerCallbackQuery", { callback_query_id: callback.id });

  if (action === "start") {
    return edit(env, callback, "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0441\u043b\u0443\u0433\u0443:", serviceRows());
  }

  if (action === "service" && SERVICES[serviceId]) {
    const rows = Object.entries(SERVICES[serviceId].staff).map(([id, name]) => [button(name, callbackData("staff", serviceId, id))]);
    return edit(env, callback, "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043c\u0430\u0441\u0442\u0435\u0440\u0430:", rows);
  }

  if (action === "staff" && SERVICES[serviceId]?.staff[staffId]) {
    const rows = nextWeekdays(new Date(), 5).map((day) => [button(dateLabel(day), callbackData("date", serviceId, staffId, day))]);
    return edit(env, callback, "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0430\u0442\u0443:", rows);
  }

  if (action === "date" && SERVICES[serviceId]?.staff[staffId] && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const rows = TIMES.map((slot) => [button(slot, callbackData("time", serviceId, staffId, date, slot))]);
    return edit(env, callback, "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0440\u0435\u043c\u044f:", rows);
  }

  if (action === "time") {
    const summary = bookingText(serviceId, staffId, date, time);
    if (!summary) return;
    const booking = { serviceId, staffId, date, time };
    await edit(env, callback, summary, []);
    return sendContactPrompt(env, callback.message.chat.id, bookingPrompt("name", booking));
  }

  if (callback.data === "confirm") {
    const summary = callback.message.text;
    if (env.OWNER_CHAT_ID) {
      await telegram(env, "sendMessage", {
        chat_id: env.OWNER_CHAT_ID,
        text: `\u041d\u043e\u0432\u0430\u044f \u0434\u0435\u043c\u043e-\u0437\u0430\u043f\u0438\u0441\u044c\n\n${summary}`,
      });
    }
    return edit(env, callback, "\u2705 \u0417\u0430\u043f\u0438\u0441\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430. \u0414\u043e \u0432\u0441\u0442\u0440\u0435\u0447\u0438!", [
      [button("\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u043f\u0438\u0441\u044c", callbackData("start"))],
    ]);
  }

}

async function handleReply(env, message) {
  const prompt = parseBookingPrompt(message.reply_to_message?.text);
  if (!prompt || !bookingText(prompt.serviceId, prompt.staffId, prompt.date, prompt.time)) return;

  const value = message.text?.trim().replace(/\s+/g, " ");
  if (prompt.kind === "name") {
    if (!value || value.length > 80) {
      const validation = value ? "\u0418\u043c\u044f \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0434\u043b\u0438\u043d\u043d\u043e\u0435." : "\u0418\u043c\u044f \u043d\u0435 \u0434\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c \u043f\u0443\u0441\u0442\u044b\u043c.";
      return sendContactPrompt(env, message.chat.id, bookingPrompt("name", prompt), validation);
    }
    return sendContactPrompt(env, message.chat.id, bookingPrompt("phone", prompt, value));
  }

  if (prompt.kind === "phone" && prompt.name) {
    if (!value || value.length > 32) {
      const validation = value ? "\u041d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430 \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0434\u043b\u0438\u043d\u043d\u044b\u0439." : "\u041d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430 \u043d\u0435 \u0434\u043e\u043b\u0436\u0435\u043d \u0431\u044b\u0442\u044c \u043f\u0443\u0441\u0442\u044b\u043c.";
      return sendContactPrompt(env, message.chat.id, bookingPrompt("phone", prompt, prompt.name), validation);
    }
    const summary = contactSummary(prompt, prompt.name, value);
    if (!summary) return;
    return telegram(env, "editMessageText", {
      chat_id: message.chat.id,
      message_id: message.reply_to_message.message_id,
      text: summary,
      reply_markup: keyboard([
        [button("\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c", callbackData("confirm"))],
      ]),
    });
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("Telegram demo bot", { status: 200 });
    if (env.WEBHOOK_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    const update = await request.json();
    if (update.message?.text === "/start") {
      await telegram(env, "sendMessage", {
        chat_id: update.message.chat.id,
        text: welcomeText(update.message.from?.first_name ?? ""),
        reply_markup: welcomeKeyboard(),
      });
    } else if (update.message?.reply_to_message) {
      await handleReply(env, update.message);
    }
    if (update.callback_query) await handleCallback(env, update.callback_query);
    return new Response("ok");
  },
};
