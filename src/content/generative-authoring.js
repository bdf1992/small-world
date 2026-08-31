'use strict';

const { hash64, pickWeighted } = require('../kernel/address');
const {
  createDefinition,
  createTemplate,
  createReference,
  createVirtual,
  createInstance,
} = require('../model/lifecycle');
const { TYPES, relationsTo } = require('../model/base-relations');
const { ELEMENT_RING } = require('../model/elemental-profile');
const { ARTIFACT_KIND_PACK, weightsFor } = require('./token-packs');

const ELEMENTS = ELEMENT_RING;
const GENERIC_CONTRACT = Object.freeze(['Elements', 'Attributes', 'Properties', 'Stats']);

const artifactDefinition = createDefinition({
  id: 'Artifact',
  grammar: 'Artifact',
  sections: GENERIC_CONTRACT,
  dimensions: {
    elements: { kind: 'Attribute', count: '1..8' },
    attributes: { kind: 'Attribute', count: '0..N' },
    properties: { kind: 'Property', count: '0..N' },
    stats: { kind: 'Stat', count: '0..N' },
  },
});

const typeById = Object.freeze(Object.fromEntries(
  Object.values(TYPES).map((type) => [type.id, type]),
));

// Artifact types come from the admitted relation topology. A type contract does
// not imply a matching Card; Card.Artifact remains the sole generator here.
const ARTIFACT_TYPES = Object.freeze(Object.fromEntries(
  relationsTo(TYPES.Artifact.id)
    .filter((edge) => edge.predicate === 'is-a')
    .map((edge) => [edge.subject, Object.freeze({
      kind: 'ArtifactType',
      id: edge.subject,
      parent: TYPES.Artifact.id,
      sourceGrammar: typeById[edge.subject]?.sourceGrammar ?? null,
      contract: GENERIC_CONTRACT,
    })]),
));

function one(value) { return { [String(value)]: 1 }; }
function uniform(values) { return Object.fromEntries(values.map((value) => [String(value), 1])); }
function countWeights(min, max) {
  const values = [];
  for (let value = min; value <= max; value += 1) values.push(value);
  return uniform(values);
}
function normalize(weights) {
  const entries = Object.entries(weights ?? {});
  const total = entries.reduce((sum, [, value]) => sum + Math.max(0, Number(value) || 0), 0);
  if (!entries.length || total <= 0) throw new Error('weighted possibility requires support');
  return Object.fromEntries(entries.map(([key, value]) => [key, Math.max(0, Number(value) || 0) / total]));
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function createArtifactCard(spec = {}) {
  return createTemplate(artifactDefinition, {
    id: spec.id ?? 'Card.Artifact',
    fixed: {},
    priors: {
      kind: normalize(spec.kind ?? weightsFor(ARTIFACT_KIND_PACK)),
      elementCount: normalize(spec.elementCount ?? countWeights(1, ELEMENTS.length)),
      attributeCount: normalize(spec.attributeCount ?? countWeights(0, 3)),
      propertyCount: normalize(spec.propertyCount ?? countWeights(0, 3)),
      statCount: normalize(spec.statCount ?? countWeights(0, 3)),
    },
    rules: {},
    slots: {},
  });
}

const CARD_ARTIFACT = createArtifactCard();

function elementalProfile(input = {}) {
  const supplied = Object.fromEntries(ELEMENTS.map((element) => [element, Number(input[element] ?? 0)]));
  if (Object.values(supplied).some((value) => value > 0)) return normalize(supplied);
  return normalize(Object.fromEntries(ELEMENTS.map((element) => [element, 1])));
}

function virtualizeArtifact(card, reference, { elements = {} } = {}) {
  if (card?.id !== reference?.templateId) throw new Error('Card.Artifact reference/template mismatch');
  return createVirtual(reference, {
    id: `${reference.id}@virtual`,
    fixed: {},
    possibilities: {
      kind: clone(card.priors.kind),
      elementCount: clone(card.priors.elementCount),
      attributeCount: clone(card.priors.attributeCount),
      propertyCount: clone(card.priors.propertyCount),
      statCount: clone(card.priors.statCount),
      elements: elementalProfile(elements),
    },
    lineage: [
      { stage: 'definition', id: card.definitionId },
      { stage: 'template', id: card.id },
      { stage: 'reference', id: reference.id },
    ],
  });
}

function pickCount(seed, virtual, field) {
  return Number(pickWeighted(seed, `${virtual.id}:${field}`, virtual.possibilities[field]));
}

function pickElements(seed, virtual, count) {
  const remaining = { ...virtual.possibilities.elements };
  const selected = [];
  for (let index = 0; index < Math.min(count, ELEMENTS.length); index += 1) {
    const element = pickWeighted(seed, `${virtual.id}:element:${index}`, remaining);
    selected.push(Object.freeze({ element, weight: virtual.possibilities.elements[element] }));
    delete remaining[element];
  }
  return Object.freeze(selected);
}

function genericSlots(kind, count) {
  return Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
    kind,
    id: `${kind}.${index + 1}`,
  })));
}

function realizeArtifact(card, virtual, seed) {
  if (virtual?.templateId !== card?.id || virtual?.stage !== 'virtual') {
    throw new Error('realizeArtifact requires a Virtual from Card.Artifact');
  }
  const artifactKind = pickWeighted(seed, `${virtual.id}:kind`, virtual.possibilities.kind);
  if (!ARTIFACT_TYPES[artifactKind]) throw new Error(`unknown Artifact kind: ${artifactKind}`);

  const counts = Object.freeze({
    elements: pickCount(seed, virtual, 'elementCount'),
    attributes: pickCount(seed, virtual, 'attributeCount'),
    properties: pickCount(seed, virtual, 'propertyCount'),
    stats: pickCount(seed, virtual, 'statCount'),
  });
  const suffix = hash64(seed, virtual.id, artifactKind).toString(16).padStart(16, '0').slice(-8);

  return createInstance(virtual, {
    id: `artifact-${artifactKind.split('.').pop().toLowerCase()}-${suffix}`,
    kind: artifactKind,
    elements: pickElements(seed, virtual, counts.elements),
    attributes: genericSlots('Attribute', counts.attributes),
    properties: genericSlots('Property', counts.properties),
    stats: genericSlots('Stat', counts.stats),
    counts,
    lineage: [...virtual.lineage, { stage: 'virtual', id: virtual.id }],
  });
}

function resolveArtifactCard(card = CARD_ARTIFACT, {
  seed = 93208,
  id = 'Card.Artifact@reference',
  elements = {},
} = {}) {
  const reference = createReference(card, { id, context: { elements } });
  const virtual = virtualizeArtifact(card, reference, { elements });
  const instance = realizeArtifact(card, virtual, seed);
  return Object.freeze({ card, reference, virtual, instance });
}

module.exports = {
  ELEMENTS,
  GENERIC_CONTRACT,
  artifactDefinition,
  ARTIFACT_TYPES,
  CARD_ARTIFACT,
  createArtifactCard,
  elementalProfile,
  virtualizeArtifact,
  realizeArtifact,
  resolveArtifactCard,
  one,
  uniform,
};
