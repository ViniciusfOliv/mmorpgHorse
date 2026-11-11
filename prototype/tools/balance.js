#!/usr/bin/env node
/*
 * Relatório de balanceamento v3 do RaceSim (status v3: genética, pontos livres, estrelas e skill de
 * tipo; mapas em blocos, clima como triângulo, Dado da Sorte, skills com chance; sem tática).
 *
 *   node tools/balance.js            # relatório completo (todas as metas)
 *   node tools/balance.js --quick    # menos corridas; as metas ruidosas demais (M6, M9, P1, S1, A1) só no completo
 *   node tools/balance.js --tune '{"curveBase":0.84}'   # sobrescreve RaceSim.TUNING (só p/ ajuste)
 *   node tools/balance.js --exemplo  # imprime a corrida de exemplo usada em docs/exemplos.md
 *
 * Sai com código 1 se alguma meta falhar.
 *
 * As metas M1–M9 vêm da calibração do modelo v3 (spec 2026-11-10-cavalos-v3, seção 12) e usam o
 * mesmo método e as mesmas seeds: cavalos sintéticos com genética sorteada pela seed, skills normais
 * sorteadas (as nascidas + as aprendidas esperadas pelo nível) e pontos livres por uma política
 * nomeada (`bot` = RaceSim.botAlloc). Duelos com largada alternada em mapa aleatório e Dado ligado;
 * comparações pareadas (mesma seed, mesmo mapa e mesmos rivais, com e sem a mudança).
 *
 * Toda simulação roda em worker_threads (módulo do próprio Node, sem dependência): cada medição é
 * cortada em pedaços fixos de k, e as somas são juntadas na ordem dos pedaços; o resultado não
 * depende de quantos núcleos a máquina tem.
 */
'use strict';

var G = require('../src/data.js');
var S = require('../src/sim.js');
var GR = require('../src/gear.js');
var WT = require('worker_threads');

var args = process.argv.slice(2);
var QUICK = args.indexOf('--quick') >= 0;
var tuneIdx = args.indexOf('--tune');
if (tuneIdx >= 0) deepAssign(S.TUNING, JSON.parse(args[tuneIdx + 1]));
var SCALE = QUICK ? 0.25 : 1;

var STARTERS = G.STARTERS;
var ALL = STARTERS.concat(G.WILD_HORSES);
var RAR_IDS = Object.keys(G.RARITIES);
var KEYS = G.STAT_KEYS;
var RACE = ['vel', 'acel', 'man', 'forca', 'est', 'garra'];   // os seis de corrida (Sorte fica de fora)
var EL3 = ['fogo', 'agua', 'grama'];
var RAR = ['comum', 'magico', 'raro', 'lendario', 'mitico'];
var TYPE_STATS = { fogo: ['vel', 'acel'], agua: ['est', 'garra'], grama: ['forca', 'man'] };

// mapas sintéticos (os mesmos de tools/sim-test.js)
var MAPS = {
  CURVA: { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 200 }, { type: 'curva', from: 200, to: 1400 }, { type: 'reta', from: 1400, to: 1600 }] },
  RETA: { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 1600 }] },
  SUBIDA: { distance: 1600, surface: 'grama', weather: 'nublado', blocks: [{ type: 'reta', from: 0, to: 200 }, { type: 'subida', from: 200, to: 1400 }, { type: 'reta', from: 1400, to: 1600 }] }
};

function deepAssign(dst, src) {
  for (var k in src) {
    if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') deepAssign(dst[k], src[k]);
    else dst[k] = src[k];
  }
}
function copy(x) { return JSON.parse(JSON.stringify(x)); }
// Montaria do catálogo no nível dado, com a build dos bots.
function cat(h, level) {
  var c = copy(h);
  if (level != null) c.level = level;
  c.alloc = S.botAlloc(c);
  return c;
}
function n(x) { return Math.max(1, Math.round(x * SCALE)); }
function seedOf(test, k) { return S.hash2(test * 7919 + 13, k); }
function rngOf(seed, salt) { return S.mulberry32(S.hash2(seed, salt)); }
function pct(a, b) { return b ? (100 * a / b) : 0; }
function f1(x) { return x.toFixed(1).replace('.', ','); }
function f2(x) { return x.toFixed(2).replace('.', ','); }
function run(seed, conditions, racers, frames) {
  return S.simulate({ seed: seed, conditions: conditions, racers: racers, recordFrames: !!frames });
}
function racer(h, extra) {
  var r = { horse: h, gear: null, name: h.name, isPlayer: false };
  if (extra) for (var k in extra) r[k] = extra[k];
  return r;
}
function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
function quant(a, q) { var b = a.slice().sort(function (x, y) { return x - y; }); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))] : 0; }
// Conta eventos de um tipo; os de skill de tipo (typeSkill) ficam de fora: a skill de tipo é sempre ativa.
function countType(res, type, racerIdx) {
  var c = 0;
  for (var i = 0; i < res.events.length; i++) {
    var e = res.events[i];
    if (e.type === type && !e.typeSkill && (racerIdx == null || e.racer === racerIdx)) c++;
  }
  return c;
}
// terços da faixa de distância (1.400–2.000 m)
function distGroup(d) { return d < 1600 ? 0 : (d < 1800 ? 1 : 2); }
var GROUPS = ['curta', 'media', 'longa'];
var GROUP_LABEL = ['curta (1.400–1.599 m)', 'média (1.600–1.799 m)', 'longa (1.800–2.000 m)'];
function ci(sum, sum2, N) {   // média e IC 95% de uma diferença pareada (−1/0/+1), em p.p.
  var m = sum / N, v = (sum2 - N * m * m) / Math.max(1, N - 1);
  return [100 * m, 100 * 1.96 * Math.sqrt(Math.max(0, v) / N)];
}
function pciB(w, N) { var p = w / N; return [100 * p, 100 * 1.96 * Math.sqrt(p * (1 - p) / Math.max(1, N))]; }

// ---------------------------------------------------------------------------
// Cavalos sintéticos (os da calibração): genética explícita e pontos livres por política
// ---------------------------------------------------------------------------
// Políticas de distribuição dos pontos livres. Um status aceita ponto enquanto natural + pontos <
// teto e pontos < limite por status (statLimit); a sobra vai para Sorte e depois, em rodízio, para os
// seis de corrida que ainda aceitam.
//   bot          RaceSim.botAlloc (a build fixa dos bots do jogo)
//   tudoVel      enche Velocidade até o limite, o resto em rodízio
//   tudoForca    enche Força até o limite, o resto em rodízio
//   equilibrada  rodízio de um ponto nos seis de corrida
//   fortesDoTipo rodízio nos dois status do tipo, depois nos outros quatro
//   cobreFraco   um ponto por vez no status mais baixo
var POLICIES = ['bot', 'tudoVel', 'tudoForca', 'equilibrada', 'fortesDoTipo', 'cobreFraco'];
function allocate(horse, policy) {
  if (policy === 'bot') return S.botAlloc(horse);
  var total = S.freePoints(horse), cap = G.RARITIES[horse.rarity].statCap, lim = S.statLimit(horse);
  var nat = {}, a = {};
  KEYS.forEach(function (k) { nat[k] = S.naturalStat(horse, k); a[k] = 0; });
  function open(k) { return nat[k] + a[k] < cap && a[k] < lim; }
  function give(k) { a[k]++; total--; }
  function rr(list) {   // rodízio de um ponto na lista, pulando os que não aceitam
    var i = 0, guard = 0;
    while (total > 0 && guard < 10000) {
      var k = list[i % list.length]; i++; guard++;
      if (open(k)) { give(k); guard = 0; } else if (list.every(function (x) { return !open(x); })) break;
    }
  }
  function fill(list) { list.forEach(function (k) { while (total > 0 && open(k)) give(k); }); }
  function lowest(list) {
    while (total > 0) {
      var best = null;
      list.forEach(function (k) { if (open(k) && (best == null || nat[k] + a[k] < nat[best] + a[best] - 1e-9)) best = k; });
      if (!best) break;
      give(best);
    }
  }
  var ts = TYPE_STATS[horse.element];
  var others = RACE.filter(function (k) { return ts.indexOf(k) < 0; });
  if (policy === 'tudoVel') { fill(['vel']); rr(RACE.filter(function (k) { return k !== 'vel'; })); }
  else if (policy === 'tudoForca') { fill(['forca']); rr(RACE.filter(function (k) { return k !== 'forca'; })); }
  else if (policy === 'equilibrada') rr(RACE);
  else if (policy === 'fortesDoTipo') { rr(ts); rr(others); }
  else if (policy === 'cobreFraco') lowest(RACE);
  else throw new Error('política desconhecida: ' + policy);
  if (total > 0) { while (total > 0 && open('sorte')) give('sorte'); rr(RACE); }
  return a;
}
function pickEl(rng) { return EL3[Math.floor(rng() * 3)]; }
function rollG(rng) { var g = {}; KEYS.forEach(function (k) { g[k] = Math.floor(rng() * 32); }); return g; }
// forma por tipo (M9): os 2 maiores valores nos status do tipo, depois 2, depois 3
var TYPE_ORDER = { fogo: ['vel', 'acel', 'man', 'garra', 'forca', 'est', 'sorte'], agua: ['est', 'garra', 'vel', 'forca', 'acel', 'man', 'sorte'], grama: ['man', 'forca', 'vel', 'est', 'acel', 'garra', 'sorte'] };
function shapeG(vals, el) { var v = vals.slice().sort(function (a, b) { return b - a; }), g = {}; TYPE_ORDER[el].forEach(function (k, i) { g[k] = v[i]; }); return g; }
function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
// skills normais: as nascidas + as aprendidas esperadas pelo nível (learnChance), até as vagas, na
// ordem sorteada `order` (só as que o tipo aprende)
function skillsFor(el, rarity, level, order) {
  var R = G.RARITIES[rarity];
  var nS = Math.min(R.skillSlots, R.bornSkills + Math.floor((level - 1) * S.TUNING.learnChance));
  return order.filter(function (id) { var s = G.SKILLS[id]; return s.element === 'geral' || s.element === el; }).slice(0, nS);
}
function mkHorse(o) {
  var h = { id: o.id || 'x', name: o.name || 'X', especie: 'cavalo', element: o.element, rarity: o.rarity,
    grau: o.grau || 2, level: o.level || 1, sex: 'm', potential: {}, skills: o.skills || [] };
  KEYS.forEach(function (k) { h.potential[k] = typeof o.g === 'number' ? o.g : o.g[k]; });
  h.alloc = allocate(h, o.policy || 'bot');
  return h;
}
// Monta um cavalo a partir de uma spec { rarity, level, grau, policy, element ('rand' sorteia), g
// (número, objeto ou sorteada), skills: false (sem skills normais) }. sh guarda o que A e B
// compartilham (g, order das skills, el). Ordem das chamadas de rng: elemento, genética, ordem das skills.
function build(spec, rng, sh, name) {
  var el = spec.element && spec.element !== 'rand' ? spec.element : (sh.el || pickEl(rng));
  var g;
  if (typeof spec.g === 'number' || (spec.g && typeof spec.g === 'object')) g = spec.g;
  else g = sh.g || rollG(rng);
  var order = sh.order || shuffle(Object.keys(G.SKILLS), rng);
  var sk = spec.skills === false ? [] : skillsFor(el, spec.rarity, spec.level, order);
  var h = mkHorse({ name: name, element: el, rarity: spec.rarity, grau: spec.grau || 2, level: spec.level, g: g, policy: spec.policy || 'bot', skills: sk });
  return { h: h, el: el, g: g, order: order };
}
// Montaria "plana" (seções 3, 8 e 10): nível 1, genética 0, sem pontos e sem skills; o equipamento
// sintético (mods) leva cada status ao valor pedido (60 salvo `over`). Corre com noTypeSkill quando
// `noType` (isola o status da skill de tipo).
function flat(over, name, rarity, element, noType) {
  var h = mkHorse({ name: name, element: element || 'fogo', rarity: rarity || 'mitico', grau: 2, level: 1, g: 0 });
  var mods = {};
  KEYS.forEach(function (k) { mods[k] = (over && over[k] != null ? over[k] : 60) - S.naturalStat(h, k); });
  return { horse: h, gear: { mods: mods, special: {} }, name: name, isPlayer: false, noTypeSkill: !!noType };
}
// Equipamento por descritor: { type: 'loose'|'set'|'mixed', rarity, plus, count, set, sets }
function gearOf(d) {
  if (!d) return null;
  var equip = {}, items = {};
  G.GEAR_SLOTS.forEach(function (sl, i) {
    var id = null;
    if (d.type === 'loose') id = sl + '-' + d.rarity;
    else if (d.type === 'set' && i < d.count) id = sl + '-' + d.set + '-' + d.rarity;
    else if (d.type === 'mixed' && i < d.sets.length) id = sl + '-' + d.sets[i] + '-' + d.rarity;
    if (id) { equip[sl] = 'u' + i; items['u' + i] = { uid: 'u' + i, id: id, plus: d.plus || 0 }; } else equip[sl] = null;
  });
  return GR.resolve({ equip: equip }, items);
}
function starterById(id) { return STARTERS.filter(function (h) { return h.id === id; })[0]; }
// raridade sorteada para salas e campos PVP (mais comuns embaixo)
var RAR_W = [0.35, 0.27, 0.2, 0.12, 0.06];
function pickRar(rng) { var u = rng(), acc = 0; for (var i = 0; i < 5; i++) { acc += RAR_W[i]; if (u < acc) return RAR[i]; } return 'mitico'; }

// ---------------------------------------------------------------------------
// Medições (rodam nos workers). Cada uma recebe (P, a, b) e devolve somas para k em [a, b).
// Chaves `recs` e `lists` são concatenadas na junção; números somam; listas de números somam por posição.
// ---------------------------------------------------------------------------
// Iniciais (M1, seção 2, durações e "Outros números"). P: { s0, level, weather, noDice }
function tStarters(P, a, b) {
  var o = { n: 0, w: [0, 0, 0], gw: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], gc: [0, 0, 0],
    info: { cansou: 0, garra: 0, ultrap: 0, skills: 0, typeSkills: 0, clima: 0, entries: 0 },
    lists: { dur0: [], dur1: [], dur2: [], win0: [], win1: [], win2: [] } };
  var hs = STARTERS.map(function (h) { return cat(h, P.level || 1); });
  var saved = S.TUNING.diceAt;
  try {
    if (P.noDice) S.TUNING.diceAt = [];
    for (var k = a; k < b; k++) {
      var seed = S.hash2(P.s0, k), cond = S.randomConditions(seed);
      if (P.weather) cond.weather = P.weather;
      var res = run(seed, cond, hs.map(function (h) { return racer(h); }));
      var w = res.finishOrder[0], gi = distGroup(cond.distance);
      o.n++; o.w[w]++; o.gw[gi][w]++; o.gc[gi]++;
      o.lists['dur' + gi].push(res.duration); o.lists['win' + gi].push(res.finishTimes[w]);
      o.info.entries += hs.length;
      res.events.forEach(function (e) {
        if (e.type === 'cansou') o.info.cansou++;
        else if (e.type === 'garra') o.info.garra++;
        else if (e.type === 'ultrapassagem') o.info.ultrap++;
        else if (e.type === 'skill') { if (e.typeSkill) o.info.typeSkills++; else o.info.skills++; }
        else if (e.type === 'clima') o.info.clima++;
      });
    }
  } finally { S.TUNING.diceAt = saved; }
  return o;
}
// Duelo genérico A × B (M3–M6). P: { A, B, seed, sameG, sameEl, sameSkills }
function tDuel(P, a, b) {
  var o = { n: 0, wA: 0 };
  for (var k = a; k < b; k++) {
    var seed = S.hash2(P.seed, k), rng = rngOf(seed, 78), cond = S.randomConditions(seed);
    var A = build(P.A, rng, {}, 'A');
    var sh = { order: P.sameSkills === false ? null : A.order, el: P.sameEl ? A.el : null, g: P.sameG ? A.g : null };
    var B = build(P.B, rng, sh, 'B');
    var ra = racer(A.h), rb = racer(B.h);
    var pair = k % 2 ? [ra, rb] : [rb, ra];
    var res = run(seed, cond, pair);
    o.n++; if (pair[res.finishOrder[0]] === ra) o.wA++;
  }
  return o;
}
// Duelo entre montarias do catálogo (4a). P: { A: [id, nível], B: [id, nível], test }
function tCatDuel(P, a, b) {
  var byId = {}; ALL.forEach(function (h) { byId[h.id] = h; });
  var A = cat(byId[P.A[0]], P.A[1]), B = cat(byId[P.B[0]], P.B[1]), o = { n: 0, wA: 0 };
  for (var k = a; k < b; k++) {
    var seed = seedOf(P.test, k), cond = S.randomConditions(seed);
    var pair = (k % 2 === 0) ? [A, B] : [B, A];
    var res = run(seed, cond, pair.map(function (h) { return racer(h); }));
    o.n++; if (pair[res.finishOrder[0]] === A) o.wA++;
  }
  return o;
}
// Especialistas por trecho (seção 3): montarias planas de Fogo sem skill de tipo, status 60 e um 90.
function tSpec(P, a, b) {
  var oa = {}, ob = {}; oa[P.statA] = 90; ob[P.statB] = 90;
  var A = flat(oa, 'Esp. ' + P.statA, 'mitico', 'fogo', true), B = flat(ob, 'Esp. ' + P.statB, 'mitico', 'fogo', true);
  var o = { n: 0, wA: 0 };
  for (var k = a; k < b; k++) {
    var seed = seedOf(P.test, k);
    var pair = (k % 2 === 0) ? [A, B] : [B, A];   // largada alternada
    var res = run(seed, MAPS[P.map], pair);
    o.n++; if (pair[res.finishOrder[0]] === A) o.wA++;
  }
  return o;
}
// Ganho pareado da skill de tipo (M2, informativo): campo de 6, alvo com e sem a skill de tipo.
function tTypeGain(P, a, b) {
  var o = { fogo: [0, 0, 0, 0], agua: [0, 0, 0, 0], grama: [0, 0, 0, 0] }, nF = 6;
  for (var k = a; k < b; k++) {
    var seed = S.hash2(P.seed, k), rng = rngOf(seed, 79), cond = S.randomConditions(seed);
    var subjEl = EL3[k % 3], subj = Math.floor(k / 3) % nF, field = [];
    for (var q = 0; q < nF; q++) field.push(build({ rarity: P.rarity, level: P.level, grau: 2, policy: 'bot', element: q === subj ? subjEl : 'rand' }, rng, {}, 'H' + q).h);
    var base = run(seed, cond, field.map(function (h, i) { return racer(h, i === subj ? { noTypeSkill: true } : null); }));
    var withS = run(seed, cond, field.map(function (h) { return racer(h); }));
    var win = withS.finishOrder[0] === subj ? 1 : 0, d = win - (base.finishOrder[0] === subj ? 1 : 0);
    var A = o[subjEl]; A[0] += d; A[1] += d * d; A[2]++; A[3] += win;
  }
  return o;
}
// S1 e A1 (comparação pareada): campo de 6 Raros nível 20 sintéticos (genética sorteada, build de
// bot, skills sorteadas), mapa aleatório, Dado ligado; o alvo é o corredor k % 6.
//   A1: +10 num status (mods de equipamento) contra o alvo como está.
//   S1: rivais sem skills normais; o alvo só com a skill testada contra o alvo sem skills normais (com
//       skill de elemento, ele passa a ser desse elemento, com a build de bot refeita, nas duas corridas).
var AUD_SKILLS = Object.keys(G.SKILLS);
function tAudit(P, a, b) {
  var o = { stat: {}, skill: {} }, nF = 6;
  KEYS.forEach(function (kk) { o.stat[kk] = [0, 0]; });
  AUD_SKILLS.forEach(function (id) { o.skill[id] = [0, 0, 0]; });   // soma d, soma d², ativou
  for (var k = a; k < b; k++) {
    var seed = S.hash2(P.seed, k), rng = rngOf(seed, 80), cond = S.randomConditions(seed);
    var subj = k % nF, field = [];
    for (var q = 0; q < nF; q++) field.push(build({ rarity: 'raro', level: 20, grau: 2, policy: 'bot' }, rng, {}, 'H' + q).h);
    var runWith = function (h, gear) {
      return run(seed, cond, field.map(function (x, i) { return i === subj ? racer(h, gear ? { gear: gear } : null) : racer(x); }));
    };
    var base = runWith(field[subj]).finishOrder[0] === subj ? 1 : 0;
    KEYS.forEach(function (kk) {
      var mods = {}; mods[kk] = 10;
      var d = (runWith(field[subj], { mods: mods, special: {} }).finishOrder[0] === subj ? 1 : 0) - base;
      o.stat[kk][0] += d; o.stat[kk][1] += d * d;
    });
    // S1 mede como sempre mediu: rivais sem skills normais (com elas, o alvo sem skill fica abaixo do
    // campo e o ganho de uma skill some no meio das dos rivais)
    field = field.map(function (x, i) { if (i === subj) return x; var c = copy(x); c.skills = []; return c; });
    var bases = {};
    var variant = function (el, skills) {
      var h = copy(field[subj]); h.element = el; h.skills = skills; h.alloc = S.botAlloc(h);
      return h;
    };
    AUD_SKILLS.forEach(function (id) {
      var sk = G.SKILLS[id], el = sk.element === 'geral' ? field[subj].element : sk.element;
      if (!(el in bases)) bases[el] = runWith(variant(el, [])).finishOrder[0] === subj ? 1 : 0;
      var res = runWith(variant(el, [id])), d = (res.finishOrder[0] === subj ? 1 : 0) - bases[el], A = o.skill[id];
      A[0] += d; A[1] += d * d;
      if (countType(res, 'skill', subj) > 0) A[2]++;
    });
  }
  return o;
}
// Salas como o jogo monta (M8, P1, P2): jogador sintético sorteado (raridade, nível 1–50, estrelas),
// bots de Poder 91,5%–111,5% do jogador com o nível ajustado ao alvo; todos com a build de bot.
function tLobby(P, a, b) {
  var o = { n: 0, fav: 0, lead13: 0, close: 0, recs: [] };
  function catOf(h) { return h.element + '|' + h.rarity + '|' + h.grau; }
  for (var k = a; k < b; k++) {
    var seed = S.hash2(P.seed, k), rng = rngOf(seed, 81), cond = S.randomConditions(seed);
    var nR = 4 + Math.floor(rng() * 5);
    var pl = build({ rarity: pickRar(rng), level: 1 + Math.floor(rng() * 50), grau: 1 + Math.floor(rng() * 3), policy: 'bot' }, rng, {}, 'P').h;
    var pr = S.powerRating(pl, null), hs = [pl];
    for (var q = 1; q < nR; q++) {
      var target = pr * (0.915 + 0.2 * rng()), best = null;
      for (var tries = 0; tries < 12 && !best; tries++) {
        var spec = { rarity: pickRar(rng), grau: 1 + Math.floor(rng() * 3), policy: 'bot', level: 1 };
        var bh = build(spec, rng, {}, 'B' + q), cand = null, cd = Infinity;
        var mkL = function (lv) { return build({ rarity: spec.rarity, grau: spec.grau, policy: spec.policy, level: lv, element: bh.el, g: bh.g }, rng, { order: bh.order }, 'B' + q).h; };
        var lo = 1, hi = 50;   // o Poder cresce com o nível: busca binária do primeiro nível com Poder >= alvo
        while (lo < hi) { var mid = (lo + hi) >> 1; if (S.powerRating(mkL(mid), null) >= target) hi = mid; else lo = mid + 1; }
        [lo - 1, lo].forEach(function (lv) {
          if (lv < 1) return;
          var h2 = mkL(lv), d = Math.abs(S.powerRating(h2, null) - target);
          if (d < cd) { cd = d; cand = h2; }
        });
        if (cd <= target * 0.06) best = cand;
      }
      hs.push(best || pl);
    }
    var res = run(seed, cond, hs.map(function (h) { return racer(h); }), true);
    var rt = hs.map(function (h) { return S.powerRating(h, null); });
    var place = []; res.finishOrder.forEach(function (ri, p) { place[ri] = p; });
    var bi = 0, i, j;
    for (i = 1; i < nR; i++) if (rt[i] > rt[bi]) bi = i;
    o.n++; if (place[bi] === 0) o.fav++;
    var w = res.finishOrder[0], D = cond.distance;
    for (var f = 0; f < res.frames.length; f++) {   // líder no primeiro frame em que alguém passa de 1/3
      var Pp = res.frames[f].pos, m = 0;
      for (j = 1; j < nR; j++) if (Pp[j] > Pp[m]) m = j;
      if (Pp[m] >= D / 3) { if (m === w) o.lead13++; break; }
    }
    var fw = Math.min(res.frames.length - 1, Math.ceil(res.finishTimes[w] * 10));   // margem em metros quando o 1º cruza
    var P2 = res.frames[fw].pos.slice().sort(function (x, y) { return y - x; });
    if (D - P2[1] < 1) o.close++;
    for (i = 0; i < nR; i++) for (j = i + 1; j < nR; j++) o.recs.push([catOf(hs[i]), catOf(hs[j]), rt[i] - rt[j], place[i] < place[j] ? 1 : 0]);
  }
  return o;
}
// M9: campo de 6 com tipos sorteados e cavalos equivalentes (mesma raridade, nível e estrelas e a
// mesma genética, na forma do tipo).
function tM9(P, a, b) {
  var o = { fogo: [0, 0], agua: [0, 0], grama: [0, 0] }, nF = 6;
  for (var k = a; k < b; k++) {
    var seed = S.hash2(P.seed, k), rng = rngOf(seed, 82), cond = S.randomConditions(seed);
    var vals = [], q;
    for (q = 0; q < 7; q++) vals.push(Math.floor(rng() * 32));
    var hs = [];
    for (q = 0; q < nF; q++) {
      var el = pickEl(rng);
      hs.push(build({ rarity: P.rarity, level: P.level, grau: 2, policy: 'bot', element: el, g: shapeG(vals, el) }, rng, {}, 'H' + q).h);
    }
    var res = run(seed, cond, hs.map(function (h) { return racer(h); }));
    hs.forEach(function (h, i) { o[h.element][1]++; if (res.finishOrder[0] === i) o[h.element][0]++; });
  }
  return o;
}
// Equipamento (E1–E4): duelo com peças; com `weather` o clima fica fixo (Dado desligado).
// A com `starter` usa a genética, o elemento e a raridade do inicial; `sameAsA` faz B = A.
function tGearDuel(P, a, b) {
  var o = { n: 0, wA: 0 }, saved = S.TUNING.diceAt;
  var gA = gearOf(P.gA), gB = gearOf(P.gB);
  try {
    if (P.weather) S.TUNING.diceAt = [];
    for (var k = a; k < b; k++) {
      var seed = S.hash2(P.seed, k), rng = rngOf(seed, 83), cond = S.randomConditions(seed);
      if (P.weather) cond.weather = P.weather;
      var specA = P.A, specB = P.B, st = specA.starter ? starterById(specA.starter) : null;
      if (st) specA = Object.assign({}, specA, { element: st.element, g: st.potential, rarity: st.rarity });
      var A = build(specA, rng, {}, 'A');
      var B = build(P.sameAsA ? Object.assign({}, specB, { element: A.el, g: A.g, rarity: specA.rarity }) : specB, rng,
        { g: P.sameG ? A.g : null, order: A.order, el: P.sameEl ? A.el : null }, 'B');
      var ra = racer(A.h, { gear: gA }), rb = racer(B.h, { gear: gB });
      var pair = k % 2 ? [ra, rb] : [rb, ra];
      var res = run(seed, cond, pair);
      o.n++; if (pair[res.finishOrder[0]] === ra) o.wA++;
    }
  } finally { S.TUNING.diceAt = saved; }
  return o;
}
// E3b: as duas Brasas do E3 (4 Raras do Sol × misturadas) + uma Maré nível 10 sem equipamento como
// agente do Dado; Sol só no início e Dado ligado; as 6 ordens de raia. Conta A à frente de B.
function tE3b(P, a, b) {
  var o = { n: 0, ahead: 0 }, brasa = starterById('brasa'), mare = starterById('mare');
  var gA = gearOf({ type: 'set', set: 'sol', rarity: 'raro', count: 4 }), gB = gearOf({ type: 'mixed', rarity: 'raro', sets: ['sol', 'sol', 'chuva', 'nevoa'] });
  var perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (var k = a; k < b; k++) {
    var seed = S.hash2(P.seed, k), rng = rngOf(seed, 84), cond = S.randomConditions(seed);
    cond.weather = 'sol';   // só o clima inicial; o Dado continua ligado
    var A = build({ element: 'fogo', g: brasa.potential, rarity: 'comum', level: 10, grau: 2 }, rng, {}, 'A');
    var C = build({ element: 'agua', g: mare.potential, rarity: 'comum', level: 10, grau: 2 }, rng, {}, 'C');
    var field = [racer(A.h, { gear: gA }), racer(A.h, { gear: gB, name: 'B' }), racer(C.h)];
    var order = perms[k % perms.length];
    var res = run(seed, cond, order.map(function (q) { return field[q]; }));
    o.n++; if (res.finishOrder.indexOf(order.indexOf(0)) < res.finishOrder.indexOf(order.indexOf(1))) o.ahead++;
  }
  return o;
}
// PVP de 8 (duração): raridade e nível sorteados para a sala; 8 sintéticos dessa raridade e nível
// (estrelas e genética sorteadas, build de bot).
function tPvp8(P, a, b) {
  var o = { lists: { dur0: [], dur1: [], dur2: [] } };
  for (var k = a; k < b; k++) {
    var seed = seedOf(600, k), rng = rngOf(seed, 4242), cond = S.randomConditions(seed);
    var rar = pickRar(rng), lv = 1 + Math.floor(rng() * 50), rs = [];
    for (var q = 0; q < 8; q++) rs.push(racer(build({ rarity: rar, level: lv, grau: 1 + Math.floor(rng() * 3), policy: 'bot' }, rng, {}, G.BOT_NAMES[q]).h));
    o.lists['dur' + distGroup(cond.distance)].push(run(seed, cond, rs).duration);
  }
  return o;
}
// Viradas de clima (seção 8): PVP de 8 planos (Mítico nível 1, status 60), elementos sorteados.
function tFlips(P, a, b) {
  var o = { n: 0, sum: 0, hist: [0, 0, 0] };
  for (var k = a; k < b; k++) {
    var seed = seedOf(800, k), rng = rngOf(seed, 8888), rs = [];
    for (var q = 0; q < 8; q++) rs.push(flat({}, G.BOT_NAMES[q], 'mitico', EL3[Math.floor(rng() * 3)], false));
    var c = countType(run(seed, S.randomConditions(seed), rs), 'clima');
    o.n++; o.sum += c; o.hist[Math.min(c, 2)]++;
  }
  return o;
}
// Chance de skill observada (seção 10): Arranque, Sorte 50, em reta, contra um rival plano.
function tSkillObs(P, a, b) {
  var me = flat({ sorte: 50 }, 'Sint ' + P.rid, P.rid, 'fogo', true), other = flat({}, 'Rival', 'mitico', 'fogo', true);
  me.horse.skills = ['arranque'];
  var o = { n: 0, fired: 0 };
  for (var k = a; k < b; k++) {
    if (countType(run(seedOf(1000 + P.ri, k), MAPS.RETA, [me, other]), 'skill', 0) > 0) o.fired++;
    o.n++;
  }
  return o;
}
var TASKS = { starters: tStarters, duel: tDuel, catDuel: tCatDuel, spec: tSpec, typeGain: tTypeGain, audit: tAudit,
  lobby: tLobby, m9: tM9, gearDuel: tGearDuel, e3b: tE3b, pvp8: tPvp8, flips: tFlips, skillObs: tSkillObs };

if (!WT.isMainThread) {
  WT.parentPort.on('message', function (m) { WT.parentPort.postMessage({ id: m.id, data: TASKS[m.task](m.params, m.a, m.b) }); });
  return;
}

// ---------------------------------------------------------------------------
// Pool de workers: pedaços fixos por medição, junção na ordem dos pedaços
// ---------------------------------------------------------------------------
function merge(acc, b, concat) {
  if (acc == null) return copy(b);
  if (typeof b === 'number') return acc + b;
  if (Array.isArray(b)) {
    if (concat) return acc.concat(b);
    for (var i = 0; i < b.length; i++) acc[i] = merge(acc[i], b[i]);
    return acc;
  }
  for (var k in b) {
    if (k === 'recs') acc[k] = acc[k].concat(b[k]);
    else if (k === 'lists') { for (var q in b[k]) acc[k][q] = acc[k][q].concat(b[k][q]); }
    else acc[k] = merge(acc[k], b[k]);
  }
  return acc;
}
var JOBS = {};
function job(key, task, params, N, chunks) { JOBS[key] = { task: task, params: params || {}, N: N, chunks: chunks || 8 }; }
function runPool() {
  var keys = Object.keys(JOBS), items = [];
  keys.forEach(function (key) {
    var J = JOBS[key]; J.parts = [];
    for (var c = 0; c < J.chunks; c++) {
      var a = Math.floor(J.N * c / J.chunks), b = Math.floor(J.N * (c + 1) / J.chunks);
      if (b > a) { items.push({ id: items.length, key: key, ci: J.parts.length, task: J.task, params: J.params, a: a, b: b }); J.parts.push(null); }
    }
  });
  var nW = Math.max(1, Math.min(require('os').cpus().length, items.length));
  return new Promise(function (resolve, reject) {
    var next = 0, done = 0, workers = [];
    function feed(w) { if (next < items.length) w.postMessage(items[next++]); }
    for (var i = 0; i < nW; i++) {
      var w = new WT.Worker(__filename, { argv: args });
      w.on('message', (function (w) {
        return function (m) {
          var it = items[m.id];
          JOBS[it.key].parts[it.ci] = m.data;
          if (++done === items.length) {
            workers.forEach(function (x) { x.terminate(); });
            var out = {};
            keys.forEach(function (key) { out[key] = JOBS[key].parts.reduce(function (acc, p) { return merge(acc, p); }, null); });
            resolve(out);
          } else feed(w);
        };
      })(w));
      w.on('error', reject);
      workers.push(w);
      feed(w);
    }
  });
}

// ---------------------------------------------------------------------------
if (args.indexOf('--exemplo') >= 0) { exemplo(); process.exit(0); }

var t0 = Date.now(); // só para medir o tempo do relatório (não entra na simulação)

// Tamanho das amostras: [completo, --quick]. As metas com margem curta para a faixa usam o mesmo N
// nos dois modos (duelos são baratos); M6, M9, P1, S1 e A1 só contam no completo.
function NN(full, quick) { return QUICK ? quick : full; }
var N_M1 = 15000, N_CLIMA = n(3000), N_SPEC = n(2000), N_4A = n(1500);
var N_M3 = NN(3000, 1000), N_M4 = NN(3000, 1500), N_M5 = NN(3000, 1500), N_M6 = 3000, N_M9 = 18000;
var N_M2 = NN(4000, 500), N_AUD = NN(4000, 1000), N_LOBBY = NN(5000, 1500);
var N_GEAR = 3000, N_PVP = NN(1500, 400), N_FLIPS = n(1000), N_SKILL = 2000;

// -- registra as medições (as mais pesadas primeiro, para o pool terminar junto)
job('audit', 'audit', { seed: 15 }, N_AUD, 32);
if (!QUICK) [['comum', 1], ['raro', 30], ['lendario', 50]].forEach(function (c) { job('m9-' + c[0], 'm9', { rarity: c[0], level: c[1], seed: 17 }, N_M9, 12); });
[['comum', 1], ['raro', 30], ['lendario', 50]].forEach(function (c) { job('m2-' + c[0], 'typeGain', { rarity: c[0], level: c[1], seed: 99 }, N_M2, 8); });
job('lobby', 'lobby', { seed: 16 }, N_LOBBY, 16);
var M6_LV = [11, 30, 50], M6_PAIRS = [];
POLICIES.forEach(function (p, i) { POLICIES.forEach(function (q, j) { if (j > i) M6_PAIRS.push([p, q]); }); });
if (!QUICK) M6_LV.forEach(function (lv) {
  M6_PAIRS.forEach(function (pq) {
    job('m6-' + lv + '-' + pq[0] + '-' + pq[1], 'duel', { A: { rarity: 'raro', level: lv, grau: 2, policy: pq[0] }, B: { rarity: 'raro', level: lv, grau: 2, policy: pq[1] }, sameG: true, sameEl: true, seed: 61 + lv }, N_M6, 2);
  });
});
job('m1', 'starters', { s0: 13, level: 1 }, N_M1, 8);
STARTERS.forEach(function (h, i) { job('clima-' + h.id, 'starters', { s0: (200 + i) * 7919 + 13, level: 1, weather: G.ELEMENTS[h.element].weather, noDice: true }, N_CLIMA, 2); });
var M3_RAR = ['comum', 'raro', 'lendario'], M3_LV = [1, 20, 40];
M3_RAR.forEach(function (rar) { M3_LV.forEach(function (lv) { job('m3-' + rar + '-' + lv, 'duel', { A: { rarity: rar, level: lv + 10, grau: 2 }, B: { rarity: rar, level: lv, grau: 2 }, sameG: true, seed: 31 + lv }, N_M3, 2); }); });
var M4_LV = [1, 30, 50], M4_ONE = [['magico', 'comum'], ['raro', 'magico'], ['lendario', 'raro'], ['mitico', 'lendario']], M4_TWO = [['raro', 'comum'], ['mitico', 'raro']];
M4_LV.forEach(function (lv) { M4_ONE.concat(M4_TWO).forEach(function (hl) { job('m4-' + lv + '-' + hl[0] + '-' + hl[1], 'duel', { A: { rarity: hl[0], level: lv, grau: 2 }, B: { rarity: hl[1], level: lv, grau: 2 }, sameG: true, seed: 41 + lv }, N_M4, 2); }); });
var M5_RAR = ['comum', 'raro', 'mitico'];
M5_RAR.forEach(function (rar) {
  job('m5-31-' + rar, 'duel', { A: { rarity: rar, level: 50, grau: 3 }, B: { rarity: rar, level: 50, grau: 1 }, sameG: true, seed: 52 }, N_M5, 2);
  job('m5-21-' + rar, 'duel', { A: { rarity: rar, level: 50, grau: 2 }, B: { rarity: rar, level: 50, grau: 1 }, sameG: true, seed: 53 }, N_M5, 2);
});
var SET10 = { type: 'set', set: 'sol', rarity: 'raro', plus: 10, count: 5 };
var GEAR_DUELS = [
  ['E1', 'Inicial nível 1 com 5 Comuns +0 × sem nada (nublado)', { A: { starter: 'brasa', level: 1, grau: 2 }, gA: { type: 'loose', rarity: 'comum' }, B: { level: 1, grau: 2 }, gB: null, sameAsA: true, weather: 'nublado', seed: 1100 }, 60, 75],
  ['E2a', 'Comum nível 30 com conjunto Raro +10 × Mágico nível 30 sem nada (nublado)', { A: { rarity: 'comum', level: 30, grau: 2 }, gA: SET10, B: { rarity: 'magico', level: 30, grau: 2 }, gB: null, sameG: true, weather: 'nublado', seed: 1400 }, 60, 85],
  ['E2b', 'Comum nível 30 com conjunto Raro +10 × Raro nível 30 sem nada (nublado)', { A: { rarity: 'comum', level: 30, grau: 2 }, gA: SET10, B: { rarity: 'raro', level: 30, grau: 2 }, gB: null, sameG: true, weather: 'nublado', seed: 1200 }, 10, 40],
  ['E3', 'Brasa nível 10: 4 Raras do Sol × 4 Raras misturadas, com Sol', { A: { starter: 'brasa', level: 10, grau: 2 }, gA: { type: 'set', set: 'sol', rarity: 'raro', count: 4 }, B: { level: 10, grau: 2 }, gB: { type: 'mixed', rarity: 'raro', sets: ['sol', 'sol', 'chuva', 'nevoa'] }, sameAsA: true, weather: 'sol', seed: 1300 }, 65, 85],
  ['E4', 'Brasa nível 10: 5 Raras da Chuva × misturadas, na chuva', { A: { starter: 'brasa', level: 10, grau: 2 }, gA: { type: 'set', set: 'chuva', rarity: 'raro', count: 5 }, B: { level: 10, grau: 2 }, gB: { type: 'mixed', rarity: 'raro', sets: ['chuva', 'chuva', 'sol', 'sol', 'nevoa'] }, sameAsA: true, weather: 'chuva', seed: 1301 }, 60, 75]
];
GEAR_DUELS.forEach(function (gd) { job('gear-' + gd[0], 'gearDuel', gd[2], N_GEAR, 2); });
job('e3b', 'e3b', { seed: 1302 }, N_GEAR, 2);
job('pvp8', 'pvp8', {}, N_PVP, 4);
job('flips', 'flips', {}, N_FLIPS, 2);
var SPEC = [
  ['3', 'De curva (MAN 90) × de reta (VEL 90)', 'CURVA', 'man', 'vel', 'curva', 65, 85],
  ['3b', 'De reta (VEL 90) × de curva (MAN 90) em reta pura', 'RETA', 'vel', 'man', 'reta', 70, 100],
  ['3c', 'De subida (FOR 90) × de reta (VEL 90)', 'SUBIDA', 'forca', 'vel', 'subida', 75, 93]
];
SPEC.forEach(function (sp, si) { job('spec-' + sp[0], 'spec', { map: sp[2], statA: sp[3], statB: sp[4], test: 300 + si }, N_SPEC, 2); });
var miticos = G.WILD_HORSES.filter(function (h) { return h.rarity === 'mitico'; });
var comuns = G.WILD_HORSES.filter(function (h) { return h.rarity === 'comum'; });
miticos.forEach(function (M, mi) { comuns.forEach(function (C, ci2) { job('4a-' + M.id + '-' + C.id, 'catDuel', { A: [M.id, 1], B: [C.id, 1], test: 400 + mi * 10 + ci2 }, N_4A, 1); }); });
RAR_IDS.forEach(function (rid, ri) { job('skill-' + rid, 'skillObs', { rid: rid, ri: ri }, N_SKILL, 2); });

// ---------------------------------------------------------------------------
// Saída: seções em ordem; cada check fica na seção em que aparece
// ---------------------------------------------------------------------------
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

runPool().then(report, function (e) { console.error('[balance] worker falhou: ' + (e && e.stack || e)); process.exit(1); });

function report(R) {
  function wr(key) { return pct(R[key].wA, R[key].n); }
  log('## Relatório de balanceamento v3');
  log('');
  log('Gerado por `node tools/balance.js`' + (QUICK ? ' --quick' : '') + '. Mapas aleatórios em blocos (`randomConditions`, 1.400–2.000 m), sem equipamento, salvo indicação; ' +
    'Dado da Sorte ligado (1/3 e 2/3 da pista), exceto nas seções com clima fixo. ' +
    'Cavalos sintéticos das metas M (como na calibração): genética de 0 a 31 sorteada pela seed, skills normais sorteadas (as nascidas mais as aprendidas esperadas pelo nível) e pontos livres pela build dos bots (`RaceSim.botAlloc`), salvo indicação. ' +
    'Duelos com largada alternada.' +
    (QUICK ? ' Amostras menores no --quick.' : ''));
  if (QUICK) { log(''); log('> **--quick: as metas M6, M9, P1, S1 e A1 só contam no completo** (aqui aparecem só como informação, porque com poucas amostras o ruído passa da margem da faixa). Para medi-las: `node prototype/tools/balance.js`.'); }
  log('');

  // -------------------------------------------------------------------------
  // M1) Iniciais no nível 1
  // -------------------------------------------------------------------------
  var r1 = R.m1;
  log('### M1. Iniciais no nível 1 entre si (meta: 30%–37% cada; 22%–45% em cada terço da faixa de distância)');
  log('');
  log('| Inicial | Vitórias (' + r1.n + ' corridas) | ' + GROUP_LABEL.join(' | ') + ' |');
  log('|---|---|---|---|---|');
  STARTERS.forEach(function (h, i) {
    var v = pct(r1.w[i], r1.n);
    check('M1', h.name + ' nível 1', v, 30, 37);
    var cells = [0, 1, 2].map(function (g) { var x = pct(r1.gw[g][i], r1.gc[g]); check('M1', h.name + ', distância ' + GROUPS[g], x, 22, 45); return f1(x) + '%'; });
    log('| ' + h.name + ' | **' + f1(v) + '%** | ' + cells.join(' | ') + ' |');
  });
  log('');

  // -------------------------------------------------------------------------
  // 2) Inicial com o clima do seu elemento fixo (Dado desligado)
  // -------------------------------------------------------------------------
  log('### 2. Inicial com o clima do seu elemento fixo, sem Dado (meta: 45%–65%)');
  log('');
  log('Mapas aleatórios com o clima trocado pelo do elemento do inicial, fixo durante toda a corrida (`diceAt = []` nesta seção).');
  log('');
  log('| Inicial | Clima | Multiplicadores (Brasa · Maré · Ipê) | Vitórias (' + N_CLIMA + ') |');
  log('|---|---|---|---|');
  STARTERS.forEach(function (h, i) {
    var w = G.ELEMENTS[h.element].weather, rc = R['clima-' + h.id], v = pct(rc.w[i], rc.n);
    check('2', h.name + ' no seu clima', v, 45, 65);
    var mults = STARTERS.map(function (x) { return '×' + f2(S.weatherMult(x.element, w, false)); }).join(' · ');
    log('| ' + h.name + ' | ' + G.WEATHERS[w].name + ' | ' + mults + ' | **' + f1(v) + '%** |');
  });
  log('');

  // -------------------------------------------------------------------------
  // 3) Especialistas por trecho
  // -------------------------------------------------------------------------
  log('### 3. Especialistas por trecho (Mítico nível 1 de Fogo sem skill de tipo, status 60 e um 90 por equipamento sintético; metas: 3 de 65% a 85%, 3b de 70% a 100%, 3c de 75% a 93%)');
  log('');
  log('3 e 3c rebaseadas no v3 (antes 55%–75%): a Velocidade passou a pesar menos de propósito (`vRange` 1,7 → 1,2), então o especialista vence mais na pista dele; e pistas com 75% de um trecho só existem neste teste (o sorteio limita cada tipo a 50%), em pista sorteada quem vigia é a M6. ' +
    '3b rebaseada para 70%–100%: sem Disposição do dia (intencional no v2) não há ruído por corrida, e em reta pura VEL 90 contra 60 decide quase sempre. ' +
    'Os dois corredores são do mesmo tipo e correm sem a skill de tipo (`noTypeSkill`), para o duelo medir só o status.');
  log('');
  log('| # | Duelo | Mapa | Vitórias do 1º (' + N_SPEC + ', largada alternada) |');
  log('|---|---|---|---|');
  SPEC.forEach(function (sp) {
    var v = wr('spec-' + sp[0]);
    check(sp[0], sp[1], v, sp[6], sp[7]);
    var share = Math.round(100 * S.blockShare(MAPS[sp[2]].blocks, sp[5]));
    log('| ' + sp[0] + ' | ' + sp[1] + ' | 1600 m, ' + share + '% ' + sp[5] + ' | **' + f1(v) + '%** |');
  });
  log('');

  // -------------------------------------------------------------------------
  // 4) Raridade, nível e estrelas: 4a, M3, M4, M5
  // -------------------------------------------------------------------------
  log('### 4. Raridade, nível e estrelas (duelos 1v1, mapa aleatório)');
  log('');
  var aggW = 0, aggN = 0, rows4a = [];
  miticos.forEach(function (M) { comuns.forEach(function (C) { var x = R['4a-' + M.id + '-' + C.id]; aggW += x.wA; aggN += x.n; rows4a.push(M.name + ' × ' + C.name + ' ' + f1(pct(x.wA, x.n)) + '%'); }); });
  var v4a = pct(aggW, aggN);
  check('4a', 'Mítico nível 1 vence Comum nível 1 (catálogo)', v4a, 90, 100);
  log('**4a.** Míticos × Comuns do catálogo no nível 1 (' + N_4A + ' por duelo; meta 90%–100%): **' + f1(v4a) + '%** (' + rows4a.join(' · ') + ').');
  log('');
  log('**M3.** Mesma raridade, mesma genética, ★★ e build de bot; 10 níveis a mais (meta ≥ 70%; ' + N_M3 + ' duelos cada). Elementos sorteados à parte; as skills normais seguem o nível.');
  log('');
  log('| Raridade | 1 → 11 | 20 → 30 | 40 → 50 |');
  log('|---|---|---|---|');
  M3_RAR.forEach(function (rar) {
    log('| ' + G.RARITIES[rar].name + ' | ' + M3_LV.map(function (lv) {
      var v = wr('m3-' + rar + '-' + lv);
      check('M3', G.RARITIES[rar].name + ' nível ' + (lv + 10) + ' × nível ' + lv, v, 70, 100);
      return '**' + f1(v) + '%**';
    }).join(' | ') + ' |');
  });
  log('');
  log('**M4.** Raridade acima, mesmo nível, mesma genética, ★★ e build de bot (um degrau: meta 72%–88%; dois degraus: meta ≥ 95%; ' + N_M4 + ' duelos cada).');
  log('');
  log('| Nível | ' + M4_ONE.concat(M4_TWO).map(function (hl) { return G.RARITIES[hl[0]].name + ' × ' + G.RARITIES[hl[1]].name; }).join(' | ') + ' |');
  log('|---|' + M4_ONE.concat(M4_TWO).map(function () { return '---|'; }).join(''));
  M4_LV.forEach(function (lv) {
    log('| ' + lv + ' | ' + M4_ONE.concat(M4_TWO).map(function (hl, i) {
      var v = wr('m4-' + lv + '-' + hl[0] + '-' + hl[1]), two = i >= M4_ONE.length;
      check('M4', (two ? 'Dois degraus' : 'Um degrau') + ', nível ' + lv + ': ' + G.RARITIES[hl[0]].name + ' × ' + G.RARITIES[hl[1]].name, v, two ? 95 : 72, two ? 100 : 88);
      return '**' + f1(v) + '%**';
    }).join(' | ') + ' |');
  });
  log('');
  log('**M5.** Estrelas no nível 50, mesma raridade e mesma genética, build de bot (★★★ × ★: meta 65%–75%; ★★ × ★: meta 55%–63%; ' + N_M5 + ' duelos cada).');
  log('');
  log('| Raridade | ★★★ × ★ | ★★ × ★ |');
  log('|---|---|---|');
  M5_RAR.forEach(function (rar) {
    var a = wr('m5-31-' + rar), b = wr('m5-21-' + rar);
    check('M5', '★★★ × ★, ' + G.RARITIES[rar].name + ' nível 50', a, 65, 75);
    check('M5', '★★ × ★, ' + G.RARITIES[rar].name + ' nível 50', b, 55, 63);
    log('| ' + G.RARITIES[rar].name + ' | **' + f1(a) + '%** | **' + f1(b) + '%** |');
  });
  log('');

  // -------------------------------------------------------------------------
  // M6) Nenhuma build dominante
  // -------------------------------------------------------------------------
  log('### M6. Nenhuma build dominante (6 políticas, Raro ★★, mesma genética e elemento; meta: nenhuma vence outra em mais de 60%)');
  log('');
  log('Políticas: `bot` (`botAlloc`), `tudoVel` e `tudoForca` (enchem o status até o limite de 34%), `equilibrada` (rodízio nos seis de corrida), `fortesDoTipo` (rodízio nos dois do tipo, depois nos outros) e `cobreFraco` (sempre no status mais baixo).');
  log('');
  if (QUICK) {
    log('_Só no modo completo (' + (M6_PAIRS.length * M6_LV.length) + ' pares × ' + N_M6 + ' duelos; com menos, o máximo dos 45 pares passa da faixa só por ruído)._');
  } else {
    log('| Par (vitórias da 1ª) | ' + M6_LV.map(function (lv) { return 'nível ' + lv; }).join(' | ') + ' |');
    log('|---|---|---|---|');
    var mx = {};
    M6_LV.forEach(function (lv) { mx[lv] = 0; });
    M6_PAIRS.forEach(function (pq) {
      log('| `' + pq[0] + '` × `' + pq[1] + '` | ' + M6_LV.map(function (lv) {
        var v = wr('m6-' + lv + '-' + pq[0] + '-' + pq[1]);
        mx[lv] = Math.max(mx[lv], v, 100 - v);
        return f1(v) + '%';
      }).join(' | ') + ' |');
    });
    log('| **maior vitória num par** | ' + M6_LV.map(function (lv) { check('M6', 'Maior vitória num par de builds, nível ' + lv, mx[lv], 0, 60); return '**' + f1(mx[lv]) + '%**'; }).join(' | ') + ' |');
  }
  log('');

  // -------------------------------------------------------------------------
  // M7) Status que dá para encher no nível 50 (cálculo exato, sem corrida)
  // -------------------------------------------------------------------------
  // Para cada cavalo: espaço até o teto de cada status (teto − natural); os que cabem no limite por
  // status entram do menor para o maior enquanto houver pontos livres.
  function fillable(h) {
    var cap = G.RARITIES[h.rarity].statCap, p = S.freePoints(h), lim = S.statLimit(h), c = 0;
    var rooms = KEYS.map(function (k) { return Math.max(0, Math.ceil(cap - S.naturalStat(h, k) - 1e-9)); })
      .filter(function (r) { return r <= lim; }).sort(function (x, y) { return x - y; });
    for (var i = 0; i < rooms.length && rooms[i] <= p; i++) { p -= rooms[i]; c++; }
    return c;
  }
  var N7c = 3000, m7 = [];
  [1, 2, 3].forEach(function (st) {
    var rng = S.mulberry32(st * 99 + 1), sum = 0, all7 = 0;
    for (var i = 0; i < N7c; i++) {
      var h = { element: 'fogo', rarity: 'raro', grau: st, level: 50, potential: rollG(rng), alloc: {}, skills: [] };
      var c = fillable(h); sum += c; if (c === 7) all7++;
    }
    m7.push({ st: st, mean: sum / N7c, all7: pct(all7, N7c), pts: S.freePoints({ level: 50, grau: st }), lim: S.statLimit({ level: 50, grau: st }) });
  });
  check('M7', 'Status que dá para encher no nível 50, ★', m7[0].mean, 3, 4, '');
  check('M7', 'Status que dá para encher no nível 50, ★★★', m7[2].mean, 4.5, 5.5, '');
  log('### M7. Status que dá para encher no nível 50 (Raro de Fogo, genética sorteada, ' + N7c + ' cavalos por estrela; meta: ★ 3–4, ★★★ perto de 5, faixa 4,5–5,5)');
  log('');
  log('Cálculo exato, sem corrida: quantos status chegam ao teto com os pontos livres, respeitando o limite por status, enchendo do que falta menos para o que falta mais.');
  log('');
  log('| Estrelas | Pontos livres | Limite por status | Status cheios (média) | Enche os 7 |');
  log('|---|---|---|---|---|');
  m7.forEach(function (x) { log('| ' + '★★★'.slice(0, x.st) + ' | ' + x.pts + ' | ' + x.lim + ' | **' + f2(x.mean) + '** | ' + f1(x.all7) + '% |'); });
  log('');

  // -------------------------------------------------------------------------
  // M9) Tipos em campo misto; M2 (informativo) ganho pareado da skill de tipo
  // -------------------------------------------------------------------------
  var M9C = [['comum', 1], ['raro', 30], ['lendario', 50]];
  log('### M9. Tipos em campo misto de 6 (cavalos equivalentes: mesma raridade, nível, ★★ e a mesma genética na forma do tipo; justo = 16,7%; meta: 15,3%–18,0% por corredor de cada tipo)');
  log('');
  if (QUICK) {
    log('_Só no modo completo (' + N_M9 + ' campos por configuração; a faixa tem ±1,4 p.p. em volta do justo, e o IC com menos campos passa disso)._');
  } else {
    log('| Configuração | Fogo | Água | Grama |');
    log('|---|---|---|---|');
    M9C.forEach(function (c) {
      var x = R['m9-' + c[0]];
      log('| ' + G.RARITIES[c[0]].name + ' nível ' + c[1] + ' (' + N_M9 + ' campos) | ' + EL3.map(function (e) {
        var p = pciB(x[e][0], x[e][1]);
        check('M9', 'Vitória por corredor de ' + G.ELEMENTS[e].name + ', ' + G.RARITIES[c[0]].name + ' nível ' + c[1], p[0], 15.3, 18.0);
        return '**' + f1(p[0]) + '%** ± ' + f1(p[1]);
      }).join(' | ') + ' |');
    });
  }
  log('');
  log('**M2 (informativo, não é meta).** Ganho pareado de vitória da skill de tipo: campo de 6 sintéticos, o alvo com e sem a skill de tipo (`noTypeSkill`), mesma seed e mesmos rivais; ' + N_M2 + ' pares por configuração. ' +
    'Os ganhos são diferentes de propósito: o M9 tem prioridade (spec, seção 12).');
  log('');
  log('| Configuração | Fogo (Labareda) | Água (Maré Alta) | Grama (Raízes Firmes) | Diferença (maior − menor) |');
  log('|---|---|---|---|---|');
  M9C.forEach(function (c) {
    var x = R['m2-' + c[0]], gs = EL3.map(function (e) { return ci(x[e][0], x[e][1], x[e][2]); });
    var vals = gs.map(function (g) { return g[0]; });
    log('| ' + G.RARITIES[c[0]].name + ' nível ' + c[1] + ' | ' + gs.map(function (g) { return f1(g[0]) + ' ± ' + f1(g[1]) + ' p.p.'; }).join(' | ') + ' | ' +
      f1(Math.max.apply(null, vals) - Math.min.apply(null, vals)) + ' p.p. |');
  });
  log('');

  // -------------------------------------------------------------------------
  // E) Equipamento
  // -------------------------------------------------------------------------
  log('### E. Equipamento (metas E1–E4, E2 em a/b, + E3b)');
  log('');
  log('Duelos de 2 corredores (' + N_GEAR + ' por duelo, largada alternada), mapas aleatórios; clima fixo nas metas com clima (Dado desligado), exceto E3b (3 corredores, Sol só no início, Dado ligado). Peças de `gear.js`. ' +
    'Cavalos sintéticos como os das metas M; "Brasa" é a genética, o elemento e a raridade do inicial, com a build de bot e skills sorteadas (as mesmas nos dois lados).');
  log('');
  log('E2a/E2b: com o degrau de raridade de 5 pontos por status, o conjunto Raro +10 completo fecha um degrau (vence o Mágico) mas não dois (perde do Raro). ' +
    'E3: o bônus de 4 peças reforça o clima do conjunto para ×' + f2(S.TUNING.weatherMultSet) + '; num duelo de clima fixo entre cavalos idênticos qualquer vantagem constante vira vitória. ' +
    'E3b mede essa vantagem com o clima podendo virar: os dois Brasas do E3 mais uma Maré nível 10 (Água, sem equipamento) como agente do Dado, Sol só no início; conta quantas vezes a Brasa do Sol chega à frente da misturada.');
  log('');
  log('| Meta | Duelo | Vitórias do 1º | Faixa |');
  log('|---|---|---|---|');
  GEAR_DUELS.forEach(function (gd) {
    var v = wr('gear-' + gd[0]);
    check(gd[0], gd[1], v, gd[3], gd[4]);
    log('| ' + gd[0] + ' | ' + gd[1] + ' | **' + f1(v) + '%** | ' + gd[3] + '–' + gd[4] + '% |');
  });
  var vE3b = pct(R.e3b.ahead, R.e3b.n);
  check('E3b', 'Brasa com 4 Raras do Sol à frente da Brasa misturada, Sol inicial com Dado ligado e uma Maré na pista', vE3b, 60, 80);
  log('| E3b | 4 Raras do Sol à frente de 4 Raras misturadas, Brasa nível 10, + Maré nível 10; Sol inicial com Dado ligado | **' + f1(vE3b) + '%** | 60–80% |');
  log('');

  // -------------------------------------------------------------------------
  // 5) Duração das corridas
  // -------------------------------------------------------------------------
  log('### 5. Duração (tempo de simulação até o último cruzar a linha; meta: curta 88–104 s, longa 116–138 s, em volta dos 96 e 127 s da calibração)');
  log('');
  log('Iniciais: as ' + r1.n + ' corridas da M1. PVP de 8: ' + N_PVP + ' salas de 8 sintéticos da mesma raridade e nível (sorteados por sala), estrelas e genética sorteadas, build de bot.');
  log('');
  log('| Distância | Iniciais nível 1: média (p5–p95) | Vencedor: média | PVP de 8: média (p5–p95) | Meta |');
  log('|---|---|---|---|---|');
  [0, 1, 2].forEach(function (g) {
    var a = r1.lists['dur' + g], m = R.pvp8.lists['dur' + g];
    var meta = g === 0 ? '88–104 s' : (g === 2 ? '116–138 s' : '—');
    if (g === 0) { check('5', 'Duração curta (1.400–1.599 m), iniciais', mean(a), 88, 104, ' s'); check('5', 'Duração curta (1.400–1.599 m), PVP 8', mean(m), 88, 104, ' s'); }
    if (g === 2) { check('5', 'Duração longa (1.800–2.000 m), iniciais', mean(a), 116, 138, ' s'); check('5', 'Duração longa (1.800–2.000 m), PVP 8', mean(m), 116, 138, ' s'); }
    log('| ' + GROUP_LABEL[g] + ' | ' + f1(mean(a)) + ' s (' + f1(quant(a, 0.05)) + '–' + f1(quant(a, 0.95)) + ') | ' + f1(mean(r1.lists['win' + g])) + ' s | ' +
      f1(mean(m)) + ' s (' + f1(quant(m, 0.05)) + '–' + f1(quant(m, 0.95)) + ') | ' + meta + ' |');
  });
  log('');

  // -------------------------------------------------------------------------
  // 6) Pagamentos
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 7) Dado da Sorte (rollDice direto, sem simulação)
  // -------------------------------------------------------------------------
  var N7 = 4000, rng7 = S.mulberry32(seedOf(750, 0)), w7 = 0, sum100 = 0, sum0 = 0, n0 = 0;
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

  // -------------------------------------------------------------------------
  // 8) Viradas de clima por corrida
  // -------------------------------------------------------------------------
  var F8 = R.flips, v8 = F8.sum / F8.n;
  check('8', 'Viradas de clima por corrida (PVP 8)', v8, 0.8, 1.6, '');
  log('### 8. Viradas de clima por corrida (PVP 8 sintético, Mítico nível 1 com status 60, elementos sorteados entre Fogo/Água/Grama, skill de tipo ligada; meta: média 0,8–1,6)');
  log('');
  log('| Métrica (' + F8.n + ' corridas) | Valor |');
  log('|---|---|');
  log('| Média de viradas por corrida | **' + f2(v8) + '** |');
  log('| Corridas com 0 viradas | ' + f1(pct(F8.hist[0], F8.n)) + '% |');
  log('| Corridas com 1 virada | ' + f1(pct(F8.hist[1], F8.n)) + '% |');
  log('| Corridas com 2 viradas | ' + f1(pct(F8.hist[2], F8.n)) + '% |');
  log('');

  // -------------------------------------------------------------------------
  // 9) Determinismo
  // -------------------------------------------------------------------------
  var detOk = true;
  function detConfig(seed) {
    var rng = S.mulberry32(seed), rs = [], m = 4 + Math.floor(rng() * 5);
    for (var q = 0; q < m; q++) {
      var h = cat(ALL[Math.floor(rng() * ALL.length)]);
      var lg = Math.floor(rng() * 6);
      rs.push({ horse: h, gear: rng() < 0.6 ? GR.botGear(lg, h.element, rng()) : null, name: G.BOT_NAMES[q], isPlayer: q === 0 });
    }
    return { seed: seed, conditions: S.randomConditions(S.hash2(seed, 99)), racers: rs };
  }
  var firstRun = [];
  for (var d9 = 0; d9 < 25; d9++) firstRun.push(JSON.stringify(S.simulate(detConfig(seedOf(900, d9)))));
  for (var e9 = 24; e9 >= 0; e9--) { // ordem inversa: nenhum estado global vaza entre chamadas
    if (JSON.stringify(S.simulate(detConfig(seedOf(900, e9)))) !== firstRun[e9]) detOk = false;
  }
  var sample = S.simulate(detConfig(seedOf(900, 3)));   // sanidade dos frames
  var framesOk = sample.frames.length > 10 && sample.frames[0].t === 0 &&
    sample.frames.every(function (f, i) { return Math.abs(f.t - i * sample.dt) < 1e-9 && f.pos.length === sample.finishOrder.length; }) &&
    sample.finishOrder.slice().sort().join() === sample.finishOrder.map(function (x, i) { return i; }).join();
  checkBool('9', 'Determinismo: mesma seed+config => mesmo mapa, mesmos dados, mesmo resultado (25 configs com equipamento de bot e mapas aleatórios, reexecução em ordem inversa)',
    detOk && framesOk, framesOk ? '' : 'frames inválidos');
  checkBool('9', 'Seeds diferentes => corridas diferentes', JSON.stringify(S.simulate(detConfig(seedOf(900, 1)))) !== JSON.stringify(S.simulate(detConfig(seedOf(900, 2)))));

  // -------------------------------------------------------------------------
  // 10) Chance de skill observada x calculada, por raridade
  // -------------------------------------------------------------------------
  log('### 10. Chance de skill: observada × calculada (nível 1, Sorte 50, `Arranque`, ' + N_SKILL + ' corridas em reta de 1600 m; meta: diferença ≤ 3 p.p.)');
  log('');
  log('| Raridade | Calculada (`skillChance`) | Observada | Diferença |');
  log('|---|---|---|---|');
  RAR_IDS.forEach(function (rid) {
    var me10 = flat({ sorte: 50 }, 'Sint ' + rid, rid, 'fogo', true);
    var calc = 100 * S.skillChance(me10.horse, S.computeStats(me10.horse, me10.gear));
    var obs = pct(R['skill-' + rid].fired, R['skill-' + rid].n), diff = Math.abs(obs - calc);
    check('10', 'Skill ' + G.RARITIES[rid].name + ': observada ' + f1(obs) + '% × calculada ' + f1(calc) + '% (diferença)', diff, 0, 3, ' p.p.');
    log('| ' + G.RARITIES[rid].name + ' | ' + f1(calc) + '% | ' + f1(obs) + '% | ' + f1(diff) + ' p.p. |');
  });
  log('');

  // -------------------------------------------------------------------------
  // Ligas (informativo)
  // -------------------------------------------------------------------------
  log('### Ligas (Rating de Poder sem equipamento, build de bot)');
  log('');
  log('Limites: ' + G.LEAGUES.map(function (L) { return L.name + ' ≥ ' + L.min; }).join(' · ') + '.');
  log('');
  log('| Montaria | Raridade | Lv | Rating | Liga |');
  log('|---|---|---|---|---|');
  function leagueRow(h, lv) {
    var c = cat(h, lv), rt = S.powerRating(c, null);
    log('| ' + h.name + ' | ' + G.RARITIES[h.rarity].name + ' | ' + c.level + ' | ' + rt + ' | ' + S.leagueFor(rt).name + ' |');
  }
  STARTERS.forEach(function (h) { leagueRow(h, 1); });
  STARTERS.forEach(function (h) { leagueRow(h, 25); });
  G.WILD_HORSES.forEach(function (h) { leagueRow(h, null); });
  log('');

  // -------------------------------------------------------------------------
  // A) Metas da auditoria: S1, A1 (pareadas), P1, P2, M8 (salas)
  // -------------------------------------------------------------------------
  var AU = R.audit;
  log('### A. Metas da auditoria (S1, A1, P1, P2, M8)');
  log('');
  log('S1/A1: ' + N_AUD + ' pares por variante; mesma seed e campo com e sem a mudança. Campo de 6 Raros nível 20 sintéticos (genética sorteada, ★★, build de bot, skills sorteadas), mapa aleatório, Dado ligado; o alvo é o corredor k % 6. ' +
    'A1 usa o campo como está; no S1 os rivais correm sem skills normais e o alvo só com a skill, contra o alvo sem skills normais (com skill de elemento, ele passa a ser desse elemento nas duas corridas). Ganho = vitórias com − vitórias sem, em p.p.' +
    (QUICK ? ' **S1 e A1 só contam como meta no modo completo**: com ' + N_AUD + ' pares o IC (~±2,5 p.p.) passa da margem das skills e dos status mais fracos para o piso de 3 p.p.; as tabelas abaixo são só informativas.' : ''));
  log('');
  log('| Skill | Gatilho | Ativou | Ganho de vitória (p.p., IC 95%) | Meta S1 |');
  log('|---|---|---|---|---|');
  AUD_SKILLS.forEach(function (id) {
    var c = ci(AU.skill[id][0], AU.skill[id][1], N_AUD), isenta = id === 'dado-viciado';
    if (!isenta && !QUICK) check('S1', 'Ganho pareado de vitória: ' + G.SKILLS[id].name, c[0], 3, 13, ' p.p.');
    log('| ' + G.SKILLS[id].name + ' | ' + G.SKILLS[id].trigger + ' | ' + f1(pct(AU.skill[id][2], N_AUD)) + '% | ' + f1(c[0]) + ' ± ' + f1(c[1]) + ' | ' +
      (isenta ? 'isenta (decisão de design pendente)' : '3–13') + ' |');
  });
  log('');
  var gains = {};
  KEYS.forEach(function (k) { gains[k] = ci(AU.stat[k][0], AU.stat[k][1], N_AUD); });
  var six = RACE.map(function (k) { return gains[k][0]; }).sort(function (x, y) { return x - y; });
  var med = (six[2] + six[3]) / 2;
  log('A1: +10 num status (equipamento sintético) no alvo. Meta: nenhum dos seis status de corrida acima de 3,2× a mediana deles (' + f1(med) + ' p.p. → teto ' + f1(3.2 * med) + ') nem abaixo de 3 p.p.; Sorte isenta (decisão de design pendente).');
  log('');
  log('| Status | Ganho de vitória (p.p., IC 95%) | ÷ mediana |');
  log('|---|---|---|');
  KEYS.slice().sort(function (x, y) { return gains[y][0] - gains[x][0]; }).forEach(function (k) {
    var g = gains[k];
    if (k !== 'sorte' && !QUICK) {
      check('A1', '+10 de ' + G.STATS[k].name + ': ganho pareado ≥ 3 p.p.', g[0], 3, 100, ' p.p.');
      check('A1', '+10 de ' + G.STATS[k].name + ': ganho ÷ mediana dos seis', g[0] / med, 0, 3.2, '×');
    }
    log('| ' + G.STATS[k].name + (k === 'sorte' ? ' (isenta)' : '') + ' | ' + f1(g[0]) + ' ± ' + f1(g[1]) + ' | ' + f2(g[0] / med) + '× |');
  });
  log('');
  // P1: curva empírica P(maior Poder à frente) por |diferença| em faixas de 20; resíduo por elemento,
  // por raridade e por estrelas (cada corredor do par conta na sua categoria)
  var L = R.lobby;
  function bucket(d) { return Math.max(-150, Math.min(150, Math.round(d / 20) * 20)); }
  var pairs = {}, resid = {};
  L.recs.forEach(function (x) { var P = pairs[bucket(Math.abs(x[2]))] = pairs[bucket(Math.abs(x[2]))] || [0, 0]; P[1]++; if ((x[2] >= 0) === (x[3] === 1)) P[0]++; });
  function addR(cat, v) { (resid[cat] = resid[cat] || [0, 0])[0] += v; resid[cat][1]++; }
  L.recs.forEach(function (x) {
    var P = pairs[bucket(Math.abs(x[2]))], p = P[0] / P[1], pi = x[2] >= 0 ? p : 1 - p;
    var ca = x[0].split('|'), cb = x[1].split('|');
    ['el:' + ca[0], 'rar:' + ca[1], 'est:' + ca[2]].forEach(function (c) { addR(c, x[3] - pi); });
    ['el:' + cb[0], 'rar:' + cb[1], 'est:' + cb[2]].forEach(function (c) { addR(c, (1 - x[3]) - (1 - pi)); });
  });
  log('P1/P2/M8: ' + L.n + ' salas de 4–8 corredores sintéticos (jogador com raridade, nível 1–50 e estrelas sorteados; bots de Poder 91,5%–111,5% do jogador, nível ajustado ao alvo; todos com a build de bot, sem equipamento), mapa aleatório, Dado ligado. ' +
    'P1 compara cada par da sala (' + L.recs.length + ' pares) com a curva empírica "maior Poder à frente" por diferença de Poder (faixas de 20) e soma o resíduo por categoria.' +
    (QUICK ? ' **P1 só conta como meta no modo completo**: com ' + L.n + ' salas o IC do resíduo é largo demais para a faixa ±5; a tabela abaixo é só informativa.' : ''));
  log('');
  log('| Categoria | Resíduo P1 (vitória no par − previsto pelo Poder, p.p.; meta |x| ≤ 5) | Registros |');
  log('|---|---|---|');
  var P1CATS = EL3.map(function (e) { return ['el:' + e, G.ELEMENTS[e].name]; })
    .concat(RAR.map(function (r) { return ['rar:' + r, G.RARITIES[r].name]; }))
    .concat([1, 2, 3].map(function (s) { return ['est:' + s, '★★★'.slice(0, s)]; }));
  P1CATS.forEach(function (pc) {
    var x = resid[pc[0]], v = x ? 100 * x[0] / x[1] : NaN;
    if (!QUICK) check('P1', 'Resíduo do Poder: ' + pc[1], v, -5, 5, ' p.p.');
    log('| ' + pc[1] + ' | ' + f1(v) + ' | ' + (x ? x[1] : 0) + ' |');
  });
  log('');
  var vFav = pct(L.fav, L.n), vLead = pct(L.lead13, L.n), vClose = pct(L.close, L.n);
  check('P2', 'Favorito do Poder vence na sala pareada', vFav, 35, 55);
  check('M8', 'Quem lidera em 1/3 da pista vence', vLead, 0, 55);
  check('M8', 'Corridas com menos de 1 m entre o 1º e o 2º', vClose, 5, 100);
  log('| Métrica | Valor | Faixa |');
  log('|---|---|---|');
  log('| P2: favorito do Poder vence | **' + f1(vFav) + '%** | 35–55% |');
  log('| M8: líder em 1/3 da pista vence | **' + f1(vLead) + '%** | ≤ 55% |');
  log('| M8: margem do 1º para o 2º abaixo de 1 m | **' + f1(vClose) + '%** | ≥ 5% |');
  log('');

  // -------------------------------------------------------------------------
  // Info extra
  // -------------------------------------------------------------------------
  var inf = r1.info;
  log('### Outros números (corridas da M1: iniciais nível 1, mapas aleatórios)');
  log('');
  log('| Métrica | Valor |');
  log('|---|---|');
  log('| Garra disparou | ' + f1(pct(inf.garra, inf.entries)) + '% dos corredores |');
  log('| "Cansou" (estamina zerou antes dos últimos 2%) | ' + f1(pct(inf.cansou, inf.entries)) + '% dos corredores |');
  log('| Trocas de liderança narradas por corrida | ' + f2(inf.ultrap / r1.n) + ' |');
  log('| Viradas de clima por corrida | ' + f2(inf.clima / r1.n) + ' |');
  log('| Skills de tipo ativadas por corrida | ' + f2(inf.typeSkills / r1.n) + ' (uma por corredor: a skill de tipo é sempre ativa) |');
  log('| Skills normais ativadas por corrida | ' + f2(inf.skills / r1.n) + ' (os iniciais nascem sem skill normal) |');
  log('');

  finish();
}

function finish() {
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
}

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
    { horse: cat(byId.ipe, 6), gear: GR.botGear(2, 'grama', 0.5), name: 'Você', isPlayer: true },
    { horse: cat(byId.brasa, 6), gear: GR.botGear(1, 'fogo', 0.5), name: G.BOT_NAMES[0], isPlayer: false },
    { horse: cat(byId.mare, 6), gear: null, name: G.BOT_NAMES[1], isPlayer: false },
    { horse: cat(byId['w-garoa']), gear: null, name: G.BOT_NAMES[2], isPlayer: false },
    { horse: cat(byId['w-ticao']), gear: null, name: G.BOT_NAMES[3], isPlayer: false },
    { horse: cat(byId['w-mandacaru']), gear: null, name: G.BOT_NAMES[4], isPlayer: false },
    { horse: cat(byId['w-ventania'], 4), gear: null, name: G.BOT_NAMES[5], isPlayer: false },
    { horse: cat(byId['w-pororoca'], 3), gear: null, name: G.BOT_NAMES[6], isPlayer: false }
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
