# BLACK80 — 2026

Escopo aprovado: 80% sobre o preço de tabela, sem acumular descontos, de 26/11 até 05/12/2026 às 23h59 de Brasília (fim exclusivo 06/12 03:00 UTC). RAND mantém as condições existentes. Clube mensal mantém R$7 e cartão, sem descontos. Nova contratação anual fica em R$47. Não altera assinaturas existentes, webhooks, acesso adquirido, CAPI ou pagamentos já criados.

Banners na área logada e nas páginas de venda levam a /black80, com catálogo dinâmico e checkout existente. Desconto aplicado automaticamente, BLACK80 é o nome da campanha; não exige digitação de cupom. Preços são validados também no servidor. Quiz mantém prazo/atribuição e recebe a melhor condição sem acumular.

## Instalação e ativação

A campanha nasce DESATIVADA. Não habilitar apenas o banner: preços devem estar disponíveis nas funções antes de anunciar.

1. Aplicar 20261126120000_black80_campaign.sql no banco (registrar versão, sem reaplicar dados antigos).
2. Instalar estas três funções, preservando suas configurações atuais de autenticação:
   - create-mp-payment
   - create-mp-checkout
   - club-guest-checkout
3. Confirmar via GET nos três endpoints que a resposta contém black80_version: 1. Não criar pagamento para verificar implantação.
4. Publicar a interface pelo Lovable, etapa feita pelo proprietário.
5. Depois de confirmar os preços em teste isolado, habilitar: UPDATE public.black80_campaign SET enabled=true WHERE id=true;

O acesso CLI atual retornou 403 para gerenciamento de funções. Nenhuma função foi instalada por essa conexão e não foi usada IA do Lovable. A flag fica falsa até completar a instalação.

Desligar antecipadamente: UPDATE public.black80_campaign SET enabled=false WHERE id=true;
O prazo encerra automaticamente no servidor e no cliente. Condições VIP e ofertas anteriores voltam a valer sem restaurar tabelas de preços. Não alterar valores nem assinaturas no gateway para encerrar a promoção.

Para novas assinaturas anuais no cartão, o valor confirmado na contratação integra o plano recorrente anual; assinaturas já existentes são preservadas.

## Conferência

- Mixologia R$797 → R$159,40; Xperience R$497 → R$99,40; Pack R$147 → R$29,40.
- RAND não muda; mensal continua R$7; anual R$47.
- Testes cobrem prazo de Brasília, flag desativada, não acumulação, preços SQL do quiz/anual, controle de acesso e repetição do checkout sem segunda cobrança.
- Nenhum teste cria pagamento real.
