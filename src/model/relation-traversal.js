'use strict';

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  return value;
}

function freezeAdmission(admission) {
  if (!admission || typeof admission !== 'object') throw new Error('explicit relation admission is required');
  return Object.freeze({
    id: requireText(admission.id, 'admission.id'),
    source: requireText(admission.source, 'admission.source'),
    basis: requireText(admission.basis, 'admission.basis'),
    at: admission.at == null ? null : String(admission.at),
  });
}

function admitRelation(virtualRelation, admission) {
  if (!virtualRelation || virtualRelation.kind !== 'Virtual<Relation>') {
    throw new Error('only Virtual<Relation> may be admitted');
  }
  if (virtualRelation.lifecycle && virtualRelation.lifecycle !== 'candidate') {
    throw new Error(`Virtual<Relation> lifecycle must be candidate, got ${virtualRelation.lifecycle}`);
  }
  if (virtualRelation.admission != null) {
    throw new Error('Virtual<Relation> must not already carry admission');
  }

  return Object.freeze({
    ...virtualRelation,
    kind: 'Relation',
    lifecycle: 'admitted',
    authority: 'admitted-topology',
    admission: freezeAdmission(admission),
  });
}

function assertAdmittedRelation(relation) {
  if (!relation || relation.kind !== 'Relation' || relation.lifecycle !== 'admitted' || !relation.admission) {
    throw new Error('Traversal requires an admitted Relation');
  }
  return relation;
}

function createTraversal({
  id,
  kind = 'Traversal',
  entity,
  relation,
  from,
  via = null,
  to,
  distance = null,
  at = null,
  data = null,
} = {}) {
  const admitted = assertAdmittedRelation(relation);
  const fromAddress = requireText(from, 'traversal.from');
  const toAddress = requireText(to, 'traversal.to');
  if (fromAddress === toAddress) throw new Error('Traversal requires movement between distinct addresses');

  return Object.freeze({
    id: requireText(id, 'traversal.id'),
    kind: requireText(kind, 'traversal.kind'),
    entity: requireText(entity, 'traversal.entity'),
    admitted: true,
    relation: Object.freeze({
      kind: admitted.kind,
      relationType: admitted.relationType ?? null,
      id: admitted.id ?? null,
      admissionId: admitted.admission.id,
    }),
    from: fromAddress,
    via: via == null ? null : String(via),
    to: toAddress,
    distance: distance == null ? null : String(distance),
    at: at == null ? null : String(at),
    data: data == null ? null : Object.freeze({ ...data }),
  });
}

function createCrossing({
  id,
  kind = 'Crossing',
  entity,
  traversal,
  boundary,
  newlyAddressable,
  before,
  after,
  at = null,
  data = null,
} = {}) {
  if (!traversal || traversal.admitted !== true || !traversal.relation?.admissionId) {
    throw new Error('Crossing requires completed admitted Traversal');
  }
  const boundaryAddress = requireText(boundary, 'crossing.boundary');
  const newly = requireText(newlyAddressable, 'crossing.newlyAddressable');
  if (newly !== traversal.to) {
    throw new Error('Crossing newlyAddressable must equal Traversal.to');
  }
  if (before == null || after == null) throw new Error('Crossing requires before and after measured state');

  return Object.freeze({
    id: requireText(id, 'crossing.id'),
    kind: requireText(kind, 'crossing.kind'),
    entity: requireText(entity ?? traversal.entity, 'crossing.entity'),
    boundary: boundaryAddress,
    newlyAddressable: newly,
    at: at == null ? traversal.at : String(at),
    traversal,
    before: Object.freeze({ ...before }),
    after: Object.freeze({ ...after }),
    data: data == null ? null : Object.freeze({ ...data }),
  });
}

function createTraversalBlocked({
  entity,
  relation = null,
  from,
  boundary,
  reason,
  at = null,
  data = null,
} = {}) {
  return Object.freeze({
    kind: 'TraversalBlocked',
    entity: requireText(entity, 'blocked.entity'),
    relation: relation && relation.kind === 'Relation'
      ? Object.freeze({ relationType: relation.relationType ?? null, id: relation.id ?? null, admissionId: relation.admission?.id ?? null })
      : null,
    from: requireText(from, 'blocked.from'),
    boundary: requireText(boundary, 'blocked.boundary'),
    reason: requireText(reason, 'blocked.reason'),
    at: at == null ? null : String(at),
    data: data == null ? null : Object.freeze({ ...data }),
  });
}

module.exports = {
  admitRelation,
  assertAdmittedRelation,
  createTraversal,
  createCrossing,
  createTraversalBlocked,
};
