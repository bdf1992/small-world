'use strict';

const assert = require('assert');
const core = require('../src/kernel/m0.5');
const {
  SUPPORT,
  WAVE_CONTRACT,
  nextWaveEvidence,
} = require('../src/app/m0.5-wave-provenance');

function fieldByZone(world, zone) {
  return world.fields.find((field) => field.zone === zone);
}

function cellById(field, id) {
  return field.cells.find((cell) => cell.id === id);
}

assert.deepStrictEqual(SUPPORT, [.18, 1.28, 1.10, .82, .42, .72, .95, 1.18]);
assert.deepStrictEqual(WAVE_CONTRACT.supportByRelation, {
  Is: .18,
  Affinity: 1.28,
  Anchor: 1.10,
  Vice: .82,
  Nemesis: .42,
  Conflict: .72,
  Need: .95,
  Wants: 1.18,
});
assert.strictEqual(WAVE_CONTRACT.frontier.tieJitterScale, 1e-5);
assert.strictEqual(WAVE_CONTRACT.collapse.crowdPenaltyPerExtraSameNeighbor, .34);
assert.strictEqual(WAVE_CONTRACT.collapse.seededGumbelScale, .17);
assert.strictEqual(WAVE_CONTRACT.initialNucleus.firstIndex, 0);

for (const seed of [1, 42, 93208, 99991]) {
  const world = core.createWorld(seed);
  for (let step = 0; step < 8 && !world.finished; step++) {
    const beforeWave = world.wave;
    const evidence = nextWaveEvidence(world);
    assert.strictEqual(evidence.readOnly, true);
    assert.strictEqual(evidence.currentWave, beforeWave);
    assert.strictEqual(evidence.predictedWave, beforeWave + 1);

    const predicted = [];
    for (const fieldEvidence of evidence.fields) {
      for (const collapse of fieldEvidence.selectedCollapses) {
        predicted.push({ zone: fieldEvidence.zone, ...collapse });
        assert.ok(collapse.elementScores.rows.length === 8);
        assert.strictEqual(collapse.predictedCollapseWave, beforeWave + 1);
        for (const receipt of collapse.propagation) {
          assert.strictEqual(Object.keys(receipt.relationMultipliers).length, 8);
          assert.strictEqual(Object.keys(receipt.before).length, 8);
          assert.strictEqual(Object.keys(receipt.after).length, 8);
          assert.strictEqual(receipt.supportHitsAfter, receipt.supportHitsBefore + 1);
        }
      }
    }

    const changed = core.generationWave(world);
    assert.strictEqual(world.wave, beforeWave + 1);
    assert.strictEqual(changed, predicted.length > 0 || evidence.fields.some((field) => field.fallback));

    for (const prediction of predicted) {
      const field = fieldByZone(world, prediction.zone);
      const cell = cellById(field, prediction.cellId);
      assert.ok(cell.resolved, `predicted cell ${prediction.cellId} must resolve`);
      assert.strictEqual(cell.element, prediction.predictedElementIndex, `predicted element must match for cell ${prediction.cellId}`);
      assert.strictEqual(core.E[cell.element], prediction.predictedElement);
      assert.strictEqual(cell.collision, prediction.collision);
      assert.strictEqual(cell.root, prediction.resultingRoot);
      assert.strictEqual(cell.collapseWave, prediction.predictedCollapseWave);
      assert.deepStrictEqual([...cell.rootsTouched].sort(), [...prediction.rootsTouched].sort());
    }

    for (const fieldEvidence of evidence.fields) {
      if (!fieldEvidence.fallback) continue;
      const field = fieldByZone(world, fieldEvidence.zone);
      const cell = cellById(field, fieldEvidence.fallback.cellId);
      assert.ok(cell.resolved);
      assert.strictEqual(cell.nucleus, true);
      assert.strictEqual(cell.element, fieldEvidence.fallback.predictedElementIndex);
      assert.strictEqual(cell.root, fieldEvidence.fallback.predictedRoot);
    }
  }
}

console.log(JSON.stringify({
  pass: true,
  source: WAVE_CONTRACT.source,
  support: WAVE_CONTRACT.supportByRelation,
  frontier: WAVE_CONTRACT.frontier,
  collapse: WAVE_CONTRACT.collapse,
}, null, 2));
