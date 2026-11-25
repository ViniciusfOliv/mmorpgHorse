// Medição da fase 1 da frente "Salas justas + economia" (spec docs/superpowers/specs/2026-11-25-salas-economia-design.md).
// Carreira do cavalo inicial com o pareamento REAL do jogo: cópia do buildLobby de game.js (catálogo WILD_HORSES +
// STARTERS sem o modelo do jogador, levelBand, bestLevelFor, rank dos bots, filtro de 6%), simulação de verdade, prêmio
// pelo RaceSim.payouts, XP e skills aprendidas como o applyXp, falência -> treino gratuito, recompensa diária a cada
// SALAS_DIA salas. Só medição: não muda regra. Na fase 2 dá lugar ao `balance.js --economia`, sobre o código do jogo.
//   node prototype/tools/salas-medida.js <esquema> <carreiras> <salas> [início] [todos|brasa|fixo:<modelo>:<nível>:<rank>]
//   saída: JSON por número da sala (somas); o resumo é feito por salas-medida-resumo (ver a spec)
// Esquemas: hoje, justa, centrada, favor, antigo, A, B, C, D, E (ver ESQ abaixo).
function lerp(a, b, u) { return a + (b - a) * u; }
// transição: salas 1..e = estreia; e+1..e+t = mistura linear; depois normal
function comEstreia(est, nor, e, t) {
  return function (k) {
    if (k <= e) return est;
    var u = Math.min(1, (k - e) / (t + 1));
    if (u >= 1) return nor;
    return { nMin: Math.round(lerp(est.nMin, nor.nMin, u)), nMax: Math.round(lerp(est.nMax, nor.nMax, u)),
      lo: lerp(est.lo, nor.lo, u), hi: lerp(est.hi, nor.hi, u), teto: est.teto != null ? lerp(est.teto, 1.2, u) : null };
  };
}
var HOJE = { nMin: 4, nMax: 8, lo: 0.915, hi: 1.115, teto: null };
var ESQ = {
  hoje: { sala: function () { return HOJE; } },
  justa: { sala: function () { return { nMin: 4, nMax: 8, lo: 0.935, hi: 1.045, teto: null }; } },
  centrada: { sala: function () { return { nMin: 4, nMax: 8, lo: 0.95, hi: 1.05, teto: null }; } },
  // antigo: estreia 10 salas 4-5 corredores 94,5-101,5%, teto 1,015 (genética reduzida), volta em 10
  antigo: { sala: comEstreia({ nMin: 4, nMax: 5, lo: 0.945, hi: 1.015, teto: 1.015 }, HOJE, 10, 10) },
  // A: estreia leve + normal justa
  A: { sala: comEstreia({ nMin: 4, nMax: 5, lo: 0.92, hi: 1.00, teto: 1.0 }, { nMin: 4, nMax: 8, lo: 0.935, hi: 1.045, teto: null }, 10, 10) },
  B: { sala: comEstreia({ nMin: 4, nMax: 5, lo: 0.945, hi: 1.015, teto: 1.015 }, { nMin: 4, nMax: 8, lo: 0.95, hi: 1.05, teto: null }, 10, 10) },
  C: { sala: comEstreia({ nMin: 4, nMax: 6, lo: 0.93, hi: 1.01, teto: 1.01 }, { nMin: 4, nMax: 8, lo: 0.94, hi: 1.06, teto: null }, 15, 15) }
};
var J = { nMin: 4, nMax: 8, lo: 0.935, hi: 1.045, teto: null };
ESQ.favor = { sala: function () { return { nMin: 4, nMax: 8, lo: 0.92, hi: 1.02, teto: null }; } };
ESQ.D = { sala: comEstreia({ nMin: 4, nMax: 5, lo: 0.93, hi: 1.005, teto: 1.005 }, J, 10, 10) };
ESQ.E = { sala: comEstreia({ nMin: 4, nMax: 5, lo: 0.92, hi: 1.00, teto: 1.0 }, J, 5, 15) };
var path = require('path').join(__dirname, '../src/') ;
var GD = require(path + 'data.js'), RS = require(path + 'sim.js'), IT = require(path + 'itens.js');
var E = GD.ECONOMY;
var esqId = process.argv[2] || 'hoje', NC = +process.argv[3] || 200, NS = +process.argv[4] || 60, C0 = +process.argv[5] || 0;
var starterArg = process.argv[6] || 'todos';
var esq = ESQ[esqId];
function pick(arr, rng) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
function shuffle(arr, rng) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
var memo = {};
function poderBot(t, L, rank) { var k = t.id + '|' + L + '|' + rank; if (!(k in memo)) { var h = RS.withRanks(t, rank); h.level = L; h.alloc = RS.botAlloc(h); memo[k] = RS.powerRating(h); } return memo[k]; }
function bestLevelFor(t, target, lo, hi, rank) { var best = lo || 1, bd = Infinity; for (var L = (lo || 1); L <= (hi || 50); L++) { var d = Math.abs(poderBot(t, L, rank) - target); if (d < bd - 0.5) { bd = d; best = L; } } return { level: best, diff: bd }; }
function levelBand(t) { var L0 = t.level || 1; return [Math.max(1, L0 - 10), Math.min(50, L0 + 20)]; }

// esq.sala(counter) -> { nMin, nMax, lo, hi, gen (fator da genética do rival acima do alvo, ou null) }
function buildLobby(seedBase, counter, player, owned) {
  var seed = RS.hash2(seedBase, counter);
  var rng = RS.mulberry32(RS.hash2(seed, 0xA11CE));
  var cond = RS.randomConditions(seed); pick(['a'], rng);   // trackName consome 1
  var cfg = esq.sala(counter);
  var n = cfg.nMin + Math.floor(rng() * (cfg.nMax - cfg.nMin + 1));
  var pr = RS.powerRating(player);
  shuffle(GD.BOT_NAMES.slice(), rng);
  var pool = GD.WILD_HORSES.concat(GD.STARTERS).filter(function (t) { return !owned[t.id]; });
  var used = {};
  shuffle([0, 1, 2, 3, 4, 5, 6, 7], rng);   // silkOrder (BOT_SILKS tem 8? só consumo)
  var rankBots = RS.botRank(player), bots = [];
  for (var b = 0; b < n - 1; b++) {
    var target = pr * (cfg.lo + (cfg.hi - cfg.lo) * rng());
    rng();   // gpick
    var inBand = pool.map(function (t) { var bd = levelBand(t); return { tpl: t, fit: bestLevelFor(t, target, bd[0], bd[1], rankBots) }; })
      .filter(function (c) { return c.fit.diff <= target * 0.06; });
    var fresh = inBand.filter(function (c) { return !used[c.tpl.id]; });
    var cands = fresh.length ? fresh : inBand;
    if (!cands.length) {
      var all = pool.map(function (t) { return { tpl: t, fit: bestLevelFor(t, target, null, null, rankBots) }; });
      all.sort(function (x, y) { return x.fit.diff - y.fit.diff; }); cands = all.slice(0, 3);
    }
    var ch = pick(cands, rng); used[ch.tpl.id] = true;
    var h = RS.withRanks(ch.tpl, rankBots); h.level = ch.fit.level; h.alloc = RS.botAlloc(h);
    if (cfg.teto != null && RS.powerRating(h) > target * cfg.teto) {
      // rival acima do teto: perde pontos livres até o teto (como o RAPIDO), depois genética
      var cheio = h.alloc, lo = 0, hi = 1, alvo = target * cfg.teto;
      var comF = function (f) { var o = {}; Object.keys(cheio).forEach(function (k) { o[k] = Math.floor(cheio[k] * f); }); return o; };
      for (var it = 0; it < 12; it++) { var mid = (lo + hi) / 2; h.alloc = comF(mid); if (RS.powerRating(h) > alvo) hi = mid; else lo = mid; }
      h.alloc = comF(lo);
      var pot = h.potential = JSON.parse(JSON.stringify(h.potential));
      for (var d = 0; d < 32 && RS.powerRating(h) > alvo; d++) Object.keys(pot).forEach(function (k) { pot[k] = Math.max(0, pot[k] - 1); });
    }
    h.id = ch.tpl.id + '-b' + b;
    bots.push({ horse: h, gear: null, name: 'B' + b, isPlayer: false, pr: RS.powerRating(h) });
  }
  var me = { horse: player, gear: null, name: 'Você', isPlayer: true, pr: pr };
  var racers = shuffle([me].concat(bots), rng);
  return { seed: seed, cond: cond, n: n, racers: racers, playerIdx: racers.indexOf(me) };
}

var STARTERS = (starterArg === 'todos' || starterArg.indexOf('fixo:') === 0) ? GD.STARTERS : GD.STARTERS.filter(function (s) { return s.id === starterArg; });
var out = { esq: esqId, salas: [] };
for (var s = 0; s < NS; s++) out.salas.push({ n: 0, win: 0, pod: 0, net: 0, lv: 0, place: 0, perg: 0, field: 0, fav: 0 });
for (var c = C0; c < C0 + NC; c++) {
  var tpl = STARTERS[c % STARTERS.length];
  var seedBase = RS.hash2(0xC0FFEE, c);
  var FIX = starterArg.indexOf('fixo:') === 0 ? starterArg.split(':') : null;
  if (FIX) tpl = GD.WILD_HORSES.concat(GD.STARTERS).filter(function (t) { return t.id === FIX[1]; })[0];
  var m = { templateId: tpl.id, id: tpl.id, name: tpl.name, element: tpl.element, rarity: tpl.rarity, grau: tpl.grau || 2, sex: tpl.sex,
    level: 1, xp: 0, skills: tpl.skills.slice(), skillRanks: IT.sanearRanks(tpl.skills, tpl.skillRanks), potential: JSON.parse(JSON.stringify(tpl.potential)), torroes: 0 };
  var owned = {}; owned[tpl.id] = true;
  if (FIX) { m.level = +FIX[2]; m.skillRanks = {}; m.skills.forEach(function (id) { m.skillRanks[id] = +FIX[3]; }); if (FIX[4]) m.grau = +FIX[4]; }
  var fee = 50, gold = 500, SALAS_DIA = +(process.env.SALAS_DIA || 30), dia = 0;
  var TG = [30, 22, 16, 12, 10, 10, 10, 10];
  for (var k = 1; k <= NS; k++) {
    m.alloc = RS.botAlloc(m);   // "Distribuir sugerido" a cada sala
    var L = buildLobby(seedBase, FIX ? 1000 + k : k, m, owned);
    var res = RS.simulate({ seed: L.seed, conditions: L.cond, racers: L.racers.map(function (r) { return { horse: r.horse, gear: null, name: r.name, isPlayer: r.isPlayer }; }) });
    var place = res.finishOrder.indexOf(L.playerIdx) + 1;
    if (!FIX && (k - 1) % SALAS_DIA === 0) { var dd = GD.DAILY.dias[dia % 7]; gold += dd.ouro || 0; dia++; }
    var treino = !FIX && gold < fee;
    var pay = RS.payouts(fee, L.n, res.finishOrder);
    var mine = pay.prizes.filter(function (p) { return p.racer === L.playerIdx; })[0];
    var prize = mine ? mine.amount : 0;
    var o = out.salas[k - 1];
    if (treino) { prize = TG[place - 1]; gold += prize; } else gold += prize - fee;
    var bi = 0; L.racers.forEach(function (r, i) { if (r.pr > L.racers[bi].pr) bi = i; }); o.fav += res.finishOrder[0] === bi;
    o.treino = (o.treino || 0) + treino; o.gold = (o.gold || 0) + gold; o.zero = (o.zero || 0) + (gold < fee);
    o.n++; o.win += place === 1; o.pod += place <= 3; o.net += treino ? 0 : prize - fee; o.lv += m.level; o.place += place; o.field += L.n;
    o.perg += IT.pergaminhoPodio(L.seed, place);
    var placesPaid = (E.payoutSplitFor(L.n)).length; o.paid = (o.paid || 0) + (place <= placesPaid);
    if (FIX) continue;
    // XP e nível
    var xp = E.xpPerPlace[place - 1] || 10; if (treino) xp = Math.round(xp / 2);
    m.xp += xp;
    var lv0 = m.level;
    while (m.level < 50 && m.xp >= E.xpToLevel(m.level)) { m.xp -= E.xpToLevel(m.level); m.level++; }
    for (var q = lv0 + 1; q <= m.level; q++) {
      var lr = RS.mulberry32(RS.hash2(seedBase, k * 100 + q));
      var sid = RS.learnSkill({ id: m.templateId, element: m.element, rarity: m.rarity, skills: m.skills }, lr, 0);
      if (sid) { m.skills.push(sid); m.skillRanks = IT.sanearRanks(m.skills, m.skillRanks); }
    }
  }
}
process.stdout.write(JSON.stringify(out));
