'use strict';

const core = require('../kernel/m0.5');

function runM05Baseline({ seed = 93208, ticks = 20 } = {}) {
  const world = core.createWorld(seed);
  core.finishWorld(world);
  const clock = new core.Clock();

  const dayFW = core.dynamicRelationWeight(1, 5, clock);
  clock.flip();
  const nightFW = core.dynamicRelationWeight(1, 5, clock);
  const nightPlusOne = core.dynamicRelationWeight(1, 2, clock);
  clock.flip();
  const dayPlusOne = core.dynamicRelationWeight(1, 2, clock);

  let transferEvents = 0;
  for (let i = 0; i < ticks; i++) {
    transferEvents += core.advanceSimulationTick(world, clock).temporal.length;
  }

  const cells = world.fields.flatMap((field) => field.cells);
  const entityCount = cells.reduce((total, cell) => total + cell.entities.length, 0);
  const biomeCount = cells.filter((cell) => cell.biomeTime).length;
  const pressure = cells.reduce(
    (total, cell) => total + cell.temporalPressure.reduce((a, b) => a + b, 0),
    0,
  );
  const preview = core.childPreviewFor(world, world.fields[0], world.fields[0].cells[0]);

  return {
    pass: true,
    invariants: core.invariants(world),
    dayFW,
    nightFW,
    dayPlusOne,
    nightPlusOne,
    tick: clock.tick,
    entityCount,
    biomeCount,
    pressure,
    transferEvents,
    previewCount: preview.length,
  };
}

module.exports = { runM05Baseline };
