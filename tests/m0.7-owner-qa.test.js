'use strict';

const assert = require('assert');
const { createWorkbenchServer } = require('../scripts/workbench');

async function json(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  assert.strictEqual(response.status, 200, `${url} returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}
async function text(url) {
  const response = await fetch(url);
  const body = await response.text();
  assert.strictEqual(response.status, 200, `${url} returned ${response.status}`);
  return body;
}
function authoredTrace(projection, cardId) {
  return Object.values(projection.landing?.byObject ?? {}).find((trace) => trace.card?.id === cardId && trace.card?.authored === true) ?? null;
}

async function main() {
  const server = createWorkbenchServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;

    // 1. Whole-shape world floor remains alive.
    let simulation = await json(`${base}/api/simulation`);
    assert.strictEqual(simulation.active.fields.length, 3);
    assert.strictEqual(simulation.active.fields.flatMap((field) => field.cells).length, 72);
    assert.strictEqual(simulation.generative.map.regions.length, 3);

    simulation = await json(`${base}/api/simulation/finish`, { method: 'POST' });
    assert.strictEqual(simulation.active.finished, true);
    const first = simulation.active.fields[0].cells[0];
    simulation = await json(`${base}/api/simulation/select?zone=${first.zone}&id=${first.id}`, { method: 'POST' });
    assert.strictEqual(simulation.selected.cell.id, first.id);
    assert.strictEqual(simulation.selected.spawnCandidates.length, 4);

    const side = simulation.clock.side;
    simulation = await json(`${base}/api/simulation/flip-clock`, { method: 'POST' });
    assert.notStrictEqual(simulation.clock.side, side);
    const tick = simulation.clock.tick;
    simulation = await json(`${base}/api/simulation/advance`, { method: 'POST' });
    assert.strictEqual(simulation.clock.tick, tick + 1);
    assert.ok(simulation.selected.cell.biomeTime);

    simulation = await json(`${base}/api/simulation/dive`, { method: 'POST' });
    assert.strictEqual(simulation.active.depth, 1);
    simulation = await json(`${base}/api/simulation/back`, { method: 'POST' });
    assert.strictEqual(simulation.active.depth, 0);

    // 2. One authored Card crosses the complete A-F path into the World.
    let authoring = await json(`${base}/api/authoring`);
    assert.strictEqual(authoring.projectionVersion, 6);
    assert.strictEqual(authoring.revision, 0);
    assert.strictEqual(authoring.resolutionRevision, 0);

    authoring = await json(`${base}/api/authoring/clone-card?card=persona.dragon&id=persona.ice-dragon`);
    authoring = await json(`${base}/api/authoring/set-card-fixed?card=persona.ice-dragon&field=species&value=Ice%20Dragon`);
    authoring = await json(`${base}/api/authoring/connect-card?slot=guardian&card=persona.ice-dragon&weight=1`);
    authoring = await json(`${base}/api/authoring/focus-pack-candidate?slot=guardian&card=persona.ice-dragon`);

    let trace = authoredTrace(authoring, 'persona.ice-dragon');
    assert.ok(trace, 'authored Ice Dragon must land in the resolved world');
    assert.strictEqual(trace.pack?.id, 'pack.spire');
    assert.strictEqual(trace.pack?.slot?.role, 'guardian');
    assert.strictEqual(trace.pack?.requirement?.accepts, 'Artifact/Persona');
    assert.strictEqual(trace.region?.id, 'mountains');
    assert.strictEqual(trace.lifecycle?.at(-1)?.stage, 'instance');

    // 3. Bounded resolution can stop before landing without corrupting authored truth.
    const authoredRevision = authoring.revision;
    authoring = await json(`${base}/api/authoring/set-budget?hops=4&slots=6&instances=0`);
    assert.strictEqual(authoring.revision, authoredRevision);
    assert.strictEqual(authoring.landing.traceable.length, 0);
    assert.strictEqual(Object.keys(authoring.landing.byObject).length, 0);
    assert.ok(authoring.resolution.stops.some((stop) => stop.reason === 'budget.maxInstances'));

    authoring = await json(`${base}/api/authoring/reset-budget`);
    assert.strictEqual(authoring.revision, authoredRevision);
    trace = authoredTrace(authoring, 'persona.ice-dragon');
    assert.ok(trace, 'full budget must restore the authored landing trace');

    // 4. Plain-data custody reconstructs authored truth and therefore the same landing source.
    const documentResponse = await fetch(`${base}/api/authoring/document`);
    assert.strictEqual(documentResponse.status, 200);
    const document = await documentResponse.json();
    await json(`${base}/api/authoring/reset?seed=93208`);
    assert.strictEqual(authoredTrace(await json(`${base}/api/authoring`), 'persona.ice-dragon'), null);

    const importResponse = await fetch(`${base}/api/authoring/document`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(document),
    });
    assert.strictEqual(importResponse.status, 200);
    authoring = await importResponse.json();
    trace = authoredTrace(authoring, 'persona.ice-dragon');
    assert.ok(trace, 'Authoring Document import must restore authored world landing');

    // 5. G is presentation-only: assets load without changing either revision plane.
    const beforeVisual = { revision: authoring.revision, resolutionRevision: authoring.resolutionRevision };
    const worldHtml = await text(`${base}/`);
    const authoringHtml = await text(`${base}/authoring`);
    const visualCss = await text(`${base}/world-language.css`);
    const visualJs = await text(`${base}/world-language.js`);
    assert.match(worldHtml, /data-sw-domain="instrument"/);
    assert.match(authoringHtml, /data-sw-domain="authoring"/);
    assert.match(visualCss, /data-sw-domain="resolution"/);
    assert.doesNotMatch(visualJs, /\bfetch\s*\(/);

    authoring = await json(`${base}/api/authoring`);
    assert.deepStrictEqual(
      { revision: authoring.revision, resolutionRevision: authoring.resolutionRevision },
      beforeVisual,
      'visual-language requests must not mutate authored or resolution state',
    );

    console.log(JSON.stringify({
      pass: true,
      worldFloor: { fields: 3, cells: 72, depthRoundTrip: true, temporalTick: true },
      authoredLanding: {
        card: trace.card.id,
        pack: trace.pack.id,
        slot: trace.pack.slot.role,
        region: trace.region.id,
      },
      budgetStop: 'budget.maxInstances',
      documentRoundTrip: true,
      visualLanguageNonAuthority: true,
      ownerAcceptance: 'pending human review',
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
