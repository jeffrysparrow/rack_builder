export const reviewRatings = [5, 4, 3, 2, 1] as const;
export const reviewNameLimit = 100;
export const reviewCommentLimit = 2000;
export const reviewSources = {
  facebook_marketplace: 'Facebook Marketplace',
  google: 'Google Reviews',
  direct: 'Direct customer feedback',
  other: 'Other source',
  unspecified: 'No source shown',
};
export type ReviewSource = keyof typeof reviewSources;

export interface CustomerReview {
  id: string;
  name: string;
  stars: typeof reviewRatings[number];
  comment: string;
  source: ReviewSource;
}

export interface AdminReview extends CustomerReview {
  published: 0 | 1;
}
