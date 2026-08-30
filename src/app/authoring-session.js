'use strict';

const { createTemplate } = require('../model/lifecycle');
const {
  templates,
  packDefinition,
  dragonTemplate,
  spireTemplate,
} = require('../content/catalog');
const { personaDefinition } = require('../content/personas/dragon');
const { createStartingRegions } = require('../runtime/horizontal-world');
const { resolveWorld } = require('./world');
const {
  templateGraph,
  regionGraph,
  scenarioGraph,
  resolutionGraph,
} = require('./authoring');
const { rootedTree } = require('../model/tuple-graph');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function finiteWeight(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('weight must be a non-negative finite number');
  return number;
}

function assertSupported(weights, candidate) {
  if (!Object.prototype.hasOwnProperty.call(weights, candidate)) throw new Error(`unknown candidate: ${candidate}`);
}

function ensureSupport(weights) {
  if (Object.values(weights).some((value) => Number(value) > 0)) return;
  throw new Error('weighted possibility must retain at least one supported candidate');
}

class AuthoringSession {
  constructor({ seed = 93208 } = {}) {
    this.reset(seed);
  }

  reset(seed = this.seed ?? 93208) {
    if (!Number.isInteger(seed) || seed < 0) throw new Error('seed must be a non-negative integer');
    this.seed = seed;
    this.revision = 0;
    this.dragon = {
      priors: clone(dragonTemplate.priors),
    };
    this.spire = {
      slots: clone(spireTemplate.slots),
    };
    return this.snapshot();
  }

  setWeight({ target, field, candidate, weight }) {
    const next = finiteWeight(weight);
    if (target === 'dragon') {
      const prior = this.dragon.priors[field];
      if (!prior || prior.source === 'context') throw new Error(`Dragon field is not directly weighted: ${field}`);
      assertSupported(prior, candidate);
      const previous = prior[candidate];
      prior[candidate] = next;
      try { ensureSupport(prior); } catch (error) { prior[candidate] = previous; throw error; }
    } else if (target === 'spire') {
      const slot = this.spire.slots[field];
      if (!slot?.candidates) throw new Error(`Spire slot has no candidate weights: ${field}`);
      assertSupported(slot.candidates, candidate);
      const previous = slot.candidates[candidate];
      slot.candidates[candidate] = next;
      try { ensureSupport(slot.candidates); } catch (error) { slot.candidates[candidate] = previous; throw error; }
    } else {
      throw new Error(`unknown authoring target: ${target}`);
    }
    this.revision += 1;
    return this.snapshot();
  }

  setAffinity({ field = 'element', affinity }) {
    if (field !== 'element') throw new Error(`unsupported contextual field: ${field}`);
    if (!['weak', 'medium', 'strong'].includes(affinity)) throw new Error('affinity must be weak, medium, or strong');
    this.dragon.priors.element.affinity = affinity;
    this.revision += 1;
    return this.snapshot();
  }

  buildTemplates() {
    const dragon = createTemplate(personaDefinition, {
      id: dragonTemplate.id,
      fixed: dragonTemplate.fixed,
      priors: clone(this.dragon.priors),
      rules: dragonTemplate.rules,
      slots: dragonTemplate.slots,
    });
    const spire = createTemplate(packDefinition, {
      id: spireTemplate.id,
      fixed: spireTemplate.fixed,
      priors: spireTemplate.priors,
      rules: spireTemplate.rules,
      slots: clone(this.spire.slots),
    });
    return { dragon, spire };
  }

  snapshot() {
    const { dragon, spire } = this.buildTemplates();
    const templateRegistry = Object.freeze({
      ...templates,
      [dragon.id]: dragon,
      [spire.id]: spire,
    });
    const card = templateGraph(dragon);
    const pack = templateGraph(spire);
    const { regionGraph: regions } = createStartingRegions(this.seed);
    const mountains = regions.byId.get('mountains');
    const context = regionGraph(mountains);
    const graph = scenarioGraph({ card, pack, region: context });
    const world = resolveWorld({ seed: this.seed }, {
      horizontalWorld: {
        templateRegistry,
        packTemplateOverrides: { [spire.id]: spire },
      },
    });
    const resolution = resolutionGraph(world);

    return Object.freeze({
      projectionVersion: 2,
      mode: 'authoring-session',
      seed: this.seed,
      revision: this.revision,
      grammar: Object.freeze({
        structural: 'tuple graph',
        authoring: Object.freeze(['Card', 'Pack', 'Requirement', 'Rule']),
        dynamic: Object.freeze(['Signal', 'Influence']),
        lifecycle: Object.freeze(['Definition', 'Template', 'Reference', 'Virtual', 'Instance']),
      }),
      draft: Object.freeze({
        dragon: Object.freeze({ priors: clone(this.dragon.priors) }),
        spire: Object.freeze({ slots: clone(this.spire.slots) }),
      }),
      editor: Object.freeze({
        card: Object.freeze({
          weighted: Object.freeze(['rarity', 'age', 'temperament']),
          contextual: Object.freeze({ element: Object.freeze(['weak', 'medium', 'strong']) }),
        }),
        pack: Object.freeze({ weighted: Object.freeze(['guardian', 'treasure']) }),
      }),
      views: Object.freeze({ card, pack, graph, resolution, world }),
      trees: Object.freeze({
        card: rootedTree(card, card.root),
        pack: rootedTree(pack, pack.root),
        scenario: rootedTree(graph, graph.root, { maxDepth: 8 }),
      }),
    });
  }
}

function createAuthoringSession(options) {
  return new AuthoringSession(options);
}

module.exports = {
  AuthoringSession,
  createAuthoringSession,
};
