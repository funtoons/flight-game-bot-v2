// Langit Biru v2 — the cockpit view. When the pilot presses C, the camera
// moves to the nose and this panel is drawn over the world: a dark
// glareshield, a row of lit instruments (airspeed, altimeter, attitude,
// compass, fuel, throttle), the spinning propeller seen through the
// windshield, and the frame pillars. The runway or ring ahead stays
// visible through the glass, so the cockpit shot still shows the mission.
import { CONFIG } from './config.js';
import { headingDeg } from './physics.js';

const W = CONFIG.viewW;
const H = CONFIG.viewH;

function miniDial(ctx, cx, cy, r, label, valueText, frac, color) {
  ctx.fillStyle = 'rgba(10,26,40,0.92)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,225,255,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Lit tick ring: the instruments glow, they are not just drawn.
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const x1 = cx + Math.cos(a) * (r - 3);
    const y1 = cy + Math.sin(a) * (r - 3);
    const x2 = cx + Math.cos(a) * (r - (i % 5 === 0 ? 10 : 6));
    const y2 = cy + Math.sin(a) * (r - (i % 5 === 0 ? 10 : 6));
    ctx.strokeStyle = 'rgba(190,235,255,0.9)';
    ctx.lineWidth = i % 5 === 0 ? 2 : 1;
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
  ctx.lineTo(cx + Math.cos(na) * (r - 11), cy + Math.sin(na) * (r - 11));
  ctx.stroke();
  ctx.fillStyle = '#eaf7ff';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fd8f2';
  ctx.fillText(label, cx, cy + r - 6);
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(valueText, cx, cy + 6);
}

function miniAttitude(ctx, cx, cy, r, pitch, bank) {
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
  ctx.strokeStyle = 'rgba(160,225,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fd8f2';
  ctx.fillText('ATTITUDE', cx, cy + r - 6);
}

export function drawCockpitPanel(ctx, flight, time) {
  const hdg = headingDeg(flight);
  const kmh = Math.round(flight.speed * 3.6);
  // The propeller seen through the windshield: a faint spinning blur
  // disc and a bright arc, centred just above the panel.
  const propA = (time * 22) % Math.PI;
  ctx.save();
  ctx.translate(W / 2, H * 0.34);
  ctx.rotate(propA);
  ctx.fillStyle = 'rgba(210,225,238,0.14)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 95, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(Math.PI / 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, 95, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(230,240,250,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.34, 88, propA, propA + 1.1);
  ctx.stroke();
  // Nose cowling: a low grey brow at the bottom of the glass.
  const nose = ctx.createLinearGradient(0, H * 0.56, 0, H * 0.62);
  nose.addColorStop(0, '#c8d3dc');
  nose.addColorStop(1, '#8fa0ad');
  ctx.fillStyle = nose;
  ctx.beginPath();
  ctx.moveTo(W * 0.38, H * 0.62);
  ctx.quadraticCurveTo(W / 2, H * 0.56, W * 0.62, H * 0.62);
  ctx.lineTo(W * 0.62, H * 0.63);
  ctx.lineTo(W * 0.38, H * 0.63);
  ctx.closePath();
  ctx.fill();
  // Windshield frame: two pillars and a top bar, dark with a thin lit edge.
  ctx.fillStyle = '#101c28';
  ctx.fillRect(0, 0, 26, H * 0.62);
  ctx.fillRect(W - 26, 0, 26, H * 0.62);
  ctx.fillRect(0, 0, W, 22);
  ctx.beginPath();
  ctx.moveTo(W * 0.30, 0);
  ctx.lineTo(W * 0.36, H * 0.60);
  ctx.lineTo(W * 0.38, H * 0.60);
  ctx.lineTo(W * 0.33, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W * 0.70, 0);
  ctx.lineTo(W * 0.64, H * 0.60);
  ctx.lineTo(W * 0.62, H * 0.60);
  ctx.lineTo(W * 0.67, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(160,225,255,0.35)';
  ctx.fillRect(26, 0, 2, H * 0.62);
  ctx.fillRect(W - 28, 0, 2, H * 0.62);
  // Glareshield: the dark brow above the panel.
  const shield = ctx.createLinearGradient(0, H * 0.60, 0, H * 0.68);
  shield.addColorStop(0, '#1a2836');
  shield.addColorStop(1, '#0b1520');
  ctx.fillStyle = shield;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.66);
  ctx.quadraticCurveTo(W / 2, H * 0.58, W, H * 0.66);
  ctx.lineTo(W, H * 0.70);
  ctx.lineTo(0, H * 0.70);
  ctx.closePath();
  ctx.fill();
  // The instrument panel itself.
  const py = H * 0.70;
  const panelGrad = ctx.createLinearGradient(0, py, 0, H);
  panelGrad.addColorStop(0, '#16242f');
  panelGrad.addColorStop(1, '#0a141d');
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, py, W, H - py);
  ctx.strokeStyle = 'rgba(140,220,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, py);
  ctx.lineTo(W, py);
  ctx.stroke();
  const cy = py + (H - py) / 2 + 6;
  miniDial(ctx, 130, cy, 52, 'AIRSPEED', `${kmh}`, kmh / 360, '#7be495');
  miniDial(ctx, 270, cy, 52, 'ALTITUDE', `${Math.round(flight.y)}`, Math.min(1, flight.y / 500), '#7ec3e8');
  miniAttitude(ctx, 410, cy, 52, flight.pitch, flight.bank);
  miniDial(ctx, 550, cy, 52, 'COMPASS', String(Math.round(hdg)).padStart(3, '0'), hdg / 360, '#ffd23e');
  // Fuel and throttle bars on the panel.
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fd8f2';
  ctx.fillText('FUEL', 640, cy - 26);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(640, cy - 18, 200, 14);
  ctx.fillStyle = flight.fuel > 25 ? '#37d67a' : '#ff5a4e';
  ctx.fillRect(640, cy - 18, 200 * (flight.fuel / 100), 14);
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${Math.round(flight.fuel)}%`, 850, cy - 5);
  ctx.fillStyle = '#9fd8f2';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText('THROTTLE', 640, cy + 14);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(640, cy + 22, 200, 14);
  ctx.fillStyle = '#ffb04a';
  ctx.fillRect(640, cy + 22, 200 * flight.throttle, 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.fillText(`${Math.round(flight.throttle * 100)}%`, 850, cy + 35);
  // Mission line on the panel.
  const phaseText = flight.phase === 'rings'
    ? `JOB 1 — RING ${flight.ringsTaken + 1}/${CONFIG.ringCount}`
    : flight.phase === 'drop'
      ? 'JOB 2 — DROP THE CARGO (SPACE)'
      : 'JOB 3 — LAND RUNWAY 09';
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23e';
  ctx.fillText(phaseText, 920, cy - 26);
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = '#eaf7ff';
  ctx.fillText(`SCORE ${flight.score}   •   HDG ${String(Math.round(hdg)).padStart(3, '0')}°   •   V/S ${flight.vs >= 0 ? '+' : ''}${flight.vs.toFixed(1)} m/s`, 920, cy + 2);
  ctx.fillStyle = '#9fd8f2';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('C — chase view   •   SPACE — drop cargo', 920, cy + 28);
}
