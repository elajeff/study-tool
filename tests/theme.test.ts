import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { themeScript } from "../src/lib/theme.ts";

function initialize(saved: string | null, dark: boolean, blocked = false) {
  const root = { dataset: { theme: "" } };
  const callbacks = new Map<string, (...args: unknown[]) => void>();
  const media = { matches: dark, addEventListener: (name: string, callback: (...args: unknown[]) => void) => callbacks.set(name, callback) };
  const storage = { saved, getItem() {
    if (blocked) throw new Error("Storage unavailable");
    return this.saved;
  } };
  runInNewContext(themeScript, {
    document: { documentElement: root }, matchMedia: () => media, localStorage: storage,
    window: { addEventListener: (name: string, callback: (...args: unknown[]) => void) => callbacks.set(name, callback) },
  });
  return { root, media, storage, callbacks };
}

test("initial theme uses a valid saved choice or the device preference before rendering", () => {
  for (const [saved, dark, expected] of [
    [null, false, "light"], [null, true, "dark"],
    ["light", true, "light"], ["dark", false, "dark"], ["invalid", true, "dark"],
  ] as const) assert.equal(initialize(saved, dark).root.dataset.theme, expected);
  assert.equal(initialize(null, true, true).root.dataset.theme, "dark");
});

test("device changes follow the system until a manual override, including cross-tab resets", () => {
  const { root, media, storage, callbacks } = initialize(null, false);
  media.matches = true;
  callbacks.get("change")!();
  assert.equal(root.dataset.theme, "dark");
  storage.saved = "dark";
  media.matches = false;
  callbacks.get("change")!();
  assert.equal(root.dataset.theme, "dark");
  storage.saved = "light";
  callbacks.get("storage")!({ key: "study-tool-theme" });
  assert.equal(root.dataset.theme, "light");
  storage.saved = null;
  media.matches = true;
  callbacks.get("storage")!({ key: null });
  assert.equal(root.dataset.theme, "dark");
});
