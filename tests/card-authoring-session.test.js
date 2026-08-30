'use strict';

const assert = require('assert');
const { createAuthoringSession } = require('../src/app/authoring-session');

const session = createAuthoringSession({ seed: 93208 });
let snapshot = session.snapshot();
assert.strictEqual(Object.keys(snapshot.editor.cards).length, 1);
assert.strictEqual(snapshot.editor.selectedCardId, 'persona.dragon');

snapshot = session.cloneCard({ cardId: 'persona.dragon', newId: 'persona.ice-dragon' });
assert.strictEqual(snapshot.editor.selectedCardId, 'persona.ice-dragon');
assert.strictEqual(Object.keys(snapshot.editor.cards).length, 2);

snapshot = session.setCardFixed({ cardId: 'persona.ice-dragon', field: 'species', value: 'Ice Dragon' });
snapshot = session.setCardWeight({ cardId: 'persona.ice-dragon', field: 'rarity', candidate: 'T3', weight: 0 });
snapshot = session.setCardWeight({ cardId: 'persona.ice-dragon', field: 'rarity', candidate: 'T4', weight: 0 });
snapshot = session.setCardWeight({ cardId: 'persona.ice-dragon', field: 'rarity', candidate: 'T5', weight: 1 });
assert.strictEqual(snapshot.preview.instance.properties.species, 'Ice Dragon');
assert.strictEqual(snapshot.preview.instance.rarity, 'T5');
assert.match(snapshot.preview.instance.id, /^ice-dragon-/);
assert.strictEqual(snapshot.views.card.root, 'persona.ice-dragon');

snapshot = session.renameCard({ cardId: 'persona.ice-dragon', newId: 'persona.frost-dragon' });
assert.strictEqual(snapshot.editor.selectedCardId, 'persona.frost-dragon');
assert.strictEqual(snapshot.preview.instance.properties.species, 'Ice Dragon');
assert.ok(snapshot.editor.cards['persona.frost-dragon']);
assert.ok(!snapshot.editor.cards['persona.ice-dragon']);

snapshot = session.createCard({ grammar: 'Artifact/Item', id: 'item.frozen-crown' });
snapshot = session.setCardFixed({ cardId: 'item.frozen-crown', field: 'form', value: 'Frozen Crown' });
assert.strictEqual(snapshot.preview.instance.properties.form, 'Frozen Crown');
assert.strictEqual(snapshot.preview.instance.grammar, 'Artifact/Item');
assert.match(snapshot.preview.instance.id, /^frozen-crown-/);

snapshot = session.deleteCard({ cardId: 'item.frozen-crown' });
assert.strictEqual(snapshot.editor.selectedCardId, 'persona.dragon');
assert.ok(!snapshot.editor.cards['item.frozen-crown']);

assert.throws(() => session.deleteCard({ cardId: 'persona.dragon' }), /cannot be deleted/);
assert.throws(() => session.renameCard({ cardId: 'persona.dragon', newId: 'persona.other' }), /cannot be renamed/);
assert.throws(() => session.createCard({ grammar: 'Artifact/Persona', id: 'Bad Id' }), /dotted lowercase identifier/);

console.log(JSON.stringify({
  pass: true,
  revision: snapshot.revision,
  cards: Object.keys(snapshot.editor.cards),
  selected: snapshot.editor.selectedCardId,
}, null, 2));
