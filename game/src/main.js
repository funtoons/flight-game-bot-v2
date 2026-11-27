// Langit Biru v2 — game loop and state machine. Menu, flying, landed and
// crashed; Enter/click starts, P pauses, R restarts, M mutes, C swaps the
// chase and cockpit cameras, Space drops the cargo in the drop phase.
// With ?shot=<name>&seed=<n> in the URL the game instead stages one
// deterministic frame (see shots.js) and stops, for screenshots.
import { CONFIG } from './config.js';
import { makeClouds, makeTrees, makeTown, makeSparkles } from './world.js';
import { newFlight, resetFlight, stepFlight, releaseCrate } from './physics.js';
import { newInput, attachInput, readStick, consumePress } from './input.js';
import {
  newAudio, unlockAudio, updateAudio, ringChime, dropThump, crashSound,
  landingFanfare, toggleMute,
} from './audio.js';
import { createRenderer, renderScene } from './render.js';
import { shotPreset } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = createRenderer(canvas);
const flight = newFlight();
const input = newInput();
const audio = newAudio();
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || '1') || 1;
const world = {
  clouds: makeClouds(seed),
  trees: makeTrees(seed),
  town: makeTown(seed),
  sparkles: makeSparkles(seed),
};

let paused = false;
let camera = 'chase'; // chase | cockpit
let lastRings = 0;
let lastState = flight.state;
let lastDrop = false;
let time = 0;

function announce(text) {
  statusEl.textContent = text;
}

function startFlying() {
  unlockAudio(audio);
  if (flight.state === 'menu' || flight.state === 'landed' || flight.state === 'crashed') {
    resetFlight(flight);
    paused = false;
    announce('Flying. Thread the golden rings, drop the cargo, then land on runway 09.');
  }
}

attachInput(input, canvas, {
  onEnter: startFlying,
  onPause: () => {
    if (flight.state === 'flying') paused = !paused;
  },
  onRestart: () => {
    if (flight.state !== 'menu') {
      resetFlight(flight);
      paused = false;
    }
  },
  onMute: () => {
    const muted = toggleMute(audio);
    announce(muted ? 'Sound off.' : 'Sound on.');
  },
  onCamera: () => {
    camera = camera === 'chase' ? 'cockpit' : 'chase';
    announce(camera === 'cockpit' ? 'Cockpit view.' : 'Chase view.');
  },
  onDrop: () => {
    if (releaseCrate(flight)) {
      dropThump(audio);
      announce('Cargo away!');
    }
  },
  onPointerDown: () => {
    unlockAudio(audio);
    if (flight.state === 'menu') startFlying();
  },
});

function onStateChange() {
  if (flight.state !== lastState) {
    if (flight.state === 'crashed') {
      crashSound(audio);
      announce(`Crashed: ${flight.endReason}. Score ${flight.score}. Press R to fly again.`);
    } else if (flight.state === 'landed') {
      landingFanfare(audio);
      announce(`Landed! ${flight.endReason}. Score ${flight.score}. Press R to fly again.`);
    }
    lastState = flight.state;
  }
  if (flight.ringsTaken > lastRings) {
    ringChime(audio);
    lastRings = flight.ringsTaken;
  }
  if (flight.drop && !lastDrop) {
    dropThump(audio);
    lastDrop = true;
  }
  if (!flight.drop) lastDrop = false;
}

// Fixed-step simulation: 1/60 s per step, at most 5 steps a frame.
const DT = 1 / 60;
let acc = 0;
let last = performance.now();

function frame(now) {
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += elapsed;
  let steps = 0;
  while (acc >= DT && steps < 5) {
    if (flight.state === 'flying' && !paused) {
      const stick = readStick(input);
      stepFlight(flight, stick, DT);
      time += DT;
    } else if (flight.state === 'menu') {
      // Slow cinematic sweep across the start line behind the menu.
      flight.heading += DT * 0.02;
      time += DT;
    }
    acc -= DT;
    steps += 1;
  }
  if (consumePress(input, 'Enter')) startFlying();
  updateAudio(audio, flight);
  onStateChange();
  const view = flight.state === 'menu'
    ? { ...flight, pitch: 0.06, bank: 0 }
    : flight;
  renderScene(renderer, flight, world, time, { view, paused, showPlane: true, camera });
  requestAnimationFrame(frame);
}

// ---- deterministic screenshot mode ---------------------------------------
// ?shot=cover    low over the sea towards the island and the runway
// ?shot=cockpit  through the windshield, instruments lit, ring ahead
// ?shot=drop     the crate under its parachute over the yellow field
// ?shot=landing  on final approach to runway 09
const shot = params.get('shot');
if (shot) {
  window.addEventListener('error', (e) => {
    document.title = `SHOT ERROR: ${e.message}`;
  });
  try {
    const preset = shotPreset(shot, flight);
    for (let i = 0; i < preset.steps; i++) {
      const stick = preset.steer ? preset.steer(flight) : { pitch: 0, bank: 0, throttle: flight.throttle };
      stepFlight(flight, stick, DT);
      time += DT;
    }
    if (preset.finish) preset.finish(flight);
    lastRings = flight.ringsTaken;
    renderScene(renderer, flight, world, time, { showPlane: true, camera: preset.camera || 'chase' });
    document.title = `SHOT READY ${shot}`;
    window.__shotDone = true;
  } catch (err) {
    document.title = `SHOT ERROR: ${err.message}`;
    window.__shotDone = false;
  }
} else {
  requestAnimationFrame(frame);
}
