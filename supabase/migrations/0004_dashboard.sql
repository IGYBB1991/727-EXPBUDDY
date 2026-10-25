-- Spending per merchant for the dashboard's "top merchants" list, per owner
-- so the Mine / Joint / All filter works. Same counting rules as
-- monthly_spending.
create or replace function public.merchant_spending(p_from date, p_to date)
returns table (merchant text, owner_id uuid, total numeric, transaction_count bigint)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(nullif(t.merchant, ''), t.description) as merchant,
    t.owner_id,
    sum(case when t.direction = 'debit' then t.amount else -t.amount end) as total,
    count(*) as transaction_count
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.date between p_from and p_to
    and not t.is_split
    and coalesce(c.kind, 'expense') = 'expense'
  group by 1, 2;
$$;

revoke execute on function public.merchant_spending(date, date) from anon, public;
grant execute on function public.merchant_spending(date, date) to authenticated;
