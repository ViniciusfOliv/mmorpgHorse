// prototype/tools/sim-test.js — node prototype/tools/sim-test.js
'use strict';
var assert = require('assert');
var G = require('../src/data.js');
var S = require('../src/sim.js');
var B = require('../src/breed.js');
var GR = require('../src/gear.js');
var crypto = require('crypto');
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
test('5 raridades com fator de pontos/vagas/chance (sem teto por raridade)', function () {
  assert.deepStrictEqual(Object.keys(G.RARITIES), ['comum','magico','raro','lendario','mitico']);
  assert.strictEqual(G.RARITIES.mitico.ptsMult, 1.2); assert.strictEqual(G.RARITIES.comum.skillSlots, 1);
  Object.keys(G.RARITIES).forEach(function (r) { assert.strictEqual(G.RARITIES[r].statCap, undefined, r + ' sem statCap'); });
  Object.keys(G.RARITIES).forEach(function (r) { assert.strictEqual(G.RARITIES[r].skillChance, undefined, r + ': a skill não é mais sorteada'); }); assert.strictEqual(G.RARITIES.lendario.bornSkills, 2);
});
test('climas e donos', function () {
  assert.deepStrictEqual(Object.keys(G.WEATHERS), ['sol','chuva','nevoa','nublado']);
  assert.strictEqual(G.WEATHERS.nevoa.element, 'grama'); assert.strictEqual(G.WEATHERS.nevoa.penalizes, 'agua');
  assert.strictEqual(G.ELEMENTS.agua.weather, 'chuva'); assert.strictEqual(G.ELEMENTS.fogo.affinity, undefined);
});
test('sem tática, distâncias fixas e pistas de exemplo', function () { assert.ok(!G.TACTICS && !G.DISTANCES && !G.TRACK_EXAMPLES); });
test('toda montaria tem 7 de genética (sem status base), sexo, raridade válida e skills ≤ vagas', function () {
  G.STARTERS.concat(G.WILD_HORSES).forEach(function (h) {
    assert.ok(!('base' in h), h.id + ' sem base');
    G.STAT_KEYS.forEach(function (k) { assert.ok(h.potential[k] >= 0 && h.potential[k] <= 31 && h.potential[k] === Math.floor(h.potential[k]), h.id + ' pot ' + k); });
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
  // o catálogo antigo (peças com mods, antes do equipamento) continua fora; G.ITEMS agora é o dos itens de uso (seção itens)
  ['ferradura-leve', 'ferradura-cravos', 'sela-couro', 'manta-la', 'antolhos', 'rapadura-engenho', 'esporas-prata', 'capa-impermeavel', 'figa-sorte', 'penas-gaviao'].forEach(function (id) {
    assert.ok(!G.ITEMS || !Object.prototype.hasOwnProperty.call(G.ITEMS, id), 'catálogo antigo de itens removido: ' + id);
  });
  Object.keys(G.ITEMS || {}).forEach(function (id) { assert.ok(!('mods' in G.ITEMS[id]) && !('rarity' in G.ITEMS[id]), 'catálogo antigo de itens removido: ' + id + ' sem mods/raridade'); });
});

section('ranks');
test('toda skill tem um resumo curto para a tela (ajustes 1): sem números, até 30 letras, um por skill', function () {
  var vistos = {};
  Object.keys(G.SKILLS).forEach(function (id) {
    var r = G.SKILLS[id].resumo;
    assert.ok(typeof r === 'string' && r.length >= 8 && r.length <= 30, id + ': resumo "' + r + '"');
    assert.ok(!/[0-9%]/.test(r), id + ': o resumo não leva números (eles mudam com o rank e ficam no texto completo): ' + r);
    assert.ok(r[0] === r[0].toUpperCase() && !/[.!]$/.test(r), id + ': maiúscula no começo, sem ponto final: ' + r);
    assert.ok(!vistos[r], id + ': resumo repetido de ' + vistos[r]); vistos[r] = id;
  });
});
test('rankScale: 1,00 1,15 1,30 1,45 1,60; 0, 6, "3" e NaN viram 1, 5, 1 e 1', function () {
  [1, 1.15, 1.30, 1.45, 1.60].forEach(function (v, i) { assert.ok(Math.abs(S.rankScale(i + 1) - v) < 1e-12, 'rank ' + (i + 1)); });
  assert.strictEqual(S.rankScale(0), S.rankScale(1)); assert.strictEqual(S.rankScale(6), S.rankScale(5));
  assert.strictEqual(S.rankScale('3'), 1); assert.strictEqual(S.rankScale(NaN), 1); assert.strictEqual(S.rankScale(), 1);
});
test('SKILL_RANKS: 5 ranks, passo 0,15, custo 150+1 · 400+2 · 900+4 · 2.000+7 e teto do dado extra 60 a 100', function () {
  assert.deepStrictEqual(G.SKILL_RANKS, { max: 5, step: 0.15, custo: { 1: { ouro: 150, perg: 1 }, 2: { ouro: 400, perg: 2 }, 3: { ouro: 900, perg: 4 }, 4: { ouro: 2000, perg: 7, selo: 1 } }, diceTeto: [60, 70, 80, 90, 100] });
});
test('skillEffect escala só a parte de bônus, por formato; duração e distância não crescem', function () {
  var near = function (a, b, m) { assert.ok(Math.abs(a - b) < 1e-12, m + ': ' + a + ' ≠ ' + b); };
  var ba = G.SKILLS.arranque.effect;
  near(S.skillEffect('arranque', 3).accelMult, 1 + (ba.accelMult - 1) * 1.30, 'multiplicador que ajuda');
  assert.strictEqual(S.skillEffect('arranque', 3).distanceM, ba.distanceM);
  assert.strictEqual(S.skillEffect('arranque', 4).speedMult, undefined, 'o marco só entra no rank 5');
  var bc = G.SKILLS['canto-da-iara'].effect;
  near(S.skillEffect('canto-da-iara', 4).drainMult, 1 - (1 - bc.drainMult) * 1.45, 'multiplicador de gasto');
  near(S.skillEffect('drift', 2).curveBonus, G.SKILLS.drift.effect.curveBonus * 1.15, 'bônus somado');
  near(S.skillEffect('nascente', 4).staminaRestore, G.SKILLS.nascente.effect.staminaRestore * 1.45, 'recuperação');
  near(S.skillEffect('sol-a-pino', 3).weatherBonus, G.SKILLS['sol-a-pino'].effect.weatherBonus * 1.30, 'reforço do clima');
  near(S.skillEffect('sprint', 1).speedMult, G.SKILLS.sprint.effect.speedMult, 'rank 1 é a base');
  near(S.skillEffect('sprint', 2, 1.05).speedMult, 1 + (G.SKILLS.sprint.effect.speedMult - 1) * 1.15 * 1.05, 'extraScale multiplica o fator');
  near(S.skillEffect('sprint', 2, 3).speedMult, S.skillEffect('sprint', 2).speedMult, 'extraScale fora de 1–1,1 vale 1');
  assert.strictEqual(S.skillEffect('drift', 5).blockScoped, true);
});
test('marcos do rank 5: substituem duração e gatilho, multiplicam multiplicadores, somam recuperação', function () {
  var near = function (a, b, m) { assert.ok(Math.abs(a - b) < 1e-12, m + ': ' + a + ' ≠ ' + b); };
  var bf = G.SKILLS['folego-de-montanha'].effect.hillDrainMult, f5 = S.skillEffect('folego-de-montanha', 5);
  assert.ok(f5.hillDrainMult >= 0.05); near(f5.hillDrainMult, Math.max(0.05, 1 - (1 - bf) * 1.6), 'Fôlego'); assert.strictEqual(f5.exitRestore, 0.03);
  var c5 = S.skillEffect('casco-firme', 5); assert.strictEqual(c5.hillDrainMult, 0.7); near(c5.hillBonus, G.SKILLS['casco-firme'].effect.hillBonus * 1.6, 'Casco Firme');
  assert.strictEqual(S.skillEffect('saida-rapida', 5).durationS, 7); assert.strictEqual(S.skillEffect('saida-rapida', 4).durationS, G.SKILLS['saida-rapida'].effect.durationS);
  assert.strictEqual(S.skillEffect('chama-final', 5).durationS, 11);
  var a5 = S.skillEffect('arranque', 5); assert.strictEqual(a5.speedMult, 1.03); near(a5.accelMult, 1 + (G.SKILLS.arranque.effect.accelMult - 1) * 1.6, 'Arranque');
  assert.strictEqual(S.skillEffect('sprint', 5).minStraightM, 100); assert.strictEqual(S.skillEffect('sprint', 4).minStraightM, undefined);
  var d5 = S.skillEffect('drift', 5); assert.strictEqual(d5.drainMult, 0.85);
  assert.strictEqual(S.skillEffect('segundo-ar', 5).lowStaminaAt, 0.35);
  var af = S.skillEffect('arrancada-final', 5); assert.strictEqual(af.speedMult, 1.01); assert.strictEqual(af.untilFinish, true); assert.strictEqual(af.durationS, undefined);
  ['sol-a-pino', 'pe-na-chuva', 'nevoa-amiga'].forEach(function (id) { assert.strictEqual(S.skillEffect(id, 5).weatherLingerS, 15, id); assert.strictEqual(S.skillEffect(id, 4).weatherLingerS, undefined, id); });
  var ci = S.skillEffect('canto-da-iara', 5); assert.strictEqual(ci.staminaRestore, 0.05);
  var na = S.skillEffect('nascente', 5); assert.strictEqual(na.speedMult, 1.03); assert.strictEqual(na.durationS, 4); near(na.staminaRestore, G.SKILLS.nascente.effect.staminaRestore * 1.6, 'Nascente');
  var s5 = S.skillEffect('segundo-ar', 5); near(s5.staminaRestore, G.SKILLS['segundo-ar'].effect.staminaRestore * 1.6, 'Segundo Ar: a recuperação da base escala e o marco não soma nela');
});
test('Dado Viciado: 1 dado extra com teto pelo rank; no rank 5, 2 dados de 1 a 100', function () {
  assert.deepStrictEqual(S.skillEffect('dado-viciado', 2), { extraDice: 1, diceTeto: 70 });
  assert.deepStrictEqual(S.skillEffect('dado-viciado', 5), { extraDice: 2, diceTeto: 100 });
  assert.deepStrictEqual(S.skillEffect('dado-viciado', 1, 1.05), { extraDice: 1, diceTeto: 60 });
});
test('skillEffect não muta GameData.SKILLS; todo id tem marco; skill desconhecida dá {}', function () {
  var antes = JSON.stringify(G.SKILLS);
  Object.keys(G.SKILLS).forEach(function (id) { for (var r = 0; r <= 6; r++) { var e = S.skillEffect(id, r, 1.05); e.speedMult = 99; e.novo = 1; } assert.ok(G.SKILLS[id].rank5 && Object.keys(G.SKILLS[id].rank5).length, id + ' sem rank5'); });
  assert.strictEqual(JSON.stringify(G.SKILLS), antes);
  assert.deepStrictEqual(S.skillEffect('nao-existe', 3), {});
});
test('rankOf lê horse.skillRanks; ausente ou inválido vale 1', function () {
  assert.strictEqual(S.rankOf({ skillRanks: { sprint: 4 } }, 'sprint'), 4); assert.strictEqual(S.rankOf({}, 'sprint'), 1);
  [9, 0, '3', NaN, 2.5, null, -1].forEach(function (v) { assert.strictEqual(S.rankOf({ skillRanks: { sprint: v } }, 'sprint'), 1, String(v)); });
  assert.strictEqual(S.rankOf(null, 'sprint'), 1); assert.strictEqual(S.rankOf({ skillRanks: { sprint: 5 } }, 'drift'), 1);
});
test('a desc de cada skill é o texto do rank 1 (skillDesc), e o do rank 5 cita o marco', function () {
  Object.keys(G.SKILLS).forEach(function (id) {
    assert.strictEqual(G.SKILLS[id].desc, S.skillDesc(id, 1), id);
    assert.notStrictEqual(S.skillDesc(id, 5), S.skillDesc(id, 4), id + ': o rank 5 tem de dizer o marco');
    assert.notStrictEqual(S.skillDesc(id, 2), S.skillDesc(id, 1), id + ': o rank muda o texto');
  });
  // o texto usa os números do rank: no rank 5 do Sprint, a reta de 100 m (o marco) e a velocidade × 1,6
  var pct5 = String(Math.round((G.SKILLS.sprint.effect.speedMult - 1) * 1.6 * 1000) / 10).replace('.', ',');
  assert.strictEqual(S.skillDesc('sprint', 5), 'Numa reta de 100 m ou mais (fora a da largada): +' + pct5 + '% de velocidade por 150 m.');
});
test('Poder sobe com o rank: cada skill soma 14 × peso do gatilho × fator do rank', function () {
  var h = cl(G.WILD_HORSES.filter(function (x) { return x.rarity === 'raro'; })[0]); h.skills = ['sprint']; h.skillRanks = { sprint: 1 };
  var p1 = S.powerRating(h); h.skillRanks.sprint = 5; var p5 = S.powerRating(h);
  assert.ok(p5 - p1 === 8 || p5 - p1 === 9, 'Sprint 1 → 5: +14 × 1 × 0,6 = 8,4, arredondado: ' + (p5 - p1));
  h.skillRanks = { sprint: 1 }; var semSkill = cl(h); semSkill.skills = [];
  assert.strictEqual(S.powerRating(h) - S.powerRating(semSkill), 14, 'no rank 1 a skill vale o de sempre');
  h.skillRanks = { sprint: 9 }; assert.strictEqual(S.powerRating(h), p1, 'rank inválido vale 1');
  h.skills = ['folego-de-montanha']; h.skillRanks = { 'folego-de-montanha': 3 }; var b3 = S.powerRating(h); h.skillRanks = {};
  assert.ok(Math.abs((b3 - S.powerRating(h)) - 14 * 0.6 * 0.3) <= 1, 'peso do gatilho × 0,30');
});
test('botRank: média arredondada dos ranks das skills de vaga do cavalo; 1 sem skill', function () {
  assert.strictEqual(S.botRank({ skills: ['sprint', 'drift'], skillRanks: { sprint: 4, drift: 1 } }), 3, '2,5 arredonda para 3');
  assert.strictEqual(S.botRank({ skills: [] }), 1); assert.strictEqual(S.botRank({}), 1); assert.strictEqual(S.botRank(null), 1);
  assert.strictEqual(S.botRank({ skills: ['sprint', 'drift', 'arranque'], skillRanks: { sprint: 5, drift: 5, arranque: 5 } }), 5);
  assert.strictEqual(S.botRank({ skills: ['sprint', 'nao-existe'], skillRanks: { sprint: 4, 'nao-existe': 5 } }), 4, 'skill fora do catálogo não conta');
  assert.strictEqual(S.botRank({ skills: ['sprint', 'drift'], skillRanks: { sprint: 9, drift: 2 } }), 2, 'rank inválido vale 1: (1 + 2) / 2 = 1,5 → 2');
});
test('withRanks: cópia com todas as skills de vaga no rank dado, sem mexer no original', function () {
  var h = { id: 'x', skills: ['sprint', 'drift'], skillRanks: { sprint: 2 } }, c = S.withRanks(h, 4);
  assert.deepStrictEqual(c.skillRanks, { sprint: 4, drift: 4 }); assert.deepStrictEqual(h.skillRanks, { sprint: 2 });
  assert.deepStrictEqual(S.withRanks(h, 9).skillRanks, { sprint: 5, drift: 5 }); assert.deepStrictEqual(S.withRanks(h, 'x').skillRanks, { sprint: 1, drift: 1 });
  assert.deepStrictEqual(S.withRanks({ skills: [] }, 3).skillRanks, {});
});
test('os oponentes do ginásio saem com as skills no rank da etapa: soldados 1 a 3 no rank 1, soldado 4 e líder no 2', function () {
  var GN = require('../src/ginasio.js');
  G.GYM_ORDER.forEach(function (gid) {
    assert.deepStrictEqual(G.GYMS[gid].etapas.map(function (e) { return e.cavalos[0].rank; }), [1, 1, 1, 2, 2], gid);
    G.GYMS[gid].etapas.forEach(function (et, i) {
      et.cavalos.forEach(function (def) {
        var h = GN.cavalo(def), esperado = i >= 3 ? 2 : 1;
        h.skills.forEach(function (id) { assert.strictEqual(h.skillRanks[id], esperado, gid + ' ' + et.id + ' ' + id); });
        assert.strictEqual(Object.keys(h.skillRanks).length, h.skills.length);
      });
    });
  });
  // os cavalos-base dos ginásios (os iniciais) não têm skill de vaga hoje: o rank fica pronto para quando tiverem.
  // Com uma base que tem skills, o rank da etapa vale para todas; ausente ou inválido vale 1.
  var comSkill = G.WILD_HORSES.filter(function (x) { return x.skills.length >= 2; })[0];
  var h2 = GN.cavalo({ base: comSkill.id, level: 16, grau: 2, rank: 2 }), h1 = GN.cavalo({ base: comSkill.id, level: 16, grau: 2 });
  comSkill.skills.forEach(function (id) { assert.strictEqual(h2.skillRanks[id], 2, id); assert.strictEqual(h1.skillRanks[id], 1, id); });
  assert.ok(S.powerRating(h2) > S.powerRating(h1), 'o rank entra no Poder do oponente');
});

section('status');
test('computeStats devolve 7 chaves: base + pontos comprados, sem teto por raridade', function () {
  var h = JSON.parse(JSON.stringify(G.STARTERS[0])); h.level = 50; h.alloc = { vel: 20, acel: 20 };
  var s = S.computeStats(h);
  assert.deepStrictEqual(Object.keys(s), G.STAT_KEYS);
  // Brasa: genética 24 em Velocidade e Aceleração, base 40 + 16 × 24 / 31 = 52,39 (o nível não soma nada); + 20 pontos = 72
  assert.strictEqual(s.vel, 72); assert.strictEqual(s.acel, 72, 'sem bônus fixo de elemento');
});
test('a chance de skill saiu da regra: sem skillChance no RaceSim nem no TUNING', function () {
  assert.strictEqual(S.skillChance, undefined);
  ['skillPerLevel', 'skillPerSorte', 'skillChanceMax'].forEach(function (k) { assert.strictEqual(S.TUNING[k], undefined, k); });
});
test('powerRating usa os 7 pesos, 14 por skill e os termos de nível e raridade (spec §7)', function () {
  var h = JSON.parse(JSON.stringify(G.STARTERS[0])); var s = S.computeStats(h), w = S.TUNING.ratingW, sum = 0;
  G.STAT_KEYS.forEach(function (k) { sum += s[k] * w[k]; });
  assert.deepStrictEqual(w, { vel: 2.5, acel: 2.0, man: 2.2, est: 2.4, forca: 2.4, garra: 1.5, sorte: 0 });
  assert.deepStrictEqual([S.TUNING.ratingSkillPts, S.TUNING.ratingLevel, S.TUNING.ratingRar], [14, 20, 28]);
  // os iniciais nascem sem skill; Comum nível 1: nível e raridade somam 0
  assert.strictEqual(S.powerRating(h), Math.round(sum));
  h.skills = ['arranque']; assert.strictEqual(S.powerRating(h), Math.round(sum + 14 * 1));   // arranque: start = 1
  h.level = 50; s = S.computeStats(h); sum = 0; G.STAT_KEYS.forEach(function (k) { sum += s[k] * w[k]; });
  assert.strictEqual(S.powerRating(h), Math.round(sum + 14 + 20));
  h.rarity = 'mitico'; s = S.computeStats(h); sum = 0; G.STAT_KEYS.forEach(function (k) { sum += s[k] * w[k]; });
  assert.strictEqual(S.powerRating(h), Math.round(sum + 14 + 20 + 28));
});
test('powerRating: o tipo não entra no Poder (nível e raridade valem o mesmo para os três e para elemento desconhecido)', function () {
  var h0 = JSON.parse(JSON.stringify(G.STARTERS[0])); h0.level = 30; h0.rarity = 'raro'; h0.skills = [];
  ['fogo', 'agua', 'grama', 'neutro', 'lava', undefined].forEach(function (e) {
    var h = JSON.parse(JSON.stringify(h0)); h.element = e;
    var s = S.computeStats(h), w = S.TUNING.ratingW, sum = 0;
    G.STAT_KEYS.forEach(function (k) { sum += s[k] * w[k]; });
    if (['fogo', 'agua', 'grama'].indexOf(e) < 0) assert.strictEqual(S.typeSkill(h), null, String(e));
    assert.strictEqual(S.powerRating(h), Math.round(sum + 20 * 29 / 49 + 28 * 2 / 4), String(e));
  });
});
test('learnSkill não estoura vagas e respeita o elemento', function () {
  var full = { id: 'x', element: 'fogo', rarity: 'comum', skills: ['arranque'] };
  assert.strictEqual(S.learnSkill(full, function () { return 0; }), null);
  var m = { id: 'x', element: 'fogo', rarity: 'mitico', skills: [] }, seen = {};
  for (var i = 0; i < 400; i++) { var id = S.learnSkill(m, S.mulberry32(i)); if (id) seen[id] = 1; }
  assert.ok(seen.arranque && seen['sol-a-pino'], 'aprende gerais e do elemento');
  assert.ok(!seen['pe-na-chuva'], 'não aprende de outro elemento');
});

section('status v3');
function clone(x) { return JSON.parse(JSON.stringify(x)); }
test('v3: status nasce da genética na faixa da raridade', function () {
  var h = { rarity: 'comum', level: 1, grau: 2, potential: { vel: 24, acel: 24, man: 14, forca: 12, est: 12, garra: 14, sorte: 12 } };
  assert.deepStrictEqual(S.computeStats(h), { vel: 52, acel: 52, man: 47, forca: 46, est: 46, garra: 47, sorte: 46 });
});
test('v3: iniciais são Comuns ★★ com a mesma soma de genética e de status', function () {
  G.STARTERS.forEach(function (h) {
    var g = 0, s = 0, st = S.computeStats(h);
    G.STAT_KEYS.forEach(function (k) { g += h.potential[k]; s += st[k]; });
    assert.strictEqual(h.rarity, 'comum'); assert.strictEqual(h.grau, 2); assert.strictEqual(g, 112); assert.strictEqual(s, 336);
    assert.strictEqual(h.base, undefined);
  });
});
test('v3: estrelas (starsOf) e status arredondado uma vez só, no fim', function () {
  assert.strictEqual(S.starsOf({ grau: 1 }), 1); assert.strictEqual(S.starsOf({ grau: 3 }), 3);
  [undefined, null, 'x', NaN, Infinity].forEach(function (g) { assert.strictEqual(S.starsOf({ grau: g }), 2, String(g)); });
  assert.strictEqual(S.starsOf(null), 2); assert.strictEqual(S.starsOf({}), 2);
  // como Breed.grauOf: fora da faixa é preso a 1–3
  assert.strictEqual(S.starsOf({ grau: 0 }), 1); assert.strictEqual(S.starsOf({ grau: 7 }), 3); assert.strictEqual(S.starsOf({ grau: '3' }), 3);
  // base 40 + 16/31 = 40,516 vira 41; com 3 pontos, round(43,516) = 44
  var h = { rarity: 'comum', level: 10, grau: 2, potential: { vel: 1 } };
  assert.strictEqual(S.computeStats(h).vel, 41);
  h.alloc = { vel: 3 }; assert.strictEqual(S.computeStats(h).vel, 44);
});

// ---------------------------------------------------------------------------
// Crescimento livre (bloco 1b; spec 2026-11-12-crescimento-livre §2–§7 e §13)
// ---------------------------------------------------------------------------
section('Crescimento livre');
var RARS = ['comum', 'magico', 'raro', 'lendario', 'mitico'];
var ZEROS = { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 };
function custoTotal(a) { var c = 0; G.STAT_KEYS.forEach(function (k) { c += S.costOf(a[k]); }); return c; }
test('constantes novas em TUNING e nas raridades; sem statCap, freeCapShare, statLimit nem crescimento natural', function () {
  var T = S.TUNING;
  assert.deepStrictEqual([T.ptsRate0, T.ptsRate1, T.starMult, T.costStep, T.statMax, T.noBuy], [2, 6, [1, 1.09, 1.22], 10, 150, ['sorte']]);
  assert.deepStrictEqual(RARS.map(function (r) { return G.RARITIES[r].baseLo; }), [40, 44, 49, 54, 60]);
  assert.deepStrictEqual(RARS.map(function (r) { return G.RARITIES[r].ptsMult; }), [1, 1.05, 1.1, 1.15, 1.2]);
  ['freeCapShare', 'gGrowBase', 'gGrowRange', 'weatherMultSet', 'ratingTypeW', 'aBase', 'aRange'].forEach(function (k) { assert.strictEqual(T[k], undefined, 'TUNING.' + k); });
  assert.strictEqual(S.statLimit, undefined, 'statLimit saiu');
});
test('freePoints: 0 no nível 1, 2 no nível 2; Comum ★ 50 = 196; Comum ★★ 11/30/50 = 25/100/213; Mítico ★★★ 50 = 286', function () {
  RARS.forEach(function (r) {
    [1, 2, 3].forEach(function (st) {
      assert.strictEqual(S.freePoints({ rarity: r, grau: st, level: 1 }), 0, r + ' ★' + st + ' nível 1');
      assert.strictEqual(S.freePoints({ rarity: r, grau: st, level: 2 }), 2, r + ' ★' + st + ' nível 2');
    });
  });
  assert.strictEqual(S.freePoints({ rarity: 'comum', grau: 1, level: 50 }), 196);
  assert.deepStrictEqual([11, 30, 50].map(function (L) { return S.freePoints({ rarity: 'comum', grau: 2, level: L }); }), [25, 100, 213]);
  assert.strictEqual(S.freePoints({ rarity: 'mitico', grau: 3, level: 50 }), 286);
  // a tabela da spec §2 (Comum / Mítico nos níveis 11, 30 e 50)
  var tab = { 1: [[23, 91, 196], [28, 110, 235]], 2: [[25, 100, 213], [31, 120, 256]], 3: [[28, 112, 239], [34, 134, 286]] };
  [1, 2, 3].forEach(function (st) {
    ['comum', 'mitico'].forEach(function (r, q) {
      assert.deepStrictEqual([11, 30, 50].map(function (L) { return S.freePoints({ rarity: r, grau: st, level: L }); }), tab[st][q], r + ' ★' + st);
    });
  });
  // a taxa por nível sobe: ganho de um nível nunca cai (Comum ★, sem o fator)
  var prev = 0;
  for (var L = 2; L <= 50; L++) { var d = S.freePoints({ rarity: 'comum', grau: 1, level: L }) - S.freePoints({ rarity: 'comum', grau: 1, level: L - 1 }); assert.ok(d >= prev - 1, 'nível ' + L); prev = d; }
  // nível malformado vale 1; acima de 50 vale 50
  assert.strictEqual(S.freePoints({ rarity: 'raro', grau: 2, level: 'x' }), 0);
  assert.strictEqual(S.freePoints({ rarity: 'raro', grau: 2, level: 99 }), S.freePoints({ rarity: 'raro', grau: 2, level: 50 }));
});
test('custo por faixa: costOf(0/1/10/11/20/30/50) = 0/1/10/12/30/60/150 e pointCost(0/9/10/19/20) = 1/1/2/2/3', function () {
  assert.deepStrictEqual([0, 1, 10, 11, 20, 30, 50].map(S.costOf), [0, 1, 10, 12, 30, 60, 150]);
  assert.deepStrictEqual([0, 9, 10, 19, 20].map(S.pointCost), [1, 1, 2, 2, 3]);
  // costOf é a soma dos pointCost
  var soma = 0;
  for (var a = 0; a <= 120; a++) { assert.strictEqual(S.costOf(a), soma, 'costOf(' + a + ')'); soma += S.pointCost(a); }
});
test('validAlloc: corta pelo 150 e depois pelo custo, na ordem de STAT_KEYS; zera a Sorte; lixo vira 0', function () {
  var h = clone(G.STARTERS[0]); h.level = 50;   // Comum ★★: 213 pontos
  // pelo custo, na ordem: 60 em Velocidade custam 210; sobram 3, que compram 3 de Aceleração; Manobra fica sem
  assert.deepStrictEqual(S.validAlloc(h, { vel: 60, acel: 60, man: 60 }), { vel: 60, acel: 3, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 });
  assert.deepStrictEqual(S.validAlloc(h, { man: 60, vel: 60 }), { vel: 60, acel: 0, man: 3, forca: 0, est: 0, garra: 0, sorte: 0 }, 'a ordem é a de STAT_KEYS, não a do objeto');
  // pelo teto antes do custo: com statMax 60 (só neste teste), cada status aceita até piso(60 − base)
  var T = S.TUNING, sm = T.statMax;
  T.statMax = 60;
  try {
    var mb = Math.floor(60 - S.naturalStat(h, 'vel'));
    assert.strictEqual(S.maxBuy(h, 'vel'), mb);
    // sem o corte do teto primeiro, 50 em Velocidade custariam 150 e Aceleração ficaria com 25
    var v = S.validAlloc(h, { vel: 50, acel: 50 });
    assert.strictEqual(v.vel, mb); assert.strictEqual(v.acel, mb);
    assert.ok(S.naturalStat(h, 'vel') + v.vel <= 60 && S.naturalStat(h, 'vel') + v.vel + 1 > 60);
  } finally { T.statMax = sm; }
  // Sorte não recebe pontos
  assert.strictEqual(S.maxBuy(h, 'sorte'), 0);
  assert.deepStrictEqual(S.validAlloc(h, { sorte: 10, vel: 2 }), { vel: 2, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 });
  // lixo: negativo, fração, texto, chave faltando, não objeto
  assert.deepStrictEqual(S.validAlloc(h, { vel: -5, acel: 2.7, man: 'abc', forca: '3', est: NaN, garra: Infinity }), { vel: 0, acel: 2, man: 0, forca: 3, est: 0, garra: 0, sorte: 0 });
  [null, undefined, 'tudo', 7, {}].forEach(function (a) { assert.deepStrictEqual(S.validAlloc(h, a), ZEROS, String(a)); });
  // saída sempre válida: inteiros ≥ 0, base + a ≤ 150, custo ≤ pontos
  var rng = S.mulberry32(5);
  for (var i = 0; i < 300; i++) {
    var x = { rarity: RARS[i % 5], grau: 1 + i % 3, level: 1 + Math.floor(rng() * 50), potential: {} }, a = {};
    G.STAT_KEYS.forEach(function (k) { x.potential[k] = Math.floor(rng() * 32); a[k] = Math.floor(rng() * 200) - 20; });
    var va = S.validAlloc(x, a);
    assert.ok(custoTotal(va) <= S.freePoints(x), 'custo');
    G.STAT_KEYS.forEach(function (k) { assert.ok(va[k] >= 0 && va[k] === Math.floor(va[k]) && S.naturalStat(x, k) + va[k] <= 150 + 1e-9, k); });
    assert.strictEqual(va.sorte, 0);
    assert.deepStrictEqual(S.validAlloc(x, va), va, 'idempotente');
  }
});
test('allocInfo: free/used/left, perStat, next e room coerentes com costOf; room.sorte = 0', function () {
  var h = clone(G.STARTERS[0]); h.level = 50; h.alloc = { vel: 4, est: 10 };
  var info = S.allocInfo(h);
  assert.deepStrictEqual(Object.keys(info).sort(), ['free', 'left', 'next', 'perStat', 'room', 'used']);
  assert.strictEqual(info.free, 213); assert.strictEqual(info.used, 4 + 10); assert.strictEqual(info.left, 199);
  assert.deepStrictEqual(info.perStat, { vel: 4, acel: 0, man: 0, forca: 0, est: 10, garra: 0, sorte: 0 });
  assert.strictEqual(info.next.vel, 1); assert.strictEqual(info.next.est, 2, 'o 11º ponto custa 2');
  // Velocidade: 4 + 54 = 58 custam 198 (≤ 199 + 4); 59 custariam 204. Estamina: 10 + 49 = 59 custam 204 (≤ 199 + 10)
  assert.strictEqual(info.room.vel, 54); assert.strictEqual(info.room.est, 49); assert.strictEqual(info.room.sorte, 0);
  // comprar room[k] cabe; room[k] + 1 não (pelo custo ou pelo 150), em cavalos sorteados
  var rng = S.mulberry32(11);
  for (var i = 0; i < 200; i++) {
    var x = { rarity: RARS[i % 5], grau: 1 + i % 3, level: 1 + Math.floor(rng() * 50), potential: {}, alloc: {} };
    G.STAT_KEYS.forEach(function (k) { x.potential[k] = Math.floor(rng() * 32); x.alloc[k] = Math.floor(rng() * 25); });
    var inf = S.allocInfo(x), a = S.validAlloc(x, x.alloc);
    assert.strictEqual(inf.used, custoTotal(a)); assert.strictEqual(inf.left, inf.free - inf.used); assert.ok(inf.left >= 0);
    assert.strictEqual(inf.room.sorte, 0);
    G.STAT_KEYS.forEach(function (k) {
      assert.strictEqual(inf.next[k], S.pointCost(a[k]), 'next ' + k);
      var mais = clone(a); mais[k] += inf.room[k];
      assert.deepStrictEqual(S.validAlloc(x, mais), mais, 'room ' + k + ' cabe');
      mais[k] += 1;
      assert.notDeepStrictEqual(S.validAlloc(x, mais), mais, 'room ' + k + ' + 1 não cabe');
    });
  }
});
test('no nível 1: pontos, alloc e allocInfo dão zero (nunca −0)', function () {
  var h = { rarity: 'comum', level: 1, grau: 3, potential: {}, alloc: { vel: 5, acel: 2 } };
  assert.strictEqual(S.freePoints(h), 0);
  assert.deepStrictEqual(S.validAlloc(h, h.alloc), ZEROS);
  var ones = { vel: 1, acel: 1, man: 1, forca: 1, est: 1, garra: 1, sorte: 1 };
  assert.deepStrictEqual(S.allocInfo(h), { free: 0, used: 0, left: 0, perStat: ZEROS, next: ones, room: ZEROS });
});
test('weightedAlloc: um ponto por vez no menor (a + 1)/peso; empate na ordem de STAT_KEYS; determinístico', function () {
  var seis = { vel: 1, acel: 1, man: 1, forca: 1, est: 1, garra: 1 };
  var n2 = { rarity: 'comum', grau: 1, level: 2, potential: {} };   // 2 pontos
  assert.deepStrictEqual(S.weightedAlloc(n2, seis), { vel: 1, acel: 1, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 });
  assert.deepStrictEqual(S.weightedAlloc(n2, { man: 1, garra: 1 }), { vel: 0, acel: 0, man: 1, forca: 0, est: 0, garra: 1, sorte: 0 }, 'peso 0 ou faltando: não compra');
  // peso 2 em Garra: o dobro de pontos (custo por faixa à parte)
  var h = clone(G.STARTERS[1]); h.level = 30;
  var a = S.weightedAlloc(h, { vel: 1, acel: 1, man: 1, forca: 1, est: 1, garra: 2 });
  assert.ok(a.garra >= 2 * a.vel - 2 && a.garra <= 2 * a.vel + 2, JSON.stringify(a));
  assert.deepStrictEqual(S.weightedAlloc(h, { vel: 1, acel: 1, man: 1, forca: 1, est: 1, garra: 2 }), a, 'determinístico');
  // peso na Sorte não compra nada (noBuy)
  assert.strictEqual(S.weightedAlloc(h, { sorte: 5, vel: 1 }).sorte, 0);
  // com statMax baixo para no teto e põe o resto nos outros
  var T = S.TUNING, sm = T.statMax;
  T.statMax = 60;
  try {
    var b = S.weightedAlloc(h, { vel: 100, acel: 1 });
    assert.strictEqual(b.vel, S.maxBuy(h, 'vel')); assert.ok(b.acel > 0, 'o resto foi para Aceleração');
  } finally { T.statMax = sm; }
});
test('botAlloc e weightedAlloc: nunca passam dos pontos nem de 150, nunca põem ponto na Sorte, fixos e sem mutar', function () {
  var casos = [];
  G.STARTERS.concat(G.WILD_HORSES).forEach(function (h0) { [1, 2, 11, 30, 50].forEach(function (lv) { var h = clone(h0); h.level = lv; casos.push(h); }); });
  ['fogo', 'agua', 'grama'].forEach(function (el) { ['comum', 'raro', 'mitico'].forEach(function (r) { [0, 16, 31].forEach(function (g) { [1, 2, 3].forEach(function (st) { casos.push(refBot(el, r, 50, g, st)); }); }); }); });
  casos.forEach(function (h) {
    delete h.alloc;
    var a = S.botAlloc(h), tag = h.id + ' ' + h.element + ' ' + h.rarity + ' nv' + h.level + ' ★' + h.grau, left = S.freePoints(h) - custoTotal(a);
    assert.deepStrictEqual(Object.keys(a), G.STAT_KEYS, tag);
    assert.ok(left >= 0, tag + ' custo');
    assert.strictEqual(a.sorte, 0, tag + ' Sorte');
    G.STAT_KEYS.forEach(function (k) {
      assert.ok(a[k] >= 0 && a[k] === Math.floor(a[k]) && S.naturalStat(h, k) + a[k] <= 150 + 1e-9, tag + ' ' + k);
      // gasta tudo o que dá: nenhum status de corrida aceita mais um ponto
      if (k !== 'sorte') assert.ok(a[k] >= S.maxBuy(h, k) || S.pointCost(a[k]) > left, tag + ' sobrou ponto para ' + k);
    });
    assert.deepStrictEqual(S.validAlloc(h, a), a, tag + ' válida');
    assert.deepStrictEqual(S.botAlloc(h), a, tag + ' fixa');
    assert.strictEqual(h.alloc, undefined, tag + ' não muta');
  });
});
test('botAlloc: pesos do tipo (× 1,2 nos dois status do tipo), Comum ★★ de genética 16 no nível 50', function () {
  assert.deepStrictEqual(S.TUNING.botW, {
    fogo: { vel: 1.2, acel: 1.2, man: 1, forca: 1, est: 1, garra: 1 },
    agua: { vel: 1, acel: 1, man: 1, forca: 1, est: 1.2, garra: 1.2 },
    grama: { vel: 1, acel: 1, man: 1.2, forca: 1.2, est: 1, garra: 1 }
  });
  // 213 pontos: os dois do tipo com 25, os outros com 20 (o ponto que sobra vai ao primeiro na ordem de STAT_KEYS)
  assert.deepStrictEqual(refBot('fogo', 'comum', 50, 16).alloc, { vel: 25, acel: 25, man: 21, forca: 20, est: 20, garra: 20, sorte: 0 });
  assert.deepStrictEqual(refBot('agua', 'comum', 50, 16).alloc, { vel: 21, acel: 20, man: 20, forca: 20, est: 25, garra: 25, sorte: 0 });
  assert.deepStrictEqual(refBot('grama', 'comum', 50, 16).alloc, { vel: 21, acel: 20, man: 25, forca: 25, est: 20, garra: 20, sorte: 0 });
  ['fogo', 'agua', 'grama'].forEach(function (e) { assert.strictEqual(custoTotal(refBot(e, 'comum', 50, 16).alloc), 213, e + ' gasta tudo'); });
  assert.deepStrictEqual(refBot('fogo', 'comum', 1, 16).alloc, ZEROS, 'no nível 1 não há ponto');
  // elemento desconhecido: os pesos do Fogo
  var x = refBot('fogo', 'raro', 30, 9); x.element = 'lava'; assert.deepStrictEqual(S.botAlloc(x), refBot('fogo', 'raro', 30, 9).alloc);
});
test('botAlloc(h, de): mantém o que está em de e só soma ("Distribuir sugerido")', function () {
  var h = clone(G.STARTERS[2]); h.level = 40;
  [{ vel: 30 }, { garra: 12, est: 3 }, { man: 50, forca: 1 }, {}, null].forEach(function (de) {
    var a = S.botAlloc(h, de), base = S.validAlloc(h, de), left = S.freePoints(h) - custoTotal(a);
    G.STAT_KEYS.forEach(function (k) { assert.ok(a[k] >= base[k], JSON.stringify(de) + ' ' + k); });
    assert.strictEqual(a.sorte, 0); assert.ok(left >= 0);
    ['vel', 'acel', 'man', 'forca', 'est', 'garra'].forEach(function (k) { assert.ok(a[k] >= S.maxBuy(h, k) || S.pointCost(a[k]) > left, 'gasta tudo: ' + k); });
    assert.deepStrictEqual(S.botAlloc(h, de), a, 'determinístico');
  });
  assert.deepStrictEqual(S.botAlloc(h, null), S.botAlloc(h), 'sem de, parte do zero');
  // Sorte em `de` é zerada (validAlloc) e o que já gastou tudo volta igual
  assert.strictEqual(S.botAlloc(h, { sorte: 9 }).sorte, 0);
  var cheio = S.botAlloc(h); assert.deepStrictEqual(S.botAlloc(h, cheio), cheio);
  // de acima do orçamento: é saneado antes (validAlloc), nunca passa dos pontos
  assert.ok(custoTotal(S.botAlloc(h, { vel: 999, acel: 999 })) <= S.freePoints(h));
});
test('computeStats sem gear e em 1–150; o pior caso no nível 50 (Mítico ★★★, genética 31, tudo num status) é 146', function () {
  assert.strictEqual(S.computeStats.length, 1, 'computeStats(horse)'); assert.strictEqual(S.powerRating.length, 1, 'powerRating(horse)');
  var m = { element: 'fogo', rarity: 'mitico', grau: 3, level: 50, potential: {}, alloc: { vel: 999 } };
  G.STAT_KEYS.forEach(function (k) { m.potential[k] = 31; });
  assert.strictEqual(S.maxBuy(m, 'vel'), 74); assert.strictEqual(S.validAlloc(m, m.alloc).vel, 70);
  assert.strictEqual(S.computeStats(m).vel, 146);
  var rng = S.mulberry32(21);
  for (var i = 0; i < 300; i++) {
    var x = { rarity: RARS[i % 5], grau: 1 + i % 3, level: 1 + Math.floor(rng() * 50), potential: {}, alloc: {} };
    G.STAT_KEYS.forEach(function (k) { x.potential[k] = Math.floor(rng() * 32); x.alloc[k] = Math.floor(rng() * 300); });
    var s = S.computeStats(x);
    G.STAT_KEYS.forEach(function (k) { assert.ok(s[k] >= 1 && s[k] <= 150 && s[k] === Math.round(s[k]), k + ' = ' + s[k]); });
  }
});
test('powerRating e computeStats iguais com e sem peças no cavalo (equipamento suspenso)', function () {
  var SL = ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'], items = {}, equip = {};
  SL.forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-sol-raro', plus: 10 }; equip[sl] = 'i' + i; });
  var g5 = GR.resolve({ equip: equip }, items);
  assert.ok(g5.mods.vel > 0 && g5.set.count === 5, 'o conjunto ainda resolve (gear.js não muda)');
  G.STARTERS.forEach(function (h0) {
    var h = clone(h0); h.level = 30; h.alloc = S.botAlloc(h);
    var sem = { st: S.computeStats(h), pr: S.powerRating(h) };
    h.equip = clone(equip);   // peças equipadas no cavalo
    [g5, GR.resolve({}, {}), 'sela-couro', { mods: { vel: 200 } }, null].forEach(function (g, gi) {
      assert.deepStrictEqual(S.computeStats(h, g), sem.st, h.id + ' status, gear ' + gi);
      assert.strictEqual(S.powerRating(h, g), sem.pr, h.id + ' Poder, gear ' + gi);
    });
  });
});
test('Dado da Sorte: chance do 2º dado 0 com Sorte 40, 0,5 com 60 e 1 com 80 ou mais', function () {
  assert.deepStrictEqual([S.TUNING.sorteDiceLo, S.TUNING.sorteDiceFull], [40, 80]);
  function dois(sorte, N) { var rng = S.mulberry32(31 + sorte), c = 0; for (var i = 0; i < N; i++) if (S.rollDice(rng, sorte, 0).dice.length === 2) c++; return c / N; }
  assert.strictEqual(dois(40, 3000), 0); assert.strictEqual(dois(0, 1000), 0, 'abaixo de 40 também 0');
  assert.strictEqual(dois(80, 3000), 1); assert.strictEqual(dois(150, 1000), 1);
  near(dois(60, 20000), 0.5, 0.015, 'Sorte 60');
  near(dois(50, 20000), 0.25, 0.015, 'Sorte 50');
  // Mítico g31 (Sorte 76) contra sete Comuns g0 (Sorte 40): ~20,8% (spec §4; o justo seria 12,5%)
  var rng = S.mulberry32(77), w = 0, N = 8000;
  for (var i = 0; i < N; i++) { var me = S.rollDice(rng, 76, 0).best, top = 0; for (var j = 0; j < 7; j++) top = Math.max(top, S.rollDice(rng, 40, 0).best); if (me > top) w++; else if (me === top) w += 0.5; }
  var p = 100 * w / N; assert.ok(p >= 17 && p <= 25, p + '%');
});
// Corredor de teste plano: Comum nível 1 (P da skill de tipo = 1), genética 0, todo status = `v` pelo gancho statAdd
function plano(el, v, extra) {
  var h = { id: 'p', name: 'P', element: el, rarity: 'comum', level: 1, grau: 2, potential: {}, skills: [] }, add = {};
  G.STAT_KEYS.forEach(function (k) { h.potential[k] = 0; add[k] = (extra && extra[k] != null ? extra[k] : v) - 40; });
  return { horse: h, statAdd: add };
}
function solo(seed, cond, ent, semTipo) {
  var e = { horse: ent.horse, statAdd: ent.statAdd, name: 'p' }; if (semTipo) e.noTypeSkill = true;
  return S.simulate({ seed: seed, conditions: cond, recordFrames: true, racers: [e] });
}
var MISTA = { distance: 1800, surface: 'terra', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 200 }, { type: 'curva', from: 200, to: 500 }, { type: 'subida', from: 500, to: 800 },
  { type: 'curva', from: 800, to: 1100 }, { type: 'subida', from: 1100, to: 1300 }, { type: 'curva', from: 1300, to: 1600 }, { type: 'reta', from: 1600, to: 1800 }] };
test('skill de tipo: os dois status do tipo valem × (1 + m·P) no terço dela', function () {
  // com o terço estendido à pista toda, o cavalo com a skill corre igual (frame a frame) ao cavalo sem ela com os
  // dois status × (1 + m): 100 → 119 (Fogo), 115 (Grama) e 133 (Água), Comum nível 1 (P = 1). Status que entram
  // fora do terço (atraso de largada pela Aceleração, tanque pela Estamina, início da arrancada pela Garra) ficam
  // presos pelo TUNING de teste, para a comparação ser exata.
  var T = S.TUNING, salvo = { sd: T.startDelayMax, pe: T.poolEst, gz: T.garraZoneK }, zonas = {};
  var casos = [['fogo', { vel: 119, acel: 119 }], ['grama', { forca: 115, man: 115 }], ['agua', { est: 133, garra: 133 }]];
  T.startDelayMax = 0; T.poolEst = 0; T.garraZoneK = 0;
  casos.forEach(function (c) { zonas[c[0]] = G.TYPE_SKILLS[c[0]].zone; G.TYPE_SKILLS[c[0]].zone = [0, 1]; });
  try {
    casos.forEach(function (c) {
      assert.strictEqual(S.typePower({ element: c[0], rarity: 'comum', level: 1 }), 1);
      for (var s = 1; s <= 4; s++) {
        var cond = s === 1 ? MISTA : S.randomConditions(s);
        var com = solo(s, cond, plano(c[0], 100)), sem = solo(s, cond, plano(c[0], 100, c[1]), true), nada = solo(s, cond, plano(c[0], 100), true);
        assert.deepStrictEqual(com.frames, sem.frames, c[0] + ' seed ' + s + ': frames iguais aos do status multiplicado');
        assert.deepStrictEqual(com.finishTimes, sem.finishTimes);
        assert.notDeepStrictEqual(com.frames, nada.frames, c[0] + ' seed ' + s + ': a skill muda a corrida');
      }
    });
  } finally {
    T.startDelayMax = salvo.sd; T.poolEst = salvo.pe; T.garraZoneK = salvo.gz;
    casos.forEach(function (c) { G.TYPE_SKILLS[c[0]].zone = zonas[c[0]]; });
  }
});
test('skill de tipo: fora do terço, os valores normais', function () {
  function primeiroDiferente(a, b) { for (var f = 0; f < a.frames.length; f++) if (JSON.stringify(a.frames[f]) !== JSON.stringify(b.frames[f])) return f; return -1; }
  // antes do terço: frames iguais aos do cavalo sem a skill até ele entrar no terço (Raízes Firmes e Maré Alta)
  [['grama', 1 / 3], ['agua', 2 / 3]].forEach(function (c) {
    var com = solo(3, MISTA, plano(c[0], 100)), sem = solo(3, MISTA, plano(c[0], 100), true), f = primeiroDiferente(com, sem);
    assert.ok(f > 0, c[0] + ': difere em algum ponto');
    assert.ok(com.frames[f - 1].pos[0] >= c[1] * MISTA.distance - 1e-9, c[0] + ': igual até entrar no terço (frame ' + f + ', ' + com.frames[f - 1].pos[0] + ' m)');
    assert.ok(com.frames[f - 2].pos[0] < c[1] * MISTA.distance, c[0] + ': difere logo depois de entrar');
  });
  // depois do terço: o terço normal e o terço estendido até o fim correm iguais até o fim do terço normal
  ['fogo', 'grama'].forEach(function (e) {
    var z = G.TYPE_SKILLS[e].zone, normal = solo(5, MISTA, plano(e, 100)), longa;
    G.TYPE_SKILLS[e].zone = [z[0], 1];
    try { longa = solo(5, MISTA, plano(e, 100)); } finally { G.TYPE_SKILLS[e].zone = z; }
    var f = primeiroDiferente(normal, longa);
    assert.ok(f > 0, e + ': o terço estendido muda a corrida');
    assert.ok(normal.frames[f - 1].pos[0] >= z[1] * MISTA.distance - 1e-9, e + ': igual até o fim do terço (' + normal.frames[f - 1].pos[0] + ' m)');
  });
});
test('física linear até 150: com todos os status em 50/80/110/140, +10 em VEL, ACE, MAN, FOR, EST e GAR melhora o tempo médio', function () {
  // corrida solo (elemento desconhecido: sem clima e sem skill de tipo), pareada por seed e mapa. A Garra dispara
  // sempre (desde 2026-11-19 é a regra: sem sorteio), então cada ganho fica com intervalo de ±0,1 s.
  var SEIS = ['vel', 'acel', 'man', 'forca', 'est', 'garra'], N = 24, ganhos = {};
  {
    [50, 80, 110, 140].forEach(function (X) {
      var base = [], i;
      for (i = 0; i < N; i++) base.push(solo(S.hash2(41, i), S.randomConditions(S.hash2(41, i)), plano('neutro', X)).finishTimes[0]);
      SEIS.forEach(function (k) {
        var extra = {}, d = 0; extra[k] = X + 10;
        for (i = 0; i < N; i++) d += base[i] - solo(S.hash2(41, i), S.randomConditions(S.hash2(41, i)), plano('neutro', X, extra)).finishTimes[0];
        ganhos[X + ' ' + k] = d / N;
      });
    });
  }
  Object.keys(ganhos).forEach(function (q) { assert.ok(ganhos[q] > 0.15, '+10 em ' + q + ': ganho médio ' + ganhos[q].toFixed(3) + ' s'); });
});
test('determinismo: mesma seed e configuração, mesmo resultado; VERSION das skills com rank', function () {
  assert.strictEqual(S.VERSION, '4.1.0');
  var cfg = function () { return { seed: 77, recordFrames: true, racers: G.STARTERS.map(function (h, i) { var c = clone(h); c.level = 20; c.alloc = S.botAlloc(c); return { horse: c, name: 'r' + i }; }) }; };
  assert.strictEqual(JSON.stringify(S.simulate(cfg())), JSON.stringify(S.simulate(cfg())));
  assert.notStrictEqual(JSON.stringify(S.simulate(cfg()).finishTimes), JSON.stringify(S.simulate(Object.assign(cfg(), { seed: 78 })).finishTimes));
});

section('Poder, bots e ligas v3');
function refBot(el, rarity, level, g, grau) {
  var h = { id: 'ref', name: 'Ref', element: el, rarity: rarity, level: level, grau: grau || 2, potential: {}, skills: [] };
  G.STAT_KEYS.forEach(function (k) { h.potential[k] = g; });
  h.alloc = S.botAlloc(h); return h;
}
test('powerRating: mais pontos distribuídos dão mais Poder', function () {
  var h = refBot('agua', 'raro', 30, 16), sem = clone(h); sem.alloc = null;
  assert.ok(S.powerRating(h, null) > S.powerRating(sem, null), S.powerRating(h, null) + ' > ' + S.powerRating(sem, null));
  var meio = clone(h); meio.alloc = { vel: 5 };
  assert.ok(S.powerRating(meio, null) > S.powerRating(sem, null)); assert.ok(S.powerRating(h, null) > S.powerRating(meio, null));
});
test('ligas: seis faixas iguais entre o Comum nível 1 e o Lendário nível 50 de referência', function () {
  var lo = S.powerRating(refBot('fogo', 'comum', 1, 16), null), hi = S.powerRating(refBot('fogo', 'lendario', 50, 16), null);
  var L = G.LEAGUES;
  assert.deepStrictEqual(L.map(function (x) { return x.id; }), ['bronze', 'prata', 'ouro', 'platina', 'diamante', 'lenda']);
  assert.strictEqual(L[0].min, 0);
  for (var k = 1; k < 6; k++) assert.strictEqual(L[k].min, Math.round((lo + k * (hi - lo) / 6) / 10) * 10, L[k].id + ' (lo ' + lo + ', hi ' + hi + ')');
  assert.strictEqual(S.leagueFor(hi).id, 'lenda');
});
test('ligas: cada inicial de nível 1 começa na Bronze', function () {
  G.STARTERS.forEach(function (h) { assert.strictEqual(h.level, 1); assert.strictEqual(S.leagueFor(S.powerRating(h, null)).id, 'bronze', h.id); });
});

section('mapa');
test('mapa é determinístico e bem formado', function () {
  for (var seed = 1; seed <= 500; seed++) {
    var c = S.randomConditions(seed), d = S.randomConditions(seed);
    assert.deepStrictEqual(c, d);
    assert.ok(c.distance >= 1400 && c.distance <= 2000 && c.distance % 50 === 0, 'distância');
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
// Corredor de teste: Mítico nível 1 com genética 0 (todo status base = 60). Os valores de `over` viram o
// gancho de teste statAdd da entrada (testAdd, entregue por soma(h)) para fixar o status exato no nível 1
// (o equipamento não mexe mais nos status). Elemento 'neutro' (desconhecido desde a v3): sem clima e sem
// skill de tipo, para isolar o status.
function mk(over) { var h = clone(G.WILD_HORSES[0]); h.rarity = 'mitico'; h.level = 1; h.element = 'neutro'; h.skills = []; h.testAdd = {};
  G.STAT_KEYS.forEach(function (k) { h.potential[k] = 0; h.testAdd[k] = (over && k in over ? over[k] : 60) - 60; }); return h; }
function soma(h) { return h.testAdd || null; }
function race(seed, cond, horses) { return S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: horses.map(function (h, i) { return { horse: h, statAdd: soma(h), name: 'r' + i, isPlayer: i === 0 }; }) }); }
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
test('skill sem sorteio: Arranque ativa em 200 seeds de 200, no mítico nível 50 e no Comum nível 1 de Sorte 0', function () {
  var hi = mk({ sorte: 100 }); hi.level = 50; hi.skills = ['arranque']; var lo = mk({ sorte: 0 }); lo.rarity = 'comum'; lo.skills = ['arranque'];
  var a = 0, b = 0; for (var s = 0; s < 200; s++) { if (race(s, RETA, [hi, mk({})]).events.some(function (e) { return e.type === 'skill' && e.racer === 0; })) a++; if (race(s, RETA, [lo, mk({})]).events.some(function (e) { return e.type === 'skill' && e.racer === 0; })) b++; }
  assert.strictEqual(a, 200); assert.strictEqual(b, 200);
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
    var res = S.simulate({ seed: s, conditions: cond, recordFrames: true, racers: [h, mk({})].map(function (x, i) { return { horse: x, statAdd: soma(x), name: 'r' + i }; }) });
    var t600 = null; for (var f = 0; f < res.frames.length; f++) if (res.frames[f].pos[0] >= 600) { t600 = res.frames[f].t; break; }
    res.events.forEach(function (e) { if (e.type === 'skill' && e.racer === 0) assert.ok(e.t >= t600 - 0.1, 'seed ' + s + ': Sprint em t=' + e.t + ' antes de 600 m (t=' + t600 + ')'); });
    if (res.events.some(function (e) { return e.type === 'skill' && e.racer === 0 && e.t >= t600 - 0.1; })) fired++;
  }
  assert.ok(fired >= 15, 'Sprint disparou na reta final em só ' + fired + '/20 seeds');
});

section('tipo e pista v3');
var TIPOS = ['fogo', 'agua', 'grama'];
test('v3: três tipos sem bônus fixo e uma skill de tipo para cada', function () {
  assert.deepStrictEqual(Object.keys(G.ELEMENTS), TIPOS);
  TIPOS.forEach(function (e) { assert.ok(!('statBonus' in G.ELEMENTS[e]), e + ' sem statBonus'); });
  var TS = G.TYPE_SKILLS;
  assert.deepStrictEqual(Object.keys(TS).sort(), TIPOS.slice().sort());
  // bloco 1b: a skill de tipo multiplica os dois status do tipo no seu terço (statMul; spec §5)
  assert.strictEqual(TS.fogo.id, 'labareda'); assert.deepStrictEqual(TS.fogo.zone, [0, 1 / 3]); assert.deepStrictEqual(TS.fogo.effect, { statMul: 0.19 });
  assert.strictEqual(TS.grama.id, 'raizes-firmes'); assert.deepStrictEqual(TS.grama.zone, [1 / 3, 2 / 3]); assert.deepStrictEqual(TS.grama.effect, { statMul: 0.15 });
  assert.strictEqual(TS.agua.id, 'mare-alta'); assert.deepStrictEqual(TS.agua.zone, [2 / 3, 1]); assert.deepStrictEqual(TS.agua.effect, { statMul: 0.33 });
  TIPOS.forEach(function (e) { var t = TS[e]; assert.ok(t.name && t.short && t.short.length <= 12 && t.desc, e + ' nome, nome curto e descrição'); });
  assert.ok(/19%/.test(TS.fogo.desc) && /15%/.test(TS.grama.desc) && /33%/.test(TS.agua.desc), 'a descrição diz o %');
  ['labareda', 'mare-alta', 'raizes-firmes'].forEach(function (id) { assert.strictEqual(G.SKILLS[id], undefined, id + ' fora das skills de vaga'); });
  var T = S.TUNING;
  assert.deepStrictEqual([T.typeBase, T.typeLevel, T.typeRar, T.distMin, T.distMax, T.distStep, T.trackMaxShare, T.trackTries],
    [1, { fogo: -0.15, agua: 0, grama: 0.25 }, { fogo: 0.15, agua: 0.15, grama: 0.40 }, 1400, 2000, 50, 0.5, 60]);
});
test('v3: catálogo sem Pangaré e com Ventania de Grama', function () {
  var todos = G.STARTERS.concat(G.WILD_HORSES);
  assert.ok(!todos.some(function (h) { return h.id === 'w-pangare'; }), 'Pangaré saiu');
  assert.strictEqual(todos.filter(function (h) { return h.id === 'w-ventania'; })[0].element, 'grama');
  todos.forEach(function (h) { assert.ok(G.ELEMENTS[h.element], h.id + ' tipo ' + h.element); });
});
test('v3: força da skill de tipo (P = 1 + nívelT·(L − 1)/49 + raridadeT·ordem/4, por tipo)', function () {
  function P(e, r, L) { return S.typePower({ element: e, rarity: r, level: L }); }
  TIPOS.forEach(function (e) { assert.strictEqual(P(e, 'comum', 1), 1, e + ' Comum nível 1'); });
  // Fogo −0,15/0,15 · Água 0/0,15 · Grama 0,25/0,40
  assert.ok(Math.abs(P('fogo', 'raro', 30) - (1 - 0.15 * 29 / 49 + 0.15 * 2 / 4)) < 1e-9);
  assert.ok(Math.abs(P('agua', 'raro', 30) - 1.075) < 1e-9);
  assert.ok(Math.abs(P('grama', 'raro', 30) - (1 + 0.25 * 29 / 49 + 0.2)) < 1e-9);
  assert.deepStrictEqual(TIPOS.map(function (e) { return Math.round(P(e, 'mitico', 50) * 1e9) / 1e9; }), [1, 1.15, 1.65]);
  assert.ok(Math.abs(P('fogo', 'lendario', 50) - 0.9625) < 1e-9, 'o P do Fogo cai com o nível');
  assert.strictEqual(P('fogo', 'comum', 'x'), 1, 'nível malformado vale 1');
  assert.strictEqual(S.typePower({ rarity: 'mitico', level: 50 }), 1, 'sem elemento: só a base');
  var ts = S.typeSkill({ element: 'agua', rarity: 'lendario', level: 50 });
  assert.strictEqual(ts.id, 'mare-alta'); assert.strictEqual(ts.name, 'Maré Alta'); assert.ok(Math.abs(ts.power - 1.1125) < 1e-9); assert.deepStrictEqual(ts.zone, [2 / 3, 1]);
});
// campo dos três tipos com skills de gatilho garantido (largada, Dado, 80%) e o modo "skills sempre ativam"
function campoTipos() {
  return TIPOS.map(function (e) { var h = mk({ sorte: 40 }); h.element = e; h.level = 20; h.rarity = 'raro'; h.skills = ['arranque', 'dado-viciado', 'arrancada-final']; return h; });
}
function raceTipos(seed, cond, hs, semTipo) {
  return S.simulate({ seed: seed, conditions: cond, recordFrames: true, racers: hs.map(function (h, i) {
    var r = { horse: h, statAdd: soma(h), name: 'r' + i }; if (semTipo) r.noTypeSkill = true; return r;
  }) });
}
function porCorredor(res, filtro) {
  var out = [[], [], []]; res.events.forEach(function (e) { if (filtro(e)) out[e.racer].push(e.text); }); return out;
}
test('v3: skill de tipo sempre ativa no terço, sem consumir RNG', function () {
  for (var s = 1; s <= 12; s++) {
    var cond = S.randomConditions(s), D = cond.distance, hs = campoTipos();
    var com = raceTipos(s, cond, hs), sem = raceTipos(s, cond, hs, true);
    var sorteio = function (e) { return e.type === 'skill' && !e.typeSkill; };
    assert.deepStrictEqual(porCorredor(com, sorteio), porCorredor(sem, sorteio), 'seed ' + s + ': skills por sorteio');
    var dc = com.events.filter(function (e) { return e.type === 'dado'; }), ds = sem.events.filter(function (e) { return e.type === 'dado'; });
    assert.strictEqual(dc.length, 2);
    assert.deepStrictEqual(dc.map(function (d) { return [d.at, d.winner, d.rolls]; }), ds.map(function (d) { return [d.at, d.winner, d.rolls]; }), 'seed ' + s + ': Dados');
    assert.ok(!sem.events.some(function (e) { return e.typeSkill; }), 'noTypeSkill: nenhum evento de tipo');
    sem.racerInfo.forEach(function (ri) { assert.strictEqual(ri.typeSkill, null); });
    hs.forEach(function (h, i) {
      var tz = G.TYPE_SKILLS[h.element], ri = com.racerInfo[i].typeSkill;
      assert.deepStrictEqual(ri, { id: tz.id, name: tz.name, from: tz.zone[0] * D, to: tz.zone[1] * D });
      var evs = com.events.filter(function (e) { return e.typeSkill && e.racer === i; });
      assert.strictEqual(evs.length, 1, 'seed ' + s + ' corredor ' + i + ': 1 evento de tipo');
      assert.deepStrictEqual(Object.keys(evs[0]).sort(), ['racer', 't', 'text', 'type', 'typeSkill']);
      assert.strictEqual(evs[0].type, 'skill'); assert.ok(evs[0].text.indexOf(tz.name) >= 0, evs[0].text);
      // o evento sai no primeiro tick com o cavalo dentro do terço
      var f = Math.round(evs[0].t * 10);
      assert.ok(com.frames[f].pos[i] >= ri.from - 1e-9, 'evento dentro do terço');
      if (ri.from > 0) assert.ok(com.frames[f - 1].pos[i] < ri.from, 'evento na entrada do terço');
    });
  }
});
test('v3: skill de tipo com efeito nulo dá exatamente a mesma corrida (prova de que não mexe na RNG)', function () {
  var salvo = {};
  TIPOS.forEach(function (e) { salvo[e] = G.TYPE_SKILLS[e].effect; G.TYPE_SKILLS[e].effect = {}; });
  try {
    for (var s = 1; s <= 6; s++) {
      var cond = S.randomConditions(s), hs = campoTipos(), com = raceTipos(s, cond, hs), sem = raceTipos(s, cond, hs, true);
      com.events = com.events.filter(function (e) { return !e.typeSkill; });
      com.racerInfo.forEach(function (ri) { ri.typeSkill = null; });
      assert.strictEqual(JSON.stringify(com), JSON.stringify(sem), 'seed ' + s);
    }
  } finally { TIPOS.forEach(function (e) { G.TYPE_SKILLS[e].effect = salvo[e]; }); }
});
test('v3: cada skill de tipo ajuda o próprio cavalo no seu terço (média de 30 seeds, sozinho na pista)', function () {
  function solo(e, s, cond, semTipo) { var h = mk({}); h.element = e; return raceTipos(s, cond, [h], semTipo); }
  function tempoAte(res, x) { for (var f = 0; f < res.frames.length; f++) if (res.frames[f].pos[0] >= x) return res.frames[f].t; return Infinity; }
  var ladeira = { distance: 1500, surface: 'areia', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 500 }, { type: 'subida', from: 500, to: 1000 }, { type: 'reta', from: 1000, to: 1500 }] };
  var m = { lab: [0, 0], raiz: [0, 0], mare: [0, 0] };
  for (var s = 0; s < 30; s++) {
    [false, true].forEach(function (semTipo, q) {
      m.lab[q] += tempoAte(solo('fogo', s, RETA, semTipo), 100);                                  // Labareda: largada mais rápida
      var g = solo('grama', s, ladeira, semTipo); m.raiz[q] += tempoAte(g, 1000) - tempoAte(g, 500);   // Raízes Firmes: sobe melhor no meio
      m.mare[q] += solo('agua', s, RETA, semTipo).finishTimes[0];                              // Maré Alta: termina antes
    });
  }
  Object.keys(m).forEach(function (k) { assert.ok(m[k][0] < m[k][1], k + ': ' + m[k][0].toFixed(1) + ' com, ' + m[k][1].toFixed(1) + ' sem'); });
  // bloco 1b: a Maré Alta não recupera mais estamina ao entrar no último terço (multiplica Estamina e Garra)
  var mc = solo('agua', 3, RETA), fz = Math.round(mc.events.filter(function (e) { return e.typeSkill; })[0].t * 10);
  assert.ok(mc.frames[fz + 1].stamina[0] <= mc.frames[fz].stamina[0], 'sem recuperação na entrada');
});
test('v3: elemento desconhecido corre sem skill de tipo', function () {
  ['neutro', undefined, 'lava'].forEach(function (e) {
    var h = mk({}); h.element = e;
    assert.strictEqual(S.typeSkill(h), null, String(e));
    var res = race(4, RETA, [h, mk({})]);
    assert.strictEqual(res.finishOrder.length, 2); assert.ok(semNaN(res), String(e));
    res.racerInfo.forEach(function (ri) { assert.strictEqual(ri.typeSkill, null); });
    assert.ok(!res.events.some(function (ev) { return ev.typeSkill; }), String(e) + ': sem evento de tipo');
  });
});
test('raridade herdada do Object.prototype vale Comum (sem NaN em status e Poder)', function () {
  var base = cl(G.STARTERS[0]); base.rarity = 'comum';
  var ref = { stats: S.computeStats(base, null), pr: S.powerRating(base, null) };
  ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'].forEach(function (r) {
    var h = cl(base); h.rarity = r;
    var st = S.computeStats(h, null);
    G.STAT_KEYS.forEach(function (k) { assert.ok(isFinite(st[k]), r + ': ' + k + ' = ' + st[k]); });
    assert.deepStrictEqual(st, ref.stats, r + ': status');
    assert.strictEqual(S.powerRating(h, null), ref.pr, r + ': Poder');
    assert.ok(isFinite(S.allocInfo(h).room.vel), r + ': allocInfo');
    var ba = S.botAlloc(h);
    assert.ok(G.STAT_KEYS.every(function (k) { return isFinite(ba[k]); }), r + ': botAlloc');
    assert.doesNotThrow(function () { S.learnSkill({ element: 'fogo', rarity: r, skills: [] }, S.mulberry32(1)); }, r + ': learnSkill');
  });
});
test('tuningHash cobre a ordem das raridades (entra na força da skill de tipo)', function () {
  var h0 = S.tuningHash(), rr = G.RARITIES.raro, o = rr.order;
  rr.order = o + 1;
  try { assert.notStrictEqual(S.tuningHash(), h0, 'order'); } finally { rr.order = o; }
  assert.strictEqual(S.tuningHash(), h0);
});
test('v3: pista sem extremos', function () {
  for (var k = 0; k < 3000; k++) {
    var c = S.randomConditions(S.hash2(31, k)), tot = { reta: 0, curva: 0, subida: 0 };
    assert.ok(c.distance >= 1400 && c.distance <= 2000 && c.distance % 50 === 0);
    c.blocks.forEach(function (b) { tot[b.type] += b.to - b.from; });
    assert.ok(tot.curva > 0 && tot.subida > 0);
    ['reta', 'curva', 'subida'].forEach(function (t) { assert.ok(tot[t] <= c.distance / 2); });
    assert.strictEqual(c.blocks[0].type, 'reta'); assert.strictEqual(c.blocks[c.blocks.length - 1].type, 'reta');
  }
});
test('v3: as 13 distâncias saem do sorteio e, sem pista válida em 60 tentativas, entra o molde fixo', function () {
  var vistas = {};
  for (var k = 0; k < 2000; k++) vistas[S.randomConditions(k).distance] = 1;
  assert.strictEqual(Object.keys(vistas).length, 13);
  var old = S.TUNING.trackTries; S.TUNING.trackTries = 0;
  try {
    // o molde nas 13 distâncias: mesma regra da pista sem extremos (curva e subida, nenhum tipo > D/2)
    var moldes = {};
    for (var s = 0; s < 2000 && Object.keys(moldes).length < 13; s++) { var cs = S.randomConditions(s); moldes[cs.distance] = cs; }
    assert.strictEqual(Object.keys(moldes).length, 13);
    Object.keys(moldes).forEach(function (d) {
      var c = moldes[d], prev = 0, tot = { reta: 0, curva: 0, subida: 0 };
      assert.deepStrictEqual(c.blocks.map(function (b) { return b.type; }), ['reta', 'curva', 'reta', 'subida', 'reta']);
      c.blocks.forEach(function (b) { assert.strictEqual(b.from, prev); assert.ok(b.to > b.from && b.to % 10 === 0); prev = b.to; tot[b.type] += b.to - b.from; });
      assert.strictEqual(prev, c.distance);
      assert.ok(tot.curva > 0 && tot.subida > 0, d + ' m: curva e subida');
      ['reta', 'curva', 'subida'].forEach(function (t) { assert.ok(tot[t] <= c.distance / 2, d + ' m: ' + t + ' ' + tot[t]); });
    });
  } finally { S.TUNING.trackTries = old; }
});
test('v3: distância explícita antiga continua aceita', function () {
  var rnd = S.randomConditions(7);
  [1000, 2400].forEach(function (d) {
    assert.strictEqual(S.normalizeConditions({ distance: d }, 7).distance, d);
    var res = race(7, { distance: d }, campo2());
    assert.strictEqual(res.conditions.distance, d); assert.ok(semNaN(res), String(d));
  });
  [900, 2500].forEach(function (d) { assert.strictEqual(S.normalizeConditions({ distance: d }, 7).distance, rnd.distance, String(d)); });
});
test('v3: nenhuma skill é exclusiva e as gerais servem a qualquer tipo', function () {
  var gerais = Object.keys(G.SKILLS).filter(function (id) { return G.SKILLS[id].element === 'geral'; });
  assert.deepStrictEqual(gerais, ['arranque', 'sprint', 'drift', 'saida-rapida', 'folego-de-montanha', 'segundo-ar', 'arrancada-final', 'dado-viciado']);
  Object.keys(G.SKILLS).forEach(function (id) {
    var sk = G.SKILLS[id];
    assert.ok(!('exclusive' in sk), id + ' sem exclusive');
    assert.ok(sk.element === 'geral' || TIPOS.indexOf(sk.element) >= 0, id + ' elemento ' + sk.element);
  });
  TIPOS.forEach(function (e) {
    var m = { id: 'brasa', element: e, rarity: 'mitico', skills: [] }, seen = {};
    for (var i = 0; i < 600; i++) { var id = S.learnSkill(m, S.mulberry32(i)); if (id) seen[id] = 1; }
    Object.keys(seen).forEach(function (id) { assert.ok(G.SKILLS[id].element === 'geral' || G.SKILLS[id].element === e, e + ' aprendeu ' + id); });
    assert.ok(Object.keys(seen).some(function (id) { return G.SKILLS[id].element === 'geral'; }), e + ': aprende geral');
    assert.ok(Object.keys(seen).some(function (id) { return G.SKILLS[id].element === e; }), e + ': aprende do tipo');
  });
});

section('dado');
test('rollDice: sorte 0 = 1 dado em 1..100; sorte 100 = 2 dados; média do melhor sobe', function () {
  var rng = S.mulberry32(9), sum0 = 0, sum100 = 0;
  for (var i = 0; i < 5000; i++) { var a = S.rollDice(rng, 0, 0); assert.strictEqual(a.dice.length, 1); assert.ok(a.best >= 1 && a.best <= 100); sum0 += a.best; }
  for (i = 0; i < 5000; i++) { var b = S.rollDice(rng, 100, 0); assert.strictEqual(b.dice.length, 2); sum100 += b.best; }
  assert.ok(sum0 / 5000 > 48 && sum0 / 5000 < 53); assert.ok(sum100 / 5000 > 64 && sum100 / 5000 < 70);
});
test('rollDice limita: sorte 250 → 2 dados; extraDice 5 → no máximo 2 extras (4 dados); o dado extra respeita o teto', function () {
  var r = S.rollDice(S.mulberry32(1), 250, 5); assert.strictEqual(r.dice.length, 4);
  assert.strictEqual(S.rollDice(S.mulberry32(1), 0, 1).dice.length, 2);
  var rng = S.mulberry32(9), max = 0;
  for (var i = 0; i < 4000; i++) { var d = S.rollDice(rng, 0, 1, 70).dice; assert.ok(d[1] >= 1 && d[1] <= 70, 'extra ' + d[1]); max = Math.max(max, d[1]); }
  assert.strictEqual(max, 70, 'o teto é alcançado');
  // teto ausente ou inválido vale 100; o 1º dado nunca muda com o teto
  [undefined, 0, 101, NaN, '60'].forEach(function (t) { assert.deepStrictEqual(S.rollDice(S.mulberry32(5), 0, 1, t), S.rollDice(S.mulberry32(5), 0, 1, 100), String(t)); });
  assert.strictEqual(S.rollDice(S.mulberry32(5), 0, 1, 60).dice[0], S.rollDice(S.mulberry32(5), 0, 1, 100).dice[0]);
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
  assert.deepStrictEqual(['comum','magico','raro','lendario','mitico'].map(function (r) { return G.RARITIES[r].baseLo; }), [40, 44, 49, 54, 60]);
  assert.deepStrictEqual(['comum','magico','raro','lendario','mitico'].map(function (r) { return G.RARITIES[r].ptsMult; }), [1, 1.05, 1.1, 1.15, 1.2]);
  Object.keys(G.RARITIES).forEach(function (r) { assert.strictEqual(G.RARITIES[r].growth, undefined, r + ' sem growth'); });
  G.STARTERS.concat(G.WILD_HORSES).forEach(function (h) { assert.ok(h.grau >= 1 && h.grau <= 3, h.id + ' grau'); });
  assert.strictEqual(G.STARTERS[0].grau, 2); assert.strictEqual(G.WILD_HORSES.filter(function (h) { return h.id === 'w-boitata'; })[0].grau, 3);
});
test('nomes de potro e economia do cruzamento', function () {
  assert.ok(G.FOAL_NAMES.length >= 30); G.FOAL_NAMES.forEach(function (n) { assert.ok(n.length >= 2 && n.length <= 12, n); });
  var B = G.ECONOMY.breeding;
  assert.deepStrictEqual(B.rentalBase, { comum: 100, magico: 250, raro: 600, lendario: 1500 });
  assert.deepStrictEqual(B.grauMult, [1, 1.25, 1.5]); assert.strictEqual(B.stableSlotsStart, 2); assert.strictEqual(B.stableSlotsMax, 5); assert.strictEqual(B.stableSlotsLegado, 8);
  assert.deepStrictEqual(B.stableSlotPrices, [2000, 10000, 50000]);   // D1
  assert.strictEqual(B.levelSaturation, 30); assert.strictEqual(B.mareWeight, 0.6); assert.deepStrictEqual(G.BREED_LEFT, { m: 2, f: 1 });
});

section('cruzamento');
function mk2(o) { return { uid: o.uid || 'x', name: o.name || 'X', element: o.element || 'fogo', rarity: o.rarity || 'raro', grau: o.grau || 2, sex: o.sex || 'm', level: o.level == null ? 30 : o.level,
  skills: o.skills || [], potential: o.potential || { vel: 10, acel: 10, man: 10, forca: 10, est: 10, garra: 10, sorte: 0 },   // Sorte 0: as tabelas sem o efeito da D8
  palette: o.palette || { coat: '#c4471d', coatShade: '#7f2a0e', mane: '#ffb02e', accent: '#ffe066' } }; }
// D8: roda fn com o efeito da Sorte na cruza desligado (sortePP 0), para os testes gravados antes dele provarem que,
// sem esse efeito, o breed.js sorteia igual (mesmas chamadas da rng, na mesma ordem)
function semSortePP(fn) { return function () { var E = G.ECONOMY.breeding, pp = E.sortePP; E.sortePP = 0; try { fn(); } finally { E.sortePP = pp; } }; }
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
// D8 (spec 2026-11-26-d8-sorte): a genética de Sorte dos pais move até sortePP p.p. de "1 abaixo"/"desce" para
// "1 acima"/"sobe", pela mesma rng (1 chamada em rollRarity e em rollGrau); Mítico nunca nasce.
function comSorte(o, g) { var h = mk2(o); h.potential = Object.assign({}, h.potential, { sorte: g }); return h; }
test('D8: sorteOf e sorteFactor (genética/31, égua 60%; ausente ou lixo vale 0)', function () {
  near(B.sorteOf(comSorte({}, 31)), 1, 1e-12, '31'); near(B.sorteOf(comSorte({}, 15.5)), 0.5, 1e-12, 'meio');
  assert.strictEqual(B.sorteOf({}), 0); assert.strictEqual(B.sorteOf({ potential: { sorte: 'x' } }), 0); assert.strictEqual(B.sorteOf(comSorte({}, 99)), 1);
  near(B.sorteFactor(comSorte({ sex: 'f' }, 31), comSorte({}, 0)), 0.6, 1e-12, 'só a égua');
  near(B.sorteFactor(comSorte({ sex: 'f' }, 0), comSorte({}, 31)), 0.4, 1e-12, 'só o garanhão');
});
test('D8: Sorte máxima — Raro × Raro nv 30 vira Mágico 25 / Raro 65 / Lendário 10; estrelas 5 / 50 / 45; Comum nv 1 ganha 5 p.p.', function () {
  var o = B.rarityOdds(comSorte({ sex: 'f' }, 31), comSorte({}, 31));
  near(o.magico, 0.25, 1e-9, 'magico'); near(o.raro, 0.65, 1e-9, 'raro'); near(o.lendario, 0.10, 1e-9, 'lendario'); assert.strictEqual(o.mitico, 0);
  var g = B.grauOdds(comSorte({ sex: 'f' }, 31), comSorte({}, 31));
  near(g[1], 0.05, 1e-9, 'desce'); near(g[2], 0.50, 1e-9, 'mantém'); near(g[3], 0.45, 1e-9, 'sobe');
  var c0 = B.rarityOdds(mk2({ sex: 'f', rarity: 'comum', level: 1 }), mk2({ rarity: 'comum', level: 1 }));
  var c1 = B.rarityOdds(comSorte({ sex: 'f', rarity: 'comum', level: 1 }, 31), comSorte({ rarity: 'comum', level: 1 }, 31));
  near(c1.magico - c0.magico, 0.05, 1e-9, 'Comum × Comum: +5 p.p. de Mágico');
  var meio = B.rarityOdds(comSorte({ sex: 'f' }, 31), comSorte({}, 0));
  near(meio.lendario, 0.05 + 0.03, 1e-9, 's = 0,6 → +3 p.p.');
  assert.strictEqual(B.odds(comSorte({ sex: 'f' }, 31), comSorte({}, 31)).sorte, 1);
});
test('D8: com Sorte as chances somam 100%, nunca dão Mítico e o rollRarity/rollGrau seguem com 1 chamada da rng', function () {
  ['comum', 'magico', 'raro', 'lendario'].forEach(function (ra) {
    ['comum', 'raro', 'lendario'].forEach(function (rb) {
      [0, 1, 30].forEach(function (lv) {
        var a = comSorte({ sex: 'f', rarity: ra, level: lv, grau: 1 }, 31), b = comSorte({ rarity: rb, level: lv, grau: 3 }, 31);
        var o = B.rarityOdds(a, b), g = B.grauOdds(a, b), so = 0, sg = 0;
        Object.keys(o).forEach(function (k) { assert.ok(o[k] >= 0, k); so += o[k]; }); [1, 2, 3].forEach(function (k) { assert.ok(g[k] >= 0); sg += g[k]; });
        near(so, 1, 1e-9, ra + '×' + rb + ' raridade'); near(sg, 1, 1e-9, ra + '×' + rb + ' estrelas'); assert.strictEqual(o.mitico, 0);
        var n = 0, base = S.mulberry32(lv + 5), rng = function () { n++; return base(); };
        B.rollRarity(rng, a, b); assert.strictEqual(n, 1, 'rollRarity'); B.rollGrau(rng, a, b, 0); assert.strictEqual(n, 2, 'rollGrau');
      });
    });
  });
  var rng = S.mulberry32(779), n = { comum: 0, magico: 0, raro: 0, lendario: 0, mitico: 0 };
  for (var i = 0; i < 20000; i++) n[B.rollRarity(rng, comSorte({ sex: 'f' }, 31), comSorte({}, 31))]++;
  near(n.magico / 200, 25, 2, 'magico %'); near(n.lendario / 200, 10, 1, 'lendario %'); assert.strictEqual(n.mitico, 0);
});
test('D8: o Dado Viciado não soma Poder (peso do gatilho dice 0)', function () {
  assert.strictEqual(S.SKILL_TRIGGER_WEIGHT.dice, 0); assert.strictEqual(S.skillWeight('dado-viciado'), 0);
  var h = mk2({ skills: ['sprint'] }), d = mk2({ skills: ['sprint', 'dado-viciado'] }); d.skillRanks = { 'dado-viciado': 5 };
  assert.strictEqual(S.powerRating(d), S.powerRating(h));
});
test('D1: precoVaga — 2 vagas → 2.000, 3 → 10.000, 4 → 50.000; 5 ou mais (saves antigos até 8) e lixo → null', function () {
  assert.strictEqual(B.precoVaga(2), 2000); assert.strictEqual(B.precoVaga(3), 10000); assert.strictEqual(B.precoVaga(4), 50000);
  [5, 6, 8, 9, 2.5, NaN, 'x', null, undefined, Infinity].forEach(function (v) { assert.strictEqual(B.precoVaga(v), null, String(v)); });
  assert.strictEqual(B.precoVaga(1), 2000, 'abaixo do início (não acontece no jogo) paga a primeira');
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
  assert.deepStrictEqual(a.parents, { f: { uid: 'm1', name: 'Maré' }, m: { uid: 'm2', name: 'Brasa' } }); assert.strictEqual(a.born, 0); assert.ok(!('gestacao' in a), 'sem o campo gestacao');
  assert.ok(G.FOAL_NAMES.indexOf(a.name) >= 0); assert.ok(/^#[0-9a-f]{6}$/.test(a.palette.coat));
  assert.notStrictEqual(JSON.stringify(a), JSON.stringify(B.foal({ f: f, m: m, seedBase: 123, breedCounter: 1, nextUid: 3 })));
});
test('potro v3: sem base nem alloc, genética inteira de 0 a 31, tipo dos pais, skills dentro das vagas', function () {
  for (var s = 0; s < 2000; s++) {
    var f = mk2({ sex: 'f', skills: ['chama-final', 'sprint'], element: 'fogo' }), m = mk2({ skills: ['pe-na-chuva', 'drift'], element: 'agua' });
    var c = B.foal({ f: f, m: m, seedBase: s, breedCounter: 0, nextUid: 1 });
    assert.ok(!('base' in c), 'sem base'); assert.ok(!('alloc' in c), 'nasce sem alloc');
    assert.ok(c.element === 'fogo' || c.element === 'agua', 'tipo de um dos pais: ' + c.element);
    G.STAT_KEYS.forEach(function (k) { var p = c.potential[k]; assert.ok(p >= 0 && p <= 31 && p === Math.floor(p), 'pot ' + k + ' = ' + p); });
    var R = G.RARITIES[c.rarity]; assert.ok(c.skills.length <= R.skillSlots && c.skills.length >= Math.min(R.bornSkills, R.skillSlots), 'skills ' + c.skills.join());
    c.skills.forEach(function (id) { var sk = G.SKILLS[id]; assert.ok(sk, 'existe ' + id); assert.ok(sk.element === 'geral' || sk.element === c.element, 'elemento ' + id); });
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
test('potro v3: genética 50% herdada, senão uniforme de 0 a 31, sem piso por estrela', function () {
  // pais com genética 0 e ★★★: sem piso, P(0) = 0,5 + 0,5/32 e a média dos sorteados é 15,5
  var z = { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 }, zeros = 0, soma = 0, n = 0, N = 5000;
  for (var s = 0; s < N; s++) {
    var c = B.foal({ f: mk2({ sex: 'f', grau: 3, potential: z }), m: mk2({ grau: 3, potential: z }), seedBase: 41, breedCounter: s, nextUid: 1 });
    G.STAT_KEYS.forEach(function (k) { n++; soma += c.potential[k]; if (c.potential[k] === 0) zeros++; });
  }
  near(zeros / n, 0.5 + 0.5 / 32, 0.01, 'genética 0'); near(soma / n, 0.5 * 15.5, 0.25, 'média');
  // pais diferentes: o herdado vem de um dos dois, 50/50
  var a = { vel: 31, acel: 31, man: 31, forca: 31, est: 31, garra: 31, sorte: 31 }, de31 = 0, de0 = 0;
  for (s = 0; s < N; s++) {
    var d = B.foal({ f: mk2({ sex: 'f', potential: a }), m: mk2({ potential: z }), seedBase: 43, breedCounter: s, nextUid: 1 });
    G.STAT_KEYS.forEach(function (k) { if (d.potential[k] === 31) de31++; if (d.potential[k] === 0) de0++; });
  }
  near(de31 / n, 0.25 + 0.5 / 32, 0.01, 'herda da égua'); near(de0 / n, 0.25 + 0.5 / 32, 0.01, 'herda do garanhão');
});
test('Mítico nunca nasce de cruzamento (5.000 cruzas de Míticos)', function () {
  for (var s = 0; s < 5000; s++) {
    var c = B.foal({ f: mk2({ sex: 'f', rarity: 'mitico', level: 50, grau: 3 }), m: mk2({ rarity: 'mitico', level: 50, grau: 3 }), seedBase: 47, breedCounter: s, nextUid: 1 });
    assert.notStrictEqual(c.rarity, 'mitico');
  }
  assert.strictEqual(B.GRAU_POT_FLOOR, undefined, 'sem piso de genética'); assert.strictEqual(B.GRAU_WINDOW, undefined, 'sem janela de status base');
});
test('uid distinto mesmo com nomes iguais', function () {
  var saved = G.FOAL_NAMES; G.FOAL_NAMES = ['Xodó'];
  var a = B.foal({ f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 1, breedCounter: 0, nextUid: 5 }), b = B.foal({ f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 1, breedCounter: 1, nextUid: 6 });
  G.FOAL_NAMES = saved; assert.strictEqual(a.name, b.name); assert.notStrictEqual(a.uid, b.uid);
});

test('snapshot dourado dos potros de exemplos.md (sem o efeito da Sorte)', semSortePP(function () {
  // docs/exemplos.md §4 "Três potros de exemplo": seedBase 20261106, nextUid 2, breedCounter 0/1/2.
  // Regravado no modelo v3 da Tarefa 3: sem status base sorteado nem piso de genética por estrela
  // (a ordem das chamadas de rng mudou); o exemplos.md acompanha na tarefa da documentação.
  // Compara o potro INTEIRO (inclusive a paleta, passo 8 da RNG): qualquer chamada de rng a mais,
  // a menos ou fora de ordem em breed.js muda algum campo e derruba este teste.
  function par(id, level, uid) {
    var h = JSON.parse(JSON.stringify(G.STARTERS.concat(G.WILD_HORSES).filter(function (x) { return x.id === id; })[0]));
    h.level = level; h.uid = uid; return h;
  }
  function st(a) { var o = {}; G.STAT_KEYS.forEach(function (k, i) { o[k] = a[i]; }); return o; }
  var casos = [
    { f: par('mare', 30, null), m: par('brasa', 30, null), name: 'Jurema', rarity: 'comum', grau: 2, element: 'fogo', sex: 'f',
      potential: [20, 26, 14, 21, 24, 14, 12], stats: [50, 53, 47, 51, 52, 47, 46], skills: ['sol-a-pino'],
      palette: { coat: '#b27261', coatShade: '#734940', mane: '#b7c284', accent: '#f4e9a9' }, breedLeft: 1 },
    { f: par('w-faisca', 1, null), m: par('w-lambari', 1, null), name: 'Jurema', rarity: 'comum', grau: 2, element: 'agua', sex: 'f',
      potential: [8, 11, 25, 10, 8, 5, 10], stats: [44, 46, 53, 45, 44, 43, 45], skills: ['arranque'],
      palette: { coat: '#9b9895', coatShade: '#66696d', mane: '#ede9d8', accent: '#90b1a9' }, breedLeft: 1 },
    { f: par('w-ventania', 30, null), m: par('w-jequitiba', 30, null), name: 'Trovão', rarity: 'lendario', grau: 1, element: 'grama', sex: 'm',
      potential: [19, 18, 20, 13, 28, 25, 16], stats: [64, 63, 64, 61, 68, 67, 62], skills: ['sprint', 'arrancada-final'],   // bloco 1b: baseLo do Lendário 55 → 54
      palette: { coat: '#8e7d68', coatShade: '#65584b', mane: '#4a7c4c', accent: '#90c88c' }, breedLeft: 2 }
  ];
  casos.forEach(function (c, i) {
    var x = B.foal({ f: c.f, m: c.m, seedBase: 20261106, breedCounter: i, nextUid: 2 });
    // `marcas` usa sequência própria (spec 2a §2) e é conferida na seção "Marcas"; aqui só se confirma que existe e é válida
    assert.ok(B.marcasValidas(x.marcas), 'marcas do potro ' + i); delete x.marcas;
    // `porte` também tem fluxo próprio (spec 2b §3), conferido na seção "Portes"
    assert.ok(B.porteValido(x.porte), 'porte do potro ' + i); delete x.porte;
    // rank das skills (2026-11-19): os pais do exemplo não têm rank, então todas nascem no rank 1 (sem chamada de rng)
    var rk1 = {}; x.skills.forEach(function (id) { rk1[id] = 1; }); assert.deepStrictEqual(x.skillRanks, rk1, 'ranks do potro ' + i); delete x.skillRanks;
    assert.deepStrictEqual(x, {
      uid: 'm2', templateId: null, name: c.name, especie: 'cavalo', element: c.element, rarity: c.rarity, grau: c.grau, sex: c.sex,
      level: 1, xp: 0, skills: c.skills, potential: st(c.potential), palette: c.palette, breedLeft: c.breedLeft,
      parents: { f: { uid: null, name: c.f.name }, m: { uid: null, name: c.m.name } },
      born: i
    }, 'potro ' + i);
    assert.deepStrictEqual(S.computeStats(x, null), st(c.stats), 'status do potro ' + i + ' no nível 1');
  });
}));
test('potro herda o rank do pai menos 1 (mínimo 1; o maior, se os dois têm); a skill sorteada nasce no rank 1', function () {
  var viu = { herdou3: 0, herdou4: 0, sorteada: 0, piso: 0 };
  for (var s = 0; s < 400; s++) {
    var f = mk2({ sex: 'f', skills: ['sprint', 'drift'] }), m = mk2({ skills: ['sprint', 'arranque'] });
    f.skillRanks = { sprint: 2, drift: 1 }; m.skillRanks = { sprint: 5, arranque: 4 };
    var c = B.foal({ f: f, m: m, seedBase: 31, breedCounter: s, nextUid: 1 });
    assert.deepStrictEqual(Object.keys(c.skillRanks).sort(), c.skills.slice().sort(), 'um rank por skill do potro');
    c.skills.forEach(function (id) {
      // herdada: Sprint 2 e 5 → 4; Arranque 4 → 3; Drift 1 → 1. Sorteada para completar o mínimo (até uma que um
      // dos pais tem, mas o potro não herdou): 1
      var herdada = id === 'sprint' ? 4 : id === 'arranque' ? 3 : 1, rk = c.skillRanks[id];
      assert.ok(rk === herdada || rk === 1, 'seed ' + s + ' ' + id + ': ' + rk);
      if (rk === 4) viu.herdou4++; else if (rk === 3) viu.herdou3++; else if (id === 'drift') viu.piso++; else viu.sorteada++;
    });
  }
  assert.ok(viu.herdou4 > 20 && viu.herdou3 > 20 && viu.piso > 20 && viu.sorteada > 20, JSON.stringify(viu));
  // pai sem skillRanks (save antigo) ou com rank inválido: vale 1, e o potro nasce no 1
  var c2 = B.foal({ f: mk2({ sex: 'f', skills: ['sprint'] }), m: Object.assign(mk2({ skills: ['sprint'] }), { skillRanks: { sprint: 9 } }), seedBase: 31, breedCounter: 2, nextUid: 1 });
  c2.skills.forEach(function (id) { assert.strictEqual(c2.skillRanks[id], 1); });
});
test('o rank herdado não consome a RNG: 400 potros saem iguais aos de antes da mudança (tirando o skillRanks; sem o efeito da Sorte)', semSortePP(function () {
  var els = ['fogo', 'agua', 'grama'], rars = ['comum', 'magico', 'raro', 'lendario'], ids = Object.keys(G.SKILLS), acc = [];
  for (var s = 0; s < 400; s++) {
    var mk = function (sex, q) { return { uid: sex + s, name: sex, element: els[(s + q) % 3], rarity: rars[(s >> q) % 4], grau: 1 + (s + q) % 3, sex: sex, level: 5 + (s * 7 + q) % 45,
      skills: ids.filter(function (id, i) { return (i + s + q * 3) % 5 === 0; }).slice(0, 3), skillRanks: { sprint: 4, drift: 5, arranque: 2 },
      potential: { vel: s % 32, acel: 10, man: 10, forca: 10, est: 10, garra: 10, sorte: 10 }, palette: { coat: '#c4471d', coatShade: '#7f2a0e', mane: '#ffb02e', accent: '#ffe066' } }; };
    var c = B.foal({ f: mk('f', 0), m: mk('m', 1), seedBase: 777 + s, breedCounter: s % 9, nextUid: 5 });
    assert.ok(c.skillRanks && typeof c.skillRanks === 'object');
    delete c.skillRanks; acc.push(c);
  }
  // impressão digital gravada com o breed.js de antes das skills com rank (commit 92a58fb), pelos mesmos pais e seeds
  assert.strictEqual(crypto.createHash('sha1').update(JSON.stringify(acc)).digest('hex'), 'e5a1fa4e3b614f3c5a37f0739d7c71ba4c48cc3e');
}));

section('Marcas');
function marcasPai(o, m) { var p = mk2(o); p.marcas = m; return p; }
test('foal: mesma seed e pais ⇒ mesmas marcas; valores válidos', function () {
  var f = marcasPai({ sex: 'f' }, { cara: 'estrela', patas: 2, corpo: 'malhado' }), m = marcasPai({}, { cara: 'listra', patas: 4, corpo: 'ruao' });
  for (var s = 0; s < 200; s++) {
    var a = B.foal({ f: f, m: m, seedBase: 91, breedCounter: s, nextUid: 1 }), b = B.foal({ f: f, m: m, seedBase: 91, breedCounter: s, nextUid: 1 });
    assert.deepStrictEqual(a.marcas, b.marcas); assert.ok(B.marcasValidas(a.marcas), JSON.stringify(a.marcas));
  }
});
test('foal: campos antigos iguais ao potro de antes (sorteios antigos intactos)', function () {
  // o snapshot dourado acima compara o potro inteiro, exceto `marcas`; aqui, marcas diferentes nos pais não mudam nenhum outro campo
  var base = { f: mk2({ sex: 'f' }), m: mk2({}), seedBase: 5, nextUid: 3 };
  for (var s = 0; s < 100; s++) {
    var sem = B.foal({ f: marcasPai({ sex: 'f' }, { cara: 'nenhuma', patas: 0, corpo: 'liso' }), m: marcasPai({}, { cara: 'frente', patas: 4, corpo: 'pintado' }), seedBase: 5, breedCounter: s, nextUid: 3 });
    var com = B.foal({ f: marcasPai({ sex: 'f' }, { cara: 'estrela', patas: 2, corpo: 'ruao' }), m: marcasPai({}, { cara: 'listra', patas: 1, corpo: 'malhado' }), seedBase: 5, breedCounter: s, nextUid: 3 });
    delete sem.marcas; delete com.marcas; assert.deepStrictEqual(sem, com);
  }
});
test('foal: 10.000 potros de pais com marcas diferentes ⇒ mutação por gene em [8,5%; 11,5%] e, sem mutação, égua em [47%; 53%]', function () {
  var f = marcasPai({ sex: 'f' }, { cara: 'nenhuma', patas: 0, corpo: 'liso' }), m = marcasPai({}, { cara: 'estrela', patas: 1, corpo: 'malhado' });
  var N = 10000, mut = { cara: 0, patas: 0, corpo: 0 }, deF = 0, semMut = 0, k;
  var fora = { cara: 2 / 4, patas: 3 / 5, corpo: 2 / 4 }; // fração dos valores que nenhum pai tem
  for (var s = 0; s < N; s++) {
    var c = B.foal({ f: f, m: m, seedBase: 77, breedCounter: s, nextUid: 1 }).marcas;
    ['cara', 'patas', 'corpo'].forEach(function (g) {
      if (c[g] !== f.marcas[g] && c[g] !== m.marcas[g]) mut[g]++;
    });
  }
  // fração observada de "valor de fora" = mutação × fração fora; mutação = observada / fora
  ['cara', 'patas', 'corpo'].forEach(function (g) {
    var taxa = mut[g] / N / fora[g]; assert.ok(taxa >= 0.085 && taxa <= 0.115, g + ' mutação ' + taxa);
  });
  // sem mutação: genes distintos nos pais; conta os que bateram com a égua entre os que bateram com algum pai
  // (mutação que cai por acaso num valor dos pais é rara e entra igual nos dois lados)
  for (s = 0; s < N; s++) {
    var d = B.foal({ f: f, m: m, seedBase: 78, breedCounter: s, nextUid: 1 }).marcas;
    ['cara', 'patas', 'corpo'].forEach(function (g) {
      if (d[g] === f.marcas[g]) { deF++; semMut++; } else if (d[g] === m.marcas[g]) semMut++;
    });
  }
  var pF = deF / semMut; assert.ok(pF >= 0.47 && pF <= 0.53, 'égua ' + pF);
});
test('foal: pai sem marcas usa as do modelo ou marcasDoId(uid)', function () {
  var modelo = G.WILD_HORSES.filter(function (x) { return x.id === 'w-ventania'; })[0];
  var comModelo = mk2({ uid: 'm9', sex: 'f' }); comModelo.templateId = 'w-ventania';
  var semNada = mk2({ uid: 'm7' });
  var ref = marcasPai({ sex: 'f' }, modelo.marcas), ref2 = marcasPai({ uid: 'm7' }, B.marcasDoId('m7'));
  for (var s = 0; s < 100; s++) {
    var a = B.foal({ f: comModelo, m: semNada, seedBase: 3, breedCounter: s, nextUid: 1 }), b = B.foal({ f: ref, m: ref2, seedBase: 3, breedCounter: s, nextUid: 1 });
    assert.deepStrictEqual(a.marcas, b.marcas);
  }
  var inval = mk2({ uid: 'm7', marcas: { cara: 'xx', patas: 9, corpo: 'liso' } });
  assert.deepStrictEqual(B.foal({ f: semNada, m: inval, seedBase: 3, breedCounter: 1, nextUid: 1 }).marcas, B.foal({ f: semNada, m: semNada, seedBase: 3, breedCounter: 1, nextUid: 1 }).marcas);
});
test('marcasDoId: determinístico, válido e cobre todos os valores em 1.000 chaves', function () {
  var vistos = {};
  for (var i = 0; i < 1000; i++) {
    var a = B.marcasDoId('m' + i); assert.deepStrictEqual(a, B.marcasDoId('m' + i)); assert.ok(B.marcasValidas(a));
    vistos['c' + a.cara] = vistos['p' + a.patas] = vistos['o' + a.corpo] = 1; vistos['p' + a.patas] = 1; vistos['c' + a.cara] = 1;
  }
  G.MARCAS.cara.forEach(function (v) { assert.ok(vistos['c' + v], v); });
  G.MARCAS.patas.forEach(function (v) { assert.ok(vistos['p' + v], 'patas ' + v); });
  G.MARCAS.corpo.forEach(function (v) { assert.ok(vistos['o' + v], v); });
  assert.ok(!B.marcasValidas({ cara: 'nenhuma', patas: '2', corpo: 'liso' }) && !B.marcasValidas(null) && !B.marcasValidas({}));
});
test('hashChave("") e hashChave("m1") conhecidos (FNV-1a 32 bits)', function () {
  assert.strictEqual(B.hashChave(''), 0x811c9dc5);
  assert.strictEqual(B.hashChave('a'), 0xe40c292c); // vetor de teste FNV-1a 32 bits
  assert.strictEqual(B.hashChave('m1'), 0x942e6feb);
});
test('MARCAS e JOQUEI no catálogo', function () {
  assert.deepStrictEqual(G.MARCAS, { cara: ['nenhuma', 'estrela', 'listra', 'frente'], patas: [0, 1, 2, 3, 4], corpo: ['liso', 'malhado', 'pintado', 'ruao'], mutacao: 0.10, branco: '#f1e9d4' });
  assert.strictEqual(G.JOQUEI.padroes.length, 6); assert.strictEqual(G.JOQUEI.capacetes.length, 8);
  assert.strictEqual(G.JOQUEI.padrao, 'liso'); assert.strictEqual(G.JOQUEI.capacete, '#f2c230');
});
test('iniciais e selvagens com as marcas da tabela da spec §2', function () {
  var T = { brasa: 'estrela/1/liso', mare: 'listra/0/ruao', ipe: 'frente/2/liso', 'w-faisca': 'estrela/2/pintado', 'w-lambari': 'nenhuma/0/malhado',
    'w-capim': 'listra/4/liso', 'w-ticao': 'frente/1/liso', 'w-garoa': 'estrela/0/ruao', 'w-mandacaru': 'nenhuma/3/pintado', 'w-ventania': 'listra/2/malhado',
    'w-pororoca': 'estrela/4/liso', 'w-fogareu': 'frente/0/pintado', 'w-jequitiba': 'listra/1/ruao', 'w-boitata': 'estrela/2/malhado', 'w-iara': 'nenhuma/4/ruao' };
  var todos = G.STARTERS.concat(G.WILD_HORSES); assert.strictEqual(todos.length, 15);
  todos.forEach(function (h) {
    assert.strictEqual(typeof h.marcas.patas, 'number', h.id);
    assert.strictEqual(h.marcas.cara + '/' + h.marcas.patas + '/' + h.marcas.corpo, T[h.id], h.id); assert.ok(B.marcasValidas(h.marcas));
  });
});

section('Portes');
// Impressão dos 200 potros de antes do porte (HEAD da parte 2a): com o campo `porte` apagado, os sorteios antigos têm de dar o mesmo número.
var IMPRESSAO_FOAL_2A = 1583205096;
test('portes: catálogo', function () {
  var T = { brasa: 'padrao', mare: 'padrao', ipe: 'padrao', 'w-faisca': 'esguio', 'w-ticao': 'robusto', 'w-fogareu': 'robusto', 'w-boitata': 'esguio',
    'w-lambari': 'esguio', 'w-garoa': 'padrao', 'w-pororoca': 'robusto', 'w-iara': 'esguio', 'w-capim': 'esguio', 'w-mandacaru': 'robusto',
    'w-ventania': 'esguio', 'w-jequitiba': 'robusto' };
  assert.deepStrictEqual(G.PORTES, { valores: ['esguio', 'padrao', 'robusto'], nomes: { esguio: 'Esguio', padrao: 'Padrão', robusto: 'Robusto' }, mutacao: 0.10, padrao: 'padrao' });
  var todos = G.STARTERS.concat(G.WILD_HORSES); assert.strictEqual(todos.length, 15);
  todos.forEach(function (h) { assert.strictEqual(h.porte, T[h.id], h.id); assert.ok(B.porteValido(h.porte)); });
});
test('portes: sorteios antigos intactos (sem o efeito da Sorte)', semSortePP(function () {
  var cat = G.STARTERS.concat(G.WILD_HORSES), lista = [];
  for (var i = 1; i <= 200; i++) {
    var f = JSON.parse(JSON.stringify(cat[i % cat.length])), m = JSON.parse(JSON.stringify(cat[(i * 7 + 3) % cat.length]));
    f.sex = 'f'; m.sex = 'm'; f.level = 30; m.level = 30; f.uid = 'f' + i; m.uid = null;
    var x = B.foal({ f: f, m: m, seedBase: i, breedCounter: i % 7, nextUid: i });
    assert.ok(B.porteValido(x.porte)); delete x.porte; delete x.skillRanks; lista.push(x);
  }
  assert.strictEqual(B.hashChave(JSON.stringify(lista)), IMPRESSAO_FOAL_2A);
}));
test('portes: herança (4.000 potros de égua esguia × garanhão robusto)', function () {
  var f = mk2({ sex: 'f' }), m = mk2({}); f.porte = 'esguio'; m.porte = 'robusto';
  var N = 4000, mut = 0, semMut = 0, deF = 0;
  for (var s = 0; s < N; s++) {
    var c = B.foal({ f: f, m: m, seedBase: 91, breedCounter: s, nextUid: 1 }).porte;
    var r = S.mulberry32(S.hash2(91 >>> 0, 0x504F0000 + s)), houve = r() < G.PORTES.mutacao;
    if (houve) { mut++; assert.ok(B.porteValido(c)); continue; }
    semMut++;
    assert.ok(c === 'esguio' || c === 'robusto', 'sem mutação só sai de um dos pais: ' + c);
    if (c === 'esguio') deF++;
  }
  var pm = mut / N; assert.ok(pm >= 0.085 && pm <= 0.115, 'mutação ' + pm);
  var pF = deF / semMut; assert.ok(pF >= 0.47 && pF <= 0.53, 'égua ' + pF);
});
test('portes: porteDoId', function () {
  var cont = { esguio: 0, padrao: 0, robusto: 0 };
  for (var i = 0; i < 1000; i++) {
    var a = B.porteDoId('k' + i); assert.strictEqual(a, B.porteDoId('k' + i)); assert.ok(B.porteValido(a)); cont[a]++;
  }
  G.PORTES.valores.forEach(function (v) { assert.ok(cont[v] >= 280 && cont[v] <= 390, v + ' ' + cont[v]); });
});
test('portes: escada (RF1, RF4)', function () {
  G.PORTES.valores.forEach(function (v) { assert.strictEqual(B.porteDe(v, 'w-ticao', 'k'), v); });
  [2, 'Robusto', null, {}, '__proto__', undefined].forEach(function (lixo) {
    assert.strictEqual(B.porteDe(lixo, 'w-ticao', 'k'), 'robusto', String(lixo));
    assert.strictEqual(B.porteDe(lixo, null, 'k7'), B.porteDoId('k7'), String(lixo));
    assert.strictEqual(B.porteDe(lixo, 'inexistente', 'k7'), B.porteDoId('k7'), String(lixo));
  });
  assert.ok(!B.porteValido('Robusto') && !B.porteValido(null) && !B.porteValido('__proto__') && B.porteValido('padrao'));
  // pai sem campo `porte` herda pela escada
  var modelo = mk2({ sex: 'f' }); modelo.templateId = 'w-ticao';
  var semNada = mk2({ uid: 'm7' }), ref = mk2({ sex: 'f' }); ref.porte = 'robusto';
  var ref2 = mk2({ uid: 'm7' }); ref2.porte = B.porteDoId('m7');
  for (var s = 0; s < 100; s++) {
    assert.strictEqual(B.foal({ f: modelo, m: semNada, seedBase: 3, breedCounter: s, nextUid: 1 }).porte, B.foal({ f: ref, m: ref2, seedBase: 3, breedCounter: s, nextUid: 1 }).porte);
  }
});

section('equipamento: catálogo');
test('5 slots com o status principal (o secundário de corrida saiu: as peças têm linhas de farm)', function () {
  assert.deepStrictEqual(G.GEAR_SLOTS, ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura']);
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.ferraduras, { name: 'Ferraduras', main: 'vel' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.sela, { name: 'Sela', main: 'est' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.estribos, { name: 'Estribos', main: 'man' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.testeira, { name: 'Testeira', main: 'acel' });
  assert.deepStrictEqual(G.GEAR_SLOT_INFO.armadura, { name: 'Armadura', main: 'forca' });
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
  assert.deepStrictEqual(G.GEAR['sela-sol-raro'], { id: 'sela-sol-raro', name: 'Sela do Sol', slot: 'sela', rarity: 'raro', set: 'sol', main: 1.25, price: 600, shop: true });
  assert.deepStrictEqual(G.GEAR['ferraduras-comum'], { id: 'ferraduras-comum', name: 'Ferradura Leve', slot: 'ferraduras', rarity: 'comum', set: null, main: 0.75, price: 100, shop: true });
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].name, 'Armadura da Chuva');
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].main, 1.75);
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].sub, undefined, 'sem secundário de corrida');
  assert.strictEqual(G.GEAR['armadura-chuva-lendario'].price, 1500);
  assert.strictEqual(G.GEAR['estribos-magico'].name, 'Esporas de Prata');
  assert.strictEqual(G.GEAR['testeira-nevoa-raro'].name, 'Testeira da Névoa');
});
test('ECONOMY.gear', function () {
  var g = G.ECONOMY.gear;
  assert.deepStrictEqual(g.price, { comum: 100, magico: 250, raro: 600, lendario: 1500 });
  assert.strictEqual(g.sellRate, 0.25); assert.strictEqual(g.stonePrice, 40); assert.strictEqual(g.stoneBundle, 5);
  assert.deepStrictEqual(g.main, { comum: 0.75, magico: 1, raro: 1.25, lendario: 1.75 });   // calibrado para o PVE (meta E4)
  assert.strictEqual(g.sub, undefined, 'o secundário de corrida saiu');
  assert.strictEqual(g.plusStep, 0.2); assert.strictEqual(g.plusMax, 10);
  assert.deepStrictEqual(g.enhanceChance, [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25]);
  assert.deepStrictEqual(g.enhanceCost, [1, 1, 1, 1, 1, 1, 2, 2, 2, 2]);
  assert.strictEqual(g.enhanceDropFrom, 6);
  assert.deepStrictEqual(g.setBonus, { pieces: [3, 4, 5], farm: 0.10, clima: 1.07 });
  assert.deepStrictEqual(g.podiumStone, [0.6, 0.4, 0.25]);
  assert.deepStrictEqual(g.startGear, ['sela-comum', 'ferraduras-comum']);
});

section('equipamento: gear.js');
function gm(equip) { return { equip: equip }; }
// um conjunto resolvido qualquer (5 Raras +7), para os testes de "a corrida do PVP ignora as peças"
function pecasQuaisquer(set) { return GR.fixas({ rar: 'raro', plus: 7, doConjunto: true }, set || 'sol'); }
function gi(uid, id, plus) { return { uid: uid, id: id, plus: plus || 0 }; }
function byUid(list) { var o = {}; list.forEach(function (it) { o[it.uid] = it; }); return o; }
test('resolve (PVE) soma só o principal + plus × 0,2 e as linhas de farm; sem equip zera', function () {
  var items = byUid([Object.assign(gi('i1', 'sela-sol-raro', 3), { linhas: [{ tipo: 'xp', valor: 7 }, { tipo: 'trofeu', valor: 15 }] }), gi('i2', 'ferraduras-comum')]);
  var g = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2' }), items);
  assert.strictEqual(GR.resolve, GR.resolvePve);
  assert.deepStrictEqual(g.mods, { vel: 0.75, acel: 0, man: 0, forca: 0, est: 1.85, garra: 0, sorte: 0 });
  assert.deepStrictEqual(g.farm, { material: 0, xp: 0.07, raro: 0, trofeu: 0.15, ouro: 0 });
  assert.deepStrictEqual(g.set, { id: 'sol', count: 1 });
  assert.deepStrictEqual(g.special, { weatherDoubleClimate: null, ignoreWeatherPenalty: false });
  assert.deepStrictEqual(g.pieces.map(function (p) { return p.uid; }), ['i2', 'i1']);
  var z = GR.resolve({}, {});
  assert.deepStrictEqual(z.mods, { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 });
  assert.deepStrictEqual(z.farm, { material: 0, xp: 0, raro: 0, trofeu: 0, ouro: 0 });
  assert.deepStrictEqual(z.set, { id: null, count: 0 }); assert.deepStrictEqual(z.pieces, []);
});
test('Ferradura Rara +4: +2,05 de Velocidade (1,25 + 4 × 0,2) e o farm igual à soma das suas 2 linhas; linhas inválidas não contam', function () {
  var f = Object.assign(gi('i1', 'ferraduras-chuva-raro', 4), { linhas: [{ tipo: 'material', valor: 8 }, { tipo: 'ouro', valor: 5 }] });
  var g = GR.resolvePve(gm({ ferraduras: 'i1' }), byUid([f]));
  assert.strictEqual(g.mods.vel, 2.05); assert.deepStrictEqual(g.farm, { material: 0.08, xp: 0, raro: 0, trofeu: 0, ouro: 0.05 });
  var ruim = Object.assign(gi('i1', 'ferraduras-chuva-raro', 4), { linhas: [{ tipo: 'material', valor: 80 }, { tipo: 'ouro', valor: 5 }] });
  assert.deepStrictEqual(GR.resolvePve(gm({ ferraduras: 'i1' }), byUid([ruim])).farm, { material: 0, xp: 0, raro: 0, trofeu: 0, ouro: 0 });
  assert.strictEqual(GR.resolvePve(gm({ ferraduras: 'i1' }), byUid([ruim])).mods.vel, 2.05, 'o principal vale mesmo com linhas estragadas');
});
test('3 peças do mesmo conjunto: +10% em todos os farm; fixas (oponentes do treino AFK): 5 peças sem linhas', function () {
  var L = function (t, v) { return { tipo: t, valor: v }; };
  var items = byUid([Object.assign(gi('i1', 'sela-sol-raro'), { linhas: [L('xp', 10), L('raro', 5)] }), Object.assign(gi('i2', 'ferraduras-sol-raro'), { linhas: [L('xp', 6), L('material', 10)] }),
    Object.assign(gi('i3', 'estribos-sol-lendario'), { linhas: [L('trofeu', 30), L('ouro', 10), L('raro', 12)] }), Object.assign(gi('i4', 'testeira-magico'), { linhas: [L('ouro', 4)] })]);
  var g2 = GR.resolvePve(gm({ sela: 'i1', ferraduras: 'i2', testeira: 'i4' }), items);
  assert.deepStrictEqual(g2.farm, { material: 0.10, xp: 0.16, raro: 0.05, trofeu: 0, ouro: 0.04 });
  var g3 = GR.resolvePve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3', testeira: 'i4' }), items);
  assert.deepStrictEqual(g3.set, { id: 'sol', count: 3 });
  assert.deepStrictEqual(g3.farm, { material: 0.11, xp: 0.176, raro: 0.187, trofeu: 0.33, ouro: 0.154 });
  var fx = GR.fixas({ rar: 'raro', plus: 5, doConjunto: true }, 'chuva');
  assert.deepStrictEqual(fx.set, { id: 'chuva', count: 5 }); assert.deepStrictEqual(fx.mods, { vel: 2.25, acel: 2.25, man: 2.25, forca: 2.25, est: 2.25, garra: 0, sorte: 0 });
  assert.deepStrictEqual(fx.farm, { material: 0, xp: 0, raro: 0, trofeu: 0, ouro: 0 }); assert.strictEqual(fx.special.ignoreWeatherPenalty, true);
  var mg = GR.fixas({ rar: 'magico', plus: 3 }, 'sol');
  assert.deepStrictEqual(mg.set, { id: null, count: 0 }); assert.strictEqual(mg.mods.vel, 1.6); assert.strictEqual(mg.pieces.length, 5);
  assert.strictEqual(GR.fixas(null, 'sol'), null);
});
test('resolve ignora uid inexistente, slot errado e plus inválido', function () {
  var items = byUid([gi('i1', 'sela-sol-raro', 3), gi('i2', 'ferraduras-comum', 11), gi('i3', 'estribos-magico', 1.5)]);
  var g = GR.resolve(gm({ ferraduras: 'i1', sela: 'i9', estribos: 'i3', testeira: 'i2' }), items);
  assert.deepStrictEqual(g.pieces, []); assert.strictEqual(g.set.count, 0);
});
test('conjunto: 3/4/5 peças com raridades misturadas; 2+2+1 não ativa', function () {
  var items = byUid([gi('i1', 'sela-chuva-raro'), gi('i2', 'ferraduras-chuva-lendario', 2), gi('i3', 'estribos-chuva-raro'), gi('i4', 'testeira-chuva-raro'), gi('i5', 'armadura-chuva-lendario'), gi('i6', 'testeira-sol-raro'), gi('i7', 'armadura-nevoa-raro')]);
  var g3 = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3' }), items);
  assert.deepStrictEqual(g3.set, { id: 'chuva', count: 3 }); assert.strictEqual(g3.mods.sorte, 0, 'o conjunto não dá mais Sorte');
  assert.deepStrictEqual(g3.special, { weatherDoubleClimate: null, ignoreWeatherPenalty: false });
  var g4 = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3', testeira: 'i4' }), items);
  assert.strictEqual(g4.special.weatherDoubleClimate, 'chuva'); assert.strictEqual(g4.special.ignoreWeatherPenalty, false);
  var g5 = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', estribos: 'i3', testeira: 'i4', armadura: 'i5' }), items);
  assert.deepStrictEqual(g5.set, { id: 'chuva', count: 5 }); assert.strictEqual(g5.special.ignoreWeatherPenalty, true);
  assert.strictEqual(g5.mods.vel, 2.15); // lendário 1,75 + 2 × 0,2
  var gx = GR.resolve(gm({ sela: 'i1', ferraduras: 'i2', testeira: 'i6', armadura: 'i7' }), items);
  assert.strictEqual(gx.set.count, 2); assert.strictEqual(gx.mods.sorte, 0); assert.strictEqual(gx.special.weatherDoubleClimate, null);
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
test('o PVP não tem peças: botGear e ratingPts saíram do gear.js', function () {
  assert.strictEqual(GR.botGear, undefined); assert.strictEqual(GR.ratingPts, undefined);
});
test('sellPrice', function () {
  assert.strictEqual(GR.sellPrice('sela-magico'), 63); assert.strictEqual(GR.sellPrice('armadura-sol-lendario'), 375); assert.strictEqual(GR.sellPrice('nada'), 0);
});

section('equipamento: simulação (suspenso no bloco 1b)');
function cl(h) { return JSON.parse(JSON.stringify(h)); }
test('computeStats ignora o equipamento (gear, string de save antigo ou mods enormes)', function () {
  var h = cl(G.STARTERS[0]);
  var base = S.computeStats(h);
  var g = GR.resolve({ equip: { sela: 'i1' } }, { i1: { uid: 'i1', id: 'sela-sol-raro', plus: 10 } });
  assert.strictEqual(g.mods.est, 3.25, 'a peça ainda resolve (Raro 1,25 + 10 × 0,2)');
  assert.deepStrictEqual(S.computeStats(h, g), base);
  assert.deepStrictEqual(S.computeStats(h, 'sela-couro'), base);
  var big = { mods: { vel: 200, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 }, special: {}, set: { id: null, count: 0 }, pieces: [] };
  assert.deepStrictEqual(S.computeStats(h, big), base);
});
test('powerRating ignora mods e pontos de conjunto (trava do páreo: peça nunca sobe o Poder)', function () {
  var SL = ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'];
  function gearIds(ids, plus) { var items = {}, equip = {}; ids.forEach(function (id, i) { if (id) { items['i' + i] = { uid: 'i' + i, id: id, plus: plus }; equip[SL[i]] = 'i' + i; } }); return GR.resolve({ equip: equip }, items); }
  var gears = [
    gearIds(SL.map(function (sl) { return sl + '-comum'; }), 0),              // 5 Comuns soltas
    gearIds(SL.map(function (sl) { return sl + '-sol-raro'; }), 10),          // conjunto Raro completo +10
    gearIds([null, 'sela-comum', null, null, null], 3)                         // uma peça só
  ];
  assert.strictEqual(gears[1].set.count, 5);
  var horses = [cl(G.STARTERS[0]), cl(G.STARTERS[1]), cl(G.STARTERS[2])];
  horses[2].level = 50; horses[2].alloc = S.botAlloc(horses[2]);
  horses.forEach(function (h) {
    gears.forEach(function (g, gi) { assert.strictEqual(S.powerRating(h, g), S.powerRating(h), h.id + ' gear ' + gi); });
  });
});
test('a corrida ignora o equipamento: com e sem peças (inclusive 5 Chuva na chuva e 4 Sol no Sol), o mesmo resultado', function () {
  var brasa = cl(G.STARTERS.filter(function (x) { return x.id === 'brasa'; })[0]);
  function gearOf(set, n) { var items = {}, equip = {}; ['ferraduras', 'sela', 'estribos', 'testeira', 'armadura'].slice(0, n).forEach(function (sl, i) { items['i' + i] = { uid: 'i' + i, id: sl + '-' + set + '-raro', plus: 0 }; equip[sl] = 'i' + i; }); return GR.resolve({ equip: equip }, items); }
  [[gearOf('chuva', 5), 'chuva'], [gearOf('sol', 4), 'sol'], [pecasQuaisquer(), null]].forEach(function (c, ci) {
    for (var k = 0; k < 10; k++) {
      var seed = S.hash2(777, k), cond = S.randomConditions(seed); if (c[1]) cond.weather = c[1];
      var com = S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: [{ horse: brasa, gear: c[0], name: 'a' }, { horse: brasa, gear: null, name: 'b' }] });
      var sem = S.simulate({ seed: seed, conditions: cond, recordFrames: false, racers: [{ horse: brasa, gear: null, name: 'a' }, { horse: brasa, gear: null, name: 'b' }] });
      assert.strictEqual(JSON.stringify(com), JSON.stringify(sem), 'caso ' + ci + ' seed ' + k);
    }
  });
});

section('dev');
// Referência regravada nas skills com rank (2026-11-19: a ativação deixou de ser sorteada e o efeito é o do rank 1;
// conferido: o sim antigo sem o sorteio dá o mesmo que o novo com os valores antigos). Antes: bloco 1b (Dado
// (Sorte − 40)/40; seeds 1001…1020; os 3 iniciais + 5 aluguéis do Haras, com o equipamento de bot de cada liga,
// que a corrida agora ignora). Mudou a simulação de propósito? Regrave a tabela.
var ALUGUEIS = G.WILD_HORSES.filter(function (h) { return h.rarity !== 'mitico' && B.rentalPrice(h) != null; }).slice(0, 5);
var CAMPO_REF = G.STARTERS.concat(ALUGUEIS);
function refRace(seed, dev) {
  var cfg = { seed: seed, recordFrames: false, racers: CAMPO_REF.map(function (h, i) {
    return { horse: cl(h), gear: pecasQuaisquer(), name: 'r' + i, isPlayer: i === 0 };
  }) };
  if (dev !== undefined) cfg.dev = dev;
  return S.simulate(cfg);
}
function refHash(res) {
  return crypto.createHash('sha1').update(JSON.stringify({ finishOrder: res.finishOrder, finishTimes: res.finishTimes, events: res.events })).digest('hex');
}
var REF_HASHES = ['c7bd6ec725da9baff215edf02069668324a1a6c8', '23d02cf83f681a0d22b6217366262f98d8b7eada', 'f2137c6b3b8f4bf06c6a27721143aa38e429ca2b',
  'e7e7f917fbf2e7a67406eace2731d80f5fc61ec3', '97ad7443d3cd8465853456bf136318ca198881fb', '080fa83bf03cfbe7bb2aa72c8415865506214985',
  '15466d6dd1d8e755d918f9a1d10daa8cd7162bfa', '62b409f8d2e249ffcd2770b1e53f7d39f1ede336', '91c2a4d5cada464cfcb04cfed8000a32ea2d091e',
  '8470f28a998603c542ad34208997e9dba2714661', '8b05ee00141e9b971999c0b86049997cdc812288', '2aa51f18630ab92e3653983e3ebdccaf0ecab42d',
  '6ac9744a199e5cfd5bd54df9cd998ab791fa685d', 'a91629dd18f87e649ad17a4ecc07d99bc4f94cbe', '0c60b25797c99b64ab629eb731578ed8dd7f8252',
  'bebc16b01d1c21dda95b89b074fa4a5ee8380d74', 'ce56cbc0157175952e640e09ad53dd1e7ab08c6c', '7fa375c80622dabd0edb293bc8c73430fc2b48f2',
  'bb54a73db517efae350dc34e50af2d9853179573', '781866ea36a643e90280671ba57fad3143b8d351'];
test('sem config.dev o resultado é o de antes', function () {
  assert.deepStrictEqual(CAMPO_REF.map(function (h) { return h.id; }), ['brasa', 'mare', 'ipe', 'w-faisca', 'w-lambari', 'w-capim', 'w-ticao', 'w-garoa']);
  var diff = [];
  for (var k = 0; k < 20; k++) { var h = refHash(refRace(1001 + k)); if (h !== REF_HASHES[k]) diff.push((1001 + k) + ': ' + h); }
  assert.deepStrictEqual(diff, [], 'hashes diferentes da referência');
});
test('config.dev não muda a corrida: o antigo skillsAlways é ignorado (a skill já ativa sempre)', function () {
  var a = JSON.stringify(refRace(1003)), b = JSON.stringify(refRace(1003, {})), c = JSON.stringify(refRace(1003, { skillsAlways: false })), d = JSON.stringify(refRace(1003, { skillsAlways: true }));
  assert.strictEqual(b, a); assert.strictEqual(c, a); assert.strictEqual(d, a);
});
// mapa com gatilho garantido para start (largada), straight (reta final de 600 m) e final (80%)
var GATILHOS = { distance: 1200, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 300 }, { type: 'curva', from: 300, to: 600 }, { type: 'reta', from: 600, to: 1200 }] };
function devRace(seed, horses, dev) {
  var cfg = { seed: seed, conditions: GATILHOS, recordFrames: true, racers: horses.map(function (h, i) { return { horse: h, statAdd: soma(h), name: 'r' + i, isPlayer: i === 0 }; }) };
  if (dev) cfg.dev = dev;
  return S.simulate(cfg);
}
function skillsPorCorredor(res, n) {
  var c = []; for (var i = 0; i < n; i++) c.push(0);
  res.events.forEach(function (e) { if (e.type === 'skill') c[e.racer]++; });
  return c;
}
test('toda skill ativa quando o gatilho acontece: 3 de 3 em todos os corredores, em qualquer seed, sem parâmetro nenhum', function () {
  function fraco() { var h = mk({ sorte: 0 }); h.rarity = 'comum'; h.skills = ['arranque', 'sprint', 'arrancada-final']; return h; }
  for (var s = 1; s <= 30; s++) {
    var hs = [fraco(), fraco(), fraco(), fraco()];
    assert.deepStrictEqual(skillsPorCorredor(devRace(s, hs), 4), [3, 3, 3, 3], 'seed ' + s);
  }
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
  G.STAT_KEYS.forEach(function (k) { assert.strictEqual(t.potential[k], 12, 'pot ' + k); });
  assert.deepStrictEqual(t.palette, pal);
  Object.keys(G.STARTERS[0]).filter(function (k) { return k !== 'title' && k !== 'bio'; }).forEach(function (k) { assert.ok(k in t, 'campo ' + k); });
  // Mítico: 5 vagas, qualquer skill do catálogo (inclusive de outro elemento), na ordem pedida
  var m = DV().horseTemplate({ name: 'X', element: 'agua', rarity: 'mitico', sex: 'm', potential: 'max', skills: ['sol-a-pino', 'nevoa-amiga', 'labareda', 'drift', 'sprint', 'arranque', 'segundo-ar'] }, 1);
  assert.deepStrictEqual(m.skills, ['sol-a-pino', 'nevoa-amiga', 'drift', 'sprint', 'arranque'], 'a skill de tipo não é skill de vaga');
  G.STAT_KEYS.forEach(function (k) { assert.strictEqual(m.potential[k], 31); });
  assert.ok(/^#[0-9a-f]{6}$/i.test(m.palette.coat) && /^#[0-9a-f]{6}$/i.test(m.palette.accent), 'paleta padrão');
  assert.strictEqual(DV().horseTemplate({ rarity: 'raro', potential: 99 }).potential.vel, 31);
  assert.strictEqual(DV().horseTemplate({ rarity: 'raro', potential: -4 }).potential.vel, 0);
  // campos inválidos: valores padrão válidos, e o template corre
  var d = DV().horseTemplate({ element: 'lava', rarity: 'divino', sex: 'x', skills: 'arranque', name: ' ' });
  assert.ok(G.ELEMENTS[d.element] && G.RARITIES[d.rarity] && (d.sex === 'm' || d.sex === 'f') && Array.isArray(d.skills) && d.name.length >= 2);
  var res = S.simulate({ seed: 3, recordFrames: false, racers: [{ horse: m, gear: null, name: 'a' }, { horse: t, gear: null, name: 'b' }] });
  assert.strictEqual(res.finishOrder.length, 2);
});
test('Dev.horseTemplate v3: sem base, genética por status, estrelas e alloc', function () {
  var t = DV().horseTemplate({ rarity: 'raro', potential: { vel: 31, acel: 0, man: 7, forca: 40, est: -2, garra: 'x', sorte: 15 }, grau: 3, alloc: { vel: 5, acel: -1, man: 2.7, forca: 'abc', est: 999 } }, 2);
  assert.ok(!('base' in t), 'sem base');
  assert.deepStrictEqual(t.potential, { vel: 31, acel: 0, man: 7, forca: 31, est: 0, garra: 0, sorte: 15 });
  assert.strictEqual(t.grau, 3);
  assert.deepStrictEqual(t.alloc, { vel: 5, acel: 0, man: 2, forca: 0, est: 999, garra: 0, sorte: 0 }, 'inteiros ≥ 0 (o limite fica para RaceSim.validAlloc)');
  [0, 4, 'x', null, 2.4].forEach(function (g) { var e = DV().horseTemplate({ grau: g }).grau; assert.ok(e >= 1 && e <= 3 && e === Math.floor(e), String(g) + ' -> ' + e); });
  assert.strictEqual(DV().horseTemplate({ grau: 1 }).grau, 1); assert.strictEqual(DV().horseTemplate({}).grau, 2);
  G.STAT_KEYS.forEach(function (k) { assert.strictEqual(DV().horseTemplate({}).alloc[k], 0); });
});
test('Dev.horseTemplate: marcas da gaveta (patas também em texto, como no select); inválidas viram nenhuma/0/liso', function () {
  assert.deepStrictEqual(DV().horseTemplate({ marcas: { cara: 'listra', patas: 3, corpo: 'malhado' } }).marcas, { cara: 'listra', patas: 3, corpo: 'malhado' });
  assert.deepStrictEqual(DV().horseTemplate({ marcas: { cara: 'frente', patas: '4', corpo: 'ruao' } }).marcas, { cara: 'frente', patas: 4, corpo: 'ruao' });
  [undefined, null, 'x', {}, { cara: 'x', patas: 7, corpo: 2 }, { cara: 'estrela', patas: '2.5', corpo: 'liso' }, { patas: ' 1' }, { patas: true }].forEach(function (mc) {
    var t = DV().horseTemplate({ marcas: mc });
    assert.ok(B.marcasValidas(t.marcas), JSON.stringify(mc) + ' -> ' + JSON.stringify(t.marcas));
    if (!mc || typeof mc !== 'object' || mc.cara !== 'estrela') assert.strictEqual(t.marcas.cara, 'nenhuma', JSON.stringify(mc));
    assert.strictEqual(t.marcas.patas, 0, JSON.stringify(mc));
  });
  // cada gene vale por si: um gene inválido não apaga os outros
  assert.deepStrictEqual(DV().horseTemplate({ marcas: { cara: 'estrela', patas: 9, corpo: 'pintado' } }).marcas, { cara: 'estrela', patas: 0, corpo: 'pintado' });
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
test('level e potencial malformados: status finitos, corrida termina', function () {
  var h = mk({}); h.level = 'x'; h.potential = { vel: 'abc', acel: NaN, man: -5, forca: 99, est: null, garra: undefined, sorte: '7' };
  var st = S.computeStats(h, null);
  G.STAT_KEYS.forEach(function (k) { assert.ok(typeof st[k] === 'number' && isFinite(st[k]), k + ' = ' + st[k]); });
  var h1 = mk({}); h1.level = 1; h1.potential = { vel: 0, acel: 0, man: 0, forca: 31, est: 0, garra: 0, sorte: 7 };
  assert.deepStrictEqual(st, S.computeStats(h1, null), 'level "x" vale 1; potencial vira número (inválido vale 0), preso a 0–31');
  var hb = mk({}); hb.alloc = { vel: 'rápido', acel: -3, man: Infinity }; assert.deepStrictEqual(S.computeStats(hb, null), S.computeStats(mk({}), null));
  hb.alloc = 'tudo'; assert.deepStrictEqual(S.computeStats(hb, null), S.computeStats(mk({}), null));
  var res = race(3, RETA, campo2(h));
  assert.ok(semNaN(res), res.finishTimes.join());
  assert.ok(!res.events.some(function (e) { return e.type === 'chegada' && /900/.test(e.text); }), 'ninguém "chega" em 900 s');
  assert.strictEqual(S.sanitizeLevel(10.7), 10); assert.strictEqual(S.sanitizeLevel(undefined), 1); assert.strictEqual(S.sanitizePotential('x'), 0); assert.strictEqual(S.sanitizePotential(40), 31);
});
test('simulate não muta a config recebida', function () {
  var cfg = { seed: 99, conditions: { distance: 1600, blocks: [{ type: 'reta', from: 0, to: 400 }, { type: 'curva', from: 400, to: 1200 }, { type: 'reta', from: 1200, to: 1600 }] },
    racers: [{ horse: cl(G.STARTERS[0]), gear: pecasQuaisquer(), name: 'a' }, { horse: cl(G.STARTERS[1]), gear: null, name: 'b' }] };
  var antes = JSON.stringify(cfg);
  S.simulate(cfg); assert.strictEqual(JSON.stringify(cfg), antes);
});
test('resultado traz simVersion e tuningHash; o hash muda com o TUNING, as skills e as skills de tipo', function () {
  assert.strictEqual(typeof S.VERSION, 'string'); assert.ok(S.VERSION.length > 0);
  var a = race(5, RETA, campo2());
  assert.strictEqual(a.simVersion, S.VERSION); assert.ok(/^[0-9a-f]{16}$/.test(a.tuningHash), a.tuningHash);
  assert.strictEqual(race(6, CURVA, campo2()).tuningHash, a.tuningHash, 'não depende da seed nem do mapa');
  assert.strictEqual(S.tuningHash(), a.tuningHash);
  var old = S.TUNING.vBase; S.TUNING.vBase = old + 0.01;
  try { assert.notStrictEqual(S.tuningHash(), a.tuningHash, 'TUNING'); } finally { S.TUNING.vBase = old; }
  var sk = G.SKILLS.sprint.effect, sm = sk.speedMult; sk.speedMult = sm + 0.01;
  try { assert.notStrictEqual(S.tuningHash(), a.tuningHash, 'skills'); } finally { sk.speedMult = sm; }
  var te = G.TYPE_SKILLS.fogo.effect, ta = te.statMul; te.statMul = ta + 0.01;
  try { assert.notStrictEqual(S.tuningHash(), a.tuningHash, 'skills de tipo'); } finally { te.statMul = ta; }
  var rp = G.RARITIES.raro, pm = rp.ptsMult; rp.ptsMult = pm + 0.01;
  try { assert.notStrictEqual(S.tuningHash(), a.tuningHash, 'fator de pontos da raridade'); } finally { rp.ptsMult = pm; }
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
test('enhanceOdds/enhance exigem plus inteiro 0–9 (o +10 já está no máximo)', function () {
  [1.5, '3', NaN, -1, 10, 11, null, undefined, Infinity].forEach(function (p) {
    assert.strictEqual(GR.enhanceOdds(p), null, String(p));
    assert.strictEqual(GR.enhance({ uid: 'x', id: 'sela-comum', plus: p }, 1, 0), null, String(p));
  });
  assert.strictEqual(GR.enhance(null, 1, 0), null);
  assert.deepStrictEqual(GR.enhanceOdds(3), { chance: 0.7, cost: 1, dropTo: 3 });
});
test('potro nunca nasce com elemento fora de GameData.ELEMENTS (pais com neutro ou lixo)', function () {
  var vistos = {};
  for (var s = 0; s < 600; s++) {
    var casos = [['neutro', 'fogo'], ['agua', 'neutro'], ['neutro', 'neutro'], ['lava', undefined], ['grama', 'xyz']];
    casos.forEach(function (par) {
      var f = mk2({ sex: 'f', element: par[0], skills: [] }), m = mk2({ element: par[1], skills: [] });
      var c = B.foal({ f: f, m: m, seedBase: s, breedCounter: 0, nextUid: 1 });
      assert.ok(Object.prototype.hasOwnProperty.call(G.ELEMENTS, c.element), par.join('+') + ' deu ' + c.element);
      var validos = par.filter(function (e) { return Object.prototype.hasOwnProperty.call(G.ELEMENTS, e); });
      if (validos.length) assert.strictEqual(c.element, validos[0], 'herda o do pai válido');
      else vistos[c.element] = 1;
    });
  }
  assert.deepStrictEqual(Object.keys(vistos).sort(), ['agua', 'fogo', 'grama'], 'dois inválidos: os três tipos saem pela seed');
});
test('foal/rentalPrice/odds com grau e level malformados', function () {
  var f = mk2({ sex: 'f' }), m = mk2({}); delete f.grau; m.grau = undefined;
  var x = B.foal({ f: f, m: m, seedBase: 1, breedCounter: 0, nextUid: 1 });
  assert.ok(x.grau >= 1 && x.grau <= 3);
  var g0 = mk2({ rarity: 'comum' }); g0.grau = 0;   // mk2 troca grau 0 por 2
  assert.strictEqual(B.rentalPrice(g0), B.rentalPrice(mk2({ rarity: 'comum', grau: 1 })));
  assert.strictEqual(B.rentalPrice(mk2({ rarity: 'comum', grau: 4 })), B.rentalPrice(mk2({ rarity: 'comum', grau: 3 })));
  var semGrau = mk2({ rarity: 'comum' }); delete semGrau.grau; assert.strictEqual(B.rentalPrice(semGrau), 125, 'sem grau vale ★★');
  assert.strictEqual(B.rentalPrice(mk2({ rarity: 'comum', grau: 'x' })), 125);
  assert.deepStrictEqual(B.rarityOdds(mk2({ sex: 'f', level: 'x' }), mk2({ level: 'x' })), B.rarityOdds(mk2({ sex: 'f', level: 1 }), mk2({ level: 1 })));
  assert.strictEqual(B.levelFactor(mk2({ sex: 'f', level: 1e9 }), mk2({ level: 1e9 })), 1);
  assert.ok(isFinite(B.levelFactor(mk2({ sex: 'f', level: NaN }), mk2({ level: 'abc' }))));
  assert.strictEqual(B.hexMix, undefined, 'hexMix não é exportado');
});
test('Dev.TRACADOS removido', function () { assert.strictEqual(DV().TRACADOS, undefined); });

section('itens');
// sem o módulo, cada teste desta seção falha (em vez de derrubar o arquivo inteiro)
var IT; try { IT = require('../src/itens.js'); } catch (e) { IT = {}; console.log('  (itens.js não carregou: ' + e.message + ')'); }
function congela(x) { if (x && typeof x === 'object') { Object.keys(x).forEach(function (k) { congela(x[k]); }); Object.freeze(x); } return x; }
function cavIt(o) {
  o = o || {};
  var h = { uid: 'c1', name: 'Brasa', element: o.element || 'fogo', rarity: o.rarity || 'raro', grau: o.grau == null ? 2 : o.grau, level: o.level == null ? 20 : o.level,
    skills: o.skills || ['arranque'], torroes: o.torroes == null ? 0 : o.torroes };
  if (o.skillRanks) h.skillRanks = o.skillRanks;
  return h;
}
var CTX = { tem: 1, ativaComSala: false };
// cópia da learnSkill de antes desta frente (o teste confere que a nova consome o rng igual e devolve o mesmo)
function learnSkillAntiga(mount, rng) {
  var r = mount && typeof mount.rarity === 'string' && Object.prototype.hasOwnProperty.call(G.RARITIES, mount.rarity) ? G.RARITIES[mount.rarity] : G.RARITIES.comum;
  var owned = mount.skills || [];
  if (owned.length >= r.skillSlots) return null;
  if (rng() >= S.TUNING.learnChance) return null;
  var cands = [];
  Object.keys(G.SKILLS).forEach(function (id) {
    var sk = G.SKILLS[id];
    if (sk.element !== 'geral' && sk.element !== mount.element) return;
    if (owned.indexOf(id) >= 0) return;
    cands.push(id);
  });
  if (!cands.length) return null;
  return cands[Math.floor(rng() * cands.length)];
}
function contaRng(seed) { var r = S.mulberry32(seed), f = function () { f.n++; return r(); }; f.n = 0; return f; }
function todasCandidatas(el) { return Object.keys(G.SKILLS).filter(function (id) { return G.SKILLS[id].element === 'geral' || G.SKILLS[id].element === el; }); }

test('catálogo: 6 itens na ordem, preços, limites, chance, mochila e diária', function () {
  var I = G.ITEMS;
  assert.deepStrictEqual(G.ITENS_USO, ['torrao', 'estrela', 'redea', 'cupom', 'manual', 'pergaminho']);
  assert.deepStrictEqual(G.ITENS_USO.map(function (k) { return I[k].name; }), ['Torrão de açúcar', 'Estrela de treino', 'Rédea nova', 'Cupom de troca de skill', 'Manual de doma', 'Pergaminho de técnica']);
  G.ITENS_USO.forEach(function (k) {
    assert.strictEqual(I[k].id, k);
    assert.ok(typeof I[k].desc === 'string' && I[k].desc.length > 10 && I[k].desc.indexOf('\n') < 0, k + ' desc');
    assert.ok(typeof I[k].origem === 'string' && I[k].origem.length > 10 && I[k].origem.indexOf('\n') < 0, k + ' origem');
    // o plural do nome (a quantidade lida como "3 Torrões de açúcar"): texto, diferente do nome
    assert.ok(typeof I[k].name === 'string' && I[k].name.length > 3, k + ' name');
    assert.ok(typeof I[k].plural === 'string' && I[k].plural.length > 3 && I[k].plural !== I[k].name, k + ' plural');
  });
  assert.deepStrictEqual(G.ITENS_USO.map(function (k) { return I[k].plural; }), ['Torrões de açúcar', 'Estrelas de treino', 'Rédeas novas', 'Cupons de troca de skill', 'Manuais de doma', 'Pergaminhos de técnica']);
  // a ordem da loja é fixa no catálogo (Ruling 11, spec §6), não a do preço: só itens à venda, cada um uma vez
  assert.deepStrictEqual(G.SHOP_ORDER, ['torrao', 'manual', 'cupom', 'estrela']);
  G.SHOP_ORDER.forEach(function (k) { assert.ok(Object.prototype.hasOwnProperty.call(I, k) && I[k].price > 0, 'SHOP_ORDER: ' + k + ' sem preço'); });
  assert.deepStrictEqual(G.ITENS_USO.filter(function (k) { return I[k].price != null; }).sort(), G.SHOP_ORDER.slice().sort(), 'SHOP_ORDER tem todos os itens à venda');
  assert.deepStrictEqual(G.ITENS_USO.map(function (k) { return I[k].price; }), [120, 2000, null, 250, 200, undefined]);   // Rédea nova e Pergaminho de técnica: não se vendem
  assert.strictEqual(I.torrao.perDay, 2); assert.strictEqual(I.cupom.perDay, 1); assert.strictEqual(I.manual.perDay, 1);
  assert.strictEqual(I.torrao.cap, 10); assert.strictEqual(I.estrela.everyDays, 7); assert.strictEqual(I.manual.chance, 0.35);
  assert.strictEqual(G.BAG_MAX, 99);
  assert.deepStrictEqual(G.DAILY, { dias: [{ ouro: 60 }, { item: 'torrao' }, { ouro: 100 }, { item: 'manual' }, { ouro: 150 }, { item: 'cupom' }, { ouro: 200, item: 'redea' }], estrelaACada: 4 });
});
test('freePoints soma os torrões (0 a 10) depois do piso; fora da faixa vale 0', function () {
  var h = { rarity: 'raro', grau: 2, level: 50 }, base = S.freePoints(h);
  assert.strictEqual(base, 235);
  assert.strictEqual(S.freePoints({ rarity: 'raro', grau: 2, level: 50, torroes: 0 }), base);
  assert.strictEqual(S.freePoints({ rarity: 'raro', grau: 2, level: 50, torroes: 1 }), base + 1);
  assert.strictEqual(S.freePoints({ rarity: 'raro', grau: 2, level: 50, torroes: 10 }), base + 10);
  [-1, 11, 2.5, 'x', NaN, null, Infinity, '3'].forEach(function (t) {
    assert.strictEqual(S.freePoints({ rarity: 'raro', grau: 2, level: 50, torroes: t }), base, 'torroes ' + String(t) + ' vale 0');
  });
  // os pontos a mais entram na build e no custo; o teto de 150 não muda
  var h10 = { element: 'fogo', rarity: 'mitico', grau: 3, level: 50, potential: { vel: 31 }, skills: [], torroes: 10 };
  var tudo = S.weightedAlloc(h10, { vel: 1 });
  assert.strictEqual(S.computeStats(Object.assign({}, h10, { alloc: tudo })).vel <= S.TUNING.statMax, true);
  var cav = clone(G.STARTERS[0]); cav.level = 1; cav.torroes = 7;   // Nv 1: só os pontos dos torrões
  var a = S.weightedAlloc(cav, S.TUNING.botW.fogo), custo = 0;
  G.STAT_KEYS.forEach(function (k) { custo += S.costOf(a[k]); });
  assert.strictEqual(S.freePoints(cav), 7); assert.strictEqual(custo, 7, 'a build usa os pontos dos torrões');
  assert.deepStrictEqual(S.validAlloc(cav, a), a, 'e o saneamento aceita');
});
test('bots não mudam: freePoints igual ao de antes e botAlloc igual sem torrões', function () {
  function antiga(horse) {   // freePoints de antes desta frente
    var r = typeof horse.rarity === 'string' && Object.prototype.hasOwnProperty.call(G.RARITIES, horse.rarity) ? G.RARITIES[horse.rarity] : G.RARITIES.comum;
    var T = S.TUNING, L = S.sanitizeLevel(horse.level), M = G.ECONOMY.maxLevel;
    var base = (L - 1) * T.ptsRate0 + (T.ptsRate1 - T.ptsRate0) * (L - 1) * (L - 2) / (2 * (M - 2));
    return Math.floor(base * (r.ptsMult || 1) * T.starMult[S.starsOf(horse) - 1] + 1e-9);
  }
  G.STARTERS.concat(G.WILD_HORSES).forEach(function (h0) {
    [1, 13, 30, 50].forEach(function (lv) {
      var h = clone(h0); h.level = lv;
      assert.strictEqual(S.freePoints(h), antiga(h), h.id + ' Nv ' + lv);
      assert.deepStrictEqual(S.botAlloc(h), S.botAlloc(Object.assign({}, h, { torroes: 0 })), h.id + ' Nv ' + lv + ' botAlloc');
      assert.deepStrictEqual(S.weightedAlloc(h, S.TUNING.botW[h.element]), S.botAlloc(h));
    });
  });
});
test('skillCandidates: gerais e do elemento, sem as que tem, na ordem de GameData.SKILLS; é o conjunto da learnSkill', function () {
  ['fogo', 'agua', 'grama'].forEach(function (el) {
    var tem = todasCandidatas(el).slice(0, 2), m = congela({ element: el, rarity: 'mitico', skills: tem });
    var esperado = todasCandidatas(el).filter(function (id) { return tem.indexOf(id) < 0; });
    assert.deepStrictEqual(S.skillCandidates(m), esperado, el);
    // o que a learnSkill sorteava: rng 0 passa o portão; depois (i + 0,5) / n escolhe a i-ésima
    var vistos = [];
    for (var i = 0; i < esperado.length; i++) {
      var seq = [0, (i + 0.5) / esperado.length], p = 0;
      vistos.push(S.learnSkill(m, function () { return seq[p++]; }));
    }
    assert.deepStrictEqual(vistos, esperado, el + ': learnSkill escolhe entre as mesmas');
  });
  assert.deepStrictEqual(S.skillCandidates({ element: 'fogo', rarity: 'raro' }), todasCandidatas('fogo'), 'sem skills');
  S.skillCandidates(congela(cavIt())).forEach(function (id) { assert.ok(G.SKILLS[id], id + ' é skill do catálogo (nunca de tipo)'); });
});
test('learnSkill devolve o mesmo que antes e consome o rng igual (200 seeds × 5 cavalos)', function () {
  var cavalos = [cavIt({ skills: [] }), cavIt({ element: 'agua', rarity: 'mitico', skills: ['sprint', 'nascente'] }), cavIt({ element: 'grama', rarity: 'comum', skills: [] }),
    cavIt({ rarity: 'comum', skills: ['arranque'] }), cavIt({ element: 'neutro', rarity: 'lendario', skills: ['drift'] })];
  var aprendeu = 0;
  cavalos.forEach(function (m, ci) {
    for (var s = 0; s < 200; s++) {
      var r1 = contaRng(s * 7 + ci), r2 = contaRng(s * 7 + ci);
      var nova = S.learnSkill(m, r1), velha = learnSkillAntiga(m, r2);
      assert.strictEqual(nova, velha, 'cavalo ' + ci + ' seed ' + s);
      assert.strictEqual(r1.n, r2.n, 'cavalo ' + ci + ' seed ' + s + ': mesmas chamadas de rng');
      if (nova) aprendeu++;
    }
  });
  assert.ok(aprendeu > 20, 'o teste passou por aprendizados (' + aprendeu + ')');
});
test('podeUsar: ok e cada motivo, com frase pronta', function () {
  function rec(id, m, ctx) { var r = IT.podeUsar(id, congela(m), congela(ctx || CTX)); assert.strictEqual(r.ok, false, id); assert.ok(typeof r.motivo === 'string' && r.motivo.length > 8, id + ' motivo'); return r.motivo; }
  ['torrao', 'estrela', 'cupom', 'manual'].forEach(function (id) {
    assert.deepStrictEqual(IT.podeUsar(id, congela(cavIt()), congela({ tem: 1, ativaComSala: false })), { ok: true }, id + ' ok');
    var sem = rec(id, cavIt(), { tem: 0, ativaComSala: false });
    assert.strictEqual(rec(id, cavIt(), { tem: -3, ativaComSala: false }), sem, id + ' tem negativo = sem o item');
  });
  var m10 = rec('torrao', cavIt({ torroes: 10 }));
  assert.ok(/10/.test(m10), 'motivo do torrão cita o teto: ' + m10);
  assert.deepStrictEqual(IT.podeUsar('torrao', cavIt({ torroes: 9 }), CTX), { ok: true });
  var m3 = rec('estrela', cavIt({ grau: 3 }));
  assert.deepStrictEqual(IT.podeUsar('estrela', cavIt({ grau: 1 }), CTX), { ok: true });
  var semSkill = rec('cupom', cavIt({ skills: [] }));
  var semCand = rec('cupom', cavIt({ rarity: 'mitico', skills: todasCandidatas('fogo') }));
  var cheias = rec('manual', cavIt({ rarity: 'comum', skills: ['sprint'] }));
  assert.deepStrictEqual(IT.podeUsar('manual', cavIt({ rarity: 'magico', skills: ['sprint'] }), CTX), { ok: true });
  var sala = rec('cupom', cavIt(), { tem: 1, ativaComSala: true });
  assert.strictEqual(rec('manual', cavIt(), { tem: 1, ativaComSala: true }), sala);
  assert.deepStrictEqual(IT.podeUsar('torrao', cavIt(), { tem: 1, ativaComSala: true }), { ok: true }, 'torrão com a sala aceita');
  assert.deepStrictEqual(IT.podeUsar('estrela', cavIt(), { tem: 1, ativaComSala: true }), { ok: true }, 'estrela com a sala aceita');
  var sem = rec('torrao', cavIt(), { tem: 0, ativaComSala: false });
  var motivos = [sem, m10, m3, semSkill, semCand, cheias, sala];
  motivos.forEach(function (x, i) { motivos.forEach(function (y, j) { if (i < j) assert.notStrictEqual(x, y, 'motivos distintos: ' + x); }); });
  rec('redea', cavIt()); rec('xyz', cavIt());
});
test('usarTorrao e usarEstrela devolvem o valor novo sem mutar', function () {
  assert.deepStrictEqual(IT.usarTorrao(congela(cavIt({ torroes: 0 }))), { torroes: 1 });
  assert.deepStrictEqual(IT.usarTorrao(congela(cavIt({ torroes: 9 }))), { torroes: 10 });
  assert.deepStrictEqual(IT.usarTorrao(congela(cavIt({ torroes: 'x' }))), { torroes: 1 }, 'torroes inválido vale 0');
  assert.deepStrictEqual(IT.usarEstrela(congela(cavIt({ grau: 1 }))), { grau: 2 });
  assert.deepStrictEqual(IT.usarEstrela(congela(cavIt({ grau: 2 }))), { grau: 3 });
});
test('trocarSkill: determinístico, muda com o contador, nunca devolve a que sai, uma que tem ou de tipo; mantém a posição', function () {
  var m = congela(cavIt({ rarity: 'lendario', skills: ['arranque', 'sol-a-pino', 'drift'] }));
  assert.deepStrictEqual(IT.trocarSkill(m, 'drift', 123, 4), IT.trocarSkill(m, 'drift', 123, 4));
  var mudou = 0;
  for (var s = 0; s < 50; s++) if (IT.trocarSkill(m, 'sol-a-pino', s, 0).entra !== IT.trocarSkill(m, 'sol-a-pino', s, 1).entra) mudou++;
  assert.ok(mudou >= 1, 'contador diferente muda o sorteio');
  var tipos = Object.keys(G.TYPE_SKILLS).map(function (e) { return G.TYPE_SKILLS[e].id; });
  for (var i = 0; i < 500; i++) {
    var pos = i % 3, sai = m.skills[pos], r = IT.trocarSkill(m, sai, i * 31 + 7, i);
    assert.strictEqual(r.sai, sai);
    assert.notStrictEqual(r.entra, sai, 'a que sai não volta');
    assert.ok(m.skills.indexOf(r.entra) < 0, 'não entra uma que ele tem');
    assert.ok(G.SKILLS[r.entra] && tipos.indexOf(r.entra) < 0, 'nunca skill de tipo');
    assert.ok(S.skillCandidates(m).indexOf(r.entra) >= 0, 'vem das candidatas');
    assert.strictEqual(r.skills.length, 3); assert.strictEqual(r.skills[pos], r.entra, 'mesma posição');
    m.skills.forEach(function (id, j) { if (j !== pos) assert.strictEqual(r.skills[j], id); });
  }
  assert.deepStrictEqual(m.skills, ['arranque', 'sol-a-pino', 'drift'], 'não muta');
  assert.strictEqual(IT.trocarSkill(m, 'sprint', 1, 0), null, 'skill fora das vagas');
  assert.strictEqual(IT.trocarSkill(m, 'labareda', 1, 0), null, 'skill de tipo');
  assert.strictEqual(IT.trocarSkill(congela(cavIt({ rarity: 'mitico', skills: todasCandidatas('fogo') })), 'arranque', 1, 0), null, 'sem candidata');
});
test('trocarSkill e tentarDoma: uma sequência própria da seed do save (sal fora das seeds de corrida, nível, cruza e melhoria)', function () {
  var m = congela(cavIt({ rarity: 'raro', skills: ['arranque', 'drift'] })), c = S.skillCandidates(m);
  for (var s = 0; s < 40; s++) {
    var r = S.mulberry32(S.hash2(s, IT.SAL + s % 5));
    assert.strictEqual(IT.trocarSkill(m, 'drift', s, s % 5).entra, c[Math.floor(r() * c.length)]);
    var r2 = S.mulberry32(S.hash2(s, IT.SAL + s % 5)), d = IT.tentarDoma(m, s, s % 5);
    if (r2() < G.ITEMS.manual.chance) assert.strictEqual(d.aprendeu, c[Math.floor(r2() * c.length)]); else assert.strictEqual(d.aprendeu, null);
  }
  // não pode cair em hash2(seedBase, x) que outro sorteio já usa: sala (contador da corrida), aprendizado por nível
  // (nº do páreo × 100 + nível), melhoria (0xE4A0 + contador) e cruza (0xB0B0, 0x4D410000, 0x504F0000 + contador)
  assert.ok(IT.SAL > 0x10000000 && IT.SAL + 1e6 < 0x4D410000, 'sal alto e longe dos da cruza: ' + IT.SAL.toString(16));
});
test('tentarDoma: ~35% em 4.000 seeds, aprende das candidatas, sem vaga ou candidata é null', function () {
  var m = congela(cavIt({ rarity: 'raro', skills: ['arranque', 'sol-a-pino'] })), c = S.skillCandidates(m), sim = 0;
  for (var s = 0; s < 4000; s++) {
    var r = IT.tentarDoma(m, s, 3);
    if (r.aprendeu) {
      sim++;
      assert.ok(c.indexOf(r.aprendeu) >= 0, 'das candidatas');
      assert.deepStrictEqual(r.skills, ['arranque', 'sol-a-pino', r.aprendeu]);
    } else assert.deepStrictEqual(r.skills, ['arranque', 'sol-a-pino']);
  }
  assert.ok(sim / 4000 >= 0.31 && sim / 4000 <= 0.39, 'aprendeu ' + (sim / 40).toFixed(1) + '%');
  assert.deepStrictEqual(IT.tentarDoma(m, 77, 2), IT.tentarDoma(m, 77, 2));
  assert.deepStrictEqual(m.skills, ['arranque', 'sol-a-pino'], 'não muta');
  assert.strictEqual(IT.tentarDoma(congela(cavIt({ rarity: 'comum', skills: ['drift'] })), 1, 0), null, 'sem vaga');
  var semCand = { element: 'fogo', rarity: 'mitico', skills: [] }, salva = G.RARITIES.mitico.skillSlots;
  semCand.skills = todasCandidatas('fogo'); G.RARITIES.mitico.skillSlots = 20;
  try { assert.strictEqual(IT.tentarDoma(semCand, 1, 0), null, 'sem candidata'); } finally { G.RARITIES.mitico.skillSlots = salva; }
});
test('diária: 7 dias seguidos, recomeça, Estrela no 28º resgate', function () {
  var d = congela({ prox: 0, ciclos: 0, ultimo: null }), sempre = function () { return true; }, vistos = [];
  for (var n = 1; n <= 28; n++) {
    var e = IT.diariaEstado(d, 99 + n);
    assert.strictEqual(e.pode, true); assert.strictEqual(e.dia, (n - 1) % 7 + 1);
    var r = IT.resgatar(d, 99 + n, sempre);
    assert.deepStrictEqual({ ouro: r.ouro, itens: r.itens }, e.premio, 'o resgate dá o prêmio anunciado');
    assert.strictEqual(!!r.itens.estrela, e.estrela);
    vistos.push(r);
    d = congela(r.diaria);
  }
  assert.deepStrictEqual(vistos.slice(0, 7).map(function (r) { return [r.ouro, r.itens]; }),
    [[60, {}], [0, { torrao: 1 }], [100, {}], [0, { manual: 1 }], [150, {}], [0, { cupom: 1 }], [200, { redea: 1 }]]);
  assert.deepStrictEqual([vistos[7].ouro, vistos[7].itens], [60, {}], 'volta ao dia 1');
  assert.deepStrictEqual(vistos[6].diaria, { prox: 0, ciclos: 1, ultimo: 106 });
  [6, 13, 20].forEach(function (i) { assert.ok(!vistos[i].itens.estrela, 'resgate ' + (i + 1) + ' sem Estrela'); });
  assert.deepStrictEqual(vistos[27].itens, { redea: 1, estrela: 1 }, '28º resgate traz a Estrela');
  assert.strictEqual(vistos[27].ouro, 200);
  assert.deepStrictEqual(d, { prox: 0, ciclos: 4, ultimo: 127 });
});
test('diária: uma vez por dia, relógio para trás não libera, faltar não zera, mochila cheia espera', function () {
  var sempre = function () { return true; };
  var d0 = congela({ prox: 0, ciclos: 0, ultimo: null });
  var e0 = IT.diariaEstado(d0, 100);
  assert.deepStrictEqual(e0, { pode: true, dia: 1, premio: { ouro: 60, itens: {} }, amanha: { ouro: 0, itens: { torrao: 1 } }, estrela: false }, 'save novo: dia 1 para resgatar');
  var d1 = congela(IT.resgatar(d0, 100, sempre).diaria);
  assert.strictEqual(IT.resgatar(d1, 100, sempre), null, 'segundo resgate no mesmo dia');
  var e1 = IT.diariaEstado(d1, 100);
  assert.strictEqual(e1.pode, false); assert.strictEqual(e1.dia, 2);
  assert.deepStrictEqual(e1.amanha, { ouro: 0, itens: { torrao: 1 } }, 'já resgatado: amanhã é o próximo prêmio');
  // Review Focus 3: relógio para trás e de novo para a frente
  assert.strictEqual(IT.resgatar(d1, 99, sempre), null, 'dia 99 depois de resgatar no 100');
  assert.strictEqual(IT.diariaEstado(d1, 99).pode, false);
  var r101 = IT.resgatar(d1, 101, sempre);
  assert.deepStrictEqual(r101.itens, { torrao: 1 }); assert.deepStrictEqual(r101.diaria, { prox: 2, ciclos: 0, ultimo: 101 });
  // faltar 5 dias não muda prox
  var r106 = IT.resgatar(d1, 106, sempre);
  assert.deepStrictEqual(r106.itens, { torrao: 1 }, 'continua de onde parou'); assert.strictEqual(r106.diaria.prox, 2);
  // mochila cheia: o resgate espera e a diária não anda
  var pediu = [];
  assert.deepStrictEqual(IT.resgatar(d1, 101, function (id, q) { pediu.push([id, q]); return false; }), { cheia: 'torrao' });
  assert.deepStrictEqual(pediu, [['torrao', 1]]);
  assert.deepStrictEqual(d1, { prox: 1, ciclos: 0, ultimo: 100 }, 'não muta');
  assert.strictEqual(IT.resgatar(d1, 101, sempre).diaria.prox, 2, 'depois de abrir espaço, resgata');
  var d6 = congela({ prox: 6, ciclos: 3, ultimo: 50 }), negaEstrela = function (id) { return id !== 'estrela'; };
  assert.deepStrictEqual(IT.resgatar(d6, 51, negaEstrela), { cheia: 'estrela' }, 'Estrela também espera');
  var e6 = IT.diariaEstado(d6, 51);
  assert.strictEqual(e6.estrela, true); assert.deepStrictEqual(e6.premio, { ouro: 200, itens: { redea: 1, estrela: 1 } });
});
test('diária: estado saneado (prox, ciclos e ultimo fora da faixa)', function () {
  var e = IT.diariaEstado({ prox: 9, ciclos: -2, ultimo: 'x' }, 10);
  assert.strictEqual(e.pode, false, 'ultimo corrompido não libera'); assert.strictEqual(e.dia, 1);
  assert.deepStrictEqual(IT.resgatar({ prox: 2.5, ciclos: 'a', ultimo: null }, 10, function () { return true; }).diaria, { prox: 1, ciclos: 0, ultimo: 10 });
});
test('loja: limite por dia, volta no dia seguinte, relógio para trás não volta', function () {
  var L0 = congela({ dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null });
  assert.deepStrictEqual(IT.podeComprar('torrao', L0, 10, 1000, 1000, 0), { ok: true, restam: 2 });
  var L1 = congela(IT.comprar('torrao', L0, 10));
  assert.deepStrictEqual(L1, { dia: 10, comprados: { torrao: 1, manual: 0, cupom: 0 }, estrelaDia: null });
  assert.deepStrictEqual(IT.podeComprar('torrao', L1, 10, 1000, 1000, 1), { ok: true, restam: 1 });
  var L2 = congela(IT.comprar('torrao', L1, 10));
  assert.deepStrictEqual(IT.podeComprar('torrao', L2, 10, 1000, 1000, 2), { ok: false, motivo: 'limite' }, 'o 3º torrão');
  assert.deepStrictEqual(IT.podeComprar('manual', L2, 10, 1000, 1000, 0), { ok: true, restam: 1 }, 'cada item tem o seu limite');
  var L3 = congela(IT.comprar('cupom', L2, 10));
  assert.deepStrictEqual(IT.podeComprar('cupom', L3, 10, 1000, 1000, 1), { ok: false, motivo: 'limite' });
  assert.deepStrictEqual(IT.podeComprar('torrao', L2, 11, 1000, 1000, 2), { ok: true, restam: 2 }, 'no dia seguinte volta');
  assert.deepStrictEqual(IT.lojaDoDia(L3, 11), { dia: 11, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null });
  // relógio para trás: hoje < loja.dia devolve igual e o limite continua
  var L11 = congela(IT.comprar('torrao', IT.comprar('torrao', L2, 11), 11));
  assert.deepStrictEqual(IT.lojaDoDia(L11, 9), L11); assert.deepStrictEqual(IT.lojaDoDia(L11, 11), L11);
  assert.deepStrictEqual(IT.podeComprar('torrao', L11, 10, 1000, 1000, 4), { ok: false, motivo: 'limite' }, 'voltar o dia não libera');
  assert.deepStrictEqual(IT.comprar('manual', L11, 10).dia, 11, 'compra com o relógio para trás não volta o dia da loja');
  assert.deepStrictEqual(IT.podeComprar('torrao', L11, 12, 1000, 1000, 4), { ok: true, restam: 2 }, 'passando do último dia, volta');
});
test('loja: Estrela a cada 7 dias, Rédea não vende, Sem Ouro, Reservado e mochila cheia', function () {
  var L0 = congela({ dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null });
  assert.deepStrictEqual(IT.podeComprar('estrela', L0, 10, 5000, 5000, 0), { ok: true, restam: 1 });
  var L = congela(IT.comprar('estrela', L0, 10));
  assert.strictEqual(L.estrelaDia, 10);
  for (var dia = 10; dia <= 16; dia++) assert.deepStrictEqual(IT.podeComprar('estrela', L, dia, 5000, 5000, 1), { ok: false, motivo: 'limite', emDias: 17 - dia }, 'dia ' + dia);
  assert.deepStrictEqual(IT.podeComprar('estrela', L, 17, 5000, 5000, 1), { ok: true, restam: 1 });
  assert.strictEqual(IT.podeComprar('estrela', L, 8, 5000, 5000, 1).motivo, 'limite', 'relógio para trás não libera a Estrela');
  assert.deepStrictEqual(IT.podeComprar('redea', L0, 10, 5000, 5000, 0), { ok: false, motivo: 'nao-vende' });
  assert.deepStrictEqual(IT.podeComprar('xyz', L0, 10, 5000, 5000, 0), { ok: false, motivo: 'nao-vende' });
  assert.deepStrictEqual(IT.podeComprar('torrao', L0, 10, 119, 119, 0), { ok: false, motivo: 'sem-ouro' });
  assert.deepStrictEqual(IT.podeComprar('torrao', L0, 10, 120, 120, 0), { ok: true, restam: 2 }, 'o preço exato basta');
  assert.deepStrictEqual(IT.podeComprar('cupom', L0, 10, 300, 249, 0), { ok: false, motivo: 'reservado' }, 'ouro ≥ preço > ouro livre');
  assert.deepStrictEqual(IT.podeComprar('manual', L0, 10, 1000, 1000, 99), { ok: false, motivo: 'cheia' });
  assert.deepStrictEqual(IT.podeComprar('manual', L0, 10, 1000, 1000, 98), { ok: true, restam: 1 });
  assert.deepStrictEqual(L0, { dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null }, 'não muta');
});
test('loja: o limite por dia sai do catálogo (um item novo com perDay também para no limite)', function () {
  // item de teste posto no catálogo só durante o teste: a lista dos limitados não pode ser escrita à mão no itens.js
  G.ITEMS.teste = { id: 'teste', name: 'Item de teste', plural: 'Itens de teste', price: 10, perDay: 1, desc: 'x', origem: 'x' };
  try {
    var L0 = congela({ dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null });
    assert.deepStrictEqual(IT.podeComprar('teste', L0, 10, 1000, 1000, 0), { ok: true, restam: 1 });
    var L1 = congela(IT.comprar('teste', L0, 10));
    assert.strictEqual(L1.comprados.teste, 1, 'a compra conta no limite do item novo');
    assert.deepStrictEqual(IT.podeComprar('teste', L1, 10, 1000, 1000, 1), { ok: false, motivo: 'limite' }, 'a 2ª compra no mesmo dia');
    assert.deepStrictEqual(IT.podeComprar('teste', L1, 11, 1000, 1000, 1), { ok: true, restam: 1 }, 'no dia seguinte volta');
    // limite do item novo ausente do save (save de antes do item): vale o limite, como todo limite corrompido
    assert.deepStrictEqual(IT.podeComprar('teste', congela({ dia: 10, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null }), 10, 1000, 1000, 0), { ok: false, motivo: 'limite' })
  } finally {
    delete G.ITEMS.teste;
  }
  assert.deepStrictEqual(IT.lojaDoDia({ dia: null, comprados: {}, estrelaDia: null }, 10).comprados, { torrao: 0, manual: 0, cupom: 0 }, 'sem o item de teste, os limitados voltam aos três');
});
test('diaLocal: dias inteiros da data, sem ler o relógio', function () {
  assert.strictEqual(IT.diaLocal(1970, 0, 1), 0);
  assert.strictEqual(IT.diaLocal(2026, 10, 16) + 1, IT.diaLocal(2026, 10, 17));
  assert.strictEqual(IT.diaLocal(2026, 11, 31) + 1, IT.diaLocal(2027, 0, 1), 'vira o ano');
  assert.strictEqual(IT.diaLocal(2028, 1, 28) + 2, IT.diaLocal(2028, 2, 1), 'ano bissexto');
  assert.strictEqual(IT.diaLocal(2026, 10, 16), Date.UTC(2026, 10, 16) / 86400000);
  var fonte = require('fs').readFileSync(require('path').join(__dirname, '../src/itens.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/Math\.random|Date\.now|new Date|performance\.now/.test(fonte), 'itens.js não sorteia fora da seed nem lê o relógio');
});
// Entrada malformada: na dúvida, nada é liberado (revisão da Tarefa 1).
var DIAS_RUINS = [NaN, undefined, null, 1.5, '10', Infinity, {}];
test('dia que não é inteiro não libera nada: diária, resgate, loja do dia, compra e registro', function () {
  var d0 = congela({ prox: 0, ciclos: 0, ultimo: null }), sempre = function () { return true; };
  var L = congela({ dia: 10, comprados: { torrao: 2, manual: 1, cupom: 1 }, estrelaDia: 10 });
  var L0 = congela({ dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null });
  DIAS_RUINS.forEach(function (hoje) {
    var nome = 'hoje ' + String(hoje);
    assert.strictEqual(IT.diariaEstado(d0, hoje).pode, false, nome + ': diária não resgata');
    assert.strictEqual(IT.resgatar(d0, hoje, sempre), null, nome + ': resgate recusado');
    assert.deepStrictEqual(IT.lojaDoDia(L, hoje), L, nome + ': compras do dia não zeram');
    assert.deepStrictEqual(IT.lojaDoDia(L0, hoje), L0, nome + ': loja nova fica como está');
    ['torrao', 'manual', 'cupom', 'estrela'].forEach(function (id) {
      assert.deepStrictEqual(IT.podeComprar(id, L0, hoje, 5000, 5000, 0), { ok: false, motivo: 'limite' }, nome + ': ' + id + ' recusado');
    });
    assert.deepStrictEqual(IT.comprar('estrela', L0, hoje), L0, nome + ': registro não grava o dia ruim');
  });
});
test('diária com ultimo corrompido conta como já resgatada (no dia pedido); null é nunca resgatou', function () {
  var sempre = function () { return true; };
  ['x', 2.5, NaN, {}, true, undefined].forEach(function (u) {
    var d = congela({ prox: 3, ciclos: 1, ultimo: u });
    assert.strictEqual(IT.diariaEstado(d, 50).pode, false, 'ultimo ' + String(u) + ': não libera hoje');
    assert.strictEqual(IT.resgatar(d, 50, sempre), null, 'ultimo ' + String(u) + ': resgate recusado hoje');
    // o módulo não guarda nada: sem saber o dia, nenhum hoje libera; o sanitize do game.js grava hojeDia() no lugar
    assert.strictEqual(IT.resgatar(d, 51, sempre), null, 'ultimo ' + String(u) + ': continua recusado até o save ser saneado');
  });
  assert.strictEqual(IT.diariaEstado({ prox: 3, ciclos: 1, ultimo: null }, 50).pode, true, 'null: nunca resgatou');
});
// Rulings 7 e 8: dado de dia ou de limite corrompido não libera nada; null continua sendo "nunca".
var DIAS_LIXO = ['x', -3, 1e9, 2.5, NaN, {}, true];
test('diária que não é objeto ou ultimo fora da faixa: já resgatada hoje', function () {
  var sempre = function () { return true; };
  ['x', 5, undefined, null, [], true].forEach(function (d) {
    assert.strictEqual(IT.diariaEstado(d, 50).pode, false, 'diária ' + JSON.stringify(d) + ': não libera');
    assert.strictEqual(IT.resgatar(d, 50, sempre), null, 'diária ' + JSON.stringify(d) + ': resgate recusado');
  });
  [-3, -1, IT.DIA_MAX + 1, 1e9].forEach(function (u) {
    assert.strictEqual(IT.diariaEstado({ prox: 2, ciclos: 0, ultimo: u }, 50).pode, false, 'ultimo ' + u + ' fora da faixa');
  });
  assert.strictEqual(IT.diariaEstado({ prox: 2, ciclos: 0, ultimo: IT.DIA_MAX }, 50).pode, false, 'DIA_MAX é um dia válido (no futuro)');
  assert.strictEqual(IT.diaLocal(9999, 11, 31), IT.DIA_MAX);
});
test('loja com dia corrompido vale hoje: as compras do dia não voltam', function () {
  DIAS_LIXO.forEach(function (dl) {
    var L = { dia: dl, comprados: { torrao: 2, manual: 1, cupom: 0 }, estrelaDia: null };
    var l = IT.lojaDoDia(L, 10);
    assert.strictEqual(l.dia, 10, 'dia ' + String(dl) + ' vale hoje');
    assert.deepStrictEqual(l.comprados, { torrao: 2, manual: 1, cupom: 0 }, 'dia ' + String(dl) + ': compras mantidas');
    assert.deepStrictEqual(IT.podeComprar('torrao', L, 10, 1000, 1000, 0), { ok: false, motivo: 'limite' }, 'dia ' + String(dl) + ': torrão no limite');
    assert.deepStrictEqual(IT.podeComprar('cupom', L, 10, 1000, 1000, 0), { ok: true, restam: 1 }, 'dia ' + String(dl) + ': o que não foi comprado continua');
  });
  assert.strictEqual(IT.lojaDoDia({ dia: IT.DIA_MAX + 1, comprados: { torrao: 2, manual: 0, cupom: 0 }, estrelaDia: null }, 10).dia, 10, 'acima de DIA_MAX');
});
test('loja com estrelaDia corrompido vale hoje: a Estrela espera os 7 dias', function () {
  DIAS_LIXO.concat([IT.DIA_MAX + 1]).forEach(function (ed) {
    var L = { dia: 10, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: ed };
    assert.strictEqual(IT.lojaDoDia(L, 10).estrelaDia, 10, 'estrelaDia ' + String(ed));
    assert.deepStrictEqual(IT.podeComprar('estrela', L, 10, 5000, 5000, 0), { ok: false, motivo: 'limite', emDias: G.ITEMS.estrela.everyDays }, 'estrelaDia ' + String(ed));
  });
});
test('loja que não é objeto: dia de hoje, compras no teto e Estrela de hoje', function () {
  var teto = { torrao: G.ITEMS.torrao.perDay, manual: G.ITEMS.manual.perDay, cupom: G.ITEMS.cupom.perDay };
  ['x', 5, undefined, null, [], true].forEach(function (L) {
    assert.deepStrictEqual(IT.lojaDoDia(L, 10), { dia: 10, comprados: teto, estrelaDia: 10 }, 'loja ' + JSON.stringify(L));
    ['torrao', 'manual', 'cupom', 'estrela'].forEach(function (id) {
      assert.strictEqual(IT.podeComprar(id, L, 10, 5000, 5000, 0).motivo, 'limite', 'loja ' + JSON.stringify(L) + ': ' + id);
    });
    // o módulo não guarda nada: sem a loja, nenhum hoje libera; o sanitize do game.js grava o dia de hoje no lugar
    assert.strictEqual(IT.podeComprar('torrao', L, 11, 5000, 5000, 0).motivo, 'limite', 'continua recusado até o save ser saneado');
  });
});
test('comprados corrompido vale o teto do dia', function () {
  var L = { dia: 10, comprados: { torrao: 'x', manual: -1, cupom: 5 }, estrelaDia: null };
  assert.deepStrictEqual(IT.lojaDoDia(L, 10).comprados, { torrao: 2, manual: 1, cupom: 1 });
  [{ torrao: 1.5, manual: null, cupom: {} }].forEach(function (c) {
    assert.deepStrictEqual(IT.lojaDoDia({ dia: 10, comprados: c, estrelaDia: null }, 10).comprados, { torrao: 2, manual: 1, cupom: 1 });
  });
  ['x', null, undefined, []].forEach(function (c) {
    assert.deepStrictEqual(IT.lojaDoDia({ dia: 10, comprados: c, estrelaDia: null }, 10).comprados, { torrao: 2, manual: 1, cupom: 1 }, 'comprados ' + JSON.stringify(c));
  });
  assert.deepStrictEqual(IT.lojaDoDia({ dia: 10, comprados: { torrao: 1, manual: 0, cupom: 1 }, estrelaDia: null }, 10).comprados, { torrao: 1, manual: 0, cupom: 1 }, 'valores bons ficam');
});
test('null continua sendo "nunca": diária e loja zeradas liberam tudo', function () {
  assert.strictEqual(IT.diariaEstado({ prox: 0, ciclos: 0, ultimo: null }, 50).pode, true);
  var L0 = { dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null };
  ['torrao', 'manual', 'cupom', 'estrela'].forEach(function (id) { assert.strictEqual(IT.podeComprar(id, L0, 10, 5000, 5000, 0).ok, true, id); });
  assert.deepStrictEqual(IT.lojaDoDia(L0, 10), { dia: 10, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null });
});
test('podeUsar sem cavalo recusa todos os itens', function () {
  ['torrao', 'estrela', 'cupom', 'manual'].forEach(function (id) {
    [null, undefined].forEach(function (m) {
      var r = IT.podeUsar(id, m, CTX);
      assert.strictEqual(r.ok, false, id + ' sem cavalo');
      assert.ok(typeof r.motivo === 'string' && r.motivo.length > 8, id + ' motivo');
    });
  });
});
test('trocarSkill recusa a skill de tipo mesmo dentro das vagas', function () {
  var m = congela(cavIt({ rarity: 'lendario', skills: ['arranque', 'labareda'] }));
  assert.strictEqual(IT.trocarSkill(m, 'labareda', 1, 0), null, 'skill de tipo nas vagas');
  assert.ok(IT.trocarSkill(m, 'arranque', 1, 0), 'a skill comum ao lado troca');
});
test('itens.js usa o saneamento de torrões e a raridade do sim.js', function () {
  assert.strictEqual(typeof S.torroesOf, 'function'); assert.strictEqual(typeof S.rarityOf, 'function');
  assert.strictEqual(S.torroesOf({ torroes: 4 }), 4); assert.strictEqual(S.torroesOf({ torroes: 11 }), 0);
  assert.strictEqual(S.rarityOf({ rarity: 'constructor' }), G.RARITIES.comum);
  var fonte = require('fs').readFileSync(require('path').join(__dirname, '../src/itens.js'), 'utf8');
  assert.ok(/S\.torroesOf\(/.test(fonte) && /S\.rarityOf\(/.test(fonte), 'itens.js chama as do sim.js');
  assert.ok(!/function torroesDe|function vagas/.test(fonte), 'sem cópia própria');
});
test('Estrela de treino diz de onde vem, com os números do catálogo', function () {
  var o = G.ITEMS.estrela.origem;
  assert.ok(o.indexOf(String(G.ITEMS.estrela.everyDays)) >= 0, 'a cada N dias na loja: ' + o);
  assert.ok(o.indexOf(G.DAILY.estrelaACada + 'º') >= 0, 'a cada N calendários: ' + o);
  assert.ok(/loja/.test(o) && /7º dia/.test(o) && !/de tempos em tempos/.test(o), o);
});
test('a origem de cada item cita os ginásios só quando algum ginásio dá o item (Ruling 28 dos ginásios)', function () {
  // a verdade sai do catálogo: o prêmio de alguma etapa de algum ginásio ou o rodízio da revanche do líder
  G.ITENS_USO.forEach(function (id) {
    var daGin = G.GYM_ORDER.some(function (g) { return G.GYMS[g].etapas.some(function (e) { return e.premio.itens.indexOf(id) >= 0 || (id === 'pergaminho' && e.premio.pergaminhos > 0); }); }) ||
      G.GYM.revanche.ciclo.some(function (c) { return c.item === id; });
    assert.strictEqual(/ginásio/.test(G.ITEMS[id].origem), daGin, id + ': ' + G.ITEMS[id].origem);
  });
  // e a recompensa diária continua citada no dia certo, para cada item que ela dá
  G.DAILY.dias.forEach(function (d, i) {
    if (d.item) assert.ok(G.ITEMS[d.item].origem.indexOf((i + 1) + 'º dia') >= 0, d.item + ': ' + G.ITEMS[d.item].origem);
  });
});

test('sanearRanks: 0, 7, "3", NaN e ausente valem 1; inteiro de 1 a 5 fica; rank de skill que o cavalo não tem some', function () {
  var sk = ['sprint', 'drift', 'arranque', 'nascente', 'casco-firme', 'chama-final'];
  assert.deepStrictEqual(IT.sanearRanks(sk, congela({ sprint: 0, drift: 7, arranque: '3', nascente: NaN, 'chama-final': 4, 'segundo-ar': 5, 'nao-existe': 2 })),
    { sprint: 1, drift: 1, arranque: 1, nascente: 1, 'casco-firme': 1, 'chama-final': 4 });
  [1, 2, 3, 4, 5].forEach(function (r) { assert.deepStrictEqual(IT.sanearRanks(['sprint'], { sprint: r }), { sprint: r }); });
  [2.5, -1, null, undefined, Infinity, true, [], {}].forEach(function (v) { assert.deepStrictEqual(IT.sanearRanks(['sprint'], { sprint: v }), { sprint: 1 }, String(v)); });
  // save de antes da v9 (sem skillRanks) ou campo que não é objeto: todas no rank 1, nenhuma perdida
  [undefined, null, 'x', 7, []].forEach(function (rk) { assert.deepStrictEqual(IT.sanearRanks(['sprint', 'drift'], rk), { sprint: 1, drift: 1 }, String(rk)); });
  assert.deepStrictEqual(IT.sanearRanks([], { sprint: 3 }), {}); assert.deepStrictEqual(IT.sanearRanks(null, { sprint: 3 }), {});
  assert.deepStrictEqual(IT.sanearRanks(['sprint', 'nao-existe', 7], { sprint: 2 }), { sprint: 2 }, 'skill fora do catálogo não ganha rank');
  // herdado do Object.prototype não conta como rank
  assert.deepStrictEqual(IT.sanearRanks(['sprint'], Object.create({ sprint: 5 })), { sprint: 1 });
});
test('trocarSkill num rank 4 devolve rankPerdido 4, apaga o rank da que sai e põe a nova no rank 1; as outras ficam', function () {
  var m = congela(cavIt({ skills: ['sprint', 'drift'], skillRanks: { sprint: 4, drift: 3 } }));
  for (var c = 0; c < 30; c++) {
    var r = IT.trocarSkill(m, 'sprint', 99, c);
    assert.strictEqual(r.rankPerdido, 4); assert.strictEqual(r.sai, 'sprint');
    var esp = { drift: 3 }; esp[r.entra] = 1;
    assert.deepStrictEqual(r.skillRanks, esp, 'contador ' + c);
    assert.deepStrictEqual(Object.keys(r.skillRanks).sort(), r.skills.slice().sort());
  }
  // sem skillRanks (save antigo): rankPerdido 1
  assert.strictEqual(IT.trocarSkill(congela(cavIt({ skills: ['sprint'] })), 'sprint', 99, 0).rankPerdido, 1);
  // a troca não sorteia nada a mais: a skill que entra é a mesma de antes dos ranks, para a mesma seed e contador
  var semRank = IT.trocarSkill(congela(cavIt({ skills: ['sprint', 'drift'] })), 'sprint', 99, 7);
  assert.strictEqual(IT.trocarSkill(m, 'sprint', 99, 7).entra, semRank.entra);
});
test('tentarDoma devolve skillRanks: a aprendida no rank 1, as outras como estavam; sem aprender, nada muda', function () {
  var m = congela(cavIt({ skills: ['sprint'], skillRanks: { sprint: 5 } })), viu = { sim: 0, nao: 0 };
  for (var c = 0; c < 60; c++) {
    var r = IT.tentarDoma(m, 5, c);
    if (r.aprendeu) { viu.sim++; var esp = { sprint: 5 }; esp[r.aprendeu] = 1; assert.deepStrictEqual(r.skillRanks, esp); }
    else { viu.nao++; assert.deepStrictEqual(r.skillRanks, { sprint: 5 }); }
  }
  assert.ok(viu.sim > 5 && viu.nao > 5, JSON.stringify(viu));
});
test('podeSubirRank: custo do rank, e cada motivo na ordem (máximo, sala aberta, Ouro, Ouro reservado, Pergaminhos)', function () {
  var m = congela(cavIt({ skills: ['sprint', 'drift'], skillRanks: { sprint: 1, drift: 5 } }));
  var rico = { ouroLivre: 99999, ouro: 99999, pergaminhos: 99, selos: 9, salaAbertaAtivo: false };
  assert.deepStrictEqual(IT.podeSubirRank(m, 'sprint', congela(rico)), { ok: true, custo: { ouro: 150, perg: 1, selo: 0 }, rank: 1 });
  [[1, 150, 1], [2, 400, 2], [3, 900, 4], [4, 2000, 7]].forEach(function (c) {
    var h = cavIt({ skills: ['sprint'], skillRanks: { sprint: c[0] } });
    var selo = c[0] === 4 ? 1 : 0;
    assert.deepStrictEqual(IT.podeSubirRank(h, 'sprint', rico).custo, { ouro: c[1], perg: c[2], selo: selo }, 'rank ' + c[0]);
    // Ouro, Pergaminhos e Selo exatos passam; um a menos não
    assert.strictEqual(IT.podeSubirRank(h, 'sprint', { ouroLivre: c[1], ouro: c[1], pergaminhos: c[2], selos: selo }).ok, true);
    assert.strictEqual(IT.podeSubirRank(h, 'sprint', { ouroLivre: c[1] - 1, ouro: c[1] - 1, pergaminhos: c[2], selos: selo }).motivo, 'Falta Ouro (precisa de ' + (c[1] === 2000 ? '2.000' : c[1]) + ')');
    assert.strictEqual(IT.podeSubirRank(h, 'sprint', { ouroLivre: c[1], ouro: c[1], pergaminhos: c[2] - 1, selos: selo }).motivo, 'Faltam Pergaminhos (precisa de ' + c[2] + ')');
  });
  // rank IV → V sem Selo: motivo "Falta Selo do campeão" (depois do Ouro e dos Pergaminhos)
  var h4 = cavIt({ skills: ['sprint'], skillRanks: { sprint: 4 } });
  assert.strictEqual(IT.podeSubirRank(h4, 'sprint', { ouroLivre: 2000, ouro: 2000, pergaminhos: 7, selos: 0 }).motivo, 'Falta Selo do campeão');
  assert.strictEqual(IT.podeSubirRank(h4, 'sprint', { ouroLivre: 2000, ouro: 2000, pergaminhos: 7 }).motivo, 'Falta Selo do campeão');
  assert.strictEqual(IT.podeSubirRank(h4, 'sprint', { ouroLivre: 2000, ouro: 2000, pergaminhos: 6, selos: 0 }).motivo, 'Faltam Pergaminhos (precisa de 7)');
  assert.deepStrictEqual(IT.podeSubirRank(m, 'drift', rico), { ok: false, motivo: 'Rank máximo', rank: 5 });
  assert.strictEqual(IT.podeSubirRank(m, 'sprint', Object.assign({}, rico, { salaAbertaAtivo: true })).motivo, 'Com o páreo aberto, o cavalo ativo não sobe rank');
  // Foco 3: Ouro exato para o custo, mas parte dele reservada para a entrada da sala aberta (de outro cavalo)
  var res = IT.podeSubirRank(m, 'sprint', { ouroLivre: 50, ouro: 150, pergaminhos: 5, salaAbertaAtivo: false });
  assert.strictEqual(res.ok, false); assert.ok(/guardado para a entrada/.test(res.motivo) && /150/.test(res.motivo), res.motivo);
  // sem contexto, skill que o cavalo não tem, skill de fora do catálogo: recusa com frase
  assert.strictEqual(IT.podeSubirRank(m, 'sprint').ok, false);
  ['arranque', 'nao-existe', 'labareda', undefined].forEach(function (id) { var r = IT.podeSubirRank(m, id, rico); assert.strictEqual(r.ok, false); assert.ok(r.motivo.length > 8); });
  assert.strictEqual(IT.podeSubirRank(null, 'sprint', rico).ok, false);
});
test('subirRank: +1 no rank e o custo a descontar, sem sortear; do 1 ao 5 custa 3.450 de Ouro, 14 Pergaminhos e 1 Selo', function () {
  var h = cavIt({ skills: ['sprint', 'drift'], skillRanks: { sprint: 1, drift: 2 } }), ouro = 0, perg = 0, selo = 0;
  var mr = Math.random, usou = false; Math.random = function () { usou = true; return 0.5; };
  try {
    for (var k = 0; k < 4; k++) {
      var antes = JSON.stringify(h), r = IT.subirRank(congela(cl(h)), 'sprint');
      assert.strictEqual(JSON.stringify(h), antes, 'não muta a montaria');
      assert.deepStrictEqual(r.skillRanks, { sprint: k + 2, drift: 2 });
      ouro += r.ouro; perg += r.perg; selo += r.selo; assert.strictEqual(r.selo, k === 3 ? 1 : 0); h.skillRanks = r.skillRanks;
      assert.deepStrictEqual(IT.subirRank(congela(cl(h)), 'sprint'), IT.subirRank(congela(cl(h)), 'sprint'), 'mesma entrada, mesma saída');
    }
  } finally { Math.random = mr; }
  assert.ok(!usou, 'sem Math.random'); assert.strictEqual(ouro, 3450); assert.strictEqual(perg, 14); assert.strictEqual(selo, 1);
  assert.strictEqual(IT.subirRank(h, 'sprint'), null, 'rank máximo'); assert.strictEqual(IT.subirRank(h, 'arranque'), null); assert.strictEqual(IT.subirRank(null, 'sprint'), null);
  // subir rank sobe o Poder (por isso o cavalo ativo fica bloqueado com o páreo aberto)
  var a = cavIt({ skills: ['sprint'], skillRanks: { sprint: 1 } }), b = cavIt({ skills: ['sprint'], skillRanks: IT.subirRank(a, 'sprint').skillRanks });
  assert.ok(S.powerRating(b) > S.powerRating(a));
});
test('Pergaminho de técnica: no catálogo sem preço nem limite de compra; a loja não lista nem vende', function () {
  var P = G.ITEMS.pergaminho;
  assert.deepStrictEqual({ id: P.id, name: P.name, plural: P.plural, cap: P.cap, podio: P.podio }, { id: 'pergaminho', name: 'Pergaminho de técnica', plural: 'Pergaminhos de técnica', cap: 99, podio: [0.5, 0.3, 0.15] });
  assert.strictEqual(P.price, undefined); assert.strictEqual(P.perDay, undefined); assert.strictEqual(P.everyDays, undefined);
  assert.ok(G.SHOP_ORDER.indexOf('pergaminho') < 0, 'fora da ordem da loja');
  var loja = { dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null };
  assert.deepStrictEqual(IT.podeComprar('pergaminho', loja, 10, 999999, 999999, 0), { ok: false, motivo: 'nao-vende' });
  assert.deepStrictEqual(IT.lojaDoDia(loja, 10).comprados, { torrao: 0, manual: 0, cupom: 0 }, 'não entra nos limites do dia');
  assert.ok(/não está à venda/.test(P.origem) && /pódio/.test(P.origem) && !/Gema/i.test(P.desc + P.origem));
});
test('podeUsar(pergaminho) nunca usa pela mochila: diz que ele é gasto na aba Skills', function () {
  [cavIt(), null].forEach(function (m) {
    var r = IT.podeUsar('pergaminho', m, { tem: 5, ativaComSala: false });
    assert.strictEqual(r.ok, false); assert.ok(/aba Skills/.test(r.motivo) && /rank/.test(r.motivo), r.motivo);
  });
});
test('pergaminhoPodio é determinístico e dá ~50/30/15% em 20.000 seeds (±1,5 p.p.); 4º lugar em diante nunca ganha', function () {
  var N = 20000, c = [0, 0, 0];
  for (var s = 0; s < N; s++) {
    var seed = S.hash2(4242, s);
    for (var pl = 1; pl <= 3; pl++) {
      var x = IT.pergaminhoPodio(seed, pl);
      assert.ok(x === 0 || x === 1); assert.strictEqual(IT.pergaminhoPodio(seed, pl), x, 'mesma seed e lugar, mesmo resultado');
      c[pl - 1] += x;
    }
    [0, 4, 5, 8, -1, 1.5, '1', null, undefined, NaN].forEach(function (pl2) { assert.strictEqual(IT.pergaminhoPodio(seed, pl2), 0, 'lugar ' + pl2); });
  }
  [0.5, 0.3, 0.15].forEach(function (p, i) { assert.ok(Math.abs(c[i] / N - p) < 0.015, (i + 1) + 'º: ' + (100 * c[i] / N).toFixed(1) + '%'); });
  // um sorteio por lugar, independentes: há seeds em que o 3º ganha e o 1º não
  var so3 = 0; for (s = 0; s < 2000; s++) if (IT.pergaminhoPodio(s, 3) && !IT.pergaminhoPodio(s, 1)) so3++;
  assert.ok(so3 > 50, 'independentes: ' + so3);
  // o sal não bate com os outros usos da seed da sala
  assert.strictEqual(IT.SAL_PERGAMINHO, 0x50450000);
  assert.notStrictEqual(IT.pergaminhoPodio(77, 1) + ':' + IT.pergaminhoPodio(78, 1) + ':' + IT.pergaminhoPodio(79, 1) + ':' + IT.pergaminhoPodio(80, 1) + ':' + IT.pergaminhoPodio(81, 1) + ':' + IT.pergaminhoPodio(82, 1), '');
});
test('ginásios dão Pergaminho: 1 nos soldados 2 e 4, 3 no líder, só na 1ª vitória; a revanche não dá e o rodízio não mudou', function () {
  var GN = require('../src/ginasio.js');
  G.GYM_ORDER.forEach(function (gid) {
    assert.deepStrictEqual(G.GYMS[gid].etapas.map(function (e) { return e.premio.pergaminhos; }), [0, 1, 0, 1, 3], gid);
  });
  assert.deepStrictEqual(G.GYM.revanche.ciclo, [{ ouro: 100 }, { item: 'torrao' }, { ouro: 100 }, { item: 'manual' }, { ouro: 100 }, { item: 'cupom' }]);
  function prog(etapa) { var p = GN.sanear(null, 10); p.grama.etapa = etapa; return p; }
  function venceu(n) { return { venceu: true, duelos: [{ a: 0, b: n - 1, vencedor: 'jogador' }] }; }
  function perdeu() { return { venceu: false, duelos: [{ a: 0, b: 0, vencedor: 'adversario' }] }; }
  var pg = [0, 1, 0, 1, 3];
  for (var e = 0; e < 5; e++) {
    var nAdv = G.GYMS.grama.etapas[e].cavalos.length;
    var ac = GN.acerto({ gymId: 'grama', etapa: e, revanche: false, progresso: prog(e), resultado: venceu(nAdv), hoje: 10, timeLen: 1 });
    assert.strictEqual(ac.pergaminhos, pg[e], 'etapa ' + e);
    assert.strictEqual(GN.acerto({ gymId: 'grama', etapa: e, revanche: false, progresso: prog(e), resultado: perdeu(), hoje: 10, timeLen: 1 }).pergaminhos, 0, 'derrota ' + e);
  }
  // líder já vencido: a revanche (vencida ou perdida) não dá Pergaminho
  var rev = GN.acerto({ gymId: 'grama', etapa: 4, revanche: true, progresso: prog(5), resultado: venceu(3), hoje: 10, timeLen: 1 });
  assert.strictEqual(rev.pergaminhos, 0); assert.strictEqual(rev.ouro, 100);
  // mochila sem espaço para os Pergaminhos do prêmio: o desafio não abre (como os outros itens)
  var base = { gymId: 'grama', etapa: 4, progresso: prog(4), hoje: 10, ouroLivre: 9999, timeLen: 1 };
  assert.deepStrictEqual(GN.podeDesafiar(Object.assign({ cabe: function () { return true; } }, base)), { ok: true, revanche: false });
  var pedidos = [];
  assert.deepStrictEqual(GN.podeDesafiar(Object.assign({ cabe: function (id, n) { pedidos.push(id + ':' + n); return id !== 'pergaminho'; } }, base)), { ok: false, motivo: 'cheia' });
  assert.ok(pedidos.indexOf('pergaminho:3') >= 0, pedidos.join());
  assert.deepStrictEqual(GN.podeDesafiar(Object.assign({ cabe: function (id) { return id !== 'pergaminho'; } }, base, { etapa: 0, progresso: prog(0) })), { ok: true, revanche: false }, 'etapa sem Pergaminho não pergunta');
});

// =============================================================================================================
// Ginásios da Expedição (Tarefa 1): as duas entradas novas da simulação, o bônus da chance de skill e o ginasio.js.
// Ruling 1: os números que a calibração (Tarefa 2) mexe são lidos de G.GYM e G.GYMS; só a estrutura é literal.
// =============================================================================================================
section('ginásios: entradas da simulação');
function refRaceCom(seed, extra) {
  var cfg = { seed: seed, recordFrames: false, racers: CAMPO_REF.map(function (h, i) {
    var e = { horse: cl(h), gear: pecasQuaisquer(), name: 'r' + i, isPlayer: i === 0 };
    Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }) };
  return S.simulate(cfg);
}
var PISTA_DUELO = { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 400 }, { type: 'curva', from: 400, to: 800 }, { type: 'reta', from: 800, to: 1000 }, { type: 'subida', from: 1000, to: 1300 }, { type: 'reta', from: 1300, to: 1600 }] };
function dueloSim(seed, extraA, recordFrames) {
  var mk = function () { var h = cl(G.STARTERS[0]); h.level = 10; h.alloc = S.botAlloc(h); return h; };
  var ea = { horse: mk(), name: 'a' }, eb = { horse: mk(), name: 'b' };
  Object.keys(extraA || {}).forEach(function (k) { ea[k] = extraA[k]; });
  return S.simulate({ seed: seed, recordFrames: recordFrames !== false, conditions: PISTA_DUELO, racers: [ea, eb] });
}
test('sim: sem folego e sem statMul o resultado é idêntico (folego 1 e statMul 1 também; fora da faixa vale 1)', function () {
  var diff = [];
  for (var k = 0; k < 20; k++) { var h = refHash(refRaceCom(1001 + k, { folego: 1, statMul: 1 })); if (h !== REF_HASHES[k]) diff.push((1001 + k) + ': ' + h); }
  assert.deepStrictEqual(diff, [], 'folego 1 e statMul 1 mudaram a corrida');
  [{ folego: 0.49 }, { folego: 1.01 }, { folego: 0 }, { folego: -1 }, { folego: NaN }, { folego: '0.7' }, { folego: null }, { folego: Infinity },
    { statMul: 0.89 }, { statMul: 1.11 }, { statMul: 2 }, { statMul: NaN }, { statMul: '1.05' }, { statMul: null }, { statMul: {} }].forEach(function (ex) {
    for (var q = 0; q < 3; q++) assert.strictEqual(refHash(refRaceCom(1001 + q, ex)), REF_HASHES[q], JSON.stringify(ex) + ' devia valer 1 (seed ' + (1001 + q) + ')');
  });
});
test('sim: folego 0.5 larga com meio tanque e cansa antes', function () {
  var base = dueloSim(77), meio = dueloSim(77, { folego: 0.5 });
  assert.strictEqual(base.frames[0].stamina[0], 1);
  assert.strictEqual(meio.frames[0].stamina[0], 0.5, 'a stamina inicial é o fôlego');
  assert.strictEqual(meio.frames[0].stamina[1], 1, 'o outro corredor larga cheio');
  var primeiro = function (res, lim) { for (var f = 0; f < res.frames.length; f++) if (res.frames[f].stamina[0] <= lim) return f; return Infinity; };
  assert.ok(primeiro(meio, 0.2) < primeiro(base, 0.2), 'chega a 20% do tanque antes');
  assert.ok(meio.finishTimes[0] > base.finishTimes[0], 'chega depois: ' + meio.finishTimes[0] + ' × ' + base.finishTimes[0]);
  var tres = dueloSim(77, { folego: 0.75 });
  assert.ok(tres.finishTimes[0] > base.finishTimes[0] && tres.finishTimes[0] < meio.finishTimes[0], 'o meio-termo fica no meio');
});
test('sim: statMul 1.03 sobe os seis status de corrida e não a Sorte; vem antes do statAdd', function () {
  var base = dueloSim(5, {}, false), alto = dueloSim(5, { statMul: 1.03 }, false), comAdd = dueloSim(5, { statMul: 1.03, statAdd: { vel: 10, sorte: 3 } }, false);
  var b = base.racerInfo[0].stats;
  G.STAT_KEYS.forEach(function (k) {
    var esp = k === 'sorte' ? b[k] : Math.min(S.TUNING.statMax, Math.max(1, Math.round(b[k] * 1.03)));
    assert.strictEqual(alto.racerInfo[0].stats[k], esp, k);
  });
  assert.ok(alto.racerInfo[0].stats.vel > b.vel, 'a Velocidade sobe de fato');
  assert.deepStrictEqual(alto.racerInfo[1].stats, base.racerInfo[1].stats, 'o outro corredor não muda');
  assert.strictEqual(comAdd.racerInfo[0].stats.vel, Math.round(b.vel * 1.03) + 10, 'statAdd soma depois do statMul');
  assert.strictEqual(comAdd.racerInfo[0].stats.sorte, b.sorte + 3);
  var baixo = dueloSim(5, { statMul: 0.9 }, false);
  assert.strictEqual(baixo.racerInfo[0].stats.vel, Math.round(b.vel * 0.9), 'statMul 0,9 é aceito');
  var h = cl(G.STARTERS[0]); h.level = 50; h.alloc = { vel: 200 }; h.alloc = S.validAlloc(h, h.alloc);
  var teto = S.simulate({ seed: 1, recordFrames: false, conditions: PISTA_DUELO, racers: [{ horse: h, statMul: 1.1 }, { horse: cl(G.STARTERS[1]) }] });
  assert.ok(teto.racerInfo[0].stats.vel <= S.TUNING.statMax, 'preso no teto');
});
test('learnSkill: bonus ausente não muda nada; com 0.03 a taxa em 4.000 seeds sobe ~3 pontos', function () {
  var m = { element: 'fogo', rarity: 'comum', skills: [] };
  [undefined, 0, NaN, -0.1, 0.21, '0.03', null, Infinity].forEach(function (bn) {
    for (var s = 0; s < 300; s++) {
      var r1 = contaRng(s), r2 = contaRng(s);
      var nova = bn === undefined ? S.learnSkill(m, r1) : S.learnSkill(m, r1, bn);
      assert.strictEqual(nova, learnSkillAntiga(m, r2), 'bonus ' + bn + ' seed ' + s);
      assert.strictEqual(r1.n, r2.n, 'mesmas chamadas de rng (bonus ' + bn + ')');
    }
  });
  var sem = 0, com = 0, N = 4000;
  for (var i = 0; i < N; i++) { if (S.learnSkill(m, S.mulberry32(i))) sem++; if (S.learnSkill(m, S.mulberry32(i), 0.03)) com++; }
  assert.ok(Math.abs(sem / N - S.TUNING.learnChance) < 0.012, 'sem bônus: ' + sem / N);
  assert.ok(Math.abs(com / N - (S.TUNING.learnChance + 0.03)) < 0.012, 'com 0,03: ' + com / N);
  // a ordem é a mesma (1ª chamada: o portão; 2ª, só se aprendeu: a candidata), com o portão em learnChance + bonus
  for (var j = 0; j < 300; j++) {
    var rr = contaRng(j), nova = S.learnSkill(m, rr, 0.03), r0 = S.mulberry32(j), g = r0();
    assert.strictEqual(rr.n, nova ? 2 : 1, 'chamadas de rng com o bônus');
    assert.strictEqual(!!nova, g < S.TUNING.learnChance + 0.03, 'o portão é a 1ª chamada');
    if (nova) { var cands = todasCandidatas('fogo'); assert.strictEqual(nova, cands[Math.floor(r0() * cands.length)], 'a candidata é a 2ª'); }
  }
  assert.strictEqual(S.learnSkill(m, function () { return S.TUNING.learnChance + 0.199; }, 0.2) !== null, true, 'bonus 0,2 (o teto) é aceito');
});

section('ginásio');
var GY; try { GY = require('../src/ginasio.js'); } catch (e) { GY = {}; console.log('  (ginasio.js não carregou: ' + e.message + ')'); }
var CATALOGO = G.STARTERS.concat(G.WILD_HORSES);
function catDe(id) { return CATALOGO.filter(function (h) { return h.id === id; })[0]; }
function progNovo() { return { fogo: { etapa: 0, revDia: null, revVitorias: 0 }, agua: { etapa: 0, revDia: null, revVitorias: 0 }, grama: { etapa: 0, revDia: null, revVitorias: 0 } }; }
function progCom(gym, p) { var o = progNovo(); Object.keys(p).forEach(function (k) { o[gym][k] = p[k]; }); return o; }
var HOJE = 20500;
test('ginásio: catálogo (três ginásios, cinco etapas, times, elementos, bases, entradas, prêmios, fraco)', function () {
  // a sequência da D4 (2026-11-26): Capoeira (Comuns) → Remanso (Mágicos) → Fornalha (Raros), cada um mais forte
  assert.deepStrictEqual(G.GYM_ORDER, ['grama', 'agua', 'fogo']);
  assert.deepStrictEqual(Object.keys(G.GYMS), G.GYM_ORDER);
  var D4 = {
    grama: { raridade: 'comum', times: [1, 1, 2, 2, 3], level: [2, 4, 6, 8, 10], entrada: [10, 15, 20, 25, 50], ouro: [50, 75, 100, 125, 250] },
    agua: { raridade: 'magico', times: [1, 2, 2, 3, 3], level: [14, 17, 20, 23, 26], entrada: [25, 35, 45, 55, 110], ouro: [100, 140, 180, 220, 450] },
    fogo: { raridade: 'magico', times: [2, 2, 3, 3, 3], level: [30, 33, 36, 39, 42], entrada: [40, 55, 70, 85, 170], ouro: [160, 220, 280, 340, 700] }
  };
  var itensD4 = [[], ['torrao'], [], ['manual'], ['redea', 'cupom']], pergD4 = [0, 1, 0, 1, 3], ultimoNivel = 0;
  var nomes = { fogo: ['Fogo', 'Capitã Labareda'], agua: ['Água', 'Mestre Aguaceiro'], grama: ['Grama', 'Dona Capineira'] };
  var fracoEsperado = { fogo: 'agua', agua: 'grama', grama: 'fogo' };
  var patentes = ['Recruta', 'Cabo', 'Sargento', 'Tenente'];
  G.GYM_ORDER.forEach(function (id) {
    var g = G.GYMS[id];
    assert.strictEqual(g.id, id); assert.strictEqual(g.element, id);
    assert.ok(g.name.indexOf(nomes[id][0]) >= 0, id + ' nome: ' + g.name);
    assert.strictEqual(g.lider, nomes[id][1]);
    assert.strictEqual(g.fraco, fracoEsperado[id], id + ' fraco');
    assert.strictEqual(GY.vantagem(g.fraco, g.element), 1, id + ': o fraco vence o ginásio');
    // pista: aceita pelo simulate como está (distância, piso e blocos), com uma curva e uma subida
    var c = S.normalizeConditions({ distance: g.pista.distance, surface: g.pista.surface, weather: 'nublado', blocks: g.pista.blocks });
    assert.strictEqual(c.distance, g.pista.distance); assert.strictEqual(c.surface, g.pista.surface);
    assert.deepStrictEqual(c.blocks, g.pista.blocks, id + ': blocos válidos');
    assert.ok(g.pista.blocks.some(function (b) { return b.type === 'curva'; }) && g.pista.blocks.some(function (b) { return b.type === 'subida'; }), id + ': curva e subida');
    assert.strictEqual(g.etapas.length, 5);
    var n = D4[id];
    assert.strictEqual(g.raridade, n.raridade, id + ' raridade');
    assert.deepStrictEqual(g.etapas.map(function (e) { return e.cavalos.length; }), n.times, id + ' times');
    assert.deepStrictEqual(g.etapas.map(function (e) { return e.lider; }), [false, false, false, false, true]);
    assert.deepStrictEqual(g.etapas.map(function (e) { return e.entrada; }), n.entrada, id + ' entradas');
    assert.deepStrictEqual(g.etapas.map(function (e) { return e.cavalos[0].level; }), n.level, id + ' níveis');
    assert.deepStrictEqual(g.etapas.map(function (e) { return e.premio; }), n.ouro.map(function (o, i) { return { ouro: o, itens: itensD4[i], pergaminhos: pergD4[i] }; }), id + ' prêmios');
    assert.ok(n.level[0] > ultimoNivel, id + ': começa acima do líder do anterior');
    ultimoNivel = n.level[4];
    g.etapas.forEach(function (e, i) {
      assert.ok(typeof e.id === 'string' && e.id.length, id + ' etapa ' + i + ' id');
      if (i < 4) assert.ok(e.nome.indexOf(patentes[i]) === 0, id + ' etapa ' + i + ': ' + e.nome);
      else assert.strictEqual(e.nome, g.lider);
      e.cavalos.forEach(function (cv) {
        var base = catDe(cv.base);
        assert.ok(base, id + ': base ' + cv.base + ' existe no catálogo');
        assert.strictEqual(base.element, id, cv.base + ' é do elemento do ginásio');
        assert.strictEqual(cv.raridade, g.raridade, id + ': o cavalo tem a raridade da casa');
        assert.strictEqual(GY.cavalo(cv).rarity, g.raridade, id + ': o cavalo montado tem a raridade da casa');
        assert.ok(cv.level === Math.floor(cv.level) && cv.level >= 1 && cv.level <= G.ECONOMY.maxLevel, 'nível');
        assert.ok(cv.grau === 1 || cv.grau === 2 || cv.grau === 3, 'estrelas');
      });
    });
    assert.strictEqual(new Set(g.etapas.map(function (e) { return e.id; })).size, 5, 'ids das etapas únicos');
    assert.strictEqual(g.insignia.icone, 'ins-' + id);
    assert.ok(require('fs').existsSync(require('path').join(__dirname, '../assets/arte/icones/ins-' + id + '.png')), 'ícone da insígnia existe');
    assert.ok(typeof g.insignia.name === 'string' && g.insignia.name.length > 3);
  });
  var Y = G.GYM;
  assert.ok(Y.vantagem >= 0.02 && Y.vantagem <= 0.05, 'vantagem de 2% a 5% (spec §12)');
  assert.deepStrictEqual(Y.fadiga.faixas.map(function (f) { return f.id; }), ['apertada', 'normal', 'folgada']);
  assert.deepStrictEqual(Y.fadiga.faixas.map(function (f) { return f.name; }), ['Apertada', 'Normal', 'Folgada']);
  assert.strictEqual(Y.fadiga.faixas[2].ate, null);
  assert.ok(Y.fadiga.faixas[0].ate > 0 && Y.fadiga.faixas[1].ate > Y.fadiga.faixas[0].ate, 'limites crescentes');
  assert.ok(Y.fadiga.faixas[0].perde > Y.fadiga.faixas[1].perde && Y.fadiga.faixas[1].perde > Y.fadiga.faixas[2].perde && Y.fadiga.faixas[2].perde > 0, 'descontos na ordem');
  assert.ok(Y.fadiga.teto > 0 && Y.fadiga.teto <= 0.5, 'teto (o fôlego nunca abaixo de 0,5 na simulação)');
  assert.ok(Y.xp.vence > Y.xp.perde && Y.xp.perde > 0);
  assert.strictEqual(Y.revanche.entrada, 50);
  assert.deepStrictEqual(Y.revanche.ciclo, [{ ouro: 100 }, { item: 'torrao' }, { ouro: 100 }, { item: 'manual' }, { ouro: 100 }, { item: 'cupom' }]);
  assert.deepStrictEqual(Object.keys(Y.insignias), ['fogo', 'agua', 'grama']);
  assert.deepStrictEqual(G.GYM_ORDER.map(function (k) { return Y.insignias[k].tipo; }), ['skill', 'xp', 'ouro']);
  G.GYM_ORDER.forEach(function (k) { assert.ok(Y.insignias[k].valor > 0 && Y.insignias[k].valor <= 0.2, k + ' valor da insígnia'); });
});
test('ginásio: sequência (D4) — abre com a insígnia do anterior; save com etapa vencida continua aberto; fechado recusa antes de pagar', function () {
  assert.strictEqual(GY.anterior('grama'), null); assert.strictEqual(GY.anterior('agua'), 'grama'); assert.strictEqual(GY.anterior('fogo'), 'agua');
  assert.strictEqual(GY.anterior('lava'), null);
  var p0 = progNovo();
  assert.deepStrictEqual(G.GYM_ORDER.map(function (g) { return GY.aberto(g, p0); }), [true, false, false], 'save novo: só a Capoeira');
  assert.deepStrictEqual(G.GYM_ORDER.map(function (g) { return GY.aberto(g, progCom('grama', { etapa: 4 })); }), [true, false, false], 'sem a insígnia ainda não abre');
  var comIns = progCom('grama', { etapa: 5 });
  assert.deepStrictEqual(G.GYM_ORDER.map(function (g) { return GY.aberto(g, comIns); }), [true, true, false], 'insígnia da Capoeira abre o Remanso');
  comIns.agua.etapa = 5;
  assert.deepStrictEqual(G.GYM_ORDER.map(function (g) { return GY.aberto(g, comIns); }), [true, true, true], 'e a do Remanso abre a Fornalha');
  assert.strictEqual(GY.aberto('fogo', progCom('fogo', { etapa: 2 })), true, 'save de antes da regra: etapa vencida continua aberta');
  assert.strictEqual(GY.aberto('lava', p0), false); assert.strictEqual(GY.aberto('fogo', null), false); assert.strictEqual(GY.aberto('grama', 'lixo'), true);
  var pode = GY.podeDesafiar({ gymId: 'agua', etapa: 0, progresso: p0, hoje: HOJE, ouroLivre: 1e6, cabe: function () { return true; }, timeLen: 1 });
  assert.deepStrictEqual(pode, { ok: false, motivo: 'ginasio-fechado' }, 'recusa antes de olhar o Ouro');
  assert.deepStrictEqual(GY.podeDesafiar({ gymId: 'agua', etapa: 0, progresso: progCom('grama', { etapa: 5 }), hoje: HOJE, ouroLivre: 1e6, cabe: function () { return true; }, timeLen: 1 }), { ok: true, revanche: false });
  assert.strictEqual(GY.acerto({ gymId: 'fogo', etapa: 0, revanche: false, progresso: p0, resultado: resMao([[0, 0, 1], [0, 1, 1]], true), hoje: HOJE, timeLen: 1 }), null, 'acerto de ginásio fechado: nada');
});
test('ginásio: vantagem (os nove pares)', function () {
  var esp = { fogo: { fogo: 0, agua: -1, grama: 1 }, agua: { fogo: 1, agua: 0, grama: -1 }, grama: { fogo: -1, agua: 1, grama: 0 } };
  Object.keys(esp).forEach(function (a) { Object.keys(esp[a]).forEach(function (b) { assert.strictEqual(GY.vantagem(a, b), esp[a][b], a + ' × ' + b); }); });
  assert.strictEqual(GY.vantagem('constructor', 'fogo'), 0); assert.strictEqual(GY.vantagem(undefined, null), 0);
});
test('ginásio: faixa (limites meio abertos, Ruling 5) e metros (com chegada empatada)', function () {
  var f = G.GYM.fadiga.faixas;
  var pega = function (m) { return GY.faixa(m); };
  assert.deepStrictEqual(pega(0), { id: 'apertada', name: f[0].name, perde: f[0].perde });
  assert.strictEqual(pega(Math.round((f[0].ate - 0.1) * 10) / 10).id, 'apertada');
  assert.strictEqual(pega(f[0].ate).id, 'normal');
  assert.strictEqual(pega(Math.round((f[1].ate - 0.1) * 10) / 10).id, 'normal');
  assert.deepStrictEqual(pega(f[1].ate), { id: 'folgada', name: f[2].name, perde: f[2].perde });
  assert.strictEqual(pega(5000).id, 'folgada');
  // os pontos do resumo (4,9 / 5 / 19,9 / 20), com os limites de partida
  // (com os limites calibrados na Tarefa 2, 1 e 8 m, esta conferência se desliga sozinha; as de cima seguem os limites do catálogo)
  if (f[0].ate === 5 && f[1].ate === 20) assert.deepStrictEqual([4.9, 5, 19.9, 20].map(function (m) { return pega(m).id; }), ['apertada', 'normal', 'normal', 'folgada']);
  // metros: (tPerdedor − tVencedor) × distância / tPerdedor, uma casa
  assert.strictEqual(GY.metros({ finishOrder: [1, 0], finishTimes: [62, 60], conditions: { distance: 1200 } }), 38.7);
  assert.strictEqual(GY.metros({ finishOrder: [0, 1], finishTimes: [60, 60.1], conditions: { distance: 1200 } }), 2);
  var empate = { finishOrder: [0, 1], finishTimes: [60, 60], conditions: { distance: 1200 } };
  assert.strictEqual(GY.metros(empate), 0, 'chegada empatada');
  assert.strictEqual(GY.faixa(GY.metros(empate)).id, 'apertada');
  var semTempo = { finishOrder: [0, 1], finishTimes: [60, null], conditions: { distance: 1200 } };
  assert.doesNotThrow(function () { GY.metros(semTempo); });
  assert.strictEqual(GY.faixa(GY.metros(semTempo)).id, 'folgada', 'perdedor sem tempo vale a maior faixa');
  // qualquer tempo ausente (do vencedor ou dos dois) também cai na faixa folgada
  [[null, 60], [null, null], [undefined, 61], [NaN, 60], ['60', 61]].forEach(function (ts) {
    var r = { finishOrder: [0, 1], finishTimes: ts, conditions: { distance: 1200 } };
    assert.doesNotThrow(function () { GY.metros(r); });
    assert.strictEqual(GY.faixa(GY.metros(r)).id, 'folgada', 'tempos ' + JSON.stringify(ts));
  });
  [null, undefined, {}, { finishOrder: [0] }, 'x'].forEach(function (r) { assert.doesNotThrow(function () { GY.metros(r); }); assert.strictEqual(GY.metros(r), 0); });
  // num duelo de verdade, bate com a conta
  var res = dueloSim(9, {}, false), w = res.finishOrder[0], l = res.finishOrder[1];
  assert.strictEqual(GY.metros(res), Math.round((res.finishTimes[l] - res.finishTimes[w]) * res.conditions.distance / res.finishTimes[l] * 10) / 10);
});
test('ginásio: cavalo (a base do catálogo no nível e nas estrelas, com a build dos bots)', function () {
  var antes = JSON.stringify(CATALOGO);
  var h = GY.cavalo({ base: 'brasa', level: 12, grau: 3 });
  var esp = cl(catDe('brasa')); esp.level = 12; esp.grau = 3; esp.alloc = S.botAlloc(esp); esp.skillRanks = {};
  assert.deepStrictEqual(h, esp);
  assert.strictEqual(JSON.stringify(CATALOGO), antes, 'não altera o catálogo');
  h.skills.push('x'); assert.deepStrictEqual(catDe('brasa').skills, [], 'devolve uma cópia');
  assert.strictEqual(GY.cavalo({ base: 'nao-existe', level: 3, grau: 2 }), null);
  assert.strictEqual(GY.cavalo(null), null);
});
function timeDe(defs) { return defs.map(function (d) { return GY.cavalo({ base: d[0], level: d[1], grau: d[2] || 2 }); }); }
// confere a sequência de duelos pela regra: quem perde sai, quem vence fica, o fôlego cai pela faixa e para no teto
function confereSequencia(r, nTime, nAdv, msg) {
  var teto = G.GYM.fadiga.teto, i = 0, j = 0, pa = 0, pb = 0;
  r.duelos.forEach(function (d, k) {
    assert.strictEqual(d.a, i, msg + ' duelo ' + k + ' a'); assert.strictEqual(d.b, j, msg + ' duelo ' + k + ' b');
    assert.ok(Math.abs(d.folegoA - Math.max(1 - teto, 1 - pa)) < 1e-6, msg + ' folegoA ' + d.folegoA + ' × ' + (1 - pa));
    assert.ok(Math.abs(d.folegoB - Math.max(1 - teto, 1 - pb)) < 1e-6, msg + ' folegoB');
    assert.strictEqual(d.cfg.racers[0].folego, d.folegoA); assert.strictEqual(d.cfg.racers[1].folego, d.folegoB);
    assert.deepStrictEqual(d.faixa, GY.faixa(d.metros));
    if (d.vencedor === 'jogador') { pa += d.faixa.perde; pb = 0; j++; } else { assert.strictEqual(d.vencedor, 'adversario'); pb += d.faixa.perde; pa = 0; i++; }
  });
  assert.ok(i === nTime || j === nAdv, msg + ': acaba quando um lado fica sem cavalos');
  assert.ok(!(i === nTime && j === nAdv), msg + ': só um lado zera');
  assert.strictEqual(r.venceu, j === nAdv, msg + ': venceu só com o adversário sem cavalos');
  assert.strictEqual(r.duelos.length, i + j);
}
test('ginásio: resolver — quem perde sai, o fôlego cai pela faixa e soma, vantagem, clima e pista da casa', function () {
  var visto = { jogador: 0, adversario: 0, faixas: {} };
  G.GYM_ORDER.forEach(function (gid) {
    var gym = G.GYMS[gid];
    var time = timeDe([['mare', gym.etapas[4].cavalos[0].level], ['ipe', gym.etapas[4].cavalos[0].level], ['brasa', gym.etapas[4].cavalos[0].level]]);
    for (var c = 0; c < 12; c++) {
      var r = GY.resolver({ gymId: gid, etapa: 4, time: time, seedBase: 4242, contador: c });
      confereSequencia(r, 3, 3, gid + ' contador ' + c);
      r.duelos.forEach(function (d) {
        visto[d.vencedor]++; visto.faixas[d.faixa.id] = 1;
        var meu = time[d.a].element, v = GY.vantagem(meu, gid);
        assert.strictEqual(d.vantagem, v);
        assert.strictEqual(d.cfg.racers[0].statMul, v === 1 ? 1 + G.GYM.vantagem : 1, 'vantagem do jogador');
        assert.strictEqual(d.cfg.racers[1].statMul, v === -1 ? 1 + G.GYM.vantagem : 1, 'vantagem do adversário');
        assert.strictEqual(d.cfg.conditions.weather, 'nublado');
        assert.strictEqual(d.cfg.conditions.distance, gym.pista.distance);
        assert.strictEqual(d.cfg.conditions.surface, gym.pista.surface);
        assert.deepStrictEqual(d.cfg.conditions.blocks, gym.pista.blocks);
        assert.strictEqual(d.cfg.recordFrames, false, 'cfg sem quadros');
        assert.deepStrictEqual(d.cfg.racers[1].horse, GY.cavalo(gym.etapas[4].cavalos[d.b]), 'o cavalo fixo da etapa');
        var de = S.simulate(d.cfg);
        assert.strictEqual(de.finishOrder[0] === 0 ? 'jogador' : 'adversario', d.vencedor, 'o cfg reproduz o duelo');
        assert.strictEqual(GY.metros(de), d.metros);
      });
    }
  });
  assert.ok(visto.jogador > 5 && visto.adversario > 5, 'os dois lados vencem duelos: ' + JSON.stringify(visto));
  assert.ok(Object.keys(visto.faixas).length >= 2, 'mais de uma faixa aparece');
});
test('ginásio: resolver — o fôlego soma e para no teto; time de 1 contra 3', function () {
  var forte = timeDe([['mare', 50, 3]]), fraco = timeDe([['w-lambari', 1, 1]]);
  var achou3 = false;
  for (var c = 0; c < 20; c++) {
    var r = GY.resolver({ gymId: 'grama', etapa: 4, time: forte, seedBase: 7, contador: c });
    confereSequencia(r, 1, 3, 'forte ' + c);
    if (r.venceu) { achou3 = true; assert.strictEqual(r.duelos.length, 3); assert.deepStrictEqual(r.duelos.map(function (d) { return d.b; }), [0, 1, 2]); }
    var rf = GY.resolver({ gymId: 'grama', etapa: 4, time: fraco, seedBase: 7, contador: c });
    assert.strictEqual(rf.venceu, false); assert.strictEqual(rf.duelos.length, 1, 'o fraco perde e o desafio acaba');
  }
  assert.ok(achou3, 'um cavalo sozinho vence os três');
  // teto: com descontos grandes, a 3ª largada fica em 1 − teto
  var guarda = G.GYM.fadiga.faixas.map(function (f) { return f.perde; });
  try {
    G.GYM.fadiga.faixas.forEach(function (f) { f.perde = 0.3; });
    var viu = false;
    for (var k = 0; k < 30 && !viu; k++) {
      var rt = GY.resolver({ gymId: 'grama', etapa: 4, time: forte, seedBase: 11, contador: k });
      confereSequencia(rt, 1, 3, 'teto ' + k);
      if (rt.duelos.length === 3 && rt.duelos[2].a === 0) {
        viu = true;
        assert.ok(Math.abs(rt.duelos[1].folegoA - 0.7) < 1e-9, '2ª largada: 1 − 0,3');
        assert.strictEqual(rt.duelos[2].folegoA, 1 - G.GYM.fadiga.teto, '3ª largada: no teto');
      }
    }
    assert.ok(viu, 'achou uma 3ª largada do mesmo cavalo');
  } finally { G.GYM.fadiga.faixas.forEach(function (f, i) { f.perde = guarda[i]; }); }
});
test('ginásio: resolver — determinismo, seed por (contador, duelo), sal próprio; entrada malformada devolve null', function () {
  var time = congela(timeDe([['brasa', 12], ['w-faisca', 12]]));
  var e = { gymId: 'grama', etapa: 2, time: time, seedBase: 99, contador: 5 };
  var a = GY.resolver(e), b = GY.resolver(e);
  assert.deepStrictEqual(a, b, 'mesma entrada, mesmo resultado');
  a.duelos.forEach(function (d, k) { assert.strictEqual(d.cfg.seed, S.hash2(99, GY.SAL + 5 * 8 + k)); });
  assert.strictEqual(GY.SAL, 0x47490000); assert.notStrictEqual(GY.SAL, IT.SAL, 'sal diferente do itens.js');
  var seeds = new Set(); for (var c = 0; c < 200; c++) for (var d = 0; d < 5; d++) seeds.add(S.hash2(99, GY.SAL + c * 8 + d));
  assert.strictEqual(seeds.size, 1000, 'cada (contador, duelo) tem a sua seed');
  var outros = 0; for (var c2 = 0; c2 < 10; c2++) if (JSON.stringify(GY.resolver({ gymId: 'grama', etapa: 2, time: time, seedBase: 99, contador: c2 }).duelos.map(function (x) { return x.vencedor + x.metros; })) !== JSON.stringify(a.duelos.map(function (x) { return x.vencedor + x.metros; }))) outros++;
  assert.ok(outros >= 3, 'contadores diferentes dão desafios diferentes');
  var ruins = [null, undefined, 'x', {},
    { gymId: 'lava', etapa: 2, time: time, seedBase: 99, contador: 5 }, { gymId: 'constructor', etapa: 2, time: time, seedBase: 99, contador: 5 },
    { gymId: 'grama', etapa: 5, time: time, seedBase: 99, contador: 5 }, { gymId: 'grama', etapa: -1, time: time, seedBase: 99, contador: 5 }, { gymId: 'grama', etapa: 1.5, time: time, seedBase: 99, contador: 5 },
    { gymId: 'grama', etapa: 2, time: [], seedBase: 99, contador: 5 }, { gymId: 'grama', etapa: 0, time: time, seedBase: 99, contador: 5 },
    { gymId: 'grama', etapa: 2, time: [time[0], null], seedBase: 99, contador: 5 }, { gymId: 'grama', etapa: 0, time: [{ element: 'agua', skills: 'x' }], seedBase: 99, contador: 5 }, { gymId: 'grama', etapa: 2, time: 'xy', seedBase: 99, contador: 5 },
    { gymId: 'grama', etapa: 2, time: time, seedBase: NaN, contador: 5 }, { gymId: 'grama', etapa: 2, time: time, seedBase: '99', contador: 5 },
    { gymId: 'grama', etapa: 2, time: time, seedBase: 99, contador: -1 }, { gymId: 'grama', etapa: 2, time: time, seedBase: 99, contador: 2.5 }, { gymId: 'grama', etapa: 2, time: time, seedBase: 99 }];
  ruins.forEach(function (x, k) { assert.strictEqual(GY.resolver(x), null, 'malformada ' + k); });
  assert.doesNotThrow(function () { GY.resolver({ gymId: 'grama', etapa: 0, time: [{}], seedBase: 1, contador: 0 }); }, 'cavalo vazio não quebra');
});
test('ginásio: resolver dá o mesmo desafio antes e depois da extração do dueloCfg (20 desafios gravados antes de mexer)', function () {
  var h = crypto.createHash('sha256'), gyms = ['grama', 'agua', 'grama'];
  for (var c = 0; c < 20; c++) {
    var time = timeDe([[['mare', 'ipe', 'brasa'][c % 3], 14 + c], ['w-faisca', 10 + c], [['brasa', 'mare', 'ipe'][c % 3], 20]]);
    var et = c % 5, n = [1, 1, 2, 2, 3][et];
    h.update(JSON.stringify(GY.resolver({ gymId: gyms[c % 3], etapa: et, time: time.slice(0, n), seedBase: 1000 + c * 7, contador: c * 3 })));
  }
  assert.strictEqual(h.digest('hex'), 'ba136b279057514027477edfa1fa1e93912bd77296bb248a6685ad70e8aae932');   // regravado na D4 (2026-11-26): oponentes novos; era 2a2d65ed…
});
test('ginásio: dueloCfg com fôlego 1 e sem peças monta 2 corredores com o statMul da vantagem, Nublado e a pista dada', function () {
  var meu = congela(timeDe([['mare', 10]])[0]), dele = congela(timeDe([['brasa', 10]])[0]), pista = congela(JSON.parse(JSON.stringify(G.GYMS.grama.pista)));
  var c = GY.dueloCfg(meu, dele, 123, { pista: pista });
  assert.strictEqual(c.seed, 123); assert.strictEqual(c.recordFrames, false); assert.strictEqual(c.racers.length, 2);
  assert.deepStrictEqual(c.conditions, { distance: pista.distance, surface: pista.surface, weather: 'nublado', blocks: pista.blocks });
  assert.notStrictEqual(c.conditions.blocks, pista.blocks, 'cópia da pista');
  assert.deepStrictEqual(c.racers[0], { horse: meu, name: meu.name, isPlayer: true, folego: 1, statMul: 1 + G.GYM.vantagem });
  assert.deepStrictEqual(c.racers[1], { horse: dele, name: dele.name, isPlayer: false, folego: 1, statMul: 1 });
  var inv = GY.dueloCfg(dele, meu, 5, { pista: pista, folegoMeu: 0.75, folegoDele: 0.9, recordFrames: true });
  assert.strictEqual(inv.racers[0].statMul, 1); assert.strictEqual(inv.racers[1].statMul, 1 + G.GYM.vantagem);
  assert.strictEqual(inv.racers[0].folego, 0.75); assert.strictEqual(inv.racers[1].folego, 0.9); assert.strictEqual(inv.recordFrames, true);
  var igual = GY.dueloCfg(meu, meu, 5, { pista: pista });
  assert.strictEqual(igual.racers[0].statMul, 1); assert.strictEqual(igual.racers[1].statMul, 1);
  assert.ok(S.simulate(c).finishOrder.length === 2, 'a config corre');
});
// resultado montado à mão: [a, b, quem venceu]
function resMao(lista, venceu) { return { venceu: venceu, duelos: lista.map(function (x) { return { a: x[0], b: x[1], vencedor: x[2] ? 'jogador' : 'adversario', metros: 10, faixa: GY.faixa(10) }; }) }; }
test('ginásio: acerto — prêmio só na 1ª vitória, derrota só XP, XP por duelo, insígnia na etapa 5', function () {
  var X = G.GYM.xp, P = G.GYMS.grama.etapas;
  var p0 = congela(progNovo());
  var v = GY.acerto({ gymId: 'grama', etapa: 0, revanche: false, progresso: p0, resultado: resMao([[0, 0, 1]], true), hoje: HOJE, timeLen: 1 });
  assert.deepStrictEqual(v, { ouro: P[0].premio.ouro, itens: [], pergaminhos: 0, xp: [X.vence], progresso: progCom('grama', { etapa: 1 }), insignia: false });
  var de2 = GY.acerto({ gymId: 'grama', etapa: 0, revanche: false, progresso: congela(progCom('grama', { etapa: 1 })), resultado: resMao([[0, 0, 1]], true), hoje: HOJE, timeLen: 1 });
  assert.strictEqual(de2, null, 'etapa já vencida: nada (nem XP) — Ruling 7');
  var it = GY.acerto({ gymId: 'agua', etapa: 1, revanche: false, progresso: progCom('agua', { etapa: 1 }), resultado: resMao([[0, 0, 1]], true), hoje: HOJE, timeLen: 1 });
  assert.deepStrictEqual([it.ouro, it.itens, it.progresso.agua.etapa], [G.GYMS.agua.etapas[1].premio.ouro, ['torrao'], 2]);
  var perde = GY.acerto({ gymId: 'grama', etapa: 2, revanche: false, progresso: progCom('grama', { etapa: 2 }), resultado: resMao([[0, 0, 1], [0, 1, 0], [1, 1, 0]], false), hoje: HOJE, timeLen: 2 });
  assert.deepStrictEqual(perde, { ouro: 0, itens: [], pergaminhos: 0, xp: [X.vence + X.perde, X.perde], progresso: progCom('grama', { etapa: 2 }), insignia: false });
  var lider = GY.acerto({ gymId: 'grama', etapa: 4, revanche: false, progresso: progCom('grama', { etapa: 4 }), resultado: resMao([[0, 0, 1], [0, 1, 0], [1, 1, 1], [1, 2, 1]], true), hoje: HOJE, timeLen: 3 });
  assert.deepStrictEqual(lider, { ouro: G.GYMS.grama.etapas[4].premio.ouro, itens: ['redea', 'cupom'], pergaminhos: 3, xp: [X.vence + X.perde, 2 * X.vence, 0], progresso: progCom('grama', { etapa: 5 }), insignia: true });
  var fechada = GY.acerto({ gymId: 'grama', etapa: 3, revanche: false, progresso: progNovo(), resultado: resMao([[0, 0, 1], [0, 1, 1]], true), hoje: HOJE, timeLen: 2 });
  assert.strictEqual(fechada, null, 'etapa fechada: nada (nem XP) — Ruling 7');
  // hoje é obrigatório sempre (Ruling 7)
  assert.strictEqual(GY.acerto({ gymId: 'grama', etapa: 0, revanche: false, progresso: progNovo(), resultado: resMao([[0, 0, 1]], true), timeLen: 1 }), null, 'sem hoje');
});
test('ginásio: acerto — só o desafio que o podeDesafiar permitiria quanto à etapa e à revanche (Ruling 7)', function () {
  var R = resMao([[0, 0, 1]], true), Rp = resMao([[0, 0, 0]], false);
  var ac = function (o) { return GY.acerto(Object.assign({ gymId: 'grama', etapa: 0, revanche: false, progresso: progNovo(), resultado: R, hoje: HOJE, timeLen: 1 }, o)); };
  assert.ok(ac({}), 'o caso válido acerta');
  // hoje não inteiro: null em qualquer caso
  [undefined, null, NaN, 1.5, '20500', Infinity].forEach(function (h) {
    assert.strictEqual(ac({ hoje: h }), null, 'fora da revanche, hoje ' + h);
    assert.strictEqual(ac({ hoje: h, resultado: Rp }), null, 'derrota, hoje ' + h);
    assert.strictEqual(ac({ hoje: h, etapa: 4, revanche: true, progresso: progCom('grama', { etapa: 5 }) }), null, 'revanche, hoje ' + h);
  });
  // fora da revanche: só a próxima etapa não vencida, vencendo ou perdendo
  for (var pe = 0; pe <= 5; pe++) for (var et = 0; et <= 4; et++) {
    var n = G.GYMS.grama.etapas[et].cavalos.length;
    [R, Rp].forEach(function (res) {
      var r = ac({ etapa: et, progresso: progCom('grama', { etapa: pe }), resultado: res, timeLen: n });
      if (et === pe) assert.ok(r, 'etapa ' + et + ' com progresso ' + pe + ' acerta');
      else assert.strictEqual(r, null, 'etapa ' + et + ' com progresso ' + pe + ' (' + (et < pe ? 'vencida' : 'fechada') + ')');
    });
  }
  // revanche que não bate com o progresso
  assert.strictEqual(ac({ etapa: 4, revanche: false, progresso: progCom('grama', { etapa: 5, revDia: HOJE - 1 }), timeLen: 3 }), null, 'false com o líder vencido');
  assert.strictEqual(ac({ etapa: 4, revanche: true, progresso: progCom('grama', { etapa: 4 }), timeLen: 3 }), null, 'true sem o líder vencido');
  [0, 1, 2, 3].forEach(function (et) { assert.strictEqual(ac({ etapa: et, revanche: true, progresso: progCom('grama', { etapa: 5 }) }), null, 'revanche na etapa ' + et); });
  // revanche: nenhuma tentativa hoje (mesma regra do podeDesafiar)
  var rev = function (p, res) { return ac({ etapa: 4, revanche: true, progresso: progCom('grama', Object.assign({ etapa: 5 }, p)), resultado: res || R }); };
  assert.ok(rev({ revDia: null }), 'nunca tentou');
  assert.ok(rev({ revDia: HOJE - 1 }), 'tentou ontem');
  [HOJE, HOJE + 3, 'lixo', -5, 1.5, {}, undefined, 1e15].forEach(function (d) {
    assert.strictEqual(rev({ revDia: d }), null, 'já tentou hoje / relógio para trás / dia estragado: ' + d);
    assert.strictEqual(rev({ revDia: d }, Rp), null, 'mesmo perdendo: ' + d);
  });
  // o dia estragado de outro ginásio continua igual depois de um acerto válido (com hoje): vale hoje, nunca DIA_MAX
  var outro = progNovo(); outro.agua = { etapa: 5, revDia: 'x', revVitorias: 2 };
  var a = ac({ progresso: outro });
  assert.deepStrictEqual(a.progresso.agua, { etapa: 5, revDia: HOJE, revVitorias: 2 });
  assert.deepStrictEqual(GY.podeDesafiar({ gymId: 'agua', etapa: 4, progresso: a.progresso, hoje: HOJE + 1, ouroLivre: 1000, cabe: function () { return true; }, timeLen: 1 }), { ok: true, revanche: true }, 'no dia seguinte libera');
});
test('ginásio: acerto — rodízio da revanche por revVitorias; o dia é gravado vencendo ou perdendo', function () {
  var C = G.GYM.revanche.ciclo;
  for (var k = 0; k < 8; k++) {
    var pr = congela(progCom('grama', { etapa: 5, revDia: HOJE - 1, revVitorias: k }));
    var r = GY.acerto({ gymId: 'grama', etapa: 4, revanche: true, progresso: pr, resultado: resMao([[0, 0, 1], [0, 1, 1], [0, 2, 1]], true), hoje: HOJE, timeLen: 1 });
    var p = C[k % C.length];
    assert.strictEqual(r.ouro, p.ouro || 0, 'vitória ' + k); assert.deepStrictEqual(r.itens, p.item ? [p.item] : []);
    assert.deepStrictEqual(r.progresso.grama, { etapa: 5, revDia: HOJE, revVitorias: k + 1 });
    assert.strictEqual(r.insignia, false); assert.deepStrictEqual(r.xp, [3 * G.GYM.xp.vence]);
    var d = GY.acerto({ gymId: 'grama', etapa: 4, revanche: true, progresso: pr, resultado: resMao([[0, 0, 0]], false), hoje: HOJE, timeLen: 1 });
    assert.deepStrictEqual([d.ouro, d.itens, d.progresso.grama], [0, [], { etapa: 5, revDia: HOJE, revVitorias: k }], 'derrota grava o dia');
  }
  var pr5 = progCom('grama', { etapa: 5, revDia: null, revVitorias: 0 });
  [undefined, null, 1.5, '20500', NaN].forEach(function (h) {
    assert.strictEqual(GY.acerto({ gymId: 'grama', etapa: 4, revanche: true, progresso: pr5, resultado: resMao([[0, 0, 0]], false), hoje: h, timeLen: 1 }), null, 'revanche sem dia: ' + h);
  });
  assert.strictEqual(GY.acerto({ gymId: 'grama', etapa: 4, revanche: true, progresso: progCom('grama', { etapa: 4 }), resultado: resMao([[0, 0, 0]], false), hoje: HOJE, timeLen: 1 }), null, 'revanche sem a insígnia');
  assert.strictEqual(GY.acerto({ gymId: 'grama', etapa: 3, revanche: true, progresso: pr5, resultado: resMao([[0, 0, 0]], false), hoje: HOJE, timeLen: 1 }), null, 'revanche fora do líder');
});
test('ginásio: revanchePremio — o prêmio de hoje do rodízio é o que o acerto paga (Ruling 26)', function () {
  var C = G.GYM.revanche.ciclo;
  assert.strictEqual(typeof GY.revanchePremio, 'function', 'revanchePremio exportada');
  for (var n = 0; n <= 12; n++) {
    var p = GY.revanchePremio(n);
    assert.deepStrictEqual(p, C[n % C.length], 'revVitorias ' + n);
    G.GYM_ORDER.forEach(function (id) {
      var pr = congela(progCom(id, { etapa: 5, revDia: HOJE - 1, revVitorias: n }));
      var r = GY.acerto({ gymId: id, etapa: 4, revanche: true, progresso: pr, resultado: resMao([[0, 0, 1], [0, 1, 1], [0, 2, 1]], true), hoje: HOJE, timeLen: 1 });
      assert.strictEqual(r.ouro, p.ouro || 0, id + ': Ouro pago com revVitorias ' + n);
      assert.deepStrictEqual(r.itens, p.item ? [p.item] : [], id + ': item pago com revVitorias ' + n);
    });
  }
  // entrada estranha: o comportamento de hoje, só fixado (o jogo só passa revVitorias saneado, inteiro ≥ 0)
  [-1, -6, 1.5, NaN, undefined, null, '2'].forEach(function (x) {
    var esperado = C[x % C.length];
    assert.deepStrictEqual(GY.revanchePremio(x), esperado, 'revanchePremio(' + String(x) + ')');
  });
  assert.strictEqual(GY.revanchePremio(-1), undefined, 'negativo: nenhum prêmio');
  assert.strictEqual(GY.revanchePremio(1.5), undefined, 'não inteiro: nenhum prêmio');
  assert.strictEqual(GY.revanchePremio(undefined), undefined, 'undefined: nenhum prêmio');
  assert.deepStrictEqual(GY.revanchePremio(null), C[0], 'null vale 0');
  assert.deepStrictEqual(GY.revanchePremio('2'), C[2], 'texto numérico vale o número');
});
test('ginásio: acerto — timeLen e resultado malformados devolvem null; não altera a entrada', function () {
  var ok = { gymId: 'grama', etapa: 4, revanche: false, progresso: progCom('grama', { etapa: 4 }), resultado: resMao([[0, 0, 1], [0, 1, 0], [1, 1, 0]], false), hoje: HOJE, timeLen: 2 };
  assert.ok(GY.acerto(ok));
  var com = function (k, v) { var o = {}; Object.keys(ok).forEach(function (q) { o[q] = ok[q]; }); o[k] = v; return o; };
  [0, 4, 1, 1.5, '2', undefined, NaN].forEach(function (t) { assert.strictEqual(GY.acerto(com('timeLen', t)), null, 'timeLen ' + t); });
  assert.strictEqual(GY.acerto({ gymId: 'grama', etapa: 0, revanche: false, progresso: progNovo(), resultado: resMao([[0, 0, 1]], true), hoje: HOJE, timeLen: 2 }), null, 'maior que o time do adversário');
  [null, {}, { venceu: true }, { venceu: true, duelos: [] }, { venceu: 'sim', duelos: [{ a: 0, b: 0, vencedor: 'jogador' }] },
    { venceu: false, duelos: [{ a: 'x', b: 0, vencedor: 'adversario' }] }, { venceu: false, duelos: [{ a: 0, b: 0, vencedor: 'ninguem' }] },
    { venceu: false, duelos: [{ a: 0, b: 9, vencedor: 'adversario' }] }, { venceu: false, duelos: [null] }].forEach(function (rr, k) {
    assert.strictEqual(GY.acerto(com('resultado', rr)), null, 'resultado ruim ' + k);
  });
  [null, 'lava', 'constructor'].forEach(function (g) { assert.strictEqual(GY.acerto(com('gymId', g)), null, 'gymId ' + g); });
  [-1, 5, 2.5, '4'].forEach(function (e) { assert.strictEqual(GY.acerto(com('etapa', e)), null, 'etapa ' + e); });
  var cong = congela(JSON.parse(JSON.stringify(ok)));
  assert.doesNotThrow(function () { GY.acerto(cong); });
  // o resultado de verdade do resolver serve de entrada
  var time = timeDe([['mare', 20], ['ipe', 20]]);
  var res = GY.resolver({ gymId: 'grama', etapa: 3, time: time, seedBase: 3, contador: 1 });
  var ac = GY.acerto({ gymId: 'grama', etapa: 3, revanche: false, progresso: progCom('grama', { etapa: 3 }), resultado: res, hoje: HOJE, timeLen: 2 });
  assert.strictEqual(ac.xp.length, 2);
  assert.strictEqual(ac.xp.reduce(function (s, x) { return s + x; }, 0), res.duelos.reduce(function (s, d) { return s + (d.vencedor === 'jogador' ? G.GYM.xp.vence : G.GYM.xp.perde); }, 0));
  assert.strictEqual(ac.progresso.grama.etapa, res.venceu ? 4 : 3);
});
test('ginásio: podeDesafiar — cada motivo; a revanche uma vez por dia; relógio para trás e dia estragado não liberam', function () {
  var base = { gymId: 'grama', etapa: 0, progresso: progNovo(), hoje: HOJE, ouroLivre: 1000, cabe: function () { return true; }, timeLen: 1 };
  var com = function (o) { var x = {}; Object.keys(base).forEach(function (k) { x[k] = base[k]; }); Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
  var pode = function (o) { return GY.podeDesafiar(com(o)); };
  assert.deepStrictEqual(pode({}), { ok: true, revanche: false });
  assert.deepStrictEqual(pode({ etapa: 1 }), { ok: false, motivo: 'fechada' });
  assert.deepStrictEqual(pode({ gymId: 'lava' }), { ok: false, motivo: 'fechada' });
  assert.deepStrictEqual(pode({ etapa: 7 }), { ok: false, motivo: 'fechada' });
  assert.deepStrictEqual(pode({ etapa: 0, progresso: progCom('grama', { etapa: 1 }) }), { ok: false, motivo: 'vencida' });
  assert.deepStrictEqual(pode({ etapa: 2, progresso: progCom('grama', { etapa: 5 }) }), { ok: false, motivo: 'vencida' });
  var E = G.GYMS.grama.etapas;
  assert.deepStrictEqual(pode({ etapa: 2, progresso: progCom('grama', { etapa: 2 }), timeLen: 2, ouroLivre: E[2].entrada }), { ok: true, revanche: false }, 'a entrada exata basta');
  assert.deepStrictEqual(pode({ etapa: 2, progresso: progCom('grama', { etapa: 2 }), timeLen: 2, ouroLivre: E[2].entrada - 1 }), { ok: false, motivo: 'sem-ouro' });
  assert.deepStrictEqual(pode({ ouroLivre: NaN }), { ok: false, motivo: 'sem-ouro' });
  var pedidos = [];
  assert.deepStrictEqual(pode({ etapa: 1, progresso: progCom('grama', { etapa: 1 }), cabe: function (id, n) { pedidos.push(id + n); return id !== 'torrao'; } }), { ok: false, motivo: 'cheia' });
  assert.deepStrictEqual(pedidos, ['torrao1']);
  assert.deepStrictEqual(pode({ etapa: 4, progresso: progCom('grama', { etapa: 4 }), timeLen: 3, cabe: function (id) { return id !== 'redea'; } }), { ok: false, motivo: 'cheia' });
  assert.deepStrictEqual(pode({ etapa: 0, cabe: function () { return false; } }), { ok: true, revanche: false }, 'prêmio sem item não pede mochila');
  [0, undefined, -1, 1.5, '1'].forEach(function (t) { assert.deepStrictEqual(pode({ timeLen: t }), { ok: false, motivo: 'sem-time' }, 'timeLen ' + t); });
  assert.deepStrictEqual(pode({ timeLen: 2 }), { ok: false, motivo: 'time-grande' });
  assert.deepStrictEqual(pode({ etapa: 2, progresso: progCom('grama', { etapa: 2 }), timeLen: 3 }), { ok: false, motivo: 'time-grande' });
  // revanche
  var rev = function (p, o) { return pode(Object.assign({ etapa: 4, timeLen: 3, progresso: progCom('grama', Object.assign({ etapa: 5 }, p)) }, o || {})); };
  assert.deepStrictEqual(rev({ revDia: null }), { ok: true, revanche: true });
  assert.deepStrictEqual(rev({ revDia: HOJE - 1 }), { ok: true, revanche: true });
  assert.deepStrictEqual(rev({ revDia: HOJE }), { ok: false, motivo: 'revanche-hoje' });
  assert.deepStrictEqual(rev({ revDia: HOJE + 3 }), { ok: false, motivo: 'revanche-hoje' }, 'relógio para trás');
  ['lixo', -5, 1.5, {}, undefined, 1e15].forEach(function (d) { assert.deepStrictEqual(rev({ revDia: d }), { ok: false, motivo: 'revanche-hoje' }, 'dia estragado ' + d); });
  [undefined, 1.5, '20500', NaN].forEach(function (h) { assert.deepStrictEqual(rev({ revDia: null }, { hoje: h }), { ok: false, motivo: 'revanche-hoje' }, 'hoje ruim ' + h); });
  assert.deepStrictEqual(rev({ revDia: null }, { ouroLivre: G.GYM.revanche.entrada }), { ok: true, revanche: true });
  assert.deepStrictEqual(rev({ revDia: null }, { ouroLivre: G.GYM.revanche.entrada - 1 }), { ok: false, motivo: 'sem-ouro' });
  assert.deepStrictEqual(rev({ revDia: null, revVitorias: 1 }, { cabe: function (id) { return id !== 'torrao'; } }), { ok: false, motivo: 'cheia' }, 'dia de Torrão com a mochila cheia');
  assert.deepStrictEqual(rev({ revDia: null, revVitorias: 0 }, { cabe: function () { return false; } }), { ok: true, revanche: true }, 'dia de Ouro não pede mochila');
  // uma por dia: tenta, o acerto grava o dia, no mesmo dia não pode; no seguinte pode
  var p = progCom('grama', { etapa: 5 });
  assert.ok(pode({ etapa: 4, timeLen: 1, progresso: p }).ok);
  var a = GY.acerto({ gymId: 'grama', etapa: 4, revanche: true, progresso: p, resultado: resMao([[0, 0, 0]], false), hoje: HOJE, timeLen: 1 });
  assert.deepStrictEqual(pode({ etapa: 4, timeLen: 1, progresso: a.progresso }), { ok: false, motivo: 'revanche-hoje' });
  assert.deepStrictEqual(pode({ etapa: 4, timeLen: 1, progresso: a.progresso, hoje: HOJE + 1 }), { ok: true, revanche: true });
  assert.deepStrictEqual(pode({ etapa: 4, timeLen: 1, progresso: a.progresso, gymId: 'agua' }), { ok: false, motivo: 'fechada' }, 'cada ginásio tem a sua');
  assert.doesNotThrow(function () { GY.podeDesafiar(null); GY.podeDesafiar({}); });
  assert.strictEqual(GY.podeDesafiar(null).ok, false);
});
test('ginásio: bonus e sanear (lixo em cada campo)', function () {
  var I = G.GYM.insignias;
  assert.deepStrictEqual(GY.bonus(progNovo()), { ouro: 0, xp: 0, skill: 0 });
  assert.deepStrictEqual(GY.bonus(progCom('fogo', { etapa: 5 })), { ouro: I.fogo.valor, xp: 0, skill: 0 });
  assert.deepStrictEqual(GY.bonus(progCom('fogo', { etapa: 4 })), { ouro: 0, xp: 0, skill: 0 }, 'sem a etapa 5, sem insígnia');
  var todas = progNovo(); G.GYM_ORDER.forEach(function (g) { todas[g].etapa = 5; });
  assert.deepStrictEqual(GY.bonus(todas), { ouro: I.fogo.valor, xp: I.agua.valor, skill: I.grama.valor });
  [null, 'x', 3, { fogo: 'x' }, { fogo: { etapa: 9 } }].forEach(function (b) { assert.deepStrictEqual(GY.bonus(b), { ouro: 0, xp: 0, skill: 0 }); });
  // sanear
  assert.deepStrictEqual(GY.sanear(null, HOJE), progNovo());
  assert.deepStrictEqual(GY.sanear(undefined, HOJE), progNovo());
  assert.deepStrictEqual(Object.keys(GY.sanear({ lava: {}, fogo: {} }, HOJE)), G.GYM_ORDER);
  var bom = congela(progCom('agua', { etapa: 5, revDia: HOJE - 2, revVitorias: 7 }));
  assert.deepStrictEqual(GY.sanear(bom, HOJE), progCom('agua', { etapa: 5, revDia: HOJE - 2, revVitorias: 7 }));
  [9, -1, 2.5, '3', null, NaN].forEach(function (e) { assert.strictEqual(GY.sanear({ fogo: { etapa: e, revDia: null, revVitorias: 0 } }, HOJE).fogo.etapa, 0, 'etapa ' + e); });
  ['a', -1, 1.5, 1e12, {}, undefined, NaN].forEach(function (d) { assert.strictEqual(GY.sanear({ fogo: { etapa: 5, revDia: d, revVitorias: 0 } }, HOJE).fogo.revDia, HOJE, 'revDia ' + d); });
  assert.strictEqual(GY.sanear({ fogo: { etapa: 5, revDia: null, revVitorias: 0 } }, HOJE).fogo.revDia, null, 'null é "nunca"');
  [-1, 1.5, 'x', null, Infinity].forEach(function (v) { assert.strictEqual(GY.sanear({ fogo: { etapa: 5, revDia: null, revVitorias: v } }, HOJE).fogo.revVitorias, 0, 'revVitorias ' + v); });
  ['x', 3, [], true].forEach(function (g) { var s = GY.sanear({ fogo: g }, HOJE).fogo; assert.strictEqual(s.etapa, 0); assert.strictEqual(s.revVitorias, 0); assert.ok(s.revDia === null || s.revDia === HOJE); });
  // hoje que não é inteiro: o dia estragado nunca libera (vale o maior dia guardado)
  assert.strictEqual(GY.sanear({ fogo: { etapa: 5, revDia: 'a', revVitorias: 0 } }, NaN).fogo.revDia, IT.DIA_MAX);
  assert.strictEqual(GY.DIA_MAX, IT.DIA_MAX);
});
test('garraInfo (a tela) dá os números da Garra que a corrida usa: onde começa, a força e o terço da Maré Alta; a arrancada acontece sempre', function () {
  var T = S.TUNING;
  function cav(i, nivel, garra) { var h = clone(G.STARTERS[i]); h.level = nivel; h.skills = []; h.alloc = { garra: garra }; return h; }
  // a conta, com os números do TUNING (Fogo: sem skill de tipo na Garra)
  var f = cav(0, 30, 20), nf = S.computeStats(f).garra / 100, gf = S.garraInfo(f);
  assert.strictEqual(gf.from, Math.min(0.95, Math.max(0.5, T.garraZone - T.garraZoneK * (nf - 0.5))));
  assert.strictEqual(gf.chance, undefined, 'a Garra não tem mais chance'); ['garraChanceBase', 'garraChanceRange', 'garraChanceMax'].forEach(function (k) { assert.strictEqual(T[k], undefined, k); });
  assert.strictEqual(gf.boost, 1 + T.garraBoostBase + T.garraBoostRange * nf);
  assert.strictEqual(T.garraSpread, 1); assert.ok(Math.abs(gf.boostMin - 1) < 1e-12 && Math.abs(gf.boostMax - (1 + 2 * (gf.boost - 1))) < 1e-12, 'a força de cada corrida vai de 0 a 2× a média');
  assert.strictEqual(gf.tipo, false);
  // o bônus de uma skill (Arrancada Final) soma na força, como na corrida
  var af = G.SKILLS['arrancada-final'].effect, gb = S.garraInfo(f, { boost: af.garraBoostBonus });
  assert.strictEqual(af.garraChanceBonus, undefined); assert.ok(Math.abs(gb.boost - (gf.boost + af.garraBoostBonus)) < 1e-12);
  // Água: a arrancada dentro do último terço usa a Garra da Maré Alta; começando antes dele, não
  var a = cav(1, 30, 20), ga = S.garraInfo(a), ts = S.typeSkill(a);
  assert.ok(ga.from >= ts.zone[0] && ga.tipo === true, 'Maré com Garra média: começa no terço da Maré Alta');
  var na = S.computeStats(a).garra / 100 * (1 + ts.effect.statMul * ts.power);
  assert.ok(Math.abs(ga.boost - (1 + T.garraBoostBase + T.garraBoostRange * na)) < 1e-12);
  var a2 = clone(a); a2.rarity = 'mitico'; a2.grau = 3; a2.level = 50; a2.potential = Object.assign({}, a2.potential, { garra: 31 }); a2.alloc = { garra: 70 };
  var ga2 = S.garraInfo(a2);
  assert.ok(ga2.from < ts.zone[0] && ga2.tipo === false, 'Garra alta começa antes do terço: sem a Maré Alta (' + ga2.from + ')');
  // na corrida, com Nublado e sem skills de vaga: a Garra sai na fração prevista e começa no ponto previsto
  [f, a].forEach(function (h) {
    var info = S.garraInfo(h), vezes = 0, corridas = 600, longe = 0, somaF = 0, fracas = 0, fortes = 0;
    for (var sd = 1; sd <= corridas; sd++) {
      var res = S.simulate({ seed: sd * 7919, conditions: { weather: 'nublado' }, recordFrames: true, racers: [{ horse: h, name: 'A' }, { horse: clone(G.STARTERS[2]), name: 'B' }] });
      var ev = res.events.filter(function (e) { return e.type === 'garra' && e.racer === 0; })[0];
      if (!ev) continue;
      vezes++;
      assert.ok(ev.forca >= 0 && ev.forca <= 2, 'força ' + ev.forca); somaF += ev.forca; if (ev.forca < 0.5) fracas++; if (ev.forca > 1.5) fortes++;
      var k = Math.round(ev.t * 10), D = res.conditions.distance;
      if (!(res.frames[k + 1].pos[0] / D >= info.from - 1e-9 && res.frames[k].pos[0] / D < info.from + 0.02)) longe++;
    }
    assert.strictEqual(vezes, corridas, h.element + ': a Garra tem de sair em toda corrida (saiu em ' + vezes + ' de ' + corridas + ')');
    assert.ok(Math.abs(somaF / corridas - 1) < 0.06 && fracas > 100 && fortes > 100, h.element + ': a força varia em torno da média (média ' + (somaF / corridas).toFixed(2) + ', ' + fracas + ' fracas, ' + fortes + ' fortes)');
    assert.strictEqual(longe, 0, h.element + ': a Garra começou fora do ponto previsto em ' + longe + ' corridas');
  });
});
test('ginasio.js é puro: sem Math.random, relógio, tela nem estado global; carrega no navegador e no build', function () {
  var fs = require('fs'), path = require('path');
  var fonte = fs.readFileSync(path.join(__dirname, '../src/ginasio.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/Math\.random|Date|performance\.now|document|window|localStorage/.test(fonte), 'ginasio.js sem sorteio fora da seed, relógio ou tela');
  assert.ok(/root\.Ginasio = Ginasio/.test(fonte), 'UMD no navegador');
  assert.ok(fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').indexOf('src/ginasio.js') > 0, 'index.html carrega');
  assert.ok(/'src\/itens\.js', 'src\/ginasio\.js'/.test(fs.readFileSync(path.join(__dirname, '../build.mjs'), 'utf8')), 'build.mjs junta');
  assert.ok(/0x47490000/.test(fs.readFileSync(path.join(__dirname, '../src/itens.js'), 'utf8')), 'o mapa dos sais (itens.js) tem a linha do ginásio');
});

section('reforja de peça e Selo do campeão (spec AFK §5.9)');
function pecaRf(id, linhas, rerolls, uid) { return { uid: uid || 'i7', id: id, plus: 0, rerolls: rerolls || 0, linhas: linhas }; }
var RF_RARA = [{ tipo: 'material', valor: 8 }, { tipo: 'xp', valor: 7 }];
test('custoReforja: 100, 150, 230, 340, 510; rerolls estragado vale 0', function () {
  assert.deepStrictEqual([0, 1, 2, 3, 4].map(function (n) { return GR.custoReforja({ rerolls: n }); }), [100, 150, 230, 340, 510]);
  [null, {}, { rerolls: -3 }, { rerolls: 'x' }, { rerolls: NaN }].forEach(function (p) { assert.strictEqual(GR.custoReforja(p), 100); });
  assert.ok(isFinite(GR.custoReforja({ rerolls: 1e9 })), 'não estoura');
});
test('reforjar não repete tipo da peça: o tipo novo nunca é o de outra linha, e o valor fica na faixa da raridade', function () {
  var F = G.ECONOMY.gear.faixas, vistos = {};
  for (var seed = 1; seed <= 2000; seed++) {
    var p = congela(pecaRf('sela-sol-raro', cl(RF_RARA), seed % 7)), r = GR.reforjar(p, 0, false, seed);
    assert.strictEqual(r.rerolls, (seed % 7) + 1);
    assert.deepStrictEqual(r.linhas[1], RF_RARA[1], 'a outra linha não muda');
    assert.notStrictEqual(r.linhas[0].tipo, 'xp');
    var fx = F[r.linhas[0].tipo].raro;
    assert.ok(r.linhas[0].valor >= fx[0] && r.linhas[0].valor <= fx[1] && r.linhas[0].valor === Math.floor(r.linhas[0].valor));
    assert.ok(GR.linhasValidas(p.id, r.linhas));
    vistos[r.linhas[0].tipo] = (vistos[r.linhas[0].tipo] || 0) + 1;
  }
  assert.deepStrictEqual(Object.keys(vistos).sort(), ['material', 'ouro', 'raro', 'trofeu'], 'os 4 tipos livres saem (o atual pode sair de novo)');
  Object.keys(vistos).forEach(function (t) { assert.ok(Math.abs(vistos[t] / 2000 - 0.25) < 0.04, t + ' ' + vistos[t]); });
});
test('com Selo mantém o tipo e o valor fica na metade de cima (E6 rápido, 2.000 sorteios)', function () {
  var F = G.ECONOMY.gear.faixas, vals = {};
  for (var seed = 1; seed <= 2000; seed++) {
    var r = GR.reforjar(pecaRf('sela-sol-lendario', [{ tipo: 'material', valor: 10 }, { tipo: 'trofeu', valor: 20 }, { tipo: 'ouro', valor: 6 }], 0, 'i' + seed), 1, true, 99);
    assert.strictEqual(r.linhas[1].tipo, 'trofeu');
    assert.ok(r.linhas[1].valor >= 25 && r.linhas[1].valor <= 30, 'valor ' + r.linhas[1].valor);
    vals[r.linhas[1].valor] = true;
  }
  assert.strictEqual(Object.keys(vals).length, 6, 'todos os valores de 25 a 30 saem');
  assert.deepStrictEqual(F.trofeu.lendario, [20, 30]);
  // faixa de soma ímpar: [3, 6] -> metade de cima [5, 6]
  for (var s2 = 1; s2 <= 200; s2++) { var v = GR.reforjar(pecaRf('sela-magico', [{ tipo: 'xp', valor: 3 }]), 0, true, s2).linhas[0]; assert.ok(v.tipo === 'xp' && (v.valor === 5 || v.valor === 6)); }
});
test('mesma peça, mesma linha e mesmo rerolls dão o mesmo resultado; outro rerolls, outra peça ou outra seed mudam', function () {
  var p = pecaRf('sela-sol-lendario', [{ tipo: 'material', valor: 10 }, { tipo: 'trofeu', valor: 20 }, { tipo: 'ouro', valor: 6 }], 2);
  var a = GR.reforjar(congela(cl(p)), 0, false, 4242);
  assert.deepStrictEqual(GR.reforjar(congela(cl(p)), 0, false, 4242), a);
  var dif = { rr: 0, uid: 0, seed: 0 };
  for (var k = 0; k < 30; k++) {
    if (JSON.stringify(GR.reforjar(Object.assign(cl(p), { rerolls: 3 + k }), 0, false, 4242).linhas) !== JSON.stringify(a.linhas)) dif.rr++;
    if (JSON.stringify(GR.reforjar(Object.assign(cl(p), { uid: 'i' + (100 + k) }), 0, false, 4242).linhas) !== JSON.stringify(a.linhas)) dif.uid++;
    if (JSON.stringify(GR.reforjar(cl(p), 0, false, 5000 + k).linhas) !== JSON.stringify(a.linhas)) dif.seed++;
  }
  assert.ok(dif.rr >= 20 && dif.uid >= 20 && dif.seed >= 20, JSON.stringify(dif));
  var mr = Math.random, usou = false; Math.random = function () { usou = true; return 0.5; };
  try { GR.reforjar(cl(p), 0, false, 1); GR.reforjar(cl(p), 0, true, 1); } finally { Math.random = mr; }
  assert.ok(!usou, 'sem Math.random');
});
test('podeReforjar: cada motivo (Comum, linha, Pergaminho, Selo, Ouro) e o custo; reforjar recusa entrada inválida', function () {
  var p = pecaRf('sela-sol-raro', cl(RF_RARA), 2), m = { 'pergaminho-reforja': 1, selo: 0 };
  assert.deepStrictEqual(GR.podeReforjar(p, 0, false, m, 230), { ok: true, custo: 230 });
  assert.deepStrictEqual(GR.podeReforjar(p, 0, false, m, 229), { ok: false, motivo: 'Falta Ouro (precisa de 230)', custo: 230 });
  assert.strictEqual(GR.podeReforjar(p, 0, false, { 'pergaminho-reforja': 0, selo: 5 }, 9999).motivo, 'Falta Pergaminho de reforja');
  assert.strictEqual(GR.podeReforjar(p, 0, false, null, 9999).motivo, 'Falta Pergaminho de reforja');
  assert.strictEqual(GR.podeReforjar(p, 0, true, m, 9999).motivo, 'Falta Selo do campeão');
  assert.strictEqual(GR.podeReforjar(p, 0, true, { 'pergaminho-reforja': 1, selo: 1 }, 9999).ok, true);
  assert.strictEqual(GR.podeReforjar(pecaRf('sela-comum', []), 0, false, m, 9999).motivo, 'Peça Comum não tem linhas');
  [2, -1, 0.5, null, 'x'].forEach(function (i) { assert.strictEqual(GR.podeReforjar(p, i, false, m, 9999).ok, false, String(i)); assert.strictEqual(GR.reforjar(p, i, false, 1), null, String(i)); });
  assert.strictEqual(GR.podeReforjar(null, 0, false, m, 9999).ok, false);
  assert.strictEqual(GR.reforjar(pecaRf('sela-comum', []), 0, false, 1), null);
  assert.strictEqual(GR.reforjar(pecaRf('sela-sol-raro', [{ tipo: 'xp', valor: 7 }]), 0, false, 1), null, 'linhas inválidas para a raridade');
  assert.strictEqual(GR.reforjar(p, 0, false, NaN), null);
});
test('seloPodio: 2º lugar nunca; 1º ~10% em 20.000 seeds (±1); determinístico e com sal próprio', function () {
  var n = 0, junto = 0;
  for (var seed = 1; seed <= 20000; seed++) {
    var v = IT.seloPodio(seed, 1);
    assert.ok(v === 0 || v === 1);
    n += v;
    if (v && IT.pergaminhoPodio(seed, 1)) junto++;
    assert.strictEqual(IT.seloPodio(seed, 2), 0); assert.strictEqual(IT.seloPodio(seed, 3), 0);
    if (seed < 50) assert.strictEqual(IT.seloPodio(seed, 1), v);
  }
  assert.ok(Math.abs(n / 20000 - 0.10) <= 0.01, 'taxa ' + (n / 200).toFixed(2) + '%');
  assert.ok(Math.abs(junto / n - 0.5) < 0.05, 'independente do Pergaminho de técnica (' + (junto / n).toFixed(3) + ')');
  [0, 4, 8, -1, 1.5, null, undefined, '1'].forEach(function (pl) { assert.strictEqual(IT.seloPodio(123, pl), 0, String(pl)); });
  assert.strictEqual(IT.seloPodio(NaN, 1), 0);
  assert.strictEqual(G.ITEMS.selo.podio, 0.10); assert.strictEqual(G.ITEMS.selo.price, null);
});
test('treino nunca chama seloPodio: no game.js a única chamada fica na liquidação valendo, junto do Pergaminho de técnica', function () {
  var fs = require('fs'), path = require('path');
  var jogo = fs.readFileSync(path.join(__dirname, '../src/game.js'), 'utf8');
  var usos = jogo.split('seloPodio(').length - 1;
  assert.strictEqual(usos, 1, 'uma chamada só (' + usos + ')');
  var i = jogo.indexOf('seloPodio('), trecho = jogo.slice(Math.max(0, i - 400), i + 200);
  assert.ok(/pergaminhoPodio\(/.test(trecho), 'na mesma liquidação do Pergaminho de técnica');
  ['afk.js', 'forja.js', 'ginasio.js'].forEach(function (f) {
    assert.ok(!/seloPodio/.test(fs.readFileSync(path.join(__dirname, '../src/' + f), 'utf8')), f + ' não sorteia Selo');
  });
  assert.ok(!require('../src/afk.js').premio('fogo:4:lendaria', true, 7, null).itens.selo, 'o AFK não dá Selo');
});

console.log('\n' + count + ' testes, ' + fails + ' falhas');
process.exit(fails ? 1 : 0);
