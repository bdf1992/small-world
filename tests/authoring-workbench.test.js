'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

async function main() {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const htmlResponse = await fetch(`${base}/authoring`);
    assert.strictEqual(htmlResponse.status, 200);
    const html = await htmlResponse.text();
    assert.match(html, /Authoring & Resolution/);
    assert.match(html, /Card/);
    assert.match(html, /Pack/);
    assert.match(html, /Resolution/);

    const jsResponse = await fetch(`${base}/authoring.js`);
    assert.strictEqual(jsResponse.status, 200);
    assert.match(await jsResponse.text(), /api\/authoring/);

    const apiResponse = await fetch(`${base}/api/authoring?seed=93208`);
    assert.strictEqual(apiResponse.status, 200);
    const projection = await apiResponse.json();
    assert.strictEqual(projection.seed, 93208);
    assert.strictEqual(projection.views.card.root, 'persona.dragon');
    assert.strictEqual(projection.views.pack.root, 'pack.spire');
    assert.strictEqual(projection.views.graph.type, 'Scenario');
    assert.strictEqual(projection.views.resolution.type, 'Resolution');
    assert.strictEqual(projection.views.world.status, 'resolved');

    const graph = projection.views.graph;
    assert.ok(graph.tuples.some((tuple) => tuple.predicate === 'requires'));
    assert.ok(graph.tuples.some((tuple) => tuple.predicate === 'emits'));
    assert.ok(graph.tuples.some((tuple) => tuple.predicate === 'influences'));

    const alternate = await fetch(`${base}/api/authoring?seed=42`);
    assert.strictEqual(alternate.status, 200);
    const alternateProjection = await alternate.json();
    assert.strictEqual(alternateProjection.seed, 42);
    assert.strictEqual(alternateProjection.views.card.root, projection.views.card.root);
    assert.strictEqual(alternateProjection.views.pack.root, projection.views.pack.root);

    const invalid = await fetch(`${base}/api/authoring?seed=-1`);
    assert.strictEqual(invalid.status, 400);

    console.log(JSON.stringify({
      pass: true,
      httpAuthoring: true,
      graphTuples: graph.tuples.length,
      resolutionTuples: projection.views.resolution.tuples.length,
      worldObjects: Object.keys(projection.views.world.objects).length,
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
