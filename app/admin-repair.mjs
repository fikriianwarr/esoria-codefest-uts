// Local operator-only command: docker compose run --rm --no-deps web node app/admin-repair.mjs
import path from 'node:path';
import { openDatabase } from './database.mjs';

try {
  const db = await openDatabase({
    dataDir: process.env.DATA_DIR || path.resolve('data'),
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
    adminSync: true
  });
  const admin = db.prepare("SELECT email FROM users WHERE role='admin' ORDER BY created_at,id LIMIT 1").get();
  db.close();
  console.log(`Akses admin diselaraskan: ${admin.email}`);
  console.log('Gunakan ADMIN_EMAIL dan ADMIN_PASSWORD dari .env pribadi untuk masuk.');
  console.log('Data peserta dan pendaftaran tetap dipertahankan.');
} catch (error) {
  console.error(`Pemulihan admin gagal: ${error.message}`);
  process.exitCode = 1;
}
