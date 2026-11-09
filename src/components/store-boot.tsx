"use client";

import { useEffect } from "react";
import { STORAGE_KEY, UI_PREFS_KEY } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { Settings } from "@/lib/types";

function applyUiPrefs(settings: Settings) {
  const el = document.documentElement;
  if (settings.theme === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", settings.theme);
  el.style.setProperty("--font-scale", String(settings.fontScale));
  if (settings.motion === "reduce") el.setAttribute("data-motion", "reduce");
  else el.removeAttribute("data-motion");
  if (settings.contrast === "more") el.setAttribute("data-contrast", "more");
  else el.removeAttribute("data-contrast");
  try {
    localStorage.setItem(
      UI_PREFS_KEY,
      JSON.stringify({
        theme: settings.theme,
        fontScale: settings.fontScale,
        motion: settings.motion,
        contrast: settings.contrast,
      }),
    );
  } catch {
    /* preferences still apply for this visit */
  }
}

function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production") return;
  if (!("serviceWorker" in navigator)) return;
  const build = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
  navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(build)}`, { scope: "/" }).catch(() => {
    // Offline support is a bonus; the app works without it.
  });
}

/**
 * Loads the person's saved data after the first render, keeps display
 * preferences applied, keeps tabs in step, and turns on offline support.
 */
export function StoreBoot() {
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(useApp.persist.rehydrate()).then(() => {
      if (cancelled) return;
      useApp.getState().prune();
      applyUiPrefs(useApp.getState().data.settings);
    });

    const unsubscribe = useApp.subscribe((state, prev) => {
      if (!useApp.persist.hasHydrated()) return;
      if (state.data.settings !== prev.data.settings) applyUiPrefs(state.data.settings);
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) void useApp.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);

    registerServiceWorker();

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
