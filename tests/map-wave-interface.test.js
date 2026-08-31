'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

async function json(url, options) {
  const response = await fetch(url, options);
  assert.strictEqual(response.status, 200, `${url} returned ${response.status}`);
  return response.json();
}

async function main() {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    let snapshot = await json(`${base}/api/simulation`);

    assert.strictEqual(snapshot.active.nextWave.source, 'm0.5.propagateElement+frontierCells+collapseOne+generationWave');
    assert.strictEqual(snapshot.active.nextWave.readOnly, true);
    assert.strictEqual(snapshot.active.nextWave.currentWave, snapshot.active.wave);
    assert.strictEqual(snapshot.active.nextWave.predictedWave, snapshot.active.wave + 1);
    assert.strictEqual(snapshot.active.nextWave.fields.length, 3);

    const selected = snapshot.selected.cell;
    const selectedWave = snapshot.selected.mapField.nextWave;
    if (selectedWave) {
      assert.strictEqual(selectedWave.readOnly, true);
      assert.strictEqual(selectedWave.currentWave, snapshot.active.wave);
      assert.ok(selectedWave.frontier || selectedWave.proposals.length || selectedWave.collapse || selectedWave.fallback);
    }

    const before = snapshot.active.nextWave;
    snapshot = await json(`${base}/api/simulation/step`, { method: 'POST' });
    assert.strictEqual(snapshot.active.wave, before.predictedWave);

    for (const fieldPrediction of before.fields) {
      const field = snapshot.active.fields.find((candidate) => candidate.zone === fieldPrediction.zone);
      for (const collapse of fieldPrediction.selectedCollapses) {
        const cell = field.cells.find((candidate) => candidate.id === collapse.cellId);
        assert.ok(cell.resolved, `predicted cell ${collapse.cellId} must resolve through live Step Wave`);
        assert.strictEqual(cell.elementIndex, collapse.predictedElementIndex);
        assert.strictEqual(cell.collision, collapse.collision);
        assert.strictEqual(cell.collapseWave, collapse.predictedCollapseWave);
      }
    }

    const inspectorResponse = await fetch(`${base}/inspector.js`);
    assert.strictEqual(inspectorResponse.status, 200);
    const inspector = await inspectorResponse.text();
    assert.match(inspector, /read-only next-wave evidence/);
    assert.match(inspector, /mode!==['"]roots['"]/);
    assert.match(inspector, /selectedCollapses/);
    assert.match(inspector, /Step Wave remains the only mutation/);

    console.log('M0.7 live next-wave spatial interface contract: PASS');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
