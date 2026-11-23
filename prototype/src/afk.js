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
 * SEED: a corrida de número `contador` da vaga `vaga` (0–4) tem seedCorrida = hash2(hash2(seedBase, SAL + vaga),
 *   contador), SAL = 0x41460000 ("AF"; o mapa dos sais do save está no topo do itens.js). O RaceSim.simulate usa essa
 *   seed; os drops usam mulberry32(hash2(seedCorrida, 0xD209)) e a peça que cai mulberry32(hash2(seedCorrida, 0x9ECA)).
 *   Quem chama grava o contador novo ANTES de mostrar o resultado (duas abas não repetem a seed).
 * CORRIDA (correr): um duelo nas regras do ginásio (Ginasio.dueloCfg: vantagem de elemento, largada Nublada, pista do
 *   ginásio, Dado da Sorte normal), sem cansaço, contra o oponente do rodízio (n = contador).
 * PRÊMIO (premio): função só da fase, de venceu, da seedCorrida e do bônus — a corrida ao vivo e o offline usam a mesma.
 *   bonus = { material, xp, raro, trofeu, ouro } em fração (0,3 = +30%; peças do cavalo + bestiário); lixo vale 0.
 *   Ordem FIXA das chamadas da rng dos drops (todas acontecem sempre, caia ou não):
 *     1) quantidade de material (min a max) · 2) para que tipo vai o ímpar · 3) arredondamento do bônus de material ·
 *     4) arredondamento do bônus de Ouro · 5) incomum · 6) Pedra Negra · 7) comida · 8) qual comida · 9) peça ·
 *     10) Pergaminho de reforja · 11) troféu.
 *   Quantidade com fração (bônus): a parte inteira e mais 1 com chance igual à fração (o valor esperado é exato).
 *   Vitória: XP e Ouro da fase (× bônus), material q × mult × (1 + bonus.material), metade de cada tipo; incomum,
 *     Pedra e comida com chance × mult (incomum com teto antes do bônus) × (1 + bonus.raro); peça pela tabela da
 *     dificuldade × (1 + bonus.raro); reforja chance × mult; troféu pela dificuldade × (1 + bonus.trofeu).
 *   Derrota: XP × derrota.xp (sem bônus além do de XP) e floor(q × mult × derrota.material) de material; mais nada.
 *   Peça (rng própria, só se caiu): 1) o slot (uniforme); 2) na solta, Mágica se < magica; depois as linhas
 *     (Gear.sortearLinhas). Rara e Lendária são do conjunto do ginásio. Devolve { id, linhas }.
 *   O AFK nunca dá Torrão, Estrela, Rédea, Manual, Cupom, Pergaminho de técnica, Selo, insígnia nem prêmio de ginásio.
 * CHANCE MEDIDA (para o offline): chaveConfig(cavalo, faseId) é um texto que muda quando muda o que mexe na corrida
 *   (elemento, raridade, genética, nível, estrelas, pontos, torrões, skills, ranks, peças) ou a fase. medirPasso avança
 *   a medição em n duelos sem quadros: o duelo i (0, 1, …) usa a seed hash2(hash2(hashTexto(chave), SAL_MEDIDA), i) —
 *   própria da configuração, não do save — contra o oponente i do rodízio. estado = { chave, feitos, vitorias,
 *   somaDuracao }; completo com feitos === GameData.AFK.amostra. medida(estado) -> { p, duracaoS } | null (incompleta).
 * OFFLINE: minutos = clamp(agoraMin − vaga.inicioMin, 0, limite); corridas = floor(minutos × 60 / duração média); a
 *   corrida k usa a mesma seedCorrida que a corrida ao vivo de contador vaga.contador + k usaria; vence se
 *   mulberry32(hash2(seedCorrida, 0x0FF1))() < p; o prêmio é o premio() de sempre. Sem medida completa: 0 corridas.
 *   limiteOffline(aveiaMin, bestiarioMin) = min(offlineTetoMin, offlineMin + aveia + bestiário).
 * VAGAS: até GameData.AFK.vagaPreco.length (5); a de índice k custa vagaPreco[k] de Ouro livre (fora do reservado da
 *   sala aberta; quem chama passa o Ouro livre).
 */
(function (root) {
  'use strict';

  var node = typeof require === 'function' && typeof module !== 'undefined' && module.exports;
  var G = node ? require('./data.js') : root.GameData;
  var S = node ? require('./sim.js') : root.RaceSim;
  var GY = node ? require('./ginasio.js') : root.Ginasio;
  var GR = node ? require('./gear.js') : root.Gear;

  var K = G.AFK;
  var SAL = 0x41460000, SAL_DROP = 0xD209, SAL_PECA = 0x9ECA, SAL_OFF = 0x0FF1, SAL_MEDIDA = 0x4D45;
  var BONUS_TIPOS = ['material', 'xp', 'raro', 'trofeu', 'ouro'];

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
  // Corrida e prêmio
  // ---------------------------------------------------------------------------------------------
  function vagaOk(v) { return inteiro(v) && v >= 0 && v < K.vagaPreco.length; }
  function seedCorrida(seedBase, vaga, contador) { return S.hash2(S.hash2(seedBase, SAL + vaga), contador); }
  function bonusDe(b) {
    var o = objeto(b) || {}, out = {};
    BONUS_TIPOS.forEach(function (t) { out[t] = typeof o[t] === 'number' && isFinite(o[t]) && o[t] > 0 ? o[t] : 0; });
    return out;
  }
  // x ≥ 0 com fração -> inteiro: a parte inteira e mais 1 se u < fração
  function arredonda(x, u) { var i = Math.floor(x + 1e-9), f = x - i; return f > 1e-9 && u < f ? i + 1 : i; }
  function soma(itens, id, n) { if (n > 0) itens[id] = (itens[id] || 0) + n; }
  function pecaQueCai(f, raridade, seed) {
    var rng = S.mulberry32(S.hash2(seed, SAL_PECA));
    var slot = G.GEAR_SLOTS[Math.min(G.GEAR_SLOTS.length - 1, Math.floor(rng() * G.GEAR_SLOTS.length))], id;
    if (raridade === 'solta') {
      raridade = rng() < (K.drops.peca[f.dif].magica || 0) ? 'magico' : 'comum';
      id = slot + '-' + raridade;
    } else id = slot + '-' + K.materiais[f.gymId].conjunto + '-' + raridade;
    return { id: id, linhas: GR.sortearLinhas(raridade, rng) };
  }
  // -> { xp, ouro, itens: { id: qtd }, pedras, pecas: [{ id, linhas }] } | null (fase inválida)
  function premio(id, venceu, seed, bonus) {
    var f = fase(id);
    if (!f || typeof seed !== 'number' || !isFinite(seed)) return null;
    var b = bonusDe(bonus), D = K.drops, M = K.materiais[f.gymId], rng = S.mulberry32(S.hash2(seed, SAL_DROP));
    var u = [];
    for (var i = 0; i < 11; i++) u.push(rng());
    var out = { xp: 0, ouro: 0, itens: {}, pedras: 0, pecas: [] };
    var xp = Math.round(K.xpBase * (1 + K.xpPorEtapa * f.etapa) * f.mult);
    var q = (D.material.min + Math.min(D.material.max - D.material.min, Math.floor(u[0] * (D.material.max - D.material.min + 1)))) * f.mult;
    function reparte(n) {
      var meio = Math.floor(n / 2), impar = n - 2 * meio, a = u[1] < 0.5 ? 0 : 1;
      soma(out.itens, M.comuns[0], meio + (impar && a === 0 ? 1 : 0));
      soma(out.itens, M.comuns[1], meio + (impar && a === 1 ? 1 : 0));
    }
    if (!venceu) {
      out.xp = Math.round(xp * K.derrota.xp * (1 + b.xp));
      reparte(Math.floor(q * K.derrota.material + 1e-9));
      return out;
    }
    out.xp = Math.round(xp * (1 + b.xp));
    reparte(arredonda(q * (1 + b.material), u[2]));
    out.ouro = arredonda(K.ouro[f.etapa] * f.mult * (1 + b.ouro), u[3]);
    var raro = 1 + b.raro;
    if (u[4] < Math.min(D.incomum.teto, D.incomum.chance * f.mult) * raro) soma(out.itens, M.incomum, 1);
    if (u[5] < D.pedra.chance * f.mult * raro) out.pedras = 1;
    if (u[6] < D.comida.chance * f.mult * raro) {
      var ids = Object.keys(D.comida.pesos), total = 0, alvo, ac = 0;
      ids.forEach(function (c) { total += D.comida.pesos[c]; });
      alvo = u[7] * total;
      for (var k = 0; k < ids.length; k++) { ac += D.comida.pesos[ids[k]]; if (alvo < ac || k === ids.length - 1) { soma(out.itens, ids[k], 1); break; } }
    }
    var P = D.peca[f.dif], lim = 0, caiu = null;
    ['lendario', 'raro', 'solta'].forEach(function (r) {
      if (caiu || !P[r]) return;
      lim += P[r] * raro;
      if (u[8] < lim) caiu = r;
    });
    if (caiu) out.pecas.push(pecaQueCai(f, caiu, seed));
    if (u[9] < D.reforja.chance * f.mult) soma(out.itens, 'pergaminho-reforja', 1);
    if (u[10] < D.trofeu[f.dif] * (1 + b.trofeu)) soma(out.itens, 'trofeu-' + f.gymId + '-' + f.etapa, 1);
    return out;
  }
  // Uma corrida AFK. opts = { vaga (0–4; ausente: 0), recordFrames (true: devolve também `res`, o resultado do
  // simulate com os quadros, para a tela animar) }.
  // -> { venceu, metros, duracaoS, oponenteIdx, cfg, xp, ouro, itens, pedras, pecas [, res] } | null (entrada malformada)
  function correr(cavalo, id, seedBase, contador, bonus, opts) {
    var f = fase(id), o = objeto(opts) || {}, vaga = o.vaga == null ? 0 : o.vaga;
    if (!f || !objeto(cavalo) || (cavalo.skills != null && !Array.isArray(cavalo.skills))) return null;
    if (typeof seedBase !== 'number' || !isFinite(seedBase) || !inteiro(contador) || contador < 0 || !vagaOk(vaga)) return null;
    var seed = seedCorrida(seedBase, vaga, contador), adv = oponente(id, contador);
    var cfg = GY.dueloCfg(cavalo, adv, seed, { pista: G.GYMS[f.gymId].pista, recordFrames: o.recordFrames === true });
    var res = S.simulate(cfg), venceu = res.finishOrder[0] === 0;
    var p = premio(id, venceu, seed, bonus);
    var t0 = res.finishTimes[0], t1 = res.finishTimes[1], dur = Math.max(isFinite(t0) ? t0 : 0, isFinite(t1) ? t1 : 0);
    var out = { venceu: venceu, metros: GY.metros(res), duracaoS: Math.round(dur * 10) / 10, oponenteIdx: oponenteIdx(id, contador), cfg: cfg,
      xp: p.xp, ouro: p.ouro, itens: p.itens, pedras: p.pedras, pecas: p.pecas };
    if (o.recordFrames === true) out.res = res;
    return out;
  }

  // ---------------------------------------------------------------------------------------------
  // Chance medida e offline
  // ---------------------------------------------------------------------------------------------
  function hashTexto(t) {   // FNV-1a de 32 bits
    var h = 0x811C9DC5;
    for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  var CAMPOS_CHAVE = ['element', 'rarity', 'grau', 'level', 'torroes'];
  function chaveConfig(cavalo, id) {
    if (!objeto(cavalo) || !fase(id)) return null;
    var partes = [S.VERSION, id];
    CAMPOS_CHAVE.forEach(function (c) { partes.push(cavalo[c] == null ? '' : String(cavalo[c])); });
    ['potential', 'alloc'].forEach(function (c) {
      var o = objeto(cavalo[c]) || {};
      partes.push(G.STAT_KEYS.map(function (k) { return o[k] == null ? 0 : o[k]; }).join(','));
    });
    var sk = Array.isArray(cavalo.skills) ? cavalo.skills : [], rk = objeto(cavalo.skillRanks) || {};
    partes.push(sk.map(function (s) { return s + '=' + (rk[s] == null ? 1 : rk[s]); }).join(','));
    return partes.join('|');
  }
  function amostraDe(opts) { var o = objeto(opts) || {}; return inteiro(o.amostra) && o.amostra > 0 ? o.amostra : K.amostra; }
  function estadoOk(e, chave, total) {
    return objeto(e) && e.chave === chave && inteiro(e.feitos) && e.feitos >= 0 && e.feitos <= total && inteiro(e.vitorias) && e.vitorias >= 0 &&
      e.vitorias <= e.feitos && typeof e.somaDuracao === 'number' && isFinite(e.somaDuracao) && e.somaDuracao >= 0;
  }
  // opts (só para as ferramentas de balanço): { amostra: outro tamanho, sal: outra série de seeds }.
  function medirPasso(estado, cavalo, id, n, opts) {
    var chave = chaveConfig(cavalo, id);
    if (chave === null || (cavalo.skills != null && !Array.isArray(cavalo.skills))) return null;
    var total = amostraDe(opts), o = objeto(opts) || {};
    var e = estadoOk(estado, chave, total) ? { chave: chave, feitos: estado.feitos, vitorias: estado.vitorias, somaDuracao: estado.somaDuracao }
      : { chave: chave, feitos: 0, vitorias: 0, somaDuracao: 0 };
    var base = S.hash2(hashTexto(chave), SAL_MEDIDA + (inteiro(o.sal) && o.sal > 0 ? o.sal : 0)), f = fase(id), pista = G.GYMS[f.gymId].pista;
    var ate = Math.min(total, e.feitos + (inteiro(n) && n > 0 ? n : 0));
    for (var i = e.feitos; i < ate; i++) {
      var res = S.simulate(GY.dueloCfg(cavalo, oponente(id, i), S.hash2(base, i), { pista: pista }));
      if (res.finishOrder[0] === 0) e.vitorias++;
      var t0 = res.finishTimes[0], t1 = res.finishTimes[1];
      e.somaDuracao += Math.max(isFinite(t0) ? t0 : 0, isFinite(t1) ? t1 : 0);
    }
    e.feitos = ate;
    e.somaDuracao = Math.round(e.somaDuracao * 10) / 10;
    return e;
  }
  function medidaPronta(estado, opts) { return !!objeto(estado) && typeof estado.chave === 'string' && estadoOk(estado, estado.chave, amostraDe(opts)) && estado.feitos === amostraDe(opts); }
  function medida(estado, opts) {
    if (!medidaPronta(estado, opts)) return null;
    return { p: estado.vitorias / estado.feitos, duracaoS: Math.round(estado.somaDuracao / estado.feitos * 10) / 10 };
  }
  function minutosOk(x) { return typeof x === 'number' && isFinite(x) && x > 0 ? x : 0; }
  function limiteOffline(aveiaMin, bestiarioMin) { return Math.min(K.offlineTetoMin, K.offlineMin + minutosOk(aveiaMin) + minutosOk(bestiarioMin)); }
  function offlineVenceu(seed, p) { return S.mulberry32(S.hash2(seed, SAL_OFF))() < p; }
  // vaga = { uid, faseId, inicioMin, contador }; med = { p, duracaoS } (a medida completa); idx = o número da vaga (0–4).
  // -> { minutos, corridas, vitorias, xp, ouro, itens, pedras, pecas, contador (o novo) }
  function offline(vaga, agoraMin, med, seedBase, bonus, limiteMin, idx) {
    var v = objeto(vaga) || {}, m = objeto(med) || {};
    var out = { minutos: 0, corridas: 0, vitorias: 0, xp: 0, ouro: 0, itens: {}, pedras: 0, pecas: [], contador: inteiro(v.contador) && v.contador >= 0 ? v.contador : 0 };
    if (!v.uid || !fase(v.faseId) || !inteiro(v.contador) || v.contador < 0 || !vagaOk(idx == null ? 0 : idx)) return out;
    if (typeof v.inicioMin !== 'number' || !isFinite(v.inicioMin) || typeof agoraMin !== 'number' || !isFinite(agoraMin)) return out;
    if (typeof seedBase !== 'number' || !isFinite(seedBase)) return out;
    if (!(typeof m.p === 'number' && m.p >= 0 && m.p <= 1) || !(typeof m.duracaoS === 'number' && isFinite(m.duracaoS) && m.duracaoS > 0)) return out;
    var limite = Math.min(K.offlineTetoMin, minutosOk(limiteMin));
    out.minutos = Math.max(0, Math.min(limite, agoraMin - v.inicioMin));
    out.corridas = Math.floor(out.minutos * 60 / m.duracaoS + 1e-9);
    for (var k = 0; k < out.corridas; k++) {
      var seed = seedCorrida(seedBase, idx == null ? 0 : idx, v.contador + k), venceu = offlineVenceu(seed, m.p), p = premio(v.faseId, venceu, seed, bonus);
      if (venceu) out.vitorias++;
      out.xp += p.xp; out.ouro += p.ouro; out.pedras += p.pedras;
      for (var id in p.itens) if (temChave(p.itens, id)) out.itens[id] = (out.itens[id] || 0) + p.itens[id];
      for (var q = 0; q < p.pecas.length; q++) out.pecas.push(p.pecas[q]);
    }
    out.contador = v.contador + out.corridas;
    return out;
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
    SAL: SAL,
    seedCorrida: seedCorrida,
    premio: premio,
    correr: correr,
    chaveConfig: chaveConfig,
    medirPasso: medirPasso,
    medidaPronta: medidaPronta,
    medida: medida,
    limiteOffline: limiteOffline,
    offlineVenceu: offlineVenceu,
    offline: offline,
    podeComprarVaga: podeComprarVaga
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Afk;
  else root.Afk = Afk;
})(typeof self !== 'undefined' ? self : this);
