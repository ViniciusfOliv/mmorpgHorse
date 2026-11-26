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
 *   bonus = { material, xp, raro, trofeu, ouro } em fração (0,3 = +30%; peças do cavalo + bestiário + Sorte); lixo vale 0.
 *   SORTE (D8): sorteRaro(cavalo) = GameData.AFK.sorteRaro × genética de Sorte / 31 (0–31; ausente vale 0), somado ao
 *   bonus.raro da vaga por quem monta o bônus (o mesmo ao vivo e no offline). Não mexe na rng (as 11 chamadas ficam).
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
 *   somaDuracao (em décimos de segundo, inteiro: a soma é a mesma em qualquer divisão em fatias) }; completo com feitos === GameData.AFK.amostra. medida(estado) -> { p, duracaoS } | null (incompleta).
 * OFFLINE: minutos = clamp(agoraMin − vaga.inicioMin, 0, limite); corridas = floor(minutos × 60 / duração média ×
 *   GameData.AFK.ritmoOffline) (0,7: o jogo fechado rende 70% do aberto em tudo, spec 2026-11-26-afk-offline-70); a
 *   corrida k usa a mesma seedCorrida que a corrida ao vivo de contador vaga.contador + k usaria; vence se
 *   mulberry32(hash2(seedCorrida, 0x0FF1))() < p; o prêmio é o premio() de sempre. Sem medida completa: 0 corridas.
 *   limiteOffline(aveiaMin, bestiarioMin) = min(offlineTetoMin, offlineMin + aveia + bestiário).
 * BAÚ: { ouro, xp: { uid: n }, itens: { id: n }, pedras, pecas: [{ id, linhas }] }. Tudo o que as vagas rendem cai nele
 *   (bauSomar); bauColetar passa tudo de uma vez: os itens até o teto de cada um (GameData.ITEMS[id].cap; o que passa
 *   vira `perdidos`), o XP por cavalo (o de cavalo que não existe mais vira `xpDescartado`), o Ouro, as Pedras e as peças.
 * BESTIÁRIO: { vitorias: { '<ginásio>:<etapa>': n }, vistos: { id: true }, obtidos: { id: true } }. Visto = já caiu
 *   (foi para o baú); obtido = já entrou na mochila ou no inventário. Bônus da conta, só no AFK (bestiarioBonus), com
 *   os tetos de GameData.AFK.bestiario. Página de um ginásio: os 5 oponentes, os 3 materiais, as 10 peças do conjunto
 *   (5 Raras e 5 Lendárias) e os 5 troféus; completa com tudo obtido e o último marco de vitórias em todos os oponentes.
 * ESTADO DO SAVE (sanear): { vagas: [{ uid, faseId, inicioMin, contador, medida, ultima }] (1 a 5; vaga vazia: uid e
 *   faseId null; ultima = { p, duracaoS } da última medida completa: o offline usa esta enquanto a nova não termina), bau, vitorias: { faseId: n }, bestiario, aveiaMin (minutos de Aveia para o próximo offline), xpCounter (a
 *   seed do aprendizado de skill ao subir de nível com XP do AFK) }. O contador de cada vaga nunca volta (não repete seed).
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
    return GY.cavalo({ base: def.base, raridade: def.raridade, level: f.nivel, grau: def.grau, rank: f.rank });
  }

  // ---------------------------------------------------------------------------------------------
  // Corrida e prêmio
  // ---------------------------------------------------------------------------------------------
  // PEÇAS (só aqui o equipamento vale): cavalo.pve é o Gear.resolvePve do cavalo (quem chama põe; ausente: sem peças).
  // O principal entra como statAdd; 4 peças do conjunto reforçam o clima dele, 5 tiram a penalidade (entry.pve do sim).
  // O oponente usa as peças fixas da dificuldade (Gear.fixas; na Lendária, do conjunto do ginásio).
  function pecasDe(g) {
    if (!objeto(g) || !objeto(g.mods)) return null;
    var add = {}, tem = false, sp = objeto(g.special) || {};
    G.STAT_KEYS.forEach(function (k) { if (typeof g.mods[k] === 'number' && g.mods[k] > 0) { add[k] = g.mods[k]; tem = true; } });
    var cj = typeof sp.weatherDoubleClimate === 'string' && temChave(G.GEAR_SETS, sp.weatherDoubleClimate) ? G.GEAR_SETS[sp.weatherDoubleClimate].weather : null;
    var pve = cj || sp.ignoreWeatherPenalty === true ? { clima: cj, mult: G.ECONOMY.gear.setBonus.clima, semPenalidade: sp.ignoreWeatherPenalty === true } : null;
    if (!tem && !pve) return null;
    var out = {};
    if (tem) out.statAdd = add;
    if (pve) out.pve = pve;
    return out;
  }
  function pecasOponente(f) { return f.pecas ? pecasDe(GR.fixas(f.pecas, K.materiais[f.gymId].conjunto)) : null; }
  // a config do duelo n da fase (o cavalo com as peças dele contra o oponente n com as da dificuldade)
  function cfgDuelo(cavalo, f, n, seed, quadros) {
    return GY.dueloCfg(cavalo, oponente(f.id, n), seed, { pista: G.GYMS[f.gymId].pista, recordFrames: quadros === true, pecasMeu: pecasDe(cavalo.pve), pecasDele: pecasOponente(f) });
  }
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
    var seed = seedCorrida(seedBase, vaga, contador);
    var cfg = cfgDuelo(cavalo, f, contador, seed, o.recordFrames === true);
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
    var pc = pecasDe(cavalo.pve);   // as peças: o que entra na corrida (o principal e o clima do conjunto)
    partes.push(pc ? JSON.stringify(pc) : '');
    return partes.join('|');
  }
  function amostraDe(opts) { var o = objeto(opts) || {}; return inteiro(o.amostra) && o.amostra > 0 ? o.amostra : K.amostra; }
  function estadoOk(e, chave, total) {
    return objeto(e) && e.chave === chave && inteiro(e.feitos) && e.feitos >= 0 && e.feitos <= total && inteiro(e.vitorias) && e.vitorias >= 0 &&
      e.vitorias <= e.feitos && inteiro(e.somaDuracao) && e.somaDuracao >= 0;
  }
  // opts (só para as ferramentas de balanço): { amostra: outro tamanho, sal: outra série de seeds }.
  function medirPasso(estado, cavalo, id, n, opts) {
    var chave = chaveConfig(cavalo, id);
    if (chave === null || (cavalo.skills != null && !Array.isArray(cavalo.skills))) return null;
    var total = amostraDe(opts), o = objeto(opts) || {};
    var e = estadoOk(estado, chave, total) ? { chave: chave, feitos: estado.feitos, vitorias: estado.vitorias, somaDuracao: estado.somaDuracao }
      : { chave: chave, feitos: 0, vitorias: 0, somaDuracao: 0 };
    var base = S.hash2(hashTexto(chave), SAL_MEDIDA + (inteiro(o.sal) && o.sal > 0 ? o.sal : 0)), f = fase(id);
    var ate = Math.min(total, e.feitos + (inteiro(n) && n > 0 ? n : 0));
    for (var i = e.feitos; i < ate; i++) {
      var res = S.simulate(cfgDuelo(cavalo, f, i, S.hash2(base, i), false));
      if (res.finishOrder[0] === 0) e.vitorias++;
      var t0 = res.finishTimes[0], t1 = res.finishTimes[1];
      e.somaDuracao += Math.round(Math.max(isFinite(t0) ? t0 : 0, isFinite(t1) ? t1 : 0) * 10);   // décimos inteiros: a soma não depende das fatias
    }
    e.feitos = ate;
    return e;
  }
  function medidaPronta(estado, opts) { return !!objeto(estado) && typeof estado.chave === 'string' && estadoOk(estado, estado.chave, amostraDe(opts)) && estado.feitos === amostraDe(opts); }
  function medida(estado, opts) {
    if (!medidaPronta(estado, opts)) return null;
    return { p: estado.vitorias / estado.feitos, duracaoS: Math.round(estado.somaDuracao / estado.feitos) / 10 };
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
    out.corridas = Math.floor(out.minutos * 60 / m.duracaoS * K.ritmoOffline + 1e-9);
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
  // Baú
  // ---------------------------------------------------------------------------------------------
  var ITEM_MAX = 1000000, PECAS_MAX = 500, CONT_MAX = 1e9;
  function itemAfk(id) { return typeof id === 'string' && temChave(G.ITEMS, id) && !!G.ITEMS[id].grupo; }
  function qtdOk(x, max) { return inteiro(x) && x > 0 ? Math.min(x, max) : 0; }
  function bauVazio() { return { ouro: 0, xp: {}, itens: {}, pedras: 0, pecas: [] }; }
  function bauSaneado(bruto) {
    var b = objeto(bruto) || {}, out = bauVazio(), k;
    out.ouro = qtdOk(b.ouro, CONT_MAX); out.pedras = qtdOk(b.pedras, ITEM_MAX);
    var xp = objeto(b.xp) || {}, it = objeto(b.itens) || {};
    for (k in xp) if (temChave(xp, k) && k && qtdOk(xp[k], CONT_MAX)) out.xp[k] = qtdOk(xp[k], CONT_MAX);
    for (k in it) if (temChave(it, k) && itemAfk(k) && qtdOk(it[k], ITEM_MAX)) out.itens[k] = qtdOk(it[k], ITEM_MAX);
    (Array.isArray(b.pecas) ? b.pecas : []).forEach(function (p) {
      var ls = objeto(p) ? GR.linhasValidas(p.id, p.linhas) : null;
      if (ls && out.pecas.length < PECAS_MAX) out.pecas.push({ id: p.id, linhas: ls });
    });
    return out;
  }
  function bauVazioE(bau) {
    var b = bauSaneado(bau);
    return !b.ouro && !b.pedras && !b.pecas.length && !Object.keys(b.xp).length && !Object.keys(b.itens).length;
  }
  // ganho: o que o correr, o premio ou o offline devolvem ({ xp, ouro, itens, pedras, pecas }); o XP vai para cavaloUid.
  function bauSomar(bau, ganho, cavaloUid) {
    var out = bauSaneado(bau), g = bauSaneado({ ouro: ganho && ganho.ouro, itens: ganho && ganho.itens, pedras: ganho && ganho.pedras, pecas: ganho && ganho.pecas }), k;
    out.ouro = Math.min(CONT_MAX, out.ouro + g.ouro); out.pedras = Math.min(ITEM_MAX, out.pedras + g.pedras);
    for (k in g.itens) if (temChave(g.itens, k)) out.itens[k] = Math.min(ITEM_MAX, (out.itens[k] || 0) + g.itens[k]);
    g.pecas.forEach(function (p) { if (out.pecas.length < PECAS_MAX) out.pecas.push(p); });
    var xp = qtdOk(ganho && ganho.xp, CONT_MAX);
    if (xp && typeof cavaloUid === 'string' && cavaloUid) out.xp[cavaloUid] = Math.min(CONT_MAX, (out.xp[cavaloUid] || 0) + xp);
    return out;
  }
  // mochila: { id: qtd } (a do save; só os itens do AFK mudam). uidsVivos: os uids dos cavalos que existem.
  // uidsPresos: os cavalos que não podem receber XP agora (o ativo com a sala aberta): o XP deles fica no baú.
  // -> { mochila (nova), entrou: { id: n }, perdidos: { id: n }, xpPorCavalo: { uid: n }, xpRetido: { uid: n },
  //      xpDescartado, ouro, pedras, pecas, bau (o baú depois: vazio, ou só com o XP retido) }
  function bauColetar(bau, mochila, uidsVivos, uidsPresos) {
    var b = bauSaneado(bau), m = {}, src = objeto(mochila) || {}, vivos = Array.isArray(uidsVivos) ? uidsVivos : [], k;
    for (k in src) if (temChave(src, k)) m[k] = src[k];
    var presos = Array.isArray(uidsPresos) ? uidsPresos : [];
    var out = { mochila: m, entrou: {}, perdidos: {}, xpPorCavalo: {}, xpRetido: {}, xpDescartado: 0, ouro: b.ouro, pedras: b.pedras, pecas: b.pecas, bau: bauVazio() };
    Object.keys(b.itens).forEach(function (id) {
      var tem = qtdOk(m[id], ITEM_MAX), cabe = Math.max(0, G.ITEMS[id].cap - tem), entra = Math.min(cabe, b.itens[id]);
      if (entra > 0) { m[id] = tem + entra; out.entrou[id] = entra; }
      if (b.itens[id] > entra) out.perdidos[id] = b.itens[id] - entra;
    });
    Object.keys(b.xp).forEach(function (uid) {
      if (vivos.indexOf(uid) < 0) out.xpDescartado += b.xp[uid];
      else if (presos.indexOf(uid) >= 0) { out.xpRetido[uid] = b.xp[uid]; out.bau.xp[uid] = b.xp[uid]; }
      else out.xpPorCavalo[uid] = b.xp[uid];
    });
    return out;
  }

  // ---------------------------------------------------------------------------------------------
  // Bestiário
  // ---------------------------------------------------------------------------------------------
  function oponenteIdOk(id) {
    if (typeof id !== 'string') return false;
    var p = id.split(':');
    return p.length === 2 && /^[0-9]$/.test(p[1]) && faseId(p[0], Number(p[1]), K.difs[0].id) !== null;
  }
  function coisaOk(id) { return itemAfk(id) || (typeof id === 'string' && temChave(G.GEAR, id)); }
  function bestiarioVazio() { return { vitorias: {}, vistos: {}, obtidos: {} }; }
  function bestiarioSaneado(bruto) {
    var b = objeto(bruto) || {}, out = bestiarioVazio(), v = objeto(b.vitorias) || {}, k;
    for (k in v) if (temChave(v, k) && oponenteIdOk(k) && qtdOk(v[k], CONT_MAX)) out.vitorias[k] = qtdOk(v[k], CONT_MAX);
    ['vistos', 'obtidos'].forEach(function (c) {
      var o = objeto(b[c]) || {};
      for (var id in o) if (temChave(o, id) && coisaOk(id) && (o[id] === true || (c === 'vistos' && o[id] === 1))) out[c][id] = true;
    });
    Object.keys(out.obtidos).forEach(function (id) { out.vistos[id] = true; });
    return out;
  }
  // oponenteId = '<ginásio>:<etapa>'. venceu: houve vitória; conta 1, ou ganho.vitorias quando vier (a soma do offline).
  function bestiarioRegistrar(best, ganho, oponenteId, venceu) {
    var out = bestiarioSaneado(best);
    if (!oponenteIdOk(oponenteId)) return out;
    var g = objeto(ganho) || {}, n = venceu !== true ? 0 : (inteiro(g.vitorias) && g.vitorias > 0 ? g.vitorias : 1);
    if (n > 0) out.vitorias[oponenteId] = Math.min(CONT_MAX, (out.vitorias[oponenteId] || 0) + n);
    Object.keys(objeto(g.itens) || {}).forEach(function (id) { if (itemAfk(id) && g.itens[id] > 0) out.vistos[id] = true; });
    (Array.isArray(g.pecas) ? g.pecas : []).forEach(function (p) { if (objeto(p) && coisaOk(p.id)) out.vistos[p.id] = true; });
    return out;
  }
  // itens: { id: n } que entraram na mochila; pecas: [{ id }] que entraram no inventário (da coleta ou da forja).
  function bestiarioObter(best, itens, pecas) {
    var out = bestiarioSaneado(best), it = objeto(itens) || {};
    Object.keys(it).forEach(function (id) { if (itemAfk(id) && it[id] > 0) { out.obtidos[id] = true; out.vistos[id] = true; } });
    (Array.isArray(pecas) ? pecas : []).forEach(function (p) { if (objeto(p) && typeof p.id === 'string' && temChave(G.GEAR, p.id)) { out.obtidos[p.id] = true; out.vistos[p.id] = true; } });
    return out;
  }
  // -> { gymId, oponentes: [{ id, etapa, nome, vitorias, marcos: [bool…] }], itens: [{ id, tipo: 'item' | 'peca', visto,
  //      obtido }], completa } | null
  function bestiarioPagina(best, gymId) {
    if (typeof gymId !== 'string' || !temChave(G.GYMS, gymId)) return null;
    var b = bestiarioSaneado(best), B = K.bestiario, M = K.materiais[gymId], gym = G.GYMS[gymId];
    var ops = gym.etapas.map(function (et, e) {
      var v = b.vitorias[gymId + ':' + e] || 0;
      return { id: gymId + ':' + e, etapa: e, nome: et.nome, vitorias: v, marcos: B.marcos.map(function (m) { return v >= m; }) };
    });
    var ids = M.comuns.concat([M.incomum]).map(function (id) { return [id, 'item']; });
    ['raro', 'lendario'].forEach(function (r) { G.GEAR_SLOTS.forEach(function (s) { ids.push([s + '-' + M.conjunto + '-' + r, 'peca']); }); });
    gym.etapas.forEach(function (et, e) { ids.push(['trofeu-' + gymId + '-' + e, 'item']); });
    var itens = ids.map(function (x) { return { id: x[0], tipo: x[1], visto: !!b.vistos[x[0]], obtido: !!b.obtidos[x[0]] }; });
    var topo = B.marcos[B.marcos.length - 1];
    var completa = ops.every(function (o) { return o.vitorias >= topo; }) && itens.every(function (i) { return i.obtido; });
    return { gymId: gymId, oponentes: ops, itens: itens, completa: completa };
  }
  function r4(x) { return Math.round(x * 10000) / 10000; }
  // D8: o bônus de drop raro da Sorte do cavalo (fração; 0 a K.sorteRaro), arredondado a 4 casas como o do bestiário
  function sorteRaro(cavalo) {
    var g = Number(objeto(cavalo) && objeto(cavalo.potential) && cavalo.potential.sorte);
    return isFinite(g) ? r4(K.sorteRaro * Math.min(31, Math.max(0, g)) / 31) : 0;
  }
  // -> { raro, xp, trofeu (frações), offlineMin }
  function bestiarioBonus(best) {
    var b = bestiarioSaneado(best), B = K.bestiario, nRaro = 0, nXp = 0, nTrof = 0, paginas = 0;
    Object.keys(b.vitorias).forEach(function (k) { if (b.vitorias[k] >= B.raro.vitorias) nRaro++; if (b.vitorias[k] >= B.xp.vitorias) nXp++; });
    Object.keys(b.obtidos).forEach(function (id) { if (itemAfk(id) && G.ITEMS[id].grupo === 'trofeu') nTrof++; });
    G.GYM_ORDER.forEach(function (g) { if (bestiarioPagina(b, g).completa) paginas++; });
    return {
      raro: r4(Math.min(B.raro.teto, nRaro * B.raro.por)), xp: r4(Math.min(B.xp.teto, nXp * B.xp.por)),
      trofeu: r4(Math.min(B.trofeu.teto, nTrof * B.trofeu.por)), offlineMin: Math.min(B.pagina.tetoMin, paginas * B.pagina.min)
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Comida
  // ---------------------------------------------------------------------------------------------
  // Feno, Cenoura e Maçã: -> { ok, xp } para o cavalo escolhido (quem chama aplica o XP e gasta o item). Aveia dourada:
  // -> { ok, aveiaMin } (o novo afk.aveiaMin), sempre dentro do teto do offline (bestiarioMin: o bônus do bestiário).
  function usarComida(id, cavalo, afk, bestiarioMin) {
    if (!itemAfk(id) || G.ITEMS[id].grupo !== 'comida') return { ok: false, motivo: 'Isso não é comida.' };
    var it = G.ITEMS[id];
    if (it.aveiaMin) {
      var atual = minutosOk(objeto(afk) && afk.aveiaMin);
      if (K.offlineMin + atual + minutosOk(bestiarioMin) + it.aveiaMin > K.offlineTetoMin) {
        return { ok: false, motivo: 'O próximo período fora já está no limite de ' + Math.round(K.offlineTetoMin / 60) + ' horas.' };
      }
      return { ok: true, aveiaMin: atual + it.aveiaMin };
    }
    if (!objeto(cavalo)) return { ok: false, motivo: 'Escolha um cavalo.' };
    if (cavalo.level >= G.ECONOMY.maxLevel) return { ok: false, motivo: (cavalo.name || 'O cavalo') + ' já está no nível máximo.' };
    return { ok: true, xp: it.xp };
  }

  // ---------------------------------------------------------------------------------------------
  // Estado do save
  // ---------------------------------------------------------------------------------------------
  // vaga vazia: sem início (0), para o save saneado ser o mesmo em qualquer hora; o início é posto quando um cavalo entra
  // vaga vazia: o contador e o RELÓGIO ficam (inicioMin = até onde o treino da vaga já foi contado: tirar o cavalo e pôr
  // de novo não adianta a corrida seguinte); vaga que nunca teve cavalo: 0
  function relogioOk(x) { return typeof x === 'number' && isFinite(x) && x > 0 ? x : 0; }
  function vagaVazia(contador, inicioMin) { return { uid: null, faseId: null, inicioMin: relogioOk(inicioMin), contador: contador || 0, medida: null, ultima: null }; }
  // ctx = { uids: [uid dos cavalos que existem], progresso (dos ginásios), agoraMin }
  function sanear(bruto, ctx) {
    var s = objeto(bruto) || {}, c = objeto(ctx) || {}, uids = Array.isArray(c.uids) ? c.uids : [];
    var agora = typeof c.agoraMin === 'number' && isFinite(c.agoraMin) ? c.agoraMin : 0;
    var out = { vagas: [], bau: bauSaneado(s.bau), vitorias: {}, bestiario: bestiarioSaneado(s.bestiario), aveiaMin: 0, xpCounter: 0 };
    var v = objeto(s.vitorias) || {}, k;
    for (k in v) if (temChave(v, k) && fase(k) && qtdOk(v[k], CONT_MAX)) out.vitorias[k] = qtdOk(v[k], CONT_MAX);
    var livres = liberadas(c.progresso, out.vitorias), usados = {};
    var brutas = Array.isArray(s.vagas) ? s.vagas.slice(0, K.vagaPreco.length) : [];
    if (!brutas.length) brutas = [null];
    brutas.forEach(function (bv) {
      var b = objeto(bv) || {};
      var contador = inteiro(b.contador) && b.contador >= 0 ? Math.min(b.contador, CONT_MAX) : 0;
      var inicio = typeof b.inicioMin === 'number' && isFinite(b.inicioMin) ? b.inicioMin : agora;
      var ok = typeof b.uid === 'string' && uids.indexOf(b.uid) >= 0 && !usados[b.uid] && livres.indexOf(b.faseId) >= 0;
      if (!ok) { out.vagas.push(vagaVazia(contador, b.inicioMin)); return; }
      usados[b.uid] = true;
      var med = objeto(b.medida) && typeof b.medida.chave === 'string' && estadoOk(b.medida, b.medida.chave, K.amostra)
        ? { chave: b.medida.chave, feitos: b.medida.feitos, vitorias: b.medida.vitorias, somaDuracao: b.medida.somaDuracao } : null;
      out.vagas.push({ uid: b.uid, faseId: b.faseId, inicioMin: inicio, contador: contador, medida: med, ultima: ultimaOk(b.ultima) });
    });
    out.aveiaMin = Math.min(K.offlineTetoMin - K.offlineMin, qtdOk(s.aveiaMin, CONT_MAX));
    out.xpCounter = qtdOk(s.xpCounter, CONT_MAX);
    return out;
  }
  // a última chance completa da vaga ({ p, duracaoS, chave: a configuração medida }): o offline parte desta enquanto uma
  // medida nova não termina (chanceOffline)
  function ultimaOk(u) {
    return objeto(u) && typeof u.p === 'number' && u.p >= 0 && u.p <= 1 && typeof u.duracaoS === 'number' && isFinite(u.duracaoS) && u.duracaoS > 0
      ? { p: u.p, duracaoS: u.duracaoS, chave: typeof u.chave === 'string' ? u.chave : null } : null;
  }
  // A chance que o offline usa para a vaga com o cavalo como está AGORA: a última completa, se é da configuração de
  // agora; se a configuração mudou (peça trocada, nível, skill) e a medida nova não terminou, o MENOR entre a chance
  // antiga e a parcial da medida em curso (0 sem amostra): tirar as peças boas de um cavalo não deixa a chance delas
  // valendo. -> { p, duracaoS } | null (sem última completa: a vaga não rende fora da tela)
  function chanceOffline(vaga, cavalo) {
    var u = objeto(vaga) ? ultimaOk(vaga.ultima) : null;
    if (!u || !objeto(cavalo) || !fase(vaga.faseId)) return null;
    var chave = chaveConfig(cavalo, vaga.faseId);
    if (u.chave === chave) return { p: u.p, duracaoS: u.duracaoS };
    var m = vaga.medida, parcial = objeto(m) && m.chave === chave && estadoOk(m, chave, K.amostra) && m.feitos > 0 ? m.vitorias / m.feitos : 0;
    return { p: Math.min(u.p, parcial), duracaoS: u.duracaoS };
  }
  // O relógio da vaga depois de um acerto offline: anda só o tempo das corridas contadas (o resto, menos de um duelo,
  // continua valendo para a próxima); se o período passou do limite offline, vem para agora (o excedente não rende).
  function relogioAposOffline(inicioMin, agoraMin, corridas, duracaoS, limiteMin) {
    if (typeof inicioMin !== 'number' || !isFinite(inicioMin) || typeof agoraMin !== 'number' || !isFinite(agoraMin)) return relogioOk(agoraMin);
    if (agoraMin <= inicioMin) return inicioMin;
    var limite = Math.min(K.offlineTetoMin, minutosOk(limiteMin));
    if (agoraMin - inicioMin > limite || !(inteiro(corridas) && corridas >= 0) || !(typeof duracaoS === 'number' && isFinite(duracaoS) && duracaoS > 0)) return agoraMin;
    return Math.min(agoraMin, inicioMin + corridas * duracaoS / 60);
  }
  function copiaAfk(afk) { return JSON.parse(JSON.stringify(afk)); }
  // Avança a medida da vaga em n duelos (o cavalo dela, como está agora). Completa: grava vaga.ultima. Vaga vazia, ou
  // medida já completa para a configuração de agora: a mesma vaga (sem cópia). -> a vaga nova
  function medirVaga(vaga, cavalo, n) {
    if (!objeto(vaga) || !vaga.uid || !fase(vaga.faseId) || !objeto(cavalo)) return vaga;
    if (medidaPronta(vaga.medida) && vaga.medida.chave === chaveConfig(cavalo, vaga.faseId)) return vaga;
    var e = medirPasso(vaga.medida, cavalo, vaga.faseId, n);
    if (!e) return vaga;
    var out = { uid: vaga.uid, faseId: vaga.faseId, inicioMin: vaga.inicioMin, contador: vaga.contador, medida: e, ultima: ultimaOk(vaga.ultima) };
    if (medidaPronta(e)) { out.ultima = medida(e); out.ultima.chave = e.chave; }
    return out;
  }
  function plural(n, um, varios) { return n === 1 ? um : varios; }
  // Põe o cavalo `uid` na vaga idx, na fase dada (ctx como no sanear). O relógio da vaga é o maior entre ctx.agoraMin, o
  // que a vaga já tinha e o da vaga de onde o cavalo veio (trocar de vaga ou de cavalo nunca adianta uma corrida); a medida
  // e a última chance zeram (a configuração é outra); o contador fica. O cavalo sai da vaga em que estava.
  // -> { ok: true, afk } | { ok: false, motivo }
  function ocupar(afk, idx, uid, id, ctx) {
    var c = objeto(ctx) || {}, uids = Array.isArray(c.uids) ? c.uids : [];
    if (!objeto(afk) || !Array.isArray(afk.vagas) || !inteiro(idx) || idx < 0 || idx >= afk.vagas.length) return { ok: false, motivo: 'Essa vaga não existe.' };
    var f = fase(id);
    if (!f) return { ok: false, motivo: 'Essa fase não existe.' };
    if (typeof uid !== 'string' || uids.indexOf(uid) < 0) return { ok: false, motivo: 'Esse cavalo não está no estábulo.' };
    if (!liberada(id, c.progresso, afk.vitorias)) {
      var prog = GY.sanear(c.progresso, 0)[f.gymId];
      if (f.etapa >= prog.etapa) return { ok: false, motivo: 'Vença esse oponente no ginásio primeiro.' };
      for (var d = 1; d < K.difs.length; d++) {
        var falta = K.liberaApos - vitoriasDe(afk.vitorias, f.gymId + ':' + f.etapa + ':' + K.difs[d - 1].id);
        if (falta > 0) return { ok: false, motivo: plural(falta, 'Falta ', 'Faltam ') + falta + plural(falta, ' vitória na ', ' vitórias na ') + K.difs[d - 1].name + ' para liberar a ' + K.difs[d].name + '.' };
        if (K.difs[d].id === f.dif) break;
      }
      return { ok: false, motivo: 'Essa fase ainda não está liberada.' };
    }
    var out = copiaAfk(afk);
    // o relógio nunca volta: o da vaga de destino, o da vaga de onde o cavalo veio (vai junto com ele) e agora — o maior
    var relogio = Math.max(relogioOk(c.agoraMin), relogioOk(afk.vagas[idx].inicioMin));
    out.vagas.forEach(function (v, i) {
      if (v.uid !== uid) return;
      relogio = Math.max(relogio, relogioOk(v.inicioMin));
      out.vagas[i] = vagaVazia(v.contador, v.inicioMin);
    });
    out.vagas[idx] = { uid: uid, faseId: id, inicioMin: relogio, contador: afk.vagas[idx].contador, medida: null, ultima: null };
    return { ok: true, afk: out };
  }
  // -> o afk com a vaga idx vazia (o contador e o relógio ficam) | null
  function esvaziar(afk, idx) {
    if (!objeto(afk) || !Array.isArray(afk.vagas) || !inteiro(idx) || idx < 0 || idx >= afk.vagas.length) return null;
    var out = copiaAfk(afk);
    out.vagas[idx] = vagaVazia(afk.vagas[idx].contador, afk.vagas[idx].inicioMin);
    return out;
  }
  // -> o afk com mais uma vaga vazia | null (já no máximo). O Ouro é de quem chama (podeComprarVaga).
  function comprarVaga(afk) {
    if (!objeto(afk) || !Array.isArray(afk.vagas) || afk.vagas.length >= K.vagaPreco.length) return null;
    var out = copiaAfk(afk);
    out.vagas.push(vagaVazia(0));
    return out;
  }
  // O ganho de uma corrida (correr) ou de um período fora (offline) da vaga idx: baú, vitórias da fase, bestiário e o
  // contador da vaga. -> o afk novo | null (vaga inexistente ou vazia). Não muta.
  function creditar(afk, idx, ganho) {
    if (!objeto(afk) || !Array.isArray(afk.vagas) || !inteiro(idx) || idx < 0 || idx >= afk.vagas.length || !objeto(ganho)) return null;
    var vg = afk.vagas[idx], f = vg && vg.uid ? fase(vg.faseId) : null;
    if (!f) return null;
    var out = copiaAfk(afk), n = inteiro(ganho.vitorias) ? ganho.vitorias : (ganho.venceu === true ? 1 : 0);
    out.bau = bauSomar(afk.bau, ganho, vg.uid);
    if (n > 0) out.vitorias[f.id] = Math.min(CONT_MAX, (out.vitorias[f.id] || 0) + n);
    out.bestiario = bestiarioRegistrar(afk.bestiario, { vitorias: n, itens: ganho.itens, pecas: ganho.pecas }, f.gymId + ':' + f.etapa, n > 0);
    out.vagas[idx].contador = inteiro(ganho.contador) && ganho.contador > vg.contador ? Math.min(CONT_MAX, ganho.contador) : Math.min(CONT_MAX, vg.contador + 1);
    return out;
  }
  // Depois de contar um período fora: a Aveia dourada daquele período acabou.
  function aposOffline(afk) { var out = copiaAfk(afk); out.aveiaMin = 0; return out; }

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
    bauVazio: bauVazio,
    bauVazioE: bauVazioE,
    bauSomar: bauSomar,
    bauColetar: bauColetar,
    bestiarioVazio: bestiarioVazio,
    bestiarioRegistrar: bestiarioRegistrar,
    bestiarioObter: bestiarioObter,
    bestiarioPagina: bestiarioPagina,
    bestiarioBonus: bestiarioBonus,
    sorteRaro: sorteRaro,
    usarComida: usarComida,
    sanear: sanear,
    creditar: creditar,
    medirVaga: medirVaga,
    ocupar: ocupar,
    esvaziar: esvaziar,
    comprarVaga: comprarVaga,
    aposOffline: aposOffline,
    chanceOffline: chanceOffline,
    relogioAposOffline: relogioAposOffline,
    podeComprarVaga: podeComprarVaga
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Afk;
  else root.Afk = Afk;
})(typeof self !== 'undefined' ? self : this);
