// Langit Biru v2 — the world. Pulau Merpati archipelago terrain with real
// relief: smooth domes plus seeded ridge bumps and valleys, so the ground
// reads as hills and not a flat disc. groundHeight is the single source of
// truth for terrain collisions, the renderer and the landing check.
import { CONFIG, RINGS, RUNWAY, DROP_ZONE, mulberry32 } from './config.js';

// Islands: centre, radii, peak height. Merpati holds the runway and the
// drop field; the others are landmarks the pilot steers by (Kakatua's twin
// peaks, Elang's cone, the volcano of Batu Apung).
export const ISLANDS = [
  { name: 'Pulau Merpati', cx: 0, cz: 0, rx: 950, rz: 800, peak: 165, hue: 96 },
  { name: 'Pulau Kakatua', cx: -1350, cz: -750, rx: 520, rz: 430, peak: 125, hue: 105 },
  { name: 'Pulau Elang', cx: 1350, cz: -850, rx: 480, rz: 420, peak: 150, hue: 88 },
  { name: 'Nusa Kecil', cx: -900, cz: 1100, rx: 320, rz: 280, peak: 62, hue: 110 },
  { name: 'Karang Biru', cx: 1100, cz: 1050, rx: 260, rz: 240, peak: 48, hue: 100 },
  { name: 'Batu Apung', cx: 150, cz: -1650, rx: 200, rz: 170, peak: 42, hue: 112 },
];

// Ridges: hand-placed bumps that sit on the islands and give the terrain
// its hills and valleys. Each ridge has a centre, a radius and a height;
// the renderer shades them by the sun direction.
export const RIDGES = [
  { x: -450, z: -350, r: 300, h: 55 },
  { x: 350, z: -450, r: 260, h: 48 },
  { x: -150, z: 250, r: 220, h: 38 },
  { x: -1350, z: -950, r: 200, h: 45 },
  { x: -1250, z: -550, r: 180, h: 40 },
  { x: 1350, z: -1000, r: 190, h: 52 },
  { x: 1400, z: -650, r: 170, h: 38 },
  { x: 150, z: -1650, r: 120, h: 30 },
];

function smoothstep(a, b, t) {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

// Height of the land at (x, z); 0 is open sea. Islands rise as smooth domes
// with ridge bumps on top, and the ground around the runway and the drop
// field is graded flat so both jobs are fair.
export function groundHeight(x, z) {
  let h = 0;
  for (const isle of ISLANDS) {
    const dx = (x - isle.cx) / isle.rx;
    const dz = (z - isle.cz) / isle.rz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 1) {
      const dome = Math.pow(Math.cos((d * Math.PI) / 2), 1.4);
      h = Math.max(h, isle.peak * dome);
    }
  }
  for (const ridge of RIDGES) {
    const dx = (x - ridge.x) / ridge.r;
    const dz = (z - ridge.z) / ridge.r;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 1) h += ridge.h * Math.pow(Math.cos((d * Math.PI) / 2), 2);
  }
  // Grade the runway apron flat: full flat within 180 m of the strip centre,
  // blending back to the natural dome by 420 m out.
  const rdx = x - RUNWAY.cx;
  const rdz = z - RUNWAY.cz;
  const rd = Math.sqrt(rdx * rdx + rdz * rdz);
  if (rd < 420) {
    const flat = 1 - smoothstep(180, 420, rd);
    h = h * (1 - flat) + RUNWAY.height * flat;
  }
  // Grade the drop field flat as well, so the crate lands on level grass.
  const ddx = x - DROP_ZONE.x;
  const ddz = z - DROP_ZONE.z;
  const dd = Math.sqrt(ddx * ddx + ddz * ddz);
  if (dd < 160) {
    const flat = 1 - smoothstep(70, 160, dd);
    h = h * (1 - flat) + RUNWAY.height * flat;
  }
  return h;
}

// True when (x, z) is on the paved strip itself.
export function onRunway(x, z) {
  const halfL = RUNWAY.length / 2;
  const halfW = RUNWAY.width / 2;
  return (
    Math.abs(x - RUNWAY.cx) <= halfL &&
    Math.abs(z - RUNWAY.cz) <= halfW
  );
}

// Ring course, in order, with a taken flag the flight state owns.
export function freshRings() {
  return RINGS.map((r) => ({ ...r, taken: false }));
}

// Clouds: fixed, seeded positions so every run paints the same sky.
export function makeClouds(seed) {
  const rand = mulberry32(seed);
  const clouds = [];
  for (let i = 0; i < 18; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 900 + rand() * 2600;
    clouds.push({
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      y: 260 + rand() * 160,
      r: 90 + rand() * 130,
      puffs: 4 + Math.floor(rand() * 3),
    });
  }
  return clouds;
}

// Trees on the islands, seeded, for the renderer to dot the hills. Each
// tree carries a size and a shade so the canopy reads as lit or shadowed.
export function makeTrees(seed) {
  const rand = mulberry32(seed + 77);
  const trees = [];
  for (const isle of ISLANDS) {
    const count = Math.floor(isle.rx / 55);
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const d = 0.3 + rand() * 0.6;
      const x = isle.cx + Math.cos(angle) * isle.rx * d;
      const z = isle.cz + Math.sin(angle) * isle.rz * d;
      if (onRunway(x, z)) continue;
      const dx = x - DROP_ZONE.x;
      const dz = z - DROP_ZONE.z;
      if (Math.sqrt(dx * dx + dz * dz) < DROP_ZONE.radius + 20) continue;
      trees.push({ x, z, s: 0.7 + rand() * 0.8, shade: rand() });
    }
  }
  return trees;
}

// The little airfield town beside the runway: a row of hangars and houses
// with roof colours, seeded so the layout never moves.
export function makeTown(seed) {
  const rand = mulberry32(seed + 31);
  const town = [];
  const baseX = RUNWAY.cx - 120;
  const baseZ = RUNWAY.cz + 120;
  for (let i = 0; i < 14; i++) {
    town.push({
      x: baseX + (i % 7) * 46 + rand() * 12,
      z: baseZ + Math.floor(i / 7) * 52 + rand() * 10,
      w: 26 + rand() * 14,
      d: 20 + rand() * 10,
      h: 10 + rand() * 10,
      roof: ['#c0392b', '#d97b29', '#2e6da4', '#7a5c3e'][Math.floor(rand() * 4)],
    });
  }
  return town;
}

// Sun glitter on the sea: seeded sparkle points the renderer draws as
// short bright dashes where the sun path crosses the water.
export function makeSparkles(seed) {
  const rand = mulberry32(seed + 55);
  const sparkles = [];
  for (let i = 0; i < 90; i++) {
    sparkles.push({
      x: -2400 + rand() * 4800,
      z: -2400 + rand() * 4800,
      s: 0.5 + rand() * 1.5,
    });
  }
  return sparkles;
}

export { CONFIG };
