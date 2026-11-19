import { getCasterCount } from './rack';
import type { RackConfiguration } from './rack';

export const rackRates = {
  slot: 20,
  top: {
    none: 0,
    'standard-plywood': 60,
    'premium-plywood': 90,
    mdf: 90,
  },
  caster: 15,
  tote: 15,
};

export function estimatePrice(config: RackConfiguration) {
  const slots = config.columns * config.rows;
  const wheelQuantity = config.includeCasters ? getCasterCount(config.columns) : 0;
  const toteQuantity = config.includeTotesWithDelivery ? slots : 0;
  const frame = slots * rackRates.slot;
  const top = rackRates.top[config.topMaterial];
  const wheels = wheelQuantity * rackRates.caster;
  const totes = toteQuantity * rackRates.tote;

  return { frame, top, wheels, totes, wheelQuantity, toteQuantity, total: frame + top + wheels + totes };
}
