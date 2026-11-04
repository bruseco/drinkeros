# Vendas recorrentes duplicadas no painel

O mesmo pagamento aprovado aparece em `vip_payments` (assinatura/acesso/NIBO)
e `purchases` (compra/CAPI). O relatório `admin_orders` só eliminava a segunda
linha quando encontrava a mesma referência externa. A rotina de recorrência
gravava o ID da fatura autorizada, mas não a chave de transação usada na compra;
por isso cada mensalidade aparecia duas vezes e inflava os totais/gráficos.

A auditoria por GETs do Mercado Pago confirmou uma cobrança de R$7 para Ana e
uma para Leonardo. Ambas tinham um registro em cada tabela, não duas cobranças.
Foram verificados também três pagamentos recorrentes anteriores com o mesmo
problema (R$7, R$87 e R$87). Nenhuma cobrança, assinatura ou notificação foi criada,
cancelada, estornada ou reenviada.

## Correção

- A rotina recorrente conserva exatamente a chave `purchases.transaction_id`
  existente: pagamento para checkout visitante, fatura autorizada para o legado.
- Essa mesma chave agora é salva em `vip_payments.metadata.purchase_transaction_id`.
  Uma notificação repetida pode completar a referência de uma linha existente,
  preservando seus demais metadados e valores.
- O relatório usa a referência para reconhecer os dois registros da mesma venda,
  mantendo a linha `vip:` já vinculada ao NIBO. Lista, contagem e gráfico usam
  a mesma função e passam a contar cada pagamento uma vez.
- A migração completa somente a referência dos cinco pares verificados no provedor.
  Exige IDs de ambos os registros, fatura e assinatura exatos, usuário e valor iguais.
  Não faz associação aproximada por horário, valor ou assinatura isolada.
- Renovações têm chaves distintas e permanecem vendas distintas.

Os registros de compra/acesso e seus valores/status são preservados. O único
UPDATE de dados acrescenta a referência de relatório nos cinco metadados VIP;
o único gatilho de UPDATE nessa tabela atualiza `updated_at`. Não há gatilho de
cobrança, CAPI ou NIBO nessa atualização. A trava `meta_capi_sent_at`, os IDs de
idempotência, as chamadas de pagamento e a liberação/renovação de acesso não mudam.

## Validação e instalação

Testes PGlite reproduzem as quatro linhas/R$28 e validam duas linhas/R$14;
preservam dois pagamentos diferentes no mesmo instante, renovações, estornos,
filtros e autorização. Testes do handler real com dependências simuladas conferem
a referência de visitante/legado e a recuperação de linha existente, com somente
GETs simulados no provedor e a mesma chave de Purchase.

Aplicar `20261104080000_admin_recurring_order_dedup.sql` e implantar somente
`mercadopago-webhook` com o novo metadado. Não publicar frontend, reenviar eventos,
executar sincronizações NIBO nem alterar qualquer objeto no Mercado Pago.
Depois, conferir no relatório ao vivo as duas pessoas e os totais do período.
