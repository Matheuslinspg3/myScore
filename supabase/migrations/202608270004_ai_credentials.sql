-- AI credentials are only available through authenticated server routes.
-- The API key is encrypted by the application before it reaches this table.
create table if not exists public.ai_credentials (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  provider text not null default 'custom' check (provider = 'custom'),
  api_format text not null default 'openai' check (api_format in ('openai', 'anthropic')),
  auth_scheme text not null default 'bearer' check (auth_scheme in ('bearer', 'x-api-key')),
  base_url text not null,
  api_key_ciphertext text not null,
  chat_model text not null,
  data_model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_credentials enable row level security;

-- Intentionally no authenticated policies: even the owner cannot retrieve the
-- ciphertext through the public Supabase API. Server routes use service_role
-- only after validating the authenticated user.
revoke all on table public.ai_credentials from anon, authenticated;
grant select, insert, update, delete on table public.ai_credentials to service_role;

drop trigger if exists set_ai_credentials_updated_at on public.ai_credentials;
create trigger set_ai_credentials_updated_at
  before update on public.ai_credentials
  for each row execute function public.set_updated_at();

comment on table public.ai_credentials is
  'Encrypted, server-only AI gateway settings scoped to one myScore owner.';
