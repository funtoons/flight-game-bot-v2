// Langit Biru v2 — sound. Everything is synthesised live with WebAudio:
// an engine drone that follows the throttle, wind that follows speed, a
// chime for each ring, a soft thump for a cargo drop, a thud for a crash
// and a fanfare for a landing. No audio files, no network, nothing to load.
export function newAudio() {
  return {
    ctx: null, engineOsc: null, engineOsc2: null, engineGain: null,
    windSrc: null, windGain: null, windFilter: null,
    muted: false, started: false,
  };
}

function ensureContext(a) {
  if (a.ctx) return true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    a.ctx = new Ctx();
    // Engine: two detuned saws through a low-pass, gain follows throttle.
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 58;
    a.engineOsc2 = a.ctx.createOscillator();
    a.engineOsc2.type = 'square';
    a.engineOsc2.frequency.value = 87;
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0;
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    a.engineOsc.connect(lp);
    a.engineOsc2.connect(lp);
    lp.connect(a.engineGain);
    a.engineGain.connect(a.ctx.destination);
    a.engineOsc.start();
    a.engineOsc2.start();
    // Wind: a looped noise buffer through a band-pass.
    const len = a.ctx.sampleRate * 2;
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    a.windSrc = a.ctx.createBufferSource();
    a.windSrc.buffer = buf;
    a.windSrc.loop = true;
    a.windFilter = a.ctx.createBiquadFilter();
    a.windFilter.type = 'bandpass';
    a.windFilter.frequency.value = 700;
    a.windFilter.Q.value = 0.6;
    a.windGain = a.ctx.createGain();
    a.windGain.gain.value = 0;
    a.windSrc.connect(a.windFilter);
    a.windFilter.connect(a.windGain);
    a.windGain.connect(a.ctx.destination);
    a.windSrc.start();
    a.started = true;
    return true;
  } catch {
    return false;
  }
}

// Call on the first user gesture; browsers need one before sound may play.
export function unlockAudio(a) {
  if (ensureContext(a) && a.ctx.state === 'suspended') a.ctx.resume();
}

// Continuous engine + wind, called every frame while flying.
export function updateAudio(a, flight) {
  if (!a.started || a.muted || !a.ctx) return;
  const t = a.ctx.currentTime;
  const on = flight.state === 'flying';
  const thr = on ? flight.throttle : 0;
  const spd = flight.speed / 95;
  a.engineGain.gain.setTargetAtTime(on ? 0.05 + thr * 0.06 : 0, t, 0.1);
  a.engineOsc.frequency.setTargetAtTime(52 + thr * 46 + spd * 12, t, 0.1);
  a.engineOsc2.frequency.setTargetAtTime(78 + thr * 66 + spd * 18, t, 0.1);
  a.windGain.gain.setTargetAtTime(on ? spd * spd * 0.09 : 0, t, 0.15);
  a.windFilter.frequency.setTargetAtTime(500 + spd * 900, t, 0.15);
}

function blip(a, freq, start, dur, vol, type = 'sine') {
  if (!a.started || a.muted || !a.ctx) return;
  const t = a.ctx.currentTime + start;
  const osc = a.ctx.createOscillator();
  const gain = a.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(a.ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function ringChime(a) {
  blip(a, 880, 0, 0.35, 0.16);
  blip(a, 1318, 0.08, 0.4, 0.14);
  blip(a, 1760, 0.16, 0.5, 0.1);
}

export function dropThump(a) {
  blip(a, 220, 0, 0.25, 0.2, 'triangle');
  blip(a, 330, 0.1, 0.3, 0.14);
}

export function crashSound(a) {
  if (!a.started || a.muted || !a.ctx) return;
  const t = a.ctx.currentTime;
  const len = a.ctx.sampleRate * 0.5;
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const gain = a.ctx.createGain();
  gain.gain.value = 0.5;
  const lp = a.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  src.connect(lp);
  lp.connect(gain);
  gain.connect(a.ctx.destination);
  src.start(t);
  blip(a, 55, 0, 0.6, 0.35, 'sine');
}

export function landingFanfare(a) {
  [523, 659, 784, 1046].forEach((f, i) => blip(a, f, i * 0.12, 0.5, 0.15));
}

export function toggleMute(a) {
  a.muted = !a.muted;
  if (a.ctx && a.engineGain) {
    a.engineGain.gain.value = 0;
    if (a.windGain) a.windGain.gain.value = 0;
  }
  return a.muted;
}
