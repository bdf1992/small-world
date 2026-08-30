'use strict';

const assert = require('assert');
const { resolveWorld, normalizeRequest } = require('../src/app/world');
const { parseWorldRequest } = require('../scripts/workbench');

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

const dragon = Object.values(full.objects).find((object) => object.kind === 'Artifact' && object.label === 'Dragon');
assert.ok(dragon);
assert.strictEqual(dragon.stage, 'instance');
assert.ok(dragon.lineage.some((step) => step.stage === 'virtual'));

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

console.log(JSON.stringify({
  pass: true,
  projectionVersion: full.projectionVersion,
  objects: Object.keys(full.objects).length,
  regions: full.map.regions.length,
  edges: full.map.edges.length,
  unresolvedVirtuals: unresolved.unresolved.length,
}, null, 2));
