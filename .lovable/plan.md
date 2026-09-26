# Integração fiscal NIBO (emissão de NFS-e) — mapa completo

Documento de referência para replicar a integração em outro projeto. Nenhum código será alterado.

## 1. Edge functions envolvidas

- `supabase/functions/nibo-sync-payment/index.ts` — núcleo da integração: cria/atualiza o cliente no NIBO, lança a receita (schedule) e emite a NFS-e. ~678 linhas.
- `supabase/functions/nibo-list-services/index.ts` — auxiliar de configuração: lista os "perfis de serviço" cadastrados na conta NIBO (usado na tela admin para mapear tipo de produto → serviço).
- `supabase/functions/mercadopago-webhook/index.ts` — gatilho automático: após confirmar pagamento, invoca `nibo-sync-payment` (linhas ~96-101, com header `x-internal-nibo-sync`).
- `supabase/functions/create-mp-payment/index.ts` — captura CPF/nome do formulário do Mercado Pago e persiste no perfil; envia endereço fiscal nos metadados do pagamento.
- `supabase/functions/save-fiscal-address/index.ts` — salva o endereço fiscal coletado no modal pós-compra.

Frontend relacionado:
- `src/components/user/CheckoutFiscalGate.tsx` — formulário de dados fiscais no checkout (modo "minimal": nome+CPF; modo "full": + endereço).
- `src/components/user/FiscalAddressDialog.tsx` — modal pós-pagamento para completar endereço.
- `src/components/user/FiscalPendingBanner.tsx` — banner amarelo no app para quem tem compra com dados fiscais incompletos.
- `src/pages/Checkout.tsx` — orquestra o gate e envia `fiscal` no body do pagamento.
- `src/pages/admin/AdminNibo.tsx` + `src/components/admin/NiboSyncCell.tsx` — tela admin de acompanhamento e reenvio manual.

## 2. Fluxo completo (gatilho → NFS-e)

Três gatilhos convergem para a mesma função `nibo-sync-payment`:

```text
Pagamento aprovado (Mercado Pago)
   └─ mercadopago-webhook confirma e libera acesso
        └─ invoca nibo-sync-payment { order_id } (header x-internal-nibo-sync)

Cron pg_cron "nibo-sync-every-5min" (a cada 5 min)
   └─ POST nibo-sync-payment { auto: true }
        └─ varre vendas dos últimos 30 dias sem sync "success" (máx. 50/execução)

Admin (botão em /admin/nibo ou /admin/pedidos)
   └─ POST nibo-sync-payment { order_id } com JWT de admin
```

Dentro de `nibo-sync-payment`, para cada pedido:

1. **Claim atômico** — RPC `nibo_claim_order` trava a linha em `nibo_sync_log` (impede duplicidade entre webhook e cron; pedido já "success" ou em processamento há <5 min é ignorado).
2. **Cliente** (`upsertCustomer`) — busca CPF e endereço em `profiles`; se faltar rua/número/bairro/cidade/UF/CEP, marca `pending_fiscal` e para ali (sem fallback). Busca cliente existente no NIBO por e-mail (`GET /customers?$filter=email eq ...`); faz `PUT` (atualiza) ou `POST` (cria). Depois **relê o cliente** (`GET /customers/{id}`) e confirma que `address.district` foi gravado — se não, falha alto.
3. **Receita** (`createSchedule`) — `POST /schedules/credit/FormatType=json` com stakeholderId, valor, categoria de receita (buscada em `/schedules/categories/tree`, preferindo "101 - Infoprodutos e Cursos") e `serviceProfileId` vindo da tabela `nibo_service_mappings`.
4. **NFS-e** (`emitInvoice`) — só se o cliente tiver CPF/CNPJ (prefeitura rejeita sem, erro PNFe0006). `POST /nfse` com ScheduleId, StakeholderId, ServiceProfileId, AccrualRpsDate, descrições.
5. **Log** — atualiza `nibo_sync_log` com status final: `success` | `partial` | `pending_fiscal` | `pending`, IDs do NIBO e respostas brutas.

## 3. Secrets / variáveis de ambiente

- `NIBO_API_TOKEN` — token da API do NIBO (enviado no header `apitoken`).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` — padrão das edge functions (service key também usada como segredo interno no header `x-internal-nibo-sync`).
- `MERCADOPAGO_ACCESS_TOKEN` — usado em `create-mp-payment` (origem do pagamento, não do NIBO em si).

## 4. Tabelas, colunas e migrations

**`public.profiles`** — dados fiscais do cliente:
- `cpf` — migration `20260221201732_...sql` (`ALTER TABLE profiles ADD COLUMN cpf text UNIQUE`).
- `cep`, `address_street`, `address_number`, `address_complement`, `address_neighborhood`, `address_city`, `address_state` — migration `20260618112627_576d99e3-...sql`.

**`public.nibo_sync_log`** — estado da sincronização por pedido — migration `20260513151136_742762b8-...sql`:
- `order_id` (texto único, formato `vip:uuid` | `course:uuid` | `ebook:uuid` | `combo:uuid` | `package:uuid`)
- `status`, `customer_status`, `schedule_status`, `invoice_status`
- `nibo_customer_id`, `nibo_schedule_id`, `nibo_invoice_id` (IDs retornados pelo NIBO)
- `attempts`, `last_error`, `last_response` (jsonb), `last_attempt_at`
- RLS: somente admins.

**`public.nibo_service_mappings`** — mapeia `product_type` → `nibo_service_id`/`nibo_service_name` (perfil de serviço usado na NFS-e) — migration `20260513161819_91582780-...sql`. Configurado pela tela `/admin/nibo`.

**Funções RPC** (migration `20260618112627_...sql`): `nibo_claim_order` (claim atômico) e `nibo_get_order` (monta o pedido a partir das tabelas de acesso).

**Cron**: migrations `20260513151352_...sql` e `20260513151416_...sql` — `pg_cron` job `nibo-sync-every-5min` chamando a edge function a cada 5 minutos.

Outras: `20260513153731_...sql` (ajustes do log), `20260619195910_...sql` (marca pedidos sem valor como `skipped`).

## 5. Captura dos dados fiscais no checkout

1. No checkout (`src/pages/Checkout.tsx`), o `CheckoutFiscalGate` exige nome completo + CPF antes de liberar o pagamento; CPF e nome também vêm do próprio formulário do Mercado Pago (Payment Brick).
2. `create-mp-payment` persiste CPF/nome em `profiles` quando ausentes e envia o endereço (se houver) nos metadados do pagamento (`buyer_cep`, `buyer_street`, etc.).
3. Após o pagamento, se o endereço estiver incompleto, o `FiscalAddressDialog` (modal pós-compra) coleta CEP/rua/número/bairro/cidade/UF e salva via edge function `save-fiscal-address` em `profiles`.
4. O `FiscalPendingBanner` no app lembra quem comprou e ainda está com dados incompletos.
5. O webhook do Mercado Pago também persiste no perfil dados vindos dos metadados do pagamento.
6. Como o cron reprocessa pedidos `pending_fiscal`, a NFS-e sai automaticamente assim que o cliente completa o cadastro — sem intervenção manual.

## 6. Endpoints da API do NIBO e payloads

Base: `https://api.nibo.com.br/empresas/v1`, autenticação via header `apitoken`.

| Etapa | Endpoint | Campos principais |
|---|---|---|
| Buscar cliente | `GET /customers?$filter=email eq '<email>'&$top=1` | — |
| Criar cliente | `POST /customers` | `name`, `corporateName`, `email`, `isActive`, `communication{contactName,email,cellPhone}`, `document{number,type:Cpf/Cnpj}`, `address{line1,number,line2,district,city,state,zipCode,country:"Brasil",ibgeCode}` |
| Atualizar cliente | `PUT /customers/{id}` | mesmo payload |
| Verificar gravação | `GET /customers/{id}` | confere `address.district` |
| Categoria de receita | `GET /schedules/categories/tree?CanComposeNFSeValueOnly=true` | escolhe "101 - Infoprodutos e Cursos" |
| Lançar receita | `POST /schedules/credit/FormatType=json` | `stakeholderId`, `dueDate/scheduleDate/accrualDate`, `categories[{categoryId,value,description}]`, `value`, `description`, `reference`, `serviceProfileId`, `additionalServiceDescription` |
| Emitir NFS-e | `POST /nfse` | `ScheduleId`, `StakeholderId`, `ServiceProfileId`, `AccrualRpsDate`, `AdditionalServiceDescription`, `AdditionalRemarks` |
| Listar serviços | `GET` (via `nibo-list-services`) | usado só na configuração admin |

Detalhes importantes aprendidos em produção:
- O bairro no NIBO é **`district`**, não `neighborhood` (erro que causava rejeição BHISS0003).
- Endereço deve ir **flat** (`line1`, `city`, `state` como strings) — objeto aninhado é rejeitado com mensagem genérica.
- `ibgeCode` do município é obtido via ViaCEP (`https://viacep.com.br/ws/{cep}/json/`, campo `ibge`) com cache em memória.
- IDs do NIBO podem vir como string JSON pura — a função `extractId` trata isso.
- `FormatType=json` no schedule é necessário para obter o `scheduleId` na resposta.

## Arquivos para ler depois

```
supabase/functions/nibo-sync-payment/index.ts        (núcleo)
supabase/functions/nibo-list-services/index.ts       (config de serviços)
supabase/functions/mercadopago-webhook/index.ts      (gatilho automático, linhas ~90-105)
supabase/functions/create-mp-payment/index.ts        (captura CPF/nome no pagamento)
supabase/functions/save-fiscal-address/index.ts      (salva endereço pós-compra)
src/components/user/CheckoutFiscalGate.tsx           (formulário fiscal no checkout)
src/components/user/FiscalAddressDialog.tsx          (modal pós-compra)
src/components/user/FiscalPendingBanner.tsx          (banner de pendência)
src/pages/Checkout.tsx                               (orquestração)
src/pages/admin/AdminNibo.tsx                        (tela admin)
src/components/admin/NiboSyncCell.tsx                (reenvio manual)
supabase/migrations/20260221201732_5678e0ea-....sql  (cpf em profiles)
supabase/migrations/20260513151136_742762b8-....sql  (nibo_sync_log)
supabase/migrations/20260513151352_289df6b2-....sql  (cron 5min)
supabase/migrations/20260513151416_0923b156-....sql  (cron 5min, ajuste)
supabase/migrations/20260513161819_91582780-....sql  (nibo_service_mappings)
supabase/migrations/20260618112627_576d99e3-....sql  (endereço em profiles + RPCs)
supabase/migrations/20260619195910_950b48d0-....sql  (skip de pedidos sem valor)
```

## Próximo passo

Nenhuma alteração neste projeto. Se quiser, posso depois montar um guia de implantação passo a passo para o outro projeto (ordem de migrations, secrets a criar, configuração do cron e da tela admin).
