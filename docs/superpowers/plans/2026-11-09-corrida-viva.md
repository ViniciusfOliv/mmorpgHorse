# Corrida viva e modo DEV — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tornar a corrida legível e viva (galope de corrida, dados e skills visíveis, natureza com vento, curvas) e criar um modo DEV com save separado, sem mudar quem ganha.

**Architecture:** um módulo novo `prototype/src/fx.js` (`window.RaceFx`) concentra os efeitos: funções puras (vento, linha do tempo de efeitos, câmera lenta, traçado, deslocamento de curva, ícone de skill, arranjo de plaquinhas) testadas no Node, e funções de desenho chamadas pela tela da corrida. `prototype/src/dev.js` (`window.Dev`) tem as funções puras do painel DEV. A simulação ganha só o parâmetro opcional `config.dev.skillsAlways`.

**Tech Stack:** HTML/CSS/JS puro (ES5 em `prototype/src/`), Node para testes (`assert`), Playwright já instalado para o teste de interface, API PixelLab v2 pelo script existente.

**Spec:** `docs/superpowers/specs/2026-11-09-corrida-viva-design.md`

## Global Constraints

- Português em comentários, textos e commits; commit no imperativo; trailer em todo commit:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01MGExzKELAJ58uyj4wakVgJ`.
- Branch `claude/corrida-viva`. Sem push pelos implementadores (o controlador faz).
- `prototype/src/*.js` em ES5 estrito (`var`/`function`; sem `const`/`let`/arrow/template string/`includes`/`find`/`Set`/`Object.assign`). `prototype/tools/*` pode usar JS moderno. Sem dependências novas.
- Módulos novos no padrão UMD dos existentes (browser: `window.X`; Node: `module.exports`), incluídos no `SCRIPTS` de `prototype/build.mjs` na ordem `data, sim, breed, gear, sprites, fx, dev, game`.
- Nunca editar `prototype/dist/` à mão: `node prototype/build.mjs` e commitar `dist/` junto com `src/`.
- Corrida determinística: sem `config.dev`, `RaceSim.simulate` devolve exatamente o mesmo resultado de hoje. Efeitos nunca alimentam a simulação. Nada de `Math.random` em `prototype/src/`.
- Regras de design do `CLAUDE.md` §8 valem no jogo real. Itens Lendários e Ouro infinito só no perfil DEV (`galope-elemental:dev`); o save real (`galope-elemental:v1`) nunca é lido nem gravado com `?dev=1`.
- PixelLab: teto total desta spec **30 gerações** (cota do plano, US$ 0), só com `--gerar`, `NODE_USE_ENV_PROXY=1`; credencial pelo proxy, nunca no código.
- Sem moldes (`?semmoldes=1`) tudo continua funcionando. Opção "Animações" reduzidas: nada congela.
- Antes de dizer que terminou a última tarefa: `./scripts/check.sh` termina em `VERIFICAÇÃO COMPLETA: OK`.

## Review Focus

1. **Plaquinhas do Dado em raias vizinhas** (8 cavalos lado a lado): os números não podem se sobrepor nem sair da tela — `RaceFx.layoutBadges` empurra para cima/baixo; teste no fx-test (Task 3).
2. **"Pular" durante a câmera lenta do Dado:** o resultado abre normalmente, sem efeito preso — passo no ui-test (Task 3).
3. **Save antigo sem `settings`** (todo save real de hoje): carrega com `motion: 'sistema'` sem perder nada — passo no ui-test (Task 5).
4. **Condições DEV fora do formato** (distância não múltipla de 100, traçado vazio, clima inexistente): `Dev.conditions` corrige ou descarta o campo e a simulação nunca quebra — teste no sim-test (Task 1).
5. **Layout compacto 360 px:** faixa do Dado, selo de vento, balões e minimapa cabem sem rolagem horizontal — o `checkOverflow` do ui-test roda numa corrida DEV com tudo ligado (Task 5).

---

### Task 1: Modo DEV (save separado, painel e skills sempre ativam)

**Files:**
- Create: `prototype/src/dev.js`
- Modify: `prototype/src/sim.js` (`tryFire` ~:589; leitura de `config.dev` em `simulate`), `prototype/src/game.js` (`SAVE_KEY` :31, `devAtivo` :797, painel :822-829, ações :2571-2610, `settle` :1857, montagem da sala), `prototype/src/game.css`, `prototype/build.mjs` (`SCRIPTS`)
- Test: `prototype/tools/sim-test.js`, `prototype/tools/ui-test.mjs`

**Interfaces:**
- Produces:
  - `config.dev = { skillsAlways: true }` em `RaceSim.simulate`: na tentativa de skill, `r.rng()` continua sendo chamado na mesma ordem e a skill ativa mesmo acima da chance.
  - `Dev.SAVE_KEY = 'galope-elemental:dev'`, `Dev.GOLD_INF = 999999`.
  - `Dev.horseTemplate(c) → template` com `c = { name, element, rarity, sex, potential: 0..31 | 'max', skills: [ids], palette: { coat, coatShade, mane, accent } }`; devolve o formato de `GameData.STARTERS` (id `'dev-' + n`, `base` de cada status = `RARITIES[rarity].baseLo`, `especie: 'cavalo'`, `grau: 2`); skills inexistentes ou repetidas saem; no máximo `RARITIES[rarity].skillSlots`.
  - `Dev.itemId({ slot, set, rarity }) → id | null` (só ids existentes em `GameData.GEAR`). O nível (1 até `maxLevel`) e o `+` da peça (0 até `plusMax`) são aplicados pelo `game.js` na instância criada (`level` direto com `xp: 0`; `plus` direto).
  - `Dev.conditions(f) → parcial de conditions` com `f = { weather, surface, distance, tracado: 'normal'|'curvas'|'subidas' }`; campo inválido é omitido; distância arredondada para múltiplo de 100 dentro de 1000–2400; `'curvas'`/`'subidas'` geram 7 blocos de mesmo tamanho (fronteiras múltiplas de 10 m, 1º e último `reta`, os 5 do meio todos `curva` ou alternando `subida`/`reta`).
  - `Dev.refillGold(state)` (se `state.gold < Dev.GOLD_INF`, vira `Dev.GOLD_INF`).
  - Em `game.js`: com `devAtivo()`, `SAVE_KEY = Dev.SAVE_KEY`; perfil novo nasce com a Brasa sem tela inicial; `ui.devNext = { seed, cond, wind: { intensity, dir } | null, skillsAlways }` aplicado ao montar a próxima sala e limpo depois de `settle`; `L.dev = { wind, skillsAlways }` disponível para a tela da corrida (Task 5 lê `L.dev.wind`).

- [ ] **Step 1: Gravar a referência da simulação.** No sim-test, seção `dev`, teste `sem config.dev o resultado é o de antes`: 20 seeds fixas (1001…1020) com os 3 iniciais + 5 aluguéis, `hash = sha1(JSON.stringify({ finishOrder, finishTimes, events }))` (pode usar `require('crypto')`), comparado com uma tabela de 20 hashes gerada **com o código atual, antes de mexer no `sim.js`**.
- [ ] **Step 2:** `node prototype/tools/sim-test.js` → o teste novo passa (referência gravada).
- [ ] **Step 3: Testes que falham.** `com skillsAlways toda tentativa de skill ativa` (seed com cavalos de skills de gatilho garantido, como `start`, `final` e `straight` ⇒ um evento `'skill'` por tentativa); `Dev.horseTemplate respeita vagas e skills válidas`; `Dev.itemId devolve só ids do catálogo`; `Dev.conditions corrige distância e omite campo inválido`, com `RaceSim.normalizeConditions(Dev.conditions(...))` sem exceção para `{ distance: 1234 }`, `{ weather: 'granizo' }`, `{ tracado: 'curvas' }`, `{}`.
- [ ] **Step 4:** rodar → FALHA (`Dev` indefinido / `skillsAlways` ignorado).
- [ ] **Step 5:** implementar `dev.js`, o parâmetro em `sim.js` e o `build.mjs`. Rodar o sim-test → tudo passa, inclusive a referência do Step 1.
- [ ] **Step 6: Painel e perfil em `game.js`.** Faixa "MODO DEV — save de teste"; botão "DEV" fixo que abre a gaveta com os 5 grupos da spec §3 (Moedas, Cavalo, Itens, Próxima corrida, Perfil); Ouro infinito ligado por padrão (`Dev.refillGold` depois de cada gasto); cavalo criado entra no estábulo sem limite de vagas e vira a ativa; "Zerar perfil" com `confirm`; "Voltar ao jogo real" abre a URL sem `dev=1`. Os 5 botões antigos saem (os 5 efeitos continuam alcançáveis pela gaveta).
- [ ] **Step 7: ui-test.** Contexto DEV: grava um save real conhecido em `galope-elemental:v1`, abre `?dev=1`, joga uma corrida e confere que o `v1` continua byte a byte igual e que `galope-elemental:dev` existe; depois de pagar a entrada, Ouro = 999 999; cria um cavalo Mítico de Água nível 30 com 2 skills e confere no estábulo; dá uma peça Lendária e confere no inventário; força clima `nevoa` e confere o clima da sala e da corrida; sem `?dev=1`, não existe `.dev-painel` nem a faixa.
- [ ] **Step 8:** `node prototype/build.mjs` e `node prototype/tools/ui-test.mjs` (com `SHOTS_DIR` numa pasta temporária) → OK.
- [ ] **Step 9: Commit** `Adiciona o modo DEV com save separado e o parâmetro de skills sempre ativas`.

### Task 2: Galope de corrida e bússola (PixelLab, até 30 gerações)

**Files:**
- Modify: `prototype/tools/pixellab-moldes.mjs`, `prototype/tools/moldes-lib.mjs`, `prototype/tools/moldes-test.mjs`, `docs/memoria/assets.md` (o script escreve)
- Saídas: `prototype/assets/pixellab/molde-{ondas,folhas,lisa}-galope-*.png`, `molde-{ondas,folhas,lisa}.json`, `raw/`; `prototype/assets/icons/aba-expedicao.png`, `icons/raw/`

**Interfaces:**
- Consumes: o fluxo atual do script (`pedidoPose`, `pedidoGalope`, `--only`, `--teto`, `--repetir`, `--reprocessar`, `registrarAsset`).
- Produces: `passada(idx, w, h) → número` em `moldes-lib.mjs` (distância horizontal entre o pixel opaco mais à esquerda e o mais à direita nas linhas do terço de baixo do contorno). Os JSON de molde mantêm o formato atual (`frames`, `ancoras`, `larguraUtil`, `footY`); `retrato` e `parado` dos 3 estilos não mudam.

- [ ] **Step 1: Teste que falha.** No `moldes-test`, bloco "galope de corrida": para cada estilo ≠ `chamas`, `max(passada(quadro)) ≥ 0.8 × max(passada dos quadros de chamas)` e, em cada quadro, `bbox.h ≤ 1.1 × média de bbox.h do galope de chamas`. Teste sintético de `passada` com uma forma conhecida.
- [ ] **Step 2:** rodar `node prototype/tools/moldes-test.mjs` → FALHA para `ondas`, `folhas` e `lisa` (com os números medidos no relatório).
- [ ] **Step 3: Pose de corrida no script.** Nova pose `corrida` para o montado desses 3 estilos: `init_image` = o 1º quadro cru (RGBA, de `raw/`) do galope de `chamas`, `init_image_strength` inicial 300 (ajuste dentro do teto e registre), texto `racing horse at full gallop, body stretched low, front legs reaching far forward and hind legs pushing far back, jockey crouched low`, mais a crina do estilo e o `COR` atual. Ação do galope: `full speed racing gallop, long extended stride, moment of suspension with all four hooves off the ground, seamless loop, mane and tail streaming back`. A pré-checagem do script também aplica o aceite do Step 1 e rejeita com nova seed. A bússola ganha a descrição `round navigation compass, top view, crisp red and white needle pointing straight up, gold rim` e uma seed nova.
- [ ] **Step 4:** dry-run `node prototype/tools/pixellab-moldes.mjs --lote tudo` → lista só os itens novos (os outros reaproveitados) e o total previsto ≤ 30.
- [ ] **Step 5: Gerar.** `NODE_USE_ENV_PROXY=1 node prototype/tools/pixellab-moldes.mjs --lote tudo --gerar --teto 30` (pode ser por `--only`, somando ≤ 30). Guardar no relatório o saldo antes/depois e as gerações por item.
- [ ] **Step 6: Folha para o Vinicius.** Gerar `/home/user/mmorpgHorse/.superpowers/sdd/2026-11-09-corrida-viva/galopes-novos.png` com os 4 galopes (9 quadros cada) lado a lado na paleta da Brasa, e a bússola nova ampliada. O controlador mostra ao Vinicius antes da revisão.
- [ ] **Step 7:** `node prototype/tools/moldes-test.mjs` → passa; `node prototype/build.mjs`; `./scripts/check.sh` → OK.
- [ ] **Step 8: Commit** `Refaz o galope de ondas, folhas e lisa na pose de corrida e a bússola`.

### Task 3: Base de efeitos e Dados na pista

**Files:**
- Create: `prototype/src/fx.js`, `prototype/tools/fx-test.js`
- Modify: `prototype/build.mjs`, `scripts/check.sh` (etapa `2b/5 Efeitos`), `prototype/src/game.js` (`createRaceView` :1935+, laço :2355-2385), `prototype/tools/ui-test.mjs`

**Interfaces:**
- Consumes: eventos `'dado'` (`t`, `rolls[i] = { dice, best, rerolls }`, `winner`, `changed`, `weather`), `Sprites.horseBox`, `L.dev` (Task 1).
- Produces (`window.RaceFx`):
  - `RaceFx.timeline(sim, racers) → [{ kind, t0, t1, racer, ... }]` ordenada por `t0`. Nesta tarefa, `kind: 'dado'` com `{ t0: ev.t, t1: ev.t + 3, racer: winner, rolls, winner, changed, weather }`. As Tasks 4 acrescentam `'skill'`, `'garra'` e `'cansou'`.
  - `RaceFx.slowFactor(tl, simT, reduced) → número` = `0.4` dentro de `[t0, t0 + 0.8]` de cada `'dado'` (`[t0, t0 + 0.4]` se `reduced`), senão `1`. A tela usa `slowK = min(slowK, slowFactor)`.
  - `RaceFx.diceState(item, simT, reduced) → { fase: 'gira'|'regira'|'mostra'|'fim', brilho: 0..1 }`, em tempo de simulação: `gira` em `[t0, t0+0.4)` (pulada se `reduced`), `regira` em `[t0+0.4, t0+0.64)` só para `rerolls > 0`, `mostra` até `t0+3`, `brilho` do vencedor pulsando em `[t0+0.64, t0+3]`.
  - `RaceFx.layoutBadges(rects, W, H) → rects` (mesma ordem; desloca na vertical até não haver sobreposição e mantém dentro de `[0, W] × [0, H]`).
  - Desenho: `RaceFx.drawDice(ctx, x, y, S, roll, estado, isWinner, simT)`, `RaceFx.drawDiceStrip(ctx, item, racers, lay, S, simT)`.
  - `RaceFx._stats = { dados, faixaDado, baloes, particulas, msQuadro }`, atualizado a cada quadro da corrida (para o ui-test).

- [ ] **Step 1: Testes que falham** (`fx-test.js`, mesmo harness do sim-test): `timeline tem um 'dado' por evento com o vencedor do evento` (simulação real de uma seed fixa); `slowFactor é 0.4 só na janela e 1 fora`, inclusive com `reduced`; `diceState percorre gira→mostra e regira só com rerolls`; `layoutBadges com 8 retângulos empilhados não deixa sobreposição nem sai da tela`.
- [ ] **Step 2:** `node prototype/tools/fx-test.js` → FALHA (`RaceFx` indefinido).
- [ ] **Step 3:** implementar `fx.js` (puras + desenho do dado em pixel art: cubo girando nos quadros `gira`/`regira`, plaquinha com o `best` e os outros dados menores, plaquinha dourada com brilho e faíscas no vencedor, faíscas omitidas em `reduced`) e a faixa "DADO DA SORTE" (cor da raia + número, em ordem decrescente, vencedor brilhando, até `t0 + 3`). Ligar no `build.mjs` e no `check.sh`.
- [ ] **Step 4:** `node prototype/tools/fx-test.js` → passa.
- [ ] **Step 5: Ligar na corrida.** `createRaceView` monta a linha do tempo uma vez; o laço aplica `slowFactor`; os dados são desenhados sobre a caixa de cada cavalo visível (`Sprites.horseBox`), com `layoutBadges`; a faixa aparece no topo abaixo do HUD.
- [ ] **Step 6: ui-test.** Corrida até o 1º Dado: `RaceFx._stats.dados ≥ 1` e `faixaDado === true` durante a janela; o número da plaquinha do vencedor é o `best` do evento; clicar "Pular" dentro da janela abre o resultado sem erro de console (Review Focus 2).
- [ ] **Step 7:** build + ui-test → OK; `./scripts/check.sh` → OK.
- [ ] **Step 8: Commit** `Mostra o Dado da Sorte sobre cada cavalo com câmera lenta e faixa`.

### Task 4: Skills, Garra e cansaço visíveis

**Files:**
- Modify: `prototype/src/fx.js`, `prototype/src/game.js` (`boosts` :1977-1989 passa a vir da linha do tempo; anúncio no centro), `prototype/tools/fx-test.js`, `prototype/tools/ui-test.mjs`

**Interfaces:**
- Consumes: `RaceFx.timeline` (Task 3), `config.dev.skillsAlways` pelo painel (Task 1).
- Produces:
  - `RaceFx.skillIcon(skill) → 'vel'|'ace'|'folego'|'curva'|'subida'|'dado'|'clima'|'garra'`, pela primeira chave presente em `skill.effect` nesta ordem: `speedMult→vel, accelMult→ace, staminaRestore→folego, drainMult(<1)→folego, curveBonus→curva, hillBonus→subida, hillDrainMult→subida, extraDice→dado, weatherDouble→clima, garraChanceBonus→garra, garraBoostBonus→garra`; nenhuma ⇒ `'vel'`.
  - `timeline` acrescenta `{ kind: 'skill', t0, t1, racer, skillId, icon, element }` (duração: `durationS`; ou o tempo para o cavalo andar `distanceM` pelos `frames`; ou até sair do bloco se `blockScoped`; limitada a `[1.5, 7]` s), `{ kind: 'garra', t0, t1: finishTime + 0.6, racer }` e `{ kind: 'cansou', t0, t1: t0 + 1.5, racer }`. A skill é achada pelo nome entre as skills do cavalo, como hoje.
  - Desenho: `RaceFx.drawBalloon(ctx, x, y, S, item, simT, pilha)` (sobe e some em 1,5 s; `pilha` 0..2), `RaceFx.drawSkillAura(ctx, box, item, simT, reduced)` (contorno na cor do elemento; linhas de vento para `vel`/`ace`; "+" verde para `folego`; faíscas nos cascos para `curva`; faíscas e partículas omitidas em `reduced`).

- [ ] **Step 1: Testes que falham** (`fx-test`): `skillIcon segue a ordem` para 5 skills reais do catálogo (`arranque`, `drift`, `segundo-ar`, `dado-viciado`, `sol-a-pino`); `duração da skill fica em [1.5, 7]`; `timeline tem um item por evento skill/garra/cansou`.
- [ ] **Step 2:** rodar → FALHA.
- [ ] **Step 3:** implementar em `fx.js`; trocar o vetor `boosts` da corrida pela linha do tempo (o rastro de elemento continua, mais forte durante a skill); balão sobre o cavalo (até 3 empilhados por cavalo); faixa grande no centro com o nome da skill do jogador ("LABAREDA!") por 1,5 s; Garra com balão "GARRA!"; cansaço com balão cinza "CANSOU".
- [ ] **Step 4:** fx-test → passa.
- [ ] **Step 5: ui-test.** Corrida DEV com "skills sempre ativam" e cavalo com `arranque`: `RaceFx._stats.baloes ≥ 1` logo depois da largada; a faixa central aparece com o nome da skill.
- [ ] **Step 6:** build + ui-test + `./scripts/check.sh` → OK.
- [ ] **Step 7: Commit** `Mostra skills, Garra e cansaço com balão, contorno e efeito no cavalo`.

### Task 5: Natureza, vento e opção "Animações"

**Files:**
- Modify: `prototype/src/fx.js`, `prototype/src/sprites.js` (`drawTrack` :1610 recebe `wind`; `drawWeather` :1906 vira repasse para `RaceFx.drawNature`), `prototype/src/game.js` (`reduced` :48, `newState`/sanitize, Perfil, HUD da corrida), `prototype/tools/fx-test.js`, `prototype/tools/ui-test.mjs`

**Interfaces:**
- Consumes: `L.dev.wind` (Task 1), `RaceFx._stats` (Task 3).
- Produces:
  - `RaceFx.wind(seed) → { intensity: 'calmo'|'brisa'|'ventania', dir: 1 | -1 }`, por um hash próprio da seed (não usa nenhum fluxo da simulação): `calmo` 35 %, `brisa` 40 %, `ventania` 25 %; `dir` por outro bit.
  - `RaceFx.drawNature(ctx, { weather, wind, t, W, H, P, laneTop, trackBottom, reduced })`: sol (raios de luz; faixas de calor, que somem em `reduced`), chuva (pingos inclinados pelo vento; respingos só na faixa `[laneTop, trackBottom]`; relâmpago some em `reduced`; em `reduced` a chuva cai a 40 % da velocidade e com metade dos pingos, sem congelar), névoa (camada de trás; a da frente por `RaceFx.drawFogFront`), nublado (sombras levadas pelo vento), folhas e poeira pela intensidade do vento (`calmo` 0, `brisa` até 6, `ventania` até 18 por tela; metade em `reduced`). Tudo função de `t`, do índice e da seed.
  - `RaceFx.drawHoofDust(ctx, x, y, S, t, surface)` em terra ou areia, fora da chuva.
  - `state.settings = { motion: 'sistema'|'completas'|'reduzidas' }`; `reduced()` = `motion === 'reduzidas' || (motion === 'sistema' && prefers-reduced-motion)`.

- [ ] **Step 1: Testes que falham** (`fx-test`): `wind é determinístico` (mesma seed ⇒ mesmo resultado); `wind segue a distribuição` (10 000 seeds; cada fração a ±3 p.p. de 35/40/25 %).
- [ ] **Step 2:** rodar → FALHA.
- [ ] **Step 3:** implementar `wind`, `drawNature`, `drawFogFront` e `drawHoofDust`; `drawTrack` balança bandeiras e grama da borda pelo vento; selo "VENTO: BRISA →" ao lado do clima no HUD (no compacto, só o ícone); `L.dev.wind` substitui o vento sorteado quando existir.
- [ ] **Step 4: Opção no Perfil.** Grupo "Animações" com 3 escolhas; gravado no save; save antigo sem `settings` ganha `{ motion: 'sistema' }` no sanitize; todo `reduced()` do jogo lê a opção.
- [ ] **Step 5:** fx-test → passa.
- [ ] **Step 6: ui-test.**
  - Save v4 antigo, sem `settings`, carrega e o Perfil mostra "Seguir o sistema" (Review Focus 3).
  - Com `reducedMotion: 'reduce'` e "Completas", a chuva anda: dois recortes do canvas em instantes diferentes são diferentes. Com "Reduzidas", também andam (não congela).
  - Desempenho: corrida DEV com chuva e ventania em 1280 px, `RaceFx._stats.msQuadro` médio em "Completas" menos o de "Reduzidas" ≤ 6 ms (registrar os dois números).
  - `checkOverflow` em 360 px numa corrida DEV com chuva, ventania, "skills sempre ativam" e um Dado na tela (Review Focus 5).
- [ ] **Step 7:** build + ui-test + `./scripts/check.sh` → OK.
- [ ] **Step 8: Commit** `Melhora sol, chuva, névoa e nublado, adiciona vento e a opção de animações`.

### Task 6: Curvas no mapa, no minimapa e na pista

**Files:**
- Modify: `prototype/src/fx.js`, `prototype/src/game.js` (mapa da pista :1800-1852, faixa de progresso do HUD :2200-2225, posição dos cavalos), `prototype/src/sprites.js` (`drawTrack`: curvas :1733-1745 viram arco), `prototype/tools/fx-test.js`, `prototype/tools/ui-test.mjs`

**Interfaces:**
- Produces:
  - `RaceFx.trackPath(blocks) → { pts: [[x, y], …] (um ponto a cada 10 m), giroTotal (graus), segs: [{ type, i0, i1 }], bbox }`: rumo inicial 0°; reta em linha reta; cada curva gira no sentido anti-horário `clamp(comprimento / 150 × 90, 45, 180)` graus, distribuídos igualmente pelos pontos dela; subida não gira.
  - `RaceFx.curveOffset(curves, m) → px de arte` = `-6 × sin(π × u)` com `u = (m − a)/(b − a)` dentro de uma curva `[a, b]`; `0` fora.
  - `RaceFx.drawTrackMap(ctx, path, box, opts)` (mapa da sala e do Correr) e `RaceFx.drawMiniMap(ctx, path, posM, cores, me, box)` (pontos por cavalo; o seu maior e com contorno).

- [ ] **Step 1: Testes que falham** (`fx-test`): `giroTotal = soma dos giros das curvas`; `uma pista só de retas tem giroTotal 0 e pontos colineares`; `os pontos que giram estão nos trechos de curva`; `curveOffset é 0 fora, −6 no meio e simétrico`.
- [ ] **Step 2:** rodar → FALHA.
- [ ] **Step 3:** implementar; o mapa da sala e do Correr passa a ser o traçado (retas na cor do piso, curvas `BLOCK_TYPES.curva.color`, subidas `BLOCK_TYPES.subida.color`, largada e chegada marcadas); a faixa de progresso do HUD vira o minimapa (no compacto, continua o selo "↪CURVA"); em `drawTrack`, dentro de curva, cerca e linhas das raias somam `curveOffset` na coordenada do mundo, a arquibancada desliza para cima até 10 px de arte no meio da curva e placas "CURVA" aparecem na cerca; o `y` de cada cavalo soma `curveOffset(curves, pos) × S`.
- [ ] **Step 4:** fx-test → passa.
- [ ] **Step 5: ui-test.** Corrida DEV com traçado "curvas": sem erro de console, cavalo sempre na tela (`startCamMonitor`), minimapa desenhado (`RaceFx._stats` ganha `minimapa: true`); sala mostra o traçado.
- [ ] **Step 6:** build + ui-test + `./scripts/check.sh` → OK.
- [ ] **Step 7: Commit** `Desenha as curvas no mapa, no minimapa e na pista`.

### Task 7: Documentação, capturas e memória

**Files:** `CLAUDE.md` (§4 linha do `fx-test.js`; §7 sem mudança de regra), `docs/GDD.md` (arte/efeitos da corrida), `docs/memoria/ESTADO.md`, `docs/memoria/decisoes.md`, `docs/memoria/assets.md` (conferir as linhas da Task 2), spec (status "aprovada; implementada na branch `claude/corrida-viva`" e §12 "Histórico de ajustes" com o que mudou na execução), `prototype/screens/*`.

- [ ] **Step 1:** docs e memória (o que entrou, como usar o modo DEV, pendências).
- [ ] **Step 2:** `node prototype/tools/ui-test.mjs` sem `SHOTS_DIR` (capturas oficiais); abrir com Read a corrida, a sala e o Perfil e descrever cada uma em uma linha.
- [ ] **Step 3:** `./scripts/check.sh` → `VERIFICAÇÃO COMPLETA: OK`, com as etapas de moldes e de efeitos rodando.
- [ ] **Step 4: Commit** `Documenta a corrida viva e o modo DEV, capturas e memória`.
