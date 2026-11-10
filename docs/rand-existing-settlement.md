# Registro de acerto já realizado

Um demonstrativo pendente com mais de dez minutos bloqueava o botão, mesmo
quando os repasses já tinham sido realizados fora do sistema. Atualizar os dados
nessa situação poderia modificar os valores do acerto histórico.

O botão agora permite ao superadministrador confirmar explicitamente um acerto
já realizado, mostrando os valores do demonstrativo salvo. Usa a nova RPC
`record_rand_closing_settled` para esse caso; o fluxo normal continua usando
`mark_rand_closing_paid` e sua exigência de atualização recente.

A nova RPC valida papel, mês disponível, ID do demonstrativo, valor RAND
confirmado, revisão do controle, sequência dos fechamentos e saldo não negativo.
Preserva report e synced_at. Somente depois do clique de confirmação registra
paid_at/paid_by, reconhece os saldos dos pagamentos e avança a revisão, com a
mesma trava e idempotência do fluxo normal. Não transfere dinheiro nem chama
Mercado Pago, CAPI, NIBO ou ferramenta de IA. Não altera percentuais ou despesas.

Setembro/2026 e R$2.299,15 foram confirmados pelo administrador na conversa.
Nenhuma baixa foi feita durante a implantação; o administrador fará a confirmação
na interface. Outubro precisará ser atualizado depois de registrar setembro,
pois a revisão do controle será incrementada.

Instalar somente a migração `20261110190000_rand_existing_settlement.sql`,
sincronizar o commit no GitHub e publicar a interface pelo proprietário.
Não requer execução da IA do Lovable ou implantação de edge function.
