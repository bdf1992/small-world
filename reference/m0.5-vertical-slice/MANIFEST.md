# M0.5 Vertical Slice — Reference Manifest

This directory records the immutable evidence baseline supplied from the Catalyst RFC vertical slice.

The M0.5 source is a behavior/reference baseline for `small-world`; it is **not** the target module architecture.

## Source archive

Conversation source: `catalyst-rfc-vertical-slice(3) (1).zip`

The archive demonstrated a self-contained browser prototype with deterministic seed-addressed RFC generation, clock/hourglass temporal behavior, temporal pressure diffusion, recursive child previews, spawn propositions, replay fingerprinting, and runtime/seed validation material.

## SHA-256 manifest

```text
d5b825d5a7ff5db732fe57069eb38a4ad1a209ebd35ea7e1e9e9e6de7a892e74  ENGINEERING-GOAL.md
0a65e1d045096b553369c6315e2fcfa886f2858a650f4aac44c804ff7032b0ca  LESSONS-M0.5.md
0edbd65cb4aa57581cde15f3be713abfe1b34dd111d06e4296ae145fea2ce7ca  M0.5-SEED-SWEEP.json
296c36127b695272e2a5e0dd409edc1566a5cc523fc785ba614221d2395c1a66  M0.5-VALIDATION.md
c828fe4d34f956b377f6b73ec828622da0732b744685eedd3a217c12d51d6daa  index.html
94aa4e69c935dc790ddfbeadf0aa79f59bc8dea67c0a9b04c3d7262ca97e3a87  sample-ledger-93208.json
f1346bc2e1bc04b04f6c32ba682d418ff2163044fc6cd3abf1c556afd05f8ef6  test-runtime.js
```

## M0.5 causal spine to preserve

```text
Clock tick
  → elemental-time supply
  → hourglass transfer
  → threshold / unmet demand
  → pressure
  → biome field
  → RFC / spawn / recursion
```

## M0.5 invariants relevant to M0.6

- Same seed + same ordered actions reproduces field, temporal state, and ledger.
- Day reads the elemental ring clockwise; Night reads the same ring counterclockwise.
- Flipping Day/Night changes relationship evaluation without advancing a tick.
- Biome, Persona, and Event temporal subjects use deterministic hourglasses.
- Unmet/blocked demand becomes local typed pressure rather than disappearing.
- Pressure diffuses only over the containing biome field graph.
- Every visible resolved cell may expose a deterministic unresolved child preview.
- A child may remain unresolved without allocating the full recursive world.
- Spawn addressing is deterministic from seed + clock + zone + cell + type.
- The existing prototype intentionally keeps Center / Barrier / Edge field graphs computationally separate.

## Import policy

When source files are copied into this repository:

1. place them under this reference directory;
2. verify SHA-256 against the source archive;
3. do not refactor files in place;
4. create new implementation modules outside `reference/`;
5. if intended behavior changes, record the change as an M0.6 rule/test rather than rewriting history.

## Why preserve instead of port directly

The vertical slice co-locates field/RFC logic, temporal policy, content semantics, presentation, and debug behavior in a compact prototype. M0.6 should preserve its evidence while extracting the reusable separation between kernel, model, runtime, content, inspection, and presentation.
