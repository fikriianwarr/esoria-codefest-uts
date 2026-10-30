import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const root = fileURLToPath(new URL('../', import.meta.url));
const oldImage = `ghcr.io/group/esoria@sha256:${'a'.repeat(64)}`;
const newImage = `ghcr.io/group/esoria@sha256:${'b'.repeat(64)}`;
const expectedSha = 'c'.repeat(40);
const oldConfig = "ADMIN_EMAIL='old@example.test'\nADMIN_PASSWORD='Old-Password-2026!'\nAPP_PORT='8088'\nBIND_ADDRESS='127.0.0.1'\nCOOKIE_SECURE='false'\n";
const oldCompose = '# old deployment configuration\n';
const fakeDocker = `#!/usr/bin/env node
import fs from 'node:fs';
// Locate the test state relative to this shim; works for native Node and WSL Node.
const args=process.argv.slice(2),p=new URL('../docker-state.json',import.meta.url);
const s=JSON.parse(fs.readFileSync(p,'utf8'));
s.calls.push({args,image:process.env.ESORIA_IMAGE||'',env:fs.existsSync('.env')?fs.readFileSync('.env','utf8'):'',ambientPort:process.env.APP_PORT||'',ambientPasswordPresent:!!process.env.ADMIN_PASSWORD});
let code=0;
if(args.includes('up')){s.ups++;if(s.failFirstUp && s.ups===1)code=1;}
if(args.includes('pull')&&s.failPull)code=1;
if(args[0]==='image'&&args.includes('inspect'))process.stdout.write('sha256:'+'d'.repeat(64));
if(args[0]==='inspect')process.stdout.write('sha256:'+(process.env.ESORIA_TEST_IMAGE_MISMATCH?'f':'d').repeat(64));
if(args.includes('ps'))process.stdout.write('e'.repeat(64));
fs.writeFileSync(p,JSON.stringify(s));
process.exitCode=code;
`;
async function fixture(fn, { prior = true, failFirstUp = false, failPull = false } = {}) {
  // On Windows this suite executes inside an isolated Linux container.
  // Relative POSIX paths work without passing drive paths into Bash.
  const dir = await mkdtemp(path.join(root, '.esoria-deploy-test-'));
  const deployment = path.join(dir, 'deployment'), bin = path.join(dir, 'bin'), stateFile = path.join(dir, 'docker-state.json');
  await mkdir(deployment); await mkdir(bin);
  await writeFile(path.join(bin, 'docker'), fakeDocker, { mode: 0o700 });
  await writeFile(path.join(bin, 'package.json'), '{"type":"module"}');
  await writeFile(stateFile, JSON.stringify({ calls: [], ups: 0, failFirstUp, failPull }));
  if (prior) {
    await writeFile(path.join(deployment, '.env'), oldConfig);
    await writeFile(path.join(deployment, 'compose.yaml'), oldCompose);
    await writeFile(path.join(deployment, 'current-image'), `${oldImage}\n`);
  }
  const env = { ...process.env, ESORIA_DEPLOY_DIR: 'deployment',
    ESORIA_IMAGE: newImage, ESORIA_EXPECTED_SHA: expectedSha, ESORIA_ADMIN_EMAIL: 'new@example.test', ESORIA_ADMIN_PASSWORD: 'New-Password-2026!', ESORIA_APP_PORT: '8089',
    ESORIA_BIND_ADDRESS: '127.0.0.1', ESORIA_COOKIE_SECURE: 'false', ESORIA_HTTP_TIMEOUT_MS: '1000' };
  async function run(script = 'deploy.sh', extra = {}) {
    // Resolve the fake Docker bin to a Bash-native absolute path before scripts
    // change directory. Pass only relative script paths, never Windows drive paths.
    const child = spawn('bash', ['-c',
      'export PATH="$(cd bin && pwd):$PATH"; exec bash "../scripts/$1"',
      'esoria-deploy-test', script], { cwd: dir, env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; for (const stream of [child.stdout, child.stderr]) stream.on('data', c => { output += c; });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    return { code, output, state: JSON.parse(await readFile(stateFile, 'utf8')) };
  }
  try { return await fn({ dir, deployment, run }); }
  finally { await rm(dir, { recursive: true, force: true }); }
}
test('deployment gagal memulihkan image beserta environment dan Compose sebelumnya', async () => {
  await fixture(async ({ deployment, run }) => {
    const r = await run(); assert.notEqual(r.code, 0);
    assert.equal(await readFile(path.join(deployment, '.env'), 'utf8'), oldConfig);
    assert.equal(await readFile(path.join(deployment, 'compose.yaml'), 'utf8'), oldCompose);
    const ups = r.state.calls.filter(c => c.args.includes('up'));
    assert.equal(ups.length, 2); assert.equal(ups[1].image, oldImage); assert.equal(ups[1].env, oldConfig);
    assert.equal((await readFile(path.join(deployment, 'current-image'), 'utf8')).trim(), oldImage);
  }, { failFirstUp: true });
});
test('gagal pull memulihkan konfigurasi tanpa mengganti container yang masih aktif', async () => {
  await fixture(async ({ deployment, run }) => {
    const r = await run(); assert.notEqual(r.code, 0); assert.equal(r.state.ups, 0);
    assert.equal(await readFile(path.join(deployment, '.env'), 'utf8'), oldConfig);
    assert.equal(await readFile(path.join(deployment, 'compose.yaml'), 'utf8'), oldCompose);
  }, { failPull: true });
});
test('commit salah setelah startup memicu rollback konfigurasi dan image', async () => {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(req.url === '/api/health'
    ? { status: 'ok', database: 'ok', app: 'esoria-uts' } : { commit: 'f'.repeat(40) })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await fixture(async ({ deployment, run }) => {
      const r = await run('deploy.sh', { ESORIA_APP_PORT: String(server.address().port) });
      assert.notEqual(r.code, 0); assert.equal(r.state.ups, 2);
      assert.equal(await readFile(path.join(deployment, '.env'), 'utf8'), oldConfig);
    });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
async function healthyServer(fn) {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(req.url === '/api/health'
    ? { status: 'ok', database: 'ok', app: 'esoria-uts' } : { commit: expectedSha })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await fn(server.address().port); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('deployment sukses menyimpan riwayat hanya setelah image dan commit terverifikasi', async () => {
  await healthyServer(async port => fixture(async ({ deployment, run }) => {
    const r = await run('deploy.sh', { ESORIA_APP_PORT: String(port) }); assert.equal(r.code, 0, r.output);
    assert.equal((await readFile(path.join(deployment, 'current-image'), 'utf8')).trim(), newImage);
    assert.equal((await readFile(path.join(deployment, 'previous-image'), 'utf8')).trim(), oldImage);
    assert.equal(await readFile(path.join(deployment, '.env.previous'), 'utf8'), oldConfig);
    assert.equal(await readFile(path.join(deployment, 'compose.previous.yaml'), 'utf8'), oldCompose);
    assert.ok(!r.output.includes('New-Password-2026!'));
  }));
});
test('image runtime yang berbeda memicu pemulihan sebelum riwayat sukses ditulis', async () => {
  await fixture(async ({ deployment, run }) => {
    const r = await run('deploy.sh', { ESORIA_TEST_IMAGE_MISMATCH: '1' }); assert.notEqual(r.code, 0);
    assert.equal(r.state.ups, 2); assert.equal(await readFile(path.join(deployment, '.env'), 'utf8'), oldConfig);
    assert.equal((await readFile(path.join(deployment, 'current-image'), 'utf8')).trim(), oldImage);
  });
});
test('environment runner yang kebetulan memakai APP_PORT tidak menimpa konfigurasi Compose', async () => {
  await healthyServer(async port => fixture(async ({ run }) => {
    const r = await run('deploy.sh', { ESORIA_APP_PORT: String(port), APP_PORT: '9999', ADMIN_PASSWORD: 'Ambient-Value-2026!' });
    assert.equal(r.code, 0, r.output);
    const up = r.state.calls.find(c => c.args.includes('up'));
    assert.equal(up.ambientPort, ''); assert.equal(up.ambientPasswordPresent, false);
  }));
});
test('rollback manual memulihkan konfigurasi pasangan image dan menyimpan riwayat kebalikan', async () => {
  await fixture(async ({ deployment, run }) => {
    const targetConfig = oldConfig.replace('8088', '8099');
    await writeFile(path.join(deployment, 'previous-image'), newImage);
    await writeFile(path.join(deployment, '.env.previous'), targetConfig);
    await writeFile(path.join(deployment, 'compose.previous.yaml'), '# target compose\n');
    const r = await run('rollback.sh'); assert.equal(r.code, 0, r.output);
    assert.equal(await readFile(path.join(deployment, '.env'), 'utf8'), targetConfig);
    assert.equal(await readFile(path.join(deployment, '.env.previous'), 'utf8'), oldConfig);
    assert.equal((await readFile(path.join(deployment, 'current-image'), 'utf8')).trim(), newImage);
  });
});
test('rollback manual yang gagal mengembalikan deployment semula', async () => {
  await fixture(async ({ deployment, run }) => {
    await writeFile(path.join(deployment, 'previous-image'), newImage);
    await writeFile(path.join(deployment, '.env.previous'), oldConfig.replace('8088', '8099'));
    await writeFile(path.join(deployment, 'compose.previous.yaml'), '# target compose\n');
    const r = await run('rollback.sh'); assert.notEqual(r.code, 0); assert.equal(r.state.ups, 2);
    assert.equal(await readFile(path.join(deployment, '.env'), 'utf8'), oldConfig);
    assert.equal((await readFile(path.join(deployment, 'current-image'), 'utf8')).trim(), oldImage);
  }, { failFirstUp: true });
});
test('deployment pertama yang gagal tidak menulis riwayat image sukses', async () => {
  await fixture(async ({ deployment, run }) => {
    const r = await run(); assert.notEqual(r.code, 0); assert.equal(r.state.ups, 1);
    await assert.rejects(() => readFile(path.join(deployment, 'current-image'), 'utf8'), { code: 'ENOENT' });
  }, { prior: false, failFirstUp: true });
});
