# Arquitetura

## Princípios

1. segurança antes de conveniência;
2. centavos inteiros antes de ponto flutuante;
3. sincronização idempotente;
4. enriquecimentos do usuário separados dos dados bancários;
5. serverless compatível com Vercel;
6. funcionamento sem IA e sem serviços pagos;
7. provider bancário substituível.

## Visão geral

~~~mermaid
flowchart TD
  Browser["Navegador / PWA"] --> Next["Next.js na Vercel"]
  Next --> Auth["Supabase Auth"]
  Next --> DB["Supabase PostgreSQL + RLS"]
  Next --> AI["Gateway de IA opcional"]
  Next --> Provider["BankingProvider"]
  Provider --> Pluggy["Pluggy / Conector 200"]
  Pluggy --> Banks["Instituições financeiras"]
~~~

## Limites de confiança

- O navegador recebe apenas a chave pública do Supabase e Connect Tokens de
  curta duração.
- PLUGGY_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY e o segredo de webhook ficam
  exclusivamente no runtime Node server-side.
- AI_API_KEY e AI_BASE_URL ficam no servidor. Quando configurada pelo
  dashboard, a chave é cifrada por usuário em uma tabela sem acesso público; o
  navegador recebe somente o estado sem segredo e a resposta final do modelo.
- Rotas de mutação exigem sessão, mesma origem e validação Zod.
- O webhook usa um header aleatório, comparação segura e eventId único.

## Camadas

### Interface

DashboardApp é um cliente interativo, mas recebe um snapshot produzido no
servidor. Em modo demonstração usa somente dados fictícios.

### Dados

getDashboardData consulta o Supabase com a sessão do usuário; o RLS é uma
segunda barreira mesmo que uma consulta esteja incorreta.

### Domínio financeiro

Funções em src/lib/finance são determinísticas e não dependem de React,
Supabase ou Pluggy. Valores são inteiros em centavos.

### IA e planilhas

O adaptador de IA aceita gateways OpenAI-compatible ou Anthropic. Sonnet é
usado no Chat e Opus na catalogação, com IDs configuráveis. Ambos operam em
modo somente leitura. Agrupamentos são sugestões e os totais exibidos são
recalculados com os centavos originais pelo código. A planilha CSV é
determinística e não depende de modelo. A configuração pessoal do dashboard
tem precedência sobre as variáveis da Vercel; estas funcionam como fallback.

### Integração bancária

BankingProvider define o contrato. PluggyBankingProvider implementa token,
contas, transações v2, atualização e desconexão. Outro provider pode ser
adicionado sem alterar o domínio financeiro.

### Sincronização

1. autentica no provider somente no servidor;
2. valida clientUserId contra o usuário autenticado;
3. upsert de instituição e conexão;
4. upsert de contas;
5. pagina transações por cursor;
6. cria fingerprint complementar;
7. faz upsert por identificador externo;
8. não toca em transaction_enrichments;
9. registra sync_logs sem credenciais ou payloads sensíveis.

## Saldo Seguro

Por padrão:

~~~text
Saldo Seguro =
  saldos incluídos
  - contas a pagar pendentes no horizonte
  - reserva configurada
~~~

Recebíveis não entram por padrão, porque promessa não é caixa. O usuário pode
optar por incluir apenas recebíveis confirmados. O resultado pode ficar
negativo para sinalizar insuficiência real.

## Decisões

- Next.js App Router: funções serverless e componentes de servidor.
- Supabase: Auth, PostgreSQL e RLS no plano gratuito.
- Tailwind CSS: interface responsiva sem runtime de CSS.
- Zod: validação de fronteira.
- Vitest: cálculos rápidos e independentes.
- Sem Redis obrigatório: rate limit local é best-effort para o uso pessoal.
- Sem cache offline de respostas: o service worker não armazena dados
  financeiros.
