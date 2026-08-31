'use strict';

const assert = require('assert');
const core = require('../src/kernel/m0.5');
const {
  TOPOLOGY_CONTRACT,
  fieldTopologyEvidence,
} = require('../src/app/m0.5-topology-provenance');

function approx(actual, expected, message, epsilon = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} != ${expected}`);
}

function certifyField(world, field) {
  const evidence = fieldTopologyEvidence(world, field);
  assert.strictEqual(evidence.source, 'm0.5.ringPoint+voronoi+ringAdjacency+makeField');
  assert.strictEqual(evidence.pointRows.length, field.cells.length);
  assert.strictEqual(evidence.polygons.length, field.cells.length);
  assert.strictEqual(evidence.adjacency.length, field.cells.length);

  for (let index = 0; index < field.cells.length; index++) {
    const cell = field.cells[index];
    const point = evidence.pointRows[index].point;
    approx(point.x, cell.point.x, `point.x zone ${field.zone} index ${index}`);
    approx(point.y, cell.point.y, `point.y zone ${field.zone} index ${index}`);

    assert.strictEqual(evidence.polygons[index].length, cell.poly.length, `polygon vertex count zone ${field.zone} index ${index}`);
    for (let vertex = 0; vertex < cell.poly.length; vertex++) {
      approx(evidence.polygons[index][vertex].x, cell.poly[vertex].x, `poly.x zone ${field.zone} cell ${index} vertex ${vertex}`);
      approx(evidence.polygons[index][vertex].y, cell.poly[vertex].y, `poly.y zone ${field.zone} cell ${index} vertex ${vertex}`);
    }

    assert.deepStrictEqual(
      [...evidence.adjacency[index]].sort((a, b) => a - b),
      [...cell.neighbors].sort((a, b) => a - b),
      `adjacency zone ${field.zone} index ${index}`,
    );
  }

  assert.strictEqual(evidence.nuclei.count, field.nuclei.length);
  for (let ordinal = 0; ordinal < field.nuclei.length; ordinal++) {
    const actual = field.nuclei[ordinal];
    const predicted = evidence.nuclei.nuclei[ordinal];
    assert.strictEqual(predicted.index, field.cells.indexOf(actual));
    assert.strictEqual(predicted.cellId, actual.id);
    assert.strictEqual(predicted.selectedElementIndex, actual.element);
    assert.strictEqual(predicted.selectedElement, core.E[actual.element]);
    assert.strictEqual(predicted.root, actual.root);
    assert.strictEqual(actual.nucleus, true);
  }
}

assert.strictEqual(TOPOLOGY_CONTRACT.point.padding, .018);
assert.strictEqual(TOPOLOGY_CONTRACT.voronoi.boundaryVertices, 128);
assert.strictEqual(TOPOLOGY_CONTRACT.adjacency.innerRadiusCrossingGuard, .985);
assert.strictEqual(TOPOLOGY_CONTRACT.nucleus.cyclicTargetWeight, .58);
assert.strictEqual(TOPOLOGY_CONTRACT.nucleus.seededGumbelWeight, .12);

for (const seed of [1, 42, 93208, 99991]) {
  const root = core.createWorld(seed);
  for (const field of root.fields) certifyField(root, field);

  const parent = root.fields[0].nuclei[0];
  const child = core.createChildWorld(parent, root);
  certifyField(child, child.fields[0]);
}

console.log(JSON.stringify({
  pass: true,
  source: TOPOLOGY_CONTRACT.source,
  point: TOPOLOGY_CONTRACT.point,
  voronoi: TOPOLOGY_CONTRACT.voronoi,
  adjacency: TOPOLOGY_CONTRACT.adjacency,
  nucleus: TOPOLOGY_CONTRACT.nucleus,
}, null, 2));
