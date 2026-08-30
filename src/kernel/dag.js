'use strict';

const { createBudgetState, stop } = require('./budget');

function createNode(spec) {
  if (!spec?.id) throw new Error('node requires id');
  if (typeof spec.evaluate !== 'function') throw new Error(`node ${spec.id} requires evaluate`);
  return Object.freeze({
    id: spec.id,
    inputs: Object.freeze([...(spec.inputs ?? [])]),
    slotCost: spec.slotCost ?? 0,
    instanceCost: spec.instanceCost ?? 0,
    evaluate: spec.evaluate,
  });
}

function createGraph(nodes) {
  const byId = new Map();
  for (const node of nodes) {
    if (!node?.id) throw new Error('graph contains node without id');
    if (byId.has(node.id)) throw new Error(`duplicate node id: ${node.id}`);
    byId.set(node.id, node);
  }
  for (const node of byId.values()) {
    for (const input of node.inputs) {
      if (!byId.has(input)) throw new Error(`node ${node.id} references missing input ${input}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error(`cycle detected at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const input of byId.get(id).inputs) visit(input);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id);

  return Object.freeze({ byId });
}

function unresolved(node, reason, detail = {}) {
  return Object.freeze({
    state: 'unresolved',
    nodeId: node.id,
    reason,
    ...detail,
  });
}

function resolved(node, value) {
  return Object.freeze({ state: 'resolved', nodeId: node.id, value });
}

function solveGraph({ graph, target, budget, context = {} }) {
  if (!graph?.byId) throw new Error('solveGraph requires graph');
  if (!graph.byId.has(target)) throw new Error(`unknown target: ${target}`);
  const state = createBudgetState(budget);
  const memo = new Map();
  const trace = [];

  function resolveNode(id, hop) {
    const cacheKey = `${id}@${hop}`;
    if (memo.has(cacheKey)) return memo.get(cacheKey);
    const node = graph.byId.get(id);
    state.hops = Math.max(state.hops, hop);

    if (hop > budget.maxHops) {
      const record = stop(state, 'budget.maxHops', { nodeId: id, hop, limit: budget.maxHops });
      const result = unresolved(node, record.reason, { hop, limit: budget.maxHops });
      memo.set(cacheKey, result);
      trace.push(result);
      return result;
    }

    if (node.slotCost > 0 && state.slots + node.slotCost > budget.maxSlots) {
      const record = stop(state, 'budget.maxSlots', {
        nodeId: id,
        requested: node.slotCost,
        used: state.slots,
        limit: budget.maxSlots,
      });
      const result = unresolved(node, record.reason, {
        requested: node.slotCost,
        used: state.slots,
        limit: budget.maxSlots,
      });
      memo.set(cacheKey, result);
      trace.push(result);
      return result;
    }

    if (node.instanceCost > 0 && state.instances + node.instanceCost > budget.maxInstances) {
      const record = stop(state, 'budget.maxInstances', {
        nodeId: id,
        requested: node.instanceCost,
        used: state.instances,
        limit: budget.maxInstances,
      });
      const result = unresolved(node, record.reason, {
        requested: node.instanceCost,
        used: state.instances,
        limit: budget.maxInstances,
      });
      memo.set(cacheKey, result);
      trace.push(result);
      return result;
    }

    const inputs = Object.fromEntries(
      node.inputs.map((inputId) => [inputId, resolveNode(inputId, hop + 1)]),
    );
    const blocked = Object.values(inputs).filter((input) => input.state !== 'resolved');
    if (blocked.length) {
      const result = unresolved(node, 'input.unresolved', {
        inputs,
        blockedBy: blocked.map((input) => input.nodeId),
      });
      memo.set(cacheKey, result);
      trace.push(result);
      return result;
    }

    if (node.slotCost > 0) state.slots += node.slotCost;
    if (node.instanceCost > 0) state.instances += node.instanceCost;

    const values = Object.fromEntries(
      Object.entries(inputs).map(([inputId, result]) => [inputId, result.value]),
    );
    const value = node.evaluate({ inputs: values, context, state });
    const result = resolved(node, value);
    memo.set(cacheKey, result);
    trace.push(result);
    return result;
  }

  const result = resolveNode(target, 0);
  return Object.freeze({
    result,
    usage: Object.freeze({
      maxHopReached: state.hops,
      slots: state.slots,
      instances: state.instances,
    }),
    stops: Object.freeze([...state.stops]),
    trace: Object.freeze([...trace]),
  });
}

module.exports = { createNode, createGraph, solveGraph };
