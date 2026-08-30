'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ELEMENTS,
  ARTIFACT_TYPES,
  CARD_ARTIFACT,
  createArtifactCard,
  resolveArtifactCard,
  one,
} = require('../src/content/generative-authoring');
const { TOKENS, ARTIFACT_KIND_PACK } = require('../src/content/token-packs');

function source(...parts) {
  return fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function containsIdentifier(text, identifier) {
  return new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(identifier)}([^A-Za-z0-9_]|$)`).test(text);
}

function main() {
  assert.strictEqual(CARD_ARTIFACT.id, 'Card.Artifact');
  assert.strictEqual(CARD_ARTIFACT.grammar, 'Artifact');
  assert.deepStrictEqual(CARD_ARTIFACT.fixed, {});

  assert.ok(ARTIFACT_TYPES['Artifact.Persona']);
  assert.strictEqual(ARTIFACT_TYPES['Artifact.Persona'].parent, 'Artifact');
  assert.deepStrictEqual(
    ARTIFACT_TYPES['Artifact.Persona'].contract,
    ['Elements', 'Attributes', 'Properties', 'Stats'],
  );

  assert.strictEqual(TOKENS.artifactPersona.id, 'Artifact.Persona');
  assert.strictEqual(ARTIFACT_KIND_PACK.accepts, 'Artifact');
  assert.deepStrictEqual(
    ARTIFACT_KIND_PACK.entries.map((entry) => entry.token.id),
    ['Artifact.Persona'],
  );

  const card = createArtifactCard({
    elementCount: one(3),
    attributeCount: one(2),
    propertyCount: one(1),
    statCount: one(2),
  });
  assert.strictEqual(card.id, 'Card.Artifact');

  const resolved = resolveArtifactCard(card, {
    seed: 93208,
    id: 'proof.artifact',
    elements: {
      Fire: 0.35,
      Ground: 0.30,
      Sky: 0.20,
      Water: 0.15,
    },
  });

  assert.strictEqual(resolved.virtual.stage, 'virtual');
  assert.deepStrictEqual(
    Object.keys(resolved.virtual.possibilities).sort(),
    ['attributeCount', 'elementCount', 'elements', 'kind', 'propertyCount', 'statCount'].sort(),
  );

  const artifact = resolved.instance;
  assert.strictEqual(artifact.stage, 'instance');
  assert.strictEqual(artifact.kind, 'Artifact.Persona');
  assert.strictEqual(artifact.templateId, 'Card.Artifact');
  assert.strictEqual(artifact.grammar, 'Artifact');
  assert.deepStrictEqual(artifact.counts, {
    elements: 3,
    attributes: 2,
    properties: 1,
    stats: 2,
  });
  assert.strictEqual(artifact.elements.length, 3);
  assert.strictEqual(new Set(artifact.elements.map((entry) => entry.element)).size, 3);
  assert.ok(artifact.elements.every((entry) => ELEMENTS.includes(entry.element)));
  assert.ok(artifact.elements.every((entry) => Number.isFinite(entry.weight)));
  assert.deepStrictEqual(artifact.attributes, [
    { kind: 'Attribute', id: 'Attribute.1' },
    { kind: 'Attribute', id: 'Attribute.2' },
  ]);
  assert.deepStrictEqual(artifact.properties, [
    { kind: 'Property', id: 'Property.1' },
  ]);
  assert.deepStrictEqual(artifact.stats, [
    { kind: 'Stat', id: 'Stat.1' },
    { kind: 'Stat', id: 'Stat.2' },
  ]);

  const activeModel = `${source('src', 'content', 'generative-authoring.js')}\n${source('src', 'content', 'token-packs.js')}`;
  const forbidden = [
    'bodyPlan', 'mobility', 'cognition', 'elevation', 'relief', 'moisture', 'age',
    'geometry', 'material', 'rarity', 'constitution', 'durability',
    'Card.Persona', 'card.persona', 'Card.Item', 'card.item', 'Card.Biome', 'card.biome',
    'Dragon', 'Mantis', 'Lantern', 'Observatory',
  ];
  for (const term of forbidden) {
    assert.ok(!containsIdentifier(activeModel, term), `premature semantic field leaked into active minimal model: ${term}`);
  }

  console.log(JSON.stringify({
    pass: true,
    invariant: 'Card.Artifact generates Artifact; Artifact.Persona is a type, not a Card',
    universalShape: ['Elements', 'Attributes', 'Properties', 'Stats'],
    card: CARD_ARTIFACT.id,
    admittedKinds: Object.keys(ARTIFACT_TYPES),
    proof: {
      kind: artifact.kind,
      counts: artifact.counts,
      elements: artifact.elements,
    },
    prematureSemanticFields: 0,
  }, null, 2));
}

main();
