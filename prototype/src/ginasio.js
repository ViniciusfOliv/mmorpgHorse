/*
 * MMORPG Horse — regras dos Ginásios da Expedição (protótipo; spec 2026-11-17-ginasios §4 a §9).
 * Módulo PURO: sem DOM, sem estado, sem Math.random e sem relógio (o dia chega como inteiro, lido num só lugar do
 * game.js); as entradas nunca são mutadas. Os números ficam em GameData.GYM, GameData.GYM_ORDER e GameData.GYMS.
 * Vai para o servidor com os outros módulos de regra.
 *
 * SORTEIO: o único é a corrida de cada duelo. A seed do duelo d (0, 1, …; no máximo 5 num desafio) do desafio de
 *   número `contador` é hash2(seedBase, SAL + contador · 8 + d), SAL = 0x47490000 ("GI"); a corrida é o
 *   RaceSim.simulate dessa config, que só usa a RNG da seed. O contador é o de desafios do save (state.gymCounter):
 *   quem chama grava o contador novo junto com a entrada e o resultado. O mapa de todos os sais do save está no topo
 *   do itens.js (um só mapa); o deste módulo fica abaixo do SAL do itens.js, com folga de ~4 milhões de desafios.
 *
 * ETAPA: nas funções, `etapa` é o índice 0–4 em GYMS[id].etapas (4 = o líder). PROGRESSO por ginásio:
 *   { etapa: 0–5 (etapas vencidas; a próxima a desafiar é a de índice `etapa`; 5 = insígnia),
 *     revDia: null (nunca) | dia da última revanche, revVitorias: revanches vencidas (o rodízio do prêmio) }.
 *   Dia estragado vale `hoje` (conta como "já tentou hoje"); relógio para trás não libera (só hoje > revDia).
 *   revanchePremio(revVitorias) -> { ouro } | { item }: o prêmio do rodízio da próxima revanche vencida (o que o acerto paga).
 *
 * DUELOS (resolver): o 1º cavalo do time corre contra o 1º do adversário; quem perde sai, quem vence fica e enfrenta
 *   o próximo do outro lado. Fôlego de quem larga: 1 − (soma dos `perde` das faixas das vitórias seguidas dele neste
 *   desafio), nunca abaixo de 1 − teto; quem entra descansado larga com 1 (vale para os dois lados). Quem tem a
 *   vantagem de elemento corre com statMul = 1 + GYM.vantagem; o outro fica em 1. Clima inicial Nublado e a pista do
 *   ginásio; o Dado da Sorte é o de sempre.
 * METROS: (tPerdedor − tVencedor) × distância / tPerdedor, uma casa (quanto faltava ao perdedor quando o vencedor
 *   cruzou). Tempos iguais: 0. Qualquer tempo ausente (do perdedor, do vencedor ou dos dois): a distância da pista
 *   (a maior faixa, folgada).
 * ACERTO: só acerta o desafio que o podeDesafiar permitiria quanto à etapa e à revanche, e exige hoje inteiro sempre
 *   (Ruling 7); senão devolve null (nada de Ouro, XP ou progresso). Ouro livre, mochila e tamanho do time são só do
 *   podeDesafiar.
 */
(function (root) {
  'use strict';

  var G = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./data.js') : root.GameData;
  var S = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./sim.js') : root.RaceSim;

  var SAL = 0x47490000;
  var PASSO_DUELO = 8;         // passo do contador na seed: cada desafio reserva 8 seeds (usa no máximo 5, um por duelo)
  var DIA_MAX = 2932896;       // o mesmo Itens.DIA_MAX (31/12/9999): o maior dia guardado
  // quem vence quem: Fogo > Grama > Água > Fogo
  var VENCE = { fogo: 'grama', grama: 'agua', agua: 'fogo' };

  function temChave(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function inteiro(x) { return typeof x === 'number' && isFinite(x) && x === Math.floor(x); }
  function objeto(o) { return o && typeof o === 'object' && !Array.isArray(o) ? o : null; }
  function copia(x) { return JSON.parse(JSON.stringify(x)); }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function gymDe(id) { return typeof id === 'string' && temChave(G.GYMS, id) ? G.GYMS[id] : null; }
  function etapaOk(e) { return inteiro(e) && e >= 0 && e < 5; }

  // ---------------------------------------------------------------------------------------------
  // Vantagem de elemento, cavalo da etapa, distância e faixa
  // ---------------------------------------------------------------------------------------------
  // 1: `meu` vence `dele`; −1: `dele` vence `meu`; 0: iguais ou desconhecidos.
  function vantagem(meu, dele) {
    if (temChave(VENCE, meu) && VENCE[meu] === dele) return 1;
    if (temChave(VENCE, dele) && VENCE[dele] === meu) return -1;
    return 0;
  }
  // O cavalo fixo da etapa: a base do catálogo (cópia) no nível e nas estrelas dados, com a build dos bots e as
  // skills de vaga no rank da etapa.
  function cavalo(def) {
    if (!objeto(def)) return null;
    var lista = G.STARTERS.concat(G.WILD_HORSES), base = null;
    for (var i = 0; i < lista.length; i++) if (lista[i].id === def.base) { base = lista[i]; break; }
    if (!base) return null;
    var h = copia(base);
    h.level = def.level;
    h.grau = def.grau;
    h.alloc = S.botAlloc(h);
    // skills de vaga no rank fixo da etapa (sem sorteio; ausente ou inválido vale 1)
    return S.withRanks(h, def.rank);
  }
  // Distância na chegada de um duelo (resultado do simulate com 2 corredores), em metros, uma casa.
  function metros(res) {
    if (!objeto(res) || !Array.isArray(res.finishOrder) || res.finishOrder.length < 2 || !Array.isArray(res.finishTimes) || !objeto(res.conditions)) return 0;
    var d = res.conditions.distance;
    if (!(typeof d === 'number' && d > 0)) return 0;
    var tv = res.finishTimes[res.finishOrder[0]], tp = res.finishTimes[res.finishOrder[1]];
    // tempo ausente (de qualquer um) conta como a maior faixa
    if (!(typeof tv === 'number' && isFinite(tv)) || !(typeof tp === 'number' && isFinite(tp) && tp > 0)) return d;
    if (!(tp > tv)) return 0;
    return Math.round((tp - tv) * d / tp * 10) / 10;
  }
  // Faixa da vitória pela distância: a primeira com metros < ate (a última, ate null, pega o resto).
  function faixa(m) {
    var fs = G.GYM.fadiga.faixas;
    for (var i = 0; i < fs.length; i++) {
      if (fs[i].ate === null || m < fs[i].ate) return { id: fs[i].id, name: fs[i].name, perde: fs[i].perde };
    }
    var u = fs[fs.length - 1];
    return { id: u.id, name: u.name, perde: u.perde };
  }

  // ---------------------------------------------------------------------------------------------
  // O desafio
  // ---------------------------------------------------------------------------------------------
  // A config do RaceSim.simulate de UM duelo nas regras do ginásio (a mesma do resolver; a corrida AFK também usa):
  // 2 corredores (0 = `meu`, 1 = `dele`), a vantagem de elemento em statMul (1 + GYM.vantagem para quem vence o
  // elemento do outro), largada Nublada e a pista dada. opts = { pista: { distance, surface, blocks }, folegoMeu,
  // folegoDele (ausentes: 1), recordFrames (ausente: false) }. Não sorteia nem simula; não muta as entradas.
  function dueloCfg(meu, dele, seed, opts) {
    var o = objeto(opts) || {}, pista = objeto(o.pista) || {};
    var v = vantagem(meu && meu.element, dele && dele.element), mul = 1 + G.GYM.vantagem;
    var cfg = {
      seed: seed,
      recordFrames: o.recordFrames === true,
      conditions: copia({ distance: pista.distance, surface: pista.surface, weather: 'nublado', blocks: pista.blocks }),
      racers: [
        { horse: copia(meu), name: meu.name, isPlayer: true, folego: typeof o.folegoMeu === 'number' ? o.folegoMeu : 1, statMul: v === 1 ? mul : 1 },
        { horse: copia(dele), name: dele.name, isPlayer: false, folego: typeof o.folegoDele === 'number' ? o.folegoDele : 1, statMul: v === -1 ? mul : 1 }
      ]
    };
    // só o treino AFK passa peças (opts.pecasMeu / pecasDele = { statAdd, pve }); os duelos de ginásio de verdade, nunca
    [o.pecasMeu, o.pecasDele].forEach(function (pc, k) {
      if (!objeto(pc)) return;
      if (objeto(pc.statAdd)) cfg.racers[k].statAdd = copia(pc.statAdd);
      if (objeto(pc.pve)) cfg.racers[k].pve = copia(pc.pve);
    });
    return cfg;
  }
  function folegoDe(perda) { return Math.max(r3(1 - G.GYM.fadiga.teto), r3(1 - perda)); }
  // e = { gymId, etapa (0–4), time: [horse…] (na ordem; 1 até o tamanho do time do adversário), seedBase, contador }.
  // -> { venceu, duelos: [{ a, b, cfg, vencedor: 'jogador' | 'adversario', metros, faixa, folegoA, folegoB,
  //    vantagem (do ponto de vista do jogador) }] } | null (entrada malformada).
  function resolver(e) {
    if (!objeto(e)) return null;
    var gym = gymDe(e.gymId);
    if (!gym || !etapaOk(e.etapa)) return null;
    if (typeof e.seedBase !== 'number' || !isFinite(e.seedBase) || !inteiro(e.contador) || e.contador < 0) return null;
    var et = gym.etapas[e.etapa];
    var time = e.time;
    if (!Array.isArray(time) || time.length < 1 || time.length > et.cavalos.length) return null;
    // cavalo: objeto; skills, se houver, numa lista (o resto o simulate saneia)
    for (var t = 0; t < time.length; t++) if (!objeto(time[t]) || (time[t].skills != null && !Array.isArray(time[t].skills))) return null;
    var adv = et.cavalos.map(cavalo);
    for (var q = 0; q < adv.length; q++) if (!adv[q]) return null;
    var i = 0, j = 0, perdaA = 0, perdaB = 0, duelos = [];
    while (i < time.length && j < adv.length) {
      var d = duelos.length;
      var v = vantagem(time[i].element, adv[j].element);
      var folegoA = folegoDe(perdaA), folegoB = folegoDe(perdaB);
      var cfg = dueloCfg(time[i], adv[j], S.hash2(e.seedBase, SAL + e.contador * PASSO_DUELO + d),
        { pista: gym.pista, folegoMeu: folegoA, folegoDele: folegoB, recordFrames: false });
      var res = S.simulate(cfg);
      var jogador = res.finishOrder[0] === 0;
      var m = metros(res), f = faixa(m);
      duelos.push({ a: i, b: j, cfg: cfg, vencedor: jogador ? 'jogador' : 'adversario', metros: m, faixa: f, folegoA: folegoA, folegoB: folegoB, vantagem: v });
      if (jogador) { perdaA += f.perde; perdaB = 0; j++; }
      else { perdaB += f.perde; perdaA = 0; i++; }
    }
    return { venceu: j >= adv.length, duelos: duelos };
  }

  // ---------------------------------------------------------------------------------------------
  // Progresso, revanche e acerto
  // ---------------------------------------------------------------------------------------------
  function diaOu(x, hoje) {
    if (inteiro(x) && x >= 0 && x <= DIA_MAX) return x;
    return inteiro(hoje) ? hoje : DIA_MAX;   // na dúvida, nada libera
  }
  // Progresso saneado dos três ginásios (na ordem de GYM_ORDER). Ginásio ausente: novo (revDia null). Etapa fora de
  // 0–5 vale 0; revVitorias fora de inteiro ≥ 0 vale 0; revDia: só null é "nunca", dia estragado vale hoje (ou, com
  // hoje que não é inteiro, o maior dia guardado).
  function sanear(bruto, hoje) {
    var b = objeto(bruto) || {}, out = {};
    G.GYM_ORDER.forEach(function (id) {
      if (!temChave(b, id) || b[id] === undefined) { out[id] = { etapa: 0, revDia: null, revVitorias: 0 }; return; }
      var o = objeto(b[id]), p = o || {};
      out[id] = {
        etapa: inteiro(p.etapa) && p.etapa >= 0 && p.etapa <= 5 ? p.etapa : 0,
        revDia: o && p.revDia === null ? null : diaOu(p.revDia, hoje),
        revVitorias: inteiro(p.revVitorias) && p.revVitorias >= 0 ? p.revVitorias : 0
      };
    });
    return out;
  }
  function revanchePremio(revVitorias) {
    var c = G.GYM.revanche.ciclo;
    return c[revVitorias % c.length];
  }
  // Pode tentar a revanche hoje: só com hoje inteiro e se nunca tentou ou hoje passou do último dia.
  function revancheLivre(p, hoje) { return inteiro(hoje) && (p.revDia === null || hoje > p.revDia); }

  // e = { gymId, etapa, progresso, hoje, ouroLivre (Ouro fora do reservado da sala aberta), cabe(id, n), timeLen }
  // -> { ok: true, revanche } | { ok: false, motivo }. Na ordem: 'fechada', 'vencida', 'revanche-hoje', 'sem-ouro',
  // 'cheia', 'sem-time', 'time-grande'.
  function podeDesafiar(e) {
    if (!objeto(e)) return { ok: false, motivo: 'fechada' };
    var gym = gymDe(e.gymId);
    if (!gym || !etapaOk(e.etapa)) return { ok: false, motivo: 'fechada' };
    var p = sanear(e.progresso, e.hoje)[gym.id];
    var revanche = false;
    if (p.etapa === 5) {
      if (e.etapa !== 4) return { ok: false, motivo: 'vencida' };
      if (!revancheLivre(p, e.hoje)) return { ok: false, motivo: 'revanche-hoje' };
      revanche = true;
    } else if (e.etapa < p.etapa) return { ok: false, motivo: 'vencida' };
    else if (e.etapa > p.etapa) return { ok: false, motivo: 'fechada' };
    var et = gym.etapas[e.etapa];
    var entrada = revanche ? G.GYM.revanche.entrada : et.entrada;
    if (!(e.ouroLivre >= entrada)) return { ok: false, motivo: 'sem-ouro' };
    var itens = revanche ? (revanchePremio(p.revVitorias).item ? [revanchePremio(p.revVitorias).item] : []) : et.premio.itens;
    for (var i = 0; i < itens.length; i++) {
      if (typeof e.cabe !== 'function' || !e.cabe(itens[i], 1)) return { ok: false, motivo: 'cheia' };
    }
    // os Pergaminhos de técnica da 1ª vitória também têm de caber
    var pergs = revanche ? 0 : (et.premio.pergaminhos || 0);
    if (pergs > 0 && (typeof e.cabe !== 'function' || !e.cabe('pergaminho', pergs))) return { ok: false, motivo: 'cheia' };
    if (!inteiro(e.timeLen) || e.timeLen < 1) return { ok: false, motivo: 'sem-time' };
    if (e.timeLen > et.cavalos.length) return { ok: false, motivo: 'time-grande' };
    return { ok: true, revanche: revanche };
  }

  function resultadoOk(r, nAdv, timeLen) {
    if (!objeto(r) || typeof r.venceu !== 'boolean' || !Array.isArray(r.duelos) || !r.duelos.length) return false;
    for (var k = 0; k < r.duelos.length; k++) {
      var d = r.duelos[k];
      if (!objeto(d) || !inteiro(d.a) || d.a < 0 || d.a >= timeLen || !inteiro(d.b) || d.b < 0 || d.b >= nAdv) return false;
      if (d.vencedor !== 'jogador' && d.vencedor !== 'adversario') return false;
    }
    return true;
  }
  // e = { gymId, etapa, revanche, progresso, resultado (do resolver), hoje (inteiro, sempre), timeLen (tamanho do
  // time) } -> { ouro, itens: [ids], pergaminhos (Pergaminhos de técnica da 1ª vitória; 0 na revanche), xp: [um por cavalo do time; 0 para quem não correu], progresso (os três
  // ginásios, novo), insignia } | null. Sem o bônus das insígnias (quem soma aplica).
  // null (Ruling 7): hoje não inteiro; gymId, etapa, timeLen ou resultado malformados; fora da revanche, etapa que não
  // é a próxima não vencida (inclusive o líder já vencido); na revanche, sem o líder vencido, etapa que não é a 4 ou
  // já tentou hoje (relógio para trás e dia estragado não liberam).
  // Fora da revanche: na vitória, o prêmio da etapa (a etapa anda; a insígnia ao vencer a 4). Na revanche: revDia =
  // hoje vencendo ou perdendo; na vitória, o prêmio do rodízio e revVitorias + 1.
  function acerto(e) {
    if (!objeto(e)) return null;
    var gym = gymDe(e.gymId);
    if (!gym || !etapaOk(e.etapa)) return null;
    var et = gym.etapas[e.etapa];
    if (!inteiro(e.timeLen) || e.timeLen < 1 || e.timeLen > et.cavalos.length) return null;
    if (!resultadoOk(e.resultado, et.cavalos.length, e.timeLen)) return null;
    if (!inteiro(e.hoje) || typeof e.revanche !== 'boolean') return null;
    var revanche = e.revanche;
    var prog = sanear(e.progresso, e.hoje), p = prog[gym.id];
    if (revanche) {
      if (p.etapa !== 5 || e.etapa !== 4 || !revancheLivre(p, e.hoje)) return null;
    } else if (p.etapa !== e.etapa) return null;   // vencida, fechada ou o líder já vencido (p.etapa 5)
    var X = G.GYM.xp, xp = [];
    for (var k = 0; k < e.timeLen; k++) xp.push(0);
    e.resultado.duelos.forEach(function (d) { xp[d.a] += d.vencedor === 'jogador' ? X.vence : X.perde; });
    var venceu = e.resultado.venceu, ouro = 0, itens = [], insignia = false, pergaminhos = 0;
    if (revanche) {
      p.revDia = e.hoje;
      if (venceu) {
        var pr = revanchePremio(p.revVitorias);
        ouro = pr.ouro || 0;
        if (pr.item) itens.push(pr.item);
        p.revVitorias += 1;
      }
    } else if (venceu) {
      ouro = et.premio.ouro;
      itens = et.premio.itens.slice();
      pergaminhos = et.premio.pergaminhos || 0;   // só na 1ª vitória (como a Rédea nova do líder); a revanche não dá
      p.etapa += 1;
      insignia = p.etapa === 5;
    }
    return { ouro: ouro, itens: itens, pergaminhos: pergaminhos, xp: xp, progresso: prog, insignia: insignia };
  }

  // A soma dos bônus das insígnias conquistadas (etapa 5): { ouro, xp, skill }.
  function bonus(progresso) {
    var p = sanear(progresso, 0), out = { ouro: 0, xp: 0, skill: 0 };
    G.GYM_ORDER.forEach(function (id) {
      if (p[id].etapa !== 5) return;
      var ins = G.GYM.insignias[id];
      if (ins && temChave(out, ins.tipo)) out[ins.tipo] += ins.valor;
    });
    return out;
  }

  var Ginasio = {
    SAL: SAL,
    DIA_MAX: DIA_MAX,
    vantagem: vantagem,
    cavalo: cavalo,
    metros: metros,
    faixa: faixa,
    dueloCfg: dueloCfg,
    resolver: resolver,
    acerto: acerto,
    podeDesafiar: podeDesafiar,
    revanchePremio: revanchePremio,
    bonus: bonus,
    sanear: sanear
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Ginasio;
  else root.Ginasio = Ginasio;
})(typeof self !== 'undefined' ? self : this);
