# Tests

M0.6 validation should prove architecture and determinism, not only example output.

Planned groups:

## Model
- no fully settled runtime stats before Instance;
- Template/Reference/Virtual lineage is retained;
- runtime mutation does not rewrite Definitions/Templates.

## Budgets
- `maxHops` stops traversal cleanly;
- `maxSlots` bounds branching;
- `maxInstances` bounds materialization;
- budget exhaustion leaves valid unresolved Virtuals.

## Replay
- same seed + prior state + ordered actions + budget = same result;
- replay fingerprints include committed state relevant to generation;
- changing budget deterministically changes degree of resolution.

## Architecture
- content fixtures can be added without solver changes;
- solver has no content-name special cases;
- world feedback crosses a step/commit boundary rather than creating an uncontrolled cyclic solve.

## Reference regression
M0.5 behavior/reference artifacts remain available and hash-verifiable while M0.6 is built outside the reference tree.
