import { describeRack } from '../src/config/shop';
import type { SavedRack } from '../src/config/shop';
import type { Environment, Shop } from './platform-data';
import { sendEmail } from './platform-services';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function rackEmailSummary(racks: SavedRack[]) {
  return racks.map((rack, index) => `Rack ${index + 1}: ${describeRack(rack)} · ${dollars.format(rack.price.total)}`).join('\n');
}

export async function sendRequestEmail(env: Environment, shop: Shop, {
  id, table, column, status, key, message,
}: {
  id: string;
  table: 'inquiries' | 'orders';
  column: 'email_status' | 'request_email_status' | 'receipt_email_status';
  status: string | null;
  key: string;
  message: Parameters<typeof sendEmail>[3];
}) {
  if (status === null || status === 'sent') return;
  const result = await sendEmail(env.RESEND_API_KEY, env.CONSULT_FROM_EMAIL, key, message, shop.settings.name);
  await env.DB.prepare(`UPDATE ${table} SET ${column} = ? WHERE shop_id = ? AND id = ? AND ${column} != 'sent'`)
    .bind(result, shop.id, id).run();
}
