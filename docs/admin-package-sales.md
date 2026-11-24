# Módulos na lista de vendas

Acesso a módulos propagado pelo curso não representa uma venda separada. O caso de 21/11/2026 tinha sete acessos sem valor/referência e o registro do curso atualizado quase 12 minutos depois: o filtro anterior de cinco minutos não os ocultava.

A migração 20261124120000 exige referência de pagamento no ramo legado de pacotes, como já ocorre com cursos e e-books. Compras confirmadas na tabela purchases continuam aparecendo mesmo sem referência no acesso legado. Não há exclusão nem atualização de acessos, cobranças, NIBO ou rastreamento. Permissões e demais filtros são preservados.

Validação: reproduzir os sete módulos atrasados, confirmar uma venda de R$197, manter os sete acessos e compras independentes de pacotes. A migração é idempotente e interrompe se não reconhecer o ramo esperado.

É necessário aplicar a migração no banco; publicar apenas a interface não altera a função do relatório.
