// Senja Ridge Run — shared tuning numbers for the whole game.
// One place to change how the plane feels, how the valley looks and how
// the run is scored. Nothing here is loaded from the network.
export const CONFIG = {
  // World: a river valley that runs north, walled in by ridges.
  worldSeed: 7,
  valleyHalfWidth: 260,
  ridgeHeight: 130,
  waterLevel: 1.2,
  // Runway: a flat strip beside the river near the start of the valley.
  runway: { x: 46, zStart: 30, zEnd: 250, halfWidth: 9 },
  // The ring course: eight gates winding up the valley.
  rings: [
    { x: 20, y: 34, z: 420, r: 13 },
    { x: -38, y: 42, z: 640, r: 13 },
    { x: -90, y: 52, z: 880, r: 12 },
    { x: -30, y: 44, z: 1120, r: 12 },
    { x: 55, y: 58, z: 1360, r: 12 },
    { x: 110, y: 48, z: 1600, r: 12 },
    { x: 40, y: 62, z: 1840, r: 12 },
    { x: -20, y: 40, z: 2080, r: 13 },
  ],
  // Flight model: gentle arcade numbers, tuned so the plane answers at
  // every speed but still punishes a dive into the ridge.
  minSpeed: 24,
  maxSpeed: 72,
  cruiseSpeed: 46,
  throttleAccel: 26,
  drag: 0.35,
  rollRate: 1.9,
  maxRoll: 1.05,
  pitchRate: 0.85,
  maxPitch: 0.38,
  turnRate: 0.38,
  stallSpeed: 26,
  sinkRate: 9,
  fuelMax: 100,
  fuelBurn: 0.9,
  // Scoring.
  ringPoints: 100,
  landingPoints: 500,
  // Rendering.
  viewDistance: 800,
  gridStep: 22,
  focalScale: 0.92,
  // The sun sits low over the ridge so the whole valley glows amber.
  sunAzimuth: -0.62,
  sunElevation: 0.16,
};
