# Catálogo consolidado — Madeireira

Escopo autorizado: os dois ZIPs de imagens acessíveis. Os arquivos `arquivo-...zip` e `esse.zip` não foram usados. Não se pode assegurar a inclusão de conteúdos que existiam somente neles.

Foram conferidas 35 imagens individuais e 9 montagens, com 35 ocorrências de produtos nas montagens. A lista reúne 35 correspondências (não 35 identidades comerciais confirmadas): 32 com código e legenda concordantes e 3 pendentes. Há 36 códigos distintos observados por causa do conflito 000740/000742; isso não autoriza criar um produto extra.

## O que usar

- `produtos.json`: lista única estruturada, fonte de dados da importação; códigos são texto e preservam zeros à esquerda.
- `lista_unica.html`: visualização local com todas as imagens, legendas e fontes; abra no navegador após extrair o ZIP.
- `fotos/`: 35 imagens individuais, intactas, vinculadas aos registros.
- `montagens/`: as 9 montagens originais, intactas, para auditoria.
- `inventario_fontes.json`: nomes originais, ZIP de origem, caminhos, tamanhos e SHA-256 de todas as 44 imagens.
- `INSTRUCOES_CODEX.md`: procedimento para substituir produtos fictícios no projeto existente.
- `validar_catalogo.py`: verifica contagens, caminhos, duplicidade, restrições dos pendentes e integridade das imagens. Não certifica a verdade comercial nem substitui conferência humana.

## Pendências que impedem importação automática

1. Aduela porta Tauari 15 cm: imagem individual `000740`; montagem `000742`. Código canônico vazio. Não criar dois produtos, não corrigir a imagem e não escolher código sem confirmação.
2. Arame farpado `000391`: individual “NELORE”; montagem “NEGRE”. Código coincide, nome diverge. As duas grafias estão preservadas; não escolher uma automaticamente.
3. Alisar `000744`: individual “TAXI”; montagem “TXI”. Preservar ambas as grafias e confirmar a madeira antes de importar.

## Regras de fidelidade

As descrições foram transcritas das legendas; não foram acrescentadas promessas, aplicações, dimensões ou marcas por interpretação. Abreviações como TXI, P/, C/, N16 e N18 foram mantidas. Medidas presentes em títulos foram mantidas como texto, sem deduzir a qual dimensão física se referem. Pesos e comprimentos na legenda não definem unidade de venda.

Preços, estoque, unidade comercial e descrição complementar não foram fornecidos e ficam nulos. Não converter nulo em zero. Categorias são sugestões de organização, não campos existentes nas fontes. A concordância de duas legendas não confirma disponibilidade, espécie real da madeira ou autenticidade da imagem.

Há diferenças visuais entre montagens e imagens individuais: alisares aparecem como conjuntos de peças em algumas montagens e como molduras nas individuais; 000491 e 000651 têm legenda MONTADA, mas montagem com peças separadas; 000494 tem embalagem KRONA somente na montagem e 000580 tem GERDAU somente na montagem. Usar a imagem individual vinculada, preservar as alternativas como evidência e não inferir marca ou montagem pela aparência. Todas essas observações também constam dos registros envolvidos.

## Lista única

| Código observado | Descrição da imagem individual | Conferência textual |
|---|---|---|
| 000051 | ADUELA PORTA MANDIOQUEIRO 13CM (DESMONTADA) | Concordante |
| 000052 | ADUELA JANELA MANDIOQUEIRO 13CM (DESMONTADA) | Concordante |
| 000107 | ADUELA PORTA MASSARANDUBA 13CM (DESMONTADA) | Concordante |
| 000138 | ADUELA PORTA ANGELIM PEDRA 13CM (DESMONTADA) | Concordante |
| 000145 | ALISAR PORTA 5CM MASSARANDUBA | Concordante |
| 000203 | ACABAMENTO CANTO INTERNO MAXPLAST | Concordante |
| 000213 | ALISAR PORTA 7CM ANGELIM PEDRA | Concordante |
| 000294 | ALISAR JANELA 5CM ANGELIM PEDRA | Concordante |
| 000305 | ACABAMENTO CANTO EXTERNO MAXPLAST | Concordante |
| 000391 | ARAME FARPADO NELORE 500MT | PENDENTE |
| 000448 | ARAME GERDAU GALVANIZADO N16 | Concordante |
| 000449 | ARAME GERDAU GALVANIZADO N18 | Concordante |
| 000491 | ADUELA MASSARANDUBA 13CM MONTADA C/ 80CM | Concordante |
| 000494 | ADESIVO PLÁSTICO CONEXÕES PVC 75G | Concordante |
| 000508 | ARAME OVALADO Z-700 COMP. 1000MT BELGO | Concordante |
| 000513 | ALISAR PORTA 7CM MASSARANDUBA | Concordante |
| 000579 | ADUELA PORTA MASSARANDUBA 15CM (DESMONTADA) | Concordante |
| 000580 | ARAME LISO N 12 1 KG | Concordante |
| 000604 | ADUELA PARA PORTA 16CM (JATOBÁ) | Concordante |
| 000636 | ADUELA MASSARANDUBA 13CM MONTADA C/ 70CM | Concordante |
| 000637 | ADUELA MASSARANDUBA 13CM MONTADA C/ 60CM | Concordante |
| 000651 | ADUELA MASSARANDUBA 14CM MONTADA C/ 70CM | Concordante |
| 000653 | ADUELA MASSARANDUBA P/ JANELA | Concordante |
| 000728 | ALISAR PORTA 5CM TAUARI (LIXADO) | Concordante |
| 000729 | ADUELA PORTA TAUARI 13CM (LIXADA/DESMONTADA) | Concordante |
| 000730 | ADUELA PORTA TAUARI 14CM (LIXADA/DESMONTADA) | Concordante |
| 000731 | ADUELA PORTA ANGELIM PEDRA 14CM (DESMONTADA) | Concordante |
| 000744 | ALISAR PORTA 7CM TAXI (LIXADO) | PENDENTE |
| 000748 | ADUELA PORTA TAUARI 20CM (LIXADA/DESMONTADA) | Concordante |
| 000776 | ADUELA JANELA ANGELIM PEDRA 13CM (DESMONTADA) | Concordante |
| 000818 | ALISAR PORTA 7CM TAUARI (LIXADO) | Concordante |
| 000819 | ALISAR PORTA 5CM MADEIRA MISTA | Concordante |
| 000823 | ADUELA PORTA MASSARANDUBA 7CM P/ GESSO (MONTADA) | Concordante |
| 000824 | ADUELA JANELA TAUARI 13CM (LIXADA/DESMONTADA) | Concordante |
| 000740 / 000742 | ADUELA PORTA TAUARI 15CM (LIXADA/DESMONTADA) | PENDENTE |
