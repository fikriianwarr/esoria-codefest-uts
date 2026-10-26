import assert from 'node:assert/strict';
const base=process.argv[2];
const mode=process.argv[3] || 'read';
if(!base || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw new Error('Berikan URL lokal container, misalnya http://127.0.0.1:8080');
let cookie='',csrf='';
async function request(route,body){const response=await fetch(base+route,{signal:AbortSignal.timeout(5000),redirect:'error',method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});const c=response.headers.get('set-cookie');if(c)cookie=c.split(';')[0];const data=await response.json();assert.ok(response.ok,`${route}: ${response.status} ${data.error||''}`);if(data.csrf)csrf=data.csrf;return data;}
const health=await request('/api/health');assert.equal(health.app,'esoria-uts');assert.equal(health.status,'ok');assert.equal(health.database,'ok');
const release=await request('/api/release');assert.ok(release.commit);
if(process.env.ESORIA_SMOKE_EXPECTED_SHA)assert.equal(release.commit,process.env.ESORIA_SMOKE_EXPECTED_SHA,'Commit image uji tidak sesuai source yang dibangun.');
assert.equal((await request('/api/events')).events.length,3);
if(mode==='create') {
  await request('/api/auth/register',{name:'Container Smoke',email:'container-smoke@example.test',password:'Smoke-Container-2026!',institution:'CI sementara'});
  const r=await request('/api/registrations',{eventId:'web-01',paymentReference:'CI-CONTAINER-001'});assert.equal(r.registration.status,'pending');
  console.log('Smoke container: health, aset, akun, dan pendaftaran berhasil.');
}
if(mode==='persist') {
  await request('/api/auth/login',{email:'container-smoke@example.test',password:'Smoke-Container-2026!'});
  const r=await request('/api/registrations');assert.equal(r.registrations.length,1);assert.equal(r.registrations[0].payment_reference,'CI-CONTAINER-001');
  console.log('Persistensi container: data sebelum restart tetap tersedia.');
}
for(const file of ['/','/app.js','/styles.css','/assets/logo_esoria.webp'])assert.equal((await fetch(base+file,{signal:AbortSignal.timeout(5000),redirect:'error'})).status,200,file);
console.log(JSON.stringify({health:health.status,commit:release.commit,mode}));
