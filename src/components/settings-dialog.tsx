"use client";

import { useTheme } from "next-themes";
import { useSettingsStore, COLOR_THEMES, type ColorTheme } from "@/stores/settingsStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const { colorTheme, setColorTheme } = useSettingsStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize the appearance of the application.
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
