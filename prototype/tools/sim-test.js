// prototype/tools/sim-test.js — node prototype/tools/sim-test.js
'use strict';
var assert = require('assert');
var G = require('../src/data.js');
var S = require('../src/sim.js');
var B = require('../src/breed.js');
var GR = require('../src/gear.js');
var fails = 0, count = 0;
function section(t) { console.log('\n## ' + t); }
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
test('toda montaria tem 7 de genética (sem status base), sexo, raridade válida e skills ≤ vagas', function () {
  G.STARTERS.concat(G.WILD_HORSES).forEach(function (h) {
    assert.ok(!('base' in h), h.id + ' sem base');
    G.STAT_KEYS.forEach(function (k) { assert.ok(h.potential[k] >= 0 && h.potential[k] <= 31 && h.potential[k] === Math.floor(h.potential[k]), h.id + ' pot ' + k); });
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
  assert.ok(!G.ITEMS, 'catálogo antigo de itens removido');
});

section('status');
test('computeStats devolve 7 chaves e respeita o teto da raridade', function () {
  var h = JSON.parse(JSON.stringify(G.STARTERS[0])); h.level = 50; h.alloc = { vel: 20, acel: 20 };
  var s = S.computeStats(h, null);
  assert.deepStrictEqual(Object.keys(s), G.STAT_KEYS);
  assert.strictEqual(s.vel, 80, 'comum teto 80'); assert.strictEqual(s.acel, 80, 'sem bônus fixo de elemento');
});
test('skillChance: comum lv1 sorte 0 = 0.35; mítico lv50 sorte 100 = 0.95 (teto); raro lv10 sorte 50 ≈ 0.645', function () {
  var mk = function (r, lv) { return { rarity: r, level: lv }; };
  assert.strictEqual(S.skillChance(mk('comum', 1), { sorte: 0 }), 0.35);
  assert.strictEqual(S.skillChance(mk('mitico', 50), { sorte: 100 }), 0.95);
  assert.ok(Math.abs(S.skillChance(mk('raro', 10), { sorte: 50 }) - 0.645) < 1e-9);
});
test('powerRating usa os 7 pesos', function () {
  var h = JSON.parse(JSON.stringify(G.STARTERS[0])); var s = S.computeStats(h, null), w = S.TUNING.ratingW, sum = 0;
  G.STAT_KEYS.forEach(function (k) { sum += s[k] * w[k]; });
  assert.deepStrictEqual(w, { vel: 3.1, acel: 1.4, man: 1.45, est: 2.4, forca: 3.3, garra: 1.3, sorte: 0.2 });
  // os iniciais nascem sem skill; a skill de tipo vale 80 × P (Comum nível 1: P = 1)
  assert.strictEqual(S.powerRating(h, null), Math.round(sum + 80 * 1));
  h.skills = ['arranque']; assert.strictEqual(S.powerRating(h, null), Math.round(sum + 18 * 1 + 80 * 1));   // arranque: start = 1
  h.level = 50; s = S.computeStats(h, null); sum = 0; G.STAT_KEYS.forEach(function (k) { sum += s[k] * w[k]; });
  assert.strictEqual(S.powerRating(h, null), Math.round(sum + 18 + 80 * S.typePower(h)));
});
test('learnSkill não estoura vagas e respeita o elemento', function () {
  var full = { id: 'x', element: 'fogo', rarity: 'comum', skills: ['arranque'] };
  assert.strictEqual(S.learnSkill(full, function () { return 0; }), null);
  var m = { id: 'x', element: 'fogo', rarity: 'mitico', skills: [] }, seen = {};
  for (var i = 0; i < 400; i++) { var id = S.learnSkill(m, S.mulberry32(i)); if (id) seen[id] = 1; }
  assert.ok(seen.arranque && seen['sol-a-pino'], 'aprende gerais e do elemento');
  assert.ok(!seen['pe-na-chuva'], 'não aprende de outro elemento');
});

section('status v3');
function clone(x) { return JSON.parse(JSON.stringify(x)); }
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
  assert.strictEqual(G.ECONOMY.gear.plusStep, 0.5);
  // uma peça Rara +3 soma 3 + 3 × 0,5 = 4,5 ao status principal; o secundário não muda com o +N
  var g = GR.resolve({ equip: { ferraduras: 'i1' } }, { i1: { uid: 'i1', id: 'ferraduras-sol-raro', plus: 3 } });
  assert.strictEqual(g.mods.vel, 4.5); assert.strictEqual(g.mods.acel, 2);
  var g10 = GR.resolve({ equip: { ferraduras: 'i1' } }, { i1: { uid: 'i1', id: 'ferraduras-sol-raro', plus: 10 } });
  assert.strictEqual(g10.mods.vel, 8);
  // natural 40 + 16/31 = 40,516: arredondar no fim dá round(45,016) = 45 (arredondar antes daria 41 + 5 = 46)
  var h = { rarity: 'comum', level: 1, grau: 2, potential: { vel: 1 } };
  assert.strictEqual(S.computeStats(h, g).vel, 45);
  assert.strictEqual(S.computeStats(h, null).vel, 41);
});
test('v3: estrelas, status natural, alloc saneado na ordem de STAT_KEYS e allocInfo', function () {
  assert.strictEqual(S.starsOf({ grau: 1 }), 1); assert.strictEqual(S.starsOf({ grau: 3 }), 3);
  [undefined, null, 'x', NaN, Infinity].forEach(function (g) { assert.strictEqual(S.starsOf({ grau: g }), 2, String(g)); });
  assert.strictEqual(S.starsOf(null), 2); assert.strictEqual(S.starsOf({}), 2);
  // como Breed.grauOf: fora da faixa é preso a 1–3
  assert.strictEqual(S.starsOf({ grau: 0 }), 1); assert.strictEqual(S.starsOf({ grau: 7 }), 3); assert.strictEqual(S.starsOf({ grau: '3' }), 3);
  var h = clone(G.STARTERS[0]); h.level = 50;   // ★★: 58 pontos, até 20 por status
  assert.ok(Math.abs(S.naturalStat(h, 'vel') - (40 + 16 * 24 / 31 + 49 * (0.30 + 0.08 * 24 / 31))) < 1e-9);
  assert.deepStrictEqual(S.validAlloc(h, { vel: 25, acel: 20, man: 20, forca: 20 }), { vel: 20, acel: 20, man: 18, forca: 0, est: 0, garra: 0, sorte: 0 });
  assert.deepStrictEqual(S.validAlloc(h, null), { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 });
  h.alloc = { vel: 4, est: 10 };
  var info = S.allocInfo(h);
  assert.strictEqual(info.free, 58); assert.strictEqual(info.used, 14); assert.strictEqual(info.left, 44); assert.strictEqual(info.perStat, 20);
  // vel natural 70,12 + 4 = 74,12: faltam 5,88 até o teto 80 → aceita min(20 − 4, 44, teto(5,88)) = 6
  assert.strictEqual(info.room.vel, 6);
  // est natural 62,41 + 10 = 72,41: faltam 7,59 → 8 (limite 20 − 10 = 10)
  assert.strictEqual(info.room.est, 8);
  // sorte natural 62,41: faltam 17,59 → 18 (limite 20)
  assert.strictEqual(info.room.sorte, 18);
  h.alloc = { vel: 20, acel: 20, man: 18 };
  assert.deepStrictEqual(Object.keys(S.allocInfo(h).room).map(function (k) { return S.allocInfo(h).room[k]; }), [0, 0, 0, 0, 0, 0, 0]);
});
test('v3: no nível 1 limite, alloc e allocInfo dão zero (nunca −0)', function () {
  var h = { rarity: 'comum', level: 1, grau: 3, potential: {}, alloc: { vel: 5, acel: 2 } }, zeros = { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 };
  assert.strictEqual(S.statLimit(h), 0);
  assert.deepStrictEqual(S.validAlloc(h, h.alloc), zeros);
  assert.deepStrictEqual(S.allocInfo(h), { free: 0, used: 0, left: 0, perStat: 0, room: zeros });
});

section('Poder, bots e ligas v3');
function refBot(el, rarity, level, g, grau) {
  var h = { id: 'ref', name: 'Ref', element: el, rarity: rarity, level: level, grau: grau || 2, potential: {}, skills: [] };
  G.STAT_KEYS.forEach(function (k) { h.potential[k] = g; });
  h.alloc = S.botAlloc(h); return h;
}
function somaAlloc(a) { var t = 0; G.STAT_KEYS.forEach(function (k) { t += a[k]; }); return t; }
test('botAlloc: soma os pontos livres, respeita limite e teto, é fixa', function () {
  var casos = [];
  G.STARTERS.concat(G.WILD_HORSES).forEach(function (h0) { [1, 2, 11, 30, 50].forEach(function (lv) { var h = clone(h0); h.level = lv; casos.push(h); }); });
  ['fogo', 'agua', 'grama'].forEach(function (el) { ['comum', 'raro', 'mitico'].forEach(function (r) { [0, 16, 31].forEach(function (g) { [1, 2, 3].forEach(function (st) { casos.push(refBot(el, r, 50, g, st)); }); }); }); });
  casos.forEach(function (h) {
    delete h.alloc;
    var a = S.botAlloc(h), lim = S.statLimit(h), tag = h.id + ' ' + h.element + ' ' + h.rarity + ' nv' + h.level + ' ★' + h.grau;
    assert.deepStrictEqual(Object.keys(a), G.STAT_KEYS, tag);
    assert.strictEqual(somaAlloc(a), S.freePoints(h), tag + ' soma');
    G.STAT_KEYS.forEach(function (k) { assert.ok(a[k] >= 0 && a[k] <= lim && a[k] === Math.floor(a[k]), tag + ' ' + k); });
    assert.deepStrictEqual(S.validAlloc(h, a), a, tag + ' válida');
    assert.deepStrictEqual(S.botAlloc(h), a, tag + ' fixa');
    assert.strictEqual(h.alloc, undefined, tag + ' não muta');
  });
});
test('botAlloc: Comum ★★ de genética 16 no nível 50 enche o status do tipo até o teto', function () {
  // 58 pontos, limite 20; o natural é 64,98, então cabem 16 até o teto 80 (o espaço arredondado para cima):
  // Velocidade para Fogo e Água, Força para Grama; o resto em rodízio
  // Aceleração → Manobra → Força → Estamina → Garra → Velocidade, pulando o do primeiro passo
  var hf = refBot('fogo', 'comum', 50, 16), hg = refBot('grama', 'comum', 50, 16);
  var fogo = hf.alloc, agua = refBot('agua', 'comum', 50, 16).alloc, grama = hg.alloc;
  assert.strictEqual(fogo.vel, 16); assert.strictEqual(agua.vel, 16); assert.strictEqual(grama.forca, 16);
  assert.deepStrictEqual(fogo, { vel: 16, acel: 9, man: 9, forca: 8, est: 8, garra: 8, sorte: 0 });
  assert.deepStrictEqual(agua, fogo);
  assert.deepStrictEqual(grama, { vel: 8, acel: 9, man: 9, forca: 16, est: 8, garra: 8, sorte: 0 });
  // nenhum ponto desperdiçado: o status do tipo fica exatamente no teto e a soma é a dos pontos livres
  assert.strictEqual(S.computeStats(hf, null).vel, 80); assert.strictEqual(S.computeStats(hg, null).forca, 80);
  assert.strictEqual(somaAlloc(fogo), 58); assert.strictEqual(somaAlloc(grama), 58);
  G.STAT_KEYS.forEach(function (k) { assert.ok(S.naturalStat(hf, k) + fogo[k] - 1 < 80, 'sem ponto acima do teto em ' + k); });
  // no nível 1 não há ponto
  assert.strictEqual(somaAlloc(refBot('fogo', 'comum', 1, 16).alloc), 0);
});
test('botAlloc: rodízio pula o status no teto e a sobra vai para Sorte', function () {
  // Mítico ★ de genética 31 no nível 50 (49 pontos, limite 17): os seis status de corrida nascem a 6 pontos
  // do teto 100 (natural 94,62); 36 pontos os enchem e os 13 que sobram vão para Sorte
  var h = refBot('fogo', 'mitico', 50, 31, 1), a = h.alloc, cap = G.RARITIES.mitico.statCap;
  ['vel', 'acel', 'man', 'forca', 'est', 'garra'].forEach(function (k) {
    assert.ok(S.naturalStat(h, k) + a[k] >= cap - 1e-9, k + ' no teto');
    assert.ok(S.naturalStat(h, k) + a[k] - 1 < cap, k + ' sem ponto a mais que o necessário');
  });
  assert.strictEqual(a.vel, 6); assert.ok(a.vel < S.statLimit(h), 'para no teto antes do limite');
  assert.strictEqual(a.sorte, 13, 'sobra em Sorte');
  // ★★★ (73 pontos, limite 25): Sorte enche o limite e o resto completa o rodízio acima do teto (passo 4)
  var h3 = refBot('fogo', 'mitico', 50, 31, 3);
  assert.strictEqual(h3.alloc.sorte, 25); assert.strictEqual(somaAlloc(h3.alloc), 73);
  assert.strictEqual(h3.alloc.vel, 6, 'o status do tipo não entra no passo 4');
});
test('powerRating: mais pontos distribuídos dão mais Poder', function () {
  var h = refBot('agua', 'raro', 30, 16), sem = clone(h); sem.alloc = null;
  assert.ok(S.powerRating(h, null) > S.powerRating(sem, null), S.powerRating(h, null) + ' > ' + S.powerRating(sem, null));
  var meio = clone(h); meio.alloc = { vel: 5 };
  assert.ok(S.powerRating(meio, null) > S.powerRating(sem, null)); assert.ok(S.powerRating(h, null) > S.powerRating(meio, null));
});
test('ligas: seis faixas iguais entre o Comum nível 1 e o Lendário nível 50 de referência', function () {
  var lo = S.powerRating(refBot('fogo', 'comum', 1, 16), null), hi = S.powerRating(refBot('fogo', 'lendario', 50, 16), null);
  var L = G.LEAGUES;
  assert.deepStrictEqual(L.map(function (x) { return x.id; }), ['bronze', 'prata', 'ouro', 'platina', 'diamante', 'lenda']);
  assert.strictEqual(L[0].min, 0);
  for (var k = 1; k < 6; k++) assert.strictEqual(L[k].min, Math.round((lo + k * (hi - lo) / 6) / 10) * 10, L[k].id + ' (lo ' + lo + ', hi ' + hi + ')');
  assert.strictEqual(S.leagueFor(hi).id, 'lenda');
});
test('ligas: cada inicial de nível 1 começa na Bronze', function () {
  G.STARTERS.forEach(function (h) { assert.strictEqual(h.level, 1); assert.strictEqual(S.leagueFor(S.powerRating(h, null)).id, 'bronze', h.id); });
});

section('mapa');
test('mapa é determinístico e bem formado', function () {
  for (var seed = 1; seed <= 500; seed++) {
    var c = S.randomConditions(seed), d = S.randomConditions(seed);
    assert.deepStrictEqual(c, d);
    assert.ok(c.distance >= 1400 && c.distance <= 2000 && c.distance % 50 === 0, 'distância');
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

section('corrida');
// Corredor de teste: Mítico nível 1 com genética 0 (todo status natural = 60). Os valores de `over`
// viram mods de equipamento (testMods, entregues por eq(h)) para fixar o status exato no nível 1.
// Elemento 'neutro' (desconhecido desde a v3): sem clima e sem skill de tipo, para isolar o status.
function mk(over) { var h = clone(G.WILD_HORSES[0]); h.rarity = 'mitico'; h.level = 1; h.element = 'neutro'; h.skills = []; h.testMods = {};
  G.STAT_KEYS.forEach(function (k) { h.potential[k] = 0; h.testMods[k] = (over && k in over ? over[k] : 60) - 60; }); return h; }
function eq(h) { return h.testMods ? { mods: h.testMods } : null; }
function race(seed, cond, horses) { return S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: horses.map(function (h, i) { return { horse: h, gear: eq(h), name: 'r' + i, isPlayer: i === 0 }; }) }); }
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
test('weatherMult: dono T.weatherMult (1,03–1,07), dobrado T.weatherMultDouble (1,08), penalizado 2 − T.weatherMult, neutro 1', function () {
  var wm = S.TUNING.weatherMult; assert.ok(wm >= 1.03 && wm <= 1.07, 'weatherMult ' + wm);
  assert.strictEqual(S.weatherMult('fogo', 'sol', false), wm); assert.strictEqual(S.weatherMult('fogo', 'sol', true), S.TUNING.weatherMultDouble); assert.strictEqual(S.TUNING.weatherMultDouble, 1.08);
  assert.ok(Math.abs(S.weatherMult('grama', 'sol', false) - (2 - wm)) < 1e-9); assert.strictEqual(S.weatherMult('agua', 'sol', false), 1); assert.strictEqual(S.weatherMult('neutro', 'chuva', false), 1);
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
test('straight só dispara em reta de 150 m ou mais (e dispara na reta final longa)', function () {
  var cond = { distance: 1000, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 300 }, { type: 'curva', from: 300, to: 400 }, { type: 'reta', from: 400, to: 500 }, { type: 'curva', from: 500, to: 600 }, { type: 'reta', from: 600, to: 1000 }] };
  var h = mk({ sorte: 100 }); h.level = 50; h.skills = ['sprint'];
  var fired = 0;
  for (var s = 0; s < 20; s++) {
    var res = S.simulate({ seed: s, conditions: cond, recordFrames: true, racers: [h, mk({})].map(function (x, i) { return { horse: x, gear: eq(x), name: 'r' + i }; }) });
    var t600 = null; for (var f = 0; f < res.frames.length; f++) if (res.frames[f].pos[0] >= 600) { t600 = res.frames[f].t; break; }
    res.events.forEach(function (e) { if (e.type === 'skill' && e.racer === 0) assert.ok(e.t >= t600 - 0.1, 'seed ' + s + ': Sprint em t=' + e.t + ' antes de 600 m (t=' + t600 + ')'); });
    if (res.events.some(function (e) { return e.type === 'skill' && e.racer === 0 && e.t >= t600 - 0.1; })) fired++;
  }
  assert.ok(fired >= 15, 'Sprint disparou na reta final em só ' + fired + '/20 seeds');
});

section('tipo e pista v3');
var TIPOS = ['fogo', 'agua', 'grama'];
test('v3: três tipos sem bônus fixo e uma skill de tipo para cada', function () {
  assert.deepStrictEqual(Object.keys(G.ELEMENTS), TIPOS);
  TIPOS.forEach(function (e) { assert.ok(!('statBonus' in G.ELEMENTS[e]), e + ' sem statBonus'); });
  var TS = G.TYPE_SKILLS;
  assert.deepStrictEqual(Object.keys(TS).sort(), TIPOS.slice().sort());
  assert.strictEqual(TS.fogo.id, 'labareda'); assert.deepStrictEqual(TS.fogo.zone, [0, 1 / 3]); assert.deepStrictEqual(TS.fogo.effect, { accelMult: 0.23 });
  assert.strictEqual(TS.grama.id, 'raizes-firmes'); assert.deepStrictEqual(TS.grama.zone, [1 / 3, 2 / 3]);
  assert.deepStrictEqual(TS.grama.effect, { forcaAdd: 0.07, manAdd: 0.07, drainCut: 0.012 });
  assert.strictEqual(TS.agua.id, 'mare-alta'); assert.deepStrictEqual(TS.agua.zone, [2 / 3, 1]); assert.deepStrictEqual(TS.agua.effect, { speedMult: 0.018, staminaRestore: 0.012 });
  TIPOS.forEach(function (e) { var t = TS[e]; assert.ok(t.name && t.short && t.short.length <= 12 && t.desc, e + ' nome, nome curto e descrição'); });
  ['labareda', 'mare-alta', 'raizes-firmes'].forEach(function (id) { assert.strictEqual(G.SKILLS[id], undefined, id + ' fora das skills de vaga'); });
  var T = S.TUNING;
  assert.deepStrictEqual([T.typeBase, T.typeLevel, T.typeRar, T.distMin, T.distMax, T.distStep, T.trackMaxShare, T.trackTries], [1, 0.4, 0.4, 1400, 2000, 50, 0.5, 60]);
});
test('v3: catálogo sem Pangaré e com Ventania de Grama', function () {
  var todos = G.STARTERS.concat(G.WILD_HORSES);
  assert.ok(!todos.some(function (h) { return h.id === 'w-pangare'; }), 'Pangaré saiu');
  assert.strictEqual(todos.filter(function (h) { return h.id === 'w-ventania'; })[0].element, 'grama');
  todos.forEach(function (h) { assert.ok(G.ELEMENTS[h.element], h.id + ' tipo ' + h.element); });
});
test('v3: força da skill de tipo', function () {
  assert.strictEqual(S.typePower({ rarity: 'comum', level: 1 }), 1);
  assert.ok(Math.abs(S.typePower({ rarity: 'raro', level: 30 }) - 1.4367) < 1e-3);
  assert.ok(Math.abs(S.typePower({ rarity: 'lendario', level: 50 }) - 1.7) < 1e-9);
  assert.ok(Math.abs(S.typePower({ rarity: 'mitico', level: 50 }) - 1.8) < 1e-9);
  assert.strictEqual(S.typePower({ rarity: 'comum', level: 'x' }), 1, 'nível malformado vale 1');
  var ts = S.typeSkill({ element: 'agua', rarity: 'lendario', level: 50 });
  assert.strictEqual(ts.id, 'mare-alta'); assert.strictEqual(ts.name, 'Maré Alta'); assert.ok(Math.abs(ts.power - 1.7) < 1e-9); assert.deepStrictEqual(ts.zone, [2 / 3, 1]);
});
// campo dos três tipos com skills de gatilho garantido (largada, Dado, 80%) e o modo "skills sempre ativam"
function campoTipos() {
  return TIPOS.map(function (e) { var h = mk({ sorte: 40 }); h.element = e; h.level = 20; h.rarity = 'raro'; h.skills = ['arranque', 'dado-viciado', 'arrancada-final']; return h; });
}
function raceTipos(seed, cond, hs, semTipo) {
  return S.simulate({ seed: seed, conditions: cond, recordFrames: true, dev: { skillsAlways: true }, racers: hs.map(function (h, i) {
    var r = { horse: h, gear: eq(h), name: 'r' + i }; if (semTipo) r.noTypeSkill = true; return r;
  }) });
}
function porCorredor(res, filtro) {
  var out = [[], [], []]; res.events.forEach(function (e) { if (filtro(e)) out[e.racer].push(e.text); }); return out;
}
test('v3: skill de tipo sempre ativa no terço, sem consumir RNG', function () {
  for (var s = 1; s <= 12; s++) {
    var cond = S.randomConditions(s), D = cond.distance, hs = campoTipos();
    var com = raceTipos(s, cond, hs), sem = raceTipos(s, cond, hs, true);
    var sorteio = function (e) { return e.type === 'skill' && !e.typeSkill; };
    assert.deepStrictEqual(porCorredor(com, sorteio), porCorredor(sem, sorteio), 'seed ' + s + ': skills por sorteio');
    var dc = com.events.filter(function (e) { return e.type === 'dado'; }), ds = sem.events.filter(function (e) { return e.type === 'dado'; });
    assert.strictEqual(dc.length, 2);
    assert.deepStrictEqual(dc.map(function (d) { return [d.at, d.winner, d.rolls]; }), ds.map(function (d) { return [d.at, d.winner, d.rolls]; }), 'seed ' + s + ': Dados');
    assert.ok(!sem.events.some(function (e) { return e.typeSkill; }), 'noTypeSkill: nenhum evento de tipo');
    sem.racerInfo.forEach(function (ri) { assert.strictEqual(ri.typeSkill, null); });
    hs.forEach(function (h, i) {
      var tz = G.TYPE_SKILLS[h.element], ri = com.racerInfo[i].typeSkill;
      assert.deepStrictEqual(ri, { id: tz.id, name: tz.name, from: tz.zone[0] * D, to: tz.zone[1] * D });
      var evs = com.events.filter(function (e) { return e.typeSkill && e.racer === i; });
      assert.strictEqual(evs.length, 1, 'seed ' + s + ' corredor ' + i + ': 1 evento de tipo');
      assert.deepStrictEqual(Object.keys(evs[0]).sort(), ['racer', 't', 'text', 'type', 'typeSkill']);
      assert.strictEqual(evs[0].type, 'skill'); assert.ok(evs[0].text.indexOf(tz.name) >= 0, evs[0].text);
      // o evento sai no primeiro tick com o cavalo dentro do terço
      var f = Math.round(evs[0].t * 10);
      assert.ok(com.frames[f].pos[i] >= ri.from - 1e-9, 'evento dentro do terço');
      if (ri.from > 0) assert.ok(com.frames[f - 1].pos[i] < ri.from, 'evento na entrada do terço');
    });
  }
});
test('v3: skill de tipo com efeito nulo dá exatamente a mesma corrida (prova de que não mexe na RNG)', function () {
  var salvo = {};
  TIPOS.forEach(function (e) { salvo[e] = G.TYPE_SKILLS[e].effect; G.TYPE_SKILLS[e].effect = {}; });
  try {
    for (var s = 1; s <= 6; s++) {
      var cond = S.randomConditions(s), hs = campoTipos(), com = raceTipos(s, cond, hs), sem = raceTipos(s, cond, hs, true);
      com.events = com.events.filter(function (e) { return !e.typeSkill; });
      com.racerInfo.forEach(function (ri) { ri.typeSkill = null; });
      assert.strictEqual(JSON.stringify(com), JSON.stringify(sem), 'seed ' + s);
    }
  } finally { TIPOS.forEach(function (e) { G.TYPE_SKILLS[e].effect = salvo[e]; }); }
});
test('v3: cada skill de tipo ajuda o próprio cavalo no seu terço (média de 30 seeds, sozinho na pista)', function () {
  function solo(e, s, cond, semTipo) { var h = mk({}); h.element = e; return raceTipos(s, cond, [h], semTipo); }
  function tempoAte(res, x) { for (var f = 0; f < res.frames.length; f++) if (res.frames[f].pos[0] >= x) return res.frames[f].t; return Infinity; }
  var ladeira = { distance: 1500, surface: 'areia', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 500 }, { type: 'subida', from: 500, to: 1000 }, { type: 'reta', from: 1000, to: 1500 }] };
  var m = { lab: [0, 0], raiz: [0, 0], mare: [0, 0] };
  for (var s = 0; s < 30; s++) {
    [false, true].forEach(function (semTipo, q) {
      m.lab[q] += tempoAte(solo('fogo', s, RETA, semTipo), 100);                                  // Labareda: largada mais rápida
      var g = solo('grama', s, ladeira, semTipo); m.raiz[q] += tempoAte(g, 1000) - tempoAte(g, 500);   // Raízes Firmes: sobe melhor no meio
      m.mare[q] += solo('agua', s, RETA, semTipo).finishTimes[0];                              // Maré Alta: termina antes
    });
  }
  Object.keys(m).forEach(function (k) { assert.ok(m[k][0] < m[k][1], k + ': ' + m[k][0].toFixed(1) + ' com, ' + m[k][1].toFixed(1) + ' sem'); });
  // Maré Alta recupera estamina ao entrar no último terço
  var mc = solo('agua', 3, RETA), fz = Math.round(mc.events.filter(function (e) { return e.typeSkill; })[0].t * 10);
  assert.ok(mc.frames[fz + 1].stamina[0] > mc.frames[fz].stamina[0], 'recuperou na entrada');
});
test('v3: elemento desconhecido corre sem skill de tipo', function () {
  ['neutro', undefined, 'lava'].forEach(function (e) {
    var h = mk({}); h.element = e;
    assert.strictEqual(S.typeSkill(h), null, String(e));
    var res = race(4, RETA, [h, mk({})]);
    assert.strictEqual(res.finishOrder.length, 2); assert.ok(semNaN(res), String(e));
    res.racerInfo.forEach(function (ri) { assert.strictEqual(ri.typeSkill, null); });
    assert.ok(!res.events.some(function (ev) { return ev.typeSkill; }), String(e) + ': sem evento de tipo');
  });
});
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
test('v3: as 13 distâncias saem do sorteio e, sem pista válida em 60 tentativas, entra o molde fixo', function () {
  var vistas = {};
  for (var k = 0; k < 2000; k++) vistas[S.randomConditions(k).distance] = 1;
  assert.strictEqual(Object.keys(vistas).length, 13);
  var old = S.TUNING.trackTries; S.TUNING.trackTries = 0;
  try {
    // o molde nas 13 distâncias: mesma regra da pista sem extremos (curva e subida, nenhum tipo > D/2)
    var moldes = {};
    for (var s = 0; s < 2000 && Object.keys(moldes).length < 13; s++) { var cs = S.randomConditions(s); moldes[cs.distance] = cs; }
    assert.strictEqual(Object.keys(moldes).length, 13);
    Object.keys(moldes).forEach(function (d) {
      var c = moldes[d], prev = 0, tot = { reta: 0, curva: 0, subida: 0 };
      assert.deepStrictEqual(c.blocks.map(function (b) { return b.type; }), ['reta', 'curva', 'reta', 'subida', 'reta']);
      c.blocks.forEach(function (b) { assert.strictEqual(b.from, prev); assert.ok(b.to > b.from && b.to % 10 === 0); prev = b.to; tot[b.type] += b.to - b.from; });
      assert.strictEqual(prev, c.distance);
      assert.ok(tot.curva > 0 && tot.subida > 0, d + ' m: curva e subida');
      ['reta', 'curva', 'subida'].forEach(function (t) { assert.ok(tot[t] <= c.distance / 2, d + ' m: ' + t + ' ' + tot[t]); });
    });
  } finally { S.TUNING.trackTries = old; }
});
test('v3: distância explícita antiga continua aceita', function () {
  var rnd = S.randomConditions(7);
  [1000, 2400].forEach(function (d) {
    assert.strictEqual(S.normalizeConditions({ distance: d }, 7).distance, d);
    var res = race(7, { distance: d }, campo2());
    assert.strictEqual(res.conditions.distance, d); assert.ok(semNaN(res), String(d));
  });
  [900, 2500].forEach(function (d) { assert.strictEqual(S.normalizeConditions({ distance: d }, 7).distance, rnd.distance, String(d)); });
});
test('v3: nenhuma skill é exclusiva e as gerais servem a qualquer tipo', function () {
  var gerais = Object.keys(G.SKILLS).filter(function (id) { return G.SKILLS[id].element === 'geral'; });
  assert.deepStrictEqual(gerais, ['arranque', 'sprint', 'drift', 'saida-rapida', 'folego-de-montanha', 'segundo-ar', 'arrancada-final', 'dado-viciado']);
  Object.keys(G.SKILLS).forEach(function (id) {
    var sk = G.SKILLS[id];
    assert.ok(!('exclusive' in sk), id + ' sem exclusive');
    assert.ok(sk.element === 'geral' || TIPOS.indexOf(sk.element) >= 0, id + ' elemento ' + sk.element);
  });
  TIPOS.forEach(function (e) {
    var m = { id: 'brasa', element: e, rarity: 'mitico', skills: [] }, seen = {};
    for (var i = 0; i < 600; i++) { var id = S.learnSkill(m, S.mulberry32(i)); if (id) seen[id] = 1; }
    Object.keys(seen).forEach(function (id) { assert.ok(G.SKILLS[id].element === 'geral' || G.SKILLS[id].element === e, e + ' aprendeu ' + id); });
    assert.ok(Object.keys(seen).some(function (id) { return G.SKILLS[id].element === 'geral'; }), e + ': aprende geral');
    assert.ok(Object.keys(seen).some(function (id) { return G.SKILLS[id].element === e; }), e + ': aprende do tipo');
  });
});

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

section('dados v3');
test('baseLo por raridade e grau em todas as montarias', function () {
  assert.deepStrictEqual(['comum','magico','raro','lendario','mitico'].map(function (r) { return G.RARITIES[r].baseLo; }), [40, 45, 50, 55, 60]);
  assert.deepStrictEqual(['comum','magico','raro','lendario','mitico'].map(function (r) { return G.RARITIES[r].statCap; }), [80, 85, 90, 95, 100]);
  Object.keys(G.RARITIES).forEach(function (r) { assert.strictEqual(G.RARITIES[r].growth, undefined, r + ' sem growth'); });
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

section('cruzamento');
function mk2(o) { return { uid: o.uid || 'x', name: o.name || 'X', element: o.element || 'fogo', rarity: o.rarity || 'raro', grau: o.grau || 2, sex: o.sex || 'm', level: o.level == null ? 30 : o.level,
  skills: o.skills || [], potential: o.potential || { vel: 10, acel: 10, man: 10, forca: 10, est: 10, garra: 10, sorte: 10 },
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
test('foal é determinístico e tem o formato da spec', function () {
  var f = mk2({ uid: 'm1', name: 'Maré', sex: 'f', element: 'agua' }), m = mk2({ uid: 'm2', name: 'Brasa', element: 'fogo' });
  var a = B.foal({ f: f, m: m, seedBase: 123, breedCounter: 0, nextUid: 3 }), b = B.foal({ f: f, m: m, seedBase: 123, breedCounter: 0, nextUid: 3 });
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); assert.strictEqual(a.uid, 'm3'); assert.strictEqual(a.templateId, null); assert.strictEqual(a.level, 1);
  assert.ok(a.element === 'agua' || a.element === 'fogo'); assert.ok(a.sex === 'm' || a.sex === 'f'); assert.strictEqual(a.breedLeft, G.BREED_LEFT[a.sex]);
  assert.deepStrictEqual(a.parents, { f: { uid: 'm1', name: 'Maré' }, m: { uid: 'm2', name: 'Brasa' } }); assert.strictEqual(a.born, 0); assert.ok(!('gestacao' in a), 'sem o campo gestacao');
  assert.ok(G.FOAL_NAMES.indexOf(a.name) >= 0); assert.ok(/^#[0-9a-f]{6}$/.test(a.palette.coat));
  assert.notStrictEqual(JSON.stringify(a), JSON.stringify(B.foal({ f: f, m: m, seedBase: 123, breedCounter: 1, nextUid: 3 })));
});
test('potro v3: sem base nem alloc, genética inteira de 0 a 31, tipo dos pais, skills dentro das vagas', function () {
  for (var s = 0; s < 2000; s++) {
    var f = mk2({ sex: 'f', skills: ['chama-final', 'sprint'], element: 'fogo' }), m = mk2({ skills: ['pe-na-chuva', 'drift'], element: 'agua' });
    var c = B.foal({ f: f, m: m, seedBase: s, breedCounter: 0, nextUid: 1 });
    assert.ok(!('base' in c), 'sem base'); assert.ok(!('alloc' in c), 'nasce sem alloc');
    assert.ok(c.element === 'fogo' || c.element === 'agua', 'tipo de um dos pais: ' + c.element); assert.ok(G.ELEMENTS[c.element] && c.element !== 'neutro');
    G.STAT_KEYS.forEach(function (k) { var p = c.potential[k]; assert.ok(p >= 0 && p <= 31 && p === Math.floor(p), 'pot ' + k + ' = ' + p); });
    var R = G.RARITIES[c.rarity]; assert.ok(c.skills.length <= R.skillSlots && c.skills.length >= Math.min(R.bornSkills, R.skillSlots), 'skills ' + c.skills.join());
    c.skills.forEach(function (id) { var sk = G.SKILLS[id]; assert.ok(sk, 'existe ' + id); assert.ok(sk.element === 'geral' || sk.element === c.element, 'elemento ' + id); });
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
test('potro v3: genética 50% herdada, senão uniforme de 0 a 31, sem piso por estrela', function () {
  // pais com genética 0 e ★★★: sem piso, P(0) = 0,5 + 0,5/32 e a média dos sorteados é 15,5
  var z = { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 }, zeros = 0, soma = 0, n = 0, N = 5000;
  for (var s = 0; s < N; s++) {
    var c = B.foal({ f: mk2({ sex: 'f', grau: 3, potential: z }), m: mk2({ grau: 3, potential: z }), seedBase: 41, breedCounter: s, nextUid: 1 });
    G.STAT_KEYS.forEach(function (k) { n++; soma += c.potential[k]; if (c.potential[k] === 0) zeros++; });
  }
  near(zeros / n, 0.5 + 0.5 / 32, 0.01, 'genética 0'); near(soma / n, 0.5 * 15.5, 0.25, 'média');
  // pais diferentes: o herdado vem de um dos dois, 50/50
  var a = { vel: 31, acel: 31, man: 31, forca: 31, est: 31, garra: 31, sorte: 31 }, de31 = 0, de0 = 0;
  for (s = 0; s < N; s++) {
    var d = B.foal({ f: mk2({ sex: 'f', potential: a }), m: mk2({ potential: z }), seedBase: 43, breedCounter: s, nextUid: 1 });
    G.STAT_KEYS.forEach(function (k) { if (d.potential[k] === 31) de31++; if (d.potential[k] === 0) de0++; });
  }
  near(de31 / n, 0.25 + 0.5 / 32, 0.01, 'herda da égua'); near(de0 / n, 0.25 + 0.5 / 32, 0.01, 'herda do garanhão');
});
test('Mítico nunca nasce de cruzamento (5.000 cruzas de Míticos)', function () {
  for (var s = 0; s < 5000; s++) {
    var c = B.foal({ f: mk2({ sex: 'f', rarity: 'mitico', level: 50, grau: 3 }), m: mk2({ rarity: 'mitico', level: 50, grau: 3 }), seedBase: 47, breedCounter: s, nextUid: 1 });
    assert.notStrictEqual(c.rarity, 'mitico');
  }
  assert.strictEqual(B.GRAU_POT_FLOOR, undefined, 'sem piso de genética'); assert.strictEqual(B.GRAU_WINDOW, undefined, 'sem janela de status base');
});
test('uid distinto mesmo com nomes iguais', function () {
  var saved = G.FOAL_NAMES; G.FOAL_NAMES = ['Xodó'];
  var a = B.foal({ f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 1, breedCounter: 0, nextUid: 5 }), b = B.foal({ f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 1, breedCounter: 1, nextUid: 6 });
  G.FOAL_NAMES = saved; assert.strictEqual(a.name, b.name); assert.notStrictEqual(a.uid, b.uid);
});

test('snapshot dourado dos potros de exemplos.md', function () {
  // docs/exemplos.md §4 "Três potros de exemplo": seedBase 20261106, nextUid 2, breedCounter 0/1/2.
  // Regravado no modelo v3 da Tarefa 3: sem status base sorteado nem piso de genética por estrela
  // (a ordem das chamadas de rng mudou); o exemplos.md acompanha na tarefa da documentação.
  // Compara o potro INTEIRO (inclusive a paleta, passo 8 da RNG): qualquer chamada de rng a mais,
  // a menos ou fora de ordem em breed.js muda algum campo e derruba este teste.
  function par(id, level, uid) {
    var h = JSON.parse(JSON.stringify(G.STARTERS.concat(G.WILD_HORSES).filter(function (x) { return x.id === id; })[0]));
    h.level = level; h.uid = uid; return h;
  }
  function st(a) { var o = {}; G.STAT_KEYS.forEach(function (k, i) { o[k] = a[i]; }); return o; }
  var casos = [
    { f: par('mare', 30, null), m: par('brasa', 30, null), name: 'Jurema', rarity: 'comum', grau: 2, element: 'fogo', sex: 'f',
      potential: [20, 26, 14, 21, 24, 14, 12], stats: [50, 53, 47, 51, 52, 47, 46], skills: ['sol-a-pino'],
      palette: { coat: '#b27261', coatShade: '#734940', mane: '#b7c284', accent: '#f4e9a9' }, breedLeft: 1 },
    { f: par('w-faisca', 1, null), m: par('w-lambari', 1, null), name: 'Jurema', rarity: 'comum', grau: 2, element: 'agua', sex: 'f',
      potential: [8, 11, 25, 10, 8, 5, 10], stats: [44, 46, 53, 45, 44, 43, 45], skills: ['arranque'],
      palette: { coat: '#9b9895', coatShade: '#66696d', mane: '#ede9d8', accent: '#90b1a9' }, breedLeft: 1 },
    { f: par('w-ventania', 30, null), m: par('w-jequitiba', 30, null), name: 'Trovão', rarity: 'lendario', grau: 1, element: 'grama', sex: 'm',
      potential: [19, 18, 20, 13, 28, 25, 16], stats: [65, 64, 65, 62, 69, 68, 63], skills: ['sprint', 'arrancada-final'],
      palette: { coat: '#8e7d68', coatShade: '#65584b', mane: '#4a7c4c', accent: '#90c88c' }, breedLeft: 2 }
  ];
  casos.forEach(function (c, i) {
    var x = B.foal({ f: c.f, m: c.m, seedBase: 20261106, breedCounter: i, nextUid: 2 });
    assert.deepStrictEqual(x, {
      uid: 'm2', templateId: null, name: c.name, especie: 'cavalo', element: c.element, rarity: c.rarity, grau: c.grau, sex: c.sex,
      level: 1, xp: 0, skills: c.skills, potential: st(c.potential), palette: c.palette, breedLeft: c.breedLeft,
      parents: { f: { uid: null, name: c.f.name }, m: { uid: null, name: c.m.name } },
      born: i
    }, 'potro ' + i);
    assert.deepStrictEqual(S.computeStats(x, null), st(c.stats), 'status do potro ' + i + ' no nível 1');
  });
});

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
  assert.deepStrictEqual(G.GEAR['sela-sol-raro'], { id: 'sela-sol-raro', name: 'Sela do Sol', slot: 'sela', rarity: 'raro', set: 'sol', main: 3, sub: 2, price: 600, shop: true });
  assert.deepStrictEqual(G.GEAR['ferraduras-comum'], { id: 'ferraduras-comum', name: 'Ferradura Leve', slot: 'ferraduras', rarity: 'comum', set: null, main: 2, sub: 0, price: 100, shop: true });
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].name, 'Armadura da Chuva');
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].main, 4);
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].sub, 3);
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].price, 1500);
  assert.strictEqual(G.GEAR['estribos-magico'].name, 'Esporas de Prata');
  assert.strictEqual(G.GEAR['estribos-magico'].sub, 1);
  assert.strictEqual(G.GEAR['testeira-nevoa-raro'].name, 'Testeira da Névoa');
});
test('ECONOMY.gear', function () {
  var g = G.ECONOMY.gear;
  assert.deepStrictEqual(g.price, { comum: 100, magico: 250, raro: 600, lendario: 1500 });
  assert.strictEqual(g.sellRate, 0.25); assert.strictEqual(g.stonePrice, 40); assert.strictEqual(g.stoneBundle, 5);
  assert.deepStrictEqual(g.main, { comum: 2, magico: 2, raro: 3, lendario: 4 });
  assert.deepStrictEqual(g.sub, { comum: 0, magico: 1, raro: 2, lendario: 3 });
  assert.strictEqual(g.plusStep, 0.5); assert.strictEqual(g.plusMax, 10);
  assert.deepStrictEqual(g.enhanceChance, [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25]);
  assert.deepStrictEqual(g.enhanceCost, [1, 1, 1, 1, 1, 1, 2, 2, 2, 2]);
  assert.strictEqual(g.enhanceDropFrom, 6);
  assert.deepStrictEqual(g.setBonus, { pieces: [3, 4, 5], skillChance: 0.05, sorte: 5, ratingPts: [3, 15, 20] });
  assert.deepStrictEqual(g.podiumStone, [0.6, 0.4, 0.25]);
  assert.deepStrictEqual(g.startGear, ['sela-comum', 'ferraduras-comum']);
});

section('equipamento: gear.js');
function gm(equip) { return { equip: equip }; }
function gi(uid, id, plus) { return { uid: uid, id: id, plus: plus || 0 }; }
function byUid(list) { var o = {}; list.forEach(function (it) { o[it.uid] = it; }); return o; }
test('resolve soma principal + plus × 0,5 e secundário; sem equip zera', function () {
  var items = byUid([gi('i1', 'sela-sol-raro', 3), gi('i2', 'ferraduras-comum')]);
  var g = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2' }), items);
  assert.deepStrictEqual(g.mods, { vel: 2, acel: 0, man: 0, forca: 0, est: 4.5, garra: 2, sorte: 0 });
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
  assert.deepStrictEqual(g3.set, { id: 'chuva', count: 3 }); assert.strictEqual(g3.mods.sorte, 7); // 2 (sub do estribo Raro) + 5 (conjunto)
  assert.deepStrictEqual(g3.special, { skillChanceBonus: 0.05, weatherDoubleClimate: null, ignoreWeatherPenalty: false });
  var g4 = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3', testeira: 'i4' }), items);
  assert.strictEqual(g4.special.weatherDoubleClimate, 'chuva'); assert.strictEqual(g4.special.ignoreWeatherPenalty, false);
  var g5 = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3', testeira: 'i4', armadura: 'i5' }), items);
  assert.deepStrictEqual(g5.set, { id: 'chuva', count: 5 }); assert.strictEqual(g5.special.ignoreWeatherPenalty, true);
  assert.strictEqual(g5.mods.vel, 5); // lendário 4 + 2 × 0,5
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
  assert.deepStrictEqual(seq, [1, 2, 3, 4, 5, 6, 7, 6, 5, 5, 5, 6]);
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
  assert.deepStrictEqual(l.set, { id: 'sol', count: 5 }); assert.strictEqual(l.mods.vel, 6.5); assert.strictEqual(l.mods.sorte, 7); // vel: Raro 3 + 7 × 0,5; sorte: 2 sub + 5 conjunto
  assert.strictEqual(l.special.ignoreWeatherPenalty, true);
  assert.strictEqual(GR.botGear(5, 'neutro', 0.0).set.id, 'sol'); assert.strictEqual(GR.botGear(5, 'neutro', 0.5).set.id, 'chuva'); assert.strictEqual(GR.botGear(5, 'neutro', 0.9).set.id, 'nevoa');
  var d = GR.botGear(4, 'grama', 0.5); assert.deepStrictEqual(d.set, { id: 'nevoa', count: 3 }); assert.strictEqual(d.pieces.length, 5);
});
test('sellPrice e ratingPts', function () {
  assert.strictEqual(GR.sellPrice('sela-magico'), 63); assert.strictEqual(GR.sellPrice('armadura-sol-lendario'), 375); assert.strictEqual(GR.sellPrice('nada'), 0);
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6].map(GR.ratingPts), [0, 0, 0, 3, 15, 20, 0]);
});

section('equipamento: simulação');
function cl(h) { return JSON.parse(JSON.stringify(h)); }
test('computeStats soma mods do equipamento e limita a 120; string vale null', function () {
  var h = cl(G.STARTERS[0]);
  var base = S.computeStats(h, null);
  var g = GR.resolve({ equip: { sela: 'i1' } }, { i1: { uid: 'i1', id: 'sela-sol-raro', plus: 10 } });
  var s = S.computeStats(h, g);
  assert.strictEqual(s.est, base.est + 8); assert.strictEqual(s.garra, base.garra + 2); assert.strictEqual(s.vel, base.vel);   // Raro 3 + 10 × 0,5; sub 2
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
  assert.strictEqual(S.powerRating(h, g3) - statsOnly, 3);
});
test('equipamento nunca baixa o rating; tirar uma peça nunca o sobe (premissa da trava do páreo)', function () {
  var SL = ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'];
  function gearIds(ids, plus) { var items = {}, equip = {}; ids.forEach(function (id, i) { if (id) { items['i' + i] = { uid: 'i' + i, id: id, plus: plus }; equip[SL[i]] = 'i' + i; } }); return GR.resolve({ equip: equip }, items); }
  var gears = [
    gearIds(SL.map(function (sl) { return sl + '-comum'; }), 0),              // 5 Comuns soltas
    gearIds(SL.map(function (sl) { return sl + '-sol-raro'; }), 10),          // conjunto Raro completo +10
    gearIds([null, 'sela-comum', null, null, null], 3)                         // uma peça só
  ];
  var horses = [cl(G.STARTERS[0]), cl(G.STARTERS[1]), cl(G.STARTERS[2])];
  horses[2].level = 50;   // perto do teto da raridade
  horses.forEach(function (h) {
    gears.forEach(function (g, gi) {
      assert.ok(S.powerRating(h, g) >= S.powerRating(h, null), h.id + ' gear ' + gi + ': ' + S.powerRating(h, g) + ' < ' + S.powerRating(h, null));
    });
    var com = gearIds(SL.map(function (sl) { return sl + '-sol-raro'; }), 5);
    var sem = gearIds(SL.map(function (sl, i) { return i === 1 ? null : sl + '-sol-raro'; }), 5);   // tira a sela (quebra o bônus de 5)
    assert.ok(S.powerRating(h, com) >= S.powerRating(h, sem), h.id + ': tirar a sela subiu o rating');
  });
});
test('5 peças Chuva anulam a penalidade do Fogo na chuva; 4 Sol dobram o Sol', function () {
  var brasa = cl(G.STARTERS.filter(function (x) { return x.id === 'brasa'; })[0]);
  function gearOf(set, n) { var items = {}, equip = {}; ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'].slice(0, n).forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-' + set + '-raro', plus: 0 }; equip[sl] = 'i' + i; }); return GR.resolve({ equip: equip }, items); }
  function mixed(n) { var sets = ['sol', 'chuva', 'nevoa', 'sol', 'chuva']; var items = {}, equip = {}; ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'].slice(0, n).forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-' + sets[i] + '-raro', plus: 0 }; equip[sl] = 'i' + i; }); return GR.resolve({ equip: equip }, items); }
  function wins(gA, gB, weather) {
    var w = 0, saved = S.TUNING.diceAt; S.TUNING.diceAt = [];
    try {
      for (var k = 0; k < 200; k++) {
        var seed = S.hash2(777, k), cond = S.randomConditions(seed); cond.weather = weather;
        var pair = k % 2 ? [gB, gA] : [gA, gB];
        var res = S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: pair.map(function (g) { return { horse: brasa, gear: g, name: 'x', isPlayer: false }; }) });
        if (pair[res.finishOrder[0]] === gA) w++;
      }
    } finally { S.TUNING.diceAt = saved; }
    return w;
  }
  assert.ok(wins(gearOf('chuva', 5), mixed(5), 'chuva') >= 110, 'anula penalidade (≥55% de 200)');
  assert.ok(wins(gearOf('sol', 4), mixed(4), 'sol') >= 110, 'dobra o Sol (≥55% de 200)');
});

section('dev');
// Referência regravada no modelo v3 com a skill de tipo e a pista nova (seeds 1001…1020; os 3 iniciais + 5
// aluguéis do Haras, com o equipamento de bot de cada liga). Mudou a simulação de propósito? Regrave a tabela.
var crypto = require('crypto');
var ALUGUEIS = G.WILD_HORSES.filter(function (h) { return h.rarity !== 'mitico' && B.rentalPrice(h) != null; }).slice(0, 5);
var CAMPO_REF = G.STARTERS.concat(ALUGUEIS);
function refRace(seed, dev) {
  var cfg = { seed: seed, recordFrames: false, racers: CAMPO_REF.map(function (h, i) {
    return { horse: cl(h), gear: GR.botGear(i % 6, h.element, 0.37), name: 'r' + i, isPlayer: i === 0 };
  }) };
  if (dev !== undefined) cfg.dev = dev;
  return S.simulate(cfg);
}
function refHash(res) {
  return crypto.createHash('sha1').update(JSON.stringify({ finishOrder: res.finishOrder, finishTimes: res.finishTimes, events: res.events })).digest('hex');
}
var REF_HASHES = ['0b37d495dda55ad84071a9db572e9f9f6d15e73c', 'e8cc20a499db412f27fd12ec918df1941d3fbcb0', '54dc3e7c91bd356fc1e7587d798ec89c77941940',
  '2b800a4ad17aebcd543915daf0f8bda55ecb644c', 'a8241e7f65392d1507a9ee050fba227dfb8c2757', '35874e25f18a56f73402a5d4a823123f6517c98f',
  '8baa74edd86f31b87d3d4083ad4294aeea282005', '676c91de9e7aa0be1ab375f3d9a7753e31b31f80', 'bdd59ecf6c7bf880bb39fc738ec031de18a5c48c',
  'ebe247bfdc4096a3c22b6cd46061a777126ababf', '838a3d5d48736c0bd9d522d938804df469a2dbaf', 'e18054c0a2ddced63a815911df41e5ff198946cf',
  'ae11f4ec48993ee381b283769a21c6a915a58f29', 'b4c39a11dc17bc746e7dc3c7001e06f0bf088c6b', '0e49baf947a3f043fe8facb81d24c8bdb42176e8',
  'f8a62dd9fe53ae8b765e2aaaa9772e90628ca334', '39d39ab0564f2ad9e3f8e7eb3685776b7b87033f', '8f74327bc25c511f88cc0933e9340e9300c96368',
  '5b29724e62188185b710c54e952f3dfb11ccfae6', '947e2a54f0e9ddbcb103dfb320b87845e27aae62'];
test('sem config.dev o resultado é o de antes', function () {
  assert.deepStrictEqual(CAMPO_REF.map(function (h) { return h.id; }), ['brasa', 'mare', 'ipe', 'w-faisca', 'w-lambari', 'w-capim', 'w-ticao', 'w-garoa']);
  var diff = [];
  for (var k = 0; k < 20; k++) { var h = refHash(refRace(1001 + k)); if (h !== REF_HASHES[k]) diff.push((1001 + k) + ': ' + h); }
  assert.deepStrictEqual(diff, [], 'hashes diferentes da referência');
});
test('config.dev vazio ou com skillsAlways false devolve exatamente o mesmo objeto', function () {
  var a = JSON.stringify(refRace(1003)), b = JSON.stringify(refRace(1003, {})), c = JSON.stringify(refRace(1003, { skillsAlways: false }));
  assert.strictEqual(b, a); assert.strictEqual(c, a);
});
// mapa com gatilho garantido para start (largada), straight (reta final de 600 m) e final (80%)
var GATILHOS = { distance: 1200, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 300 }, { type: 'curva', from: 300, to: 600 }, { type: 'reta', from: 600, to: 1200 }] };
function devRace(seed, horses, dev) {
  var cfg = { seed: seed, conditions: GATILHOS, recordFrames: true, racers: horses.map(function (h, i) { return { horse: h, gear: eq(h), name: 'r' + i, isPlayer: i === 0 }; }) };
  if (dev) cfg.dev = dev;
  return S.simulate(cfg);
}
function skillsPorCorredor(res, n) {
  var c = []; for (var i = 0; i < n; i++) c.push(0);
  res.events.forEach(function (e) { if (e.type === 'skill') c[e.racer]++; });
  return c;
}
test('com skillsAlways toda tentativa de skill ativa', function () {
  function fraco() { var h = mk({ sorte: 0 }); h.rarity = 'comum'; h.skills = ['arranque', 'sprint', 'arrancada-final']; return h; }
  var semDev = 0;
  for (var s = 1; s <= 10; s++) {
    var hs = [fraco(), fraco(), fraco(), fraco()];
    assert.deepStrictEqual(skillsPorCorredor(devRace(s, hs, { skillsAlways: true }), 4), [3, 3, 3, 3], 'seed ' + s);
    semDev += skillsPorCorredor(devRace(s, hs), 4).reduce(function (a, x) { return a + x; }, 0);
  }
  assert.ok(semDev < 120, 'sem o parâmetro, a chance (0,35) falha às vezes: ' + semDev + '/120');
  // r.rng() continua sendo chamado na tentativa: quando todas já ativariam, o resultado é idêntico
  function forte() { var h = mk({ sorte: 100 }); h.level = 50; h.skills = ['arranque', 'sprint', 'arrancada-final']; return h; }
  var iguais = 0;
  for (s = 1; s <= 40; s++) {
    var hf = [forte(), forte()], base = devRace(s, hf);
    if (skillsPorCorredor(base, 2).join() !== '3,3') continue;
    assert.strictEqual(JSON.stringify(devRace(s, hf, { skillsAlways: true })), JSON.stringify(base), 'seed ' + s + ': fluxo do rng deslocado');
    iguais++;
  }
  assert.ok(iguais >= 5, 'poucas seeds com todas as skills ativas sem o parâmetro: ' + iguais);
});

var Dev = null;
try { Dev = require('../src/dev.js'); } catch (e) { Dev = null; }
function DV() { if (!Dev) throw new Error('Dev indefinido (prototype/src/dev.js)'); return Dev; }
test('Dev: chave do save e Ouro infinito', function () {
  assert.strictEqual(DV().SAVE_KEY, 'galope-elemental:dev'); assert.strictEqual(DV().GOLD_INF, 999999);
  var st = { gold: 10 }; DV().refillGold(st); assert.strictEqual(st.gold, 999999);
  st = { gold: 1000374 }; DV().refillGold(st); assert.strictEqual(st.gold, 1000374);
  assert.deepStrictEqual(DV().wind({ intensity: 'brisa', dir: -1 }), { intensity: 'brisa', dir: -1 });
  assert.deepStrictEqual(DV().wind({ intensity: 'ventania', dir: '1' }), { intensity: 'ventania', dir: 1 });
  assert.strictEqual(DV().wind({ intensity: 'furacao', dir: 1 }), null); assert.strictEqual(DV().wind(null), null);
  assert.strictEqual(DV().parseSeed('123'), 123); assert.strictEqual(DV().parseSeed(4294967295), 4294967295);
  [null, '', '-1', '1.5', 'abc', '4294967296', true].forEach(function (v) { assert.strictEqual(DV().parseSeed(v), null, String(v)); });
});
test('Dev.horseTemplate respeita vagas e skills válidas', function () {
  var pal = { coat: '#112233', coatShade: '#000000', mane: '#abcdef', accent: '#FFEE00' };
  var t = DV().horseTemplate({ name: 'Teste', element: 'agua', rarity: 'comum', sex: 'f', potential: 12, skills: ['arranque', 'arranque', 'nao-existe', 'sprint'], palette: pal }, 7);
  assert.strictEqual(t.id, 'dev-7'); assert.strictEqual(t.name, 'Teste'); assert.strictEqual(t.especie, 'cavalo'); assert.strictEqual(t.grau, 2);
  assert.strictEqual(t.element, 'agua'); assert.strictEqual(t.rarity, 'comum'); assert.strictEqual(t.sex, 'f'); assert.strictEqual(t.level, 1); assert.strictEqual(t.xp, 0);
  assert.deepStrictEqual(t.skills, ['arranque'], 'Comum: 1 vaga');
  G.STAT_KEYS.forEach(function (k) { assert.strictEqual(t.potential[k], 12, 'pot ' + k); });
  assert.deepStrictEqual(t.palette, pal);
  Object.keys(G.STARTERS[0]).filter(function (k) { return k !== 'title' && k !== 'bio'; }).forEach(function (k) { assert.ok(k in t, 'campo ' + k); });
  // Mítico: 5 vagas, qualquer skill do catálogo (inclusive de outro elemento), na ordem pedida
  var m = DV().horseTemplate({ name: 'X', element: 'agua', rarity: 'mitico', sex: 'm', potential: 'max', skills: ['sol-a-pino', 'nevoa-amiga', 'labareda', 'drift', 'sprint', 'arranque', 'segundo-ar'] }, 1);
  assert.deepStrictEqual(m.skills, ['sol-a-pino', 'nevoa-amiga', 'drift', 'sprint', 'arranque'], 'a skill de tipo não é skill de vaga');
  G.STAT_KEYS.forEach(function (k) { assert.strictEqual(m.potential[k], 31); });
  assert.ok(/^#[0-9a-f]{6}$/i.test(m.palette.coat) && /^#[0-9a-f]{6}$/i.test(m.palette.accent), 'paleta padrão');
  assert.strictEqual(DV().horseTemplate({ rarity: 'raro', potential: 99 }).potential.vel, 31);
  assert.strictEqual(DV().horseTemplate({ rarity: 'raro', potential: -4 }).potential.vel, 0);
  // campos inválidos: valores padrão válidos, e o template corre
  var d = DV().horseTemplate({ element: 'lava', rarity: 'divino', sex: 'x', skills: 'arranque', name: ' ' });
  assert.ok(G.ELEMENTS[d.element] && G.RARITIES[d.rarity] && (d.sex === 'm' || d.sex === 'f') && Array.isArray(d.skills) && d.name.length >= 2);
  var res = S.simulate({ seed: 3, recordFrames: false, racers: [{ horse: m, gear: null, name: 'a' }, { horse: t, gear: null, name: 'b' }] });
  assert.strictEqual(res.finishOrder.length, 2);
});
test('Dev.itemId devolve só ids do catálogo', function () {
  assert.strictEqual(DV().itemId({ slot: 'sela', set: 'sol', rarity: 'lendario' }), 'sela-sol-lendario');
  assert.strictEqual(DV().itemId({ slot: 'armadura', set: 'nevoa', rarity: 'raro' }), 'armadura-nevoa-raro');
  assert.strictEqual(DV().itemId({ slot: 'sela', rarity: 'comum' }), 'sela-comum');
  assert.strictEqual(DV().itemId({ slot: 'estribos', set: 'chuva', rarity: 'magico' }), 'estribos-magico', 'peça solta ignora o conjunto');
  [{ slot: 'sela', rarity: 'raro' }, { slot: 'chapeu', rarity: 'comum' }, { slot: 'sela', set: 'lava', rarity: 'raro' },
    { slot: 'sela', set: 'sol', rarity: 'mitico' }, {}, null].forEach(function (q) { assert.strictEqual(DV().itemId(q), null, JSON.stringify(q)); });
  G.GEAR_SLOTS.concat(['x']).forEach(function (slot) {
    [null, 'sol', 'chuva', 'nevoa', 'x'].forEach(function (set) {
      Object.keys(G.RARITIES).concat(['x']).forEach(function (rarity) {
        var id = DV().itemId({ slot: slot, set: set, rarity: rarity });
        if (id !== null) { assert.ok(G.GEAR[id], id); assert.strictEqual(G.GEAR[id].slot, slot); assert.strictEqual(G.GEAR[id].rarity, rarity); }
      });
    });
  });
  assert.strictEqual(DV().itemId({ slot: 'testeira', set: 'chuva', rarity: 'lendario' }), 'testeira-chuva-lendario');
});
test('Dev.conditions corrige distância e omite campo inválido', function () {
  assert.deepStrictEqual(DV().conditions({ distance: 1234 }), { distance: 1200 });
  assert.deepStrictEqual(DV().conditions({ distance: 50 }), { distance: 1000 });
  assert.deepStrictEqual(DV().conditions({ distance: 9999 }), { distance: 2400 });
  assert.deepStrictEqual(DV().conditions({ distance: 'abc' }), {});
  assert.deepStrictEqual(DV().conditions({ weather: 'granizo' }), {});
  assert.deepStrictEqual(DV().conditions({ weather: 'nevoa', surface: 'lama' }), { weather: 'nevoa' });
  assert.deepStrictEqual(DV().conditions({ surface: 'areia', tracado: 'normal' }), { surface: 'areia' });
  assert.deepStrictEqual(DV().conditions({}), {}); assert.deepStrictEqual(DV().conditions(null), {});
  function sete(c, D, meio) {
    assert.strictEqual(c.blocks.length, 7);
    var prev = 0;
    c.blocks.forEach(function (b, i) {
      assert.strictEqual(b.from, prev); assert.ok(b.to > b.from); assert.strictEqual(b.to % 10, 0, 'fronteira múltipla de 10 m');
      assert.ok(Math.abs((b.to - b.from) - D / 7) <= 10, 'blocos de mesmo tamanho: ' + (b.to - b.from));
      prev = b.to;
    });
    assert.strictEqual(prev, D);
    assert.deepStrictEqual(c.blocks.map(function (b) { return b.type; }), ['reta'].concat(meio, ['reta']));
  }
  sete(DV().conditions({ tracado: 'curvas', distance: 1000 }), 1000, ['curva', 'curva', 'curva', 'curva', 'curva']);
  sete(DV().conditions({ tracado: 'subidas', distance: 2400 }), 2400, ['subida', 'reta', 'subida', 'reta', 'subida']);
  sete(DV().conditions({ tracado: 'curvas' }), 1600, ['curva', 'curva', 'curva', 'curva', 'curva']);   // sem distância: 1600 m
  [{ distance: 1234 }, { weather: 'granizo' }, { tracado: 'curvas' }, {}].forEach(function (f) {
    var n = S.normalizeConditions(DV().conditions(f));
    assert.ok(n.distance >= 1000 && n.blocks.length >= 1 && G.WEATHERS[n.weather] && G.SURFACES[n.surface], JSON.stringify(f));
    var ns = S.normalizeConditions(DV().conditions(f), 77);
    assert.ok(ns.blocks[ns.blocks.length - 1].to === ns.distance, JSON.stringify(f) + ' com seed');
  });
  // com a sala normal (base): a distância forçada mantém o traçado dela, reescalado
  var base = S.randomConditions(5), alvo = base.distance === 2000 ? 1500 : 2000;
  var c = DV().conditions({ distance: alvo }, base), n2 = S.normalizeConditions(c, 5);
  assert.strictEqual(n2.distance, alvo);
  assert.deepStrictEqual(n2.blocks.map(function (b) { return b.type; }), base.blocks.map(function (b) { return b.type; }));
  n2.blocks.forEach(function (b, i) { assert.strictEqual(b.to % 10, 0); if (i) assert.strictEqual(b.from, n2.blocks[i - 1].to); });
  assert.strictEqual(DV().conditions({ tracado: 'subidas' }, base).blocks[6].to, base.distance, 'traçado sem distância usa a da sala');
  // lista de blocos: tamanhos iguais na ordem dada; tipo inválido descarta a lista
  assert.deepStrictEqual(DV().conditions({ tracado: ['reta', 'curva', 'subida', 'reta'], distance: 1200 }).blocks,
    [{ type: 'reta', from: 0, to: 300 }, { type: 'curva', from: 300, to: 600 }, { type: 'subida', from: 600, to: 900 }, { type: 'reta', from: 900, to: 1200 }]);
  assert.deepStrictEqual(DV().conditions({ tracado: ['reta', 'lava'], distance: 1200 }), { distance: 1200 });
});

section('auditoria: entradas malformadas e regras do núcleo');
function campo2(h0) { return [h0 || mk({}), mk({ vel: 70 })]; }
function semNaN(res) { return res.finishTimes.every(function (t) { return typeof t === 'number' && isFinite(t) && t > 0 && t < S.TUNING.maxTime; }); }
test('normalizeConditions: distância fora de 1000–2400 ou não numérica usa a da seed', function () {
  var rnd = S.randomConditions(7);
  [-100, 0, 'abc', '1600', 1e6, 999, 2401, NaN, Infinity, 1234.5, null, true].forEach(function (d) {
    var c = S.normalizeConditions({ distance: d }, 7);
    assert.strictEqual(c.distance, rnd.distance, String(d));
    assert.deepStrictEqual(c.blocks, rnd.blocks, String(d) + ' blocos');
  });
  [-100, 'abc', 1e6].forEach(function (d) { assert.strictEqual(S.normalizeConditions({ distance: d }).distance, 1600, 'sem seed: ' + d); });
  // distância válida diferente da seed: uma reta única do tamanho pedido
  var alvo = rnd.distance === 2000 ? 1500 : 2000, c2 = S.normalizeConditions({ distance: alvo }, 7);
  assert.strictEqual(c2.distance, alvo); assert.deepStrictEqual(c2.blocks, [{ type: 'reta', from: 0, to: alvo }]);
  assert.strictEqual(S.normalizeConditions({ distance: 1000 }, 7).distance, 1000); assert.strictEqual(S.normalizeConditions({ distance: 2400 }, 7).distance, 2400);
  // blocos que terminam fora da faixa são descartados
  var curto = S.normalizeConditions({ blocks: [{ type: 'reta', from: 0, to: 50 }] }, 7);
  assert.strictEqual(curto.distance, rnd.distance);
});
test('simulate com distância malformada corre na distância da seed, com tempos válidos', function () {
  [-100, 'abc', 1e6].forEach(function (d) {
    var res = race(11, { distance: d }, campo2());
    assert.strictEqual(res.conditions.distance, S.randomConditions(11).distance, String(d));
    assert.ok(semNaN(res), String(d) + ': ' + res.finishTimes.join());
  });
});
test('level e potencial malformados: status finitos, corrida termina, skillChance limita o level como computeStats', function () {
  var h = mk({}); h.level = 'x'; h.potential = { vel: 'abc', acel: NaN, man: -5, forca: 99, est: null, garra: undefined, sorte: '7' };
  var st = S.computeStats(h, null);
  G.STAT_KEYS.forEach(function (k) { assert.ok(typeof st[k] === 'number' && isFinite(st[k]), k + ' = ' + st[k]); });
  var h1 = mk({}); h1.level = 1; h1.potential = { vel: 0, acel: 0, man: 0, forca: 31, est: 0, garra: 0, sorte: 7 };
  assert.deepStrictEqual(st, S.computeStats(h1, null), 'level "x" vale 1; potencial vira número (inválido vale 0), preso a 0–31');
  var hb = mk({}); hb.alloc = { vel: 'rápido', acel: -3, man: Infinity }; assert.deepStrictEqual(S.computeStats(hb, null), S.computeStats(mk({}), null));
  hb.alloc = 'tudo'; assert.deepStrictEqual(S.computeStats(hb, null), S.computeStats(mk({}), null));
  var res = race(3, RETA, campo2(h));
  assert.ok(semNaN(res), res.finishTimes.join());
  assert.ok(!res.events.some(function (e) { return e.type === 'chegada' && /900/.test(e.text); }), 'ninguém "chega" em 900 s');
  var c1 = S.skillChance({ rarity: 'raro', level: 1 }, { sorte: 0 }), c50 = S.skillChance({ rarity: 'raro', level: 50 }, { sorte: 0 });
  assert.strictEqual(S.skillChance({ rarity: 'raro', level: -200 }, { sorte: 0 }), c1);
  assert.strictEqual(S.skillChance({ rarity: 'raro', level: 'x' }, { sorte: 0 }), c1);
  assert.strictEqual(S.skillChance({ rarity: 'raro', level: 1e9 }, { sorte: 0 }), c50);
  assert.strictEqual(S.sanitizeLevel(10.7), 10); assert.strictEqual(S.sanitizeLevel(undefined), 1); assert.strictEqual(S.sanitizePotential('x'), 0); assert.strictEqual(S.sanitizePotential(40), 31);
});
test('simulate não muta a config recebida', function () {
  var cfg = { seed: 99, conditions: { distance: 1600, blocks: [{ type: 'reta', from: 0, to: 400 }, { type: 'curva', from: 400, to: 1200 }, { type: 'reta', from: 1200, to: 1600 }] },
    racers: [{ horse: cl(G.STARTERS[0]), gear: GR.botGear(5, 'fogo', 0.5), name: 'a' }, { horse: cl(G.STARTERS[1]), gear: null, name: 'b' }], dev: { skillsAlways: true } };
  var antes = JSON.stringify(cfg);
  S.simulate(cfg); assert.strictEqual(JSON.stringify(cfg), antes);
});
test('resultado traz simVersion e tuningHash; o hash muda com o TUNING, as skills e as skills de tipo', function () {
  assert.strictEqual(typeof S.VERSION, 'string'); assert.ok(S.VERSION.length > 0);
  var a = race(5, RETA, campo2());
  assert.strictEqual(a.simVersion, S.VERSION); assert.ok(/^[0-9a-f]{16}$/.test(a.tuningHash), a.tuningHash);
  assert.strictEqual(race(6, CURVA, campo2()).tuningHash, a.tuningHash, 'não depende da seed nem do mapa');
  assert.strictEqual(S.tuningHash(), a.tuningHash);
  var old = S.TUNING.vBase; S.TUNING.vBase = old + 0.01;
  try { assert.notStrictEqual(S.tuningHash(), a.tuningHash, 'TUNING'); } finally { S.TUNING.vBase = old; }
  var sk = G.SKILLS.sprint.effect, sm = sk.speedMult; sk.speedMult = sm + 0.01;
  try { assert.notStrictEqual(S.tuningHash(), a.tuningHash, 'skills'); } finally { sk.speedMult = sm; }
  var te = G.TYPE_SKILLS.fogo.effect, ta = te.accelMult; te.accelMult = ta + 0.01;
  try { assert.notStrictEqual(S.tuningHash(), a.tuningHash, 'skills de tipo'); } finally { te.accelMult = ta; }
  assert.strictEqual(S.tuningHash(), a.tuningHash);
});
test('todo gatilho usado em SKILLS tem peso no Poder (SKILL_TRIGGER_WEIGHT)', function () {
  var W = S.SKILL_TRIGGER_WEIGHT; assert.ok(W && typeof W === 'object');
  Object.keys(G.SKILLS).forEach(function (id) {
    var trig = G.SKILLS[id].trigger, key = trig.indexOf('weather:') === 0 ? 'weather' : trig;
    assert.strictEqual(typeof W[key], 'number', id + ': gatilho ' + trig + ' sem peso');
    assert.strictEqual(S.skillWeight(id), W[key], id);
  });
});
test('payouts: valores exatos com porcentagens inteiras (4–8 corredores × 50/100/250)', function () {
  var esperado = {
    50: { 4: [126, 54], 5: [158, 67], 6: [135, 81, 54], 7: [158, 94, 63], 8: [216, 90, 54] },
    100: { 4: [252, 108], 5: [315, 135], 6: [270, 162, 108], 7: [315, 189, 126], 8: [432, 180, 108] },
    250: { 4: [630, 270], 5: [788, 337], 6: [675, 405, 270], 7: [788, 472, 315], 8: [1080, 450, 270] }
  };
  Object.keys(esperado).forEach(function (fee) {
    Object.keys(esperado[fee]).forEach(function (nr) {
      var order = []; for (var q = 0; q < +nr; q++) order.push(q);
      var p = S.payouts(+fee, +nr, order), am = p.prizes.map(function (x) { return x.amount; });
      assert.deepStrictEqual(am, esperado[fee][nr], fee + '×' + nr);
      assert.strictEqual(am.reduce(function (s, x) { return s + x; }, 0), p.pot - p.fee, fee + '×' + nr + ' soma');
      am.forEach(function (x, k) { if (k) assert.ok(x <= am[k - 1], 'crescente ' + fee + '×' + nr); });
    });
  });
  [1, 3, 7].forEach(function (fee) { for (var nr = 4; nr <= 8; nr++) { var am = S.payouts(fee, nr, [0, 1, 2, 3, 4, 5, 6, 7].slice(0, nr)).prizes.map(function (x) { return x.amount; });
    am.forEach(function (x, k) { if (k) assert.ok(x <= am[k - 1], 'crescente ' + fee + '×' + nr + ': ' + am); }); } });
});
test('podiumStone sorteia cada lugar de forma independente', function () {
  var sem1 = 0, tem3sem1 = 0, tem2sem1 = 0, ambos = 0, N = 4000;
  for (var s = 1; s <= N; s++) {
    var p1 = GR.podiumStone(s, 1, 50), p2 = GR.podiumStone(s, 2, 50), p3 = GR.podiumStone(s, 3, 50);
    if (!p1) { sem1++; tem3sem1 += p3; tem2sem1 += p2; }
    if (p1 && p3) ambos++;
  }
  near(100 * tem3sem1 / sem1, 25, 3, '3º ganha pedra quando o 1º não ganha');
  near(100 * tem2sem1 / sem1, 40, 3, '2º ganha pedra quando o 1º não ganha');
  near(100 * ambos / N, 15, 2, '1º e 3º juntos (0,6 × 0,25)');
});
test('enhanceOdds/enhance exigem plus inteiro 0–9 (o +10 já está no máximo)', function () {
  [1.5, '3', NaN, -1, 10, 11, null, undefined, Infinity].forEach(function (p) {
    assert.strictEqual(GR.enhanceOdds(p), null, String(p));
    assert.strictEqual(GR.enhance({ uid: 'x', id: 'sela-comum', plus: p }, 1, 0), null, String(p));
  });
  assert.strictEqual(GR.enhance(null, 1, 0), null);
  assert.deepStrictEqual(GR.enhanceOdds(3), { chance: 0.7, cost: 1, dropTo: 3 });
});
test('foal/rentalPrice/odds com grau e level malformados', function () {
  var f = mk2({ sex: 'f' }), m = mk2({}); delete f.grau; m.grau = undefined;
  var x = B.foal({ f: f, m: m, seedBase: 1, breedCounter: 0, nextUid: 1 });
  assert.ok(x.grau >= 1 && x.grau <= 3);
  var g0 = mk2({ rarity: 'comum' }); g0.grau = 0;   // mk2 troca grau 0 por 2
  assert.strictEqual(B.rentalPrice(g0), B.rentalPrice(mk2({ rarity: 'comum', grau: 1 })));
  assert.strictEqual(B.rentalPrice(mk2({ rarity: 'comum', grau: 4 })), B.rentalPrice(mk2({ rarity: 'comum', grau: 3 })));
  var semGrau = mk2({ rarity: 'comum' }); delete semGrau.grau; assert.strictEqual(B.rentalPrice(semGrau), 125, 'sem grau vale ★★');
  assert.strictEqual(B.rentalPrice(mk2({ rarity: 'comum', grau: 'x' })), 125);
  assert.deepStrictEqual(B.rarityOdds(mk2({ sex: 'f', level: 'x' }), mk2({ level: 'x' })), B.rarityOdds(mk2({ sex: 'f', level: 1 }), mk2({ level: 1 })));
  assert.strictEqual(B.levelFactor(mk2({ sex: 'f', level: 1e9 }), mk2({ level: 1e9 })), 1);
  assert.ok(isFinite(B.levelFactor(mk2({ sex: 'f', level: NaN }), mk2({ level: 'abc' }))));
  assert.strictEqual(B.hexMix, undefined, 'hexMix não é exportado');
});
test('Dev.TRACADOS removido', function () { assert.strictEqual(DV().TRACADOS, undefined); });

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
