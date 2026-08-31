'use strict';

const { replayPlacementCandidate } = require('./m0.5-placement-provenance');
const { elementalContextRelation } = require('./elemental-context-relation');

function artifactContextCandidate(world, clock, field, cell) {
  if (!world || !clock || !field || !cell) throw new Error('artifact context candidate requires world, clock, field and cell');
  if (!cell.resolved) return null;

  const placement = replayPlacementCandidate(world, clock, field, cell, 'Artifact');
  const address = `${world.path}/zone:${field.zone}/cell:${cell.id}`;
  const relation = elementalContextRelation({
    artifactComposition: placement.rotatedSignature,
    mapField: placement.fieldVector,
    clock,
    artifactRef: `Virtual<Artifact>.placement@${address}`,
    artifactSource: 'm0.5.scoreSpawn.Artifact.rotatedSignature',
    artifactStage: 'virtual',
    mapAddress: address,
  });

  return Object.freeze({
    kind: 'Virtual<Artifact>.ContextCandidate',
    version: 1,
    source: 'm0.7.successor.artifact-context-candidate',
    readOnly: true,
    stage: 'virtual',
    address,
    placement: Object.freeze({
      source: placement.source,
      type: placement.type,
      at: placement.at,
      score: placement.score,
      fieldFit: placement.fieldFit,
      fieldOverlap: placement.terms.field.raw,
      fieldWeight: placement.terms.field.weight,
      rotatedSignature: placement.rotatedSignature,
    }),
    relation,
    admission: null,
    realizedArtifact: null,
  });
}

module.exports = {
  artifactContextCandidate,
};
