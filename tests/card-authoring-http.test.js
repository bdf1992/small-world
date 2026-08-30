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

    const js = await fetch(`${base}/card-editor.js`);
    assert.strictEqual(js.status, 200);
    assert.match(await js.text(), /clone-card/);
    const css = await fetch(`${base}/card-editor.css`);
    assert.strictEqual(css.status, 200);

    let result = await json(`${base}/api/authoring/clone-card?card=persona.dragon&id=persona.ice-dragon`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.editor.selectedCardId, 'persona.ice-dragon');

    result = await json(`${base}/api/authoring/set-card-fixed?card=persona.ice-dragon&field=species&value=Ice%20Dragon`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.preview.instance.properties.species, 'Ice Dragon');

    result = await json(`${base}/api/authoring/set-card-weight?card=persona.ice-dragon&field=rarity&candidate=T3&weight=0`);
    assert.strictEqual(result.response.status, 200);
    result = await json(`${base}/api/authoring/set-card-weight?card=persona.ice-dragon&field=rarity&candidate=T4&weight=0`);
    assert.strictEqual(result.response.status, 200);
    result = await json(`${base}/api/authoring/set-card-weight?card=persona.ice-dragon&field=rarity&candidate=T5&weight=1`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.preview.instance.rarity, 'T5');

    result = await json(`${base}/api/authoring/rename-card?card=persona.ice-dragon&id=persona.frost-dragon`);
    assert.strictEqual(result.response.status, 200);
    assert.ok(result.body.editor.cards['persona.frost-dragon']);

    result = await json(`${base}/api/authoring/create-card?grammar=Artifact%2FItem&id=item.frozen-crown`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.preview.instance.grammar, 'Artifact/Item');

    result = await json(`${base}/api/authoring/delete-card?card=item.frozen-crown`);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.editor.selectedCardId, 'persona.dragon');

    const invalid = await json(`${base}/api/authoring/create-card?id=Bad%20Id`);
    assert.strictEqual(invalid.response.status, 400);

    console.log(JSON.stringify({ pass: true, httpCardCrud: true }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
