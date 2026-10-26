import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { checkRuntime } from '../scripts/check-runtime.mjs';

async function fixture(fn, { healthy = true, volume = true, commit = 'a'.repeat(40) } = {}) {
  const server = http.createServer((req, res) => {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>ESORIA CodeFest</title>'); }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/api/health' ? { app: 'esoria-uts', status: 'ok', database: 'ok' } : { commit }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const run = async (_command, args) => {
    const format = args[args.indexOf('--format') + 1]; let output = '';
    if (args.includes('ps')) output = 'a'.repeat(64);
    else if (args[0] === 'inspect') {
      if (format.includes('.State')) output = JSON.stringify({ Running: true, Health: { Status: healthy ? 'healthy' : 'unhealthy' } });
      if (format.includes('.NetworkSettings.Ports')) output = JSON.stringify({ '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: String(server.address().port) }] });
      if (format.includes('.Mounts')) output = JSON.stringify(volume ? [{ Type: 'volume', Name: 'esoria_uts_data', Destination: '/app/data' }] : []);
      if (format.includes('.Image')) output = JSON.stringify(`sha256:${'b'.repeat(64)}`);
    }
    return { code: 0, output };
  };
  try { await fn(run); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('pemeriksaan runtime memakai port aktual Docker dan tidak mengarang bukti restart', async () => {
  await fixture(async run => {
    const r = await checkRuntime({ run, expectedSha: 'a'.repeat(40), env: {} });
    assert.equal(r.health, 'healthy'); assert.equal(r.database, 'ok'); assert.equal(r.commitComparedToPipeline, true);
    assert.equal(r.persistenceAfterRestart, 'requires_before_after_test');
  });
});
test('pemeriksaan runtime menolak container unhealthy sebelum memberi hasil sukses', async () => {
  await fixture(async run => { await assert.rejects(() => checkRuntime({ run, env: {} }), /belum healthy/); }, { healthy: false });
});
test('pemeriksaan runtime menolak penyimpanan yang tidak memakai volume ESORIA', async () => {
  await fixture(async run => { await assert.rejects(() => checkRuntime({ run, env: {} }), /named volume/); }, { volume: false });
});
test('pemeriksaan runtime menolak commit yang berbeda dari pipeline', async () => {
  await fixture(async run => { await assert.rejects(() => checkRuntime({ run, env: {}, expectedSha: 'c'.repeat(40) }), /berbeda/); });
});
