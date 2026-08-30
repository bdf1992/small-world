'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { resolveWorld, DEFAULTS } = require('../src/app/world');
const { createSimulationSession } = require('../src/app/simulation');

const WEB_ROOT = path.join(__dirname, '..', 'web');

function integerParam(searchParams, name, fallback) {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
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
  res.writeHead(status, {
    'content-type': `${contentType}; charset=utf-8`,
    'cache-control': 'no-store',
  });
  res.end(body);
}

function sendJson(res, status, value) {
  return send(res, status, JSON.stringify(value), 'application/json');
}

function serveFile(res, filename, contentType) {
  const file = path.join(WEB_ROOT, filename);
  fs.readFile(file, 'utf8', (error, body) => {
    if (error) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, body, contentType);
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
  if (action === 'select') {
    return session.select({
      zone: integerParam(url.searchParams, 'zone', -1),
      id: integerParam(url.searchParams, 'id', -1),
    });
  }
  throw new Error(`unknown simulation action: ${action}`);
}

function createWorkbenchServer({ simulation = createSimulationSession({ seed: DEFAULTS.seed }) } = {}) {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/world') {
        return sendJson(res, 200, resolveWorld(parseWorldRequest(url)));
      }
      if (url.pathname === '/api/simulation') return sendJson(res, 200, simulation.snapshot());
      if (url.pathname.startsWith('/api/simulation/')) {
        return sendJson(res, 200, applySimulationAction(simulation, url));
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return serveFile(res, 'parity.html', 'text/html');
      }
      if (url.pathname === '/classic') return serveFile(res, 'index.html', 'text/html');
      if (url.pathname === '/parity.js') return serveFile(res, 'parity.js', 'text/javascript');
      if (url.pathname === '/parity.css') return serveFile(res, 'parity.css', 'text/css');
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
    console.log(`Small World parity workbench: http://127.0.0.1:${address.port}`);
    console.log('The legacy M0.5 mechanics are behind the application session; browser code owns presentation only.');
    console.log('Press Ctrl+C to stop.');
  });
}

if (require.main === module) main();

module.exports = {
  createWorkbenchServer,
  parseWorldRequest,
  integerParam,
  applySimulationAction,
};
