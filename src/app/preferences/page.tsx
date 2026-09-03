"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, initThemeListener } from "@/lib/theme";

type ThemeMode = "light" | "dark" | "auto";

const OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Always use the light theme." },
  { value: "dark", label: "Dark", description: "Always use the dark theme." },
  { value: "auto", label: "Auto (System)", description: "Follow your device's appearance setting." },
];

export default function PreferencesPage() {
  const [mode, setMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    setMode(getStoredTheme());
    initThemeListener();
  }, []);

  function choose(value: ThemeMode) {
    setMode(value);
    applyTheme(value);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Preferences</h1>

      <section className="rounded border">
        <h2 className="border-b px-4 py-2 text-lg font-medium">Theme</h2>
        <div className="flex flex-col gap-2 p-4">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded border p-3 ${
                mode === opt.value ? "border-black dark:border-white" : ""
              }`}
            >
              <input
                type="radio"
                name="theme"
                checked={mode === opt.value}
                onChange={() => choose(opt.value)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{opt.label}</span>
                <span className="block text-sm text-gray-500">{opt.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </main>
  );
}
