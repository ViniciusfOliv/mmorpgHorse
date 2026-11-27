# CLAUDE.md — MMORPG Horse

Regras para o Claude neste repositório. Mantenha enxuto (no máximo 300 linhas): material de consulta vai
para `docs/` e aqui fica só o caminho, entre crases (sem `@`, para não carregar à toa).

## 1. Projeto
- **O que é:** jogo em pixel art de corrida de cavalos automática, com progressão RPG, elementos
  (Fogo/Água/Grama) e foco em PVP com apostas de moeda virtual.
- **Plataformas:** web + Google Play + Steam (Steam decidida em 2026-11-19).
- **Monetização:** duas moedas — 🪙 Ouro (só se ganha jogando; é o que se aposta) e 💎 Gemas
  (compradas; cosméticos, VIP e vagas). Pacote de montaria só com moeda ganha jogando.
- **Tecnologia:** base web (HTML/CSS/JS puro, sem dependências), em `prototype/`. Decidido em
  2026-11-10: o protótipo **vira o jogo**, empacotado para Android, e os módulos de regra (`sim.js`,
  `data.js`, `breed.js`, `gear.js`, `itens.js`, `ginasio.js`, `afk.js`, `forja.js`, `sala.js`, `conta.js`, `save.js`) vão para o servidor. Empacotador e servidor ainda a definir.
- **Fonte da verdade:** `docs/GDD.md`. Números reais do protótipo: `docs/wiki.md` e
  `prototype/dist/wiki.html` (gerados do código pelo build; não editar). Medições de balanceamento:
  `docs/exemplos.md`. Fórmulas da simulação: comentário no topo de `prototype/src/sim.js`.

## 2. Fase atual: **Protótipo**
Foco: descobrir se a corrida automática + estratégia pré-corrida + aposta é divertida.
Nada de servidor, contas ou pagamento real ainda. Cronograma até o Play, fases e checklist de
lançamento: `docs/cronograma.md`.

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
| Gerar o jogo e o wiki (`prototype/dist/`, `docs/wiki.md`) | `node prototype/build.mjs` | 1 s |
| Testes unitários da simulação | `node prototype/tools/sim-test.js` | 3 s |
| Testes do treino AFK e da forja | `node prototype/tools/afk-test.js` | 12 s |
| Testes dos efeitos da corrida (dados, skills, clima, vento, curvas, ambiente) e do desenho do mapa dos ginásios | `node prototype/tools/fx-test.js` / `node prototype/tools/mapa-test.js` | 5 s / <1 s |
| Testes dos moldes de cavalo (PNGs e âncoras gerados) | `node prototype/tools/moldes-test.mjs` | <1 s |
| Sala (pareamento, `sala.js`): testes em Node / as 200 salas do jogo no navegador contra `sala-referencia.json` | `node prototype/tools/sala-test.mjs` / `node prototype/tools/sala-referencia.mjs --check` | 2 s / 5 s |
| Determinismo da corrida (T12): 48 corridas e os 15 desafios de ginásio no Node e no navegador contra `corrida-referencia.json` (sem `--check` regrava; só de propósito, quando o motor ou um número de regra muda) | `node prototype/tools/corrida-referencia.mjs --check` | ~10 s |
| Liquidação do fim da corrida (T14, `conta.js`): 400 liquidações no jogo e no Node contra `conta-referencia.json` (gravada com o jogo de antes; regravar só de propósito) | `node prototype/tools/conta-referencia.mjs --check` | ~15 s |
| Saneamento e migração do save (T16, `save.js`): 1.424 saves (v1 a v10, lixo e campos estragados, jogo normal e DEV) no jogo e no Node contra `save-referencia.json` (gravada com o jogo de antes; regravar só de propósito) | `node prototype/tools/save-referencia.mjs --check` | ~10 s |
| Wiki: regerar (`--check` só confere) / testar (determinismo, cobertura, navegador) | `node prototype/tools/wiki.mjs` / `node prototype/tools/wiki-test.mjs` | <1 s / 2 s |
| Balanceamento rápido (falha se meta quebrar) | `node prototype/tools/balance.js --quick` | ~45 s |
| Balanceamento completo / corrida de exemplo | `node prototype/tools/balance.js [--exemplo]` | ~5 min |
| Fluidez: ms de cada troca de tela, CPU 4× mais lenta (`--teto N`, `--arquivo X.html`) / interface em paralelo (o que o `check.sh` usa; não grava capturas) | `node prototype/tools/fluidez.mjs` / `node prototype/tools/ui-test-paralelo.mjs` | ~1,5 min / ~12 min |
| Teste de interface num processo só + capturas em `prototype/screens/` (`UI_SO=bloco` roda só um; `--blocos` lista) | `node prototype/tools/ui-test.mjs` | ~20 min |
| **Verificação completa** (8 etapas: build, simulação, efeitos, dist, moldes, wiki, balanço, UI; não toca nas capturas) | `./scripts/check.sh` | ~13 min |
| Playwright dos testes, uma vez por máquina (versão fixa só das ferramentas; o jogo não tem dependências) | `npm ci --prefix prototype/tools` | ~5 s |

Mudou número de regra (status, skill, pista, peça, Poder, ginásio)? Rode também o `balance.js` completo: as metas
M6, M9, P1, S1 e A1 só contam nele (no `--quick`, que o `check.sh` usa, são só informação), e as dos ginásios G1, G2,
G3, G5 e G7 só rodam nele.

CI: `.github/workflows/check.yml` roda o `check.sh` e o `balance.js` completo em cada envio para a `main` e em cada PR
(Linux); também falha se `prototype/dist/` ou `docs/wiki.md` não estiverem commitados em dia.

Abrir o jogo localmente: `prototype/dist/preview.html` no navegador. O `prototype/dist/jogo.html` é o
build de produção: sai sem modo DEV e sem gancho de teste (o build falha se sobrar algum).
Modo DEV: `preview.html?dev=1` ou o build de teste `prototype/dist/jogo-dev.html` (liga sozinho, sem query) — save
separado (`galope-elemental:dev`) e gaveta "DEV" para montar cavalo, itens e condições da corrida.
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
- **PixelLab** (moldes de cavalo): API v2 via `prototype/tools/pixellab-moldes.mjs --lote moldes|portes` — dry-run
  por padrão, `--gerar` para gastar, `--teto N` limita as gerações, `--reprocessar` refaz sem rede. Arte da direção de
  arte (ícones, treinadores, regiões, telas, marca): os `prototype/tools/arte-*.mjs` e `icones-final.mjs` (guia em
  `docs/arte/guia.md`, registro em `docs/memoria/assets.md`). **Gasta créditos — sempre pedir confirmação antes.**
- **Canva** (capa, ícone, imagens de loja) e **ElevenLabs** (sons/vozes) — quando conectados;
  também pedem confirmação antes de gastar créditos.
- **Artefato do claude.ai** (onde o Vinicius joga): publicar `prototype/dist/jogo.html`; para o modo DEV, publicar
  `prototype/dist/jogo-dev.html` como outro artefato (o artefato não repassa `?dev=1`).
- Todo asset gerado: salvar com nome descritivo e registrar em `docs/memoria/assets.md`.
  Esse registro alimenta a declaração de IA da Steam (conteúdo que o jogador vê/ouve).

## 8. Regras de design que não podem quebrar
- **O Ouro nunca é vendido**, por dinheiro nem por Gemas. Vantagens pagas (VIP e Gemas) só as listadas na spec da
  loja, cada uma com teto em `data.js` e coberta por teste; item comprado com Gema nunca tem resultado sorteado
  (D1, 2026-11-26). Qualquer troca/mercado novo precisa respeitar isso.
- Corrida **determinística**: mesma seed + configuração ⇒ mesmo resultado (servidor simula,
  cliente só anima). O `balance.js` verifica.
- Resultado nunca é calculado/mostrado antes de a entrada ser paga; sala não pode ser re-sorteada
  de graça; com páreo aberto, peça ou ponto que suba o Poder do cavalo ativo acima do que a sala viu
  não entra (o `ui-test.mjs` verifica). Na preparação (12 s) só troca para cavalo com Poder ≤ o da sala, e a troca
  não muda a sala (o páreo guarda o rank dos bots e os donos); no zero larga sozinha, com o jogo aberto ou não.
- Dado da Sorte e viradas de clima só com a RNG da seed (nada de `Math.random`).
- Potro gerado só pela RNG da seed (`prototype/src/breed.js`); Mítico nunca nasce de cruzamento.
- Melhoria de peça e Pedra Negra do pódio só pela RNG da seed (`prototype/src/gear.js`); Lendário nunca à venda.
- Equipamento só vale no PVE (treino AFK): nunca entra no Poder, na sala nem na corrida do PVP ou dos ginásios.
  Reforja de peça, linhas da peça forjada e Selo do campeão só pela RNG da seed (`gear.js`, `forja.js`, `itens.js`), e
  só depois de confirmar; o Selo só cai no 1º lugar de corrida valendo.
- Cupom de troca de skill e Manual de doma só sorteiam pela RNG da seed, e só depois de confirmar
  (`prototype/src/itens.js`); a loja de itens só aceita Ouro e a Rédea nova nunca é vendida.
- Desafio de ginásio só é sorteado depois de a entrada (Ouro) ser paga, pela RNG da seed, e é gravado inteiro numa
  gravação só (`prototype/src/ginasio.js`); a tela só anima o que foi gravado. Revanche do líder: uma por dia em cada
  ginásio. Ginásios em sequência (Grama → Água → Fogo): cada um abre com a insígnia do
  anterior, regra do módulo (`Ginasio.aberto`); fechado, o desafio é recusado antes de pagar. Bônus de insígnia é da conta e nunca entra no cálculo da corrida (offline ficam como estão; antes do online, passam a valer só no PVE, como o equipamento — D5).
- Todo sorteio novo (troca de skill, genética do potro, circuito) sai da seed.

## 9. Não faça
- Não editar `prototype/dist/` à mão.
- Não adicionar dependências (npm etc.) sem perguntar — o protótipo é propositalmente sem deps.
- Não rodar geração paga (PixelLab, ElevenLabs, Canva) sem confirmação explícita.
- Não reorganizar `prototype/` na estrutura final (`src/ assets/ tests/ scripts/`) sem um plano
  aprovado: a base web foi escolhida, e a reorganização é um subprojeto próprio.
- Não colar tokens/chaves na conversa ou no código; usar variáveis de ambiente.
