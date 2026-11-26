// Senja Ridge Run — the game itself: state, arcade flight model, ring
// course, landing and crashing, and the screenshot poses the maker uses.
// Plain ES modules, no build step, no network: open game/index.html in a
// desktop browser and fly.
import { CONFIG } from './config.js';
import { groundHeight, isRunway, makeRings, ringDistance } from './world.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { makeRenderer } from './render.js';

const canvas = document.getElementById('game');
const renderer = makeRenderer(canvas);
const input = makeInput(canvas);
const audio = makeAudio();

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// Read the maker's screenshot pose from the URL: ?shot=start|play|end
// puts the game in a fixed, good-looking state for a real render.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number(params.get('seed'));
if (Number.isFinite(seedParam) && seedParam > 0) CONFIG.worldSeed = seedParam;

function freshState() {
  return {
    mode: 'title',
    x: CONFIG.runway.x,
    y: 4,
    z: 60,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0.55,
    fuel: CONFIG.fuelMax,
    verticalSpeed: 0,
    rings: makeRings(),
    nextRing: 0,
    ringsPassed: 0,
    score: 0,
    time: 0,
    banner: null,
    bannerTime: 0,
    warnPullUp: false,
    crashReason: '',
    landedBonus: 0,
  };
}

const state = freshState();
let best = 0;
try {
  best = Number(window.localStorage.getItem('senja-ridge-run-best') || 0) || 0;
} catch (error) {
  best = 0;
}

function setBanner(text, seconds) {
  state.banner = text;
  state.bannerTime = seconds || 1.6;
}

function startRun() {
  const keepBest = best;
  const fresh = freshState();
  Object.assign(state, fresh);
  best = keepBest;
  state.mode = 'flying';
  state.speed = CONFIG.cruiseSpeed * 0.8;
  state.y = groundHeight(state.x, state.z) + 26;
  audio.unlock();
  setBanner('FLY THROUGH THE RINGS', 2);
}

function crash(reason) {
  if (state.mode !== 'flying') return;
  state.mode = 'crashed';
  state.crashReason = reason;
  audio.thud();
  audio.update(0, 0, false);
  if (state.score > best) {
    best = state.score;
    try {
      window.localStorage.setItem('senja-ridge-run-best', String(best));
    } catch (error) {
      // A private window is fine: the best score just does not persist.
    }
  }
}

function land() {
  if (state.mode !== 'flying') return;
  const fuelBonus = Math.round(state.fuel * 2);
  state.landedBonus = CONFIG.landingPoints + fuelBonus;
  state.score += state.landedBonus;
  state.mode = 'landed';
  audio.fanfare();
  audio.update(0, 0, false);
  if (state.score > best) {
    best = state.score;
    try {
      window.localStorage.setItem('senja-ridge-run-best', String(best));
    } catch (error) {
      // A private window is fine: the best score just does not persist.
    }
  }
}

// The fixed poses for screenshots: each one is a real state of the game,
// rendered by the same code the player sees.
function applyShot() {
  if (shot === 'start') {
    state.mode = 'title';
    state.x = CONFIG.runway.x;
    state.y = groundHeight(state.x, state.z) + 3;
    state.z = 90;
    state.heading = 0.06;
    state.pitch = 0.02;
    state.speed = 0;
  } else if (shot === 'play') {
    state.mode = 'flying';
    state.x = -52;
    state.y = 46;
    state.z = 800;
    state.heading = -0.18;
    state.pitch = 0.03;
    state.roll = -0.22;
    state.speed = 52;
    state.throttle = 0.72;
    state.time = 74;
    state.score = 200;
    state.ringsPassed = 2;
    state.nextRing = 2;
    state.rings[0].passed = true;
    state.rings[1].passed = true;
    state.fuel = 81;
    state.verticalSpeed = 1.2;
    state.banner = 'RING  +100';
    state.bannerTime = 10;
  } else if (shot === 'end') {
    state.mode = 'landed';
    state.x = CONFIG.runway.x;
    state.y = groundHeight(CONFIG.runway.x, 190) + 2;
    state.z = 190;
    state.heading = 0.02;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.time = 214;
    state.score = 1340;
    state.ringsPassed = 8;
    state.nextRing = 8;
    state.rings.forEach((ring) => {
      ring.passed = true;
    });
    state.fuel = 42;
    state.verticalSpeed = 0;
    state.landedBonus = 584;
    best = 1340;
  }
}

function update(dt) {
  if (state.mode === 'title') {
    // A slow drift over the runway so the title screen feels alive.
    state.z = 90 + Math.sin(performance.now() / 9000) * 6;
    state.heading = 0.06 + Math.sin(performance.now() / 12000) * 0.02;
    if (input.wasPressed('Enter') || input.wasPressed('Space')) startRun();
    return;
  }
  if (state.mode === 'paused') {
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) state.mode = 'flying';
    if (input.wasPressed('KeyR')) startRun();
    return;
  }
  if (state.mode === 'landed' || state.mode === 'crashed') {
    if (input.wasPressed('KeyR') || input.wasPressed('Enter')) startRun();
    return;
  }
  // Flying.
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    state.mode = 'paused';
    return;
  }
  if (input.wasPressed('KeyM')) audio.setMuted(!audio.isMuted());
  if (input.wasPressed('KeyR')) {
    startRun();
    return;
  }
  input.mouseActive && audio.unlock();

  // Throttle: shift spools up, ctrl spools down, and the engine answers.
  state.throttle += input.throttleAxis() * dt * 0.55;
  state.throttle = Math.max(0, Math.min(1, state.throttle));
  if (state.fuel <= 0) state.throttle = Math.min(state.throttle, 0.12);

  // Roll and pitch follow the controls, eased toward their targets.
  const targetRoll = input.rollAxis() * CONFIG.maxRoll;
  const targetPitch = input.pitchAxis() * CONFIG.maxPitch;
  state.roll += (targetRoll - state.roll) * Math.min(1, dt * 4.2);
  state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * 3.2);

  // Speed chases the throttle, drag holds it back.
  const targetSpeed = CONFIG.minSpeed + state.throttle * (CONFIG.maxSpeed - CONFIG.minSpeed);
  state.speed += (targetSpeed - state.speed) * Math.min(1, dt * (CONFIG.drag + 0.25));
  // A banked turn swings the nose around: banking left turns left.
  state.heading += state.roll * CONFIG.turnRate * (state.speed / CONFIG.cruiseSpeed) * dt;

  // Climb and sink: pitch trades speed for height, and a slow wing sinks.
  let climb = Math.sin(state.pitch) * state.speed;
  if (state.speed < CONFIG.stallSpeed) climb -= (CONFIG.stallSpeed - state.speed) * CONFIG.sinkRate * 0.12;
  state.y += climb * dt;
  state.verticalSpeed = climb;
  state.x += Math.sin(state.heading) * state.speed * dt;
  state.z += Math.cos(state.heading) * state.speed * dt;

  // Fuel burns faster at full throttle.
  state.fuel = Math.max(0, state.fuel - (0.35 + state.throttle * CONFIG.fuelBurn) * dt);
  state.time += dt;
  if (state.bannerTime > 0) state.bannerTime -= dt;

  // Rings: fly close to the centre and the gate is yours.
  const next = state.rings[state.nextRing];
  if (next && ringDistance(state, next) < next.r) {
    next.passed = true;
    state.ringsPassed += 1;
    state.nextRing += 1;
    state.score += CONFIG.ringPoints;
    audio.ring();
    if (state.nextRing >= state.rings.length) {
      setBanner('ALL RINGS! LAND ON THE RUNWAY', 2.4);
    } else {
      setBanner('RING  +100', 1.4);
    }
  }

  // Terrain warning: the ridge is close below and we are still sinking.
  const ground = groundHeight(state.x, state.z);
  const clearance = state.y - ground;
  state.warnPullUp = clearance < 14 && state.verticalSpeed < -1;
  if (state.warnPullUp && Math.floor(state.time * 2) !== Math.floor((state.time - dt) * 2)) audio.warning();

  // Landing: gentle, slow and on the tarmac after the last ring.
  if (clearance <= 2.2) {
    const onRunway = isRunway(state.x, state.z);
    const gentle = Math.abs(state.pitch) < 0.14 && state.verticalSpeed > -3.5;
    if (onRunway && state.speed < 46 && gentle && state.nextRing >= state.rings.length) {
      state.y = ground + 2;
      land();
      return;
    }
    if (onRunway && state.speed < 40 && gentle) {
      // A runway touchdown before the course is done: a bounce, not a crash.
      state.y = ground + 2.2;
      state.speed *= 0.94;
      state.pitch = Math.max(0, state.pitch);
      return;
    }
    if (state.y <= ground + 1.2) {
      crash(state.y <= CONFIG.waterLevel + 1 ? 'Ditched in the river.' : 'Flown into the ridge.');
      return;
    }
  }
  // The valley ends: turning back is the only way home.
  if (state.z > 2350 || state.z < -40 || Math.abs(state.x) > 420) {
    setBanner('TURN BACK — THE VALLEY ENDS HERE', 1.2);
  }
  if (state.fuel <= 0 && state.speed < CONFIG.stallSpeed) {
    setBanner('OUT OF FUEL — GLIDE HER DOWN', 1.2);
  }

  audio.update(state.throttle, (state.speed - CONFIG.minSpeed) / (CONFIG.maxSpeed - CONFIG.minSpeed), true);
}

// Fixed-step loop with a render every frame.
let last = performance.now();
let accumulator = 0;
function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += elapsed;
  const step = 1 / 60;
  let guard = 0;
  while (accumulator >= step && guard < 5) {
    update(step);
    accumulator -= step;
    guard += 1;
  }
  renderer.render(state, now / 1000, best);
  requestAnimationFrame(frame);
}

applyShot();
// A small handle for automated play-testing (and nothing else): the page
// exposes its live state so a test driver can read it back.
window.__senja = { state, startRun };
requestAnimationFrame(frame);
