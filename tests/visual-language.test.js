'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }

function main() {
  const parity = read('web/parity.html');
  const authoring = read('web/authoring.html');
  const css = read('web/world-language.css');
  const js = read('web/world-language.js');
  const lineage = read('web/world-lineage.js');

  assert.match(parity, /href="\/world-language\.css"/);
  assert.match(authoring, /href="\/world-language\.css"/);
  assert.match(authoring, /src="\/world-language\.js"/);

  for (const domain of ['world', 'instrument', 'authoring', 'resolution', 'evidence', 'dynamic']) {
    assert.ok(css.includes(`data-sw-domain="${domain}"`), `visual language missing ${domain} domain`);
  }

  for (const domain of ['world', 'instrument', 'resolution', 'evidence', 'dynamic']) {
    assert.ok(parity.includes(`data-sw-domain="${domain}"`), `playable world missing ${domain} declaration`);
  }
  for (const domain of ['authoring', 'resolution', 'evidence']) {
    assert.ok(authoring.includes(`data-sw-domain="${domain}"`), `authoring surface missing ${domain} declaration`);
  }

  assert.match(js, /card:\s*'authoring'/);
  assert.match(js, /pack:\s*'authoring'/);
  assert.match(js, /graph:\s*'evidence'/);
  assert.match(js, /resolution:\s*'resolution'/);
  assert.match(js, /world:\s*'world'/);
  assert.doesNotMatch(js, /\bfetch\s*\(/, 'visual synchronizer must not call application endpoints');
  assert.doesNotMatch(js, /\/api\//, 'visual synchronizer must remain transport-neutral presentation code');

  assert.match(lineage, /data-sw-kind=/);
  assert.match(lineage, /sw-object-link/);
  assert.match(lineage, /sw-lifecycle/);
  assert.match(lineage, /data-sw-stage=/);

  assert.match(css, /content:attr\(data-sw-domain\)/);
  assert.match(css, /\.sw-frame\[data-sw-domain="instrument"\] canvas/);
  assert.match(css, /\.sw-frame\[data-sw-domain="resolution"\]/);

  console.log(JSON.stringify({
    pass: true,
    domains: ['world', 'instrument', 'authoring', 'resolution', 'evidence', 'dynamic'],
    presentationOnlySynchronizer: true,
    lineageHooks: true,
  }, null, 2));
}

main();
