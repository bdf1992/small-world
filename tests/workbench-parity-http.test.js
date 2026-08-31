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

    const htmlResponse = await fetch(`${base}/`);
    assert.strictEqual(htmlResponse.status, 200);
    const html = await htmlResponse.text();
    for (const phrase of [
      'Step Wave', 'Resolve All', 'Dive Into Cell', 'Cross Tick + Resolve Time',
      'Flip Day/Night', 'Spawn proposition', 'Temporal transfer', 'Player hourglass',
      'Generative overlay', 'One object grammar',
    ]) assert.match(html, new RegExp(phrase.replace(/[+]/g, '\\+')));

    const parityJs = await fetch(`${base}/parity.js`);
    const inspectorJs = await fetch(`${base}/inspector.js`);
    assert.strictEqual(parityJs.status, 200);
    assert.strictEqual(inspectorJs.status, 200);
    const paritySource = await parityJs.text();
    assert.match(paritySource, /api\/simulation/);
    assert.match(paritySource, /M0\.7 elemental Profile/);
    assert.match(paritySource, /open full Profile \+ Crossing instrument/);
    assert.match(await inspectorJs.text(), /Surface|surface/);

    let snapshot = await json(`${base}/api/simulation`);
    assert.strictEqual(snapshot.active.fields.length, 3);
    assert.strictEqual(snapshot.active.fields.flatMap((field) => field.cells).length, 72);
    assert.strictEqual(snapshot.generative.map.regions.length, 3);
    assert.strictEqual(snapshot.selected.elemental.source, 'selected.cell.fieldVector');
    assert.deepStrictEqual(snapshot.selected.elemental.profile.ring, snapshot.elements);
    assert.ok(snapshot.selected.elemental.profile.contributions.length >= 1);
    assert.strictEqual(snapshot.selected.elemental.clockReading.at, snapshot.clock.address);

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
    assert.strictEqual(snapshot.selected.elemental.source, 'selected.cell.fieldVector');
    assert.ok(Object.values(snapshot.selected.elemental.composition).some((value) => value > 0));
    assert.strictEqual(snapshot.selected.elemental.clockReading.orientation, snapshot.clock.orientation);

    const beforeSide = snapshot.clock.side;
    const beforeReading = snapshot.selected.elemental.clockReading.byTarget.Fire.score;
    snapshot = await json(`${base}/api/simulation/flip-clock`, { method: 'POST' });
    assert.notStrictEqual(snapshot.clock.side, beforeSide);
    assert.strictEqual(snapshot.selected.elemental.clockReading.orientation, snapshot.clock.orientation);
    assert.notStrictEqual(snapshot.selected.elemental.clockReading.byTarget.Fire.score, beforeReading);

    const beforeTick = snapshot.clock.tick;
    snapshot = await json(`${base}/api/simulation/advance`, { method: 'POST' });
    assert.strictEqual(snapshot.clock.tick, beforeTick + 1);
    assert.ok(snapshot.selected.cell.biomeTime, 'Cross Tick must expose selected biome hourglass through HTTP projection');
    assert.strictEqual(snapshot.selected.elemental.clockReading.at, snapshot.clock.address);

    snapshot = await json(`${base}/api/simulation/dive`, { method: 'POST' });
    assert.strictEqual(snapshot.active.depth, 1);
    assert.strictEqual(snapshot.stack.length, 1);
    assert.ok(snapshot.selected.elemental.profile.contributions.length >= 1);
    snapshot = await json(`${base}/api/simulation/back`, { method: 'POST' });
    assert.strictEqual(snapshot.active.depth, 0);

    console.log('M0.6 parity workbench + M0.7 selected Profile disclosure HTTP contract: PASS');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
