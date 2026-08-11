# Plano de teste cross-device do checkout /rand

## Objetivo
Rodar um teste de fumaça no fluxo de compra do **Pacote RAND** (`/rand`) em diferentes dispositivos simulados, **sem alterar código**, para identificar onde o funil pode estar quebrando para iOS, Android ou desktop.

## Escopo do teste
- Apenas leitura/observação. Nenhuma alteração de código ou banco de dados.
- Foco no fluxo: landing `/rand` → clique "QUERO O PACOTE RAND" → checkout → escolha de pagamento (cartão/Pix) → tela de confirmação/Pix.
- Dispositivos simulados: iPhone Safari, Android Chrome, desktop Chrome.

## Técnica
Usar Playwright via shell com user-agents e viewports representativos:

- **iPhone 14 Pro (Safari)** — viewport 393×852, dpr 3, user-agent iOS Safari 16.
- **Pixel 7 (Android Chrome)** — viewport 412×915, dpr 2.625, user-agent Chrome Android.
- **Desktop Chrome** — viewport 1280×900, dpr 1.

Para cada dispositivo, o script irá:
1. Abrir `/rand` e aguardar renderização.
2. Capturar screenshot da landing completa.
3. Registrar console logs e erros de rede.
4. Rolar até a seção de preço e aguardar a oferta (1s após a seção visível).
5. Clicar no botão de aceitar o desconto.
6. Clicar em "QUERO O PACOTE RAND" e aguardar navegação para checkout.
7. No checkout, capturar screenshot do estado inicial.
8. Preencher dados fiscais fictícios (CPF, nome completo, endereço completo).
9. Alternar entre cartão e Pix para verificar se ambos renderizam.
10. Parar antes de submeter pagamento real (teste de fumaça, sem transação financeira).

## Entregáveis
1. Relatório com prints de cada etapa por dispositivo.
2. Lista de console errors/warnings por dispositivo.
3. Observações de UI/UX (botões cortados, teclado cobrindo campos, QR code não renderiza, etc.).
4. Recomendação de próximos passos se algum ponto de falha for encontrado.

## Restrições
- Não criar, alterar ou deletar arquivos do projeto (exceto `.lovable/plan.md`).
- Não executar comandos que modifiquem estado do banco ou servidores.
- Scripts Playwright serão salvos em `/tmp/browser/` para não poluir o repositório.
