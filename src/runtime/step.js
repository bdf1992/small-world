'use strict';

const { solveGraph } = require('../kernel/dag');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function createWorldState(spec = {}) {
  return deepFreeze({
    revision: spec.revision ?? 0,
    tick: spec.tick ?? 0,
    facts: { ...(spec.facts ?? {}) },
  });
}

function solveWorldStep({ state, compile, budget }) {
  if (!state || typeof state.revision !== 'number') throw new Error('solveWorldStep requires state');
  if (typeof compile !== 'function') throw new Error('solveWorldStep requires compile(state)');
  const compiled = compile(state);
  if (!compiled?.graph || !compiled?.target) throw new Error('compile(state) must return graph and target');

  return deepFreeze({
    priorRevision: state.revision,
    priorState: state,
    solve: solveGraph({
      graph: compiled.graph,
      target: compiled.target,
      budget,
      context: { state },
    }),
  });
}

function commitWorldStep(step, reducer) {
  if (!step?.solve) throw new Error('commitWorldStep requires solved step');
  if (step.solve.result.state !== 'resolved') throw new Error('cannot commit unresolved solve');
  if (typeof reducer !== 'function') throw new Error('commitWorldStep requires reducer');

  const proposed = reducer(step.priorState, step.solve.result.value);
  if (!proposed || typeof proposed !== 'object') throw new Error('reducer must return next-state fields');

  return createWorldState({
    ...proposed,
    revision: step.priorState.revision + 1,
    tick: proposed.tick ?? step.priorState.tick + 1,
  });
}

module.exports = { createWorldState, solveWorldStep, commitWorldStep };
