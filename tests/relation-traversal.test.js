'use strict';

const assert = require('assert');
const core = require('../src/kernel/m0.5');
const { elementalContextRelation } = require('../src/app/elemental-context-relation');
const {
  admitRelation,
  createTraversal,
  createCrossing,
  createTraversalBlocked,
} = require('../src/model/relation-traversal');

const clock = new core.Clock();
const virtual = elementalContextRelation({
  artifactComposition: { Fire: 1 },
  mapField: { Chaos: 1 },
  clock,
  artifactRef: 'Virtual<Artifact>.traveler',
  mapAddress: 'root/zone:0/cell:200',
});

assert.strictEqual(virtual.kind, 'Virtual<Relation>');
assert.strictEqual(virtual.lifecycle, 'candidate');
assert.strictEqual(virtual.admission, null);
assert.throws(() => createTraversal({
  id: 'Traversal.invalid.virtual',
  entity: 'Virtual<Artifact>.traveler',
  relation: virtual,
  from: 'root/zone:0/cell:100',
  to: 'root/zone:0/cell:200',
}), /Traversal requires an admitted Relation/);
assert.throws(() => admitRelation(virtual), /explicit relation admission is required/);

const relation = admitRelation(virtual, {
  id: 'Admission.test.explicit',
  source: 'test.explicit-admission',
  basis: 'test fixture explicitly admits this candidate; no score threshold is implied',
  at: clock.address(),
});
assert.strictEqual(relation.kind, 'Relation');
assert.strictEqual(relation.relationType, 'ElementalContext');
assert.strictEqual(relation.lifecycle, 'admitted');
assert.strictEqual(relation.authority, 'admitted-topology');
assert.strictEqual(relation.admission.id, 'Admission.test.explicit');
assert.strictEqual(relation.measurements.signedContextScore, virtual.measurements.signedContextScore);
assert.deepStrictEqual(relation.effects, []);

const traversal = createTraversal({
  id: 'Traversal.1',
  kind: 'Traversal.MapRelation',
  entity: 'Artifact.TestTraveler',
  relation,
  from: 'root/zone:0/cell:100',
  via: 'Boundary.100-200',
  to: 'root/zone:0/cell:200',
  distance: '1 admitted relation',
  at: clock.address(),
});
assert.strictEqual(traversal.admitted, true);
assert.strictEqual(traversal.relation.relationType, 'ElementalContext');
assert.strictEqual(traversal.relation.admissionId, relation.admission.id);
assert.strictEqual(traversal.from, 'root/zone:0/cell:100');
assert.strictEqual(traversal.to, 'root/zone:0/cell:200');
assert.throws(() => createTraversal({
  id: 'Traversal.teleport',
  entity: 'Artifact.TestTraveler',
  relation,
  from: 'root/zone:0/cell:100',
  to: 'root/zone:0/cell:100',
}), /movement between distinct addresses/);

const crossing = createCrossing({
  id: 'Crossing.1',
  kind: 'Crossing.MapBoundary',
  entity: 'Artifact.TestTraveler',
  traversal,
  boundary: 'Boundary.100-200',
  newlyAddressable: 'root/zone:0/cell:200',
  before: { position: 'root/zone:0/cell:100', stateAt: 'T' },
  after: { position: 'root/zone:0/cell:200', stateAt: 'T+1' },
  at: clock.address(),
});
assert.strictEqual(crossing.traversal.id, traversal.id);
assert.strictEqual(crossing.boundary, 'Boundary.100-200');
assert.strictEqual(crossing.newlyAddressable, traversal.to);
assert.strictEqual(crossing.before.position, traversal.from);
assert.strictEqual(crossing.after.position, traversal.to);
assert.throws(() => createCrossing({
  id: 'Crossing.invalid',
  entity: 'Artifact.TestTraveler',
  traversal: { ...traversal, admitted: false },
  boundary: 'Boundary.100-200',
  newlyAddressable: traversal.to,
  before: {},
  after: {},
}), /completed admitted Traversal/);
assert.throws(() => createCrossing({
  id: 'Crossing.teleport',
  entity: 'Artifact.TestTraveler',
  traversal,
  boundary: 'Boundary.100-200',
  newlyAddressable: 'root/zone:0/cell:999',
  before: {},
  after: {},
}), /newlyAddressable must equal Traversal.to/);

const blocked = createTraversalBlocked({
  entity: 'Artifact.TestTraveler',
  relation,
  from: traversal.from,
  boundary: 'Boundary.100-200',
  reason: 'condition not satisfied',
  at: clock.address(),
});
assert.strictEqual(blocked.kind, 'TraversalBlocked');
assert.strictEqual(blocked.relation.admissionId, relation.admission.id);

const negativeVirtual = elementalContextRelation({
  artifactComposition: { Fire: 1 },
  mapField: { Water: 1 },
  clock,
  artifactRef: 'Virtual<Artifact>.negative-context',
  mapAddress: 'root/zone:0/cell:300',
});
assert.ok(negativeVirtual.measurements.signedContextScore < 0, 'fixture should carry a negative contextual reading');
assert.strictEqual(negativeVirtual.admission, null, 'measurement does not admit itself');
assert.throws(() => createTraversal({
  id: 'Traversal.negative.unadmitted',
  entity: 'Virtual<Artifact>.negative-context',
  relation: negativeVirtual,
  from: 'root/zone:0/cell:100',
  to: 'root/zone:0/cell:300',
}), /Traversal requires an admitted Relation/);

console.log(JSON.stringify({
  pass: true,
  invariant: 'Virtual<Relation> requires explicit admission; Traversal requires admitted Relation; Crossing requires completed Traversal plus boundary and before/after State',
  relation: { kind: relation.kind, type: relation.relationType, admission: relation.admission.id },
  traversal: { id: traversal.id, from: traversal.from, to: traversal.to },
  crossing: { id: crossing.id, boundary: crossing.boundary, newlyAddressable: crossing.newlyAddressable },
}, null, 2));
