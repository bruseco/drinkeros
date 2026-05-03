## Contexto

Dois problemas:

1. **Erro "Edge Function returned a non-2xx"** — o `PRICE_PIX` (`price_1TSyMzGlXZFgg9249bdDQHbB`) não existe na conta Stripe **live**. Foi criado em modo teste. Por isso o checkout quebra ao escolher Pix.

2. **UX do toggle** — você prefere a experiência antiga, onde o Pix aparecia "naturalmente" como opção dentro do Stripe Checkout, sem toggle externo.

## Limitação técnica importante

O Stripe **não permite Pix no modo `subscription`**. Pix só funciona em `mode: "payment"` (cobrança única). Então não dá para mostrar Pix + Cartão lado a lado dentro de um único Stripe Checkout que também seja recorrente. Precisamos escolher antes de redirecionar:

- **Cartão** → `mode: subscription` (renovação automática, silenciosa, só avisa se falhar)
- **Pix** → `mode: payment` (1x, 12 meses, dispara lembretes de renovação)

Como o toggle ficou pesado visualmente, vou trocar por um link discreto.

## Plano

### 1. Criar o Price de Pix no Stripe live
Criar um novo price one-time R$ 69 BRL no produto `prod_UMyp07z2Rx5wUF` em modo live, e atualizar a constante `PRICE_PIX` em `supabase/functions/create-club-checkout/index.ts`.

### 2. Remover o toggle Cartão/Pix em `src/pages/VipLanding.tsx`
- Remover os botões `Cartão` / `Pix` e o estado `method`.
- O CTA principal **"Quero ser Sócio do Clube"** vai direto para o checkout no modo cartão (assinatura anual com renovação automática).
- Adicionar logo abaixo do botão um link sutil em texto:
  `Prefiro pagar via Pix (pagamento único, 12 meses de acesso)`
  Esse link chama o mesmo edge function passando `method: "pix"`.

### 3. Reforçar o fluxo de falha de cartão
Confirmar que o `stripe-webhook` em `invoice.payment_failed` já bloqueia acesso (limpa/expira `user_plans`) e dispara e-mail. Se faltar algo, ajustar para:
- Marcar o plano como expirado/suspenso imediatamente.
- Enviar e-mail "Não conseguimos renovar sua assinatura — atualize seu cartão".

### 4. Lembretes Pix
Já estão funcionando via `send-renewal-reminders` baseado em `expires_at`. Sem mudanças.

## Resultado para o cliente

- 1 botão dourado dominante = caminho recomendado (cartão / renovação silenciosa).
- 1 link discreto = Pix (com lembretes ativos).
- Sem toggle competindo com o CTA.
- Cobrança Pix volta a funcionar (price live corrigido).
