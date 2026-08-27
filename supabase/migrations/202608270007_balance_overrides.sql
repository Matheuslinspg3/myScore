-- Local corrections never overwrite values received from Pluggy.
alter table public.accounts
  add column if not exists custom_name text,
  add column if not exists balance_override_cents bigint;

alter table public.credit_cards
  add column if not exists custom_name text,
  add column if not exists invoice_override_cents bigint,
  add column if not exists include_in_invoice boolean not null default true;

comment on column public.accounts.balance_override_cents is
  'Optional local balance used by myScore while preserving balance_cents from the provider.';

comment on column public.credit_cards.invoice_cents is
  'Original current balance received from the credit account provider.';

comment on column public.credit_cards.invoice_override_cents is
  'Optional local invoice used by myScore while preserving invoice_cents from the provider.';

comment on column public.credit_cards.include_in_invoice is
  'Whether this card contributes to the consolidated invoice.';
