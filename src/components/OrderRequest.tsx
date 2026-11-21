import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { outsideDimensions, RackConfiguration } from '../config/rack';
import { depositForOrder } from '../config/payments';
import { estimatePrice } from '../config/pricing';
import { defaultShop, deliveryEstimateExpired, deliveryPreferenceWindows, deliveryTimeUnavailable, describeDeliveryPreference, describeRack, requestJson } from '../config/shop';
import type { DeliveryWindow, OrderSnapshot, ShopSettings } from '../config/shop';
import { getVisit } from '../visit';
import { DeliveryPreferences } from './DeliveryDetails';
import { DiscoveryField } from './DiscoveryField';
import { OrderRequestConfirmation } from './OrderRequestConfirmation';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const rateDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
const blankAddress = { street: '', unit: '', city: '', state: 'TX', zip: '', notes: '' };
type Address = OrderSnapshot['address'];
type Quote = { feeCents: number; token: string };
type Receipt = { id: string; rackSubtotalCents: number; deliveryEstimateCents?: number; receiptEmailStatus?: string | null };

export function PurchaseSteps({ current, onConfigure, onDelivery, busy }: {
  current: 'configure' | 'delivery' | 'review'; onConfigure?: () => void; onDelivery?: () => void; busy?: boolean;
}) {
  return <nav aria-label="Order steps"><ol className="purchase-steps">
    <li aria-current={current === 'configure' ? 'step' : undefined}>{onConfigure && current !== 'configure'
      ? <button type="button" onClick={onConfigure} disabled={busy}>Design your rack</button> : 'Design your rack'}</li>
    <li aria-current={current === 'delivery' ? 'step' : undefined}>{onDelivery && current === 'review'
      ? <button type="button" onClick={onDelivery} disabled={busy}>Delivery &amp; timing</button> : 'Delivery & timing'}</li>
    <li aria-current={current === 'review' ? 'step' : undefined}>Review &amp; submit</li>
  </ol></nav>;
}

export function OrderRequest({ racks, dimensions, subtotal, revision, settings, canEstimate, canSubmit, active, onConfigure }: {
  racks: RackConfiguration[]; dimensions: ReturnType<typeof outsideDimensions>[]; subtotal: number; revision: number; settings: ShopSettings;
  canEstimate: boolean; canSubmit: boolean; active: boolean; onConfigure: () => void;
}) {
  const section = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const estimateStatus = useRef<HTMLDivElement>(null);
  const submissionError = useRef<HTMLDivElement>(null);
  const submission = useRef<{ key: string; id: string } | null>(null);
  const [step, setStep] = useState<'delivery' | 'review'>('delivery');
  const [address, setAddress] = useState<Address>(blankAddress);
  const [contact, setContact] = useState({ name: '', email: '', phone: '', discovery: '', website: '' });
  const [quote, setQuote] = useState<Quote>();
  const [estimateError, setEstimateError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt>();
  const [windows, setWindows] = useState<DeliveryWindow[]>();
  const [loadingWindows, setLoadingWindows] = useState(false);
  const [windowsError, setWindowsError] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);

  async function refreshWindows() {
    setLoadingWindows(true);
    setWindowsError(false);
    try {
      const { windows } = await requestJson<{ windows: DeliveryWindow[] }>('/api/delivery-windows');
      setWindows(windows);
      setChoices((current) => current.filter((id) => deliveryPreferenceWindows(id, windows).length > 0));
    } catch {
      setWindowsError(true);
    } finally {
      setLoadingWindows(false);
    }
  }

  useEffect(() => {
    if (active && canSubmit) void refreshWindows();
  }, [active, canSubmit]);

  useEffect(() => {
    if (active && !receipt) {
      heading.current?.focus({ preventScroll: true });
      section.current?.scrollIntoView({ block: 'start' });
    }
  }, [active, step, receipt]);

  useEffect(() => {
    if (error) submissionError.current?.focus();
  }, [error]);

  function changeAddress(field: keyof Address, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
    if (field !== 'unit' && field !== 'notes') {
      setQuote(undefined);
      setEstimateError('');
    }
  }

  async function finishDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === 'review' || !canEstimate || quote) {
      if (canSubmit) setStep('review');
      return;
    }
    setBusy(true);
    setEstimateError('');
    try {
      const estimate = await requestJson<Quote>('/api/delivery-quote', { ...address, revision });
      if (!Number.isSafeInteger(estimate.feeCents) || estimate.feeCents < 0 || typeof estimate.token !== 'string') {
        throw new Error('We couldn’t calculate delivery. Check the address and try again.');
      }
      setQuote(estimate);
      requestAnimationFrame(() => estimateStatus.current?.focus());
    } catch (failure) {
      setEstimateError(failure instanceof TypeError ? 'We couldn’t calculate delivery. Check the address and try again.' : (failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { ...fields, racks, revision, address, quoteToken: quote?.token, windows: choices, visit: getVisit() };
    const key = JSON.stringify(payload);
    if (submission.current?.key !== key) submission.current = { key, id: crypto.randomUUID() };
    setError('');
    setBusy(true);
    try {
      setReceipt(await requestJson<Receipt>('/api/quotes', { ...payload, id: submission.current.id }));
    } catch (failure) {
      const message = (failure as Error).message;
      setError(failure instanceof TypeError ? 'Something went wrong sending your request. Please try again.' : message);
    } finally {
      setBusy(false);
    }
  }

  function configure() {
    setError('');
    if (!receipt) setStep('delivery');
    onConfigure();
  }

  function editDelivery() {
    setError('');
    setStep('delivery');
  }

  const multiple = racks.length > 1;
  const fee = quote?.feeCents;
  const totalCents = fee === undefined ? undefined : subtotal * 100 + fee;
  const depositCents = totalCents === undefined ? 0 : depositForOrder(
    settings.deposit, totalCents, racks.some((rack) => rack.includeTotesWithDelivery),
  );
  return <section ref={section} className="store-section quote-section" id="quote" hidden={!active} aria-labelledby="order-request-heading">
    {receipt ? <OrderRequestConfirmation reference={receipt.id} rackSubtotalCents={receipt.rackSubtotalCents}
      deliveryEstimateCents={receipt.deliveryEstimateCents} emailStatus={receipt.receiptEmailStatus}
      rackCount={racks.length} shopName={settings.name} headingId="order-request-heading" onStartAnother={() => {
        submission.current = null;
        setChoices([]);
        setContact({ name: '', email: '', phone: '', discovery: '', website: '' });
        setAddress(blankAddress);
        setQuote(undefined);
        setEstimateError('');
        setStep('delivery');
        setReceipt(undefined);
        onConfigure();
      }} /> : <>
      {canSubmit && <PurchaseSteps current={step} onConfigure={configure} onDelivery={editDelivery} busy={busy} />}
      <div className="store-section-heading">
        <h2 id="order-request-heading" tabIndex={-1} ref={heading}>{step === 'delivery' ? canSubmit ? 'Delivery & timing' : 'Estimate delivery' : 'Look good?'}</h2>
      </div>
      {step === 'review' && <p>Double-check your rack size, tote brand, and delivery details before sending your request.</p>}
      <div className="checkout-grid">
        <aside className="checkout-summary" aria-label="Order summary">
          <div className="section-heading"><h3>{step === 'delivery' ? 'Your order' : multiple ? 'Your racks' : 'Your rack'}</h3>
            <button type="button" className="text-button" onClick={configure} disabled={busy}>Edit {multiple ? 'racks' : 'rack'}</button>
          </div>
          {step === 'review' && <ul>
            {racks.map((rack, index) => {
              const price = estimatePrice(rack, settings.rates, settings.build);
              return <li key={index}>{multiple && <strong>Rack {index + 1}</strong>}
                {describeRack({ configuration: rack, price })}
                <span className="review-dimensions">Outside dimensions {dimensions[index].across} in across × {dimensions[index].high} in high × {dimensions[index].depth} in deep</span>
              </li>;
            })}
          </ul>}
          <dl className="price-lines">
            <div><dt>Rack subtotal</dt><dd>{dollars.format(subtotal)}</dd></div>
            <div><dt>Delivery</dt><dd aria-live="polite">{fee === undefined
              ? busy && step === 'delivery' ? 'Calculating…' : canEstimate && !estimateError ? 'Not calculated yet' : 'To be confirmed'
              : dollars.format(fee / 100)}</dd></div>
            <div className="price-total"><dt>Total with delivery</dt><dd>{totalCents === undefined ? 'Waiting on address' : dollars.format(totalCents / 100)}</dd></div>
            {depositCents > 0 && totalCents !== undefined && <>
              <div><dt>Estimated deposit after confirmation</dt><dd>{dollars.format(depositCents / 100)}</dd></div>
              <div><dt>Estimated balance at delivery</dt><dd>{dollars.format((totalCents - depositCents) / 100)}</dd></div>
            </>}
          </dl>
          {fee !== undefined && <p className="layout-help">Delivery and total are estimates.</p>}
        </aside>
        <div className="checkout-fields">
          {step === 'delivery' ? <>
            <p>{settings.serviceArea === defaultShop.serviceArea ? 'Leander-area delivery available.' : `We deliver to ${settings.serviceArea}.`}{settings.buildLeadTime && <> {settings.buildLeadTime}</>}</p>
            {canEstimate && <p>{settings.delivery.freeMiles > 0 && `First ${settings.delivery.freeMiles} driving miles are free, then `}
              {rateDollars.format(settings.delivery.extraMileRate)} per {settings.delivery.freeMiles > 0 ? 'additional ' : 'driving '}mile.</p>}
            <form key="delivery" className="delivery-form" onSubmit={finishDelivery}>
              <fieldset className="address-fields" disabled={busy}>
                <legend>Where should we bring it?</legend>
                <label className="delivery-field">Street address
                  <input name="street" autoComplete="shipping address-line1" required pattern={'.*\\S.*'} maxLength={160}
                    value={address.street} onChange={(event) => changeAddress('street', event.target.value)} />
                </label>
                <label className="delivery-field">Apt or unit <small>(optional)</small>
                  <input name="unit" autoComplete="shipping address-line2" maxLength={60} value={address.unit}
                    onChange={(event) => changeAddress('unit', event.target.value)} />
                </label>
                <div className="delivery-city-row">
                  <label className="delivery-field">City
                    <input name="city" autoComplete="shipping address-level2" required pattern={'.*\\S.*'} maxLength={80}
                      value={address.city} onChange={(event) => changeAddress('city', event.target.value)} />
                  </label>
                  <label className="delivery-field">State
                    <input name="state" autoComplete="shipping address-level1" required pattern={'.*\\S.*'} maxLength={40}
                      value={address.state} onChange={(event) => changeAddress('state', event.target.value)} />
                  </label>
                  <label className="delivery-field">ZIP code
                    <input name="zip" autoComplete="shipping postal-code" inputMode="numeric" required title="Enter a valid ZIP code." pattern="[0-9]{5}(-[0-9]{4})?"
                      maxLength={10} value={address.zip} onChange={(event) => changeAddress('zip', event.target.value)} />
                  </label>
                </div>
                {canSubmit && <label className="delivery-field">Delivery notes <small>(optional)</small>
                  <textarea rows={2} maxLength={1000} placeholder="Parking, access, or where to place the rack"
                    value={address.notes} onChange={(event) => changeAddress('notes', event.target.value)} />
                </label>}
              </fieldset>
              <div className="delivery-estimate">
                {canEstimate && fee === undefined && <button type="submit" value="estimate" className="delivery-action" disabled={busy}>
                  {busy ? 'Calculating delivery…' : estimateError ? 'Try again' : 'Calculate delivery'}
                </button>}
                <div role="status" ref={estimateStatus} tabIndex={-1}>
                  {fee !== undefined && totalCents !== undefined && <dl className="price-lines delivery-estimate-result">
                    <div><dt>Delivery</dt><dd>{dollars.format(fee / 100)}</dd></div>
                    <div className="price-total"><dt>Total with delivery</dt><dd>{dollars.format(totalCents / 100)}</dd></div>
                  </dl>}
                  {estimateError && <p>{estimateError} {canSubmit && <><a className="text-link" href="#consult">Get in touch</a> or send your request and we’ll check the fee.</>}</p>}
                  {!canEstimate && <p>We’ll confirm the delivery fee after we check your address.</p>}
                </div>
              </div>
              {canSubmit && <DeliveryPreferences timezone={settings.timezone} windows={windows ?? []} loading={loadingWindows || (!windows && !windowsError)}
                failed={windowsError} choices={choices} onChange={setChoices} onRefresh={() => void refreshWindows()} />}
              <div className="checkout-actions">
                {canSubmit && (!canEstimate || quote || estimateError) && <button type="submit" value="review"
                  className="delivery-action" disabled={busy}>Review order request</button>}
                {!canSubmit && <button type="button" className="text-button" onClick={configure} disabled={busy}>Back to your rack</button>}
              </div>
            </form>
          </> : <>
            <div className="checkout-destination">
              <div>
                <h3>Delivery</h3>
                <p>{address.street}{address.unit && `, ${address.unit}`}<br />{address.city}, {address.state} {address.zip}</p>
                {address.notes && <p className="delivery-notes">{address.notes}</p>}
                <h3>{choices.length > 1 ? 'Preferred delivery times' : 'Preferred delivery time'}</h3>
                {choices.length ? <ol>{choices.map((choice) =>
                  <li key={choice}>{describeDeliveryPreference(choice, windows ?? [])}</li>)}</ol>
                  : <p>We’ll work out a time with you.</p>}
              </div>
              <button type="button" className="text-button" onClick={editDelivery} disabled={busy}>Edit delivery</button>
            </div>
            <form key="review" className="consult-form" onSubmit={submit} onChange={(event) => {
              const fields = new FormData(event.currentTarget);
              setContact({
                name: String(fields.get('name') ?? ''), email: String(fields.get('email') ?? ''),
                phone: String(fields.get('phone') ?? ''), discovery: String(fields.get('discovery') ?? ''),
                website: String(fields.get('website') ?? ''),
              });
            }}>
              <fieldset className="address-fields" disabled={busy}>
                <legend>Your contact details</legend>
                <label className="delivery-field">Name<input name="name" autoComplete="name" required maxLength={100} defaultValue={contact.name} /></label>
                <div className="consult-contact">
                  <label className="delivery-field">Email<input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={contact.email} /></label>
                  <label className="delivery-field">Phone<input name="phone" type="tel" autoComplete="tel" required maxLength={40} defaultValue={contact.phone} /></label>
                </div>
                <DiscoveryField defaultValue={contact.discovery} />
                <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue={contact.website} hidden />
              </fieldset>
              <p className="request-payment-note"><strong>No payment is collected when you send this request.</strong> We’ll confirm the final details and any required deposit before starting your build.</p>
              {error && <div ref={submissionError} tabIndex={-1} role="alert" className="checkout-error">
                <p>{error}</p>
                {error === deliveryEstimateExpired && <button type="button" className="text-button" onClick={() => {
                  setQuote(undefined);
                  setEstimateError('');
                  editDelivery();
                }}>Recalculate delivery</button>}
                {error === deliveryTimeUnavailable && <button type="button" className="text-button" onClick={() => {
                  void refreshWindows();
                  editDelivery();
                }}>Choose another time</button>}
              </div>}
              <button className="delivery-action" disabled={busy}>{busy ? 'Sending request…' : multiple ? 'Request my racks' : 'Request my rack'}</button>
            </form>
          </>}
        </div>
      </div>
    </>}
  </section>;
}
