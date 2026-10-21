import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureMonthlyRollover } from "@/lib/finance/rollover-server";

/**
 * Idempotent month-rollover: ensures completed months have their closing
 * balances and amounts archived into `account_history`, `income_history`,
 * `subscription_history`, and `monthly_snapshots`, while advancing annual
 * subscription accruals, resetting one-off monthly items, and re-resolving
 * percentage budgets.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { force?: boolean; targetCompletedMonth?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body on standard rollover calls.
  }

  const result = await ensureMonthlyRollover(supabase, user, {
    force: body.force,
    targetCompletedMonth: body.targetCompletedMonth,
  });

  return NextResponse.json(result);
}
