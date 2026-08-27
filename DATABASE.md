# Banco de dados

O banco é reproduzível por migrations em supabase/migrations.

## Convenções

- UUID para chaves internas;
- bigint em centavos para dinheiro;
- timestamptz para eventos;
- date para vencimentos;
- owner_id em toda entidade financeira;
- raw_data somente para o payload necessário à rastreabilidade;
- RLS habilitado por padrão;
- exclusão em cascata a partir do usuário;
- índices parciais para identificadores externos opcionais.

## Núcleo

| Tabela | Responsabilidade |
|---|---|
| profiles | perfil do proprietário |
| settings | privacidade, reserva e projeção |
| institutions | instituição por provider |
| bank_connections | consentimento/item bancário |
| accounts | contas e saldos |
| credit_cards | fatura e limites disponíveis |
| transactions | verdade importada do banco/arquivo |
| transaction_enrichments | categoria, pessoa, natureza, notas e tags |
| categories | categorias e subcategorias |
| people | responsáveis por gastos |
| receivables | valores a receber |
| payables | compromissos a pagar |
| installment_plans | contrato do parcelamento |
| installments | cada parcela e pagamento |
| recurring_transactions | recorrências detectadas |
| rules | condições e ações automáticas |
| transaction_links | transferências, reembolsos e conciliações |
| sync_logs | resultado sanitizado das sincronizações |
| webhook_events | idempotência dos eventos externos |
| ai_credentials | gateway e API Key cifrada por proprietário |

## Deduplicação

Ordem de decisão:

1. provider + external_id;
2. fingerprint SHA-256 com conta, data/minuto, centavos, descrição
   normalizada, providerCode e saldo posterior quando disponível.

O índice transactions_external_id_uidx impede duplicação de dados Pluggy. O
índice transactions_dedupe_uidx cobre reprocessamento de OFX/CSV. Casos
ambíguos devem ser apresentados para confirmação, não removidos
automaticamente.

## Enriquecimentos

transaction_enrichments tem relação um-para-um com transactions. O sincronismo
pode atualizar descrição, status e payload bancário, mas não atualiza a tabela
de enriquecimentos. Essa separação evita perder trabalho manual.

## Credenciais de IA

`ai_credentials` guarda uma configuração por proprietário. O campo da API Key
contém somente a cifra AES-256-GCM produzida pelo servidor. A tabela tem RLS
ativo, não oferece políticas nem privilégios para `anon` ou `authenticated` e
só é acessada por rotas autenticadas através de `service_role`.

A migration responsável é `202608270004_ai_credentials.sql`.

## Aplicar migrations

~~~bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
~~~

Para desenvolvimento local com Docker disponível:

~~~bash
npx supabase start
npx supabase db reset
~~~

O trigger handle_new_user cria perfil, configurações e categorias iniciais.
