import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function verifyRelease(port, expectedSha, { timeoutMs = 5000 } = {}) {
  port = Number(port);
  assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535, 'Port deployment tidak valid.');
  assert.match(String(expectedSha || ''), /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i, 'ESORIA_EXPECTED_SHA harus berisi commit pipeline.');
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 60000, 'Timeout HTTP harus 100–60000 ms.');
  const base = `http://127.0.0.1:${port}`;
  async function json(endpoint) {
    const response = await fetch(base + endpoint, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    assert.ok(response.ok, `${endpoint} mengembalikan HTTP ${response.status}.`);
    return response.json();
  }
  const health = await json('/api/health');
  assert.equal(health.app, 'esoria-uts', 'Port tujuan bukan layanan ESORIA UTS.');
  assert.equal(health.status, 'ok', 'Layanan belum sehat.');
  assert.equal(health.database, 'ok', 'Database belum sehat.');
  const release = await json('/api/release');
  assert.equal(release.commit, expectedSha, 'Commit aplikasi tidak sesuai commit pipeline.');
  return { health: health.status, database: health.database, commit: release.commit };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const checked = await verifyRelease(process.argv[2], process.env.ESORIA_EXPECTED_SHA, {
      timeoutMs: Number(process.env.ESORIA_HTTP_TIMEOUT_MS || 5000)
    });
    console.log(`HTTP, layanan, database, dan commit rilis cocok: ${checked.commit}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
