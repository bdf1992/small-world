'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  genericPersonaCard,
  genericItemCard,
  genericSituationPack,
  resolveGenerator,
  one,
} = require('../src/content/generative-authoring');
const { TOKENS } = require('../src/content/token-packs');

function tokenTexts(result) {
  return result.instance.tokens.map((token) => token.text);
}

function sourceTree(root) {
  return fs.readdirSync(root, { withFileTypes: true }).map((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? sourceTree(target) : fs.readFileSync(target, 'utf8');
  }).flat().join('\n');
}

function main() {
  // Same generic Persona Card identity; different structural priors produce different named outcomes.
  const dragonRecipe = genericPersonaCard({
    id: 'card.persona',
    bodyPlan: one('quadruped'),
    size: one('large'),
    mobility: one('flying'),
    covering: one('scales'),
    cognition: one('cunning'),
    armament: one('natural'),
    age: one('ancient'),
    temperament: one('territorial'),
    element: one('Ground'),
    rarity: one('T4'),
  });
  assert.deepStrictEqual(dragonRecipe.fixed, {}, 'generic Card must not contain Dragon as fixed identity');
  assert.strictEqual(dragonRecipe.id, 'card.persona');

  const dragon = resolveGenerator(dragonRecipe, { seed: 93208, id: 'proof.persona.dragon' });
  assert.ok(dragon.virtualNaming.tokens.some((token) => token.id === TOKENS.dragon.id), 'Virtual threshold should already recognize Dragon-like possibility');
  assert.deepStrictEqual(tokenTexts(dragon), ['Stone', 'Dragon']);
  assert.strictEqual(dragon.instance.name, 'Stone Dragon');
  assert.strictEqual(dragon.instance.properties.bodyPlan, 'quadruped');
  assert.strictEqual(dragon.instance.properties.mobility, 'flying');
  assert.strictEqual(dragon.instance.attributes.element, 'Ground');
  assert.strictEqual(dragon.instance.templateId, 'card.persona');

  const mantisRecipe = genericPersonaCard({
    id: 'card.persona',
    bodyPlan: one('arthropod'),
    size: one('medium'),
    mobility: one('grounded'),
    covering: one('chitin'),
    cognition: one('instinctive'),
    armament: one('natural'),
    age: one('mature'),
    temperament: one('hunting'),
    element: one('Chaos'),
    rarity: one('T2'),
  });
  const mantis = resolveGenerator(mantisRecipe, { seed: 93208, id: 'proof.persona.mantis' });
  assert.deepStrictEqual(tokenTexts(mantis), ['Wild', 'Mantis']);
  assert.strictEqual(mantis.instance.name, 'Wild Mantis');
  assert.strictEqual(mantis.instance.templateId, 'card.persona');

  const lanternRecipe = genericItemCard({
    id: 'card.item',
    geometry: one('vessel'),
    function: one('light'),
    scale: one('hand'),
    material: one('metal'),
    element: one('Fire'),
    rarity: one('T2'),
  });
  const lantern = resolveGenerator(lanternRecipe, { seed: 93208, id: 'proof.item.lantern' });
  assert.deepStrictEqual(tokenTexts(lantern), ['Ember', 'Lantern']);
  assert.strictEqual(lantern.instance.name, 'Ember Lantern');
  assert.strictEqual(lantern.instance.templateId, 'card.item');

  const observatoryRecipe = genericSituationPack({
    id: 'pack.situation',
    origin: one('constructed'),
    enclosure: one('partial'),
    verticality: one('high'),
    depth: one('shallow'),
    decay: one('fresh'),
    purpose: one('observe'),
    element: one('Sky'),
    rarity: one('T3'),
  });
  assert.deepStrictEqual(observatoryRecipe.fixed, {}, 'generic Pack must not contain Observatory as fixed form');
  const observatory = resolveGenerator(observatoryRecipe, { seed: 93208, id: 'proof.situation.observatory' });
  assert.ok(observatory.virtualNaming.tokens.some((token) => token.id === TOKENS.observatory.id), 'Virtual threshold should recognize Observatory-like topology');
  assert.deepStrictEqual(tokenTexts(observatory), ['Gale', 'Observatory']);
  assert.strictEqual(observatory.instance.name, 'Gale Observatory');
  assert.strictEqual(observatory.instance.templateId, 'pack.situation');

  // Named outcomes are content vocabulary, never kernel/runtime branches.
  const kernelRuntime = `${sourceTree(path.join(__dirname, '..', 'src', 'kernel'))}\n${sourceTree(path.join(__dirname, '..', 'src', 'runtime'))}`;
  for (const forbidden of ['Mantis', 'Lantern', 'Observatory']) {
    assert.ok(!kernelRuntime.includes(forbidden), `${forbidden} leaked into kernel/runtime behavior`);
  }

  // Tokens are inert data. They identify vocabulary; thresholds live in Token Packs.
  assert.strictEqual(TOKENS.mantis.kind, 'Token');
  assert.strictEqual(TOKENS.mantis.text, 'Mantis');
  assert.ok(!Object.values(TOKENS.mantis).some((value) => typeof value === 'function'));

  console.log(JSON.stringify({
    pass: true,
    invariant: 'named outcomes are Tokens, not Cards/Packs',
    genericGenerators: ['card.persona', 'card.item', 'pack.situation'],
    outcomes: [dragon.instance.name, mantis.instance.name, lantern.instance.name, observatory.instance.name],
    virtualThresholds: [dragon.virtualNaming.name, observatory.virtualNaming.name],
    kernelRuntimeNamedOutcomeLeaks: 0,
  }, null, 2));
}

main();
