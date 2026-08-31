'use strict';

const core = require('../kernel/m0.5');

const ELEMENTS = Object.freeze([...core.E]);
const RELATIONS = Object.freeze([...core.R]);
const SUPPORT = Object.freeze([.18, 1.28, 1.10, .82, .42, .72, .95, 1.18]);

const WAVE_CONTRACT = Object.freeze({
  source: 'm0.5.propagateElement+frontierCells+collapseOne+generationWave',
  supportByRelation: Object.freeze(Object.fromEntries(RELATIONS.map((name, index) => [name, SUPPORT[index]]))),
  frontier: Object.freeze({
    eligible: 'unresolved cell with at least one resolved neighbor carrying a root',
    oneProposalPerRoot: true,
    rootPick: 'minimum entropy(probability) + deterministic tie jitter',
    tieJitterScale: 1e-5,
    proposalOrder: 'ascending pick score, then root id lexical',
    cellDeduplication: 'first proposal for a cell wins; later proposals for the same cell are skipped',
  }),
  collapse: Object.freeze({
    probabilityFloor: 1e-12,
    crowdPenaltyPerExtraSameNeighbor: .34,
    seededGumbelScale: .17,
    elementPick: 'argmax(log(probability) - crowdPenalty + seededGumbel)',
    sequentialSupport: 'earlier selected collapses propagate support before later selected collapses choose their Element',
    collision: 'rootsTouched.length > 1',
    rootIdentity: 'single root preserved; multiple roots sorted and joined with +',
    collapseWave: 'world.wave + 1',
  }),
  fallback: Object.freeze({
    when: 'no frontier proposal collapses while unresolved cells remain',
    cellPick: 'deterministic seeded index from unresolved cells',
    elementPick: 'argmax(current probability)',
    becomesNucleus: true,
  }),
  initialNucleus: Object.freeze({
    source: 'm0.5.makeField',
    firstIndex: 0,
    additionalIndices: 'deterministic seeded unique indices',
    primaryElement: 'canonical element (or argmax base profile)',
    secondaryTargetOffsets: Object.freeze(['0', '+rotation', '-rotation', '+2rotation', '-2rotation', '+3rotation', '-3rotation', '4']),
    secondaryScore: 'log(probability) + 0.58*(1-cyclicDistance(element,target)/4) + 0.12*seededGumbel',
    duplicateAvoidance: 'prefer unused element nearest target, then higher probability',
  }),
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrap8(value) {
  return ((value % 8) + 8) % 8;
}

function relationIndex(a, b) {
  return wrap8(b - a);
}

function normalize(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 1 / values.length);
  return values.map((value) => value / total);
}

function gumbel(seed, ...labels) {
  const u = clamp(core.rand(seed, ...labels), 1e-12, 1 - 1e-12);
  return -Math.log(-Math.log(u));
}

function vectorObject(values) {
  return Object.freeze(Object.fromEntries(ELEMENTS.map((name, index) => [name, Number(values[index] ?? 0)])));
}

function frontierItems(field) {
  const out = [];
  for (const cell of field.cells) {
    if (cell.resolved) continue;
    const sources = [];
    for (const neighborIndex of cell.neighbors) {
      const neighbor = field.cells[neighborIndex];
      if (neighbor.resolved && neighbor.root) sources.push(neighbor);
    }
    if (!sources.length) continue;
    out.push({
      cell,
      sources,
      roots: [...new Set(sources.map((source) => source.root))],
    });
  }
  return out;
}

function shadowField(field) {
  return field.cells.map((cell) => ({
    id: cell.id,
    neighbors: [...cell.neighbors],
    resolved: Boolean(cell.resolved),
    element: cell.element,
    root: cell.root,
    prob: cell.prob.slice(),
    supportHits: cell.supportHits ?? 0,
  }));
}

function collapseElementScoresFor(world, field, cellState, cells) {
  const neighborElements = cellState.neighbors
    .map((index) => cells[index])
    .filter((neighbor) => neighbor.resolved)
    .map((neighbor) => neighbor.element);

  const rows = cellState.prob.map((probability, element) => {
    const sameNeighborCount = neighborElements.filter((value) => value === element).length;
    const crowdPenalty = Math.max(0, sameNeighborCount - 1) * WAVE_CONTRACT.collapse.crowdPenaltyPerExtraSameNeighbor;
    const randomRaw = gumbel(world.rootSeed, 'collapse', world.path, field.zone, world.wave, cellState.id, element);
    const random = WAVE_CONTRACT.collapse.seededGumbelScale * randomRaw;
    const logProbability = Math.log(Math.max(WAVE_CONTRACT.collapse.probabilityFloor, probability));
    return Object.freeze({
      element: ELEMENTS[element],
      elementIndex: element,
      probability,
      sameNeighborCount,
      logProbability,
      crowdPenalty,
      randomRaw,
      random,
      score: logProbability - crowdPenalty + random,
    });
  });

  let best = rows[0];
  for (const row of rows.slice(1)) if (row.score > best.score) best = row;
  return Object.freeze({ rows: Object.freeze(rows), winner: best });
}

function collapseElementScores(world, field, item) {
  return collapseElementScoresFor(world, field, item.cell, field.cells);
}

function propagateOnShadow(cells, cellState, element) {
  const receipts = [];
  for (const neighborIndex of cellState.neighbors) {
    const neighbor = cells[neighborIndex];
    if (neighbor.resolved) continue;
    const before = neighbor.prob.slice();
    const multipliers = before.map((_, candidateElement) => SUPPORT[relationIndex(element, candidateElement)]);
    const after = normalize(before.map((probability, candidateElement) => probability * multipliers[candidateElement]));
    receipts.push(Object.freeze({
      cellId: neighbor.id,
      supportHitsBefore: neighbor.supportHits,
      supportHitsAfter: neighbor.supportHits + 1,
      sourceElement: ELEMENTS[element],
      relationMultipliers: vectorObject(multipliers),
      before: vectorObject(before),
      after: vectorObject(after),
    }));
    neighbor.prob = after;
    neighbor.supportHits++;
  }
  return Object.freeze(receipts);
}

function propagationPreview(field, cell, element) {
  const cells = shadowField(field);
  const shadow = cells[cell.index ?? field.cells.indexOf(cell)];
  return propagateOnShadow(cells, shadow, element);
}

function fieldNextWaveEvidence(world, field) {
  if (field.done) {
    return Object.freeze({
      zone: field.zone,
      zoneName: core.Z[field.zone],
      done: true,
      frontier: Object.freeze([]),
      rootProposals: Object.freeze([]),
      selectedCollapses: Object.freeze([]),
      fallback: null,
    });
  }

  const frontier = frontierItems(field);
  const byRoot = new Map();
  for (const item of frontier) {
    for (const root of item.roots) {
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root).push(item);
    }
  }

  const rootProposals = [];
  for (const [root, items] of byRoot) {
    let pick = null;
    let best = Infinity;
    for (const item of items) {
      const entropy = core.entropy(item.cell.prob);
      const tieJitter = core.rand(world.rootSeed, 'frontier-tie', world.path, world.wave, item.cell.id, root) * WAVE_CONTRACT.frontier.tieJitterScale;
      const pickScore = entropy + tieJitter;
      if (pickScore < best) {
        best = pickScore;
        pick = item;
      }
    }
    if (pick) {
      rootProposals.push(Object.freeze({
        root,
        cellId: pick.cell.id,
        entropy: core.entropy(pick.cell.prob),
        tieJitter: best - core.entropy(pick.cell.prob),
        pickScore: best,
        rootsTouched: Object.freeze([...pick.roots].sort()),
        sourceCellIds: Object.freeze(pick.sources.map((source) => source.id)),
      }));
    }
  }

  rootProposals.sort((a, b) => a.pickScore - b.pickScore || String(a.root).localeCompare(String(b.root)));
  const used = new Set();
  const selectedCollapses = [];
  const cells = shadowField(field);

  for (const proposal of rootProposals) {
    if (used.has(proposal.cellId)) continue;
    const item = frontier.find((candidate) => candidate.cell.id === proposal.cellId);
    if (!item) continue;
    const cellIndex = field.cells.indexOf(item.cell);
    const shadow = cells[cellIndex];
    if (!shadow || shadow.resolved) continue;

    used.add(proposal.cellId);
    const probabilityBefore = shadow.prob.slice();
    const elementScores = collapseElementScoresFor(world, field, shadow, cells);
    const rootsTouched = [...item.roots].sort();
    const winningElement = elementScores.winner.elementIndex;

    shadow.resolved = true;
    shadow.element = winningElement;
    shadow.root = rootsTouched.length === 1 ? rootsTouched[0] : rootsTouched.join('+');
    const propagation = propagateOnShadow(cells, shadow, winningElement);

    selectedCollapses.push(Object.freeze({
      cellId: item.cell.id,
      selectedByRoot: proposal.root,
      rootsTouched: Object.freeze(rootsTouched),
      collision: rootsTouched.length > 1,
      resultingRoot: shadow.root,
      predictedElement: elementScores.winner.element,
      predictedElementIndex: winningElement,
      predictedCollapseWave: world.wave + 1,
      probabilityBefore: vectorObject(probabilityBefore),
      elementScores,
      propagation,
    }));
  }

  let fallback = null;
  if (!selectedCollapses.length && field.resolved < field.cells.length) {
    const unresolved = field.cells.filter((cell) => !cell.resolved);
    const random = core.rand(world.rootSeed, 'fallback-nucleus', world.path, field.zone, field.step);
    const index = Math.floor(random * unresolved.length);
    const cell = unresolved[index];
    let element = 0;
    for (let i = 1; i < cell.prob.length; i++) if (cell.prob[i] > cell.prob[element]) element = i;
    fallback = Object.freeze({
      random,
      unresolvedCount: unresolved.length,
      pickedIndex: index,
      cellId: cell.id,
      predictedElement: ELEMENTS[element],
      predictedElementIndex: element,
      predictedRoot: `${world.path}:${field.zone}:f${field.step}`,
      predictedCollapseWave: world.wave + 1,
      becomesNucleus: true,
    });
  }

  return Object.freeze({
    zone: field.zone,
    zoneName: core.Z[field.zone],
    done: false,
    wave: world.wave,
    frontier: Object.freeze(frontier.map((item) => Object.freeze({
      cellId: item.cell.id,
      entropy: core.entropy(item.cell.prob),
      rootsTouched: Object.freeze([...item.roots].sort()),
      sourceCellIds: Object.freeze(item.sources.map((source) => source.id)),
    }))),
    rootProposals: Object.freeze(rootProposals),
    selectedCollapses: Object.freeze(selectedCollapses),
    fallback,
  });
}

function nextWaveEvidence(world) {
  return Object.freeze({
    source: WAVE_CONTRACT.source,
    readOnly: true,
    worldPath: world.path,
    currentWave: world.wave,
    predictedWave: world.wave + 1,
    contract: WAVE_CONTRACT,
    fields: Object.freeze(world.fields.map((field) => fieldNextWaveEvidence(world, field))),
  });
}

module.exports = {
  SUPPORT,
  WAVE_CONTRACT,
  frontierItems,
  collapseElementScores,
  propagationPreview,
  fieldNextWaveEvidence,
  nextWaveEvidence,
};
