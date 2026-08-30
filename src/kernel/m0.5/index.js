'use strict';

const fs = require('fs');
const path = require('path');

// Transitional loader for the behavior-preserving M0.5 extraction.
// The raw parts are intentionally not treated as the target M0.6 module shape.
// Keeping the extracted source mechanically close to the vertical slice gives
// the refactor a stable regression seam before we replace legacy concepts.
const parts = ['part-00.js', 'part-01.js', 'part-02.js', 'part-03.js'];
const source = parts
  .map((name) => fs.readFileSync(path.join(__dirname, name), 'utf8'))
  .join('\n');

const box = { exports: {} };
const load = new Function('module', 'exports', source);
load(box, box.exports);

module.exports = box.exports;
