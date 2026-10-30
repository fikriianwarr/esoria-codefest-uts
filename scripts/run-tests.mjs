/**
 * Cross-platform test launcher.
 *
 * Linux CI tests Bash deployment scripts directly, with an isolated Docker shim.
 * Windows tests application behavior natively and runs the real Bash regression
 * suite in a disposable Linux container. This prevents accidentally invoking
 * WSL's bash.exe with unpropagated environment variables, and avoids Windows
 * EBUSY errors caused by temporary directories held by WSL/Git Bash processes.
 * No production Docker socket, network, or named volume is mounted.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const deployTest = 'deploy-regression.test.mjs';
const testFiles = readdirSync(path.join(root, 'tests'))
  .filter(file => file.endsWith('.test.mjs')).sort();

function runStep(title, program, args, cwd = root) {
  console.log(`\n=== ${title} ===`);
  const result = spawnSync(program, args, {
    cwd, encoding: 'utf8', windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw new Error(`${title}: ${result.error.message}`);
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const get = field => Number(output.match(new RegExp(`^# ${field} (\\d+)\\s*$`, 'm'))?.[1] ?? NaN);
  const counts = { tests: get('tests'), pass: get('pass'), fail: get('fail') };
  if (result.status !== 0 || !Number.isFinite(counts.tests) || counts.pass + counts.fail > counts.tests || counts.fail) {
    throw new Error(`${title} gagal (exit=${result.status}, tests=${counts.tests}, lulus=${counts.pass}, gagal=${counts.fail}).`);
  }
  if (counts.pass !== counts.tests) {
    throw new Error(`${title} belum lengkap: ${counts.tests} tes, hanya ${counts.pass} lulus. Periksa cancelled/skipped/todo.`);
  }
  return counts;
}

try {
  const windows = process.platform === 'win32';
  if (!windows) {
    const results = runStep('Semua pengujian Node dan Bash pada Linux', process.execPath,
      ['--test', '--test-reporter=tap', ...testFiles.map(file => `tests/${file}`)]);
    console.log(`\nESORIA: ${results.pass}/${results.tests} pengujian lulus di Linux.`);
  } else {
    // Run platform-neutral and Windows-dependent behavior on native Windows.
    const native = runStep('Pengujian aplikasi dan Windows native', process.execPath,
      ['--test', '--test-reporter=tap', ...testFiles.filter(file => file !== deployTest).map(file => `tests/${file}`)]);
    // The deploy scripts are Linux Bash scripts by design. Use an ephemeral,
    // read-only Docker mount and copy just the test inputs into container /tmp.
    // Never mount Docker socket, host ports, network, credentials, or volumes.
    const setup = [
      'set -eu',
      'mkdir -p /tmp/esoria-regression/scripts /tmp/esoria-regression/tests',
      'cp -R /src/scripts/. /tmp/esoria-regression/scripts/',
      'cp /src/tests/deploy-regression.test.mjs /tmp/esoria-regression/tests/',
      'cp /src/compose.deploy.yaml /tmp/esoria-regression/',
      'cd /tmp/esoria-regression',
      'exec node --test --test-reporter=tap tests/deploy-regression.test.mjs'
    ].join('\n');
    const linux = runStep('Pengujian deployment dan rollback pada Linux terisolasi', 'docker', [
      'run', '--rm', '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--mount', `type=bind,source=${root},target=/src,readonly`,
      '--user', 'node', '--workdir', '/tmp',
      'node:24.22.1-bookworm-slim', 'sh', '-c', setup
    ]);
    if (linux.tests !== 9) throw new Error(`Diharapkan 9 pengujian deployment, didapat ${linux.tests}.`);
    const pass = native.pass + linux.pass;
    const total = native.tests + linux.tests;
    console.log(`\nESORIA: ${pass}/${total} pengujian lulus (${native.pass} Windows native + ${linux.pass} Linux terisolasi).`);
  }
} catch (error) {
  console.error(`\nGAGAL: ${error.message}`);
  if (process.platform === 'win32') {
    console.error('Pastikan Docker Desktop aktif dalam mode Linux containers dan image Node tersedia.');
    console.error('Jalankan "docker info" lalu "npm test". Tidak perlu Git Bash/WSL untuk pengujian ini.');
  }
  process.exitCode = 1;
}
