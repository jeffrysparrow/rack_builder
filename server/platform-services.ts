import type { AdminSettings } from '../src/config/shop';

export type Destination = { street: string; city: string; state: string; zip: string };
export type Address = Destination & { unit: string; notes: string };

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function requiredText(value: unknown, label: string, max: number, optional = false) {
  if (typeof value !== 'string' || value.trim().length > max || (!optional && !value.trim())) {
    throw new HttpError(400, `Check ${label}.`);
  }
  return value.trim();
}

export function contactEmail(value: unknown, optional = false) {
  const email = requiredText(value, 'the email address', 254, optional);
  if ((email || !optional) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  return email.toLowerCase();
}

export function zipCode(value: unknown) {
  const zip = requiredText(value, 'the ZIP code', 10);
  if (!/^\d{5}(-\d{4})?$/.test(zip)) throw new HttpError(400, 'Enter a valid ZIP code.');
  return zip;
}

export function requestId(value: unknown) {
  const id = requiredText(value, 'the request ID', 36);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) throw new HttpError(400, 'Check the request ID.');
  return id;
}

export function streetAddress(data: Record<string, unknown>): Destination {
  const zip = zipCode(data.zip);
  return {
    street: requiredText(data.street, 'the street address', 160),
    city: requiredText(data.city, 'the city', 80),
    state: requiredText(data.state, 'the state', 40),
    zip,
  };
}

export async function routeFee(destination: Destination, settings: AdminSettings, apiKey: string) {
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'routes.distanceMeters' },
    body: JSON.stringify({
      origin: { address: settings.deliveryOrigin },
      destination: { address: Object.values(destination).concat('USA').join(', ') },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) throw new HttpError(502, 'Delivery quotes are temporarily unavailable.');
  const data = await response.json() as { routes?: { distanceMeters?: number }[] };
  const route = data.routes?.[0];
  // Google omits the zero-valued protobuf field when both waypoints coincide.
  const meters = route && (route.distanceMeters ?? 0);
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) {
    throw new HttpError(422, 'No driving route was found. Check the address to try again.');
  }
  return Math.round(Math.max(0, meters / 1609.344 - settings.delivery.freeMiles) * settings.delivery.extraMileRate) * 100;
}

const encoder = new TextEncoder();
const decode = (value: string) => new TextDecoder().decode(bytes(value));
function bytes(value: string) {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
}

export async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (c) => c.toString(16).padStart(2, '0')).join('');
}

export function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index++) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

let cachedKeys: { issuer: string; expires: number; keys: (JsonWebKey & { kid?: string })[] } | undefined;
export async function accessEmail(token: string, issuer: string, audience: string) {
  try {
    const [header, payload, signature, extra] = token.split('.');
    if (extra !== undefined) return null;
    const { alg, kid } = JSON.parse(decode(header));
    const claims = JSON.parse(decode(payload));
    const now = Date.now() / 1000;
    if (alg !== 'RS256' || typeof kid !== 'string' || claims.iss !== issuer || !Array.isArray(claims.aud)
      || !claims.aud.includes(audience) || !Number.isFinite(claims.exp) || claims.exp <= now
      || (claims.nbf && claims.nbf > now) || typeof claims.email !== 'string') return null;
    let jwk = cachedKeys?.issuer === issuer && cachedKeys.expires > now && cachedKeys.keys.find((key) => key.kid === kid);
    if (!jwk) {
      const response = await fetch(issuer + '/cdn-cgi/access/certs', { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      const { keys } = await response.json() as NonNullable<typeof cachedKeys>;
      cachedKeys = { issuer, expires: now + 3600, keys };
      jwk = keys.find((key) => key.kid === kid);
    }
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(signature), encoder.encode(header + '.' + payload));
    return verified ? contactEmail(claims.email) : null;
  } catch {
    return null;
  }
}

export async function sendEmail(key: string | undefined, sender: string | undefined, id: string, message: {
  to: string; subject: string; text: string; reply_to?: string;
}) {
  if (!key || !sender || !message.to) return 'unconfigured';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'Idempotency-Key': id },
      body: JSON.stringify({ from: sender, ...message }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

export async function stripe<T>(key: string, path: string, form?: URLSearchParams, id?: string): Promise<T> {
  const response = await fetch('https://api.stripe.com/v1/' + path, {
    method: form ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + key,
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(id ? { 'Idempotency-Key': id } : {}),
    },
    body: form,
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!response?.ok) throw new HttpError(502, 'Checkout is temporarily unavailable. Try again shortly.');
  return await response.json() as T;
}
