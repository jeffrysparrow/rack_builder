export const browserEvents = ['configurator_started', 'configuration_completed', 'begin_checkout'] as const;
export type BrowserEvent = typeof browserEvents[number];

export const funnelLabels = {
  configurator_started: 'Configurator started',
  configuration_completed: 'Configuration completed',
  begin_checkout: 'Order flow opened',
  generate_lead: 'Requests received',
  order_confirmed: 'Deliveries booked',
  deposit_paid: 'Deposits verified',
  order_completed: 'Orders completed',
};

export interface AnalyticsSummary {
  events: { event: keyof typeof funnelLabels; total: number }[];
  sources: { observed: string; reported: string | null; leads: number; qualified: number }[];
}
