import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { setupConfig, credentialsFromContainer } from '../scripts/setup.mjs';

const oldPassword = 'EcF-ExistingPassword7788';
const template = 'ADMIN_EMAIL=admin@esoria.test\nADMIN_PASSWORD=GANTI_DENGAN_PASSWORD_ACAK_12_KARAKTER\nAPP_PORT=8080\nBIND_ADDRESS=127.0.0.1\nCOOKIE_SECURE=false\nAPP_NAME=ESORIA CodeFest\nRELEASE_SHA=local\n';
function oldContainer({ label = 'esoria-uts', volume = 'esoria_uts_data', password = oldPassword } = {}) {
  return JSON.stringify([{
    Config: { Labels: { 'com.docker.compose.project': label, 'com.docker.compose.service': 'web' }, Env: [
      'ADMIN_EMAIL=admin@esoria.test', `ADMIN_PASSWORD=${password}`, 'COOKIE_SECURE=false',
    ] },
    Mounts: [{ Type: 'volume', Name: volume, Destination: '/app/data' }],
    NetworkSettings: { Ports: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '8088' }] } }
  }]);
}
async function fixture(callback) {
  const root = await mkdtemp(path.join(tmpdir(), 'esoria-setup-recovery-'));
  await writeFile(path.join(root, '.env.example'), template);
  try { return await callback(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}
function mockDocker({ volume = true, container = oldContainer() } = {}) {
  const calls = [];
  const run = (_command, args) => {
    calls.push(args);
    if (args[0] === 'info') return { status: 0, stdout: 'Docker test' };
    if (args[0] === 'volume' && args[1] === 'inspect') return { status: volume ? 0 : 1, stdout: '' };
    if (args[0] === 'inspect' && args[1] === 'esoria-uts-web-1') return { status: container ? 0 : 1, stdout: container || '' };
    throw new Error(`Unexpected Docker call: ${args.join(' ')}`);
  };
  return { run, calls };
}

test('setup: volume lama dan container ESORIA asli memulihkan password tanpa mengganti database', async () => fixture(async root => {
  const docker = mockDocker(); const output = [];
  assert.equal(setupConfig({ root, run: docker.run, output: message => output.push(message), checkVersion: () => {} }), 'restored');
  const env = parseEnv(await readFile(path.join(root, '.env'), 'utf8'));
  assert.equal(env.ADMIN_PASSWORD, oldPassword);
  assert.equal(env.APP_PORT, '8088');
  assert.equal(env.ADMIN_EMAIL, 'admin@esoria.test');
  assert.ok(!output.join('\n').includes(oldPassword));
  assert.deepEqual(docker.calls.map(args => args[0]), ['info', 'volume', 'inspect']);
}));

test('setup: menolak container lain atau volume yang tidak cocok', async () => fixture(async root => {
  const docker = mockDocker({ container: oldContainer({ label: 'proyek-lain' }) });
  assert.throws(() => setupConfig({ root, run: docker.run, checkVersion: () => {} }), /tidak memenuhi syarat/);
  assert.equal(existsSync(path.join(root, '.env')), false);
  assert.throws(() => credentialsFromContainer(oldContainer({ volume: 'other-volume' })), /tidak cocok/);
}));

test('setup: bila volume lama ada tanpa container tidak mereset admin secara diam-diam', async () => fixture(async root => {
  const docker = mockDocker({ container: null });
  assert.throws(() => setupConfig({ root, run: docker.run, checkVersion: () => {} }), /recover:admin:local/);
  assert.equal(existsSync(path.join(root, '.env')), false);
}));

test('setup: pemulihan admin lokal eksplisit membuat .env baru tanpa menghapus volume', async () => fixture(async root => {
  const docker = mockDocker({ container: null }); const output = [];
  assert.equal(setupConfig({ root, run: docker.run, recoverLocalAdmin: true, checkVersion: () => {}, output: m => output.push(m) }), 'reset');
  const env = parseEnv(await readFile(path.join(root, '.env'), 'utf8'));
  assert.ok(env.ADMIN_PASSWORD.length >= 12);
  assert.notEqual(env.ADMIN_PASSWORD, oldPassword);
  assert.ok(!output.join('\n').includes(env.ADMIN_PASSWORD));
  assert.ok(docker.calls.every(args => !['rm', 'prune', 'down'].includes(args[0])));
}));

test('setup: .env yang ada tidak ditimpa sekalipun pemulihan diminta', async () => fixture(async root => {
  await writeFile(path.join(root, '.env'), `ADMIN_PASSWORD=${oldPassword}\n`);
  const config = { root, run: () => { throw new Error('Docker tidak perlu dipanggil'); }, checkVersion: () => {} };
  assert.equal(setupConfig({ ...config, output: () => {} }), 'existing');
  assert.throws(() => setupConfig({ ...config, recoverLocalAdmin: true }), /sudah tersedia/);
  assert.equal(await readFile(path.join(root, '.env'), 'utf8'), `ADMIN_PASSWORD=${oldPassword}\n`);
}));
