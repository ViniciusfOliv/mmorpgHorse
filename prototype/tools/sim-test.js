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

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
