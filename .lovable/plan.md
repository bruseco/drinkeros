

## Plano: Melhorar tratamento do erro "Failed to fetch" no login

### Causa raiz
"Failed to fetch" é a mensagem padrão do navegador quando a requisição HTTP falha antes de receber resposta — geralmente por:
- Reinício momentâneo do serviço de auth (visto nos logs às 20:37 UTC hoje)
- Conexão instável do usuário (Wi-Fi/4G caindo)
- Service Worker do PWA com cache desatualizado interceptando a chamada
- Bloqueio por extensão/adblock/VPN

Não dá para eliminar 100% — mas dá para **deixar a mensagem clara** e **adicionar retry automático**.

### Mudanças

**1. `src/pages/Login.tsx` e `src/pages/admin/AdminLogin.tsx`**
- Detectar `error.message === 'Failed to fetch'` e trocar por mensagem amigável em PT:
  > "Não foi possível conectar. Verifique sua conexão com a internet e tente novamente."
- Adicionar retry automático silencioso (1 tentativa após 1.5s) antes de mostrar o erro ao usuário — cobre o caso do reinício momentâneo do servidor.

**2. `src/contexts/AuthContext.tsx`**
- Envolver `signIn` com try/catch para capturar erros de rede (que hoje podem virar exception não-tratada).
- Retornar erro normalizado no formato `{ error: { message: 'mensagem amigável' } }`.

**3. `src/sw.ts` (Service Worker)**
- Garantir que rotas de auth (`/auth/v1/*` do Supabase) estejam na **denylist do Service Worker**, para nunca serem cacheadas/interceptadas.
- Isso elimina a causa #3 de forma definitiva.

### Resultado para o usuário
- Em vez de "Failed to fetch" (técnico, em inglês), vê: *"Não foi possível conectar. Verifique sua internet."*
- Falhas momentâneas do servidor (sub-segundo) são resolvidas automaticamente sem ele perceber.
- PWAs antigos param de interceptar chamadas de auth.

### Nota
Não consigo identificar **qual usuário específico** teve o erro nem o horário exato sem mais info (e-mail + horário). Se você quiser investigar um caso pontual, me passe esses dados que eu consulto os logs de auth.

