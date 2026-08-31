'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

async function json(url, options) {
  const response = await fetch(url, options);
  assert.strictEqual(response.status, 200, `${url} returned ${response.status}`);
  return response.json();
}

function assertPlacementCandidate(candidate) {
  for (const key of ['score', 'fieldFit', 'relationFit', 'cycleFit', 'phaseFit', 'zoneBase', 'side', 'random']) {
    assert.ok(Number.isFinite(candidate[key]), `${candidate.type}.${key} must remain inspectable placement evidence`);
  }
}

function assertVectorClose(actual, expected, message) {
  for (const key of Object.keys(expected)) {
    assert.ok(Math.abs(actual[key] - expected[key]) < 1e-12, `${message}: ${key}`);
  }
}

async function main() {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;

    const htmlResponse = await fetch(`${base}/`);
    assert.strictEqual(htmlResponse.status, 200);
    const html = await htmlResponse.text();
    for (const phrase of [
      'Step Wave', 'Resolve All', 'Dive Into Cell', 'Cross Tick + Resolve Time',
      'Flip Day/Night', 'Clock → Face', 'Hourglass → Grain / Neck',
      'Spawn proposition', 'Temporal transfer', 'Player hourglass',
      'Generative overlay', 'One object grammar',
      'coherent noise magnitude', 'smoothed prior', 'cyclic / radial pressure',
      'spawn influence', 'time pressure', 'effective local field',
    ]) assert.match(html, new RegExp(phrase.replace(/[+]/g, '\\+')));
    assert.ok(html.indexOf('id="tick"') > html.indexOf('id="clock"'), 'time crossing control should live with the Clock instrument');
    assert.ok(html.indexOf('id="spend"') > html.indexOf('id="hourglass"'), 'grain control should live with the Hourglass instrument');
    assert.doesNotMatch(html, /Hourglass → Artifact/, 'UI must not claim Artifact binding before the player Hourglass has a runtime binding');

    const parityJs = await fetch(`${base}/parity.js`);
    const inspectorJs = await fetch(`${base}/inspector.js`);
    assert.strictEqual(parityJs.status, 200);
    assert.strictEqual(inspectorJs.status, 200);
    const paritySource = await parityJs.text();
    assert.match(paritySource, /api\/simulation/);
    for (const mode of ['noise', 'prior', 'pressure', 'spawn', 'time', 'field']) {
      assert.match(paritySource, new RegExp(`mode === '${mode}'`), `${mode} must remain a spatial map evidence view`);
    }
    assert.match(paritySource, /if\(mode==='element'\)/, 'recursive child preview must stay scoped to the element view instead of contaminating evidence heatmaps');
    assert.match(paritySource, /POI:'⌂'/, 'realized placement markers must remain typed on the map');
    assert.match(await inspectorJs.text(), /Surface|surface/);

    let snapshot = await json(`${base}/api/simulation`);
    assert.strictEqual(snapshot.active.fields.length, 3);
    assert.strictEqual(snapshot.active.fields.flatMap((field) => field.cells).length, 72);
    assert.strictEqual(snapshot.generative.map.regions.length, 3);
    assert.strictEqual(snapshot.placements.source, 'm0.5.spawnTick');
    assert.deepStrictEqual(snapshot.placements.receipts, []);

    for (const field of snapshot.active.fields) {
      const contract = field.priorContract;
      assert.strictEqual(contract.source, 'm0.5.initialProb+smoothNoiseField');
      assert.strictEqual(Object.keys(contract.zonePrior).length, 8, 'zone prior must remain typed field evidence');
      assert.deepStrictEqual(
        [contract.logitWeights.zonePrior, contract.logitWeights.logExternalPressure, contract.logitWeights.coherentNoise, contract.logitWeights.pressureFloor],
        [.58, .72, .88, 1e-5],
        'M0.5 prior logit weights must remain explicit',
      );
      assert.deepStrictEqual(
        [contract.smoothing.passes, contract.smoothing.alpha, contract.smoothing.selfWeight, contract.smoothing.neighborMeanWeight],
        [2, .24, .76, .24],
        'adjacency smoothing contract must remain explicit',
      );
      assert.strictEqual(contract.noise.octaves, 4);
      assert.strictEqual(contract.noise.amplitudeDecay, .52);
      assert.strictEqual(contract.pressure.source, 'm0.5.pressureFor');
    }

    for (const cell of snapshot.active.fields.flatMap((field) => field.cells)) {
      assert.strictEqual(Object.keys(cell.noise).length, 8, 'smoothed coherent map noise must remain projected');
      assert.strictEqual(Object.keys(cell.prior).length, 8, 'smoothed initial prior must remain projected');
      assert.strictEqual(Object.keys(cell.externalPressure).length, 8, 'spatial pressure must remain projected');
      assert.ok(Number.isFinite(cell.initialEntropy), 'initial entropy remains a map statistic');
    }

    assert.strictEqual(snapshot.selected.mapField.source, 'm0.5.map.cell');
    assert.deepStrictEqual(snapshot.selected.mapField.noise, snapshot.selected.cell.noise);
    assert.deepStrictEqual(snapshot.selected.mapField.prior, snapshot.selected.cell.prior);
    assert.deepStrictEqual(snapshot.selected.mapField.effectiveField, snapshot.selected.cell.fieldVector);
    assert.deepStrictEqual(snapshot.selected.mapField.relationProfile.ring, snapshot.elements);
    assert.ok(snapshot.selected.mapField.relationProfile.contributions.length >= 1);
    assert.strictEqual(snapshot.selected.mapField.clockReading.at, snapshot.clock.address);
    assert.ok(Number.isFinite(snapshot.clock.phase), 'Clock projection owns world-relative phase');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(snapshot.selected.mapField.clockReading, 'phase'), false, 'context reading must not duplicate Clock phase with a different rotation frame');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(snapshot.selected, 'elemental'), false, 'map field must not masquerade as Artifact Elemental Identity');

    const priorEvidence = snapshot.selected.mapField.priorProvenance;
    assert.strictEqual(priorEvidence.source, 'm0.5.initialProb+smoothNoiseField');
    assert.strictEqual(priorEvidence.seed, snapshot.active.seed);
    assert.strictEqual(Object.keys(priorEvidence.coherentNoiseRaw).length, 8);
    assert.strictEqual(Object.keys(priorEvidence.coherentNoiseSmoothed).length, 8);
    assert.strictEqual(Object.keys(priorEvidence.preSmoothingLogits).length, 8);
    assert.strictEqual(Object.keys(priorEvidence.preSmoothingPrior).length, 8);
    assert.strictEqual(Object.keys(priorEvidence.finalLogits).length, 8);
    assertVectorClose(priorEvidence.coherentNoiseSmoothed, snapshot.selected.cell.noise, 'smoothed noise provenance must match cell state');
    assertVectorClose(priorEvidence.finalPrior, snapshot.selected.cell.prior, 'replayed final prior must match cell state');
    assert.ok(Math.abs(priorEvidence.finalPriorEntropy - snapshot.selected.cell.initialEntropy) < 1e-12, 'replayed final prior entropy must match M0.5 cell statistic');

    const firstDigest = snapshot.active.digest;
    snapshot = await json(`${base}/api/simulation/step`, { method: 'POST' });
    assert.strictEqual(snapshot.active.wave, 1);
    assert.notStrictEqual(snapshot.active.digest, firstDigest);

    snapshot = await json(`${base}/api/simulation/finish`, { method: 'POST' });
    assert.strictEqual(snapshot.active.finished, true);
    const first = snapshot.active.fields[0].cells[0];
    snapshot = await json(`${base}/api/simulation/select?zone=${first.zone}&id=${first.id}`, { method: 'POST' });
    assert.strictEqual(snapshot.selected.cell.id, first.id);
    assert.strictEqual(snapshot.selected.spawnCandidates.length, 4);
    assert.strictEqual(snapshot.selected.mapField.source, 'm0.5.map.cell');
    assert.ok(Object.values(snapshot.selected.mapField.effectiveField).some((value) => value > 0));
    assert.strictEqual(snapshot.selected.mapField.clockReading.orientation, snapshot.clock.orientation);
    assert.strictEqual(snapshot.selected.mapField.placement.candidates.length, 4);
    const poi = snapshot.selected.mapField.placement.candidates.find((candidate) => candidate.type === 'POI');
    assert.ok(poi, 'POI placement must remain an explicit candidate rather than arbitrary canvas decoration');
    assertPlacementCandidate(poi);
    for (const candidate of snapshot.selected.mapField.placement.candidates) assertPlacementCandidate(candidate);

    const composition = snapshot.selected.mapField.effectiveFieldComposition.resolved;
    assert.deepStrictEqual(
      [composition.prior, composition.resolvedElement, composition.externalPressure, composition.spawnField, composition.temporalPressure],
      [0.30, 0.36, 0.14, 0.08, 0.12],
      'resolved fieldVector provenance weights must remain explicit',
    );
    assert.strictEqual(composition.normalized, true);

    const beforeSide = snapshot.clock.side;
    const beforeReading = snapshot.selected.mapField.clockReading.byTarget.Fire.score;
    snapshot = await json(`${base}/api/simulation/flip-clock`, { method: 'POST' });
    assert.notStrictEqual(snapshot.clock.side, beforeSide);
    assert.strictEqual(snapshot.selected.mapField.clockReading.orientation, snapshot.clock.orientation);
    assert.notStrictEqual(snapshot.selected.mapField.clockReading.byTarget.Fire.score, beforeReading);

    const beforeTick = snapshot.clock.tick;
    snapshot = await json(`${base}/api/simulation/advance`, { method: 'POST' });
    assert.strictEqual(snapshot.clock.tick, beforeTick + 1);
    assert.ok(snapshot.selected.cell.biomeTime, 'Cross Tick must expose selected biome hourglass through HTTP projection');
    assert.strictEqual(snapshot.selected.mapField.clockReading.at, snapshot.clock.address);
    const placementReceipt = snapshot.ledger.find((entry) => ['POI', 'Artifact', 'Persona', 'Event'].includes(entry.type) && entry.score != null);
    assert.ok(placementReceipt, 'spawn/placement ledger must carry at least one scored placement receipt');
    assertPlacementCandidate(placementReceipt);

    assert.ok(snapshot.placements.receipts.length >= 1, 'realized placement decisions must have durable addressable receipts');
    for (const receipt of snapshot.placements.receipts) {
      assert.match(receipt.id, /^Placement\./);
      assert.match(receipt.address, /^root\/zone:\d+\/cell:\d+$/);
      assert.strictEqual(receipt.source, 'm0.5.spawnTick');
      assertPlacementCandidate(receipt);
      const field = snapshot.active.fields.find((candidate) => candidate.zone === receipt.zone);
      const cell = field.cells.find((candidate) => candidate.id === receipt.cellId);
      assert.ok(cell.spawns.some((marker) => marker.type === receipt.type && marker.at === receipt.at), 'addressable receipt must point back to a realized map marker');
    }

    snapshot = await json(`${base}/api/simulation/dive`, { method: 'POST' });
    assert.strictEqual(snapshot.active.depth, 1);
    assert.strictEqual(snapshot.stack.length, 1);
    assert.ok(snapshot.selected.mapField.relationProfile.contributions.length >= 1);
    assert.strictEqual(Object.keys(snapshot.selected.mapField.noise).length, 8);
    assert.strictEqual(snapshot.selected.mapField.priorProvenance.seed, snapshot.active.seed, 'recursive field provenance must replay from the child-world seed');
    assert.strictEqual(snapshot.selected.mapField.priorContract.local, true, 'recursive field must expose the local pressure contract');
    assert.ok(snapshot.placements.receipts.length >= 1, 'root placement receipts remain inspectable while recursively focused');
    snapshot = await json(`${base}/api/simulation/back`, { method: 'POST' });
    assert.strictEqual(snapshot.active.depth, 0);

    console.log('M0.6 parity workbench + M0.7 map-state/placement/prior provenance HTTP contract: PASS');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
