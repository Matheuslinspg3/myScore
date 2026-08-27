# Deploy

## 1. Supabase

Crie um projeto no plano gratuito e guarde a senha do banco.

~~~bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
~~~

Em Authentication > URL Configuration, cadastre:

~~~text
http://localhost:3000/auth/callback
https://SEU_DOMINIO/auth/callback
~~~

Copie Project URL, anon key e service role. A service role é somente servidor.

Em Authentication > Providers > Email, mantenha **Confirm email** ativado.
Assim, uma conta nova só poderá entrar depois de clicar no link recebido por
e-mail.

## 2. Pluggy

Para uso pessoal gratuito:

1. crie a conta no Meu Pluggy;
2. conecte suas instituições;
3. obtenha/configure o acesso compatível com o Conector 200;
4. copie Client ID e Client Secret.

Se webhooks estiverem disponíveis no plano usado, configure:

~~~text
URL: https://SEU_DOMINIO/api/pluggy/webhook
Header: x-myscore-webhook-secret
Valor: o mesmo PLUGGY_WEBHOOK_SECRET da Vercel
~~~

Sem webhook, use sincronização manual. O app continua funcional.

## 3. Vercel

No painel Vercel:

1. Add New > Project;
2. importe Matheuslinspg3/myScore;
3. mantenha Framework Preset = Next.js;
4. adicione as variáveis;
5. faça o deploy.

Variáveis de produção:

| Variável | Visibilidade |
|---|---|
| NEXT_PUBLIC_APP_URL | pública |
| NEXT_PUBLIC_DEMO_MODE | pública |
| NEXT_PUBLIC_SUPABASE_URL | pública |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | pública, protegida por RLS |
| SUPABASE_SERVICE_ROLE_KEY | somente servidor |
| PLUGGY_CLIENT_ID | somente servidor |
| PLUGGY_CLIENT_SECRET | somente servidor |
| PLUGGY_WEBHOOK_SECRET | somente servidor |
| AI_PROVIDER | servidor |
| AI_API_FORMAT | servidor |
| AI_AUTH_SCHEME | servidor |
| AI_BASE_URL | somente servidor |
| AI_API_KEY | somente servidor |
| AI_CHAT_MODEL | servidor |
| AI_DATA_MODEL | servidor |
| AI_SETTINGS_ENCRYPTION_KEY | servidor, opcional |

Defina NEXT_PUBLIC_APP_URL como a URL final HTTPS.

### IA opcional

O modo recomendado é configurar pela própria aba **Chat IA > Configuração da
IA**. A configuração fica associada ao usuário autenticado no Supabase; a API
Key é criptografada no servidor e nunca é devolvida ao navegador. Antes disso,
aplique também a migration `202608270004_ai_credentials.sql`.

As variáveis abaixo continuam disponíveis como fallback global ou para a
primeira configuração:

O myScore funciona normalmente com `AI_PROVIDER=disabled`. Para usar um
gateway próprio compatível com a API da OpenAI, configure na Vercel:

~~~text
AI_PROVIDER=custom
AI_API_FORMAT=openai
AI_AUTH_SCHEME=bearer
AI_BASE_URL=https://SEU_GATEWAY
AI_API_KEY=SUA_CHAVE
AI_CHAT_MODEL=claude-sonnet-5
AI_DATA_MODEL=claude-opus-5
~~~

Se a Base URL já terminar em `/v1` ou `/chat/completions`, o myScore preserva
esse caminho. Para a API nativa da Anthropic, use `AI_API_FORMAT=anthropic` e
`AI_AUTH_SCHEME=x-api-key`. Os identificadores dos modelos devem ser exatamente
os aceitos pelo seu gateway.

Nunca use o prefixo `NEXT_PUBLIC_` nas variáveis de IA. Depois de salvar as
variáveis, crie um novo deployment. O campo `integrations.ai` em `/api/health`
indica apenas se esse fallback da Vercel está completo; a configuração pessoal
é validada dentro da aba Chat IA.

`AI_SETTINGS_ENCRYPTION_KEY` é opcional. Se ausente, o myScore deriva uma chave
da `SUPABASE_SERVICE_ROLE_KEY`, que já existe no servidor. Se qualquer uma
dessas chaves-raiz for rotacionada, salve novamente a API Key da IA no
dashboard.

## 4. Verificação

Depois do deploy:

1. abra /api/health e confira Supabase e Pluggy;
2. crie uma conta, confirme o e-mail e entre com e-mail e senha;
3. teste também a recuperação de senha;
4. conecte uma instituição;
5. confira bank_connections e sync_logs;
6. sincronize novamente e confirme que transações não duplicaram;
7. classifique uma transação e sincronize novamente;
8. confirme que o enriquecimento permaneceu;
9. teste a interface instalada no celular.
10. se habilitou IA, use **Testar conexão**, salve e valide Chat, catálogo e
    download CSV; a chave deve ser digitada somente no formulário protegido.

## Modo demonstração

Para um preview sem credenciais:

~~~text
NEXT_PUBLIC_DEMO_MODE=true
~~~

Nenhum dado real é lido ou gravado.

## Rollback

Vercel permite promover um deployment anterior. Migrations destrutivas devem
ter migration reversa planejada; nunca edite uma migration já aplicada em
produção.
