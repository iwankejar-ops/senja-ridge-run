// The valley itself: a river that meanders north, flat grass beside it,
// ridges rising on both sides, and a short runway flattened near the start.
// Every height comes from the seed, so the valley never changes shape.
import { CONFIG } from './config.js';
import { makeNoise1D, makeNoise2D, hash2 } from './random.js';

const riverNoise = makeNoise1D(CONFIG.worldSeed + 41);
const hillNoise = makeNoise2D(CONFIG.worldSeed + 77);
const roughNoise = makeNoise2D(CONFIG.worldSeed + 131);

// Where the river runs at a given distance north.
export function riverX(z) {
  return 55 * riverNoise(z * 0.004) + 18 * riverNoise(z * 0.013 + 9);
}

// Height of the ground at world (x, z), in metres.
export function groundHeight(x, z) {
  const rx = riverX(z);
  const across = Math.abs(x - rx);
  // Valley floor: gentle rolling grass that follows the river.
  let h = 3 + 2.5 * hillNoise(x * 0.012, z * 0.012);
  // The river carves a shallow channel.
  if (across < 16) h -= (1 - across / 16) * 2.4;
  // Ridges climb steeply once you leave the valley floor, then level off
  // into high plateaus — tall enough to matter, never a wall of triangles.
  const ridge = Math.max(0, Math.min(1, (across - 150) / 170));
  h += ridge * ridge * 150;
  h += ridge * 10 * hillNoise(x * 0.03, z * 0.03);
  // Rough rock on the high slopes.
  if (h > 40) h += roughNoise(x * 0.05, z * 0.05) * 4 * (h / 90);
  // The runway is bulldozed flat.
  const r = CONFIG.runway;
  if (x > r.x - r.halfWidth - 6 && x < r.x + r.halfWidth + 6 && z > r.zStart - 30 && z < r.zEnd + 30) {
    const edge = Math.min(
      Math.min(x - (r.x - r.halfWidth - 6), (r.x + r.halfWidth + 6) - x) / 6,
      Math.min(z - (r.zStart - 30), (r.zEnd + 30) - z) / 30,
    );
    const flat = Math.max(0, Math.min(1, edge));
    h = h * (1 - flat) + 2.0 * flat;
  }
  return h;
}

// Is this spot water? The river surface sits just above the channel floor.
export function isWater(x, z) {
  return Math.abs(x - riverX(z)) < 13 && groundHeight(x, z) < CONFIG.waterLevel + 0.6;
}

// Is this spot on the runway tarmac?
export function isRunway(x, z) {
  const r = CONFIG.runway;
  return x > r.x - r.halfWidth && x < r.x + r.halfWidth && z > r.zStart && z < r.zEnd;
}

// A pine tree grows here when the hash says so: grass only, away from the
// river, the runway and the ring line, so the course stays readable.
export function treeAt(x, z) {
  if (isWater(x, z) || isRunway(x, z)) return 0;
  const h = groundHeight(x, z);
  if (h < 4 || h > 55) return 0;
  const rx = riverX(z);
  if (Math.abs(x - rx) < 18) return 0;
  const roll = hash2(Math.floor(x / 9), Math.floor(z / 9), CONFIG.worldSeed);
  if (roll < 0.62) return 0;
  const size = 0.7 + hash2(Math.floor(x / 9), Math.floor(z / 9), CONFIG.worldSeed + 5) * 0.9;
  return size;
}

// The ring course, with a flag for each gate the pilot has already flown.
export function makeRings() {
  return CONFIG.rings.map((ring) => ({ ...ring, passed: false }));
}

// Distance from a point to the centre of a ring, in metres.
export function ringDistance(plane, ring) {
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  const dz = plane.z - ring.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
