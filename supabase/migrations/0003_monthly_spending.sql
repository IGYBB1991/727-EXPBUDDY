-- Spending totals per month, category and owner, added up inside the
-- database so pages stay fast.
-- Debits count as spending and credits (refunds) reduce it. Only 'expense'
-- categories count; transfers and income don't. Uncategorized transactions
-- count (category_id is null). Split originals are skipped because their
-- pieces are counted instead.
-- Runs with the caller's permissions, so the security rules still apply.
create or replace function public.monthly_spending(p_from date, p_to date)
returns table (month text, category_id uuid, owner_id uuid, total numeric)
language sql
stable
set search_path = ''
as $$
  select
    to_char(t.date, 'YYYY-MM') as month,
    t.category_id,
    t.owner_id,
    sum(case when t.direction = 'debit' then t.amount else -t.amount end) as total
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.date between p_from and p_to
    and not t.is_split
    and coalesce(c.kind, 'expense') = 'expense'
  group by 1, 2, 3;
$$;

revoke execute on function public.monthly_spending(date, date) from anon, public;
grant execute on function public.monthly_spending(date, date) to authenticated;
