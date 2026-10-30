import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(path.join(root, name), 'utf8');

// Mencegah regresi build: file tes terdapat di Windows, tetapi hilang di Docker /build.
test('Docker verify menyalin semua launcher Windows sebelum npm test', () => {
  const dockerfile = read('Dockerfile');
  const ignore = read('.dockerignore');
  const stage = dockerfile.split(/\nFROM [^\n]+ AS runtime\b/)[0];
  assert.match(stage, /COPY\s+\*\.cmd\s+\.\//i);
  assert.match(stage, /COPY\s+\*\.ps1\s+\.\//i);
  assert.ok(stage.indexOf('COPY *.ps1 ./') < stage.indexOf('RUN npm run check && npm test'));
  assert.match(stage, /COPY\s+Dockerfile\s+\.dockerignore\s+\.\//i);
  const patterns = ignore.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  for (const blocked of ['*.cmd', '*.ps1', 'PERIKSA-BUKTI.cmd', 'PERIKSA-SEMUA.cmd', 'buka-bukti-github.ps1']) {
    assert.ok(!patterns.includes(blocked), `${blocked} dikecualikan dari Docker context`);
  }
  for (const file of ['PERIKSA-BUKTI.cmd', 'PERIKSA-SEMUA.cmd', 'buka-bukti-github.ps1', 'cek-bukti.ps1', 'verifikasi-semua.ps1']) {
    assert.ok(existsSync(path.join(root, file)), `${file} wajib tersedia`);
  }
  // Image runtime hanya mengambil app; launcher pengujian tidak ikut aplikasi produksi.
  const runtime = dockerfile.split(/\nFROM [^\n]+ AS runtime\b/)[1];
  assert.ok(runtime, 'stage runtime hilang');
  assert.doesNotMatch(runtime, /COPY\s+\*\.(?:cmd|ps1)/i);
});
