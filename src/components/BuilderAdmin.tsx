import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { finishes, formatCutLength, getRackToteType } from '../config/rack';
import { toteProfiles } from '../config/totes';
import { formatWindow, requestJson } from '../config/shop';
import type { AdminSettings, DeliveryWindow, SavedInquiry, SavedOrder } from '../config/shop';

type AdminPanel = {
  settings: AdminSettings;
  revision: number;
  windows: (DeliveryWindow & { enabled: number; orderId: string | null })[];
  orders: SavedOrder[];
  inquiries: SavedInquiry[];
  today: string;
  checkout: 'off' | 'test' | 'live';
  paymentOrigin: string;
  deliveryReady: boolean;
  emailReady: boolean;
};
type Tab = 'Orders' | 'Delivery' | 'Storefront';
type Update = (route: string, body: object, success: string, method?: string) => Promise<boolean>;
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const labels = { requested: 'Awaiting confirmation', confirmed: 'Delivery confirmed', paid: 'Paid', declined: 'Declined' };
const notices: Record<string, string> = { sent: 'Email sent', unconfigured: 'Email setup required', failed: 'Email failed', pending: 'Email pending' };

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
      sessionStorage.setItem('builder-admin-token', String(new FormData(event.currentTarget).get('token') ?? ''));
      void refresh();
    }}>
      <label className="delivery-field">Local development token<input name="token" type="password" autoComplete="off" required /></label>
      <button className="delivery-action">Open dashboard</button>
    </form>}
    {data && <>
      <nav className="admin-nav" aria-label="Builder admin sections">
        {(['Orders', 'Delivery', 'Storefront'] as const).map((item) => <button key={item} type="button"
          aria-current={tab === item ? 'page' : undefined} onClick={() => { setTab(item); setStatus(undefined); }}>{item}</button>)}
      </nav>
      <fieldset className="admin-content" disabled={busy || loading} aria-busy={busy || loading}>
        {tab === 'Storefront' && <Settings key={data.revision} data={data} update={update} />}
        {tab === 'Delivery' && <Windows data={data} update={update} />}
        {tab === 'Orders' && <Orders data={data} update={update} onCopy={(text) => {
          navigator.clipboard.writeText(text).then(() => setStatus({ text: 'Payment link copied.' }))
            .catch(() => setStatus({ text: 'Copy the address from the payment link.', error: true }));
        }} />}
      </fieldset>
    </>}
  </main>;
}

function Settings({ data, update }: { data: AdminPanel; update: Update }) {
  const { settings, revision } = data;
  const { rates, build, delivery } = settings;
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
      contactEmail: get('contactEmail'), deliveryOrigin: get('deliveryOrigin'),
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
    <p>Customers can submit an order after choosing three available windows.</p>
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

function Orders({ data, update, onCopy }: { data: AdminPanel; update: Update; onCopy: (text: string) => void }) {
  return <>
    <dl className="admin-integrations">
      <div><dt>Delivery quotes</dt><dd>{data.deliveryReady ? 'Ready' : 'Setup required'}</dd></div>
      <div><dt>Email</dt><dd>{data.emailReady ? 'Ready' : 'Setup required'}</dd></div>
      <div><dt>Stripe Checkout</dt><dd>{{ off: 'Off', test: 'Test mode', live: 'Live' }[data.checkout]}</dd></div>
    </dl>
    <section className="admin-card">
      <h2>Rack orders</h2>
      {!data.orders.length && <p>No orders yet.</p>}
      {data.orders.map((order) => <details key={order.id} className="admin-record">
        <summary><strong>{order.snapshot.customer.name}</strong><span>{labels[order.status]} · {dollars.format(order.snapshot.totalCents / 100)}</span></summary>
        <OrderDetails order={order} checkout={data.checkout} paymentOrigin={data.paymentOrigin} update={update} onCopy={onCopy} />
      </details>)}
    </section>
    <section className="admin-card">
      <h2>Custom inquiries</h2>
      {!data.inquiries.length && <p>No inquiries yet.</p>}
      {data.inquiries.map(({ id, snapshot, emailStatus }) => <details key={id} className="admin-record">
        <summary><strong>{snapshot.email}</strong><span>{notices[emailStatus]}</span></summary>
        <p><a href={`mailto:${snapshot.email}`}>{snapshot.email}</a> · {snapshot.phone}</p>
        <p className="admin-notes">{snapshot.details}</p><p className="admin-notes">{snapshot.configuration}</p>
        {emailStatus !== 'sent' && <button className="delivery-action delivery-edit" onClick={() => void update('/inquiries/retry-email', { id }, 'Inquiry updated.')}>Retry email</button>}
      </details>)}
    </section>
  </>;
}

function OrderDetails({ order, update, checkout, paymentOrigin, onCopy }: {
  order: SavedOrder; update: Update; checkout: AdminPanel['checkout']; paymentOrigin: string; onCopy: (text: string) => void;
}) {
  const { id, snapshot, status, confirmedWindow, paymentToken, emailStatus } = order;
  const { address, customer } = snapshot;
  const window = snapshot.windows.find(({ id }) => id === confirmedWindow);
  const payLink = paymentToken ? paymentOrigin + '/pay/' + paymentToken : '';
  return <div className="admin-order-detail">
    <p><small>{id}</small><br /><a href={`mailto:${customer.email}`}>{customer.email}</a> · {customer.phone}</p>
    <p>{address.street} {address.unit}<br />{address.city}, {address.state} {address.zip}</p>
    {address.notes && <p className="admin-notes">{address.notes}</p>}
    <p>Delivery {dollars.format(snapshot.deliveryCents / 100)} · Total <strong>{dollars.format(snapshot.totalCents / 100)}</strong></p>
    <h3>Saved cut list</h3>
    {snapshot.racks.map(({ configuration, cuts, price }, index) => <div key={index}>
      <h4>Rack {index + 1} · {configuration.columns} wide × {configuration.rows} high</h4>
      <p>{Math.ceil(cuts.width)} in W × {Math.ceil(cuts.height)} in H × {Math.ceil(cuts.depth)} in D · {toteProfiles[getRackToteType(configuration)].label} · {finishes.find(({ id }) => id === configuration.topMaterial)?.label}
        · {price.wheelQuantity} casters · {price.toteQuantity} totes included</p>
      <table className="admin-cuts">
        <thead><tr><th scope="col">Part</th><th scope="col">Quantity</th><th scope="col">Cut length</th></tr></thead>
        <tbody>{cuts.pieces.map((piece) => <tr key={piece.name}><th scope="row">{piece.name}</th><td>{piece.quantity}</td><td>{formatCutLength(piece.length)} in</td></tr>)}</tbody>
      </table>
    </div>)}
    <p className="layout-help">Top panel and rear bracing cuts are pending.</p>
    {status === 'requested' && <>
      <form className="delivery-form" onSubmit={(event) => {
        event.preventDefault();
        const window = new FormData(event.currentTarget).get('window');
        void update('/orders/confirm', { id, window }, 'Delivery confirmed.');
      }}>
        <label className="delivery-field">Customer’s preferred delivery windows
          <select name="window" required defaultValue=""><option value="">Choose a window to confirm</option>
            {snapshot.windows.map((choice, index) => <option key={choice.id} value={choice.id}>{index + 1}. {formatWindow(choice)}</option>)}
          </select>
        </label>
        <button className="delivery-action">Confirm and email customer</button>
      </form>
      <button className="delivery-action delivery-edit" onClick={() => {
        if (globalThis.confirm('Decline this rack order request?')) void update('/orders/decline', { id }, 'Order request declined.');
      }}>Decline request</button>
    </>}
    {window && <p>Confirmed for {formatWindow(window)} · {notices[emailStatus]}</p>}
    {status === 'confirmed' && emailStatus !== 'sent' && <button className="delivery-action delivery-edit" onClick={() => void update('/orders/retry-email', { id }, 'Confirmation updated.')}>Retry confirmation email</button>}
    {status === 'confirmed' && payLink && checkout !== 'off' && <div className="admin-payment">
      <a href={payLink} target="_blank" rel="noreferrer">Open {checkout === 'test' ? 'test ' : ''}payment link</a>
      <button className="delivery-action delivery-edit" onClick={() => onCopy(payLink)}>Copy payment link</button>
    </div>}
  </div>;
}
