import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [major,minor,patch]=process.versions.node.split('.').map(Number);
if(major!==24 || minor<22 || (minor===22 && patch<1)) {
  throw new Error('Gunakan Node.js 24.22.1 atau versi 24 yang lebih baru, kemudian jalankan setup lagi.');
}
const root=fileURLToPath(new URL('../',import.meta.url));
const envPath=path.join(root,'.env');
if(existsSync(envPath)) {
  console.log('Konfigurasi .env sudah ada dan dipertahankan. Kata sandi admin tidak direset.');
} else {
  const password=`EcF-${randomBytes(18).toString('base64url')}7`;
  const content=readFileSync(path.join(root,'.env.example'),'utf8').replace('GANTI_DENGAN_PASSWORD_ACAK_12_KARAKTER',password);
  writeFileSync(envPath,content,{flag:'wx',mode:0o600});
  console.log('Konfigurasi awal berhasil dibuat. Simpan kredensial berikut secara pribadi.');
  console.log('Alamat website akan ditampilkan setelah container siap.');
  console.log('Email admin: admin@esoria.test');
  console.log(`Kata sandi admin: ${password}`);
  console.log('Kata sandi disimpan pada .env. Jangan unggah .env ke repository atau laporan.');
}
