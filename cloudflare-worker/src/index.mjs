const SERVICES = {
  haircut: { name: "Стрижка", staff: { alex: "Алексей", maria: "Мария" } },
  coloring: { name: "Окрашивание", staff: { maria: "Мария" } },
};

const TIMES = ["10:00", "12:00", "14:00", "16:00"];

export function callbackData(action, ...values) {
  return [action, ...values].join("|");
}

export function bookingPrompt(kind, booking, name) {
  const prompt = { kind, ...booking };
  if (name !== undefined) prompt.name = name;
  return `booking:${JSON.stringify(prompt)}`;
}

export function parseBookingPrompt(text) {
  if (!text.startsWith("booking:")) return null;

  try {
    return JSON.parse(text.slice("booking:".length));
  } catch {
    return null;
  }
}

export function welcomeKeyboard() {
  return keyboard([
    [button("Р—Р°РїРёСЃР°С‚СЊСЃСЏ", callbackData("service", "haircut"))],
    [{ text: "РќР°РїРёСЃР°С‚СЊ СЂР°Р·СЂР°Р±РѕС‚С‡РёРєСѓ", url: "https://t.me/hideki_code" }],
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
  return `Запись на ${service.name}\nМастер: ${staff}\nДата: ${dateLabel(date)}\nВремя: ${time}`;
}

async function telegram(env, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Telegram ${method} failed: ${response.status}`);
}

async function sendServices(env, chatId) {
  await telegram(env, "sendMessage", {
    chat_id: chatId,
    text: "Демо-бот записи\n\nВыберите услугу:",
    reply_markup: keyboard(Object.entries(SERVICES).map(([id, service]) => [button(service.name, callbackData("service", id))])),
  });
}

async function edit(env, callback, text, rows) {
  await telegram(env, "editMessageText", {
    chat_id: callback.message.chat.id,
    message_id: callback.message.message_id,
    text,
    reply_markup: keyboard(rows),
  });
}

async function handleCallback(env, callback) {
  const [action, serviceId, staffId, date, time] = callback.data.split("|");
  await telegram(env, "answerCallbackQuery", { callback_query_id: callback.id });

  if (action === "service" && SERVICES[serviceId]) {
    const rows = Object.entries(SERVICES[serviceId].staff).map(([id, name]) => [button(name, callbackData("staff", serviceId, id))]);
    return edit(env, callback, "Выберите мастера:", rows);
  }

  if (action === "staff" && SERVICES[serviceId]?.staff[staffId]) {
    const rows = nextWeekdays(new Date(), 5).map((day) => [button(dateLabel(day), callbackData("date", serviceId, staffId, day))]);
    return edit(env, callback, "Выберите дату:", rows);
  }

  if (action === "date" && SERVICES[serviceId]?.staff[staffId] && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const rows = TIMES.map((slot) => [button(slot, callbackData("time", serviceId, staffId, date, slot))]);
    return edit(env, callback, "Выберите время:", rows);
  }

  if (action === "time") {
    const summary = bookingText(serviceId, staffId, date, time);
    if (!summary) return;
    return edit(env, callback, `${summary}\n\nПодтвердить?`, [
      [button("Подтвердить", callbackData("confirm", serviceId, staffId, date, time))],
      [button("Начать заново", callbackData("service", "haircut"))],
    ]);
  }

  if (action === "confirm") {
    const summary = bookingText(serviceId, staffId, date, time);
    if (!summary) return;
    await edit(env, callback, `${summary}\n\n✅ Демо-запись подтверждена.`, []);
    if (env.OWNER_CHAT_ID) {
      const name = [callback.from.first_name, callback.from.last_name].filter(Boolean).join(" ") || "Без имени";
      const username = callback.from.username ? ` (@${callback.from.username})` : "";
      await telegram(env, "sendMessage", {
        chat_id: env.OWNER_CHAT_ID,
        text: `Новая демо-запись\n${name}${username}\n\n${summary}`,
      });
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.searchParams.has("health")) {
      return Response.json({ telegram: env.TELEGRAM_BOT_TOKEN ? "configured" : "not_configured" });
    }
    if (request.method !== "POST") return new Response("Telegram demo bot", { status: 200 });
    if (env.WEBHOOK_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    const update = await request.json();
    if (update.message?.text === "/start") await sendServices(env, update.message.chat.id);
    if (update.callback_query) await handleCallback(env, update.callback_query);
    return new Response("ok");
  },
};
