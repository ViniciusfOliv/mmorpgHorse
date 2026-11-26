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
 *              + torrões (horse.torroes, inteiro 0–10 = GameData.ITEMS.torrao.cap; fora disso 0; bots não têm)
 *   Sorte não recebe pontos (T.noBuy): fica só com a base, 40–76.
 *   custo    = o i-ésimo ponto comprado num status (i = 0, 1, …) custa 1 + floor(i/10) (pointCost);
 *              comprar a pontos custa costOf(a) = 10·q(q+1)/2 + r(q+1), a = 10q + r.
 *   horse.alloc = pontos de status comprados em cada status; validAlloc saneia (inteiros ≥ 0, corta pelo
 *              teto base + a ≤ 150 e depois pelo custo total ≤ pontos, na ordem de STAT_KEYS).
 *   computeStats: status = round(base + a), limitado a 1–150. O equipamento não entra (por enquanto).
 *   n(x) = status/100. allocInfo(horse): { free, used (custo gasto), left, perStat, next (custo do
 *   próximo ponto), room (quantos pontos ainda cabem) }.
 *   powerRating = round(2,5·VEL + 2,0·ACE + 2,2·MAN + 2,4·FOR + 2,4·EST + 1,5·GAR + 0·SOR
 *   + 14 × peso do gatilho (skillWeight) × fator do rank (rankScale) por skill + 20·(nível−1)/49 + 28·ordemDaRaridade/4); ligas em GameData.LEAGUES.
 *   weightedAlloc(horse, w, from): um ponto por vez no status de menor (a+1)/w que ainda cabe.
 *   botAlloc(horse, from): weightedAlloc com T.botW[tipo] (os seis valem 1; × 1,2 nos dois status do tipo);
 *   sem RNG; com `from` continua a distribuição do jogador ("Distribuir sugerido").
 *   entry.statMul (vantagem de elemento nos duelos de ginásio; ginasio.js): número de 0,9 a 1,1 que multiplica os
 *   seis status de corrida (todos menos a Sorte), arredondado e preso a 1–150, antes do statAdd; ausente,
 *   inválido ou fora da faixa vale 1 (a corrida é a de sempre).
 *   entry.statAdd (o principal das peças no treino AFK, afk.js; e gancho de teste do balance.js, como noTypeSkill):
 *   soma ao status, arredondado e preso a 1–150. entry.pve (só o treino AFK): os bônus de clima do conjunto (ver applyWeather).
 *   O PVP nunca passa statAdd nem pve: o equipamento não entra na corrida valendo nem no Poder.
 *
 * CLIMA (sol / chuva / nevoa / nublado). weatherMult(elemento, clima, bônus):
 *   dono do clima ×1,03 (T.weatherMult; com a skill de clima ativa, × (1,03 + weatherBonus do rank)),
 *   elemento penalizado ×0,97 (2 − weatherMult), resto e Nublado ×1.
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
 *   entry.folego (cansaço nos duelos de ginásio; ginasio.js): a estamina inicial (fração do tanque), número de
 *   0,5 a 1; ausente, inválido ou fora da faixa vale 1. O cavalo corre igual no começo e cansa mais cedo (o
 *   jóquei já lê o tanque restante).
 *
 * GARRA: a arrancada começa em garraFrom = 0.80 − 0.14*(n(garra) − 0.5) da pista (mais Garra, mais cedo;
 *   o gatilho 'final' das skills vale no mesmo ponto). Lá a arrancada ACONTECE SEMPRE (não há chance de falhar). A força
 *   média é F = garraBoostBase + garraBoostRange*nc(garra) + bônus de skill; a de cada corrida é F × f, com
 *   f = 1 − garraSpread + 2·garraSpread·rng() (uma chamada da RNG do corredor, na montagem: de 0 a 2× a média com garraSpread 1), e o
 *   teto de velocidade fica ×(1 + F·f) até a chegada. Evento 'garra' (com `forca` = f). A Garra (o status) decide o
 *   quando (começa antes) e o quanto, em média (empurra mais). garraInfo(horse, bonus) dá { from, boost (média),
 *   boostMin, boostMax, tipo } para a tela, sem clima (a ficha do cavalo, aba Skills).
 *
 * SKILLS (gatilhos e efeitos em data.js). Quando o gatilho acontece, a skill ATIVA SEMPRE, sem sorteio e sem
 *   consumir a RNG, uma vez por gatilho (por corrida; por bloco se effect.blockScoped). Gatilhos: start (largada),
 *   straight (entrou numa reta ≥150 m que não é a da largada), curve, curveExit, hill (entrou no bloco),
 *   lowStamina (estamina ≤30%), final (início da arrancada, garraFrom), dice (antes do 1º Dado da Sorte),
 *   weather:<clima> (checado a cada tick com o clima vigente). Chaves de effect: accelMult,
 *   speedMult, drainMult (por distanceM ou durationS), curveBonus, hillBonus, hillDrainMult
 *   (até o fim do bloco), staminaRestore, garraBoostBonus, extraDice,
 *   weatherBonus. O equipamento (Gear.resolve) não entra na corrida por enquanto. Evento 'skill' (com `rank`).
 *   RANK (por cavalo, horse.skillRanks = { id: 1..5 }; rankOf: ausente ou inválido = 1): o efeito de cada skill é
 *   skillEffect(id, rank, entry.skillScale), com o fator s(r) = 1 + 0,15·(r − 1) (rankScale) só na parte de bônus:
 *   multiplicador que ajuda 1 + (m − 1)·s; de gasto 1 − (1 − m)·s (piso 0,05); bônus somado, recuperação e reforço
 *   do clima b·s; o dado extra do Dado Viciado rola de 1 até SKILL_RANKS.diceTeto[r − 1]. Duração e distância não
 *   crescem. No rank 5 entra o marco (SKILLS[id].rank5): Arranque também velocidade; Sprint em reta ≥100 m; Drift
 *   gasta menos na curva; Saída Rápida e Chama Final duram mais; Fôlego de Montanha recupera ao sair da subida;
 *   Segundo Ar dispara com 35%; Arrancada Final também velocidade até a chegada; Dado Viciado 2 dados extras;
 *   skills de clima: o multiplicador reforçado continua por 15 s depois de o clima mudar; Canto da Iara recupera
 *   ao ativar; Nascente também velocidade; Casco Firme gasta menos na subida. entry.skillScale (1 a 1,1; fora da
 *   faixa vale 1) multiplica o fator do rank (o bônus de 3 peças do conjunto, suspenso, passaria 1,05).
 *   Ao subir de nível (learnSkill(mount, rng, bonus), fora da corrida): aprende se rng() < T.learnChance + bonus
 *   (bonus opcional de 0 a 0,2, a insígnia da Grama; ausente ou inválido vale 0, e a ordem das chamadas não muda).
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
 *   segundo dado ((sorte − 40)/40) e ficar com o melhor; Dado Viciado soma um dado extra de 1 até o teto do rank
 *   (2 extras de 1 a 100 no rank 5; até 4 dados).
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
 * RESULTADO: { seed, simVersion (RaceSim.VERSION), tuningHash (impressão digital do TUNING e dos
 *   dados de skills/raridades/clima usados), conditions (iniciais normalizadas), weatherFinal (clima
 *   depois dos Dados), dt, duration, frames, events, finishOrder, finishTimes,
 *   racerInfo[i] = { name, horseName, stats, skillRanks: { id: rank }, typeSkill: { id, name, from, to } (metros) | null } }.
 *
 * ENTRADAS MALFORMADAS: level e potencial passam por sanitizeLevel/sanitizePotential (Number;
 *   não finito vale 1 / 0; level inteiro 1–50, potencial 0–31), em computeStats;
 *   grau por starsOf (não numérico vale 2, fora da faixa é preso a 1–3); alloc por validAlloc.
 *
 * ORDEM DAS CHAMADAS DE r.rng() (fluxo de cada corredor; manter estável):
 *   montagem: 1) startDelay, 2) jockeyErr, 3) a força da Garra; por tick: 4) jitter.
 *   As skills (de vaga e de tipo) não chamam r.rng().
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
  var VERSION = '4.1.0';

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
    // clima: dono m = 1,03 (1,08 com skill de clima), penalizado 0,97. O m NÃO multiplica o status: entra como soma
    // fixa em n: n + (m − 1)·weatherAdd, ou seja +1,5 ponto de status (com a skill de clima, +3,5 no rank I a +4,7 no rank V), o mesmo em qualquer nível (D3);
    // weatherVel: fração extra do desvio que vai direto na vMax
    weatherMult: 1.03, weatherMultDouble: 1.08, weatherVel: 0.10, weatherAdd: 0.5,
    // garra: a arrancada começa em garraZone − garraZoneK·(n − 0,5) da pista; chance e força crescem com n
    garraZone: 0.8, garraZoneK: 0.14,
    garraBoostBase: 0, garraBoostRange: 0.19, garraSpread: 1,   // força média; a de cada corrida vai de (1 − spread) a (1 + spread) vezes ela
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
  // início da faixa de nascimento, multiplicador de pontos e ordem; ranks das skills; skills de tipo: terço e efeito; elementos,
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
      skills: pick(GameData.SKILLS, ['element', 'trigger', 'effect', 'rank5']),
      ranks: GameData.SKILL_RANKS,
      rarities: pick(GameData.RARITIES, ['ptsMult', 'baseLo', 'order']),
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
  // Saneamento único de level e potencial (computeStats): vira número; não finito
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
  // Depois do piso, somam-se os Torrões de açúcar do cavalo (horse.torroes: inteiro de 0 ao teto do item;
  // fora disso, não numérico ou ausente vale 0). Os bots não têm torrões.
  function freePoints(horse) {
    var fr = rarityOf(horse).ptsMult || 1, L = sanitizeLevel(horse.level), M = GameData.ECONOMY.maxLevel || 50;
    var r0 = T.ptsRate0, r1 = T.ptsRate1;
    var base = (L - 1) * r0 + (r1 - r0) * (L - 1) * (L - 2) / (2 * (M - 2));
    return Math.floor(base * fr * T.starMult[starsOf(horse) - 1] + 1e-9) + torroesOf(horse);
  }
  function torroesOf(horse) {
    var t = horse && horse.torroes, cap = GameData.ITEMS.torrao.cap;
    return typeof t === 'number' && t === Math.floor(t) && t >= 0 && t <= cap ? t : 0;
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
  // Cada habilidade vale T.ratingSkillPts (14) × o peso do seu gatilho × o fator do rank dela (rankScale; o marco
  // do rank 5 não soma à parte); nível e raridade somam
  // T.ratingLevel·(nível − 1)/49 + T.ratingRar·ordem/4 (o mesmo para os três tipos).
  // Para curva, subida e estamina baixa o peso segue a
  // chance de o gatilho acontecer numa corrida típica; clima (0.8) é peso calibrado no pacote de balanceamento, não
  // chance (vale 0.8 mesmo sem acontecer sempre). 'dice' vale 0 desde a D8 (2026-11-26): o Dado extra só mexe na virada
  // de clima (0,2–1,5 p.p. de vitória), e o Dado Viciado saía caro no Poder sem render na corrida (era 0.2).
  // Exposto como RaceSim.SKILL_TRIGGER_WEIGHT; 'weather' vale para todo gatilho 'weather:<clima>'.
  // O sim-test confere que todo gatilho usado em GameData.SKILLS tem peso aqui (o fallback 1 é só defesa).
  var SKILL_TRIGGER_WEIGHT = { start: 1, straight: 1, curve: 0.8, curveExit: 0.8, hill: 0.6, lowStamina: 0.8, final: 1, dice: 0, weather: 0.8 };
  function skillWeight(id) {
    var sk = GameData.SKILLS[id];
    if (!sk) return 0;
    var trig = sk.trigger || '';
    if (trig.indexOf('weather:') === 0) trig = 'weather';
    return SKILL_TRIGGER_WEIGHT[trig] != null ? SKILL_TRIGGER_WEIGHT[trig] : 1;
  }
  // ---------------------------------------------------------------------------
  // Ranks das skills de vaga (GameData.SKILL_RANKS): por cavalo, em horse.skillRanks = { id: 1..5 }.
  // ---------------------------------------------------------------------------
  // Fator do rank: 1 + step × (r − 1). Número fora de 1..max é preso à faixa; o que não é número vale 1.
  function rankScale(r) {
    var K = GameData.SKILL_RANKS;
    var n = (typeof r === 'number' && isFinite(r)) ? clamp(Math.floor(r), 1, K.max) : 1;
    return 1 + K.step * (n - 1);
  }
  // Rank de uma skill do cavalo: inteiro de 1 a max; ausente ou inválido vale 1.
  function rankOf(horse, id) {
    var v = horse && horse.skillRanks ? horse.skillRanks[id] : null;
    return (typeof v === 'number' && v % 1 === 0 && v >= 1 && v <= GameData.SKILL_RANKS.max) ? v : 1;
  }
  // Efeito de uma skill num rank: objeto novo (não muta GameData.SKILLS). O fator f = rankScale(rank) × extraScale
  // age só na parte de bônus: multiplicador que ajuda 1 + (m − 1)·f; multiplicador de gasto 1 − (1 − m)·f (piso 0,05);
  // bônus somado, recuperação e reforço de clima b·f. Duração e distância não mudam. O Dado Viciado ganha diceTeto
  // (o teto do dado extra, pelo rank). No rank máximo entra o marco (SKILLS[id].rank5): durationS, lowStaminaAt,
  // minStraightM, exitRestore, weatherLingerS, untilFinish e extraDice substituem; multiplicadores se multiplicam;
  // staminaRestore e os bônus somados somam.
  var RANK_MULT_UP = { speedMult: 1, accelMult: 1 }, RANK_MULT_DOWN = { drainMult: 1, hillDrainMult: 1 };
  var RANK_ADD = { curveBonus: 1, hillBonus: 1, garraBoostBonus: 1, staminaRestore: 1, weatherBonus: 1 };
  function skillEffect(id, rank, extraScale) {
    var sk = GameData.SKILLS[id];
    if (!sk) return {};
    var K = GameData.SKILL_RANKS, base = sk.effect || {}, out = {};
    var r = (typeof rank === 'number' && isFinite(rank)) ? clamp(Math.floor(rank), 1, K.max) : 1;
    var x = (typeof extraScale === 'number' && extraScale >= 1 && extraScale <= 1.1) ? extraScale : 1;
    var f = rankScale(r) * x;
    Object.keys(base).forEach(function (k) {
      var v = base[k];
      if (RANK_MULT_UP[k]) out[k] = 1 + (v - 1) * f;
      else if (RANK_MULT_DOWN[k]) out[k] = Math.max(0.05, 1 - (1 - v) * f);
      else if (RANK_ADD[k]) out[k] = v * f;
      else out[k] = v;
    });
    if (out.extraDice) out.diceTeto = K.diceTeto[r - 1];
    if (r >= K.max && sk.rank5) {
      Object.keys(sk.rank5).forEach(function (k) {
        var v = sk.rank5[k];
        if (RANK_MULT_UP[k] || RANK_MULT_DOWN[k]) out[k] = (out[k] == null ? 1 : out[k]) * v;
        else if (RANK_ADD[k]) out[k] = (out[k] || 0) + v;
        else out[k] = v;
      });
    }
    return out;
  }
  // Rank dos bots de uma sala: a média arredondada dos ranks das skills de vaga do cavalo do jogador (1 sem skill),
  // sem sorteio. A sala espelha o investimento do jogador.
  function botRank(horse) {
    var ids = ((horse && horse.skills) || []).filter(function (id) { return !!GameData.SKILLS[id]; });
    if (!ids.length) return 1;
    var soma = 0;
    ids.forEach(function (id) { soma += rankOf(horse, id); });
    return clamp(Math.round(soma / ids.length), 1, GameData.SKILL_RANKS.max);
  }
  // Cópia do cavalo com todas as skills de vaga no rank dado (bots da sala, oponentes dos ginásios, testes).
  function withRanks(horse, rank) {
    var h = JSON.parse(JSON.stringify(horse)), K = GameData.SKILL_RANKS;
    var r = (typeof rank === 'number' && isFinite(rank)) ? clamp(Math.floor(rank), 1, K.max) : 1;
    h.skillRanks = {};
    (h.skills || []).forEach(function (id) { if (GameData.SKILLS[id]) h.skillRanks[id] = r; });
    return h;
  }
  // Texto da skill com os números do rank (a desc de GameData.SKILLS é a do rank 1; o sim-test confere).
  function pctBr(x) { var v = Math.round(x * 1000) / 10; return String(v).replace('.', ',') + '%'; }
  function numBr(x) { return String(Math.round(x * 10) / 10).replace('.', ','); }
  function skillDesc(id, rank, extraScale) {
    var sk = GameData.SKILLS[id];
    if (!sk) return '';
    var e = skillEffect(id, rank, extraScale);
    var up = function (m) { return '+' + pctBr(m - 1); }, cut = function (m) { return pctBr(1 - m); };
    var reta = 'Numa reta de ' + (e.minStraightM || T.straightMinM) + ' m ou mais (fora a da largada): ';
    switch (id) {
      case 'arranque': return 'Largada explosiva: ' + up(e.accelMult) + ' de aceleração' + (e.speedMult ? ' e ' + up(e.speedMult) + ' de velocidade' : '') + ' nos primeiros ' + e.distanceM + ' m.';
      case 'sprint': return reta + up(e.speedMult) + ' de velocidade por ' + e.distanceM + ' m.';
      case 'drift': return 'Em cada curva: +' + pctBr(e.curveBonus) + ' de rendimento na curva' + (e.drainMult ? ' e ' + cut(e.drainMult) + ' menos gasto de estamina' : '') + '.';
      case 'saida-rapida': return 'Ao sair da curva: ' + up(e.accelMult) + ' de aceleração e ' + up(e.speedMult) + ' de velocidade por ' + numBr(e.durationS) + 's.';
      case 'folego-de-montanha': return 'Em cada subida: gasta ' + cut(e.hillDrainMult) + ' menos estamina extra da subida' + (e.exitRestore ? ' e, ao sair dela, recupera ' + pctBr(e.exitRestore) : '') + '.';
      case 'segundo-ar': return 'Quando a estamina cai a ' + pctBr(e.lowStaminaAt || T.lowStaminaAt) + ', recupera ' + pctBr(e.staminaRestore) + ' e ganha ' + up(e.speedMult) + ' de velocidade por ' + numBr(e.durationS) + 's.';
      case 'arrancada-final': return 'Na reta final: +' + pctBr(e.garraBoostBonus) + ' de força na arrancada de Garra' + (e.speedMult ? ', e ' + up(e.speedMult) + ' de velocidade até a chegada' : '') + '.';
      case 'dado-viciado': return 'Antes do 1º Dado da Sorte: rola ' + (e.extraDice > 1 ? e.extraDice + ' dados extras' : '1 dado extra') + ', de 1 a ' + e.diceTeto + ', em todos os Dados da corrida.';
      case 'sol-a-pino': case 'pe-na-chuva': case 'nevoa-amiga':
        var cl = { 'sol-a-pino': ['sol', 'o Fogo'], 'pe-na-chuva': ['chuva', 'a Água'], 'nevoa-amiga': ['névoa', 'a Grama'] }[id];
        return 'Com ' + cl[0] + ': o bônus do clima para ' + cl[1] + ' sobe de ' + up(T.weatherMult) + ' para ' + up(T.weatherMult + e.weatherBonus) +
          (e.weatherLingerS ? ' e continua por ' + e.weatherLingerS + 's depois que o clima muda' : '') + '.';
      case 'chama-final': return 'Na reta final: ' + up(e.speedMult) + ' de velocidade por ' + numBr(e.durationS) + 's.';
      case 'canto-da-iara': return 'Na reta final: ' + up(e.speedMult) + ' de velocidade e ' + cut(e.drainMult) + ' menos gasto de estamina por ' + numBr(e.durationS) + 's' + (e.staminaRestore ? ', e recupera ' + pctBr(e.staminaRestore) + ' de estamina ao ativar' : '') + '.';
      case 'nascente': return reta + 'recupera ' + pctBr(e.staminaRestore) + ' de estamina' + (e.speedMult ? ' e ganha ' + up(e.speedMult) + ' de velocidade por ' + numBr(e.durationS) + 's' : '') + '.';
      case 'casco-firme': return 'Em cada subida: +' + pctBr(e.hillBonus) + ' de rendimento na subida' + (e.hillDrainMult ? ' e gasta ' + cut(e.hillDrainMult) + ' menos estamina extra' : '') + '.';
    }
    return sk.desc;
  }

  // O marco do rank 5 de uma skill, numa frase (com os números de SKILLS[id].rank5).
  function skillMarcoDesc(id) {
    var sk = GameData.SKILLS[id], m = sk && sk.rank5, e = sk && sk.effect;
    if (!m) return '';
    var up = function (x) { return '+' + pctBr(x - 1); }, cut = function (x) { return pctBr(1 - x); };
    switch (id) {
      case 'arranque': return 'também ' + up(m.speedMult) + ' de velocidade nos mesmos ' + e.distanceM + ' m';
      case 'sprint': return 'dispara também em retas de ' + m.minStraightM + ' m ou mais';
      case 'drift': return 'na curva, também gasta ' + cut(m.drainMult) + ' menos estamina';
      case 'saida-rapida': case 'chama-final': return 'dura ' + numBr(m.durationS) + 's em vez de ' + numBr(e.durationS) + 's';
      case 'folego-de-montanha': return 'ao sair da subida, recupera ' + pctBr(m.exitRestore) + ' de estamina';
      case 'segundo-ar': return 'dispara com ' + pctBr(m.lowStaminaAt) + ' de estamina em vez de ' + pctBr(T.lowStaminaAt);
      case 'arrancada-final': return 'também ' + up(m.speedMult) + ' de velocidade até a chegada';
      case 'dado-viciado': return m.extraDice + ' dados extras, os dois de 1 a ' + GameData.SKILL_RANKS.diceTeto[GameData.SKILL_RANKS.max - 1];
      case 'sol-a-pino': case 'pe-na-chuva': case 'nevoa-amiga': return 'o reforço continua por ' + m.weatherLingerS + 's depois que o clima muda';
      case 'canto-da-iara': return 'também recupera ' + pctBr(m.staminaRestore) + ' de estamina ao ativar';
      case 'nascente': return 'também ' + up(m.speedMult) + ' de velocidade por ' + numBr(m.durationS) + 's';
      case 'casco-firme': return 'na subida, também gasta ' + cut(m.hillDrainMult) + ' menos estamina extra';
    }
    return '';
  }
  // A Garra de um cavalo, para a tela (fora da corrida, sem clima): onde a arrancada começa (fração da pista), a chance e
  // o teto da velocidade se ela der certo. As contas são as da corrida (buildRacer e derive): se a arrancada começa dentro
  // do terço da skill de tipo que multiplica a Garra (a Maré Alta, da Água), vale a Garra do terço (tipo: true).
  // bonus (opcional): { boost } somado como o de uma skill que ativou (a Arrancada Final).
  function garraInfo(horse, bonus) {
    var stats = computeStats(horse), n = stats.garra / 100, ng = n;
    var from = clamp(T.garraZone - T.garraZoneK * (n - 0.5), 0.5, 0.95);
    var ts = typeSkill(horse);
    if (ts && ts.effect.statMul && from >= ts.zone[0] && from < ts.zone[1]) {
      var keys = ts.effect.statKeys || TYPE_STATS[horse.element];
      if (keys && keys.indexOf('garra') >= 0) ng = n * (1 + ts.effect.statMul * ts.power);
    }
    var bb = (bonus && Number(bonus.boost)) || 0;
    return {
      from: from,
      boost: 1 + T.garraBoostBase + T.garraBoostRange * ng + bb,
      boostMin: 1 + (T.garraBoostBase + T.garraBoostRange * ng + bb) * (1 - T.garraSpread),
      boostMax: 1 + (T.garraBoostBase + T.garraBoostRange * ng + bb) * (1 + T.garraSpread),
      tipo: ng !== n
    };
  }

  // Skills que a montaria pode aprender: as gerais e as do elemento dela, menos as que já tem, na ordem de
  // GameData.SKILLS (a skill de tipo não está lá: nunca é candidata). Usada pelo nível, pelo Cupom e pelo Manual.
  function skillCandidates(mount) {
    var owned = (mount && mount.skills) || [], el = mount && mount.element, cands = [];
    Object.keys(GameData.SKILLS).forEach(function (id) {
      var sk = GameData.SKILLS[id];
      if (sk.element !== 'geral' && sk.element !== el) return;
      if (owned.indexOf(id) >= 0) return;
      cands.push(id);
    });
    return cands;
  }
  // Sorteia uma skill nova ao subir de nível (ou null). Não muta a montaria.
  // Ordem das chamadas de rng: 1) portão de T.learnChance (+ bonus), 2) escolha do candidato.
  // bonus (opcional; a insígnia da Grama): número de 0 a 0,2 somado à chance; ausente ou inválido vale 0.
  function learnSkill(mount, rng, bonus) {
    var rar = rarityOf(mount);
    var owned = mount.skills || [];
    if (owned.length >= rar.skillSlots) return null;
    var b = typeof bonus === 'number' && bonus >= 0 && bonus <= 0.2 ? bonus : 0;
    if (rng() >= T.learnChance + b) return null;
    var cands = skillCandidates(mount);
    if (!cands.length) return null;
    return cands[Math.floor(rng() * cands.length)];
  }
  function powerRating(horse) {
    var s = computeStats(horse);
    var skillPts = 0;
    (horse.skills || []).forEach(function (id) { skillPts += T.ratingSkillPts * skillWeight(id) * rankScale(rankOf(horse, id)); });
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

  // Multiplicador de clima de um elemento: dono do clima => T.weatherMult + bonus (o reforço da skill de clima
  // ativa, weatherBonus do rank; `true` = T.weatherMultDouble, o reforço das 4 peças do conjunto, hoje suspenso:
  // os dois não acumulam, vale o maior); elemento penalizado => 2 - T.weatherMult (0,97); senão 1.
  function weatherMult(element, weather, bonus) {
    var w = GameData.WEATHERS[weather];
    var el = GameData.ELEMENTS[element];
    if (!w || !el) return 1;
    if (el.weather === weather) return bonus === true ? T.weatherMultDouble : T.weatherMult + (typeof bonus === 'number' && bonus > 0 ? bonus : 0);
    if (w.penalizes === element) return 2 - T.weatherMult;
    return 1;
  }

  // (Re)calcula os números do corredor que dependem do clima. Pode ser chamada de novo no meio da
  // corrida (troca de clima, skill que reforça o bônus, bônus de Garra): só lê statsN e os totais.
  function applyWeather(r, weather) {
    // marco das skills de clima (weatherLingerS): depois que o clima muda, o multiplicador reforçado continua
    // valendo até r.lingerUntil (o laço da corrida limpa e chama applyWeather de novo)
    var m = r.lingerUntil != null ? r.lingerM : weatherMult(r.element, weather, r.weatherBonus);
    // conjunto de equipamento, só no treino AFK (entry.pve): 5 peças tiram a penalidade de clima; 4, no clima do conjunto, o
    // bônus do elemento dono sobe para pve.mult (não acumula com a skill de clima: vale o maior)
    var pv = r.pve;
    if (pv) {
      if (pv.semPenalidade && m < 1) m = 1;
      if (pv.clima === weather && pv.mult > m && (GameData.ELEMENTS[r.element] || {}).weather === weather) m = pv.mult;
    }
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
    o.garraBoost = 1 + T.garraBoostBase + T.garraBoostRange * ng + r.garraBoostBonusTotal;
  }

  // Ordem das chamadas de r.rng() (fluxo próprio de cada corredor; manter estável):
  //   montagem: 1) startDelay, 2) jockeyErr;
  //   3) garraForca (a força da Garra nesta corrida; ela acontece sempre, ao cruzar r.garraFrom); por tick: 4) jitter.
  //   As skills de vaga e a skill de tipo não consomem a RNG (a ativação não é sorteada).
  // entry.pve (só o treino AFK passa; o PVP nunca): { clima: id do clima do conjunto | null, mult: 1–1,1, semPenalidade }.
  // Ausente ou inválido: null (a corrida é a de sempre).
  function pveDe(p) {
    if (!p || typeof p !== 'object') return null;
    var clima = typeof p.clima === 'string' && Object.prototype.hasOwnProperty.call(GameData.WEATHERS, p.clima) ? p.clima : null;
    var mult = typeof p.mult === 'number' && p.mult >= 1 && p.mult <= 1.1 ? p.mult : 1;
    if (!clima && p.semPenalidade !== true) return null;
    return { clima: clima, mult: mult, semPenalidade: p.semPenalidade === true };
  }
  function buildRacer(entry, index, cond, rng) {
    var horse = entry.horse;
    // o equipamento não entra na corrida (por enquanto). entry.statMul (vantagem de elemento do ginásio): 0,9–1,1,
    // multiplica os seis status de corrida (não a Sorte), arredonda e prende a 1–statMax; fora da faixa vale 1.
    // entry.statAdd: gancho de teste do balance.js (como noTypeSkill): soma ao status depois, preso a 1–statMax.
    var stats = computeStats(horse);
    var sm = entry.statMul;
    if (typeof sm === 'number' && sm >= 0.9 && sm <= 1.1 && sm !== 1) {
      for (var sq = 0; sq < STAT_KEYS.length; sq++) {
        if (STAT_KEYS[sq] !== 'sorte') stats[STAT_KEYS[sq]] = clamp(Math.round(stats[STAT_KEYS[sq]] * sm), 1, T.statMax);
      }
    }
    // entry.folego (cansaço do ginásio): a stamina inicial, 0,5–1; fora da faixa vale 1 (tanque cheio).
    var folego = typeof entry.folego === 'number' && entry.folego >= 0.5 && entry.folego <= 1 ? entry.folego : 1;
    if (entry.statAdd && typeof entry.statAdd === 'object') {
      for (var sa = 0; sa < STAT_KEYS.length; sa++) {
        var sk0 = STAT_KEYS[sa], add = Number(entry.statAdd[sk0]);
        if (isFinite(add) && add) stats[sk0] = clamp(Math.round(stats[sk0] + add), 1, T.statMax);
      }
    }
    var statsN = {};
    for (var i = 0; i < STAT_KEYS.length; i++) statsN[STAT_KEYS[i]] = stats[STAT_KEYS[i]] / 100;
    var skills = (horse.skills || []).filter(function (id) { return !!GameData.SKILLS[id]; });
    // efeito pronto de cada skill, pelo rank do cavalo (entry.skillScale: 1–1,1, o bônus de 3 peças do conjunto)
    var skillFx = {}, skillRanks = {}, lowAt = -1;
    skills.forEach(function (id) {
      skillRanks[id] = rankOf(horse, id);
      skillFx[id] = skillEffect(id, skillRanks[id], entry.skillScale);
      if (GameData.SKILLS[id].trigger === 'lowStamina') lowAt = Math.max(lowAt, skillFx[id].lowStaminaAt || T.lowStaminaAt);
    });
    var r = {
      index: index,
      name: entry.name || horse.name,
      horseName: horse.name,
      element: horse.element,
      stats: stats,
      statsN: statsN,
      skillFx: skillFx,
      skillRanks: skillRanks,
      lowAt: lowAt,
      pool: T.poolBase + T.poolEst * statsN.est,   // tanque fixo (sem clima)
      garraBoostBonusTotal: 0,
      weatherBonus: 0, weatherLingerS: 0, lingerUntil: null, lingerM: 1,
      extraDice: 0, diceTeto: 100,
      startDelay: rng() * T.startDelayMax * (1 - T.startAcelK * clamp(statsN.acel, 0, T.startAcelMax)),
      jockeyErr: T.jockeyErrMin + rng() * (T.jockeyErrMax - T.jockeyErrMin),
      // força da Garra nesta corrida: fator de (1 − garraSpread) a (1 + garraSpread) sobre a força média do status
      garraForca: 1 - T.garraSpread + 2 * T.garraSpread * rng(),
      rng: rng,
      skills: skills,
      started: false,
      blockIdx: -1,
      tried: {},
      effects: [],
      pve: pveDe(entry.pve),
      pos: 0, v: 0, stamina: folego,
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
  // 0–1 (Sorte 40 → 0, 60 → 0,5, 80 ou mais → 1); extraDice limitado a 2 (até 4 dados); cada dado extra rola de 1 a
  // diceTeto (inteiro de 1 a 100; ausente ou inválido vale 100).
  function rollDice(rng, sorte, extraDice, diceTeto) {
    var dice = [1 + Math.floor(rng() * 100)];
    var p = clamp(((sorte || 0) - T.sorteDiceLo) / (T.sorteDiceFull - T.sorteDiceLo), 0, 1);
    if (rng() < p) dice.push(1 + Math.floor(rng() * 100));
    var extra = clamp(Math.floor(extraDice || 0), 0, 2);
    var teto = (typeof diceTeto === 'number' && diceTeto >= 1 && diceTeto <= 100) ? Math.floor(diceTeto) : 100;
    for (var k = 0; k < extra; k++) dice.push(1 + Math.floor(rng() * teto));
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

    // O gatilho aconteceu: a skill ativa, sem sorteio. Uma vez por gatilho (por corrida; por bloco se blockScoped).
    // O efeito é o do rank do cavalo (r.skillFx, montado em buildRacer).
    function tryFire(r, id, t, pos, blockTo) {
      var sk = GameData.SKILLS[id];
      var e = r.skillFx[id] || {};
      var key = e.blockScoped ? id + '#' + r.blockIdx : id;
      if (r.tried[key]) return;
      r.tried[key] = true;
      if (e.staminaRestore && !r.exhausted) r.stamina = Math.min(1, r.stamina + e.staminaRestore);
      if (e.extraDice) { r.extraDice = Math.max(r.extraDice, e.extraDice); r.diceTeto = e.diceTeto || 100; }
      var reweather = false;
      if (e.garraBoostBonus) { r.garraBoostBonusTotal += e.garraBoostBonus; reweather = true; }
      if (e.weatherBonus) { r.weatherBonus = Math.max(r.weatherBonus, e.weatherBonus); r.weatherLingerS = e.weatherLingerS || 0; reweather = true; }
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
      events.push({ t: r2(t), racer: r.index, type: 'skill', text: r.label + ' ativou ' + sk.name + '!', rank: r.skillRanks[id] || 1 });
    }

    // Ativa todas as skills do corredor com o gatilho dado (na ordem da lista). `val` é a medida do gatilho, comparada
    // com o limite da própria skill (que o marco do rank 5 pode mudar): o comprimento da reta ('straight': precisa de
    // minStraightM, senão T.straightMinM) ou a estamina ('lowStamina': até lowStaminaAt, senão T.lowStaminaAt).
    function trigger(r, trig, t, pos, blockTo, val) {
      for (var s = 0; s < r.skills.length; s++) {
        var id = r.skills[s];
        if (GameData.SKILLS[id].trigger !== trig) continue;
        var fx = r.skillFx[id];
        if (trig === 'straight' && val < (fx.minStraightM || T.straightMinM)) continue;
        if (trig === 'lowStamina' && val > (fx.lowStaminaAt || T.lowStaminaAt)) continue;
        tryFire(r, id, t, pos, blockTo);
      }
    }
    // Saída da subida: a skill de subida que ativou nesse bloco e tem exitRestore (marco do Fôlego de Montanha) recupera.
    function hillExit(r, bloco) {
      for (var s = 0; s < r.skills.length; s++) {
        var fx = r.skillFx[r.skills[s]];
        if (fx.exitRestore && r.tried[r.skills[s] + '#' + bloco] && !r.exhausted) r.stamina = Math.min(1, r.stamina + fx.exitRestore);
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
          else if (prevB >= 0 && blocks[prevB].type === 'subida') hillExit(r, prevB);
          if (blocks[bi].type === 'curva') trigger(r, 'curve', tPrev, pos, bTo);
          else if (blocks[bi].type === 'subida') trigger(r, 'hill', tPrev, pos, bTo);
          else if (bi > 0) trigger(r, 'straight', tPrev, pos, bTo, blocks[bi].to - blocks[bi].from);
        }
        var blk = blocks[r.blockIdx];
        // clima (checado a cada tick: pode passar a valer quando o clima mudar)
        if (r.lingerUntil != null && tPrev >= r.lingerUntil) { r.lingerUntil = null; applyWeather(r, cond.weatherAtual); }
        trigger(r, 'weather:' + cond.weatherAtual, tPrev, pos, blk.to);
        if (r.stamina <= r.lowAt && !r.exhausted) trigger(r, 'lowStamina', tPrev, pos, blk.to, r.stamina);
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
          // a arrancada acontece sempre: a Garra decide onde ela começa e a força MÉDIA; r.garraForca (sorteada na
          // montagem do corredor) diz se hoje ela veio mais fraca ou mais forte
          r.garraMult = 1 + (Z.garraBoost - 1) * r.garraForca;
          events.push({ t: r2(tPrev), racer: i, type: 'garra', text: r.label + ' mostrou GARRA na reta final!', forca: r2(r.garraForca) });
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
        // gatilho 'dice' (Dado Viciado): ativa antes de rolar (sem sorteio)
        for (i = 0; i < n; i++) trigger(R[i], 'dice', t, R[i].pos, null);
        var rolls = [], cands = [];
        for (i = 0; i < n; i++) {
          var rd = rollDice(diceRng, R[i].stats.sorte, R[i].extraDice, R[i].diceTeto);
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
            var rr = rollDice(diceRng, R[cands[q]].stats.sorte, R[cands[q]].extraDice, R[cands[q]].diceTeto);
            ro.dice = rr.dice; ro.best = rr.best; ro.rerolls++;
          }
        }
        var win = tied[0];
        var wEl = GameData.ELEMENTS[R[win].element];
        var novo = (wEl && wEl.weather) || cond.weatherAtual;
        var changed = novo !== cond.weatherAtual;
        if (changed) {
          var antigo = cond.weatherAtual;
          cond.weatherAtual = novo;
          setWeatherGlobals(novo);
          for (i = 0; i < n; i++) {
            // marco das skills de clima: quem estava com o reforço ativo no clima do seu elemento segura o
            // multiplicador reforçado por weatherLingerS segundos; se o clima voltar a ser o dele, o prazo acaba
            var rw = R[i], dono = GameData.ELEMENTS[rw.element] && GameData.ELEMENTS[rw.element].weather;
            if (dono === novo) rw.lingerUntil = null;
            else if (dono === antigo && rw.weatherBonus > 0 && rw.weatherLingerS > 0 && rw.lingerUntil == null) { rw.lingerUntil = t + rw.weatherLingerS; rw.lingerM = rw.weatherM; }
            applyWeather(rw, novo);
          }
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
        name: r.name, horseName: r.horseName, stats: r.stats, skillRanks: r.skillRanks,
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
    rarityOf: rarityOf,
    torroesOf: torroesOf,
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
    rankScale: rankScale,
    rankOf: rankOf,
    skillEffect: skillEffect,
    skillDesc: skillDesc,
    skillMarcoDesc: skillMarcoDesc,
    botRank: botRank,
    withRanks: withRanks,
    garraInfo: garraInfo,
    weatherMult: weatherMult,
    learnSkill: learnSkill,
    skillCandidates: skillCandidates,
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
