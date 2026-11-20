import { discoverySources, readTouch } from '../src/config/attribution';
import type { LeadAttribution } from '../src/config/attribution';

export function leadAttribution(fields: Record<string, unknown>): LeadAttribution | undefined {
  const visit = fields.visit as { firstTouch?: unknown; lastTouch?: unknown } | undefined;
  const firstTouch = readTouch(visit?.firstTouch);
  const lastTouch = readTouch(visit?.lastTouch);
  const reportedSource = typeof fields.discovery === 'string' && Object.hasOwn(discoverySources, fields.discovery)
    ? fields.discovery as LeadAttribution['reportedSource'] : undefined;
  if (firstTouch || lastTouch || reportedSource) return { firstTouch, lastTouch, reportedSource };
}
