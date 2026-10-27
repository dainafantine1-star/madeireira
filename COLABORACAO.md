# Desenvolvimento em equipe

Use Node.js 24. Depois de clonar o repositório, execute `npm ci`, copie `.env.example` para `.env` e rode `npm start`. Consulte o README para criar seu próprio proprietário local. Não compartilhe a senha do administrador da publicação.

Cada pessoa trabalha em uma branch e abre um pull request para revisão antes de mesclar na branch principal. Exemplo:

```sh
git switch -c melhoria/descricao-da-mudanca
# Faça e confira as alterações.
npm test
npm run build:vercel
git add caminho/dos/arquivos-alterados
git commit -m "Descreve a alteração"
git push -u origin melhoria/descricao-da-mudanca
```

O código é compartilhado pelo Git. Os arquivos `.env`, `.env.local`, `.env.vercel.local`, o banco em `storage/`, backups, credenciais da Vercel e capturas locais ficam fora do repositório. Configure credenciais individuais e compartilhe segredos somente por um canal apropriado, quando necessário.

O catálogo e os usuários da publicação são persistidos no armazenamento privado da Vercel; clonar o repositório não copia esses dados. O catálogo inicial local pode ser diferente do catálogo atual da nuvem. Não execute a migração para substituir o banco remoto. Consulte `PUBLICACAO-VERCEL.md` para arquitetura e operação.

Publicar código no GitHub não implica configurar publicação automática na Vercel. Defina esse vínculo separadamente, com revisão das permissões e da branch de produção.
