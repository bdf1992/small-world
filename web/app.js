'use strict';

const state = {
  world: null,
  selectedKey: null,
  tab: 'surface',
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function dominantField(field = {}) {
  const [name, value] = Object.entries(field).sort((a, b) => b[1] - a[1])[0] ?? ['Quiet', 0];
  return { name, value };
}

function positions(count) {
  const center = { x: 50, y: 48 };
  const radiusX = count <= 3 ? 31 : 35;
  const radiusY = count <= 3 ? 29 : 33;
  return Array.from({ length: count }, (_, index) => {
    const angle = (-Math.PI / 2) + (index * Math.PI * 2 / Math.max(1, count));
    return {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
    };
  });
}

function valueRows(value) {
  if (value === null || value === undefined) return '<span class="muted">none</span>';
  if (typeof value !== 'object') return `<span>${escapeHtml(value)}</span>`;
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="muted">none</span>';
    return `<div class="list">${value.map((item) => `<div>${valueRows(item)}</div>`).join('')}</div>`;
  }

  return `<dl class="record">${Object.entries(value).map(([key, item]) => `
    <div>
      <dt>${escapeHtml(key)}</dt>
      <dd>${valueRows(item)}</dd>
    </div>`).join('')}</dl>`;
}

function weightedRows(possibilities) {
  if (!possibilities) return '<p class="muted">No unresolved possibility on this projection.</p>';
  const groups = possibilities.possibilities ?? possibilities;
  const entries = Object.entries(groups);
  if (!entries.length) return '<p class="muted">No weighted alternatives exposed.</p>';

  return entries.map(([group, weights]) => {
    if (!weights || typeof weights !== 'object') {
      return `<section class="possibility-group"><h4>${escapeHtml(group)}</h4>${valueRows(weights)}</section>`;
    }
    return `<section class="possibility-group">
      <h4>${escapeHtml(group)}</h4>
      <div class="weights">${Object.entries(weights)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .map(([name, weight]) => {
          const percent = Math.max(0, Math.min(100, Number(weight) * 100));
          return `<div class="weight">
            <div class="weight-label"><span>${escapeHtml(name)}</span><span>${percent.toFixed(1)}%</span></div>
            <div class="weight-track"><i style="width:${percent}%"></i></div>
          </div>`;
        }).join('')}</div>
    </section>`;
  }).join('');
}

function lineageRows(lineage = []) {
  if (!lineage.length) return '<p class="muted">No lifecycle lineage exposed.</p>';
  return `<ol class="lineage">${lineage.map((step) => `
    <li><span>${escapeHtml(step.stage)}</span><strong>${escapeHtml(step.id)}</strong></li>`).join('')}</ol>`;
}

function renderInspector() {
  const panel = $('#inspector');
  const object = state.world?.objects?.[state.selectedKey];
  if (!object) {
    panel.innerHTML = '<div class="inspector-empty"><span class="sigil">◇</span><p>Select anything in the world.</p></div>';
    return;
  }

  const tabs = [
    ['surface', 'Surface'],
    ['possibility', 'Possibility'],
    ['lineage', 'Lineage'],
  ];

  let content = '';
  if (state.tab === 'surface') content = valueRows(object.facts);
  if (state.tab === 'possibility') content = weightedRows(object.possibilities);
  if (state.tab === 'lineage') content = lineageRows(object.lineage);

  const children = object.children?.length
    ? `<div class="within"><span>Within</span>${object.children.map((child) => `
        <button type="button" class="child-link" data-object-key="${escapeHtml(child.key)}">
          <small>${escapeHtml(child.role ?? child.kind)}</small>
          <strong>${escapeHtml(child.label)}</strong>
        </button>`).join('')}</div>`
    : '';

  panel.innerHTML = `
    <div class="inspector-head">
      <div>
        <p class="eyebrow">${escapeHtml(object.kind)}${object.stage ? ` · ${escapeHtml(object.stage)}` : ''}</p>
        <h2>${escapeHtml(object.label)}</h2>
        <p class="object-id">${escapeHtml(object.id)}</p>
      </div>
      <button class="close-inspector" type="button" aria-label="Close inspector">×</button>
    </div>
    ${children}
    <nav class="tabs">${tabs.map(([id, label]) => `
      <button type="button" data-tab="${id}" class="${state.tab === id ? 'active' : ''}">${label}</button>`).join('')}
    </nav>
    <div class="inspector-body">${content}</div>`;

  panel.querySelectorAll('[data-object-key]').forEach((button) => {
    button.addEventListener('click', () => selectObject(button.dataset.objectKey));
  });
  panel.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      state.tab = button.dataset.tab;
      renderInspector();
    });
  });
  panel.querySelector('.close-inspector').addEventListener('click', () => {
    state.selectedKey = null;
    renderInspector();
    renderMap();
  });
}

function renderMap() {
  if (!state.world) return;
  const regions = state.world.map.regions;
  const coords = positions(regions.length);
  const lookup = Object.fromEntries(regions.map((region, index) => [region.id, coords[index]]));
  const svg = $('#paths');
  svg.innerHTML = state.world.map.edges.map((edge) => {
    const from = lookup[edge.from];
    const to = lookup[edge.to];
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`;
  }).join('');

  $('#regions').innerHTML = regions.map((region, index) => {
    const point = coords[index];
    const dominant = dominantField(region.field);
    const children = region.children ?? [];
    return `<button type="button"
      class="region-node ${state.selectedKey === region.key ? 'selected' : ''}"
      data-object-key="${escapeHtml(region.key)}"
      style="left:${point.x}%;top:${point.y}%">
      <span class="region-mark">◇</span>
      <span class="region-name">${escapeHtml(region.label)}</span>
      <span class="region-field">${escapeHtml(dominant.name)} ${(dominant.value * 100).toFixed(0)}%</span>
      ${children.map((child) => `<span class="situation-mark" data-object-key="${escapeHtml(child.key)}">✦ ${escapeHtml(child.label)}</span>`).join('')}
    </button>`;
  }).join('');

  document.querySelectorAll('.region-node').forEach((button) => {
    button.addEventListener('click', (event) => {
      const nested = event.target.closest('.situation-mark');
      selectObject(nested?.dataset.objectKey ?? button.dataset.objectKey);
    });
  });
}

function renderFrontier() {
  const box = $('#frontier');
  if (!state.world) return;
  if (!state.world.stops.length) {
    box.innerHTML = '<span class="frontier-label">Frontier</span><span class="muted">No unresolved stops.</span>';
    return;
  }

  const virtuals = state.world.unresolved.map((key) => state.world.objects[key]).filter(Boolean);
  box.innerHTML = `
    <span class="frontier-label">Frontier</span>
    <div class="frontier-items">
      ${state.world.stops.map((stop) => `<span>${escapeHtml(stop.reason)} · ${escapeHtml(stop.nodeId ?? '')}</span>`).join('')}
      ${virtuals.slice(0, 4).map((object) => `<button type="button" data-object-key="${escapeHtml(object.key)}">◇ ${escapeHtml(object.label)}</button>`).join('')}
    </div>`;
  box.querySelectorAll('[data-object-key]').forEach((button) => {
    button.addEventListener('click', () => selectObject(button.dataset.objectKey));
  });
}

function selectObject(key) {
  state.selectedKey = key;
  state.tab = 'surface';
  renderMap();
  renderInspector();
}

async function resolve() {
  const params = new URLSearchParams({
    seed: $('#seed').value,
    hops: $('#hops').value,
    slots: $('#slots').value,
    instances: $('#instances').value,
  });
  $('#status').textContent = 'resolving';
  $('#status').className = 'status';

  const response = await fetch(`/api/world?${params}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'Could not resolve world');

  state.world = payload;
  if (!payload.objects[state.selectedKey]) state.selectedKey = payload.roots[0] ?? payload.unresolved[0] ?? null;
  $('#status').textContent = payload.status;
  $('#status').className = `status ${payload.status}`;
  $('#usage').textContent = `h${payload.usage.maxHopReached} · s${payload.usage.slots} · i${payload.usage.instances}`;

  renderMap();
  renderInspector();
  renderFrontier();
}

$('#world-controls').addEventListener('submit', (event) => {
  event.preventDefault();
  resolve().catch((error) => {
    $('#status').textContent = error.message;
    $('#status').className = 'status error';
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    state.selectedKey = null;
    renderMap();
    renderInspector();
  }
});

resolve().catch((error) => {
  $('#status').textContent = error.message;
  $('#status').className = 'status error';
});
