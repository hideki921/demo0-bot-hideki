import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  bookingPrompt,
  callbackData,
  nextWeekdays,
  parseBookingPrompt,
  welcomeKeyboard,
} from "../src/index.mjs";

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

test("health endpoint reports when the bot token is absent", async () => {
  const response = await worker.fetch(new Request("https://example.test/?health"), {});

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { telegram: "not_configured" });
});

test("name prompt round-trips a selected booking", () => {
  const text = bookingPrompt("name", {
    serviceId: "haircut",
    staffId: "alex",
    date: "2026-07-29",
    time: "12:00",
  });

  assert.deepEqual(parseBookingPrompt(text), {
    kind: "name",
    serviceId: "haircut",
    staffId: "alex",
    date: "2026-07-29",
    time: "12:00",
  });
});

test("phone prompt retains the entered name", () => {
  const text = bookingPrompt("phone", {
    serviceId: "haircut",
    staffId: "alex",
    date: "2026-07-29",
    time: "12:00",
  }, "РђРЅРЅР°");

  assert.equal(parseBookingPrompt(text).name, "РђРЅРЅР°");
});

test("welcome keyboard links to the developer", () => {
  const keyboard = welcomeKeyboard();

  assert.equal(keyboard.inline_keyboard[0][0].text, "Р—Р°РїРёСЃР°С‚СЊСЃСЏ");
  assert.equal(keyboard.inline_keyboard[0][0].callback_data, "service|haircut");
  assert.equal(keyboard.inline_keyboard[1][0].text, "РќР°РїРёСЃР°С‚СЊ СЂР°Р·СЂР°Р±РѕС‚С‡РёРєСѓ");
  assert.equal(keyboard.inline_keyboard[1][0].url, "https://t.me/hideki_code");
});
