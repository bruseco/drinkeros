## Objetivo

Sempre que um pagamento for confirmado (Stripe, Mercado Pago ou Clube), o sistema:
1. Cria/atualiza o cliente (stakeholder) no NIBO
2. Cria um agendamento de recebimento já marcado como recebido, na categoria **101 – Infoprodutos e Cursos**
3. Dispara a emissão automática da NFS-e

Tudo no backend, idempotente (não duplica em reprocessos de webhook).

---

## Pré-requisitos (vou pedir via formulário seguro de secrets)

1. **NIBO_API_TOKEN** — token de API (NIBO Premium). Encontrado em: *Empresa → Mais opções → Configurações → API*
2. **NIBO_ACCOUNT_ID** — ID da conta financeira onde o recebimento entra (ex.: "Conta Stripe / Mercado Pago / Caixa")
3. **NIBO_SERVICE_PROFILE_ID** — perfil de serviço usado para a NFS-e (já configurado no NIBO com CNAE, alíquota ISS, descrição padrão, etc.)
4. **NIBO_CATEGORY_ID** — ID da categoria única **"101 – Infoprodutos e Cursos"**

> Mudança em relação ao plano anterior: **uma categoria única**, não 5. Os produtos viram diferentes pelo nome do agendamento ("Descrição") e pelo número de referência (`Ref`), igual ao que aparece hoje no seu NIBO.

---

## O que aparece em cada agendamento criado

Inspirado no padrão que você já usa:

| Campo NIBO | Origem |
|---|---|
| **Nome (stakeholder)** | `profiles.full_name` |
| **CPF** | `profiles.cpf` (já coletado no checkout MP e no perfil) |
| **Descrição** | Nome do produto (ex.: "Clube dos Drinkeros – Anual", "Pacote 7 Anos Drinkeros", "Drink Delivery & Engarrafados") |
| **Ref** | `order_ref` interno (ex.: `course:UUID:user:UUID:timestamp`) |
| **Categoria** | sempre `NIBO_CATEGORY_ID` (101 – Infoprodutos e Cursos) |
| **Valor** | `amount` da venda |
| **Data agendamento / vencimento / recebimento** | data do pagamento confirmado |

---

## O que muda no produto

### Para você
- Nada visível no app do aluno.
- Em **Admin → Pedidos**: nova coluna **NIBO** com badge (Pendente / Enviado / NFS-e emitida / Erro) e botão "Reenviar para NIBO" para corrigir falhas.

### Para o cliente final
- Nada muda. NF chega normalmente conforme NIBO já emite hoje.

---

## Como vai funcionar (técnico)

### 1. Tabela `nibo_invoices` (controle e idempotência)
Campos: `order_ref` (único), `product_type`, `user_id`, `amount`, `nibo_stakeholder_id`, `nibo_schedule_id`, `nibo_invoice_id`, `status` (pending / sent / invoiced / error / pending_cpf), `error_message`, `attempts`, timestamps.

A unicidade do `order_ref` impede duplicatas mesmo que Stripe/MP reenviem o webhook.

### 2. Edge function `nibo-sync`
Recebe `{ order_ref }` e executa:
1. Lê venda + perfil do comprador
2. Busca/cria stakeholder no NIBO (`POST /v1/customers`), deduplicando por CPF
3. Cria agendamento de recebimento já recebido (`POST /v1/schedules/receivable`) com a categoria 101
4. Emite NFS-e (`POST /v1/invoices/serviceinvoice`) com o `scheduleId` + `serviceProfileId`
5. Atualiza `nibo_invoices` com IDs e status. Erro → guarda mensagem para reprocesso

Header padrão: `apitoken: $NIBO_API_TOKEN`. Base URL: `https://api.nibo.com.br/v1/...`

### 3. Disparos automáticos
- `supabase/functions/stripe-webhook/index.ts` — após gravar venda
- `supabase/functions/mercadopago-webhook/index.ts` — após gravar venda
- Cron a cada 15 min reprocessa `status = 'error'` com `attempts < 5`

### 4. CPF
Lê `profiles.cpf`. Se faltar:
- Stakeholder criado no NIBO sem CPF
- Status fica `pending_cpf`
- Cron tenta novamente quando o usuário completar o CPF no perfil

### 5. Painel admin
Em `src/pages/admin/AdminOrders.tsx`:
- Coluna "NIBO" com badge de status
- Drawer com IDs do NIBO, mensagem de erro e botão "Reenviar"

---

## Ordem de implementação

1. Pedir os 4 secrets (NIBO_API_TOKEN, NIBO_ACCOUNT_ID, NIBO_SERVICE_PROFILE_ID, NIBO_CATEGORY_ID)
2. Migração: tabela `nibo_invoices` + RLS (admin only)
3. Edge function `nibo-sync` (cliente HTTP, retry, idempotência)
4. Edge function `nibo-retry-failed` agendada por cron a cada 15 min
5. Hooks nos webhooks Stripe e Mercado Pago
6. UI no AdminOrders: coluna + botão reenviar
7. Teste com 1 venda real em cada provedor

---

## Riscos e suposições

- **Suposição:** plano NIBO Premium (necessário para a API).
- **Suposição:** o `ServiceProfileId` já está configurado no NIBO com tributação correta — ele dita o cálculo de impostos e a descrição padrão da NF.
- **Risco:** prefeituras às vezes rejeitam NFS-e por dados incompletos do tomador. Esses casos ficam como erro no NIBO; o painel mostra o status, mas a correção fiscal é feita lá no NIBO.
- **Compras antigas (anteriores à integração):** não enviadas retroativamente. Se quiser, posso adicionar depois um botão "enviar para NIBO" também na lista existente.

Confirme e eu já peço os 4 secrets para começar a implementação.