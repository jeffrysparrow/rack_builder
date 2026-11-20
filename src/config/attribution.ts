export const discoverySources = {
  marketplace: 'Facebook Marketplace',
  search: 'Google Search or Maps',
  referral: 'Referral or word of mouth',
  social: 'Other social media',
  other: 'Other',
};

export const campaignFields = ['source', 'medium', 'campaign', 'content', 'term'] as const;
type CampaignField = typeof campaignFields[number];

export interface VisitTouch {
  landingPath: '/' | '/rack-builds/';
  referrerHost?: string;
  utm?: Partial<Record<CampaignField, string>>;
}

export interface LeadAttribution {
  firstTouch?: VisitTouch;
  lastTouch?: VisitTouch;
  reportedSource?: keyof typeof discoverySources;
}

export function readTouch(value: unknown): VisitTouch | undefined {
  if (!value || typeof value !== 'object' || !('landingPath' in value)
    || (value.landingPath !== '/' && value.landingPath !== '/rack-builds/')) return;
  const touch: VisitTouch = { landingPath: value.landingPath };
  if ('referrerHost' in value && typeof value.referrerHost === 'string'
    && value.referrerHost.length <= 253 && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(value.referrerHost)) {
    touch.referrerHost = value.referrerHost.toLowerCase();
  }
  if ('utm' in value && value.utm && typeof value.utm === 'object') {
    const fields = value.utm as Record<string, unknown>;
    for (const field of campaignFields) {
      const tag = fields[field];
      if (typeof tag === 'string' && /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,99}$/u.test(tag)) {
        (touch.utm ??= {})[field] = tag.trim();
      }
    }
  }
  return touch;
}
