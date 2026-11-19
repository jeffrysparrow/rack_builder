import type { DeliveryWindow, SavedInquiry, Storefront } from '../src/config/shop';
import { toteProfiles } from '../src/config/totes';
import { getRackToteType } from '../src/config/rack';
import { inquiryData, orderColumns, orderData, shopClock, windowsQuery } from './platform-data';
import type { Environment, OrderRow, Shop } from './platform-data';
import { beginCheckout, confirmOrder, createQuote, getOrder, checkoutMode, rackSnapshot, requestOrder, sendConfirmation, stripeWebhook } from './platform-orders';
import { accessEmail, contactEmail, equal, HttpError, requiredText, routeFee, sendEmail, streetAddress } from './platform-services';
import { publicSettings, readSettings, record, validateSettings } from './platform-settings';

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const loopback = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
type InquiryRow = Omit<SavedInquiry, 'snapshot'> & { snapshot: string };
const inquiryColumns = 'id, created_at AS createdAt, snapshot, email_status AS emailStatus';

async function readBody(request: Request, limit: number) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Send a JSON request.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Check the submitted fields.');
  const decoder = new TextDecoder();
  let length = 0;
  let body = '';
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) return body + decoder.decode();
    length += chunk.value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new HttpError(413, 'The request is too large.');
    }
    body += decoder.decode(chunk.value, { stream: true });
  }
}

async function identifyShop(env: Environment, hostname: string): Promise<Shop> {
  const row = await env.DB.prepare(`SELECT s.id, s.canonical_hostname AS canonicalHostname, s.settings, s.revision FROM shops s JOIN shop_domains d ON d.shop_id = s.id WHERE d.hostname = ?`)
    .bind(loopback(hostname) ? 'toteworksatx.com' : hostname).first<{ id: string; canonicalHostname: string; settings: string; revision: number }>();
  if (!row) throw new HttpError(404, 'Storefront not found.');
  const pilot = row.id === 'toteworks-atx';
  return { ...row, settings: readSettings(row.settings, pilot ? env.DELIVERY_ORIGIN : '', pilot ? env.CONSULT_TO_EMAIL : '') };
}

const storefrontOrigin = (shop: Shop, url: URL) => loopback(url.hostname) ? url.origin : 'https://' + shop.canonicalHostname;

async function authorize(request: Request, env: Environment, shop: Shop, url: URL) {
  if (loopback(url.hostname) && env.LOCAL_ADMIN_TOKEN && equal(request.headers.get('Authorization') ?? '', 'Bearer ' + env.LOCAL_ADMIN_TOKEN)) return;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  const email = token && env.ACCESS_ISSUER && env.ACCESS_AUDIENCE && await accessEmail(token, env.ACCESS_ISSUER, env.ACCESS_AUDIENCE);
  if (!email) throw new HttpError(401, 'Sign in through Cloudflare Access to open Builder admin.');
  if (shop.id === 'toteworks-atx' && email === env.SHOP_OWNER_EMAIL?.trim().toLowerCase()) return;
  const member = await env.DB.prepare('SELECT 1 FROM shop_members WHERE shop_id = ? AND email = ?').bind(shop.id, email).first();
  if (!member) throw new HttpError(403, 'You do not have access to this shop.');
}

async function addWindow(env: Environment, shop: Shop, fields: Record<string, unknown>) {
  const date = requiredText(fields.date, 'the delivery date', 10);
  const start = requiredText(fields.start, 'the start time', 5);
  const end = requiredText(fields.end, 'the end time', 5);
  const day = new Date(date + 'T00:00:00Z');
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  const now = shopClock(shop.settings.timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day.getTime()) || date !== day.toISOString().slice(0, 10)
    || date < now.date || (date === now.date && start <= now.time) || day.getTime() > Date.now() + 366 * 86400000
    || !timePattern.test(start) || !timePattern.test(end) || start >= end) {
    throw new HttpError(400, 'Choose a future date within the next year and an end time after the start.');
  }
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  const window = { id: crypto.randomUUID(), date, start, end };
  const saved = await env.DB.prepare(`INSERT INTO delivery_windows (id, shop_id, date, start, end, week)
    SELECT ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM delivery_windows w WHERE w.shop_id = ? AND w.date = ? AND w.start < ? AND w.end > ?
      AND (w.enabled = 1 OR EXISTS (SELECT 1 FROM orders o WHERE o.confirmed_window = w.id)))`)
    .bind(window.id, shop.id, date, start, end, day.toISOString().slice(0, 10), shop.id, date, end, start).run();
  if (!saved.meta.changes) throw new HttpError(409, 'That time overlaps another delivery window.');
  return window;
}

async function notifyInquiry(env: Environment, shop: Shop, row: InquiryRow) {
  if (row.emailStatus === 'sent') return inquiryData(row);
  const { email, phone, details, configuration } = inquiryData(row).snapshot;
  const status = await sendEmail(env.RESEND_API_KEY, env.CONSULT_FROM_EMAIL, 'inquiry-' + row.id, {
    to: shop.settings.contactEmail,
    reply_to: email, subject: 'New custom rack inquiry',
    text: `Email: ${email}\nPhone: ${phone}\n\n${details}\n\n${configuration}`,
  });
  await env.DB.prepare(`UPDATE inquiries SET email_status = ? WHERE shop_id = ? AND id = ? AND email_status != 'sent'`).bind(status, shop.id, row.id).run();
  const saved = await env.DB.prepare(`SELECT ${inquiryColumns} FROM inquiries WHERE shop_id = ? AND id = ?`).bind(shop.id, row.id).first<InquiryRow>();
  return inquiryData(saved!);
}

async function consult(env: Environment, shop: Shop, fields: Record<string, unknown>) {
  if (fields.website) return { sent: true };
  const snapshot: SavedInquiry['snapshot'] = {
    email: contactEmail(fields.email),
    phone: requiredText(fields.phone, 'your phone number', 40),
    details: requiredText(fields.details, 'your rack details', 2000),
    configuration: rackSnapshot(fields.racks, shop).map(({ configuration, price }, index) =>
      `Rack ${index + 1} · ${configuration.columns} × ${configuration.rows} · ${toteProfiles[getRackToteType(configuration)].label} · $${price.total}`).join('\n'),
  };
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO inquiries (id, shop_id, snapshot) VALUES (?, ?, ?)').bind(id, shop.id, JSON.stringify(snapshot)).run();
  await notifyInquiry(env, shop, { id, createdAt: '', snapshot: JSON.stringify(snapshot), emailStatus: 'pending' });
  return { sent: true };
}

async function admin(request: Request, env: Environment, shop: Shop, url: URL) {
  await authorize(request, env, shop, url);
  const { pathname } = url;
  const db = env.DB;
  const method = request.method;
  if (method === 'GET' && pathname === '/api/admin') {
    const { date } = shopClock(shop.settings.timezone);
    const [orders, inquiries, windows] = await Promise.all([
      db.prepare(`SELECT ${orderColumns} FROM orders WHERE shop_id = ? ORDER BY created_at DESC, id LIMIT 100`).bind(shop.id).all<OrderRow>(),
      db.prepare(`SELECT ${inquiryColumns} FROM inquiries WHERE shop_id = ? ORDER BY created_at DESC, id LIMIT 100`).bind(shop.id).all<InquiryRow>(),
      db.prepare(`SELECT w.id, w.date, w.start, w.end, w.enabled, o.id AS orderId FROM delivery_windows w
        LEFT JOIN orders o ON o.confirmed_window = w.id WHERE w.shop_id = ? AND w.date >= ? ORDER BY w.date, w.start LIMIT 200`)
        .bind(shop.id, date).all<DeliveryWindow>(),
    ]);
    return json({
      settings: shop.settings, revision: shop.revision, orders: orders.results.map(orderData), inquiries: inquiries.results.map(inquiryData),
      windows: windows.results, today: date, checkout: checkoutMode(env), paymentOrigin: storefrontOrigin(shop, url),
      deliveryReady: Boolean(shop.settings.deliveryOrigin && env.GOOGLE_MAPS_API_KEY && env.QUOTE_SIGNING_SECRET),
      emailReady: Boolean(shop.settings.contactEmail && env.RESEND_API_KEY && env.CONSULT_FROM_EMAIL),
    });
  }
  const fields = record(JSON.parse(await readBody(request, 16000)));
  if (method === 'PUT' && pathname === '/api/admin/settings') {
    if (fields.revision !== shop.revision) throw new HttpError(409, 'Settings changed in another session. Reload before editing.');
    const settings = validateSettings(fields.settings, shop.settings);
    const result = await db.prepare('UPDATE shops SET settings = ?, revision = revision + 1 WHERE id = ? AND revision = ?')
      .bind(JSON.stringify(settings), shop.id, shop.revision).run();
    if (!result.meta.changes) throw new HttpError(409, 'Settings changed in another session. Reload before editing.');
    return json({ settings, revision: shop.revision + 1 });
  }
  if (method !== 'POST') throw new HttpError(405, 'This method is unavailable.');
  if (pathname === '/api/admin/windows') return json(await addWindow(env, shop, fields), 201);
  if (pathname === '/api/admin/windows/close') {
    const id = requiredText(fields.id, 'the window', 36);
    const result = await db.prepare(`UPDATE delivery_windows SET enabled = 0 WHERE shop_id = ? AND id = ?
      AND NOT EXISTS (SELECT 1 FROM orders WHERE confirmed_window = ?)`).bind(shop.id, id, id).run();
    if (!result.meta.changes) throw new HttpError(409, 'The delivery window is booked or unavailable.');
    return json({ closed: true });
  }
  const id = requiredText(fields.id, 'the reference ID', 36);
  if (pathname === '/api/admin/inquiries/retry-email') {
    const row = await db.prepare(`SELECT ${inquiryColumns} FROM inquiries WHERE shop_id = ? AND id = ?`).bind(shop.id, id).first<InquiryRow>();
    if (!row) throw new HttpError(404, 'Inquiry not found.');
    return json(await notifyInquiry(env, shop, row));
  }
  if (pathname === '/api/admin/orders/decline') {
    const result = await db.prepare(`UPDATE orders SET status = 'declined' WHERE shop_id = ? AND id = ? AND status = 'requested'`).bind(shop.id, id).run();
    if (!result.meta.changes) throw new HttpError(409, 'Only pending orders can be declined.');
    return json(orderData(await getOrder(env, shop, id)));
  }
  if (pathname === '/api/admin/orders/confirm' || pathname === '/api/admin/orders/retry-email') {
    const row = pathname.endsWith('/confirm')
      ? await confirmOrder(env, shop, id, requiredText(fields.window, 'the delivery window', 36))
      : await getOrder(env, shop, id);
    return json(await sendConfirmation(env, shop, row, storefrontOrigin(shop, url)));
  }
  throw new HttpError(404, 'Endpoint not found.');
}

async function api(request: Request, env: Environment, url: URL) {
  const shop = await identifyShop(env, url.hostname);
  const { pathname } = url;
  const method = request.method;
  const origin = request.headers.get('Origin');
  if (method !== 'GET' && origin && origin !== url.origin) throw new HttpError(403, 'Open the storefront to submit this request.');
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) return admin(request, env, shop, url);
  const deliveryAvailable = Boolean(shop.settings.deliveryOrigin && env.GOOGLE_MAPS_API_KEY && env.QUOTE_SIGNING_SECRET);
  const requestsAvailable = Boolean((env.ACCESS_ISSUER && env.ACCESS_AUDIENCE) || (loopback(url.hostname) && env.LOCAL_ADMIN_TOKEN));
  if (method === 'GET' && pathname === '/api/shop') {
    return json({ settings: publicSettings(shop.settings), revision: shop.revision, deliveryAvailable, consultAvailable: requestsAvailable } satisfies Storefront);
  }
  if (method === 'GET' && pathname === '/api/delivery-windows') {
    return json({ windows: requestsAvailable ? (await windowsQuery(env, shop)).results : [] });
  }
  if (method === 'POST' && pathname === '/api/stripe/webhook') {
    return json(await stripeWebhook(request, env, shop, await readBody(request, 128000)));
  }
  if (method !== 'POST') throw new HttpError(405, 'This method is unavailable.');
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (env.PUBLIC_LIMIT && !(await env.PUBLIC_LIMIT.limit({ key: shop.id + ':' + pathname + ':' + ip })).success) {
    throw new HttpError(429, 'Too many requests. Wait a minute and try again.');
  }
  const fields = record(JSON.parse(await readBody(request, 16000)));
  if (pathname === '/api/delivery-quote') {
    if (!deliveryAvailable || !env.GOOGLE_MAPS_API_KEY || !env.QUOTE_SIGNING_SECRET) throw new HttpError(503, 'Delivery quotes are unavailable.');
    if (fields.revision !== shop.revision) throw new HttpError(409, 'The storefront settings changed. Refresh the page for current pricing.');
    const destination = streetAddress(fields);
    const feeCents = await routeFee(destination, shop.settings, env.GOOGLE_MAPS_API_KEY);
    return json({ feeCents, token: await createQuote(shop, destination, feeCents, env.QUOTE_SIGNING_SECRET) });
  }
  if (!requestsAvailable && (pathname === '/api/consult' || pathname === '/api/orders')) {
    throw new HttpError(503, 'Online requests are temporarily unavailable.');
  }
  if (pathname === '/api/consult') return json(await consult(env, shop, fields), 201);
  if (pathname === '/api/orders') return json(await requestOrder(env, shop, fields), 201);
  if (pathname === '/api/checkout') {
    const result = await beginCheckout(env, shop, requiredText(fields.token, 'the payment link', 36), storefrontOrigin(shop, url));
    return json({ ...result, test: checkoutMode(env) === 'test' });
  }
  throw new HttpError(404, 'Endpoint not found.');
}

export default {
  async fetch(request: Request, env: Environment) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/admin' || url.pathname === '/admin/') {
        if (!loopback(url.hostname)) await authorize(request, env, await identifyShop(env, url.hostname), url);
      }
      if (url.pathname.startsWith('/api/')) return await api(request, env, url);
      return await env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      if (error instanceof SyntaxError) return json({ error: 'Check the submitted fields.' }, 400);
      console.error('Platform request failed', request.method, url.pathname.startsWith('/api/') ? url.pathname : 'page');
      return json({ error: 'The service is temporarily unavailable. Try again shortly.' }, 500);
    }
  },
};
