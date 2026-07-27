# Booking Demo Contact Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a polished welcome, name and phone collection, cancellation, and developer contact link to the stateless Telegram booking demo.

**Architecture:** Keep all booking choices in Telegram callback data. For text inputs, send ForceReply prompts containing a human-readable booking summary; each incoming reply includes its replied-to bot message, which lets the Worker reconstruct the chosen service, staff, date, time, and name without a database. The Worker validates non-empty text before advancing.

**Tech Stack:** Cloudflare Workers, JavaScript ES modules, Telegram Bot API, Node.js built-in test runner.

## Global Constraints

- Do not add a database, Redis, or any other stateful service.
- The welcome text is exactly `(демо-версия)\nДобро пожаловать, <Telegram first name>.\nВыберите услугу, и мы подберём удобное время.`
- The developer button links to `https://t.me/hideki_code`.
- `Новая запись` appears only after a confirmed booking; intermediate selection screens do not show `Начать заново`.
- Do not log or commit Telegram secrets.

---

### Task 1: Stateless contact-form utilities and regression tests

**Files:**
- Modify: `cloudflare-worker/src/index.mjs`
- Modify: `cloudflare-worker/test/index.test.mjs`

**Interfaces:**
- Produces `bookingPrompt(kind, booking, name?) -> string` where `kind` is `name` or `phone`.
- Produces `parseBookingPrompt(text) -> { kind, serviceId, staffId, date, time, name? } | null`.
- Produces `welcomeKeyboard() -> { inline_keyboard: Array }`.

- [ ] **Step 1: Write the failing tests**

```js
test("name prompt round-trips a selected booking", () => {
  const text = bookingPrompt("name", { serviceId: "haircut", staffId: "alex", date: "2026-07-29", time: "12:00" });
  assert.deepEqual(parseBookingPrompt(text), {
    kind: "name", serviceId: "haircut", staffId: "alex", date: "2026-07-29", time: "12:00",
  });
});

test("phone prompt retains the entered name", () => {
  const text = bookingPrompt("phone", { serviceId: "haircut", staffId: "alex", date: "2026-07-29", time: "12:00" }, "Анна");
  assert.equal(parseBookingPrompt(text).name, "Анна");
});

test("welcome keyboard links to the developer", () => {
  const keyboard = welcomeKeyboard();
  assert.equal(keyboard.inline_keyboard[1][0].url, "https://t.me/hideki_code");
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `node --test cloudflare-worker/test/index.test.mjs`

Expected: failure because the three exports do not yet exist.

- [ ] **Step 3: Implement the minimum utilities**

```js
export function bookingPrompt(kind, booking, name) {
  const fields = [kind, booking.serviceId, booking.staffId, booking.date, booking.time, name ?? ""];
  return `Введите ${kind === "name" ? "имя" : "номер телефона"}.\n\nДетали записи: ${fields.join("|")}`;
}

export function parseBookingPrompt(text) {
  const marker = "Детали записи: ";
  const payload = text?.split(marker)[1];
  const [kind, serviceId, staffId, date, time, name] = payload?.split("|") ?? [];
  return kind && serviceId && staffId && date && time ? { kind, serviceId, staffId, date, time, ...(name ? { name } : {}) } : null;
}
```

Create `welcomeKeyboard()` with one callback button `Записаться` and one URL button `Написать разработчику`.

- [ ] **Step 4: Verify the utility tests pass**

Run: `node --test cloudflare-worker/test/index.test.mjs`

Expected: all tests pass.

- [ ] **Step 5: Commit the tested utilities**

```bash
git add cloudflare-worker/src/index.mjs cloudflare-worker/test/index.test.mjs
git commit -m "Add stateless booking contact prompts"
```

### Task 2: Telegram flow, deployment, and manual verification

**Files:**
- Modify: `cloudflare-worker/src/index.mjs`

**Interfaces:**
- Consumes `bookingPrompt`, `parseBookingPrompt`, and `welcomeKeyboard` from Task 1.
- Produces a Worker that accepts `/start`, callback selections, replies for name and phone, and final `confirm`, `cancel`, and `start` callbacks.

- [ ] **Step 1: Add a failing handler-level test**

```js
test("a name reply asks for the phone number", async () => {
  const sent = [];
  globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return new Response("{}", { status: 200 }); };
  await worker.fetch(nameReplyRequest(), { TELEGRAM_BOT_TOKEN: "test" });
  assert.match(sent.at(-1).text, /номер телефона/i);
});
```

- [ ] **Step 2: Verify it fails**

Run: `node --test cloudflare-worker/test/index.test.mjs`

Expected: failure because text messages are not handled as contact-form replies.

- [ ] **Step 3: Implement the Worker flow**

```js
if (update.message?.text === "/start") {
  await telegram(env, "sendMessage", { chat_id: chatId, text: welcomeText(firstName), reply_markup: welcomeKeyboard() });
}
if (update.message?.reply_to_message) {
  const prompt = parseBookingPrompt(update.message.reply_to_message.text);
  if (prompt?.kind === "name" && update.message.text.trim()) sendPhonePrompt(...);
  if (prompt?.kind === "phone" && update.message.text.trim()) sendConfirmation(...);
}
```

Add ForceReply markup to both prompts, `Отменить` callback buttons during contact input and confirmation, and owner notification containing name and phone. Make `Новая запись` appear only in the final success message. Remove the public `?health` route.

- [ ] **Step 4: Verify locally**

Run: `node --test cloudflare-worker/test/index.test.mjs; node --check cloudflare-worker/src/index.mjs`

Expected: all tests pass and syntax check exits with code 0.

- [ ] **Step 5: Commit, push, and deploy**

```bash
git add cloudflare-worker/src/index.mjs cloudflare-worker/test/index.test.mjs
git commit -m "Collect contact details in booking demo"
git push origin main
npx wrangler deploy --name demo0-bot-hideki
```

- [ ] **Step 6: Manual Telegram acceptance test**

Run the complete sequence: `/start` → `Записаться` → service → specialist → date → time → name → phone → confirm. Confirm the owner notification includes name and phone; test cancel once; then press `Новая запись` from the success screen.

## Self-review

- Spec coverage: Task 1 covers stateless prompt state and the requested welcome/contact button. Task 2 covers data collection, validation, cancellation, confirmation, owner notification, and deployment.
- Placeholder scan: no unfinished requirements or generic implementation steps remain.
- Type consistency: Task 2 uses the exact utility exports defined by Task 1.
