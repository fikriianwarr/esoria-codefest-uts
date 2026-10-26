import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from './start-local.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export async function checkRuntime({ root = projectRoot, env = process.env, run = runCommand, expectedSha = '', save = false } = {}) {
  async function docker(args) {
    const result = await run('docker', args, { cwd: root, env, quiet: true });
    assert.equal(result.code, 0, 'Docker/Compose belum siap. Jalankan mulai.cmd dan periksa docker compose ps.');
    return result.output.trim();
  }
  await docker(['info']);
  const id = await docker(['compose', '--project-name', 'esoria-uts', '--file', 'compose.yaml', '--env-file', '.env', 'ps', '--all', '--quiet', 'web']);
  assert.match(id, /^[a-f0-9]{12,64}$/i, 'Belum ada satu container web ESORIA yang dapat diperiksa.');
  const inspect = async expression => JSON.parse(await docker(['inspect', '--format', `{{json ${expression}}}`, id]));
  const state = await inspect('.State');
  assert.equal(state.Running, true, 'Container ESORIA belum berjalan.');
  assert.equal(state.Health?.Status, 'healthy', 'Container ESORIA belum healthy. Periksa docker compose logs --tail 60 web.');
  const ports = await inspect('.NetworkSettings.Ports');
  const binding = ports['3000/tcp']?.find(p => ['127.0.0.1', '0.0.0.0'].includes(p.HostIp));
  assert.ok(binding, 'Port web 3000 belum dipublikasikan ke host IPv4.');
  const port = Number(binding.HostPort);
  assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535, 'Port host tidak valid.');
  const mounts = await inspect('.Mounts');
  const volume = mounts.find(m => m.Destination === '/app/data' && m.Type === 'volume' && m.Name === 'esoria_uts_data');
  assert.ok(volume, 'Penyimpanan /app/data belum memakai named volume esoria_uts_data.');
  const imageId = await inspect('.Image');
  const base = `http://127.0.0.1:${port}`;
  async function request(endpoint) {
    const response = await fetch(base + endpoint, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    assert.ok(response.ok, `${endpoint} belum dapat diakses (HTTP ${response.status}).`);
    return response;
  }
  const health = await (await request('/api/health')).json();
  assert.equal(health.app, 'esoria-uts'); assert.equal(health.status, 'ok'); assert.equal(health.database, 'ok');
  const release = await (await request('/api/release')).json();
  assert.ok(typeof release.commit === 'string' && release.commit.length > 0, 'Identitas rilis tidak tersedia.');
  if (expectedSha) assert.equal(release.commit, expectedSha, 'Commit runtime berbeda dari commit pipeline.');
  const html = await (await request('/')).text();
  assert.match(html, /ESORIA/i, 'Halaman utama bukan halaman ESORIA.');
  const report = {
    checkedAt: new Date().toISOString(), containerId: id, status: 'running', health: 'healthy', database: 'ok',
    port, url: `http://localhost:${port}`, imageId, commit: release.commit,
    volume: { name: volume.Name, destination: volume.Destination }, html: 'accessible',
    commitComparedToPipeline: Boolean(expectedSha), persistenceAfterRestart: 'requires_before_after_test', browserAppearance: 'requires_visual_confirmation'
  };
  if (save) {
    const directory = path.join(root, 'evidence', 'local');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const name = `runtime-${report.checkedAt.replace(/[:.]/g, '-')}.json`;
    await writeFile(path.join(directory, name), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  }
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const i = process.argv.indexOf('--expected-sha');
    const expectedSha = i >= 0 ? process.argv[i + 1] : '';
    if (i >= 0) assert.match(String(expectedSha || ''), /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i, 'Isi --expected-sha dengan commit pipeline yang lengkap.');
    const report = await checkRuntime({ expectedSha, save: process.argv.includes('--save') });
    console.log(`Container healthy, database ok, halaman dapat diakses: ${report.url}`);
    console.log(`Volume: ${report.volume.name}; commit: ${report.commit}`);
    if (process.argv.includes('--save')) console.log('Hasil pemeriksaan disimpan pada evidence/local/.');
    console.log('Periksa tampilan di browser dan cocokkan data sebelum/sesudah restart untuk melengkapi bukti.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
