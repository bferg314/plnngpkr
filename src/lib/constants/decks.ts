import type { CardValue, DeckType } from "@/types";

// Preset deck definitions
export const PRESET_DECKS: Record<DeckType, CardValue[]> = {
  fibonacci: [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?", "☕"],
  fibonacciMini: [1, 2, 3, 5, 8, 13, "☕"],
  tshirt: ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"],
  powers2: [0, 1, 2, 4, 8, 16, 32, 64, "?", "☕"],
  sequential: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "?", "☕"],
  custom: [], // Custom decks are user-defined
};

// Deck display names
export const DECK_NAMES: Record<DeckType, string> = {
  fibonacci: "Fibonacci",
  fibonacciMini: "Fibonacci Mini",
  tshirt: "T-Shirt Sizes",
  powers2: "Powers of 2",
  sequential: "Sequential (0-10)",
  custom: "Custom",
};

// Deck descriptions
export const DECK_DESCRIPTIONS: Record<DeckType, string> = {
  fibonacci:
    "Classic Fibonacci sequence for relative estimation. Larger gaps for bigger stories.",
  fibonacciMini:
    "Compact Fibonacci sequence (1-13) for teams that keep estimates small.",
  tshirt:
    "Simple t-shirt sizing for quick, rough estimates without getting into specifics.",
  powers2:
    "Powers of 2 for teams that prefer exponential scaling.",
  sequential:
    "Simple 0-10 scale for teams that want straightforward numbering.",
  custom: "Create your own custom card sequence.",
};

// Special card values that don't contribute to numeric calculations
export const SPECIAL_CARDS: CardValue[] = ["?", "☕", "∞"];

// Check if a card value is numeric (for statistics)
export function isNumericCard(value: CardValue): value is number {
  return typeof value === "number";
}

// Get deck for a given type
export function getDeck(
  deckType: DeckType,
  customDeck?: CardValue[]
): CardValue[] {
  if (deckType === "custom" && customDeck) {
    return customDeck;
  }
  return PRESET_DECKS[deckType];
}

// Default room settings
export const DEFAULT_ROOM_SETTINGS = {
  allowRevote: true,
  autoReveal: false,
  showAverage: true,
  timerEnabled: false,
  timerDuration: 60, // 1 minute default
};

// Timer duration options (in seconds)
export const TIMER_DURATION_OPTIONS = [
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 90, label: "1.5 minutes" },
  { value: 120, label: "2 minutes" },
  { value: 180, label: "3 minutes" },
  { value: 300, label: "5 minutes" },
];
