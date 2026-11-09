// prototype/tools/fx-test.js — node prototype/tools/fx-test.js
// Testes das funções puras de prototype/src/fx.js (RaceFx): linha do tempo de efeitos, câmera lenta,
// estado do Dado e arranjo das plaquinhas. O desenho fica para o ui-test (precisa de canvas).
'use strict';
var assert = require('assert');
var G = require('../src/data.js');
var S = require('../src/sim.js');
var FX = require('../src/fx.js');
var fails = 0, count = 0;
function section(t) { console.log('\n## ' + t); }
function test(name, fn) {
  count++;
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { fails++; console.log('  FALHA ' + name + '\n       ' + (e.message || e)); }
}
function cl(o) { return JSON.parse(JSON.stringify(o)); }
var CORES = ['#d8353b', '#2f6fd8', '#f2c230', '#8a4ad8', '#30b060', '#f07a2a', '#e85aa8', '#2ab8b0'];

// corrida real de uma seed fixa: os 3 iniciais + 5 selvagens (8 raias), com frames, como a tela usa
function corrida(seed) {
  var hs = G.STARTERS.concat(G.WILD_HORSES.slice(0, 5));
  var racers = hs.map(function (h, i) { return { horse: cl(h), gear: null, name: 'r' + i, isPlayer: i === 0, silks: CORES[i] }; });
  var sim = S.simulate({ seed: seed, recordFrames: true, racers: racers });
  return { sim: sim, racers: racers };
}
var C1 = corrida(4242);
var DADOS1 = C1.sim.events.filter(function (e) { return e.type === 'dado'; });

section('linha do tempo');
test('timeline tem um \'dado\' por evento com o vencedor do evento', function () {
  assert.ok(DADOS1.length >= 1, 'a corrida de teste tem Dado');
  var tl = FX.timeline(C1.sim, C1.racers);
  var dados = tl.filter(function (it) { return it.kind === 'dado'; });
  assert.strictEqual(dados.length, DADOS1.length);
  dados.forEach(function (it, k) {
    var ev = DADOS1[k];
    assert.strictEqual(it.t0, ev.t); assert.strictEqual(it.t1, ev.t + 3);
    assert.strictEqual(it.racer, ev.winner); assert.strictEqual(it.winner, ev.winner);
    assert.deepStrictEqual(it.rolls, ev.rolls);
    assert.strictEqual(it.changed, ev.changed); assert.strictEqual(it.weather, ev.weather);
  });
});
test('timeline ordenada por t0 e sem mexer na simulação', function () {
  var antes = JSON.stringify(C1.sim.events);
  var tl = FX.timeline(C1.sim, C1.racers);
  for (var k = 1; k < tl.length; k++) assert.ok(tl[k].t0 >= tl[k - 1].t0, 'ordem em ' + k);
  assert.strictEqual(JSON.stringify(C1.sim.events), antes, 'eventos intactos');
  assert.ok(tl.length && tl[0].rolls !== C1.sim.events.filter(function (e) { return e.type === 'dado'; })[0].rolls, 'cópia das rolagens');
});
test('a mesma seed dá a mesma linha do tempo', function () {
  var C2 = corrida(4242);
  assert.strictEqual(JSON.stringify(FX.timeline(C2.sim, C2.racers)), JSON.stringify(FX.timeline(C1.sim, C1.racers)));
});
test('escala de apresentação multiplica as janelas do Dado (padrão 1)', function () {
  var tl = FX.timeline(C1.sim, C1.racers, 4);
  var it = tl.filter(function (x) { return x.kind === 'dado'; })[0];
  assert.strictEqual(it.escala, 4); assert.strictEqual(it.t1, it.t0 + 12);
  assert.strictEqual(FX.slowFactor(tl, it.t0 + 3.2, false), 0.4);
  assert.strictEqual(FX.slowFactor(tl, it.t0 + 3.21, false), 1);
  var semEmpate = it.rolls.map(function (r, i) { return r.rerolls ? -1 : i; }).filter(function (i) { return i >= 0; })[0];
  assert.strictEqual(FX.diceState(it, it.t0 + 1.59, false, semEmpate).fase, 'gira');
  assert.strictEqual(FX.diceState(it, it.t0 + 1.6, false, semEmpate).fase, 'mostra');
  assert.strictEqual(FX.diceState(it, it.t0 + 11.99, false, semEmpate).fase, 'mostra');
  assert.strictEqual(FX.diceState(it, it.t0 + 12, false, semEmpate).fase, 'fim');
});

section('câmera lenta');
var ITEM = { kind: 'dado', t0: 30, t1: 33, racer: 1, winner: 1, changed: false, weather: 'sol',
  rolls: [{ racer: 0, dice: [55], best: 55, rerolls: 0 }, { racer: 1, dice: [91, 40], best: 91, rerolls: 1 }, { racer: 2, dice: [12], best: 12, rerolls: 0 }] };
test('slowFactor é 0.4 só na janela e 1 fora', function () {
  var tl = [ITEM];
  [[29.99, 1], [30, 0.4], [30.4, 0.4], [30.8, 0.4], [30.81, 1], [32, 1], [33, 1], [0, 1]].forEach(function (c) {
    assert.strictEqual(FX.slowFactor(tl, c[0], false), c[1], 't=' + c[0]);
  });
  assert.strictEqual(FX.slowFactor([], 30.2, false), 1);
  assert.strictEqual(FX.slowFactor(null, 30.2, false), 1);
});
test('slowFactor com movimento reduzido: só [t0, t0 + 0.4]', function () {
  var tl = [ITEM];
  [[29.99, 1], [30, 0.4], [30.2, 0.4], [30.4, 0.4], [30.41, 1], [30.8, 1]].forEach(function (c) {
    assert.strictEqual(FX.slowFactor(tl, c[0], true), c[1], 't=' + c[0]);
  });
});
test('slowFactor ignora itens que não são Dado', function () {
  assert.strictEqual(FX.slowFactor([{ kind: 'skill', t0: 30, t1: 35, racer: 0 }], 30.2, false), 1);
});

section('estado do Dado');
test('diceState percorre gira→mostra e regira só com rerolls', function () {
  var semEmpate = function (t) { return FX.diceState(ITEM, t, false, 0).fase; };
  var comEmpate = function (t) { return FX.diceState(ITEM, t, false, 1).fase; };
  assert.strictEqual(semEmpate(29.9), 'fim');
  assert.strictEqual(semEmpate(30), 'gira'); assert.strictEqual(semEmpate(30.39), 'gira');
  assert.strictEqual(semEmpate(30.4), 'mostra'); assert.strictEqual(semEmpate(30.5), 'mostra');
  assert.strictEqual(semEmpate(32.99), 'mostra'); assert.strictEqual(semEmpate(33), 'fim');
  assert.strictEqual(comEmpate(30.1), 'gira'); assert.strictEqual(comEmpate(30.4), 'regira');
  assert.strictEqual(comEmpate(30.63), 'regira'); assert.strictEqual(comEmpate(30.64), 'mostra');
  // sem o 4º argumento vale o corredor do item (o vencedor)
  assert.strictEqual(FX.diceState(ITEM, 30.5, false).fase, 'regira');
});
test('diceState com movimento reduzido pula o giro', function () {
  assert.strictEqual(FX.diceState(ITEM, 30, true, 0).fase, 'mostra');
  assert.strictEqual(FX.diceState(ITEM, 30.5, true, 1).fase, 'mostra');
  assert.strictEqual(FX.diceState(ITEM, 33, true, 1).fase, 'fim');
});
test('brilho só do vencedor, pulsando em [t0 + 0.64, t0 + 3]', function () {
  assert.strictEqual(FX.diceState(ITEM, 30.6, false, 1).brilho, 0);
  assert.strictEqual(FX.diceState(ITEM, 31, false, 0).brilho, 0, 'perdedor não brilha');
  var vals = [];
  for (var t = 30.64; t < 33; t += 0.05) {
    var b = FX.diceState(ITEM, t, false, 1).brilho;
    assert.ok(b >= 0 && b <= 1, 'brilho em [0, 1]: ' + b);
    vals.push(b);
  }
  assert.ok(Math.max.apply(null, vals) - Math.min.apply(null, vals) > 0.5, 'pulsa');
  assert.strictEqual(FX.diceState(ITEM, 33.01, false, 1).brilho, 0);
  var red = FX.diceState(ITEM, 31, true, 1).brilho;
  assert.ok(red > 0 && red === FX.diceState(ITEM, 32, true, 1).brilho, 'reduzido: brilho fixo');
});

section('plaquinhas');
function sobrepoe(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
function confere(out, W, H) {
  for (var i = 0; i < out.length; i++) {
    var r = out[i];
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H, 'fora da tela: ' + JSON.stringify(r));
    for (var j = i + 1; j < out.length; j++) assert.ok(!sobrepoe(r, out[j]), 'sobreposição ' + i + '×' + j + ': ' + JSON.stringify([r, out[j]]));
  }
}
test('layoutBadges com 8 retângulos empilhados não deixa sobreposição nem sai da tela', function () {
  var rects = [];
  for (var i = 0; i < 8; i++) rects.push({ x: 60, y: 40, w: 17, h: 11, j: i });
  var out = FX.layoutBadges(rects, 200, 150);
  assert.strictEqual(out.length, 8);
  out.forEach(function (r, i) { assert.strictEqual(r.j, i, 'mesma ordem'); assert.strictEqual(r.w, 17); assert.strictEqual(r.h, 11); assert.strictEqual(r.x, 60, 'só na vertical'); });
  confere(out, 200, 150);
  assert.deepStrictEqual(rects[0], { x: 60, y: 40, w: 17, h: 11, j: 0 }, 'entrada intacta');
});
test('layoutBadges: raias vizinhas (8 cavalos lado a lado), bordas e caso sem conflito', function () {
  var viz = [];
  for (var i = 0; i < 8; i++) viz.push({ x: 40 + (i % 3) * 4, y: 8 + i * 6, w: 25, h: 11 });
  confere(FX.layoutBadges(viz, 187, 120), 187, 120);
  var borda = FX.layoutBadges([{ x: -8, y: -5, w: 13, h: 11 }, { x: 180, y: 115, w: 13, h: 11 }], 187, 120);
  assert.deepStrictEqual(borda.map(function (r) { return [r.x, r.y]; }), [[0, 0], [174, 109]]);
  var livres = [{ x: 10, y: 10, w: 13, h: 11 }, { x: 60, y: 10, w: 13, h: 11 }];
  assert.deepStrictEqual(FX.layoutBadges(livres, 187, 120), livres);
  // sem altura para empilhar: vai para o lado e continua sem sobreposição
  var aperto = [];
  for (var k = 0; k < 8; k++) aperto.push({ x: 80, y: 20, w: 17, h: 11 });
  confere(FX.layoutBadges(aperto, 187, 40), 187, 40);
});
test('tamanho da plaquinha e números (melhor em destaque, os outros depois)', function () {
  assert.deepStrictEqual(FX.diceLabels({ dice: [42, 87], best: 87, rerolls: 0 }), { best: '87', outros: ['42'] });
  assert.deepStrictEqual(FX.diceLabels({ dice: [100], best: 100, rerolls: 0 }), { best: '100', outros: [] });
  assert.deepStrictEqual(FX.diceLabels({ dice: [30, 30, 7], best: 30, rerolls: 0 }), { best: '30', outros: ['30', '7'] });
  var s1 = FX.badgeSize({ dice: [87], best: 87 }), s2 = FX.badgeSize({ dice: [42, 87], best: 87 });
  assert.ok(s1.w >= 9 && s1.h >= 9, JSON.stringify(s1));
  assert.ok(s2.w > s1.w && s2.h === s1.h, 'outros dados alargam a plaquinha');
});
test('faixa do Dado em ordem decrescente', function () {
  assert.deepStrictEqual(FX.stripOrder(ITEM), [1, 0, 2]);
  var it = { rolls: [{ dice: [50], best: 50 }, { dice: [80], best: 80 }, { dice: [50], best: 50 }, { dice: [90], best: 90 }], winner: 3 };
  assert.deepStrictEqual(FX.stripOrder(it), [3, 1, 0, 2]);
});

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
