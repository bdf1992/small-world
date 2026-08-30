'use strict';

const { createNode, createGraph } = require('../kernel/dag');

function compileLifecycleGraph({ prefix, reference, virtualize, realize, seed, instanceCost = 1 }) {
  if (!prefix) throw new Error('compileLifecycleGraph requires prefix');
  if (!reference) throw new Error('compileLifecycleGraph requires reference');
  if (typeof virtualize !== 'function' || typeof realize !== 'function') {
    throw new Error('compileLifecycleGraph requires virtualize and realize functions');
  }

  const referenceId = `${prefix}.reference`;
  const virtualId = `${prefix}.virtual`;
  const instanceId = `${prefix}.instance`;

  return Object.freeze({
    target: instanceId,
    virtualTarget: virtualId,
    graph: createGraph([
      createNode({ id: referenceId, evaluate: () => reference }),
      createNode({
        id: virtualId,
        inputs: [referenceId],
        evaluate: ({ inputs }) => virtualize(inputs[referenceId]),
      }),
      createNode({
        id: instanceId,
        inputs: [virtualId],
        instanceCost,
        evaluate: ({ inputs }) => realize(inputs[virtualId], seed),
      }),
    ]),
  });
}

module.exports = { compileLifecycleGraph };
