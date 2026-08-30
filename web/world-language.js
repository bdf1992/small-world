'use strict';

(() => {
  const modeDomain = Object.freeze({
    card: 'authoring',
    pack: 'authoring',
    graph: 'evidence',
    resolution: 'resolution',
    world: 'world',
  });

  function syncAuthoringDomain() {
    const panel = document.querySelector('.main-panel[data-sw-domain]');
    if (!panel) return;
    const active = document.querySelector('.modes [data-mode].active');
    const mode = active?.dataset?.mode;
    if (modeDomain[mode]) panel.dataset.swDomain = modeDomain[mode];
  }

  function observeAuthoringModes() {
    const buttons = [...document.querySelectorAll('.modes [data-mode]')];
    if (!buttons.length) return;
    const observer = new MutationObserver(syncAuthoringDomain);
    for (const button of buttons) observer.observe(button, { attributes: true, attributeFilter: ['class'] });
    for (const button of buttons) button.addEventListener('click', () => queueMicrotask(syncAuthoringDomain));
    syncAuthoringDomain();
  }

  function stampDeclaredObjects() {
    document.querySelectorAll('.world-card:not([data-sw-kind])').forEach((card) => {
      card.classList.add('sw-object');
      card.dataset.swKind = 'Region';
    });
    document.querySelectorAll('.lineage-member:not(.sw-object-link)').forEach((button) => {
      button.classList.add('sw-object-link');
      button.dataset.swKind = 'Artifact';
    });
  }

  function observeProjectedObjects() {
    const semantic = document.getElementById('semantic');
    if (!semantic) return;
    const observer = new MutationObserver(stampDeclaredObjects);
    observer.observe(semantic, { childList: true, subtree: true });
    stampDeclaredObjects();
  }

  function start() {
    observeAuthoringModes();
    observeProjectedObjects();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
