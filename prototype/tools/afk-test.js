// prototype/tools/afk-test.js — node prototype/tools/afk-test.js
// Testes das regras do AFK (prototype/src/afk.js) e, no bloco B, da forja (prototype/src/forja.js).
'use strict';
var assert = require('assert');
var fs = require('fs'), path = require('path');
var G = require('../src/data.js');
var S = require('../src/sim.js');
var GY = require('../src/ginasio.js');
var A; try { A = require('../src/afk.js'); } catch (e) { A = {}; console.log('  (afk.js não carregou: ' + e.message + ')'); }
var fails = 0, count = 0;
function section(t) { console.log('\n## ' + t); }
function test(name, fn) {
  count++;
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { fails++; console.log('  FALHA ' + name + '\n       ' + (e.message || e)); }
}
function congela(x) { if (x && typeof x === 'object') { Object.keys(x).forEach(function (k) { congela(x[k]); }); Object.freeze(x); } return x; }
function progCom(etapas) { var o = {}; G.GYM_ORDER.forEach(function (id) { o[id] = { etapa: etapas[id] || 0, revDia: null, revVitorias: 0 }; }); return o; }
function cav(base, level, grau) { var h = GY.cavalo({ base: base, level: level, grau: grau || 2 }); h.uid = 'c-' + base + '-' + level; return h; }

section('fases, dificuldades e vagas');
test('GameData.AFK: três dificuldades, liberação em 50 vitórias, preço das 5 vagas, limites do offline e amostra de 400', function () {
  var K = G.AFK;
  assert.deepStrictEqual(K.difs.map(function (d) { return d.id; }), ['normal', 'dificil', 'lendaria']);
  assert.deepStrictEqual(K.difs.map(function (d) { return d.mult; }), [1, 2, 4]);
  assert.deepStrictEqual(K.difs.map(function (d) { return d.nivel; }), [0, 12, 25]);
  assert.deepStrictEqual(K.difs.map(function (d) { return d.rank; }), [null, 3, 5]);
  assert.strictEqual(K.difs[2].nivelMax, 45);
  assert.deepStrictEqual(K.difs[1].pecas, { rar: 'magico', plus: 3 });
  assert.deepStrictEqual(K.difs[2].pecas, { rar: 'raro', plus: 5, doConjunto: true });
  assert.strictEqual(K.liberaApos, 50);
  assert.deepStrictEqual(K.vagaPreco, [0, 1000, 3000, 8000, 20000]);
  assert.strictEqual(K.offlineMin, 480); assert.strictEqual(K.offlineTetoMin, 720); assert.strictEqual(K.amostra, 400);
});
test('faseId e fase: ida e volta nas 45 fases; id estragado devolve null', function () {
  var n = 0;
  G.GYM_ORDER.forEach(function (g) {
    for (var e = 0; e < 5; e++) G.AFK.difs.forEach(function (d) {
      var id = A.faseId(g, e, d.id), f = A.fase(id);
      assert.strictEqual(id, g + ':' + e + ':' + d.id);
      assert.strictEqual(f.gymId, g); assert.strictEqual(f.etapa, e); assert.strictEqual(f.dif, d.id); assert.strictEqual(f.mult, d.mult);
      n++;
    });
  });
  assert.strictEqual(n, 45); assert.strictEqual(A.fases().length, 45);
  [null, undefined, 5, '', 'fogo', 'fogo:1', 'lava:1:normal', 'fogo:5:normal', 'fogo:-1:normal', 'fogo:1.5:normal', 'fogo:01:normal', 'fogo:1:facil',
    'constructor:1:normal', 'fogo:1:normal:x', 'fogo:1:constructor'].forEach(function (x) { assert.strictEqual(A.fase(x), null, String(x)); });
  assert.strictEqual(A.faseId('lava', 1, 'normal'), null); assert.strictEqual(A.faseId('fogo', 7, 'normal'), null); assert.strictEqual(A.faseId('fogo', 1, 'x'), null);
});
test('Normal usa o nível e o rank da etapa; Difícil etapa + 12 e rank 3', function () {
  var f = A.fase('agua:3:normal');
  assert.strictEqual(f.nivel, 16); assert.strictEqual(f.rank, 2); assert.strictEqual(f.pecas, null);
  assert.strictEqual(A.fase('agua:0:normal').nivel, 4); assert.strictEqual(A.fase('agua:0:normal').rank, 1);
  var d = A.fase('agua:3:dificil');
  assert.strictEqual(d.nivel, 28); assert.strictEqual(d.rank, 3); assert.deepStrictEqual(d.pecas, { rar: 'magico', plus: 3 });
});
test('Lendária do líder tem nível 45 e rank 5', function () {
  var f = A.fase('fogo:4:lendaria');
  assert.strictEqual(f.nivel, 45); assert.strictEqual(f.rank, 5); assert.strictEqual(f.mult, 4);
});
test('Lendária do Soldado 1 tem nível 29', function () { assert.strictEqual(A.fase('grama:0:lendaria').nivel, 29); });
test('nenhuma fase passa do nível 45 nem do nível máximo do jogo', function () {
  A.fases().forEach(function (id) { var f = A.fase(id); assert.ok(f.nivel >= 4 && f.nivel <= 45 && f.nivel <= G.ECONOMY.maxLevel, id + ' ' + f.nivel); });
});
test('etapa não vencida no ginásio não libera', function () {
  assert.deepStrictEqual(A.liberadas(progCom({}), {}), []);
  assert.deepStrictEqual(A.liberadas(progCom({ fogo: 2 }), {}), ['fogo:0:normal', 'fogo:1:normal']);
  assert.deepStrictEqual(A.liberadas(progCom({ fogo: 5, grama: 1 }), {}), ['fogo:0:normal', 'fogo:1:normal', 'fogo:2:normal', 'fogo:3:normal', 'fogo:4:normal', 'grama:0:normal']);
  // vitórias AFK numa etapa não vencida no ginásio não liberam nada
  assert.deepStrictEqual(A.liberadas(progCom({}), { 'fogo:0:normal': 99, 'fogo:0:dificil': 99 }), []);
  assert.deepStrictEqual(A.liberadas(null, null), []); assert.deepStrictEqual(A.liberadas('x', 7), []);
});
test('Difícil só com 50 vitórias na Normal; Lendária só com 50 na Difícil', function () {
  var p = progCom({ agua: 1 });
  assert.deepStrictEqual(A.liberadas(p, { 'agua:0:normal': 49 }), ['agua:0:normal']);
  assert.deepStrictEqual(A.liberadas(p, { 'agua:0:normal': 50 }), ['agua:0:normal', 'agua:0:dificil']);
  assert.deepStrictEqual(A.liberadas(p, { 'agua:0:normal': 50, 'agua:0:dificil': 49 }), ['agua:0:normal', 'agua:0:dificil']);
  assert.deepStrictEqual(A.liberadas(p, { 'agua:0:normal': 50, 'agua:0:dificil': 50 }), ['agua:0:normal', 'agua:0:dificil', 'agua:0:lendaria']);
  // 50 na Difícil sem as 50 da Normal (save estragado): a Lendária não libera sozinha
  assert.deepStrictEqual(A.liberadas(p, { 'agua:0:normal': 3, 'agua:0:dificil': 80 }), ['agua:0:normal']);
  assert.deepStrictEqual(A.liberadas(p, { 'agua:0:normal': '50' }), ['agua:0:normal'], 'texto não conta');
  assert.strictEqual(A.liberada('agua:0:dificil', p, { 'agua:0:normal': 50 }), true);
  assert.strictEqual(A.liberada('agua:1:normal', p, {}), false); assert.strictEqual(A.liberada('lixo', p, {}), false);
});
test('oponente: o cavalo da etapa no nível e no rank da dificuldade, com as estrelas da etapa', function () {
  var o = A.oponente('agua:4:lendaria', 1), def = G.GYMS.agua.etapas[4].cavalos[1];
  assert.deepStrictEqual(o, GY.cavalo({ base: def.base, level: 45, grau: def.grau, rank: 5 }));
  assert.strictEqual(o.level, 45); assert.strictEqual(o.grau, 3); assert.strictEqual(o.element, 'agua');
  assert.deepStrictEqual(A.oponente('fogo:0:normal', 0), GY.cavalo(G.GYMS.fogo.etapas[0].cavalos[0]));
  assert.strictEqual(A.oponente('lixo', 0), null); assert.strictEqual(A.oponente('fogo:0:normal', -1), null); assert.strictEqual(A.oponente('fogo:0:normal', 1.5), null);
});
test('rodízio do Soldado 3 alterna os 2 cavalos; o do líder roda os 3', function () {
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(function (n) { return A.oponenteIdx('fogo:2:normal', n); }), [0, 1, 0, 1, 0]);
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map(function (n) { return A.oponenteIdx('agua:4:dificil', n); }), [0, 1, 2, 0, 1, 2]);
  assert.deepStrictEqual([0, 1, 2].map(function (n) { return A.oponenteIdx('grama:0:normal', n); }), [0, 0, 0]);
  // no Remanso, o Soldado 4 tem um cavalo de 2 e um de 3 estrelas: o rodízio alterna de verdade
  assert.strictEqual(A.oponente('agua:3:normal', 0).grau, 2); assert.strictEqual(A.oponente('agua:3:normal', 1).grau, 3); assert.strictEqual(A.oponente('agua:3:normal', 2).grau, 2);
});
test('vaga 2 custa 1000 e respeita o ouroLivre', function () {
  assert.deepStrictEqual(A.podeComprarVaga(1, 1000), { ok: true, preco: 1000 });
  assert.deepStrictEqual(A.podeComprarVaga(1, 999), { ok: false, motivo: 'Falta Ouro (precisa de 1.000)', preco: 1000 });
  assert.deepStrictEqual(A.podeComprarVaga(0, 0), { ok: true, preco: 0 });
  assert.deepStrictEqual(A.podeComprarVaga(4, 20000), { ok: true, preco: 20000 });
  assert.strictEqual(A.podeComprarVaga(2, NaN).ok, false); assert.strictEqual(A.podeComprarVaga(2, '9999').ok, false);
  assert.strictEqual(A.podeComprarVaga(1.5, 99999).ok, false); assert.strictEqual(A.podeComprarVaga(-1, 99999).ok, false);
});
test('6ª vaga: motivo "Máximo de 5 vagas"', function () {
  assert.deepStrictEqual(A.podeComprarVaga(5, 999999), { ok: false, motivo: 'Máximo de 5 vagas' });
  assert.deepStrictEqual(A.podeComprarVaga(9, 999999), { ok: false, motivo: 'Máximo de 5 vagas' });
});

section('corrida AFK e drops');
var GR = require('../src/gear.js');
var BONUS0 = { material: 0, xp: 0, raro: 0, trofeu: 0, ouro: 0 };
var PROIBIDOS = ['torrao', 'estrela', 'redea', 'manual', 'cupom', 'pergaminho', 'selo'];
// n prêmios de vitória (ou derrota) da fase, com seeds de corrida seguidas: conta quantas vezes cada coisa caiu
function amostra(faseId, n, bonus, venceu) {
  var c = { incomum: 0, pedra: 0, peca: 0, trofeu: 0, comida: 0, reforja: 0, material: 0, ouro: 0, xp: 0, ids: {}, pecas: [] }, f = A.fase(faseId), M = G.AFK.materiais[f.gymId];
  for (var i = 0; i < n; i++) {
    var p = A.premio(faseId, venceu !== false, S.hash2(0xABCDE, i), bonus || BONUS0);
    Object.keys(p.itens).forEach(function (id) { c.ids[id] = (c.ids[id] || 0) + p.itens[id]; });
    if (p.itens[M.incomum]) c.incomum++;
    if (p.pedras) c.pedra++;
    if (p.pecas.length) { c.peca++; c.pecas.push(p.pecas[0]); }
    if (p.itens['trofeu-' + f.gymId + '-' + f.etapa]) c.trofeu++;
    if (['feno', 'cenoura', 'maca', 'aveia-dourada'].some(function (id) { return p.itens[id]; })) c.comida++;
    if (p.itens['pergaminho-reforja']) c.reforja++;
    c.material += (p.itens[M.comuns[0]] || 0) + (p.itens[M.comuns[1]] || 0); c.ouro += p.ouro; c.xp += p.xp;
  }
  return c;
}
function perto(v, alvo, tol, msg) { assert.ok(Math.abs(v - alvo) <= tol, msg + ': ' + v.toFixed(4) + ' (esperado ' + alvo + ' ± ' + tol + ')'); }
test('itens novos do AFK no catálogo: 6 materiais, 3 incomuns, 4 comidas, 15 troféus e o Pergaminho de reforja, sem preço', function () {
  var I = G.ITEMS, por = {};
  Object.keys(I).forEach(function (id) { if (I[id].grupo) (por[I[id].grupo] = por[I[id].grupo] || []).push(id); });
  assert.deepStrictEqual(por.material, ['carvao', 'ferro-bruto', 'junco', 'concha', 'fibra', 'resina']);
  assert.deepStrictEqual(por.incomum, ['brasa-viva', 'perola-de-rio', 'seiva-antiga']);
  assert.deepStrictEqual(por.comida, ['feno', 'cenoura', 'maca', 'aveia-dourada']);
  assert.deepStrictEqual(por.reforja, ['pergaminho-reforja']);
  assert.strictEqual(por.trofeu.length, 15);
  G.GYM_ORDER.forEach(function (g) {
    for (var e = 0; e < 5; e++) {
      var t = I['trofeu-' + g + '-' + e];
      assert.ok(t && t.cap === 99 && t.gymId === g && t.etapa === e, 'troféu ' + g + ' ' + e);
      assert.ok(t.name.indexOf(G.GYMS[g].etapas[e].nome) > 0, t.name + ' leva o nome do oponente');
    }
    var M = G.AFK.materiais[g];
    M.comuns.concat([M.incomum]).forEach(function (id) { assert.strictEqual(I[id].gymId, g, id); });
    assert.ok(G.GEAR_SETS[M.conjunto], g + ': conjunto');
  });
  assert.deepStrictEqual(G.GYM_ORDER.map(function (g) { return G.AFK.materiais[g].conjunto; }), ['sol', 'chuva', 'nevoa']);
  por.material.concat(por.incomum, por.comida).forEach(function (id) { assert.strictEqual(I[id].cap, 999, id); });
  assert.strictEqual(I['pergaminho-reforja'].cap, 99);
  Object.keys(por).forEach(function (g) { por[g].forEach(function (id) {
    var it = I[id];
    assert.ok(it.price == null && !it.perDay, id + ' fora da loja');
    assert.ok(it.id === id && it.name && it.plural && it.desc && it.origem, id + ' com os textos');
    assert.ok(G.SHOP_ORDER.indexOf(id) < 0, id + ' fora da ordem da loja');
  }); });
  assert.strictEqual(I.feno.xp, 200); assert.strictEqual(I.cenoura.xp, 500); assert.strictEqual(I.maca.xp, 1200); assert.strictEqual(I['aveia-dourada'].aveiaMin, 60);
});
test('XP e Ouro por vitória: round(40 × (1 + 0,15 × etapa) × mult) e [2, 3, 4, 5, 8] × mult; derrota 30% do XP e nada de Ouro', function () {
  [['fogo:0:normal', 40, 2], ['fogo:2:normal', 52, 4], ['agua:4:normal', 64, 8], ['agua:4:dificil', 128, 16], ['grama:4:lendaria', 256, 32], ['grama:1:lendaria', 184, 12]].forEach(function (c) {
    var v = A.premio(c[0], true, 77, BONUS0), d = A.premio(c[0], false, 77, BONUS0);
    assert.strictEqual(v.xp, c[1], c[0] + ' xp'); assert.strictEqual(v.ouro, c[2], c[0] + ' ouro');
    assert.strictEqual(d.xp, Math.round(c[1] * 0.3), c[0] + ' xp da derrota'); assert.strictEqual(d.ouro, 0);
  });
});
test('mesma seed e contador dão o mesmo resultado e os mesmos drops (E5); contador seguinte dá outra corrida', function () {
  var h = congela(cav('mare', 12));
  var a = A.correr(h, 'fogo:2:normal', 4242, 7, BONUS0, { vaga: 1 }), b = A.correr(h, 'fogo:2:normal', 4242, 7, BONUS0, { vaga: 1 });
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.cfg.seed, A.seedCorrida(4242, 1, 7));
  assert.strictEqual(a.oponenteIdx, 1, 'rodízio pelo contador'); assert.deepStrictEqual(a.cfg.racers[1].horse, A.oponente('fogo:2:normal', 7));
  assert.strictEqual(a.venceu, S.simulate(a.cfg).finishOrder[0] === 0, 'a config reproduz a corrida');
  assert.strictEqual(a.metros, GY.metros(S.simulate(a.cfg)));
  assert.ok(a.duracaoS > 40 && a.duracaoS < 120, 'duração de um duelo: ' + a.duracaoS);
  assert.strictEqual(a.cfg.conditions.weather, 'nublado'); assert.deepStrictEqual(a.cfg.conditions.blocks, G.GYMS.fogo.pista.blocks);
  assert.strictEqual(a.cfg.racers[0].statMul, 1 + G.GYM.vantagem, 'vantagem de elemento como no ginásio'); assert.strictEqual(a.cfg.racers[0].folego, 1, 'sem cansaço');
  assert.strictEqual(a.cfg.recordFrames, false); assert.strictEqual(a.res, undefined, 'sem quadros, sem res');
  var vivo = A.correr(h, 'fogo:2:normal', 4242, 7, BONUS0, { vaga: 1, recordFrames: true });
  assert.ok(vivo.res && vivo.res.frames.length > 100, 'com quadros para a tela animar'); assert.strictEqual(vivo.venceu, a.venceu); assert.deepStrictEqual(vivo.itens, a.itens);
  var dif = 0, seeds = new Set();
  for (var c = 0; c < 12; c++) { var r = A.correr(h, 'fogo:2:normal', 4242, c, BONUS0, { vaga: 1 }); seeds.add(r.cfg.seed); if (r.metros !== a.metros || r.venceu !== a.venceu) dif++; }
  assert.strictEqual(seeds.size, 12); assert.ok(dif >= 9, 'contadores diferentes dão corridas diferentes');
  assert.notStrictEqual(A.seedCorrida(4242, 0, 7), A.seedCorrida(4242, 1, 7), 'cada vaga tem a sua seed');
  var todas = new Set(); for (var v = 0; v < 5; v++) for (var k = 0; k < 2000; k++) todas.add(A.seedCorrida(99, v, k));
  assert.strictEqual(todas.size, 10000, 'cada (vaga, contador) tem a sua seed');
  [[null, 'fogo:0:normal', 1, 0], [h, 'lixo', 1, 0], [h, 'fogo:0:normal', NaN, 0], [h, 'fogo:0:normal', 1, -1], [h, 'fogo:0:normal', 1, 1.5]].forEach(function (x, i) {
    assert.strictEqual(A.correr(x[0], x[1], x[2], x[3], BONUS0), null, 'malformada ' + i);
  });
  assert.strictEqual(A.correr(h, 'fogo:0:normal', 1, 0, BONUS0, { vaga: 5 }), null); assert.strictEqual(A.correr(h, 'fogo:0:normal', 1, 0, BONUS0, { vaga: -1 }), null);
});
test('nenhum Math.random, Date.now nem new Date durante correr e premio', function () {
  var mr = Math.random, dn = Date.now, DataOrig = global.Date, usou = false;
  Math.random = function () { usou = true; return mr.apply(Math, arguments); };
  Date.now = function () { usou = true; return dn.apply(DataOrig, arguments); };
  function Detector() { usou = true; return new (Function.prototype.bind.apply(DataOrig, [null].concat([].slice.call(arguments))))(); }
  Detector.now = Date.now; Detector.UTC = DataOrig.UTC; Detector.parse = DataOrig.parse; Detector.prototype = DataOrig.prototype;
  global.Date = Detector;
  try {
    var h = cav('ipe', 30);
    ['fogo:0:normal', 'agua:4:dificil', 'grama:4:lendaria'].forEach(function (f) {
      for (var c = 0; c < 6; c++) A.correr(h, f, 31337, c, { material: 0.2, xp: 0.1, raro: 0.3, trofeu: 0.5, ouro: 0.1 }, { vaga: c % 5 });
      for (var k = 0; k < 3000; k++) { A.premio(f, true, k, BONUS0); A.premio(f, false, k, BONUS0); }
    });
  } finally { Math.random = mr; DataOrig.now = dn; global.Date = DataOrig; }
  assert.strictEqual(usou, false);
});
test('em 20.000 vitórias na Normal: incomum 15% ±1, Pedra 6% ±0,7, peça 2% ±0,4, troféu 0,5% ±0,2, comida 8% ±0,8, reforja 1,5% ±0,35', function () {
  var n = 20000, c = amostra('fogo:1:normal', n);
  perto(c.incomum / n, 0.15, 0.01, 'incomum'); perto(c.pedra / n, 0.06, 0.007, 'Pedra'); perto(c.peca / n, 0.02, 0.004, 'peça');
  perto(c.trofeu / n, 0.005, 0.002, 'troféu'); perto(c.comida / n, 0.08, 0.008, 'comida'); perto(c.reforja / n, 0.015, 0.0035, 'reforja');
  // material: 100%, 1 a 3 (média 2), metade de cada tipo
  perto(c.material / n, 2, 0.03, 'material por vitória');
  perto(c.ids.carvao / c.material, 0.5, 0.01, 'metade Carvão');
  // comida: Feno 60%, Cenoura 25%, Maçã 12%, Aveia 3% do que cai
  var tot = (c.ids.feno || 0) + (c.ids.cenoura || 0) + (c.ids.maca || 0) + (c.ids['aveia-dourada'] || 0);
  perto(c.ids.feno / tot, 0.60, 0.04, 'Feno'); perto(c.ids.cenoura / tot, 0.25, 0.04, 'Cenoura'); perto(c.ids.maca / tot, 0.12, 0.03, 'Maçã'); perto((c.ids['aveia-dourada'] || 0) / tot, 0.03, 0.02, 'Aveia');
  // na Normal a peça é solta: Comum ou Mágica, nunca de conjunto
  c.pecas.forEach(function (p) { var d = G.GEAR[p.id]; assert.ok(d && !d.set && (d.rarity === 'comum' || d.rarity === 'magico'), p.id); assert.strictEqual(p.linhas.length, d.rarity === 'magico' ? 1 : 0); });
  var slots = {}, rar = {}; c.pecas.forEach(function (p) { slots[G.GEAR[p.id].slot] = 1; rar[G.GEAR[p.id].rarity] = 1; });
  assert.strictEqual(Object.keys(slots).length, 5, 'os 5 slots caem'); assert.strictEqual(Object.keys(rar).length, 2, 'Comum e Mágica caem');
});
test('Lendária: troféu 2% e incomum com teto 60%; Pedra 24%, comida 32%, reforja 6%, material × 4; peça Rara 2% e Lendária 0,2% do conjunto do ginásio', function () {
  var n = 30000, c = amostra('agua:3:lendaria', n);
  perto(c.trofeu / n, 0.02, 0.003, 'troféu'); perto(c.incomum / n, 0.60, 0.012, 'incomum (teto)'); perto(c.pedra / n, 0.24, 0.01, 'Pedra');
  perto(c.comida / n, 0.32, 0.01, 'comida'); perto(c.reforja / n, 0.06, 0.005, 'reforja'); perto(c.material / n, 8, 0.1, 'material');
  var raras = c.pecas.filter(function (p) { return G.GEAR[p.id].rarity === 'raro'; }), lend = c.pecas.filter(function (p) { return G.GEAR[p.id].rarity === 'lendario'; });
  assert.strictEqual(raras.length + lend.length, c.pecas.length, 'na Lendária só cai Rara ou Lendária');
  perto(raras.length / n, 0.02, 0.003, 'Rara'); perto(lend.length / n, 0.002, 0.0012, 'Lendária');
  c.pecas.forEach(function (p) { assert.strictEqual(G.GEAR[p.id].set, 'chuva', 'Remanso → Chuva: ' + p.id); });
  lend.forEach(function (p) { assert.strictEqual(p.linhas.length, 3); });
  // Difícil: Rara 1%, nunca Lendária; incomum 30%, troféu 1%
  var d = amostra('grama:0:dificil', n);
  perto(d.peca / n, 0.01, 0.002, 'Rara na Difícil'); d.pecas.forEach(function (p) { assert.strictEqual(G.GEAR[p.id].rarity, 'raro'); assert.strictEqual(G.GEAR[p.id].set, 'nevoa'); });
  perto(d.incomum / n, 0.30, 0.01, 'incomum na Difícil'); perto(d.trofeu / n, 0.01, 0.002, 'troféu na Difícil');
});
test('derrota não rola raros: só 30% do XP e 25% do material (para baixo), sem Ouro', function () {
  ['fogo:1:normal', 'fogo:1:dificil', 'fogo:1:lendaria'].forEach(function (f) {
    var M = G.AFK.materiais.fogo, mult = A.fase(f).mult, soma = 0, n = 6000;
    for (var i = 0; i < n; i++) {
      var p = A.premio(f, false, S.hash2(55, i), { material: 0.5, xp: 0, raro: 1, trofeu: 1, ouro: 1 });
      Object.keys(p.itens).forEach(function (id) { assert.ok(M.comuns.indexOf(id) >= 0, f + ': só material comum, veio ' + id); });
      assert.strictEqual(p.pedras, 0); assert.strictEqual(p.pecas.length, 0); assert.strictEqual(p.ouro, 0);
      var q = (p.itens.carvao || 0) + (p.itens['ferro-bruto'] || 0);
      assert.ok(q <= Math.floor(3 * mult * 0.25), f + ' material ' + q); soma += q;
    }
    // 1 a 3 × mult × 25%, para baixo: Normal sempre 0; Difícil 0, 1, 1 (média 2/3); Lendária 1, 2, 3 (média 2)
    perto(soma / n, mult === 1 ? 0 : mult === 2 ? 2 / 3 : 2, 0.05, f + ' material médio na derrota');
  });
});
test('bonus.trofeu 0,3 leva o troféu da Normal a 0,65%; bonus.raro multiplica incomum, Pedra, peça e comida; material, XP e Ouro sobem pelo bônus', function () {
  var n = 200000, c = amostra('agua:2:normal', n, { material: 0.25, xp: 0.10, raro: 0.5, trofeu: 0.3, ouro: 0.5 });
  perto(c.trofeu / n, 0.0065, 0.0006, 'troféu'); perto(c.incomum / n, 0.225, 0.004, 'incomum'); perto(c.pedra / n, 0.09, 0.003, 'Pedra');
  perto(c.peca / n, 0.03, 0.0015, 'peça'); perto(c.comida / n, 0.12, 0.003, 'comida'); perto(c.reforja / n, 0.015, 0.001, 'reforja (não é drop raro)');
  perto(c.material / n, 2.5, 0.02, 'material'); perto(c.ouro / n, 6, 0.02, 'Ouro (4 × 1,5)'); assert.strictEqual(c.xp / n, Math.round(52 * 1.1));
  // bônus estragado vale 0
  assert.deepStrictEqual(A.premio('agua:2:normal', true, 9, null), A.premio('agua:2:normal', true, 9, BONUS0));
  assert.deepStrictEqual(A.premio('agua:2:normal', true, 9, { material: 'x', xp: -1, raro: NaN, trofeu: Infinity, ouro: {} }), A.premio('agua:2:normal', true, 9, BONUS0));
});
test('correr e premio nunca devolvem torrao, estrela, redea, manual, cupom, pergaminho nem selo; todo id é do catálogo e do AFK', function () {
  A.fases().forEach(function (f) {
    for (var i = 0; i < 1500; i++) {
      var p = A.premio(f, i % 4 !== 0, S.hash2(7, i), { material: 0.3, xp: 0.3, raro: 0.3, trofeu: 0.3, ouro: 0.3 });
      Object.keys(p.itens).forEach(function (id) {
        assert.ok(PROIBIDOS.indexOf(id) < 0, f + ' deu ' + id);
        assert.ok(G.ITEMS[id] && G.ITEMS[id].grupo && p.itens[id] > 0 && p.itens[id] === Math.floor(p.itens[id]), f + ' item ' + id + ' ' + p.itens[id]);
      });
      assert.deepStrictEqual(Object.keys(p).sort(), ['itens', 'ouro', 'pecas', 'pedras', 'xp']);
    }
  });
});
test('peça Rara que cai tem 2 linhas de tipos diferentes, dentro das faixas; Mágica 1, Lendária 3, Comum 0', function () {
  var F = G.ECONOMY.gear.faixas, vistos = {};
  assert.deepStrictEqual(G.ECONOMY.gear.linhas, { comum: 0, magico: 1, raro: 2, lendario: 3 });
  assert.deepStrictEqual(Object.keys(F), ['material', 'xp', 'raro', 'trofeu', 'ouro']);
  assert.deepStrictEqual(F.material, { magico: [3, 6], raro: [6, 10], lendario: [10, 15] }); assert.deepStrictEqual(F.xp, F.material);
  assert.deepStrictEqual(F.raro, { magico: [2, 5], raro: [5, 8], lendario: [8, 12] });
  assert.deepStrictEqual(F.trofeu, { magico: [6, 12], raro: [12, 20], lendario: [20, 30] });
  assert.deepStrictEqual(F.ouro, { magico: [2, 4], raro: [4, 6], lendario: [6, 10] });
  ['comum', 'magico', 'raro', 'lendario'].forEach(function (rar) {
    for (var i = 0; i < 3000; i++) {
      var ls = GR.sortearLinhas(rar, S.mulberry32(S.hash2(3, i)));
      assert.strictEqual(ls.length, G.ECONOMY.gear.linhas[rar]);
      var tipos = {};
      ls.forEach(function (l) {
        assert.ok(!tipos[l.tipo], 'tipo repetido'); tipos[l.tipo] = 1;
        var fx = F[l.tipo][rar];
        assert.ok(l.valor === Math.floor(l.valor) && l.valor >= fx[0] && l.valor <= fx[1], rar + ' ' + l.tipo + ' ' + l.valor);
        vistos[rar + l.tipo + l.valor] = 1;
      });
    }
  });
  // cada tipo e cada valor da faixa aparece (sorteio uniforme em passos de 1 ponto)
  Object.keys(F).forEach(function (t) { ['magico', 'raro', 'lendario'].forEach(function (rar) { for (var v = F[t][rar][0]; v <= F[t][rar][1]; v++) assert.ok(vistos[rar + t + v], rar + ' ' + t + ' ' + v + ' nunca saiu'); }); });
  assert.deepStrictEqual(GR.sortearLinhas('raro', S.mulberry32(9)), GR.sortearLinhas('raro', S.mulberry32(9)), 'determinístico');
  assert.deepStrictEqual(GR.sortearLinhas('mitico', S.mulberry32(9)), []); assert.deepStrictEqual(GR.sortearLinhas(null, S.mulberry32(9)), []);
  // a Rara que cai no AFK
  var c = amostra('fogo:4:lendaria', 4000), raras = c.pecas.filter(function (p) { return G.GEAR[p.id].rarity === 'raro'; });
  assert.ok(raras.length > 40);
  raras.forEach(function (p) { assert.strictEqual(p.linhas.length, 2); assert.notStrictEqual(p.linhas[0].tipo, p.linhas[1].tipo); });
});
test('material e incomum de um ginásio nunca caem em outro; o troféu é o do oponente da fase', function () {
  G.GYM_ORDER.forEach(function (g) {
    var M = G.AFK.materiais[g];
    for (var e = 0; e < 5; e++) {
      var c = amostra(g + ':' + e + ':lendaria', 2500);
      Object.keys(c.ids).forEach(function (id) {
        var it = G.ITEMS[id];
        if (it.grupo === 'material' || it.grupo === 'incomum') assert.strictEqual(it.gymId, g, id + ' caiu em ' + g);
        if (it.grupo === 'trofeu') assert.strictEqual(id, 'trofeu-' + g + '-' + e);
      });
      assert.ok(c.ids[M.comuns[0]] > 0 && c.ids[M.comuns[1]] > 0 && c.ids[M.incomum] > 0, g + ' ' + e + ': os três materiais caem');
    }
  });
});

section('pureza');
test('afk.js é puro: sem Math.random, relógio, tela nem estado global; carrega no navegador e no build', function () {
  var fonte = fs.readFileSync(path.join(__dirname, '../src/afk.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/Math\.random|Date|performance\.now|document|window|localStorage/.test(fonte), 'afk.js sem sorteio fora da seed, relógio ou tela');
  assert.ok(/root\.Afk = Afk/.test(fonte), 'UMD no navegador');
  assert.ok(fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').indexOf('src/afk.js') > 0, 'index.html carrega');
  assert.ok(/'src\/ginasio\.js', 'src\/afk\.js'/.test(fs.readFileSync(path.join(__dirname, '../build.mjs'), 'utf8')), 'build.mjs junta, depois do ginasio.js');
  assert.ok(/afk-test\.js/.test(fs.readFileSync(path.join(__dirname, '../../scripts/check.sh'), 'utf8')), 'o check.sh roda este teste');
});

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
