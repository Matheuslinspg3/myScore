# Open Finance e Pluggy

Pesquisa revisada em 26 de agosto de 2026.

## Escolha atual

O provider inicial é Pluggy, mas o domínio depende da interface
BankingProvider. Isso permite adicionar OFX, CSV, Belvo ou APIs bancárias sem
reescrever regras, recebíveis e projeções.

## Meu Pluggy e Conector 200

A página oficial de preços informa que, após o teste comercial, o usuário pode
acessar gratuitamente os próprios dados via Conector 200, usando contas já
conectadas no Meu Pluggy.

Para este projeto pessoal, isso atende à meta de R$ 0/mês, com ressalvas:

- não há SLA ou garantia comercial;
- o usuário conecta a instituição primeiro no Meu Pluggy;
- dados e histórico não são portáveis para um plano comercial;
- o Conector 200 não oferece webhooks;
- categorização automática e identidade/KYC não estão incluídos;
- mudanças futuras de termos podem afetar a integração.

Por isso o myScore mantém botão de sincronização manual e não depende de
webhooks para ser utilizável.

Fonte: https://pluggy.ai/precos

## Tokens

A autenticação tem dois níveis:

- API Key: servidor, duração aproximada de duas horas, acesso aos dados;
- Connect Token: frontend, curta duração, limitado ao widget.

O client secret nunca chega ao widget.

Fonte: https://docs.pluggy.ai/reference/auth

## Connect Token

O backend cria o token com clientUserId igual ao UUID do usuário e
avoidDuplicates=true. Ao receber o item, a sincronização confirma que o
clientUserId pertence à sessão atual.

Fonte: https://docs.pluggy.ai/reference/connect-token-create

## Transações

O endpoint antigo paginado por número está depreciado até 31 de dezembro de
2026. O provider usa GET /v2/transactions com cursor e páginas de até 500.

Fonte: https://docs.pluggy.ai/reference/transactions-list-1

## Items

O myScore persiste cada Item porque a Pluggy não lista conexões existentes por
motivos de segurança. avoidDuplicates reduz reconexões duplicadas.

Fonte: https://docs.pluggy.ai/docs/item

## Webhooks

Eventos item/created, item/updated e transactions/* podem iniciar uma
sincronização. No plano compatível, configure um webhook global com header
secreto. Eventos são persistidos antes do processamento para idempotência.

Fontes:

- https://docs.pluggy.ai/docs/webhooks
- https://docs.pluggy.ai/reference/webhooks-create

## Referência oficial estudada

O quickstart oficial atual inclui exemplo Next.js + Vercel + Supabase e o
padrão API Key no servidor / Connect Token no cliente:

https://github.com/pluggyai/quickstart

O repositório não apresentava uma licença raiz explícita na consulta realizada.
Nenhum código foi copiado; apenas documentação e padrões públicos da API foram
usados como referência.

## Outras referências

Actual Budget e Firefly III foram avaliados apenas conceitualmente para
orçamento, regras, recorrência e reconciliação. Projetos sem licença explícita
não tiveram implementação reutilizada.
