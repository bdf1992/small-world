'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

async function json(url) {
  const response = await fetch(url);
  const body = await response.json();
  return { response, body };
}

async function main() {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const html = await fetch(`${base}/authoring`);
    assert.strictEqual(html.status, 200);
    const htmlText = await html.text();
    assert.match(htmlText, /Resolution Frontier/);
    assert.match(htmlText, /resolutionHops/);
    assert.match(htmlText, /resolutionInstances/);

    const js = await fetch(`${base}/resolution-editor.js`);
    assert.strictEqual(js.status, 200);
    const jsText = await js.text();
    assert.match(jsText, /set-budget/);
    assert.match(jsText, /reset-budget/);
    const css = await fetch(`${base}/resolution-editor.css`);
    assert.strictEqual(css.status, 200);

    let result = await json(`${base}/api/authoring`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.projectionVersion, 6);
    assert.strictEqual(result.body.revision, 0);
    assert.strictEqual(result.body.resolutionRevision, 0);
    assert.strictEqual(result.body.resolution.complete, true);
    assert.strictEqual(result.body.views.landing.type, 'WorldLanding');
    assert.strictEqual(result.body.landing.traceable.length, 6);

    result = await json(`${base}/api/authoring/set-budget?instances=0`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.revision, 0);
    assert.strictEqual(result.body.resolutionRevision, 1);
    assert.strictEqual(result.body.resolution.complete, false);
    assert.ok(result.body.resolution.stops.some((stop) => stop.reason === 'budget.maxInstances'));
    assert.ok(result.body.resolution.virtuals.length > 0);
    assert.deepStrictEqual(result.body.landing.traceable, []);

    result = await json(`${base}/api/authoring/set-budget?hops=4&slots=3&instances=9`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.revision, 0);
    assert.strictEqual(result.body.resolutionRevision, 2);
    assert.ok(result.body.resolution.stops.some((stop) => stop.reason === 'budget.maxSlots'));

    result = await json(`${base}/api/authoring/reset-budget`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.revision, 0);
    assert.strictEqual(result.body.resolutionRevision, 3);
    assert.strictEqual(result.body.resolution.complete, true);
    assert.strictEqual(result.body.views.world.status, 'resolved');
    assert.strictEqual(result.body.landing.traceable.length, 6);

    const invalid = await json(`${base}/api/authoring/set-budget?slots=-1`);
    assert.strictEqual(invalid.response.status, 400);
    assert.match(invalid.body.error, /non-negative integer/);

    console.log(JSON.stringify({
      pass: true,
      httpResolution: true,
      projectionVersion: result.body.projectionVersion,
      resolutionRevision: result.body.resolutionRevision,
      state: result.body.resolution.state,
      landed: result.body.landing.traceable.length,
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
