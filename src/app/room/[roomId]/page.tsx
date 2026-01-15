"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Settings } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useRoomStore, selectCurrentStory, selectIsCurrentUserModerator } from "@/stores/roomStore";
import { CardDeck } from "@/components/room/voting/CardDeck";
import { VoteCard } from "@/components/room/voting/PokerCard";
import { SettingsDialog } from "@/components/settings-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getDeck } from "@/lib/constants/decks";
import { cn } from "@/lib/utils";
import type { CardValue } from "@/types";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [showJoinDialog, setShowJoinDialog] = useState(true);
  const [joinName, setJoinName] = useState("");
  const [isSpectator, setIsSpectator] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardValue | undefined>();
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importText, setImportText] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const {
    isConnecting,
    connectionError,
    room,
    participants,
    stories,
    currentStoryId,
    votingRound,
    chatMessages,
    timer,
    votingStats,
    participantId,
    isChatOpen,
    isStoriesOpen,
    toggleChat,
    toggleStories,
  } = useRoomStore();

  const currentStory = useRoomStore(selectCurrentStory);
  const isModerator = useRoomStore(selectIsCurrentUserModerator);

  const {
    connect,
    vote,
    reveal,
    resetVotes,
    nextStory,
    addStory,
    setFinalEstimate,
    sendChat,
    startTimer,
    pauseTimer,
  } = useSocket(roomId);

  // Track previous story ID to detect changes
  const prevStoryIdRef = useRef<string | null>(null);

  // Check for saved participant info on mount
  const savedNameRef = useRef<string | null>(null);
  if (savedNameRef.current === null && typeof window !== "undefined") {
    savedNameRef.current = localStorage.getItem("plnngpkr_participant_name") || "";
  }

  // Initialize join name from saved value
  useEffect(() => {
    if (savedNameRef.current && !joinName) {
      setJoinName(savedNameRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset selected card when story changes
  if (prevStoryIdRef.current !== currentStoryId) {
    prevStoryIdRef.current = currentStoryId;
    if (selectedCard !== undefined) {
      // Use setTimeout to avoid setting state during render
      setTimeout(() => setSelectedCard(undefined), 0);
    }
  }

  const handleJoin = () => {
    if (!joinName.trim()) return;
    setShowJoinDialog(false);
    connect(joinName.trim(), isSpectator);
  };

  const handleVote = (card: CardValue) => {
    if (!currentStoryId || votingRound?.status === "revealed") return;
    setSelectedCard(card);
    vote(currentStoryId, card);
  };

  const handleReveal = () => {
    reveal();
  };

  const handleResetVotes = () => {
    setSelectedCard(undefined);
    resetVotes();
  };

  const handleAddStory = () => {
    if (!newStoryTitle.trim()) return;
    addStory({
      title: newStoryTitle.trim(),
      order: stories.length,
      status: "pending",
    });
    setNewStoryTitle("");
  };

  const handleImportStories = () => {
    if (!importText.trim()) return;
    const lines = importText.split("\n").filter((line) => line.trim());
    lines.forEach((line, index) => {
      addStory({
        title: line.trim(),
        order: stories.length + index,
        status: "pending",
      });
    });
    setImportText("");
    setShowImportDialog(false);
  };

  const handleSelectStory = (storyId: string) => {
    nextStory(storyId);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput("");
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const deck = room ? getDeck(room.deckType, room.customDeck) : [];
  const isRevealed = votingRound?.status === "revealed";
  const votingParticipants = participants.filter((p) => !p.isSpectator);
  const spectators = participants.filter((p) => p.isSpectator);

  // Show join dialog
  if (showJoinDialog) {
    return (
      <Dialog open={showJoinDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Join Planning Poker</DialogTitle>
            <DialogDescription>
              Enter your name to join the session
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Your name"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button
                variant={isSpectator ? "default" : "outline"}
                size="sm"
                onClick={() => setIsSpectator(!isSpectator)}
              >
                {isSpectator ? "Spectator Mode" : "Join as Voter"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {isSpectator
                  ? "Watch without voting"
                  : "Participate in voting"}
              </span>
            </div>
            <Button className="w-full" onClick={handleJoin} disabled={!joinName.trim()}>
              Join Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show loading/connecting state
  if (isConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (connectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">{connectionError}</p>
            <Button onClick={() => router.push("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show room not found
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Room not found</p>
            <Button onClick={() => router.push("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">P</span>
              </div>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <span className="font-medium truncate max-w-[200px]">{room.name}</span>
            {isModerator && (
              <Badge variant="secondary" className="text-xs">
                Moderator
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copiedLink ? "Copied!" : "Share Link"}
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleStories}>
              Stories ({stories.length})
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleChat}>
              Chat
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Stories Sidebar */}
        <AnimatePresence>
          {isStoriesOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r bg-muted/30 overflow-hidden"
            >
              <div className="w-[300px] h-full flex flex-col">
                <div className="p-4 border-b">
                  <h2 className="font-semibold mb-3">Stories</h2>
                  <div className="flex flex-col gap-2">
                    <textarea
                      placeholder="Add a story..."
                      value={newStoryTitle}
                      onChange={(e) => setNewStoryTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddStory();
                        }
                      }}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      style={{ wordWrap: "break-word", overflowWrap: "break-word" }}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)}>
                        Import
                      </Button>
                      <Button size="sm" onClick={handleAddStory}>
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {stories.map((story) => (
                      <button
                        key={story.id}
                        onClick={() => handleSelectStory(story.id)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-colors",
                          currentStoryId === story.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-sm break-words whitespace-pre-wrap" style={{ wordBreak: "break-word" }}>
                            {story.title}
                          </span>
                          {story.finalEstimate !== undefined && (
                            <Badge variant="outline" className="shrink-0">
                              {story.finalEstimate}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={cn(
                              "text-xs",
                              currentStoryId === story.id
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground"
                            )}
                          >
                            {story.status}
                          </span>
                        </div>
                      </button>
                    ))}
                    {stories.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No stories yet. Add one to start voting!
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Current Story */}
          <div className="border-b p-4 bg-muted/20">
            {currentStory ? (
              <div className="max-w-2xl mx-auto text-center">
                <h2 className="text-xl font-semibold">{currentStory.title}</h2>
                {currentStory.description && (
                  <p className="text-muted-foreground mt-1">
                    {currentStory.description}
                  </p>
                )}
              </div>
            ) : (
              <div className="max-w-2xl mx-auto text-center text-muted-foreground">
                Select a story to start voting
              </div>
            )}
          </div>

          {/* Voting Area */}
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            {/* Participants' Votes */}
            <div className="mb-8">
              <div className="flex flex-wrap justify-center gap-4">
                {votingParticipants.map((p) => (
                  <VoteCard
                    key={p.id}
                    hasVoted={p.hasVoted}
                    vote={p.currentVote}
                    isRevealed={isRevealed}
                    participantName={p.name}
                    isCurrentUser={p.id === participantId}
                  />
                ))}
              </div>
              {spectators.length > 0 && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Spectators: {spectators.map((s) => s.name).join(", ")}
                </div>
              )}
            </div>

            {/* Timer */}
            {timer && room.settings.timerEnabled && (
              <div className="mb-4">
                <div
                  className={cn(
                    "text-2xl font-mono font-bold",
                    timer.remaining <= 10 && "text-destructive"
                  )}
                >
                  {Math.floor(timer.remaining / 60)}:
                  {String(timer.remaining % 60).padStart(2, "0")}
                </div>
              </div>
            )}

            {/* Moderator Controls */}
            {isModerator && currentStory && (
              <div className="flex gap-2 mb-6">
                {!isRevealed ? (
                  <>
                    <Button onClick={handleReveal} disabled={votingParticipants.every((p) => !p.hasVoted)}>
                      Reveal Votes
                    </Button>
                    {room.settings.timerEnabled && (
                      <>
                        {!timer?.isRunning ? (
                          <Button variant="outline" onClick={startTimer}>
                            Start Timer
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={pauseTimer}>
                            Pause
                          </Button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Button onClick={handleResetVotes}>Vote Again</Button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Final:</span>
                      {deck.slice(0, 8).map((card) => (
                        <button
                          key={String(card)}
                          onClick={() => setFinalEstimate(currentStory.id, card)}
                          className={cn(
                            "w-8 h-10 rounded border-2 text-xs font-semibold transition-colors",
                            currentStory.finalEstimate === card
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {card}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Card Deck for voting */}
            {currentStory && !isSpectator && votingRound?.status !== "revealed" && (
              <CardDeck
                cards={deck}
                selectedCard={selectedCard}
                onSelectCard={handleVote}
                className="max-w-3xl"
              />
            )}

            {/* Results after reveal */}
            {isRevealed && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-4"
              >
                {/* Voting Statistics */}
                {votingStats && room.settings.showAverage && (
                  <div className="flex justify-center gap-6">
                    {votingStats.average !== null && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{votingStats.average.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Average</div>
                      </div>
                    )}
                    {votingStats.median !== null && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{votingStats.median}</div>
                        <div className="text-xs text-muted-foreground">Median</div>
                      </div>
                    )}
                    {votingStats.mode.length > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{votingStats.mode.join(", ")}</div>
                        <div className="text-xs text-muted-foreground">Most Common</div>
                      </div>
                    )}
                    {votingStats.consensus && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-500">Yes</div>
                        <div className="text-xs text-muted-foreground">Consensus</div>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-muted-foreground">
                  {isModerator ? "Select a final estimate above." : "Waiting for moderator..."}
                </p>
              </motion.div>
            )}
          </div>
        </main>

        {/* Chat Sidebar */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l bg-muted/30 overflow-hidden"
            >
              <div className="w-[300px] h-full flex flex-col">
                <div className="p-4 border-b">
                  <h2 className="font-semibold">Chat</h2>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-3">
                    {chatMessages.map((msg) => (
                      <div key={msg.id}>
                        {msg.type === "system" ? (
                          <p className="text-xs text-center text-muted-foreground">
                            {msg.content}
                          </p>
                        ) : (
                          <div>
                            <span className="text-xs font-medium text-primary">
                              {msg.participantName}
                            </span>
                            <p className="text-sm">{msg.content}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendChat();
                      }}
                    />
                    <Button size="sm" onClick={handleSendChat}>
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Import Stories Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Stories</DialogTitle>
            <DialogDescription>
              Paste your stories below, one per line. Each line will become a separate story.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <textarea
              placeholder={"Story 1\nStory 2\nStory 3\n..."}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              autoFocus
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {importText.split("\n").filter((line) => line.trim()).length} stories to import
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImportStories} disabled={!importText.trim()}>
                  Import
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
