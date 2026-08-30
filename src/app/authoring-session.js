'use strict';

const { createTemplate } = require('../model/lifecycle');
const { templates, packDefinition, dragonTemplate, spireTemplate } = require('../content/catalog');
const { personaDefinition } = require('../content/personas/dragon');
const { createStartingRegions } = require('../runtime/horizontal-world');
const { resolveWorld } = require('./world');
const { templateGraph, regionGraph, resolutionGraph } = require('./authoring');
const { resolvedScenarioGraph } = require('./pack-scenario');
const {
  AFFINITIES,
  defaultCardDraft,
  cardDraftFromTemplate,
  validateCardDraft,
  buildCardTemplate,
  virtualizeCard,
  realizeCard,
  resolveCardDraft,
} = require('./card-library');
const { rootedTree } = require('../model/tuple-graph');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
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
function cardIdentity(card) { return card.fixed?.species ?? card.fixed?.form ?? card.fixed?.terrain ?? card.id; }
function resolvedPackMembers(world, regionId = 'mountains') {
  const region = world.objects[`region:${regionId}`];
  const situation = region?.children?.[0] ? world.objects[region.children[0].key] : null;
  return Object.fromEntries((situation?.children ?? []).map((child) => [
    child.role,
    world.objects[child.key]?.facts?.templateId,
  ]).filter(([, templateId]) => Boolean(templateId)));
}

class AuthoringSession {
  constructor({ seed = 93208 } = {}) { this.reset(seed); }

  reset(seed = this.seed ?? 93208) {
    if (!Number.isInteger(seed) || seed < 0) throw new Error('seed must be a non-negative integer');
    this.seed = seed;
    this.revision = 0;
    this.cards = { [dragonTemplate.id]: cardDraftFromTemplate(dragonTemplate) };
    this.selectedCardId = dragonTemplate.id;
    this.spire = { slots: clone(spireTemplate.slots) };
    return this.snapshot();
  }

  card(cardId = this.selectedCardId) {
    const draft = this.cards[cardId];
    if (!draft) throw new Error(`unknown Card: ${cardId}`);
    return draft;
  }
  packSlot(slot) {
    const spec = this.spire.slots[slot];
    if (!spec) throw new Error(`unknown Pack slot: ${slot}`);
    return spec;
  }
  compatibleWithSlot(cardId, slot) { return this.card(cardId).grammar === this.packSlot(slot).accepts; }
  selectCard({ cardId }) { this.card(cardId); this.selectedCardId = cardId; return this.snapshot(); }

  createCard({ grammar = 'Artifact/Persona', id }) {
    if (this.cards[id]) throw new Error(`Card already exists: ${id}`);
    const draft = defaultCardDraft({ grammar, id });
    const validation = validateCardDraft(draft, { existingIds: [...Object.keys(this.cards), id] });
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    this.cards[id] = draft;
    this.selectedCardId = id;
    this.revision += 1;
    return this.snapshot();
  }
  cloneCard({ cardId = this.selectedCardId, newId }) {
    const source = this.card(cardId);
    if (this.cards[newId]) throw new Error(`Card already exists: ${newId}`);
    const copy = clone(source); copy.id = newId;
    const validation = validateCardDraft(copy, { existingIds: [...Object.keys(this.cards), newId] });
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    this.cards[newId] = copy;
    this.selectedCardId = newId;
    this.revision += 1;
    return this.snapshot();
  }
  renameCard({ cardId = this.selectedCardId, newId }) {
    if (cardId === dragonTemplate.id) throw new Error('canonical Dragon Card id cannot be renamed');
    const draft = this.card(cardId);
    if (this.cards[newId]) throw new Error(`Card already exists: ${newId}`);
    const next = clone(draft); next.id = newId;
    const validation = validateCardDraft(next, { existingIds: [...Object.keys(this.cards).filter((id) => id !== cardId), newId] });
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    for (const spec of Object.values(this.spire.slots)) {
      if (!Object.prototype.hasOwnProperty.call(spec.candidates ?? {}, cardId)) continue;
      spec.candidates[newId] = spec.candidates[cardId]; delete spec.candidates[cardId];
    }
    delete this.cards[cardId]; this.cards[newId] = next; this.selectedCardId = newId; this.revision += 1;
    return this.snapshot();
  }
  deleteCard({ cardId = this.selectedCardId }) {
    if (cardId === dragonTemplate.id) throw new Error('canonical Dragon Card cannot be deleted');
    this.card(cardId);
    for (const spec of Object.values(this.spire.slots)) {
      if (!Object.prototype.hasOwnProperty.call(spec.candidates ?? {}, cardId)) continue;
      const previous = spec.candidates[cardId]; delete spec.candidates[cardId];
      try { ensureSupport(spec.candidates); } catch (error) { spec.candidates[cardId] = previous; throw new Error(`cannot delete Card while it is the only supported Pack candidate: ${cardId}`); }
    }
    delete this.cards[cardId]; this.selectedCardId = dragonTemplate.id; this.revision += 1;
    return this.snapshot();
  }
  setCardFixed({ cardId = this.selectedCardId, field, value }) {
    const draft = this.card(cardId);
    if (!Object.prototype.hasOwnProperty.call(draft.fixed ?? {}, field)) throw new Error(`unknown fixed Card field: ${field}`);
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string`);
    draft.fixed[field] = value.trim();
    const validation = validateCardDraft(draft);
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    this.revision += 1; return this.snapshot();
  }
  setCardWeight({ cardId = this.selectedCardId, field, candidate, weight }) {
    const draft = this.card(cardId); const prior = draft.priors[field];
    if (!prior || prior.source === 'context') throw new Error(`Card field is not directly weighted: ${field}`);
    assertSupported(prior, candidate);
    const next = finiteWeight(weight); const previous = prior[candidate]; prior[candidate] = next;
    try { ensureSupport(prior); } catch (error) { prior[candidate] = previous; throw error; }
    this.revision += 1; return this.snapshot();
  }
  setCardAffinity({ cardId = this.selectedCardId, field = 'element', affinity }) {
    const draft = this.card(cardId); const prior = draft.priors[field];
    if (!prior || prior.source !== 'context') throw new Error(`Card field is not contextual: ${field}`);
    if (!AFFINITIES.includes(affinity)) throw new Error('affinity must be weak, medium, or strong');
    prior.affinity = affinity; this.revision += 1; return this.snapshot();
  }

  connectCard({ slot, cardId = this.selectedCardId, weight = 1 }) {
    const spec = this.packSlot(slot); const card = this.card(cardId);
    if (card.grammar !== spec.accepts) throw new Error(`Requirement mismatch: ${slot} accepts ${spec.accepts}, Card provides ${card.grammar}`);
    spec.candidates[cardId] = finiteWeight(weight); ensureSupport(spec.candidates); this.revision += 1;
    return this.snapshot();
  }
  disconnectCard({ slot, cardId = this.selectedCardId }) {
    const spec = this.packSlot(slot);
    if (!Object.prototype.hasOwnProperty.call(spec.candidates, cardId)) throw new Error(`Card is not connected to ${slot}: ${cardId}`);
    const previous = spec.candidates[cardId]; delete spec.candidates[cardId];
    try { ensureSupport(spec.candidates); } catch (error) { spec.candidates[cardId] = previous; throw error; }
    this.revision += 1; return this.snapshot();
  }
  setPackCandidateWeight({ slot, cardId, weight }) {
    const spec = this.packSlot(slot); assertSupported(spec.candidates, cardId);
    const previous = spec.candidates[cardId]; spec.candidates[cardId] = finiteWeight(weight);
    try { ensureSupport(spec.candidates); } catch (error) { spec.candidates[cardId] = previous; throw error; }
    this.revision += 1; return this.snapshot();
  }
  focusPackCandidate({ slot, cardId }) {
    const spec = this.packSlot(slot); assertSupported(spec.candidates, cardId);
    for (const candidate of Object.keys(spec.candidates)) spec.candidates[candidate] = candidate === cardId ? 1 : 0;
    this.revision += 1; return this.snapshot();
  }
  setWeight({ target, field, candidate, weight }) {
    if (target === 'dragon') return this.setCardWeight({ cardId: dragonTemplate.id, field, candidate, weight });
    if (target === 'spire') return this.setPackCandidateWeight({ slot: field, cardId: candidate, weight });
    throw new Error(`unknown authoring target: ${target}`);
  }
  setAffinity({ field = 'element', affinity }) { return this.setCardAffinity({ cardId: dragonTemplate.id, field, affinity }); }

  buildTemplates() {
    const cardTemplates = Object.freeze(Object.fromEntries(Object.entries(this.cards).map(([id, draft]) => [id, buildCardTemplate(draft)])));
    const dragonDraft = this.cards[dragonTemplate.id];
    const dragon = createTemplate(personaDefinition, { id: dragonDraft.id, fixed: clone(dragonDraft.fixed), priors: clone(dragonDraft.priors), rules: clone(dragonDraft.rules), slots: clone(dragonDraft.slots) });
    const spire = createTemplate(packDefinition, { id: spireTemplate.id, fixed: spireTemplate.fixed, priors: spireTemplate.priors, rules: spireTemplate.rules, slots: clone(this.spire.slots) });
    return { dragon, spire, cardTemplates };
  }

  packEditorProjection() {
    return Object.freeze({
      id: spireTemplate.id,
      form: spireTemplate.fixed.form,
      slots: Object.freeze(Object.fromEntries(Object.entries(this.spire.slots).map(([slot, spec]) => {
        const compatible = Object.values(this.cards).filter((card) => card.grammar === spec.accepts).map((card) => Object.freeze({ id: card.id, label: cardIdentity(card), connected: Object.prototype.hasOwnProperty.call(spec.candidates, card.id) }));
        return [slot, Object.freeze({ role: slot, requirement: Object.freeze({ accepts: spec.accepts, count: spec.count ?? 1 }), candidates: Object.freeze({ ...spec.candidates }), compatible: Object.freeze(compatible) })];
      }))),
    });
  }

  snapshot() {
    const { dragon, spire, cardTemplates } = this.buildTemplates();
    const templateRegistry = Object.freeze({ ...templates, ...cardTemplates, [dragon.id]: dragon, [spire.id]: spire });
    const artifactRuntimeRegistry = Object.freeze(Object.fromEntries(Object.keys(cardTemplates).filter((id) => id !== dragonTemplate.id).map((id) => [id, Object.freeze({ virtualize: virtualizeCard, realize: realizeCard })])));
    const selectedDraft = this.card();
    const selectedTemplate = cardTemplates[this.selectedCardId];
    const card = templateGraph(selectedTemplate);
    const pack = templateGraph(spire);
    const { regionGraph: regions } = createStartingRegions(this.seed);
    const mountains = regions.byId.get('mountains');
    const context = regionGraph(mountains);
    const world = resolveWorld({ seed: this.seed }, { horizontalWorld: { templateRegistry, artifactRuntimeRegistry, packTemplateOverrides: { [spire.id]: spire } } });
    const memberTemplates = resolvedPackMembers(world);
    const scenarioCards = Object.fromEntries(Object.values(memberTemplates).map((templateId) => [templateId, templateGraph(templateRegistry[templateId])]));
    const graph = resolvedScenarioGraph({ pack, region: context, cards: scenarioCards, members: memberTemplates });
    const resolution = resolutionGraph(world);
    const preview = resolveCardDraft(selectedDraft, { seed: this.seed, region: mountains });

    const cards = Object.freeze(Object.fromEntries(Object.entries(this.cards).map(([id, draft]) => {
      const validation = validateCardDraft(draft);
      return [id, Object.freeze({ id, grammar: draft.grammar, label: cardIdentity(draft), canonical: id === dragonTemplate.id, valid: validation.valid, errors: validation.errors })];
    })));

    return Object.freeze({
      projectionVersion: 4,
      mode: 'authoring-session',
      seed: this.seed,
      revision: this.revision,
      grammar: Object.freeze({ structural: 'tuple graph', authoring: Object.freeze(['Card', 'Pack', 'Requirement', 'Rule']), dynamic: Object.freeze(['Signal', 'Influence']), lifecycle: Object.freeze(['Definition', 'Template', 'Reference', 'Virtual', 'Instance']) }),
      draft: Object.freeze({ cards: Object.freeze(clone(this.cards)), dragon: Object.freeze({ priors: clone(this.cards[dragonTemplate.id].priors) }), spire: Object.freeze({ slots: clone(this.spire.slots) }) }),
      editor: Object.freeze({
        selectedCardId: this.selectedCardId,
        cards,
        card: Object.freeze({
          weighted: Object.freeze(Object.keys(selectedDraft.priors).filter((field) => selectedDraft.priors[field]?.source !== 'context')),
          contextual: Object.freeze(Object.fromEntries(Object.entries(selectedDraft.priors).filter(([, prior]) => prior?.source === 'context').map(([field]) => [field, AFFINITIES]))),
          fixed: Object.freeze(Object.keys(selectedDraft.fixed ?? {})),
        }),
        pack: this.packEditorProjection(),
      }),
      preview: Object.freeze({ cardId: this.selectedCardId, reference: preview.reference, virtual: preview.virtual, instance: preview.instance }),
      views: Object.freeze({ card, pack, graph, resolution, world }),
      trees: Object.freeze({ card: rootedTree(card, card.root), pack: rootedTree(pack, pack.root), scenario: rootedTree(graph, graph.root, { maxDepth: 8 }) }),
    });
  }
}

function createAuthoringSession(options) { return new AuthoringSession(options); }
module.exports = { AuthoringSession, createAuthoringSession, resolvedPackMembers };
