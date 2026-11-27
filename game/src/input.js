// Langit Biru v2 — keyboard and mouse. Arrow keys / WASD fly the plane,
// W/S or Shift/Ctrl work the throttle, dragging the mouse steers, Space
// drops the cargo in the drop phase, C swaps chase and cockpit cameras,
// Enter starts, P pauses, R restarts. The same object drives the live game
// and the scripted screenshot runs.
import { CONFIG } from './config.js';

export function newInput() {
  return {
    keys: new Set(),
    pitch: 0, // -1 dive .. +1 climb (from keys or mouse drag)
    bank: 0,  // -1 left .. +1 right
    throttle: null, // null = hold; set by W/S steps
    throttleValue: 0.7,
    dragging: false,
    dragX: 0, dragY: 0,
    pressed: new Set(), // keys pressed since last read (edge triggers)
  };
}

const PITCH_KEYS = { ArrowUp: 1, KeyW: 0, ArrowDown: -1, KeyS: 0 };
const BANK_KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };

export function attachInput(input, canvas, hooks) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) {
      input.pressed.add(e.code);
      if (e.code === 'Enter' && hooks.onEnter) hooks.onEnter();
      if (e.code === 'KeyP' && hooks.onPause) hooks.onPause();
      if (e.code === 'KeyR' && hooks.onRestart) hooks.onRestart();
      if (e.code === 'KeyM' && hooks.onMute) hooks.onMute();
      if (e.code === 'KeyC' && hooks.onCamera) hooks.onCamera();
      if (e.code === 'Space' && hooks.onDrop) hooks.onDrop();
    }
    input.keys.add(e.code);
    if (e.code === 'KeyW') input.throttleValue = Math.min(1, input.throttleValue + 0.05);
    if (e.code === 'KeyS') input.throttleValue = Math.max(0, input.throttleValue - 0.05);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.dragging = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    input.dragging = true;
    input.dragX = e.clientX;
    input.dragY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    if (hooks.onPointerDown) hooks.onPointerDown();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!input.dragging) return;
    const dx = (e.clientX - input.dragX) / 160;
    const dy = (e.clientY - input.dragY) / 160;
    input.bank = Math.max(-1, Math.min(1, dx));
    input.pitch = Math.max(-1, Math.min(1, -dy));
  });
  const endDrag = () => {
    input.dragging = false;
    input.bank = 0;
    input.pitch = 0;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

// Read the current stick position from keys and mouse, -1..1 each axis.
export function readStick(input) {
  let pitch = 0;
  let bank = 0;
  for (const [code, v] of Object.entries(PITCH_KEYS)) {
    if (v !== 0 && input.keys.has(code)) pitch += v;
  }
  for (const [code, v] of Object.entries(BANK_KEYS)) {
    if (input.keys.has(code)) bank += v;
  }
  if (input.dragging) {
    pitch = input.pitch;
    bank = input.bank;
  }
  return {
    pitch: Math.max(-1, Math.min(1, pitch)),
    bank: Math.max(-1, Math.min(1, bank)),
    throttle: input.throttleValue,
  };
}

export function consumePress(input, code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

export function clearPresses(input) {
  input.pressed.clear();
}

export { CONFIG };
