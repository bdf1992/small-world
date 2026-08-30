'use strict';

function createSolveBudget(spec = {}) {
  const budget = {
    maxHops: spec.maxHops ?? 8,
    maxSlots: spec.maxSlots ?? 16,
    maxInstances: spec.maxInstances ?? 8,
  };

  for (const [name, value] of Object.entries(budget)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative integer`);
    }
  }

  return Object.freeze(budget);
}

function createBudgetState(budget) {
  return {
    budget,
    hops: 0,
    slots: 0,
    instances: 0,
    stops: [],
  };
}

function stop(state, reason, detail = {}) {
  const record = Object.freeze({ reason, ...detail });
  state.stops.push(record);
  return record;
}

module.exports = { createSolveBudget, createBudgetState, stop };
