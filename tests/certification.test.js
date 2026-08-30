'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createSolveBudget } = require('../src/kernel/budget');
const { createNode, createGraph, solveGraph } = require('../src/kernel/dag');
const { createTemplate } = require('../src/model/lifecycle');
const { compileLifecycleGraph } = require('../src/model/lifecycle-dag');
const { createHorizontalWorld } = require('../src/runtime/horizontal-world');
const { createWorldState, solveWorldStep, commitWorldStep } = require('../src/runtime/step');
const { inspectWorld } = require('../src/inspect/inspect');
const {
  templates,
  referenceTemplate,
  virtualizeSimple,
  realizeSimple,
} = require('../src/content/catalog');
const { personaDefinition, ELEMENTS } = require('../src/content/personas/dragon');
const {
  standardClockTemplate,
  standardHourglassTemplate,
  referenceClock,
  virtualizeClock,
  realizeClock,
  referenceHourglass,
  virtualizeHourglass,
  realizeHourglass,
} = require('../src/content/instruments');
const expectedM05 = require('./fixtures/m0.5-seed-93208.json');
const { runM05Baseline } = require('../src/runtime/m0.5-baseline');

const FULL_BUDGET_SPEC = { maxHops: 4, maxSlots: 6, maxInstances: 9 };
const CERT_SEEDS = [1, 42, 65537, 93208, 99991];

// 1. The legacy executable oracle remains exact.
assert.deepStrictEqual(runM05Baseline({ seed: 93208, ticks: 20 }), expectedM05);

// 2. The scoped authoring catalog remains complete and upstream authoring objects
// do not carry exact runtime Stat maps.
const expectedTemplates = [
  'persona.bandit', 'persona.bear', 'persona.dragon',
  'biome.swamp', 'biome.desert', 'biome.mountains',
  'item.sword', 'item.staff', 'item.shield',
  'pack.cave', 'pack.ruin', 'pack.spire',
];
assert.deepStrictEqual(Object.keys(templates).sort(), expectedTemplates.sort());
for (const template of Object.values(templates)) {
  assert.strictEqual(template.stage, 'template');
  assert.ok(!Object.prototype.hasOwnProperty.call(template, 'stats'), `${template.id} leaked settled stats`);
}
assert.ok(!standardClockTemplate.stats);
assert.ok(!standardHourglassTemplate.stats);

// 3. Full-world replay is exact across multiple seeds.
const seedResults = [];
for (const seed of CERT_SEEDS) {
  const firstCompiled = createHorizontalWorld(seed);
  const secondCompiled = createHorizontalWorld(seed);
  const budget = createSolveBudget(FULL_BUDGET_SPEC);
  const first = solveGraph({ graph: firstCompiled.graph, target: firstCompiled.target, budget });
  const second = solveGraph({ graph: secondCompiled.graph, target: secondCompiled.target, budget });

  assert.strictEqual(first.result.state, 'resolved');
  assert.deepStrictEqual(first.result.value, second.result.value);
  assert.deepStrictEqual(first.usage, second.usage);
  assert.deepStrictEqual(first.stops, second.stops);
  assert.ok(first.usage.maxHopReached <= budget.maxHops);
  assert.ok(first.usage.slots <= budget.maxSlots);
  assert.ok(first.usage.instances <= budget.maxInstances);

  const view = inspectWorld(first.result.value);
  assert.strictEqual(view.regions.length, 3);
  assert.strictEqual(view.situations.length, 3);
  seedResults.push({ seed, usage: first.usage, situations: view.situations.map((s) => s.packForm) });
}

// 4. Budget sweeps replay and never exceed their ceilings. Smaller budgets are
// allowed to produce less-resolved worlds, never invalid over-budget worlds.
const budgetSpecs = [
  { maxHops: 0, maxSlots: 6, maxInstances: 9 },
  { maxHops: 2, maxSlots: 6, maxInstances: 9 },
  { maxHops: 4, maxSlots: 0, maxInstances: 9 },
  { maxHops: 4, maxSlots: 3, maxInstances: 9 },
  { maxHops: 4, maxSlots: 6, maxInstances: 0 },
  FULL_BUDGET_SPEC,
];
const budgetResults = [];
for (const spec of budgetSpecs) {
  const aCompiled = createHorizontalWorld(93208);
  const bCompiled = createHorizontalWorld(93208);
  const a = solveGraph({ graph: aCompiled.graph, target: aCompiled.target, budget: createSolveBudget(spec) });
  const b = solveGraph({ graph: bCompiled.graph, target: bCompiled.target, budget: createSolveBudget(spec) });

  assert.deepStrictEqual(a.result, b.result);
  assert.deepStrictEqual(a.usage, b.usage);
  assert.deepStrictEqual(a.stops, b.stops);
  assert.ok(a.usage.maxHopReached <= Math.max(spec.maxHops + 1, spec.maxHops), 'solver traversed beyond one reported frontier');
  assert.ok(a.usage.slots <= spec.maxSlots);
  assert.ok(a.usage.instances <= spec.maxInstances);
  if (spec.maxHops < FULL_BUDGET_SPEC.maxHops || spec.maxSlots < 6 || spec.maxInstances < 9) {
    assert.strictEqual(a.result.state, 'unresolved');
    assert.ok(a.stops.length > 0);
  }
  budgetResults.push({ spec, state: a.result.state, usage: a.usage, stops: a.stops.map((s) => s.reason) });
}

// 5. New solver/kernel files remain content-agnostic. The frozen M0.5 oracle is
// explicitly excluded from this scan because it preserves legacy behavior.
const kernelDir = path.join(__dirname, '..', 'src', 'kernel');
const forbidden = [
  'dragon', 'bear', 'bandit', 'cave', 'ruin', 'spire',
  'sword', 'staff', 'shield', 'swamp', 'desert', 'mountains',
  'persona', 'poi',
];
const scannedKernelFiles = [];
for (const entry of fs.readdirSync(kernelDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  const filePath = path.join(kernelDir, entry.name);
  const text = fs.readFileSync(filePath, 'utf8').toLowerCase();
  scannedKernelFiles.push(entry.name);
  for (const term of forbidden) {
    assert.ok(!text.includes(term), `${entry.name} contains content term '${term}'`);
  }
}
assert.deepStrictEqual(scannedKernelFiles.sort(), ['address.js', 'budget.js', 'dag.js'].sort());

// 6. A fourth Persona can be authored and run without editing kernel/runtime.
const wolfTemplate = createTemplate(personaDefinition, {
  id: 'persona.wolf',
  fixed: { species: 'Wolf', nature: 'Primal' },
  priors: {
    element: { source: 'context', affinity: 'medium', domain: ELEMENTS },
    rarity: { T1: 0.40, T2: 0.40, T3: 0.15, T4: 0.04, T5: 0.01 },
  },
});
const wolfRegion = {
  id: 'certification-forest',
  attributes: { Ground: 0.40, Water: 0.30, Sky: 0.20, Order: 0.10 },
};
const wolfReference = referenceTemplate(wolfTemplate, {
  id: 'certification.wolf',
  boundary: { region: wolfRegion.id, slot: 'guardian' },
  region: wolfRegion,
});
const wolfGraph = compileLifecycleGraph({
  prefix: 'certification.wolf',
  reference: wolfReference,
  virtualize: (reference) => virtualizeSimple(wolfTemplate, reference),
  realize: (virtual, seed) => realizeSimple(wolfTemplate, virtual, seed),
  seed: 93208,
});
const wolfSolved = solveGraph({
  graph: wolfGraph.graph,
  target: wolfGraph.target,
  budget: createSolveBudget({ maxHops: 2, maxSlots: 0, maxInstances: 1 }),
});
assert.strictEqual(wolfSolved.result.state, 'resolved');
assert.strictEqual(wolfSolved.result.value.templateId, 'persona.wolf');
assert.strictEqual(wolfSolved.result.value.properties.species, 'Wolf');
assert.ok(wolfSolved.result.value.stats);

// 7. Clock and Hourglass independently certify the shared lifecycle/solver path.
const clockReference = referenceClock({ id: 'cert.clock', context: { startingOrientation: 'Day' } });
const clockGraph = compileLifecycleGraph({
  prefix: 'cert.clock',
  reference: clockReference,
  virtualize: virtualizeClock,
  realize: realizeClock,
  seed: 93208,
});
const clockSolved = solveGraph({
  graph: clockGraph.graph,
  target: clockGraph.target,
  budget: createSolveBudget({ maxHops: 2, maxSlots: 0, maxInstances: 1 }),
});
assert.strictEqual(clockSolved.result.value.grammar, 'Instrument/Clock');

const glassReference = referenceHourglass({ id: 'cert.glass', ownerId: wolfSolved.result.value.id });
const glassGraph = compileLifecycleGraph({
  prefix: 'cert.glass',
  reference: glassReference,
  virtualize: virtualizeHourglass,
  realize: realizeHourglass,
  seed: 93208,
});
const glassSolved = solveGraph({
  graph: glassGraph.graph,
  target: glassGraph.target,
  budget: createSolveBudget({ maxHops: 2, maxSlots: 0, maxInstances: 1 }),
});
assert.strictEqual(glassSolved.result.value.grammar, 'Instrument/Hourglass');
assert.strictEqual(glassSolved.result.value.ownerId, wolfSolved.result.value.id);

// 8. Feedback is staged across solve/commit boundaries, never injected as a
// cycle in the current DAG.
function compilePressureStep(state) {
  return {
    target: 'pressure.next',
    graph: createGraph([
      createNode({ id: 'pressure.prior', evaluate: () => state.facts.pressure }),
      createNode({
        id: 'pressure.next',
        inputs: ['pressure.prior'],
        evaluate: ({ inputs }) => inputs['pressure.prior'] + 1,
      }),
    ]),
  };
}
const state0 = createWorldState({ facts: { pressure: 2 } });
const step0 = solveWorldStep({
  state: state0,
  compile: compilePressureStep,
  budget: createSolveBudget({ maxHops: 1, maxSlots: 0, maxInstances: 0 }),
});
assert.strictEqual(step0.solve.result.value, 3);
assert.strictEqual(state0.facts.pressure, 2);
const state1 = commitWorldStep(step0, (prior, nextPressure) => ({
  facts: { ...prior.facts, pressure: nextPressure },
}));
assert.strictEqual(state1.revision, 1);
assert.strictEqual(state1.tick, 1);
assert.strictEqual(state1.facts.pressure, 3);
const step1 = solveWorldStep({
  state: state1,
  compile: compilePressureStep,
  budget: createSolveBudget({ maxHops: 1, maxSlots: 0, maxInstances: 0 }),
});
assert.strictEqual(step1.solve.result.value, 4);

console.log(JSON.stringify({
  pass: true,
  m05Digest: expectedM05.invariants.digest,
  seeds: seedResults,
  budgets: budgetResults,
  kernelFiles: scannedKernelFiles,
  extensionProof: {
    templateId: wolfSolved.result.value.templateId,
    instanceId: wolfSolved.result.value.id,
    grammar: wolfSolved.result.value.grammar,
  },
  instruments: {
    clock: clockSolved.result.value.id,
    hourglass: glassSolved.result.value.id,
  },
  feedback: {
    revision0Pressure: state0.facts.pressure,
    revision1Pressure: state1.facts.pressure,
    nextSolvedPressure: step1.solve.result.value,
  },
}, null, 2));
