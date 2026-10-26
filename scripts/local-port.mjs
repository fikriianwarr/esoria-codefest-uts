import net from 'node:net';
import { parseEnv } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';

export function readPortConfig(source, overrides = {}) {
  const saved = parseEnv(source);
  const portValue = overrides.APP_PORT ?? saved.APP_PORT ?? '8080';
  const host = String(overrides.BIND_ADDRESS ?? saved.BIND_ADDRESS ?? '127.0.0.1') || '127.0.0.1';
  const port = Number(portValue || '8080');
  if (!/^\d+$/.test(String(portValue || '8080')) || !Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('APP_PORT harus berupa angka 1024–65535. Periksa .env.');
  }
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) {
    throw new Error('BIND_ADDRESS harus 127.0.0.1 atau 0.0.0.0. Periksa .env.');
  }
  return { port, host };
}

export function canBind(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', error => {
      if (['EADDRINUSE', 'EACCES'].includes(error.code)) resolve(false);
      else reject(error);
    });
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

export async function selectPort({ port, host, ownedPort = null, blocked = new Set(), probe = canBind, attempts = 80 }) {
  const candidates = [port];
  const fallback = port === 8080 || port === 65535 ? 8088 : port + 1;
  for (let offset = 0; offset < attempts; offset++) {
    const candidate = fallback + offset;
    if (candidate <= 65535 && !candidates.includes(candidate)) candidates.push(candidate);
  }
  for (const candidate of candidates) {
    if (blocked.has(candidate)) continue;
    if (candidate === ownedPort || await probe(candidate, host)) return candidate;
  }
  throw new Error('Belum menemukan port lokal yang kosong. Isi APP_PORT dengan port lain pada .env lalu jalankan lagi.');
}

export function updatePortLine(source, port) {
  const pattern = /^([\t ]*(?:export[\t ]+)?APP_PORT[\t ]*=)[^\r\n]*/gm;
  if (pattern.test(source)) {
    pattern.lastIndex = 0;
    return source.replace(pattern, (_line, prefix) => `${prefix}${port}`);
  }
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  return `${source}${source && !/[\r\n]$/.test(source) ? newline : ''}APP_PORT=${port}${newline}`;
}

export function savePort(filename, port) {
  // Read immediately before writing so other current settings stay intact.
  const source = readFileSync(filename, 'utf8');
  const result = updatePortLine(source, port);
  if (result !== source) writeFileSync(filename, result, { mode: 0o600 });
}
