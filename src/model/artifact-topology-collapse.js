'use strict';

const { createSolveBudget } = require('../kernel/budget');
const { createReference } = require('./lifecycle');
const { relationsFrom } = require('./base-relations');
const {
  ARTIFACT_TYPES,
  CARD_ARTIFACT,
  createArtifactCard,
  virtualizeArtifact,
  realizeArtifact,
  one,
} = require('../content/generative-authoring');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function minimumCount(count) {
  if (Number.isInteger(count)) return count;
  const match = String(count).match(/^(\d+)\.\./);
  return match ? Number(match[1]) : 0;
}

function constrainedCard(baseCard, kind) {
  return createArtifactCard({
    id: baseCard.id,
    kind: one(kind),
    elementCount: baseCard.priors.elementCount,
    attributeCount: baseCard.priors.attributeCount,
    propertyCount: baseCard.priors.propertyCount,
    statCount: baseCard.priors.statCount,
  });
}

function collapseArtifactTopology({
  card = CARD_ARTIFACT,
  seed = 93208,
  id = 'Card.Artifact@collapse',
  elements = {},
  budget: budgetSpec = {},
} = {}) {
  const budget = createSolveBudget(budgetSpec);
  const usage = { maxHopReached: 0, slots: 0, instances: 0 };
  const stops = [];

  function stop(reason, detail) {
    const record = freeze({ reason, ...detail });
    stops.push(record);
    return record;
  }

  function makeVirtual(nodeCard, referenceId) {
    const reference = createReference(nodeCard, { id: referenceId, context: { elements } });
    return {
      reference,
      virtual: virtualizeArtifact(nodeCard, reference, { elements }),
    };
  }

  function visit({ nodeCard, referenceId, depth }) {
    usage.maxHopReached = Math.max(usage.maxHopReached, depth);
    const { reference, virtual } = makeVirtual(nodeCard, referenceId);

    if (usage.instances >= budget.maxInstances) {
      const blocked = stop('budget.maxInstances', {
        nodeId: referenceId,
        requested: 1,
        used: usage.instances,
        limit: budget.maxInstances,
      });
      return freeze({
        state: 'unresolved',
        stage: 'virtual',
        reference,
        virtual,
        instance: null,
        relations: [],
        reason: blocked.reason,
      });
    }

    const instance = realizeArtifact(nodeCard, virtual, seed);
    usage.instances += 1;
    const relationViews = [];

    for (const edge of relationsFrom(instance.kind).filter((candidate) => candidate.predicate !== 'is-a')) {
      const required = minimumCount(edge.count);
      const relationView = {
        predicate: edge.predicate,
        target: edge.object,
        count: edge.count,
        evidence: edge.evidence,
        state: 'open',
        children: [],
        frontier: [],
      };

      // Structural references such as Hourglass owner bindings are admitted
      // topology but do not imply spawning another object.
      if (edge.predicate !== 'contains') {
        relationViews.push(relationView);
        continue;
      }

      // Optional topology exists without forcing materialization.
      if (required === 0) {
        relationViews.push(relationView);
        continue;
      }

      for (let index = 0; index < required; index += 1) {
        const childAddress = `${referenceId}/${edge.predicate}:${edge.object}:${index + 1}`;

        if (depth + 1 > budget.maxHops) {
          const blocked = stop('budget.maxHops', {
            nodeId: childAddress,
            hop: depth + 1,
            limit: budget.maxHops,
            relation: edge.predicate,
            target: edge.object,
          });
          relationView.frontier.push(freeze({
            index: index + 1,
            target: edge.object,
            reason: blocked.reason,
          }));
          continue;
        }

        if (usage.slots >= budget.maxSlots) {
          const blocked = stop('budget.maxSlots', {
            nodeId: childAddress,
            requested: 1,
            used: usage.slots,
            limit: budget.maxSlots,
            relation: edge.predicate,
            target: edge.object,
          });
          relationView.frontier.push(freeze({
            index: index + 1,
            target: edge.object,
            reason: blocked.reason,
          }));
          continue;
        }

        usage.slots += 1;

        if (!ARTIFACT_TYPES[edge.object]) {
          const blocked = stop('generator.unavailable', {
            nodeId: childAddress,
            generator: card.id,
            target: edge.object,
          });
          relationView.frontier.push(freeze({
            index: index + 1,
            target: edge.object,
            reason: blocked.reason,
          }));
          continue;
        }

        const child = visit({
          nodeCard: constrainedCard(card, edge.object),
          referenceId: childAddress,
          depth: depth + 1,
        });
        relationView.children.push(child);
      }

      if (relationView.children.length && relationView.frontier.length === 0) relationView.state = 'resolved';
      else if (relationView.children.length) relationView.state = 'partial';
      else relationView.state = 'unresolved';
      relationViews.push(relationView);
    }

    return freeze({
      state: relationViews.some((relation) => relation.state === 'unresolved' || relation.state === 'partial')
        ? 'partial'
        : 'resolved',
      stage: 'instance',
      reference,
      virtual,
      instance,
      relations: relationViews,
    });
  }

  const root = visit({ nodeCard: card, referenceId: id, depth: 0 });
  return freeze({
    state: root.state === 'resolved' && stops.length === 0 ? 'resolved' : 'unresolved',
    budget,
    usage,
    stops,
    root,
  });
}

module.exports = {
  minimumCount,
  collapseArtifactTopology,
};
