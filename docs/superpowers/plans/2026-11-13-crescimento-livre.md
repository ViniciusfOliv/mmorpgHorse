# Bloco 1b (crescimento livre) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar o crescimento automático por pontos comprados com custo por faixa, até 150, com a física, a
skill de tipo, a Sorte, os bots, o Poder e as ligas da spec, o equipamento suspenso, a redistribuição, o
save v6 e as telas novas.

**Architecture:** quatro tarefas de código, cada uma com teste próprio.
- **Regra (T1):** `data.js`, `sim.js` e `balance.js`. Há um código de referência pronto, o diff da calibração,
  aplicado sobre o bloco 1.
- **Save e regras de jogo (T2):** `game.js` cuida do save v6, do equipamento suspenso, da redistribuição e do
  jóquei mantido ao recomeçar.
- **Telas da aba Status e Skills (T3).**
- **Explicações "ⓘ" (T4).**
- **Documentação, capturas e artefato (T5).**

**Tech Stack:** HTML/CSS/JS ES5 puro (UMD, sem dependências) em `prototype/src/`; Node para testes e
ferramentas; Playwright (já instalado) no `ui-test`.

**Spec:** `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md` (aprovada em 2026-11-13 por delegação do
Vinicius). **Código de referência:** `docs/superpowers/specs/anexos/2026-11-12-crescimento-livre-calib.diff`, um diff
completo de `data.js`, `sim.js` e `balance.js` contra o bloco 1, com caminhos relativos a `prototype/`. A saída do
balanço medido está em `anexos/2026-11-12-crescimento-livre-balanco.txt`.

## Global Constraints

- **Git e código:**
  - branch `claude/cavalos-v3`;
  - commits pequenos, no imperativo, em português, com o trailer da sessão;
  - ES5 em `prototype/src/`, sem dependências novas.
- **Corrida determinística:** mesma seed + configuração ⇒ mesmo resultado; nada de `Math.random`;
  `RaceSim.VERSION` sobe. A ordem da RNG da corrida não muda (spec §3: o sorteio da Garra continua uma vez por
  corrida).
- **Arquivos intocados:** `gear.js` e `breed.js` não mudam. O potro ganha `respecFree` no `game.js`.
- **Números:** todos os da regra vêm da spec §2–§7 e são iguais aos do código de referência:
  - `ptsRate0` 2, `ptsRate1` 6, `starMult` [1, 1,09, 1,22], `costStep` 10, `statMax` 150, `noBuy: ['sorte']`;
  - `baseLo` 40 / 44 / 49 / 54 / 60;
  - `ptsMult` 1,00 / 1,05 / 1,10 / 1,15 / 1,20;
  - ligas Bronze 0 · Prata 710 · Ouro 800 · Platina 890 · Diamante 980 · Lenda 1070.
- **Sorte só de nascimento:** não recebe pontos. A chance do 2º dado é (Sorte − 40)/40, presa a 0–1.
- **Equipamento suspenso:**
  - peças, melhoria, equipado e Pedras Negras ficam no save sem mudança; nada é vendido nem convertido;
  - a Pedra Negra do pódio não cai (`podiumStone` não é chamado);
  - `GEAR_ON = false` no `game.js`.
- **Rédea nova:** nunca por Ouro. Neste bloco só a gaveta DEV dá Rédeas.
- **Regras do `CLAUDE.md` §8:**
  - com páreo aberto, ponto que suba o Poder da ativa acima do que a sala viu não entra;
  - sala não pode ser re-sorteada de graça;
  - resultado nunca é calculado antes de pagar a entrada.
- **Save v6:** `SAVE_VERSION` 6, com migração de v5 e anteriores (todos os pontos devolvidos, `respecFree: true`,
  `redeas: 0`) e aviso único (`state.avisoV6`). O modo DEV nunca lê nem grava o save real.
- **Gerados:** `prototype/dist/` e `docs/wiki.md` só saem do build e são commitados junto com o `src/`.
- **Antes de dizer que terminou:** `./scripts/check.sh` termina em `VERIFICAÇÃO COMPLETA: OK`. Mudou número de regra,
  então rode também o `balance.js` completo: 165 metas.

## Review Focus

1. **RF1 — Save v5 com páreo aberto na migração.** A sala continua com os mesmos rivais e o mesmo mapa (não é
   re-sorteada), o retrato `pending.alloc` vai a zero e o Poder da sala segue a R16 (o maior entre o dos retratos e
   o da ativa). Teste na T2.
2. **RF2 — Lixo no save novo.** `respecFree` diferente de booleano, `redeas` negativo, fracionário, texto ou acima de
   999, e um alloc acima do orçamento depois da migração. O jogo abre com o padrão, nunca quebra, e o alloc é cortado
   por `validAlloc`. Teste na T2.
3. **RF3 — "Distribuir sugerido" com páreo aberto.** O rascunho pode passar do Poder da sala, mas o Confirmar fica
   bloqueado com o motivo, como os botões +N. Nada é gravado acima do Poder da sala. Teste na T3.
4. **RF4 — Gravação que falha ao redistribuir ou confirmar.** Nada muda: a Rédea não é gasta e o `respecFree` não
   vira falso. Teste na T2.
5. **RF5 — Jogador antigo com peças equipadas.** A corrida e o Poder ignoram as peças. Depois de gravar o v6, as
   peças, o equipado e as Pedras continuam no save, iguais. A gaveta DEV e o Perfil não quebram com peças no save.
   Teste na T2.

---

### Task 1: Regra nova (dados, simulação, bots, Poder, ligas e balanço)

**Files:**
- Modify:
  - `prototype/src/data.js`, `prototype/src/sim.js`, `prototype/tools/balance.js`: aplicar o código de referência;
    os conflitos com o `data.js` atual (marcas, jóquei e portes da Visuais 2) se resolvem mantendo os dois lados;
  - `prototype/tools/wiki.mjs`: as seções que liam `statCap`, `freeCapShare` e `statLimit` passam ao modelo novo;
  - `prototype/src/game.js` e `prototype/src/dev.js`: só a compatibilidade mínima (trocar `statCap` pelo
    `RaceSim.TUNING.statMax`, nada de tela nova).
- Test: `prototype/tools/sim-test.js`, `prototype/tools/fx-test.js` e `prototype/tools/wiki-test.mjs` (ajustar o que
  fixava o modelo antigo).

**Interfaces:**
- Produces, em `RaceSim` (as do código de referência):
  - `freePoints(horse) -> int`;
  - `pointCost(i) -> int`;
  - `costOf(a) -> int`;
  - `validAlloc(horse, alloc) -> {7 chaves}`, que corta pelo 150, depois pelo custo, na ordem de `STAT_KEYS`, e zera
    a Sorte;
  - `allocInfo(horse) -> { free, used, left, perStat, next, room }`, com `room.sorte = 0`;
  - `weightedAlloc(horse, w, from) -> alloc`;
  - `botAlloc(horse, from?) -> alloc`;
  - `computeStats(horse) -> stats` (1–150) e `powerRating(horse) -> int`, os dois sem parâmetro de gear. Um 2º
    argumento passado por quem chama é ignorado;
  - `TUNING.{ptsRate0, ptsRate1, starMult, costStep, statMax, noBuy}`.
- Produces, em `GameData.RARITIES[id]`: `baseLo` e `ptsMult` (sai `statCap`), as ligas novas e as skills de tipo com
  `statMul`.

- [ ] **Step 1: Aplicar a referência.**
  - Run: `cd prototype && git apply --3way -p0 ../docs/superpowers/specs/anexos/2026-11-12-crescimento-livre-calib.diff`.
    Se a ferramenta não aplicar, use `patch -p0 --merge`.
  - Resolva os conflitos do `data.js` mantendo o que a Visuais 2 acrescentou: `MARCAS`, `JOQUEI`, `PORTES` e os
    campos `marcas`/`porte` do catálogo.
  - Confira contra a spec §2–§7 que nenhum número da referência ficou de fora, e que a spec e a referência dizem a
    mesma coisa.
- [ ] **Step 2: Testes unitários da spec §13** (seção nova `Crescimento livre` do `sim-test.js`), com os valores
  exatos da spec:
  - `freePoints` dá 0 no nível 1 e 2 no nível 2 (5 raridades × 3 estrelas); Comum ★ 50 = 196; Comum ★★ 11/30/50 =
    25/100/213; Mítico ★★★ 50 = 286;
  - `costOf(0/1/10/11/20/30/50)` = 0/1/10/12/30/60/150 e `pointCost(0/9/10/19/20)` = 1/1/2/2/3;
  - `validAlloc`: corte pelo 150 e depois pelo custo, na ordem de `STAT_KEYS`; Sorte zerada; lixo (negativo, fração,
    texto, chave faltando) vira 0;
  - `allocInfo`: comprar `room[k]` cabe e `room[k] + 1` não; `room.sorte` = 0;
  - `weightedAlloc`/`botAlloc`: determinísticos; nunca passam dos pontos nem de 150; nunca põem ponto na Sorte;
    `botAlloc(h, de)` mantém o que está em `de` e só soma;
  - `computeStats` sem gear e em 1–150; `powerRating` igual com e sem peças no cavalo;
  - Dado: chance do 2º dado 0 com Sorte 40, 0,5 com 60 e 1 com 80;
  - skill de tipo: os dois status do tipo valem × (1 + m·P) só no terço dela;
  - física: com todos os status em X ∈ {50, 80, 110, 140}, +10 em VEL, ACE, MAN, FOR, EST e GAR melhora o tempo
    médio (nenhum ganho zero);
  - determinismo: mesma seed dá o mesmo resultado, e `VERSION` mudou.
  
  Ajuste os testes antigos que fixavam o modelo do bloco 1 (`statCap`, `freeCapShare`, limite de 34%, crescimento
  natural): cada um passa a testar a regra nova equivalente, ou sai com o motivo no relatório.
- [ ] **Step 3: Rodar.** Run: `node prototype/tools/sim-test.js && node prototype/tools/fx-test.js`. Expected: 0 falhas.
- [ ] **Step 4: Wiki e compatibilidade.**
  - `wiki.mjs` passa a descrever o modelo novo, sempre gerado do código:
    - pontos por nível (tabela da spec §2);
    - custo por faixa;
    - base por raridade;
    - teto 150;
    - Sorte de nascimento;
    - Dado (Sorte − 40)/40;
    - skill de tipo com `statMul`;
    - ligas novas;
    - nenhuma menção a `statCap` nem ao limite de 34%.
  - No `game.js` e no `dev.js`, só o que for preciso para não quebrar: as telas novas são da T3.
  - Run: `node prototype/build.mjs && node prototype/tools/wiki-test.mjs`. Expected: OK.
- [ ] **Step 5: Balanço.**
  - Run: `node prototype/tools/balance.js` (completo, ~2,5 min). Expected: as 165 metas passam, com os valores da spec
    §13 (compare com o `anexos/…-balanco.txt`).
  - Run: `node prototype/tools/balance.js --quick`. Expected: OK.
- [ ] **Step 6: Commit.**
  - Commite `src`, `tools`, `dist` e `docs/wiki.md`.
  - O `ui-test` pode reprovar nos textos da aba Status até a T3: rode `UI_SO=` com os blocos que não dependem da aba
    Status e anote no relatório os que falham e por quê.

### Task 2: Save v6, equipamento suspenso, redistribuição e jóquei mantido (`game.js`)

**Files:**
- Modify: `prototype/src/game.js` (e `prototype/src/game.css` se precisar).
- Test: `prototype/tools/ui-test.mjs` (bloco novo `crescimento`, `UI_SO=crescimento`).

**Interfaces:**
- Consumes: T1 (`validAlloc`, `allocInfo`, `computeStats`, `powerRating` sem gear).
- Produces:
  - **save:**
    - `SAVE_VERSION = 6`;
    - `state.redeas` (inteiro 0–999, padrão 0);
    - `state.avisoV6` (booleano);
    - `horse.respecFree` (booleano, padrão verdadeiro);
  - **equipamento:**
    - `GEAR_ON = false`;
    - aba Loja e sub-aba Equipamento fora quando `!GEAR_ON`;
    - `podiumStone` não chamado;
    - resumo de peças fora da largada e do estábulo;
  - **redistribuição:**
    - `podeRedistribuir(m) -> { ok, motivo, custo: 'gratis' | 'redea' }`;
    - ação `redistribuir` em dois toques, via `gravaGasto`;
  - **DEV:** campo "Rédeas novas" e caixa "redistribuição grátis" por cavalo.

- [ ] **Step 1: Escrever os testes que falham** (bloco `crescimento`):
  - **migração v5 → v6:**
    - pontos devolvidos e `respecFree` verdadeiro;
    - `redeas` 0;
    - peças, equipado e Pedras iguais no save gravado (RF5);
    - aviso "As regras de crescimento mudaram: os pontos dos seus cavalos voltaram para distribuir." uma vez só (não
      volta ao recarregar);
  - **migração com páreo aberto (RF1):** mesmos rivais e mesmo mapa; `pending.alloc` zerado; Poder da sala pela R16;
  - **lixo (RF2):** `respecFree: 'sim'`, `redeas: -3 / 2.5 / 'x' / 5000` e alloc acima do orçamento ⇒ padrões e corte
    por `validAlloc`, sem erro de console;
  - **sem equipamento:**
    - sem aba Loja e sem sub-aba Equipamento;
    - o resultado do pódio não dá Pedra Negra, e o saldo de Pedras some do cabeçalho e do Perfil;
    - a largada não mostra o resumo de peças;
    - um cavalo com peças equipadas corre com o mesmo Poder que sem elas (RF5);
  - **Redistribuir:**
    - a primeira é grátis;
    - a segunda, sem Rédea, fica desabilitada com o motivo;
    - com Rédea (DEV), gasta 1;
    - dois toques;
    - com páreo aberto, a ativa fica desabilitada e as outras não;
  - **falha de gravação (RF4):** com o `localStorage` cheio, simulado como os testes de gravação que já existem,
    Redistribuir não muda nada (Rédea e `respecFree` intactos);
  - **potro:** nasce com `respecFree: true` e nenhum ponto;
  - **jóquei:** "Recomeçar com outro inicial" mantém o padrão e o capacete do jóquei no save novo (decisão de
    2026-11-13);
  - **DEV:** o campo de Rédeas e a caixa de redistribuição grátis funcionam e nunca tocam no `galope-elemental:v1`.
- [ ] **Step 2: Rodar e ver falhar.** Run: `node prototype/build.mjs && UI_SO=crescimento node prototype/tools/ui-test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementar** com as interfaces acima e a spec §8, §9 e §10.
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando. Expected: OK. Depois rode `node prototype/tools/sim-test.js` e
  `node prototype/tools/fx-test.js`.
- [ ] **Step 5: Commit** (`src`, `tools`, `dist`).

### Task 3: Abas Status e Skills

**Files:**
- Modify: `prototype/src/game.js`, `prototype/src/game.css`
- Test: `prototype/tools/ui-test.mjs` (blocos de pontos existentes ajustados, bloco `crescimento` estendido)

**Interfaces:**
- Consumes: T1 (`allocInfo().next/room`, `costOf`, `botAlloc(h, de)`, `TUNING.statMax`) e T2 (`podeRedistribuir`).
- Produces: as telas da spec §11 (aba Status e aba Skills) e o selo "+N" do Estábulo pelo `room` novo.

- [ ] **Step 1: Escrever os testes que falham.**
  - **Aba Status:**
    - cada linha mostra "próximo ponto custa C";
    - +1, +5 e +10 somam exatamente N ao rascunho; o `aria-label` e o `title` trazem o custo ("+5 em Velocidade:
      custa 15 pontos");
    - cada botão fica desabilitado quando N não cabe (pontos, 150 ou trava do páreo), com o motivo no `title`;
    - a Sorte mostra "de nascimento" e não tem botões;
    - o topo mostra "Pontos: sobram X de Y" e, com rascunho, "Poder A → B";
  - **"Distribuir sugerido":** preenche o rascunho com `botAlloc(cavalo, pontos + rascunho)` e não grava sem
    Confirmar. Com páreo aberto (RF3), se o rascunho passa do Poder da sala, o Confirmar fica desabilitado com o
    motivo e nada é gravado;
  - **Confirmar e Desfazer:**
    - Confirmar em dois toques grava; Desfazer limpa;
    - o aviso do Confirmar diz "Para mudar depois, use Redistribuir (a primeira deste cavalo é grátis)." ou "(gasta
      uma Rédea nova)";
  - **rodapé:** "A barra vai até 150. O custo do ponto sobe a cada 10 pontos no mesmo status.";
  - **aba Skills:** a skill de tipo mostra o efeito em pontos para o cavalo ("Velocidade e Aceleração +N no 1º
    terço"), calculado dos status atuais;
  - **Estábulo:** o selo "+N" mostra os pontos que ainda dá para comprar.
- [ ] **Step 2: Rodar e ver falhar.** Run: `node prototype/build.mjs && UI_SO=crescimento node prototype/tools/ui-test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Use os textos exatos da spec §11.
- [ ] **Step 4: Rodar a interface inteira.** Run: `node prototype/build.mjs && SHOTS_DIR=<scratchpad> node prototype/tools/ui-test.mjs`.
  Expected: OK. Os blocos antigos que testavam o limite de 34% ou o teto por raridade passam a testar a regra nova
  equivalente; diga cada troca no relatório.
- [ ] **Step 5: Commit** (`src`, `tools`, `dist`).

### Task 4: Explicações curtas ("ⓘ")

**Files:**
- Modify: `prototype/src/data.js` (`GameData.HELP`), `prototype/src/game.js`, `prototype/src/game.css`,
  `prototype/tools/wiki.mjs`
- Test: `prototype/tools/ui-test.mjs` (bloco `ajuda`) e `prototype/tools/wiki-test.mjs`

**Interfaces:**
- Produces:
  - `GameData.HELP = { <chave>: '<frase>' }`, com as chaves `vel`, `acel`, `man`, `forca`, `est`, `garra`, `sorte`,
    `genetica`, `estrelas`, `raridade`, `skillTipo`, `poder`, `liga`, `clima`, `piso`, `dado`, `custo` e `redea`;
  - os 7 textos de status são os da spec §11, copiados como estão;
  - os outros têm uma frase de até ~140 caracteres, sem número que não venha do código.

- [ ] **Step 1: Escrever os testes que falham.**
  - **Botão "ⓘ":** aparece ao lado do rótulo dos 7 status e dos outros itens nas telas onde eles aparecem;
  - **no computador:** o `title` traz o texto;
  - **no toque:** abrir mostra o texto embaixo, com `aria-expanded="true"` e um elemento `role="note"`; fechar
    esconde;
  - **validação de `GameData.HELP`:** nenhum texto passa de 160 caracteres, e todas as chaves usadas existem;
  - **wiki:** usa os mesmos textos (o `wiki-test` confere os 7 status).
- [ ] **Step 2: Rodar, ver falhar, implementar e rodar.**
  - Run: `node prototype/build.mjs && UI_SO=ajuda node prototype/tools/ui-test.mjs && node prototype/tools/wiki-test.mjs`.
  - Expected: OK.
- [ ] **Step 3: Commit.**

### Task 5: Documentação, capturas, verificação e artefato

**Files:**
- Modify:
  - `docs/GDD.md` (§3, §4, §6, §7 e §8.5 com a regra nova);
  - `docs/exemplos.md` (medições da spec §13);
  - `docs/memoria/ESTADO.md` (o 1b pronto; o próximo é o Vinicius jogar e a integração na `main`);
  - `docs/memoria/decisoes.md` (decisões da execução);
  - `prototype/screens/*`.

- [ ] **Step 1: GDD, exemplos e memória.** O texto vem da spec. As pendências da spec §15 vão para o `ESTADO.md`.
- [ ] **Step 2: Capturas oficiais.**
  - Run: `node prototype/tools/ui-test.mjs` (sem `SHOTS_DIR`).
  - Olhe as capturas da aba Status, do Estábulo, da corrida e do pódio.
- [ ] **Step 3: Verificação.**
  - Run: `./scripts/check.sh` e `node prototype/tools/balance.js`.
  - Expected: `VERIFICAÇÃO COMPLETA: OK` e as 165 metas.
- [ ] **Step 4: Commit e push** (`git push -u origin claude/cavalos-v3`).
- [ ] **Step 5: Artefato de teste** (feito pelo controlador). Republicar o "Galope Ícones DEV" com o `jogo-dev.html` novo,
  com o título trocado na cópia do scratchpad.
