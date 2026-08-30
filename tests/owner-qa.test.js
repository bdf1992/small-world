'use strict';

const assert = require('assert');
const { createSolveBudget } = require('../src/kernel/budget');
const { createNode, createGraph, solveGraph } = require('../src/kernel/dag');
const { createInstance } = require('../src/model/lifecycle');
const { referenceDragon, virtualizeDragon } = require('../src/content/personas/dragon');
const { createHorizontalWorld } = require('../src/runtime/horizontal-world');
const { inspectWorld } = require('../src/inspect/inspect');

// Lifecycle identity is constructor custody. Runtime payload may not rewrite the
// stage or provenance chain that tells the rest of the engine what this object is.
const reference = referenceDragon({
  id: 'qa.dragon.reference',
  boundary: { region: 'mountains', slot: 'guardian' },
  context: {
    region: {
      id: 'mountains',
      attributes: { Ground: 0.50, Sky: 0.25, Fire: 0.15, Water: 0.10 },
    },
  },
});
const virtual = virtualizeDragon(reference);
const protectedInstance = createInstance(virtual, {
  id: 'qa-dragon',
  stage: 'virtual',
  virtualId: 'forged-virtual',
  referenceId: 'forged-reference',
  templateId: 'forged-template',
  definitionId: 'forged-definition',
  grammar: 'Forged/Grammar',
  properties: { species: 'Dragon' },
});
assert.strictEqual(protectedInstance.stage, 'instance');
assert.strictEqual(protectedInstance.virtualId, virtual.id);
assert.strictEqual(protectedInstance.referenceId, virtual.referenceId);
assert.strictEqual(protectedInstance.templateId, virtual.templateId);
assert.strictEqual(protectedInstance.definitionId, virtual.definitionId);
assert.strictEqual(protectedInstance.grammar, virtual.grammar);

// Budget costs are kernel controls and must be valid before a graph can exist.
assert.throws(() => createNode({ id: 'bad.slot', slotCost: -1, evaluate: () => null }), /non-negative integer/);
assert.throws(() => createNode({ id: 'bad.instance', instanceCost: 0.5, evaluate: () => null }), /non-negative integer/);

// Content evaluators can use resolved inputs and caller context, but cannot see
// or mutate the solver's live usage counters/stops.
let evaluatorArgs = null;
const custodyGraph = createGraph([
  createNode({
    id: 'custody.target',
    instanceCost: 1,
    evaluate: (args) => {
      evaluatorArgs = args;
      return 'ok';
    },
  }),
]);
const custodySolve = solveGraph({
  graph: custodyGraph,
  target: 'custody.target',
  budget: createSolveBudget({ maxHops: 0, maxSlots: 0, maxInstances: 1 }),
});
assert.strictEqual(custodySolve.result.value, 'ok');
assert.deepStrictEqual(Object.keys(evaluatorArgs).sort(), ['context', 'inputs']);
assert.strictEqual(evaluatorArgs.state, undefined);
assert.strictEqual(custodySolve.usage.instances, 1);

// Owner inspection must expose the regional field that contextualizes later
// Virtual weighting rather than showing only topology and IDs.
const compiled = createHorizontalWorld(93208);
const full = solveGraph({
  graph: compiled.graph,
  target: compiled.target,
  budget: createSolveBudget({ maxHops: 4, maxSlots: 6, maxInstances: 9 }),
});
assert.strictEqual(full.result.state, 'resolved');
const view = inspectWorld(full.result.value);
const mountains = view.regions.find((region) => region.id === 'mountains');
assert.ok(mountains);
assert.ok(mountains.attributes.Ground > 0);
assert.ok(mountains.attributes.Fire > 0);

console.log(JSON.stringify({
  pass: true,
  lifecycleCustody: {
    stage: protectedInstance.stage,
    virtualId: protectedInstance.virtualId,
    templateId: protectedInstance.templateId,
  },
  solverCustody: {
    evaluatorKeys: Object.keys(evaluatorArgs).sort(),
    usage: custodySolve.usage,
  },
  inspection: {
    mountains: mountains.attributes,
  },
}, null, 2));
