import { defaultBuildRules, getCasterCount } from './rack';
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

export function estimatePrice(config: RackConfiguration, rates = rackRates, build = defaultBuildRules) {
  const slots = config.columns * config.rows;
  const wheelQuantity = config.includeCasters ? getCasterCount(config.columns, build) : 0;
  const toteQuantity = config.includeTotesWithDelivery ? slots : 0;
  const frame = slots * rates.slot;
  const top = rates.top[config.topMaterial];
  const wheels = wheelQuantity * rates.caster;
  const totes = toteQuantity * rates.tote;

  return { frame, top, wheels, totes, wheelQuantity, toteQuantity, total: frame + top + wheels + totes };
}

export function estimateOrderPrice(configurations: RackConfiguration[], rates = rackRates, build = defaultBuildRules) {
  return configurations.map((rack) => estimatePrice(rack, rates, build)).reduce((order, rack) => ({
    frame: order.frame + rack.frame,
    top: order.top + rack.top,
    wheels: order.wheels + rack.wheels,
    totes: order.totes + rack.totes,
    wheelQuantity: order.wheelQuantity + rack.wheelQuantity,
    toteQuantity: order.toteQuantity + rack.toteQuantity,
    total: order.total + rack.total,
  }), { frame: 0, top: 0, wheels: 0, totes: 0, wheelQuantity: 0, toteQuantity: 0, total: 0 });
}
