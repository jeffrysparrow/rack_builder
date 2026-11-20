import { calculateCutList, finishes } from '../src/config/rack';
import type { RackConfiguration } from '../src/config/rack';
import { estimatePrice } from '../src/config/pricing';
import { isToteType } from '../src/config/totes';
import { formatWindow, MAX_ORDER_RACKS, snapshotPayment } from '../src/config/shop';
import type { DeliveryWindow, OrderSnapshot } from '../src/config/shop';
import { leadAttribution } from './platform-attribution';
import { orderColumns, orderData, requestedWindows, shopClock } from './platform-data';
import type { Environment, OrderRow, Shop } from './platform-data';
import { rackEmailSummary, sendRequestEmail } from './platform-notifications';
import { contactEmail, equal, hmac, HttpError, requestId, requiredText, sendEmail, streetAddress, stripe } from './platform-services';
import type { Destination } from './platform-services';
import { numberIn, record } from './platform-settings';

export function checkoutMode(env: Environment) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) return 'off';
  return env.STRIPE_SECRET_KEY.includes('_test_') ? 'test' : 'live';
}

async function quoteSignature(shop: Shop, destination: Destination, details: string, secret: string) {
  return hmac(secret, JSON.stringify([shop.id, destination, details]));
}

export async function createQuote(shop: Shop, destination: Destination, cents: number, secret: string) {
  const details = `${shop.revision}.${Date.now() + 30 * 60_000}.${cents}`;
  return details + '.' + await quoteSignature(shop, destination, details, secret);
}

export async function verifyQuote(shop: Shop, destination: Destination, token: unknown, secret: string) {
  if (typeof token === 'string' && /^\d+\.\d+\.\d+\.[0-9a-f]{64}$/.test(token)) {
    const [revision, expiration, fee, signature] = token.split('.');
    if (Number(revision) === shop.revision && Number(expiration) > Date.now()
      && equal(signature, await quoteSignature(shop, destination, [revision, expiration, fee].join('.'), secret))) return Number(fee);
  }
  throw new HttpError(409, 'Your delivery quote expired or the address changed. Calculate delivery again.');
}

export function rackSnapshot(value: unknown, shop: Shop) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ORDER_RACKS) throw new HttpError(400, 'Check your rack order.');
  const { build, rates } = shop.settings;
  return value.map((item) => {
    const rack = record(item);
    const { binType, topMaterial, includeBins, includeTotesWithDelivery, includeCasters } = rack;
    if (typeof binType !== 'string' || !isToteType(binType) || !finishes.some(({ id }) => id === topMaterial)
      || typeof includeBins !== 'boolean' || typeof includeTotesWithDelivery !== 'boolean'
      || typeof includeCasters !== 'boolean') throw new HttpError(400, 'Check your rack options.');
    const configuration: RackConfiguration = {
      columns: numberIn(rack.columns, 'rack columns', 2, build.maxColumns),
      rows: numberIn(rack.rows, 'rack rows', 1, build.maxRows),
      binType, topMaterial: topMaterial as RackConfiguration['topMaterial'], includeBins, includeCasters, includeTotesWithDelivery,
    };
    return { configuration, cuts: calculateCutList(configuration, build), price: estimatePrice(configuration, rates, build) };
  });
}

export async function requestOrder(env: Environment, shop: Shop, fields: Record<string, unknown>) {
  if (!env.QUOTE_SIGNING_SECRET) throw new HttpError(503, 'Order requests are temporarily unavailable.');
  const id = requestId(fields.id);
  const customer = {
    name: requiredText(fields.name, 'your name', 100),
    email: contactEmail(fields.email),
    phone: requiredText(fields.phone, 'your phone number', 40),
  };
  const previous = await env.DB.prepare('SELECT snapshot FROM orders WHERE shop_id = ? AND id = ?').bind(shop.id, id).first<{ snapshot: string }>();
  if (previous) {
    if ((JSON.parse(previous.snapshot) as OrderSnapshot).customer.email !== customer.email) throw new HttpError(409, 'Start a new order request.');
    return { id };
  }
  const address = record(fields.address);
  const destination = streetAddress(address);
  const deliveryCents = await verifyQuote(shop, destination, fields.quoteToken, env.QUOTE_SIGNING_SECRET);
  const racks = rackSnapshot(fields.racks, shop);
  const windows = await requestedWindows(env, shop, fields.windows, true);

  const totalCents = racks.reduce((sum, { price }) => sum + price.total * 100, deliveryCents);
  const snapshot: OrderSnapshot = {
    shopName: shop.settings.name,
    customer,
    address: { ...destination, unit: requiredText(address.unit, 'the unit', 60, true), notes: requiredText(address.notes, 'the delivery notes', 1000, true) },
    windows,
    racks,
    deliveryCents,
    totalCents,
    revision: shop.revision,
    attribution: leadAttribution(fields),
    payment: snapshotPayment(shop.settings.deposit, totalCents, racks),
  };
  const write = await env.DB.prepare(`
    INSERT INTO orders (id, shop_id, snapshot, request_email_status, receipt_email_status) SELECT ?, ?, ?, 'pending', 'pending'
    WHERE (SELECT revision FROM shops WHERE id = ?) = ?
    ON CONFLICT(id) DO NOTHING
  `).bind(id, shop.id, JSON.stringify(snapshot), shop.id, shop.revision).run();
  if (!write.meta.changes) {
    const existing = await env.DB.prepare('SELECT snapshot FROM orders WHERE shop_id = ? AND id = ?').bind(shop.id, id).first<{ snapshot: string }>();
    if (existing && (JSON.parse(existing.snapshot) as OrderSnapshot).customer.email === customer.email) return { id };
    throw new HttpError(409, 'The storefront settings changed. Refresh the page and get a new estimate.');
  }
  const row = await getOrder(env, shop, id);
  await Promise.all([notifyOrderRequest(env, shop, row), notifyOrderRequest(env, shop, row, true)]);
  return { id };
}

export async function getOrder(env: Environment, shop: Shop, id: string) {
  const order = await env.DB.prepare(`SELECT ${orderColumns} FROM orders WHERE shop_id = ? AND id = ?`).bind(shop.id, id).first<OrderRow>();
  if (!order) throw new HttpError(404, 'Order not found.');
  return order;
}

export async function notifyOrderRequest(env: Environment, shop: Shop, row: OrderRow, receipt = false) {
  const { id, snapshot } = orderData(row);
  const { customer, racks, deliveryCents, totalCents } = snapshot;
  await sendRequestEmail(env, shop, receipt ? {
    id, table: 'orders', column: 'receipt_email_status', status: row.receiptEmailStatus, key: 'order-receipt-' + id,
    message: {
      to: customer.email, reply_to: shop.settings.contactEmail || undefined, subject: `Order request received by ${shop.settings.name}`,
      text: `Thanks, ${customer.name}. ${row.quoteInquiryId ? 'Your quote was accepted. Your builder will contact you to schedule delivery.' : 'Your builder will review your delivery preferences and follow up about payment.'}\n\n${rackEmailSummary(racks)}\nDelivery: $${(deliveryCents / 100).toFixed(2)}\n${row.quoteInquiryId ? 'Accepted' : 'Estimated'} total: $${(totalCents / 100).toFixed(2)}\n\nOrder reference: ${id.slice(0, 8).toUpperCase()}`,
    },
  } : {
    id, table: 'orders', column: 'request_email_status', status: row.requestEmailStatus, key: 'order-request-' + id,
    message: {
      to: shop.settings.contactEmail, subject: 'New rack order request', reply_to: customer.email,
      text: `${customer.name} requested ${racks.length} rack(s). Open Builder admin to review the order and delivery preferences.\n\nOrder ${id}`,
    },
  });
}

export async function confirmOrder(env: Environment, shop: Shop, id: string, windowId: string, online = false) {
  const row = await getOrder(env, shop, id);
  if (row.confirmedWindow === windowId) return row;
  const { snapshot } = orderData(row);
  if (row.status !== 'requested' || (!row.quoteInquiryId && !snapshot.windows.some((window) => window.id === windowId))) {
    throw new HttpError(409, 'This delivery window cannot be confirmed for the order.');
  }
  const cardAvailable = checkoutMode(env) !== 'off';
  if (online && (!cardAvailable || snapshot.payment?.depositCents || snapshot.totalCents === 0 || row.recordedPaymentCents > 0)) {
    throw new HttpError(409, 'Online prepayment is unavailable for this order.');
  }
  const paymentToken = cardAvailable && (online || !snapshot.payment) ? crypto.randomUUID() : null;
  const quoteWindow = row.quoteInquiryId ? await env.DB.prepare(`SELECT id, date, start, end FROM delivery_windows WHERE shop_id = ? AND id = ?`)
    .bind(shop.id, windowId).first<DeliveryWindow>() : null;
  if (row.quoteInquiryId && !quoteWindow) throw new HttpError(409, 'Choose a delivery window from this shop.');
  const bookedWindows = quoteWindow && !snapshot.windows.some((window) => window.id === windowId)
    ? [...snapshot.windows, quoteWindow] : snapshot.windows;
  const { date, time } = shopClock(shop.settings.timezone);
  const result = await env.DB.prepare(`
    UPDATE orders SET status = 'confirmed', confirmed_window = ?, payment_token = ?,
      snapshot = CASE WHEN quote_inquiry_id IS NOT NULL THEN json_set(snapshot, '$.windows', json(?)) ELSE snapshot END
    WHERE id = ? AND shop_id = ? AND status = 'requested'
      AND (SELECT revision FROM shops WHERE id = ?) = ?
      AND EXISTS (SELECT 1 FROM delivery_windows w
        WHERE w.id = ? AND w.shop_id = ? AND w.enabled = 1
          AND (w.date > ? OR (w.date = ? AND w.start > ?))
          AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.confirmed_window = w.id)
          AND (SELECT COUNT(*) FROM orders o JOIN delivery_windows used ON used.id = o.confirmed_window
            WHERE o.shop_id = w.shop_id AND used.week = w.week) < ?)
      AND (? IS NULL OR NOT EXISTS (SELECT 1 FROM order_payments p WHERE p.shop_id = orders.shop_id AND p.order_id = orders.id))
  `).bind(windowId, paymentToken, JSON.stringify(bookedWindows), id, shop.id, shop.id, shop.revision,
    windowId, shop.id, date, date, time, shop.settings.delivery.weeklyCapacity, paymentToken).run();
  const saved = await getOrder(env, shop, id);
  if (!result.meta.changes && saved.confirmedWindow !== windowId) {
    throw new HttpError(409, 'That delivery window is past, closed, booked, or its week is at capacity.');
  }
  return saved;
}

export async function sendConfirmation(env: Environment, shop: Shop, row: OrderRow, origin: string) {
  if (row.emailStatus === 'sent' || row.status === 'paid') return orderData(row);
  const { snapshot } = orderData(row);
  const window = snapshot.windows.find(({ id }) => id === row.confirmedWindow);
  if (!window) throw new HttpError(409, 'Confirm a delivery window first.');
  const mode = checkoutMode(env);
  const depositCents = snapshot.payment?.depositCents ?? 0;
  const remainingDeposit = Math.max(0, depositCents - row.recordedPaymentCents);
  const remainingBalance = snapshot.totalCents - row.recordedPaymentCents - remainingDeposit;
  const payment = row.paymentToken && mode !== 'off'
    ? `\n${mode === 'test' ? 'Test checkout (no real charge)' : 'Pay securely'}: ${origin}/pay/${row.paymentToken}`
    : remainingDeposit > 0
      ? `\nDeposit due: $${(remainingDeposit / 100).toFixed(2)}. Your builder will provide payment instructions.\nRemaining after deposit: $${(remainingBalance / 100).toFixed(2)}.`
      : `\nBalance due at delivery: $${(remainingBalance / 100).toFixed(2)}.`;
  const result = await sendEmail(env.RESEND_API_KEY, env.CONSULT_FROM_EMAIL, 'order-confirmed-' + row.id, {
    to: snapshot.customer.email, subject: `Delivery confirmed by ${shop.settings.name}`,
    reply_to: shop.settings.contactEmail || undefined,
    text: `Your racks are scheduled for ${formatWindow(window)} (${shop.settings.timezone}).\nOrder total: $${(snapshot.totalCents / 100).toFixed(2)}${payment}\n\nOrder ${row.id}`,
  }, shop.settings.name);
  await env.DB.prepare(`UPDATE orders SET email_status = ? WHERE shop_id = ? AND id = ? AND email_status != 'sent'`).bind(result, shop.id, row.id).run();
  return orderData(await getOrder(env, shop, row.id));
}

type StripeSession = { id: string; status: string; url: string | null; payment_status: string; amount_total: number; currency: string; metadata?: { order_id?: string; shop_id?: string } };

export async function beginCheckout(env: Environment, shop: Shop, token: string, origin: string) {
  if (checkoutMode(env) === 'off' || !env.STRIPE_SECRET_KEY) throw new HttpError(503, 'Online payment is unavailable. Contact your builder.');
  const row = await env.DB.prepare(`SELECT ${orderColumns} FROM orders WHERE shop_id = ? AND payment_token = ?`).bind(shop.id, token).first<OrderRow>();
  if (!row) throw new HttpError(404, 'This payment link was not found.');
  if (row.status === 'paid') return { paid: true };
  if (row.status !== 'confirmed') throw new HttpError(409, 'This order is awaiting delivery confirmation.');
  const { date, time } = shopClock(shop.settings.timezone);
  const snapshot = orderData(row).snapshot;
  const window = snapshot.windows.find(({ id }) => id === row.confirmedWindow);
  if (!window || window.date < date || (window.date === date && window.start <= time)) {
    throw new HttpError(409, 'This delivery window has started or passed. Contact your builder before paying.');
  }
  if (row.checkoutSession) {
    const existing = await stripe<StripeSession>(env.STRIPE_SECRET_KEY, 'checkout/sessions/' + encodeURIComponent(row.checkoutSession));
    if (existing.status === 'open' && existing.url) return { url: existing.url };
    if (existing.status === 'complete') return { paid: existing.payment_status === 'paid' };
    const updated = await env.DB.prepare(`UPDATE orders SET checkout_session = NULL, checkout_attempt = checkout_attempt + 1
      WHERE shop_id = ? AND id = ? AND status = 'confirmed' AND checkout_session = ?`).bind(shop.id, row.id, row.checkoutSession).run();
    if (!updated.meta.changes) throw new HttpError(409, 'Checkout changed. Please try again.');
    row.checkoutAttempt++;
  }
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: origin + '/order-received',
    cancel_url: origin + '/pay/' + token,
    customer_email: snapshot.customer.email,
    'payment_method_types[0]': 'card',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(snapshot.totalCents),
    'line_items[0][price_data][product_data][name]': snapshot.shopName + ' rack order',
    'metadata[order_id]': row.id,
    'metadata[shop_id]': shop.id,
  });
  const session = await stripe<StripeSession>(env.STRIPE_SECRET_KEY, 'checkout/sessions', form, `rack-${row.id}-${row.checkoutAttempt}`);
  await env.DB.prepare(`UPDATE orders SET checkout_session = ? WHERE shop_id = ? AND id = ? AND status = 'confirmed'
    AND checkout_attempt = ? AND checkout_session IS NULL`).bind(session.id, shop.id, row.id, row.checkoutAttempt).run();
  if (!session.url) throw new HttpError(502, 'Checkout is temporarily unavailable.');
  return { url: session.url };
}

export async function stripeWebhook(request: Request, env: Environment, shop: Shop, body: string) {
  const signature = request.headers.get('Stripe-Signature') ?? '';
  const entries = signature.split(',').map((value) => value.trim().split('='));
  const timestamp = entries.find(([key]) => key === 't')?.[1] ?? '';
  if (!env.STRIPE_WEBHOOK_SECRET || !/^\d{1,12}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new HttpError(400, 'Invalid webhook signature.');
  }
  const expected = await hmac(env.STRIPE_WEBHOOK_SECRET, timestamp + '.' + body);
  if (!entries.some(([key, value]) => key === 'v1' && typeof value === 'string' && equal(expected, value))) {
    throw new HttpError(400, 'Invalid webhook signature.');
  }
  const event = JSON.parse(body) as { type: string; data: { object: StripeSession } };
  if (event.type !== 'checkout.session.completed') return { received: true };
  const session = event.data.object;
  const orderId = session.metadata?.order_id;
  if (session.payment_status !== 'paid' || session.currency !== 'usd' || session.metadata?.shop_id !== shop.id || !orderId) {
    return { received: true };
  }
  const order = await getOrder(env, shop, orderId);
  if (session.id !== order.checkoutSession || session.amount_total !== orderData(order).snapshot.totalCents) {
    throw new HttpError(409, 'Payment does not match the order.');
  }
  await env.DB.prepare(`UPDATE orders SET status = 'paid' WHERE shop_id = ? AND id = ? AND status = 'confirmed'`).bind(shop.id, orderId).run();
  return { received: true };
}
