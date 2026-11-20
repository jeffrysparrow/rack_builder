import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { reviewCommentLimit, reviewNameLimit, reviewRatings, reviewSources } from '../config/reviews';
import type { AdminReview, ReviewSource } from '../config/reviews';
import type { AdminUpdate } from './AdminOrderWorkflow';
import { ReviewStars } from './CustomerReviews';

function ReviewSourceField({ source }: { source?: ReviewSource }) {
  const id = useId();
  return <div className="delivery-field">
    <label htmlFor={id}>Review source</label>
    <select id={id} name="source" required defaultValue={source ?? ''}>
      {!source && <option value="">Select a source</option>}
      {Object.entries(reviewSources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </div>;
}

export function BuilderReviews({ reviews, update }: { reviews: AdminReview[]; update: AdminUpdate }) {
  const [id, setId] = useState(() => crypto.randomUUID());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const saved = await update('/reviews', { id, name: fields.get('name'), stars: Number(fields.get('stars')),
      comment: fields.get('comment'), source: fields.get('source') }, 'Review published.');
    if (saved) {
      form.reset();
      setId(crypto.randomUUID());
    }
  }

  return <>
    <section className="admin-card">
      <h2>Add a review</h2>
      <form className="delivery-form" onSubmit={submit}>
        <div className="consult-contact">
          <label className="delivery-field">Customer name<input name="name" required maxLength={reviewNameLimit} /></label>
          <div className="delivery-field">
            <label htmlFor="review-stars">Star rating</label>
            <select id="review-stars" name="stars" required defaultValue="">
              <option value="">Select a rating</option>
              {reviewRatings.map((stars) => <option key={stars} value={stars}>{stars} {stars === 1 ? 'star' : 'stars'}</option>)}
            </select>
          </div>
        </div>
        <ReviewSourceField />
        <label className="delivery-field">Review details<textarea name="comment" rows={5} required maxLength={reviewCommentLimit} /></label>
        <button className="delivery-action" type="submit">Publish review</button>
      </form>
    </section>
    <section className="admin-card">
      <h2>Storefront reviews</h2>
      {reviews.length === 0 && <p>No reviews yet.</p>}
      {reviews.map(({ id, name, stars, comment, published, source }) => <article key={id} className="admin-record">
        <h3>{name}</h3>
        <ReviewStars stars={stars} /> <span>· {published ? 'Published' : 'Hidden'}</span>
        <p className="admin-notes">{comment}</p>
        <form className="admin-payment" onSubmit={(event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void update('/reviews/source', { id, source: fields.get('source') }, 'Review source saved.');
        }}>
          <ReviewSourceField key={source} source={source} />
          <button type="submit" className="delivery-action delivery-edit">Save source</button>
        </form>
        <button type="button" className="delivery-action delivery-edit" onClick={() => void update('/reviews/visibility',
          { id, published: !published }, published ? 'Review hidden.' : 'Review published.')}>
          {published ? 'Hide review' : 'Republish review'}
        </button>
      </article>)}
    </section>
  </>;
}
