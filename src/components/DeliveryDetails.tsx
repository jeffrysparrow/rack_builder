import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

interface DeliveryAddress {
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

type DeliveryQuote = { feeCents: number } | { error: string } | null;
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const quoteUnavailable = 'Delivery quotes are unavailable. The fee can be confirmed by address.';

export function DeliveryDetails({ rackTotal }: { rackTotal: number }) {
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
        body: JSON.stringify(destination),
        signal: request.signal,
      });
      const data = await response.json();
      if (request.signal.aborted) return;
      if (response.ok && Number.isSafeInteger(data.feeCents) && data.feeCents >= 0) {
        setQuote({ feeCents: data.feeCents });
      } else {
        setQuote({ error: response.status === 422
          ? 'No driving route was found. Check the address to try again.'
          : quoteUnavailable });
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
      <p className="layout-help">Enter the address where you’d like the rack delivered.</p>
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
        <button type="submit" className="delivery-action">Review delivery details</button>
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
      <button type="button" className="delivery-action delivery-edit" onClick={edit}>Edit delivery details</button>
    </div>}
  </section>;
}
