## Problema

Em `/app/ebooks`, ebooks já adquiridos estão abrindo a página de venda (`/ebook/{slug}`) em vez de abrir o PDF direto.

## Causa

Em `src/pages/user/UserEbooks.tsx`, a condição que decide a ação do card é:

```ts
const canDownload = owned && !expired && !!ebook.file_url;
```

Mas o campo `ebook.file_url` é **column-restricted** no Supabase — só admin tem acesso via RPC `admin_get_ebook_file_url` (ver `src/hooks/useEbooks.ts` linhas 22-23). Para usuários comuns, `file_url` vem sempre `null`, então `canDownload` é sempre `false`, mesmo quem comprou cai no fallback de página de venda.

O download em si já é seguro: usa `openSignedFile('ebook', ebookId)` que chama a edge function `get-signed-file-url`, que valida acesso no servidor antes de gerar a URL assinada. Ou seja, não precisamos do `file_url` no cliente para decidir o botão.

## Correção

Arquivo: `src/pages/user/UserEbooks.tsx`

1. Remover a checagem `!!ebook.file_url` da condição `canDownload`:
   ```ts
   const canDownload = owned && !expired;
   ```
2. Simplificar `cardHref` / `isExternal` para refletir: se `canDownload` → ação é abrir via `handleOpenEbook` (signed URL); senão → link para página de venda `/ebook/{slug}`. Expirado continua indo para `/clube`.

Nenhuma alteração em backend, RLS, tracking, pagamentos ou PWA.

## Como testar

1. Logar com usuário que **possui** um ebook (não expirado) → card mostra "Abrir e-book" e clicar abre o PDF em nova aba.
2. Logar com usuário que **não possui** → card mostra "Saiba Mais" e leva para `/ebook/{slug}`.
3. Usuário com acesso **expirado** → continua mostrando "Renovar no Clube" e indo para `/clube`.

## Arquivos alterados

- `src/pages/user/UserEbooks.tsx`
