# Instruções ao Codex — importar catálogo no sistema existente

Leia este arquivo, LEIA_PRIMEIRO.md, produtos.json e inventario_fontes.json antes de alterar o projeto. Este pacote contém dados e evidências; não é um importador pronto nem um dump do banco do sistema. Não temos o código-fonte do projeto nesta entrega. Adapte a implementação ao sistema real, sem trocar a arquitetura ou refazer o layout.

## Resultado esperado

Substituir exclusivamente os produtos fictícios/demonstrativos pelos registros permitidos do catálogo e suas imagens individuais corretas. Preservar outros dados e comportamentos do sistema. Nunca criar produtos novos com base em aparência, montagens repetidas ou nomes de arquivos.

## Execução

1. Identifique AGENTS.md e instruções do projeto, framework, modelos, migrations, armazenamento (banco, JSON, seeds, mocks, localStorage), rotas e todas as telas que exibem produtos. Identifique a fonte efetiva usada em execução e os seeds que poderiam repor produtos fictícios. Não suponha uma estrutura de tabelas.
2. Faça backup dos dados de produtos e vínculos que serão afetados e registre como restaurar. Liste quais registros são demonstrativos com evidência no projeto. A autorização é remover produtos fictícios; não exclua produtos reais, usuários, pedidos, vendas, pagamentos ou outros módulos. Se houver referências históricas, preserve-as e inative o demonstrativo em vez de apagar relações ou executar cascatas. Não execute reset geral do banco.
3. Rode `python validar_catalogo.py` dentro desta pasta (ou `py validar_catalogo.py` no Windows). Se falhar, não prossiga. Leia também as pendências; a validação técnica não resolve os conflitos.
4. Prepare uma simulação da importação: total esperado 35 registros de referência, 32 com importação permitida e 3 bloqueados. Reconciliar possíveis produtos reais já existentes pelo código textual exato. O id_registro do pacote não deve sobrescrever chaves internas do banco. Não gere IDs comerciais nem remova zeros iniciais.
5. Importe somente `importacao_automatica_permitida=true`. Os três pendentes devem ficar fora da importação automática, documentados no relatório. Se houver área própria de revisão, podem ser registrados ali, sem publicar nem inventar código canônico. A aduela 000740/000742 é uma correspondência provisória; não criar ambos. Não escolher NEGRE/NELORE para 000391.
6. Use `descricao` exatamente como fornecida nos permitidos; ela é a legenda disponível, não uma ficha técnica longa. Categoria_sugerida é agrupamento editorial: reutilize categorias equivalentes existentes ou faça mapeamento explícito, sem interpretar a categoria como especificação do fabricante. Campos nulos ficam ausentes ou nulos; nunca invente preço, estoque, marca, dimensões, unidade comercial ou texto publicitário. Se o sistema exigir esses campos, implemente cadastro incompleto/rascunho ou registre impedimento, em vez de preenchê-los com zero ou valores fictícios. Não venda como disponível sem informação de estoque.
7. Copie as imagens individuais do campo `imagem` para o mecanismo de arquivos do projeto e converta somente o caminho público conforme a estrutura real. Não publique montagens como imagem individual. Não associe imagem por proximidade de nome, ordem da pasta ou semelhança visual. As imagens estão intactas e incluem código/legenda; não devem ser regeneradas ou recortadas nesta importação. Consulte as observações visuais de cada registro.
8. Implemente atualização idempotente por código: executar novamente não pode duplicar os produtos. Se houver banco relacional, faça as mudanças de dados de forma transacional quando possível; prepare os arquivos antes e trate falhas com restauração/rollback. Só conclua a remoção/inativação dos fictícios quando os registros reais permitidos estiverem persistidos e os caminhos de imagem funcionarem.
9. Elimine a reposição automática de produtos fictícios nos seeds, mocks ou fallback das telas identificadas. Preserve testes e outros dados de demonstração não relacionados ao catálogo. Não altere .env nem exponha credenciais.
10. Verifique painel administrativo, listagem pública, busca, filtros, detalhes e uso em orçamento/carrinho quando essas funções existirem. Confira zeros à esquerda, medidas, acentos e imagem de cada código. Compare o conjunto efetivamente importado com os 32 códigos permitidos, sem contar os pendentes como concluídos. Verifique imagens via rotas reais e links quebrados; não basta existir no disco.
11. Entregue relatório com: códigos criados, atualizados, preservados, demonstrativos removidos/inativados e motivo, pendentes (3), impedimentos por campos obrigatórios, verificações executadas e instrução de rollback. Não declare todos os 35 produtos publicados se só os 32 permitidos foram importados. Se a aplicação impedir algum dos 32, informe quantos ficaram de fora e por quê.

## Conferência dos conflitos

- `pendente-tauari-15cm`: código individual 000740 / montagem 000742. `codigo=null` por projeto.
- `000391`: legendas ARAME FARPADO NELORE 500MT / ARAME FARPADO NEGRE 500MT. `descricao=null`; não publicar o nome provisório como nome comercial.
- `000744`: TAXI na individual / TXI na montagem. `descricao=null`; não escolher ou expandir a madeira automaticamente.

Não há garantia de completude em relação aos ZIPs indisponíveis excluídos pelo usuário. O escopo da importação é somente este catálogo. Não procurar produtos faltantes na internet nem completar especificações por conhecimento geral.
