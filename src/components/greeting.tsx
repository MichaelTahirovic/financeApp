"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const QUIPS: Record<string, string[]> = {
  morning: [
    "Rise and shine, {name}. Let's make today balance.",
    "Good morning, {name}. Coffee's on the ledger.",
  ],
  lunch: [
    "Feeling peckish, {name}?",
    "Lunch o'clock, {name} — mind the food budget.",
  ],
  afternoon: [
    "Good afternoon, {name}. How are the books looking?",
    "Steady as she goes, {name}.",
  ],
  evening: [
    "Good evening, {name}. Time to tally up.",
    "Winding down, {name}? Let's close the books.",
  ],
  night: [
    "Burning the midnight oil, {name}?",
    "Late-night ledger check, {name}?",
  ],
};

function timeBlock(hour: number): keyof typeof QUIPS {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "lunch";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/**
 * Time-aware greeting with a rotating quip, personalised with the user's
 * nickname (falling back to their email prefix).
 */
export default function Greeting() {
  const [name, setName] = useState("there");
  const [block, setBlock] = useState<keyof typeof QUIPS>("morning");
  const [quipIndex, setQuipIndex] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const nickname = (user?.user_metadata?.nickname as string | undefined)?.trim();
      const fallback = user?.email?.split("@")[0] ?? "there";
      setName(nickname || fallback);
    });
    const update = () => setBlock(timeBlock(new Date().getHours()));
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(
      () => setQuipIndex((i) => i + 1),
      12_000
    );
    return () => clearInterval(interval);
  }, []);

  const greeting =
    block === "morning"
      ? "Good morning"
      : block === "lunch" || block === "afternoon"
        ? "Good afternoon"
        : block === "evening"
          ? "Good evening"
          : "Hello";

  const quips = QUIPS[block];
  const quip = quips[quipIndex % quips.length].replace("{name}", name);

  return (
    <div className="card p-5">
      <h1 className="ledger text-3xl font-semibold">
        {greeting}, {name}
      </h1>
      <p className="mt-1 text-sm text-muted">{quip}</p>
    </div>
  );
}
