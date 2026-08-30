'use strict';

const { createGraph, createTuple } = require('./tuple-graph');

// Canonical handles for things that already exist in the repository. `sourceGrammar`
// bridges older fixture/instrument grammars without changing their runtime yet.
const TYPES = Object.freeze({
  Artifact: Object.freeze({ id: 'Artifact', sourceGrammar: 'Artifact' }),
  Persona: Object.freeze({ id: 'Artifact.Persona', sourceGrammar: 'Artifact.Persona' }),
  Item: Object.freeze({ id: 'Artifact.Item', sourceGrammar: 'Artifact/Item' }),
  Biome: Object.freeze({ id: 'Artifact.Biome', sourceGrammar: 'Artifact/Biome' }),
  Clock: Object.freeze({ id: 'Artifact.Clock', sourceGrammar: 'Instrument/Clock' }),
  ClockFace: Object.freeze({ id: 'Artifact.ClockFace', sourceGrammar: 'Instrument/ClockFace' }),
  ClockHand: Object.freeze({ id: 'Artifact.ClockHand', sourceGrammar: 'Instrument/ClockHand' }),
  Hour: Object.freeze({ id: 'Artifact.Hour', sourceGrammar: 'Instrument/Hour' }),
  Hourglass: Object.freeze({ id: 'Artifact.Hourglass', sourceGrammar: 'Instrument/Hourglass' }),
  HourglassLock: Object.freeze({ id: 'Artifact.HourglassLock', sourceGrammar: 'Instrument/HourglassLock' }),
  HourglassFilter: Object.freeze({ id: 'Artifact.HourglassFilter', sourceGrammar: 'Instrument/HourglassFilter' }),
  Pack: Object.freeze({ id: 'Pack', sourceGrammar: 'Pack' }),
  Situation: Object.freeze({ id: 'Pack.Situation', sourceGrammar: 'Pack/Situation' }),
});

function relation(subject, predicate, object, count, evidence) {
  return Object.freeze({ subject, predicate, object, count, evidence });
}

// Only relations already evidenced by current definitions/slots/ownership.
// No derived behavior or invented semantic dimensions live here.
const RELATIONS = Object.freeze([
  relation(TYPES.Persona.id, 'is-a', TYPES.Artifact.id, 1, 'minimal Artifact type registry'),
  relation(TYPES.Item.id, 'is-a', TYPES.Artifact.id, 1, 'artifact.item definition'),
  relation(TYPES.Biome.id, 'is-a', TYPES.Artifact.id, 1, 'artifact.biome definition'),
  relation(TYPES.Clock.id, 'is-a', TYPES.Artifact.id, 1, 'instrument.clock lifecycle'),
  relation(TYPES.Hourglass.id, 'is-a', TYPES.Artifact.id, 1, 'instrument.hourglass lifecycle'),
  relation(TYPES.ClockFace.id, 'is-a', TYPES.Artifact.id, 1, 'instrument.clock-face definition'),
  relation(TYPES.ClockHand.id, 'is-a', TYPES.Artifact.id, 1, 'instrument.clock-hand definition'),
  relation(TYPES.Hour.id, 'is-a', TYPES.Artifact.id, 1, 'instrument.hour definition'),
  relation(TYPES.HourglassLock.id, 'is-a', TYPES.Artifact.id, 1, 'instrument.hourglass lock slot'),
  relation(TYPES.HourglassFilter.id, 'is-a', TYPES.Artifact.id, 1, 'instrument.hourglass filter slot'),
  relation(TYPES.Situation.id, 'is-a', TYPES.Pack.id, 1, 'pack.situation definition'),

  relation(TYPES.Clock.id, 'contains', TYPES.ClockFace.id, 1, 'clock face slot'),
  relation(TYPES.Clock.id, 'contains', TYPES.ClockHand.id, '1..N', 'clock hands slot'),
  relation(TYPES.Clock.id, 'contains', TYPES.Hour.id, 12, 'clock hours slot'),

  relation(TYPES.Hourglass.id, 'contains', TYPES.HourglassLock.id, '0..1', 'hourglass lock slot'),
  relation(TYPES.Hourglass.id, 'contains', TYPES.HourglassFilter.id, '0..1', 'hourglass filter slot'),
  relation(TYPES.Hourglass.id, 'bound-to', TYPES.Artifact.id, 1, 'hourglass ownerId contract'),

  relation(TYPES.Biome.id, 'contains', TYPES.Situation.id, '0..N', 'biome situations slot'),
]);

function relationGraph() {
  const tuples = [
    createTuple({ subject: 'Base.Relations', predicate: 'is-a', object: 'RelationGraph' }),
  ];

  for (const type of Object.values(TYPES)) {
    tuples.push(createTuple({
      subject: type.id,
      predicate: 'property',
      object: 'sourceGrammar',
      qualifiers: { value: type.sourceGrammar },
    }));
  }

  for (const edge of RELATIONS) {
    tuples.push(createTuple({
      subject: edge.subject,
      predicate: edge.predicate,
      object: edge.object,
      qualifiers: { count: edge.count, evidence: edge.evidence },
    }));
  }

  return createGraph({
    id: 'base.relations',
    type: 'Graph/Relations',
    root: 'Base.Relations',
    stage: 'authored',
    tuples,
  });
}

function relationsFrom(typeId) {
  return Object.freeze(RELATIONS.filter((edge) => edge.subject === typeId));
}

function relationsTo(typeId) {
  return Object.freeze(RELATIONS.filter((edge) => edge.object === typeId));
}

module.exports = {
  TYPES,
  RELATIONS,
  relationGraph,
  relationsFrom,
  relationsTo,
};
