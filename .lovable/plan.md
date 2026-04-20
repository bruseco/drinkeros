

## Plano: corrigir datas de compra dos 2.414 usuários importados

### Mapeamento de produtos (CSV → tabelas)
Preciso confirmar com queries quais produtos do CSV correspondem a quais IDs no banco. Pelo que vi no CSV:
- **"Clube dos Drinkeros - VITALÍCIO"** → marca usuário como `is_lifetime` (vai pra `user_lifetime_access`, sem expiração, ganha Receitas)
- **"Clube dos Drinkeros - Anual"** → algum combo/curso anual (preciso identificar qual)
- **"Acesso total"**, **"Pacote 7 Anos Drinkeros"**, **"Pacote 6 E-books"**, **"Drinkeros Xperience"**, **"Produção de Ingredientes Artesanais"**, **"E-book: Drinks Temáticos"** etc → cada um mapeia pra um combo/curso/ebook específico

### Etapa 1 — Validação prévia (read-only)
1. Copio o CSV pro sandbox e leio com DuckDB.
2. Conto: linhas totais, emails únicos, distribuição de produtos.
3. Cruzo emails do CSV com `profiles` → quantos têm match, quantos não.
4. Listo todos os nomes únicos de "Product Name" do CSV vs catálogo (`combos`, `courses`, `ebooks`, `packages`).
5. Te mostro tabela de mapeamento proposta + amostra antes/depois pra você aprovar.

### Etapa 2 — Schema preventivo
Migration adicionando `source text default 'manual'` em `user_courses`, `user_ebooks`, `user_combos`, `user_packages`. Ajusto o trigger `extend_accesses_on_vip_activation` pra **não** mexer em registros com `source = 'import'` (preserva data original mesmo se virar VIP).

### Etapa 3 — Correção dos dados
Para cada linha do CSV:

**Se produto = "Clube dos Drinkeros - VITALÍCIO":**
- Garante `user_lifetime_access` para o user.
- Atualiza TODOS os acessos do user em `user_courses`, `user_ebooks`, `user_combos`, `user_packages`: `expires_at = NULL`, `purchased_at = Order Date`, `source = 'import'`.

**Se produto = qualquer outro:**
- Localiza o item no catálogo (combo/curso/ebook/pacote correto).
- Atualiza a linha correspondente em `user_*`: `purchased_at = Order Date`, `expires_at = Order Date + 1 ano`, `source = 'import'`.
- **Exceção:** se o user JÁ tem `user_lifetime_access` (por outra linha do CSV ou já marcado), mantém `expires_at = NULL`.

**Múltiplas compras do mesmo user:** uso a data MAIS ANTIGA por produto (primeira compra define o início).

### Etapa 4 — Relatório final
- Quantos registros atualizados em cada tabela.
- Quantos vitalícios marcados.
- Lista de emails do CSV sem profile correspondente (pra você decidir se importa).
- Lista de "Product Name" que não consegui mapear (pra você confirmar mapeamento).
- 10 amostras antes/depois.

### Ordem de execução
1. Inspeção do CSV + cruzamento com catálogo (DuckDB + queries SQL read-only).
2. Te mostro mapeamento de produtos + preview → você aprova.
3. Migration do schema (coluna `source` + ajuste do trigger).
4. UPDATEs em massa (script que processa o CSV em lote).
5. Relatório final com contagens, amostras e exceções.

