/*
 * MMORPG Horse — regras da forja (protótipo; spec 2026-11-23-afk-drops §5.6).
 * Módulo PURO: sem DOM, sem estado, sem Math.random e sem relógio; as entradas nunca são mutadas. Os números ficam em
 * GameData.FORJA. Vai para o servidor com os outros módulos de regra.
 *
 * RECEITAS (GameData.FORJA): comum, magico, raro, lendario (peças), pedra (Pedra Negra) e reforja (Pergaminho de
 *   reforja). Cada uma: { mat, inc, trofeu, selo?, ouro }. Tudo sai do GINÁSIO ESCOLHIDO (gymId: fogo = Fornalha,
 *   agua = Remanso, grama = Capoeira):
 *     mat    — a soma dos dois materiais comuns do ginásio. Gasta meio a meio; o ímpar sai do que o jogador tem mais
 *              (empate: o primeiro); se um deles não cobre a metade, o resto sai do outro.
 *     inc    — o material incomum do ginásio.
 *     trofeu — troféus de qualquer oponente do ginásio; sai primeiro do que o jogador tem mais (empate: a etapa menor).
 *     selo   — Selos do campeão (mochila.selo).
 *     ouro   — Ouro LIVRE (quem chama passa o Ouro fora do reservado da sala aberta).
 *   Receita com qualquerGinasio (o Pergaminho de reforja): os materiais comuns somados de TODOS os ginásios e o incomum
 *   de qualquer um, gastos um a um do que o jogador tem mais (empate: a ordem do catálogo); o ginásio escolhido não importa.
 *   Peça Comum e Mágica: solta (sem conjunto), do slot escolhido. Rara e Lendária: do conjunto do ginásio
 *   (GameData.AFK.materiais[gymId].conjunto: Fornalha → Sol, Remanso → Chuva, Capoeira → Névoa). Pedra e Pergaminho
 *   não usam slot. Nada disso é sorteado: slot, raridade e conjunto saem como escolhidos.
 * SORTEIO: só as linhas de farm da peça (Gear.sortearLinhas), com rng = mulberry32(hash2(seedBase, SAL_FORJA +
 *   contador)), SAL_FORJA = 0x464F0000 ("FO"; entre o sal do AFK, 0x41460000 + vaga, e o dos ginásios, 0x47490000: folga
 *   de ~16 milhões de forjas; o mapa dos sais do save está no topo do itens.js). O contador é o de peças forjadas do
 *   save: quem chama grava o contador novo junto com a peça, depois de o jogador confirmar.
 * pode(receita, slot, gymId, mochila, ouroLivre, pecas?) -> { ok: true, gasto: { itens: { id: n }, ouro } } |
 *   { ok: false, motivo }. `pecas` (opcional) = quantas peças o inventário já tem (para o teto, se houver).
 * forjar(receita, slot, gymId, mochila, seedBase, contador) -> { mochila (cópia já descontada, e com o Pergaminho
 *   somado na receita reforja), ouro (o custo), peca: { id, linhas } | pedra: 1 | item: 'pergaminho-reforja' } | null
 *   (receita, slot ou ginásio inválido, ou falta material: quem chama confere o Ouro com o pode()).
 */
(function (root) {
  'use strict';

  var node = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  var G = node ? require('./data.js') : root.GameData;
  var S = node ? require('./sim.js') : root.RaceSim;
  var GR = node ? require('./gear.js') : root.Gear;

  var F = G.FORJA, I = G.ITEMS;
  var SAL_FORJA = 0x464F0000;
  var PECAS = ['comum', 'magico', 'raro', 'lendario'];
  var RECEITAS = PECAS.concat(['pedra', 'reforja']);

  function tem(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function qtd(mochila, id) {
    var n = mochila && tem(mochila, id) ? mochila[id] : 0;
    return typeof n === 'number' && isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  function milhar(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function receita(id) { return typeof id === 'string' && RECEITAS.indexOf(id) >= 0 && tem(F, id) ? F[id] : null; }
  function ehPeca(id) { return PECAS.indexOf(id) >= 0; }
  function ginasio(gymId) { return typeof gymId === 'string' && tem(G.AFK.materiais, gymId) ? G.AFK.materiais[gymId] : null; }
  function trofeusDe(gymId) { return G.AFK.trofeus[gymId].map(function (_, e) { return 'trofeu-' + gymId + '-' + e; }); }

  // o id da peça que a receita dá: solta (Comum, Mágica) ou do conjunto do ginásio (Rara, Lendária)
  function pecaId(rec, slot, gymId) {
    var M = ginasio(gymId);
    if (!ehPeca(rec) || !M || G.GEAR_SLOTS.indexOf(slot) < 0) return null;
    var id = slot + (rec === 'raro' || rec === 'lendario' ? '-' + M.conjunto : '') + '-' + rec;
    return tem(G.GEAR, id) ? id : null;
  }

  // receita com qualquerGinasio (o Pergaminho de reforja): os materiais comuns SOMADOS de todos os ginásios e o incomum
  // de qualquer um; gasta primeiro do que o jogador tem mais (empate: a ordem do catálogo), um a um
  function gastoLivre(R, mochila) {
    var comuns = [], incs = [], itens = {};
    G.GYM_ORDER.forEach(function (g) { comuns = comuns.concat(G.AFK.materiais[g].comuns); incs.push(G.AFK.materiais[g].incomum); });
    function tira(ids, n, falta) {
      var resta = {}, total = 0;
      ids.forEach(function (id) { resta[id] = qtd(mochila, id); total += resta[id]; });
      if (total < n) return falta + ' (precisa de ' + n + ', tem ' + total + ')';
      for (var k = 0; k < n; k++) {
        var melhor = null;
        for (var j = 0; j < ids.length; j++) if (resta[ids[j]] > 0 && (melhor === null || resta[ids[j]] > resta[melhor])) melhor = ids[j];
        resta[melhor] -= 1;
        itens[melhor] = (itens[melhor] || 0) + 1;
      }
      return null;
    }
    var m = tira(comuns, R.mat || 0, 'Faltam materiais de qualquer ginásio') || tira(incs, R.inc || 0, 'Falta material incomum de qualquer ginásio');
    return m ? { motivo: m } : { itens: itens };
  }

  // o que a receita gasta da mochila: { itens: { id: n } } ou { motivo }
  function gastoDe(rec, gymId, mochila) {
    var R = receita(rec), M = ginasio(gymId);
    if (!R || !M) return { motivo: 'Receita inválida' };
    var itens = {};
    if (R.qualquerGinasio) return gastoLivre(R, mochila);
    var a = M.comuns[0], b = M.comuns[1], qa = qtd(mochila, a), qb = qtd(mochila, b), mat = R.mat || 0;
    if (qa + qb < mat) {
      return { motivo: 'Faltam materiais: ' + I[a].name + ' e ' + I[b].name + ' (precisa de ' + mat + ', tem ' + (qa + qb) + ')' };
    }
    if (mat > 0) {
      var meio = Math.floor(mat / 2), ga = meio, gb = meio;
      if (mat % 2) { if (qb > qa) gb += 1; else ga += 1; }
      if (ga > qa) { gb += ga - qa; ga = qa; }
      if (gb > qb) { ga += gb - qb; gb = qb; }
      if (ga) itens[a] = ga;
      if (gb) itens[b] = gb;
    }
    var inc = R.inc || 0;
    if (inc > 0) {
      if (qtd(mochila, M.incomum) < inc) return { motivo: 'Falta ' + I[M.incomum].name + ' (precisa de ' + inc + ', tem ' + qtd(mochila, M.incomum) + ')' };
      itens[M.incomum] = inc;
    }
    var tr = R.trofeu || 0;
    if (tr > 0) {
      var ids = trofeusDe(gymId), total = 0;
      ids.forEach(function (id) { total += qtd(mochila, id); });
      if (total < tr) return { motivo: 'Falta troféu ' + G.GYMS[gymId].name.replace(/^Ginásio /, '') + ' (precisa de ' + tr + ', tem ' + total + ')' };
      var resta = {};
      ids.forEach(function (id) { resta[id] = qtd(mochila, id); });
      for (var k = 0; k < tr; k++) {
        var melhor = null;
        for (var j = 0; j < ids.length; j++) if (resta[ids[j]] > 0 && (melhor === null || resta[ids[j]] > resta[melhor])) melhor = ids[j];
        resta[melhor] -= 1;
        itens[melhor] = (itens[melhor] || 0) + 1;
      }
    }
    var selo = R.selo || 0;
    if (selo > 0) {
      if (qtd(mochila, 'selo') < selo) return { motivo: 'Falta Selo do campeão (precisa de ' + selo + ', tem ' + qtd(mochila, 'selo') + ')' };
      itens.selo = selo;
    }
    return { itens: itens };
  }

  function pode(rec, slot, gymId, mochila, ouroLivre) {
    var R = receita(rec);
    if (!R || !ginasio(gymId)) return { ok: false, motivo: 'Receita inválida' };
    if (ehPeca(rec) && !pecaId(rec, slot, gymId)) return { ok: false, motivo: 'Escolha o tipo da peça' };
    if (rec === 'reforja' && qtd(mochila, 'pergaminho-reforja') >= I['pergaminho-reforja'].cap) {
      return { ok: false, motivo: 'Mochila cheia: ' + I['pergaminho-reforja'].cap + ' Pergaminhos de reforja' };
    }
    var g = gastoDe(rec, gymId, mochila);
    if (g.motivo) return { ok: false, motivo: g.motivo };
    if (!(typeof ouroLivre === 'number' && ouroLivre >= R.ouro)) return { ok: false, motivo: 'Falta Ouro (precisa de ' + milhar(R.ouro) + ')' };
    return { ok: true, gasto: { itens: g.itens, ouro: R.ouro } };
  }

  function forjar(rec, slot, gymId, mochila, seedBase, contador) {
    var R = receita(rec);
    if (!R || !ginasio(gymId)) return null;
    var id = ehPeca(rec) ? pecaId(rec, slot, gymId) : null;
    if (ehPeca(rec) && !id) return null;
    var g = gastoDe(rec, gymId, mochila);
    if (g.motivo) return null;
    var nova = {};
    Object.keys(mochila || {}).forEach(function (k) { nova[k] = mochila[k]; });
    Object.keys(g.itens).forEach(function (k) { nova[k] = qtd(mochila, k) - g.itens[k]; });
    var out = { mochila: nova, ouro: R.ouro };
    if (id) {
      if (typeof seedBase !== 'number' || !isFinite(seedBase) || typeof contador !== 'number' || contador !== Math.floor(contador) || contador < 0) return null;
      out.peca = { id: id, linhas: GR.sortearLinhas(G.GEAR[id].rarity, S.mulberry32(S.hash2(seedBase, SAL_FORJA + contador))) };
    } else if (rec === 'pedra') {
      out.pedra = 1;
    } else {
      nova['pergaminho-reforja'] = Math.min(I['pergaminho-reforja'].cap, qtd(mochila, 'pergaminho-reforja') + 1);
      out.item = 'pergaminho-reforja';
    }
    return out;
  }

  var Forja = { RECEITAS: RECEITAS, SAL: SAL_FORJA, ehPeca: ehPeca, pecaId: pecaId, pode: pode, forjar: forjar };

  if (typeof module !== 'undefined' && module.exports) module.exports = Forja;
  else root.Forja = Forja;
})(typeof self !== 'undefined' ? self : this);
