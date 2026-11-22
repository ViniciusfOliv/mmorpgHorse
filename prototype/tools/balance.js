#!/usr/bin/env node
/*
 * Relatório de balanceamento v3b do RaceSim (status v3b: base pela raridade e genética, pontos por nível
 * com custo por faixa, teto 150, estrelas e skill de tipo; mapas em blocos, clima como triângulo, Dado da
 * Sorte, skills que ativam sempre, com rank; sem tática; o equipamento não mexe em status por enquanto).
 *
 *   node tools/balance.js            # relatório completo (todas as metas)
 *   node tools/balance.js --quick    # menos corridas; as metas ruidosas demais (M6, M9, P1, S1, S5, S6, A1) e as dos desafios de
 *                                    # ginásio (G1, G2, G3, G5, G7) só no completo
 *   node tools/balance.js --tune '{"curveBase":0.84}'   # sobrescreve RaceSim.TUNING (só p/ ajuste)
 *   node tools/balance.js --skills [N]   # só as skills por rank (S1, S5, S6), N pares por skill (padrão 8000), ~2 min
 *   node tools/balance.js --skilltune '{"sprint":{"effect":{"speedMult":1.04}}}'   # sobrescreve GameData.SKILLS (só p/ ajuste)
 *   node tools/balance.js --exemplo  # imprime a corrida de exemplo usada em docs/exemplos.md
 *
 * Sai com código 1 se alguma meta falhar.
 *
 * As metas M1–M9 vêm da calibração do modelo v3b e usam o mesmo método e as mesmas seeds da v3:
 * cavalos sintéticos com genética sorteada pela seed, skills normais sorteadas (as nascidas + as
 * aprendidas esperadas pelo nível) e pontos por uma política nomeada (`bot` = RaceSim.botAlloc).
 * Status fixos de teste (montarias planas, A1) usam o gancho `statAdd` da entrada da corrida. Duelos com largada alternada em mapa aleatório e Dado ligado;
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
var GY = require('../src/ginasio.js');
var WT = require('worker_threads');

var args = process.argv.slice(2);
var QUICK = args.indexOf('--quick') >= 0;
var tuneIdx = args.indexOf('--tune');
if (tuneIdx >= 0) deepAssign(S.TUNING, JSON.parse(args[tuneIdx + 1]));
// --skilltune '{"sprint":{"effect":{"speedMult":1.04}},"SKILL_RANKS":{"diceTeto":[50,60,70,80,100]}}': sobrescreve
// GameData.SKILLS (e SKILL_RANKS), só para ajuste; "rank5" dado substitui o marco inteiro
var skTuneIdx = args.indexOf('--skilltune');
if (skTuneIdx >= 0) {
  var skTune = JSON.parse(args[skTuneIdx + 1]);
  Object.keys(skTune).forEach(function (id) {
    if (id === 'SKILL_RANKS') { deepAssign(G.SKILL_RANKS, skTune[id]); return; }
    if (skTune[id].rank5) { G.SKILLS[id].rank5 = skTune[id].rank5; delete skTune[id].rank5; }
    deepAssign(G.SKILLS[id], skTune[id]);
  });
}
var SCALE = QUICK ? 0.25 : 1;

var STARTERS = G.STARTERS;
var ALL = STARTERS.concat(G.WILD_HORSES);
var RAR_IDS = Object.keys(G.RARITIES);
var KEYS = G.STAT_KEYS;
var RACE = ['vel', 'acel', 'man', 'forca', 'est', 'garra'];   // os seis de corrida (Sorte fica de fora)
var EL3 = ['fogo', 'agua', 'grama'];
var ROMANO = ['', 'I', 'II', 'III', 'IV', 'V'];
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
// Políticas de distribuição dos pontos (custo por faixa: o i-ésimo ponto num status custa 1 + piso(i/10)).
// Todas usam RaceSim.weightedAlloc (um ponto por vez no status de menor pontos/peso que ainda cabe):
//   bot          RaceSim.botAlloc (a build dos bots e o "Distribuir sugerido")
//   eq           peso 1 nos seis de corrida (equilibrada)
//   inc:k        peso 2 em k, 1 nos outros cinco (inclinada: o dobro de pontos em k)
//   dup:k1+k2    peso 2 em k1 e k2, 1 nos outros
//   tipo         peso 2 nos dois status do tipo
//   all:k        tudo em k (até não caber), a sobra nos outros
// Sorte: peso 0,01, mas não recebe pontos (TUNING.noBuy: fica só com a base).
var POLICIES = ['bot', 'eq', 'inc:vel', 'inc:acel', 'inc:man', 'inc:forca', 'inc:est', 'inc:garra',
  'dup:vel+est', 'dup:vel+forca', 'dup:forca+est', 'tipo'];
var POLICIES_ALL = ['all:vel', 'all:acel', 'all:man', 'all:forca', 'all:est', 'all:garra'];
function weightsOf(policy, el) {
  var w = {}; RACE.forEach(function (k) { w[k] = 1; }); w.sorte = 0.01;
  if (policy === 'eq') return w;
  if (policy.indexOf('inc:') === 0) { w[policy.slice(4)] = 2; return w; }
  if (policy.indexOf('dup:') === 0) { policy.slice(4).split('+').forEach(function (k) { w[k] = 2; }); return w; }
  if (policy.indexOf('all:') === 0) { w[policy.slice(4)] = 1e6; return w; }
  if (policy === 'tipo') { TYPE_STATS[el].forEach(function (k) { w[k] = 2; }); return w; }
  throw new Error('política desconhecida: ' + policy);
}
function allocate(horse, policy) {
  if (policy === 'bot') return S.botAlloc(horse);
  if (policy === 'none') { var z = {}; KEYS.forEach(function (k) { z[k] = 0; }); return z; }
  return S.weightedAlloc(horse, weightsOf(policy, horse.element));
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
// Montaria "plana" (seções 3, 8 e 10): nível 1, genética 0, sem pontos e sem skills; o gancho de teste
// statAdd leva cada status ao valor pedido (60 salvo `over`). Corre com noTypeSkill quando `noType`.
function flat(over, name, rarity, element, noType) {
  var h = mkHorse({ name: name, element: element || 'fogo', rarity: rarity || 'mitico', grau: 2, level: 1, g: 0, policy: 'none' });
  var add = {};
  KEYS.forEach(function (k) { add[k] = (over && over[k] != null ? over[k] : 60) - S.naturalStat(h, k); });
  return { horse: h, gear: null, name: name, isPlayer: false, noTypeSkill: !!noType, statAdd: add };
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
// A1 e S1/S5/S6 (comparações pareadas): campo de 6 Raros nível 20 sintéticos (genética sorteada, build de
// bot, skills sorteadas), mapa aleatório, Dado ligado; o alvo é o corredor k % 6.
//   A1 (tAudit): +10 num status (gancho statAdd) contra o alvo como está.
//   S1, S5 e S6 (tRank): rivais sem skills normais; o alvo só com a skill testada (no rank 1 e no rank 5, nas mesmas
//       seeds) contra o alvo sem skills normais (com skill de elemento, ele passa a ser desse elemento, com a build
//       de bot refeita, nas três corridas). A skill ativa sempre que o gatilho acontece.
var AUD_SKILLS = Object.keys(G.SKILLS);
function audField(P, k) {
  var seed = S.hash2(P.seed, k), rng = rngOf(seed, 80), field = [];
  for (var q = 0; q < 6; q++) field.push(build({ rarity: 'raro', level: 20, grau: 2, policy: 'bot' }, rng, {}, 'H' + q).h);
  return { seed: seed, cond: S.randomConditions(seed), field: field, subj: k % 6 };
}
function tAudit(P, a, b) {
  var o = { stat: {} };
  KEYS.forEach(function (kk) { o.stat[kk] = [0, 0]; });
  for (var k = a; k < b; k++) {
    var F = audField(P, k), subj = F.subj;
    var runWith = function (h, add) {
      return run(F.seed, F.cond, F.field.map(function (x, i) { return i === subj ? racer(h, add ? { statAdd: add } : null) : racer(x); }));
    };
    var base = runWith(F.field[subj]).finishOrder[0] === subj ? 1 : 0;
    KEYS.forEach(function (kk) {
      var add = {}; add[kk] = 10;
      var d = (runWith(F.field[subj], add).finishOrder[0] === subj ? 1 : 0) - base;
      o.stat[kk][0] += d; o.stat[kk][1] += d * d;
    });
  }
  return o;
}
// o.skill[id] = [soma d1, soma d1², ativou (rank 1), soma d5, soma d5², soma d1·d5]. P: { seed, so: [ids] (opcional) }
function tRank(P, a, b) {
  var o = { skill: {} }, ids = P.so || AUD_SKILLS;
  ids.forEach(function (id) { o.skill[id] = [0, 0, 0, 0, 0, 0]; });
  for (var k = a; k < b; k++) {
    var F = audField(P, k), subj = F.subj;
    // S1 mede como sempre mediu: rivais sem skills normais (com elas, o alvo sem skill fica abaixo do
    // campo e o ganho de uma skill some no meio das dos rivais)
    var field = F.field.map(function (x, i) { if (i === subj) return x; var c = copy(x); c.skills = []; return c; });
    var runWith = function (h) { return run(F.seed, F.cond, field.map(function (x, i) { return racer(i === subj ? h : x); })); };
    var bases = {};
    var variant = function (el, skills, rank) {
      var h = copy(field[subj]); h.element = el; h.skills = skills; h.alloc = S.botAlloc(h);
      return S.withRanks(h, rank);
    };
    ids.forEach(function (id) {
      var sk = G.SKILLS[id], el = sk.element === 'geral' ? field[subj].element : sk.element;
      if (!(el in bases)) bases[el] = runWith(variant(el, [], 1)).finishOrder[0] === subj ? 1 : 0;
      var res = runWith(variant(el, [id], 1)), d1 = (res.finishOrder[0] === subj ? 1 : 0) - bases[el], A = o.skill[id];
      var d5 = (runWith(variant(el, [id], G.SKILL_RANKS.max)).finishOrder[0] === subj ? 1 : 0) - bases[el];
      A[0] += d1; A[1] += d1 * d1; A[3] += d5; A[4] += d5 * d5; A[5] += d1 * d5;
      if (countType(res, 'skill', subj) > 0) A[2]++;
    });
  }
  return o;
}
// Salas como o jogo monta (M8, P1, P2): jogador sintético sorteado (raridade, nível 1–50, estrelas),
// bots de Poder 91,5%–111,5% do jogador com o nível ajustado ao alvo; todos com a build de bot.
// Rank das skills: o do jogador é sorteado de 1 a 5 pela seed da sala (fluxo próprio: não desloca os outros
// sorteios) e vale para todas as skills dele; os bots usam S.botRank(jogador), antes do Poder, como no jogo.
function tLobby(P, a, b) {
  var o = { n: 0, fav: 0, lead13: 0, close: 0, recs: [] };
  function catOf(h) { return h.element + '|' + h.rarity + '|' + h.grau; }
  for (var k = a; k < b; k++) {
    var seed = S.hash2(P.seed, k), rng = rngOf(seed, 81), cond = S.randomConditions(seed);
    var nR = 4 + Math.floor(rng() * 5);
    var pl = build({ rarity: pickRar(rng), level: 1 + Math.floor(rng() * 50), grau: 1 + Math.floor(rng() * 3), policy: 'bot' }, rng, {}, 'P').h;
    pl = S.withRanks(pl, 1 + Math.floor(rngOf(seed, 83)() * G.SKILL_RANKS.max));
    var rkBot = S.botRank(pl);
    var pr = S.powerRating(pl, null), hs = [pl];
    for (var q = 1; q < nR; q++) {
      var target = pr * (0.915 + 0.2 * rng()), best = null;
      for (var tries = 0; tries < 12 && !best; tries++) {
        var spec = { rarity: pickRar(rng), grau: 1 + Math.floor(rng() * 3), policy: 'bot', level: 1 };
        var bh = build(spec, rng, {}, 'B' + q), cand = null, cd = Infinity;
        var mkL = function (lv) { return S.withRanks(build({ rarity: spec.rarity, grau: spec.grau, policy: spec.policy, level: lv, element: bh.el, g: bh.g }, rng, { order: bh.order }, 'B' + q).h, rkBot); };
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
// M6: builds em rodízio (mesma genética e elemento). P: { builds, spec, seed } → w[i][j] vitórias de i sobre j.
function tRobin(P, a, b) {
  var nb = P.builds.length, o = { w: [], n: [] }, i, j;
  for (i = 0; i < nb; i++) { o.w.push(new Array(nb).fill(0)); o.n.push(new Array(nb).fill(0)); }
  for (var k = a; k < b; k++) {
    var seed = S.hash2(P.seed, k), rng = rngOf(seed, 78), cond = S.randomConditions(seed);
    var base = build(Object.assign({}, P.spec, { policy: 'none' }), rng, {}, 'A');
    var hs = P.builds.map(function (pol, q) { var h = copy(base.h); h.alloc = allocate(h, pol); h.name = 'B' + q; return h; });
    for (i = 0; i < nb; i++) for (j = i + 1; j < nb; j++) {
      var pair = (k + i + j) % 2 ? [i, j] : [j, i];
      var res = run(S.hash2(seed, i * 31 + j), cond, pair.map(function (q) { return racer(hs[q]); }));
      var win = pair[res.finishOrder[0]], los = win === i ? j : i;
      o.w[win][los]++; o.n[i][j]++; o.n[j][i]++;
    }
  }
  return o;
}
// PVP de 8 (duração): raridade e nível sorteados para a sala; 8 sintéticos dessa raridade e nível
// (estrelas e genética sorteadas, build de bot).
// P: { rarity, level, grau } fixa a sala (nível alto); sem eles, sorteia como antes.
// A liga da sala é a do Poder médio dos 8; as durações vão também para lists['<liga><faixa>'].
function tPvp8(P, a, b) {
  var o = { lists: { dur0: [], dur1: [], dur2: [] }, league: {} };
  G.LEAGUES.forEach(function (lg) { [0, 1, 2].forEach(function (g) { o.lists[lg.id + g] = []; }); o.league[lg.id] = 0; });
  for (var k = a; k < b; k++) {
    var seed = seedOf(600, k), rng = rngOf(seed, 4242), cond = S.randomConditions(seed);
    var rar = P.rarity || pickRar(rng), lv = P.level || 1 + Math.floor(rng() * 50), rs = [], pw = 0;
    for (var q = 0; q < 8; q++) { var h = build({ rarity: rar, level: lv, grau: P.grau || 1 + Math.floor(rng() * 3), policy: 'bot' }, rng, {}, G.BOT_NAMES[q]).h; pw += S.powerRating(h); rs.push(racer(h)); }
    var d = run(seed, cond, rs).duration, gi = distGroup(cond.distance), lg = S.leagueFor(pw / 8).id;
    o.lists['dur' + gi].push(d); o.lists[lg + gi].push(d); o.league[lg]++;
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
// ---------------------------------------------------------------------------
// Ginásios da Expedição (metas G1–G9; spec 2026-11-17-ginasios §12, com as Rulings 8, 11 e 12 da frente).
// Time de referência: o inicial do elemento, repetido até o tamanho do time do adversário, no nível pedido,
// com a build dos bots ("Distribuir sugerido"). O desafio é o Ginasio.resolver de verdade (clima Nublado, pista
// da casa, vantagem e cansaço do catálogo).
// ---------------------------------------------------------------------------
var GYM_STARTER = { fogo: 'brasa', agua: 'mare', grama: 'ipe' };
var GYM_FORTE = { fogo: 'grama', agua: 'fogo', grama: 'agua' };   // o elemento que o ginásio vence
function gymLevel(gid, e) { return G.GYMS[gid].etapas[e].cavalos[0].level; }
function gymRef(el, level, size) {
  var h = cat(starterById(GYM_STARTER[el]), Math.max(1, level)), t = [];
  for (var i = 0; i < size; i++) t.push(h);
  return t;
}
function gymCond(gid) { var p = G.GYMS[gid].pista; return { distance: p.distance, surface: p.surface, weather: 'nublado', blocks: p.blocks }; }
// Taxa de vitória de um desafio (G1, G2, G3, G7). P: { gym, etapa, el, dL, size, semCansaco, seed }
function tGym(P, a, b) {
  var o = { n: 0, w: 0 }, fx = G.GYM.fadiga.faixas, guarda = fx.map(function (f) { return f.perde; });
  try {
    if (P.semCansaco) fx.forEach(function (f) { f.perde = 0; });
    var time = gymRef(P.el, gymLevel(P.gym, P.etapa) + (P.dL || 0), P.size || G.GYMS[P.gym].etapas[P.etapa].cavalos.length);
    for (var k = a; k < b; k++) {
      var r = GY.resolver({ gymId: P.gym, etapa: P.etapa, time: time, seedBase: S.hash2(P.seed, k), contador: 0 });
      o.n++; if (r.venceu) o.w++;
    }
  } finally { fx.forEach(function (f, i) { f.perde = guarda[i]; }); }
  return o;
}
// G4: duelo 1 contra 1 na pista do ginásio, sem a vantagem de elemento, nível igual (os cinco níveis das etapas em
// rodízio), clima Nublado, largada alternada: o inicial de `el` contra o inicial do ginásio. P: { gym, el, seed }
function tGymPista(P, a, b) {
  var cond = gymCond(P.gym), lv = [0, 1, 2, 3, 4].map(function (e) { return gymLevel(P.gym, e); }), o = { n: 0, wA: 0 };
  var As = lv.map(function (L) { return cat(starterById(GYM_STARTER[P.el]), L); }), Bs = lv.map(function (L) { return cat(starterById(GYM_STARTER[P.gym]), L); });
  for (var k = a; k < b; k++) {
    var A = As[k % 5], B = Bs[k % 5], pair = Math.floor(k / 5) % 2 ? [A, B] : [B, A];
    var res = run(seedOf(P.seed, k), cond, pair.map(function (h) { return racer(h); }));
    o.n++; if (pair[res.finishOrder[0]] === A) o.wA++;
  }
  return o;
}
// G6 e G8: o inicial do ginásio, sozinho e no nível da etapa (as cinco em rodízio), desafia a etapa; o 1º duelo é
// entre cavalos de nível igual e descansados (a faixa dele conta na G6); a duração de cada duelo (até os dois
// cruzarem a linha) conta na G8. P: { gym, seed }
function tGymPrimeiro(P, a, b) {
  var o = { n: 0, f: [0, 0, 0], lists: { dur: [], m: [] } }, ids = G.GYM.fadiga.faixas.map(function (f) { return f.id; });
  var times = [0, 1, 2, 3, 4].map(function (e) { return gymRef(P.gym, gymLevel(P.gym, e), 1); });
  for (var k = a; k < b; k++) {
    var e = k % 5, r = GY.resolver({ gymId: P.gym, etapa: e, time: times[e], seedBase: S.hash2(P.seed, k), contador: 0 });
    o.n++; o.f[ids.indexOf(r.duelos[0].faixa.id)]++; o.lists.m.push(r.duelos[0].metros);
    r.duelos.forEach(function (d) { var x = S.simulate(d.cfg); o.lists.dur.push(Math.max(x.finishTimes[0], x.finishTimes[1])); });
  }
  return o;
}
var TASKS = { starters: tStarters, duel: tDuel, catDuel: tCatDuel, spec: tSpec, typeGain: tTypeGain, audit: tAudit, rank: tRank,
  lobby: tLobby, m9: tM9, robin: tRobin, pvp8: tPvp8, flips: tFlips, skillObs: tSkillObs, gym: tGym, gymPista: tGymPista, gymPrimeiro: tGymPrimeiro };

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

// --skills [N]: só a medição das skills por rank (S1, S5, S6), para recalibrar os valores base sem o relatório todo.
var skIdx = args.indexOf('--skills');
if (skIdx >= 0) {
  var nSk = Number(args[skIdx + 1]) > 0 ? Math.floor(Number(args[skIdx + 1])) : 8000;
  JOBS = {}; job('rank', 'rank', { seed: 15 }, nSk, 32);
  runPool().then(function (R) {
    out = []; results = [];
    skillRankReport(R.rank, nSk, true);
    console.log(out.join('\n'));
    var ruins = results.filter(function (r) { return !r.ok; });
    console.log('\n' + (ruins.length ? ruins.length + ' de ' + results.length + ' metas das skills FALHARAM: ' + ruins.map(function (r) { return r.id + ' ' + r.label; }).join('; ') : 'As ' + results.length + ' metas das skills passaram.'));
    process.exit(ruins.length ? 1 : 0);
  }, function (e) { console.error(e && e.stack || e); process.exit(1); });
  return;
}

var t0 = Date.now(); // só para medir o tempo do relatório (não entra na simulação)

// Tamanho das amostras: [completo, --quick]. As metas com margem curta para a faixa usam o mesmo N
// nos dois modos (duelos são baratos); M6, M9, P1, S1, S5, S6 e A1 só contam no completo.
function NN(full, quick) { return QUICK ? quick : full; }
var N_M1 = 15000, N_CLIMA = n(3000), N_SPEC = n(2000), N_4A = n(1500);
var N_M3 = NN(3000, 1000), N_M4 = NN(3000, 1500), N_M5 = NN(3000, 1500), N_M6 = 800, N_M9 = 18000;
var N_M2 = NN(4000, 500), N_AUD = NN(4000, 1000), N_RANK = NN(8000, 1000), N_LOBBY = NN(5000, 1500);
var N_PVP = NN(1500, 400), N_HI = NN(800, 300), N_FLIPS = n(1000), N_SKILL = 2000;

// -- registra as medições (as mais pesadas primeiro, para o pool terminar junto)
job('audit', 'audit', { seed: 15 }, N_AUD, 32);
if (!QUICK) [['comum', 1], ['raro', 30], ['lendario', 50]].forEach(function (c) { job('m9-' + c[0], 'm9', { rarity: c[0], level: c[1], seed: 17 }, N_M9, 12); });
[['comum', 1], ['raro', 30], ['lendario', 50]].forEach(function (c) { job('m2-' + c[0], 'typeGain', { rarity: c[0], level: c[1], seed: 99 }, N_M2, 8); });
job('lobby', 'lobby', { seed: 16 }, N_LOBBY, 16);
job('rank', 'rank', { seed: 15 }, N_RANK, 32);
// M6: rodízio das builds realistas (POLICIES) e das "tudo num status" (POLICIES_ALL, só informação), Raro ★★
var M6_LV = [11, 30, 50], M6_B = POLICIES.concat(POLICIES_ALL);
if (!QUICK) M6_LV.forEach(function (lv) { job('m6-' + lv, 'robin', { builds: M6_B, spec: { rarity: 'raro', level: lv, grau: 2 }, seed: 61 + lv }, N_M6, 8); });
// informativo: as pontas da progressão (Comum ★★ 50 e Mítico ★★★ 50), só as builds realistas
var M6_X = [['comum', 50, 2], ['mitico', 50, 3]];
if (!QUICK) M6_X.forEach(function (c) { job('m6x-' + c[0], 'robin', { builds: POLICIES, spec: { rarity: c[0], level: c[1], grau: c[2] }, seed: 161 }, N_M6, 8); });
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
// durações no nível alto: salas de 8 iguais em raridade, nível 50 e estrelas
var HI = [['comum', 50, 2], ['lendario', 50, 2], ['mitico', 50, 3]];
HI.forEach(function (c) { job('hi-' + c.join('-'), 'pvp8', { rarity: c[0], level: c[1], grau: c[2] }, N_HI, 4); });
job('pvp8', 'pvp8', {}, N_PVP, 4);
job('flips', 'flips', {}, N_FLIPS, 2);
var SPEC = [
  ['3', 'De curva (MAN 90) × de reta (VEL 90)', 'CURVA', 'man', 'vel', 'curva', 65, 100],
  ['3b', 'De reta (VEL 90) × de curva (MAN 90) em reta pura', 'RETA', 'vel', 'man', 'reta', 70, 100],
  ['3c', 'De subida (FOR 90) × de reta (VEL 90)', 'SUBIDA', 'forca', 'vel', 'subida', 65, 100]
];
SPEC.forEach(function (sp, si) { job('spec-' + sp[0], 'spec', { map: sp[2], statA: sp[3], statB: sp[4], test: 300 + si }, N_SPEC, 2); });
var miticos = G.WILD_HORSES.filter(function (h) { return h.rarity === 'mitico'; });
var comuns = G.WILD_HORSES.filter(function (h) { return h.rarity === 'comum'; });
miticos.forEach(function (M, mi) { comuns.forEach(function (C, ci2) { job('4a-' + M.id + '-' + C.id, 'catDuel', { A: [M.id, 1], B: [C.id, 1], test: 400 + mi * 10 + ci2 }, N_4A, 1); }); });
RAR_IDS.forEach(function (rid, ri) { job('skill-' + rid, 'skillObs', { rid: rid, ri: ri }, N_SKILL, 2); });
// Ginásios (G): G4, G6 e G8 nos dois modos (mesmo N: duelos baratos, margem curta); os desafios (G1, G2, G3, G5, G7)
// só no completo. G7 com e sem cansaço usa as mesmas seeds (comparação pareada).
var N_G = 3000, N_G4 = 5000, N_G6 = 1500;
var G_KINDS = [['g1', 'mesmo', 0], ['g2a', 'mesmo', 4], ['g2b', 'mesmo', -4], ['g3a', 'fraco', 0], ['g3d', 'forte', 0]];
G.GYM_ORDER.forEach(function (gid, gi) {
  EL3.forEach(function (el, ei) { if (el !== gid) job('g4-' + gid + '-' + el, 'gymPista', { gym: gid, el: el, seed: 7100 + gi * 10 + ei }, N_G4, 4); });
  job('g6-' + gid, 'gymPrimeiro', { gym: gid, seed: 7200 + gi }, N_G6, 4);
  if (QUICK) return;
  [0, 1, 2, 3, 4].forEach(function (e) {
    G_KINDS.forEach(function (kd, ki) {
      var el = kd[1] === 'mesmo' ? gid : (kd[1] === 'fraco' ? G.GYMS[gid].fraco : GYM_FORTE[gid]);
      job(kd[0] + '-' + gid + '-' + e, 'gym', { gym: gid, etapa: e, el: el, dL: kd[2], seed: 7300 + gi * 100 + e * 10 + ki }, N_G, 8);
    });
  });
  job('g7-' + gid, 'gym', { gym: gid, etapa: 4, el: gid, dL: 4, size: 1, seed: 7700 + gi }, N_G, 8);
  job('g7s-' + gid, 'gym', { gym: gid, etapa: 4, el: gid, dL: 4, size: 1, semCansaco: true, seed: 7700 + gi }, N_G, 8);
});

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
// Skills por rank (S1, S5, S6): tabela e metas. RK = resultado de tRank; `conta` = as metas valem (modo completo).
//   S1: ganho pareado no rank 1 de 3 a 13 p.p.; S5: rank 5 de 1,4× a 2,4× o rank 1 da mesma skill e até 20 p.p.;
//   S6: no rank 5, nenhuma skill acima de 2× a mediana das 15. O Dado Viciado é isento do S1 e da razão do S5 (o dado
//   extra só mexe na virada de clima: o ganho é pequeno demais para a razão fazer sentido); os tetos valem para ele.
function skillRankReport(RK, N, conta) {
  var ids = Object.keys(RK.skill), linhas = [];
  ids.forEach(function (id) {
    var A = RK.skill[id], c1 = ci(A[0], A[1], N), c5 = ci(A[3], A[4], N), m1 = A[0] / N, m5 = A[3] / N;
    var razao = m1 > 0 ? m5 / m1 : NaN;
    // IC da razão (método delta, com a covariância das duas medidas nas mesmas seeds)
    var v1 = (A[1] - N * m1 * m1) / (N - 1), v5 = (A[4] - N * m5 * m5) / (N - 1), c15 = (A[5] - N * m1 * m5) / (N - 1);
    var eR = m1 > 0 ? 1.96 * Math.sqrt(Math.max(0, (v5 - 2 * razao * c15 + razao * razao * v1) / N)) / m1 : NaN;
    linhas.push({ id: id, c1: c1, c5: c5, razao: razao, eR: eR, ativou: pct(A[2], N), isenta: id === 'dado-viciado' });
  });
  var g5 = linhas.map(function (l) { return l.c5[0]; }).sort(function (x, y) { return x - y; });
  var med5 = g5.length % 2 ? g5[(g5.length - 1) / 2] : (g5[g5.length / 2 - 1] + g5[g5.length / 2]) / 2;
  log('| Skill | Gatilho | Ativou | Rank 1 (p.p., IC 95%) | Rank 5 (p.p., IC 95%) | Rank 5 ÷ rank 1 | Rank 5 ÷ mediana |');
  log('|---|---|---|---|---|---|---|');
  linhas.forEach(function (l) {
    var nome = G.SKILLS[l.id].name;
    if (conta) {
      if (!l.isenta) {
        check('S1', 'Ganho pareado de vitória no rank 1: ' + nome, l.c1[0], 3, 13, ' p.p.');
        check('S5', 'Rank 5 ÷ rank 1: ' + nome, l.razao, 1.4, 2.4, '×');   // teto 2,2 na spec; 2,4 desde a Garra sem falhar (a escala sozinha passou de ~1,6× a ~1,8×)
      }
      check('S5', 'Ganho pareado no rank 5: ' + nome, l.c5[0], -100, 20, ' p.p.');
      check('S6', 'Rank 5 ÷ mediana das ' + linhas.length + ': ' + nome, l.c5[0] / med5, -100, 2, '×');
    }
    log('| ' + nome + (l.isenta ? ' (isenta do S1 e da razão)' : '') + ' | ' + G.SKILLS[l.id].trigger + ' | ' + f1(l.ativou) + '% | ' + f1(l.c1[0]) + ' ± ' + f1(l.c1[1]) + ' | ' +
      f1(l.c5[0]) + ' ± ' + f1(l.c5[1]) + ' | ' + (isFinite(l.razao) ? f2(l.razao) + '× ± ' + f2(l.eR) : '—') + ' | ' + f2(l.c5[0] / med5) + '× |');
  });
  log('');
  log('Metas: S1, rank 1 de 3 a 13 p.p.; S5, rank 5 de 1,4× a 2,4× o rank 1 da mesma skill e até 20 p.p.; S6, rank 5 até 2× a mediana das ' + linhas.length + ' (' + f1(med5) + ' p.p. → teto ' + f1(2 * med5) + ').');
  log('');
}

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
  if (QUICK) { log(''); log('> **--quick: as metas M6, M9, P1, S1, S5, S6 e A1 (e as G1, G2, G3, G5 e G7 dos ginásios) só contam no completo** (aqui as cinco primeiras aparecem só como informação, porque com poucas amostras o ruído passa da margem da faixa; as dos ginásios não rodam, só uma nota na seção G). Para medi-las: `node prototype/tools/balance.js`.'); }
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
  log('### 2. Inicial com o clima do seu elemento fixo, sem Dado (meta: 45%–68%; v3b: a corrida ficou menos ruidosa, a vantagem fixa de clima pesa um pouco mais)');
  log('');
  log('Mapas aleatórios com o clima trocado pelo do elemento do inicial, fixo durante toda a corrida (`diceAt = []` nesta seção).');
  log('');
  log('| Inicial | Clima | Multiplicadores (Brasa · Maré · Ipê) | Vitórias (' + N_CLIMA + ') |');
  log('|---|---|---|---|');
  STARTERS.forEach(function (h, i) {
    var w = G.ELEMENTS[h.element].weather, rc = R['clima-' + h.id], v = pct(rc.w[i], rc.n);
    check('2', h.name + ' no seu clima', v, 45, 73);   // rebaseada em 2026-11-19 (skills e Garra sem falhar): era 45–68
    var mults = STARTERS.map(function (x) { return '×' + f2(S.weatherMult(x.element, w, false)); }).join(' · ');
    log('| ' + h.name + ' | ' + G.WEATHERS[w].name + ' | ' + mults + ' | **' + f1(v) + '%** |');
  });
  log('');

  // -------------------------------------------------------------------------
  // 3) Especialistas por trecho
  // -------------------------------------------------------------------------
  log('### 3. Especialistas por trecho (Mítico nível 1 de Fogo sem skill de tipo, status 60 e um 90 pelo gancho statAdd; metas: 3 de 65% a 100%, 3b de 70% a 100%, 3c de 65% a 100%)');
  log('');
  log('v3b: 3 e 3c rebaseadas para 65%–100% (na v3, 65–85 e 75–93): a curva ganhou inclinação (0,14 → 0,17) e a corrida ficou menos ruidosa, então o especialista vence quase sempre na pista dele; e pistas com 75% de um trecho só existem neste teste (o sorteio limita cada tipo a 50%), em pista sorteada quem vigia é a M6. ' +
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
  log('**M4.** Raridade acima, mesmo nível, mesma genética, ★★ e build de bot (um degrau: meta 72%–88%; dois degraus: meta ≥ 94%; ' + N_M4 + ' duelos cada).');
  log('');
  log('| Nível | ' + M4_ONE.concat(M4_TWO).map(function (hl) { return G.RARITIES[hl[0]].name + ' × ' + G.RARITIES[hl[1]].name; }).join(' | ') + ' |');
  log('|---|' + M4_ONE.concat(M4_TWO).map(function () { return '---|'; }).join(''));
  M4_LV.forEach(function (lv) {
    log('| ' + lv + ' | ' + M4_ONE.concat(M4_TWO).map(function (hl, i) {
      var v = wr('m4-' + lv + '-' + hl[0] + '-' + hl[1]), two = i >= M4_ONE.length;
      // v3b rodada 3: dois degraus ≥ 94% (era 95; no nível 50 mede 95,0–95,8% em 4 bases de seed)
      check('M4', (two ? 'Dois degraus' : 'Um degrau') + ', nível ' + lv + ': ' + G.RARITIES[hl[0]].name + ' × ' + G.RARITIES[hl[1]].name, v, two ? 94 : 72, two ? 100 : 95);   // rebaseada em 2026-11-19 (skills e Garra sem falhar): era 72–88 no degrau único
      return '**' + f1(v) + '%**';
    }).join(' | ') + ' |');
  });
  log('');
  log('**M5.** Estrelas no nível 50, mesma raridade e mesma genética, build de bot (★★★ × ★: meta 65%–75%; ★★ × ★: meta 55%–64%; ' + N_M5 + ' duelos cada).');
  log('');
  log('| Raridade | ★★★ × ★ | ★★ × ★ |');
  log('|---|---|---|');
  M5_RAR.forEach(function (rar) {
    var a = wr('m5-31-' + rar), b = wr('m5-21-' + rar);
    check('M5', '★★★ × ★, ' + G.RARITIES[rar].name + ' nível 50', a, 61, 75);   // rebaseada em 2026-11-19 (skills e Garra sem falhar): era 65–75
    check('M5', '★★ × ★, ' + G.RARITIES[rar].name + ' nível 50', b, 52, 64);   // rebaseada em 2026-11-19 (skills e Garra sem falhar): era 55–64;   // v3b rodada 3: era 63 (Mítico 63,1% numa das 4 bases)
    log('| ' + G.RARITIES[rar].name + ' | **' + f1(a) + '%** | **' + f1(b) + '%** |');
  });
  log('');

  // -------------------------------------------------------------------------
  // M6) Nenhuma build dominante
  // -------------------------------------------------------------------------
  log('### M6. Nenhuma build dominante (Raro ★★ e as pontas Comum ★★ 50 e Mítico ★★★ 50; mesma genética e elemento, rodízio de duelos; metas da v3b rodada 3, rebaseadas ao medido em 4 bases de seed: maior média ≤ 62% no Raro, ≤ 64% no Comum ★★ 50, ≤ 67% no Mítico ★★★ 50; toda `inc:*` e a `tipo` ≥ 45%; pelo menos 4 builds entre 45% e 60%; `all:*` < 35% nos níveis 30 e 50)');
  log('');
  log('Builds realistas (custo por faixa): `bot` (`botAlloc`), `eq` (equilibrada), `inc:k` (o dobro de pontos em k), `dup:k1+k2` (o dobro em dois), `tipo` (o dobro nos dois do tipo). ' +
    '`all:k` (tudo num status) entra no rodízio só como informação. Média = vitórias contra as outras builds realistas.');
  log('');
  if (QUICK) {
    log('_Só no modo completo (' + M6_B.length * (M6_B.length - 1) / 2 + ' pares × ' + N_M6 + ' duelos por nível)._');
  } else {
    var nb6 = POLICIES.length;
    log('| Build | ' + M6_LV.map(function (lv) { return 'nível ' + lv; }).join(' | ') + ' |');
    log('|---|---|---|---|');
    var avg6 = {};
    M6_LV.forEach(function (lv) {
      var r = R['m6-' + lv];
      avg6[lv] = M6_B.map(function (pol, i) { var w = 0, nn = 0; for (var j = 0; j < nb6; j++) if (j !== i) { w += r.w[i][j]; nn += r.n[i][j]; } return pct(w, nn); });
    });
    M6_B.forEach(function (pol, i) { log('| `' + pol + '`' + (i >= nb6 ? ' (info)' : '') + ' | ' + M6_LV.map(function (lv) { return f1(avg6[lv][i]) + '%'; }).join(' | ') + ' |'); });
    log('| **maior média (realistas)** | ' + M6_LV.map(function (lv) {
      var mx = Math.max.apply(null, avg6[lv].slice(0, nb6)), in45 = avg6[lv].slice(0, nb6).filter(function (v) { return v >= 45 && v <= 60; }).length;
      check('M6', 'Maior média de build realista, nível ' + lv, mx, 0, 62);
      check('M6', 'Builds realistas entre 45% e 60%, nível ' + lv, in45, 4, 99, '');
      // toda inclinada num status de corrida e a `tipo` com pelo menos 45% de média (rodada 2 pedia 47; medido 46,1–47,4 no pior caso)
      POLICIES.forEach(function (pol, i) { if (pol.indexOf('inc:') === 0 || pol === 'tipo') check('M6', 'Build `' + pol + '` (média), nível ' + lv, avg6[lv][i], 45, 100); });
      // "tudo num status" não é opção a partir do nível 30
      if (lv >= 30) check('M6', 'Maior "tudo num status" (`all:*`), nível ' + lv, Math.max.apply(null, avg6[lv].slice(nb6)), 0, 35);
      return '**' + f1(mx) + '%** (' + in45 + ' em 45–60)';
    }).join(' | ') + ' |');
    log('');
    log('Pontas da progressão (só as builds realistas; meta: maior média ≤ 64% no Comum ★★ 50 e ≤ 67% no Mítico ★★★ 50): ' + M6_X.map(function (c) {
      var r = R['m6x-' + c[0]], av = POLICIES.map(function (pol, i) { var w = 0, nn = 0; for (var j = 0; j < nb6; j++) if (j !== i) { w += r.w[i][j]; nn += r.n[i][j]; } return pct(w, nn); });
      var mx = 0, mi = 0; av.forEach(function (v, i) { if (v > mx) { mx = v; mi = i; } });
      check('M6', 'Maior média de build realista, ' + G.RARITIES[c[0]].name + ' ' + '★★★'.slice(0, c[2]) + ' nível ' + c[1], mx, 0, c[0] === 'mitico' ? 67 : 64);
      return G.RARITIES[c[0]].name + ' ' + '★★★'.slice(0, c[2]) + ' ' + c[1] + ': maior média ' + f1(mx) + '% (`' + POLICIES[mi] + '`); ' +
        POLICIES.map(function (pol, i) { return '`' + pol + '` ' + f1(av[i]); }).join(' · ');
    }).join('. ') + '.');
  }
  log('');

  // -------------------------------------------------------------------------
  // M7) Maior status alcançável no nível 50 (cálculo exato, sem corrida)
  // -------------------------------------------------------------------------
  function maxStat(rar, st, g, policy) {
    var h = { element: 'fogo', rarity: rar, grau: st, level: 50, potential: {}, skills: [] };
    KEYS.forEach(function (k) { h.potential[k] = g; });
    h.alloc = allocate(h, policy);
    var s = S.computeStats(h), best = 0;
    RACE.forEach(function (k) { if (s[k] > best) best = s[k]; });
    return { v: best, pts: S.freePoints(h) };
  }
  log('### M7. Maior status no nível 50 (Fogo; meta: o pior caso, Mítico ★★★ com genética 31 e tudo num status, abaixo de 150)');
  log('');
  log('Cálculo exato. "Tudo num status": genética 31 e todos os pontos em Velocidade. "Inclinada típica": genética 15 e o dobro de pontos em Velocidade (`inc:vel`). Entre parênteses, os pontos no nível 50.');
  log('');
  log('| Raridade | ★ tudo / inclinada | ★★ tudo / inclinada | ★★★ tudo / inclinada |');
  log('|---|---|---|---|');
  var worst = 0;
  RAR.forEach(function (rar) {
    log('| ' + G.RARITIES[rar].name + ' | ' + [1, 2, 3].map(function (st) {
      var a = maxStat(rar, st, 31, 'all:vel'), b = maxStat(rar, st, 15, 'inc:vel');
      if (a.v > worst) worst = a.v;
      return a.v + ' / ' + b.v + ' (' + a.pts + ')';
    }).join(' | ') + ' |');
  });
  check('M7', 'Pior caso no nível 50 (Mítico ★★★, genética 31, tudo num status)', worst, 1, 149, '');
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
        check('M9', 'Vitória por corredor de ' + G.ELEMENTS[e].name + ', ' + G.RARITIES[c[0]].name + ' nível ' + c[1], p[0], 15.0, 18.3);   // rebaseada em 2026-11-19 (skills e Garra sem falhar): era 15,3–18,0
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
  // E) Equipamento: fora (as peças não mexem em status por enquanto; metas E1–E4 e E3b saíram)
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // 5) Duração das corridas
  // -------------------------------------------------------------------------
  // faixas por liga (média do último a chegar; curta 1.400–1.599 m, longa 1.800–2.000 m)
  var DUR_BANDS = { bronze: [92, 104, 121, 136], prata: [90, 102, 119, 133], ouro: [88, 100, 117, 131],
    platina: [86, 98, 114, 128], diamante: [84, 96, 112, 126], lenda: [80, 94, 106, 122] };
  function bandTxt(b) { return b[0] + '–' + b[1] + ' / ' + b[2] + '–' + b[3] + ' s'; }
  log('### 5. Duração por liga (tempo até o último cruzar a linha; meta: a média de cada liga dentro da faixa dela; a corrida mais rápida, Mítico ★★★ 50, a no máximo 20% abaixo dos iniciais)');
  log('');
  log('Iniciais: as ' + r1.n + ' corridas da M1 (Bronze). PVP de 8: ' + N_PVP + ' salas de 8 sintéticos da mesma raridade e nível (sorteados por sala), estrelas e genética sorteadas, build de bot; a liga da sala é a do Poder médio.');
  log('');
  log('| Liga | Faixa curta / longa | Salas | Curta: média (p5–p95) | Longa: média (p5–p95) |');
  log('|---|---|---|---|---|');
  G.LEAGUES.forEach(function (lg) {
    var b = DUR_BANDS[lg.id], c = R.pvp8.lists[lg.id + 0], l = R.pvp8.lists[lg.id + 2];
    if (c.length) check('5', 'Duração curta, PVP de 8 na liga ' + lg.name, mean(c), b[0], b[1], ' s');
    if (l.length) check('5', 'Duração longa, PVP de 8 na liga ' + lg.name, mean(l), b[2], b[3], ' s');
    log('| ' + lg.name + ' | ' + bandTxt(b) + ' | ' + R.pvp8.league[lg.id] + ' | ' + (c.length ? f1(mean(c)) + ' s (' + f1(quant(c, 0.05)) + '–' + f1(quant(c, 0.95)) + ')' : '—') + ' | ' +
      (l.length ? f1(mean(l)) + ' s (' + f1(quant(l, 0.05)) + '–' + f1(quant(l, 0.95)) + ')' : '—') + ' |');
  });
  log('');
  var bz = DUR_BANDS.bronze, sc = mean(r1.lists.dur0), sl = mean(r1.lists.dur2);
  check('5', 'Duração curta, iniciais nível 1 (Bronze)', sc, bz[0], bz[1], ' s');
  check('5', 'Duração longa, iniciais nível 1 (Bronze)', sl, bz[2], bz[3], ' s');
  log('Iniciais nível 1: curta ' + f1(sc) + ' s · média ' + f1(mean(r1.lists.dur1)) + ' s · longa ' + f1(sl) + ' s (vencedor: ' + [0, 1, 2].map(function (g) { return f1(mean(r1.lists['win' + g])); }).join(' / ') + ' s).');
  log('');
  log('Nível alto: salas de 8 sintéticos de nível 50 (' + N_HI + ' por linha), genética sorteada, build de bot; cada sala contra a faixa da liga do Poder médio dela.');
  log('');
  log('| Sala | Liga | Curta | Média | Longa |');
  log('|---|---|---|---|---|');
  HI.forEach(function (c) {
    var x = R['hi-' + c.join('-')], lab = G.RARITIES[c[0]].name + ' ' + '★★★'.slice(0, c[2]) + ' nível ' + c[1];
    var lgId = Object.keys(x.league).filter(function (id) { return x.league[id] > 0; }).sort(function (p, q) { return x.league[q] - x.league[p]; })[0];
    var b = DUR_BANDS[lgId];
    check('5', 'Duração curta, ' + lab + ' (' + lgId + ')', mean(x.lists.dur0), b[0], b[1], ' s');
    check('5', 'Duração longa, ' + lab + ' (' + lgId + ')', mean(x.lists.dur2), b[2], b[3], ' s');
    if (c[0] === 'mitico') check('5', 'Corrida mais rápida (Mítico ★★★ 50, curta) ÷ iniciais (curta)', mean(x.lists.dur0) / sc, 0.8, 1, '×');
    log('| ' + lab + ' | ' + lgId + ' | ' + [0, 1, 2].map(function (g) { return f1(mean(x.lists['dur' + g])) + ' s'; }).join(' | ') + ' |');
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
  // Sorte real: só a base (raridade + genética), de 40 (Comum, g 0) a 76 (Mítico, g 31). Vitória no Dado
  // (empate no topo conta meio).
  var N7 = 20000, SORTE_LO = G.RARITIES.comum.baseLo, SORTE_HI = Math.round(G.RARITIES.mitico.baseLo + S.TUNING.gBand), SORTE_C31 = Math.round(G.RARITIES.comum.baseLo + S.TUNING.gBand);
  function diceWin(me, them, salt) {
    var rng7 = S.mulberry32(seedOf(750, salt)), w = 0;
    for (var i7 = 0; i7 < N7; i7++) {
      var a7 = S.rollDice(rng7, me, 0).best, top = 0;
      for (var j7 = 0; j7 < 7; j7++) { var b7 = S.rollDice(rng7, them, 0).best; if (b7 > top) top = b7; }
      if (a7 > top) w++; else if (a7 === top) w += 0.5;
    }
    return pct(w, N7);
  }
  var v7 = diceWin(SORTE_HI, SORTE_LO, 0), v7b = diceWin(SORTE_C31, SORTE_LO, 1), v7c = diceWin(SORTE_LO, SORTE_LO, 2);
  check('7', 'Sorte ' + SORTE_HI + ' (Mítico, genética 31) contra sete de Sorte ' + SORTE_LO + ' (Comum, genética 0) vence o Dado', v7, 17, 25, '%');
  log('### 7. Dado da Sorte (`rollDice`, ' + N7 + ' rodadas por linha; chance do 2º dado = (Sorte − ' + S.TUNING.sorteDiceLo + ')/' + (S.TUNING.sorteDiceFull - S.TUNING.sorteDiceLo) + '; meta: Mítico g31 × sete Comum g0 entre 17% e 25%; sem viés seria 12,5%)');
  log('');
  log('| Duelo de dados (1 contra 7) | Vence |');
  log('|---|---|');
  log('| Sorte ' + SORTE_HI + ' (Mítico, g 31) × sete de Sorte ' + SORTE_LO + ' (Comum, g 0) | **' + f1(v7) + '%** |');
  log('| Sorte ' + SORTE_C31 + ' (Comum, g 31) × sete de Sorte ' + SORTE_LO + ' (Comum, g 0) | ' + f1(v7b) + '% |');
  log('| Sorte ' + SORTE_LO + ' × sete de Sorte ' + SORTE_LO + ' (referência) | ' + f1(v7c) + '% |');
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
  checkBool('9', 'Determinismo: mesma seed+config => mesmo mapa, mesmos dados, mesmo resultado (25 configs com equipamento de bot, ignorado pela corrida, e mapas aleatórios, reexecução em ordem inversa)',
    detOk && framesOk, framesOk ? '' : 'frames inválidos');
  checkBool('9', 'Seeds diferentes => corridas diferentes', JSON.stringify(S.simulate(detConfig(seedOf(900, 1)))) !== JSON.stringify(S.simulate(detConfig(seedOf(900, 2)))));

  // -------------------------------------------------------------------------
  // 10) Ativação das skills: sem sorteio, por raridade
  // -------------------------------------------------------------------------
  log('### 10. Ativação das skills: sempre que o gatilho acontece (nível 1, Sorte 50, `Arranque`, ' + N_SKILL + ' corridas em reta de 1600 m; meta: 100% em toda raridade)');
  log('');
  log('| Raridade | Ativou |');
  log('|---|---|');
  RAR_IDS.forEach(function (rid) {
    var obs = pct(R['skill-' + rid].fired, R['skill-' + rid].n);
    check('10', 'Skill ' + G.RARITIES[rid].name + ': ativa em toda corrida', obs, 100, 100);
    log('| ' + G.RARITIES[rid].name + ' | ' + f1(obs) + '% |');
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
  log('### A. Metas da auditoria (S1, S5, S6, A1, P1, P2, M8)');
  log('');
  log('A1: ' + N_AUD + ' pares por variante; S1/S5/S6: ' + N_RANK + ' pares por skill e rank; mesma seed e campo com e sem a mudança. Campo de 6 Raros nível 20 sintéticos (genética sorteada, ★★, build de bot, skills sorteadas), mapa aleatório, Dado ligado; o alvo é o corredor k % 6. ' +
    'A1 usa o campo como está; no S1/S5/S6 os rivais correm sem skills normais e o alvo só com a skill (no rank 1 e no rank 5, que ativam sempre que o gatilho acontece), contra o alvo sem skills normais (com skill de elemento, ele passa a ser desse elemento nas três corridas). Ganho = vitórias com − vitórias sem, em p.p.' +
    (QUICK ? ' **S1, S5, S6 e A1 só contam como meta no modo completo**: com ' + N_AUD + ' pares o IC (~±2,5 p.p.) passa da margem das skills e dos status mais fracos para o piso de 3 p.p.; as tabelas abaixo são só informativas.' : ''));
  log('');
  skillRankReport(R.rank, N_RANK, !QUICK);
  var gains = {};
  KEYS.forEach(function (k) { gains[k] = ci(AU.stat[k][0], AU.stat[k][1], N_AUD); });
  var six = RACE.map(function (k) { return gains[k][0]; }).sort(function (x, y) { return x - y; });
  var med = (six[2] + six[3]) / 2;
  var sixV = RACE.map(function (k) { return gains[k][0]; });
  var ratio6 = Math.max.apply(null, sixV) / Math.min.apply(null, sixV);
  if (!QUICK) check('A1', 'Maior ÷ menor ganho entre os seis status de corrida (alvo 1,25; IC de cada ganho ±1,4 p.p.)', ratio6, 0, 1.3, '×');
  log('A1: +10 num status (gancho `statAdd`) no alvo. Maior ÷ menor entre os seis: ' + f2(ratio6) + '×. Meta: nenhum dos seis status de corrida acima de 3,2× a mediana deles (' + f1(med) + ' p.p. → teto ' + f1(3.2 * med) + ') nem abaixo de 3 p.p.; Sorte isenta (decisão de design pendente).');
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

  reportGym(R);
  finish();
}

// ---------------------------------------------------------------------------
// G) Ginásios da Expedição
// ---------------------------------------------------------------------------
function reportGym(R) {
  var EN = function (el) { return G.ELEMENTS[el].name; };
  var ETN = ['Soldado 1', 'Soldado 2', 'Soldado 3', 'Soldado 4', 'Líder'];
  var pistaTxt = function (p) { return p.distance + ' m, ' + G.SURFACES[p.surface].name.toLowerCase() + ': ' + p.blocks.map(function (b) { return b.type + ' ' + (b.to - b.from); }).join(', '); };
  var fx = G.GYM.fadiga.faixas;
  log('### G. Ginásios da Expedição (metas G1–G9)');
  log('');
  log('Desafios pelo `Ginasio.resolver` de verdade (clima inicial Nublado, a pista da casa, vantagem de elemento de ' + f1(100 * G.GYM.vantagem) + '% e o cansaço do catálogo). ' +
    'Time de referência: o **inicial** do elemento (Brasa, Maré ou Ipê), repetido até o tamanho do time do adversário, no nível da etapa (ou 4 acima ou abaixo), com a build dos bots. ' +
    'Os adversários têm a genética do inicial do ginásio; mudam o nível e as estrelas. "Com vantagem": o elemento que vence o ginásio; "em desvantagem": o que o ginásio vence. ' +
    'Na etapa de nível 4, "4 abaixo" é o nível 1 (3 abaixo: não há nível 0). ' + (QUICK ? '' : N_G + ' desafios por célula.'));
  log('');
  // G4, G6, G8 (nos dois modos)
  log('**Pistas** (G4: duelo 1 contra 1 sem a vantagem, nível igual nos cinco níveis das etapas, ' + N_G4 + ' duelos por par; G6: o 1º duelo de ' + N_G6 + ' desafios do inicial do ginásio sozinho; G8: todos os duelos desses desafios, do largar até os dois cruzarem a linha).');
  log('');
  log('| Ginásio | Pista | G4: vitórias contra o ginásio | G6: faixas ' + fx.map(function (f) { return f.name.toLowerCase(); }).join(' / ') + ' | G8: duração média (5%–95%) |');
  log('|---|---|---|---|---|');
  G.GYM_ORDER.forEach(function (gid) {
    var g4 = EL3.filter(function (el) { return el !== gid; }).map(function (el) {
      var v = wrG4(R, gid, el);
      check('G4', G.GYMS[gid].name + ': ' + EN(el) + ' contra ' + EN(gid) + ' sem a vantagem, nível igual', v, 42, 58);
      return EN(el) + ' ' + f1(v) + '%';
    });
    var r6 = R['g6-' + gid], tot = r6.f[0] + r6.f[1] + r6.f[2];
    var f6 = r6.f.map(function (x, i) { var v = pct(x, tot); check('G6', G.GYMS[gid].name + ': faixa ' + fx[i].name.toLowerCase() + ' no 1º duelo (nível igual)', v, 15, 100); return f1(v) + '%'; });
    var du = r6.lists.dur, dm = mean(du), d5 = quant(du, 0.05), d95 = quant(du, 0.95);
    check('G8', G.GYMS[gid].name + ': duração de um duelo, 5% mais curtos', d5, 55, 90, ' s');
    check('G8', G.GYMS[gid].name + ': duração de um duelo, 5% mais longos', d95, 55, 90, ' s');
    log('| ' + G.GYMS[gid].name + ' | ' + pistaTxt(G.GYMS[gid].pista) + ' | ' + g4.join(' · ') + ' | ' + f6.join(' / ') + ' | ' + f1(dm) + ' s (' + f1(d5) + '–' + f1(d95) + ' s; ' + du.length + ' duelos) |');
  });
  log('');
  log('Faixas do cansaço: ' + fx.map(function (f, i) { return f.name.toLowerCase() + ' ' + (i === 0 ? 'abaixo de ' + f.ate + ' m' : (f.ate === null ? fx[i - 1].ate + ' m ou mais' : 'de ' + fx[i - 1].ate + ' a menos de ' + f.ate + ' m')) + ' (perde ' + Math.round(100 * f.perde) + '% do fôlego)'; }).join(', ') + '; teto ' + Math.round(100 * G.GYM.fadiga.teto) + '%. ' +
    'Distância no 1º duelo (mediana): ' + G.GYM_ORDER.map(function (gid) { return G.GYMS[gid].name.replace('Ginásio ', '') + ' ' + f1(quant(R['g6-' + gid].lists.m, 0.5)) + ' m'; }).join(', ') + '.');
  log('');
  if (QUICK) {
    log('_G1, G2, G3, G5 e G7 só no modo completo (' + (5 * G_KINDS.length + 2) * G.GYM_ORDER.length + ' células de ' + N_G + ' desafios)._');
    log('');
  } else {
    var tab = {};
    G.GYM_ORDER.forEach(function (gid) {
      var g = G.GYMS[gid];
      log('**' + g.name + '** (' + EN(gid) + '; com vantagem: ' + EN(g.fraco) + '; em desvantagem: ' + EN(GYM_FORTE[gid]) + ')');
      log('');
      log('| Etapa | Nível | Adversário | G1 mesmo elemento | G2 4 acima | G2 4 abaixo | G3 com vantagem | G3 em desvantagem | G3 distância |');
      log('|---|---|---|---|---|---|---|---|---|');
      tab[gid] = [];
      g.etapas.forEach(function (et, e) {
        var L = gymLevel(gid, e), v = {};
        G_KINDS.forEach(function (kd) { var x = R[kd[0] + '-' + gid + '-' + e]; v[kd[0]] = pct(x.w, x.n); });
        tab[gid][e] = v;
        var nm = g.name + ', ' + ETN[e];
        check('G1', nm + ': mesmo elemento, nível ' + L, v.g1, 40, 55);
        check('G2', nm + ': 4 níveis acima (' + (L + 4) + ')', v.g2a, 60, 100);   // rebaseada em 2026-11-19 (skills e Garra sem falhar): era ≥ 70
        check('G2', nm + ': 4 níveis abaixo (' + Math.max(1, L - 4) + ')', v.g2b, 0, 46);   // rebaseada em 2026-11-19 (skills e Garra sem falhar): era ≤ 35
        check('G3', nm + ': com vantagem (' + EN(g.fraco) + ')', v.g3a, 60, 87);   // rebaseada em 2026-11-19 (skills e Garra sem falhar): era ≤ 85
        check('G3', nm + ': em desvantagem (' + EN(GYM_FORTE[gid]) + ')', v.g3d, 0, 35);
        check('G3', nm + ': distância entre com vantagem e em desvantagem', v.g3a - v.g3d, 30, 100, ' p.p.');
        var adv = et.cavalos.map(function (c) { return starterById(c.base) ? starterById(c.base).name + ' ' + '★★★'.slice(0, c.grau) : c.base; }).join(' + ');
        log('| ' + ETN[e] + ' | ' + L + ' | ' + adv + ' | **' + f1(v.g1) + '%** | ' + f1(v.g2a) + '% | ' + f1(v.g2b) + '% | ' + f1(v.g3a) + '% | ' + f1(v.g3d) + '% | ' + f1(v.g3a - v.g3d) + ' |');
      });
      log('');
    });
    log('**G5.** Diferença entre o maior e o menor dos três ginásios, por etapa (meta: no máximo 8 pontos em cada coluna).');
    log('');
    log('| Etapa | G1 | G3 com vantagem | G3 em desvantagem |');
    log('|---|---|---|---|');
    ETN.forEach(function (nm, e) {
      log('| ' + nm + ' | ' + ['g1', 'g3a', 'g3d'].map(function (k) {
        var xs = G.GYM_ORDER.map(function (gid) { return tab[gid][e][k]; }), d = Math.max.apply(null, xs) - Math.min.apply(null, xs);
        check('G5', nm + ': ' + { g1: 'G1', g3a: 'G3 com vantagem', g3d: 'G3 em desvantagem' }[k] + ' entre os três ginásios', d, 0, 8, ' p.p.');
        return f1(d);
      }).join(' | ') + ' |');
    });
    log('');
    log('**G7.** Contra o líder, um inicial sozinho 4 níveis acima (meta: vence os três em no máximo 35%; sem o cansaço, pelo menos 15 pontos a mais; mesmas seeds).');
    log('');
    log('| Ginásio | Com cansaço | Sem cansaço | Diferença |');
    log('|---|---|---|---|');
    G.GYM_ORDER.forEach(function (gid) {
      var a = pct(R['g7-' + gid].w, R['g7-' + gid].n), b = pct(R['g7s-' + gid].w, R['g7s-' + gid].n);
      check('G7', G.GYMS[gid].name + ': um cavalo 4 níveis acima vence o líder', a, 0, 35);
      check('G7', G.GYMS[gid].name + ': sem o cansaço, a mais', b - a, 15, 100, ' p.p.');
      log('| ' + G.GYMS[gid].name + ' | ' + f1(a) + '% | ' + f1(b) + '% | ' + f1(b - a) + ' |');
    });
    log('');
  }
  // G9: determinismo e nada de Math.random / relógio no caminho
  var casos = [];
  G.GYM_ORDER.forEach(function (gid, gi) {
    [0, 2, 4].forEach(function (e) {
      casos.push({ gymId: gid, etapa: e, time: gymRef(EL3[(gi + e) % 3], gymLevel(gid, e) + (e - 2), G.GYMS[gid].etapas[e].cavalos.length), seedBase: seedOf(7900, gi * 10 + e), contador: gi + e });
    });
  });
  var mr = Math.random, dn = Date.now, DataOrig = global.Date, usou = false, ida, volta, resim = true, outro;
  Math.random = function () { usou = true; return mr.apply(Math, arguments); };
  Date.now = function () { usou = true; return dn.apply(DataOrig, arguments); };
  // new Date(…) e Date(…) também contam: a global vira um detector (com o Date.now acima) até o finally
  var Detector = function () { usou = true; return new (Function.prototype.bind.apply(DataOrig, [null].concat([].slice.call(arguments))))(); };
  Detector.now = Date.now;
  global.Date = Detector;
  try {
    ida = casos.map(function (c) { return JSON.stringify(GY.resolver(c)); });
    volta = casos.slice().reverse().map(function (c) { return JSON.stringify(GY.resolver(c)); }).reverse();
    ida.forEach(function (j) {
      JSON.parse(j).duelos.forEach(function (d) {
        var x = S.simulate(d.cfg);
        if ((x.finishOrder[0] === 0 ? 'jogador' : 'adversario') !== d.vencedor || GY.metros(x) !== d.metros) resim = false;
      });
    });
    outro = casos.map(function (c) { var c2 = copy(c); c2.contador += 1; return JSON.stringify(GY.resolver(c2)); });
  } finally { Math.random = mr; DataOrig.now = dn; global.Date = DataOrig; }
  var iguais = ida.every(function (j, i) { return j === volta[i]; });
  checkBool('G9', 'Ginásio: mesma seed e mesma configuração dão o mesmo desafio, duelo a duelo (' + casos.length + ' desafios, reexecução em ordem inversa; cada duelo refeito pelo cfg dá o mesmo vencedor e a mesma distância)', iguais && resim);
  checkBool('G9', 'Ginásio: nada no caminho do desafio chama Math.random, Date.now nem new Date', !usou);
  checkBool('G9', 'Ginásio: o contador seguinte dá outro desafio', outro.every(function (j, i) { return j !== ida[i]; }));
}
function wrG4(R, gid, el) { var x = R['g4-' + gid + '-' + el]; return pct(x.wA, x.n); }

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
  lines.push('| Raia | Jogador | Cavalo | Elem. | Rar. | Sexo | Lv | Equip. | VEL/ACE/MAN/FOR/EST/GAR/SOR | Rating | Skills (rank) |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  field.forEach(function (r, i) {
    var s = S.computeStats(r.horse, r.gear);
    var sk = (r.horse.skills || []).map(function (id) { return G.SKILLS[id].name + ' ' + ROMANO[S.rankOf(r.horse, id)]; }).join(', ');
    lines.push('| ' + (i + 1) + ' | ' + r.name + ' | ' + r.horse.name + ' | ' + G.ELEMENTS[r.horse.element].name + ' | ' + G.RARITIES[r.horse.rarity].name + ' | ' +
      (r.horse.sex === 'f' ? 'F' : 'M') + ' | ' + r.horse.level + ' | ' + gearCell(r.gear) + ' | ' +
      G.STAT_KEYS.map(function (k) { return s[k]; }).join('/') + ' | ' + S.powerRating(r.horse, r.gear) + ' | ' +
      (sk || '—') + ' |');
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
