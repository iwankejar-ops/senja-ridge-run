// Small deterministic random helpers. The valley, the trees and the clouds
// all come from one seed, so the same seed always builds the same valley
// and a screenshot can be retaken exactly.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise: a wobbly line that is cheap to sample anywhere.
export function makeNoise1D(seed) {
  const rand = mulberry32(seed);
  const knots = [];
  for (let i = 0; i < 256; i++) knots.push(rand() * 2 - 1);
  const fade = (t) => t * t * (3 - 2 * t);
  return function noise(x) {
    const xi = Math.floor(x);
    const xf = x - xi;
    const a = knots[((xi % 256) + 256) % 256];
    const b = knots[(((xi + 1) % 256) + 256) % 256];
    return a + (b - a) * fade(xf);
  };
}

// Smooth 2D value noise built from the 1D one, for hills and tree scatter.
export function makeNoise2D(seed) {
  const n1 = makeNoise1D(seed);
  const n2 = makeNoise1D(seed + 1013);
  return function noise(x, z) {
    return (n1(x * 0.9 + n2(z * 0.7) * 2.2) + n2(z * 0.9 + n1(x * 0.6) * 2.2)) * 0.5;
  };
}

// A deterministic hash for scattering: same (x, z) always gives the same
// answer, so trees never jump around between frames.
export function hash2(x, z, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 974634211)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
