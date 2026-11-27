/*
 * MMORPG Horse — a conta do fim da corrida (liquidação do PVP e do treino) e o XP com a skill aprendida no nível. Saiu do
 * game.js no T14 sem mudar nada (docs/auditoria/plano-fase-1.md, grupo F). Vai para o servidor com os outros módulos.
 * prototype/tools/conta-referencia.json guarda 400 liquidações feitas pelo jogo de antes: o --check confere o jogo de
 * agora e este módulo no Node contra elas.
 *
 * DETERMINÍSTICA: a corrida pela seed da sala (RaceSim.simulate), a skill do nível pela seed do save
 * (mulberry32(hash2(seedBase, seedTag·100 + nível))), o Pergaminho e o Selo do pódio pela seed da sala (Itens) e a Pedra
 * Negra do pódio pela seed da sala (Gear). Sem Math.random nem Date: o "agora" do treino AFK chega pela entrada.
 *
 * Conta.aplicarXp(mount, xpGain, o) -> { levels, learned }   (muda o mount: xp, level, skills, skillRanks)
 *   o.seedBase   seed do save · o.seedTag  quem dá o XP (nº do páreo, do desafio, do AFK…) · o.bonusSkill  bônus da
 *   insígnia de Grama na chance de aprender (RaceSim.learnSkill soma learnChance + bônus).
 *   O XP chega já com o bônus da insígnia de Água (quem chama soma: comBonusXp).
 *
 * Conta.liquidar(state, L, o) -> { sim, res }   (muda o state e o corredor do jogador em L, como o settle de antes)
 *   state  o save · L  a sala (buildLobby: seed, cond, racers, playerIdx, training, fee, n)
 *   o.bonus      { ouro, xp, skill } das insígnias (Ginasio.bonus) · o.agoraMin  o "agora" do treino AFK (minutos)
 *   o.gearPvp    peças na corrida valendo (hoje false: a corrida não usa equipamento) · o.playerGear  as peças, se valer
 *   sim = a simulação (quem chama põe em L.sim e desenha as condições); res = o resumo que a tela de resultado mostra.
 */
(function (root) {
  'use strict';
  var node = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  var GD = node ? require('./data.js') : root.GameData;
  var RS = node ? require('./sim.js') : root.RaceSim;
  var GR = node ? require('./gear.js') : root.Gear;
  var IT = node ? require('./itens.js') : root.Itens;

  var E = GD.ECONOMY;
  var MAX_LEVEL = E.maxLevel || 50;
  var STAT_KEYS = GD.STAT_KEYS || ['vel', 'acel', 'man', 'forca', 'est', 'garra', 'sorte'];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function ativo(state) {
    for (var i = 0; i < state.mounts.length; i++) if (state.mounts[i].uid === state.activeId) return state.mounts[i];
    return state.mounts[0];
  }
  function qtd(state, id) {
    if (id === 'redea') return state.redeas;
    return state.mochila && hasOwn(state.mochila, id) ? state.mochila[id] : 0;
  }
  // o prêmio de Ouro mais o bônus da insígnia de Fogo, arredondado para baixo (o 1e-9 só segura o erro do ponto
  // flutuante: 0,03 × 100 não pode dar 2,999…)
  function comBonusOuro(premio, bonus) { return premio + Math.floor(premio * bonus.ouro + 1e-9); }
  // o XP mais o bônus da insígnia de Água, arredondado (todo XP somado a um cavalo passa por aqui uma vez)
  function comBonusXp(xp, bonus) { return xp + Math.round(xp * bonus.xp); }
  // os status que recebem pontos estão no teto (base + pontos ≥ TUNING.statMax)? A Sorte não recebe (TUNING.noBuy).
  function todosNoTeto(h) {
    var cap = RS.TUNING.statMax, a = RS.validAlloc(h, h.alloc), nb = RS.TUNING.noBuy || [];
    return STAT_KEYS.every(function (k) { return nb.indexOf(k) >= 0 || RS.naturalStat(h, k) + a[k] >= cap - 1e-9; });
  }

  // XP ganho -> níveis (até o máximo) e, a cada nível, chance de aprender uma skill (a aprendida entra no rank 1)
  function aplicarXp(mount, xpGain, o) {
    var levels = 0, learned = [];
    mount.xp += xpGain;
    while (mount.level < MAX_LEVEL && mount.xp >= E.xpToLevel(mount.level)) {
      mount.xp -= E.xpToLevel(mount.level);
      mount.level += 1;
      levels += 1;
    }
    if (mount.level >= MAX_LEVEL) mount.xp = Math.min(mount.xp, E.xpToLevel(mount.level));
    for (var k = 1; k <= levels; k++) {
      var lrng = RS.mulberry32(RS.hash2(o.seedBase, o.seedTag * 100 + (mount.level - levels + k)));
      var sid = RS.learnSkill({ id: mount.templateId, element: mount.element, rarity: mount.rarity, skills: mount.skills }, lrng, o.bonusSkill);
      if (sid) { mount.skills.push(sid); mount.skillRanks = IT.sanearRanks(mount.skills, mount.skillRanks); learned.push(sid); }
    }
    return { levels: levels, learned: learned };
  }

  function liquidar(state, L, o) {
    var bonus = o.bonus;
    // o corredor do jogador é o cavalo ativo de agora (a preparação pode ter trocado)
    var eu = L.racers[L.playerIdx];
    eu.horse = clone(ativo(state)); eu.gear = o.gearPvp ? o.playerGear : null;
    var sim = RS.simulate({
      seed: L.seed,
      conditions: L.cond,
      racers: L.racers.map(function (r) {
        return { horse: r.horse, gear: r.gear, name: r.name, isPlayer: r.isPlayer };   // sem peças: o equipamento só vale no treino AFK
      })
    });
    var order = sim.finishOrder;
    var place = order.indexOf(L.playerIdx) + 1;
    var hBefore = clone(ativo(state));
    var before = { level: hBefore.level, xp: hBefore.xp, gold: state.gold, stats: RS.computeStats(hBefore), free: RS.freePoints(hBefore) };
    var pay = null, prize;
    if (L.training) {
      prize = E.trainingGold[place - 1] || 10;
    } else {
      pay = RS.payouts(L.fee, L.n, order);
      var mine = pay.prizes.filter(function (p) { return p.racer === L.playerIdx; })[0];
      prize = comBonusOuro(mine ? mine.amount : 0, bonus);   // o pago (e o mostrado no resultado), com a insígnia de Fogo
    }
    var xpBase = E.xpPerPlace[place - 1] || E.xpPerPlace[E.xpPerPlace.length - 1];
    var xpGain = L.training ? Math.round(xpBase / 2) : xpBase;
    xpGain = comBonusXp(xpGain, bonus);   // com a insígnia de Água (o treino também)

    state.gold = state.gold - L.fee + prize;
    // Pedra Negra do pódio: só em corrida valendo e com peças na corrida (gearPvp), pela seed da sala; desligada, o
    // podiumStone (RNG própria) nem é chamado
    var stone = L.training || !o.gearPvp ? 0 : GR.podiumStone(L.seed, place, L.fee);
    state.pedras += stone;
    // Pergaminho de técnica do pódio: só em corrida valendo, pela seed da sala (RNG própria); com a mochila no teto não entra
    var perg = L.training ? 0 : IT.pergaminhoPodio(L.seed, place), pergCheia = false;
    if (perg && qtd(state, 'pergaminho') + perg > GD.BAG_MAX) { perg = 0; pergCheia = true; }
    state.mochila.pergaminho = qtd(state, 'pergaminho') + perg;
    // Selo do campeão: só o 1º lugar de corrida valendo, pela seed da sala (sal próprio)
    var selo = L.training ? 0 : IT.seloPodio(L.seed, place), seloCheio = false;
    if (selo && qtd(state, 'selo') + selo > GD.ITEMS.selo.cap) { selo = 0; seloCheio = true; }
    state.mochila.selo = qtd(state, 'selo') + selo;
    var gained = aplicarXp(ativo(state), xpGain, { seedBase: state.seedBase, seedTag: state.raceCounter, bonusSkill: bonus.skill });
    state.races += 1;
    if (place === 1) state.wins += 1;
    if (place <= 3) state.podiums += 1;
    if (!L.training) state.goldWon += prize;
    state.pending = null;
    // a sala fechou: a vaga do cavalo ativo no treino AFK volta a contar daqui (o tempo com a sala aberta não conta)
    state.afk.vagas.forEach(function (v) { if (v.uid === state.activeId) v.inicioMin = Math.max(v.inicioMin, o.agoraMin); });

    var hAfter = clone(ativo(state));
    return {
      sim: sim,
      res: {
        place: place, prize: prize, fee: L.fee, training: L.training, payouts: pay, stone: stone, pergaminho: perg, pergCheia: pergCheia, selo: selo, seloCheio: seloCheio,
        xpGain: xpGain, levels: gained.levels, learned: gained.learned,
        before: before,
        after: { level: hAfter.level, xp: hAfter.xp, gold: state.gold, stats: RS.computeStats(hAfter),
          free: RS.freePoints(hAfter), allCap: todosNoTeto(hAfter) }
      }
    };
  }

  var Conta = { liquidar: liquidar, aplicarXp: aplicarXp, comBonusOuro: comBonusOuro, comBonusXp: comBonusXp, todosNoTeto: todosNoTeto };

  if (typeof module !== 'undefined' && module.exports) module.exports = Conta;
  else root.Conta = Conta;
})(typeof self !== 'undefined' ? self : this);
