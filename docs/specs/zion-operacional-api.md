# Zion Operacional: propostas de credito

## Listagem

`GET /api/v1/credit-proposals` usa a sessao autenticada do CRM e a organizacao ativa. A rota nao aceita `organization_id` na query. `requireRole("viewer")` valida a sessao; `fn_list_credit_proposals` aplica a visibilidade da proposta no banco: vendedor ve as proprias propostas, operador e supervisor veem a fila, e manager/admin veem as propostas da organizacao. Platform admin autenticado tambem pode consultar a organizacao ativa.

| Parametro | Padrao |                  Limite |
| --------- | -----: | ----------------------: |
| `limit`   |     50 |        1 a 100, inteiro |
| `offset`  |      0 | 0 a 2147483647, inteiro |

Query invalida retorna `422 validation_failed`. Falha de permissao no RPC retorna `403 forbidden`. A resposta de sucesso usa o wrapper `{ "data": [...] }` e `X-Request-Id`.

Cada item contem identificadores, numero da proposta, nomes do contato e dos responsaveis, status, produto, dados financeiros nao sigilosos e datas. A listagem nao retorna `notes`, numeros de contrato/matricula nem material criptografado (`ciphertext`, IV ou tag). O navegador nao tem `SELECT` direto em `credit_proposals`; apenas o RPC autenticado projeta os campos permitidos.

`POST /api/v1/credit-proposals` continua a criacao existente. `interest_rate` aceita de 0 a 999.999999, compativel com `numeric(9,6)` no banco.
