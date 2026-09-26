# Novo design da demonstração pós-compra RAND

## Objetivo
Atualizar exclusivamente `/rand/obrigado?demo=1` para aprovação visual do Pacote Business, mantendo o fluxo real, pagamentos, dados e métricas intactos.

## Alterações
- Separar a experiência demo em uma apresentação própria dentro da página existente, retornando antes de qualquer lógica real.
- Exibir faixa superior de processamento, confirmação da compra e vídeo do YouTube com autoplay sem som, ativação de áudio por interação e fallback manual.
- Medir 3:45 pela reprodução efetiva do player; pausas não avançam a revelação.
- Revelar CTA, recusa, preço promocional e os quatro cursos somente após 3:45 assistidos.
- Usar as capas oficiais já cadastradas, incorporadas como recursos locais da demonstração para evitar consultas ao banco.
- Alterar a faixa para amarelo na revelação e iniciar contagem visual de 5:00; ao zerar, encerrar apenas a demonstração.
- Suportar `demo=1&reveal=1` para abrir diretamente no estado revelado.
- Fazer CTA e recusa exibirem somente o aviso de demonstração, sem navegação, pagamento, tracking ou acesso.
- Deixar definidos, sem disparo no demo, os marcos futuros do vídeo: start, 25%, 50%, 75%, 90% e conclusão.

## Validação
- Confirmar ausência de chamadas ao backend, Mercado Pago e tracking nos dois estados demo.
- Validar visualmente em 390×844 e 1280×1800.
- Conferir reprodução/pausa, revelação, timer, teclado, aviso dos botões, testes e diagnóstico automático.
- Não publicar nem alterar banco, combos ou fluxo real.
