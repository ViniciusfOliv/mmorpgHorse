/*
 * MMORPG Horse — modo DEV (protótipo descartável). Funções PURAS do painel de teste (?dev=1):
 * sem DOM, sem estado, sem Math.random; as entradas nunca são mutadas (menos refillGold, que mexe
 * de propósito no save que recebe). A gaveta e os cliques ficam em game.js.
 *
 *   Dev.SAVE_KEY   'galope-elemental:dev': com ?dev=1 o jogo só lê e grava esta chave (o save real,
 *                  'galope-elemental:v1', nunca é lido nem gravado nessa sessão).
 *   Dev.GOLD_INF   999 999. "Ouro infinito": refillGold(state) depois de cada gasto.
 *
 *   Dev.horseTemplate(c, n) -> template no formato de GameData.STARTERS (o game.js faz a instância):
 *     c = { name, element, rarity, sex, potential: 0..31 | 'max' | { vel..sorte }, skills: [ids],
 *           palette: { coat, coatShade, mane, accent } }; n = nº do cavalo (id 'dev-' + n; padrão 1).
 *     base de cada status = RARITIES[rarity].baseLo; level 1, xp 0, grau 2, espécie 'cavalo'.
 *     Skills: qualquer uma do catálogo (inclusive exclusivas e de outro elemento); inexistentes ou
 *     repetidas saem; no máximo RARITIES[rarity].skillSlots, na ordem pedida.
 *     Campo inválido vira o padrão: elemento Neutro, raridade Comum, sexo macho, nome "Teste",
 *     potencial 0, cores de um cavalo pronto do mesmo elemento (cor a cor).
 *     O nível (1 até o máximo) é aplicado pelo game.js na instância (level direto, xp 0).
 *
 *   Dev.itemId({ slot, set, rarity }) -> id de GameData.GEAR ou null. Comum e Mágico são peças soltas
 *     (o conjunto é ignorado); Raro e Lendário exigem um conjunto (sol/chuva/nevoa). O "+" da peça
 *     (0 até plusMax) é aplicado pelo game.js na instância criada.
 *
 *   Dev.conditions(f, base) -> parcial de conditions para RaceSim (campo inválido é omitido):
 *     f = { weather, surface, distance, tracado: 'normal' | 'curvas' | 'subidas' | [tipos] }.
 *     distance: arredondada para múltiplo de 100 dentro de 1000–2400 (não positiva: omitida).
 *     'curvas' / 'subidas': 7 blocos de mesmo tamanho (fronteiras múltiplas de 10 m, 1º e último reta;
 *       os 5 do meio todos curva, ou subida/reta/subida/reta/subida). Lista de tipos (1–12, só
 *       reta/curva/subida): blocos de mesmo tamanho nessa ordem; um tipo inválido descarta a lista.
 *     base (opcional) = condições completas da sala normal (RaceSim.randomConditions(seed)):
 *       - traçado forçado sem distância usa a distância da sala (sem base: 1600 m, o padrão neutro
 *         de RaceSim.normalizeConditions);
 *       - distância forçada com traçado normal mantém os blocos da sala, reescalados (fronteiras
 *         múltiplas de 10 m). Sem base, os blocos ficam de fora e o RaceSim decide (reta única).
 *
 *   Dev.wind(w) -> { intensity: 'calmo' | 'brisa' | 'ventania', dir: 1 | -1 } ou null (vento forçado;
 *     dir 1 = para a direita). Dev.parseSeed(v) -> inteiro 0..4294967295 ou null.
 *   Dev.refillGold(state): se state.gold < GOLD_INF, vira GOLD_INF (acima disso fica como está).
 *
 * UMD: no browser vira window.Dev (precisa de window.GameData antes); no Node, module.exports.
 */
(function (root) {
  'use strict';

  var G = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.GameData;
  if (!G) throw new Error('Dev: GameData não encontrado (carregue data.js antes de dev.js).');

  var SAVE_KEY = 'galope-elemental:dev';
  var GOLD_INF = 999999;
  var WIND_INTENSITIES = ['calmo', 'brisa', 'ventania'];
  var TRACADOS = ['normal', 'curvas', 'subidas'];
  var PALETTE_KEYS = ['coat', 'coatShade', 'mane', 'accent'];
  var NEUTRAL_DISTANCE = 1600;   // o mesmo padrão de RaceSim.normalizeConditions sem seed
  var MAX_LIST = 12;

  function hasOwn(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function isHex(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c); }
  function pot(v) {
    if (v === 'max') return 31;
    var x = Number(v);
    return (v === null || v === '' || !isFinite(x)) ? 0 : clamp(Math.round(x), 0, 31);
  }

  // Cores padrão: as do primeiro cavalo pronto do elemento (iniciais e selvagens).
  function defaultPalette(element) {
    var all = G.STARTERS.concat(G.WILD_HORSES);
    for (var i = 0; i < all.length; i++) if (all[i].element === element && all[i].palette) return all[i].palette;
    return all[0].palette;
  }

  function horseTemplate(c, n) {
    c = c || {};
    var element = hasOwn(G.ELEMENTS, c.element) ? c.element : 'neutro';
    var rarity = hasOwn(G.RARITIES, c.rarity) ? c.rarity : 'comum';
    var sex = c.sex === 'f' ? 'f' : 'm';
    var name = typeof c.name === 'string' ? c.name.replace(/\s+/g, ' ').trim().slice(0, 16) : '';
    if (name.length < 2) name = 'Teste';
    var num = Math.floor(Number(n));
    if (!(num >= 1)) num = 1;
    var R = G.RARITIES[rarity];
    var base = {}, potential = {};
    var potObj = c.potential && typeof c.potential === 'object' ? c.potential : null;
    for (var i = 0; i < G.STAT_KEYS.length; i++) {
      var k = G.STAT_KEYS[i];
      base[k] = R.baseLo;
      potential[k] = pot(potObj ? potObj[k] : c.potential);
    }
    var skills = [];
    var list = Array.isArray(c.skills) ? c.skills : [];
    for (i = 0; i < list.length && skills.length < R.skillSlots; i++) {
      var id = list[i];
      if (typeof id === 'string' && hasOwn(G.SKILLS, id) && skills.indexOf(id) < 0) skills.push(id);
    }
    var def = defaultPalette(element), palette = {};
    for (i = 0; i < PALETTE_KEYS.length; i++) {
      var pk = PALETTE_KEYS[i], cor = c.palette && c.palette[pk];
      palette[pk] = isHex(cor) ? cor : def[pk];
    }
    return {
      id: 'dev-' + num, name: name, especie: 'cavalo', element: element, rarity: rarity, sex: sex,
      level: 1, xp: 0, base: base, potential: potential, skills: skills, palette: palette, grau: 2
    };
  }

  function itemId(q) {
    if (!q || typeof q !== 'object') return null;
    if (G.GEAR_SLOTS.indexOf(q.slot) < 0 || !hasOwn(G.RARITIES, q.rarity)) return null;
    var solta = q.rarity === 'comum' || q.rarity === 'magico';
    if (!solta && !hasOwn(G.GEAR_SETS, q.set)) return null;
    var id = q.slot + (solta ? '' : '-' + q.set) + '-' + q.rarity;
    return hasOwn(G.GEAR, id) ? id : null;
  }

  // Blocos de mesmo tamanho com os tipos dados (fronteiras múltiplas de 10 m; o último fecha em D).
  function equalBlocks(D, types) {
    var out = [], from = 0, B = types.length;
    for (var i = 0; i < B; i++) {
      var to = i === B - 1 ? D : Math.round(D * (i + 1) / B / 10) * 10;
      out.push({ type: types[i], from: from, to: to });
      from = to;
    }
    return out;
  }
  // Blocos da sala (base) reescalados de D0 para D1; um bloco que encolheria a nada some.
  function scaleBlocks(blocks, D0, D1) {
    var out = [], from = 0;
    for (var i = 0; i < blocks.length; i++) {
      var to = i === blocks.length - 1 ? D1 : Math.round(blocks[i].to * D1 / D0 / 10) * 10;
      if (to <= from) continue;
      if (to > D1) to = D1;
      out.push({ type: blocks[i].type, from: from, to: to });
      from = to;
      if (to === D1) break;
    }
    if (!out.length || from !== D1) return null;
    return out;
  }
  function blockList(t) {
    if (!Array.isArray(t) || !t.length || t.length > MAX_LIST) return null;
    for (var i = 0; i < t.length; i++) if (!hasOwn(G.BLOCK_TYPES, t[i])) return null;
    return t.slice();
  }

  function conditions(f, base) {
    f = f || {};
    var out = {};
    if (hasOwn(G.WEATHERS, f.weather)) out.weather = f.weather;
    if (hasOwn(G.SURFACES, f.surface)) out.surface = f.surface;
    var d = (f.distance === null || f.distance === '' || typeof f.distance === 'boolean') ? NaN : Number(f.distance);
    if (isFinite(d) && d > 0) out.distance = clamp(Math.round(d / 100) * 100, 1000, 2400);
    var baseOk = !!(base && Array.isArray(base.blocks) && base.blocks.length && base.distance > 0);
    var D = out.distance || (baseOk ? Math.round(base.distance / 10) * 10 : NEUTRAL_DISTANCE);
    var types = null;
    if (f.tracado === 'curvas') types = ['reta', 'curva', 'curva', 'curva', 'curva', 'curva', 'reta'];
    else if (f.tracado === 'subidas') types = ['reta', 'subida', 'reta', 'subida', 'reta', 'subida', 'reta'];
    else if (Array.isArray(f.tracado)) types = blockList(f.tracado);
    if (types) {
      out.blocks = equalBlocks(D, types);
    } else if (out.distance && baseOk && out.distance !== base.distance) {
      var sc = scaleBlocks(base.blocks, base.distance, out.distance);
      if (sc) out.blocks = sc;
    }
    return out;
  }

  function wind(w) {
    if (!w || WIND_INTENSITIES.indexOf(w.intensity) < 0) return null;
    return { intensity: w.intensity, dir: Number(w.dir) === -1 ? -1 : 1 };
  }

  function parseSeed(v) {
    if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
    var s = String(v).trim();
    if (!/^\d{1,10}$/.test(s)) return null;
    var x = Number(s);
    return x <= 4294967295 ? x : null;
  }

  function refillGold(state) {
    if (state && !(state.gold >= GOLD_INF)) state.gold = GOLD_INF;
    return state;
  }

  var Dev = {
    SAVE_KEY: SAVE_KEY,
    GOLD_INF: GOLD_INF,
    WIND_INTENSITIES: WIND_INTENSITIES,
    TRACADOS: TRACADOS,
    horseTemplate: horseTemplate,
    itemId: itemId,
    conditions: conditions,
    wind: wind,
    parseSeed: parseSeed,
    refillGold: refillGold
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Dev;
  else root.Dev = Dev;
})(typeof self !== 'undefined' ? self : this);
