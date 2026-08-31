'use strict';

const COLORS = ['#35234f','#e75b38','#b64396','#b88a53','#67ddcf','#3577bc','#d7a52c','#82c6e9'];
let state = null;
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

async function request(action = '', params = {}) {
  const query = new URLSearchParams(params);
  const suffix = action ? `/${action}` : '';
  const response = await fetch(`/api/profile${suffix}${query.size ? `?${query}` : ''}`, { method: action ? 'POST' : 'GET' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `profile request failed: ${response.status}`);
  state = payload;
  render();
  return payload;
}

function contributionText(entry) {
  return `${entry.origin}:${entry.role} ×${Number(entry.weight).toFixed(2)}`;
}

function renderWeights() {
  $('weights').innerHTML = state.ring.map((element, index) => `
    <div class="weight-row">
      <i style="background:${COLORS[index]}"></i>
      <label for="weight-${element}">${element}</label>
      <input id="weight-${element}" data-element="${element}" type="number" min="0" step="0.1" value="${Number(state.composition[element] ?? 0)}">
    </div>`).join('');

  for (const input of document.querySelectorAll('[data-element]')) {
    input.addEventListener('change', () => request('set-weight', { element: input.dataset.element, weight: input.value }).catch(showError));
  }
}

function renderDeformation() {
  const select = $('deformOrigin');
  select.innerHTML = state.ring.map((element) => `<option value="${element}"${element === state.deformation.origin ? ' selected' : ''}>${element}</option>`).join('');
  $('deformFactor').value = Number(state.deformation.factor);
  $('trace').innerHTML = state.trace.map((entry) => `<div class="trace-line">${escapeHtml(entry.source)} · ${entry.origin} × ${entry.factor} · ${entry.before.toFixed(2)} → ${entry.after.toFixed(2)}</div>`).join('') || '<div class="small">No deformation trace.</div>';
}

function renderMeasurement() {
  const base = Object.entries(state.measurement.baseComposition).map(([name, weight]) => `${name} ${weight}`).join(' · ');
  const effective = Object.entries(state.measurement.effectiveComposition).map(([name, weight]) => `${name} ${Number(weight).toFixed(2)}`).join(' · ');
  $('measurement').innerHTML = `
    <div class="measure"><span class="small">measured at</span><b>${escapeHtml(state.measurement.at)}</b></div>
    <div class="measure"><span class="small">changed</span><b>${state.measurement.changed ? 'YES' : 'NO'}</b></div>
    <div class="measure"><span class="small">base Identity</span><b>${escapeHtml(base)}</b></div>
    <div class="measure"><span class="small">effective reading</span><b>${escapeHtml(effective)}</b></div>`;
  $('changed').textContent = state.measurement.changed ? 'effective ≠ base' : 'effective = base';
}

function renderMatrix() {
  const rows = [
    '<div class="head">target</div><div class="head">base Profile</div><div class="head effective-head">effective Profile</div>',
  ];
  for (const [index, element] of state.ring.entries()) {
    const base = state.base.byElement[element] ?? [];
    const effective = state.effective.byElement[element] ?? [];
    const effectiveByOrigin = Object.fromEntries(effective.map((entry) => [entry.origin, entry]));
    rows.push(`<div class="element" style="color:${COLORS[index]}">${element}</div>`);
    rows.push(`<div>${base.map((entry) => `<span class="contrib">${escapeHtml(contributionText(entry))}</span>`).join('')}</div>`);
    rows.push(`<div class="effective-cell">${effective.map((entry) => {
      const prior = base.find((candidate) => candidate.origin === entry.origin);
      const changed = prior && Number(prior.weight) !== Number(entry.weight);
      return `<span class="contrib${changed ? ' changed' : ''}">${escapeHtml(contributionText(entry))}</span>`;
    }).join('')}</div>`);
    void effectiveByOrigin;
  }
  $('matrix').innerHTML = rows.join('');
}

function drawWheel() {
  const canvas = $('wheel');
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const focus = state.deformation.origin;
  const maxWeight = Math.max(1, ...state.ring.map((element) => Math.max(Number(state.base.composition[element] ?? 0), Number(state.effective.composition[element] ?? 0))));

  ctx.clearRect(0,0,size,size);
  ctx.fillStyle = '#09070c';
  ctx.fillRect(0,0,size,size);

  ctx.strokeStyle = '#31283a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx,cy,radius,0,Math.PI*2);
  ctx.stroke();

  for (let i = 0; i < state.ring.length; i += 1) {
    const angle = -Math.PI/2 + i * Math.PI*2/state.ring.length;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const element = state.ring[i];
    const baseWeight = Number(state.base.composition[element] ?? 0);
    const effectiveWeight = Number(state.effective.composition[element] ?? 0);
    const baseSize = 8 + 28 * Math.sqrt(baseWeight / maxWeight);
    const effectiveSize = 5 + 22 * Math.sqrt(effectiveWeight / maxWeight);

    ctx.strokeStyle = '#4f4557';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(x,y);
    ctx.stroke();

    if (baseWeight > 0) {
      ctx.strokeStyle = '#7d7085';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x,y,baseSize,0,Math.PI*2);
      ctx.stroke();
    }
    if (effectiveWeight > 0) {
      ctx.fillStyle = COLORS[i];
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.arc(x,y,effectiveSize,0,Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const relation = (state.effective.byElement[element] ?? []).find((entry) => entry.origin === focus);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#eee8f5';
    ctx.font = '600 14px ui-monospace';
    ctx.fillText(element, x, y + (y < cy ? -48 : 48));
    ctx.fillStyle = '#93879c';
    ctx.font = '11px ui-monospace';
    if (relation) ctx.fillText(`${relation.role} · ${focus}`, x, y + (y < cy ? -30 : 30));
    if (baseWeight || effectiveWeight) {
      ctx.fillStyle = '#d6c9df';
      ctx.font = '10px ui-monospace';
      ctx.fillText(`${baseWeight.toFixed(1)} → ${effectiveWeight.toFixed(1)}`, x, y);
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ece8f2';
  ctx.font = '600 15px ui-monospace';
  ctx.fillText('weighted wheel overlay', cx, cy - 8);
  ctx.fillStyle = '#8e8496';
  ctx.font = '11px ui-monospace';
  ctx.fillText(`focus origin ${focus} · Property scale ×${Number(state.deformation.factor).toFixed(2)}`, cx, cy + 14);

  const baseText = Object.entries(state.base.composition).map(([name, weight]) => `${name} ${weight}`).join(' + ');
  const effectiveText = Object.entries(state.effective.composition).map(([name, weight]) => `${name} ${Number(weight).toFixed(2)}`).join(' + ');
  $('wheelReadout').innerHTML = `<b>Base</b> ${escapeHtml(baseText)}<br><b>Effective</b> ${escapeHtml(effectiveText)}<br>Node labels show the canonical relation role when the current deformation origin is treated as <b>Is</b>. Every other positive origin overlays the same wheel independently.`;
}

function render() {
  if (!state) return;
  $('revision').textContent = `rev ${state.revision}`;
  renderWeights();
  renderDeformation();
  renderMeasurement();
  renderMatrix();
  drawWheel();
}

function showError(error) {
  console.error(error);
  $('changed').textContent = error.message;
}

$('reset').onclick = () => request('reset').catch(showError);
$('applyDeformation').onclick = () => request('set-deformation', {
  origin: $('deformOrigin').value,
  factor: $('deformFactor').value,
}).catch(showError);

request().catch(showError);
