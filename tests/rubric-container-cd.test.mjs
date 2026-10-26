import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLocalContainer } from '../scripts/verify-container-local.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('regresi Docker: file Compose untuk tahap verify tersedia dan tidak dikecualikan build context', async () => {
  // Dockerfile menyalin kedua file Compose pada tahap verify. Jika di-ignore,
  // docker compose up --build gagal pada COPY sebelum npm test dapat dijalankan.
  const local = await readFile(path.join(root, 'compose.yaml'), 'utf8');
  const deploy = await readFile(path.join(root, 'compose.deploy.yaml'), 'utf8');
  assert.match(local, /services:\s*\n\s*web:/);
  assert.match(deploy, /services:\s*\n\s*web:/);
  const { existsSync } = await import('node:fs');
  const ignore = path.join(root, '.dockerignore');
  if (existsSync(ignore)) {
    const rules = (await readFile(ignore, 'utf8')).split(/\r?\n/).map(line => line.trim());
    for (const file of ['compose.yaml', 'compose.deploy.yaml']) {
      assert.ok(!rules.some(line => line === file || line === 'compose*.yaml' || line === 'compose*.yml'),
        `${file} tidak boleh dikecualikan dari build context Docker`);
    }
  }
});

test('rubrik container: runtime local dan CD memakai admin sinkron dan named volume yang sama', async () => {
  const local = await readFile(path.join(root, 'compose.yaml'), 'utf8');
  const remote = await readFile(path.join(root, 'compose.deploy.yaml'), 'utf8');
  for (const compose of [local, remote]) {
    assert.match(compose, /ADMIN_SYNC_ON_START:\s*["']?true/);
    assert.match(compose, /esoria-data:\/app\/data/);
    assert.match(compose, /name:\s*esoria_uts_data/);
    assert.match(compose, /read_only:\s*true/);
    assert.match(compose, /no-new-privileges:true/);
    assert.match(compose, /restart:\s*unless-stopped/);
  }
});

test('rubrik CI: verifikasi pull request/main tetap dapat berjalan saat CD belum diaktifkan; publish/deploy bersyarat', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/esoria-ci-cd.yml'), 'utf8');
  const verify = workflow.split('\n  verify:')[1].split('\n  publish:')[0];
  const publish = workflow.split('\n  publish:')[1].split('\n  deploy:')[0];
  const deploy = workflow.split('\n  deploy:')[1];
  assert.match(verify, /npm ci --ignore-scripts/);
  assert.match(verify, /npm test/);
  assert.match(verify, /bash scripts\/verify-container\.sh/);
  assert.match(verify, /Check required CD settings when deployment is enabled/);
  assert.match(verify, /vars\.ENABLE_CD == 'true'/);
  assert.doesNotMatch(verify.split('    steps:')[0], /ENABLE_CD/);
  assert.match(publish, /needs: verify/);
  assert.match(publish, /vars\.ENABLE_CD == 'true'/);
  assert.match(deploy, /needs: publish/);
  assert.match(deploy, /vars\.ENABLE_CD == 'true'/);
  assert.match(deploy, /self-hosted, Linux, X64, esoria-uts/);
  assert.match(deploy, /scripts\/deploy\.sh/);
});

function fakeDocker({ failAt = '' } = {}) {
  const state = { calls: [], runs: 0, created: false, volume: false, built: false, restarts: 0 };
  async function run(tool, args) {
    state.calls.push({ tool, args });
    const cmd = `${tool} ${args.join(' ')}`;
    if (failAt && cmd.includes(failAt)) return { code: 1, output: 'kegagalan sintetis' };
    if (tool !== 'docker') {
      assert.match(cmd, /container-smoke\.mjs/);
      assert.match(cmd, / (create|persist)$/);
      return { code: 0, output: '{"health":"ok","commit":"local-container-audit"}' };
    }
    if (args[0] === 'build') state.built = true;
    if (args[0] === 'volume' && args[1] === 'create') state.volume = true;
    if (args[0] === 'run') { state.runs++; state.created = true; }
    if (args[0] === 'restart') state.restarts++;
    if (args[0] === 'rm') state.created = false;
    if (args[0] === 'volume' && args[1] === 'rm') state.volume = false;
    if (args[0] === 'image' && args[1] === 'rm') state.built = false;
    if (args[0] === 'inspect') {
      if (args[2] === '{{.State.Health.Status}}') return { code: 0, output: 'healthy' };
      if (args[2] === '{{.Id}}') return { code: 0, output: 'a'.repeat(63) + state.runs };
      if (args[2].includes('HostPort')) return { code: 0, output: '51234' };
    }
    return { code: 0, output: 'ok' };
  }
  return { state, run };
}

test('rubrik container: bukti lokal menguji build, HTTP, persistensi restart/recreate dan membersihkan hanya aset uji', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'esoria-uts-proof-'));
  const fake = fakeDocker();
  try {
    const result = await verifyLocalContainer({ root: temp, run: fake.run, id: 'abcdef99', delay: async () => {}, save: true, log: () => {} });
    assert.equal(result.result, 'PASS');
    assert.equal(result.tests.length, 10);
    assert.notEqual(result.firstContainerId, result.recreatedContainerId);
    assert.equal(fake.state.runs, 2);
    assert.equal(fake.state.restarts, 1);
    assert.equal(fake.state.created, false);
    assert.equal(fake.state.volume, false);
    assert.equal(fake.state.built, false);
    const [artifact] = await readdir(path.join(temp, 'evidence', 'local'));
    const evidence = JSON.parse(await readFile(path.join(temp, 'evidence', 'local', artifact), 'utf8'));
    assert.equal(evidence.result, 'PASS');
    assert.ok(!JSON.stringify(evidence).includes('Ci-Only-Container-2026!'));
    assert.equal(fake.state.calls.filter(x => x.tool !== 'docker').length, 3);
    assert.equal(fake.state.calls.filter(x => x.args[0] === 'rm').length, 2);
    assert.equal(fake.state.calls.filter(x => x.args[0] === 'volume' && x.args[1] === 'rm').length, 1);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('rubrik container: jika smoke test gagal, aset uji dibersihkan dan tidak ada bukti palsu sukses', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'esoria-uts-proof-fail-'));
  const fake = fakeDocker({ failAt: 'container-smoke.mjs' });
  try {
    await assert.rejects(() => verifyLocalContainer({ root: temp, run: fake.run, id: 'abcdef98', delay: async () => {}, save: true, log: () => {} }), /smoke test/);
    assert.equal(fake.state.created, false);
    assert.equal(fake.state.volume, false);
    assert.equal(fake.state.built, false);
    await assert.rejects(() => readdir(path.join(temp, 'evidence', 'local')), { code: 'ENOENT' });
  } finally { await rm(temp, { recursive: true, force: true }); }
});
