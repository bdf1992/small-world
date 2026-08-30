'use strict';

const assert = require('assert');
const { createResolutionAuthoringSession } = require('../src/app/resolution-session');

function stableTuples(graph) {
  return JSON.stringify(graph.tuples);
}

function main() {
  const session = createResolutionAuthoringSession({ seed: 93208 });
  const initial = session.snapshot();
  assert.strictEqual(initial.projectionVersion, 6);
  assert.strictEqual(initial.revision, 0);
  assert.strictEqual(initial.resolutionRevision, 0);
  assert.strictEqual(initial.resolution.complete, true);
  assert.strictEqual(initial.views.world.status, 'resolved');
  assert.strictEqual(initial.views.landing.type, 'WorldLanding');
  assert.strictEqual(initial.landing.traceable.length, 6);

  const cardTruth = stableTuples(initial.views.card);
  const packTruth = stableTuples(initial.views.pack);

  const virtualOnly = session.setBudget({ maxInstances: 0 });
  assert.strictEqual(virtualOnly.revision, 0, 'compute budget must not mutate authored revision');
  assert.strictEqual(virtualOnly.resolutionRevision, 1);
  assert.strictEqual(virtualOnly.views.world.status, 'unresolved');
  assert.strictEqual(virtualOnly.resolution.complete, false);
  assert.ok(virtualOnly.resolution.stops.some((stop) => stop.reason === 'budget.maxInstances'));
  assert.ok(virtualOnly.resolution.virtuals.length > 0, 'instance budget 0 should preserve resolved Virtuals');
  assert.strictEqual(stableTuples(virtualOnly.views.card), cardTruth, 'Card tuples changed under runtime budget');
  assert.strictEqual(stableTuples(virtualOnly.views.pack), packTruth, 'Pack tuples changed under runtime budget');
  assert.ok(virtualOnly.views.resolution.tuples.some((tuple) => tuple.predicate === 'blocked-by' && tuple.object === 'budget.maxInstances'));
  assert.ok(virtualOnly.views.resolution.tuples.some((tuple) => tuple.subject === 'resolution.frontier' && tuple.predicate === 'contains'));
  assert.deepStrictEqual(virtualOnly.landing.traceable, [], 'Virtual-only resolution must not create landed Instance traces');

  const slotLimited = session.setBudget({ maxInstances: 9, maxSlots: 3 });
  assert.strictEqual(slotLimited.revision, 0);
  assert.strictEqual(slotLimited.resolutionRevision, 2);
  assert.strictEqual(slotLimited.views.world.status, 'unresolved');
  assert.ok(slotLimited.resolution.stops.some((stop) => stop.reason === 'budget.maxSlots'));
  assert.strictEqual(slotLimited.resolution.usage.slots, 3);

  const shallow = session.setBudget({ maxSlots: 6, maxHops: 1 });
  assert.strictEqual(shallow.revision, 0);
  assert.strictEqual(shallow.resolutionRevision, 3);
  assert.ok(shallow.resolution.stops.some((stop) => stop.reason === 'budget.maxHops'));

  const full = session.resetBudget();
  assert.strictEqual(full.revision, 0);
  assert.strictEqual(full.resolutionRevision, 4);
  assert.strictEqual(full.resolution.complete, true);
  assert.strictEqual(full.views.world.status, 'resolved');
  assert.deepStrictEqual(full.resolution.stops, []);
  assert.strictEqual(stableTuples(full.views.card), cardTruth);
  assert.strictEqual(stableTuples(full.views.pack), packTruth);
  assert.strictEqual(full.landing.traceable.length, 6, 'full budget should restore landed traces');

  const authored = session.cloneCard({ cardId: 'persona.dragon', newId: 'persona.ice-dragon' });
  assert.strictEqual(authored.revision, 1);
  assert.strictEqual(authored.resolutionRevision, 4, 'authoring must not masquerade as a budget revision');

  assert.throws(() => session.setBudget({ maxSlots: -1 }), /non-negative integer/);

  console.log(JSON.stringify({
    pass: true,
    authorRevisionAfterBudgetOnly: full.revision,
    resolutionRevision: full.resolutionRevision,
    virtualOnly: {
      stops: virtualOnly.resolution.stops.length,
      virtuals: virtualOnly.resolution.virtuals.length,
      landed: virtualOnly.landing.traceable.length,
    },
    slotLimitedUsage: slotLimited.resolution.usage,
    fullState: full.resolution.state,
    fullLanding: full.landing.traceable.length,
  }, null, 2));
}

main();
