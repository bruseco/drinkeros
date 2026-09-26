# Corrigir certificados em todos os modelos

## Escopo
- Medir os oito fundos PNG cadastrados e identificar proporção, dimensões e área útil de cada modelo.
- Centralizar a geometria do certificado para que prévia e PDF usem a dimensão intrínseca real da imagem.
- Renderizar o PNG inteiro, sem corte, deformação ou conversão indevida para JPEG.
- Proteger nome longo com ajuste de fonte e quebra controlada, mantendo data e conteúdo impresso dentro do modelo.
- Tornar a prévia administrativa responsiva e fiel ao PDF em desktop e celular.
- Adicionar teste local explícito com dados fictícios, sem emissão, gravação, acesso ou tracking.
- Validar os oito modelos em prévia e PDF, registrar medidas e inspecionar visualmente os arquivos exportados.

## Segurança
- Nenhum dado de aluno, conclusão, certificado ou acesso será alterado.
- Nenhuma chamada a `issue_course_certificate` será feita no modo de teste.
- Os PNGs e as configurações atuais do banco serão preservados; ajustes individuais só serão adicionados se as medições provarem necessidade.
- Nada será publicado.

## Detalhes técnicos
- Criar uma utilidade compartilhada para carregar metadados da imagem, detectar PNG/JPEG, calcular página proporcional e posicionar texto no mesmo sistema de coordenadas da imagem.
- Separar a geração pura do arquivo da emissão real para permitir exportação fictícia segura.
- Trocar dimensões fixas e `object-cover` por proporção intrínseca e `object-contain`.
- Cobrir cálculo, formato, nome longo e oito fundos com testes automatizados e inspeção visual dos PDFs renderizados.
