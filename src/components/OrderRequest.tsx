import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { track } from '../analytics';
import type { RackConfiguration } from '../config/rack';
import { formatWindowTime, MAX_DELIVERY_PREFERENCES, requestJson } from '../config/shop';
import type { DeliveryWindow, ShopSettings } from '../config/shop';
import { getVisit } from '../visit';
import { DiscoveryField } from './DiscoveryField';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
type Receipt = { id: string; rackSubtotalCents: number };

const preferenceLabels = ['First choice', 'Second choice', 'Third choice'];
const preferenceDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

function preferenceText(window: DeliveryWindow) {
  const date = preferenceDay.format(new Date(window.date + 'T00:00:00Z'));
  const time = formatWindowTime(window).replace(/:00\b/g, '');
  return `${date} · ${time}`;
}

export function OrderRequest({ racks, subtotal, revision, deliveryZip, settings, onDeliveryEstimate }: {
  racks: RackConfiguration[]; subtotal: number; revision: number; deliveryZip: string; settings: ShopSettings;
  onDeliveryEstimate?: (zip: string) => void;
}) {
  const section = useRef<HTMLElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const submission = useRef<{ key: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt>();
  const [windows, setWindows] = useState<DeliveryWindow[] | null>(null);
  const [windowsError, setWindowsError] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);

  async function refreshWindows() {
    setWindowsError(false);
    try {
      const { windows } = await requestJson<{ windows: DeliveryWindow[] }>('/api/delivery-windows');
      setWindows(windows);
      setChoices((current) => current.filter((id) => windows.some((window) => window.id === id)));
    } catch {
      setWindowsError(true);
    }
  }

  useEffect(() => {
    void refreshWindows();
    if (location.hash === '#quote') section.current?.scrollIntoView();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    track('configurator_started');
    track('configuration_completed');
    track('begin_checkout');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { ...fields, racks, revision, windows: choices, visit: getVisit() };
    const key = JSON.stringify(payload);
    if (submission.current?.key !== key) submission.current = { key, id: crypto.randomUUID() };
    setError('');
    setBusy(true);
    try {
      setReceipt(await requestJson<Receipt>('/api/quotes', { ...payload, id: submission.current.id }));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title = racks.length === 1 ? 'Request this rack' : 'Request these racks';
  return <section ref={section} className="store-section quote-section" id="quote" tabIndex={-1} aria-labelledby="order-request-heading">
    <div className="store-section-heading"><h2 id="order-request-heading">{receipt ? 'Order request' : title}</h2></div>
    {receipt ? <>
      <div role="status">
        <p><strong>Order request received</strong></p>
        <p>Your builder will review availability and follow up to confirm your delivery fee and date. Reference <strong>{receipt.id.slice(0, 8).toUpperCase()}</strong>.</p>
        {receipt.rackSubtotalCents > 0 && <p>Rack and accessories subtotal {dollars.format(receipt.rackSubtotalCents / 100)} before delivery.</p>}
      </div>
      <button type="button" className="delivery-action delivery-edit" onClick={() => {
        submission.current = null;
        setChoices([]);
        setReceipt(undefined);
        void refreshWindows();
      }}>Start another order request</button>
    </> : <>
      <p>Send your configuration to {settings.name}. Your builder will review availability and confirm your delivery fee and date.</p>
      <p className="quote-estimate"><strong>{racks.length} {racks.length === 1 ? 'rack' : 'racks'} · {dollars.format(subtotal)}</strong> before delivery</p>
      <dl className="order-trust">
        <div><dt>Service area</dt><dd>{settings.serviceArea}</dd></div>
        <div><dt>Build timing</dt><dd>{settings.buildLeadTime || 'Your builder confirms the lead time after reviewing your request.'}</dd></div>
        <div><dt>Questions?</dt><dd>{settings.publicEmail
          ? <a className="text-link" href={'mailto:' + settings.publicEmail}>{settings.publicEmail}</a>
          : <a className="text-link" href="#consult">Contact {settings.name}</a>}</dd></div>
      </dl>
      <form className="consult-form" onSubmit={submit}>
        <div className="consult-contact">
          <label className="delivery-field">Name<input name="name" autoComplete="name" required maxLength={100} /></label>
          <label className="delivery-field">Delivery ZIP code
            <input key={deliveryZip} ref={zipInput} name="zip" defaultValue={deliveryZip} autoComplete="shipping postal-code" inputMode="numeric" required
              pattern="[0-9]{5}(-[0-9]{4})?" title="Use a 5-digit ZIP code or ZIP+4" maxLength={10} />
          </label>
          <label className="delivery-field">Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
          <label className="delivery-field">Phone<input name="phone" type="tel" autoComplete="tel" required maxLength={40} /></label>
        </div>
        <div className="checkout-delivery-note">
          <p>Delivery is calculated using your street address and ZIP code.</p>
          {onDeliveryEstimate && <button type="button" className="nav-delivery text-link" onClick={() => onDeliveryEstimate(zipInput.current?.value.trim() ?? '')}>Check delivery fee with your address</button>}
        </div>
        <fieldset className="order-preferences">
          <legend>Preferred delivery times <small>(optional)</small></legend>
          {windows?.length ? <>
            <p>Choose up to {Math.min(MAX_DELIVERY_PREFERENCES, windows.length)} in order of preference. Times are local to the shop. Your builder confirms the final window.</p>
            <div className="order-preference-fields">
              {preferenceLabels.slice(0, windows.length).map((label, index) => <div key={label} className="delivery-field">
                <label htmlFor={`order-window-${index}`}>{label}</label>
                <select id={`order-window-${index}`} value={choices[index] ?? ''} disabled={index > choices.length} onChange={(event) => {
                  const id = event.target.value;
                  setChoices((current) => id ? [...current.slice(0, index), id, ...current.slice(index + 1)] : current.slice(0, index));
                }}>
                  <option value="">Choose a delivery time</option>
                  {windows.map((window) => <option key={window.id} value={window.id} disabled={choices.includes(window.id) && choices[index] !== window.id}>{preferenceText(window)}</option>)}
                </select>
              </div>)}
            </div>
          </> : <p>{windows === null && !windowsError ? 'Checking delivery availability…' : 'Your builder will arrange a delivery date with you after reviewing your request.'}</p>}
          {(windowsError || (error && choices.length > 0)) && <button type="button" className="nav-delivery text-link" onClick={refreshWindows}>Refresh delivery times</button>}
        </fieldset>
        <label className="delivery-field">Anything the builder should know? <small>(optional)</small>
          <textarea name="details" rows={3} maxLength={2000} />
        </label>
        <DiscoveryField />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" hidden />
        <button className="delivery-action" disabled={busy}>{busy ? 'Sending…' : 'Submit order request'}</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </>}
  </section>;
}
