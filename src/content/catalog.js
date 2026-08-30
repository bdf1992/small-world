'use strict';

const { hash64, pickWeighted } = require('../kernel/address');
const {
  createDefinition,
  createTemplate,
  createReference,
  createVirtual,
  createInstance,
} = require('../model/lifecycle');
const { ELEMENTS, personaDefinition, dragonTemplate } = require('./personas/dragon');

const itemDefinition = createDefinition({
  id: 'artifact.item',
  grammar: 'Artifact/Item',
  sections: ['identity', 'attributes', 'properties', 'rarity', 'stats'],
  dimensions: {
    form: { kind: 'property', required: true },
    element: { kind: 'attribute', domain: ELEMENTS },
    rarity: { kind: 'property', domain: ['T1', 'T2', 'T3', 'T4', 'T5'] },
    power: { kind: 'stat', derived: true },
    durability: { kind: 'stat', derived: true },
  },
});

const biomeDefinition = createDefinition({
  id: 'artifact.biome',
  grammar: 'Artifact/Biome',
  sections: ['identity', 'attributes', 'properties', 'rarity', 'stats', 'contents'],
  dimensions: {
    terrain: { kind: 'property', required: true },
    element: { kind: 'attribute', domain: ELEMENTS },
    rarity: { kind: 'property', domain: ['T1', 'T2', 'T3', 'T4', 'T5'] },
    resourcePressure: { kind: 'stat', derived: true },
  },
  slots: {
    situations: { accepts: 'Situation', count: '0..N' },
  },
});

const packDefinition = createDefinition({
  id: 'pack.situation',
  grammar: 'Pack/Situation',
  sections: ['identity', 'topology', 'relations'],
  dimensions: {
    form: { kind: 'property', required: true },
    topology: { kind: 'property' },
  },
});

const banditTemplate = createTemplate(personaDefinition, {
  id: 'persona.bandit',
  fixed: { role: 'Bandit', form: 'Humanoid' },
  priors: {
    element: { source: 'context', affinity: 'medium', domain: ELEMENTS },
    rarity: { T1: 0.42, T2: 0.34, T3: 0.18, T4: 0.05, T5: 0.01 },
  },
});

const bearTemplate = createTemplate(personaDefinition, {
  id: 'persona.bear',
  fixed: { species: 'Bear', nature: 'Primal' },
  priors: {
    element: { source: 'context', affinity: 'strong', domain: ELEMENTS },
    rarity: { T1: 0.25, T2: 0.38, T3: 0.25, T4: 0.10, T5: 0.02 },
  },
});

const swordTemplate = createTemplate(itemDefinition, {
  id: 'item.sword',
  fixed: { form: 'Sword', role: 'Weapon' },
  priors: {
    element: { source: 'context', affinity: 'medium', domain: ELEMENTS },
    rarity: { T1: 0.38, T2: 0.34, T3: 0.20, T4: 0.07, T5: 0.01 },
  },
});

const staffTemplate = createTemplate(itemDefinition, {
  id: 'item.staff',
  fixed: { form: 'Staff', role: 'Focus' },
  priors: {
    element: { source: 'context', affinity: 'strong', domain: ELEMENTS },
    rarity: { T1: 0.28, T2: 0.34, T3: 0.25, T4: 0.11, T5: 0.02 },
  },
});

const shieldTemplate = createTemplate(itemDefinition, {
  id: 'item.shield',
  fixed: { form: 'Shield', role: 'Defense' },
  priors: {
    element: { source: 'context', affinity: 'medium', domain: ELEMENTS },
    rarity: { T1: 0.34, T2: 0.36, T3: 0.21, T4: 0.08, T5: 0.01 },
  },
});

const swampTemplate = createTemplate(biomeDefinition, {
  id: 'biome.swamp',
  fixed: { terrain: 'Swamp' },
  priors: {
    element: { Water: 0.48, Ground: 0.30, Chaos: 0.12, Void: 0.10 },
    rarity: { T1: 0.45, T2: 0.35, T3: 0.15, T4: 0.04, T5: 0.01 },
  },
});

const desertTemplate = createTemplate(biomeDefinition, {
  id: 'biome.desert',
  fixed: { terrain: 'Desert' },
  priors: {
    element: { Fire: 0.45, Ground: 0.33, Sky: 0.15, Chaos: 0.07 },
    rarity: { T1: 0.42, T2: 0.36, T3: 0.16, T4: 0.05, T5: 0.01 },
  },
});

const mountainsTemplate = createTemplate(biomeDefinition, {
  id: 'biome.mountains',
  fixed: { terrain: 'Mountains' },
  priors: {
    element: { Ground: 0.50, Sky: 0.25, Fire: 0.15, Water: 0.10 },
    rarity: { T1: 0.30, T2: 0.35, T3: 0.23, T4: 0.10, T5: 0.02 },
  },
});

const caveTemplate = createTemplate(packDefinition, {
  id: 'pack.cave',
  fixed: { form: 'Cave', topology: 'entrance/interior/depth' },
  slots: {
    guardian: { accepts: 'Artifact/Persona', candidates: { 'persona.bear': 0.46, 'persona.bandit': 0.36, 'persona.dragon': 0.18 } },
    treasure: { accepts: 'Artifact/Item', candidates: { 'item.staff': 0.42, 'item.sword': 0.34, 'item.shield': 0.24 } },
  },
  rules: { relations: ['guardian inhabits situation', 'treasure present in situation'] },
});

const ruinTemplate = createTemplate(packDefinition, {
  id: 'pack.ruin',
  fixed: { form: 'Ruin', topology: 'threshold/chambers/remains' },
  slots: {
    guardian: { accepts: 'Artifact/Persona', candidates: { 'persona.bandit': 0.56, 'persona.bear': 0.25, 'persona.dragon': 0.19 } },
    treasure: { accepts: 'Artifact/Item', candidates: { 'item.sword': 0.45, 'item.shield': 0.35, 'item.staff': 0.20 } },
  },
  rules: { relations: ['guardian occupies situation', 'treasure hidden in situation'] },
});

const spireTemplate = createTemplate(packDefinition, {
  id: 'pack.spire',
  fixed: { form: 'Spire', topology: 'base/ascent/summit' },
  slots: {
    guardian: { accepts: 'Artifact/Persona', candidates: { 'persona.dragon': 0.66, 'persona.bandit': 0.20, 'persona.bear': 0.14 } },
    treasure: { accepts: 'Artifact/Item', candidates: { 'item.shield': 0.40, 'item.staff': 0.35, 'item.sword': 0.25 } },
  },
  rules: { relations: ['guardian guards situation', 'treasure belongs to situation'] },
});

const templates = Object.freeze(Object.fromEntries([
  banditTemplate, bearTemplate, dragonTemplate,
  swordTemplate, staffTemplate, shieldTemplate,
  swampTemplate, desertTemplate, mountainsTemplate,
  caveTemplate, ruinTemplate, spireTemplate,
].map((template) => [template.id, template])));

function normalize(weights) {
  const keys = Object.keys(weights);
  const total = keys.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);
  if (!total) return Object.fromEntries(keys.map((key) => [key, 1 / keys.length]));
  return Object.fromEntries(keys.map((key) => [key, Math.max(0, weights[key]) / total]));
}

function regionElementField(region, affinity = 'medium') {
  const multiplier = affinity === 'strong' ? 3.0 : affinity === 'weak' ? 1.1 : 2.0;
  return normalize(Object.fromEntries(ELEMENTS.map((element) => [
    element,
    0.20 + (region?.attributes?.[element] ?? 0) * multiplier,
  ])));
}

function referenceTemplate(template, { id, boundary = {}, region = null } = {}) {
  return createReference(template, {
    id: id ?? `${template.id}@reference`,
    boundary,
    context: region ? { region } : {},
  });
}

function virtualizeSimple(template, reference) {
  if (template.grammar === 'Pack/Situation') {
    return createVirtual(reference, {
      id: `${reference.id}@virtual`,
      fixed: template.fixed,
      slots: Object.fromEntries(Object.entries(template.slots).map(([slot, spec]) => [slot, {
        state: 'virtual',
        accepts: spec.accepts,
        candidates: spec.candidates,
      }])),
      lineage: [
        { stage: 'definition', id: template.definitionId },
        { stage: 'template', id: template.id },
        { stage: 'reference', id: reference.id },
      ],
    });
  }

  const region = reference.context?.region;
  const elementPrior = template.priors.element;
  const element = elementPrior?.source === 'context'
    ? regionElementField(region, elementPrior.affinity)
    : normalize(Object.fromEntries(ELEMENTS.map((name) => [name, elementPrior?.[name] ?? 0])));
  const ranges = template.grammar === 'Artifact/Persona'
    ? { constitution: [8, 34], output: [5, 30], movement: [3, 8] }
    : template.grammar === 'Artifact/Item'
      ? { power: [5, 30], durability: [12, 55] }
      : { resourcePressure: [1, 10] };

  return createVirtual(reference, {
    id: `${reference.id}@virtual`,
    fixed: template.fixed,
    possibilities: { element, rarity: template.priors.rarity },
    ranges,
    slots: template.slots,
    lineage: [
      { stage: 'definition', id: template.definitionId },
      { stage: 'template', id: template.id },
      { stage: 'reference', id: reference.id },
    ],
  });
}

function realizeSimple(template, virtual, seed) {
  const element = pickWeighted(seed, `${virtual.id}:element`, virtual.possibilities.element);
  const rarity = pickWeighted(seed, `${virtual.id}:rarity`, virtual.possibilities.rarity);
  const tier = Number(rarity.slice(1));
  const suffix = hash64(seed, virtual.id, 'instance').toString(16).padStart(16, '0').slice(-8);

  if (template.grammar === 'Artifact/Biome') {
    return createInstance(virtual, {
      id: `${template.fixed.terrain.toLowerCase()}-${suffix}`,
      properties: template.fixed,
      attributes: { primaryElement: element, field: virtual.possibilities.element },
      rarity,
      stats: { resourcePressure: 2 + tier * 1.5 },
      slots: virtual.slots,
      lineage: [...virtual.lineage, { stage: 'virtual', id: virtual.id }],
    });
  }

  if (template.grammar === 'Artifact/Item') {
    const formBonus = template.fixed.form === 'Sword' ? 3 : template.fixed.form === 'Staff' ? 2 : 1;
    return createInstance(virtual, {
      id: `${template.fixed.form.toLowerCase()}-${suffix}`,
      properties: template.fixed,
      attributes: { element },
      rarity,
      stats: { power: 5 + tier * 4 + formBonus, durability: 14 + tier * 7 + (template.fixed.form === 'Shield' ? 6 : 0) },
      lineage: [...virtual.lineage, { stage: 'virtual', id: virtual.id }],
    });
  }

  if (template.grammar === 'Artifact/Persona') {
    const bear = template.id === 'persona.bear';
    const bandit = template.id === 'persona.bandit';
    return createInstance(virtual, {
      id: `${template.id.split('.')[1]}-${suffix}`,
      properties: template.fixed,
      attributes: { element },
      rarity,
      stats: {
        constitution: 8 + tier * 3 + (bear ? 6 : 0),
        output: 5 + tier * 3 + (bandit ? 2 : 0),
        movement: 3 + (bandit ? 2 : bear ? 1 : 0) + (element === 'Sky' ? 1 : 0),
      },
      lineage: [...virtual.lineage, { stage: 'virtual', id: virtual.id }],
    });
  }

  throw new Error(`unsupported simple realization grammar: ${template.grammar}`);
}

module.exports = {
  itemDefinition,
  biomeDefinition,
  packDefinition,
  templates,
  banditTemplate,
  bearTemplate,
  dragonTemplate,
  swordTemplate,
  staffTemplate,
  shieldTemplate,
  swampTemplate,
  desertTemplate,
  mountainsTemplate,
  caveTemplate,
  ruinTemplate,
  spireTemplate,
  referenceTemplate,
  virtualizeSimple,
  realizeSimple,
  regionElementField,
};
