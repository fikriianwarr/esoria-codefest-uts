import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/public/styles.css', import.meta.url), 'utf8');

test('bar informasi lingkungan UTS dihapus dari layout seluruh halaman', () => {
  assert.doesNotMatch(html, /environment-note|Ruang latihan UTS|Pendaftaran dan pembayaran untuk demonstrasi/i);
  assert.doesNotMatch(css, /\.environment-note|\.live-dot|\.note-divider/);
  assert.match(html, /<a class="skip"[^>]*>Lewati navigasi<\/a>\s*<header class="header">/);
});

test('konten, navigasi, dan modal konfirmasi tetap tersedia', () => {
  assert.match(html, /<nav id="nav"/);
  assert.match(html, /<main id="main"/);
  assert.match(html, /<dialog id="confirm-dialog"/);
  assert.match(css, /\.page\{[^}]*min-height:calc\(100dvh - 219px\)/);
});
