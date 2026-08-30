'use strict';

const { createToken } = require('../model/token');
const { TYPES, relationsTo } = require('../model/base-relations');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function createWeightedTokenPack({ id, accepts, entries }) {
  if (!id || !accepts) throw new Error('weighted Token Pack requires id and accepts');
  if (!Array.isArray(entries) || !entries.length) throw new Error('weighted Token Pack requires entries');
  return freeze({
    kind: 'WeightedTokenPack',
    id,
    accepts,
    entries: entries.map(({ token, weight = 1 }) => {
      const numeric = Number(weight);
      if (!token?.id) throw new Error('weighted Token Pack entry requires Token');
      if (!Number.isFinite(numeric) || numeric < 0) throw new Error('Token weight must be non-negative and finite');
      return { token, weight: numeric };
    }),
  });
}

function weightsFor(pack) {
  return Object.fromEntries(pack.entries.map(({ token, weight }) => [token.id, weight]));
}

const ARTIFACT_KIND_IDS = Object.freeze(
  relationsTo(TYPES.Artifact.id)
    .filter((edge) => edge.predicate === 'is-a')
    .map((edge) => edge.subject),
);

const KIND_TOKENS = Object.freeze(Object.fromEntries(
  ARTIFACT_KIND_IDS.map((id) => [id, createToken({ id, text: id, role: 'kind' })]),
));

const TOKENS = Object.freeze({
  ...KIND_TOKENS,
  attribute: createToken({ id: 'Attribute', text: 'Attribute', role: 'value-kind' }),
  property: createToken({ id: 'Property', text: 'Property', role: 'value-kind' }),
  stat: createToken({ id: 'Stat', text: 'Stat', role: 'value-kind' }),
});

// Card.Artifact draws only from kinds already admitted by the base relation graph.
// Equal weights are neutral placeholders until actual weighting rules exist.
const ARTIFACT_KIND_PACK = createWeightedTokenPack({
  id: 'TokenPack.ArtifactKind',
  accepts: 'Artifact',
  entries: ARTIFACT_KIND_IDS.map((id) => ({ token: KIND_TOKENS[id], weight: 1 })),
});

const VALUE_KIND_PACK = createWeightedTokenPack({
  id: 'TokenPack.ArtifactValueKind',
  accepts: 'Artifact',
  entries: [
    { token: TOKENS.attribute, weight: 1 },
    { token: TOKENS.property, weight: 1 },
    { token: TOKENS.stat, weight: 1 },
  ],
});

module.exports = {
  TOKENS,
  ARTIFACT_KIND_IDS,
  ARTIFACT_KIND_PACK,
  VALUE_KIND_PACK,
  createWeightedTokenPack,
  weightsFor,
};
