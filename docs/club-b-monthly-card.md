# Clube B: assinatura mensal no cartão

- A mantém sua página, oferta anual e cartão/Pix. Assinaturas e tentativas anuais existentes não mudam.
- B anuncia R$ 7/mês, recorrente, sem compromisso anual e sem Pix. Todos os CTAs de compra usam `/checkout/club/clube-mensal-b`; UTM/fbclid são preservados.
- O checkout mensal usa CardPayment Brick, limitado a crédito e uma parcela. Não há seletor de meio, login, senha ou endereço fiscal antes da cobrança. O e-mail e os campos exigidos pelo processador continuam necessários.
- A cotação mensal, a frequência e o preço são fixados no servidor. Pix, preço adulterado e tentativas de outro plano são recusados. Chaves de retomada anual/mensal são distintas.
- Uma autorização de assinatura não libera acesso. Somente a cobrança confirmada libera o mês pago. A expiração usa a data efetiva da aprovação e um mês de calendário, para que replays não prolonguem o acesso.
- A RPC mensal preserva acessos anuais mais longos e vitalícios. O cancelamento existente do Mercado Pago interrompe renovações sem remover o período pago.
- O Pixel/CAPI mantém seu fluxo; o valor da compra vem do pagamento aprovado. O relatório A/B existente conta o primeiro pagamento por atribuição, não renovações.
- Este lote inaugura outra oferta na B. Comparações futuras devem começar na publicação deste teste mensal; dados da antiga B anual não representam a mesma oferta.

## Instalação

1. Aplicar `20261031090000_club_b_monthly_card.sql` e registrar a versão no ledger.
2. Instalar `club-guest-checkout` e `mercadopago-webhook`, com seus módulos compartilhados.
3. Publicar a interface pelo Lovable. O checkout mensal falha fechado se encontrar a versão antiga do servidor.

Nenhuma assinatura existente deve ser alterada ou cobrada durante a instalação. Os testes usam processador simulado. Confirmar a primeira assinatura real após a publicação; testes isolados não comprovam aprovação bancária em produção.

Referência: https://www.mercadopago.com.br/developers/en/reference/online-payments/subscriptions/create-preapproval/post.md
