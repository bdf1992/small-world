'use strict';

const core = require('../kernel/m0.5');

const ELEMENTS = Object.freeze([...core.E]);

const TOPOLOGY_CONTRACT = Object.freeze({
  source: 'm0.5.ringPoint+voronoi+ringAdjacency+makeField',
  point: Object.freeze({
    padding: .018,
    radialSampling: 'sqrt(lo^2 + u*(hi^2-lo^2))',
    angleSampling: '-pi/2 + v*2pi',
    seedLabels: Object.freeze(['zone-point', '<zone>', '<index>', 'r|a']),
    centerCanonicalIndex: 0,
    localCanonicalIndex: 0,
    rootEdgeCanonicalRadiusFraction: .82,
  }),
  voronoi: Object.freeze({
    boundaryVertices: 128,
    method: 'clip outer regular polygon against every pairwise nearest-site half-plane',
  }),
  adjacency: Object.freeze({
    localNearest: 5,
    centerNearest: 5,
    otherRootNearest: 6,
    innerRadiusCrossingGuard: .985,
    annulusAngularRingClosure: true,
    symmetricEdges: true,
  }),
  nucleus: Object.freeze({
    firstIndex: 0,
    additionalIndexSeed: 'nucleus-index',
    secondaryTargetOffsets: Object.freeze([0, 1, -1, 2, -2, 3, -3, 4]),
    cyclicTargetWeight: .58,
    seededGumbelWeight: .12,
    probabilityFloor: 1e-9,
    duplicateAvoidance: 'prefer an unused Element nearest the target, then higher prior probability',
  }),
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrap8(value) {
  return ((value % 8) + 8) % 8;
}

function cyclicDistance(a, b) {
  const distance = Math.abs(wrap8(a - b));
  return Math.min(distance, 8 - distance);
}

function gumbel(seed, ...labels) {
  const u = clamp(core.rand(seed, ...labels), 1e-12, 1 - 1e-12);
  return -Math.log(-Math.log(u));
}

function pointDistanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function pointEvidence(world, field, index) {
  const canonical = index === 0;
  const local = Boolean(field.local);
  const zone = field.zone;
  const seed = world.seed;

  if (canonical && (zone === 0 || local)) {
    return Object.freeze({
      source: 'm0.5.ringPoint',
      index,
      mode: local ? 'local-canonical-origin' : 'center-canonical-origin',
      point: Object.freeze({ x: 0, y: 0 }),
      u: null,
      v: null,
      radius: 0,
      angle: null,
      overridden: false,
    });
  }

  const pad = TOPOLOGY_CONTRACT.point.padding;
  const lo = Math.max(0, field.innerR + pad);
  const hi = Math.max(lo + .001, field.outerR - pad);
  const u = core.rand(seed, 'zone-point', zone, index, 'r');
  const v = core.rand(seed, 'zone-point', zone, index, 'a');
  const radius = Math.sqrt(lo * lo + u * (hi * hi - lo * lo));
  const angle = -Math.PI / 2 + v * Math.PI * 2;
  const sampled = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };

  if (!local && zone === 2 && index === 0) {
    const edgeRadius = field.innerR + (field.outerR - field.innerR) * TOPOLOGY_CONTRACT.point.rootEdgeCanonicalRadiusFraction;
    const point = { x: Math.cos(world.edgeAngle) * edgeRadius, y: Math.sin(world.edgeAngle) * edgeRadius };
    return Object.freeze({
      source: 'm0.5.ringPoint+edge-canonical-override',
      index,
      mode: 'edge-canonical-angle',
      point: Object.freeze(point),
      sampledPointBeforeOverride: Object.freeze(sampled),
      u,
      v,
      radius: edgeRadius,
      angle: world.edgeAngle,
      overridden: true,
      overrideRadiusFraction: TOPOLOGY_CONTRACT.point.rootEdgeCanonicalRadiusFraction,
    });
  }

  return Object.freeze({
    source: 'm0.5.ringPoint',
    index,
    mode: 'seeded-annulus-point',
    point: Object.freeze(sampled),
    u,
    v,
    radius,
    angle,
    lo,
    hi,
    overridden: false,
  });
}

function regularPoly(radius, count = TOPOLOGY_CONTRACT.voronoi.boundaryVertices) {
  const points = [];
  for (let index = 0; index < count; index++) {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return points;
}

function clipNearest(poly, a, b) {
  if (!poly.length) return [];
  const nx = 2 * (b.x - a.x);
  const ny = 2 * (b.y - a.y);
  const c = b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y;
  const inside = (point) => nx * point.x + ny * point.y <= c + 1e-9;
  const intersection = (p, q) => {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const denominator = nx * dx + ny * dy;
    if (Math.abs(denominator) < 1e-12) return { x: p.x, y: p.y };
    const t = (c - nx * p.x - ny * p.y) / denominator;
    return { x: p.x + t * dx, y: p.y + t * dy };
  };
  const out = [];
  for (let index = 0; index < poly.length; index++) {
    const p = poly[index];
    const q = poly[(index + 1) % poly.length];
    const pInside = inside(p);
    const qInside = inside(q);
    if (pInside && qInside) out.push(q);
    else if (pInside && !qInside) out.push(intersection(p, q));
    else if (!pInside && qInside) {
      out.push(intersection(p, q));
      out.push(q);
    }
  }
  return out;
}

function voronoi(points, outerR) {
  const boundary = regularPoly(outerR);
  return points.map((point, index) => {
    let polygon = boundary.map((candidate) => ({ ...candidate }));
    for (let other = 0; other < points.length && polygon.length; other++) {
      if (index !== other) polygon = clipNearest(polygon, point, points[other]);
    }
    return polygon;
  });
}

function minRadiusOnSegment(a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const denominator = vx * vx + vy * vy;
  if (denominator < 1e-12) return Math.hypot(a.x, a.y);
  let t = -(a.x * vx + a.y * vy) / denominator;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a.x + t * vx, a.y + t * vy);
}

function nearestCount(field) {
  if (field.local) return TOPOLOGY_CONTRACT.adjacency.localNearest;
  return field.zone === 0 ? TOPOLOGY_CONTRACT.adjacency.centerNearest : TOPOLOGY_CONTRACT.adjacency.otherRootNearest;
}

function replayAdjacency(points, field) {
  const k = nearestCount(field);
  const neighbors = points.map(() => new Set());
  for (let index = 0; index < points.length; index++) {
    const candidates = [];
    for (let other = 0; other < points.length; other++) {
      if (index === other) continue;
      candidates.push([pointDistanceSquared(points[index], points[other]), other]);
    }
    candidates.sort((a, b) => a[0] - b[0]);
    let accepted = 0;
    for (const [, other] of candidates) {
      if (field.innerR > 0 && minRadiusOnSegment(points[index], points[other]) < field.innerR * TOPOLOGY_CONTRACT.adjacency.innerRadiusCrossingGuard) continue;
      neighbors[index].add(other);
      neighbors[other].add(index);
      if (++accepted >= k) break;
    }
  }
  if (field.innerR > 0) {
    const order = points.map((point, index) => [Math.atan2(point.y, point.x), index]).sort((a, b) => a[0] - b[0]);
    for (let q = 0; q < order.length; q++) {
      const index = order[q][1];
      const other = order[(q + 1) % order.length][1];
      neighbors[index].add(other);
      neighbors[other].add(index);
    }
  }
  return neighbors.map((set) => [...set]);
}

function canonicalElement(world, field) {
  if (field.local || world.depth > 0) return world.centerElement;
  if (field.zone === 0) return world.centerElement;
  if (field.zone === 1) return world.barrierElement;
  return world.oppositeElement;
}

function nucleusEvidence(world, field) {
  const count = field.nuclei.length;
  const indices = [0];
  for (let nucleus = 1; nucleus < count; nucleus++) {
    let index = 1 + Math.floor(core.rand(world.seed, 'nucleus-index', field.path, field.zone, nucleus) * (field.cells.length - 1));
    while (indices.includes(index)) index = 1 + (index % (field.cells.length - 1));
    indices.push(index);
  }

  const anchor = canonicalElement(world, field);
  const rotation = field.rotation;
  const offsets = [0, rotation, -rotation, 2 * rotation, -2 * rotation, 3 * rotation, -3 * rotation, 4];
  const selectedElements = [];
  const nuclei = [];

  for (let nucleus = 0; nucleus < indices.length; nucleus++) {
    const index = indices[nucleus];
    const cell = field.cells[index];
    let element;
    let target = anchor;
    let scores = null;

    if (nucleus === 0) {
      element = anchor;
    } else {
      target = wrap8(anchor + offsets[nucleus % offsets.length]);
      scores = cell.prior.map((probability, candidate) => (
        Math.log(Math.max(TOPOLOGY_CONTRACT.nucleus.probabilityFloor, probability))
        + TOPOLOGY_CONTRACT.nucleus.cyclicTargetWeight * (1 - cyclicDistance(candidate, target) / 4)
        + TOPOLOGY_CONTRACT.nucleus.seededGumbelWeight * gumbel(world.seed, 'nucleus-element', field.path, field.zone, nucleus, candidate)
      ));
      element = scores.indexOf(Math.max(...scores));
      if (selectedElements.includes(element)) {
        const candidates = Array.from({ length: 8 }, (_, candidate) => candidate).filter((candidate) => !selectedElements.includes(candidate));
        if (candidates.length) {
          candidates.sort((a, b) => cyclicDistance(a, target) - cyclicDistance(b, target) || cell.prior[b] - cell.prior[a]);
          element = candidates[0];
        }
      }
    }

    selectedElements.push(element);
    nuclei.push(Object.freeze({
      ordinal: nucleus,
      index,
      cellId: cell.id,
      targetElement: ELEMENTS[target],
      targetElementIndex: target,
      selectedElement: ELEMENTS[element],
      selectedElementIndex: element,
      prior: Object.freeze(Object.fromEntries(ELEMENTS.map((name, candidate) => [name, cell.prior[candidate]]))),
      scores: scores ? Object.freeze(Object.fromEntries(ELEMENTS.map((name, candidate) => [name, scores[candidate]]))) : null,
      root: `${field.path}:${field.zone}:${nucleus}`,
    }));
  }

  return Object.freeze({
    source: 'm0.5.makeField:nucleus-selection',
    canonicalElement: ELEMENTS[anchor],
    canonicalElementIndex: anchor,
    rotation,
    count,
    indices: Object.freeze(indices),
    nuclei: Object.freeze(nuclei),
  });
}

function fieldTopologyEvidence(world, field) {
  const pointRows = field.cells.map((_, index) => pointEvidence(world, field, index));
  const points = pointRows.map((row) => row.point);
  const polygons = voronoi(points, field.outerR);
  const adjacency = replayAdjacency(points, field);
  return Object.freeze({
    source: TOPOLOGY_CONTRACT.source,
    contract: TOPOLOGY_CONTRACT,
    zone: field.zone,
    path: field.path,
    local: Boolean(field.local),
    pointRows: Object.freeze(pointRows),
    polygons: Object.freeze(polygons.map((polygon) => Object.freeze(polygon.map((point) => Object.freeze(point))))),
    adjacency: Object.freeze(adjacency.map((neighbors) => Object.freeze(neighbors))),
    nuclei: nucleusEvidence(world, field),
  });
}

function selectedTopologyEvidence(world, field, cell) {
  const fieldEvidence = fieldTopologyEvidence(world, field);
  const index = field.cells.indexOf(cell);
  const nucleus = fieldEvidence.nuclei.nuclei.find((candidate) => candidate.cellId === cell.id) ?? null;
  return Object.freeze({
    source: TOPOLOGY_CONTRACT.source,
    contract: TOPOLOGY_CONTRACT,
    point: fieldEvidence.pointRows[index],
    polygonVertexCount: fieldEvidence.polygons[index].length,
    neighbors: fieldEvidence.adjacency[index],
    nucleus,
  });
}

module.exports = {
  TOPOLOGY_CONTRACT,
  pointEvidence,
  voronoi,
  replayAdjacency,
  nucleusEvidence,
  fieldTopologyEvidence,
  selectedTopologyEvidence,
};
