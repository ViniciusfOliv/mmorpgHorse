# Estábulo, Haras e Cruzamento — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O jogador tem várias montarias (estábulo com vagas), escolhe a ativa e cria potros no Haras —
cruzando duas suas ou uma sua com um reprodutor de aluguel — com raridade, grau, elemento, status, potencial
e skills gerados por uma função pura e determinística.

**Architecture:** `breed.js` (novo, puro, UMD, só depende de `data.js` e de `mulberry32/hash2` do `sim.js`)
gera o potro e calcula as chances; `data.js` ganha `grau`, faixas de status, nomes e preços; `game.js` passa
do save de um cavalo (v2) para `mounts[]` + `activeId` (v3) e ganha as telas Estábulo (lista) e Haras;
`sim-test.js` cobre o gerador; `ui-test.mjs` cobre o fluxo. O núcleo (`sim.js`) **não muda**.

**Tech Stack:** HTML/CSS/JS puro, ES5 em `prototype/src/` (`var`/`function`, sem arrow/`const`/`let`/template
strings), Node 22 + `assert` nos tools, Playwright pré-instalado. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-11-06-cruzamento-design.md`

## Global Constraints

- `prototype/src/*.js` em ES5; UMD como `data.js`/`sim.js`; texto de jogo em pt-BR; ids sem acento.
- **Determinismo:** `Breed.foal` usa só `mulberry32(hash2(seedBase, 0xB0B0 + breedCounter))` na ordem de
  chamadas da spec §7; nada de `Math.random`/`Date` em `breed.js`. `odds()` não consome RNG.
- **Mítico nunca nasce de cruzamento** (spec §7): qualquer resultado acima de Lendário vira Lendário.
- **Dinheiro:** todo débito (aluguel, registro, Troca, expansão) acontece **antes** de gerar/mostrar o potro, e
  só se o jogador tem o Ouro; nunca cria Ouro.
- **Regras invioláveis do `CLAUDE.md` §8** continuam: resultado só depois de pagar; sala não re-sorteada de
  graça — por isso *tornar ativa*, *liberar*, *Troca* ficam bloqueados enquanto `state.pending` existe.
- Todo texto dinâmico em HTML passa por `esc()`; nomes de montaria têm 2–16 caracteres.
- `prototype/dist/` gerado por `node prototype/build.mjs` e commitado junto com `src/`; nunca editado à mão.
- Branch `claude/cruzamento`; commits pequenos, imperativo, pt-BR. Antes de dizer que terminou (tarefa 8):
  `./scripts/check.sh` verde.

## Review Focus

1. **Nome com HTML ou tamanho errado** (`<b>x</b>`, vazio, 40 caracteres): renderiza escapado e cortado em
   16, nunca injeta. → teste `renomear com <b>` na tarefa 5 (ui-test).
2. **Haras com o estábulo cheio**: "Cruzar" fica desabilitado com aviso e **nenhum Ouro** é debitado.
   → teste `estábulo cheio` na tarefa 6 (ui-test).
3. **Troca que consome a montaria ativa**: `activeId` passa para o potro; com `state.pending` aberto a
   Troca é bloqueada. → testes `troca move a ativa` e `pending bloqueia` na tarefa 6.
4. **Save v3 corrompido** (montaria sem `potential`, raridade inválida, `activeId` inexistente): `sanitize`
   descarta só a montaria inválida, nunca lança, e recria o inicial se `mounts` ficar vazio. → teste
   `save v3 corrompido` na tarefa 4 (ui-test com `addInitScript`).
5. **Dois potros com o mesmo nome**: `uid` distinto e o cartão mostra `#n`; ações por `uid`, nunca por
   nome. → teste `uid no cartão` na tarefa 5 (sim-test gera 2 potros com o mesmo nome forçando `FOAL_NAMES`
   de 1 item; ui-test confere `data-id` dos botões).

---

### Task 1: Dados do cruzamento (`data.js`)

**Files:**
- Modify: `prototype/src/data.js` — `RARITIES` (l.53–57), `mount()` (~l.270), `STARTERS`/`WILD_HORSES`,
  `ECONOMY` (~l.402), export
- Test: `prototype/tools/sim-test.js`, seção `dados v3` (após `dado`)

**Interfaces:**
- Produces:
  - `RARITIES[id].baseLo` = comum 36, magico 44, raro 52, lendario 60, mitico 68 (faixa = `[baseLo, baseLo+16]`).
  - `mount(id, name, element, rarity, sex, level, base, potential, skills, palette, extra)` inalterado; `extra.grau`
    (1–3) e `extra.breedLeftMax` opcionais. Graus: Brasa/Maré/Ipê 2; Pangaré 1, Lambari 1, Faísca 2, Capim 2;
    Tição/Garoa/Mandacaru 2; Ventania 3, Pororoca 2; Fogaréu/Jequitibá 3; Boitatá/Iara 3. Toda montaria de
    dados tem `grau`.
  - `GameData.FOAL_NAMES`: 30 nomes pt-BR, sem acento obrigatório, 2–12 caracteres (ex.: `'Tufão','Canela',
    'Baio','Pitanga','Jaguar','Serena','Relâmpago','Mimosa','Trovão','Lua','Corisco','Pérola','Faísca II'…` —
    o implementador completa; nenhum igual aos iniciais/selvagens).
  - `ECONOMY.breeding = { rentalBase: { comum: 100, magico: 250, raro: 600, lendario: 1500 }, grauMult: [1, 1.25, 1.5],
    ownRegistration: 50, exchange: 50, stableSlotPrice: 300, stableSlotsStart: 3, stableSlotsMax: 8, levelSaturation: 30,
    mareWeight: 0.6 }`.
  - `GameData.BREED_LEFT = { m: 2, f: 1 }`.

- [ ] **Step 1: Testes (seção `dados v3`)**

```js
section('dados v3');
test('baseLo por raridade e grau em todas as montarias', function () {
  assert.deepStrictEqual(['comum','magico','raro','lendario','mitico'].map(function (r) { return G.RARITIES[r].baseLo; }), [36, 44, 52, 60, 68]);
  G.STARTERS.concat(G.WILD_HORSES).forEach(function (h) { assert.ok(h.grau >= 1 && h.grau <= 3, h.id + ' grau'); });
  assert.strictEqual(G.STARTERS[0].grau, 2); assert.strictEqual(G.WILD_HORSES.filter(function (h) { return h.id === 'w-boitata'; })[0].grau, 3);
});
test('nomes de potro e economia do cruzamento', function () {
  assert.ok(G.FOAL_NAMES.length >= 30); G.FOAL_NAMES.forEach(function (n) { assert.ok(n.length >= 2 && n.length <= 12, n); });
  var B = G.ECONOMY.breeding;
  assert.deepStrictEqual(B.rentalBase, { comum: 100, magico: 250, raro: 600, lendario: 1500 });
  assert.deepStrictEqual(B.grauMult, [1, 1.25, 1.5]); assert.strictEqual(B.stableSlotsStart, 3); assert.strictEqual(B.stableSlotsMax, 8);
  assert.strictEqual(B.levelSaturation, 30); assert.strictEqual(B.mareWeight, 0.6); assert.deepStrictEqual(G.BREED_LEFT, { m: 2, f: 1 });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `node prototype/tools/sim-test.js` → 2 falhas.
- [ ] **Step 3: Implementar** conforme Interfaces (comentários de `RARITIES`/`mount()` atualizados).
- [ ] **Step 4: Rodar e ver passar**; `node prototype/build.mjs`.
- [ ] **Step 5: Commit** — `git add prototype/src/data.js prototype/tools/sim-test.js prototype/dist && git commit -m "Dados do cruzamento: faixas por raridade, grau, nomes de potro e preços"`

---

### Task 2: `breed.js` — chances e sorteio de raridade/grau

**Files:**
- Create: `prototype/src/breed.js`
- Modify: `prototype/build.mjs:13` (`SCRIPTS` ganha `'src/breed.js'` depois de `'src/sim.js'`), `prototype/index.html:18`
  (`<script src="src/breed.js">` depois de `sim.js`)
- Test: `sim-test.js`, seção `cruzamento` (`var B = require('../src/breed.js');` no topo do arquivo)

**Interfaces:**
- Consumes: `GameData` (`RARITIES`, `ECONOMY.breeding`), `RaceSim.mulberry32/hash2` (`require('./sim.js')` no Node,
  `root.RaceSim` no browser).
- Produces (`Breed`, UMD: `module.exports` / `root.Breed`):
  - `Breed.TUNING = { rarity: { same: { lv1: [45, 54, 1, 0], lv30: [30, 65, 4.5, 0.5] }, mixed: { lv1: [35, 50, 15, 0], lv30: [20, 50, 29, 1] } },
    grau: { lv1: [25, 55, 20], lv30: [10, 50, 40] }, skillInherit: 0.35, potInherit: 0.5, maxRarityOrder: 3 }`
    (colunas: 1 abaixo, igual, 1 acima, 2 acima; grau: desce, mantém, sobe; percentuais).
  - `Breed.levelFactor(f, m) -> number` = `clamp((mareWeight·f.level + (1−mareWeight)·m.level) / levelSaturation, 0, 1)`.
  - `Breed.rarityOdds(f, m) -> { comum, magico, raro, lendario, mitico }` (probabilidades 0–1 somando 1; `mitico` sempre 0):
    base = menor ordem, `diff` = diferença; linha `same` se `diff === 0`, senão `mixed`; cada coluna interpolada
    `p0 + (p1 − p0)·L`; alvo da coluna `k` = `base − 1 + k`; alvo `< 0` → 0; alvo `> 3` → 3; soma por alvo.
  - `Breed.grauOdds(f, m) -> { 1, 2, 3 }` para o caso "mesma raridade": `gb = round(0.6·f.grau + 0.4·m.grau)`;
    desce/mantém/sobe interpolados; alvo fora de 1–3 soma em "mantém".
  - `Breed.odds(f, m) -> { L, rarity, grau, rarityUpGrau: 1, rarityDownGrau: 3 }`.
  - `Breed.rollRarity(rng, f, m) -> rarityId` e `Breed.rollGrau(rng, f, m, rarityChanged: -1|0|1) -> 1|2|3` (1 chamada de
    `rng` cada quando sorteiam; `rollGrau` com `rarityChanged !== 0` **não** consome rng: `1` se subiu, `3` se desceu).
  - `Breed.rentalPrice(mount) -> number|null` = `Math.round(rentalBase[rarity] · grauMult[grau−1])`, `null` para mítico.
  - `Breed.isCorcel(mount) -> boolean` com `Breed.CORCEL_SETS = { comum: ['arranque'], magico: ['arranque','sprint'],
    raro: ['arranque','sprint','drift'], lendario: [..., 'saida-rapida'], mitico: [..., 'arrancada-final'] }`.

- [ ] **Step 1: Testes (seção `cruzamento`, parte 1)** — helper e asserções:

```js
section('cruzamento');
function mk2(o) { return { uid: o.uid || 'x', name: o.name || 'X', element: o.element || 'fogo', rarity: o.rarity || 'raro', grau: o.grau || 2, sex: o.sex || 'm', level: o.level || 30,
  skills: o.skills || [], base: { vel: 60, acel: 60, man: 60, forca: 60, est: 60, garra: 60, sorte: 60 }, potential: o.potential || { vel: 10, acel: 10, man: 10, forca: 10, est: 10, garra: 10, sorte: 10 },
  palette: o.palette || { coat: '#c4471d', coatShade: '#7f2a0e', mane: '#ffb02e', accent: '#ffe066' } }; }
function near(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= tol, msg + ': ' + a + ' vs ' + b); }
test('levelFactor satura no 30 e pesa a égua', function () {
  assert.strictEqual(B.levelFactor(mk2({ sex: 'f', level: 30 }), mk2({ level: 30 })), 1);
  near(B.levelFactor(mk2({ sex: 'f', level: 1 }), mk2({ level: 1 })), 1 / 30, 1e-9, 'lv1');
  near(B.levelFactor(mk2({ sex: 'f', level: 30 }), mk2({ level: 0 })), 0.6, 1e-9, 'égua 60%');
  assert.strictEqual(B.levelFactor(mk2({ sex: 'f', level: 50 }), mk2({ level: 50 })), 1);
});
test('rarityOdds: dois Raros nível 30 = Mágico 30 / Raro 65 / Lendário 5 / Mítico 0', function () {
  var o = B.rarityOdds(mk2({ sex: 'f' }), mk2({}));
  near(o.magico, 0.30, 1e-9, 'magico'); near(o.raro, 0.65, 1e-9, 'raro'); near(o.lendario, 0.05, 1e-9, 'lendario'); assert.strictEqual(o.mitico, 0); near(o.comum, 0, 1e-9, 'comum');
});
test('rarityOdds: Raro × Lendário nível 30 = Mágico 20 / Raro 50 / Lendário 30; dois Comuns nível 1 = Comum 99 / Mágico 1', function () {
  var o = B.rarityOdds(mk2({ sex: 'f', rarity: 'raro' }), mk2({ rarity: 'lendario' }));
  near(o.magico, 0.20, 1e-9, 'm'); near(o.raro, 0.50, 1e-9, 'r'); near(o.lendario, 0.30, 1e-9, 'l');
  var c = B.rarityOdds(mk2({ sex: 'f', rarity: 'comum', level: 1 }), mk2({ rarity: 'comum', level: 1 }));
  // L = 1/30: "1 abaixo" (44,5%) cai em Comum; igual 54,37%; 1 acima 1,117%; 2 acima 0,017%
  near(c.comum, 0.9887, 0.002, 'comum'); near(c.magico, 0.0112, 0.002, 'magico'); assert.ok(c.raro < 0.001 && c.lendario === 0 && c.mitico === 0);
});
test('grauOdds e rollGrau', function () {
  var g = B.grauOdds(mk2({ sex: 'f', grau: 2 }), mk2({ grau: 2 }));
  near(g[1], 0.10, 1e-9, 'desce'); near(g[2], 0.50, 1e-9, 'mantém'); near(g[3], 0.40, 1e-9, 'sobe');
  var top = B.grauOdds(mk2({ sex: 'f', grau: 3 }), mk2({ grau: 3 })); near(top[3], 0.90, 1e-9, '★★★ mantém+sobe');
  assert.strictEqual(B.rollGrau(S.mulberry32(1), mk2({ sex: 'f' }), mk2({}), 1), 1); assert.strictEqual(B.rollGrau(S.mulberry32(1), mk2({ sex: 'f' }), mk2({}), -1), 3);
});
test('rollRarity reproduz as chances em 20 mil sorteios e nunca dá mítico', function () {
  var rng = S.mulberry32(777), n = { comum: 0, magico: 0, raro: 0, lendario: 0, mitico: 0 };
  for (var i = 0; i < 20000; i++) n[B.rollRarity(rng, mk2({ sex: 'f' }), mk2({}))]++;
  near(n.magico / 200, 30, 2, 'magico %'); near(n.raro / 200, 65, 2, 'raro %'); near(n.lendario / 200, 5, 1, 'lendario %'); assert.strictEqual(n.mitico, 0);
  var nl = { comum: 0, magico: 0, raro: 0, lendario: 0, mitico: 0 }, r2 = S.mulberry32(778);
  for (i = 0; i < 20000; i++) nl[B.rollRarity(r2, mk2({ sex: 'f', rarity: 'lendario' }), mk2({ rarity: 'lendario' }))]++;
  assert.strictEqual(nl.mitico, 0); near(nl.lendario / 200, 70, 2, 'dois lendários: 65 + 5 dobrado');
});
test('rentalPrice e isCorcel', function () {
  assert.strictEqual(B.rentalPrice(mk2({ rarity: 'comum', grau: 2 })), 125); assert.strictEqual(B.rentalPrice(mk2({ rarity: 'lendario', grau: 3 })), 2250);
  assert.strictEqual(B.rentalPrice(mk2({ rarity: 'mitico', grau: 3 })), null);
  assert.strictEqual(B.isCorcel(mk2({ rarity: 'raro', skills: ['arranque', 'sprint', 'drift'] })), true);
  assert.strictEqual(B.isCorcel(mk2({ rarity: 'raro', skills: ['arranque', 'sprint'] })), false);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `require('../src/breed.js')` falha (arquivo inexistente).
- [ ] **Step 3: Implementar `breed.js`** com o cabeçalho de comentário no estilo do `sim.js` (modelo, ordem de RNG — a
  ordem completa é fixada na tarefa 3), as funções acima, e o UMD. Encaixar no `build.mjs` e no `index.html`.
- [ ] **Step 4: Rodar e ver passar**; `node prototype/build.mjs` (o `dist/` passa a conter `breed.js`).
- [ ] **Step 5: Commit** — `git commit -m "Cruzamento: chances e sorteio de raridade e grau (breed.js)"`

---

### Task 3: `breed.js` — o potro completo

**Files:**
- Modify: `prototype/src/breed.js`
- Test: `sim-test.js`, seção `cruzamento` (parte 2)

**Interfaces:**
- Consumes: tarefa 2; `GameData.STAT_KEYS`, `SKILLS`, `FOAL_NAMES`, `BREED_LEFT`, `RARITIES[*].baseLo/bornSkills/skillSlots`.
- Produces:
  - `Breed.GRAU_WINDOW = [[0, 8], [5, 11], [8, 16]]` (offsets sobre `baseLo`), `Breed.GRAU_POT_FLOOR = [0, 8, 16]`.
  - `Breed.hexMix(a, b, t) -> '#rrggbb'` (canal a canal, `Math.round`).
  - `Breed.foal({ f, m, seedBase, breedCounter, nextUid }) -> mount` seguindo a spec §7 na ordem exata de chamadas
    de `rng`: (1) raridade; (2) grau se a raridade não mudou; (3) elemento se diferentes; (4) sexo; (5) 7 status base
    em `STAT_KEYS`; (6) potencial: por status `rng() < potInherit` → `rng() < 0.5 ? f : m` (2 chamadas) senão
    `floor(rng()·32)` (2 chamadas: porta + valor); (7) skills: corcel `g`; se `g === 1`, `rng() < 0.5 → 2`; garantidas
    sorteadas sem reposição (`floor(rng()·restantes)` cada); candidatas restantes na ordem f→m com `rng() < skillInherit`;
    corte em `skillSlots`; preenchimento até `bornSkills` com `floor(rng()·pool.length)` cada; (8) nome `floor(rng()·N)`;
    (9) paleta `t = 0.3 + 0.4·rng()`.
    Retorna `{ uid: 'm' + nextUid, templateId: null, name, especie: 'cavalo', element, rarity, grau, sex, level: 1, xp: 0,
    skills, base, potential, palette, breedLeft: BREED_LEFT[sex], parents: { f: { uid: f.uid || null, name: f.name },
    m: { uid: m.uid || null, name: m.name } }, born: breedCounter, gestacao: null }`. Potencial com piso do grau
    aplicado por `Math.max`. Paleta: se só um pai tem `palette`, usa a dele; se nenhum, `null`.
  - `Breed.skillCandidates(f, m, element) -> [ids]` (sem exclusivas, compatíveis, sem repetição, ordem f→m) — exportada
    para a calculadora listar "pode herdar: …".

- [ ] **Step 1: Testes (seção `cruzamento`, parte 2)**

```js
test('foal é determinístico e tem o formato da spec', function () {
  var f = mk2({ uid: 'm1', name: 'Maré', sex: 'f', element: 'agua' }), m = mk2({ uid: 'm2', name: 'Brasa', element: 'fogo' });
  var a = B.foal({ f: f, m: m, seedBase: 123, breedCounter: 0, nextUid: 3 }), b = B.foal({ f: f, m: m, seedBase: 123, breedCounter: 0, nextUid: 3 });
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); assert.strictEqual(a.uid, 'm3'); assert.strictEqual(a.templateId, null); assert.strictEqual(a.level, 1);
  assert.ok(a.element === 'agua' || a.element === 'fogo'); assert.ok(a.sex === 'm' || a.sex === 'f'); assert.strictEqual(a.breedLeft, G.BREED_LEFT[a.sex]);
  assert.deepStrictEqual(a.parents, { f: { uid: 'm1', name: 'Maré' }, m: { uid: 'm2', name: 'Brasa' } }); assert.strictEqual(a.born, 0); assert.strictEqual(a.gestacao, null);
  assert.ok(G.FOAL_NAMES.indexOf(a.name) >= 0); assert.ok(/^#[0-9a-f]{6}$/.test(a.palette.coat));
  assert.notStrictEqual(JSON.stringify(a), JSON.stringify(B.foal({ f: f, m: m, seedBase: 123, breedCounter: 1, nextUid: 3 })));
});
test('status na janela do grau, potencial ≥ piso, skills dentro das vagas e compatíveis', function () {
  for (var s = 0; s < 2000; s++) {
    var f = mk2({ sex: 'f', skills: ['labareda', 'sprint'], element: 'fogo' }), m = mk2({ skills: ['pe-na-chuva', 'drift'], element: 'agua' });
    var c = B.foal({ f: f, m: m, seedBase: s, breedCounter: 0, nextUid: 1 });
    var lo = G.RARITIES[c.rarity].baseLo, w = B.GRAU_WINDOW[c.grau - 1];
    G.STAT_KEYS.forEach(function (k) { assert.ok(c.base[k] >= lo + w[0] && c.base[k] <= lo + w[1], 'base ' + k); assert.ok(c.potential[k] >= B.GRAU_POT_FLOOR[c.grau - 1] && c.potential[k] <= 31, 'pot ' + k); });
    var R = G.RARITIES[c.rarity]; assert.ok(c.skills.length <= R.skillSlots && c.skills.length >= Math.min(R.bornSkills, R.skillSlots), 'skills ' + c.skills.join());
    c.skills.forEach(function (id) { var sk = G.SKILLS[id]; assert.ok(sk && !sk.exclusive, 'exclusiva ' + id); assert.ok(sk.element === 'neutro' || sk.element === c.element, 'elemento ' + id); });
    assert.strictEqual(new Set(c.skills).size, c.skills.length); assert.notStrictEqual(c.rarity, 'mitico');
  }
});
test('raridade subiu ⇒ ★, desceu ⇒ ★★★; elemento igual ⇒ igual, diferente ⇒ ~50/50', function () {
  var up = 0, down = 0, same = 0, agua = 0, N = 20000;
  for (var s = 0; s < N; s++) {
    var c = B.foal({ f: mk2({ sex: 'f', element: 'agua' }), m: mk2({ element: 'fogo' }), seedBase: 5, breedCounter: s, nextUid: 1 });
    if (c.rarity === 'lendario') { up++; assert.strictEqual(c.grau, 1); } else if (c.rarity === 'magico') { down++; assert.strictEqual(c.grau, 3); } else same++;
    if (c.element === 'agua') agua++;
  }
  near(agua / N * 100, 50, 2, 'elemento 50/50'); near(down / N * 100, 30, 2, 'desceu'); near(up / N * 100, 5, 1, 'subiu');
  for (s = 0; s < 200; s++) assert.strictEqual(B.foal({ f: mk2({ sex: 'f', element: 'grama' }), m: mk2({ element: 'grama' }), seedBase: 9, breedCounter: s, nextUid: 1 }).element, 'grama');
});
test('grau igual: distribuição 10/50/40 no nível 30; sexo 50/50', function () {
  var g = [0, 0, 0, 0], fem = 0, n = 0;
  for (var s = 0; s < 20000; s++) { var c = B.foal({ f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 11, breedCounter: s, nextUid: 1 }); if (c.sex === 'f') fem++; if (c.rarity === 'raro') { g[c.grau]++; n++; } }
  near(g[1] / n * 100, 10, 2, '★'); near(g[2] / n * 100, 50, 2, '★★'); near(g[3] / n * 100, 40, 2, '★★★'); near(fem / 200, 50, 2, 'fêmeas %');
});
test('corcel garante herança; odds() bate com a frequência', function () {
  var f = mk2({ sex: 'f', skills: ['arranque', 'sprint', 'drift'] }), m = mk2({ skills: ['arranque', 'sprint', 'drift'], element: 'fogo' });
  for (var s = 0; s < 500; s++) { var c = B.foal({ f: f, m: m, seedBase: 21, breedCounter: s, nextUid: 1 }); var inh = c.skills.filter(function (id) { return ['arranque','sprint','drift'].indexOf(id) >= 0; }).length; assert.ok(inh >= Math.min(2, G.RARITIES[c.rarity].skillSlots), 'herdadas ' + c.skills.join()); }
  var o = B.odds(f, m), n = { comum: 0, magico: 0, raro: 0, lendario: 0, mitico: 0 };
  for (s = 0; s < 20000; s++) n[B.foal({ f: f, m: m, seedBase: 31, breedCounter: s, nextUid: 1 }).rarity]++;
  ['magico', 'raro', 'lendario'].forEach(function (r) { near(n[r] / 200, o.rarity[r] * 100, 2, r); });
});
test('uid distinto mesmo com nomes iguais', function () {
  var saved = G.FOAL_NAMES; G.FOAL_NAMES = ['Xodó'];
  var a = B.foal({ f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 1, breedCounter: 0, nextUid: 5 }), b = B.foal({ f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 1, breedCounter: 1, nextUid: 6 });
  G.FOAL_NAMES = saved; assert.strictEqual(a.name, b.name); assert.notStrictEqual(a.uid, b.uid);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `B.foal` indefinido.
- [ ] **Step 3: Implementar** conforme Interfaces; documentar a ordem de RNG no cabeçalho.
- [ ] **Step 4: Rodar e ver passar**; build; o tempo da seção `cruzamento` deve ficar ≤ 5 s.
- [ ] **Step 5: Commit** — `git commit -m "Cruzamento: geração completa do potro (elemento, sexo, status, potencial, skills, nome, paleta)"`

---

### Task 4: Save v3 — várias montarias e montaria ativa (`game.js`)

**Files:**
- Modify: `prototype/src/game.js` — `newState` l.188–206, `sanitize` l.208–235, `validSkills` l.239–253, `playerHorse` l.255–262,
  `renderEstabulo` l.559–634 (só o que lê `state.level/xp/skills`), `settle` l.910–965, handler `escolher` l.1623, `snapshot`
- Modify: `prototype/tools/ui-test.mjs` l.213–224 (contexto do save antigo) + contexto novo `save v3 corrompido`
- Test: build + `ui-test.mjs`

**Interfaces:**
- Consumes: `GameData.BREED_LEFT`, `ECONOMY.breeding`, `allHorses()`, `horseById()`.
- Produces:
  - Save v3 (spec §3.2): `{ v: 3, rev, gold, inventory, equipped, tier, seedBase, raceCounter, pending, races, wins, podiums,
    goldWon, mounts: [], activeId, nextUid, stableSlots, breedCounter }`. **Sem** `starterId/level/xp/skills` na raiz.
  - `instanceFromTemplate(tpl, uid) -> mount` (campos da spec §3.1: `templateId: tpl.id`, `grau: tpl.grau || 2`, `level: 1`
    para iniciais, `breedLeft: tpl.breedLeftMax || BREED_LEFT[tpl.sex]`, `parents: null`, `born: 0`, `gestacao: null`,
    cópias de `base/potential/palette/skills`).
  - `newState(starterId)` → `mounts: [instanceFromTemplate(STARTER, 'm1')]`, `activeId: 'm1'`, `nextUid: 2`,
    `stableSlots: breeding.stableSlotsStart`, `breedCounter: 0`.
  - `sanitize(s)`: aceita v1/v2 (migra: `mounts[0]` do `starterId` com `level/xp/skills` do save, `grau 2`) e v3
    (`sanitizeMount(m) -> mount|null` por item: tipos, faixas, `skills` via `validSkills(list, mount)` generalizado —
    exclusiva só se `sk.exclusive === mount.templateId`; `base` 1–100 e `potential` 0–31 nas 7 chaves, senão `null`;
    `palette` com 4 cores `#rrggbb` ou `null`; `name` string cortada em 16 e ≥ 2 senão `'Montaria'`; `grau` 1–3; `sex` m/f;
    `breedLeft` 0–4; `parents` com o formato ou `null`; `uid` `/^m\d+$/` único — duplicado ⇒ descartado).
    `mounts` vazio ⇒ recria `instanceFromTemplate(STARTERS[0], 'm1')`. `activeId` inexistente ⇒ `mounts[0].uid`.
    `nextUid` ≥ maior uid + 1. `stableSlots` em `[stableSlotsStart, stableSlotsMax]`, nunca menor que `mounts.length`.
  - `activeMount() -> mount` (instância, para mutar) e `playerHorse() -> clone(activeMount())`.
  - `applyXp(mount, xpGain, seedTag) -> { levels, learned }`: o laço de níveis + aprendizado que hoje está em `settle`
    (rng `hash2(state.seedBase, seedTag * 100 + nívelAlcançado)`); `settle` chama `applyXp(activeMount(), xpGain,
    state.raceCounter)`; `before/after` leem da ativa.
  - `window.__galope` inalterado (`state` expõe `mounts`).

- [ ] **Step 1: Atualizar `ui-test.mjs`**: no contexto do save antigo (fixture v1 de Maré), a asserção vira
  `s.mounts.length === 1 && s.mounts[0].templateId === 'mare' && JSON.stringify(s.mounts[0].skills) === '["mare-alta"]' && s.activeId === 'm1' && s.gold === 777 && s.level === undefined`.
  Novo contexto `save v3 corrompido`: `addInitScript` grava `{"v":3,"rev":1,"gold":555,"inventory":[],"equipped":null,"tier":50,"seedBase":9,"raceCounter":0,"pending":null,"races":0,"wins":0,"podiums":0,"goldWon":0,"mounts":[{"uid":"m1","templateId":"brasa","name":"Ok","element":"fogo","rarity":"raro","grau":2,"sex":"m","level":3,"xp":0,"skills":["labareda"],"base":{"vel":64,"acel":62,"man":60,"forca":52,"est":58,"garra":62,"sorte":50},"potential":{"vel":1,"acel":1,"man":1,"forca":1,"est":1,"garra":1,"sorte":1},"palette":null,"breedLeft":2,"parents":null,"born":0},{"uid":"m2","templateId":null,"name":"Quebrado","element":"fogo","rarity":"xxx","grau":9,"sex":"m","level":1,"xp":0,"skills":[],"base":{},"potential":{},"palette":null,"breedLeft":2,"parents":null,"born":0}],"activeId":"m9","nextUid":1,"stableSlots":1,"breedCounter":0}`
  e verifica no estábulo: `mounts.length === 1`, `activeId === 'm1'`, `gold === 555`, `stableSlots === 3`, `nextUid >= 2`, sem erro de console.
  Terceiro contexto `save v2`: fixture `{"v":2,"rev":2,"starterId":"brasa","level":7,"xp":40,"gold":321,"inventory":["sela-couro"],"equipped":"sela-couro","skills":["labareda","sprint"],"tier":100,"seedBase":77,"raceCounter":3,"pending":null,"races":3,"wins":1,"podiums":2,"goldWon":150}`
  ⇒ `mounts[0].templateId === 'brasa'`, `level === 7`, `xp === 40`, `JSON.stringify(skills) === '["labareda","sprint"]'`, `equipped === 'sela-couro'`, `gold === 321`, `tier === 100`.
  Rodar: FALHA (campos novos inexistentes).
- [ ] **Step 2: Implementar** conforme Interfaces. `renderEstabulo` continua mostrando só a ativa (a lista vem na tarefa 5).
- [ ] **Step 3: Build + `ui-test.mjs`** (com `SHOTS_DIR` no scratchpad) → `OK`. `node prototype/tools/sim-test.js` segue verde.
- [ ] **Step 4: Commit** — `git commit -m "Save v3: várias montarias, montaria ativa e migração dos saves antigos"`

---

### Task 5: Estábulo com lista de montarias

**Files:**
- Modify: `prototype/src/game.js` — `renderEstabulo`, handler (novos `case`), `ui` (campos `confirmLiberar`)
- Modify: `prototype/src/game.css` — `.montarias`, `.montaria`, `.montaria--ativa`, `.estrelas`, `.corcel`, `.montaria-acoes`
- Modify: `prototype/tools/ui-test.mjs`
- Test: build + `ui-test.mjs`

**Interfaces:**
- Consumes: tarefa 4; `Breed.isCorcel`, `ECONOMY.breeding.stableSlotPrice/stableSlotsMax`.
- Produces:
  - `estrelasHtml(grau)` (`'<span class="estrelas" aria-label="Grau N">★★☆</span>'`), `mountCardHtml(m, isActive)`
    (retrato, nome + `<small>#n</small>` do uid, raridade + estrelas, elemento, ♂/♀, Nv, "cruza Nx", ícone `corcel` se
    `Breed.isCorcel`, badge "Ativa"; botões `data-acao="ativar" data-id="uid"` (desabilitado se ativa ou `state.pending`),
    `renomear`, `liberar` (desabilitado se ativa, se é a única, ou se `state.pending`)).
  - Seção "Suas montarias (n/stableSlots)" acima do cartão da ativa; botões `haras` (leva à tela da tarefa 6; nesta tarefa
    navega e a tela mostra "em construção") e `expandir` (desabilitado se `gold < stableSlotPrice` ou `stableSlots >= max`).
  - Handler: `ativar` (`activeId = id`; persist; rerender), `renomear` (`window.prompt('Novo nome (2–16 letras)', nome)`;
    `trim()`, 2–16 caracteres senão ignora; persist), `liberar` → `ui.confirmLiberar = id` + `liberar-sim`/`liberar-nao`
    (como o reset), `expandir` (debita, `stableSlots++`), `haras` (`go('haras')`).
  - `render()` ganha `case 'haras'` (placeholder nesta tarefa).

- [ ] **Step 1: `ui-test.mjs`** — no fluxo mobile, depois do estábulo inicial: `page.evaluate(() => { window.prompt = () => '<b>x</b>' })`,
  clicar `renomear` da ativa, verificar `state.mounts[0].name === '<b>x</b>'`, que `document.querySelector('.montaria--ativa .cavalo-nome').innerHTML`
  **não** contém `<b>` (escapado) e que `.cavalo-nome` mostra `#1`; `prompt = () => 'Brasa'` e renomear de volta; `state.gold = 2000` + rerender
  (clique em `Sem item`), clicar `expandir` → `stableSlots === 4` e `gold === 1700`; botão `liberar` da ativa está `disabled`. Rodar: FALHA.
- [ ] **Step 2: Implementar.** CSS mínimo (grade de cartões, 1 coluna no celular, 2 no desktop).
- [ ] **Step 3: Build + ui-test → OK.**
- [ ] **Step 4: Commit** — `git commit -m "Estábulo: lista de montarias com ativa, renomear, liberar e expansão"`

---

### Task 6: Haras — cruzar e trocar

**Files:**
- Modify: `prototype/src/game.js` — `renderHaras` (novo), handler (`haras-mine`, `haras-tab`, `haras-partner`, `cruzar`, `troca`,
  `troca-sim`, `troca-nao`, `haras-ativar`), `ui.haras`
- Modify: `prototype/src/game.css` — `.haras-*`, `.calc`
- Modify: `prototype/tools/ui-test.mjs` (contexto novo `cruzamento`, com `createRequire` para `../src/data.js`, `../src/sim.js`,
  `../src/breed.js`)
- Test: build + ui-test

**Interfaces:**
- Consumes: `Breed.odds/foal/rentalPrice/isCorcel/skillCandidates`, tarefas 4–5.
- Produces:
  - `ui.haras = { mine: uid|null, tab: 'minhas'|'aluguel', partner: { kind: 'own'|'rent', id }|null, mode: 'cruzar'|'troca', result: uid|null }`;
    ao entrar: `mine` = ativa se `breedLeft ≥ 1` senão a primeira com `breedLeft ≥ 1` senão `null`; `tab` = `'aluguel'`.
  - `renderHaras()`: seletor "Sua montaria" (cartões compactos, só `breedLeft ≥ 1`; na Troca, todos), abas "Minhas" (sexo oposto,
    `breedLeft ≥ 1`; na Troca, qualquer contagem) e "Aluguel" (`WILD_HORSES` de sexo oposto, não míticos, com preço
    `Breed.rentalPrice`), **calculadora** (`Breed.odds`): barras com as chances de raridade, "se mantiver a raridade: ★ x% ★★ y% ★★★ z%",
    elemento(s) possível(is), "pode herdar: …" (`skillCandidates`), "Corcel: herança garantida" quando aplicável; custo; avisos:
    sem vaga ("Estábulo cheio: libere uma montaria ou expanda"), sem Ouro, `state.pending` ("Termine o páreo aberto"); botões
    `cruzar` (desabilitado nos avisos) e `troca` (só com parceiro `own`; confirmação "Os dois pais deixam de existir" via `troca-sim`).
    Resultado: cartão do potro (`mountCardHtml`) com "Nasceu X!", `haras-ativar` e "Cruzar de novo".
  - `cruzar`: valida tudo de novo; `price` = `rentalPrice(parceiro)` (aluguel) ou `ownRegistration`; `state.gold -= price`;
    `foal = Breed.foal({ f, m, seedBase: state.seedBase, breedCounter: state.breedCounter, nextUid: state.nextUid })` onde `f` é a
    fêmea e `m` o macho entre {sua, parceiro}; `state.nextUid++`, `state.breedCounter++`; `breedLeft--` nos pais seus; `mounts.push(foal)`;
    `persist()`; `ui.haras.result = foal.uid`.
  - `troca`: dois seus de sexos opostos; `state.gold -= exchange`; `foal` idem; remove os dois de `mounts`; `push(foal)`; se um deles
    era a ativa → `activeId = foal.uid`; persist.
- `ui-test.mjs`, contexto `cruzamento` (390×844): escolher Brasa; `evaluate`: `state.gold = 5000; state.seedBase = SEED` (SEED escolhido no
  Node, 1..200, tal que `Breed.foal({ f: Faísca, m: Brasa(lv1), seedBase: SEED, breedCounter: 0, nextUid: 2 }).sex === 'f'`); rerender;
  `haras` → aba Aluguel → clicar Faísca (preço esperado 125) → `cruzar`; conferir: `gold === 5000 − 125`, `mounts.length === 2`,
  `JSON.stringify(mounts[1]) === JSON.stringify(esperado)` (o potro calculado no Node com os mesmos pais — Brasa como instância
  `m1` lv1 com skills `['labareda']`, Faísca como template — **determinismo ponta a ponta**), `breedCounter === 1`; `haras-ativar` → `activeId === 'm2'`;
  voltar, `Procurar corrida` → `Largar` → `Pular` → resultado (potro correu); voltar ao estábulo; **estábulo cheio**: `evaluate`
  `state.stableSlots = state.mounts.length` + rerender, abrir Haras: botão `cruzar` `disabled` e aviso presente; restaurar slots;
  **pending bloqueia**: `Procurar corrida` (abre sala) → voltar → no estábulo `ativar` está `disabled`; correr/pular para fechar;
  **Troca**: Haras, modo Troca, Brasa (m, `breedLeft` 2) × potro (f) → `troca` → `troca-sim`: `mounts.length === 1`,
  `mounts[0].uid === 'm3'`, `activeId === 'm3'`, `gold` − 50; **recarregar** a página e conferir que `mounts.length === 1` e `activeId === 'm3'`
  continuam (persistência). Captura `final-06-haras.png` na tela do Haras com a calculadora.
- [ ] **Step 1: escrever os passos do ui-test; rodar: FALHA.**
- [ ] **Step 2: Implementar.**
- [ ] **Step 3: Build + ui-test → OK; sim-test verde.**
- [ ] **Step 4: Commit** — `git commit -m "Haras: cruzar com aluguel ou montaria própria, calculadora e Troca"`

---

### Task 7: Painel de desenvolvimento e verificação completa

**Files:**
- Modify: `prototype/src/game.js` — `render()` (anexa o painel quando `location.search` contém `dev=1`), handler (`dev-niveis`, `dev-ouro`, `dev-cruz`)
- Modify: `prototype/src/game.css` — `.dev-painel` (fixo no rodapé, fundo escuro, 3 botões)
- Modify: `prototype/tools/ui-test.mjs` (contexto `cruzamento` passa a abrir `preview.html?dev=1` e usa `dev-niveis` antes de cruzar)
- Test: `./scripts/check.sh`

**Interfaces:**
- Consumes: `applyXp` (tarefa 4).
- Produces: `dev-niveis` → `applyXp(activeMount(), xpParaSubir10Níveis, 9e6 + state.breedCounter)` (soma `E.xpToLevel` dos 10
  próximos níveis), `dev-ouro` → `gold += 1000`, `dev-cruz` → `activeMount().breedLeft++` (máx. 4); todos persistem e rerenderizam.
  Sem `?dev=1` nada é renderizado nem tratado.
- `ui-test.mjs`: no contexto `cruzamento`, após escolher Brasa: `dev-niveis` → `mounts[0].level === 11`; o potro esperado no Node usa Brasa
  **lv11** (recalcular `level` e as `skills` aprendidas: para bater, o teste lê `mounts[0]` da página via `evaluate` e usa esse objeto
  como `m` no `Breed.foal` do Node — o determinismo ponta a ponta continua). Contexto sem `?dev=1`: `document.querySelector('.dev-painel') === null`.
- [ ] **Step 1: ajustar o ui-test; FALHA.** **Step 2: Implementar.** **Step 3: `./scripts/check.sh` → `VERIFICAÇÃO COMPLETA: OK`.**
- [ ] **Step 4: Commit** — `git commit -m "Painel dev (?dev=1) para testar cruzamento em nível alto"`

---

### Task 8: Documentação, capturas e memória

**Files:**
- Modify: `docs/GDD.md` (nova seção `## 6. Estábulo e cruzamento` com: vagas, grau, haras, tabelas de raridade/grau, Corcel, Troca,
  "Mítico só por despertar"; remover "Regras de breeding" da lista "6+" e renumerar para "7+"), `docs/exemplos.md` (nova `## 13. Cruzamento`:
  tabelas de chances, preços, 3 potros de exemplo gerados por `node -e` com seeds fixas — pais Maré lv30 ★★ × Brasa lv30 ★★, Pangaré × Faísca lv1,
  Raro ★★★ × Lendário ★★★ lv30), spec `## 14. Histórico de ajustes` (o que mudou na implementação, se algo mudou), `CLAUDE.md` §8
  (+ "Potro gerado só pela RNG da seed (`breed.js`); Mítico nunca nasce de cruzamento"), `prototype/src/breed.js` cabeçalho conferido,
  `docs/memoria/ESTADO.md` (subprojeto 2 concluído na branch; próximos passos), `docs/memoria/decisoes.md` (grau como sub-tier; Mítico fora
  do cruzamento; saturação no 30; égua 60%), `prototype/screens/*.png` regenerados (`node prototype/tools/ui-test.mjs` sem `SHOTS_DIR`).
- Test: `./scripts/check.sh`
- [ ] **Step 1: escrever os docs; Step 2: capturas; Step 3: `check.sh` OK; Step 4: Commit** —
  `git commit -m "Documenta estábulo, haras e cruzamento; capturas e memória"`
