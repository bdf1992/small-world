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
    for (const phrase of ['Elemental Profile', 'Relation wheel overlay', 'Element weights', 'Local deformation', 'Contribution matrix']) {
      assert.match(html, new RegExp(phrase));
    }

    const jsResponse = await fetch(`${base}/profile.js`);
    assert.strictEqual(jsResponse.status, 200);
    const js = await jsResponse.text();
    assert.match(js, /api\/profile/);
    assert.match(js, /set-weight/);
    assert.match(js, /set-deformation/);

    let snapshot = await json(`${base}/api/profile`);
    assert.deepStrictEqual(snapshot.composition, { Fire: 10, Water: 1 });
    assert.deepStrictEqual(snapshot.base.composition, { Fire: 10, Water: 1 });
    assert.deepStrictEqual(snapshot.effective.composition, { Fire: 10, Water: 2 });
    assert.strictEqual(snapshot.deformation.origin, 'Water');
    assert.strictEqual(snapshot.deformation.factor, 2);
    assert.strictEqual(snapshot.measurement.changed, true);

    snapshot = await json(`${base}/api/profile/set-weight?element=Ground&weight=3`, { method: 'POST' });
    assert.deepStrictEqual(snapshot.base.composition, { Fire: 10, Ground: 3, Water: 1 });
    assert.deepStrictEqual(snapshot.effective.composition, { Fire: 10, Ground: 3, Water: 2 });

    snapshot = await json(`${base}/api/profile/set-deformation?origin=Fire&factor=0.5`, { method: 'POST' });
    assert.deepStrictEqual(snapshot.base.composition, { Fire: 10, Ground: 3, Water: 1 });
    assert.deepStrictEqual(snapshot.effective.composition, { Fire: 5, Ground: 3, Water: 1 });
    assert.strictEqual(snapshot.trace[0].source, 'Property.ProfileScale');
    assert.strictEqual(snapshot.trace[0].before, 10);
    assert.strictEqual(snapshot.trace[0].after, 5);

    snapshot = await json(`${base}/api/profile/reset`, { method: 'POST' });
    assert.deepStrictEqual(snapshot.composition, { Fire: 10, Water: 1 });
    assert.strictEqual(snapshot.revision, 0);

    const rootResponse = await fetch(`${base}/`);
    assert.strictEqual(rootResponse.status, 200);
    assert.match(await rootResponse.text(), /elemental profile/);

    console.log('M0.7 elemental profile instrument HTTP contract: PASS');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
