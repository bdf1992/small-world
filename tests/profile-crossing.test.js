'use strict';

const assert = require('assert');
const {
  createElementalProfileProbe,
} = require('../src/app/elemental-profile-probe');

function main() {
  const probe = createElementalProfileProbe();
  let snapshot = probe.snapshot();

  assert.strictEqual(snapshot.projectionVersion, 2);
  assert.deepStrictEqual(snapshot.base.composition, { Fire: 10, Water: 1 });
  assert.deepStrictEqual(snapshot.effective.composition, { Fire: 10, Water: 2 });
  assert.strictEqual(snapshot.clock.address, '0:0:0:0');
  assert.strictEqual(snapshot.clock.orientation, 'CW');
  assert.strictEqual(snapshot.crossings.length, 0);
  assert.strictEqual(snapshot.hourglass.upper.Fire, 2);
  assert.strictEqual(snapshot.hourglass.lower.Fire, 0);
  assert.strictEqual(snapshot.clockReading.byTarget.Fire.contributions.length, 2);

  const canonicalBase = JSON.stringify(snapshot.base);
  const canonicalWheel = JSON.stringify(snapshot.relationWheel);
  const beforeFireClockScore = snapshot.clockReading.byTarget.Fire.score;

  snapshot = probe.crossTick();
  assert.strictEqual(snapshot.clock.address, '0:0:0:1');
  assert.strictEqual(snapshot.crossings.length, 1);
  const tick = snapshot.crossings[0];
  assert.strictEqual(tick.kind, 'Crossing.ClockHandTick');
  assert.strictEqual(tick.entity, 'Artifact.ClockHand');
  assert.strictEqual(tick.traversal.admitted, true);
  assert.strictEqual(tick.traversal.from, '0:0:0:0');
  assert.strictEqual(tick.traversal.to, '0:0:0:1');
  assert.strictEqual(tick.newlyAddressable, '0:0:0:1');
  assert.notStrictEqual(tick.before.reading.at, tick.after.reading.at);
  assert.notStrictEqual(snapshot.clockReading.byTarget.Fire.score, beforeFireClockScore);
  assert.strictEqual(JSON.stringify(snapshot.base), canonicalBase);
  assert.strictEqual(JSON.stringify(snapshot.relationWheel), canonicalWheel);

  const beforeCrossCount = snapshot.crossings.length;
  snapshot = probe.crossGrain({ element: 'Fire' });
  assert.strictEqual(snapshot.crossings.length, beforeCrossCount + 1);
  const grain = snapshot.crossings[snapshot.crossings.length - 1];
  assert.strictEqual(grain.kind, 'Crossing.GrainNeck');
  assert.strictEqual(grain.entity, 'Grain.Fire');
  assert.strictEqual(grain.boundary, 'Hourglass.Neck');
  assert.strictEqual(grain.traversal.from, 'Hourglass.Upper');
  assert.strictEqual(grain.traversal.via, 'Hourglass.Neck');
  assert.strictEqual(grain.traversal.to, 'Hourglass.Lower');
  assert.strictEqual(grain.before.hourglass.upper.Fire, 2);
  assert.strictEqual(grain.after.hourglass.upper.Fire, 1);
  assert.strictEqual(grain.before.hourglass.lower.Fire, 0);
  assert.strictEqual(grain.after.hourglass.lower.Fire, 1);
  assert.strictEqual(grain.profileReading.target, 'Fire');

  const crossingCountBeforeFlip = snapshot.crossings.length;
  snapshot = probe.flipHourglass();
  assert.strictEqual(snapshot.crossings.length, crossingCountBeforeFlip, 'flipping the instrument is not itself a Crossing');

  const priorOrientation = snapshot.clock.orientation;
  snapshot = probe.flipClock();
  assert.notStrictEqual(snapshot.clock.orientation, priorOrientation);
  assert.strictEqual(snapshot.crossings.length, crossingCountBeforeFlip, 'orientation change is not mislabeled as a Crossing');

  assert.throws(() => probe.crossGrain({ element: 'Steam' }), /unknown Element/);

  const blocked = createElementalProfileProbe();
  blocked.crossGrain({ element: 'Water' });
  let blockedSnapshot = blocked.crossGrain({ element: 'Water' });
  assert.strictEqual(blockedSnapshot.crossings.length, 1);
  assert.strictEqual(blockedSnapshot.lastBlocked.kind, 'TraversalBlocked');
  assert.strictEqual(blockedSnapshot.lastBlocked.reason, 'no grain');

  console.log(JSON.stringify({
    pass: true,
    invariant: 'Crossing requires admitted traversal and records before/after addressable state without mutating the base elemental Profile',
    clock: snapshot.clock,
    crossings: snapshot.crossings.map((entry) => ({ id: entry.id, kind: entry.kind, boundary: entry.boundary })),
  }, null, 2));
}

main();
