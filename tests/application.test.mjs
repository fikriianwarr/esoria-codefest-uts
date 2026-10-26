import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApplication } from '../app/server.mjs';

let app,base,dir;
const ADMIN_PASSWORD='Test-Only-Esoria-2026!';
const fixture={name:'Peserta Uji',institution:'Kampus Pengujian',password:'Peserta-Uji-2026!'};
function client(){
  let cookie='',csrf='';
  return {async call(route,{method='GET',body,token=true,origin,raw}={}){
    const headers={};if(cookie)headers.Cookie=cookie;if(csrf&&token)headers['X-CSRF-Token']=csrf;if(origin)headers.Origin=origin;
    if(body!==undefined||raw!==undefined)headers['Content-Type']='application/json';
    const response=await fetch(base+route,{method,headers,body:raw??(body!==undefined?JSON.stringify(body):undefined)});
    const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0];
    const type=response.headers.get('content-type')||'';
    const data=type.includes('application/json')?await response.json():await response.text();
    if(data?.csrf)csrf=data.csrf;
    return {status:response.status,data,headers:response.headers};
  }};
}
async function start(){app=await createApplication({dataDir:dir,adminEmail:'admin@test.example',adminPassword:ADMIN_PASSWORD,release:'test-commit'});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');base=`http://127.0.0.1:${app.server.address().port}`;}
async function close(){await new Promise(resolve=>app.server.close(resolve));}
async function signup(name){const c=client();const r=await c.call('/api/auth/register',{method:'POST',body:{...fixture,email:`${name}@test.example`}});assert.equal(r.status,201,r.data.error);return c;}
const admin=client();let alice,bob,aliceId,regId;
const dates=()=>{const d=n=>new Date(Date.now()+n*86400000).toISOString();return{opensAt:d(-1),closesAt:d(10),startsAt:d(11),endsAt:d(20)}};
const eventBody=(ev,extra={})=>({title:ev.title,description:ev.description,fee:ev.fee,quota:ev.quota,isOpen:!!ev.is_open,...dates(),...extra});
const registerBody=(eventId='web-01')=>({eventId,paymentReference:'LATIHAN-001',paymentNote:'Data pengujian otomatis.'});

before(async()=>{dir=await mkdtemp(path.join(tmpdir(),'esoria-test-'));await start();});
after(async()=>{await close();await rm(dir,{recursive:true,force:true});});

test('layanan sehat, rilis cocok, dan halaman langsung tersedia',async()=>{
  const c=client();assert.equal((await c.call('/api/health')).data.database,'ok');assert.equal((await c.call('/api/release')).data.commit,'test-commit');
  const home=await c.call('/');assert.equal(home.status,200);assert.match(home.data,/<html lang="id">/);assert.match(home.headers.get('content-security-policy'),/default-src 'self'/);
  for(const route of ['/dashboard','/admin','/kategori','/styles.css','/app.js','/assets/logo_esoria.webp'])assert.equal((await fetch(base+route)).status,200);
});
test('file konfigurasi dan referensi Firebase tidak disajikan',async()=>{
  for(const route of ['/.env','/referensi/firebase-asli/public/firebase-config.js','/data/esoria.sqlite','/tidak-ada','/server.mjs','/%2e%2e%2fserver.mjs'])assert.equal((await fetch(base+route)).status,404,route);
});
test('data privat memerlukan login',async()=>{for(const route of ['/api/registrations','/api/admin/overview','/api/admin/operations'])assert.equal((await client().call(route)).status,401);});
test('admin tidak memakai kata sandi bawaan; login salah ditolak',async()=>{
  assert.equal((await admin.call('/api/auth/login',{method:'POST',body:{email:'admin@test.example',password:'salah'}})).status,401);
  const r=await admin.call('/api/auth/login',{method:'POST',body:{email:'ADMIN@TEST.EXAMPLE',password:ADMIN_PASSWORD}});assert.equal(r.status,200);assert.equal(r.data.user.role,'admin');assert.ok(!r.data.user.password_hash);
  assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/SameSite=Strict/);
});
test('validasi email, sandi, JSON, dan origin bekerja',async()=>{
  const c=client();assert.equal((await c.call('/api/auth/register',{method:'POST',body:{...fixture,email:'tidak-valid'}})).status,400);
  assert.equal((await c.call('/api/auth/register',{method:'POST',body:{...fixture,email:'invalid@test.example',password:'short'}})).status,400);
  assert.equal((await c.call('/api/auth/register',{method:'POST',raw:'{tidak valid'})).status,400);
  assert.equal((await c.call('/api/auth/register',{method:'POST',body:{...fixture,email:'x@test.example'},origin:'https://situs-lain.example'})).status,403);
});
test('akun peserta dibuat dan peran admin dari klien diabaikan',async()=>{
  alice=client();const r=await alice.call('/api/auth/register',{method:'POST',body:{...fixture,email:'alice@test.example',role:'admin'}});assert.equal(r.status,201);assert.equal(r.data.user.role,'participant');aliceId=r.data.user.id;
  bob=await signup('bob');assert.equal((await alice.call('/api/session')).data.user.id,aliceId);
});
test('email duplikat ditolak tanpa membuat akun tambahan',async()=>{assert.equal((await client().call('/api/auth/register',{method:'POST',body:{...fixture,email:'ALICE@test.example'}})).status,409);});
test('peserta ditolak pada endpoint admin meski memiliki sesi',async()=>{
  assert.equal((await alice.call('/api/admin/overview')).status,403);
  assert.equal((await alice.call('/api/admin/operations')).status,403);
  assert.equal((await alice.call('/api/admin/registrations/fake',{method:'PATCH',body:{status:'approved'}})).status,403);
});
test('mutasi memerlukan CSRF dan profil diperbarui tanpa mengganti peran',async()=>{
  assert.equal((await alice.call('/api/profile',{method:'PATCH',token:false,body:{name:'Nama Baru',institution:'Kampus Baru'}})).status,403);
  const r=await alice.call('/api/profile',{method:'PATCH',body:{name:'Alice Uji',institution:'Kampus Baru',phone:'+62 812-1234',role:'admin'}});assert.equal(r.status,200);assert.equal(r.data.user.name,'Alice Uji');assert.equal(r.data.user.role,'participant');
  assert.equal((await alice.call('/api/profile',{method:'PATCH',body:{name:'Alice',institution:'Kampus',phone:'<script>'}})).status,400);
});
test('pendaftaran mengambil biaya dari server dan memiliki status awal pending',async()=>{
  const r=await alice.call('/api/registrations',{method:'POST',body:{...registerBody(),fee:1,status:'approved',userId:'lain'}});assert.equal(r.status,201,r.data.error);
  regId=r.data.registration.id;assert.equal(r.data.registration.fee,150000);assert.equal(r.data.registration.status,'pending');assert.equal(r.data.registration.user_id,aliceId);
  assert.equal((await alice.call('/api/registrations',{method:'POST',body:registerBody()})).status,409);
});
test('data pendaftaran dan aksi privat tidak dapat diakses peserta lain',async()=>{
  assert.equal((await bob.call('/api/registrations')).data.registrations.length,0);
  assert.equal((await bob.call(`/api/registrations/${regId}/cancel`,{method:'POST',body:{}})).status,404);
  assert.equal((await bob.call(`/api/registrations/${regId}/submission`,{method:'POST',body:{url:'https://example.org'}})).status,404);
});
test('pendaftaran yang belum disetujui tidak dapat mengirim karya',async()=>{assert.equal((await alice.call(`/api/registrations/${regId}/submission`,{method:'POST',body:{url:'https://example.org'}})).status,409);});
test('kuota, jadwal, dan penutupan kategori diperiksa pada server',async()=>{
  let ev=(await admin.call('/api/events')).data.events.find(e=>e.id==='web-01');
  assert.equal((await admin.call('/api/admin/events/web-01',{method:'PATCH',body:eventBody(ev,{quota:1})})).status,200);
  assert.equal((await bob.call('/api/registrations',{method:'POST',body:registerBody()})).status,409);
  assert.equal((await admin.call('/api/admin/events/web-01',{method:'PATCH',body:eventBody(ev,{isOpen:false})})).status,200);
  assert.equal((await bob.call('/api/registrations',{method:'POST',body:registerBody()})).status,409);
  assert.equal((await admin.call('/api/admin/events/web-01',{method:'PATCH',body:eventBody(ev,{quota:3})})).status,200);
});
test('admin menyetujui sekali, keputusan ulang ditolak, dan tiket mengikuti status',async()=>{
  assert.equal((await admin.call(`/api/admin/registrations/${regId}`,{method:'PATCH',body:{status:'approved',note:'Referensi latihan sesuai.'}})).status,200);
  assert.equal((await admin.call(`/api/admin/registrations/${regId}`,{method:'PATCH',body:{status:'rejected',note:'Keputusan ulang'}})).status,409);
  const r=(await alice.call('/api/registrations')).data.registrations[0];assert.equal(r.status,'approved');assert.match(r.ticket,/^ECF-/);
  assert.equal((await alice.call(`/api/registrations/${regId}/cancel`,{method:'POST',body:{}})).status,409);
});
test('tautan HTTPS disimpan, skema berbahaya ditolak',async()=>{
  assert.equal((await alice.call(`/api/registrations/${regId}/submission`,{method:'POST',body:{url:'javascript:alert(1)'}})).status,400);
  assert.equal((await alice.call(`/api/registrations/${regId}/submission`,{method:'POST',body:{url:'http://example.org'}})).status,400);
  assert.equal((await alice.call(`/api/registrations/${regId}/submission`,{method:'POST',body:{url:'https://example.org/karya',note:'Karya pengujian'}})).status,200);
  assert.equal((await alice.call('/api/registrations')).data.registrations[0].submission_url,'https://example.org/karya');
});
test('penolakan perlu alasan dan melepas kuota',async()=>{
  const r=await bob.call('/api/registrations',{method:'POST',body:registerBody()});assert.equal(r.status,201);const id=r.data.registration.id;
  const before=(await client().call('/api/events')).data.events.find(e=>e.id==='web-01').remaining;
  assert.equal((await admin.call(`/api/admin/registrations/${id}`,{method:'PATCH',body:{status:'rejected',note:''}})).status,400);
  assert.equal((await admin.call(`/api/admin/registrations/${id}`,{method:'PATCH',body:{status:'rejected',note:'Kode latihan tidak cocok.'}})).status,200);
  assert.equal((await client().call('/api/events')).data.events.find(e=>e.id==='web-01').remaining,before+1);
});
test('pendaftaran tim harus 2–4 orang dengan email unik',async()=>{
  const baseBody={...registerBody('team-01'),teamName:'Tim Uji'};
  assert.equal((await alice.call('/api/registrations',{method:'POST',body:{...baseBody,members:[]}})).status,400);
  assert.equal((await alice.call('/api/registrations',{method:'POST',body:{...baseBody,members:[{name:'Alice',email:'alice@test.example'}]}})).status,400);
  const r=await alice.call('/api/registrations',{method:'POST',body:{...baseBody,members:[{name:'Anggota Uji',email:'anggota@test.example'}]}});assert.equal(r.status,201);assert.equal(r.data.registration.members.length,1);
});
test('pembatalan hanya satu kali dan melepas slot',async()=>{
  const r=await bob.call('/api/registrations',{method:'POST',body:registerBody('cyber-01')});assert.equal(r.status,201);const id=r.data.registration.id;
  const before=(await bob.call('/api/events')).data.events.find(e=>e.id==='cyber-01').remaining;
  assert.equal((await bob.call(`/api/registrations/${id}/cancel`,{method:'POST',body:{}})).status,200);
  assert.equal((await bob.call(`/api/registrations/${id}/cancel`,{method:'POST',body:{}})).status,409);
  assert.equal((await bob.call('/api/events')).data.events.find(e=>e.id==='cyber-01').remaining,before+1);
});
test('tanggal tidak berurutan dan kuota di bawah jumlah aktif ditolak',async()=>{
  const ev=(await admin.call('/api/events')).data.events.find(e=>e.id==='web-01');
  assert.equal((await admin.call('/api/admin/events/web-01',{method:'PATCH',body:eventBody(ev,{closesAt:new Date(0).toISOString()})})).status,400);
  assert.equal((await admin.call('/api/admin/events/web-01',{method:'PATCH',body:eventBody(ev,{quota:0})})).status,400);
  const bobNew=await signup('extra');assert.equal((await bobNew.call('/api/registrations',{method:'POST',body:registerBody()})).status,201);
  assert.equal((await admin.call('/api/admin/events/web-01',{method:'PATCH',body:eventBody(ev,{quota:1})})).status,409);
});
test('dua permintaan bersamaan tidak dapat melampaui kuota terakhir',async()=>{
  const ev=(await admin.call('/api/events')).data.events.find(e=>e.id==='cyber-01');
  assert.equal((await admin.call('/api/admin/events/cyber-01',{method:'PATCH',body:eventBody(ev,{quota:1})})).status,200);
  const c1=await signup('race-one'),c2=await signup('race-two');
  const r=await Promise.all([c1,c2].map(c=>c.call('/api/registrations',{method:'POST',body:registerBody('cyber-01')})));
  assert.deepEqual(r.map(r=>r.status).sort(),[201,409]);
});
test('batas akhir karya tetap diberlakukan setelah disetujui',async()=>{
  const ev=(await admin.call('/api/events')).data.events.find(e=>e.id==='web-01');const past=n=>new Date(Date.now()-n*86400000).toISOString();
  assert.equal((await admin.call('/api/admin/events/web-01',{method:'PATCH',body:eventBody(ev,{opensAt:past(10),closesAt:past(9),startsAt:past(8),endsAt:past(1)})})).status,200);
  assert.equal((await alice.call(`/api/registrations/${regId}/submission`,{method:'POST',body:{url:'https://example.org/late'}})).status,409);
});
test('jejak aktivitas dan operasional berisi data aktual',async()=>{
  const r=await admin.call('/api/admin/overview');assert.ok(r.data.logs.some(l=>l.action==='registration.approved'));assert.ok(r.data.logs.some(l=>l.action==='submission.saved'));
  assert.equal((await admin.call('/api/admin/operations')).data.totalRegistrations,6);
});
test('data, status, karya, sesi, dan pengaturan bertahan setelah proses restart',async()=>{
  await close();await start();
  const r=await alice.call('/api/registrations');assert.equal(r.status,200);const reg=r.data.registrations.find(r=>r.id===regId);assert.equal(reg.status,'approved');assert.equal(reg.submission_url,'https://example.org/karya');
  assert.equal((await admin.call('/api/events')).data.events.find(e=>e.id==='cyber-01').quota,1);
});
test('logout menghapus sesi sehingga permintaan berikutnya ditolak',async()=>{
  assert.equal((await alice.call('/api/auth/logout',{method:'POST',body:{}})).status,200);assert.equal((await alice.call('/api/registrations')).status,401);
});
test('database baru menolak startup tanpa konfigurasi admin',async()=>{
  const d=await mkdtemp(path.join(tmpdir(),'esoria-config-'));try{await assert.rejects(()=>createApplication({dataDir:d,adminEmail:'',adminPassword:''}),/Admin pertama/);}finally{await rm(d,{recursive:true,force:true});}
});
test('password placeholder dari contoh tidak dapat menjadi akun admin',async()=>{
  const d=await mkdtemp(path.join(tmpdir(),'esoria-placeholder-'));try{await assert.rejects(()=>createApplication({dataDir:d,adminEmail:'admin@example.test',adminPassword:'GANTI_DENGAN_PASSWORD_ACAK_12_KARAKTER'}),/Password contoh/);}finally{await rm(d,{recursive:true,force:true});}
});
test('kata sandi dengan spasi di awal/akhir tetap dapat dipakai untuk login',async()=>{
  const c=client(),pass='  Password-Test-2026!  ';
  const r=await c.call('/api/auth/register',{method:'POST',body:{...fixture,email:'spaces@test.example',password:pass}});assert.equal(r.status,201);
  await c.call('/api/auth/logout',{method:'POST',body:{}});
  assert.equal((await c.call('/api/auth/login',{method:'POST',body:{email:'spaces@test.example',password:pass}})).status,200);
});
