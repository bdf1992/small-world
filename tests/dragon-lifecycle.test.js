'use strict';

const assert = require('assert');
const {
  personaDefinition,
  dragonTemplate,
  referenceDragon,
  virtualizeDragon,
  realizeDragon,
} = require('../src/content/personas/dragon');

assert.strictEqual(personaDefinition.stage, 'definition');
assert.strictEqual(personaDefinition.grammar, 'Artifact/Persona');
assert.ok(personaDefinition.dimensions.element);
assert.ok(!Object.prototype.hasOwnProperty.call(personaDefinition.dimensions.element, 'value'));

assert.strictEqual(dragonTemplate.stage, 'template');
assert.strictEqual(dragonTemplate.fixed.species, 'Dragon');
assert.ok(dragonTemplate.priors.element);
assert.ok(!dragonTemplate.fixed.element);
assert.ok(!dragonTemplate.fixed.rarity);
assert.ok(!dragonTemplate.stats);

const mountains = referenceDragon({
  id: 'spire.guardian.dragon',
  boundary: { pack: 'Spire', slot: 'guardian' },
  context: {
    region: {
      id: 'Mountains',
      attributes: { Ground: 0.55, Fire: 0.25, Sky: 0.15, Aether: 0.05 },
    },
  },
});

assert.strictEqual(mountains.stage, 'reference');
assert.strictEqual(mountains.templateId, 'persona.dragon');
assert.ok(!mountains.element);
assert.ok(!mountains.rarity);
assert.ok(!mountains.stats);

const virtual = virtualizeDragon(mountains);
assert.strictEqual(virtual.stage, 'virtual');
assert.strictEqual(virtual.fixed.species, 'Dragon');
assert.ok(virtual.possibilities.element.Ground > virtual.possibilities.element.Fire);
assert.ok(virtual.possibilities.element.Fire > virtual.possibilities.element.Water);
assert.deepStrictEqual(virtual.ranges.constitution, [30, 49]);
assert.ok(!virtual.stats);
assert.ok(!virtual.attributes);
assert.ok(!virtual.rarity);

const instance = realizeDragon(virtual, 93208);
const replay = realizeDragon(virtual, 93208);
assert.deepStrictEqual(instance, replay);
assert.strictEqual(instance.stage, 'instance');
assert.strictEqual(instance.properties.species, 'Dragon');
assert.ok(typeof instance.attributes.element === 'string');
assert.ok(/^T[3-5]$/.test(instance.rarity));
assert.ok(Number.isFinite(instance.stats.constitution));
assert.ok(Number.isFinite(instance.stats.elementalOutput));
assert.ok(Number.isFinite(instance.stats.movement));
assert.deepStrictEqual(
  instance.lineage.map((step) => step.stage),
  ['definition', 'template', 'reference', 'virtual'],
);

const swamp = referenceDragon({
  id: 'cave.guardian.dragon',
  boundary: { pack: 'Cave', slot: 'guardian' },
  context: {
    region: {
      id: 'Swamp',
      attributes: { Water: 0.55, Ground: 0.25, Chaos: 0.15, Void: 0.05 },
    },
  },
});
const swampVirtual = virtualizeDragon(swamp);
assert.ok(swampVirtual.possibilities.element.Water > virtual.possibilities.element.Water);
assert.ok(swampVirtual.possibilities.element.Ground < virtual.possibilities.element.Ground);

console.log(JSON.stringify({
  pass: true,
  stages: ['definition', 'template', 'reference', 'virtual', 'instance'],
  mountainElementField: virtual.possibilities.element,
  instance,
}, null, 2));
