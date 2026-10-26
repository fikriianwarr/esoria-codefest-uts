import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function deploymentConfig(env) {
  const email = String(env.ESORIA_ADMIN_EMAIL || '').trim();
  const password = String(env.ESORIA_ADMIN_PASSWORD || '');
  const port = String(env.ESORIA_APP_PORT || '').trim();
  const host = String(env.ESORIA_BIND_ADDRESS || '127.0.0.1');
  const secure = String(env.ESORIA_COOKIE_SECURE || 'false');
  if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Secret ESORIA_ADMIN_EMAIL belum diisi dengan email yang valid.');
  if (password.length < 12 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) throw new Error('Secret ESORIA_ADMIN_PASSWORD harus 12–128 karakter dengan huruf dan angka.');
  if (password === 'GANTI_DENGAN_PASSWORD_ACAK_12_KARAKTER') throw new Error('Secret ESORIA_ADMIN_PASSWORD masih memakai placeholder contoh. Gunakan kata sandi admin yang sebenarnya.');
  if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error('Variabel ESORIA_APP_PORT wajib diisi dengan port mesin deployment yang benar, misalnya 8088.');
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('ESORIA_BIND_ADDRESS harus 127.0.0.1 atau 0.0.0.0.');
  if (!['true', 'false'].includes(secure)) throw new Error('ESORIA_COOKIE_SECURE harus true atau false.');
  const values = { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, APP_PORT: String(Number(port)), BIND_ADDRESS: host, COOKIE_SECURE: secure, APP_NAME: 'ESORIA CodeFest' };
  if (Object.values(values).some(v => /[\r\n'\\\u0000]/.test(v))) throw new Error('Konfigurasi deployment tidak boleh berisi newline, petik tunggal, backslash, atau karakter nol.');
  return values;
}
export function renderDeploymentEnv(config) { return Object.entries(config).map(([k, v]) => `${k}='${v}'\n`).join(''); }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = deploymentConfig(process.env);
    if (process.argv[2] === 'write' && process.argv[3]) writeFileSync(process.argv[3], renderDeploymentEnv(config), { mode: 0o600 });
    else if (process.argv[2] === 'port') console.log(config.APP_PORT);
    else if (process.argv[2] !== 'check') throw new Error('Gunakan deploy-config.mjs check, port, atau write PATH.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
