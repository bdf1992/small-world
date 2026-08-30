'use strict';

const {
  createTuple,
  createGraph,
  mergeGraphs,
  rootedTree,
  createRequirement,
  createSignal,
  createInfluence,
} = require('../model/tuple-graph');
const {
  dragonTemplate,
  spireTemplate,
} = require('../content/catalog');
const { createStartingRegions } = require('../runtime/horizontal-world');
const { resolveWorld } = require('./world');

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9._:-]+/g, '-');
}

function propertyNode(owner, name) {
  return `${owner}.property.${safeId(name)}`;
}

function possibilityNode(owner, name) {
  return `${owner}.possibility.${safeId(name)}`;
}

function slotNode(owner, name) {
  return `${owner}.slot.${safeId(name)}`;
}

function ruleNode(owner, name) {
  return `${owner}.rule.${safeId(name)}`;
}

function templateGraph(template) {
  const tuples = [
    createTuple({ subject: template.id, predicate: 'is-a', object: template.grammar }),
    createTuple({ subject: template.id, predicate: 'property', object: 'stage', qualifiers: { value: template.stage } }),
  ];
  const supporting = [];

  for (const [name, value] of Object.entries(template.fixed ?? {})) {
    const node = propertyNode(template.id, name);
    tuples.push(
      createTuple({ subject: template.id, predicate: 'property', object: node }),
      createTuple({ subject: node, predicate: 'property', object: 'name', qualifiers: { value: name } }),
      createTuple({ subject: node, predicate: 'default', object: value }),
    );
  }

  for (const [name, prior] of Object.entries(template.priors ?? {})) {
    const node = possibilityNode(template.id, name);
    tuples.push(
      createTuple({ subject: template.id, predicate: 'possibility', object: node }),
      createTuple({ subject: node, predicate: 'property', object: 'name', qualifiers: { value: name } }),
    );

    if (prior?.source === 'context') {
      const requirementId = `${node}.requirement.element-field`;
      supporting.push(createRequirement({
        id: requirementId,
        subject: node,
        expects: 'Signal<ElementField>',
        count: '1..N',
        scope: 'visible-boundary',
      }));
      tuples.push(
        createTuple({ subject: node, predicate: 'property', object: 'source', qualifiers: { value: 'context' } }),
        createTuple({ subject: node, predicate: 'property', object: 'affinity', qualifiers: { value: prior.affinity ?? 'medium' } }),
      );
      for (const candidate of prior.domain ?? []) {
        tuples.push(createTuple({
          subject: node,
          predicate: 'candidate',
          object: candidate,
          qualifiers: { authoredWeight: null, source: 'context' },
        }));
      }
    } else {
      for (const [candidate, weight] of Object.entries(prior ?? {})) {
        tuples.push(createTuple({ subject: node, predicate: 'candidate', object: candidate, qualifiers: { weight } }));
      }
    }
  }

  for (const [name, spec] of Object.entries(template.slots ?? {})) {
    const node = slotNode(template.id, name);
    const requirementId = `${node}.requirement`;
    tuples.push(
      createTuple({ subject: template.id, predicate: 'slot', object: node }),
      createTuple({ subject: node, predicate: 'property', object: 'role', qualifiers: { value: name } }),
    );
    supporting.push(createRequirement({
      id: requirementId,
      subject: node,
      expects: spec.accepts,
      count: spec.count ?? 1,
      scope: 'pack+visible-context',
    }));
    for (const [candidate, weight] of Object.entries(spec.candidates ?? {})) {
      tuples.push(createTuple({ subject: node, predicate: 'candidate', object: candidate, qualifiers: { weight } }));
    }
  }

  for (const [name, expression] of Object.entries(template.rules ?? {})) {
    if (name === 'relations' && Array.isArray(expression)) {
      for (const [index, relation] of expression.entries()) {
        const node = ruleNode(template.id, `${name}.${index}`);
        tuples.push(
          createTuple({ subject: template.id, predicate: 'rule', object: node }),
          createTuple({ subject: node, predicate: 'is-a', object: 'Rule' }),
          createTuple({ subject: node, predicate: 'property', object: 'expression', qualifiers: { value: relation } }),
        );
      }
      continue;
    }
    const node = ruleNode(template.id, name);
    tuples.push(
      createTuple({ subject: template.id, predicate: 'rule', object: node }),
      createTuple({ subject: node, predicate: 'is-a', object: 'Rule' }),
      createTuple({ subject: node, predicate: 'property', object: 'name', qualifiers: { value: name } }),
      createTuple({ subject: node, predicate: 'property', object: 'expression', qualifiers: { value: expression } }),
    );
  }

  const own = createGraph({
    id: `authoring:${template.id}`,
    type: template.grammar.startsWith('Pack/') ? 'Pack' : 'Card',
    root: template.id,
    stage: template.stage,
    tuples,
  });

  return supporting.length
    ? mergeGraphs({ id: own.id, type: own.type, root: own.root, stage: own.stage }, [own, ...supporting])
    : own;
}

function regionGraph(region) {
  const root = `region.${region.id}`;
  const tuples = [
    createTuple({ subject: root, predicate: 'is-a', object: 'Region' }),
    createTuple({ subject: root, predicate: 'property', object: 'extent', qualifiers: { value: region.extent } }),
  ];
  for (const neighbor of region.boundary.neighbors) {
    tuples.push(createTuple({ subject: root, predicate: 'adjacent-to', object: `region.${neighbor}` }));
  }
  for (const [element, magnitude] of Object.entries(region.attributes ?? {})) {
    const node = `${root}.field.${safeId(element)}`;
    tuples.push(
      createTuple({ subject: root, predicate: 'has', object: node }),
      createTuple({ subject: node, predicate: 'is-a', object: 'ElementFieldValue' }),
      createTuple({ subject: node, predicate: 'property', object: 'element', qualifiers: { value: element } }),
      createTuple({ subject: node, predicate: 'property', object: 'magnitude', qualifiers: { value: magnitude } }),
    );
  }

  const base = createGraph({ id: `context:${root}`, type: 'Region', root, stage: 'instance', tuples });
  const signal = createSignal({
    id: `signal:${region.id}:element-field`,
    kind: 'ElementField',
    source: root,
    value: Object.freeze({ ...(region.attributes ?? {}) }),
  });
  return mergeGraphs({ id: base.id, type: 'Region', root, stage: 'instance' }, [base, signal]);
}

function scenarioGraph({ card, pack, region }) {
  const guardian = slotNode(pack.root, 'guardian');
  const dragonElement = possibilityNode(card.root, 'element');
  const signalId = `signal:${region.root.split('.').pop()}:element-field`;
  const reference = `reference:${region.root}/${pack.root}`;

  const bindings = createGraph({
    id: 'scenario:mountains-spire-dragon',
    type: 'Scenario',
    root: reference,
    stage: 'reference',
    tuples: [
      createTuple({ subject: reference, predicate: 'bound-to', object: pack.root }),
      createTuple({ subject: reference, predicate: 'contains', object: region.root }),
      createTuple({ subject: guardian, predicate: 'bound-to', object: card.root, qualifiers: { role: 'guardian' } }),
      createTuple({ subject: signalId, predicate: 'targets', object: dragonElement }),
    ],
  });

  const influence = createInfluence({
    id: 'influence:mountains-field:dragon-element',
    source: signalId,
    target: dragonElement,
    reason: 'Region ElementField satisfies Dragon element Requirement',
  });

  return mergeGraphs({
    id: 'scenario:mountains-spire-dragon',
    type: 'Scenario',
    root: reference,
    stage: 'reference',
  }, [card, pack, region, bindings, influence]);
}

function resolutionGraph(worldProjection) {
  const tuples = [];
  const seenLineage = new Set();

  for (const object of Object.values(worldProjection.objects)) {
    tuples.push(createTuple({ subject: object.key, predicate: 'is-a', object: object.kind }));
    if (object.regionId) tuples.push(createTuple({ subject: `region.${object.regionId}`, predicate: 'contains', object: object.key }));
    for (const child of object.children ?? []) tuples.push(createTuple({ subject: object.key, predicate: 'contains', object: child.key, qualifiers: { role: child.role } }));

    let prior = null;
    for (const step of object.lineage ?? []) {
      const node = `${step.stage}:${step.id}`;
      tuples.push(createTuple({ subject: node, predicate: 'is-a', object: `Lifecycle/${step.stage}` }));
      if (prior) {
        const edge = `${prior}|${node}`;
        if (!seenLineage.has(edge)) {
          tuples.push(createTuple({ subject: prior, predicate: 'resolves-to', object: node }));
          seenLineage.add(edge);
        }
      }
      prior = node;
    }
    if (prior && object.stage === 'instance') tuples.push(createTuple({ subject: prior, predicate: 'resolves-to', object: object.key }));

    const possibilities = object.possibilities?.possibilities ?? object.possibilities ?? {};
    for (const [name, candidates] of Object.entries(possibilities)) {
      if (!candidates || typeof candidates !== 'object' || Array.isArray(candidates)) continue;
      const node = `${object.key}.possibility.${safeId(name)}`;
      tuples.push(createTuple({ subject: object.key, predicate: 'possibility', object: node }));
      for (const [candidate, weight] of Object.entries(candidates)) {
        if (!Number.isFinite(weight)) continue;
        tuples.push(createTuple({ subject: node, predicate: 'candidate', object: candidate, qualifiers: { weight } }));
      }
    }
  }

  return createGraph({
    id: `resolution:${worldProjection.seed}`,
    type: 'Resolution',
    root: 'world.horizontal',
    stage: worldProjection.status === 'resolved' ? 'instance' : 'virtual',
    boundary: { budget: worldProjection.budget, stops: worldProjection.stops },
    tuples,
  });
}

function createAuthoringProjection({ seed = 93208 } = {}) {
  const card = templateGraph(dragonTemplate);
  const pack = templateGraph(spireTemplate);
  const { regionGraph: regions } = createStartingRegions(seed);
  const mountains = regions.byId.get('mountains');
  const context = regionGraph(mountains);
  const scenario = scenarioGraph({ card, pack, region: context });
  const world = resolveWorld({ seed });
  const resolution = resolutionGraph(world);

  return Object.freeze({
    projectionVersion: 1,
    seed,
    grammar: Object.freeze({
      structural: 'tuple graph',
      authoring: Object.freeze(['Card', 'Pack', 'Requirement', 'Rule']),
      dynamic: Object.freeze(['Signal', 'Influence']),
      lifecycle: Object.freeze(['Definition', 'Template', 'Reference', 'Virtual', 'Instance']),
    }),
    views: Object.freeze({
      card,
      pack,
      graph: scenario,
      resolution,
      world,
    }),
    trees: Object.freeze({
      card: rootedTree(card, card.root),
      pack: rootedTree(pack, pack.root),
      scenario: rootedTree(scenario, scenario.root, { maxDepth: 8 }),
    }),
  });
}

module.exports = {
  templateGraph,
  regionGraph,
  scenarioGraph,
  resolutionGraph,
  createAuthoringProjection,
};
