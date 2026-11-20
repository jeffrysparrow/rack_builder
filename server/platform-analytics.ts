import { browserEvents } from '../src/config/analytics';
import type { AnalyticsSummary, BrowserEvent } from '../src/config/analytics';
import type { Environment, Shop } from './platform-data';
import { HttpError, requestId } from './platform-services';

export async function recordBrowserEvent(env: Environment, shop: Shop, fields: Record<string, unknown>) {
  const { event } = fields;
  if (!browserEvents.includes(event as BrowserEvent)) throw new HttpError(400, 'Unknown storefront event.');
  await env.DB.prepare(`INSERT INTO funnel_events (shop_id, event, event_key) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`)
    .bind(shop.id, event as BrowserEvent, requestId(fields.sessionId)).run();
}

export async function analyticsSummary(env: Environment, shop: Shop): Promise<AnalyticsSummary> {
  const [events, sources] = await Promise.all([
    env.DB.prepare(`SELECT event, COUNT(*) AS total FROM funnel_events WHERE shop_id = ? AND created_at >= datetime('now', '-90 days') GROUP BY event`)
      .bind(shop.id).all<AnalyticsSummary['events'][number]>(),
    env.DB.prepare(`WITH leads AS (
      SELECT snapshot, qualified FROM inquiries WHERE shop_id = ? AND created_at >= datetime('now', '-90 days')
      UNION ALL SELECT snapshot, qualified FROM orders WHERE shop_id = ? AND quote_inquiry_id IS NULL AND created_at >= datetime('now', '-90 days')
    ) SELECT COALESCE(json_extract(snapshot, '$.attribution.firstTouch.utm.source'), json_extract(snapshot, '$.attribution.firstTouch.referrerHost'), 'Direct or unknown') AS observed,
      json_extract(snapshot, '$.attribution.reportedSource') AS reported, COUNT(*) AS leads, SUM(qualified) AS qualified
      FROM leads GROUP BY observed, reported ORDER BY qualified DESC, leads DESC, observed`)
      .bind(shop.id, shop.id).all<AnalyticsSummary['sources'][number]>(),
  ]);
  return { events: events.results, sources: sources.results };
}
