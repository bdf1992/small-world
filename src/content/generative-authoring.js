'use strict';

const { hash64, pickWeighted } = require('../kernel/address');
const {
  createDefinition,
  createTemplate,
  createReference,
  createVirtual,
  createInstance,
} = require('../model/lifecycle');
const { tokenize, renderTokenName } = require('../model/token');
const { TOKEN_PACKS } = require('./token-packs');

const ELEMENTS = Object.freeze(['Void', 'Fire', 'Chaos', 'Ground', 'Aether', 'Water', 'Order', 'Sky']);
const RARITY = Object.freeze(['T1', 'T2', 'T3', 'T4', 'T5']);

const personaCardDefinition = createDefinition({
  id: 'card.persona.definition',
  grammar: 'Artifact/Persona',
  sections: ['structure', 'attributes', 'properties', 'rarity', 'stats', 'slots'],
  dimensions: {
    bodyPlan: { kind: 'property', domain: ['humanoid', 'quadruped', 'arthropod', 'serpentine'] },
    size: { kind: 'property', domain: ['small', 'medium', 'large', 'colossal'] },
    mobility: { kind: 'property', domain: ['grounded', 'climbing', 'flying', 'swimming'] },
    covering: { kind: 'property', domain: ['skin', 'fur', 'scales', 'chitin'] },
    cognition: { kind: 'property', domain: ['instinctive', 'cunning', 'sapient'] },
    armament: { kind: 'property', domain: ['natural', 'tool', 'mixed'] },
    age: { kind: 'property', domain: ['young', 'mature', 'ancient'] },
    temperament: { kind: 'property', domain: ['dormant', 'territorial', 'hunting', 'social'] },
    element: { kind: 'attribute', domain: ELEMENTS },
    rarity: { kind: 'property', domain: RARITY },
    constitution: { kind: 'stat', derived: true },
    elementalOutput: { kind: 'stat', derived: true },
    movement: { kind: 'stat', derived: true },
  },
  slots: {
    hourglass: { accepts: 'Hourglass', count: 1 },
    inventory: { accepts: 'Artifact', count: '0..N' },
  },
});

const itemCardDefinition = createDefinition({
  id: 'card.item.definition',
  grammar: 'Artifact/Item',
  sections: ['structure', 'attributes', 'properties', 'rarity', 'stats'],
  dimensions: {
    geometry: { kind: 'property', domain: ['blade', 'plate', 'rod', 'vessel', 'mechanism'] },
    function: { kind: 'property', domain: ['strike', 'guard', 'channel', 'light', 'observe', 'store'] },
    scale: { kind: 'property', domain: ['hand', 'body', 'site'] },
    material: { kind: 'property', domain: ['metal', 'wood', 'stone', 'glass', 'bone'] },
    element: { kind: 'attribute', domain: ELEMENTS },
    rarity: { kind: 'property', domain: RARITY },
    power: { kind: 'stat', derived: true },
    durability: { kind: 'stat', derived: true },
  },
});

const biomeCardDefinition = createDefinition({
  id: 'card.biome.definition',
  grammar: 'Artifact/Biome',
  sections: ['structure', 'attributes', 'properties', 'rarity', 'stats', 'slots'],
  dimensions: {
    elevation: { kind: 'property', domain: ['low', 'mid', 'high'] },
    moisture: { kind: 'property', domain: ['dry', 'temperate', 'wet'] },
    cover: { kind: 'property', domain: ['open', 'mixed', 'dense'] },
    relief: { kind: 'property', domain: ['flat', 'rolling', 'steep'] },
    element: { kind: 'attribute', domain: ELEMENTS },
    rarity: { kind: 'property', domain: RARITY },
    resourcePressure: { kind: 'stat', derived: true },
  },
  slots: {
    situations: { accepts: 'Situation', count: '0..N' },
  },
});

const situationPackDefinition = createDefinition({
  id: 'pack.situation.definition',
  grammar: 'Pack/Situation',
  sections: ['topology', 'attributes', 'properties', 'slots', 'relations'],
  dimensions: {
    origin: { kind: 'property', domain: ['natural', 'constructed', 'mixed'] },
    enclosure: { kind: 'property', domain: ['open', 'partial', 'closed'] },
    verticality: { kind: 'property', domain: ['low', 'mid', 'high'] },
    depth: { kind: 'property', domain: ['shallow', 'deep'] },
    decay: { kind: 'property', domain: ['fresh', 'weathered', 'ruined'] },
    purpose: { kind: 'property', domain: ['shelter', 'transit', 'observe', 'ritual', 'defense'] },
    element: { kind: 'attribute', domain: ELEMENTS },
    rarity: { kind: 'property', domain: RARITY },
  },
  slots: {
    guardian: { accepts: 'Artifact/Persona', count: 1 },
    treasure: { accepts: 'Artifact/Item', count: 1 },
  },
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function one(value) { return { [value]: 1 }; }
function uniform(values) { return Object.fromEntries(values.map((value) => [value, 1])); }
function normalize(weights) {
  const entries = Object.entries(weights ?? {});
  const total = entries.reduce((sum, [, value]) => sum + Math.max(0, Number(value) || 0), 0);
  if (!entries.length || total <= 0) throw new Error('generative prior requires at least one supported value');
  return Object.fromEntries(entries.map(([key, value]) => [key, Math.max(0, Number(value) || 0) / total]));
}

function contextualWeights(spec, context) {
  const multiplier = spec.affinity === 'strong' ? 3 : spec.affinity === 'weak' ? 1.1 : 2;
  const field = context?.region?.attributes ?? context?.attributes ?? {};
  return normalize(Object.fromEntries((spec.domain ?? ELEMENTS).map((element) => [
    element,
    0.20 + (field[element] ?? 0) * multiplier,
  ])));
}

function genericPersonaCard(spec = {}) {
  return createTemplate(personaCardDefinition, {
    id: spec.id ?? 'card.persona',
    fixed: {},
    priors: {
      bodyPlan: spec.bodyPlan ?? uniform(personaCardDefinition.dimensions.bodyPlan.domain),
      size: spec.size ?? uniform(personaCardDefinition.dimensions.size.domain),
      mobility: spec.mobility ?? uniform(personaCardDefinition.dimensions.mobility.domain),
      covering: spec.covering ?? uniform(personaCardDefinition.dimensions.covering.domain),
      cognition: spec.cognition ?? uniform(personaCardDefinition.dimensions.cognition.domain),
      armament: spec.armament ?? uniform(personaCardDefinition.dimensions.armament.domain),
      age: spec.age ?? uniform(personaCardDefinition.dimensions.age.domain),
      temperament: spec.temperament ?? uniform(personaCardDefinition.dimensions.temperament.domain),
      element: spec.element ?? { source: 'context', affinity: spec.affinity ?? 'medium', domain: [...ELEMENTS] },
      rarity: spec.rarity ?? uniform(RARITY),
    },
    rules: {
      constitution: 'derive from size + rarity + element',
      elementalOutput: 'derive from rarity + element',
      movement: 'derive from size + mobility + element',
    },
    slots: clone(personaCardDefinition.slots),
  });
}

function genericItemCard(spec = {}) {
  return createTemplate(itemCardDefinition, {
    id: spec.id ?? 'card.item',
    fixed: {},
    priors: {
      geometry: spec.geometry ?? uniform(itemCardDefinition.dimensions.geometry.domain),
      function: spec.function ?? uniform(itemCardDefinition.dimensions.function.domain),
      scale: spec.scale ?? uniform(itemCardDefinition.dimensions.scale.domain),
      material: spec.material ?? uniform(itemCardDefinition.dimensions.material.domain),
      element: spec.element ?? { source: 'context', affinity: spec.affinity ?? 'medium', domain: [...ELEMENTS] },
      rarity: spec.rarity ?? uniform(RARITY),
    },
    rules: {
      power: 'derive from function + scale + rarity + element',
      durability: 'derive from material + scale + rarity',
    },
  });
}

function genericBiomeCard(spec = {}) {
  return createTemplate(biomeCardDefinition, {
    id: spec.id ?? 'card.biome',
    fixed: {},
    priors: {
      elevation: spec.elevation ?? uniform(biomeCardDefinition.dimensions.elevation.domain),
      moisture: spec.moisture ?? uniform(biomeCardDefinition.dimensions.moisture.domain),
      cover: spec.cover ?? uniform(biomeCardDefinition.dimensions.cover.domain),
      relief: spec.relief ?? uniform(biomeCardDefinition.dimensions.relief.domain),
      element: spec.element ?? uniform(ELEMENTS),
      rarity: spec.rarity ?? uniform(RARITY),
    },
    rules: { resourcePressure: 'derive from rarity + terrain structure + element' },
    slots: clone(biomeCardDefinition.slots),
  });
}

function genericSituationPack(spec = {}) {
  return createTemplate(situationPackDefinition, {
    id: spec.id ?? 'pack.situation',
    fixed: {},
    priors: {
      origin: spec.origin ?? uniform(situationPackDefinition.dimensions.origin.domain),
      enclosure: spec.enclosure ?? uniform(situationPackDefinition.dimensions.enclosure.domain),
      verticality: spec.verticality ?? uniform(situationPackDefinition.dimensions.verticality.domain),
      depth: spec.depth ?? uniform(situationPackDefinition.dimensions.depth.domain),
      decay: spec.decay ?? uniform(situationPackDefinition.dimensions.decay.domain),
      purpose: spec.purpose ?? uniform(situationPackDefinition.dimensions.purpose.domain),
      element: spec.element ?? { source: 'context', affinity: spec.affinity ?? 'medium', domain: [...ELEMENTS] },
      rarity: spec.rarity ?? uniform(RARITY),
    },
    slots: {
      guardian: { accepts: 'Artifact/Persona', count: 1, candidates: clone(spec.guardianCandidates ?? { 'card.persona': 1 }) },
      treasure: { accepts: 'Artifact/Item', count: 1, candidates: clone(spec.treasureCandidates ?? { 'card.item': 1 }) },
    },
    rules: {
      relations: ['guardian occupies situation', 'treasure belongs to situation'],
    },
  });
}

function virtualizeGenerator(template, reference) {
  if (reference?.templateId !== template.id) throw new Error('generator reference/template mismatch');
  const possibilities = {};
  for (const [field, prior] of Object.entries(template.priors ?? {})) {
    possibilities[field] = prior?.source === 'context'
      ? contextualWeights(prior, reference.context)
      : normalize(prior);
  }
  return createVirtual(reference, {
    id: `${reference.id}@virtual`,
    fixed: {},
    possibilities,
    slots: Object.fromEntries(Object.entries(template.slots ?? {}).map(([name, slot]) => [name, { state: 'virtual', ...clone(slot) }])),
    lineage: [
      { stage: 'definition', id: template.definitionId },
      { stage: 'template', id: template.id },
      { stage: 'reference', id: reference.id },
    ],
  });
}

function settlePossibilities(virtual, seed) {
  return Object.fromEntries(Object.entries(virtual.possibilities ?? {}).map(([field, weights]) => [
    field,
    pickWeighted(seed, `${virtual.id}:${field}`, weights),
  ]));
}

function sizeValue(size) { return { small: 1, medium: 2, large: 3, colossal: 4 }[size] ?? 2; }
function rarityValue(rarity) { return /^T\d+$/.test(rarity ?? '') ? Number(rarity.slice(1)) : 1; }

function structuralStats(grammar, settled) {
  const rarity = rarityValue(settled.rarity);
  if (grammar === 'Artifact/Persona') {
    const size = sizeValue(settled.size);
    const mobility = { grounded: 0, climbing: 1, swimming: 1, flying: 2 }[settled.mobility] ?? 0;
    return {
      constitution: 6 + size * 5 + rarity * 3 + (settled.element === 'Ground' ? 3 : 0),
      elementalOutput: 4 + rarity * 4 + (settled.element === 'Fire' ? 3 : 0),
      movement: Math.max(1, 7 - size + mobility + (settled.element === 'Sky' ? 1 : 0)),
    };
  }
  if (grammar === 'Artifact/Item') {
    const scale = { hand: 1, body: 2, site: 4 }[settled.scale] ?? 1;
    const material = { metal: 4, wood: 2, stone: 5, glass: 1, bone: 3 }[settled.material] ?? 2;
    return {
      power: 3 + rarity * 4 + scale + (settled.function === 'strike' || settled.function === 'channel' ? 3 : 0),
      durability: 8 + rarity * 5 + material * 2 + scale,
    };
  }
  if (grammar === 'Artifact/Biome') {
    const relief = { flat: 1, rolling: 2, steep: 4 }[settled.relief] ?? 1;
    const moisture = { dry: 1, temperate: 2, wet: 3 }[settled.moisture] ?? 2;
    return { resourcePressure: rarity + relief + moisture };
  }
  return {};
}

function tokenizedProjection(subject, tokenPacks = TOKEN_PACKS) {
  const assignments = tokenize(subject, tokenPacks);
  return Object.freeze({
    subject,
    assignments,
    tokens: Object.freeze(assignments.map((assignment) => assignment.token)),
    name: renderTokenName(assignments, { fallback: subject.grammar?.split('/').pop() ?? 'Artifact' }),
  });
}

function realizeGenerator(template, virtual, seed, { tokenPacks = TOKEN_PACKS } = {}) {
  const settled = settlePossibilities(virtual, seed);
  const definition = {
    'Artifact/Persona': personaCardDefinition,
    'Artifact/Item': itemCardDefinition,
    'Artifact/Biome': biomeCardDefinition,
    'Pack/Situation': situationPackDefinition,
  }[template.grammar];
  if (!definition) throw new Error(`unsupported generic generator grammar: ${template.grammar}`);

  const properties = {};
  const attributes = {};
  for (const [field, value] of Object.entries(settled)) {
    if (field === 'rarity') continue;
    const dimension = definition.dimensions[field];
    if (dimension?.kind === 'attribute') attributes[field] = value;
    else properties[field] = value;
  }
  const suffix = hash64(seed, virtual.id, 'instance').toString(16).padStart(16, '0').slice(-8);
  const proto = {
    stage: 'instance',
    grammar: template.grammar,
    properties,
    attributes,
    rarity: settled.rarity,
    stats: structuralStats(template.grammar, settled),
  };
  const naming = tokenizedProjection(proto, tokenPacks);
  const slug = naming.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'artifact';
  const instance = createInstance(virtual, {
    id: `${slug}-${suffix}`,
    kind: template.grammar === 'Pack/Situation' ? 'Situation' : 'Artifact',
    properties,
    attributes,
    rarity: settled.rarity,
    stats: proto.stats,
    slots: virtual.slots,
    tokens: naming.tokens,
    tokenAssignments: naming.assignments,
    name: naming.name,
    lineage: [...virtual.lineage, { stage: 'virtual', id: virtual.id }],
  });
  return instance;
}

function resolveGenerator(template, { seed = 93208, context = {}, id = `${template.id}@reference`, tokenPacks = TOKEN_PACKS } = {}) {
  const reference = createReference(template, { id, context });
  const virtual = virtualizeGenerator(template, reference);
  const virtualNaming = tokenizedProjection(virtual, tokenPacks);
  const instance = realizeGenerator(template, virtual, seed, { tokenPacks });
  return Object.freeze({ template, reference, virtual, virtualNaming, instance });
}

module.exports = {
  ELEMENTS,
  RARITY,
  personaCardDefinition,
  itemCardDefinition,
  biomeCardDefinition,
  situationPackDefinition,
  genericPersonaCard,
  genericItemCard,
  genericBiomeCard,
  genericSituationPack,
  virtualizeGenerator,
  realizeGenerator,
  resolveGenerator,
  tokenizedProjection,
  one,
  uniform,
};
