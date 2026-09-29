-- Raritone v1 — Postgres + Storage schema.
--
-- Mirrors shared/types.ts; keep the two in step.
-- Apply with:  supabase db push   (or paste into the SQL editor)
--
-- Design notes that matter for privacy:
--   * Every table is keyed by user_id and guarded with row level security, so a
--     leaked anon key still cannot read another person's wardrobe.
--   * Media lives in a *private* bucket. Nothing is world-readable; the server
--     hands out short-lived signed URLs only.
--   * Guests are real rows (auth.users + public.profiles) with no password. A
--     device id maps to one guest, so "delete everything" is a hard delete.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type garment_category as enum
    ('tops','jackets','outerwear','bottoms','dresses','accessories','shoes');
exception when duplicate_object then null; end $$;

do $$ begin
  create type quality_state as enum ('ready','experimental','needs_review','unsupported');
exception when duplicate_object then null; end $$;

do $$ begin
  create type item_source as enum ('sample','upload','camera_photo','link');
exception when duplicate_object then null; end $$;

do $$ begin
  create type look_kind as enum ('photo','live');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tryon_status as enum ('queued','generating','ready','failed','expired');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  device_id     text unique not null,
  display_name  text,
  handle        text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'One row per account. Guests have no password; device_id is the guest credential.';

create table if not exists public.items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  image_path     text not null,
  category       garment_category not null default 'tops',
  source         item_source not null default 'upload',
  quality_state  quality_state not null default 'ready',
  is_favorite    boolean not null default false,
  source_url     text,
  source_label   text,
  -- Denormalised so the carousel can order by recency without a join.
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists items_user_created_idx
  on public.items (user_id, created_at desc);

create table if not exists public.looks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  image_path    text not null,
  -- Kept as a plain text id, not a foreign key: the PRD requires a saved look to
  -- survive the deletion of the garment it was worn with.
  item_id       text,
  item_name     text,
  kind          look_kind not null default 'photo',
  ai_label      text not null default 'AI try-on',
  is_favorite   boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists looks_user_created_idx
  on public.looks (user_id, created_at desc);

create table if not exists public.shares (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  look_id     uuid not null references public.looks (id) on delete cascade,
  token       text not null unique,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists shares_token_idx on public.shares (token);

-- Live sessions are short-lived by design (FR-106) and are not user-visible
-- history, so they cascade with the account and expire on their own.
create table if not exists public.live_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  item_id       text not null,
  provider_job  text,
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  ended_at      timestamptz
);

create index if not exists live_sessions_user_idx on public.live_sessions (user_id);

-- One row per account per calendar day, so weekly and streak counts are a
-- single indexed aggregate rather than a scan over try-on history.
create table if not exists public.usage_daily (
  user_id           uuid not null references public.profiles (id) on delete cascade,
  day               date not null,
  photo_used        smallint not null default 0,
  live_seconds      integer not null default 0,
  primary key (user_id, day)
);

-- Guard against a retried request charging a guest twice (FR-401 / no-surprise
-- billing). The client mints the token; the server keys the job on it.
create table if not exists public.tryon_jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  client_token   text not null,
  item_id        text not null,
  kind           look_kind not null,
  status         tryon_status not null default 'queued',
  result_path    text,
  error_category text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, client_token)
);

create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  look_id     uuid not null references public.looks (id) on delete cascade,
  caption     text check (char_length(caption) <= 120),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- Stories are a later release. The table exists so the feature flag has
-- somewhere to land, but nothing reads it while FLAG_STORIES is false.
create index if not exists stories_user_created_idx
  on public.stories (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
--
-- The server uses the service role and bypasses RLS. The anon key is never used
-- for data access, so these policies are a second line of defence: if a key ever
-- leaks, the attacker still cannot read another guest's wardrobe.
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.items        enable row level security;
alter table public.looks        enable row level security;
alter table public.shares       enable row level security;
alter table public.live_sessions enable row level security;
alter table public.usage_daily  enable row level security;
alter table public.tryon_jobs   enable row level security;
alter table public.stories      enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','items','looks','shares','live_sessions','usage_daily','tryon_jobs','stories'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format(
      'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_own', t
    );
  end loop;

  -- profiles is keyed by id, not user_id.
  drop policy if exists profiles_own on public.profiles;
  create policy profiles_own on public.profiles
    for all using (auth.uid() = id) with check (auth.uid() = id);
end $$;

-- ---------------------------------------------------------------------------
-- Storage
--
-- One private bucket. The service role signs short-lived URLs; the client never
-- receives a permanent object address.
-- ---------------------------------------------------------------------------

-- Two private buckets, matching the SUPABASE_BUCKET_* defaults in server/env.ts.
-- Garments and captured output live apart so a garment can be deleted without
-- touching saved looks.
insert into storage.buckets (id, name, public)
values ('garments', 'garments', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Paths are "<user id>/<kind>/<file>", so the object name itself carries the
-- ownership check and a mis-scoped query returns nothing.
do $$
declare
  b text;
begin
  foreach b in array array['garments','media'] loop
    execute format('drop policy if exists media_read on storage.objects');
    execute format('drop policy if exists media_write on storage.objects');
    execute format('drop policy if exists media_delete on storage.objects');

    execute format(
      'create policy media_read on storage.objects for select
         using (bucket_id = %L and auth.uid()::text = (storage.foldername(name))[1])',
      b
    );
    execute format(
      'create policy media_write on storage.objects for insert
         with check (bucket_id = %L and auth.uid()::text = (storage.foldername(name))[1])',
      b
    );
    execute format(
      'create policy media_delete on storage.objects for delete
         using (bucket_id = %L and auth.uid()::text = (storage.foldername(name))[1])',
      b
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

create or replace function public.purge_expired_stories() returns integer
language plpgsql security definer set search_path = public as $$
declare
  removed integer;
begin
  delete from public.stories where expires_at <= now();
  get diagnostics removed = row_count;
  return removed;
end $$;
