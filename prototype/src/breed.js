/*
 * MMORPG Horse — cruzamento (protótipo descartável). Spec: docs/superpowers/specs/2026-11-06-cruzamento-design.md
 *
 * Breed é DETERMINÍSTICO: só usa o rng() que recebe (ex.: RaceSim.mulberry32), sem Math.random
 * nem Date. As funções "odds" só calculam probabilidades e NÃO consomem rng.
 *
 * ============================== MODELO ======================================
 * Fator de nível L = clamp((mareWeight·nível da égua + (1−mareWeight)·nível do garanhão) / levelSaturation, 0, 1)
 * (ECONOMY.breeding: mareWeight 0,6; levelSaturation 30). L=0 é o pior caso, L=1 o melhor.
 *
 * RARIDADE do potro: linha "same" se os pais têm a mesma raridade, senão "mixed". Base = a MENOR
 * ordem entre os pais. Quatro colunas (1 abaixo, igual, 1 acima, 2 acima da base), cada uma
 * interpolada em % entre lv1 e lv30: p = p0 + (p1 − p0)·L. Alvo da coluna k = base − 1 + k;
 * alvo fora de [0, maxRarityOrder] é preso ao limite e SOMA no alvo preso. Mítico nunca nasce
 * de cruzamento (maxRarityOrder = 3).
 *
 * GRAU (1–3 estrelas): gb = round(0.6·grau da égua + 0.4·grau do garanhão); desce/mantém/sobe
 * interpolados por L; alvo fora de 1–3 soma em "mantém". Se a raridade SUBIU o potro nasce ★1;
 * se DESCEU, ★3 (sem sorteio de grau).
 *
 * ALUGUEL: Math.round(rentalBase[raridade] · grauMult[grau−1]); Mítico não se aluga (null).
 * CORCEL: montaria que já tem todas as skills "de linha" da sua raridade (CORCEL_SETS).
 *
 * Ordem de chamadas de rng() em foal(): ver Tarefa 3.
 */
(function (root) {
  'use strict';

  var G = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./data.js') : root.GameData;

  var TUNING = {
    // colunas: 1 abaixo, igual, 1 acima, 2 acima (percentuais)
    rarity: {
      same:  { lv1: [45, 54, 1, 0],  lv30: [30, 65, 4.5, 0.5] },
      mixed: { lv1: [35, 50, 15, 0], lv30: [20, 50, 29, 1] }
    },
    // colunas: desce, mantém, sobe
    grau: { lv1: [25, 55, 20], lv30: [10, 50, 40] },
    skillInherit: 0.35,
    potInherit: 0.5,
    maxRarityOrder: 3
  };

  var RARITY_IDS = ['comum', 'magico', 'raro', 'lendario', 'mitico'];

  var CORCEL_SETS = {
    comum: ['arranque'],
    magico: ['arranque', 'sprint'],
    raro: ['arranque', 'sprint', 'drift'],
    lendario: ['arranque', 'sprint', 'drift', 'saida-rapida'],
    mitico: ['arranque', 'sprint', 'drift', 'saida-rapida', 'arrancada-final']
  };

  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function order(m) { return G.RARITIES[m.rarity].order; }

  // f = égua, m = garanhão (quem chama garante)
  function levelFactor(f, m) {
    var E = G.ECONOMY.breeding;
    return clamp((E.mareWeight * f.level + (1 - E.mareWeight) * m.level) / E.levelSaturation, 0, 1);
  }

  function lerpCols(a, b, L) {
    var out = [];
    for (var i = 0; i < a.length; i++) out.push(a[i] + (b[i] - a[i]) * L);
    return out;
  }

  // colunas de raridade (em %) para o par
  function rarityCols(f, m) {
    var row = order(f) === order(m) ? TUNING.rarity.same : TUNING.rarity.mixed;
    return lerpCols(row.lv1, row.lv30, levelFactor(f, m));
  }

  function rarityOdds(f, m) {
    var cols = rarityCols(f, m), base = Math.min(order(f), order(m));
    var byOrder = [0, 0, 0, 0, 0], k;
    for (k = 0; k < cols.length; k++) {
      byOrder[clamp(base - 1 + k, 0, TUNING.maxRarityOrder)] += cols[k] / 100;
    }
    var out = {};
    for (k = 0; k < RARITY_IDS.length; k++) out[RARITY_IDS[k]] = byOrder[k];
    return out;
  }

  function grauBase(f, m) { return Math.round(0.6 * f.grau + 0.4 * m.grau); }

  function grauCols(f, m) { return lerpCols(TUNING.grau.lv1, TUNING.grau.lv30, levelFactor(f, m)); }

  function grauOdds(f, m) {
    var cols = grauCols(f, m), gb = grauBase(f, m), out = { 1: 0, 2: 0, 3: 0 };
    for (var k = 0; k < 3; k++) {
      var t = gb - 1 + k;
      if (t < 1 || t > 3) t = gb; // fora de 1–3 soma em "mantém"
      out[t] += cols[k] / 100;
    }
    return out;
  }

  function odds(f, m) {
    return { L: levelFactor(f, m), rarity: rarityOdds(f, m), grau: grauOdds(f, m), rarityUpGrau: 1, rarityDownGrau: 3 };
  }

  // 1 chamada de rng()
  function rollRarity(rng, f, m) {
    var cols = rarityCols(f, m), base = Math.min(order(f), order(m));
    var u = rng() * 100, acc = 0, k;
    for (k = 0; k < cols.length; k++) {
      acc += cols[k];
      if (u < acc) break;
    }
    if (k >= cols.length) k = cols.length - 1; // erro de arredondamento no topo
    return RARITY_IDS[clamp(base - 1 + k, 0, TUNING.maxRarityOrder)];
  }

  // rarityChanged: 1 subiu, -1 desceu, 0 igual. Só o caso 0 consome rng() (1 chamada).
  function rollGrau(rng, f, m, rarityChanged) {
    if (rarityChanged === 1) return 1;
    if (rarityChanged === -1) return 3;
    var cols = grauCols(f, m), u = rng() * 100, acc = 0, k;
    for (k = 0; k < 3; k++) {
      acc += cols[k];
      if (u < acc) break;
    }
    if (k > 2) k = 2;
    return clamp(grauBase(f, m) - 1 + k, 1, 3);
  }

  function rentalPrice(mount) {
    var E = G.ECONOMY.breeding, base = E.rentalBase[mount.rarity];
    if (base === undefined || mount.rarity === 'mitico') return null;
    return Math.round(base * E.grauMult[mount.grau - 1]);
  }

  function isCorcel(mount) {
    var set = CORCEL_SETS[mount.rarity], sk = mount.skills || [];
    if (!set) return false;
    for (var i = 0; i < set.length; i++) if (sk.indexOf(set[i]) < 0) return false;
    return true;
  }

  var Breed = {
    TUNING: TUNING,
    CORCEL_SETS: CORCEL_SETS,
    levelFactor: levelFactor,
    rarityOdds: rarityOdds,
    grauOdds: grauOdds,
    odds: odds,
    rollRarity: rollRarity,
    rollGrau: rollGrau,
    rentalPrice: rentalPrice,
    isCorcel: isCorcel
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Breed;
  else root.Breed = Breed;
})(typeof self !== 'undefined' ? self : this);
