import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { Review, ReviewSummary } from '../models/review.model';

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  constructor(private http: HttpClient) {}

  getReviews(productId: string): Observable<Review[]> {
    return this.http.get<Review[]>(`/api/reviews/product/${encodeURIComponent(productId)}`);
  }

  getSummary(productId: string): Observable<ReviewSummary> {
    return this.http.get<ReviewSummary>(`/api/reviews/summary/${encodeURIComponent(productId)}`);
  }

  getSummaries(productIds: string[]): Observable<Record<string, ReviewSummary>> {
    const ids = (productIds || []).filter(Boolean).join(',');
    return this.http.get<Record<string, ReviewSummary>>(`/api/reviews/summary?ids=${encodeURIComponent(ids)}`);
  }

  addOrUpdateReview(productId: string, rating: number, comment: string): Observable<Review> {
    return this.http.post<Review>(`/api/reviews/product/${encodeURIComponent(productId)}`, {
      rating,
      comment
    });
  }
}
