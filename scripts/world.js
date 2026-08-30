'use strict';

const { resolveWorld } = require('../src/app/world');

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
  const budget = {
    maxHops: readInt(argv, 'hops', 4),
    maxSlots: readInt(argv, 'slots', 6),
    maxInstances: readInt(argv, 'instances', 9),
  };
  const view = resolveWorld({ seed, budget });

  console.log('Small World — M0.6 owner QA');
  console.log(`seed=${view.seed}  hops=${view.budget.maxHops}  slots=${view.budget.maxSlots}  instances=${view.budget.maxInstances}`);
  console.log(`status=${view.status}  usage=h${view.usage.maxHopReached}/s${view.usage.slots}/i${view.usage.instances}`);
  console.log('');
  console.log('REGIONS');

  for (const region of view.map.regions) {
    console.log(`- ${region.id} -> [${region.neighbors.join(', ')}]`);
    console.log(`  field: ${formatField(region.field)}`);
  }

  if (view.status === 'resolved') {
    console.log('');
    console.log('SITUATIONS');
    for (const region of view.map.regions) {
      for (const child of region.children) {
        const situation = view.objects[child.key];
        const members = situation.children.map((member) => `${member.role}=${view.objects[member.key].facts.templateId}`).join(', ');
        console.log(`- ${region.id}: ${situation.label} (${members})`);
      }
    }
  } else {
    console.log('');
    console.log('RESOLVED VIRTUALS');
    if (!view.unresolved.length) console.log('- none within this budget');
    for (const key of view.unresolved) {
      const virtual = view.objects[key];
      const possibilityKeys = Object.keys(virtual.possibilities?.possibilities ?? {});
      const slotKeys = Object.keys(virtual.possibilities?.slots ?? {});
      console.log(`- ${virtual.id} [${virtual.grammar}] possibilities=[${possibilityKeys.join(', ')}] slots=[${slotKeys.join(', ')}]`);
    }
  }

  console.log('');
  console.log('FRONTIER / STOPS');
  if (!view.stops.length) console.log('- none');
  for (const stop of view.stops) {
    const detail = Object.entries(stop)
      .filter(([key]) => key !== 'reason')
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
