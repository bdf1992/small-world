# Runtime

The runtime owns committed world state and deterministic step/commit behavior.

Initial responsibilities:

- World(t) state;
- compile current References from world/context;
- invoke a bounded solve;
- commit selected Virtual collapses into Instances;
- advance to World(t+1);
- Clock and Hourglass runtime state;
- Artifact and Situation identity/state;
- deterministic replay inputs/outputs.

Persistent feedback belongs between committed steps. One solve should remain bounded and acyclic even when repeated steps produce cyclic world behavior.
