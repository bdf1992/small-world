# Generative Model Contract

## Why this model exists

The design system needs stable ground for authored content while the runtime remains generative.

The model deliberately separates **possibility** from **fact**.

```text
Definition → Template → Reference → Virtual → Instance
```

Everything before Instance describes what may become true. Instance is the realization boundary where exact runtime facts become settled.

## Core terms

### Artifact

An identity-bearing runtime object. Persona, Biome, Item, Event, and other gameplay identities may all be Artifacts when realized.

### Card

Object grammar and lifecycle centered on realizing one Artifact identity. Cards organize their internal generative structure into Sections.

### Pack

Composition grammar centered on realizing a graph/collection of Artifact identities and relationships. Packs organize their generative structure into Slots.

A Card can expose Pack-like structure and a Pack can be small enough to look Card-like. The distinction is primarily an authoring handle, not a separate solver.

### Section

An internal addressable portion of one generative object, such as Identity, Attributes, Properties, Stats, Hourglass, Inventory, or Tendencies.

### Slot

An addressable opening where another Reference or Virtual may participate, such as Guardian, Treasure, Persona, Item, Event, Clock Hand, or Hourglass Lock.

### Region

A bounded part of spatial, temporal, resource, or semantic state that can participate in constraints or relationships. Examples include a biome area, an hourglass bulb, its neck, or an hour on a clock face.

### Attribute

A basis/dimension of typed interaction. Catalyst's elemental dimensions are Attributes.

An Attribute is not an exact stat and does not have to be fully settled before Virtual resolution.

### Property

A semantic rule or fact about a generative/runtime object that changes eligibility, derivation, relationships, or behavior.

Examples: `Species = Dragon`, `Species = Bear`, `Terrain = Swamp`, `Ancient`, `Wounded`, `NeckLocked`.

### Stat

A measurable operational value derived from the object's settled and unsettled relationships. Templates and Virtuals may describe stat ranges/functions/distributions; exact runtime Stat values belong to Instances.

## Example: Dragon

`Dragon` is a Persona Card Template, not a fully realized elemental creature.

```text
Dragon Template

fixed/semantic:
  grammar = Persona
  species = Dragon

possible/derived:
  elemental association
  rarity
  age/property combinations
  origin
  exact stats
  hourglass realization
  inventory/hoard realization
```

A Mountain/Spire Reference may strongly constrain the Dragon Virtual without settling exact values.

Only realization may produce facts such as:

```text
Dragon #D184
  Fire = 14
  Earth = 7
  Rarity = T4
  Property = Ancient
  Constitution = 35
```

## Example: Cave

`Cave` is a Pack Template describing a possible composition.

```text
Cave Template

Sections:
  topology
  placement
  relationships

Slots:
  Persona 0..N
  Item 0..N
  Event 0..N
```

A Cave Reference inside a Swamp does not mean "Swamp Bear" or "Swamp Staff" has already been authored. It gives the solver a boundary in which those possibilities may become supported.

The Pack Virtual is a virtual collection. Realization produces a Situation containing Artifact Instances and settled relationships.

## Biomes

Biomes use the same Artifact lifecycle.

Initial content templates for M0.6:

- Swamp
- Desert
- Mountains

A Biome Instance is also a prior/context source for future References and Virtuals. For example, the current state of a Mountain may affect which Spire, Dragon, Item, or Event possibilities remain supported.

## Instruments

Clock and Hourglass use the same definition system because their components are expected to become mechanically configurable.

### Clock

Potential generative structure includes:

- Face section/slot
- Hand slots
- Hour regions/slots
- Tick regions
- current position/cycle stats
- orientation/rule properties

### Hourglass

Potential structure includes:

- Upper region
- Neck region
- Lower region
- Timeless/outside region
- lock/filter slots
- capacity/crossing/integrity stats

These are not requirements to turn every component into an independent Artifact. A component should gain independent identity only when it requires independent addressability, mutation, reuse, inspection, reference, or collapse.

## Situation / POI

A Situation is the realized graph produced by a Pack Virtual.

A POI is the world-map address/presentation of a spatial Situation.

```text
Pack Template
    ↓
Pack Reference
    ↓
Pack Virtual
    ↓ realize
Situation Instance
    ↓ spatial address
POI presentation
```

## Unresolved state is valid

A Virtual can remain unresolved below the current solve boundary.

For example:

```text
Spire
  → Dragon
      → Hoard
          → Shield Virtual
```

If the solve reaches its hop budget at `Shield`, the Shield remains Virtual. This is a valid bounded world, not an error.

## Mutation rule

Each layer has a different kind of change:

| Layer | Change means |
| --- | --- |
| Definition | Change legal game language/contracts |
| Template | Change authored possibility/priors |
| Reference | Change contextual boundary/constraints |
| Virtual | Recompute context-valid possibility |
| Instance | Change committed world state |

Runtime mutation must not silently rewrite upstream Templates or Definitions.

## Target M0.6 content

### Persona Cards
- Bandit
- Bear
- Dragon

### Biome Cards
- Swamp
- Desert
- Mountains

### Item Cards
- Sword
- Staff
- Shield

### Pack Templates
- Cave
- Ruin
- Spire

### Instruments
- Clock
- Hourglass

The small content set is intentional: architecture defects should remain visible instead of being hidden by content volume.
