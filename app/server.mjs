import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './database.mjs';
import { HttpError, digest, token, text, email, password, hashPassword, verifyPassword, integer, webUrl } from './security.mjs';

const publicDir = fileURLToPath(new URL('./public/', import.meta.url));
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png' };
const routes = new Set(['/', '/kategori', '/masuk', '/buat-akun', '/dashboard', '/daftar', '/profil', '/admin', '/operasional', '/panduan', '/tiket']);
const statusLabels = { pending:'Menunggu verifikasi', approved:'Disetujui', rejected:'Ditolak', cancelled:'Dibatalkan' };
const SESSION_AGE = 8 * 60 * 60 * 1000;
const now = () => new Date().toISOString();
const userView = u => ({ id:u.id, name:u.name, email:u.email, role:u.role, institution:u.institution, phone:u.phone, createdAt:u.created_at });

export async function createApplication(options = {}) {
  const config = {
    dataDir: options.dataDir || process.env.DATA_DIR || path.resolve('data'),
    adminEmail: options.adminEmail ?? process.env.ADMIN_EMAIL,
    adminPassword: options.adminPassword ?? process.env.ADMIN_PASSWORD,
    secureCookie: options.secureCookie ?? process.env.COOKIE_SECURE === 'true',
    adminSync: options.adminSync ?? process.env.ADMIN_SYNC_ON_START === 'true',
    release: options.release || process.env.RELEASE_SHA || 'local',
    appName: process.env.APP_NAME || 'ESORIA CodeFest',
    ...options
  };
  const db = await openDatabase(config);
  const started = Date.now();
  const limits = new Map();
  let dummyHash = await hashPassword(token());
  const log = (uid, action, target, details = '') => db.prepare('INSERT INTO audit_logs(user_id,action,target,details,created_at) VALUES(?,?,?,?,?)').run(uid || null, action, target, details, now());
  const events = () => db.prepare(`SELECT e.*, COUNT(CASE WHEN r.status IN ('pending','approved') THEN 1 END) AS reserved,
    COUNT(CASE WHEN r.status='approved' THEN 1 END) AS approved FROM events e LEFT JOIN registrations r ON r.event_id=e.id GROUP BY e.id
    ORDER BY CASE e.category WHEN 'web' THEN 0 WHEN 'cyber' THEN 1 ELSE 2 END,e.id`).all()
    .map(e => ({ ...e, remaining:Math.max(0,e.quota-e.reserved), registrationOpen:!!e.is_open && now()>=e.opens_at && now()<=e.closes_at && e.reserved<e.quota }));
  const registrationList = (uid = null) => db.prepare(`SELECT r.*, e.title AS event_title,e.category,e.starts_at,e.ends_at,
    u.name AS participant_name,u.email AS participant_email,u.institution FROM registrations r
    JOIN events e ON r.event_id=e.id JOIN users u ON r.user_id=u.id ${uid ? 'WHERE r.user_id=?' : ''} ORDER BY r.created_at DESC`).all(...(uid ? [uid] : []))
    .map(r => ({ ...r, members:JSON.parse(r.members), status_label:statusLabels[r.status] }));
  function limit(req, action, max = 20) {
    // Bound memory and use socket identity; forwarded headers are not trusted.
    if (limits.size > 5000) for (const [k,v] of limits) if(v.until<Date.now()) limits.delete(k);
    const key = `${req.socket.remoteAddress}:${action}`;
    let item = limits.get(key);
    if (!item || item.until < Date.now()) item = { count:0, until:Date.now()+600000 };
    item.count++; limits.set(key,item);
    if (item.count > max) throw new HttpError(429,'Terlalu banyak percobaan. Coba lagi dalam 10 menit.');
  }
  function session(req) {
    const raw = /(?:^|;\s*)esoria_session=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '')?.[1];
    if (!raw) return null;
    const s = db.prepare('SELECT s.csrf,s.expires_at,s.token_hash,u.* FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=?').get(digest(raw));
    if (!s || s.expires_at <= Date.now()) return null;
    return s;
  }
  const requireUser = (s, role) => {
    if(!s) throw new HttpError(401,'Masuk ke akunmu terlebih dahulu.');
    if(role && s.role!==role) throw new HttpError(403,'Halaman ini hanya dapat diakses admin.');
    return s;
  };
  function cookie(res, value, maxAge = SESSION_AGE / 1000) {
    res.setHeader('Set-Cookie', `esoria_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.secureCookie ? '; Secure' : ''}`);
  }
  function login(res, user) {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    const raw=token(), csrf=token();
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(raw),user.id,csrf,Date.now()+SESSION_AGE);
    cookie(res,raw);
    return { user:userView(user),csrf };
  }
  async function jsonBody(req) {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415,'Gunakan isi permintaan JSON.');
    let size=0; const chunks=[];
    for await(const chunk of req) { size+=chunk.length; if(size>32768) throw new HttpError(413,'Data yang dikirim terlalu besar.'); chunks.push(chunk); }
    try { const body=JSON.parse(Buffer.concat(chunks).toString()); if(!body || typeof body!=='object' || Array.isArray(body)) throw new Error(); return body; }
    catch { throw new HttpError(400,'Format data JSON tidak valid.'); }
  }
  function safeWrite(req,s) {
    if(req.headers['sec-fetch-site']==='cross-site') throw new HttpError(403,'Permintaan lintas situs ditolak.');
    if(req.headers.origin) {
      let origin;
      try { origin=new URL(req.headers.origin); } catch { throw new HttpError(403,'Origin tidak valid.'); }
      if(origin.host!==req.headers.host) throw new HttpError(403,'Origin permintaan tidak sesuai.');
    }
    if(s && req.headers['x-csrf-token']!==s.csrf) throw new HttpError(403,'Sesi formulir berubah. Muat ulang halaman dan coba lagi.');
  }
  const send = (res,code,data) => {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data));};
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const value=fn(); db.exec('COMMIT'); return value; } catch(error) { db.exec('ROLLBACK'); throw error; }
  }
  async function api(req,res,url) {
    const p=url.pathname, method=req.method, s=session(req);
    if (!['GET','HEAD','POST','PATCH'].includes(method)) throw new HttpError(405,'Metode tidak diizinkan.');
    if(method==='GET' && p==='/api/health') {
      db.prepare('SELECT 1 AS ok').get();
      return send(res,200,{ status:'ok',app:'esoria-uts',database:'ok',uptimeSeconds:Math.floor((Date.now()-started)/1000) });
    }
    if(method==='GET' && p==='/api/release') return send(res,200,{version:'1.0.0',commit:config.release,appName:config.appName});
    if(method==='GET' && p==='/api/session') return send(res,200,{user:s?userView(s):null,csrf:s?.csrf||null});
    if(method==='GET' && p==='/api/events') return send(res,200,{events:events()});
    if(method==='GET' && p==='/api/registrations') {requireUser(s);return send(res,200,{registrations:registrationList(s.id)});}
    if(method==='GET' && p==='/api/admin/overview') {
      requireUser(s,'admin');
      return send(res,200,{registrations:registrationList(),events:events(),participants:db.prepare("SELECT COUNT(*) AS total FROM users WHERE role='participant'").get().total,
        logs:db.prepare('SELECT a.*,u.name FROM audit_logs a LEFT JOIN users u ON a.user_id=u.id ORDER BY a.id DESC LIMIT 80').all()});
    }
    if(method==='GET' && p==='/api/admin/operations') {
      requireUser(s,'admin');
      return send(res,200,{status:'ok',database:'SQLite / WAL',storage:'Volume persisten',schemaVersion:db.prepare('PRAGMA user_version').get().user_version,
        release:config.release,uptimeSeconds:Math.floor((Date.now()-started)/1000),nodeVersion:process.version,secureCookie:config.secureCookie,
        totalRegistrations:db.prepare('SELECT COUNT(*) AS total FROM registrations').get().total});
    }
    if(!['POST','PATCH'].includes(method)) throw new HttpError(404,'Endpoint tidak ditemukan.');
    safeWrite(req,s);
    const body=await jsonBody(req);
    if(method==='POST' && p==='/api/auth/register') {
      limit(req,'register',15);
      const name=text(body.name,'Nama lengkap',2,100), addr=email(body.email), pw=password(body.password);
      const institution=text(body.institution,'Asal institusi',2,150);
      if(db.prepare('SELECT id FROM users WHERE email=?').get(addr)) throw new HttpError(409,'Email ini sudah terdaftar. Silakan masuk.');
      const id=randomUUID(), hash=await hashPassword(pw);
      try {db.prepare('INSERT INTO users(id,name,email,password_hash,role,institution,created_at) VALUES(?,?,?,?,?,?,?)').run(id,name,addr,hash,'participant',institution,now());}
      catch(error) { if(error.code==='ERR_SQLITE_ERROR' && error.message.includes('UNIQUE')) throw new HttpError(409,'Email ini sudah terdaftar.'); throw error; }
      log(id,'account.created',id);
      return send(res,201,login(res,db.prepare('SELECT * FROM users WHERE id=?').get(id)));
    }
    if(method==='POST' && p==='/api/auth/login') {
      limit(req,'login',30);
      const addr=email(body.email);
      if(typeof body.password!=='string' || body.password.length<1 || body.password.length>128) throw new HttpError(400,'Kata sandi belum valid.');
      const pw=body.password;
      const u=db.prepare('SELECT * FROM users WHERE email=?').get(addr);
      if(!await verifyPassword(pw,u?.password_hash || dummyHash) || !u) throw new HttpError(401,'Email atau kata sandi tidak cocok.');
      log(u.id,'account.login',u.id);
      return send(res,200,login(res,u));
    }
    if(method==='POST' && p==='/api/auth/logout') {
      requireUser(s);db.prepare('DELETE FROM sessions WHERE token_hash=?').run(s.token_hash);cookie(res,'',0);return send(res,200,{ok:true});
    }
    if(method==='PATCH' && p==='/api/profile') {
      requireUser(s);
      const name=text(body.name,'Nama lengkap',2,100), institution=text(body.institution,'Asal institusi',2,150);
      const phone=body.phone?text(body.phone,'Nomor telepon',8,25):'';
      if(phone && !/^[+0-9 ()-]+$/.test(phone)) throw new HttpError(400,'Nomor telepon hanya boleh berisi angka dan tanda telepon.');
      db.prepare('UPDATE users SET name=?,institution=?,phone=? WHERE id=?').run(name,institution,phone,s.id);log(s.id,'profile.updated',s.id);
      return send(res,200,{user:userView(db.prepare('SELECT * FROM users WHERE id=?').get(s.id))});
    }
    if(method==='POST' && p==='/api/registrations') {
      requireUser(s);if(s.role!=='participant') throw new HttpError(403,'Pendaftaran menggunakan akun peserta.');
      const eventId=text(body.eventId,'Kategori',1,80);
      const e=db.prepare('SELECT * FROM events WHERE id=?').get(eventId);
      if(!e) throw new HttpError(404,'Kategori tidak ditemukan.');
      const reference=text(body.paymentReference,'Referensi pembayaran latihan',3,80);
      const note=body.paymentNote?text(body.paymentNote,'Catatan pembayaran',1,500):'';
      let teamName='', members=[];
      if(e.category==='team') {
        teamName=text(body.teamName,'Nama tim',2,80);
        if(!Array.isArray(body.members) || body.members.length<1 || body.members.length>3) throw new HttpError(400,'Tim harus berisi 2–4 orang termasuk ketua. Isi 1–3 anggota tambahan.');
        members=body.members.map(m=>({name:text(m.name,'Nama anggota',2,100),email:email(m.email)}));
        const addresses=[s.email,...members.map(m=>m.email)];
        if(new Set(addresses).size!==addresses.length) throw new HttpError(400,'Email setiap anggota dan ketua harus berbeda.');
      }
      const id=randomUUID(), ticket=`ECF-${Date.now().toString(36).toUpperCase()}-${token().slice(0,5).toUpperCase()}`;
      transaction(()=>{
        if(!e.is_open || now()<e.opens_at || now()>e.closes_at) throw new HttpError(409,'Pendaftaran kategori ini sedang ditutup.');
        if(db.prepare('SELECT id FROM registrations WHERE user_id=? AND event_id=?').get(s.id,eventId)) throw new HttpError(409,'Kamu sudah memiliki pendaftaran pada kategori ini.');
        const count=db.prepare("SELECT COUNT(*) AS n FROM registrations WHERE event_id=? AND status IN ('pending','approved')").get(eventId).n;
        if(count>=e.quota) throw new HttpError(409,'Kuota kategori ini sudah penuh.');
        db.prepare('INSERT INTO registrations(id,ticket,user_id,event_id,team_name,members,fee,payment_reference,payment_note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
          .run(id,ticket,s.id,eventId,teamName,JSON.stringify(members),e.fee,reference,note,now(),now());
        log(s.id,'registration.created',id,e.title);
      });
      return send(res,201,{registration:registrationList(s.id).find(r=>r.id===id)});
    }
    const cancel=/^\/api\/registrations\/([\w-]+)\/cancel$/.exec(p);
    if(method==='POST' && cancel) {
      requireUser(s); const r=db.prepare('SELECT * FROM registrations WHERE id=? AND user_id=?').get(cancel[1],s.id);
      if(!r) throw new HttpError(404,'Pendaftaran tidak ditemukan.');
      if(r.status!=='pending') throw new HttpError(409,'Hanya pendaftaran yang menunggu verifikasi dapat dibatalkan.');
      db.prepare("UPDATE registrations SET status='cancelled',updated_at=? WHERE id=?").run(now(),r.id);log(s.id,'registration.cancelled',r.id);return send(res,200,{ok:true});
    }
    const submission=/^\/api\/registrations\/([\w-]+)\/submission$/.exec(p);
    if(method==='POST' && submission) {
      requireUser(s); const r=db.prepare('SELECT r.*,e.ends_at FROM registrations r JOIN events e ON r.event_id=e.id WHERE r.id=? AND r.user_id=?').get(submission[1],s.id);
      if(!r) throw new HttpError(404,'Pendaftaran tidak ditemukan.');
      if(r.status!=='approved') throw new HttpError(409,'Karya hanya dapat dikirim setelah pendaftaran disetujui.');
      if(now()>r.ends_at) throw new HttpError(409,'Batas pengiriman karya sudah berakhir.');
      const link=webUrl(body.url), note=body.note?text(body.note,'Catatan karya',1,1000):'';
      db.prepare('UPDATE registrations SET submission_url=?,submission_note=?,submitted_at=?,updated_at=? WHERE id=?').run(link,note,now(),now(),r.id);
      log(s.id,'submission.saved',r.id);return send(res,200,{ok:true});
    }
    const review=/^\/api\/admin\/registrations\/([\w-]+)$/.exec(p);
    if(method==='PATCH' && review) {
      requireUser(s,'admin'); const decision=body.status;
      if(!['approved','rejected'].includes(decision)) throw new HttpError(400,'Keputusan admin tidak valid.');
      const note=body.note?text(body.note,'Catatan admin',1,500):'';
      if(decision==='rejected' && note.length<5) throw new HttpError(400,'Alasan penolakan minimal 5 karakter.');
      transaction(()=>{
        const r=db.prepare('SELECT * FROM registrations WHERE id=?').get(review[1]);
        if(!r) throw new HttpError(404,'Pendaftaran tidak ditemukan.');
        if(r.status!=='pending') throw new HttpError(409,'Pendaftaran ini sudah diproses. Muat ulang data.');
        db.prepare('UPDATE registrations SET status=?,review_note=?,reviewed_by=?,updated_at=? WHERE id=?').run(decision,note,s.id,now(),r.id);
        log(s.id,`registration.${decision}`,r.id,note);
      });
      return send(res,200,{ok:true});
    }
    const eventRoute=/^\/api\/admin\/events\/([\w-]+)$/.exec(p);
    if(method==='PATCH' && eventRoute) {
      requireUser(s,'admin');const e=db.prepare('SELECT * FROM events WHERE id=?').get(eventRoute[1]);
      if(!e) throw new HttpError(404,'Kategori tidak ditemukan.');
      const title=text(body.title,'Judul kategori',3,100), description=text(body.description,'Deskripsi',20,1500);
      const quota=integer(body.quota,'Kuota',1,10000), fee=integer(body.fee,'Biaya',0,100000000);
      if(typeof body.isOpen!=='boolean') throw new HttpError(400,'Status pendaftaran tidak valid.');
      const dates=['opensAt','closesAt','startsAt','endsAt'].map(k=>{
        if(typeof body[k]!=='string' || !Number.isFinite(Date.parse(body[k]))) throw new HttpError(400,'Tanggal belum valid.');
        return new Date(body[k]).toISOString();
      });
      if(!(dates[0]<dates[1] && dates[1]<=dates[2] && dates[2]<dates[3])) throw new HttpError(400,'Urutan tanggal harus: buka < tutup ≤ mulai < selesai.');
      transaction(()=>{
        const count=db.prepare("SELECT COUNT(*) AS n FROM registrations WHERE event_id=? AND status IN ('pending','approved')").get(e.id).n;
        if(quota<count) throw new HttpError(409,'Kuota tidak boleh lebih kecil dari pendaftaran aktif.');
        db.prepare('UPDATE events SET title=?,description=?,quota=?,fee=?,is_open=?,opens_at=?,closes_at=?,starts_at=?,ends_at=? WHERE id=?')
          .run(title,description,quota,fee,body.isOpen?1:0,...dates,e.id);
        log(s.id,'event.updated',e.id,title);
      });return send(res,200,{ok:true});
    }
    throw new HttpError(404,'Endpoint tidak ditemukan.');
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url=new URL(req.url,'http://local.invalid');
      if(url.pathname.startsWith('/api/')) return await api(req,res,url);
      if(!['GET','HEAD'].includes(req.method)) throw new HttpError(405,'Metode tidak diizinkan.');
      let filename;
      if(routes.has(url.pathname)) filename=path.join(publicDir,'index.html');
      else {
        let decoded;
        try {decoded=decodeURIComponent(url.pathname);} catch {throw new HttpError(400,'Alamat tidak valid.');}
        filename=path.resolve(publicDir,`.${decoded}`);
        if(!filename.startsWith(publicDir) || !mime[path.extname(filename)]) throw new HttpError(404,'Halaman tidak ditemukan.');
      }
      if(!(await stat(filename)).isFile()) throw new HttpError(404,'Halaman tidak ditemukan.');
      const content=await readFile(filename);
      res.writeHead(200,{'Content-Type':mime[path.extname(filename)]});res.end(req.method==='HEAD'?undefined:content);
    } catch(error) {
      const code=error instanceof HttpError?error.status:error.code==='ENOENT'?404:500;
      if(code===500) console.error(JSON.stringify({level:'error',message:error.message}));
      if(!res.headersSent) send(res,code,{error:code===500?'Terjadi kesalahan. Coba kembali beberapa saat lagi.':error.message});
      else res.end();
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  server.on('close',()=>{db.close();dummyHash='';limits.clear();});
  return {server,db,config};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const port=Number(process.env.PORT || 3000);
    if(!Number.isInteger(port) || port<1 || port>65535) throw new Error('PORT tidak valid.');
    const {server}=await createApplication();
    server.listen(port,process.env.HOST || '0.0.0.0',()=>console.log(JSON.stringify({level:'info',message:'ESORIA siap',port,release:process.env.RELEASE_SHA || 'local'})));
    for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
