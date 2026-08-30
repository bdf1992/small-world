'use strict';

const { hash64, pickWeighted } = require('../../kernel/address');
const {
  createDefinition,
  createTemplate,
  createReference,
  createVirtual,
  createInstance,
} = require('../../model/lifecycle');

const ELEMENTS = ['Void', 'Fire', 'Chaos', 'Ground', 'Aether', 'Water', 'Order', 'Sky'];

const personaDefinition = createDefinition({
  id: 'artifact.persona',
  grammar: 'Artifact/Persona',
  sections: ['identity', 'attributes', 'properties', 'rarity', 'stats', 'hourglass', 'inventory'],
  dimensions: {
    species: { kind: 'property', required: true },
    element: { kind: 'attribute', domain: ELEMENTS },
    rarity: { kind: 'property', domain: ['T1', 'T2', 'T3', 'T4', 'T5'] },
    age: { kind: 'property' },
    temperament: { kind: 'property' },
    constitution: { kind: 'stat', derived: true },
    elementalOutput: { kind: 'stat', derived: true },
    movement: { kind: 'stat', derived: true },
  },
  slots: {
    hourglass: { accepts: 'Hourglass', count: 1 },
    inventory: { accepts: 'Artifact', count: '0..N' },
  },
});

const dragonTemplate = createTemplate(personaDefinition, {
  id: 'persona.dragon',
  fixed: {
    species: 'Dragon',
  },
  priors: {
    element: { source: 'context', affinity: 'strong', domain: ELEMENTS },
    rarity: { T3: 0.30, T4: 0.45, T5: 0.25 },
    age: { Young: 0.20, Mature: 0.50, Ancient: 0.30 },
    temperament: { Dormant: 0.25, Territorial: 0.45, Hunting: 0.30 },
  },
  rules: {
    constitution: 'derive after realization from rarity + age + element',
    elementalOutput: 'derive after realization from rarity + element',
    movement: 'derive after realization from age + element',
  },
});

function normalize(weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(0, value), 0);
  if (!total) return Object.fromEntries(Object.keys(weights).map((key) => [key, 1 / Object.keys(weights).length]));
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Math.max(0, value) / total]));
}

function referenceDragon({ id = 'dragon-reference', boundary = {}, context = {} } = {}) {
  return createReference(dragonTemplate, { id, boundary, context });
}

function virtualizeDragon(reference) {
  const regionAttributes = reference.context?.region?.attributes ?? {};
  const elementWeights = normalize(Object.fromEntries(ELEMENTS.map((element) => {
    const contextual = regionAttributes[element] ?? 0;
    return [element, 0.20 + contextual * 3.0];
  })));

  return createVirtual(reference, {
    id: `${reference.id}@dragon`,
    fixed: dragonTemplate.fixed,
    possibilities: {
      element: elementWeights,
      rarity: dragonTemplate.priors.rarity,
      age: dragonTemplate.priors.age,
      temperament: dragonTemplate.priors.temperament,
    },
    ranges: {
      constitution: [30, 49],
      elementalOutput: [25, 43],
      movement: [4, 8],
    },
    slots: {
      hourglass: { state: 'virtual', accepts: 'Hourglass' },
      inventory: { state: 'virtual', accepts: 'Artifact', count: '0..N' },
    },
    lineage: [
      { stage: 'definition', id: personaDefinition.id },
      { stage: 'template', id: dragonTemplate.id },
      { stage: 'reference', id: reference.id },
    ],
  });
}

function realizeDragon(virtual, seed) {
  if (virtual?.stage !== 'virtual' || virtual.templateId !== dragonTemplate.id) {
    throw new Error('realizeDragon requires a Dragon virtual');
  }

  const element = pickWeighted(seed, `${virtual.id}:element`, virtual.possibilities.element);
  const rarity = pickWeighted(seed, `${virtual.id}:rarity`, virtual.possibilities.rarity);
  const age = pickWeighted(seed, `${virtual.id}:age`, virtual.possibilities.age);
  const temperament = pickWeighted(seed, `${virtual.id}:temperament`, virtual.possibilities.temperament);

  const rarityValue = { T3: 3, T4: 4, T5: 5 }[rarity];
  const ageConstitution = { Young: 0, Mature: 3, Ancient: 7 }[age];
  const ageMovement = { Young: 1, Mature: 0, Ancient: -1 }[age];

  const constitution = 18 + rarityValue * 4 + ageConstitution + (element === 'Ground' ? 4 : element === 'Water' ? 2 : 0);
  const elementalOutput = 10 + rarityValue * 5 + (element === 'Fire' ? 5 : element === 'Chaos' ? 3 : 0);
  const movement = 5 + ageMovement + (element === 'Sky' ? 2 : 0) - (element === 'Ground' ? 1 : 0);
  const suffix = hash64(seed, virtual.id, 'instance').toString(16).padStart(16, '0').slice(-8);

  return createInstance(virtual, {
    id: `dragon-${suffix}`,
    properties: {
      species: 'Dragon',
      age,
      temperament,
    },
    attributes: { element },
    rarity,
    stats: {
      constitution,
      elementalOutput,
      movement,
    },
    slots: virtual.slots,
    lineage: [...virtual.lineage, { stage: 'virtual', id: virtual.id }],
  });
}

module.exports = {
  ELEMENTS,
  personaDefinition,
  dragonTemplate,
  referenceDragon,
  virtualizeDragon,
  realizeDragon,
};
