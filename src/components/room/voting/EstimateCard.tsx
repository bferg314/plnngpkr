"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { CardValue } from "@/types";

interface EstimateCardProps {
  value: CardValue;
  isSelected?: boolean;
  isRevealed?: boolean;
  isFlipped?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-12 h-18 text-lg",
  md: "w-16 h-24 text-xl",
  lg: "w-20 h-32 text-2xl",
};

export function EstimateCard({
  value,
  isSelected = false,
  isRevealed = true,
  isFlipped = false,
  onClick,
  size = "md",
  disabled = false,
  className,
}: EstimateCardProps) {
  const isSpecialCard = value === "?" || value === "☕" || value === "∞";

  return (
    <motion.div
      className={cn("perspective-1000 cursor-pointer", className)}
      whileHover={!disabled ? { y: -4, scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      onClick={!disabled ? onClick : undefined}
    >
      <motion.div
        className={cn(
          "relative transform-style-3d transition-transform duration-500",
          sizeClasses[size]
        )}
        animate={{ rotateY: isFlipped && !isRevealed ? 180 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        {/* Front of card (value side) */}
        <div
          className={cn(
            "absolute inset-0 backface-hidden rounded-xl border-2 flex items-center justify-center font-bold shadow-md transition-all duration-200",
            isSelected
              ? "border-primary bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/50"
              : "border-border bg-card text-card-foreground hover:border-primary/50",
            isSpecialCard && !isSelected && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn(sizeClasses[size].split(" ")[2])}>
            {value ?? "-"}
          </span>
          {/* Corner values */}
          <span className="absolute top-1.5 left-2 text-xs opacity-60">
            {value}
          </span>
          <span className="absolute bottom-1.5 right-2 text-xs opacity-60 rotate-180">
            {value}
          </span>
        </div>

        {/* Back of card (hidden side) */}
        <div
          className={cn(
            "absolute inset-0 backface-hidden rounded-xl border-2 border-primary bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md rotate-y-180"
          )}
        >
          {/* Card back pattern */}
          <div className="w-3/4 h-3/4 rounded-lg border-2 border-primary-foreground/30 flex items-center justify-center">
            <div className="w-8 h-8 rounded bg-primary-foreground/20 flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">P</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Variant for displaying participant's vote status
interface VoteCardProps {
  hasVoted: boolean;
  vote?: CardValue;
  isRevealed: boolean;
  participantName: string;
  isCurrentUser?: boolean;
}

export function VoteCard({
  hasVoted,
  vote,
  isRevealed,
  participantName,
  isCurrentUser = false,
}: VoteCardProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className="perspective-1000"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="relative w-20 h-28 transform-style-3d"
          animate={{ rotateY: isRevealed ? 0 : 180 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          {/* Front - shows vote value */}
          <div
            className={cn(
              "absolute inset-0 backface-hidden rounded-lg border-2 flex items-center justify-center font-bold shadow-md",
              isRevealed
                ? "border-primary bg-card"
                : "border-border bg-muted"
            )}
          >
            {isRevealed && vote !== undefined ? (
              <span className="text-xl text-primary">{vote}</span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>

          {/* Back - shows voted/waiting status */}
          <div
            className={cn(
              "absolute inset-0 backface-hidden rounded-lg border-2 flex items-center justify-center shadow-md rotate-y-180",
              hasVoted
                ? "border-green-500 bg-green-500/10"
                : "border-border bg-muted"
            )}
          >
            {hasVoted ? (
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-8 h-8 text-muted-foreground animate-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </div>
        </motion.div>
      </motion.div>
      <span
        className={cn(
          "text-sm font-medium truncate max-w-[100px]",
          isCurrentUser ? "text-primary" : "text-muted-foreground"
        )}
        title={participantName}
      >
        {participantName}
        {isCurrentUser && " (you)"}
      </span>
    </div>
  );
}
