# Equipamentos — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set de 5 peças por montaria, inventário compartilhado, melhoria +0…+10 com Pedra Negra, conjuntos por clima, loja e Pedra Negra no pódio, tudo determinístico pela seed.

**Architecture:** Novo módulo puro `prototype/src/gear.js` (UMD, como `breed.js`) resolve o equipamento de uma montaria em `{ mods, special, set, pieces }`, rola melhoria e prêmio de pódio e gera o equipamento dos bots. `sim.js` troca o parâmetro `itemId` pelo objeto resolvido (`gear`) em `computeStats`, `powerRating` e nas entradas de `simulate`. `game.js` ganha save v4 (`items[]`, `equip` por montaria, `pedras`), migração v3→v4, telas Equipamento e Loja, trava parcial com páreo aberto e prêmio de pedra na liquidação.

**Tech Stack:** HTML/CSS/JS puro, ES5 em `prototype/src/` (`var`/`function`; nada de `const`/`let`/arrow/template string/`includes`/`find`/`Set`), Node para testes (`sim-test.js`, `balance.js`), Playwright pré-instalado (`ui-test.mjs`), build por concatenação (`node prototype/build.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-06-equipamentos-design.md` (autoridade; os números abaixo vêm dela).

## Global Constraints

- Responder, comentar e commitar em **português**; mensagem de commit no imperativo; trailer em todo commit:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01MGExzKELAJ58uyj4wakVgJ`.
- `prototype/src/*.js` em ES5 estrito (ver Tech Stack). Ferramentas em `prototype/tools/` podem usar ES moderno.
- Sem dependências novas. Nunca editar `prototype/dist/` à mão: `node prototype/build.mjs` e commitar `dist/` junto com `src/`.
- Determinismo: melhoria e prêmio de pódio só com `RaceSim.mulberry32(RaceSim.hash2(...))`; nunca `Math.random`. A ordem das chamadas de `rng` por corredor em `sim.js` não muda.
- Resultado nunca antes de pagar: melhoria debita pedras e avança o contador antes de mostrar o resultado; sala não é re-sorteada de graça.
- `sanitize` nunca toca no Ouro; tudo inválido é descartado em silêncio. Toda string vinda de save/entrada passa por `esc()`.
- Chave do save continua `galope-elemental:v1`. `Breed.foal` e os 3 potros dourados do `sim-test` não mudam.
- Antes de dizer que terminou uma tarefa: os testes da tarefa passam; na última tarefa, `./scripts/check.sh` termina em `VERIFICAÇÃO COMPLETA: OK`.

## Review Focus

1. Save v4 com a mesma peça (`uid`) em `equip` de duas montarias: a primeira na ordem de `mounts` fica com ela, a segunda perde a referência (teste na Task 4, fixture `BAD_V4`).
2. Dois cliques rápidos em "Tentar" na melhoria: cada clique é uma tentativa inteira (pedras debitadas, contador +1, resultado), nunca uma tentativa com débito dobrado nem débito sem sorteio (Task 5: o teste faz 3 tentativas seguidas e confere pedras e contador).
3. Vender só existe para peça **não equipada**; "Desfazer" some ao sair da tela e nunca devolve uma peça duas vezes (Task 5: teste vende, desfaz, sai e volta: sem botão Desfazer).
4. Páreo aberto: equipar peça que suba o rating acima de `pending.pr` é bloqueado; trocar por outra de rating igual ou menor é permitido (Task 5: teste com Lendária bloqueada e Comum liberada).
5. Comprar com Ouro insuficiente: botão desabilitado **e** o handler recusa (Task 6: teste tenta comprar via `state.gold = 10` e confere que nada muda).

---

### Task 1: Catálogo de peças e economia do equipamento (`data.js`)

**Files:**
- Modify: `prototype/src/data.js` (depois de `BREED_LEFT`, linha ~441; `ECONOMY`, linha ~443; exports `GameData`, linha ~475)
- Test: `prototype/tools/sim-test.js` (nova seção `equipamento: catálogo`, antes do `console.log` final)

**Interfaces:**
- Produces: `GameData.GEAR_SLOTS = ['ferraduras','sela','estribos','testeira','armadura']`;
  `GameData.GEAR_SLOT_INFO[slot] = { name, main: statKey, sub: statKey }`;
  `GameData.GEAR_SETS = { sol: { id:'sol', name:'Sol', weather:'sol', suffix:'do Sol' }, chuva: {…,'da Chuva'}, nevoa: {…,'da Névoa'} }`;
  `GameData.GEAR[id] = { id, name, slot, rarity, set: null|'sol'|'chuva'|'nevoa', main: n, sub: n, price: n, shop: bool }`;
  `GameData.ECONOMY.gear` (spec §3.3). `GameData.ITEMS` **continua existindo até a Task 4**.

- [ ] **Step 1: Escrever os testes que falham**

```js
section('equipamento: catálogo');
test('5 slots com status principal e secundário', function () {
  assert.deepStrictEqual(G.GEAR_SLOTS, ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura']);
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.ferraduras, { name: 'Ferraduras', main: 'vel', sub: 'acel' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.sela, { name: 'Sela', main: 'est', sub: 'garra' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.estribos, { name: 'Estribos', main: 'man', sub: 'sorte' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.testeira, { name: 'Testeira', main: 'acel', sub: 'garra' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.armadura, { name: 'Armadura', main: 'forca', sub: 'est' });
  assert.deepStrictEqual(Object.keys(G.GEAR_SETS), ['sol', 'chuva', 'nevoa']);
  assert.strictEqual(G.GEAR_SETS.nevoa.weather, 'nevoa');
});
test('40 peças, 25 à venda, ids e nomes', function () {
  var ids = Object.keys(G.GEAR);
  assert.strictEqual(ids.length, 40);
  assert.strictEqual(ids.filter(function (id) { return G.GEAR[id].shop; }).length, 25);
  ids.forEach(function (id) {
    var p = G.GEAR[id];
    assert.strictEqual(p.id, id);
    assert.ok(/^(ferraduras|sela|estribos|testeira|armadura)(-(sol|chuva|nevoa))?-(comum|magico|raro|lendario)$/.test(id), id);
    assert.ok(G.GEAR_SLOTS.indexOf(p.slot) >= 0 && G.RARITIES[p.rarity], id);
    if (p.set) assert.ok(p.rarity === 'raro' || p.rarity === 'lendario', id + ' conjunto só Raro/Lendário');
    else assert.ok(p.rarity === 'comum' || p.rarity === 'magico', id + ' solta só Comum/Mágico');
    assert.strictEqual(p.shop, p.rarity !== 'lendario');
  });
  assert.deepStrictEqual(G.GEAR['sela-sol-raro'], { id: 'sela-sol-raro', name: 'Sela do Sol', slot: 'sela', rarity: 'raro', set: 'sol', main: 4, sub: 3, price: 600, shop: true });
  assert.deepStrictEqual(G.GEAR['ferraduras-comum'], { id: 'ferraduras-comum', name: 'Ferradura Leve', slot: 'ferraduras', rarity: 'comum', set: null, main: 2, sub: 0, price: 100, shop: true });
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].name, 'Armadura da Chuva');
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].main, 6);
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].sub, 4);
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].price, 1500);
  assert.strictEqual(G.GEAR['estribos-magico'].name, 'Esporas de Prata');
  assert.strictEqual(G.GEAR['estribos-magico'].sub, 2);
  assert.strictEqual(G.GEAR['testeira-nevoa-raro'].name, 'Testeira da Névoa');
});
test('ECONOMY.gear', function () {
  var g = G.ECONOMY.gear;
  assert.deepStrictEqual(g.price, { comum: 100, magico: 250, raro: 600, lendario: 1500 });
  assert.strictEqual(g.sellRate, 0.25); assert.strictEqual(g.stonePrice, 40); assert.strictEqual(g.stoneBundle, 5);
  assert.deepStrictEqual(g.main, { comum: 2, magico: 3, raro: 4, lendario: 6 });
  assert.deepStrictEqual(g.sub, { comum: 0, magico: 2, raro: 3, lendario: 4 });
  assert.strictEqual(g.plusMax, 10);
  assert.deepStrictEqual(g.enhanceChance, [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25]);
  assert.deepStrictEqual(g.enhanceCost, [1, 1, 1, 1, 1, 1, 2, 2, 2, 2]);
  assert.strictEqual(g.enhanceDropFrom, 6);
  assert.deepStrictEqual(g.setBonus, { pieces: [3, 4, 5], skillChance: 0.05, sorte: 5, ratingPts: [10, 15, 20] });
  assert.deepStrictEqual(g.podiumStone, [0.6, 0.4, 0.25]);
  assert.deepStrictEqual(g.startGear, ['sela-comum', 'ferraduras-comum']);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node prototype/tools/sim-test.js 2>&1 | tail -6`
Expected: `3 falhas` (as três novas) — `G.GEAR_SLOTS` indefinido.

- [ ] **Step 3: Implementar em `data.js`**

Depois de `BREED_LEFT`: `GEAR_SLOTS`, `GEAR_SLOT_INFO`, `GEAR_SETS` e o catálogo `GEAR` gerado por laço:
nomes soltos por slot `{ ferraduras: ['Ferradura Leve', 'Ferradura com Cravos'], sela: ['Sela de Couro Cru', 'Sela Acolchoada'], estribos: ['Estribos de Corda', 'Esporas de Prata'], testeira: ['Antolhos', 'Testeira de Couro'], armadura: ['Manta de Lã', 'Capa Impermeável'] }`
(índice 0 = comum, 1 = magico); peça de conjunto = `GEAR_SLOT_INFO[slot].name + ' ' + set.suffix`, raridades
`raro` e `lendario`, para cada conjunto na ordem sol/chuva/nevoa. `main`/`sub`/`price` lidos de `ECONOMY.gear`
(declarar `ECONOMY` antes do laço ou gerar o catálogo depois de `ECONOMY`). `shop = rarity !== 'lendario'`.
Comentário de cabeçalho explicando id, slot, principal/secundário e conjuntos. Exportar `GEAR_SLOTS`,
`GEAR_SLOT_INFO`, `GEAR_SETS`, `GEAR` em `GameData`. Acrescentar `ECONOMY.gear` com os valores do teste.

- [ ] **Step 4: Rodar e ver passar**

Run: `node prototype/tools/sim-test.js 2>&1 | tail -3`
Expected: `44 testes, 0 falhas`.

- [ ] **Step 5: Build e commit**

```bash
node prototype/build.mjs
git add prototype/src/data.js prototype/tools/sim-test.js prototype/dist/
git commit -m "Adiciona o catálogo de equipamentos e ECONOMY.gear"
```

---

### Task 2: Módulo puro `gear.js` (resolver, melhoria, pedra do pódio, bots)

**Files:**
- Create: `prototype/src/gear.js` (UMD, mesmo esqueleto de `prototype/src/breed.js` linhas 42–45 e 299–300; depende de `GameData` e `RaceSim`)
- Modify: `prototype/build.mjs:13` (`SCRIPTS` ganha `'src/gear.js'` depois de `'src/breed.js'`), `prototype/index.html:19` (tag `<script src="src/gear.js">` depois de `breed.js`)
- Test: `prototype/tools/sim-test.js` (`var GR = require('../src/gear.js');` no topo; seção `equipamento: gear.js`)

**Interfaces:**
- Consumes: `GameData.GEAR`, `GEAR_SLOTS`, `GEAR_SLOT_INFO`, `GEAR_SETS`, `ECONOMY.gear`, `ELEMENTS[el].weather`, `STAT_KEYS`; `RaceSim.mulberry32`, `RaceSim.hash2`.
- Produces (`window.Gear` / `module.exports`):
  - `Gear.SLOTS` (= `GEAR_SLOTS`), `Gear.piece(id)` → entrada do catálogo ou `null`.
  - `Gear.emptyEquip()` → `{ ferraduras: null, sela: null, estribos: null, testeira: null, armadura: null }`.
  - `Gear.resolve(mount, itemsByUid)` → `{ mods: {7 chaves}, special: { skillChanceBonus, weatherDoubleClimate, ignoreWeatherPenalty }, set: { id, count }, pieces: [{ slot, uid, id, plus }] }`. `mount.equip` ausente ⇒ tudo zerado. Peça ignorada se uid não existe em `itemsByUid`, se `GEAR[item.id]` não existe, se `GEAR[item.id].slot !== slot` ou se `plus` não é inteiro 0–10. `set.id` = conjunto com mais peças (empate: ordem sol/chuva/nevoa), `set.count` = esse número (0 sem conjunto). Bônus só com `count ≥ 3` (acumulam): `mods.sorte += 5`, `skillChanceBonus = 0.05`; `≥ 4`: `weatherDoubleClimate = set.id`; `≥ 5`: `ignoreWeatherPenalty = true`.
  - `Gear.enhanceOdds(plus)` → `{ chance, cost, dropTo }` (`dropTo = plus >= enhanceDropFrom ? plus - 1 : plus`) ou `null` se `plus >= plusMax`.
  - `Gear.enhance(item, seedBase, counter)` → `{ success, plus, roll }`; não muta `item`; `roll = mulberry32(hash2(seedBase, 0xE4A0 + counter))()`; `success = roll < chance`; `plus = success ? item.plus + 1 : dropTo`. `plus >= 10` ⇒ `null`.
  - `Gear.podiumStone(seed, place, fee)` → `0|1`: `fee <= 0` ou `place > 3` ⇒ 0 sem sortear; senão `mulberry32(hash2(seed, 0xB1AC))() < podiumStone[place - 1]` ⇒ 1.
  - `Gear.botGear(leagueIdx, element, pick)` → equipamento **resolvido** (mesmo formato de `resolve`), `pick` número em [0,1) usado só para Neutro escolher o conjunto (`floor(pick*3)` em sol/chuva/nevoa); elemento com clima usa `GEAR_SETS[ELEMENTS[element].weather]`. Tabela: 0 nada · 1 `ferraduras-comum`, `sela-comum` +0 · 2 cinco Comuns +2 · 3 cinco Mágicas +3 · 4 três Raras +4 do conjunto (ferraduras, sela, estribos) + `testeira-magico`, `armadura-magico` +3 · 5 cinco Raras +7 do conjunto. `leagueIdx` fora de 0–5 ⇒ limitado.
  - `Gear.sellPrice(id)` → `Math.round(price[rarity] * sellRate)`; id inválido ⇒ 0.
  - `Gear.ratingPts(count)` → `[0,0,0,10,15,20][count]` (count fora da faixa ⇒ 0).

- [ ] **Step 1: Escrever os testes que falham**

```js
section('equipamento: gear.js');
function gm(equip) { return { equip: equip }; }
function gi(uid, id, plus) { return { uid: uid, id: id, plus: plus || 0 }; }
function byUid(list) { var o = {}; list.forEach(function (it) { o[it.uid] = it; }); return o; }
test('resolve soma principal+plus e secundário; sem equip zera', function () {
  var items = byUid([gi('i1', 'sela-sol-raro', 3), gi('i2', 'ferraduras-comum')]);
  var g = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2' }), items);
  assert.deepStrictEqual(g.mods, { vel: 2, acel: 0, man: 0, forca: 0, est: 7, garra: 3, sorte: 0 });
  assert.deepStrictEqual(g.set, { id: 'sol', count: 1 });
  assert.deepStrictEqual(g.special, { skillChanceBonus: 0, weatherDoubleClimate: null, ignoreWeatherPenalty: false });
  assert.deepStrictEqual(g.pieces.map(function (p) { return p.uid; }), ['i2', 'i1']);
  var z = GR.resolve({}, {});
  assert.deepStrictEqual(z.mods, { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 });
  assert.deepStrictEqual(z.set, { id: null, count: 0 }); assert.deepStrictEqual(z.pieces, []);
});
test('resolve ignora uid inexistente, slot errado e plus inválido', function () {
  var items = byUid([gi('i1', 'sela-sol-raro', 3), gi('i2', 'ferraduras-comum', 11), gi('i3', 'estribos-magico', 1.5)]);
  var g = GR.resolve(gm({ ferraduras: 'i1', sela: 'i9', estribos: 'i3', testeira: 'i2' }), items);
  assert.deepStrictEqual(g.pieces, []); assert.strictEqual(g.set.count, 0);
});
test('conjunto: 3/4/5 peças com raridades misturadas; 2+2+1 não ativa', function () {
  var items = byUid([gi('i1', 'sela-chuva-raro'), gi('i2', 'ferraduras-chuva-lendario', 2), gi('i3', 'estribos-chuva-raro'), gi('i4', 'testeira-chuva-raro'), gi('i5', 'armadura-chuva-lendario'), gi('i6', 'testeira-sol-raro'), gi('i7', 'armadura-nevoa-raro')]);
  var g3 = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3' }), items);
  assert.deepStrictEqual(g3.set, { id: 'chuva', count: 3 }); assert.strictEqual(g3.mods.sorte, 5);
  assert.deepStrictEqual(g3.special, { skillChanceBonus: 0.05, weatherDoubleClimate: null, ignoreWeatherPenalty: false });
  var g4 = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3', testeira: 'i4' }), items);
  assert.strictEqual(g4.special.weatherDoubleClimate, 'chuva'); assert.strictEqual(g4.special.ignoreWeatherPenalty, false);
  var g5 = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3', testeira: 'i4', armadura: 'i5' }), items);
  assert.deepStrictEqual(g5.set, { id: 'chuva', count: 5 }); assert.strictEqual(g5.special.ignoreWeatherPenalty, true);
  assert.strictEqual(g5.mods.vel, 8); // lendário 6 + 2
  var gx = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', testeira: 'i6', armadura: 'i7' }), items);
  assert.strictEqual(gx.set.count, 2); assert.strictEqual(gx.mods.sorte, 0); assert.strictEqual(gx.special.skillChanceBonus, 0);
});
test('enhanceOdds segue a tabela', function () {
  assert.deepStrictEqual(GR.enhanceOdds(0), { chance: 1, cost: 1, dropTo: 0 });
  assert.deepStrictEqual(GR.enhanceOdds(5), { chance: 0.5, cost: 1, dropTo: 5 });
  assert.deepStrictEqual(GR.enhanceOdds(6), { chance: 0.4, cost: 2, dropTo: 5 });
  assert.deepStrictEqual(GR.enhanceOdds(9), { chance: 0.25, cost: 2, dropTo: 8 });
  assert.strictEqual(GR.enhanceOdds(10), null);
});
test('enhance é determinístico, não muta e cai só a partir de +6', function () {
  var it = gi('i1', 'sela-comum', 0);
  var a = GR.enhance(it, 20261106, 0), b = GR.enhance(it, 20261106, 0);
  assert.deepStrictEqual(a, b); assert.strictEqual(it.plus, 0);
  assert.strictEqual(a.success, true); assert.strictEqual(a.plus, 1); // +0→+1 é 100%
  assert.strictEqual(GR.enhance(gi('i1', 'sela-comum', 10), 1, 0), null);
  var falhou = null;
  for (var c = 0; c < 200 && !falhou; c++) { var r = GR.enhance(gi('x', 'sela-comum', 7), 20261106, c); if (!r.success) falhou = r; }
  assert.ok(falhou && falhou.plus === 6, 'falha em +7 cai para +6');
  var falhou3 = null;
  for (c = 0; c < 200 && !falhou3; c++) { r = GR.enhance(gi('x', 'sela-comum', 3), 20261106, c); if (!r.success) falhou3 = r; }
  assert.ok(falhou3 && falhou3.plus === 3, 'falha em +3 não cai');
});
test('snapshot dourado: 12 tentativas seguidas com seedBase 20261106', function () {
  var plus = 0, seq = [];
  for (var c = 0; c < 12; c++) { var r = GR.enhance(gi('x', 'sela-comum', plus), 20261106, c); plus = r.plus; seq.push(plus); }
  assert.deepStrictEqual(seq, /* CAPTURAR na 1ª execução e congelar aqui */ []);
});
test('podiumStone: só pódio em corrida valendo; frequência do 1º lugar', function () {
  assert.strictEqual(GR.podiumStone(123, 1, 0), 0); assert.strictEqual(GR.podiumStone(123, 4, 50), 0);
  assert.strictEqual(GR.podiumStone(123, 1, 50), GR.podiumStone(123, 1, 50));
  var n = 0; for (var s = 1; s <= 2000; s++) n += GR.podiumStone(s, 1, 50);
  assert.ok(n > 1100 && n < 1300, '1º lugar ~60%: ' + n + '/2000');
  var n3 = 0; for (s = 1; s <= 2000; s++) n3 += GR.podiumStone(s, 3, 50);
  assert.ok(n3 > 400 && n3 < 600, '3º lugar ~25%: ' + n3 + '/2000');
});
test('botGear por liga', function () {
  assert.strictEqual(GR.botGear(0, 'fogo', 0.5).set.count, 0);
  var p = GR.botGear(1, 'agua', 0.5); assert.deepStrictEqual(p.pieces.map(function (x) { return x.id; }), ['ferraduras-comum', 'sela-comum']);
  var l = GR.botGear(5, 'fogo', 0.5);
  assert.deepStrictEqual(l.set, { id: 'sol', count: 5 }); assert.strictEqual(l.mods.vel, 11); assert.strictEqual(l.mods.sorte, 8); // 3 sub + 5 conjunto
  assert.strictEqual(l.special.ignoreWeatherPenalty, true);
  assert.strictEqual(GR.botGear(5, 'neutro', 0.0).set.id, 'sol'); assert.strictEqual(GR.botGear(5, 'neutro', 0.5).set.id, 'chuva'); assert.strictEqual(GR.botGear(5, 'neutro', 0.9).set.id, 'nevoa');
  var d = GR.botGear(4, 'grama', 0.5); assert.deepStrictEqual(d.set, { id: 'nevoa', count: 3 }); assert.strictEqual(d.pieces.length, 5);
});
test('sellPrice e ratingPts', function () {
  assert.strictEqual(GR.sellPrice('sela-magico'), 63); assert.strictEqual(GR.sellPrice('armadura-sol-lendario'), 375); assert.strictEqual(GR.sellPrice('nada'), 0);
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6].map(GR.ratingPts), [0, 0, 0, 10, 15, 20, 0]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node prototype/tools/sim-test.js 2>&1 | tail -3`
Expected: erro `Cannot find module '../src/gear.js'`.

- [ ] **Step 3: Implementar `prototype/src/gear.js`**

Cabeçalho com: ordem das chamadas de rng (uma por tentativa de melhoria; uma por prêmio de pódio), formato
do objeto resolvido, tabela dos bots. Implementar a API do bloco Interfaces. `botGear` monta instâncias
sintéticas (`uid 'b1'…'b5'`) e chama `resolve`.

- [ ] **Step 4: Rodar, capturar o snapshot e ver passar**

Run: `node -e "var GR=require('./prototype/src/gear.js');var p=0,s=[];for(var c=0;c<12;c++){var r=GR.enhance({uid:'x',id:'sela-comum',plus:p},20261106,c);p=r.plus;s.push(p);}console.log(JSON.stringify(s))"`
Colar a sequência no teste do snapshot. Depois `node prototype/tools/sim-test.js 2>&1 | tail -3` → `53 testes, 0 falhas`.

- [ ] **Step 5: Build, index e commit**

```bash
node prototype/build.mjs
git add prototype/src/gear.js prototype/build.mjs prototype/index.html prototype/tools/sim-test.js prototype/dist/
git commit -m "Adiciona gear.js: resolver equipamento, melhoria, pedra do pódio e bots"
```

---

### Task 3: Simulação recebe o equipamento resolvido (`sim.js`, `balance.js`)

**Files:**
- Modify: `prototype/src/sim.js` (cabeçalho linhas 18–24 e 80; `computeStats` 226–244; `itemSpecialPoints` 258–266 (remover); `skillChance` 269–273; `powerRating` 292–299; `applyWeather` 467–469; `buildRacer` 486–508)
- Modify: `prototype/tools/balance.js` (`racer` 65–67; `detConfig` 397–406; `exemplo` 506–534; texto da linha 142)
- Test: `prototype/tools/sim-test.js` (seção `equipamento: simulação`)

**Interfaces:**
- Consumes: objeto resolvido de `Gear.resolve` (Task 2).
- Produces: `RaceSim.computeStats(horse, gear)`, `RaceSim.powerRating(horse, gear)`, `RaceSim.skillChance(horse, stats, bonus)`; entradas de `simulate`: `{ horse, gear, name, isPlayer }`. `gear` que não seja objeto com `mods` conta como `null` (saves antigos passam string).

- [ ] **Step 1: Escrever os testes que falham**

```js
section('equipamento: simulação');
function cl(h) { return JSON.parse(JSON.stringify(h)); }
test('computeStats soma mods do equipamento e limita a 120; string vale null', function () {
  var h = cl(G.STARTERS[0]);
  var base = S.computeStats(h, null);
  var g = GR.resolve({ equip: { sela: 'i1' } }, { i1: { uid: 'i1', id: 'sela-sol-raro', plus: 10 } });
  var s = S.computeStats(h, g);
  assert.strictEqual(s.est, base.est + 14); assert.strictEqual(s.garra, base.garra + 3); assert.strictEqual(s.vel, base.vel);
  assert.deepStrictEqual(S.computeStats(h, 'sela-couro'), base);
  var big = { mods: { vel: 200, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 }, special: {}, set: { id: null, count: 0 }, pieces: [] };
  assert.strictEqual(S.computeStats(h, big).vel, 120);
});
test('skillChance com bônus respeita o teto 0,95', function () {
  var h = cl(G.STARTERS[0]); var st = S.computeStats(h, null);
  assert.ok(Math.abs(S.skillChance(h, st, 0.05) - (S.skillChance(h, st) + 0.05)) < 1e-9);
  h.rarity = 'mitico'; h.level = 50; st.sorte = 100;
  assert.strictEqual(S.skillChance(h, st, 0.5), 0.95);
});
test('powerRating conta mods e pontos de conjunto', function () {
  var h = cl(G.STARTERS[0]);
  var items = {}; var equip = {};
  ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'].forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-sol-raro', plus: 0 }; equip[sl] = 'i' + i; });
  var g5 = GR.resolve({ equip: equip }, items);
  var g0 = GR.resolve({}, {});
  var r5 = S.powerRating(h, g5), r0 = S.powerRating(h, g0);
  assert.ok(r5 > r0 + 20, 'rating sobe com 5 Raras: ' + r0 + ' -> ' + r5);
  var g3 = GR.resolve({ equip: { ferraduras: 'i0', sela: 'i1', estribos: 'i2' } }, items);
  var statsOnly = S.powerRating(h, { mods: g3.mods, special: {}, set: { id: null, count: 0 }, pieces: [] });
  assert.strictEqual(S.powerRating(h, g3) - statsOnly, 10);
});
test('5 peças Chuva anulam a penalidade do Fogo na chuva; 4 Sol dobram o Sol', function () {
  var brasa = cl(G.STARTERS.filter(function (x) { return x.id === 'brasa'; })[0]);
  function gearOf(set, n) { var items = {}, equip = {}; ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'].slice(0, n).forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-' + set + '-raro', plus: 0 }; equip[sl] = 'i' + i; }); return GR.resolve({ equip: equip }, items); }
  function mixed(n) { var sets = ['sol', 'chuva', 'nevoa', 'sol', 'chuva']; var items = {}, equip = {}; ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'].slice(0, n).forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-' + sets[i] + '-raro', plus: 0 }; equip[sl] = 'i' + i; }); return GR.resolve({ equip: equip }, items); }
  function wins(gA, gB, weather) {
    var w = 0, saved = S.TUNING.diceAt; S.TUNING.diceAt = [];
    for (var k = 0; k < 200; k++) {
      var seed = S.hash2(777, k), cond = S.randomConditions(seed); cond.weather = weather;
      var pair = k % 2 ? [gB, gA] : [gA, gB];
      var res = S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: pair.map(function (g) { return { horse: brasa, gear: g, name: 'x', isPlayer: false }; }) });
      if (pair[res.finishOrder[0]] === gA) w++;
    }
    S.TUNING.diceAt = saved; return w;
  }
  assert.ok(wins(gearOf('chuva', 5), mixed(5), 'chuva') >= 110, 'anula penalidade (≥55% de 200)');
  assert.ok(wins(gearOf('sol', 4), mixed(4), 'sol') >= 110, 'dobra o Sol (≥55% de 200)');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node prototype/tools/sim-test.js 2>&1 | grep -c FALHA`
Expected: `4`.

- [ ] **Step 3: Implementar em `sim.js`**

`computeStats(horse, gear)`: `var mods = (gear && typeof gear === 'object' && gear.mods) ? gear.mods : null;` e
`if (mods && mods[k]) v += mods[k];` no lugar do item. Remover `itemSpecialPoints` e toda leitura de
`GameData.ITEMS`. `skillChance(horse, stats, bonus)` soma `(bonus || 0)` antes do `Math.min`.
`powerRating(horse, gear)` soma `GameData.ECONOMY.gear.setBonus.ratingPts[count - 3]` quando
`gear.set.count >= 3` (ou `Gear.ratingPts` reimplementado localmente — `sim.js` **não** depende de `gear.js`).
`buildRacer`: `var gear = (entry.gear && typeof entry.gear === 'object' && entry.gear.mods) ? entry.gear : null; var special = (gear && gear.special) || {};`;
`pool: T.poolBase + T.poolEst * statsN.est` (sem multiplicador); `ignoreWeatherPenalty: !!special.ignoreWeatherPenalty`;
`garraBonusTotal: 0`; novo campo `gearDoubleClimate: special.weatherDoubleClimate || null`;
`skillChance: skillChance(horse, stats, special.skillChanceBonus || 0)`. `applyWeather`:
`var m = weatherMult(r.element, weather, r.weatherDouble || r.gearDoubleClimate === weather);`.
Atualizar o cabeçalho (linhas 18–24, 31, 80): "Equipamento: mods + special (skillChanceBonus,
weatherDoubleClimate, ignoreWeatherPenalty)".

- [ ] **Step 4: Adaptar `balance.js`**

`var GR = require('../src/gear.js');`. `racer(h, gear, name)` → `{ horse: h, gear: gear || null, … }`.
`detConfig`: `var lg = Math.floor(rng() * 6); rs.push({ horse: h, gear: rng() < 0.6 ? GR.botGear(lg, h.element, rng()) : null, … })`
(remover `itemIds`). `exemplo()`: entradas com `gear: GR.botGear(2, 'grama', 0.5)` para "Você", `GR.botGear(1, 'fogo', 0.5)`
para o 1º bot, `null` nos demais; `S.computeStats(r.horse, r.gear)`. Linha 142: "sem itens" → "sem equipamento".

- [ ] **Step 5: Rodar e ver passar**

Run: `node prototype/tools/sim-test.js 2>&1 | tail -3` → `57 testes, 0 falhas`.
Run: `node prototype/tools/balance.js --quick 2>&1 | tail -3` → `Todas as 28 metas passaram.`

- [ ] **Step 6: Build e commit**

```bash
node prototype/build.mjs
git add prototype/src/sim.js prototype/tools/balance.js prototype/tools/sim-test.js prototype/dist/
git commit -m "Simulação passa a receber o equipamento resolvido no lugar do item"
```

---

### Task 4: Save v4, migração, liquidação e sala com equipamento (`game.js`)

**Files:**
- Modify: `prototype/src/game.js` (cabeçalho 1–14; constantes 32; `BR`/`instanceFromTemplate`/`newState` 190–235; `sanitizeMount` 276; `sanitize` 315–374; helpers 393–406; `itemOptionsHtml`/`strategyHtml` 601–619; `renderEstabulo` 780–784 e 833–835; `bestLevelFor`/`openLobby`/`buildLobby`/`refreshPlayerEntry` 1082–1188; `renderLargada` 1281–1282; `settle` 1350–1392; `renderResultado` 1958–1966; `case 'item'` 2084–2085)
- Modify: `prototype/src/data.js` (remover `ITEMS` e seu export)
- Modify: `prototype/tools/ui-test.mjs` (linhas 133, 157–159, 228, 298: trocas de item; fixtures 244–291; novo bloco de fixtures v3 completo e v4 corrompido; checagem da pedra no fluxo principal)

**Interfaces:**
- Consumes: `Gear.*` (Task 2), `RaceSim.*(horse, gear)` (Task 3).
- Produces (dentro de `game.js`): `var GR = window.Gear; var GE = E.gear;`; `emptyEquip()`; `itemsByUid()`; `itemByUid(uid)`; `gearOf(mount)`; `playerGear()`; `newItem(id)` (cria `{ uid: 'i'+nextItemUid, id, plus: 0 }`, incrementa e devolve); `isEquipped(uid)` → `{ mount, slot }|null`; `state.items`, `state.nextItemUid`, `state.pedras`, `state.enhanceCounter`, `mount.equip`; `settle` devolve `stone`.

- [ ] **Step 1: Atualizar o teste de interface (vai falhar até o código existir)**

Em `ui-test.mjs`:
1. Linhas 133, 228 e 298: trocar o clique em "Sem item" por `page.locator('[data-acao="tier"][data-id="50"]').first().click()` (re-renderiza do mesmo jeito).
2. Linhas 157–159: remover a troca de item na sala; no lugar, conferir que a sala mostra o resumo do equipamento: `if ((await page.locator('.slots').count()) < 1) problems.push('sala: sem resumo do equipamento')`.
3. Fixture `OLD_SAVE` (v1, `inventory: ["sela-couro"]`): esperar `s.v === 4`, `s.items.length === 1`, `s.items[0].id === 'sela-comum'`, `s.mounts[0].equip.sela === null`, `s.pedras === 0`, Ouro 777.
4. Fixture `V2_SAVE` (`equipped: "sela-couro"`): esperar `s.mounts[0].equip.sela === s.items[0].uid`.
5. Nova fixture `V3_FULL`: save v3 válido (copiar a montaria `m1` de `BAD_V3`) com `inventory` = os 10 ids antigos e `equipped: "capa-impermeavel"`, `gold: 999`: esperar `items.length === 9`, `pedras === 3`, `equip.armadura` = uid do item `armadura-magico`, `gold === 999`, `nextItemUid === 10`.
6. Nova fixture `BAD_V4`: `v: 4`, `gold: 444`, `items: [{uid:'i1',id:'sela-comum',plus:3},{uid:'i1',id:'sela-magico',plus:0},{uid:'i2',id:'ferraduras-comum',plus:99},{uid:'i3',id:'estribos-magico',plus:1},{uid:'zz',id:'sela-comum',plus:0},{uid:'i4',id:'nada',plus:0}]`, duas montarias válidas (`m1`, `m2`, clones da `m1` de `BAD_V3` com uids diferentes) com `m1.equip = { ferraduras: 'i1', sela: 'i1', estribos: 'i3' }` e `m2.equip = { estribos: 'i3' }`, `pedras: -5`, `enhanceCounter: 'x'`: esperar `items` = `[i1 (sela-comum, 3), i3]` (i1 duplicado, i2 plus 99, zz e i4 descartados), `m1.equip.ferraduras === null` (slot errado), `m1.equip.sela === 'i1'`, `m1.equip.estribos === 'i3'`, `m2.equip.estribos === null` (já usada), `pedras === 0`, `enhanceCounter === 0`, `nextItemUid === 4`, `gold === 444`.
7. Fluxo principal, depois da corrida valendo: `const expectStone = GR.podiumStone(S.hash2(seedBase1, 1), after.result.place, after.result.fee)` (requer `const GR = require('../src/gear.js')` e `S = require('../src/sim.js')` no topo) e comparar com `after.pedras` (expor `pedras` no `after`); se diferente, `problems.push`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node prototype/build.mjs && SHOTS_DIR=/tmp/claude-0/shots node prototype/tools/ui-test.mjs 2>&1 | tail -5`
Expected: `PROBLEMAS:` com as fixtures v4 e o resumo da sala.

- [ ] **Step 3: Implementar o estado em `game.js`**

- Remover `START_INVENTORY`; `var GR = window.Gear; var GE = E.gear;` (e incluir `window.Gear` na checagem de carregamento da linha 21 com a mensagem "faltam data.js, sim.js, gear.js ou sprites.js").
- `instanceFromTemplate`: campo `equip: GR.emptyEquip()`. `sanitizeMount`: `equip` sempre `GR.emptyEquip()` (preenchido depois em `sanitize`). Potro de `Breed.foal` recebe `equip` ao ser adicionado ao estábulo (no handler `cruzar`/`troca-sim`: `potro.equip = GR.emptyEquip()`).
- `newState`: `v: 4`, sem `inventory`/`equipped`; `items: []`, `nextItemUid: 1`, `pedras: 0`, `enhanceCounter: 0`; depois de montar, para cada id de `GE.startGear`: `var it = newItem(id); mounts[0].equip[GD.GEAR[id].slot] = it.uid;` (resultado: `i1` sela, `i2` ferraduras, `nextItemUid 3`).
- `OLD_ITEM_MAP` (spec §11; `'rapadura-engenho': null` ⇒ +3 pedras).
- `sanitize`: `var v4 = Number(s.v) >= 4;` Itens: se `v4`, de `s.items`; senão, migração de `s.inventory` (array de ids antigos) com `equipped` lembrado por índice. Validação de cada item: `uid` `/^i\d{1,9}$/`, `GD.GEAR[id]`, `plus` inteiro 0–10 (`Number.isInteger` não é ES5: usar `plus === Math.floor(plus) && plus >= 0 && plus <= GE.plusMax`), sem uid repetido. `nextItemUid = Math.max(num(s.nextItemUid, 0, 0, 1e9), maxItemUid + 1)`; `pedras = num(s.pedras, 0, 0, 1e6)`; `enhanceCounter = num(s.enhanceCounter, 0, 0, 1e9)`. Equip: percorrer `mounts` na ordem e, por slot de `GR.SLOTS`, aceitar `raw.equip[slot]` se o item existe, `GD.GEAR[item.id].slot === slot` e o uid ainda não foi usado. Na migração, o item antigo equipado entra no slot correspondente da montaria ativa.
- Helpers: `emptyEquip` (de `GR`), `itemsByUid`, `itemByUid`, `gearOf(mount)`, `playerGear()`, `newItem(id)`, `isEquipped(uid)`.
- Substituir `state.equipped`/`GD.ITEMS`: `renderEstabulo` usa `playerGear()`; `itemOptionsHtml`/`strategyHtml` e `case 'item'` saem; no lugar, `gearSummaryHtml(mount)`: `<div class="slots">` com 5 `<span class="slot slot--cheio|slot--vazio" title="Sela do Sol +3">+3</span>` (vazio: `—`) e, com `set.count >= 3`, `<span class="set-badge">Sol ×4</span>`; usado no estábulo (seção "Preparar corrida", com a nota "Troque as peças na tela Equipar.") e na largada (seção "Sua estratégia").
- `openLobby`: `pr: RS.powerRating(playerHorse(), playerGear())` (comentário: equipamento é persistente, entra no pareamento). `buildLobby`: jogador `gear: playerGear()`; por bot: `var pick = rng(); var idx = GD.LEAGUES.indexOf(RS.leagueFor(target));` e, por template candidato, `GR.botGear(idx, tpl.element, pick)` passado a `bestLevelFor(tpl, gear, …)`; remover `itemIds`/`itemId`; o bot escolhido guarda `gear`. `bestLevelFor(template, gear, target, lo, hi)` usa `RS.powerRating(h, gear)`. `refreshPlayerEntry`: `r.gear = playerGear()`.
- `settle`: racers com `gear: r.gear`; `RS.computeStats(hBefore, null)` continua (status puros para o level-up); depois do prêmio: `var stone = L.training ? 0 : GR.podiumStone(L.seed, place, L.fee); state.pedras += stone;` e `stone: stone` no retorno. `renderResultado`: na `<dl class="balanco">` de corrida valendo, `<dt>Pedra Negra</dt><dd class="mais">🪨 +1</dd>` quando `R.stone`.
- Cabeçalho do arquivo: trocar "O jogador escolhe o item…" por "O equipamento (persistente, por montaria) entra no pareamento; com páreo aberto só trocas que não passem do rating da sala."
- `data.js`: remover `ITEMS` e o export. `grep -n "ITEMS\|equipped\|inventory" prototype/src/*.js` deve voltar vazio.

- [ ] **Step 4: Rodar e ver passar**

Run: `node prototype/tools/sim-test.js 2>&1 | tail -2` → `57 testes, 0 falhas`.
Run: `node prototype/build.mjs && SHOTS_DIR=/tmp/claude-0/shots node prototype/tools/ui-test.mjs 2>&1 | tail -3` → `OK: fluxo completo…`.

- [ ] **Step 5: Commit**

```bash
git add prototype/src/game.js prototype/src/data.js prototype/tools/ui-test.mjs prototype/dist/
git commit -m "Save v4: peças como instâncias, equip por montaria, migração, pedra do pódio e sala com equipamento"
```

---

### Task 5: Tela Equipamento, melhoria, venda, trava parcial e painel dev

**Files:**
- Modify: `prototype/src/game.js` (`ui` inicial; `go()` 640–652 limpa `ui.equip.undo` ao sair; `render()` 660–667 ganha `case 'equipamento'`; `mountCardHtml` 741–769 ganha a linha de equipamento e o botão Equipar; painel dev 668–673; novas `renderEquipamento`, `equipRowHtml`, handlers)
- Modify: `prototype/src/game.css` (`.slots`, `.slot`, `.slot--cheio`, `.slot--vazio`, `.set-badge`, `.pecas`, `.peca`, `.peca--equipada`, `.pedras`, `.slot-linha`, `.slot-linha--aberta`)
- Test: `prototype/tools/ui-test.mjs` (novo contexto `equipamento`, depois do contexto `cruzamento`)

**Interfaces:**
- Consumes: Task 4 helpers; `Gear.enhanceOdds/enhance/sellPrice/resolve`.
- Produces: `ui.equip = { uid, slot, confirm, undo, msg }`; `go('equipamento')`; ações `equipar-tela` (data-id = uid da montaria), `equip-slot` (data-id = slot; abre/fecha a lista), `equipar` (data-id = uid da peça), `tirar` (data-id = slot), `melhorar` / `melhorar-sim` / `melhorar-nao` (data-id = uid da peça), `vender` (uid), `vender-desfazer`, `equip-voltar`; dev: `dev-pedras` (+5), `dev-set` (5 Lendárias +0 do conjunto do clima do elemento da ativa, Neutro → Sol, criadas e equipadas); `canEquip(mount, equipNovo)` → `{ ok, limit }` (trava parcial: com `state.pending` e `mount.uid === state.activeId`, `RS.powerRating(mount, GR.resolve({equip: equipNovo}, itemsByUid())) <= state.pending.pr`); id do título `#t-equipamento`.

- [ ] **Step 1: Escrever o contexto `equipamento` do teste de interface**

Depois do bloco `cruzamento`, com `?dev=1`, viewport 390×844, captura `final-07-equipamento.png`:
1. Escolher Brasa; conferir `state.items.length === 2`, `mounts[0].equip.sela === 'i1'`, `equip.ferraduras === 'i2'`, `pedras === 0`.
2. `dev-pedras` → `pedras === 5`. `dev-set` → `items.length === 7`, os 5 slots de `m1` preenchidos com ids `-sol-lendario` (Brasa é Fogo).
3. `[data-acao="equipar-tela"][data-id="m1"]` → `#t-equipamento`; texto da tela contém `Sol ×5`.
4. `[data-acao="equip-slot"][data-id="sela"]` abre a lista; `[data-acao="tirar"][data-id="sela"]` → `equip.sela === null`, texto `Sol ×4`.
5. `[data-acao="equipar"][data-id="i1"]` → `equip.sela === 'i1'`; o uid da Lendária de sela (chamar `L = uid`) fica no inventário.
6. Melhorar `i1` três vezes: para cada tentativa k = 0,1,2, calcular no Node `GR.enhance({ plus: p }, seedBase, k)` encadeado; clicar `melhorar` (data-id i1) e `melhorar-sim`; conferir `items` de `i1` `.plus` igual ao calculado, `pedras` debitadas (`5 - custos`), `enhanceCounter === 3`. Texto da tela contém `Sucesso` ou `Falhou`.
7. Vender `L` (`[data-acao="vender"][data-id=L]`) → `gold` +375, `items.length === 6`; `vender-desfazer` → `items.length === 7`, gold de volta; sair (`equip-voltar`) e voltar à tela → sem botão `vender-desfazer`.
8. Recarregar a página → `equip` e `plus` persistem.
9. Trava: no estábulo, "Procurar corrida" → `#t-largada`; `voltar`; `equipar-tela` m1; `equip-slot sela`; o botão `[data-acao="equipar"][data-id=L]` está `disabled` e a tela contém `Páreo aberto`; `tirar sela` funciona e `equipar i1` de novo funciona (rating ≤ pr).
10. `checkOverflow(page, 'equipamento')`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `SHOTS_DIR=/tmp/claude-0/shots node prototype/tools/ui-test.mjs 2>&1 | tail -4`
Expected: `PROBLEMAS:` (sem `#t-equipamento`).

- [ ] **Step 3: Implementar**

- `mountCardHtml`: antes de `acoes`, `gearSummaryHtml(m)`; em `.montaria-acoes`, botão `Equipar` (`data-acao="equipar-tela"`), sempre habilitado.
- `renderEquipamento()`: header (`equip-voltar`, saldo, `<span class="pedras">🪨 N</span>`), cabeça da montaria (retrato, nome, `Poder N`, linha do conjunto `Sol ×4 · bônus do clima dobrado` / `sem conjunto`), aviso de trava quando `state.pending && uid === activeId`: `Páreo aberto: o rating não pode passar de N`. Lista de 5 `.slot-linha` (`equip-slot`): nome do slot, peça atual (`Sela do Sol · Raro · +3 · +7 Est, +3 Garra`) ou `vazio`. Slot aberto (`ui.equip.slot`): `.pecas` com a peça equipada (botão `Tirar`, `Melhorar`) e as disponíveis (não equipadas em nenhuma montaria, mesmo slot, ordenadas por raridade desc e `plus` desc): `Equipar` (desabilitado com `title` quando `canEquip` falha), `Melhorar`, `Vender (N)`. Cada `.peca` mostra `Poder A → B`. `ui.equip.confirm === uid`: bloco `.confirma` com `+N → +N+1: 70% · 1 pedra · se falhar continua +N` e `melhorar-sim`/`melhorar-nao`; sem pedras: botão desabilitado com `Sem pedras`. `ui.equip.msg` vira `<p class="aviso" role="status">`. `ui.equip.undo`: `<button data-acao="vender-desfazer">Desfazer venda de X (−N)</button>`.
- Handlers: `equipar` (valida slot/uid/`canEquip`; se a peça estava em outra montaria, não aparece na lista, então não precisa desequipar), `tirar`, `melhorar` (abre confirmação), `melhorar-sim` (`odds = GR.enhanceOdds(item.plus)`; recusa se `!odds`, `state.pedras < odds.cost`, ou peça equipada na ativa com `state.pending`; `state.pedras -= odds.cost; var c = state.enhanceCounter; state.enhanceCounter += 1; var r = GR.enhance(item, state.seedBase, c); item.plus = r.plus; persist();` msg conforme `r.success`/queda), `vender` (só se `!isEquipped(uid)`; `state.gold += GR.sellPrice(item.id)`; remove; `ui.equip.undo = { item, price }`), `vender-desfazer` (só se `state.gold >= price` e o uid não existe; recoloca e debita), `equip-voltar` → `go('estabulo')`. `go()`: `if (screen !== 'equipamento' && ui.equip) ui.equip.undo = null;`.
- Dev: `dev-pedras`, `dev-set` conforme Interfaces.
- CSS: `.slots` em linha com 5 chips 32×32; `.slot--vazio` opaco 0,5; `.set-badge` dourado; `.peca` com nome, meta e `.acoes`; nada de `!important`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node prototype/build.mjs && SHOTS_DIR=/tmp/claude-0/shots node prototype/tools/ui-test.mjs 2>&1 | tail -3` → `OK`.

- [ ] **Step 5: Commit**

```bash
git add prototype/src/game.js prototype/src/game.css prototype/tools/ui-test.mjs prototype/dist/
git commit -m "Tela de equipamento: equipar, melhorar, vender, trava com páreo aberto e painel dev"
```

---

### Task 6: Loja e resumo na largada

**Files:**
- Modify: `prototype/src/game.js` (`render()` ganha `case 'loja'`; `montariasHtml` 771–778 ganha o botão Loja; `renderLargada` 1281–1282: resumo + atalho `equipar-tela`; nova `renderLoja`; handlers `loja`, `loja-tab`, `comprar`, `comprar-pedra`, `loja-voltar`)
- Modify: `prototype/src/game.css` (`.loja-grade`, `.produto`, `.produto-preco`, `.produto-diff`)
- Test: `prototype/tools/ui-test.mjs` (novo contexto `loja`, captura `final-08-loja.png`)

**Interfaces:**
- Consumes: Task 4 helpers, Task 5 `equipar-tela`.
- Produces: `ui.loja = { tab }` (`'ferraduras'|…|'pedras'`), `go('loja')`, `#t-loja`, ações `loja` (estábulo), `loja-tab` (data-id), `comprar` (data-id = id do catálogo), `comprar-pedra` (data-id = 1|5), `loja-voltar`.

- [ ] **Step 1: Escrever o contexto `loja` do teste de interface**

Viewport 390×844, sem `?dev=1`:
1. Escolher Ipê (Grama); `[data-acao="loja"]` → `#t-loja`; aba inicial ferraduras com 5 produtos (`.produto` count 5); `loja-tab` sela → o texto contém `Sela do Sol`, `Sela da Chuva`, `Sela da Névoa`.
2. `comprar` `sela-magico` → `gold === 250`, `items.length === 3`, último item `id 'sela-magico'`, `plus 0`, uid `i3`.
3. `comprar` `sela-sol-raro` (600) está `disabled` (Ouro 250); forçar `state.gold = 10` via `evaluate` e clicar `comprar` `sela-comum` via `evaluate(() => document.querySelector('[data-acao="comprar"][data-id="sela-comum"]').click())` → `gold === 10`, `items.length === 3` (handler recusa).
4. `state.gold = 250`; re-render (`loja-tab pedras`); `comprar-pedra` 5 → `pedras === 5`, `gold === 50`; `comprar-pedra` 5 está `disabled`.
5. Captura `final-08-loja.png`; `checkOverflow(page, 'loja')`.
6. `loja-voltar` → estábulo; `equipar-tela` m1; `equip-slot sela`; `equipar i3`; `equip-voltar`; "Procurar corrida" → `#t-largada` contém `.slots` com 2 `.slot--cheio` (sela i3 e ferraduras i2) e um botão `equipar-tela`; clicar nele → `#t-equipamento` com `Páreo aberto`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `SHOTS_DIR=/tmp/claude-0/shots node prototype/tools/ui-test.mjs 2>&1 | tail -4` → `PROBLEMAS:` (sem `#t-loja`).

- [ ] **Step 3: Implementar**

`renderLoja()`: header (`loja-voltar`, saldo, pedras), `<div class="abas">` com 6 abas (`loja-tab`, `aria-pressed`), grade `.loja-grade` de `.produto`: nome, `rarityHtml`, chip do conjunto, `+4 Est · +3 Garra`, `.produto-diff` em relação à peça da **ativa** no slot (`+2 Est em relação à equipada` / `slot vazio`), `<button data-acao="comprar" data-id=…>Comprar (600)</button>` (`disabled` + `Sem Ouro` quando `state.gold < price`). Aba pedras: dois `.produto` (`×1 · 40`, `×5 · 200`) com `comprar-pedra`. Handlers: `comprar` (recusa se `!GD.GEAR[id] || !GD.GEAR[id].shop || state.gold < price`; `state.gold -= price; newItem(id); persist()`), `comprar-pedra` (n ∈ {1,5}; custo `n * GE.stonePrice`; recusa sem Ouro). Estábulo: botão `Loja` ao lado de `Haras`. Largada: `gearSummaryHtml(activeMount())` + `<button data-acao="equipar-tela" data-id=activeId class="btn btn--pequeno">Equipar</button>` e a nota `Com o páreo aberto, só trocas que não passem do rating da sala (N).`

- [ ] **Step 4: Rodar e ver passar**

Run: `node prototype/build.mjs && SHOTS_DIR=/tmp/claude-0/shots node prototype/tools/ui-test.mjs 2>&1 | tail -3` → `OK`.

- [ ] **Step 5: Commit**

```bash
git add prototype/src/game.js prototype/src/game.css prototype/tools/ui-test.mjs prototype/dist/
git commit -m "Loja de equipamento e Pedra Negra; resumo do equipamento na largada"
```

---

### Task 7: Metas de balanceamento E1–E4

**Files:**
- Modify: `prototype/tools/balance.js` (nova seção depois da meta 4b, linha ~262; cabeçalho da linha 142)
- Test: o próprio `balance.js --quick` (falha se meta quebrar)

**Interfaces:**
- Consumes: `GR.resolve`, `GR.botGear`, `racer(h, gear)`, `duel` (227–237), padrão de clima forçado da meta 2 (`S.TUNING.diceAt = []`, `cond.weather = w`).
- Produces: metas `E1`–`E4` no relatório e em `results`.

- [ ] **Step 1: Escrever as metas (falham se fora da faixa)**

Helpers: `function setGear(set, rarity, plus, n)` → `GR.resolve` de n peças (slots na ordem) do conjunto;
`function mixedGear(rarity, plus, sets)` → peças dos conjuntos listados por slot; `function looseGear(rarity, plus)` → 5 soltas.
`function duelGear(a, ga, b, gb, N, testId, weather)` igual a `duel` mas com `racer(h, gear)` e, se `weather`, `cond.weather = weather` com `diceAt = []` durante o laço. N = `n(400)`.
- E1: `duelGear(clone(mare,1), looseGear('comum',0), clone(mare,1), null, …, 'nublado')` para os 3 iniciais, agregado → `check('E1', 'Inicial lv1 com 5 Comuns +0 vence sem nada', v, 60, 75)`.
- E2: comuns × raros (como 4b) com `clone(C, 30)` + `setGear('sol','raro',10,5)` contra `clone(R, 30)` sem nada, nublado → `check('E2', 'Comum lv30 com conjunto Raro +10 vence Raro lv30 sem nada', v, 40, 60)`.
- E3: Brasa lv10 com `setGear('sol','raro',0,4)` × Brasa lv10 com `mixedGear('raro',0,['sol','sol','chuva','nevoa'])`, clima `sol` → `check('E3', '4 Raras do Sol × 4 Raras misturadas, com Sol', v, 55, 70)`.
- E4: Brasa lv10 com `setGear('chuva','raro',0,5)` × `mixedGear('raro',0,['chuva','chuva','sol','sol','nevoa'])`, clima `chuva` → `check('E4', 'Fogo com 5 Raras da Chuva × misturadas, na chuva', v, 60, 75)`.
Tabela no relatório com os 4 valores. Linha 142: acrescentar "Metas E1–E4 medem o equipamento (`gear.js`)."

- [ ] **Step 2: Rodar**

Run: `node prototype/tools/balance.js --quick 2>&1 | grep -E "E[1-4]|metas"`
Expected: 4 linhas de meta e `Todas as 32 metas passaram.` Se alguma falhar: ajustar **só** `ECONOMY.gear.main`/`sub` ou `setBonus.ratingPts` (spec §13), atualizar os valores pinados na Task 1 e no `sim-test`, e registrar a mudança no relatório da tarefa com o antes/depois. Não mexer na tabela de melhoria.

- [ ] **Step 3: Rodar completo e commit**

Run: `node prototype/tools/balance.js 2>&1 | tail -2` → `Todas as 32 metas passaram.` (≈ 2 min).

```bash
git add prototype/tools/balance.js prototype/src/data.js prototype/tools/sim-test.js prototype/dist/
git commit -m "Metas E1–E4: equipamento se sente, fecha um degrau e os conjuntos valem"
```

---

### Task 8: Documentação, regras, capturas e memória

**Files:**
- Modify: `docs/GDD.md` (nova `## 7. Equipamentos` antes de `## 7+`; lista pendente sem "Itens e upgrades"), `docs/exemplos.md` (nova `## 14. Equipamentos`), `CLAUDE.md` (§8: bullet "Melhoria de peça e Pedra Negra do pódio só pela RNG da seed (`prototype/src/gear.js`)"; §4: linha do `sim-test` cita o nº de testes se citar), `docs/memoria/ESTADO.md`, `docs/memoria/decisoes.md`, `docs/superpowers/specs/2026-11-06-equipamentos-design.md` (§16 "Histórico de ajustes" com o que mudou na implementação), `prototype/screens/*.png` (regenerar com `node prototype/tools/ui-test.mjs`, sem `SHOTS_DIR`)
- Test: `./scripts/check.sh`

- [ ] **Step 1: GDD §7** — tabelas de slots/status (spec §3.1), raridade/valores/preços (§4), melhoria (§5, com a tabela de custo esperado), conjuntos (§6), loja/venda (§7), pódio (§8), bots por liga (§9), fora de escopo (§14). Linguagem de design, sem nomes de função.
- [ ] **Step 2: exemplos §14** — preços, tabela de custo esperado da melhoria (+5/+7/+8/+10), equipamento dos bots, resultado das metas E1–E4 (copiar do relatório do `balance.js`), 1 exemplo de `Gear.resolve` (Brasa com 5 Lendárias do Sol: mods e rating antes/depois).
- [ ] **Step 3: CLAUDE.md §8**, memória (`ESTADO.md`: subprojeto 3 concluído na branch, verificação, limites; `decisoes.md`: 2026-11-06 — slots, melhoria com chances reduzidas, conjuntos por clima, loja + pedra no pódio, trava parcial), spec §16.
- [ ] **Step 4: Capturas** — `node prototype/tools/ui-test.mjs` (gera `final-07-equipamento.png` e `final-08-loja.png` além das existentes).
- [ ] **Step 5: Verificação completa** — `./scripts/check.sh` → `VERIFICAÇÃO COMPLETA: OK`.
- [ ] **Step 6: Commit**

```bash
git add docs/ CLAUDE.md prototype/screens/
git commit -m "Documenta equipamentos (GDD §7, exemplos §14), regras, capturas e memória"
```
