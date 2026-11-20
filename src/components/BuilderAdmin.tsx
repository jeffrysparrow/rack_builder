import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { funnelLabels } from '../config/analytics';
import type { AnalyticsSummary } from '../config/analytics';
import { discoverySources } from '../config/attribution';
import type { LeadAttribution, VisitTouch } from '../config/attribution';
import { formatCutLength } from '../config/rack';
import { depositModes, depositTriggers } from '../config/payments';
import type { DepositPolicy, RecordedPayment } from '../config/payments';
import type { AdminReview } from '../config/reviews';
import { describeRack, formatWindow, requestJson } from '../config/shop';
import type { AdminSettings, DeliveryWindow, SavedInquiry, SavedOffer, SavedOrder, SavedRack } from '../config/shop';
import { OrderPayments, QuoteOfferEditor } from './AdminOrderWorkflow';
import type { AdminUpdate } from './AdminOrderWorkflow';
import { BuilderReviews } from './BuilderReviews';

type AdminPanel = {
  settings: AdminSettings;
  revision: number;
  windows: (DeliveryWindow & { enabled: number; orderId: string | null })[];
  orders: SavedOrder[];
  inquiries: SavedInquiry[];
  offers: SavedOffer[];
  payments: RecordedPayment[];
  availableWindows: DeliveryWindow[];
  analytics: AnalyticsSummary;
  reviews: AdminReview[];
  today: string;
  checkout: 'off' | 'test' | 'live';
  paymentOrigin: string;
  deliveryReady: boolean;
  emailReady: boolean;
};
const tabs = ['Orders', 'Delivery', 'Storefront', 'Reviews', 'Analytics'] as const;
type Tab = typeof tabs[number];
type Update = AdminUpdate;
type CopyLink = (text: string, message: string) => void;
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const labels = { requested: 'Awaiting confirmation', confirmed: 'Delivery confirmed', paid: 'Paid', declined: 'Declined' };
const notices: Record<string, string> = { sent: 'Email sent', unconfigured: 'Email setup required', failed: 'Email failed', pending: 'Email pending' };

function orderLabel(order: SavedOrder) {
  if (order.cancelledAt) return 'Cancelled';
  if (order.completedAt) return 'Completed';
  if (order.status === 'requested' && order.quoteInquiryId) return 'Quote accepted · schedule delivery';
  if (order.status === 'confirmed' && (order.snapshot.payment?.depositCents ?? 0) > order.recordedPaymentCents) return 'Awaiting deposit';
  return labels[order.status];
}

async function adminJson<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const token = local ? sessionStorage.getItem('builder-admin-token') : '';
  if (!token) return requestJson<T>('/api/admin' + path, body, method);
  const response = await fetch('/api/admin' + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error('The local Worker is unavailable.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
  return result;
}

export function BuilderAdmin() {
  const [data, setData] = useState<AdminPanel>();
  const [tab, setTab] = useState<Tab>('Orders');
  const [status, setStatus] = useState<{ text: string; error?: boolean }>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    setStatus(undefined);
    try {
      setData(await adminJson<AdminPanel>(''));
    } catch (error) {
      setStatus({ text: (error as Error).message, error: true });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const update: Update = async (route, body, success, method) => {
    setBusy(true);
    setStatus(undefined);
    let saved = false;
    try {
      const result = await adminJson<{ emailStatus?: string }>(route, body, method);
      saved = true;
      setData(await adminJson<AdminPanel>(''));
      const notice = result.emailStatus && notices[result.emailStatus];
      setStatus({ text: notice ? `${success} ${notice}.` : success });
    } catch (error) {
      setStatus({ text: saved ? 'The change was saved. Refresh to see the latest dashboard.' : (error as Error).message, error: true });
    } finally {
      setBusy(false);
    }
    return saved;
  };

  return <main className="admin workspace">
    <header className="admin-heading">
      <div><a className="text-link" href="/">View storefront</a><h1>Builder admin</h1>{data && <p>{data.settings.name}</p>}</div>
      {data && <button className="delivery-action delivery-edit" onClick={refresh} disabled={loading || busy}>Refresh</button>}
    </header>
    {status && <p className={status.error ? 'admin-feedback admin-error' : 'admin-feedback'} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
    {loading && !data && <p role="status">Loading your dashboard…</p>}
    {local && !loading && !data && <form className="admin-card delivery-form" onSubmit={(event) => {
      event.preventDefault();
      sessionStorage.setItem('builder-admin-token', String(new FormData(event.currentTarget).get('token') ?? '').trim());
      void refresh();
    }}>
      <label className="delivery-field">Local development token<input name="token" type="password" autoComplete="off" required /></label>
      <button className="delivery-action">Open dashboard</button>
    </form>}
    {data && <>
      <nav className="admin-nav" aria-label="Builder admin sections">
        {tabs.map((item) => <button key={item} type="button"
          aria-current={tab === item ? 'page' : undefined} onClick={() => { setTab(item); setStatus(undefined); }}>{item}</button>)}
      </nav>
      <fieldset className="admin-content" disabled={busy || loading} aria-busy={busy || loading}>
        {tab === 'Storefront' && <Settings key={data.revision} data={data} update={update} />}
        {tab === 'Delivery' && <Windows data={data} update={update} />}
        {tab === 'Analytics' && <Analytics data={data.analytics} />}
        {tab === 'Reviews' && <BuilderReviews reviews={data.reviews} update={update} />}
        {tab === 'Orders' && <Orders data={data} update={update} onCopy={(text, message) => {
          navigator.clipboard.writeText(text).then(() => setStatus({ text: message }))
            .catch(() => setStatus({ text: 'Copy the address directly from the link.', error: true }));
        }} />}
      </fieldset>
    </>}
  </main>;
}

function Settings({ data, update }: { data: AdminPanel; update: Update }) {
  const { settings, revision } = data;
  const { rates, build, delivery, deposit } = settings;
  const [depositMode, setDepositMode] = useState(deposit.mode);
  const input = (name: string, label: string, value: string, maxLength: number, type = 'text', required = true) =>
    <label className="delivery-field" key={name}>{label}<input name={name} defaultValue={value} type={type} maxLength={maxLength} required={required} /></label>;
  const numeric = (name: string, label: string, value: number, min = 0, max = 1000, step = 1) =>
    <label className="delivery-field" key={name}>{label}<input name={name} defaultValue={value} type="number" min={min} max={max} step={step} required /></label>;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (name: string) => String(form.get(name) ?? '');
    const n = (name: string) => Number(get(name));
    const draft: AdminSettings = {
      ...settings, name: get('name'), title: get('title'), description: get('description'), accent: get('accent'),
      serviceArea: get('serviceArea'), buildLeadTime: get('buildLeadTime'), publicEmail: get('publicEmail'),
      contactEmail: get('contactEmail'), deliveryOrigin: get('deliveryOrigin'),
      deposit: {
        mode: depositMode,
        trigger: (get('depositTrigger') || deposit.trigger) as DepositPolicy['trigger'],
        fixedCents: get('depositAmount') ? Math.round(n('depositAmount') * 100) : deposit.fixedCents,
        percent: get('depositPercent') ? n('depositPercent') : deposit.percent,
        thresholdCents: get('depositThreshold') ? Math.round(n('depositThreshold') * 100) : deposit.thresholdCents,
      },
      rates: {
        slot: n('slot'), caster: n('caster'), tote: n('tote'),
        top: { none: 0, 'standard-plywood': n('standard'), 'premium-plywood': n('premium'), mdf: n('mdf') },
      },
      delivery: { freeMiles: n('freeMiles'), extraMileRate: n('extraMileRate'), weeklyCapacity: n('weeklyCapacity') },
      build: {
        maxColumns: n('maxColumns'), maxRows: n('maxRows'), narrowBay: n('narrowBay'), wideBay: n('wideBay'),
        narrowRung: n('narrowRung'), wideRung: n('wideRung'), casterLift: n('casterLift'),
        sixWheelColumns: n('sixWheelColumns'), uprights: build.uprights.map((_, index) => n('upright' + index)),
      },
    };
    void update('/settings', { revision, settings: draft }, 'Storefront settings saved.', 'PUT');
  }

  return <form className="admin-settings" onSubmit={save}>
    <section className="admin-card">
      <h2>Brand and contact</h2>
      <div className="admin-fields">
        {input('name', 'Shop name', settings.name, 80)}
        {input('title', 'Storefront headline', settings.title, 120)}
        {input('accent', 'Accent color', settings.accent, 7, 'color')}
        {input('contactEmail', 'Inquiry and order notification email', settings.contactEmail, 254, 'email', false)}
      </div>
      <label className="delivery-field">Storefront description<textarea name="description" maxLength={400} rows={3} required defaultValue={settings.description} /></label>
      <div className="admin-fields">
        {input('serviceArea', 'Public service area', settings.serviceArea, 100)}
        {input('buildLeadTime', 'Approximate build lead time', settings.buildLeadTime, 100, 'text', false)}
        {input('publicEmail', 'Public contact email', settings.publicEmail, 254, 'email', false)}
      </div>
      <p className="layout-help">Customers see the contact form when the public email is blank.</p>
    </section>
    <section className="admin-card">
      <h2>Rack pricing</h2>
      <div className="admin-fields">
        {numeric('slot', 'Price per tote slot ($)', rates.slot, 1)}
        {numeric('caster', 'Price per caster ($)', rates.caster)}
        {numeric('tote', 'Price per tote ($)', rates.tote)}
        {numeric('standard', 'Standard plywood top ($)', rates.top['standard-plywood'], 0, 2000)}
        {numeric('premium', 'Premium plywood top ($)', rates.top['premium-plywood'], 0, 2000)}
        {numeric('mdf', 'MDF top ($)', rates.top.mdf, 0, 2000)}
      </div>
    </section>
    <section className="admin-card">
      <h2>Deposit policy</h2>
      <p className="layout-help">Customers pay on delivery when deposits are off. Saved quotes and orders keep the terms they were issued with.</p>
      <div className="admin-fields">
        <label className="delivery-field">Deposit method<select value={depositMode} onChange={(event) => setDepositMode(event.target.value as DepositPolicy['mode'])}>
          {Object.entries(depositModes).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        {depositMode !== 'off' && <>
          <label className="delivery-field">When to request it<select name="depositTrigger" defaultValue={deposit.trigger}>
            {Object.entries(depositTriggers).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select></label>
          {depositMode === 'fixed' && numeric('depositAmount', 'Deposit amount ($)', deposit.fixedCents / 100, .01, 100000, .01)}
          {depositMode === 'percentage' && numeric('depositPercent', 'Deposit percentage', deposit.percent, 1, 100)}
          {numeric('depositThreshold', 'Order total threshold ($)', deposit.thresholdCents / 100, 0, 100000, .01)}
        </>}
      </div>
    </section>
    <section className="admin-card">
      <h2>Delivery settings</h2>
      <p className="layout-help">The routing origin is private. Weekly capacity counts confirmed orders for Monday through Sunday.</p>
      {input('deliveryOrigin', 'Routing origin address', settings.deliveryOrigin, 240, 'text', false)}
      <div className="admin-fields">
        {numeric('freeMiles', 'Free road miles', delivery.freeMiles, 0, 300, 0.5)}
        {numeric('extraMileRate', 'Rate per extra road mile ($)', delivery.extraMileRate, 0, 25, 0.25)}
        {numeric('weeklyCapacity', 'Confirmed orders per week', delivery.weeklyCapacity, 1, 100)}
      </div>
    </section>
    <section className="admin-card">
      <h2>Build dimensions</h2>
      <p className="layout-help">Widths and lengths are in inches. HDX and Sterilite use the narrow profile.</p>
      <div className="admin-fields">
        {numeric('maxColumns', 'Maximum columns', build.maxColumns, 2, 5)}
        {numeric('maxRows', 'Maximum rows', build.maxRows, 1, 5)}
        {numeric('narrowBay', 'Narrow bay width (in)', build.narrowBay, 20, 26, .125)}
        {numeric('wideBay', 'Wide bay width (in)', build.wideBay, 20.625, 26, .125)}
        {numeric('narrowRung', 'Narrow rung length (in)', build.narrowRung, 28.5, 36, .125)}
        {numeric('wideRung', 'Wide rung length (in)', build.wideRung, 29.5, 36, .125)}
        {numeric('casterLift', 'Caster height (in)', build.casterLift, 1, 12, .125)}
        {numeric('sixWheelColumns', 'Minimum columns for six wheels', build.sixWheelColumns, 2, 6)}
        {build.uprights.map((value, index) => numeric('upright' + index, `${index + 1}-row upright (in)`, value, (index + 1) * 15.5, (index + 1) * 24, .125))}
      </div>
    </section>
    <button className="delivery-action">Save storefront settings</button>
  </form>;
}

function Windows({ data, update }: { data: AdminPanel; update: Update }) {
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await update('/windows', Object.fromEntries(new FormData(form)), 'Delivery window added.')) form.reset();
  }
  return <section className="admin-card">
    <h2>Delivery windows</h2>
    <p className="layout-help">{data.settings.timezone} · {data.settings.delivery.weeklyCapacity} confirmed orders per week</p>
    <p>Customers can share up to three preferred windows with an order request. Book a window after reviewing the order.</p>
    <form className="delivery-form" onSubmit={add}>
      <div className="admin-fields">
        <label className="delivery-field">Date<input name="date" type="date" min={data.today} required /></label>
        <label className="delivery-field">Start<input name="start" type="time" required /></label>
        <label className="delivery-field">End<input name="end" type="time" required /></label>
      </div>
      <button className="delivery-action">Add delivery window</button>
    </form>
    <ul className="admin-windows">{data.windows.map((window) => <li key={window.id}>
      <span>{formatWindow(window)}</span>
      {window.orderId ? <strong>Booked</strong> : window.enabled
        ? <button className="delivery-action delivery-edit" onClick={() => void update('/windows/close', { id: window.id }, 'Delivery window closed.')}>Close window</button>
        : <span>Closed</span>}
    </li>)}</ul>
  </section>;
}

function Orders({ data, update, onCopy }: { data: AdminPanel; update: Update; onCopy: CopyLink }) {
  const [leadFilter, setLeadFilter] = useState('all');
  const matchesLeadFilter = ({ qualified }: SavedOrder | SavedInquiry) => leadFilter === 'all' || String(qualified) === leadFilter;
  const orders = data.orders.filter(matchesLeadFilter);
  const inquiries = data.inquiries.filter(matchesLeadFilter);

  return <>
    <dl className="admin-integrations">
      <div><dt>Delivery quotes</dt><dd>{data.deliveryReady ? 'Ready' : 'Setup required'}</dd></div>
      <div><dt>Email</dt><dd>{data.emailReady ? 'Ready' : local ? 'Not connected in this preview' : 'Setup required'}</dd></div>
      <div><dt>Stripe Checkout</dt><dd>{{ off: 'Off', test: 'Test mode', live: 'Live' }[data.checkout]}</dd></div>
    </dl>
    <label className="delivery-field admin-lead-filter">Lead status
      <select value={leadFilter} onChange={(event) => setLeadFilter(event.target.value)}>
        <option value="all">All requests</option>
        <option value="1">Qualified leads</option>
        <option value="0">Unreviewed leads</option>
      </select>
    </label>
    <section className="admin-card">
      <h2>Rack orders</h2>
      {!orders.length && <p>{leadFilter === 'all' ? 'No orders yet.' : 'No matching orders.'}</p>}
      {orders.map((order) => <details id={'order-' + order.id} key={order.id} className="admin-record">
        <summary><strong>{order.snapshot.customer.name}</strong><span>{orderLabel(order)} · {dollars.format(order.snapshot.totalCents / 100)}{order.qualified ? ' · Qualified' : ''}</span></summary>
        <OrderDetails order={order} checkout={data.checkout} paymentOrigin={data.paymentOrigin} update={update} onCopy={onCopy}
          available={data.availableWindows} payments={data.payments.filter(({ orderId }) => orderId === order.id)} />
      </details>)}
    </section>
    <section className="admin-card">
      <h2>Order requests and custom inquiries</h2>
      {!inquiries.length && <p>{leadFilter === 'all' ? 'No requests or custom inquiries yet.' : 'No matching requests or inquiries.'}</p>}
      {inquiries.map((inquiry) => <InquiryDetails key={inquiry.id} inquiry={inquiry} update={update} onCopy={onCopy}
        origin={data.paymentOrigin} offer={data.offers.find(({ inquiryId }) => inquiryId === inquiry.id)} />)}
    </section>
  </>;
}

function InquiryDetails({ inquiry, update, offer, origin, onCopy }: {
  inquiry: SavedInquiry; update: Update; offer?: SavedOffer; origin: string; onCopy: CopyLink;
}) {
  const { id, snapshot, emailStatus, receiptEmailStatus, qualified } = inquiry;
  const quote = snapshot.kind === 'quote' ? snapshot : null;
  return <details className="admin-record">
    <summary><strong>{quote ? quote.name : snapshot.email}</strong>
      <span>{quote ? `${offer?.orderId ? 'Accepted quote' : 'Order request'} · ${dollars.format((offer?.totalCents ?? quote.rackSubtotalCents) / 100)}` : 'Custom inquiry'}{qualified ? ' · Qualified' : ''}</span>
    </summary>
    <div className="admin-order-detail">
      {quote && <p>Request reference <strong>{id.slice(0, 8).toUpperCase()}</strong> · Delivery ZIP {quote.zip}</p>}
      <p><a href={`mailto:${snapshot.email}`}>{snapshot.email}</a> · {snapshot.phone}</p>
      {snapshot.details && <p className="admin-notes">{snapshot.details}</p>}
      {snapshot.kind === 'quote' ? <>
        <p>Rack and accessories estimate <strong>{dollars.format(snapshot.rackSubtotalCents / 100)}</strong> before delivery</p>
        <RackDetails racks={snapshot.racks} />
        {!!snapshot.windows?.length && <>
          <h3>Preferred delivery times</h3>
          <ol className="payment-history">{snapshot.windows.map((window) => <li key={window.id}>{formatWindow(window)}</li>)}</ol>
        </>}
        <QuoteOfferEditor inquiryId={id} snapshot={snapshot} offer={offer} origin={origin} update={update} onCopy={onCopy} />
      </> : <p className="admin-notes">{snapshot.configuration}</p>}
      <LeadDetails attribution={snapshot.attribution} qualified={qualified} onQualify={() => void update('/inquiries/qualify',
        { id, qualified: !qualified }, qualified ? 'Lead marked unreviewed.' : 'Lead marked qualified.')} />
      <RequestEmail label="Builder alert" status={emailStatus} retry={() => void update('/inquiries/retry-email', { id }, 'Builder alert updated.')} />
      <RequestEmail label="Customer receipt" status={receiptEmailStatus} retry={() => void update('/inquiries/retry-receipt', { id }, 'Customer receipt updated.')} />
    </div>
  </details>;
}

function describeTouch(touch?: VisitTouch) {
  if (!touch) return 'Unknown';
  const tags = Object.entries(touch.utm ?? {}).map(([name, value]) => `${name} ${value}`);
  if (touch.referrerHost) tags.push(`from ${touch.referrerHost}`);
  return tags.length ? tags.join(' · ') : 'Direct or unknown';
}

function LeadDetails({ attribution, qualified, onQualify }: { attribution?: LeadAttribution; qualified: 0 | 1; onQualify: () => void }) {
  return <div className="admin-lead">
    <h3>Lead source</h3>
    {attribution ? <dl>
      <div><dt>First visit</dt><dd>{describeTouch(attribution.firstTouch)}</dd></div>
      <div><dt>Latest visit</dt><dd>{describeTouch(attribution.lastTouch)}</dd></div>
      <div><dt>Customer reported</dt><dd>{attribution.reportedSource ? discoverySources[attribution.reportedSource] : 'No answer'}</dd></div>
    </dl> : <p>No source recorded.</p>}
    <button type="button" className="delivery-action delivery-edit" onClick={onQualify}>{qualified ? 'Mark unreviewed' : 'Mark qualified'}</button>
  </div>;
}

function RequestEmail({ label, status, retry }: { label: string; status: string | null; retry: () => void }) {
  if (status === null) return null;
  return <p className="admin-request-email">
    <span>{label} · {notices[status]}</span>
    {status !== 'sent' && <button type="button" className="delivery-action delivery-edit" onClick={retry}>Retry {label.toLowerCase()}</button>}
  </p>;
}

function RackDetails({ racks, showCuts = false }: { racks: SavedRack[]; showCuts?: boolean }) {
  return <>
    {racks.map((rack, index) => <div key={index}>
      <h4>Rack {index + 1} · {dollars.format(rack.price.total)}</h4>
      <p>{describeRack(rack)}</p>
      <p>{Math.ceil(rack.cuts.width)} in W × {Math.ceil(rack.cuts.height)} in H × {Math.ceil(rack.cuts.depth)} in D</p>
      {showCuts && <table className="admin-cuts">
        <thead><tr><th scope="col">Part</th><th scope="col">Quantity</th><th scope="col">Cut length</th></tr></thead>
        <tbody>{rack.cuts.pieces.map((piece) => <tr key={piece.name}><th scope="row">{piece.name}</th><td>{piece.quantity}</td><td>{formatCutLength(piece.length)} in</td></tr>)}</tbody>
      </table>}
    </div>)}
  </>;
}

function OrderDetails({ order, update, checkout, paymentOrigin, onCopy, available, payments }: {
  order: SavedOrder; update: Update; checkout: AdminPanel['checkout']; paymentOrigin: string; onCopy: CopyLink;
  available: DeliveryWindow[]; payments: RecordedPayment[];
}) {
  const { id, snapshot, status, confirmedWindow, paymentToken, emailStatus, requestEmailStatus, receiptEmailStatus, qualified } = order;
  const { address, customer } = snapshot;
  const window = snapshot.windows.find(({ id }) => id === confirmedWindow);
  const payLink = paymentToken ? paymentOrigin + '/pay/' + paymentToken : '';
  const preferenceRank = new Map(snapshot.windows.map(({ id }, index) => [id, index + 1]));
  const rank = (window: DeliveryWindow) => preferenceRank.get(window.id) ?? snapshot.windows.length + 1;
  const choices = order.quoteInquiryId
    ? [...available].sort((left, right) => rank(left) - rank(right))
    : snapshot.windows;
  const canComplete = !!window && !order.completedAt && !order.cancelledAt && (status === 'paid' || order.recordedPaymentCents === snapshot.totalCents);
  const canCancel = (status === 'confirmed' || (status === 'requested' && !!order.quoteInquiryId)) && !order.completedAt
    && !paymentToken && order.recordedPaymentCents === 0;
  return <div className="admin-order-detail">
    <p><small>{id}</small><br /><a href={`mailto:${customer.email}`}>{customer.email}</a> · {customer.phone}</p>
    <p>{address.street} {address.unit}<br />{address.city}, {address.state} {address.zip}</p>
    {address.notes && <p className="admin-notes">{address.notes}</p>}
    <p>Delivery {dollars.format(snapshot.deliveryCents / 100)}{snapshot.adjustmentCents ? ` · Rack adjustment ${dollars.format(snapshot.adjustmentCents / 100)}` : ''} · Total <strong>{dollars.format(snapshot.totalCents / 100)}</strong></p>
    {snapshot.quoteNote && <p className="admin-notes">{snapshot.quoteNote}</p>}
    <h3>Saved cut list</h3>
    <RackDetails racks={snapshot.racks} showCuts />
    <p className="layout-help">Top panel and rear bracing cuts are pending.</p>
    <LeadDetails attribution={snapshot.attribution} qualified={qualified} onQualify={() => void update('/orders/qualify',
      { id, qualified: !qualified }, qualified ? 'Lead marked unreviewed.' : 'Lead marked qualified.')} />
    <RequestEmail label="Builder alert" status={requestEmailStatus} retry={() => void update('/orders/retry-alert', { id }, 'Builder alert updated.')} />
    <RequestEmail label="Customer receipt" status={receiptEmailStatus} retry={() => void update('/orders/retry-receipt', { id }, 'Customer receipt updated.')} />
    {status !== 'declined' && <OrderPayments order={order} payments={payments} update={update} />}
    {status === 'requested' && <>
      {choices.length ? <form className="delivery-form" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void update('/orders/confirm', { id, window: form.get('window'), online: form.has('online') }, 'Delivery confirmed.');
      }}>
        <label className="delivery-field">{order.quoteInquiryId ? 'Available delivery windows' : 'Customer’s preferred delivery windows'}
          <select name="window" required defaultValue=""><option value="">Choose a window to confirm</option>
            {choices.map((choice) => <option key={choice.id} value={choice.id}>
              {preferenceRank.has(choice.id) ? `Preference ${preferenceRank.get(choice.id)} · ` : ''}{formatWindow(choice)}
            </option>)}
          </select>
        </label>
        {snapshot.payment && checkout !== 'off' && !snapshot.payment.depositCents && !order.recordedPaymentCents && snapshot.totalCents > 0 &&
          <label><input type="checkbox" name="online" /> Request full payment through {checkout === 'test' ? 'Stripe test Checkout' : 'Stripe'}</label>}
        <button className="delivery-action">Confirm and email customer</button>
      </form> : <p>Add an available window in Delivery to schedule this order.</p>}
      {!order.quoteInquiryId && <button className="delivery-action delivery-edit" onClick={() => {
        if (globalThis.confirm('Decline this rack order request?')) void update('/orders/decline', { id }, 'Order request declined.');
      }}>Decline request</button>}
    </>}
    {window && <p>Confirmed for {formatWindow(window)} · {notices[emailStatus]}</p>}
    {status === 'confirmed' && emailStatus !== 'sent' && <button className="delivery-action delivery-edit" onClick={() => void update('/orders/retry-email', { id }, 'Confirmation updated.')}>Retry confirmation email</button>}
    {status === 'confirmed' && payLink && checkout !== 'off' && <div className="admin-payment">
      <a href={payLink} target="_blank" rel="noreferrer">Open {checkout === 'test' ? 'test ' : ''}payment link</a>
      <button className="delivery-action delivery-edit" onClick={() => onCopy(payLink, 'Payment link copied.')}>Copy payment link</button>
    </div>}
    {canComplete && <button type="button" className="delivery-action delivery-edit" onClick={() => {
      if (globalThis.confirm('Mark this delivered and paid order complete?')) void update('/orders/complete', { id }, 'Order completed.');
    }}>Mark order complete</button>}
    {canCancel && <button type="button" className="delivery-action delivery-edit" onClick={() => {
      if (globalThis.confirm('Cancel this order and release its delivery window?')) void update('/orders/cancel', { id }, 'Order cancelled.');
    }}>Cancel order</button>}
  </div>;
}

function Analytics({ data }: { data: AnalyticsSummary }) {
  return <>
    <section className="admin-card">
      <h2>Storefront funnel</h2>
      <p className="layout-help">Last 90 days. Browser activity is counted once per session and saved requests and orders are counted once per record.</p>
      <dl className="admin-integrations">{Object.entries(funnelLabels).map(([event, label]) => <div key={event}>
        <dt>{label}</dt><dd>{data.events.find((entry) => entry.event === event)?.total ?? 0}</dd>
      </div>)}</dl>
    </section>
    <section className="admin-card">
      <h2>Lead sources</h2>
      <p className="layout-help">First recorded visit and the customer’s own answer are shown separately.</p>
      {data.sources.length ? <div className="admin-table-scroll"><table className="admin-cuts">
        <thead><tr><th scope="col">Observed source</th><th scope="col">Customer reported</th><th scope="col">Leads</th><th scope="col">Qualified</th></tr></thead>
        <tbody>{data.sources.map(({ observed, reported, leads, qualified }) => <tr key={JSON.stringify([observed, reported])}>
          <td>{observed}</td><td>{reported ? discoverySources[reported as keyof typeof discoverySources] ?? 'Other' : 'No answer'}</td><td>{leads}</td><td>{qualified}</td>
        </tr>)}</tbody>
      </table></div> : <p>No requests in the last 90 days.</p>}
    </section>
  </>;
}
