import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');

test('launcher cek bukti memakai skrip PowerShell tanpa mengetik label atau URL', () => {
  const script = read('PERIKSA-BUKTI.cmd');
  assert.match(script, /powershell\.exe -NoProfile -ExecutionPolicy Bypass -File .*cek-bukti\.ps1/i);
  assert.match(script, /exit \/b %RESULT%/i);
  assert.doesNotMatch(script, /^https?:\/\//m);
  assert.doesNotMatch(script, /^Object LastWriteTime/m);
});

test('launcher lengkap menjalankan verifikasi semula dan meneruskan exit code', () => {
  const script = read('PERIKSA-SEMUA.cmd');
  assert.match(script, /verifikasi-semua\.ps1/i);
  assert.match(script, /exit \/b %RESULT%/i);
  const full = read('verifikasi-semua.ps1');
  assert.match(full, /npm.*'test'/);
  assert.match(full, /verify:container:windows/);
  assert.match(full, /buka-bukti-github\.ps1/);
});

test('tautan GitHub dibuka lewat Start-Process dan rilis local tidak disamakan dengan SHA', () => {
  const urls = read('buka-bukti-github.ps1');
  assert.match(urls, /Start-Process -FilePath \$entry\.Value/);
  assert.match(urls, /actions\/runs\/40434638852/);
  const proof = read('cek-bukti.ps1');
  assert.match(proof, /--expected-release local/);
  assert.doesNotMatch(proof, /--expected-sha 5fe69f90675504bcfc599efebd9fd5de04e5bc98/);
  assert.match(proof, /buka-bukti-github\.ps1/);
});


test('verifikasi semua tidak berhenti pada pause mulai.cmd dan memeriksa port Compose', () => {
  const launcher = read('mulai.cmd');
  assert.match(launcher, /ESORIA_NO_PAUSE/);
  assert.match(launcher, /if \/I "%ESORIA_NO_PAUSE%"=="1" exit \/b 0/i);
  assert.match(launcher, /if \/I "%ESORIA_NO_PAUSE%"=="1" exit \/b 1/i);
  const verify = read('verifikasi-semua.ps1');
  assert.match(verify, /\$env:ESORIA_NO_PAUSE = '1'/);
  assert.match(verify, /compose', 'port', 'web', '3000'/);
  assert.match(verify, /--expected-release','local'/);
});

test('panduan siap salin menghindari Sort terpisah dan membedakan SHA GitHub dari local', () => {
  const guide = read('docs/PERINTAH_WINDOWS_FINAL_SIAP_SALIN.md');
  assert.match(guide, /Sort-Object LastWriteTime -Descending/);
  assert.match(guide, /--expected-release local/);
  assert.match(guide, /--expected-sha 5fe69f90675504bcfc599efebd9fd5de04e5bc98/);
  assert.match(guide, /Start-Process 'https:\/\/github\.com/);
});
