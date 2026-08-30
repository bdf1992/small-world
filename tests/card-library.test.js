'use strict';

const assert = require('assert');
const { dragonTemplate } = require('../src/content/personas/dragon');
const { createStartingRegions } = require('../src/runtime/horizontal-world');
const {
  defaultCardDraft,
  cardDraftFromTemplate,
  validateCardDraft,
  resolveCardDraft,
} = require('../src/app/card-library');

const { regionGraph } = createStartingRegions(93208);
const mountains = regionGraph.byId.get('mountains');

const fresh = defaultCardDraft({ grammar: 'Artifact/Persona', id: 'persona.ranger' });
assert.strictEqual(validateCardDraft(fresh).valid, true);
const freshResolved = resolveCardDraft(fresh, { seed: 93208, region: mountains });
assert.strictEqual(freshResolved.template.id, 'persona.ranger');
assert.strictEqual(freshResolved.virtual.stage, 'virtual');
assert.strictEqual(freshResolved.instance.stage, 'instance');
assert.ok(freshResolved.virtual.possibilities.element.Ground > freshResolved.virtual.possibilities.element.Void);

const iceDragon = cardDraftFromTemplate(dragonTemplate);
iceDragon.id = 'persona.ice-dragon';
iceDragon.fixed.species = 'Ice Dragon';
iceDragon.priors.rarity = { T5: 1 };
iceDragon.priors.element.affinity = 'strong';
assert.strictEqual(validateCardDraft(iceDragon).valid, true);
const iceResolved = resolveCardDraft(iceDragon, { seed: 93208, region: mountains });
assert.strictEqual(iceResolved.instance.properties.species, 'Ice Dragon');
assert.ok(['Young', 'Mature', 'Ancient'].includes(iceResolved.instance.properties.age));
assert.ok(['Dormant', 'Territorial', 'Hunting'].includes(iceResolved.instance.properties.temperament));
assert.strictEqual(iceResolved.instance.rarity, 'T5');
assert.match(iceResolved.instance.id, /^ice-dragon-/);
assert.ok(iceResolved.virtual.possibilities.age.Mature > 0);

const badId = defaultCardDraft({ id: 'Not Valid' });
assert.strictEqual(validateCardDraft(badId).valid, false);

const missingIdentity = defaultCardDraft({ id: 'persona.empty' });
missingIdentity.fixed.species = '';
assert.ok(validateCardDraft(missingIdentity).errors.some((error) => error.includes('species')));

const noSupport = defaultCardDraft({ id: 'persona.no-support' });
noSupport.priors.rarity = { T1: 0, T2: 0 };
assert.ok(validateCardDraft(noSupport).errors.some((error) => error.includes('retain support')));

console.log(JSON.stringify({
  pass: true,
  fresh: freshResolved.instance.id,
  clone: iceResolved.instance.id,
  clonePossibilities: Object.keys(iceResolved.virtual.possibilities),
}, null, 2));
