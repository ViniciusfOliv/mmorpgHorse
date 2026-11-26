# T15 — Montagem da sala num módulo puro (`sala.js`), sem mudar o jogo

> **Status: plano, aguardando aprovação.** Pré-requisito da D9 (salas justas). Nenhuma regra, número ou sorteio muda.

## O que existe hoje

A sala é montada no `game.js` (l.5959–6132), misturada com a tela:

| Função | O que faz | Depende de |
|---|---|---|
| `poderBot` (+ memória) | Poder de um modelo do catálogo como bot no nível L e rank r | `RaceSim` |
| `bestLevelFor` | nível do modelo mais perto do Poder-alvo | `poderBot` |
| `levelBand` | faixa de nível plausível do selvagem (achado −10 / +20) | `GameData` |
| `leagueIndex` | liga do alvo (só consome o sorteio do equipamento, que hoje não vale) | `RaceSim`, `GameData` |
| `buildLobby(P)` | seed da sala, pista e clima, nome da pista, nº de corredores, rivais (alvo 91,5–111,5%, filtro de 6%, sem repetir modelo, sem o modelo do jogador), sedas, raias | tudo acima + `state.seedBase`, `state.mounts`, `PLAYER_*`, `BOT_SILKS`, `SP.SILKS`, `TRACK_NAMES`, `pick`/`shuffle`, DEV (`ui.devNext`, `devHooks`), testadores (`RAPIDO`) |

A ordem das chamadas da RNG da sala é o que garante que a mesma seed dá a mesma sala: nome da pista → nº de corredores
→ nomes → sedas → por rival (alvo, [testadores], equipamento, escolha) → raias. **Essa ordem não pode mudar.**

O ramo da nuvem `claude/fluidez` mexe no `game.js` em outros trechos (l.1370–4100 e 8700+), não nestas linhas: sem
conflito esperado. A medição do `salas-economia` usa uma **cópia** do `buildLobby` (`salas-medida.js`); depois do T15 ela
pode usar o módulo de verdade.

## O que muda

| Arquivo | Mudança |
|---|---|
| `prototype/src/sala.js` (novo, UMD como `ginasio.js`) | `Sala.montar(e)` com os dados de entrada explícitos (`seed`, `pr`, cavalo do jogador, modelos que o jogador tem, nº de sedas, nomes de pista, opções de DEV e testadores) → `{ seed, cond, trackName, n, rivais: [{ nome, horse, silkSlot, rating }], raias }`. Também `poderBot`, `bestLevelFor`, `levelBand` e os `pick`/`shuffle` (cópias idênticas) |
| `prototype/src/game.js` | `buildLobby` vira um invólucro: junta as entradas, chama `Sala.montar` e põe o que é da tela (jogador, sedas reais, `dev.wind`). Some ~120 linhas do `game.js` |
| `prototype/build.mjs` | `src/sala.js` na lista `SCRIPTS`, antes do `game.js` |
| `prototype/tools/sala-test.js` (novo) | testes em Node: determinismo, faixa 91,5–111,5%, nunca o modelo do jogador, sem repetir, ordem da RNG |
| `prototype/tools/sala-referencia.json` (novo) | **referência gravada antes da mudança**: salas de ~200 combinações (contador, Poder, rank, modelos do jogador, treino/valendo, testadores) montadas pelo `buildLobby` atual, no navegador, pelo gancho de teste `window.__galope.buildLobby` |
| `prototype/tools/ui-test.mjs` | um bloco novo: o jogo no navegador monta as mesmas ~200 salas e elas têm de bater, byte a byte, com a referência |
| `scripts/check.sh` | roda o `sala-test.js` na etapa 2 |
| `CLAUDE.md` §1 e §4 | `sala.js` na lista dos módulos que vão para o servidor; o comando do teste |

## Como provar que nada mudou (teste de equivalência)

1. **Antes de tocar no código**, uma ferramenta grava a referência com o jogo atual (`sala-referencia.json`).
2. Depois da mudança: `sala-test.js` monta as mesmas salas **em Node pelo `sala.js`**, e o bloco novo do `ui-test` monta
   **no navegador pelo jogo**; os dois têm de bater com a referência.
3. Mais o `check.sh` completo (os 83 blocos já conferem sala que não se re-sorteia, Poder visto, treino etc.) e o
   `balance.js` completo (as metas P/S medem o pareamento).

## Critérios de aceitação

- As ~200 salas iguais à referência, em Node e no navegador.
- `check.sh` completo OK; `balance.js` completo sem meta nova quebrada.
- `prototype/dist/jogo.html` muda só por incluir o `sala.js` (o comportamento é o mesmo); save sem mudança de formato.
- Nenhum número de regra muda (a faixa 0,915 + 0,2 fica igual; a D9 muda depois, em outro ticket).

## Riscos e reversão

- **Médio:** mexe no coração da sala. Por isso a referência vem primeiro e o ticket só fecha com ela batendo.
- DEV e testadores entram como opções do módulo, para a ordem da RNG continuar idêntica nos três builds.
- Reversão: reverter o commit do ramo `refactor/sala-modulo`; o save não muda, então nada fica para trás.

## Teste manual depois

O jogo publicado deve se comportar igual: abrir a sala, recarregar (mesma sala), largar. Publico o `jogo.html` e o
`jogo-dev.html` (o DEV deixa ver a seed da sala) para você conferir.

## Tamanho

~1 sessão de trabalho; `check.sh` (17 min) e `balance.js` completo (~5 min) no fim.
