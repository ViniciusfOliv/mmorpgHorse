# CLAUDE.md — MMORPG Horse

Regras para o Claude neste repositório. Mantenha enxuto (< 120 linhas): material de consulta vai
para `docs/` e aqui fica só o caminho, entre crases (sem `@`, para não carregar à toa).

## 1. Projeto
- **O que é:** jogo em pixel art de corrida de cavalos automática, com progressão RPG, elementos
  (Fogo/Água/Grama) e foco em PVP com apostas de moeda virtual.
- **Plataformas:** web + Google Play.
- **Monetização:** duas moedas — 🪙 Ouro (só se ganha jogando; é o que se aposta) e 💎 Gemas
  (compradas; cosméticos, passe, ovos).
- **Tecnologia:** stack final **a definir** (seção pendente do GDD). O protótipo atual é HTML/CSS/JS
  puro, sem dependências, em `prototype/` — descartável, não é a base final.
- **Fonte da verdade:** `docs/GDD.md`. Números reais do protótipo: `docs/exemplos.md`.
  Fórmulas da simulação: comentário no topo de `prototype/src/sim.js`.

## 2. Fase atual: **Protótipo**
Foco: descobrir se a corrida automática + estratégia pré-corrida + aposta é divertida.
Nada de polimento, servidor, contas ou loja ainda. Fases e checklist de lançamento:
`docs/checklist-lancamento.md`.

## 3. Como trabalhar
- Responda em **português**.
- **Tarefa grande** (mexe em mais de ~3 arquivos, muda regra de design ou gasta créditos):
  proponha um plano e espere aprovação. Tarefa pequena e clara: faça direto.
- Mudanças pequenas e incrementais; uma coisa de cada vez.
- Se algo for ambíguo **e** mudar o resultado, pergunte. Se houver padrão razoável, use-o e avise.
- Antes de dizer que terminou, rode `./scripts/check.sh` e mostre o resultado.
- Não apague nem reescreva arquivos grandes escritos à mão sem avisar.
  (Exceção: `prototype/dist/` é gerado pelo build — sempre regenerar, nunca editar.)
- Ao final de cada tarefa, atualize a memória (seção 6).

## 4. Comandos
| Para quê | Comando | Tempo |
|---|---|---|
| Gerar o jogo (`prototype/dist/`) | `node prototype/build.mjs` | 1 s |
| Testes unitários da simulação | `node prototype/tools/sim-test.js` | 5 s |
| Balanceamento rápido (falha se meta quebrar) | `node prototype/tools/balance.js --quick` | ~25 s |
| Balanceamento completo / corrida de exemplo | `node prototype/tools/balance.js [--exemplo]` | ~1,5 min |
| Teste de interface (Playwright) + capturas em `prototype/screens/` | `node prototype/tools/ui-test.mjs` | ~1,5 min |
| **Verificação completa** (build + balanço + UI, sem tocar nas capturas) | `./scripts/check.sh` | ~2 min |

Abrir o jogo localmente: `prototype/dist/preview.html` no navegador.
Capturas oficiais em `prototype/screens/` só são atualizadas quando a interface muda de propósito
(rodar `ui-test.mjs` direto e commitar as imagens).

## 5. Git
- `main` sempre funcionando. Trabalho local: um branch por tarefa (`feat/...`, `fix/...`).
  Em sessão na nuvem: usar o branch atribuído pela sessão.
- Commits pequenos, mensagem no imperativo, em português ("adiciona inventário").
- `prototype/dist/` **é versionado** (abre o jogo sem build): sempre regenerar e commitar junto
  com as mudanças em `prototype/src/`.
- Nunca commitar segredos (`.env`, chaves, keystores). Ver `.gitignore`.
- Versões `MAIOR.MENOR.CORREÇÃO` + tag `vX.Y.Z` — a partir do MVP.

## 6. Memória do projeto
As sessões na nuvem rodam em contêiner descartável: **só sobrevive o que for commitado.**
Leia no início de cada sessão e atualize ao final:
- `docs/memoria/ESTADO.md` — em andamento, o que falta, próximos passos
- `docs/memoria/decisoes.md` — decisões (data · decisão · motivo)
- `docs/memoria/assets.md` — assets gerados: ferramenta, prompt/parâmetros, custo, uso
- Crie `docs/memoria/sistemas/<sistema>.md` e `docs/memoria/bugs.md` quando houver conteúdo.

## 7. Ferramentas
Guia completo (subagentes, MCP, permissões, tokens): `docs/guia-ferramentas.md`.
- **PixelLab** (sprites/animações): API v2 via `prototype/tools/pixellab-generate.mjs`.
  **Gasta créditos — sempre pedir confirmação antes.**
- **Canva** (capa, ícone, imagens de loja) e **ElevenLabs** (sons/vozes) — quando conectados;
  também pedem confirmação antes de gastar créditos.
- Todo asset gerado: salvar com nome descritivo e registrar em `docs/memoria/assets.md`.
  Esse registro alimenta a declaração de IA da Steam (conteúdo que o jogador vê/ouve).

## 8. Regras de design que não podem quebrar
- **Gemas nunca viram Ouro**, direta ou indiretamente (protege contra classificação como jogo de
  azar). Qualquer troca/mercado novo precisa respeitar isso.
- Corrida **determinística**: mesma seed + configuração ⇒ mesmo resultado (servidor simula,
  cliente só anima). O `balance.js` verifica.
- Resultado nunca é calculado/mostrado antes de a entrada ser paga; sala não pode ser re-sorteada
  de graça (o `ui-test.mjs` verifica).

## 9. Não faça
- Não editar `prototype/dist/` à mão.
- Não adicionar dependências (npm etc.) sem perguntar — o protótipo é propositalmente sem deps.
- Não rodar geração paga (PixelLab, ElevenLabs, Canva) sem confirmação explícita.
- Não reorganizar `prototype/` na estrutura final (`src/ assets/ tests/ scripts/`) antes de a
  stack ser escolhida.
- Não colar tokens/chaves na conversa ou no código; usar variáveis de ambiente.
