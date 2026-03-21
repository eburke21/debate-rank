import { useCallback, useEffect, useState } from "react";

type Appearance = "light" | "dark";

const STORAGE_KEY = "debaterank-color-mode";

function getSystemPreference(): Appearance {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialAppearance(): Appearance {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return getSystemPreference();
}

export function useColorMode() {
  const [appearance, setAppearance] = useState<Appearance>(
    getInitialAppearance,
  );

  // Sync to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, appearance);
  }, [appearance]);

  // Listen for system preference changes (only when no manual override stored)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setAppearance(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleColorMode = useCallback(() => {
    setAppearance((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return { appearance, toggleColorMode };
}
