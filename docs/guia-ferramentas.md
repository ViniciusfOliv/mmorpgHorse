# Guia de ferramentas — Claude Code, subagentes, MCP e permissões

Material de consulta para o desenvolvedor, separado do `CLAUDE.md` para não pesar no contexto de
toda sessão. Os comandos do Claude Code mudam com frequência: confira na documentação oficial
(https://code.claude.com/docs) antes de copiar.

## Ferramentas e serviços
| Ferramenta | Para quê | Como acessar | Observações |
|---|---|---|---|
| Claude (Max) | planejamento, código, revisão | CLI, app, web | subagentes para tarefas isoladas |
| PixelLab | sprites, animações, tilesets | API v2 (`prototype/tools/pixellab-moldes.mjs`) ou MCP | gasta créditos/cota |
| ElevenLabs | vozes, efeitos, música | MCP | gasta créditos |
| Canva Pro | capa, ícone, imagens de loja, banners, trailer simples | MCP (conector do claude.ai) | — |

Nas sessões na nuvem (claude.ai/code), a PixelLab pode estar liberada pelo proxy do ambiente,
com a credencial injetada automaticamente. Localmente, use a chave real em `PIXELLAB_API_KEY`.
O `pixellab-moldes.mjs` roda em dry-run por padrão (mostra o que geraria e o custo, sem gastar);
`--gerar` gasta, `--teto N` limita o número de gerações, `--reprocessar` refaz os moldes a partir
das respostas cruas guardadas em `raw/`, sem rede e sem custo. Precisa de `NODE_USE_ENV_PROXY=1`
(o `fetch` do Node 22 não usa o proxy sozinho; sem isso a API responde 401). O PixelLab devolve
502 com frequência, sem cobrar.

## Subagentes
- **Agente** = a IA trabalhando sozinha numa tarefa. A conversa principal já é um agente.
- **Subagente** = ajudante especializado que o Claude chama para uma tarefa específica. Roda em
  contexto separado e devolve só o resultado.
- Criar com `/agents` (salva em `.claude/agents/`).
- Ideias para quando fizer falta (os plugins instalados já cobrem revisão de código e testes):
  - `assets` — gera sprites/sons e registra em `docs/memoria/assets.md`
  - `balanceador` — roda `balance.js --tune ...` e propõe ajustes de constantes
- Tarefas simples podem usar um modelo mais rápido/barato no subagente.

## Conexões MCP
- `claude mcp add` roda no **terminal**, fora da conversa (o Claude pode rodá-lo com permissão).
- Escopos:
  - `--scope user` → todos os seus projetos (recomendado para PixelLab e ElevenLabs)
  - padrão (`local`) → só este projeto, só você
  - `--scope project` → compartilhado via Git (`.mcp.json`)
- Exemplo (confira a URL e o formato no site do serviço):
  ```bash
  claude mcp add --scope user --transport http pixellab https://api.pixellab.ai/mcp --header "Authorization: Bearer $PIXELLAB_TOKEN"
  ```
  Atenção: o shell expande `$PIXELLAB_TOKEN` na hora, e o **valor** fica gravado em texto puro
  na sua configuração de usuário (`~/.claude.json`). Aceitável no escopo de usuário; nunca faça
  isso no escopo `project`.
- No `.mcp.json` (escopo `project`), use a expansão do próprio Claude Code, que lê a variável em
  tempo de execução e não grava o segredo no Git:
  ```json
  { "mcpServers": { "pixellab": { "type": "http", "url": "https://api.pixellab.ai/mcp",
      "headers": { "Authorization": "Bearer ${PIXELLAB_TOKEN}" } } } }
  ```
- Depois de adicionar: abra uma **nova conversa** e confira com `/mcp`.

## Permissões
- Modos (Shift+Tab): **normal** (pergunta tudo) · **aceitar edições** (edita sem perguntar;
  comandos ainda perguntam) · **plano** (só lê e planeja) · **automático** (decide sozinho o que
  é seguro, quando disponível na sua conta).
- Comandos seguros e frequentes já estão liberados em `.claude/settings.json` (build, balanço,
  teste de UI, `scripts/check.sh`, `git status/diff/log/show`). Ajustes pessoais vão em
  `.claude/settings.local.json` (fora do Git).
- Sempre pedir confirmação para: apagar arquivos, `git push --force`, ações fora da pasta do
  projeto e qualquer coisa que gaste créditos.
- **Tokens e chaves:** nunca colar na conversa nem no código. Usar `.env` (no `.gitignore`) ou
  variáveis de ambiente.
