# myScore

[![CI](https://github.com/Matheuslinspg3/myScore/actions/workflows/ci.yml/badge.svg)](https://github.com/Matheuslinspg3/myScore/actions/workflows/ci.yml)

Gestor financeiro pessoal, mobile-first, para responder cinco perguntas sem
ruído:

1. quanto tenho;
2. quanto posso gastar com segurança;
3. quanto devo;
4. quanto tenho a receber;
5. quanto terei no futuro.

O projeto roda gratuitamente em modo demonstração e está preparado para
Vercel, Supabase e Pluggy.

## O que já funciona

- dashboard responsivo com Saldo Seguro;
- consolidação de contas e cartões;
- nomes personalizados de conta e controle explícito do que entra no saldo;
- extrato com busca e filtros;
- gastos associados a pessoas;
- recebíveis, contas a pagar e parcelamentos no banco;
- projeções de 7, 15, 30, 60 e 90 dias;
- categorização por regras;
- sugestões de reconciliação e transferência interna;
- integração Pluggy por provider desacoplado;
- sincronização idempotente de contas e transações pela API v2;
- cadastro e login com e-mail e senha, com confirmação obrigatória de e-mail;
- Row Level Security em todas as tabelas financeiras;
- webhook autenticado e idempotente;
- APIs validadas para pessoas, recebíveis, contas a pagar e enriquecimentos;
- cadastro de pessoas diretamente pelo dashboard;
- Chat IA opcional, configuração segura no dashboard, catálogo com totais
  determinísticos e exportação CSV;
- PWA sem cache de respostas financeiras;
- modo privacidade para ocultar valores;
- dados fictícios para desenvolvimento sem credenciais;
- testes de cálculos financeiros e integridade.

## Começar em 2 minutos

Requisitos: Node.js 20.9 ou superior.

~~~bash
npm install
cp .env.example .env.local
npm run dev
~~~

Acesse http://localhost:3000. Com NEXT_PUBLIC_DEMO_MODE=true, nenhum serviço
externo é necessário.

## Validar tudo

~~~bash
npm run check
~~~

Esse comando executa lint, TypeScript, testes e o build de produção.

## Conectar dados reais

1. Crie um projeto gratuito no Supabase.
2. Vincule a CLI e aplique as migrations:

~~~bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
~~~

3. Copie a URL e a chave pública do Supabase para .env.local.
4. Defina NEXT_PUBLIC_DEMO_MODE=false.
5. Crie/configure o acesso pessoal na Pluggy e adicione as credenciais.
6. Configure o webhook da Pluggy para:

~~~text
https://SEU_DOMINIO/api/pluggy/webhook
~~~

Inclua o header personalizado:

~~~text
x-myscore-webhook-secret: O_MESMO_VALOR_DE_PLUGGY_WEBHOOK_SECRET
~~~

7. Cadastre no Supabase Auth as URLs de callback local e de produção.
8. Na aba Chat IA, abra Configuração da IA, informe o gateway e teste antes de
   salvar. A API Key é criptografada e não volta ao navegador.

No Supabase, acesse Authentication > Providers > Email e deixe **Confirm
email** ativado. O cadastro envia um link para o e-mail informado e o acesso
só é liberado depois da confirmação.

Detalhes completos estão em DEPLOYMENT.md e OPEN_FINANCE.md.

## Scripts

| Comando | Finalidade |
|---|---|
| npm run dev | desenvolvimento local |
| npm run lint | qualidade estática |
| npm run typecheck | validação TypeScript |
| npm test | testes unitários |
| npm run build | build Vercel |
| npm run check | validação completa |

## Estrutura

~~~text
src/
├── app/                 páginas e rotas serverless
├── components/          interface mobile-first
├── lib/
│   ├── banking/         abstração e provider Pluggy
│   ├── ai/              gateway, contexto e catálogo somente leitura
│   ├── data/            consultas do dashboard
│   ├── export/          planilhas geradas sem depender da IA
│   ├── finance/         cálculos determinísticos
│   ├── security/        CSRF, rate limit e webhook
│   └── supabase/        clientes browser/server/admin
└── types/

supabase/migrations/     banco reproduzível e RLS
tests/                   cálculos e integridade
~~~

## Documentação

- ARCHITECTURE.md — decisões e fluxos;
- DATABASE.md — tabelas, integridade e migrations;
- SECURITY.md — modelo de ameaças e controles;
- OPEN_FINANCE.md — Pluggy, Meu Pluggy e Conector 200;
- DEPLOYMENT.md — Supabase e Vercel passo a passo.

## Regra de integridade mais importante

Dados vindos do banco ficam em transactions. Tudo o que o usuário acrescenta
fica em transaction_enrichments. Uma nova sincronização pode atualizar os dados
bancários, mas nunca apaga categoria, pessoa, observação, tags ou vínculo de
reembolso.

O mesmo princípio vale para contas: `name` e `balance_cents` continuam sendo a
origem Pluggy; `custom_name` e a preferência de inclusão no saldo são ajustes
locais preservados nas sincronizações.

## Estado

Versão 0.1: fundação segura e MVP utilizável. Pagamentos, iniciação de Pix,
KYC, SaaS multiusuário e cobranças automáticas estão deliberadamente fora do
escopo.
