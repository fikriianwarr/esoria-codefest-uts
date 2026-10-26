import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/verify-release.mjs', import.meta.url));
const sha = 'a'.repeat(40);
async function check({ health = { status: 'ok', app: 'esoria-uts', database: 'ok' }, release = { commit: sha }, healthCode = 200, releaseCode = 200, hang = false, expected = sha } = {}) {
  const server = http.createServer((req, res) => {
    if (hang) return;
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = req.url === '/api/health' ? healthCode : releaseCode;
    res.end(JSON.stringify(req.url === '/api/health' ? health : release));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const child = spawn(process.execPath, [script, String(server.address().port)], {
      env: { ...process.env, ESORIA_EXPECTED_SHA: expected, ESORIA_HTTP_TIMEOUT_MS: hang ? '150' : '1000' }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', c => { output += c; });
    const timer = setTimeout(() => child.kill('SIGTERM'), 5000);
    const result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
    clearTimeout(timer);
    return { ...result, output };
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('pemeriksaan rilis menerima aplikasi, database, HTTP dan commit yang sesuai', async () => {
  const r = await check(); assert.equal(r.code, 0, r.output); assert.equal(r.signal, null);
});
test('pemeriksaan rilis menolak database tidak sehat walaupun status utama ok', async () => {
  const r = await check({ health: { status: 'ok', app: 'esoria-uts', database: 'error' } }); assert.notEqual(r.code, 0);
});
test('pemeriksaan rilis menolak HTTP 503 dari endpoint release meski SHA cocok', async () => {
  const r = await check({ releaseCode: 503 }); assert.notEqual(r.code, 0);
});
test('pemeriksaan rilis menolak aplikasi lain di port yang sama', async () => {
  const r = await check({ health: { status: 'ok', app: 'aplikasi-lain', database: 'ok' } }); assert.notEqual(r.code, 0);
});
test('pemeriksaan rilis menolak commit yang berbeda', async () => {
  const r = await check({ release: { commit: 'b'.repeat(40) } }); assert.notEqual(r.code, 0);
});
test('pemeriksaan rilis tidak menggantung ketika endpoint tidak merespons', async () => {
  const r = await check({ hang: true }); assert.notEqual(r.code, 0); assert.equal(r.signal, null, 'Script harus menghentikan fetch sendiri sebelum batas waktu proses uji.');
});
