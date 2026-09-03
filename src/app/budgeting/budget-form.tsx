"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function BudgetForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("budgets").insert({
      user_id: user?.id,
      name,
      monthly_limit: Number(limit),
    });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setLimit("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Budget name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 rounded border px-2 py-1 text-sm"
      />
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="Monthly limit"
        required
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        className="w-32 rounded border px-2 py-1 text-sm"
      />
      <button
        type="submit"
        disabled={saving}
        className="btn-primary px-3 py-1.5 text-sm"
      >
        {saving ? "Saving..." : "Add Budget"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
