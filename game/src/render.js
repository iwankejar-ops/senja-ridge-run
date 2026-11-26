// Everything the eye sees: a sunset sky, the valley drawn as a projected
// grid of ground quads, the rings, the chase-view aeroplane and the full
// instrument HUD. All drawing is plain canvas 2D, no images, no libraries.
import { CONFIG } from './config.js';
import { groundHeight, isWater, isRunway, treeAt, riverX } from './world.js';
import { mulberry32, hash2, makeNoise1D } from './random.js';

const TAU = Math.PI * 2;

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// Sunset palette: the valley glows amber under a violet sky.
const SKY_TOP = [43, 38, 84];
const SKY_MID = [179, 71, 94];
const SKY_LOW = [255, 154, 82];

function mixColor(a, b, t) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

// Ground colour by height, slope and wetness, warmed by the low sun.
// Sand only hugs the riverbank; the valley floor itself stays grass.
function groundColor(height, slope, water, runway, sand, distance01) {
  let base;
  if (runway) base = [58, 63, 70];
  else if (water) base = [52, 110, 138];
  else if (height > 130) base = [232, 228, 220];
  else if (height > 55) base = [110, 98, 84];
  else if (height > 26) base = [96, 110, 62];
  else if (sand) base = [188, 164, 110];
  else base = [74, 112, 52];
  const shade = clamp(1 - slope * 0.9, 0.55, 1.08);
  const sun = 1 + 0.1 * (1 - distance01);
  const haze = distance01 * 0.35;
  const out = [0, 1, 2].map((i) => {
    const warm = base[i] * shade * sun;
    const sky = i === 0 ? 214 : i === 1 ? 122 : 92;
    return clamp(warm + (sky - warm) * haze, 0, 255);
  });
  return `rgb(${out[0] | 0},${out[1] | 0},${out[2] | 0})`;
}

export function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const cloudRand = mulberry32(CONFIG.worldSeed + 300);
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    clouds.push({
      x: (cloudRand() - 0.5) * 1400,
      y: 150 + cloudRand() * 80,
      z: cloudRand() * 2400,
      w: 40 + cloudRand() * 55,
    });
  }
  const birds = [];
  for (let i = 0; i < 4; i++) {
    birds.push({ x: (cloudRand() - 0.5) * 300, y: 55 + cloudRand() * 30, z: 260 + cloudRand() * 500, phase: cloudRand() * TAU });
  }

  // Project a world point into screen space. Returns null behind camera.
  function project(state, px, py, pz) {
    const w = canvas.width;
    const h = canvas.height;
    const dx = px - state.x;
    const dy = py - state.y;
    const dz = pz - state.z;
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);
    const forward = dx * sinH + dz * cosH;
    if (forward < 1.5) return null;
    const right = dx * cosH - dz * sinH;
    const sinP = Math.sin(state.pitch);
    const cosP = Math.cos(state.pitch);
    const fwd = forward * cosP + dy * sinP;
    const up = -forward * sinP + dy * cosP;
    if (fwd < 1.5) return null;
    const focal = h * CONFIG.focalScale;
    let sx = w / 2 + (right / fwd) * focal;
    let sy = h * 0.46 - (up / fwd) * focal;
    // Roll the whole picture around the centre of the screen.
    const roll = state.roll;
    if (Math.abs(roll) > 0.001) {
      const cx = w / 2;
      const cy = h * 0.46;
      const rx = sx - cx;
      const ry = sy - cy;
      const cosR = Math.cos(-roll);
      const sinR = Math.sin(-roll);
      sx = cx + rx * cosR - ry * sinR;
      sy = cy + rx * sinR + ry * cosR;
    }
    return { x: sx, y: sy, depth: fwd };
  }

  function drawSky(state, time) {
    const w = canvas.width;
    const h = canvas.height;
    const horizonY = h * 0.46;
    const gradient = ctx.createLinearGradient(0, 0, 0, horizonY + h * 0.2);
    gradient.addColorStop(0, mixColor(SKY_TOP, SKY_TOP, 0));
    gradient.addColorStop(0.55, mixColor(SKY_TOP, SKY_MID, 0.8));
    gradient.addColorStop(0.85, mixColor(SKY_MID, SKY_LOW, 0.7));
    gradient.addColorStop(1, mixColor(SKY_LOW, SKY_LOW, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, horizonY + h * 0.22);
    // Below the horizon, a warm haze bed so no gap between the farthest
    // terrain row and the sky ever shows as bare sky.
    ctx.fillStyle = '#a8846c';
    ctx.fillRect(0, horizonY, w, h - horizonY);
    // Sun: a far point in the sun's direction, drawn with a soft halo.
    const sunDir = {
      x: Math.sin(CONFIG.sunAzimuth) * Math.cos(CONFIG.sunElevation),
      y: Math.sin(CONFIG.sunElevation),
      z: Math.cos(CONFIG.sunAzimuth) * Math.cos(CONFIG.sunElevation),
    };
    const sun = project(state, state.x + sunDir.x * 3000, state.y + sunDir.y * 3000, state.z + sunDir.z * 3000);
    if (sun) {
      const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 150);
      glow.addColorStop(0, 'rgba(255, 214, 140, 0.95)');
      glow.addColorStop(0.25, 'rgba(255, 170, 90, 0.55)');
      glow.addColorStop(1, 'rgba(255, 150, 70, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - 160, sun.y - 160, 320, 320);
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 26, 0, TAU);
      ctx.fill();
    }
    // Distant ridge silhouettes: two layered ranges behind the valley so
    // the horizon has depth beyond the last terrain row.
    const ridgeNoise = makeNoise1D(CONFIG.worldSeed + 900);
    const horizonY2 = h * 0.46;
    for (const layer of [
      { amp: 46, base: 8, color: 'rgba(112, 84, 138, 0.75)' },
      { amp: 26, base: 2, color: 'rgba(84, 62, 110, 0.85)' },
    ]) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, horizonY2 + 2);
      for (let x = 0; x <= w; x += 16) {
        // Shifted by heading so the far range pans as the pilot turns.
        const y = horizonY2 - layer.base - (ridgeNoise(x * 0.004 + layer.amp + state.heading * 9) * 0.5 + 0.5) * layer.amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, horizonY2 + 2);
      ctx.closePath();
      ctx.fill();
    }
    // Clouds: soft world-anchored puffs, warm underneath, kept small so
    // they never swallow the sun.
    for (const cloud of clouds) {
      const p = project(state, cloud.x, cloud.y, cloud.z);
      if (!p) continue;
      const scale = clamp(900 / p.depth, 0.25, 1.4);
      const cw = cloud.w * scale;
      ctx.fillStyle = 'rgba(255, 214, 190, 0.32)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, cw, cw * 0.24, 0, 0, TAU);
      ctx.ellipse(p.x - cw * 0.5, p.y + cw * 0.05, cw * 0.6, cw * 0.18, 0, 0, TAU);
      ctx.ellipse(p.x + cw * 0.5, p.y + cw * 0.05, cw * 0.6, cw * 0.18, 0, 0, TAU);
      ctx.fill();
    }
    // A few birds crossing the valley, for scale and life.
    ctx.strokeStyle = 'rgba(40, 30, 50, 0.85)';
    ctx.lineWidth = 2;
    for (const bird of birds) {
      const bx = bird.x + Math.sin(time * 0.11 + bird.phase) * 60;
      const bz = bird.z + time * 2.2;
      const p = project(state, bx, bird.y + Math.sin(time * 0.7 + bird.phase) * 2, bz);
      if (!p || p.depth > 500) continue;
      const s = clamp(300 / p.depth, 0.4, 1.4) * 7;
      ctx.beginPath();
      ctx.moveTo(p.x - s, p.y);
      ctx.quadraticCurveTo(p.x - s * 0.4, p.y - s * 0.7, p.x, p.y);
      ctx.quadraticCurveTo(p.x + s * 0.4, p.y - s * 0.7, p.x + s, p.y);
      ctx.stroke();
    }
  }

  function drawTerrain(state) {
    const w = canvas.width;
    const h = canvas.height;
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);
    const step = CONFIG.gridStep;
    const rows = Math.floor(CONFIG.viewDistance / step);
    const cols = 44;
    // Sample the grid in front of the camera, then paint far to near.
    const grid = [];
    for (let r = 0; r <= rows; r++) {
      const depth = 2 + r * step;
      const spread = depth * 1.15 + 30;
      const row = [];
      for (let c = 0; c <= cols; c++) {
        const lateral = -spread + (c / cols) * spread * 2;
        const wx = state.x + sinH * depth + cosH * lateral;
        const wz = state.z + cosH * depth - sinH * lateral;
        const gy = groundHeight(wx, wz);
        const p = project(state, wx, gy, wz);
        row.push({ x: wx, z: wz, y: gy, p, water: isWater(wx, wz), runway: isRunway(wx, wz) });
      }
      grid.push(row);
    }
    for (let r = rows; r >= 1; r--) {
      const depth01 = r / rows;
      for (let c = 0; c < cols; c++) {
        const a = grid[r][c];
        const b = grid[r][c + 1];
        const d = grid[r - 1][c + 1];
        const e = grid[r - 1][c];
        if (!a.p || !b.p || !d.p || !e.p) continue;
        const slope = Math.abs(a.y - e.y) / step + Math.abs(a.y - b.y) / step;
        const sand = Math.abs(a.x - riverX(a.z)) < 14 && a.y < 5;
        ctx.fillStyle = groundColor(a.y, slope, a.water, a.runway, sand, depth01);
        ctx.beginPath();
        ctx.moveTo(a.p.x, a.p.y);
        ctx.lineTo(b.p.x, b.p.y);
        ctx.lineTo(d.p.x, d.p.y);
        ctx.lineTo(e.p.x, e.p.y);
        ctx.closePath();
        ctx.fill();
        // Runway centreline dashes.
        if (a.runway && Math.abs(a.x - CONFIG.runway.x) < 1.6 && Math.floor(a.z / 26) % 2 === 0) {
          ctx.fillStyle = 'rgba(240, 238, 225, 0.85)';
          ctx.fillRect(a.p.x - 1.5, a.p.y, 3, Math.max(2, (b.p.y - a.p.y) * 0.4));
        }
      }
    }
    // Pine trees on the near slopes, drawn as small dark triangles.
    // Very close trees are skipped: at a few metres they would fill the
    // screen, and their height is capped for the same reason.
    for (let r = 1; r <= Math.floor(260 / step); r++) {
      const depth = 4 + r * step;
      if (depth < 60) continue;
      const spread = depth * 1.15 + 30;
      for (let c = 0; c <= cols; c += 2) {
        const lateral = -spread + (c / cols) * spread * 2;
        const wx = state.x + sinH * depth + cosH * lateral;
        const wz = state.z + cosH * depth - sinH * lateral;
        const size = treeAt(Math.round(wx / 9) * 9, Math.round(wz / 9) * 9);
        if (!size) continue;
        const gy = groundHeight(wx, wz);
        const p = project(state, wx, gy, wz);
        if (!p) continue;
        const treeH = Math.min(110, (8 * size * h * CONFIG.focalScale) / p.depth);
        if (treeH < 2.5) continue;
        ctx.fillStyle = '#1f4426';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - treeH);
        ctx.lineTo(p.x - treeH * 0.32, p.y);
        ctx.lineTo(p.x + treeH * 0.32, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // The river glints: a brighter thread along the water.
    ctx.strokeStyle = 'rgba(255, 220, 160, 0.35)';
    ctx.lineWidth = 1.5;
    for (let r = 1; r <= rows; r += 2) {
      const depth = 4 + r * step;
      const rx = riverX(state.z + cosH * depth);
      const p1 = project(state, rx - 6, CONFIG.waterLevel, state.z + cosH * depth);
      const p2 = project(state, rx + 6, CONFIG.waterLevel, state.z + cosH * depth);
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  function drawRings(state) {
    const rings = state.rings;
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      if (ring.passed) continue;
      const center = project(state, ring.x, ring.y, ring.z);
      if (!center) continue;
      const ground = project(state, ring.x, groundHeight(ring.x, ring.z), ring.z);
      const radius = (ring.r * canvas.height * CONFIG.focalScale) / center.depth;
      if (radius < 2 || radius > 900) continue;
      const isNext = i === state.nextRing;
      // A thin tether from the ring down to the valley floor, for depth.
      if (ground) {
        ctx.strokeStyle = isNext ? 'rgba(255, 209, 102, 0.4)' : 'rgba(127, 212, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(ground.x, ground.y);
        ctx.stroke();
      }
      const color = isNext ? '255, 209, 102' : '127, 212, 255';
      const pulse = isNext ? 0.75 + 0.25 * Math.sin(performance.now() / 240) : 0.55;
      ctx.lineWidth = Math.max(2, radius * 0.1);
      ctx.strokeStyle = `rgba(${color}, ${0.25 * pulse})`;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = Math.max(1.5, radius * 0.045);
      ctx.strokeStyle = `rgba(${color}, ${0.95 * pulse})`;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, TAU);
      ctx.stroke();
      // Tick marks around the ring so it reads as a gate, not a halo.
      ctx.fillStyle = `rgba(${color}, 0.9)`;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        ctx.beginPath();
        ctx.arc(center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius, Math.max(2, radius * 0.05), 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawPlane(state, time) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h * 0.66 + Math.sin(time * 1.4) * 2;
    const span = Math.min(w * 0.36, 320);
    const scale = span / 320;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.roll * 0.85);
    ctx.scale(scale, scale);
    // Prop blur at the nose (far end, top of the drawing).
    const propSpin = (time * 40) % TAU;
    ctx.fillStyle = 'rgba(220, 225, 235, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, -118, 34, 8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 60, 70, 0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(propSpin) * -30, -118 + Math.sin(propSpin) * -7);
    ctx.lineTo(Math.cos(propSpin) * 30, -118 + Math.sin(propSpin) * 7);
    ctx.stroke();
    // Wings: wide trapezoids with sunset-lit tops and red tips.
    ctx.fillStyle = '#e8b64c';
    ctx.beginPath();
    ctx.moveTo(-14, -58);
    ctx.lineTo(-158, -18);
    ctx.lineTo(-158, 2);
    ctx.lineTo(-14, -18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -58);
    ctx.lineTo(158, -18);
    ctx.lineTo(158, 2);
    ctx.lineTo(14, -18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-158, -18, 16, 20);
    ctx.fillRect(142, -18, 16, 20);
    // Fuselage: cream body tapering to the nose, red cheatline.
    ctx.fillStyle = '#f4ead8';
    ctx.beginPath();
    ctx.moveTo(-13, 62);
    ctx.quadraticCurveTo(-20, -40, -8, -118);
    ctx.lineTo(8, -118);
    ctx.quadraticCurveTo(20, -40, 13, 62);
    ctx.quadraticCurveTo(0, 72, -13, 62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-13, -30, 26, 7);
    // Canopy glass catching the sun.
    ctx.fillStyle = '#7fb6d9';
    ctx.beginPath();
    ctx.ellipse(0, -72, 8, 20, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.ellipse(-2, -80, 3, 9, 0.15, 0, TAU);
    ctx.fill();
    // Tailplane and fin at the near end.
    ctx.fillStyle = '#e8b64c';
    ctx.beginPath();
    ctx.moveTo(-10, 46);
    ctx.lineTo(-52, 66);
    ctx.lineTo(-52, 74);
    ctx.lineTo(-10, 58);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, 46);
    ctx.lineTo(52, 66);
    ctx.lineTo(52, 74);
    ctx.lineTo(10, 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(-7, 44);
    ctx.lineTo(-7, 84);
    ctx.lineTo(7, 84);
    ctx.lineTo(7, 44);
    ctx.closePath();
    ctx.fill();
    // Navigation lights on the wingtips.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-152, -8, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#34d17b';
    ctx.beginPath();
    ctx.arc(152, -8, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // --- HUD ---------------------------------------------------------------
  function panel(x, y, pw, ph) {
    ctx.fillStyle = 'rgba(12, 16, 34, 0.55)';
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawCompass(state) {
    const w = canvas.width;
    const headingDeg = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
    const cx = w / 2;
    const y = 18;
    panel(cx - 150, y - 6, 300, 44);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 145, y - 4, 290, 40);
    ctx.clip();
    ctx.fillStyle = '#f4ead8';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = -60; d <= 60; d += 15) {
      // Snap each tick to a multiple of 15 so cardinal labels land exactly.
      const deg = (Math.round((headingDeg + d) / 15) * 15 % 360 + 360) % 360;
      const x = cx + d * 2.4;
      const label = labels[deg];
      ctx.fillStyle = label ? '#ffd166' : 'rgba(244, 234, 216, 0.75)';
      ctx.fillText(label || String(deg).padStart(3, '0'), x, y + 14);
      ctx.fillRect(x - 0.5, y + 24, 1, label ? 8 : 5);
    }
    ctx.restore();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(cx, y + 34);
    ctx.lineTo(cx - 5, y + 28);
    ctx.lineTo(cx + 5, y + 28);
    ctx.closePath();
    ctx.fill();
  }

  function drawArtificialHorizon(state) {
    const x = 84;
    const y = canvas.height - 84;
    const r = 52;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-state.roll);
    const pitchPx = clamp(state.pitch * 90, -40, 40);
    ctx.fillStyle = '#7fb6d9';
    ctx.fillRect(-r, -r + pitchPx - r, r * 2, r * 2);
    ctx.fillStyle = '#8a6b46';
    ctx.fillRect(-r, pitchPx, r * 2, r * 2);
    ctx.strokeStyle = '#f4ead8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, pitchPx);
    ctx.lineTo(r, pitchPx);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 5);
    ctx.closePath();
    ctx.fill();
  }

  function drawHud(state) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.textBaseline = 'alphabetic';
    drawCompass(state);
    // Speed, top left, with a throttle bar under it.
    panel(16, 16, 150, 74);
    ctx.fillStyle = '#8fa8c8';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('AIRSPEED', 28, 36);
    ctx.fillStyle = '#f4ead8';
    ctx.font = '700 30px system-ui, sans-serif';
    const knots = Math.round(state.speed * 1.944);
    ctx.fillText(String(knots), 28, 66);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = '#8fa8c8';
    ctx.fillText('KT', 28 + ctx.measureText(String(knots)).width + 34, 66);
    ctx.fillStyle = 'rgba(244, 234, 216, 0.2)';
    ctx.fillRect(28, 74, 126, 6);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(28, 74, 126 * clamp(state.throttle, 0, 1), 6);
    // Altitude, top right, with vertical speed.
    panel(w - 166, 16, 150, 74);
    ctx.fillStyle = '#8fa8c8';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('ALTITUDE', w - 154, 36);
    ctx.fillStyle = '#f4ead8';
    ctx.font = '700 30px system-ui, sans-serif';
    const feet = Math.max(0, Math.round(state.y * 3.281));
    const altText = String(feet);
    const altW = ctx.measureText(altText).width;
    ctx.fillText(altText, w - 154, 66);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = '#8fa8c8';
    ctx.fillText('FT', w - 154 + altW + 8, 66);
    const vs = state.verticalSpeed;
    ctx.fillStyle = vs > 0.5 ? '#7fd4a8' : vs < -0.5 ? '#ff8a7a' : '#8fa8c8';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText((vs > 0 ? '+' : '') + Math.round(vs * 3.281) + ' FT/MIN', w - 154, 86);
    // Fuel, rings and score, bottom right.
    panel(w - 216, h - 108, 200, 92);
    ctx.fillStyle = '#8fa8c8';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('FUEL', w - 204, h - 84);
    ctx.fillStyle = state.fuel < 25 ? '#ff8a7a' : '#7fd4a8';
    ctx.fillRect(w - 204, h - 76, 176 * clamp(state.fuel / 100, 0, 1), 8);
    ctx.strokeStyle = 'rgba(244, 234, 216, 0.4)';
    ctx.strokeRect(w - 204, h - 76, 176, 8);
    ctx.fillStyle = '#f4ead8';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText('RINGS ' + state.ringsPassed + '/' + state.rings.length, w - 204, h - 46);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('SCORE ' + state.score, w - 204, h - 24);
    // Timer, bottom centre.
    ctx.fillStyle = 'rgba(12, 16, 34, 0.55)';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const t = Math.floor(state.time);
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    ctx.fillText(mm + ':' + ss, w / 2, h - 22);
    ctx.textAlign = 'left';
    drawArtificialHorizon(state);
    // Next-ring pointer: an arrow at the screen edge toward the next gate.
    const next = state.rings[state.nextRing];
    if (next && state.mode === 'flying') {
      const p = project(state, next.x, next.y, next.z);
      const dist = Math.round(Math.sqrt((next.x - state.x) ** 2 + (next.y - state.y) ** 2 + (next.z - state.z) ** 2));
      if (!p || p.x < 40 || p.x > w - 40 || p.y < 60 || p.y > h - 120) {
        let ax;
        let ay;
        let arrow = '▼';
        if (!p) {
          // The ring is behind the camera: point along the screen edge
          // toward its bearing so the pilot knows which way to turn.
          const bearing = Math.atan2(next.x - state.x, next.z - state.z);
          let rel = bearing - state.heading;
          while (rel > Math.PI) rel -= TAU;
          while (rel < -Math.PI) rel += TAU;
          if (rel > 0) {
            ax = w - 90;
            arrow = '▶';
          } else {
            ax = 90;
            arrow = '◀';
          }
          ay = h * 0.3;
        } else {
          ax = clamp(p.x, 60, w - 60);
          ay = clamp(p.y, 80, h - 150);
        }
        ctx.fillStyle = '#ffd166';
        ctx.font = '700 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(arrow + ' NEXT RING  ' + dist + ' m', ax, ay - 26);
        ctx.beginPath();
        ctx.moveTo(ax, ay - 14);
        ctx.lineTo(ax - 9, ay + 4);
        ctx.lineTo(ax + 9, ay + 4);
        ctx.closePath();
        ctx.fill();
        ctx.textAlign = 'left';
      } else {
        // The distance sits above the ring itself, clear of the aeroplane.
        const radiusPx = (next.r * h * CONFIG.focalScale) / p.depth;
        ctx.fillStyle = '#ffd166';
        ctx.font = '700 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dist + ' m', p.x, p.y - radiusPx - 12);
        ctx.textAlign = 'left';
      }
    }
    // Terrain warning.
    if (state.warnPullUp) {
      const blink = Math.floor(performance.now() / 300) % 2 === 0;
      if (blink) {
        ctx.fillStyle = '#ff5a4a';
        ctx.font = '800 30px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ PULL UP ⚠', w / 2, h * 0.3);
        ctx.textAlign = 'left';
      }
    }
    // Transient centre message (ring bonus, landing, ...).
    if (state.banner && state.bannerTime > 0) {
      ctx.globalAlpha = clamp(state.bannerTime, 0, 1);
      ctx.fillStyle = '#ffd166';
      ctx.font = '800 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.banner, w / 2, h * 0.24);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
    // Soft vignette for a cinematic frame.
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, 'rgba(10, 8, 24, 0)');
    vignette.addColorStop(1, 'rgba(10, 8, 24, 0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  function drawTitle(state, best) {
    const w = canvas.width;
    const h = canvas.height;
    // The title lives at the top like a poster header, leaving the valley
    // and the parked aeroplane in full view below it.
    const gradient = ctx.createLinearGradient(0, 0, 0, h * 0.36);
    gradient.addColorStop(0, 'rgba(10, 8, 24, 0.72)');
    gradient.addColorStop(1, 'rgba(10, 8, 24, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h * 0.36);
    const top = h * 0.13;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = '800 58px system-ui, sans-serif';
    ctx.fillText('SENJA RIDGE RUN', w / 2, top);
    ctx.fillStyle = '#f4ead8';
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillText('Fly the golden valley at dusk — thread all eight rings, then bring her home.', w / 2, top + 34);
    ctx.font = '500 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(244, 234, 216, 0.85)';
    ctx.fillText('← → or A / D bank  •  ↑ ↓ or W / S pitch  •  SHIFT throttle up  •  CTRL throttle down  •  Mouse steers too', w / 2, top + 66);
    ctx.fillText('P pause  •  M sound  •  R restart', w / 2, top + 90);
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.fillText('PRESS ENTER TO TAKE OFF', w / 2, top + 132);
    }
    if (best > 0) {
      ctx.fillStyle = 'rgba(244, 234, 216, 0.75)';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText('Best score: ' + best, w / 2, top + 160);
    }
    ctx.textAlign = 'left';
  }

  function drawEnd(state, best) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = 'rgba(10, 8, 24, 0.3)';
    ctx.fillRect(0, 0, w, h);
    // The panel sits high so the parked aeroplane stays visible below it.
    const cy = h * 0.4;
    panel(w / 2 - 230, cy - 130, 460, 260);
    ctx.textAlign = 'center';
    const landed = state.mode === 'landed';
    ctx.fillStyle = landed ? '#7fd4a8' : '#ff8a7a';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText(landed ? 'WELCOME HOME' : 'CRASHED', w / 2, cy - 72);
    ctx.fillStyle = '#f4ead8';
    ctx.font = '600 17px system-ui, sans-serif';
    const reason = landed
      ? 'A perfect valley landing — the crowd at the airstrip cheers.'
      : state.crashReason || 'The ridge wins this time.';
    ctx.fillText(reason, w / 2, cy - 38);
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('SCORE  ' + state.score, w / 2, cy + 6);
    ctx.fillStyle = '#f4ead8';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('Rings  ' + state.ringsPassed + ' / ' + state.rings.length + '      Time  ' + Math.floor(state.time) + 's      Fuel left  ' + Math.round(state.fuel) + '%', w / 2, cy + 40);
    if (state.score >= best && state.score > 0) {
      ctx.fillStyle = '#7fd4a8';
      ctx.fillText('★ NEW BEST SCORE ★', w / 2, cy + 68);
    }
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '800 19px system-ui, sans-serif';
      ctx.fillText('PRESS R TO FLY AGAIN', w / 2, cy + 100);
    }
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = 'rgba(10, 8, 24, 0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4ead8';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText('PAUSED', w / 2, h / 2);
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('Press P to keep flying', w / 2, h / 2 + 34);
    ctx.textAlign = 'left';
  }

  return {
    render(state, time, best) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      drawSky(state, time);
      drawTerrain(state);
      drawRings(state);
      drawPlane(state, time);
      if (state.mode === 'flying' || state.mode === 'paused') drawHud(state);
      if (state.mode === 'title') {
        drawTitle(state, best);
      }
      if (state.mode === 'landed' || state.mode === 'crashed') {
        drawHud(state);
        drawEnd(state, best);
      }
      if (state.mode === 'paused') drawPaused();
    },
  };
}
