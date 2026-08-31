'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

async function main() {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const pageResponse = await fetch(`${base}/`);
    assert.strictEqual(pageResponse.status, 200);
    const page = await pageResponse.text();

    assert.match(page, /Artifact ↔ map context/);
    assert.match(page, /Virtual&lt;Artifact&gt; placement candidate/);
    assert.match(page, /this is not an Artifact instance/);
    assert.match(page, /Virtual&lt;Relation&gt;/);
    assert.match(page, /Admission/);
    assert.match(page, /realized Artifact/);
    assert.match(page, /This evidence does not place, move, traverse, cross, or mutate anything/);
    assert.match(page, /\/api\/simulation\/placement-evidence/);
    assert.doesNotMatch(page, /dynamicRelationWeight/);
    assert.doesNotMatch(page, /dynamicSignedScore/);

    const evidenceResponse = await fetch(`${base}/api/simulation/placement-evidence`);
    assert.strictEqual(evidenceResponse.status, 200);
    const evidence = await evidenceResponse.json();
    const candidate = evidence.artifactContext;
    assert.ok(candidate);
    assert.strictEqual(candidate.kind, 'Virtual<Artifact>.ContextCandidate');
    assert.strictEqual(candidate.realizedArtifact, null);
    assert.strictEqual(candidate.admission, null);
    assert.strictEqual(candidate.relation.kind, 'Virtual<Relation>');
    assert.strictEqual(candidate.relation.relationType, 'ElementalContext');
    assert.strictEqual(candidate.relation.lifecycle, 'candidate');
    assert.strictEqual(candidate.relation.authority, 'evidence-only');
    assert.strictEqual(candidate.relation.admission, null);
    assert.deepStrictEqual(candidate.relation.effects, []);

    console.log('M0.7 Artifact context progressive disclosure contract: PASS');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
