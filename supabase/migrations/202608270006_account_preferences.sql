-- Keep user preferences separate from names and balances imported by Pluggy.
alter table public.accounts
  add column if not exists custom_name text;

comment on column public.accounts.name is
  'Original account name received from the banking provider.';

comment on column public.accounts.custom_name is
  'Optional user-defined display name. Synchronization never overwrites it.';

comment on column public.accounts.include_in_safe_balance is
  'User preference for liquid accounts. Credit, investment and unknown types are excluded by application rules.';
