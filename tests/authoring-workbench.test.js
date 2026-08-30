'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

function guardianLabel(projection) {
  const mountains = projection.views.world.objects['region:mountains'];
  assert.ok(mountains);
  const situation = projection.views.world.objects[mountains.children[0].key];
  const guardian = situation.children.find((child) => child.role === 'guardian');
  assert.ok(guardian);
  return projection.views.world.objects[guardian.key].label;
}

async function json(url) {
  const response = await fetch(url);
  const value = await response.json();
  return { response, value };
}

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
    assert.match(html, /Reset draft/);
    assert.match(html, /Card library/);
    assert.match(html, /Pack/);
    assert.match(html, /Resolution/);

    const jsResponse = await fetch(`${base}/authoring.js`);
    assert.strictEqual(jsResponse.status, 200);
    const js = await jsResponse.text();
    assert.match(js, /api\/authoring/);
    assert.match(js, /set-weight/);
    assert.match(js, /set-affinity/);

    const initialResult = await json(`${base}/api/authoring?seed=93208`);
    assert.strictEqual(initialResult.response.status, 200);
    const projection = initialResult.value;
    assert.strictEqual(projection.projectionVersion, 3);
    assert.strictEqual(projection.seed, 93208);
    assert.strictEqual(projection.revision, 0);
    assert.strictEqual(projection.editor.selectedCardId, 'persona.dragon');
    assert.strictEqual(projection.views.card.root, 'persona.dragon');
    assert.strictEqual(projection.views.pack.root, 'pack.spire');
    assert.strictEqual(projection.views.graph.type, 'Scenario');
    assert.strictEqual(projection.views.resolution.type, 'Resolution');
    assert.strictEqual(projection.views.world.status, 'resolved');
    assert.strictEqual(guardianLabel(projection), 'Dragon');

    const graph = projection.views.graph;
    assert.ok(graph.tuples.some((tuple) => tuple.predicate === 'requires'));
    assert.ok(graph.tuples.some((tuple) => tuple.predicate === 'emits'));
    assert.ok(graph.tuples.some((tuple) => tuple.predicate === 'influences'));

    let edit = await json(`${base}/api/authoring/set-weight?target=spire&field=guardian&candidate=persona.dragon&weight=0`);
    assert.strictEqual(edit.response.status, 200);
    edit = await json(`${base}/api/authoring/set-weight?target=spire&field=guardian&candidate=persona.bear&weight=0`);
    assert.strictEqual(edit.response.status, 200);
    edit = await json(`${base}/api/authoring/set-weight?target=spire&field=guardian&candidate=persona.bandit&weight=1`);
    assert.strictEqual(edit.response.status, 200);
    assert.strictEqual(edit.value.revision, 3);
    assert.strictEqual(guardianLabel(edit.value), 'Bandit');
    assert.strictEqual(edit.value.draft.spire.slots.guardian.candidates['persona.dragon'], 0);

    const affinity = await json(`${base}/api/authoring/set-affinity?field=element&affinity=weak`);
    assert.strictEqual(affinity.response.status, 200);
    assert.strictEqual(affinity.value.draft.dragon.priors.element.affinity, 'weak');
    assert.strictEqual(affinity.value.revision, 4);

    const invalidWeight = await json(`${base}/api/authoring/set-weight?target=spire&field=guardian&candidate=persona.dragon&weight=-1`);
    assert.strictEqual(invalidWeight.response.status, 400);
    assert.match(invalidWeight.value.error, /non-negative/);

    const reset = await json(`${base}/api/authoring/reset?seed=93208`);
    assert.strictEqual(reset.response.status, 200);
    assert.strictEqual(reset.value.revision, 0);
    assert.strictEqual(guardianLabel(reset.value), 'Dragon');
    assert.strictEqual(reset.value.draft.dragon.priors.element.affinity, 'strong');

    const alternate = await json(`${base}/api/authoring?seed=42`);
    assert.strictEqual(alternate.response.status, 200);
    assert.strictEqual(alternate.value.seed, 42);
    assert.strictEqual(alternate.value.views.card.root, projection.views.card.root);
    assert.strictEqual(alternate.value.views.pack.root, projection.views.pack.root);

    const invalid = await json(`${base}/api/authoring?seed=-1`);
    assert.strictEqual(invalid.response.status, 400);

    console.log(JSON.stringify({
      pass: true,
      httpAuthoring: true,
      projectionVersion: projection.projectionVersion,
      initialGuardian: guardianLabel(projection),
      editedGuardian: guardianLabel(edit.value),
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
