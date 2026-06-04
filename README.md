# PartSnap

Photo → listing tool for salvage yards. An employee photographs a part, GPT-4o Vision
identifies it (name, category, compatible makes, year range, condition, suggested price),
and PartSnap pre-fills a listing card the employee reviews, corrects, and saves.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19
- **Supabase** — Postgres, Auth (email + Google OAuth), Storage (`part-photos` bucket)
- **OpenAI GPT-4o Vision** — part identification
- **Tailwind CSS v4**

## Architecture

| Path | Purpose |
|------|---------|
| `app/login` | Email/password + Google OAuth sign-in |
| `app/onboarding` | Create a shop (via the `create_shop` RPC) |
| `app/dashboard` | Shop home; entry point to list a part |
| `app/list` | Capture/upload a photo → identify → review → save |
| `app/api/identify` | Auth-gated route: downloads the photo, calls GPT-4o, returns structured output |
| `lib/identify.ts` | GPT-4o Vision call + canonical prompt |
| `lib/supabase/` | Browser, server, and proxy Supabase clients |
| `proxy.ts` | Session refresh + auth redirects (Next 16 renamed Middleware → Proxy) |

The database uses a **multi-member model**: a `shops` table, a `shop_members` join table
(roles: owner/editor/viewer), and `listings`. Shop creation goes through the
`create_shop()` SECURITY DEFINER function; row access is gated by the `is_shop_member()`
helper in RLS policies.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

### Environment variables

| Var | Where it's used |
|-----|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/server Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin operations (never exposed) |
| `OPENAI_API_KEY` | GPT-4o Vision (`/api/identify`) |
| `ADMIN_EMAIL` | API-error alerts (planned) |

`.env.local` is gitignored — never commit real keys.

## Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```
