-- Complete the replacement of partial unique indexes used as PostgREST
-- ON CONFLICT targets. PostgreSQL unique constraints permit multiple NULLs,
-- preserving the original model while making upserts deterministic.

drop index if exists public.transactions_external_id_uidx;
drop index if exists public.receivables_source_transaction_uidx;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_external_id_key'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_external_id_key
      unique (owner_id, source, external_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'receivables_source_transaction_key'
      and conrelid = 'public.receivables'::regclass
  ) then
    alter table public.receivables
      add constraint receivables_source_transaction_key
      unique (owner_id, source_transaction_id);
  end if;
end;
$$;
