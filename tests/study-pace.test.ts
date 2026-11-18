import test from "node:test";
import assert from "node:assert/strict";
import { parseStudyPace } from "../src/lib/study-pace.ts";

test("study pace retains daily hours, days and lesson duration without rounding the weekly budget", () => {
  assert.deepEqual(parseStudyPace("90.5.45"), { hoursPerDay: 1.5, daysPerWeek: 5, minutesPerLesson: 45 });
});
test("missing, malformed and out-of-range saved schedules are ignored", () => {
  for (const raw of [undefined, "", "NaN.5.30", "0.5.30", "60.0.30", "60.8.30", "60.5.0", "60.5.300", "60.5.30.extra"])
    assert.equal(parseStudyPace(raw), null);
});
