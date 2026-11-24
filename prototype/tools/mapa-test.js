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

section('trilha');
test('a curva da pista passa por todas as paradas (a menos de 1 px), em ordem de arco', function () {
  var ant = -1;
  MP.PARADAS.forEach(function (pp, i) {
    var a = MP.arcoParada(i), q = MP.pontoTrilha(a);
    assert.ok(Math.hypot(q[0] - pp[0], q[1] - pp[1]) < 1, 'parada ' + i + ': ' + q);
    assert.ok(a > ant, 'arco crescente'); ant = a;
  });
});
test('a máscara do caminho cobre a curva inteira e só ela (largura de ~9 px)', function () {
  var m = MP.mascaraCaminho(), c = MP.curvaTrilha(), n = 0;
  for (var i = 0; i < c.length; i += 8) { var x = Math.floor(c[i][0]), y = Math.floor(c[i][1]); if (x >= 0 && y >= 0 && x < MP.W && y < MP.H) assert.strictEqual(m[y * MP.W + x], 1, 'ponto ' + i); }
  for (i = 0; i < m.length; i++) n += m[i];
  assert.ok(n > c.comp * 7 && n < c.comp * 10, n + ' pixels para ' + c.comp.toFixed(0) + ' de arco');
  assert.strictEqual(m[0], 0); assert.strictEqual(m[MP.W - 1], 0);
});
test('o cavalo fica ao lado de cada parada, fora da pedra, virado para o oponente', function () {
  MP.PARADAS.forEach(function (pp, i) {
    var q = MP.posCavaloTrilha(i);
    var d = Math.abs(q[0] - pp[0]);
    assert.ok(d > 20 && d < 45 && Math.abs(q[1] - pp[1]) < 12, 'parada ' + i + ': cavalo em ' + q);
    assert.strictEqual(q[2], q[0] > pp[0], 'parada ' + i + ': olha para o oponente');
  });
});

section('viagem');
test('entrar: zoom 1→2→3, íris fechando, troca para a trilha em 0,58 s e íris abrindo até 0,98 s', function () {
  assert.deepStrictEqual([0, 0.13, 0.3].map(function (u) { return MP.passoViagem('entra', u).z; }), [1, 2, 3]);
  assert.strictEqual(MP.passoViagem('entra', 0.1).r, null, 'sem íris no começo');
  var a = MP.passoViagem('entra', 0.3).r, b = MP.passoViagem('entra', 0.45).r; assert.ok(a > b && b > 0, 'a íris fecha');
  assert.strictEqual(MP.passoViagem('entra', 0.55).r, 0); assert.strictEqual(MP.passoViagem('entra', 0.55).lado, 'mundo');
  assert.strictEqual(MP.passoViagem('entra', MP.VIAGEM.entra.troca).lado, 'trilha');
  assert.ok(MP.passoViagem('entra', 0.8).r > MP.passoViagem('entra', 0.6).r, 'a íris abre');
  assert.strictEqual(MP.passoViagem('entra', 0.97).fim, false); assert.strictEqual(MP.passoViagem('entra', MP.VIAGEM.entra.fim).fim, true);
});
test('sair: íris fechando na trilha, troca em 0,38 s, zoom 3→2→1 no mapa e fim em 0,9 s', function () {
  assert.strictEqual(MP.passoViagem('sai', 0.1).lado, 'trilha'); assert.ok(MP.passoViagem('sai', 0.1).r > MP.passoViagem('sai', 0.25).r);
  assert.strictEqual(MP.passoViagem('sai', MP.VIAGEM.sai.troca).lado, 'mundo');
  assert.deepStrictEqual([0.5, 0.8, 0.86].map(function (u) { return MP.passoViagem('sai', u).z; }), [3, 2, 1]);
  assert.strictEqual(MP.passoViagem('sai', 0.89).fim, false); assert.strictEqual(MP.passoViagem('sai', 0.9).fim, true);
  assert.strictEqual(MP.passoViagem('sai', -1).lado, 'trilha', 'tempo negativo fica no começo');
});

section('cena de desafio');
test('as três arenas: oponente, treinador e o nosso dentro do quadro de 256 × 160 (o nosso cortado pela borda de baixo)', function () {
  MP.ORDEM.forEach(function (el) {
    var A = MP.ARENAS[el];
    assert.ok(A && (A.chao === 'img' || A.chao === 'codigo'), el);
    [A.op, A.lider].forEach(function (p) { assert.ok(p[0] > 40 && p[0] < 230 && p[1] > A.hz && p[1] < 160, el + ': ' + p); });
    assert.ok(A.op[1] > A.lider[1] - 6 && A.lider[0] > A.op[0], el + ': o treinador ao lado do cavalo dele, à direita');
    assert.ok(A.nos[1] > 160 && A.nos[0] < 128, el + ': o nosso na frente, à esquerda, cortado embaixo');
  });
  assert.strictEqual(MP.ARENAS.fogo.chao, 'codigo', 'a Fornalha com o piso por código (a amostra aprovada)');
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
