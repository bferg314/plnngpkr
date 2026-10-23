import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as rooms from "../rooms";
import { DEFAULT_ROOM_SETTINGS } from "../../src/lib/constants/decks";

const TEST_ROOM_ID = "test-room-1";

describe("server/rooms state management", () => {
  beforeEach(() => {
    rooms.deleteRoom(TEST_ROOM_ID);
    rooms.createRoom({
      id: TEST_ROOM_ID,
      name: "Sprint Planning",
      deckType: "fibonacciMini",
      settings: { ...DEFAULT_ROOM_SETTINGS },
      createdBy: "tester",
    });
  });

  it("auto-assigns first non-spectator voter as moderator and promotes next voter on leave", () => {
    const spectator = rooms.addParticipant(TEST_ROOM_ID, {
      id: "spec-1",
      name: "Observer",
      isSpectator: true,
      isModerator: false,
      hasVoted: false,
      connectionStatus: "connected",
    });
    assert.equal(spectator?.isModerator, false);

    const voter1 = rooms.addParticipant(TEST_ROOM_ID, {
      id: "voter-1",
      name: "Alice",
      isSpectator: false,
      isModerator: false,
      hasVoted: false,
      connectionStatus: "connected",
    });
    assert.equal(voter1?.isModerator, true);
    assert.equal(rooms.isParticipantModerator(TEST_ROOM_ID, "voter-1"), true);

    const voter2 = rooms.addParticipant(TEST_ROOM_ID, {
      id: "voter-2",
      name: "Bob",
      isSpectator: false,
      isModerator: false,
      hasVoted: false,
      connectionStatus: "connected",
    });
    assert.equal(voter2?.isModerator, false);

    // When Alice leaves, Bob becomes moderator
    rooms.removeParticipant(TEST_ROOM_ID, "voter-1");
    assert.equal(rooms.isParticipantModerator(TEST_ROOM_ID, "voter-2"), true);
  });

  it("redacts unrevealed vote values from RoomState until revealVotes is called", () => {
    rooms.addParticipant(TEST_ROOM_ID, {
      id: "voter-1",
      name: "Alice",
      isSpectator: false,
      isModerator: true,
      hasVoted: false,
      connectionStatus: "connected",
    });
    rooms.addParticipant(TEST_ROOM_ID, {
      id: "voter-2",
      name: "Bob",
      isSpectator: false,
      isModerator: false,
      hasVoted: false,
      connectionStatus: "connected",
    });

    const story = rooms.addStory(TEST_ROOM_ID, {
      title: "User login flow",
      order: 0,
      status: "pending",
    });
    assert.ok(story);

    rooms.setCurrentStory(TEST_ROOM_ID, story.id);
    assert.equal(rooms.submitVote(TEST_ROOM_ID, "voter-1", story.id, 5), true);
    assert.equal(rooms.submitVote(TEST_ROOM_ID, "voter-2", story.id, 8), true);

    // Public room state should redact vote values before reveal
    const publicState = rooms.getRoomState(TEST_ROOM_ID);
    assert.ok(publicState);
    assert.equal(publicState.votingRound?.status, "voting");
    assert.equal(publicState.votingRound?.votes["voter-1"]?.value, null);
    assert.equal(publicState.votingRound?.votes["voter-2"]?.value, null);
    assert.equal(
      publicState.participants.find((p) => p.id === "voter-1")?.currentVote,
      undefined
    );

    // Viewer-specific state only shows viewer's own vote before reveal
    const aliceState = rooms.getRoomState(TEST_ROOM_ID, "voter-1");
    assert.equal(aliceState?.votingRound?.votes["voter-1"]?.value, 5);
    assert.equal(aliceState?.votingRound?.votes["voter-2"]?.value, null);
    assert.equal(
      aliceState?.participants.find((p) => p.id === "voter-1")?.currentVote,
      5
    );
    assert.equal(
      aliceState?.participants.find((p) => p.id === "voter-2")?.currentVote,
      undefined
    );

    // Reveal votes
    const revealed = rooms.revealVotes(TEST_ROOM_ID);
    assert.ok(revealed);
    assert.equal(revealed.stats.average, 6.5);

    const stateAfterReveal = rooms.getRoomState(TEST_ROOM_ID);
    assert.equal(stateAfterReveal?.votingRound?.status, "revealed");
    assert.equal(stateAfterReveal?.votingRound?.votes["voter-1"]?.value, 5);
    assert.equal(stateAfterReveal?.votingRound?.votes["voter-2"]?.value, 8);
    assert.equal(stateAfterReveal?.votingStats?.average, 6.5);
  });

  it("preserves room and stories when last participant leaves (TTL grace period)", () => {
    rooms.addParticipant(TEST_ROOM_ID, {
      id: "voter-1",
      name: "Alice",
      isSpectator: false,
      isModerator: true,
      hasVoted: false,
      connectionStatus: "connected",
    });

    rooms.addStory(TEST_ROOM_ID, {
      title: "Important story",
      order: 0,
      status: "pending",
    });

    rooms.removeParticipant(TEST_ROOM_ID, "voter-1");

    // Room should still exist in memory with its stories intact
    const state = rooms.getRoomState(TEST_ROOM_ID);
    assert.ok(state);
    assert.equal(state.stories.length, 1);
    assert.equal(state.stories[0].title, "Important story");
  });

  it("recalls cached votes and stats when re-selecting a revealed story", () => {
    rooms.addParticipant(TEST_ROOM_ID, {
      id: "voter-1",
      name: "Alice",
      isSpectator: false,
      isModerator: true,
      hasVoted: false,
      connectionStatus: "connected",
    });

    const story1 = rooms.addStory(TEST_ROOM_ID, {
      title: "Story 1",
      order: 0,
      status: "pending",
    })!;
    const story2 = rooms.addStory(TEST_ROOM_ID, {
      title: "Story 2",
      order: 1,
      status: "pending",
    })!;

    // Vote and reveal Story 1
    rooms.setCurrentStory(TEST_ROOM_ID, story1.id);
    rooms.submitVote(TEST_ROOM_ID, "voter-1", story1.id, 13);
    rooms.revealVotes(TEST_ROOM_ID);

    // Switch to Story 2 (pending)
    const switchTo2 = rooms.setCurrentStory(TEST_ROOM_ID, story2.id);
    assert.equal(switchTo2.cachedStats, undefined);
    const stateOn2 = rooms.getRoomState(TEST_ROOM_ID);
    assert.equal(stateOn2?.votingRound?.status, "voting");
    assert.equal(stateOn2?.votingStats, null);
    assert.equal(stateOn2?.participants[0].hasVoted, false);

    // Switch back to Story 1 (revealed)
    const switchBackTo1 = rooms.setCurrentStory(TEST_ROOM_ID, story1.id);
    assert.ok(switchBackTo1.cachedStats);
    assert.equal(switchBackTo1.cachedStats.average, 13);
    const stateBackOn1 = rooms.getRoomState(TEST_ROOM_ID);
    assert.equal(stateBackOn1?.votingRound?.status, "revealed");
    assert.equal(stateBackOn1?.votingStats?.average, 13);
    assert.equal(stateBackOn1?.participants[0].currentVote, 13);
  });
});
