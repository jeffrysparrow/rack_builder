import { rackRates } from './pricing';
import { defaultBuildRules, finishes, getRackToteType } from './rack';
import { toteProfiles } from './totes';
import type { LeadAttribution } from './attribution';
import { defaultDeposit, depositForOrder } from './payments';
import type { DepositPolicy } from './payments';
import type { CustomerReview } from './reviews';

export const MAX_ORDER_RACKS = 20;
export const MAX_DELIVERY_PREFERENCES = 3;
export const deliveryEstimateExpired = 'Your delivery estimate expired or the address changed. Calculate delivery again.';
export const deliveryTimeUnavailable = 'A time or date you picked is no longer available. Choose an updated delivery time.';

export const defaultShop = {
  name: 'Totes & Timber',
  title: 'Custom tote racks, built for your garage.',
  description: 'Pick your tote brand, choose your size, and see the measurements and price as you go.',
  serviceArea: 'Leander and nearby areas',
  buildLeadTime: '',
  publicEmail: '',
  accent: '#344b37',
  rates: rackRates,
  build: defaultBuildRules,
  delivery: { freeMiles: 15, extraMileRate: 2, weeklyCapacity: 4 },
  deposit: defaultDeposit,
  timezone: 'America/Chicago',
};

export const totesAndTimberPageTitle = 'Custom Garage Tote Racks in Leander, TX | Totes & Timber';

export type ShopSettings = typeof defaultShop;
export type AdminSettings = ShopSettings & { deliveryOrigin: string; contactEmail: string };
export type Storefront = {
  settings: ShopSettings;
  revision: number;
  deliveryAvailable: boolean;
  consultAvailable: boolean;
  reviews: CustomerReview[];
  shareOrigin?: string;
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

export function formatDeliveryDate(date: string) {
  return windowDay.format(new Date(date + 'T00:00:00Z'));
}

export function formatWindow(window: DeliveryWindow) {
  return `${formatDeliveryDate(window.date)}, ${formatWindowTime(window)}`;
}

export function deliveryPreferenceWindows(choice: string, windows: DeliveryWindow[]) {
  return choice.startsWith('day:')
    ? windows.filter((window) => window.date === choice.slice(4))
    : windows.filter((window) => window.id === choice);
}

export function describeDeliveryPreference(choice: string, windows: DeliveryWindow[]) {
  const [first] = deliveryPreferenceWindows(choice, windows);
  if (!first) return '';
  return choice.startsWith('day:') ? `${formatDeliveryDate(first.date)}, any available time` : formatWindow(first);
}

export function formatRackSize({ rows, columns }: Pick<import('./rack').RackConfiguration, 'rows' | 'columns'>) {
  return `${rows} high × ${columns} across`;
}

export async function requestJson<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await fetch(path, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new Error('We couldn’t load that. Refresh the page and try again.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.');
  return data as T;
}

export interface Customer {
  name: string;
  email: string;
  phone: string;
}

export interface SavedRack {
  configuration: import('./rack').RackConfiguration;
  cuts: ReturnType<typeof import('./rack').calculateCutList>;
  price: ReturnType<typeof import('./pricing').estimatePrice>;
}

export function describeRack({ configuration, price }: Pick<SavedRack, 'configuration' | 'price'>) {
  const top = finishes.find(({ id }) => id === configuration.topMaterial)?.label;
  return [
    formatRackSize(configuration),
    `Fits ${toteProfiles[getRackToteType(configuration)].label}`,
    top,
    price.wheelQuantity ? `${price.wheelQuantity} locking wheels` : 'No wheels',
    price.toteQuantity ? `${price.toteQuantity} totes included` : 'No totes included',
  ].join(' · ');
}

export interface OrderSnapshot {
  shopName: string;
  customer: Customer;
  address: { street: string; unit: string; city: string; state: string; zip: string; notes: string };
  windows: DeliveryWindow[];
  deliveryPreferences?: string[];
  racks: SavedRack[];
  deliveryCents: number;
  totalCents: number;
  revision: number;
  attribution?: LeadAttribution;
  adjustmentCents?: number;
  quoteNote?: string;
  payment?: { policy: DepositPolicy; depositCents: number };
}

export function snapshotPayment(policy: DepositPolicy, totalCents: number, racks: SavedRack[]) {
  return { policy, depositCents: depositForOrder(policy, totalCents, racks.some(({ price }) => price.toteQuantity > 0)) };
}

export type SavedOrder = {
  id: string;
  createdAt: string;
  snapshot: OrderSnapshot;
  status: 'requested' | 'confirmed' | 'paid' | 'declined';
  confirmedWindow: string | null;
  paymentToken: string | null;
  emailStatus: string;
  requestEmailStatus: string | null;
  receiptEmailStatus: string | null;
  qualified: 0 | 1;
  quoteInquiryId: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  recordedPaymentCents: number;
};

export interface SavedOffer {
  inquiryId: string;
  token: string;
  version: number;
  expiresAt: number;
  totalCents: number;
  emailStatus: string;
  orderId: string | null;
  address: OrderSnapshot['address'];
  subtotalCents: number;
  deliveryCents: number;
  quoteNote: string;
}

export interface PublicOffer {
  status: 'open' | 'accepted' | 'expired' | 'superseded' | 'cancelled';
  shopName: string;
  version: number;
  expiresAt: number;
  racks: Pick<SavedRack, 'configuration' | 'price'>[];
  totalCents: number;
  adjustmentCents: number;
  deliveryCents: number;
  depositCents: number;
  quoteNote: string;
  orderId: string | null;
}

export interface QuoteSnapshot extends Customer {
  kind: 'quote';
  shopName: string;
  zip: string;
  address?: OrderSnapshot['address'];
  deliveryEstimateCents?: number;
  flexible?: boolean;
  deliveryPreferences?: string[];
  details: string;
  racks: SavedRack[];
  rackSubtotalCents: number;
  revision: number;
  attribution?: LeadAttribution;
  windows?: DeliveryWindow[];
}

export type SavedInquiry = {
  id: string;
  createdAt: string;
  snapshot: QuoteSnapshot | { kind?: 'consult'; email: string; phone: string; details: string; configuration: string; attribution?: LeadAttribution };
  emailStatus: string;
  receiptEmailStatus: string | null;
  qualified: 0 | 1;
};
