# Cavalos v3, bloco 1 (status, tipo e pista) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o modelo de status do jogo pelo modelo v3 (genética visível, pontos livres, estrelas), dar a cada tipo uma skill sempre ativa num terço da pista, equilibrar os iniciais como Comuns e tirar os extremos do sorteio de pista.

**Architecture:** O núcleo de regras (`data.js`, `sim.js`, `breed.js`, `gear.js`) muda primeiro e é provado por testes unitários e pelas metas do `balance.js`; só depois o jogo (`game.js`) migra o save e ganha as telas; por último vêm a animação na corrida, o wiki e os documentos. Os números já foram calibrados por simulação e estão na spec; o diff da calibração serve de referência de implementação.

**Tech Stack:** JavaScript ES5 em módulos UMD (`prototype/src/*.js`), sem dependências; ferramentas em Node (`prototype/tools/`); Playwright para a interface.

**Spec:** `docs/superpowers/specs/2026-11-10-cavalos-v3-status-e-tipo-design.md`. Referência de implementação (fora do repositório, pode não existir mais): `/tmp/claude-0/-home-user-mmorpgHorse/e2044d4a-eb72-5932-b67c-8a4ae9d3d691/scratchpad/cavalos-v3/calib/calib.diff` e `proposta.md` na mesma pasta.

## Global Constraints

- Código de `prototype/src/` em ES5 (`var`, `function`, sem arrow, sem `let`/`const`, sem template string), no padrão UMD dos arquivos atuais. Nenhuma dependência nova.
- Nada de `Math.random` nem `Date` em regra de jogo. Todo sorteio sai da RNG da seed. A skill de tipo é montada **sem consumir a RNG**.
- Regras que não podem quebrar (`CLAUDE.md` §8): corrida determinística; resultado só depois de a entrada ser paga; sala nunca re-sorteada de graça; potro só pela seed e Mítico nunca de cruzamento; melhoria e Pedra Negra só pela seed; Lendário nunca à venda.
- `prototype/dist/` e `docs/wiki.md` são gerados por `node prototype/build.mjs`: nunca editar à mão, sempre regenerar e commitar junto. O gerador do wiki quebra o build quando lê um dado que mudou de forma: **cada tarefa que muda um dado ajusta o `prototype/tools/wiki.mjs` o suficiente para o build e o `wiki-test.mjs` passarem**; a redação final do wiki é da Tarefa 8.
- Nomes fixos no código: a genética fica no campo `potential` (0 a 31 por status); os pontos distribuídos ficam em `alloc` (objeto com as 7 chaves de `STAT_KEYS`, inteiros ≥ 0); as estrelas ficam em `grau` (1 a 3). O campo `base` das montarias deixa de existir.
- As oito skills gerais passam de `element: 'neutro'` para `element: 'geral'`. O elemento `neutro` sai de `GameData.ELEMENTS`.
- Constantes da spec, copiadas: faixas de nascimento começam em 40/45/50/55/60; tetos 80/85/90/95/100; crescimento por nível `0,30 + 0,08·g/31`; multiplicador das estrelas 1 / 1,2 / 1,5; limite por status `ceil(0,34 × pontos livres)`; `vBase` 17,805 e `vRange` 1,2; força da skill de tipo `P = 1 + 0,4·(nível−1)/49 + 0,4·ordem/4`; distância 1.400 a 2.000 m em passos de 50; equipamento `main` 2/2/3/4, `sub` 0/1/2/3, `plusStep` 0,5.
- Decisão do plano onde a spec se contradiz (§2 × §7): **os bots do jogo usam a genética do catálogo**; genética sorteada é só nos cavalos sintéticos das medições do `balance.js`.
- Commits pequenos, em português, no imperativo, com dist regenerado. Sem `git push` (a conversa principal envia). Não mexer em `CLAUDE.md`, `.claude/` nem em `docs/` fora do que a tarefa lista.
- Entre as Tarefas 1 e 4 o jogo no navegador fica quebrado (o `game.js` ainda usa o modelo antigo): nelas a verificação é `sim-test.js`, `fx-test.js`, `wiki-test.mjs` e o build. O `./scripts/check.sh` inteiro volta a passar na Tarefa 5 e é obrigatório dela em diante.

## Review Focus

1. **`alloc` inválido** (ausente, negativo, fracionário, texto, acima do limite por status, soma maior que os pontos livres): `computeStats` nunca passa do teto nem aceita ponto a mais, e nada quebra. Teste na Tarefa 1.
2. **Nível 1** (zero pontos livres, limite por status zero): a tela não oferece "+" e `computeStats` ignora o `alloc`. Testes nas Tarefas 1 e 6.
3. **Sala aberta atravessando a migração v4 → v5**, inclusive com distância antiga (1.000 ou 2.400 m): mesma seed, mesmos rivais e mesma distância; `validDistance` continua aceitando de 1.000 a 2.400 para condições explícitas. Testes nas Tarefas 2 e 5.
4. **Elemento desconhecido ou `neutro`** chegando à simulação (save adulterado, modelo do modo DEV): corre sem skill de tipo, sem erro; o save converte o cavalo. Testes nas Tarefas 2 e 5.
5. **Peça com melhoria ímpar** (`plusStep` 0,5 dá meio ponto): o valor mostrado na tela é o mesmo que a simulação usa, porque os dois saem de `computeStats`. Teste na Tarefa 1.

---

### Task 1: Modelo de status no núcleo

**Files:**
- Modify: `prototype/src/data.js` (RARITIES, STARTERS, WILD_HORSES, `ECONOMY.gear`), `prototype/src/sim.js` (constantes `T`, status, cabeçalho), `prototype/src/gear.js` (`resolve`), `prototype/tools/wiki.mjs` (só o necessário)
- Test: `prototype/tools/sim-test.js`

**Interfaces:**
- Produces: `GameData.RARITIES[r] = { statCap, baseLo, skillSlots, bornSkills, skillChance, order, ... }` sem `growth`; montarias do catálogo sem `base` e com `potential`; `GameData.ECONOMY.gear.plusStep = 0.5`.
- Produces em `RaceSim`: `starsOf(horse) → 1|2|3` (inválido vale 2); `freePoints(horse) → inteiro`; `statLimit(horse) → inteiro`; `naturalStat(horse, k) → número`; `validAlloc(horse, alloc) → alloc saneado` (as 7 chaves, inteiros ≥ 0, cortados pelo limite por status e depois pelo total, na ordem de `STAT_KEYS`; ponto que passa do teto fica guardado e não rende, quem corta é o `computeStats`); `allocInfo(horse) → { free, used, left, perStat, room: {k: quantos pontos o status k ainda aceita agora = mínimo entre perStat − alloc[k], left e o que falta até o teto, arredondado para cima} }`; `computeStats(horse, gear)` no modelo novo.

- [ ] **Step 1: Testes que falham**, em `sim-test.js`:

```js
test('v3: status nasce da genética na faixa da raridade', function () {
  var h = { rarity: 'comum', level: 1, grau: 2, potential: { vel: 24, acel: 24, man: 14, forca: 12, est: 12, garra: 14, sorte: 12 } };
  assert.deepStrictEqual(S.computeStats(h, null), { vel: 52, acel: 52, man: 47, forca: 46, est: 46, garra: 47, sorte: 46 });
});
test('v3: pontos livres e limite por status seguem as estrelas', function () {
  [[1, 49, 17], [2, 58, 20], [3, 73, 25]].forEach(function (c) {
    var h = { rarity: 'comum', level: 50, grau: c[0], potential: {} };
    assert.strictEqual(S.freePoints(h), c[1]); assert.strictEqual(S.statLimit(h), c[2]);
  });
  assert.strictEqual(S.freePoints({ rarity: 'comum', level: 1, grau: 3, potential: {} }), 0);
});
test('v3: Brasa nível 50 chega ao teto com 10 pontos em Velocidade', function () {
  var h = clone(G.STARTERS[0]); h.level = 50; h.alloc = { vel: 10 };
  assert.strictEqual(S.computeStats(h, null).vel, 80);
  h.alloc = { vel: 0 }; assert.strictEqual(S.computeStats(h, null).vel, 70);
});
test('v3: alloc inválido nunca passa do teto nem do limite', function () {
  var h = clone(G.STARTERS[0]); h.level = 50;
  [{ vel: 999 }, { vel: -5 }, { vel: 'x' }, { vel: 2.7 }, null, { vel: 20, acel: 20, man: 20, forca: 20 }].forEach(function (a) {
    h.alloc = a; var s = S.computeStats(h, null), v = S.validAlloc(h, a), soma = 0;
    G.STAT_KEYS.forEach(function (k) { assert.ok(s[k] <= 80); assert.ok(v[k] >= 0 && v[k] <= 20 && v[k] === Math.floor(v[k])); soma += v[k]; });
    assert.ok(soma <= 58);
  });
});
test('v3: iniciais são Comuns ★★ com a mesma soma de genética e de status', function () {
  G.STARTERS.forEach(function (h) {
    var g = 0, s = 0, st = S.computeStats(h, null);
    G.STAT_KEYS.forEach(function (k) { g += h.potential[k]; s += st[k]; });
    assert.strictEqual(h.rarity, 'comum'); assert.strictEqual(h.grau, 2); assert.strictEqual(g, 112); assert.strictEqual(s, 336);
    assert.strictEqual(h.base, undefined);
  });
});
test('v3: melhoria de peça vale meio ponto por nível', function () {
  // uma peça Rara +3 soma 3 + 3 × 0,5 = 4,5 ao status principal em Gear.resolve(...).mods;
  // computeStats com esses mods arredonda uma vez só, no fim (o valor da tela é o da simulação)
});
```

- [ ] **Step 2: Rodar** `node prototype/tools/sim-test.js` e ver os testes novos falharem.
- [ ] **Step 3: Implementar.** Em `T`: `gBand: 16, gGrowBase: 0.30, gGrowRange: 0.08, starMult: [1, 1.2, 1.5], freeCapShare: 0.34, vBase: 17.805, vRange: 1.2`; saem `growthBase`, `growthPot`, `potFlat`. Em `data.js`: tabela de raridade da spec §2; iniciais da spec §4 (Comum, `grau: 2`, sem `base`, `skills: []`); catálogo sem `base` (a genética de hoje fica); equipamento da spec §6. `computeStats`: `status = round(min(naturalStat + alloc saneado, statCap) + mods)`, preso a 1–120. `Gear.resolve`: `main + plus × plusStep`. O `tuningHash` passa a cobrir `baseLo` no lugar de `growth`. Atualizar o cabeçalho do `sim.js` (fórmulas) e, no `wiki.mjs`, as linhas que leem `growth`, `potFlat`, `growthBase`, `growthPot` e `h.base`.
- [ ] **Step 4: Atualizar os testes antigos** que fixavam o modelo antigo (status por nível, teto, hashes de referência das 20 corridas, peças) e rodar `node prototype/tools/sim-test.js`, `node prototype/build.mjs` e `node prototype/tools/wiki-test.mjs`: todos passam. O `balance.js` fica quebrado até a Tarefa 4.
- [ ] **Step 5: Commit** ("troca o modelo de status pelo v3: genética, pontos livres e estrelas").

### Task 2: Tipos, skill de tipo e pista

**Files:**
- Modify: `prototype/src/data.js` (ELEMENTS, TYPE_SKILLS, SKILLS, catálogo), `prototype/src/sim.js` (`buildRacer`, laço de efeitos, `randomConditions`, `learnSkill`), `prototype/src/breed.js` (filtro de skill e de elemento), `prototype/src/fx.js` (só o que quebrar em `skillIcon`/cores), `prototype/tools/wiki.mjs` (só o necessário)
- Test: `prototype/tools/sim-test.js`, `prototype/tools/fx-test.js`

**Interfaces:**
- Consumes: `RaceSim.computeStats`, `T` da Tarefa 1.
- Produces: `GameData.ELEMENTS` só com `fogo`, `agua`, `grama`, sem `statBonus`; `GameData.TYPE_SKILLS[elemento] = { id, name, short, zone: [início, fim], effect, desc }` com `labareda` (`zone [0, 1/3]`, `{ accelMult: 0.23 }`), `raizes-firmes` (`[1/3, 2/3]`, `{ forcaAdd: 0.07, manAdd: 0.07, drainCut: 0.012 }`) e `mare-alta` (`[2/3, 1]`, `{ speedMult: 0.018, staminaRestore: 0.012 }`); skills gerais com `element: 'geral'`; sem `labareda`, `mare-alta`, `raizes-firmes` em `GameData.SKILLS` e sem o campo `exclusive`.
- Produces em `RaceSim`: `typePower(horse) → número`; `typeSkill(horse) → { id, name, power, zone } | null`; no resultado de `simulate`, `racerInfo[i].typeSkill = { id, name, from, to } | null` (metros); o evento de entrada no terço é `{ t, racer, type: 'skill', text, typeSkill: true }`; a entrada de corredor aceita `noTypeSkill: true` (uso do `balance.js`). `T.typeBase 1, typeLevel 0.4, typeRar 0.4, distMin 1400, distMax 2000, distStep 50, trackMaxShare 0.5, trackTries 60`.

- [ ] **Step 1: Testes que falham**:

```js
test('v3: força da skill de tipo', function () {
  assert.strictEqual(S.typePower({ rarity: 'comum', level: 1 }), 1);
  assert.ok(Math.abs(S.typePower({ rarity: 'raro', level: 30 }) - 1.4367) < 1e-3);
  assert.ok(Math.abs(S.typePower({ rarity: 'lendario', level: 50 }) - 1.7) < 1e-9);
});
test('v3: skill de tipo sempre ativa no terço, sem consumir RNG', function () {
  // mesma corrida com e sem noTypeSkill nos três: os eventos de skill por sorteio e do Dado são os mesmos
  // (mesmos tempos de rolagem do Dado e mesmos números); com a skill, cada corredor tem 1 evento typeSkill
  // e racerInfo[i].typeSkill.from/to = zone × distância
});
test('v3: elemento desconhecido corre sem skill de tipo', function () { /* element 'neutro' e undefined: sem erro, typeSkill null */ });
test('v3: pista sem extremos', function () {
  for (var k = 0; k < 3000; k++) {
    var c = S.randomConditions(S.hash2(31, k)), tot = { reta: 0, curva: 0, subida: 0 };
    assert.ok(c.distance >= 1400 && c.distance <= 2000 && c.distance % 50 === 0);
    c.blocks.forEach(function (b) { tot[b.type] += b.to - b.from; });
    assert.ok(tot.curva > 0 && tot.subida > 0);
    ['reta', 'curva', 'subida'].forEach(function (t) { assert.ok(tot[t] <= c.distance / 2); });
    assert.strictEqual(c.blocks[0].type, 'reta'); assert.strictEqual(c.blocks[c.blocks.length - 1].type, 'reta');
  }
});
test('v3: distância explícita antiga continua aceita', function () { /* conditions.distance 1000 e 2400 são respeitadas; 900 e 2500 caem na da seed */ });
test('v3: nenhuma skill é exclusiva e as gerais servem a qualquer tipo', function () { /* SKILLS sem exclusive; learnSkill dá skill geral ou do tipo */ });
```

- [ ] **Step 2: Rodar** e ver falhar.
- [ ] **Step 3: Implementar.** Efeito da skill de tipo em `buildRacer`, como no diff da calibração: um item em `r.effects` com `fromPos`, `untilPos`, `speedMult`, `accelMult`, `drainMult = max(0.05, 1 − drainCut·P)`, `forcaAdd`, `manAdd`; a recuperação da Maré Alta acontece uma vez, na entrada do terço, se o cavalo não estiver exausto. O laço de efeitos passa a respeitar `fromPos` e a somar `forcaAdd`/`manAdd` a `nf`/`nm` (presos a 1,2). `randomConditions`: regra da spec §5, com o molde fixo depois de 60 tentativas. `validDistance` aceita de 1.000 a 2.400. Catálogo: Ventania vira `grama`; Pangaré sai. Renomear `neutro` → `geral` nas skills e em `learnSkill` / `breed.js`. Em `fx.js`, tirar as três skills e o `neutro` do que quebrar.
- [ ] **Step 4: Rodar** `sim-test.js`, `fx-test.js`, o build e `wiki-test.mjs`: passam. Regravar os hashes de referência.
- [ ] **Step 5: Commit** ("dá a cada tipo uma skill sempre ativa num terço da pista e tira os extremos do sorteio").

### Task 3: Cruzamento, Poder, bots e ligas

**Files:**
- Modify: `prototype/src/breed.js`, `prototype/src/sim.js` (`powerRating`, `botAlloc`), `prototype/src/data.js` (`LEAGUES`), `prototype/tools/wiki.mjs` (só o necessário)
- Test: `prototype/tools/sim-test.js`

**Interfaces:**
- Consumes: `typePower`, `computeStats`, `freePoints`, `statLimit`, `validAlloc`.
- Produces: `Breed.foal(...)` devolve o potro sem `base`, com `potential` (por status: 50% herda de um dos pais, senão inteiro uniforme de 0 a 31; sem piso por estrela) e sem `neutro`; `RaceSim.botAlloc(horse) → alloc` (o limite por status vai para `vel`, ou `forca` se o tipo for `grama`; o resto, um ponto por vez, em `acel → man → forca → est → garra → vel`, pulando o status do primeiro passo e os que estão no teto; a sobra em `sorte`); `RaceSim.powerRating(horse, gear) = round(Σ ratingW × status + 18 × peso do gatilho por skill + 80 × typePower + pontos de conjunto)` com `ratingW = { vel: 3.1, acel: 1.4, man: 1.45, est: 2.4, forca: 3.3, garra: 1.3, sorte: 0.2 }`; `GameData.LEAGUES` com os limites novos.

- [ ] **Step 1: Testes que falham**: potro determinístico (mesma seed e contador dão o mesmo potro), genética sempre de 0 a 31, sem `base`, nunca `neutro`, Mítico nunca nasce (5.000 cruzas de Míticos); `botAlloc` soma exatamente `freePoints`, respeita `statLimit` e o teto, é idêntico em duas chamadas e, para um Comum ★★ de genética 16 no nível 50, põe 20 em `vel` (Fogo/Água) ou em `forca` (Grama); `powerRating` de um cavalo com `alloc` maior é maior; cada inicial de nível 1 cai na liga Bronze.
- [ ] **Step 2: Rodar** e ver falhar.
- [ ] **Step 3: Implementar.** Em `breed.js`: tirar o sorteio de status base (passo 5 do cabeçalho) e o piso `GRAU_POT_FLOOR`; atualizar a lista de ordem das chamadas de RNG no cabeçalho. Ligas: seis faixas iguais entre o Poder de um Comum de nível 1 e o de um Lendário de nível 50 com `botAlloc` (genética 16 em tudo, ★★, sem peças); escrever os limites em `LEAGUES` e, no comentário, a conta que os gerou.
- [ ] **Step 4: Regravar** o snapshot dos três potros do `sim-test.js` e anotar no relatório os três potros novos (vão para `docs/exemplos.md` na Tarefa 8). Rodar `sim-test.js`, o build e `wiki-test.mjs`.
- [ ] **Step 5: Commit** ("ajusta cruzamento, Poder, build dos bots e ligas ao modelo v3").

### Task 4: Metas de balanceamento

**Files:**
- Modify: `prototype/tools/balance.js`
- Test: o próprio `balance.js` (`--quick` e completo)

**Interfaces:**
- Consumes: tudo das Tarefas 1 a 3, inclusive `noTypeSkill` e `botAlloc`.
- Produces: `balance.js` com as metas da spec §12 e saída no formato de hoje (`**Todas as N metas passaram.**`).

- [ ] **Step 1: Reescrever o cavalo sintético** do harness (`mk()` e afins) sem `base`: genética explícita, `alloc` por política. Políticas nomeadas: `bot` (`botAlloc`), `tudoVel`, `tudoForca`, `equilibrada`, `fortesDoTipo`, `cobreFraco`.
- [ ] **Step 2: Escrever as metas** com as faixas da spec §12: M1, M3 (1→11, 20→30, 40→50), M4 (um e dois degraus), M5 (★★★×★ e ★★×★, mesma genética), M6 (nenhuma política vence outra em mais de 60%, níveis 11, 30 e 50), M7, M8 (substitui a Em1), M9 (15,3–18,0% em Comum 1, Raro 30 e Lendário 50), P1 por tipo, raridade e estrelas, P2, S1 sem as três skills que saíram, A1, E1–E4 e E3b, durações rebaseadas (curta 1.400–1.599 m perto de 96 s; longa 1.800–2.000 m perto de 127 s), e as de determinismo, pagamentos, Dado e clima como estão. Sai a 4b. A M2 fica só como informação na saída (diferença de ganho pareado entre as três skills de tipo), sem falhar.
- [ ] **Step 3: Rodar o completo.** Esperado: todas passam com valores perto dos da spec §12. Se uma meta falhar por pouco, **não mexa em constante de jogo**: registre o valor medido e a diferença no relatório e pare na meta (a conversa principal decide o ajuste). Se a E3b (não medida na calibração) ficar fora de 60–80%, registre o valor e proponha a faixa.
- [ ] **Step 4: `--quick`** em até 60 s; metas ruidosas demais com poucas amostras rodam só no completo, com aviso na saída.
- [ ] **Step 5: Commit** ("rebaseia as metas de balanceamento para o modelo v3").

### Task 5: Save v5 e o jogo rodando de novo

**Files:**
- Modify: `prototype/src/game.js` (versão do save, `sanitize`, `sanitizeMount`, migração, jogo novo, `buildLobby`/`bestLevelFor`, textos que citam Neutro ou status base), `prototype/src/dev.js` e a gaveta DEV no `game.js`, `prototype/tools/ui-test.mjs`
- Test: `prototype/tools/ui-test.mjs`, `./scripts/check.sh`

**Interfaces:**
- Consumes: `RaceSim.validAlloc`, `botAlloc`, `allocInfo`, `powerRating`, `GameData.TYPE_SKILLS`.
- Produces: save versão 5; cada montaria guardada sem `base` e com `alloc`; `Dev.horseTemplate(c, n)` aceitando genética por status, estrelas e `alloc`.

- [ ] **Step 1: Contextos novos no `ui-test.mjs`, falhando**: `migracao` (um save v4 de exemplo, com cavalo Raro de nível 12 com `base`, um cavalo `neutro`, um com `labareda`, peças e uma sala aberta de 1.000 m: depois de carregar, a versão é 5, nenhum cavalo tem `base` nem é `neutro`, ninguém tem as três skills, o Ouro e as peças são os mesmos, os pontos livres do nível 12 estão disponíveis e nenhum veio distribuído, e a sala tem a mesma seed, os mesmos rivais e a mesma distância); `adulterado-v5` (`alloc` com 999, negativo e texto: carrega saneado); jogo novo começa com inicial Comum ★★.
- [ ] **Step 2: Rodar** `UI_SO=migracao,adulterado-v5 node prototype/tools/ui-test.mjs` e ver falhar.
- [ ] **Step 3: Implementar.** Migração v4 → v5 (spec §9): descartar `base`; `alloc` zerado; `neutro` vira `['fogo', 'agua', 'grama'][hash2(seedBase, número do uid) % 3]`; tirar as três skills; sala aberta preservada com o Poder recalculado. `sanitizeMount` valida `alloc` com `validAlloc`. Bots da sala recebem `alloc = botAlloc(bot)` depois de escolhido o nível. Modo DEV: o save de teste migra pela mesma regra; a gaveta "Cavalo" ganha genética por status, estrelas e um botão "Devolver pontos" (só no DEV).
- [ ] **Step 4: Ajustar o resto do `ui-test.mjs`** ao jogo novo (números de Poder, nomes de skill, inicial Comum) e rodar `./scripts/check.sh` até terminar em `VERIFICAÇÃO COMPLETA: OK`.
- [ ] **Step 5: Commit** ("migra o save para a versão 5 e põe o jogo para rodar no modelo v3").

### Task 6: Telas da build, da skill de tipo e do nível

**Files:**
- Modify: `prototype/src/game.js` (aba Status, aba Skills, cartões, escolha do inicial, textos do Haras), `prototype/src/game.css`, `prototype/tools/ui-test.mjs`
- Test: `prototype/tools/ui-test.mjs`, `./scripts/check.sh`

**Interfaces:**
- Consumes: `RaceSim.allocInfo`, `validAlloc`, `naturalStat`, `typeSkill`, `computeStats`.
- Produces: classes de CSS `.selo-nivel`, `.pontos-livres`, `.nota-genetica`, `.vaga-tipo`; `window.__galope.ui.rascunho` (o rascunho de pontos, para o teste ler).

- [ ] **Step 1: Contextos novos, falhando**: `build` (cavalo de nível 12: a aba Status mostra "pontos livres: 13" com ★★, uma linha por status com nota de genética e barra; o "+" some no status que bateu o limite de 5 pontos, ou o teto; "Desfazer" zera o rascunho; "Confirmar" mostra o aviso de que não dá para voltar atrás e só grava no segundo toque; depois de gravar, o status e o Poder sobem e a gravação que falha desfaz); `build-nivel1` (zero pontos: nenhum "+"); `selo` (o selo "Nv N" existe no retrato nas cinco telas: Estábulo, Montaria, Correr, Haras e sala; o cartão do Estábulo tem barra de XP e o aviso "+N" quando há pontos sem distribuir; "Nv" saiu da fileira de etiquetas); `vaga-tipo` (a aba Skills mostra a skill de tipo em vaga destacada, com o terço e o efeito na força atual); `inicial` (os três como Comuns, com a skill de tipo e os dois status fortes). Tudo sem rolagem horizontal em 360 px e com texto de 11 px ou mais.
- [ ] **Step 2: Rodar** e ver falhar.
- [ ] **Step 3: Implementar** as telas da spec §10. A nota de genética é C (0–7), B (8–15), A (16–23) ou S (24–31). A confirmação é na própria tela (nada de `window.confirm`). Com sala aberta, distribuir pontos no cavalo ativo segue a regra de hoje para peças: só vale se o Poder não passar do que a sala viu. O Haras muda só os textos (genética metade herdada; sem janela de status por estrela). Sai da interface tudo que cita Neutro.
- [ ] **Step 4: Rodar** `./scripts/check.sh` até `VERIFICAÇÃO COMPLETA: OK`.
- [ ] **Step 5: Commit** ("mostra a build, a genética, a skill de tipo e o nível nas telas").

### Task 7: A skill de tipo na corrida

**Files:**
- Modify: `prototype/src/fx.js`, `prototype/src/sprites.js` (se o desenho precisar), `prototype/src/game.js` (`createRaceView`), `prototype/tools/fx-test.js`, `prototype/tools/ui-test.mjs`
- Test: `prototype/tools/fx-test.js`, `prototype/tools/ui-test.mjs`

**Interfaces:**
- Consumes: `racerInfo[i].typeSkill = { id, name, from, to }` e o evento `typeSkill: true` da Tarefa 2.
- Produces: `RaceFx.typeZone(typeSkill, pos) → 0..1 | null` (fração percorrida do terço, ou `null` fora dele); `RaceFx.drawTypeAura(ctx, elemento, x, y, escala, t, reduzido)`; `RaceFx._stats.auras` (quantas auras foram desenhadas no quadro, para o teste).

- [ ] **Step 1: Testes que falham**: `fx-test` (`typeZone` devolve `null` antes e depois do terço e 0, 0,5 e perto de 1 dentro dele; `drawTypeAura` com contexto falso desenha no máximo 30 `fillRect` por cavalo, usa a cor do elemento e não usa `Math.random`; em modo reduzido desenha só o contorno); `ui-test` contexto `aura` (corrida montada no modo DEV com um cavalo de cada tipo: no primeiro terço só o de Fogo tem aura, no do meio só o de Grama, no último só o de Água; o balão com o nome da skill aparece na entrada de cada terço; o minimapa mostra os três terços); o contexto `teto` continua abaixo de 4.500 `fillRect` com as auras ligadas.
- [ ] **Step 2: Rodar** e ver falhar.
- [ ] **Step 3: Implementar.** Aura por código: rastro de chamas nos cascos (Fogo), folhas e raízes sob os cascos (Grama), onda atrás do cavalo (Água), animada pelo relógio da corrida e por ruído determinístico já existente no `fx.js`. O balão usa o mecanismo de hoje dos eventos de skill. Minimapa: os três terços com uma faixa fina na cor de cada tipo.
- [ ] **Step 4: Rodar** `fx-test.js` e `./scripts/check.sh` até `VERIFICAÇÃO COMPLETA: OK`; anotar no relatório o máximo de `fillRect` medido pelo contexto `teto`.
- [ ] **Step 5: Commit** ("anima a skill de tipo na pista e mostra os terços no minimapa").

### Task 8: Wiki, documentos e capturas

**Files:**
- Modify: `prototype/tools/wiki.mjs`, `prototype/tools/wiki-test.mjs`, `docs/GDD.md` (§3, §4, §6, §7 e o estado da §8), `docs/exemplos.md`, `docs/memoria/ESTADO.md`, `docs/memoria/decisoes.md`, `docs/memoria/bugs.md`, `docs/cronograma.md` (só se a ordem dos blocos mudar)
- Delete: `prototype/assets/icons/el-neutro.png` (e o que só ele usava)
- Regenerar: `prototype/screens/` (rodar `node prototype/tools/ui-test.mjs` direto)
- Test: `prototype/tools/wiki-test.mjs`, `./scripts/check.sh`

**Interfaces:**
- Consumes: tudo das tarefas anteriores e os três potros regravados na Tarefa 3.

- [ ] **Step 1: Teste que falha**, em `wiki-test.mjs`: o wiki tem a seção de status com a fórmula nova e a tabela de raridade (40–56 / teto 80 … 60–76 / teto 100), a tabela de pontos livres por estrela (49 / 58 / 73 no nível 50), a seção das três skills de tipo com terço e efeito, nenhum "Neutro" como tipo, e as contagens novas (15 skills, 15 montarias).
- [ ] **Step 2: Rodar** e ver falhar.
- [ ] **Step 3: Reescrever no `wiki.mjs`** as seções Status, Level, Raridades, Elementos, Skills (grupo "Gerais" e a parte das skills de tipo), Pista, Montarias, Cruzamento, Equipamento e Poder, lendo tudo do código (constante nova sem tradução deve quebrar o build, como hoje).
- [ ] **Step 4: Documentos.** GDD §3 e §4 reescritas com o modelo novo; §6 e §7 com o que mudou no cruzamento e no equipamento; na §8, marcar o bloco 1 como implementado. `docs/exemplos.md` com as medições novas do `balance.js` completo e os três potros. Memória: estado, decisões (as seis mudanças da spec §13, mais o que a implementação decidiu) e pendências.
- [ ] **Step 5: Capturas e verificação.** `node prototype/tools/ui-test.mjs` (capturas oficiais), depois `./scripts/check.sh` até `VERIFICAÇÃO COMPLETA: OK`.
- [ ] **Step 6: Commit** ("atualiza wiki, documentos e capturas para o bloco 1 dos cavalos v3").
