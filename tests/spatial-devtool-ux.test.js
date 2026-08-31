'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

async function main() {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const pageResponse = await fetch(`${base}/`);
    assert.strictEqual(pageResponse.status, 200);
    const page = await pageResponse.text();
    const cssResponse = await fetch(`${base}/parity.css`);
    assert.strictEqual(cssResponse.status, 200);
    const css = await cssResponse.text();

    assert.match(page, /Spatial Developer Instrument/);
    assert.match(page, /select → focus → inspect/);
    assert.match(page, /class="workspace"/);
    assert.match(page, /class="side-grid focus-rail"/);
    assert.match(page, /class="instrument-dock"/);
    assert.match(page, /Field topology evidence/);
    assert.match(page, /Spawn \/ relation context/);
    assert.match(page, /id="inspectorDrawer"/);
    assert.match(page, /function revealInspector\(\)/);
    assert.match(page, /drawer\.open = true/);

    const mapIndex = page.indexOf('id="world"');
    const focusIndex = page.indexOf('id="selected"');
    const clockIndex = page.indexOf('id="clock"');
    const hourglassIndex = page.indexOf('id="hourglass"');
    const inspectorIndex = page.indexOf('id="inspectorDrawer"');
    assert.ok(mapIndex >= 0 && focusIndex > mapIndex, 'map must precede focused detail');
    assert.ok(clockIndex > focusIndex && hourglassIndex > clockIndex, 'instruments must follow selected focus');
    assert.ok(inspectorIndex > hourglassIndex, 'deep Inspector must not compete with primary map/focus hierarchy');

    assert.match(page, /<details class="map-evidence-drawer drawer">[\s\S]*id="zoneSummary"/);
    assert.match(page, /<details class="panel side-panel drawer context-drawer sw-frame" data-sw-domain="resolution" open>/);
    assert.match(page, /<details id="inspectorDrawer" class="panel deep-panel inspector-panel drawer sw-frame"/);
    assert.doesNotMatch(page, /<details id="inspectorDrawer"[^>]* open/);

    for (const id of ['world', 'zoneSummary', 'clock', 'clockReadout', 'selected', 'spawnExplain', 'timeTransfer', 'hourglass', 'objectInspector', 'generative', 'ledger']) {
      assert.strictEqual(count(page, `id="${id}"`), 1, `${id} must remain a single stable projection target`);
    }

    assert.match(css, /\.workspace\{[^}]*grid-template-columns:minmax\(720px,1fr\)/);
    assert.match(css, /\.focus-rail\{[^}]*position:sticky/);
    assert.match(css, /\.instrument-dock\{[^}]*grid-template-columns:1fr 1fr/);
    assert.match(css, /\.deep-workspace\{[^}]*grid-template-columns:1\.3fr 1fr 1fr/);
    assert.doesNotMatch(page, /dynamicRelationWeight/);
    assert.doesNotMatch(page, /dynamicSignedScore/);

    console.log('M0.7 spatial developer UX hierarchy contract: PASS');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
