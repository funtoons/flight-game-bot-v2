// Langit Biru v2 — "Three Jobs, One Sortie": tuning, mission layout and the
// seeded random source. Every number that shapes the flight lives here so
// the other files only read constants, never magic numbers of their own.
// The sortie has THREE different jobs in one flight: a precision ring
// course, a low-and-slow cargo drop, then a timed landing on runway 09.

// Seeded random: the same seed always builds the same clouds, trees and
// wave sparkles, so a screenshot run is reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CONFIG = {
  title: 'LANGIT BIRU',
  subtitle: 'Three Jobs, One Sortie',
  planeName: 'Elang Laut',
  // Flight envelope (metres, seconds).
  maxSpeed: 95,          // m/s at full throttle
  minSpeed: 18,          // m/s gliding with throttle closed
  accel: 9,              // m/s per second towards the throttle target
  maxPitchDeg: 24,
  maxBankDeg: 58,
  stallSpeed: 26,
  fuelDrain: 0.34,       // percent per second at full throttle
  // Mission scoring.
  ringScore: 150,
  dropScorePerfect: 300, // crate inside the inner circle
  dropScoreGood: 200,    // crate inside the outer circle
  dropScoreNear: 100,    // crate within 2x the zone radius
  landingScore: 500,
  hardLandingPenalty: 150,
  ringRadius: 26,        // metres; fly within this of a ring centre to take it
  ringCount: 6,
  landTimeLimit: 150,    // seconds to land once the drop is done
  // Camera.
  camBack: 26,           // metres behind the plane (chase view)
  camUp: 7,              // metres above the plane
  focal: 760,            // projection focal length in pixels at 1280 wide
  // Canvas the game draws in (scaled to the window by the browser).
  viewW: 1280,
  viewH: 800,
};

// Golden ring course: a weaving tour of the archipelago that ends near the
// drop field, heading south-east towards the runway.
export const RINGS = [
  { x: -700, z: -1500, y: 130 },
  { x: -200, z: -1200, y: 150 },
  { x: 500, z: -1100, y: 170 },
  { x: 1100, z: -600, y: 160 },
  { x: 900, z: 0, y: 140 },
  { x: 400, z: 350, y: 120 },
];

// The cargo drop field: a marked circle on the flat grass west of the
// runway. Fly low and slow over it and press SPACE to release the crate.
export const DROP_ZONE = {
  x: -420, z: 850, radius: 34, innerRadius: 14,
};

// The strip on Pulau Merpati's flat southern shore. Heading 090 (east),
// threshold at its west end.
export const RUNWAY = {
  cx: 100, cz: 650, length: 520, width: 42, height: 42, headingDeg: 90,
};

// Where a sortie begins: south-west of the first ring, already airborne.
export const START = {
  x: -1100, z: -1750, y: 140,
  headingDeg: 35, speed: 55, throttle: 0.7,
};
