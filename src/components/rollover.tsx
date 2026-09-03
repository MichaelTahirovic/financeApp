"use client";

import { useEffect } from "react";

/**
 * On app load, ask the server to archive the previous month if it hasn't been
 * yet. Idempotent and only runs once per session.
 */
export default function Rollover() {
  useEffect(() => {
    if (sessionStorage.getItem("rollover-checked")) return;
    sessionStorage.setItem("rollover-checked", "1");
    fetch("/api/rollover", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
