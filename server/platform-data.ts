import type { AdminSettings, DeliveryWindow, SavedOrder, SavedInquiry } from '../src/config/shop';

interface Statement {
  bind(...bindings: (string | number | null)[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Environment {
  DB: { prepare(sql: string): Statement };
  ASSETS: { fetch(request: Request): Promise<Response> };
  PUBLIC_LIMIT?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  ACCESS_ISSUER?: string;
  ACCESS_AUDIENCE?: string;
  SHOP_OWNER_EMAIL?: string;
  LOCAL_ADMIN_TOKEN?: string;
  DELIVERY_ORIGIN?: string;
  GOOGLE_MAPS_API_KEY?: string;
  QUOTE_SIGNING_SECRET?: string;
  RESEND_API_KEY?: string;
  CONSULT_FROM_EMAIL?: string;
  CONSULT_TO_EMAIL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}
export type Shop = { id: string; canonicalHostname: string; revision: number; settings: AdminSettings };
export type OrderRow = Omit<SavedOrder, 'snapshot'> & { snapshot: string; checkoutSession: string | null; checkoutAttempt: number };
export const orderColumns = 'id, created_at AS createdAt, snapshot, status, confirmed_window AS confirmedWindow, payment_token AS paymentToken, email_status AS emailStatus, checkout_session AS checkoutSession, checkout_attempt AS checkoutAttempt';
export const orderData = ({ snapshot, checkoutSession: _session, checkoutAttempt: _attempt, ...row }: OrderRow): SavedOrder => (
  { ...row, snapshot: JSON.parse(snapshot) }
);
export const inquiryData = ({ snapshot, ...row }: Omit<SavedInquiry, 'snapshot'> & { snapshot: string }): SavedInquiry => (
  { ...row, snapshot: JSON.parse(snapshot) }
);

export function shopClock(timeZone: string) {
  const format = new Intl.DateTimeFormat('sv-SE', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const [date, time] = format.format(new Date()).split(' ');
  return { date, time };
}

export function windowsQuery(env: Environment, shop: Shop) {
  const { date, time } = shopClock(shop.settings.timezone);
  return env.DB.prepare(`
    SELECT w.id, w.date, w.start, w.end
    FROM delivery_windows w
    WHERE w.shop_id = ? AND w.enabled = 1
      AND (w.date > ? OR (w.date = ? AND w.start > ?))
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.confirmed_window = w.id)
      AND (SELECT COUNT(*) FROM orders o JOIN delivery_windows used ON used.id = o.confirmed_window
        WHERE o.shop_id = w.shop_id AND used.week = w.week) < ?
    ORDER BY w.date, w.start LIMIT 100
  `).bind(shop.id, date, date, time, shop.settings.delivery.weeklyCapacity).all<DeliveryWindow>();
}
