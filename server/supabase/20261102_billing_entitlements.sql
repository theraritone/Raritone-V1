-- Raritone billing entitlements and receipt audit trail.
-- Apply after schema.sql. Store receipt payloads only when policy permits;
-- production should prefer encrypted provider references over raw receipts.

create table if not exists public.entitlements (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  plan_id       text not null check (plan_id in ('free', 'pro', 'vip')),
  active        boolean not null default true,
  renews_at     timestamptz,
  source        text not null check (source in ('none', 'apple', 'google', 'server')),
  updated_at    timestamptz not null default now()
);

create table if not exists public.store_transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  platform       text not null check (platform in ('apple', 'google')),
  product_id     text not null,
  transaction_id text not null,
  receipt_hash   text not null,
  verified       boolean not null default false,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique (platform, transaction_id)
);

create index if not exists store_transactions_user_idx
  on public.store_transactions (user_id, created_at desc);

alter table public.entitlements enable row level security;
alter table public.store_transactions enable row level security;

drop policy if exists entitlements_own on public.entitlements;
create policy entitlements_own on public.entitlements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists store_transactions_own on public.store_transactions;
create policy store_transactions_own on public.store_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
