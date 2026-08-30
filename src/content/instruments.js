'use strict';

const { hash64, pickWeighted, unit } = require('../kernel/address');
const {
  createDefinition,
  createTemplate,
  createReference,
  createVirtual,
  createInstance,
} = require('../model/lifecycle');

const clockDefinition = createDefinition({
  id: 'instrument.clock',
  grammar: 'Instrument/Clock',
  sections: ['face', 'hands', 'hours', 'ticks', 'stats', 'state'],
  dimensions: {
    orientation: { kind: 'property', domain: ['Day', 'Night'] },
    advancePerTurn: { kind: 'stat', derived: true },
    currentTick: { kind: 'stat', runtime: true },
    cycle: { kind: 'stat', runtime: true },
  },
  slots: {
    face: { accepts: 'Instrument/ClockFace', count: 1 },
    hands: { accepts: 'Instrument/ClockHand', count: '1..N' },
    hours: { accepts: 'Instrument/Hour', count: 12 },
  },
});

const hourglassDefinition = createDefinition({
  id: 'instrument.hourglass',
  grammar: 'Instrument/Hourglass',
  sections: ['upper', 'neck', 'lower', 'timeless', 'stats', 'state'],
  dimensions: {
    rarity: { kind: 'property', domain: ['T1', 'T2', 'T3', 'T4', 'T5'] },
    capacity: { kind: 'stat', derived: true },
    crossingRate: { kind: 'stat', derived: true },
    integrity: { kind: 'stat', derived: true },
    grainInside: { kind: 'stat', runtime: true },
    grainTimeless: { kind: 'stat', runtime: true },
  },
  slots: {
    lock: { accepts: 'Instrument/HourglassLock', count: '0..1' },
    filter: { accepts: 'Instrument/HourglassFilter', count: '0..1' },
  },
});

const clockFaceDefinition = createDefinition({
  id: 'instrument.clock-face',
  grammar: 'Instrument/ClockFace',
  sections: ['regions', 'rules'],
  dimensions: { regionCount: { kind: 'property' } },
});

const clockHandDefinition = createDefinition({
  id: 'instrument.clock-hand',
  grammar: 'Instrument/ClockHand',
  sections: ['traversal', 'rules'],
  dimensions: {
    direction: { kind: 'property' },
    rateModifier: { kind: 'stat', derived: true },
  },
});

const hourDefinition = createDefinition({
  id: 'instrument.hour',
  grammar: 'Instrument/Hour',
  sections: ['region', 'attributes', 'rules'],
  dimensions: {
    index: { kind: 'property' },
    pressureModifier: { kind: 'stat', derived: true },
  },
});

const standardClockTemplate = createTemplate(clockDefinition, {
  id: 'clock.standard',
  fixed: { positions: 12, ticksPerCycle: 60 },
  priors: {
    orientation: { Day: 0.5, Night: 0.5 },
    advancePerTurn: { '1': 0.72, '2': 0.23, '3': 0.05 },
  },
  rules: {
    tick: 'advance by settled advancePerTurn when a turn commits',
    cycle: 'increment when tick crosses ticksPerCycle',
  },
});

const standardHourglassTemplate = createTemplate(hourglassDefinition, {
  id: 'hourglass.standard',
  priors: {
    rarity: { T1: 0.45, T2: 0.30, T3: 0.15, T4: 0.08, T5: 0.02 },
  },
  rules: {
    capacity: 'derive from settled rarity',
    crossingRate: 'derive at realization, then modifiable by properties/components',
    topology: 'upper -> neck -> lower; timeless is outside the glass',
  },
});

function referenceClock({ id = 'clock.reference', boundary = {}, context = {} } = {}) {
  return createReference(standardClockTemplate, { id, boundary, context });
}

function virtualizeClock(reference) {
  const forced = reference.context?.startingOrientation;
  const orientation = forced
    ? { Day: forced === 'Day' ? 1 : 0, Night: forced === 'Night' ? 1 : 0 }
    : standardClockTemplate.priors.orientation;

  return createVirtual(reference, {
    id: `${reference.id}@virtual`,
    fixed: standardClockTemplate.fixed,
    possibilities: {
      orientation,
      advancePerTurn: standardClockTemplate.priors.advancePerTurn,
    },
    ranges: {
      currentTick: [0, standardClockTemplate.fixed.ticksPerCycle - 1],
      cycle: [0, Number.MAX_SAFE_INTEGER],
    },
    slots: {
      face: { state: 'virtual', ...clockDefinition.slots.face },
      hands: { state: 'virtual', ...clockDefinition.slots.hands },
      hours: { state: 'virtual', ...clockDefinition.slots.hours },
    },
    lineage: [
      { stage: 'definition', id: clockDefinition.id },
      { stage: 'template', id: standardClockTemplate.id },
      { stage: 'reference', id: reference.id },
    ],
  });
}

function realizeClock(virtual, seed) {
  const orientation = pickWeighted(seed, `${virtual.id}:orientation`, virtual.possibilities.orientation);
  const advancePerTurn = Number(pickWeighted(seed, `${virtual.id}:advance`, virtual.possibilities.advancePerTurn));
  const suffix = hash64(seed, virtual.id, 'instance').toString(16).padStart(16, '0').slice(-8);

  return createInstance(virtual, {
    id: `clock-${suffix}`,
    properties: { ...virtual.fixed, orientation },
    stats: { advancePerTurn },
    state: { cycle: 0, tick: 0 },
    slots: virtual.slots,
    lineage: [...virtual.lineage, { stage: 'virtual', id: virtual.id }],
  });
}

function referenceHourglass({ id = 'hourglass.reference', ownerId, boundary = {}, context = {} } = {}) {
  if (!ownerId) throw new Error('hourglass reference requires ownerId');
  return createReference(standardHourglassTemplate, {
    id,
    boundary: { ...boundary, ownerId },
    context: { ...context, ownerId },
  });
}

function virtualizeHourglass(reference) {
  return createVirtual(reference, {
    id: `${reference.id}@virtual`,
    fixed: { ownerId: reference.context.ownerId },
    possibilities: { rarity: standardHourglassTemplate.priors.rarity },
    ranges: {
      capacity: [60, 7200],
      crossingRate: [1, 4],
      integrity: [1, 100],
      grainInside: [0, 7200],
      grainTimeless: [0, 7200],
    },
    slots: {
      lock: { state: 'virtual', ...hourglassDefinition.slots.lock },
      filter: { state: 'virtual', ...hourglassDefinition.slots.filter },
    },
    lineage: [
      { stage: 'definition', id: hourglassDefinition.id },
      { stage: 'template', id: standardHourglassTemplate.id },
      { stage: 'reference', id: reference.id },
    ],
  });
}

function realizeHourglass(virtual, seed) {
  const rarity = pickWeighted(seed, `${virtual.id}:rarity`, virtual.possibilities.rarity);
  const capacityByRarity = { T1: 60, T2: 240, T3: 720, T4: 2400, T5: 7200 };
  const capacity = capacityByRarity[rarity];
  const crossingRate = 1 + Math.floor(unit(seed, virtual.id, 'crossing-rate') * 4);
  const suffix = hash64(seed, virtual.id, 'instance').toString(16).padStart(16, '0').slice(-8);

  return createInstance(virtual, {
    id: `hourglass-${suffix}`,
    properties: { rarity },
    stats: { capacity, crossingRate, integrity: 100 },
    state: {
      upper: { grain: 0 },
      neck: { crossing: 0 },
      lower: { grain: 0 },
      timeless: { grain: 0 },
    },
    slots: virtual.slots,
    ownerId: virtual.fixed.ownerId,
    lineage: [...virtual.lineage, { stage: 'virtual', id: virtual.id }],
  });
}

module.exports = {
  clockDefinition,
  hourglassDefinition,
  clockFaceDefinition,
  clockHandDefinition,
  hourDefinition,
  standardClockTemplate,
  standardHourglassTemplate,
  referenceClock,
  virtualizeClock,
  realizeClock,
  referenceHourglass,
  virtualizeHourglass,
  realizeHourglass,
};
