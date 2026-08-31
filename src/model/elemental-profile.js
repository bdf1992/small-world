'use strict';

const ELEMENT_RING = Object.freeze([
  'Void',
  'Fire',
  'Chaos',
  'Ground',
  'Aether',
  'Water',
  'Order',
  'Sky',
]);

const RELATION_WHEEL = Object.freeze([
  Object.freeze({ offset: 0, role: 'Is' }),
  Object.freeze({ offset: 1, role: 'Affinity' }),
  Object.freeze({ offset: 2, role: 'Anchor' }),
  Object.freeze({ offset: 3, role: 'Vice' }),
  Object.freeze({ offset: 4, role: 'Nemesis' }),
  Object.freeze({ offset: -3, role: 'Conflict' }),
  Object.freeze({ offset: -2, role: 'Need' }),
  Object.freeze({ offset: -1, role: 'Wants' }),
]);

const ELEMENT_INDEX = Object.freeze(Object.fromEntries(
  ELEMENT_RING.map((element, index) => [element, index]),
));

function assertElement(element) {
  if (!Object.prototype.hasOwnProperty.call(ELEMENT_INDEX, element)) {
    throw new Error(`unknown Element: ${element}`);
  }
  return element;
}

function elementAtOffset(origin, offset) {
  assertElement(origin);
  const length = ELEMENT_RING.length;
  const index = (ELEMENT_INDEX[origin] + Number(offset)) % length;
  return ELEMENT_RING[(index + length) % length];
}

function rotateRelationWheel(origin) {
  assertElement(origin);
  return Object.freeze(RELATION_WHEEL.map(({ offset, role }) => Object.freeze({
    origin,
    target: elementAtOffset(origin, offset),
    offset,
    role,
  })));
}

function normalizeElementalComposition(input = {}) {
  const unknown = Object.keys(input).filter((element) => !Object.prototype.hasOwnProperty.call(ELEMENT_INDEX, element));
  if (unknown.length) throw new Error(`unknown Element(s): ${unknown.join(', ')}`);

  const weights = {};
  let totalWeight = 0;

  for (const element of ELEMENT_RING) {
    const weight = Number(input[element] ?? 0);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(`Element weight must be finite and non-negative: ${element}`);
    }
    if (weight > 0) {
      weights[element] = weight;
      totalWeight += weight;
    }
  }

  if (totalWeight <= 0) throw new Error('elemental composition requires at least one positive weight');

  const shares = Object.fromEntries(
    Object.entries(weights).map(([element, weight]) => [element, weight / totalWeight]),
  );

  return Object.freeze({
    weights: Object.freeze(weights),
    shares: Object.freeze(shares),
    totalWeight,
  });
}

function overlayElementalProfile(input = {}) {
  const composition = normalizeElementalComposition(input);
  const contributions = [];
  const byElement = Object.fromEntries(ELEMENT_RING.map((element) => [element, []]));

  for (const origin of ELEMENT_RING) {
    const weight = composition.weights[origin];
    if (!weight) continue;

    const share = composition.shares[origin];
    const wheel = rotateRelationWheel(origin).map((relation) => Object.freeze({
      ...relation,
      weight,
      share,
    }));

    contributions.push(Object.freeze({
      origin,
      weight,
      share,
      wheel: Object.freeze(wheel),
    }));

    for (const relation of wheel) {
      byElement[relation.target].push(Object.freeze({
        origin,
        role: relation.role,
        offset: relation.offset,
        weight,
        share,
      }));
    }
  }

  const frozenByElement = Object.freeze(Object.fromEntries(
    ELEMENT_RING.map((element) => [element, Object.freeze(byElement[element])]),
  ));

  return Object.freeze({
    ring: ELEMENT_RING,
    relationWheel: RELATION_WHEEL,
    composition: composition.weights,
    shares: composition.shares,
    totalWeight: composition.totalWeight,
    contributions: Object.freeze(contributions),
    byElement: frozenByElement,
  });
}

module.exports = {
  ELEMENT_RING,
  RELATION_WHEEL,
  elementAtOffset,
  rotateRelationWheel,
  normalizeElementalComposition,
  overlayElementalProfile,
};
