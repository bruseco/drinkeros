# Changelog - Criminal Lab

Guia de atualizacao para instancias remix. Para cada versao, siga os passos na ordem listada.

---

## [2.6.0] - 2026-03-05

### Resumo
Correcao de URLs incorretas nos agentes de IA do WhatsApp (domínios inventados como membros.criminallab.com.br ou eadplataforma.app) — todos os agentes agora referenciam exclusivamente https://alunos.criminallab.com.br. Layout das abas de filtro do WhatsApp admin corrigido para scroll horizontal sem sobreposicao.

### Migrations (rodar no backend da instancia)
Nenhuma migration necessaria nesta versao.

### Edge Functions (atualizadas automaticamente)
- `agent-suporte` - **ATUALIZADO** - Link da plataforma fixado em https://alunos.criminallab.com.br
- `agent-cs` - **ATUALIZADO** - Link da plataforma fixado em https://alunos.criminallab.com.br
- `agent-ascensao` - **ATUALIZADO** - Link da plataforma fixado em https://alunos.criminallab.com.br
- `agent-recuperacao` - **ATUALIZADO** - Link da plataforma fixado em https://alunos.criminallab.com.br

### Config (supabase/config.toml)
Nenhuma nova entrada necessaria.

### Frontend (atualizado automaticamente)
- `AdminWhatsApp.tsx` - **ATUALIZADO** - Abas de filtro convertidas para scroll horizontal (`overflow-x-auto`, `flex-nowrap`, `shrink-0`) para evitar sobreposicao em telas menores

### Secrets necessarios
Nenhum novo secret nesta versao.

### Configuracao manual pos-deploy
1. Testar envio de mensagem via agente e verificar que o link enviado e https://alunos.criminallab.com.br
2. Verificar que as abas de filtro do WhatsApp nao ficam sobrepostas em telas menores

---

## [2.5.0] - 2026-03-01

### Resumo
Integracao CRM direto na tela de WhatsApp: badge de estagio do lead agora abre dialog interativo para gestao de funil e estagio. Acoes rapidas de "Convertido" e "Perdido" (com motivo) no header do chat. Criacao automatica de lead no CRM quando o telefone do contato nao existe na base. Filtro de templates por conexao ativa.

### Migrations (rodar no backend da instancia)
Nenhuma migration necessaria nesta versao.

### Edge Functions (atualizadas automaticamente)
Nenhuma alteracao em edge functions nesta versao.

### Config (supabase/config.toml)
Nenhuma nova entrada necessaria.

### Frontend (atualizado automaticamente)
- `AdminWhatsApp.tsx` - **ATUALIZADO** - Integracao CRM completa no chat:
  - Badge de estagio clicavel abre `Dialog` com seletor de funil e seletor de estagio filtrado por funil
  - Acoes rapidas no header: botao "Convertido" (atualiza stage + converted_at) e botao "Perdido" (abre input de motivo, salva lost_reason)
  - Criacao inline de lead: quando o telefone do contato nao tem lead associado, exibe formulario compacto para criar lead no CRM com nome, funil e estagio
  - Filtro de templates WhatsApp por `connection_id` da conversa ativa

### Secrets necessarios
Nenhum novo secret nesta versao.

### Configuracao manual pos-deploy
1. Verificar que os funis e estagios do CRM estao configurados corretamente (tabela `crm_leads`, campos `funnel` e `stage`)
2. Testar fluxo completo: abrir conversa WhatsApp → clicar no badge de estagio → alterar funil/estagio → confirmar que o lead foi atualizado
3. Testar acao "Convertido": clicar no botao → confirmar que `stage` muda para "convertido" e `converted_at` e preenchido
4. Testar acao "Perdido": clicar no botao → preencher motivo → confirmar que `stage` muda para "perdido" e `lost_reason` e salvo
5. Testar criacao de lead: abrir conversa com telefone sem lead → preencher formulario inline → confirmar que o lead aparece no CRM

---

## [2.4.0] - 2026-02-27

### Resumo
Optimistic UI no envio de mensagens WhatsApp: mensagens de texto, imagem, documento, audio e templates agora aparecem instantaneamente na interface ao clicar em enviar, sem aguardar resposta da API. Status visual "Enviando..." com spinner animado e rollback automatico em caso de erro.

### Migrations (rodar no backend da instancia)
Nenhuma migration necessaria nesta versao.

### Edge Functions (atualizadas automaticamente)
Nenhuma alteracao em edge functions nesta versao.

### Config (supabase/config.toml)
Nenhuma nova entrada necessaria.

### Frontend (atualizado automaticamente)
- `useWhatsApp.ts` - **ATUALIZADO** - Hook `useSendMessage` com optimistic update via `onMutate`: cria mensagem temporaria com `status: 'sending'` no cache do React Query, rollback automatico no `onError`, invalidacao de queries no `onSettled`
- `AdminWhatsApp.tsx` - **ATUALIZADO** - `handleSend` limpa campo de texto imediatamente e usa `mutate` (fire-and-forget) em vez de `await mutateAsync`. Mesmo padrao aplicado a envio de imagem (`handleImageConfirm`), documento (`handleDocUpload`), audio (gravacao) e templates (`handleTemplateSend`, `handleTemplateSelect`). Indicador visual de spinner para mensagens com status `sending`

### Secrets necessarios
Nenhum novo secret nesta versao.

### Configuracao manual pos-deploy
Nenhuma configuracao manual necessaria.

---

## [2.3.0] - 2026-02-25

### Resumo
Correcao da validacao de janela de 24h no envio de WhatsApp e implementacao de template + botao de reabertura de conversa quando a janela esta fechada.

### Migrations (rodar no backend da instancia)
Nenhuma migration necessaria nesta versao.

O template `reabertura_atendimento` deve ser inserido manualmente na tabela `whatsapp_templates` caso nao exista:
- `name`: reabertura_atendimento
- `category`: UTILITY
- `status`: APPROVED (apos aprovacao pela Meta)
- `components`: HEADER "Continuidade do atendimento", BODY "Ola, {{1}}! Me chamo {{2}} do Criminal Lab e vou dar continuidade ao seu atendimento. Podemos conversar agora?"
- `connection_id`: conexao ativa existente

### Edge Functions (atualizadas automaticamente)
- `whatsapp-send` - **ATUALIZADA** - Prioriza `conversationId` do frontend para validacao da janela de 24h, evitando falha por diferenca de formato de telefone (com/sem "+"). Logs detalhados de timestamp e elapsed time adicionados.

### Config (supabase/config.toml)
Nenhuma nova entrada necessaria.

### Frontend (atualizado automaticamente)
- `AdminWhatsApp.tsx` - **ATUALIZADO** - Banner "Janela de 24h fechada" com botao "Reabrir conversa". Desabilita textarea de texto livre quando janela fechada. Preenchimento automatico do template com nome do contato e nome do operador logado. Calculo de `isWindowClosed` via `useMemo`.

### Secrets necessarios
Nenhum novo secret nesta versao.

### Configuracao manual pos-deploy
1. Criar o template `reabertura_atendimento` na Meta Business Suite (categoria UTILITY) e aguardar aprovacao
2. Sincronizar templates para que o registro apareca na tabela `whatsapp_templates` com status APPROVED
3. Verificar que a conexao WhatsApp ativa tem o template vinculado

---

## [2.2.0] - 2026-02-23

### Resumo
Correcao critica: modulos bloqueados apos matricula em curso ou combo. Criacao de triggers de propagacao automatica de acesso e backfill de dados existentes.

### Migrations (rodar no backend da instancia)
```sql
-- 1. Trigger: user_courses INSERT -> propagar para user_packages
CREATE OR REPLACE FUNCTION public.propagate_user_course_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO user_packages (user_id, package_id)
  SELECT NEW.user_id, cp.package_id
  FROM course_packages cp
  WHERE cp.course_id = NEW.course_id
  ON CONFLICT (user_id, package_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_propagate_user_course_access
  AFTER INSERT ON user_courses
  FOR EACH ROW
  EXECUTE FUNCTION propagate_user_course_access();

-- 2. Trigger: user_combos INSERT -> propagar para user_courses e user_packages
CREATE OR REPLACE FUNCTION public.propagate_user_combo_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO user_courses (user_id, course_id)
  SELECT NEW.user_id, cc.course_id
  FROM combo_courses cc
  WHERE cc.combo_id = NEW.combo_id
  ON CONFLICT (user_id, course_id) DO NOTHING;

  INSERT INTO user_packages (user_id, package_id)
  SELECT NEW.user_id, cp.package_id
  FROM combo_courses cc
  JOIN course_packages cp ON cp.course_id = cc.course_id
  WHERE cc.combo_id = NEW.combo_id
  ON CONFLICT (user_id, package_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_propagate_user_combo_access
  AFTER INSERT ON user_combos
  FOR EACH ROW
  EXECUTE FUNCTION propagate_user_combo_access();

-- 3. Reconectar triggers existentes (modulo adicionado a curso / curso adicionado a combo)
CREATE TRIGGER trg_propagate_course_package_access
  AFTER INSERT ON course_packages
  FOR EACH ROW
  EXECUTE FUNCTION propagate_course_package_access();

CREATE TRIGGER trg_propagate_combo_course_access
  AFTER INSERT ON combo_courses
  FOR EACH ROW
  EXECUTE FUNCTION propagate_combo_course_access();

-- 4. Backfill: user_courses -> user_packages
INSERT INTO user_packages (user_id, package_id)
SELECT uc.user_id, cp.package_id
FROM user_courses uc
JOIN course_packages cp ON cp.course_id = uc.course_id
ON CONFLICT (user_id, package_id) DO NOTHING;

-- 5. Backfill: user_combos -> user_courses + user_packages
INSERT INTO user_courses (user_id, course_id)
SELECT ucb.user_id, cc.course_id
FROM user_combos ucb
JOIN combo_courses cc ON cc.combo_id = ucb.combo_id
ON CONFLICT (user_id, course_id) DO NOTHING;

INSERT INTO user_packages (user_id, package_id)
SELECT ucb.user_id, cp.package_id
FROM user_combos ucb
JOIN combo_courses cc ON cc.combo_id = ucb.combo_id
JOIN course_packages cp ON cp.course_id = cc.course_id
ON CONFLICT (user_id, package_id) DO NOTHING;
```

### Edge Functions (atualizadas automaticamente)
Nenhuma nova edge function nesta versao.

### Config (supabase/config.toml)
Nenhuma nova entrada necessaria.

### Frontend (atualizado automaticamente)
Nenhuma alteracao de frontend necessaria — o codigo ja verificava `user_packages` corretamente.

### Secrets necessarios
Nenhum novo secret nesta versao.

### Configuracao manual pos-deploy
1. O backfill ja esta incluido na migration e corrige dados existentes automaticamente
2. Verificar que usuarios previamente matriculados em cursos/combos agora tem acesso aos modulos

---

## [2.1.0] - 2026-02-23

### Resumo
Correcoes no sistema de certificados: coluna `workload_seconds` na tabela de certificados para persistir carga horaria calculada a partir da duracao das aulas, backfill de CPF/nome do aluno em certificados existentes, exibicao da carga horaria na pagina publica de validacao, e policy RLS para permitir atualizacao de certificados pelo proprio usuario.

### Migrations (rodar no backend da instancia)
```sql
-- Coluna de carga horaria no certificado
ALTER TABLE public.certificates ADD COLUMN workload_seconds integer NOT NULL DEFAULT 0;

-- Policy para usuario atualizar proprio certificado (backfill de CPF/nome/workload)
CREATE POLICY "Users can update own certificate cpf"
ON public.certificates FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Backfill de CPF e nome nos certificados existentes
UPDATE public.certificates c
SET student_cpf = p.cpf, student_name = p.full_name
FROM public.profiles p
WHERE p.user_id = c.user_id
  AND (c.student_cpf IS NULL OR c.student_name IS NULL);
```

### Edge Functions (atualizadas automaticamente)
Nenhuma nova edge function nesta versao.

### Config (supabase/config.toml)
Nenhuma nova entrada necessaria.

### Frontend (atualizado automaticamente)
- `useCertificates.ts` - Calculo automatico de `workload_seconds` a partir de `recipes.duration_seconds`, backfill de CPF/nome em certificados existentes ao re-baixar
- `ValidateCertificate.tsx` - Exibicao da carga horaria formatada (ex: "3h 20min") na pagina de validacao publica

### Secrets necessarios
Nenhum novo secret nesta versao.

### Configuracao manual pos-deploy
1. Rodar o backfill SQL acima para preencher `workload_seconds` nos certificados ja emitidos (caso desejado, recalcular via re-download pelo aluno)
2. Verificar que as aulas possuem `duration_seconds` preenchido para calculo correto da carga horaria

---

## [2.0.0] - 2026-02-23

### Resumo
Posicionamento dinamico do upsell com agente de IA (Gemini) que analisa interacoes do usuario para otimizar a posicao do card de upsell nos carroseis da home. Dashboard admin de metricas UX com KPIs, graficos de performance por posicao, tendencia de 30 dias e log de decisoes do agente. Correcao do scroll do catalogo e limite PWA.

### Migrations (rodar no backend da instancia)
```sql
-- Tabela de interacoes UX
CREATE TABLE public.ux_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ux_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own interactions" ON public.ux_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all interactions" ON public.ux_interactions FOR SELECT USING (is_admin(auth.uid()));
CREATE INDEX idx_ux_interactions_user_event ON public.ux_interactions(user_id, event_type);
CREATE INDEX idx_ux_interactions_created ON public.ux_interactions(created_at DESC);

-- Funcao de metricas UX agregadas
CREATE OR REPLACE FUNCTION public.get_ux_metrics()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT json_build_object(
    'total_sessions', (SELECT count(*) FROM ux_interactions WHERE event_type = 'session_start'),
    'unique_users', (SELECT count(DISTINCT user_id) FROM ux_interactions),
    'total_views', (SELECT count(*) FROM ux_interactions WHERE event_type = 'upsell_view'),
    'total_clicks', (SELECT count(*) FROM ux_interactions WHERE event_type = 'upsell_click'),
    'avg_scroll_depth', (SELECT ROUND(AVG((metadata->>'scroll_pct')::numeric), 1) FROM ux_interactions WHERE event_type = 'scroll_depth'),
    'ctr', (SELECT ROUND(
      (SELECT count(*) FROM ux_interactions WHERE event_type = 'upsell_click')::numeric /
      NULLIF((SELECT count(*) FROM ux_interactions WHERE event_type = 'upsell_view'), 0) * 100, 1
    )),
    'views_by_position', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT metadata->>'position' as position,
          count(*) FILTER (WHERE event_type = 'upsell_view') as views,
          count(*) FILTER (WHERE event_type = 'upsell_click') as clicks
        FROM ux_interactions WHERE event_type IN ('upsell_view','upsell_click')
        GROUP BY metadata->>'position' ORDER BY (metadata->>'position')::int
      ) t
    ),
    'daily_trend', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT date_trunc('day', created_at)::date as day,
          count(*) FILTER (WHERE event_type = 'session_start') as sessions,
          count(*) FILTER (WHERE event_type = 'upsell_view') as views,
          count(*) FILTER (WHERE event_type = 'upsell_click') as clicks
        FROM ux_interactions WHERE created_at >= now() - interval '30 days'
        GROUP BY 1 ORDER BY 1
      ) t
    ),
    'recent_placements', (
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT created_at, metadata->>'position' as position,
          metadata->>'total_carousels' as total_carousels,
          metadata->>'source' as source
        FROM ux_interactions WHERE event_type = 'upsell_view'
        ORDER BY created_at DESC LIMIT 20
      ) t
    )
  );
$$;
```

### Edge Functions (atualizadas automaticamente)
- `ux-placement-agent` - **NOVA** - Agente Gemini que analisa historico de interacoes e decide a posicao otima do upsell

### Config (supabase/config.toml)
```toml
[functions.ux-placement-agent]
verify_jwt = true
```

### Frontend (atualizado automaticamente)
- `useUxTracking.ts` - **NOVO** - Hook que registra session_start, scroll_depth e upsell_view/click no banco
- `useUpsellPlacement.ts` - **NOVO** - Hook que consulta o agente de IA para decidir posicao do upsell (fallback: posicao 2)
- `UpsellCardCompact.tsx` - **NOVO** - Card de upsell compacto com tracking de cliques
- `UserHome.tsx` - Integracao do upsell dinamico nos carroseis + correcao do scroll do catalogo (ref + useEffect para scrollLeft=0)
- `AdminUXMetrics.tsx` - **NOVA** - Dashboard de metricas UX com KPIs, grafico de barras por posicao, tendencia 30 dias, log de decisoes do agente
- `AdminSidebar.tsx` - Link "Metricas UX" no menu admin
- `vite.config.ts` - Aumento do limite PWA injectManifest para 4MB

### Secrets necessarios
Nenhum novo secret nesta versao (usa Lovable AI integrado para o agente Gemini).

### Configuracao manual pos-deploy
1. Garantir que existam produtos com `is_available_for_sale = true` e `hotmart_product_code` preenchido para o upsell funcionar
2. O agente de IA comeca a otimizar apos 5+ sessoes registradas na tabela `ux_interactions`
3. Acompanhar metricas em **Admin > Metricas UX**

---

## [1.9.0] - 2026-02-23

### Resumo
Catalogo completo com conteudo bloqueado para aumentar upsell: a home exibe todos os cursos, modulos e combos (matriculados + nao matriculados) com badges de status. Conteudo nao matriculado aparece com cadeado e redireciona para checkout. Funcao de metadados publicos de aulas.

### Migrations (rodar no backend da instancia)
```sql
-- Funcao para buscar metadados publicos de aulas (bypassa RLS, retorna apenas campos seguros)
CREATE OR REPLACE FUNCTION public.get_package_recipe_metadata(p_package_id uuid)
RETURNS TABLE(id uuid, name text, image_url text, display_order int) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT r.id, r.name, r.image_url, COALESCE(rp.display_order, 0) as display_order
  FROM recipe_packages rp
  JOIN recipes r ON r.id = rp.recipe_id
  WHERE rp.package_id = p_package_id
  AND r.status = 'published'
  ORDER BY rp.display_order ASC NULLS LAST;
$$;
```

### Edge Functions (atualizadas automaticamente)
Nenhuma nova edge function nesta versao.

### Config (supabase/config.toml)
Nenhuma nova entrada necessaria.

### Frontend (atualizado automaticamente)
- `UserHome.tsx` - Secao "Cursos e Modulos" consolidada: mostra todos os itens disponiveis. Matriculados com badge verde "Matriculado", nao matriculados com overlay de cadeado e badge "Disponivel". Links para conteudo bloqueado com `?locked=true`
- `UserModuleLessons.tsx` - Modo bloqueado: detecta `?locked=true` ou falta de acesso, exibe aulas com overlay de cadeado (busca metadados via `get_package_recipe_metadata`), banner CTA "Desbloqueie este modulo" com botao "Matricule-se" redirecionando para checkout
- `UserCourseModules.tsx` - Modo bloqueado para cursos: modulos com overlay de cadeado, banner CTA de checkout
- `UserComboDetail.tsx` - Modo bloqueado para combos: cursos com overlay de cadeado, banner CTA "Desbloqueie este combo", capa com cadeado central
- `useLockedContent.ts` - **NOVO** - Hook para buscar metadados publicos de aulas de modulos bloqueados

### Secrets necessarios
Nenhum novo secret nesta versao.

### Configuracao manual pos-deploy
1. Garantir que os campos `hotmart_product_code` (Link do Checkout) estejam preenchidos nos pacotes, cursos e combos que devem aparecer como "Disponivel" para venda
2. Marcar como `is_available_for_sale = true` os produtos que devem aparecer no catalogo para nao matriculados

---

## [1.8.0] - 2026-02-21

### Resumo
Sistema de certificados com verificacao publica, CPF no perfil do aluno, carga horaria em pacotes/cursos/combos, duracao de aulas, bucket de midia WhatsApp.

### Migrations (rodar no backend da instancia)
```sql
-- Bucket de midia WhatsApp
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true);

CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

CREATE POLICY "Public can view whatsapp media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Authenticated users can delete whatsapp media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

-- Tabela de certificados
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  certificate_type text NOT NULL,
  reference_id uuid NOT NULL,
  reference_name text NOT NULL,
  verification_code text NOT NULL UNIQUE,
  student_name text,
  student_cpf text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_certificates_unique ON public.certificates (user_id, certificate_type, reference_id);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own certificates"
ON public.certificates FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own certificates"
ON public.certificates FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all certificates"
ON public.certificates FOR SELECT USING (public.is_admin(auth.uid()));

-- Validacao publica de certificados
CREATE POLICY "Anyone can validate certificates by code"
ON certificates FOR SELECT USING (true);

-- CPF no perfil
ALTER TABLE profiles ADD COLUMN cpf text UNIQUE;

-- Carga horaria
ALTER TABLE packages ADD COLUMN workload_hours integer DEFAULT 0;
ALTER TABLE courses ADD COLUMN workload_hours integer DEFAULT 0;
ALTER TABLE combos ADD COLUMN workload_hours integer DEFAULT 0;

-- Duracao de aulas
ALTER TABLE public.recipes ADD COLUMN duration_seconds integer DEFAULT 0;
```

### Edge Functions (atualizadas automaticamente)
Nenhuma nova edge function nesta versao.

### Config (supabase/config.toml)
Nenhuma nova entrada necessaria.

### Frontend (atualizado automaticamente)
- `UserProfile.tsx` - Campo CPF no perfil do aluno
- `CertificateDownloadButton.tsx` - **NOVO** - Botao para gerar e baixar certificado em PDF
- `ValidateCertificate.tsx` - **NOVA** - Pagina publica de validacao de certificado por codigo
- `UserModuleLessons.tsx` - Botao de certificado ao completar modulo
- `UserCourseModules.tsx` - Botao de certificado ao completar curso
- `PackageForm.tsx` / `CourseForm.tsx` / `ComboForm.tsx` - Campo de carga horaria
- `LessonForm.tsx` - Campo de duracao da aula
- `AdminWhatsApp.tsx` - Upload de midia (imagens/audio) nas conversas

### Secrets necessarios
Nenhum novo secret nesta versao.

### Configuracao manual pos-deploy
1. Preencher a carga horaria nos pacotes/cursos/combos existentes (se desejar exibir no certificado)
2. A pagina de validacao de certificado e publica em `/validar-certificado`

---

## [1.7.0] - 2026-02-20

### Resumo
CRM completo (leads, atividades, tarefas), automacao de nurturing com escalonamento de estagios, tabela de regras de upsell por produto.

### Migrations (rodar no backend da instancia)
```sql
-- Tabela principal de leads
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text, phone text,
  stage text NOT NULL DEFAULT 'carrinho_abandonado_1',
  product_name text, product_id text, product_type text,
  sale_value numeric,
  source text NOT NULL DEFAULT 'manual',
  assigned_to uuid, profile_id uuid, recovery_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  lost_reason text, converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage crm_leads" ON public.crm_leads FOR ALL USING (is_admin(auth.uid()));
CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_crm_leads_stage ON public.crm_leads(stage);
CREATE INDEX idx_crm_leads_assigned_to ON public.crm_leads(assigned_to);

-- Atividades do lead
CREATE TABLE public.crm_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'note',
  description text NOT NULL,
  created_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage crm_lead_activities" ON public.crm_lead_activities FOR ALL USING (is_admin(auth.uid()));
CREATE INDEX idx_crm_lead_activities_lead_id ON public.crm_lead_activities(lead_id);

-- Tarefas do lead
CREATE TABLE public.crm_lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date timestamptz NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_lead_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage crm_lead_tasks" ON public.crm_lead_tasks FOR ALL USING (is_admin(auth.uid()));
CREATE INDEX idx_crm_lead_tasks_lead_id ON public.crm_lead_tasks(lead_id);
CREATE INDEX idx_crm_lead_tasks_due_date ON public.crm_lead_tasks(due_date) WHERE completed = false;

-- Automacao CRM
CREATE TABLE public.crm_automation_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nurturing_enabled boolean NOT NULL DEFAULT false,
  nurturing_days integer NOT NULL DEFAULT 7,
  nurturing_stage text NOT NULL DEFAULT 'oferta_alternativa',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins can view crm_automation_settings" ON public.crm_automation_settings FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins can update crm_automation_settings" ON public.crm_automation_settings FOR UPDATE USING (has_role(auth.uid(), 'super_admin'::app_role));
INSERT INTO public.crm_automation_settings (nurturing_enabled, nurturing_days, nurturing_stage) VALUES (false, 7, 'oferta_alternativa');
CREATE TRIGGER update_crm_automation_settings_updated_at BEFORE UPDATE ON public.crm_automation_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### Edge Functions (atualizadas automaticamente)
- `crm-webhook-carrinho` - Webhook para captura de carrinho abandonado (verifica matricula ativa)
- `crm-webhook-pix` - Webhook para PIX nao pago (verifica matricula + mapeamento de estagios)
- `crm-webhook-cartao` - Webhook para cartao recusado (verifica matricula ativa)
- `woocommerce-crm-webhook` - Webhook unificado WooCommerce para CRM
- `crm-nurturing-cron` - Escalonamento automatico de estagios (carrinho_abandonado -> 24h, pix_nao_pago -> 48h)
- `woocommerce-webhook` - Conversao automatica de leads apos compra
- `whatsapp-agent` - Nova acao `crmAction` com tipo `mark_lost`
- `cs-daily-report` - Metricas CRM no relatorio diario
- `media-proxy` - **NOVA** - Proxy de midia para WhatsApp (imagens/audio/video)

### Config (supabase/config.toml)
```toml
[functions.media-proxy]
verify_jwt = false

[functions.crm-webhook-pix]
verify_jwt = false

[functions.crm-webhook-cartao]
verify_jwt = false

[functions.crm-nurturing-cron]
verify_jwt = false

[functions.crm-webhook-carrinho]
verify_jwt = false

[functions.woocommerce-crm-webhook]
verify_jwt = false
```

### Frontend (atualizado automaticamente)
- `AdminCRM.tsx` - Dashboard CRM com listagem de leads por estagio
- `AdminCRMLeadDetail.tsx` - Detalhe do lead com timeline de atividades
- `AdminUpsell.tsx` - Regras de upsell por produto (trigger → oferta)
- `AdminWhatsApp.tsx` - Proxy de midia para imagens/audio/video
- `AdminWhatsAppTemplates.tsx` - 6 modelos prontos de templates (PIX 1A/1B, PIX 2A/2B, Cartao 1A/1B)
- `TriggerRedirect.tsx` - Redirecionamento com tracking de cliques

### Secrets necessarios
Nenhum novo secret nesta versao.

### Configuracao manual pos-deploy
1. Criar bindings na tela **WhatsApp > Bindings** para os processos:
   - `crm_recovery_carrinho` / `crm_recovery_carrinho_2`
   - `crm_recovery_pix` / `crm_recovery_pix_2`
   - `crm_recovery_cartao`
2. Usar os **Modelos Prontos** na tela de Templates para criar templates A/B
3. Configurar o cron do `crm-nurturing-cron` no backend (ex: a cada 1 hora)

---

## [1.4.0] - 2026-02-17

### Resumo
Bindings de templates WhatsApp com mapeamento de variaveis, suporte a multiplos providers (Z-API, Meta Cloud, Era Cloud), funcao de retencao/metricas avancadas.

### Migrations (rodar no backend da instancia)
```sql
-- Bindings de templates
CREATE TABLE public.whatsapp_template_bindings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.zapi_connections(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  process text NOT NULL,
  variable_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id, process, template_name)
);

ALTER TABLE public.whatsapp_template_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage template bindings"
ON public.whatsapp_template_bindings FOR ALL
USING (is_admin(auth.uid()));

CREATE TRIGGER update_whatsapp_template_bindings_updated_at
BEFORE UPDATE ON public.whatsapp_template_bindings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar waba_id e provider a conexoes
ALTER TABLE public.zapi_connections ADD COLUMN waba_id text;
ALTER TABLE public.zapi_connections
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'zapi',
  ADD COLUMN IF NOT EXISTS api_url text,
  ADD COLUMN IF NOT EXISTS instance_name text;
ALTER TABLE public.zapi_connections
  ALTER COLUMN instance_id DROP NOT NULL,
  ALTER COLUMN security_token DROP NOT NULL,
  ALTER COLUMN token DROP NOT NULL;

-- Funcao de metricas de retencao
CREATE OR REPLACE FUNCTION public.get_retention_metrics(
  p_seven_days_ago timestamptz,
  p_thirty_days_ago timestamptz
) RETURNS json AS $$
  SELECT json_build_object(
    'active_students_7d', (SELECT COUNT(DISTINCT rv.user_id) FROM recipe_views rv WHERE rv.viewed_at >= p_seven_days_ago AND rv.user_id NOT IN (SELECT user_id FROM user_roles)),
    'total_students', (SELECT COUNT(*) FROM profiles p WHERE p.user_id NOT IN (SELECT user_id FROM user_roles)),
    'completed_views_7d', (SELECT COUNT(*) FROM recipe_views WHERE completed = true AND viewed_at >= p_seven_days_ago),
    'total_views_7d', (SELECT COUNT(*) FROM recipe_views WHERE viewed_at >= p_seven_days_ago),
    'avg_days_between_access', (SELECT ROUND(AVG(gap)::numeric, 1) FROM (SELECT EXTRACT(EPOCH FROM (viewed_at::timestamp - LAG(viewed_at::timestamp) OVER (PARTITION BY user_id ORDER BY viewed_at))) / 86400.0 AS gap FROM (SELECT DISTINCT user_id, DATE(viewed_at)::timestamp AS viewed_at FROM recipe_views WHERE viewed_at >= p_thirty_days_ago AND user_id NOT IN (SELECT user_id FROM user_roles)) daily) gaps WHERE gap IS NOT NULL AND gap > 0),
    'new_users_7d', (SELECT COUNT(*) FROM profiles WHERE created_at >= p_seven_days_ago AND user_id NOT IN (SELECT user_id FROM user_roles)),
    'new_users_without_access_7d', (SELECT COUNT(*) FROM profiles p WHERE p.created_at >= p_seven_days_ago AND p.user_id NOT IN (SELECT user_id FROM user_roles) AND NOT EXISTS (SELECT 1 FROM recipe_views rv WHERE rv.user_id = p.user_id))
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public';

-- Atualizar select_zapi_connection para priorizar era_cloud
CREATE OR REPLACE FUNCTION public.select_zapi_connection(p_conversation_id uuid DEFAULT NULL, p_is_new_contact boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_connection_id uuid; v_existing_connection_id uuid;
BEGIN
  IF p_conversation_id IS NOT NULL THEN
    SELECT zapi_connection_id INTO v_existing_connection_id FROM whatsapp_conversations WHERE id = p_conversation_id;
    IF v_existing_connection_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM zapi_connections WHERE id = v_existing_connection_id AND is_active = true AND connection_status != 'disconnected') THEN
        RETURN v_existing_connection_id;
      END IF;
    END IF;
  END IF;
  UPDATE zapi_connections SET new_contacts_today = 0, last_reset_at = CURRENT_DATE WHERE last_reset_at < CURRENT_DATE AND provider = 'zapi';
  SELECT id INTO v_connection_id FROM zapi_connections WHERE is_active = true AND connection_status != 'disconnected' AND provider = 'era_cloud' ORDER BY new_contacts_today ASC, created_at ASC LIMIT 1;
  IF v_connection_id IS NOT NULL THEN
    IF p_conversation_id IS NOT NULL THEN UPDATE whatsapp_conversations SET zapi_connection_id = v_connection_id WHERE id = p_conversation_id AND zapi_connection_id IS NULL; END IF;
    RETURN v_connection_id;
  END IF;
  IF p_is_new_contact THEN
    SELECT id INTO v_connection_id FROM zapi_connections WHERE is_active = true AND connection_status != 'disconnected' AND provider = 'zapi' AND new_contacts_today < daily_new_contact_limit ORDER BY new_contacts_today ASC, created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF v_connection_id IS NULL THEN RAISE EXCEPTION 'DAILY_LIMIT_REACHED'; END IF;
    UPDATE zapi_connections SET new_contacts_today = new_contacts_today + 1 WHERE id = v_connection_id;
  ELSE
    SELECT id INTO v_connection_id FROM zapi_connections WHERE is_active = true AND connection_status != 'disconnected' AND provider = 'zapi' ORDER BY new_contacts_today ASC, created_at ASC LIMIT 1;
  END IF;
  IF p_conversation_id IS NOT NULL AND v_connection_id IS NOT NULL THEN
    UPDATE whatsapp_conversations SET zapi_connection_id = v_connection_id WHERE id = p_conversation_id AND zapi_connection_id IS NULL;
  END IF;
  RETURN v_connection_id;
END;
$function$;

-- Atualizar get_zapi_credentials com novos campos
DROP FUNCTION IF EXISTS public.get_zapi_credentials(uuid);
CREATE OR REPLACE FUNCTION public.get_zapi_credentials(p_connection_id uuid)
RETURNS TABLE(instance_id text, token text, security_token text, phone_number text, provider text, api_url text, instance_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT instance_id, token, security_token, phone_number, provider, api_url, instance_name
  FROM zapi_connections WHERE id = p_connection_id AND is_active = true;
$function$;
```

### Edge Functions (atualizadas automaticamente)
- `whatsapp-send` - Suporte a Era Cloud API + envio de templates com variaveis
- `whatsapp-webhook` - Suporte a Era Cloud provider
- `whatsapp-templates` - Sincronizacao de templates Meta Cloud
- `whatsapp-queue-processor` - Prioridade na fila (priority DESC)
- `cs-daily-report` - Metricas de retencao no relatorio

### Config (supabase/config.toml)
Nenhuma nova entrada necessaria.

### Frontend (atualizado automaticamente)
- `AdminWhatsAppTemplates.tsx` - Tela de templates com bindings e modelos prontos
- `AdminWhatsAppBindings.tsx` - Gestao de bindings template↔processo
- `AdminWhatsAppConnections.tsx` - Suporte a Era Cloud como provider
- `AdminDashboard.tsx` - Metricas de retencao

### Secrets necessarios
- `META_WHATSAPP_TOKEN` - Token de acesso da API do WhatsApp Business (Meta) - se usar Meta Cloud
- `ERA_CLOUD_TOKEN` - Token da Era Cloud API - se usar Era Cloud

### Configuracao manual pos-deploy
1. Adicionar conexao Era Cloud/Meta Cloud na tela de Conexoes (se aplicavel)
2. Sincronizar templates na tela de Templates
3. Criar bindings para processos automaticos (welcome, upsell, etc)

---

## [1.3.0] - 2026-02-15

### Resumo
Followup de onboarding, lembretes de estudo com segundo lembrete, logs de webhook WooCommerce, upsell por WhatsApp, indice unico para sequencias ativas.

### Migrations (rodar no backend da instancia)
```sql
-- Logs de followup de onboarding
CREATE TABLE public.onboarding_followup_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  phone text,
  email text,
  whatsapp_sent boolean NOT NULL DEFAULT false,
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_onboarding_followup_user ON public.onboarding_followup_logs (user_id);
ALTER TABLE public.onboarding_followup_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage onboarding_followup_logs"
  ON public.onboarding_followup_logs FOR ALL USING (is_admin(auth.uid()));

-- Segundo lembrete de onboarding
ALTER TABLE public.onboarding_reminder_settings
ADD COLUMN second_reminder_days integer NOT NULL DEFAULT 7,
ADD COLUMN second_reminder_enabled boolean NOT NULL DEFAULT true;

-- Logs de webhook
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'woocommerce',
  product_id TEXT, product_name TEXT, email TEXT, phone TEXT, user_name TEXT,
  status TEXT NOT NULL DEFAULT 'received', status_detail TEXT,
  user_id UUID, is_new_user BOOLEAN DEFAULT false,
  already_had_access BOOLEAN DEFAULT false,
  raw_payload JSONB, error_message TEXT, processing_time_ms INTEGER
);
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view webhook logs" ON public.webhook_logs FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage webhook logs" ON public.webhook_logs FOR ALL USING (is_admin(auth.uid()));
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs (created_at DESC);
CREATE INDEX idx_webhook_logs_email ON public.webhook_logs (email);
CREATE INDEX idx_webhook_logs_status ON public.webhook_logs (status);

-- Upsell WhatsApp columns
ALTER TABLE public.upsell_sequences
  ADD COLUMN whatsapp_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN last_whatsapp_at timestamptz;
ALTER TABLE public.upsell_email_logs
  ADD COLUMN channel text NOT NULL DEFAULT 'email';
ALTER TABLE public.upsell_settings
  ADD COLUMN whatsapp_enabled boolean NOT NULL DEFAULT false;

-- Indice unico para evitar sequencias duplicadas ativas
CREATE UNIQUE INDEX IF NOT EXISTS idx_upsell_sequences_unique_active
ON upsell_sequences (user_id, product_type, product_id)
WHERE status = 'active';

-- Coluna enrollment_days_trigger
ALTER TABLE public.upsell_settings
ADD COLUMN enrollment_days_trigger integer NOT NULL DEFAULT 10;

-- Template name para upsell WhatsApp
ALTER TABLE upsell_settings
ADD COLUMN whatsapp_template_name text NOT NULL DEFAULT 'abertura_upsell_1';
```

### Edge Functions (atualizadas automaticamente)
- `send-onboarding-followup` - Followup individual via email + WhatsApp
- `send-onboarding-followup-batch` - Followup em lote
- `send-onboarding-reminders` - Lembretes de onboarding (1o e 2o lembrete)
- `woocommerce-webhook` - Log detalhado de webhooks
- `generate-upsell-whatsapp` - Geracao de mensagem upsell WhatsApp com IA
- `process-upsell` - Processamento de upsell com canal WhatsApp

### Config (supabase/config.toml)
Nenhuma nova entrada necessaria.

### Frontend (atualizado automaticamente)
- `AdminWebhookLogs.tsx` - Visualizacao de logs de webhook
- `OnboardingReminderSettings.tsx` - Config de 2o lembrete
- `AdminUpsell.tsx` - Config de upsell WhatsApp
- Sidebar atualizada com link para Webhook Logs

### Secrets necessarios
Nenhum novo secret nesta versao.

### Configuracao manual pos-deploy
Nenhuma configuracao manual necessaria.

---

## [1.2.0] - 2026-02-13

### Resumo
Templates WhatsApp (Meta Cloud), agente IA com escalonamento, relatorios CS automaticos, timeline de eventos, materiais multiplos por aula, transcricao e notas de aula com IA.

### Migrations (rodar no backend da instancia)
```sql
-- Templates WhatsApp
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES zapi_connections(id) ON DELETE CASCADE,
  name text NOT NULL, language text NOT NULL DEFAULT 'pt_BR',
  category text NOT NULL, status text NOT NULL DEFAULT 'PENDING',
  components jsonb, created_at timestamptz DEFAULT now(),
  UNIQUE(connection_id, name, language)
);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage templates" ON public.whatsapp_templates FOR ALL USING (public.is_admin(auth.uid()));

-- Agente IA WhatsApp
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS agent_mode text NOT NULL DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

CREATE TABLE public.whatsapp_agent_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT false,
  system_prompt text NOT NULL DEFAULT 'Voce e um atendente...',
  escalation_keywords text[] NOT NULL DEFAULT ARRAY['atendente','humano','reclamacao']::text[],
  auto_reply_delay_seconds integer NOT NULL DEFAULT 5,
  max_messages_per_conversation integer NOT NULL DEFAULT 50,
  business_context text NOT NULL DEFAULT 'A Criminal Lab e uma plataforma de cursos online...',
  whatsapp_welcome_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.whatsapp_agent_settings (id) VALUES (gen_random_uuid());
ALTER TABLE public.whatsapp_agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage whatsapp_agent_settings" ON public.whatsapp_agent_settings FOR ALL USING (is_admin(auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_agent_settings;

-- Relatorios CS
CREATE TABLE cs_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  report_text text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}',
  alerts jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cs_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage cs_reports" ON cs_reports FOR ALL USING (is_admin(auth.uid()));

-- Timeline de eventos CS
CREATE TABLE public.cs_timeline_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL, event_subtype text NOT NULL DEFAULT 'sent',
  user_id uuid, phone text, channel text NOT NULL DEFAULT 'whatsapp',
  summary text NOT NULL, metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cs_timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage cs_timeline_events" ON public.cs_timeline_events FOR ALL USING (is_admin(auth.uid()));
CREATE INDEX idx_cs_timeline_events_created_at ON public.cs_timeline_events (created_at DESC);

-- Materiais multiplos por aula
CREATE TABLE public.recipe_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL, file_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recipe_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors can manage recipe_materials" ON public.recipe_materials FOR ALL USING (can_edit(auth.uid()));
CREATE POLICY "Users can view recipe_materials" ON public.recipe_materials FOR SELECT USING (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_materials.recipe_id));

-- Migrar material_url existente
INSERT INTO public.recipe_materials (recipe_id, name, file_url, display_order)
SELECT id, 'Material', material_url, 0 FROM public.recipes
WHERE material_url IS NOT NULL AND material_url != '';

-- Transcricao e notas de aula
ALTER TABLE public.recipes ADD COLUMN transcript text;
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS transcript_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes_status text DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_recipes_transcript_status ON public.recipes(transcript_status);
CREATE INDEX IF NOT EXISTS idx_recipes_notes_status ON public.recipes(notes_status);

-- Fila de prioridade WhatsApp
ALTER TABLE public.whatsapp_send_queue ADD COLUMN priority integer NOT NULL DEFAULT 0;

-- Atualizar claim com prioridade
CREATE OR REPLACE FUNCTION public.claim_whatsapp_queue_items(batch_size integer DEFAULT 5)
RETURNS SETOF whatsapp_send_queue LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM whatsapp_send_queue
    WHERE status = 'pending' AND scheduled_at <= now()
    ORDER BY priority DESC, created_at ASC
    LIMIT batch_size FOR UPDATE SKIP LOCKED
  )
  UPDATE whatsapp_send_queue q SET status = 'processing'
  FROM claimed c WHERE q.id = c.id RETURNING q.*;
END;
$function$;
```

### Edge Functions (atualizadas automaticamente)
- `whatsapp-agent` - **NOVA** - Agente IA para atendimento via WhatsApp com escalonamento
- `whatsapp-templates` - **NOVA** - Sincronizacao de templates com Meta Cloud
- `cs-daily-report` - **NOVA** - Geracao automatica de relatorio diario
- `process-lesson-transcripts` - Processamento de transcricoes de aulas
- `generate-lesson-notes` - Geracao de notas de aula com IA
- `vimeo-transcript` - Transcricao de videos Vimeo

### Config (supabase/config.toml)
```toml
[functions.whatsapp-agent]
verify_jwt = false

[functions.cs-daily-report]
verify_jwt = false
```

### Frontend (atualizado automaticamente)
- `AdminCSReports.tsx` - Visualizacao de relatorios CS
- `AdminCSTimeline.tsx` - Timeline unificada de eventos
- `AdminWhatsAppTemplates.tsx` - Gestao de templates
- Agente IA config no admin WhatsApp
- `LessonForm.tsx` - Materiais multiplos por aula + transcricao + notas

### Secrets necessarios
Nenhum novo secret (usa Lovable AI para agente e geracao de notas).

### Configuracao manual pos-deploy
1. Configurar o system prompt do agente na tela de WhatsApp > Agente IA
2. Configurar o cron do `cs-daily-report` (ex: diariamente as 23h)

---

## [1.1.0] - 2026-02-11

### Resumo
Sistema WhatsApp completo: conversas em tempo real, fila de envio com claims atomicos, conexoes Z-API, welcome automatico, status de conexao, propagacao automatica de acesso (curso→modulos, combo→cursos→modulos).

### Migrations (rodar no backend da instancia)
```sql
-- Conversas WhatsApp
CREATE TABLE public.whatsapp_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_name text,
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage whatsapp_conversations" ON public.whatsapp_conversations FOR ALL USING (public.is_admin(auth.uid()));
CREATE TRIGGER update_whatsapp_conversations_updated_at BEFORE UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mensagens WhatsApp
CREATE TABLE public.whatsapp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'outbound',
  message_type text NOT NULL DEFAULT 'text',
  content text, zapi_message_id text,
  status text NOT NULL DEFAULT 'sent',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage whatsapp_messages" ON public.whatsapp_messages FOR ALL USING (public.is_admin(auth.uid()));

-- Settings WhatsApp
CREATE TABLE public.whatsapp_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT false,
  welcome_message text,
  business_hours_start time, business_hours_end time,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage whatsapp_settings" ON public.whatsapp_settings FOR ALL USING (public.is_admin(auth.uid()));
INSERT INTO public.whatsapp_settings (is_enabled) VALUES (false);

-- Fila de envio WhatsApp
CREATE TABLE public.whatsapp_send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL, message text NOT NULL,
  context_type text NOT NULL DEFAULT 'upsell', context_data jsonb,
  status text NOT NULL DEFAULT 'pending', error_message text,
  attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_send_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage whatsapp_send_queue" ON public.whatsapp_send_queue FOR ALL USING (public.is_admin(auth.uid()));
CREATE INDEX idx_whatsapp_send_queue_pending ON public.whatsapp_send_queue (status, scheduled_at) WHERE status = 'pending';

-- Conexoes Z-API
CREATE TABLE public.zapi_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, instance_id text NOT NULL,
  token text NOT NULL, security_token text NOT NULL,
  phone_number text NOT NULL, is_active boolean NOT NULL DEFAULT true,
  daily_new_contact_limit integer NOT NULL DEFAULT 100,
  new_contacts_today integer NOT NULL DEFAULT 0,
  last_reset_at date NOT NULL DEFAULT CURRENT_DATE,
  connection_status text NOT NULL DEFAULT 'unknown',
  last_status_at timestamptz, last_disconnect_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zapi_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage zapi_connections" ON public.zapi_connections FOR ALL USING (is_admin(auth.uid()));
CREATE TRIGGER update_zapi_connections_updated_at BEFORE UPDATE ON public.zapi_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar zapi_connection_id
ALTER TABLE public.whatsapp_conversations ADD COLUMN zapi_connection_id uuid REFERENCES public.zapi_connections(id);
ALTER TABLE public.whatsapp_send_queue ADD COLUMN zapi_connection_id uuid REFERENCES public.zapi_connections(id);

-- Funcoes de claim atomico
CREATE OR REPLACE FUNCTION public.claim_whatsapp_queue_items(batch_size integer DEFAULT 5)
RETURNS SETOF whatsapp_send_queue LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY WITH claimed AS (SELECT id FROM whatsapp_send_queue WHERE status = 'pending' AND scheduled_at <= now() ORDER BY created_at ASC LIMIT batch_size FOR UPDATE SKIP LOCKED)
  UPDATE whatsapp_send_queue q SET status = 'processing' FROM claimed c WHERE q.id = c.id RETURNING q.*;
END; $$;

CREATE OR REPLACE FUNCTION public.select_zapi_connection(p_conversation_id uuid DEFAULT NULL, p_is_new_contact boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
-- (round-robin com limite diario e fallback)
$$;

CREATE OR REPLACE FUNCTION public.get_zapi_credentials(p_connection_id uuid)
RETURNS TABLE(instance_id text, token text, security_token text, phone_number text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT instance_id, token, security_token, phone_number FROM zapi_connections WHERE id = p_connection_id AND is_active = true;
$$;

-- Fila de welcome
CREATE TABLE public.whatsapp_welcome_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL, email text NOT NULL, full_name text,
  product_name text, temporary_password text,
  is_new_user boolean NOT NULL DEFAULT false,
  credentials_sent boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz NOT NULL DEFAULT (now() + interval '1 minute'),
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_welcome_queue ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_welcome_items()
RETURNS SETOF whatsapp_welcome_queue LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY WITH claimed AS (SELECT id FROM whatsapp_welcome_queue WHERE processed = false AND scheduled_at <= now() ORDER BY created_at ASC FOR UPDATE SKIP LOCKED)
  UPDATE whatsapp_welcome_queue q SET processed = true FROM claimed c WHERE q.id = c.id RETURNING q.*;
END; $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;

-- Propagacao automatica de acesso
ALTER TABLE public.user_courses ADD CONSTRAINT user_courses_user_id_course_id_key UNIQUE (user_id, course_id);
ALTER TABLE public.user_combos ADD CONSTRAINT user_combos_user_id_combo_id_key UNIQUE (user_id, combo_id);

CREATE OR REPLACE FUNCTION public.propagate_course_package_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO user_packages (user_id, package_id) SELECT uc.user_id, NEW.package_id FROM user_courses uc WHERE uc.course_id = NEW.course_id ON CONFLICT (user_id, package_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER propagate_course_package_access_trigger AFTER INSERT ON public.course_packages FOR EACH ROW EXECUTE FUNCTION public.propagate_course_package_access();

CREATE OR REPLACE FUNCTION public.propagate_combo_course_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO user_courses (user_id, course_id) SELECT ucb.user_id, NEW.course_id FROM user_combos ucb WHERE ucb.combo_id = NEW.combo_id ON CONFLICT (user_id, course_id) DO NOTHING;
  INSERT INTO user_packages (user_id, package_id) SELECT ucb.user_id, cp.package_id FROM user_combos ucb CROSS JOIN course_packages cp WHERE ucb.combo_id = NEW.combo_id AND cp.course_id = NEW.course_id ON CONFLICT (user_id, package_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER propagate_combo_course_access_trigger AFTER INSERT ON public.combo_courses FOR EACH ROW EXECUTE FUNCTION public.propagate_combo_course_access();
```

### Edge Functions (atualizadas automaticamente)
- `whatsapp-send` - Envio de mensagens via Z-API
- `whatsapp-webhook` - Recebimento de mensagens
- `whatsapp-status-webhook` - Atualizacao de status de mensagens
- `whatsapp-queue-processor` - Processador da fila de envio
- `whatsapp-welcome` - Enfileirar welcome de novos usuarios
- `whatsapp-welcome-process` - Processar fila de welcome

### Config (supabase/config.toml)
```toml
[functions.whatsapp-webhook]
verify_jwt = false

[functions.whatsapp-status-webhook]
verify_jwt = false

[functions.whatsapp-queue-processor]
verify_jwt = false

[functions.whatsapp-welcome]
verify_jwt = false

[functions.whatsapp-welcome-process]
verify_jwt = false
```

### Secrets necessarios
- `ZAPI_CLIENT_TOKEN` - Token do cliente Z-API

### Configuracao manual pos-deploy
1. Criar pelo menos uma conexao Z-API na tela de Conexoes
2. Configurar os webhooks da Z-API apontando para as edge functions
3. Configurar cron do `whatsapp-queue-processor` (ex: a cada 1 minuto)
4. Configurar cron do `whatsapp-welcome-process` (ex: a cada 2 minutos)

---

## [1.0.0] - 2026-02-10

### Resumo
Versao base: plataforma de cursos com autenticacao, pacotes/cursos/combos, aulas com video Vimeo, progresso do aluno, favoritos, upsell automatico por email, SSO, push notifications, lembretes de estudo, email de boas-vindas.

### Migrations (rodar no backend da instancia)
Usar as migrations existentes na pasta `supabase/migrations/` do projeto ate a data 2026-02-10. Rodar todas em ordem.

Principais tabelas criadas:
- `profiles` - Perfis de usuario
- `packages` - Pacotes/modulos de aulas
- `courses` - Cursos
- `combos` - Combos (agrupamento de cursos)
- `combo_courses` - Relacao combo↔curso
- `course_packages` - Relacao curso↔pacote
- `recipes` - Aulas (lessons)
- `recipe_packages` - Relacao aula↔pacote
- `recipe_views` - Visualizacoes/progresso de aulas
- `favorites` - Aulas favoritas
- `collections` - Colecoes de aulas
- `collection_recipes` - Relacao colecao↔aula
- `shopping_list_items` - Itens da lista de compras
- `user_packages` - Matriculas em pacotes
- `user_courses` - Matriculas em cursos
- `user_combos` - Matriculas em combos
- `user_roles` - Papeis de usuario (super_admin, editor, viewer)
- `email_settings` - Config de email
- `email_templates` - Templates de email
- `upsell_sequences` - Sequencias de upsell
- `upsell_settings` - Config de upsell
- `upsell_sales_page_cache` - Cache de paginas de venda
- `upsell_email_logs` - Logs de emails de upsell
- `upsell_unsubscribes` - Descadastramento de upsell
- `onboarding_reminder_settings` - Config de lembretes de onboarding
- `study_reminder_settings` - Config de lembretes de estudo
- `push_subscriptions` - Subscricoes push
- `notifications` - Notificacoes

### Edge Functions (atualizadas automaticamente)
- `create-user` - Criacao de usuario pelo admin
- `delete-auth-user` - Exclusao de usuario
- `reset-user-password` - Reset de senha pelo admin
- `update-auth-email` - Atualizacao de email
- `send-magic-link` - Login via magic link
- `send-reset-password-email` - Email de reset de senha
- `sso-verify` - Verificacao SSO
- `bootstrap-admin` - Criacao do admin inicial
- `woocommerce-webhook` - Webhook WooCommerce para matricula automatica
- `vimeo-thumbnails` - Thumbnails do Vimeo
- `vimeo-resolve-hash` - Resolver hash de videos Vimeo
- `generate-upsell-email` - Geracao de email de upsell com IA
- `process-upsell` - Processamento de upsell
- `upsell-unsubscribe` - Descadastro de upsell
- `send-welcome-email` - Email de boas-vindas
- `resend-welcome-email` - Reenviar email de boas-vindas
- `send-onboarding-reminders` - Lembretes de onboarding
- `send-study-reminders` - Lembretes de estudo
- `send-push-notification` - Envio de push notifications
- `generate-vapid-keys` - Geracao de chaves VAPID
- `get-vapid-key` - Obter chave publica VAPID

### Config (supabase/config.toml)
```toml
[functions.woocommerce-webhook]
verify_jwt = false

[functions.vimeo-thumbnails]
verify_jwt = false

[functions.generate-upsell-email]
verify_jwt = false

[functions.process-upsell]
verify_jwt = false

[functions.upsell-unsubscribe]
verify_jwt = false

[functions.generate-upsell-whatsapp]
verify_jwt = false

[functions.send-magic-link]
verify_jwt = false

[functions.sso-verify]
verify_jwt = false

[functions.vimeo-resolve-hash]
verify_jwt = false

[functions.send-study-reminders]
verify_jwt = false

[functions.send-onboarding-followup-batch]
verify_jwt = false

[functions.backfill-onboarding-messages]
verify_jwt = false
```

### Secrets necessarios
- `VIMEO_ACCESS_TOKEN` - Token de acesso da API do Vimeo
- `RESEND_API_KEY` - Chave da API Resend para envio de emails
- `WOOCOMMERCE_WEBHOOK_SECRET` - Secret do webhook WooCommerce (opcional)
- `VAPID_PUBLIC_KEY` - Chave publica VAPID (gerar via edge function `generate-vapid-keys`)
- `VAPID_PRIVATE_KEY` - Chave privada VAPID (gerar via edge function `generate-vapid-keys`)

### Configuracao manual pos-deploy
1. Rodar `bootstrap-admin` para criar o primeiro usuario admin
2. Configurar webhook no WooCommerce apontando para `woocommerce-webhook`
3. Adicionar token do Vimeo nos secrets
4. Adicionar chave Resend nos secrets
5. Gerar chaves VAPID chamando a edge function `generate-vapid-keys`
6. Configurar crons para lembretes de estudo e onboarding
7. Criar pacotes, cursos e aulas na interface admin
