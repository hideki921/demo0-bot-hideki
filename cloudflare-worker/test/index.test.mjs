import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  bookingPrompt,
  callbackData,
  nextWeekdays,
  parseBookingPrompt,
  welcomeKeyboard,
} from "../src/index.mjs";

const booking = {
  serviceId: "haircut",
  staffId: "alex",
  date: "2026-07-29",
  time: "12:00",
};

async function telegramRequests(update, env = { TELEGRAM_BOT_TOKEN: "test" }) {
  const sent = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://api.telegram.org/")) {
      sent.push({ url: String(url), method: options.method, body: JSON.parse(options.body) });
      return new Response("{}", { status: 200 });
    }
    return originalFetch(url, options);
  };

  try {
    const response = await worker.fetch(new Request("https://example.test/", {
      method: "POST",
      body: JSON.stringify(update),
    }), env);
    assert.equal(response.status, 200);
    return sent;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function replyUpdate(text, prompt, chatId = 7) {
  return {
    message: {
      chat: { id: chatId },
      text,
      reply_to_message: { message_id: 13, text: prompt },
    },
  };
}

test("callback data preserves the booking selection", () => {
  assert.equal(
    callbackData("confirm", "haircut", "alex", "2026-07-28", "10:00"),
    "confirm|haircut|alex|2026-07-28|10:00",
  );
});

test("next weekdays excludes Saturday and Sunday", () => {
  const dates = nextWeekdays(new Date("2026-08-01T12:00:00Z"), 5);

  assert.deepEqual(dates, ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]);
});

test("ordinary GET requests return the Telegram demo bot text", async () => {
  const response = await worker.fetch(new Request("https://example.test/?health"), {});

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "Telegram demo bot");
});

test("name prompt round-trips a selected booking", () => {
  const text = bookingPrompt("name", booking);

  assert.deepEqual(parseBookingPrompt(text), { kind: "name", ...booking });
});

test("phone prompt retains the entered name", () => {
  const text = bookingPrompt("phone", booking, "\u0410\u043d\u043d\u0430");

  assert.equal(parseBookingPrompt(text).name, "\u0410\u043d\u043d\u0430");
});

test("welcome keyboard links to the developer", () => {
  const keyboard = welcomeKeyboard();

  assert.equal(keyboard.inline_keyboard[0][0].text, "\u0417\u0430\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f");
  assert.equal(keyboard.inline_keyboard[0][0].callback_data, "start");
  assert.equal(keyboard.inline_keyboard[1][0].text, "\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a\u0443");
  assert.equal(keyboard.inline_keyboard[1][0].url, "https://t.me/hideki_code");
});

test("start sends the exact welcome text with the Telegram first name", async () => {
  const sent = await telegramRequests({
    message: { chat: { id: 7 }, text: "/start", from: { first_name: "\u0410\u043d\u043d\u0430" } },
  });

  assert.equal(sent.length, 1);
  assert.equal(
    sent[0].body.text,
    "(\u0434\u0435\u043c\u043e-\u0432\u0435\u0440\u0441\u0438\u044f)\n\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c, \u0410\u043d\u043d\u0430.\n\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u0441\u043b\u0443\u0433\u0443, \u0438 \u043c\u044b \u043f\u043e\u0434\u0431\u0435\u0440\u0451\u043c \u0443\u0434\u043e\u0431\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f.",
  );
  assert.deepEqual(sent[0].body.reply_markup, welcomeKeyboard());
});

test("a name reply asks for the phone number", async () => {
  const sent = await telegramRequests(replyUpdate("\u0410\u043d\u043d\u0430", bookingPrompt("name", booking)));

  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.chat_id, 7);
  assert.match(sent[0].body.text, /\u043d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430/i);
  assert.equal(parseBookingPrompt(sent[0].body.text).kind, "phone");
  assert.equal(parseBookingPrompt(sent[0].body.text).name, "\u0410\u043d\u043d\u0430");
  assert.equal(sent[0].body.reply_markup.force_reply, true);
  assert.equal(sent[0].body.reply_markup.inline_keyboard[0][0].text, "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c");
});

test("a phone reply edits the prompt into a complete booking summary", async () => {
  const sent = await telegramRequests(replyUpdate("+7 999 123-45-67", bookingPrompt("phone", booking, "\u0410\u043d\u043d\u0430")));

  assert.equal(sent.length, 1);
  assert.match(sent[0].url, /\/editMessageText$/);
  assert.match(sent[0].body.text, /\u0421\u0442\u0440\u0438\u0436\u043a\u0430/);
  assert.match(sent[0].body.text, /\u0410\u043b\u0435\u043a\u0441\u0435\u0439/);
  assert.match(sent[0].body.text, /\u0410\u043d\u043d\u0430/);
  assert.match(sent[0].body.text, /\+7 999 123-45-67/);
  assert.deepEqual(sent[0].body.reply_markup.inline_keyboard.map(([item]) => item.text), ["\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c", "\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c"]);
});

test("a blank name reply repeats the name prompt without advancing", async () => {
  const sent = await telegramRequests(replyUpdate("   ", bookingPrompt("name", booking)));

  assert.equal(sent.length, 1);
  assert.match(sent[0].body.text, /\u0438\u043c\u044f.*\u043f\u0443\u0441\u0442/i);
  assert.equal(parseBookingPrompt(sent[0].body.text).kind, "name");
});

test("a blank phone reply repeats the phone prompt without advancing", async () => {
  const sent = await telegramRequests(replyUpdate("   ", bookingPrompt("phone", booking, "\u0410\u043d\u043d\u0430")));

  assert.equal(sent.length, 1);
  assert.match(sent[0].body.text, /\u043d\u043e\u043c\u0435\u0440.*\u043f\u0443\u0441\u0442/i);
  assert.equal(parseBookingPrompt(sent[0].body.text).kind, "phone");
});
