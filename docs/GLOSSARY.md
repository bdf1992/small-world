# Glossary

This glossary is intentionally plain. Kernel implementation terms belong in kernel documentation; ordinary content work should use these handles.

## Definition
The contract for what a kind of generative thing is allowed to describe. Definitions declare dimensions and rules; they do not pick a final runtime result.

## Template
An authored base of possibility. Examples for M0.6 include Dragon, Bear, Swamp, Sword, Cave, and Spire.

## Reference
A use of a Template inside a particular boundary or context, such as a Dragon considered for a Spire guardian slot in the current Mountains.

## Virtual
A valid possible runtime result after current priors and constraints have been considered, but before exact realization. Virtuals may include ranges, candidates, weights, unresolved slots, and derived possibilities.

## Instance
A realized runtime fact with identity. Exact settled Stats belong here.

## Artifact
An identity-bearing runtime object. Personas, Biomes, Items, Events, and other independently addressable game objects may be Artifacts.

## Card
An authoring view centered on one Artifact identity. Cards organize internal possibility into Sections.

## Pack
An authoring view centered on a composition of Artifact possibilities and relationships. Packs organize composition into Slots.

## Section
An addressable internal part of a Card or generative node, such as Identity, Attributes, Properties, Stats, Hourglass, or Inventory.

## Slot
An addressable opening for another Reference/Virtual, such as Guardian, Treasure, Item, Event, Hand, or Lock.

## Region
A bounded part of space or state used by rules/relationships: a biome area, hourglass bulb, hourglass neck, clock hour, or similar boundary.

## Attribute
A typed basis/dimension of interaction. Catalyst's elemental dimensions are Attributes.

## Property
A semantic fact/rule that changes eligibility, derivation, relationships, or behavior, such as `Species = Dragon`, `Terrain = Swamp`, `Ancient`, or `Wounded`.

## Stat
A measurable operational value. Templates/Virtuals may describe how a Stat can resolve; exact runtime values are settled on Instances.

## Rule
A plain authored statement that constrains, derives, transforms, weights, gates, or relates model state. Rules compile to kernel behavior.

## Situation
A realized Pack composition: Artifact Instances plus their settled relationships.

## POI
The spatial address/presentation of a Situation on the world map.

## Instrument
A generative structure that reads, exposes, spends, transforms, or controls game state. Clock and Hourglass are initial Instruments.

## Budget
A solve boundary controlling how much of the possible world is resolved in one operation.

### Hop budget
How far resolution may follow dependencies/references from its root.

### Slot budget
How many compositional openings may be activated.

### Instance budget
How many runtime identities may be materialized.

## Collapse / Realize
The operation that selects/settles a Virtual into committed Instance facts.

## Signal
An internal solver representation of current possibility/influence. Signals are inspectable engineering details, not required authoring vocabulary.

## Solver
The generic engine that propagates constraints/signals over the bounded graph. It must not know content-specific names like Dragon or Cave.
