const { test, before, after } = require('node:test');
const assert = require('node:assert');

let srv;
let port;

before(async () => {
  srv = require('../server/app').createGameServer();
  await new Promise((r) => srv.httpServer.listen(0, r));
  port = srv.httpServer.address().port;
});

after(() => new Promise((r) => srv.httpServer.close(r)));

test('GET / returns the landing page', async () => {
  const res = await fetch(`http://localhost:${port}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /云喝酒/);
});

test('GET /vendor/three/three.module.js serves three.js', async () => {
  const res = await fetch(`http://localhost:${port}/vendor/three/three.module.js`);
  assert.equal(res.status, 200);
});
