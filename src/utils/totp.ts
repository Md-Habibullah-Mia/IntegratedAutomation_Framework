import * as crypto from 'crypto';

// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — the code an authenticator app shows for
// a base32 secret. Used for the MassiveMarket admin sign-in, which always asks for MFA.

function base32Decode(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v < 0) throw new Error(`Invalid base32 character "${c}" in TOTP secret`);
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** A code with at least `minSecondsLeft` of validity, so it is not rejected mid-submit. */
export async function freshTotp(secret: string, minSecondsLeft = 8): Promise<string> {
  const left = 30 - (Math.floor(Date.now() / 1000) % 30);
  if (left < minSecondsLeft) await new Promise((r) => setTimeout(r, (left + 1) * 1000));
  return totp(secret);
}
