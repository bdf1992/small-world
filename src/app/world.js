'use strict';

const { createSolveBudget } = require('../kernel/budget');
const { solveGraph } = require('../kernel/dag');
const { createHorizontalWorld } = require('../runtime/horizontal-world');
const { inspect } = require('../inspect/inspect');

const DEFAULTS = Object.freeze({
  seed: 93208,
  budget: Object.freeze({ maxHops: 4, maxSlots: 6, maxInstances: 9 }),
});

function titleCase(value) {
  return String(value ?? '')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function labelFor(value, fallback = 'Object') {
  return value?.packForm
    ?? value?.properties?.species
    ?? value?.properties?.form
    ?? value?.fixed?.species
    ?? value?.fixed?.form
    ?? (value?.templateId ? titleCase(value.templateId.split('.').pop()) : null)
    ?? fallback;
}

function objectKey(kind, id) {
  return `${String(kind).toLowerCase()}:${id}`;
}

function commonObject({
  key,
  id,
  kind,
  label,
  stage = null,
  grammar = null,
  regionId = null,
  facts = null,
  possibilities = null,
  lineage = [],
  children = [],
}) {
  return Object.freeze({
    key,
    id,
    kind,
    label,
    stage,
    grammar,
    regionId,
    facts,
    possibilities,
    lineage: Object.freeze([...(lineage ?? [])]),
    children: Object.freeze(children.map((child) => Object.freeze({ ...child }))),
  });
}

function normalizeRequest(request = {}) {
  const seed = request.seed ?? DEFAULTS.seed;
  if (!Number.isInteger(seed) || seed < 0) throw new Error('seed must be a non-negative integer');

  const input = request.budget ?? {};
  const budget = createSolveBudget({
    maxHops: input.maxHops ?? input.hops ?? DEFAULTS.budget.maxHops,
    maxSlots: input.maxSlots ?? input.slots ?? DEFAULTS.budget.maxSlots,
    maxInstances: input.maxInstances ?? input.instances ?? DEFAULTS.budget.maxInstances,
  });

  return Object.freeze({ seed, budget });
}

function uniqueEdges(regions) {
  const seen = new Set();
  const edges = [];
  for (const region of regions) {
    for (const neighbor of region.boundary.neighbors) {
      const pair = [region.id, neighbor].sort();
      const id = pair.join('::');
      if (seen.has(id)) continue;
      seen.add(id);
      edges.push(Object.freeze({ from: pair[0], to: pair[1] }));
    }
  }
  return Object.freeze(edges);
}

function projectWorld({ compiled, solve }) {
  const objectMap = new Map();
  const regionChildren = new Map();
  const regions = [...compiled.regionGraph.byId.values()];

  function add(object) {
    objectMap.set(object.key, object);
    return object;
  }

  for (const region of regions) regionChildren.set(region.id, []);

  if (solve.result.state === 'resolved') {
    for (const situation of solve.result.value.situations) {
      const situationKey = objectKey('Situation', situation.id);
      const situationChildren = [];

      for (const [role, member] of Object.entries(situation.members ?? {})) {
        const memberInspection = inspect(member);
        const memberKey = objectKey('Artifact', member.id);
        const memberObject = commonObject({
          key: memberKey,
          id: member.id,
          kind: 'Artifact',
          label: labelFor(member, titleCase(member.id)),
          stage: member.stage,
          grammar: member.grammar,
          regionId: situation.regionId,
          facts: Object.freeze({
            ...(memberInspection.facts ?? {}),
            templateId: member.templateId,
            virtualId: member.virtualId,
            referenceId: member.referenceId,
            definitionId: member.definitionId,
          }),
          possibilities: memberInspection.possibilities,
          lineage: memberInspection.lineage,
        });
        add(memberObject);
        situationChildren.push({ key: memberKey, role, label: memberObject.label, kind: memberObject.kind });
      }

      const situationInspection = inspect(situation);
      add(commonObject({
        key: situationKey,
        id: situation.id,
        kind: 'Situation',
        label: situation.packForm ?? 'Situation',
        stage: situation.stage,
        grammar: situation.grammar,
        regionId: situation.regionId,
        facts: Object.freeze({
          ...(situationInspection.facts ?? {}),
          templateId: situation.templateId,
          virtualId: situation.virtualId,
          referenceId: situation.referenceId,
          definitionId: situation.definitionId,
          relations: situation.relations ?? [],
        }),
        possibilities: situationInspection.possibilities,
        lineage: situationInspection.lineage,
        children: situationChildren,
      }));
      regionChildren.get(situation.regionId)?.push({
        key: situationKey,
        role: 'situation',
        label: situation.packForm ?? 'Situation',
        kind: 'Situation',
      });
    }
  } else {
    for (const entry of solve.trace) {
      if (entry.state !== 'resolved' || entry.value?.stage !== 'virtual') continue;
      const virtual = entry.value;
      const virtualInspection = inspect(virtual);
      add(commonObject({
        key: objectKey('Virtual', virtual.id),
        id: virtual.id,
        kind: 'Virtual',
        label: labelFor(virtual, 'Unresolved possibility'),
        stage: virtual.stage,
        grammar: virtual.grammar,
        facts: virtualInspection.facts,
        possibilities: virtualInspection.possibilities,
        lineage: virtualInspection.lineage,
      }));
    }
  }

  const regionViews = [];
  for (const region of regions) {
    const biome = compiled.biomeInstances[region.id];
    const regionKey = objectKey('Region', region.id);
    const children = regionChildren.get(region.id) ?? [];
    const regionObject = commonObject({
      key: regionKey,
      id: region.id,
      kind: 'Region',
      label: titleCase(region.id),
      stage: 'committed',
      grammar: 'World/Region',
      regionId: region.id,
      facts: Object.freeze({
        extent: region.extent,
        neighbors: region.boundary.neighbors,
        field: region.attributes,
        slots: region.slots,
        biomeArtifactId: region.artifactId,
      }),
      lineage: biome ? inspect(biome).lineage : [],
      children,
    });
    add(regionObject);
    regionViews.push(Object.freeze({
      key: regionKey,
      id: region.id,
      label: regionObject.label,
      neighbors: region.boundary.neighbors,
      field: region.attributes,
      children: regionObject.children,
    }));
  }

  const virtualKeys = [...objectMap.values()]
    .filter((object) => object.kind === 'Virtual')
    .map((object) => object.key);

  return Object.freeze({
    projectionVersion: 1,
    seed: compiled.seed,
    status: solve.result.state,
    usage: solve.usage,
    stops: solve.stops,
    map: Object.freeze({
      regions: Object.freeze(regionViews),
      edges: uniqueEdges(regions),
    }),
    objects: Object.freeze(Object.fromEntries([...objectMap.entries()])),
    roots: Object.freeze(regionViews.map((region) => region.key)),
    unresolved: Object.freeze(virtualKeys),
  });
}

function resolveWorld(request = {}) {
  const { seed, budget } = normalizeRequest(request);
  const compiled = createHorizontalWorld(seed);
  const solve = solveGraph({
    graph: compiled.graph,
    target: compiled.target,
    budget,
  });
  const projection = projectWorld({ compiled, solve });

  return Object.freeze({
    ...projection,
    budget,
  });
}

module.exports = {
  DEFAULTS,
  normalizeRequest,
  resolveWorld,
  objectKey,
};
