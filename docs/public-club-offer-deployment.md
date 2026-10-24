# Oferta pública do Clube: prazo real de quinze minutos

O banco já recebeu a migração `20261024220000_public_club_offer_deadline.sql`, registrada no histórico de migrações. Os preços e o prazo são definidos pelo servidor. Uma oferta ativa não se renova ao recarregar ou fazer login; depois de expirar, uma nova entrada na página pode apresentar outra oferta. O contador se refere à oferta daquela visita.

## Instalação necessária

Publicar as funções existentes `create-mp-payment` e `create-mp-subscription`, incluindo o módulo compartilhado `_shared/publicClubPrice.ts`, exatamente a partir deste código. Não criar cobranças de teste, alterar segredos, assinaturas existentes ou a concessão de acessos. Não é necessário usar o chat para recriar o código.

As duas funções respondem a GET com `public_club_offer_version: 1`. A página só ativa o novo prazo quando ambas confirmam essa versão; até lá mantém o comportamento anterior, sem anunciar expiração.

Publicar a interface pelo fluxo habitual do proprietário. Na página pública, revelar a oferta, verificar a faixa de prazo e o preço; antes de pagar, o checkout reconsulta o servidor. Se o prazo acabou ou o valor mudou, exige revisão e nova confirmação, sem cobrar o valor maior silenciosamente.

## Verificação

- `node scripts/test-public-club-offer-db.mjs`
- `npm test`
- `npx tsc --noEmit -p tsconfig.app.json`
- `npm run build`
- `deno check supabase/functions/create-mp-payment/index.ts supabase/functions/create-mp-subscription/index.ts`

Os testes cobrem conta/visitante, prazo imutável durante a oferta, reabertura após expiração, isolamento entre contas, preço de R$197 expirado e rejeição de uma tela antiga de R$97. Nenhum teste gera pagamento real.
