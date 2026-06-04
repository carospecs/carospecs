# PartSnap — Step 1 Setup (Supabase)

Schema, storage, and auth config for Phase 1. Apply this before building the app.

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard → **New project**.
2. Name it `partsnap` (or whatever you like), pick a region close to your users, set a strong DB password (save it).
3. Wait for provisioning (~2 min).

## 2. Grab your keys

Dashboard → **Project Settings → API**. Copy `.env.example` to `.env.local` and fill it in
(never commit `.env.local`). The Next.js app uses `NEXT_PUBLIC_`-prefixed names for the two
browser-exposed values:

```
NEXT_PUBLIC_SUPABASE_URL=        # Project URL        (spec: SUPABASE_URL)
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # anon public key    (spec: SUPABASE_ANON_KEY)
SUPABASE_SERVICE_ROLE_KEY=       # service_role key — SERVER ONLY, never ship to browser
OPENAI_API_KEY=                  # Step 3 (GPT-4o Vision)
ADMIN_EMAIL=                     # Step 6 (API-error alerts)
```

## 3. Apply the schema

**Option A — SQL Editor (fastest):**
Dashboard → **SQL Editor** → paste the contents of `migrations/0001_init.sql` → Run.

**Option B — Supabase CLI (version-controlled):**
```bash
brew install supabase/tap/supabase   # if not installed
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

This creates: `shops`, `listings` tables, RLS policies, the `updated_at` trigger,
and the private `part-photos` storage bucket with per-owner access policies.

## 4. Configure auth (Email + Google)

Apple sign-in is deferred — add later.

**Dashboard → Authentication → Providers**
- **Email**: enable. For dev, consider turning "Confirm email" OFF for faster onboarding; turn ON for prod.
- **Google**: enable. Needs a Google Cloud OAuth client:
  1. https://console.cloud.google.com → APIs & Services → Credentials → Create OAuth client ID (Web).
  2. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
  3. Paste the Client ID + Client Secret into the Supabase Google provider.

**Dashboard → Authentication → URL Configuration**
- Site URL: `http://localhost:3000` (dev) → your Vercel domain (prod)
- Redirect URLs: add both the localhost and Vercel URLs.

## 5. Verify

In SQL Editor:
```sql
select table_name from information_schema.tables
  where table_schema = 'public' order by 1;   -- expect: listings, shops
select id, public from storage.buckets where id = 'part-photos';  -- expect: part-photos, false
```

Then create a test user (Authentication → Users → Add user) and confirm sign-in works.

---

Next step (CLAUDE.md order): **2. Auth flow** — sign in / sign up / shop profile creation.
