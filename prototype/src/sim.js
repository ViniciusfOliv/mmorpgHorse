/*
 * MMORPG Horse — simulação de corrida (protótipo descartável). Núcleo v2, status v3b.
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
 * STATUS v3b (7, escala 1–150): vel, acel, man (Manobra), forca, est, garra, sorte. Nada cresce sozinho.
 *   g = genética (horse.potential[k], 0–31); estrelas = horse.grau (1–3; starsOf);
 *   base(k)  = raridade.baseLo + 16*g/31   (naturalStat; baseLo 40/44/49/54/60)
 *   pontos   = floor(ptsMult * starMult[estrelas-1] * [(L-1)*2 + 4*(L-1)(L-2)/96])   (freePoints: a taxa
 *              por nível sobe de 2 no nível 2 a 6 no 50, média 4); ptsMult 1,00/1,05/1,10/1,15/1,20; starMult 1 / 1,09 / 1,22
 *   Sorte não recebe pontos (T.noBuy): fica só com a base, 40–76.
 *   custo    = o i-ésimo ponto comprado num status (i = 0, 1, …) custa 1 + floor(i/10) (pointCost);
 *              comprar a pontos custa costOf(a) = 10·q(q+1)/2 + r(q+1), a = 10q + r.
 *   horse.alloc = pontos de status comprados em cada status; validAlloc saneia (inteiros ≥ 0, corta pelo
 *              teto base + a ≤ 150 e depois pelo custo total ≤ pontos, na ordem de STAT_KEYS).
 *   computeStats: status = round(base + a), limitado a 1–150. O equipamento não entra (por enquanto).
 *   n(x) = status/100. allocInfo(horse): { free, used (custo gasto), left, perStat, next (custo do
 *   próximo ponto), room (quantos pontos ainda cabem) }.
 *   powerRating = round(2,5·VEL + 2,0·ACE + 2,2·MAN + 2,4·FOR + 2,4·EST + 1,5·GAR + 0·SOR
 *   + 14 × peso do gatilho (skillWeight) por skill + 20·(nível−1)/49 + 28·ordemDaRaridade/4); ligas em GameData.LEAGUES.
 *   weightedAlloc(horse, w, from): um ponto por vez no status de menor (a+1)/w que ainda cabe.
 *   botAlloc(horse, from): weightedAlloc com T.botW[tipo] (os seis valem 1; × 1,2 nos dois status do tipo);
 *   sem RNG; com `from` continua a distribuição do jogador ("Distribuir sugerido").
 *   entry.statAdd (gancho de teste do balance.js, como noTypeSkill): soma ao status, preso a 1–150.
 *
 * CLIMA (sol / chuva / nevoa / nublado). weatherMult(elemento, clima, dobrado):
 *   dono do clima ×1,03 (T.weatherMult; ×1,08 = T.weatherMultDouble com a skill de clima
 *   ativa), elemento penalizado ×0,97 (2 − weatherMult), resto e Nublado ×1.
 *   applyWeather(r, clima) recalcula, com m = weatherMult e o clima somado a n: nc(x) = n(x) + (m−1)·0,5
 *   (o mesmo efeito do inicial em qualquer nível):
 *     vMax  = (19.0 + 1.13*nc(vel)) * (1 + 0.10*(m-1))   (weatherVel: um extra direto na vMax)
 *     accel = 1 / max(0,044, 1,158 − 0,66*nc(acel))  m/s²   (1/accel cai em linha reta: cada ponto encurta a largada igual)
 *     (valores de tempo da v3b ×1,067 na escala de tempo; no terço da skill de tipo os mesmos valores com os
 *     dois status do tipo × (1 + statMul·P) ficam em r.Z)
 *     Força, Manobra e Garra efetivas = nc(x);  chance/força da Garra (abaixo).
 *   O tanque NÃO depende do clima: tanque = 66 + 20*n(est).
 *   Efeitos gerais: sol => gasto ×1,04; chuva => todos −1,5% de velocidade.
 *   É chamada de novo quando o clima vira, quando uma skill de clima reforça o bônus e quando
 *   uma skill mexe na Garra; o que já foi gasto não muda.
 *
 * MAPA EM BLOCOS (randomConditions(seed)). Ordem das chamadas de rng():
 *   1) distância D = 1400 + 50*floor(rng*13)  (1 400–2 000 m);  depois, a cada tentativa:
 *   2) nº de blocos B = 5..9;  3) B pesos w = 0.5 + rng (fronteiras acumuladas D·Σw/total
 *   arredondadas a 10 m, o último fecha em D);  4) tipo de cada bloco do meio (B−2, uniforme
 *   reta/curva/subida; o 1º e o último são sempre reta). A tentativa vale se a pista tem pelo
 *   menos uma curva e uma subida e nenhum tipo passa de metade de D (T.trackMaxShare); senão,
 *   2–4 se repetem no mesmo fluxo (2,9 tentativas em média). Depois de 60 (T.trackTries), molde
 *   fixo: reta 15%, curva 30%, reta 10%, subida 30%, reta 15% de D. Por fim 5) piso (grama/terra/areia)
 *   e 6) clima inicial (4 climas).
 *   conditions = { distance, surface, weather, blocks: [{ type, from, to }] }. Campos ausentes
 *   ou inválidos em config.conditions são sorteados pela seed (normalizeConditions). Distância
 *   dada aceita: inteiro em 1000–2400 m (mais larga que o sorteio); fora disso vale a da seed.
 *   Com distância dada diferente da seed e sem blocos válidos, a pista vira uma reta única.
 *
 * FATOR DO BLOCO (multiplica a velocidade-alvo; teto 1, alcançado só em n = 1,6):
 *   reta 1;  curva = min(1, 0.704 + 0.185*n(man) + bônus de skill);
 *   subida = min(1, 0.824 + 0.11*n(forca) + bônus de skill). n(Força) e n(Manobra) efetivos presos a 0–2.
 *   Ao sair da curva/subida a velocidade volta com accel (Aceleração manda na retomada).
 *
 * VELOCIDADE-ALVO = s * vMax * piso * pelotão * chuva * fatorBloco * boosts * jitter(±0,3%)
 *   piso: terra −3%, areia −6%, aliviado por Força em 20% × n(forca);
 *   pelotão: até −3% com vizinhos a ≤2,5 m (Força alivia 60% × n, até zerar em n = 1,67). Sobe com accel, desce a 1,37 m/s² (T.decel).
 *
 * RITMO (fração s de vMax), um perfil só pelo "jóquei":
 *   aff = ritmo constante que o tanque restante sustenta até o fim (forma fechada,
 *   affordablePace); o jóquei lê o tanque com erro −0,5%..+2,5% e guarda 3%.
 *   s = min(0.97 + 0.035*(n(est) − 0.5), aff) até 72% da pista, depois min(1.03 + 0.065*(n(est) − 0.5), aff)
 *   (sprint): a Estamina sobe o teto do ritmo, então rende também quando o tanque sobra; mínimo voluntário 0,80.
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
 * GARRA: a arrancada começa em garraFrom = 0.80 − 0.14*(n(garra) − 0.5) da pista (mais Garra, mais cedo;
 *   o gatilho 'final' das skills vale no mesmo ponto). Lá rola chance = min(0.95, 0.50 + 0.15*nc(garra) + bônus de skill).
 *   Sucesso: teto ×(1.02 + 0.26*nc(garra) + bônus de skill) até a chegada. Evento 'garra'.
 *
 * SKILLS (gatilhos e efeitos em data.js). Quando o gatilho acontece, UMA tentativa contra
 *   skillChance = min(0.95, raridade.skillChance + 0.005*(level−1) + 0.001*sorte)
 *   (por corrida; por bloco se effect.blockScoped). Gatilhos: start (largada), straight (entrou
 *   numa reta ≥150 m que não é a da largada), curve, curveExit, hill (entrou no bloco),
 *   lowStamina (estamina ≤30%), final (início da arrancada, garraFrom), dice (uma tentativa por corrida, antes do 1º Dado da Sorte),
 *   weather:<clima> (checado a cada tick com o clima vigente). Chaves de effect: accelMult,
 *   speedMult, drainMult (por distanceM ou durationS), curveBonus, hillBonus, hillDrainMult
 *   (até o fim do bloco), staminaRestore, garraChanceBonus, garraBoostBonus, extraDice,
 *   weatherDouble. O equipamento (Gear.resolve) não entra na corrida por enquanto. Evento 'skill'.
 *
 * SKILL DE TIPO (GameData.TYPE_SKILLS, uma por elemento; typeSkill/typePower). Sempre ativa, sem
 *   sorteio e sem consumir a RNG, no terço [zone[0]·D, zone[1]·D) da pista: os dois status do tipo valem
 *   × (1 + statMul·P) (sinergia: rende mais para quem investe neles), com
 *   P = 1 + nívelT·(level − 1)/49 + raridadeT·ordemDaRaridade/4, por tipo (T.typeLevel / T.typeRar):
 *   Fogo −0,15/0,15 · Água 0/0,15 · Grama 0,25/0,40 (Comum nível 1 = 1 para todos; o efeito cresce também
 *   com os status, por isso o P quase não cresce):
 *     Labareda (Fogo, 0–D/3): Velocidade e Aceleração × (1 + 0,19·P);
 *     Raízes Firmes (Grama, D/3–2D/3): Força e Manobra × (1 + 0,15·P);
 *     Maré Alta (Água, 2D/3–D): Estamina (teto do ritmo) e Garra × (1 + 0,33·P).
 *   Vira um efeito com fromPos/untilPos em buildRacer. Na entrada do terço sai um evento
 *   { t, racer, type: 'skill', text, typeSkill: true }. Elemento desconhecido: sem skill de tipo.
 *   entry.noTypeSkill: true desliga (comparações do balance.js).
 *
 * DADO DA SORTE: quando o líder cruza 1/3 e 2/3 de D (T.diceAt), todos rolam (inclusive quem
 *   já chegou), no fluxo próprio do Dado. rollDice: d1 = 1..100; Sorte = chance de rolar um
 *   segundo dado ((sorte − 40)/40) e ficar com o melhor; Dado Viciado soma um dado extra (até 3).
 *   Maior dado vence; empate no topo => re-rola só os empatados. O clima vira o do elemento do
 *   vencedor (Fogo sol, Água chuva, Grama névoa); se já for esse (ou o elemento for desconhecido),
 *   o clima "segura". Eventos 'dado' { at, rolls, winner, weather, changed } e, se virou, 'clima'.
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
 *   racerInfo[i] = { name, horseName, stats, skillChance, typeSkill: { id, name, from, to } (metros) | null } }.
 *
 * ENTRADAS MALFORMADAS: level e potencial passam por sanitizeLevel/sanitizePotential (Number;
 *   não finito vale 1 / 0; level inteiro 1–50, potencial 0–31), em computeStats e skillChance;
 *   grau por starsOf (não numérico vale 2, fora da faixa é preso a 1–3); alloc por validAlloc.
 *
 * ORDEM DAS CHAMADAS DE r.rng() (fluxo de cada corredor; manter estável):
 *   montagem: 1) startDelay, 2) jockeyErr; por tick: 3) tentativas de skill (só quando um
 *   gatilho acontece), 4) sorteio da Garra (uma vez, em garraFrom), 5) jitter; depois do movimento,
 *   quando o Dado vai rolar: tentativa do gatilho 'dice'. A skill de tipo não chama r.rng().
 *   Detalhes junto de buildRacer.
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
  // os dois status de cada tipo (identidade: bot, skill de tipo)
  var TYPE_STATS = { fogo: ['vel', 'acel'], agua: ['est', 'garra'], grama: ['forca', 'man'] };

  // Versão das regras da simulação: suba a cada mudança que altere resultados (exposta como
  // RaceSim.VERSION e gravada em cada resultado como simVersion, junto do tuningHash).
  var VERSION = '3.1.0';

  // Constantes de balanceamento (ajustadas por tools/balance.js). Exposto como RaceSim.TUNING.
  var T = {
    dt: 0.1,
    // status v3b: base = baseLo + gBand·g/31 (nada cresce sozinho); status = base + pontos comprados.
    // pontos(L) = piso(raridade.ptsMult·starMult[estrelas − 1]·[(L − 1)·r0 + (r1 − r0)·(L − 1)(L − 2)/96]):
    // a taxa por nível sobe de ptsRate0 (nível 2) a ptsRate1 (nível 50), média 4.
    // o i-ésimo ponto comprado num status (i = 0, 1, …) custa 1 + piso(i / costStep); teto statMax;
    // noBuy: status que não recebem pontos (a Sorte fica só com a base)
    gBand: 16,
    ptsRate0: 2, ptsRate1: 6,
    starMult: [1, 1.09, 1.22],
    costStep: 10,
    statMax: 150,
    noBuy: ['sorte'],
    // skill de tipo: força P = typeBase + typeLevel[tipo]·(nível − 1)/49 + typeRar[tipo]·ordemDaRaridade/4;
    // no seu terço, os dois status do tipo valem × (1 + statMul·P) (GameData.TYPE_SKILLS)
    typeBase: 1,
    typeLevel: { fogo: -0.15, agua: 0, grama: 0.25 },
    typeRar: { fogo: 0.15, agua: 0.15, grama: 0.40 },
    // pista: D = distMin + distStep·k (até distMax); blocos re-sorteados até ter curva e subida e nenhum
    // tipo acima de trackMaxShare de D; depois de trackTries tentativas, molde fixo
    distMin: 1400, distMax: 2000, distStep: 50, trackMaxShare: 0.5, trackTries: 60,
    // velocidade; aceleração: 1/accel = aInv0 − aInv1·n(acel) (cada ponto encurta a largada igual), piso aInvMin.
    // Os valores de tempo (vBase, vRange, aInv*, decel, drainK, startDelayMax) são os da v3b ×1,067 na
    // escala de tempo (velocidade ×k, acelerações ×k², gasto por segundo ×k): mesma corrida em metros, ~6% mais curta.
    vBase: 19.0, vRange: 1.13,
    aInv0: 1.158, aInv1: 0.66, aInvMin: 0.044,
    decel: 1.37,
    // estamina
    poolBase: 66, poolEst: 20,
    drainK: 1.07, drainExp: 4, drainDistExp: [2, 5], drainRefDist: 1600,   // drainDistExp = 2/5 (fração p/ evitar Math.pow)
    rationReserve: 0.03,
    jockeyErrMin: -0.005, jockeyErrMax: 0.025,   // otimismo do jóquei ao ler o tanque (erro pequeno: quase ninguém cansa no fim)
    exhaustPace: 0.75,
    minPace: 0.80,
    // ruído; atraso de largada = rng·startDelayMax·(1 − startAcelK·min(n(acel), startAcelMax))
    tickJitter: 0.006,
    startDelayMax: 0.56, startAcelK: 1 / 3, startAcelMax: 1.5,
    // blocos: rendimento na curva (Manobra) e na subida (Força), teto 1 só em n = 1,6; subida gasta mais
    curveBase: 0.704, curveRange: 0.185,
    hillBase: 0.824, hillRange: 0.11, hillDrain: 0.30,
    nEffMax: 2,   // teto de n(Força) e n(Manobra) efetivos (com a Raízes Firmes); defesa, fora do alcance
    // terreno / pelotão (o alívio do pelotão zera só em n(Força) = 1/0,6)
    forcaSurfRelief: 0.2,
    crowdRange: 2.5, crowdSlow: 0.03, forcaCrowdRelief: 0.6,
    draftMin: 0.5, draftRange: 4.0, draftSave: 0.10,   // vácuo: vale para todos
    rainSlow: 0.015, sunDrain: 1.04,
    // clima: dono ×1,03 (×1,08 com skill de clima), penalizado ×0,97. O multiplicador m entra como soma
    // fixa em n: n + (m − 1)·weatherAdd (o mesmo efeito do inicial em qualquer nível);
    // weatherVel: fração extra do desvio que vai direto na vMax
    weatherMult: 1.03, weatherMultDouble: 1.08, weatherVel: 0.10, weatherAdd: 0.5,
    // garra: a arrancada começa em garraZone − garraZoneK·(n − 0,5) da pista; chance e força crescem com n
    garraZone: 0.8, garraZoneK: 0.14,
    garraChanceBase: 0.50, garraChanceRange: 0.15, garraChanceMax: 0.95,
    garraBoostBase: 0.02, garraBoostRange: 0.26,
    // Dado da Sorte: chance do 2º dado = (sorte − sorteDiceLo) / (sorteDiceFull − sorteDiceLo); Sorte real 40–76
    sorteDiceLo: 40, sorteDiceFull: 80,
    // skills
    lowStaminaAt: 0.30,
    straightMinM: 150,   // gatilho 'straight' só em reta com pelo menos esse comprimento
    // ritmo único do jóquei (fração s da vMax): mid até spurtStart, depois sprint até spurtCap; os tetos
    // sobem com a Estamina: + midEst/spurtEst·(n(est) − 0,5)
    pace: { mid: 0.97, spurtStart: 0.72, spurtCap: 1.03, midEst: 0.035, spurtEst: 0.065 },
    // Rating de Poder: peso de cada status; cada skill soma ratingSkillPts × peso do gatilho; nível e
    // raridade somam ratingLevel·(nível − 1)/49 + ratingRar·ordemDaRaridade/4
    ratingW: { vel: 2.5, acel: 2.0, man: 2.2, est: 2.4, forca: 2.4, garra: 1.5, sorte: 0 },
    ratingSkillPts: 14, ratingLevel: 20, ratingRar: 28,
    // build dos bots e "Distribuir sugerido": proporção de pontos comprados por status (weightedAlloc);
    // os seis valem o mesmo (A1), × 1,2 nos dois status do tipo; a Sorte não recebe pontos
    botW: {
      fogo:  { vel: 1.2, acel: 1.2, man: 1, forca: 1, est: 1, garra: 1 },
      agua:  { vel: 1, acel: 1, man: 1, forca: 1, est: 1.2, garra: 1.2 },
      grama: { vel: 1, acel: 1, man: 1.2, forca: 1.2, est: 1, garra: 1 }
    },
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
  // início da faixa de nascimento, multiplicador de pontos, chance de skill e ordem; skills de tipo: terço e efeito; elementos,
  // pisos e climas; level máximo). Recalculada a cada
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
      rarities: pick(GameData.RARITIES, ['ptsMult', 'baseLo', 'skillChance', 'order']),
      elements: pick(GameData.ELEMENTS, ['weather']),
      typeSkills: pick(GameData.TYPE_SKILLS, ['zone', 'effect']),
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
  // Raridade da montaria; desconhecida (ou nome herdado do Object.prototype, como 'constructor') vale Comum.
  function rarityOf(horse) {
    var r = horse && horse.rarity;
    return typeof r === 'string' && Object.prototype.hasOwnProperty.call(GameData.RARITIES, r) ? GameData.RARITIES[r] : GameData.RARITIES.comum;
  }
  // Pontos ganhos até o nível: piso((nível − 1) · ptsRate · fator da raridade · fator das estrelas).
  // A taxa cresce em linha reta do nível 2 (ptsRate0) ao último (ptsRate1):
  //   soma até L = (L − 1)·r0 + (r1 − r0)·(L − 1)(L − 2)/(2·(maxLevel − 2)).
  function freePoints(horse) {
    var fr = rarityOf(horse).ptsMult || 1, L = sanitizeLevel(horse.level), M = GameData.ECONOMY.maxLevel || 50;
    var r0 = T.ptsRate0, r1 = T.ptsRate1;
    var base = (L - 1) * r0 + (r1 - r0) * (L - 1) * (L - 2) / (2 * (M - 2));
    return Math.floor(base * fr * T.starMult[starsOf(horse) - 1] + 1e-9);
  }
  // Custo do i-ésimo ponto (i = 0, 1, …) num mesmo status: 1 + piso(i / costStep).
  function pointCost(i) { return 1 + Math.floor(i / T.costStep); }
  // Custo total de comprar `a` pontos num status: com a = q·step + r, step·q(q+1)/2 + r·(q+1).
  function costOf(a) {
    var st = T.costStep, q = Math.floor(a / st), r = a - q * st;
    return st * q * (q + 1) / 2 + r * (q + 1);
  }
  // Status sem pontos (base): sai só da raridade e da genética. Nada cresce sozinho com o nível.
  function naturalStat(horse, k) {
    var g = sanitizePotential(horse.potential && horse.potential[k]);
    return rarityOf(horse).baseLo + T.gBand * g / 31;
  }
  // Máximo de pontos num status: base + pontos ≤ statMax.
  function maxBuy(horse, k) {
    if (T.noBuy && T.noBuy.indexOf(k) >= 0) return 0;   // Sorte fica só com a base (não recebe pontos)
    return Math.max(0, Math.floor(T.statMax - naturalStat(horse, k) + 1e-9));
  }
  // Pontos comprados saneados: as 7 chaves, inteiros ≥ 0, cortados pelo teto (statMax) e depois pelo
  // custo total (soma dos custos ≤ pontos ganhos), na ordem de STAT_KEYS.
  function validAlloc(horse, alloc) {
    var src = (alloc && typeof alloc === 'object') ? alloc : {};
    var left = freePoints(horse), out = {};
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var k = STAT_KEYS[i], a = Number(src[k]);
      a = isFinite(a) && a > 0 ? Math.floor(a) : 0;
      a = Math.min(a, maxBuy(horse, k));
      while (a > 0 && costOf(a) > left) a--;
      left -= costOf(a);
      out[k] = a;
    }
    return out;
  }
  // Resumo para a tela: free (ganhos), used (gastos), left; perStat = pontos comprados; next[k] = custo
  // do próximo ponto em k; room[k] = quantos pontos k ainda aceita com o que sobra.
  function allocInfo(horse) {
    var a = validAlloc(horse, horse.alloc), free = freePoints(horse), used = 0, room = {}, next = {}, i, k;
    for (i = 0; i < STAT_KEYS.length; i++) used += costOf(a[STAT_KEYS[i]]);
    var left = free - used;
    for (i = 0; i < STAT_KEYS.length; i++) {
      k = STAT_KEYS[i];
      next[k] = pointCost(a[k]);
      var n = 0, mb = maxBuy(horse, k);
      while (a[k] + n < mb && costOf(a[k] + n + 1) - costOf(a[k]) <= left) n++;
      room[k] = n;
    }
    return { free: free, used: used, left: left, perStat: a, next: next, room: room };
  }
  // status(k) = arredonda(base + pontos), preso a 1–statMax. O equipamento não entra (por enquanto).
  function computeStats(horse) {
    var alloc = validAlloc(horse, horse.alloc);
    var out = {};
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var k = STAT_KEYS[i];
      out[k] = clamp(Math.round(naturalStat(horse, k) + alloc[k]), 1, T.statMax);
    }
    return out;
  }

  // Força da skill de tipo: P = typeBase + typeLevel[tipo]·(nível − 1)/49 + typeRar[tipo]·ordemDaRaridade/4
  // (Comum 1 = 1,00 nos três · Mítico 50: Fogo 1,00, Água 1,15, Grama 1,65). Elemento desconhecido: só a base.
  function typePower(horse) {
    var el = horse && horse.element;
    var tl = T.typeLevel[el] != null ? T.typeLevel[el] : 0, tr = T.typeRar[el] != null ? T.typeRar[el] : 0;
    return T.typeBase + tl * (sanitizeLevel(horse.level) - 1) / 49 + tr * (rarityOf(horse).order || 0) / 4;
  }
  // Skill de tipo da montaria (a do elemento dela) ou null para elemento desconhecido.
  function typeSkill(horse) {
    var ts = horse && Object.prototype.hasOwnProperty.call(GameData.TYPE_SKILLS, horse.element) ? GameData.TYPE_SKILLS[horse.element] : null;
    if (!ts) return null;
    var effect = {};
    for (var k in ts.effect) if (Object.prototype.hasOwnProperty.call(ts.effect, k)) effect[k] = ts.effect[k];
    return { id: ts.id, name: ts.name, power: typePower(horse), zone: [ts.zone[0], ts.zone[1]], effect: effect };
  }

  // Distribuição por pesos (sem RNG): um ponto por vez no status k de menor (a[k] + 1) / w[k] entre os que
  // aceitam (w[k] > 0, abaixo do teto e com o próximo ponto cabendo no que sobra); empate na ordem de
  // STAT_KEYS. Parte de `from` (pontos já comprados, saneados) e para quando nenhum status aceita.
  function weightedAlloc(horse, w, from) {
    var a = validAlloc(horse, from), left = freePoints(horse), mb = {}, i, k;
    for (i = 0; i < STAT_KEYS.length; i++) { k = STAT_KEYS[i]; left -= costOf(a[k]); mb[k] = maxBuy(horse, k); }
    while (left > 0) {
      var best = null, bv = Infinity;
      for (i = 0; i < STAT_KEYS.length; i++) {
        k = STAT_KEYS[i];
        var wk = w[k] || 0;
        if (!(wk > 0) || a[k] >= mb[k] || pointCost(a[k]) > left) continue;
        var v = (a[k] + 1) / wk;
        if (v < bv - 1e-12) { bv = v; best = k; }
      }
      if (!best) break;
      left -= pointCost(a[best]);
      a[best]++;
    }
    return a;
  }
  // Build dos bots e "Distribuir sugerido" (sem RNG): weightedAlloc com os pesos do tipo (T.botW).
  // Sem `from`, parte do zero (bot); com `from`, continua a partir do que o jogador já comprou.
  function botAlloc(horse, from) {
    var w = T.botW[horse.element] || T.botW.fogo;
    return weightedAlloc(horse, w, from);
  }

  // Rating de Poder: soma ponderada dos status + habilidades + nível e raridade (sem equipamento).
  // Cada habilidade vale T.ratingSkillPts (14) × o peso do seu gatilho; nível e raridade somam
  // T.ratingLevel·(nível − 1)/49 + T.ratingRar·ordem/4 (o mesmo para os três tipos).
  // Para curva, subida e estamina baixa o peso segue a
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
    var rar = rarityOf(horse);
    var c = rar.skillChance + T.skillPerLevel * (sanitizeLevel(horse.level) - 1) + T.skillPerSorte * ((stats && stats.sorte) || 0) + (bonus || 0);
    return Math.min(T.skillChanceMax, c);
  }
  // Sorteia uma skill nova ao subir de nível (ou null). Não muta a montaria.
  // Ordem das chamadas de rng: 1) portão de T.learnChance, 2) escolha do candidato.
  function learnSkill(mount, rng) {
    var rar = rarityOf(mount);
    var owned = mount.skills || [];
    if (owned.length >= rar.skillSlots) return null;
    if (rng() >= T.learnChance) return null;
    var cands = [];
    Object.keys(GameData.SKILLS).forEach(function (id) {
      var sk = GameData.SKILLS[id];
      if (sk.element !== 'geral' && sk.element !== mount.element) return;
      if (owned.indexOf(id) >= 0) return;
      cands.push(id);
    });
    if (!cands.length) return null;
    return cands[Math.floor(rng() * cands.length)];
  }
  function powerRating(horse) {
    var s = computeStats(horse);
    var skillPts = 0;
    (horse.skills || []).forEach(function (id) { skillPts += T.ratingSkillPts * skillWeight(id); });
    var w = T.ratingW, sum = 0;
    for (var i = 0; i < STAT_KEYS.length; i++) sum += s[STAT_KEYS[i]] * w[STAT_KEYS[i]];
    // nível e raridade (skill de tipo, chance de skill): termos próprios, iguais para os três tipos
    var growPts = T.ratingLevel * (sanitizeLevel(horse.level) - 1) / 49 + T.ratingRar * (rarityOf(horse).order || 0) / 4;
    return Math.round(sum + skillPts + growPts);
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

  // Pista em blocos, toda derivada da seed. Ordem das chamadas de rng: distância; depois, a cada
  // tentativa, nº de blocos B, pesos (B) e tipos (B-2); por fim superfície e clima.
  function randomConditions(seed) {
    var rng = mulberry32(hash2(seed, 0xC0FFEE));
    var nd = Math.floor((T.distMax - T.distMin) / T.distStep) + 1;
    var distance = T.distMin + T.distStep * Math.floor(rng() * nd);
    // re-sorteia os blocos (no mesmo fluxo) até a pista ter curva e subida e nenhum tipo acima de
    // trackMaxShare; sem sucesso em trackTries tentativas, entra o molde fixo
    var blocks = null;
    for (var tr = 0; tr < T.trackTries && !blocks; tr++) {
      var B = 5 + Math.floor(rng() * 5);
      var weights = [], total = 0, i;
      for (i = 0; i < B; i++) { weights.push(0.5 + rng()); total += weights[i]; }
      var bl = [], acc = 0, from = 0, to;
      for (i = 0; i < B; i++) {
        acc += weights[i];
        // fronteiras acumuladas arredondadas a 10 m; o último bloco fecha em `distance`
        to = (i === B - 1) ? distance : Math.round(distance * acc / total / 10) * 10;
        var type = (i === 0 || i === B - 1) ? 'reta' : BLOCK_LIST[Math.floor(rng() * 3)];
        bl.push({ type: type, from: from, to: to });
        from = to;
      }
      if (trackOk(bl)) blocks = bl;
    }
    if (!blocks) {
      // molde fixo: reta 15%, curva 30%, reta 10%, subida 30%, reta 15% de D (retas 40%, curva e subida
      // 30% cada); fronteiras acumuladas arredondadas a 10 m, o último bloco fecha em D
      var corte = function (f) { return Math.round(distance * f / 10) * 10; };
      var c1 = corte(0.15), c2 = corte(0.45), c3 = corte(0.55), c4 = corte(0.85);
      blocks = [{ type: 'reta', from: 0, to: c1 }, { type: 'curva', from: c1, to: c2 }, { type: 'reta', from: c2, to: c3 },
        { type: 'subida', from: c3, to: c4 }, { type: 'reta', from: c4, to: distance }];
    }
    var surface = SURF_LIST[Math.floor(rng() * 3)];
    var weather = WEATHER_LIST[Math.floor(rng() * 4)];
    return { distance: distance, surface: surface, weather: weather, blocks: blocks };
  }
  // Pista sem extremos: pelo menos uma curva e uma subida, nenhum tipo acima de trackMaxShare.
  function trackOk(bl) {
    var c = blockShare(bl, 'curva'), h = blockShare(bl, 'subida'), r = blockShare(bl, 'reta');
    return c > 0 && h > 0 && c <= T.trackMaxShare && h <= T.trackMaxShare && r <= T.trackMaxShare;
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

  // Distância aceita quando dada: inteiro em 1000–2400 m (a faixa antiga do sorteio, mais larga que a
  // de hoje, T.distMin–T.distMax), para pistas explícitas e o modo DEV.
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
    r.weatherM = m;
    derive(r, r, m, null);
    // skill de tipo com statMul: no seu terço, os dois status do tipo valem × (1 + mul) (valores em r.Z)
    var tsk = r.typeSkill;
    if (tsk && tsk.mul) { var mm = {}; for (var q = 0; q < tsk.keys.length; q++) mm[tsk.keys[q]] = 1 + tsk.mul; r.Z = r.Z || {}; derive(r, r.Z, m, mm); }
  }
  // Valores do corredor que saem dos status: o clima soma (m − 1)·weatherAdd a n (o mesmo efeito em
  // qualquer nível); `mul` multiplica o n de alguns status antes disso.
  function derive(r, o, m, mul) {
    var sn = r.statsN, wd = (m - 1) * T.weatherAdd;
    function nx(k) { return sn[k] * (mul && mul[k] ? mul[k] : 1) + wd; }
    o.vMax = (T.vBase + T.vRange * nx('vel')) * (1 + T.weatherVel * (m - 1));
    // aceleração: 1/accel cai em linha reta com n (cada ponto rende o mesmo na largada)
    o.accel = 1 / Math.max(T.aInvMin, T.aInv0 - T.aInv1 * nx('acel'));
    o.nf = nx('forca');
    o.nm = nx('man');
    o.estN = sn.est * (mul && mul.est ? mul.est : 1);
    var ng = nx('garra');
    o.garraChance = clamp(T.garraChanceBase + T.garraChanceRange * ng + r.garraBonusTotal, 0, T.garraChanceMax);
    o.garraBoost = 1 + T.garraBoostBase + T.garraBoostRange * ng + r.garraBoostBonusTotal;
  }

  // Ordem das chamadas de r.rng() (fluxo próprio de cada corredor; manter estável):
  //   montagem: 1) startDelay, 2) jockeyErr;
  //   por tick: 3) tentativas de skill (só quando um gatilho acontece; na ordem dos gatilhos
  //   start/bloco/clima/lowStamina/final e, dentro de cada gatilho, na ordem da lista de skills),
  //   4) sorteio da Garra (uma vez, ao cruzar r.garraFrom), 5) jitter.
  //   A skill de tipo não consome a RNG.
  function buildRacer(entry, index, cond, rng) {
    var horse = entry.horse;
    // o equipamento não entra na corrida (por enquanto). entry.statAdd: gancho de teste do balance.js
    // (como noTypeSkill): soma ao status, preso a 1–statMax.
    var stats = computeStats(horse);
    if (entry.statAdd && typeof entry.statAdd === 'object') {
      for (var sa = 0; sa < STAT_KEYS.length; sa++) {
        var sk0 = STAT_KEYS[sa], add = Number(entry.statAdd[sk0]);
        if (isFinite(add) && add) stats[sk0] = clamp(Math.round(stats[sk0] + add), 1, T.statMax);
      }
    }
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
      skillChance: skillChance(horse, stats, 0),
      pool: T.poolBase + T.poolEst * statsN.est,   // tanque fixo (sem clima)
      garraBonusTotal: 0,
      garraBoostBonusTotal: 0,
      weatherDouble: false,
      extraDice: 0,
      startDelay: rng() * T.startDelayMax * (1 - T.startAcelK * clamp(statsN.acel, 0, T.startAcelMax)),
      jockeyErr: T.jockeyErrMin + rng() * (T.jockeyErrMax - T.jockeyErrMin),
      rng: rng,
      skills: skills,
      started: false,
      blockIdx: -1,
      tried: {},
      effects: [],
      pos: 0, v: 0, stamina: 1,
      exhausted: false, finished: false, finishTime: null,
      garraRolled: false, garraMult: 1,
      // início da arrancada: garraZone, adiantado pela Garra (garraZoneK por unidade de n, centrado em 50)
      garraFrom: clamp(T.garraZone - T.garraZoneK * (statsN.garra - 0.5), 0.5, 0.95),
      typeSkill: null
    };
    // skill de tipo: sempre ativa no terço [zone[0]·D, zone[1]·D), força typePower; montada sem RNG.
    // entry.noTypeSkill desliga (comparações do balance.js).
    var ts = entry.noTypeSkill ? null : typeSkill(horse);
    if (ts) {
      var te = ts.effect, P = ts.power, D = cond.distance;
      var from = ts.zone[0] * D, to = ts.zone[1] * D;
      r.typeSkill = { id: ts.id, name: ts.name, from: from, to: to, restore: (te.staminaRestore || 0) * P, entered: false,
        mul: (te.statMul || 0) * P, keys: te.statKeys || TYPE_STATS[horse.element] };
      r.effects.push({
        untilT: null, fromPos: from, untilPos: ts.zone[1] >= 1 ? null : to,
        speedMult: 1 + (te.speedMult || 0) * P,
        accelMult: 1 + (te.accelMult || 0) * P,
        drainMult: Math.max(0.05, 1 - (te.drainCut || 0) * P),
        curveBonus: 0, hillBonus: 0, hillDrainMult: 1,
        forcaAdd: (te.forcaAdd || 0) * P,
        manAdd: (te.manAdd || 0) * P
      });
    }
    applyWeather(r, cond.weather);
    return r;
  }

  // Dado da Sorte de uma montaria. Ordem das chamadas de rng() (manter estável): d1, sorteio do
  // 2º dado (sempre consumido, mesmo com sorte 0 ou 100), d2 (se houver), dado extra (Dado Viciado).
  // Chance de rolar o 2º dado e ficar com o melhor = (sorte − sorteDiceLo)/(sorteDiceFull − sorteDiceLo), presa a
  // 0–1 (Sorte 40 → 0, 60 → 0,5, 80 ou mais → 1); extraDice limitado a 1 (até 3 dados).
  function rollDice(rng, sorte, extraDice) {
    var dice = [1 + Math.floor(rng() * 100)];
    var p = clamp(((sorte || 0) - T.sorteDiceLo) / (T.sorteDiceFull - T.sorteDiceLo), 0, 1);
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
        if (p >= r.garraFrom) trigger(r, 'final', tPrev, pos, blk.to);   // reta final = início da arrancada do cavalo

        // skill de tipo: entrada no terço (uma vez): recupera estamina (se não estiver exausto) e narra
        var tsk = r.typeSkill;
        if (tsk && !tsk.entered && pos >= tsk.from) {
          tsk.entered = true;
          if (tsk.restore && !r.exhausted) r.stamina = Math.min(1, r.stamina + tsk.restore);
          events.push({ t: r2(tPrev), racer: r.index, type: 'skill', text: r.label + ' ativou ' + tsk.name + '!', typeSkill: true });
        }
        // no terço da skill de tipo (statMul), os valores dos dois status do tipo vêm de r.Z
        var Z = (tsk && tsk.mul && pos >= tsk.from && pos < tsk.to) ? r.Z : r;

        // efeitos ativos (fromPos/untilPos: trecho da pista onde valem)
        var effSpeed = 1, effAccel = 1, effDrain = 1, curveBonus = 0, hillBonus = 0, hillDrainMult = 1, forcaAdd = 0, manAdd = 0;
        for (var e = 0; e < r.effects.length; e++) {
          var fx = r.effects[e];
          if ((fx.untilT == null || tPrev < fx.untilT) && (fx.untilPos == null || pos < fx.untilPos) && (fx.fromPos == null || pos >= fx.fromPos)) {
            effSpeed *= fx.speedMult; effAccel *= fx.accelMult; effDrain *= fx.drainMult;
            curveBonus += fx.curveBonus; hillBonus += fx.hillBonus; hillDrainMult *= fx.hillDrainMult;
            if (fx.forcaAdd) forcaAdd += fx.forcaAdd;
            if (fx.manAdd) manAdd += fx.manAdd;
          }
        }

        // Garra
        if (!r.garraRolled && p >= r.garraFrom) {
          r.garraRolled = true;
          if (r.rng() < Z.garraChance) {
            r.garraMult = Z.garraBoost;
            ev(tPrev, i, 'garra', r.label + ' mostrou GARRA na reta final!');
          }
        }

        // terreno e bloco
        var nf = clamp(Z.nf + forcaAdd, 0, T.nEffMax), nm = clamp(Z.nm + manAdd, 0, T.nEffMax);
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
          speedMod *= 1 - T.crowdSlow * Math.min(neighbors, 3) / 3 * Math.max(0, 1 - T.forcaCrowdRelief * nf);
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
          var vRef = Z.vMax * speedMod;
          var aff = affordablePace(r.stamina + r.jockeyErr - T.rationReserve, rem, vRef, r.pool, cEst);
          // teto do ritmo: o da fase, mais o da Estamina (centrado em 50: midEst/spurtEst por unidade de n)
          var capS = p < T.pace.spurtStart ? T.pace.mid + T.pace.midEst * (Z.estN - 0.5) : T.pace.spurtCap + T.pace.spurtEst * (Z.estN - 0.5);
          s = Math.min(capS, aff);
          s = Math.max(s, T.minPace);
        }

        var boost = effSpeed * r.garraMult;
        var jitter = 1 + (r.rng() - 0.5) * T.tickJitter;
        var vTarget = s * Z.vMax * speedMod * fatorBloco * boost * jitter;

        if (r.v < vTarget) r.v = Math.min(vTarget, r.v + Z.accel * effAccel * dt);
        else r.v = Math.max(vTarget, r.v - T.decel * dt);

        // gasto de estamina (boosts não custam)
        if (!r.exhausted) {
          // na subida o fatorBloco é esforço, não descanso: sem dividir por ele, quem é lento na
          // subida gasta menos estamina e recupera no fim (o especialista de Força perdia na subida)
          var sEff = r.v / (Z.vMax * boost * (blk.type === 'subida' ? fatorBloco : 1));
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
        name: r.name, horseName: r.horseName, stats: r.stats, skillChance: r.skillChance,
        typeSkill: r.typeSkill ? { id: r.typeSkill.id, name: r.typeSkill.name, from: r.typeSkill.from, to: r.typeSkill.to } : null
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
    TYPE_STATS: TYPE_STATS,
    mulberry32: mulberry32,
    hash2: hash2,
    computeStats: computeStats,
    starsOf: starsOf,
    freePoints: freePoints,
    pointCost: pointCost,
    costOf: costOf,
    maxBuy: maxBuy,
    weightedAlloc: weightedAlloc,
    naturalStat: naturalStat,
    validAlloc: validAlloc,
    allocInfo: allocInfo,
    typePower: typePower,
    typeSkill: typeSkill,
    powerRating: powerRating,
    botAlloc: botAlloc,
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
