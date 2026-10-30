import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = '5fe69f90675504bcfc599efebd9fd5de04e5bc98';

test('kesalahan tempel SHA dengan backslash ditolak dengan petunjuk yang spesifik', () => {
  const cli = spawnSync(process.execPath, [path.join(root, 'scripts/check-runtime.mjs'), '--expected-sha', sha + '\\'], {cwd: root, encoding:'utf8'});
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /backslash/i);
  assert.match(cli.stderr, /--expected-release local/);
  assert.doesNotMatch(cli.stderr, /Container healthy, database ok/);
});

test('perintah panjang sudah tersedia sebagai satu launcher dengan pemeriksaan rilis yang aman', () => {
  const script = readFileSync(path.join(root, 'verifikasi-semua.ps1'), 'utf8');
  const docs = readFileSync(path.join(root, 'docs/PERINTAH_WINDOWS_FINAL_SIAP_SALIN.md'), 'utf8');
  const launcher = readFileSync(path.join(root, 'PERIKSA-SEMUA.cmd'), 'utf8');
  assert.match(launcher, /verifikasi-semua\.ps1/);
  assert.match(script, /--expected-release','local'/);
  assert.match(script, /--expected-sha',\$GitHubRunSHA/);
  assert.match(docs, /Sort-Object LastWriteTime -Descending/);
  assert.match(docs, /\.\\lihat-audit\.ps1/);
  assert.match(docs, /tidak.*\\.*SHA|backslash/i);
  assert.doesNotMatch(docs, /^Object LastWriteTime -Descending/m);
});
