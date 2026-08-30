'use strict';

const { atPath, clauseSatisfied, tokenize, renderTokenName } = require('../model/token');
const {
  genericPersonaCard,
  genericItemCard,
  genericBiomeCard,
  genericSituationPack,
  resolveGenerator,
  one,
} = require('../content/generative-authoring');
const { TOKEN_PACKS } = require('../content/token-packs');

const DEFAULT_CONTEXT = Object.freeze({
  region: Object.freeze({
    id: 'mountains',
    attributes: Object.freeze({ Ground: 0.50, Sky: 0.25, Fire: 0.15, Water: 0.10 }),
  }),
});

const PROFILES = Object.freeze({
  persona: Object.freeze({
    wide: Object.freeze({ label: 'Open creature', hint: 'Broad structural possibility; naming is earned later.', spec: {} }),
    scaled: Object.freeze({
      label: 'Flying scaled giant', hint: 'Structure strongly supports a mythic flying creature.',
      spec: Object.freeze({ bodyPlan: one('quadruped'), size: one('large'), mobility: one('flying'), covering: one('scales'), cognition: one('cunning'), armament: one('natural'), rarity: one('T4'), affinity: 'strong' }),
    }),
    chitin: Object.freeze({
      label: 'Chitin hunter', hint: 'Arthropod structure with natural armament.',
      spec: Object.freeze({ bodyPlan: one('arthropod'), size: one('medium'), mobility: one('grounded'), covering: one('chitin'), cognition: one('instinctive'), armament: one('natural'), rarity: one('T2'), affinity: 'medium' }),
    }),
  }),
  item: Object.freeze({
    wide: Object.freeze({ label: 'Open item', hint: 'Broad item possibility.', spec: {} }),
    light: Object.freeze({
      label: 'Light vessel', hint: 'A hand-scale vessel whose resolved function is light.',
      spec: Object.freeze({ geometry: one('vessel'), function: one('light'), scale: one('hand'), material: one('glass'), rarity: one('T2'), affinity: 'strong' }),
    }),
    guard: Object.freeze({
      label: 'Body guard', hint: 'A body-scale plate whose function is protection.',
      spec: Object.freeze({ geometry: one('plate'), function: one('guard'), scale: one('body'), material: one('metal'), rarity: one('T3'), affinity: 'medium' }),
    }),
  }),
  biome: Object.freeze({
    wide: Object.freeze({ label: 'Open biome', hint: 'Broad terrain possibility.', spec: {} }),
    high: Object.freeze({
      label: 'High steep country', hint: 'High elevation with steep relief.',
      spec: Object.freeze({ elevation: one('high'), moisture: one('temperate'), cover: one('mixed'), relief: one('steep'), rarity: one('T2') }),
    }),
  }),
  situation: Object.freeze({
    wide: Object.freeze({ label: 'Open situation', hint: 'Broad compositional site possibility.', spec: {} }),
    observe: Object.freeze({
      label: 'High observation site', hint: 'Constructed, high, and dedicated to observation.',
      spec: Object.freeze({ origin: one('constructed'), enclosure: one('partial'), verticality: one('high'), depth: one('shallow'), decay: one('weathered'), purpose: one('observe'), rarity: one('T3'), affinity: 'strong' }),
    }),
    ritual: Object.freeze({
      label: 'High ritual site', hint: 'Constructed high place with ritual purpose.',
      spec: Object.freeze({ origin: one('constructed'), enclosure: one('partial'), verticality: one('high'), depth: one('shallow'), decay: one('weathered'), purpose: one('ritual'), rarity: one('T3'), affinity: 'medium' }),
    }),
  }),
});

const FACTORIES = Object.freeze({
  persona: genericPersonaCard,
  item: genericItemCard,
  biome: genericBiomeCard,
  situation: genericSituationPack,
});

function clampSeed(value) {
  const seed = Number(value);
  if (!Number.isInteger(seed) || seed < 0) throw new Error('seed must be a non-negative integer');
  return seed;
}

function grammarFor(kind) {
  return {
    persona: 'Artifact/Persona', item: 'Artifact/Item', biome: 'Artifact/Biome', situation: 'Pack/Situation',
  }[kind] ?? null;
}

function optionsFor(kind) {
  return Object.freeze(Object.entries(PROFILES[kind] ?? {}).map(([id, profile]) => Object.freeze({ id, label: profile.label, hint: profile.hint })));
}

function relevantTokenPacks(grammar) {
  return TOKEN_PACKS.filter((pack) => pack.accepts === grammar);
}

function evaluatePack(subject, pack) {
  return Object.freeze({
    id: pack.id,
    family: pack.family,
    entries: Object.freeze(pack.entries
      .filter((entry) => entry.stages.includes(subject.stage))
      .map((entry) => {
        const clauses = entry.when.map((clause) => Object.freeze({
          path: clause.path,
          op: clause.op,
          expected: clause.value,
          actual: atPath(subject, clause.path),
          pass: clauseSatisfied(subject, clause),
        }));
        return Object.freeze({
          token: entry.token,
          weight: entry.weight,
          matched: clauses.every((clause) => clause.pass),
          progress: clauses.filter((clause) => clause.pass).length / clauses.length,
          clauses: Object.freeze(clauses),
        });
      })
      .sort((a, b) => Number(b.matched) - Number(a.matched) || b.progress - a.progress || a.token.text.localeCompare(b.token.text))),
  });
}

function dimensionRows(subject) {
  if (subject.stage === 'virtual') {
    return Object.freeze(Object.entries(subject.possibilities ?? {}).map(([name, weights]) => {
      const ordered = Object.entries(weights).sort((a, b) => b[1] - a[1]);
      return Object.freeze({ name, state: 'possible', candidates: Object.freeze(ordered.map(([value, weight]) => Object.freeze({ value, weight }))) });
    }));
  }
  const rows = [
    ...Object.entries(subject.properties ?? {}).map(([name, value]) => ({ name, state: 'settled', value })),
    ...Object.entries(subject.attributes ?? {}).map(([name, value]) => ({ name, state: 'settled', value })),
  ];
  if (subject.rarity) rows.push({ name: 'rarity', state: 'settled', value: subject.rarity });
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

function lifecycleProjection(result) {
  return Object.freeze([
    Object.freeze({ stage: 'Definition', id: result.template.definitionId, state: 'authored' }),
    Object.freeze({ stage: result.template.grammar.startsWith('Pack/') ? 'Pack' : 'Card', id: result.template.id, state: 'authored' }),
    Object.freeze({ stage: 'Reference', id: result.reference.id, state: 'bound' }),
    Object.freeze({ stage: 'Virtual', id: result.virtual.id, state: 'possible', name: result.virtualNaming.name }),
    Object.freeze({ stage: 'Instance', id: result.instance.id, state: 'settled', name: result.instance.name }),
  ]);
}

function resolveStudioCandidate({ kind = 'persona', profile = 'wide', seed = 93208, context = DEFAULT_CONTEXT } = {}) {
  const factory = FACTORIES[kind];
  const profileSpec = PROFILES[kind]?.[profile];
  if (!factory || !profileSpec) throw new Error(`unknown Studio profile: ${kind}/${profile}`);
  const template = factory(profileSpec.spec);
  const result = resolveGenerator(template, { seed: clampSeed(seed), context, id: `studio:${kind}:${profile}` });
  const virtualPacks = relevantTokenPacks(result.virtual.grammar).map((pack) => evaluatePack(result.virtual, pack));
  const instancePacks = relevantTokenPacks(result.instance.grammar).map((pack) => evaluatePack(result.instance, pack));
  return Object.freeze({
    kind,
    profile,
    profileLabel: profileSpec.label,
    profileHint: profileSpec.hint,
    grammar: grammarFor(kind),
    template: result.template,
    virtual: Object.freeze({
      id: result.virtual.id,
      name: result.virtualNaming.name,
      rows: dimensionRows(result.virtual),
      assignments: result.virtualNaming.assignments,
      tokenPacks: Object.freeze(virtualPacks),
    }),
    instance: Object.freeze({
      id: result.instance.id,
      name: result.instance.name,
      rows: dimensionRows(result.instance),
      stats: result.instance.stats,
      tokens: result.instance.tokens,
      assignments: result.instance.tokenAssignments,
      tokenPacks: Object.freeze(instancePacks),
    }),
    lifecycle: lifecycleProjection(result),
  });
}

function composeStudioSituation({ seed = 93208, situationProfile = 'observe', personaProfile = 'scaled', itemProfile = 'light' } = {}) {
  const situation = resolveStudioCandidate({ kind: 'situation', profile: situationProfile, seed });
  const guardian = resolveStudioCandidate({ kind: 'persona', profile: personaProfile, seed: seed + 1 });
  const treasure = resolveStudioCandidate({ kind: 'item', profile: itemProfile, seed: seed + 2 });
  return Object.freeze({
    name: situation.instance.name,
    slots: Object.freeze([
      Object.freeze({ role: 'guardian', requirement: 'Artifact/Persona × 1', result: guardian.instance }),
      Object.freeze({ role: 'treasure', requirement: 'Artifact/Item × 1', result: treasure.instance }),
    ]),
    relations: Object.freeze(['guardian occupies situation', 'treasure belongs to situation']),
    situation,
  });
}

function buildStudioProjection(request = {}) {
  const seed = clampSeed(request.seed ?? 93208);
  const kind = request.kind ?? 'persona';
  const profile = request.profile ?? Object.keys(PROFILES[kind] ?? {})[0];
  const candidate = resolveStudioCandidate({ kind, profile, seed });
  const composition = composeStudioSituation({ seed });
  return Object.freeze({
    projectionVersion: 1,
    mode: 'studio',
    seed,
    utility: request.utility ?? 'generate',
    catalog: Object.freeze(Object.fromEntries(Object.keys(PROFILES).map((key) => [key, optionsFor(key)]))),
    candidate,
    composition,
    vocabulary: Object.freeze({
      card: 'generates possibility',
      pack: 'composes possibility',
      token: 'names/classifies an outcome',
      tokenPack: 'supplies themed threshold vocabulary',
    }),
  });
}

module.exports = {
  DEFAULT_CONTEXT,
  PROFILES,
  buildStudioProjection,
  resolveStudioCandidate,
  composeStudioSituation,
};
