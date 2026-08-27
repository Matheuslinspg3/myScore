-- myScore initial schema
-- Values are stored as integer cents to avoid floating-point arithmetic.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  privacy_mode boolean not null default false,
  include_confirmed_receivables_in_safe_balance boolean not null default false,
  emergency_reserve_cents bigint not null default 0 check (emergency_reserve_cents >= 0),
  default_projection_days integer not null default 30 check (default_projection_days in (7, 15, 30, 60, 90, 180, 365)),
  ai_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('pluggy', 'ofx', 'csv', 'manual')),
  external_id text not null,
  name text not null,
  logo_url text,
  primary_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider, external_id)
);

create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  provider text not null check (provider in ('pluggy', 'ofx', 'csv', 'manual')),
  external_item_id text not null,
  status text not null default 'created',
  last_synced_at timestamptz,
  last_error_code text,
  consent_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider, external_item_id)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.bank_connections(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  provider_account_id text,
  name text not null,
  account_type text not null check (account_type in ('checking', 'savings', 'payment', 'credit', 'investment', 'cash', 'other')),
  subtype text,
  masked_number text,
  balance_cents bigint not null default 0,
  available_balance_cents bigint,
  currency_code char(3) not null default 'BRL',
  is_active boolean not null default true,
  include_in_safe_balance boolean not null default true,
  last_synced_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A regular unique constraint permits multiple NULL values in PostgreSQL and
-- can be targeted by PostgREST's ON CONFLICT used by the Pluggy sync.
alter table public.accounts
  add constraint accounts_owner_provider_id_key
  unique (owner_id, provider_account_id);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider_card_id text,
  name text not null,
  brand text,
  last_four text,
  total_limit_cents bigint,
  available_limit_cents bigint,
  invoice_cents bigint not null default 0,
  closing_date date,
  due_date date,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.credit_cards
  add constraint credit_cards_owner_provider_id_key
  unique (owner_id, provider_card_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  icon text,
  color text,
  archived boolean not null default false,
  system_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, system_key)
);

create index categories_owner_parent_idx on public.categories(owner_id, parent_id);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  nickname text,
  phone text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index people_owner_name_idx on public.people(owner_id, name);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  credit_card_id uuid references public.credit_cards(id) on delete set null,
  source text not null check (source in ('pluggy', 'ofx', 'csv', 'manual')),
  external_id text,
  dedupe_key text not null,
  description text not null,
  raw_description text,
  merchant_name text,
  merchant_document text,
  amount_cents bigint not null,
  balance_after_cents bigint,
  currency_code char(3) not null default 'BRL',
  transaction_type text not null check (transaction_type in ('credit', 'debit')),
  status text not null default 'posted' check (status in ('posted', 'pending', 'removed')),
  booked_at timestamptz not null,
  provider_category text,
  provider_category_id text,
  provider_code text,
  provider_id text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index transactions_external_id_uidx
  on public.transactions(owner_id, source, external_id)
  where external_id is not null;

create unique index transactions_dedupe_uidx
  on public.transactions(owner_id, account_id, dedupe_key);

create index transactions_owner_date_idx
  on public.transactions(owner_id, booked_at desc);
create index transactions_account_date_idx
  on public.transactions(account_id, booked_at desc);
create index transactions_description_search_idx
  on public.transactions using gin (to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(merchant_name, '')));

create table public.transaction_enrichments (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  responsible_type text not null default 'self' check (responsible_type in ('self', 'person', 'company', 'other')),
  nature text not null default 'expense' check (
    nature in (
      'expense', 'income', 'transfer', 'third_party', 'reimbursable',
      'loan', 'debt_payment', 'shared', 'investment', 'other'
    )
  ),
  notes text,
  tags text[] not null default '{}',
  reimbursable boolean not null default false,
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transaction_enrichments_owner_person_idx
  on public.transaction_enrichments(owner_id, person_id);
create index transaction_enrichments_owner_category_idx
  on public.transaction_enrichments(owner_id, category_id);

create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  description text not null,
  total_cents bigint not null check (total_cents >= 0),
  installment_count integer not null check (installment_count > 0),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.installment_plans(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  installment_number integer not null check (installment_number > 0),
  amount_cents bigint not null check (amount_cents >= 0),
  due_date date not null,
  paid_cents bigint not null default 0 check (paid_cents >= 0),
  paid_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, installment_number),
  check (paid_cents <= amount_cents)
);

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete restrict,
  source_transaction_id uuid references public.transactions(id) on delete set null,
  installment_plan_id uuid references public.installment_plans(id) on delete set null,
  description text not null,
  total_cents bigint not null check (total_cents >= 0),
  received_cents bigint not null default 0 check (received_cents >= 0),
  due_date date not null,
  current_installment integer,
  installment_count integer,
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (received_cents <= total_cents)
);

create index receivables_owner_due_idx
  on public.receivables(owner_id, status, due_date);

create unique index receivables_source_transaction_uidx
  on public.receivables(owner_id, source_transaction_id)
  where source_transaction_id is not null;

create table public.payables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  description text not null,
  amount_cents bigint not null check (amount_cents >= 0),
  due_date date not null,
  recurrence text check (recurrence in ('weekly', 'monthly', 'quarterly', 'yearly')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payables_owner_due_idx on public.payables(owner_id, status, due_date);

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  merchant_pattern text not null,
  display_name text not null,
  average_amount_cents bigint not null,
  cadence text not null check (cadence in ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_expected_date date,
  confidence numeric(5, 4) check (confidence between 0 and 1),
  confirmed boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  priority integer not null default 100,
  active boolean not null default true,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  last_applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rules_owner_priority_idx
  on public.rules(owner_id, active, priority);

create table public.transaction_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_transaction_id uuid not null references public.transactions(id) on delete cascade,
  target_transaction_id uuid references public.transactions(id) on delete cascade,
  receivable_id uuid references public.receivables(id) on delete cascade,
  link_type text not null check (link_type in ('internal_transfer', 'reimbursement', 'receivable_payment', 'duplicate', 'related')),
  confidence numeric(5, 4) check (confidence between 0 and 1),
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  check (target_transaction_id is not null or receivable_id is not null)
);

create unique index transaction_links_unique_idx
  on public.transaction_links(
    owner_id,
    source_transaction_id,
    coalesce(target_transaction_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(receivable_id, '00000000-0000-0000-0000-000000000000'::uuid),
    link_type
  );

create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.bank_connections(id) on delete set null,
  provider text not null,
  status text not null check (status in ('running', 'success', 'failed', 'partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  accounts_processed integer not null default 0,
  transactions_processed integer not null default 0,
  error_code text,
  metadata jsonb not null default '{}'::jsonb
);

create index sync_logs_owner_started_idx
  on public.sync_logs(owner_id, started_at desc);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create index webhook_events_status_idx
  on public.webhook_events(status, received_at);

-- Keep updated_at consistent on mutable entities.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'settings', 'institutions', 'bank_connections', 'accounts',
    'credit_cards', 'categories', 'people', 'transactions',
    'transaction_enrichments', 'installment_plans', 'installments',
    'receivables', 'payables', 'recurring_transactions', 'rules'
  ]
  loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create or replace function public.seed_default_categories(target_owner uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.categories (owner_id, name, system_key, icon, color)
  values
    (target_owner, 'Alimentação', 'food', 'utensils', '#f2c14e'),
    (target_owner, 'Mercado', 'groceries', 'basket', '#75c68f'),
    (target_owner, 'Transporte', 'transport', 'car', '#f0a14a'),
    (target_owner, 'Combustível', 'fuel', 'fuel', '#ed8b3a'),
    (target_owner, 'Moradia', 'housing', 'home', '#7d6df2'),
    (target_owner, 'Saúde', 'health', 'heart', '#e56b79'),
    (target_owner, 'Educação', 'education', 'book', '#4f8bd6'),
    (target_owner, 'Lazer', 'leisure', 'sparkles', '#d46ad8'),
    (target_owner, 'Assinaturas', 'subscriptions', 'repeat', '#e56b79'),
    (target_owner, 'Compras', 'shopping', 'bag', '#ab6cf1'),
    (target_owner, 'Veículos', 'vehicles', 'bike', '#64748b'),
    (target_owner, 'Investimentos', 'investments', 'chart', '#2eb89a'),
    (target_owner, 'Transferências', 'transfers', 'arrows', '#718096'),
    (target_owner, 'Impostos', 'taxes', 'landmark', '#9b7559'),
    (target_owner, 'Receitas', 'income', 'arrow-down', '#46b5a7'),
    (target_owner, 'Reembolsos', 'refunds', 'rotate', '#3da397'),
    (target_owner, 'Outros', 'other', 'circle', '#7d8799')
  on conflict (owner_id, system_key) do nothing;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.settings (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;

  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: authenticated users can only read and mutate their own records.
alter table public.profiles enable row level security;
create policy profiles_owner_select on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_owner_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'settings', 'institutions', 'bank_connections', 'accounts', 'credit_cards',
    'categories', 'people', 'transactions', 'transaction_enrichments',
    'installment_plans', 'installments', 'receivables', 'payables',
    'recurring_transactions', 'rules', 'transaction_links', 'sync_logs',
    'webhook_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (owner_id = auth.uid())',
      table_name || '_owner_select',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner_id = auth.uid())',
      table_name || '_owner_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      table_name || '_owner_update',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (owner_id = auth.uid())',
      table_name || '_owner_delete',
      table_name
    );
  end loop;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.seed_default_categories(uuid) to service_role;

revoke all on function public.handle_new_user() from public;
revoke all on function public.seed_default_categories(uuid) from anon;
revoke all on function public.seed_default_categories(uuid) from authenticated;
