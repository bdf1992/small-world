'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

async function json(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

function guardian(projection) {
  const mountains = projection.views.world.objects['region:mountains'];
  assert.ok(mountains);
  const situation = projection.views.world.objects[mountains.children[0].key];
  assert.ok(situation);
  const child = situation.children.find((candidate) => candidate.role === 'guardian');
  assert.ok(child);
  return projection.views.world.objects[child.key];
}

async function main() {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const html = await fetch(`${base}/authoring`);
    assert.strictEqual(html.status, 200);
    assert.match(await html.text(), /Authoring Document/);
    const js = await fetch(`${base}/document-editor.js`);
    assert.strictEqual(js.status, 200);
    assert.match(await js.text(), /api\/authoring\/document/);
    const css = await fetch(`${base}/document-editor.css`);
    assert.strictEqual(css.status, 200);

    let result = await json(`${base}/api/authoring/clone-card?card=persona.dragon&id=persona.ice-dragon`);
    assert.strictEqual(result.response.status, 200);
    result = await json(`${base}/api/authoring/set-card-fixed?card=persona.ice-dragon&field=species&value=Ice%20Dragon`);
    assert.strictEqual(result.response.status, 200);
    result = await json(`${base}/api/authoring/connect-card?slot=guardian&card=persona.ice-dragon&weight=1`);
    assert.strictEqual(result.response.status, 200);
    result = await json(`${base}/api/authoring/focus-pack-candidate?slot=guardian&card=persona.ice-dragon`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(guardian(result.body).label, 'Ice Dragon');

    const objectExport = await json(`${base}/api/authoring/document`);
    assert.strictEqual(objectExport.response.status, 200);
    assert.strictEqual(objectExport.body.format, 'small-world.authoring');
    assert.strictEqual(objectExport.body.version, 1);
    assert.ok(objectExport.body.cards['persona.ice-dragon']);
    assert.strictEqual(objectExport.body.seed, undefined);

    const textResponse = await fetch(`${base}/api/authoring/document.txt`);
    assert.strictEqual(textResponse.status, 200);
    const exported = await textResponse.text();
    assert.ok(exported.endsWith('\n'));
    assert.ok(!exported.includes('"budget"'));
    assert.ok(!exported.includes('"virtualId"'));

    result = await json(`${base}/api/authoring/reset?seed=93208`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(guardian(result.body).label, 'Dragon');
    assert.strictEqual(result.body.revision, 0);

    result = await json(`${base}/api/authoring/document`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: exported,
    });
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.revision, 1);
    assert.strictEqual(result.body.resolutionRevision, 0);
    assert.strictEqual(guardian(result.body).label, 'Ice Dragon');
    assert.strictEqual(guardian(result.body).facts.templateId, 'persona.ice-dragon');

    const reexportResponse = await fetch(`${base}/api/authoring/document.txt`);
    const reexported = await reexportResponse.text();
    assert.strictEqual(reexported, exported, 'HTTP import/export round trip changed document bytes');

    const invalidDocument = JSON.parse(exported);
    invalidDocument.version = 2;
    const invalid = await json(`${base}/api/authoring/document`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(invalidDocument),
    });
    assert.strictEqual(invalid.response.status, 400);
    assert.match(invalid.body.error, /version must be 1/);

    const afterInvalidResponse = await fetch(`${base}/api/authoring/document.txt`);
    assert.strictEqual(await afterInvalidResponse.text(), exported, 'failed HTTP import mutated current authored document');
    const current = await json(`${base}/api/authoring`);
    assert.strictEqual(current.body.revision, 1);
    assert.strictEqual(guardian(current.body).label, 'Ice Dragon');

    console.log(JSON.stringify({
      pass: true,
      httpRoundTrip: true,
      bytes: exported.length,
      cards: Object.keys(objectExport.body.cards).length,
      guardian: guardian(current.body).label,
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
