'use strict';

const assert = require('assert');
const {
  TYPES,
  RELATIONS,
  relationGraph,
  relationsFrom,
  relationsTo,
} = require('../src/model/base-relations');
const { ARTIFACT_TYPES } = require('../src/content/generative-authoring');
const {
  clockDefinition,
  hourglassDefinition,
  clockFaceDefinition,
  clockHandDefinition,
  hourDefinition,
} = require('../src/content/instruments');
const { itemDefinition, biomeDefinition, packDefinition } = require('../src/content/catalog');

function has(subject, predicate, object, count) {
  return RELATIONS.some((edge) => (
    edge.subject === subject
    && edge.predicate === predicate
    && edge.object === object
    && edge.count === count
  ));
}

function main() {
  // Canonical relation handles bridge only to definitions/types that already exist.
  assert.ok(ARTIFACT_TYPES[TYPES.Persona.id]);
  assert.strictEqual(TYPES.Clock.sourceGrammar, clockDefinition.grammar);
  assert.strictEqual(TYPES.Hourglass.sourceGrammar, hourglassDefinition.grammar);
  assert.strictEqual(TYPES.ClockFace.sourceGrammar, clockFaceDefinition.grammar);
  assert.strictEqual(TYPES.ClockHand.sourceGrammar, clockHandDefinition.grammar);
  assert.strictEqual(TYPES.Hour.sourceGrammar, hourDefinition.grammar);
  assert.strictEqual(TYPES.Item.sourceGrammar, itemDefinition.grammar);
  assert.strictEqual(TYPES.Biome.sourceGrammar, biomeDefinition.grammar);
  assert.strictEqual(TYPES.Situation.sourceGrammar, packDefinition.grammar);

  // Existing slot topology becomes typed relations without adding semantic fields.
  assert.ok(has(TYPES.Clock.id, 'contains', TYPES.ClockFace.id, 1));
  assert.ok(has(TYPES.Clock.id, 'contains', TYPES.ClockHand.id, '1..N'));
  assert.ok(has(TYPES.Clock.id, 'contains', TYPES.Hour.id, 12));
  assert.ok(has(TYPES.Hourglass.id, 'contains', TYPES.HourglassLock.id, '0..1'));
  assert.ok(has(TYPES.Hourglass.id, 'contains', TYPES.HourglassFilter.id, '0..1'));
  assert.ok(has(TYPES.Hourglass.id, 'bound-to', TYPES.Artifact.id, 1));
  assert.ok(has(TYPES.Biome.id, 'contains', TYPES.Situation.id, '0..N'));

  // Clock and Hourglass are admitted into the Artifact relation space without
  // requiring Card.Clock or Card.Hourglass.
  assert.ok(has(TYPES.Clock.id, 'is-a', TYPES.Artifact.id, 1));
  assert.ok(has(TYPES.Hourglass.id, 'is-a', TYPES.Artifact.id, 1));
  assert.ok(!Object.values(TYPES).some((type) => /^Card\.(Clock|Hourglass|Persona|Item|Biome)$/.test(type.id)));

  const graph = relationGraph();
  assert.strictEqual(graph.type, 'Graph/Relations');
  assert.ok(graph.tuples.some((tuple) => tuple.subject === TYPES.Clock.id && tuple.predicate === 'contains' && tuple.object === TYPES.Hour.id));
  assert.ok(graph.tuples.some((tuple) => tuple.subject === TYPES.Hourglass.id && tuple.predicate === 'bound-to' && tuple.object === TYPES.Artifact.id));

  assert.strictEqual(relationsFrom(TYPES.Clock.id).filter((edge) => edge.predicate === 'contains').length, 3);
  assert.ok(relationsTo(TYPES.Artifact.id).some((edge) => edge.subject === TYPES.Persona.id));

  // This layer is topology only. Premature descriptive/gameplay dimensions stay out.
  const text = `${JSON.stringify(TYPES)}\n${JSON.stringify(RELATIONS)}`;
  for (const forbidden of [
    'bodyPlan', 'mobility', 'cognition', 'elevation', 'relief', 'moisture',
    'age', 'geometry', 'material', 'travelSpeed', 'attackSpeed',
  ]) {
    assert.ok(!new RegExp(`(^|[^A-Za-z])${forbidden}([^A-Za-z]|$)`, 'i').test(text), `${forbidden} leaked into base relations`);
  }

  console.log(JSON.stringify({
    pass: true,
    invariant: 'base relations connect existing types without inventing their meaning',
    types: Object.values(TYPES).map((type) => type.id),
    relations: RELATIONS.length,
    clockContains: relationsFrom(TYPES.Clock.id).filter((edge) => edge.predicate === 'contains').map((edge) => [edge.object, edge.count]),
    hourglassOwner: relationsFrom(TYPES.Hourglass.id).find((edge) => edge.predicate === 'bound-to'),
  }, null, 2));
}

main();
