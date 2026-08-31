'use strict';

const core = require('../kernel/m0.5');
const {
  ELEMENT_RING,
  normalizeElementalComposition,
} = require('../model/elemental-profile');

function vectorObject(values) {
  return Object.freeze(Object.fromEntries(
    ELEMENT_RING.map((element, index) => [element, Number(values[index] ?? 0)]),
  ));
}

function normalizedVector(input) {
  const normalized = normalizeElementalComposition(input);
  return Object.freeze({
    totalWeight: normalized.totalWeight,
    shares: Object.freeze(ELEMENT_RING.map((element) => Number(normalized.shares[element] ?? 0))),
    composition: Object.freeze({ ...normalized.weights }),
  });
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function elementalContextRelation({
  artifactComposition,
  mapField,
  clock,
  artifactRef = 'Virtual<Artifact>',
  artifactSource = 'Artifact.elemental-composition',
  artifactStage = null,
  mapAddress = null,
} = {}) {
  if (!clock || typeof clock.address !== 'function') {
    throw new Error('elemental context relation requires a Clock-like value with address()');
  }

  const artifact = normalizedVector(artifactComposition);
  const map = normalizedVector(mapField);
  const roleRows = core.R.map((role, seat) => ({
    seat,
    role,
    mass: 0,
    signedContribution: 0,
    pairs: [],
  }));
  const pairs = [];

  for (let fromIndex = 0; fromIndex < ELEMENT_RING.length; fromIndex++) {
    const fromShare = artifact.shares[fromIndex];
    if (fromShare <= 0) continue;

    for (let toIndex = 0; toIndex < ELEMENT_RING.length; toIndex++) {
      const toShare = map.shares[toIndex];
      if (toShare <= 0) continue;

      const dynamic = core.dynamicRelationWeight(fromIndex, toIndex, clock);
      const mass = fromShare * toShare;
      const signedContribution = mass * dynamic.weight;
      const pair = Object.freeze({
        from: ELEMENT_RING[fromIndex],
        to: ELEMENT_RING[toIndex],
        seat: dynamic.r,
        role: core.R[dynamic.r],
        mass,
        baseWeight: dynamic.base,
        modulation: dynamic.modulation,
        signedWeight: dynamic.weight,
        signedContribution,
      });

      pairs.push(pair);
      roleRows[dynamic.r].mass += mass;
      roleRows[dynamic.r].signedContribution += signedContribution;
      roleRows[dynamic.r].pairs.push(pair);
    }
  }

  const frozenRoles = Object.freeze(roleRows.map((row) => Object.freeze({
    seat: row.seat,
    role: row.role,
    mass: row.mass,
    signedContribution: row.signedContribution,
    pairs: Object.freeze(row.pairs),
  })));

  const sameElementOverlap = artifact.shares.reduce(
    (total, share, index) => total + share * map.shares[index],
    0,
  );
  const signedContextScore = sum(pairs.map((pair) => pair.signedContribution));
  const relationMassTotal = sum(pairs.map((pair) => pair.mass));
  const kernelSignedScore = core.dynamicSignedScore(artifact.shares, map.shares, clock);

  return Object.freeze({
    kind: 'Virtual<Relation>',
    relationType: 'ElementalContext',
    version: 1,
    source: 'm0.7.successor.elemental-context-relation',
    readOnly: true,
    authority: 'evidence-only',
    lifecycle: 'candidate',
    direction: 'artifact->map',
    at: clock.address(),
    side: clock.side ? 'Night' : 'Day',
    orientation: clock.side ? 'CCW' : 'CW',
    artifact: Object.freeze({
      ref: String(artifactRef),
      source: String(artifactSource),
      stage: artifactStage == null ? null : String(artifactStage),
      composition: artifact.composition,
      shares: vectorObject(artifact.shares),
      totalWeight: artifact.totalWeight,
    }),
    map: Object.freeze({
      address: mapAddress == null ? null : String(mapAddress),
      source: 'Map.State(T).effectiveField',
      field: map.composition,
      shares: vectorObject(map.shares),
      totalWeight: map.totalWeight,
    }),
    relationRoles: frozenRoles,
    pairContributions: Object.freeze(pairs),
    measurements: Object.freeze({
      sameElementOverlap,
      signedContextScore,
      kernelSignedScore,
      relationMassTotal,
    }),
    admission: null,
    effects: Object.freeze([]),
  });
}

module.exports = {
  elementalContextRelation,
};
