import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateVotingStats,
  closestFibonacci,
  formatCardValue,
  hasHighDisagreement,
} from "../statistics";
import type { Vote } from "@/types";

function makeVote(participantId: string, value: number | string | null): Vote {
  return {
    participantId,
    participantName: `User ${participantId}`,
    storyId: "story-1",
    value,
    timestamp: new Date(),
  };
}

describe("statistics utility", () => {
  it("calculates average, median, mode, consensus, spread, and distribution for numeric votes", () => {
    const votes: Vote[] = [
      makeVote("1", 3),
      makeVote("2", 5),
      makeVote("3", 5),
      makeVote("4", 8),
    ];

    const stats = calculateVotingStats("story-1", votes);
    assert.equal(stats.average, 5.3); // (3+5+5+8)/4 = 5.25 -> 5.3
    assert.equal(stats.median, 5);
    assert.deepEqual(stats.mode, [5]);
    assert.equal(stats.consensus, false);
    assert.equal(stats.spread, 5); // 8 - 3
    assert.deepEqual(stats.distribution, { "3": 1, "5": 2, "8": 1 });
  });

  it("identifies consensus when multiple voters pick the same value", () => {
    const votes: Vote[] = [
      makeVote("1", 8),
      makeVote("2", 8),
      makeVote("3", 8),
    ];

    const stats = calculateVotingStats("story-1", votes);
    assert.equal(stats.consensus, true);
    assert.equal(stats.average, 8);
    assert.equal(stats.median, 8);
    assert.equal(stats.spread, 0);
  });

  it("does not report consensus for a single voter", () => {
    const stats = calculateVotingStats("story-1", [makeVote("1", 5)]);
    assert.equal(stats.consensus, false);
    assert.equal(stats.average, 5);
    assert.equal(stats.median, 5);
    assert.equal(stats.spread, null);
  });

  it("handles non-numeric votes (e.g., ?, ☕, T-shirt sizes) gracefully", () => {
    const votes: Vote[] = [
      makeVote("1", "?"),
      makeVote("2", "☕"),
      makeVote("3", "?"),
    ];

    const stats = calculateVotingStats("story-1", votes);
    assert.equal(stats.average, null);
    assert.equal(stats.median, null);
    assert.equal(stats.spread, null);
    assert.deepEqual(stats.mode, ["?"]);
    assert.deepEqual(stats.distribution, { "?": 2, "☕": 1 });
  });

  it("finds the closest Fibonacci number", () => {
    assert.equal(closestFibonacci(4.2), 5);
    assert.equal(closestFibonacci(6.1), 5);
    assert.equal(closestFibonacci(7.0), 8);
    assert.equal(closestFibonacci(11.0), 13);
  });

  it("formats card values including null", () => {
    assert.equal(formatCardValue(5), "5");
    assert.equal(formatCardValue("XL"), "XL");
    assert.equal(formatCardValue(null), "-");
  });

  it("detects high disagreement accurately", () => {
    const highSpreadStats = calculateVotingStats("story-1", [
      makeVote("1", 1),
      makeVote("2", 13),
    ]);
    assert.equal(hasHighDisagreement(highSpreadStats), true);

    const lowSpreadStats = calculateVotingStats("story-1", [
      makeVote("1", 5),
      makeVote("2", 8),
    ]);
    assert.equal(hasHighDisagreement(lowSpreadStats), false);
  });
});
