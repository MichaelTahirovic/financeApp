"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { currentMonth } from "@/lib/finance/calculations";

/**
 * On app load (and when returning to the tab in a new month), ask the server to
 * roll over completed months if needed. Refreshes the current route whenever
 * new rollover records are written.
 */
export default function Rollover() {
  const router = useRouter();

  useEffect(() => {
    async function checkRollover() {
      const now = currentMonth();
      if (sessionStorage.getItem("rollover-checked-month") === now) return;
      sessionStorage.setItem("rollover-checked-month", now);
      try {
        const res = await fetch("/api/rollover", { method: "POST" });
        if (!res.ok) return;
        const data = (await res.json()) as { archived?: boolean };
        if (data.archived) {
          router.refresh();
        }
      } catch {
        // Ignore network errors on background rollover check.
      }
    }

    checkRollover();
    window.addEventListener("focus", checkRollover);
    return () => window.removeEventListener("focus", checkRollover);
  }, [router]);

  return null;
}
