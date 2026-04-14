

## Plano: Migrar sistema de e-mail de Amazon SES para Lovable Cloud

### Contexto
O projeto usa Amazon SES em ~10 Edge Functions para enviar e-mails transacionais (boas-vindas, magic link, reset de senha, onboarding, upsell, etc.). Vamos migrar para o sistema de e-mail integrado do Lovable Cloud, que não requer conta externa ou API keys.

O projeto tem o domínio customizado `www.drinkeros.com`, que pode ser usado para o envio.

### Etapas

**1. Configurar domínio de e-mail**
- Abrir o diálogo de configuração de domínio de e-mail para configurar o envio pelo domínio `drinkeros.com`
- Você precisará adicionar registros DNS (NS records) no seu provedor de domínio para verificação

**2. Configurar infraestrutura de e-mail**
- Criar toda a infraestrutura necessária (filas, tabelas, cron jobs) automaticamente

**3. Criar templates de e-mail transacional**
- Migrar os templates existentes (welcome, magic-link, reset-password) para o novo sistema usando React Email components
- Registrar cada template no sistema

**4. Configurar templates de e-mail de autenticação**
- Configurar os e-mails de autenticação (verificação, reset de senha, magic link) com a identidade visual da Drinkeros

**5. Atualizar Edge Functions existentes**
- Remover dependências do Amazon SES (`@aws-sdk/client-ses`) das Edge Functions
- Substituir chamadas SES por chamadas ao `send-transactional-email` nas seguintes funções:
  - `send-welcome-email` → template transacional "welcome"
  - `send-magic-link` → template auth (magic link nativo)
  - `send-reset-password-email` → template auth (recovery nativo)
  - `resend-welcome-email` → usar novo template "welcome"
  - `bootstrap-admin` → usar novo template "welcome"
  - `send-onboarding-reminders` → template transacional "onboarding-reminder"
  - `send-onboarding-followup` → template transacional "onboarding-followup"
  - `send-onboarding-followup-batch` → template transacional "onboarding-followup"
  - `send-study-reminders` → template transacional "study-reminder"
  - `process-upsell` → template transacional "upsell"
  - `woocommerce-webhook` → template transacional "module-access"

**6. Deploy de todas as funções atualizadas**

### Resultado
- Todos os e-mails enviados pelo domínio `drinkeros.com`
- Sem dependência de conta AWS/SES
- Sistema com retry automático, fila de envio, e log de entregas
- Templates customizáveis com a identidade visual da Drinkeros

### Primeiro passo obrigatório
Antes de tudo, precisamos configurar o domínio de e-mail. Vou abrir o diálogo de configuração para você.

