import { useState } from 'react';
import type { FormEvent } from 'react';
import type { RackConfiguration } from '../config/rack';
import { getVisit } from '../visit';
import { DiscoveryField } from './DiscoveryField';

export function StorefrontDetails({ racks, publicEmail, shopName }: { racks: RackConfiguration[]; publicEmail: string; shopName: string }) {
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
      <div className="store-section-heading"><h2 id="consult-heading">Ask about a custom rack</h2></div>
      <p>If you use different totes or need a rack for a tight space, tell me what you’re looking for.</p>
      <form className="consult-form" onSubmit={sendRequest}>
        <div className="consult-contact">
          <label className="delivery-field">Email
            <input type="email" name="email" autoComplete="email" maxLength={254} required />
          </label>
          <label className="delivery-field">Phone
            <input type="tel" name="phone" autoComplete="tel" maxLength={40} required />
          </label>
        </div>
        <label className="delivery-field">Project details
          <textarea name="details" rows={3} maxLength={2000} required
            placeholder="For example, your tote brand and the space you have" />
        </label>
        <DiscoveryField shopName={shopName} />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" hidden />
        <button className="delivery-action" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending message…' : 'Send message'}
        </button>
        {status === 'sent' && <p role="status">Message sent. I’ll follow up with you.</p>}
        {status === 'invalid' && <p role="alert">Check your email and phone number, and include a message.</p>}
        {status === 'error' && <p role="alert">Your message didn’t go through. Please try again.</p>}
      </form>
      {publicEmail && <p>Prefer email? <a className="text-link" href={`mailto:${publicEmail}`}>{publicEmail}</a></p>}
    </section>
  );
}
