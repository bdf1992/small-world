'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

async function json(url, options) {
  const response = await fetch(url, options);
  assert.strictEqual(response.status, 200, `${url} returned ${response.status}`);
  return response.json();
}

function componentSum(candidate) {
  const c = candidate.components;
  return c.fieldFit + c.relationFit + c.cycleFit + c.phaseFit + c.zoneBase + c.side + c.random;
}

function assertArtifactContext(evidence, snapshot) {
  const candidate = evidence.artifactContext;
  assert.ok(candidate, 'resolved selected cell must expose a Virtual<Artifact> context candidate');
  assert.strictEqual(candidate.kind, 'Virtual<Artifact>.ContextCandidate');
  assert.strictEqual(candidate.stage, 'virtual');
  assert.strictEqual(candidate.readOnly, true);
  assert.strictEqual(candidate.address, evidence.selectedAddress);
  assert.strictEqual(candidate.admission, null);
  assert.strictEqual(candidate.realizedArtifact, null);
  assert.strictEqual(candidate.relation.kind, 'Virtual<Relation>');
  assert.strictEqual(candidate.relation.relationType, 'ElementalContext');
  assert.strictEqual(candidate.relation.lifecycle, 'candidate');
  assert.strictEqual(candidate.relation.authority, 'evidence-only');
  assert.strictEqual(candidate.relation.direction, 'artifact->map');
  assert.strictEqual(candidate.relation.map.address, evidence.selectedAddress);
  assert.strictEqual(candidate.relation.at, snapshot.clock.address);
  assert.strictEqual(candidate.relation.admission, null);
  assert.deepStrictEqual(candidate.relation.effects, []);
  assert.ok(Math.abs(candidate.relation.measurements.sameElementOverlap - candidate.placement.fieldOverlap) < 1e-12);
  assert.ok(Math.abs(candidate.placement.fieldFit - candidate.placement.fieldOverlap * candidate.placement.fieldWeight) < 1e-12);
  assert.ok(Math.abs(candidate.relation.measurements.signedContextScore - candidate.relation.measurements.kernelSignedScore) < 1e-12);
}

async function main() {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    let snapshot = await json(`${base}/api/simulation`);
    let evidence = await json(`${base}/api/simulation/placement-evidence`);

    assert.strictEqual(evidence.source, 'm0.5.scoreSpawn+spawnTick');
    assert.strictEqual(evidence.readOnly, true);
    assert.strictEqual(evidence.contract.source, 'm0.5.scoreSpawn+spawnTick');
    assert.match(evidence.selectedAddress, /^root\/zone:\d+\/cell:\d+$/);
    assert.strictEqual(evidence.contract.types.length, 4);
    assert.strictEqual(evidence.selected.length, 4);
    assertArtifactContext(evidence, snapshot);

    for (const candidate of evidence.selected) {
      assert.strictEqual(candidate.at, snapshot.clock.address);
      assert.strictEqual(candidate.cellId, snapshot.selected.cell.id);
      assert.strictEqual(candidate.zone, snapshot.selected.cell.zone);
      assert.ok(Math.abs(componentSum(candidate) - candidate.score) < 1e-12, `${candidate.type} score must be replayable`);
      assert.strictEqual(Object.keys(candidate.baseSignature).length, 8);
      assert.strictEqual(Object.keys(candidate.rotatedSignature).length, 8);
      assert.strictEqual(Object.keys(candidate.phaseProfile).length, 8);
      assert.strictEqual(Object.keys(candidate.relationTuple).length, 8);
      assert.strictEqual(Object.keys(candidate.relationPreferences).length, 8);
    }

    const firstPoi = evidence.selected.find((candidate) => candidate.type === 'POI');
    assert.ok(firstPoi);
    assert.strictEqual(firstPoi.terms.field.weight, 1.65);
    assert.strictEqual(firstPoi.terms.relationTuple.weight, .62);
    assert.strictEqual(firstPoi.terms.dynamicSigned.weight, .18);
    assert.strictEqual(firstPoi.terms.cycle.weight, 1.18);
    assert.strictEqual(firstPoi.terms.phase.weight, 1.10);
    assert.strictEqual(firstPoi.terms.seeded.weight, .18);

    const before = firstPoi.score;
    const beforeContext = evidence.artifactContext.relation.measurements.signedContextScore;
    snapshot = await json(`${base}/api/simulation/flip-clock`, { method: 'POST' });
    evidence = await json(`${base}/api/simulation/placement-evidence`);
    assert.strictEqual(evidence.selected[0].at, snapshot.clock.address);
    const afterPoi = evidence.selected.find((candidate) => candidate.type === 'POI');
    assert.notStrictEqual(afterPoi.score, before, 'Clock orientation must change the live placement reading');
    assert.strictEqual(afterPoi.terms.side.side, 'Night');
    assertArtifactContext(evidence, snapshot);
    assert.notStrictEqual(evidence.artifactContext.relation.measurements.signedContextScore, beforeContext, 'Clock orientation must change the live Artifact-to-map relation reading');

    snapshot = await json(`${base}/api/simulation/finish`, { method: 'POST' });
    const target = snapshot.active.fields[1].cells[Math.floor(snapshot.active.fields[1].cells.length / 2)];
    snapshot = await json(`${base}/api/simulation/select?zone=${target.zone}&id=${target.id}`, { method: 'POST' });
    evidence = await json(`${base}/api/simulation/placement-evidence`);
    assert.strictEqual(evidence.selectedAddress, `root/zone:${target.zone}/cell:${target.id}`);
    assert.strictEqual(evidence.selected.length, 4);
    assertArtifactContext(evidence, snapshot);

    console.log('M0.7 live placement + Virtual Artifact context evidence HTTP contract: PASS');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
