-- PostgREST upserts cannot use the previous partial unique indexes as an
-- ON CONFLICT target. PostgreSQL unique constraints still allow more than one
-- NULL provider ID, so this preserves the original data model and enables
-- idempotent Pluggy account/card synchronization.

drop index if exists public.accounts_owner_provider_id_uidx;
drop index if exists public.credit_cards_owner_provider_id_uidx;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_owner_provider_id_key'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_owner_provider_id_key
      unique (owner_id, provider_account_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'credit_cards_owner_provider_id_key'
      and conrelid = 'public.credit_cards'::regclass
  ) then
    alter table public.credit_cards
      add constraint credit_cards_owner_provider_id_key
      unique (owner_id, provider_card_id);
  end if;
end;
$$;
