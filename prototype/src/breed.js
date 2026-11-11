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
 * GRAU (1–3 estrelas): gb = round(mareWeight·grau da égua + (1−mareWeight)·grau do garanhão); desce/mantém/sobe
 * interpolados por L; alvo fora de 1–3 soma em "mantém". Se a raridade SUBIU o potro nasce ★1;
 * se DESCEU, ★3 (sem sorteio de grau). No modelo v3 as estrelas só dão os pontos livres do treino
 * (RaceSim.freePoints): não há piso de genética por estrela nem status base sorteado.
 *
 * GENÉTICA (potential, 0–31 por status): por status, potInherit (50%) de herdar a de um dos pais
 * (escolhido por sorteio, 50/50); senão inteiro uniforme de 0 a 31. TIPO: o dos pais se for igual;
 * senão 50% de cada. O potro nasce sem alloc (pontos livres zerados) e sem o campo base.
 *
 * ALUGUEL: Math.round(rentalBase[raridade] · grauMult[grau−1]); Mítico não se aluga (null).
 * ENTRADAS: grau inválido (ausente, não numérico, fora de 1–3) vira ★★ ou é preso a 1–3; level não
 * numérico vale 1 e é preso a 0–50 (grauOf/levelOf).
 * CORCEL: montaria que já tem todas as skills "de linha" da sua raridade (CORCEL_SETS).
 *
 * ORDEM DE CHAMADAS DE rng() em foal() (rng = mulberry32(hash2(seedBase>>>0, 0xB0B0 + breedCounter))):
 *   1. raridade (1 chamada); rarityChanged = sinal(ordem do resultado − menor ordem dos pais)
 *   2. grau (1 chamada, só se a raridade não mudou; subiu ⇒ ★1, desceu ⇒ ★3)
 *   3. elemento (1 chamada, só se os pais têm elementos diferentes: < 0,5 ⇒ égua). Pai com elemento
 *      fora de GameData.ELEMENTS: fica o do outro, sem chamada; os dois inválidos: 1 chamada escolhe
 *      um dos elementos do catálogo (foalElement)
 *   4. sexo (1 chamada: < 0,5 ⇒ fêmea)
 *   5. genética: 2 chamadas por chave de STAT_KEYS, nos dois ramos. 1ª = porta (< potInherit ⇒ herda).
 *      Herda: 2ª escolhe o pai (< 0,5 ⇒ égua). Não herda: 2ª é o valor floor(rng()·32).
 *   6. skills: se corcel com 1 pai só (g=1): 1 chamada (< 0,5 ⇒ g=2); depois min(g, candidatas) chamadas
 *      de índice (garantidas, sem reposição); 1 chamada (< skillInherit) por candidata restante, na
 *      ordem égua→garanhão; corte em skillSlots; preenchimento até bornSkills: 1 chamada de índice cada.
 *   7. nome (1 chamada: índice em FOAL_NAMES)
 *   8. paleta (1 chamada t = 0,3 + 0,4·rng(), só se os dois pais têm paleta)
 * (v3: saiu o antigo passo 5, uma chamada por status para o status base; o piso de genética por
 * estrela saiu sem mudar o número de chamadas.)
 */
(function (root) {
  'use strict';

  var G = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./data.js') : root.GameData;
  var S = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./sim.js') : root.RaceSim;

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

  // Saneamento das entradas (save antigo, montaria montada à mão): grau inteiro 1–3 (sem grau ou
  // não numérico vale ★★, o grau padrão das montarias do catálogo); level número 0–maxLevel (não
  // numérico vale 1). Não muda nada para entradas válidas.
  function grauOf(mount) {
    var g = Number(mount && mount.grau);
    if (!isFinite(g) || (mount && mount.grau == null)) return 2;
    return clamp(Math.round(g), 1, 3);
  }
  function levelOf(mount) {
    var l = Number(mount && mount.level);
    if (!isFinite(l) || (mount && mount.level == null)) return 1;
    return clamp(l, 0, G.ECONOMY.maxLevel || 50);
  }

  // f = égua, m = garanhão (quem chama garante)
  function levelFactor(f, m) {
    var E = G.ECONOMY.breeding;
    return clamp((E.mareWeight * levelOf(f) + (1 - E.mareWeight) * levelOf(m)) / E.levelSaturation, 0, 1);
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

  function grauBase(f, m) {
    var w = G.ECONOMY.breeding.mareWeight;
    return Math.round(w * grauOf(f) + (1 - w) * grauOf(m));
  }

  // u ≥ soma das colunas (só por erro de arredondamento no topo): cai na última coluna com p > 0
  function lastPositive(cols) {
    for (var k = cols.length - 1; k > 0; k--) if (cols[k] > 0) return k;
    return 0;
  }

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
    if (k >= cols.length) k = lastPositive(cols); // erro de arredondamento no topo
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
    if (k > 2) k = lastPositive(cols);
    return clamp(grauBase(f, m) - 1 + k, 1, 3);
  }

  function rentalPrice(mount) {
    var E = G.ECONOMY.breeding, base = E.rentalBase[mount.rarity];
    if (base === undefined || mount.rarity === 'mitico') return null;
    return Math.round(base * E.grauMult[grauOf(mount) - 1]);
  }

  function isCorcel(mount) {
    var set = CORCEL_SETS[mount.rarity], sk = mount.skills || [];
    if (!set) return false;
    for (var i = 0; i < set.length; i++) if (sk.indexOf(set[i]) < 0) return false;
    return true;
  }

  var PAL_KEYS = ['coat', 'coatShade', 'mane', 'accent'];

  function hexMix(a, b, t) {
    var out = '#';
    for (var i = 0; i < 3; i++) {
      var ca = parseInt(a.substr(1 + i * 2, 2), 16), cb = parseInt(b.substr(1 + i * 2, 2), 16);
      var v = Math.round(ca + (cb - ca) * t);
      out += (v < 16 ? '0' : '') + v.toString(16);
    }
    return out;
  }

  // Elemento do potro. Pais válidos: igual ao de sempre (1 chamada só se diferem). Um pai com
  // elemento fora de GameData.ELEMENTS: fica o do outro, sem chamada. Os dois inválidos: 1 chamada
  // escolhe entre os elementos do catálogo (ordem de Object.keys).
  function foalElement(rng, ef, em) {
    var okF = Object.prototype.hasOwnProperty.call(G.ELEMENTS, ef), okM = Object.prototype.hasOwnProperty.call(G.ELEMENTS, em);
    if (okF && okM) return ef === em ? ef : (rng() < 0.5 ? ef : em);
    if (okF) return ef;
    if (okM) return em;
    var all = Object.keys(G.ELEMENTS);
    return all[Math.floor(rng() * all.length)];
  }
  function compatible(id, element) {
    var sk = G.SKILLS[id];
    return !!sk && (sk.element === 'geral' || sk.element === element);
  }

  // ids das skills dos pais (égua depois garanhão) que o potro pode herdar
  function skillCandidates(f, m, element) {
    var out = [], lists = [f.skills || [], m.skills || []];
    for (var l = 0; l < 2; l++) {
      for (var i = 0; i < lists[l].length; i++) {
        var id = lists[l][i];
        if (compatible(id, element) && out.indexOf(id) < 0) out.push(id);
      }
    }
    return out;
  }

  // genética herdada de um pai, saneada para inteiro 0–31 (save antigo ou montaria montada à mão)
  function potOf(mount, k) {
    var v = Number(mount.potential && mount.potential[k]);
    return isFinite(v) ? clamp(Math.floor(v), 0, 31) : 0;
  }

  function foal(opts) {
    var f = opts.f, m = opts.m, breedCounter = opts.breedCounter;
    var rng = S.mulberry32(S.hash2(opts.seedBase >>> 0, 0xB0B0 + breedCounter));
    var keys = G.STAT_KEYS, i, k;

    // 1-2. raridade e grau
    var rarity = rollRarity(rng, f, m);
    var diff = G.RARITIES[rarity].order - Math.min(order(f), order(m));
    var rarityChanged = diff > 0 ? 1 : (diff < 0 ? -1 : 0);
    var grau = rollGrau(rng, f, m, rarityChanged);
    var R = G.RARITIES[rarity];

    // 3-4. elemento e sexo
    var element = foalElement(rng, f.element, m.element);
    var sex = rng() < 0.5 ? 'f' : 'm';

    // 5. genética (2 chamadas por chave)
    var potential = {};
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (rng() < TUNING.potInherit) {
        potential[k] = potOf(rng() < 0.5 ? f : m, k);
      } else {
        potential[k] = Math.floor(rng() * 32);
      }
    }

    // 6. skills
    var cands = skillCandidates(f, m, element), inherited = [];
    var g = (isCorcel(f) ? 1 : 0) + (isCorcel(m) ? 1 : 0);
    if (g === 1 && rng() < 0.5) g = 2;
    var n = Math.min(g, cands.length), idx;
    for (i = 0; i < n; i++) {
      idx = Math.floor(rng() * cands.length);
      inherited.push(cands.splice(idx, 1)[0]);
    }
    for (i = 0; i < cands.length; i++) if (rng() < TUNING.skillInherit) inherited.push(cands[i]);
    if (inherited.length > R.skillSlots) inherited.length = R.skillSlots;
    var pool = [], id;
    for (id in G.SKILLS) {
      if (Object.prototype.hasOwnProperty.call(G.SKILLS, id) && compatible(id, element) && inherited.indexOf(id) < 0) pool.push(id);
    }
    while (inherited.length < R.bornSkills && pool.length) {
      idx = Math.floor(rng() * pool.length);
      inherited.push(pool.splice(idx, 1)[0]);
    }

    // 7. nome
    var name = G.FOAL_NAMES[Math.floor(rng() * G.FOAL_NAMES.length)];

    // 8. paleta
    var palette = null;
    if (f.palette && m.palette) {
      var t = 0.3 + 0.4 * rng();
      palette = {};
      for (i = 0; i < PAL_KEYS.length; i++) palette[PAL_KEYS[i]] = hexMix(f.palette[PAL_KEYS[i]], m.palette[PAL_KEYS[i]], t);
    } else if (f.palette || m.palette) {
      var src = f.palette || m.palette;
      palette = {};
      for (i = 0; i < PAL_KEYS.length; i++) palette[PAL_KEYS[i]] = src[PAL_KEYS[i]];
    }

    return {
      uid: 'm' + opts.nextUid, templateId: null, name: name, especie: 'cavalo', element: element, rarity: rarity, grau: grau, sex: sex,
      level: 1, xp: 0, skills: inherited, potential: potential, palette: palette, breedLeft: G.BREED_LEFT[sex],
      parents: { f: { uid: f.uid || null, name: f.name }, m: { uid: m.uid || null, name: m.name } },
      born: breedCounter
    };
  }

  var Breed = {
    TUNING: TUNING,
    RARITY_IDS: RARITY_IDS,
    CORCEL_SETS: CORCEL_SETS,
    levelFactor: levelFactor,
    rarityOdds: rarityOdds,
    grauOdds: grauOdds,
    odds: odds,
    rollRarity: rollRarity,
    rollGrau: rollGrau,
    rentalPrice: rentalPrice,
    isCorcel: isCorcel,
    skillCandidates: skillCandidates,
    foal: foal
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Breed;
  else root.Breed = Breed;
})(typeof self !== 'undefined' ? self : this);
