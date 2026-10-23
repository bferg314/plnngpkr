"use client";

import { useTheme } from "next-themes";
import { useSettingsStore, COLOR_THEMES } from "@/stores/settingsStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TIMER_DURATION_OPTIONS } from "@/lib/constants/decks";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor } from "lucide-react";
import type { RoomSettings } from "@/types";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomSettings?: RoomSettings;
  isModerator?: boolean;
  onUpdateRoomSettings?: (settings: Partial<RoomSettings>) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  roomSettings,
  isModerator = false,
  onUpdateRoomSettings,
}: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const { colorTheme, setColorTheme } = useSettingsStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize appearance{roomSettings && isModerator ? " and room configuration." : "."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          {/* Mode Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Mode</label>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
                className="flex-1"
              >
                <Sun className="w-4 h-4 mr-2" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
                className="flex-1"
              >
                <Moon className="w-4 h-4 mr-2" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("system")}
                className="flex-1"
              >
                <Monitor className="w-4 h-4 mr-2" />
                System
              </Button>
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Accent Color</label>
            <div className="grid grid-cols-7 gap-2">
              {COLOR_THEMES.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setColorTheme(color.value)}
                  className={cn(
                    "w-10 h-10 rounded-full transition-all",
                    "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    colorTheme === color.value && "ring-2 ring-offset-2 ring-foreground"
                  )}
                  style={{ backgroundColor: color.preview }}
                  title={color.label}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected: {COLOR_THEMES.find((c) => c.value === colorTheme)?.label}
            </p>
          </div>

          {/* Room Settings (Moderator Only) */}
          {roomSettings && isModerator && onUpdateRoomSettings && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Room Settings (Moderator)</h3>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Allow Revote</p>
                    <p className="text-xs text-muted-foreground">
                      Players can change their vote before reveal
                    </p>
                  </div>
                  <Button
                    variant={roomSettings.allowRevote ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      onUpdateRoomSettings({ allowRevote: !roomSettings.allowRevote })
                    }
                  >
                    {roomSettings.allowRevote ? "On" : "Off"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Auto Reveal</p>
                    <p className="text-xs text-muted-foreground">
                      Automatically reveal when everyone has voted
                    </p>
                  </div>
                  <Button
                    variant={roomSettings.autoReveal ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      onUpdateRoomSettings({ autoReveal: !roomSettings.autoReveal })
                    }
                  >
                    {roomSettings.autoReveal ? "On" : "Off"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Show Statistics</p>
                    <p className="text-xs text-muted-foreground">
                      Display average, median, and mode after reveal
                    </p>
                  </div>
                  <Button
                    variant={roomSettings.showAverage ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      onUpdateRoomSettings({ showAverage: !roomSettings.showAverage })
                    }
                  >
                    {roomSettings.showAverage ? "On" : "Off"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Voting Timer</p>
                    <p className="text-xs text-muted-foreground">
                      Enable countdown timer for voting rounds
                    </p>
                  </div>
                  <Button
                    variant={roomSettings.timerEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      onUpdateRoomSettings({ timerEnabled: !roomSettings.timerEnabled })
                    }
                  >
                    {roomSettings.timerEnabled ? "On" : "Off"}
                  </Button>
                </div>

                {roomSettings.timerEnabled && (
                  <div className="pl-3 border-l-2 border-primary/20 space-y-2">
                    <p className="text-xs font-medium">Timer Duration</p>
                    <Select
                      value={String(roomSettings.timerDuration)}
                      onValueChange={(value) =>
                        onUpdateRoomSettings({ timerDuration: Number(value) })
                      }
                    >
                      <SelectTrigger className="w-[180px] h-8 text-xs">
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
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
