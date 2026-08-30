'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { resolveWorld, DEFAULTS } = require('../src/app/world');

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

function serveFile(res, filename, contentType) {
  const file = path.join(WEB_ROOT, filename);
  fs.readFile(file, 'utf8', (error, body) => {
    if (error) return send(res, 404, 'not found', 'text/plain');
    return send(res, 200, body, contentType);
  });
}

function createWorkbenchServer() {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/world') {
        const result = resolveWorld(parseWorldRequest(url));
        return send(res, 200, JSON.stringify(result), 'application/json');
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return serveFile(res, 'index.html', 'text/html');
      }
      if (url.pathname === '/app.js') return serveFile(res, 'app.js', 'text/javascript');
      if (url.pathname === '/style.css') return serveFile(res, 'style.css', 'text/css');
      return send(res, 404, 'not found', 'text/plain');
    } catch (error) {
      return send(res, 400, JSON.stringify({ error: error.message }), 'application/json');
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
    console.log('Press Ctrl+C to stop.');
  });
}

if (require.main === module) main();

module.exports = { createWorkbenchServer, parseWorldRequest, integerParam };
