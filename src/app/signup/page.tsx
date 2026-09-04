"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthSplit from "@/components/auth-split";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { nickname: nickname.trim() || undefined },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <AuthSplit>
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="mt-2">We sent you a confirmation link. Click it to finish creating your account.</p>
        </div>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit>
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <input
          type="text"
          placeholder="Nickname (optional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="password"
          placeholder="Password (min 6 characters)"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary px-3 py-2"
        >
          {loading ? "Signing up..." : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </AuthSplit>
  );
}
