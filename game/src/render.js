// Langit Biru v2 — the renderer. A hand-rolled pseudo-3D view on a 2D
// canvas: a sun-lit sky with volumetric clouds, a glittering sea, islands
// with real relief (contour bands, lit and shadowed ridges, valleys, trees
// and a little airfield town), the runway with threshold bars, edge lights
// and a windsock, the golden rings, the cargo drop field, and the Elang
// Laut drawn with shading so it looks built, not flat. No library.
import { CONFIG, RUNWAY, DROP_ZONE } from './config.js';
import { ISLANDS, RIDGES, groundHeight } from './world.js';
import { headingDeg } from './physics.js';
import { drawCockpitPanel } from './cockpit.js';

const W = CONFIG.viewW;
const H = CONFIG.viewH;
const F = CONFIG.focal;
const DEG = Math.PI / 180;

export function createRenderer(canvas) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

// Camera: behind and above the plane, looking ahead along its nose.
// mode 'cockpit' puts the eye at the nose, looking forward.
export function cameraFor(view, mode) {
  if (mode === 'cockpit') {
    const pitch = view.pitch * 0.6 - 0.02;
    const fx = Math.sin(view.heading) * Math.cos(pitch);
    const fz = Math.cos(view.heading) * Math.cos(pitch);
    const fy = Math.sin(pitch);
    const fwd = { x: fx, y: fy, z: fz };
    const right = { x: Math.cos(view.heading), y: 0, z: -Math.sin(view.heading) };
    const upVec = {
      x: fwd.y * right.z - fwd.z * right.y,
      y: fwd.z * right.x - fwd.x * right.z,
      z: fwd.x * right.y - fwd.y * right.x,
    };
    return {
      pos: { x: view.x + Math.sin(view.heading) * 3, y: view.y + 1.2, z: view.z + Math.cos(view.heading) * 3 },
      fwd, right, up: upVec, pitch,
    };
  }
  const pitch = view.pitch * 0.45 - 0.05;
  const fx = Math.sin(view.heading) * Math.cos(pitch);
  const fz = Math.cos(view.heading) * Math.cos(pitch);
  const fy = Math.sin(pitch);
  const back = CONFIG.camBack;
  const up = CONFIG.camUp;
  const cx = view.x - Math.sin(view.heading) * back;
  const cz = view.z - Math.cos(view.heading) * back;
  const cy = view.y + up;
  const fwd = { x: fx, y: fy, z: fz };
  const right = { x: Math.cos(view.heading), y: 0, z: -Math.sin(view.heading) };
  const upVec = {
    x: fwd.y * right.z - fwd.z * right.y,
    y: fwd.z * right.x - fwd.x * right.z,
    z: fwd.x * right.y - fwd.y * right.x,
  };
  return { pos: { x: cx, y: cy, z: cz }, fwd, right, up: upVec, pitch };
}

export function project(cam, p) {
  const dx = p.x - cam.pos.x;
  const dy = p.y - cam.pos.y;
  const dz = p.z - cam.pos.z;
  const zc = dx * cam.fwd.x + dy * cam.fwd.y + dz * cam.fwd.z;
  if (zc < 4) return null;
  const xc = dx * cam.right.x + dy * cam.right.y + dz * cam.right.z;
  const yc = dx * cam.up.x + dy * cam.up.y + dz * cam.up.z;
  return {
    x: W / 2 + (xc * F) / zc,
    y: H * 0.42 - (yc * F) / zc,
    s: F / zc,
    z: zc,
  };
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function fmt(n, digits = 0) {
  return n.toFixed(digits);
}

function pad3(n) {
  return String(Math.round(n)).padStart(3, '0');
}

// A circle lying flat on the ground, drawn as a projected polygon.
function groundCircle(ctx, cam, cx, cz, radius, fill, stroke, lineWidth) {
  ctx.beginPath();
  let first = true;
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const gy = groundHeight(cx + Math.cos(a) * radius, cz + Math.sin(a) * radius);
    const p = project(cam, { x: cx + Math.cos(a) * radius, y: gy + 0.6, z: cz + Math.sin(a) * radius });
    if (!p) { first = true; continue; }
    if (first) { ctx.moveTo(p.x, p.y); first = false; }
    else ctx.lineTo(p.x, p.y);
  }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 2; ctx.stroke(); }
}

// ---- sky, sun and sea ----------------------------------------------------

function drawSkySea(ctx, cam, time) {
  const horizonY = H * 0.42 + Math.tan(cam.pitch) * F;
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(0, horizonY));
  sky.addColorStop(0, '#1565b0');
  sky.addColorStop(0.55, '#5fb2e0');
  sky.addColorStop(0.85, '#a8dcf2');
  sky.addColorStop(1, '#d8f2fb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, Math.max(0, horizonY) + 1);
  const sea = ctx.createLinearGradient(0, horizonY, 0, H);
  sea.addColorStop(0, '#2a8fb8');
  sea.addColorStop(0.2, '#12708f');
  sea.addColorStop(0.6, '#0a4a72');
  sea.addColorStop(1, '#062f4d');
  ctx.fillStyle = sea;
  ctx.fillRect(0, Math.max(0, horizonY), W, H - Math.max(0, horizonY));
  // Sun with a wide warm glow, low in the west.
  const sunDir = { x: -0.55, y: 0.42, z: -0.68 };
  const sun = project(cam, {
    x: cam.pos.x + sunDir.x * 4200,
    y: cam.pos.y + sunDir.y * 4200,
    z: cam.pos.z + sunDir.z * 4200,
  });
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 130);
    glow.addColorStop(0, 'rgba(255,246,205,0.95)');
    glow.addColorStop(0.3, 'rgba(255,222,130,0.55)');
    glow.addColorStop(1, 'rgba(255,222,130,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 130, sun.y - 130, 260, 260);
    ctx.fillStyle = '#fff8d4';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  return { horizonY, sun };
}

function drawSparkles(ctx, cam, sparkles) {
  ctx.fillStyle = 'rgba(255,244,190,0.55)';
  for (const s of sparkles) {
    const p = project(cam, { x: s.x, y: 0.5, z: s.z });
    if (!p || p.x < 0 || p.x > W || p.y < H * 0.4 || p.y > H) continue;
    const len = Math.max(1, 6 * p.s * s.s);
    ctx.fillRect(p.x - len / 2, p.y, len, 1.5);
  }
}

// Volumetric clouds: a shaded base, a bright top and a soft rim, so each
// cloud reads as a volume with the sun on one side.
function drawClouds(ctx, cam, clouds) {
  const list = [];
  for (const c of clouds) {
    const p = project(cam, { x: c.x, y: c.y, z: c.z });
    if (p && p.x > -300 && p.x < W + 300 && p.y > -120 && p.y < H + 60) list.push({ c, p });
  }
  list.sort((a, b) => b.p.z - a.p.z);
  for (const { c, p } of list) {
    const r = c.r * p.s;
    if (r < 2) continue;
    for (let i = 0; i < c.puffs; i++) {
      const ox = (i - c.puffs / 2) * r * 0.55;
      const oy = Math.sin(i * 2.3) * r * 0.12;
      // Shadowed base, then the sun-lit top, slightly offset up-left.
      ctx.fillStyle = 'rgba(178,205,228,0.85)';
      ctx.beginPath();
      ctx.ellipse(p.x + ox, p.y + oy + r * 0.08, r * 0.62, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.ellipse(p.x + ox - r * 0.05, p.y + oy - r * 0.04, r * 0.58, r * 0.27, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---- terrain with relief -------------------------------------------------

function drawIslands(ctx, cam, trees, town, flight, horizonY) {
  const list = [];
  for (const isle of ISLANDS) {
    const p = project(cam, { x: isle.cx, y: 0, z: isle.cz });
    if (!p) continue;
    list.push({ isle, p });
  }
  list.sort((a, b) => b.p.z - a.p.z);
  for (const { isle, p } of list) {
    const fade = Math.min(1, 2600 / Math.max(300, p.z));
    const rx = isle.rx * p.s;
    const ry = isle.rz * p.s * 0.52;
    if (rx < 2 || p.x < -rx * 2 || p.x > W + rx * 2) continue;
    ctx.globalAlpha = 0.35 + 0.65 * fade;
    // Footprint clipped below the horizon: the disc can never swallow sky.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY, W, H - horizonY);
    ctx.clip();
    // Sand rim, then grass in contour bands — light on the sun side,
    // darker in the valley — so the island reads as hilly, not flat.
    ellipse(ctx, p.x, p.y, rx * 1.02, ry * 1.02, '#e6cf96');
    ellipse(ctx, p.x, p.y - ry * 0.05, rx * 0.94, ry * 0.94, `hsl(${isle.hue}, 50%, 46%)`);
    ellipse(ctx, p.x - rx * 0.08, p.y - ry * 0.08, rx * 0.78, ry * 0.78, `hsl(${isle.hue}, 54%, 38%)`);
    ellipse(ctx, p.x - rx * 0.14, p.y - ry * 0.12, rx * 0.55, ry * 0.55, `hsl(${isle.hue}, 52%, 30%)`);
    ellipse(ctx, p.x - rx * 0.18, p.y - ry * 0.14, rx * 0.32, ry * 0.32, `hsl(${isle.hue}, 48%, 24%)`);
    ctx.restore();
    // Mountain: apex projected at the peak, sun-lit face left, shadow
    // face right, a pale cap where the sun catches the top.
    const apex = project(cam, { x: isle.cx, y: isle.peak, z: isle.cz });
    if (apex) {
      ctx.beginPath();
      ctx.moveTo(p.x - rx * 0.55, p.y - ry * 0.08);
      ctx.lineTo(apex.x, apex.y);
      ctx.lineTo(p.x + rx * 0.08, p.y - ry * 0.08);
      ctx.closePath();
      ctx.fillStyle = `hsl(${isle.hue}, 46%, 34%)`;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(apex.x, apex.y);
      ctx.lineTo(p.x + rx * 0.5, p.y - ry * 0.08);
      ctx.lineTo(p.x + rx * 0.08, p.y - ry * 0.08);
      ctx.closePath();
      ctx.fillStyle = `hsl(${isle.hue}, 42%, 21%)`;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(apex.x, apex.y);
      ctx.lineTo(apex.x - rx * 0.09, apex.y + (p.y - apex.y) * 0.2);
      ctx.lineTo(apex.x + rx * 0.09, apex.y + (p.y - apex.y) * 0.2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    }
    if (p.z < 2400 && apex) {
      ctx.globalAlpha = 0.9 * fade;
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(isle.name, p.x, apex.y - 14);
    }
    ctx.globalAlpha = 1;
  }
  // Ridges: low hills drawn as two triangles — lit face, shadow face —
  // so the terrain gets visible relief between the big mountains.
  for (const ridge of RIDGES) {
    const base = project(cam, { x: ridge.x, y: groundHeight(ridge.x, ridge.z), z: ridge.z });
    const apex = project(cam, { x: ridge.x, y: groundHeight(ridge.x, ridge.z) + ridge.h, z: ridge.z });
    if (!base || !apex) continue;
    const half = ridge.r * base.s;
    if (half < 3) continue;
    ctx.beginPath();
    ctx.moveTo(base.x - half, base.y);
    ctx.lineTo(apex.x, apex.y);
    ctx.lineTo(base.x, base.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120,170,90,0.75)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(base.x + half, base.y);
    ctx.lineTo(base.x, base.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(52,96,52,0.75)';
    ctx.fill();
  }
  // Trees: shaded canopy triangles with a trunk, denser on the hills.
  for (const tree of trees) {
    const gy = groundHeight(tree.x, tree.z);
    const p = project(cam, { x: tree.x, y: gy + 2, z: tree.z });
    if (!p || p.z > 2200) continue;
    const s = Math.max(1, 8 * p.s * tree.s);
    if (s < 1.2) continue;
    const green = tree.shade > 0.5 ? 'rgba(34,110,52,0.95)' : 'rgba(58,140,66,0.95)';
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 1.6);
    ctx.lineTo(p.x - s * 0.7, p.y);
    ctx.lineTo(p.x + s * 0.7, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,20,0.9)';
    ctx.lineWidth = Math.max(1, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + s * 0.5);
    ctx.stroke();
  }
  // The airfield town: little houses with coloured roofs beside the strip.
  for (const b of town) {
    const gy = groundHeight(b.x, b.z);
    const base = project(cam, { x: b.x, y: gy, z: b.z });
    const top = project(cam, { x: b.x, y: gy + b.h, z: b.z });
    if (!base || !top) continue;
    const w = Math.max(2, b.w * base.s);
    const hgt = Math.max(2, (base.y - top.y));
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(base.x - w / 2, base.y - hgt, w, hgt);
    ctx.fillStyle = b.roof;
    ctx.beginPath();
    ctx.moveTo(base.x - w / 2 - 2, base.y - hgt);
    ctx.lineTo(base.x, base.y - hgt - Math.max(2, hgt * 0.5));
    ctx.lineTo(base.x + w / 2 + 2, base.y - hgt);
    ctx.closePath();
    ctx.fill();
  }
  void flight;
}

function drawDropZone(ctx, cam, flight) {
  const active = flight.phase === 'drop';
  const pulse = active ? 1 + 0.06 * Math.sin(flight.time * 5) : 1;
  groundCircle(ctx, cam, DROP_ZONE.x, DROP_ZONE.z, DROP_ZONE.radius * pulse,
    active ? 'rgba(255,210,62,0.22)' : 'rgba(255,210,62,0.12)',
    active ? '#ffd23e' : 'rgba(255,210,62,0.6)', 3);
  groundCircle(ctx, cam, DROP_ZONE.x, DROP_ZONE.z, DROP_ZONE.innerRadius,
    'rgba(255,255,255,0.25)', '#ffffff', 2);
  const c = project(cam, { x: DROP_ZONE.x, y: groundHeight(DROP_ZONE.x, DROP_ZONE.z) + 2, z: DROP_ZONE.z });
  if (c && c.z < 2400) {
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3c4';
    ctx.fillText(active ? 'DROP ZONE — SPACE TO RELEASE' : 'DROP ZONE', c.x, c.y - 12);
  }
}

function drawRunway(ctx, cam) {
  const h = RUNWAY.height;
  const halfL = RUNWAY.length / 2;
  const halfW = RUNWAY.width / 2;
  const corners = [
    { x: RUNWAY.cx - halfL, y: h, z: RUNWAY.cz - halfW },
    { x: RUNWAY.cx + halfL, y: h, z: RUNWAY.cz - halfW },
    { x: RUNWAY.cx + halfL, y: h, z: RUNWAY.cz + halfW },
    { x: RUNWAY.cx - halfL, y: h, z: RUNWAY.cz + halfW },
  ].map((c) => project(cam, c));
  if (corners.some((c) => !c)) return;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fillStyle = '#3d434c';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Centreline dashes.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  for (let x = RUNWAY.cx - halfL + 20; x < RUNWAY.cx + halfL - 10; x += 44) {
    const a = project(cam, { x, y: h + 0.4, z: RUNWAY.cz });
    const b = project(cam, { x: x + 22, y: h + 0.4, z: RUNWAY.cz });
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Threshold bars at the west (approach) end.
  for (let dz = -14; dz <= 14; dz += 7) {
    const a = project(cam, { x: RUNWAY.cx - halfL + 6, y: h + 0.4, z: RUNWAY.cz + dz - 2.5 });
    const b = project(cam, { x: RUNWAY.cx - halfL + 26, y: h + 0.4, z: RUNWAY.cz + dz - 2.5 });
    if (!a || !b) continue;
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Edge lights: white dots down both sides, green at the threshold,
  // red at the far end.
  for (let x = RUNWAY.cx - halfL; x <= RUNWAY.cx + halfL; x += 52) {
    for (const dz of [-halfW, halfW]) {
      const p = project(cam, { x, y: h + 1, z: RUNWAY.cz + dz });
      if (!p) continue;
      const edge = x === RUNWAY.cx - halfL ? '#37d67a' : x === RUNWAY.cx + halfL ? '#ff5a4e' : '#ffffff';
      ctx.fillStyle = edge;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, Math.min(4, 2.5 * p.s)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Runway number 09 painted near the threshold.
  const num = project(cam, { x: RUNWAY.cx - halfL + 70, y: h + 0.4, z: RUNWAY.cz });
  if (num && num.z < 1500) {
    ctx.font = `700 ${Math.max(12, Math.min(30, 26 * num.s))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('09', num.x, num.y);
  }
  // Windsock beside the strip.
  const poleTop = project(cam, { x: RUNWAY.cx - halfL - 40, y: h + 14, z: RUNWAY.cz + 60 });
  const poleBot = project(cam, { x: RUNWAY.cx - halfL - 40, y: h, z: RUNWAY.cz + 60 });
  const sockTip = project(cam, { x: RUNWAY.cx - halfL - 22, y: h + 12, z: RUNWAY.cz + 60 });
  if (poleTop && poleBot && sockTip) {
    ctx.strokeStyle = '#dfe6ea';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(poleBot.x, poleBot.y);
    ctx.lineTo(poleTop.x, poleTop.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(poleTop.x, poleTop.y);
    ctx.lineTo(sockTip.x, sockTip.y);
    ctx.lineTo(sockTip.x, sockTip.y + 5);
    ctx.lineTo(poleTop.x, poleTop.y + 5);
    ctx.closePath();
    ctx.fillStyle = '#ff7a1a';
    ctx.fill();
  }
}

function drawRings(ctx, cam, rings, time) {
  const list = [];
  rings.forEach((ring, i) => {
    const p = project(cam, { x: ring.x, y: ring.y, z: ring.z });
    if (p) list.push({ ring, p, i });
  });
  list.sort((a, b) => b.p.z - a.p.z);
  for (const { ring, p, i } of list) {
    const r = CONFIG.ringRadius * p.s;
    if (r < 1.5) continue;
    const next = rings.findIndex((g) => !g.taken) === i;
    const foot = project(cam, { x: ring.x, y: groundHeight(ring.x, ring.z), z: ring.z });
    if (foot) {
      ctx.strokeStyle = 'rgba(255,210,90,0.25)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(foot.x, foot.y);
      ctx.stroke();
    }
    const pulse = next ? 1 + 0.08 * Math.sin(time * 4) : 1;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * pulse, r * 0.94 * pulse, 0, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.strokeStyle = ring.taken ? '#37d67a' : next ? '#ffd23e' : '#c9a227';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 0.78 * pulse, r * 0.72 * pulse, 0, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.strokeStyle = ring.taken ? 'rgba(55,214,122,0.7)' : 'rgba(255,210,62,0.75)';
    ctx.stroke();
    if (next) {
      ctx.font = `700 ${Math.min(26, Math.max(13, r * 0.28))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff3c4';
      ctx.fillText(`RING ${i + 1}`, p.x, p.y - r - 10);
    }
  }
}

function drawCrate(ctx, cam, crate) {
  if (!crate) return;
  const p = project(cam, { x: crate.x, y: crate.y, z: crate.z });
  if (!p) return;
  const s = Math.max(2, 6 * p.s);
  if (!crate.landed) {
    // Parachute canopy above the falling crate.
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 2.2, s * 2.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 2.2, s * 2.4, Math.PI * 1.25, Math.PI * 1.75);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,40,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x - s * 2.2, p.y - s * 2.2);
    ctx.lineTo(p.x, p.y - s * 0.5);
    ctx.moveTo(p.x + s * 2.2, p.y - s * 2.2);
    ctx.lineTo(p.x, p.y - s * 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#b07a3a';
  ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
  ctx.strokeStyle = '#5d3d16';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(p.x - s, p.y - s, s * 2, s * 2);
  ctx.beginPath();
  ctx.moveTo(p.x - s, p.y - s);
  ctx.lineTo(p.x + s, p.y + s);
  ctx.moveTo(p.x + s, p.y - s);
  ctx.lineTo(p.x - s, p.y + s);
  ctx.stroke();
}

// ---- the plane -----------------------------------------------------------

function drawPlane(ctx, flight, time) {
  const px = W / 2;
  const py = H * 0.60;
  const bank = flight.bank;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(bank * 0.55);
  const scale = 1 + Math.min(0.12, flight.speed / 900);
  ctx.scale(scale, scale);
  // Shadow cast on the ground or sea below, shrinking as the plane climbs.
  const gh = groundHeight(flight.x, flight.z);
  const altAbove = Math.max(0, flight.y - gh);
  const shScale = Math.max(0.25, 1 - altAbove / 500);
  const shAlpha = Math.max(0.05, 0.22 - altAbove / 1200);
  ctx.fillStyle = `rgba(0,20,40,${shAlpha.toFixed(2)})`;
  ctx.beginPath();
  ctx.ellipse(0, 96 + altAbove * 0.08, 120 * shScale, 14 * shScale, 0, 0, Math.PI * 2);
  ctx.fill();
  // Main wings: white tops, shaded underside, red tips, dark spar line.
  ctx.beginPath();
  ctx.moveTo(-138, 18);
  ctx.quadraticCurveTo(-138, -6, -110, -8);
  ctx.lineTo(110, -8);
  ctx.quadraticCurveTo(138, -6, 138, 18);
  ctx.quadraticCurveTo(138, 30, 110, 30);
  ctx.lineTo(-110, 30);
  ctx.quadraticCurveTo(-138, 30, -138, 18);
  ctx.closePath();
  const wingGrad = ctx.createLinearGradient(0, -8, 0, 30);
  wingGrad.addColorStop(0, '#ffffff');
  wingGrad.addColorStop(0.6, '#dde7ee');
  wingGrad.addColorStop(1, '#aebdc9');
  ctx.fillStyle = wingGrad;
  ctx.fill();
  ctx.fillStyle = '#d7263d';
  ctx.fillRect(-138, 8, 26, 22);
  ctx.fillRect(112, 8, 26, 22);
  ctx.strokeStyle = 'rgba(30,60,90,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-110, 12);
  ctx.lineTo(110, 12);
  ctx.stroke();
  // Tailplane.
  ctx.fillStyle = '#e8eef2';
  ctx.beginPath();
  ctx.moveTo(-58, 62);
  ctx.lineTo(58, 62);
  ctx.lineTo(44, 78);
  ctx.lineTo(-44, 78);
  ctx.closePath();
  ctx.fill();
  // Fuselage: shaded from bright port side to darker starboard, so the
  // body reads as a tube, not a flat board.
  const body = ctx.createLinearGradient(-20, 0, 20, 0);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.5, '#eef3f6');
  body.addColorStop(1, '#b8c6d1');
  ctx.beginPath();
  ctx.moveTo(-17, 84);
  ctx.quadraticCurveTo(-21, 30, -13, -52);
  ctx.quadraticCurveTo(-10, -82, 0, -84);
  ctx.quadraticCurveTo(10, -82, 13, -52);
  ctx.quadraticCurveTo(21, 30, 17, 84);
  ctx.quadraticCurveTo(0, 92, -17, 84);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,60,90,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Red cheatline along the fuselage.
  ctx.strokeStyle = '#d7263d';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-15, 40);
  ctx.quadraticCurveTo(-12, 0, -8, -48);
  ctx.moveTo(15, 40);
  ctx.quadraticCurveTo(12, 0, 8, -48);
  ctx.stroke();
  // Canopy: deep blue glass with a bright sky glint, framed in dark trim.
  ctx.fillStyle = '#0e2f4e';
  ctx.beginPath();
  ctx.ellipse(0, -56, 10, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(190,230,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(-3, -61, 3.5, 7, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(3, -50, 2, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Vertical tail fin with the Merpati stripe.
  ctx.beginPath();
  ctx.moveTo(-12, 78);
  ctx.lineTo(0, 108);
  ctx.lineTo(12, 78);
  ctx.closePath();
  ctx.fillStyle = '#d7263d';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-6, 78);
  ctx.lineTo(0, 96);
  ctx.lineTo(6, 78);
  ctx.closePath();
  ctx.fill();
  // Propeller: spinning translucent disc at the nose, with a blurred arc.
  const propA = (time * 22) % Math.PI;
  ctx.save();
  ctx.translate(0, -84);
  ctx.rotate(propA);
  ctx.fillStyle = 'rgba(200,215,228,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(Math.PI / 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(220,232,242,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -84, 30, propA, propA + 1.2);
  ctx.stroke();
  ctx.fillStyle = '#d7263d';
  ctx.beginPath();
  ctx.arc(0, -84, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- HUD -----------------------------------------------------------------

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(6,24,40,0.62)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,220,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function dial(ctx, cx, cy, r, label, valueText, frac, color) {
  ctx.fillStyle = 'rgba(8,30,48,0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,225,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const x1 = cx + Math.cos(a) * (r - 4);
    const y1 = cy + Math.sin(a) * (r - 4);
    const x2 = cx + Math.cos(a) * (r - (i % 5 === 0 ? 12 : 8));
    const y2 = cy + Math.sin(a) * (r - (i % 5 === 0 ? 12 : 8));
    ctx.strokeStyle = 'rgba(180,230,255,0.8)';
    ctx.lineWidth = i % 5 === 0 ? 2.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  const na = -Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(na) * (r - 14), cy + Math.sin(na) * (r - 14));
  ctx.stroke();
  ctx.fillStyle = '#eaf7ff';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fd8f2';
  ctx.fillText(label, cx, cy + r - 8);
  ctx.font = '700 15px ui-monospace, monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(valueText, cx, cy + 8);
}

function horizonBall(ctx, cx, cy, r, pitch, bank) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(bank);
  const dy = Math.max(-r, Math.min(r, pitch * r * 2.2));
  ctx.fillStyle = '#3f9fd8';
  ctx.fillRect(-r, -r + dy, r * 2, r);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-r, dy, r * 2, r);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r, dy - 1, r * 2, 2);
  ctx.rotate(-bank);
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, 0);
  ctx.lineTo(-r * 0.18, 0);
  ctx.moveTo(r * 0.18, 0);
  ctx.lineTo(r * 0.55, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(150,225,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fd8f2';
  ctx.fillText('ATTITUDE', cx, cy + r - 8);
}

function drawHud(ctx, flight, time) {
  const hdg = headingDeg(flight);
  const kmh = Math.round(flight.speed * 3.6);
  // Top-left flight data.
  panel(ctx, 16, 14, 300, 122);
  ctx.textAlign = 'left';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = '#9fd8f2';
  ctx.fillText('ALTITUDE', 30, 36);
  ctx.fillText('SPEED', 30, 62);
  ctx.fillText('HEADING', 30, 88);
  ctx.fillText('VERT SPEED', 30, 114);
  ctx.font = '700 24px ui-monospace, monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${fmt(flight.y)} m`, 150, 39);
  ctx.fillText(`${kmh} km/h`, 150, 65);
  ctx.fillText(`${pad3(hdg)}°`, 150, 91);
  ctx.font = '700 20px ui-monospace, monospace';
  ctx.fillStyle = flight.vs >= 0 ? '#7be495' : '#ffb04a';
  ctx.fillText(flight.vs >= 0 ? `+${fmt(flight.vs, 1)} m/s` : `${fmt(flight.vs, 1)} m/s`, 150, 115);

  // Compass tape across the top centre.
  const tapeW = 420;
  const tapeX = W / 2 - tapeW / 2;
  panel(ctx, tapeX, 14, tapeW, 44);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(tapeX, 14, tapeW, 44, 10);
  ctx.clip();
  const marks = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  const firstDeg = Math.floor((hdg - 95) / 15) * 15;
  for (let deg = firstDeg; deg <= hdg + 95; deg += 15) {
    const norm = ((deg % 360) + 360) % 360;
    const x = W / 2 + ((deg - hdg) / 90) * (tapeW / 2);
    const major = norm % 45 === 0;
    ctx.strokeStyle = 'rgba(200,235,255,0.8)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 50);
    ctx.lineTo(x, major ? 34 : 42);
    ctx.stroke();
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(marks[norm] ?? String(norm), x, 30);
  }
  ctx.restore();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 7, 14);
  ctx.lineTo(W / 2 + 7, 14);
  ctx.lineTo(W / 2, 24);
  ctx.closePath();
  ctx.fill();

  // Top-right mission data: score, rings, time, and the three-job tracker.
  panel(ctx, W - 316, 14, 300, 122);
  ctx.textAlign = 'left';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = '#9fd8f2';
  ctx.fillText('SCORE', W - 302, 36);
  ctx.fillText('RINGS', W - 302, 62);
  ctx.fillText('TIME', W - 302, 88);
  ctx.font = '700 24px ui-monospace, monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${flight.score}`, W - 222, 39);
  ctx.fillText(`${flight.ringsTaken} / ${CONFIG.ringCount}`, W - 222, 65);
  const mm = Math.floor(flight.time / 60);
  const ss = Math.floor(flight.time % 60);
  ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, W - 222, 91);
  for (let i = 0; i < CONFIG.ringCount; i++) {
    ctx.beginPath();
    ctx.arc(W - 216 + i * 15, 122, 5, 0, Math.PI * 2);
    ctx.fillStyle = flight.rings[i] && flight.rings[i].taken ? '#37d67a' : 'rgba(255,255,255,0.25)';
    ctx.fill();
  }

  // Mission phase tracker under the compass tape: three jobs, one sortie.
  const jobs = [
    { label: '1 RINGS', done: flight.phase !== 'rings', active: flight.phase === 'rings' },
    { label: '2 DROP', done: flight.dropDone, active: flight.phase === 'drop' },
    { label: '3 LAND 09', done: flight.state === 'landed', active: flight.phase === 'land' },
  ];
  panel(ctx, tapeX, 66, tapeW, 30);
  jobs.forEach((job, i) => {
    const jx = tapeX + 16 + i * 140;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = job.done ? '#37d67a' : job.active ? '#ffd23e' : 'rgba(255,255,255,0.45)';
    ctx.fillText((job.done ? '✓ ' : job.active ? '▶ ' : '· ') + job.label, jx, 86);
  });
  // Landing countdown, centred just under the job tracker so it never
  // collides with the score panel.
  if (flight.landTimerOn && flight.state === 'flying') {
    const t = Math.ceil(flight.landTimer);
    ctx.font = '700 15px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = flight.landTimer < 30 ? '#ff6a5e' : '#ffffff';
    ctx.fillText(`LAND IN ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, W / 2, 112);
  }

  // Centre reticle.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.42, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 22, H * 0.42);
  ctx.lineTo(W / 2 - 8, H * 0.42);
  ctx.moveTo(W / 2 + 8, H * 0.42);
  ctx.lineTo(W / 2 + 22, H * 0.42);
  ctx.stroke();

  // Next-target pointer: bearing + distance when the target is off-centre.
  const target = flight.phase === 'rings'
    ? flight.rings.find((r) => !r.taken)
    : flight.phase === 'drop'
      ? { x: DROP_ZONE.x, y: 80, z: DROP_ZONE.z }
      : { x: RUNWAY.cx, y: RUNWAY.height + 10, z: RUNWAY.cz };
  if (target && flight.state === 'flying') {
    const dx = target.x - flight.x;
    const dz = target.z - flight.z;
    const dist = Math.round(Math.sqrt(dx * dx + dz * dz));
    const bearing = Math.atan2(dx, dz);
    let diff = bearing - flight.heading;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) > 0.35) {
      const ax = W / 2 + Math.sin(diff) * 300;
      const ay = H * 0.30;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(diff > 0 ? Math.PI / 2 : -Math.PI / 2);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(12, 10);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff3c4';
      const tName = flight.phase === 'rings' ? `NEXT RING ${dist} m` : flight.phase === 'drop' ? `DROP ZONE ${dist} m` : `RUNWAY 09 ${dist} m`;
      ctx.fillText(tName, ax, ay + 30);
    }
  }

  // Bottom instrument panel: lit dials + fuel + throttle + hull.
  const py = H - 122;
  panel(ctx, 16, py, W - 32, 106);
  dial(ctx, 92, py + 53, 42, 'AIRSPEED', `${kmh}`, kmh / 360, '#7be495');
  dial(ctx, 196, py + 53, 42, 'ALTITUDE', `${fmt(flight.y)}`, Math.min(1, flight.y / 500), '#7ec3e8');
  horizonBall(ctx, 300, py + 53, 42, flight.pitch, flight.bank);
  dial(ctx, 404, py + 53, 42, 'COMPASS', pad3(hdg), hdg / 360, '#ffd23e');
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fd8f2';
  ctx.fillText('FUEL', 470, py + 22);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(470, py + 30, 220, 14);
  ctx.fillStyle = flight.fuel > 25 ? '#37d67a' : '#ff5a4e';
  ctx.fillRect(470, py + 30, 220 * (flight.fuel / 100), 14);
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.round(flight.fuel)}%`, 700, py + 42);
  ctx.fillStyle = '#9fd8f2';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText('THROTTLE', 470, py + 66);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(470, py + 74, 220, 14);
  ctx.fillStyle = '#ffb04a';
  ctx.fillRect(470, py + 74, 220 * flight.throttle, 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.fillText(`${Math.round(flight.throttle * 100)}%`, 700, py + 86);
  ctx.fillStyle = '#9fd8f2';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText('HULL', 760, py + 22);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(760, py + 30, 160, 14);
  ctx.fillStyle = flight.damage > 50 ? '#ff5a4e' : '#7be495';
  ctx.fillRect(760, py + 30, 160 * (1 - flight.damage / 100), 14);
  const nextName = flight.phase === 'rings'
    ? `Job 1: Ring ${flight.ringsTaken + 1} of ${CONFIG.ringCount} — then the cargo drop`
    : flight.phase === 'drop'
      ? 'Job 2: fly LOW & SLOW over the yellow field, press SPACE to drop'
      : 'Job 3: land on runway 09 before the clock runs out';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillStyle = '#eaf7ff';
  ctx.fillText('✈  ' + nextName, 760, py + 78);
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = '#9fd8f2';
  ctx.fillText('Arrows/drag steer · W/S throttle · SPACE drop · C cockpit · P pause · R restart · M mute', 760, py + 96);

  // Transient message.
  if (flight.message && flight.time < flight.messageUntil) {
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.strokeStyle = 'rgba(0,20,40,0.8)';
    ctx.lineWidth = 6;
    ctx.strokeText(flight.message, W / 2, H * 0.24);
    ctx.fillText(flight.message, W / 2, H * 0.24);
  }
  void time;
}

// ---- overlays ------------------------------------------------------------

function overlayTitle(ctx, lines) {
  ctx.fillStyle = 'rgba(4,18,32,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  let y = 150;
  for (const line of lines) {
    ctx.font = line.font;
    ctx.fillStyle = line.color;
    if (line.stroke) {
      ctx.strokeStyle = 'rgba(0,20,40,0.85)';
      ctx.lineWidth = 7;
      ctx.strokeText(line.text, W / 2, y);
    }
    ctx.fillText(line.text, W / 2, y);
    y += line.gap;
  }
}

function drawMenu(ctx) {
  overlayTitle(ctx, [
    { text: 'LANGIT BIRU', font: '900 84px system-ui, sans-serif', color: '#ffffff', stroke: true, gap: 92 },
    { text: '— THREE JOBS, ONE SORTIE —', font: '700 30px system-ui, sans-serif', color: '#ffd23e', stroke: false, gap: 52 },
    { text: 'Fly the Elang Laut across the Merpati archipelago:', font: '600 22px system-ui, sans-serif', color: '#eaf7ff', stroke: false, gap: 32 },
    { text: 'thread 6 golden rings, drop cargo on the yellow field,', font: '600 22px system-ui, sans-serif', color: '#eaf7ff', stroke: false, gap: 32 },
    { text: 'then land on runway 09 before the clock runs out.', font: '600 22px system-ui, sans-serif', color: '#eaf7ff', stroke: false, gap: 56 },
    { text: '↑ ↓ pitch    ← → bank & turn    W / S throttle    SPACE drop cargo    C cockpit', font: '600 19px system-ui, sans-serif', color: '#bfe6ff', stroke: false, gap: 34 },
    { text: 'Watch your fuel — and a hard touchdown bends the hull.', font: '600 19px system-ui, sans-serif', color: '#bfe6ff', stroke: false, gap: 64 },
    { text: '▶  PRESS ENTER OR CLICK TO FLY', font: '800 28px system-ui, sans-serif', color: '#ffd23e', stroke: true, gap: 0 },
  ]);
}

function drawEnd(ctx, flight) {
  const won = flight.state === 'landed';
  const lines = [
    { text: won ? '✈  LANDED!' : '💥  CRASHED', font: '900 72px system-ui, sans-serif', color: won ? '#7be495' : '#ff6a5e', stroke: true, gap: 84 },
    { text: flight.endReason, font: '700 26px system-ui, sans-serif', color: '#ffffff', stroke: false, gap: 48 },
    { text: `SCORE  ${flight.score}    •    RINGS  ${flight.ringsTaken}/${CONFIG.ringCount}    •    CARGO  +${flight.dropPoints}    •    TIME  ${Math.floor(flight.time / 60)}:${String(Math.floor(flight.time % 60)).padStart(2, '0')}`, font: '700 24px ui-monospace, monospace', color: '#ffd23e', stroke: false, gap: 40 },
    { text: won ? `Landing +${CONFIG.landingScore}  •  fuel bonus +${Math.round(flight.fuel * 2)}  •  time bonus +${Math.max(0, Math.round(flight.landTimer) * 2)}` : 'The Elang Laut can fly again — mind the mountains and the fuel gauge.', font: '600 19px system-ui, sans-serif', color: '#eaf7ff', stroke: false, gap: 60 },
    { text: 'R — FLY AGAIN', font: '800 26px system-ui, sans-serif', color: '#ffd23e', stroke: true, gap: 0 },
  ];
  overlayTitle(ctx, lines);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(4,18,32,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = '900 64px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAUSED', W / 2, H / 2 - 10);
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillStyle = '#bfe6ff';
  ctx.fillText('P to resume   •   R to restart', W / 2, H / 2 + 34);
}

// ---- main entry ----------------------------------------------------------

export function renderScene(renderer, flight, world, time, opts = {}) {
  const { ctx } = renderer;
  const view = opts.view || flight;
  const mode = opts.camera || 'chase';
  const cam = cameraFor(view, mode);
  const { horizonY } = drawSkySea(ctx, cam, time);
  drawSparkles(ctx, cam, world.sparkles);
  drawClouds(ctx, cam, world.clouds);
  drawIslands(ctx, cam, world.trees, world.town, flight, horizonY);
  drawDropZone(ctx, cam, flight);
  drawRunway(ctx, cam);
  drawRings(ctx, cam, flight.rings, time);
  drawCrate(ctx, cam, flight.drop);
  if (mode === 'cockpit') {
    drawCockpitPanel(ctx, flight, time);
  } else {
    if (flight.state !== 'menu' || opts.showPlane) {
      drawPlane(ctx, flight, time);
    }
    if (flight.state === 'flying' || flight.state === 'landed' || flight.state === 'crashed') {
      drawHud(ctx, flight, time);
    }
  }
  if (flight.state === 'menu') drawMenu(ctx);
  if (flight.state === 'landed' || flight.state === 'crashed') drawEnd(ctx, flight);
  if (opts.paused) drawPaused(ctx);
}
