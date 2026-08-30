'use strict';

const assert = require('assert');
const { createResolutionAuthoringSession } = require('../src/app/resolution-session');
const {
  parseAuthoringDocument,
  serializeAuthoringDocument,
  validateAuthoringDocument,
} = require('../src/app/authoring-document');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function guardian(snapshot) {
  const mountains = snapshot.views.world.objects['region:mountains'];
  assert.ok(mountains);
  const situation = snapshot.views.world.objects[mountains.children[0].key];
  assert.ok(situation);
  const child = situation.children.find((candidate) => candidate.role === 'guardian');
  assert.ok(child);
  return snapshot.views.world.objects[child.key];
}

function main() {
  const source = createResolutionAuthoringSession({ seed: 93208 });
  source.cloneCard({ cardId: 'persona.dragon', newId: 'persona.ice-dragon' });
  source.setCardFixed({ cardId: 'persona.ice-dragon', field: 'species', value: 'Ice Dragon' });
  source.setCardWeight({ cardId: 'persona.ice-dragon', field: 'rarity', candidate: 'T3', weight: 0 });
  source.setCardWeight({ cardId: 'persona.ice-dragon', field: 'rarity', candidate: 'T4', weight: 0 });
  source.setCardWeight({ cardId: 'persona.ice-dragon', field: 'rarity', candidate: 'T5', weight: 1 });
  source.connectCard({ slot: 'guardian', cardId: 'persona.ice-dragon', weight: 1 });
  const authored = source.focusPackCandidate({ slot: 'guardian', cardId: 'persona.ice-dragon' });
  assert.strictEqual(guardian(authored).label, 'Ice Dragon');

  const text = source.serializeDocument();
  const document = parseAuthoringDocument(text);
  assert.strictEqual(document.format, 'small-world.authoring');
  assert.strictEqual(document.version, 1);
  assert.ok(document.cards['persona.ice-dragon']);
  assert.strictEqual(document.packs['pack.spire'].slots.guardian.candidates['persona.ice-dragon'], 1);

  // Runtime/session/lifecycle state must not leak into the authored document.
  assert.ok(!text.includes('"seed"'));
  assert.ok(!text.includes('"budget"'));
  assert.ok(!text.includes('"resolutionRevision"'));
  assert.ok(!text.includes('"selectedCardId"'));
  assert.ok(!text.includes('"referenceId"'));
  assert.ok(!text.includes('"virtualId"'));
  assert.ok(!text.includes('"stage"'));

  const second = serializeAuthoringDocument(document);
  assert.strictEqual(second, text, 'serialize → parse → serialize must be byte-stable');

  const target = createResolutionAuthoringSession({ seed: 93208 });
  const imported = target.importDocument(text);
  assert.strictEqual(imported.revision, 1, 'one valid import is one authored revision');
  assert.strictEqual(imported.resolutionRevision, 0, 'import must not masquerade as a resolution-budget edit');
  assert.strictEqual(guardian(imported).label, 'Ice Dragon');
  assert.strictEqual(guardian(imported).facts.templateId, 'persona.ice-dragon');
  assert.strictEqual(target.serializeDocument(), text, 'fresh-session export after import must reproduce exact bytes');

  target.selectCard({ cardId: 'persona.ice-dragon' });
  const selected = target.snapshot();
  assert.deepStrictEqual(selected.views.card.tuples, authored.views.card.tuples, 'imported authored Card graph drifted');
  assert.deepStrictEqual(selected.views.pack.tuples, authored.views.pack.tuples, 'imported authored Pack graph drifted');

  const beforeFailure = target.serializeDocument();
  const beforeFailureRevision = target.snapshot().revision;

  const wrongVersion = clone(document);
  wrongVersion.version = 2;
  assert.strictEqual(validateAuthoringDocument(wrongVersion).valid, false);
  assert.throws(() => target.importDocument(wrongVersion), /version must be 1/);
  assert.strictEqual(target.serializeDocument(), beforeFailure);
  assert.strictEqual(target.snapshot().revision, beforeFailureRevision);

  const smuggledRuntime = clone(document);
  smuggledRuntime.seed = 93208;
  assert.throws(() => target.importDocument(smuggledRuntime), /unsupported field seed/);
  assert.strictEqual(target.serializeDocument(), beforeFailure);

  const mismatched = clone(document);
  mismatched.packs['pack.spire'].slots.guardian.candidates['item.sword'] = 1;
  assert.throws(() => target.importDocument(mismatched), /accepts Artifact\/Persona but item\.sword provides Artifact\/Item/);
  assert.strictEqual(target.serializeDocument(), beforeFailure);

  const unknown = clone(document);
  unknown.packs['pack.spire'].slots.guardian.candidates['persona.unknown'] = 1;
  assert.throws(() => target.importDocument(unknown), /unknown candidate persona\.unknown/);
  assert.strictEqual(target.serializeDocument(), beforeFailure);

  const unsupportedPackMutation = clone(document);
  unsupportedPackMutation.packs['pack.spire'].rules = { invented: true };
  assert.throws(() => target.importDocument(unsupportedPackMutation), /rules is canonical/);
  assert.strictEqual(target.serializeDocument(), beforeFailure);

  const zeroSupport = clone(document);
  for (const candidate of Object.keys(zeroSupport.packs['pack.spire'].slots.guardian.candidates)) {
    zeroSupport.packs['pack.spire'].slots.guardian.candidates[candidate] = 0;
  }
  assert.throws(() => target.importDocument(zeroSupport), /retain at least one supported candidate/);
  assert.strictEqual(target.serializeDocument(), beforeFailure);

  assert.throws(() => target.importDocument('{nope'), /invalid Authoring Document JSON/);
  assert.strictEqual(target.serializeDocument(), beforeFailure, 'failed JSON import partially mutated authored state');
  assert.strictEqual(target.snapshot().revision, beforeFailureRevision, 'failed imports must be atomic');

  console.log(JSON.stringify({
    pass: true,
    bytes: text.length,
    cards: Object.keys(document.cards),
    importedGuardian: guardian(imported).label,
    stable: second === text,
    atomicFailures: 6,
  }, null, 2));
}

main();
