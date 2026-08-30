'use strict';

(() => {
  const workshop = document.getElementById('documentWorkshop');
  if (!workshop) return;

  const text = document.getElementById('documentText');
  const reload = document.getElementById('reloadDocument');
  const importButton = document.getElementById('importDocument');
  const status = document.getElementById('documentStatus');
  const meta = document.getElementById('documentMeta');

  function describe(value) {
    try {
      const document = JSON.parse(value);
      return `${document.format ?? 'unknown'} v${document.version ?? '?'} · ${Object.keys(document.cards ?? {}).length} Cards · ${Object.keys(document.packs ?? {}).length} Packs`;
    } catch (_) {
      return 'invalid JSON text';
    }
  }

  async function loadDocument() {
    status.textContent = 'Exporting authored truth…';
    try {
      const response = await fetch('/api/authoring/document.txt', { cache: 'no-store' });
      const value = await response.text();
      if (!response.ok) throw new Error(value || `HTTP ${response.status}`);
      text.value = value;
      meta.textContent = describe(value);
      status.textContent = 'Current Card + Pack authored truth exported. Runtime state is not included.';
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function importDocument() {
    status.textContent = 'Validating whole document…';
    try {
      const response = await fetch('/api/authoring/document', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: text.value,
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`);
      status.textContent = `Imported as authoring revision ${value.revision}. Rebuilding views…`;
      sessionStorage.setItem('small-world-document-open', '1');
      window.location.reload();
    } catch (error) {
      status.textContent = error.message;
      meta.textContent = describe(text.value);
    }
  }

  reload.addEventListener('click', loadDocument);
  importButton.addEventListener('click', importDocument);
  text.addEventListener('input', () => { meta.textContent = describe(text.value); });
  workshop.addEventListener('toggle', () => {
    if (workshop.open && !text.value) loadDocument();
  });

  if (sessionStorage.getItem('small-world-document-open') === '1') {
    sessionStorage.removeItem('small-world-document-open');
    workshop.open = true;
    loadDocument();
  }
})();
