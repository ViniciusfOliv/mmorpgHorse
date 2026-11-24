/*
 * MMORPG Horse — equipamento (protótipo descartável). Módulo PURO: sem DOM, sem estado, sem Math.random;
 * as entradas nunca são mutadas. Todo sorteio usa RaceSim.mulberry32 + RaceSim.hash2.
 *
 * ORDEM DE CHAMADAS DE rng():
 *   - enhance(item, seedBase, counter): UMA chamada por tentativa,
 *     rng = mulberry32(hash2(seedBase, 0xE4A0 + counter)); sucesso se roll < chance do passo.
 *   - podiumStone(seed, place, fee): UMA chamada por prêmio, rng = mulberry32(hash2(seed, 0xB1AC + place)),
 *     só se fee > 0 e place em 1–3 (senão devolve 0 sem sortear). Cada lugar tem o seu sorteio, então
 *     as chances (60/40/25%) são independentes entre os lugares.
 *   - enhance/enhanceOdds só aceitam plus inteiro 0–9 (no +10 não melhora); fora disso, null.
 *   - sortearLinhas(raridade, rng): duas chamadas por linha (tipo, valor), com a rng de quem chama (a corrida AFK, a
 *     forja, a migração do save).
 *   - resolvePve/fixas/enhanceOdds/sellPrice: não sorteiam.
 *
 * O EQUIPAMENTO SÓ VALE NO PVE (treino AFK; spec 2026-11-23-afk-drops §5.7): nunca entra na corrida valendo, no Poder,
 * na sala nem nos duelos de ginásio de verdade. OBJETO RESOLVIDO (resolvePve e fixas):
 *   { mods: { vel, acel, man, forca, est, garra, sorte },        // sempre as 7 chaves; só o principal de cada peça
 *     farm: { material, xp, raro, trofeu, ouro },                 // frações; a soma das linhas das peças
 *     special: { weatherDoubleClimate, ignoreWeatherPenalty },
 *     set: { id, count },                                         // id null e count 0 sem peças de conjunto
 *     pieces: [{ slot, uid, id, plus }] }                         // ordem de GEAR_SLOTS, só peças válidas
 * Cada peça soma main + plus × plusStep (0,5) no status principal do slot; os mods podem ser fracionários (quem corre
 * arredonda). Conjunto = o que tem mais peças (empate: ordem sol/chuva/nevoa). Bônus acumulam:
 *   >= 3: o farm × (1 + setBonus.farm) · >= 4: weatherDoubleClimate = set.id · >= 5: ignoreWeatherPenalty.
 */
(function (root) {
  'use strict';

  var G = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./data.js') : root.GameData;
  var S = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./sim.js') : root.RaceSim;

  var SLOTS = G.GEAR_SLOTS;
  var EG = G.ECONOMY.gear;
  var SET_ORDER = ['sol', 'chuva', 'nevoa'];

  function piece(id) {
    return Object.prototype.hasOwnProperty.call(G.GEAR, id) ? G.GEAR[id] : null;
  }

  function emptyEquip() {
    var o = {};
    SLOTS.forEach(function (s) { o[s] = null; });
    return o;
  }

  var FARM_TIPOS = Object.keys(EG.faixas);
  function farmZero() { var f = {}; FARM_TIPOS.forEach(function (t) { f[t] = 0; }); return f; }
  // O equipamento de uma montaria para o PVE (treino AFK). Nunca entra no PVP nem no Poder.
  //   mods: o principal de cada peça (valor da raridade + plus × plusStep; o status da corrida é inteiro: quem corre arredonda) no status do slot;
  //   farm: a soma das linhas das peças, em fração (0,07 = +7%), por tipo; com 3 peças ou mais do mesmo conjunto,
  //     × (1 + setBonus.farm);
  //   special: com 4 peças do conjunto, weatherDoubleClimate = o conjunto; com 5, ignoreWeatherPenalty.
  function resolvePve(mount, itemsByUid) {
    var mods = {};
    G.STAT_KEYS.forEach(function (k) { mods[k] = 0; });
    var special = { weatherDoubleClimate: null, ignoreWeatherPenalty: false };
    var pieces = [], counts = {}, farm = farmZero();
    var equip = (mount && mount.equip) || {};
    var items = itemsByUid || {};
    SLOTS.forEach(function (slot) {
      var uid = equip[slot];
      if (!uid || !Object.prototype.hasOwnProperty.call(items, uid)) return;
      var item = items[uid];
      var def = item ? piece(item.id) : null;
      if (!def || def.slot !== slot) return;
      var plus = item.plus;
      if (!validPlus(plus)) return;
      mods[G.GEAR_SLOT_INFO[slot].main] += def.main + plus * EG.plusStep;   // cada +N vale plusStep (0,5) no principal
      (linhasValidas(item.id, item.linhas) || []).forEach(function (l) { farm[l.tipo] += l.valor; });
      if (def.set) counts[def.set] = (counts[def.set] || 0) + 1;
      pieces.push({ slot: slot, uid: uid, id: def.id, plus: plus });
    });
    var setId = null, count = 0;
    SET_ORDER.forEach(function (id) {
      if ((counts[id] || 0) > count) { setId = id; count = counts[id]; }
    });
    var sb = EG.setBonus, fator = count >= sb.pieces[0] ? 1 + sb.farm : 1;
    FARM_TIPOS.forEach(function (t) { farm[t] = Math.round(farm[t] * fator * 100) / 10000; });
    G.STAT_KEYS.forEach(function (k) { mods[k] = Math.round(mods[k] * 100) / 100; });   // 1,25 + 7 × 0,2 sem o resto do ponto flutuante
    if (count >= sb.pieces[1]) special.weatherDoubleClimate = setId;
    if (count >= sb.pieces[2]) special.ignoreWeatherPenalty = true;
    return { mods: mods, farm: farm, special: special, set: { id: setId, count: count }, pieces: pieces };
  }
  // As cinco peças fixas de um oponente do treino AFK (GameData.AFK.difs[].pecas): raridade, +N e, se do conjunto, qual.
  // Sem linhas de farm (o oponente não coleta nada). -> o mesmo objeto do resolvePve | null (sem peças)
  function fixas(p, setId) {
    if (!p || typeof p !== 'object') return null;
    var equip = {}, items = {};
    SLOTS.forEach(function (slot, i) {
      var id = slot + (p.doConjunto ? '-' + setId : '') + '-' + p.rar, uid = 'f' + (i + 1);
      if (!piece(id)) return;
      equip[slot] = uid; items[uid] = { uid: uid, id: id, plus: p.plus, linhas: [] };
    });
    return resolvePve({ equip: equip }, items);
  }

  // plus válido: inteiro em 0–plusMax (fracionário, texto etc. => inválido). enhanceOdds só melhora até plusMax−1:
  // no +10 (plusMax) devolve null, porque não há mais o que melhorar
  function validPlus(plus) {
    return typeof plus === 'number' && plus === Math.floor(plus) && plus >= 0 && plus <= EG.plusMax;
  }
  function enhanceOdds(plus) {
    if (!validPlus(plus) || plus >= EG.plusMax) return null;
    return {
      chance: EG.enhanceChance[plus],
      cost: EG.enhanceCost[plus],
      dropTo: plus >= EG.enhanceDropFrom ? plus - 1 : plus
    };
  }

  function enhance(item, seedBase, counter) {
    if (!item) return null;
    var odds = enhanceOdds(item.plus);
    if (!odds) return null;
    var roll = S.mulberry32(S.hash2(seedBase, 0xE4A0 + counter))();
    var success = roll < odds.chance;
    return { success: success, plus: success ? item.plus + 1 : odds.dropTo, roll: roll };
  }

  function podiumStone(seed, place, fee) {
    if (!(fee > 0) || place < 1 || place > 3) return 0;
    var roll = S.mulberry32(S.hash2(seed, 0xB1AC + place))();   // um sorteio por lugar (independentes)
    return roll < EG.podiumStone[place - 1] ? 1 : 0;
  }

  // Linhas de farm de uma peça (spec AFK §5.7): EG.linhas[raridade] linhas, cada uma com DUAS chamadas de rng(), nesta
  // ordem: 1) o tipo, uniforme entre os de EG.faixas que a peça ainda não tem (na ordem das chaves); 2) o valor, inteiro
  // uniforme na faixa da raridade (pontos percentuais). Raridade sem linhas (Comum) ou desconhecida: [] sem sortear.
  function sortearLinhas(raridade, rng) {
    var n = typeof raridade === 'string' && Object.prototype.hasOwnProperty.call(EG.linhas, raridade) ? EG.linhas[raridade] : 0;
    var tipos = Object.keys(EG.faixas), out = [];
    for (var i = 0; i < n && tipos.length; i++) {
      var t = tipos.splice(Math.min(tipos.length - 1, Math.floor(rng() * tipos.length)), 1)[0];
      var fx = EG.faixas[t][raridade];
      out.push({ tipo: t, valor: fx[0] + Math.min(fx[1] - fx[0], Math.floor(rng() * (fx[1] - fx[0] + 1))) });
    }
    return out;
  }

  // As linhas de uma peça, se válidas para a raridade dela (a quantidade certa, tipos sem repetir, valores inteiros na
  // faixa): uma cópia; senão null (quem chama sorteia de novo pela seed ou descarta a peça).
  function linhasValidas(id, linhas) {
    var def = piece(id);
    if (!def || !Array.isArray(linhas) || linhas.length !== (EG.linhas[def.rarity] || 0)) return null;
    var out = [], visto = {};
    for (var i = 0; i < linhas.length; i++) {
      var l = linhas[i];
      if (!l || typeof l !== 'object' || typeof l.tipo !== 'string' || !Object.prototype.hasOwnProperty.call(EG.faixas, l.tipo) || visto[l.tipo]) return null;
      var fx = EG.faixas[l.tipo][def.rarity];
      if (!fx || typeof l.valor !== 'number' || l.valor !== Math.floor(l.valor) || l.valor < fx[0] || l.valor > fx[1]) return null;
      visto[l.tipo] = true;
      out.push({ tipo: l.tipo, valor: l.valor });
    }
    return out;
  }

  // As linhas de uma peça do save: as dela, se válidas; senão (peça de antes das linhas, ou lixo) sorteadas pela seed do
  // save e pelo número do uid ('i<n>'): rng = mulberry32(hash2(seedBase, 0x20000000 + n)). A mesma peça ganha sempre as
  // mesmas linhas, em qualquer carga do save.
  var SAL_LINHAS = 0x20000000;
  function linhasDaPeca(item, seedBase) {
    var def = item ? piece(item.id) : null;
    if (!def) return [];
    var ok = linhasValidas(item.id, item.linhas);
    if (ok) return ok;
    var n = typeof item.uid === 'string' && /^i\d{1,9}$/.test(item.uid) ? Number(item.uid.slice(1)) : 0;
    return sortearLinhas(def.rarity, S.mulberry32(S.hash2(seedBase, SAL_LINHAS + n)));
  }

  // Reforja (spec AFK §5.9): sorteia de novo UMA linha escolhida da peça. Custa 1 Pergaminho de reforja e Ouro, que
  // cresce a cada reforja na mesma peça e nunca volta (custoReforja); com 1 Selo do campeão (comSelo) a linha mantém o
  // tipo e o valor sai da metade de cima da faixa ([ceil((min + max) / 2), max]).
  // rng = mulberry32(hash2(hash2(seedBase, SAL_REFORJA + nº do uid), rerolls)): o nº de reforjas da peça entra num
  // segundo hash (como o contador da vaga do AFK), então não disputa faixa com os outros sais do save; a mesma peça no
  // mesmo rerolls dá sempre o mesmo resultado (recarregar não muda). Quem chama grava rerolls + 1 junto com a linha.
  // Chamadas de rng(): sem Selo, 1) o tipo (uniforme entre os de EG.faixas que as OUTRAS linhas não têm, na ordem das
  // chaves; o tipo atual pode sair de novo) e 2) o valor; com Selo, só o valor.
  var SAL_REFORJA = 0x52460000;   // "RF"
  function numUid(item) { return item && typeof item.uid === 'string' && /^i\d{1,9}$/.test(item.uid) ? Number(item.uid.slice(1)) : 0; }
  function rerollsDe(item) {
    var n = item ? item.rerolls : 0;
    return typeof n === 'number' && isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  function custoReforja(item) {
    return Math.round(EG.reforjaBase * Math.pow(EG.reforjaFator, Math.min(60, rerollsDe(item))) / 10) * 10;
  }
  function milhar(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  // mochila: { 'pergaminho-reforja': n, selo: n }; ouroLivre: o Ouro fora do reservado da sala aberta
  function podeReforjar(item, idxLinha, comSelo, mochila, ouroLivre) {
    var def = item ? piece(item.id) : null;
    if (!def) return { ok: false, motivo: 'Peça inválida' };
    if (!(EG.linhas[def.rarity] > 0)) return { ok: false, motivo: 'Peça Comum não tem linhas' };
    var linhas = linhasValidas(item.id, item.linhas);
    if (!linhas || typeof idxLinha !== 'number' || idxLinha !== Math.floor(idxLinha) || idxLinha < 0 || idxLinha >= linhas.length) return { ok: false, motivo: 'Escolha uma linha da peça' };
    var custo = custoReforja(item), m = mochila || {};
    if (!(Number(m['pergaminho-reforja']) >= 1)) return { ok: false, motivo: 'Falta Pergaminho de reforja', custo: custo };
    if (comSelo && !(Number(m.selo) >= 1)) return { ok: false, motivo: 'Falta Selo do campeão', custo: custo };
    if (!(typeof ouroLivre === 'number' && ouroLivre >= custo)) return { ok: false, motivo: 'Falta Ouro (precisa de ' + milhar(custo) + ')', custo: custo };
    return { ok: true, custo: custo };
  }
  // -> { linhas (cópia com a linha nova), rerolls (o novo) } | null (peça sem linhas, linhas inválidas ou índice fora)
  function reforjar(item, idxLinha, comSelo, seedBase) {
    var def = item ? piece(item.id) : null;
    var linhas = def ? linhasValidas(item.id, item.linhas) : null;
    if (!linhas || !linhas.length || typeof idxLinha !== 'number' || idxLinha !== Math.floor(idxLinha) || idxLinha < 0 || idxLinha >= linhas.length) return null;
    if (typeof seedBase !== 'number' || !isFinite(seedBase)) return null;
    var n = rerollsDe(item), rng = S.mulberry32(S.hash2(S.hash2(seedBase, SAL_REFORJA + numUid(item)), n));
    var tipo = linhas[idxLinha].tipo, fx, min;
    if (comSelo) {
      fx = EG.faixas[tipo][def.rarity];
      min = Math.ceil((fx[0] + fx[1]) / 2);
    } else {
      var outros = {};
      linhas.forEach(function (l, i) { if (i !== idxLinha) outros[l.tipo] = true; });
      var tipos = Object.keys(EG.faixas).filter(function (t) { return !outros[t]; });
      tipo = tipos[Math.min(tipos.length - 1, Math.floor(rng() * tipos.length))];
      fx = EG.faixas[tipo][def.rarity];
      min = fx[0];
    }
    linhas[idxLinha] = { tipo: tipo, valor: min + Math.min(fx[1] - min, Math.floor(rng() * (fx[1] - min + 1))) };
    return { linhas: linhas, rerolls: n + 1 };
  }

  function sellPrice(id) {
    var def = piece(id);
    return def ? Math.round(EG.price[def.rarity] * EG.sellRate) : 0;
  }

  var Gear = {
    SLOTS: SLOTS,
    piece: piece,
    emptyEquip: emptyEquip,
    resolve: resolvePve,   // o nome antigo: é o mesmo resolvePve (o equipamento só existe no PVE)
    resolvePve: resolvePve,
    fixas: fixas,
    enhanceOdds: enhanceOdds,
    enhance: enhance,
    podiumStone: podiumStone,
    sortearLinhas: sortearLinhas,
    linhasValidas: linhasValidas,
    linhasDaPeca: linhasDaPeca,
    custoReforja: custoReforja,
    podeReforjar: podeReforjar,
    reforjar: reforjar,
    sellPrice: sellPrice
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Gear;
  else root.Gear = Gear;
})(typeof self !== 'undefined' ? self : this);
