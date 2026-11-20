import { campaignFields, readTouch } from './config/attribution';
import type { LeadAttribution, VisitTouch } from './config/attribution';

const firstTouchKey = 'rack-builder:first-touch';
const lastTouchKey = 'rack-builder:last-touch';
const firstTouchLifetime = 90 * 24 * 60 * 60 * 1000;
let visit: Pick<LeadAttribution, 'firstTouch' | 'lastTouch'> | undefined;

export function captureVisit() {
  const path = location.pathname === '/rack-builds' ? '/rack-builds/' : location.pathname;
  if (visit || (path !== '/' && path !== '/rack-builds/')) return;
  const query = new URLSearchParams(location.search);
  const referrer = document.referrer ? new URL(document.referrer) : undefined;
  let lastTouch = readTouch({
    landingPath: path,
    referrerHost: referrer?.origin === location.origin ? undefined : referrer?.hostname,
    utm: Object.fromEntries(campaignFields.map((field) => [field, query.get(`utm_${field}`)])),
  });
  try {
    if (referrer?.origin === location.origin && !lastTouch?.utm) {
      lastTouch = readTouch(JSON.parse(sessionStorage.getItem(lastTouchKey) ?? 'null')) ?? lastTouch;
    }
    sessionStorage.setItem(lastTouchKey, JSON.stringify(lastTouch));
  } catch {
    // Capture the current visit when session storage is unavailable.
  }
  let firstTouch = lastTouch;
  try {
    const stored = JSON.parse(localStorage.getItem(firstTouchKey) ?? 'null') as { capturedAt: number; touch: VisitTouch } | null;
    const now = Date.now();
    const recent = stored && stored.capturedAt <= now && now - stored.capturedAt < firstTouchLifetime && readTouch(stored.touch);
    if (recent) firstTouch = recent;
    else localStorage.setItem(firstTouchKey, JSON.stringify({ capturedAt: now, touch: lastTouch }));
  } catch {
    // A visit can still be attributed if browser storage is unavailable.
  }
  visit = { firstTouch, lastTouch };
}

export function getVisit() {
  return visit;
}
