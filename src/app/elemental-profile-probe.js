'use strict';

const {
  ELEMENT_RING,
  RELATION_WHEEL,
  deformElementalProfile,
} = require('../model/elemental-profile');

const DEFAULT_COMPOSITION = Object.freeze({ Fire: 10, Water: 1 });
const DEFAULT_DEFORMATION = Object.freeze({
  kind: 'scale-origin',
  origin: 'Water',
  factor: 2,
  source: 'Property.ProfileScale',
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class ElementalProfileProbe {
  constructor() {
    this.reset();
  }

  reset() {
    this.revision = 0;
    this.composition = clone(DEFAULT_COMPOSITION);
    this.deformation = clone(DEFAULT_DEFORMATION);
    return this.snapshot();
  }

  setWeight({ element, weight }) {
    if (!ELEMENT_RING.includes(element)) throw new Error(`unknown Element: ${element}`);
    const value = Number(weight);
    if (!Number.isFinite(value) || value < 0) throw new Error('element weight must be finite and non-negative');
    const next = { ...this.composition, [element]: value };
    if (!ELEMENT_RING.some((name) => Number(next[name] ?? 0) > 0)) {
      throw new Error('elemental composition requires at least one positive weight');
    }
    this.composition = next;
    this.revision += 1;
    return this.snapshot();
  }

  setDeformation({ origin, factor }) {
    if (!ELEMENT_RING.includes(origin)) throw new Error(`unknown Element: ${origin}`);
    const value = Number(factor);
    if (!Number.isFinite(value) || value < 0) throw new Error('deformation factor must be finite and non-negative');
    this.deformation = {
      kind: 'scale-origin',
      origin,
      factor: value,
      source: 'Property.ProfileScale',
    };
    this.revision += 1;
    return this.snapshot();
  }

  snapshot() {
    const resolved = deformElementalProfile(this.composition, [this.deformation]);
    return Object.freeze({
      projectionVersion: 1,
      kind: 'ElementalProfileProbe',
      revision: this.revision,
      ring: ELEMENT_RING,
      relationWheel: RELATION_WHEEL,
      composition: Object.freeze({ ...resolved.base.composition }),
      base: resolved.base,
      deformation: Object.freeze({ ...this.deformation }),
      effective: resolved.effective,
      trace: resolved.trace,
      measurement: Object.freeze({
        at: `probe:${this.revision}`,
        baseComposition: Object.freeze({ ...resolved.base.composition }),
        effectiveComposition: Object.freeze({ ...resolved.effective.composition }),
        changed: resolved.changed,
      }),
    });
  }
}

function createElementalProfileProbe() {
  return new ElementalProfileProbe();
}

module.exports = {
  DEFAULT_COMPOSITION,
  DEFAULT_DEFORMATION,
  ElementalProfileProbe,
  createElementalProfileProbe,
};
