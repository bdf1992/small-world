'use strict';

(() => {
  const workshop = document.getElementById('resolutionWorkshop');
  if (!workshop) return;

  const stateNode = document.getElementById('resolutionState');
  const hops = document.getElementById('resolutionHops');
  const slots = document.getElementById('resolutionSlots');
  const instances = document.getElementById('resolutionInstances');
  const usage = document.getElementById('resolutionUsage');
  const stops = document.getElementById('resolutionStops');
  const virtuals = document.getElementById('resolutionVirtuals');
  const status = document.getElementById('resolutionStatus');
  const apply = document.getElementById('applyResolutionBudget');
  const reset = document.getElementById('resetResolutionBudget');
  const modeButtons = [...document.querySelectorAll('[data-mode]')];

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function percent(value, limit) {
    if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((value / limit) * 100)));
  }

  function usageRow(label, value, limit) {
    return `<div class="resolution-usage-row"><div><span>${esc(label)}</span><b>${esc(value)} / ${esc(limit)}</b></div><i><span style="width:${percent(value, limit)}%"></span></i></div>`;
  }

  function render(snapshot) {
    const resolution = snapshot.resolution ?? {};
    const budget = resolution.budget ?? {};
    const used = resolution.usage ?? {};
    hops.value = budget.maxHops ?? 0;
    slots.value = budget.maxSlots ?? 0;
    instances.value = budget.maxInstances ?? 0;

    stateNode.innerHTML = `<span class="resolution-badge ${resolution.complete ? 'complete' : 'open'}">${resolution.complete ? 'settled' : 'frontier open'}</span><span class="resolution-revision">author ${esc(snapshot.revision ?? 0)} · resolve ${esc(snapshot.resolutionRevision ?? 0)}</span>`;

    usage.innerHTML = [
      usageRow('hops', used.maxHopReached ?? 0, budget.maxHops ?? 0),
      usageRow('slots', used.slots ?? 0, budget.maxSlots ?? 0),
      usageRow('instances', used.instances ?? 0, budget.maxInstances ?? 0),
    ].join('');

    stops.innerHTML = (resolution.stops ?? []).length
      ? resolution.stops.map((stop) => `<button type="button" class="resolution-stop" data-frontier-node="${esc(stop.nodeId ?? '')}"><b>${esc(stop.reason)}</b><span>${esc(stop.nodeId ?? 'unknown node')}</span><small>${stop.limit === null ? '' : `limit ${esc(stop.limit)} · used ${esc(stop.used ?? stop.hop ?? 0)}`}</small></button>`).join('')
      : '<p class="resolution-empty">No stop reasons. The requested target settled.</p>';

    virtuals.innerHTML = (resolution.virtuals ?? []).length
      ? resolution.virtuals.map((entry) => `<div class="resolution-virtual"><b>${esc(entry.object?.label ?? entry.key)}</b><span>${esc(entry.object?.grammar ?? 'Virtual')}</span></div>`).join('')
      : '<p class="resolution-empty">No retained unresolved Virtuals at this frontier.</p>';

    status.textContent = resolution.complete
      ? 'Resolution reached the requested world target within budget.'
      : 'The graph remains valid. Resolution stopped at the visible frontier.';
  }

  async function snapshot() {
    const response = await fetch('/api/authoring', { cache: 'no-store' });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`);
    return value;
  }

  async function mutate(action, params = {}) {
    const query = new URLSearchParams(params);
    const response = await fetch(`/api/authoring/${action}?${query}`, { cache: 'no-store' });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`);
    return value;
  }

  async function applyBudget(next) {
    status.textContent = 'Resolving…';
    try {
      const value = await mutate('set-budget', next);
      render(value);
      sessionStorage.setItem('small-world-authoring-mode', 'resolution');
      window.location.reload();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function showFor(mode) {
    workshop.hidden = mode !== 'resolution';
    if (mode === 'resolution') snapshot().then(render).catch((error) => { status.textContent = error.message; });
  }

  modeButtons.forEach((button) => button.addEventListener('click', () => showFor(button.dataset.mode)));

  apply.addEventListener('click', () => applyBudget({
    hops: hops.value,
    slots: slots.value,
    instances: instances.value,
  }));

  reset.addEventListener('click', async () => {
    status.textContent = 'Restoring full budget…';
    try {
      const value = await mutate('reset-budget');
      render(value);
      sessionStorage.setItem('small-world-authoring-mode', 'resolution');
      window.location.reload();
    } catch (error) {
      status.textContent = error.message;
    }
  });

  document.querySelectorAll('[data-resolution-preset]').forEach((button) => button.addEventListener('click', () => {
    const preset = button.dataset.resolutionPreset;
    if (preset === 'virtual') return applyBudget({ hops: 4, slots: 6, instances: 0 });
    if (preset === 'slot') return applyBudget({ hops: 4, slots: 3, instances: 9 });
    if (preset === 'shallow') return applyBudget({ hops: 1, slots: 6, instances: 9 });
  }));

  const restoreMode = sessionStorage.getItem('small-world-authoring-mode');
  if (restoreMode === 'resolution') {
    sessionStorage.removeItem('small-world-authoring-mode');
    requestAnimationFrame(() => document.querySelector('[data-mode="resolution"]')?.click());
  }
})();
