# Alinhar o desconto do Sócio do Clube (80% por 7 dias → 50%)

## O que está errado hoje

- A contagem dos 7 dias só começa quando a pessoa entra no app, não na compra. Hoje 313 sócios nunca tiveram a contagem iniciada (ficam com 80% por tempo indeterminado), 158 já estão em 50% e apenas 1 está dentro da janela.
- Os textos divergem: e-mails de renovação prometem "80% OFF em todos os cursos" sem prazo; a página de venda fala em "80% em produtos selecionados"; dentro do app o aviso mostra a regra com prazo.
- Depois da compra não existe nenhum e-mail explicando o benefício e o prazo — só uma faixa dentro do app, que pode ser fechada e nunca mais aparecer.
- Clássicos Destilados tem preço fechado de R$ 197 para sócio, o que contradiz o "80% em todos os cursos".

## O que será feito

### 1. Contagem começa na confirmação do pagamento
- Quando o pagamento do Clube é confirmado (e quando o acesso de sócio é concedido por outro caminho, como o Pacote RAND ou liberação manual), a data de início dos 7 dias passa a ser gravada na hora.
- Sócios atuais sem data registrada recebem a data da compra/ativação já existente, para deixarem de ficar num 80% sem prazo.
- O aviso dentro do app continua iniciando a contagem apenas se, por algum motivo, ela ainda não existir.

### 2. Nada de 80% "eterno"
- Quando não houver data de início, o desconto passa a ser tratado como 50% (e não 80%), tanto nas telas quanto no cálculo do preço no servidor.

### 3. E-mail de boas-vindas do Clube
- Novo e-mail enviado logo após a confirmação do pagamento do Clube, com: benefício de 80% OFF, data exata em que o benefício cai para 50%, link para os cursos e menção de que alguns cursos têm condição própria.
- Um segundo e-mail de lembrete no penúltimo dia da janela ("seu 80% acaba amanhã").

### 4. Textos alinhados
- E-mails de renovação: "80% OFF nos 7 primeiros dias e 50% OFF sempre" no lugar de "80% OFF em todos os cursos".
- Página de venda do Clube: mesma frase, com a ressalva de cursos com condição especial.
- Faixa dentro do app: já está correta; o aviso de 50% deixa de ser fechável para sempre e volta a aparecer periodicamente.
- Onde houver preço especial (Clássicos Destilados por R$ 197), o texto explica que aquele curso tem condição própria de sócio.

## Detalhes técnicos

- Banco: gravar `user_plans.discount_intro_started_at` no `mercadopago-webhook` (e nos gatilhos de concessão de plano sócio/vitalício); migração de backfill usando a data da compra do Clube (`purchases`/`vip_payments`) para os 313 registros nulos.
- `src/lib/vipDiscount.ts`: `getVipDiscountPercent` retorna `VIP_DISCOUNT_BASE_PERCENT` quando `introStartedAt` é nulo; mesma mudança replicada em `create-mp-payment`, `create-mp-checkout` e `create-product-checkout`.
- Novos templates em `supabase/functions/_shared/transactional-email-templates/`: `clube-welcome-discount.tsx` e `clube-discount-ending.tsx`, registrados em `registry.ts`; o de encerramento entra no cron de e-mails já existente.
- Ajuste de texto em `_clube-renewal-shared.tsx`, `clube-renewal-5d.tsx`, `VipLanding.tsx`, `VipLandingB.tsx` e `VipFloatingBanner.tsx`.
- `VipDiscountCountdownBanner.tsx`: aviso de 50% passa a usar dispensa por sessão em vez de permanente.
- Nenhuma mudança em checkout, tracking (Pixel) ou PWA.

## Como testar

1. Comprar o Clube com uma conta nova: o e-mail de boas-vindas deve chegar com a data de fim do 80%.
2. Abrir um curso logo depois: preço com 80% e faixa com contagem regressiva.
3. Em Admin → Usuários, um sócio antigo sem data deve passar a exibir 50% e preço coerente no checkout.
