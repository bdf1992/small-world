'use strict';

const { hash64, pickWeighted } = require('../kernel/address');
const { createNode, createGraph } = require('../kernel/dag');
const { createInstance } = require('../model/lifecycle');
const { createRegion, createRegionGraph } = require('../model/region');
const {
  templates,
  swampTemplate,
  desertTemplate,
  mountainsTemplate,
  caveTemplate,
  ruinTemplate,
  spireTemplate,
  referenceTemplate,
  virtualizeSimple,
  realizeSimple,
} = require('../content/catalog');
const {
  referenceDragon,
  virtualizeDragon,
  realizeDragon,
} = require('../content/personas/dragon');

function realizeStartingBiome(template, seed, address) {
  const reference = referenceTemplate(template, {
    id: `${address}.${template.id}`,
    boundary: { world: 'small-world', role: 'starting-biome' },
  });
  const virtual = virtualizeSimple(template, reference);
  return realizeSimple(template, virtual, seed);
}

function createStartingRegions(seed) {
  const biomeInstances = {
    swamp: realizeStartingBiome(swampTemplate, seed, 'region.swamp'),
    desert: realizeStartingBiome(desertTemplate, seed, 'region.desert'),
    mountains: realizeStartingBiome(mountainsTemplate, seed, 'region.mountains'),
  };

  const regions = [
    createRegion({
      id: 'swamp',
      extent: { measure: 1, unit: 'world-share' },
      boundary: { neighbors: ['desert', 'mountains'] },
      attributes: biomeInstances.swamp.attributes.field,
      artifactId: biomeInstances.swamp.id,
      slots: { situation: { count: 1 } },
    }),
    createRegion({
      id: 'desert',
      extent: { measure: 1, unit: 'world-share' },
      boundary: { neighbors: ['swamp', 'mountains'] },
      attributes: biomeInstances.desert.attributes.field,
      artifactId: biomeInstances.desert.id,
      slots: { situation: { count: 1 } },
    }),
    createRegion({
      id: 'mountains',
      extent: { measure: 1, unit: 'world-share' },
      boundary: { neighbors: ['swamp', 'desert'] },
      attributes: biomeInstances.mountains.attributes.field,
      artifactId: biomeInstances.mountains.id,
      slots: { situation: { count: 1 } },
    }),
  ];

  return { biomeInstances, regionGraph: createRegionGraph(regions) };
}

function createArtifactVirtual(templateId, { region, prefix, slot }) {
  const template = templates[templateId];
  if (!template) throw new Error(`unknown template: ${templateId}`);

  if (templateId === 'persona.dragon') {
    const reference = referenceDragon({
      id: `${prefix}.${slot}.${templateId}`,
      boundary: { pack: prefix, slot, region: region.id },
      context: { region },
    });
    return virtualizeDragon(reference);
  }

  const reference = referenceTemplate(template, {
    id: `${prefix}.${slot}.${templateId}`,
    boundary: { pack: prefix, slot, region: region.id },
    region,
  });
  return virtualizeSimple(template, reference);
}

function realizeArtifactVirtual(virtual, seed) {
  const template = templates[virtual.templateId];
  if (!template) throw new Error(`unknown virtual template: ${virtual.templateId}`);
  if (virtual.templateId === 'persona.dragon') return realizeDragon(virtual, seed);
  return realizeSimple(template, virtual, seed);
}

function situationNodes({ prefix, packTemplate, region, seed }) {
  const regionId = `${prefix}.region`;
  const packReferenceId = `${prefix}.pack.reference`;
  const packVirtualId = `${prefix}.pack.virtual`;

  const nodes = [
    createNode({ id: regionId, evaluate: () => region }),
    createNode({
      id: packReferenceId,
      inputs: [regionId],
      evaluate: ({ inputs }) => referenceTemplate(packTemplate, {
        id: `${prefix}.${packTemplate.id}`,
        boundary: { region: inputs[regionId].id, slot: 'situation' },
        region: inputs[regionId],
      }),
    }),
    createNode({
      id: packVirtualId,
      inputs: [packReferenceId],
      evaluate: ({ inputs }) => virtualizeSimple(packTemplate, inputs[packReferenceId]),
    }),
  ];

  const instanceIds = [];
  for (const slot of Object.keys(packTemplate.slots)) {
    const choiceId = `${prefix}.${slot}.choice`;
    const virtualId = `${prefix}.${slot}.virtual`;
    const instanceId = `${prefix}.${slot}.instance`;
    instanceIds.push(instanceId);

    nodes.push(createNode({
      id: choiceId,
      inputs: [packVirtualId],
      slotCost: 1,
      evaluate: ({ inputs }) => {
        const slotSpec = inputs[packVirtualId].slots[slot];
        return pickWeighted(seed, `${prefix}:${slot}:template`, slotSpec.candidates);
      },
    }));

    nodes.push(createNode({
      id: virtualId,
      inputs: [choiceId, regionId],
      evaluate: ({ inputs }) => createArtifactVirtual(inputs[choiceId], {
        region: inputs[regionId],
        prefix,
        slot,
      }),
    }));

    nodes.push(createNode({
      id: instanceId,
      inputs: [virtualId],
      instanceCost: 1,
      evaluate: ({ inputs }) => realizeArtifactVirtual(inputs[virtualId], seed),
    }));
  }

  const situationId = `${prefix}.situation.instance`;
  nodes.push(createNode({
    id: situationId,
    inputs: [packVirtualId, ...instanceIds],
    instanceCost: 1,
    evaluate: ({ inputs }) => {
      const packVirtual = inputs[packVirtualId];
      const members = Object.fromEntries(Object.keys(packTemplate.slots).map((slot, index) => [
        slot,
        inputs[instanceIds[index]],
      ]));
      const suffix = hash64(seed, prefix, 'situation').toString(16).padStart(16, '0').slice(-8);
      return createInstance(packVirtual, {
        id: `situation-${suffix}`,
        kind: 'Situation',
        regionId: region.id,
        packForm: packTemplate.fixed.form,
        members,
        relations: packTemplate.rules.relations,
        lineage: [...packVirtual.lineage, { stage: 'virtual', id: packVirtual.id }],
      });
    },
  }));

  return { nodes, situationId, regionId };
}

function createHorizontalWorld(seed = 93208) {
  const { biomeInstances, regionGraph } = createStartingRegions(seed);
  const bindings = [
    { prefix: 'swamp.cave', region: regionGraph.byId.get('swamp'), packTemplate: caveTemplate },
    { prefix: 'desert.ruin', region: regionGraph.byId.get('desert'), packTemplate: ruinTemplate },
    { prefix: 'mountains.spire', region: regionGraph.byId.get('mountains'), packTemplate: spireTemplate },
  ];

  const allNodes = [];
  const situationIds = [];
  const regionIds = [];
  for (const binding of bindings) {
    const built = situationNodes({ ...binding, seed });
    allNodes.push(...built.nodes);
    situationIds.push(built.situationId);
    regionIds.push(built.regionId);
  }

  const worldId = 'world.horizontal';
  allNodes.push(createNode({
    id: worldId,
    inputs: [...regionIds, ...situationIds],
    evaluate: ({ inputs }) => ({
      kind: 'World',
      seed,
      regions: regionIds.map((id) => inputs[id]),
      situations: situationIds.map((id) => inputs[id]),
      biomeInstances,
    }),
  }));

  return Object.freeze({
    seed,
    target: worldId,
    graph: createGraph(allNodes),
    regionGraph,
    biomeInstances,
    bindings: Object.freeze(bindings.map(({ prefix, region, packTemplate }) => Object.freeze({
      prefix,
      regionId: region.id,
      packTemplateId: packTemplate.id,
    }))),
  });
}

module.exports = {
  createStartingRegions,
  createArtifactVirtual,
  realizeArtifactVirtual,
  situationNodes,
  createHorizontalWorld,
};
