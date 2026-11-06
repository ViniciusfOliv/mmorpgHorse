// prototype/tools/sim-test.js — node prototype/tools/sim-test.js
'use strict';
var assert = require('assert');
var G = require('../src/data.js');
var S = require('../src/sim.js');
var B = require('../src/breed.js');
var fails = 0, count = 0;
function section(t) { console.log('\n## ' + t); }
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
  var mk = function (r, lv) { return { rarity: r, level: lv }; };
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

section('corrida');
function mk(over) { var h = JSON.parse(JSON.stringify(G.WILD_HORSES[0])); h.rarity = 'mitico'; h.level = 1; h.element = 'neutro'; h.skills = [];
  G.STAT_KEYS.forEach(function (k) { h.base[k] = 60; h.potential[k] = 0; }); for (var k in over) h.base[k] = over[k]; return h; }
function race(seed, cond, horses) { return S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: horses.map(function (h, i) { return { horse: h, itemId: null, name: 'r' + i, isPlayer: i === 0 }; }) }); }
var CURVA = { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 200 }, { type: 'curva', from: 200, to: 1400 }, { type: 'reta', from: 1400, to: 1600 }] };
var RETA = { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 1600 }] };
var SUBIDA = { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 200 }, { type: 'subida', from: 200, to: 1400 }, { type: 'reta', from: 1400, to: 1600 }] };
test('determinismo: mesma seed, mesmo JSON; sem tactic/form na saída', function () {
  var a = race(42, S.randomConditions(42), [mk({}), mk({ vel: 90 })]), b = race(42, S.randomConditions(42), [mk({}), mk({ vel: 90 })]);
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); assert.strictEqual(a.racerInfo[0].tactic, undefined); assert.strictEqual(a.racerInfo[0].form, undefined);
});
test('especialista de curva vence o de reta em mapa 75% curva (≥ 55% de 80)', function () {
  var w = 0; for (var s = 0; s < 80; s++) if (race(s, CURVA, s % 2 ? [mk({ man: 90 }), mk({ vel: 90 })] : [mk({ vel: 90 }), mk({ man: 90 })]).finishOrder[0] === (s % 2 ? 0 : 1)) w++;
  assert.ok(w >= 44, 'curva venceu ' + w + '/80');
});
test('especialista de reta vence o de curva em reta pura; de subida vence em subida', function () {
  var w = 0, h = 0;
  for (var s = 0; s < 80; s++) { if (race(s, RETA, [mk({ vel: 90 }), mk({ man: 90 })]).finishOrder[0] === 0) w++; if (race(s, SUBIDA, [mk({ forca: 90 }), mk({ vel: 90 })]).finishOrder[0] === 0) h++; }
  assert.ok(w >= 44 && h >= 44, 'reta ' + w + ', subida ' + h);
});
test('weatherMult: dono T.weatherMult (1,03–1,07), dobrado 1.10, penalizado 2 − T.weatherMult, neutro 1', function () {
  var wm = S.TUNING.weatherMult; assert.ok(wm >= 1.03 && wm <= 1.07, 'weatherMult ' + wm);
  assert.strictEqual(S.weatherMult('fogo', 'sol', false), wm); assert.strictEqual(S.weatherMult('fogo', 'sol', true), 1.10);
  assert.ok(Math.abs(S.weatherMult('grama', 'sol', false) - (2 - wm)) < 1e-9); assert.strictEqual(S.weatherMult('agua', 'sol', false), 1); assert.strictEqual(S.weatherMult('neutro', 'chuva', false), 1);
});
test('skills disparam pela chance: mítico lv50 sorte 100 ativa Arranque ≥ 85% das vezes; comum lv1 sorte 0 ≤ 50%', function () {
  var hi = mk({ sorte: 100 }); hi.level = 50; hi.skills = ['arranque']; var lo = mk({ sorte: 0 }); lo.rarity = 'comum'; lo.skills = ['arranque'];
  var a = 0, b = 0; for (var s = 0; s < 200; s++) { if (race(s, RETA, [hi, mk({})]).events.some(function (e) { return e.type === 'skill' && e.racer === 0; })) a++; if (race(s, RETA, [lo, mk({})]).events.some(function (e) { return e.type === 'skill' && e.racer === 0; })) b++; }
  assert.ok(a >= 170 && b <= 100, 'alto ' + a + ', baixo ' + b);
});
test('sim: mapa com bloco de 10 m não duplica gatilhos', function () {
  var cond = { distance: 1000, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 300 }, { type: 'curva', from: 300, to: 310 }, { type: 'reta', from: 310, to: 1000 }] };
  var h = mk({ sorte: 100 }); h.level = 50; h.skills = ['drift', 'saida-rapida', 'sprint'];
  var ev = race(3, cond, [h, mk({})]).events.filter(function (e) { return e.type === 'skill' && e.racer === 0; }).map(function (e) { return e.text; });
  assert.ok(ev.length <= 3, ev.join(' | ')); assert.strictEqual(ev.filter(function (t) { return /Drift/.test(t); }).length <= 1, true);
});
test('straight só dispara em reta de 150 m ou mais (e dispara na reta final longa)', function () {
  var cond = { distance: 1000, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 300 }, { type: 'curva', from: 300, to: 400 }, { type: 'reta', from: 400, to: 500 }, { type: 'curva', from: 500, to: 600 }, { type: 'reta', from: 600, to: 1000 }] };
  var h = mk({ sorte: 100 }); h.level = 50; h.skills = ['sprint'];
  var fired = 0;
  for (var s = 0; s < 20; s++) {
    var res = S.simulate({ seed: s, conditions: cond, recordFrames: true, racers: [h, mk({})].map(function (x, i) { return { horse: x, itemId: null, name: 'r' + i }; }) });
    var t600 = null; for (var f = 0; f < res.frames.length; f++) if (res.frames[f].pos[0] >= 600) { t600 = res.frames[f].t; break; }
    res.events.forEach(function (e) { if (e.type === 'skill' && e.racer === 0) assert.ok(e.t >= t600 - 0.1, 'seed ' + s + ': Sprint em t=' + e.t + ' antes de 600 m (t=' + t600 + ')'); });
    if (res.events.some(function (e) { return e.type === 'skill' && e.racer === 0 && e.t >= t600 - 0.1; })) fired++;
  }
  assert.ok(fired >= 15, 'Sprint disparou na reta final em só ' + fired + '/20 seeds');
});

section('dado');
test('rollDice: sorte 0 = 1 dado em 1..100; sorte 100 = 2 dados; média do melhor sobe', function () {
  var rng = S.mulberry32(9), sum0 = 0, sum100 = 0;
  for (var i = 0; i < 5000; i++) { var a = S.rollDice(rng, 0, 0); assert.strictEqual(a.dice.length, 1); assert.ok(a.best >= 1 && a.best <= 100); sum0 += a.best; }
  for (i = 0; i < 5000; i++) { var b = S.rollDice(rng, 100, 0); assert.strictEqual(b.dice.length, 2); sum100 += b.best; }
  assert.ok(sum0 / 5000 > 48 && sum0 / 5000 < 53); assert.ok(sum100 / 5000 > 64 && sum100 / 5000 < 70);
});
test('rollDice limita: sorte 250 → 2 dados; extraDice 5 → no máximo 3 dados', function () {
  var r = S.rollDice(S.mulberry32(1), 250, 5); assert.ok(r.dice.length <= 3 && r.dice.length >= 2);
});
test('Sorte 100 contra sete de Sorte 0 vence o dado 18–28%', function () {
  var rng = S.mulberry32(77), w = 0, N = 4000;
  for (var i = 0; i < N; i++) { var me = S.rollDice(rng, 100, 0).best, top = 0; for (var j = 0; j < 7; j++) top = Math.max(top, S.rollDice(rng, 0, 0).best); if (me > top) w++; }
  var p = 100 * w / N; assert.ok(p >= 18 && p <= 28, p + '%');
});
test('corrida tem 2 eventos dado (1/3 e 2/3) e o clima vira para o elemento do vencedor', function () {
  var hs = [mk({}), mk({}), mk({})]; hs[0].element = 'fogo'; hs[1].element = 'agua'; hs[2].element = 'grama';
  var res = race(5, S.randomConditions(5), hs), ds = res.events.filter(function (e) { return e.type === 'dado'; });
  assert.strictEqual(ds.length, 2); assert.ok(Math.abs(ds[0].at - 1 / 3) < 1e-9 && Math.abs(ds[1].at - 2 / 3) < 1e-9);
  ds.forEach(function (d) { assert.strictEqual(d.rolls.length, 3); var w = d.rolls[d.winner]; d.rolls.forEach(function (r) { assert.ok(r.best <= w.best); });
    assert.strictEqual(d.weather, G.ELEMENTS[hs[d.winner].element].weather); });
  assert.ok(/🎲/.test(ds[0].text));
});
test('dado: clima segura quando todos são do mesmo elemento', function () {
  var hs = [mk({}), mk({})]; hs[0].element = hs[1].element = 'agua';
  var res = race(8, { distance: 1200, surface: 'grama', weather: 'chuva', blocks: [{ type: 'reta', from: 0, to: 1200 }] }, hs);
  res.events.filter(function (e) { return e.type === 'dado'; }).forEach(function (d) { assert.strictEqual(d.changed, false); assert.strictEqual(d.weather, 'chuva'); });
  assert.strictEqual(res.events.filter(function (e) { return e.type === 'clima'; }).length, 0); assert.strictEqual(res.weatherFinal, 'chuva');
});

section('dados v3');
test('baseLo por raridade e grau em todas as montarias', function () {
  assert.deepStrictEqual(['comum','magico','raro','lendario','mitico'].map(function (r) { return G.RARITIES[r].baseLo; }), [36, 44, 52, 60, 68]);
  G.STARTERS.concat(G.WILD_HORSES).forEach(function (h) { assert.ok(h.grau >= 1 && h.grau <= 3, h.id + ' grau'); });
  assert.strictEqual(G.STARTERS[0].grau, 2); assert.strictEqual(G.WILD_HORSES.filter(function (h) { return h.id === 'w-boitata'; })[0].grau, 3);
});
test('nomes de potro e economia do cruzamento', function () {
  assert.ok(G.FOAL_NAMES.length >= 30); G.FOAL_NAMES.forEach(function (n) { assert.ok(n.length >= 2 && n.length <= 12, n); });
  var B = G.ECONOMY.breeding;
  assert.deepStrictEqual(B.rentalBase, { comum: 100, magico: 250, raro: 600, lendario: 1500 });
  assert.deepStrictEqual(B.grauMult, [1, 1.25, 1.5]); assert.strictEqual(B.stableSlotsStart, 3); assert.strictEqual(B.stableSlotsMax, 8);
  assert.strictEqual(B.levelSaturation, 30); assert.strictEqual(B.mareWeight, 0.6); assert.deepStrictEqual(G.BREED_LEFT, { m: 2, f: 1 });
});

section('cruzamento');
function mk2(o) { return { uid: o.uid || 'x', name: o.name || 'X', element: o.element || 'fogo', rarity: o.rarity || 'raro', grau: o.grau || 2, sex: o.sex || 'm', level: o.level == null ? 30 : o.level,
  skills: o.skills || [], base: { vel: 60, acel: 60, man: 60, forca: 60, est: 60, garra: 60, sorte: 60 }, potential: o.potential || { vel: 10, acel: 10, man: 10, forca: 10, est: 10, garra: 10, sorte: 10 },
  palette: o.palette || { coat: '#c4471d', coatShade: '#7f2a0e', mane: '#ffb02e', accent: '#ffe066' } }; }
function near(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= tol, msg + ': ' + a + ' vs ' + b); }
test('levelFactor satura no 30 e pesa a égua', function () {
  assert.strictEqual(B.levelFactor(mk2({ sex: 'f', level: 30 }), mk2({ level: 30 })), 1);
  near(B.levelFactor(mk2({ sex: 'f', level: 1 }), mk2({ level: 1 })), 1 / 30, 1e-9, 'lv1');
  near(B.levelFactor(mk2({ sex: 'f', level: 30 }), mk2({ level: 0 })), 0.6, 1e-9, 'égua 60%');
  assert.strictEqual(B.levelFactor(mk2({ sex: 'f', level: 50 }), mk2({ level: 50 })), 1);
});
test('rarityOdds: dois Raros nível 30 = Mágico 30 / Raro 65 / Lendário 5 / Mítico 0', function () {
  var o = B.rarityOdds(mk2({ sex: 'f' }), mk2({}));
  near(o.magico, 0.30, 1e-9, 'magico'); near(o.raro, 0.65, 1e-9, 'raro'); near(o.lendario, 0.05, 1e-9, 'lendario'); assert.strictEqual(o.mitico, 0); near(o.comum, 0, 1e-9, 'comum');
});
test('rarityOdds: Raro × Lendário nível 30 = Mágico 20 / Raro 50 / Lendário 30; dois Comuns nível 1 = Comum 99 / Mágico 1', function () {
  var o = B.rarityOdds(mk2({ sex: 'f', rarity: 'raro' }), mk2({ rarity: 'lendario' }));
  near(o.magico, 0.20, 1e-9, 'm'); near(o.raro, 0.50, 1e-9, 'r'); near(o.lendario, 0.30, 1e-9, 'l');
  var c = B.rarityOdds(mk2({ sex: 'f', rarity: 'comum', level: 1 }), mk2({ rarity: 'comum', level: 1 }));
  // L = 1/30: "1 abaixo" (44,5%) cai em Comum; igual 54,37%; 1 acima 1,117%; 2 acima 0,017%
  near(c.comum, 0.9887, 0.002, 'comum'); near(c.magico, 0.0112, 0.002, 'magico'); assert.ok(c.raro < 0.001 && c.lendario === 0 && c.mitico === 0);
});
test('grauOdds e rollGrau', function () {
  var g = B.grauOdds(mk2({ sex: 'f', grau: 2 }), mk2({ grau: 2 }));
  near(g[1], 0.10, 1e-9, 'desce'); near(g[2], 0.50, 1e-9, 'mantém'); near(g[3], 0.40, 1e-9, 'sobe');
  var top = B.grauOdds(mk2({ sex: 'f', grau: 3 }), mk2({ grau: 3 })); near(top[3], 0.90, 1e-9, '★★★ mantém+sobe');
  assert.strictEqual(B.rollGrau(S.mulberry32(1), mk2({ sex: 'f' }), mk2({}), 1), 1); assert.strictEqual(B.rollGrau(S.mulberry32(1), mk2({ sex: 'f' }), mk2({}), -1), 3);
});
test('rollRarity reproduz as chances em 20 mil sorteios e nunca dá mítico', function () {
  var rng = S.mulberry32(777), n = { comum: 0, magico: 0, raro: 0, lendario: 0, mitico: 0 };
  for (var i = 0; i < 20000; i++) n[B.rollRarity(rng, mk2({ sex: 'f' }), mk2({}))]++;
  near(n.magico / 200, 30, 2, 'magico %'); near(n.raro / 200, 65, 2, 'raro %'); near(n.lendario / 200, 5, 1, 'lendario %'); assert.strictEqual(n.mitico, 0);
  var nl = { comum: 0, magico: 0, raro: 0, lendario: 0, mitico: 0 }, r2 = S.mulberry32(778);
  for (i = 0; i < 20000; i++) nl[B.rollRarity(r2, mk2({ sex: 'f', rarity: 'lendario' }), mk2({ rarity: 'lendario' }))]++;
  assert.strictEqual(nl.mitico, 0); near(nl.lendario / 200, 70, 2, 'dois lendários: 65 + 5 dobrado');
});
test('rentalPrice e isCorcel', function () {
  assert.strictEqual(B.rentalPrice(mk2({ rarity: 'comum', grau: 2 })), 125); assert.strictEqual(B.rentalPrice(mk2({ rarity: 'lendario', grau: 3 })), 2250);
  assert.strictEqual(B.rentalPrice(mk2({ rarity: 'mitico', grau: 3 })), null);
  assert.strictEqual(B.isCorcel(mk2({ rarity: 'raro', skills: ['arranque', 'sprint', 'drift'] })), true);
  assert.strictEqual(B.isCorcel(mk2({ rarity: 'raro', skills: ['arranque', 'sprint'] })), false);
});
test('foal é determinístico e tem o formato da spec', function () {
  var f = mk2({ uid: 'm1', name: 'Maré', sex: 'f', element: 'agua' }), m = mk2({ uid: 'm2', name: 'Brasa', element: 'fogo' });
  var a = B.foal({ f: f, m: m, seedBase: 123, breedCounter: 0, nextUid: 3 }), b = B.foal({ f: f, m: m, seedBase: 123, breedCounter: 0, nextUid: 3 });
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b)); assert.strictEqual(a.uid, 'm3'); assert.strictEqual(a.templateId, null); assert.strictEqual(a.level, 1);
  assert.ok(a.element === 'agua' || a.element === 'fogo'); assert.ok(a.sex === 'm' || a.sex === 'f'); assert.strictEqual(a.breedLeft, G.BREED_LEFT[a.sex]);
  assert.deepStrictEqual(a.parents, { f: { uid: 'm1', name: 'Maré' }, m: { uid: 'm2', name: 'Brasa' } }); assert.strictEqual(a.born, 0); assert.strictEqual(a.gestacao, null);
  assert.ok(G.FOAL_NAMES.indexOf(a.name) >= 0); assert.ok(/^#[0-9a-f]{6}$/.test(a.palette.coat));
  assert.notStrictEqual(JSON.stringify(a), JSON.stringify(B.foal({ f: f, m: m, seedBase: 123, breedCounter: 1, nextUid: 3 })));
});
test('status na janela do grau, potencial ≥ piso, skills dentro das vagas e compatíveis', function () {
  for (var s = 0; s < 2000; s++) {
    var f = mk2({ sex: 'f', skills: ['labareda', 'sprint'], element: 'fogo' }), m = mk2({ skills: ['pe-na-chuva', 'drift'], element: 'agua' });
    var c = B.foal({ f: f, m: m, seedBase: s, breedCounter: 0, nextUid: 1 });
    var lo = G.RARITIES[c.rarity].baseLo, w = B.GRAU_WINDOW[c.grau - 1];
    G.STAT_KEYS.forEach(function (k) { assert.ok(c.base[k] >= lo + w[0] && c.base[k] <= lo + w[1], 'base ' + k); assert.ok(c.potential[k] >= B.GRAU_POT_FLOOR[c.grau - 1] && c.potential[k] <= 31, 'pot ' + k); });
    var R = G.RARITIES[c.rarity]; assert.ok(c.skills.length <= R.skillSlots && c.skills.length >= Math.min(R.bornSkills, R.skillSlots), 'skills ' + c.skills.join());
    c.skills.forEach(function (id) { var sk = G.SKILLS[id]; assert.ok(sk && !sk.exclusive, 'exclusiva ' + id); assert.ok(sk.element === 'neutro' || sk.element === c.element, 'elemento ' + id); });
    assert.strictEqual(new Set(c.skills).size, c.skills.length); assert.notStrictEqual(c.rarity, 'mitico');
  }
});
test('raridade subiu ⇒ ★, desceu ⇒ ★★★; elemento igual ⇒ igual, diferente ⇒ ~50/50', function () {
  var up = 0, down = 0, same = 0, agua = 0, N = 20000;
  for (var s = 0; s < N; s++) {
    var c = B.foal({ f: mk2({ sex: 'f', element: 'agua' }), m: mk2({ element: 'fogo' }), seedBase: 5, breedCounter: s, nextUid: 1 });
    if (c.rarity === 'lendario') { up++; assert.strictEqual(c.grau, 1); } else if (c.rarity === 'magico') { down++; assert.strictEqual(c.grau, 3); } else same++;
    if (c.element === 'agua') agua++;
  }
  near(agua / N * 100, 50, 2, 'elemento 50/50'); near(down / N * 100, 30, 2, 'desceu'); near(up / N * 100, 5, 1, 'subiu');
  for (s = 0; s < 200; s++) assert.strictEqual(B.foal({ f: mk2({ sex: 'f', element: 'grama' }), m: mk2({ element: 'grama' }), seedBase: 9, breedCounter: s, nextUid: 1 }).element, 'grama');
});
test('grau igual: distribuição 10/50/40 no nível 30; sexo 50/50', function () {
  var g = [0, 0, 0, 0], fem = 0, n = 0;
  for (var s = 0; s < 20000; s++) { var c = B.foal({ f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 11, breedCounter: s, nextUid: 1 }); if (c.sex === 'f') fem++; if (c.rarity === 'raro') { g[c.grau]++; n++; } }
  near(g[1] / n * 100, 10, 2, '★'); near(g[2] / n * 100, 50, 2, '★★'); near(g[3] / n * 100, 40, 2, '★★★'); near(fem / 200, 50, 2, 'fêmeas %');
});
test('corcel garante herança; odds() bate com a frequência', function () {
  var f = mk2({ sex: 'f', skills: ['arranque', 'sprint', 'drift'] }), m = mk2({ skills: ['arranque', 'sprint', 'drift'], element: 'fogo' });
  for (var s = 0; s < 500; s++) { var c = B.foal({ f: f, m: m, seedBase: 21, breedCounter: s, nextUid: 1 }); var inh = c.skills.filter(function (id) { return ['arranque','sprint','drift'].indexOf(id) >= 0; }).length; assert.ok(inh >= Math.min(2, G.RARITIES[c.rarity].skillSlots), 'herdadas ' + c.skills.join()); }
  var o = B.odds(f, m), n = { comum: 0, magico: 0, raro: 0, lendario: 0, mitico: 0 };
  for (s = 0; s < 20000; s++) n[B.foal({ f: f, m: m, seedBase: 31, breedCounter: s, nextUid: 1 }).rarity]++;
  ['magico', 'raro', 'lendario'].forEach(function (r) { near(n[r] / 200, o.rarity[r] * 100, 2, r); });
});
test('uid distinto mesmo com nomes iguais', function () {
  var saved = G.FOAL_NAMES; G.FOAL_NAMES = ['Xodó'];
  var a = B.foal({ f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 1, breedCounter: 0, nextUid: 5 }), b = B.foal({ f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 1, breedCounter: 1, nextUid: 6 });
  G.FOAL_NAMES = saved; assert.strictEqual(a.name, b.name); assert.notStrictEqual(a.uid, b.uid);
});

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
