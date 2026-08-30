# Architecture

## Purpose

`small-world` is an executable architecture lab for a bounded generative world model.

The kernel may be mathematically sophisticated. The handles exposed to content authors should remain plain.

The governing separation is:

```text
CONTENT / AUTHORING
Definitions · Templates · References
        │
        ▼
MODEL
Cards · Packs · Sections · Slots
Attributes · Properties · Stats
Virtuals · Instances
        │
        ▼
SOLVER
Typed DAG · Signals · Constraints
Budgets · Propagation · Collapse
        │
        ▼
RUNTIME
World state · Clock · Hourglasses
Artifacts · Situations · Step/commit
        │
        ▼
INSPECTION
Facts · Possibilities · Lineage · Signals · Replay
        │
        ▼
PRESENTATION
Map · Cards · Inspectors · Clock UI
```

## Dependency rule

Presentation may depend on inspection/runtime. Runtime may depend on model and kernel. Content may describe model objects. The solver must not depend on content names.

The solver must never contain special cases for `Dragon`, `Bear`, `Sword`, `Cave`, or any other authored content.

Adding a new content template such as `Wolf`, `Forest`, `Axe`, or `Temple` should not require solver changes.

## One lifecycle

All generative content follows one lifecycle:

```text
Definition
    ↓
Template
    ↓
Reference
    ↓
Virtual
    ↓ realize
Instance
```

### Definition

Defines legal dimensions, contracts, schemas, relationships, and operators. A Definition does not choose realized elemental, rarity, property, or stat values.

### Template

An authored base of possibility. A Template may fix semantic structure and declare priors, ranges, affinities, inheritance rules, allowed relationships, and unresolved values.

### Reference

Places a Template inside a boundary: a slot, region, parent, location, situation, clock state, or other context. A Reference narrows possibility but is not a runtime entity.

### Virtual

A context-valid realizable possibility field. A Virtual can contain candidates, ranges, weights, unresolved slots, and derived possibilities. It may remain partially unresolved when a solve budget is exhausted.

### Instance

A committed runtime fact with identity. Only Instances may contain fully settled runtime stats such as exact damage, exact rarity, exact elemental quantities, or exact position.

## Shared generative shape

Cards and Packs are authoring projections over one underlying generative structure.

- A **Card** is centered on one Artifact identity and organizes internal possibility into **Sections**.
- A **Pack** is centered on a composition and organizes external possibility into **Slots**.
- Sections and Slots may recursively expose more generative structure.
- Split a structure into an independently generative node only when it needs independent reference, reuse, collapse, inspection, mutation, or identity.

The internal skeleton may therefore be modeled as a generic node containing:

```text
GenerativeNode
├── dimensions
├── sections
├── slots
├── attributes
├── properties
├── stats
├── relationships
├── references
├── constraints
├── rules
└── children
```

This is a modeling contract, not a requirement to implement a large object-oriented class hierarchy.

## Bounded solving

Every solve receives an explicit budget:

```text
SolveBudget
├── maxHops
├── maxSlots
└── maxInstances
```

- `maxHops` bounds dependency traversal from the root Reference.
- `maxSlots` bounds compositional branching activated by the solve.
- `maxInstances` bounds committed runtime materialization.

Budget exhaustion is normal. It leaves the remaining structure Virtual; it does not force collapse and does not invalidate the world.

## DAG over a cyclic world

The persistent world may contain feedback, but an individual solve step must be acyclic and replayable:

```text
World(t)
  ↓ compile References
Solve DAG
  ↓
Virtual state
  ↓ selected collapse
Commit
  ↓
World(t+1)
```

Feedback enters the next step as new priors. Cyclic simulation behavior is therefore expressed through repeated deterministic DAG steps rather than uncontrolled in-place recursion.

## Signals are internal

The kernel may use signals, diffusion, masks, joins, transforms, weighting, constraint propagation, fixed-point passes, or spectral representations internally.

Content authors should normally work with:

```text
Definition · Template · Reference · Virtual · Instance
Card · Pack · Section · Slot
Attribute · Property · Stat · Rule
```

The inspection layer may expose kernel signals when needed to answer "why did this realize?" without making signal terminology mandatory for content creation.

## Instruments use the same model

Clock and Hourglass are not exempt from the generative model.

They may expose sections, slots, regions, properties, and stats through the same Definition → Template → Reference → Virtual → Instance lifecycle. This preserves future options such as special clock faces, hands, hours, hourglass shapes, neck locks, filters, or other player-configurable instruments without creating parallel engines.

## Situation and POI

A **Situation** is the realized composition produced by a Pack Virtual. A **POI** is the spatially addressable presentation of a Situation on the world map.

The solver resolves Slots and References; it does not implement a separate `spawnPOI()` semantic.

## Architectural invariant

The kernel is allowed to become more complex only when the handles above it remain at least as simple.
