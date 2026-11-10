// prototype/tools/sim-test.js — node prototype/tools/sim-test.js
'use strict';
var assert = require('assert');
var G = require('../src/data.js');
var S = require('../src/sim.js');
var B = require('../src/breed.js');
var GR = require('../src/gear.js');
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
  assert.ok(!G.ITEMS, 'catálogo antigo de itens removido');
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
function race(seed, cond, horses) { return S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: horses.map(function (h, i) { return { horse: h, gear: null, name: 'r' + i, isPlayer: i === 0 }; }) }); }
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
test('weatherMult: dono T.weatherMult (1,03–1,07), dobrado T.weatherMultDouble (1,08), penalizado 2 − T.weatherMult, neutro 1', function () {
  var wm = S.TUNING.weatherMult; assert.ok(wm >= 1.03 && wm <= 1.07, 'weatherMult ' + wm);
  assert.strictEqual(S.weatherMult('fogo', 'sol', false), wm); assert.strictEqual(S.weatherMult('fogo', 'sol', true), S.TUNING.weatherMultDouble); assert.strictEqual(S.TUNING.weatherMultDouble, 1.08);
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
    var res = S.simulate({ seed: s, conditions: cond, recordFrames: true, racers: [h, mk({})].map(function (x, i) { return { horse: x, gear: null, name: 'r' + i }; }) });
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

test('snapshot dourado dos potros de exemplos.md', function () {
  // docs/exemplos.md §13 "Três potros de exemplo": seedBase 20261106, nextUid 2, breedCounter 0/1/2.
  // Compara o potro INTEIRO (inclusive a paleta, passo 9 da RNG): qualquer chamada de rng a mais,
  // a menos ou fora de ordem em breed.js muda algum campo e derruba este teste.
  function par(id, level, uid) {
    var h = JSON.parse(JSON.stringify(G.STARTERS.concat(G.WILD_HORSES).filter(function (x) { return x.id === id; })[0]));
    h.level = level; h.uid = uid; return h;
  }
  function st(a) { var o = {}; G.STAT_KEYS.forEach(function (k, i) { o[k] = a[i]; }); return o; }
  var casos = [
    { f: par('mare', 30, null), m: par('brasa', 30, null), name: 'Quimera', rarity: 'magico', grau: 3, element: 'agua', sex: 'm',
      base: [53, 59, 57, 60, 59, 52, 57], potential: [21, 16, 18, 18, 20, 16, 16], skills: ['pe-na-chuva'],
      palette: { coat: '#aa837c', coatShade: '#6e5555', mane: '#9ac9a7', accent: '#efedc4' }, breedLeft: 2 },
    { f: par('w-faisca', 1, null), m: par('w-pangare', 1, null), name: 'Quimera', rarity: 'comum', grau: 2, element: 'neutro', sex: 'f',
      base: [47, 42, 43, 44, 46, 46, 44], potential: [10, 12, 15, 10, 20, 27, 10], skills: ['arranque'],
      palette: { coat: '#b4733e', coatShade: '#7c4924', mane: '#9b7f55', accent: '#e59d65' }, breedLeft: 1 },
    { f: par('w-ventania', 30, null), m: par('w-jequitiba', 30, null), name: 'Estrela', rarity: 'lendario', grau: 1, element: 'grama', sex: 'm',
      base: [65, 62, 61, 60, 62, 64, 61], potential: [28, 25, 17, 27, 21, 19, 16], skills: ['sprint', 'arrancada-final'],
      palette: { coat: '#ac9e8d', coatShade: '#7f7466', mane: '#5a7b5b', accent: '#94cab1' }, breedLeft: 2 }
  ];
  casos.forEach(function (c, i) {
    var x = B.foal({ f: c.f, m: c.m, seedBase: 20261106, breedCounter: i, nextUid: 2 });
    assert.deepStrictEqual(x, {
      uid: 'm2', templateId: null, name: c.name, especie: 'cavalo', element: c.element, rarity: c.rarity, grau: c.grau, sex: c.sex,
      level: 1, xp: 0, skills: c.skills, base: st(c.base), potential: st(c.potential), palette: c.palette, breedLeft: c.breedLeft,
      parents: { f: { uid: null, name: c.f.name }, m: { uid: null, name: c.m.name } },
      born: i, gestacao: null
    }, 'potro ' + i);
  });
});

section('equipamento: catálogo');
test('5 slots com status principal e secundário', function () {
  assert.deepStrictEqual(G.GEAR_SLOTS, ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura']);
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.ferraduras, { name: 'Ferraduras', main: 'vel', sub: 'acel' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.sela, { name: 'Sela', main: 'est', sub: 'garra' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.estribos, { name: 'Estribos', main: 'man', sub: 'sorte' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.testeira, { name: 'Testeira', main: 'acel', sub: 'garra' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.armadura, { name: 'Armadura', main: 'forca', sub: 'est' });
  assert.deepStrictEqual(Object.keys(G.GEAR_SETS), ['sol', 'chuva', 'nevoa']);
  assert.strictEqual(G.GEAR_SETS.nevoa.weather, 'nevoa');
});
test('40 peças, 25 à venda, ids e nomes', function () {
  var ids = Object.keys(G.GEAR);
  assert.strictEqual(ids.length, 40);
  assert.strictEqual(ids.filter(function (id) { return G.GEAR[id].shop; }).length, 25);
  ids.forEach(function (id) {
    var p = G.GEAR[id];
    assert.strictEqual(p.id, id);
    assert.ok(/^(ferraduras|sela|estribos|testeira|armadura)(-(sol|chuva|nevoa))?-(comum|magico|raro|lendario)$/.test(id), id);
    assert.ok(G.GEAR_SLOTS.indexOf(p.slot) >= 0 && G.RARITIES[p.rarity], id);
    if (p.set) assert.ok(p.rarity === 'raro' || p.rarity === 'lendario', id + ' conjunto só Raro/Lendário');
    else assert.ok(p.rarity === 'comum' || p.rarity === 'magico', id + ' solta só Comum/Mágico');
    assert.strictEqual(p.shop, p.rarity !== 'lendario');
  });
  assert.deepStrictEqual(G.GEAR['sela-sol-raro'], { id: 'sela-sol-raro', name: 'Sela do Sol', slot: 'sela', rarity: 'raro', set: 'sol', main: 4, sub: 3, price: 600, shop: true });
  assert.deepStrictEqual(G.GEAR['ferraduras-comum'], { id: 'ferraduras-comum', name: 'Ferradura Leve', slot: 'ferraduras', rarity: 'comum', set: null, main: 2, sub: 0, price: 100, shop: true });
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].name, 'Armadura da Chuva');
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].main, 6);
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].sub, 4);
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].price, 1500);
  assert.strictEqual(G.GEAR['estribos-magico'].name, 'Esporas de Prata');
  assert.strictEqual(G.GEAR['estribos-magico'].sub, 2);
  assert.strictEqual(G.GEAR['testeira-nevoa-raro'].name, 'Testeira da Névoa');
});
test('ECONOMY.gear', function () {
  var g = G.ECONOMY.gear;
  assert.deepStrictEqual(g.price, { comum: 100, magico: 250, raro: 600, lendario: 1500 });
  assert.strictEqual(g.sellRate, 0.25); assert.strictEqual(g.stonePrice, 40); assert.strictEqual(g.stoneBundle, 5);
  assert.deepStrictEqual(g.main, { comum: 2, magico: 3, raro: 4, lendario: 6 });
  assert.deepStrictEqual(g.sub, { comum: 0, magico: 2, raro: 3, lendario: 4 });
  assert.strictEqual(g.plusMax, 10);
  assert.deepStrictEqual(g.enhanceChance, [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25]);
  assert.deepStrictEqual(g.enhanceCost, [1, 1, 1, 1, 1, 1, 2, 2, 2, 2]);
  assert.strictEqual(g.enhanceDropFrom, 6);
  assert.deepStrictEqual(g.setBonus, { pieces: [3, 4, 5], skillChance: 0.05, sorte: 5, ratingPts: [3, 15, 20] });
  assert.deepStrictEqual(g.podiumStone, [0.6, 0.4, 0.25]);
  assert.deepStrictEqual(g.startGear, ['sela-comum', 'ferraduras-comum']);
});

section('equipamento: gear.js');
function gm(equip) { return { equip: equip }; }
function gi(uid, id, plus) { return { uid: uid, id: id, plus: plus || 0 }; }
function byUid(list) { var o = {}; list.forEach(function (it) { o[it.uid] = it; }); return o; }
test('resolve soma principal+plus e secundário; sem equip zera', function () {
  var items = byUid([gi('i1', 'sela-sol-raro', 3), gi('i2', 'ferraduras-comum')]);
  var g = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2' }), items);
  assert.deepStrictEqual(g.mods, { vel: 2, acel: 0, man: 0, forca: 0, est: 7, garra: 3, sorte: 0 });
  assert.deepStrictEqual(g.set, { id: 'sol', count: 1 });
  assert.deepStrictEqual(g.special, { skillChanceBonus: 0, weatherDoubleClimate: null, ignoreWeatherPenalty: false });
  assert.deepStrictEqual(g.pieces.map(function (p) { return p.uid; }), ['i2', 'i1']);
  var z = GR.resolve({}, {});
  assert.deepStrictEqual(z.mods, { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 });
  assert.deepStrictEqual(z.set, { id: null, count: 0 }); assert.deepStrictEqual(z.pieces, []);
});
test('resolve ignora uid inexistente, slot errado e plus inválido', function () {
  var items = byUid([gi('i1', 'sela-sol-raro', 3), gi('i2', 'ferraduras-comum', 11), gi('i3', 'estribos-magico', 1.5)]);
  var g = GR.resolve(gm({ ferraduras: 'i1', sela: 'i9', estribos: 'i3', testeira: 'i2' }), items);
  assert.deepStrictEqual(g.pieces, []); assert.strictEqual(g.set.count, 0);
});
test('conjunto: 3/4/5 peças com raridades misturadas; 2+2+1 não ativa', function () {
  var items = byUid([gi('i1', 'sela-chuva-raro'), gi('i2', 'ferraduras-chuva-lendario', 2), gi('i3', 'estribos-chuva-raro'), gi('i4', 'testeira-chuva-raro'), gi('i5', 'armadura-chuva-lendario'), gi('i6', 'testeira-sol-raro'), gi('i7', 'armadura-nevoa-raro')]);
  var g3 = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3' }), items);
  assert.deepStrictEqual(g3.set, { id: 'chuva', count: 3 }); assert.strictEqual(g3.mods.sorte, 8); // 3 (sub do estribo Raro) + 5 (conjunto)
  assert.deepStrictEqual(g3.special, { skillChanceBonus: 0.05, weatherDoubleClimate: null, ignoreWeatherPenalty: false });
  var g4 = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3', testeira: 'i4' }), items);
  assert.strictEqual(g4.special.weatherDoubleClimate, 'chuva'); assert.strictEqual(g4.special.ignoreWeatherPenalty, false);
  var g5 = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3', testeira: 'i4', armadura: 'i5' }), items);
  assert.deepStrictEqual(g5.set, { id: 'chuva', count: 5 }); assert.strictEqual(g5.special.ignoreWeatherPenalty, true);
  assert.strictEqual(g5.mods.vel, 8); // lendário 6 + 2
  var gx = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', testeira: 'i6', armadura: 'i7' }), items);
  assert.strictEqual(gx.set.count, 2); assert.strictEqual(gx.mods.sorte, 0); assert.strictEqual(gx.special.skillChanceBonus, 0);
});
test('enhanceOdds segue a tabela', function () {
  assert.deepStrictEqual(GR.enhanceOdds(0), { chance: 1, cost: 1, dropTo: 0 });
  assert.deepStrictEqual(GR.enhanceOdds(5), { chance: 0.5, cost: 1, dropTo: 5 });
  assert.deepStrictEqual(GR.enhanceOdds(6), { chance: 0.4, cost: 2, dropTo: 5 });
  assert.deepStrictEqual(GR.enhanceOdds(9), { chance: 0.25, cost: 2, dropTo: 8 });
  assert.strictEqual(GR.enhanceOdds(10), null);
});
test('enhance é determinístico, não muta e cai só a partir de +6', function () {
  var it = gi('i1', 'sela-comum', 0);
  var a = GR.enhance(it, 20261106, 0), b = GR.enhance(it, 20261106, 0);
  assert.deepStrictEqual(a, b); assert.strictEqual(it.plus, 0);
  assert.strictEqual(a.success, true); assert.strictEqual(a.plus, 1); // +0→+1 é 100%
  assert.strictEqual(GR.enhance(gi('i1', 'sela-comum', 10), 1, 0), null);
  var falhou = null;
  for (var c = 0; c < 200 && !falhou; c++) { var r = GR.enhance(gi('x', 'sela-comum', 7), 20261106, c); if (!r.success) falhou = r; }
  assert.ok(falhou && falhou.plus === 6, 'falha em +7 cai para +6');
  var falhou3 = null;
  for (c = 0; c < 200 && !falhou3; c++) { r = GR.enhance(gi('x', 'sela-comum', 3), 20261106, c); if (!r.success) falhou3 = r; }
  assert.ok(falhou3 && falhou3.plus === 3, 'falha em +3 não cai');
});
test('snapshot dourado: 12 tentativas seguidas com seedBase 20261106', function () {
  var plus = 0, seq = [];
  for (var c = 0; c < 12; c++) { var r = GR.enhance(gi('x', 'sela-comum', plus), 20261106, c); plus = r.plus; seq.push(plus); }
  assert.deepStrictEqual(seq, [1, 2, 3, 4, 5, 6, 7, 6, 5, 5, 5, 6]);
});
test('podiumStone: só pódio em corrida valendo; frequência do 1º lugar', function () {
  assert.strictEqual(GR.podiumStone(123, 1, 0), 0); assert.strictEqual(GR.podiumStone(123, 4, 50), 0);
  assert.strictEqual(GR.podiumStone(123, 1, 50), GR.podiumStone(123, 1, 50));
  var n = 0; for (var s = 1; s <= 2000; s++) n += GR.podiumStone(s, 1, 50);
  assert.ok(n > 1100 && n < 1300, '1º lugar ~60%: ' + n + '/2000');
  var n3 = 0; for (s = 1; s <= 2000; s++) n3 += GR.podiumStone(s, 3, 50);
  assert.ok(n3 > 400 && n3 < 600, '3º lugar ~25%: ' + n3 + '/2000');
});
test('botGear por liga', function () {
  assert.strictEqual(GR.botGear(0, 'fogo', 0.5).set.count, 0);
  var p = GR.botGear(1, 'agua', 0.5); assert.deepStrictEqual(p.pieces.map(function (x) { return x.id; }), ['ferraduras-comum', 'sela-comum']);
  var l = GR.botGear(5, 'fogo', 0.5);
  assert.deepStrictEqual(l.set, { id: 'sol', count: 5 }); assert.strictEqual(l.mods.vel, 11); assert.strictEqual(l.mods.sorte, 8); // 3 sub + 5 conjunto
  assert.strictEqual(l.special.ignoreWeatherPenalty, true);
  assert.strictEqual(GR.botGear(5, 'neutro', 0.0).set.id, 'sol'); assert.strictEqual(GR.botGear(5, 'neutro', 0.5).set.id, 'chuva'); assert.strictEqual(GR.botGear(5, 'neutro', 0.9).set.id, 'nevoa');
  var d = GR.botGear(4, 'grama', 0.5); assert.deepStrictEqual(d.set, { id: 'nevoa', count: 3 }); assert.strictEqual(d.pieces.length, 5);
});
test('sellPrice e ratingPts', function () {
  assert.strictEqual(GR.sellPrice('sela-magico'), 63); assert.strictEqual(GR.sellPrice('armadura-sol-lendario'), 375); assert.strictEqual(GR.sellPrice('nada'), 0);
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6].map(GR.ratingPts), [0, 0, 0, 3, 15, 20, 0]);
});

section('equipamento: simulação');
function cl(h) { return JSON.parse(JSON.stringify(h)); }
test('computeStats soma mods do equipamento e limita a 120; string vale null', function () {
  var h = cl(G.STARTERS[0]);
  var base = S.computeStats(h, null);
  var g = GR.resolve({ equip: { sela: 'i1' } }, { i1: { uid: 'i1', id: 'sela-sol-raro', plus: 10 } });
  var s = S.computeStats(h, g);
  assert.strictEqual(s.est, base.est + 14); assert.strictEqual(s.garra, base.garra + 3); assert.strictEqual(s.vel, base.vel);
  assert.deepStrictEqual(S.computeStats(h, 'sela-couro'), base);
  var big = { mods: { vel: 200, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 }, special: {}, set: { id: null, count: 0 }, pieces: [] };
  assert.strictEqual(S.computeStats(h, big).vel, 120);
});
test('skillChance com bônus respeita o teto 0,95', function () {
  var h = cl(G.STARTERS[0]); var st = S.computeStats(h, null);
  assert.ok(Math.abs(S.skillChance(h, st, 0.05) - (S.skillChance(h, st) + 0.05)) < 1e-9);
  h.rarity = 'mitico'; h.level = 50; st.sorte = 100;
  assert.strictEqual(S.skillChance(h, st, 0.5), 0.95);
});
test('powerRating conta mods e pontos de conjunto', function () {
  var h = cl(G.STARTERS[0]);
  var items = {}; var equip = {};
  ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'].forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-sol-raro', plus: 0 }; equip[sl] = 'i' + i; });
  var g5 = GR.resolve({ equip: equip }, items);
  var g0 = GR.resolve({}, {});
  var r5 = S.powerRating(h, g5), r0 = S.powerRating(h, g0);
  assert.ok(r5 > r0 + 20, 'rating sobe com 5 Raras: ' + r0 + ' -> ' + r5);
  var g3 = GR.resolve({ equip: { ferraduras: 'i0', sela: 'i1', estribos: 'i2' } }, items);
  var statsOnly = S.powerRating(h, { mods: g3.mods, special: {}, set: { id: null, count: 0 }, pieces: [] });
  assert.strictEqual(S.powerRating(h, g3) - statsOnly, 3);
});
test('equipamento nunca baixa o rating; tirar uma peça nunca o sobe (premissa da trava do páreo)', function () {
  var SL = ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'];
  function gearIds(ids, plus) { var items = {}, equip = {}; ids.forEach(function (id, i) { if (id) { items['i' + i] = { uid: 'i' + i, id: id, plus: plus }; equip[SL[i]] = 'i' + i; } }); return GR.resolve({ equip: equip }, items); }
  var gears = [
    gearIds(SL.map(function (sl) { return sl + '-comum'; }), 0),              // 5 Comuns soltas
    gearIds(SL.map(function (sl) { return sl + '-sol-raro'; }), 10),          // conjunto Raro completo +10
    gearIds([null, 'sela-comum', null, null, null], 3)                         // uma peça só
  ];
  var horses = [cl(G.STARTERS[0]), cl(G.STARTERS[1]), cl(G.STARTERS[2])];
  horses[2].level = 50;   // perto do teto da raridade
  horses.forEach(function (h) {
    gears.forEach(function (g, gi) {
      assert.ok(S.powerRating(h, g) >= S.powerRating(h, null), h.id + ' gear ' + gi + ': ' + S.powerRating(h, g) + ' < ' + S.powerRating(h, null));
    });
    var com = gearIds(SL.map(function (sl) { return sl + '-sol-raro'; }), 5);
    var sem = gearIds(SL.map(function (sl, i) { return i === 1 ? null : sl + '-sol-raro'; }), 5);   // tira a sela (quebra o bônus de 5)
    assert.ok(S.powerRating(h, com) >= S.powerRating(h, sem), h.id + ': tirar a sela subiu o rating');
  });
});
test('5 peças Chuva anulam a penalidade do Fogo na chuva; 4 Sol dobram o Sol', function () {
  var brasa = cl(G.STARTERS.filter(function (x) { return x.id === 'brasa'; })[0]);
  function gearOf(set, n) { var items = {}, equip = {}; ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'].slice(0, n).forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-' + set + '-raro', plus: 0 }; equip[sl] = 'i' + i; }); return GR.resolve({ equip: equip }, items); }
  function mixed(n) { var sets = ['sol', 'chuva', 'nevoa', 'sol', 'chuva']; var items = {}, equip = {}; ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'].slice(0, n).forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-' + sets[i] + '-raro', plus: 0 }; equip[sl] = 'i' + i; }); return GR.resolve({ equip: equip }, items); }
  function wins(gA, gB, weather) {
    var w = 0, saved = S.TUNING.diceAt; S.TUNING.diceAt = [];
    try {
      for (var k = 0; k < 200; k++) {
        var seed = S.hash2(777, k), cond = S.randomConditions(seed); cond.weather = weather;
        var pair = k % 2 ? [gB, gA] : [gA, gB];
        var res = S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: pair.map(function (g) { return { horse: brasa, gear: g, name: 'x', isPlayer: false }; }) });
        if (pair[res.finishOrder[0]] === gA) w++;
      }
    } finally { S.TUNING.diceAt = saved; }
    return w;
  }
  assert.ok(wins(gearOf('chuva', 5), mixed(5), 'chuva') >= 110, 'anula penalidade (≥55% de 200)');
  assert.ok(wins(gearOf('sol', 4), mixed(4), 'sol') >= 110, 'dobra o Sol (≥55% de 200)');
});

section('dev');
// Referência regravada com o pacote de balanceamento da auditoria (seeds 1001…1020; os 3 iniciais + 5
// aluguéis do Haras, com o equipamento de bot de cada liga). Mudou a simulação de propósito? Regrave a tabela.
var crypto = require('crypto');
var ALUGUEIS = G.WILD_HORSES.filter(function (h) { return h.rarity !== 'mitico' && B.rentalPrice(h) != null; }).slice(0, 5);
var CAMPO_REF = G.STARTERS.concat(ALUGUEIS);
function refRace(seed, dev) {
  var cfg = { seed: seed, recordFrames: false, racers: CAMPO_REF.map(function (h, i) {
    return { horse: cl(h), gear: GR.botGear(i % 6, h.element, 0.37), name: 'r' + i, isPlayer: i === 0 };
  }) };
  if (dev !== undefined) cfg.dev = dev;
  return S.simulate(cfg);
}
function refHash(res) {
  return crypto.createHash('sha1').update(JSON.stringify({ finishOrder: res.finishOrder, finishTimes: res.finishTimes, events: res.events })).digest('hex');
}
var REF_HASHES = ['7ca78bece9d78556809efae25dd7162eab7d40cc', 'eb1de6577af765496cf7db9960a46426a72fd527', 'fd2736a810021adfb7a2c1435247935792ffa096',
  '0eced70bacb2eb596c745c8f939a9e1a8d44337b', 'ba60c6134300938bd75e1390d1618bf0da524f49', 'ea9aaee2e9e1b644723b52da17ccebf424970b61',
  '48444d71e09ab9784ce1d8c07b165ef490203b1e', '0289f773ff99e90bb9ed355eb85c79c3fc227c85', 'ce8c09eb2c3c82bc5ed8eb71cb671aaab96d270e',
  '13321e4232c48c81759eb99b3374a9f950ea7e95', '5e4b62cbdbbae74bd999be8ddfcaaef2f3843d86', '288080097ee5ec09f2a491e5335f8e973c15d565',
  'e4077f04f7634edbcf13ef93ec9c33f4d33503c9', '45d979760d8f36a84f36ecc8f6517dd1f97da67c', 'f6398dba4c8bc84ce80904ec712853261ebfaaff',
  'd64e7c020ee4b44a002dc772d4fa77697e302ae5', 'b7c44ea737a877651124d845e272261fd0cf7229', 'b1c1a1071067112167c78e32bef8bcd4147272a3',
  '4b01401d5c8977d1f824c754c20bcb25927b56b0', 'a17da841ebf2718b98238d2771787aa62b7339de'];
test('sem config.dev o resultado é o de antes', function () {
  assert.deepStrictEqual(CAMPO_REF.map(function (h) { return h.id; }), ['brasa', 'mare', 'ipe', 'w-pangare', 'w-faisca', 'w-lambari', 'w-capim', 'w-ticao']);
  var diff = [];
  for (var k = 0; k < 20; k++) { var h = refHash(refRace(1001 + k)); if (h !== REF_HASHES[k]) diff.push((1001 + k) + ': ' + h); }
  assert.deepStrictEqual(diff, [], 'hashes diferentes da referência');
});
test('config.dev vazio ou com skillsAlways false devolve exatamente o mesmo objeto', function () {
  var a = JSON.stringify(refRace(1003)), b = JSON.stringify(refRace(1003, {})), c = JSON.stringify(refRace(1003, { skillsAlways: false }));
  assert.strictEqual(b, a); assert.strictEqual(c, a);
});
// mapa com gatilho garantido para start (largada), straight (reta final de 600 m) e final (80%)
var GATILHOS = { distance: 1200, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 300 }, { type: 'curva', from: 300, to: 600 }, { type: 'reta', from: 600, to: 1200 }] };
function devRace(seed, horses, dev) {
  var cfg = { seed: seed, conditions: GATILHOS, recordFrames: true, racers: horses.map(function (h, i) { return { horse: h, gear: null, name: 'r' + i, isPlayer: i === 0 }; }) };
  if (dev) cfg.dev = dev;
  return S.simulate(cfg);
}
function skillsPorCorredor(res, n) {
  var c = []; for (var i = 0; i < n; i++) c.push(0);
  res.events.forEach(function (e) { if (e.type === 'skill') c[e.racer]++; });
  return c;
}
test('com skillsAlways toda tentativa de skill ativa', function () {
  function fraco() { var h = mk({ sorte: 0 }); h.rarity = 'comum'; h.skills = ['arranque', 'sprint', 'arrancada-final']; return h; }
  var semDev = 0;
  for (var s = 1; s <= 10; s++) {
    var hs = [fraco(), fraco(), fraco(), fraco()];
    assert.deepStrictEqual(skillsPorCorredor(devRace(s, hs, { skillsAlways: true }), 4), [3, 3, 3, 3], 'seed ' + s);
    semDev += skillsPorCorredor(devRace(s, hs), 4).reduce(function (a, x) { return a + x; }, 0);
  }
  assert.ok(semDev < 120, 'sem o parâmetro, a chance (0,35) falha às vezes: ' + semDev + '/120');
  // r.rng() continua sendo chamado na tentativa: quando todas já ativariam, o resultado é idêntico
  function forte() { var h = mk({ sorte: 100 }); h.level = 50; h.skills = ['arranque', 'sprint', 'arrancada-final']; return h; }
  var iguais = 0;
  for (s = 1; s <= 40; s++) {
    var hf = [forte(), forte()], base = devRace(s, hf);
    if (skillsPorCorredor(base, 2).join() !== '3,3') continue;
    assert.strictEqual(JSON.stringify(devRace(s, hf, { skillsAlways: true })), JSON.stringify(base), 'seed ' + s + ': fluxo do rng deslocado');
    iguais++;
  }
  assert.ok(iguais >= 5, 'poucas seeds com todas as skills ativas sem o parâmetro: ' + iguais);
});

var Dev = null;
try { Dev = require('../src/dev.js'); } catch (e) { Dev = null; }
function DV() { if (!Dev) throw new Error('Dev indefinido (prototype/src/dev.js)'); return Dev; }
test('Dev: chave do save e Ouro infinito', function () {
  assert.strictEqual(DV().SAVE_KEY, 'galope-elemental:dev'); assert.strictEqual(DV().GOLD_INF, 999999);
  var st = { gold: 10 }; DV().refillGold(st); assert.strictEqual(st.gold, 999999);
  st = { gold: 1000374 }; DV().refillGold(st); assert.strictEqual(st.gold, 1000374);
  assert.deepStrictEqual(DV().wind({ intensity: 'brisa', dir: -1 }), { intensity: 'brisa', dir: -1 });
  assert.deepStrictEqual(DV().wind({ intensity: 'ventania', dir: '1' }), { intensity: 'ventania', dir: 1 });
  assert.strictEqual(DV().wind({ intensity: 'furacao', dir: 1 }), null); assert.strictEqual(DV().wind(null), null);
  assert.strictEqual(DV().parseSeed('123'), 123); assert.strictEqual(DV().parseSeed(4294967295), 4294967295);
  [null, '', '-1', '1.5', 'abc', '4294967296', true].forEach(function (v) { assert.strictEqual(DV().parseSeed(v), null, String(v)); });
});
test('Dev.horseTemplate respeita vagas e skills válidas', function () {
  var pal = { coat: '#112233', coatShade: '#000000', mane: '#abcdef', accent: '#FFEE00' };
  var t = DV().horseTemplate({ name: 'Teste', element: 'agua', rarity: 'comum', sex: 'f', potential: 12, skills: ['arranque', 'arranque', 'nao-existe', 'sprint'], palette: pal }, 7);
  assert.strictEqual(t.id, 'dev-7'); assert.strictEqual(t.name, 'Teste'); assert.strictEqual(t.especie, 'cavalo'); assert.strictEqual(t.grau, 2);
  assert.strictEqual(t.element, 'agua'); assert.strictEqual(t.rarity, 'comum'); assert.strictEqual(t.sex, 'f'); assert.strictEqual(t.level, 1); assert.strictEqual(t.xp, 0);
  assert.deepStrictEqual(t.skills, ['arranque'], 'Comum: 1 vaga');
  G.STAT_KEYS.forEach(function (k) { assert.strictEqual(t.base[k], 36, 'base ' + k); assert.strictEqual(t.potential[k], 12, 'pot ' + k); });
  assert.deepStrictEqual(t.palette, pal);
  Object.keys(G.STARTERS[0]).filter(function (k) { return k !== 'title' && k !== 'bio'; }).forEach(function (k) { assert.ok(k in t, 'campo ' + k); });
  // Mítico: 5 vagas, qualquer skill do catálogo (inclusive exclusiva de outro elemento), na ordem pedida
  var m = DV().horseTemplate({ name: 'X', element: 'agua', rarity: 'mitico', sex: 'm', potential: 'max', skills: ['labareda', 'mare-alta', 'drift', 'sprint', 'arranque', 'segundo-ar'] }, 1);
  assert.deepStrictEqual(m.skills, ['labareda', 'mare-alta', 'drift', 'sprint', 'arranque']);
  G.STAT_KEYS.forEach(function (k) { assert.strictEqual(m.base[k], 68); assert.strictEqual(m.potential[k], 31); });
  assert.ok(/^#[0-9a-f]{6}$/i.test(m.palette.coat) && /^#[0-9a-f]{6}$/i.test(m.palette.accent), 'paleta padrão');
  assert.strictEqual(DV().horseTemplate({ rarity: 'raro', potential: 99 }).potential.vel, 31);
  assert.strictEqual(DV().horseTemplate({ rarity: 'raro', potential: -4 }).potential.vel, 0);
  // campos inválidos: valores padrão válidos, e o template corre
  var d = DV().horseTemplate({ element: 'lava', rarity: 'divino', sex: 'x', skills: 'arranque', name: ' ' });
  assert.ok(G.ELEMENTS[d.element] && G.RARITIES[d.rarity] && (d.sex === 'm' || d.sex === 'f') && Array.isArray(d.skills) && d.name.length >= 2);
  var res = S.simulate({ seed: 3, recordFrames: false, racers: [{ horse: m, gear: null, name: 'a' }, { horse: t, gear: null, name: 'b' }] });
  assert.strictEqual(res.finishOrder.length, 2);
});
test('Dev.itemId devolve só ids do catálogo', function () {
  assert.strictEqual(DV().itemId({ slot: 'sela', set: 'sol', rarity: 'lendario' }), 'sela-sol-lendario');
  assert.strictEqual(DV().itemId({ slot: 'armadura', set: 'nevoa', rarity: 'raro' }), 'armadura-nevoa-raro');
  assert.strictEqual(DV().itemId({ slot: 'sela', rarity: 'comum' }), 'sela-comum');
  assert.strictEqual(DV().itemId({ slot: 'estribos', set: 'chuva', rarity: 'magico' }), 'estribos-magico', 'peça solta ignora o conjunto');
  [{ slot: 'sela', rarity: 'raro' }, { slot: 'chapeu', rarity: 'comum' }, { slot: 'sela', set: 'lava', rarity: 'raro' },
    { slot: 'sela', set: 'sol', rarity: 'mitico' }, {}, null].forEach(function (q) { assert.strictEqual(DV().itemId(q), null, JSON.stringify(q)); });
  G.GEAR_SLOTS.concat(['x']).forEach(function (slot) {
    [null, 'sol', 'chuva', 'nevoa', 'x'].forEach(function (set) {
      Object.keys(G.RARITIES).concat(['x']).forEach(function (rarity) {
        var id = DV().itemId({ slot: slot, set: set, rarity: rarity });
        if (id !== null) { assert.ok(G.GEAR[id], id); assert.strictEqual(G.GEAR[id].slot, slot); assert.strictEqual(G.GEAR[id].rarity, rarity); }
      });
    });
  });
  assert.strictEqual(DV().itemId({ slot: 'testeira', set: 'chuva', rarity: 'lendario' }), 'testeira-chuva-lendario');
});
test('Dev.conditions corrige distância e omite campo inválido', function () {
  assert.deepStrictEqual(DV().conditions({ distance: 1234 }), { distance: 1200 });
  assert.deepStrictEqual(DV().conditions({ distance: 50 }), { distance: 1000 });
  assert.deepStrictEqual(DV().conditions({ distance: 9999 }), { distance: 2400 });
  assert.deepStrictEqual(DV().conditions({ distance: 'abc' }), {});
  assert.deepStrictEqual(DV().conditions({ weather: 'granizo' }), {});
  assert.deepStrictEqual(DV().conditions({ weather: 'nevoa', surface: 'lama' }), { weather: 'nevoa' });
  assert.deepStrictEqual(DV().conditions({ surface: 'areia', tracado: 'normal' }), { surface: 'areia' });
  assert.deepStrictEqual(DV().conditions({}), {}); assert.deepStrictEqual(DV().conditions(null), {});
  function sete(c, D, meio) {
    assert.strictEqual(c.blocks.length, 7);
    var prev = 0;
    c.blocks.forEach(function (b, i) {
      assert.strictEqual(b.from, prev); assert.ok(b.to > b.from); assert.strictEqual(b.to % 10, 0, 'fronteira múltipla de 10 m');
      assert.ok(Math.abs((b.to - b.from) - D / 7) <= 10, 'blocos de mesmo tamanho: ' + (b.to - b.from));
      prev = b.to;
    });
    assert.strictEqual(prev, D);
    assert.deepStrictEqual(c.blocks.map(function (b) { return b.type; }), ['reta'].concat(meio, ['reta']));
  }
  sete(DV().conditions({ tracado: 'curvas', distance: 1000 }), 1000, ['curva', 'curva', 'curva', 'curva', 'curva']);
  sete(DV().conditions({ tracado: 'subidas', distance: 2400 }), 2400, ['subida', 'reta', 'subida', 'reta', 'subida']);
  sete(DV().conditions({ tracado: 'curvas' }), 1600, ['curva', 'curva', 'curva', 'curva', 'curva']);   // sem distância: 1600 m
  [{ distance: 1234 }, { weather: 'granizo' }, { tracado: 'curvas' }, {}].forEach(function (f) {
    var n = S.normalizeConditions(DV().conditions(f));
    assert.ok(n.distance >= 1000 && n.blocks.length >= 1 && G.WEATHERS[n.weather] && G.SURFACES[n.surface], JSON.stringify(f));
    var ns = S.normalizeConditions(DV().conditions(f), 77);
    assert.ok(ns.blocks[ns.blocks.length - 1].to === ns.distance, JSON.stringify(f) + ' com seed');
  });
  // com a sala normal (base): a distância forçada mantém o traçado dela, reescalado
  var base = S.randomConditions(5), alvo = base.distance === 2000 ? 1500 : 2000;
  var c = DV().conditions({ distance: alvo }, base), n2 = S.normalizeConditions(c, 5);
  assert.strictEqual(n2.distance, alvo);
  assert.deepStrictEqual(n2.blocks.map(function (b) { return b.type; }), base.blocks.map(function (b) { return b.type; }));
  n2.blocks.forEach(function (b, i) { assert.strictEqual(b.to % 10, 0); if (i) assert.strictEqual(b.from, n2.blocks[i - 1].to); });
  assert.strictEqual(DV().conditions({ tracado: 'subidas' }, base).blocks[6].to, base.distance, 'traçado sem distância usa a da sala');
  // lista de blocos: tamanhos iguais na ordem dada; tipo inválido descarta a lista
  assert.deepStrictEqual(DV().conditions({ tracado: ['reta', 'curva', 'subida', 'reta'], distance: 1200 }).blocks,
    [{ type: 'reta', from: 0, to: 300 }, { type: 'curva', from: 300, to: 600 }, { type: 'subida', from: 600, to: 900 }, { type: 'reta', from: 900, to: 1200 }]);
  assert.deepStrictEqual(DV().conditions({ tracado: ['reta', 'lava'], distance: 1200 }), { distance: 1200 });
});

section('auditoria: entradas malformadas e regras do núcleo');
function campo2(h0) { return [h0 || mk({}), mk({ vel: 70 })]; }
function semNaN(res) { return res.finishTimes.every(function (t) { return typeof t === 'number' && isFinite(t) && t > 0 && t < S.TUNING.maxTime; }); }
test('normalizeConditions: distância fora de 1000–2400 ou não numérica usa a da seed', function () {
  var rnd = S.randomConditions(7);
  [-100, 0, 'abc', '1600', 1e6, 999, 2401, NaN, Infinity, 1234.5, null, true].forEach(function (d) {
    var c = S.normalizeConditions({ distance: d }, 7);
    assert.strictEqual(c.distance, rnd.distance, String(d));
    assert.deepStrictEqual(c.blocks, rnd.blocks, String(d) + ' blocos');
  });
  [-100, 'abc', 1e6].forEach(function (d) { assert.strictEqual(S.normalizeConditions({ distance: d }).distance, 1600, 'sem seed: ' + d); });
  // distância válida diferente da seed: uma reta única do tamanho pedido
  var alvo = rnd.distance === 2000 ? 1500 : 2000, c2 = S.normalizeConditions({ distance: alvo }, 7);
  assert.strictEqual(c2.distance, alvo); assert.deepStrictEqual(c2.blocks, [{ type: 'reta', from: 0, to: alvo }]);
  assert.strictEqual(S.normalizeConditions({ distance: 1000 }, 7).distance, 1000); assert.strictEqual(S.normalizeConditions({ distance: 2400 }, 7).distance, 2400);
  // blocos que terminam fora da faixa são descartados
  var curto = S.normalizeConditions({ blocks: [{ type: 'reta', from: 0, to: 50 }] }, 7);
  assert.strictEqual(curto.distance, rnd.distance);
});
test('simulate com distância malformada corre na distância da seed, com tempos válidos', function () {
  [-100, 'abc', 1e6].forEach(function (d) {
    var res = race(11, { distance: d }, campo2());
    assert.strictEqual(res.conditions.distance, S.randomConditions(11).distance, String(d));
    assert.ok(semNaN(res), String(d) + ': ' + res.finishTimes.join());
  });
});
test('level e potencial malformados: status finitos, corrida termina, skillChance limita o level como computeStats', function () {
  var h = mk({}); h.level = 'x'; h.potential = { vel: 'abc', acel: NaN, man: -5, forca: 99, est: null, garra: undefined, sorte: '7' };
  var st = S.computeStats(h, null);
  G.STAT_KEYS.forEach(function (k) { assert.ok(typeof st[k] === 'number' && isFinite(st[k]), k + ' = ' + st[k]); });
  var h1 = mk({}); h1.level = 1; h1.potential = { vel: 0, acel: 0, man: 0, forca: 31, est: 0, garra: 0, sorte: 7 };
  assert.deepStrictEqual(st, S.computeStats(h1, null), 'level "x" vale 1; potencial vira número (inválido vale 0), preso a 0–31');
  var hb = mk({}); hb.base.vel = 'rápido'; assert.strictEqual(typeof S.computeStats(hb, null).vel, 'number');
  var res = race(3, RETA, campo2(h));
  assert.ok(semNaN(res), res.finishTimes.join());
  assert.ok(!res.events.some(function (e) { return e.type === 'chegada' && /900/.test(e.text); }), 'ninguém "chega" em 900 s');
  var c1 = S.skillChance({ rarity: 'raro', level: 1 }, { sorte: 0 }), c50 = S.skillChance({ rarity: 'raro', level: 50 }, { sorte: 0 });
  assert.strictEqual(S.skillChance({ rarity: 'raro', level: -200 }, { sorte: 0 }), c1);
  assert.strictEqual(S.skillChance({ rarity: 'raro', level: 'x' }, { sorte: 0 }), c1);
  assert.strictEqual(S.skillChance({ rarity: 'raro', level: 1e9 }, { sorte: 0 }), c50);
  assert.strictEqual(S.sanitizeLevel(10.7), 10); assert.strictEqual(S.sanitizeLevel(undefined), 1); assert.strictEqual(S.sanitizePotential('x'), 0); assert.strictEqual(S.sanitizePotential(40), 31);
});
test('simulate não muta a config recebida', function () {
  var cfg = { seed: 99, conditions: { distance: 1600, blocks: [{ type: 'reta', from: 0, to: 400 }, { type: 'curva', from: 400, to: 1200 }, { type: 'reta', from: 1200, to: 1600 }] },
    racers: [{ horse: cl(G.STARTERS[0]), gear: GR.botGear(5, 'fogo', 0.5), name: 'a' }, { horse: cl(G.STARTERS[1]), gear: null, name: 'b' }], dev: { skillsAlways: true } };
  var antes = JSON.stringify(cfg);
  S.simulate(cfg); assert.strictEqual(JSON.stringify(cfg), antes);
});
test('resultado traz simVersion e tuningHash; o hash muda com o TUNING e com as skills', function () {
  assert.strictEqual(typeof S.VERSION, 'string'); assert.ok(S.VERSION.length > 0);
  var a = race(5, RETA, campo2());
  assert.strictEqual(a.simVersion, S.VERSION); assert.ok(/^[0-9a-f]{16}$/.test(a.tuningHash), a.tuningHash);
  assert.strictEqual(race(6, CURVA, campo2()).tuningHash, a.tuningHash, 'não depende da seed nem do mapa');
  assert.strictEqual(S.tuningHash(), a.tuningHash);
  var old = S.TUNING.vBase; S.TUNING.vBase = old + 0.01;
  try { assert.notStrictEqual(S.tuningHash(), a.tuningHash, 'TUNING'); } finally { S.TUNING.vBase = old; }
  var sk = G.SKILLS.sprint.effect, sm = sk.speedMult; sk.speedMult = sm + 0.01;
  try { assert.notStrictEqual(S.tuningHash(), a.tuningHash, 'skills'); } finally { sk.speedMult = sm; }
  assert.strictEqual(S.tuningHash(), a.tuningHash);
});
test('todo gatilho usado em SKILLS tem peso no Poder (SKILL_TRIGGER_WEIGHT)', function () {
  var W = S.SKILL_TRIGGER_WEIGHT; assert.ok(W && typeof W === 'object');
  Object.keys(G.SKILLS).forEach(function (id) {
    var trig = G.SKILLS[id].trigger, key = trig.indexOf('weather:') === 0 ? 'weather' : trig;
    assert.strictEqual(typeof W[key], 'number', id + ': gatilho ' + trig + ' sem peso');
    assert.strictEqual(S.skillWeight(id), W[key], id);
  });
});
test('payouts: valores exatos com porcentagens inteiras (4–8 corredores × 50/100/250)', function () {
  var esperado = {
    50: { 4: [126, 54], 5: [158, 67], 6: [135, 81, 54], 7: [158, 94, 63], 8: [216, 90, 54] },
    100: { 4: [252, 108], 5: [315, 135], 6: [270, 162, 108], 7: [315, 189, 126], 8: [432, 180, 108] },
    250: { 4: [630, 270], 5: [788, 337], 6: [675, 405, 270], 7: [788, 472, 315], 8: [1080, 450, 270] }
  };
  Object.keys(esperado).forEach(function (fee) {
    Object.keys(esperado[fee]).forEach(function (nr) {
      var order = []; for (var q = 0; q < +nr; q++) order.push(q);
      var p = S.payouts(+fee, +nr, order), am = p.prizes.map(function (x) { return x.amount; });
      assert.deepStrictEqual(am, esperado[fee][nr], fee + '×' + nr);
      assert.strictEqual(am.reduce(function (s, x) { return s + x; }, 0), p.pot - p.fee, fee + '×' + nr + ' soma');
      am.forEach(function (x, k) { if (k) assert.ok(x <= am[k - 1], 'crescente ' + fee + '×' + nr); });
    });
  });
  [1, 3, 7].forEach(function (fee) { for (var nr = 4; nr <= 8; nr++) { var am = S.payouts(fee, nr, [0, 1, 2, 3, 4, 5, 6, 7].slice(0, nr)).prizes.map(function (x) { return x.amount; });
    am.forEach(function (x, k) { if (k) assert.ok(x <= am[k - 1], 'crescente ' + fee + '×' + nr + ': ' + am); }); } });
});
test('podiumStone sorteia cada lugar de forma independente', function () {
  var sem1 = 0, tem3sem1 = 0, tem2sem1 = 0, ambos = 0, N = 4000;
  for (var s = 1; s <= N; s++) {
    var p1 = GR.podiumStone(s, 1, 50), p2 = GR.podiumStone(s, 2, 50), p3 = GR.podiumStone(s, 3, 50);
    if (!p1) { sem1++; tem3sem1 += p3; tem2sem1 += p2; }
    if (p1 && p3) ambos++;
  }
  near(100 * tem3sem1 / sem1, 25, 3, '3º ganha pedra quando o 1º não ganha');
  near(100 * tem2sem1 / sem1, 40, 3, '2º ganha pedra quando o 1º não ganha');
  near(100 * ambos / N, 15, 2, '1º e 3º juntos (0,6 × 0,25)');
});
test('enhanceOdds/enhance exigem plus inteiro 0–10', function () {
  [1.5, '3', NaN, -1, 10, 11, null, undefined, Infinity].forEach(function (p) {
    assert.strictEqual(GR.enhanceOdds(p), null, String(p));
    assert.strictEqual(GR.enhance({ uid: 'x', id: 'sela-comum', plus: p }, 1, 0), null, String(p));
  });
  assert.strictEqual(GR.enhance(null, 1, 0), null);
  assert.deepStrictEqual(GR.enhanceOdds(3), { chance: 0.7, cost: 1, dropTo: 3 });
});

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
