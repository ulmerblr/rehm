// Verifies the language toggle's flag tint against every band of both flags.
// The flag sits directly behind the code, so a stripe boundary can land
// mid-letter — every band has to clear the floor, not just the average.
//
// Run with: npx tsx scripts/check-lang-contrast.ts
// Keep SHIPPED in step with .lang-flag in app/globals.css.

// Does the code stay readable wherever a stripe boundary lands behind it?
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// CSS filter: saturate(s) — the standard feColorMatrix used by browsers.
function saturate([r, g, b]: number[], s: number): number[] {
  return [
    (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b,
    (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b,
    (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b,
  ].map((v) => Math.min(255, Math.max(0, v)));
}
const over = (fg: number[], bg: number[], a: number) => fg.map((c, i) => c * a + bg[i] * (1 - a));

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

const INK = hex("#1d3662");
const BRASS = hex("#deb071");

// Every colour that appears in either flag.
const BANDS: Record<string, string> = {
  "us white/mx white": "#f5f2ea",
  "us red/mx red": "#b32b34",
  "us blue": "#26417a",
  "mx green": "#1c7a4d",
  "mx emblem": "#6b5433",
};

// filter: brightness(b) — applied after saturate, as written in the CSS.
const brightness = (c: number[], b: number) => c.map((v) => Math.min(255, Math.max(0, v * b)));

// Largest opacity at which every band still clears the floor.
function worstAt(alpha: number, sat: number, bright: number, text: number[], base: number[]): number {
  let worst = Infinity;
  for (const h of Object.values(BANDS)) {
    const band = brightness(saturate(hex(h), sat), bright);
    worst = Math.min(worst, ratio(text, over(band, base, alpha)));
  }
  return worst;
}
const FLOOR = 4.5;
const solve = (sat: number, bright: number, text: number[], base: number[]) => {
  let best = 0;
  for (let a = 0.8; a >= 0; a -= 0.005) {
    if (worstAt(a, sat, bright, text, base) >= FLOOR) { best = a; break; }
  }
  return best;
};
console.log("inactive (brass on ink) — darkening lets the flag come up:");
for (const b of [1, 0.7, 0.5, 0.4, 0.3]) {
  console.log(`  saturate(.55) brightness(${b}): max opacity ${solve(0.55, b, BRASS, INK).toFixed(2)}`);
}
console.log("active (ink on brass) — lightening does the same:");
for (const b of [1, 1.2, 1.4, 1.6]) {
  console.log(`  saturate(.55) brightness(${b}): max opacity ${solve(0.55, b, INK, BRASS).toFixed(2)}`);
}
console.log();

// The values actually shipped in globals.css (.lang-flag / .lang-seg-on .lang-flag).
const SHIPPED = {
  inactive: { sat: 0.55, bright: 0.38, alpha: 0.34 },
  active: { sat: 0.55, bright: 1.35, alpha: 0.24 },
};

console.log("state      band                 bg           ratio");
let worstInactive = Infinity;
let worstActive = Infinity;
for (const [name, h] of Object.entries(BANDS)) {
  const i = SHIPPED.inactive;
  const bgOff = over(brightness(saturate(hex(h), i.sat), i.bright), INK, i.alpha);
  const rOff = ratio(BRASS, bgOff);
  worstInactive = Math.min(worstInactive, rOff);
  console.log(`inactive   ${name.padEnd(20)} ${bgOff.map((v) => Math.round(v)).join(",").padEnd(12)} ${rOff.toFixed(2)}`);

  const a = SHIPPED.active;
  const bgOn = over(brightness(saturate(hex(h), a.sat), a.bright), BRASS, a.alpha);
  const rOn = ratio(INK, bgOn);
  worstActive = Math.min(worstActive, rOn);
  console.log(`active     ${name.padEnd(20)} ${bgOn.map((v) => Math.round(v)).join(",").padEnd(12)} ${rOn.toFixed(2)}`);
}

console.log(`\nworst inactive: ${worstInactive.toFixed(2)}`);
console.log(`worst active:   ${worstActive.toFixed(2)}`);
const ok = worstInactive >= FLOOR && worstActive >= FLOOR;
console.log(ok ? `\nboth clear WCAG AA (${FLOOR})` : "\nBELOW AA — lower the flag opacity");
process.exit(ok ? 0 : 1);
