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
    assert.strictEqual(it.t0, ev.t); assert.strictEqual(it.t1, ev.t + 2.4);
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
  assert.strictEqual(it.escala, 4); assert.strictEqual(it.t1, it.t0 + 2.4 * 4);
  assert.strictEqual(FX.slowFactor(tl, it.t0 + 3.2, false), 0.4);
  assert.strictEqual(FX.slowFactor(tl, it.t0 + 3.21, false), 1);
  var semEmpate = it.rolls.map(function (r, i) { return r.rerolls ? -1 : i; }).filter(function (i) { return i >= 0; })[0];
  assert.strictEqual(FX.diceState(it, it.t0 + 1.59, false, semEmpate).fase, 'gira');
  assert.strictEqual(FX.diceState(it, it.t0 + 1.6, false, semEmpate).fase, 'mostra');
  assert.strictEqual(FX.diceState(it, it.t0 + 9.59, false, semEmpate).fase, 'mostra');
  assert.strictEqual(FX.diceState(it, it.t0 + 9.6, false, semEmpate).fase, 'fim');
});

section('câmera lenta');
var ITEM = { kind: 'dado', t0: 30, t1: 32.4, racer: 1, winner: 1, changed: false, weather: 'sol',
  rolls: [{ racer: 0, dice: [55], best: 55, rerolls: 0 }, { racer: 1, dice: [91, 40], best: 91, rerolls: 1 }, { racer: 2, dice: [12], best: 12, rerolls: 0 }] };
test('slowFactor é 0.4 só na janela e 1 fora', function () {
  var tl = [ITEM];
  [[29.99, 1], [30, 0.4], [30.4, 0.4], [30.8, 0.4], [30.81, 1], [32, 1], [32.4, 1], [0, 1]].forEach(function (c) {
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
  assert.strictEqual(semEmpate(32.39), 'mostra'); assert.strictEqual(semEmpate(32.4), 'fim');
  assert.strictEqual(comEmpate(30.1), 'gira'); assert.strictEqual(comEmpate(30.4), 'regira');
  assert.strictEqual(comEmpate(30.63), 'regira'); assert.strictEqual(comEmpate(30.64), 'mostra');
  // sem o 4º argumento vale o corredor do item (o vencedor)
  assert.strictEqual(FX.diceState(ITEM, 30.5, false).fase, 'regira');
});
test('diceState com movimento reduzido pula o giro', function () {
  assert.strictEqual(FX.diceState(ITEM, 30, true, 0).fase, 'mostra');
  assert.strictEqual(FX.diceState(ITEM, 30.5, true, 1).fase, 'mostra');
  assert.strictEqual(FX.diceState(ITEM, 32.4, true, 1).fase, 'fim');
});
test('brilho só do vencedor, pulsando em [t0 + 0.64, t0 + 2.4]', function () {
  assert.strictEqual(FX.diceState(ITEM, 30.6, false, 1).brilho, 0);
  assert.strictEqual(FX.diceState(ITEM, 31, false, 0).brilho, 0, 'perdedor não brilha');
  var vals = [];
  for (var t = 30.64; t < 32.4; t += 0.05) {
    var b = FX.diceState(ITEM, t, false, 1).brilho;
    assert.ok(b >= 0 && b <= 1, 'brilho em [0, 1]: ' + b);
    vals.push(b);
  }
  assert.ok(Math.max.apply(null, vals) - Math.min.apply(null, vals) > 0.5, 'pulsa');
  assert.strictEqual(FX.diceState(ITEM, 32.41, false, 1).brilho, 0);
  var red = FX.diceState(ITEM, 31, true, 1).brilho;
  assert.ok(red > 0 && red === FX.diceState(ITEM, 32, true, 1).brilho, 'reduzido: brilho fixo');
});
test('durações reais em x1 (escala da tela): giro ≈ 1 s, desempate até 0,6 s, brilho ≈ 2 s', function () {
  // segundos reais = tempo de apresentação descontada a câmera lenta (0,4 até 0,8)
  var e = 3.9, it = { kind: 'dado', t0: 10, t1: 10 + 2.4 * e, racer: 1, winner: 1, escala: e, rolls: ITEM.rolls };
  function real(t) { return FX.diceState(it, t, false, 1).tempo; }
  assert.ok(Math.abs(real(10 + 0.4 * e) - 1) < 1e-9, 'giro');
  assert.ok(Math.abs(real(10 + 0.64 * e) - real(10 + 0.4 * e) - 0.6) < 1e-9, 'desempate');
  assert.ok(Math.abs(real(it.t1 - 1e-3) - real(10 + 0.64 * e) - 2) < 1e-3, 'brilho do vencedor');
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
test('layoutBadges desvia de obstáculos fixos (etiqueta VOCÊ) sem devolvê-los', function () {
  var voce = { x: 52, y: 28, w: 30, h: 11 }, rects = [];
  for (var i = 0; i < 4; i++) rects.push({ x: 60, y: 30, w: 17, h: 11 });
  var out = FX.layoutBadges(rects, 200, 150, [voce]);
  assert.strictEqual(out.length, 4);
  confere(out.concat([voce]), 200, 150);
  out.forEach(function (r) { assert.strictEqual(r.x, 60, 'só na vertical'); });
  assert.deepStrictEqual(FX.layoutBadges([{ x: 10, y: 10, w: 13, h: 11 }], 200, 150, [voce]), [{ x: 10, y: 10, w: 13, h: 11 }]);
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
  assert.deepStrictEqual(FX.diceLabels({ dice: [42, 87], best: 87, rerolls: 0 }), { marca: '', best: '87', outros: ['42'] });
  assert.deepStrictEqual(FX.diceLabels({ dice: [100], best: 100, rerolls: 0 }), { marca: '', best: '100', outros: [] });
  assert.deepStrictEqual(FX.diceLabels({ dice: [30, 30, 7], best: 30, rerolls: 0 }), { marca: '', best: '30', outros: ['30', '7'] });
  assert.deepStrictEqual(FX.diceLabels({ dice: [74], best: 74, rerolls: 1 }), { marca: '↻', best: '74', outros: [] });
  var s1 = FX.badgeSize({ dice: [87], best: 87 }), s2 = FX.badgeSize({ dice: [42, 87], best: 87 });
  assert.ok(s1.w >= 9 && s1.h >= 9, JSON.stringify(s1));
  assert.ok(s2.w > s1.w && s2.h === s1.h, 'outros dados alargam a plaquinha');
  assert.strictEqual(FX.badgeSize({ dice: [87], best: 87, rerolls: 2 }).w, s1.w + 6, '↻ (5 px + 1) antes do número');
});
test('faixa do Dado em ordem decrescente', function () {
  assert.deepStrictEqual(FX.stripOrder(ITEM), [1, 0, 2]);
  var it = { rolls: [{ dice: [50], best: 50 }, { dice: [80], best: 80 }, { dice: [50], best: 50 }, { dice: [90], best: 90 }], winner: 3 };
  assert.deepStrictEqual(FX.stripOrder(it), [3, 1, 0, 2]);
});
test('faixa com desempate: vencedor em 1º, depois rerolls e best decrescentes (seed 2)', function () {
  // o desempate reescreve dice/best dos empatados: o vencedor pode ter best menor que o de quem não empatou
  var C2 = corrida(2);
  var it = FX.timeline(C2.sim, C2.racers).filter(function (x) { return x.kind === 'dado' && x.rolls.some(function (r) { return r.rerolls > 0; }); })[0];
  assert.ok(it, 'a seed 2 tem um Dado com desempate');
  var maior = Math.max.apply(null, it.rolls.map(function (r) { return r.best; }));
  assert.ok(it.rolls[it.winner].best < maior, 'caso da revisão: vencedor com best menor que outro (' + it.rolls[it.winner].best + ' < ' + maior + ')');
  var o = FX.stripOrder(it);
  assert.strictEqual(o[0], it.winner, 'vencedor em 1º');
  assert.strictEqual(o.length, it.rolls.length);
  for (var k = 1; k < o.length; k++) {
    var a = it.rolls[o[k - 1]], b = it.rolls[o[k]];
    assert.ok(a.rerolls > b.rerolls || (a.rerolls === b.rerolls && a.best >= b.best), 'ordem em ' + k + ': ' + JSON.stringify([a, b]));
  }
  // em todas as corridas de 1–200: o vencedor sempre em 1º
  for (var sd = 1; sd <= 200; sd++) {
    var C = corrida(sd);
    FX.timeline(C.sim, C.racers).filter(function (d) { return d.kind === 'dado'; }).forEach(function (d) { assert.strictEqual(FX.stripOrder(d)[0], d.winner, 'seed ' + sd); });
  }
});

section('skills, Garra e cansaço');
// corrida com todas as skills do catálogo distribuídas pelos cavalos e "skills sempre ativam" (modo DEV da simulação)
function corridaSkills(seed, escala) {
  var ids = Object.keys(G.SKILLS), hs = G.STARTERS.concat(G.WILD_HORSES.slice(0, 5));
  var racers = hs.map(function (h, i) {
    var c = cl(h);
    c.skills = ids.filter(function (id, q) { return q % hs.length === i && (!G.SKILLS[id].exclusive || G.SKILLS[id].exclusive === c.id); });
    return { horse: c, gear: null, name: 'r' + i, isPlayer: i === 0, silks: CORES[i] };
  });
  var sim = S.simulate({ seed: seed, recordFrames: true, racers: racers, conditions: { distance: 2400 }, dev: { skillsAlways: true } });
  return { sim: sim, racers: racers, tl: FX.timeline(sim, racers, escala) };
}
test('skillIcon segue a ordem (5 skills reais do catálogo)', function () {
  assert.strictEqual(FX.skillIcon(G.SKILLS['arranque']), 'ace');          // accelMult
  assert.strictEqual(FX.skillIcon(G.SKILLS['drift']), 'curva');           // curveBonus
  assert.strictEqual(FX.skillIcon(G.SKILLS['segundo-ar']), 'folego');     // staminaRestore
  assert.strictEqual(FX.skillIcon(G.SKILLS['dado-viciado']), 'dado');     // extraDice
  assert.strictEqual(FX.skillIcon(G.SKILLS['sol-a-pino']), 'clima');      // weatherDouble
});
test('skillIcon: primeira chave da lista vence; drainMult só conta se < 1', function () {
  assert.strictEqual(FX.skillIcon(G.SKILLS['labareda']), 'vel', 'accelMult + speedMult => speedMult primeiro');
  assert.strictEqual(FX.skillIcon(G.SKILLS['mare-alta']), 'vel', 'staminaRestore + speedMult => speedMult primeiro');
  assert.strictEqual(FX.skillIcon(G.SKILLS['sprint']), 'vel', 'drainMult 1.15 (gasta mais) não é fôlego');
  assert.strictEqual(FX.skillIcon({ effect: { drainMult: 1.15 } }), 'vel', 'só drainMult > 1: cai no padrão');
  assert.strictEqual(FX.skillIcon({ effect: { drainMult: 0.7 } }), 'folego');
  assert.strictEqual(FX.skillIcon(G.SKILLS['folego-de-montanha']), 'subida');
  assert.strictEqual(FX.skillIcon(G.SKILLS['casco-firme']), 'subida');
  assert.strictEqual(FX.skillIcon(G.SKILLS['arrancada-final']), 'garra');
  assert.strictEqual(FX.skillIcon({ effect: { garraBoostBonus: 0.02 } }), 'garra');
  assert.strictEqual(FX.skillIcon({ effect: {} }), 'vel');
  assert.strictEqual(FX.skillIcon(null), 'vel');
  Object.keys(G.SKILLS).forEach(function (id) {
    assert.ok(['vel', 'ace', 'folego', 'curva', 'subida', 'dado', 'clima', 'garra'].indexOf(FX.skillIcon(G.SKILLS[id])) >= 0, id);
  });
});
test('nomeCurto cabe em 11 letras maiúsculas', function () {
  assert.strictEqual(FX.nomeCurto('Labareda'), 'LABAREDA');
  assert.strictEqual(FX.nomeCurto('Arrancada Final'), 'ARRANCADA');
  assert.strictEqual(FX.nomeCurto('Canto da Iara'), 'CANTO IARA');
  Object.keys(G.SKILLS).forEach(function (id) { assert.ok(FX.nomeCurto(G.SKILLS[id].name).length <= 11, id); });
});
test('timeline tem um item por evento skill/garra/cansou', function () {
  var visto = { skill: 0, garra: 0, cansou: 0 };
  for (var sd = 1; sd <= 40; sd++) {   // 2400 m: com 1000 m ninguém se cansa
    var C = corridaSkills(sd);
    ['skill', 'garra', 'cansou'].forEach(function (tipo) {
      var evs = C.sim.events.filter(function (e) { return e.type === tipo; });
      var its = C.tl.filter(function (it) { return it.kind === tipo; });
      assert.strictEqual(its.length, evs.length, 'seed ' + sd + ' ' + tipo);
      evs.forEach(function (ev, k) {
        assert.strictEqual(its[k].t0, ev.t); assert.strictEqual(its[k].racer, ev.racer);
      });
      visto[tipo] += evs.length;
    });
    for (var q = 1; q < C.tl.length; q++) assert.ok(C.tl[q - 1].t0 <= C.tl[q].t0, 'ordenada por t0');
  }
  assert.ok(visto.skill > 20 && visto.garra > 0 && visto.cansou > 0, 'as corridas exercitam os três tipos ' + JSON.stringify(visto));
});
test('cada item de skill acha a skill pelo nome do evento e o ícone dela', function () {
  var sks = [], C = null, sd;
  for (sd = 1; sd <= 6; sd++) {
    C = corridaSkills(sd);
    C.tl.filter(function (it) { return it.kind === 'skill'; }).forEach(function (it) { sks.push({ it: it, C: C }); });
  }
  assert.ok(sks.length >= 30, 'itens de skill nas 6 corridas: ' + sks.length);
  sks.forEach(function (par) {
    var it = par.it, C = par.C;
    var ev = C.sim.events.filter(function (e) { return e.type === 'skill' && e.t === it.t0 && e.racer === it.racer; })[0];
    var sk = G.SKILLS[it.skillId];
    assert.ok(sk && C.racers[it.racer].horse.skills.indexOf(it.skillId) >= 0, 'skill do cavalo');
    assert.ok(ev.text.indexOf(sk.name) >= 0);
    assert.strictEqual(it.icon, FX.skillIcon(sk)); assert.strictEqual(it.element, sk.element);
    assert.strictEqual(it.nome, sk.name);
  });
});
test('duração da skill fica em [1.5, 7] (e durationS/distância/bloco valem dentro do intervalo)', function () {
  var vistas = {};
  for (var sd = 1; sd <= 30; sd++) {
    var C = corridaSkills(sd);
    C.tl.filter(function (it) { return it.kind === 'skill'; }).forEach(function (it) {
      var d = it.t1 - it.t0;
      assert.ok(d >= 1.5 - 1e-9 && d <= 7 + 1e-9, 'seed ' + sd + ' ' + it.skillId + ' duração ' + d);
      var ef = G.SKILLS[it.skillId].effect;
      if (ef.durationS) assert.ok(Math.abs(d - Math.min(7, Math.max(1.5, ef.durationS))) < 1e-9, it.skillId + ' usa durationS');
      vistas[it.skillId] = true;
    });
  }
  assert.ok(Object.keys(vistas).length >= 14, 'a maioria do catálogo foi exercitada: ' + Object.keys(vistas).length);
});
test('duração por distância e por bloco segue os frames da simulação', function () {
  var ok = { dist: 0, bloco: 0 };
  for (var sd = 1; sd <= 8; sd++) {
  var C = corridaSkills(sd);
  C.tl.filter(function (it) { return it.kind === 'skill'; }).forEach(function (it) {
    var ef = G.SKILLS[it.skillId].effect, fr = C.sim.frames, dt = C.sim.dt;
    var i0 = Math.round(it.t0 / dt), p0 = fr[i0].pos[it.racer];
    if (ef.distanceM && !ef.durationS) {
      var alvo = p0 + ef.distanceM, f = i0;
      while (f < fr.length && fr[f].pos[it.racer] < alvo) f++;
      var esperado = f < fr.length ? fr[f].t - it.t0 : C.sim.finishTimes[it.racer] - it.t0;
      assert.ok(Math.abs((it.t1 - it.t0) - Math.min(7, Math.max(1.5, esperado))) < 1e-9, it.skillId + ' distância');
      ok.dist++;
    } else if (ef.blockScoped) {
      var bl = C.sim.conditions.blocks.filter(function (b) { return p0 < b.to; })[0] || C.sim.conditions.blocks[C.sim.conditions.blocks.length - 1];
      var g = i0;
      while (g < fr.length && fr[g].pos[it.racer] < bl.to) g++;
      var esp2 = g < fr.length ? fr[g].t - it.t0 : C.sim.finishTimes[it.racer] - it.t0;
      assert.ok(Math.abs((it.t1 - it.t0) - Math.min(7, Math.max(1.5, esp2))) < 1e-9, it.skillId + ' bloco');
      ok.bloco++;
    }
  });
  }
  assert.ok(ok.dist >= 1 && ok.bloco >= 1, 'exercitou distância e bloco ' + JSON.stringify(ok));
});
test('Garra vai até finishTime + 0.6 e cansou dura 1.5; escala multiplica os limites', function () {
  var visto = { garra: 0, cansou: 0 };
  for (var sd = 1; sd <= 30 && (!visto.garra || !visto.cansou); sd++) {
    var C = corridaSkills(sd, 1), C3 = corridaSkills(sd, 3);
    C.tl.forEach(function (it) {
      if (it.kind === 'garra') { assert.ok(Math.abs(it.t1 - (C.sim.finishTimes[it.racer] + 0.6)) < 1e-9); visto.garra++; }
      if (it.kind === 'cansou') { assert.strictEqual(it.t1, it.t0 + 1.5); visto.cansou++; }
    });
    C3.tl.forEach(function (it) {
      if (it.kind === 'cansou') assert.strictEqual(it.t1, it.t0 + 4.5);
      if (it.kind === 'skill') { var d = it.t1 - it.t0; assert.ok(d >= 4.5 - 1e-9 && d <= 21 + 1e-9); }
    });
  }
  assert.ok(visto.garra && visto.cansou, 'achou Garra e cansou ' + JSON.stringify(visto));
});
test('a linha do tempo de skills é a mesma para a mesma seed e não mexe na simulação', function () {
  var a = corridaSkills(9), antes = JSON.stringify(a.sim.events), b = corridaSkills(9);
  assert.deepStrictEqual(a.tl, b.tl);
  FX.timeline(a.sim, a.racers, 3);
  assert.strictEqual(JSON.stringify(a.sim.events), antes);
});

section('balão e contorno (desenho com contexto falso)');
// contexto que só registra fillRect/estilo: o suficiente para contar o que foi desenhado
function ctxFalso() {
  var c = { rects: [], fillStyle: '', globalAlpha: 1 };
  c.fillRect = function (x, y, w, h) { c.rects.push({ x: x, y: y, w: w, h: h, cor: c.fillStyle, a: c.globalAlpha }); };
  c.save = function () {}; c.restore = function () {};
  return c;
}
var ITEM_SKILL = { kind: 'skill', t0: 10, t1: 15, racer: 0, skillId: 'labareda', icon: 'vel', element: 'fogo', cavalo: 'fogo', nome: 'Labareda', nomeCurto: 'LABAREDA', escala: 1 };
test('balão: aparece em [t0, t0 + 1.5), conta em _stats.baloes e some depois', function () {
  FX.resetStats(true);
  var c = ctxFalso();
  assert.strictEqual(FX.drawBalloon(c, 10, 10, 2, ITEM_SKILL, 9.9, 0), false, 'antes');
  assert.strictEqual(FX.drawBalloon(c, 10, 10, 2, ITEM_SKILL, 10.5, 0), true);
  assert.strictEqual(FX.drawBalloon(c, 10, 10, 2, ITEM_SKILL, 11.4, 1), true);
  assert.strictEqual(FX.drawBalloon(c, 10, 10, 2, ITEM_SKILL, 11.5, 0), false, 'depois');
  assert.strictEqual(FX._stats.baloes, 2);
  assert.ok(c.rects.length > 20, 'ícone e texto saem de fillRect');
  FX.resetStats(true);
});
test('balão de Garra e de cansou: tamanho e cores próprios', function () {
  var g = { kind: 'garra', t0: 10, t1: 30, racer: 0, icon: 'garra', element: 'fogo', escala: 1 };
  var z = { kind: 'cansou', t0: 10, t1: 11.5, racer: 0, escala: 1 };
  var cg = ctxFalso(), cz = ctxFalso();
  assert.ok(FX.drawBalloon(cg, 0, 0, 2, g, 10.2, 0) && FX.drawBalloon(cz, 0, 0, 2, z, 10.2, 0));
  assert.ok(cg.rects.some(function (r) { return r.cor === '#f2c230'; }), 'Garra em dourado');
  assert.ok(cz.rects.every(function (r) { return r.cor !== '#f2c230'; }), 'cansou sem dourado (cinza)');
  var sz = FX.balloonSize(ITEM_SKILL), sg = FX.balloonSize(g), sc = FX.balloonSize(z);
  assert.ok(sz.w > 20 && sz.h >= 12 && sg.w > 20 && sc.w > 20);
  FX.resetStats(true);
});
test('contorno: dura t0..t1; vento só fora do reduzido; sem partículas em reduced', function () {
  var box = { x: 100, y: 100, w: 80, h: 64, S: 2 };
  FX.resetStats(true);
  var c1 = ctxFalso();
  assert.strictEqual(FX.drawSkillAura(c1, box, ITEM_SKILL, 9, false), false);
  assert.strictEqual(FX.drawSkillAura(c1, box, ITEM_SKILL, 15, false), false);
  assert.strictEqual(FX.drawSkillAura(c1, box, ITEM_SKILL, 12, false), true);
  assert.ok(FX._stats.particulas > 0, 'vento conta como partícula');
  var p = FX._stats.particulas; FX.resetStats(true);
  var c2 = ctxFalso();
  assert.strictEqual(FX.drawSkillAura(c2, box, ITEM_SKILL, 12, true), true, 'reduced ainda desenha o contorno');
  assert.strictEqual(FX._stats.particulas, 0, 'reduced: nada de vento');
  assert.ok(c2.rects.length > 0 && c2.rects.length < c1.rects.length, 'reduced desenha menos (' + c2.rects.length + ' < ' + c1.rects.length + ')');
  var curva = { kind: 'skill', t0: 10, t1: 15, racer: 0, icon: 'curva', element: 'neutro', cavalo: 'agua', escala: 1 };
  var fol = { kind: 'skill', t0: 10, t1: 15, racer: 0, icon: 'folego', element: 'agua', cavalo: 'agua', escala: 1 };
  FX.resetStats(true); FX.drawSkillAura(ctxFalso(), box, curva, 12, false); assert.ok(FX._stats.particulas > 0, 'faíscas da curva');
  FX.resetStats(true); FX.drawSkillAura(ctxFalso(), box, fol, 12, false); assert.ok(FX._stats.particulas > 0, '+ do fôlego');
  FX.resetStats(true); FX.drawSkillAura(ctxFalso(), box, curva, 12, true); assert.strictEqual(FX._stats.particulas, 0);
  FX.resetStats(true); FX.drawSkillAura(ctxFalso(), box, fol, 12, true); assert.strictEqual(FX._stats.particulas, 0);
  assert.ok(p > 0);
});
test('desenho é função do tempo: mesmo simT, mesmos retângulos', function () {
  var box = { x: 100, y: 100, w: 80, h: 64, S: 2 }, a = ctxFalso(), b = ctxFalso();
  FX.drawSkillAura(a, box, ITEM_SKILL, 12.3, false); FX.drawSkillAura(b, box, ITEM_SKILL, 12.3, false);
  assert.deepStrictEqual(a.rects, b.rects);
  FX.resetStats(true);
});

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
