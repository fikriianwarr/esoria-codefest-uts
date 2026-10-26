import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { email, hashPassword, password, verifyPassword } from './security.mjs';

export async function openDatabase({ dataDir, adminEmail, adminPassword, adminSync = false }) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, 'esoria.sqlite'), { timeout: 5000 });
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('participant','admin')),
      institution TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('web','cyber','team')),
      description TEXT NOT NULL, fee INTEGER NOT NULL CHECK(fee >= 0), quota INTEGER NOT NULL CHECK(quota > 0),
      opens_at TEXT NOT NULL, closes_at TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
      is_open INTEGER NOT NULL DEFAULT 1 CHECK(is_open IN (0,1)), created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY, ticket TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
      event_id TEXT NOT NULL REFERENCES events(id), team_name TEXT NOT NULL DEFAULT '',
      members TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','approved','rejected','cancelled')),
      fee INTEGER NOT NULL, payment_reference TEXT NOT NULL, payment_note TEXT NOT NULL DEFAULT '',
      review_note TEXT NOT NULL DEFAULT '', reviewed_by TEXT REFERENCES users(id),
      submission_url TEXT NOT NULL DEFAULT '', submission_note TEXT NOT NULL DEFAULT '',
      submitted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(user_id, event_id)
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL, target TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS registration_event_status ON registrations(event_id,status);
    CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);
    PRAGMA user_version=1;
  `);
  if (!db.prepare("SELECT id FROM users WHERE role='admin'").get()) {
    if (!adminEmail || !adminPassword) { db.close(); throw new Error('Admin pertama belum dikonfigurasi. Jalankan npm run setup, lalu muat .env.'); }
    if (adminPassword==='GANTI_DENGAN_PASSWORD_ACAK_12_KARAKTER') { db.close(); throw new Error('Password contoh belum diganti. Jalankan npm run setup untuk membuat konfigurasi dengan password acak.'); }
    const admin = { id: randomUUID(), name: 'Admin ESORIA', email: email(adminEmail), hash: await hashPassword(password(adminPassword)) };
    db.prepare('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES(?,?,?,?,?,?)')
      .run(admin.id, admin.name, admin.email, admin.hash, 'admin', new Date().toISOString());
  }
  // Local UTS opt-in: keep credentials on disk and in the persisted database aligned.
  // Disabled by default for library/production users; explicit CLI repair also opts in.
  if (adminSync) {
    try {
      const configuredEmail = email(adminEmail);
      if (adminPassword === 'GANTI_DENGAN_PASSWORD_ACAK_12_KARAKTER') throw new Error('Kata sandi contoh tidak boleh dipakai.');
      const configuredPassword = password(adminPassword);
      const current = db.prepare("SELECT * FROM users WHERE role='admin' ORDER BY created_at,id LIMIT 1").get();
      if (!current) throw new Error('Akun admin belum tersedia.');
      const owner = db.prepare('SELECT id,role FROM users WHERE email=?').get(configuredEmail);
      if (owner && owner.id !== current.id) throw new Error('Email admin di .env sudah digunakan akun lain. Pilih email admin yang berbeda.');
      const matching = current.email.toLowerCase() === configuredEmail &&
        await verifyPassword(configuredPassword, current.password_hash).catch(() => false);
      if (!matching) {
        const hash = await hashPassword(configuredPassword);
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare("UPDATE users SET email=?,password_hash=? WHERE id=? AND role='admin'").run(configuredEmail, hash, current.id);
          db.prepare('DELETE FROM sessions WHERE user_id=?').run(current.id);
          db.prepare('INSERT INTO audit_logs(user_id,action,target,details,created_at) VALUES(?,?,?,?,?)')
            .run(current.id, 'admin.credentials.reconciled', current.id, 'Konfigurasi lokal admin diperbarui.', new Date().toISOString());
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      }
    } catch (error) { db.close(); throw error; }
  }
  // Initial seed happens only once: later starts preserve edited events and participants.
  if (!db.prepare('SELECT id FROM events LIMIT 1').get()) {
    const now = Date.now(), date = days => new Date(now + days * 86400000).toISOString();
    const insert = db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
    const rows = [
      ['web-01', 'Website Programming', 'web', 'Bangun website responsif yang menyelesaikan masalah nyata. Individu, dengan fokus pada fungsi, aksesibilitas, dan pengalaman pengguna.', 150000, 50],
      ['cyber-01', 'Cybersecurity Mini CTF', 'cyber', 'Latih analisis keamanan pada tantangan yang disediakan panitia. Individu; hanya target latihan resmi yang diperbolehkan.', 150000, 50],
      ['team-01', 'Full Stack Development', 'team', 'Wujudkan produk bersama 2–4 anggota tim. Hubungkan antarmuka, API, dan penyimpanan data menjadi pengalaman yang utuh.', 500000, 25]
    ];
    for (const row of rows) insert.run(...row, date(-1), date(30), date(31), date(38), 1, date(0));
  }
  return db;
}
