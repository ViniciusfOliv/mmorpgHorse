#!/usr/bin/env node
/*
 * Relatório de balanceamento do RaceSim.
 *
 *   node tools/balance.js            # relatório completo (milhares de corridas)
 *   node tools/balance.js --quick    # 1/4 das corridas (iteração rápida)
 *   node tools/balance.js --tune '{"formRange":0.04}'   # sobrescreve RaceSim.TUNING (só p/ ajuste)
 *   node tools/balance.js --exemplo  # imprime a corrida de exemplo usada em docs/exemplos.md
 *
 * Sai com código 1 se alguma meta falhar.
 */
'use strict';

var G = require('../src/data.js');
var S = require('../src/sim.js');

var args = process.argv.slice(2);
var QUICK = args.indexOf('--quick') >= 0;
var tuneIdx = args.indexOf('--tune');
if (tuneIdx >= 0) {
  var over = JSON.parse(args[tuneIdx + 1]);
  deepAssign(S.TUNING, over);
}
var SCALE = QUICK ? 0.25 : 1;

var TACTICS = ['ponteiro', 'perseguidor', 'arrancador'];
var TAC_NAME = { ponteiro: 'Ponteiro', perseguidor: 'Perseguidor', arrancador: 'Arrancador' };
var STARTERS = G.STARTERS;
var WILD = G.WILD_HORSES;

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
function n(x) { return Math.max(1, Math.round(x * SCALE)); }
function seedOf(test, k) { return S.hash2(test * 7919 + 13, k); }
function pickTactic(seed, i) { return TACTICS[Math.floor(S.mulberry32(S.hash2(seed, 900 + i))() * 3)]; }
function pct(a, b) { return b ? (100 * a / b) : 0; }
function f1(x) { return x.toFixed(1); }
function pad(s, w) { s = String(s); while (s.length < w) s += ' '; return s; }
function run(seed, conditions, racers) {
  return S.simulate({ seed: seed, conditions: conditions, racers: racers, recordFrames: false });
}
function racer(h, tactic, itemId, name) {
  return { horse: h, itemId: itemId || null, tactic: tactic, name: name || h.name, isPlayer: false };
}
function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
function quant(a, q) { var b = a.slice().sort(function (x, y) { return x - y; }); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))] : 0; }

var results = [];
function check(id, label, value, lo, hi, unit) {
  var ok = value >= lo && value <= hi;
  results.push({ id: id, label: label, value: value, lo: lo, hi: hi, ok: ok, unit: unit || '%' });
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
// 1) Iniciais no mesmo level, condições aleatórias
// ---------------------------------------------------------------------------
var durByDist = { 1000: [], 1600: [], 2400: [] };
var winTimeByDist = { 1000: [], 1600: [], 2400: [] };
var info = { races: 0, cansou: 0, garra: 0, ultrap: 0, skills: 0, racerEntries: 0 };
var starterByDist = {};

function test1(level, N, collect) {
  var wins = [0, 0, 0];
  var distWins = { 1000: [0, 0, 0], 1600: [0, 0, 0], 2400: [0, 0, 0] };
  var distCount = { 1000: 0, 1600: 0, 2400: 0 };
  var hs = STARTERS.map(function (h) { return clone(h, level); });
  for (var k = 0; k < N; k++) {
    var seed = seedOf(level === 1 ? 1 : 100 + level, k);
    var cond = S.randomConditions(seed);
    var rs = hs.map(function (h, i) { return racer(h, pickTactic(seed, i)); });
    var res = run(seed, cond, rs);
    var w = res.finishOrder[0];
    wins[w]++; distWins[cond.distance][w]++; distCount[cond.distance]++;
    if (collect) {
      durByDist[cond.distance].push(res.duration);
      winTimeByDist[cond.distance].push(res.finishTimes[w]);
      info.races++; info.racerEntries += rs.length;
      res.events.forEach(function (e) {
        if (e.type === 'cansou') info.cansou++;
        else if (e.type === 'garra') info.garra++;
        else if (e.type === 'ultrapassagem') info.ultrap++;
        else if (e.type === 'skill') info.skills++;
      });
    }
  }
  return { wins: wins, N: N, distWins: distWins, distCount: distCount };
}

var N1 = n(6000);
var r1 = test1(1, N1, true);
var r1b = test1(25, n(3000), false);

log('## Relatório de balanceamento');
log('');
log('Gerado por `node tools/balance.js`' + (QUICK ? ' --quick' : '') + '. Táticas sorteadas por corredor, sem itens, salvo indicação.');
log('');
log('### 1. Iniciais no mesmo level, condições aleatórias (meta: 28%–39% cada)');
log('');
log('| Inicial | Vitórias lv1 (' + N1 + ' corridas) | Curta | Média | Longa | Vitórias lv25 (' + r1b.N + ') |');
log('|---|---|---|---|---|---|');
STARTERS.forEach(function (h, i) {
  var v = pct(r1.wins[i], r1.N);
  check('1', h.name + ' lv1', v, 28, 39);
  check('1', h.name + ' lv25', pct(r1b.wins[i], r1b.N), 28, 39);
  log('| ' + h.name + ' | **' + f1(v) + '%** | ' + f1(pct(r1.distWins[1000][i], r1.distCount[1000])) + '% | ' +
    f1(pct(r1.distWins[1600][i], r1.distCount[1600])) + '% | ' + f1(pct(r1.distWins[2400][i], r1.distCount[2400])) + '% | ' +
    f1(pct(r1b.wins[i], r1b.N)) + '% |');
});
log('');

// ---------------------------------------------------------------------------
// 2) Inicial em condição claramente favorável
// ---------------------------------------------------------------------------
var FAVORABLE = {
  brasa: { distance: 1000, surface: 'grama', weather: 'sol', hills: [] },
  mare: { distance: 2400, surface: 'grama', weather: 'chuva', hills: [] },
  ipe: { distance: 1600, surface: 'terra', weather: 'nublado', hills: [[450, 650], [1050, 1220]] }
};
var N2 = n(3000);
log('### 2. Inicial em condição favorável vs os outros dois (meta: 45%–65%)');
log('');
log('| Inicial | Condição | Afinidades | Vitórias (' + N2 + ') |');
log('|---|---|---|---|');
STARTERS.forEach(function (h, i) {
  var cond = FAVORABLE[h.id];
  var wins = 0;
  for (var k = 0; k < N2; k++) {
    var seed = seedOf(200 + i, k);
    var rs = STARTERS.map(function (x, j) { return racer(clone(x, 1), pickTactic(seed, j)); });
    var res = run(seed, cond, rs);
    if (res.finishOrder[0] === i) wins++;
  }
  var v = pct(wins, N2);
  check('2', h.name + ' favorável', v, 45, 65);
  var condTxt = G.DISTANCES[cond.distance].label + ', ' + G.SURFACES[cond.surface].name + ', ' + G.WEATHERS[cond.weather].name + (cond.hills.length ? ', ' + cond.hills.length + ' subidas' : '');
  var affs = STARTERS.map(function (x) { var a = S.elementAffinity(x.element, cond); return x.name + ' ×' + a.mult.toFixed(2); }).join(' · ');
  log('| ' + h.name + ' | ' + condTxt + ' | ' + affs + ' | **' + f1(v) + '%** |');
});
log('');

// ---------------------------------------------------------------------------
// 3) Táticas em corrida-espelho (mesmo cavalo x4)
// ---------------------------------------------------------------------------
var N3 = n(3000);
var tacAgg = { ponteiro: [0, 0], perseguidor: [0, 0], arrancador: [0, 0] };
var tacDist = {};
[1000, 1600, 2400].forEach(function (d) { tacDist[d] = { ponteiro: [0, 0], perseguidor: [0, 0], arrancador: [0, 0] }; });
var tacPerHorse = [];
var mirrorHorses = STARTERS.concat([WILD.filter(function (h) { return h.id === 'w-ventania'; })[0]]);
mirrorHorses.forEach(function (h, hi) {
  var per = { ponteiro: [0, 0], perseguidor: [0, 0], arrancador: [0, 0] };
  var hh = clone(h, 1);
  for (var k = 0; k < N3; k++) {
    var seed = seedOf(300 + hi, k);
    var cond = S.randomConditions(seed);
    var tacs = TACTICS.concat([TACTICS[k % 3]]);
    // embaralha posição de largada (determinístico)
    var rng = S.mulberry32(S.hash2(seed, 31337));
    for (var q = tacs.length - 1; q > 0; q--) { var z = Math.floor(rng() * (q + 1)); var tmp = tacs[q]; tacs[q] = tacs[z]; tacs[z] = tmp; }
    var rs = tacs.map(function (tc) { return racer(hh, tc); });
    var res = run(seed, cond, rs);
    var w = res.finishOrder[0];
    tacs.forEach(function (tc, j) {
      per[tc][1]++; tacAgg[tc][1]++; tacDist[cond.distance][tc][1]++;
      if (j === w) { per[tc][0]++; tacAgg[tc][0]++; tacDist[cond.distance][tc][0]++; }
    });
  }
  tacPerHorse.push({ name: h.name + (h.level !== 1 ? ' (lv1)' : ''), per: per });
});
log('### 3. Táticas em corrida-espelho: 4× o mesmo cavalo, condições aleatórias (meta: 18%–35% por tática)');
log('');
log('Taxa = vitórias da tática / participações da tática (base = 25%). ' + N3 + ' corridas por cavalo.');
log('');
log('| Tática | Geral | Curta | Média | Longa | ' + tacPerHorse.map(function (x) { return x.name; }).join(' | ') + ' |');
log('|---|---|---|---|---|' + tacPerHorse.map(function () { return '---|'; }).join(''));
TACTICS.forEach(function (tc) {
  var v = pct(tacAgg[tc][0], tacAgg[tc][1]);
  check('3', TAC_NAME[tc] + ' (geral)', v, 18, 35);
  tacPerHorse.forEach(function (x) { check('3', TAC_NAME[tc] + ' c/ ' + x.name, pct(x.per[tc][0], x.per[tc][1]), 18, 35); });
  log('| ' + TAC_NAME[tc] + ' | **' + f1(v) + '%** | ' +
    [1000, 1600, 2400].map(function (d) { return f1(pct(tacDist[d][tc][0], tacDist[d][tc][1])) + '%'; }).join(' | ') + ' | ' +
    tacPerHorse.map(function (x) { return f1(pct(x.per[tc][0], x.per[tc][1])) + '%'; }).join(' | ') + ' |');
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
    // alterna a posição de largada
    var pair = (k % 2 === 0) ? [a, b] : [b, a];
    var rs = pair.map(function (h, j) { return racer(h, pickTactic(seed, j)); });
    var res = run(seed, cond, rs);
    var winner = pair[res.finishOrder[0]];
    if (winner === a) winsA++;
  }
  return winsA;
}
var comuns = WILD.filter(function (h) { return h.rarity === 'comum'; });
var lendarios = WILD.filter(function (h) { return h.rarity === 'lendario'; });
var raros = STARTERS.concat(WILD.filter(function (h) { return h.rarity === 'raro'; }));
var N4 = n(1500);
var aggW = 0, aggN = 0, rows4a = [];
lendarios.forEach(function (L, li) {
  comuns.forEach(function (C, ci) {
    var w = duel(clone(L, 1), clone(C, 1), N4, 400 + li * 10 + ci);
    aggW += w; aggN += N4;
    rows4a.push('| ' + L.name + ' lv1 × ' + C.name + ' lv1 | ' + f1(pct(w, N4)) + '% |');
  });
});
var v4a = pct(aggW, aggN);
check('4a', 'Lendário lv1 vence Comum lv1', v4a, 75, 92);
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
check('4b', 'Comum lv25 vence Raro lv1', v4b, 35, 65);
log('### 4. Raridade × level, duelos 1v1 com condições aleatórias');
log('');
log('| Duelo | Vitórias do 1º |');
log('|---|---|');
log('| **Lendário lv1 × Comum lv1 (média, meta 75%–92%)** | **' + f1(v4a) + '%** |');
rows4a.forEach(function (r) { log(r); });
log('| **Comum lv25 × Raro lv1 (média, meta 35%–65%)** | **' + f1(v4b) + '%** |');
rows4b.forEach(function (r) { log(r); });
log('');

// ---------------------------------------------------------------------------
// 5) Duração das corridas
// ---------------------------------------------------------------------------
// Campo PVP misto: 8 cavalos de liga parecida (rating ±120 do sorteado)
var allHorses = STARTERS.concat(WILD);
var mixDur = { 1000: [], 1600: [], 2400: [] };
var N5 = n(1500);
for (var k5 = 0; k5 < N5; k5++) {
  var seed5 = seedOf(600, k5);
  var cond5 = S.randomConditions(seed5);
  var rng5 = S.mulberry32(S.hash2(seed5, 4242));
  var pool5 = allHorses.slice();
  var anchor = pool5[Math.floor(rng5() * pool5.length)];
  var ar = S.powerRating(anchor, null);
  var near = pool5.filter(function (h) { return Math.abs(S.powerRating(h, null) - ar) <= 120; });
  var rs5 = [];
  for (var q5 = 0; q5 < 8; q5++) rs5.push(racer(near[Math.floor(rng5() * near.length)], pickTactic(seed5, q5)));
  mixDur[cond5.distance].push(run(seed5, cond5, rs5).duration);
}
log('### 5. Duração (tempo de simulação até o último cruzar a linha)');
log('');
log('| Distância | Iniciais lv1: média (p5–p95) | Vencedor: média | Campo PVP de 8 (mesma liga): média (p5–p95) | Meta |');
log('|---|---|---|---|---|');
[1000, 1600, 2400].forEach(function (d) {
  var a = durByDist[d], m = mixDur[d];
  var meta = d === 1000 ? '55–70s' : (d === 2400 ? '140–170s' : '—');
  if (d === 1000) { check('5', 'Duração 1000m (iniciais)', mean(a), 55, 70, 's'); check('5', 'Duração 1000m (PVP 8)', mean(m), 55, 70, 's'); }
  if (d === 2400) { check('5', 'Duração 2400m (iniciais)', mean(a), 140, 170, 's'); check('5', 'Duração 2400m (PVP 8)', mean(m), 140, 170, 's'); }
  log('| ' + d + ' m | ' + f1(mean(a)) + 's (' + f1(quant(a, 0.05)) + '–' + f1(quant(a, 0.95)) + ') | ' + f1(mean(winTimeByDist[d])) + 's | ' +
    f1(mean(m)) + 's (' + f1(quant(m, 0.05)) + '–' + f1(quant(m, 0.95)) + ') | ' + meta + ' |');
});
log('');

// ---------------------------------------------------------------------------
// 6) Pagamentos
// ---------------------------------------------------------------------------
var payOk = true, payDetail = [];
G.ECONOMY.entryTiers.forEach(function (fee) {
  for (var nr = 4; nr <= 8; nr++) {
    var order = []; for (var q = 0; q < nr; q++) order.push((q * 3 + 1) % nr);
    var p = S.payouts(fee, nr, order);
    var sum = p.prizes.reduce(function (s, x) { return s + x.amount; }, 0);
    var ints = [p.pot, p.fee].concat(p.prizes.map(function (x) { return x.amount; })).every(function (x) { return Number.isInteger(x) && x >= 0; });
    var ok = ints && sum + p.fee === p.pot && p.pot === fee * nr && p.prizes.length === 3 &&
      p.prizes[0].racer === order[0] && p.prizes[1].racer === order[1] && p.prizes[2].racer === order[2];
    if (!ok) { payOk = false; payDetail.push(fee + 'x' + nr); }
  }
});
checkBool('6', 'Pagamentos: soma(prêmios)+taxa == pote, inteiros (4..8 corredores × ' + G.ECONOMY.entryTiers.join('/') + ')', payOk, payDetail.join(','));
log('### 6. Pagamentos (pote = entrada × corredores; taxa ' + (G.ECONOMY.houseFee * 100) + '%; 60/25/15)');
log('');
log('| Entrada | Corredores | Pote | Taxa | 1º | 2º | 3º |');
log('|---|---|---|---|---|---|---|');
G.ECONOMY.entryTiers.forEach(function (fee) {
  [4, 6, 8].forEach(function (nr) {
    var p = S.payouts(fee, nr, [0, 1, 2, 3, 4, 5, 6, 7].slice(0, nr));
    log('| ' + fee + ' | ' + nr + ' | ' + p.pot + ' | ' + p.fee + ' | ' + p.prizes.map(function (x) { return x.amount; }).join(' | ') + ' |');
  });
});
log('');

// ---------------------------------------------------------------------------
// 7) Determinismo
// ---------------------------------------------------------------------------
var detOk = true;
var itemIds = Object.keys(G.ITEMS);
function detConfig(seed) {
  var rng = S.mulberry32(seed);
  var rs = [];
  var m = 4 + Math.floor(rng() * 5);
  for (var q = 0; q < m; q++) {
    var h = allHorses[Math.floor(rng() * allHorses.length)];
    rs.push({ horse: h, itemId: rng() < 0.6 ? itemIds[Math.floor(rng() * itemIds.length)] : null, tactic: TACTICS[Math.floor(rng() * 3)], name: G.BOT_NAMES[q], isPlayer: q === 0 });
  }
  return { seed: seed, conditions: rng() < 0.5 ? S.randomConditions(seed) : G.TRACK_EXAMPLES[Math.floor(rng() * G.TRACK_EXAMPLES.length)], racers: rs };
}
var firstRun = [];
for (var d7 = 0; d7 < 25; d7++) firstRun.push(JSON.stringify(S.simulate(detConfig(seedOf(700, d7)))));
for (var e7 = 24; e7 >= 0; e7--) { // ordem inversa: nenhum estado global vaza entre chamadas
  var again = JSON.stringify(S.simulate(detConfig(seedOf(700, e7))));
  if (again !== firstRun[e7]) detOk = false;
}
// sanidade dos frames
var sample = S.simulate(detConfig(seedOf(700, 3)));
var framesOk = sample.frames.length > 10 && sample.frames[0].t === 0 &&
  sample.frames.every(function (f, i) { return Math.abs(f.t - i * sample.dt) < 1e-9 && f.pos.length === sample.finishOrder.length; }) &&
  sample.finishOrder.slice().sort().join() === sample.finishOrder.map(function (x, i) { return i; }).join();
checkBool('7', 'Determinismo: mesma seed+config => saída idêntica (25 configs, com itens e pistas de exemplo)', detOk && framesOk, framesOk ? '' : 'frames inválidos');
var sameSeedDiffCond = JSON.stringify(S.simulate(detConfig(seedOf(700, 1)))) !== JSON.stringify(S.simulate(detConfig(seedOf(700, 2))));
checkBool('7', 'Seeds diferentes => corridas diferentes', sameSeedDiffCond);

// ---------------------------------------------------------------------------
// Info extra
// ---------------------------------------------------------------------------
log('### Outros números (corridas do teste 1)');
log('');
var E = info.racerEntries;
log('| Métrica | Valor |');
log('|---|---|');
log('| Garra disparou | ' + f1(pct(info.garra, E)) + '% dos corredores |');
log('| "Cansou" (estamina zerou antes dos últimos 2%) | ' + f1(pct(info.cansou, E)) + '% dos corredores |');
log('| Trocas de liderança narradas por corrida | ' + (info.ultrap / info.races).toFixed(2) + ' |');
log('| Habilidades ativadas por corrida | ' + (info.skills / info.races).toFixed(2) + ' |');
log('');

log('### Resultado das metas');
log('');
log('| # | Meta | Valor | Faixa | OK |');
log('|---|---|---|---|---|');
results.forEach(function (r) {
  if (r.bool) log('| ' + r.id + ' | ' + r.label + ' | ' + (r.ok ? 'sim' : 'NÃO ' + (r.detail || '')) + ' | — | ' + (r.ok ? '✅' : '❌') + ' |');
  else log('| ' + r.id + ' | ' + r.label + ' | ' + f1(r.value) + r.unit + ' | ' + r.lo + '–' + r.hi + r.unit + ' | ' + (r.ok ? '✅' : '❌') + ' |');
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
function exemplo() {
  var track = G.TRACK_EXAMPLES.filter(function (t) { return t.id === 'raia-sertao'; })[0];
  var byId = {}; allHorses.forEach(function (h) { byId[h.id] = h; });
  var field = [
    { horse: clone(byId.brasa, 6), itemId: 'esporas-prata', tactic: 'ponteiro', name: 'Você', isPlayer: true },
    { horse: clone(byId.mare, 6), itemId: 'manta-la', tactic: 'perseguidor', name: G.BOT_NAMES[0], isPlayer: false },
    { horse: clone(byId.ipe, 6), itemId: 'ferradura-cravos', tactic: 'perseguidor', name: G.BOT_NAMES[1], isPlayer: false },
    { horse: byId['w-garoa'], itemId: null, tactic: 'arrancador', name: G.BOT_NAMES[2], isPlayer: false },
    { horse: byId['w-ticao'], itemId: 'ferradura-leve', tactic: 'ponteiro', name: G.BOT_NAMES[3], isPlayer: false },
    { horse: byId['w-mandacaru'], itemId: 'sela-couro', tactic: 'arrancador', name: G.BOT_NAMES[4], isPlayer: false },
    { horse: clone(byId['w-ventania'], 4), itemId: null, tactic: 'perseguidor', name: G.BOT_NAMES[5], isPlayer: false },
    { horse: clone(byId['w-pororoca'], 3), itemId: null, tactic: 'arrancador', name: G.BOT_NAMES[6], isPlayer: false }
  ];
  var seed = 20261105;
  var res = S.simulate({ seed: seed, conditions: track, racers: field });
  var pay = S.payouts(100, field.length, res.finishOrder);
  var lines = [];
  lines.push('Pista: ' + track.name + ' — ' + track.distance + ' m, ' + track.surface + ', ' + track.weather + ', subidas ' + JSON.stringify(track.hills) + ', seed ' + seed);
  lines.push('');
  lines.push('| Raia | Jogador | Cavalo | Elem. | Rar. | Lv | Item | Tática | VEL/ACE/EST/FOR/GAR | Rating | Afinidade |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  field.forEach(function (r, i) {
    var s = S.computeStats(r.horse, r.itemId);
    var a = S.elementAffinity(r.horse.element, track);
    lines.push('| ' + (i + 1) + ' | ' + r.name + ' | ' + r.horse.name + ' | ' + G.ELEMENTS[r.horse.element].name + ' | ' + G.RARITIES[r.horse.rarity].name + ' | ' + r.horse.level + ' | ' +
      (r.itemId ? G.ITEMS[r.itemId].name : '—') + ' | ' + TAC_NAME[r.tactic] + ' | ' + [s.vel, s.acel, s.est, s.forca, s.garra].join('/') + ' | ' +
      S.powerRating(r.horse, r.itemId) + ' | ×' + a.mult.toFixed(2) + (a.reasons.length ? ' (' + a.reasons.join('; ') + ')' : '') + ' |');
  });
  lines.push('');
  lines.push('| Pos. | Jogador | Cavalo | Tempo | Prêmio |');
  lines.push('|---|---|---|---|---|');
  res.finishOrder.forEach(function (ri, k) {
    var pr = pay.prizes.filter(function (x) { return x.racer === ri; })[0];
    lines.push('| ' + (k + 1) + 'º | ' + field[ri].name + ' | ' + field[ri].horse.name + ' | ' + res.finishTimes[ri].toFixed(2).replace('.', ',') + 's | ' + (pr ? pr.amount + ' Ouro' : '—') + ' |');
  });
  lines.push('');
  lines.push('Pote ' + pay.pot + ' · taxa ' + pay.fee + ' · duração ' + res.duration + 's · ' + res.frames.length + ' frames');
  lines.push('');
  res.events.forEach(function (e) { lines.push('[' + e.t.toFixed(1).replace('.', ',') + 's] (' + e.type + ') ' + e.text); });
  console.log(lines.join('\n'));
}
