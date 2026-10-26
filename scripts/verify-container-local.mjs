/**
 * Bukti container lintas Windows/Linux tanpa Git Bash.
 * Menggunakan image, container, dan volume uji yang dibuat khusus; data ESORIA aktif tidak disentuh.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDefault = fileURLToPath(new URL('../', import.meta.url));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function runCommand(command, args, { root = rootDefault, env = process.env, verbose = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on('data', chunk => {
        output = (output + chunk.toString()).slice(-12000);
        if (verbose) destination.write(chunk);
      });
    }
    child.once('error', reject);
    child.once('close', code => resolve({ code: code ?? 1, output: output.trim() }));
  });
}

export async function verifyLocalContainer({
  root = rootDefault, run = runCommand, delay = sleep, id = randomBytes(5).toString('hex'),
  expectedSha = 'local-container-audit', save = false, log = console.log
} = {}) {
  assert.match(id, /^[a-z0-9]{6,24}$/, 'ID audit container tidak valid.');
  assert.match(expectedSha, /^[a-z0-9][a-z0-9._-]{3,80}$/i, 'Label rilis audit tidak valid.');
  const containerName = `esoria-audit-${id}`;
  const volumeName = `${containerName}-data`;
  const imageName = `esoria-uts:audit-${id}`;
  let volumeCreated = false;
  let imageCreated = false;
  let containerCreated = false;
  const exec = async (tool, args, options = {}) => {
    const result = await run(tool, args, { root, env: { ...process.env, ...options.env }, verbose: Boolean(options.verbose) });
    if (result.code !== 0) throw new Error(`${tool} gagal pada langkah ${options.step || 'verifikasi'}: ${result.output.slice(-1500)}`);
    return result.output.trim();
  };
  const docker = (args, opts) => exec('docker', args, opts);
  const getContainerId = async () => docker(['inspect', '--format', '{{.Id}}', containerName], { step: 'membaca identitas container' });
  const port = async () => {
    const value = await docker(['inspect', '--format', '{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}', containerName], { step: 'membaca port aktual' });
    assert.match(value, /^\d{2,5}$/, 'Port container tidak tersedia.');
    return Number(value);
  };
  async function waitHealthy() {
    for (let attempt = 0; attempt < 90; attempt++) {
      const state = await docker(['inspect', '--format', '{{.State.Health.Status}}', containerName], { step: 'healthcheck' });
      if (state === 'healthy') return;
      if (state === 'unhealthy') throw new Error('Healthcheck container gagal. Jalankan docker logs ' + containerName);
      await delay(1000);
    }
    throw new Error('Healthcheck melewati 90 detik. Periksa docker logs ' + containerName);
  }
  async function start() {
    await docker(['run', '-d', '--name', containerName, '--read-only', '--tmpfs', '/tmp:size=16m,mode=1777',
      '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--memory', '256m', '--cpus', '1',
      '--pids-limit', '100', '-e', 'ADMIN_EMAIL=ci-admin@example.test', '-e', 'ADMIN_PASSWORD=Ci-Only-Container-2026!',
      '-v', `${volumeName}:/app/data`, '-p', '127.0.0.1::3000', imageName], { step: 'menjalankan container uji' });
    containerCreated = true;
    await waitHealthy();
  }
  async function smoke(mode) {
    const actualPort = await port();
    const result = await exec(process.execPath, ['scripts/container-smoke.mjs', `http://127.0.0.1:${actualPort}`, mode], {
      step: `smoke test ${mode}`, env: { ESORIA_SMOKE_EXPECTED_SHA: expectedSha }
    });
    assert.match(result, /"health":"ok"/);
    return actualPort;
  }
  try {
    await docker(['info'], { step: 'memastikan Docker Desktop aktif' });
    await docker(['version', '--format', '{{.Server.Version}}'], { step: 'memastikan Docker Engine berjalan' });
    log('Membangun image uji terpisah; Dockerfile menjalankan pemeriksaan kode dan semua tes sebelum runtime dibuat.');
    await docker(['build', '--build-arg', `RELEASE_SHA=${expectedSha}`, '-t', imageName, '.'], { step: 'membangun image Docker', verbose: true });
    imageCreated = true;
    await docker(['volume', 'create', volumeName], { step: 'membuat volume uji' });
    volumeCreated = true;
    await start();
    const before = await getContainerId();
    await smoke('create');
    log('Akun dan pendaftaran uji berhasil. Memeriksa persistensi setelah restart container.');
    await docker(['restart', containerName], { step: 'restart container' });
    await waitHealthy();
    await smoke('persist');
    log('Persistensi restart berhasil. Memeriksa persistensi setelah container dihapus lalu dibuat ulang.');
    await docker(['rm', '-f', containerName], { step: 'menghapus hanya container uji' });
    containerCreated = false;
    await start();
    const after = await getContainerId();
    assert.notEqual(after, before, 'Container belum dibuat ulang.');
    const hostPort = await smoke('persist');
    const report = {
      checkedAt: new Date().toISOString(), result: 'PASS', tests: ['docker-image-build', 'source-check', 'automated-tests-during-build',
        'container-healthcheck', 'http-and-api', 'registration-in-container', 'persist-after-restart', 'persist-after-recreate',
        'non-root-read-only-container', 'dedicated-named-volume'],
      release: expectedSha, image: imageName, testVolume: volumeName,
      firstContainerId: before, recreatedContainerId: after, lastHostPort: hostPort,
      note: 'Pengujian menggunakan sumber data sementara; data dan volume produksi tidak diubah. CI/CD GitHub tetap harus dibuktikan secara terpisah.'
    };
    if (save) {
      const folder = path.join(root, 'evidence', 'local');
      await mkdir(folder, { recursive: true, mode: 0o700 });
      const name = `container-audit-${report.checkedAt.replace(/[:.]/g, '-')}.json`;
      await writeFile(path.join(folder, name), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
      log(`Bukti uji disimpan: evidence/local/${name}`);
    }
    log('LULUS: build, health, API, restart, recreate, volume, dan identitas rilis diuji.');
    return report;
  } finally {
    // Nama acak milik proses ini saja. Tidak pernah memakai `docker compose down -v`.
    if (containerCreated) await run('docker', ['rm', '-f', containerName], { root }).catch(() => {});
    if (volumeCreated) await run('docker', ['volume', 'rm', volumeName], { root }).catch(() => {});
    if (imageCreated) await run('docker', ['image', 'rm', imageName], { root }).catch(() => {});
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await verifyLocalContainer({ save: true }); }
  catch (error) { console.error('AUDIT CONTAINER GAGAL:', error.message); process.exitCode = 1; }
}
