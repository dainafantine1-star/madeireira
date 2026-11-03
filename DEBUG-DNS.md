# Debug de DNS — Madeireira Progresso

Atualizado em 28/10/2026. Escopo: loja e painel publicados na Vercel, DNS gerenciado na Hostinger.

## Evidências e pendências

- A API Vercel retornou os dois registros A e o CNAME abaixo na configuração do projeto `vercel-madeireira`.
- A imagem atual mostra a confirmação para adicionar os dois A @ com os valores corretos. Esse aviso não é a mensagem de erro de CNAME.
- O usuário relatou `CNAME record content is not valid! (and 1 more error)`. O conteúdo digitado e o segundo erro ainda não foram recebidos. Não é possível afirmar a causa exata sem esses dados.
- O usuário posteriormente confirmou que os apontamentos estão exatamente iguais aos valores fornecidos. Manter o destino correto e isolar o salvamento de `admin` e a edição de `www`, um por vez, para identificar o registro rejeitado e o segundo erro. Nova consulta Google manteve os resultados DNS descritos abaixo; isso não identifica a causa da rejeição no formulário.
- Não há acesso ao painel DNS da Hostinger nesta sessão. Não há confirmação de que todos os registros foram salvos nem de que o HTTPS dos domínios já esteja pronto.
- Em uma consulta posterior ao resolvedor público Google, em 28/10/2026, o A do domínio principal retornou NOERROR sem respostas; as consultas CNAME de admin e www retornaram NXDOMAIN. Isso descreve apenas o resultado observado nesse resolvedor naquele momento, não toda a propagação. Conferir o salvamento dos quatro registros no painel.

## Valores esperados

| Tipo | Nome | Conteúdo | TTL |
| --- | --- | --- | --- |
| A | @ | 216.198.79.1 | 300 |
| A | @ | 64.29.17.1 | 300 |
| CNAME | admin | 596ae90d2ef96671.vercel-dns-017.com | 300 |
| CNAME | www | 596ae90d2ef96671.vercel-dns-017.com | 300 |

Loja: https://madeireiraprogresso.com. Painel: https://admin.madeireiraprogresso.com. `www` está configurado na Vercel para redirecionar à loja.

## Procedimento para o erro CNAME

1. Tratar cada registro individualmente, sem colar uma linha inteira da tabela no campo Conteúdo.
2. Escolher tipo CNAME e nome `admin`. No Conteúdo, digitar somente o destino abaixo, sem espaços antes/depois, aspas, crases, `https://`, barra ou quebra de linha:

```text
596ae90d2ef96671.vercel-dns-017.com
```

3. Usar TTL 300 e salvar. Repetir para `www`, editando o CNAME existente em vez de duplicá-lo.
4. Se ainda houver rejeição, digitar o destino manualmente para eliminar caracteres invisíveis de cópia. Isso é uma verificação, não uma causa confirmada.
5. Conferir se já existe A, AAAA ou CNAME para o mesmo nome `admin` ou `www`. CNAME não pode coexistir com registros A/AAAA no mesmo nome. Não remover registros sem identificar a finalidade.
6. Se persistir, registrar os quatro campos exatos (Tipo, Nome, Conteúdo e TTL) e a segunda mensagem de erro. Analisar a validação do formulário antes de tentar destinos alternativos.

## Confirmação dos registros A

Os dois A @ da captura correspondem à recomendação previamente retornada pela Vercel. É possível confirmar “Adicionar registros adicionais” para essas duas linhas. Após salvar, conferir que o A antigo `2.57.91.91` não permaneceu. Preservar MX/TXT de e-mail, nameservers e registros de outros serviços.

## Verificação após salvar

```powershell
nslookup -type=A madeireiraprogresso.com 1.1.1.1
nslookup -type=CNAME admin.madeireiraprogresso.com 1.1.1.1
nslookup -type=CNAME www.madeireiraprogresso.com 1.1.1.1
```

Conferir os dois IPs no principal e o destino CNAME nos subdomínios. Uma consulta não comprova propagação em todas as redes. Abrir a loja, confirmar o redirecionamento de www e conferir a tela de login em admin, todos por HTTPS sem aviso de certificado. Na Vercel, conferir Settings → Domains.

## Referências oficiais

- [Hostinger — Editor de zona DNS](https://www.hostinger.com/support/how-to-use-hostingers-dns-zone-editor/)
- [Hostinger — Registros A](https://www.hostinger.com/support/4468886-how-to-manage-a-records-at-hostinger/)
- [Vercel — Configurar domínio](https://vercel.com/docs/domains/set-up-custom-domain)
- [Cloudflare — Conflitos de registros com o mesmo nome](https://developers.cloudflare.com/dns/manage-dns-records/troubleshooting/records-with-same-name/)
