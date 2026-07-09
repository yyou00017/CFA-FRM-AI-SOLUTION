create table if not exists public.profiles (
  user_id uuid primary key,
  email text not null unique,
  plan text not null default 'free',
  credits_remaining integer not null default 20,
  monthly_credit_limit integer not null default 20,
  shopify_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_entitlements (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  plan text not null default 'core',
  credits integer not null default 300,
  status text not null default 'active',
  shopify_order_id text unique,
  shopify_customer_id text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_entitlements_email_status_idx
  on public.billing_entitlements (email, status, created_at desc);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  amount integer not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.billing_entitlements enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own usage" on public.usage_events;
create policy "Users can read own usage"
  on public.usage_events for select
  using (auth.uid() = user_id);
