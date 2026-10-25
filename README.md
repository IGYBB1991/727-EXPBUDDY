# Household Expenses Tracker

A private web app for our household's spending. You upload bank and credit
card statements (CSV or PDF), Claude sorts each transaction into a category,
and a dashboard shows where the money goes each month, with Food first.

- Works on a phone and a computer. Each of you signs in with your own Google account.
- Only the Google accounts you list can get in.
- Statement files are read once and thrown away. Only the transactions are saved.
- For CSV statements and for sorting, Claude only sees each transaction's date,
  description and amount, with emails and long account or card numbers hidden.
  A **PDF** has to be read whole by Claude to find the transactions, so it does
  include your name and account number. Use CSV downloads if you'd rather avoid that.

Built with Next.js (the website), Supabase (the database and Google sign-in),
Claude (sorting transactions) and Vercel (hosting).

---

## What it can do

| Page | What it's for |
|---|---|
| **Dashboard** | Pick a month and whose spending (yours, your partner's, joint or everyone). See totals, Food at the top, a category chart, the last 6 or 12 months, budget bars (amber at 80%, red when over) and your top 10 merchants. |
| **Upload** | Drop in one or more statements. The app reads them, flags possible duplicates, and lets you check every row before saving. |
| **Transactions** | Search and filter, change a category, add notes, split one payment into several categories, add cash spending by hand, and export to CSV. |
| **Budgets** | Set a monthly amount per category, or copy last month's. |
| **Categories** | Add, rename, recolour, reorder or hide categories. |
| **Settings** | Your display names, accounts and cards, the merchant rules the app has learned, and upload history (deleting an upload removes its transactions). |

**It learns.** When you change a category, the app remembers it for that
merchant and offers to fix that merchant's other transactions too. Next time,
that merchant skips Claude entirely.

**Banks it knows** (CSV): DBS/POSB, OCBC, UOB, Citibank, Standard Chartered,
HSBC and Trust. Other CSV layouts and all PDFs are read with Claude's help.
Password-protected PDFs can't be read; save an unlocked copy first.

---

## Setting it up (about 45 minutes, once)

You'll create four free or cheap accounts and copy a few keys between them.
Keep a notes file open to paste values into as you go. **Never share or commit
those values**; they're like passwords.

### 1. Supabase (the database)

1. Go to [supabase.com](https://supabase.com), sign up, and click **New project**.
   Pick the **Singapore** region. Save the database password somewhere safe
   (the app doesn't need it, but you might one day).
2. When the project is ready, open **SQL Editor** in the left menu.
3. Open each file in this repo's `supabase/migrations` folder **in order**,
   copy all of its text into a new query, and click **Run**:
   1. `0001_init.sql` (creates the tables and the security rules)
   2. `0002_seed_categories.sql` (the starting categories)
   3. `0003_monthly_spending.sql` (monthly totals for the dashboard)
   4. `0004_dashboard.sql` (top merchants)

   Each should say "Success. No rows returned".
4. Open **Project Settings → API Keys** (sometimes shown under **Connect**) and copy:
   - the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - the **publishable** key (older projects: "anon public") → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - the **secret** key (older projects: "service_role") → `SUPABASE_SECRET_KEY`.
     This one can read and change everything, so it only ever goes into Vercel.
5. Open **Authentication → Sign In / Providers** and turn **Email** off. You'll
   only sign in with Google.

### 2. Google sign-in

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project
   (any name, e.g. "Household expenses").
2. Open **APIs & Services → OAuth consent screen** (or **Google Auth Platform**).
   Choose **External**, fill in the app name and your email, and save.
   Under **Audience / Test users**, add both of your Gmail addresses.
3. Open **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
     (your Supabase Project URL plus `/auth/v1/callback`)
4. Copy the **Client ID** and **Client secret**.
5. Back in Supabase, open **Authentication → Sign In / Providers → Google**,
   turn it on, paste the Client ID and secret, and save.

### 3. Claude API key

1. Go to [console.anthropic.com](https://console.anthropic.com), sign up and add a
   little credit (US$5 goes a long way; a month of statements usually costs cents).
2. Open **API Keys → Create Key** and copy it → `ANTHROPIC_API_KEY`.
3. Optional: set a monthly spend limit under **Limits**.

`CLAUDE_MODEL` is optional. It defaults to `claude-haiku-5-5`, which is fast and
cheap. If categories often look wrong, try `claude-sonnet-5-5`.

### 4. Vercel (hosting)

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account.
2. Click **Add New → Project** and import `727-EXPBUDDY`.
3. Before clicking Deploy, open **Environment Variables** and add each of these:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from step 1 |
   | `SUPABASE_SECRET_KEY` | from step 1 |
   | `ALLOWED_EMAILS` | your two Gmail addresses, separated by a comma |
   | `ANTHROPIC_API_KEY` | from step 3 |
   | `CLAUDE_MODEL` | optional, leave out for the default |

4. Click **Deploy**. When it finishes, copy your site's address, e.g.
   `https://727-expbuddy.vercel.app`.

### 5. Tell Supabase your site's address

In Supabase, open **Authentication → URL Configuration**:

- **Site URL**: your Vercel address
- **Redirect URLs**: add `https://YOUR-SITE.vercel.app/auth/callback`
  (and `http://localhost:3000/auth/callback` if you'll run it on your computer)

### 6. First sign-in

Open your site and click **Sign in with Google**. Then have your partner do
the same on their phone. Each of you can change how your name appears under
**Settings**. Add the site to your phone's home screen for an app-like icon.

---

## Everyday use

1. Download last month's statements from your bank's website (CSV is best;
   PDF works too). Keep each file under 4 MB.
2. Open **Upload**, choose whose statement it is and the account name, and add the files.
3. Check the review screen. Rows marked **Please check** are ones Claude wasn't
   sure about. Rows marked **Likely duplicate** are unticked so they won't be
   saved twice. Click **Save**.
4. Look at the **Dashboard**, and set **Budgets** if you like.

---

## If something goes wrong

| What you see | What to try |
|---|---|
| "That Google account isn't on this household's list" | Check the spelling in `ALLOWED_EMAILS` in Vercel, then **Redeploy**. |
| Google says "redirect_uri_mismatch" | The redirect URI in Google must be the **Supabase** address ending in `/auth/v1/callback`. |
| After Google you land back on the login page | Check Supabase **URL Configuration** has your site's `/auth/callback` address. |
| "Claude couldn't suggest categories" | Check the Anthropic key and credit. The transactions still save; pick categories yourself. |
| A PDF won't read | Remove the password, or download the CSV version instead. |
| You changed a setting in Vercel and nothing happened | Settings only apply after a new deploy: **Deployments → … → Redeploy**. |

---

## For developers

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run typecheck
npm run lint
npm run build
```

Database tests run against a local Postgres when `TEST_DATABASE_URL` is set,
for example `TEST_DATABASE_URL=postgresql://postgres@localhost:5432/postgres npm test`.
They load a small stand-in for Supabase's auth schema (`tests/db/supabase-stub.sql`)
and then the real migrations.

Where things live:

- `app/` pages and API routes. `app/(app)/` is everything behind sign-in.
- `lib/parsers/` the CSV bank layouts and PDF checks. `lib/categorize.ts` and
  `lib/ai-tasks.ts` the Claude calls. `lib/privacy.ts` hides private details first.
- `lib/db/` database reads and writes. Security is enforced in the database
  with Row Level Security: only signed-in household members can see any row.
- `supabase/migrations/` the database setup, run in order.

New database changes go in a new numbered file in `supabase/migrations`; run it
in the Supabase SQL Editor after merging.
