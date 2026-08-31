'use strict';

const assert = require('assert');
const core = require('../src/kernel/m0.5');
const {
  fieldPriorContract,
  cellPressureProvenance,
  cellPriorProvenance,
} = require('../src/app/m0.5-map-provenance');

function assertVectorClose(actual, expected, message) {
  const keys = core.E;
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    const actualValue = Array.isArray(actual) ? actual[index] : actual[key];
    const expectedValue = Array.isArray(expected) ? expected[index] : expected[key];
    assert.ok(Math.abs(actualValue - expectedValue) < 1e-12, `${message}: ${key}`);
  }
}

const world = core.createWorld(93208);
let smoothingChangedAtLeastOneCell = false;

for (const field of world.fields) {
  const contract = fieldPriorContract(field);
  assert.strictEqual(contract.source, 'm0.5.initialProb+smoothNoiseField');
  assert.strictEqual(contract.zone, field.zone);
  assert.strictEqual(contract.local, false);
  assert.strictEqual(Object.keys(contract.zonePrior).length, 8);
  assert.deepStrictEqual(
    [contract.logitWeights.zonePrior, contract.logitWeights.logExternalPressure, contract.logitWeights.coherentNoise],
    [.58, .72, .88],
  );
  assert.deepStrictEqual(
    [contract.smoothing.passes, contract.smoothing.alpha],
    [2, .24],
  );

  for (const cell of [field.cells[0], field.cells[Math.floor(field.cells.length / 2)], field.cells[field.cells.length - 1]]) {
    const pressure = cellPressureProvenance(world, field, cell);
    assert.strictEqual(pressure.source, 'm0.5.pressureFor');
    assert.strictEqual(pressure.mode, 'root');
    assertVectorClose(pressure.result, cell.external, 'root pressure replay must match stored external pressure');
    assertVectorClose(pressure.storedExternalPressure, cell.external, 'stored root pressure evidence must match cell state');
    if (field.zone === 1) {
      assert.ok(pressure.barrier, 'Barrier pressure must expose toward-edge refinement');
      assert.strictEqual(pressure.barrier.mix, .22);
    } else {
      assert.strictEqual(pressure.barrier, null);
    }

    const prior = cellPriorProvenance(world, field, cell);
    assertVectorClose(prior.pressureProvenance.result, cell.external, 'prior evidence must use replayed pressure');
    assertVectorClose(prior.coherentNoiseSmoothed, cell.noise, 'smoothed coherent noise must match stored cell noise');
    assertVectorClose(prior.finalPrior, cell.prior, 'final prior replay must match stored cell prior');
    assert.ok(Math.abs(prior.finalPriorEntropy - cell.initialEntropy) < 1e-12, 'final prior entropy must match stored initialEntropy');
    if (core.E.some((name) => Math.abs(prior.coherentNoiseRaw[name] - prior.coherentNoiseSmoothed[name]) > 1e-9)) {
      smoothingChangedAtLeastOneCell = true;
    }
  }
}

assert.ok(smoothingChangedAtLeastOneCell, 'adjacency smoothing must remain observably distinct from raw coherent noise');

const parent = world.fields[0].cells[0];
assert.strictEqual(parent.resolved, true, 'fixture parent should already be a nucleus');
const child = core.createChildWorld(parent, world);
const childField = child.fields[0];
const childCell = childField.cells[Math.min(1, childField.cells.length - 1)];
const childContract = fieldPriorContract(childField);
const childPressure = cellPressureProvenance(child, childField, childCell);
const childPrior = cellPriorProvenance(child, childField, childCell);

assert.strictEqual(childContract.local, true);
assert.strictEqual(childPressure.mode, 'local');
assert.strictEqual(childPressure.seatScale, 1.35);
assert.strictEqual(childPressure.baseToRotatedMix, .34);
assertVectorClose(childPressure.result, childCell.external, 'local child pressure replay must match stored pressure');
assertVectorClose(childPrior.finalPrior, childCell.prior, 'local child prior replay must match stored prior');
assert.strictEqual(childPrior.seed, child.seed);

console.log(JSON.stringify({
  pass: true,
  rootFields: world.fields.length,
  rootPriorWeights: fieldPriorContract(world.fields[0]).logitWeights,
  smoothing: fieldPriorContract(world.fields[0]).smoothing,
  barrierMix: cellPressureProvenance(world, world.fields[1], world.fields[1].cells[0]).barrier.mix,
  childMode: childPressure.mode,
}, null, 2));
