'use strict';

const assert = require('assert');
const { ARTIFACT_KIND_IDS } = require('../src/content/token-packs');
const { createArtifactCard, one } = require('../src/content/generative-authoring');
const { collapseArtifactTopology } = require('../src/model/artifact-topology-collapse');

function cardFor(kind) {
  return createArtifactCard({
    kind: one(kind),
    elementCount: one(1),
    attributeCount: one(0),
    propertyCount: one(0),
    statCount: one(0),
  });
}

function relation(root, predicate, target) {
  return root.relations.find((edge) => edge.predicate === predicate && edge.target === target);
}

assert.ok(ARTIFACT_KIND_IDS.includes('Artifact.Persona'));
assert.ok(ARTIFACT_KIND_IDS.includes('Artifact.Clock'));
assert.ok(ARTIFACT_KIND_IDS.includes('Artifact.Hourglass'));
assert.ok(ARTIFACT_KIND_IDS.includes('Artifact.ClockFace'));
assert.ok(ARTIFACT_KIND_IDS.includes('Artifact.Hour'));

const clockCard = cardFor('Artifact.Clock');

const virtualOnly = collapseArtifactTopology({
  card: clockCard,
  seed: 93208,
  budget: { maxHops: 1, maxSlots: 14, maxInstances: 0 },
});
assert.strictEqual(virtualOnly.state, 'unresolved');
assert.strictEqual(virtualOnly.root.stage, 'virtual');
assert.strictEqual(virtualOnly.root.virtual.possibilities.kind['Artifact.Clock'], 1);
assert.strictEqual(virtualOnly.usage.instances, 0);
assert.strictEqual(virtualOnly.stops[0].reason, 'budget.maxInstances');

const rootOnly = collapseArtifactTopology({
  card: clockCard,
  seed: 93208,
  budget: { maxHops: 0, maxSlots: 14, maxInstances: 15 },
});
assert.strictEqual(rootOnly.root.stage, 'instance');
assert.strictEqual(rootOnly.root.instance.kind, 'Artifact.Clock');
assert.strictEqual(rootOnly.usage.instances, 1);
assert.strictEqual(rootOnly.usage.slots, 0);
assert.ok(rootOnly.stops.every((stop) => stop.reason === 'budget.maxHops'));
assert.strictEqual(relation(rootOnly.root, 'contains', 'Artifact.ClockFace').frontier.length, 1);
assert.strictEqual(relation(rootOnly.root, 'contains', 'Artifact.ClockHand').frontier.length, 1);
assert.strictEqual(relation(rootOnly.root, 'contains', 'Artifact.Hour').frontier.length, 12);

const slotLimited = collapseArtifactTopology({
  card: clockCard,
  seed: 93208,
  budget: { maxHops: 1, maxSlots: 2, maxInstances: 15 },
});
const faceLimited = relation(slotLimited.root, 'contains', 'Artifact.ClockFace');
const handLimited = relation(slotLimited.root, 'contains', 'Artifact.ClockHand');
const hoursLimited = relation(slotLimited.root, 'contains', 'Artifact.Hour');
assert.strictEqual(faceLimited.children.length, 1);
assert.strictEqual(handLimited.children.length, 1);
assert.strictEqual(hoursLimited.children.length, 0);
assert.strictEqual(hoursLimited.frontier.length, 12);
assert.ok(hoursLimited.frontier.every((entry) => entry.reason === 'budget.maxSlots'));
assert.deepStrictEqual(slotLimited.usage, { maxHopReached: 1, slots: 2, instances: 3 });

const fullClock = collapseArtifactTopology({
  card: clockCard,
  seed: 93208,
  budget: { maxHops: 1, maxSlots: 14, maxInstances: 15 },
});
assert.strictEqual(fullClock.state, 'resolved');
assert.deepStrictEqual(fullClock.usage, { maxHopReached: 1, slots: 14, instances: 15 });
const face = relation(fullClock.root, 'contains', 'Artifact.ClockFace');
const hand = relation(fullClock.root, 'contains', 'Artifact.ClockHand');
const hours = relation(fullClock.root, 'contains', 'Artifact.Hour');
assert.strictEqual(face.state, 'resolved');
assert.strictEqual(hand.state, 'resolved');
assert.strictEqual(hours.state, 'resolved');
assert.strictEqual(hours.children.length, 12);
assert.ok(hours.children.every((child) => child.instance.kind === 'Artifact.Hour'));
const ids = [
  fullClock.root.instance.id,
  face.children[0].instance.id,
  hand.children[0].instance.id,
  ...hours.children.map((child) => child.instance.id),
];
assert.strictEqual(new Set(ids).size, ids.length, 'collapse addresses must produce unique Artifact identities');

const hourglass = collapseArtifactTopology({
  card: cardFor('Artifact.Hourglass'),
  seed: 93208,
  budget: { maxHops: 2, maxSlots: 8, maxInstances: 8 },
});
assert.strictEqual(hourglass.state, 'resolved');
assert.strictEqual(hourglass.root.instance.kind, 'Artifact.Hourglass');
assert.strictEqual(relation(hourglass.root, 'contains', 'Artifact.HourglassLock').state, 'open');
assert.strictEqual(relation(hourglass.root, 'contains', 'Artifact.HourglassFilter').state, 'open');
assert.strictEqual(relation(hourglass.root, 'bound-to', 'Artifact').state, 'open');
assert.deepStrictEqual(hourglass.usage, { maxHopReached: 0, slots: 0, instances: 1 });

console.log(JSON.stringify({
  pass: true,
  invariant: 'Card.Artifact spends budget through admitted Artifact relations',
  admittedKinds: ARTIFACT_KIND_IDS,
  clock: {
    rootOnlyStops: rootOnly.stops.length,
    slotLimited: slotLimited.usage,
    full: fullClock.usage,
    uniqueInstances: ids.length,
  },
  hourglass: {
    relations: hourglass.root.relations.map((edge) => ({
      predicate: edge.predicate,
      target: edge.target,
      count: edge.count,
      state: edge.state,
    })),
  },
}, null, 2));
