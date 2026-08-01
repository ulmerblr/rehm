// Verifies every foreground token in globals.css against the ground it is read
// on. Reads the real CSS rather than a copy, so it cannot drift out of date.
//
// Run with: npx tsx scripts/check-contrast.ts
//
// Two floors, because there are two surfaces:
//
//   --ink, the page itself, is where nearly all text lives. Floor 5:1 — a
//   margin over AA's 4.5, since the smallest type role here is 11px, and
//   because a margin is what lets the ground move again later.
//
//   --ink-raised carries only inputs, .panel and the selected .choice. It sits
//   one step up from the ground, so everything on it reads about 1.2× tighter.
//   Floor 4.5:1 — AA flat. This has always been the tighter surface; only the
//   three tokens that actually render on it are checked.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

function token(name: string): number[] {
  const m = css.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`--${name} not found in app/globals.css`);
  const h = m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const hex = (c: number[]) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

const GROUND_FLOOR = 5;
const RAISED_FLOOR = 4.5;

// What each ratio was against the ground before it was lifted, so a regression
// shows as a regression rather than as a number that merely clears the floor.
// --said is the one that cannot be restored in full: cream has nowhere to go.
const BEFORE: Record<string, number> = {
  said: 11.89,
  "said-dim": 5.53,
  machine: 5.83,
  "machine-dim": 4.9,
  brass: 5.97,
  flag: 5.2,
};

// Only these three ever render on a raised surface: --said in inputs,
// --machine in .choice-note and .panel copy, --brass in .choice-on .choice-title.
const ON_RAISED = new Set(["said", "machine", "brass"]);

let failed = 0;
let worst = Infinity;

console.log("token           colour     on --ink   was      on --ink-raised");
for (const name of Object.keys(BEFORE)) {
  const c = token(name);
  const onInk = ratio(c, token("ink"));
  worst = Math.min(worst, onInk);
  let note = "";
  if (onInk < GROUND_FLOOR) {
    failed++;
    note = "  BELOW GROUND FLOOR";
  }
  let raised = "        —";
  if (ON_RAISED.has(name)) {
    const r = ratio(c, token("ink-raised"));
    raised = r.toFixed(2).padStart(9);
    if (r < RAISED_FLOOR) {
      failed++;
      note += "  BELOW RAISED FLOOR";
    }
  }
  console.log(
    `--${name}`.padEnd(16),
    hex(c).padEnd(10),
    onInk.toFixed(2).padStart(6),
    (BEFORE[name] ?? 0).toFixed(2).padStart(8),
    raised,
    note
  );
}

// --rule draws hairlines between rows. Not text, but it has to register as an
// edge on a phone in daylight, which is where 1.4 comes from.
const EDGE_FLOOR = 1.4;
const ruleRatio = ratio(token("rule"), token("ink"));
if (ruleRatio < EDGE_FLOOR) failed++;
console.log(
  "--rule".padEnd(16),
  hex(token("rule")).padEnd(10),
  ruleRatio.toFixed(2).padStart(6),
  ruleRatio < EDGE_FLOOR ? "   edge too faint" : "   (edge, floor 1.40)"
);

console.log(
  failed === 0
    ? `\nall clear — worst on the ground is ${worst.toFixed(2)}, floor ${GROUND_FLOOR}`
    : `\n${failed} check(s) failed`
);
process.exit(failed === 0 ? 0 : 1);
