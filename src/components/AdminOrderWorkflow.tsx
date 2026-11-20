import { useState } from 'react';
import type { FormEvent } from 'react';
import { paymentMethods } from '../config/payments';
import type { RecordedPayment } from '../config/payments';
import type { QuoteSnapshot, SavedOffer, SavedOrder } from '../config/shop';

export type AdminUpdate = (route: string, body: object, success: string, method?: string) => Promise<boolean>;
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dollars = (cents: number) => currency.format(cents / 100);
const cents = (field: FormDataEntryValue | null) => Math.round(Number(field) * 100);

export function QuoteOfferEditor({ inquiryId, snapshot, offer, origin, update, onCopy }: {
  inquiryId: string; snapshot: QuoteSnapshot; offer?: SavedOffer; origin: string; update: AdminUpdate;
  onCopy: (text: string, message: string) => void;
}) {
  if (offer?.orderId) return <p>Accepted as <a href={'#order-' + offer.orderId}>order {offer.orderId.slice(0, 8).toUpperCase()}</a>.</p>;
  const link = offer ? `${origin}/quote/${offer.token}` : '';
  const active = offer && offer.expiresAt > Date.now();
  const address = offer?.address ?? snapshot.address;
  const deliveryCents = offer?.deliveryCents ?? snapshot.deliveryEstimateCents;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (offer && !globalThis.confirm('Create a new version and replace the previous quote link?')) return;
    const form = new FormData(event.currentTarget);
    void update('/inquiries/offer', {
      ...Object.fromEntries(form), id: inquiryId,
      subtotalCents: cents(form.get('subtotal')), deliveryCents: cents(form.get('delivery')),
    }, 'Quote link created.');
  }

  return <div className="admin-workflow">
    {offer && <>
      <p><strong>Quote {offer.version} · {dollars(offer.totalCents)}</strong> · {active ? 'Awaiting customer acceptance' : 'Expired'}</p>
      {active && <div className="admin-payment">
        <a className="text-link" href={link} target="_blank" rel="noreferrer">Open customer quote</a>
        <button type="button" className="delivery-action delivery-edit" onClick={() => onCopy(link, 'Quote link copied.')}>Copy quote link</button>
        {offer.emailStatus === 'sent' ? <span>Quote email sent</span> : <button type="button" className="delivery-action delivery-edit"
          onClick={() => void update('/inquiries/email-offer', { id: offer.token }, 'Quote email updated.')}>Email quote to customer</button>}
      </div>}
    </>}
    <details key={offer?.version} open={!offer}>
      <summary>{offer ? 'Revise quote' : 'Prepare customer quote'}</summary>
      <form className="delivery-form" onSubmit={submit}>
        <div className="consult-contact">
          <label className="delivery-field">Rack subtotal ($)<input required name="subtotal" type="number" min="0" step="0.01" defaultValue={(offer?.subtotalCents ?? snapshot.rackSubtotalCents) / 100} /></label>
          <label className="delivery-field">Delivery fee ($)<input required name="delivery" type="number" min="0" step="0.01" defaultValue={deliveryCents === undefined ? '' : deliveryCents / 100} /></label>
        </div>
        <label className="delivery-field">Street address<input required name="street" autoComplete="off" maxLength={160} defaultValue={address?.street} /></label>
        <div className="delivery-city-row">
          <label className="delivery-field">City<input required name="city" maxLength={80} defaultValue={address?.city} /></label>
          <label className="delivery-field">State<input required name="state" maxLength={40} defaultValue={address?.state ?? 'TX'} /></label>
          <label className="delivery-field">ZIP code<input required name="zip" inputMode="numeric" maxLength={10} pattern="[0-9]{5}(-[0-9]{4})?" defaultValue={address?.zip ?? snapshot.zip} /></label>
        </div>
        <label className="delivery-field">Apt or unit <small>(optional)</small><input name="unit" maxLength={60} defaultValue={address?.unit} /></label>
        <label className="delivery-field">Note to customer <small>(optional)</small><textarea name="quoteNote" rows={2} maxLength={1000} defaultValue={offer?.quoteNote} /></label>
        <button className="delivery-action">{offer ? 'Create revised quote link' : 'Create quote link'}</button>
      </form>
    </details>
  </div>;
}

export function OrderPayments({ order, payments, update }: { order: SavedOrder; payments: RecordedPayment[]; update: AdminUpdate }) {
  const { id, snapshot, status, recordedPaymentCents } = order;
  const canRecord = !order.completedAt && !order.cancelledAt && !order.paymentToken &&
    (status === 'confirmed' || (status === 'requested' && !!order.quoteInquiryId));
  const paid = status === 'paid' ? snapshot.totalCents : recordedPaymentCents;
  const balance = snapshot.totalCents - paid;
  const depositDue = Math.max(0, (snapshot.payment?.depositCents ?? 0) - paid);
  return <div className="admin-workflow">
    <h3>Payments</h3>
    <dl className="admin-amounts">
      {!!snapshot.payment?.depositCents && <div><dt>Deposit still due</dt><dd>{dollars(depositDue)}</dd></div>}
      <div><dt>Verified payments</dt><dd>{dollars(paid)}</dd></div>
      <div><dt>Balance remaining</dt><dd>{dollars(balance)}</dd></div>
    </dl>
    {payments.length > 0 && <ul className="payment-history">{payments.map((entry) => <li key={entry.id}>
      <strong>{dollars(Math.abs(entry.amountCents))}</strong> · {entry.amountCents < 0 ? 'Refund · ' : ''}{paymentMethods[entry.method]}
      {entry.reference && ` · ${entry.reference}`}
    </li>)}</ul>}
    {canRecord && <PaymentForm key={paid} id={id} paid={paid} balance={balance} suggested={depositDue || balance} update={update} />}
  </div>;
}

function PaymentForm({ id, paid, balance, suggested, update }: {
  id: string; paid: number; balance: number; suggested: number; update: AdminUpdate;
}) {
  const [entryId] = useState(() => crypto.randomUUID());
  const [refund, setRefund] = useState(balance === 0);
  if (!paid && !balance) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void update('/orders/payment', { id, entryId, direction: refund ? 'refund' : 'receipt',
      amountCents: cents(form.get('amount')), method: form.get('method'), reference: form.get('reference') },
    refund ? 'Offline refund recorded.' : 'Offline payment recorded.');
  }
  return <details>
    <summary>Record an offline payment or refund</summary>
    <form className="delivery-form" onSubmit={submit}>
      <div className="consult-contact">
        <label className="delivery-field">Entry type<select value={refund ? 'refund' : 'receipt'} onChange={(event) => setRefund(event.target.value === 'refund')}>
          {balance > 0 && <option value="receipt">Payment received</option>}
          {paid > 0 && <option value="refund">Refund issued</option>}
        </select></label>
        <label className="delivery-field">Amount ($)<input name="amount" key={String(refund)} type="number" required min="0.01"
          max={(refund ? paid : balance) / 100} step="0.01" defaultValue={(refund ? paid : suggested) / 100} /></label>
      </div>
      <label className="delivery-field">Method<select name="method">{Object.entries(paymentMethods).map(([id, label]) =>
        <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="delivery-field">Reference <small>(optional)</small><input name="reference" maxLength={160} /></label>
      <button className="delivery-action">{refund ? 'Record refund' : 'Record payment'}</button>
    </form>
  </details>;
}
