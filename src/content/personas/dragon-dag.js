'use strict';

const { createNode, createGraph } = require('../../kernel/dag');
const { virtualizeDragon, realizeDragon } = require('./dragon');

function createDragonGraph({ reference, seed }) {
  if (!reference) throw new Error('createDragonGraph requires reference');

  const referenceNode = createNode({
    id: 'dragon.reference',
    evaluate: () => reference,
  });

  const virtualNode = createNode({
    id: 'dragon.virtual',
    inputs: ['dragon.reference'],
    evaluate: ({ inputs }) => virtualizeDragon(inputs['dragon.reference']),
  });

  const instanceNode = createNode({
    id: 'dragon.instance',
    inputs: ['dragon.virtual'],
    instanceCost: 1,
    evaluate: ({ inputs }) => realizeDragon(inputs['dragon.virtual'], seed),
  });

  return createGraph([referenceNode, virtualNode, instanceNode]);
}

module.exports = { createDragonGraph };
