export const depositModes = { off: 'Off', fixed: 'Fixed amount', percentage: 'Percentage', full: 'Full payment upfront' };
export const depositTriggers = {
  always: 'Every order', threshold: 'At or above an order total', totes: 'Orders that include purchased totes',
  either: 'Order total or purchased totes', both: 'Order total and purchased totes',
};

export interface DepositPolicy {
  mode: keyof typeof depositModes;
  trigger: keyof typeof depositTriggers;
  fixedCents: number;
  percent: number;
  thresholdCents: number;
}

export const defaultDeposit: DepositPolicy = { mode: 'off', trigger: 'always', fixedCents: 0, percent: 25, thresholdCents: 0 };

export function depositForOrder(policy: DepositPolicy, totalCents: number, purchasedTotes: boolean) {
  const aboveThreshold = totalCents >= policy.thresholdCents;
  const applies = {
    always: true, threshold: aboveThreshold, totes: purchasedTotes,
    either: aboveThreshold || purchasedTotes, both: aboveThreshold && purchasedTotes,
  }[policy.trigger];
  if (!applies || policy.mode === 'off') return 0;
  if (policy.mode === 'full') return totalCents;
  return Math.min(totalCents, policy.mode === 'fixed' ? policy.fixedCents : Math.round(totalCents * policy.percent / 100));
}

export const paymentMethods = { cash: 'Cash', check: 'Check', transfer: 'Bank transfer', other: 'Other offline payment' };
export interface RecordedPayment {
  id: string;
  orderId: string;
  amountCents: number;
  method: keyof typeof paymentMethods;
  reference: string;
  createdAt: string;
}
