'use strict';

const { createTuple, createGraph, rootedTree } = require('../model/tuple-graph');
const { templateGraph } = require('./authoring');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function findParentSituation(world, objectKey) {
  for (const object of Object.values(world.objects ?? {})) {
    if (object.kind !== 'Situation') continue;
    const child = (object.children ?? []).find((candidate) => candidate.key === objectKey);
    if (child) return { situation: object, child };
  }
  return null;
}

function tupleValue(graph, subject, predicate) {
  return graph?.tuples?.find((tuple) => tuple.subject === subject && tuple.predicate === predicate)?.object ?? null;
}

function lifecycleNodes(object) {
  const chain = [];
  const seen = new Set();
  for (const step of object.lineage ?? []) {
    const node = `${step.stage}:${step.id}`;
    if (seen.has(node)) continue;
    seen.add(node);
    chain.push(freeze({ stage: step.stage, id: step.id, node }));
  }
  const instanceNode = `instance:${object.id}`;
  if (!seen.has(instanceNode)) chain.push(freeze({ stage: 'instance', id: object.id, node: instanceNode }));
  return freeze(chain);
}

function requirementFor(packGraph, slotId) {
  if (!packGraph) return null;
  const requirementId = tupleValue(packGraph, slotId, 'requires');
  if (!requirementId) return null;
  return freeze({
    id: requirementId,
    accepts: tupleValue(packGraph, requirementId, 'accepts'),
    count: tupleValue(packGraph, requirementId, 'count'),
  });
}

function buildTrace({ object, world, templateRegistry, authoredCards, authoredPackIds }) {
  if (!object || object.kind !== 'Artifact' || object.stage !== 'instance') return null;
  const parent = findParentSituation(world, object.key);
  if (!parent) return null;

  const { situation, child } = parent;
  const cardId = object.facts?.templateId ?? null;
  const packId = situation.facts?.templateId ?? null;
  const role = child.role ?? null;
  const slotId = packId && role ? `${packId}.slot.${role}` : null;
  const packTemplate = packId ? templateRegistry[packId] : null;
  const packGraph = packTemplate ? templateGraph(packTemplate) : null;
  const requirement = slotId ? requirementFor(packGraph, slotId) : null;
  const lifecycle = lifecycleNodes(object);
  const regionKey = object.regionId ? `region:${object.regionId}` : null;

  const backward = [
    freeze({ kind: 'Instance', id: object.id, node: `instance:${object.id}`, relation: 'realized-from' }),
    object.facts?.virtualId ? freeze({ kind: 'Virtual', id: object.facts.virtualId, node: `virtual:${object.facts.virtualId}`, relation: 'contextualized-from' }) : null,
    object.facts?.referenceId ? freeze({ kind: 'Reference', id: object.facts.referenceId, node: `reference:${object.facts.referenceId}`, relation: 'bound-from' }) : null,
    cardId ? freeze({ kind: authoredCards[cardId] ? 'Card' : 'Template', id: cardId, node: cardId, relation: 'authored-from', authored: Boolean(authoredCards[cardId]) }) : null,
    slotId ? freeze({ kind: 'PackSlot', id: slotId, node: slotId, relation: 'selected-by', role }) : null,
    requirement ? freeze({ kind: 'Requirement', id: requirement.id, node: requirement.id, relation: 'admitted-by', accepts: requirement.accepts, count: requirement.count }) : null,
    packId ? freeze({ kind: authoredPackIds.has(packId) ? 'Pack' : 'Template', id: packId, node: packId, relation: 'composed-by', authored: authoredPackIds.has(packId) }) : null,
    freeze({ kind: 'Situation', id: situation.id, node: situation.key, relation: 'landed-in' }),
    object.regionId ? freeze({ kind: 'Region', id: object.regionId, node: regionKey, relation: 'contained-by' }) : null,
  ].filter(Boolean);

  return freeze({
    objectKey: object.key,
    label: object.label,
    grammar: object.grammar,
    instance: freeze({ id: object.id, node: `instance:${object.id}` }),
    card: cardId ? freeze({ id: cardId, authored: Boolean(authoredCards[cardId]), grammar: object.grammar }) : null,
    pack: packId ? freeze({ id: packId, authored: authoredPackIds.has(packId), slot: role, slotId, requirement }) : null,
    situation: freeze({ key: situation.key, id: situation.id, label: situation.label }),
    region: object.regionId ? freeze({ key: regionKey, id: object.regionId }) : null,
    lifecycle,
    backward: freeze(backward),
  });
}

function landingTuples(trace) {
  const tuples = [
    createTuple({ subject: 'world.landing', predicate: 'contains', object: trace.instance.node, qualifiers: { worldObjectKey: trace.objectKey } }),
    createTuple({ subject: trace.instance.node, predicate: 'is-a', object: 'Lifecycle/instance' }),
    createTuple({ subject: trace.instance.node, predicate: 'property', object: 'worldObjectKey', qualifiers: { value: trace.objectKey } }),
  ];

  const lifecycle = [...trace.lifecycle];
  for (let index = lifecycle.length - 1; index > 0; index -= 1) {
    const current = lifecycle[index];
    const prior = lifecycle[index - 1];
    tuples.push(createTuple({ subject: current.node, predicate: 'derived-from', object: prior.node }));
  }

  if (trace.card) {
    tuples.push(
      createTuple({ subject: trace.card.id, predicate: 'is-a', object: trace.card.authored ? 'Card' : 'Template' }),
      createTuple({ subject: trace.instance.node, predicate: 'derived-from', object: trace.card.id, qualifiers: { lane: 'authoring' } }),
    );
  }

  if (trace.pack) {
    tuples.push(
      createTuple({ subject: trace.pack.id, predicate: 'is-a', object: trace.pack.authored ? 'Pack' : 'Template' }),
      createTuple({ subject: trace.pack.id, predicate: 'slot', object: trace.pack.slotId }),
      createTuple({ subject: trace.pack.slotId, predicate: 'bound-to', object: trace.card?.id ?? 'unknown', qualifiers: { role: trace.pack.slot } }),
      createTuple({ subject: trace.situation.key, predicate: 'derived-from', object: trace.pack.id }),
      createTuple({ subject: trace.situation.key, predicate: 'contains', object: trace.instance.node, qualifiers: { role: trace.pack.slot } }),
    );
    if (trace.pack.requirement) {
      tuples.push(
        createTuple({ subject: trace.pack.slotId, predicate: 'requires', object: trace.pack.requirement.id }),
        createTuple({ subject: trace.pack.requirement.id, predicate: 'is-a', object: 'Requirement' }),
        createTuple({ subject: trace.pack.requirement.id, predicate: 'accepts', object: trace.pack.requirement.accepts }),
        createTuple({ subject: trace.pack.requirement.id, predicate: 'count', object: trace.pack.requirement.count }),
        createTuple({ subject: trace.instance.node, predicate: 'satisfies', object: trace.pack.requirement.id, qualifiers: { via: trace.card?.id ?? null } }),
      );
    }
  }

  if (trace.region) {
    tuples.push(
      createTuple({ subject: trace.region.key, predicate: 'contains', object: trace.situation.key }),
      createTuple({ subject: trace.situation.key, predicate: 'contains', object: trace.instance.node }),
    );
  }

  return tuples;
}

function createWorldLanding({ world, templateRegistry = {}, authoredCards = {}, authoredPackIds = [] } = {}) {
  if (!world?.objects) throw new Error('world landing requires a World projection');
  const packIds = new Set(authoredPackIds);
  const traces = {};
  const tuples = [createTuple({ subject: 'world.landing', predicate: 'is-a', object: 'WorldLanding' })];

  for (const object of Object.values(world.objects)) {
    const trace = buildTrace({ object, world, templateRegistry, authoredCards, authoredPackIds: packIds });
    if (!trace) continue;
    traces[object.key] = trace;
    tuples.push(...landingTuples(trace));
  }

  const graph = createGraph({
    id: 'world:landing',
    type: 'WorldLanding',
    root: 'world.landing',
    stage: world.status === 'resolved' ? 'instance' : 'frontier',
    tuples,
  });

  return freeze({
    state: world.status,
    traceable: Object.freeze(Object.keys(traces)),
    byObject: freeze(traces),
    graph,
    tree: rootedTree(graph, graph.root, { maxDepth: 10 }),
  });
}

module.exports = {
  findParentSituation,
  lifecycleNodes,
  requirementFor,
  createWorldLanding,
};
