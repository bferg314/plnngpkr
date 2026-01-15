"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  PRESET_DECKS,
  DECK_NAMES,
  DECK_DESCRIPTIONS,
  DEFAULT_ROOM_SETTINGS,
  TIMER_DURATION_OPTIONS,
} from "@/lib/constants/decks";
import type { DeckType, CardValue } from "@/types";

export default function CreateRoomPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [deckType, setDeckType] = useState<DeckType>("fibonacci");
  const [customDeck, setCustomDeck] = useState<CardValue[]>([]);
  const [customDeckInput, setCustomDeckInput] = useState("");
  const [settings, setSettings] = useState(DEFAULT_ROOM_SETTINGS);

  const currentDeck =
    deckType === "custom" ? customDeck : PRESET_DECKS[deckType];

  const handleAddCustomCard = () => {
    const value = customDeckInput.trim();
    if (!value) return;

    // Try to parse as number
    const numValue = Number(value);
    const cardValue = isNaN(numValue) ? value : numValue;

    if (!customDeck.includes(cardValue)) {
      setCustomDeck([...customDeck, cardValue]);
    }
    setCustomDeckInput("");
  };

  const handleRemoveCustomCard = (card: CardValue) => {
    setCustomDeck(customDeck.filter((c) => c !== card));
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      return;
    }

    if (deckType === "custom" && customDeck.length < 2) {
      return;
    }

    setIsCreating(true);

    try {
      // Generate room ID
      const roomId = nanoid(8);

      // Create room via API
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: roomId,
          name: roomName.trim(),
          deckType,
          customDeck: deckType === "custom" ? customDeck : undefined,
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create room");
      }

      // Navigate to room
      router.push(`/room/${roomId}`);
    } catch (error) {
      console.error("Failed to create room:", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">P</span>
            </div>
            <span className="font-semibold text-lg">plnngpkr</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold mb-2">Create a Room</h1>
          <p className="text-muted-foreground mb-8">
            Set up your planning poker session in seconds.
          </p>

          <div className="space-y-6">
            {/* Room Name */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Room Name</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="e.g., Sprint 42 Planning"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="text-lg"
                />
              </CardContent>
            </Card>

            {/* Deck Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Card Deck</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={deckType}
                  onValueChange={(value) => setDeckType(value as DeckType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DECK_NAMES) as DeckType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {DECK_NAMES[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <p className="text-sm text-muted-foreground">
                  {DECK_DESCRIPTIONS[deckType]}
                </p>

                {/* Custom Deck Builder */}
                {deckType === "custom" && (
                  <div className="space-y-3 pt-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a card value (e.g., 5, XL, ?)"
                        value={customDeckInput}
                        onChange={(e) => setCustomDeckInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomCard();
                          }
                        }}
                      />
                      <Button onClick={handleAddCustomCard} variant="secondary">
                        Add
                      </Button>
                    </div>
                    {customDeck.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {customDeck.map((card, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-sm cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleRemoveCustomCard(card)}
                          >
                            {card} ×
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Deck Preview */}
                {currentDeck.length > 0 && (
                  <div className="pt-2">
                    <p className="text-sm font-medium mb-2">Preview:</p>
                    <div className="flex flex-wrap gap-2">
                      {currentDeck.map((card, index) => (
                        <div
                          key={index}
                          className="w-10 h-14 bg-card border-2 border-border rounded-lg flex items-center justify-center text-sm font-semibold text-primary shadow-sm"
                        >
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Room Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Allow Revote */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Allow Revote</p>
                    <p className="text-sm text-muted-foreground">
                      Players can change their vote before reveal
                    </p>
                  </div>
                  <Button
                    variant={settings.allowRevote ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setSettings({ ...settings, allowRevote: !settings.allowRevote })
                    }
                  >
                    {settings.allowRevote ? "On" : "Off"}
                  </Button>
                </div>

                {/* Auto Reveal */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto Reveal</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically reveal when everyone has voted
                    </p>
                  </div>
                  <Button
                    variant={settings.autoReveal ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setSettings({ ...settings, autoReveal: !settings.autoReveal })
                    }
                  >
                    {settings.autoReveal ? "On" : "Off"}
                  </Button>
                </div>

                {/* Show Average */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Show Statistics</p>
                    <p className="text-sm text-muted-foreground">
                      Display average and distribution after reveal
                    </p>
                  </div>
                  <Button
                    variant={settings.showAverage ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setSettings({ ...settings, showAverage: !settings.showAverage })
                    }
                  >
                    {settings.showAverage ? "On" : "Off"}
                  </Button>
                </div>

                {/* Timer */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Voting Timer</p>
                    <p className="text-sm text-muted-foreground">
                      Optional countdown timer for voting rounds
                    </p>
                  </div>
                  <Button
                    variant={settings.timerEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setSettings({ ...settings, timerEnabled: !settings.timerEnabled })
                    }
                  >
                    {settings.timerEnabled ? "On" : "Off"}
                  </Button>
                </div>

                {settings.timerEnabled && (
                  <div className="pl-4 border-l-2 border-primary/20">
                    <p className="text-sm font-medium mb-2">Timer Duration</p>
                    <Select
                      value={String(settings.timerDuration)}
                      onValueChange={(value) =>
                        setSettings({ ...settings, timerDuration: Number(value) })
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMER_DURATION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Create Button */}
            <Button
              className="w-full text-lg h-12"
              size="lg"
              onClick={handleCreateRoom}
              disabled={
                isCreating ||
                !roomName.trim() ||
                (deckType === "custom" && customDeck.length < 2)
              }
            >
              {isCreating ? "Creating..." : "Create Room"}
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
