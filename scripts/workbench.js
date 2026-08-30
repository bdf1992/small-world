'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { resolveWorld, DEFAULTS } = require('../src/app/world');
const { createSimulationSession } = require('../src/app/simulation');
const { createResolutionAuthoringSession } = require('../src/app/resolution-session');

const WEB_ROOT = path.join(__dirname, '..', 'web');

function integerParam(searchParams, name, fallback) {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}
function numberParam(searchParams, name) {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') throw new Error(`${name} is required`);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}
function textParam(searchParams, name) {
  const value = searchParams.get(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function parseWorldRequest(url) {
  return {
    seed: integerParam(url.searchParams, 'seed', DEFAULTS.seed),
    budget: {
      maxHops: integerParam(url.searchParams, 'hops', DEFAULTS.budget.maxHops),
      maxSlots: integerParam(url.searchParams, 'slots', DEFAULTS.budget.maxSlots),
      maxInstances: integerParam(url.searchParams, 'instances', DEFAULTS.budget.maxInstances),
    },
  };
}
function send(res, status, body, contentType) {
  res.writeHead(status, { 'content-type': `${contentType}; charset=utf-8`, 'cache-control': 'no-store' });
  res.end(body);
}
function sendJson(res, status, value) { return send(res, status, JSON.stringify(value), 'application/json'); }
function serveFile(res, filename, contentType) {
  fs.readFile(path.join(WEB_ROOT, filename), 'utf8', (error, body) => {
    if (error) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, body, contentType);
  });
}
function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('request body exceeds 1 MiB Authoring Document limit'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function applySimulationAction(session, url) {
  const action = url.pathname.slice('/api/simulation/'.length);
  if (!action || action === 'snapshot') return session.snapshot();
  if (action === 'reset') return session.reset(integerParam(url.searchParams, 'seed', session.seed));
  if (action === 'step') return session.step();
  if (action === 'finish') return session.finish();
  if (action === 'replay') return session.replay();
  if (action === 'dive') return session.dive();
  if (action === 'back') return session.back();
  if (action === 'advance') return session.advance();
  if (action === 'flip-clock') return session.flipClock();
  if (action === 'spend') return session.spend();
  if (action === 'flip-hourglass') return session.flipHourglass();
  if (action === 'select') return session.select({ zone: integerParam(url.searchParams, 'zone', -1), id: integerParam(url.searchParams, 'id', -1) });
  throw new Error(`unknown simulation action: ${action}`);
}

function applyAuthoringAction(session, url) {
  const action = url.pathname.slice('/api/authoring/'.length);
  if (!action || action === 'snapshot') return session.snapshot();
  if (action === 'reset') return session.reset(integerParam(url.searchParams, 'seed', session.seed));
  if (action === 'set-budget') {
    return session.setBudget({
      maxHops: integerParam(url.searchParams, 'hops', session.budget.maxHops),
      maxSlots: integerParam(url.searchParams, 'slots', session.budget.maxSlots),
      maxInstances: integerParam(url.searchParams, 'instances', session.budget.maxInstances),
    });
  }
  if (action === 'reset-budget') return session.resetBudget();
  if (action === 'select-card') return session.selectCard({ cardId: textParam(url.searchParams, 'card') });
  if (action === 'create-card') return session.createCard({ grammar: url.searchParams.get('grammar') ?? 'Artifact/Persona', id: textParam(url.searchParams, 'id') });
  if (action === 'clone-card') return session.cloneCard({ cardId: url.searchParams.get('card') ?? session.selectedCardId, newId: textParam(url.searchParams, 'id') });
  if (action === 'rename-card') return session.renameCard({ cardId: url.searchParams.get('card') ?? session.selectedCardId, newId: textParam(url.searchParams, 'id') });
  if (action === 'delete-card') return session.deleteCard({ cardId: url.searchParams.get('card') ?? session.selectedCardId });
  if (action === 'set-card-fixed') return session.setCardFixed({ cardId: url.searchParams.get('card') ?? session.selectedCardId, field: textParam(url.searchParams, 'field'), value: textParam(url.searchParams, 'value') });
  if (action === 'set-card-weight') return session.setCardWeight({ cardId: url.searchParams.get('card') ?? session.selectedCardId, field: textParam(url.searchParams, 'field'), candidate: textParam(url.searchParams, 'candidate'), weight: numberParam(url.searchParams, 'weight') });
  if (action === 'set-card-affinity') return session.setCardAffinity({ cardId: url.searchParams.get('card') ?? session.selectedCardId, field: url.searchParams.get('field') ?? 'element', affinity: textParam(url.searchParams, 'affinity') });
  if (action === 'connect-card') return session.connectCard({ slot: textParam(url.searchParams, 'slot'), cardId: url.searchParams.get('card') ?? session.selectedCardId, weight: numberParam(url.searchParams, 'weight') });
  if (action === 'disconnect-card') return session.disconnectCard({ slot: textParam(url.searchParams, 'slot'), cardId: url.searchParams.get('card') ?? session.selectedCardId });
  if (action === 'set-pack-candidate-weight') return session.setPackCandidateWeight({ slot: textParam(url.searchParams, 'slot'), cardId: textParam(url.searchParams, 'card'), weight: numberParam(url.searchParams, 'weight') });
  if (action === 'focus-pack-candidate') return session.focusPackCandidate({ slot: textParam(url.searchParams, 'slot'), cardId: textParam(url.searchParams, 'card') });
  if (action === 'set-weight') return session.setWeight({ target: textParam(url.searchParams, 'target'), field: textParam(url.searchParams, 'field'), candidate: textParam(url.searchParams, 'candidate'), weight: numberParam(url.searchParams, 'weight') });
  if (action === 'set-affinity') return session.setAffinity({ field: url.searchParams.get('field') ?? 'element', affinity: textParam(url.searchParams, 'affinity') });
  throw new Error(`unknown authoring action: ${action}`);
}

function createWorkbenchServer({
  simulation = createSimulationSession({ seed: DEFAULTS.seed }),
  authoring = createResolutionAuthoringSession({ seed: DEFAULTS.seed }),
} = {}) {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/world') return sendJson(res, 200, resolveWorld(parseWorldRequest(url)));
      if (url.pathname === '/api/authoring/document' && req.method === 'GET') return sendJson(res, 200, authoring.exportDocument());
      if (url.pathname === '/api/authoring/document.txt' && req.method === 'GET') return send(res, 200, authoring.serializeDocument(), 'application/json');
      if (url.pathname === '/api/authoring/document' && req.method === 'POST') {
        return readBody(req)
          .then((body) => sendJson(res, 200, authoring.importDocument(body)))
          .catch((error) => sendJson(res, 400, { error: error.message }));
      }
      if (url.pathname === '/api/authoring') {
        const requestedSeed = integerParam(url.searchParams, 'seed', authoring.seed);
        if (requestedSeed !== authoring.seed) return sendJson(res, 200, authoring.reset(requestedSeed));
        return sendJson(res, 200, authoring.snapshot());
      }
      if (url.pathname.startsWith('/api/authoring/')) return sendJson(res, 200, applyAuthoringAction(authoring, url));
      if (url.pathname === '/api/simulation') return sendJson(res, 200, simulation.snapshot());
      if (url.pathname.startsWith('/api/simulation/')) return sendJson(res, 200, applySimulationAction(simulation, url));
      if (url.pathname === '/' || url.pathname === '/index.html') return serveFile(res, 'parity.html', 'text/html');
      if (url.pathname === '/authoring') return serveFile(res, 'authoring.html', 'text/html');
      if (url.pathname === '/classic') return serveFile(res, 'index.html', 'text/html');
      if (url.pathname === '/parity.js') return serveFile(res, 'parity.js', 'text/javascript');
      if (url.pathname === '/inspector.js') return serveFile(res, 'inspector.js', 'text/javascript');
      if (url.pathname === '/parity.css') return serveFile(res, 'parity.css', 'text/css');
      if (url.pathname === '/authoring.js') return serveFile(res, 'authoring.js', 'text/javascript');
      if (url.pathname === '/card-editor.js') return serveFile(res, 'card-editor.js', 'text/javascript');
      if (url.pathname === '/pack-editor.js') return serveFile(res, 'pack-editor.js', 'text/javascript');
      if (url.pathname === '/resolution-editor.js') return serveFile(res, 'resolution-editor.js', 'text/javascript');
      if (url.pathname === '/document-editor.js') return serveFile(res, 'document-editor.js', 'text/javascript');
      if (url.pathname === '/world-lineage.js') return serveFile(res, 'world-lineage.js', 'text/javascript');
      if (url.pathname === '/authoring.css') return serveFile(res, 'authoring.css', 'text/css');
      if (url.pathname === '/card-editor.css') return serveFile(res, 'card-editor.css', 'text/css');
      if (url.pathname === '/pack-editor.css') return serveFile(res, 'pack-editor.css', 'text/css');
      if (url.pathname === '/resolution-editor.css') return serveFile(res, 'resolution-editor.css', 'text/css');
      if (url.pathname === '/document-editor.css') return serveFile(res, 'document-editor.css', 'text/css');
      if (url.pathname === '/world-lineage.css') return serveFile(res, 'world-lineage.css', 'text/css');
      if (url.pathname === '/app.js') return serveFile(res, 'app.js', 'text/javascript');
      if (url.pathname === '/style.css') return serveFile(res, 'style.css', 'text/css');
      return send(res, 404, 'not found', 'text/plain');
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  });
}

function main() {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid integer port');
  const server = createWorkbenchServer();
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    console.log(`Small World workbench: http://127.0.0.1:${address.port}`);
    console.log(`Authoring & Resolution: http://127.0.0.1:${address.port}/authoring`);
    console.log('Card and Pack edits change authored revision; Hops / Slots / Instances change only resolution revision.');
    console.log('Authoring Document export/import is plain-data JSON and excludes runtime/lifecycle state.');
    console.log('World landing traces realized objects backward to Card / Pack / Requirement / Region custody.');
    console.log('Press Ctrl+C to stop.');
  });
}

if (require.main === module) main();
module.exports = { createWorkbenchServer, parseWorldRequest, integerParam, numberParam, textParam, readBody, applySimulationAction, applyAuthoringAction };
