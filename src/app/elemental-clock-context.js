'use strict';

const core = require('../kernel/m0.5');
const { ELEMENT_RING } = require('../model/elemental-profile');

function clockProjection(clock, rotation = 1) {
  return Object.freeze({
    cycle: clock.cycle,
    tick: clock.tick,
    side: clock.side ? 'Night' : 'Day',
    orientation: clock.side ? 'CCW' : 'CW',
    position: clock.position,
    tickInPosition: clock.tickInPosition,
    address: clock.address(),
    phase: clock.phase(rotation),
  });
}

function clockProfileReading(profile, clock) {
  const byTarget = {};

  for (const [targetIndex, target] of ELEMENT_RING.entries()) {
    const contributions = [];
    let score = 0;

    for (const [originIndex, origin] of ELEMENT_RING.entries()) {
      const share = Number(profile.shares[origin] ?? 0);
      if (share <= 0) continue;

      const canonical = (profile.byElement[target] ?? []).find((entry) => entry.origin === origin);
      const dynamic = core.dynamicRelationWeight(originIndex, targetIndex, clock);
      const contributionScore = share * dynamic.weight;
      score += contributionScore;

      contributions.push(Object.freeze({
        origin,
        target,
        rawWeight: Number(profile.composition[origin] ?? 0),
        share,
        canonicalRole: canonical?.role ?? null,
        contextualRole: core.R[dynamic.r],
        modulation: dynamic.modulation,
        signedWeight: dynamic.weight,
        contributionScore,
      }));
    }

    byTarget[target] = Object.freeze({
      target,
      score,
      contributions: Object.freeze(contributions),
    });
  }

  return Object.freeze({
    at: clock.address(),
    side: clock.side ? 'Night' : 'Day',
    orientation: clock.side ? 'CCW' : 'CW',
    phase: clock.phase(1),
    byTarget: Object.freeze(byTarget),
  });
}

module.exports = {
  clockProjection,
  clockProfileReading,
};
