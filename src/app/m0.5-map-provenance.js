'use strict';

const core = require('../kernel/m0.5');

const ELEMENTS = Object.freeze([...core.E]);
const ZONE_PRIORS = Object.freeze([
  Object.freeze([-.45, -.15, -.35, .35, -.05, .12, .55, .18]),
  Object.freeze([-.12, .08, .08, .38, -.08, .35, .08, .35]),
  Object.freeze([.30, .15, .45, -.12, .50, .02, -.35, .18]),
]);

const PRIOR_CONTRACT = Object.freeze({
  source: 'm0.5.initialProb+smoothNoiseField',
  logitWeights: Object.freeze({
    zonePrior: .58,
    logExternalPressure: .72,
    coherentNoise: .88,
    pressureFloor: 1e-5,
  }),
  smoothing: Object.freeze({
    passes: 2,
    alpha: .24,
    selfWeight: .76,
    neighborMeanWeight: .24,
    synchronousPerPass: true,
  }),
  noise: Object.freeze({
    source: 'm0.5.coherentNoise',
    octaves: 4,
    amplitudeDecay: .52,
    frequencyBase: 1.15,
    frequencyJitter: .18,
    seededDirection: true,
    seededPhase: true,
    normalizedByAmplitudeSum: true,
  }),
  pressure: Object.freeze({
    source: 'm0.5.pressureFor',
    local: Object.freeze({
      seatScale: 1.35,
      baseToRotatedMix: .34,
    }),
    root: Object.freeze({
      radialSeatScale: 4,
      cyclicToZoneAnchorMix: .34,
      barrierTowardEdgeMix: .22,
    }),
  }),
});

function vectorObject(vector = []) {
  return Object.freeze(Object.fromEntries(ELEMENTS.map((name, index) => [name, Number(vector[index] ?? 0)])));
}

function softmax(values) {
  const max = Math.max(...values);
  const exp = values.map((value) => Math.exp(value - max));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return exp.map((value) => value / total);
}

function entropy(values) {
  let total = 0;
  for (const value of values) if (value > 0) total -= value * Math.log(value);
  return total;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rotate(vector, offset) {
  return vector.map((_, index) => vector[((index - offset) % 8 + 8) % 8]);
}

function rotateFrac(vector, offset) {
  const floor = Math.floor(offset);
  const t = offset - floor;
  const a = rotate(vector, floor);
  const b = rotate(vector, floor + 1);
  return core.norm(a.map((value, index) => value * (1 - t) + b[index] * t));
}

function mixVec(a, b, t) {
  return core.norm(a.map((value, index) => value * (1 - t) + b[index] * t));
}

function coherentNoise(seed, zone, point, element, depth) {
  let value = 0;
  let weight = 0;
  let amplitude = 1;
  for (let octave = 0; octave < PRIOR_CONTRACT.noise.octaves; octave++) {
    const frequency = Math.pow(2, octave) * (
      PRIOR_CONTRACT.noise.frequencyBase
      + PRIOR_CONTRACT.noise.frequencyJitter * core.rand(seed, 'nf', zone, element, octave, depth)
    );
    const theta = core.rand(seed, 'nth', zone, element, octave, depth) * Math.PI * 2;
    const phase = core.rand(seed, 'nph', zone, element, octave, depth) * Math.PI * 2;
    const u = (point.x * Math.cos(theta) + point.y * Math.sin(theta)) * frequency * Math.PI * 2;
    value += amplitude * Math.sin(u + phase);
    weight += amplitude;
    amplitude *= PRIOR_CONTRACT.noise.amplitudeDecay;
  }
  return value / weight;
}

function logits(zonePrior, pressure, noise) {
  const weights = PRIOR_CONTRACT.logitWeights;
  return ELEMENTS.map((_, index) => (
    zonePrior[index] * weights.zonePrior
    + Math.log(Math.max(weights.pressureFloor, pressure[index])) * weights.logExternalPressure
    + noise[index] * weights.coherentNoise
  ));
}

function fieldPriorContract(field) {
  const zonePrior = ZONE_PRIORS[field.zone];
  if (!zonePrior) throw new Error(`unsupported M0.5 zone for prior evidence: ${field.zone}`);
  return Object.freeze({
    ...PRIOR_CONTRACT,
    zone: field.zone,
    zoneName: core.Z[field.zone] ?? `Zone ${field.zone}`,
    zonePrior: vectorObject(zonePrior),
    local: Boolean(field.local),
    rotation: field.rotation,
  });
}

function cellPressureProvenance(world, field, cell) {
  const radius = clamp(Math.hypot(cell.point.x, cell.point.y), 0, 1);
  const stored = cell.external.slice();

  if (field.local) {
    const normalizedRadius = clamp(Math.hypot(cell.point.x, cell.point.y) / Math.max(1e-9, field.outerR), 0, 1);
    const seat = field.rotation * PRIOR_CONTRACT.pressure.local.seatScale * normalizedRadius;
    const baseProfile = field.baseProfile.slice();
    const rotatedProfile = rotateFrac(baseProfile, seat);
    const result = mixVec(baseProfile, rotatedProfile, PRIOR_CONTRACT.pressure.local.baseToRotatedMix);
    return Object.freeze({
      source: PRIOR_CONTRACT.pressure.source,
      mode: 'local',
      radius,
      normalizedRadius,
      seat,
      seatScale: PRIOR_CONTRACT.pressure.local.seatScale,
      baseToRotatedMix: PRIOR_CONTRACT.pressure.local.baseToRotatedMix,
      baseProfile: vectorObject(baseProfile),
      rotatedProfile: vectorObject(rotatedProfile),
      result: vectorObject(result),
      storedExternalPressure: vectorObject(stored),
    });
  }

  const radialSeat = field.rotation * PRIOR_CONTRACT.pressure.root.radialSeatScale * radius;
  const centerProfile = field.context.centerProfile.slice();
  const cyclicProfile = rotateFrac(centerProfile, radialSeat);
  const zoneAnchor = field.baseProfile.slice();
  const baseMixedPressure = mixVec(
    cyclicProfile,
    zoneAnchor,
    PRIOR_CONTRACT.pressure.root.cyclicToZoneAnchorMix,
  );

  let result = baseMixedPressure;
  let barrier = null;
  if (field.zone === 1) {
    const radialProgress = clamp((radius - field.innerR) / (field.outerR - field.innerR), 0, 1);
    const towardEdgeSeat = field.rotation * PRIOR_CONTRACT.pressure.root.radialSeatScale * radialProgress;
    const towardEdgeProfile = rotateFrac(centerProfile, towardEdgeSeat);
    result = mixVec(baseMixedPressure, towardEdgeProfile, PRIOR_CONTRACT.pressure.root.barrierTowardEdgeMix);
    barrier = Object.freeze({
      radialProgress,
      towardEdgeSeat,
      towardEdgeProfile: vectorObject(towardEdgeProfile),
      mix: PRIOR_CONTRACT.pressure.root.barrierTowardEdgeMix,
    });
  }

  return Object.freeze({
    source: PRIOR_CONTRACT.pressure.source,
    mode: 'root',
    radius,
    radialSeat,
    radialSeatScale: PRIOR_CONTRACT.pressure.root.radialSeatScale,
    cyclicToZoneAnchorMix: PRIOR_CONTRACT.pressure.root.cyclicToZoneAnchorMix,
    centerProfile: vectorObject(centerProfile),
    cyclicProfile: vectorObject(cyclicProfile),
    zoneAnchor: vectorObject(zoneAnchor),
    baseMixedPressure: vectorObject(baseMixedPressure),
    barrier,
    result: vectorObject(result),
    storedExternalPressure: vectorObject(stored),
  });
}

function cellPriorProvenance(world, field, cell) {
  const zonePrior = ZONE_PRIORS[field.zone];
  if (!zonePrior) throw new Error(`unsupported M0.5 zone for prior evidence: ${field.zone}`);

  const rawNoise = ELEMENTS.map((_, index) => coherentNoise(
    world.seed,
    field.zone,
    cell.point,
    index,
    field.depth,
  ));
  const smoothedNoise = cell.noise.slice();
  const pressure = cell.external.slice();
  const rawLogits = logits(zonePrior, pressure, rawNoise);
  const finalLogits = logits(zonePrior, pressure, smoothedNoise);
  const rawPrior = softmax(rawLogits);
  const finalPrior = softmax(finalLogits);

  return Object.freeze({
    source: PRIOR_CONTRACT.source,
    seed: world.seed,
    depth: field.depth,
    zone: field.zone,
    zonePrior: vectorObject(zonePrior),
    externalPressure: vectorObject(pressure),
    pressureProvenance: cellPressureProvenance(world, field, cell),
    coherentNoiseRaw: vectorObject(rawNoise),
    coherentNoiseSmoothed: vectorObject(smoothedNoise),
    preSmoothingLogits: vectorObject(rawLogits),
    preSmoothingPrior: vectorObject(rawPrior),
    preSmoothingEntropy: entropy(rawPrior),
    finalLogits: vectorObject(finalLogits),
    finalPrior: vectorObject(finalPrior),
    finalPriorEntropy: entropy(finalPrior),
    smoothing: PRIOR_CONTRACT.smoothing,
    logitWeights: PRIOR_CONTRACT.logitWeights,
    noiseModel: PRIOR_CONTRACT.noise,
    pressureModel: PRIOR_CONTRACT.pressure,
  });
}

module.exports = {
  PRIOR_CONTRACT,
  ZONE_PRIORS,
  fieldPriorContract,
  cellPressureProvenance,
  cellPriorProvenance,
};
