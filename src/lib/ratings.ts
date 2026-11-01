export interface RatingSummary {
  average_rating: number;
  rating_count: number;
}

/** What to show for a workout's rating. Null when there's nothing to show: guests can't read ratings. */
export function formatRating(summary: RatingSummary | null | undefined, signedIn: boolean): string | null {
  if (!signedIn) return null;
  if (!summary || summary.rating_count === 0) return 'No ratings yet';
  return `${Number(summary.average_rating).toFixed(1)} (${summary.rating_count})`;
}
