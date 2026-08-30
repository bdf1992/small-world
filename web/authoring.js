'use strict';

(() => {
  const state = { projection: null, mode: 'card', selected: null };
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
    if (state.mode === 'card') return state.projection.views.card;
    if (state.mode === 'pack') return state.projection.views.pack;
    if (state.mode === 'graph') return state.projection.views.graph;
    if (state.mode === 'resolution') return state.projection.views.resolution;
    return null;
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
    if (!entries.length) return '';
    return entries.map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ');
  }

  function candidatePills(graph, node) {
    const candidates = graph.tuples.filter((tuple) => tuple.subject === node && tuple.predicate === 'candidate');
    if (!candidates.length) return '';
    return candidates.map((tuple) => {
      const weight = Number(tuple.qualifiers?.weight);
      const bar = Number.isFinite(weight) ? `<i class="weight" style="width:${Math.max(2, Math.round(weight * 70))}px"></i>` : '';
      const weightText = Number.isFinite(weight) ? `${(weight * 100).toFixed(0)}%` : 'context';
      return `<span class="pill"><b>${esc(label(tuple.object))}</b>${esc(weightText)}${bar}</span>`;
    }).join('');
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
          candidatePills(graph, target),
          requirementSummary(graph, target),
          qualifierText(edge) ? `<span class="pill">${esc(qualifierText(edge))}</span>` : '',
        ].join('');
        return `<button type="button" class="row semantic-row" data-node="${esc(target)}"><strong>${esc(display)}</strong><span class="value">${detail || esc(target)}</span></button>`;
      }).join('');
      return `<section class="section"><h3>${esc(predicate)}</h3><div class="rows">${rows}</div></section>`;
    }).join('') || '<p class="muted">No authored tuples on this root.</p>';

    semantic.querySelectorAll('[data-node]').forEach((button) => {
      button.addEventListener('click', () => inspectNode(graph, button.dataset.node));
    });
  }

  function familyFilter() {
    return new Set([...root.querySelectorAll('[data-family]')].filter((input) => input.checked).map((input) => input.dataset.family));
  }

  function graphLayout(graph, tuples) {
    const stringEdges = tuples.filter((tuple) => typeof tuple.subject === 'string' && typeof tuple.object === 'string');
    const nodes = new Set([graph.root]);
    for (const edge of stringEdges) { nodes.add(edge.subject); nodes.add(edge.object); }
    const adjacency = new Map();
    for (const edge of stringEdges) {
      if (!adjacency.has(edge.subject)) adjacency.set(edge.subject, []);
      adjacency.get(edge.subject).push(edge.object);
    }

    const depth = new Map([[graph.root, 0]]);
    const queue = [graph.root];
    while (queue.length) {
      const current = queue.shift();
      const nextDepth = (depth.get(current) ?? 0) + 1;
      for (const child of adjacency.get(current) ?? []) {
        if (depth.has(child)) continue;
        depth.set(child, nextDepth);
        queue.push(child);
      }
    }
    let fallback = Math.max(1, ...depth.values()) + 1;
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
    const families = familyFilter();
    const tuples = graph.tuples.filter((tuple) => families.has(tuple.family));
    const { positions, width, height, stringEdges } = graphLayout(graph, tuples);
    graphSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const edges = stringEdges.map((tuple, index) => {
      const a = positions.get(tuple.subject);
      const b = positions.get(tuple.object);
      if (!a || !b) return '';
      const x1 = a.x + 150, y1 = a.y + 22, x2 = b.x, y2 = b.y + 22;
      const mid = (x1 + x2) / 2;
      const path = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
      const tx = (x1 + x2) / 2, ty = (y1 + y2) / 2 - 4;
      return `<g data-edge="${index}"><path class="edge ${esc(tuple.family)}" d="${path}"></path><path class="edge-hit" d="${path}"></path><text x="${tx}" y="${ty}" text-anchor="middle" fill="#8f9189" font-size="9">${esc(tuple.predicate)}</text></g>`;
    }).join('');

    const nodes = [...positions.entries()].map(([node, point]) => {
      const isRoot = node === graph.root;
      const kinds = graph.tuples.filter((tuple) => tuple.subject === node && tuple.predicate === 'is-a').map((tuple) => tuple.object);
      return `<g class="node ${isRoot ? 'root' : ''}" data-node="${esc(node)}" transform="translate(${point.x},${point.y})"><rect width="150" height="44"></rect><text x="10" y="18">${esc(label(node)).slice(0, 22)}</text><text class="kind" x="10" y="33">${esc((kinds[0] ?? node).toString()).slice(0, 28)}</text></g>`;
    }).join('');

    graphSvg.innerHTML = edges + nodes;
    graphSvg.querySelectorAll('.node').forEach((node) => node.addEventListener('click', () => inspectNode(graph, node.dataset.node)));
    graphSvg.querySelectorAll('[data-edge]').forEach((group) => group.addEventListener('click', () => inspectTuple(stringEdges[Number(group.dataset.edge)])));
  }

  function inspectNode(graph, node) {
    state.selected = { kind: 'node', node };
    const index = tupleIndex(graph);
    const outs = index.outgoing.get(node) ?? [];
    const ins = index.incoming.get(node) ?? [];
    const kinds = outs.filter((tuple) => tuple.predicate === 'is-a').map((tuple) => tuple.object);
    const list = [...outs.map((tuple) => ({ direction: 'out', tuple })), ...ins.map((tuple) => ({ direction: 'in', tuple }))];
    inspector.innerHTML = `<h3>${esc(label(node))}</h3><div class="mono">${esc(node)}</div><div class="kv"><span>kind</span><b>${esc(kinds.join(', ') || 'Graph node')}</b></div><div class="kv"><span>outgoing</span><b>${outs.length}</b></div><div class="kv"><span>incoming</span><b>${ins.length}</b></div><div class="tuple-list">${list.slice(0, 30).map(({ direction, tuple }) => `<div class="tuple-card"><span class="muted">${direction}</span> <b>${esc(tuple.predicate)}</b><br>${esc(tuple.subject)} → ${esc(typeof tuple.object === 'object' ? JSON.stringify(tuple.object) : tuple.object)}${qualifierText(tuple) ? `<br><span class="muted">${esc(qualifierText(tuple))}</span>` : ''}</div>`).join('')}</div>`;
  }

  function inspectTuple(tuple) {
    state.selected = { kind: 'tuple', tuple };
    inspector.innerHTML = `<h3>${esc(tuple.predicate)}</h3><div class="kv"><span>family</span><b>${esc(tuple.family)}</b></div><div class="kv"><span>subject</span><div class="mono">${esc(tuple.subject)}</div></div><div class="kv"><span>object</span><div class="mono">${esc(typeof tuple.object === 'object' ? JSON.stringify(tuple.object) : tuple.object)}</div></div><div class="kv"><span>qualifiers</span><div class="mono">${esc(JSON.stringify(tuple.qualifiers ?? {}, null, 2))}</div></div>`;
  }

  function renderWorld() {
    const world = state.projection.views.world;
    const cards = world.map.regions.map((region) => {
      const object = world.objects[region.key];
      const field = Object.entries(region.field).sort((a, b) => b[1] - a[1]).slice(0, 4);
      return `<article class="world-card"><p class="eyebrow">Region</p><h3>${esc(region.label)}</h3><div>${field.map(([name, value]) => `<span class="pill"><b>${esc(name)}</b>${(value * 100).toFixed(0)}%</span>`).join('')}</div><div class="children">${(object.children ?? []).map((child) => `<button type="button" data-world-object="${esc(child.key)}">${esc(child.label)} · ${esc(child.kind)}</button>`).join('')}</div></article>`;
    }).join('');
    semantic.innerHTML = `<div class="world-grid">${cards}</div>`;
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

    if (state.mode === 'card') {
      modeKind.textContent = 'Card · authored tree'; modeTitle.textContent = 'Dragon';
      metrics.innerHTML = `<span class="metric">${graph.tuples.length} tuples</span><span class="metric">${graph.tuples.filter((x) => x.predicate === 'requires').length} requirements</span>`;
      renderSemanticGraph(graph);
    } else if (state.mode === 'pack') {
      modeKind.textContent = 'Pack · compositional tree'; modeTitle.textContent = 'Spire';
      metrics.innerHTML = `<span class="metric">${graph.tuples.length} tuples</span><span class="metric">${graph.tuples.filter((x) => x.predicate === 'candidate').length} candidates</span>`;
      renderSemanticGraph(graph);
    } else if (state.mode === 'graph') {
      modeKind.textContent = 'Graph · shared truth'; modeTitle.textContent = 'Mountains / Spire / Dragon';
      metrics.innerHTML = `<span class="metric">${graph.tuples.length} tuples</span><span class="metric">${graph.tuples.filter((x) => x.predicate === 'emits').length} signals</span><span class="metric">${graph.tuples.filter((x) => x.predicate === 'influences').length} influences</span>`;
      renderGraph(graph);
    } else if (state.mode === 'resolution') {
      modeKind.textContent = 'Resolution · lifecycle traversal'; modeTitle.textContent = `Seed ${state.projection.seed}`;
      metrics.innerHTML = `<span class="metric">${graph.tuples.length} tuples</span><span class="metric">${graph.tuples.filter((x) => x.predicate === 'resolves-to').length} transitions</span>`;
      renderGraph(graph);
    } else {
      modeKind.textContent = 'World · realized projection'; modeTitle.textContent = `Seed ${state.projection.seed}`;
      const world = state.projection.views.world;
      metrics.innerHTML = `<span class="metric">${world.map.regions.length} regions</span><span class="metric">${Object.keys(world.objects).length} objects</span><span class="metric">${esc(world.status)}</span>`;
      renderWorld();
    }
  }

  async function load() {
    const value = Math.max(0, Math.floor(Number(seed.value) || 0));
    seed.value = value;
    inspector.innerHTML = '<p class="muted">Building canonical graph projection…</p>';
    const response = await fetch(`/api/authoring?seed=${value}`);
    if (!response.ok) throw new Error(`authoring projection failed: ${response.status}`);
    state.projection = await response.json();
    state.selected = null;
    inspector.innerHTML = '<p class="muted">Select a node or relation.</p>';
    render();
  }

  modes.forEach((button) => button.addEventListener('click', () => { state.mode = button.dataset.mode; render(); }));
  root.querySelectorAll('[data-family]').forEach((input) => input.addEventListener('change', () => { if (graphForMode()) renderGraph(graphForMode()); }));
  root.getElementById('reload').addEventListener('click', () => load().catch(showError));
  seed.addEventListener('keydown', (event) => { if (event.key === 'Enter') load().catch(showError); });

  function showError(error) {
    inspector.innerHTML = `<h3>Projection error</h3><p class="muted">${esc(error.message)}</p>`;
  }

  load().catch(showError);
})();
