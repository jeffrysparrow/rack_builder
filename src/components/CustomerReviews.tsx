import { reviewSources } from '../config/reviews';
import type { CustomerReview } from '../config/reviews';

export function ReviewStars({ stars }: { stars: CustomerReview['stars'] }) {
  return <span className="review-stars" role="img" aria-label={`${stars} out of 5 stars`}>
    {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
  </span>;
}

export function CustomerReviews({ reviews }: { reviews: CustomerReview[] }) {
  if (!reviews.length) return null;
  return <section className="store-section reviews-section" id="reviews" aria-labelledby="reviews-heading">
    <div className="store-section-heading"><h2 id="reviews-heading">Customer reviews</h2></div>
    <div className="review-grid">
      {reviews.map(({ id, name, stars, comment, source }) => <figure className="review-card" key={id}>
        <ReviewStars stars={stars} />
        <blockquote>{comment}</blockquote>
        <figcaption><strong>{name}</strong>{source !== 'unspecified' && <span>{reviewSources[source]}</span>}</figcaption>
      </figure>)}
    </div>
  </section>;
}
