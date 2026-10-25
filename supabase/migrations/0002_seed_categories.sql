-- Starting category list. You can change all of these in the app later.
insert into public.categories (name, group_name, color, kind, sort_order) values
  ('Groceries',            'Food', '#16a34a', 'expense',  10),
  ('Dining out',           'Food', '#f97316', 'expense',  20),
  ('Food delivery',        'Food', '#e11d48', 'expense',  30),
  ('Transport',            null,   '#2563eb', 'expense',  40),
  ('Utilities and bills',  null,   '#0891b2', 'expense',  50),
  ('Housing',              null,   '#7c3aed', 'expense',  60),
  ('Shopping',             null,   '#db2777', 'expense',  70),
  ('Health',               null,   '#059669', 'expense',  80),
  ('Entertainment',        null,   '#ca8a04', 'expense',  90),
  ('Travel',               null,   '#0284c7', 'expense', 100),
  ('Subscriptions',        null,   '#9333ea', 'expense', 110),
  ('Family and kids',      null,   '#ea580c', 'expense', 120),
  ('Other',                null,   '#64748b', 'expense', 130),
  ('Transfers',            null,   '#94a3b8', 'transfer', 140),
  ('Income',               null,   '#22c55e', 'income',  150)
on conflict (name) do nothing;
