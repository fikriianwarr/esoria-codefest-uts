import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from 'node:util';
import { checkCdConfig } from '../scripts/check-cd-config.mjs';
import { deploymentConfig, renderDeploymentEnv } from '../scripts/deploy-config.mjs';

const valid = { ENABLE_CD: 'true', ESORIA_ADMIN_EMAIL: 'admin@example.test', ESORIA_ADMIN_PASSWORD: 'Configuration-Test-2026!', ESORIA_APP_PORT: '8088' };
test('CI/CD main memerlukan flag aktif, secrets valid dan port eksplisit', () => {
  for (const key of ['ENABLE_CD', 'ESORIA_ADMIN_EMAIL', 'ESORIA_ADMIN_PASSWORD', 'ESORIA_APP_PORT']) {
    assert.throws(() => checkCdConfig({ ...valid, [key]: '' }));
  }
  assert.equal(checkCdConfig(valid).APP_PORT, '8088');
  assert.throws(() => checkCdConfig({ ...valid, ESORIA_ADMIN_PASSWORD: 'GANTI_DENGAN_PASSWORD_ACAK_12_KARAKTER' }), /placeholder/);
});
test('konfigurasi CD menolak port, bind dan cookie yang tidak valid', () => {
  for (const port of ['80', '65536', '8088x']) assert.throws(() => deploymentConfig({ ...valid, ESORIA_APP_PORT: port }));
  assert.throws(() => deploymentConfig({ ...valid, ESORIA_BIND_ADDRESS: 'contoh' }));
  assert.throws(() => deploymentConfig({ ...valid, ESORIA_COOKIE_SECURE: 'yes' }));
});
test('serialisasi environment deployment mempertahankan dollar dan spasi password', () => {
  const secret = '  Config$Test-2026!  ';
  const config = deploymentConfig({ ...valid, ESORIA_ADMIN_PASSWORD: secret });
  assert.equal(parseEnv(renderDeploymentEnv(config)).ADMIN_PASSWORD, secret);
  for (const suffix of ["'", '\\', '\n']) assert.throws(() => deploymentConfig({ ...valid, ESORIA_ADMIN_PASSWORD: secret + suffix }));
});
