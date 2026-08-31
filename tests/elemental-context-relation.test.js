'use strict';

const assert = require('assert');
const core = require('../src/kernel/m0.5');
const { elementalContextRelation } = require('../src/app/elemental-context-relation');

function near(actual, expected, epsilon = 1e-12, message = '') {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message} ${actual} != ${expected}`.trim());
}

function vectorObject(values) {
  return Object.fromEntries(core.E.map((element, index) => [element, values[index]]));
}

const day = new core.Clock();
const dayRelation = elementalContextRelation({
  artifactComposition: { Fire: 1 },
  mapField: { Chaos: 1 },
  clock: day,
  artifactRef: 'Virtual<Artifact>.test',
  mapAddress: 'root/zone:0/cell:test',
});

assert.strictEqual(dayRelation.kind, 'Virtual<Relation>');
assert.strictEqual(dayRelation.relationType, 'ElementalContext');
assert.strictEqual(dayRelation.lifecycle, 'candidate');
assert.strictEqual(dayRelation.readOnly, true);
assert.strictEqual(dayRelation.authority, 'evidence-only');
assert.strictEqual(dayRelation.direction, 'artifact->map');
assert.strictEqual(dayRelation.artifact.source, 'Artifact.elemental-composition');
assert.strictEqual(dayRelation.map.source, 'Map.State(T).effectiveField');
assert.strictEqual(dayRelation.admission, null);
assert.deepStrictEqual(dayRelation.effects, []);
assert.strictEqual(dayRelation.artifact.ref, 'Virtual<Artifact>.test');
assert.strictEqual(dayRelation.map.address, 'root/zone:0/cell:test');
near(dayRelation.measurements.relationMassTotal, 1);
near(dayRelation.measurements.sameElementOverlap, 0);
near(dayRelation.measurements.signedContextScore, dayRelation.measurements.kernelSignedScore);

const dayAffinity = dayRelation.relationRoles.find((row) => row.role === 'Affinity');
near(dayAffinity.mass, 1);
assert.strictEqual(dayAffinity.pairs.length, 1);
assert.strictEqual(dayAffinity.pairs[0].from, 'Fire');
assert.strictEqual(dayAffinity.pairs[0].to, 'Chaos');

const night = new core.Clock();
night.flip();
const nightRelation = elementalContextRelation({
  artifactComposition: { Fire: 1 },
  mapField: { Chaos: 1 },
  clock: night,
});
const nightWants = nightRelation.relationRoles.find((row) => row.role === 'Wants');
near(nightWants.mass, 1);
assert.notStrictEqual(dayRelation.measurements.signedContextScore, nightRelation.measurements.signedContextScore);

const world = core.createWorld(93208);
core.finishWorld(world);
const field = world.fields[0];
const cell = field.cells[0];
const fieldBefore = JSON.stringify(core.fieldVector(cell));
const clockBefore = JSON.stringify({ tick: day.tick, side: day.side, address: day.address() });
const mapField = vectorObject(core.fieldVector(cell));
const artifactComposition = { Fire: 2, Ground: 1, Aether: 0.5 };

const first = elementalContextRelation({
  artifactComposition,
  mapField,
  clock: day,
  artifactRef: 'Virtual<Artifact>.candidate',
  mapAddress: `${world.path}/zone:${field.zone}/cell:${cell.id}`,
});
const second = elementalContextRelation({
  artifactComposition,
  mapField,
  clock: day,
  artifactRef: 'Virtual<Artifact>.candidate',
  mapAddress: `${world.path}/zone:${field.zone}/cell:${cell.id}`,
});

assert.deepStrictEqual(first, second, 'same inputs must produce the same contextual relation');
near(first.measurements.relationMassTotal, 1);
near(first.measurements.signedContextScore, first.measurements.kernelSignedScore);
assert.strictEqual(first.pairContributions.length, 3 * 8);
assert.notDeepStrictEqual(first.artifact.shares, first.map.shares, 'Artifact composition and map context must remain distinct');
assert.strictEqual(JSON.stringify(core.fieldVector(cell)), fieldBefore, 'relation read must not mutate map state');
assert.strictEqual(JSON.stringify({ tick: day.tick, side: day.side, address: day.address() }), clockBefore, 'relation read must not mutate Clock state');

console.log(JSON.stringify({
  pass: true,
  kind: first.kind,
  relationType: first.relationType,
  lifecycle: first.lifecycle,
  direction: first.direction,
  relationMassTotal: first.measurements.relationMassTotal,
  signedContextScore: first.measurements.signedContextScore,
  dayRole: 'Affinity',
  nightRole: 'Wants',
  authority: first.authority,
}, null, 2));
