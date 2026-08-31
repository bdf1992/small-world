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
  cellPriorProvenance,
};
