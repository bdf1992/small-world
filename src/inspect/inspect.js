'use strict';

function summarizeSlots(slots = {}) {
  return Object.fromEntries(Object.entries(slots).map(([name, slot]) => [name, {
    state: slot?.state ?? 'declared',
    accepts: slot?.accepts ?? null,
    count: slot?.count ?? null,
  }]));
}

function facts(value) {
  if (!value || value.stage !== 'instance') return null;
  return Object.freeze({
    id: value.id,
    stage: value.stage,
    grammar: value.grammar,
    kind: value.kind ?? null,
    properties: value.properties ?? null,
    attributes: value.attributes ?? null,
    rarity: value.rarity ?? value.properties?.rarity ?? null,
    stats: value.stats ?? null,
    state: value.state ?? null,
    ownerId: value.ownerId ?? null,
    regionId: value.regionId ?? null,
    packForm: value.packForm ?? null,
    members: value.members
      ? Object.fromEntries(Object.entries(value.members).map(([slot, member]) => [slot, {
        id: member.id,
        templateId: member.templateId,
        grammar: member.grammar,
      }]))
      : null,
    slots: summarizeSlots(value.slots),
  });
}

function possibilities(value) {
  if (!value || value.stage !== 'virtual') return null;
  return Object.freeze({
    id: value.id,
    stage: value.stage,
    grammar: value.grammar,
    fixed: value.fixed ?? {},
    possibilities: value.possibilities ?? {},
    ranges: value.ranges ?? {},
    slots: summarizeSlots(value.slots),
  });
}

function lineage(value) {
  if (!value) return [];
  const chain = [...(value.lineage ?? [])];
  if (value.stage && value.id) {
    const last = chain[chain.length - 1];
    if (!last || last.stage !== value.stage || last.id !== value.id) {
      chain.push({ stage: value.stage, id: value.id });
    }
  }
  return Object.freeze(chain.map((step) => Object.freeze({ ...step })));
}

function signalSummary(entry) {
  const summary = {
    nodeId: entry.nodeId,
    state: entry.state,
  };
  if (entry.state === 'unresolved') {
    summary.reason = entry.reason;
    summary.blockedBy = entry.blockedBy ?? [];
    return Object.freeze(summary);
  }

  const value = entry.value;
  if (value && typeof value === 'object') {
    summary.valueStage = value.stage ?? null;
    summary.valueId = value.id ?? null;
    summary.grammar = value.grammar ?? null;
    if (value.stage === 'virtual') {
      summary.possibilityKeys = Object.keys(value.possibilities ?? {});
      summary.rangeKeys = Object.keys(value.ranges ?? {});
      summary.slotKeys = Object.keys(value.slots ?? {});
    }
    if (value.stage === 'instance') {
      summary.factKeys = [
        value.properties ? 'properties' : null,
        value.attributes ? 'attributes' : null,
        value.stats ? 'stats' : null,
        value.state ? 'state' : null,
      ].filter(Boolean);
    }
  } else {
    summary.valueType = typeof value;
  }
  return Object.freeze(summary);
}

function signals(solve) {
  if (!solve) return null;
  return Object.freeze({
    usage: Object.freeze({ ...(solve.usage ?? {}) }),
    stops: Object.freeze((solve.stops ?? []).map((entry) => Object.freeze({ ...entry }))),
    trace: Object.freeze((solve.trace ?? []).map(signalSummary)),
  });
}

function inspect(value, { solve = null } = {}) {
  return Object.freeze({
    facts: facts(value),
    possibilities: possibilities(value),
    lineage: lineage(value),
    signals: signals(solve),
  });
}

function inspectWorld(world) {
  if (!world || world.kind !== 'World') throw new Error('inspectWorld requires a World result');
  return Object.freeze({
    kind: 'WorldGraphView',
    seed: world.seed,
    regions: Object.freeze(world.regions.map((region) => Object.freeze({
      id: region.id,
      extent: region.extent,
      neighbors: region.boundary.neighbors,
      artifactId: region.artifactId,
      slots: Object.keys(region.slots),
    }))),
    situations: Object.freeze(world.situations.map((situation) => Object.freeze({
      id: situation.id,
      regionId: situation.regionId,
      packForm: situation.packForm,
      members: Object.freeze(Object.fromEntries(Object.entries(situation.members).map(([slot, member]) => [slot, Object.freeze({
        id: member.id,
        templateId: member.templateId,
        grammar: member.grammar,
      })]))),
    }))),
  });
}

module.exports = {
  summarizeSlots,
  facts,
  possibilities,
  lineage,
  signals,
  inspect,
  inspectWorld,
};
