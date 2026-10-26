import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPortConfig, selectPort, canBind, savePort } from './local-port.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const isPortConflict = output => /port is already allocated|address already in use|ports are not available|bind for[^\r\n]*failed|only one usage of each socket address|access a socket in a way forbidden/i.test(output);

export function runCommand(command, args, { cwd, env, quiet = false }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['inherit', 'pipe', 'pipe'] });
    let output = '';
    for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on('data', chunk => {
        output = (output + chunk.toString()).slice(-16000);
        if (!quiet) destination.write(chunk);
      });
    }
    child.once('error', error => reject(new Error(error.code === 'ENOENT'
      ? `Perintah ${command} belum tersedia. Periksa instalasinya dan buka terminal baru.`
      : error.message)));
    child.once('close', code => resolve({ code: code ?? 1, output }));
  });
}

async function runningProjectPort({ run, cwd, env, host }) {
  const result = await run('docker', ['compose', '--env-file', '.env', 'ps', '--status', 'running', '--quiet', 'web'], { cwd, env, quiet: true });
  if (result.code !== 0) return null;
  const ids = result.output.trim().split(/\s+/).filter(Boolean);
  if (ids.length !== 1 || !/^[a-f0-9]{12,64}$/i.test(ids[0])) return null;
  const inspected = await run('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', ids[0]], { cwd, env, quiet: true });
  if (inspected.code !== 0) return null;
  try {
    const bindings = JSON.parse(inspected.output)['3000/tcp'] || [];
    const binding = bindings.find(item => item.HostIp === host);
    return binding ? Number(binding.HostPort) : null;
  } catch { return null; }
}

export async function startLocal({ root = projectRoot, env = process.env, run = runCommand, probe = canBind, output = console.log } = {}) {
  const settings = { cwd: root, env };
  const setup = await run(process.execPath, ['scripts/setup.mjs'], settings);
  if (setup.code !== 0) throw new Error('Konfigurasi awal belum berhasil. Periksa pesan setup di atas.');
  const docker = await run('docker', ['info'], { ...settings, quiet: true });
  if (docker.code !== 0) throw new Error('Docker belum siap. Buka Docker Desktop, tunggu Engine running, lalu jalankan lagi.');

  const config = readPortConfig(readFileSync(path.join(root, '.env'), 'utf8'), env);
  let ownedPort = await runningProjectPort({ ...settings, run, host: config.host });
  // Only reuse a busy port when it belongs to the running web service of this project.
  const blocked = new Set();
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = await selectPort({ ...config, ownedPort, blocked, probe });
    if (port !== config.port) output(`Port ${config.port} sedang dipakai atau belum dapat digunakan. ESORIA memakai port ${port}.`);
    else output(`ESORIA memakai port ${port}${ownedPort === port ? ' milik container proyek ini' : ''}.`);
    const childEnv = { ...env, APP_PORT: String(port), BIND_ADDRESS: config.host };
    const up = await run('docker', ['compose', '--env-file', '.env', 'up', '-d', '--build', '--wait', '--wait-timeout', '120'], { cwd: root, env: childEnv });
    if (up.code === 0) {
      savePort(path.join(root, '.env'), port);
      output('');
      output(`ESORIA siap. Buka http://localhost:${port}`);
      output(`Periksa kesehatan: http://localhost:${port}/api/health`);
      output(`Port ${port} tersimpan pada .env. Gunakan alamat ini saat membuka website.`);
      output('Email dan kata sandi admin ada pada .env pribadi.');
      output('Untuk menghentikan: docker compose down');
      output('Data tetap berada pada volume esoria_uts_data.');
      return port;
    }
    if (!isPortConflict(up.output)) throw new Error('Container belum berhasil dijalankan. Periksa pesan Docker di atas.');
    blocked.add(port);
    ownedPort = null;
    output(`Docker menolak port ${port}. Mencoba port berikutnya…`);
  }
  throw new Error('Docker masih menolak port setelah tiga percobaan. Periksa pengaturan jaringan Docker Desktop dan APP_PORT pada .env.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await startLocal(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
