'use strict';

const assert = require('assert');
const { createSimulationSession } = require('../src/app/simulation');

function allCells(snapshot) {
  return snapshot.active.fields.flatMap((field) => field.cells);
}

const session = createSimulationSession({ seed: 93208 });
let view = session.snapshot();

assert.equal(view.mode, 'parity-restoration');
assert.equal(view.active.fields.length, 3, 'root must expose Center / Barrier / Edge graphs');
assert.equal(allCells(view).length, 72, 'root must expose all 72 spatial cells');
assert.ok(allCells(view).every((cell) => cell.polygon.length >= 3), 'cells must expose renderer-independent polygons');
assert.ok(allCells(view).every((cell) => cell.preview.length >= 4), 'every visible cell must expose recursive child preview');
assert.equal(view.root.invariants.separateGraphs, true);
assert.equal(view.root.invariants.edgeOpposition, true);
assert.equal(view.generative.map.regions.length, 3, 'M0.6 generative projection remains composed alongside parity state');

const initialDigest = view.active.digest;
view = session.step();
assert.equal(view.active.wave, 1, 'Step Wave must advance exactly one generation wave');
assert.notEqual(view.active.digest, initialDigest, 'wave step must change active field state');

view = session.finish();
assert.equal(view.active.finished, true);
assert.ok(allCells(view).every((cell) => cell.resolved), 'Resolve All must settle every visible cell');
const resolvedDigest = view.active.digest;

const dayPlusOne = view.relationField.find((row) => row.from === 'Fire' && row.to === 'Chaos');
assert.equal(dayPlusOne.relation, 'Affinity');
view = session.flipClock();
const nightPlusOne = view.relationField.find((row) => row.from === 'Fire' && row.to === 'Chaos');
assert.equal(nightPlusOne.relation, 'Wants', 'Day/Night flip must reverse directed non-opposite relation');
const fireWater = view.relationField.find((row) => row.from === 'Fire' && row.to === 'Water');
assert.equal(fireWater.relation, 'Nemesis', 'diametric opposition remains invariant across clock face');
session.flipClock();

const first = session.snapshot().active.fields[0].cells[0];
session.select({ zone: first.zone, id: first.id });
view = session.snapshot();
assert.ok(view.selected.spawnCandidates.length === 4, 'resolved cell must expose all spawn proposition families');
assert.ok(view.selected.temporalSupply, 'resolved cell must expose elemental-time supply');
assert.ok(view.selected.cell.preview.length >= 4);

const beforeSpend = Object.values(view.hourglass.top).reduce((a, b) => a + b, 0);
view = session.spend();
const afterSpend = Object.values(view.hourglass.top).reduce((a, b) => a + b, 0);
assert.ok(afterSpend === beforeSpend || afterSpend === beforeSpend - 1, 'player hourglass spend is either valid or explicitly blocked');
view = session.flipHourglass();
assert.ok(view.hourglass.top && view.hourglass.bottom, 'player hourglass flip remains represented');

view = session.dive();
assert.equal(view.active.depth, 1, 'Dive must materialize a conditioned child field');
assert.equal(view.stack.length, 1);
assert.equal(view.active.fields.length, 1);
assert.ok(allCells(view).every((cell) => cell.preview.length >= 4));
view = session.back();
assert.equal(view.active.depth, 0, 'Back must restore prior field');
assert.equal(view.active.digest, resolvedDigest, 'recursive navigation must not mutate parent field state');

let transferEvents = 0;
for (let i = 0; i < 20; i++) {
  const before = session.snapshot().ledger.length;
  view = session.advance();
  transferEvents += view.ledger.length - before;
}
assert.equal(view.clock.tick, 20, 'Cross Tick must advance exactly one tick each time');
const rootCells = view.active.fields.flatMap((field) => field.cells);
assert.equal(rootCells.filter((cell) => cell.biomeTime).length, 72, 'all resolved root cells must receive biome hourglasses');
assert.ok(rootCells.reduce((sum, cell) => sum + cell.entities.length, 0) > 0, 'temporal spawning must create Persona/Event entities');
assert.ok(rootCells.reduce((sum, cell) => sum + cell.temporalPressureTotal, 0) > 0, 'unresolved temporal demand must become typed pressure');
assert.ok(view.ledger.length > 0 && transferEvents > 0, 'temporal/spawn ledger must be populated');
assert.ok(rootCells.some((cell) => cell.entities.some((entity) => entity.glass)), 'spawned temporal entities must expose hourglasses');

const replay = createSimulationSession({ seed: 93208 });
replay.finish();
assert.equal(replay.snapshot().active.digest, resolvedDigest, 'same seed must replay exact resolved field');

console.log('M0.6 parity restoration application contract: PASS');
