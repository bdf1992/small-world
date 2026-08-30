'use strict';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const PREDICATE_FAMILIES = deepFreeze({
  structural: ['is-a', 'has', 'contains', 'part-of', 'adjacent-to', 'bound-to'],
  authoring: ['property', 'possibility', 'slot', 'candidate', 'default', 'rule'],
  constraint: ['requires', 'accepts', 'count', 'bounds', 'excludes'],
  dynamic: ['emits', 'targets', 'carries', 'influences', 'decays'],
  derivation: ['derives', 'transforms', 'satisfies', 'resolves-to'],
  evidence: ['derived-from', 'selected-because', 'blocked-by', 'supersedes'],
});

const predicateFamily = deepFreeze(Object.fromEntries(
  Object.entries(PREDICATE_FAMILIES).flatMap(([family, predicates]) => predicates.map((predicate) => [predicate, family])),
));

function stableValue(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${key}:${stableValue(value[key])}`).join(',')}}`;
}

function tupleKey({ subject, predicate, object }) {
  return `${stableValue(subject)}|${predicate}|${stableValue(object)}`;
}

function createTuple(spec = {}) {
  if (spec.subject === undefined || spec.subject === null) throw new Error('tuple requires subject');
  if (!spec.predicate) throw new Error('tuple requires predicate');
  if (spec.object === undefined) throw new Error('tuple requires object');

  return deepFreeze({
    id: spec.id ?? null,
    subject: spec.subject,
    predicate: spec.predicate,
    object: spec.object,
    family: spec.family ?? predicateFamily[spec.predicate] ?? 'custom',
    qualifiers: { ...(spec.qualifiers ?? {}) },
  });
}

function createGraph(spec = {}) {
  if (!spec.id) throw new Error('graph requires id');
  if (!spec.type) throw new Error('graph requires type');
  if (!spec.root) throw new Error('graph requires root');

  const seen = new Set();
  const tuples = [];
  for (const input of spec.tuples ?? []) {
    const tuple = input?.subject !== undefined && input?.family !== undefined ? input : createTuple(input);
    const key = tupleKey(tuple);
    if (seen.has(key)) continue;
    seen.add(key);
    tuples.push(tuple);
  }

  return deepFreeze({
    id: spec.id,
    type: spec.type,
    root: spec.root,
    stage: spec.stage ?? 'authored',
    boundary: { ...(spec.boundary ?? {}) },
    tuples,
  });
}

function mergeGraphs(spec = {}, graphs = []) {
  if (!graphs.length) throw new Error('mergeGraphs requires at least one graph');
  return createGraph({
    id: spec.id,
    type: spec.type ?? 'Graph/Composite',
    root: spec.root ?? graphs[0].root,
    stage: spec.stage ?? graphs[0].stage,
    boundary: spec.boundary ?? {},
    tuples: graphs.flatMap((graph) => graph.tuples),
  });
}

function outgoing(graph, subject, predicate = null) {
  return graph.tuples.filter((tuple) => tuple.subject === subject && (!predicate || tuple.predicate === predicate));
}

function incoming(graph, object, predicate = null) {
  return graph.tuples.filter((tuple) => tuple.object === object && (!predicate || tuple.predicate === predicate));
}

function byFamily(graph, family) {
  return graph.tuples.filter((tuple) => tuple.family === family);
}

function rootedTree(graph, root = graph.root, options = {}) {
  const maxDepth = options.maxDepth ?? 6;
  const predicates = options.predicates ? new Set(options.predicates) : null;
  const seen = new Set();

  function visit(node, depth) {
    if (depth > maxDepth) return deepFreeze({ id: node, truncated: true, edges: [] });
    const cycle = seen.has(node);
    if (cycle) return deepFreeze({ id: node, cycle: true, edges: [] });
    seen.add(node);

    const edges = outgoing(graph, node)
      .filter((tuple) => !predicates || predicates.has(tuple.predicate))
      .map((tuple) => deepFreeze({
        tuple,
        child: typeof tuple.object === 'string' ? visit(tuple.object, depth + 1) : null,
      }));

    seen.delete(node);
    return deepFreeze({ id: node, edges });
  }

  return visit(root, 0);
}

function createRequirement(spec = {}) {
  if (!spec.id) throw new Error('requirement requires id');
  if (!spec.subject) throw new Error('requirement requires subject');
  if (!spec.expects) throw new Error('requirement requires expects');
  return createGraph({
    id: spec.id,
    type: 'Requirement',
    root: spec.id,
    tuples: [
      createTuple({ subject: spec.id, predicate: 'is-a', object: 'Requirement' }),
      createTuple({ subject: spec.subject, predicate: 'requires', object: spec.id }),
      createTuple({ subject: spec.id, predicate: 'accepts', object: spec.expects }),
      createTuple({ subject: spec.id, predicate: 'count', object: spec.count ?? 1 }),
      createTuple({ subject: spec.id, predicate: 'property', object: 'scope', qualifiers: { value: spec.scope ?? 'visible' } }),
      createTuple({ subject: spec.id, predicate: 'property', object: 'strength', qualifiers: { value: spec.strength ?? 'required' } }),
    ],
  });
}

function createSignal(spec = {}) {
  if (!spec.id) throw new Error('signal requires id');
  if (!spec.kind) throw new Error('signal requires kind');
  if (!spec.source) throw new Error('signal requires source');
  const tuples = [
    createTuple({ subject: spec.id, predicate: 'is-a', object: `Signal<${spec.kind}>` }),
    createTuple({ subject: spec.source, predicate: 'emits', object: spec.id }),
    createTuple({ subject: spec.id, predicate: 'property', object: 'kind', qualifiers: { value: spec.kind } }),
  ];
  if (spec.target) tuples.push(createTuple({ subject: spec.id, predicate: 'targets', object: spec.target }));
  if (spec.value !== undefined) tuples.push(createTuple({ subject: spec.id, predicate: 'carries', object: spec.value }));
  if (spec.magnitude !== undefined) tuples.push(createTuple({ subject: spec.id, predicate: 'property', object: 'magnitude', qualifiers: { value: spec.magnitude } }));
  if (spec.phase !== undefined) tuples.push(createTuple({ subject: spec.id, predicate: 'property', object: 'phase', qualifiers: { value: spec.phase } }));
  if (spec.decay !== undefined) tuples.push(createTuple({ subject: spec.id, predicate: 'decays', object: spec.decay }));
  return createGraph({ id: spec.id, type: 'Signal', root: spec.id, stage: 'temporal', tuples });
}

function createInfluence(spec = {}) {
  if (!spec.id) throw new Error('influence requires id');
  if (!spec.source) throw new Error('influence requires source');
  if (!spec.target) throw new Error('influence requires target');
  return createGraph({
    id: spec.id,
    type: 'Influence',
    root: spec.id,
    stage: 'derived',
    tuples: [
      createTuple({ subject: spec.id, predicate: 'is-a', object: 'Influence' }),
      createTuple({ subject: spec.source, predicate: 'influences', object: spec.target, id: spec.id, qualifiers: {
        magnitude: spec.magnitude ?? null,
        candidate: spec.candidate ?? null,
        reason: spec.reason ?? null,
      } }),
      createTuple({ subject: spec.id, predicate: 'derived-from', object: spec.source }),
      createTuple({ subject: spec.id, predicate: 'targets', object: spec.target }),
    ],
  });
}

module.exports = {
  PREDICATE_FAMILIES,
  predicateFamily,
  createTuple,
  createGraph,
  mergeGraphs,
  outgoing,
  incoming,
  byFamily,
  rootedTree,
  createRequirement,
  createSignal,
  createInfluence,
};
