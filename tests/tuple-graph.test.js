'use strict';

const assert = require('assert');
const {
  createTuple,
  createGraph,
  createRequirement,
  createSignal,
  createInfluence,
  outgoing,
  byFamily,
  rootedTree,
} = require('../src/model/tuple-graph');
const { createAuthoringProjection } = require('../src/app/authoring');

function tuple(graph, subject, predicate, object) {
  return graph.tuples.find((candidate) => (
    candidate.subject === subject
    && candidate.predicate === predicate
    && (object === undefined || candidate.object === object)
  ));
}

function main() {
  const tiny = createGraph({
    id: 'tiny',
    type: 'Test',
    root: 'A',
    tuples: [
      createTuple({ subject: 'A', predicate: 'contains', object: 'B' }),
      createTuple({ subject: 'B', predicate: 'requires', object: 'R' }),
    ],
  });
  assert.strictEqual(outgoing(tiny, 'A')[0].object, 'B');
  assert.strictEqual(byFamily(tiny, 'constraint').length, 1);
  assert.strictEqual(rootedTree(tiny).edges[0].child.id, 'B');

  const requirement = createRequirement({ id: 'req:guardian', subject: 'slot:guardian', expects: 'Persona' });
  assert.ok(tuple(requirement, 'slot:guardian', 'requires', 'req:guardian'));
  assert.ok(tuple(requirement, 'req:guardian', 'accepts', 'Persona'));

  const signal = createSignal({ id: 'signal:fire', kind: 'ElementPressure', source: 'Volcano', target: 'Glacier', magnitude: 0.7 });
  assert.ok(tuple(signal, 'Volcano', 'emits', 'signal:fire'));
  assert.ok(tuple(signal, 'signal:fire', 'targets', 'Glacier'));
  assert.ok(!tuple(signal, 'signal:fire', 'influences', 'Glacier'));

  const influence = createInfluence({ id: 'influence:fire', source: 'signal:fire', target: 'Glacier.element', magnitude: 0.7 });
  const influenceEdge = tuple(influence, 'signal:fire', 'influences', 'Glacier.element');
  assert.ok(influenceEdge);
  assert.strictEqual(influenceEdge.qualifiers.magnitude, 0.7);

  const projection = createAuthoringProjection({ seed: 93208 });
  assert.strictEqual(projection.projectionVersion, 1);
  assert.strictEqual(projection.views.card.root, 'persona.dragon');
  assert.strictEqual(projection.views.card.type, 'Card');
  assert.strictEqual(projection.views.pack.root, 'pack.spire');
  assert.strictEqual(projection.views.pack.type, 'Pack');

  const card = projection.views.card;
  const dragonElement = 'persona.dragon.possibility.element';
  assert.ok(tuple(card, 'persona.dragon', 'possibility', dragonElement));
  const elementRequirement = outgoing(card, dragonElement, 'requires')[0];
  assert.ok(elementRequirement, 'contextual element should expose a Requirement');
  assert.match(String(elementRequirement.object), /requirement\.element-field$/);
  assert.ok(tuple(card, elementRequirement.object, 'accepts', 'Signal<ElementField>'));
  assert.ok(!card.tuples.some((entry) => String(entry.object).includes('ContextRequirement')));

  const pack = projection.views.pack;
  const guardian = 'pack.spire.slot.guardian';
  assert.ok(tuple(pack, 'pack.spire', 'slot', guardian));
  const guardianRequirement = outgoing(pack, guardian, 'requires')[0];
  assert.ok(guardianRequirement);
  assert.ok(tuple(pack, guardianRequirement.object, 'accepts', 'Artifact/Persona'));
  const dragonCandidate = tuple(pack, guardian, 'candidate', 'persona.dragon');
  assert.ok(dragonCandidate);
  assert.strictEqual(dragonCandidate.qualifiers.weight, 0.66);

  const graph = projection.views.graph;
  const fieldSignal = 'signal:mountains:element-field';
  assert.ok(tuple(graph, 'region.mountains', 'emits', fieldSignal));
  assert.ok(tuple(graph, fieldSignal, 'is-a', 'Signal<ElementField>'));
  assert.ok(tuple(graph, fieldSignal, 'targets', dragonElement));
  const contextualInfluence = tuple(graph, fieldSignal, 'influences', dragonElement);
  assert.ok(contextualInfluence, 'Signal should influence the unresolved Dragon element');
  assert.strictEqual(contextualInfluence.family, 'dynamic');

  assert.ok(projection.trees.card.edges.length > 0);
  assert.ok(projection.trees.pack.edges.length > 0);
  assert.strictEqual(projection.trees.card.id, card.root);

  const resolution = projection.views.resolution;
  assert.strictEqual(resolution.type, 'Resolution');
  assert.ok(resolution.tuples.some((entry) => entry.predicate === 'resolves-to'));
  assert.ok(resolution.tuples.some((entry) => entry.predicate === 'contains'));
  assert.strictEqual(projection.views.world.status, 'resolved');
  assert.ok(projection.views.world.objects['region:mountains']);

  const keys = new Set();
  for (const entry of graph.tuples) {
    const key = `${JSON.stringify(entry.subject)}|${entry.predicate}|${JSON.stringify(entry.object)}`;
    assert.ok(!keys.has(key), `duplicate tuple ${key}`);
    keys.add(key);
  }

  const roundTrip = JSON.parse(JSON.stringify(projection));
  assert.strictEqual(roundTrip.views.card.root, 'persona.dragon');
  assert.strictEqual(roundTrip.views.pack.root, 'pack.spire');

  console.log(JSON.stringify({
    pass: true,
    cardTuples: card.tuples.length,
    packTuples: pack.tuples.length,
    scenarioTuples: graph.tuples.length,
    resolutionTuples: resolution.tuples.length,
    requirements: graph.tuples.filter((entry) => entry.predicate === 'requires').length,
    signals: graph.tuples.filter((entry) => entry.predicate === 'emits').length,
    influences: graph.tuples.filter((entry) => entry.predicate === 'influences').length,
  }, null, 2));
}

main();
