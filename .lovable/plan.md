

## Problema raiz

O posicionamento usava multiplicadores relativos (ex: `pdfHeight * 0.545`). Quando você pedia "X pixels", eu estimava a mudança no multiplicador e errava. A imagem de fundo tem 3347×2447px, mas 1 pixel = ~0.089mm no PDF — e eu ignorava essa conversão.

## Solução: Preview visual + controles editáveis no admin

### 1. Tabela global `certificate_layout_settings` (singleton)

Campos armazenados em **pixels reais** da imagem 3347×2447:

| Campo | Tipo | Default (posição atual aproximada) |
|-------|------|------------------------------------|
| `name_x` | integer | 1674 (centro horizontal) |
| `name_y` | integer | 1334 (~54.5% da altura) |
| `date_x` | integer | 897 (~26.8% da largura) |
| `date_y` | integer | 1886 (~77% da altura) |
| `name_font_size` | integer | 28 |
| `date_font_size` | integer | 14 |

RLS: somente super_admin pode ler/editar.

### 2. Seção visual no admin (dentro de CourseForm, seção Certificado)

- Botão "Ajustar posição global" abre um painel/dialog
- Mostra a imagem de fundo do certificado com dois textos sobrepostos ("Nome do Aluno" e "dd de mês de yyyy")
- 4 campos numéricos (name_x, name_y, date_x, date_y) em pixels
- **Preview ao vivo**: ao mudar qualquer valor, o texto se move instantaneamente sobre a imagem
- Botões +/- de 1px para ajuste fino
- Botão "Salvar posições"

### 3. Geração do PDF atualizada

`useCertificates.ts` busca as posições globais da tabela `certificate_layout_settings` e converte de pixels para mm:

```
mmX = pixelX * (pdfWidth / 3347)
mmY = pixelY * (pdfHeight / 2447)
```

Isso garante que 1 pixel pedido = 1 pixel real movido.

### 4. Arquivos afetados

- **Nova migration**: cria tabela `certificate_layout_settings` com RLS
- **`src/hooks/useCertificates.ts`**: busca posições da tabela, converte px→mm
- **`src/pages/admin/CourseForm.tsx`**: adiciona dialog de preview visual com controles de posição
- **Novo hook**: `useCertificateLayout.ts` para CRUD das posições globais

### Resultado

Você ajusta nome e data diretamente no painel com preview visual e precisão de 1 pixel, sem depender do chat.

