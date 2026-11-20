import { defaultShop } from '../src/config/shop';
import type { AdminSettings, ShopSettings } from '../src/config/shop';
import { depositModes, depositTriggers } from '../src/config/payments';
import type { DepositPolicy } from '../src/config/payments';
import { contactEmail, HttpError, requiredText } from './platform-services';

export function readSettings(stored: string, origin = '', email = ''): AdminSettings {
  return { ...defaultShop, deliveryOrigin: origin, contactEmail: email, ...JSON.parse(stored) };
}

export function publicSettings({ deliveryOrigin: _origin, contactEmail: _email, ...settings }: AdminSettings): ShopSettings {
  return settings;
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Check the submitted fields.');
  return value as Record<string, unknown>;
}

export function numberIn(value: unknown, label: string, min: number, max: number, step = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max
    || Math.abs(value / step - Math.round(value / step)) > 1e-7) throw new HttpError(400, `Check ${label} (between ${min} and ${max}).`);
  return value;
}

function depositSettings(input: unknown): DepositPolicy {
  const { mode, trigger, fixedCents, percent, thresholdCents } = record(input);
  if (typeof mode !== 'string' || !Object.hasOwn(depositModes, mode) || typeof trigger !== 'string' || !Object.hasOwn(depositTriggers, trigger)) {
    throw new HttpError(400, 'Choose a deposit method and trigger.');
  }
  return {
    mode: mode as DepositPolicy['mode'], trigger: trigger as DepositPolicy['trigger'],
    fixedCents: numberIn(fixedCents, 'the fixed deposit', mode === 'fixed' ? 1 : 0, 10_000_000),
    percent: numberIn(percent, 'the deposit percentage', 1, 100),
    thresholdCents: numberIn(thresholdCents, 'the deposit order threshold', 0, 10_000_000),
  };
}

export function validateSettings(input: unknown, current: AdminSettings): AdminSettings {
  const fields = record(input);
  const rates = record(fields.rates);
  const top = record(rates.top);
  const build = record(fields.build);
  const delivery = record(fields.delivery);
  const uprights = Array.isArray(build.uprights) && build.uprights.length === 5
    ? build.uprights.map((length, index) => numberIn(length, `the ${index + 1}-row upright`, (index + 1) * 15.5, (index + 1) * 24, 0.125))
    : [];
  if (uprights.length !== 5 || uprights.some((length, index) => index > 0 && length <= uprights[index - 1])) {
    throw new HttpError(400, 'Enter five increasing upright lengths.');
  }
  const accent = requiredText(fields.accent, 'the accent color', 7);
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new HttpError(400, 'Choose a valid accent color.');

  return {
    name: requiredText(fields.name, 'the shop name', 80),
    title: requiredText(fields.title, 'the storefront headline', 120),
    description: requiredText(fields.description, 'the storefront description', 400),
    serviceArea: requiredText(fields.serviceArea ?? current.serviceArea, 'the service area', 100),
    buildLeadTime: requiredText(fields.buildLeadTime ?? current.buildLeadTime, 'the approximate lead time', 100, true),
    publicEmail: contactEmail(fields.publicEmail ?? current.publicEmail, true),
    accent,
    deposit: fields.deposit === undefined ? current.deposit : depositSettings(fields.deposit),
    timezone: current.timezone,
    contactEmail: contactEmail(fields.contactEmail, true),
    deliveryOrigin: requiredText(fields.deliveryOrigin, 'the routing origin', 240, true),
    rates: {
      slot: numberIn(rates.slot, 'the slot price', 1, 1000),
      caster: numberIn(rates.caster, 'the caster price', 0, 1000),
      tote: numberIn(rates.tote, 'the tote price', 0, 1000),
      top: {
        none: 0,
        'standard-plywood': numberIn(top['standard-plywood'], 'the standard plywood price', 0, 2000),
        'premium-plywood': numberIn(top['premium-plywood'], 'the premium plywood price', 0, 2000),
        mdf: numberIn(top.mdf, 'the MDF price', 0, 2000),
      },
    },
    build: {
      maxColumns: numberIn(build.maxColumns, 'maximum columns', 2, 5),
      maxRows: numberIn(build.maxRows, 'maximum rows', 1, 5),
      narrowBay: numberIn(build.narrowBay, 'narrow tote bay width', 20, 26, 0.125),
      wideBay: numberIn(build.wideBay, 'wide tote bay width', 20.625, 26, 0.125),
      narrowRung: numberIn(build.narrowRung, 'narrow tote rung length', 28.5, 36, 0.125),
      wideRung: numberIn(build.wideRung, 'wide tote rung length', 29.5, 36, 0.125),
      uprights,
      casterLift: numberIn(build.casterLift, 'caster height', 1, 12, 0.125),
      sixWheelColumns: numberIn(build.sixWheelColumns, 'the six-wheel threshold', 2, 6),
    },
    delivery: {
      freeMiles: numberIn(delivery.freeMiles, 'free road miles', 0, 300, 0.5),
      extraMileRate: numberIn(delivery.extraMileRate, 'the price per extra mile', 0, 25, 0.25),
      weeklyCapacity: numberIn(delivery.weeklyCapacity, 'weekly order capacity', 1, 100),
    },
  };
}
