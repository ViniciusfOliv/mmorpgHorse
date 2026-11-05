/*
 * MMORPG Horse — simulação de corrida (protótipo descartável).
 *
 * RaceSim.simulate(config) é uma FUNÇÃO PURA e DETERMINÍSTICA de (config, seed):
 * sem Math.random, sem Date. O servidor simularia; o cliente só anima os frames.
 *
 * ============================== MODELO ======================================
 * Passo fixo dt = 0.1 s. RNG: mulberry32. Cada corredor tem seu próprio fluxo
 * de RNG derivado de (seed, índice), então o resultado não depende de ordem.
 *
 * Status efetivos (computeStats): base + potencial*0.1 + (level-1)*crescimento,
 *   crescimento = (0.45 + 0.6*pot/31) * raridade.growth, limitado a raridade.statCap;
 *   depois soma bônus de elemento (+8 no status do elemento) e mods do item.
 *   n(x) = status/100 (pode passar de 1 com item).
 *
 * Por corredor:
 *   vMax   = (vBase + vRange*n(vel)) * formaDoDia * afinidade      [m/s, ~15–19]
 *   accel  = aBase + aRange*n(acel)                                 [m/s²]
 *   tanque = poolBase + poolEst*n(est)    (estamina normalizada 0..1)
 *   formaDoDia: ruído por corredor, triangular ±formRange (o "dia" do cavalo).
 *   largada: atraso de reação 0..startDelayMax s (menor com Aceleração).
 *
 * Ritmo (fração s da vMax), por tática e fase (p = posição/distância):
 *   ponteiro:    s alto no início (sem economizar), depois cruzeiro, sprint curto no fim.
 *   perseguidor: ritmo constante, sprint a partir de ~70%. Ganha vácuo.
 *   arrancador:  economiza (margem de reserva) e explode nos últimos 25% (s até >1).
 *   "Jóquei": fora da largada do ponteiro, s é limitado ao ritmo constante que o
 *   tanque restante consegue sustentar até o fim (forma fechada, ver affordablePace).
 *   Sem estamina (=0) => s = exhaustPace (75%) até o fim + evento 'cansou'.
 *
 * Gasto de estamina por segundo = drainK * (v / vTetoBoosts)^drainExp * mods / tanque.
 *   mods: superfície, sol (+), subida (+, aliviado por Força), vácuo (−), habilidades.
 *   Boosts de Garra e de habilidades elevam o teto sem custo extra ("coração").
 *
 * Modificadores de velocidade-alvo:
 *   superfície (terra/areia mais lentas), subida, pelotão (vizinhos a <2,5 m)
 *   — os três aliviados por Força; chuva deixa todos ~1,5% mais lentos;
 *   habilidades ativas (speedMult) e Garra.
 *   Afinidade de elemento multiplica vMax (cada regra ±affinityStep, limitado).
 *
 * Garra: ao cruzar 80% da pista, rola chance = garraChanceBase + garraChanceRange*n(garra)
 *   (+bônus de item). Se passar: teto de velocidade x(1 + garraBoostBase + garraBoostRange*n(garra))
 *   até o fim. Evento 'garra'.
 *
 * Eventos: 'skill', 'garra', 'cansou', 'ultrapassagem' (só troca de líder confirmada
 *   por leadConfirmS, com intervalo mínimo, depois de 12% da pista), 'chegada'.
 *
 * Frames: um por tick, inclusive t=0. pos é limitado a `distance` depois da
 *   chegada (pos === distance => chegou); a velocidade de quem chegou cai até 0
 *   em ~2 s (para a animação desacelerar). Simula até TODOS chegarem.
 * ============================================================================
 *
 * UMD: no browser vira window.RaceSim (precisa de window.GameData antes);
 * no Node, module.exports (faz require('./data.js')).
 */
(function (root) {
  'use strict';

  var GameData = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.GameData;
  if (!GameData) throw new Error('RaceSim: GameData não encontrado (carregue data.js antes de sim.js).');

  var STAT_KEYS = ['vel', 'acel', 'est', 'forca', 'garra'];

  // Constantes de balanceamento (ajustadas por tools/balance.js). Exposto como RaceSim.TUNING.
  var T = {
    dt: 0.1,
    // crescimento por level
    growthBase: 0.50, growthPot: 0.65, potFlat: 0.1,
    // velocidade / aceleração
    vBase: 15.4, vRange: 3.2,
    aBase: 2.0, aRange: 1.0,
    decel: 1.2,
    // estamina
    poolBase: 60, poolEst: 30,
    drainK: 1.0, drainExp: 4, drainDistExp: 0.8, drainRefDist: 1600,
    rationReserve: 0.03,
    jockeyErrMin: -0.02, jockeyErrMax: 0.06,   // otimismo do jóquei ao ler o tanque (às vezes cansa no fim)
    exhaustPace: 0.75,
    minPace: 0.80,
    // ruído
    formRange: 0.10,
    tickJitter: 0.006,
    startDelayMax: 0.6,
    // terreno / pelotão
    hillSlow: 0.12, hillDrain: 0.30, forcaHillRelief: 0.5,
    forcaSurfRelief: 0.7,
    crowdRange: 2.5, crowdSlow: 0.03, forcaCrowdRelief: 0.8,
    draftMin: 0.5, draftRange: 4.0, draftSave: 0.10,
    rainSlow: 0.015, sunDrain: 1.04,
    // afinidade de elemento
    affinityStep: 0.05, affinityMin: 0.90, affinityMax: 1.10,
    // garra
    garraZone: 0.8,
    garraChanceBase: 0.20, garraChanceRange: 0.60, garraChanceMax: 0.95,
    garraBoostBase: 0.04, garraBoostRange: 0.07,
    // táticas (fração s da vMax)
    tactics: {
      ponteiro:    { earlyEnd: 0.35, early: 1.00, earlyMargin: 99,   mid: 0.96, spurtStart: 0.78, spurtCap: 1.00, margin: 1.00, kick: 1.00, garraBonus: 0.00, draft: false },
      perseguidor: { earlyEnd: 0.30, early: 0.96, earlyMargin: 1.00, mid: 0.96, spurtStart: 0.70, spurtCap: 1.02, margin: 1.00, kick: 1.00, garraBonus: 0.00, draft: true },
      arrancador:  { earlyEnd: 0.30, early: 0.94, earlyMargin: 0.97, mid: 0.95, spurtStart: 0.72, spurtCap: 1.05, margin: 0.97, kick: 1.03, garraBonus: 0.10, draft: true }
    },
    // eventos
    leadMinP: 0.12, leadConfirmS: 1.5, leadMinGapS: 4.0,
    maxTime: 900
  };

  // ---------------------------------------------------------------------------
  // RNG
  // ---------------------------------------------------------------------------
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Mistura dois inteiros num seed de 32 bits.
  function hash2(a, b) {
    var h = (Math.imul((a >>> 0) ^ 0x85EBCA6B, 0x9E3779B1) + Math.imul((b >>> 0) + 0x27D4EB2F, 0xC2B2AE35)) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x7FEB352D) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x846CA68B) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function fmtTime(s) { return s.toFixed(2).replace('.', ',') + 's'; }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------
  function computeStats(horse, itemId) {
    var rar = GameData.RARITIES[horse.rarity] || GameData.RARITIES.comum;
    var lvl = clamp(Math.floor(horse.level || 1), 1, GameData.ECONOMY.maxLevel || 50);
    var el = GameData.ELEMENTS[horse.element];
    var item = itemId ? GameData.ITEMS[itemId] : null;
    var out = {};
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var k = STAT_KEYS[i];
      var base = (horse.base && horse.base[k]) || 1;
      var pot = clamp((horse.potential && horse.potential[k]) || 0, 0, 31);
      var growth = (T.growthBase + T.growthPot * pot / 31) * (rar.growth || 1);
      var v = base + pot * T.potFlat + (lvl - 1) * growth;
      v = Math.min(v, rar.statCap);
      if (el && el.statBonus && el.statBonus.stat === k) v += el.statBonus.amount;
      if (item && item.mods && item.mods[k]) v += item.mods[k];
      out[k] = clamp(Math.round(v), 1, 120);
    }
    return out;
  }

  // Rating de Poder: soma ponderada dos status efetivos + habilidades.
  function powerRating(horse, itemId) {
    var s = computeStats(horse, itemId);
    var nSkills = (horse.skills || []).length;
    return Math.round(s.vel * 2.4 + s.acel * 2.0 + s.est * 2.0 + s.forca * 1.8 + s.garra * 1.8 + nSkills * 20);
  }

  function leagueFor(rating) {
    var L = GameData.LEAGUES, pick = L[0];
    for (var i = 0; i < L.length; i++) if (rating >= L[i].min) pick = L[i];
    var idx = L.indexOf(pick);
    var next = L[idx + 1];
    return { id: pick.id, name: pick.name, min: pick.min, max: next ? next.min - 1 : null, color: pick.color };
  }

  // ---------------------------------------------------------------------------
  // Condições
  // ---------------------------------------------------------------------------
  var DIST_LIST = [1000, 1600, 2400];
  var SURF_LIST = ['grama', 'terra', 'areia'];
  var WEATHER_LIST = ['sol', 'chuva', 'nublado'];

  function randomConditions(seed) {
    var rng = mulberry32(hash2(seed, 0xC0FFEE));
    var distance = DIST_LIST[Math.floor(rng() * 3)];
    var surface = SURF_LIST[Math.floor(rng() * 3)];
    var weather = WEATHER_LIST[Math.floor(rng() * 3)];
    var hills = [];
    if (rng() < 1 / 3) {
      var count = (distance >= 1600 && rng() < 0.5) ? 2 : 1;
      var lo = 0.15 * distance, hi = 0.80 * distance;
      var slot = (hi - lo) / count;
      for (var i = 0; i < count; i++) {
        var len = Math.round((100 + rng() * 120) * (distance / 1600 * 0.5 + 0.5) / 10) * 10;
        len = Math.min(len, slot - 20);
        var start = lo + i * slot + rng() * (slot - len);
        start = Math.round(start / 10) * 10;
        hills.push([start, start + len]);
      }
    }
    return { distance: distance, surface: surface, weather: weather, hills: hills };
  }

  function normalizeConditions(c) {
    c = c || {};
    return {
      distance: c.distance || 1600,
      surface: GameData.SURFACES[c.surface] ? c.surface : 'grama',
      weather: GameData.WEATHERS[c.weather] ? c.weather : 'nublado',
      hills: (c.hills || []).map(function (h) { return [h[0], h[1]]; })
    };
  }

  function ruleMatches(rule, cond) {
    switch (rule.kind) {
      case 'weather': return cond.weather === rule.value;
      case 'surface': return cond.surface === rule.value;
      case 'distance': return cond.distance === rule.value;
      case 'hills': return (cond.hills && cond.hills.length > 0) === !!rule.value;
      default: return false;
    }
  }

  // opts.ignoreWeatherPenalty (item Capa Impermeável) é usado internamente pela simulação.
  function elementAffinity(element, conditions, opts) {
    var el = GameData.ELEMENTS[element];
    var cond = normalizeConditions(conditions);
    var sum = 0, reasons = [];
    if (el && el.affinity) {
      for (var i = 0; i < el.affinity.length; i++) {
        var rule = el.affinity[i];
        if (!ruleMatches(rule, cond)) continue;
        if (rule.sign < 0 && rule.kind === 'weather' && opts && opts.ignoreWeatherPenalty) {
          reasons.push(rule.text + ' (anulado pela Capa)');
          continue;
        }
        sum += rule.sign * T.affinityStep;
        var pct = Math.round(T.affinityStep * 100);
        reasons.push(rule.text + ' (' + (rule.sign > 0 ? '+' : '−') + pct + '%)');
      }
    }
    var mult = clamp(1 + sum, T.affinityMin, T.affinityMax);
    return { mult: Math.round(mult * 10000) / 10000, reasons: reasons };
  }

  // ---------------------------------------------------------------------------
  // Pagamentos
  // ---------------------------------------------------------------------------
  function payouts(entryFee, numRacers, finishOrder) {
    var E = GameData.ECONOMY;
    entryFee = Math.max(0, Math.floor(entryFee));
    var pot = entryFee * numRacers;
    var fee = Math.round(pot * E.houseFee);
    var dist = pot - fee;
    var order = finishOrder || [];
    var places = Math.min(E.payoutSplit.length, order.length, numRacers);
    var prizes = [];
    if (places <= 0) return { pot: pot, fee: pot, prizes: prizes };
    var split = E.payoutSplit.slice(0, places);
    var tot = 0, i;
    for (i = 0; i < split.length; i++) tot += split[i];
    var given = 0;
    for (i = 0; i < places; i++) {
      var amount = (i === places - 1) ? dist - given : Math.floor(dist * split[i] / tot);
      given += amount;
      prizes.push({ racer: order[i], place: i + 1, amount: amount });
    }
    return { pot: pot, fee: fee, prizes: prizes };
  }

  // ---------------------------------------------------------------------------
  // Simulação
  // ---------------------------------------------------------------------------
  function inHill(hills, pos) {
    for (var i = 0; i < hills.length; i++) if (pos >= hills[i][0] && pos < hills[i][1]) return true;
    return false;
  }

  function hillFraction(hills, from, to) {
    if (to <= from) return 0;
    var len = 0;
    for (var i = 0; i < hills.length; i++) {
      var a = Math.max(from, hills[i][0]), b = Math.min(to, hills[i][1]);
      if (b > a) len += b - a;
    }
    return len / (to - from);
  }

  // Maior ritmo constante s (fração de vMax) que o tanque restante sustenta até o fim.
  // gasto = rem/(s*v) * K * c * s^k / pool  =>  s = (avail*pool*v / (rem*K*c))^(1/(k-1))
  function affordablePace(avail, remaining, vRef, pool, cdrain) {
    if (avail <= 0) return 0;
    if (remaining <= 0) return 9;
    var x = avail * pool * vRef / (remaining * T.drainK * cdrain);
    return Math.pow(x, 1 / (T.drainExp - 1));
  }

  function buildRacer(entry, index, cond, rng) {
    var horse = entry.horse;
    var itemId = entry.itemId || null;
    var item = itemId ? GameData.ITEMS[itemId] : null;
    var special = (item && item.special) || {};
    var stats = computeStats(horse, itemId);
    var aff = elementAffinity(horse.element, cond, { ignoreWeatherPenalty: !!special.ignoreWeatherPenalty });
    // afinidade de elemento multiplica todos os status efetivos nesta corrida
    var am = aff.mult / 100;
    var nv = stats.vel * am, na = stats.acel * am, ne = stats.est * am, nf = stats.forca * am, ng = stats.garra * am;
    var form = 1 + (rng() + rng() - 1) * T.formRange;
    var tactic = T.tactics[entry.tactic] ? entry.tactic : 'perseguidor';
    var skills = (horse.skills || []).filter(function (id) { return !!GameData.SKILLS[id]; });
    return {
      index: index,
      name: entry.name || horse.name,
      horseName: horse.name,
      tactic: tactic,
      tac: T.tactics[tactic],
      stats: stats,
      nf: nf,
      vMax: (T.vBase + T.vRange * nv) * form,
      accel: T.aBase + T.aRange * na,
      pool: (T.poolBase + T.poolEst * ne) * (special.staminaPoolMult || 1),
      garraChance: clamp(T.garraChanceBase + T.garraChanceRange * ng + (special.garraChanceBonus || 0), 0, T.garraChanceMax),
      garraBoost: 1 + T.garraBoostBase + T.garraBoostRange * ng,
      startDelay: rng() * T.startDelayMax * (1 - 0.5 * clamp(na, 0, 1)),
      jockeyErr: T.jockeyErrMin + rng() * (T.jockeyErrMax - T.jockeyErrMin) + (T.tactics[tactic].jockeyBias || 0),
      rng: rng,
      skills: skills,
      fired: {},
      effects: [],
      pos: 0, v: 0, stamina: 1,
      exhausted: false, finished: false, finishTime: null,
      garraRolled: false, garraMult: 1,
      hillSeen: false
    };
  }

  function simulate(config) {
    config = config || {};
    var seed = (config.seed >>> 0);
    var cond = normalizeConditions(config.conditions || randomConditions(seed));
    var D = cond.distance;
    var entries = config.racers || [];
    var n = entries.length;
    var dt = T.dt;
    var record = config.recordFrames !== false;
    var surf = GameData.SURFACES[cond.surface];
    var weatherDrain = cond.weather === 'sol' ? T.sunDrain : 1;
    var weatherSlow = cond.weather === 'chuva' ? (1 - T.rainSlow) : 1;
    var distDrain = Math.pow(T.drainRefDist / D, T.drainDistExp); // pistas longas gastam menos por segundo (mas duram mais)

    var R = [];
    for (var i = 0; i < n; i++) R.push(buildRacer(entries[i], i, cond, mulberry32(hash2(seed, i + 1))));

    var events = [];
    function ev(t, racer, type, text) { events.push({ t: r2(t), racer: racer, type: type, text: text }); }

    var frames = [];
    function pushFrame(t) {
      if (!record) return;
      var pos = new Array(n), speed = new Array(n), stam = new Array(n);
      for (var j = 0; j < n; j++) { pos[j] = r2(R[j].pos); speed[j] = r2(R[j].v); stam[j] = r3(R[j].stamina); }
      frames.push({ t: t, pos: pos, speed: speed, stamina: stam });
    }
    pushFrame(0);

    // Ativação de habilidade
    function fireSkill(r, id, t) {
      var sk = GameData.SKILLS[id];
      r.fired[id] = true;
      var e = sk.effect || {};
      if (e.staminaRestore && !r.exhausted) r.stamina = Math.min(1, r.stamina + e.staminaRestore);
      if (e.durationS) {
        r.effects.push({
          until: t + e.durationS,
          speedMult: e.speedMult || 1,
          accelMult: e.accelMult || 1,
          drainMult: e.staminaDrainMult || 1
        });
      }
      ev(t, r.index, 'skill', r.horseName + ' ativou ' + sk.name + '!');
    }

    function checkSkills(r, t, p, rank, nActive) {
      for (var s = 0; s < r.skills.length; s++) {
        var id = r.skills[s];
        if (r.fired[id]) continue;
        var trig = GameData.SKILLS[id].trigger;
        var ok = false;
        if (trig === 'start') ok = true;
        else if (trig === 'final') ok = p >= T.garraZone;
        else if (trig === 'midrace') ok = p >= 0.5;
        else if (trig === 'lowStamina') ok = r.stamina <= 0.25 && !r.exhausted;
        else if (trig === 'hill') ok = inHill(cond.hills, r.pos);
        else if (trig === 'behind') ok = p >= 0.6 && rank >= Math.ceil(nActive / 2);
        else if (trig.indexOf('weather:') === 0) ok = trig.slice(8) === cond.weather;
        else if (trig.indexOf('surface:') === 0) ok = trig.slice(8) === cond.surface;
        if (ok) fireSkill(r, id, t);
        else if (trig.indexOf('weather:') === 0 || trig.indexOf('surface:') === 0) r.fired[id] = true; // nunca vai disparar
      }
    }

    // Liderança
    var leader = -1, cand = -1, candSince = 0, lastLeadEvent = -1e9, leadInit = false;

    var finishedCount = 0;
    var step = 0;
    var prevPos = new Array(n);
    var order = [];
    for (i = 0; i < n; i++) order.push(i);

    while (finishedCount < n) {
      step++;
      var t = step / 10; // dt = 0.1 exato, sem acumular erro
      if (t > T.maxTime) break;
      var tPrev = (step - 1) / 10;

      for (i = 0; i < n; i++) prevPos[i] = R[i].pos;
      // ranking pelo snapshot (maior pos primeiro; empate: menor índice)
      order.sort(function (a, b) { return (prevPos[b] - prevPos[a]) || (a - b); });
      var rankOf = new Array(n);
      for (i = 0; i < n; i++) rankOf[order[i]] = i;
      var nActive = n;

      for (i = 0; i < n; i++) {
        var r = R[i];
        if (r.finished) {
          r.v = Math.max(0, r.v - 8 * dt);
          continue;
        }
        if (tPrev < r.startDelay) {
          // ainda reagindo ao sinal de largada
          if (!r.fired.__start) { r.fired.__start = true; checkSkills(r, tPrev, 0, rankOf[i], nActive); }
          continue;
        }
        var pos = prevPos[i];
        var p = pos / D;
        var rem = D - pos;
        checkSkills(r, tPrev, p, rankOf[i], nActive);

        // efeitos ativos
        var effSpeed = 1, effAccel = 1, effDrain = 1;
        for (var e = 0; e < r.effects.length; e++) {
          var fx = r.effects[e];
          if (tPrev < fx.until) { effSpeed *= fx.speedMult; effAccel *= fx.accelMult; effDrain *= fx.drainMult; }
        }

        // Garra
        if (!r.garraRolled && p >= T.garraZone) {
          r.garraRolled = true;
          if (r.rng() < Math.min(T.garraChanceMax, r.garraChance + r.tac.garraBonus)) {
            r.garraMult = r.garraBoost;
            ev(tPrev, i, 'garra', r.horseName + ' mostrou GARRA na reta final!');
          }
        }

        // terreno
        var nf = clamp(r.nf, 0, 1.2);
        var speedMod = weatherSlow;
        var drainMod = surf.drain * weatherDrain * distDrain * effDrain;
        speedMod *= 1 - surf.slow * (1 - T.forcaSurfRelief * nf);
        var onHill = inHill(cond.hills, pos);
        if (onHill) {
          speedMod *= 1 - T.hillSlow * (1 - T.forcaHillRelief * nf);
          drainMod *= 1 + T.hillDrain * (1 - 0.5 * nf);
        }
        // pelotão e vácuo
        var neighbors = 0, drafting = false;
        for (var j = 0; j < n; j++) {
          if (j === i || R[j].finished) continue;
          var gap = prevPos[j] - pos;
          if (Math.abs(gap) <= T.crowdRange) neighbors++;
          if (gap >= T.draftMin && gap <= T.draftRange) drafting = true;
        }
        if (neighbors > 0) {
          speedMod *= 1 - T.crowdSlow * Math.min(neighbors, 3) / 3 * (1 - T.forcaCrowdRelief * nf);
        }
        if (drafting && r.tac.draft) drainMod *= 1 - T.draftSave;

        // ritmo do jóquei
        var tac = r.tac;
        var s;
        if (r.exhausted) {
          s = T.exhaustPace;
        } else {
          var hf = hillFraction(cond.hills, pos, D);
          var cEst = surf.drain * weatherDrain * distDrain * (1 + hf * T.hillDrain * (1 - 0.5 * nf));
          var vRef = r.vMax * speedMod;
          var aff = affordablePace(r.stamina + r.jockeyErr - T.rationReserve, rem, vRef, r.pool, cEst);
          if (p < tac.earlyEnd) {
            s = Math.min(tac.early, aff * tac.earlyMargin);
          } else if (p < tac.spurtStart) {
            s = Math.min(tac.mid, aff * tac.margin);
          } else {
            s = Math.min(tac.spurtCap, aff);
          }
          s = Math.max(s, T.minPace);
        }

        var boost = effSpeed * r.garraMult * (p >= tac.spurtStart && !r.exhausted ? tac.kick : 1);
        var jitter = 1 + (r.rng() - 0.5) * T.tickJitter;
        var vTarget = s * r.vMax * speedMod * boost * jitter;

        if (r.v < vTarget) r.v = Math.min(vTarget, r.v + r.accel * effAccel * dt);
        else r.v = Math.max(vTarget, r.v - T.decel * dt);

        // gasto de estamina (boosts não custam)
        if (!r.exhausted) {
          var sEff = r.v / (r.vMax * boost);
          r.stamina -= T.drainK * Math.pow(sEff, T.drainExp) * drainMod * dt / r.pool;
          if (r.stamina <= 0) {
            r.stamina = 0;
            r.exhausted = true;
            if (rem > D * 0.02) ev(t, i, 'cansou', r.horseName + ' cansou e perdeu o ritmo!');
          }
        }

        var newPos = pos + r.v * dt;
        if (newPos >= D) {
          r.finishTime = tPrev + (r.v > 0 ? (D - pos) / r.v : dt);
          r.pos = D;
          r.finished = true;
          finishedCount++;
        } else {
          r.pos = newPos;
        }
      }

      // troca de liderança (antes do primeiro chegar)
      var L = 0;
      for (i = 1; i < n; i++) if (R[i].pos > R[L].pos) L = i;
      var anyFinished = false;
      for (i = 0; i < n; i++) if (R[i].finished && R[i].finishTime <= t) { anyFinished = true; break; }
      if (!anyFinished && n > 1) {
        if (!leadInit) {
          if (R[L].pos / D >= T.leadMinP) { leadInit = true; leader = L; cand = -1; }
        } else if (L === leader) {
          cand = -1;
        } else if (L !== cand) {
          cand = L; candSince = t;
        } else if (t - candSince >= T.leadConfirmS) {
          if (candSince - lastLeadEvent >= T.leadMinGapS) {
            ev(candSince, L, 'ultrapassagem', R[L].horseName + ' passou ' + R[leader].horseName + ' e assumiu a liderança!');
            lastLeadEvent = candSince;
          }
          leader = L; cand = -1;
        }
      }

      pushFrame(t);
    }

    // ordem de chegada
    var finishOrder = [];
    for (i = 0; i < n; i++) finishOrder.push(i);
    finishOrder.sort(function (a, b) {
      var fa = R[a].finishTime == null ? Infinity : R[a].finishTime;
      var fb = R[b].finishTime == null ? Infinity : R[b].finishTime;
      return (fa - fb) || (a - b);
    });
    var finishTimes = new Array(n);
    var duration = 0;
    for (i = 0; i < n; i++) {
      var ft = R[i].finishTime == null ? T.maxTime : R[i].finishTime;
      finishTimes[i] = r2(ft);
      if (ft > duration) duration = ft;
    }
    for (var k = 0; k < finishOrder.length; k++) {
      var ri = finishOrder[k];
      ev(R[ri].finishTime == null ? T.maxTime : R[ri].finishTime, ri, 'chegada',
        R[ri].horseName + ' cruzou a linha em ' + (k + 1) + 'º lugar! (' + fmtTime(finishTimes[ri]) + ')');
    }
    // ordena eventos por tempo (estável)
    var idx = events.map(function (e, q) { return q; });
    idx.sort(function (a, b) { return (events[a].t - events[b].t) || (a - b); });
    events = idx.map(function (q) { return events[q]; });

    return {
      seed: seed,
      conditions: cond,
      dt: dt,
      duration: r2(duration),
      frames: frames,
      events: events,
      finishOrder: finishOrder,
      finishTimes: finishTimes
    };
  }

  var RaceSim = {
    TUNING: T,
    STAT_KEYS: STAT_KEYS,
    mulberry32: mulberry32,
    hash2: hash2,
    computeStats: computeStats,
    powerRating: powerRating,
    leagueFor: leagueFor,
    randomConditions: randomConditions,
    elementAffinity: function (element, conditions) { return elementAffinity(element, conditions); },
    simulate: simulate,
    payouts: payouts
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RaceSim;
  else root.RaceSim = RaceSim;
})(typeof self !== 'undefined' ? self : this);
