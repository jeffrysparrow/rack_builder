import type { BrowserEvent } from './config/analytics';

const trackingKey = 'rack-builder:analytics-session';
const sent = new Set<BrowserEvent>();
let sessionId: string | undefined;

export function track(event: BrowserEvent) {
  if (sent.has(event)) return;
  if (!sessionId) {
    try {
      sessionId = sessionStorage.getItem(trackingKey) || crypto.randomUUID();
      sessionStorage.setItem(trackingKey, sessionId);
    } catch {
      sessionId = crypto.randomUUID();
    }
  }
  sent.add(event);
  void fetch('/api/analytics', {
    method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, sessionId }),
  }).then((response) => { if (!response.ok) sent.delete(event); }).catch(() => sent.delete(event));
}
