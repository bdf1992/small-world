'use strict';

(() => {
  const state = { projection: null, mode: 'card', selected: null, busy: false };
  const root = document;
  const modes = [...root.querySelectorAll('[data-mode]')];
  const semantic = root.getElementById('semantic');
  const graphWrap = root.getElementById('graphWrap');
  const graphSvg = root.getElementById('graph');
  const inspector = root.getElementById('inspector');
  const modeKind = root.getElementById('modeKind');
  const modeTitle = root.getElementById('modeTitle');
  const metrics = root.getElementById('metrics');
  const seed = root.getElementById('seed');
  const resetButton = root.getElementById('reload');

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function label(value) {
    const text = String(value ?? '');
    const last = text.split(/[/:]/).pop().split('.').pop();
    return last.replaceAll('-', ' ').replace(/\b\w/g, (match) => match.toUpperCase());
  }

  function graphForMode() {
    if (!state.projection) return null;
    return state.projection.views[state.mode] ?? null;
  }

  function tupleIndex(graph) {
    const outgoing = new Map();
    const incoming = new Map();
    for (const tuple of graph.tuples) {
      if (!outgoing.has(tuple.subject)) outgoing.set(tuple.subject, []);
      outgoing.get(tuple.subject).push(tuple);
      if (typeof tuple.object === 'string') {
        if (!incoming.has(tuple.object)) incoming.set(tuple.object, []);
        incoming.get(tuple.object).push(tuple);
      }
    }
    return { outgoing, incoming };
  }

  function qualifierText(tuple) {
    const entries = Object.entries(tuple.qualifiers ?? {}).filter(([, value]) => value !== null && value !== undefined);
    return entries.map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ');
  }

  function editDescriptor(node) {
    if (!state.projection?.editor) return null;
    const cardPrefix = 'persona.dragon.possibility.';
    if (node.startsWith(cardPrefix)) {
      const field = node.slice(cardPrefix.length);
      if (state.projection.editor.card.weighted.includes(field)) return { target: 'dragon', field };
      if (state.projection.editor.card.contextual?.[field]) return { target: 'dragon', field, contextual: true };
    }
    const packPrefix = 'pack.spire.slot.';
    if (node.startsWith(packPrefix)) {
      const field = node.slice(packPrefix.length);
      if (state.projection.editor.pack.weighted.includes(field)) return { target: 'spire', field };
    }
    return null;
  }

  function candidateControls(graph, node) {
    const candidates = graph.tuples.filter((tuple) => tuple.subject === node && tuple.predicate === 'candidate');
    if (!candidates.length) return '';
    const editable = editDescriptor(node);
    return `<div class="candidate-list">${candidates.map((tuple) => {
      const weight = Number(tuple.qualifiers?.weight);
      if (editable && !editable.contextual && Number.isFinite(weight)) {
        return `<label class="candidate-edit"><span>${esc(label(tuple.object))}</span><input type="number" min="0" step="0.01" value="${weight}" data-edit-weight data-target="${esc(editable.target)}" data-field="${esc(editable.field)}" data-candidate="${esc(tuple.object)}"><i class="weight" style="width:${Math.max(2, Math.round(weight * 70))}px"></i></label>`;
      }
      const weightText = Number.isFinite(weight) ? `${(weight * 100).toFixed(0)}%` : 'context';
      return `<span class="pill"><b>${esc(label(tuple.object))}</b>${esc(weightText)}</span>`;
    }).join('')}</div>`;
  }

  function contextualControl(node) {
    const editable = editDescriptor(node);
    if (!editable?.contextual) return '';
    const current = state.projection.draft?.dragon?.priors?.[editable.field]?.affinity ?? 'medium';
    const options = state.projection.editor.card.contextual[editable.field];
    return `<label class="affinity-edit"><span>Affinity</span><select data-edit-affinity data-field="${esc(editable.field)}">${options.map((option) => `<option value="${esc(option)}" ${option === current ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`;
  }

  function requirementSummary(graph, node) {
    const requires = graph.tuples.filter((tuple) => tuple.subject === node && tuple.predicate === 'requires');
    return requires.map((tuple) => {
      const target = tuple.object;
      const accepts = graph.tuples.find((entry) => entry.subject === target && entry.predicate === 'accepts');
      const count = graph.tuples.find((entry) => entry.subject === target && entry.predicate === 'count');
      return `<span class="pill"><b>Requirement</b>${esc(accepts?.object ?? target)} · ${esc(count?.object ?? 1)}</span>`;
    }).join('');
  }

  function bindSemantic(graph) {
    semantic.querySelectorAll('[data-node]').forEach((button) => button.addEventListener('click', () => inspectNode(graph, button.dataset.node)));
    semantic.querySelectorAll('[data-edit-weight]').forEach((input) => input.addEventListener('change', async () => {
      await mutate('set-weight', {
        target: input.dataset.target,
        field: input.dataset.field,
        candidate: input.dataset.candidate,
        weight: input.value,
      });
    }));
    semantic.querySelectorAll('[data-edit-affinity]').forEach((select) => select.addEventListener('change', async () => {
      await mutate('set-affinity', { field: select.dataset.field, affinity: select.value });
    }));
  }

  function renderSemanticGraph(graph) {
    const index = tupleIndex(graph);
    const rootEdges = index.outgoing.get(graph.root) ?? [];
    const grouped = new Map();
    for (const edge of rootEdges) {
      if (!grouped.has(edge.predicate)) grouped.set(edge.predicate, []);
      grouped.get(edge.predicate).push(edge);
    }

    semantic.innerHTML = [...grouped.entries()].map(([predicate, edges]) => {
      const rows = edges.map((edge) => {
        const target = edge.object;
        const childEdges = typeof target === 'string' ? (index.outgoing.get(target) ?? []) : [];
        const nameEntry = childEdges.find((entry) => entry.predicate === 'property' && entry.object === 'name');
        const defaultEntry = childEdges.find((entry) => entry.predicate === 'default');
        const roleEntry = childEdges.find((entry) => entry.predicate === 'property' && entry.object === 'role');
        const display = nameEntry?.qualifiers?.value ?? roleEntry?.qualifiers?.value ?? label(target);
        const detail = [
          defaultEntry ? `<span class="pill"><b>value</b>${esc(defaultEntry.object)}</span>` : '',
          contextualControl(String(target)),
          candidateControls(graph, String(target)),
          requirementSummary(graph, String(target)),
          qualifierText(edge) ? `<span class="pill">${esc(qualifierText(edge))}</span>` : '',
        ].join('');
        return `<div class="row semantic-row"><button type="button" class="row-title" data-node="${esc(target)}"><strong>${esc(display)}</strong><span class="mono">${esc(target)}</span></button><div class="value">${detail || esc(target)}</div></div>`;
      }).join('');
      return `<section class="section"><h3>${esc(predicate)}</h3><div class="rows">${rows}</div></section>`;
    }).join('') || '<p class="muted">No authored tuples on this root.</p>';
    bindSemantic(graph);
  }

  function familyFilter() {
    return new Set([...root.querySelectorAll('[data-family]')].filter((input) => input.checked).map((input) => input.dataset.family));
  }

  function graphLayout(graph, tuples) {
    const stringEdges = tuples.filter((tuple) => typeof tuple.subject === 'string' && typeof tuple.object === 'string');
    const nodes = new Set([graph.root]);
    const adjacency = new Map();
    for (const edge of stringEdges) {
      nodes.add(edge.subject); nodes.add(edge.object);
      if (!adjacency.has(edge.subject)) adjacency.set(edge.subject, []);
      adjacency.get(edge.subject).push(edge.object);
    }
    const depth = new Map([[graph.root, 0]]);
    const queue = [graph.root];
    while (queue.length) {
      const current = queue.shift();
      for (const child of adjacency.get(current) ?? []) {
        if (depth.has(child)) continue;
        depth.set(child, (depth.get(current) ?? 0) + 1);
        queue.push(child);
      }
    }
    const fallback = Math.max(1, ...depth.values()) + 1;
    for (const node of nodes) if (!depth.has(node)) depth.set(node, fallback);
    const columns = new Map();
    for (const node of nodes) {
      const d = depth.get(node);
      if (!columns.has(d)) columns.set(d, []);
      columns.get(d).push(node);
    }
    for (const values of columns.values()) values.sort();
    const positions = new Map();
    const width = Math.max(1200, (Math.max(...columns.keys()) + 1) * 230 + 120);
    let height = 760;
    for (const [d, values] of columns) {
      height = Math.max(height, values.length * 76 + 90);
      values.forEach((node, index) => positions.set(node, { x: 70 + d * 220, y: 55 + index * 76 }));
    }
    return { positions, width, height, stringEdges };
  }

  function renderGraph(graph) {
    const tuples = graph.tuples.filter((tuple) => familyFilter().has(tuple.family));
    const { positions, width, height, stringEdges } = graphLayout(graph, tuples);
    graphSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const edges = stringEdges.map((tuple, index) => {
      const a = positions.get(tuple.subject), b = positions.get(tuple.object);
      if (!a || !b) return '';
      const x1 = a.x + 150, y1 = a.y + 22, x2 = b.x, y2 = b.y + 22, mid = (x1 + x2) / 2;
      const path = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
      return `<g data-edge="${index}"><path class="edge ${esc(tuple.family)}" d="${path}"></path><path class="edge-hit" d="${path}"></path><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 4}" text-anchor="middle" fill="#8f9189" font-size="9">${esc(tuple.predicate)}</text></g>`;
    }).join('');
    const nodes = [...positions.entries()].map(([node, point]) => {
      const kinds = graph.tuples.filter((tuple) => tuple.subject === node && tuple.predicate === 'is-a').map((tuple) => tuple.object);
      return `<g class="node ${node === graph.root ? 'root' : ''}" data-node="${esc(node)}" transform="translate(${point.x},${point.y})"><rect width="150" height="44"></rect><text x="10" y="18">${esc(label(node)).slice(0, 22)}</text><text class="kind" x="10" y="33">${esc((kinds[0] ?? node).toString()).slice(0, 28)}</text></g>`;
    }).join('');
    graphSvg.innerHTML = edges + nodes;
    graphSvg.querySelectorAll('.node').forEach((node) => node.addEventListener('click', () => inspectNode(graph, node.dataset.node)));
    graphSvg.querySelectorAll('[data-edge]').forEach((group) => group.addEventListener('click', () => inspectTuple(stringEdges[Number(group.dataset.edge)])));
  }

  function inspectNode(graph, node) {
    const index = tupleIndex(graph), outs = index.outgoing.get(node) ?? [], ins = index.incoming.get(node) ?? [];
    const kinds = outs.filter((tuple) => tuple.predicate === 'is-a').map((tuple) => tuple.object);
    const list = [...outs.map((tuple) => ({ direction: 'out', tuple })), ...ins.map((tuple) => ({ direction: 'in', tuple }))];
    inspector.innerHTML = `<h3>${esc(label(node))}</h3><div class="mono">${esc(node)}</div><div class="kv"><span>kind</span><b>${esc(kinds.join(', ') || 'Graph node')}</b></div><div class="kv"><span>outgoing</span><b>${outs.length}</b></div><div class="kv"><span>incoming</span><b>${ins.length}</b></div><div class="tuple-list">${list.slice(0, 30).map(({ direction, tuple }) => `<div class="tuple-card"><span class="muted">${direction}</span> <b>${esc(tuple.predicate)}</b><br>${esc(tuple.subject)} → ${esc(typeof tuple.object === 'object' ? JSON.stringify(tuple.object) : tuple.object)}${qualifierText(tuple) ? `<br><span class="muted">${esc(qualifierText(tuple))}</span>` : ''}</div>`).join('')}</div>`;
  }

  function inspectTuple(tuple) {
    inspector.innerHTML = `<h3>${esc(tuple.predicate)}</h3><div class="kv"><span>family</span><b>${esc(tuple.family)}</b></div><div class="kv"><span>subject</span><div class="mono">${esc(tuple.subject)}</div></div><div class="kv"><span>object</span><div class="mono">${esc(typeof tuple.object === 'object' ? JSON.stringify(tuple.object) : tuple.object)}</div></div><div class="kv"><span>qualifiers</span><div class="mono">${esc(JSON.stringify(tuple.qualifiers ?? {}, null, 2))}</div></div>`;
  }

  function renderWorld() {
    const world = state.projection.views.world;
    semantic.innerHTML = `<div class="world-grid">${world.map.regions.map((region) => {
      const object = world.objects[region.key];
      const field = Object.entries(region.field).sort((a, b) => b[1] - a[1]).slice(0, 4);
      return `<article class="world-card"><p class="eyebrow">Region</p><h3>${esc(region.label)}</h3><div>${field.map(([name, value]) => `<span class="pill"><b>${esc(name)}</b>${(value * 100).toFixed(0)}%</span>`).join('')}</div><div class="children">${(object.children ?? []).map((child) => `<button type="button" data-world-object="${esc(child.key)}">${esc(child.label)} · ${esc(child.kind)}</button>`).join('')}</div></article>`;
    }).join('')}</div>`;
    semantic.querySelectorAll('[data-world-object]').forEach((button) => button.addEventListener('click', () => {
      const object = world.objects[button.dataset.worldObject];
      inspector.innerHTML = `<h3>${esc(object.label)}</h3><div class="kv"><span>kind</span><b>${esc(object.kind)}</b></div><div class="kv"><span>stage</span><b>${esc(object.stage)}</b></div><div class="kv"><span>facts</span><div class="mono">${esc(JSON.stringify(object.facts, null, 2))}</div></div><div class="kv"><span>possibility</span><div class="mono">${esc(JSON.stringify(object.possibilities, null, 2))}</div></div>`;
    }));
  }

  function render() {
    if (!state.projection) return;
    modes.forEach((button) => button.classList.toggle('active', button.dataset.mode === state.mode));
    const graph = graphForMode();
    const graphMode = state.mode === 'graph' || state.mode === 'resolution';
    graphWrap.hidden = !graphMode;
    semantic.hidden = graphMode;
    const revision = `<span class="metric">revision ${state.projection.revision ?? 0}</span>`;

    if (state.mode === 'card') {
      modeKind.textContent = 'Card · editable authored tree'; modeTitle.textContent = 'Dragon';
      metrics.innerHTML = `${revision}<span class="metric">${graph.tuples.length} tuples</span><span class="metric">${graph.tuples.filter((x) => x.predicate === 'requires').length} requirements</span>`;
      renderSemanticGraph(graph);
    } else if (state.mode === 'pack') {
      modeKind.textContent = 'Pack · editable compositional tree'; modeTitle.textContent = 'Spire';
      metrics.innerHTML = `${revision}<span class="metric">${graph.tuples.length} tuples</span><span class="metric">${graph.tuples.filter((x) => x.predicate === 'candidate').length} candidates</span>`;
      renderSemanticGraph(graph);
    } else if (state.mode === 'graph') {
      modeKind.textContent = 'Graph · shared truth'; modeTitle.textContent = 'Mountains / Spire / Dragon';
      metrics.innerHTML = `${revision}<span class="metric">${graph.tuples.length} tuples</span><span class="metric">${graph.tuples.filter((x) => x.predicate === 'emits').length} signals</span><span class="metric">${graph.tuples.filter((x) => x.predicate === 'influences').length} influences</span>`;
      renderGraph(graph);
    } else if (state.mode === 'resolution') {
      modeKind.textContent = 'Resolution · lifecycle traversal'; modeTitle.textContent = `Seed ${state.projection.seed}`;
      metrics.innerHTML = `${revision}<span class="metric">${graph.tuples.length} tuples</span><span class="metric">${graph.tuples.filter((x) => x.predicate === 'resolves-to').length} transitions</span>`;
      renderGraph(graph);
    } else {
      modeKind.textContent = 'World · realized projection'; modeTitle.textContent = `Seed ${state.projection.seed}`;
      const world = state.projection.views.world;
      metrics.innerHTML = `${revision}<span class="metric">${world.map.regions.length} regions</span><span class="metric">${Object.keys(world.objects).length} objects</span><span class="metric">${esc(world.status)}</span>`;
      renderWorld();
    }
  }

  async function request(path) {
    if (state.busy) return null;
    state.busy = true;
    resetButton.disabled = true;
    try {
      const response = await fetch(path);
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? `request failed: ${response.status}`);
      state.projection = value;
      render();
      return value;
    } finally {
      state.busy = false;
      resetButton.disabled = false;
    }
  }

  async function mutate(action, params) {
    const query = new URLSearchParams(params);
    try {
      const value = await request(`/api/authoring/${action}?${query}`);
      if (value) inspector.innerHTML = `<h3>Recompiled</h3><p class="muted">Draft revision ${value.revision}. Card → graph → resolution → world all rebuilt from the edited Templates.</p>`;
    } catch (error) {
      showError(error);
      await load(false);
    }
  }

  async function load(reset = false) {
    const value = Math.max(0, Math.floor(Number(seed.value) || 0));
    seed.value = value;
    const path = reset ? `/api/authoring/reset?seed=${value}` : `/api/authoring?seed=${value}`;
    return request(path);
  }

  function showError(error) {
    inspector.innerHTML = `<h3>Authoring error</h3><p class="muted">${esc(error.message)}</p>`;
  }

  modes.forEach((button) => button.addEventListener('click', () => { state.mode = button.dataset.mode; render(); }));
  root.querySelectorAll('[data-family]').forEach((input) => input.addEventListener('change', () => { const graph = graphForMode(); if (graph) renderGraph(graph); }));
  resetButton.addEventListener('click', () => load(true).catch(showError));
  seed.addEventListener('keydown', (event) => { if (event.key === 'Enter') load(true).catch(showError); });
  load(false).catch(showError);
})();
