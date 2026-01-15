"use client";

import { motion } from "framer-motion";
import { EstimateCard } from "./EstimateCard";
import { cn } from "@/lib/utils";
import type { CardValue } from "@/types";

interface CardDeckProps {
  cards: CardValue[];
  selectedCard?: CardValue;
  onSelectCard: (card: CardValue) => void;
  disabled?: boolean;
  className?: string;
}

export function CardDeck({
  cards,
  selectedCard,
  onSelectCard,
  disabled = false,
  className,
}: CardDeckProps) {
  return (
    <div className={cn("w-full", className)}>
      <motion.div
        className="flex flex-wrap justify-center gap-2 md:gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {cards.map((card, index) => (
          <motion.div
            key={`${card}-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <EstimateCard
              value={card}
              isSelected={selectedCard === card}
              onClick={() => onSelectCard(card)}
              disabled={disabled}
              size="md"
            />
          </motion.div>
        ))}
      </motion.div>

      {selectedCard !== undefined && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Your vote:{" "}
            <span className="font-bold text-primary text-lg">{selectedCard}</span>
          </p>
        </motion.div>
      )}
    </div>
  );
}

// Compact version for sidebar or mobile
interface CompactDeckProps {
  cards: CardValue[];
  selectedCard?: CardValue;
  onSelectCard: (card: CardValue) => void;
  disabled?: boolean;
}

export function CompactDeck({
  cards,
  selectedCard,
  onSelectCard,
  disabled = false,
}: CompactDeckProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {cards.map((card, index) => (
        <button
          key={`${card}-${index}`}
          onClick={() => !disabled && onSelectCard(card)}
          disabled={disabled}
          className={cn(
            "w-10 h-12 rounded-lg border-2 text-sm font-semibold transition-all",
            selectedCard === card
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {card}
        </button>
      ))}
    </div>
  );
}
