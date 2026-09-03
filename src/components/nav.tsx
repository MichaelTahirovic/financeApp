"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountMenu from "./account-menu";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/accounts", label: "Accounts" },
  { href: "/monthly-items", label: "Monthly Items" },
  { href: "/budgeting", label: "Budgeting" },
  { href: "/forecast", label: "Forecast (Beta)" },
];

export default function Nav() {
  const pathname = usePathname();

  // Hide nav on auth pages
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) return null;

  return (
    <nav className="no-print sticky top-0 z-10 border-b bg-background">
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
        <AccountMenu />
      </div>
    </nav>
  );
}
