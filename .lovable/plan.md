

## Rodar retry-failed-messages para reenfileirar mensagens com erro 131042

### Ação

Invocar a edge function `retry-failed-messages` com `action: "retry_131042"` para reenfileirar as 544 mensagens que falharam com o erro de pagamento da Meta.

### Detalhe técnico

1. **Primeiro em dry run** (`dryRun: true`) para confirmar o número exato de mensagens a serem reenfileiradas e a distribuição por source (upsell, welcome, CRM, etc.)
2. **Depois em modo real** (`dryRun: false`) para efetivamente inserir na `whatsapp_send_queue` e marcar as mensagens originais como `retry_queued`
3. A função processa em lotes de 200 — se houver mais de 200, será necessário invocar múltiplas vezes (campo `hasMore` na resposta)

### Pré-requisito

O pagamento da Meta precisa estar regularizado antes da execução real. Caso contrário, as mensagens reenfileiradas falharão novamente com o mesmo erro 131042.

### Resultado esperado

- ~544 mensagens inseridas na fila de envio com prioridades adequadas por tipo (welcome=8, CRM=7, upsell=5, etc.)
- Mensagens originais marcadas como `retry_queued` para evitar reprocessamento duplicado

