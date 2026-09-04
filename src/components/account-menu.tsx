"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Account symbol that opens a dropdown: Preferences, Export, Sign Out.
 */
export default function AccountMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setNickname(((user?.user_metadata?.nickname as string | undefined) ?? "").trim());
    });
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      {nickname && <span className="text-sm font-medium">{nickname}</span>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account"
        aria-expanded={open}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-foreground"
      >
        {/* user symbol */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded border bg-background shadow-lg">
          <Link
            href="/preferences"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Preferences
          </Link>
          <Link
            href="/export"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Export
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
