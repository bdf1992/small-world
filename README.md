# small-world

A bounded generative-world architecture lab for Catalyst Core.

This repository exists to prove that simple authored content can compile into inspectable Virtual possibility spaces and deterministically realize a small world without exposing solver complexity to ordinary content authors.

Initial milestone: **M0.6 — Bounded Generative World**.

## Working premise

The engine may use a sophisticated bounded DAG/signal solver internally, but content authors work with a small plain vocabulary:

```text
Definition → Template → Reference → Virtual → Instance

Card · Pack · Section · Slot · Region
Attribute · Property · Stat · Rule
```

Cards describe object possibility. Packs describe composition possibility. Both compile through shared generative machinery.

## M0.6 content surface

```text
Personas: Bandit · Bear · Dragon
Biomes:  Swamp · Desert · Mountains
Items:   Sword · Staff · Shield
Packs:   Cave · Ruin · Spire
Tools:   Clock · Hourglass
```

The deliberately small content set is used to prove that the architecture generates breadth without solver special cases.

## Bounded realization

Every solve is explicitly limited:

```text
SolveBudget
├── maxHops
├── maxSlots
└── maxInstances
```

Running out of budget leaves unresolved Virtuals. It does not force collapse or invalidate the world.

## Read first

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — dependency boundaries and governing invariants.
- [`docs/MODEL.md`](docs/MODEL.md) — generative modeling contract and examples.
- [`docs/M0.6-BOUNDED-GENERATIVE-WORLD.md`](docs/M0.6-BOUNDED-GENERATIVE-WORLD.md) — milestone scope, sequence, acceptance, and estimate.
- [`docs/GLOSSARY.md`](docs/GLOSSARY.md) — intentionally plain authoring vocabulary.
- [`reference/m0.5-vertical-slice/MANIFEST.md`](reference/m0.5-vertical-slice/MANIFEST.md) — evidence baseline from the prior Catalyst vertical slice.

## Concern boundaries

```text
src/kernel/   generic DAG/signal/constraint/budget machinery
src/model/    Definition/Template/Reference/Virtual/Instance model
src/runtime/  committed world state and deterministic step/commit
src/content/  authored cards, packs, instruments, and rules
src/inspect/  facts, possibilities, lineage, and signal traces
tests/        model, budget, replay, architecture, and reference checks
```

## Governing rule

> The kernel may become more sophisticated only when the handles above it remain at least as simple.

A strong M0.6 result is not a large framework. It is a tiny world whose complete generative path can be inspected, replayed, and understood.
