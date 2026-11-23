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
