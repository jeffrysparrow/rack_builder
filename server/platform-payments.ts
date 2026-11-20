import { paymentMethods } from '../src/config/payments';
import type { RecordedPayment } from '../src/config/payments';
import { orderData } from './platform-data';
import type { Environment, Shop } from './platform-data';
import { getOrder } from './platform-orders';
import { HttpError, requestId, requiredText } from './platform-services';
import { numberIn } from './platform-settings';

const columns = 'id, order_id AS orderId, amount_cents AS amountCents, method, reference, created_at AS createdAt';

export async function orderPayments(env: Environment, shop: Shop) {
  return (await env.DB.prepare(`SELECT ${columns} FROM order_payments WHERE shop_id = ?
    AND order_id IN (SELECT id FROM orders WHERE shop_id = ? ORDER BY created_at DESC, id LIMIT 100)
    ORDER BY created_at, id`).bind(shop.id, shop.id).all<RecordedPayment>()).results;
}

export async function recordPayment(env: Environment, shop: Shop, orderId: string, fields: Record<string, unknown>, actor: string) {
  const id = requestId(fields.entryId);
  const method = fields.method;
  if (typeof method !== 'string' || !Object.hasOwn(paymentMethods, method)) throw new HttpError(400, 'Choose an offline payment method.');
  if (fields.direction !== 'receipt' && fields.direction !== 'refund') throw new HttpError(400, 'Choose a payment or refund.');
  const amount = numberIn(fields.amountCents, 'the amount', 1, 130_000_000) * (fields.direction === 'refund' ? -1 : 1);
  const reference = requiredText(fields.reference ?? '', 'the payment reference', 160, true);
  const result = await env.DB.prepare(`INSERT INTO order_payments (id, shop_id, order_id, amount_cents, method, reference, recorded_by)
    SELECT ?, o.shop_id, o.id, ?, ?, ?, ? FROM orders o
    WHERE o.shop_id = ? AND o.id = ? AND o.completed_at IS NULL AND o.cancelled_at IS NULL
      AND o.payment_token IS NULL AND o.checkout_session IS NULL
      AND (o.status = 'confirmed' OR (o.status = 'requested' AND o.quote_inquiry_id IS NOT NULL))
      AND ? + COALESCE((SELECT SUM(p.amount_cents) FROM order_payments p WHERE p.shop_id = o.shop_id AND p.order_id = o.id), 0)
        BETWEEN 0 AND json_extract(o.snapshot, '$.totalCents')
    ON CONFLICT(id) DO NOTHING`).bind(id, amount, method, reference, actor, shop.id, orderId, amount).run();
  if (!result.meta.changes) {
    const previous = await env.DB.prepare(`SELECT ${columns} FROM order_payments WHERE shop_id = ? AND id = ?`)
      .bind(shop.id, id).first<RecordedPayment>();
    if (previous?.orderId !== orderId || previous.amountCents !== amount || previous.method !== method || previous.reference !== reference) {
      throw new HttpError(409, 'This amount exceeds the outstanding balance or the order is unavailable for offline payments.');
    }
  }
  return orderData(await getOrder(env, shop, orderId));
}

export async function completeOrder(env: Environment, shop: Shop, id: string) {
  const result = await env.DB.prepare(`UPDATE orders SET completed_at = CURRENT_TIMESTAMP
    WHERE shop_id = ? AND id = ? AND confirmed_window IS NOT NULL AND completed_at IS NULL AND cancelled_at IS NULL
      AND (status = 'paid' OR (status = 'confirmed' AND json_extract(snapshot, '$.totalCents') =
        COALESCE((SELECT SUM(p.amount_cents) FROM order_payments p WHERE p.shop_id = orders.shop_id AND p.order_id = orders.id), 0)))`)
    .bind(shop.id, id).run();
  const order = orderData(await getOrder(env, shop, id));
  if (!result.meta.changes && !order.completedAt) throw new HttpError(409, 'Confirm delivery and settle the balance before completing this order.');
  return order;
}

export async function cancelOrder(env: Environment, shop: Shop, id: string) {
  const result = await env.DB.prepare(`UPDATE orders SET status = 'declined', cancelled_at = CURRENT_TIMESTAMP,
    cancelled_window = confirmed_window, confirmed_window = NULL
    WHERE shop_id = ? AND id = ? AND status IN ('requested', 'confirmed') AND completed_at IS NULL
      AND payment_token IS NULL AND checkout_session IS NULL
      AND COALESCE((SELECT SUM(p.amount_cents) FROM order_payments p WHERE p.shop_id = orders.shop_id AND p.order_id = orders.id), 0) = 0`)
    .bind(shop.id, id).run();
  const order = orderData(await getOrder(env, shop, id));
  if (!result.meta.changes && !order.cancelledAt) throw new HttpError(409, 'Refund offline payments or review the online payment before cancelling.');
  return order;
}
