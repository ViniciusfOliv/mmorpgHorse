/*
 * MMORPG Horse — regras da corrida AFK (protótipo; spec 2026-11-23-afk-drops §5).
 * Módulo PURO: sem DOM, sem estado, sem Math.random e sem relógio (o "agora" chega em minutos, lido num só lugar do
 * game.js); as entradas nunca são mutadas. Os números ficam em GameData.AFK. Vai para o servidor com os outros
 * módulos de regra.
 *
 * FASE: as 15 etapas dos ginásios × 3 dificuldades. faseId = '<ginásio>:<etapa 0–4>:<dificuldade>' (ex.: 'fogo:2:dificil';
 *   o ginásio pelo id de GameData.GYMS: fogo = Fornalha, agua = Remanso, grama = Capoeira). fase(faseId) ->
 *   { id, gymId, etapa, dif, nivel (o da etapa + o da dificuldade, até nivelMax), rank (o da dificuldade; na Normal, o da
 *   etapa), mult (multiplicador de prêmio), pecas (as peças do oponente; bloco B) } | null.
 * LIBERAÇÃO: a Normal de uma etapa libera quando a etapa foi vencida no ginásio de verdade (progresso.etapa > etapa);
 *   a Difícil com GameData.AFK.liberaApos vitórias AFK na Normal da mesma etapa; a Lendária com o mesmo tanto na Difícil
 *   (e só com a Difícil liberada). vitoriasAfk = { faseId: n }.
 * OPONENTE: o n-ésimo cavalo da etapa em rodízio fixo (n % nº de cavalos da etapa), montado pelo Ginasio.cavalo no
 *   nível e no rank da fase (as estrelas são as da etapa).
 * VAGAS: até GameData.AFK.vagaPreco.length (5); a de índice k custa vagaPreco[k] de Ouro livre (fora do reservado da
 *   sala aberta; quem chama passa o Ouro livre).
 */
(function (root) {
  'use strict';

  var node = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  var G = node ? require('./data.js') : root.GameData;
  var S = node ? require('./sim.js') : root.RaceSim;
  var GY = node ? require('./ginasio.js') : root.Ginasio;

  var K = G.AFK;

  function temChave(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function inteiro(x) { return typeof x === 'number' && isFinite(x) && x === Math.floor(x); }
  function objeto(o) { return o && typeof o === 'object' && !Array.isArray(o) ? o : null; }
  // inteiro com ponto de milhar (1.000), como a tela escreve o Ouro
  function milhar(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function difDe(id) {
    if (typeof id !== 'string') return null;
    for (var i = 0; i < K.difs.length; i++) if (K.difs[i].id === id) return K.difs[i];
    return null;
  }

  // ---------------------------------------------------------------------------------------------
  // Fases e dificuldades
  // ---------------------------------------------------------------------------------------------
  function faseId(gymId, etapa, dif) {
    if (typeof gymId !== 'string' || !temChave(G.GYMS, gymId) || !inteiro(etapa) || etapa < 0 || etapa >= G.GYMS[gymId].etapas.length || !difDe(dif)) return null;
    return gymId + ':' + etapa + ':' + dif;
  }
  function fase(id) {
    if (typeof id !== 'string') return null;
    var p = id.split(':');
    if (p.length !== 3 || !/^[0-9]$/.test(p[1])) return null;
    var etapa = Number(p[1]);
    if (faseId(p[0], etapa, p[2]) !== id) return null;
    var d = difDe(p[2]), et = G.GYMS[p[0]].etapas[etapa], base = et.cavalos[0];
    var nivel = base.level + d.nivel;
    if (typeof d.nivelMax === 'number') nivel = Math.min(nivel, d.nivelMax);
    return {
      id: id, gymId: p[0], etapa: etapa, dif: d.id, nivel: nivel, rank: d.rank == null ? base.rank : d.rank, mult: d.mult,
      pecas: d.pecas ? JSON.parse(JSON.stringify(d.pecas)) : null
    };
  }
  // As 45 fases, na ordem dos ginásios, das etapas e das dificuldades.
  function fases() {
    var out = [];
    G.GYM_ORDER.forEach(function (g) {
      for (var e = 0; e < G.GYMS[g].etapas.length; e++) K.difs.forEach(function (d) { out.push(g + ':' + e + ':' + d.id); });
    });
    return out;
  }
  function vitoriasDe(v, id) { return objeto(v) && temChave(v, id) && inteiro(v[id]) && v[id] > 0 ? v[id] : 0; }
  // As fases liberadas, na ordem de fases(). progressoGinasio: o progresso dos três ginásios (Ginasio.sanear).
  function liberadas(progressoGinasio, vitoriasAfk) {
    var prog = GY.sanear(progressoGinasio, 0), out = [];
    G.GYM_ORDER.forEach(function (g) {
      for (var e = 0; e < G.GYMS[g].etapas.length && e < prog[g].etapa; e++) {
        for (var i = 0; i < K.difs.length; i++) {
          if (i > 0 && vitoriasDe(vitoriasAfk, g + ':' + e + ':' + K.difs[i - 1].id) < K.liberaApos) break;
          out.push(g + ':' + e + ':' + K.difs[i].id);
        }
      }
    });
    return out;
  }
  function liberada(id, progressoGinasio, vitoriasAfk) { return liberadas(progressoGinasio, vitoriasAfk).indexOf(id) >= 0; }

  // ---------------------------------------------------------------------------------------------
  // Oponente (rodízio fixo)
  // ---------------------------------------------------------------------------------------------
  function oponenteIdx(id, n) {
    var f = fase(id);
    if (!f || !inteiro(n) || n < 0) return -1;
    return n % G.GYMS[f.gymId].etapas[f.etapa].cavalos.length;
  }
  function oponente(id, n) {
    var i = oponenteIdx(id, n);
    if (i < 0) return null;
    var f = fase(id), def = G.GYMS[f.gymId].etapas[f.etapa].cavalos[i];
    return GY.cavalo({ base: def.base, level: f.nivel, grau: def.grau, rank: f.rank });
  }

  // ---------------------------------------------------------------------------------------------
  // Vagas
  // ---------------------------------------------------------------------------------------------
  function podeComprarVaga(qtdAtual, ouroLivre) {
    if (!inteiro(qtdAtual) || qtdAtual < 0) return { ok: false, motivo: 'Vagas inválidas' };
    if (qtdAtual >= K.vagaPreco.length) return { ok: false, motivo: 'Máximo de ' + K.vagaPreco.length + ' vagas' };
    var preco = K.vagaPreco[qtdAtual];
    if (!(typeof ouroLivre === 'number' && ouroLivre >= preco)) return { ok: false, motivo: 'Falta Ouro (precisa de ' + milhar(preco) + ')', preco: preco };
    return { ok: true, preco: preco };
  }

  var Afk = {
    faseId: faseId,
    fase: fase,
    fases: fases,
    liberadas: liberadas,
    liberada: liberada,
    oponenteIdx: oponenteIdx,
    oponente: oponente,
    podeComprarVaga: podeComprarVaga
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Afk;
  else root.Afk = Afk;
})(typeof self !== 'undefined' ? self : this);
