"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { hasConsent } from "./consent";
import { useApp, useData, useHydrated } from "./store";
import { makeTx, type Tx } from "./terms";
import type { ConsentPurpose } from "./types";

/** Render copy in the person's own word for their speech. */
export function useTx(): Tx {
  const term = useData((d) => d.profile.term);
  return useMemo(() => makeTx(term), [term]);
}

export function useConsent(purpose: ConsentPurpose): boolean {
  const consents = useData((d) => d.consents);
  return useMemo(() => hasConsent(consents, purpose), [consents, purpose]);
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    mq.removeEventListener("change", cb);
    observer.disconnect();
  };
}

/** True when motion should be avoided, by system preference or our own setting. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () =>
      document.documentElement.getAttribute("data-motion") === "reduce" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** The current moment, refreshed on an interval. Avoids reading the clock during render. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** A stopwatch the person controls. Never counts down, never runs out. */
export function useStopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const started = Date.now() - elapsed * 1000;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
    // `elapsed` is only read when (re)starting, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const start = useCallback(() => setRunning(true), []);
  const stop = useCallback(() => setRunning(false), []);
  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
  }, []);
  return { running, elapsed, start, stop, reset };
}

export { useApp, useData, useHydrated };
