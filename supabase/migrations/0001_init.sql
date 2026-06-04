-- ============================================================
-- PartSnap Phase 1 — initial schema
-- Tables: shops, listings  (+ RLS, indexes, updated_at trigger)
-- Storage: part-photos (private) + per-owner access policies
-- ============================================================

-- gen_random_uuid() comes from pgcrypto (preinstalled on Supabase)
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- shops
-- ------------------------------------------------------------
create table public.shops (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  location        text,
  business_number text,
  owner_id        uuid not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),

  -- Phase 1: "Single account per shop." One shop per owner.
  constraint shops_owner_unique unique (owner_id)
);

-- ------------------------------------------------------------
-- listings
-- ------------------------------------------------------------
create table public.listings (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops (id) on delete cascade,
  photo_url        text,
  ai_output        jsonb,
  corrected_output jsonb,
  status           text not null default 'draft'
                     check (status in ('draft', 'active', 'sold')),
  marketplace_url  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index listings_shop_id_idx    on public.listings (shop_id);
create index listings_created_at_idx on public.listings (created_at desc);

-- ------------------------------------------------------------
-- updated_at trigger
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_set_updated_at
  before update on public.listings
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- A user may only touch their own shop and its listings.
-- (The server-side service-role key bypasses RLS for the
--  GPT-4o write flow.)
-- ============================================================
alter table public.shops    enable row level security;
alter table public.listings enable row level security;

-- shops: owner can do everything with their own shop
create policy "shops_owner_all"
  on public.shops
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- listings: accessible only if they belong to a shop the user owns
create policy "listings_owner_all"
  on public.listings
  for all
  using (
    exists (
      select 1 from public.shops s
      where s.id = listings.shop_id
        and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shops s
      where s.id = listings.shop_id
        and s.owner_id = auth.uid()
    )
  );

-- ============================================================
-- Storage: private bucket for part photos
-- Path convention: {auth.uid()}/{filename}
-- ============================================================
insert into storage.buckets (id, name, public)
values ('part-photos', 'part-photos', false)
on conflict (id) do nothing;

create policy "part_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'part-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "part_photos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'part-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "part_photos_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'part-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "part_photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'part-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
