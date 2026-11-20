import { useState } from 'react';
import type { FormEvent } from 'react';
import type { RackConfiguration } from '../config/rack';
import { getVisit } from '../visit';
import { DiscoveryField } from './DiscoveryField';

export function StorefrontDetails({ racks }: { racks: RackConfiguration[] }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'invalid'>('idle');

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setStatus('sending');
    try {
      const response = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, racks, visit: getVisit() }),
      });
      if (response.ok && (await response.json()).sent === true) {
        form.reset();
        setStatus('sent');
      } else {
        setStatus(response.status === 400 ? 'invalid' : 'error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="store-section consult-section" id="consult" aria-labelledby="consult-heading">
      <div className="store-section-heading"><h2 id="consult-heading">Contact your builder</h2></div>
      <p>Ask about delivery, tote fit, or a custom rack layout.</p>
      <form className="consult-form" onSubmit={sendRequest}>
        <div className="consult-contact">
          <label className="delivery-field">Email
            <input type="email" name="email" autoComplete="email" maxLength={254} required />
          </label>
          <label className="delivery-field">Phone
            <input type="tel" name="phone" autoComplete="tel" maxLength={40} required />
          </label>
        </div>
        <label className="delivery-field">How can we help?
          <textarea name="details" rows={3} maxLength={2000} required
            placeholder="Delivery questions, space dimensions, tote size, or a good time to call" />
        </label>
        <DiscoveryField />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" hidden />
        <button className="delivery-action" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send a message'}
        </button>
        {status === 'sent' && <p role="status">Message received. Your builder will follow up.</p>}
        {status === 'invalid' && <p role="alert">Check your email and phone number, and include a message.</p>}
        {status === 'error' && <p role="alert">Your message couldn’t be sent. Your details are still here, so you can try again.</p>}
      </form>
    </section>
  );
}
