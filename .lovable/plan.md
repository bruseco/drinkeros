

### Diagnóstico confirmado
- Combos: `source='import'`, datas corretas ✅
- Ebooks/courses/packages: `source='manual'`, `purchased_at = 2026-04-20` (hoje) ❌
- Causa: trigger `extend_accesses_on_*` (ou `propagate_combo_access`) re-insere/atualiza filhos com `now()` quando o combo pai é alterado, executando **após** o UPDATE do import.

### Etapas

**1. Inspeção do trigger**
- Listar triggers em `user_combos`, `user_courses`, `user_packages`, `user_ebooks` e ler o corpo das funções pra confirmar qual delas reseta `purchased_at`.

**2. Ajuste do trigger**
- Modificar a função pra **não sobrescrever** `purchased_at`/`expires_at` quando o registro filho já tem `source='import'`, OU usar o `purchased_at`/`expires_at` do combo pai ao propagar (em vez de `now()` + 1 ano).
- Preferência: usar a data do combo pai como base — assim o vitalício e as datas históricas são respeitados em qualquer cenário futuro.

**3. Re-rodar a correção dos filhos**
- Reusar o mesmo CSV pra reaplicar `purchased_at` e `expires_at` em `user_courses`, `user_ebooks`, `user_packages`, marcando `source='import'`.
- Para vitalícios: `expires_at=NULL` em todos os filhos.
- Para anuais: `expires_at = Order Date + 1 ano`.

**4. Verificação de amostra**
- Re-checar o `vmgs2107@gmail.com` e mais 9 amostras (5 anuais + 5 vitalícios) pra confirmar que ebooks/courses/packages agora batem com o CSV.

**5. Cleanup**
- Remover edge function temporária.

### Execução
- Migration pra ajustar o trigger.
- Edge function temporária `exec-import` (mesmo padrão de antes) pra rodar os UPDATEs em massa via service role.
- Relatório final com contagens por tipo (combos, courses, ebooks, packages) atualizados.

### Garantias (mantém escopo anterior)
- Não removo nenhum acesso existente.
- Não mexo em produtos (is_active, is_free).
- Só corrijo datas + adiciono o que faltava.

