-- Starting category list. You can change all of these in the app later.
-- The first eight colors are a set chosen to stay easy to tell apart,
-- including for colorblind readers.
insert into public.categories (name, group_name, color, kind, sort_order) values
  ('Groceries',            'Food', '#2a78d6', 'expense',  10),
  ('Dining out',           'Food', '#eb6834', 'expense',  20),
  ('Food delivery',        'Food', '#1baf7a', 'expense',  30),
  ('Transport',            null,   '#eda100', 'expense',  40),
  ('Utilities and bills',  null,   '#e87ba4', 'expense',  50),
  ('Housing',              null,   '#008300', 'expense',  60),
  ('Shopping',             null,   '#6250d6', 'expense',  70),
  ('Health',               null,   '#e34948', 'expense',  80),
  ('Entertainment',        null,   '#b45309', 'expense',  90),
  ('Travel',               null,   '#0e7490', 'expense', 100),
  ('Subscriptions',        null,   '#7c6f64', 'expense', 110),
  ('Family and kids',      null,   '#be185d', 'expense', 120),
  ('Other',                null,   '#94a3b8', 'expense', 130),
  ('Transfers',            null,   '#cbd5e1', 'transfer', 140),
  ('Income',               null,   '#16a34a', 'income',  150)
on conflict (name) do nothing;
