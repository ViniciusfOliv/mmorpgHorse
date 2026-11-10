#!/usr/bin/env node
/*
 * Relatório de balanceamento v2 do RaceSim (mapas em blocos, clima como triângulo, Dado da Sorte,
 * skills com chance; sem tática).
 *
 *   node tools/balance.js            # relatório completo (milhares de corridas)
 *   node tools/balance.js --quick    # 1/4 das corridas (iteração rápida)
 *   node tools/balance.js --tune '{"curveBase":0.84}'   # sobrescreve RaceSim.TUNING (só p/ ajuste)
 *   node tools/balance.js --exemplo  # imprime a corrida de exemplo usada em docs/exemplos.md
 *
 * Sai com código 1 se alguma meta falhar.
 */
'use strict';

var G = require('../src/data.js');
var S = require('../src/sim.js');
var GR = require('../src/gear.js');

var args = process.argv.slice(2);
var QUICK = args.indexOf('--quick') >= 0;
var tuneIdx = args.indexOf('--tune');
if (tuneIdx >= 0) {
  var over = JSON.parse(args[tuneIdx + 1]);
  deepAssign(S.TUNING, over);
}
var SCALE = QUICK ? 0.25 : 1;

var STARTERS = G.STARTERS;
var WILD = G.WILD_HORSES;
var ALL = STARTERS.concat(WILD);
var RAR_IDS = Object.keys(G.RARITIES);
var TRIANGLE = ['fogo', 'agua', 'grama'];

// mapas sintéticos (os mesmos de tools/sim-test.js)
var CURVA = { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 200 }, { type: 'curva', from: 200, to: 1400 }, { type: 'reta', from: 1400, to: 1600 }] };
var RETA = { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 1600 }] };
var SUBIDA = { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 200 }, { type: 'subida', from: 200, to: 1400 }, { type: 'reta', from: 1400, to: 1600 }] };

function deepAssign(dst, src) {
  for (var k in src) {
    if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') deepAssign(dst[k], src[k]);
    else dst[k] = src[k];
  }
}
function clone(h, level) {
  var c = JSON.parse(JSON.stringify(h));
  if (level != null) c.level = level;
  return c;
}
// Montaria sintética: mítico lv1 neutro, os 7 status base 60, potencial 0, sem skills (+ overrides).
function mk(over, name) {
  var h = clone(WILD[0], 1);
  h.id = 'sint'; h.name = name || 'Sintético'; h.rarity = 'mitico'; h.element = 'neutro'; h.skills = [];
  G.STAT_KEYS.forEach(function (k) { h.base[k] = 60; h.potential[k] = 0; });
  for (var k in (over || {})) h.base[k] = over[k];
  return h;
}
function n(x) { return Math.max(1, Math.round(x * SCALE)); }
function seedOf(test, k) { return S.hash2(test * 7919 + 13, k); }
function pct(a, b) { return b ? (100 * a / b) : 0; }
function f1(x) { return x.toFixed(1).replace('.', ','); }
function f2(x) { return x.toFixed(2).replace('.', ','); }
function run(seed, conditions, racers) {
  return S.simulate({ seed: seed, conditions: conditions, racers: racers, recordFrames: false });
}
function racer(h, gear, name) {
  return { horse: h, gear: gear || null, name: name || h.name, isPlayer: false };
}
function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
function quant(a, q) { var b = a.slice().sort(function (x, y) { return x - y; }); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))] : 0; }
function countType(res, type, racerIdx) {
  var c = 0;
  for (var i = 0; i < res.events.length; i++) {
    var e = res.events[i];
    if (e.type === type && (racerIdx == null || e.racer === racerIdx)) c++;
  }
  return c;
}
function distGroup(d) { return d <= 1200 ? 'curta' : (d >= 2200 ? 'longa' : 'media'); }
var GROUP_LABEL = { curta: 'curta (≤1200 m)', media: 'média (1300–2100 m)', longa: 'longa (≥2200 m)' };

var results = [];
function check(id, label, value, lo, hi, unit) {
  var ok = value >= lo && value <= hi;
  results.push({ id: id, label: label, value: value, lo: lo, hi: hi, ok: ok, unit: unit == null ? '%' : unit });
  return ok;
}
function checkBool(id, label, ok, detail) {
  results.push({ id: id, label: label, bool: true, ok: ok, detail: detail });
  return ok;
}

var out = [];
function log(s) { out.push(s == null ? '' : s); }

// ---------------------------------------------------------------------------
if (args.indexOf('--exemplo') >= 0) { exemplo(); process.exit(0); }

var t0 = Date.now(); // só para medir o tempo do relatório (não entra na simulação)

// ---------------------------------------------------------------------------
// 1) Iniciais no mesmo level, mapas aleatórios
// ---------------------------------------------------------------------------
var durStarters = { curta: [], media: [], longa: [] };
var winTimeStarters = { curta: [], media: [], longa: [] };
var info = { races: 0, cansou: 0, garra: 0, ultrap: 0, skills: 0, clima: 0, racerEntries: 0 };

function test1(level, N, collect) {
  var wins = [0, 0, 0];
  var gWins = { curta: [0, 0, 0], media: [0, 0, 0], longa: [0, 0, 0] };
  var gCount = { curta: 0, media: 0, longa: 0 };
  var hs = STARTERS.map(function (h) { return clone(h, level); });
  for (var k = 0; k < N; k++) {
    var seed = seedOf(level === 1 ? 1 : 100 + level, k);
    var cond = S.randomConditions(seed);
    var rs = hs.map(function (h) { return racer(h); });
    var res = run(seed, cond, rs);
    var w = res.finishOrder[0];
    var g = distGroup(cond.distance);
    wins[w]++; gWins[g][w]++; gCount[g]++;
    if (collect) {
      durStarters[g].push(res.duration);
      winTimeStarters[g].push(res.finishTimes[w]);
      info.races++; info.racerEntries += rs.length;
      res.events.forEach(function (e) {
        if (e.type === 'cansou') info.cansou++;
        else if (e.type === 'garra') info.garra++;
        else if (e.type === 'ultrapassagem') info.ultrap++;
        else if (e.type === 'skill') info.skills++;
        else if (e.type === 'clima') info.clima++;
      });
    }
  }
  return { wins: wins, N: N, gWins: gWins, gCount: gCount };
}

var N1 = n(6000);
var r1 = test1(1, N1, true);
var r1b = test1(25, n(3000), false);

log('## Relatório de balanceamento v2');
log('');
log('Gerado por `node tools/balance.js`' + (QUICK ? ' --quick' : '') + '. Mapas aleatórios em blocos (`randomConditions`), sem equipamento, salvo indicação. ' +
  'Dado da Sorte ligado (1/3 e 2/3 da pista), exceto na seção 2. ' +
  'Metas E1–E4 (E2 em a/b) medem o equipamento (`gear.js`).');
log('');
log('### 1. Iniciais no mesmo level, mapas aleatórios (meta: 28%–39% cada)');
log('');
log('| Inicial | Vitórias lv1 (' + N1 + ' corridas) | Curta | Média | Longa | Vitórias lv25 (' + r1b.N + ') |');
log('|---|---|---|---|---|---|');
STARTERS.forEach(function (h, i) {
  var v = pct(r1.wins[i], r1.N);
  check('1', h.name + ' lv1', v, 28, 39);
  check('1', h.name + ' lv25', pct(r1b.wins[i], r1b.N), 28, 39);
  log('| ' + h.name + ' | **' + f1(v) + '%** | ' +
    ['curta', 'media', 'longa'].map(function (g) { return f1(pct(r1.gWins[g][i], r1.gCount[g])) + '%'; }).join(' | ') + ' | ' +
    f1(pct(r1b.wins[i], r1b.N)) + '% |');
});
log('');

// ---------------------------------------------------------------------------
// 2) Inicial com o clima do seu elemento fixo (Dado desligado)
// ---------------------------------------------------------------------------
var N2 = n(3000);
var savedDiceAt = S.TUNING.diceAt;
try {
S.TUNING.diceAt = [];   // isola do Dado: o clima não vira durante a corrida
log('### 2. Inicial com o clima do seu elemento fixo, sem Dado (meta: 45%–65%)');
log('');
log('Mapas aleatórios (`randomConditions`) com o clima trocado pelo do elemento do inicial, fixo durante toda a corrida (`diceAt = []` nesta seção).');
log('');
log('| Inicial | Clima | Multiplicadores (Brasa · Maré · Ipê) | Vitórias (' + N2 + ') |');
log('|---|---|---|---|');
STARTERS.forEach(function (h, i) {
  var w = G.ELEMENTS[h.element].weather;
  var wins = 0;
  for (var k = 0; k < N2; k++) {
    var seed = seedOf(200 + i, k);
    var cond = S.randomConditions(seed);
    cond.weather = w;   // clima do elemento do inicial, fixo (Dado desligado)
    var rs = STARTERS.map(function (x) { return racer(clone(x, 1)); });
    if (run(seed, cond, rs).finishOrder[0] === i) wins++;
  }
  var v = pct(wins, N2);
  check('2', h.name + ' no seu clima', v, 45, 65);
  var mults = STARTERS.map(function (x) { return '×' + f2(S.weatherMult(x.element, w, false)); }).join(' · ');
  log('| ' + h.name + ' | ' + G.WEATHERS[w].name + ' | ' + mults + ' | **' + f1(v) + '%** |');
});
} finally {
  S.TUNING.diceAt = savedDiceAt;   // restaura o Dado da Sorte (mesmo se algo lançar no meio)
}
log('');

// ---------------------------------------------------------------------------
// 3) Especialistas por trecho
// ---------------------------------------------------------------------------
var N3 = n(2000);
function specialist(map, statA, statB, testId) {
  var a = mk((function () { var o = {}; o[statA] = 90; return o; })(), 'Esp. ' + statA);
  var b = mk((function () { var o = {}; o[statB] = 90; return o; })(), 'Esp. ' + statB);
  var winsA = 0;
  for (var k = 0; k < N3; k++) {
    var seed = seedOf(testId, k);
    var pair = (k % 2 === 0) ? [a, b] : [b, a];   // largada alternada
    var res = run(seed, map, pair.map(function (h) { return racer(h); }));
    if (pair[res.finishOrder[0]] === a) winsA++;
  }
  return pct(winsA, N3);
}
var SPEC = [
  ['3', 'De curva (MAN 90) × de reta (VEL 90)', CURVA, 'man', 'vel', 'curva', 55, 75],
  ['3b', 'De reta (VEL 90) × de curva (MAN 90) em reta pura', RETA, 'vel', 'man', 'reta', 70, 100],
  ['3c', 'De subida (FOR 90) × de reta (VEL 90)', SUBIDA, 'forca', 'vel', 'subida', 55, 75]
];
log('### 3. Especialistas por trecho (mítico lv1 neutro, base 60 e um status 90; meta: o especialista do trecho vence 55%–75%; 3b: 70%–100%)');
log('');
log('3b rebaseada para 70%–100%: sem Disposição do dia (intencional no v2) não há ruído por corrida, e em reta pura VEL 90 contra 60 decide quase sempre.');
log('');
log('| # | Duelo | Mapa | Vitórias do 1º (' + N3 + ', largada alternada) |');
log('|---|---|---|---|');
SPEC.forEach(function (sp, si) {
  var v = specialist(sp[2], sp[3], sp[4], 300 + si);
  check(sp[0], sp[1], v, sp[6], sp[7]);
  var share = Math.round(100 * S.blockShare(sp[2].blocks, sp[5]));
  log('| ' + sp[0] + ' | ' + sp[1] + ' | 1600 m, ' + share + '% ' + sp[5] + ' | **' + f1(v) + '%** |');
});
log('');

// ---------------------------------------------------------------------------
// 4) Raridade x level (1v1)
// ---------------------------------------------------------------------------
function duel(a, b, N, testId) {
  var winsA = 0;
  for (var k = 0; k < N; k++) {
    var seed = seedOf(testId, k);
    var cond = S.randomConditions(seed);
    var pair = (k % 2 === 0) ? [a, b] : [b, a];   // alterna a posição de largada
    var res = run(seed, cond, pair.map(function (h) { return racer(h); }));
    if (pair[res.finishOrder[0]] === a) winsA++;
  }
  return winsA;
}
var comuns = WILD.filter(function (h) { return h.rarity === 'comum'; });
var miticos = WILD.filter(function (h) { return h.rarity === 'mitico'; });
var raros = ALL.filter(function (h) { return h.rarity === 'raro'; });
var N4 = n(1500);
var aggW = 0, aggN = 0, rows4a = [];
miticos.forEach(function (M, mi) {
  comuns.forEach(function (C, ci) {
    var w = duel(clone(M, 1), clone(C, 1), N4, 400 + mi * 10 + ci);
    aggW += w; aggN += N4;
    rows4a.push('| ' + M.name + ' lv1 × ' + C.name + ' lv1 | ' + f1(pct(w, N4)) + '% |');
  });
});
var v4a = pct(aggW, aggN);
check('4a', 'Mítico lv1 vence Comum lv1', v4a, 90, 100);
var N4b = n(800);
var aggW2 = 0, aggN2 = 0, rows4b = [];
comuns.forEach(function (C, ci) {
  raros.forEach(function (Rr, ri) {
    var w = duel(clone(C, 25), clone(Rr, 1), N4b, 500 + ci * 10 + ri);
    aggW2 += w; aggN2 += N4b;
    rows4b.push('| ' + C.name + ' lv25 × ' + Rr.name + ' lv1 | ' + f1(pct(w, N4b)) + '% |');
  });
});
var v4b = pct(aggW2, aggN2);
check('4b', 'Comum lv25 vence Raro lv1', v4b, 25, 60);
log('### 4. Raridade × level, duelos 1v1 em mapas aleatórios (' + N4 + ' / ' + N4b + ' corridas por duelo)');
log('');
log('Faixas rebaseadas (4a 90%–100%, 4b 25%–60%): sem Disposição do dia (intencional no v2) a raridade quase sempre decide, e o Comum lv25 para no teto 60.');
log('');
log('| Duelo | Vitórias do 1º |');
log('|---|---|');
log('| **Mítico lv1 × Comum lv1 (média, meta 90%–100%)** | **' + f1(v4a) + '%** |');
rows4a.forEach(function (r) { log(r); });
log('| **Comum lv25 × Raro lv1 (média, meta 25%–60%)** | **' + f1(v4b) + '%** |');
rows4b.forEach(function (r) { log(r); });
log('');

// ---------------------------------------------------------------------------
// E) Equipamento (metas E1–E4, E2 em a/b, + E3b): duelos de 2 corredores com peças de gear.js
// ---------------------------------------------------------------------------
var GEAR_SLOTS = G.GEAR_SLOTS;
function gearFrom(ids, plus) {   // ids por slot (null = vazio) + nível de melhoria -> objeto resolvido
  var equip = {}, items = {};
  GEAR_SLOTS.forEach(function (s, i) {
    if (ids[i]) { equip[s] = 'u' + i; items['u' + i] = { uid: 'u' + i, id: ids[i], plus: plus }; }
    else equip[s] = null;
  });
  return GR.resolve({ equip: equip }, items);
}
function pieceIds(fn, count) {
  return GEAR_SLOTS.map(function (s, i) { return i < count ? fn(s, i) : null; });
}
// primeiras n peças (ordem dos slots) do conjunto
function setGear(set, rarity, plus, cnt) {
  return gearFrom(pieceIds(function (s) { return s + '-' + set + '-' + rarity; }, cnt), plus);
}
// peça do slot i do conjunto sets[i] (sets mais curto = slots finais vazios)
function mixedGear(rarity, plus, sets) {
  return gearFrom(pieceIds(function (s, i) { return s + '-' + sets[i] + '-' + rarity; }, sets.length), plus);
}
// cinco peças soltas (só comum/mágico)
function looseGear(rarity, plus) {
  return gearFrom(pieceIds(function (s) { return s + '-' + rarity; }, GEAR_SLOTS.length), plus);
}
// Duelo com equipamento por corredor; com `weather` fixa o clima (Dado desligado) durante o laço.
function duelGear(a, ga, b, gb, N, testId, weather) {
  var saved = S.TUNING.diceAt, winsA = 0;
  try {
    if (weather) S.TUNING.diceAt = [];
    for (var k = 0; k < N; k++) {
      var seed = seedOf(testId, k);
      var cond = S.randomConditions(seed);
      if (weather) cond.weather = weather;
      var pair = (k % 2 === 0) ? [[a, ga], [b, gb]] : [[b, gb], [a, ga]];   // alterna a largada
      var res = run(seed, cond, pair.map(function (p) { return racer(p[0], p[1]); }));
      if (pair[res.finishOrder[0]][0] === a) winsA++;
    }
  } finally { S.TUNING.diceAt = saved; }
  return winsA;
}
var NE = n(400), byId = {};
ALL.forEach(function (h) { byId[h.id] = h; });
var e1W = 0, e1N = 0;
STARTERS.forEach(function (h, si) {
  e1W += duelGear(clone(h, 1), looseGear('comum', 0), clone(h, 1), null, NE, 1100 + si, 'nublado'); e1N += NE;
});
var vE1 = pct(e1W, e1N);
check('E1', 'Inicial lv1 com 5 Comuns +0 vence sem nada', vE1, 60, 75);
var gE2 = setGear('sol', 'raro', 10, 5);
var magicos = ALL.filter(function (h) { return h.rarity === 'magico'; });
var e2aW = 0, e2aN = 0, e2bW = 0, e2bN = 0;
comuns.forEach(function (C, ci) {
  magicos.forEach(function (M, mi) {   // um degrau acima: o conjunto Raro +10 deve fechar
    e2aW += duelGear(clone(C, 30), gE2, clone(M, 30), null, NE, 1400 + ci * 10 + mi, 'nublado'); e2aN += NE;
  });
  raros.forEach(function (Rr, ri) {    // dois degraus acima: não deve fechar
    e2bW += duelGear(clone(C, 30), gE2, clone(Rr, 30), null, NE, 1200 + ci * 10 + ri, 'nublado'); e2bN += NE;
  });
});
var vE2a = pct(e2aW, e2aN), vE2b = pct(e2bW, e2bN);
check('E2a', 'Comum lv30 com conjunto Raro +10 vence Mágico lv30 sem nada', vE2a, 60, 85);
check('E2b', 'Comum lv30 com conjunto Raro +10 vence Raro lv30 sem nada', vE2b, 10, 40);
var brasa = byId.brasa;
var vE3 = pct(duelGear(clone(brasa, 10), setGear('sol', 'raro', 0, 4), clone(brasa, 10), mixedGear('raro', 0, ['sol', 'sol', 'chuva', 'nevoa']), NE, 1300, 'sol'), NE);
check('E3', '4 Raras do Sol × 4 Raras misturadas, com Sol', vE3, 65, 85);
// E3b: os dois Brasas do E3 + uma Maré (Água, sem equipamento) como agente do Dado; Sol só no início e
// Dado ligado. Com só dois Fogos o Dado sempre cairia no Sol; a Maré, quando vence um Dado, vira o clima
// para Chuva (penaliza o Fogo). Conta as corridas em que A (4 do Sol) chega à frente de B (misturada).
function e3b(N, testId) {
  var A = clone(brasa, 10), B = clone(brasa, 10), C = clone(byId.mare, 10);
  var gA = setGear('sol', 'raro', 0, 4), gB = mixedGear('raro', 0, ['sol', 'sol', 'chuva', 'nevoa']);
  var perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];   // as 6 ordens de raia
  var field = [[A, gA], [B, gB], [C, null]], aheadA = 0;
  for (var k = 0; k < N; k++) {
    var seed = seedOf(testId, k);
    var cond = S.randomConditions(seed);
    cond.weather = 'sol';   // só o clima inicial; o Dado continua ligado
    var order = perms[k % perms.length];
    var res = run(seed, cond, order.map(function (q) { return racer(field[q][0], field[q][1]); }));
    var posA = res.finishOrder.indexOf(order.indexOf(0)), posB = res.finishOrder.indexOf(order.indexOf(1));
    if (posA < posB) aheadA++;
  }
  return aheadA;
}
var vE3b = pct(e3b(NE, 1302), NE);
check('E3b', 'Brasa com 4 Raras do Sol à frente da Brasa misturada, Sol inicial com Dado ligado e uma Água na pista', vE3b, 60, 80);
var vE4 = pct(duelGear(clone(brasa, 10), setGear('chuva', 'raro', 0, 5), clone(brasa, 10), mixedGear('raro', 0, ['chuva', 'chuva', 'sol', 'sol', 'nevoa']), NE, 1301, 'chuva'), NE);
check('E4', 'Fogo com 5 Raras da Chuva × misturadas, na chuva', vE4, 60, 75);
log('### E. Equipamento (metas E1–E4, E2 em a/b, + E3b)');
log('');
log('Duelos de 2 corredores (' + NE + ' corridas por duelo, largada alternada), mapas aleatórios; clima fixo nas metas com clima (Dado desligado), exceto E3b (3 corredores, Sol inicial, Dado ligado). Peças de `gear.js`.');
log('');
log('E2a/E2b: no lv30 o salto Comum→Raro vale ~20 pontos por status (statCap 60 contra 80) mais duas skills extras; um conjunto Raro +10 completo (+14) fecha um degrau (vence o Mágico) mas não dois (perde do Raro): "fecha um degrau, não dois". ' +
  'E3 (65–85%): o bônus de 4 peças reforça o clima do conjunto para ×1,07 (a skill de clima dá ×' + f2(S.TUNING.weatherMultDouble) + ' e vale mais, sem acumular); num duelo de clima fixo entre cavalos idênticos vale ~77%, porque a simulação é quase determinística e qualquer vantagem constante vira vitória. ' +
  'E3b mede essa vantagem real: os dois Brasas do E3 mais uma Maré (Água, sem equipamento) na pista, Sol só no início e o Dado ligado; conta quantas vezes a Brasa do Sol chega à frente da misturada. ' +
  'A terceira montaria de outro elemento é necessária porque o Dado vira o clima para o elemento de quem o vence: com só dois Fogos ele sempre cairia no Sol e o clima nunca viraria. ' +
  'A faixa 60–80% é um pino de regressão em torno do valor medido: o bônus de 4 peças é forte sempre que a previsão se mantém (o clima virou em ~28% das corridas desta meta), e as duas Brasas empatam quando o clima vira.');
log('');
log('| Meta | Duelo | Vitórias do 1º | Faixa |');
log('|---|---|---|---|');
log('| E1 | Inicial lv1 com 5 Comuns +0 × sem nada (nublado) | **' + f1(vE1) + '%** | 60–75% |');
log('| E2a | Comum lv30 com conjunto Raro +10 × Mágico lv30 sem nada (nublado) | **' + f1(vE2a) + '%** | 60–85% |');
log('| E2b | Comum lv30 com conjunto Raro +10 × Raro lv30 sem nada (nublado) | **' + f1(vE2b) + '%** | 10–40% |');
log('| E3 | 4 Raras do Sol × 4 Raras misturadas, Brasa lv10, com Sol | **' + f1(vE3) + '%** | 65–85% |');
log('| E3b | 4 Raras do Sol à frente de 4 Raras misturadas, Brasa lv10, + Maré lv10; Sol inicial com Dado ligado | **' + f1(vE3b) + '%** | 60–80% |');
log('| E4 | Brasa lv10 com 5 Raras da Chuva × misturadas, na chuva | **' + f1(vE4) + '%** | 60–75% |');
log('');

// ---------------------------------------------------------------------------
// 5) Duração das corridas
// ---------------------------------------------------------------------------
// Campo PVP: 8 montarias de liga parecida (rating ±150 da sorteada), nos levels do catálogo
var mixDur = { curta: [], media: [], longa: [] };
var N5 = n(1500);
var ratingOf = ALL.map(function (h) { return S.powerRating(h, null); });
for (var k5 = 0; k5 < N5; k5++) {
  var seed5 = seedOf(600, k5);
  var cond5 = S.randomConditions(seed5);
  var rng5 = S.mulberry32(S.hash2(seed5, 4242));
  var ar = ratingOf[Math.floor(rng5() * ALL.length)];
  var near = ALL.filter(function (h, q) { return Math.abs(ratingOf[q] - ar) <= 150; });
  var rs5 = [];
  for (var q5 = 0; q5 < 8; q5++) rs5.push(racer(near[Math.floor(rng5() * near.length)], null, G.BOT_NAMES[q5]));
  mixDur[distGroup(cond5.distance)].push(run(seed5, cond5, rs5).duration);
}
log('### 5. Duração (tempo de simulação até o último cruzar a linha)');
log('');
log('| Distância | Iniciais lv1: média (p5–p95) | Vencedor: média | PVP de 8 (mesma liga): média (p5–p95) | Meta |');
log('|---|---|---|---|---|');
['curta', 'media', 'longa'].forEach(function (g) {
  var a = durStarters[g], m = mixDur[g];
  var meta = g === 'curta' ? '55–70 s' : (g === 'longa' ? '140–170 s' : '—');
  if (g === 'curta') { check('5', 'Duração curta (≤1200 m), iniciais', mean(a), 55, 70, ' s'); check('5', 'Duração curta (≤1200 m), PVP 8', mean(m), 55, 70, ' s'); }
  if (g === 'longa') { check('5', 'Duração longa (≥2200 m), iniciais', mean(a), 140, 170, ' s'); check('5', 'Duração longa (≥2200 m), PVP 8', mean(m), 140, 170, ' s'); }
  log('| ' + GROUP_LABEL[g] + ' | ' + f1(mean(a)) + ' s (' + f1(quant(a, 0.05)) + '–' + f1(quant(a, 0.95)) + ') | ' + f1(mean(winTimeStarters[g])) + ' s | ' +
    f1(mean(m)) + ' s (' + f1(quant(m, 0.05)) + '–' + f1(quant(m, 0.95)) + ') | ' + meta + ' |');
});
log('');

// ---------------------------------------------------------------------------
// 6) Pagamentos
// ---------------------------------------------------------------------------
var payOk = true, payDetail = [];
var payFees = G.ECONOMY.entryTiers.concat([1, 3, 7]);   // + entradas minúsculas (arredondamento)
payFees.forEach(function (fee) {
  for (var nr = 4; nr <= 8; nr++) {
    var order = []; for (var q = 0; q < nr; q++) order.push((q * 3 + 1) % nr);
    var p = S.payouts(fee, nr, order);
    var sum = p.prizes.reduce(function (s, x) { return s + x.amount; }, 0);
    var ints = [p.pot, p.fee].concat(p.prizes.map(function (x) { return x.amount; })).every(function (x) { return Number.isInteger(x) && x >= 0; });
    var paid = G.ECONOMY.payoutSplitFor ? G.ECONOMY.payoutSplitFor(nr).length : 3;
    var nonInc = p.prizes.every(function (x, k) { return k === 0 || x.amount <= p.prizes[k - 1].amount; });
    var ok = ints && nonInc && sum + p.fee === p.pot && p.pot === fee * nr && p.prizes.length === paid &&
      p.prizes.every(function (x, k) { return x.racer === order[k]; });
    // com as entradas reais, todo lugar premiado recebe pelo menos a entrada de volta
    if (G.ECONOMY.entryTiers.indexOf(fee) >= 0) ok = ok && p.prizes.every(function (x) { return x.amount >= fee; });
    if (!ok) { payOk = false; payDetail.push(fee + 'x' + nr); }
  }
});
checkBool('6', 'Pagamentos: soma(prêmios)+taxa == pote, inteiros, prêmios não crescentes, pódio ≥ entrada (4..8 corredores × ' +
  G.ECONOMY.entryTiers.join('/') + '; não crescentes também com entrada 1/3/7)', payOk, payDetail.join(','));
log('### 6. Pagamentos (pote = entrada × corredores; taxa ' + (G.ECONOMY.houseFee * 100) + '%; 4–5 corredores 70/30, 6–7 50/30/20, 8 60/25/15)');
log('');
log('| Entrada | Corredores | Pote | Taxa | 1º | 2º | 3º |');
log('|---|---|---|---|---|---|---|');
G.ECONOMY.entryTiers.forEach(function (fee) {
  [4, 5, 6, 7, 8].forEach(function (nr) {
    var p = S.payouts(fee, nr, [0, 1, 2, 3, 4, 5, 6, 7].slice(0, nr));
    log('| ' + fee + ' | ' + nr + ' | ' + p.pot + ' | ' + p.fee + ' | ' + p.prizes.map(function (x) { return x.amount; }).join(' | ') + (p.prizes.length < 3 ? ' | — |' : ' |'));
  });
});
log('');

// ---------------------------------------------------------------------------
// 7) Dado da Sorte (rollDice direto, sem simulação)
// ---------------------------------------------------------------------------
var N7 = 4000;
var rng7 = S.mulberry32(seedOf(750, 0));
var w7 = 0, sum100 = 0, sum0 = 0, n0 = 0;
for (var i7 = 0; i7 < N7; i7++) {
  var me = S.rollDice(rng7, 100, 0).best, top = 0;
  sum100 += me;
  for (var j7 = 0; j7 < 7; j7++) { var b7 = S.rollDice(rng7, 0, 0).best; sum0 += b7; n0++; if (b7 > top) top = b7; }
  if (me > top) w7++;
}
var v7 = pct(w7, N7);
check('7', 'Sorte 100 contra sete de Sorte 0 vence o dado', v7, 18, 28, '%');
log('### 7. Dado da Sorte (`rollDice`, ' + N7 + ' rodadas; meta: 18%–28%; sem viés seria 12,5%)');
log('');
log('| Métrica | Valor |');
log('|---|---|');
log('| Sorte 100 tira mais que os sete de Sorte 0 | **' + f1(v7) + '%** |');
log('| Média do dado com Sorte 100 | ' + f1(sum100 / N7) + ' |');
log('| Média do dado com Sorte 0 | ' + f1(sum0 / n0) + ' |');
log('');

// ---------------------------------------------------------------------------
// 8) Viradas de clima por corrida (PVP 8, elementos sorteados no triângulo)
// ---------------------------------------------------------------------------
var N8 = n(1000);
var flips = [], flipHist = [0, 0, 0];
for (var k8 = 0; k8 < N8; k8++) {
  var seed8 = seedOf(800, k8);
  var rng8 = S.mulberry32(S.hash2(seed8, 8888));
  var rs8 = [];
  for (var q8 = 0; q8 < 8; q8++) {
    var h8 = mk({}, 'Sint ' + (q8 + 1));
    h8.element = TRIANGLE[Math.floor(rng8() * 3)];
    rs8.push(racer(h8, null, G.BOT_NAMES[q8]));
  }
  var c8 = countType(run(seed8, S.randomConditions(seed8), rs8), 'clima');
  flips.push(c8);
  flipHist[Math.min(c8, 2)]++;
}
var v8 = mean(flips);
check('8', 'Viradas de clima por corrida (PVP 8)', v8, 0.8, 1.6, '');
log('### 8. Viradas de clima por corrida (PVP 8 sintético, mítico lv1 base 60, elementos sorteados entre Fogo/Água/Grama; meta: média 0,8–1,6)');
log('');
log('| Métrica (' + N8 + ' corridas) | Valor |');
log('|---|---|');
log('| Média de viradas por corrida | **' + f2(v8) + '** |');
log('| Corridas com 0 viradas | ' + f1(pct(flipHist[0], N8)) + '% |');
log('| Corridas com 1 virada | ' + f1(pct(flipHist[1], N8)) + '% |');
log('| Corridas com 2 viradas | ' + f1(pct(flipHist[2], N8)) + '% |');
log('');

// ---------------------------------------------------------------------------
// 9) Determinismo
// ---------------------------------------------------------------------------
var detOk = true;
function detConfig(seed) {
  var rng = S.mulberry32(seed);
  var rs = [];
  var m = 4 + Math.floor(rng() * 5);
  for (var q = 0; q < m; q++) {
    var h = ALL[Math.floor(rng() * ALL.length)];
    var lg = Math.floor(rng() * 6);
    rs.push({ horse: h, gear: rng() < 0.6 ? GR.botGear(lg, h.element, rng()) : null, name: G.BOT_NAMES[q], isPlayer: q === 0 });
  }
  return { seed: seed, conditions: S.randomConditions(S.hash2(seed, 99)), racers: rs };
}
var firstRun = [];
for (var d9 = 0; d9 < 25; d9++) firstRun.push(JSON.stringify(S.simulate(detConfig(seedOf(900, d9)))));
for (var e9 = 24; e9 >= 0; e9--) { // ordem inversa: nenhum estado global vaza entre chamadas
  var again = JSON.stringify(S.simulate(detConfig(seedOf(900, e9))));
  if (again !== firstRun[e9]) detOk = false;
}
// sanidade dos frames
var sample = S.simulate(detConfig(seedOf(900, 3)));
var framesOk = sample.frames.length > 10 && sample.frames[0].t === 0 &&
  sample.frames.every(function (f, i) { return Math.abs(f.t - i * sample.dt) < 1e-9 && f.pos.length === sample.finishOrder.length; }) &&
  sample.finishOrder.slice().sort().join() === sample.finishOrder.map(function (x, i) { return i; }).join();
checkBool('9', 'Determinismo: mesma seed+config => mesmo mapa, mesmos dados, mesmo resultado (25 configs com equipamento de bot e mapas aleatórios, reexecução em ordem inversa)',
  detOk && framesOk, framesOk ? '' : 'frames inválidos');
var diffSeeds = JSON.stringify(S.simulate(detConfig(seedOf(900, 1)))) !== JSON.stringify(S.simulate(detConfig(seedOf(900, 2))));
checkBool('9', 'Seeds diferentes => corridas diferentes', diffSeeds);

// ---------------------------------------------------------------------------
// 10) Chance de skill observada x calculada, por raridade
// ---------------------------------------------------------------------------
// sem n(): com 500 corridas o erro-padrão (~2,2 p.p.) deixa o teste de ±3 p.p. instável no --quick;
// 2000 corridas (~1,1 p.p.) custam poucos segundos
var N10 = 2000;
log('### 10. Chance de skill: observada × calculada (lv1, Sorte 50, `Arranque`, ' + N10 + ' corridas em reta de 1600 m; meta: diferença ≤ 3 p.p.)');
log('');
log('| Raridade | Calculada (`skillChance`) | Observada | Diferença |');
log('|---|---|---|---|');
RAR_IDS.forEach(function (rid, ri) {
  var h = mk({ sorte: 50 }, 'Sint ' + rid);
  h.rarity = rid; h.skills = ['arranque'];
  var other = mk({}, 'Rival');
  var calc = 100 * S.skillChance(h, S.computeStats(h, null));
  var fired = 0;
  for (var k = 0; k < N10; k++) {
    var seed = seedOf(1000 + ri, k);
    if (countType(run(seed, RETA, [racer(h), racer(other)]), 'skill', 0) > 0) fired++;
  }
  var obs = pct(fired, N10);
  var diff = Math.abs(obs - calc);
  check('10', 'Skill ' + G.RARITIES[rid].name + ': observada ' + f1(obs) + '% × calculada ' + f1(calc) + '% (diferença)', diff, 0, 3, ' p.p.');
  log('| ' + G.RARITIES[rid].name + ' | ' + f1(calc) + '% | ' + f1(obs) + '% | ' + f1(diff) + ' p.p. |');
});
log('');

// ---------------------------------------------------------------------------
// Ligas (informativo: Rating de Poder sem equipamento)
// ---------------------------------------------------------------------------
log('### Ligas (Rating de Poder sem equipamento)');
log('');
log('Limites: ' + G.LEAGUES.map(function (L) { return L.name + ' ≥ ' + L.min; }).join(' · ') + '.');
log('');
log('| Montaria | Raridade | Lv | Rating | Liga |');
log('|---|---|---|---|---|');
function leagueRow(h, lv) {
  var c = clone(h, lv);
  var rt = S.powerRating(c, null);
  log('| ' + h.name + ' | ' + G.RARITIES[h.rarity].name + ' | ' + c.level + ' | ' + rt + ' | ' + S.leagueFor(rt).name + ' |');
}
STARTERS.forEach(function (h) { leagueRow(h, 1); });
STARTERS.forEach(function (h) { leagueRow(h, 25); });
WILD.forEach(function (h) { leagueRow(h, null); });
log('');

// ---------------------------------------------------------------------------
// Info extra
// ---------------------------------------------------------------------------
log('### Outros números (corridas do teste 1: iniciais lv1, mapas aleatórios)');
log('');
var E = info.racerEntries;
log('| Métrica | Valor |');
log('|---|---|');
log('| Garra disparou | ' + f1(pct(info.garra, E)) + '% dos corredores |');
log('| "Cansou" (estamina zerou antes dos últimos 2%) | ' + f1(pct(info.cansou, E)) + '% dos corredores |');
log('| Trocas de liderança narradas por corrida | ' + f2(info.ultrap / info.races) + ' |');
log('| Viradas de clima por corrida | ' + f2(info.clima / info.races) + ' |');
log('| Skills ativadas por corrida | ' + f2(info.skills / info.races) + ' (a simulação não expõe as tentativas; só as ativações) |');
log('');

log('### Resultado das metas');
log('');
log('| # | Meta | Valor | Faixa | OK |');
log('|---|---|---|---|---|');
results.forEach(function (r) {
  if (r.bool) log('| ' + r.id + ' | ' + r.label + ' | ' + (r.ok ? 'sim' : 'NÃO ' + (r.detail || '')) + ' | — | ' + (r.ok ? '✅' : '❌') + ' |');
  else {
    var fmt = r.unit === '' ? f2 : f1;
    log('| ' + r.id + ' | ' + r.label + ' | ' + fmt(r.value) + r.unit + ' | ' + String(r.lo).replace('.', ',') + '–' + String(r.hi).replace('.', ',') + r.unit + ' | ' + (r.ok ? '✅' : '❌') + ' |');
  }
});
var failed = results.filter(function (r) { return !r.ok; });
log('');
log(failed.length ? ('**' + failed.length + ' meta(s) falharam.**') : '**Todas as ' + results.length + ' metas passaram.**');
console.log(out.join('\n'));
console.error('[balance] ' + ((Date.now() - t0) / 1000).toFixed(1) + 's, ' + (failed.length ? failed.length + ' FALHA(S)' : 'OK'));
process.exit(failed.length ? 1 : 0);

// ---------------------------------------------------------------------------
// Corrida de exemplo (docs/exemplos.md)
// ---------------------------------------------------------------------------
function gearCell(g) {   // "5 peças (sol ×5)" / "2 peças" / "—"
  var np = g && g.pieces ? g.pieces.length : 0;
  if (!np) return '—';
  var txt = np + (np === 1 ? ' peça' : ' peças');
  return g.set && g.set.count ? txt + ' (' + g.set.id + ' ×' + g.set.count + ')' : txt;
}
function exemplo() {
  var byId = {}; ALL.forEach(function (h) { byId[h.id] = h; });
  var field = [
    { horse: clone(byId.ipe, 6), gear: GR.botGear(2, 'grama', 0.5), name: 'Você', isPlayer: true },
    { horse: clone(byId.brasa, 6), gear: GR.botGear(1, 'fogo', 0.5), name: G.BOT_NAMES[0], isPlayer: false },
    { horse: clone(byId.mare, 6), gear: null, name: G.BOT_NAMES[1], isPlayer: false },
    { horse: clone(byId['w-garoa']), gear: null, name: G.BOT_NAMES[2], isPlayer: false },
    { horse: clone(byId['w-ticao']), gear: null, name: G.BOT_NAMES[3], isPlayer: false },
    { horse: clone(byId['w-mandacaru']), gear: null, name: G.BOT_NAMES[4], isPlayer: false },
    { horse: clone(byId['w-ventania'], 4), gear: null, name: G.BOT_NAMES[5], isPlayer: false },
    { horse: clone(byId['w-pororoca'], 3), gear: null, name: G.BOT_NAMES[6], isPlayer: false }
  ];
  var si = args.indexOf('--seed');
  var seed = si >= 0 ? Number(args[si + 1]) : 20261119;
  var cond = S.randomConditions(seed);
  var res = S.simulate({ seed: seed, conditions: cond, racers: field });
  var pay = S.payouts(100, field.length, res.finishOrder);
  var lines = [];
  lines.push('Mapa `randomConditions(' + seed + ')`: ' + cond.distance + ' m, piso ' + G.SURFACES[cond.surface].name +
    ', clima inicial ' + G.WEATHERS[cond.weather].name + ', clima final ' + G.WEATHERS[res.weatherFinal].name + ', seed ' + seed + '.');
  lines.push('');
  lines.push('Blocos:');
  lines.push('');
  cond.blocks.forEach(function (b) { lines.push('- ' + b.type + ' ' + b.from + '–' + b.to + ' m'); });
  lines.push('');
  lines.push('| Raia | Jogador | Cavalo | Elem. | Rar. | Sexo | Lv | Equip. | VEL/ACE/MAN/FOR/EST/GAR/SOR | Rating | Skills % |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  field.forEach(function (r, i) {
    var s = S.computeStats(r.horse, r.gear);
    var ch = Math.round(100 * res.racerInfo[i].skillChance);
    var sk = (r.horse.skills || []).map(function (id) { return G.SKILLS[id].name; }).join(', ');
    lines.push('| ' + (i + 1) + ' | ' + r.name + ' | ' + r.horse.name + ' | ' + G.ELEMENTS[r.horse.element].name + ' | ' + G.RARITIES[r.horse.rarity].name + ' | ' +
      (r.horse.sex === 'f' ? 'F' : 'M') + ' | ' + r.horse.level + ' | ' + gearCell(r.gear) + ' | ' +
      G.STAT_KEYS.map(function (k) { return s[k]; }).join('/') + ' | ' + S.powerRating(r.horse, r.gear) + ' | ' +
      (sk ? sk + ' (' + ch + '%)' : '—') + ' |');
  });
  lines.push('');
  lines.push('| Pos | Jogador | Cavalo | Tempo | Prêmio |');
  lines.push('|---|---|---|---|---|');
  res.finishOrder.forEach(function (ri, k) {
    var pr = pay.prizes.filter(function (x) { return x.racer === ri; })[0];
    lines.push('| ' + (k + 1) + 'º | ' + field[ri].name + ' | ' + field[ri].horse.name + ' | ' + res.finishTimes[ri].toFixed(2).replace('.', ',') + ' s | ' +
      (pr ? pr.amount + ' Ouro' : '—') + ' |');
  });
  lines.push('');
  lines.push('Pote ' + pay.pot + ' · taxa ' + pay.fee + ' · duração ' + f2(res.duration) + ' s · ' + res.frames.length + ' frames');
  lines.push('');
  lines.push('```');
  res.events.forEach(function (e) { lines.push('[' + e.t.toFixed(1).replace('.', ',') + 's] (' + e.type + ') ' + e.text); });
  lines.push('```');
  console.log(lines.join('\n'));
}
