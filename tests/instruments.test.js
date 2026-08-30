'use strict';

const assert = require('assert');
const { createSolveBudget } = require('../src/kernel/budget');
const { solveGraph } = require('../src/kernel/dag');
const { compileLifecycleGraph } = require('../src/model/lifecycle-dag');
const {
  clockDefinition,
  hourglassDefinition,
  clockFaceDefinition,
  clockHandDefinition,
  hourDefinition,
  standardClockTemplate,
  standardHourglassTemplate,
  referenceClock,
  virtualizeClock,
  realizeClock,
  referenceHourglass,
  virtualizeHourglass,
  realizeHourglass,
} = require('../src/content/instruments');

assert.strictEqual(clockDefinition.stage, 'definition');
assert.strictEqual(clockDefinition.grammar, 'Instrument/Clock');
assert.strictEqual(clockDefinition.slots.face.accepts, 'Instrument/ClockFace');
assert.strictEqual(clockDefinition.slots.hands.accepts, 'Instrument/ClockHand');
assert.strictEqual(clockDefinition.slots.hours.accepts, 'Instrument/Hour');
assert.strictEqual(clockFaceDefinition.grammar, 'Instrument/ClockFace');
assert.strictEqual(clockHandDefinition.grammar, 'Instrument/ClockHand');
assert.strictEqual(hourDefinition.grammar, 'Instrument/Hour');

assert.strictEqual(standardClockTemplate.stage, 'template');
assert.ok(!standardClockTemplate.stats);
assert.ok(!Object.prototype.hasOwnProperty.call(standardClockTemplate.fixed, 'advancePerTurn'));
assert.ok(!Object.prototype.hasOwnProperty.call(standardClockTemplate.fixed, 'currentTick'));

const clockReference = referenceClock({
  id: 'world.clock',
  boundary: { worldId: 'small-world' },
  context: { startingOrientation: 'Day' },
});
const clockVirtual = virtualizeClock(clockReference);
assert.strictEqual(clockVirtual.stage, 'virtual');
assert.deepStrictEqual(clockVirtual.possibilities.orientation, { Day: 1, Night: 0 });
assert.deepStrictEqual(clockVirtual.ranges.currentTick, [0, 59]);
assert.ok(!clockVirtual.stats);
assert.ok(!clockVirtual.state);
assert.strictEqual(clockVirtual.slots.face.state, 'virtual');
assert.strictEqual(clockVirtual.slots.hands.state, 'virtual');
assert.strictEqual(clockVirtual.slots.hours.state, 'virtual');

const clockInstance = realizeClock(clockVirtual, 93208);
assert.strictEqual(clockInstance.stage, 'instance');
assert.strictEqual(clockInstance.properties.orientation, 'Day');
assert.strictEqual(clockInstance.state.tick, 0);
assert.strictEqual(clockInstance.state.cycle, 0);
assert.ok(Number.isInteger(clockInstance.stats.advancePerTurn));
assert.deepStrictEqual(clockInstance, realizeClock(clockVirtual, 93208));

assert.strictEqual(hourglassDefinition.stage, 'definition');
assert.strictEqual(hourglassDefinition.grammar, 'Instrument/Hourglass');
assert.strictEqual(hourglassDefinition.slots.lock.accepts, 'Instrument/HourglassLock');
assert.strictEqual(hourglassDefinition.slots.filter.accepts, 'Instrument/HourglassFilter');
assert.ok(!standardHourglassTemplate.stats);
assert.ok(!standardHourglassTemplate.fixed.capacity);

const hourglassReference = referenceHourglass({
  id: 'dragon.hourglass',
  ownerId: 'dragon-test-owner',
  boundary: { slot: 'hourglass' },
});
const hourglassVirtual = virtualizeHourglass(hourglassReference);
assert.strictEqual(hourglassVirtual.stage, 'virtual');
assert.strictEqual(hourglassVirtual.fixed.ownerId, 'dragon-test-owner');
assert.deepStrictEqual(hourglassVirtual.ranges.capacity, [60, 7200]);
assert.ok(!hourglassVirtual.stats);
assert.ok(!hourglassVirtual.state);
assert.strictEqual(hourglassVirtual.slots.lock.state, 'virtual');
assert.strictEqual(hourglassVirtual.slots.filter.state, 'virtual');

const hourglassInstance = realizeHourglass(hourglassVirtual, 93208);
assert.strictEqual(hourglassInstance.stage, 'instance');
assert.strictEqual(hourglassInstance.ownerId, 'dragon-test-owner');
assert.ok([60, 240, 720, 2400, 7200].includes(hourglassInstance.stats.capacity));
assert.ok(hourglassInstance.stats.crossingRate >= 1 && hourglassInstance.stats.crossingRate <= 4);
assert.strictEqual(hourglassInstance.stats.integrity, 100);
assert.deepStrictEqual(hourglassInstance.state.upper, { grain: 0 });
assert.deepStrictEqual(hourglassInstance.state.timeless, { grain: 0 });
assert.deepStrictEqual(hourglassInstance, realizeHourglass(hourglassVirtual, 93208));

// Both instruments compile through the same generic lifecycle DAG and obey the
// same realization ceiling as Cards.
const clockGraph = compileLifecycleGraph({
  prefix: 'instrument.clock',
  reference: clockReference,
  virtualize: virtualizeClock,
  realize: realizeClock,
  seed: 93208,
});
const noClockInstance = solveGraph({
  graph: clockGraph.graph,
  target: clockGraph.target,
  budget: createSolveBudget({ maxHops: 2, maxSlots: 0, maxInstances: 0 }),
});
assert.strictEqual(noClockInstance.result.state, 'unresolved');
assert.strictEqual(noClockInstance.result.reason, 'budget.maxInstances');
assert.ok(noClockInstance.trace.some((entry) => entry.nodeId === clockGraph.virtualTarget && entry.state === 'resolved'));

const glassGraph = compileLifecycleGraph({
  prefix: 'instrument.hourglass',
  reference: hourglassReference,
  virtualize: virtualizeHourglass,
  realize: realizeHourglass,
  seed: 93208,
});
const fullGlass = solveGraph({
  graph: glassGraph.graph,
  target: glassGraph.target,
  budget: createSolveBudget({ maxHops: 2, maxSlots: 0, maxInstances: 1 }),
});
assert.strictEqual(fullGlass.result.state, 'resolved');
assert.strictEqual(fullGlass.result.value.grammar, 'Instrument/Hourglass');
assert.strictEqual(fullGlass.usage.instances, 1);

console.log(JSON.stringify({
  pass: true,
  clock: {
    id: clockInstance.id,
    orientation: clockInstance.properties.orientation,
    advancePerTurn: clockInstance.stats.advancePerTurn,
    slots: Object.keys(clockInstance.slots),
  },
  hourglass: {
    id: hourglassInstance.id,
    ownerId: hourglassInstance.ownerId,
    rarity: hourglassInstance.properties.rarity,
    capacity: hourglassInstance.stats.capacity,
    crossingRate: hourglassInstance.stats.crossingRate,
    slots: Object.keys(hourglassInstance.slots),
  },
}, null, 2));
