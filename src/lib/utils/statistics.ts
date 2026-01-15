import type { CardValue, Vote, VotingStats } from "@/types";
import { isNumericCard } from "@/lib/constants/decks";

/**
 * Calculate voting statistics from a set of votes
 */
export function calculateVotingStats(
  storyId: string,
  votes: Vote[]
): VotingStats {
  const numericVotes = votes
    .map((v) => v.value)
    .filter(isNumericCard);

  // Calculate distribution (all values, including non-numeric)
  const distribution: Record<string, number> = {};
  votes.forEach((vote) => {
    const key = String(vote.value);
    distribution[key] = (distribution[key] || 0) + 1;
  });

  // Calculate average (only numeric)
  const average =
    numericVotes.length > 0
      ? numericVotes.reduce((sum, v) => sum + v, 0) / numericVotes.length
      : null;

  // Calculate median (only numeric)
  const median = calculateMedian(numericVotes);

  // Calculate mode (all values)
  const mode = calculateMode(votes.map((v) => v.value));

  // Check consensus (all votes are the same)
  const uniqueValues = new Set(votes.map((v) => String(v.value)));
  const consensus = uniqueValues.size === 1 && votes.length > 1;

  // Calculate spread (max - min, only numeric)
  const spread =
    numericVotes.length > 1
      ? Math.max(...numericVotes) - Math.min(...numericVotes)
      : null;

  return {
    storyId,
    votes,
    average: average !== null ? Math.round(average * 10) / 10 : null,
    median,
    mode,
    consensus,
    spread,
    distribution,
  };
}

/**
 * Calculate median of numeric values
 */
function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Calculate mode (most frequent values)
 */
function calculateMode(values: CardValue[]): CardValue[] {
  if (values.length === 0) return [];

  const counts = new Map<string, { value: CardValue; count: number }>();

  values.forEach((value) => {
    const key = String(value);
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { value, count: 1 });
    }
  });

  const maxCount = Math.max(...Array.from(counts.values()).map((v) => v.count));

  return Array.from(counts.values())
    .filter((v) => v.count === maxCount)
    .map((v) => v.value);
}

/**
 * Get the closest Fibonacci number to a given average
 */
export function closestFibonacci(average: number): number {
  const fibonacci = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

  return fibonacci.reduce((prev, curr) =>
    Math.abs(curr - average) < Math.abs(prev - average) ? curr : prev
  );
}

/**
 * Format a card value for display
 */
export function formatCardValue(value: CardValue): string {
  if (value === null) return "-";
  return String(value);
}

/**
 * Check if votes show high disagreement
 */
export function hasHighDisagreement(stats: VotingStats): boolean {
  if (stats.spread === null || stats.average === null) return false;

  // Consider high disagreement if spread is more than 50% of average
  // or if spread is greater than 5 for small averages
  return stats.spread > Math.max(5, stats.average * 0.5);
}
