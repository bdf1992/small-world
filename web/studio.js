'use strict';

(() => {
  const state = { utility: 'explore', kind: 'persona', profile: 'wide', projection: null, inspect: 'candidate', busy: false };
  const stage = document.getElementById('stage');
  const title = document.getElementById('utilityTitle');
  const description = document.getElementById('utilityDescription');
  const seed = document.getElementById('seed');
  const regenerate = document.getElementById('regenerate');
  const generatorControls = document.getElementById('generatorControls');
  const profile = document.getElementById('profile');
  const profileHint = document.getElementById('profileHint');
  const status = document.getElementById('status');
  const utilities = [...document.querySelectorAll('[data-utility]')];
  const kinds = [...document.querySelectorAll('[data-kind]')];

  const copy = {
    explore: ['Explore', 'See context, composition, and outcomes as one small scene.'],
    generate: ['Generate', 'Shape possibility without naming the result in advance.'],
    compose: ['Compose', 'Bind typed roles and inspect what the composition actually produced.'],
    resolve: ['Resolve', 'Watch authored possibility cross into settled fact.'],
    name: ['Name', 'See which themed Token thresholds the outcome actually earned.'],
    inspect: ['Inspect', 'Open the machinery only when you need provenance or raw evidence.'],
  };

  function esc(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }
  function pct(value) { return `${Math.round(Number(value || 0) * 100)}%`; }
  function json(value) { return esc(JSON.stringify(value, null, 2)); }

  function tokens(assignments = []) {
    return assignments.map((entry) => `<span class="token ${esc(entry.token.role)}">${esc(entry.token.text)}<small>${esc(entry.packId?.split('.').slice(-1)[0] ?? '')}</small></span>`).join('');
  }

  function factGrid(rows = []) {
    return `<div class="fact-grid">${rows.map((row) => `<div class="fact"><span>${esc(row.name)}</span><b>${esc(row.value)}</b></div>`).join('')}</div>`;
  }

  function dimensionList(rows = []) {
    return `<div class="dimension-list">${rows.map((row) => {
      if (row.state === 'settled') return `<div class="dimension"><div class="dimension-head"><b>${esc(row.name)}</b><span>settled</span></div><div class="fact"><b>${esc(row.value)}</b></div></div>`;
      const candidates = (row.candidates ?? []).slice(0, 7);
      return `<div class="dimension"><div class="dimension-head"><b>${esc(row.name)}</b><span>possible</span></div><div class="candidate-bars">${candidates.map((candidate) => `<div class="candidate-bar"><span>${esc(candidate.value)}</span><span class="bar-track"><i class="bar-fill" style="width:${Math.max(2, Math.round(candidate.weight * 100))}%"></i></span><span class="pct">${pct(candidate.weight)}</span></div>`).join('')}</div></div>`;
    }).join('')}</div>`;
  }

  function hero(result, stageName = 'Instance') {
    return `<div class="hero-result"><span class="hero-stage">${esc(stageName)}</span><h2 class="hero-name">${esc(result.name)}</h2><div class="hero-id">${esc(result.id)}</div><div class="token-row">${tokens(result.assignments ?? [])}</div></div>`;
  }

  function renderExplore() {
    const composition = state.projection.composition;
    const context = { Ground: .50, Sky: .25, Fire: .15, Water: .10 };
    stage.innerHTML = `<div class="scene-board"><div class="scene-grid"></div><div class="context-orbit"></div><div class="scene-node center"><small>Situation</small><b>${esc(composition.name)}</b></div><div class="scene-node guardian"><small>Guardian · Persona</small><b>${esc(composition.slots[0].result.name)}</b></div><div class="scene-node treasure"><small>Treasure · Item</small><b>${esc(composition.slots[1].result.name)}</b></div><div class="scene-node context"><small>Region context</small><b>Mountains field</b><div class="context-field">${Object.entries(context).map(([name,value]) => `<span>${name} ${pct(value)}</span>`).join('')}</div></div><span class="relation r1">occupies →</span><span class="relation r2">← belongs</span></div>`;
  }

  function renderGenerate() {
    const candidate = state.projection.candidate;
    stage.innerHTML = `<div class="surface-grid"><section>${hero(candidate.instance)}<div class="panel" style="margin-top:14px"><div class="panel-header"><div><h3>Settled structure</h3><p>The Card generated facts; Tokens named the result afterward.</p></div></div><div class="panel-body">${factGrid(candidate.instance.rows)}<div class="token-row" style="margin-top:14px">${tokens(candidate.instance.assignments)}</div></div></div></section><section class="panel"><div class="panel-header"><div><h3>Possibility field</h3><p>${esc(candidate.profileLabel)} · ${esc(candidate.grammar)}</p></div></div><div class="panel-body">${dimensionList(candidate.virtual.rows)}</div></section></div>`;
  }

  function renderCompose() {
    const composition = state.projection.composition;
    stage.innerHTML = `<div class="surface-grid equal"><section class="panel"><div class="panel-header"><div><h2>Composition circuit</h2><p>Roles are typed Requirements. Results are generated artifacts, not named candidates.</p></div></div><div class="panel-body circuit"><div class="circuit-core"><small>Situation Pack result</small><b>${esc(composition.name)}</b></div><div class="slot-grid">${composition.slots.map((slot) => `<article class="slot-card"><small>${esc(slot.role)}</small><h3>${esc(slot.result.name)}</h3><span class="requirement">${esc(slot.requirement)}</span><div class="slot-result"><b>${esc(slot.result.grammar)}</b><div class="token-row">${tokens(slot.result.assignments)}</div></div></article>`).join('')}</div></div></section><section class="panel"><div class="panel-header"><div><h3>Relations that became true</h3><p>Composition settles relational structure as well as members.</p></div></div><div class="panel-body relation-list">${composition.relations.map((relation) => `<div class="relation-line">${esc(relation)}</div>`).join('')}</div></section></div>`;
  }

  function renderResolve() {
    const candidate = state.projection.candidate;
    stage.innerHTML = `<section class="panel"><div class="panel-header"><div><h2>Resolution path</h2><p>Same generated object, progressively stronger commitments.</p></div></div><div class="panel-body"><div class="lifecycle">${candidate.lifecycle.map((step, index) => `<div class="life-step ${esc(step.state)}"><span class="life-dot">${index + 1}</span><b>${esc(step.stage)}</b><small>${esc(step.name ?? step.id)}</small></div>`).join('')}</div><div class="compare-columns"><article class="stage-card"><h3>${esc(candidate.virtual.name)}</h3><p>Virtual · valid uncertainty</p>${dimensionList(candidate.virtual.rows.slice(0,6))}</article><article class="stage-card"><h3>${esc(candidate.instance.name)}</h3><p>Instance · settled facts</p>${factGrid(candidate.instance.rows)}<div class="token-row">${tokens(candidate.instance.assignments)}</div></article></div></div></section>`;
  }

  function tokenPack(pack) {
    return `<section class="panel"><div class="panel-header"><div><h3>${esc(pack.family)}</h3><p>${esc(pack.id)}</p></div></div><div class="panel-body threshold-list">${pack.entries.slice(0,8).map((entry) => `<article class="token-entry ${entry.matched ? 'matched' : ''}"><div class="token-entry-head"><b>${esc(entry.token.text)}</b><span>${entry.matched ? 'earned' : `${Math.round(entry.progress*100)}% threshold`}</span></div><div class="clause-list">${entry.clauses.map((clause) => `<div class="clause"><span class="${clause.pass ? 'pass' : 'fail'}">${clause.pass ? '✓' : '·'}</span><span>${esc(clause.path)} ${esc(clause.op)} ${esc(Array.isArray(clause.expected) ? clause.expected.join('|') : clause.expected)}</span><span>${esc(clause.actual ?? '—')}</span></div>`).join('')}</div></article>`).join('')}</div></section>`;
  }

  function renderName() {
    const candidate = state.projection.candidate;
    stage.innerHTML = `<div class="name-composition"><small>Rendered from earned Tokens</small><h2>${esc(candidate.instance.name)}</h2><div class="token-row" style="justify-content:center">${tokens(candidate.instance.assignments)}</div></div><div class="surface-grid equal" style="margin-top:16px">${candidate.instance.tokenPacks.map(tokenPack).join('')}</div>`;
  }

  function renderInspect() {
    const candidate = state.projection.candidate;
    const datasets = {
      candidate: candidate,
      virtual: candidate.virtual,
      instance: candidate.instance,
      composition: state.projection.composition,
      vocabulary: state.projection.vocabulary,
    };
    stage.innerHTML = `<div class="inspect-grid"><nav class="inspect-nav">${Object.keys(datasets).map((key) => `<button type="button" data-inspect="${key}" class="${state.inspect === key ? 'active' : ''}">${key[0].toUpperCase()+key.slice(1)}</button>`).join('')}</nav><pre id="rawEvidence" class="raw-block">${json(datasets[state.inspect])}</pre></div>`;
    stage.querySelectorAll('[data-inspect]').forEach((button) => button.addEventListener('click', () => { state.inspect = button.dataset.inspect; renderInspect(); }));
  }

  function render() {
    const [name, desc] = copy[state.utility];
    title.textContent = name; description.textContent = desc;
    utilities.forEach((button) => button.classList.toggle('active', button.dataset.utility === state.utility));
    generatorControls.hidden = state.utility === 'explore' || state.utility === 'compose' || state.utility === 'inspect';
    if (!state.projection) return;
    ({ explore: renderExplore, generate: renderGenerate, compose: renderCompose, resolve: renderResolve, name: renderName, inspect: renderInspect })[state.utility]();
  }

  function populateProfiles() {
    const options = state.projection?.catalog?.[state.kind] ?? [];
    if (!options.some((item) => item.id === state.profile)) state.profile = options[0]?.id ?? 'wide';
    profile.innerHTML = options.map((item) => `<option value="${esc(item.id)}" ${item.id === state.profile ? 'selected' : ''}>${esc(item.label)}</option>`).join('');
    const selected = options.find((item) => item.id === state.profile);
    profileHint.textContent = selected?.hint ?? '';
    kinds.forEach((button) => button.classList.toggle('active', button.dataset.kind === state.kind));
  }

  async function load() {
    if (state.busy) return;
    state.busy = true; regenerate.disabled = true; status.textContent = 'Resolving…';
    try {
      const value = Math.max(0, Math.floor(Number(seed.value) || 0)); seed.value = value;
      const query = new URLSearchParams({ seed: String(value), kind: state.kind, profile: state.profile, utility: state.utility });
      const response = await fetch(`/api/studio?${query}`);
      const projection = await response.json();
      if (!response.ok) throw new Error(projection.error ?? `HTTP ${response.status}`);
      state.projection = projection;
      populateProfiles(); render(); status.textContent = `seed ${projection.seed} · ${projection.candidate.instance.name}`;
    } catch (error) {
      stage.innerHTML = `<section class="panel"><div class="panel-body"><h2>Studio error</h2><p>${esc(error.message)}</p></div></section>`;
      status.textContent = 'Error';
    } finally { state.busy = false; regenerate.disabled = false; }
  }

  utilities.forEach((button) => button.addEventListener('click', () => { state.utility = button.dataset.utility; render(); }));
  kinds.forEach((button) => button.addEventListener('click', () => { state.kind = button.dataset.kind; state.profile = 'wide'; load(); }));
  profile.addEventListener('change', () => { state.profile = profile.value; load(); });
  regenerate.addEventListener('click', load);
  seed.addEventListener('keydown', (event) => { if (event.key === 'Enter') load(); });
  load();
})();
