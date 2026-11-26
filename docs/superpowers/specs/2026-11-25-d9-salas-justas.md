# D9 — Salas justas e estreia mais leve (spec curta)

> **Status: aguardando aprovação.** Decisão D9 aprovada em 2026-11-25 (`docs/auditoria/decisoes-produto.md`). A medição e
> as opções completas estão na spec da nuvem `2026-11-25-salas-economia-design.md` (ramo `claude/salas-economia`), que
> esta implementa. O T15 (`sala.js`) já está na `main`.

## 1. Regra nova

A faixa de Poder dos rivais passa a depender do **número da sala** (`P.counter`, que já existe no save):

| Salas | Corredores | Alvo do rival (do Poder do jogador) | Teto do rival |
|---|---|---|---|
| 1–10 (estreia) | 4–5 | 93% a 100,5% | alvo + 0,5% |
| 11–20 (rampa) | sobe em linha reta até 4–8 | sobe em linha reta até a normal | sobe até sumir |
| 21 em diante (normal) | 4–8 | **93,5% a 104,5%** (hoje 91,5% a 111,5%) | — |

- **Teto:** na estreia não existe rival mais fraco que o inicial nível 1 no catálogo; o rival que passar de alvo × 1,005
  corre com menos pontos livres e, se precisar, genética menor (a mesma técnica que o build dos testadores já usa). É
  exatamente o que a medição da nuvem simulou (`salas-medida.js`, esquema D).
- **Não muda:** prêmio, entrada, taxa da casa de 10%, nº de sorteios da RNG da sala (só os valores mudam), formato do
  save, build dos testadores (continua com a faixa própria), regra "sala não se re-sorteia".
- Treino gratuito usa a mesma faixa (é a mesma sala).
- Saves que já passaram da 20ª sala (o seu, inclusive) vão direto para a faixa normal. Para sentir a estreia: "Recomeçar"
  ou o modo DEV.

## 2. Resultado esperado (medido na spec da nuvem, pareamento real)

| | Hoje | Depois |
|---|---|---|
| Inicial vence, salas 1–10 | 6% | **~39%** (pódio ~83%) |
| Salas 11–20 | 7% | ~23% |
| Depois da 20ª | 8–10% | ~17–22% (o justo é ~17%) |
| Ouro no fim da 1ª hora | 88 | ~760 |
| Salas sem entrada (treino) depois da 20ª | ~50% | 1–7% |

## 3. O que muda no código

| Arquivo | Mudança |
|---|---|
| `prototype/src/data.js` | `ECONOMY.sala = { estreia: { ate: 10, nMin: 4, nMax: 5, lo: 0.93, hi: 1.005, teto: 1.005 }, rampaAte: 20, normal: { nMin: 4, nMax: 8, lo: 0.935, hi: 1.045 } }` |
| `prototype/src/sala.js` | `faixaDaSala(contador)` (pura) e `montar` usando a faixa: nº de corredores, alvo e teto. Mesma ordem da RNG |
| `prototype/src/game.js` | `buildLobby` passa `P.counter` para o `Sala.montar` (1 linha) |
| `prototype/tools/balance.js` | o `tLobby` lê a faixa normal do `ECONOMY.sala`; modo novo `--economia`: a carreira do inicial com o pareamento real (`Sala.montar`), trazida do `salas-medida.js` da nuvem |
| metas novas no `balance.js` | **ES1** estreia: inicial vence 32–46% e pódio ≥ 75% nas salas 1–10 · **ES2** normal: inicial vence 14–22% nas salas 41–60 · **ES3** Ouro: carreira média nunca fica sem entrada antes da 30ª sala. A P2 (favorito do Poder vence, 35–55%) é remedida; se sair, rebaseio e digo por quê |
| `prototype/tools/sala-referencia.json` | **regravada de propósito** com o jogo novo (a sala muda); o `sala-test` continua provando jogo = módulo |
| `prototype/tools/sala-test.mjs` | testes da faixa por contador (estreia, rampa, normal, teto) |
| `docs/GDD.md`, wiki (gerado), `docs/exemplos.md`, memória | texto da regra e as medições |

## 4. Aceite

- ES1, ES2, ES3 verdes no `balance.js` completo; nenhuma meta antiga quebrada sem motivo escrito.
- `check.sh` completo OK (com a referência regravada) e o `sala-test` com os casos novos.
- Recarregar a página não muda a sala aberta (o `ui-test` já confere).
- Teste manual: "Recomeçar" no DEV e jogar as primeiras salas.

## 5. Fora deste passo

- As **2 vagas iniciais** do estábulo (D1) mexem no estábulo, não na sala: ticket próprio.
- Teto do catálogo (Mítico nv 50 vence 40–51%) e o erro do Poder por cavalo: decisões futuras.
- O ramo da nuvem `claude/salas-economia` fica como referência; nada dele é integrado por merge.
