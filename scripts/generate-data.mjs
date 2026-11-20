// Seeded, deterministic generator for the peak-hour traffic trace (planted story 2).
// Writes data/peak-hour-trace.json: active advisor sessions per minute across one synthetic
// trading day, 07:00-19:00. Load lab replays its shape in both Sample and Live mode.
//
//   npm run generate-data     (re-running gives byte-identical output)
//
// The account, position, activity and performance tables are generated inside Snowflake by
// sql/setup.sql, also deterministically (fixed HASH salts). See data/README.md.
import { writeFileSync } from "node:fs";

const SEED = 20261030;

// mulberry32: small, fast, seedable PRNG.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const bump = (m, centre, width, height) => height * Math.exp(-(((m - centre) / width) ** 2));

const START = 7 * 60; // 07:00
const minutes = [];
for (let m = START; m < 19 * 60; m++) {
  // Baseline workday curve, a lunch dip, and two planted peaks:
  //  - market open 09:30-10:00 (the burst the load lab replays), and
  //  - a smaller close-of-day bump around 16:00.
  let s = 180
    + bump(m, 11 * 60, 150, 140)
    + bump(m, 14 * 60 + 30, 120, 120)
    - bump(m, 12 * 60 + 30, 35, 60)
    + bump(m, 16 * 60 + 5, 18, 220);
  if (m >= 9 * 60 + 30 && m < 10 * 60) s += 520 + 80 * Math.sin(((m - 570) / 30) * Math.PI);
  if (m < 8 * 60) s *= 0.35 + (0.65 * (m - START)) / 60; // ramp up before 08:00
  if (m >= 18 * 60) s *= 1 - (0.7 * (m - 18 * 60)) / 60; // ramp down after 18:00
  s *= 1 + 0.06 * gauss();
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  minutes.push({ t: `${hh}:${mm}`, sessions: Math.max(0, Math.round(s)) });
}

const peak = minutes.reduce((a, b) => (b.sessions > a.sessions ? b : a));
const median = [...minutes].map((x) => x.sessions).sort((a, b) => a - b)[Math.floor(minutes.length / 2)];
const out = {
  seed: SEED,
  description: "Synthetic active advisor sessions per minute, one trading day. Planted burst 09:30-10:00.",
  burst: { start: "09:30", end: "10:00" },
  peak: { t: peak.t, sessions: peak.sessions },
  median,
  minutes,
};
writeFileSync("data/peak-hour-trace.json", JSON.stringify(out, null, 1) + "\n");
console.log(`data/peak-hour-trace.json: ${minutes.length} minutes, peak ${peak.sessions} at ${peak.t}, median ${median}`);
