"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

export function ColorThemeInit() {
  const colorTheme = useSettingsStore((state) => state.colorTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-color", colorTheme);
  }, [colorTheme]);

  return null;
}
