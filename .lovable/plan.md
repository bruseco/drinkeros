# Demonstração segura do pós-compra RAND

## Objetivo
Disponibilizar uma visualização fiel da oferta pós-compra sem consultar compradores, registrar oferta, iniciar pagamento, disparar métricas de compra ou conceder acesso.

## Alterações
- Usar `/rand/obrigado?demo=1` como endereço de demonstração, mantendo a rota real intacta.
- Detectar o modo demo antes de qualquer leitura de sessão ou chamada da oferta real.
- Preencher apenas no navegador os dados públicos da oferta: nome do combo e preço de R$ 97.
- Mostrar uma faixa permanente informando que nenhuma cobrança será realizada.
- Manter os botões da oferta visíveis; ambos apenas exibirão um aviso de demonstração, sem navegar ou alterar estado real.
- Preservar todos os comportamentos existentes quando `demo=1` não estiver presente.

## Validação
- Conferir que o modo demo não faz chamadas para `rand-upsell`, Mercado Pago ou rastreamento de compra.
- Validar visualmente em 390×844 e 1280×1800.
- Executar testes relevantes e conferir o diagnóstico automático do projeto.
- Não publicar nem fazer deploy.
