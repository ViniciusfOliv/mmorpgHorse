/*
 * MMORPG Horse — simulação de corrida (protótipo descartável). Núcleo v2, status v3.
 *
 * RaceSim.simulate(config) é uma FUNÇÃO PURA e DETERMINÍSTICA de (config, seed):
 * sem Math.random, sem Date, sem estado global. O servidor simularia; o cliente só
 * anima os frames. No laço só há + - * / (raízes por Newton), então o resultado é
 * idêntico bit a bit em qualquer motor JS. Mapa, Dado da Sorte e viradas de clima
 * também saem só da seed.
 *
 * ============================== MODELO ======================================
 * Passo fixo dt = 0.1 s. RNG mulberry32; cada corredor tem um fluxo próprio
 * mulberry32(hash2(seed, índice+1)); o mapa usa hash2(seed, 0xC0FFEE) e o Dado da
 * Sorte hash2(seed, 0xD1CE). Constantes em RaceSim.TUNING (ajustadas com
 * tools/balance.js). Corrida = status + terreno + RNG, sem ruído escondido por
 * corredor (a sorte "grande" é o Dado da Sorte, visível na pista).
 *
 * STATUS v3 (7, escala 1–100): vel, acel, man (Manobra), forca, est, garra, sorte.
 *   g = genética (horse.potential[k], 0–31); estrelas = horse.grau (1–3; starsOf);
 *   natural(k)   = raridade.baseLo + 16*g/31 + (level-1) * (0.30 + 0.08*g/31)   (naturalStat)
 *   pontosLivres = floor((level-1) * starMult[estrelas-1]), starMult = 1 / 1,2 / 1,5   (freePoints)
 *   limite       = ceil(0.34 * pontosLivres) pontos num mesmo status   (statLimit)
 *   horse.alloc  = pontos distribuídos; validAlloc saneia (inteiros ≥ 0, corta pelo limite e depois
 *                  pelo total, na ordem de STAT_KEYS). Ponto acima do teto fica guardado e não rende.
 *   computeStats: status = round(min(natural + pontos, raridade.statCap) + mods do equipamento),
 *   limitado a 1–120 (teto Comum 80 … Mítico 100; o arredondamento é um só, no fim). n(x) = status/100.
 *   allocInfo(horse) resume a distribuição para a tela: { free, used, left, perStat, room }.
 *   powerRating = 3,1·VEL + 1,4·ACE + 1,4·MAN + 1,5·EST + 2,2·FOR + 1,4·GAR + 0,4·SOR
 *   + 20 × peso do gatilho (skillWeight) por skill + pontos de conjunto 3/4/5 peças (3/15/20; ligas em GameData.LEAGUES).
 *
 * CLIMA (sol / chuva / nevoa / nublado). weatherMult(elemento, clima, dobrado):
 *   dono do clima ×1,03 (T.weatherMult; ×1,08 = T.weatherMultDouble com a skill de clima
 *   ativa), elemento penalizado ×0,97 (2 − weatherMult), resto e Nublado ×1. O equipamento
 *   pode anular o ×0,97 (ignoreWeatherPenalty) ou reforçar o bônus de um clima para ×1,07
 *   (T.weatherMultSet, 4 peças do conjunto; a skill, ×1,08, vale mais e não acumula).
 *   applyWeather(r, clima) recalcula, com m = weatherMult:
 *     vMax  = (17.805 + 1.2*n(vel)*m) * (1 + 0.10*(m-1))   (weatherVel: um extra direto na vMax)
 *     accel = 0.6 + 2.4*n(acel)*m  m/s²   (largada e retomadas)
 *     Força, Manobra e Garra efetivas = n(x)*m;  chance/força da Garra (abaixo).
 *   O tanque NÃO depende do clima: tanque = 66 + 20*n(est).
 *   Efeitos gerais: sol => gasto ×1,04; chuva => todos −1,5% de velocidade.
 *   É chamada de novo quando o clima vira, quando uma skill de clima reforça o bônus e quando
 *   uma skill mexe na Garra; o que já foi gasto não muda.
 *
 * MAPA EM BLOCOS (randomConditions(seed)). Ordem das chamadas de rng():
 *   1) distância D = 1000 + 100*floor(rng*15)  (1 000–2 400 m);  2) nº de blocos B = 5..9;
 *   3) B pesos w = 0.5 + rng (fronteiras acumuladas D·Σw/total arredondadas a 10 m, o último
 *   fecha em D);  4) tipo de cada bloco do meio (B−2, uniforme reta/curva/subida; o 1º e o
 *   último são sempre reta);  5) piso (grama/terra/areia);  6) clima inicial (4 climas).
 *   conditions = { distance, surface, weather, blocks: [{ type, from, to }] }. Campos ausentes
 *   ou inválidos em config.conditions são sorteados pela seed (normalizeConditions). Distância
 *   aceita: inteiro em 1000–2400 m; fora disso vale a da seed. Com distância dada diferente da
 *   seed e sem blocos válidos, a pista vira uma reta única dessa distância.
 *
 * FATOR DO BLOCO (multiplica a velocidade-alvo; teto 1):
 *   reta 1;  curva = min(1, 0.826 + 0.14*n(man) + bônus de skill)   (0,826–0,966);
 *   subida = min(1, 0.86 + 0.13*n(forca) + bônus de skill)          (0,86–0,99).
 *   Ao sair da curva/subida a velocidade volta com accel (Aceleração manda na retomada).
 *
 * VELOCIDADE-ALVO = s * vMax * piso * pelotão * chuva * fatorBloco * boosts * jitter(±0,3%)
 *   piso: terra −3%, areia −6%, aliviado por Força em 50% × n(forca);
 *   pelotão: até −3% com vizinhos a ≤2,5 m (Força alivia 80%). Sobe com accel, desce a 1,2 m/s².
 *
 * RITMO (fração s de vMax), um perfil só pelo "jóquei":
 *   aff = ritmo constante que o tanque restante sustenta até o fim (forma fechada,
 *   affordablePace); o jóquei lê o tanque com erro −2%..+6% (às vezes cansa) e guarda 3%.
 *   s = min(0.97, aff) até 72% da pista, depois min(1.03, aff) (sprint); mínimo voluntário 0,80.
 *   Na estimativa o jóquei prevê a subida restante: lá o trecho dura 1/fatorSubida a mais e
 *   gasta ×(1 + 0.30*(1 − 0.5*n(forca))).
 *
 * ESTAMINA
 *   gasto/s = (v / (vMax*boosts*fatorSubida))^4 * (1600/D)^0.4 * mods / tanque
 *   Na subida o esforço divide pelo fator da subida (subir é esforço, não descanso) e a
 *   estimativa do jóquei prevê isso; nas curvas e retas o fator do bloco não entra.
 *   mods: piso (terra ×1,05, areia ×1,12), sol ×1,04, subida ×(1 + 0.30*(1 − 0.5*n(forca))
 *   × skill de subida), vácuo −10% (para todos, a 0,5–4 m atrás de alguém), skills.
 *   Boosts (Garra, skills) elevam o teto SEM custo extra. Pistas longas apertam mais o tanque.
 *   Estamina 0 => ritmo cai para 0,75 até o fim + evento 'cansou'.
 *
 * GARRA: ao cruzar 80%, rola chance = min(0.95, 0.10 + 0.70*n(garra)*m + bônus de item/skill).
 *   Sucesso: teto ×(1.02 + 0.16*n(garra)*m + bônus de skill) até a chegada. Evento 'garra'.
 *
 * SKILLS (gatilhos e efeitos em data.js). Quando o gatilho acontece, UMA tentativa contra
 *   skillChance = min(0.95, raridade.skillChance + 0.005*(level−1) + 0.001*sorte)
 *   (por corrida; por bloco se effect.blockScoped). Gatilhos: start (largada), straight (entrou
 *   numa reta ≥150 m que não é a da largada), curve, curveExit, hill (entrou no bloco),
 *   lowStamina (estamina ≤30%), final (cruzou 80%), dice (uma tentativa por corrida, antes do 1º Dado da Sorte),
 *   weather:<clima> (checado a cada tick com o clima vigente). Chaves de effect: accelMult,
 *   speedMult, drainMult (por distanceM ou durationS), curveBonus, hillBonus, hillDrainMult
 *   (até o fim do bloco), staminaRestore, garraChanceBonus, garraBoostBonus, extraDice,
 *   weatherDouble. Equipamento: mods + special (skillChanceBonus,
 *   weatherDoubleClimate, ignoreWeatherPenalty), vindo de Gear.resolve. Evento 'skill'.
 *
 * DADO DA SORTE: quando o líder cruza 1/3 e 2/3 de D (T.diceAt), todos rolam (inclusive quem
 *   já chegou), no fluxo próprio do Dado. rollDice: d1 = 1..100; Sorte = chance de rolar um
 *   segundo dado (sorte/100) e ficar com o melhor; Dado Viciado soma um dado extra (até 3).
 *   Maior dado vence; empate no topo => re-rola só os empatados. O clima vira o do elemento do
 *   vencedor (Fogo sol, Água chuva, Grama névoa); se já for esse ou o vencedor for Neutro, o
 *   clima "segura". Eventos 'dado' { at, rolls, winner, weather, changed } e, se virou, 'clima'.
 *
 * EVENTOS: 'skill', 'garra', 'cansou' (estamina zerou faltando >2%), 'ultrapassagem'
 *   (troca de líder confirmada por 1,5 s, intervalo mínimo 4 s, após 12% da pista,
 *   antes do 1º chegar), 'chegada' (todos), 'dado', 'clima'. Ordenados por t.
 *
 * FRAMES: um por tick, inclusive t=0. Depois da chegada pos fica = distance
 *   (pos === distance => chegou) e a velocidade cai a 0 em ~2 s. Simula até TODOS
 *   chegarem. config.recordFrames === false pula os frames (usado no balance.js).
 *
 * MODO DEV (opcional): config.dev = { skillsAlways: true } faz toda tentativa de skill ativar. O
 *   r.rng() da tentativa continua sendo chamado (os fluxos não se deslocam); só a comparação com a
 *   chance é ignorada. Sem config.dev (ou com skillsAlways falso), o resultado é exatamente o de sempre.
 *
 * RESULTADO: { seed, simVersion (RaceSim.VERSION), tuningHash (impressão digital do TUNING e dos
 *   dados de skills/raridades/clima usados), conditions (iniciais normalizadas), weatherFinal (clima
 *   depois dos Dados), dt, duration, frames, events, finishOrder, finishTimes,
 *   racerInfo[i] = { name, horseName, stats, skillChance } }.
 *
 * ENTRADAS MALFORMADAS: level e potencial passam por sanitizeLevel/sanitizePotential (Number;
 *   não finito vale 1 / 0; level inteiro 1–50, potencial 0–31), em computeStats e skillChance;
 *   grau por starsOf (não numérico vale 2, fora da faixa é preso a 1–3); alloc por validAlloc.
 *
 * ORDEM DAS CHAMADAS DE r.rng() (fluxo de cada corredor; manter estável):
 *   montagem: 1) startDelay, 2) jockeyErr; por tick: 3) tentativas de skill (só quando um
 *   gatilho acontece), 4) sorteio da Garra (uma vez, em 80%), 5) jitter; depois do movimento,
 *   quando o Dado vai rolar: tentativa do gatilho 'dice'. Detalhes junto de buildRacer.
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

  // Versão das regras da simulação: suba a cada mudança que altere resultados (exposta como
  // RaceSim.VERSION e gravada em cada resultado como simVersion, junto do tuningHash).
  var VERSION = '3.0.0';

  // Constantes de balanceamento (ajustadas por tools/balance.js). Exposto como RaceSim.TUNING.
  var T = {
    dt: 0.1,
    // status v3: natural = baseLo + gBand·g/31 + (nível − 1)·(gGrowBase + gGrowRange·g/31);
    // pontos livres = piso((nível − 1)·starMult[estrelas − 1]); até teto(freeCapShare·livres) por status
    gBand: 16, gGrowBase: 0.30, gGrowRange: 0.08,
    starMult: [1, 1.2, 1.5],
    freeCapShare: 0.34,
    // velocidade / aceleração
    vBase: 17.805, vRange: 1.2,
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
    tickJitter: 0.006,
    startDelayMax: 0.6,
    // blocos: rendimento na curva (Manejo) e na subida (Força), limitado a 1; subida gasta mais
    curveBase: 0.826, curveRange: 0.14,
    hillBase: 0.86, hillRange: 0.13, hillDrain: 0.30,
    // terreno / pelotão
    forcaSurfRelief: 0.5,
    crowdRange: 2.5, crowdSlow: 0.03, forcaCrowdRelief: 0.8,
    draftMin: 0.5, draftRange: 4.0, draftSave: 0.10,   // vácuo: vale para todos
    rainSlow: 0.015, sunDrain: 1.04,
    // clima: dono multiplica os status por 1,03 (1,08 com skill de clima; 1,07 com 4 peças do conjunto
    // do clima, sem a skill), penalizado por 0,97;
    // weatherVel: fração extra do desvio que vai direto na vMax
    weatherMult: 1.03, weatherMultDouble: 1.08, weatherMultSet: 1.07, weatherVel: 0.10,
    // garra
    garraZone: 0.8,
    garraChanceBase: 0.10, garraChanceRange: 0.70, garraChanceMax: 0.95,
    garraBoostBase: 0.02, garraBoostRange: 0.16,
    // skills
    lowStaminaAt: 0.30,
    straightMinM: 150,   // gatilho 'straight' só em reta com pelo menos esse comprimento
    // ritmo único do jóquei (fração s da vMax): mid até spurtStart, depois sprint até spurtCap
    pace: { mid: 0.97, spurtStart: 0.72, spurtCap: 1.03 },
    // Rating de Poder: peso de cada status efetivo (cada skill soma 20 × peso do gatilho)
    ratingW: { vel: 3.1, acel: 1.4, man: 1.4, est: 1.5, forca: 2.2, garra: 1.4, sorte: 0.4 },
    // chance de a skill disparar no gatilho: base da raridade + nível + sorte (teto 95%)
    skillPerLevel: 0.005, skillPerSorte: 0.001, skillChanceMax: 0.95,
    learnChance: 0.08,   // chance de aprender uma skill nova ao subir de nível
    // eventos
    leadMinP: 0.12, leadConfirmS: 1.5, leadMinGapS: 4.0,
    // Dado da Sorte: rola quando o líder cruza essas frações de D ([] desliga)
    diceAt: [1 / 3, 2 / 3],
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
    if (typeof exp === 'number') {
      if (exp % 1 !== 0) throw new Error('ratPow: expoente fracionário não portável — use [num, den]');
      return powi(x, exp);
    }
    return nthRoot(powi(x, exp[0]), exp[1]);
  }
  // Impressão digital das regras: FNV-1a de 32 bits (duas bases, 16 hex) sobre o JSON do TUNING, dos
  // pesos de gatilho e dos dados de jogo que a simulação lê (skills: gatilho e efeito; raridades:
  // teto, início da faixa de nascimento e chance de skill; elementos, pisos e climas; level máximo). Recalculada a cada
  // simulate (o TUNING pode ser trocado em teste/ajuste); um servidor pode guardar o par
  // simVersion + tuningHash para auditar corridas antigas depois de um rebalanceamento.
  function fnv1a(str, h) {
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function hex8(x) { var s = (x >>> 0).toString(16); while (s.length < 8) s = '0' + s; return s; }
  function pick(obj, keys) {
    var out = {};
    Object.keys(obj).forEach(function (id) {
      var o = {}; keys.forEach(function (k) { o[k] = obj[id][k]; }); out[id] = o;
    });
    return out;
  }
  function tuningHash() {
    var str = JSON.stringify({
      T: T, w: SKILL_TRIGGER_WEIGHT,
      skills: pick(GameData.SKILLS, ['element', 'trigger', 'effect']),
      rarities: pick(GameData.RARITIES, ['statCap', 'baseLo', 'skillChance']),
      elements: pick(GameData.ELEMENTS, ['weather']),
      surfaces: pick(GameData.SURFACES, ['slow', 'drain']),
      weathers: pick(GameData.WEATHERS, ['element', 'penalizes']),
      maxLevel: GameData.ECONOMY.maxLevel
    });
    return hex8(fnv1a(str, 0x811C9DC5)) + hex8(fnv1a(str, 0x2B992DDF));
  }

  function r2(x) { return Math.round(x * 100) / 100; }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function fmtTime(s) { return s.toFixed(2).replace('.', ',') + 's'; }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------
  // Saneamento único de level e potencial (computeStats, skillChance): vira número; não finito
  // vale o mínimo; level inteiro em 1–maxLevel, potencial em 0–31.
  function sanitizeLevel(v) {
    var x = Number(v);
    if (!isFinite(x)) return 1;
    return clamp(Math.floor(x), 1, GameData.ECONOMY.maxLevel || 50);
  }
  function sanitizePotential(v) {
    var x = Number(v);
    return isFinite(x) ? clamp(x, 0, 31) : 0;
  }
  // Estrelas (grau) de 1 a 3, com o mesmo saneamento do Breed.grauOf: ausente ou não numérico
  // vale 2 (★★); número fora da faixa é arredondado e preso a 1–3.
  function starsOf(horse) {
    var g = Number(horse && horse.grau);
    if (!horse || horse.grau == null || !isFinite(g)) return 2;
    return clamp(Math.round(g), 1, 3);
  }
  function rarityOf(horse) { return GameData.RARITIES[horse.rarity] || GameData.RARITIES.comum; }
  // Pontos livres ganhos até o nível: piso((nível − 1) · multiplicador das estrelas).
  function freePoints(horse) {
    return Math.floor((sanitizeLevel(horse.level) - 1) * T.starMult[starsOf(horse) - 1] + 1e-9);
  }
  // Limite de pontos num mesmo status: teto(freeCapShare · pontos livres).
  function statLimit(horse) {
    return Math.ceil(T.freeCapShare * freePoints(horse) - 1e-9);
  }
  // Status natural (sem pontos, sem teto, sem equipamento): sai só da genética, da raridade e do nível.
  function naturalStat(horse, k) {
    var g = sanitizePotential(horse.potential && horse.potential[k]);
    return rarityOf(horse).baseLo + T.gBand * g / 31 + (sanitizeLevel(horse.level) - 1) * (T.gGrowBase + T.gGrowRange * g / 31);
  }
  // Pontos distribuídos saneados: as 7 chaves, inteiros ≥ 0, cortados pelo limite por status e
  // depois pelo total, na ordem de STAT_KEYS. Não corta pelo teto da raridade: o ponto acima do
  // teto fica guardado e não rende (quem corta é computeStats).
  function validAlloc(horse, alloc) {
    var src = (alloc && typeof alloc === 'object') ? alloc : {};
    var left = freePoints(horse), lim = statLimit(horse), out = {};
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var k = STAT_KEYS[i], a = Number(src[k]);
      a = isFinite(a) && a > 0 ? Math.floor(a) : 0;
      if (a > lim) a = lim;
      if (a > left) a = left;
      left -= a;
      out[k] = a;
    }
    return out;
  }
  // Resumo para a tela de distribuição: room[k] = quantos pontos o status k ainda aceita agora
  // (mínimo entre o limite por status que sobra, os pontos que sobram e o que falta até o teto).
  function allocInfo(horse) {
    var a = validAlloc(horse, horse.alloc), free = freePoints(horse), perStat = statLimit(horse);
    var cap = rarityOf(horse).statCap, used = 0, room = {}, i, k;
    for (i = 0; i < STAT_KEYS.length; i++) used += a[STAT_KEYS[i]];
    var left = free - used;
    for (i = 0; i < STAT_KEYS.length; i++) {
      k = STAT_KEYS[i];
      var toCap = Math.max(0, Math.ceil(cap - naturalStat(horse, k) - a[k] - 1e-9));
      room[k] = Math.max(0, Math.min(perStat - a[k], left, toCap));
    }
    return { free: free, used: used, left: left, perStat: perStat, room: room };
  }
  // status(k) = arredonda(min(natural + pontos, teto da raridade) + equipamento), preso a 1–120.
  function computeStats(horse, gear) {
    var cap = rarityOf(horse).statCap;
    // gear que não seja objeto com mods (null, string de save antigo) vale null
    var mods = (gear && typeof gear === 'object' && gear.mods) ? gear.mods : null;
    var alloc = validAlloc(horse, horse.alloc);
    var out = {};
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var k = STAT_KEYS[i];
      var v = Math.min(naturalStat(horse, k) + alloc[k], cap);
      if (mods && mods[k]) v += mods[k];
      out[k] = clamp(Math.round(v), 1, 120);
    }
    return out;
  }

  // Rating de Poder: soma ponderada dos status efetivos + habilidades + pontos de conjunto.
  // Cada habilidade vale 20 × o peso do seu gatilho. Para curva, subida e estamina baixa o peso segue a
  // chance de o gatilho acontecer numa corrida típica; clima (0.8) e dice (0.2) são pesos calibrados no
  // pacote de balanceamento, não chances: o gatilho 'dice' acontece em toda corrida (o Dado extra só mexe
  // na virada de clima, por isso vale pouco), e o de clima vale 0.8 mesmo sem acontecer sempre.
  // Exposto como RaceSim.SKILL_TRIGGER_WEIGHT; 'weather' vale para todo gatilho 'weather:<clima>'.
  // O sim-test confere que todo gatilho usado em GameData.SKILLS tem peso aqui (o fallback 1 é só defesa).
  var SKILL_TRIGGER_WEIGHT = { start: 1, straight: 1, curve: 0.8, curveExit: 0.8, hill: 0.6, lowStamina: 0.8, final: 1, dice: 0.2, weather: 0.8 };
  function skillWeight(id) {
    var sk = GameData.SKILLS[id];
    if (!sk) return 0;
    var trig = sk.trigger || '';
    if (trig.indexOf('weather:') === 0) trig = 'weather';
    return SKILL_TRIGGER_WEIGHT[trig] != null ? SKILL_TRIGGER_WEIGHT[trig] : 1;
  }
  // Chance de uma skill disparar quando o gatilho acontece.
  function skillChance(horse, stats, bonus) {
    var rar = GameData.RARITIES[horse.rarity] || GameData.RARITIES.comum;
    var c = rar.skillChance + T.skillPerLevel * (sanitizeLevel(horse.level) - 1) + T.skillPerSorte * ((stats && stats.sorte) || 0) + (bonus || 0);
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
  function powerRating(horse, gear) {
    var s = computeStats(horse, gear);
    var skillPts = 0;
    (horse.skills || []).forEach(function (id) { skillPts += 20 * skillWeight(id); });
    var w = T.ratingW, sum = 0;
    for (var i = 0; i < STAT_KEYS.length; i++) sum += s[STAT_KEYS[i]] * w[STAT_KEYS[i]];
    var setPts = 0;
    if (gear && typeof gear === 'object' && gear.set && gear.set.count >= 3) {
      setPts = GameData.ECONOMY.gear.setBonus.ratingPts[gear.set.count - 3] || 0;
    }
    return Math.round(sum + skillPts + setPts);
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
  var SURF_LIST = ['grama', 'terra', 'areia'];
  var WEATHER_LIST = ['sol', 'chuva', 'nevoa', 'nublado'];
  var BLOCK_LIST = ['reta', 'curva', 'subida'];

  // Pista em blocos, toda derivada da seed. Ordem das chamadas de rng:
  // distância, nº de blocos B, pesos (B), tipos (B-2), superfície, clima.
  function randomConditions(seed) {
    var rng = mulberry32(hash2(seed, 0xC0FFEE));
    var distance = 1000 + 100 * Math.floor(rng() * 15);
    var B = 5 + Math.floor(rng() * 5);
    var weights = [], total = 0, i;
    for (i = 0; i < B; i++) { weights.push(0.5 + rng()); total += weights[i]; }
    var blocks = [], acc = 0, from = 0, to;
    for (i = 0; i < B; i++) {
      acc += weights[i];
      // fronteiras acumuladas arredondadas a 10 m; o último bloco fecha em `distance`
      to = (i === B - 1) ? distance : Math.round(distance * acc / total / 10) * 10;
      var type = (i === 0 || i === B - 1) ? 'reta' : BLOCK_LIST[Math.floor(rng() * 3)];
      blocks.push({ type: type, from: from, to: to });
      from = to;
    }
    var surface = SURF_LIST[Math.floor(rng() * 3)];
    var weather = WEATHER_LIST[Math.floor(rng() * 4)];
    return { distance: distance, surface: surface, weather: weather, blocks: blocks };
  }

  // Blocos são válidos se contíguos a partir de 0 e (quando dada) terminam em `distance`.
  function validBlocks(blocks, distance) {
    if (!blocks || !blocks.length) return false;
    var prev = 0;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (!b || !GameData.BLOCK_TYPES[b.type]) return false;
      if (b.from !== Math.floor(b.from) || b.to !== Math.floor(b.to) || !(b.from < b.to)) return false;
      if (b.from !== prev) return false;
      prev = b.to;
    }
    return distance == null || prev === distance;
  }

  // Distância aceita: inteiro dentro da faixa do sorteio de pista (randomConditions, 1000–2400 m).
  var DIST_MIN = 1000, DIST_MAX = 2400;
  function validDistance(d) {
    return typeof d === 'number' && isFinite(d) && d === Math.floor(d) && d >= DIST_MIN && d <= DIST_MAX;
  }

  // Campos ausentes ou inválidos (ex.: pista de exemplo sem `weather`, distância fora de 1000–2400 m
  // ou não numérica) são sorteados pela seed; sem seed (dicas de UI) ficam neutros (1600 m, grama,
  // nublado, uma reta única). Distância válida sem blocos válidos: se for a da seed, usa os blocos da
  // seed; se for outra, a pista vira uma reta única dessa distância. Blocos que terminam fora da
  // faixa são descartados.
  function normalizeConditions(c, seed) {
    c = c || {};
    var rnd = (seed == null) ? null : randomConditions(seed);
    var given = validDistance(c.distance) ? c.distance : null;
    var blocks;
    if (validBlocks(c.blocks, given) && validDistance(c.blocks[c.blocks.length - 1].to)) {
      blocks = c.blocks;
      if (!given) given = blocks[blocks.length - 1].to;
    } else {
      if (!given) given = rnd ? rnd.distance : 1600;
      blocks = (rnd && rnd.distance === given) ? rnd.blocks : [{ type: 'reta', from: 0, to: given }];
    }
    return {
      distance: given,
      surface: GameData.SURFACES[c.surface] ? c.surface : (rnd ? rnd.surface : 'grama'),
      weather: GameData.WEATHERS[c.weather] ? c.weather : (rnd ? rnd.weather : 'nublado'),
      blocks: blocks.map(function (b) { return { type: b.type, from: b.from, to: b.to }; })
    };
  }

  // Índice do bloco que contém `pos` (varredura linear; pos >= fim -> último; pos < 0 -> 0).
  function blockAt(blocks, pos) {
    for (var i = 0; i < blocks.length; i++) if (pos < blocks[i].to) return i;
    return blocks.length - 1;
  }

  // Fração (0-1) do comprimento total ocupada por blocos do tipo dado.
  function blockShare(blocks, type) {
    var len = 0;
    for (var i = 0; i < blocks.length; i++) if (blocks[i].type === type) len += blocks[i].to - blocks[i].from;
    var total = blocks.length ? blocks[blocks.length - 1].to - blocks[0].from : 0;
    return total > 0 ? len / total : 0;
  }

  function rangesOf(blocks, type) {
    var out = [];
    for (var i = 0; i < blocks.length; i++) if (blocks[i].type === type) out.push([blocks[i].from, blocks[i].to]);
    return out;
  }
  function hillsFromBlocks(blocks) { return rangesOf(blocks, 'subida'); }
  function curvesFromBlocks(blocks) { return rangesOf(blocks, 'curva'); }

  // ---------------------------------------------------------------------------
  // Pagamentos
  // ---------------------------------------------------------------------------
  function payouts(entryFee, numRacers, finishOrder) {
    var E = GameData.ECONOMY;
    entryFee = Math.max(0, Math.floor(entryFee));
    var pot = entryFee * numRacers;
    var fee = Math.round(pot * Math.round(E.houseFee * 100) / 100);
    var dist = pot - fee;
    var order = finishOrder || [];
    var places = Math.min(E.payoutSplit.length, order.length, numRacers);
    var prizes = [];
    if (places <= 0) return { pot: pot, fee: pot, prizes: prizes };
    // divisão por tamanho do campo (ECONOMY.payoutSplitFor): em campos pequenos pagam menos
    // posições, para que todo lugar premiado receba pelo menos a entrada de volta.
    var full = (typeof E.payoutSplitFor === 'function' ? E.payoutSplitFor(numRacers) : null) || E.payoutSplit;
    places = Math.min(places, full.length);
    // porcentagens inteiras (0,7 → 70): Math.floor(dist * 0.7) errava por ponto flutuante (360 × 0,7 = 251,99…)
    var pcts = [], tot = 0, i;
    for (i = 0; i < places; i++) { pcts.push(Math.round(full[i] * 100)); tot += pcts[i]; }
    var given = 0;
    for (i = 0; i < places; i++) {
      var amount = Math.floor(dist * pcts[i] / tot);
      given += amount;
      prizes.push({ racer: order[i], place: i + 1, amount: amount });
    }
    prizes[0].amount += dist - given;   // o resto do arredondamento vai para o 1º
    // defesa: reordena os valores para nunca pagar mais a quem chega depois
    var amounts = prizes.map(function (p) { return p.amount; }).sort(function (a, b) { return b - a; });
    for (i = 0; i < places; i++) prizes[i].amount = amounts[i];
    return { pot: pot, fee: fee, prizes: prizes };
  }

  // ---------------------------------------------------------------------------
  // Simulação
  // ---------------------------------------------------------------------------
  // Fração do trecho [from, to) que cai em blocos de subida (usada na estimativa de gasto do jóquei).
  function hillFraction(blocks, from, to) {
    if (to <= from) return 0;
    var len = 0;
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].type !== 'subida') continue;
      var a = Math.max(from, blocks[i].from), b = Math.min(to, blocks[i].to);
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

  // Multiplicador de clima de um elemento: dono do clima => T.weatherMult (T.weatherMultDouble
  // com skill de clima ativa); elemento penalizado => 2 - T.weatherMult (0,97); senão 1.
  function weatherMult(element, weather, doubled) {
    var w = GameData.WEATHERS[weather];
    var el = GameData.ELEMENTS[element];
    if (!w || !el) return 1;
    if (el.weather === weather) return doubled ? T.weatherMultDouble : T.weatherMult;
    if (w.penalizes === element) return 2 - T.weatherMult;
    return 1;
  }

  // (Re)calcula os números do corredor que dependem do clima. Pode ser chamada de novo no meio da
  // corrida (troca de clima, skill que reforça o bônus, bônus de Garra): só lê statsN e os totais.
  function applyWeather(r, weather) {
    var m = weatherMult(r.element, weather, r.weatherDouble);
    // 4 peças do conjunto do clima: ×1,07 no lugar de ×1,03 (só se a skill de clima não estiver ativa)
    if (!r.weatherDouble && r.gearDoubleClimate === weather && m === T.weatherMult) m = T.weatherMultSet;
    if (m < 1 && r.ignoreWeatherPenalty) m = 1;   // equipamento: anula a penalidade
    var sn = r.statsN;
    r.weatherM = m;
    r.vMax = (T.vBase + T.vRange * sn.vel * m) * (1 + T.weatherVel * (m - 1));
    r.accel = T.aBase + T.aRange * sn.acel * m;
    r.nf = sn.forca * m;
    r.nm = sn.man * m;
    var ng = sn.garra * m;
    r.garraChance = clamp(T.garraChanceBase + T.garraChanceRange * ng + r.garraBonusTotal, 0, T.garraChanceMax);
    r.garraBoost = 1 + T.garraBoostBase + T.garraBoostRange * ng + r.garraBoostBonusTotal;
  }

  // Ordem das chamadas de r.rng() (fluxo próprio de cada corredor; manter estável):
  //   montagem: 1) startDelay, 2) jockeyErr;
  //   por tick: 3) tentativas de skill (só quando um gatilho acontece; na ordem dos gatilhos
  //   start/bloco/clima/lowStamina/final e, dentro de cada gatilho, na ordem da lista de skills),
  //   4) sorteio da Garra (uma vez, ao cruzar garraZone), 5) jitter.
  function buildRacer(entry, index, cond, rng) {
    var horse = entry.horse;
    var gear = (entry.gear && typeof entry.gear === 'object' && entry.gear.mods) ? entry.gear : null;
    var special = (gear && gear.special) || {};
    var stats = computeStats(horse, gear);
    var statsN = {};
    for (var i = 0; i < STAT_KEYS.length; i++) statsN[STAT_KEYS[i]] = stats[STAT_KEYS[i]] / 100;
    var skills = (horse.skills || []).filter(function (id) { return !!GameData.SKILLS[id]; });
    var r = {
      index: index,
      name: entry.name || horse.name,
      horseName: horse.name,
      element: horse.element,
      stats: stats,
      statsN: statsN,
      skillChance: skillChance(horse, stats, special.skillChanceBonus || 0),
      pool: T.poolBase + T.poolEst * statsN.est,   // tanque fixo (sem clima)
      ignoreWeatherPenalty: !!special.ignoreWeatherPenalty,
      garraBonusTotal: 0,
      gearDoubleClimate: special.weatherDoubleClimate || null,
      garraBoostBonusTotal: 0,
      weatherDouble: false,
      extraDice: 0,
      startDelay: rng() * T.startDelayMax * (1 - 0.5 * clamp(statsN.acel, 0, 1)),
      jockeyErr: T.jockeyErrMin + rng() * (T.jockeyErrMax - T.jockeyErrMin),
      rng: rng,
      skills: skills,
      started: false,
      blockIdx: -1,
      tried: {},
      effects: [],
      pos: 0, v: 0, stamina: 1,
      exhausted: false, finished: false, finishTime: null,
      garraRolled: false, garraMult: 1
    };
    applyWeather(r, cond.weather);
    return r;
  }

  // Dado da Sorte de uma montaria. Ordem das chamadas de rng() (manter estável): d1, sorteio do
  // 2º dado (sempre consumido, mesmo com sorte 0 ou 100), d2 (se houver), dado extra (Dado Viciado).
  // Sorte = chance, em %, de rolar dois dados e ficar com o melhor; extraDice limitado a 1 (até 3 dados).
  function rollDice(rng, sorte, extraDice) {
    var dice = [1 + Math.floor(rng() * 100)];
    var p = clamp((sorte || 0) / 100, 0, 1);
    if (rng() < p) dice.push(1 + Math.floor(rng() * 100));
    var extra = clamp(Math.floor(extraDice || 0), 0, 1);
    for (var k = 0; k < extra; k++) dice.push(1 + Math.floor(rng() * 100));
    var best = dice[0];
    for (k = 1; k < dice.length; k++) if (dice[k] > best) best = dice[k];
    return { dice: dice, best: best };
  }

  var DICE_PHRASE = { sol: 'o sol abre!', chuva: 'começa a chover!', nevoa: 'a névoa desce!' };

  function simulate(config) {
    config = config || {};
    var seed = (config.seed >>> 0);
    var cond = normalizeConditions(config.conditions || randomConditions(seed), seed);
    var D = cond.distance;
    var blocks = cond.blocks;
    var entries = config.racers || [];
    var n = entries.length;
    var dt = T.dt;
    var record = config.recordFrames !== false;
    var skillsAlways = !!(config.dev && config.dev.skillsAlways);   // modo DEV (ver o cabeçalho)
    var surf = GameData.SURFACES[cond.surface];
    // efeitos gerais do clima vigente (recalculados quando o Dado vira o clima)
    var weatherDrain, weatherSlow;
    function setWeatherGlobals(w) {
      weatherDrain = w === 'sol' ? T.sunDrain : 1;
      weatherSlow = w === 'chuva' ? (1 - T.rainSlow) : 1;
    }
    setWeatherGlobals(cond.weather);
    var distDrain = ratPow(T.drainRefDist / D, T.drainDistExp); // pistas longas gastam menos por segundo (mas duram mais)
    // clima vigente (o Dado da Sorte troca no meio da corrida e chama applyWeather de novo)
    cond.weatherAtual = cond.weather;
    // Dado da Sorte: fluxo próprio, para não perturbar os fluxos por corredor
    var diceRng = mulberry32(hash2(seed, 0xD1CE));
    var diceAt = T.diceAt || [];
    var diceIdx = 0;

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

    // Uma tentativa por gatilho (por corrida; por bloco se blockScoped): sorteia contra r.skillChance.
    function tryFire(r, id, t, pos, blockTo) {
      var sk = GameData.SKILLS[id];
      var e = sk.effect || {};
      var key = e.blockScoped ? id + '#' + r.blockIdx : id;
      if (r.tried[key]) return;
      r.tried[key] = true;
      // o número é sempre sorteado (a ordem das chamadas não muda); com config.dev.skillsAlways
      // (só o modo DEV) a skill ativa mesmo que ele saia acima da chance
      var roll = r.rng();
      if (!(roll < r.skillChance) && !skillsAlways) return;
      if (e.staminaRestore && !r.exhausted) r.stamina = Math.min(1, r.stamina + e.staminaRestore);
      if (e.extraDice) r.extraDice += e.extraDice;
      var reweather = false;
      if (e.garraChanceBonus) { r.garraBonusTotal += e.garraChanceBonus; reweather = true; }
      if (e.garraBoostBonus) { r.garraBoostBonusTotal += e.garraBoostBonus; reweather = true; }
      if (e.weatherDouble) { r.weatherDouble = true; reweather = true; }
      if (reweather) applyWeather(r, cond.weatherAtual);
      if (e.speedMult || e.accelMult || e.drainMult || e.curveBonus || e.hillBonus || e.hillDrainMult) {
        r.effects.push({
          untilT: e.durationS ? t + e.durationS : null,
          untilPos: e.distanceM ? pos + e.distanceM : (e.blockScoped ? blockTo : null),
          speedMult: e.speedMult || 1,
          accelMult: e.accelMult || 1,
          drainMult: e.drainMult || 1,
          curveBonus: e.curveBonus || 0,
          hillBonus: e.hillBonus || 0,
          hillDrainMult: e.hillDrainMult || 1
        });
      }
      ev(t, r.index, 'skill', r.label + ' ativou ' + sk.name + '!');
    }

    // Tenta todas as skills do corredor com o gatilho dado (na ordem da lista).
    function trigger(r, trig, t, pos, blockTo) {
      for (var s = 0; s < r.skills.length; s++) {
        if (GameData.SKILLS[r.skills[s]].trigger === trig) tryFire(r, r.skills[s], t, pos, blockTo);
      }
    }

    // Liderança
    var leader = -1, cand = -1, candSince = 0, lastLeadEvent = -1e9, leadInit = false;

    var finishedCount = 0;
    var step = 0;
    var prevPos = new Array(n);

    while (finishedCount < n) {
      step++;
      var t = step / 10; // dt = 0.1 exato, sem acumular erro
      if (t > T.maxTime) break;
      var tPrev = (step - 1) / 10;

      for (i = 0; i < n; i++) prevPos[i] = R[i].pos;

      for (i = 0; i < n; i++) {
        var r = R[i];
        if (r.finished) {
          r.v = Math.max(0, r.v - 8 * dt);
          continue;
        }
        var pos = prevPos[i];
        if (!r.started) { r.started = true; trigger(r, 'start', tPrev, pos, null); }
        if (tPrev < r.startDelay) continue;   // ainda reagindo ao sinal de largada
        var p = pos / D;
        var rem = D - pos;

        // gatilhos de bloco (checados antes de mover, com o bloco de `pos`)
        var bi = blockAt(blocks, pos);
        if (bi !== r.blockIdx) {
          var prevB = r.blockIdx;
          r.blockIdx = bi;
          var bTo = blocks[bi].to;
          if (prevB >= 0 && blocks[prevB].type === 'curva') trigger(r, 'curveExit', tPrev, pos, bTo);
          if (blocks[bi].type === 'curva') trigger(r, 'curve', tPrev, pos, bTo);
          else if (blocks[bi].type === 'subida') trigger(r, 'hill', tPrev, pos, bTo);
          else if (bi > 0 && blocks[bi].to - blocks[bi].from >= T.straightMinM) trigger(r, 'straight', tPrev, pos, bTo);
        }
        var blk = blocks[r.blockIdx];
        // clima (checado a cada tick: pode passar a valer quando o clima mudar)
        trigger(r, 'weather:' + cond.weatherAtual, tPrev, pos, blk.to);
        if (r.stamina <= T.lowStaminaAt && !r.exhausted) trigger(r, 'lowStamina', tPrev, pos, blk.to);
        if (p >= T.garraZone) trigger(r, 'final', tPrev, pos, blk.to);

        // efeitos ativos
        var effSpeed = 1, effAccel = 1, effDrain = 1, curveBonus = 0, hillBonus = 0, hillDrainMult = 1;
        for (var e = 0; e < r.effects.length; e++) {
          var fx = r.effects[e];
          if ((fx.untilT == null || tPrev < fx.untilT) && (fx.untilPos == null || pos < fx.untilPos)) {
            effSpeed *= fx.speedMult; effAccel *= fx.accelMult; effDrain *= fx.drainMult;
            curveBonus += fx.curveBonus; hillBonus += fx.hillBonus; hillDrainMult *= fx.hillDrainMult;
          }
        }

        // Garra
        if (!r.garraRolled && p >= T.garraZone) {
          r.garraRolled = true;
          if (r.rng() < r.garraChance) {
            r.garraMult = r.garraBoost;
            ev(tPrev, i, 'garra', r.label + ' mostrou GARRA na reta final!');
          }
        }

        // terreno e bloco
        var nf = clamp(r.nf, 0, 1.2), nm = clamp(r.nm, 0, 1.2);
        var speedMod = weatherSlow;
        var drainMod = surf.drain * weatherDrain * distDrain * effDrain;
        speedMod *= 1 - surf.slow * (1 - T.forcaSurfRelief * nf);
        var fatorBloco = 1;
        if (blk.type === 'curva') {
          fatorBloco = Math.min(1, T.curveBase + T.curveRange * nm + curveBonus);
        } else if (blk.type === 'subida') {
          fatorBloco = Math.min(1, T.hillBase + T.hillRange * nf + hillBonus);
          drainMod *= 1 + T.hillDrain * (1 - 0.5 * nf) * hillDrainMult;
        }
        // pelotão e vácuo (vácuo vale para todos)
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
        if (drafting) drainMod *= 1 - T.draftSave;

        // ritmo do jóquei (perfil único)
        var s;
        if (r.exhausted) {
          s = T.exhaustPace;
        } else {
          var hf = hillFraction(blocks, pos, D);
          // na subida o gasto por segundo é o da reta (sEff já desconta o fatorSubida), mas o trecho
          // dura 1/fatorSubida a mais: o jóquei prevê isso na fração de subida restante
          var fsH = Math.min(1, T.hillBase + T.hillRange * nf);
          var cEst = surf.drain * weatherDrain * distDrain * (1 + hf * ((1 + T.hillDrain * (1 - 0.5 * nf)) / fsH - 1));
          var vRef = r.vMax * speedMod;
          var aff = affordablePace(r.stamina + r.jockeyErr - T.rationReserve, rem, vRef, r.pool, cEst);
          s = Math.min(p < T.pace.spurtStart ? T.pace.mid : T.pace.spurtCap, aff);
          s = Math.max(s, T.minPace);
        }

        var boost = effSpeed * r.garraMult;
        var jitter = 1 + (r.rng() - 0.5) * T.tickJitter;
        var vTarget = s * r.vMax * speedMod * fatorBloco * boost * jitter;

        if (r.v < vTarget) r.v = Math.min(vTarget, r.v + r.accel * effAccel * dt);
        else r.v = Math.max(vTarget, r.v - T.decel * dt);

        // gasto de estamina (boosts não custam)
        if (!r.exhausted) {
          // na subida o fatorBloco é esforço, não descanso: sem dividir por ele, quem é lento na
          // subida gasta menos estamina e recupera no fim (o especialista de Força perdia na subida)
          var sEff = r.v / (r.vMax * boost * (blk.type === 'subida' ? fatorBloco : 1));
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

      // Dado da Sorte: quando o líder cruza diceAt[k]·D, todos rolam (inclusive quem já chegou)
      var maxPos = 0;
      for (i = 0; i < n; i++) if (R[i].pos > maxPos) maxPos = R[i].pos;
      while (n > 0 && diceIdx < diceAt.length && maxPos >= diceAt[diceIdx] * D) {
        // gatilho 'dice' (Dado Viciado): tenta no fluxo do próprio corredor, antes de rolar
        for (i = 0; i < n; i++) trigger(R[i], 'dice', t, R[i].pos, null);
        var rolls = [], cands = [];
        for (i = 0; i < n; i++) {
          var rd = rollDice(diceRng, R[i].stats.sorte, R[i].extraDice);
          rolls.push({ racer: i, dice: rd.dice, best: rd.best, rerolls: 0 });
          cands.push(i);
        }
        // empate no topo: re-rola só os empatados até sobrar um. Teto de 20 rodadas de
        // desempate (na prática inalcançável); se ainda empatar, vence o menor índice
        // (tied segue a ordem crescente dos índices, então tied[0]).
        for (var tieRound = 0; ; tieRound++) {
          var top = -1, tied = [];
          for (q = 0; q < cands.length; q++) {
            var bq = rolls[cands[q]].best;
            if (bq > top) { top = bq; tied = [cands[q]]; } else if (bq === top) tied.push(cands[q]);
          }
          if (tied.length === 1 || tieRound >= 20) break;
          cands = tied;
          for (q = 0; q < cands.length; q++) {
            var ro = rolls[cands[q]];
            var rr = rollDice(diceRng, R[cands[q]].stats.sorte, R[cands[q]].extraDice);
            ro.dice = rr.dice; ro.best = rr.best; ro.rerolls++;
          }
        }
        var win = tied[0];
        var wEl = GameData.ELEMENTS[R[win].element];
        var novo = (wEl && wEl.weather) || cond.weatherAtual;
        var changed = novo !== cond.weatherAtual;
        if (changed) {
          cond.weatherAtual = novo;
          setWeatherGlobals(novo);
          for (i = 0; i < n; i++) applyWeather(R[i], novo);
        }
        events.push({
          t: r2(t), racer: win, type: 'dado', at: diceAt[diceIdx], rolls: rolls, winner: win,
          weather: cond.weatherAtual, changed: changed,
          text: '🎲 ' + R[win].label + ' tirou ' + rolls[win].best +
            (changed ? ' — ' + DICE_PHRASE[novo] : ' — o clima segura!')
        });
        if (changed) {
          events.push({ t: r2(t), racer: -1, type: 'clima', weather: novo,
            text: 'O clima virou: ' + GameData.WEATHERS[novo].name + '!' });
        }
        diceIdx++;
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
        name: r.name, horseName: r.horseName, stats: r.stats, skillChance: r.skillChance
      };
    });

    var weatherFinal = cond.weatherAtual;
    delete cond.weatherAtual;   // conditions devolvidas = condições iniciais normalizadas

    return {
      seed: seed,
      simVersion: VERSION,
      tuningHash: tuningHash(),
      conditions: cond,
      weatherFinal: weatherFinal,
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
    VERSION: VERSION,
    TUNING: T,
    SKILL_TRIGGER_WEIGHT: SKILL_TRIGGER_WEIGHT,
    skillWeight: skillWeight,
    tuningHash: tuningHash,
    sanitizeLevel: sanitizeLevel,
    sanitizePotential: sanitizePotential,
    STAT_KEYS: STAT_KEYS,
    mulberry32: mulberry32,
    hash2: hash2,
    computeStats: computeStats,
    starsOf: starsOf,
    freePoints: freePoints,
    statLimit: statLimit,
    naturalStat: naturalStat,
    validAlloc: validAlloc,
    allocInfo: allocInfo,
    powerRating: powerRating,
    skillChance: skillChance,
    weatherMult: weatherMult,
    learnSkill: learnSkill,
    leagueFor: leagueFor,
    randomConditions: randomConditions,
    normalizeConditions: normalizeConditions,
    blockAt: blockAt,
    blockShare: blockShare,
    hillsFromBlocks: hillsFromBlocks,
    curvesFromBlocks: curvesFromBlocks,
    rollDice: rollDice,
    simulate: simulate,
    payouts: payouts
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RaceSim;
  else root.RaceSim = RaceSim;
})(typeof self !== 'undefined' ? self : this);
