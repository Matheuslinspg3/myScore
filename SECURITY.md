# Segurança

## Dados protegidos

- saldos, transações, cartões e projeções;
- identidade do usuário;
- credenciais de API;
- consentimentos e identificadores Pluggy;
- vínculos com pessoas e dívidas.

## Controles implementados

### Segredos

PLUGGY_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY, AI_API_KEY e
PLUGGY_WEBHOOK_SECRET nunca usam o prefixo NEXT_PUBLIC e só são lidos em
módulos server-side.

Quando a IA é configurada pelo dashboard, a chave é cifrada com AES-256-GCM
antes de chegar ao Supabase. A tabela não concede acesso a `anon` nem a
`authenticated`; somente uma rota de servidor, depois de validar a sessão,
usa `service_role`. A chave nunca é retornada ao navegador. O segredo raiz pode
ser `AI_SETTINGS_ENCRYPTION_KEY`; na ausência dele, é derivado da própria
`SUPABASE_SERVICE_ROLE_KEY`.

### Autorização

- autenticação por Supabase Auth;
- owner_id em todas as entidades;
- RLS com auth.uid() em leitura e escrita;
- service role restrita à sincronização e ao webhook;
- clientUserId Pluggy validado antes de persistir um Item.

### Rotas

- validação Zod;
- limite de tamanho padrão do Next.js;
- verificação de Origin em mutações do navegador;
- rate limit best-effort em operações Pluggy;
- erros genéricos para o cliente;
- ausência de credenciais e payloads sensíveis nos logs.
- rotas de IA autenticadas, com mesma origem, rate limit e respostas sem cache;
- dados enviados à IA somente após ação explícita no Chat ou no catálogo;
- teste do gateway sem dados financeiros e bloqueio de Base URLs locais,
  privadas, sem HTTPS ou com credenciais embutidas;
- catálogo de IA somente leitura, com totais recalculados pelo código;
- exportação CSV protegida contra fórmulas inseridas em campos textuais.

### Webhook

- header x-myscore-webhook-secret;
- segredo mínimo de 24 caracteres;
- comparação timing-safe;
- provider_event_id único;
- evento duplicado responde com sucesso sem reprocessar.

### Navegador

- headers nosniff, DENY, Referrer-Policy e Permissions-Policy;
- React escapa conteúdo textual por padrão;
- nenhum HTML financeiro inserido diretamente;
- PWA sem cache de responses;
- modo privacidade oculta valores na tela.

## Ações obrigatórias de produção

1. gere PLUGGY_WEBHOOK_SECRET com pelo menos 32 bytes aleatórios;
2. não copie service role para variáveis públicas;
3. mantenha RLS ativo;
4. habilite MFA na conta GitHub, Supabase, Pluggy e Vercel;
5. restrinja as URLs de redirect do Supabase aos domínios reais;
6. revise logs antes de adicionar observabilidade externa;
7. rotacione qualquer segredo que tenha sido exposto;
8. aplique atualizações de dependências após CI e revisão.
9. ao rotacionar a chave-raiz usada pela IA, informe novamente a API Key no
   dashboard para gerar uma nova cifra.

Exemplo para gerar o segredo:

~~~bash
openssl rand -hex 32
~~~

## Limitações conhecidas

- Rate limit em memória não é global entre instâncias serverless; para o uso
  pessoal ele reduz abuso acidental, mas uma versão pública exigiria controle
  persistente.
- A Pluggy documenta webhooks com headers configuráveis, não uma assinatura
  criptográfica padrão. O segredo aleatório de header é obrigatório neste
  projeto.
- O modo demonstração é público e contém somente dados fictícios.
- O conteúdo enviado a um gateway de IA passa a ser tratado segundo a política
  desse fornecedor. Use apenas um gateway de confiança e mantenha a IA
  desativada quando não precisar dela.

## Relato responsável

Não abra uma issue pública com saldos, tokens ou prints reais. Revogue o segredo
afetado antes de compartilhar qualquer diagnóstico.
