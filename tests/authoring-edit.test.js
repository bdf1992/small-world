'use strict';

const assert = require('assert');
const { createAuthoringSession } = require('../src/app/authoring-session');

function mountainsSituation(snapshot) {
  const mountains = snapshot.views.world.objects['region:mountains'];
  assert.ok(mountains);
  assert.strictEqual(mountains.children.length, 1);
  return snapshot.views.world.objects[mountains.children[0].key];
}

function guardian(snapshot) {
  const situation = mountainsSituation(snapshot);
  const child = situation.children.find((candidate) => candidate.role === 'guardian');
  assert.ok(child);
  return snapshot.views.world.objects[child.key];
}

function main() {
  const session = createAuthoringSession({ seed: 93208 });
  const initial = session.snapshot();
  assert.strictEqual(initial.projectionVersion, 3);
  assert.strictEqual(initial.revision, 0);
  assert.strictEqual(initial.editor.selectedCardId, 'persona.dragon');
  assert.strictEqual(guardian(initial).label, 'Dragon');

  const banditOnly1 = session.setWeight({ target: 'spire', field: 'guardian', candidate: 'persona.dragon', weight: 0 });
  assert.strictEqual(banditOnly1.revision, 1);
  session.setWeight({ target: 'spire', field: 'guardian', candidate: 'persona.bear', weight: 0 });
  const banditOnly = session.setWeight({ target: 'spire', field: 'guardian', candidate: 'persona.bandit', weight: 1 });
  assert.strictEqual(guardian(banditOnly).label, 'Bandit');
  const guardianTuple = banditOnly.views.pack.tuples.find((tuple) => tuple.subject === 'pack.spire.slot.guardian' && tuple.predicate === 'candidate' && tuple.object === 'persona.dragon');
  assert.strictEqual(guardianTuple.qualifiers.weight, 0);

  const reset = session.reset(93208);
  assert.strictEqual(reset.revision, 0);
  assert.strictEqual(guardian(reset).label, 'Dragon');

  session.setWeight({ target: 'dragon', field: 'rarity', candidate: 'T3', weight: 0 });
  session.setWeight({ target: 'dragon', field: 'rarity', candidate: 'T4', weight: 0 });
  const t5Only = session.setWeight({ target: 'dragon', field: 'rarity', candidate: 'T5', weight: 1 });
  const dragon = guardian(t5Only);
  assert.strictEqual(dragon.label, 'Dragon');
  assert.strictEqual(dragon.facts.rarity, 'T5');
  assert.strictEqual(t5Only.draft.dragon.priors.rarity.T5, 1);

  const strongGround = dragon.possibilities.possibilities.element.Ground;
  const weak = session.setAffinity({ field: 'element', affinity: 'weak' });
  const weakDragon = guardian(weak);
  const weakGround = weakDragon.possibilities.possibilities.element.Ground;
  assert.ok(strongGround > weakGround, 'strong contextual affinity should weight Mountains Ground more than weak affinity');
  assert.strictEqual(weak.draft.dragon.priors.element.affinity, 'weak');

  assert.throws(
    () => session.setWeight({ target: 'dragon', field: 'element', candidate: 'Ground', weight: 1 }),
    /not directly weighted/,
  );
  assert.throws(
    () => session.setAffinity({ affinity: 'extreme' }),
    /weak, medium, or strong/,
  );

  const support = createAuthoringSession({ seed: 93208 });
  support.setWeight({ target: 'spire', field: 'guardian', candidate: 'persona.dragon', weight: 0 });
  support.setWeight({ target: 'spire', field: 'guardian', candidate: 'persona.bandit', weight: 0 });
  assert.throws(
    () => support.setWeight({ target: 'spire', field: 'guardian', candidate: 'persona.bear', weight: 0 }),
    /retain at least one supported candidate/,
  );

  console.log(JSON.stringify({
    pass: true,
    projectionVersion: initial.projectionVersion,
    initialGuardian: guardian(initial).label,
    editedGuardian: guardian(banditOnly).label,
    editedDragonRarity: dragon.facts.rarity,
    strongGround,
    weakGround,
    revision: weak.revision,
  }, null, 2));
}

main();
