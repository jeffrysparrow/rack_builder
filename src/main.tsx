import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Configurator } from './components/Configurator';
import { defaultShop, requestJson } from './config/shop';
import type { Storefront } from './config/shop';
import './style.css';

const BuilderAdmin = lazy(() => import('./components/BuilderAdmin').then(({ BuilderAdmin }) => ({ default: BuilderAdmin })));
const offline = { settings: defaultShop, revision: 1, deliveryAvailable: false, consultAvailable: false };

function Store() {
  const [shop, setShop] = useState<Storefront | null>(import.meta.env.MODE === 'storefront' ? offline : null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (import.meta.env.MODE === 'storefront') return;
    requestJson<Storefront>('/api/shop').then(setShop).catch(() => setError(true));
  }, []);
  useEffect(() => {
    if (!shop) return;
    document.documentElement.style.setProperty('--accent', shop.settings.accent);
    document.title = `${shop.settings.name} | ${shop.settings.title}`;
  }, [shop]);

  if (error) return <main className="workspace"><h1>Storefront temporarily unavailable</h1><p>Refresh the page to try again.</p></main>;
  return shop ? <Configurator shop={shop} /> : <p className="workspace" role="status">Loading storefront…</p>;
}

function PaymentPage({ token }: { token: string }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState('');

  async function openCheckout() {
    setBusy(true);
    setStatus('');
    try {
      const result = await requestJson<{ paid?: boolean; url?: string; test?: boolean }>('/api/checkout', { token });
      if (result.paid) setStatus('This order is already paid.');
      else if (result.url && result.test) {
        setStatus('Stripe is in test mode. Use a test card only.');
        setCheckoutUrl(result.url);
      } else if (result.url) location.assign(result.url);
      else setStatus('Stripe is still processing this payment. Check again shortly.');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="payment-page store-section">
    <h1>Pay for your rack order</h1>
    <p>Open Stripe Checkout to review your confirmed order total and pay securely.</p>
    {!checkoutUrl && <button className="delivery-action" disabled={busy} onClick={openCheckout}>{busy ? 'Opening…' : 'Continue to Stripe'}</button>}
    {status && <p role="status">{status}</p>}
    {checkoutUrl && <a className="delivery-action" href={checkoutUrl} rel="noreferrer">Open Stripe test checkout</a>}
  </main>;
}

function App() {
  if (import.meta.env.MODE === 'storefront') return <Store />;
  const path = location.pathname.replace(/\/$/, '');
  if (path === '/admin') return <Suspense fallback={<p className="workspace" role="status">Loading Builder admin…</p>}><BuilderAdmin /></Suspense>;
  if (path.startsWith('/pay/')) return <PaymentPage token={path.slice(5)} />;
  if (path === '/order-received') return <main className="payment-page store-section">
    <h1>Checkout complete</h1><p>Stripe will process your payment. Your builder will see the result on your order.</p><a href="/">Return to the storefront</a>
  </main>;
  return <Store />;
}

createRoot(document.getElementById('root')!).render(<App />);
