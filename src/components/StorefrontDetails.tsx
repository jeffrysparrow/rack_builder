import { useState } from 'react';
import type { FormEvent } from 'react';
import type { RackConfiguration } from '../config/rack';
import { marketplaceReviews } from '../config/reviews';

const { comments, overall, profileUrl } = marketplaceReviews;
export const hasMarketplaceReviews = Boolean(overall || comments.length || profileUrl);

export function CustomerReviews() {
  if (!hasMarketplaceReviews) return null;
  return <section className="store-section reviews-section" id="reviews" aria-labelledby="reviews-heading">
    <div className="store-section-heading">
      <h2 id="reviews-heading">What customers say</h2>
      {overall && <p>{overall.stars} out of 5 · {overall.count} Marketplace {overall.count === 1 ? 'rating' : 'ratings'}</p>}
    </div>
    {comments.length > 0 && <div className="review-grid">
      {comments.map((review) => <figure className="review-card" key={review.id}>
        <span className="review-stars" role="img" aria-label={`${review.stars} out of 5 stars`}>
          {'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}
        </span>
        <blockquote>{review.comment}</blockquote>
        <figcaption>{review.attribution ? `${review.attribution} · Facebook Marketplace` : 'Facebook Marketplace'}</figcaption>
      </figure>)}
    </div>}
    {profileUrl && <a className="text-link" href={profileUrl}>Read reviews on Facebook Marketplace</a>}
  </section>;
}

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
        body: JSON.stringify({ ...fields, racks }),
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

  return <>
    <CustomerReviews />
    <section className="store-section consult-section" id="consult" aria-labelledby="consult-heading">
      <div className="store-section-heading"><h2 id="consult-heading">Need a custom rack?</h2></div>
      <p>Request a call about a custom layout, an unusual space, or a different tote size.</p>
      <form className="consult-form" onSubmit={sendRequest}>
        <div className="consult-contact">
          <label className="delivery-field">Email
            <input type="email" name="email" autoComplete="email" maxLength={254} required />
          </label>
          <label className="delivery-field">Phone
            <input type="tel" name="phone" autoComplete="tel" maxLength={40} required />
          </label>
        </div>
        <label className="delivery-field">What would you like to build?
          <textarea name="details" rows={3} maxLength={2000} required
            placeholder="Space dimensions, tote size, or a good time to call" />
        </label>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" hidden />
        <button className="delivery-action" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Request a consultation'}
        </button>
        {status === 'sent' && <p role="status">Request sent. I’ll reach out to discuss your rack.</p>}
        {status === 'invalid' && <p role="alert">Check your email and phone number, and add a few details about your request.</p>}
        {status === 'error' && <p role="alert">Your request couldn’t be sent. Your details are still here, so you can try again.</p>}
      </form>
    </section>
  </>;
}
