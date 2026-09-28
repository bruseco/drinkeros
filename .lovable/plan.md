# Quiz de segmentação — /quiz

Página nova e independente, topo de funil para anúncios. Nenhuma página ou fluxo existente será alterado (só é acrescentada a rota nova).

## Rotas das landing pages (confirmar)

Encontradas no app hoje:

| Produto | Rota atual |
|---|---|
| Drinkeros Xperience | `/drinkeros-xperience` |
| Mixologia Avançada | `/mixologia-avancada` |
| Drink Delivery | `/drinkdelivery-engarrafados` |
| Bar para Eventos | `/bar-p-eventos` |
| Bartender de Bordo | `/bartender-a-bordo` |

Os botões levarão para essas rotas, mantendo os UTMs do anúncio (utm_*, fbclid) e acrescentando `utm_content=quiz-<perfil>`.

## Fluxo

```text
Intro (1 tela, botão "Descobrir meu perfil")
 -> P1 intenção -> P2 nível -> P3 sonho -> [P4 condicional] 
 -> "Analisando seu perfil..." (~1,2s) -> Resultado + botão
```

- P4 aparece se P1 = D ou P3 = D.
- Barra de progresso: total de 3 ou 4 conforme a condição (ajusta assim que P1/P3 decidem).
- Botão "Voltar" discreto para refazer a pergunta anterior; "Refazer quiz" no resultado.

## Regra de resultado (intenção pesa mais)

1. Se P4 foi respondida: A → Empreendedor Delivery, B → Empreendedor Eventos, C → Aventureiro (cruzeiro).
2. Senão, pontuação por perfil (P1 vale 3, P2 vale 2, P3 vale 1):
   - P1: A → Criador, B → Aspirante, C → Profissional (se P2 = C/D) ou Criador, D → (já cai no P4)
   - P2: A → Aspirante, B → Criador, C/D → Profissional
   - P3: A → Criador, B → Aspirante, C → Profissional
3. Empate: vence o perfil apontado pela P1.

Perfis → destino: Criador e Aspirante → Xperience; Profissional → Mixologia Avançada; os demais conforme sua lista. Textos, títulos e botões exatamente como enviados.

## Visual / UX

- Paleta roxo escuro elegante aplicada só à página do quiz (fundo roxo profundo com gradiente, detalhes no tom de destaque da marca), sem mexer nas cores globais. Obs.: as cores gerais do site hoje são preto + magenta; o roxo ficará restrito ao quiz — me avise se era outra referência.
- Opções como cartões grandes clicáveis com ícone, com estado selecionado e avanço automático após o toque (~250ms).
- Transição deslizar + fade entre telas, sem recarregar; respeita "reduzir movimento".
- Resultado com a foto de perfil existente: Criador/Aspirante → hobbie, Profissional/Aventureiro → bartender, Empreendedores → empresário.
- Mobile-first, área segura do iPhone, botão principal sempre visível no resultado.

## Tracking (estrutura existente)

- PageView: já automático pelo pixel global.
- Funil interno (`trackFunnel`, page_key `quiz`), idempotente por sessão: início, cada pergunta respondida, resultado exibido com o perfil, clique no botão final.
- Meta Pixel: `ViewContent` no resultado (content_name = perfil) e `Lead` no clique do botão final, com dedupe. Sem Purchase/InitiateCheckout (isso continua nas landings).
- Nenhum dado pessoal coletado.

## Detalhes técnicos

- Novo `src/pages/landing/Quiz.tsx` + `src/lib/quizLogic.ts` (perguntas, perfis e função de pontuação pura) + testes em `src/lib/quizLogic.test.ts`.
- Rota `/quiz` em `App.tsx` antes de `/:packageSlug`; adicionar `/quiz` em `PUBLIC_SALES_ROUTES`.
- Ampliar o tipo `FunnelEvent` com os eventos do quiz (só adição) e registrar o funil "Quiz" em `src/lib/funnels.ts` para aparecer no painel. Se a função de banco restringir nomes de evento, ajusto com migração aditiva.
- Imagens importadas de `src/assets/landing/classicos/profile-*.jpg`.
- SeoHead com título/descrição próprios; validação Playwright em 390×844 e desktop cobrindo os 6 resultados.
