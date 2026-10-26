# Importação do catálogo — 25/10/2026

Fonte: `catalogo_madeireira/catalogo_madeireira/`. O pacote foi extraído com uma pasta duplicada. Foram lidos `INSTRUCOES_CODEX.md`, `LEIA_PRIMEIRO.md`, `produtos.json`, o inventário e as observações dos registros.

## Resultado

- 35 registros de referência: **32 importados e 3 bloqueados**.
- 32 códigos novos; nenhum produto real anterior precisou ser atualizado ou reconciliado nesta primeira execução.
- 10 demonstrativos inativados, sem exclusão física, cascatas ou perda de referências históricas.
- 32 imagens individuais copiadas intactas para `storage/uploads/`, registradas na biblioteca e vinculadas por `imagem` do JSON. Nenhuma montagem foi publicada como foto individual.
- Códigos e SKU são texto com seis dígitos. IDs internos novos foram atribuídos pelo SQLite, sem reutilizar os IDs dos demonstrativos.
- Nome e descrição correspondem exatamente ao pacote. Preço, preço anterior, estoque, unidade de venda e comprimento estruturado permanecem nulos; dimensões e especificações não fornecidas permanecem vazias.
- Os 32 aparecem no catálogo como **indisponíveis**, sem promoção, com preço sob consulta e orçamento bloqueado. É necessário confirmar estoque e unidade comercial antes de disponibilizá-los. Não foi inventado preço nem convertido estoque desconhecido em zero.
- Sem impedimentos de cadastro entre os 32 permitidos: a migration `006_catalog_incomplete.sql` permite unidade nula e PNG original. A validação impede disponibilizar um produto cuja unidade continue desconhecida.

## Códigos criados

`000051`, `000052`, `000107`, `000138`, `000145`, `000203`, `000213`, `000294`, `000305`, `000448`, `000449`, `000491`, `000494`, `000508`, `000513`, `000579`, `000580`, `000604`, `000636`, `000637`, `000651`, `000653`, `000728`, `000729`, `000730`, `000731`, `000748`, `000776`, `000818`, `000819`, `000823`, `000824`.

Atualizados na primeira importação: nenhum. Produtos reais anteriores preservados: nenhum, pois os dez existentes eram demonstrativos. Os demais dados do sistema foram preservados.

## Demonstrativos preservados e inativados

| ID | Código anterior | Produto |
|---|---|---|
| 1 | MP-0001 | Porta de Madeira Maciça |
| 2 | MP-0002 | Cancela Rústica 3m |
| 3 | MP-0003 | Ripa de Pinus 5cm (Pacote 10un) |
| 4 | MP-0004 | Tábua de Eucalipto 30cm |
| 5 | MP-0005 | Deck de Cumaru 2m² |
| 6 | MP-0006 | Forro de Cedro 5m² |
| 7 | MP-0007 | Porta Lisa Mogno |
| 8 | MP-0008 | Cancela de Garagem 4m |
| 9 | MP-0009 | Ripa de Cedro Rosa (Pacote 20un) |
| 10 | MP-0010 | Viga de Eucalipto Tratado 6m |

Evidência: correspondência dos códigos, IDs, nome, categoria, preço, descrição, especificações, imagem Unsplash e campos comerciais com o seed original. As assinaturas estão em `scripts/catalog-demo-signatures.json`; o original foi preservado como fixture de testes, fora do seed em execução. A inativação conserva inclusive as referências de eventos e métricas já existentes. Os dez continuam no painel como não publicados.

O seed da aplicação agora inicializa somente categorias e configuração institucional. Não repõe produtos fictícios. Fixtures demonstrativas são carregadas explicitamente pelos testes, nunca pela aplicação.

## Categorias

Agrupamentos editoriais novos: Aduelas → `aduelas`; Alisares → `alisares`; Arames → `arames`; Adesivos → `adesivos`; Acabamentos → `acabamentos`. As sete categorias anteriores foram preservadas integralmente. Nenhuma categoria foi interpretada como especificação técnica.

## Pendências excluídas da importação

| Registro | Divergência | Ação necessária |
|---|---|---|
| pendente-tauari-15cm | Individual 000740; montagem 000742; código canônico nulo | Confirmar um único código. Nenhum dos dois foi criado. |
| 000391 | NELORE na individual; NEGRE na montagem; descrição nula | Confirmar a legenda comercial antes do cadastro. |
| 000744 | TAXI na individual; TXI na montagem; descrição nula | Confirmar a madeira e a legenda antes do cadastro. |

As fontes conflitantes permanecem intactas no pacote e estão descritas integralmente no relatório JSON. Não foi escolhido nome provisório, código alternativo nem espécie por interpretação. As observações visuais dos permitidos também foram mantidas no relatório de verificação; não se inferiram marcas KRONA/GERDAU nem montagem das peças a partir da ilustração.

## Verificações e evidências

- `validar_catalogo.py` executado com Python portátil: OK, 35 registros, 32 permitidos, três pendentes, 44 imagens íntegras, 70 transcrições e 36 códigos observados.
- Simulação registrada antes da importação e backup completo antes da migration e das alterações de dados.
- Comparação exata dos 32 códigos ativos com os permitidos, descrições, nomes, SKU, acentos, medidas textuais e campos nulos.
- 32 respostas HTTP 200 `image/png`, com SHA-256 idêntico ao original associado ao respectivo código, usando as rotas reais da aplicação.
- Painel administrativo conferido por API: 42 registros totais, incluindo os dez inativos; os 32 importados estão presentes.
- Integridade SQLite e chaves estrangeiras verificadas. Campos históricos dos dez demonstrativos preservados.
- Comparação integral de 16 tabelas não afetadas com o backup: usuários, sessões, clientes, pedidos e itens, histórico, banners, empresa, eventos, métricas, controles de login e importações anteriores preservados. Sete categorias anteriores e auditoria anterior também preservadas; novas ações adicionadas à auditoria.
- Teste isolado de importação, reexecução sem duplicação, reconciliação preservando preço/estoque/unidade reais, rejeição de disponibilidade sem unidade, bloqueio de orçamento e restauração de backup contendo os 32 PNGs passou.
- A conferência de interface e o resultado final da bateria de testes são registrados na seção de encerramento abaixo. Interações de QA usam uma cópia exata do banco importado, evitando inserir telemetria ou sessões de teste no banco atual.

Evidências locais, fora dos diretórios públicos:

- Primeira importação: `storage/catalog-import/2026-10-25T19-40-03-726Z-import.json`.
- Simulação: `storage/catalog-import/2026-10-25T19-34-36-695Z-simulation.json`.
- Verificação dos códigos, preservação e hashes HTTP: `storage/catalog-verification/verification.json`.
- Reexecução no banco atual: `storage/catalog-import/2026-10-25T19-51-59-394Z-import.json` — zero criados, zero atualizados, 32 mantidos, zero novas inativações e nenhuma imagem duplicada.
- Backup inicial e cópia dos arquivos alterados: `storage/catalog-import-before/`.

## Encerramento da conferência de interface

O Chromium passou na listagem dos 32 produtos, busca individual pelos 32 códigos, abertura dos 32 detalhes com nome e descrição exatos, carregamento das fotos, cinco filtros de categoria e ações de orçamento desabilitadas. Painel administrativo e editor passaram, incluindo unidade vazia com a opção “A confirmar”. A versão de celular passou na conferência de largura, sem transbordamento horizontal. Não houve erros de JavaScript.

As imagens originais usam `object-fit: contain` na loja, nos detalhes e no painel, preservando a apresentação completa e as legendas. As capturas `storefront-desktop.png`, `storefront-mobile.png` e `admin-product.png` estão em `storage/catalog-verification/`.

As primeiras tentativas de navegador dentro do sandbox excederam o tempo limite. A conferência específica do catálogo e os testes gerais de navegador passaram com execução local fora do sandbox. Isso não equivale a teste em aparelho físico ou publicação em hospedagem externa; o escopo executado foi o projeto local.

Bateria final: `node --test --test-concurrency=1` — **25 verificações aprovadas, nenhuma falha, cancelamento ou teste ignorado**. Inclui loja e administração no navegador, pedidos, segurança, importação, idempotência, migração e restauração de backups.

## Reexecução

```powershell
# Apenas valida e simula; não altera produtos.
node scripts/import-catalog.js

# Valida, faz novo backup e aplica por código textual exato.
node scripts/import-catalog.js --apply
```

O importador usa o Python portátil local em `.cache/catalog-python/runtime/python.exe`, se existir. Em outro ambiente, defina `CATALOG_PYTHON` para o executável Python instalado. Não é necessário alterar `.env`. Falha do validador interrompe a operação. Conflito entre SKU/código ou registro excluído exige revisão e interrompe a importação. Reexecuções preservam os campos comerciais existentes e não recriam mídia de conteúdo igual.

## Rollback

Backup completo imediatamente anterior à importação:

`storage/catalog-import/backups/backup-2026-10-25T19-40-03-927Z-7e40b264-dc57-4510-8ca3-c7bc5dca4d0e.mpbackup`

Também existe o primeiro backup em `storage/catalog-import-before/backup-2026-10-25T19-31-47-740Z-85f48808-8fcb-401d-b424-af772f0ec3bc.mpbackup`. Ambos são backups locais de desenvolvimento sem criptografia, mantidos fora da área pública.

1. Pare o servidor antes de trocar o banco em uso. Guarde um backup do estado posterior se houver operações novas a preservar.
2. Restaure em um diretório **novo e inexistente**, sem sobrescrever SQLite/WAL ativos:

```powershell
node server/operations-cli.js restore "storage/catalog-import/backups/backup-2026-10-25T19-40-03-927Z-7e40b264-dc57-4510-8ca3-c7bc5dca4d0e.mpbackup" "storage/catalog-rollback"
```

3. Configure o processo do servidor para usar `DATABASE_PATH` apontando para `storage/catalog-rollback/store.sqlite` e `UPLOAD_DIR` apontando para `storage/catalog-rollback/uploads`. Reinicie e confira catálogo, usuários e histórico. A restauração revoga sessões, exigindo novo login. O código atual pode aplicar a migration de unidade nula ao banco restaurado sem apagar dados.
4. Para também reverter os arquivos alterados da aplicação, as cópias anteriores estão em `storage/catalog-import-before/source/`. As duas folhas de estilo foram copiadas como `storefront-refined.css` e `admin.css` nessa pasta; seus destinos originais são `css/storefront-refined.css` e `admin/admin.css`. Reverta os arquivos de forma coordenada, com o servidor parado. Não faça reset geral nem exclua os registros históricos.

O rollback retorna ao momento do backup: operações posteriores precisam ser reconciliadas antes da troca. Não foi executado rollback no banco atual.
