"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/accounts", label: "Accounts" },
  { href: "/monthly-items", label: "Monthly Items" },
  { href: "/budgeting", label: "Budgeting" },
  { href: "/forecast", label: "Forecast" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide nav on auth pages
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) return null;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-10 border-b bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded px-3 py-1.5 text-sm ${
                  active
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <button onClick={handleSignOut} className="rounded border px-3 py-1 text-sm">
          Sign out
        </button>
      </div>
    </nav>
  );
}
