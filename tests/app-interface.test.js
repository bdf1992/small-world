'use strict';

const assert = require('assert');
const { resolveWorld, normalizeRequest } = require('../src/app/world');
const { createWorkbenchServer, parseWorldRequest } = require('../scripts/workbench');

async function main() {
  const full = resolveWorld({
    seed: 93208,
    budget: { maxHops: 4, maxSlots: 6, maxInstances: 9 },
  });

  assert.strictEqual(full.projectionVersion, 1);
  assert.strictEqual(full.status, 'resolved');
  assert.strictEqual(full.map.regions.length, 3);
  assert.strictEqual(full.map.edges.length, 3);
  assert.strictEqual(full.roots.length, 3);
  assert.ok(Object.keys(full.objects).length >= 12);

  const requiredObjectKeys = [
    'key', 'id', 'kind', 'label', 'stage', 'grammar',
    'regionId', 'facts', 'possibilities', 'lineage', 'children',
  ];
  for (const object of Object.values(full.objects)) {
    assert.deepStrictEqual(Object.keys(object), requiredObjectKeys);
  }

  const mountains = full.objects['region:mountains'];
  assert.ok(mountains);
  assert.strictEqual(mountains.kind, 'Region');
  assert.strictEqual(mountains.children.length, 1);
  assert.ok(mountains.facts.field.Ground > mountains.facts.field.Fire);

  const spire = full.objects[mountains.children[0].key];
  assert.strictEqual(spire.kind, 'Situation');
  assert.strictEqual(spire.label, 'Spire');
  assert.strictEqual(spire.children.length, 2);
  assert.ok(spire.possibilities);
  assert.ok(spire.possibilities.slots.guardian);

  const dragon = Object.values(full.objects).find((object) => object.kind === 'Artifact' && object.label === 'Dragon');
  assert.ok(dragon);
  assert.strictEqual(dragon.stage, 'instance');
  assert.ok(dragon.lineage.some((step) => step.stage === 'virtual'));
  assert.ok(dragon.possibilities);
  assert.ok(dragon.possibilities.possibilities.element);

  const serialized = JSON.parse(JSON.stringify(full));
  assert.strictEqual(serialized.objects[dragon.key].label, 'Dragon');

  const unresolved = resolveWorld({
    seed: 93208,
    budget: { maxHops: 4, maxSlots: 6, maxInstances: 0 },
  });
  assert.strictEqual(unresolved.status, 'unresolved');
  assert.ok(unresolved.unresolved.length > 0);
  assert.ok(unresolved.stops.some((stop) => stop.reason === 'budget.maxInstances'));
  assert.ok(unresolved.unresolved.every((key) => unresolved.objects[key].kind === 'Virtual'));

  const normalized = normalizeRequest({ seed: 4, budget: { hops: 2, slots: 3, instances: 1 } });
  assert.strictEqual(normalized.budget.maxHops, 2);
  assert.strictEqual(normalized.budget.maxSlots, 3);
  assert.strictEqual(normalized.budget.maxInstances, 1);

  const parsed = parseWorldRequest(new URL('http://localhost/api/world?seed=42&hops=2&slots=3&instances=1'));
  assert.deepStrictEqual(parsed, {
    seed: 42,
    budget: { maxHops: 2, maxSlots: 3, maxInstances: 1 },
  });

  assert.throws(
    () => parseWorldRequest(new URL('http://localhost/api/world?seed=-1')),
    /non-negative integer/,
  );

  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const htmlResponse = await fetch(`http://127.0.0.1:${port}/`);
    assert.strictEqual(htmlResponse.status, 200);
    const html = await htmlResponse.text();
    assert.match(html, /Small World/);
    assert.match(html, /world-controls/);

    const apiResponse = await fetch(`http://127.0.0.1:${port}/api/world?seed=93208&hops=4&slots=6&instances=9`);
    assert.strictEqual(apiResponse.status, 200);
    const apiWorld = await apiResponse.json();
    assert.strictEqual(apiWorld.status, 'resolved');
    assert.strictEqual(apiWorld.projectionVersion, 1);
    assert.ok(apiWorld.objects['region:mountains']);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(JSON.stringify({
    pass: true,
    projectionVersion: full.projectionVersion,
    objects: Object.keys(full.objects).length,
    regions: full.map.regions.length,
    edges: full.map.edges.length,
    unresolvedVirtuals: unresolved.unresolved.length,
    resolvedDragonPossibility: Boolean(dragon.possibilities),
    httpAdapter: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
