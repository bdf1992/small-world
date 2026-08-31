'use strict';

const core = require('../kernel/m0.5');
const { overlayElementalProfile } = require('../model/elemental-profile');
const { clockProjection, clockProfileReading } = require('./elemental-clock-context');
const { fieldPriorContract, cellPriorProvenance } = require('./m0.5-map-provenance');
const { nextWaveEvidence } = require('./m0.5-wave-provenance');
const { selectedTopologyEvidence } = require('./m0.5-topology-provenance');
const { resolveWorld } = require('./world');

const ELEMENTS = Object.freeze([...core.E]);
const ZONES = Object.freeze([...core.Z]);
const PLACEMENT_TYPES = Object.freeze(['POI', 'Artifact', 'Persona', 'Event']);

function vectorObject(vector = []) {
  return Object.freeze(Object.fromEntries(ELEMENTS.map((name, index) => [name, Number(vector[index] ?? 0)])));
}

function compactEvent(event) {
  return Object.freeze({
    type: event.type ?? event.kind ?? 'event',
    at: event.at ?? null,
    zone: Number.isInteger(event.zone) ? event.zone : null,
    zoneName: Number.isInteger(event.zone) ? ZONES[event.zone] : null,
    cellId: event.cell?.id ?? null,
    score: Number.isFinite(event.score) ? event.score : null,
    transfer: Number.isFinite(event.transfer) ? event.transfer : null,
    blocked: Number.isFinite(event.blocked) ? event.blocked : null,
    fieldFit: Number.isFinite(event.fieldFit) ? event.fieldFit : null,
    relationFit: Number.isFinite(event.relationFit) ? event.relationFit : null,
    cycleFit: Number.isFinite(event.cycleFit) ? event.cycleFit : null,
    phaseFit: Number.isFinite(event.phaseFit) ? event.phaseFit : null,
    zoneBase: Number.isFinite(event.zoneBase) ? event.zoneBase : null,
    side: Number.isFinite(event.side) ? event.side : null,
    random: Number.isFinite(event.rnd) ? event.rnd : null,
    cycleSeat: Number.isFinite(event.cycleSeat) ? event.cycleSeat : event.cycle?.zoneSeat ?? null,
    entity: event.entity ? Object.freeze({ kind: event.entity.kind, id: event.entity.id }) : null,
  });
}

function placementReceipts(session) {
  return Object.freeze(session.ledger
    .filter((event) => PLACEMENT_TYPES.includes(event.type) && Number.isInteger(event.zone) && Number.isInteger(event.cellId) && event.score != null)
    .map((event) => Object.freeze({
      id: `Placement.${event.at}.${event.zone}.${event.cellId}.${event.type}`,
      source: 'm0.5.spawnTick',
      address: `${session.rootWorld.path}/zone:${event.zone}/cell:${event.cellId}`,
      type: event.type,
      at: event.at,
      zone: event.zone,
      zoneName: event.zoneName,
      cellId: event.cellId,
      score: event.score,
      fieldFit: event.fieldFit,
      relationFit: event.relationFit,
      cycleFit: event.cycleFit,
      phaseFit: event.phaseFit,
      zoneBase: event.zoneBase,
      side: event.side,
      random: event.random,
      cycleSeat: event.cycleSeat,
      entity: event.entity,
    })));
}

function temporalSubject(subject) {
  if (!subject) return null;
  return Object.freeze({
    kind: subject.kind,
    id: subject.id ?? null,
    primary: Number.isInteger(subject.primary) ? ELEMENTS[subject.primary] : ELEMENTS[core.ELEMENT_TENSOR ? 0 : 0],
    profile: vectorObject(subject.profile),
    threshold: subject.threshold,
    baseRate: subject.baseRate,
    cycles: subject.cycles,
    activations: subject.activations,
    completed: Boolean(subject.completed),
    lastPulse: subject.lastPulse ? Object.freeze({ ...subject.lastPulse }) : null,
    lastRate: vectorObject(subject.lastRate),
    glass: Object.freeze({
      capacity: subject.glass?.cap ?? null,
      bulb: subject.glass?.bulb ?? null,
      top: vectorObject(subject.glass?.top),
      bottom: vectorObject(subject.glass?.bottom),
      out: vectorObject(subject.glass?.out),
    }),
  });
}

function playerHourglass(glass) {
  return Object.freeze({
    capacity: glass.cap,
    bulb: glass.bulb,
    top: vectorObject(glass.top),
    bottom: vectorObject(glass.bottom),
    out: vectorObject(glass.out),
  });
}

function cellProjection(world, field, cell, { includePreview = true } = {}) {
  const vector = core.fieldVector(cell);
  const pressureTotal = (cell.temporalPressure ?? []).reduce((sum, value) => sum + value, 0);
  const preview = includePreview
    ? core.childPreviewFor(world, field, cell).map((item) => Object.freeze({
      point: Object.freeze({ x: item.point.x, y: item.point.y }),
      element: ELEMENTS[item.element],
      elementIndex: item.element,
    }))
    : [];

  return Object.freeze({
    id: cell.id,
    zone: cell.zone,
    zoneName: ZONES[cell.zone] ?? `Zone ${cell.zone}`,
    point: Object.freeze({ x: cell.point.x, y: cell.point.y }),
    polygon: Object.freeze(cell.poly.map((point) => Object.freeze({ x: point.x, y: point.y }))),
    neighbors: Object.freeze([...cell.neighbors]),
    resolved: Boolean(cell.resolved),
    element: cell.resolved ? ELEMENTS[cell.element] : null,
    elementIndex: cell.resolved ? cell.element : null,
    noise: vectorObject(cell.noise),
    prior: vectorObject(cell.prior),
    probability: vectorObject(cell.resolved ? vector : cell.prob),
    fieldVector: vectorObject(vector),
    entropy: cell.resolved ? 0 : core.entropy(cell.prob),
    initialEntropy: cell.initialEntropy,
    nucleus: Boolean(cell.nucleus),
    collision: Boolean(cell.collision),
    root: cell.root ?? null,
    rootsTouched: Object.freeze([...(cell.rootsTouched ?? [])]),
    collapseWave: cell.collapseWave ?? null,
    supportHits: cell.supportHits ?? 0,
    cyclicSeat: cell.cyclicSeat ?? null,
    externalPressure: vectorObject(cell.external),
    temporalPressure: vectorObject(cell.temporalPressure),
    temporalPressureTotal: pressureTotal,
    spawnField: vectorObject(cell.spawnField),
    spawns: Object.freeze((cell.spawns ?? []).map((spawn) => Object.freeze({ ...spawn }))),
    entities: Object.freeze((cell.entities ?? []).map(temporalSubject)),
    biomeTime: temporalSubject(cell.biomeTime),
    preview: Object.freeze(preview),
  });
}

function fieldProjection(world, field) {
  return Object.freeze({
    zone: field.zone,
    zoneName: ZONES[field.zone] ?? `Zone ${field.zone}`,
    innerR: field.innerR,
    outerR: field.outerR,
    resolved: field.resolved,
    total: field.cells.length,
    done: Boolean(field.done),
    step: field.step,
    nuclei: Object.freeze(field.nuclei.map((cell) => cell.id)),
    priorContract: fieldPriorContract(field),
    cells: Object.freeze(field.cells.map((cell) => cellProjection(world, field, cell))),
  });
}

function spawnProjection(world, clock, cell) {
  if (!cell?.resolved) return Object.freeze([]);
  return Object.freeze(core.candidateScores(world, clock, cell).map((candidate) => Object.freeze({
    type: candidate.type,
    score: candidate.score,
    fieldFit: candidate.fieldFit,
    relationFit: candidate.relationFit,
    cycleFit: candidate.cycleFit,
    phaseFit: candidate.phaseFit,
    zoneBase: candidate.zoneBase,
    side: candidate.side,
    random: candidate.rnd,
    cycle: Object.freeze({
      zoneSeat: candidate.cycle.zoneSeat,
      globalSeat: candidate.cycle.globalSeat,
      elementSeat: candidate.cycle.elementSeat,
      position: candidate.cycle.position,
      rotation: candidate.cycle.rotation,
    }),
  })));
}

function relationProjection(clock) {
  const rows = [];
  for (let from = 0; from < ELEMENTS.length; from++) {
    for (let to = 0; to < ELEMENTS.length; to++) {
      const relation = core.dynamicRelationWeight(from, to, clock);
      rows.push(Object.freeze({
        from: ELEMENTS[from],
        to: ELEMENTS[to],
        seat: relation.r,
        relation: core.R[relation.r],
        weight: relation.weight,
        modulation: relation.modulation,
      }));
    }
  }
  return Object.freeze(rows);
}

function compactWaveProjection(evidence) {
  return Object.freeze({
    source: evidence.source,
    readOnly: evidence.readOnly,
    currentWave: evidence.currentWave,
    predictedWave: evidence.predictedWave,
    fields: Object.freeze(evidence.fields.map((field) => Object.freeze({
      zone: field.zone,
      zoneName: field.zoneName,
      done: field.done,
      frontier: Object.freeze(field.frontier.map((item) => Object.freeze({
        cellId: item.cellId,
        entropy: item.entropy,
        rootsTouched: item.rootsTouched,
      }))),
      rootProposals: Object.freeze(field.rootProposals.map((item) => Object.freeze({
        root: item.root,
        cellId: item.cellId,
        pickScore: item.pickScore,
      }))),
      selectedCollapses: Object.freeze(field.selectedCollapses.map((item) => Object.freeze({
        cellId: item.cellId,
        selectedByRoot: item.selectedByRoot,
        rootsTouched: item.rootsTouched,
        collision: item.collision,
        predictedElement: item.predictedElement,
        predictedElementIndex: item.predictedElementIndex,
        predictedCollapseWave: item.predictedCollapseWave,
      }))),
      fallback: field.fallback ? Object.freeze({ ...field.fallback }) : null,
    }))),
  });
}

function selectedWaveProjection(evidence, zone, cellId) {
  const field = evidence.fields.find((candidate) => candidate.zone === zone);
  if (!field) return null;
  const frontier = field.frontier.find((candidate) => candidate.cellId === cellId) ?? null;
  const proposals = field.rootProposals.filter((candidate) => candidate.cellId === cellId);
  const collapse = field.selectedCollapses.find((candidate) => candidate.cellId === cellId) ?? null;
  const fallback = field.fallback?.cellId === cellId ? field.fallback : null;
  if (!frontier && !proposals.length && !collapse && !fallback) return null;
  return Object.freeze({
    source: evidence.source,
    readOnly: true,
    currentWave: evidence.currentWave,
    predictedWave: evidence.predictedWave,
    contract: evidence.contract,
    frontier,
    proposals: Object.freeze(proposals),
    collapse,
    fallback,
  });
}

function selectedProjection(session, waveEvidence = nextWaveEvidence(session.activeWorld)) {
  const located = session.locateSelected();
  if (!located) return null;
  const { field, cell } = located;
  const projectedCell = cellProjection(session.activeWorld, field, cell);
  const effectiveField = vectorObject(core.fieldVector(cell));
  const fieldRelationProfile = overlayElementalProfile(effectiveField);
  const supply = cell.resolved ? core.temporalSupply(session.activeWorld, session.clock, cell) : null;
  const placementCandidates = spawnProjection(session.activeWorld, session.clock, cell);
  const priorProvenance = cellPriorProvenance(session.activeWorld, field, cell);
  const topologyProvenance = selectedTopologyEvidence(session.activeWorld, field, cell);
  const receipts = session.activeWorld === session.rootWorld
    ? placementReceipts(session).filter((receipt) => receipt.zone === cell.zone && receipt.cellId === cell.id)
    : Object.freeze([]);

  return Object.freeze({
    cell: projectedCell,
    temporalSupply: supply ? vectorObject(supply) : null,
    spawnCandidates: placementCandidates,
    mapField: Object.freeze({
      source: 'm0.5.map.cell',
      position: projectedCell.point,
      cyclicSeat: projectedCell.cyclicSeat,
      noise: projectedCell.noise,
      externalPressure: projectedCell.externalPressure,
      prior: projectedCell.prior,
      probability: projectedCell.probability,
      initialEntropy: projectedCell.initialEntropy,
      entropy: projectedCell.entropy,
      resolvedElement: projectedCell.element,
      spawnField: projectedCell.spawnField,
      temporalPressure: projectedCell.temporalPressure,
      effectiveField,
      topologyProvenance,
      priorContract: fieldPriorContract(field),
      priorProvenance,
      nextWave: selectedWaveProjection(waveEvidence, cell.zone, cell.id),
      effectiveFieldComposition: Object.freeze({
        unresolved: 'probability',
        resolved: Object.freeze({
          prior: 0.30,
          resolvedElement: 0.36,
          externalPressure: 0.14,
          spawnField: 0.08,
          temporalPressure: 0.12,
          normalized: true,
        }),
      }),
      relationProfile: fieldRelationProfile,
      clockReading: clockProfileReading(fieldRelationProfile, session.clock),
      placement: Object.freeze({
        candidates: placementCandidates,
        markers: projectedCell.spawns,
        history: receipts,
        selectionRule: 'highest candidate score across resolved cells in each field per tick',
      }),
    }),
  });
}

class SimulationSession {
  constructor({ seed = 93208 } = {}) {
    this.reset(seed);
  }

  reset(seed = this.seed ?? 93208) {
    if (!Number.isInteger(seed) || seed < 0) throw new Error('seed must be a non-negative integer');
    this.seed = seed;
    this.rootWorld = core.createWorld(seed);
    this.activeWorld = this.rootWorld;
    this.clock = new core.Clock();
    this.hourglass = new core.Hourglass();
    this.stack = [];
    this.ledger = [];
    this.selected = { zone: this.activeWorld.fields[0].zone, id: this.activeWorld.fields[0].cells[0].id };
    this.generative = resolveWorld({ seed });
    return this.snapshot();
  }

  locateSelected() {
    if (!this.selected) return null;
    const field = this.activeWorld.fields.find((candidate) => candidate.zone === this.selected.zone) ?? this.activeWorld.fields[0];
    const cell = field?.cells.find((candidate) => candidate.id === this.selected.id);
    return cell ? { field, cell } : null;
  }

  select({ zone, id }) {
    if (!Number.isInteger(zone) || !Number.isInteger(id)) throw new Error('select requires integer zone and id');
    const field = this.activeWorld.fields.find((candidate) => candidate.zone === zone);
    const cell = field?.cells.find((candidate) => candidate.id === id);
    if (!cell) throw new Error(`cell not found: zone=${zone} id=${id}`);
    this.selected = { zone, id };
    return this.snapshot();
  }

  step() {
    if (!this.activeWorld.finished) core.generationWave(this.activeWorld);
    return this.snapshot();
  }

  finish() {
    core.finishWorld(this.activeWorld);
    return this.snapshot();
  }

  replay() {
    if (this.activeWorld.path === 'root') return this.reset(this.seed);
    const prior = this.stack[this.stack.length - 1];
    if (!prior) return this.reset(this.seed);
    this.activeWorld = core.createChildWorld(prior.selectedCell, prior.world);
    this.selected = { zone: this.activeWorld.fields[0].zone, id: this.activeWorld.fields[0].cells[0].id };
    return this.snapshot();
  }

  dive() {
    const located = this.locateSelected();
    if (!located?.cell.resolved) throw new Error('selected cell must be resolved before dive');
    this.stack.push({ world: this.activeWorld, selected: { ...this.selected }, selectedCell: located.cell });
    this.activeWorld = core.createChildWorld(located.cell, this.activeWorld);
    this.selected = { zone: this.activeWorld.fields[0].zone, id: this.activeWorld.fields[0].cells[0].id };
    return this.snapshot();
  }

  back() {
    const prior = this.stack.pop();
    if (!prior) return this.snapshot();
    this.activeWorld = prior.world;
    this.selected = prior.selected;
    return this.snapshot();
  }

  advance() {
    if (!this.rootWorld.finished) core.finishWorld(this.rootWorld);
    const result = core.advanceSimulationTick(this.rootWorld, this.clock);
    for (const event of result.temporal) this.ledger.push(compactEvent(event));
    for (const spawn of result.spawns) this.ledger.push(compactEvent({ ...spawn, at: result.at, type: spawn.type }));
    return this.snapshot();
  }

  flipClock() {
    const from = this.clock.side ? 'Night' : 'Day';
    this.clock.flip();
    this.ledger.push(Object.freeze({
      type: `Clock flipped ${from} → ${this.clock.side ? 'Night' : 'Day'}`,
      at: this.clock.address(),
      zone: null,
      zoneName: null,
      cellId: null,
      score: null,
      transfer: null,
      blocked: null,
      fieldFit: null,
      relationFit: null,
      cycleFit: null,
      phaseFit: null,
      zoneBase: null,
      side: null,
      random: null,
      cycleSeat: null,
      entity: null,
    }));
    return this.snapshot();
  }

  spend() {
    const located = this.locateSelected();
    if (!located?.cell.resolved) throw new Error('selected cell must be resolved before spending grain');
    const result = this.hourglass.spend(located.cell.element);
    this.ledger.push(Object.freeze({
      type: result.ok ? `Spent 1 ${ELEMENTS[located.cell.element]}` : `Spend blocked: ${result.reason}`,
      at: this.clock.address(),
      zone: located.cell.zone,
      zoneName: ZONES[located.cell.zone],
      cellId: located.cell.id,
      score: null,
      transfer: result.ok ? 1 : null,
      blocked: result.ok ? null : 1,
      fieldFit: null,
      relationFit: null,
      cycleFit: null,
      phaseFit: null,
      zoneBase: null,
      side: null,
      random: null,
      cycleSeat: null,
      entity: null,
    }));
    return this.snapshot();
  }

  flipHourglass() {
    this.hourglass.flip();
    return this.snapshot();
  }

  snapshot() {
    const active = this.activeWorld;
    const invariants = core.invariants(this.rootWorld);
    const waveEvidence = nextWaveEvidence(active);
    return Object.freeze({
      projectionVersion: 1,
      mode: 'parity-restoration',
      seed: this.seed,
      elements: ELEMENTS,
      relations: Object.freeze([...core.R]),
      zones: ZONES,
      active: Object.freeze({
        path: active.path,
        depth: active.depth,
        seed: active.seed,
        parentCellId: active.parent?.id ?? null,
        wave: active.wave,
        finished: Boolean(active.finished),
        digest: core.digestWorld(active),
        fields: Object.freeze(active.fields.map((field) => fieldProjection(active, field))),
        nextWave: compactWaveProjection(waveEvidence),
        lastEvents: Object.freeze(active.lastEvents.map((event) => Object.freeze({
          zone: event.zone,
          fromCellId: event.from?.id ?? null,
          toCellId: event.to?.id ?? null,
          root: event.root ?? null,
          element: Number.isInteger(event.element) ? ELEMENTS[event.element] : null,
          collision: Boolean(event.collision),
        }))),
      }),
      root: Object.freeze({
        path: this.rootWorld.path,
        wave: this.rootWorld.wave,
        finished: Boolean(this.rootWorld.finished),
        digest: core.digestWorld(this.rootWorld),
        centerElement: ELEMENTS[this.rootWorld.centerElement],
        barrierElement: ELEMENTS[this.rootWorld.barrierElement],
        edgeElement: ELEMENTS[this.rootWorld.oppositeElement],
        rotation: this.rootWorld.rotation > 0 ? 'CW' : 'CCW',
        invariants: Object.freeze({ ...invariants }),
      }),
      stack: Object.freeze(this.stack.map((entry) => Object.freeze({
        path: entry.world.path,
        selected: Object.freeze({ ...entry.selected }),
      }))),
      selected: selectedProjection(this, waveEvidence),
      placements: Object.freeze({
        source: 'm0.5.spawnTick',
        selectionRule: 'highest candidate score across resolved cells in each field per tick',
        receipts: placementReceipts(this),
      }),
      clock: clockProjection(this.clock, this.rootWorld.rotation),
      relationField: relationProjection(this.clock),
      hourglass: playerHourglass(this.hourglass),
      ledger: Object.freeze(this.ledger.slice(-200)),
      generative: Object.freeze({
        status: this.generative.status,
        usage: this.generative.usage,
        stops: this.generative.stops,
        map: this.generative.map,
        objects: this.generative.objects,
      }),
    });
  }
}

function createSimulationSession(options) {
  return new SimulationSession(options);
}

module.exports = {
  ELEMENTS,
  ZONES,
  SimulationSession,
  createSimulationSession,
};
