"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, initThemeListener } from "@/lib/theme";
import { createClient } from "@/lib/supabase/client";

type ThemeMode = "light" | "dark" | "auto";

const OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Always use the light theme." },
  { value: "dark", label: "Dark", description: "Always use the dark theme." },
  { value: "auto", label: "Auto (System)", description: "Follow your device's appearance setting." },
];

export default function PreferencesPage() {
  const [mode, setMode] = useState<ThemeMode>("auto");
  const [nickname, setNickname] = useState("");
  const [nicknameSaved, setNicknameSaved] = useState(false);

  useEffect(() => {
    setMode(getStoredTheme());
    initThemeListener();
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setNickname(((user?.user_metadata?.nickname as string | undefined) ?? "").trim());
    });
  }, []);

  function choose(value: ThemeMode) {
    setMode(value);
    applyTheme(value);
  }

  async function saveNickname() {
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { nickname: nickname.trim() } });
    setNicknameSaved(true);
    setTimeout(() => setNicknameSaved(false), 2000);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Preferences</h1>

      <section className="card">
        <h2 className="border-b border-line px-4 py-2 text-lg font-medium">Profile</h2>
        <div className="flex flex-col gap-2 p-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="w-24 text-muted">Nickname</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="What should we call you?"
              className="min-w-0 flex-1 rounded border px-2 py-1.5"
            />
            <button onClick={saveNickname} className="btn-primary px-3 py-1.5 text-sm">
              Save
            </button>
          </label>
          {nicknameSaved && <p className="text-xs text-green-600">Saved.</p>}
          <p className="text-xs text-muted">
            Used in the home greeting and shown next to the account icon.
          </p>
        </div>
      </section>

      <section className="card">
        <h2 className="border-b border-line px-4 py-2 text-lg font-medium">Theme</h2>
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
