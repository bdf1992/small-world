# small-world

A bounded generative-world architecture lab for Catalyst Core.

Small World preserves the playable/debuggable recursive field system proven in M0.5 while moving its mechanics behind cleaner generative and application boundaries.

Current stacked work:

- **M0.6 parity restoration** — preserve the accepted M0.5 whole-product surface.
- **M0.7-A typed tuple graph + recompiling authoring** — prove Card → Pack → Graph → Resolution → World as projections of one underlying truth.

> The merged `0.6.0` mainline is an architecture baseline, not yet a proven whole-product successor to M0.5. `m0.6/parity-restoration` repairs that acceptance error. M0.7 work is deliberately stacked on that branch and must not bypass its owner gate.

## Workbenches

Node 20+ is required. No external frontend dependencies are used.

```bash
npm test
npm run workbench
```

The default root is the restored whole-shape world workstation. `/authoring` is the M0.7 Authoring & Resolution surface.

### Whole-shape world

The world workbench preserves the M0.5 interaction shape through a stateful application session:

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

### M0.7 Authoring & Resolution

The first M0.7 slice adds a typed tuple-graph substrate and a recompiling authoring session.

```text
Card → Pack → Graph → Resolution → World
```

Current proof content is deliberately small: Dragon + Spire + Mountains.

- **Card** projects the existing Dragon Template as a rooted authored tree.
- **Pack** projects the existing Spire Template as a rooted compositional tree.
- **Graph** exposes their shared typed tuple truth plus Mountains context.
- **Resolution** projects the real bounded resolver/lifecycle traversal.
- **World** is the actual application world rebuilt from the current draft Templates.

Current editable authoring handles:

- Dragon rarity, age, and temperament weights;
- Dragon contextual element affinity (`weak | medium | strong`);
- Spire guardian and treasure candidate weights.

An edit does not merely redraw the browser:

```text
Card / Pack draft
      ↓
immutable draft Template
      ↓
existing horizontal-world compiler
      ↓
existing bounded DAG
      ↓
Reference → Virtual → Instance
      ↓
World projection
```

For seed `93208`, changing Spire guardian support from Dragon to Bandit changes the realized Mountains / Spire guardian through this exact path. Resetting the draft restores canonical behavior.

See [`docs/M0.7-A-TUPLE-GRAPH.md`](docs/M0.7-A-TUPLE-GRAPH.md).

## Tuple-graph quality lines

> **Graph is truth; tree is viewpoint.**

> **Plain handles remain plain even when their substrate is generic.**

The structural primitive is a typed tuple:

```text
(subject, predicate, object)
```

Cards, Packs, Regions, Requirements, Rules, Signals, Influences, lifecycle state, and realized world relationships may all project over this substrate without erasing their distinct user-facing meanings.

Terminology is intentional:

- **Requirement** is generic; there is no `ContextRequirement` primitive.
- **Signal** is an addressable typed carrier of information/pressure.
- **Influence** is a separate derived contribution/effect relationship.
- **Solve Trace** means DAG execution evidence. M0.6's old `signals` name remains only as a temporary compatibility alias.

## Separation-of-concerns rule

Browser code does not own world or resolution rules.

```text
transitional M0.5 mechanics        M0.6/M0.7 generative mechanics
            │                                 │
            └─────────────┬───────────────────┘
                          ▼
                  application ports
              simulation · world · authoring
                          │
                 projections + actions
                          │
                  browser / tests / CLI
```

During parity restoration the frozen M0.5 mechanics remain allowed behind the application seam because they are executable product canon. They can be replaced subsystem-by-subsystem without forcing interfaces to regain custody of simulation behavior.

`/api/world` remains the stateless bounded-generative projection. `/api/simulation` is the stateful whole-shape world session. `/api/authoring` is the stateful M0.7 draft/compile/resolve session.

## Acceptance gates

A class, file, or isolated unit test existing in the repository is not product capability.

M0.6 parity:

```bash
npm run verify:parity
```

M0.7 tuple graph + recompiling authoring:

```bash
npm run verify:graph
```

The M0.7 gate checks generic Requirements, typed Signal vs Influence semantics, Card/Pack graph projection, actual lifecycle resolution, direct editor mutations, contextual affinity, invalid candidate support, browser JavaScript syntax, and live HTTP edit → recompile → World behavior.

## Generative model

The lifecycle remains:

```text
Definition → Template → Reference → Virtual → Instance
```

Plain authoring vocabulary remains useful:

```text
Card · Pack · Section · Slot · Region
Requirement · Rule · Signal · Influence
Attribute · Property · Stat
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

## Read first

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — dependency boundaries and governing invariants.
- [`docs/MODEL.md`](docs/MODEL.md) — generative modeling contract and examples.
- [`docs/M0.6-I-PARITY-RESTORATION.md`](docs/M0.6-I-PARITY-RESTORATION.md) — whole-product parity gate.
- [`docs/M0.7-A-TUPLE-GRAPH.md`](docs/M0.7-A-TUPLE-GRAPH.md) — typed graph and authoring alpha contract.
- [`reference/m0.5-vertical-slice/MANIFEST.md`](reference/m0.5-vertical-slice/MANIFEST.md) — preserved M0.5 evidence baseline.

## Concern boundaries

```text
src/kernel/   generic solver plus frozen/transitional M0.5 mechanics
src/model/    lifecycle + typed tuple graph primitives
src/runtime/  world construction and deterministic step/commit
src/content/  authored cards, packs, instruments, and rules
src/inspect/  facts, possibilities, lineage, and Solve Trace evidence
src/app/      interface-neutral simulation, world, and authoring ports
web/          browser projection, editing gestures, and layout only
tests/        behavioral, parity, graph, edit, replay, and HTTP checks
scripts/      CLI and local workbench adapters
```

## Governing rules

> The kernel may become more sophisticated only when the handles above it remain at least as simple.

> A successor milestone may add capability, reorganize custody, or improve explanation; it may not silently erase a capability that the prior accepted vertical slice already made usable.

> An authoring mutation is not real until it recompiles through the same resolver that produces the World.
