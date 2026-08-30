'use strict';

function createRegion(spec) {
  if (!spec?.id) throw new Error('region requires id');
  const neighbors = [...(spec.boundary?.neighbors ?? [])];
  return Object.freeze({
    id: spec.id,
    kind: 'Region',
    extent: Object.freeze({ ...(spec.extent ?? { measure: 1 }) }),
    boundary: Object.freeze({
      kind: spec.boundary?.kind ?? 'adjacency',
      neighbors: Object.freeze(neighbors),
    }),
    attributes: Object.freeze({ ...(spec.attributes ?? {}) }),
    artifactId: spec.artifactId ?? null,
    slots: Object.freeze({ ...(spec.slots ?? {}) }),
  });
}

function createRegionGraph(regions) {
  const byId = new Map(regions.map((region) => [region.id, region]));
  if (byId.size !== regions.length) throw new Error('duplicate region id');

  for (const region of regions) {
    for (const neighbor of region.boundary.neighbors) {
      if (!byId.has(neighbor)) throw new Error(`region ${region.id} references missing neighbor ${neighbor}`);
      if (!byId.get(neighbor).boundary.neighbors.includes(region.id)) {
        throw new Error(`region boundary is not reciprocal: ${region.id} -> ${neighbor}`);
      }
    }
  }

  return Object.freeze({ kind: 'RegionGraph', byId });
}

module.exports = { createRegion, createRegionGraph };
