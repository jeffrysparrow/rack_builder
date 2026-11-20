import { getRackToteType } from '../src/config/rack';
import { toteProfiles } from '../src/config/totes';
import type { QuoteSnapshot, SavedInquiry } from '../src/config/shop';
import { leadAttribution } from './platform-attribution';
import { describeDeliveryPreference, formatRackSize, formatWindow } from '../src/config/shop';
import { inquiryColumns, inquiryData, requestedQuotePreferences } from './platform-data';
import type { Environment, InquiryRow, Shop } from './platform-data';
import { rackEmailSummary, sendRequestEmail } from './platform-notifications';
import { rackSnapshot, verifyQuote } from './platform-orders';
import { contactEmail, HttpError, requestId, requiredText, streetAddress, zipCode } from './platform-services';
import { record } from './platform-settings';

export async function getInquiry(env: Environment, shop: Shop, id: string) {
  return env.DB.prepare(`SELECT ${inquiryColumns} FROM inquiries WHERE shop_id = ? AND id = ?`).bind(shop.id, id).first<InquiryRow>();
}

export async function notifyInquiry(env: Environment, shop: Shop, row: InquiryRow, receipt = false) {
  const { id, snapshot } = inquiryData(row);
  const { email, phone, details } = snapshot;
  const quote = snapshot.kind === 'quote' ? snapshot : null;
  const label = quote ? 'Order request' : 'Inquiry';
  const requested = quote?.deliveryPreferences?.map((choice) => describeDeliveryPreference(choice, quote.windows ?? []))
    ?? quote?.windows?.map(formatWindow);
  const preferences = requested?.length
    ? `\n\nPreferred delivery times (${shop.settings.timezone}):\n${requested.map((label, index) => `${index + 1}. ${label}`).join('\n')}` : '';
  const estimate = quote?.deliveryEstimateCents === undefined ? ''
    : `\nEstimated delivery: $${(quote.deliveryEstimateCents / 100).toFixed(2)}\nEstimated total: $${((quote.rackSubtotalCents + quote.deliveryEstimateCents) / 100).toFixed(2)}`;
  const summary = snapshot.kind === 'quote'
    ? `${rackEmailSummary(snapshot.racks)}\nRack and accessories subtotal: $${(snapshot.rackSubtotalCents / 100).toFixed(2)} before delivery.${estimate}${preferences}`
    : snapshot.configuration;

  if (receipt && quote) {
    await sendRequestEmail(env, shop, {
      id, table: 'inquiries', column: 'receipt_email_status', status: row.receiptEmailStatus, key: 'quote-receipt-' + id,
      message: {
        to: email, reply_to: shop.settings.publicEmail || shop.settings.contactEmail || undefined, subject: `Order request received by ${shop.settings.name}`,
        text: `Thanks, ${quote.name}. Your builder will follow up with a quote and confirm the rack details, delivery and any payment arrangements with you before building. No payment was collected.\n\n${summary}\n\nRequest reference: ${id.slice(0, 8).toUpperCase()}`,
      },
    });
  } else if (!receipt) {
    await sendRequestEmail(env, shop, {
      id, table: 'inquiries', column: 'email_status', status: row.emailStatus, key: 'inquiry-' + id,
      message: {
        to: shop.settings.contactEmail, reply_to: email, subject: quote ? 'New rack order request' : 'New custom rack inquiry',
        text: `${quote ? `${quote.name}\nZIP code: ${quote.zip}\n` : ''}Email: ${email}\nPhone: ${phone}\n\n${details}\n\n${summary}\n\n${label} ${id}`,
      },
    });
  }
}

export async function consult(env: Environment, shop: Shop, fields: Record<string, unknown>) {
  if (fields.website) return { sent: true };
  const snapshot: SavedInquiry['snapshot'] = {
    email: contactEmail(fields.email),
    phone: requiredText(fields.phone, 'your phone number', 40),
    details: requiredText(fields.details, 'your rack details', 2000),
    configuration: rackSnapshot(fields.racks, shop).map(({ configuration, price }, index) =>
      `Rack ${index + 1} · ${formatRackSize(configuration)} · ${toteProfiles[getRackToteType(configuration)].label} · $${price.total}`).join('\n'),
    attribution: leadAttribution(fields),
  };
  const id = crypto.randomUUID();
  const json = JSON.stringify(snapshot);
  await env.DB.prepare('INSERT INTO inquiries (id, shop_id, snapshot) VALUES (?, ?, ?)').bind(id, shop.id, json).run();
  await notifyInquiry(env, shop, { id, createdAt: '', snapshot: json, emailStatus: 'pending', receiptEmailStatus: null, qualified: 0 });
  return { sent: true };
}

export async function requestRackQuote(env: Environment, shop: Shop, fields: Record<string, unknown>) {
  const id = requestId(fields.id);
  if (fields.website) return { id, rackSubtotalCents: 0 };
  const email = contactEmail(fields.email);
  const savedQuote = await getInquiry(env, shop, id);
  if (savedQuote) return quoteResult(savedQuote, email);
  if (fields.revision !== shop.revision) throw new HttpError(409, 'The storefront settings changed. Refresh for current pricing.');

  const racks = rackSnapshot(fields.racks, shop);
  const { windows, deliveryPreferences } = await requestedQuotePreferences(env, shop, fields.windows);
  const addressFields = fields.address === undefined ? undefined : record(fields.address);
  const destination = addressFields && streetAddress(addressFields);
  const address = addressFields && destination && {
    ...destination,
    unit: requiredText(addressFields.unit ?? '', 'the unit', 60, true),
    notes: requiredText(addressFields.notes ?? '', 'the delivery notes', 1000, true),
  };
  let deliveryEstimateCents: number | undefined;
  if (fields.quoteToken !== undefined) {
    if (!destination || !env.QUOTE_SIGNING_SECRET) throw new HttpError(409, 'Your delivery quote expired or the address changed. Calculate delivery again.');
    deliveryEstimateCents = await verifyQuote(shop, destination, fields.quoteToken, env.QUOTE_SIGNING_SECRET);
  }
  const snapshot: QuoteSnapshot = {
    kind: 'quote', shopName: shop.settings.name, email,
    name: requiredText(fields.name, 'your name', 100),
    phone: requiredText(fields.phone, 'your phone number', 40),
    zip: address?.zip ?? zipCode(fields.zip),
    address,
    deliveryEstimateCents,
    flexible: fields.flexible === true && !windows.length ? true : undefined,
    details: requiredText(fields.details ?? '', 'your rack details', 2000, true),
    racks,
    windows,
    deliveryPreferences,
    rackSubtotalCents: racks.reduce((sum, { price }) => sum + price.total * 100, 0),
    revision: shop.revision,
    attribution: leadAttribution(fields),
  };
  const json = JSON.stringify(snapshot);
  const write = await env.DB.prepare(`
    INSERT INTO inquiries (id, shop_id, snapshot, receipt_email_status) SELECT ?, ?, ?, 'pending'
    WHERE (SELECT revision FROM shops WHERE id = ?) = ?
    ON CONFLICT(id) DO NOTHING
  `).bind(id, shop.id, json, shop.id, shop.revision).run();
  if (!write.meta.changes) {
    const existing = await getInquiry(env, shop, id);
    if (existing) return quoteResult(existing, email);
    throw new HttpError(409, 'The storefront settings changed. Refresh for current pricing.');
  }

  const row: InquiryRow = { id, snapshot: json, createdAt: '', qualified: 0, emailStatus: 'pending', receiptEmailStatus: 'pending' };
  await Promise.all([notifyInquiry(env, shop, row), notifyInquiry(env, shop, row, true)]);
  return quoteResult(row, email);
}

function quoteResult(row: InquiryRow, email: string) {
  const { id, snapshot } = inquiryData(row);
  if (snapshot.kind !== 'quote' || snapshot.email !== email) throw new HttpError(409, 'Start a new quote request.');
  return { id, rackSubtotalCents: snapshot.rackSubtotalCents, deliveryEstimateCents: snapshot.deliveryEstimateCents };
}
