# small-world

A bounded generative-world architecture lab for Catalyst Core.

The claim this repository exists to test: someone authoring plain content
should be able to produce a world that runs the same way every time, and to
inspect the range of what was possible before it settled, without ever meeting
the solver that does the work.

Current milestone: **M0.6 — Bounded Generative World**.

## Try M0.6

Node 20+ is required. The owner-facing tools intentionally have no external dependencies.

```bash
npm test
npm run world
npm run workbench
```

`npm run workbench` opens the M0.6 browser workbench at `http://127.0.0.1:4173`. The browser is a thin adapter over `src/app/world.js`; it does not own world rules or solver behavior.

The default world uses seed `93208` and the full M0.6 budget:

```text
maxHops      = 4
maxSlots     = 6
maxInstances = 9
```

Change the resolution budget directly:

```bash
npm run world -- --seed 93208 --hops 4 --slots 6 --instances 0
npm run world -- --seed 93208 --hops 4 --slots 3 --instances 9
npm run world -- --seed 93208 --hops 2 --slots 6 --instances 9
```

The CLI prints Region topology and elemental fields, realized Situations when the solve completes, resolved Virtuals when it does not, and explicit budget/frontier stops. Reduced budgets are valid QA cases; an unresolved result is not automatically a failure.

The browser uses the same application projection but presents it as a lightweight diegetic world map. Region, Situation, Artifact, and Virtual selections all open through the same object inspector with progressively disclosed Surface, Possibility, and Lineage views.

### Interface rule

The world engine does not know about HTML, map layout, panels, or browser events.

```text
kernel + model + runtime + content + inspection
                    ↓
              src/app/world.js
                    ↓
          serializable projection
             ↙             ↘
      scripts/world.js     web workbench
```

The application projection is the port. CLI and browser are sibling adapters. Future canvas, game, replay, agent, or debugging interfaces should consume the same boundary rather than reaching into solver internals.

### Owner QA questions

When exercising M0.6, ask:

- Does the same seed and budget replay exactly?
- Does a smaller budget leave understandable unresolved possibility rather than nonsense?
- Can you tell what contextual field influenced a Region or Virtual?
- Do Definition, Template, Reference, Virtual, and Instance feel like useful plain handles?
- Can you explain why realization stopped?
- Does changing the seed vary the world without changing the architecture contract?
- Does every game object feel like part of one interface rather than a bespoke screen?
- Can the map stay diegetic while deeper generative machinery remains progressively inspectable?

M0.6 is not owner-accepted merely because CI passes. The release candidate is intended to make those questions directly inspectable before landing on `main`.

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
src/app/      interface-neutral application projections and requests
web/          diegetic browser adapter; presentation only
tests/        model, budget, replay, architecture, interface, reference, and owner-QA checks
scripts/      CLI and local workbench adapters over the application boundary
```

## Governing rule

> The kernel may become more sophisticated only when the handles above it remain at least as simple.

A strong M0.6 result is not a large framework. It is a tiny world whose complete generative path can be inspected, replayed, and understood.
