'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

function guardian(snapshot) {
  const mountains = snapshot.views.world.objects['region:mountains'];
  const situation = snapshot.views.world.objects[mountains.children[0].key];
  const child = situation.children.find((candidate) => candidate.role === 'guardian');
  return snapshot.views.world.objects[child.key];
}

async function call(base, path) {
  const response = await fetch(`${base}${path}`);
  const body = await response.json();
  return { response, body };
}

async function main() {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    assert.strictEqual((await fetch(`${base}/pack-editor.js`)).status, 200);
    assert.strictEqual((await fetch(`${base}/pack-editor.css`)).status, 200);

    let result = await call(base, '/api/authoring/clone-card?card=persona.dragon&id=persona.ice-dragon');
    assert.strictEqual(result.response.status, 200);
    result = await call(base, '/api/authoring/set-card-fixed?card=persona.ice-dragon&field=species&value=Ice%20Dragon');
    assert.strictEqual(result.response.status, 200);
    result = await call(base, '/api/authoring/connect-card?slot=guardian&card=persona.ice-dragon&weight=1');
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.editor.pack.slots.guardian.candidates['persona.ice-dragon'], 1);
    result = await call(base, '/api/authoring/focus-pack-candidate?slot=guardian&card=persona.ice-dragon');
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(guardian(result.body).label, 'Ice Dragon');
    assert.strictEqual(guardian(result.body).facts.templateId, 'persona.ice-dragon');

    result = await call(base, '/api/authoring/create-card?grammar=Artifact%2FItem&id=item.frozen-crown');
    assert.strictEqual(result.response.status, 200);
    const mismatch = await call(base, '/api/authoring/connect-card?slot=guardian&card=item.frozen-crown&weight=1');
    assert.strictEqual(mismatch.response.status, 400);
    assert.match(mismatch.body.error, /Requirement mismatch/);
    const treasure = await call(base, '/api/authoring/connect-card?slot=treasure&card=item.frozen-crown&weight=1');
    assert.strictEqual(treasure.response.status, 200);

    console.log(JSON.stringify({ pass: true, httpPackCircuit: true, authoredGuardian: guardian(result.body).label }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
