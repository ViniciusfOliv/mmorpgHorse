# MMORPG Horse

Jogo em pixel art de corrida de cavalos **automática** com progressão RPG, elementos
(🔥 Fogo / 💧 Água / 🌿 Grama) e PVP com apostas de moeda virtual. Alvo: web + Google Play.

**Fase atual: protótipo** — validar se corrida automática + estratégia pré-corrida + aposta é divertido.

## Onde estão as coisas

| O quê | Onde |
|---|---|
| Design (fonte da verdade) | `docs/GDD.md` |
| Estado do projeto / próximos passos | `docs/memoria/ESTADO.md` |
| Decisões e motivos | `docs/memoria/decisoes.md` |
| Registro de assets gerados (IA) | `docs/memoria/assets.md` |
| Fases e checklist de lançamento | `docs/checklist-lancamento.md` |
| Regras de trabalho (Claude Code) | `CLAUDE.md` |
| Protótipo jogável (descartável) | `prototype/` |

## Rodar o protótipo

Sem dependências: abra `prototype/dist/preview.html` no navegador.

```bash
node prototype/build.mjs          # regenera prototype/dist/ a partir de prototype/src/
./scripts/check.sh                # verificação completa: build + balanceamento + teste de UI
```

`prototype/dist/` é **gerado e versionado** — nunca editar à mão; sempre regenerar e commitar
junto com as mudanças em `prototype/src/`.
