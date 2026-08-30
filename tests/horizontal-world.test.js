'use strict';

const assert = require('assert');
const { createSolveBudget } = require('../src/kernel/budget');
const { solveGraph } = require('../src/kernel/dag');
const { templates } = require('../src/content/catalog');
const { createHorizontalWorld } = require('../src/runtime/horizontal-world');

const expectedTemplates = [
  'persona.bandit', 'persona.bear', 'persona.dragon',
  'biome.swamp', 'biome.desert', 'biome.mountains',
  'item.sword', 'item.staff', 'item.shield',
  'pack.cave', 'pack.ruin', 'pack.spire',
];
for (const id of expectedTemplates) assert.ok(templates[id], `missing template ${id}`);

const compiled = createHorizontalWorld(93208);
assert.strictEqual(compiled.regionGraph.kind, 'RegionGraph');
assert.strictEqual(compiled.regionGraph.byId.size, 3);

for (const region of compiled.regionGraph.byId.values()) {
  assert.strictEqual(region.kind, 'Region');
  assert.ok(region.extent.measure > 0);
  assert.strictEqual(region.boundary.neighbors.length, 2);
  assert.ok(region.artifactId);
  assert.ok(region.slots.situation);
  // Spatial simulation is graph-based; no geometry is required in the Region contract.
  assert.ok(!Object.prototype.hasOwnProperty.call(region, 'x'));
  assert.ok(!Object.prototype.hasOwnProperty.call(region, 'polygon'));
}

for (const biome of Object.values(compiled.biomeInstances)) {
  assert.strictEqual(biome.stage, 'instance');
  assert.strictEqual(biome.grammar, 'Artifact/Biome');
  assert.ok(biome.attributes.primaryElement);
  assert.ok(biome.attributes.field);
}

const fullBudget = createSolveBudget({ maxHops: 4, maxSlots: 6, maxInstances: 9 });
const solved = solveGraph({ graph: compiled.graph, target: compiled.target, budget: fullBudget });
assert.strictEqual(solved.result.state, 'resolved');
assert.strictEqual(solved.result.value.kind, 'World');
assert.strictEqual(solved.result.value.regions.length, 3);
assert.strictEqual(solved.result.value.situations.length, 3);
assert.strictEqual(solved.usage.slots, 6);
assert.strictEqual(solved.usage.instances, 9);

const forms = solved.result.value.situations.map((situation) => situation.packForm).sort();
assert.deepStrictEqual(forms, ['Cave', 'Ruin', 'Spire']);
for (const situation of solved.result.value.situations) {
  assert.strictEqual(situation.stage, 'instance');
  assert.strictEqual(situation.kind, 'Situation');
  assert.ok(compiled.regionGraph.byId.has(situation.regionId));
  assert.strictEqual(Object.keys(situation.members).length, 2);
  assert.strictEqual(situation.members.guardian.stage, 'instance');
  assert.strictEqual(situation.members.treasure.stage, 'instance');
  assert.ok(situation.members.guardian.grammar === 'Artifact/Persona');
  assert.ok(situation.members.treasure.grammar === 'Artifact/Item');
}

// A Situation is the realized Pack. POI remains a spatial presentation concern;
// the runtime object is not required to invent a second POI entity.
assert.ok(solved.result.value.situations.every((situation) => !situation.poiId));

// Global slot exhaustion leaves Pack Virtuals visible while preventing a full world.
const slotLimited = solveGraph({
  graph: compiled.graph,
  target: compiled.target,
  budget: createSolveBudget({ maxHops: 4, maxSlots: 3, maxInstances: 9 }),
});
assert.strictEqual(slotLimited.result.state, 'unresolved');
assert.ok(slotLimited.stops.some((entry) => entry.reason === 'budget.maxSlots'));
assert.ok(slotLimited.trace.some((entry) => entry.nodeId.endsWith('.pack.virtual') && entry.state === 'resolved'));
assert.ok(slotLimited.usage.slots <= 3);

// Zero Instance budget can still explore through Card and Pack Virtuals.
const virtualWorld = solveGraph({
  graph: compiled.graph,
  target: compiled.target,
  budget: createSolveBudget({ maxHops: 4, maxSlots: 6, maxInstances: 0 }),
});
assert.strictEqual(virtualWorld.result.state, 'unresolved');
assert.strictEqual(virtualWorld.usage.instances, 0);
assert.ok(virtualWorld.trace.some((entry) => entry.nodeId.endsWith('.pack.virtual') && entry.state === 'resolved'));
assert.ok(virtualWorld.trace.some((entry) => entry.nodeId.endsWith('.guardian.virtual') && entry.state === 'resolved'));
assert.ok(virtualWorld.stops.some((entry) => entry.reason === 'budget.maxInstances'));

// Hop budget can deliberately stop before Card choice/virtualization without invalid state.
const shallow = solveGraph({
  graph: compiled.graph,
  target: compiled.target,
  budget: createSolveBudget({ maxHops: 2, maxSlots: 6, maxInstances: 9 }),
});
assert.strictEqual(shallow.result.state, 'unresolved');
assert.ok(shallow.stops.some((entry) => entry.reason === 'budget.maxHops'));

// Full world replay is exact.
const replayCompiled = createHorizontalWorld(93208);
const replay = solveGraph({ graph: replayCompiled.graph, target: replayCompiled.target, budget: fullBudget });
assert.deepStrictEqual(solved.result.value, replay.result.value);

console.log(JSON.stringify({
  pass: true,
  templateCount: expectedTemplates.length,
  regionCount: compiled.regionGraph.byId.size,
  situationCount: solved.result.value.situations.length,
  usage: solved.usage,
  situations: solved.result.value.situations.map((situation) => ({
    id: situation.id,
    regionId: situation.regionId,
    packForm: situation.packForm,
    guardian: {
      id: situation.members.guardian.id,
      templateId: situation.members.guardian.templateId,
      attributes: situation.members.guardian.attributes,
      rarity: situation.members.guardian.rarity,
    },
    treasure: {
      id: situation.members.treasure.id,
      templateId: situation.members.treasure.templateId,
      attributes: situation.members.treasure.attributes,
      rarity: situation.members.treasure.rarity,
    },
  })),
}, null, 2));
