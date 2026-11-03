# Debug — terminal Windows

## Estado consolidado para retomada

Atualizado em 28/10/2026. As seções abaixo preservam a sequência da investigação; suas pendências intermediárias foram parcialmente superadas. Estado mais recente: teste remoto e instalação do Claude Code 2.1.312 confirmados pelo usuário; limite de tokens corrigido; campo env opcional corrigido e validado localmente em quatro cenários; captura posterior mostra seleção inicial de tema. Onboarding completo, gravação final da configuração, resposta dentro do Claude e substituição da credencial exposta continuam sem confirmação. Consultar também `HANDOFF-MADEIREIRA-PROGRESSO.md`, seções 17 e 18.

## npm bloqueado no PowerShell (28/10/2026)

Sintoma relatado: `npm.ps1` não pode ser carregado porque a execução de scripts foi desabilitada; `UnauthorizedAccess` ao executar `npm uninstall -g @anthropic-ai/claude-code`.

Verificação local: `Get-Command npm,npm.cmd` identificou `npm.ps1` como ExternalScript e `npm.cmd` como Application no diretório do Node.js. `npm.cmd --version` concluiu com código 0 e versão 11.19.0.

Procedimento: no bloco PowerShell, trocar chamadas `npm` por `npm.cmd` e chamadas `npx` por `npx.cmd`, se presentes. Essa seleção explícita evita executar o wrapper PowerShell sem alterar a política do sistema. Não executar desinstalação apenas para verificar o diagnóstico.

Bloco completo recebido: há uma chamada `npm` dentro de uma condição `Get-Command npm`. Ajustar ambas para `npm.cmd`. O bloco também remove configurações globais, dados locais e configurações do projeto; essas exclusões não são necessárias para corrigir o bloqueio do wrapper. Uma credencial foi compartilhada no chat: orientar revogação e substituição sem copiá-la para documentação ou comandos de ferramentas.

Pendente: instalação, autenticação no provedor externo e identificadores de modelos não foram executados nem validados. A correção de seleção do wrapper não confirma o funcionamento dessas etapas.

Script completo entregue em `instalar-claude.ps1`: usa instalador nativo sem npm, solicita chave com entrada oculta, testa o modelo informado antes de gravar, faz backup de settings.json e preserva outras propriedades. Todas as seleções de modelo usam o mesmo identificador testado; não presume suporte aos nomes Opus/Sonnet fornecidos anteriormente. Sintaxe validada pelo parser PowerShell sem erros; script não executado. A chave fica no settings.json local, conforme a configuração solicitada. Não altera variáveis persistentes do usuário nem remove dados do Claude.

Consulta de documentação online indisponível nesta sessão: ferramenta de busca retornou HTTP 503. O funcionamento de `npm.cmd` foi verificado localmente.

## Resposta inesperada do provedor (captura de 28/10/2026)

A captura do usuário mostra o teste com o modelo padrão `claude-haiku-4-5` e a exceção local `O provedor nao retornou uma resposta de mensagem valida.`. Isso identifica a condição de validação de `id`/`content`, mas não comprova chave inválida, modelo indisponível ou formato HTML. O corpo da resposta não está na captura. O script para antes da instalação e da gravação das configurações.

Próximo diagnóstico: na mesma sessão, conferir se `$result` é nulo e, caso contrário, mostrar somente `$result.GetType().FullName` e `$result.PSObject.Properties.Name`. Não imprimir chave, cabeçalhos de autorização nem corpo bruto sem revisão. Causa externa e correção permanecem pendentes dessa evidência; não remover a validação para forçar sucesso.

Retorno do diagnóstico: `$result` é `System.Management.Automation.PSCustomObject` com campos `id`, `type`, `role`, `model`, `content`, `stop_reason`, `stop_sequence` e `usage`. Isso confirma a estrutura esperada, mas não valores válidos ou conteúdo não vazio. Próxima coleta mínima: presença de id não vazio, valor de type, quantidade de itens em content, stop_reason e usage.output_tokens. A hipótese de limite de geração insuficiente (`max_tokens = 8`) segue sem confirmação; não tratar nomes de campos como teste remoto aprovado.

Evidência posterior confirmou: TemId=True, Tipo=message, QuantidadeConteudo=0, MotivoParada=max_tokens e TokensSaida=8. A resposta atingiu o limite de geração sem retornar conteúdo. Aumentado `max_tokens` do teste em `instalar-claude.ps1` para 1024; validação de conteúdo mantida. Nova chamada remota e instalação ainda pendentes. Para executar o arquivo local sem chamar o wrapper npm ou mudar a política de execução: `Get-Content -LiteralPath .\instalar-claude.ps1 -Raw | Invoke-Expression`, no diretório do projeto. Esse comando executa o conteúdo do arquivo; deve ser usado com o arquivo revisado deste projeto.

## Campo env ausente sob modo estrito

Nova execução confirmada pelo usuário: teste remoto passou, Claude Code 2.1.312 instalado em `.local\bin\claude.exe` e backup de settings.json criado. Em seguida, PropertyNotFoundStrict ao ler `$settings.env`, antes da gravação. Corrigida a leitura opcional com `$settings.PSObject.Properties['env']` e criação do objeto quando ausente ou nulo. O bloco real passou em quatro casos sob Set-StrictMode Latest: campo ausente, nulo, objeto com propriedade preservada e tipo inválido rejeitado; parser também passou. Reexecução completa ainda pendente. O script detecta o executável já instalado e pula sua instalação. O aviso de PATH não bloqueia este script, que chama o caminho completo.

Captura posterior do usuário confirma Claude aberto na seleção inicial de tema, com Dark mode selecionado. Orientação: Enter confirma o tema; setas alteram a seleção. Isso comprova abertura da interface, mas não conclusão de onboarding nem resposta de uma conversa dentro do Claude.
