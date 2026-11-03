# Isolamento Drinkeros / NextBar no Stripe

## Investigação anterior à edição — 3 de novembro de 2026

`supabase/functions/stripe-webhook/index.ts` verificava a assinatura Stripe,
mas não a aplicação dona do evento. Uma assinatura válida da conta compartilhada
comprova que o evento veio do Stripe, não que a venda pertence ao Drinkeros.

Em `checkout.session.completed`, o código reconhecia cursos/e-books por
`metadata.product_type` e os anuais por `metadata.plan_kind`. O restante caía
no fluxo de Clube recorrente, inclusive sessões `mode=payment` desconhecidas.
`client_reference_id` era aceito como usuário sem verificar um perfil.
`invoice.paid`, `invoice.payment_failed` e `customer.subscription.deleted`
também não verificavam a origem. O cliente compartilhado não é evidência de origem.

Registros consultados somente por leitura:

| Sessão | Valor | Classificação gravada | app / plan_kind | CAPI marcado |
| --- | --- | --- | --- | --- |
| `cs_live_a1Gc7ot0…` | R$297,00 | club / Clube dos Drinkeros | ausentes | sim |
| `cs_live_a1Zr4rTS…` | R$48,50 | club / Clube dos Drinkeros | ausentes | sim |
| `cs_live_a1abQRK6…` | R$97,00 | club / Clube dos Drinkeros | ausentes | sim |

Os três têm `user_id` preenchido, mas não têm `buyer_email` nem perfil com
e-mail correspondente. Isso explica por que uma consulta exigindo `user_id IS NULL`
não os encontra.

Conferência adicional no Workbench da conta autenticada, em 3 de novembro:
os três eventos originais contêm `metadata.produto=nextbar`,
`metadata.tipo=mensalidade_pix`, `mode=payment`, `subscription=null` e URLs de
sucesso/cancelamento em `nextbar.com.br`. As três entregas mostram HTTP 200 tanto
no endpoint Drinkeros (`pvjlcfhqueibjnkuzzna.../stripe-webhook`) quanto no outro
endpoint (`sdwodgnkhvurmyxynhhb.../stripe-webhook-main`). Assim, a origem NextBar
desses três casos foi confirmada diretamente, não inferida apenas do banco.
O `user_id` gravado corresponde a `metadata.user_id` do NextBar; nesses eventos,
`client_reference_id` é nulo. O caminho genérico aceitava esse metadata estrangeiro.
Os eventos têm `customer_details.email`, embora `purchases.buyer_email` tenha
ficado vazio porque o caminho genérico não repassava o e-mail ao registro da compra.
Nenhum registro histórico foi apagado, reclassificado ou reenviado. Os outros
candidatos da consulta ampliada ainda precisam de verificação individual.

## Correção

- As quatro funções que criam Checkout Sessions Stripe gravam `metadata.app=drinkeros`.
- Também marcam `subscription_data.metadata` ou `payment_intent_data.metadata`.
  O checkout VIP legado agora define explicitamente `plan_kind=club_card_subscription`.
- Depois da validação da assinatura e antes de criar o cliente Supabase, o webhook
  exige a marca da aplicação e um produto/plano reconhecido. Cliente, usuário,
  e-mail, valor, nome comercial e compras anteriores não autorizam um evento.
- Evento sem marca, ou com outra aplicação: HTTP 200, log `ignored_foreign_event`,
  zero gravação, liberação, e-mail, NIBO ou CAPI.
- Evento Drinkeros sem produto/plano suportado: HTTP 200,
  `ignored_unknown_product`; nunca é convertido implicitamente em Clube.
- Faturas usam o snapshot `parent.subscription_details.metadata` (ou o formato
  legado `subscription_details.metadata`); na ausência da marca no snapshot,
  consultam a assinatura vinculada. Uma marca estrangeira explícita não é substituída.
  Falha temporária na consulta retorna 500 para retentativa, sem efeitos colaterais.
- Cancelamentos verificam metadata da própria assinatura.
- Pagamentos só são liberados com `payment_status=paid`; o evento
  `checkout.session.async_payment_succeeded` usa o mesmo caminho para pagamentos
  assíncronos. Ative esse tipo no endpoint ao instalar a correção.
- Compras novas aceitas preservam `app=drinkeros` em `purchases.metadata`.
  O helper de CAPI, sua trava `meta_capi_sent_at` e as chaves de idempotência
  existentes não foram alterados.
- Mercado Pago e Pixel do front não foram tocados. API e SDK Stripe permanecem
  nas versões existentes; esta correção não faz uma migração de versão.

## Revisão histórica, sem exclusão

Execute `supabase/queries/review_foreign_stripe_purchases.sql`.
São dois SELECTs: a lista estrita solicitada e outra que inclui referências de
usuário sem perfil/e-mail. Na consulta de 3 de novembro: 0 candidatos estritos,
17 ampliados. Ausência de marca em dados antigos é um sinal de revisão, não uma
lista segura para exclusão automática. Confira os objetos Stripe antes de remover.

## Instalação e legado

1. Instalar as quatro funções criadoras com metadata antes do webhook atualizado.
2. Auditar assinaturas ativas e sessões em andamento criadas antes desta correção.
   Assinaturas/sessões sem marca serão ignoradas por segurança. Marcar somente
   objetos comprovadamente Drinkeros, com o plano/produto explícito correto;
   nunca marcar em massa por cliente, nome ou valor. Não houve backfill automático.
3. Instalar `stripe-webhook` incluindo `_shared/stripeEventScope.ts`; habilitar os
   eventos usados, inclusive `checkout.session.async_payment_succeeded`.
4. Validar com eventos de teste separados: NextBar e não marcado retornam 200
   sem efeitos; Drinkeros reconhecido mantém a gravação/CAPI idempotente.
   Não reenviar compras reais indiscriminadamente.

O commit prepara o código; não muda a configuração da conta Stripe nem instala
funções automaticamente. Nenhuma cobrança foi criada durante os testes.

## Separação recomendada

Use endpoints e segredos de assinatura separados para cada aplicação, recebendo
somente os tipos de evento necessários. Na configuração convencional de webhook,
o Stripe seleciona tipos de evento; um endpoint separado na mesma conta **não**
filtra automaticamente `metadata.app`. A filtragem por aplicação continua no
handler. Uma chave restrita dedicada reduz permissões, mas também não isola os
eventos por produto dentro da conta compartilhada. Contas Stripe separadas dão
isolamento real entre os negócios. Nenhuma alteração de conta/chave foi realizada.

Referências oficiais:
- https://docs.stripe.com/metadata — propagação explícita para assinatura e PaymentIntent.
- https://docs.stripe.com/webhooks — assinatura, endpoints e seleção de tipos de evento.
- https://docs.stripe.com/keys#restricted-api-keys — permissões por chave.

## Validação

Testes isolados exercitam o handler real com dependências de borda simuladas:
assinatura inválida, os três exemplos, faturas/cancelamentos estrangeiros,
produto desconhecido, falha de consulta, pagamento pendente e anual reconhecido.
O teste confirma que eventos estrangeiros não chegam sequer a criar cliente
Supabase ou chamar CAPI. Nenhum teste usa sessões, clientes ou pagamentos reais.
