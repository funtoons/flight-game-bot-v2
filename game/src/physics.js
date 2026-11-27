// Langit Biru v2 — the flight model and the three-job sortie. An arcade
// model with real trade-offs: throttle sets speed, bank turns the plane,
// pitch trades speed for height, slow flight sinks, and fuel always runs
// down. The sortie runs three phases in order — rings, cargo drop, timed
// landing — and each phase scores differently, so the pilot must fly each
// job the way that job wants to be flown.
import { CONFIG, START, DROP_ZONE } from './config.js';
import { groundHeight, onRunway, freshRings } from './world.js';

const DEG = Math.PI / 180;

export function newFlight() {
  return {
    state: 'menu', // menu | flying | landed | crashed
    phase: 'rings', // rings | drop | land
    x: START.x, z: START.z, y: START.y,
    heading: START.headingDeg * DEG,
    pitch: 0, bank: 0,
    speed: START.speed,
    throttle: START.throttle,
    fuel: 100, damage: 0,
    vs: 0, // vertical speed, m/s
    score: 0, ringsTaken: 0, time: 0,
    rings: freshRings(),
    drop: null, // { x, y, z, vy, landed, points } once a crate is released
    dropDone: false, dropPoints: 0,
    landTimer: CONFIG.landTimeLimit, landTimerOn: false,
    hardLanding: false,
    message: '', messageUntil: 0,
    endReason: '',
    // Smoothed control inputs, -1..1.
    pitchIn: 0, bankIn: 0,
  };
}

export function resetFlight(f) {
  const fresh = newFlight();
  Object.assign(f, fresh, { state: 'flying' });
}

// Release the cargo crate. Only in the drop phase, only once, and only
// while airborne — a crate dropped on the ground is a crate wasted.
export function releaseCrate(f) {
  if (f.state !== 'flying' || f.phase !== 'drop') return false;
  if (f.drop) return false;
  f.drop = { x: f.x, y: f.y - 3, z: f.z, vy: 0, vx: Math.sin(f.heading) * f.speed, vz: Math.cos(f.heading) * f.speed, landed: false, points: 0 };
  f.message = 'CRATE AWAY!';
  f.messageUntil = f.time + 1.6;
  return true;
}

// One fixed step (dt seconds). input: { pitch, bank, throttle, brake } with
// pitch/bank in -1..1 and throttle 0..1 (or null to hold the current value).
export function stepFlight(f, input, dt) {
  if (f.state !== 'flying') return;
  f.time += dt;
  if (f.landTimerOn) f.landTimer = Math.max(0, f.landTimer - dt);

  // Throttle: fuel feeds the engine; an empty tank means a glide.
  if (f.fuel <= 0) {
    f.throttle = 0;
  } else if (input.throttle !== null && input.throttle !== undefined) {
    f.throttle = input.throttle;
  }
  f.fuel = Math.max(0, f.fuel - dt * CONFIG.fuelDrain * (0.3 + 0.7 * f.throttle));

  // Speed chases the throttle target.
  const target = CONFIG.minSpeed + f.throttle * (CONFIG.maxSpeed - CONFIG.minSpeed);
  const rate = CONFIG.accel * dt;
  f.speed += Math.max(-rate, Math.min(rate, target - f.speed));

  // Controls ease towards the stick, slower when stalled.
  const stalled = f.speed < CONFIG.stallSpeed;
  const authority = stalled ? 0.4 : 1;
  const ease = 1 - Math.exp(-dt * 4 * authority);
  f.pitchIn += (input.pitch - f.pitchIn) * ease;
  f.bankIn += (input.bank - f.bankIn) * ease;
  f.pitch = f.pitchIn * CONFIG.maxPitchDeg * DEG;
  f.bank = f.bankIn * CONFIG.maxBankDeg * DEG;

  // Bank turns the plane; pitch sets the climb. Slow flight sinks.
  const turn = (9.81 * Math.tan(f.bank)) / Math.max(f.speed, 20);
  f.heading += turn * dt * 1.25;
  let vs = f.speed * Math.sin(f.pitch);
  if (stalled) vs -= (CONFIG.stallSpeed - f.speed) * 0.35;
  vs = Math.max(-14, Math.min(13, vs));
  f.vs = vs;
  f.y += vs * dt;
  f.x += Math.sin(f.heading) * f.speed * Math.cos(f.pitch) * dt;
  f.z += Math.cos(f.heading) * f.speed * Math.cos(f.pitch) * dt;

  // Phase 1 — rings: fly close to a centre to take it. The last ring
  // opens the drop phase.
  if (f.phase === 'rings') {
    for (const ring of f.rings) {
      if (ring.taken) continue;
      const dx = f.x - ring.x;
      const dy = f.y - ring.y;
      const dz = f.z - ring.z;
      if (dx * dx + dy * dy + dz * dz < CONFIG.ringRadius * CONFIG.ringRadius) {
        ring.taken = true;
        f.ringsTaken += 1;
        f.score += CONFIG.ringScore;
        f.message = `RING ${f.ringsTaken} / ${CONFIG.ringCount}  +${CONFIG.ringScore}`;
        f.messageUntil = f.time + 2.2;
        if (f.ringsTaken === CONFIG.ringCount) {
          f.phase = 'drop';
          f.message = 'RINGS DONE — JOB 2: DROP THE CARGO ON THE YELLOW FIELD';
          f.messageUntil = f.time + 3.5;
        }
      }
    }
  }

  // The falling crate: it keeps the plane's forward speed, then gravity
  // takes over. Where it lands decides the drop score.
  if (f.drop && !f.drop.landed) {
    const c = f.drop;
    c.vy -= 9.81 * dt;
    c.x += c.vx * dt;
    c.z += c.vz * dt;
    c.y += c.vy * dt;
    const gh = groundHeight(c.x, c.z);
    if (c.y <= gh + 1) {
      c.y = gh + 1;
      c.landed = true;
      const dist = Math.hypot(c.x - DROP_ZONE.x, c.z - DROP_ZONE.z);
      if (dist <= DROP_ZONE.innerRadius) c.points = CONFIG.dropScorePerfect;
      else if (dist <= DROP_ZONE.radius) c.points = CONFIG.dropScoreGood;
      else if (dist <= DROP_ZONE.radius * 2) c.points = CONFIG.dropScoreNear;
      else c.points = 0;
      f.dropPoints = c.points;
      f.dropDone = true;
      f.score += c.points;
      f.phase = 'land';
      f.landTimerOn = true;
      f.message = c.points > 0
        ? `CARGO DOWN  +${c.points}  — JOB 3: LAND ON RUNWAY 09 BEFORE THE CLOCK RUNS OUT`
        : 'CARGO MISSED THE FIELD  — JOB 3: LAND ON RUNWAY 09';
      f.messageUntil = f.time + 3.5;
    }
  }

  // Ground and water.
  const gh = groundHeight(f.x, f.z);
  if (f.y <= gh + 1.5) {
    f.y = gh + 1.5;
    const aligned = Math.abs(wrapAngle(f.heading - (90 * DEG))) < 30 * DEG;
    const gentle = f.vs > -5 && f.speed >= 22 && f.speed <= 70;
    const hard = onRunway(f.x, f.z) && aligned && f.vs <= -5 && f.vs > -8 && f.speed <= 75;
    if (onRunway(f.x, f.z) && aligned && gentle) {
      landPlane(f, false);
    } else if (hard) {
      // A hard touchdown on the strip: the plane survives, but the hull
      // takes a beating and the landing pays less.
      f.damage = Math.min(100, f.damage + 30);
      f.hardLanding = true;
      landPlane(f, true);
    } else if (onRunway(f.x, f.z) && f.speed < 24 && f.vs > -3) {
      landPlane(f, false); // rolled out slow on the strip: still a landing
    } else {
      crashPlane(f, gh <= 0.5 ? 'Ditched in the sea' : 'Hit the terrain');
    }
  }
  if (f.y < 2 && gh <= 0.5) {
    crashPlane(f, 'Ditched in the sea');
  }
}

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function landPlane(f, hard) {
  f.state = 'landed';
  const fuelBonus = Math.round(f.fuel * 2);
  const timeBonus = f.landTimerOn ? Math.max(0, Math.round(f.landTimer) * 2) : Math.max(0, Math.round(240 - f.time) * 2);
  const ringBonus = f.ringsTaken * CONFIG.ringScore;
  const penalty = hard ? CONFIG.hardLandingPenalty : 0;
  f.score = ringBonus + f.dropPoints + CONFIG.landingScore + fuelBonus + timeBonus - penalty;
  f.endReason = hard
    ? `Hard landing — hull ${f.damage}% damaged, -${penalty} pts`
    : f.ringsTaken === CONFIG.ringCount && f.dropPoints >= CONFIG.dropScoreGood
      ? 'PERFECT SORTIE — rings, cargo on target, clean landing'
      : `Landed with ${f.ringsTaken}/${CONFIG.ringCount} rings, cargo +${f.dropPoints}`;
}

function crashPlane(f, reason) {
  f.state = 'crashed';
  f.damage = 100;
  f.endReason = reason;
}

// Heading in degrees, 0 = north, 90 = east, compass style.
export function headingDeg(f) {
  return ((f.heading / DEG) % 360 + 360) % 360;
}
