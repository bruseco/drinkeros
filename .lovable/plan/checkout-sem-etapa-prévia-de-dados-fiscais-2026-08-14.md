# Checkout sem etapa prévia de dados fiscais

## Respondendo à dúvida
Sim. O formulário do Mercado Pago (Payment Brick) devolve o CPF e o nome do titular em `formData.payer.identification.number` e no nome do cartão — e no Pix o próprio Brick também pede nome, CPF e e-mail. Ou seja, dá para eliminar a etapa 1 (anexo 2) e capturar CPF direto do que o cliente digitou no Mercado Pago.

Uma ressalva: no cartão, o nome vem como está impresso no cartão (às vezes abreviado). Por isso o nome completo continua sendo pedido no modal pós-pagamento, já preenchido com o que veio do Mercado Pago para o cliente apenas confirmar.

## O que será feito

### 1. Remover a etapa de dados fiscais antes do pagamento
- O checkout abre direto na escolha de cartão/Pix, sem card bloqueante e sem opacidade no formulário.
- CPF, nome e e-mail passam a vir do próprio formulário do Mercado Pago e são gravados no perfil do usuário logo após o pagamento.
- O backend deixa de bloquear o pagamento por falta de nome/CPF: se o Brick não enviar CPF (caso raro), o pagamento segue e os dados são cobrados no modal pós-compra.

### 2. Modal pós-pagamento com nova mensagem
Texto: "Precisamos emitir sua nota fiscal. Por favor preencha esses dados obrigatórios para você ter a garantia do seu produto."
- Campos: nome completo (pré-preenchido do Mercado Pago), CPF (pré-preenchido e travado quando já capturado), CEP, rua, número, complemento, bairro, cidade, UF.
- O cliente pode pular — o acesso já está liberado.

### 3. Aviso amarelo fixo no topo do app
- Banner amarelo dentro do app para quem tem compra mas está com dados fiscais incompletos (CPF ou endereço), com botão "Completar dados fiscais" que abre o mesmo modal.
- Some assim que os dados ficarem completos.

### 4. Perfil — Dados pessoais
- Os campos fiscais já existem em Dados pessoais; serão destacados com o mesmo aviso de pendência para o cliente completar por lá também.

## Detalhes técnicos
- `src/pages/Checkout.tsx`: remove o gate `CheckoutFiscalGate`, envia `fiscal` derivado do `formData` do Brick e sempre abre o `FiscalAddressDialog` pós-pagamento quando faltar endereço.
- `supabase/functions/create-mp-payment`: valida apenas o essencial (e-mail + valor); persiste CPF/nome vindos do Brick no perfil quando ausentes.
- `src/components/user/FiscalAddressDialog.tsx`: novo texto, campo de nome completo e CPF pré-preenchidos.
- Novo `FiscalPendingBanner` renderizado no `UserLayout`, alimentado por consulta simples ao perfil + existência de compra.
- Sem mudanças em tracking (Meta Pixel), PWA ou autenticação.
