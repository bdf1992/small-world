'use strict';

const { createTuple, createGraph, mergeGraphs } = require('../model/tuple-graph');

function frontierProjection(world) {
  const stops = Object.freeze((world.stops ?? []).map((stop, index) => Object.freeze({
    id: `frontier:${index}:${stop.nodeId ?? 'unknown'}`,
    nodeId: stop.nodeId ?? null,
    reason: stop.reason ?? 'unresolved',
    hop: stop.hop ?? null,
    requested: stop.requested ?? null,
    used: stop.used ?? null,
    limit: stop.limit ?? null,
  })));
  const virtuals = Object.freeze((world.unresolved ?? []).map((key) => Object.freeze({
    key,
    object: world.objects?.[key] ?? null,
  })));
  return Object.freeze({
    state: world.status,
    budget: Object.freeze({ ...(world.budget ?? {}) }),
    usage: Object.freeze({ ...(world.usage ?? {}) }),
    stops,
    virtuals,
    complete: world.status === 'resolved' && stops.length === 0,
  });
}

function withFrontierGraph(resolutionGraph, world) {
  const frontier = frontierProjection(world);
  const root = 'resolution.frontier';
  const tuples = [
    createTuple({ subject: resolutionGraph.root, predicate: 'has', object: root }),
    createTuple({ subject: root, predicate: 'is-a', object: 'Resolution/Frontier' }),
    createTuple({ subject: root, predicate: 'property', object: 'state', qualifiers: { value: frontier.state } }),
    createTuple({ subject: root, predicate: 'property', object: 'budget', qualifiers: { value: frontier.budget } }),
    createTuple({ subject: root, predicate: 'property', object: 'usage', qualifiers: { value: frontier.usage } }),
  ];

  for (const stop of frontier.stops) {
    tuples.push(
      createTuple({ subject: root, predicate: 'contains', object: stop.id }),
      createTuple({ subject: stop.id, predicate: 'is-a', object: 'Resolution/Stop' }),
      createTuple({ subject: stop.id, predicate: 'blocked-by', object: stop.reason, qualifiers: {
        nodeId: stop.nodeId,
        hop: stop.hop,
        requested: stop.requested,
        used: stop.used,
        limit: stop.limit,
      } }),
    );
  }

  for (const virtual of frontier.virtuals) {
    tuples.push(createTuple({
      subject: root,
      predicate: 'contains',
      object: virtual.key,
      qualifiers: { state: 'unresolved-virtual' },
    }));
  }

  const graph = createGraph({
    id: `frontier:${world.seed}`,
    type: 'ResolutionFrontier',
    root,
    stage: frontier.complete ? 'resolved' : 'virtual',
    boundary: { budget: frontier.budget },
    tuples,
  });

  return Object.freeze({
    frontier,
    graph: mergeGraphs({
      id: resolutionGraph.id,
      type: resolutionGraph.type,
      root: resolutionGraph.root,
      stage: resolutionGraph.stage,
      boundary: { ...(resolutionGraph.boundary ?? {}), frontier: frontier.complete ? 'complete' : 'open' },
    }, [resolutionGraph, graph]),
  });
}

module.exports = {
  frontierProjection,
  withFrontierGraph,
};
