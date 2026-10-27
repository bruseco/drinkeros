# Quiz — ofertas exclusivas

## Escopo e decisões

Somente `/quiz`, as novas rotas `/quiz-*`, o checkout ativado explicitamente por `?quiz=1` e relatórios do quiz mudam. As páginas originais dos produtos, Clube A/B, sorteio e divisão de tráfego permanecem intactos. Por confirmação do Bruno, o novo quiz usa **somente Mercado Pago, cartão/Pix**; Stripe permanece como legado e não foi alterado.

O diagnóstico foi apresentado antes das edições: o quiz antigo sobrescrevia `utm_content` e disparava `Lead` no clique. O checkout existente já recalculava preços no servidor, com regras próprias para VIP, Clube e cupom de e-mail do RAND. A nova oferta não reutiliza o cupom do RAND nem altera esses descontos.

## Preços e rotas

A fonte única dos valores é `public.quiz_offer_prices`, criada pela migração. Não alterar os preços dos produtos originais para configurar este quiz.

| Resultado | Rota | Tipo / slug | Regular | Quiz |
|---|---|---|---:|---:|
| Pack | `/quiz-pack-ebooks` | combo / pacote-6-e-books | 147 | 47 |
| Clube | `/quiz-clube` | club / clube-anual | 97 | 87 |
| Xperience | `/quiz-xperience` | course / drinkeros-xperience | 497 | 197 |
| Bordo | `/quiz-bartender-a-bordo` | course / bartender-a-bordo | 397 | 147 |
| Delivery | `/quiz-drink-delivery` | course / drinkdelivery-engarrafados | 397 | 147 |
| Mixologia | `/quiz-mixologia-avancada` | course / mixologia-avancada | 797 | 297 |
| Eventos | `/quiz-bar-para-eventos` | course / bar-p-eventos | 697 | 227 |

A cotação usa relógio e prazo do PostgreSQL. Os 20 minutos começam na primeira abertura da oferta. Recarregar, abrir outra aba, seguir o plano B ou refazer o quiz não renova o prazo. Refazer pode atualizar a recomendação; atribuição original e prazo são preservados. Cada compra e captura conserva seu contexto para não reclassificar o histórico.

O navegador recebe uma referência aleatória, não preço autorizado. O servidor valida respostas e produto indicado; páginas abertas diretamente sem conclusão do quiz pedem para respondê-lo. Plano B só permite os produtos explicitamente previstos para aquele caminho.

O preço é revalidado no envio do formulário e antes da chamada ao Mercado Pago. Se mudou, nenhum pagamento novo é criado até a pessoa conferir o valor atualizado. Uma tentativa já aceita pelo gateway mantém o valor contratado enquanto aguarda confirmação; a expiração não cria uma cobrança substituta. A retomada busca a mesma tentativa. Nova tentativa só é liberada após falha/rejeição confirmada.

Clube no quiz é uma compra de 12 meses sem renovação automática, por cartão ou Pix. Produtos avulsos oferecem até 12 parcelas no Mercado Pago. A landing identifica a simulação com juros de 4,49% a.m., mesma fórmula usada por `CourseLanding`; o valor vinculante das parcelas é o exibido pelo gateway para o cartão escolhido.

## Banco, leads e eventos

Migrações, em ordem:

1. `20261027190000_quiz_exclusive_offers.sql`: preços, sessões, prazo, atribuição e trava de tentativa de pagamento.
2. `20261027190100_quiz_consented_leads.sql`: captura consentida em `crm_leads`, ID estável de Lead e conversão vinculada ao pedido.
3. `20261027190200_quiz_admin_reporting.sql`: consultas administrativas de funis, respostas e leads.

As tabelas de sessões/tokens não têm leitura pública. RPCs de preço/captura são exclusivas do serviço; o endpoint público valida o token e as respostas. Relatórios verificam a permissão administrativa no servidor.

`crm_leads` é reutilizada com `source=quiz`, `funnel=quiz` e etapa inicial `quiz_novo`, fora das etapas de recuperação existentes. Salva nome, WhatsApp normalizado, consentimento/data/texto, respostas, caminho, produto, valor exibido e atribuição original. `landing_offer_leads` e suas automações do RAND não mudam.

`Lead` só é enviado após salvar o formulário com consentimento. Navegador e CAPI usam o mesmo ID persistido; tentativas de reenvio reutilizam esse ID. `ViewContent` permanece no resultado. O utilitário de InitiateCheckout e o fluxo existente de Purchase/CAPI não foram modificados.

Atribuição de compras usa identificador do pagamento, produto e valor, com snapshots do contexto. Não atribui venda por proximidade de horário. Os gatilhos do quiz acrescentam metadados e atualizam a conversão do lead; não escrevem nas colunas de idempotência `meta_capi_sent_at` e `meta_capi_event_time`. Os dois webhooks e o helper de Purchase/CAPI estão intactos.

## Como testar

Antes de testar no site: aplicar as três migrações e instalar `quiz-offer` e `create-mp-payment`. A publicação da interface no Lovable fica com Bruno. Não publicar a interface antes da instalação do servidor.

Abrir `/quiz?utm_source=meta&utm_medium=paid&utm_campaign=teste&utm_content=criativo-original&utm_term=teste&fbclid=teste` e percorrer:

| Caminho | Respostas | Oferta esperada |
|---|---|---|
| CASA | Receitas ocasionais | Pack 47 |
| CASA | Receitas novas e festas | Clube 87 |
| CASA | Criar meus drinks | Xperience 197 |
| PROFISSIONAL | Nunca trabalhei | Xperience 197 |
| PROFISSIONAL | Freelances / contratado | Mixologia 297 |
| PROFISSIONAL | Já trabalho em bar | Mixologia 297 |
| PROFISSIONAL | Navio / exterior | Bordo 147 |
| EMPREENDER | Bar em eventos | Eventos 227 |
| EMPREENDER | Delivery | Delivery 147 |
| EMPREENDER | Ainda não sei → trabalhar de casa | Delivery 147 |
| EMPREENDER | Ainda não sei → estar na festa | Eventos 227 |

Conferir no celular de 390px: título, preços e botão antes de rolar. Testar Voltar e alteração do caminho, carregamento do conteúdo abaixo, plano B dentro do mesmo prazo e placeholder do vídeo. Na URL do checkout, `utm_content=criativo-original` deve permanecer; perfil usa `quiz_profile`.

Recarregar e conferir que o tempo não volta a 20:00. No teste local do banco, expirar apenas a sessão de teste e verificar o preço cheio na página e no checkout. Produto diferente do resultado/plano B deve ser recusado no servidor. Uma resposta de preço diferente impede criar pagamento com o valor antigo.

No formulário, o consentimento é obrigatório tanto na interface quanto no servidor. Conferir a aba “Leads do quiz” dentro de “Métricas de Funil → Quiz”, com caminho, produto, comprou/não comprou e período. Os cartões por produto mostram compra confirmada separada de clique e chegada ao checkout. Os relatórios antigos ficam identificados como histórico.

Não preencher cartão real nem confirmar Pix nos testes de interface. As verificações automatizadas usam PostgreSQL local e respostas simuladas, bloqueando criação de cobrança. Uma compra real completa não foi realizada.

## Validação e entrega

- Testes de todas as 11 combinações de respostas.
- Testes PostgreSQL: prazo persistente, plano B, expiração, consentimento, deduplicação de leads, atribuição de compra, trava de tentativa e permissões administrativas.
- Testes de checkout: preço 87 enviado ao servidor, bloqueio quando muda para 97 e retomada de pagamento sem novo formulário.
- Navegador isolado: 11 caminhos, 7 destinos, 390×667, CTA antes da dobra, UTMs até o checkout e consentimento; nenhuma chamada real de criação de pagamento.
- Compilação, TypeScript e verificação Deno das duas funções.

Arquivos por etapa e estado final da instalação são registrados na entrega. A confirmação de recebimento do Lead pela Meta depende do ambiente configurado; deduplicação foi implementada pelo ID, sem envio de leads reais de teste.
