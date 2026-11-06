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

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
