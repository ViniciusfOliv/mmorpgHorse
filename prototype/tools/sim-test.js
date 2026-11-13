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
test('5 raridades com fator de pontos/vagas/chance (sem teto por raridade)', function () {
  assert.deepStrictEqual(Object.keys(G.RARITIES), ['comum','magico','raro','lendario','mitico']);
  assert.strictEqual(G.RARITIES.mitico.ptsMult, 1.2); assert.strictEqual(G.RARITIES.comum.skillSlots, 1);
  Object.keys(G.RARITIES).forEach(function (r) { assert.strictEqual(G.RARITIES[r].statCap, undefined, r + ' sem statCap'); });
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
test('computeStats devolve 7 chaves: base + pontos comprados, sem teto por raridade', function () {
  var h = JSON.parse(JSON.stringify(G.STARTERS[0])); h.level = 50; h.alloc = { vel: 20, acel: 20 };
  var s = S.computeStats(h);
  assert.deepStrictEqual(Object.keys(s), G.STAT_KEYS);
  // Brasa: genética 24 em Velocidade e Aceleração, base 40 + 16 × 24 / 31 = 52,39 (o nível não soma nada); + 20 pontos = 72
  assert.strictEqual(s.vel, 72); assert.strictEqual(s.acel, 72, 'sem bônus fixo de elemento');
});
test('skillChance: comum lv1 sorte 0 = 0.35; mítico lv50 sorte 100 = 0.95 (teto); raro lv10 sorte 50 ≈ 0.645', function () {
  var mk = function (r, lv) { return { rarity: r, level: lv }; };
  assert.strictEqual(S.skillChance(mk('comum', 1), { sorte: 0 }), 0.35);
  assert.strictEqual(S.skillChance(mk('mitico', 50), { sorte: 100 }), 0.95);
  assert.ok(Math.abs(S.skillChance(mk('raro', 10), { sorte: 50 }) - 0.645) < 1e-9);
});
test('powerRating usa os 7 pesos, 14 por skill e os termos de nível e raridade (spec §7)', function () {
  var h = JSON.parse(JSON.stringify(G.STARTERS[0])); var s = S.computeStats(h), w = S.TUNING.ratingW, sum = 0;
  G.STAT_KEYS.forEach(function (k) { sum += s[k] * w[k]; });
  assert.deepStrictEqual(w, { vel: 2.5, acel: 2.0, man: 2.2, est: 2.4, forca: 2.4, garra: 1.5, sorte: 0 });
  assert.deepStrictEqual([S.TUNING.ratingSkillPts, S.TUNING.ratingLevel, S.TUNING.ratingRar], [14, 20, 28]);
  // os iniciais nascem sem skill; Comum nível 1: nível e raridade somam 0
  assert.strictEqual(S.powerRating(h), Math.round(sum));
  h.skills = ['arranque']; assert.strictEqual(S.powerRating(h), Math.round(sum + 14 * 1));   // arranque: start = 1
  h.level = 50; s = S.computeStats(h); sum = 0; G.STAT_KEYS.forEach(function (k) { sum += s[k] * w[k]; });
  assert.strictEqual(S.powerRating(h), Math.round(sum + 14 + 20));
  h.rarity = 'mitico'; s = S.computeStats(h); sum = 0; G.STAT_KEYS.forEach(function (k) { sum += s[k] * w[k]; });
  assert.strictEqual(S.powerRating(h), Math.round(sum + 14 + 20 + 28));
});
test('powerRating: o tipo não entra no Poder (nível e raridade valem o mesmo para os três e para elemento desconhecido)', function () {
  var h0 = JSON.parse(JSON.stringify(G.STARTERS[0])); h0.level = 30; h0.rarity = 'raro'; h0.skills = [];
  ['fogo', 'agua', 'grama', 'neutro', 'lava', undefined].forEach(function (e) {
    var h = JSON.parse(JSON.stringify(h0)); h.element = e;
    var s = S.computeStats(h), w = S.TUNING.ratingW, sum = 0;
    G.STAT_KEYS.forEach(function (k) { sum += s[k] * w[k]; });
    if (['fogo', 'agua', 'grama'].indexOf(e) < 0) assert.strictEqual(S.typeSkill(h), null, String(e));
    assert.strictEqual(S.powerRating(h), Math.round(sum + 20 * 29 / 49 + 28 * 2 / 4), String(e));
  });
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
  assert.deepStrictEqual(S.computeStats(h), { vel: 52, acel: 52, man: 47, forca: 46, est: 46, garra: 47, sorte: 46 });
});
test('v3: iniciais são Comuns ★★ com a mesma soma de genética e de status', function () {
  G.STARTERS.forEach(function (h) {
    var g = 0, s = 0, st = S.computeStats(h);
    G.STAT_KEYS.forEach(function (k) { g += h.potential[k]; s += st[k]; });
    assert.strictEqual(h.rarity, 'comum'); assert.strictEqual(h.grau, 2); assert.strictEqual(g, 112); assert.strictEqual(s, 336);
    assert.strictEqual(h.base, undefined);
  });
});
test('v3: estrelas (starsOf) e status arredondado uma vez só, no fim', function () {
  assert.strictEqual(S.starsOf({ grau: 1 }), 1); assert.strictEqual(S.starsOf({ grau: 3 }), 3);
  [undefined, null, 'x', NaN, Infinity].forEach(function (g) { assert.strictEqual(S.starsOf({ grau: g }), 2, String(g)); });
  assert.strictEqual(S.starsOf(null), 2); assert.strictEqual(S.starsOf({}), 2);
  // como Breed.grauOf: fora da faixa é preso a 1–3
  assert.strictEqual(S.starsOf({ grau: 0 }), 1); assert.strictEqual(S.starsOf({ grau: 7 }), 3); assert.strictEqual(S.starsOf({ grau: '3' }), 3);
  // base 40 + 16/31 = 40,516 vira 41; com 3 pontos, round(43,516) = 44
  var h = { rarity: 'comum', level: 10, grau: 2, potential: { vel: 1 } };
  assert.strictEqual(S.computeStats(h).vel, 41);
  h.alloc = { vel: 3 }; assert.strictEqual(S.computeStats(h).vel, 44);
});

// ---------------------------------------------------------------------------
// Crescimento livre (bloco 1b; spec 2026-11-12-crescimento-livre §2–§7 e §13)
// ---------------------------------------------------------------------------
section('Crescimento livre');
var RARS = ['comum', 'magico', 'raro', 'lendario', 'mitico'];
var ZEROS = { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 };
function custoTotal(a) { var c = 0; G.STAT_KEYS.forEach(function (k) { c += S.costOf(a[k]); }); return c; }
test('constantes novas em TUNING e nas raridades; sem statCap, freeCapShare, statLimit nem crescimento natural', function () {
  var T = S.TUNING;
  assert.deepStrictEqual([T.ptsRate0, T.ptsRate1, T.starMult, T.costStep, T.statMax, T.noBuy], [2, 6, [1, 1.09, 1.22], 10, 150, ['sorte']]);
  assert.deepStrictEqual(RARS.map(function (r) { return G.RARITIES[r].baseLo; }), [40, 44, 49, 54, 60]);
  assert.deepStrictEqual(RARS.map(function (r) { return G.RARITIES[r].ptsMult; }), [1, 1.05, 1.1, 1.15, 1.2]);
  ['freeCapShare', 'gGrowBase', 'gGrowRange', 'weatherMultSet', 'ratingTypeW', 'aBase', 'aRange'].forEach(function (k) { assert.strictEqual(T[k], undefined, 'TUNING.' + k); });
  assert.strictEqual(S.statLimit, undefined, 'statLimit saiu');
});
test('freePoints: 0 no nível 1, 2 no nível 2; Comum ★ 50 = 196; Comum ★★ 11/30/50 = 25/100/213; Mítico ★★★ 50 = 286', function () {
  RARS.forEach(function (r) {
    [1, 2, 3].forEach(function (st) {
      assert.strictEqual(S.freePoints({ rarity: r, grau: st, level: 1 }), 0, r + ' ★' + st + ' nível 1');
      assert.strictEqual(S.freePoints({ rarity: r, grau: st, level: 2 }), 2, r + ' ★' + st + ' nível 2');
    });
  });
  assert.strictEqual(S.freePoints({ rarity: 'comum', grau: 1, level: 50 }), 196);
  assert.deepStrictEqual([11, 30, 50].map(function (L) { return S.freePoints({ rarity: 'comum', grau: 2, level: L }); }), [25, 100, 213]);
  assert.strictEqual(S.freePoints({ rarity: 'mitico', grau: 3, level: 50 }), 286);
  // a tabela da spec §2 (Comum / Mítico nos níveis 11, 30 e 50)
  var tab = { 1: [[23, 91, 196], [28, 110, 235]], 2: [[25, 100, 213], [31, 120, 256]], 3: [[28, 112, 239], [34, 134, 286]] };
  [1, 2, 3].forEach(function (st) {
    ['comum', 'mitico'].forEach(function (r, q) {
      assert.deepStrictEqual([11, 30, 50].map(function (L) { return S.freePoints({ rarity: r, grau: st, level: L }); }), tab[st][q], r + ' ★' + st);
    });
  });
  // a taxa por nível sobe: ganho de um nível nunca cai (Comum ★, sem o fator)
  var prev = 0;
  for (var L = 2; L <= 50; L++) { var d = S.freePoints({ rarity: 'comum', grau: 1, level: L }) - S.freePoints({ rarity: 'comum', grau: 1, level: L - 1 }); assert.ok(d >= prev - 1, 'nível ' + L); prev = d; }
  // nível malformado vale 1; acima de 50 vale 50
  assert.strictEqual(S.freePoints({ rarity: 'raro', grau: 2, level: 'x' }), 0);
  assert.strictEqual(S.freePoints({ rarity: 'raro', grau: 2, level: 99 }), S.freePoints({ rarity: 'raro', grau: 2, level: 50 }));
});
test('custo por faixa: costOf(0/1/10/11/20/30/50) = 0/1/10/12/30/60/150 e pointCost(0/9/10/19/20) = 1/1/2/2/3', function () {
  assert.deepStrictEqual([0, 1, 10, 11, 20, 30, 50].map(S.costOf), [0, 1, 10, 12, 30, 60, 150]);
  assert.deepStrictEqual([0, 9, 10, 19, 20].map(S.pointCost), [1, 1, 2, 2, 3]);
  // costOf é a soma dos pointCost
  var soma = 0;
  for (var a = 0; a <= 120; a++) { assert.strictEqual(S.costOf(a), soma, 'costOf(' + a + ')'); soma += S.pointCost(a); }
});
test('validAlloc: corta pelo 150 e depois pelo custo, na ordem de STAT_KEYS; zera a Sorte; lixo vira 0', function () {
  var h = clone(G.STARTERS[0]); h.level = 50;   // Comum ★★: 213 pontos
  // pelo custo, na ordem: 60 em Velocidade custam 210; sobram 3, que compram 3 de Aceleração; Manobra fica sem
  assert.deepStrictEqual(S.validAlloc(h, { vel: 60, acel: 60, man: 60 }), { vel: 60, acel: 3, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 });
  assert.deepStrictEqual(S.validAlloc(h, { man: 60, vel: 60 }), { vel: 60, acel: 0, man: 3, forca: 0, est: 0, garra: 0, sorte: 0 }, 'a ordem é a de STAT_KEYS, não a do objeto');
  // pelo teto antes do custo: com statMax 60 (só neste teste), cada status aceita até piso(60 − base)
  var T = S.TUNING, sm = T.statMax;
  T.statMax = 60;
  try {
    var mb = Math.floor(60 - S.naturalStat(h, 'vel'));
    assert.strictEqual(S.maxBuy(h, 'vel'), mb);
    // sem o corte do teto primeiro, 50 em Velocidade custariam 150 e Aceleração ficaria com 25
    var v = S.validAlloc(h, { vel: 50, acel: 50 });
    assert.strictEqual(v.vel, mb); assert.strictEqual(v.acel, mb);
    assert.ok(S.naturalStat(h, 'vel') + v.vel <= 60 && S.naturalStat(h, 'vel') + v.vel + 1 > 60);
  } finally { T.statMax = sm; }
  // Sorte não recebe pontos
  assert.strictEqual(S.maxBuy(h, 'sorte'), 0);
  assert.deepStrictEqual(S.validAlloc(h, { sorte: 10, vel: 2 }), { vel: 2, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 });
  // lixo: negativo, fração, texto, chave faltando, não objeto
  assert.deepStrictEqual(S.validAlloc(h, { vel: -5, acel: 2.7, man: 'abc', forca: '3', est: NaN, garra: Infinity }), { vel: 0, acel: 2, man: 0, forca: 3, est: 0, garra: 0, sorte: 0 });
  [null, undefined, 'tudo', 7, {}].forEach(function (a) { assert.deepStrictEqual(S.validAlloc(h, a), ZEROS, String(a)); });
  // saída sempre válida: inteiros ≥ 0, base + a ≤ 150, custo ≤ pontos
  var rng = S.mulberry32(5);
  for (var i = 0; i < 300; i++) {
    var x = { rarity: RARS[i % 5], grau: 1 + i % 3, level: 1 + Math.floor(rng() * 50), potential: {} }, a = {};
    G.STAT_KEYS.forEach(function (k) { x.potential[k] = Math.floor(rng() * 32); a[k] = Math.floor(rng() * 200) - 20; });
    var va = S.validAlloc(x, a);
    assert.ok(custoTotal(va) <= S.freePoints(x), 'custo');
    G.STAT_KEYS.forEach(function (k) { assert.ok(va[k] >= 0 && va[k] === Math.floor(va[k]) && S.naturalStat(x, k) + va[k] <= 150 + 1e-9, k); });
    assert.strictEqual(va.sorte, 0);
    assert.deepStrictEqual(S.validAlloc(x, va), va, 'idempotente');
  }
});
test('allocInfo: free/used/left, perStat, next e room coerentes com costOf; room.sorte = 0', function () {
  var h = clone(G.STARTERS[0]); h.level = 50; h.alloc = { vel: 4, est: 10 };
  var info = S.allocInfo(h);
  assert.deepStrictEqual(Object.keys(info).sort(), ['free', 'left', 'next', 'perStat', 'room', 'used']);
  assert.strictEqual(info.free, 213); assert.strictEqual(info.used, 4 + 10); assert.strictEqual(info.left, 199);
  assert.deepStrictEqual(info.perStat, { vel: 4, acel: 0, man: 0, forca: 0, est: 10, garra: 0, sorte: 0 });
  assert.strictEqual(info.next.vel, 1); assert.strictEqual(info.next.est, 2, 'o 11º ponto custa 2');
  // Velocidade: 4 + 54 = 58 custam 198 (≤ 199 + 4); 59 custariam 204. Estamina: 10 + 49 = 59 custam 204 (≤ 199 + 10)
  assert.strictEqual(info.room.vel, 54); assert.strictEqual(info.room.est, 49); assert.strictEqual(info.room.sorte, 0);
  // comprar room[k] cabe; room[k] + 1 não (pelo custo ou pelo 150), em cavalos sorteados
  var rng = S.mulberry32(11);
  for (var i = 0; i < 200; i++) {
    var x = { rarity: RARS[i % 5], grau: 1 + i % 3, level: 1 + Math.floor(rng() * 50), potential: {}, alloc: {} };
    G.STAT_KEYS.forEach(function (k) { x.potential[k] = Math.floor(rng() * 32); x.alloc[k] = Math.floor(rng() * 25); });
    var inf = S.allocInfo(x), a = S.validAlloc(x, x.alloc);
    assert.strictEqual(inf.used, custoTotal(a)); assert.strictEqual(inf.left, inf.free - inf.used); assert.ok(inf.left >= 0);
    assert.strictEqual(inf.room.sorte, 0);
    G.STAT_KEYS.forEach(function (k) {
      assert.strictEqual(inf.next[k], S.pointCost(a[k]), 'next ' + k);
      var mais = clone(a); mais[k] += inf.room[k];
      assert.deepStrictEqual(S.validAlloc(x, mais), mais, 'room ' + k + ' cabe');
      mais[k] += 1;
      assert.notDeepStrictEqual(S.validAlloc(x, mais), mais, 'room ' + k + ' + 1 não cabe');
    });
  }
});
test('no nível 1: pontos, alloc e allocInfo dão zero (nunca −0)', function () {
  var h = { rarity: 'comum', level: 1, grau: 3, potential: {}, alloc: { vel: 5, acel: 2 } };
  assert.strictEqual(S.freePoints(h), 0);
  assert.deepStrictEqual(S.validAlloc(h, h.alloc), ZEROS);
  var ones = { vel: 1, acel: 1, man: 1, forca: 1, est: 1, garra: 1, sorte: 1 };
  assert.deepStrictEqual(S.allocInfo(h), { free: 0, used: 0, left: 0, perStat: ZEROS, next: ones, room: ZEROS });
});
test('weightedAlloc: um ponto por vez no menor (a + 1)/peso; empate na ordem de STAT_KEYS; determinístico', function () {
  var seis = { vel: 1, acel: 1, man: 1, forca: 1, est: 1, garra: 1 };
  var n2 = { rarity: 'comum', grau: 1, level: 2, potential: {} };   // 2 pontos
  assert.deepStrictEqual(S.weightedAlloc(n2, seis), { vel: 1, acel: 1, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 });
  assert.deepStrictEqual(S.weightedAlloc(n2, { man: 1, garra: 1 }), { vel: 0, acel: 0, man: 1, forca: 0, est: 0, garra: 1, sorte: 0 }, 'peso 0 ou faltando: não compra');
  // peso 2 em Garra: o dobro de pontos (custo por faixa à parte)
  var h = clone(G.STARTERS[1]); h.level = 30;
  var a = S.weightedAlloc(h, { vel: 1, acel: 1, man: 1, forca: 1, est: 1, garra: 2 });
  assert.ok(a.garra >= 2 * a.vel - 2 && a.garra <= 2 * a.vel + 2, JSON.stringify(a));
  assert.deepStrictEqual(S.weightedAlloc(h, { vel: 1, acel: 1, man: 1, forca: 1, est: 1, garra: 2 }), a, 'determinístico');
  // peso na Sorte não compra nada (noBuy)
  assert.strictEqual(S.weightedAlloc(h, { sorte: 5, vel: 1 }).sorte, 0);
  // com statMax baixo para no teto e põe o resto nos outros
  var T = S.TUNING, sm = T.statMax;
  T.statMax = 60;
  try {
    var b = S.weightedAlloc(h, { vel: 100, acel: 1 });
    assert.strictEqual(b.vel, S.maxBuy(h, 'vel')); assert.ok(b.acel > 0, 'o resto foi para Aceleração');
  } finally { T.statMax = sm; }
});
test('botAlloc e weightedAlloc: nunca passam dos pontos nem de 150, nunca põem ponto na Sorte, fixos e sem mutar', function () {
  var casos = [];
  G.STARTERS.concat(G.WILD_HORSES).forEach(function (h0) { [1, 2, 11, 30, 50].forEach(function (lv) { var h = clone(h0); h.level = lv; casos.push(h); }); });
  ['fogo', 'agua', 'grama'].forEach(function (el) { ['comum', 'raro', 'mitico'].forEach(function (r) { [0, 16, 31].forEach(function (g) { [1, 2, 3].forEach(function (st) { casos.push(refBot(el, r, 50, g, st)); }); }); }); });
  casos.forEach(function (h) {
    delete h.alloc;
    var a = S.botAlloc(h), tag = h.id + ' ' + h.element + ' ' + h.rarity + ' nv' + h.level + ' ★' + h.grau, left = S.freePoints(h) - custoTotal(a);
    assert.deepStrictEqual(Object.keys(a), G.STAT_KEYS, tag);
    assert.ok(left >= 0, tag + ' custo');
    assert.strictEqual(a.sorte, 0, tag + ' Sorte');
    G.STAT_KEYS.forEach(function (k) {
      assert.ok(a[k] >= 0 && a[k] === Math.floor(a[k]) && S.naturalStat(h, k) + a[k] <= 150 + 1e-9, tag + ' ' + k);
      // gasta tudo o que dá: nenhum status de corrida aceita mais um ponto
      if (k !== 'sorte') assert.ok(a[k] >= S.maxBuy(h, k) || S.pointCost(a[k]) > left, tag + ' sobrou ponto para ' + k);
    });
    assert.deepStrictEqual(S.validAlloc(h, a), a, tag + ' válida');
    assert.deepStrictEqual(S.botAlloc(h), a, tag + ' fixa');
    assert.strictEqual(h.alloc, undefined, tag + ' não muta');
  });
});
test('botAlloc: pesos do tipo (× 1,2 nos dois status do tipo), Comum ★★ de genética 16 no nível 50', function () {
  assert.deepStrictEqual(S.TUNING.botW, {
    fogo: { vel: 1.2, acel: 1.2, man: 1, forca: 1, est: 1, garra: 1 },
    agua: { vel: 1, acel: 1, man: 1, forca: 1, est: 1.2, garra: 1.2 },
    grama: { vel: 1, acel: 1, man: 1.2, forca: 1.2, est: 1, garra: 1 }
  });
  // 213 pontos: os dois do tipo com 25, os outros com 20 (o ponto que sobra vai ao primeiro na ordem de STAT_KEYS)
  assert.deepStrictEqual(refBot('fogo', 'comum', 50, 16).alloc, { vel: 25, acel: 25, man: 21, forca: 20, est: 20, garra: 20, sorte: 0 });
  assert.deepStrictEqual(refBot('agua', 'comum', 50, 16).alloc, { vel: 21, acel: 20, man: 20, forca: 20, est: 25, garra: 25, sorte: 0 });
  assert.deepStrictEqual(refBot('grama', 'comum', 50, 16).alloc, { vel: 21, acel: 20, man: 25, forca: 25, est: 20, garra: 20, sorte: 0 });
  ['fogo', 'agua', 'grama'].forEach(function (e) { assert.strictEqual(custoTotal(refBot(e, 'comum', 50, 16).alloc), 213, e + ' gasta tudo'); });
  assert.deepStrictEqual(refBot('fogo', 'comum', 1, 16).alloc, ZEROS, 'no nível 1 não há ponto');
  // elemento desconhecido: os pesos do Fogo
  var x = refBot('fogo', 'raro', 30, 9); x.element = 'lava'; assert.deepStrictEqual(S.botAlloc(x), refBot('fogo', 'raro', 30, 9).alloc);
});
test('botAlloc(h, de): mantém o que está em de e só soma ("Distribuir sugerido")', function () {
  var h = clone(G.STARTERS[2]); h.level = 40;
  [{ vel: 30 }, { garra: 12, est: 3 }, { man: 50, forca: 1 }, {}, null].forEach(function (de) {
    var a = S.botAlloc(h, de), base = S.validAlloc(h, de), left = S.freePoints(h) - custoTotal(a);
    G.STAT_KEYS.forEach(function (k) { assert.ok(a[k] >= base[k], JSON.stringify(de) + ' ' + k); });
    assert.strictEqual(a.sorte, 0); assert.ok(left >= 0);
    ['vel', 'acel', 'man', 'forca', 'est', 'garra'].forEach(function (k) { assert.ok(a[k] >= S.maxBuy(h, k) || S.pointCost(a[k]) > left, 'gasta tudo: ' + k); });
    assert.deepStrictEqual(S.botAlloc(h, de), a, 'determinístico');
  });
  assert.deepStrictEqual(S.botAlloc(h, null), S.botAlloc(h), 'sem de, parte do zero');
  // Sorte em `de` é zerada (validAlloc) e o que já gastou tudo volta igual
  assert.strictEqual(S.botAlloc(h, { sorte: 9 }).sorte, 0);
  var cheio = S.botAlloc(h); assert.deepStrictEqual(S.botAlloc(h, cheio), cheio);
  // de acima do orçamento: é saneado antes (validAlloc), nunca passa dos pontos
  assert.ok(custoTotal(S.botAlloc(h, { vel: 999, acel: 999 })) <= S.freePoints(h));
});
test('computeStats sem gear e em 1–150; o pior caso no nível 50 (Mítico ★★★, genética 31, tudo num status) é 146', function () {
  assert.strictEqual(S.computeStats.length, 1, 'computeStats(horse)'); assert.strictEqual(S.powerRating.length, 1, 'powerRating(horse)');
  var m = { element: 'fogo', rarity: 'mitico', grau: 3, level: 50, potential: {}, alloc: { vel: 999 } };
  G.STAT_KEYS.forEach(function (k) { m.potential[k] = 31; });
  assert.strictEqual(S.maxBuy(m, 'vel'), 74); assert.strictEqual(S.validAlloc(m, m.alloc).vel, 70);
  assert.strictEqual(S.computeStats(m).vel, 146);
  var rng = S.mulberry32(21);
  for (var i = 0; i < 300; i++) {
    var x = { rarity: RARS[i % 5], grau: 1 + i % 3, level: 1 + Math.floor(rng() * 50), potential: {}, alloc: {} };
    G.STAT_KEYS.forEach(function (k) { x.potential[k] = Math.floor(rng() * 32); x.alloc[k] = Math.floor(rng() * 300); });
    var s = S.computeStats(x);
    G.STAT_KEYS.forEach(function (k) { assert.ok(s[k] >= 1 && s[k] <= 150 && s[k] === Math.round(s[k]), k + ' = ' + s[k]); });
  }
});
test('powerRating e computeStats iguais com e sem peças no cavalo (equipamento suspenso)', function () {
  var SL = ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'], items = {}, equip = {};
  SL.forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-sol-raro', plus: 10 }; equip[sl] = 'i' + i; });
  var g5 = GR.resolve({ equip: equip }, items);
  assert.ok(g5.mods.vel > 0 && g5.set.count === 5, 'o conjunto ainda resolve (gear.js não muda)');
  G.STARTERS.forEach(function (h0) {
    var h = clone(h0); h.level = 30; h.alloc = S.botAlloc(h);
    var sem = { st: S.computeStats(h), pr: S.powerRating(h) };
    h.equip = clone(equip);   // peças equipadas no cavalo
    [g5, GR.resolve({}, {}), 'sela-couro', { mods: { vel: 200 } }, null].forEach(function (g, gi) {
      assert.deepStrictEqual(S.computeStats(h, g), sem.st, h.id + ' status, gear ' + gi);
      assert.strictEqual(S.powerRating(h, g), sem.pr, h.id + ' Poder, gear ' + gi);
    });
  });
});
test('Dado da Sorte: chance do 2º dado 0 com Sorte 40, 0,5 com 60 e 1 com 80 ou mais', function () {
  assert.deepStrictEqual([S.TUNING.sorteDiceLo, S.TUNING.sorteDiceFull], [40, 80]);
  function dois(sorte, N) { var rng = S.mulberry32(31 + sorte), c = 0; for (var i = 0; i < N; i++) if (S.rollDice(rng, sorte, 0).dice.length === 2) c++; return c / N; }
  assert.strictEqual(dois(40, 3000), 0); assert.strictEqual(dois(0, 1000), 0, 'abaixo de 40 também 0');
  assert.strictEqual(dois(80, 3000), 1); assert.strictEqual(dois(150, 1000), 1);
  near(dois(60, 20000), 0.5, 0.015, 'Sorte 60');
  near(dois(50, 20000), 0.25, 0.015, 'Sorte 50');
  // Mítico g31 (Sorte 76) contra sete Comuns g0 (Sorte 40): ~20,8% (spec §4; o justo seria 12,5%)
  var rng = S.mulberry32(77), w = 0, N = 8000;
  for (var i = 0; i < N; i++) { var me = S.rollDice(rng, 76, 0).best, top = 0; for (var j = 0; j < 7; j++) top = Math.max(top, S.rollDice(rng, 40, 0).best); if (me > top) w++; else if (me === top) w += 0.5; }
  var p = 100 * w / N; assert.ok(p >= 17 && p <= 25, p + '%');
});
// Corredor de teste plano: Comum nível 1 (P da skill de tipo = 1), genética 0, todo status = `v` pelo gancho statAdd
function plano(el, v, extra) {
  var h = { id: 'p', name: 'P', element: el, rarity: 'comum', level: 1, grau: 2, potential: {}, skills: [] }, add = {};
  G.STAT_KEYS.forEach(function (k) { h.potential[k] = 0; add[k] = (extra && extra[k] != null ? extra[k] : v) - 40; });
  return { horse: h, statAdd: add };
}
function solo(seed, cond, ent, semTipo) {
  var e = { horse: ent.horse, statAdd: ent.statAdd, name: 'p' }; if (semTipo) e.noTypeSkill = true;
  return S.simulate({ seed: seed, conditions: cond, recordFrames: true, racers: [e] });
}
var MISTA = { distance: 1800, surface: 'terra', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 200 }, { type: 'curva', from: 200, to: 500 }, { type: 'subida', from: 500, to: 800 },
  { type: 'curva', from: 800, to: 1100 }, { type: 'subida', from: 1100, to: 1300 }, { type: 'curva', from: 1300, to: 1600 }, { type: 'reta', from: 1600, to: 1800 }] };
test('skill de tipo: os dois status do tipo valem × (1 + m·P) no terço dela', function () {
  // com o terço estendido à pista toda, o cavalo com a skill corre igual (frame a frame) ao cavalo sem ela com os
  // dois status × (1 + m): 100 → 119 (Fogo), 115 (Grama) e 133 (Água), Comum nível 1 (P = 1). Status que entram
  // fora do terço (atraso de largada pela Aceleração, tanque pela Estamina, início da arrancada pela Garra) ficam
  // presos pelo TUNING de teste, para a comparação ser exata.
  var T = S.TUNING, salvo = { sd: T.startDelayMax, pe: T.poolEst, gz: T.garraZoneK }, zonas = {};
  var casos = [['fogo', { vel: 119, acel: 119 }], ['grama', { forca: 115, man: 115 }], ['agua', { est: 133, garra: 133 }]];
  T.startDelayMax = 0; T.poolEst = 0; T.garraZoneK = 0;
  casos.forEach(function (c) { zonas[c[0]] = G.TYPE_SKILLS[c[0]].zone; G.TYPE_SKILLS[c[0]].zone = [0, 1]; });
  try {
    casos.forEach(function (c) {
      assert.strictEqual(S.typePower({ element: c[0], rarity: 'comum', level: 1 }), 1);
      for (var s = 1; s <= 4; s++) {
        var cond = s === 1 ? MISTA : S.randomConditions(s);
        var com = solo(s, cond, plano(c[0], 100)), sem = solo(s, cond, plano(c[0], 100, c[1]), true), nada = solo(s, cond, plano(c[0], 100), true);
        assert.deepStrictEqual(com.frames, sem.frames, c[0] + ' seed ' + s + ': frames iguais aos do status multiplicado');
        assert.deepStrictEqual(com.finishTimes, sem.finishTimes);
        assert.notDeepStrictEqual(com.frames, nada.frames, c[0] + ' seed ' + s + ': a skill muda a corrida');
      }
    });
  } finally {
    T.startDelayMax = salvo.sd; T.poolEst = salvo.pe; T.garraZoneK = salvo.gz;
    casos.forEach(function (c) { G.TYPE_SKILLS[c[0]].zone = zonas[c[0]]; });
  }
});
test('skill de tipo: fora do terço, os valores normais', function () {
  function primeiroDiferente(a, b) { for (var f = 0; f < a.frames.length; f++) if (JSON.stringify(a.frames[f]) !== JSON.stringify(b.frames[f])) return f; return -1; }
  // antes do terço: frames iguais aos do cavalo sem a skill até ele entrar no terço (Raízes Firmes e Maré Alta)
  [['grama', 1 / 3], ['agua', 2 / 3]].forEach(function (c) {
    var com = solo(3, MISTA, plano(c[0], 100)), sem = solo(3, MISTA, plano(c[0], 100), true), f = primeiroDiferente(com, sem);
    assert.ok(f > 0, c[0] + ': difere em algum ponto');
    assert.ok(com.frames[f - 1].pos[0] >= c[1] * MISTA.distance - 1e-9, c[0] + ': igual até entrar no terço (frame ' + f + ', ' + com.frames[f - 1].pos[0] + ' m)');
    assert.ok(com.frames[f - 2].pos[0] < c[1] * MISTA.distance, c[0] + ': difere logo depois de entrar');
  });
  // depois do terço: o terço normal e o terço estendido até o fim correm iguais até o fim do terço normal
  ['fogo', 'grama'].forEach(function (e) {
    var z = G.TYPE_SKILLS[e].zone, normal = solo(5, MISTA, plano(e, 100)), longa;
    G.TYPE_SKILLS[e].zone = [z[0], 1];
    try { longa = solo(5, MISTA, plano(e, 100)); } finally { G.TYPE_SKILLS[e].zone = z; }
    var f = primeiroDiferente(normal, longa);
    assert.ok(f > 0, e + ': o terço estendido muda a corrida');
    assert.ok(normal.frames[f - 1].pos[0] >= z[1] * MISTA.distance - 1e-9, e + ': igual até o fim do terço (' + normal.frames[f - 1].pos[0] + ' m)');
  });
});
test('física linear até 150: com todos os status em 50/80/110/140, +10 em VEL, ACE, MAN, FOR, EST e GAR melhora o tempo médio', function () {
  // corrida solo (elemento desconhecido: sem clima e sem skill de tipo), pareada por seed e mapa. A Garra dispara
  // sempre (chance presa em 1 só neste teste): numa corrida solo o cara ou coroa da Garra domina o ruído do
  // tempo (±2 s em 24 seeds); sem ele, cada ganho fica com intervalo de ±0,1 s. Medido: 0,36 a 0,73 s.
  var SEIS = ['vel', 'acel', 'man', 'forca', 'est', 'garra'], N = 24, ganhos = {}, T = S.TUNING, gc = [T.garraChanceBase, T.garraChanceMax];
  T.garraChanceBase = 1; T.garraChanceMax = 1;
  try {
    [50, 80, 110, 140].forEach(function (X) {
      var base = [], i;
      for (i = 0; i < N; i++) base.push(solo(S.hash2(41, i), S.randomConditions(S.hash2(41, i)), plano('neutro', X)).finishTimes[0]);
      SEIS.forEach(function (k) {
        var extra = {}, d = 0; extra[k] = X + 10;
        for (i = 0; i < N; i++) d += base[i] - solo(S.hash2(41, i), S.randomConditions(S.hash2(41, i)), plano('neutro', X, extra)).finishTimes[0];
        ganhos[X + ' ' + k] = d / N;
      });
    });
  } finally { T.garraChanceBase = gc[0]; T.garraChanceMax = gc[1]; }
  Object.keys(ganhos).forEach(function (q) { assert.ok(ganhos[q] > 0.15, '+10 em ' + q + ': ganho médio ' + ganhos[q].toFixed(3) + ' s'); });
});
test('determinismo: mesma seed e configuração, mesmo resultado; VERSION do bloco 1b', function () {
  assert.strictEqual(S.VERSION, '3.1.0'); assert.notStrictEqual(S.VERSION, '3.0.0', 'subiu do bloco 1');
  var cfg = function () { return { seed: 77, recordFrames: true, racers: G.STARTERS.map(function (h, i) { var c = clone(h); c.level = 20; c.alloc = S.botAlloc(c); return { horse: c, name: 'r' + i }; }) }; };
  assert.strictEqual(JSON.stringify(S.simulate(cfg())), JSON.stringify(S.simulate(cfg())));
  assert.notStrictEqual(JSON.stringify(S.simulate(cfg()).finishTimes), JSON.stringify(S.simulate(Object.assign(cfg(), { seed: 78 })).finishTimes));
});

section('Poder, bots e ligas v3');
function refBot(el, rarity, level, g, grau) {
  var h = { id: 'ref', name: 'Ref', element: el, rarity: rarity, level: level, grau: grau || 2, potential: {}, skills: [] };
  G.STAT_KEYS.forEach(function (k) { h.potential[k] = g; });
  h.alloc = S.botAlloc(h); return h;
}
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
// Corredor de teste: Mítico nível 1 com genética 0 (todo status base = 60). Os valores de `over` viram o
// gancho de teste statAdd da entrada (testAdd, entregue por soma(h)) para fixar o status exato no nível 1
// (o equipamento não mexe mais nos status). Elemento 'neutro' (desconhecido desde a v3): sem clima e sem
// skill de tipo, para isolar o status.
function mk(over) { var h = clone(G.WILD_HORSES[0]); h.rarity = 'mitico'; h.level = 1; h.element = 'neutro'; h.skills = []; h.testAdd = {};
  G.STAT_KEYS.forEach(function (k) { h.potential[k] = 0; h.testAdd[k] = (over && k in over ? over[k] : 60) - 60; }); return h; }
function soma(h) { return h.testAdd || null; }
function race(seed, cond, horses) { return S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: horses.map(function (h, i) { return { horse: h, statAdd: soma(h), name: 'r' + i, isPlayer: i === 0 }; }) }); }
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
    var res = S.simulate({ seed: s, conditions: cond, recordFrames: true, racers: [h, mk({})].map(function (x, i) { return { horse: x, statAdd: soma(x), name: 'r' + i }; }) });
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
  // bloco 1b: a skill de tipo multiplica os dois status do tipo no seu terço (statMul; spec §5)
  assert.strictEqual(TS.fogo.id, 'labareda'); assert.deepStrictEqual(TS.fogo.zone, [0, 1 / 3]); assert.deepStrictEqual(TS.fogo.effect, { statMul: 0.19 });
  assert.strictEqual(TS.grama.id, 'raizes-firmes'); assert.deepStrictEqual(TS.grama.zone, [1 / 3, 2 / 3]); assert.deepStrictEqual(TS.grama.effect, { statMul: 0.15 });
  assert.strictEqual(TS.agua.id, 'mare-alta'); assert.deepStrictEqual(TS.agua.zone, [2 / 3, 1]); assert.deepStrictEqual(TS.agua.effect, { statMul: 0.33 });
  TIPOS.forEach(function (e) { var t = TS[e]; assert.ok(t.name && t.short && t.short.length <= 12 && t.desc, e + ' nome, nome curto e descrição'); });
  assert.ok(/19%/.test(TS.fogo.desc) && /15%/.test(TS.grama.desc) && /33%/.test(TS.agua.desc), 'a descrição diz o %');
  ['labareda', 'mare-alta', 'raizes-firmes'].forEach(function (id) { assert.strictEqual(G.SKILLS[id], undefined, id + ' fora das skills de vaga'); });
  var T = S.TUNING;
  assert.deepStrictEqual([T.typeBase, T.typeLevel, T.typeRar, T.distMin, T.distMax, T.distStep, T.trackMaxShare, T.trackTries],
    [1, { fogo: -0.15, agua: 0, grama: 0.25 }, { fogo: 0.15, agua: 0.15, grama: 0.40 }, 1400, 2000, 50, 0.5, 60]);
});
test('v3: catálogo sem Pangaré e com Ventania de Grama', function () {
  var todos = G.STARTERS.concat(G.WILD_HORSES);
  assert.ok(!todos.some(function (h) { return h.id === 'w-pangare'; }), 'Pangaré saiu');
  assert.strictEqual(todos.filter(function (h) { return h.id === 'w-ventania'; })[0].element, 'grama');
  todos.forEach(function (h) { assert.ok(G.ELEMENTS[h.element], h.id + ' tipo ' + h.element); });
});
test('v3: força da skill de tipo (P = 1 + nívelT·(L − 1)/49 + raridadeT·ordem/4, por tipo)', function () {
  function P(e, r, L) { return S.typePower({ element: e, rarity: r, level: L }); }
  TIPOS.forEach(function (e) { assert.strictEqual(P(e, 'comum', 1), 1, e + ' Comum nível 1'); });
  // Fogo −0,15/0,15 · Água 0/0,15 · Grama 0,25/0,40
  assert.ok(Math.abs(P('fogo', 'raro', 30) - (1 - 0.15 * 29 / 49 + 0.15 * 2 / 4)) < 1e-9);
  assert.ok(Math.abs(P('agua', 'raro', 30) - 1.075) < 1e-9);
  assert.ok(Math.abs(P('grama', 'raro', 30) - (1 + 0.25 * 29 / 49 + 0.2)) < 1e-9);
  assert.deepStrictEqual(TIPOS.map(function (e) { return Math.round(P(e, 'mitico', 50) * 1e9) / 1e9; }), [1, 1.15, 1.65]);
  assert.ok(Math.abs(P('fogo', 'lendario', 50) - 0.9625) < 1e-9, 'o P do Fogo cai com o nível');
  assert.strictEqual(P('fogo', 'comum', 'x'), 1, 'nível malformado vale 1');
  assert.strictEqual(S.typePower({ rarity: 'mitico', level: 50 }), 1, 'sem elemento: só a base');
  var ts = S.typeSkill({ element: 'agua', rarity: 'lendario', level: 50 });
  assert.strictEqual(ts.id, 'mare-alta'); assert.strictEqual(ts.name, 'Maré Alta'); assert.ok(Math.abs(ts.power - 1.1125) < 1e-9); assert.deepStrictEqual(ts.zone, [2 / 3, 1]);
});
// campo dos três tipos com skills de gatilho garantido (largada, Dado, 80%) e o modo "skills sempre ativam"
function campoTipos() {
  return TIPOS.map(function (e) { var h = mk({ sorte: 40 }); h.element = e; h.level = 20; h.rarity = 'raro'; h.skills = ['arranque', 'dado-viciado', 'arrancada-final']; return h; });
}
function raceTipos(seed, cond, hs, semTipo) {
  return S.simulate({ seed: seed, conditions: cond, recordFrames: true, dev: { skillsAlways: true }, racers: hs.map(function (h, i) {
    var r = { horse: h, statAdd: soma(h), name: 'r' + i }; if (semTipo) r.noTypeSkill = true; return r;
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
  // bloco 1b: a Maré Alta não recupera mais estamina ao entrar no último terço (multiplica Estamina e Garra)
  var mc = solo('agua', 3, RETA), fz = Math.round(mc.events.filter(function (e) { return e.typeSkill; })[0].t * 10);
  assert.ok(mc.frames[fz + 1].stamina[0] <= mc.frames[fz].stamina[0], 'sem recuperação na entrada');
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
test('raridade herdada do Object.prototype vale Comum (sem NaN em status, Poder e chance de skill)', function () {
  var base = cl(G.STARTERS[0]); base.rarity = 'comum';
  var ref = { stats: S.computeStats(base, null), pr: S.powerRating(base, null), sc: S.skillChance(base, S.computeStats(base, null)) };
  ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'].forEach(function (r) {
    var h = cl(base); h.rarity = r;
    var st = S.computeStats(h, null);
    G.STAT_KEYS.forEach(function (k) { assert.ok(isFinite(st[k]), r + ': ' + k + ' = ' + st[k]); });
    assert.deepStrictEqual(st, ref.stats, r + ': status');
    assert.strictEqual(S.powerRating(h, null), ref.pr, r + ': Poder');
    assert.strictEqual(S.skillChance(h, st), ref.sc, r + ': chance de skill');
    assert.ok(isFinite(S.allocInfo(h).room.vel), r + ': allocInfo');
    var ba = S.botAlloc(h);
    assert.ok(G.STAT_KEYS.every(function (k) { return isFinite(ba[k]); }), r + ': botAlloc');
    assert.doesNotThrow(function () { S.learnSkill({ element: 'fogo', rarity: r, skills: [] }, S.mulberry32(1)); }, r + ': learnSkill');
  });
});
test('tuningHash cobre a ordem das raridades (entra na força da skill de tipo)', function () {
  var h0 = S.tuningHash(), rr = G.RARITIES.raro, o = rr.order;
  rr.order = o + 1;
  try { assert.notStrictEqual(S.tuningHash(), h0, 'order'); } finally { rr.order = o; }
  assert.strictEqual(S.tuningHash(), h0);
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
  assert.deepStrictEqual(['comum','magico','raro','lendario','mitico'].map(function (r) { return G.RARITIES[r].baseLo; }), [40, 44, 49, 54, 60]);
  assert.deepStrictEqual(['comum','magico','raro','lendario','mitico'].map(function (r) { return G.RARITIES[r].ptsMult; }), [1, 1.05, 1.1, 1.15, 1.2]);
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
    assert.ok(c.element === 'fogo' || c.element === 'agua', 'tipo de um dos pais: ' + c.element);
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
      potential: [19, 18, 20, 13, 28, 25, 16], stats: [64, 63, 64, 61, 68, 67, 62], skills: ['sprint', 'arrancada-final'],   // bloco 1b: baseLo do Lendário 55 → 54
      palette: { coat: '#8e7d68', coatShade: '#65584b', mane: '#4a7c4c', accent: '#90c88c' }, breedLeft: 2 }
  ];
  casos.forEach(function (c, i) {
    var x = B.foal({ f: c.f, m: c.m, seedBase: 20261106, breedCounter: i, nextUid: 2 });
    // `marcas` usa sequência própria (spec 2a §2) e é conferida na seção "Marcas"; aqui só se confirma que existe e é válida
    assert.ok(B.marcasValidas(x.marcas), 'marcas do potro ' + i); delete x.marcas;
    // `porte` também tem fluxo próprio (spec 2b §3), conferido na seção "Portes"
    assert.ok(B.porteValido(x.porte), 'porte do potro ' + i); delete x.porte;
    assert.deepStrictEqual(x, {
      uid: 'm2', templateId: null, name: c.name, especie: 'cavalo', element: c.element, rarity: c.rarity, grau: c.grau, sex: c.sex,
      level: 1, xp: 0, skills: c.skills, potential: st(c.potential), palette: c.palette, breedLeft: c.breedLeft,
      parents: { f: { uid: null, name: c.f.name }, m: { uid: null, name: c.m.name } },
      born: i
    }, 'potro ' + i);
    assert.deepStrictEqual(S.computeStats(x, null), st(c.stats), 'status do potro ' + i + ' no nível 1');
  });
});

section('Marcas');
function marcasPai(o, m) { var p = mk2(o); p.marcas = m; return p; }
test('foal: mesma seed e pais ⇒ mesmas marcas; valores válidos', function () {
  var f = marcasPai({ sex: 'f' }, { cara: 'estrela', patas: 2, corpo: 'malhado' }), m = marcasPai({}, { cara: 'listra', patas: 4, corpo: 'ruao' });
  for (var s = 0; s < 200; s++) {
    var a = B.foal({ f: f, m: m, seedBase: 91, breedCounter: s, nextUid: 1 }), b = B.foal({ f: f, m: m, seedBase: 91, breedCounter: s, nextUid: 1 });
    assert.deepStrictEqual(a.marcas, b.marcas); assert.ok(B.marcasValidas(a.marcas), JSON.stringify(a.marcas));
  }
});
test('foal: campos antigos iguais ao potro de antes (sorteios antigos intactos)', function () {
  // o snapshot dourado acima compara o potro inteiro, exceto `marcas`; aqui, marcas diferentes nos pais não mudam nenhum outro campo
  var base = { f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 5, nextUid: 3 };
  for (var s = 0; s < 100; s++) {
    var sem = B.foal({ f: marcasPai({ sex: 'f' }, { cara: 'nenhuma', patas: 0, corpo: 'liso' }), m: marcasPai({}, { cara: 'frente', patas: 4, corpo: 'pintado' }), seedBase: 5, breedCounter: s, nextUid: 3 });
    var com = B.foal({ f: marcasPai({ sex: 'f' }, { cara: 'estrela', patas: 2, corpo: 'ruao' }), m: marcasPai({}, { cara: 'listra', patas: 1, corpo: 'malhado' }), seedBase: 5, breedCounter: s, nextUid: 3 });
    delete sem.marcas; delete com.marcas; assert.deepStrictEqual(sem, com);
  }
});
test('foal: 10.000 potros de pais com marcas diferentes ⇒ mutação por gene em [8,5%; 11,5%] e, sem mutação, égua em [47%; 53%]', function () {
  var f = marcasPai({ sex: 'f' }, { cara: 'nenhuma', patas: 0, corpo: 'liso' }), m = marcasPai({}, { cara: 'estrela', patas: 1, corpo: 'malhado' });
  var N = 10000, mut = { cara: 0, patas: 0, corpo: 0 }, deF = 0, semMut = 0, k;
  var fora = { cara: 2 / 4, patas: 3 / 5, corpo: 2 / 4 }; // fração dos valores que nenhum pai tem
  for (var s = 0; s < N; s++) {
    var c = B.foal({ f: f, m: m, seedBase: 77, breedCounter: s, nextUid: 1 }).marcas;
    ['cara', 'patas', 'corpo'].forEach(function (g) {
      if (c[g] !== f.marcas[g] && c[g] !== m.marcas[g]) mut[g]++;
    });
  }
  // fração observada de "valor de fora" = mutação × fração fora; mutação = observada / fora
  ['cara', 'patas', 'corpo'].forEach(function (g) {
    var taxa = mut[g] / N / fora[g]; assert.ok(taxa >= 0.085 && taxa <= 0.115, g + ' mutação ' + taxa);
  });
  // sem mutação: genes distintos nos pais; conta os que bateram com a égua entre os que bateram com algum pai
  // (mutação que cai por acaso num valor dos pais é rara e entra igual nos dois lados)
  for (s = 0; s < N; s++) {
    var d = B.foal({ f: f, m: m, seedBase: 78, breedCounter: s, nextUid: 1 }).marcas;
    ['cara', 'patas', 'corpo'].forEach(function (g) {
      if (d[g] === f.marcas[g]) { deF++; semMut++; } else if (d[g] === m.marcas[g]) semMut++;
    });
  }
  var pF = deF / semMut; assert.ok(pF >= 0.47 && pF <= 0.53, 'égua ' + pF);
});
test('foal: pai sem marcas usa as do modelo ou marcasDoId(uid)', function () {
  var modelo = G.WILD_HORSES.filter(function (x) { return x.id === 'w-ventania'; })[0];
  var comModelo = mk2({ uid: 'm9', sex: 'f' }); comModelo.templateId = 'w-ventania';
  var semNada = mk2({ uid: 'm7' });
  var ref = marcasPai({ sex: 'f' }, modelo.marcas), ref2 = marcasPai({ uid: 'm7' }, B.marcasDoId('m7'));
  for (var s = 0; s < 100; s++) {
    var a = B.foal({ f: comModelo, m: semNada, seedBase: 3, breedCounter: s, nextUid: 1 }), b = B.foal({ f: ref, m: ref2, seedBase: 3, breedCounter: s, nextUid: 1 });
    assert.deepStrictEqual(a.marcas, b.marcas);
  }
  var inval = mk2({ uid: 'm7', marcas: { cara: 'xx', patas: 9, corpo: 'liso' } });
  assert.deepStrictEqual(B.foal({ f: semNada, m: inval, seedBase: 3, breedCounter: 1, nextUid: 1 }).marcas, B.foal({ f: semNada, m: semNada, seedBase: 3, breedCounter: 1, nextUid: 1 }).marcas);
});
test('marcasDoId: determinístico, válido e cobre todos os valores em 1.000 chaves', function () {
  var vistos = {};
  for (var i = 0; i < 1000; i++) {
    var a = B.marcasDoId('m' + i); assert.deepStrictEqual(a, B.marcasDoId('m' + i)); assert.ok(B.marcasValidas(a));
    vistos['c' + a.cara] = vistos['p' + a.patas] = vistos['o' + a.corpo] = 1; vistos['p' + a.patas] = 1; vistos['c' + a.cara] = 1;
  }
  G.MARCAS.cara.forEach(function (v) { assert.ok(vistos['c' + v], v); });
  G.MARCAS.patas.forEach(function (v) { assert.ok(vistos['p' + v], 'patas ' + v); });
  G.MARCAS.corpo.forEach(function (v) { assert.ok(vistos['o' + v], v); });
  assert.ok(!B.marcasValidas({ cara: 'nenhuma', patas: '2', corpo: 'liso' }) && !B.marcasValidas(null) && !B.marcasValidas({}));
});
test('hashChave("") e hashChave("m1") conhecidos (FNV-1a 32 bits)', function () {
  assert.strictEqual(B.hashChave(''), 0x811c9dc5);
  assert.strictEqual(B.hashChave('a'), 0xe40c292c); // vetor de teste FNV-1a 32 bits
  assert.strictEqual(B.hashChave('m1'), 0x942e6feb);
});
test('MARCAS e JOQUEI no catálogo', function () {
  assert.deepStrictEqual(G.MARCAS, { cara: ['nenhuma', 'estrela', 'listra', 'frente'], patas: [0, 1, 2, 3, 4], corpo: ['liso', 'malhado', 'pintado', 'ruao'], mutacao: 0.10, branco: '#f1e9d4' });
  assert.strictEqual(G.JOQUEI.padroes.length, 6); assert.strictEqual(G.JOQUEI.capacetes.length, 8);
  assert.strictEqual(G.JOQUEI.padrao, 'liso'); assert.strictEqual(G.JOQUEI.capacete, '#f2c230');
});
test('iniciais e selvagens com as marcas da tabela da spec §2', function () {
  var T = { brasa: 'estrela/1/liso', mare: 'listra/0/ruao', ipe: 'frente/2/liso', 'w-faisca': 'estrela/2/pintado', 'w-lambari': 'nenhuma/0/malhado',
    'w-capim': 'listra/4/liso', 'w-ticao': 'frente/1/liso', 'w-garoa': 'estrela/0/ruao', 'w-mandacaru': 'nenhuma/3/pintado', 'w-ventania': 'listra/2/malhado',
    'w-pororoca': 'estrela/4/liso', 'w-fogareu': 'frente/0/pintado', 'w-jequitiba': 'listra/1/ruao', 'w-boitata': 'estrela/2/malhado', 'w-iara': 'nenhuma/4/ruao' };
  var todos = G.STARTERS.concat(G.WILD_HORSES); assert.strictEqual(todos.length, 15);
  todos.forEach(function (h) {
    assert.strictEqual(typeof h.marcas.patas, 'number', h.id);
    assert.strictEqual(h.marcas.cara + '/' + h.marcas.patas + '/' + h.marcas.corpo, T[h.id], h.id); assert.ok(B.marcasValidas(h.marcas));
  });
});

section('Portes');
// Impressão dos 200 potros de antes do porte (HEAD da parte 2a): com o campo `porte` apagado, os sorteios antigos têm de dar o mesmo número.
var IMPRESSAO_FOAL_2A = 1583205096;
test('portes: catálogo', function () {
  var T = { brasa: 'padrao', mare: 'padrao', ipe: 'padrao', 'w-faisca': 'esguio', 'w-ticao': 'robusto', 'w-fogareu': 'robusto', 'w-boitata': 'esguio',
    'w-lambari': 'esguio', 'w-garoa': 'padrao', 'w-pororoca': 'robusto', 'w-iara': 'esguio', 'w-capim': 'esguio', 'w-mandacaru': 'robusto',
    'w-ventania': 'esguio', 'w-jequitiba': 'robusto' };
  assert.deepStrictEqual(G.PORTES, { valores: ['esguio', 'padrao', 'robusto'], nomes: { esguio: 'Esguio', padrao: 'Padrão', robusto: 'Robusto' }, mutacao: 0.10, padrao: 'padrao' });
  var todos = G.STARTERS.concat(G.WILD_HORSES); assert.strictEqual(todos.length, 15);
  todos.forEach(function (h) { assert.strictEqual(h.porte, T[h.id], h.id); assert.ok(B.porteValido(h.porte)); });
});
test('portes: sorteios antigos intactos', function () {
  var cat = G.STARTERS.concat(G.WILD_HORSES), lista = [];
  for (var i = 1; i <= 200; i++) {
    var f = JSON.parse(JSON.stringify(cat[i % cat.length])), m = JSON.parse(JSON.stringify(cat[(i * 7 + 3) % cat.length]));
    f.sex = 'f'; m.sex = 'm'; f.level = 30; m.level = 30; f.uid = 'f' + i; m.uid = null;
    var x = B.foal({ f: f, m: m, seedBase: i, breedCounter: i % 7, nextUid: i });
    assert.ok(B.porteValido(x.porte)); delete x.porte; lista.push(x);
  }
  assert.strictEqual(B.hashChave(JSON.stringify(lista)), IMPRESSAO_FOAL_2A);
});
test('portes: herança (4.000 potros de égua esguia × garanhão robusto)', function () {
  var f = mk2({ sex: 'f' }), m = mk2({}); f.porte = 'esguio'; m.porte = 'robusto';
  var N = 4000, mut = 0, semMut = 0, deF = 0;
  for (var s = 0; s < N; s++) {
    var c = B.foal({ f: f, m: m, seedBase: 91, breedCounter: s, nextUid: 1 }).porte;
    var r = S.mulberry32(S.hash2(91 >>> 0, 0x504F0000 + s)), houve = r() < G.PORTES.mutacao;
    if (houve) { mut++; assert.ok(B.porteValido(c)); continue; }
    semMut++;
    assert.ok(c === 'esguio' || c === 'robusto', 'sem mutação só sai de um dos pais: ' + c);
    if (c === 'esguio') deF++;
  }
  var pm = mut / N; assert.ok(pm >= 0.085 && pm <= 0.115, 'mutação ' + pm);
  var pF = deF / semMut; assert.ok(pF >= 0.47 && pF <= 0.53, 'égua ' + pF);
});
test('portes: porteDoId', function () {
  var cont = { esguio: 0, padrao: 0, robusto: 0 };
  for (var i = 0; i < 1000; i++) {
    var a = B.porteDoId('k' + i); assert.strictEqual(a, B.porteDoId('k' + i)); assert.ok(B.porteValido(a)); cont[a]++;
  }
  G.PORTES.valores.forEach(function (v) { assert.ok(cont[v] >= 280 && cont[v] <= 390, v + ' ' + cont[v]); });
});
test('portes: escada (RF1, RF4)', function () {
  G.PORTES.valores.forEach(function (v) { assert.strictEqual(B.porteDe(v, 'w-ticao', 'k'), v); });
  [2, 'Robusto', null, {}, '__proto__', undefined].forEach(function (lixo) {
    assert.strictEqual(B.porteDe(lixo, 'w-ticao', 'k'), 'robusto', String(lixo));
    assert.strictEqual(B.porteDe(lixo, null, 'k7'), B.porteDoId('k7'), String(lixo));
    assert.strictEqual(B.porteDe(lixo, 'inexistente', 'k7'), B.porteDoId('k7'), String(lixo));
  });
  assert.ok(!B.porteValido('Robusto') && !B.porteValido(null) && !B.porteValido('__proto__') && B.porteValido('padrao'));
  // pai sem campo `porte` herda pela escada
  var modelo = mk2({ sex: 'f' }); modelo.templateId = 'w-ticao';
  var semNada = mk2({ uid: 'm7' }), ref = mk2({ sex: 'f' }); ref.porte = 'robusto';
  var ref2 = mk2({ uid: 'm7' }); ref2.porte = B.porteDoId('m7');
  for (var s = 0; s < 100; s++) {
    assert.strictEqual(B.foal({ f: modelo, m: semNada, seedBase: 3, breedCounter: s, nextUid: 1 }).porte, B.foal({ f: ref, m: ref2, seedBase: 3, breedCounter: s, nextUid: 1 }).porte);
  }
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

section('equipamento: simulação (suspenso no bloco 1b)');
function cl(h) { return JSON.parse(JSON.stringify(h)); }
test('computeStats ignora o equipamento (gear, string de save antigo ou mods enormes)', function () {
  var h = cl(G.STARTERS[0]);
  var base = S.computeStats(h);
  var g = GR.resolve({ equip: { sela: 'i1' } }, { i1: { uid: 'i1', id: 'sela-sol-raro', plus: 10 } });
  assert.strictEqual(g.mods.est, 8, 'a peça ainda resolve (Raro 3 + 10 × 0,5)');
  assert.deepStrictEqual(S.computeStats(h, g), base);
  assert.deepStrictEqual(S.computeStats(h, 'sela-couro'), base);
  var big = { mods: { vel: 200, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 }, special: {}, set: { id: null, count: 0 }, pieces: [] };
  assert.deepStrictEqual(S.computeStats(h, big), base);
});
test('skillChance com bônus respeita o teto 0,95', function () {
  var h = cl(G.STARTERS[0]); var st = S.computeStats(h);
  assert.ok(Math.abs(S.skillChance(h, st, 0.05) - (S.skillChance(h, st) + 0.05)) < 1e-9);
  h.rarity = 'mitico'; h.level = 50; st.sorte = 100;
  assert.strictEqual(S.skillChance(h, st, 0.5), 0.95);
});
test('powerRating ignora mods e pontos de conjunto (trava do páreo: peça nunca sobe o Poder)', function () {
  var SL = ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'];
  function gearIds(ids, plus) { var items = {}, equip = {}; ids.forEach(function (id, i) { if (id) { items['i' + i] = { uid: 'i' + i, id: id, plus: plus }; equip[SL[i]] = 'i' + i; } }); return GR.resolve({ equip: equip }, items); }
  var gears = [
    gearIds(SL.map(function (sl) { return sl + '-comum'; }), 0),              // 5 Comuns soltas
    gearIds(SL.map(function (sl) { return sl + '-sol-raro'; }), 10),          // conjunto Raro completo +10
    gearIds([null, 'sela-comum', null, null, null], 3)                         // uma peça só
  ];
  assert.strictEqual(gears[1].set.count, 5);
  var horses = [cl(G.STARTERS[0]), cl(G.STARTERS[1]), cl(G.STARTERS[2])];
  horses[2].level = 50; horses[2].alloc = S.botAlloc(horses[2]);
  horses.forEach(function (h) {
    gears.forEach(function (g, gi) { assert.strictEqual(S.powerRating(h, g), S.powerRating(h), h.id + ' gear ' + gi); });
  });
});
test('a corrida ignora o equipamento: com e sem peças (inclusive 5 Chuva na chuva e 4 Sol no Sol), o mesmo resultado', function () {
  var brasa = cl(G.STARTERS.filter(function (x) { return x.id === 'brasa'; })[0]);
  function gearOf(set, n) { var items = {}, equip = {}; ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'].slice(0, n).forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-' + set + '-raro', plus: 0 }; equip[sl] = 'i' + i; }); return GR.resolve({ equip: equip }, items); }
  [[gearOf('chuva', 5), 'chuva'], [gearOf('sol', 4), 'sol'], [GR.botGear(5, 'fogo', 0.5), null]].forEach(function (c, ci) {
    for (var k = 0; k < 10; k++) {
      var seed = S.hash2(777, k), cond = S.randomConditions(seed); if (c[1]) cond.weather = c[1];
      var com = S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: [{ horse: brasa, gear: c[0], name: 'a' }, { horse: brasa, gear: null, name: 'b' }] });
      var sem = S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: [{ horse: brasa, gear: null, name: 'a' }, { horse: brasa, gear: null, name: 'b' }] });
      assert.strictEqual(JSON.stringify(com), JSON.stringify(sem), 'caso ' + ci + ' seed ' + k);
    }
  });
});

section('dev');
// Referência regravada no bloco 1b (crescimento livre: física até 150, skill de tipo com statMul, Dado
// (Sorte − 40)/40; seeds 1001…1020; os 3 iniciais + 5 aluguéis do Haras, com o equipamento de bot de cada liga,
// que a corrida agora ignora). Mudou a simulação de propósito? Regrave a tabela.
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
var REF_HASHES = ['9dd501e55d7bc83a45e9683a45ec82a01738ffee', 'fb80220d718a9ed103f3f85b608007a8b9c2a04e', '32838948c70521bc4bb26da7421108f0f3ce2d9d',
  '644487e444fbd536f1d6eea979aaf5e29ce3ee8e', 'dbd97fa663398bef8e786b5924ebb8492cc7bf8e', 'f7bfb3bd9edfc882a304c487f9f6644571b9fd8e',
  '6295742d06dacf97ccafce329a32f6e393f812a8', 'a8ec95046dc46c5e6f958cf87a23f7991981f710', '02aa2a7427726c28597f9a3cbc7f6c9aede2513d',
  'bb36d56153deacc66c9c57c0b43358f7fa5b19e7', '4b97fd406ec7c55951dce895ae5d7baeab9fadfb', 'fc4aa36ee9c32202af0916e146513008b40cc851',
  'b33f5fe923fe63336cba9a20281833ae6e965b12', '7729f5b9818551b01f5dd278fa913462fceac52a', '76e9075ff88d32eb485eb008b858c15146d4571e',
  '809912b968637bf10dd06ddeec2b79caf0039fea', 'bea973f423a74fce738be0b9d530cd99e6e9ad36', 'b5365ac0103ff278a1dd03d07bca86e1234cfa39',
  '1541246f097b5911734d884cbdc4aa11f44d9866', 'f2a44ad7be971f2ec22fef70ac5455528297e392'];
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
  var cfg = { seed: seed, conditions: GATILHOS, recordFrames: true, racers: horses.map(function (h, i) { return { horse: h, statAdd: soma(h), name: 'r' + i, isPlayer: i === 0 }; }) };
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
test('Dev.horseTemplate v3: sem base, genética por status, estrelas e alloc', function () {
  var t = DV().horseTemplate({ rarity: 'raro', potential: { vel: 31, acel: 0, man: 7, forca: 40, est: -2, garra: 'x', sorte: 15 }, grau: 3, alloc: { vel: 5, acel: -1, man: 2.7, forca: 'abc', est: 999 } }, 2);
  assert.ok(!('base' in t), 'sem base');
  assert.deepStrictEqual(t.potential, { vel: 31, acel: 0, man: 7, forca: 31, est: 0, garra: 0, sorte: 15 });
  assert.strictEqual(t.grau, 3);
  assert.deepStrictEqual(t.alloc, { vel: 5, acel: 0, man: 2, forca: 0, est: 999, garra: 0, sorte: 0 }, 'inteiros ≥ 0 (o limite fica para RaceSim.validAlloc)');
  [0, 4, 'x', null, 2.4].forEach(function (g) { var e = DV().horseTemplate({ grau: g }).grau; assert.ok(e >= 1 && e <= 3 && e === Math.floor(e), String(g) + ' -> ' + e); });
  assert.strictEqual(DV().horseTemplate({ grau: 1 }).grau, 1); assert.strictEqual(DV().horseTemplate({}).grau, 2);
  G.STAT_KEYS.forEach(function (k) { assert.strictEqual(DV().horseTemplate({}).alloc[k], 0); });
});
test('Dev.horseTemplate: marcas da gaveta (patas também em texto, como no select); inválidas viram nenhuma/0/liso', function () {
  assert.deepStrictEqual(DV().horseTemplate({ marcas: { cara: 'listra', patas: 3, corpo: 'malhado' } }).marcas, { cara: 'listra', patas: 3, corpo: 'malhado' });
  assert.deepStrictEqual(DV().horseTemplate({ marcas: { cara: 'frente', patas: '4', corpo: 'ruao' } }).marcas, { cara: 'frente', patas: 4, corpo: 'ruao' });
  [undefined, null, 'x', {}, { cara: 'x', patas: 7, corpo: 2 }, { cara: 'estrela', patas: '2.5', corpo: 'liso' }, { patas: ' 1' }, { patas: true }].forEach(function (mc) {
    var t = DV().horseTemplate({ marcas: mc });
    assert.ok(B.marcasValidas(t.marcas), JSON.stringify(mc) + ' -> ' + JSON.stringify(t.marcas));
    if (!mc || typeof mc !== 'object' || mc.cara !== 'estrela') assert.strictEqual(t.marcas.cara, 'nenhuma', JSON.stringify(mc));
    assert.strictEqual(t.marcas.patas, 0, JSON.stringify(mc));
  });
  // cada gene vale por si: um gene inválido não apaga os outros
  assert.deepStrictEqual(DV().horseTemplate({ marcas: { cara: 'estrela', patas: 9, corpo: 'pintado' } }).marcas, { cara: 'estrela', patas: 0, corpo: 'pintado' });
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
  var te = G.TYPE_SKILLS.fogo.effect, ta = te.statMul; te.statMul = ta + 0.01;
  try { assert.notStrictEqual(S.tuningHash(), a.tuningHash, 'skills de tipo'); } finally { te.statMul = ta; }
  var rp = G.RARITIES.raro, pm = rp.ptsMult; rp.ptsMult = pm + 0.01;
  try { assert.notStrictEqual(S.tuningHash(), a.tuningHash, 'fator de pontos da raridade'); } finally { rp.ptsMult = pm; }
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
test('potro nunca nasce com elemento fora de GameData.ELEMENTS (pais com neutro ou lixo)', function () {
  var vistos = {};
  for (var s = 0; s < 600; s++) {
    var casos = [['neutro', 'fogo'], ['agua', 'neutro'], ['neutro', 'neutro'], ['lava', undefined], ['grama', 'xyz']];
    casos.forEach(function (par) {
      var f = mk2({ sex: 'f', element: par[0], skills: [] }), m = mk2({ element: par[1], skills: [] });
      var c = B.foal({ f: f, m: m, seedBase: s, breedCounter: 0, nextUid: 1 });
      assert.ok(Object.prototype.hasOwnProperty.call(G.ELEMENTS, c.element), par.join('+') + ' deu ' + c.element);
      var validos = par.filter(function (e) { return Object.prototype.hasOwnProperty.call(G.ELEMENTS, e); });
      if (validos.length) assert.strictEqual(c.element, validos[0], 'herda o do pai válido');
      else vistos[c.element] = 1;
    });
  }
  assert.deepStrictEqual(Object.keys(vistos).sort(), ['agua', 'fogo', 'grama'], 'dois inválidos: os três tipos saem pela seed');
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
