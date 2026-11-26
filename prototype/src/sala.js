/*
 * MMORPG Horse — montagem da sala de corrida valendo (pareamento). Saiu do game.js no T15 sem mudar nada
 * (docs/auditoria/plano-t15.md); a referência de 200 salas em prototype/tools/sala-referencia.json prova isso.
 *
 * DETERMINÍSTICA: só a RNG da seed da sala (mulberry32(hash2(seed, 0xA11CE))), sem Math.random nem Date. A mesma entrada
 * dá a mesma sala, e é isso que impede re-sortear a sala de graça (CLAUDE.md §8). Vai para o servidor com os outros módulos.
 *
 * Sala.montar(e) -> { seed, cond, trackName, n, rivais: [{ nome, horse, seda, rating }], ordem }
 *   e.seed       seed da sala (quem chama faz hash2(seedBase, contador) ou aplica a do modo DEV)
 *   e.pr         Poder do cavalo do jogador quando a sala abriu (o páreo guarda esse valor)
 *   e.cavalo     o cavalo do jogador (só para o rank dos bots, RaceSim.botRank)
 *   e.donos      ids dos modelos do catálogo que o jogador tem: nenhum rival corre com eles
 *   e.nSedas     quantas sedas de bot existem (a seda do rival é um índice de 0 a nSedas − 1)
 *   e.rapido     null ou { alvo: [lo, hi] }: build dos testadores (1º rival Raro, os outros Mágicos, abaixo do jogador)
 *   e.ajustaCond null ou função (cond, seed) -> cond: as condições forçadas do modo DEV
 *   ordem = as raias: índices em [jogador, ...rivais] (0 = o jogador).
 *
 * ORDEM DAS CHAMADAS DA RNG (não mudar: mudaria todas as salas): nome da pista · nº de corredores · embaralhar os nomes
 *   · embaralhar as sedas · por rival: alvo, [testadores: nada a mais], sorteio do equipamento (os bots nunca têm peças,
 *   mas o sorteio continua consumido), escolha entre os candidatos · embaralhar as raias.
 * RIVAIS: alvo = pr × (0,915 + 0,2·u), entre os modelos do catálogo (selvagens + iniciais, sem os do jogador), no nível
 *   de levelBand mais perto do alvo (bestLevelFor), aceitos até 6% do alvo; repete modelo só se não houver outro; sem
 *   ninguém na faixa, os 3 mais perto do alvo em qualquer nível. Pontos pela build fixa dos bots (RaceSim.botAlloc).
 */
(function (root) {
  'use strict';

  var G = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./data.js') : root.GameData;
  var S = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./sim.js') : root.RaceSim;
  var E = G.ECONOMY;

  var NOMES_PISTA = [
    'Prado do Cerrado', 'Hipódromo da Lagoa', 'Raia do Engenho', 'Prado Beira-Rio',
    'Hipódromo do Planalto', 'Raia da Ventania', 'Prado das Palmeiras', 'Hipódromo do Sertão Velho'
  ];

  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // Poder de um modelo do catálogo como bot no nível L e rank r, com os pontos pela build fixa dos bots. É função pura
  // do modelo (fixo no catálogo), do nível e do rank, então fica guardado: sem a memória a sala ficava ~5× mais lenta.
  var poderMemo = {};
  function poderBot(template, L, rank) {
    var k = template.id + '|' + L + '|' + rank;
    if (!hasOwn(poderMemo, k)) {
      var h = S.withRanks(template, rank);
      h.level = L;
      h.alloc = S.botAlloc(h);
      poderMemo[k] = S.powerRating(h);
    }
    return poderMemo[k];
  }
  // o nível do modelo (de lo a hi) com o Poder mais perto do alvo; empate fica com o nível mais baixo
  function bestLevelFor(template, target, lo, hi, rank) {
    var best = lo || 1, bestD = Infinity;
    for (var L = (lo || 1); L <= (hi || E.maxLevel || 50); L++) {
      var d = Math.abs(poderBot(template, L, rank) - target);
      if (d < bestD - 0.5) { bestD = d; best = L; }
    }
    return { level: best, diff: bestD };
  }
  // faixa de nível plausível para um cavalo selvagem: perto do nível em que ele é achado
  function levelBand(tpl) {
    var L0 = tpl.level || 1;
    return [Math.max(1, L0 - 10), Math.min(E.maxLevel || 50, L0 + 20)];
  }

  // o rival escolhido: genética do catálogo, rank dos bots, pontos pela build fixa; nos testadores, abaixo do alvo
  function cavaloRival(choice, rankBots, target, rapido, b) {
    var horse = S.withRanks(choice.tpl, rankBots);
    horse.level = choice.fit.level;
    horse.alloc = S.botAlloc(horse);
    if (rapido && S.powerRating(horse) > target) {
      // o rival (sobretudo o Raro) perde pontos livres até ficar no alvo, abaixo do jogador
      var cheio = horse.alloc, lo = 0, hi = 1;
      var comFator = function (f) { var o = {}; Object.keys(cheio).forEach(function (k) { o[k] = Math.floor(cheio[k] * f); }); return o; };
      for (var it = 0; it < 12; it++) { var mid = (lo + hi) / 2; horse.alloc = comFator(mid); if (S.powerRating(horse) > target) hi = mid; else lo = mid; }
      horse.alloc = comFator(lo);
      // ainda acima sem pontos livres (Raro de genética alta): a genética desce um degrau por vez até o alvo
      var pot = horse.potential = JSON.parse(JSON.stringify(horse.potential));
      for (var desce = 0; desce < 32 && S.powerRating(horse) > target; desce++) Object.keys(pot).forEach(function (k) { pot[k] = Math.max(0, pot[k] - 1); });
    }
    horse.id = choice.tpl.id + '-b' + b;
    return horse;
  }

  function montar(e) {
    var seed = e.seed, rapido = e.rapido || null;
    var rng = S.mulberry32(S.hash2(seed, 0xA11CE));

    var cond = S.randomConditions(seed), trackName = pick(NOMES_PISTA, rng);
    if (e.ajustaCond) cond = e.ajustaCond(cond, seed);
    cond.hills = S.hillsFromBlocks(cond.blocks);
    cond.curves = S.curvesFromBlocks(cond.blocks);

    var n = (E.minRacers || 4) + Math.floor(rng() * ((E.maxRacers || 8) - (E.minRacers || 4) + 1));
    var names = shuffle(G.BOT_NAMES.slice(), rng);
    var owned = {};
    (e.donos || []).forEach(function (id) { if (id) owned[id] = true; });
    var pool = G.WILD_HORSES.concat(G.STARTERS).filter(function (tpl) { return !owned[tpl.id]; });
    var used = {};
    var sedas = [];
    for (var s = 0; s < e.nSedas; s++) sedas.push(s);
    var silkOrder = shuffle(sedas, rng);
    // rank das skills dos bots: a média (arredondada) dos ranks das skills de vaga do jogador, sem sorteio
    var rankBots = S.botRank(e.cavalo);
    var rivais = [];
    for (var b = 0; b < n - 1; b++) {
      // alvo em torno do Poder do jogador; o leve viés para cima mantém a margem da casa também contra bots
      var target = e.pr * (0.915 + 0.2 * rng());
      var poolB = pool;
      if (rapido) {
        target = e.pr * (rapido.alvo[0] + (rapido.alvo[1] - rapido.alvo[0]) * rng());
        var rarB = b === 0 ? 'raro' : 'magico';
        poolB = pool.filter(function (tpl) { return tpl.rarity === rarB; });
        if (!poolB.length) poolB = pool;
      }
      rng();   // sorteio do equipamento do bot: sem efeito (equipamento só no PVE), mas mantém a ordem da RNG
      var inBand = poolB.map(function (tpl) {
        var bd = levelBand(tpl);
        return { tpl: tpl, fit: bestLevelFor(tpl, target, bd[0], bd[1], rankBots) };
      }).filter(function (c) { return c.fit.diff <= target * 0.06; });
      var fresh = inBand.filter(function (c) { return !used[c.tpl.id]; });
      var cands = fresh.length ? fresh : inBand;
      if (!cands.length) {
        // ninguém plausível na faixa: o mais próximo do alvo em qualquer nível
        cands = poolB.map(function (tpl) { return { tpl: tpl, fit: bestLevelFor(tpl, target, null, null, rankBots) }; })
          .sort(function (x, y) { return x.fit.diff - y.fit.diff; }).slice(0, 3);
      }
      var choice = pick(cands, rng);
      used[choice.tpl.id] = true;
      var horse = cavaloRival(choice, rankBots, target, rapido, b);
      rivais.push({ nome: names[b % names.length], horse: horse, seda: silkOrder[b % silkOrder.length], rating: S.powerRating(horse) });
    }
    var ordem = [];
    for (var i = 0; i < n; i++) ordem.push(i);
    shuffle(ordem, rng);   // as raias
    return { seed: seed, cond: cond, trackName: trackName, n: n, rivais: rivais, ordem: ordem };
  }

  var Sala = { montar: montar, poderBot: poderBot, bestLevelFor: bestLevelFor, levelBand: levelBand, NOMES_PISTA: NOMES_PISTA };

  if (typeof module !== 'undefined' && module.exports) module.exports = Sala;
  else root.Sala = Sala;
})(typeof self !== 'undefined' ? self : this);
