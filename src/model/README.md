# Model

The model owns the plain generative language compiled for the kernel.

Initial contract:

```text
Definition → Template → Reference → Virtual → Instance
```

Shared structural handles:

```text
Card · Pack · Section · Slot · Region
Attribute · Property · Stat · Rule
```

Implementation should prefer small immutable/plain-data structures until behavior proves that richer abstractions are necessary.

Fully settled runtime Stats belong to Instances. Templates and Virtuals describe priors, ranges, candidates, formulas, affinities, dependencies, and unresolved possibilities.
