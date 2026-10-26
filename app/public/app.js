const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e = escapeHtml;
const money = value => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
const date = value => new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(value));
const dateTime = value => new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date(value));
const state = { user:null, csrf:null, events:[], registrations:[], admin:null, release:null, adminTab:'registrations', filter:'all', search:'' };
const codes = {web:'</>',cyber:'SEC',team:'FS'};
const categoryNames = {web:'Individu · Web',cyber:'Individu · Keamanan',team:'Tim · 2–4 orang'};
let renderVersion=0, toastTimer;

let confirmationResolve = null;
let openedFormSnapshot = null;
function formSnapshot(form) {
  return form ? JSON.stringify({ entries:[...new FormData(form)], checkboxes:[...form.querySelectorAll('input[type="checkbox"]')].map(c=>c.checked),
    members:[...form.querySelectorAll('[data-member]')].map(row=>[...row.querySelectorAll('input')].map(i=>i.value)) }) : null;
}
function confirmAction({ title, message, accept='Ya, lanjutkan', danger=false }) {
  const dialog=$('#confirm-dialog');
  if (dialog.open || confirmationResolve) return Promise.resolve(false);
  $('#confirm-title').textContent=title;
  $('#confirm-message').textContent=message;
  $('#confirm-yes').textContent=accept;
  $('#confirm-yes').className=`btn ${danger?'danger':'green'}`;
  dialog.showModal();
  $('#confirm-no').focus();
  return new Promise(resolve=>{confirmationResolve=resolve;});
}
function settleConfirmation(accepted) {
  const finish=confirmationResolve;
  confirmationResolve=null;
  if($('#confirm-dialog').open)$('#confirm-dialog').close();
  if(finish)finish(accepted);
}
$('#confirm-no').addEventListener('click',()=>settleConfirmation(false));
$('#confirm-yes').addEventListener('click',()=>settleConfirmation(true));
$('#confirm-dialog').addEventListener('close',()=>settleConfirmation(false));
async function requestModalClose() {
  const modal=$('#modal');
  if(!modal.open)return;
  const form=modal.querySelector('form[data-form]');
  if(form && openedFormSnapshot!==null && formSnapshot(form)!==openedFormSnapshot &&
    !await confirmAction({title:'Buang perubahan?',message:'Isian yang belum disimpan akan hilang. Yakin ingin menutup dialog ini?',accept:'Buang perubahan',danger:true}))return;
  modal.close();
  openedFormSnapshot=null;
}
function formConfirmation(type,data,form) {
  switch(type) {
    case 'register':return {title:'Buat akun peserta?',message:`Akun akan dibuat untuk ${data.email}. Pastikan identitas dan email sudah benar.`,accept:'Ya, buat akun'};
    case 'profile':return {title:'Simpan perubahan profil?',message:'Nama, institusi, dan nomor telepon akun akan diperbarui.',accept:'Ya, simpan profil'};
    case 'registration': {
      const ev=state.events.find(x=>x.id===data.eventId);
      return {title:'Kirim pendaftaran?',message:`Kategori: ${ev?.title||data.eventId}\nBiaya latihan: ${ev?money(ev.fee):'-'}\nPastikan anggota dan referensi latihan sudah benar. Pendaftaran tidak dapat diulang pada kategori yang sama.`,accept:'Ya, kirim pendaftaran'};
    }
    case 'submission':return {title:'Simpan tautan karya?',message:`Tautan karya yang tersimpan akan ${form.querySelector('[name="url"]')?.defaultValue?'diganti':'ditambahkan'} dengan URL berikut:\n${data.url}`,accept:'Ya, simpan karya'};
    case 'review':return {title:data.status==='approved'?'Setujui pendaftaran?':'Tolak pendaftaran?',message:`Keputusan ${data.status==='approved'?'persetujuan':'penolakan'} akan dicatat dan tidak bisa diubah melalui formulir ini.${data.status==='rejected'?'\nAlasan: '+(data.note||'(belum diisi)'):''}`,accept:data.status==='approved'?'Ya, setujui':'Ya, tolak',danger:data.status==='rejected'};
    case 'event':return {title:'Simpan pengaturan kategori?',message:`Kategori: ${data.title}\nKuota: ${data.quota}\nBiaya: ${money(Number(data.fee)||0)}\nPerubahan jadwal dan status pendaftaran akan langsung berlaku.`,accept:'Ya, simpan kategori'};
    // The cancellation modal itself is the confirmation; no extra dialog needed.
    default:return null;
  }
}

async function api(path, options={}) {
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(state.csrf?{'X-CSRF-Token':state.csrf}:{}),...options.headers}});
  const data=await response.json();
  if(!response.ok) {const error=new Error(data.error || 'Permintaan belum berhasil.');error.status=response.status;throw error;}
  return data;
}
function notify(message,error=false) {
  const el=$('#toast');clearTimeout(toastTimer);el.textContent=message;el.className=`toast${error?' error':''}`;el.hidden=false;
  toastTimer=setTimeout(()=>{el.hidden=true;},6000);
}
function navigate(path,replace=false) {
  $('#modal').close();
  history[replace?'replaceState':'pushState']({},'',path);render();window.scrollTo(0,0);
}
function nav() {
  const p=location.pathname;
  const links=[['/','Beranda'],['/kategori','Kategori'],['/panduan','Panduan']];
  if(state.user) {
    links.push(state.user.role==='admin'?['/admin','Admin']:['/dashboard','Dashboard']);
    if(state.user.role==='admin')links.push(['/operasional','Operasional']);
    links.push(['/profil','Profil']);
  }
  $('#nav').innerHTML=links.map(([href,label])=>`<a href="${href}" data-link class="nav-link ${p===href?'active':''}" ${p===href?'aria-current="page"':''}>${label}</a>`).join('')+
    (state.user?'<button type="button" data-action="logout" class="nav-logout">Keluar</button>':'<a href="/masuk" data-link class="nav-link nav-primary">Masuk / Daftar</a>');
  $('#nav').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');
}
const heading=(kicker,title,description='',action='')=>`<div class="page-heading"><div><div class="eyebrow">${e(kicker)}</div><h1>${title}</h1>${description?`<p>${description}</p>`:''}</div>${action}</div>`;
const badge=r=>`<span class="badge ${e(r.status)}">${e(r.status_label)}</span>`;
const errorBox='<div class="error-box" data-error role="alert" hidden></div>';
function field(name,label,type='text',value='',extra='') {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${e(value)}" ${extra}></div>`;
}
function trackCard(ev,index) {
  return `<article class="track-card"><div class="card-top"><span class="category-code">${e(codes[ev.category])}</span><span class="track-number">0${index+1}</span></div>
    <h3>${e(ev.title)}</h3><p>${e(ev.description)}</p><div class="card-info"><span>${e(categoryNames[ev.category])}</span><span>${ev.remaining} slot tersisa</span></div>
    <div class="card-bottom"><div><small>BIAYA LATIHAN ${ev.category==='team'?'PER TIM':'PER PESERTA'}</small><strong>${money(ev.fee)}</strong></div><a href="/daftar?kategori=${encodeURIComponent(ev.id)}" data-link class="btn small ${ev.registrationOpen?'green':'outline'}">${ev.registrationOpen?'Pilih kategori':'Lihat detail'}</a></div>
    <div class="card-footer"><span>${ev.registrationOpen?'● Pendaftaran dibuka':'○ Pendaftaran ditutup'}</span><span>Tutup ${date(ev.closes_at)}</span></div></article>`;
}
function home() {
  const open=state.events.filter(ev=>ev.registrationOpen).length;
  const slots=state.events.reduce((s,ev)=>s+ev.remaining,0);
  return `<div class="page fade-in"><section class="hero"><div class="hero-copy"><div class="eyebrow">The next move is yours</div><h1>Bawa karyamu<br>ke <em>arena.</em></h1>
    <p class="lead">Bikin website, pecahkan tantangan keamanan, atau bangun produk bareng tim. Temukan ruang untuk kemampuanmu di ESORIA CodeFest.</p>
    <div class="button-row"><a href="/kategori" data-link class="btn green">Temukan tantangan <span aria-hidden="true">↗</span></a><a href="${state.user?state.user.role==='admin'?'/admin':'/dashboard':'/buat-akun'}" data-link class="btn outline">${state.user?'Buka ruangmu':'Buat akun peserta'}</a></div>
    <div class="hero-caption"><span>BUILD · SECURE · COMPETE</span><i></i><span>KARYA BERMAKNA, LANGKAH BERANI.</span></div></div>
    <aside class="arena" aria-label="Tiga arena kompetisi ESORIA"><div class="arena-sheet"><div class="arena-meta"><span>ESORIA / FIELD NOTES NO. 01</span><span class="stamp">${open?'REGISTRATION OPEN':'NEXT CHAPTER'}</span></div>
    <div class="arena-display"><div class="arena-type">BUILD.<br>SECURE.<br><em>COMPETE.</em></div><div class="arena-mark" aria-hidden="true"><span>MAKE YOUR MARK</span><b>ECF</b><span>THE CODING ARENA</span></div></div>
    <div class="arena-tracks"><div><b>01 / WEB</b><strong>Website<br>Programming</strong></div><div><b>02 / SEC</b><strong>Cybersecurity<br>Mini CTF</strong></div><div><b>03 / TEAM</b><strong>Full Stack<br>Development</strong></div></div><div class="arena-footer"><span>DARI IDE, JADI KARYA.</span><span>YOUR NEXT CHAPTER ↗</span></div></div></aside></section>
    <section class="stat-rail" aria-label="Ringkasan kompetisi"><div><span class="rail-label">Satu ruang.<br>Banyak kemungkinan.</span></div><div><b>${String(state.events.length).padStart(2,'0')}</b><span>Kategori untuk<br>unjuk kemampuan</span></div><div><b>${slots}</b><span>Slot peserta<br>dan tim tersisa</span></div><div><b>${open}</b><span>Kategori sedang<br>membuka pendaftaran</span></div></section>
    <section><div class="section-head"><div><div class="eyebrow">01 / Choose your arena</div><h2>Mulai dari tantanganmu.</h2></div><a href="/kategori" data-link class="text-link">Jadwal & kategori ↗</a></div><div class="cards">${state.events.map(trackCard).join('')}</div></section>
    <section class="how"><div class="how-intro"><div class="eyebrow">02 / Your next step</div><h2>Siap ambil bagian?</h2><p>Semua langkah tercatat dalam akunmu.</p></div><div class="how-steps"><article><b>01.</b><h3>Pilih arena</h3><p>Buat akun, lihat kategori, dan temukan tantangan yang sesuai.</p></article><article><b>02.</b><h3>Kirim pendaftaran</h3><p>Lengkapi data dan referensi pembayaran latihan.</p></article><article><b>03.</b><h3>Wujudkan karya</h3><p>Pantau verifikasi, cetak tiket, lalu kirim tautan karyamu.</p></article></div></section></div>`;
}
function categories() {
  return `<div class="page fade-in">${heading('01 / Competition directory','Tiga arena. <em>Satu ambisi.</em>','Pilih tantangan sesuai minatmu. Jadwal mengikuti pengaturan panitia dan ditampilkan dalam WIB.')}<div class="cards">${state.events.map(trackCard).join('')}</div><div class="panel sidebar-note calendar-panel"><h3>Kalender kompetisi</h3><div class="table-wrap"><table><thead><tr><th>Kategori</th><th>Pendaftaran</th><th>Pelaksanaan</th><th>Kuota</th></tr></thead><tbody>${state.events.map(ev=>`<tr><td><strong>${e(ev.title)}</strong><small>${e(categoryNames[ev.category])}</small></td><td>${dateTime(ev.opens_at)}<br>hingga ${dateTime(ev.closes_at)}</td><td>${date(ev.starts_at)} – ${date(ev.ends_at)}</td><td>${ev.reserved} / ${ev.quota}</td></tr>`).join('')}</tbody></table></div></div></div>`;
}
function authPage(register=false) {
  return `<div class="page fade-in"><div class="auth-layout"><div class="auth-intro"><span class="auth-tag">ESORIA / PARTICIPANT ACCESS</span><h1>${register?'Langkah pertama,<br><em>karya berikutnya.</em>':'Karyamu menunggu<br><em>langkah berikutnya.</em>'}</h1><p>${register?'Satu akun untuk memilih kategori, memantau pendaftaran, dan mengirim tautan karya.':'Masuk untuk melanjutkan pendaftaran, melihat status, dan mengelola kegiatan kompetisimu.'}</p><div class="auth-quote">“Dari ide yang sederhana,<br>menjadi sesuatu yang berarti.”</div></div>
    <section class="panel auth-form"><h2>${register?'Buat akun peserta.':'Selamat datang kembali.'}</h2><p>${register?'Isi data yang akan tercantum pada pendaftaran.':'Gunakan email dan kata sandi akun ESORIA.'}</p><form data-form="${register?'register':'login'}">${errorBox}
    ${register?field('name','Nama lengkap','text','','required minlength="2" maxlength="100" autocomplete="name"')+field('institution','Asal kampus / institusi','text','','required minlength="2" maxlength="150" autocomplete="organization"'):''}
    ${field('email','Alamat email','email','','required maxlength="150" autocomplete="email"')}${field('password','Kata sandi','password','',`required minlength="${register?12:1}" maxlength="128" autocomplete="${register?'new-password':'current-password'}"`)}
    ${register?'<p class="muted"><small>Minimal 12 karakter, mengandung huruf dan angka. Akun baru selalu memiliki peran peserta.</small></p>':''}<button type="submit" class="btn green full">${register?'Buat akun & mulai':'Masuk ke akun'}</button></form><div class="auth-bottom">${register?'Sudah punya akun? <a href="/masuk" data-link>Masuk di sini</a>':'Belum punya akun? <a href="/buat-akun" data-link>Buat akun peserta</a>'}</div></section></div></div>`;
}
function profile() {
  const u=state.user;
  return `<div class="page fade-in">${heading('Account / Personal details','Ruang personalmu.','Perbarui identitas yang digunakan dalam kegiatan kompetisi.')}<div class="grid-2"><section class="panel"><div class="panel-header"><h3>Informasi profil</h3><span class="stamp">${u.role==='admin'?'ADMIN':'PESERTA'}</span></div><form data-form="profile">${errorBox}<div class="form-grid">${field('name','Nama lengkap','text',u.name,'required minlength="2" maxlength="100" autocomplete="name"')}${field('institution','Kampus / institusi','text',u.institution,'required minlength="2" maxlength="150" autocomplete="organization"')}${field('phone','Nomor telepon (opsional)','tel',u.phone,'maxlength="25" autocomplete="tel"')}${field('account-email','Alamat email','email',u.email,'disabled')}</div><div class="form-actions"><small>Email menjadi identitas akun dan tidak dapat diubah.</small><button class="btn green" type="submit">Simpan profil</button></div></form></section><aside class="panel sidebar-note"><h3>Identitas akun</h3><dl class="key-value"><dt>Peran</dt><dd>${u.role==='admin'?'Admin':'Peserta'}</dd><dt>Terdaftar</dt><dd>${date(u.createdAt)}</dd><dt>Penyimpanan</dt><dd>Tersimpan pada server</dd></dl><hr class="side-rule"><p>Perubahan profil tidak mengubah kategori atau keputusan pendaftaran yang sudah tercatat.</p><a href="${u.role==='admin'?'/admin':'/dashboard'}" data-link class="text-link">Kembali ke ruang aktivitas ↗</a></aside></div></div>`;
}
function registrationCard(r) {
  return `<article class="registration"><div class="registration-top"><div><h3>${e(r.event_title)}</h3><span class="ticket-code">${e(r.ticket)}</span></div>${badge(r)}</div><div class="registration-meta"><div>Tanggal daftar<strong>${dateTime(r.created_at)}</strong></div><div>${r.category==='team'?'Nama tim':'Peserta'}<strong>${e(r.team_name||r.participant_name)}</strong></div><div>Nominal latihan<strong>${money(r.fee)}</strong></div></div>
    ${r.review_note?`<div class="review-note"><strong>Catatan panitia:</strong> ${e(r.review_note)}</div>`:''}${r.submission_url?`<p><small>Karya tersimpan: <a href="${e(r.submission_url)}" target="_blank" rel="noopener noreferrer" class="text-link">Buka tautan ↗</a></small></p>`:''}
    <div class="registration-actions">${r.status==='pending'?`<button class="btn small outline" data-action="cancel" data-id="${e(r.id)}">Batalkan pendaftaran</button>`:''}${r.status==='approved'?`<a href="/tiket?id=${encodeURIComponent(r.id)}" data-link class="btn small green">Lihat tiket</a><button class="btn small outline" data-action="submission" data-id="${e(r.id)}">${r.submission_url?'Perbarui':'Kirim'} tautan karya</button>`:''}${['rejected','cancelled'].includes(r.status)?'<span class="muted"><small>Catatan pendaftaran tetap tersedia pada riwayat akun.</small></span>':''}</div></article>`;
}
function dashboard() {
  const regs=state.registrations;
  return `<div class="page fade-in">${heading('Participant / Your workspace',`Halo, ${e(state.user.name.split(' ')[0])}.`,'Semua langkahmu, dari pendaftaran sampai pengiriman karya, ada di sini.','<a href="/kategori" data-link class="btn green">Pilih tantangan ↗</a>')}<section class="kpis" aria-label="Ringkasan pendaftaran"><div class="kpi"><span>Total pendaftaran</span><b>${regs.length}</b></div><div class="kpi"><span>Menunggu verifikasi</span><b>${regs.filter(r=>r.status==='pending').length}</b></div><div class="kpi"><span>Disetujui</span><b>${regs.filter(r=>r.status==='approved').length}</b></div><div class="kpi"><span>Karya dikirim</span><b>${regs.filter(r=>r.submission_url).length}</b></div></section><div class="grid-2"><section><div class="panel-header"><h3>Riwayat pendaftaran</h3><button class="btn outline small" data-action="refresh">Perbarui</button></div>${regs.length?regs.map(registrationCard).join(''):'<div class="empty"><b>Arena pertamamu menunggu.</b><p>Kamu belum memiliki pendaftaran. Temukan kategori yang sesuai dengan kemampuanmu.</p><a href="/kategori" data-link class="btn green">Jelajahi kategori</a></div>'}</section><aside class="panel sidebar-note"><div class="eyebrow">Your field notes</div><h3>Setelah mendaftar</h3><p>Admin memeriksa referensi pembayaran latihan, lalu menyetujui atau menolak pendaftaran dengan catatan.</p><p>Setelah disetujui, tiket dapat dicetak dan tautan karya dapat dikirim hingga batas akhir kategori.</p><hr class="side-rule"><span class="stamp red">LINGKUNGAN LATIHAN</span><p>Nominal dan referensi pembayaran hanya untuk demonstrasi UTS. Tidak perlu mengirim uang sungguhan.</p></aside></div></div>`;
}
function registration() {
  const selected=new URLSearchParams(location.search).get('kategori');
  const ev=state.events.find(ev=>ev.id===selected)||state.events[0];
  if(!ev)return '<div class="page"><div class="empty"><b>Belum ada kategori.</b></div></div>';
  if(state.user.role==='admin')return `<div class="page">${heading('Registration / Participant access','Gunakan akun peserta.','Admin mengelola kategori dan pendaftaran melalui ruang admin.')}<a class="btn green" data-link href="/admin">Buka admin</a></div>`;
  const existing=state.registrations.find(r=>r.event_id===ev.id);
  return `<div class="page fade-in">${heading('Registration / Make your move','Ambil tempatmu.','Pastikan kategori dan data peserta sudah sesuai sebelum mengirim pendaftaran.')}<div class="grid-2"><section class="panel"><div class="panel-header"><h3>Formulir pendaftaran</h3><span class="stamp">${e(codes[ev.category])} / ${ev.category==='team'?'TEAM':'INDIVIDUAL'}</span></div>${existing?'<div class="notice">Kamu sudah memiliki pendaftaran pada kategori ini. <a href="/dashboard" data-link class="text-link">Lihat riwayat</a></div>':''}${!ev.registrationOpen?'<div class="notice warning">Kategori ini sedang ditutup atau kuotanya penuh. Silakan pilih kategori lainnya.</div>':''}<form data-form="registration">${errorBox}<div class="form-grid"><div class="field wide"><label for="eventId">Kategori kompetisi</label><select id="eventId" name="eventId">${state.events.map(x=>`<option value="${e(x.id)}" ${x.id===ev.id?'selected':''}>${e(x.title)}</option>`).join('')}</select></div>${field('participant-name','Nama peserta / ketua','text',state.user.name,'disabled')}${field('participant-email','Email akun','email',state.user.email,'disabled')}</div>
    ${ev.category==='team'?`<div class="form-section">DATA TIM / 2–4 ORANG TERMASUK KETUA</div>${field('teamName','Nama tim','text','','required minlength="2" maxlength="80"')}<div id="members">${memberRow(0)}</div><button class="btn small outline" type="button" data-action="add-member">+ Tambah anggota</button><p><small class="muted">Ketua menggunakan identitas akun di atas. Isi 1–3 anggota tambahan dengan email yang berbeda.</small></p>`:''}
    <div class="form-section">REFERENSI PEMBAYARAN LATIHAN</div><div class="notice warning">Tidak ada pembayaran uang sungguhan. Gunakan kode latihan, misalnya <strong>LATIHAN-001</strong>, untuk diuji verifikasinya oleh admin.</div>${field('paymentReference','Kode referensi latihan','text','','required minlength="3" maxlength="80" placeholder="LATIHAN-001"')}<div class="field"><label for="paymentNote">Catatan untuk panitia (opsional)</label><textarea id="paymentNote" name="paymentNote" maxlength="500" placeholder="Informasi tambahan mengenai pendaftaranmu"></textarea></div><label class="terms-check"><input type="checkbox" name="agreement" required><span>Aku memahami kategori yang dipilih, menyetujui ketentuan latihan, dan memastikan data pendaftaran benar.</span></label><div class="form-actions"><small>Data disimpan di akun peserta.</small><button class="btn green" type="submit" ${existing||!ev.registrationOpen?'disabled':''}>Kirim pendaftaran</button></div></form></section><aside class="panel sidebar-note"><div class="eyebrow">Your registration</div><h3>${e(ev.title)}</h3><p>${e(ev.description)}</p><dl class="key-value"><dt>Jenis peserta</dt><dd>${e(categoryNames[ev.category])}</dd><dt>Tutup pendaftaran</dt><dd>${dateTime(ev.closes_at)}</dd><dt>Pelaksanaan</dt><dd>${date(ev.starts_at)}<br>– ${date(ev.ends_at)}</dd></dl><progress class="progress" value="${ev.reserved}" max="${ev.quota}" aria-label="Slot pendaftaran terisi"></progress><p><small>${ev.reserved} dari ${ev.quota} slot terisi · ${ev.remaining} tersedia</small></p><hr class="side-rule"><small>BIAYA LATIHAN ${ev.category==='team'?'PER TIM':'PER PESERTA'}</small><div class="summary-price">${money(ev.fee)}</div><p><small>Nominal dicatat dari kategori saat pendaftaran dibuat.</small></p></aside></div></div>`;
}
function memberRow(index) {return `<div class="member-row" data-member><div class="field"><label for="member-name-${index}">Nama anggota</label><input id="member-name-${index}" data-member-name required minlength="2" maxlength="100"></div><div class="field"><label for="member-email-${index}">Email anggota</label><input type="email" id="member-email-${index}" data-member-email required maxlength="150"></div><button type="button" class="icon-btn" data-action="remove-member" aria-label="Hapus anggota ini">×</button></div>`;}
function admin() {
  const regs=state.admin.registrations, pending=regs.filter(r=>r.status==='pending').length;
  return `<div class="page fade-in">${heading('Administration / Competition desk','Meja panitia.','Tinjau pendaftaran, atur kategori, dan pantau aktivitas peserta.','<button class="btn outline" data-action="refresh">Perbarui data</button>')}<section class="kpis"><div class="kpi"><span>Akun peserta</span><b>${state.admin.participants}</b></div><div class="kpi"><span>Total pendaftaran</span><b>${regs.length}</b></div><div class="kpi"><span>Perlu diperiksa</span><b>${pending}</b></div><div class="kpi"><span>Disetujui</span><b>${regs.filter(r=>r.status==='approved').length}</b></div></section><div class="tabs" aria-label="Bagian admin"><button class="tab ${state.adminTab==='registrations'?'active':''}" data-action="admin-tab" data-tab="registrations">Pendaftaran (${pending})</button><button class="tab ${state.adminTab==='events'?'active':''}" data-action="admin-tab" data-tab="events">Kategori & jadwal</button><button class="tab ${state.adminTab==='logs'?'active':''}" data-action="admin-tab" data-tab="logs">Jejak aktivitas</button></div><div id="admin-section">${adminSection()}</div></div>`;
}
function adminSection() {
  if(state.adminTab==='events')return `<div class="cards">${state.admin.events.map(ev=>`<article class="track-card"><div class="card-top"><span class="category-code">${e(codes[ev.category])}</span><span class="badge ${ev.registrationOpen?'approved':'cancelled'}">${ev.registrationOpen?'Dibuka':'Ditutup'}</span></div><h3>${e(ev.title)}</h3><p>${e(ev.description)}</p><dl class="key-value"><dt>Kuota terisi</dt><dd>${ev.reserved} / ${ev.quota}</dd><dt>Biaya latihan</dt><dd>${money(ev.fee)}</dd><dt>Tutup daftar</dt><dd>${date(ev.closes_at)}</dd></dl><div class="card-bottom"><button class="btn small outline" data-action="edit-event" data-id="${e(ev.id)}">Atur kategori & jadwal</button></div></article>`).join('')}</div>`;
  if(state.adminTab==='logs')return `<div class="table-wrap"><table><thead><tr><th>Waktu (WIB)</th><th>Pengguna</th><th>Aktivitas</th><th>Catatan</th></tr></thead><tbody>${state.admin.logs.map(l=>`<tr><td>${dateTime(l.created_at)}</td><td>${e(l.name||'Layanan')}</td><td><span class="commit">${e(l.action)}</span></td><td>${e(l.details||'—')}</td></tr>`).join('')}</tbody></table></div><p><small class="muted">Menampilkan maksimal 80 aktivitas terbaru dari data aplikasi.</small></p>`;
  return `<div class="toolbar"><div class="filters"><input id="admin-search" class="filter" type="search" placeholder="Cari nama, email, tiket, atau kategori…" aria-label="Cari pendaftaran" value="${e(state.search)}"><select id="admin-filter" class="filter filter-select" aria-label="Filter status">${[['all','Semua status'],['pending','Menunggu verifikasi'],['approved','Disetujui'],['rejected','Ditolak'],['cancelled','Dibatalkan']].map(([val,label])=>`<option value="${val}" ${state.filter===val?'selected':''}>${label}</option>`).join('')}</select></div><span class="muted"><small>${state.admin.registrations.length} pendaftaran tercatat</small></span></div><div id="registration-table">${adminRows()}</div>`;
}
function adminRows() {
  const q=state.search.toLowerCase();
  const rows=state.admin.registrations.filter(r=>(state.filter==='all'||r.status===state.filter)&&`${r.participant_name} ${r.participant_email} ${r.ticket} ${r.event_title} ${r.team_name}`.toLowerCase().includes(q));
  if(!rows.length)return '<div class="empty"><b>Belum ada data yang sesuai.</b><p>Pendaftaran baru akan muncul di meja panitia setelah dikirim peserta.</p></div>';
  return `<div class="table-wrap"><table><thead><tr><th>Peserta / tim</th><th>Kategori</th><th>Referensi latihan</th><th>Status</th><th>Kelola</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${e(r.team_name||r.participant_name)}</strong><small>${e(r.participant_email)}</small></td><td><strong>${e(r.event_title)}</strong><small>${dateTime(r.created_at)}</small></td><td><strong>${e(r.payment_reference)}</strong><small>${money(r.fee)}</small></td><td>${badge(r)}</td><td><button class="btn small outline" data-action="review" data-id="${e(r.id)}">${r.status==='pending'?'Periksa':'Detail'}</button></td></tr>`).join('')}</tbody></table></div>`;
}
function ticketPage() {
  const r=state.registrations.find(r=>r.id===new URLSearchParams(location.search).get('id'));
  if(!r||r.status!=='approved')return `<div class="page">${heading('Participant / Ticket','Tiket belum tersedia.','Tiket hanya tersedia untuk pendaftaran milikmu yang sudah disetujui.')}<a href="/dashboard" data-link class="btn green">Kembali ke dashboard</a></div>`;
  return `<div class="page fade-in"><div class="ticket-sheet"><div class="ticket-heading"><a class="brand" href="/" data-link><img src="/assets/logo_esoria.webp" width="40" height="40" alt=""><span>ESORIA<small>CODEFEST</small></span></a><span class="stamp">PENDAFTARAN DISETUJUI</span></div><h1>Sampai jumpa<br>di arena.</h1><p class="muted">Tiket peserta / ${e(r.event_title)}</p><div class="ticket-banner">${e(r.ticket)}</div><dl class="key-value"><dt>Nama peserta / ketua</dt><dd>${e(r.participant_name)}</dd><dt>Email akun</dt><dd>${e(r.participant_email)}</dd><dt>Institusi</dt><dd>${e(r.institution)}</dd>${r.team_name?`<dt>Nama tim</dt><dd>${e(r.team_name)}</dd><dt>Anggota tambahan</dt><dd>${r.members.map(m=>e(m.name)).join('<br>')}</dd>`:''}<dt>Pelaksanaan</dt><dd>${date(r.starts_at)} – ${date(r.ends_at)}</dd><dt>Tanggal pendaftaran</dt><dd>${dateTime(r.created_at)}</dd><dt>Nominal latihan</dt><dd>${money(r.fee)}</dd></dl><p class="ticket-foot">Dokumen pendukung pendaftaran untuk demonstrasi UTS, bukan bukti dana masuk. Tidak ada pembayaran uang sungguhan. Identitas tiket dapat dicocokkan oleh admin pada daftar pendaftaran.</p><div class="button-row no-print"><button class="btn green" data-action="print">Cetak / simpan PDF</button><a class="btn outline" data-link href="/dashboard">Kembali</a></div></div></div>`;
}
function operations(data) {
  return `<div class="page fade-in">${heading('Operations / Application health','Denyut aplikasi.','Informasi langsung dari layanan yang sedang menerima permintaan, untuk pemeriksaan admin.','<button class="btn outline" data-action="refresh">Periksa kembali</button>')}<div class="operations-grid"><section class="panel"><div class="panel-header"><h3>Status layanan</h3><span class="ops-status">Berjalan</span></div><dl class="key-value"><dt>Database</dt><dd>${e(data.database)}</dd><dt>Penyimpanan</dt><dd>${e(data.storage)}</dd><dt>Versi skema</dt><dd>${data.schemaVersion}</dd><dt>Lama proses aktif</dt><dd>${Math.floor(data.uptimeSeconds/60)} menit ${data.uptimeSeconds%60} detik</dd><dt>Data pendaftaran</dt><dd>${data.totalRegistrations} pendaftaran</dd></dl></section><section class="panel"><div class="panel-header"><h3>Identitas rilis</h3><span class="stamp">1.0.0</span></div><dl class="key-value"><dt>Node.js</dt><dd>${e(data.nodeVersion)}</dd><dt>Commit berjalan</dt><dd class="commit">${e(data.release)}</dd><dt>Cookie Secure</dt><dd>${data.secureCookie?'Aktif (HTTPS)':'Lokal / HTTP'}</dd></dl><hr class="side-rule"><p class="sidebar-note">Commit ini berasal dari konfigurasi proses aplikasi. Hasil CI/CD harus dicocokkan dengan log GitHub Actions dan image digest pada mesin deployment.</p></section></div></div>`;
}
function guide() {
  return `<div class="page fade-in"><div class="guide">${heading('Field guide / Get started','Panduan peserta.','Dari langkah pertama sampai karya tersimpan, ikuti alur yang sesuai dengan kebutuhanmu.')}<div class="notice"><strong>Lingkungan latihan UTS.</strong> Akun, data pendaftaran, dan pembayaran pada versi ini digunakan untuk demonstrasi. Tidak perlu mengirim uang sungguhan.</div><details open><summary>01 / Membuat akun dan melengkapi profil</summary><ol><li>Pilih Masuk / Daftar, lalu Buat akun peserta.</li><li>Isi nama, institusi, email, dan kata sandi minimal 12 karakter yang memuat huruf serta angka.</li><li>Setelah berhasil, buka Profil untuk melengkapi nomor telepon bila diperlukan.</li></ol><p>Verifikasi email, OTP, Google login, dan pemulihan kata sandi tidak disediakan pada edisi UTS ini.</p></details><details><summary>02 / Memilih kategori dan mendaftar</summary><ol><li>Buka Kategori dan periksa jadwal, kuota, serta nominal latihan.</li><li>Pilih kategori. Untuk kategori tim, isi nama tim dan 1–3 anggota tambahan; ketua berasal dari akun yang sedang masuk.</li><li>Isi kode referensi pembayaran latihan, setujui ketentuan, lalu kirim pendaftaran.</li></ol><p>Satu akun dapat mendaftar sekali pada setiap kategori. Pendaftaran aktif menggunakan kuota; yang ditolak atau dibatalkan melepas kuota.</p></details><details><summary>03 / Memantau status dan mencetak tiket</summary><p>Buka Dashboard dan pilih Perbarui untuk melihat keputusan panitia. Pendaftaran berstatus menunggu dapat dibatalkan. Setelah disetujui, buka Lihat tiket dan pilih Cetak / simpan PDF.</p><p>Jika ditolak, alasan admin tercatat pada riwayat pendaftaran. Riwayat tidak dapat dihapus atau dikirim ulang untuk kategori yang sama.</p></details><details><summary>04 / Mengirim tautan karya</summary><p>Pada pendaftaran yang sudah disetujui, pilih Kirim tautan karya. Masukkan URL HTTPS menuju repository atau halaman karya yang bisa ditinjau panitia. Tautan dapat diperbarui hingga batas akhir kategori. Aplikasi menyimpan tautan dan tidak memeriksa akses publik situs tujuan.</p></details><details><summary>05 / Alur admin</summary><p>Masuk menggunakan akun admin yang dibuat saat konfigurasi awal. Ruang Admin menyediakan pemeriksaan pendaftaran, persetujuan atau penolakan dengan alasan, pengaturan kategori dan tanggal, serta jejak aktivitas. Buka Operasional untuk memeriksa layanan dan commit rilis.</p></details><details><summary>06 / Data dan cakupan edisi UTS</summary><p>Versi ini mencakup akun lokal, profil, kategori, kuota, pendaftaran individu/tim, pembayaran latihan, keputusan admin, tiket cetak, dan pengiriman tautan karya. Penjurian, CTF interaktif, email, OTP, push notification, unggah bukti pembayaran, sertifikat, serta pembayaran nyata tidak termasuk edisi ini.</p></details></div></div>`;
}

async function render() {
  const version=++renderVersion, p=location.pathname;
  nav();
  const protectedRoutes=['/dashboard','/daftar','/profil','/admin','/operasional','/tiket'];
  if(protectedRoutes.includes(p)&&!state.user) {sessionStorage.setItem('esoria-next',location.pathname+location.search);return navigate('/masuk',true);}
  if(['/admin','/operasional'].includes(p)&&state.user.role!=='admin')return navigate('/dashboard',true);
  if(p==='/dashboard'&&state.user?.role==='admin')return navigate('/admin',true);
  if(['/masuk','/buat-akun'].includes(p)&&state.user)return navigate(state.user.role==='admin'?'/admin':'/dashboard',true);
  const main=$('#main');main.innerHTML='<div class="loading" role="status">Memuat halaman…</div>';
  try {
    if(['/dashboard','/daftar','/tiket'].includes(p))state.registrations=(await api('/api/registrations')).registrations;
    if(p==='/admin')state.admin=await api('/api/admin/overview');
    let content;
    if(p==='/operasional')content=operations(await api('/api/admin/operations'));
    if(version!==renderVersion)return;
    const pages={'/':home,'/kategori':categories,'/masuk':()=>authPage(),'/buat-akun':()=>authPage(true),'/dashboard':dashboard,'/daftar':registration,'/profil':profile,'/admin':admin,'/tiket':ticketPage,'/panduan':guide};
    main.innerHTML=content||(pages[p]?pages[p]():`<div class="page"><div class="empty"><b>Halaman tidak ditemukan.</b><a class="btn" data-link href="/">Kembali ke beranda</a></div></div>`);
    document.title=`${({'/':'Beranda','/kategori':'Kategori','/masuk':'Masuk','/buat-akun':'Buat akun','/dashboard':'Dashboard','/daftar':'Pendaftaran','/profil':'Profil','/admin':'Admin','/tiket':'Tiket','/operasional':'Operasional','/panduan':'Panduan'})[p]||'Halaman'} | ESORIA CodeFest`;
  } catch(error) {
    if(version!==renderVersion)return;
    if(error.status===401){state.user=null;state.csrf=null;return navigate('/masuk',true);}
    main.innerHTML=`<div class="page"><div class="error-box" role="alert">${e(error.message)}</div><button class="btn outline" data-action="refresh">Coba kembali</button></div>`;
  }
}
function openModal(title,content) {
  if($('#modal').open)$('#modal').close();
  $('#modal-content').innerHTML=`<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="dialog-close" data-action="close-modal" aria-label="Tutup dialog">×</button></div>${content}`;
  $('#modal').setAttribute('aria-labelledby','dialog-title');$('#modal').showModal();
  openedFormSnapshot=formSnapshot($('#modal').querySelector('form[data-form]'));
}
const localInput=value=>{const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
function editEvent(id) {
  const ev=state.admin.events.find(x=>x.id===id);
  openModal('Atur kategori.',`<form data-form="event" data-id="${e(id)}">${errorBox}<div class="form-grid"><div class="field wide"><label for="title">Judul kategori</label><input id="title" name="title" value="${e(ev.title)}" required minlength="3" maxlength="100"></div><div class="field wide"><label for="description">Deskripsi</label><textarea id="description" name="description" required minlength="20" maxlength="1500">${e(ev.description)}</textarea></div>${field('quota','Kuota','number',ev.quota,'required min="1" max="10000"')}${field('fee','Biaya latihan (Rp)','number',ev.fee,'required min="0" max="100000000" step="1000"')}${[['opensAt','Buka pendaftaran',ev.opens_at],['closesAt','Tutup pendaftaran',ev.closes_at],['startsAt','Mulai kompetisi',ev.starts_at],['endsAt','Batas akhir karya',ev.ends_at]].map(([n,l,v])=>field(n,l,'datetime-local',localInput(v),'required')).join('')}</div><p><small class="muted">Input tanggal mengikuti zona waktu perangkatmu. Tampilan jadwal publik menggunakan WIB.</small></p><label class="check-inline"><input type="checkbox" name="isOpen" ${ev.is_open?'checked':''}>Izinkan pendaftaran sesuai jadwal dan kuota</label><div class="form-actions"><small>Data pendaftaran sebelumnya tetap disimpan.</small><button type="submit" class="btn green">Simpan kategori</button></div></form>`);
}
function review(id) {
  const r=state.admin.registrations.find(x=>x.id===id);
  openModal(r.status==='pending'?'Periksa pendaftaran.':'Detail pendaftaran.',`${badge(r)}<dl class="admin-detail"><dt>Peserta / email</dt><dd>${e(r.participant_name)}<br>${e(r.participant_email)}</dd><dt>Kategori / tiket</dt><dd>${e(r.event_title)}<br>${e(r.ticket)}</dd>${r.team_name?`<dt>Tim / anggota tambahan</dt><dd>${e(r.team_name)}<br>${r.members.map(m=>`${e(m.name)} · ${e(m.email)}`).join('<br>')}</dd>`:''}<dt>Referensi pembayaran latihan</dt><dd>${e(r.payment_reference)} · ${money(r.fee)}</dd><dt>Catatan peserta</dt><dd>${e(r.payment_note||'Tidak ada catatan')}</dd>${r.submission_url?`<dt>Tautan karya</dt><dd><a class="text-link" href="${e(r.submission_url)}" target="_blank" rel="noopener noreferrer">Buka karya ↗</a><p>${e(r.submission_note)}</p></dd>`:''}</dl>${r.status==='pending'?`<form data-form="review" data-id="${e(id)}">${errorBox}<div class="field"><label for="decision">Keputusan</label><select name="status" id="decision"><option value="approved">Setujui pendaftaran</option><option value="rejected">Tolak pendaftaran</option></select></div><div class="field"><label for="note">Catatan admin (wajib jika ditolak)</label><textarea id="note" name="note" maxlength="500"></textarea></div><div class="form-actions"><small>Keputusan tercatat pada riwayat peserta.</small><button class="btn green" type="submit">Simpan keputusan</button></div></form>`:`<p class="review-note">${e(r.review_note||'Tidak ada catatan admin.')}</p>`}`);
}

$('#modal').addEventListener('cancel',event=>{event.preventDefault();void requestModalClose();});
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal'))void requestModalClose();});

document.addEventListener('click',async event=>{
  const link=event.target.closest('a[data-link]');
  if(link && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button===0){event.preventDefault();return navigate(link.getAttribute('href'));}
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  try {
    if(action==='logout') {if(!await confirmAction({title:'Keluar dari akun?',message:'Sesi akun di browser ini akan diakhiri. Data pendaftaran dan pengaturan tetap tersimpan.',accept:'Ya, keluar',danger:true}))return;button.disabled=true;await api('/api/auth/logout',{method:'POST',body:'{}'});state.user=null;state.csrf=null;state.registrations=[];state.admin=null;navigate('/');notify('Kamu sudah keluar dari akun.');}
    if(action==='refresh'){if(!state.release)return await bootstrap();state.events=(await api('/api/events')).events;await render();notify('Data terbaru sudah dimuat.');}
    if(action==='close-modal')await requestModalClose();
    if(action==='print' && await confirmAction({title:'Cetak tiket?',message:'Browser akan membuka dialog cetak. Pastikan data peserta dan nomor tiket sudah benar.',accept:'Ya, cetak tiket'}))window.print();
    if(action==='admin-tab'){state.adminTab=button.dataset.tab;$('#admin-section').innerHTML=adminSection();document.querySelectorAll('[data-action="admin-tab"]').forEach(x=>x.classList.toggle('active',x===button));}
    if(action==='review')review(button.dataset.id);
    if(action==='edit-event')editEvent(button.dataset.id);
    if(action==='add-member') {const count=document.querySelectorAll('[data-member]').length;if(count>=3)return notify('Maksimal 3 anggota tambahan.',true);$('#members').insertAdjacentHTML('beforeend',memberRow(Date.now()));}
    if(action==='remove-member'){if(document.querySelectorAll('[data-member]').length<=1)return notify('Isi minimal 1 anggota tambahan.',true);if(await confirmAction({title:'Hapus anggota tim?',message:'Data anggota pada baris ini akan dihapus dari formulir. Data yang belum dikirim tidak akan disimpan.',accept:'Ya, hapus anggota',danger:true}))button.closest('[data-member]').remove();}
    if(action==='cancel')openModal('Batalkan pendaftaran?',`<p class="sidebar-note">Pendaftaran ini akan masuk riwayat pembatalan dan slot akan dilepas. Kategori yang sama tidak dapat didaftarkan ulang dengan akun ini.</p><form data-form="cancel" data-id="${e(button.dataset.id)}">${errorBox}<div class="button-row"><button class="btn danger" type="submit">Ya, batalkan</button><button type="button" class="btn outline" data-action="close-modal">Kembali</button></div></form>`);
    if(action==='submission'){
      const r=state.registrations.find(r=>r.id===button.dataset.id);
      openModal('Tautan karya.',`<form data-form="submission" data-id="${e(r.id)}">${errorBox}${field('url','URL HTTPS repository / karya','url',r.submission_url,'required maxlength="1000" placeholder="https://github.com/akun/karya"')}<div class="field"><label for="submission-note">Catatan karya (opsional)</label><textarea id="submission-note" name="note" maxlength="1000">${e(r.submission_note)}</textarea></div><p><small class="muted">Pastikan panitia dapat mengakses tautan. Batas pengiriman ${dateTime(r.ends_at)}.</small></p><div class="form-actions"><small>Tautan terakhir yang disimpan akan digunakan.</small><button class="btn green" type="submit">Simpan tautan karya</button></div></form>`);
    }
  } catch(error){if(error.status===401){state.user=null;state.csrf=null;navigate('/masuk',true);}notify(error.message,true);button.disabled=false;}
});
document.addEventListener('change',event=>{
  if(event.target.id==='eventId')navigate(`/daftar?kategori=${encodeURIComponent(event.target.value)}`,true);
  if(event.target.id==='admin-filter'){state.filter=event.target.value;$('#registration-table').innerHTML=adminRows();}
});
document.addEventListener('input',event=>{if(event.target.id==='admin-search'){state.search=event.target.value;$('#registration-table').innerHTML=adminRows();}});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();
  const submit=$('[type="submit"]',form), errorElement=$('[data-error]',form), data=Object.fromEntries(new FormData(form));
  const confirmation=formConfirmation(form.dataset.form,data,form);
  if(confirmation && !await confirmAction(confirmation))return;
  submit.disabled=true;errorElement.hidden=true;
  try {
    const type=form.dataset.form;
    if(type==='login'||type==='register') {
      const result=await api(`/api/auth/${type}`,{method:'POST',body:JSON.stringify(data)});state.user=result.user;state.csrf=result.csrf;
      const next=sessionStorage.getItem('esoria-next');sessionStorage.removeItem('esoria-next');
      navigate(state.user.role==='admin'?'/admin':next?.startsWith('/daftar')?next:'/dashboard');notify(type==='register'?'Akun peserta berhasil dibuat.':'Berhasil masuk. Selamat melanjutkan.');
    }
    if(type==='profile'){state.user=(await api('/api/profile',{method:'PATCH',body:JSON.stringify(data)})).user;await render();notify('Profil berhasil diperbarui.');}
    if(type==='registration'){
      data.members=[...form.querySelectorAll('[data-member]')].map(row=>({name:$('[data-member-name]',row).value,email:$('[data-member-email]',row).value}));
      await api('/api/registrations',{method:'POST',body:JSON.stringify(data)});state.events=(await api('/api/events')).events;navigate('/dashboard');notify('Pendaftaran tersimpan dan menunggu verifikasi admin.');
    }
    if(type==='cancel'){await api(`/api/registrations/${form.dataset.id}/cancel`,{method:'POST',body:'{}'});$('#modal').close();state.events=(await api('/api/events')).events;await render();notify('Pendaftaran dibatalkan dan kuota dilepas.');}
    if(type==='submission'){await api(`/api/registrations/${form.dataset.id}/submission`,{method:'POST',body:JSON.stringify(data)});$('#modal').close();await render();notify('Tautan karya berhasil disimpan.');}
    if(type==='review'){await api(`/api/admin/registrations/${form.dataset.id}`,{method:'PATCH',body:JSON.stringify(data)});$('#modal').close();await render();state.events=(await api('/api/events')).events;notify('Keputusan admin berhasil disimpan.');}
    if(type==='event'){
      data.fee=Number(data.fee);data.quota=Number(data.quota);data.isOpen=form.elements.isOpen.checked;
      for(const k of ['opensAt','closesAt','startsAt','endsAt'])data[k]=new Date(data[k]).toISOString();
      await api(`/api/admin/events/${form.dataset.id}`,{method:'PATCH',body:JSON.stringify(data)});$('#modal').close();state.events=(await api('/api/events')).events;await render();notify('Kategori dan jadwal berhasil diperbarui.');
    }
  } catch(error){errorElement.textContent=error.message;errorElement.hidden=false;errorElement.scrollIntoView({block:'nearest',behavior:'smooth'});}
  finally{submit.disabled=false;}
});
$('#menu-toggle').addEventListener('click',()=>{const open=$('#nav').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String(open));});
window.addEventListener('popstate',render);
async function bootstrap() {
  try {
    const [session,events,release]=await Promise.all([api('/api/session'),api('/api/events'),api('/api/release')]);
    Object.assign(state,session,{events:events.events,release});$('#release-label').textContent=`EDISI UTS / ${release.commit==='local'?'LOCAL':release.commit.slice(0,8)}`;
    await render();
  } catch(error){$('#main').innerHTML=`<div class="page"><div class="error-box" role="alert">Layanan belum dapat dihubungi. ${e(error.message)}</div><button class="btn outline" data-action="refresh">Coba kembali</button></div>`;}
}
bootstrap();
