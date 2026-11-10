# Guia de ferramentas

Consulta rápida, separada do `CLAUDE.md` para não pesar em toda sessão. Comandos e telas do Claude
Code mudam: na dúvida, vale a documentação oficial (https://code.claude.com/docs).

| Ferramenta | Para quê | Como acessar | Custo |
|---|---|---|---|
| Claude Code | planejamento, código, revisão; subagentes para tarefas isoladas | CLI, app, web | plano |
| PixelLab | moldes de cavalo, ícones, futuros cenários | `prototype/tools/pixellab-moldes.mjs` (API v2) | cota do plano |
| Canva | capa, ícone, imagens de loja | conector do claude.ai | plano |
| ElevenLabs | sons e vozes (ainda não usado) | conector, quando ligado | créditos |

## PixelLab
- `node prototype/tools/pixellab-moldes.mjs --lote moldes|icones|tudo` mostra o que geraria e o custo,
  sem gastar. `--gerar` gasta; `--teto N` limita as gerações; `--reprocessar` refaz os arquivos finais
  a partir das respostas guardadas em `raw/`, sem rede e sem custo.
- Na nuvem, a credencial é injetada pelo proxy do ambiente; rode com `NODE_USE_ENV_PROXY=1` (sem isso
  a API responde 401). Localmente, a chave fica em `PIXELLAB_API_KEY`.
- A API devolve HTTP 502 com frequência, sem cobrar.
- Toda geração paga pede confirmação antes e entra em `docs/memoria/assets.md`.

## Segredos e permissões
- Tokens e chaves nunca vão para a conversa nem para o código: use variáveis de ambiente ou `.env`
  (que está no `.gitignore`).
- Os comandos frequentes e seguros estão liberados em `.claude/settings.json`; ajustes pessoais vão
  em `.claude/settings.local.json` (fora do Git).
- Pedem confirmação: apagar arquivos, `git push --force`, ações fora da pasta do projeto e tudo que
  gaste créditos.

## Teste de interface
`prototype/tools/ui-test.mjs` usa o Playwright com Chromium. O projeto não tem `package.json`: o
Playwright precisa estar instalado no ambiente (nas sessões na nuvem já vem instalado).
