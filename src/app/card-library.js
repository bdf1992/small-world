'use strict';

const { hash64, pickWeighted } = require('../kernel/address');
const { createTemplate, createReference, createVirtual, createInstance } = require('../model/lifecycle');
const { personaDefinition, ELEMENTS } = require('../content/personas/dragon');
const { itemDefinition, biomeDefinition } = require('../content/catalog');

const DEFINITIONS = Object.freeze({
  'Artifact/Persona': personaDefinition,
  'Artifact/Item': itemDefinition,
  'Artifact/Biome': biomeDefinition,
});

const AFFINITIES = Object.freeze(['weak', 'medium', 'strong']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'card';
}

function normalize(weights) {
  const entries = Object.entries(weights ?? {});
  const total = entries.reduce((sum, [, value]) => sum + Math.max(0, Number(value) || 0), 0);
  if (!entries.length || total <= 0) throw new Error('weighted possibility must retain at least one supported candidate');
  return Object.fromEntries(entries.map(([key, value]) => [key, Math.max(0, Number(value) || 0) / total]));
}

function definitionFor(grammar) {
  const definition = DEFINITIONS[grammar];
  if (!definition) throw new Error(`unsupported Card grammar: ${grammar}`);
  return definition;
}

function defaultCardDraft({ grammar = 'Artifact/Persona', id = 'persona.new-card' } = {}) {
  const definition = definitionFor(grammar);
  if (grammar === 'Artifact/Persona') {
    return {
      id,
      grammar,
      fixed: { species: 'New Persona' },
      priors: {
        element: { source: 'context', affinity: 'medium', domain: [...ELEMENTS] },
        rarity: { T1: 0.30, T2: 0.30, T3: 0.20, T4: 0.15, T5: 0.05 },
      },
      rules: {},
      slots: clone(definition.slots),
    };
  }
  if (grammar === 'Artifact/Item') {
    return {
      id,
      grammar,
      fixed: { form: 'New Item' },
      priors: {
        element: { source: 'context', affinity: 'medium', domain: [...ELEMENTS] },
        rarity: { T1: 0.35, T2: 0.30, T3: 0.20, T4: 0.10, T5: 0.05 },
      },
      rules: {},
      slots: clone(definition.slots),
    };
  }
  return {
    id,
    grammar,
    fixed: { terrain: 'New Biome' },
    priors: {
      element: Object.fromEntries(ELEMENTS.map((element) => [element, element === 'Ground' ? 1 : 0])),
      rarity: { T1: 0.40, T2: 0.30, T3: 0.20, T4: 0.08, T5: 0.02 },
    },
    rules: {},
    slots: clone(definition.slots),
  };
}

function cardDraftFromTemplate(template) {
  definitionFor(template.grammar);
  return {
    id: template.id,
    grammar: template.grammar,
    fixed: clone(template.fixed ?? {}),
    priors: clone(template.priors ?? {}),
    rules: clone(template.rules ?? {}),
    slots: clone(template.slots ?? {}),
  };
}

function validateCardDraft(draft, { existingIds = [] } = {}) {
  const errors = [];
  if (!draft?.id || !/^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/.test(draft.id)) {
    errors.push('Card id must be a dotted lowercase identifier, e.g. persona.ice-dragon');
  }
  let definition = null;
  try { definition = definitionFor(draft?.grammar); } catch (error) { errors.push(error.message); }
  if (existingIds.filter((id) => id === draft?.id).length > 1) errors.push(`duplicate Card id: ${draft.id}`);

  if (definition) {
    for (const [name, dimension] of Object.entries(definition.dimensions ?? {})) {
      if (!dimension.required) continue;
      const supplied = draft.fixed?.[name] ?? draft.priors?.[name];
      if (supplied === undefined || supplied === null || supplied === '') errors.push(`required field is missing: ${name}`);
    }
  }

  for (const [field, prior] of Object.entries(draft?.priors ?? {})) {
    if (prior?.source === 'context') {
      if (!AFFINITIES.includes(prior.affinity)) errors.push(`${field} contextual affinity must be weak, medium, or strong`);
      if (!Array.isArray(prior.domain) || !prior.domain.length) errors.push(`${field} contextual prior requires a non-empty domain`);
      continue;
    }
    const entries = Object.entries(prior ?? {});
    if (!entries.length) errors.push(`${field} weighted prior requires candidates`);
    if (entries.some(([, weight]) => !Number.isFinite(Number(weight)) || Number(weight) < 0)) errors.push(`${field} weights must be non-negative finite numbers`);
    if (entries.length && !entries.some(([, weight]) => Number(weight) > 0)) errors.push(`${field} weighted prior must retain support`);
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

function buildCardTemplate(draft) {
  const validation = validateCardDraft(draft);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  const definition = definitionFor(draft.grammar);
  return createTemplate(definition, {
    id: draft.id,
    fixed: clone(draft.fixed),
    priors: clone(draft.priors),
    rules: clone(draft.rules),
    slots: clone(draft.slots),
  });
}

function contextualWeights(spec, region) {
  const multiplier = spec.affinity === 'strong' ? 3.0 : spec.affinity === 'weak' ? 1.1 : 2.0;
  const attributes = region?.attributes ?? {};
  return normalize(Object.fromEntries((spec.domain ?? []).map((candidate) => [
    candidate,
    0.20 + (attributes[candidate] ?? 0) * multiplier,
  ])));
}

function virtualizeCard(template, reference) {
  const possibilities = {};
  for (const [field, prior] of Object.entries(template.priors ?? {})) {
    possibilities[field] = prior?.source === 'context'
      ? contextualWeights(prior, reference.context?.region)
      : normalize(prior);
  }
  return createVirtual(reference, {
    id: `${reference.id}@virtual`,
    fixed: template.fixed,
    possibilities,
    slots: Object.fromEntries(Object.entries(template.slots ?? {}).map(([name, spec]) => [name, { state: 'virtual', ...spec }])),
    lineage: [
      { stage: 'definition', id: template.definitionId },
      { stage: 'template', id: template.id },
      { stage: 'reference', id: reference.id },
    ],
  });
}

function realizeCard(template, virtual, seed) {
  const definition = definitionFor(template.grammar);
  const settled = Object.fromEntries(Object.entries(virtual.possibilities ?? {}).map(([field, weights]) => [
    field,
    pickWeighted(seed, `${virtual.id}:${field}`, weights),
  ]));
  const properties = { ...template.fixed };
  const attributes = {};
  let rarity = settled.rarity ?? null;

  for (const [field, value] of Object.entries(settled)) {
    if (field === 'rarity') continue;
    const dimension = definition.dimensions?.[field];
    if (dimension?.kind === 'attribute') attributes[field] = value;
    else properties[field] = value;
  }

  const tier = rarity && /^T\d+$/.test(rarity) ? Number(rarity.slice(1)) : 1;
  const element = attributes.element ?? null;
  let stats = {};
  if (template.grammar === 'Artifact/Persona') {
    stats = {
      constitution: 8 + tier * 3 + (element === 'Ground' ? 3 : 0),
      elementalOutput: 5 + tier * 3 + (element === 'Fire' ? 3 : 0),
      movement: 3 + (element === 'Sky' ? 2 : 0),
    };
  } else if (template.grammar === 'Artifact/Item') {
    stats = { power: 5 + tier * 4, durability: 14 + tier * 7 };
  } else if (template.grammar === 'Artifact/Biome') {
    stats = { resourcePressure: 2 + tier * 1.5 };
  }

  const identity = properties.species ?? properties.form ?? properties.terrain ?? template.id.split('.').pop();
  const suffix = hash64(seed, virtual.id, 'instance').toString(16).padStart(16, '0').slice(-8);
  return createInstance(virtual, {
    id: `${slug(identity)}-${suffix}`,
    properties,
    attributes,
    rarity,
    stats,
    slots: virtual.slots,
    lineage: [...virtual.lineage, { stage: 'virtual', id: virtual.id }],
  });
}

function resolveCardDraft(draft, { seed = 93208, region = null } = {}) {
  const template = buildCardTemplate(draft);
  const reference = createReference(template, {
    id: `card-preview:${template.id}`,
    boundary: { role: 'card-preview', region: region?.id ?? null },
    context: region ? { region } : {},
  });
  const virtual = virtualizeCard(template, reference);
  const instance = realizeCard(template, virtual, seed);
  return Object.freeze({ template, reference, virtual, instance });
}

module.exports = {
  DEFINITIONS,
  AFFINITIES,
  defaultCardDraft,
  cardDraftFromTemplate,
  validateCardDraft,
  buildCardTemplate,
  resolveCardDraft,
};
