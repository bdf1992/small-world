'use strict';

const assert = require('assert');
const { createSolveBudget } = require('../src/kernel/budget');
const { createNode, createGraph, solveGraph } = require('../src/kernel/dag');
const { referenceDragon } = require('../src/content/personas/dragon');
const { createDragonGraph } = require('../src/content/personas/dragon-dag');

// Generic converging DAG: shared causes are evaluated once and budget distance is
// based on shortest causal distance from the requested target.
let sourceCalls = 0;
const converging = createGraph([
  createNode({ id: 'source', evaluate: () => { sourceCalls++; return 2; } }),
  createNode({ id: 'left', inputs: ['source'], evaluate: ({ inputs }) => inputs.source + 1 }),
  createNode({ id: 'right', inputs: ['source'], evaluate: ({ inputs }) => inputs.source * 2 }),
  createNode({ id: 'join', inputs: ['left', 'right'], evaluate: ({ inputs }) => inputs.left + inputs.right }),
]);
const converged = solveGraph({
  graph: converging,
  target: 'join',
  budget: createSolveBudget({ maxHops: 2, maxSlots: 0, maxInstances: 0 }),
});
assert.strictEqual(converged.result.state, 'resolved');
assert.strictEqual(converged.result.value, 7);
assert.strictEqual(sourceCalls, 1);
assert.strictEqual(converged.usage.maxHopReached, 2);

// Cycles are rejected before solving.
assert.throws(() => createGraph([
  createNode({ id: 'a', inputs: ['b'], evaluate: () => 1 }),
  createNode({ id: 'b', inputs: ['a'], evaluate: () => 2 }),
]), /cycle detected/);

// Slot budget exhaustion is a normal unresolved frontier, not an exception.
const slotted = createGraph([
  createNode({ id: 'slot.source', evaluate: () => 'candidate' }),
  createNode({ id: 'slot.a', inputs: ['slot.source'], slotCost: 1, evaluate: ({ inputs }) => `A:${inputs['slot.source']}` }),
  createNode({ id: 'slot.b', inputs: ['slot.source'], slotCost: 1, evaluate: ({ inputs }) => `B:${inputs['slot.source']}` }),
  createNode({ id: 'slot.bundle', inputs: ['slot.a', 'slot.b'], evaluate: ({ inputs }) => [inputs['slot.a'], inputs['slot.b']] }),
]);
const slotLimited = solveGraph({
  graph: slotted,
  target: 'slot.bundle',
  budget: createSolveBudget({ maxHops: 2, maxSlots: 1, maxInstances: 0 }),
});
assert.strictEqual(slotLimited.result.state, 'unresolved');
assert.strictEqual(slotLimited.result.reason, 'input.unresolved');
assert.ok(slotLimited.stops.some((entry) => entry.reason === 'budget.maxSlots'));
assert.strictEqual(slotLimited.usage.slots, 1);

const reference = referenceDragon({
  id: 'spire.guardian.dragon',
  boundary: { pack: 'Spire', slot: 'guardian' },
  context: {
    region: {
      id: 'Mountains',
      attributes: { Ground: 0.55, Fire: 0.25, Sky: 0.15, Aether: 0.05 },
    },
  },
});
const dragonGraph = createDragonGraph({ reference, seed: 93208 });

// A Virtual can be solved without any Instance budget at all.
const virtualOnly = solveGraph({
  graph: dragonGraph,
  target: 'dragon.virtual',
  budget: createSolveBudget({ maxHops: 1, maxSlots: 0, maxInstances: 0 }),
});
assert.strictEqual(virtualOnly.result.state, 'resolved');
assert.strictEqual(virtualOnly.result.value.stage, 'virtual');
assert.strictEqual(virtualOnly.usage.instances, 0);

// Asking for an Instance with zero materialization budget still resolves the
// upstream Virtual and stops exactly at the realization boundary.
const noInstances = solveGraph({
  graph: dragonGraph,
  target: 'dragon.instance',
  budget: createSolveBudget({ maxHops: 2, maxSlots: 0, maxInstances: 0 }),
});
assert.strictEqual(noInstances.result.state, 'unresolved');
assert.strictEqual(noInstances.result.reason, 'budget.maxInstances');
assert.ok(noInstances.trace.some((entry) => entry.nodeId === 'dragon.virtual' && entry.state === 'resolved'));
assert.strictEqual(noInstances.usage.instances, 0);

// Hop exhaustion leaves a causal frontier instead of guessing through missing priors.
const shallow = solveGraph({
  graph: dragonGraph,
  target: 'dragon.instance',
  budget: createSolveBudget({ maxHops: 1, maxSlots: 0, maxInstances: 1 }),
});
assert.strictEqual(shallow.result.state, 'unresolved');
assert.ok(shallow.stops.some((entry) => entry.reason === 'budget.maxHops' && entry.nodeId === 'dragon.reference'));
assert.strictEqual(shallow.usage.instances, 0);

// Sufficient budget crosses the realization boundary exactly once and replays.
const fullBudget = createSolveBudget({ maxHops: 2, maxSlots: 0, maxInstances: 1 });
const realized = solveGraph({ graph: dragonGraph, target: 'dragon.instance', budget: fullBudget });
const replay = solveGraph({ graph: dragonGraph, target: 'dragon.instance', budget: fullBudget });
assert.strictEqual(realized.result.state, 'resolved');
assert.strictEqual(realized.result.value.stage, 'instance');
assert.strictEqual(realized.usage.instances, 1);
assert.deepStrictEqual(realized.result.value, replay.result.value);

console.log(JSON.stringify({
  pass: true,
  generic: {
    converged: converged.result.value,
    sharedSourceCalls: sourceCalls,
    slotStop: slotLimited.stops,
  },
  dragon: {
    virtualOnly: virtualOnly.result.value,
    noInstanceStop: noInstances.stops,
    shallowStop: shallow.stops,
    instance: realized.result.value,
  },
}, null, 2));
