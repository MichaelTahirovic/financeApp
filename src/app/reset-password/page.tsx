"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthSplit from "@/components/auth-split";

/**
 * Set a new password after following a reset email link. Supabase delivers a
 * recovery session via /auth/callback, which redirects here.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }
    setDone(true);
    setSaving(false);
    setTimeout(() => router.push("/"), 1500);
  }

  return (
    <AuthSplit>
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      {done ? (
        <p className="mt-3 text-sm text-green-600">Password updated. Redirecting…</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input
            type="password"
            placeholder="New password (min 6 characters)"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border px-3 py-2"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="rounded border px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary px-3 py-2">
            {saving ? "Saving..." : "Update password"}
          </button>
        </form>
      )}
    </AuthSplit>
  );
}
