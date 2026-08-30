'use strict';

(() => {
  const semantic = document.getElementById('semantic');
  const inspector = document.getElementById('inspector');
  if (!semantic || !inspector) return;

  let projection = null;
  let enhancing = false;

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function label(value) {
    return String(value ?? '')
      .split(/[/:]/).pop()
      .split('.').pop()
      .replaceAll('-', ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  async function currentProjection() {
    const response = await fetch('/api/authoring', { cache: 'no-store' });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? `request failed: ${response.status}`);
    projection = value;
    return value;
  }

  function relationRows(trace) {
    return trace.backward.map((step, index) => {
      const next = trace.backward[index + 1];
      const detail = [
        step.authored === true ? 'authored' : step.authored === false ? 'catalog' : null,
        step.role ? `role=${step.role}` : null,
        step.accepts ? `accepts=${step.accepts}` : null,
        step.count !== undefined ? `count=${step.count}` : null,
      ].filter(Boolean).join(' · ');
      return `<div class="trace-step" data-sw-kind="${esc(step.kind)}">
        <div><b>${esc(step.kind)}</b><span class="mono">${esc(step.id)}</span></div>
        ${detail ? `<small>${esc(detail)}</small>` : ''}
        ${next ? `<span class="trace-relation">${esc(step.relation)} ↓</span>` : ''}
      </div>`;
    }).join('');
  }

  function lifecycleRows(trace) {
    return `<div class="sw-lifecycle">${trace.lifecycle.map((step) => `<span class="pill" data-sw-stage="${esc(step.stage)}"><b>${esc(step.stage)}</b>${esc(step.id)}</span>`).join('')}</div>`;
  }

  function bindTraceActions(trace) {
    const openCard = inspector.querySelector('[data-open-source-card]');
    if (openCard) openCard.addEventListener('click', async () => {
      openCard.disabled = true;
      try {
        const response = await fetch(`/api/authoring/select-card?card=${encodeURIComponent(trace.card.id)}`, { cache: 'no-store' });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? `request failed: ${response.status}`);
        window.location.reload();
      } catch (error) {
        openCard.disabled = false;
        inspector.insertAdjacentHTML('beforeend', `<p class="muted">${esc(error.message)}</p>`);
      }
    });

    const openPack = inspector.querySelector('[data-open-source-pack]');
    if (openPack) openPack.addEventListener('click', () => document.querySelector('[data-mode="pack"]')?.click());

    const openResolution = inspector.querySelector('[data-open-resolution]');
    if (openResolution) openResolution.addEventListener('click', () => document.querySelector('[data-mode="resolution"]')?.click());
  }

  function inspectLanding(objectKey) {
    if (!projection) return;
    const world = projection.views?.world;
    const object = world?.objects?.[objectKey];
    const trace = projection.landing?.byObject?.[objectKey];
    if (!object || !trace) return;

    const cardAction = trace.card?.authored
      ? `<button type="button" data-open-source-card>Open authored Card</button>`
      : '<span class="pill"><b>source</b>catalog Template</span>';
    const packAction = trace.pack?.authored
      ? `<button type="button" data-open-source-pack>Open authored Pack</button>`
      : '<span class="pill"><b>pack</b>catalog Template</span>';

    inspector.innerHTML = `<h3>${esc(object.label)}</h3>
      <div class="mono">${esc(object.key)}</div>
      <div class="kv"><span>kind</span><b>${esc(object.kind)} · ${esc(object.stage)}</b></div>
      <div class="kv"><span>landed in</span><b>${esc(label(trace.region?.id))} / ${esc(trace.situation?.label)}</b></div>
      <div class="kv"><span>source</span><div>${cardAction} ${packAction} <button type="button" data-open-resolution>Resolution graph</button></div></div>
      <section class="trace-section"><p class="eyebrow">Backward custody</p><div class="trace-path">${relationRows(trace)}</div></section>
      <section class="trace-section"><p class="eyebrow">Lifecycle</p>${lifecycleRows(trace)}</section>
      <section class="trace-section"><p class="eyebrow">Requirement</p><div class="mono">${esc(JSON.stringify(trace.pack?.requirement ?? null, null, 2))}</div></section>`;
    bindTraceActions(trace);
  }

  async function enhanceWorld() {
    if (enhancing) return;
    const grid = semantic.querySelector('.world-grid');
    if (!grid || grid.dataset.lineageReady === '1') return;
    enhancing = true;
    try {
      const value = await currentProjection();
      if (!semantic.querySelector('.world-grid')) return;
      const world = value.views?.world;
      const landing = value.landing;
      if (!world || !landing) return;

      for (const situationButton of semantic.querySelectorAll('[data-world-object]')) {
        const situation = world.objects[situationButton.dataset.worldObject];
        if (!situation || situation.kind !== 'Situation') continue;
        const parent = situationButton.parentElement;
        for (const child of situation.children ?? []) {
          if (!landing.byObject?.[child.key]) continue;
          const member = world.objects[child.key];
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'lineage-member sw-object-link';
          button.dataset.swKind = member?.kind ?? 'Artifact';
          button.dataset.worldLineage = child.key;
          button.innerHTML = `<span>${esc(child.role ?? 'member')}</span><b>${esc(member?.label ?? child.label)}</b><small>${esc(member?.facts?.templateId ?? member?.grammar ?? '')}</small>`;
          button.addEventListener('click', () => inspectLanding(child.key));
          parent.appendChild(button);
        }
      }
      grid.dataset.lineageReady = '1';
    } catch (error) {
      inspector.innerHTML = `<h3>Lineage error</h3><p class="muted">${esc(error.message)}</p>`;
    } finally {
      enhancing = false;
    }
  }

  const observer = new MutationObserver(() => { enhanceWorld(); });
  observer.observe(semantic, { childList: true, subtree: true });
  enhanceWorld();
})();
