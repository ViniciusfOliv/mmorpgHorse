/*
 * MMORPG Horse — simulação de corrida (protótipo descartável).
 *
 * RaceSim.simulate(config) é uma FUNÇÃO PURA e DETERMINÍSTICA de (config, seed):
 * sem Math.random, sem Date, sem estado global. O servidor simularia; o cliente só
 * anima os frames. No laço só há + - * / (raízes por Newton), então o resultado é
 * idêntico bit a bit em qualquer motor JS.
 *
 * ============================== MODELO ======================================
 * Passo fixo dt = 0.1 s. RNG mulberry32; cada corredor tem um fluxo próprio
 * derivado de hash(seed, índice). Constantes em RaceSim.TUNING (ajustadas com
 * tools/balance.js).
 *
 * STATUS EFETIVOS (computeStats)
 *   status = base + pot*0.1 + (level-1) * (0.50 + 0.65*pot/31) * raridade.growth
 *   limitado a raridade.statCap; depois + bônus do elemento (+8 no status dele) e
 *   + mods do item. Na corrida, a AFINIDADE do elemento multiplica todos os status
 *   (cada regra ±4% × peso da regra; total limitado a 0,92–1,08) e, quando favorável,
 *   22% dela vai direto na vMax (afinidade +8% => vMax +1,8%). Sem isso, um único fator
 *   favorável (ex.: só a chuva para Água) quase não mudava a chance de vitória.
 *
 * POR CORREDOR (n(x) = status/100)
 *   vMax  = (16.8 + 2.2*n(vel)) * formaDoDia * (1 + 0.22*max(0, afinidade-1))   ~16,8–19 m/s
 *   accel = 0.6 + 2.4*n(acel) m/s²   (largada e retomadas; Aceleração encurta a reação)
 *   tanque de estamina = 66 + 20*n(est)
 *   formaDoDia: ruído triangular ±10% por corredor (racerInfo.disposicao). É a maior
 *   fonte de zebra: sem ele um Comum nunca venceria um Lendário.
 *
 * ESTAMINA
 *   gasto/s = (v / tetoComBoosts)^4 * (1600/distância)^0.4 * mods / tanque
 *   mods: areia/terra, sol (+4%), subida (+30%, aliviada por Força), vácuo (−10%
 *   para perseguidor/arrancador a 0,5–4 m atrás de alguém), habilidades.
 *   Pistas longas apertam mais o tanque => Estamina pesa mais em 2400 m.
 *   Boosts de Garra, de habilidade e da tática elevam o teto SEM custo extra.
 *   Estamina 0 => ritmo cai para 75% até o fim + evento 'cansou'.
 *
 * RITMO (fração s de vMax), pelo "jóquei"
 *   aff = ritmo constante que o tanque restante sustenta até o fim (forma fechada,
 *   affordablePace); o jóquei lê o tanque com um erro de −2%..+6% (às vezes cansa).
 *   ponteiro:    até 30% corre a 1.00 SEM economizar (+3% grátis em curta, +1,5% em média),
 *                depois min(0.97, aff), sprint até 1.00. Forte em curta, murcha em longa.
 *   perseguidor: min(0.97, aff) até 72%, sprint até 1.03. Ganha vácuo. Estável.
 *   arrancador:  guarda 4% (min(0.93/0.95, aff*0.96)) até 70%, sprint até 1.06 com
 *                explosão grátis (+0% curta, +2,5% média, +5% longa) e +15% de chance
 *                de Garra. Fraco em curta, forte em longa.
 *   Ritmo mínimo voluntário 0.80.
 *
 * VELOCIDADE-ALVO = s * vMax * terreno * pelotão * chuva * boosts * jitter(±0,3%)
 *   terreno: terra −3%, areia −6%, subida −15% (Força alivia 70–80%);
 *   pelotão: até −3% com vizinhos a ≤2,5 m (Força alivia 80%); chuva −1,5% para todos.
 *   A velocidade sobe com accel e desce a 1,2 m/s².
 *
 * GARRA: ao cruzar 80%, rola chance = 0.10 + 0.70*n(garra) (+ item, + tática).
 *   Sucesso: teto ×(1.02 + 0.16*n(garra)) até a chegada. Evento 'garra'.
 *
 * HABILIDADES: disparam 1 vez por corrida conforme trigger (ver data.js) e geram
 *   evento 'skill'. Itens: mods + special (ignoreWeatherPenalty, garraChanceBonus,
 *   staminaPoolMult).
 *
 * EVENTOS: 'skill', 'garra', 'cansou' (estamina zerou faltando >2%), 'ultrapassagem'
 *   (troca de líder confirmada por 1,5 s, intervalo mínimo 4 s, após 12% da pista,
 *   antes do 1º chegar), 'chegada' (todos). Ordenados por t.
 *
 * FRAMES: um por tick, inclusive t=0. Depois da chegada pos fica = distance
 *   (pos === distance => chegou) e a velocidade cai a 0 em ~2 s. Simula até TODOS
 *   chegarem. config.recordFrames === false pula os frames (usado no balance.js).
 *
 * CONDIÇÕES: config.conditions é opcional (sem ela => randomConditions(seed)); campos
 *   ausentes (ex.: pista sem `weather`) são sorteados pela seed.
 *
 * EXTRA (além do contrato): result.seed, result.conditions (normalizadas) e
 *   result.racerInfo[i] = { name, horseName, tactic, stats, affinity, form, disposicao }.
 * ============================================================================
 *
 * UMD: no browser vira window.RaceSim (precisa de window.GameData antes);
 * no Node, module.exports (faz require('./data.js')).
 */
(function (root) {
  'use strict';

  var GameData = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.GameData;
  if (!GameData) throw new Error('RaceSim: GameData não encontrado (carregue data.js antes de sim.js).');

  var STAT_KEYS = GameData.STAT_KEYS;

  // Constantes de balanceamento (ajustadas por tools/balance.js). Exposto como RaceSim.TUNING.
  var T = {
    dt: 0.1,
    // crescimento por level
    growthBase: 0.50, growthPot: 0.65, potFlat: 0.1,
    // velocidade / aceleração
    vBase: 16.8, vRange: 2.2,
    aBase: 0.6, aRange: 2.4,
    decel: 1.2,
    // estamina
    poolBase: 66, poolEst: 20,
    drainK: 1.0, drainExp: 4, drainDistExp: [2, 5], drainRefDist: 1600,   // drainDistExp = 2/5 (fração p/ evitar Math.pow)
    rationReserve: 0.03,
    jockeyErrMin: -0.02, jockeyErrMax: 0.06,   // otimismo do jóquei ao ler o tanque (às vezes cansa no fim)
    exhaustPace: 0.75,
    minPace: 0.80,
    // ruído
    formRange: 0.10,
    tickJitter: 0.006,
    startDelayMax: 0.6,
    // terreno / pelotão
    hillSlow: 0.15, hillDrain: 0.30, forcaHillRelief: 0.7,
    forcaSurfRelief: 0.8,
    crowdRange: 2.5, crowdSlow: 0.03, forcaCrowdRelief: 0.8,
    draftMin: 0.5, draftRange: 4.0, draftSave: 0.10,
    rainSlow: 0.015, sunDrain: 1.04,
    // afinidade de elemento: multiplica os status (n) e, além disso, uma fração dela vai direto na vMax
    affinityStep: 0.04, affinityMin: 0.92, affinityMax: 1.08, affinityVel: 0.22, affinityVelNeg: 0,
    // garra
    garraZone: 0.8,
    garraChanceBase: 0.10, garraChanceRange: 0.70, garraChanceMax: 0.95,
    garraBoostBase: 0.02, garraBoostRange: 0.16,
    // táticas (fração s da vMax)
    tactics: {
      // early/mid/spurtCap: teto de ritmo por fase; earlyMargin/margin: quanto acima (>1) ou abaixo (<1)
      // do ritmo sustentável o jóquei aceita correr; earlyBoost/kick: bônus grátis (número ou tabela por distância).
      ponteiro: {
        earlyEnd: 0.30, early: 1.00, earlyMargin: 99, mid: 0.97, spurtStart: 0.78, spurtCap: 1.00, margin: 1.00,
        earlyBoost: { 1000: 1.03, 1600: 1.015, 2400: 1.00 }, kick: 1.00, garraBonus: 0.00, draft: false
      },
      perseguidor: {
        earlyEnd: 0.30, early: 0.97, earlyMargin: 1.00, mid: 0.97, spurtStart: 0.72, spurtCap: 1.03, margin: 1.00,
        earlyBoost: 1.00, kick: 1.00, garraBonus: 0.00, draft: true
      },
      arrancador: {
        earlyEnd: 0.30, early: 0.93, earlyMargin: 0.96, mid: 0.95, spurtStart: 0.70, spurtCap: 1.06, margin: 0.96,
        earlyBoost: 1.00, kick: { 1000: 1.00, 1600: 1.025, 2400: 1.05 }, garraBonus: 0.15, draft: true
      }
    },
    // Rating de Poder: peso de cada status efetivo (habilidades somam 20 × chance do gatilho)
    ratingW: { vel: 2.2, acel: 1.8, man: 1.6, est: 1.8, forca: 1.6, garra: 1.6, sorte: 0.8 },
    // chance de a skill disparar no gatilho: base da raridade + nível + sorte (teto 95%)
    skillPerLevel: 0.005, skillPerSorte: 0.001, skillChanceMax: 0.95,
    learnChance: 0.08,   // chance de aprender uma skill nova ao subir de nível
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

  // Aritmética só com + - * / (IEEE 754 exato em qualquer motor JS), para que a mesma
  // seed dê o mesmo resultado no Node, Chrome, Safari etc. Nada de Math.pow/exp/log no laço.
  function powi(x, k) { var r = 1; for (var i = 0; i < k; i++) r *= x; return r; }
  function nthRoot(x, m) {
    if (!(x > 0)) return 0;
    if (m === 1) return x;
    var y = 1 + (x - 1) / m;
    if (y <= 0) y = 0.5;
    for (var i = 0; i < 80; i++) {
      var ny = ((m - 1) * y + x / powi(y, m - 1)) / m;
      var d = ny - y;
      y = ny;
      if (d < 1e-13 * y && d > -1e-13 * y) break;
    }
    return y;
  }
  // x^(num/den); exp pode ser [num, den] ou um inteiro.
  function ratPow(x, exp) {
    if (typeof exp === 'number') return (exp % 1 === 0) ? powi(x, exp) : Math.pow(x, exp); // não-inteiro: não portátil
    return nthRoot(powi(x, exp[0]), exp[1]);
  }
  // valor de tuning que pode ser número ou tabela por distância {1000: x, 1600: y, 2400: z}
  function byDist(v, D) {
    if (v == null) return 1;
    if (typeof v === 'number') return v;
    if (v[D] != null) return v[D];
    var keys = Object.keys(v).map(Number).sort(function (a, b) { return a - b; });
    if (D <= keys[0]) return v[keys[0]];
    if (D >= keys[keys.length - 1]) return v[keys[keys.length - 1]];
    for (var i = 1; i < keys.length; i++) if (D < keys[i]) {
      var a = keys[i - 1], b = keys[i];
      return v[a] + (v[b] - v[a]) * (D - a) / (b - a);
    }
    return 1;
  }
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

  // Rating de Poder: soma ponderada dos status efetivos + habilidades + especial do item.
  // Cada habilidade vale 20 × a chance de o gatilho disparar numa corrida típica: clima, piso e
  // subida só acontecem em ~1/3 das corridas, então valem ~1/3 (antes valiam 20 cheios e
  // inflavam o rating de Garoa, Mandacaru etc.).
  var SKILL_TRIGGER_WEIGHT = { start: 1, straight: 1, curve: 0.8, curveExit: 0.8, hill: 0.6, lowStamina: 0.8, final: 1, dice: 1 };
  function skillWeight(id) {
    var sk = GameData.SKILLS[id];
    if (!sk) return 0;
    var trig = sk.trigger || '';
    if (trig.indexOf('weather:') === 0) return 0.4;
    return SKILL_TRIGGER_WEIGHT[trig] != null ? SKILL_TRIGGER_WEIGHT[trig] : 1;
  }
  function itemSpecialPoints(horse, itemId) {
    var item = itemId ? GameData.ITEMS[itemId] : null;
    var sp = item && item.special;
    if (!sp) return 0;
    var pts = 0;
    if (sp.staminaPoolMult) pts += (sp.staminaPoolMult - 1) * 400;
    if (sp.garraChanceBonus) pts += sp.garraChanceBonus * 120;
    if (sp.ignoreWeatherPenalty) pts += 8;
    return pts;
  }
  // Chance de uma skill disparar quando o gatilho acontece.
  function skillChance(horse, stats) {
    var rar = GameData.RARITIES[horse.rarity] || GameData.RARITIES.comum;
    var c = rar.skillChance + T.skillPerLevel * ((horse.level || 1) - 1) + T.skillPerSorte * ((stats && stats.sorte) || 0);
    return Math.min(T.skillChanceMax, c);
  }
  // Sorteia uma skill nova ao subir de nível (ou null). Não muta a montaria.
  // Ordem das chamadas de rng: 1) portão de T.learnChance, 2) escolha do candidato.
  function learnSkill(mount, rng) {
    var rar = GameData.RARITIES[mount.rarity] || GameData.RARITIES.comum;
    var owned = mount.skills || [];
    if (owned.length >= rar.skillSlots) return null;
    if (rng() >= T.learnChance) return null;
    var cands = [];
    Object.keys(GameData.SKILLS).forEach(function (id) {
      var sk = GameData.SKILLS[id];
      if (sk.element !== 'neutro' && sk.element !== mount.element) return;
      if (sk.exclusive && sk.exclusive !== mount.id) return;
      if (owned.indexOf(id) >= 0) return;
      cands.push(id);
    });
    if (!cands.length) return null;
    return cands[Math.floor(rng() * cands.length)];
  }
  function powerRating(horse, itemId) {
    var s = computeStats(horse, itemId);
    var skillPts = 0;
    (horse.skills || []).forEach(function (id) { skillPts += 20 * skillWeight(id); });
    var w = T.ratingW, sum = 0;
    for (var i = 0; i < STAT_KEYS.length; i++) sum += s[STAT_KEYS[i]] * w[STAT_KEYS[i]];
    return Math.round(sum + skillPts + itemSpecialPoints(horse, itemId));
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

  // Campos ausentes (ex.: pista de exemplo sem `weather`) são sorteados pela seed;
  // sem seed (dicas de UI) ficam neutros (1600 m, grama, nublado, sem subida).
  function normalizeConditions(c, seed) {
    c = c || {};
    var rnd = (seed == null) ? null : randomConditions(seed);
    return {
      distance: c.distance || (rnd ? rnd.distance : 1600),
      surface: GameData.SURFACES[c.surface] ? c.surface : (rnd ? rnd.surface : 'grama'),
      weather: GameData.WEATHERS[c.weather] ? c.weather : (rnd ? rnd.weather : 'nublado'),
      hills: (c.hills || (rnd ? rnd.hills : [])).map(function (h) { return [h[0], h[1]]; })
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
        var step = T.affinityStep * (rule.weight == null ? 1 : rule.weight);
        sum += rule.sign * step;
        var pct = Math.round(step * 100);
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
    // divisão por tamanho do campo (ECONOMY.payoutSplitFor): em campos pequenos pagam menos
    // posições, para que todo lugar premiado receba pelo menos a entrada de volta.
    var full = (typeof E.payoutSplitFor === 'function' ? E.payoutSplitFor(numRacers) : null) || E.payoutSplit;
    places = Math.min(places, full.length);
    var split = full.slice(0, places);
    var tot = 0, i;
    for (i = 0; i < split.length; i++) tot += split[i];
    var given = 0;
    for (i = 0; i < places; i++) {
      var amount = (i === places - 1) ? dist - given : Math.floor(dist * split[i] / tot);
      given += amount;
      prizes.push({ racer: order[i], place: i + 1, amount: amount });
    }
    // o resto do arredondamento cai no último pago e, com fees minúsculos, invertia prêmios
    // (ex.: fee 1, n=6 → [2, 1, 2]); reordena os valores para nunca pagar mais a quem chega depois
    var amounts = prizes.map(function (p) { return p.amount; }).sort(function (a, b) { return b - a; });
    for (i = 0; i < places; i++) prizes[i].amount = amounts[i];
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
    return nthRoot(x, T.drainExp - 1);
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
      aff: aff,
      form: form,
      nf: nf,
      vMax: (T.vBase + T.vRange * nv) * form * (1 + (aff.mult > 1 ? T.affinityVel : T.affinityVelNeg) * (aff.mult - 1)),
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
      garraRolled: false, garraMult: 1
    };
  }

  // "Forma do dia" em palavras (para a UI explicar zebras).
  function dispositionFor(form) {
    if (form >= 1.05) return 'Radiante';
    if (form >= 1.02) return 'Animado';
    if (form > 0.98) return 'Normal';
    if (form > 0.95) return 'Sonolento';
    return 'Indisposto';
  }

  function simulate(config) {
    config = config || {};
    var seed = (config.seed >>> 0);
    var cond = normalizeConditions(config.conditions || randomConditions(seed), seed);
    var D = cond.distance;
    var entries = config.racers || [];
    var n = entries.length;
    var dt = T.dt;
    var record = config.recordFrames !== false;
    var surf = GameData.SURFACES[cond.surface];
    var weatherDrain = cond.weather === 'sol' ? T.sunDrain : 1;
    var weatherSlow = cond.weather === 'chuva' ? (1 - T.rainSlow) : 1;
    var distDrain = ratPow(T.drainRefDist / D, T.drainDistExp); // pistas longas gastam menos por segundo (mas duram mais)

    var R = [];
    for (var i = 0; i < n; i++) R.push(buildRacer(entries[i], i, cond, mulberry32(hash2(seed, i + 1))));
    // nome usado na narração: nome do cavalo; se dois corredores têm cavalos de mesmo nome, acrescenta o jogador
    for (i = 0; i < n; i++) {
      var dup = false;
      for (var q = 0; q < n; q++) if (q !== i && R[q].horseName === R[i].horseName) dup = true;
      R[i].label = (dup && R[i].name !== R[i].horseName) ? R[i].horseName + ' (' + R[i].name + ')' : R[i].horseName;
    }

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
      ev(t, r.index, 'skill', r.label + ' ativou ' + sk.name + '!');
    }

    function checkSkills(r, t, p, rank, nRacers) {
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
        else if (trig === 'behind') ok = p >= 0.6 && rank >= Math.ceil(nRacers / 2);
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

      for (i = 0; i < n; i++) {
        var r = R[i];
        if (r.finished) {
          r.v = Math.max(0, r.v - 8 * dt);
          continue;
        }
        if (tPrev < r.startDelay) {
          // ainda reagindo ao sinal de largada
          if (!r.fired.__start) { r.fired.__start = true; checkSkills(r, tPrev, 0, rankOf[i], n); }
          continue;
        }
        var pos = prevPos[i];
        var p = pos / D;
        var rem = D - pos;
        checkSkills(r, tPrev, p, rankOf[i], n);

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
            ev(tPrev, i, 'garra', r.label + ' mostrou GARRA na reta final!');
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

        // bônus "de graça" da tática (não gastam estamina): arrancada do ponteiro e explosão do arrancador
        var tacBoost = 1;
        if (!r.exhausted) {
          if (p < tac.earlyEnd) tacBoost = byDist(tac.earlyBoost, D);
          else if (p >= tac.spurtStart) tacBoost = byDist(tac.kick, D);
        }
        var boost = effSpeed * r.garraMult * tacBoost;
        var jitter = 1 + (r.rng() - 0.5) * T.tickJitter;
        var vTarget = s * r.vMax * speedMod * boost * jitter;

        if (r.v < vTarget) r.v = Math.min(vTarget, r.v + r.accel * effAccel * dt);
        else r.v = Math.max(vTarget, r.v - T.decel * dt);

        // gasto de estamina (boosts não custam)
        if (!r.exhausted) {
          var sEff = r.v / (r.vMax * boost);
          r.stamina -= T.drainK * powi(sEff, T.drainExp) * drainMod * dt / r.pool;
          if (r.stamina <= 0) {
            r.stamina = 0;
            r.exhausted = true;
            if (rem > D * 0.02) ev(t, i, 'cansou', r.label + ' cansou e perdeu o ritmo!');
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
            ev(candSince, L, 'ultrapassagem', R[L].label + ' passou ' + R[leader].label + ' e assumiu a liderança!');
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
        R[ri].label + ' cruzou a linha em ' + (k + 1) + 'º lugar! (' + fmtTime(finishTimes[ri]) + ')');
    }
    // ordena eventos por tempo (estável)
    var idx = events.map(function (e, q) { return q; });
    idx.sort(function (a, b) { return (events[a].t - events[b].t) || (a - b); });
    events = idx.map(function (q) { return events[q]; });

    // Extra (fora do contrato mínimo): resumo por corredor para dicas na UI.
    var racerInfo = R.map(function (r) {
      return {
        name: r.name, horseName: r.horseName, tactic: r.tactic,
        stats: r.stats, affinity: r.aff,
        form: Math.round(r.form * 1000) / 1000, disposicao: dispositionFor(r.form)
      };
    });

    return {
      seed: seed,
      conditions: cond,
      dt: dt,
      duration: r2(duration),
      frames: frames,
      events: events,
      finishOrder: finishOrder,
      finishTimes: finishTimes,
      racerInfo: racerInfo
    };
  }

  var RaceSim = {
    TUNING: T,
    STAT_KEYS: STAT_KEYS,
    mulberry32: mulberry32,
    hash2: hash2,
    computeStats: computeStats,
    powerRating: powerRating,
    skillChance: skillChance,
    learnSkill: learnSkill,
    leagueFor: leagueFor,
    randomConditions: randomConditions,
    // opts opcional: { itemId } para a UI mostrar a Capa anulando a penalidade de clima
    elementAffinity: function (element, conditions, opts) {
      var item = opts && opts.itemId ? GameData.ITEMS[opts.itemId] : null;
      var special = (item && item.special) || {};
      return elementAffinity(element, conditions, { ignoreWeatherPenalty: !!special.ignoreWeatherPenalty });
    },
    simulate: simulate,
    payouts: payouts
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RaceSim;
  else root.RaceSim = RaceSim;
})(typeof self !== 'undefined' ? self : this);
