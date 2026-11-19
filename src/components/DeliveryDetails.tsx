import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { RackConfiguration } from '../config/rack';
import { formatWindowTime, requestJson } from '../config/shop';
import type { DeliveryWindow } from '../config/shop';

interface DeliveryAddress {
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

type DeliveryQuote = { feeCents: number; token: string } | { error: string } | null;
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const quoteUnavailable = 'Delivery quotes are unavailable. The fee can be confirmed by address.';

export function DeliveryDetails({ rackTotal, racks, timezone, revision, schedulingAvailable }: {
  rackTotal: number; racks: RackConfiguration[]; timezone: string; revision: number; schedulingAvailable: boolean;
}) {
  const [address, setAddress] = useState<DeliveryAddress | null>(null);
  const [editing, setEditing] = useState(true);
  const [quote, setQuote] = useState<DeliveryQuote>(null);
  const quoteRequest = useRef<AbortController | null>(null);
  const streetInput = useRef<HTMLInputElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!address) return;
    if (editing) streetInput.current?.focus();
    else reviewHeading.current?.focus();
  }, [address, editing]);

  useEffect(() => () => quoteRequest.current?.abort(), []);

  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (name: keyof DeliveryAddress) => String(data.get(name) ?? '').trim();
    const destination = { street: read('street'), city: read('city'), state: read('state'), zip: read('zip') };
    setAddress({ ...destination, unit: read('unit'), notes: read('notes') });
    setEditing(false);
    setQuote(null);
    quoteRequest.current?.abort();
    const request = new AbortController();
    quoteRequest.current = request;

    try {
      const response = await fetch('/api/delivery-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...destination, revision }),
        signal: request.signal,
      });
      const data = await response.json();
      if (request.signal.aborted) return;
      if (response.ok && Number.isSafeInteger(data.feeCents) && data.feeCents >= 0 && typeof data.token === 'string') {
        setQuote({ feeCents: data.feeCents, token: data.token });
      } else {
        setQuote({ error: response.status === 409 || response.status === 422 ? data.error : quoteUnavailable });
      }
    } catch {
      if (!request.signal.aborted) setQuote({ error: quoteUnavailable });
    }
  }

  function edit() {
    quoteRequest.current?.abort();
    setEditing(true);
  }

  const fee = quote && 'feeCents' in quote ? quote.feeCents / 100 : null;

  return <section className="settings delivery-details" id="delivery-details" aria-labelledby="delivery-heading">
    <h2 id="delivery-heading">Delivery details</h2>
    {editing || !address ? <>
      <p className="layout-help">Enter your address to see the delivery fee and your total.</p>
      <form className="delivery-form" onSubmit={review}>
        <label className="delivery-field">
          Street address
          <input ref={streetInput} name="street" autoComplete="shipping address-line1" required
            pattern={'.*\\S.*'} maxLength={160} defaultValue={address?.street} />
        </label>
        <label className="delivery-field">
          Apt, suite, or unit <small>(optional)</small>
          <input name="unit" autoComplete="shipping address-line2" maxLength={60} defaultValue={address?.unit} />
        </label>
        <div className="delivery-city-row">
          <label className="delivery-field">
            City
            <input name="city" autoComplete="shipping address-level2" required
              pattern={'.*\\S.*'} maxLength={80} defaultValue={address?.city} />
          </label>
          <label className="delivery-field">
            State
            <input name="state" autoComplete="shipping address-level1" required
              pattern={'.*\\S.*'} maxLength={40} defaultValue={address?.state} />
          </label>
          <label className="delivery-field">
            ZIP code
            <input name="zip" autoComplete="shipping postal-code" inputMode="numeric" required
              pattern="[0-9]{5}(-[0-9]{4})?" title="Use a 5-digit ZIP code or ZIP+4"
              maxLength={10} defaultValue={address?.zip} />
          </label>
        </div>
        <label className="delivery-field">
          Delivery notes <small>(optional)</small>
          <textarea name="notes" rows={3} maxLength={1000} defaultValue={address?.notes}
            placeholder="Parking, access, or where to place the rack" />
        </label>
        <button type="submit" className="delivery-action">Calculate delivery</button>
      </form>
    </> : <div className="delivery-review">
      <h3 ref={reviewHeading} tabIndex={-1}>Review delivery address</h3>
      <p>{address.street}{address.unit && <><br />{address.unit}</>}<br />{address.city}, {address.state} {address.zip}</p>
      {address.notes && <div><h3>Delivery notes</h3><p className="delivery-notes">{address.notes}</p></div>}
      <dl className="price-lines delivery-review-pricing">
        <div><dt>Rack &amp; accessories total</dt><dd>{dollars.format(rackTotal)}</dd></div>
        <div><dt>Delivery fee</dt><dd aria-live="polite">
          {fee === null ? quote ? 'Unavailable' : 'Calculating…' : fee === 0 ? 'Free' : dollars.format(fee)}
        </dd></div>
        {fee !== null && <div className="price-total"><dt>Estimated total with delivery</dt>
          <dd aria-live="polite">{dollars.format(rackTotal + fee)}</dd></div>}
      </dl>
      {quote && 'error' in quote && <p className="layout-help" role="status">{quote.error}</p>}
      {schedulingAvailable && quote && 'token' in quote && <DeliveryRequest quoteToken={quote.token} address={address} racks={racks} timezone={timezone} />}
      <button type="button" className="delivery-action delivery-edit" onClick={edit}>Edit delivery details</button>
    </div>}
  </section>;
}

function DeliveryRequest({ quoteToken, address, racks, timezone }: {
  quoteToken: string; address: DeliveryAddress; racks: RackConfiguration[]; timezone: string;
}) {
  const [windows, setWindows] = useState<DeliveryWindow[] | null>(null);
  const [dates, setDates] = useState(['', '', '']);
  const [choices, setChoices] = useState(['', '', '']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState('');
  const [id] = useState(() => crypto.randomUUID());

  async function refresh() {
    setError('');
    try {
      const data = await requestJson<{ windows: DeliveryWindow[] }>('/api/delivery-windows');
      setWindows(data.windows);
      setChoices((values) => values.map((value) => data.windows.some((window) => window.id === value) ? value : ''));
    } catch (error) {
      setError((error as Error).message);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const contact = Object.fromEntries(new FormData(event.currentTarget));
      const result = await requestJson<{ id: string }>('/api/orders', {
        ...contact, id, quoteToken, address, racks, windows: choices,
      });
      setOrder(result.id);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (order) return <div className="delivery-request" role="status">
    <h3>Order request received</h3>
    <p>Your builder will confirm one of your delivery windows and follow up about payment.</p>
    <p>Order reference <strong>{order.slice(0, 8)}</strong></p>
  </div>;

  const days = [...new Set(windows?.map(({ date }) => date))];

  return <section className="delivery-request" aria-labelledby="delivery-preferences">
    <h3 id="delivery-preferences">Preferred delivery times</h3>
    {windows === null && !error && <p role="status">Loading delivery times…</p>}
    {windows && windows.length < 3 && <p>Online scheduling is currently unavailable. <a href="#consult"
      onClick={() => document.querySelector<HTMLDialogElement>('.delivery-dialog')?.close()}>Contact your builder</a> to arrange delivery.</p>}
    {windows && windows.length >= 3 && <form className="delivery-form" onSubmit={submit}>
      <p className="layout-help">Choose three different windows in order of preference. All times are local to the shop ({timezone}).</p>
      {choices.map((choice, index) => <div className="schedule-option" key={index}>
        <DeliveryCalendar choice={index + 1} days={days} value={dates[index]} onSelect={(date) => {
          setDates((values) => values.map((value, i) => i === index ? date : value));
          setChoices((values) => values.map((value, i) => i === index ? '' : value));
        }} />
        <label className="delivery-field">Choice {index + 1} time
          <select value={choice} required disabled={!dates[index]} onChange={(event) => {
            const id = event.currentTarget.value;
            setChoices((values) => values.map((value, i) => i === index ? id : value));
          }}>
            <option value="">Select time</option>
            {windows.filter((window) => window.date === dates[index]).map((window) =>
              <option key={window.id} value={window.id} disabled={choices.some((value, i) => i !== index && value === window.id)}>
                {formatWindowTime(window)}
              </option>)}
          </select>
        </label>
      </div>)}
      <label className="delivery-field">Name<input name="name" autoComplete="name" required maxLength={100} /></label>
      <div className="schedule-option">
        <label className="delivery-field">Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label className="delivery-field">Phone<input name="phone" type="tel" autoComplete="tel" required maxLength={40} /></label>
      </div>
      <button className="delivery-action" disabled={busy}>{busy ? 'Sending…' : 'Request order'}</button>
    </form>}
    {error && <p role="alert">{error}</p>}
    {error && <button type="button" className="delivery-action delivery-edit" onClick={refresh}>Refresh delivery times</button>}
  </section>;
}


const calendarDate = (date: string) => new Date(date + 'T00:00:00Z');
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function DeliveryCalendar({ choice, days, value, onSelect }: {
  choice: number; days: string[]; value: string; onSelect: (date: string) => void;
}) {
  const [view, setView] = useState('');
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const months = [...new Set(days.map((day) => day.slice(0, 7)))];
  const selectedMonth = value.slice(0, 7);
  const month = months.includes(view) ? view : months.includes(selectedMonth) ? selectedMonth : months[0];
  const index = months.indexOf(month);
  const first = calendarDate(month + '-01');
  const total = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();

  return <div className="delivery-field">
    <span id={`delivery-date-${choice}`}>Choice {choice} date</span>
    <details className="schedule-calendar" ref={details}>
      <summary ref={summary} aria-describedby={`delivery-date-${choice}`}>{value ? dateFormat.format(calendarDate(value)) : 'Choose date'}</summary>
      <div className="calendar-month">
        <button type="button" aria-label="Previous available month" disabled={index <= 0} onClick={() => setView(months[index - 1])}>‹</button>
        <strong aria-live="polite">{monthFormat.format(first)}</strong>
        <button type="button" aria-label="Next available month" disabled={index >= months.length - 1} onClick={() => setView(months[index + 1])}>›</button>
      </div>
      <div className="calendar-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((weekDay, index) => <span key={index} aria-hidden="true">{weekDay}</span>)}
        {Array.from({ length: first.getUTCDay() }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: total }, (_, i) => {
          const day = i + 1;
          const date = month + '-' + String(day).padStart(2, '0');
          return <button key={date} type="button" aria-label={dateFormat.format(calendarDate(date))}
            aria-pressed={date === value} disabled={!days.includes(date)} onClick={() => {
              onSelect(date);
              if (details.current) details.current.open = false;
              summary.current?.focus();
            }}>{day}</button>;
        })}
      </div>
    </details>
  </div>;
}
