'use strict';

const {
  createTuple,
  createGraph,
  mergeGraphs,
  createInfluence,
} = require('../model/tuple-graph');

function slotNodes(pack) {
  return Object.fromEntries(pack.tuples
    .filter((tuple) => tuple.subject === pack.root && tuple.predicate === 'slot')
    .map((tuple) => {
      const role = pack.tuples.find((entry) => entry.subject === tuple.object && entry.predicate === 'property' && entry.object === 'role')?.qualifiers?.value;
      return [role ?? tuple.object, tuple.object];
    }));
}

function contextualPossibilities(card) {
  return card.tuples
    .filter((tuple) => tuple.subject === card.root && tuple.predicate === 'possibility')
    .map((tuple) => tuple.object)
    .filter((node) => card.tuples.some((entry) =>
      entry.subject === node &&
      entry.predicate === 'property' &&
      entry.object === 'source' &&
      entry.qualifiers?.value === 'context'));
}

function resolvedScenarioGraph({ pack, region, cards = {}, members = {} }) {
  const reference = `reference:${region.root}/${pack.root}`;
  const signalId = region.tuples.find((tuple) => tuple.subject === region.root && tuple.predicate === 'emits')?.object ?? null;
  const slots = slotNodes(pack);
  const bindingTuples = [
    createTuple({ subject: reference, predicate: 'bound-to', object: pack.root }),
    createTuple({ subject: reference, predicate: 'contains', object: region.root }),
  ];
  const influences = [];
  const includedCards = [];

  for (const [role, templateId] of Object.entries(members)) {
    const slot = slots[role];
    if (!slot) continue;
    bindingTuples.push(createTuple({ subject: slot, predicate: 'bound-to', object: templateId, qualifiers: { role } }));
    const card = cards[templateId];
    if (!card) continue;
    includedCards.push(card);
    if (!signalId) continue;
    for (const target of contextualPossibilities(card)) {
      bindingTuples.push(createTuple({ subject: signalId, predicate: 'targets', object: target }));
      influences.push(createInfluence({
        id: `influence:${signalId}:${target}`,
        source: signalId,
        target,
        reason: `Region ElementField satisfies ${templateId} contextual Requirement`,
      }));
    }
  }

  const bindings = createGraph({
    id: `scenario:${region.root}:${pack.root}:bindings`,
    type: 'ScenarioBindings',
    root: reference,
    stage: 'reference',
    tuples: bindingTuples,
  });

  return mergeGraphs({
    id: `scenario:${region.root}:${pack.root}`,
    type: 'Scenario',
    root: reference,
    stage: 'reference',
  }, [pack, region, ...includedCards, bindings, ...influences]);
}

module.exports = {
  slotNodes,
  contextualPossibilities,
  resolvedScenarioGraph,
};
