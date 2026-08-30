'use strict';

const { templates, spireTemplate, dragonTemplate } = require('../content/catalog');
const { validateCardDraft } = require('./card-library');

const FORMAT = 'small-world.authoring';
const VERSION = 1;
const TOP_LEVEL_KEYS = Object.freeze(['format', 'version', 'cards', 'packs']);
const CARD_KEYS = Object.freeze(['id', 'grammar', 'fixed', 'priors', 'rules', 'slots']);
const PACK_KEYS = Object.freeze(['id', 'grammar', 'fixed', 'priors', 'rules', 'slots']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sortedObject(value) {
  if (Array.isArray(value)) return value.map(sortedObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedObject(value[key])]));
}

function stableStringify(value, space = 2) {
  return JSON.stringify(sortedObject(value), null, space);
}

function sameValue(left, right) {
  return stableStringify(left, 0) === stableStringify(right, 0);
}

function rejectUnknownKeys(value, allowed, path, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) errors.push(`${path} contains unsupported field ${key}`);
  }
}

function createAuthoringDocument(session) {
  if (!session?.cards || !session?.spire?.slots) throw new Error('authoring session does not expose serializable Card/Pack drafts');
  return deepFreeze({
    format: FORMAT,
    version: VERSION,
    cards: clone(session.cards),
    packs: {
      [spireTemplate.id]: {
        id: spireTemplate.id,
        grammar: spireTemplate.grammar,
        fixed: clone(spireTemplate.fixed),
        priors: clone(spireTemplate.priors),
        rules: clone(spireTemplate.rules),
        slots: clone(session.spire.slots),
      },
    },
  });
}

function candidateGrammar(candidateId, cards) {
  return cards[candidateId]?.grammar ?? templates[candidateId]?.grammar ?? null;
}

function validatePack(pack, cards, errors) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    errors.push(`${spireTemplate.id} must be an object`);
    return;
  }
  rejectUnknownKeys(pack, PACK_KEYS, spireTemplate.id, errors);
  if (pack.id !== spireTemplate.id) errors.push(`${spireTemplate.id}.id must be ${spireTemplate.id}`);
  if (pack.grammar !== spireTemplate.grammar) errors.push(`${spireTemplate.id}.grammar must be ${spireTemplate.grammar}`);
  if (!sameValue(pack.fixed, spireTemplate.fixed)) errors.push(`${spireTemplate.id}.fixed is canonical in Authoring Document v1`);
  if (!sameValue(pack.priors, spireTemplate.priors)) errors.push(`${spireTemplate.id}.priors is canonical in Authoring Document v1`);
  if (!sameValue(pack.rules, spireTemplate.rules)) errors.push(`${spireTemplate.id}.rules is canonical in Authoring Document v1`);
  if (!pack.slots || typeof pack.slots !== 'object' || Array.isArray(pack.slots)) {
    errors.push(`${spireTemplate.id}.slots must be an object`);
    return;
  }

  const canonicalSlots = Object.keys(spireTemplate.slots).sort();
  const documentSlots = Object.keys(pack.slots).sort();
  if (!sameValue(documentSlots, canonicalSlots)) {
    errors.push(`${spireTemplate.id}.slots must remain ${canonicalSlots.join(', ')} in Authoring Document v1`);
  }

  for (const [slot, spec] of Object.entries(pack.slots)) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      errors.push(`${spireTemplate.id}.slots.${slot} must be an object`);
      continue;
    }
    const canonical = spireTemplate.slots[slot];
    if (!canonical) continue;
    if (spec.accepts !== canonical.accepts) errors.push(`${spireTemplate.id}.slots.${slot}.accepts is canonical in Authoring Document v1`);
    const count = Number(spec.count ?? 1);
    if (!Number.isInteger(count) || count < 1) errors.push(`${spireTemplate.id}.slots.${slot}.count must be a positive integer`);
    if (count !== Number(canonical.count ?? 1)) errors.push(`${spireTemplate.id}.slots.${slot}.count is canonical in Authoring Document v1`);
    if (!spec.candidates || typeof spec.candidates !== 'object' || Array.isArray(spec.candidates)) {
      errors.push(`${spireTemplate.id}.slots.${slot}.candidates must be an object`);
      continue;
    }

    let supported = false;
    for (const [candidateId, rawWeight] of Object.entries(spec.candidates)) {
      const weight = Number(rawWeight);
      if (!Number.isFinite(weight) || weight < 0) {
        errors.push(`${spireTemplate.id}.slots.${slot}.candidates.${candidateId} must be a non-negative finite weight`);
        continue;
      }
      if (weight > 0) supported = true;
      const grammar = candidateGrammar(candidateId, cards);
      if (!grammar) {
        errors.push(`${spireTemplate.id}.slots.${slot} references unknown candidate ${candidateId}`);
      } else if (spec.accepts && grammar !== spec.accepts) {
        errors.push(`${spireTemplate.id}.slots.${slot} accepts ${spec.accepts} but ${candidateId} provides ${grammar}`);
      }
    }
    if (!supported) errors.push(`${spireTemplate.id}.slots.${slot} must retain at least one supported candidate`);
  }
}

function validateAuthoringDocument(document) {
  const errors = [];
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return Object.freeze({ valid: false, errors: Object.freeze(['Authoring Document must be an object']) });
  }
  rejectUnknownKeys(document, TOP_LEVEL_KEYS, 'document', errors);
  if (document.format !== FORMAT) errors.push(`format must be ${FORMAT}`);
  if (document.version !== VERSION) errors.push(`version must be ${VERSION}`);

  const cards = document.cards;
  if (!cards || typeof cards !== 'object' || Array.isArray(cards)) {
    errors.push('cards must be an object map');
  } else {
    const ids = Object.keys(cards);
    if (!ids.length) errors.push('cards must contain at least one Card');
    if (!cards[dragonTemplate.id]) errors.push(`cards must retain canonical ${dragonTemplate.id} while M0.6 parity is under custody`);
    for (const [id, card] of Object.entries(cards)) {
      rejectUnknownKeys(card, CARD_KEYS, `cards.${id}`, errors);
      if (card?.id !== id) errors.push(`Card key ${id} must equal card.id`);
      const validation = validateCardDraft(card ?? {});
      for (const error of validation.errors) errors.push(`cards.${id}: ${error}`);
    }
  }

  const packs = document.packs;
  if (!packs || typeof packs !== 'object' || Array.isArray(packs)) {
    errors.push('packs must be an object map');
  } else {
    if (!packs[spireTemplate.id]) errors.push(`packs must contain ${spireTemplate.id}`);
    const unknown = Object.keys(packs).filter((id) => id !== spireTemplate.id);
    if (unknown.length) errors.push(`unsupported Pack ids in this slice: ${unknown.join(', ')}`);
    if (packs[spireTemplate.id]) validatePack(packs[spireTemplate.id], cards ?? {}, errors);
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

function assertValidAuthoringDocument(document) {
  const validation = validateAuthoringDocument(document);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return document;
}

function parseAuthoringDocument(text) {
  if (typeof text !== 'string') throw new Error('Authoring Document input must be JSON text');
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid Authoring Document JSON: ${error.message}`);
  }
  assertValidAuthoringDocument(value);
  return deepFreeze(clone(value));
}

function serializeAuthoringDocument(documentOrSession) {
  const document = documentOrSession?.format === FORMAT
    ? documentOrSession
    : createAuthoringDocument(documentOrSession);
  assertValidAuthoringDocument(document);
  return `${stableStringify(document)}\n`;
}

function applyAuthoringDocument(session, document) {
  assertValidAuthoringDocument(document);
  const nextCards = clone(document.cards);
  const nextSpire = clone(document.packs[spireTemplate.id]);

  // Mutation begins only after whole-document validation succeeds.
  session.cards = nextCards;
  session.spire = { slots: nextSpire.slots };
  session.selectedCardId = nextCards[session.selectedCardId] ? session.selectedCardId : dragonTemplate.id;
  session.revision += 1;
  return session.snapshot();
}

function roundTripAuthoringDocument(session) {
  const first = serializeAuthoringDocument(session);
  const parsed = parseAuthoringDocument(first);
  const second = serializeAuthoringDocument(parsed);
  return Object.freeze({ bytes: first, parsed, stable: first === second });
}

module.exports = {
  FORMAT,
  VERSION,
  stableStringify,
  createAuthoringDocument,
  validateAuthoringDocument,
  assertValidAuthoringDocument,
  parseAuthoringDocument,
  serializeAuthoringDocument,
  applyAuthoringDocument,
  roundTripAuthoringDocument,
};
