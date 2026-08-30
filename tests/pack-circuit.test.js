'use strict';

const assert = require('assert');
const { createAuthoringSession } = require('../src/app/authoring-session');

function guardian(snapshot) {
  const mountains = snapshot.views.world.objects['region:mountains'];
  const situation = snapshot.views.world.objects[mountains.children[0].key];
  const child = situation.children.find((candidate) => candidate.role === 'guardian');
  return snapshot.views.world.objects[child.key];
}

function main() {
  const session = createAuthoringSession({ seed: 93208 });
  let snapshot = session.cloneCard({ cardId: 'persona.dragon', newId: 'persona.ice-dragon' });
  snapshot = session.setCardFixed({ cardId: 'persona.ice-dragon', field: 'species', value: 'Ice Dragon' });

  const guardianPort = snapshot.editor.pack.slots.guardian;
  assert.strictEqual(guardianPort.requirement.accepts, 'Artifact/Persona');
  assert.ok(guardianPort.compatible.some((card) => card.id === 'persona.ice-dragon' && !card.connected));
  assert.strictEqual(session.compatibleWithSlot('persona.ice-dragon', 'guardian'), true);

  snapshot = session.connectCard({ slot: 'guardian', cardId: 'persona.ice-dragon', weight: 1 });
  assert.strictEqual(snapshot.editor.pack.slots.guardian.candidates['persona.ice-dragon'], 1);
  assert.ok(snapshot.views.pack.tuples.some((tuple) =>
    tuple.subject === 'pack.spire.slot.guardian' &&
    tuple.predicate === 'candidate' &&
    tuple.object === 'persona.ice-dragon'));

  snapshot = session.focusPackCandidate({ slot: 'guardian', cardId: 'persona.ice-dragon' });
  const ice = guardian(snapshot);
  assert.strictEqual(ice.label, 'Ice Dragon');
  assert.strictEqual(ice.facts.templateId, 'persona.ice-dragon');
  assert.ok(['Young', 'Mature', 'Ancient'].includes(ice.facts.properties.age));
  assert.ok(['Dormant', 'Territorial', 'Hunting'].includes(ice.facts.properties.temperament));
  assert.ok(ice.possibilities.possibilities.element.Ground > 0);

  snapshot = session.createCard({ grammar: 'Artifact/Item', id: 'item.frozen-crown' });
  snapshot = session.setCardFixed({ cardId: 'item.frozen-crown', field: 'form', value: 'Frozen Crown' });
  assert.strictEqual(session.compatibleWithSlot('item.frozen-crown', 'guardian'), false);
  assert.strictEqual(session.compatibleWithSlot('item.frozen-crown', 'treasure'), true);
  assert.throws(
    () => session.connectCard({ slot: 'guardian', cardId: 'item.frozen-crown', weight: 1 }),
    /Requirement mismatch/,
  );
  snapshot = session.connectCard({ slot: 'treasure', cardId: 'item.frozen-crown', weight: 1 });
  assert.strictEqual(snapshot.editor.pack.slots.treasure.candidates['item.frozen-crown'], 1);

  session.setPackCandidateWeight({ slot: 'guardian', cardId: 'persona.dragon', weight: 1 });
  snapshot = session.disconnectCard({ slot: 'guardian', cardId: 'persona.ice-dragon' });
  assert.ok(!Object.prototype.hasOwnProperty.call(snapshot.editor.pack.slots.guardian.candidates, 'persona.ice-dragon'));
  assert.strictEqual(guardian(snapshot).label, 'Dragon');

  console.log(JSON.stringify({
    pass: true,
    requirement: guardianPort.requirement,
    resolvedAuthoredGuardian: ice.label,
    resolvedTemplate: ice.facts.templateId,
    possibilityKeys: Object.keys(ice.possibilities.possibilities),
  }, null, 2));
}

main();
