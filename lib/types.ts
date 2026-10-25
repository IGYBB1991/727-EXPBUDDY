// Shapes of the rows stored in the database.

export type Member = {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
};

export type CategoryKind = "expense" | "transfer" | "income";

export type Category = {
  id: string;
  name: string;
  group_name: string | null;
  color: string;
  kind: CategoryKind;
  is_active: boolean;
  sort_order: number;
};

export type Account = {
  id: string;
  name: string;
  bank: string | null;
  owner_id: string | null;
};

export type Budget = {
  id: string;
  month: string;
  category_id: string;
  amount: number;
};

export type MerchantRule = {
  id: string;
  merchant_pattern: string;
  category_id: string;
  created_by: string | null;
  created_at: string;
};

export type Upload = {
  id: string;
  file_name: string;
  bank: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  transaction_count: number;
  period_start: string | null;
  period_end: string | null;
};

export type Direction = "debit" | "credit";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;
  direction: Direction;
  category_id: string | null;
  owner_id: string | null;
  account_id: string | null;
  source_file: string | null;
  ai_confidence: number | null;
  needs_review: boolean;
  notes: string | null;
  upload_id: string | null;
  split_parent_id: string | null;
  is_split: boolean;
  created_by: string | null;
  created_at: string;
};
