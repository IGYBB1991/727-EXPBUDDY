-- Household Expenses Tracker: tables and security rules.
-- Run this once in the Supabase SQL Editor (the README shows how).

-- ---------------------------------------------------------------------------
-- Members: the people allowed to use the app (the two of you).
-- Rows are added by the app the first time an allowed email signs in.
-- ---------------------------------------------------------------------------
create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- True when the person calling the database is one of the household members.
-- "security definer" lets it look at the members table without tripping over
-- that table's own security rule.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m where m.user_id = (select auth.uid())
  );
$$;

-- The members row of whoever is calling, or null.
create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.members m where m.user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Categories
-- kind: 'expense' counts as spending; 'transfer' and 'income' do not.
-- group_name: categories with the same group roll up together (e.g. Food).
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  group_name text,
  color text not null default '#64748b',
  kind text not null default 'expense' check (kind in ('expense', 'transfer', 'income')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Accounts and cards
-- owner_id null means a joint account.
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  bank text,
  owner_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Budgets: one amount per category per month (month is 'YYYY-MM').
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category_id uuid not null references public.categories (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  unique (month, category_id)
);

-- ---------------------------------------------------------------------------
-- Merchant rules: "this merchant always goes in this category".
-- merchant_pattern is stored in lower case.
-- ---------------------------------------------------------------------------
create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  merchant_pattern text not null unique check (merchant_pattern = lower(merchant_pattern)),
  category_id uuid not null references public.categories (id) on delete cascade,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Uploads: one row per statement file that was imported.
-- The file itself is never stored.
-- ---------------------------------------------------------------------------
create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  bank text,
  uploaded_by uuid references public.members (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  transaction_count integer not null default 0,
  period_start date,
  period_end date
);

-- ---------------------------------------------------------------------------
-- Transactions
-- amount is always positive; direction says whether money went out (debit)
-- or came in (credit).
-- owner_id null means joint.
-- A split transaction keeps its original row (is_split = true, left out of
-- totals) and gets child rows that point back to it with split_parent_id.
-- Deleting an upload deletes the transactions that came from it.
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  merchant text,
  amount numeric(12, 2) not null check (amount >= 0),
  direction text not null check (direction in ('debit', 'credit')),
  category_id uuid references public.categories (id) on delete set null,
  owner_id uuid references public.members (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  source_file text,
  ai_confidence numeric(3, 2) check (ai_confidence between 0 and 1),
  needs_review boolean not null default false,
  notes text,
  upload_id uuid references public.uploads (id) on delete cascade,
  split_parent_id uuid references public.transactions (id) on delete cascade,
  is_split boolean not null default false,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index transactions_date_idx on public.transactions (date);
create index transactions_category_idx on public.transactions (category_id);
create index transactions_upload_idx on public.transactions (upload_id);
create index transactions_split_parent_idx on public.transactions (split_parent_id);
create index transactions_needs_review_idx on public.transactions (needs_review) where needs_review;

-- ---------------------------------------------------------------------------
-- Security rules (Row Level Security)
-- Only household members can see or change anything. Everyone else, even
-- someone with a valid Supabase login, gets nothing back.
-- ---------------------------------------------------------------------------
alter table public.members enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.budgets enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.uploads enable row level security;
alter table public.transactions enable row level security;

-- Members can see both members and change display names. New members are
-- only ever added by the app's server with the secret key.
create policy "members can read members" on public.members
  for select to authenticated using (public.is_member());
create policy "members can update members" on public.members
  for update to authenticated using (public.is_member()) with check (public.is_member());

create policy "members only" on public.categories
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "members only" on public.accounts
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "members only" on public.budgets
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "members only" on public.merchant_rules
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "members only" on public.uploads
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "members only" on public.transactions
  for all to authenticated using (public.is_member()) with check (public.is_member());

-- Logged-out visitors get no access at all; logged-in users still pass the
-- rules above.
revoke all on all tables in schema public from anon;
revoke execute on function public.is_member() from anon, public;
revoke execute on function public.current_member_id() from anon, public;
grant execute on function public.is_member() to authenticated;
grant execute on function public.current_member_id() to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
