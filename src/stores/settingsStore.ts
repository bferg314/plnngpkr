import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ColorTheme = "teal" | "indigo" | "violet" | "blue" | "green" | "orange" | "rose";

export const COLOR_THEMES: { value: ColorTheme; label: string; preview: string }[] = [
  { value: "teal", label: "Teal", preview: "#14b8a6" },
  { value: "indigo", label: "Indigo", preview: "#6366f1" },
  { value: "violet", label: "Violet", preview: "#a855f7" },
  { value: "blue", label: "Blue", preview: "#3b82f6" },
  { value: "green", label: "Green", preview: "#22c55e" },
  { value: "orange", label: "Orange", preview: "#f97316" },
  { value: "rose", label: "Rose", preview: "#f43f5e" },
];

interface SettingsState {
  colorTheme: ColorTheme;
  setColorTheme: (color: ColorTheme) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      colorTheme: "teal",
      setColorTheme: (colorTheme) => {
        set({ colorTheme });
        // Update the data-color attribute on the document
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-color", colorTheme);
        }
      },
    }),
    {
      name: "plnngpkr-settings",
      onRehydrateStorage: () => (state) => {
        // Apply the color theme on rehydration
        if (state && typeof document !== "undefined") {
          document.documentElement.setAttribute("data-color", state.colorTheme);
        }
      },
    }
  )
);
