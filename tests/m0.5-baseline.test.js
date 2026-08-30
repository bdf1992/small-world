'use strict';

const assert = require('assert');
const expected = require('./fixtures/m0.5-seed-93208.json');
const { runM05Baseline } = require('../src/runtime/m0.5-baseline');

const actual = runM05Baseline({ seed: 93208, ticks: 20 });
assert.deepStrictEqual(actual, expected);

console.log(JSON.stringify(actual, null, 2));
