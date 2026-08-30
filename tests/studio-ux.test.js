'use strict';

const assert = require('assert');
const { buildStudioProjection, resolveStudioCandidate } = require('../src/app/studio');
const { createWorkbenchServer } = require('../scripts/workbench');

async function main() {
  const dragonish = resolveStudioCandidate({ kind: 'persona', profile: 'scaled', seed: 93208 });
  assert.strictEqual(dragonish.template.id, 'card.persona');
  assert.strictEqual(dragonish.instance.name.includes('Dragon'), true);
  assert.strictEqual(dragonish.template.fixed?.species, undefined);

  const mantis = resolveStudioCandidate({ kind: 'persona', profile: 'chitin', seed: 93208 });
  assert.strictEqual(mantis.template.id, 'card.persona');
  assert.strictEqual(mantis.instance.name.includes('Mantis'), true);

  const lantern = resolveStudioCandidate({ kind: 'item', profile: 'light', seed: 93208 });
  assert.strictEqual(lantern.template.id, 'card.item');
  assert.strictEqual(lantern.instance.name.includes('Lantern'), true);

  const observatory = resolveStudioCandidate({ kind: 'situation', profile: 'observe', seed: 93208 });
  assert.strictEqual(observatory.template.id, 'pack.situation');
  assert.strictEqual(observatory.instance.name.includes('Observatory'), true);

  const studio = buildStudioProjection({ seed: 93208, kind: 'persona', profile: 'scaled' });
  assert.strictEqual(studio.mode, 'studio');
  assert.strictEqual(studio.vocabulary.card, 'generates possibility');
  assert.strictEqual(studio.vocabulary.token, 'names/classifies an outcome');
  assert.strictEqual(studio.composition.slots[0].requirement, 'Artifact/Persona × 1');
  assert.strictEqual(studio.composition.slots[1].requirement, 'Artifact/Item × 1');
  assert.ok(studio.candidate.virtual.tokenPacks.length >= 2);
  assert.ok(studio.candidate.instance.tokenPacks.some((pack) => pack.entries.some((entry) => entry.matched)));

  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const html = await fetch(`${base}/studio`);
    assert.strictEqual(html.status, 200);
    const htmlText = await html.text();
    for (const utility of ['Explore', 'Generate', 'Compose', 'Resolve', 'Name', 'Inspect']) assert.match(htmlText, new RegExp(`>${utility}<`));
    assert.doesNotMatch(htmlText, /Dragon Card|Spire Pack/);

    const css = await fetch(`${base}/studio.css`);
    assert.strictEqual(css.status, 200);
    assert.match(await css.text(), /\.utility-rail/);

    const js = await fetch(`${base}/studio.js`);
    assert.strictEqual(js.status, 200);
    const jsText = await js.text();
    assert.match(jsText, /\/api\/studio/);
    assert.doesNotMatch(jsText, /\/api\/authoring/);

    const api = await fetch(`${base}/api/studio?seed=93208&kind=item&profile=light`);
    assert.strictEqual(api.status, 200);
    const projection = await api.json();
    assert.strictEqual(projection.candidate.template.id, 'card.item');
    assert.match(projection.candidate.instance.name, /Lantern/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(JSON.stringify({
    pass: true,
    genericGenerators: ['card.persona', 'card.item', 'pack.situation'],
    tokenOutcomes: [dragonish.instance.name, mantis.instance.name, lantern.instance.name, observatory.instance.name],
    utilities: ['Explore', 'Generate', 'Compose', 'Resolve', 'Name', 'Inspect'],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
