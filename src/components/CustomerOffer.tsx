import { useEffect, useState } from 'react';
import { describeRack, requestJson } from '../config/shop';
import type { PublicOffer } from '../config/shop';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dollars = (cents: number) => currency.format(cents / 100);

export function CustomerOffer({ token }: { token: string }) {
  const [offer, setOffer] = useState<PublicOffer>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const path = '/api/offers/' + encodeURIComponent(token);
  useEffect(() => {
    requestJson<PublicOffer>(path).then(setOffer).catch((error: Error) => setError(error.message));
  }, [path]);

  async function accept() {
    if (!offer || busy) return;
    setBusy(true);
    setError('');
    try {
      const { id } = await requestJson<{ id: string }>(path, { accepted: true });
      setOffer({ ...offer, status: 'accepted', orderId: id });
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="payment-page store-section customer-offer">
    <a className="text-link" href="/">Back to the shop</a>
    <h1>Your rack quote</h1>
    {!offer && !error && <p role="status">Loading your quote…</p>}
    {offer && <>
      <p>{offer.shopName} · Quote version {offer.version}</p>
      {offer.status === 'superseded' || offer.status === 'expired' || offer.status === 'cancelled' ? <p role="status">
        {offer.status === 'cancelled' ? 'This order was cancelled. Get in touch with us if you have questions.'
          : offer.status === 'superseded' ? 'We updated this quote. Get in touch for the latest link.' : 'This quote has expired. Get in touch for a new link.'}
        <br /><a className="text-link" href="/#consult">Contact us</a>
      </p> : <>
        <ul className="customer-offer-racks">{offer.racks.map((rack, index) => <li key={index}>
          <strong>Rack {index + 1} · {currency.format(rack.price.total)}</strong><p>{describeRack(rack)}</p>
        </li>)}</ul>
        {offer.quoteNote && <p className="admin-notes">{offer.quoteNote}</p>}
        <dl className="price-lines">
          {!!offer.adjustmentCents && <div><dt>Rack price adjustment</dt><dd>{dollars(offer.adjustmentCents)}</dd></div>}
          <div><dt>Delivery</dt><dd>{dollars(offer.deliveryCents)}</dd></div>
          <div className="price-total"><dt>Order total</dt><dd>{dollars(offer.totalCents)}</dd></div>
          {offer.depositCents > 0 && <div><dt>Deposit after acceptance</dt><dd>{dollars(offer.depositCents)}</dd></div>}
          <div><dt>Balance at delivery</dt><dd>{dollars(offer.totalCents - offer.depositCents)}</dd></div>
        </dl>
        {offer.status === 'accepted' ? <p role="status"><strong>Quote accepted.</strong> We’ll be in touch to schedule delivery. Order reference <strong>{offer.orderId?.slice(0, 8).toUpperCase()}</strong>.</p> : <>
          <p>{offer.depositCents > 0 ? 'We’ll be in touch with deposit instructions and a delivery time.' : 'We’ll be in touch to schedule delivery. Payment is due at delivery.'}</p>
          <button type="button" className="delivery-action" disabled={busy} onClick={accept}>{busy ? 'Accepting…' : 'Accept quote'}</button>
        </>}
      </>}
    </>}
    {error && <p role="alert">{error} <a className="text-link" href="/#consult">Contact us</a></p>}
  </main>;
}
