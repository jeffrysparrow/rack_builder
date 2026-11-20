import { reviewCommentLimit, reviewNameLimit, reviewSources } from '../src/config/reviews';
import type { AdminReview, CustomerReview, ReviewSource } from '../src/config/reviews';
import type { Environment, Shop } from './platform-data';
import { HttpError, requestId, requiredText } from './platform-services';
import { numberIn } from './platform-settings';

const reviewColumns = 'id, customer_name AS name, stars, comment, source';

function reviewSource(value: unknown): ReviewSource {
  if (typeof value !== 'string' || !Object.hasOwn(reviewSources, value)) throw new HttpError(400, 'Choose a review source.');
  return value as ReviewSource;
}

export async function storefrontReviews(env: Environment, shop: Shop) {
  return (await env.DB.prepare(`SELECT ${reviewColumns} FROM shop_reviews WHERE shop_id = ? AND published = 1
    ORDER BY created_at DESC, id DESC`).bind(shop.id).all<CustomerReview>()).results;
}

export async function adminReviews(env: Environment, shop: Shop) {
  return (await env.DB.prepare(`SELECT ${reviewColumns}, published FROM shop_reviews WHERE shop_id = ?
    ORDER BY created_at DESC, id DESC`).bind(shop.id).all<AdminReview>()).results;
}

export async function addReview(env: Environment, shop: Shop, fields: Record<string, unknown>) {
  const id = requestId(fields.id);
  const name = requiredText(fields.name, 'the customer name', reviewNameLimit);
  const stars = numberIn(fields.stars, 'the star rating', 1, 5);
  const comment = requiredText(fields.comment, 'the review details', reviewCommentLimit);
  const source = reviewSource(fields.source === undefined ? 'unspecified' : fields.source);
  const write = await env.DB.prepare(`INSERT INTO shop_reviews (id, shop_id, customer_name, stars, comment, source)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).bind(id, shop.id, name, stars, comment, source).run();
  if (!write.meta.changes) {
    const previous = await env.DB.prepare(`SELECT ${reviewColumns} FROM shop_reviews WHERE shop_id = ? AND id = ?`)
      .bind(shop.id, id).first<CustomerReview>();
    if (previous?.name !== name || previous?.stars !== stars || previous?.comment !== comment || previous?.source !== source) {
      throw new HttpError(409, 'This review request was already used. Refresh Builder admin and try again.');
    }
  }
  return { id };
}

export async function setReviewSource(env: Environment, shop: Shop, fields: Record<string, unknown>) {
  const id = requestId(fields.id);
  const source = reviewSource(fields.source);
  const write = await env.DB.prepare('UPDATE shop_reviews SET source = ? WHERE shop_id = ? AND id = ?')
    .bind(source, shop.id, id).run();
  if (!write.meta.changes) throw new HttpError(404, 'Review not found.');
  return { id, source };
}

export async function setReviewVisibility(env: Environment, shop: Shop, fields: Record<string, unknown>) {
  const id = requestId(fields.id);
  const { published } = fields;
  if (typeof published !== 'boolean') throw new HttpError(400, 'Choose whether to show this review.');
  const write = await env.DB.prepare('UPDATE shop_reviews SET published = ? WHERE shop_id = ? AND id = ?')
    .bind(Number(published), shop.id, id).run();
  if (!write.meta.changes) throw new HttpError(404, 'Review not found.');
  return { id, published };
}
