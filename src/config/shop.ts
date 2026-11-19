import { rackRates } from './pricing';
import { defaultBuildRules } from './rack';

export const MAX_ORDER_RACKS = 20;

export const defaultShop = {
  name: 'ToteWorks ATX',
  title: 'Custom wooden tote racks',
  description: 'Get your garage or shed organized with a rack sized for your 27-gallon totes. Keep it open or add a solid top for a work surface.',
  accent: '#344b37',
  rates: rackRates,
  build: defaultBuildRules,
  delivery: { freeMiles: 15, extraMileRate: 2, weeklyCapacity: 4 },
  timezone: 'America/Chicago',
};

export type ShopSettings = typeof defaultShop;
export type AdminSettings = ShopSettings & { deliveryOrigin: string; contactEmail: string };
export type Storefront = {
  settings: ShopSettings;
  revision: number;
  deliveryAvailable: boolean;
  consultAvailable: boolean;
};

export interface DeliveryWindow {
  id: string;
  date: string;
  start: string;
  end: string;
}

const windowDay = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' });
const windowTime = new Intl.DateTimeFormat('en-US', { timeStyle: 'short', timeZone: 'UTC' });

export function formatWindowTime({ date, start, end }: DeliveryWindow) {
  return `${windowTime.format(new Date(date + 'T' + start + ':00Z'))}–${windowTime.format(new Date(date + 'T' + end + ':00Z'))}`;
}

export function formatWindow(window: DeliveryWindow) {
  return `${windowDay.format(new Date(window.date + 'T00:00:00Z'))}, ${formatWindowTime(window)}`;
}

export async function requestJson<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await fetch(path, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new Error('The service is unavailable. Try refreshing the page.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The request could not be completed.');
  return data as T;
}

export interface Customer {
  name: string;
  email: string;
  phone: string;
}

export interface OrderSnapshot {
  shopName: string;
  customer: Customer;
  address: { street: string; unit: string; city: string; state: string; zip: string; notes: string };
  windows: DeliveryWindow[];
  racks: {
    configuration: import('./rack').RackConfiguration;
    cuts: ReturnType<typeof import('./rack').calculateCutList>;
    price: ReturnType<typeof import('./pricing').estimatePrice>;
  }[];
  deliveryCents: number;
  totalCents: number;
  revision: number;
}

export type SavedOrder = {
  id: string;
  createdAt: string;
  snapshot: OrderSnapshot;
  status: 'requested' | 'confirmed' | 'paid' | 'declined';
  confirmedWindow: string | null;
  paymentToken: string | null;
  emailStatus: string;
};

export type SavedInquiry = {
  id: string;
  createdAt: string;
  snapshot: { email: string; phone: string; details: string; configuration: string };
  emailStatus: string;
};
