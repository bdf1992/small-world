'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

async function json(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

function roleObject(snapshot, role) {
  const mountains = snapshot.views.world.objects['region:mountains'];
  assert.ok(mountains?.children?.[0]);
  const situation = snapshot.views.world.objects[mountains.children[0].key];
  assert.ok(situation);
  const child = situation.children.find((candidate) => candidate.role === role);
  assert.ok(child);
  return snapshot.views.world.objects[child.key];
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
    assert.match(htmlText, /world-lineage\.js/);
    assert.match(htmlText, /world-lineage\.css/);

    const js = await fetch(`${base}/world-lineage.js`);
    assert.strictEqual(js.status, 200);
    assert.match(await js.text(), /Backward custody/);
    const css = await fetch(`${base}/world-lineage.css`);
    assert.strictEqual(css.status, 200);

    let result = await json(`${base}/api/authoring`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.projectionVersion, 6);
    assert.strictEqual(result.body.landing.state, 'resolved');
    assert.strictEqual(result.body.landing.traceable.length, 6);

    result = await json(`${base}/api/authoring/clone-card?card=persona.dragon&id=persona.ice-dragon`);
    assert.strictEqual(result.response.status, 200);
    result = await json(`${base}/api/authoring/set-card-fixed?card=persona.ice-dragon&field=species&value=Ice%20Dragon`);
    assert.strictEqual(result.response.status, 200);
    result = await json(`${base}/api/authoring/connect-card?slot=guardian&card=persona.ice-dragon&weight=1`);
    assert.strictEqual(result.response.status, 200);
    result = await json(`${base}/api/authoring/focus-pack-candidate?slot=guardian&card=persona.ice-dragon`);
    assert.strictEqual(result.response.status, 200);

    const guardian = roleObject(result.body, 'guardian');
    assert.strictEqual(guardian.label, 'Ice Dragon');
    const trace = result.body.landing.byObject[guardian.key];
    assert.ok(trace);
    assert.strictEqual(trace.card.id, 'persona.ice-dragon');
    assert.strictEqual(trace.card.authored, true);
    assert.strictEqual(trace.pack.id, 'pack.spire');
    assert.strictEqual(trace.pack.slot, 'guardian');
    assert.strictEqual(trace.pack.requirement.accepts, 'Artifact/Persona');
    assert.deepStrictEqual(trace.lifecycle.map((step) => step.stage), ['definition', 'template', 'reference', 'virtual', 'instance']);

    const exportedResponse = await fetch(`${base}/api/authoring/document.txt`);
    const exported = await exportedResponse.text();
    assert.ok(exported.includes('persona.ice-dragon'));

    result = await json(`${base}/api/authoring/reset?seed=93208`);
    assert.strictEqual(roleObject(result.body, 'guardian').label, 'Dragon');

    result = await json(`${base}/api/authoring/document`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: exported,
    });
    assert.strictEqual(result.response.status, 200);
    const importedGuardian = roleObject(result.body, 'guardian');
    assert.strictEqual(importedGuardian.label, 'Ice Dragon');
    assert.strictEqual(result.body.landing.byObject[importedGuardian.key].card.id, 'persona.ice-dragon');

    result = await json(`${base}/api/authoring/set-budget?hops=4&slots=6&instances=0`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.views.world.status, 'unresolved');
    assert.strictEqual(result.body.landing.state, 'unresolved');
    assert.deepStrictEqual(result.body.landing.traceable, []);
    assert.deepStrictEqual(result.body.landing.byObject, {});

    result = await json(`${base}/api/authoring/reset-budget`);
    assert.strictEqual(result.response.status, 200);
    const restoredGuardian = roleObject(result.body, 'guardian');
    assert.strictEqual(restoredGuardian.label, 'Ice Dragon');
    assert.ok(result.body.landing.byObject[restoredGuardian.key]);

    console.log(JSON.stringify({
      pass: true,
      httpLanding: true,
      projectionVersion: result.body.projectionVersion,
      traceable: result.body.landing.traceable.length,
      guardian: restoredGuardian.label,
      source: result.body.landing.byObject[restoredGuardian.key].card.id,
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
