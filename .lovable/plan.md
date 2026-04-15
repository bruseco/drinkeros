

# Plano: Importar Capas de Receitas do CSV

## Resumo
Das 116 receitas no CSV, 104 estão sem capa na tabela `exclusive_posts`. Vamos baixar as imagens dos URLs fornecidos, fazer upload para o storage, e atualizar o campo `cover_image_url` de cada receita.

## Etapas

1. **Script Python de importação** — Para cada linha do CSV:
   - Buscar o `id` da receita na tabela `exclusive_posts` pelo título exato
   - Pular receitas que já possuem capa
   - Baixar a imagem do URL do WordPress (`vip.drinkeros.com`)
   - Fazer upload para o bucket `package-covers` no storage
   - Atualizar o campo `cover_image_url` da receita com o novo URL público

2. **Execução e relatório** — Gerar um log com receitas atualizadas e eventuais falhas (URLs quebrados, títulos não encontrados).

## Detalhes técnicos
- Tabela: `exclusive_posts` (não `recipes`)
- Bucket de destino: `package-covers` (já usado pelas capas existentes)
- Match: comparação exata pelo campo `title`
- Apenas receitas com `cover_image_url IS NULL` serão atualizadas
- Total estimado: 104 receitas

