import { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Configurator } from './components/Configurator';
import { CustomerOffer } from './components/CustomerOffer';
import { defaultShop, requestJson, totesAndTimberPageTitle } from './config/shop';
import type { Storefront } from './config/shop';
import { captureVisit } from './visit';
import { enableRackCarousels } from './rack-carousel';
import './style.css';

enableRackCarousels();

const BuilderAdmin = lazy(() => import('./components/BuilderAdmin').then(({ BuilderAdmin }) => ({ default: BuilderAdmin })));
const offline: Storefront = { settings: defaultShop, revision: 1, deliveryAvailable: false, consultAvailable: false, reviews: [] };

function PaymentPage({ token }: { token: string }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState('');

  async function openCheckout() {
    setBusy(true);
    setStatus('');
    try {
      const result = await requestJson<{ paid?: boolean; url?: string; test?: boolean }>('/api/checkout', { token });
      if (result.paid) setStatus('This order has already been paid.');
      else if (result.url && result.test) {
        setStatus('Stripe is in test mode. Use a test card only.');
        setCheckoutUrl(result.url);
      } else if (result.url) location.assign(result.url);
      else setStatus('Stripe is still checking this payment. Try again in a moment.');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="payment-page store-section">
    <h1>Pay for your rack order</h1>
    <p>Review your confirmed total and pay through Stripe.</p>
    {!checkoutUrl && <button className="delivery-action" disabled={busy} onClick={openCheckout}>{busy ? 'Opening…' : 'Continue to Stripe'}</button>}
    {status && <p role="status">{status}</p>}
    {checkoutUrl && <a className="delivery-action" href={checkoutUrl} rel="noreferrer">Open Stripe test checkout</a>}
  </main>;
}

function PrivatePage({ path }: { path: string }) {
  if (path === '/admin') return <Suspense fallback={<p className="workspace" role="status">Loading Builder admin…</p>}><BuilderAdmin /></Suspense>;
  if (path.startsWith('/pay/')) return <PaymentPage token={path.slice(5)} />;
  if (path.startsWith('/quote/')) return <CustomerOffer token={path.slice(7)} />;
  if (path === '/order-received') return <main className="payment-page store-section">
    <h1>Payment status</h1><p>Payments made through Stripe appear on your order once processing is complete.</p><a href="/">Back to the shop</a>
  </main>;
  return null;
}

const root = document.getElementById('root')!;
const path = location.pathname.replace(/\/$/, '');
if (import.meta.env.MODE === 'storefront') {
  createRoot(root).render(<Configurator shop={offline} />);
} else if (/^\/(?:admin$|pay\/|quote\/|order-received$)/.test(path)) {
  createRoot(root).render(<PrivatePage path={path} />);
} else {
  captureVisit();
  void requestJson<Storefront>('/api/shop').then((shop) => {
    document.documentElement.style.setProperty('--accent', shop.settings.accent);
    document.title = shop.settings.name === defaultShop.name ? totesAndTimberPageTitle : `${shop.settings.title} | ${shop.settings.name}`;
    createRoot(root).render(<Configurator shop={shop} />);
  }).catch(() => {
    const message = document.createElement('p');
    message.className = 'workspace';
    message.textContent = 'The rack designer didn’t load. Refresh the page and try again.';
    message.setAttribute('role', 'status');
    root.append(message);
  });
}
