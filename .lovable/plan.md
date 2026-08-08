# Corrigir erro no pagamento (checkout em produção)

## O que está acontecendo

O checkout em drinkeros.com está **rejeitando todos os pagamentos** com "Erro no pagamento — Edge Function returned a non-2xx status code".

Causa confirmada:

- A função `create-mp-payment` (já no ar) exige **nome completo** nos dados fiscais e devolve erro 400 (`fiscal_incomplete`) quando ele não vem.
- O **site publicado está numa versão antiga** do formulário fiscal: o bundle em produção (`/assets/index-C5znGema.js`) monta o payload fiscal **sem o campo `full_name`** e não conhece o código `fiscal_incomplete`.
- Resultado: toda compra é bloqueada no servidor por "faltando: nome completo", e o front antigo não sabe traduzir o erro — mostra a mensagem genérica e não reabre o formulário.
- Os logs da função confirmam: duas invocações às 15:31 UTC, nenhuma delas chegou ao Mercado Pago (nenhum log de pagamento criado), ou seja, pararam na validação fiscal.

## Correção

1. **Publicar a versão atual do app** (correção principal). O código no projeto já envia `full_name`, trata `fiscal_incomplete` e reabre o formulário fiscal. Sem publicar, o site continua na versão antiga.
2. **Tornar o servidor tolerante** em `create-mp-payment`: quando `fiscal.full_name` não vier, tentar nesta ordem
   - nome do perfil do usuário logado (`profiles.full_name`);
   - nome enviado pelo Mercado Pago no `formData.payer` (first_name + last_name);
   - só então bloquear com `fiscal_incomplete`.
   Isso evita que uma versão antiga em cache no navegador/PWA de um cliente derrube a venda.
3. **Logar o bloqueio fiscal** (hoje esse caminho retorna 400 sem nenhum log), registrando quais campos faltaram, para que o diagnóstico futuro seja imediato nos logs.
4. **Melhorar a mensagem de erro no checkout**: quando o corpo do erro não puder ser lido, mostrar "Não foi possível concluir o pagamento. Recarregue a página e tente novamente." em vez do texto técnico da Edge Function.

## Detalhes técnicos

- `supabase/functions/create-mp-payment/index.ts`: fallback de nome antes do bloco `missingFiscal`, `console.warn` com os campos faltantes antes do retorno 400, e redeploy da função.
- `src/pages/Checkout.tsx`: fallback de mensagem no `catch` do `onSubmit` (sem alterar a lógica de tracking nem o fluxo de Pix/cartão).
- Nenhuma mudança de banco, de preço, de PWA ou de eventos do Meta Pixel.

## Como testar

1. Publicar e abrir drinkeros.com em janela anônima (para não pegar bundle em cache).
2. Ir para /rand → Comprar → preencher CPF, nome e endereço como visitante → pagar com Pix: deve gerar o QR Code.
3. Repetir logado com perfil completo: deve ir direto ao pagamento, sem erro.
4. Conferir nos logs da função a linha de pagamento criado (e, em caso de bloqueio, o novo log com os campos faltantes).
