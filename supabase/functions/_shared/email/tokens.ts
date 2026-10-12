// Token and address-hash helpers for the email layer. Web Crypto only (crypto.subtle and
// crypto.getRandomValues), so the same file runs in Deno (edge functions), Node 20+ and browsers.
// No imports: this file is copied byte-for-byte to supabase/functions/_shared/email/ (a test checks it).

const enc = new TextEncoder();

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A random, unguessable token: 32 random bytes (256 bits), base64url, 43 characters. */
export function generateToken(bytes = 32): string {
  if (bytes < 16) throw new Error('A token needs at least 16 random bytes.');
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toBase64Url(buf);
}

/** Hex SHA-256 of the token's UTF-8 text. The database stores only this, never the token.
 *  Postgres can recompute it with encode(sha256(convert_to(token, 'utf8')), 'hex'). */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return toHex(new Uint8Array(digest));
}

async function hmac(key: string, message: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

/** Lower-case and trim, so the same person always hashes the same. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Keyed hash of an address for the suppression list and the send log (no plaintext stored).
 *  The key is a server secret (EMAIL_HASH_KEY); without it nobody can test guesses against a leaked table. */
export async function hashEmail(email: string, key: string): Promise<string> {
  if (!key) throw new Error('EMAIL_HASH_KEY is not set.');
  return toHex(await hmac(key, 'email:' + normalizeEmail(email)));
}

/** A stable link token for one share and purpose (for example the mute link in every nudge email).
 *  Derived with a server secret so every email carries the same working link, while the database
 *  keeps only the SHA-256 of it. Different purposes give different tokens. */
export async function derivedLinkToken(secret: string, purpose: string, id: string): Promise<string> {
  if (!secret) throw new Error('EMAIL_LINK_SECRET is not set.');
  return toBase64Url(await hmac(secret, `${purpose}:${id}`));
}

/** Constant-time string comparison (for webhook and token checks). */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export const WAITLIST_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

/** Pure expiry rule shared with the SQL (expires_at > now() and used_at is null). */
export function tokenUsable(row: { expiresAt: number; usedAt: number | null }, now: number): boolean {
  return row.usedAt === null && now < row.expiresAt;
}
