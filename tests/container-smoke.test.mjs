import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApplication } from '../app/server.mjs';

test('smoke CLI membuat dan membaca ulang pendaftaran setelah aplikasi dibuka dari database yang sama', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'esoria-smoke-test-'));
  const commit = 'e'.repeat(40);
  const script = fileURLToPath(new URL('../scripts/container-smoke.mjs', import.meta.url));
  let server;
  const open = async () => {
    ({ server } = await createApplication({ dataDir, adminEmail: 'smoke-admin@example.test', adminPassword: 'Smoke-Admin-Test-2026!', release: commit }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  };
  const smoke = async (base, mode, expected = commit) => {
    const child = spawn(process.execPath, [script, base, mode], { env: { ...process.env, ESORIA_SMOKE_EXPECTED_SHA: expected }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; for (const stream of [child.stdout, child.stderr]) stream.on('data', c => { output += c; });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    return { code, output };
  };
  try {
    const first = await smoke(await open(), 'create'); assert.equal(first.code, 0, first.output);
    await new Promise(resolve => server.close(resolve));
    const base = await open();
    const second = await smoke(base, 'persist'); assert.equal(second.code, 0, second.output);
    const wrong = await smoke(base, 'read', 'f'.repeat(40)); assert.notEqual(wrong.code, 0);
  } finally { if (server?.listening) await new Promise(resolve => server.close(resolve)); await rm(dataDir, { recursive: true, force: true }); }
});
