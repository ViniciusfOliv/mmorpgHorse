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
 *   - resolve/botGear/enhanceOdds/sellPrice/ratingPts: não sorteiam.
 *
 * OBJETO RESOLVIDO (resolve e botGear):
 *   { mods: { vel, acel, man, forca, est, garra, sorte },        // sempre as 7 chaves
 *     special: { skillEffectBonus, weatherDoubleClimate, ignoreWeatherPenalty },
 *     set: { id, count },                                         // id null e count 0 sem peças de conjunto
 *     pieces: [{ slot, uid, id, plus }] }                         // ordem de GEAR_SLOTS, só peças válidas
 * Cada peça soma main + plus × plusStep (0,5) no status principal do slot e sub no secundário; os mods
 * podem ser fracionários (RaceSim.computeStats arredonda uma vez só, no fim).
 * Conjunto = o que tem mais peças (empate: ordem sol/chuva/nevoa). Bônus acumulam:
 *   >= 3: sorte +5 e skillEffectBonus 0,05 (o efeito das skills × 1,05: entry.skillScale da corrida) · >= 4: weatherDoubleClimate = set.id (o bônus do clima
 *   sobe para ×1,07 só se a montaria for do elemento dono do clima do conjunto; para os outros não
 *   muda nada) · >= 5: ignoreWeatherPenalty.
 *
 * BOTS por liga (botGear), conjunto = clima do elemento (elemento sem clima ou desconhecido: floor(pick*3)
 *   em sol/chuva/nevoa):
 *   0 nada · 1 ferraduras-comum, sela-comum +0 · 2 cinco Comuns +2 · 3 cinco Mágicas +3 ·
 *   4 três Raras +4 do conjunto (ferraduras, sela, estribos) + testeira-magico, armadura-magico +3 ·
 *   5 cinco Raras +7 do conjunto.
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

  function resolve(mount, itemsByUid) {
    var mods = {};
    G.STAT_KEYS.forEach(function (k) { mods[k] = 0; });
    var special = { skillEffectBonus: 0, weatherDoubleClimate: null, ignoreWeatherPenalty: false };
    var pieces = [];
    var counts = {};
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
      var info = G.GEAR_SLOT_INFO[slot];
      mods[info.main] += def.main + plus * EG.plusStep;   // cada +N vale plusStep (0,5) no principal
      mods[info.sub] += def.sub;
      if (def.set) counts[def.set] = (counts[def.set] || 0) + 1;
      pieces.push({ slot: slot, uid: uid, id: def.id, plus: plus });
    });
    var setId = null, count = 0;
    SET_ORDER.forEach(function (id) {
      if ((counts[id] || 0) > count) { setId = id; count = counts[id]; }
    });
    var sb = EG.setBonus;
    if (count >= sb.pieces[0]) { mods.sorte += sb.sorte; special.skillEffectBonus = sb.skillEffect; }
    if (count >= sb.pieces[1]) special.weatherDoubleClimate = setId;
    if (count >= sb.pieces[2]) special.ignoreWeatherPenalty = true;
    return { mods: mods, special: special, set: { id: setId, count: count }, pieces: pieces };
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

  function sellPrice(id) {
    var def = piece(id);
    return def ? Math.round(EG.price[def.rarity] * EG.sellRate) : 0;
  }

  function ratingPts(count) {
    var i = EG.setBonus.pieces.indexOf(count);
    return i >= 0 ? EG.setBonus.ratingPts[i] : 0;
  }

  function botGear(leagueIdx, element, pick) {
    var lg = Math.max(0, Math.min(5, Math.floor(leagueIdx) || 0));
    var el = Object.prototype.hasOwnProperty.call(G.ELEMENTS, element) ? G.ELEMENTS[element] : null;
    var setId = el && el.weather
      ? el.weather
      : SET_ORDER[Math.max(0, Math.min(2, Math.floor(pick * 3) || 0))];
    var list = [];
    function add(slot, id, plus) { list.push({ slot: slot, id: id, plus: plus }); }
    if (lg === 1) {
      add('ferraduras', 'ferraduras-comum', 0); add('sela', 'sela-comum', 0);
    } else if (lg === 2) {
      SLOTS.forEach(function (s) { add(s, s + '-comum', 2); });
    } else if (lg === 3) {
      SLOTS.forEach(function (s) { add(s, s + '-magico', 3); });
    } else if (lg === 4) {
      ['ferraduras', 'sela', 'estribos'].forEach(function (s) { add(s, s + '-' + setId + '-raro', 4); });
      add('testeira', 'testeira-magico', 3); add('armadura', 'armadura-magico', 3);
    } else if (lg === 5) {
      SLOTS.forEach(function (s) { add(s, s + '-' + setId + '-raro', 7); });
    }
    var equip = {}, items = {};
    list.forEach(function (p, i) {
      var uid = 'b' + (i + 1);
      equip[p.slot] = uid;
      items[uid] = { uid: uid, id: p.id, plus: p.plus };
    });
    return resolve({ equip: equip }, items);
  }

  var Gear = {
    SLOTS: SLOTS,
    piece: piece,
    emptyEquip: emptyEquip,
    resolve: resolve,
    enhanceOdds: enhanceOdds,
    enhance: enhance,
    podiumStone: podiumStone,
    sortearLinhas: sortearLinhas,
    linhasValidas: linhasValidas,
    linhasDaPeca: linhasDaPeca,
    botGear: botGear,
    sellPrice: sellPrice,
    ratingPts: ratingPts
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Gear;
  else root.Gear = Gear;
})(typeof self !== 'undefined' ? self : this);
