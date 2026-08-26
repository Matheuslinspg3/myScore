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
| NEXT_PUBLIC_DEMO_MODE=false | pública |
| NEXT_PUBLIC_SUPABASE_URL | pública |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | pública, protegida por RLS |
| SUPABASE_SERVICE_ROLE_KEY | somente servidor |
| PLUGGY_CLIENT_ID | somente servidor |
| PLUGGY_CLIENT_SECRET | somente servidor |
| PLUGGY_WEBHOOK_SECRET | somente servidor |
| AI_PROVIDER=disabled | servidor |

Defina NEXT_PUBLIC_APP_URL como a URL final HTTPS.

## 4. Verificação

Depois do deploy:

1. abra /api/health e confira Supabase e Pluggy;
2. solicite o magic link;
3. conecte uma instituição;
4. confira bank_connections e sync_logs;
5. sincronize novamente e confirme que transações não duplicaram;
6. classifique uma transação e sincronize novamente;
7. confirme que o enriquecimento permaneceu;
8. teste a interface instalada no celular.

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
