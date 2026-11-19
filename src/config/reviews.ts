interface MarketplaceReview {
  id: string;
  stars: 1 | 2 | 3 | 4 | 5;
  comment: string;
  attribution?: string;
}

interface MarketplaceReviews {
  profileUrl?: string;
  overall?: { stars: number; count: number };
  comments: MarketplaceReview[];
}

// Use the seller profile's actual aggregate and customer comments approved for display.
export const marketplaceReviews: MarketplaceReviews = { comments: [] };
