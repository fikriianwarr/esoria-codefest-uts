import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deploymentConfig } from './deploy-config.mjs';

export function checkCdConfig(env) {
  if (env.ENABLE_CD !== 'true') throw new Error('Continuous Deployment belum aktif. Isi variable repository ENABLE_CD=true dan siapkan runner Linux berlabel esoria-uts.');
  return deploymentConfig(env);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { checkCdConfig(process.env); console.log('Konfigurasi CI/CD lengkap. Status online runner tetap perlu diperiksa di GitHub.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
