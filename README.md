# small-world

A bounded generative-world architecture lab for Catalyst Core.

Small World is intended to preserve the playable/debuggable recursive field system proven in M0.5 while moving its mechanics behind a cleaner generative model and application boundary.

Current work: **M0.6 parity restoration**.

> The merged `0.6.0` mainline is an architecture baseline, not yet a proven whole-product successor to M0.5. A post-merge owner review found that the new lifecycle/DAG/Region/Pack work had been certified individually while most of the composed spatial + temporal workstation had disappeared from the product surface. `m0.6/parity-restoration` corrects that acceptance error.

## Try the parity workbench

Node 20+ is required. No external frontend dependencies are used.

```bash
npm test
npm run workbench
```

Open `http://127.0.0.1:4173`.

The default workbench now restores the whole M0.5 interaction shape through a stateful application session:

- independent Center / Barrier / Edge field graphs;
- live spatial cells, nuclei, frontiers, collisions, and collapse waves;
- Play / Pause, Step Wave, Resolve All, and deterministic replay;
- element, entropy, root, static-pressure, and time-pressure projections;
- deterministic child previews plus Dive / Back recursive navigation;
- 12-position / 60-tick Clock with Day/CW ↔ Night/CCW transformation;
- Cross Tick temporal resolution;
- selected-cell field and graph-state inspection;
- cyclic spawn proposition scoring;
- biome and spawned Persona/Event hourglasses;
- typed elemental-time supply, transfer, threshold, blocked demand, and pressure;
- player Hourglass spend / flip;
- spawn / transfer / resolution ledger;
- M0.6 Region / Pack / Situation / Artifact generative overlay;
- one Surface / Possibility / Lineage inspector grammar across spatial, instrument, temporal, and generative objects.

### Separation-of-concerns rule

The restored browser does **not** contain the M0.5 simulation kernel.

```text
transitional M0.5 mechanics        M0.6 generative mechanics
            │                                │
            └────────────┬───────────────────┘
                         ▼
               src/app/simulation.js
                + src/app/world.js
                         │
                 JSON projections/actions
                         │
                         ▼
                 browser / tests / CLI
```

During parity restoration the frozen M0.5 mechanics are allowed behind the application seam because they are executable product canon. They can be replaced subsystem-by-subsystem with M0.6-native implementations without forcing the browser or external callers to regain custody of world rules.

`/api/world` remains the stateless M0.6 bounded generative projection. `/api/simulation` is the stateful composed world session. They are deliberately separate ports while the two systems are integrated.

## Whole-shape parity gate

M0.6 is not considered a successful successor merely because these exist independently:

```text
Dragon works
DAG works
Region works
Pack works
Clock works
Hourglass works
Inspection works
```

The acceptance target is their composed world behavior.

The executable gate is:

```bash
npm run verify:parity
```

It checks the live application/session contract and the HTTP workbench, including spatial graphs, recursion, clock transforms, temporal transfer, spawned entities, pressure, hourglasses, deterministic replay, M0.6 generative overlay, and browser JavaScript syntax.

See [`docs/M0.6-I-PARITY-RESTORATION.md`](docs/M0.6-I-PARITY-RESTORATION.md) for the full M0.5 → M0.6 capability matrix.

## M0.6 generative model

The new generative architecture remains part of the target rather than being rolled back:

```text
Definition → Template → Reference → Virtual → Instance

Card · Pack · Section · Slot · Region
Attribute · Property · Stat · Rule
```

Current authored content:

```text
Personas: Bandit · Bear · Dragon
Biomes:  Swamp · Desert · Mountains
Items:   Sword · Staff · Shield
Packs:   Cave · Ruin · Spire
Tools:   Clock · Hourglass
```

Bounded construction remains explicit:

```text
SolveBudget
├── maxHops
├── maxSlots
└── maxInstances
```

Reduced budgets leave unresolved Virtuals instead of forcing invalid collapse.

The existing CLI still exposes this construction directly:

```bash
npm run world
npm run world -- --seed 93208 --hops 4 --slots 6 --instances 0
```

## Read first

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — dependency boundaries and governing invariants.
- [`docs/MODEL.md`](docs/MODEL.md) — generative modeling contract and examples.
- [`docs/M0.6-I-PARITY-RESTORATION.md`](docs/M0.6-I-PARITY-RESTORATION.md) — current whole-product acceptance gate.
- [`docs/M0.6-BOUNDED-GENERATIVE-WORLD.md`](docs/M0.6-BOUNDED-GENERATIVE-WORLD.md) — original M0.6 architecture scope.
- [`reference/m0.5-vertical-slice/MANIFEST.md`](reference/m0.5-vertical-slice/MANIFEST.md) — preserved M0.5 evidence baseline.

## Concern boundaries

```text
src/kernel/   generic solver plus frozen/transitional M0.5 mechanics
src/model/    Definition/Template/Reference/Virtual/Instance model
src/runtime/  world construction and deterministic step/commit
src/content/  authored cards, packs, instruments, and rules
src/inspect/  facts, possibilities, lineage, and signal traces
src/app/      interface-neutral stateless and stateful application ports
web/          browser projection; presentation and gestures only
tests/        behavioral, parity, replay, architecture, and HTTP checks
scripts/      CLI and local workbench adapters
```

## Governing rules

> The kernel may become more sophisticated only when the handles above it remain at least as simple.

> A successor milestone may add capability, reorganize custody, or improve explanation; it may not silently erase a capability that the prior accepted vertical slice already made usable.
