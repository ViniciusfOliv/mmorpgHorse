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
test('GameData.AFK: três dificuldades, liberação em 50 vitórias, preço das 5 vagas, limites do offline e amostra de 1.600', function () {
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
  assert.strictEqual(K.offlineMin, 480); assert.strictEqual(K.offlineTetoMin, 720); assert.strictEqual(K.amostra, 1600);
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

section('chance medida e offline');
function medir(h, f, opts) { var e = null; do { e = A.medirPasso(e, h, f, 400, opts); } while (!A.medidaPronta(e, opts)); return e; }
test('chaveConfig muda com nível, pontos, skills, ranks, estrelas, torrões e fase; não muda com nome, uid nem XP', function () {
  var h = cav('mare', 20); h.skills = ['arranque']; h.skillRanks = { arranque: 2 };
  var k = A.chaveConfig(h, 'fogo:1:normal');
  assert.strictEqual(typeof k, 'string'); assert.strictEqual(A.chaveConfig(JSON.parse(JSON.stringify(h)), 'fogo:1:normal'), k);
  function muda(fn, f) { var c = JSON.parse(JSON.stringify(h)); fn(c); return A.chaveConfig(c, f || 'fogo:1:normal') !== k; }
  assert.ok(muda(function (c) { c.level = 21; }), 'nível');
  assert.ok(muda(function (c) { c.alloc.vel += 1; }), 'pontos');
  assert.ok(muda(function (c) { c.skills = ['sprint']; c.skillRanks = { sprint: 2 }; }), 'skills');
  assert.ok(muda(function (c) { c.skillRanks.arranque = 3; }), 'ranks');
  assert.ok(muda(function (c) { c.grau = 3; }), 'estrelas');
  assert.ok(muda(function (c) { c.torroes = 2; }), 'torrões');
  assert.ok(muda(function (c) { c.potential.vel = (c.potential.vel + 1) % 32; }), 'genética');
  assert.ok(muda(function () {}, 'fogo:1:dificil'), 'dificuldade'); assert.ok(muda(function () {}, 'agua:1:normal'), 'ginásio');
  assert.ok(!muda(function (c) { c.name = 'Outro'; c.uid = 'zz'; c.xp = 999; c.breedLeft = 0; }), 'nome, uid e XP não mexem na corrida');
  assert.strictEqual(A.chaveConfig(null, 'fogo:1:normal'), null); assert.strictEqual(A.chaveConfig(h, 'lixo'), null);
});
test('medirPasso: avança em fatias até a amostra, sem passar; mesma configuração dá a mesma medida; outra configuração recomeça', function () {
  var h = congela(cav('ipe', 16)), f = 'agua:3:normal', N = G.AFK.amostra;
  var e = A.medirPasso(null, h, f, 10);
  assert.strictEqual(e.feitos, 10); assert.strictEqual(e.chave, A.chaveConfig(h, f)); assert.ok(e.vitorias >= 0 && e.vitorias <= 10 && e.somaDuracao > 400);
  assert.strictEqual(A.medidaPronta(e), false); assert.strictEqual(A.medida(e), null, 'incompleta não vale');
  var e2 = A.medirPasso(e, h, f, 7); assert.strictEqual(e2.feitos, 17); assert.strictEqual(e.feitos, 10, 'não muta a entrada');
  var fim = A.medirPasso(e2, h, f, 99999);
  assert.strictEqual(fim.feitos, N); assert.strictEqual(A.medidaPronta(fim), true);
  assert.deepStrictEqual(A.medirPasso(fim, h, f, 50), fim, 'completa: não anda mais');
  var deUma = medir(h, f);
  assert.deepStrictEqual(deUma, fim, 'em fatias de 10, 7 e o resto ou de 400 em 400: a mesma medida');
  var m = A.medida(fim);
  assert.ok(m.p > 0 && m.p < 1 && Math.abs(m.p - fim.vitorias / N) < 1e-12); assert.ok(m.duracaoS > 55 && m.duracaoS < 95, 'duração média de um duelo: ' + m.duracaoS);
  // outra configuração (o cavalo subiu de nível): recomeça do zero
  var h2 = cav('ipe', 17), r = A.medirPasso(fim, h2, f, 5);
  assert.strictEqual(r.feitos, 5); assert.strictEqual(r.chave, A.chaveConfig(h2, f));
  // estado estragado recomeça; entrada inválida devolve null
  ['x', {}, { chave: fim.chave, feitos: -1, vitorias: 0, somaDuracao: 0 }, { chave: fim.chave, feitos: 5, vitorias: 9, somaDuracao: 1 }, { chave: fim.chave, feitos: 1.5, vitorias: 0, somaDuracao: 1 }].forEach(function (x, i) {
    assert.strictEqual(A.medirPasso(x, h, f, 3).feitos, 3, 'estragado ' + i);
  });
  assert.strictEqual(A.medirPasso(null, h, 'lixo', 3), null); assert.strictEqual(A.medirPasso(null, null, f, 3), null);
  assert.strictEqual(A.medirPasso(null, h, f, 0).feitos, 0);
  // a medição usa seeds próprias da configuração: não depende do save nem do contador da vaga
  assert.notStrictEqual(medir(cav('ipe', 30), f).vitorias, fim.vitorias);
});
test('E3 rápido: em 10 configurações, p com a amostra fica a menos de 3 p.p. do p com 3.000 em pelo menos 9', function () {
  var ok = 0, linhas = [];
  for (var i = 0; i < 10; i++) {
    var d = ['normal', 'dificil', 'lendaria'][i % 3], e = (i * 2) % 5, g = G.GYM_ORDER[(i * 7) % 3], f = A.fase(g + ':' + e + ':' + d);
    var h = cav(['brasa', 'mare', 'ipe'][(i + 1) % 3], Math.max(1, Math.min(50, f.nivel + [-3, 0, 2, 5, -1][i % 5])), 2 + (i % 2));
    var p = A.medida(medir(h, f.id)).p, REF = { amostra: 3000, sal: 1 }, ref = A.medida(medir(h, f.id, REF), REF).p;
    if (Math.abs(p - ref) < 0.03) ok++;
    linhas.push(f.id + ' ' + p.toFixed(3) + ' × ' + ref.toFixed(3));
  }
  assert.ok(ok >= 9, ok + ' de 10: ' + linhas.join('; '));
});
function vagaDe(o) { return Object.assign({ uid: 'm1', faseId: 'fogo:2:normal', inicioMin: 1000, contador: 40 }, o || {}); }
var MED = { p: 0.5, duracaoS: 75 };
test('offline: minutos ÷ duração média, para baixo; cada corrida um número da seed contra p; cada vitória rola os drops como ao vivo', function () {
  var v = vagaDe(), r = A.offline(v, 1000 + 120, MED, 777, BONUS0, 480, 2);
  assert.strictEqual(r.minutos, 120); assert.strictEqual(r.corridas, Math.floor(120 * 60 / 75)); assert.strictEqual(r.contador, 40 + r.corridas);
  assert.ok(r.vitorias > 30 && r.vitorias < 66, 'perto da metade de 96: ' + r.vitorias);
  // refaz corrida a corrida pela regra
  var xp = 0, ouro = 0, vit = 0, itens = {}, pedras = 0, pecas = [];
  for (var k = 0; k < r.corridas; k++) {
    var sd = A.seedCorrida(777, 2, 40 + k), venceu = A.offlineVenceu(sd, MED.p), p = A.premio(v.faseId, venceu, sd, BONUS0);
    vit += venceu ? 1 : 0; xp += p.xp; ouro += p.ouro; pedras += p.pedras; pecas = pecas.concat(p.pecas);
    Object.keys(p.itens).forEach(function (id) { itens[id] = (itens[id] || 0) + p.itens[id]; });
  }
  assert.strictEqual(r.vitorias, vit); assert.strictEqual(r.xp, xp); assert.strictEqual(r.ouro, ouro); assert.strictEqual(r.pedras, pedras);
  assert.deepStrictEqual(r.itens, itens); assert.deepStrictEqual(r.pecas, pecas);
  // as seeds do offline são as mesmas das corridas ao vivo que a vaga faria (o contador segue de onde parou)
  assert.strictEqual(A.seedCorrida(777, 2, 40), A.correr(cav('mare', 12), v.faseId, 777, 40, BONUS0, { vaga: 2 }).cfg.seed);
  // p 0 nunca vence, p 1 sempre
  assert.strictEqual(A.offline(v, 1120, { p: 0, duracaoS: 75 }, 777, BONUS0, 480, 2).vitorias, 0);
  assert.strictEqual(A.offline(v, 1120, { p: 1, duracaoS: 75 }, 777, BONUS0, 480, 2).vitorias, 96);
});
test('offline é determinístico e não muta a vaga', function () {
  var v = congela(vagaDe()), a = A.offline(v, 1300, MED, 5, { material: 0.2, xp: 0.1, raro: 0.3, trofeu: 0.5, ouro: 0.1 }, 480, 0);
  assert.deepStrictEqual(a, A.offline(v, 1300, MED, 5, { material: 0.2, xp: 0.1, raro: 0.3, trofeu: 0.5, ouro: 0.1 }, 480, 0));
  assert.notDeepStrictEqual(a.itens, A.offline(v, 1300, MED, 6, BONUS0, 480, 0).itens);
});
test('agora antes do início dá 0 corridas, sem ganho negativo e sem erro (Foco 2)', function () {
  [999, 0, -5000].forEach(function (agora) {
    var r = A.offline(vagaDe(), agora, MED, 1, BONUS0, 480, 0);
    assert.deepStrictEqual(r, { minutos: 0, corridas: 0, vitorias: 0, xp: 0, ouro: 0, itens: {}, pedras: 0, pecas: [], contador: 40 });
  });
  assert.strictEqual(A.offline(vagaDe(), 1000, MED, 1, BONUS0, 480, 0).corridas, 0, 'agora igual ao início');
  assert.strictEqual(A.offline(vagaDe(), 1001, MED, 1, BONUS0, 480, 0).corridas, 0, '1 minuto não dá uma corrida de 75 s');
  assert.strictEqual(A.offline(vagaDe(), 1002, MED, 1, BONUS0, 480, 0).corridas, 1);
});
test('3 dias fora conta só o limite (Foco 1)', function () {
  var r = A.offline(vagaDe(), 1000 + 3 * 24 * 60, MED, 1, BONUS0, 480, 0);
  assert.strictEqual(r.minutos, 480); assert.strictEqual(r.corridas, Math.floor(480 * 60 / 75));
  assert.strictEqual(A.offline(vagaDe(), 1000 + 3 * 24 * 60, MED, 1, BONUS0, 99999, 0).minutos, G.AFK.offlineTetoMin, 'limite pedido acima do teto: vale o teto');
});
test('limite com Aveia e bestiário nunca passa de 720 min', function () {
  assert.strictEqual(A.limiteOffline(0, 0), 480); assert.strictEqual(A.limiteOffline(60, 0), 540); assert.strictEqual(A.limiteOffline(60, 120), 660);
  assert.strictEqual(A.limiteOffline(180, 180), 720); assert.strictEqual(A.limiteOffline(99999, 99999), 720);
  assert.strictEqual(A.limiteOffline(-50, 'x'), 480); assert.strictEqual(A.limiteOffline(NaN, null), 480); assert.strictEqual(A.limiteOffline(), 480);
});
test('offline sem medida completa, com vaga vazia ou entrada estragada: 0 corridas', function () {
  var zero = function (r) { assert.strictEqual(r.corridas, 0); assert.strictEqual(r.xp, 0); assert.deepStrictEqual(r.itens, {}); };
  [null, {}, { p: 0.5 }, { p: NaN, duracaoS: 75 }, { p: 2, duracaoS: 75 }, { p: 0.5, duracaoS: 0 }, { p: 0.5, duracaoS: -3 }].forEach(function (m) { zero(A.offline(vagaDe(), 2000, m, 1, BONUS0, 480, 0)); });
  zero(A.offline(vagaDe({ uid: null }), 2000, MED, 1, BONUS0, 480, 0)); zero(A.offline(vagaDe({ faseId: 'lixo' }), 2000, MED, 1, BONUS0, 480, 0));
  zero(A.offline(vagaDe({ inicioMin: 'x' }), 2000, MED, 1, BONUS0, 480, 0)); zero(A.offline(vagaDe({ contador: -1 }), 2000, MED, 1, BONUS0, 480, 0));
  zero(A.offline(null, 2000, MED, 1, BONUS0, 480, 0)); zero(A.offline(vagaDe(), NaN, MED, 1, BONUS0, 480, 0)); zero(A.offline(vagaDe(), 2000, MED, 1, BONUS0, 480, 7));
  zero(A.offline(vagaDe(), 2000, MED, 1, BONUS0, -10, 0));
});
test('offline de 8 h com p de 0,5 roda em menos de 200 ms no Node; o de 12 h com corridas de 55 s também', function () {
  var t = process.hrtime.bigint();
  var r = A.offline(vagaDe(), 1000 + 480, MED, 31, BONUS0, 480, 0), r2 = A.offline(vagaDe({ faseId: 'agua:4:lendaria' }), 1000 + 720, { p: 0.5, duracaoS: 55 }, 31, BONUS0, 720, 4);
  var ms = Number(process.hrtime.bigint() - t) / 1e6;
  assert.strictEqual(r.corridas, 384); assert.strictEqual(r2.corridas, 785);
  assert.ok(ms < 200, ms.toFixed(1) + ' ms');
});
test('offline rende, em média, o mesmo que ao vivo com o mesmo p (o ganho esperado é o mesmo nos dois modos)', function () {
  // 40 períodos de 8 h com p medido contra as corridas de verdade do mesmo cavalo (800 ao vivo)
  var h = cav('mare', 22), f = 'fogo:4:normal', m = A.medida(medir(h, f));
  var vivoXp = 0, vivoMat = 0, n = 800;
  for (var c = 0; c < n; c++) { var r = A.correr(h, f, 2024, c, BONUS0); vivoXp += r.xp; vivoMat += (r.itens.carvao || 0) + (r.itens['ferro-bruto'] || 0); }
  var offXp = 0, offMat = 0, offN = 0;
  for (var k = 0; k < 40; k++) { var o = A.offline(vagaDe({ faseId: f, contador: 0 }), 1480, m, 9000 + k, BONUS0, 480, 0); offXp += o.xp; offMat += (o.itens.carvao || 0) + (o.itens['ferro-bruto'] || 0); offN += o.corridas; }
  assert.ok(Math.abs(offXp / offN - vivoXp / n) / (vivoXp / n) < 0.05, 'XP por corrida: offline ' + (offXp / offN).toFixed(1) + ' × ao vivo ' + (vivoXp / n).toFixed(1));
  assert.ok(Math.abs(offMat / offN - vivoMat / n) / (vivoMat / n) < 0.06, 'material por corrida: offline ' + (offMat / offN).toFixed(2) + ' × ao vivo ' + (vivoMat / n).toFixed(2));
});

section('baú, bestiário, comida e save');
function ganho(o) { return Object.assign({ vitorias: 0, corridas: 0, xp: 0, ouro: 0, itens: {}, pedras: 0, pecas: [] }, o || {}); }
function afkNovo() { return A.sanear(null, { uids: ['m1', 'm2'], progresso: progCom({ fogo: 5, agua: 2 }), agoraMin: 5000 }); }
test('bauSomar junta Ouro, XP por cavalo, itens, Pedras e peças, sem mutar', function () {
  var b0 = congela(A.bauVazio());
  assert.deepStrictEqual(b0, { ouro: 0, xp: {}, itens: {}, pedras: 0, pecas: [] });
  var b1 = A.bauSomar(b0, ganho({ xp: 40, ouro: 3, itens: { carvao: 2 }, pedras: 1, pecas: [{ id: 'sela-comum', linhas: [] }] }), 'm1');
  var b2 = A.bauSomar(congela(b1), ganho({ xp: 12, ouro: 0, itens: { carvao: 1, feno: 1 } }), 'm2');
  var b3 = A.bauSomar(b2, ganho({ xp: 8, ouro: 2 }), 'm1');
  assert.deepStrictEqual(b3, { ouro: 5, xp: { m1: 48, m2: 12 }, itens: { carvao: 3, feno: 1 }, pedras: 1, pecas: [{ id: 'sela-comum', linhas: [] }] });
  assert.deepStrictEqual(A.bauSomar(null, ganho({ xp: 5 }), 'm1'), { ouro: 0, xp: { m1: 5 }, itens: {}, pedras: 0, pecas: [] });
  assert.strictEqual(A.bauVazioE(b0), true); assert.strictEqual(A.bauVazioE(b3), false);
});
test('coletar com material no teto: perdidos mostra o excedente e o resto entra (Foco 3)', function () {
  var bau = congela({ ouro: 30, xp: { m1: 100 }, itens: { carvao: 10, 'ferro-bruto': 4, 'trofeu-fogo-0': 2, feno: 3 }, pedras: 2, pecas: [{ id: 'sela-sol-raro', linhas: [{ tipo: 'xp', valor: 7 }, { tipo: 'ouro', valor: 5 }] }] });
  var moch = congela({ torrao: 3, carvao: 995, 'ferro-bruto': 999, 'trofeu-fogo-0': 98 });
  var r = A.bauColetar(bau, moch, ['m1']);
  assert.deepStrictEqual(r.perdidos, { carvao: 6, 'ferro-bruto': 4, 'trofeu-fogo-0': 1 });
  assert.deepStrictEqual(r.mochila, { torrao: 3, carvao: 999, 'ferro-bruto': 999, 'trofeu-fogo-0': 99, feno: 3 });
  assert.deepStrictEqual(r.entrou, { carvao: 4, 'trofeu-fogo-0': 1, feno: 3 });
  assert.strictEqual(r.ouro, 30); assert.strictEqual(r.pedras, 2); assert.deepStrictEqual(r.xpPorCavalo, { m1: 100 }); assert.strictEqual(r.xpDescartado, 0);
  assert.deepStrictEqual(r.pecas, bau.pecas); assert.deepStrictEqual(r.bau, A.bauVazio());
  // sem nada no teto, nada se perde
  assert.deepStrictEqual(A.bauColetar(bau, {}, ['m1']).perdidos, {});
  // item fora do AFK no baú (save adulterado) não entra na mochila nem conta como perdido
  var adul = A.bauColetar({ ouro: 0, xp: {}, itens: { torrao: 5, estrela: 1, xyz: 2 }, pedras: 0, pecas: [] }, { torrao: 1 }, []);
  assert.deepStrictEqual(adul.mochila, { torrao: 1 }); assert.deepStrictEqual(adul.perdidos, {});
});
test('coletar com cavalo que sumiu: xpDescartado e os itens entram (Foco 4)', function () {
  var bau = { ouro: 9, xp: { m1: 100, m7: 250, m8: 40 }, itens: { junco: 5 }, pedras: 0, pecas: [] };
  var r = A.bauColetar(bau, {}, ['m1', 'm2']);
  assert.deepStrictEqual(r.xpPorCavalo, { m1: 100 }); assert.strictEqual(r.xpDescartado, 290);
  assert.deepStrictEqual(r.mochila, { junco: 5 }); assert.strictEqual(r.ouro, 9);
});
test('bestiarioRegistrar conta as vitórias por oponente e marca o que caiu como visto; bestiarioObter marca o que entrou', function () {
  var b0 = congela(A.bestiarioVazio());
  var b1 = A.bestiarioRegistrar(b0, ganho({ itens: { carvao: 2, 'trofeu-fogo-2': 1 }, pecas: [{ id: 'sela-sol-raro', linhas: [] }] }), 'fogo:2', true);
  assert.deepStrictEqual(b1.vitorias, { 'fogo:2': 1 }); assert.deepStrictEqual(Object.keys(b1.vistos).sort(), ['carvao', 'sela-sol-raro', 'trofeu-fogo-2']); assert.deepStrictEqual(b1.obtidos, {});
  var b2 = A.bestiarioRegistrar(b1, ganho({ itens: { carvao: 1 } }), 'fogo:2', false);
  assert.deepStrictEqual(b2.vitorias, { 'fogo:2': 1 }, 'derrota não conta');
  // offline: várias vitórias de uma vez
  var b3 = A.bestiarioRegistrar(b2, ganho({ vitorias: 37, corridas: 60 }), 'fogo:2', true);
  assert.strictEqual(b3.vitorias['fogo:2'], 38);
  var b4 = A.bestiarioObter(b3, { carvao: 2 }, [{ id: 'sela-sol-raro', linhas: [] }]);
  assert.deepStrictEqual(Object.keys(b4.obtidos).sort(), ['carvao', 'sela-sol-raro']); assert.ok(b4.vistos.carvao && b4.vistos['sela-sol-raro'], 'obtido também é visto');
  assert.deepStrictEqual(A.bestiarioRegistrar(b0, ganho(), 'lixo:9', true), b0, 'oponente inválido não conta');
});
function bestCom(vit, obt) { var b = A.bestiarioVazio(); Object.keys(vit || {}).forEach(function (k) { b.vitorias[k] = vit[k]; }); (obt || []).forEach(function (id) { b.obtidos[id] = true; b.vistos[id] = true; }); return b; }
function paginaIds(g) { return A.bestiarioPagina(A.bestiarioVazio(), g).itens.map(function (x) { return x.id; }); }
test('bônus do bestiário: +1% de drop raro por oponente com 100 vitórias, +2% de XP por oponente com 1.000, +2% de troféu por troféu', function () {
  assert.deepStrictEqual(A.bestiarioBonus(A.bestiarioVazio()), { raro: 0, xp: 0, trofeu: 0, offlineMin: 0 });
  var b = bestCom({ 'fogo:0': 100, 'fogo:1': 99, 'agua:4': 1000, 'grama:2': 5000 }, ['trofeu-fogo-0', 'trofeu-agua-3', 'carvao']);
  var bo = A.bestiarioBonus(b);
  assert.ok(Math.abs(bo.raro - 0.03) < 1e-9, 'três com 100 ou mais: ' + bo.raro); assert.ok(Math.abs(bo.xp - 0.04) < 1e-9, 'dois com 1.000: ' + bo.xp);
  assert.ok(Math.abs(bo.trofeu - 0.04) < 1e-9, 'dois troféus: ' + bo.trofeu); assert.strictEqual(bo.offlineMin, 0);
});
test('bônus do bestiário respeita os tetos (15%, 30%, 30%, 180 min)', function () {
  var vit = {}, obt = [];
  G.GYM_ORDER.forEach(function (g) { for (var e = 0; e < 5; e++) vit[g + ':' + e] = 99999; obt = obt.concat(paginaIds(g)); });
  var bo = A.bestiarioBonus(bestCom(vit, obt));
  assert.ok(Math.abs(bo.raro - 0.15) < 1e-9); assert.ok(Math.abs(bo.xp - 0.30) < 1e-9); assert.ok(Math.abs(bo.trofeu - 0.30) < 1e-9); assert.strictEqual(bo.offlineMin, 180);
  // números de partida maiores não furam o teto
  var K = G.AFK.bestiario, guarda = [K.raro.por, K.xp.por, K.trofeu.por, K.pagina.min];
  try { K.raro.por = 0.5; K.xp.por = 0.5; K.trofeu.por = 0.5; K.pagina.min = 500;
    assert.deepStrictEqual(A.bestiarioBonus(bestCom(vit, obt)), { raro: 0.15, xp: 0.30, trofeu: 0.30, offlineMin: 180 });
  } finally { K.raro.por = guarda[0]; K.xp.por = guarda[1]; K.trofeu.por = guarda[2]; K.pagina.min = guarda[3]; }
});
test('página completa dá +60 min: os 5 oponentes com 1.000 vitórias e tudo obtido (3 materiais, 10 peças do conjunto, 5 troféus)', function () {
  var ids = paginaIds('agua');
  assert.strictEqual(ids.length, 18);
  assert.deepStrictEqual(ids.slice(0, 3), ['junco', 'concha', 'perola-de-rio']);
  assert.strictEqual(ids.filter(function (id) { return G.GEAR[id] && G.GEAR[id].set === 'chuva'; }).length, 10);
  assert.strictEqual(ids.filter(function (id) { return /^trofeu-agua-/.test(id); }).length, 5);
  var vit = {}; for (var e = 0; e < 5; e++) vit['agua:' + e] = 1000;
  var cheia = bestCom(vit, ids), pg = A.bestiarioPagina(cheia, 'agua');
  assert.strictEqual(pg.completa, true); assert.strictEqual(A.bestiarioBonus(cheia).offlineMin, 60);
  assert.deepStrictEqual(pg.oponentes.map(function (o) { return o.marcos; }), [[true, true, true], [true, true, true], [true, true, true], [true, true, true], [true, true, true]]);
  assert.strictEqual(pg.oponentes[4].nome, 'Mestre Aguaceiro'); assert.strictEqual(pg.oponentes[2].id, 'agua:2');
  // falta um troféu, ou um oponente com 999: não completa
  assert.strictEqual(A.bestiarioBonus(bestCom(vit, ids.slice(0, 17))).offlineMin, 0);
  var quase = JSON.parse(JSON.stringify(vit)); quase['agua:3'] = 999;
  assert.strictEqual(A.bestiarioPagina(bestCom(quase, ids), 'agua').completa, false);
  assert.deepStrictEqual(A.bestiarioPagina(bestCom({ 'agua:1': 150 }, ['junco']), 'agua').oponentes[1].marcos, [true, true, false]);
  var pv = A.bestiarioPagina(bestCom({}, ['junco']), 'agua').itens[0];
  assert.deepStrictEqual(pv, { id: 'junco', tipo: 'item', visto: true, obtido: true });
  assert.strictEqual(A.bestiarioPagina(A.bestiarioVazio(), 'lava'), null);
});
test('comida: Feno, Cenoura e Maçã dão XP ao cavalo escolhido; a Aveia soma 60 min só ao próximo offline e zera depois', function () {
  var afk = afkNovo(), h = cav('mare', 5);
  assert.deepStrictEqual(A.usarComida('feno', h, afk), { ok: true, xp: 200 });
  assert.deepStrictEqual(A.usarComida('cenoura', h, afk), { ok: true, xp: 500 });
  assert.deepStrictEqual(A.usarComida('maca', h, afk), { ok: true, xp: 1200 });
  assert.deepStrictEqual(A.usarComida('feno', null, afk), { ok: false, motivo: 'Escolha um cavalo.' });
  var topo = cav('mare', G.ECONOMY.maxLevel);
  assert.strictEqual(A.usarComida('feno', topo, afk).ok, false, 'no nível máximo a comida não é gasta');
  assert.strictEqual(afk.aveiaMin, 0);
  var a1 = A.usarComida('aveia-dourada', null, afk);
  assert.deepStrictEqual(a1, { ok: true, aveiaMin: 60 });
  afk.aveiaMin = a1.aveiaMin;
  assert.strictEqual(A.limiteOffline(afk.aveiaMin, 0), 540);
  // dentro do teto de 720 min: com 240 min de Aveia (ou 180 do bestiário + 60), outra não entra
  afk.aveiaMin = 240;
  assert.deepStrictEqual(A.usarComida('aveia-dourada', null, afk), { ok: false, motivo: 'O próximo período fora já está no limite de 12 horas.' });
  afk.aveiaMin = 60;
  assert.strictEqual(A.usarComida('aveia-dourada', null, afk, 180).ok, false, 'com +3 h do bestiário e 1 h de Aveia, já são 12 h');
  assert.strictEqual(A.usarComida('aveia-dourada', null, afk, 120).aveiaMin, 120);
  // zera quando o offline é contado
  assert.strictEqual(A.aposOffline(afk).aveiaMin, 0); assert.strictEqual(afk.aveiaMin, 60, 'sem mutar');
  ['torrao', 'carvao', 'trofeu-fogo-0', 'pergaminho-reforja', 'xyz', null].forEach(function (id) { assert.strictEqual(A.usarComida(id, h, afk).ok, false, String(id)); });
});
test('save antigo migra com afk vazio e a 1ª vaga liberada', function () {
  var a = A.sanear(undefined, { uids: ['m1'], progresso: progCom({}), agoraMin: 777 });
  assert.deepStrictEqual(a, { vagas: [{ uid: null, faseId: null, inicioMin: 0, contador: 0, medida: null }], bau: A.bauVazio(), vitorias: {}, bestiario: A.bestiarioVazio(), aveiaMin: 0, xpCounter: 0 });
  assert.deepStrictEqual(A.sanear('lixo', { uids: [], progresso: null, agoraMin: 777 }), a);
  assert.deepStrictEqual(A.sanear(a, { uids: ['m1'], progresso: progCom({}), agoraMin: 900 }), a, 'saneado de novo: igual (o início guardado fica)');
});
test('save com vaga de uid inexistente fica com a vaga vazia; fase ou dificuldade não liberada também; o contador fica', function () {
  var ctx = { uids: ['m1', 'm2'], progresso: progCom({ fogo: 2 }), agoraMin: 5000 };
  var med = A.medirPasso(null, cav('mare', 9), 'fogo:1:normal', 20);
  var bruto = { vagas: [
    { uid: 'm1', faseId: 'fogo:1:normal', inicioMin: 4000, contador: 12, medida: med },
    { uid: 'm9', faseId: 'fogo:0:normal', inicioMin: 4100, contador: 7, medida: null },          // cavalo que não existe
    { uid: 'm2', faseId: 'fogo:3:normal', inicioMin: 4200, contador: 3, medida: null },          // etapa não vencida no ginásio
    { uid: 'm2', faseId: 'fogo:0:dificil', inicioMin: 4300, contador: 5, medida: null },         // Difícil sem as 50 vitórias
    { uid: 'm1', faseId: 'fogo:0:normal', inicioMin: 4400, contador: 2, medida: null },          // cavalo repetido (já está na vaga 1)
    { uid: 'm2', faseId: 'fogo:0:normal', inicioMin: 1, contador: 1, medida: null }              // 6ª vaga: não existe
  ], vitorias: { 'fogo:0:normal': 49 } };
  var a = A.sanear(bruto, ctx);
  assert.strictEqual(a.vagas.length, 5);
  assert.deepStrictEqual(a.vagas[0], { uid: 'm1', faseId: 'fogo:1:normal', inicioMin: 4000, contador: 12, medida: med });
  [1, 2, 3, 4].forEach(function (i) { assert.strictEqual(a.vagas[i].uid, null, 'vaga ' + i); assert.strictEqual(a.vagas[i].faseId, null); assert.strictEqual(a.vagas[i].medida, null); assert.strictEqual(a.vagas[i].inicioMin, 0, 'vaga vazia não tem início'); });
  assert.deepStrictEqual(a.vagas.map(function (v) { return v.contador; }), [12, 7, 3, 5, 2], 'o contador de cada vaga nunca volta');
  // com as 50 vitórias, a Difícil vale
  bruto.vitorias['fogo:0:normal'] = 50;
  assert.strictEqual(A.sanear(bruto, ctx).vagas[3].faseId, 'fogo:0:dificil');
});
test('sanear: números fora da faixa, medida de outra configuração, baú e bestiário com lixo', function () {
  var ctx = { uids: ['m1'], progresso: progCom({ fogo: 5 }), agoraMin: 5000 };
  var a = A.sanear({
    vagas: [{ uid: 'm1', faseId: 'fogo:0:normal', inicioMin: 'ontem', contador: -4, medida: { chave: 5, feitos: 3 } }, null, 'x'],
    bau: { ouro: -5, xp: { m1: 10.5, m2: 'x', m3: 40, '': 3 }, itens: { carvao: 3, torrao: 9, feno: -1, junco: 2.5, xyz: 1, concha: 2e9 }, pedras: 'muitas',
      pecas: [{ id: 'sela-comum', linhas: [] }, { id: 'sela-magico', linhas: [] }, { id: 'nada', linhas: [] }, { id: 'sela-sol-raro', linhas: [{ tipo: 'xp', valor: 7 }, { tipo: 'xp', valor: 8 }] },
        { id: 'sela-sol-raro', linhas: [{ tipo: 'xp', valor: 7 }, { tipo: 'ouro', valor: 5 }] }, null] },
    vitorias: { 'fogo:0:normal': 12, 'fogo:1:normal': -3, 'lixo': 9, 'fogo:2:normal': 1.5, 'agua:0:normal': 4 },
    bestiario: { vitorias: { 'fogo:1': 30, 'lava:0': 5, 'fogo:9': 2, 'fogo:2': -1 }, vistos: { carvao: true, torrao: true, 'sela-sol-raro': 1, xyz: true }, obtidos: { carvao: true, junco: 'sim', estrela: true } },
    aveiaMin: 9999, xpCounter: -2
  }, ctx);
  assert.strictEqual(a.vagas.length, 3);
  assert.deepStrictEqual(a.vagas[0], { uid: 'm1', faseId: 'fogo:0:normal', inicioMin: 5000, contador: 0, medida: null });
  assert.deepStrictEqual(a.vagas[1], { uid: null, faseId: null, inicioMin: 0, contador: 0, medida: null });
  assert.deepStrictEqual(a.bau, { ouro: 0, xp: { m3: 40 }, itens: { carvao: 3, concha: 1000000 }, pedras: 0,
    pecas: [{ id: 'sela-comum', linhas: [] }, { id: 'sela-sol-raro', linhas: [{ tipo: 'xp', valor: 7 }, { tipo: 'ouro', valor: 5 }] }] });
  assert.deepStrictEqual(a.vitorias, { 'fogo:0:normal': 12, 'agua:0:normal': 4 });
  assert.deepStrictEqual(a.bestiario, { vitorias: { 'fogo:1': 30 }, vistos: { carvao: true, 'sela-sol-raro': true }, obtidos: { carvao: true } });
  assert.strictEqual(a.aveiaMin, G.AFK.offlineTetoMin - G.AFK.offlineMin); assert.strictEqual(a.xpCounter, 0);
  // início no futuro (relógio voltado para trás) fica como está: não rende até o relógio passar dele
  assert.strictEqual(A.sanear({ vagas: [{ uid: 'm1', faseId: 'fogo:0:normal', inicioMin: 9000, contador: 1, medida: null }] }, ctx).vagas[0].inicioMin, 9000);
});
test('peça antiga (sem linhas) ganha as linhas pela seed do save e pelo uid: as mesmas em duas cargas; linhas válidas ficam; lixo é sorteado de novo', function () {
  var it = congela({ uid: 'i7', id: 'sela-sol-raro', plus: 4 });
  var a = GR.linhasDaPeca(it, 4242), b = GR.linhasDaPeca(it, 4242);
  assert.deepStrictEqual(a, b); assert.strictEqual(a.length, 2); assert.ok(GR.linhasValidas(it.id, a));
  assert.deepStrictEqual(a, GR.sortearLinhas('raro', S.mulberry32(S.hash2(4242, 0x20000000 + 7))));
  var dif = 0; for (var k = 1; k <= 20; k++) if (JSON.stringify(GR.linhasDaPeca({ uid: 'i' + k, id: 'sela-sol-raro' }, 4242)) !== JSON.stringify(a)) dif++;
  assert.ok(dif >= 15, 'cada peça tem as suas linhas');
  assert.notDeepStrictEqual(GR.linhasDaPeca(it, 4243), a, 'outro save, outras linhas');
  var boas = [{ tipo: 'trofeu', valor: 15 }, { tipo: 'raro', valor: 6 }];
  assert.deepStrictEqual(GR.linhasDaPeca({ uid: 'i7', id: 'sela-sol-raro', linhas: boas }, 4242), boas);
  [[{ tipo: 'trofeu', valor: 15 }], [{ tipo: 'trofeu', valor: 99 }, { tipo: 'raro', valor: 6 }], [{ tipo: 'raro', valor: 6 }, { tipo: 'raro', valor: 7 }], [{ tipo: 'vel', valor: 6 }, { tipo: 'raro', valor: 7 }],
    [{ tipo: 'trofeu', valor: 15.5 }, { tipo: 'raro', valor: 6 }], 'x', null].forEach(function (ruim, i) {
    assert.deepStrictEqual(GR.linhasDaPeca({ uid: 'i7', id: 'sela-sol-raro', linhas: ruim }, 4242), a, 'lixo ' + i);
  });
  assert.deepStrictEqual(GR.linhasDaPeca({ uid: 'i3', id: 'sela-comum' }, 4242), []); assert.strictEqual(GR.linhasDaPeca({ uid: 'i3', id: 'sela-magico' }, 4242).length, 1);
  assert.strictEqual(GR.linhasDaPeca({ uid: 'i3', id: 'sela-sol-lendario' }, 4242).length, 3); assert.deepStrictEqual(GR.linhasDaPeca({ uid: 'i3', id: 'nada' }, 4242), []);
  assert.deepStrictEqual(GR.linhasDaPeca(null, 1), []);
});
test('creditar: o ganho de uma vaga vai para o baú, as vitórias da fase, o bestiário e o contador, sem mutar', function () {
  var afk = afkNovo(); afk.vagas[0] = { uid: 'm1', faseId: 'fogo:2:normal', inicioMin: 5000, contador: 9, medida: null };
  congela(afk);
  var r = A.correr(cav('mare', 14), 'fogo:2:normal', 88, 9, BONUS0, { vaga: 0 });
  var n = A.creditar(afk, 0, r);
  assert.strictEqual(n.vagas[0].contador, 10); assert.strictEqual(n.bau.xp.m1, r.xp); assert.strictEqual(n.bau.ouro, r.ouro);
  assert.strictEqual(n.vitorias['fogo:2:normal'] || 0, r.venceu ? 1 : 0); assert.strictEqual(n.bestiario.vitorias['fogo:2'] || 0, r.venceu ? 1 : 0);
  // offline: avança corridas, soma as vitórias
  var off = A.offline(afk.vagas[0], 5000 + 240, { p: 0.6, duracaoS: 75 }, 88, BONUS0, 480, 0), n2 = A.creditar(afk, 0, off);
  assert.strictEqual(n2.vagas[0].contador, 9 + off.corridas); assert.strictEqual(n2.vitorias['fogo:2:normal'], off.vitorias); assert.strictEqual(n2.bestiario.vitorias['fogo:2'], off.vitorias);
  assert.strictEqual(n2.bau.xp.m1, off.xp); assert.deepStrictEqual(n2.bau.itens, off.itens);
  assert.strictEqual(A.creditar(afk, 3, r), null, 'vaga que não existe'); assert.strictEqual(A.creditar(afk, 1, r), null, 'vaga vazia');
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
