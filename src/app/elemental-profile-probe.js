'use strict';

const core = require('../kernel/m0.5');
const {
  ELEMENT_RING,
  RELATION_WHEEL,
  deformElementalProfile,
} = require('../model/elemental-profile');
const {
  clockProjection,
  clockProfileReading,
} = require('./elemental-clock-context');

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

function vectorObject(vector = []) {
  return Object.freeze(Object.fromEntries(
    ELEMENT_RING.map((element, index) => [element, Number(vector[index] ?? 0)]),
  ));
}

function hourglassProjection(hourglass) {
  return Object.freeze({
    capacity: hourglass.cap,
    bulb: hourglass.bulb,
    upper: vectorObject(hourglass.top),
    lower: vectorObject(hourglass.bottom),
    timeless: vectorObject(hourglass.out),
  });
}

class ElementalProfileProbe {
  constructor() {
    this.reset();
  }

  reset() {
    this.revision = 0;
    this.composition = clone(DEFAULT_COMPOSITION);
    this.deformation = clone(DEFAULT_DEFORMATION);
    this.clock = new core.Clock();
    this.hourglass = new core.Hourglass();
    this.crossings = [];
    this.lastBlocked = null;
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

  flipClock() {
    this.clock.flip();
    this.revision += 1;
    return this.snapshot();
  }

  flipHourglass() {
    this.hourglass.flip();
    this.revision += 1;
    return this.snapshot();
  }

  crossTick() {
    const resolved = deformElementalProfile(this.composition, [this.deformation]);
    const beforeClock = clockProjection(this.clock);
    const beforeReading = clockProfileReading(resolved.effective, this.clock);

    this.clock.advance();

    const afterClock = clockProjection(this.clock);
    const afterReading = clockProfileReading(resolved.effective, this.clock);
    const crossing = Object.freeze({
      id: `Crossing.${this.crossings.length + 1}`,
      kind: 'Crossing.ClockHandTick',
      entity: 'Artifact.ClockHand',
      boundary: `Tick.${afterClock.tick}`,
      newlyAddressable: afterClock.address,
      traversal: Object.freeze({
        kind: 'Traversal.ClockHand',
        admitted: true,
        from: beforeClock.address,
        via: 'Artifact.ClockFace',
        to: afterClock.address,
        distance: '1 tick',
      }),
      before: Object.freeze({ clock: beforeClock, reading: beforeReading }),
      after: Object.freeze({ clock: afterClock, reading: afterReading }),
    });

    this.crossings.push(crossing);
    this.lastBlocked = null;
    this.revision += 1;
    return this.snapshot();
  }

  crossGrain({ element }) {
    if (!ELEMENT_RING.includes(element)) throw new Error(`unknown Element: ${element}`);
    const index = ELEMENT_RING.indexOf(element);
    const resolved = deformElementalProfile(this.composition, [this.deformation]);
    const beforeHourglass = hourglassProjection(this.hourglass);
    const reading = clockProfileReading(resolved.effective, this.clock).byTarget[element];
    const result = this.hourglass.spend(index);

    if (!result.ok) {
      this.lastBlocked = Object.freeze({
        kind: 'TraversalBlocked',
        entity: `Grain.${element}`,
        from: 'Hourglass.Upper',
        boundary: 'Hourglass.Neck',
        reason: result.reason,
        at: this.clock.address(),
      });
      this.revision += 1;
      return this.snapshot();
    }

    const afterHourglass = hourglassProjection(this.hourglass);
    const crossing = Object.freeze({
      id: `Crossing.${this.crossings.length + 1}`,
      kind: 'Crossing.GrainNeck',
      entity: `Grain.${element}`,
      element,
      boundary: 'Hourglass.Neck',
      newlyAddressable: 'Hourglass.Lower',
      at: this.clock.address(),
      traversal: Object.freeze({
        kind: 'Traversal.Grain',
        admitted: true,
        from: 'Hourglass.Upper',
        via: 'Hourglass.Neck',
        to: 'Hourglass.Lower',
        distance: '1 neck crossing',
      }),
      profileReading: reading,
      before: Object.freeze({ hourglass: beforeHourglass }),
      after: Object.freeze({ hourglass: afterHourglass }),
    });

    this.crossings.push(crossing);
    this.lastBlocked = null;
    this.revision += 1;
    return this.snapshot();
  }

  snapshot() {
    const resolved = deformElementalProfile(this.composition, [this.deformation]);
    const clock = clockProjection(this.clock);
    const hourglass = hourglassProjection(this.hourglass);
    const clockReading = clockProfileReading(resolved.effective, this.clock);

    return Object.freeze({
      projectionVersion: 2,
      kind: 'ElementalProfileProbe',
      revision: this.revision,
      ring: ELEMENT_RING,
      relationWheel: RELATION_WHEEL,
      composition: Object.freeze({ ...resolved.base.composition }),
      base: resolved.base,
      deformation: Object.freeze({ ...this.deformation }),
      effective: resolved.effective,
      trace: resolved.trace,
      clock,
      clockReading,
      hourglass,
      crossings: Object.freeze(this.crossings.slice(-40)),
      lastBlocked: this.lastBlocked,
      measurement: Object.freeze({
        at: `probe:${this.revision}`,
        baseComposition: Object.freeze({ ...resolved.base.composition }),
        effectiveComposition: Object.freeze({ ...resolved.effective.composition }),
        changed: resolved.changed,
        clockAddress: clock.address,
        clockOrientation: clock.orientation,
        hourglassUpper: hourglass.upper,
        hourglassLower: hourglass.lower,
        crossingCount: this.crossings.length,
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
  hourglassProjection,
  ElementalProfileProbe,
  createElementalProfileProbe,
};
