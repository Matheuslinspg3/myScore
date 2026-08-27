-- User-requested banking deletions must survive automatic Pluggy syncs.
-- The original provider identifiers are retained only as tombstones so the
-- deleted resource is not silently imported again by a webhook.

create table if not exists public.banking_exclusions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('pluggy', 'ofx', 'csv', 'manual')),
  resource_type text not null check (resource_type in ('item', 'account')),
  external_id text not null,
  parent_external_id text,
  reason text not null default 'user_deleted',
  created_at timestamptz not null default now(),
  unique (owner_id, provider, resource_type, external_id)
);

comment on table public.banking_exclusions is
  'Per-user tombstones that stop explicitly deleted banking resources from being recreated by synchronization.';

alter table public.banking_exclusions enable row level security;

drop policy if exists banking_exclusions_owner_select
  on public.banking_exclusions;
create policy banking_exclusions_owner_select
  on public.banking_exclusions
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists banking_exclusions_owner_insert
  on public.banking_exclusions;
create policy banking_exclusions_owner_insert
  on public.banking_exclusions
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists banking_exclusions_owner_delete
  on public.banking_exclusions;
create policy banking_exclusions_owner_delete
  on public.banking_exclusions
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.banking_exclusions from public, anon;
grant select, insert, delete on table public.banking_exclusions to authenticated;
grant all on table public.banking_exclusions to service_role;

-- Foreign-key indexes keep account and connection deletion bounded as the
-- user's history grows.
create index if not exists banking_exclusions_parent_idx
  on public.banking_exclusions(owner_id, provider, parent_external_id)
  where parent_external_id is not null;
create index if not exists accounts_connection_fk_idx
  on public.accounts(connection_id) where connection_id is not null;
create index if not exists accounts_institution_fk_idx
  on public.accounts(institution_id) where institution_id is not null;
create index if not exists bank_connections_institution_fk_idx
  on public.bank_connections(institution_id) where institution_id is not null;
create index if not exists credit_cards_account_fk_idx
  on public.credit_cards(account_id);
create index if not exists payables_account_fk_idx
  on public.payables(account_id) where account_id is not null;
create index if not exists recurring_transactions_account_fk_idx
  on public.recurring_transactions(account_id) where account_id is not null;

create or replace function public.delete_banking_account(p_account_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_owner uuid := (select auth.uid());
  account_row public.accounts%rowtype;
  parent_item_id text;
  parent_provider text := 'manual';
  deleted_transactions bigint;
  deleted_cards bigint;
begin
  if current_owner is null then
    raise exception using errcode = '42501', message = 'UNAUTHORIZED';
  end if;

  select account.*
    into account_row
    from public.accounts as account
   where account.id = p_account_id
     and account.owner_id = current_owner
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ACCOUNT_NOT_FOUND';
  end if;

  select connection.external_item_id, connection.provider
    into parent_item_id, parent_provider
    from public.bank_connections as connection
   where connection.id = account_row.connection_id
     and connection.owner_id = current_owner;

  select count(*) into deleted_transactions
    from public.transactions
   where account_id = account_row.id
     and owner_id = current_owner;

  select count(*) into deleted_cards
    from public.credit_cards
   where account_id = account_row.id
     and owner_id = current_owner;

  if account_row.provider_account_id is not null then
    insert into public.banking_exclusions (
      owner_id,
      provider,
      resource_type,
      external_id,
      parent_external_id,
      reason
    ) values (
      current_owner,
      parent_provider,
      'account',
      account_row.provider_account_id,
      parent_item_id,
      'user_deleted'
    )
    on conflict (owner_id, provider, resource_type, external_id)
    do update set
      parent_external_id = excluded.parent_external_id,
      reason = excluded.reason,
      created_at = now();
  end if;

  delete from public.accounts
   where id = account_row.id
     and owner_id = current_owner;

  return jsonb_build_object(
    'accountId', account_row.id,
    'transactionsDeleted', deleted_transactions,
    'cardsDeleted', deleted_cards
  );
end;
$$;

create or replace function public.delete_banking_connection(p_connection_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_owner uuid := (select auth.uid());
  connection_row public.bank_connections%rowtype;
  deleted_accounts bigint;
  deleted_cards bigint;
  deleted_transactions bigint;
begin
  if current_owner is null then
    raise exception using errcode = '42501', message = 'UNAUTHORIZED';
  end if;

  select connection.*
    into connection_row
    from public.bank_connections as connection
   where connection.id = p_connection_id
     and connection.owner_id = current_owner
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CONNECTION_NOT_FOUND';
  end if;

  select count(*) into deleted_accounts
    from public.accounts
   where connection_id = connection_row.id
     and owner_id = current_owner;

  select count(*) into deleted_cards
    from public.credit_cards as card
    join public.accounts as account on account.id = card.account_id
   where account.connection_id = connection_row.id
     and card.owner_id = current_owner;

  select count(*) into deleted_transactions
    from public.transactions as tx
    join public.accounts as account on account.id = tx.account_id
   where account.connection_id = connection_row.id
     and tx.owner_id = current_owner;

  insert into public.banking_exclusions (
    owner_id,
    provider,
    resource_type,
    external_id,
    reason
  ) values (
    current_owner,
    connection_row.provider,
    'item',
    connection_row.external_item_id,
    'user_deleted'
  )
  on conflict (owner_id, provider, resource_type, external_id)
  do update set
    reason = excluded.reason,
    created_at = now();

  delete from public.bank_connections
   where id = connection_row.id
     and owner_id = current_owner;

  if connection_row.institution_id is not null
     and not exists (
       select 1
         from public.bank_connections
        where institution_id = connection_row.institution_id
          and owner_id = current_owner
     )
     and not exists (
       select 1
         from public.accounts
        where institution_id = connection_row.institution_id
          and owner_id = current_owner
     ) then
    delete from public.institutions
     where id = connection_row.institution_id
       and owner_id = current_owner;
  end if;

  return jsonb_build_object(
    'connectionId', connection_row.id,
    'accountsDeleted', deleted_accounts,
    'cardsDeleted', deleted_cards,
    'transactionsDeleted', deleted_transactions
  );
end;
$$;

revoke all on function public.delete_banking_account(uuid) from public, anon;
revoke all on function public.delete_banking_connection(uuid) from public, anon;
grant execute on function public.delete_banking_account(uuid)
  to authenticated, service_role;
grant execute on function public.delete_banking_connection(uuid)
  to authenticated, service_role;
