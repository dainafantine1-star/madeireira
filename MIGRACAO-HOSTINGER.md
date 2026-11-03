# Migração para Hostinger — Madeireira Progresso

Atualizado em 28/10/2026. Este pedido substitui a estratégia anterior de manter a Madeireira apenas na Vercel: o usuário autorizou fazer backup do projeto NAC na Hostinger e, depois, hospedar a Madeireira lá.

## Estado e acesso

- O domínio do NAC e o tipo exato de serviço Hostinger ainda precisam ser identificados.
- Foi encontrada uma conexão SSH local para `187.127.32.214`, usuário `root`. Não foi confirmado que pertença ao NAC/Hostinger; nenhuma conexão foi realizada nesse host.
- Não há plugin conectado para administrar hospedagem/DNS Hostinger. Hostinger Mail não oferece esse acesso.
- O acesso correto e o plano são necessários para executar a operação. Não foi feito backup remoto do NAC, substituição de arquivos, deploy Hostinger ou alteração DNS nesta etapa.

## Trabalho independente preparado

- Inspeção da aplicação existente: Node 24, SQLite e mídias persistentes. Há Dockerfile, compose.yaml e deploy/Caddyfile para VPS.
- Exportador de leitura do Blob em `.cache/export-madeireira-hostinger.mjs`: usa credenciais locais somente em memória, gera arquivo MPB1 criptografado, restaura isoladamente e confere integridade, contagens, catálogo e revogação de sessões na cópia restaurada.
- Exportação concluída e restauração isolada validada em 28/10/2026, aproximadamente 13h28 na Bahia. Relatório: `.cache/hostinger-migration/madeireira-export-verification.json`. Ele não é backup do NAC.
- Arquivo: `.cache/hostinger-migration/backup-2026-10-28T16-28-33-129Z-28f4c496-daf8-4de7-92a1-6971e42acaee.mpbackup` (52.707.949 bytes, criptografado MPB1). SHA-256: `d524b896d45e9ac83e0bfb2b4ce918f99afd5ac09b5695bf10523d435723de6c`.
- Contagens preservadas: 44 linhas em products (contagem bruta, inclui exclusões lógicas), 32 produtos publicados, 12 categorias, 32 arquivos de mídia, uma conta administrativa, nenhum cliente ou pedido. Sessões foram revogadas somente na cópia restaurada de teste; nenhuma gravação na origem.
- A chave necessária para restaurar é a BACKUP_KEY da nuvem já guardada em `.env.vercel.local`. A chave não foi embutida no backup, no relatório nem nesta documentação. As pastas temporárias com cópias descriptografadas foram removidas após a verificação; o arquivo criptografado e o relatório permaneceram em cache privado.

## Backup do NAC — antes de qualquer substituição

1. Confirmar domínio, site, serviço e diretórios exatos, além de todos os bancos e volumes usados pelo NAC. Não presumir WordPress, MySQL ou o caminho public_html sem inspecionar.
2. Inventariar versões, processo de execução, proxy, variáveis, tarefas agendadas, armazenamento e DNS. Não imprimir credenciais.
3. Gerar cópia consistente de arquivos e banco com a ferramenta adequada à tecnologia identificada. Em hospedagem hPanel, baixar os backups de arquivos e banco; em VPS, considerar snapshot do servidor e backup da aplicação, com consistência de banco verificada.
4. Armazenar uma cópia fora da árvore pública e fora do diretório que será substituído, com acesso restrito e hash SHA-256. Registrar data, origem e procedimento de restauração sem segredos.
5. Validar arquivo e restauração em destino isolado. Snapshot sozinho não comprova que banco e arquivos estão consistentes.
6. Somente depois preparar a substituição pelo projeto Madeireira, mantendo caminho concreto de rollback para o NAC.

## Compatibilidade e alterações necessárias

O Node.js gerenciado da Hostinger informa suporte a Node 24, mas é necessário conferir o plano e o comportamento de persistência do serviço contratado. Não presumir que um upload estático ou hospedagem PHP execute o servidor.

Para VPS, a configuração Docker existente é ponto de partida. Antes de subir, inspecionar quem utiliza 80/443 e o proxy já existente; não executar compose de modo que derrube outros sites. Manter o banco e as mídias em volume persistente, uma instância de aplicação e backups fora do volume principal.

O backend standalone `server/index.js` atualmente aceita uma origem fixa para mutações. O suporte ADMIN_ORIGIN foi implementado no adaptador Vercel, não no standalone. A migração com loja e admin em hosts distintos precisa adaptar origens permitidas com validação exata, preservar CSRF e cookies seguros, e testar login/gravações em ambos os hosts.

O rewrite da raiz do admin e os redirects estão em vercel.json e não serão aplicados automaticamente pela Hostinger. Configurar equivalente no proxy/runtime escolhido. O Caddyfile atual só atende SITE_DOMAIN; não considerar o subdomínio já resolvido por essa configuração.

## Dados e virada

- Usar o snapshot remoto atual da Madeireira como fonte. O banco local não sincroniza com a Vercel. Não publicar catálogo vazio nem recriar o proprietário existente.
- Uma exportação é um retrato no tempo: verificar possíveis gravações posteriores antes da virada e combinar uma janela breve sem alterações para a cópia final, se necessário.
- Instalar primeiro em ambiente isolado e conferir catálogo, mídias, loja, login, permissões, edição e persistência após reinício.
- Atualizar DNS somente depois de conhecer o destino real. Os registros CNAME da Vercel indicados nos documentos anteriores não representam automaticamente o novo apontamento Hostinger.
- Manter `madeireiraprogresso.com` como loja e `admin.madeireiraprogresso.com` como painel. Preservar MX/TXT de e-mail e outros serviços.
- Confirmar HTTPS, redirecionamento www, rotas e backup agendado no destino. Não encerrar a publicação da Vercel antes de validar a nova hospedagem e a possibilidade de rollback.

## Referências consultadas

- [Hostinger — aplicação Node.js e versões suportadas](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Hostinger — baixar backups de arquivos e bancos](https://www.hostinger.com/support/5981435-how-to-download-backups-at-hostinger/)
- [Hostinger — backups e snapshots VPS](https://www.hostinger.com/support/1583232-how-to-back-up-or-restore-a-vps-at-hostinger/)
