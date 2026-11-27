// Langit Biru v2 — deterministic screenshot staging. A tiny autopilot
// flies the plane towards a target point, and each shot preset places the
// plane, runs the autopilot for a fixed number of 1/60 s steps and leaves
// one frozen frame for the screenshot. Same seed, same frame.
import { CONFIG, RINGS, RUNWAY, DROP_ZONE } from './config.js';
import { resetFlight, releaseCrate } from './physics.js';

const DEG = Math.PI / 180;

function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Steer towards (tx, tz) at altitude ty: bank by heading error, pitch by
// height error, and slow down for a tight turn or a close target, so the
// plane can actually thread a ring instead of circling past it.
// Returns { pitch, bank, throttle } in -1..1 / 0..1.
export function autopilotLocal(flight, tx, ty, tz, throttle) {
  const targetHeading = Math.atan2(tx - flight.x, tz - flight.z);
  const headingErr = wrapAngle(targetHeading - flight.heading);
  const bank = Math.max(-1, Math.min(1, headingErr * 2.0));
  const altErr = ty - flight.y;
  const pitch = Math.max(-1, Math.min(1, altErr * 0.03 + 0.05));
  const dist = Math.hypot(tx - flight.x, tz - flight.z);
  let thr = throttle;
  if (Math.abs(headingErr) > 1.0) thr = Math.min(thr, 0.4);
  if (dist < 350) thr = Math.min(thr, 0.55);
  return { pitch, bank, throttle: thr };
}

function flyToRing(flight, index) {
  const ring = RINGS[index];
  return autopilotLocal(flight, ring.x, ring.y, ring.z, 0.78);
}

// Final approach: chase a carrot 320 m ahead on the extended centreline,
// so the path converges onto the strip instead of crossing it diagonally;
// on a gentle slope that ends at touchdown height. If the plane overshoots
// the far end, the carrot jumps back west for a go-around.
export function approachRunway(flight) {
  const thresholdX = RUNWAY.cx - RUNWAY.length / 2;
  const farX = RUNWAY.cx + RUNWAY.length / 2;
  const distThr = Math.hypot(thresholdX - flight.x, RUNWAY.cz - flight.z);
  const overshot = flight.x > farX + 80;
  const aimX = overshot ? thresholdX - 200 : flight.x + 240;
  // Glide slope keyed on signed distance west of the threshold: it falls
  // towards touchdown height and stays there past the numbers, instead of
  // rising again once the threshold is behind the plane.
  const distWest = thresholdX - flight.x;
  let targetAlt = RUNWAY.height + (distWest > 0
    ? Math.max(2, Math.min(120, distWest * 0.055))
    : 2);
  // Stay high until lined up with the centreline: descending while still
  // offset puts the plane into the apron beside the strip.
  if (Math.abs(flight.z - RUNWAY.cz) > 25) {
    targetAlt = Math.max(targetAlt, 58);
  }
  const stick = autopilotLocal(flight, aimX, targetAlt, RUNWAY.cz, 0.35);
  stick.pitch = Math.max(-0.2, Math.min(0.2, stick.pitch));
  if (distThr < 500) stick.throttle = 0.22;
  // Flare: once past the numbers, lined up and low, push the nose down
  // gently — the slope target alone leaves the plane floating 2 m up.
  const pastThreshold = flight.x > thresholdX;
  const linedUp = Math.abs(flight.z - RUNWAY.cz) < 25;
  if (pastThreshold && linedUp && flight.y < 50) {
    stick.pitch = -0.18;
    stick.throttle = 0.2;
  }
  return stick;
}

// Shot presets. Each returns { steps, steer, camera } where steer(flight)
// gives the stick for a step. The caller runs `steps` fixed steps, then
// renders once.
export function shotPreset(name, flight) {
  if (name === 'cover') {
    // COVER: low over the sea along the southern shore, the runway dead
    // ahead and the island mountain behind it — gameplay, not a menu.
    resetFlight(flight);
    flight.x = -550; flight.z = 650; flight.y = 78;
    flight.heading = RUNWAY.headingDeg * DEG;
    flight.speed = 58; flight.throttle = 0.75; flight.fuel = 92;
    return {
      steps: 130,
      camera: 'chase',
      steer: (f) => autopilotLocal(f, RUNWAY.cx + 100, 70, RUNWAY.cz, 0.75),
    };
  }
  if (name === 'cockpit') {
    // COCKPIT: through the windshield, instruments lit, a golden ring
    // ahead over the hills.
    resetFlight(flight);
    flight.x = 150; flight.z = -750; flight.y = 160;
    flight.heading = Math.atan2(500 - flight.x, -1100 - flight.z);
    flight.speed = 60; flight.throttle = 0.78; flight.fuel = 85;
    flight.score = 2 * CONFIG.ringScore;
    flight.ringsTaken = 2;
    flight.rings[0].taken = true;
    flight.rings[1].taken = true;
    return {
      steps: 120,
      camera: 'cockpit',
      steer: (f) => flyToRing(f, 2),
    };
  }
  if (name === 'drop') {
    // CARGO DROP: the crate is away under its parachute over the yellow
    // field, the plane low and slow just past the drop, town and runway
    // behind it. The autopilot releases the crate once it is over the field.
    resetFlight(flight);
    flight.phase = 'drop';
    for (const r of flight.rings) r.taken = true;
    flight.ringsTaken = CONFIG.ringCount;
    flight.score = CONFIG.ringCount * CONFIG.ringScore;
    flight.x = -560; flight.z = 800; flight.y = 72;
    flight.heading = Math.atan2(DROP_ZONE.x - flight.x, DROP_ZONE.z - flight.z);
    flight.speed = 46; flight.throttle = 0.42; flight.fuel = 64;
    return {
      steps: 150,
      camera: 'chase',
      steer: (f) => {
        const dist = Math.hypot(DROP_ZONE.x - f.x, DROP_ZONE.z - f.z);
        if (!f.drop && dist < 60) releaseCrate(f);
        return autopilotLocal(f, DROP_ZONE.x, 62, DROP_ZONE.z, 0.42);
      },
      // Freeze the money moment: the crate under its parachute, just
      // ahead and below the nose over the yellow field, whatever the
      // autopilot's timing did with the real release.
      finish: (f) => {
        const fx = Math.sin(f.heading);
        const fz = Math.cos(f.heading);
        const rx = Math.cos(f.heading);
        const rz = -Math.sin(f.heading);
        f.drop = {
          x: f.x + fx * 110 + rx * 48, y: f.y - 24, z: f.z + fz * 110 + rz * 48,
          vy: -3, vx: 0, vz: 0, landed: false, points: 0,
        };
      },
    };
  }
  if (name === 'landing') {
    // FINAL APPROACH: just past ring 8 and nearly on the slope, the strip
    // big ahead with sky and sea around it and the plane level, not diving.
    resetFlight(flight);
    flight.phase = 'land';
    flight.landTimerOn = true;
    flight.landTimer = 96;
    flight.dropDone = true;
    flight.dropPoints = CONFIG.dropScoreGood;
    flight.score = CONFIG.ringCount * CONFIG.ringScore + CONFIG.dropScoreGood;
    flight.ringsTaken = CONFIG.ringCount;
    for (const r of flight.rings) r.taken = true;
    flight.x = -350; flight.z = 650; flight.y = 70;
    flight.heading = RUNWAY.headingDeg * DEG;
    flight.speed = 48; flight.throttle = 0.42; flight.fuel = 41;
    return {
      steps: 60,
      camera: 'chase',
      steer: (f) => autopilotLocal(f, RUNWAY.cx, RUNWAY.height + 18, RUNWAY.cz, 0.42),
    };
  }
  return { steps: 0, steer: null, camera: 'chase' };
}
