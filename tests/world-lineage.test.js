'use strict';

const assert = require('assert');
const { createResolutionAuthoringSession } = require('../src/app/resolution-session');

function mountainsSituation(snapshot) {
  const mountains = snapshot.views.world.objects['region:mountains'];
  assert.ok(mountains, 'mountains region missing');
  assert.ok(mountains.children[0], 'mountains situation missing');
  return snapshot.views.world.objects[mountains.children[0].key];
}

function roleObject(snapshot, role) {
  const situation = mountainsSituation(snapshot);
  const child = situation.children.find((candidate) => candidate.role === role);
  assert.ok(child, `${role} member missing`);
  const object = snapshot.views.world.objects[child.key];
  assert.ok(object, `${role} object missing`);
  return object;
}

function tuple(graph, subject, predicate, object = undefined) {
  return graph.tuples.find((entry) => entry.subject === subject
    && entry.predicate === predicate
    && (object === undefined || entry.object === object));
}

function main() {
  const session = createResolutionAuthoringSession({ seed: 93208 });
  session.cloneCard({ cardId: 'persona.dragon', newId: 'persona.ice-dragon' });
  session.setCardFixed({ cardId: 'persona.ice-dragon', field: 'species', value: 'Ice Dragon' });
  session.connectCard({ slot: 'guardian', cardId: 'persona.ice-dragon', weight: 1 });
  const authored = session.focusPackCandidate({ slot: 'guardian', cardId: 'persona.ice-dragon' });

  assert.strictEqual(authored.projectionVersion, 6);
  assert.strictEqual(authored.landing.state, 'resolved');
  assert.strictEqual(authored.landing.traceable.length, 6, 'resolved world should expose six landed Artifact traces');

  const guardian = roleObject(authored, 'guardian');
  assert.strictEqual(guardian.label, 'Ice Dragon');
  const trace = authored.landing.byObject[guardian.key];
  assert.ok(trace, 'Ice Dragon landing trace missing');
  assert.strictEqual(trace.card.id, 'persona.ice-dragon');
  assert.strictEqual(trace.card.authored, true);
  assert.strictEqual(trace.pack.id, 'pack.spire');
  assert.strictEqual(trace.pack.authored, true);
  assert.strictEqual(trace.pack.slot, 'guardian');
  assert.strictEqual(trace.pack.slotId, 'pack.spire.slot.guardian');
  assert.deepStrictEqual(trace.pack.requirement, {
    id: 'pack.spire.slot.guardian.requirement',
    accepts: 'Artifact/Persona',
    count: 1,
  });
  assert.strictEqual(trace.region.id, 'mountains');
  assert.strictEqual(trace.situation.label, 'Spire');
  assert.deepStrictEqual(trace.lifecycle.map((step) => step.stage), [
    'definition', 'template', 'reference', 'virtual', 'instance',
  ]);
  assert.deepStrictEqual(trace.backward.map((step) => step.kind), [
    'Instance', 'Virtual', 'Reference', 'Card', 'PackSlot', 'Requirement', 'Pack', 'Situation', 'Region',
  ]);

  const landingGraph = authored.views.landing;
  assert.strictEqual(landingGraph.type, 'WorldLanding');
  assert.ok(tuple(landingGraph, `instance:${guardian.id}`, 'derived-from', 'persona.ice-dragon'));
  assert.ok(tuple(landingGraph, 'pack.spire.slot.guardian', 'bound-to', 'persona.ice-dragon'));
  assert.ok(tuple(landingGraph, `instance:${guardian.id}`, 'satisfies', 'pack.spire.slot.guardian.requirement'));
  assert.ok(tuple(landingGraph, 'region:mountains', 'contains', trace.situation.key));
  assert.ok(tuple(landingGraph, trace.situation.key, 'contains', `instance:${guardian.id}`));

  const treasure = roleObject(authored, 'treasure');
  const treasureTrace = authored.landing.byObject[treasure.key];
  assert.ok(treasureTrace);
  assert.strictEqual(treasureTrace.card.id, 'item.sword');
  assert.strictEqual(treasureTrace.card.authored, false, 'canonical catalog Template must not be mislabeled as authored Card');
  assert.strictEqual(treasureTrace.pack.id, 'pack.spire');
  assert.strictEqual(treasureTrace.pack.authored, true);
  assert.strictEqual(treasureTrace.pack.slot, 'treasure');
  assert.strictEqual(treasureTrace.pack.requirement.accepts, 'Artifact/Item');

  const document = session.serializeDocument();
  const importedSession = createResolutionAuthoringSession({ seed: 93208 });
  const imported = importedSession.importDocument(document);
  const importedGuardian = roleObject(imported, 'guardian');
  const importedTrace = imported.landing.byObject[importedGuardian.key];
  assert.strictEqual(importedGuardian.label, 'Ice Dragon');
  assert.strictEqual(importedTrace.card.id, 'persona.ice-dragon');
  assert.strictEqual(importedTrace.card.authored, true);
  assert.deepStrictEqual(importedTrace.pack.requirement, trace.pack.requirement);

  const virtualOnly = importedSession.setBudget({ maxHops: 4, maxSlots: 6, maxInstances: 0 });
  assert.strictEqual(virtualOnly.views.world.status, 'unresolved');
  assert.strictEqual(virtualOnly.landing.state, 'unresolved');
  assert.deepStrictEqual(virtualOnly.landing.traceable, [], 'budget-stopped Virtuals must not be presented as landed Instances');
  assert.deepStrictEqual(virtualOnly.landing.byObject, {});
  assert.strictEqual(virtualOnly.views.landing.tuples.filter((entry) => entry.subject !== 'world.landing').length, 0);

  console.log(JSON.stringify({
    pass: true,
    traceable: authored.landing.traceable.length,
    guardian: {
      label: guardian.label,
      card: trace.card.id,
      pack: trace.pack.id,
      slot: trace.pack.slot,
      requirement: trace.pack.requirement.accepts,
      lifecycle: trace.lifecycle.map((step) => step.stage),
    },
    canonicalTreasure: {
      label: treasure.label,
      source: treasureTrace.card.id,
      authored: treasureTrace.card.authored,
    },
    unresolvedLanding: virtualOnly.landing.traceable.length,
  }, null, 2));
}

main();
