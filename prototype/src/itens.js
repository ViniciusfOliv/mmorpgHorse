/*
 * MMORPG Horse — itens de uso, limites da loja e calendário da recompensa diária (protótipo).
 * Módulo PURO: sem DOM, sem estado, sem Math.random e sem relógio (o dia chega como inteiro, lido num
 * só lugar do game.js); as entradas nunca são mutadas. Os números ficam em GameData.ITEMS, GameData.DAILY
 * e GameData.BAG_MAX. Todo sorteio usa RaceSim.mulberry32 + RaceSim.hash2.
 *
 * ORDEM DE CHAMADAS DE rng() (rng = mulberry32(hash2(seedBase, SAL + contador)), SAL = 0x49540000, "IT"):
 *   - trocarSkill(mount, skillId, seedBase, contador): UMA chamada, a escolha da candidata
 *     (cands[floor(rng() · n)], cands = RaceSim.skillCandidates(mount)). Sem sortear, devolve null se
 *     skillId não está nas vagas (ou não é skill do catálogo, como a de tipo) ou se não há candidata.
 *   - tentarDoma(mount, seedBase, contador): 1) aprende se rng() < GameData.ITEMS.manual.chance;
 *     2) só se aprendeu, a candidata (cands[floor(rng() · n)]). Sem sortear, devolve null se as vagas
 *     estão cheias ou se não há candidata.
 *   - O contador é o de usos sorteados do save: quem chama grava o contador novo junto com o resultado.
 *   - pergaminhoPodio(seed, place): UMA chamada por lugar, rng = mulberry32(hash2(seed, SAL_PERGAMINHO + place)),
 *     com a seed DA SALA (não a do save), só se place é 1, 2 ou 3 (senão devolve 0 sem sortear). Sai 1 se
 *     rng() < GameData.ITEMS.pergaminho.podio[place − 1]. Quem chama só chama em corrida valendo, na liquidação.
 *     SAL_PERGAMINHO = 0x50450000 ("PE"): com a seed da sala só se usam índice do corredor + 1, 0xC0FFEE (mapa),
 *     0xD1CE (Dado), 0xA11CE (sala), 0xB1AC + lugar (Pedra Negra) e 0x4A4F0000 + raia (jóquei).
 *   - subirRank e podeSubirRank não sorteiam (a subida de rank nunca falha).
 *   - Nenhuma outra função sorteia.
 * SAL: hash2(seedBase, x) já é usado com x = contador da sala (buildLobby), nº do páreo × 100 + nível
 *   (applyXp), 0xE4A0 + contador (melhoria) e 0xB0B0 / 0x4D410000 / 0x504F0000 + contador (cruza). Todos
 *   ficam abaixo de 0x10000000 ou a partir de 0x4D410000; o SAL fica no meio, com folga de 50 milhões de
 *   usos (0x17E5 do plano caía em 61 × 100 + 17: o aprendizado do páreo 61 no nível 17).
 *   Ginásios (ginasio.js): 0x47490000 ("GI") + contador de desafios × 8 + nº do duelo (0–4), abaixo deste SAL,
 *   com folga de ~4 milhões de desafios.
 *   Skill ao subir de nível num desafio de ginásio (game.js, desafia; Ruling 18): o applyXp com seedTag =
 *   20.000.000 + contador de desafios × 4 + posição no time (0–2), ou seja x = 2.000.000.000 + contador × 400 +
 *   posição × 100 + nível (0x77359400 em diante), acima de todos os outros (hash2 lê x >>> 0: ~5,7 milhões de
 *   desafios antes de dar a volta nos 32 bits).
 *
 * DIA: inteiro de dias desde 1970-01-01 da data local (diaLocal; mes de 0 a 11, como no Date).
 * DIÁRIA: { prox: 0–6 (próximo dia do calendário), ciclos: calendários completos, ultimo: dia do último
 *   resgate | null }. Pode resgatar se ultimo é null ou hoje > ultimo (relógio para trás não libera).
 *   Dia guardado: inteiro de 0 a DIA_MAX. Dado de dia ou de limite corrompido nunca libera nada (vale hoje, ou o
 *   limite do dia); só null é "nunca".
 *   Prêmio: { ouro, itens: { id: qtd } }; no 7º dia, se o calendário que fecha (ciclos + 1) é múltiplo de
 *   GameData.DAILY.estrelaACada, também { estrela: 1 }.
 * LOJA: { dia: inteiro | null, comprados: { torrao, manual, cupom }, estrelaDia: inteiro | null }.
 *   As compras do dia zeram quando hoje > loja.dia; com hoje <= loja.dia nada volta. A Estrela conta
 *   everyDays desde estrelaDia. Só Ouro; a Rédea nova (price null) nunca é vendida.
 */
(function (root) {
  'use strict';

  var G = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./data.js') : root.GameData;
  var S = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./sim.js') : root.RaceSim;

  var SAL = 0x49540000;
  var SAL_PERGAMINHO = 0x50450000;
  var DIA_MAX = Math.floor(Date.UTC(9999, 11, 31) / 86400000);   // diaLocal(9999, 11, 31): o maior dia guardado
  var I = G.ITEMS, D = G.DAILY;
  // os que têm limite por dia (perDay), lidos do catálogo a cada uso (hoje: torrao, manual, cupom): item novo com perDay
  // entra no limite sem mexer aqui
  function limitados() { return Object.keys(I).filter(function (id) { return !!I[id].perDay; }); }

  function temChave(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function inteiro(x) { return typeof x === 'number' && isFinite(x) && x === Math.floor(x); }
  function skillsDe(mount) { return mount && Array.isArray(mount.skills) ? mount.skills : []; }
  function objeto(o) { return o && typeof o === 'object' && !Array.isArray(o) ? o : null; }
  // dia guardado válido (inteiro de 0 a DIA_MAX) ou, se corrompido, `hoje`
  function diaOu(x, hoje) { return inteiro(x) && x >= 0 && x <= DIA_MAX ? x : hoje; }
  function sorteio(seedBase, contador) { return S.mulberry32(S.hash2(seedBase, SAL + contador)); }

  // ---------------------------------------------------------------------------------------------
  // Dia
  // ---------------------------------------------------------------------------------------------
  function diaLocal(ano, mes, dia) {
    return Math.floor(Date.UTC(ano, mes, dia) / 86400000);
  }

  // ---------------------------------------------------------------------------------------------
  // Uso dos itens (Torrão, Estrela, Cupom, Manual). A Rédea nova usa o Redistribuir do game.js.
  // ---------------------------------------------------------------------------------------------
  var MOTIVO = {
    sala: 'Este item não pode ser usado no cavalo que está no páreo aberto.',
    torroes: 'Este cavalo já tem ' + I.torrao.cap + ' torrões.',
    estrelas: 'Este cavalo já tem ★★★.',
    semSkill: 'Este cavalo não tem skill nas vagas para trocar.',
    semCandidata: 'Não há skill nova que este cavalo possa aprender.',
    vagasCheias: 'As vagas de skill deste cavalo estão cheias.',
    semCavalo: 'Escolha um cavalo para usar este item.',
    pergaminho: 'O Pergaminho de técnica é gasto ao subir o rank de uma skill, na aba Skills do cavalo.',
    outro: 'Este item não se usa por aqui.'
  };
  // ctx = { tem: quantos o jogador tem, ativaComSala: o cavalo é o ativo e há sala aberta }
  function podeUsar(id, mount, ctx) {
    if (id === 'pergaminho') return { ok: false, motivo: MOTIVO.pergaminho };
    if (id !== 'torrao' && id !== 'estrela' && id !== 'cupom' && id !== 'manual') return { ok: false, motivo: MOTIVO.outro };
    if (!mount || typeof mount !== 'object') return { ok: false, motivo: MOTIVO.semCavalo };
    var c = ctx || {};
    if (!(Number(c.tem) >= 1)) return { ok: false, motivo: 'Você não tem ' + I[id].name + '.' };
    if ((id === 'cupom' || id === 'manual') && c.ativaComSala) return { ok: false, motivo: MOTIVO.sala };
    if (id === 'torrao' && S.torroesOf(mount) >= I.torrao.cap) return { ok: false, motivo: MOTIVO.torroes };
    if (id === 'estrela' && S.starsOf(mount) >= S.TUNING.starMult.length) return { ok: false, motivo: MOTIVO.estrelas };
    if (id === 'cupom') {
      if (!skillsDe(mount).some(function (s) { return temChave(G.SKILLS, s); })) return { ok: false, motivo: MOTIVO.semSkill };
      if (!S.skillCandidates(mount).length) return { ok: false, motivo: MOTIVO.semCandidata };
    }
    if (id === 'manual') {
      if (skillsDe(mount).length >= S.rarityOf(mount).skillSlots) return { ok: false, motivo: MOTIVO.vagasCheias };
      if (!S.skillCandidates(mount).length) return { ok: false, motivo: MOTIVO.semCandidata };
    }
    return { ok: true };
  }
  function usarTorrao(mount) { return { torroes: Math.min(I.torrao.cap, S.torroesOf(mount) + 1) }; }
  function usarEstrela(mount) { return { grau: Math.min(S.TUNING.starMult.length, S.starsOf(mount) + 1) }; }

  function trocarSkill(mount, skillId, seedBase, contador) {
    var skills = skillsDe(mount), pos = skills.indexOf(skillId);
    if (pos < 0 || !temChave(G.SKILLS, skillId)) return null;
    var cands = S.skillCandidates(mount);   // já sem as que ele tem: a que sai não volta
    if (!cands.length) return null;
    var entra = cands[Math.floor(sorteio(seedBase, contador)() * cands.length)];
    var novas = skills.slice();
    novas[pos] = entra;
    return { sai: skillId, entra: entra, skills: novas };
  }

  function tentarDoma(mount, seedBase, contador) {
    var skills = skillsDe(mount);
    if (skills.length >= S.rarityOf(mount).skillSlots) return null;
    var cands = S.skillCandidates(mount);
    if (!cands.length) return null;
    var rng = sorteio(seedBase, contador);
    if (rng() >= I.manual.chance) return { aprendeu: null, skills: skills.slice() };
    var id = cands[Math.floor(rng() * cands.length)];
    return { aprendeu: id, skills: skills.concat([id]) };
  }

  // ---------------------------------------------------------------------------------------------
  // Pergaminho de técnica
  // ---------------------------------------------------------------------------------------------
  // Pergaminho do pódio de uma corrida valendo: 0 ou 1, pela seed da sala (um sorteio por lugar, independentes).
  function pergaminhoPodio(seed, place) {
    if (place !== 1 && place !== 2 && place !== 3) return 0;
    var roll = S.mulberry32(S.hash2(seed >>> 0, SAL_PERGAMINHO + place))();
    return roll < I.pergaminho.podio[place - 1] ? 1 : 0;
  }

  // ---------------------------------------------------------------------------------------------
  // Recompensa diária
  // ---------------------------------------------------------------------------------------------
  // ultimo null: nunca resgatou. Na dúvida, nada é liberado (Rulings 7 e 8): diária que não é objeto, ou ultimo
  // corrompido (nem dia de 0 a DIA_MAX nem null), conta como resgatada hoje (o próximo resgate é amanhã). O save
  // novo e a migração da v6 chegam aqui com { prox: 0, ciclos: 0, ultimo: null }, pelo game.js.
  function diariaSaneada(diaria, hoje) {
    var obj = objeto(diaria), d = obj || {};
    return {
      prox: inteiro(d.prox) && d.prox >= 0 && d.prox < D.dias.length ? d.prox : 0,
      ciclos: inteiro(d.ciclos) && d.ciclos >= 0 ? d.ciclos : 0,
      ultimo: obj && d.ultimo === null ? null : diaOu(d.ultimo, hoje)
    };
  }
  // Pode resgatar: só com hoje inteiro, e se nunca resgatou ou hoje passou do último resgate.
  function podeResgatar(d, hoje) { return inteiro(hoje) && (d.ultimo === null || hoje > d.ultimo); }
  // Prêmio do dia `prox` do calendário, com `ciclos` calendários completos antes dele.
  function premioDe(prox, ciclos) {
    var dia = D.dias[prox], itens = {};
    if (dia.item) itens[dia.item] = 1;
    var estrela = prox === D.dias.length - 1 && (ciclos + 1) % D.estrelaACada === 0;
    if (estrela) itens.estrela = 1;
    return { premio: { ouro: dia.ouro || 0, itens: itens }, estrela: estrela };
  }
  function seguinte(d) {
    var fecha = d.prox === D.dias.length - 1;
    return { prox: fecha ? 0 : d.prox + 1, ciclos: fecha ? d.ciclos + 1 : d.ciclos };
  }
  // { pode, dia (1–7), premio (o próximo a resgatar), amanha (o que fica para amanhã se hoje resgatar,
  // ou o mesmo premio se hoje não dá), estrela (premio traz a Estrela) }
  function diariaEstado(diaria, hoje) {
    var d = diariaSaneada(diaria, hoje);
    var pode = podeResgatar(d, hoje);
    var p = premioDe(d.prox, d.ciclos), s = seguinte(d);
    return { pode: pode, dia: d.prox + 1, premio: p.premio, amanha: pode ? premioDe(s.prox, s.ciclos).premio : premioDe(d.prox, d.ciclos).premio, estrela: p.estrela };
  }
  // cabe(id, qtd): a mochila aceita? Se algum item não cabe, nada anda: { cheia: id }.
  function resgatar(diaria, hoje, cabe) {
    var d = diariaSaneada(diaria, hoje);
    if (!podeResgatar(d, hoje)) return null;
    var p = premioDe(d.prox, d.ciclos).premio;
    var ids = Object.keys(p.itens);
    for (var i = 0; i < ids.length; i++) if (!cabe(ids[i], p.itens[ids[i]])) return { cheia: ids[i] };
    var s = seguinte(d);
    return { diaria: { prox: s.prox, ciclos: s.ciclos, ultimo: hoje }, ouro: p.ouro, itens: p.itens };
  }

  // ---------------------------------------------------------------------------------------------
  // Loja
  // ---------------------------------------------------------------------------------------------
  // Na dúvida, nada é liberado (Rulings 7 e 8): dia ou estrelaDia corrompido (nem dia de 0 a DIA_MAX nem null) vale
  // hoje; compra do dia corrompida (nem inteiro de 0 ao limite) vale o limite; loja que não é objeto é tudo isso
  // junto. null continua sendo "nunca".
  function lojaSaneada(loja, hoje) {
    var obj = objeto(loja), l = obj || {}, c = objeto(l.comprados) || {}, comprados = {};
    limitados().forEach(function (id) { comprados[id] = inteiro(c[id]) && c[id] >= 0 && c[id] <= I[id].perDay ? c[id] : I[id].perDay; });
    return {
      dia: obj && l.dia === null ? null : diaOu(l.dia, hoje),
      comprados: comprados,
      estrelaDia: obj && l.estrelaDia === null ? null : diaOu(l.estrelaDia, hoje)
    };
  }
  // Com hoje que não é inteiro, nada volta: a loja fica como está.
  function lojaDoDia(loja, hoje) {
    var l = lojaSaneada(loja, hoje);
    if (!inteiro(hoje) || (l.dia !== null && hoje <= l.dia)) return l;
    var zerados = {};
    limitados().forEach(function (id) { zerados[id] = 0; });
    return { dia: hoje, comprados: zerados, estrelaDia: l.estrelaDia };
  }
  // ouro: saldo; ouroLivre: o que sobra fora do reservado para a entrada da sala aberta; tem: na mochila.
  function podeComprar(id, loja, hoje, ouro, ouroLivre, tem) {
    if (!temChave(I, id) || I[id].price == null) return { ok: false, motivo: 'nao-vende' };
    if (!inteiro(hoje)) return { ok: false, motivo: 'limite' };
    var it = I[id], l = lojaDoDia(loja, hoje), restam;
    if (it.everyDays) {
      var passou = l.estrelaDia === null ? Infinity : hoje - l.estrelaDia;
      if (passou < it.everyDays) return { ok: false, motivo: 'limite', emDias: it.everyDays - passou };
      restam = 1;
    } else {
      restam = it.perDay - l.comprados[id];
      if (!(restam > 0)) return { ok: false, motivo: 'limite' };   // NaN (limite ausente) também para
    }
    if (Number(tem) >= G.BAG_MAX) return { ok: false, motivo: 'cheia' };
    if (!(ouro >= it.price)) return { ok: false, motivo: 'sem-ouro' };
    if (!(ouroLivre >= it.price)) return { ok: false, motivo: 'reservado' };
    return { ok: true, restam: restam };
  }
  // Registra a compra (quem chama confere podeComprar e desconta o Ouro na mesma gravação).
  function comprar(id, loja, hoje) {
    var l = lojaDoDia(loja, hoje);
    if (!inteiro(hoje)) return l;
    if (temChave(I, id) && I[id].everyDays) l.estrelaDia = hoje;
    else if (limitados().indexOf(id) >= 0) l.comprados[id] += 1;
    return l;
  }

  var Itens = {
    SAL: SAL,
    SAL_PERGAMINHO: SAL_PERGAMINHO,
    pergaminhoPodio: pergaminhoPodio,
    DIA_MAX: DIA_MAX,
    diaLocal: diaLocal,
    podeUsar: podeUsar,
    usarTorrao: usarTorrao,
    usarEstrela: usarEstrela,
    trocarSkill: trocarSkill,
    tentarDoma: tentarDoma,
    diariaEstado: diariaEstado,
    resgatar: resgatar,
    lojaDoDia: lojaDoDia,
    podeComprar: podeComprar,
    comprar: comprar
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Itens;
  else root.Itens = Itens;
})(typeof self !== 'undefined' ? self : this);
