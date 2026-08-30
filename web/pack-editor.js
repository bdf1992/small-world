'use strict';

(() => {
  const workshop = document.getElementById('packWorkshop');
  if (!workshop) return;
  const slotsRoot = document.getElementById('packSlots');
  const resultRoot = document.getElementById('packResult');
  const status = document.getElementById('packStatus');
  const modeTitle = document.getElementById('modeTitle');
  let snapshot = null;

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
  function query(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) if (value !== undefined && value !== null) search.set(key, String(value));
    return search.toString();
  }
  async function action(name, params = {}) {
    status.textContent = 'Recompiling Pack…';
    const response = await fetch(`/api/authoring/${name}?${query(params)}`);
    const body = await response.json();
    if (!response.ok) {
      status.textContent = body.error ?? 'Pack operation failed';
      throw new Error(status.textContent);
    }
    window.location.reload();
  }
  function labelForCandidate(id) {
    return snapshot.editor.cards[id]?.label ?? id.split('.').pop().replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function worldMembers() {
    const world = snapshot.views.world;
    const mountains = world.objects['region:mountains'];
    if (!mountains?.children?.length) return {};
    const situation = world.objects[mountains.children[0].key];
    return Object.fromEntries((situation?.children ?? []).map((child) => [child.role, world.objects[child.key]]));
  }
  function renderResult() {
    const members = worldMembers();
    resultRoot.innerHTML = Object.entries(members).map(([role, object]) => `<span class="pill"><b>${esc(role)}</b>${esc(object.label)}</span>`).join('');
  }
  function renderSlot(slotName, slot) {
    const connected = Object.entries(slot.candidates ?? {});
    const compatible = (slot.compatible ?? []).filter((card) => !card.connected);
    return `<article class="pack-slot" data-slot="${esc(slotName)}">
      <div class="slot-head">
        <div><div class="port-label">Slot</div><h4>${esc(slotName)}</h4></div>
        <div class="requirement-port"><span>requires ${esc(slot.requirement.accepts)} · ${esc(slot.requirement.count)}</span></div>
      </div>
      <div class="candidate-list">
        <div class="port-label">Connected candidates</div>
        ${connected.map(([id, weight]) => `<div class="candidate-row">
          <div class="connection"><div><span class="candidate-name">${esc(labelForCandidate(id))}</span><code>${esc(id)}</code></div></div>
          <input type="number" min="0" step="0.01" value="${Number(weight)}" data-candidate-weight="${esc(id)}">
          <button type="button" data-focus="${esc(id)}">Focus</button>
        </div>`).join('')}
      </div>
      <div class="compatible-list">
        <div class="port-label">Requirement-compatible authored Cards</div>
        ${compatible.length ? compatible.map((card) => `<div class="compatible-row">
          <div><span class="candidate-name">${esc(card.label)}</span><code>${esc(card.id)}</code></div>
          <span class="muted">${esc(card.id === snapshot.editor.selectedCardId ? 'selected' : '')}</span>
          <button type="button" data-connect="${esc(card.id)}">Connect</button>
        </div>`).join('') : '<span class="muted">No unconnected authored Cards satisfy this Requirement.</span>'}
      </div>
    </article>`;
  }
  function bind() {
    slotsRoot.querySelectorAll('[data-candidate-weight]').forEach((input) => input.addEventListener('change', () => {
      const slot = input.closest('[data-slot]').dataset.slot;
      action('set-pack-candidate-weight', { slot, card: input.dataset.candidateWeight, weight: input.value }).catch(() => {});
    }));
    slotsRoot.querySelectorAll('[data-focus]').forEach((button) => button.addEventListener('click', () => {
      const slot = button.closest('[data-slot]').dataset.slot;
      action('focus-pack-candidate', { slot, card: button.dataset.focus }).catch(() => {});
    }));
    slotsRoot.querySelectorAll('[data-connect]').forEach((button) => button.addEventListener('click', () => {
      const slot = button.closest('[data-slot]').dataset.slot;
      action('connect-card', { slot, card: button.dataset.connect, weight: 1 }).catch(() => {});
    }));
  }
  function render() {
    const pack = snapshot.editor.pack;
    slotsRoot.innerHTML = Object.entries(pack.slots).map(([name, slot]) => renderSlot(name, slot)).join('');
    renderResult();
    bind();
    status.textContent = `Revision ${snapshot.revision} · ${Object.keys(pack.slots).length} typed slots · world ${snapshot.views.world.status}`;
  }
  async function load() {
    const response = await fetch('/api/authoring');
    snapshot = await response.json();
    render();
  }
  document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
    const packMode = button.dataset.mode === 'pack';
    workshop.hidden = !packMode;
    if (packMode && snapshot) modeTitle.textContent = snapshot.editor.pack.form;
  }));
  load().catch((error) => { status.textContent = error.message; });
})();
