import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { readPortConfig, canBind, selectPort, updatePortLine } from '../scripts/local-port.mjs';
import { startLocal } from '../scripts/start-local.mjs';

const sample = 'ADMIN_EMAIL=admin@example.test\r\nADMIN_PASSWORD=Password-Contoh-2026!\r\nAPP_PORT=8080\r\nBIND_ADDRESS=127.0.0.1\r\n';
async function fixture(fn, source = sample) {
  const root = await mkdtemp(path.join(tmpdir(), 'esoria-port-'));
  await writeFile(path.join(root, '.env'), source);
  try { return await fn(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}
function fakeDocker({ existing = null, up = () => ({ code: 0, output: '' }), ready = true } = {}) {
  const calls = [];
  return { calls, async run(command, args, options) {
    calls.push({ command, args, options });
    if (command === process.execPath) return { code: 0, output: '' };
    assert.equal(command, 'docker');
    if (args[0] === 'info') return { code: ready ? 0 : 1, output: '' };
    if (args.includes('ps')) return { code: 0, output: existing ? 'a'.repeat(64) : '' };
    if (args[0] === 'inspect') return { code: 0, output: JSON.stringify({ '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: String(existing) }] }) };
    if (args.includes('up')) return await up(options.env.APP_PORT);
    throw new Error('Perintah Docker tak terduga pada pengujian.');
  } };
}

test('konfigurasi port membaca kutip/CRLF dan mengikuti environment efektif Compose', () => {
  assert.deepEqual(readPortConfig("APP_PORT='8088'\r\nBIND_ADDRESS=127.0.0.1\r\n"), { port: 8088, host: '127.0.0.1' });
  assert.equal(readPortConfig(sample, { APP_PORT: '8090' }).port, 8090);
  assert.equal(readPortConfig(sample, { APP_PORT: '' }).port, 8080);
  for (const bad of ['80', '65536', '8088x', '3000.5']) assert.throws(() => readPortConfig(`APP_PORT=${bad}`), /APP_PORT/);
  assert.throws(() => readPortConfig('BIND_ADDRESS=alamat-invalid'), /BIND_ADDRESS/);
});
test('pemeriksaan socket nyata membedakan port terpakai dan port yang dilepas', async () => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  try { assert.equal(await canBind(port, '127.0.0.1'), false); }
  finally { await new Promise(resolve => server.close(resolve)); }
  assert.equal(await canBind(port, '127.0.0.1'), true);
});
test('port sibuk dilewati sampai menemukan port cadangan yang tersedia', async () => {
  const visited = [];
  const port = await selectPort({ port: 8080, host: '127.0.0.1', probe: async p => { visited.push(p); return p === 8089; } });
  assert.equal(port, 8089); assert.deepEqual(visited, [8080, 8088, 8089]);
});
test('port milik service ESORIA yang berjalan dipakai kembali', async () => {
  const port = await selectPort({ port: 8088, host: '127.0.0.1', ownedPort: 8088, probe: () => { throw new Error('Tidak perlu mencoba mengambil port milik sendiri.'); } });
  assert.equal(port, 8088);
});
test('pencarian port dibatasi dan memberi pesan jika semua kandidat terpakai', async () => {
  await assert.rejects(() => selectPort({ port: 8080, host: '127.0.0.1', attempts: 2, probe: async () => false }), /Belum menemukan port/);
});
test('penulisan port mempertahankan kredensial dan format baris konfigurasi', () => {
  const changed = updatePortLine(sample, 8088);
  assert.equal(changed.replace('APP_PORT=8088', 'APP_PORT=8080'), sample);
  assert.equal(parseEnv(changed).ADMIN_PASSWORD, parseEnv(sample).ADMIN_PASSWORD);
  const appended = updatePortLine('ADMIN_EMAIL=admin@example.test', 8090);
  assert.equal(parseEnv(appended).APP_PORT, '8090');
  assert.equal(parseEnv(updatePortLine("APP_PORT='8080'\r\nexport APP_PORT=8081\r\n", 8091)).APP_PORT, '8091');
});
test('launcher memakai port cadangan, menyimpannya, dan menampilkan URL yang benar', async () => {
  await fixture(async root => {
    const fake = fakeDocker(), messages = [];
    assert.equal(await startLocal({ root, env: {}, run: fake.run, probe: async p => p !== 8080, output: m => messages.push(m) }), 8088);
    const config = parseEnv(await readFile(path.join(root, '.env'), 'utf8'));
    assert.equal(config.APP_PORT, '8088'); assert.equal(config.ADMIN_PASSWORD, parseEnv(sample).ADMIN_PASSWORD);
    assert.ok(messages.some(m => m.includes('http://localhost:8088')));
    assert.equal(fake.calls.find(c => c.args.includes('up')).options.env.APP_PORT, '8088');
  });
});
test('menjalankan ulang launcher mempertahankan port container proyek yang aktif', async () => {
  await fixture(async root => {
    const fake = fakeDocker({ existing: 8088 });
    assert.equal(await startLocal({ root, env: {}, run: fake.run, probe: () => { throw new Error('Port aktif milik proyek seharusnya digunakan kembali.'); }, output: () => {} }), 8088);
    assert.equal(fake.calls.filter(c => c.args.includes('up')).length, 1);
  }, sample.replace('APP_PORT=8080', 'APP_PORT=8088'));
});
test('konflik yang baru ditolak Docker memicu percobaan pada port berikutnya', async () => {
  await fixture(async root => {
    const attempted = [];
    const fake = fakeDocker({ up: port => { attempted.push(port); return port === '8080' ? { code: 1, output: 'Bind for 127.0.0.1:8080 failed: port is already allocated' } : { code: 0, output: '' }; } });
    assert.equal(await startLocal({ root, env: {}, run: fake.run, probe: async () => true, output: () => {} }), 8088);
    assert.deepEqual(attempted, ['8080', '8088']);
  });
});
test('port cadangan milik proyek tetap dipakai saat konfigurasi lama masih menunjuk 8080', async () => {
  await fixture(async root => {
    const fake = fakeDocker({ existing: 8088 }), visited = [];
    assert.equal(await startLocal({ root, env: {}, run: fake.run, probe: async port => { visited.push(port); return false; }, output: () => {} }), 8088);
    assert.deepEqual(visited, [8080]);
    assert.equal(parseEnv(await readFile(path.join(root, '.env'), 'utf8')).APP_PORT, '8088');
  });
});
test('kegagalan build selain konflik port menghentikan launcher tanpa mengganti konfigurasi', async () => {
  await fixture(async root => {
    const fake = fakeDocker({ up: () => ({ code: 1, output: 'Build failed: tests did not pass' }) }), messages = [];
    await assert.rejects(() => startLocal({ root, env: {}, run: fake.run, probe: async () => true, output: m => messages.push(m) }), /Container belum berhasil/);
    assert.equal(fake.calls.filter(c => c.args.includes('up')).length, 1);
    assert.equal(await readFile(path.join(root, '.env'), 'utf8'), sample);
    assert.ok(!messages.some(m => m.startsWith('ESORIA siap.')));
  });
});
test('percobaan konflik Docker dibatasi tiga kali dan tidak mengklaim layanan siap', async () => {
  await fixture(async root => {
    const fake = fakeDocker({ up: () => ({ code: 1, output: 'port is already allocated' }) });
    await assert.rejects(() => startLocal({ root, env: {}, run: fake.run, probe: async () => true, output: () => {} }), /tiga percobaan/);
    assert.equal(fake.calls.filter(c => c.args.includes('up')).length, 3);
    assert.equal(await readFile(path.join(root, '.env'), 'utf8'), sample);
  });
});
test('Docker yang belum aktif memberi pesan perbaikan sebelum mencoba startup', async () => {
  await fixture(async root => {
    const fake = fakeDocker({ ready: false });
    await assert.rejects(() => startLocal({ root, env: {}, run: fake.run, output: () => {} }), /Buka Docker Desktop/);
    assert.equal(fake.calls.filter(c => c.args.includes('up')).length, 0);
  });
});
