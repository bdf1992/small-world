'use strict';

const assert = require('assert');
const core = require('../src/kernel/m0.5');
const {
  TYPES,
  placementContract,
  replayPlacementCandidate,
} = require('../src/app/m0.5-placement-provenance');

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${message}: ${actual} !== ${expected}`);
}

function assertReplay(world, clock, field, cell) {
  const kernel = core.candidateScores(world, clock, cell);
  assert.strictEqual(kernel.length, 4);
  for (const candidate of kernel) {
    const replay = replayPlacementCandidate(world, clock, field, cell, candidate.type);
    close(replay.score, candidate.score, `${candidate.type} total score`);
    close(replay.components.fieldFit, candidate.fieldFit, `${candidate.type} fieldFit`);
    close(replay.components.relationFit, candidate.relationFit, `${candidate.type} relationFit`);
    close(replay.components.cycleFit, candidate.cycleFit, `${candidate.type} cycleFit`);
    close(replay.components.phaseFit, candidate.phaseFit, `${candidate.type} phaseFit`);
    close(replay.components.zoneBase, candidate.zoneBase, `${candidate.type} zoneBase`);
    close(replay.components.side, candidate.side, `${candidate.type} side`);
    close(replay.components.random, candidate.rnd, `${candidate.type} seeded term`);

    const recomposed = replay.components.fieldFit
      + replay.components.relationFit
      + replay.components.cycleFit
      + replay.components.phaseFit
      + replay.components.zoneBase
      + replay.components.side
      + replay.components.random;
    close(recomposed, replay.score, `${candidate.type} recomposed score`);
    close(replay.terms.relationTuple.contribution + replay.terms.dynamicSigned.contribution, replay.components.relationFit, `${candidate.type} relation subterms`);
  }
}

const contract = placementContract();
assert.strictEqual(contract.source, 'm0.5.scoreSpawn+spawnTick');
assert.deepStrictEqual(contract.types.map((entry) => entry.type).sort(), [...TYPES].sort());
assert.deepStrictEqual(contract.zoneCycleOffsets, { Center: 0, Barrier: 2, Edge: 4 });
assert.deepStrictEqual(contract.scoreWeights, {
  fieldFit: 1.65,
  relationTupleFit: .62,
  dynamicSignedFit: .18,
  cycleFit: 1.18,
  phaseFit: 1.10,
  seededVariation: .18,
});

for (const type of contract.types) {
  close(Object.values(type.signature).reduce((sum, value) => sum + value, 0), 1, `${type.type} signature normalized`);
  assert.strictEqual(Object.keys(type.signature).length, 8);
  assert.strictEqual(Object.keys(type.relationPreferences).length, 8);
}

const world = core.createWorld(93208);
core.finishWorld(world);
const clock = new core.Clock();

for (const field of world.fields) {
  const cells = [field.cells[0], field.cells[Math.floor(field.cells.length / 2)], field.cells[field.cells.length - 1]];
  for (const cell of cells) assertReplay(world, clock, field, cell);
}

clock.flip();
for (const field of world.fields) assertReplay(world, clock, field, field.cells[0]);

for (let step = 0; step < 7; step++) clock.advance();
for (const field of world.fields) assertReplay(world, clock, field, field.cells[Math.min(2, field.cells.length - 1)]);

const centerPoi = contract.types.find((entry) => entry.type === 'POI');
const event = contract.types.find((entry) => entry.type === 'Event');
assert.deepStrictEqual(centerPoi.zoneBias, { Center: .28, Barrier: .12, Edge: -.06 });
assert.deepStrictEqual(event.zoneBias, { Center: -.08, Barrier: .10, Edge: .28 });
assert.strictEqual(centerPoi.sideBias.Day, .06);
assert.strictEqual(event.sideBias.Night, .08);

console.log(JSON.stringify({
  pass: true,
  source: contract.source,
  types: contract.types.map((entry) => ({ type: entry.type, cycleSeat: entry.cycleSeat })),
  weights: contract.scoreWeights,
  selectionRule: contract.selectionRule,
}, null, 2));
