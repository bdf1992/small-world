'use strict';

(() => {
  const workshop = document.getElementById('cardWorkshop');
  if (!workshop) return;

  const select = document.getElementById('cardSelect');
  const idInput = document.getElementById('cardId');
  const grammar = document.getElementById('cardGrammar');
  const fields = document.getElementById('cardFields');
  const preview = document.getElementById('cardPreview');
  const status = document.getElementById('cardStatus');
  const modeTitle = document.getElementById('modeTitle');
  const newButton = document.getElementById('newCard');
  const cloneButton = document.getElementById('cloneCard');
  const renameButton = document.getElementById('renameCard');
  const deleteButton = document.getElementById('deleteCard');

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
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null) search.set(key, String(value));
    }
    return search.toString();
  }

  async function action(name, params = {}) {
    status.textContent = 'Compiling Card…';
    const response = await fetch(`/api/authoring/${name}?${query(params)}`);
    const body = await response.json();
    if (!response.ok) {
      status.textContent = body.error ?? 'Card operation failed';
      throw new Error(status.textContent);
    }
    window.location.reload();
  }

  function identity(instance) {
    return instance?.properties?.species
      ?? instance?.properties?.form
      ?? instance?.properties?.terrain
      ?? instance?.id
      ?? 'Instance';
  }

  function renderPreview() {
    const virtual = snapshot.preview?.virtual;
    const instance = snapshot.preview?.instance;
    if (!virtual || !instance) {
      preview.innerHTML = '<p class="muted">No compiled preview.</p>';
      return;
    }
    const possibility = Object.entries(virtual.possibilities ?? {}).map(([field, candidates]) => {
      const values = Object.entries(candidates ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
      return `<div class="preview-line"><b>${esc(field)}</b><span>${values.map(([name, weight]) => `${esc(name)} ${(Number(weight) * 100).toFixed(0)}%`).join(' · ')}</span></div>`;
    }).join('');
    preview.innerHTML = `
      <div class="preview-stage"><span>Reference</span><code>${esc(snapshot.preview.reference?.id)}</code></div>
      <div class="preview-stage"><span>Virtual</span><code>${esc(virtual.id)}</code></div>
      <div class="preview-possibilities">${possibility}</div>
      <div class="preview-stage resolved"><span>Instance</span><strong>${esc(identity(instance))}</strong></div>
      <div class="preview-line"><b>element</b><span>${esc(instance.attributes?.element ?? '—')}</span></div>
      <div class="preview-line"><b>rarity</b><span>${esc(instance.rarity ?? '—')}</span></div>
      <div class="preview-line"><b>id</b><code>${esc(instance.id)}</code></div>`;
  }

  function renderFields() {
    const cardId = snapshot.editor.selectedCardId;
    const draft = snapshot.draft.cards[cardId];
    const fixed = Object.entries(draft.fixed ?? {}).map(([field, value]) => `
      <label class="card-field"><span>${esc(field)}</span><input type="text" data-fixed="${esc(field)}" value="${esc(value)}"></label>`).join('');

    const contextual = Object.entries(draft.priors ?? {}).filter(([, prior]) => prior?.source === 'context').map(([field, prior]) => `
      <label class="card-field"><span>${esc(field)} affinity</span>
        <select data-affinity="${esc(field)}">
          ${['weak', 'medium', 'strong'].map((value) => `<option value="${value}" ${value === prior.affinity ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
      </label>`).join('');

    const weighted = Object.entries(draft.priors ?? {}).filter(([, prior]) => prior?.source !== 'context').map(([field, prior]) => `
      <section class="weight-group"><h4>${esc(field)}</h4>${Object.entries(prior).map(([candidate, weight]) => `
        <label class="weight-row"><span>${esc(candidate)}</span><input type="number" min="0" step="0.01" data-weight-field="${esc(field)}" data-candidate="${esc(candidate)}" value="${Number(weight)}"></label>`).join('')}</section>`).join('');

    fields.innerHTML = `${fixed}${contextual}${weighted}`;

    fields.querySelectorAll('[data-fixed]').forEach((input) => input.addEventListener('change', () => action('set-card-fixed', {
      card: cardId,
      field: input.dataset.fixed,
      value: input.value,
    }).catch(() => {})));
    fields.querySelectorAll('[data-affinity]').forEach((input) => input.addEventListener('change', () => action('set-card-affinity', {
      card: cardId,
      field: input.dataset.affinity,
      affinity: input.value,
    }).catch(() => {})));
    fields.querySelectorAll('[data-weight-field]').forEach((input) => input.addEventListener('change', () => action('set-card-weight', {
      card: cardId,
      field: input.dataset.weightField,
      candidate: input.dataset.candidate,
      weight: input.value,
    }).catch(() => {})));
  }

  function renderLibrary() {
    const cards = Object.values(snapshot.editor.cards ?? {});
    select.innerHTML = cards.map((card) => `<option value="${esc(card.id)}" ${card.id === snapshot.editor.selectedCardId ? 'selected' : ''}>${esc(card.label)} · ${esc(card.grammar.replace('Artifact/', ''))}${card.canonical ? ' · canonical' : ''}</option>`).join('');
    const selected = snapshot.editor.cards[snapshot.editor.selectedCardId];
    grammar.value = selected?.grammar ?? 'Artifact/Persona';
    deleteButton.disabled = Boolean(selected?.canonical);
    renameButton.disabled = Boolean(selected?.canonical);
    modeTitle.textContent = selected?.label ?? snapshot.editor.selectedCardId;
    idInput.placeholder = `${snapshot.editor.selectedCardId}-copy`;
    status.textContent = `Revision ${snapshot.revision} · ${cards.length} Card${cards.length === 1 ? '' : 's'} · ${selected?.valid ? 'valid' : 'invalid'}`;
  }

  function render() {
    renderLibrary();
    renderFields();
    renderPreview();
  }

  async function load() {
    const response = await fetch('/api/authoring');
    snapshot = await response.json();
    render();
  }

  select.addEventListener('change', () => action('select-card', { card: select.value }).catch(() => {}));
  newButton.addEventListener('click', () => action('create-card', { id: idInput.value, grammar: grammar.value }).catch(() => {}));
  cloneButton.addEventListener('click', () => action('clone-card', { card: snapshot.editor.selectedCardId, id: idInput.value }).catch(() => {}));
  renameButton.addEventListener('click', () => action('rename-card', { card: snapshot.editor.selectedCardId, id: idInput.value }).catch(() => {}));
  deleteButton.addEventListener('click', () => action('delete-card', { card: snapshot.editor.selectedCardId }).catch(() => {}));

  document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
    const cardMode = button.dataset.mode === 'card';
    workshop.hidden = !cardMode;
    if (cardMode && snapshot) modeTitle.textContent = snapshot.editor.cards[snapshot.editor.selectedCardId]?.label ?? snapshot.editor.selectedCardId;
  }));

  load().catch((error) => { status.textContent = error.message; });
})();
