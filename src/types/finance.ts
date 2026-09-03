export type FlowAccountKind = "receivable" | "payable";

export interface FlowAccount {
  id: string;
  user_id: string;
  name: string;
  kind: FlowAccountKind;
  amount: number;
  is_annual_subscription: boolean;
  annual_amount: number | null;
  created_at: string;
}

export interface AccountHistory {
  id: string;
  user_id: string;
  account_id: string;
  month: string; // first day of month, YYYY-MM-DD
  amount: number;
  created_at: string;
}

export interface IncomeItem {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  is_recurring: boolean;
  created_at: string;
}

export interface IncomeHistory {
  id: string;
  user_id: string;
  income_id: string;
  month: string;
  amount: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  is_recurring: boolean;
  created_at: string;
}

export interface SubscriptionHistory {
  id: string;
  user_id: string;
  subscription_id: string;
  month: string;
  amount: number;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  name: string;
  monthly_limit: number;
  created_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  budget_id: string;
  amount: number;
  name: string | null;
  purchase_type: string | null;
  occurred_on: string;
  created_at: string;
}
