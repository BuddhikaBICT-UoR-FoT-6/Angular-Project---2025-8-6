export interface ProductReview {
  id: string;
  productId: string;
  userName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createdAt: string;
}

export interface Review {
  _id?: string;
  productId: string;
  userId?: string;
  userName?: string;
  rating: number;
  comment: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewSummary {
  average: number;
  count: number;
}
