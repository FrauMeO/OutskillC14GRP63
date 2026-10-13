// Svix-style webhook signature check (used by Resend). Pure Web Crypto, no imports: this file is copied
// byte-for-byte to supabase/functions/_shared/email/ (a test checks they are identical).
//
// Signed content is "<svix-id>.<svix-timestamp>.<raw body>", HMAC-SHA256 with the base64-decoded secret
// (the part after "whsec_"). The header carries one or more "v1,<base64>" values separated by spaces.

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(u: Uint8Array): string {
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Sign a payload the way the provider does (exported so tests can build a valid request). */
export async function signWebhook(secret: string, id: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', b64ToBytes(secret.replace(/^whsec_/, '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`)));
  return bytesToB64(mac);
}

/** True only for a fresh request whose signature matches. `nowMs` is passed in so tests control the clock. */
export async function verifyWebhook(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  header: string,
  nowMs: number,
): Promise<boolean> {
  const ts = Number(timestamp);
  if (!id || !header || !Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > WEBHOOK_TOLERANCE_SECONDS) return false;
  let expected: string;
  try {
    expected = await signWebhook(secret, id, timestamp, body);
  } catch {
    return false;
  }
  return header
    .split(' ')
    .map((p) => p.split(','))
    .some(([version, sig]) => version === 'v1' && typeof sig === 'string' && same(sig, expected));
}
