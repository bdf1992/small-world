# Kernel

The kernel owns generic bounded solving only.

Expected responsibilities:

- graph compilation/execution;
- signal representation and transforms;
- constraint propagation;
- deterministic addressed randomness;
- solve budgets (`maxHops`, `maxSlots`, `maxInstances`);
- collapse/realization primitives;
- convergence/step guards and trace events.

The kernel must not know authored content names or gameplay-specific classes such as Dragon, Bear, Cave, Persona, Item, or POI.

If content-specific vocabulary appears here, treat it as an architecture smell unless it is a generic model primitive explicitly promoted by contract.
