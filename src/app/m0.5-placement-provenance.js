'use strict';

const core = require('../kernel/m0.5');

const ELEMENTS = Object.freeze([...core.E]);
const RELATIONS = Object.freeze([...core.R]);
const TYPES = Object.freeze(['Persona', 'Artifact', 'Event', 'POI']);

const RAW_SIGNATURES = Object.freeze({
  Persona: Object.freeze([.10, .16, .10, .20, .10, .14, .10, .10]),
  Artifact: Object.freeze([.12, .12, .10, .20, .18, .08, .14, .06]),
  Event: Object.freeze([.14, .16, .20, .08, .14, .10, .06, .12]),
  POI: Object.freeze([.06, .08, .08, .24, .10, .14, .24, .06]),
});

const RELATION_PREFERENCES = Object.freeze({
  Persona: Object.freeze([.20, .80, .40, -.10, -.50, -.20, .70, .60]),
  Artifact: Object.freeze([.20, .45, .75, .35, -.15, .05, .20, .30]),
  Event: Object.freeze([0, .15, 0, .50, .80, .65, .05, .25]),
  POI: Object.freeze([.25, .55, .85, -.05, -.40, -.15, .20, .15]),
});

const SPAWN_SEAT = Object.freeze({ POI: 0, Persona: 1, Artifact: 2, Event: 3 });
const ZONE_SEAT = Object.freeze([0, 2, 4]);

const SCORE_WEIGHTS = Object.freeze({
  fieldFit: 1.65,
  relationTupleFit: .62,
  dynamicSignedFit: .18,
  cycleFit: 1.18,
  phaseFit: 1.10,
  seededVariation: .18,
});

const ZONE_BIASES = Object.freeze({
  POI: Object.freeze([.28, .12, -.06]),
  Event: Object.freeze([-.08, .10, .28]),
  Persona: Object.freeze([0, 0, 0]),
  Artifact: Object.freeze([0, 0, 0]),
});

const SIDE_BIASES = Object.freeze({
  Day: Object.freeze({ POI: .06, Artifact: 0, Persona: 0, Event: 0 }),
  Night: Object.freeze({ POI: .01, Artifact: .01, Persona: .01, Event: .08 }),
});

function vectorObject(names, values) {
  return Object.freeze(Object.fromEntries(names.map((name, index) => [name, Number(values[index] ?? 0)])));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrap8(value) {
  return ((value % 8) + 8) % 8;
}

function cyclicDistance(a, b) {
  const distance = Math.abs(wrap8(a - b));
  return Math.min(distance, 8 - distance);
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

function dot(a, b) {
  let total = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index++) total += a[index] * b[index];
  return total;
}

function gumbel(seed, ...labels) {
  const u = Math.max(1e-12, Math.min(1 - 1e-12, core.rand(seed, ...labels)));
  return -Math.log(-Math.log(u));
}

function cycleAffinity(type, seat) {
  const target = SPAWN_SEAT[type];
  const distance = Math.min(cyclicDistance(seat, target), cyclicDistance(seat, wrap8(target + 4)));
  return .5 + .5 * Math.cos(Math.PI * clamp(distance / 2, 0, 1));
}

function normalizedSignature(type) {
  const raw = RAW_SIGNATURES[type];
  if (!raw) throw new Error(`unknown M0.5 placement type: ${type}`);
  return core.norm([...raw]);
}

function placementContract() {
  return Object.freeze({
    source: 'm0.5.scoreSpawn+spawnTick',
    types: Object.freeze(TYPES.map((type) => Object.freeze({
      type,
      signature: vectorObject(ELEMENTS, normalizedSignature(type)),
      relationPreferences: vectorObject(RELATIONS, RELATION_PREFERENCES[type]),
      cycleSeat: SPAWN_SEAT[type],
      zoneBias: Object.freeze({
        Center: ZONE_BIASES[type][0],
        Barrier: ZONE_BIASES[type][1],
        Edge: ZONE_BIASES[type][2],
      }),
      sideBias: Object.freeze({
        Day: SIDE_BIASES.Day[type],
        Night: SIDE_BIASES.Night[type],
      }),
    }))),
    zoneCycleOffsets: Object.freeze({ Center: ZONE_SEAT[0], Barrier: ZONE_SEAT[1], Edge: ZONE_SEAT[2] }),
    scoreWeights: SCORE_WEIGHTS,
    cycleAffinity: Object.freeze({
      source: 'm0.5.cycleAffinity',
      formula: '0.5 + 0.5*cos(pi*clamp(min(distance(seat,target),distance(seat,target+4))/2,0,1))',
    }),
    selectionRule: 'highest candidate score across every resolved cell and every placement type in each field per tick',
  });
}

function replayPlacementCandidate(world, clock, field, cell, type) {
  if (!TYPES.includes(type)) throw new Error(`unknown M0.5 placement type: ${type}`);

  const fieldVector = core.fieldVector(cell);
  const cycle = core.spawnCycle(world, clock, field.zone);
  const phaseProfile = rotateFrac(world.centerProfile, cycle.zoneSeat);
  const signature = rotateFrac(normalizedSignature(type), cycle.zoneSeat);
  const relationTuple = core.dynamicRelationTuple(phaseProfile, fieldVector, clock);
  const relationPreferences = RELATION_PREFERENCES[type];

  const fieldDot = dot(fieldVector, signature);
  const relationTupleDot = dot(relationTuple, relationPreferences);
  const dynamicSigned = core.dynamicSignedScore(phaseProfile, fieldVector, clock);
  const cycleAffinityValue = cycleAffinity(type, cycle.zoneSeat);
  const phaseDot = dot(fieldVector, phaseProfile);

  const fieldFit = fieldDot * SCORE_WEIGHTS.fieldFit;
  const relationFit = relationTupleDot * SCORE_WEIGHTS.relationTupleFit
    + dynamicSigned * SCORE_WEIGHTS.dynamicSignedFit;
  const cycleFit = cycleAffinityValue * SCORE_WEIGHTS.cycleFit;
  const phaseFit = phaseDot * SCORE_WEIGHTS.phaseFit;
  const zoneBase = ZONE_BIASES[type][field.zone];
  const sideName = clock.side ? 'Night' : 'Day';
  const side = SIDE_BIASES[sideName][type];
  const rawGumbel = gumbel(world.rootSeed, 'spawn', clock.address(), field.zone, cell.id, type);
  const random = rawGumbel * SCORE_WEIGHTS.seededVariation;
  const score = fieldFit + relationFit + cycleFit + phaseFit + zoneBase + side + random;

  return Object.freeze({
    source: 'm0.5.scoreSpawn',
    type,
    at: clock.address(),
    zone: field.zone,
    cellId: cell.id,
    fieldVector: vectorObject(ELEMENTS, fieldVector),
    cycle: Object.freeze({ ...cycle }),
    baseSignature: vectorObject(ELEMENTS, normalizedSignature(type)),
    rotatedSignature: vectorObject(ELEMENTS, signature),
    phaseProfile: vectorObject(ELEMENTS, phaseProfile),
    relationTuple: vectorObject(RELATIONS, relationTuple),
    relationPreferences: vectorObject(RELATIONS, relationPreferences),
    terms: Object.freeze({
      field: Object.freeze({ raw: fieldDot, weight: SCORE_WEIGHTS.fieldFit, contribution: fieldFit }),
      relationTuple: Object.freeze({ raw: relationTupleDot, weight: SCORE_WEIGHTS.relationTupleFit, contribution: relationTupleDot * SCORE_WEIGHTS.relationTupleFit }),
      dynamicSigned: Object.freeze({ raw: dynamicSigned, weight: SCORE_WEIGHTS.dynamicSignedFit, contribution: dynamicSigned * SCORE_WEIGHTS.dynamicSignedFit }),
      cycle: Object.freeze({ raw: cycleAffinityValue, weight: SCORE_WEIGHTS.cycleFit, contribution: cycleFit }),
      phase: Object.freeze({ raw: phaseDot, weight: SCORE_WEIGHTS.phaseFit, contribution: phaseFit }),
      zoneBase,
      side: Object.freeze({ side: sideName, contribution: side }),
      seeded: Object.freeze({ rawGumbel, weight: SCORE_WEIGHTS.seededVariation, contribution: random }),
    }),
    components: Object.freeze({ fieldFit, relationFit, cycleFit, phaseFit, zoneBase, side, random }),
    score,
  });
}

module.exports = {
  TYPES,
  RAW_SIGNATURES,
  RELATION_PREFERENCES,
  SPAWN_SEAT,
  ZONE_SEAT,
  SCORE_WEIGHTS,
  ZONE_BIASES,
  SIDE_BIASES,
  placementContract,
  replayPlacementCandidate,
};
