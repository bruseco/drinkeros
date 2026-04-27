
## Objetivo

Hoje as landings prometem "12x de R$ X" mas o Stripe Checkout só aceita 1x. Vamos habilitar o **parcelamento com juros do emissor** no Stripe — o cliente vê e escolhe as parcelas (com juros do banco dele), e a Drinkeros recebe o valor cheio à vista (descontada a taxa Stripe). Os juros ficam entre cliente ↔ banco emissor, como você pediu.

## O que muda

### 1. Edge Function `create-product-checkout` (cursos + ebooks)
Adicionar nas opções da sessão Stripe:
```ts
payment_method_types: ['card'],
payment_method_options: {
  card: { installments: { enabled: true } }
}
```
Isso ativa automaticamente os planos de parcelamento elegíveis (Stripe calcula com base no valor — normalmente 2x até 12x, parcela mínima ~R$ 5).

### 2. Edge Function `create-vip-checkout` (Clube dos Drinkeros)
Vou inspecionar o arquivo para ver se é `mode: payment` (one-time anual) ou `mode: subscription`:
- **Se `payment`** → habilita parcelamento igual aos cursos.
- **Se `subscription`** → Stripe não permite parcelar assinatura no BR. Nesse caso aviso e mantemos à vista (e ajusto o copy da landing do Clube se necessário).

### 3. Ação manual no painel Stripe (você faz, eu mostro o caminho)
Stripe Dashboard → **Settings → Payments → Payment methods → Cards → Installments (Brazil)** → ativar.
Sem isso, o parâmetro acima não tem efeito. É um toggle único, vale para toda a conta.

### 4. Ajuste de copy nas landings (opcional, recomendado)
Hoje a landing mostra "12x R$ X" sem mencionar juros. Como o cliente verá juros do emissor no checkout, sugiro trocar para:
> "**em até 12x no cartão** *(parcelas com juros do seu banco)*"

Ou manter "12x R$ X" + asterisco "*sujeito a juros do emissor*". Te pergunto qual prefere antes de mexer.

## Detalhes técnicos

- O parâmetro `payment_method_options.card.installments.enabled` é compatível com a API version já usada (`2025-08-27.basil`).
- Quando `installments` está habilitado, **Pix e boleto não aparecem na mesma sessão** (Stripe limita a `card` only). Preciso confirmar com você se hoje vocês oferecem Pix/boleto no checkout — se sim, decidimos:
  - **Opção A**: cartão parcelado apenas (perde Pix/boleto).
  - **Opção B**: deixa Stripe escolher automaticamente (`automatic_payment_methods`) e parcelamento fica desabilitado.
  - **Opção C**: 2 botões na landing — "Pagar à vista (Pix/Cartão)" vs "Parcelar no cartão".
- O cálculo de juros é 100% feito pelo emissor do cartão (Itaú, Nubank, etc.) e exibido pelo Stripe no checkout — você não precisa configurar tabela de juros.

## Perguntas antes de eu implementar

1. **Clube dos Drinkeros é assinatura recorrente ou pagamento único anual?** (vou verificar no código também, mas confirma).
2. **Vocês oferecem Pix/boleto hoje no checkout?** Isso decide entre Opção A/B/C acima.
3. **Copy das landings**: trocar "12x R$ X" por "em até 12x *(com juros do seu banco)*"?

Depois das respostas eu implemento as 2 edge functions e ajusto as landings se necessário. Você só precisa ligar o toggle no painel Stripe (te passo o link exato).
