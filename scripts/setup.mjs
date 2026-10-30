import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const passwordMarker = 'GANTI_DENGAN_PASSWORD_ACAK_12_KARAKTER';
const mainVolume = 'esoria_uts_data';
const runningContainer = 'esoria-uts-web-1';

function docker(command, args) {
  return spawnSync(command, args, {
    windowsHide: true, encoding: 'utf8', timeout: 12000, maxBuffer: 2 * 1024 * 1024
  });
}
function validStatus(result) {
  return !result.error && result.status === 0;
}
function ensureVersion() {
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  if (major !== 24 || minor < 22 || (minor === 22 && patch < 1)) {
    throw new Error('Gunakan Node.js 24.22.1 atau versi 24 yang lebih baru.');
  }
}
function strongPassword() {
  return `EcF-${randomBytes(18).toString('base64url')}7`;
}
function renderEnv(template, password, opts = {}) {
  let content = template.replace(passwordMarker, password);
  if (opts.email) content = content.replace(/^ADMIN_EMAIL=.*$/m, `ADMIN_EMAIL=${opts.email}`);
  if (opts.port) content = content.replace(/^APP_PORT=.*$/m, `APP_PORT=${opts.port}`);
  if (opts.cookieSecure === 'true') content = content.replace(/^COOKIE_SECURE=.*$/m, 'COOKIE_SECURE=true');
  return content;
}

// Only accept credentials associated with the same Compose service and named volume.
// Do not print or copy the Docker-inspect JSON to logs: Config.Env includes secrets.
export function credentialsFromContainer(inspectOutput) {
  const parsed = JSON.parse(inspectOutput);
  const item = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : null;
  const labels = item?.Config?.Labels || {};
  if (labels['com.docker.compose.project'] !== 'esoria-uts' ||
      labels['com.docker.compose.service'] !== 'web' ||
      !item?.Mounts?.some(m => m.Type === 'volume' && m.Name === mainVolume && m.Destination === '/app/data')) {
    throw new Error('Container yang ditemukan tidak cocok dengan service dan volume ESORIA. Konfigurasi tidak dipulihkan otomatis.');
  }
  const pairs = new Map();
  for (const entry of item.Config.Env || []) {
    const delimiter = entry.indexOf('=');
    if (delimiter > 0) pairs.set(entry.slice(0, delimiter), entry.slice(delimiter + 1));
  }
  const email = pairs.get('ADMIN_EMAIL') || '';
  const password = pairs.get('ADMIN_PASSWORD') || '';
  // Conservative subset: if a secret contains unsupported .env quoting or interpolation,
  // require the original .env rather than silently changing or corrupting credentials.
  if (!/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email) ||
      password.length < 12 || password.length > 128 ||
      !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) ||
      !/^[A-Za-z0-9_-]+$/.test(password)) {
    throw new Error('Kredensial container tidak dapat disalin otomatis dengan aman. Gunakan .env sebelumnya atau opsi pemulihan admin lokal.');
  }
  const bindings = item?.NetworkSettings?.Ports?.['3000/tcp'];
  const binding = Array.isArray(bindings) ? bindings.find(x => x.HostIp === '127.0.0.1') : null;
  const candidatePort = Number(binding?.HostPort);
  const port = Number.isInteger(candidatePort) && candidatePort >= 1024 && candidatePort <= 65535 ? candidatePort : 8080;
  const cookieSecure = pairs.get('COOKIE_SECURE') === 'true' ? 'true' : 'false';
  return { email, password, port, cookieSecure };
}

/**
 * Creates missing local configuration. Never changes database or Docker volume here.
 * Recovery of missing .env uses an existing, verified Compose container if available.
 * A fresh random admin credential for an existing volume requires explicit operator opt-in.
 */
export function setupConfig({ root = defaultRoot, run = docker, output = console.log, recoverLocalAdmin = false, checkVersion = ensureVersion } = {}) {
  checkVersion();
  const envPath = path.join(root, '.env');
  if (existsSync(envPath)) {
    if (recoverLocalAdmin) throw new Error('.env sudah tersedia; pemulihan tidak diperlukan. Tidak ada perubahan.');
    output('Konfigurasi .env sudah ada dan dipertahankan. Kata sandi admin tidak direset.');
    return 'existing';
  }
  const dockerCheck = run('docker', ['info', '--format', '{{.ServerVersion}}']);
  if (!validStatus(dockerCheck)) {
    throw new Error('Docker Desktop belum siap. Jalankan Docker Desktop sebelum menyiapkan admin.');
  }
  const prior = run('docker', ['volume', 'inspect', mainVolume]);
  if (prior.error || (prior.status !== 0 && prior.status !== 1)) {
    throw new Error('Status volume ESORIA tidak dapat diperiksa. Periksa Docker Desktop sebelum melanjutkan.');
  }
  const template = readFileSync(path.join(root, '.env.example'), 'utf8');
  if (prior.status === 0 && !recoverLocalAdmin) {
    const previous = run('docker', ['inspect', runningContainer]);
    if (validStatus(previous)) {
      let config;
      try { config = credentialsFromContainer(previous.stdout); }
      catch (error) {
        throw new Error('Container lama tidak memenuhi syarat pemulihan aman. Salin .env lama atau jalankan npm run recover:admin:local secara eksplisit. Volume dan database tidak diubah.');
      }
      writeFileSync(envPath, renderEnv(template, config.password, config), { flag: 'wx', mode: 0o600 });
      output('Konfigurasi .env berhasil dipulihkan dari container ESORIA lama yang terverifikasi.');
      output('Kredensial admin dipertahankan; tidak ada reset dan tidak ada penghapusan volume.');
      output('Kata sandi tidak ditampilkan. Simpan .env hanya pada komputer sendiri.');
      return 'restored';
    }
    throw new Error('Volume esoria_uts_data lama ditemukan, tetapi .env tidak ada dan container ESORIA lama tidak dapat digunakan untuk memulihkan kredensial. Salin .env asli dari folder lama; jika file benar-benar hilang, jalankan "npm run recover:admin:local" (reset admin lokal secara eksplisit tanpa menghapus database), kemudian .\\mulai.cmd.');
  }
  const newPassword = strongPassword();
  writeFileSync(envPath, renderEnv(template, newPassword), { flag: 'wx', mode: 0o600 });
  if (prior.status === 0) {
    output('PEMULIHAN ADMIN LOKAL dipilih secara eksplisit: .env baru dibuat.');
    output('Saat mulai.cmd berikutnya berjalan, password admin akan disinkronkan; sesi admin lama dicabut.');
    output('Data peserta, pendaftaran, dan volume Docker lama tidak dihapus.');
  } else {
    output('Konfigurasi awal berhasil dibuat untuk database baru.');
  }
  output('Email admin: admin@esoria.test');
  output('Password admin acak hanya disimpan pada .env (ADMIN_PASSWORD), tidak dicetak di terminal.');
  return prior.status === 0 ? 'reset' : 'new';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const permitted = process.argv.slice(2);
    if (permitted.some(a => a !== '--recover-local-admin')) throw new Error('Argumen tidak dikenal. Gunakan --recover-local-admin hanya untuk pemulihan admin lokal yang disengaja.');
    setupConfig({ recoverLocalAdmin: permitted.includes('--recover-local-admin') });
  } catch (error) {
    console.error(`Konfigurasi belum dapat dibuat: ${error.message}`);
    process.exitCode = 1;
  }
}
