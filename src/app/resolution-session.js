'use strict';

const { templates, dragonTemplate } = require('../content/catalog');
const { createStartingRegions } = require('../runtime/horizontal-world');
const { resolveWorld, DEFAULTS } = require('./world');
const { templateGraph, regionGraph, resolutionGraph } = require('./authoring');
const { resolvedScenarioGraph } = require('./pack-scenario');
const { virtualizeCard, realizeCard } = require('./card-library');
const { createAuthoringSession, resolvedPackMembers } = require('./authoring-session');
const { rootedTree } = require('../model/tuple-graph');
const { withFrontierGraph } = require('./resolution-frontier');

function normalizeBudget(input = {}) {
  const source = input ?? {};
  const budget = {
    maxHops: source.maxHops ?? source.hops ?? DEFAULTS.budget.maxHops,
    maxSlots: source.maxSlots ?? source.slots ?? DEFAULTS.budget.maxSlots,
    maxInstances: source.maxInstances ?? source.instances ?? DEFAULTS.budget.maxInstances,
  };
  for (const [name, value] of Object.entries(budget)) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  }
  return Object.freeze(budget);
}

class ResolutionAuthoringSession {
  constructor({ seed = DEFAULTS.seed, budget = DEFAULTS.budget } = {}) {
    this.authoring = createAuthoringSession({ seed });
    this.budget = normalizeBudget(budget);
    this.resolutionRevision = 0;
  }

  get seed() { return this.authoring.seed; }
  get selectedCardId() { return this.authoring.selectedCardId; }

  reset(seed = this.seed) {
    this.authoring.reset(seed);
    this.budget = normalizeBudget(DEFAULTS.budget);
    this.resolutionRevision = 0;
    return this.snapshot();
  }

  setBudget(input = {}) {
    this.budget = normalizeBudget({ ...this.budget, ...input });
    this.resolutionRevision += 1;
    return this.snapshot();
  }

  resetBudget() {
    this.budget = normalizeBudget(DEFAULTS.budget);
    this.resolutionRevision += 1;
    return this.snapshot();
  }

  card(cardId) { return this.authoring.card(cardId); }
  compatibleWithSlot(cardId, slot) { return this.authoring.compatibleWithSlot(cardId, slot); }

  _author(name, input) {
    this.authoring[name](input);
    return this.snapshot();
  }

  selectCard(input) { return this._author('selectCard', input); }
  createCard(input) { return this._author('createCard', input); }
  cloneCard(input) { return this._author('cloneCard', input); }
  renameCard(input) { return this._author('renameCard', input); }
  deleteCard(input) { return this._author('deleteCard', input); }
  setCardFixed(input) { return this._author('setCardFixed', input); }
  setCardWeight(input) { return this._author('setCardWeight', input); }
  setCardAffinity(input) { return this._author('setCardAffinity', input); }
  connectCard(input) { return this._author('connectCard', input); }
  disconnectCard(input) { return this._author('disconnectCard', input); }
  setPackCandidateWeight(input) { return this._author('setPackCandidateWeight', input); }
  focusPackCandidate(input) { return this._author('focusPackCandidate', input); }
  setWeight(input) { return this._author('setWeight', input); }
  setAffinity(input) { return this._author('setAffinity', input); }

  snapshot() {
    const base = this.authoring.snapshot();
    const { dragon, spire, cardTemplates } = this.authoring.buildTemplates();
    const templateRegistry = Object.freeze({ ...templates, ...cardTemplates, [dragon.id]: dragon, [spire.id]: spire });
    const artifactRuntimeRegistry = Object.freeze(Object.fromEntries(
      Object.keys(cardTemplates)
        .filter((id) => id !== dragonTemplate.id)
        .map((id) => [id, Object.freeze({ virtualize: virtualizeCard, realize: realizeCard })]),
    ));

    const pack = templateGraph(spire);
    const { regionGraph: regions } = createStartingRegions(this.seed);
    const mountains = regions.byId.get('mountains');
    const context = regionGraph(mountains);
    const world = resolveWorld({ seed: this.seed, budget: this.budget }, {
      horizontalWorld: {
        templateRegistry,
        artifactRuntimeRegistry,
        packTemplateOverrides: { [spire.id]: spire },
      },
    });
    const memberTemplates = resolvedPackMembers(world);
    const scenarioCards = Object.fromEntries(Object.values(memberTemplates).map((templateId) => [
      templateId,
      templateGraph(templateRegistry[templateId]),
    ]));
    const graph = resolvedScenarioGraph({ pack, region: context, cards: scenarioCards, members: memberTemplates });
    const bounded = withFrontierGraph(resolutionGraph(world), world);

    return Object.freeze({
      ...base,
      projectionVersion: 5,
      resolutionRevision: this.resolutionRevision,
      resolution: bounded.frontier,
      views: Object.freeze({
        ...base.views,
        graph,
        resolution: bounded.graph,
        world,
      }),
      trees: Object.freeze({
        ...base.trees,
        scenario: rootedTree(graph, graph.root, { maxDepth: 8 }),
      }),
    });
  }
}

function createResolutionAuthoringSession(options) {
  return new ResolutionAuthoringSession(options);
}

module.exports = {
  normalizeBudget,
  ResolutionAuthoringSession,
  createResolutionAuthoringSession,
};
