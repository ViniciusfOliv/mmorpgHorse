# Núcleo da corrida v2 — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a base da corrida por 7 atributos, 5 raridades, mapa aleatório em blocos, clima como
triângulo com Dado da Sorte e skills passivas com chance de ativação — sem tática e sem Disposição do dia.

**Architecture:** `data.js` (modelo) → `sim.js` (simulação pura e determinística) → `game.js` (telas) →
`balance.js`/`ui-test.mjs` (verificação). Um arquivo de testes unitários novo (`sim-test.js`, Node puro)
cobre `data.js` e `sim.js` tarefa a tarefa; `balance.js` e `ui-test.mjs` só voltam a passar nas tarefas
7 e 8, por isso cada tarefa roda **só** `node prototype/tools/sim-test.js` até lá.

**Tech Stack:** HTML/CSS/JS puro, ES5 em `prototype/src/` (`var`/`function`, sem arrow/const), Node 22
+ `assert` nos tools, Playwright pré-instalado. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-11-06-nucleo-corrida-v2-design.md`

## Global Constraints

- Simulação **determinística**: nada de `Math.random`, `Date`, `Math.pow` com expoente fracionário em
  `sim.js`; só `+ - * /`, `powi`, `nthRoot`, `mulberry32`, `hash2`. Dado da Sorte só com inteiros.
- `prototype/src/*.js` em ES5 (roda no navegador sem build de transpilação); texto de jogo em pt-BR;
  ids de conteúdo sem acento (`'nevoa'`, `'saida-rapida'`).
- `prototype/dist/` é gerado: rodar `node prototype/build.mjs` e commitar junto com `src/` em toda
  tarefa que mexe em `game.js`, `sprites.js`, `data.js` ou `sim.js`.
- Regras invioláveis (`CLAUDE.md` §8): resultado só depois de pagar; sala não re-sorteada de graça;
  Gemas nunca viram Ouro.
- Branch `claude/nucleo-corrida-v2`; commits pequenos, imperativo, pt-BR.
- Antes de dizer que terminou (tarefa 9): `./scripts/check.sh` verde.

## Review Focus

1. **Bloco minúsculo (10 m):** uma montaria pode atravessar um bloco inteiro num tick; gatilhos de
   entrada/saída não podem disparar duas vezes nem pular um bloco. → teste `sim: mapa com bloco de 10 m`
   na tarefa 4.
2. **Todos do mesmo elemento:** cada Dado da Sorte "segura" o clima; o evento sai com `changed: false`
   e nunca derruba a corrida. → teste `dado: clima segura` na tarefa 5.
3. **Save antigo** (com `tactic`, sem `skills`, `v: 1`): `sanitize` tem de produzir um estado válido com
   as skills do inicial, sem perder Ouro. → passo de save antigo no `ui-test.mjs`, tarefa 6a.
4. **Vagas de skill:** nenhum dado nem aprendizado pode passar de `RARITIES[r].skillSlots`. → teste
   `data: skills ≤ vagas` (tarefa 1) e `learnSkill não estoura vagas` (tarefa 2).
5. **Sorte fora de 0–100** (itens futuros): a chance do segundo dado é limitada a [0, 1] e os dados a
   no máximo 3. → teste `rollDice limita` na tarefa 5.

---

### Task 0: Harness de testes unitários

**Files:**
- Create: `prototype/tools/sim-test.js`
- Modify: `scripts/check.sh` (nova etapa entre build e balanceamento), `.claude/settings.json` (allow),
  `CLAUDE.md` §4 (linha na tabela de comandos)

**Interfaces:**
- Produces: `test(name, fn)` e `section(title)` no topo de `sim-test.js`; `G = require('../src/data.js')`,
  `S = require('../src/sim.js')`; ao final imprime `N testes, F falhas` e `process.exit(F ? 1 : 0)`.
  Tarefas seguintes **acrescentam** testes a este arquivo, por seção.

- [ ] **Step 1: Escrever o runner com um teste que já passa hoje**

```js
// prototype/tools/sim-test.js — node prototype/tools/sim-test.js
'use strict';
var assert = require('assert');
var G = require('../src/data.js');
var S = require('../src/sim.js');
var fails = 0, count = 0, cur = '';
function section(t) { cur = t; console.log('\n## ' + t); }
function test(name, fn) {
  count++;
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { fails++; console.log('  FALHA ' + name + '\n       ' + (e.message || e)); }
}
section('pagamentos');
test('soma(prêmios)+taxa == pote', function () {
  var p = S.payouts(100, 8, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.strictEqual(p.prizes.reduce(function (a, x) { return a + x.amount; }, 0) + p.fee, p.pot);
});
console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
```

- [ ] **Step 2: Rodar**

Run: `node prototype/tools/sim-test.js`
Expected: `1 testes, 0 falhas`, exit 0.

- [ ] **Step 3: Encaixar no `check.sh`, nas permissões e no `CLAUDE.md`**

Em `scripts/check.sh`, nova etapa `"2/5 Testes unitários"` logo após o build: `node prototype/tools/sim-test.js > "$SHOTS_DIR/unit.txt" || { cat "$SHOTS_DIR/unit.txt"; exit 1; }` e `tail -n 1`; renumerar as etapas para `/5`.
Em `.claude/settings.json`, acrescentar `"Bash(node prototype/tools/sim-test.js)"` em `allow`.
No `CLAUDE.md` §4, linha `| Testes unitários da simulação | node prototype/tools/sim-test.js | 5 s |`.

- [ ] **Step 4: Commit**

```bash
git add prototype/tools/sim-test.js scripts/check.sh .claude/settings.json CLAUDE.md
git commit -m "Adiciona testes unitários da simulação ao check"
```

---

### Task 1: Modelo de dados v2 (`data.js`)

**Files:**
- Modify: `prototype/src/data.js` (inteiro: `ELEMENTS` l.20–57, `RARITIES` l.65–71, `STATS` l.73–79,
  `TACTICS` l.81–94, `WEATHERS` l.103–107, `DISTANCES` l.110–114, `SKILLS` l.125–200, `ITEMS` raridades,
  `horse()` l.270–277, `STARTERS`/`WILD_HORSES` l.279–384, `TRACK_EXAMPLES` l.428–439, export l.441–459)
- Test: `prototype/tools/sim-test.js`, seção `dados`

**Interfaces:**
- Produces (lidos por `sim.js` e `game.js`):
  - `GameData.STAT_KEYS = ['vel','acel','man','forca','est','garra','sorte']` e `STATS[k] = {id,name,short,desc}`
    com `man = {name:'Manobra', short:'MAN'}`, `sorte = {name:'Sorte', short:'SOR'}`.
  - `RARITIES[id] = { id, name, color, statCap, growth, skillSlots, bornSkills, skillChance, order }` com os
    valores da spec §4 (`comum 60/0.80/1/1/0.35`, `magico 70/0.90/2/1/0.45`, `raro 80/1.00/3/2/0.55`,
    `lendario 90/1.10/4/2/0.65`, `mitico 100/1.20/5/3/0.75`); cores: comum `#9e9e9e`, magico `#4caf50`,
    raro `#2196f3`, lendario `#ff9800`, mitico `#9c27b0`.
  - `ELEMENTS[id] = { id, name, color, icon, statBonus, weather, desc }` — **sem** `affinity`;
    `weather` = `'sol'` (fogo), `'chuva'` (agua), `'nevoa'` (grama), `null` (neutro).
  - `WEATHERS[id] = { id, name, icon, element, penalizes, desc }`: `sol {fogo, grama}`, `chuva {agua, fogo}`,
    `nevoa {name:'Névoa', icon:'fog', grama, agua}`, `nublado {null, null}`.
  - `BLOCK_TYPES = { reta: {id,name:'Reta',color:'#f6f2ea'}, curva: {name:'Curva',color:'#7ab8ff'}, subida: {name:'Subida',color:'#f2c230'} }`.
  - `SKILLS[id] = { id, name, element, trigger, exclusive?, desc, effect }` — catálogo abaixo.
  - Montaria (`horse()` renomeado para `mount()`, mesma assinatura + `sex`): `{ id, name, especie:'cavalo',
    element, rarity, sex:'m'|'f', level, xp, base{7}, potential{7}, skills[], palette, ... }`.
  - Removidos: `TACTICS`, `DISTANCES`, `TRACK_EXAMPLES` (e suas chaves no export).

**Catálogo de skills** (`trigger` → efeito; `effect` só com as chaves listadas):

| id | name | element | trigger | effect |
|---|---|---|---|---|
| `arranque` | Arranque | neutro | `start` | `{ accelMult: 1.3, distanceM: 100 }` |
| `sprint` | Sprint | neutro | `straight` | `{ speedMult: 1.04, drainMult: 1.15, distanceM: 150 }` |
| `drift` | Drift | neutro | `curve` | `{ curveBonus: 0.05, blockScoped: true }` (uma vez **por curva**) |
| `saida-rapida` | Saída Rápida | neutro | `curveExit` | `{ accelMult: 1.4, durationS: 4 }` |
| `casco-firme` | Casco Firme | grama | `hill` | `{ hillBonus: 0.06, blockScoped: true }` |
| `folego-de-montanha` | Fôlego de Montanha | neutro | `hill` | `{ hillDrainMult: 0.7, blockScoped: true }` |
| `segundo-ar` | Segundo Ar | neutro | `lowStamina` | `{ staminaRestore: 0.15 }` |
| `arrancada-final` | Arrancada Final | neutro | `final` | `{ garraChanceBonus: 0.15, garraBoostBonus: 0.03 }` |
| `dado-viciado` | Dado Viciado | neutro | `dice` | `{ extraDice: 1 }` |
| `sol-a-pino` | Sol a Pino | fogo | `weather:sol` | `{ weatherDouble: true }` |
| `pe-na-chuva` | Pé na Chuva | agua | `weather:chuva` | `{ weatherDouble: true }` |
| `nevoa-amiga` | Névoa Amiga | grama | `weather:nevoa` | `{ weatherDouble: true }` |
| `labareda` | Labareda | fogo, `exclusive:'brasa'` | `start` | `{ accelMult: 1.15, speedMult: 1.01, durationS: 5 }` |
| `mare-alta` | Maré Alta | agua, `exclusive:'mare'` | `lowStamina` | `{ staminaRestore: 0.20, speedMult: 1.03, durationS: 8 }` |
| `raizes-firmes` | Raízes Firmes | grama, `exclusive:'ipe'` | `straight` | `{ staminaRestore: 0.05, speedMult: 1.02, durationS: 8 }` |
| `chama-final` | Chama Final | fogo | `final` | `{ speedMult: 1.05, durationS: 5 }` |
| `canto-da-iara` | Canto da Iara | agua | `final` | `{ speedMult: 1.06, drainMult: 0.7, durationS: 5 }` |
| `nascente` | Nascente | agua | `straight` | `{ staminaRestore: 0.12 }` |

(`desc` em pt-BR descrevendo o efeito, como hoje. Removidos: `correnteza`, `casco-de-cabra`,
`trilha-de-terra`, `largada-rapida`, `segundo-folego`, `sprint-final`, `raca`.)

**Montarias:** iniciais com `sex` e os 7 status: Brasa `m`, base `{vel:64, acel:62, man:60, forca:52,
est:58, garra:62, sorte:50}`, pot `{22,24,18,14,12,18,14}`; Maré `f`, base `{62,54,54,56,70,58,50}`,
pot `{16,12,12,18,24,20,18}`; Ipê `m`, base `{62,56,50,68,60,54,50}`, pot `{16,14,12,24,18,18,14}`
(ordem vel, acel, man, forca, est, garra, sorte). Selvagens: raridade migrada (incomum→magico,
epico→lendario, lendario→mitico); `man = round((vel + acel)/2) − 4`, `sorte = 40 + 5·RARITIES[r].order`,
potenciais `man = round((pot.vel + pot.acel)/2)`, `sorte = 10 + 2·order`; `sex` alternado (`m` nos índices
pares). Skills: Pangaré `[]`, Faísca `['arranque']`, Lambari `[]`, Capim `['segundo-ar']`, Tição
`['chama-final']`, Garoa `['pe-na-chuva','segundo-ar']`, Mandacaru `['casco-firme']`, Ventania
`['sprint','arrancada-final']`, Pororoca `['nascente','pe-na-chuva']`, Fogaréu `['sol-a-pino','chama-final','arranque']`,
Jequitibá `['casco-firme','folego-de-montanha','segundo-ar']`, Boitatá `['sol-a-pino','chama-final','drift']`,
Iara `['canto-da-iara','pe-na-chuva','nascente']`. `ITEMS`: `incomum`→`magico`, `epico`→`lendario`,
`lendario`→`mitico` (só o campo `rarity`).

- [ ] **Step 1: Escrever os testes (seção `dados`)**

```js
section('dados');
test('7 atributos', function () { assert.deepStrictEqual(G.STAT_KEYS, ['vel','acel','man','forca','est','garra','sorte']); assert.strictEqual(Object.keys(G.STATS).length, 7); });
test('5 raridades com teto/vagas/chance', function () {
  assert.deepStrictEqual(Object.keys(G.RARITIES), ['comum','magico','raro','lendario','mitico']);
  assert.strictEqual(G.RARITIES.mitico.statCap, 100); assert.strictEqual(G.RARITIES.comum.skillSlots, 1);
  assert.strictEqual(G.RARITIES.raro.skillChance, 0.55); assert.strictEqual(G.RARITIES.lendario.bornSkills, 2);
});
test('climas e donos', function () {
  assert.deepStrictEqual(Object.keys(G.WEATHERS), ['sol','chuva','nevoa','nublado']);
  assert.strictEqual(G.WEATHERS.nevoa.element, 'grama'); assert.strictEqual(G.WEATHERS.nevoa.penalizes, 'agua');
  assert.strictEqual(G.ELEMENTS.agua.weather, 'chuva'); assert.strictEqual(G.ELEMENTS.fogo.affinity, undefined);
});
test('sem tática, distâncias fixas e pistas de exemplo', function () { assert.ok(!G.TACTICS && !G.DISTANCES && !G.TRACK_EXAMPLES); });
test('toda montaria tem 7 base + 7 potencial, sexo, raridade válida e skills ≤ vagas', function () {
  G.STARTERS.concat(G.WILD_HORSES).forEach(function (h) {
    G.STAT_KEYS.forEach(function (k) { assert.ok(h.base[k] >= 1 && h.base[k] <= 100, h.id + ' base ' + k); assert.ok(h.potential[k] >= 0 && h.potential[k] <= 31, h.id + ' pot ' + k); });
    assert.ok(h.sex === 'm' || h.sex === 'f', h.id + ' sexo'); assert.ok(G.RARITIES[h.rarity], h.id + ' raridade');
    assert.ok(h.skills.length <= G.RARITIES[h.rarity].skillSlots, h.id + ' vagas');
    h.skills.forEach(function (s) { assert.ok(G.SKILLS[s], h.id + ' skill ' + s); });
    assert.strictEqual(h.especie, 'cavalo');
  });
});
test('catálogo de skills', function () {
  ['arranque','sprint','drift','saida-rapida','casco-firme','folego-de-montanha','segundo-ar','arrancada-final','dado-viciado','sol-a-pino','pe-na-chuva','nevoa-amiga'].forEach(function (id) { assert.ok(G.SKILLS[id], id); });
  assert.strictEqual(G.SKILLS.drift.trigger, 'curve');
  assert.strictEqual(G.SKILLS['dado-viciado'].effect.extraDice, 1); assert.ok(!G.SKILLS.raca && !G.SKILLS.correnteza);
  Object.keys(G.ITEMS).forEach(function (id) { assert.ok(G.RARITIES[G.ITEMS[id].rarity], 'item ' + id); });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node prototype/tools/sim-test.js`
Expected: falhas em `7 atributos`, `5 raridades`, `climas`, `sem tática`, `toda montaria`, `catálogo`.

- [ ] **Step 3: Reescrever `data.js` conforme as Interfaces acima** (manter `BOT_NAMES`, `LEAGUES`,
  `ECONOMY`, `SURFACES`, `ITEMS` com mods, `palette`/`title`/`bio`/`habitat`/`lore`).

- [ ] **Step 4: Rodar e ver passar**

Run: `node prototype/tools/sim-test.js`
Expected: seção `dados` toda `ok`. (`sim.js` ainda carrega: `T.tactics` existe e `STAT_KEYS` dele é local.)

- [ ] **Step 5: Commit**

```bash
git add prototype/src/data.js prototype/tools/sim-test.js
git commit -m "Modelo de dados v2: 7 atributos, 5 raridades, climas donos e catálogo de skills"
```

---

### Task 2: Status, rating e chance de skill (`sim.js`)

**Files:**
- Modify: `prototype/src/sim.js` — `STAT_KEYS` l.84, `T.ratingW` l.136, `computeStats` l.209–227,
  `SKILL_TRIGGER_WEIGHT`/`skillWeight` l.233–240, `itemSpecialPoints` l.241–254 (remover o ramo
  `ignoreWeatherPenalty` que lê `affinity`), `powerRating` l.255–261, export l.727–744
- Test: `sim-test.js`, seção `status`

**Interfaces:**
- Consumes: `GameData.STAT_KEYS`, `RARITIES[r].skillChance`.
- Produces:
  - `computeStats(horse, itemId) -> { vel, acel, man, forca, est, garra, sorte }` (fórmula atual, 7 chaves).
  - `T.ratingW = { vel: 2.2, acel: 1.8, man: 1.6, est: 1.8, forca: 1.6, garra: 1.6, sorte: 0.8 }`;
    `SKILL_TRIGGER_WEIGHT = { start: 1, straight: 1, curve: 0.8, curveExit: 0.8, hill: 0.6, lowStamina: 0.8, final: 1, dice: 1 }`, `weather:*` = 0.4.
  - `skillChance(horse, stats) -> number` = `min(0.95, RARITIES[rarity].skillChance + 0.005·(level−1) + 0.001·stats.sorte)`;
    `T.skillPerLevel = 0.005`, `T.skillPerSorte = 0.001`, `T.skillChanceMax = 0.95`.
  - `learnSkill(mount, rng) -> string|null`: se `mount.skills.length >= skillSlots` → `null`; se `rng() >= T.learnChance (0.08)` → `null`;
    senão sorteia (com `rng`) uma skill de `SKILLS` que não seja exclusiva de outro (`!exclusive || exclusive === mount.id`),
    cujo `element` seja `'neutro'` ou o da montaria, e que ela ainda não tenha; retorna o id (não muta o mount).
  - Export: `skillChance`, `learnSkill`.

- [ ] **Step 1: Testes (seção `status`)**

```js
section('status');
test('computeStats devolve 7 chaves e respeita o teto da raridade', function () {
  var h = JSON.parse(JSON.stringify(G.STARTERS[0])); h.level = 50;
  var s = S.computeStats(h, null);
  assert.deepStrictEqual(Object.keys(s), G.STAT_KEYS);
  assert.ok(s.vel <= 80, 'raro teto 80'); assert.strictEqual(s.acel <= 88, true, 'teto + bônus de elemento 8');
});
test('skillChance: comum lv1 sorte 0 = 0.35; mítico lv50 sorte 100 = 0.95 (teto); raro lv10 sorte 50 ≈ 0.645', function () {
  var mk = function (r, lv, so) { return { rarity: r, level: lv }; };
  assert.strictEqual(S.skillChance(mk('comum', 1), { sorte: 0 }), 0.35);
  assert.strictEqual(S.skillChance(mk('mitico', 50), { sorte: 100 }), 0.95);
  assert.ok(Math.abs(S.skillChance(mk('raro', 10), { sorte: 50 }) - 0.645) < 1e-9);
});
test('powerRating usa os 7 pesos', function () {
  var h = JSON.parse(JSON.stringify(G.STARTERS[0])); var s = S.computeStats(h, null), w = S.TUNING.ratingW, sum = 0;
  G.STAT_KEYS.forEach(function (k) { sum += s[k] * w[k]; });
  assert.strictEqual(S.powerRating(h, null), Math.round(sum + 20 * 1));   // labareda: start = 1
});
test('learnSkill não estoura vagas e respeita elemento/exclusividade', function () {
  var full = { id: 'x', element: 'fogo', rarity: 'comum', skills: ['arranque'] };
  assert.strictEqual(S.learnSkill(full, function () { return 0; }), null);
  var m = { id: 'x', element: 'fogo', rarity: 'mitico', skills: [] }, seen = {};
  for (var i = 0; i < 400; i++) { var id = S.learnSkill(m, S.mulberry32(i)); if (id) seen[id] = 1; }
  assert.ok(seen.arranque && seen['sol-a-pino'], 'aprende neutras e do elemento');
  assert.ok(!seen['pe-na-chuva'] && !seen.labareda, 'não aprende de outro elemento nem exclusiva alheia');
});
```

- [ ] **Step 2: Rodar e ver falhar** — Expected: 4 falhas (`skillChance`/`learnSkill` indefinidos; `computeStats` sem `man`/`sorte`).

- [ ] **Step 3: Implementar** — `STAT_KEYS = GameData.STAT_KEYS`; pesos e funções conforme Interfaces;
  em `itemSpecialPoints` remover o ramo `ignoreWeatherPenalty` (o item Capa Impermeável passa a valer
  `8` pontos fixos se `sp.ignoreWeatherPenalty`).

- [ ] **Step 4: Rodar e ver passar** — Expected: seções `dados` e `status` `ok`.

- [ ] **Step 5: Commit** — `git commit -m "Simulação: 7 status, pesos do rating, chance e aprendizado de skill"`

---

### Task 3: Mapa aleatório em blocos (`sim.js`)

**Files:**
- Modify: `prototype/src/sim.js` — `DIST_LIST`/`randomConditions`/`normalizeConditions` l.274–310,
  `ruleMatches`/`elementAffinity` l.312–343 (remover), `inHill`/`hillFraction` l.381–394 (trocar por
  funções de bloco), export
- Test: `sim-test.js`, seção `mapa`

**Interfaces:**
- Produces:
  - `randomConditions(seed) -> { distance, surface, weather, blocks: [{ type, from, to }] }` conforme spec §6:
    RNG `mulberry32(hash2(seed, 0xC0FFEE))`; `distance = 1000 + 100·floor(rng()·15)`; `B = 5 + floor(rng()·5)`;
    pesos `0.5 + rng()`; comprimentos arredondados a 10 m, último fecha em `distance`; tipos: índices 0 e B−1
    `'reta'`, demais `['reta','curva','subida'][floor(rng()·3)]`; `surface` uniforme em `['grama','terra','areia']`;
    `weather` uniforme em `['sol','chuva','nevoa','nublado']`. Ordem das chamadas de `rng()`: distance, B, pesos
    (B chamadas), tipos (B−2 chamadas), surface, weather.
  - `normalizeConditions(c, seed)`: aceita `blocks` explícitos (valida contiguidade; se inválido ou ausente, usa os
    sorteados); sem seed → `{ 1600, 'grama', 'nublado', [reta 0–1600] }`. Campo `hills` **não** existe mais.
  - `blockAt(blocks, pos) -> index` (último bloco quando `pos >= distance`); `blockShare(blocks, type) -> fração 0–1 do comprimento`;
    `hillsFromBlocks(blocks) -> [[from,to], ...]` (só `subida`; usado pela UI para o relevo); `curvesFromBlocks(blocks)` idem para `curva`.
  - Export: `randomConditions`, `normalizeConditions`, `blockAt`, `blockShare`, `hillsFromBlocks`, `curvesFromBlocks`.
  - Removidos do export: `elementAffinity`.

- [ ] **Step 1: Testes (seção `mapa`)**

```js
section('mapa');
test('mapa é determinístico e bem formado', function () {
  for (var seed = 1; seed <= 500; seed++) {
    var c = S.randomConditions(seed), d = S.randomConditions(seed);
    assert.deepStrictEqual(c, d);
    assert.ok(c.distance >= 1000 && c.distance <= 2400 && c.distance % 100 === 0, 'distância');
    assert.ok(c.blocks.length >= 5 && c.blocks.length <= 9, 'nº de blocos');
    assert.strictEqual(c.blocks[0].type, 'reta'); assert.strictEqual(c.blocks[c.blocks.length - 1].type, 'reta');
    assert.strictEqual(c.blocks[0].from, 0); assert.strictEqual(c.blocks[c.blocks.length - 1].to, c.distance);
    c.blocks.forEach(function (b, i) { assert.ok(b.to > b.from && b.from % 10 === 0 && b.to % 10 === 0, 'bloco ' + i); if (i) assert.strictEqual(b.from, c.blocks[i - 1].to); });
    assert.ok(['sol','chuva','nevoa','nublado'].indexOf(c.weather) >= 0); assert.ok(G.SURFACES[c.surface]);
    assert.strictEqual(c.hills, undefined);
  }
});
test('os três tipos aparecem e blockShare/blockAt funcionam', function () {
  var seen = { reta: 0, curva: 0, subida: 0 };
  for (var s = 1; s <= 300; s++) S.randomConditions(s).blocks.forEach(function (b) { seen[b.type]++; });
  assert.ok(seen.curva > 100 && seen.subida > 100);
  var bl = [{ type: 'reta', from: 0, to: 200 }, { type: 'curva', from: 200, to: 1400 }, { type: 'reta', from: 1400, to: 1600 }];
  assert.strictEqual(S.blockShare(bl, 'curva'), 0.75); assert.strictEqual(S.blockAt(bl, 199.9), 0); assert.strictEqual(S.blockAt(bl, 200), 1); assert.strictEqual(S.blockAt(bl, 1600), 2);
  assert.deepStrictEqual(S.curvesFromBlocks(bl), [[200, 1400]]); assert.deepStrictEqual(S.hillsFromBlocks(bl), []);
});
test('normalizeConditions aceita blocos explícitos e completa o resto pela seed', function () {
  var c = S.normalizeConditions({ distance: 1600, blocks: [{ type: 'reta', from: 0, to: 1600 }] }, 7);
  assert.strictEqual(c.blocks.length, 1); assert.ok(G.WEATHERS[c.weather]);
  assert.strictEqual(S.elementAffinity, undefined);
});
```

- [ ] **Step 2: Rodar e ver falhar** — Expected: 3 falhas.
- [ ] **Step 3: Implementar** conforme Interfaces (remover `ruleMatches`, `elementAffinity`, `inHill`, `hillFraction`).
  `simulate` ainda referencia `cond.hills`/`elementAffinity`: **neste passo** substituir, em `buildRacer` e no laço,
  `elementAffinity(...)` por `{ mult: 1, reasons: [] }` e `inHill(cond.hills, pos)` por
  `cond.blocks[blockAt(cond.blocks, pos)].type === 'subida'`, `hillFraction(cond.hills, pos, D)` por
  fração de subida restante calculada sobre `blocks` — só para o arquivo continuar carregando; a física real vem na tarefa 4.
- [ ] **Step 4: Rodar e ver passar** — Expected: `mapa` `ok`; as seções anteriores continuam `ok`.
- [ ] **Step 5: Commit** — `git commit -m "Mapa aleatório em blocos (reta/curva/subida) derivado da seed"`

---

### Task 4: Física por bloco, clima e skills com chance (`sim.js`)

**Files:**
- Modify: `prototype/src/sim.js` — `T` l.87–140 (novas constantes; remover `formRange`, `tactics`,
  `hillSlow`, `forcaHillRelief`, `affinity*`), `buildRacer` l.405–443, `dispositionFor` l.446–452 (remover),
  `simulate` l.454–725 (laço inteiro), `racerInfo`
- Test: `sim-test.js`, seção `corrida`

**Interfaces:**
- Consumes: `blockAt`, `skillChance`, `GameData.WEATHERS/ELEMENTS/SKILLS/BLOCK_TYPES`.
- Produces:
  - `T` novas chaves: `curveBase: 0.82, curveRange: 0.15, hillBase: 0.85, hillRange: 0.12, hillDrain: 0.30,
    weatherMult: 1.05, weatherMultDouble: 1.10, weatherVel: 0.22, lowStaminaAt: 0.20, pace: { mid: 0.97, spurtStart: 0.72, spurtCap: 1.03 },
    draftSave: 0.10` (vácuo para todos).
  - `weatherMult(element, weather, doubled) -> number`: dono → `weatherMult` (ou `weatherMultDouble`); `WEATHERS[weather].penalizes === element` → `2 − weatherMult` (0,95); senão `1`. Exportada.
  - `simulate(config)`: `config.racers[i] = { horse, itemId, name, isPlayer }` (**sem** `tactic`);
    `result.conditions.blocks`; `result.events[]` ganha tipos `'clima'` (`{ t, racer: -1, type:'clima', weather, text }`,
    emitido na tarefa 5) além de `'skill' | 'garra' | 'cansou' | 'ultrapassagem' | 'chegada'`;
    `result.racerInfo[i] = { name, horseName, stats, skillChance }` (sem `tactic`, `affinity`, `form`, `disposicao`).
  - Corredor interno: `statsN` (status/100), `vMax/accel/nf/garraChance/garraBoost` recalculados por `applyWeather(r, weather)`:
    `m = weatherMult(el, weather, r.weatherDouble)`; `vMax = (vBase + vRange·n(vel)·m)·(1 + weatherVel·(m−1))`;
    `accel = aBase + aRange·n(acel)·m`; `nf = n(forca)·m`; `nm = n(man)·m`; `garraChance = clamp(base + range·n(garra)·m + bônus, 0, max)`.
    `pool` fixo (m = 1). `startDelay` e `jockeyErr` como hoje; **sem** `form`, **sem** `tac`.
  - Por tick, com `b = cond.blocks[blockAt(blocks, pos)]`: `fatorBloco = 1` (reta) · `min(1, curveBase + curveRange·nm + curveBonus)` (curva)
    · `min(1, hillBase + hillRange·nf + hillBonus)` (subida); em subida `drainMod *= 1 + hillDrain·(1 − 0.5·nf)·hillDrainMult`.
    `vTarget = s · vMax · speedMod · fatorBloco · boost · jitter` onde `speedMod` = piso (como hoje, com `forcaSurfRelief`) × chuva × pelotão.
    Ritmo único: `s = min(pace.mid, aff)` se `p < pace.spurtStart`, senão `min(pace.spurtCap, aff)`; `aff` como hoje com a
    fração de subida restante calculada sobre `blocks`. Vácuo: `drainMod *= 1 − draftSave` para qualquer corredor a 0,5–4 m atrás de outro.
  - Gatilhos: ao mudar `r.blockIdx` (checado **antes** de mover, com o bloco de `pos`): se o novo bloco é `curva` → `curve`;
    se saiu de `curva` → `curveExit`; se é `subida` → `hill`; se é `reta` e `idx > 0` → `straight`. `start` no primeiro tick;
    `final` em `p >= garraZone` (antes do sorteio de Garra); `lowStamina` em `stamina <= lowStaminaAt`; `weather:<id>` quando
    `cond.weatherAtual === id` (checado a cada tick); `dice` é consultado pela tarefa 5 (`extraDice`).
  - Disparo: `tryFire(r, id, t, blockTo)`: se `r.tried[id]` (ou, para `blockScoped`, `r.tried[id + '#' + blockIdx]`) → nada;
    marca tentado; se `r.rng() < r.skillChance` → aplica: `staminaRestore`; `garraChanceBonus/garraBoostBonus` somam em
    `r.garraChance/r.garraBoost`; `extraDice` soma em `r.extraDice`; `weatherDouble` seta `r.weatherDouble = true` e chama
    `applyWeather`; demais viram item em `r.effects`: `{ untilT: t + durationS | null, untilPos: pos + distanceM | blockTo (blockScoped) | null,
    speedMult, accelMult, drainMult, curveBonus, hillBonus, hillDrainMult }` (defaults 1/0). Evento `'skill'` como hoje.
  - Garra: `chance = r.garraChance` (sem bônus de tática); boost `r.garraBoost`.

- [ ] **Step 1: Testes (seção `corrida`)**

```js
section('corrida');
function mk(over) { var h = JSON.parse(JSON.stringify(G.WILD_HORSES[0])); h.rarity = 'mitico'; h.level = 1; h.element = 'neutro'; h.skills = [];
  G.STAT_KEYS.forEach(function (k) { h.base[k] = 60; h.potential[k] = 0; }); for (var k in over) h.base[k] = over[k]; return h; }
function race(seed, cond, horses) { return S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: horses.map(function (h, i) { return { horse: h, itemId: null, name: 'r' + i, isPlayer: i === 0 }; }) }); }
var CURVA = { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 200 }, { type: 'curva', from: 200, to: 1400 }, { type: 'reta', from: 1400, to: 1600 }] };
var RETA = { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 1600 }] };
var SUBIDA = { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 200 }, { type: 'subida', from: 200, to: 1400 }, { type: 'reta', from: 1400, to: 1600 }] };
test('determinismo: mesma seed, mesmo JSON; sem tactic/form na saída', function () {
  var a = race(42, S.randomConditions(42), [mk({}), mk({ vel: 90 })]), b = race(42, S.randomConditions(42), [mk({}), mk({ vel: 90 })]);
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); assert.strictEqual(a.racerInfo[0].tactic, undefined); assert.strictEqual(a.racerInfo[0].form, undefined);
});
test('especialista de curva vence o de reta em mapa 75% curva (≥ 55% de 80)', function () {
  var w = 0; for (var s = 0; s < 80; s++) if (race(s, CURVA, s % 2 ? [mk({ man: 90 }), mk({ vel: 90 })] : [mk({ vel: 90 }), mk({ man: 90 })]).finishOrder[0] === (s % 2 ? 0 : 1)) w++;
  assert.ok(w >= 44, 'curva venceu ' + w + '/80');
});
test('especialista de reta vence o de curva em reta pura; de subida vence em subida', function () {
  var w = 0, h = 0;
  for (var s = 0; s < 80; s++) { if (race(s, RETA, [mk({ vel: 90 }), mk({ man: 90 })]).finishOrder[0] === 0) w++; if (race(s, SUBIDA, [mk({ forca: 90 }), mk({ vel: 90 })]).finishOrder[0] === 0) h++; }
  assert.ok(w >= 44 && h >= 44, 'reta ' + w + ', subida ' + h);
});
test('weatherMult: dono 1.05, dobrado 1.10, penalizado 0.95, neutro 1', function () {
  assert.strictEqual(S.weatherMult('fogo', 'sol', false), 1.05); assert.strictEqual(S.weatherMult('fogo', 'sol', true), 1.10);
  assert.ok(Math.abs(S.weatherMult('grama', 'sol', false) - 0.95) < 1e-9); assert.strictEqual(S.weatherMult('agua', 'sol', false), 1); assert.strictEqual(S.weatherMult('neutro', 'chuva', false), 1);
});
test('skills disparam pela chance: mítico lv50 sorte 100 ativa Arranque ≥ 85% das vezes; comum lv1 sorte 0 ≤ 50%', function () {
  var hi = mk({ sorte: 100 }); hi.level = 50; hi.skills = ['arranque']; var lo = mk({ sorte: 0 }); lo.rarity = 'comum'; lo.skills = ['arranque'];
  var a = 0, b = 0; for (var s = 0; s < 200; s++) { if (race(s, RETA, [hi, mk({})]).events.some(function (e) { return e.type === 'skill' && e.racer === 0; })) a++; if (race(s, RETA, [lo, mk({})]).events.some(function (e) { return e.type === 'skill' && e.racer === 0; })) b++; }
  assert.ok(a >= 170 && b <= 100, 'alto ' + a + ', baixo ' + b);
});
test('sim: mapa com bloco de 10 m não duplica gatilhos', function () {
  var cond = { distance: 1000, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 300 }, { type: 'curva', from: 300, to: 310 }, { type: 'reta', from: 310, to: 1000 }] };
  var h = mk({ sorte: 100 }); h.level = 50; h.skills = ['drift', 'saida-rapida', 'sprint'];
  var ev = race(3, cond, [h, mk({})]).events.filter(function (e) { return e.type === 'skill' && e.racer === 0; }).map(function (e) { return e.text; });
  assert.ok(ev.length <= 3, ev.join(' | ')); assert.strictEqual(ev.filter(function (t) { return /Drift/.test(t); }).length <= 1, true);
});
```

- [ ] **Step 2: Rodar e ver falhar** — Expected: falhas (tactic ainda na saída; `weatherMult` indefinida; especialistas empatam).
- [ ] **Step 3: Implementar** conforme Interfaces. Sugestão de ordem: (a) remover `form`/`tactics`/`dispositionFor`,
  ritmo único; (b) `applyWeather` + `weatherMult`; (c) blocos e `fatorBloco`; (d) gatilhos por mudança de bloco e `tryFire`
  com chance; (e) `racerInfo`. Manter eventos `'ultrapassagem'`, `'cansou'`, `'chegada'` como estão.
- [ ] **Step 4: Rodar e ver passar** — Expected: todas as seções `ok`. Se o teste dos especialistas ficar abaixo de 44/80,
  ajustar `curveRange` (até 0,20) ou `hillRange` (até 0,15) e registrar no commit.
- [ ] **Step 5: Commit** — `git commit -m "Simulação v2: física por bloco, clima como triângulo, skills com chance, sem tática"`

---

### Task 5: Dado da Sorte (`sim.js`)

**Files:**
- Modify: `prototype/src/sim.js` — `simulate` (laço: antes do bloco "troca de liderança"), `T`, export
- Test: `sim-test.js`, seção `dado`

**Interfaces:**
- Produces:
  - `rollDice(rng, sorte, extraDice) -> { dice: [..], best }`: `d1 = 1 + floor(rng()·100)`; `p = clamp(sorte/100, 0, 1)`;
    se `rng() < p` rola `d2`; `extraDice` (limitado a 1) rola mais um dado garantido — no máximo 3 dados; `best = max`. Ordem de `rng()`:
    d1, sorteio do 2º dado, d2 (se houver), dados extras. Exportada.
  - `T.diceAt = [1/3, 2/3]`; RNG `mulberry32(hash2(seed, 0xD1CE))` criado em `simulate`.
  - No laço, após mover todos: enquanto `diceIdx < diceAt.length` e `max(pos) >= diceAt[diceIdx]·D`: para `i = 0..n−1` (todos,
    inclusive quem já chegou) `rollDice(diceRng, stats.sorte, r.extraDice)`; vencedor = maior `best`; empate → re-rola só os
    empatados (mesma função) até decidir; `novo = ELEMENTS[vencedor.element].weather || cond.weatherAtual`; `changed = novo !== atual`;
    se mudou: `cond.weatherAtual = novo`, `applyWeather` em todos, evento `'clima'` `{ t, racer: -1, weather: novo, text: 'O clima virou: ' + WEATHERS[novo].name + '!' }`;
    sempre: evento `'dado'` `{ t, racer: vencedor, type: 'dado', at: diceAt[diceIdx], rolls: [{ racer, dice, best }], winner, weather: cond.weatherAtual, changed, text }`,
    `text` = `'🎲 ' + label + ' tirou ' + best + (changed ? ' — ' + fraseDoClima : ' — o clima segura!')`, com frases:
    sol `'o sol abre!'`, chuva `'começa a chover!'`, nevoa `'a névoa desce!'`.
  - `result.conditions.weather` = clima **inicial**; `result.weatherFinal` = clima ao final; frames **não** mudam.

- [ ] **Step 1: Testes (seção `dado`)**

```js
section('dado');
test('rollDice: sorte 0 = 1 dado em 1..100; sorte 100 = 2 dados; média do melhor sobe', function () {
  var rng = S.mulberry32(9), sum0 = 0, sum100 = 0;
  for (var i = 0; i < 5000; i++) { var a = S.rollDice(rng, 0, 0); assert.strictEqual(a.dice.length, 1); assert.ok(a.best >= 1 && a.best <= 100); sum0 += a.best; }
  for (i = 0; i < 5000; i++) { var b = S.rollDice(rng, 100, 0); assert.strictEqual(b.dice.length, 2); sum100 += b.best; }
  assert.ok(sum0 / 5000 > 48 && sum0 / 5000 < 53); assert.ok(sum100 / 5000 > 64 && sum100 / 5000 < 70);
});
test('rollDice limita: sorte 250 → 2 dados; extraDice 5 → no máximo 3 dados', function () {
  var r = S.rollDice(S.mulberry32(1), 250, 5); assert.ok(r.dice.length <= 3 && r.dice.length >= 2);
});
test('Sorte 100 contra sete de Sorte 0 vence o dado 18–28%', function () {
  var rng = S.mulberry32(77), w = 0, N = 4000;
  for (var i = 0; i < N; i++) { var me = S.rollDice(rng, 100, 0).best, top = 0; for (var j = 0; j < 7; j++) top = Math.max(top, S.rollDice(rng, 0, 0).best); if (me > top) w++; }
  var p = 100 * w / N; assert.ok(p >= 18 && p <= 28, p + '%');
});
test('corrida tem 2 eventos dado (1/3 e 2/3) e o clima vira para o elemento do vencedor', function () {
  var hs = [mk({}), mk({}), mk({})]; hs[0].element = 'fogo'; hs[1].element = 'agua'; hs[2].element = 'grama';
  var res = race(5, S.randomConditions(5), hs), ds = res.events.filter(function (e) { return e.type === 'dado'; });
  assert.strictEqual(ds.length, 2); assert.ok(Math.abs(ds[0].at - 1 / 3) < 1e-9 && Math.abs(ds[1].at - 2 / 3) < 1e-9);
  ds.forEach(function (d) { assert.strictEqual(d.rolls.length, 3); var w = d.rolls[d.winner]; d.rolls.forEach(function (r) { assert.ok(r.best <= w.best); });
    assert.strictEqual(d.weather, G.ELEMENTS[hs[d.winner].element].weather); });
  assert.ok(/🎲/.test(ds[0].text));
});
test('dado: clima segura quando todos são do mesmo elemento', function () {
  var hs = [mk({}), mk({})]; hs[0].element = hs[1].element = 'agua';
  var res = race(8, { distance: 1200, surface: 'grama', weather: 'chuva', blocks: [{ type: 'reta', from: 0, to: 1200 }] }, hs);
  res.events.filter(function (e) { return e.type === 'dado'; }).forEach(function (d) { assert.strictEqual(d.changed, false); assert.strictEqual(d.weather, 'chuva'); });
  assert.strictEqual(res.events.filter(function (e) { return e.type === 'clima'; }).length, 0); assert.strictEqual(res.weatherFinal, 'chuva');
});
```

- [ ] **Step 2: Rodar e ver falhar** — Expected: 5 falhas.
- [ ] **Step 3: Implementar** conforme Interfaces (o `applyWeather` da tarefa 4 já recalcula vMax/accel/nf/garra).
- [ ] **Step 4: Rodar e ver passar** — Expected: todas as seções `ok`.
- [ ] **Step 5: Commit** — `git commit -m "Dado da Sorte: rolagem com viés de Sorte a 1/3 e 2/3 e virada de clima"`

---

### Task 6a: Telas — estábulo, sala e estado (`game.js`, `ui-test.mjs`)

**Files:**
- Modify: `prototype/src/game.js` — constantes l.29–40 (`SAVE_KEY` **continua** `'galope-elemental:v1'` para o save antigo ser lido e migrado; remover `TACTIC_IDS`),
  `newState`/`sanitize` l.187–234, `playerHorse` l.236–242, `statsHtml`/`modsText` l.383–401, `affinityLabel` l.402–413 (remover),
  `tacticName`/`tacticOptionsHtml`/`strategyHtml` l.422–461, `renderEstabulo` l.559–632 (texto da entrada e seletor),
  `buildLobby` l.673–743, `refreshPlayerEntry` l.745–748, `conditionChips`/`strategyTips`/`affinityHints`/`racerRow`/`renderLargada`/
  `drawProfileCanvas` l.753–890, `settle` l.895–943, handler de clique l.1530–1580 (`case 'tatica'` sai), `game.css` (classes `.mapa-blocos`)
- Modify: `prototype/tools/ui-test.mjs` l.127–131, l.180–184, l.198–201 (sem tática) + novos passos
- Test: `node prototype/build.mjs && node prototype/tools/ui-test.mjs`

**Interfaces:**
- Consumes: `RS.randomConditions`, `RS.hillsFromBlocks`, `RS.curvesFromBlocks`, `RS.blockShare`, `RS.learnSkill`, `RS.skillChance`, `RS.weatherMult`, `GD.BLOCK_TYPES`.
- Produces:
  - `state` (save v2): `{ v: 2, rev, starterId, level, xp, gold, inventory, equipped, skills: [ids], tier, seedBase, raceCounter, pending, races, wins, podiums, goldWon }` — sem `tactic`.
    `sanitize`: ignora `tactic`; `skills` = ids válidos para o inicial (`learnSkill` regras) limitados a `skillSlots`; se ausente/vazio → skills do `STARTERS[idx]`.
    `playerHorse()` devolve o inicial clonado com `skills = state.skills` e `level/xp` do estado.
  - `buildLobby(P)`: `cond = RS.randomConditions(seed)` **sem** `TRACK_EXAMPLES`; `trackName = pick(TRACK_NAMES, rng)`;
    lobby ganha `cond.hills = RS.hillsFromBlocks(cond.blocks)` e `cond.curves = RS.curvesFromBlocks(cond.blocks)` (só UI).
    Entradas dos corredores sem `tactic`.
  - `settle(L)`: após o laço de níveis, para cada nível ganho `k` (1..levels): `id = RS.learnSkill(playerHorse(), RS.mulberry32(RS.hash2(state.seedBase, state.raceCounter * 100 + state.level - levels + k)))`;
    se `id` → `state.skills.push(id)`. Resultado ganha `learned: [ids]`.
  - UI: `statsHtml` itera `STAT_KEYS` (7; ícones novos `man` e `sorte` em `statIcon`, qualquer glifo existente serve);
    `conditionChips(cond)`: chips `Distância (D m)`, `Piso`, `Clima inicial`, `Traçado: X% reta · Y% curva · Z% subida` (percentuais inteiros de `blockShare`);
    `drawProfileCanvas`: faixa colorida por bloco com `BLOCK_TYPES[type].color`, relevo nas subidas como hoje (via `cond.hills`), rótulo `CURVA` sobre curvas;
    `climaHints(L)` substitui `affinityHints`: linha com o efeito do clima inicial no seu elemento (`RS.weatherMult` → `+5%`/`−5%`/`neutro`) e a frase
    `'Dado da Sorte a 1/3 e 2/3 da pista: quem tira o maior dado puxa o clima para o seu elemento. Sua Sorte: N% de rolar dois dados.'`;
    `strategyTips(L)`: dicas por traçado (`curva ≥ 40%` → Manobra; `subida ≥ 30%` → Força; `D ≥ 2000` → Estamina) e por clima;
    `strategyHtml` só com item; `racerRow` sem tática; texto da entrada no estábulo inalterado.
- `ui-test.mjs`: remover os cliques de tática (l.128, l.131 passa a checar só o item, l.182 vira clique em `'Sem item'`, l.200 sai);
  após `#t-largada` (l.116): `blocks = lobby.cond.blocks.length` em 5–9 e `document.querySelector('.perfil')` existe;
  **save antigo**: novo contexto que, antes do `goto`, faz `addInitScript` gravando em `localStorage['galope-elemental:v1']`
  `{"v":1,"rev":3,"starterId":"mare","level":4,"xp":10,"gold":777,"inventory":["sela-couro"],"equipped":null,"tactic":"ponteiro","tier":50,"seedBase":123,"raceCounter":2,"pending":null,"races":2,"wins":1,"podiums":1,"goldWon":100}`
  e verifica, no estábulo, `state.gold === 777`, `state.tactic === undefined`, `state.skills` = `['mare-alta']`.

- [ ] **Step 1: Atualizar `ui-test.mjs`** (passos acima) e rodar `node prototype/build.mjs && node prototype/tools/ui-test.mjs`.
  Expected: FALHA (tática ainda existe; `lobby.cond.blocks` indefinido; `#t-largada` pode nem abrir porque `buildLobby` usa `TRACK_EXAMPLES`).
- [ ] **Step 2: Implementar `game.js` conforme Interfaces** (a tela de corrida continua usando `L.cond.hills` derivado — não quebra).
- [ ] **Step 3: Build + ui-test** — Expected: `OK: fluxo completo ...`. Capturas vão para `$SHOTS_DIR` se definido; sem ele, sobrescrevem
  `prototype/screens/` — **não commitar capturas nesta tarefa** (`git checkout -- prototype/screens`).
- [ ] **Step 4: Commit** — `git add prototype/src prototype/dist prototype/tools/ui-test.mjs && git commit -m "Telas: sala com mapa em blocos, 7 status, aprendizado de skill e save v2 sem tática"`

---

### Task 6b: Telas — corrida e resultado (`game.js`, `sprites.js`)

**Files:**
- Modify: `prototype/src/game.js` — `renderCorrida` l.948–968 (texto das condições por traçado), `createRaceView` l.970–1445
  (`hills = L.cond.hills`, `curves = L.cond.curves`; HUD l.1197–1206: rótulo `▲SUBIDA` ou `↪CURVA` pelo bloco do jogador;
  barra de progresso l.1208–1216: pintar curvas com `C.linha` mais claro e subidas como hoje; `draw` l.1246–1250: passar
  `weather: climaAtual(simT)` e `curves`; `boosts` l.1004–1015: evento `'dado'` com `changed` gera flash de clima);
  `renderResultado` l.1446–1520 (linhas sem tática/forma; nota do rodapé vira `'🎲 Dado da Sorte: a 1/3 e 2/3 da pista o maior dado puxa o clima.'`;
  bloco `Skills aprendidas` quando `R.learned.length`; lista dos eventos `dado`/`clima` da corrida)
- Modify: `prototype/src/sprites.js` — `surfaceTile` l.1141/1186 e `drawTrack` l.1316–1553 (tratar `'nevoa'` como `'nublado'` nas cores),
  `drawWeather` l.1573–1620 (`nevoa`: 3 faixas horizontais `rgba(230,236,240,0.18)` que deslizam com `t`),
  `drawTrack`: após o laço de subidas (l.1411–1432) o mesmo laço para `o.curves || []` com tinta `rgba(30,60,120,0.18)` e setas `↪` a cada 40·P;
  placas `CURVA` como as de `SUBIDA` (l.1487–1500) em `#7ab8ff`.
- Test: `node prototype/build.mjs && node prototype/tools/ui-test.mjs` (+ novos passos abaixo)

**Interfaces:**
- Consumes: `sim.events` com `'dado'`/`'clima'`; `L.cond.hills/curves`; `sim.weatherFinal`.
- Produces: `climaAtual(simT)` em `createRaceView`: percorre os eventos `'clima'` com `t <= simT` e devolve o último `weather`
  (inicial `L.cond.weather`). O feed já mostra os eventos (`feedEvents` concatena `sim.events`): nada a fazer além do texto.
- `ui-test.mjs`: após clicar `x2` (l.150), antes de esperar o resultado:
  `await page.waitForFunction(() => /🎲/.test(document.getElementById('feed').textContent), null, { timeout: 90000 })`;
  no resultado: `sim.events.filter(e => e.type === 'dado').length === 2`; tabela sem a palavra `forma`.

- [ ] **Step 1: Acrescentar os passos ao `ui-test.mjs`**, build e rodar. Expected: FALHA em `🎲` ou nos eventos.
- [ ] **Step 2: Implementar `game.js`/`sprites.js`** conforme Interfaces.
- [ ] **Step 3: Build + ui-test** — Expected: `OK`. Reverter capturas (`git checkout -- prototype/screens`).
- [ ] **Step 4: Commit** — `git commit -m "Corrida e resultado: curvas na pista, clima que vira, feed do Dado da Sorte"`

---

### Task 7: Metas de balanceamento v2 (`balance.js`)

**Files:**
- Modify: `prototype/tools/balance.js` (reescrever as seções 1–7 e `exemplo()`; manter runner, `check`, `--quick`, `--tune`, `--exemplo`)
- Test: `node prototype/tools/balance.js --quick` (exit 0)

**Interfaces:**
- Consumes: `S.randomConditions`, `S.simulate` (sem `tactic`), `S.rollDice`, `S.blockShare`, `G.RARITIES` (ids novos).
- Produces (metas, ids e faixas exatamente estes; `N` com `n()` como hoje):
  - `1` Iniciais lv1 e lv25, mapas aleatórios: `check('1', nome + ' lv1'|' lv25', %, 28, 39)` (N 6000 / 3000).
  - `2` Clima do elemento fixo: condições `{ distance: 1600, surface: 'grama', weather: ELEMENTS[el].weather, blocks: [reta 0–1600] }` e corredores só dos 3 iniciais;
    para isolar do Dado, `--tune` interno `S.TUNING.diceAt = []` durante a seção e restaurar depois: `check('2', nome + ' no seu clima', %, 45, 65)` (N 3000).
  - `3` Especialistas (montarias sintéticas: `mitico`, lv1, `neutro`, base 60 e um atributo 90): `3` curva×reta em `CURVA` (75% curva), `3b` reta×curva em `RETA`,
    `3c` subida×reta em `SUBIDA` (mapas da tarefa 4): `check('3'|'3b'|'3c', ..., %, 55, 75)` (N 2000, largada alternada).
  - `4a` `mitico lv1 × comum lv1` média: 75–92; `4b` `comum lv25 × raro lv1`: 35–65 (filtros por `rarity === 'mitico'` etc.).
  - `5` Duração: iniciais e PVP 8 em mapas aleatórios agrupados por `distance <= 1200` (meta 55–70 s, rótulo `'curta (≤1200 m)'`) e `>= 2200` (140–170 s, `'longa (≥2200 m)'`).
  - `6` Pagamentos: como hoje + `prizes não crescentes`.
  - `7` Dado: `S.rollDice` 4000× (Sorte 100 vs 7× Sorte 0): 18–28 (`unit '%'`).
  - `8` Viradas de clima por corrida (PVP 8 com elementos sorteados entre os 3): média 0,8–1,6 (`unit ''`).
  - `9` Determinismo: 25 configs com itens e mapas aleatórios (sem `TRACK_EXAMPLES`) + frames válidos; seeds diferentes ⇒ corridas diferentes.
  - `10` Chance de skill: para cada raridade, montaria sintética lv1 sorte 50 com `['arranque']`, 2000 corridas em `RETA`: `|observado − skillChance| ≤ 3 p.p.`.
  - `exemplo()`: mapa `S.randomConditions(20261119)`, campo com os iniciais lv6 e 5 selvagens, tabela com os 7 status e coluna `Sorte`;
    lista de eventos incluindo `dado`/`clima`.
  - Relatório: título `## Relatório de balanceamento v2`, tabela "Outros números" ganha `Viradas de clima por corrida` e `Skills tentadas/ativadas`.
  - `LEAGUES` em `data.js`: `min` = `0, 660, 840, 960, 1080, 1200` (escala 1,2× pela soma dos pesos), ajustar se os iniciais lv1 não caírem em Prata.

- [ ] **Step 1: Reescrever `balance.js`** conforme Interfaces e rodar `node prototype/tools/balance.js --quick`.
  Expected: relatório impresso; provavelmente algumas metas ❌ (durações com curva; raridade com tetos novos).
- [ ] **Step 2: Calibrar**, só nestes botões e nestes limites, até `--quick` passar: `curveBase` 0,80–0,86, `curveRange` 0,12–0,20,
  `hillBase` 0,83–0,88, `hillRange` 0,10–0,15, `weatherMult` 1,04–1,07, `vBase` 16,5–17,5, `growthBase/growthPot` ±0,05, `LEAGUES.min`.
  Nunca mexer nas faixas das metas. Anotar cada mudança na mensagem de commit.
- [ ] **Step 3: Rodar completo** `node prototype/tools/balance.js > /tmp/claude-0/-home-user-mmorpgHorse/e2044d4a-eb72-5932-b67c-8a4ae9d3d691/scratchpad/balance-v2.md`
  Expected: `**Todas as N metas passaram.**`, tempo ≤ 2 min.
- [ ] **Step 4: Commit** — `git add prototype/tools/balance.js prototype/src && git commit -m "Balanceamento v2: metas por traçado, clima, dado e chance de skill"`

---

### Task 8: Documentação e exemplos

**Files:**
- Modify: `docs/GDD.md` §3 (tabela com os 7 atributos + raridades novas + Sorte; sem Tática; Potencial e Level mantidos),
  §4 (triângulo só pelo clima, tabela dos 4 climas, Dado da Sorte, mapa em blocos — texto curto, remete à spec),
  §5 inalterado; `docs/exemplos.md` (§1 e §3 com colunas MAN/SOR e sexo; §4 raridades novas; §7 "Táticas" → "Dado da Sorte e clima";
  §8 ligas recalibradas; §10 regenerado com `node prototype/tools/balance.js --exemplo`; §11 substituído pelo relatório completo da tarefa 7;
  §12 "Para revisar" reescrito com o que o relatório mostrar); `CLAUDE.md` §1 ("Fórmulas da simulação" continua), §8 (acrescentar
  "Dado da Sorte e clima só com a RNG da seed"); `prototype/src/sim.js` cabeçalho (comentário do modelo reescrito para v2).
- Test: `./scripts/check.sh`

- [ ] **Step 1: Reescrever o cabeçalho de `sim.js`** (comentário l.1–79) descrevendo o modelo v2 nos mesmos moldes (fórmulas por extenso).
- [ ] **Step 2: Atualizar `docs/GDD.md` §3–4, `docs/exemplos.md`, `CLAUDE.md`** conforme Files.
- [ ] **Step 3: `./scripts/check.sh`** — Expected: `VERIFICAÇÃO COMPLETA: OK` (5 etapas).
- [ ] **Step 4: Commit** — `git commit -m "Documenta o núcleo v2: GDD §3–4, exemplos e cabeçalho da simulação"`

---

### Task 9: Capturas, memória e entrega

**Files:**
- Modify: `prototype/screens/*.png` (regenerar), `docs/memoria/ESTADO.md`, `docs/memoria/decisoes.md`

- [ ] **Step 1: Regenerar capturas oficiais** — `node prototype/tools/ui-test.mjs` (sem `SHOTS_DIR`); conferir visualmente
  `final-03-largada.png` (mapa em blocos) e `final-04-corrida.png` (curva/clima) com o Read de imagem.
- [ ] **Step 2: Memória** — `ESTADO.md`: subprojeto 1 **concluído** na branch, próximos passos (revisão do Vinicius → integração na `main` → subprojeto 2);
  `decisoes.md` (data do dia): ajustes de calibração feitos na tarefa 7 e qualquer desvio da spec.
- [ ] **Step 3: `./scripts/check.sh`** — Expected: OK.
- [ ] **Step 4: Commit e push** — `git add -A && git commit -m "Núcleo v2: capturas e memória do projeto" && git push -u origin claude/nucleo-corrida-v2`
- [ ] **Step 5: Entregar** — relatar ao Vinicius: metas (tabela final do relatório), o que foi calibrado, e pedir revisão antes de integrar na `main`.
