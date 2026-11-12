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
test('faixa com desempate: vencedor em 1º, depois rerolls e best decrescentes (seed 19)', function () {
  // o desempate reescreve dice/best dos empatados: o vencedor pode ter best menor que o de quem não empatou
  var C2 = corrida(19);   // seed escolhida no modelo de status v3 (antes era a 2)
  var it = FX.timeline(C2.sim, C2.racers).filter(function (x) { return x.kind === 'dado' && x.rolls.some(function (r) { return r.rerolls > 0; }); })[0];
  assert.ok(it, 'a seed 19 tem um Dado com desempate');
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
// corrida com todas as skills do catálogo distribuídas pelos cavalos e "skills sempre ativam" (modo DEV da simulação);
// sem a skill de tipo (noTypeSkill): aqui só as skills de vaga (a skill de tipo na pista é outra tarefa)
function corridaSkills(seed, escala) {
  var ids = Object.keys(G.SKILLS), hs = G.STARTERS.concat(G.WILD_HORSES.slice(0, 5));
  var racers = hs.map(function (h, i) {
    var c = cl(h);
    c.skills = ids.filter(function (id, q) { return q % hs.length === i; });
    return { horse: c, gear: null, name: 'r' + i, isPlayer: i === 0, silks: CORES[i], noTypeSkill: true };
  });
  var sim = S.simulate({ seed: seed, recordFrames: true, racers: racers, conditions: { distance: 2000 }, dev: { skillsAlways: true } });
  return { sim: sim, racers: racers, tl: FX.timeline(sim, racers, escala) };
}
test('skillIcon segue a ordem (5 skills reais do catálogo)', function () {
  assert.strictEqual(FX.skillIcon(G.SKILLS['arranque']), 'ace');          // accelMult
  assert.strictEqual(FX.skillIcon(G.SKILLS['drift']), 'curva');           // curveBonus
  assert.strictEqual(FX.skillIcon(G.SKILLS['segundo-ar']), 'vel');        // speedMult vem antes de staminaRestore (pacote de balanço)
  assert.strictEqual(FX.skillIcon(G.SKILLS['dado-viciado']), 'dado');     // extraDice
  assert.strictEqual(FX.skillIcon(G.SKILLS['sol-a-pino']), 'clima');      // weatherDouble
});
test('skillIcon: primeira chave da lista vence; drainMult só conta se < 1', function () {
  assert.strictEqual(FX.skillIcon(G.SKILLS['saida-rapida']), 'vel', 'accelMult + speedMult => speedMult primeiro');
  assert.strictEqual(FX.skillIcon(G.SKILLS['segundo-ar']), 'vel', 'staminaRestore + speedMult => speedMult primeiro');
  assert.strictEqual(FX.skillIcon(G.SKILLS['sprint']), 'vel', 'drainMult 1.0 (gasto normal) não é fôlego');
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
test('nomeCurto: nome inteiro até 12 letras; campo short nos longos; nenhum corte no meio da palavra', function () {
  assert.strictEqual(FX.nomeCurto('Labareda'), 'LABAREDA');
  assert.strictEqual(FX.nomeCurto('Saída Rápida'), 'SAÍDA RÁPIDA');
  assert.strictEqual(FX.nomeCurto('Fôlego de Montanha', 'FÔLEGO MONT.'), 'FÔLEGO MONT.');
  Object.keys(G.SKILLS).forEach(function (id) {
    var sk = G.SKILLS[id], n = FX.nomeCurto(sk.name, sk.short), nome = sk.name.toUpperCase();
    assert.ok(n.length <= 12, id + ' "' + n + '" passa de 12');
    if (nome.length <= 12) { assert.strictEqual(n, nome, id + ' cabe inteiro'); assert.ok(!sk.short, id + ' não precisa de short'); }
    else assert.ok(sk.short, id + ' (' + nome.length + ' letras) precisa de short no catálogo');
    var palavras = nome.split(' ');
    n.split(' ').forEach(function (tok) {
      var ok = palavras.indexOf(tok) >= 0 ||
        (/\.$/.test(tok) && palavras.some(function (w) { return tok.length > 2 && w.indexOf(tok.slice(0, -1)) === 0; }));
      assert.ok(ok, id + ': "' + tok + '" corta a palavra no meio');
    });
    assert.ok(n.split(' ').length >= nome.split(' ').filter(function (w) { return w.length > 2; }).length, id + ' perdeu palavra de peso: ' + n);
  });
  // sem short, o corte do nome é por palavras inteiras
  assert.strictEqual(FX.nomeCurto('Fôlego de Montanha'), 'FÔLEGO');
});
test('timeline tem um item por evento skill/garra/cansou', function () {
  var visto = { skill: 0, garra: 0, cansou: 0 };
  for (var sd = 1; sd <= 40; sd++) {   // 2000 m (a mais longa do sorteio): com 1000 m ninguém se cansa
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
  for (var sd = 1; sd <= 60 && (!visto.garra || !visto.cansou); sd++) {   // v3: o 1º cansaço vem na seed 36
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
  c.imgs = [];
  c.drawImage = function () { c.imgs.push({ args: Array.prototype.slice.call(arguments), liso: c.imageSmoothingEnabled }); };
  return c;
}
var ITEM_SKILL = { kind: 'skill', t0: 10, t1: 15, racer: 0, skillId: 'labareda', icon: 'vel', element: 'fogo', cavalo: 'fogo', nome: 'Labareda', nomeCurto: 'LABAREDA', silks: '#d8353b', raia: 1, escala: 1 };
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
  var g = { kind: 'garra', t0: 10, t1: 30, racer: 0, icon: 'garra', element: 'fogo', silks: '#d8353b', raia: 1, escala: 1 };
  var z = { kind: 'cansou', t0: 10, t1: 11.5, racer: 0, silks: '#2f6fd8', raia: 2, escala: 1 };
  var cg = ctxFalso(), cz = ctxFalso();
  assert.ok(FX.drawBalloon(cg, 0, 0, 2, g, 10.2, 0) && FX.drawBalloon(cz, 0, 0, 2, z, 10.2, 0));
  assert.ok(cg.rects.some(function (r) { return r.cor === '#f7d778'; }), 'Garra em dourado (ícone e texto)');
  assert.ok(cz.rects.every(function (r) { return r.cor !== '#f7d778'; }), 'cansou sem dourado');
  assert.ok(cz.rects.some(function (r) { return r.cor === '#c3cac6'; }) && cz.rects.some(function (r) { return r.cor === '#2b2f2d'; }), 'cansou em cinza');
  assert.ok(cg.rects.some(function (r) { return r.cor === '#d8353b'; }), 'borda e chip na cor da seda da raia');
  var sz = FX.balloonSize(ITEM_SKILL, 0), sg = FX.balloonSize(g, 0), sc = FX.balloonSize(z, 0), sp1 = FX.balloonSize(ITEM_SKILL, 1);
  assert.ok(sz.w > 20 && sz.h === 11 && sg.w > 20 && sc.w > 20);
  assert.ok(sp1.w < sz.w, 'pilha > 0 é compacta');
  FX.resetStats(true);
});
test('efeitos: dura t0..t1; vento só fora do reduzido; reduced não desenha nem conta partículas', function () {
  var box = { x: 100, y: 100, w: 80, h: 64, S: 2 };
  FX.resetStats(true);
  var c1 = ctxFalso();
  assert.strictEqual(FX.drawSkillAura(c1, box, ITEM_SKILL, 9, false), false);
  assert.strictEqual(FX.drawSkillAura(c1, box, ITEM_SKILL, 15, false), false);
  assert.strictEqual(FX.drawSkillAura(c1, box, ITEM_SKILL, 12, false), true);
  assert.ok(FX._stats.particulas > 0 && c1.rects.length > 0, 'vento conta como partícula');
  FX.resetStats(true);
  var c2 = ctxFalso();
  assert.strictEqual(FX.drawSkillAura(c2, box, ITEM_SKILL, 12, true), true);
  assert.strictEqual(FX._stats.particulas, 0, 'reduced: nada de vento');
  assert.strictEqual(c2.rects.length, 0, 'reduced: nenhum retângulo de efeito (o contorno é a silhueta)');
  var curva = { kind: 'skill', t0: 10, t1: 15, racer: 0, icon: 'curva', element: 'geral', cavalo: 'agua', escala: 1 };
  var fol = { kind: 'skill', t0: 10, t1: 15, racer: 0, icon: 'folego', element: 'agua', cavalo: 'agua', escala: 1 };
  FX.resetStats(true); FX.drawSkillAura(ctxFalso(), box, curva, 12, false); assert.ok(FX._stats.particulas > 0, 'faíscas da curva');
  FX.resetStats(true); FX.drawSkillAura(ctxFalso(), box, fol, 12, false); assert.ok(FX._stats.particulas > 0, '+ do fôlego');
  FX.resetStats(true); FX.drawSkillAura(ctxFalso(), box, curva, 12, true); assert.strictEqual(FX._stats.particulas, 0);
  FX.resetStats(true); FX.drawSkillAura(ctxFalso(), box, fol, 12, true); assert.strictEqual(FX._stats.particulas, 0);
});
test('glow do contorno: some fora de [t0, t1), pulsa e fica parado em reduced; skill geral usa o elemento do cavalo', function () {
  assert.strictEqual(FX.glow(ITEM_SKILL, 9.9, false), null);
  assert.strictEqual(FX.glow(ITEM_SKILL, 15, false), null);
  assert.strictEqual(FX.glow({ kind: 'dado', t0: 0, t1: 9 }, 5, false), null);
  var vistos = {};
  for (var t = 11; t < 13; t += 0.05) vistos[FX.glow(ITEM_SKILL, t, false).alpha.toFixed(2)] = true;
  assert.ok(Object.keys(vistos).length > 5, 'pulsa');
  var r = {};
  for (t = 11; t < 13; t += 0.05) r[FX.glow(ITEM_SKILL, t, true).alpha.toFixed(2)] = true;
  assert.strictEqual(Object.keys(r).length, 1, 'reduced fica parado');
  var g1 = FX.glow(ITEM_SKILL, 12, false), g2 = FX.glow({ kind: 'skill', t0: 10, t1: 15, icon: 'vel', element: 'geral', cavalo: 'agua', escala: 1 }, 12, false);
  assert.notStrictEqual(g1.cor, g2.cor);
  assert.ok(FX.glow(ITEM_SKILL, 10.01, false).alpha < FX.glow(ITEM_SKILL, 12, false).alpha + 1e-9, 'entra suave');
});
test('ícone de clima pelo trigger da skill (sol, gota, névoa)', function () {
  var C = corridaSkills(21);   // seed com sol, chuva e névoa (as três skills de clima ativam)
  var porId = {};
  C.tl.filter(function (it) { return it.kind === 'skill'; }).forEach(function (it) { porId[it.skillId] = it; });
  ['sol-a-pino', 'pe-na-chuva', 'nevoa-amiga'].forEach(function (id) { assert.ok(porId[id], 'seed 21 tem ' + id); assert.strictEqual(porId[id].icon, 'clima'); });
  assert.strictEqual(FX.iconeDe(porId['sol-a-pino']), 'sol');
  assert.strictEqual(FX.iconeDe(porId['pe-na-chuva']), 'gota');
  assert.strictEqual(FX.iconeDe(porId['nevoa-amiga']), 'nevoa');
  assert.strictEqual(FX.iconeDe({ kind: 'skill', icon: 'dado' }), 'dado');
  assert.strictEqual(FX.iconeDe({ kind: 'cansou' }), 'gota');
});
test('acharSkill casa " ativou <Nome>!" (cavalo chamado "Sprint" com Drift e Sprint)', function () {
  var racers = [{ horse: { name: 'Sprint', element: 'neutro', skills: ['drift', 'sprint'] }, silks: '#d8353b' }];
  var sim = { events: [{ t: 5, racer: 0, type: 'skill', text: 'Sprint ativou Drift!' }, { t: 9, racer: 0, type: 'skill', text: 'Sprint ativou Sprint!' }], frames: [], dt: 0.1 };
  var tl = FX.timeline(sim, racers);
  assert.strictEqual(tl[0].skillId, 'drift'); assert.strictEqual(tl[1].skillId, 'sprint');
  assert.strictEqual(tl[0].icon, 'curva'); assert.strictEqual(tl[1].icon, 'vel');
  assert.strictEqual(tl[0].raia, 1); assert.strictEqual(tl[0].silks, '#d8353b');
});
test('desenho é função do tempo: mesmo simT, mesmos retângulos', function () {
  var box = { x: 100, y: 100, w: 80, h: 64, S: 2 }, a = ctxFalso(), b = ctxFalso();
  FX.drawSkillAura(a, box, ITEM_SKILL, 12.3, false); FX.drawSkillAura(b, box, ITEM_SKILL, 12.3, false);
  assert.deepStrictEqual(a.rects, b.rects);
  FX.resetStats(true);
});

section('vento e natureza');
test('wind é determinístico', function () {
  [0, 1, 7, 4242, 101, 4294967295, 2147483648, 123456789].forEach(function (sd) {
    var a = FX.wind(sd), b = FX.wind(sd);
    assert.deepStrictEqual(a, b, 'seed ' + sd);
    assert.ok(['calmo', 'brisa', 'ventania'].indexOf(a.intensity) >= 0, 'intensidade ' + a.intensity);
    assert.ok(a.dir === 1 || a.dir === -1, 'direção ' + a.dir);
  });
  assert.deepStrictEqual(FX.wind('4242'), FX.wind(4242), 'seed em texto vira número');
});
test('wind segue a distribuição (10 000 seeds, ±3 p.p. de 35/40/25 %; direção ~50 %)', function () {
  // duas famílias: seeds seguidas (o caso difícil para um hash fraco) e espalhadas por todo o uint32
  [function (k) { return k + 1; }, function (k) { return (Math.imul(k + 1, 2654435761) >>> 0); }].forEach(function (gera, fam) {
    var n = 10000, c = { calmo: 0, brisa: 0, ventania: 0 }, dir = 0;
    for (var k = 0; k < n; k++) { var w = FX.wind(gera(k)); c[w.intensity]++; if (w.dir > 0) dir++; }
    var alvo = { calmo: 0.35, brisa: 0.40, ventania: 0.25 };
    Object.keys(alvo).forEach(function (q) {
      assert.ok(Math.abs(c[q] / n - alvo[q]) <= 0.03, 'família ' + fam + ': ' + q + ' ' + (100 * c[q] / n).toFixed(1) + ' %');
    });
    assert.ok(Math.abs(dir / n - 0.5) <= 0.03, 'família ' + fam + ': direção → ' + (100 * dir / n).toFixed(1) + ' %');
  });
});
test('rainSlant: o vento inclina a chuva no sentido dele, mais na ventania', function () {
  var c = FX.rainSlant({ intensity: 'calmo', dir: 1 }), b = FX.rainSlant({ intensity: 'brisa', dir: 1 }), v = FX.rainSlant({ intensity: 'ventania', dir: 1 });
  assert.ok(c >= 0 && b > c && v > b, JSON.stringify([c, b, v]));
  assert.strictEqual(FX.rainSlant({ intensity: 'ventania', dir: -1 }), -v);
  assert.strictEqual(FX.rainSlant(null), FX.rainSlant({ intensity: 'calmo', dir: 1 }), 'sem vento = calmo');
});

// contexto falso com drawImage (as nuvens da frente no nublado usam canvas do Sprites só no browser)
function ctxNat() {
  var c = ctxFalso();
  var grava = c.drawImage;
  c.drawImage = function () { c.imagens = (c.imagens || 0) + 1; grava.apply(c, arguments); };
  return c;
}
var NAT = { W: 1200, H: 600, P: 3, laneTop: 270, trackBottom: 540, seed: 77 };
function nat(extra) { var o = {}, k; for (k in NAT) o[k] = NAT[k]; for (k in extra) o[k] = extra[k]; return o; }
var VENTANIA = { intensity: 'ventania', dir: 1 }, BRISA = { intensity: 'brisa', dir: -1 }, CALMO = { intensity: 'calmo', dir: 1 };
function desenha(o) { FX.resetStats(true); var c = ctxNat(); FX.drawNature(c, o); var st = JSON.parse(JSON.stringify(FX._stats.natureza)); return { c: c, st: st }; }
function cores(c) { var s = {}; c.rects.forEach(function (r) { s[r.cor] = true; }); return s; }

test('drawNature: tudo é função do tempo, do índice e da seed (mesmo t ⇒ mesmos retângulos)', function () {
  ['sol', 'chuva', 'nevoa', 'nublado'].forEach(function (w) {
    var a = desenha(nat({ weather: w, wind: VENTANIA, t: 3.21 })), b = desenha(nat({ weather: w, wind: VENTANIA, t: 3.21 }));
    assert.deepStrictEqual(a.c.rects, b.c.rects, w + ': mesmo t');
    var d = desenha(nat({ weather: w, wind: VENTANIA, t: 3.61 }));
    assert.notDeepStrictEqual(a.c.rects, d.c.rects, w + ': t diferente muda o quadro');
    var e = desenha(nat({ weather: w, wind: VENTANIA, t: 3.21, seed: 78 }));
    assert.notDeepStrictEqual(a.c.rects, e.c.rects, w + ': seed diferente muda o quadro');
  });
});
test('chuva: em reduced tem metade dos pingos e não congela (a velocidade de 40 % é medida no teste do deslocamento)', function () {
  var f = desenha(nat({ weather: 'chuva', wind: BRISA, t: 5 })), r = desenha(nat({ weather: 'chuva', wind: BRISA, t: 5, reduced: true }));
  assert.ok(f.st.pingos > 40, 'pingos completos ' + f.st.pingos);
  assert.ok(r.st.pingos > 0 && r.st.pingos <= Math.ceil(f.st.pingos / 2), 'reduced com metade: ' + r.st.pingos + ' de ' + f.st.pingos);
  var r2 = desenha(nat({ weather: 'chuva', wind: BRISA, t: 5.2, reduced: true }));
  assert.notDeepStrictEqual(r.c.rects, r2.c.rects, 'reduced não congela');
});
test('chuva: respingos só na faixa do chão da pista [laneTop, trackBottom]', function () {
  var vistos = 0;
  for (var t = 0; t < 4; t += 0.13) {
    var d = desenha(nat({ weather: 'chuva', wind: VENTANIA, t: t, camada: 'tras' }));
    d.c.rects.filter(function (q) { return q.cor === FX.RAIN.corRespingo; }).forEach(function (q) {
      vistos++;
      assert.ok(q.y >= NAT.laneTop && q.y + q.h <= NAT.trackBottom, 'respingo em y ' + q.y + '..' + (q.y + q.h));
    });
    assert.ok(d.st.respingos <= FX.NATUREZA.respingosMax);
  }
  assert.ok(vistos > 20, 'houve respingos: ' + vistos);
});
test('chuva: relâmpago some em reduced', function () {
  function clarao(red) {
    var n = 0;
    for (var t = 0; t < 34; t += 0.02) {
      var d = desenha(nat({ weather: 'chuva', wind: CALMO, t: t, reduced: red }));
      if (d.st.relampago) n++;
    }
    return n;
  }
  assert.ok(clarao(false) > 0, 'há relâmpago');
  assert.strictEqual(clarao(true), 0, 'reduced sem relâmpago');
});
test('sol: raios de luz; faixas de calor somem em reduced', function () {
  var f = desenha(nat({ weather: 'sol', wind: BRISA, t: 2 })), r = desenha(nat({ weather: 'sol', wind: BRISA, t: 2, reduced: true }));
  assert.ok(f.st.raios > 0 && r.st.raios > 0, 'raios nos dois');
  assert.ok(f.st.calor > 0, 'calor no completo');
  assert.strictEqual(r.st.calor, 0, 'reduced sem calor');
});
test('névoa: camada de trás em drawNature e da frente em drawFogFront, andando com o vento', function () {
  var a = desenha(nat({ weather: 'nevoa', wind: VENTANIA, t: 1, camada: 'tras' }));
  assert.ok(a.st.nevoa > 0, 'camada de trás');
  FX.resetStats(true);
  var c1 = ctxNat(), c2 = ctxNat();
  FX.drawFogFront(c1, nat({ weather: 'nevoa', wind: VENTANIA, t: 1 }));
  assert.ok(FX._stats.natureza.nevoaFrente > 0 && c1.rects.length > 0, 'camada da frente');
  FX.drawFogFront(c2, nat({ weather: 'nevoa', wind: VENTANIA, t: 1.5 }));
  assert.notDeepStrictEqual(c1.rects, c2.rects, 'anda');
  var c3 = ctxNat();
  FX.drawFogFront(c3, nat({ weather: 'sol', wind: VENTANIA, t: 1 }));
  assert.strictEqual(c3.rects.length, 0, 'só na névoa');
});
test('nublado: sombras de nuvem levadas pelo vento (direção do vento)', function () {
  function xs(w, t) {
    var d = desenha(nat({ weather: 'nublado', wind: w, t: t }));
    return d.c.rects.filter(function (q) { return q.cor === FX.SOMBRA_NUVEM; }).map(function (q) { return q.x; });
  }
  var a = xs({ intensity: 'brisa', dir: 1 }, 1), b = xs({ intensity: 'brisa', dir: 1 }, 1.1);
  var c = xs({ intensity: 'brisa', dir: -1 }, 1), d = xs({ intensity: 'brisa', dir: -1 }, 1.1);
  assert.ok(a.length && a.length === b.length && c.length === d.length, 'sombras');
  assert.ok(b[0] > a[0], '→ anda para a direita'); assert.ok(d[0] < c[0], '← anda para a esquerda');
});
test('folhas e poeira pela intensidade: calmo 0, brisa até 10, ventania até 18 por tela; metade em reduced', function () {
  function max(w, red, weather) {
    var m = 0, alguma = 0;
    for (var t = 0; t < 20; t += 0.25) {
      var d = desenha(nat({ weather: weather || 'sol', wind: w, t: t, reduced: red }));
      m = Math.max(m, d.st.folhas); alguma += d.st.folhas;
    }
    return { m: m, alguma: alguma };
  }
  assert.strictEqual(max(CALMO, false).alguma, 0, 'calmo sem folhas');
  var b = max(BRISA, false), v = max(VENTANIA, false), br = max(BRISA, true), vr = max(VENTANIA, true);
  assert.ok(b.m > 6 && b.m <= 10, 'brisa ' + b.m);
  assert.ok(v.m > 10 && v.m <= 18, 'ventania ' + v.m);
  assert.ok(br.m > 0 && br.m <= 5, 'brisa reduzida ' + br.m);
  assert.ok(vr.m > 5 && vr.m <= 9, 'ventania reduzida ' + vr.m);
  assert.ok(max(VENTANIA, false, 'chuva').m > 0, 'na chuva também voam folhas');
});
test('folha de 3×2 px de arte com 1 px mais escuro, girando por função do tempo', function () {
  FX.FOLHA.quadros.forEach(function (q, k) {
    assert.strictEqual(q.length, 2, 'quadro ' + k + ': 2 linhas');
    q.forEach(function (l) { assert.strictEqual(l.length, 3, 'quadro ' + k + ': 3 colunas'); });
    assert.strictEqual(q.join('').split('d').length - 1, 1, 'quadro ' + k + ': 1 px escuro');
  });
  var escuras = {}; FX.FOLHA.escuras.forEach(function (c) { escuras[c] = true; });
  var claras = {}; FX.FOLHA.cores.forEach(function (c) { claras[c] = true; });
  var assinaturas = {};
  for (var t = 0; t < 3; t += 0.05) {
    var d = desenha(nat({ weather: 'chuva', wind: BRISA, t: t, camada: 'frente' }));   // na chuva não há grão de poeira: só folhas
    var nEsc = d.c.rects.filter(function (q) { return escuras[q.cor]; }).length;
    assert.strictEqual(nEsc, d.st.folhas, 't ' + t.toFixed(2) + ': um px escuro por folha (' + nEsc + ' de ' + d.st.folhas + ')');
    // a primeira folha desenhada: os retângulos claros até o escuro, relativos ao escuro
    var rs = d.c.rects.filter(function (q) { return claras[q.cor] || escuras[q.cor]; }), fim = 0;
    while (fim < rs.length && !escuras[rs[fim].cor]) fim++;
    if (fim < rs.length) {
      var e = rs[fim];
      assinaturas[rs.slice(0, fim).map(function (q) { return [(q.x - e.x) / 3, (q.y - e.y) / 3, q.w / 3, q.h / 3].join(','); }).join('|')] = true;
      rs.slice(0, fim + 1).forEach(function (q) {   // dentro de uma caixa de 3×2 px de arte (P = 3)
        assert.ok(Math.abs(q.x - e.x) <= 6 && Math.abs(q.y - e.y) <= 3 && q.w <= 9 && q.h <= 6, 'folha maior que 3×2: ' + JSON.stringify(q));
      });
    }
  }
  assert.ok(Object.keys(assinaturas).length >= 3, 'a folha gira (quadros vistos: ' + Object.keys(assinaturas).length + ')');
});
// pingos agrupados como a tela desenha: longe = 3 retângulos, perto = 5; cabeça = o 1º de cada grupo
function pingos(rects) {
  var out = [];
  for (var i = 0; i < rects.length; i++) {
    var q = rects[i], n = q.cor === FX.RAIN.corLonge ? 3 : q.cor === FX.RAIN.corPerto ? 5 : 0;
    if (!n) continue;
    out.push({ x: q.x, y: q.y, cor: q.cor }); i += n - 1;
  }
  return out;
}
test('chuva: em reduced cada pingo anda 40 % do que anda em completas (deslocamento medido)', function () {
  var o = { weather: 'chuva', wind: VENTANIA, W: 1200, H: 900, P: 1, laneTop: 400, trackBottom: 880, seed: 31, camada: 'frente' };
  function em(t, red) { var x = {}, k; for (k in o) x[k] = o[k]; x.t = t; x.reduced = red; var c = ctxNat(); FX.drawNature(c, x); return pingos(c.rects); }
  var dt = 0.04;
  var f0 = em(0, false), f1 = em(dt, false), r0 = em(0, true), r1 = em(dt, true);
  assert.strictEqual(f0.length, f1.length); assert.strictEqual(r0.length, r1.length);
  // em t = 0 o mesmo pingo está no mesmo lugar nos dois modos: casa os do reduced com os do completo
  var porLugar = {};
  f0.forEach(function (p, i) { porLugar[p.x + ',' + p.y + ',' + p.cor] = i; });
  var razoes = [], incl = [];
  r0.forEach(function (p, i) {
    var j = porLugar[p.x + ',' + p.y + ',' + p.cor];
    if (j == null) return;
    var dyF = f1[j].y - f0[j].y, dyR = r1[i].y - r0[i].y;
    if (dyF <= 0 || dyR <= 0) return;                 // passou pela borda (a tela se repete): fora da conta
    razoes.push(dyR / dyF); incl.push((f1[j].x - f0[j].x) / dyF);
  });
  assert.ok(razoes.length > 40, 'pingos casados: ' + razoes.length);
  razoes.sort(function (a, b) { return a - b; }); incl.sort(function (a, b) { return a - b; });
  var med = razoes[razoes.length >> 1], medI = incl[incl.length >> 1];
  assert.ok(Math.abs(med - 0.4) <= 0.03, 'reduced anda ' + (100 * med).toFixed(1) + ' % do completo');
  assert.ok(Math.abs(medI - FX.rainSlant(VENTANIA)) <= 0.05, 'cai inclinado pelo vento: dx/dy ' + medI.toFixed(3));
});
test('sol por piso: calor e poeira com tom e alfa próprios; na areia a poeira tem borda mais escura', function () {
  function cor1(surface) {
    var d = desenha(nat({ weather: 'sol', wind: CALMO, t: 1, camada: 'tras', surface: surface }));
    assert.ok(d.st.calor > 0, surface + ': calor');
    return d.c.rects[0].cor;
  }
  var ca = cor1('areia'), ct = cor1('terra');
  assert.notStrictEqual(ca, ct, 'calor da areia ≠ da terra');
  var aA = Number(ca.replace(/.*,([\d.]+)\)$/, '$1')), aT = Number(ct.replace(/.*,([\d.]+)\)$/, '$1'));
  assert.ok(aA >= 0.3, 'calor na areia mais forte: ' + ca);
  function lum(c) { var m = c.match(/rgba\((\d+),(\d+),(\d+)/); return 0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]; }
  var a = ctxNat(), t = ctxNat();
  FX.drawHoofDust(a, 100, 200, 3, 0.4, 'areia'); FX.drawHoofDust(t, 100, 200, 3, 0.4, 'terra');
  var cores = {}; a.rects.forEach(function (q) { cores[q.cor.replace(/,[\d.]+\)$/, ')')] = true; });
  var cs = Object.keys(cores);
  assert.strictEqual(cs.length, 2, 'areia: miolo e borda ' + cs.join(' '));
  cs.sort(function (x, y) { return lum(x) - lum(y); });
  assert.ok(lum(cs[1]) - lum(cs[0]) > 60, 'borda bem mais escura que o miolo ' + cs.join(' '));
  assert.ok(t.rects.length < a.rects.length, 'terra sem a borda');
  assert.ok(aT > 0, 'terra com calor');
});
test('poeira: nasce atrás do casco (x − 1 px de arte) e só desbota da metade da vida em diante', function () {
  var S = 3, alfas = [];
  for (var k = 0; k < 20; k++) {
    var c = ctxNat(), t = k / 20 / 2.4;              // uma volta do ciclo da nuvenzinha 0 (ph = k/20)
    FX.drawHoofDust(c, 100, 200, S, t, 'terra', true);   // reduced: uma só (ph = frac(t·2,4·0,4))
    var q = c.rects[c.rects.length - 1];
    alfas.push({ ph: frac04(t), a: Number(q.cor.replace(/.*,([\d.]+)\)$/, '$1')), x: q.x + q.w });
  }
  function frac04(t) { var v = t * 2.4 * 0.4; return v - Math.floor(v); }
  alfas.forEach(function (p) {
    assert.ok(p.x <= 100, 'a nuvenzinha não passa do casco (borda direita ' + p.x + ')');
    if (p.ph < 0.5) assert.ok(Math.abs(p.a - alfas[0].a) < 1e-9, 'alfa cheio até a metade (ph ' + p.ph.toFixed(2) + ': ' + p.a + ')');
  });
});
test('teto de partículas por tela (tela enorme, P = 1)', function () {
  ['sol', 'chuva', 'nevoa', 'nublado'].forEach(function (w) {
    for (var t = 0; t < 3; t += 0.37) {
      var d = desenha({ weather: w, wind: VENTANIA, t: t, W: 6000, H: 3000, P: 1, laneTop: 1000, trackBottom: 2800, seed: 5 });
      assert.ok(d.st.pingos <= FX.NATUREZA.pingosMax, w + ' pingos ' + d.st.pingos);
      assert.ok(d.st.respingos <= FX.NATUREZA.respingosMax, w + ' respingos ' + d.st.respingos);
      assert.ok(d.st.folhas <= FX.NATUREZA.folhas.ventania, w + ' folhas ' + d.st.folhas);
      assert.ok(d.c.rects.length <= FX.NATUREZA.retangulosMax, w + ' retângulos ' + d.c.rects.length);
    }
  });
});
test('drawNature não conta nas partículas de efeito (skills e Dado)', function () {
  var d = desenha(nat({ weather: 'chuva', wind: VENTANIA, t: 2 }));
  assert.ok(d.st.pingos > 0);
  assert.strictEqual(FX._stats.particulas, 0);
});
test('drawHoofDust: só em terra ou areia; menos em reduced; função do tempo', function () {
  FX.resetStats(true);
  var g = ctxNat();
  assert.strictEqual(FX.drawHoofDust(g, 100, 200, 3, 1.2, 'grama'), 0);
  assert.strictEqual(g.rects.length, 0);
  var a = ctxNat(), b = ctxNat(), r = ctxNat();
  var na = FX.drawHoofDust(a, 100, 200, 3, 1.2, 'terra'), nb = FX.drawHoofDust(b, 100, 200, 3, 1.2, 'terra');
  assert.ok(na > 0 && na === nb); assert.deepStrictEqual(a.rects, b.rects);
  assert.ok(FX.drawHoofDust(ctxNat(), 100, 200, 3, 1.2, 'areia') > 0);
  var nr = FX.drawHoofDust(r, 100, 200, 3, 1.2, 'terra', true);
  assert.ok(nr > 0 && nr < na, 'reduced com menos ' + nr + ' < ' + na);
  a.rects.forEach(function (q) { assert.ok(q.x < 100 + 3 * 3 && q.y <= 200, 'poeira atrás e acima do casco'); });
});
FX.resetStats(true);

section('traçado de cima e curvas na pista');
// blocos contíguos a partir de 0: [tipo, de, até]
function blocos(lista) { return lista.map(function (b) { return { type: b[0], from: b[1], to: b[2] }; }); }
function giroEsperado(len) { return Math.max(45, Math.min(180, len / 150 * 90)); }
// rumo (graus, anti-horário na tela: y para baixo) de cada trecho entre pontos consecutivos
function rumos(pts) {
  var out = [];
  for (var k = 0; k + 1 < pts.length; k++) out.push(Math.atan2(-(pts[k + 1][1] - pts[k][1]), pts[k + 1][0] - pts[k][0]) * 180 / Math.PI);
  return out;
}
function giroEm(h, k) { var d = h[k] - h[k - 1]; while (d > 180) d -= 360; while (d <= -180) d += 360; return d; }
// curva curta (45° pelo piso), média (90°), subida (não gira), longa (180° pelo teto) e retas
var MISTA = blocos([['reta', 0, 100], ['curva', 100, 150], ['reta', 150, 300], ['curva', 300, 450], ['subida', 450, 600],
  ['curva', 600, 1000], ['reta', 1000, 1100]]);

test('trackPath: giroTotal = soma dos giros das curvas (45° a 180°) e o último rumo é esse giro', function () {
  var p = FX.trackPath(MISTA);
  var soma = MISTA.filter(function (b) { return b.type === 'curva'; }).reduce(function (s, b) { return s + giroEsperado(b.to - b.from); }, 0);
  assert.strictEqual(soma, 45 + 90 + 180);
  assert.ok(Math.abs(p.giroTotal - soma) < 1e-9, 'giroTotal ' + p.giroTotal + ' (esperado ' + soma + ')');
  var h = rumos(p.pts), ultimo = ((h[h.length - 1] % 360) + 360) % 360;
  assert.ok(Math.abs(ultimo - soma % 360) < 1e-6, 'último rumo ' + ultimo);
  // um ponto a cada 10 m, a começar em (0, 0), rumo inicial 0° (para a direita)
  assert.strictEqual(p.pts.length, 1100 / 10 + 1);
  assert.deepStrictEqual(p.pts[0], [0, 0]);
  assert.ok(Math.abs(h[0]) < 1e-9 && p.pts[1][0] > 0, 'rumo inicial 0°');
  for (var k = 1; k < p.pts.length; k++) {
    var d = Math.hypot(p.pts[k][0] - p.pts[k - 1][0], p.pts[k][1] - p.pts[k - 1][1]);
    assert.ok(Math.abs(d - 10) < 1e-9, 'passo ' + k + ' de ' + d + ' m');
  }
  // segs: um por bloco, com o tipo e os índices dos pontos das pontas; bbox cobre todos os pontos
  assert.deepStrictEqual(p.segs.map(function (s) { return [s.type, s.i0, s.i1]; }),
    [['reta', 0, 10], ['curva', 10, 15], ['reta', 15, 30], ['curva', 30, 45], ['subida', 45, 60], ['curva', 60, 100], ['reta', 100, 110]]);
  p.pts.forEach(function (q) { assert.ok(q[0] >= p.bbox.x0 - 1e-9 && q[0] <= p.bbox.x1 + 1e-9 && q[1] >= p.bbox.y0 - 1e-9 && q[1] <= p.bbox.y1 + 1e-9); });
});
test('trackPath: uma pista só de retas tem giroTotal 0 e pontos colineares', function () {
  var p = FX.trackPath(blocos([['reta', 0, 400], ['reta', 400, 1000], ['reta', 1000, 1600]]));
  assert.strictEqual(p.giroTotal, 0);
  assert.strictEqual(p.pts.length, 161);
  p.pts.forEach(function (q, k) { assert.ok(Math.abs(q[1]) < 1e-9 && Math.abs(q[0] - 10 * k) < 1e-9, 'ponto ' + k + ' = ' + q); });
  assert.ok(Math.abs(p.bbox.y1 - p.bbox.y0) < 1e-9 && Math.abs(p.bbox.x1 - 1600) < 1e-9);
});
test('trackPath: os pontos que giram estão nos trechos de curva, e todo ponto de dentro da curva gira (anti-horário)', function () {
  var p = FX.trackPath(MISTA), h = rumos(p.pts);
  var curvas = MISTA.filter(function (b) { return b.type === 'curva'; });
  var porCurva = curvas.map(function () { return 0; });
  for (var k = 1; k < p.pts.length - 1; k++) {
    var g = giroEm(h, k), m = p.ms[k];
    var dentro = -1;
    curvas.forEach(function (c, ci) { if (m >= c.from && m <= c.to) dentro = ci; });
    if (Math.abs(g) > 1e-9) {
      assert.ok(dentro >= 0, 'o ponto de ' + m + ' m gira ' + g.toFixed(3) + '° fora de uma curva');
      assert.ok(g > 0, 'giro anti-horário em ' + m + ' m');
      porCurva[dentro] += g;
    }
    curvas.forEach(function (c) { if (m > c.from && m < c.to) assert.ok(g > 1e-9, 'o ponto de ' + m + ' m (dentro da curva ' + c.from + '–' + c.to + ') não gira'); });
  }
  curvas.forEach(function (c, ci) { assert.ok(Math.abs(porCurva[ci] - giroEsperado(c.to - c.from)) < 1e-6, 'curva ' + c.from + '–' + c.to + ': ' + porCurva[ci]); });
  // o giro de uma curva é distribuído igualmente pelos pontos dela
  var c2 = p.segs[3], gs = [];
  for (var q = c2.i0 + 1; q < c2.i1; q++) gs.push(giroEm(h, q));
  gs.forEach(function (g) { assert.ok(Math.abs(g - 90 / 15) < 1e-6, 'giro por ponto ' + g); });
});
test('trackPath: o traçado do DEV "curvas" e uma corrida de verdade têm um ponto por 10 m até a chegada', function () {
  var sim = C1.sim, bl = sim.conditions.blocks, D = sim.conditions.distance;
  var p = FX.trackPath(bl);
  assert.strictEqual(p.ms[0], 0); assert.strictEqual(p.ms[p.ms.length - 1], D);
  assert.strictEqual(p.segs.length, bl.length);
  var DEV = require('../src/dev.js');
  var dv = DEV.conditions({ tracado: 'curvas', distance: 1600 });
  var pd = FX.trackPath(dv.blocks);
  assert.strictEqual(pd.pts.length, 161);
  // os 5 blocos de curva do meio são colados: no desenho viram UMA curva (um U de 180°, não 684°)
  assert.strictEqual(dv.blocks.filter(function (b) { return b.type === 'curva'; }).length, 5);
  assert.ok(Math.abs(pd.giroTotal - 180) < 1e-6, 'DEV curvas: ' + pd.giroTotal + ' (esperado 180)');
  assert.strictEqual(pd.segs.length, 7, 'segs continua um por bloco');
});
test('curveRuns: junta curvas coladas (|Δ| < 1e-6), separa as que têm reta no meio e não muta a entrada', function () {
  var ent = [[100, 200], [200, 300], [300 + 1e-9, 360], [400, 500], [600, 700]];
  var antes = JSON.stringify(ent);
  var r = FX.curveRuns(ent);
  assert.deepStrictEqual(r, [[100, 360], [400, 500], [600, 700]]);
  assert.strictEqual(JSON.stringify(ent), antes, 'entrada intacta');
  r.forEach(function (q) { ent.forEach(function (e) { assert.notStrictEqual(q, e, 'devolve cópias'); }); });
  assert.deepStrictEqual(FX.curveRuns([[100, 200], [250, 300]]), [[100, 200], [250, 300]], 'reta de 50 m no meio');
  assert.deepStrictEqual(FX.curveRuns([[100, 200], [200.001, 300]]), [[100, 200], [200.001, 300]], 'vão de 1 mm não junta');
  assert.deepStrictEqual(FX.curveRuns([]), []);
  assert.deepStrictEqual(FX.curveRuns(null), []);
  assert.deepStrictEqual(FX.curveRuns(undefined), []);
});
test('trackPath: curvas coladas giram pela sequência — 2×60 m dão 72° (não 90°), 3×150 m dão 180° (não 270°)', function () {
  var p2 = FX.trackPath(blocos([['reta', 0, 100], ['curva', 100, 160], ['curva', 160, 220], ['reta', 220, 300]]));
  assert.ok(Math.abs(p2.giroTotal - 72) < 1e-9, '2×60 m: ' + p2.giroTotal);
  // o giro é distribuído por metro na sequência: 72° em 120 m = 6° a cada passo de 10 m, nos dois blocos
  var h = rumos(p2.pts);
  for (var k = 11; k < 22; k++) assert.ok(Math.abs(giroEm(h, k) - 6) < 1e-6, 'giro no ponto ' + k + ': ' + giroEm(h, k));
  assert.strictEqual(p2.segs.length, 4, 'segs: um por bloco');
  var p3 = FX.trackPath(blocos([['reta', 0, 100], ['curva', 100, 250], ['curva', 250, 400], ['curva', 400, 550], ['reta', 550, 700]]));
  assert.ok(Math.abs(p3.giroTotal - 180) < 1e-9, '3×150 m: ' + p3.giroTotal);
  var h3 = rumos(p3.pts), ult = ((h3[h3.length - 1] % 360) + 360) % 360;
  assert.ok(Math.abs(ult - 180) < 1e-6, 'sai na direção oposta: ' + ult);
  // duas sequências separadas por uma reta contam cada uma (60 m ⇒ 45° pelo piso; 2×100 m ⇒ 120°)
  var p4 = FX.trackPath(blocos([['curva', 0, 60], ['reta', 60, 100], ['curva', 100, 200], ['curva', 200, 300]]));
  assert.ok(Math.abs(p4.giroTotal - (45 + 120)) < 1e-9, 'duas sequências: ' + p4.giroTotal);
});
test('curveOffset: curvas coladas são uma só — ≠ 0 e contínuo na fronteira interna, igual ao das sequências', function () {
  var porBloco = [[100, 200], [200, 300]];
  assert.ok(FX.curveOffset(porBloco, 200) < -5.99, 'na fronteira interna: ' + FX.curveOffset(porBloco, 200));
  for (var e = 1; e <= 8; e *= 2) {
    var a = FX.curveOffset(porBloco, 200 - e / 100), b = FX.curveOffset(porBloco, 200 + e / 100);
    assert.ok(Math.abs(a - b) < 1e-3 && a < -5.9, 'contínuo em 200 ± ' + e / 100 + ': ' + a + ' / ' + b);
  }
  var runs = FX.curveRuns(porBloco);
  for (var m = 90; m <= 310; m += 2.5) assert.strictEqual(FX.curveOffset(porBloco, m), FX.curveOffset(runs, m), 'em ' + m + ' m');
  assert.strictEqual(FX.curveOffset(porBloco, 100), 0); assert.strictEqual(FX.curveOffset(porBloco, 300), 0);
});
test('curveOffset: platô em sequências longas (R = 120 m), igual a −6·sen(πu) até 240 m', function () {
  var longa = [[100, 400], [400, 700]];   // sequência de 600 m
  for (var m = 220; m <= 580; m += 10) assert.strictEqual(FX.curveOffset(longa, m), -6, 'platô em ' + m + ' m');
  assert.ok(Math.abs(FX.curveOffset(longa, 160) - -6 * Math.sin(Math.PI / 4)) < 1e-9, 'meia rampa na entrada');
  assert.ok(Math.abs(FX.curveOffset(longa, 640) - -6 * Math.sin(Math.PI / 4)) < 1e-9, 'meia rampa na saída');
  for (var x = 0; x <= 120; x += 7.5) {
    var ent = FX.curveOffset(longa, 100 + x), sai = FX.curveOffset(longa, 700 - x);
    assert.ok(Math.abs(ent - sai) < 1e-9, 'simétrico em ±' + x);
    if (x > 0) assert.ok(ent <= FX.curveOffset(longa, 100 + x - 7.5), 'a rampa só desce');
  }
  // até 240 m o perfil é o de sempre (R = metade da sequência)
  [[0, 240], [0, 120], [50, 110]].forEach(function (c) {
    for (var u = 0.05; u < 1; u += 0.1) {
      var mm = c[0] + u * (c[1] - c[0]);
      assert.ok(Math.abs(FX.curveOffset([c], mm) - -6 * Math.sin(Math.PI * u)) < 1e-9, JSON.stringify(c) + ' u=' + u);
    }
  });
  assert.strictEqual(FX.CURVA.rampa, 120);
});
test('pathAt: posição no traçado por metro (pontas e meio de um passo)', function () {
  var p = FX.trackPath(MISTA);
  assert.deepStrictEqual(FX.pathAt(p, 0), p.pts[0]);
  assert.deepStrictEqual(FX.pathAt(p, -50), p.pts[0], 'antes da largada fica na largada');
  assert.deepStrictEqual(FX.pathAt(p, 1100), p.pts[p.pts.length - 1]);
  assert.deepStrictEqual(FX.pathAt(p, 5000), p.pts[p.pts.length - 1], 'depois da chegada fica na chegada');
  var a = FX.pathAt(p, 315), m0 = p.pts[31], m1 = p.pts[32];
  assert.ok(Math.abs(a[0] - (m0[0] + m1[0]) / 2) < 1e-9 && Math.abs(a[1] - (m0[1] + m1[1]) / 2) < 1e-9);
});
test('curveOffset: 0 fora das curvas (e nas pontas), −6 no meio e simétrico', function () {
  var curvas = [[100, 300], [600, 700]];
  [0, 50, 99.9, 100, 300, 300.1, 450, 599, 600, 700, 1200].forEach(function (m) { assert.strictEqual(FX.curveOffset(curvas, m), 0, 'em ' + m + ' m'); });
  assert.strictEqual(FX.curveOffset(curvas, 200), -6);
  assert.strictEqual(FX.curveOffset(curvas, 650), -6);
  assert.strictEqual(FX.curveOffset([], 200), 0);
  assert.strictEqual(FX.curveOffset(null, 200), 0);
  for (var x = 1; x < 100; x += 7.3) {
    var a = FX.curveOffset(curvas, 100 + x), b = FX.curveOffset(curvas, 300 - x);
    assert.ok(a < 0 && Math.abs(a - b) < 1e-9, 'simetria em ±' + x + ': ' + a + ' / ' + b);
    assert.ok(a >= -6 && a > FX.curveOffset(curvas, 200) - 1e-12);
    assert.ok(Math.abs(a - -6 * Math.sin(Math.PI * x / 200)) < 1e-9, 'forma −6·sen(πu)');
  }
  assert.strictEqual(FX.CURVA.arco, 6); assert.strictEqual(FX.CURVA.arquibancada, 10);
});

// desenho do traçado com o contexto falso (só fillRect)
var BOX_MAPA = { x: 4, y: 3, w: 60, h: 30, P: 2 };
function dentroDaCaixa(r, b) { return r.x >= b.x * b.P && r.y >= b.y * b.P && r.x + r.w <= (b.x + b.w) * b.P && r.y + r.h <= (b.y + b.h) * b.P; }
test('drawTrackMap: o traçado cabe na caixa, com retas na cor do piso, curvas e subidas nas cores do tipo, largada e chegada', function () {
  var p = FX.trackPath(MISTA), c = ctxFalso();
  var r = FX.drawTrackMap(c, p, BOX_MAPA, { piso: '#9a6b3f' });
  assert.ok(c.rects.length > 20);
  c.rects.forEach(function (q) { assert.ok(dentroDaCaixa(q, BOX_MAPA), 'retângulo fora da caixa ' + JSON.stringify(q)); });
  var cs = cores(c);
  assert.ok(cs['#9a6b3f'] && cs[G.BLOCK_TYPES.curva.color] && cs[G.BLOCK_TYPES.subida.color], 'cores ' + Object.keys(cs));
  // traçado em pixels inteiros (múltiplos de P) e a largada / chegada devolvidas em pixels de arte
  c.rects.forEach(function (q) { assert.ok(q.x % 2 === 0 && q.y % 2 === 0 && q.w % 2 === 0 && q.h % 2 === 0, 'fora da grade ' + JSON.stringify(q)); });
  assert.ok(r && r.largada && r.chegada, JSON.stringify(r));
  assert.ok(Math.hypot(r.largada[0] - r.chegada[0], r.largada[1] - r.chegada[1]) > 5, 'largada e chegada separadas');
  // linha de 2–3 px de arte (padrão 2; opts.linha 3)
  var grosso = ctxFalso();
  FX.drawTrackMap(grosso, p, BOX_MAPA, { piso: '#9a6b3f', linha: 3 });
  assert.ok(grosso.rects.some(function (q) { return q.w === 6 && q.h === 6; }), 'linha de 3 px');
});
test('drawMiniMap: um ponto por cavalo na cor da raia, o seu maior e com contorno; marca _stats.minimapa', function () {
  FX.resetStats(true);
  assert.strictEqual(FX._stats.minimapa, false);
  var p = FX.trackPath(MISTA), c = ctxFalso();
  var posM = [120, 500, 500, 1050], me = 2;
  var pts = FX.drawMiniMap(c, p, posM, CORES.slice(0, 4), me, BOX_MAPA);
  assert.strictEqual(FX._stats.minimapa, true);
  assert.strictEqual(pts.length, 4);
  pts.forEach(function (q) { assert.ok(q.x >= BOX_MAPA.x && q.y >= BOX_MAPA.y && q.x + q.tam <= BOX_MAPA.x + BOX_MAPA.w && q.y + q.tam <= BOX_MAPA.y + BOX_MAPA.h, JSON.stringify(q)); });
  var meu = pts.filter(function (q) { return q.racer === me; })[0], outro = pts.filter(function (q) { return q.racer === 1; })[0];
  assert.ok(meu.tam > outro.tam, 'o seu é maior: ' + meu.tam + ' > ' + outro.tam);
  assert.ok(meu.contorno && !outro.contorno);
  for (var j = 0; j < 4; j++) assert.ok(c.rects.some(function (q) { return q.cor === CORES[j]; }), 'ponto do cavalo ' + j + ' na cor da raia');
  // o seu é o último desenhado (por cima)
  var ultimoCor = null;
  c.rects.forEach(function (q) { if (CORES.slice(0, 4).indexOf(q.cor) >= 0) ultimoCor = q.cor; });
  assert.strictEqual(ultimoCor, CORES[me]);
  // mesma posição ⇒ mesmo lugar no mapa; quem está mais à frente fica onde o traçado leva
  var o1 = pts.filter(function (q) { return q.racer === 1; })[0];
  assert.ok(Math.abs((o1.x + o1.tam / 2) - (meu.x + meu.tam / 2)) <= 1 && Math.abs((o1.y + o1.tam / 2) - (meu.y + meu.tam / 2)) <= 1, 'cavalos no mesmo metro no mesmo ponto');
  FX.resetStats(true);
  assert.strictEqual(FX._stats.minimapa, false, 'beginFrame zera');
});

section('skill de tipo na pista (aura, balão e terços do minimapa)');
var TS_MEIO = { id: 'raizes-firmes', name: 'Raízes Firmes', from: 1400 / 3, to: 2800 / 3 };
test('typeZone: null antes e depois do terço; 0, 0,5 e perto de 1 dentro dele', function () {
  var a = TS_MEIO.from, b = TS_MEIO.to;
  assert.strictEqual(FX.typeZone(TS_MEIO, a - 0.01), null, 'antes');
  assert.strictEqual(FX.typeZone(TS_MEIO, 0), null, 'na largada');
  assert.strictEqual(FX.typeZone(TS_MEIO, b), null, 'no fim (o terço é [from, to))');
  assert.strictEqual(FX.typeZone(TS_MEIO, b + 50), null, 'depois');
  assert.strictEqual(FX.typeZone(TS_MEIO, a), 0, 'na entrada');
  assert.ok(Math.abs(FX.typeZone(TS_MEIO, (a + b) / 2) - 0.5) < 1e-9, 'no meio');
  var quase = FX.typeZone(TS_MEIO, b - 0.01);
  assert.ok(quase > 0.99 && quase < 1, 'perto do fim ' + quase);
  // sem skill de tipo, ou dado torto: nunca dentro
  [null, undefined, {}, { from: 10, to: 10 }, { from: 20, to: 10 }, { from: 'x', to: 50 }].forEach(function (ts) {
    assert.strictEqual(FX.typeZone(ts, 15), null, JSON.stringify(ts));
  });
  assert.strictEqual(FX.typeZone(TS_MEIO, NaN), null, 'posição inválida');
});
test('timeline: o evento typeSkill vira balão de skill com o nome curto e o elemento da skill de tipo', function () {
  var C = corrida(4242), tl = FX.timeline(C.sim, C.racers, 3);
  var evs = C.sim.events.filter(function (e) { return e.type === 'skill' && e.typeSkill; });
  var its = tl.filter(function (it) { return it.kind === 'skill' && it.typeSkill; });
  assert.ok(evs.length >= 3, 'a corrida tem skills de tipo: ' + evs.length);
  assert.strictEqual(its.length, evs.length);
  var vistos = {};
  its.forEach(function (it, k) {
    var ev = evs[k], el = C.racers[it.racer].horse.element, def = G.TYPE_SKILLS[el];
    assert.strictEqual(it.t0, ev.t); assert.strictEqual(it.racer, ev.racer);
    assert.strictEqual(it.skillId, def.id); assert.strictEqual(it.nome, def.name);
    assert.strictEqual(it.nomeCurto, def.short, 'nome curto do catálogo: ' + it.nomeCurto);
    assert.strictEqual(it.element, el); assert.strictEqual(it.cavalo, el);
    assert.strictEqual(it.icon, { fogo: 'chama', grama: 'folha', agua: 'onda' }[el]);
    assert.ok(it.t1 > it.t0, 'dura algo');
    // a tela usa a mesma resolução para a aura (typeSkillOf): mesmo elemento e mesmo terço do balão
    var tso = FX.typeSkillOf(C.sim, it.racer, C.racers[it.racer].horse);
    assert.strictEqual(tso.el, it.element); assert.strictEqual(tso.from, it.from); assert.strictEqual(tso.to, it.to);
    vistos[el] = true;
  });
  assert.deepStrictEqual(Object.keys(vistos).sort(), ['agua', 'fogo', 'grama'], 'os três tipos');
  // quem não tem skill de tipo (racerInfo.typeSkill null) não ganha item
  C.sim.racerInfo.forEach(function (ri, i) {
    var n = its.filter(function (it) { return it.racer === i; }).length;
    assert.strictEqual(n, ri.typeSkill ? 1 : 0, 'corredor ' + i);
  });
  // o balão desenha o nome curto
  FX.resetStats(true);
  var c = ctxFalso();
  assert.ok(FX.drawBalloon(c, 10, 10, 2, its[0], its[0].t0 + 0.2, 0));
  assert.ok(c.rects.length > 20, 'ícone e texto');
  assert.strictEqual(FX.balloonSize(its[0], 0).w, FX.balloonSize({ kind: 'skill', nomeCurto: G.TYPE_SKILLS[its[0].element].short }, 0).w, 'largura do nome curto');
  FX.resetStats(true);
});
test('timeline: cavalo de elemento desconhecido não ganha skill de tipo nem item (sem erro)', function () {
  var hs = G.STARTERS.slice(0, 2).map(cl);
  hs[1].element = 'neutro';
  var racers = hs.map(function (h, i) { return { horse: h, gear: null, name: 'r' + i, isPlayer: i === 0, silks: CORES[i] }; });
  var sim = S.simulate({ seed: 7, recordFrames: true, racers: racers });
  assert.strictEqual(sim.racerInfo[1].typeSkill, null);
  var tl = FX.timeline(sim, racers, 1);
  assert.strictEqual(tl.filter(function (it) { return it.typeSkill && it.racer === 1; }).length, 0);
  assert.strictEqual(FX.typeSkillOf(sim, 1, racers[1].horse), null, 'sem skill de tipo, sem aura');
  assert.strictEqual(tl.filter(function (it) { return it.typeSkill && it.racer === 0; }).length, 1);
});
function auraEm(el, t, red, S0) {
  var c = ctxFalso(), S2 = S0 || 2, antes = Math.random;
  Math.random = function () { throw new Error('Math.random na aura'); };
  var ok;
  try { ok = FX.drawTypeAura(c, el, 100, 60, S2, t, red); } finally { Math.random = antes; }
  c.ok = ok;
  return c;
}
test('drawTypeAura: até 30 fillRect por cavalo, na cor do elemento, em pixels inteiros, sem transparência nem Math.random', function () {
  ['fogo', 'grama', 'agua'].forEach(function (el) {
    var formas = {};
    for (var t = 0; t < 6; t += 0.05) {
      FX.resetStats(true);
      var c = auraEm(el, t, false, 2);
      assert.strictEqual(c.ok, true, el + ' desenhou');
      assert.strictEqual(FX._stats.auras, 1, el + ' conta em _stats.auras');
      assert.strictEqual(FX._stats.particulas, 0, el + ' não conta como partícula de skill de vaga');
      assert.ok(c.rects.length > 4 && c.rects.length <= 30, el + ' t=' + t.toFixed(2) + ': ' + c.rects.length + ' fillRect');
      assert.ok(c.rects.some(function (r) { return r.cor === FX.ELEM[el]; }), el + ' usa a cor do elemento');
      c.rects.forEach(function (r) {
        assert.ok(r.a === 1, el + ' sem transparência parcial');
        assert.ok(/^#[0-9a-f]{6}$/i.test(r.cor), el + ' cor sólida: ' + r.cor);
        assert.ok(r.x % 2 === 0 && r.y % 2 === 0 && r.w % 2 === 0 && r.h % 2 === 0 && r.w > 0 && r.h > 0, el + ' fora da grade ' + JSON.stringify(r));
      });
      formas[JSON.stringify(c.rects)] = true;
    }
    assert.ok(Object.keys(formas).length > 10, el + ' anima com o tempo: ' + Object.keys(formas).length + ' formas');
    // função do tempo: mesmo t, mesmos retângulos
    assert.deepStrictEqual(auraEm(el, 2.37, false).rects, auraEm(el, 2.37, false).rects, el + ' determinístico');
  });
  FX.resetStats(true);
});
test('drawTypeAura: cada elemento tem a sua forma (chamas nos cascos, folhas e raízes por baixo, onda atrás)', function () {
  var S2 = 2, x0 = 100, y0 = 60, chao = y0 + 32 * S2;
  function caixa(c) {
    var b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
    c.rects.forEach(function (r) { b.x0 = Math.min(b.x0, r.x); b.x1 = Math.max(b.x1, r.x + r.w); b.y0 = Math.min(b.y0, r.y); b.y1 = Math.max(b.y1, r.y + r.h); });
    return b;
  }
  var fogo = auraEm('fogo', 1.3, false), grama = auraEm('grama', 1.3, false), agua = auraEm('agua', 1.3, false);
  // nada sobe até o corpo e o jóquei (metade de cima do sprite) e nada passa das 3 linhas da raia abaixo dos cascos
  [fogo, grama, agua].forEach(function (c) {
    var b = caixa(c);
    assert.ok(b.y1 <= chao + 3 * S2, 'cabe na raia: ' + JSON.stringify(b));
  });
  assert.ok(caixa(fogo).y0 >= y0 + 16 * S2, 'fogo fica nos cascos');
  // a onda é atrás do cavalo: a maior parte dela à esquerda do casco de trás
  var atras = agua.rects.filter(function (r) { return r.x + r.w <= x0 + 6 * S2; }).length;
  assert.ok(atras >= agua.rects.length / 2, 'onda atrás: ' + atras + ' de ' + agua.rects.length);
  // raízes: algo abaixo da linha dos cascos
  assert.ok(grama.rects.some(function (r) { return r.y >= chao && r.cor !== FX.ELEM.grama; }), 'raízes sob os cascos');
  assert.notDeepStrictEqual(fogo.rects.map(function (r) { return r.cor; }), agua.rects.map(function (r) { return r.cor; }));
});
test('drawTypeAura: movimento reduzido desenha só o contorno na cor do elemento, parado', function () {
  ['fogo', 'grama', 'agua'].forEach(function (el) {
    FX.resetStats(true);
    var a = auraEm(el, 0.5, true), b = auraEm(el, 4.1, true);
    assert.strictEqual(a.ok, true);
    assert.ok(a.rects.length >= 2 && a.rects.length <= 8, el + ' só o contorno: ' + a.rects.length);
    // a cor que identifica o tipo: Fogo e Água na cor do elemento; Grama no marrom da raiz com realce claro
    // (o verde do elemento some no gramado)
    var permitidas = el === 'grama' ? [FX.AURA.grama.raiz, FX.AURA.grama.raizClara] : [FX.ELEM[el]];
    a.rects.forEach(function (r) { assert.ok(permitidas.indexOf(r.cor) >= 0, el + ' contorno na cor do tipo: ' + r.cor); });
    assert.deepStrictEqual(a.rects, b.rects, el + ' sem animação');
    assert.strictEqual(FX._stats.particulas, 0);
    assert.strictEqual(FX._stats.auras, 2);
    // o contorno também está no modo normal (o reduzido só tira o que se mexe)
    var cheio = auraEm(el, 0.5, false);
    a.rects.forEach(function (r) { assert.ok(cheio.rects.some(function (q) { return JSON.stringify(q) === JSON.stringify(r); }), el + ' contorno no normal'); });
  });
  FX.resetStats(true);
});
// contraste (WCAG) contra os pisos em que a pista aparece: GameData.SURFACES e os tons das faixas do gramado,
// da terra e da areia (Sprites, SURF: a, b, dark, lite)
function lumRel(h) {
  var v = [1, 3, 5].map(function (i) { var c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contraste(a, b) { var x = lumRel(a), y = lumRel(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
var PISOS = Object.keys(G.SURFACES).map(function (k) { return G.SURFACES[k].color; })
  .concat(['#5cb44a', '#4ea640', '#3f8f36', '#7ccc5c', '#a46c3e', '#9a6337', '#6e4324', '#c08a58', '#e2c98f', '#d9be82', '#bf9f62', '#f4e4b8']);
var GRAMADO = ['#5fa34a', '#5cb44a', '#4ea640', '#3f8f36', '#7ccc5c'];
test('drawTypeAura Grama: a raiz marrom domina e se destaca em todos os pisos; folhas mais claras que o gramado', function () {
  var A = FX.AURA.grama, area = { raiz: 0, folha: 0, verde: 0 };
  // em todo piso, a raiz (escura com realce claro) tem um dos dois tons a 3:1 ou mais; no gramado, a escura
  PISOS.forEach(function (p) {
    var m = Math.max(contraste(A.raiz, p), contraste(A.raizClara, p));
    assert.ok(m >= 3, 'raiz (escura ou realce) contra ' + p + ': ' + m.toFixed(2));
  });
  GRAMADO.forEach(function (p) { assert.ok(contraste(A.raiz, p) >= 3, 'raiz escura contra o gramado ' + p + ': ' + contraste(A.raiz, p).toFixed(2)); });
  GRAMADO.forEach(function (p) {
    assert.ok(lumRel(A.folha) > lumRel(p) && contraste(A.folha, p) >= 1.8, 'folha mais clara que o gramado ' + p + ': ' + contraste(A.folha, p).toFixed(2));
    assert.ok(contraste(A.raizClara, p) >= 1.6, 'realce da raiz contra ' + p + ': ' + contraste(A.raizClara, p).toFixed(2));
    assert.ok(contraste(A.sombra, p) >= 3, 'sombra da folha contra ' + p);
  });
  for (var t = 0; t < 6; t += 0.1) {
    auraEm('grama', t, false).rects.forEach(function (r) {
      var a = (r.w / 2) * (r.h / 2);
      if (r.cor === A.raiz || r.cor === A.raizClara) area.raiz += a;
      else if (r.cor === A.folha || r.cor === A.sombra) area.folha += a;
      else if (r.cor === FX.ELEM.grama) area.verde += a;
    });
  }
  assert.ok(area.raiz > area.folha + area.verde, 'a raiz é o desenho dominante ' + JSON.stringify(area));
  assert.ok(area.verde > 0, 'o verde do elemento aparece (nas folhas)');
  // o contorno parado (movimento reduzido) tem a raiz escura: contraste ≥ 3 em todos os pisos
  assert.ok(auraEm('grama', 0, true).rects.some(function (r) { return r.cor === A.raiz; }), 'contorno reduzido com a raiz escura');
  FX.resetStats(true);
});
test('drawTypeAura: elemento desconhecido não desenha nada nem conta (sem erro)', function () {
  FX.resetStats(true);
  ['neutro', 'geral', 'xyz', '', null, undefined].forEach(function (el) {
    var c = auraEm(el, 1, false);
    assert.strictEqual(c.ok, false, String(el));
    assert.strictEqual(c.rects.length, 0, String(el));
  });
  assert.strictEqual(FX._stats.auras, 0);
  FX.resetStats(true);
});
test('drawMiniMap: os três terços numa faixa fina (Fogo, Grama, Água nessa ordem), por baixo da linha e dos cavalos', function () {
  FX.resetStats(true);
  var p = FX.trackPath(MISTA), c = ctxFalso();
  var posM = [120, 500, 700, 1050], me = 2;
  FX.drawMiniMap(c, p, posM, CORES.slice(0, 4), me, BOX_MAPA);
  assert.strictEqual(FX._stats.tercos, 3, 'marca os três terços');
  var ordem = [];
  c.rects.forEach(function (q) {
    var el = ['fogo', 'grama', 'agua'].filter(function (e) { return q.cor === FX.ELEM[e]; })[0];
    if (el && ordem[ordem.length - 1] !== el) ordem.push(el);
  });
  assert.deepStrictEqual(ordem, ['fogo', 'grama', 'agua'], 'na ordem da pista');
  // a faixa vem antes do traçado (fica por baixo) e os cavalos vêm por último
  var ultimaFaixa = -1, primeiraLinha = -1, primeiroCavalo = -1;
  c.rects.forEach(function (q, k) {
    if (['fogo', 'grama', 'agua'].some(function (e) { return q.cor === FX.ELEM[e]; })) ultimaFaixa = k;
    if (primeiraLinha < 0 && q.cor === G.BLOCK_TYPES.curva.color) primeiraLinha = k;
    if (primeiroCavalo < 0 && CORES.slice(0, 4).indexOf(q.cor) >= 0) primeiroCavalo = k;
  });
  assert.ok(ultimaFaixa < primeiraLinha && primeiraLinha < primeiroCavalo, 'faixa < traçado < cavalos: ' + [ultimaFaixa, primeiraLinha, primeiroCavalo]);
  // fina: a faixa só aparece 1 pixel de arte para fora da linha (4 px de largura contra os 2 da linha)
  c.rects.filter(function (q) { return q.cor === FX.ELEM.fogo; }).forEach(function (q) { assert.strictEqual(q.w, 4 * BOX_MAPA.P); });
  c.rects.forEach(function (q) { assert.ok(dentroDaCaixa(q, BOX_MAPA), 'fora da caixa ' + JSON.stringify(q)); });
  FX.resetStats(true);
  assert.strictEqual(FX._stats.tercos, 0, 'beginFrame zera');
});

section('medição do quadro');
test('endFrame(ms, agora): msQuadro é a média do JS; intervalo dá mediana e p95 do intervalo real entre quadros', function () {
  FX.resetStats(true);
  assert.deepStrictEqual(FX._stats.intervalo, { med: 0, p95: 0, n: 0 });
  var t = 1000;
  for (var k = 0; k < 100; k++) { t += k % 10 === 9 ? 50 : 16; FX.endFrame(2, t); }
  FX.endFrame(2, t + 5000);   // pausa (aba escondida): fora da conta
  var iv = FX._stats.intervalo;
  assert.strictEqual(iv.n, 60, 'janela de 60');
  assert.strictEqual(iv.med, 16);
  assert.strictEqual(iv.p95, 50);
  assert.strictEqual(FX._stats.msQuadro, 2);
  FX.endFrame(3);   // sem relógio: só o JS
  assert.strictEqual(FX._stats.intervalo.n, 60);
  FX.resetStats(true);
  assert.strictEqual(FX._stats.intervalo.n, 0);
});

section('desenho da pista (Sprites)');
var SPR = require('../src/sprites.js');
test('hachura das subidas: os limites (org, ini, fim) dão os mesmos retângulos do laço antigo (um fillRect por linha e listra)', function () {
  function mod(a, n) { return ((a % n) + n) % n; }
  // o laço que a pista usava, linha a linha: [linha, coluna] de cada retângulo de 3P × P
  function antigo(x0, x1, camPx, P, linhas) {
    var out = [], step = 10 * P;
    for (var r = 0; r < linhas; r++) {
      var shift = mod(-(r * P) + camPx, step);
      for (var hx = x0 - shift + step; hx < x1; hx += step) out.push(r + ',' + Math.round(hx));
    }
    return out;
  }
  function novo(x0, x1, camPx, P, linhas) {
    var h = SPR._hachuraFaixa(x0, x1, camPx, P), out = [];
    for (var r = 0; r < linhas; r++) {
      var o = mod(h.org + r * P, h.passo), s = h.ini + mod(o - h.ini, h.passo);
      for (; s < h.fim; s += h.passo) out.push(r + ',' + s);
    }
    return out;
  }
  var semente = 7, casos = 0;
  function rnd() { semente = (Math.imul(semente, 1103515245) + 12345) >>> 0; return semente / 4294967296; }
  for (var k = 0; k < 4000; k++) {
    var P = 1 + Math.floor(rnd() * 6), x0 = Math.floor(rnd() * 400), x1 = x0 + 1 + Math.floor(rnd() * 900);
    var camPx = k % 5 === 0 ? Math.floor(rnd() * 5000) - 300 : k % 5 === 1 ? Math.floor(rnd() * 5000) + 0.5 : rnd() * 9000 - 500;
    var a = antigo(x0, x1, camPx, P, 40).sort(), b = novo(x0, x1, camPx, P, 40).sort();
    assert.deepStrictEqual(b, a, 'x0 ' + x0 + ' x1 ' + x1 + ' camPx ' + camPx + ' P ' + P);
    casos++;
  }
  assert.strictEqual(casos, 4000);
});

test('hachura das subidas: a pintura com padrão (fillRect + translate) cobre os mesmos pixels do laço antigo, uma vez cada', function () {
  function mod(a, n) { return ((a % n) + n) % n; }
  // contexto falso: grava fillRect, translate e fillStyle; o padrão guarda o canvas do ladrilho
  function ctxGrava() {
    var c = { fillStyle: '', tx: 0, ty: 0, ops: [], rects: [] };
    c.fillRect = function (x, y, w, h) { c.rects.push({ x: x + c.tx, y: y + c.ty, w: w, h: h, est: c.fillStyle, ox: c.tx, oy: c.ty }); c.ops.push('fillRect'); };
    c.translate = function (x, y) { c.tx += x; c.ty += y; c.ops.push('translate'); };
    c.createPattern = function (cv, rep) { assert.strictEqual(rep, 'repeat'); return { ladrilho: cv }; };
    return c;
  }
  var antes = global.OffscreenCanvas;
  global.OffscreenCanvas = function (w, h) { this.width = w; this.height = h; var g = ctxGrava(); this.getContext = function () { return g; }; };
  try {
    // pixels de um ladrilho (os fillRect gravados no canvas dele)
    function pixelsLadrilho(cv) {
      var m = {};
      cv.getContext('2d').rects.forEach(function (r) { assert.strictEqual(r.est, 'rgba(255,255,255,0.07)'); for (var y = r.y; y < r.y + r.h; y++) for (var x = r.x; x < r.x + r.w; x++) m[x + ',' + y] = true; });
      return m;
    }
    var casos = [[37, 913, 1234.56, 2], [0, 400, 0, 3], [120, 150, 77.5, 2], [5, 640, -321.25, 4], [0, 1120, 8000.2, 2], [300, 306, 9.7, 1]];
    casos.forEach(function (cs) {
      var x0 = cs[0], x1 = cs[1], camPx = cs[2], P = cs[3], y = 50, linhas = 23, alt = linhas * P, step = 10 * P;
      var esperado = {};
      for (var r = 0; r < linhas; r++) {
        var shift = mod(-(r * P) + camPx, step);
        for (var hx = x0 - shift + step; hx < x1; hx += step) for (var dy = 0; dy < P; dy++) for (var dx = 0; dx < 3 * P; dx++) esperado[(Math.round(hx) + dx) + ',' + (y + r * P + dy)] = true;
      }
      var c = ctxGrava();
      SPR._hachura(c, SPR._hachuraFaixa(x0, x1, camPx, P), y, alt, P);
      assert.strictEqual(c.tx, 0, 'translate desfeito (x)'); assert.strictEqual(c.ty, 0, 'translate desfeito (y)');
      assert.ok(c.rects.length <= 6 * P + 1, 'até 6P + 1 fillRect: ' + c.rects.length);
      var pintado = {}, dobro = 0;
      c.rects.forEach(function (q) {
        assert.ok(q.est && q.est.ladrilho, 'fillRect com padrão');
        var lad = q.est.ladrilho, px = pixelsLadrilho(lad);
        assert.strictEqual(lad.width, step); assert.strictEqual(lad.height, step);
        for (var yy = q.y; yy < q.y + q.h; yy++) for (var xx = q.x; xx < q.x + q.w; xx++) {
          if (!px[mod(xx - q.ox, step) + ',' + mod(yy - q.oy, step)]) continue;
          var k = xx + ',' + yy;
          if (pintado[k]) dobro++;
          pintado[k] = true;
        }
      });
      assert.strictEqual(dobro, 0, 'nenhum pixel pintado duas vezes (o alfa somaria)');
      var a = Object.keys(esperado).sort(), b = Object.keys(pintado).sort();
      assert.strictEqual(b.length, a.length, 'mesmo número de pixels ' + JSON.stringify(cs));
      assert.deepStrictEqual(b, a, JSON.stringify(cs));
    });
  } finally { if (antes === undefined) delete global.OffscreenCanvas; else global.OffscreenCanvas = antes; }
});

section('Ícones PNG na corrida');
var IMG = { fake: 'img' };
function itemIcone(extra) { var o = {}, k; for (k in ITEM_SKILL) o[k] = ITEM_SKILL[k]; for (k in extra) o[k] = extra[k]; return o; }
test('drawIconPng: no cache e lado·S ≥ 16 ⇒ drawImage(img, x, y, 16, 16) sem suavização', function () {
  FX.setIconImages({ 'sk-arranque': IMG });
  var c = ctxFalso();
  assert.strictEqual(FX.iconImage('sk-arranque'), IMG);
  assert.strictEqual(FX.drawIconPng(c, 'sk-arranque', 5, 7, 8, 2), true);
  assert.deepStrictEqual(c.imgs[0].args, [IMG, 5, 7, 16, 16]);
  assert.strictEqual(c.imgs[0].liso, false);
  assert.strictEqual(FX.drawIconPng(c, 'sk-outro', 5, 7, 8, 2), false, 'fora do cache');
  FX.setIconImages({});
  assert.strictEqual(FX.iconImage('sk-arranque'), null, 'setIconImages troca o cache inteiro');
});
test('drawIconPng: lado·S < 16 ⇒ não desenha e devolve false', function () {
  FX.setIconImages({ 'sk-arranque': IMG });
  var c = ctxFalso();
  assert.strictEqual(FX.drawIconPng(c, 'sk-arranque', 0, 0, 8, 1), false);
  assert.strictEqual(c.imgs.length, 0);
  FX.setIconImages({});
});
test('balão de skill com ícone no cache desenha a imagem e não o 8×8 em código', function () {
  FX.setIconImages({});
  var sem = ctxFalso(), com = ctxFalso(), it = itemIcone({ skillId: 'arranque' });
  FX.drawBalloon(sem, 10, 10, 2, it, 10.5, 0);
  FX.setIconImages({ 'sk-arranque': IMG });
  FX.drawBalloon(com, 10, 10, 2, it, 10.5, 0);
  assert.strictEqual(com.imgs.length, 1);
  assert.strictEqual(com.imgs[0].args[3], 16);
  assert.ok(com.rects.length < sem.rects.length, 'sem os retângulos do ícone em código');
  FX.setIconImages({});
});
test('Review Focus 3: balão com skillId nulo usa o ícone em código, sem exceção', function () {
  FX.setIconImages({ 'sk-null': IMG, 'sk-undefined': IMG });
  var c = ctxFalso(), it = itemIcone({ skillId: null });
  assert.doesNotThrow(function () { FX.drawBalloon(c, 10, 10, 2, it, 10.5, 0); });
  assert.strictEqual(c.imgs.length, 0);
  assert.ok(c.rects.length > 0);
  FX.setIconImages({});
});
test('Review Focus 4: sem setIconImages (imagem não carregada) o balão é idêntico ao de hoje', function () {
  FX.setIconImages({});
  var a = ctxFalso(), b = ctxFalso(), it = itemIcone({ skillId: 'arranque' });
  FX.drawBalloon(a, 10, 10, 2, it, 10.5, 0);
  FX.setIconImages({ 'sk-arranque': IMG }); FX.setIconImages({});
  FX.drawBalloon(b, 10, 10, 2, it, 10.5, 0);
  assert.deepStrictEqual(b.rects, a.rects);
  assert.strictEqual(b.imgs.length, 0);
  // e com S = 1 (ícone < 16 px) também cai no código, mesmo com imagem no cache
  FX.setIconImages({ 'sk-arranque': IMG });
  var c = ctxFalso(), d = ctxFalso();
  FX.drawBalloon(c, 10, 10, 1, it, 10.5, 0);
  FX.setIconImages({});
  FX.drawBalloon(d, 10, 10, 1, it, 10.5, 0);
  assert.deepStrictEqual(c.rects, d.rects);
  assert.strictEqual(c.imgs.length, 0);
});
test('skill de tipo usa sk-tipo-<elemento>; clima usa cl-<clima>', function () {
  assert.strictEqual(FX.iconNameOf(itemIcone({ typeSkill: true, element: 'agua', skillId: 'mare' })), 'sk-tipo-agua');
  assert.strictEqual(FX.iconNameOf(itemIcone({ skillId: null, clima: 'chuva' })), 'cl-chuva');
  assert.strictEqual(FX.iconNameOf(itemIcone({ skillId: null })), null);
  FX.setIconImages({ 'sk-tipo-fogo': IMG, 'cl-nevoa': IMG });
  var a = ctxFalso(), b = ctxFalso();
  FX.drawBalloon(a, 10, 10, 2, itemIcone({ typeSkill: true, element: 'fogo' }), 10.5, 0);
  FX.drawBalloon(b, 10, 10, 2, itemIcone({ skillId: null, clima: 'nevoa' }), 10.5, 0);
  assert.strictEqual(a.imgs.length, 1); assert.strictEqual(b.imgs.length, 1);
  FX.setIconImages({});
});
test('faixa do Dado com ui-dado no cache desenha a imagem', function () {
  var dado = { kind: 'dado', t0: 10, t1: 15, escala: 1, winner: 0, rolls: [{ best: 12, rerolls: 0 }, { best: 7, rerolls: 0 }] };
  var racers = [{ silks: '#d8353b' }, { silks: '#2f6fd8' }];
  var lay = { artW: 400, hudH: 12, compact: false };
  FX.setIconImages({});
  var sem = ctxFalso(); FX.drawDiceStrip(sem, dado, racers, lay, 2, 11, false);
  FX.setIconImages({ 'ui-dado': IMG });
  var c = ctxFalso(); FX.drawDiceStrip(c, dado, racers, lay, 2, 11, false);
  FX.setIconImages({});
  assert.strictEqual(sem.imgs.length, 0);
  assert.strictEqual(c.imgs.length, 1);
  assert.strictEqual(c.imgs[0].args[3], 16);
  assert.deepStrictEqual(c.rects, sem.rects, 'o resto da faixa é o mesmo');
});
test('simulação não muda: mesmo resultado com e sem ícones', function () {
  FX.setIconImages({});
  var a = corridaSkills(9), antes = JSON.stringify(a.sim);
  FX.setIconImages({ 'sk-arranque': IMG, 'cl-sol': IMG, 'ui-dado': IMG });
  var b = corridaSkills(9);
  FX.timeline(b.sim, b.racers, 3);
  FX.setIconImages({});
  assert.strictEqual(JSON.stringify(b.sim), antes);
});

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
