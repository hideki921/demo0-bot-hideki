import assert from "node:assert/strict";
import test from "node:test";

import worker, { callbackData, nextWeekdays } from "../src/index.mjs";

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
