'use strict';

const assert = require('assert');
const {
  ELEMENT_RING,
  RELATION_WHEEL,
  rotateRelationWheel,
  normalizeElementalComposition,
  overlayElementalProfile,
  deformElementalProfile,
} = require('../src/model/elemental-profile');

function byRole(wheel) {
  return Object.fromEntries(wheel.map((entry) => [entry.role, entry.target]));
}

function contribution(profile, target, origin) {
  return profile.byElement[target].find((entry) => entry.origin === origin);
}

function main() {
  assert.deepStrictEqual(ELEMENT_RING, [
    'Void', 'Fire', 'Chaos', 'Ground', 'Aether', 'Water', 'Order', 'Sky',
  ]);
  assert.deepStrictEqual(
    RELATION_WHEEL.map(({ offset, role }) => [offset, role]),
    [
      [0, 'Is'],
      [1, 'Affinity'],
      [2, 'Anchor'],
      [3, 'Vice'],
      [4, 'Nemesis'],
      [-3, 'Conflict'],
      [-2, 'Need'],
      [-1, 'Wants'],
    ],
  );

  assert.deepStrictEqual(byRole(rotateRelationWheel('Fire')), {
    Is: 'Fire',
    Affinity: 'Chaos',
    Anchor: 'Ground',
    Vice: 'Aether',
    Nemesis: 'Water',
    Conflict: 'Order',
    Need: 'Sky',
    Wants: 'Void',
  });

  assert.deepStrictEqual(byRole(rotateRelationWheel('Water')), {
    Is: 'Water',
    Affinity: 'Order',
    Anchor: 'Sky',
    Vice: 'Void',
    Nemesis: 'Fire',
    Conflict: 'Chaos',
    Need: 'Ground',
    Wants: 'Aether',
  });

  const composition = normalizeElementalComposition({ Fire: 10, Water: 1 });
  assert.deepStrictEqual(composition.weights, { Fire: 10, Water: 1 });
  assert.strictEqual(composition.totalWeight, 11);
  assert.strictEqual(composition.shares.Fire, 10 / 11);
  assert.strictEqual(composition.shares.Water, 1 / 11);

  const profile = overlayElementalProfile({ Fire: 10, Water: 1 });
  assert.strictEqual(profile.contributions.length, 2);
  assert.deepStrictEqual(
    profile.contributions.map(({ origin, weight }) => ({ origin, weight })),
    [
      { origin: 'Fire', weight: 10 },
      { origin: 'Water', weight: 1 },
    ],
  );

  assert.deepStrictEqual(contribution(profile, 'Fire', 'Fire'), {
    origin: 'Fire', role: 'Is', offset: 0, weight: 10, share: 10 / 11,
  });
  assert.deepStrictEqual(contribution(profile, 'Fire', 'Water'), {
    origin: 'Water', role: 'Nemesis', offset: 4, weight: 1, share: 1 / 11,
  });
  assert.deepStrictEqual(contribution(profile, 'Water', 'Fire'), {
    origin: 'Fire', role: 'Nemesis', offset: 4, weight: 10, share: 10 / 11,
  });
  assert.deepStrictEqual(contribution(profile, 'Water', 'Water'), {
    origin: 'Water', role: 'Is', offset: 0, weight: 1, share: 1 / 11,
  });
  assert.deepStrictEqual(contribution(profile, 'Chaos', 'Fire'), {
    origin: 'Fire', role: 'Affinity', offset: 1, weight: 10, share: 10 / 11,
  });
  assert.deepStrictEqual(contribution(profile, 'Chaos', 'Water'), {
    origin: 'Water', role: 'Conflict', offset: -3, weight: 1, share: 1 / 11,
  });

  const deformation = deformElementalProfile(
    { Fire: 10, Water: 1 },
    [{ kind: 'scale-origin', origin: 'Water', factor: 2, source: 'Property.ProfileScale' }],
  );
  assert.deepStrictEqual(deformation.base.composition, { Fire: 10, Water: 1 });
  assert.deepStrictEqual(deformation.effective.composition, { Fire: 10, Water: 2 });
  assert.deepStrictEqual(deformation.trace, [{
    source: 'Property.ProfileScale',
    kind: 'scale-origin',
    origin: 'Water',
    factor: 2,
    before: 1,
    after: 2,
  }]);
  assert.strictEqual(deformation.changed, true);
  assert.strictEqual(contribution(deformation.base, 'Fire', 'Water').weight, 1);
  assert.strictEqual(contribution(deformation.effective, 'Fire', 'Water').weight, 2);
  assert.deepStrictEqual(RELATION_WHEEL.map((entry) => [entry.offset, entry.role]), [
    [0, 'Is'], [1, 'Affinity'], [2, 'Anchor'], [3, 'Vice'], [4, 'Nemesis'],
    [-3, 'Conflict'], [-2, 'Need'], [-1, 'Wants'],
  ]);

  const scaled = overlayElementalProfile({ Fire: 20, Water: 2 });
  assert.deepStrictEqual(scaled.shares, profile.shares);
  assert.strictEqual(scaled.totalWeight, 22);

  assert.throws(() => normalizeElementalComposition({ Fire: 0 }), /at least one positive weight/);
  assert.throws(() => normalizeElementalComposition({ Fire: -1 }), /non-negative/);
  assert.throws(() => normalizeElementalComposition({ Steam: 1 }), /unknown Element/);
  assert.throws(() => deformElementalProfile({ Fire: 1 }, [{ kind: 'invented', origin: 'Fire', factor: 1 }]), /unsupported/);

  console.log(JSON.stringify({
    pass: true,
    invariant: 'weighted overlay is canonical; local deformation changes effective reading without mutating base Profile',
    proof: {
      composition: profile.composition,
      effectiveComposition: deformation.effective.composition,
      trace: deformation.trace,
      fire: deformation.effective.byElement.Fire,
      water: deformation.effective.byElement.Water,
      chaos: deformation.effective.byElement.Chaos,
    },
  }, null, 2));
}

main();
