# Custos extras por fechamento RAND

O administrador adiciona uma ou mais despesas com descrição e valor em reais
(ex.: ManyChat). Cada despesa aparece como desconto no demonstrativo do mês,
depois de taxas/imposto e antes da divisão RAND 60% / Drinkeros 40%.
Não altera o faturamento, os estornos ou a base do imposto de 7%.
Os valores são manuais por mês: não existe cobrança ou repetição automática.

## Persistência e consistência

- `rand_closing_costs` guarda valores em centavos, autor, mês e data; remover uma
  linha pendente é uma exclusão lógica, conservando o registro para auditoria.
- Apenas superadministrador pode adicionar/remover por RPC. Clientes não têm
  INSERT/UPDATE/DELETE direto; fechamentos acertados/compensados são imutáveis.
- `save_rand_closing_cost` recalcula somente o demonstrativo pendente, substitui
  seu draft e incrementa a revisão sob a mesma trava dos acertos. A mudança não
  finge atualizar a consulta ao Mercado Pago: `synced_at` fica preservado.
- Outros demonstrativos baseados na revisão anterior precisam ser atualizados
  antes de confirmar ou editar; nenhum acerto usa uma confirmação antiga.
- `prepare_rand_closing` incorpora os custos no servidor após a conciliação do
  gateway. Recarregar ou atualizar não desconta o custo duas vezes.
- Custos de um mês negativo são levados para a compensação com esse mês, assim
  como os pagamentos que o compõem. Ao acertar, ficam reconhecidos no fechamento
  correspondente e não são descontados novamente em meses posteriores.
- O gatilho de reconhecimento só atua no registro do acerto pelo administrador.
  Não chama gateway, pagamentos, NIBO, e-mail ou CAPI.

## Instalação e validação

Aplicar `20261110193000_rand_extra_costs.sql` e publicar a interface sincronizada
no GitHub. Não exige implantação de edge function ou execução da IA do Lovable.
Nenhuma despesa é criada na implantação, pois os valores serão informados pelo
administrador. Setembro já acertado permanece com seu demonstrativo original.

Testes de banco verificam múltiplos custos, centavos, imposto preservado,
atualização sem duplicação, remoção lógica, confirmação invalidada, permissões,
fechamento imutável e custo de mês negativo reconhecido uma única vez. Testes
da tela verificam a entrada de valor brasileiro sem chamar gateway ou dar baixa.
