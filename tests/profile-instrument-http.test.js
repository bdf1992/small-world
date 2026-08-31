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

    const htmlResponse = await fetch(`${base}/profile`);
    assert.strictEqual(htmlResponse.status, 200);
    const html = await htmlResponse.text();
    for (const phrase of [
      'Elemental Profile', 'Relation wheel overlay', 'Element weights', 'Local deformation',
      'Contribution matrix', 'Clock / Hourglass Crossing Instrument', 'Cross next Tick',
      'Cross Neck', 'Crossing evidence',
    ]) {
      assert.match(html, new RegExp(phrase.replace(/[+]/g, '\\+')));
    }

    const jsResponse = await fetch(`${base}/profile.js`);
    assert.strictEqual(jsResponse.status, 200);
    const js = await jsResponse.text();
    assert.match(js, /api\/profile/);
    assert.match(js, /set-weight/);
    assert.match(js, /set-deformation/);
    assert.match(js, /cross-tick/);
    assert.match(js, /cross-grain/);

    let snapshot = await json(`${base}/api/profile`);
    assert.deepStrictEqual(snapshot.composition, { Fire: 10, Water: 1 });
    assert.deepStrictEqual(snapshot.base.composition, { Fire: 10, Water: 1 });
    assert.deepStrictEqual(snapshot.effective.composition, { Fire: 10, Water: 2 });
    assert.strictEqual(snapshot.deformation.origin, 'Water');
    assert.strictEqual(snapshot.deformation.factor, 2);
    assert.strictEqual(snapshot.measurement.changed, true);
    assert.strictEqual(snapshot.clock.address, '0:0:0:0');
    assert.strictEqual(snapshot.crossings.length, 0);

    snapshot = await json(`${base}/api/profile/set-weight?element=Ground&weight=3`, { method: 'POST' });
    assert.deepStrictEqual(snapshot.base.composition, { Fire: 10, Ground: 3, Water: 1 });
    assert.deepStrictEqual(snapshot.effective.composition, { Fire: 10, Ground: 3, Water: 2 });

    snapshot = await json(`${base}/api/profile/set-deformation?origin=Fire&factor=0.5`, { method: 'POST' });
    assert.deepStrictEqual(snapshot.base.composition, { Fire: 10, Ground: 3, Water: 1 });
    assert.deepStrictEqual(snapshot.effective.composition, { Fire: 5, Ground: 3, Water: 1 });
    assert.strictEqual(snapshot.trace[0].source, 'Property.ProfileScale');
    assert.strictEqual(snapshot.trace[0].before, 10);
    assert.strictEqual(snapshot.trace[0].after, 5);

    const beforeTick = snapshot.clock.address;
    snapshot = await json(`${base}/api/profile/cross-tick`, { method: 'POST' });
    assert.notStrictEqual(snapshot.clock.address, beforeTick);
    assert.strictEqual(snapshot.crossings.length, 1);
    assert.strictEqual(snapshot.crossings[0].kind, 'Crossing.ClockHandTick');
    assert.strictEqual(snapshot.crossings[0].traversal.admitted, true);

    const beforeFireUpper = snapshot.hourglass.upper.Fire;
    const beforeFireLower = snapshot.hourglass.lower.Fire;
    snapshot = await json(`${base}/api/profile/cross-grain?element=Fire`, { method: 'POST' });
    assert.strictEqual(snapshot.crossings.length, 2);
    assert.strictEqual(snapshot.crossings[1].kind, 'Crossing.GrainNeck');
    assert.strictEqual(snapshot.hourglass.upper.Fire, beforeFireUpper - 1);
    assert.strictEqual(snapshot.hourglass.lower.Fire, beforeFireLower + 1);

    const crossingCount = snapshot.crossings.length;
    snapshot = await json(`${base}/api/profile/flip-clock`, { method: 'POST' });
    assert.strictEqual(snapshot.clock.orientation, 'CCW');
    assert.strictEqual(snapshot.crossings.length, crossingCount);
    snapshot = await json(`${base}/api/profile/flip-hourglass`, { method: 'POST' });
    assert.strictEqual(snapshot.crossings.length, crossingCount);

    snapshot = await json(`${base}/api/profile/reset`, { method: 'POST' });
    assert.deepStrictEqual(snapshot.composition, { Fire: 10, Water: 1 });
    assert.strictEqual(snapshot.revision, 0);
    assert.strictEqual(snapshot.crossings.length, 0);
    assert.strictEqual(snapshot.clock.address, '0:0:0:0');

    const rootResponse = await fetch(`${base}/`);
    assert.strictEqual(rootResponse.status, 200);
    assert.match(await rootResponse.text(), /elemental profile/);

    console.log('M0.7 elemental profile + Crossing instrument HTTP contract: PASS');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
