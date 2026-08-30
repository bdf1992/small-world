'use strict';

const { createToken, createTokenPack } = require('../model/token');

function token(id, text, role = 'noun', tags = []) {
  return createToken({ id, text, role, tags });
}
function clause(path, op, value) { return { path, op, value }; }

const TOKENS = Object.freeze({
  dragon: token('token.theme.dragon', 'Dragon', 'noun', ['creature', 'mythic']),
  bear: token('token.theme.bear', 'Bear', 'noun', ['creature', 'beast']),
  bandit: token('token.theme.bandit', 'Bandit', 'noun', ['persona', 'humanoid']),
  mantis: token('token.theme.mantis', 'Mantis', 'noun', ['creature', 'arthropod']),

  sword: token('token.theme.sword', 'Sword', 'noun', ['item', 'weapon']),
  shield: token('token.theme.shield', 'Shield', 'noun', ['item', 'defense']),
  staff: token('token.theme.staff', 'Staff', 'noun', ['item', 'focus']),
  lantern: token('token.theme.lantern', 'Lantern', 'noun', ['item', 'light']),

  cave: token('token.theme.cave', 'Cave', 'noun', ['situation', 'natural']),
  ruin: token('token.theme.ruin', 'Ruin', 'noun', ['situation', 'constructed']),
  spire: token('token.theme.spire', 'Spire', 'noun', ['situation', 'vertical']),
  observatory: token('token.theme.observatory', 'Observatory', 'noun', ['situation', 'observe']),

  swamp: token('token.theme.swamp', 'Swamp', 'noun', ['biome', 'wet']),
  desert: token('token.theme.desert', 'Desert', 'noun', ['biome', 'dry']),
  mountains: token('token.theme.mountains', 'Mountains', 'noun', ['biome', 'high']),

  ember: token('token.element.ember', 'Ember', 'modifier', ['Fire']),
  stone: token('token.element.stone', 'Stone', 'modifier', ['Ground']),
  tide: token('token.element.tide', 'Tide', 'modifier', ['Water']),
  gale: token('token.element.gale', 'Gale', 'modifier', ['Sky']),
  wild: token('token.element.wild', 'Wild', 'modifier', ['Chaos']),
  bound: token('token.element.bound', 'Bound', 'modifier', ['Order']),
  aetheric: token('token.element.aetheric', 'Aetheric', 'modifier', ['Aether']),
  void: token('token.element.void', 'Void', 'modifier', ['Void']),
});

const classicPersonaTokens = createTokenPack({
  id: 'tokens.theme.classic-fantasy.persona',
  family: 'theme',
  accepts: 'Artifact/Persona',
  entries: [
    {
      token: TOKENS.dragon,
      stages: ['instance'],
      weight: 1,
      when: [
        clause('properties.bodyPlan', 'eq', 'quadruped'),
        clause('properties.mobility', 'eq', 'flying'),
        clause('properties.covering', 'eq', 'scales'),
        clause('properties.size', 'in', ['large', 'colossal']),
        clause('rarity', 'gte', 'T3'),
      ],
    },
    {
      token: TOKENS.bear,
      stages: ['instance'],
      weight: 1,
      when: [
        clause('properties.bodyPlan', 'eq', 'quadruped'),
        clause('properties.mobility', 'eq', 'grounded'),
        clause('properties.covering', 'eq', 'fur'),
        clause('properties.size', 'in', ['large', 'colossal']),
      ],
    },
    {
      token: TOKENS.bandit,
      stages: ['instance'],
      weight: 1,
      when: [
        clause('properties.bodyPlan', 'eq', 'humanoid'),
        clause('properties.cognition', 'eq', 'sapient'),
        clause('properties.armament', 'in', ['tool', 'mixed']),
      ],
    },
    {
      token: TOKENS.mantis,
      stages: ['instance'],
      weight: 1,
      when: [
        clause('properties.bodyPlan', 'eq', 'arthropod'),
        clause('properties.covering', 'eq', 'chitin'),
        clause('properties.armament', 'eq', 'natural'),
      ],
    },
    {
      token: TOKENS.dragon,
      stages: ['virtual'],
      weight: 0.75,
      when: [
        clause('possibilities.bodyPlan.quadruped', 'gte', 0.5),
        clause('possibilities.mobility.flying', 'gte', 0.5),
        clause('possibilities.covering.scales', 'gte', 0.5),
        clause('possibilities.size.large', 'gte', 0.35),
      ],
    },
    {
      token: TOKENS.mantis,
      stages: ['virtual'],
      weight: 0.75,
      when: [
        clause('possibilities.bodyPlan.arthropod', 'gte', 0.5),
        clause('possibilities.covering.chitin', 'gte', 0.5),
      ],
    },
  ],
});

const classicItemTokens = createTokenPack({
  id: 'tokens.theme.classic-fantasy.item',
  family: 'theme',
  accepts: 'Artifact/Item',
  entries: [
    { token: TOKENS.sword, when: [clause('properties.geometry', 'eq', 'blade'), clause('properties.function', 'eq', 'strike')] },
    { token: TOKENS.shield, when: [clause('properties.geometry', 'eq', 'plate'), clause('properties.function', 'eq', 'guard')] },
    { token: TOKENS.staff, when: [clause('properties.geometry', 'eq', 'rod'), clause('properties.function', 'eq', 'channel')] },
    { token: TOKENS.lantern, when: [clause('properties.geometry', 'in', ['vessel', 'mechanism']), clause('properties.function', 'eq', 'light')] },
    { token: TOKENS.lantern, stages: ['virtual'], weight: 0.75, when: [clause('possibilities.function.light', 'gte', 0.5)] },
  ],
});

const classicSituationTokens = createTokenPack({
  id: 'tokens.theme.classic-fantasy.situation',
  family: 'theme',
  accepts: 'Pack/Situation',
  entries: [
    { token: TOKENS.cave, when: [clause('properties.origin', 'eq', 'natural'), clause('properties.enclosure', 'eq', 'closed'), clause('properties.depth', 'eq', 'deep')] },
    { token: TOKENS.ruin, when: [clause('properties.origin', 'in', ['constructed', 'mixed']), clause('properties.decay', 'eq', 'ruined')] },
    { token: TOKENS.spire, when: [clause('properties.origin', 'eq', 'constructed'), clause('properties.verticality', 'eq', 'high'), clause('properties.purpose', 'in', ['defense', 'ritual'])] },
    { token: TOKENS.observatory, when: [clause('properties.origin', 'eq', 'constructed'), clause('properties.verticality', 'eq', 'high'), clause('properties.purpose', 'eq', 'observe')] },
    { token: TOKENS.observatory, stages: ['virtual'], weight: 0.75, when: [clause('possibilities.verticality.high', 'gte', 0.5), clause('possibilities.purpose.observe', 'gte', 0.5)] },
  ],
});

const classicBiomeTokens = createTokenPack({
  id: 'tokens.theme.classic-fantasy.biome',
  family: 'theme',
  accepts: 'Artifact/Biome',
  entries: [
    { token: TOKENS.swamp, when: [clause('properties.moisture', 'eq', 'wet'), clause('properties.elevation', 'eq', 'low'), clause('properties.cover', 'in', ['mixed', 'dense'])] },
    { token: TOKENS.desert, when: [clause('properties.moisture', 'eq', 'dry'), clause('properties.cover', 'eq', 'open')] },
    { token: TOKENS.mountains, when: [clause('properties.elevation', 'eq', 'high'), clause('properties.relief', 'eq', 'steep')] },
  ],
});

function elementalEntries(grammar) {
  const map = {
    Fire: TOKENS.ember,
    Ground: TOKENS.stone,
    Water: TOKENS.tide,
    Sky: TOKENS.gale,
    Chaos: TOKENS.wild,
    Order: TOKENS.bound,
    Aether: TOKENS.aetheric,
    Void: TOKENS.void,
  };
  return createTokenPack({
    id: `tokens.elemental.core.${grammar.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    family: 'elemental',
    accepts: grammar,
    entries: Object.entries(map).flatMap(([element, elementToken]) => [
      { token: elementToken, stages: ['instance'], weight: 1, when: [clause('attributes.element', 'eq', element)] },
      { token: elementToken, stages: ['virtual'], weight: 0.5, when: [clause(`possibilities.element.${element}`, 'gte', 0.35)] },
    ]),
  });
}

const elementalPersonaTokens = elementalEntries('Artifact/Persona');
const elementalItemTokens = elementalEntries('Artifact/Item');
const elementalBiomeTokens = elementalEntries('Artifact/Biome');
const elementalSituationTokens = elementalEntries('Pack/Situation');

const TOKEN_PACKS = Object.freeze([
  classicPersonaTokens,
  classicItemTokens,
  classicSituationTokens,
  classicBiomeTokens,
  elementalPersonaTokens,
  elementalItemTokens,
  elementalBiomeTokens,
  elementalSituationTokens,
]);

module.exports = {
  TOKENS,
  classicPersonaTokens,
  classicItemTokens,
  classicSituationTokens,
  classicBiomeTokens,
  elementalPersonaTokens,
  elementalItemTokens,
  elementalBiomeTokens,
  elementalSituationTokens,
  TOKEN_PACKS,
};
