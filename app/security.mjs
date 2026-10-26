import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, saved) {
  const [salt, hex] = saved.split(':');
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function text(value, label, min = 1, max = 200) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new HttpError(400, `${label} harus diisi ${min}–${max} karakter.`);
  }
  return value.trim();
}
export function email(value) {
  const result = text(value, 'Email', 5, 150).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new HttpError(400, 'Format email belum benar.');
  return result;
}
export function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128 || !/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    throw new HttpError(400, 'Kata sandi harus 12–128 karakter dan mengandung huruf serta angka.');
  }
  return value;
}
export function integer(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new HttpError(400, `${label} harus bilangan bulat ${min}–${max}.`);
  return value;
}
export function webUrl(value) {
  const result = text(value, 'Tautan karya', 8, 1000);
  let url;
  try { url = new URL(result); } catch { throw new HttpError(400, 'Tautan karya harus berupa URL HTTPS.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new HttpError(400, 'Gunakan tautan HTTPS tanpa kata sandi pada URL.');
  return url.href;
}
