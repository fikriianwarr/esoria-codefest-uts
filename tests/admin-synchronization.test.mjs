import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../app/database.mjs';
import { hashPassword, verifyPassword } from '../app/security.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const initial='Admin-Lama-2026!';
const latest='Admin-Baru-2026!';
async function fixture(fn) {
  const dir=await mkdtemp(path.join(tmpdir(),'esoria-admin-sync-'));
  try { return await fn(dir); } finally { await rm(dir,{recursive:true,force:true}); }
}
async function open(dir,email='admin@esoria.test',adminPassword=initial,adminSync=false) {
  return openDatabase({dataDir:dir,adminEmail:email,adminPassword,adminSync});
}
const admin=db=>db.prepare("SELECT * FROM users WHERE role='admin' ORDER BY created_at,id LIMIT 1").get();

test('sinkronisasi lokal memperbaiki login admin dan menjaga peserta, kategori, serta volume lama',async()=>fixture(async dir=>{
  let db=await open(dir);
  const id=admin(db).id;
  db.prepare('INSERT INTO users(id,name,email,password_hash,role,institution,created_at) VALUES(?,?,?,?,?,?,?)')
    .run('u1','Peserta Tetap','peserta@example.test',await hashPassword('Sandi-Peserta-2026!'),'participant','Kampus','2026-01-01');
  db.prepare("UPDATE events SET quota=17 WHERE id='web-01'").run();
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run('sid1',id,'csrf1',Date.now()+100000);
  db.close();
  db=await open(dir,'admin-baru@esoria.test',latest,true);
  assert.equal(admin(db).id,id);
  assert.equal(admin(db).email,'admin-baru@esoria.test');
  assert.equal(await verifyPassword(latest,admin(db).password_hash),true);
  assert.equal(await verifyPassword(initial,admin(db).password_hash),false);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id=?').get(id).n,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users WHERE role=\'participant\'').get().n,1);
  assert.equal(db.prepare("SELECT quota FROM events WHERE id='web-01'").get().quota,17);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action='admin.credentials.reconciled'").get().n,1);
  db.close();
  db=await open(dir,'admin-baru@esoria.test',latest,true);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action='admin.credentials.reconciled'").get().n,1);
  db.close();
}));

test('sinkronisasi hanya aktif pada opt-in dan tidak menyetel ulang sandi server produksi',async()=>fixture(async dir=>{
  let db=await open(dir);db.close();
  db=await open(dir,'another@esoria.test',latest,false);
  assert.equal(admin(db).email,'admin@esoria.test');
  assert.equal(await verifyPassword(initial,admin(db).password_hash),true);
  db.close();
}));

test('email yang telah dipakai peserta tidak mengambil alih hak admin',async()=>fixture(async dir=>{
  let db=await open(dir);
  db.prepare('INSERT INTO users(id,name,email,password_hash,role,institution,created_at) VALUES(?,?,?,?,?,?,?)')
    .run('u2','Peserta Dua','peserta@example.test',await hashPassword('Sandi-Peserta-2026!'),'participant','Kampus','2026-01-01');
  db.close();
  await assert.rejects(open(dir,'peserta@example.test',latest,true),/sudah digunakan akun lain/);
  db=await open(dir);assert.equal(admin(db).email,'admin@esoria.test');
  assert.equal(db.prepare('SELECT role FROM users WHERE id=?').get('u2').role,'participant');
  db.close();
}));

test('sandi contoh dan sandi lemah tidak dapat mengganti admin dan data tidak dihapus',async()=>fixture(async dir=>{
  let db=await open(dir);db.close();
  await assert.rejects(open(dir,'admin@esoria.test','GANTI_DENGAN_PASSWORD_ACAK_12_KARAKTER',true),/contoh/);
  await assert.rejects(open(dir,'admin@esoria.test','short',true),/12–128/);
  db=await open(dir);
  assert.equal(await verifyPassword(initial,admin(db).password_hash),true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,3);
  db.close();
}));

test('perintah pemulihan CLI memperbaiki sandi lokal tanpa mencetak kata sandi',async()=>fixture(async dir=>{
  let db=await open(dir);db.close();
  const result=spawnSync(process.execPath,['app/admin-repair.mjs'],{
    cwd:root,encoding:'utf8',env:{...process.env,DATA_DIR:dir,ADMIN_EMAIL:'admin@esoria.test',ADMIN_PASSWORD:latest}
  });
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/diselaraskan/);
  assert.ok(!result.stdout.includes(latest));
  db=await open(dir);
  assert.equal(await verifyPassword(latest,admin(db).password_hash),true);
  db.close();
}));

test('login API admin dapat masuk dengan sandi .env terbaru setelah restart lokal',async()=>fixture(async dir=>{
  const {createApplication}=await import('../app/server.mjs');
  const {once}=await import('node:events');
  async function boot(pw) {
    const app=await createApplication({dataDir:dir,adminEmail:'admin@esoria.test',adminPassword:pw,adminSync:true});
    app.server.listen(0,'127.0.0.1');
    await once(app.server,'listening');
    return {app,base:`http://127.0.0.1:${app.server.address().port}`};
  }
  const login=(base,pw)=>fetch(base+'/api/auth/login',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:'ADMIN@ESORIA.TEST',password:pw})
  });
  let running=await boot(initial);
  assert.equal((await login(running.base,initial)).status,200);
  await new Promise(resolve=>running.app.server.close(resolve));
  running=await boot(latest);
  const current=await login(running.base,latest);
  assert.equal(current.status,200);
  const session=await current.json();
  assert.equal(session.user.role,'admin');
  assert.equal((await login(running.base,initial)).status,401);
  const overview=await fetch(running.base+'/api/admin/overview',{
    headers:{Cookie:current.headers.get('set-cookie').split(';')[0]}
  });
  assert.equal(overview.status,200);
  assert.ok(Array.isArray((await overview.json()).events));
  await new Promise(resolve=>running.app.server.close(resolve));
}));
