'use strict';

const assert = require('assert');
const { createSolveBudget } = require('../src/kernel/budget');
const { solveGraph } = require('../src/kernel/dag');
const { compileLifecycleGraph } = require('../src/model/lifecycle-dag');
const {
  referenceDragon,
  virtualizeDragon,
  realizeDragon,
} = require('../src/content/personas/dragon');
const { createHorizontalWorld } = require('../src/runtime/horizontal-world');
const { inspect, inspectWorld } = require('../src/inspect/inspect');

const dragonReference = referenceDragon({
  id: 'inspect.dragon',
  boundary: { pack: 'Spire', slot: 'guardian' },
  context: {
    region: {
      id: 'Mountains',
      attributes: { Ground: 0.55, Fire: 0.25, Sky: 0.15, Aether: 0.05 },
    },
  },
});
const dragonVirtual = virtualizeDragon(dragonReference);
const dragonInstance = realizeDragon(dragonVirtual, 93208);

const virtualInspection = inspect(dragonVirtual);
assert.strictEqual(virtualInspection.facts, null);
assert.ok(virtualInspection.possibilities);
assert.ok(virtualInspection.possibilities.possibilities.element);
assert.deepStrictEqual(virtualInspection.possibilities.ranges.constitution, [30, 49]);
assert.strictEqual(virtualInspection.lineage.at(-1).stage, 'virtual');

const instanceInspection = inspect(dragonInstance);
assert.ok(instanceInspection.facts);
assert.strictEqual(instanceInspection.possibilities, null);
assert.strictEqual(instanceInspection.facts.id, dragonInstance.id);
assert.ok(instanceInspection.facts.stats.constitution);
assert.strictEqual(instanceInspection.lineage.at(-1).stage, 'instance');

const dragonGraph = compileLifecycleGraph({
  prefix: 'inspect.dragon',
  reference: dragonReference,
  virtualize: virtualizeDragon,
  realize: realizeDragon,
  seed: 93208,
});
const virtualOnlySolve = solveGraph({
  graph: dragonGraph.graph,
  target: dragonGraph.target,
  budget: createSolveBudget({ maxHops: 2, maxSlots: 0, maxInstances: 0 }),
});
const withTrace = inspect(dragonVirtual, { solve: virtualOnlySolve });
assert.ok(withTrace.solveTrace);
assert.strictEqual(withTrace.solveTrace.usage.instances, 0);
assert.ok(withTrace.solveTrace.stops.some((entry) => entry.reason === 'budget.maxInstances'));
assert.ok(withTrace.solveTrace.trace.some((entry) =>
  entry.nodeId === dragonGraph.virtualTarget &&
  entry.state === 'resolved' &&
  entry.valueStage === 'virtual' &&
  entry.possibilityKeys.includes('element')));
// Temporary M0.6 compatibility only; typed world Signal is a different concept.
assert.deepStrictEqual(withTrace.signals, withTrace.solveTrace);

const compiled = createHorizontalWorld(93208);
const worldSolve = solveGraph({
  graph: compiled.graph,
  target: compiled.target,
  budget: createSolveBudget({ maxHops: 4, maxSlots: 6, maxInstances: 9 }),
});
assert.strictEqual(worldSolve.result.state, 'resolved');
const worldView = inspectWorld(worldSolve.result.value);
assert.strictEqual(worldView.kind, 'WorldGraphView');
assert.strictEqual(worldView.regions.length, 3);
assert.strictEqual(worldView.situations.length, 3);
assert.ok(worldView.regions.every((region) => region.neighbors.length === 2));
assert.ok(worldView.situations.every((situation) => Object.keys(situation.members).length === 2));

const situationInspection = inspect(worldSolve.result.value.situations[0], { solve: worldSolve });
assert.strictEqual(situationInspection.facts.kind, 'Situation');
assert.ok(situationInspection.facts.members.guardian);
assert.ok(situationInspection.facts.members.treasure);
assert.ok(situationInspection.solveTrace.trace.length > 0);

console.log(JSON.stringify({
  pass: true,
  dragon: {
    possibilities: virtualInspection.possibilities,
    facts: instanceInspection.facts,
    lineage: instanceInspection.lineage,
  },
  solver: withTrace.solveTrace,
  world: worldView,
}, null, 2));
