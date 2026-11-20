import { snapshotPayment } from '../src/config/shop';
import type { OrderSnapshot, PublicOffer, SavedOffer } from '../src/config/shop';
import { getInquiry } from './platform-inquiries';
import type { Environment, Shop } from './platform-data';
import { getOrder, notifyOrderRequest } from './platform-orders';
import { HttpError, requestId, requiredText, sendEmail, streetAddress } from './platform-services';
import { numberIn } from './platform-settings';

type OfferRow = Pick<SavedOffer, 'token' | 'inquiryId' | 'version' | 'expiresAt' | 'emailStatus' | 'orderId'>
  & { snapshot: string; latest: number; acceptedToken: string | null; cancelledAt: string | null };
const offerColumns = `v.token, v.inquiry_id AS inquiryId, v.version, v.snapshot, v.expires_at AS expiresAt, v.email_status AS emailStatus,
  o.id AS orderId, o.quote_offer_token AS acceptedToken, o.cancelled_at AS cancelledAt,
  v.version = (SELECT MAX(x.version) FROM quote_offers x WHERE x.shop_id = v.shop_id AND x.inquiry_id = v.inquiry_id) AS latest`;
const offerFrom = `FROM quote_offers v LEFT JOIN orders o ON o.shop_id = v.shop_id AND o.quote_inquiry_id = v.inquiry_id`;

async function getOffer(env: Environment, shop: Shop, token: string) {
  const row = await env.DB.prepare(`SELECT ${offerColumns} ${offerFrom} WHERE v.shop_id = ? AND v.token = ?`)
    .bind(shop.id, requestId(token)).first<OfferRow>();
  if (!row) throw new HttpError(404, 'This quote link was not found.');
  return row;
}

export async function latestOffers(env: Environment, shop: Shop) {
  const { results } = await env.DB.prepare(`SELECT ${offerColumns} ${offerFrom}
    WHERE v.shop_id = ? AND v.inquiry_id IN (SELECT id FROM inquiries WHERE shop_id = v.shop_id ORDER BY created_at DESC, id LIMIT 100)
      AND v.version = (SELECT MAX(x.version) FROM quote_offers x WHERE x.shop_id = v.shop_id AND x.inquiry_id = v.inquiry_id)
    ORDER BY v.sequence DESC LIMIT 100`).bind(shop.id).all<OfferRow>();
  return results.map(({ token, inquiryId, version, snapshot, expiresAt, emailStatus, orderId }): SavedOffer => {
    const { totalCents, deliveryCents, quoteNote, address } = JSON.parse(snapshot) as OrderSnapshot;
    return { token, inquiryId, version, expiresAt, emailStatus, totalCents, orderId, address,
      subtotalCents: totalCents - deliveryCents, deliveryCents, quoteNote: quoteNote ?? '' };
  });
}

export async function issueOffer(env: Environment, shop: Shop, inquiryId: string, fields: Record<string, unknown>) {
  const inquiry = await getInquiry(env, shop, inquiryId);
  if (!inquiry) throw new HttpError(404, 'Quote request not found.');
  const quote = JSON.parse(inquiry.snapshot) as import('../src/config/shop').SavedInquiry['snapshot'];
  if (quote.kind !== 'quote') throw new HttpError(409, 'An offer needs a configured rack quote.');
  const deliveryCents = numberIn(fields.deliveryCents, 'delivery fee in cents', 0, 10_000_000);
  const subtotalCents = numberIn(fields.subtotalCents, 'rack subtotal in cents', 0, 120_000_000);
  const totalCents = subtotalCents + deliveryCents;
  const snapshot: OrderSnapshot = {
    shopName: shop.settings.name,
    customer: { name: quote.name, email: quote.email, phone: quote.phone },
    address: { ...streetAddress(fields), unit: requiredText(fields.unit ?? '', 'the unit', 60, true), notes: '' },
    windows: quote.windows ?? [], racks: quote.racks, deliveryCents, totalCents, revision: quote.revision,
    adjustmentCents: subtotalCents - quote.rackSubtotalCents,
    quoteNote: requiredText(fields.quoteNote ?? '', 'the note to the customer', 1000, true),
    attribution: quote.attribution,
    payment: snapshotPayment(shop.settings.deposit, totalCents, quote.racks),
  };
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 14 * 86400_000;
  const result = await env.DB.prepare(`INSERT INTO quote_offers (token, shop_id, inquiry_id, version, snapshot, expires_at)
    SELECT ?, ?, ?, COALESCE((SELECT MAX(version) FROM quote_offers WHERE shop_id = ? AND inquiry_id = ?), 0) + 1, ?, ?
    WHERE (SELECT revision FROM shops WHERE id = ?) = ?
      AND NOT EXISTS (SELECT 1 FROM orders WHERE shop_id = ? AND quote_inquiry_id = ?)`)
    .bind(token, shop.id, inquiryId, shop.id, inquiryId, JSON.stringify(snapshot), expiresAt,
      shop.id, shop.revision, shop.id, inquiryId).run();
  if (!result.meta.changes) throw new HttpError(409, 'This quote was accepted or settings changed. Refresh Builder admin.');
  return { token };
}

export async function emailOffer(env: Environment, shop: Shop, token: string, origin: string) {
  const row = await getOffer(env, shop, token);
  if (!row.latest || row.orderId || row.expiresAt <= Date.now()) throw new HttpError(409, 'Only an active quote can be emailed.');
  if (row.emailStatus === 'sent') return { emailStatus: 'sent' };
  const snapshot = JSON.parse(row.snapshot) as OrderSnapshot;
  const emailStatus = await sendEmail(env.RESEND_API_KEY, env.CONSULT_FROM_EMAIL, 'quote-offer-' + row.token, {
    to: snapshot.customer.email, reply_to: shop.settings.contactEmail || undefined,
    subject: `Your rack quote from ${shop.settings.name}`,
    text: `Review and accept your rack quote for $${(snapshot.totalCents / 100).toFixed(2)}.\n\n${origin}/quote/${row.token}`,
  }, shop.settings.name);
  await env.DB.prepare(`UPDATE quote_offers SET email_status = ? WHERE shop_id = ? AND token = ? AND email_status != 'sent'`)
    .bind(emailStatus, shop.id, row.token).run();
  return { emailStatus: (await getOffer(env, shop, token)).emailStatus };
}

export async function publicOffer(env: Environment, shop: Shop, token: string): Promise<PublicOffer> {
  const row = await getOffer(env, shop, token);
  const orderId = row.acceptedToken === row.token ? row.orderId : null;
  const status = orderId ? (row.cancelledAt ? 'cancelled' : 'accepted') : !row.latest ? 'superseded' : row.expiresAt <= Date.now() ? 'expired' : 'open';
  const { shopName, racks, totalCents, deliveryCents, adjustmentCents, payment, quoteNote } = JSON.parse(row.snapshot) as OrderSnapshot;
  return { status, shopName, version: row.version, expiresAt: row.expiresAt, racks: racks.map(({ configuration, price }) => ({ configuration, price })), totalCents,
    deliveryCents, adjustmentCents: adjustmentCents ?? 0, depositCents: payment?.depositCents ?? 0, quoteNote: quoteNote ?? '', orderId };
}

export async function acceptOffer(env: Environment, shop: Shop, token: string) {
  const row = await getOffer(env, shop, token);
  if (row.cancelledAt) throw new HttpError(409, 'This order was cancelled. Contact your builder.');
  if (row.acceptedToken === token) return { id: row.orderId };
  if (!row.latest || row.orderId || row.expiresAt <= Date.now()) throw new HttpError(409, 'This quote is no longer available. Contact your builder.');
  const id = crypto.randomUUID();
  const result = await env.DB.prepare(`INSERT INTO orders
    (id, shop_id, snapshot, qualified, quote_inquiry_id, quote_offer_token, request_email_status, receipt_email_status)
    SELECT ?, v.shop_id, v.snapshot, i.qualified, i.id, v.token, 'pending', 'pending'
    FROM quote_offers v JOIN inquiries i ON i.id = v.inquiry_id AND i.shop_id = v.shop_id
    WHERE v.shop_id = ? AND v.token = ? AND v.expires_at > ?
      AND v.version = (SELECT MAX(x.version) FROM quote_offers x WHERE x.shop_id = v.shop_id AND x.inquiry_id = i.id)
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.shop_id = v.shop_id AND o.quote_inquiry_id = i.id)`)
    .bind(id, shop.id, token, Date.now()).run();
  if (!result.meta.changes) {
    const latest = await getOffer(env, shop, token);
    if (latest.acceptedToken === token) return { id: latest.orderId };
    throw new HttpError(409, 'This quote is no longer available. Contact your builder.');
  }
  const order = await getOrder(env, shop, id);
  await Promise.all([notifyOrderRequest(env, shop, order), notifyOrderRequest(env, shop, order, true)]);
  return { id };
}
