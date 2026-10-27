# Quiz: ícones versus ilustrações

- Entrada dos anúncios: `/quiz`. Divisão 50/50, sorteada no primeiro acesso e preservada neste navegador em localStorage (sessionStorage/memória como fallback).
- A usa ícones; B usa as 15 ilustrações aprovadas. A mantém quadrinhos de 96 px e texto de 17 px. B usa duas colunas, artes responsivas de até 192 px e texto de 18–19 px, centralizados na vertical. O teste compara o conjunto visual; perguntas, respostas, ofertas e lógica de pagamento são idênticas.
- Prévia: `/quiz?quiz_preview=a` ou `/quiz?quiz_preview=b`. Não altera a atribuição do visitante, não registra eventos do funil do quiz e não libera compra. O rastreamento global existente do site não foi alterado.
- O painel tem um único cartão do quiz. Nos detalhes, comparação A/B e resultados por landing, incluindo pagamentos aprovados vinculados à sessão da oferta. Histórico sem identificação fica sem atribuição.
- Cada etapa é contada no período do seu evento. Compras são pedidos aprovados no período, não uma coorte de visitantes nem prova causal de conversão.
- A atribuição da compra usa o primeiro evento com variante válida e identificador da sessão da oferta anterior à criação do pedido. Não infere variante só por horário.
- Migração `20261027223000_quiz_art_experiment_reporting.sql`: apenas função administrativa de leitura, sem mudar preço, prazo ou cobrança. Instalada e registrada no servidor.
- As artes foram geradas com image_gen e aprovadas antes da aplicação, otimizadas para JPEG de até 384 px. O conjunto ocupa menos de 1 MB; só as imagens da pergunta renderizada são baixadas.

Validação: 178 testes, TypeScript e compilação; navegador isolado em 22 percursos, parâmetros UTM/fbclid e eventos por variante, zero criação de pagamento. Interface deve ser publicada pelo responsável no Lovable após sincronização.
