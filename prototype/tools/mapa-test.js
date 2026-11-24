// prototype/tools/mapa-test.js — node prototype/tools/mapa-test.js
// Testes das partes puras de prototype/src/mapa.js (o desenho do mapa dos ginásios): névoa e marcadores pelo progresso,
// o ginásio sob um toque, a RNG cosmética e a garantia de que o módulo não sorteia com Math.random. O desenho fica
// para o ui-test (precisa de canvas).
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var MP = require('../src/mapa.js');
var fails = 0, count = 0;
function section(t) { console.log('\n## ' + t); }
function test(name, fn) {
  count++;
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { fails++; console.log('  FALHA ' + name + '\n       ' + (e.message || e)); }
}
function prog(f, a, g) { return { fogo: f, agua: a, grama: g }; }
var ZERO = { vencidas: 0, insignia: false, revanche: null };

section('névoa');
test('sem vitórias: névoa cheia nos três', function () {
  var n = MP.nevoaDe(prog(ZERO, ZERO, ZERO));
  MP.ORDEM.forEach(function (el) { assert.strictEqual(n[el], 0.78); });
});
test('mais etapas vencidas, névoa mais rala; com a insígnia, nenhuma', function () {
  var ant = 1;
  for (var v = 0; v <= 4; v++) { var d = MP.nevoaDe(prog({ vencidas: v }, ZERO, ZERO)).fogo; assert.ok(d < ant, v + ': ' + d); ant = d; }
  assert.strictEqual(MP.nevoaDe(prog({ vencidas: 5, insignia: true }, ZERO, ZERO)).fogo, 0);
  assert.strictEqual(MP.nevoaDe(prog({ vencidas: 5 }, ZERO, ZERO)).fogo, 0, '5 vencidas = insígnia');
});
test('progresso faltando ou estranho não quebra (névoa cheia; vencidas presas em 0..5)', function () {
  assert.strictEqual(MP.nevoaDe(null).agua, 0.78);
  assert.strictEqual(MP.nevoaDe(prog({ vencidas: -3 }, { vencidas: 99 }, undefined)).fogo, 0.78);
  assert.strictEqual(MP.nevoaDe(prog({ vencidas: -3 }, { vencidas: 99 }, undefined)).agua, 0);
});

section('marcadores');
test('o "!" só com a insígnia e a revanche livre hoje', function () {
  var m = MP.marcadores(prog({ vencidas: 5, insignia: true, revanche: 'livre' }, { vencidas: 5, insignia: true, revanche: 'feita' }, { vencidas: 3, revanche: 'livre' }));
  assert.strictEqual(m.fogo.revanche, true); assert.strictEqual(m.fogo.conquistado, true);
  assert.strictEqual(m.agua.revanche, false); assert.strictEqual(m.agua.revancheFeita, true);
  assert.strictEqual(m.grama.revanche, false, 'sem insígnia não há revanche'); assert.strictEqual(m.grama.conquistado, false);
  assert.strictEqual(m.grama.vencidas, 3);
});

section('toque');
test('ginasioEm acerta os três ginásios e erra fora deles', function () {
  MP.ORDEM.forEach(function (el) { var p = MP.POS[el]; assert.strictEqual(MP.ginasioEm(p[0], p[1]), el); assert.strictEqual(MP.ginasioEm(p[0], p[1] - 40), el, el + ' estandarte'); });
  assert.strictEqual(MP.ginasioEm(10, 10), null);
  assert.strictEqual(MP.ginasioEm(250, 370), null);
});
test('as áreas de toque dos ginásios não se sobrepõem', function () {
  for (var y = 0; y < MP.H; y++) for (var x = 0; x < MP.W; x++) {
    var n = 0; MP.ORDEM.forEach(function (el) { var p = MP.POS[el]; if (x >= p[0] - 30 && x <= p[0] + 30 && y >= p[1] - 52 && y <= p[1] + 40) n++; });
    assert.ok(n <= 1, 'sobreposição em ' + x + ',' + y);
  }
});

section('cosmético');
test('a RNG cosmética repete com a mesma semente e varia com outra', function () {
  var a = MP.rng(7), b = MP.rng(7), c = MP.rng(8);
  var sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
  assert.deepStrictEqual(sa, sb); assert.notDeepStrictEqual(sa, sc);
  sa.forEach(function (v) { assert.ok(v >= 0 && v < 1); });
});
test('mapa.js não usa Math.random, Date nem o save', function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'src', 'mapa.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  ['Math.random', 'Date.now', 'new Date', 'localStorage'].forEach(function (s) { assert.ok(src.indexOf(s) < 0, s); });
});
test('as cores fixas do módulo são da Resurrect 64', function () {
  var src = fs.readFileSync(path.join(__dirname, '..', 'src', 'mapa.js'), 'utf8'), R = new Set(MP.R64), m, re = /'#([0-9a-f]{6})'/g;
  while ((m = re.exec(src))) assert.ok(R.has(m[1]), '#' + m[1]);
  Object.keys(MP.COR_EL).forEach(function (el) { MP.COR_EL[el].forEach(function (h) { assert.ok(R.has(h), h); }); });
});

console.log('\n' + (count - fails) + ' de ' + count + ' testes passaram' + (fails ? ' — ' + fails + ' FALHARAM' : ''));
process.exit(fails ? 1 : 0);
