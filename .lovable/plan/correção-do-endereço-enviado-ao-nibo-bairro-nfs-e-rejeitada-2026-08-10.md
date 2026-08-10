# Correção do endereço enviado ao NIBO (bairro / NFS-e rejeitada)

## O que o teste na API do NIBO mostrou

Consultei clientes reais já cadastrados no NIBO e comparei com o payload que enviamos:

- O campo de bairro no NIBO chama-se **`district`**, não `neighborhood`. Em 200 clientes analisados, 183 têm `district` preenchido e **nenhum** tem `neighborhood`.
- Nosso código envia `address.neighborhood`, que o NIBO simplesmente ignora — por isso o cadastro do Gustavo ficou sem bairro e a prefeitura rejeitou a NFS-e (BHISS0003).
- Clientes válidos também trazem **`country`** ("Brasil") e **`ibgeCode`** (código IBGE do município) — nós não enviamos nenhum dos dois hoje.
- `number` nos registros do NIBO é numérico; `zipCode` é gravado com um espaço à direita (comportamento do próprio NIBO, inofensivo).

Exemplo real de endereço aceito:

```text
address: { line1, number, district, city, state, zipCode, country: "Brasil", ibgeCode }
```

## O que fazer

1. **Renomear o campo do bairro** em `nibo-sync-payment`: `neighborhood` → `district` no objeto `address` enviado ao NIBO (mantendo o nome interno `address_neighborhood` no nosso banco).
2. **Enviar `country: "Brasil"`** sempre que houver endereço.
3. **Enviar `ibgeCode`**: buscar o código IBGE do município pelo CEP (ViaCEP) no momento do sync, com cache simples por CEP; se não vier, seguir sem o campo (não bloqueia).
4. **Verificação pós-gravação**: após criar/atualizar o cliente no NIBO, reler o cliente e confirmar que `address.district` veio preenchido. Se não vier, marcar o sync como falha em `nibo_sync_log` com o payload enviado e a resposta recebida, em vez de registrar "sucesso" enganoso.
5. **Reprocessar os clientes já afetados**: rotina de correção que reenvia o endereço (agora com `district`) para os clientes cujo cadastro no NIBO está sem bairro, começando pelo Gustavo, para permitir reemissão da NFS-e.

## Detalhes técnicos

- Arquivo principal: `supabase/functions/nibo-sync-payment/index.ts`, bloco `addressFlat` (linhas ~216-255) e a criação/atualização do cliente.
- Endpoint usado na verificação: `GET /empresas/v1/customers/{id}` com header `apitoken`.
- Fonte do IBGE: `https://viacep.com.br/ws/{cep}/json/` (campo `ibge`), com timeout curto e fallback silencioso.
- Sem alterações de schema; `nibo_sync_log` já tem campos para erro e payload.

## Impacto

Fluxo fiscal (emissão de NF-e/NFS-e) apenas. Pagamentos, tracking, autenticação e PWA não são afetados.

## Como testar

- Rodar o sync manual de um pedido com endereço completo em `/admin/nibo` e conferir no NIBO que o cliente aparece com bairro preenchido.
- Reprocessar o Gustavo e reemitir a NFS-e.
