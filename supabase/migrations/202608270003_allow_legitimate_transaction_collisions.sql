-- Keep fingerprint lookup fast without rejecting legitimate transactions that
-- happen to share the same date, amount and description. Pluggy idempotency is
-- guaranteed by transactions_external_id_key instead.

drop index if exists public.transactions_dedupe_uidx;

create index if not exists transactions_dedupe_idx
  on public.transactions(owner_id, account_id, dedupe_key);
