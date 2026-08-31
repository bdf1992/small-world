'use strict';

const assert = require('assert');
const core = require('../src/kernel/m0.5');
const { artifactContextCandidate } = require('../src/app/artifact-context-candidate');

function near(actual, expected, epsilon = 1e-12, message = '') {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message} ${actual} != ${expected}`.trim());
}

for (const seed of [1, 42, 93208, 99991]) {
  const world = core.createWorld(seed);
  core.finishWorld(world);
  const clock = new core.Clock();

  for (const field of world.fields) {
    const cell = field.cells[Math.floor(field.cells.length / 2)];
    const digestBefore = core.digestWorld(world);
    const clockBefore = JSON.stringify({ tick: clock.tick, side: clock.side, address: clock.address() });
    const candidate = artifactContextCandidate(world, clock, field, cell);

    assert.ok(candidate);
    assert.strictEqual(candidate.kind, 'Virtual<Artifact>.ContextCandidate');
    assert.strictEqual(candidate.stage, 'virtual');
    assert.strictEqual(candidate.readOnly, true);
    assert.strictEqual(candidate.placement.type, 'Artifact');
    assert.strictEqual(candidate.admission, null);
    assert.strictEqual(candidate.realizedArtifact, null);
    assert.match(candidate.address, new RegExp(`^${world.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/zone:${field.zone}/cell:${cell.id}$`));

    const relation = candidate.relation;
    assert.strictEqual(relation.kind, 'Relation.ElementalContext');
    assert.strictEqual(relation.direction, 'artifact->map');
    assert.strictEqual(relation.authority, 'evidence-only');
    assert.strictEqual(relation.artifact.stage, 'virtual');
    assert.strictEqual(relation.artifact.source, 'm0.5.scoreSpawn.Artifact.rotatedSignature');
    assert.strictEqual(relation.map.address, candidate.address);
    assert.strictEqual(relation.admission, null);
    assert.deepStrictEqual(relation.effects, []);

    near(
      relation.measurements.sameElementOverlap,
      candidate.placement.fieldOverlap,
      1e-12,
      'typed context overlap must equal the existing M0.5 Artifact placement field term',
    );
    near(
      candidate.placement.fieldFit,
      candidate.placement.fieldOverlap * candidate.placement.fieldWeight,
      1e-12,
      'M0.5 fieldFit must remain replayable from overlap × weight',
    );
    near(relation.measurements.relationMassTotal, 1);
    near(relation.measurements.signedContextScore, relation.measurements.kernelSignedScore);

    assert.strictEqual(core.digestWorld(world), digestBefore, 'context candidate read must not mutate world state');
    assert.strictEqual(JSON.stringify({ tick: clock.tick, side: clock.side, address: clock.address() }), clockBefore, 'context candidate read must not mutate Clock state');
  }
}

const world = core.createWorld(93208);
core.finishWorld(world);
const field = world.fields[0];
const cell = field.cells[0];
const day = new core.Clock();
const dayCandidate = artifactContextCandidate(world, day, field, cell);
const night = new core.Clock();
night.flip();
const nightCandidate = artifactContextCandidate(world, night, field, cell);

assert.notDeepStrictEqual(dayCandidate.placement.rotatedSignature, nightCandidate.placement.rotatedSignature, 'Clock orientation must be able to rotate the current Artifact placement signature');
assert.notDeepStrictEqual(dayCandidate.relation.relationRoles, nightCandidate.relation.relationRoles, 'Clock orientation must change the directed relation reading');

const unresolvedWorld = core.createWorld(93208);
const unresolvedField = unresolvedWorld.fields.find((candidateField) => candidateField.cells.some((candidateCell) => !candidateCell.resolved));
const unresolvedCell = unresolvedField.cells.find((candidateCell) => !candidateCell.resolved);
assert.strictEqual(artifactContextCandidate(unresolvedWorld, new core.Clock(), unresolvedField, unresolvedCell), null, 'unresolved map cells do not mint a Virtual<Artifact> context candidate');

console.log(JSON.stringify({
  pass: true,
  bridge: 'M0.5 Artifact field overlap -> Relation.ElementalContext',
  stage: dayCandidate.stage,
  admission: dayCandidate.admission,
  realizedArtifact: dayCandidate.realizedArtifact,
  fieldOverlap: dayCandidate.placement.fieldOverlap,
  signedContextScore: dayCandidate.relation.measurements.signedContextScore,
}, null, 2));
