'use strict';

const { createSolveBudget } = require('../src/kernel/budget');
const { solveGraph } = require('../src/kernel/dag');
const { createHorizontalWorld } = require('../src/runtime/horizontal-world');
const { inspectWorld } = require('../src/inspect/inspect');

function readInt(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = Number(argv[index + 1]);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return value;
}

function formatField(attributes = {}) {
  return Object.entries(attributes)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => `${name} ${(value * 100).toFixed(1)}%`)
    .join(' · ');
}

function main(argv = process.argv.slice(2)) {
  const seed = readInt(argv, 'seed', 93208);
  const budgetSpec = {
    maxHops: readInt(argv, 'hops', 4),
    maxSlots: readInt(argv, 'slots', 6),
    maxInstances: readInt(argv, 'instances', 9),
  };

  const compiled = createHorizontalWorld(seed);
  const budget = createSolveBudget(budgetSpec);
  const solve = solveGraph({ graph: compiled.graph, target: compiled.target, budget });

  console.log('Small World — M0.6 owner QA');
  console.log(`seed=${seed}  hops=${budget.maxHops}  slots=${budget.maxSlots}  instances=${budget.maxInstances}`);
  console.log(`status=${solve.result.state}  usage=h${solve.usage.maxHopReached}/s${solve.usage.slots}/i${solve.usage.instances}`);
  console.log('');
  console.log('REGIONS');
  for (const region of compiled.regionGraph.byId.values()) {
    console.log(`- ${region.id} -> [${region.boundary.neighbors.join(', ')}]`);
    console.log(`  field: ${formatField(region.attributes)}`);
  }

  if (solve.result.state === 'resolved') {
    const view = inspectWorld(solve.result.value);
    console.log('');
    console.log('SITUATIONS');
    for (const situation of view.situations) {
      const members = Object.entries(situation.members)
        .map(([slot, member]) => `${slot}=${member.templateId}`)
        .join(', ');
      console.log(`- ${situation.regionId}: ${situation.packForm} (${members})`);
    }
  } else {
    const virtuals = solve.trace
      .filter((entry) => entry.state === 'resolved' && entry.value?.stage === 'virtual')
      .map((entry) => entry.value);
    console.log('');
    console.log('RESOLVED VIRTUALS');
    if (!virtuals.length) console.log('- none within this budget');
    for (const virtual of virtuals) {
      const possibilityKeys = Object.keys(virtual.possibilities ?? {});
      const slotKeys = Object.keys(virtual.slots ?? {});
      console.log(`- ${virtual.id} [${virtual.grammar}] possibilities=[${possibilityKeys.join(', ')}] slots=[${slotKeys.join(', ')}]`);
    }
  }

  console.log('');
  console.log('FRONTIER / STOPS');
  if (!solve.stops.length) console.log('- none');
  for (const stop of solve.stops) {
    const detail = Object.entries(stop)
      .filter(([key]) => !['reason'].includes(key))
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');
    console.log(`- ${stop.reason}${detail ? ` ${detail}` : ''}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main, readInt, formatField };
