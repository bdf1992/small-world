'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

async function text(url) {
  const response = await fetch(url);
  return { response, body: await response.text() };
}
async function json(url) {
  const response = await fetch(url);
  return { response, body: await response.json() };
}

async function main() {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const before = await json(`${base}/api/authoring`);
    assert.strictEqual(before.response.status, 200);
    assert.strictEqual(before.body.projectionVersion, 6);
    assert.strictEqual(before.body.revision, 0);
    assert.strictEqual(before.body.resolutionRevision, 0);

    const world = await text(`${base}/`);
    assert.strictEqual(world.response.status, 200);
    assert.match(world.body, /world-language\.css/);
    assert.match(world.body, /data-sw-domain="instrument"/);
    assert.match(world.body, /data-sw-domain="dynamic"/);

    const authoring = await text(`${base}/authoring`);
    assert.strictEqual(authoring.response.status, 200);
    assert.match(authoring.body, /world-language\.css/);
    assert.match(authoring.body, /world-language\.js/);
    assert.match(authoring.body, /data-sw-domain="authoring"/);
    assert.match(authoring.body, /data-sw-domain="resolution"/);
    assert.match(authoring.body, /data-sw-domain="evidence"/);

    const css = await text(`${base}/world-language.css`);
    assert.strictEqual(css.response.status, 200);
    assert.match(css.response.headers.get('content-type') ?? '', /text\/css/);
    assert.match(css.body, /M0\.7-G visual-language contract/);

    const js = await text(`${base}/world-language.js`);
    assert.strictEqual(js.response.status, 200);
    assert.match(js.response.headers.get('content-type') ?? '', /text\/javascript/);
    assert.match(js.body, /syncAuthoringDomain/);
    assert.doesNotMatch(js.body, /\bfetch\s*\(/);

    const after = await json(`${base}/api/authoring`);
    assert.strictEqual(after.response.status, 200);
    assert.strictEqual(after.body.projectionVersion, 6);
    assert.strictEqual(after.body.revision, before.body.revision, 'requesting visual assets must not mutate authored truth');
    assert.strictEqual(after.body.resolutionRevision, before.body.resolutionRevision, 'requesting visual assets must not mutate runtime resolution truth');

    console.log(JSON.stringify({
      pass: true,
      httpVisualLanguage: true,
      projectionVersion: after.body.projectionVersion,
      authorRevision: after.body.revision,
      resolutionRevision: after.body.resolutionRevision,
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
