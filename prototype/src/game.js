/*
 * Galope Elemental — interface jogável do protótipo (descartável).
 *
 * Depende de window.GameData (data.js), window.RaceSim (sim.js), window.Gear (gear.js) e
 * window.Sprites (sprites.js).
 * Fluxo: Escolha do inicial -> Estábulo -> Sala de largada -> Corrida -> Resultado.
 *
 * Sala de largada: o campo (seed, condições, rivais, entrada) é sorteado UMA vez e fica salvo em
 * state.pending até ser corrido. Voltar à aba Correr ou recarregar reabre a mesma sala (sem
 * re-sorteio grátis). O equipamento (persistente, por montaria) entra no pareamento; com páreo aberto
 * só trocas que não passem do rating da sala.
 * A corrida é calculada por RaceSim.simulate (função pura da seed) só quando o jogador aperta
 * "Largar!", depois de pagar a entrada, como um servidor faria; a tela de corrida só anima os
 * frames. Ouro e XP são liquidados nesse momento: recarregar no meio da corrida não muda nada.
 * A seed base é sorteada por save (crypto), fora da simulação.
 */
(function () {
  'use strict';

  var GD = window.GameData, RS = window.RaceSim, SP = window.Sprites, GR = window.Gear;
  var telaEl = document.getElementById('tela');
  var appEl = document.getElementById('app');
  if (!GD || !RS || !SP || !GR || !telaEl) {
    if (telaEl) telaEl.textContent = 'Não foi possível carregar o jogo (faltam data.js, sim.js, gear.js ou sprites.js).';
    return;
  }

  // ===========================================================================
  // Constantes
  // ===========================================================================
  var SAVE_KEY = 'galope-elemental:v1';
  var E = GD.ECONOMY;
  var GE = E.gear;
  var STAT_KEYS = GD.STAT_KEYS || ['vel', 'acel', 'man', 'forca', 'est', 'garra', 'sorte'];
  var TRAINING_GOLD = [30, 22, 16, 12, 10, 10, 10, 10];
  var MIN_ENTRY = Math.min.apply(null, E.entryTiers);
  var WILD_SHOWCASE = ['w-pangare', 'w-mandacaru', 'w-ventania', 'w-fogareu', 'w-iara', 'w-boitata'];
  var TRACK_NAMES = [
    'Prado do Cerrado', 'Hipódromo da Lagoa', 'Raia do Engenho', 'Prado Beira-Rio',
    'Hipódromo do Planalto', 'Raia da Ventania', 'Prado das Palmeiras', 'Hipódromo do Sertão Velho'
  ];
  var PLAYER_NAME = 'Você';
  var PLAYER_SILKS = '#f2c230';
  var BOT_SILKS = SP.SILKS.filter(function (c) { return c.toLowerCase() !== PLAYER_SILKS; });
  var PORTRAIT_SCALE = 3;        // escala única dos retratos em todas as telas

  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(motionQuery && motionQuery.matches); }
  function dpr() { return Math.max(1, window.devicePixelRatio || 1); }

  // Cores de cena lidas dos tokens CSS (fonte única de verdade).
  var C = {};
  function readTokens() {
    var cs = getComputedStyle(document.documentElement);
    function t(name, fallback) { var v = cs.getPropertyValue(name).trim(); return v || fallback; }
    C = {
      noite: t('--noite', '#0f1c17'), painel: t('--painel', '#16271f'), painel2: t('--painel-2', '#1e3329'),
      painel3: t('--painel-3', '#284438'), linha: t('--linha', '#335446'), sombra: t('--sombra', '#060d0a'),
      texto: t('--texto', '#f1e9d4'), texto2: t('--texto-2', '#b3c2b2'), texto3: t('--texto-3', '#95a99b'),
      tinta: t('--tinta', '#1a1405'), ouro: t('--ouro', '#f2c230'), ouroClaro: t('--ouro-claro', '#ffe27a'),
      ouroEscuro: t('--ouro-escuro', '#9c7210'), prata: t('--prata', '#c9d3dc'), bronze: t('--bronze', '#c98a52'),
      ganho: t('--ganho', '#7be07a'), perda: t('--perda', '#ff6b5e'),
      palha: t('--palha', '#a5823f'), palha2: t('--palha-2', '#6f5526'), tabua: t('--tabua', '#243a31'),
      fogo: t('--fogo', '#ff8a4c'), agua: t('--agua', '#62b8ff'),
      veu: t('--veu', 'rgba(6,13,10,0.74)'), escuro: t('--escuro-25', 'rgba(0,0,0,0.25)'),
      brilho: t('--brilho-33', 'rgba(255,255,255,0.33)'), holofote: t('--holofote', 'rgba(255,226,122,0.06)')
    };
  }

  // ===========================================================================
  // Utilidades
  // ===========================================================================
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  // A fonte de interface desenha "º" como um "o" na linha de base; troca por um "o" sobrescrito
  // apenas no texto (nunca dentro de atributos). Leitores de tela leem o aria-label do pai.
  function ordFix(html) {
    return html.replace(/>([^<]*)</g, function (m, t) { return '>' + t.replace(/º/g, '<sup class="ord" aria-hidden="true">o</sup>') + '<'; });
  }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function fmt(n) { return Math.round(n).toLocaleString('pt-BR'); }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n)); }
  function fmtSec(s) {
    if (!isFinite(s)) return '—';
    var m = Math.floor(s / 60), r = s - m * 60;
    var rs = r.toFixed(2).replace('.', ',');
    if (m > 0) return m + ':' + (r < 10 ? '0' : '') + rs;
    return rs + 's';
  }
  function fmtClock(s) {
    s = Math.max(0, s);
    var m = Math.floor(s / 60), r = Math.floor(s - m * 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function allHorses() { return GD.STARTERS.concat(GD.WILD_HORSES); }
  function horseById(id) { return allHorses().filter(function (h) { return h.id === id; })[0] || null; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function hexLum(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }
  // "no/na" e "do/da" conforme o nome da pista ("na Raia do Engenho", "no Prado do Cerrado").
  function trackArt(name) {
    var fem = /^(Raia|Pista|Arena|Várzea|Lagoa|Hípica|Chácara|Fazenda|Reta)\b/.test(String(name));
    return fem ? { em: 'na', de: 'da' } : { em: 'no', de: 'do' };
  }

  // Seed base por save: aleatoriedade de UI (fora da simulação), com reserva sem crypto.
  function freshSeedBase(idx) {
    try {
      if (window.crypto && window.crypto.getRandomValues) return window.crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
    } catch (e) { /* segue */ }
    var t = (typeof performance !== 'undefined' && performance.now ? performance.now() * 1000 : 0);
    return RS.hash2((Date.now() >>> 0) ^ (t >>> 0), idx + 1);
  }

  // Moeda e ícones de status em SVG pixelado (8x8, crispEdges).
  var COIN = '<svg viewBox="0 0 8 8" aria-hidden="true" shape-rendering="crispEdges">' +
    '<path style="fill:var(--ouro-escuro)" d="M2 0h4v1h1v1h1v4h-1v1h-1v1h-4v-1h-1v-1h-1v-4h1v-1h1z"/>' +
    '<path style="fill:var(--ouro)" d="M2 1h4v1h1v4h-1v1h-4v-1h-1v-4h1z"/>' +
    '<path style="fill:var(--ouro-claro)" d="M3 2h2v1h-2zM2 3h1v2h-1z"/>' +
    '<path style="fill:var(--ouro-escuro)" d="M4 3h1v3h-1z"/></svg>';
  function ouroHtml(n, extraClass) {
    return '<span class="ouro' + (extraClass ? ' ' + extraClass : '') + '">' + COIN + '<span>' + fmt(n) + '</span><span class="sr">Ouro</span></span>';
  }
  function pixelSvg(rows, cls) {
    var d = '';
    for (var y = 0; y < rows.length; y++) {
      var x = 0;
      while (x < rows[y].length) {
        if (rows[y][x] === '#') { var x0 = x; while (x < rows[y].length && rows[y][x] === '#') x++; d += 'M' + x0 + ' ' + y + 'h' + (x - x0) + 'v1h-' + (x - x0) + 'z'; }
        else x++;
      }
    }
    return '<svg class="' + cls + '" viewBox="0 0 8 8" aria-hidden="true" shape-rendering="crispEdges"><path d="' + d + '"/></svg>';
  }
  var STAT_ICON_ROWS = {
    vel: ['........', '#...#...', '.#...#..', '..#...#.', '..#...#.', '.#...#..', '#...#...', '........'],
    acel: ['....##..', '...##...', '..##....', '.######.', '....##..', '...##...', '..##....', '.#......'],
    est: ['........', '.##.##..', '#######.', '#######.', '.#####..', '..###...', '...#....', '........'],
    forca: ['........', '...#....', '..###...', '..####..', '.######.', '.#######', '########', '........'],
    garra: ['...#..#.', '..#..#..', '..#..#.#', '.#..#..#', '.#..#.#.', '#..#..#.', '#..#.#..', '........'],
    man: ['..####..', '.#....#.', '#......#', '#.......', '#.....#.', '.#...###', '..#..#.#', '........'],
    sorte: ['.##..##.', '#..##..#', '#..##..#', '.######.', '.######.', '#..##..#', '#..##..#', '.##..##.']
  };
  function statIcon(k) { return pixelSvg(STAT_ICON_ROWS[k] || STAT_ICON_ROWS.vel, 'icone-status icone-status--' + k); }

  // ===========================================================================
  // Persistência (localStorage é opcional: tudo funciona sem ele)
  // Cada gravação leva uma revisão (state.rev): uma aba antiga não sobrescreve a mais nova.
  // ===========================================================================
  function loadSave() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function storedRev() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return -1;
      var s = JSON.parse(raw);
      return s && isFinite(s.rev) ? Number(s.rev) : 0;
    } catch (e) { return -1; }
  }
  function persist() {
    if (!state) return;
    var sr = storedRev();
    if (sr > state.rev) { adoptExternal(loadSave()); return; }   // outra aba gravou depois: não sobrescreve
    state.rev = Math.max(state.rev, sr) + 1;
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* sem armazenamento: segue em memória */ }
  }
  function wipeSave() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignora */ }
  }

  // Save v4: várias montarias (instâncias) e uma ativa; peças de equipamento como instâncias em
  // state.items ({ uid: 'i<n>', id, plus }) e equipadas por montaria em mount.equip (slot -> uid|null).
  // Saves v1/v2 (um inicial com level/xp/skills na raiz) são migrados em sanitize(): o inicial vira
  // mounts[0] ('m1'); o inventário de itens antigos (v1–v3) vira peças pelo OLD_ITEM_MAP.
  var BR = E.breeding;
  var MAX_LEVEL = E.maxLevel || 50;

  function instanceFromTemplate(tpl, uid) {
    return {
      uid: uid,
      templateId: tpl.id,
      name: tpl.name,
      especie: tpl.especie || 'cavalo',
      element: tpl.element,
      rarity: tpl.rarity,
      grau: tpl.grau || 2,
      sex: tpl.sex,
      level: 1,
      xp: 0,
      skills: tpl.skills.slice(),
      base: clone(tpl.base),
      potential: clone(tpl.potential),
      palette: tpl.palette ? clone(tpl.palette) : null,
      breedLeft: tpl.breedLeftMax || GD.BREED_LEFT[tpl.sex],
      parents: null,
      born: 0,
      gestacao: null,
      equip: GR.emptyEquip()
    };
  }

  // cria uma peça +0 no save st (uid 'i' + nextItemUid) e devolve a instância
  function addItem(st, id) {
    var it = { uid: 'i' + st.nextItemUid, id: id, plus: 0 };
    st.items.push(it);
    st.nextItemUid += 1;
    return it;
  }

  function newState(starterId) {
    var idx = Math.max(0, GD.STARTERS.map(function (h) { return h.id; }).indexOf(starterId));
    var st = {
      v: 4,
      rev: 0,
      gold: E.startingGold,
      tier: E.entryTiers[0],
      seedBase: freshSeedBase(idx),
      raceCounter: 0,
      pending: null,
      races: 0, wins: 0, podiums: 0, goldWon: 0,
      mounts: [instanceFromTemplate(GD.STARTERS[idx], 'm1')],
      activeId: 'm1',
      nextUid: 2,
      stableSlots: BR.stableSlotsStart,
      breedCounter: 0,
      items: [],
      nextItemUid: 1,
      pedras: 0,
      enhanceCounter: 0
    };
    // equipamento inicial (+0) já equipado no inicial
    GE.startGear.forEach(function (id) {
      if (!hasOwn(GD.GEAR, id)) return;
      var it = addItem(st, id);
      st.mounts[0].equip[GD.GEAR[id].slot] = it.uid;
    });
    return st;
  }

  // Itens do save v1–v3 -> peça do catálogo novo (spec §11). null: sem peça (rapadura vira 3 Pedras Negras).
  var OLD_ITEM_MAP = {
    'ferradura-leve': 'ferraduras-comum',
    'ferradura-cravos': 'ferraduras-magico',
    'sela-couro': 'sela-comum',
    'manta-la': 'armadura-comum',
    'antolhos': 'testeira-comum',
    'esporas-prata': 'estribos-magico',
    'capa-impermeavel': 'armadura-magico',
    'figa-sorte': 'estribos-magico',
    'penas-gaviao': 'testeira-magico',
    'rapadura-engenho': null
  };
  var OLD_RAPADURA_PEDRAS = 3;

  function num(v, d, lo, hi) { v = Number(v); return isFinite(v) ? clamp(Math.floor(v), lo, hi) : d; }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // Status das 7 chaves, todos finitos; senão null (a montaria é descartada).
  function statBlock(o, lo, hi) {
    if (!o || typeof o !== 'object') return null;
    var out = {};
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var v = Number(o[STAT_KEYS[i]]);
      if (o[STAT_KEYS[i]] == null || !isFinite(v)) return null;
      out[STAT_KEYS[i]] = clamp(Math.round(v), lo, hi);
    }
    return out;
  }
  var PALETTE_KEYS = ['coat', 'coatShade', 'mane', 'accent'];
  function validPalette(p) {
    if (!p || typeof p !== 'object') return null;
    var out = {};
    for (var i = 0; i < PALETTE_KEYS.length; i++) {
      var c = p[PALETTE_KEYS[i]];
      if (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) return null;
      out[PALETTE_KEYS[i]] = c;
    }
    return out;
  }
  function validParent(p) {
    if (!p || typeof p !== 'object') return null;
    var uid = p.uid == null ? null : (typeof p.uid === 'string' ? p.uid.slice(0, 16) : undefined);
    var name = p.name == null ? null : (typeof p.name === 'string' ? p.name.slice(0, 16) : undefined);
    if (uid === undefined || name === undefined) return null;
    return { uid: uid, name: name };
  }
  function validParents(p) {
    if (!p || typeof p !== 'object') return null;
    var f = validParent(p.f), m = validParent(p.m);
    return f && m ? { f: f, m: m } : null;
  }

  // Uma montaria do save v3: tipos e faixas; campo essencial ausente ou status inválidos -> null.
  function sanitizeMount(m) {
    if (!m || typeof m !== 'object') return null;
    if (typeof m.uid !== 'string' || !/^m\d{1,9}$/.test(m.uid)) return null;
    if (typeof m.element !== 'string' || !hasOwn(GD.ELEMENTS, m.element)) return null;
    if (typeof m.rarity !== 'string' || !hasOwn(GD.RARITIES, m.rarity)) return null;
    if (m.sex !== 'm' && m.sex !== 'f') return null;
    var templateId = null;
    if (m.templateId != null) {
      if (typeof m.templateId !== 'string' || !horseById(m.templateId)) return null;
      templateId = m.templateId;
    }
    var base = statBlock(m.base, 1, 100), potential = statBlock(m.potential, 0, 31);
    if (!base || !potential) return null;
    var name = typeof m.name === 'string' ? String(m.name).replace(/\s+/g, ' ').trim().slice(0, 16) : '';
    if (name.length < 2) name = 'Montaria';
    var out = {
      uid: m.uid,
      templateId: templateId,
      name: name,
      especie: 'cavalo',
      element: m.element,
      rarity: m.rarity,
      grau: num(m.grau, 2, 1, 3),
      sex: m.sex,
      level: num(m.level, 1, 1, MAX_LEVEL),
      xp: num(m.xp, 0, 0, 1e7),
      skills: [],
      base: base,
      potential: potential,
      palette: validPalette(m.palette),
      breedLeft: num(m.breedLeft, GD.BREED_LEFT[m.sex], 0, 4),
      parents: validParents(m.parents),
      born: num(m.born, 0, 0, 1e9),
      gestacao: (typeof m.gestacao === 'number' && isFinite(m.gestacao) && m.gestacao >= 0) ? m.gestacao : null,
      equip: GR.emptyEquip()      // preenchido em sanitize(), que conhece as peças válidas
    };
    out.skills = validSkills(m.skills, out);
    return out;
  }

  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var mounts, activeId, nextUid, stableSlots, breedCounter;
    var start = BR.stableSlotsStart, max = BR.stableSlotsMax;
    var v3 = Number(s.v) >= 3, v4 = Number(s.v) >= 4;
    var rawEquip = {};   // uid da montaria -> equip cru do save (validado depois das peças)
    if (!v3 && !Array.isArray(s.mounts)) {
      // v1/v2: um inicial com level/xp/skills na raiz (v1 tinha tática e não tinha skills: ignorados)
      var starter = GD.STARTERS.filter(function (h) { return h.id === s.starterId; })[0];
      if (!starter) return null;
      var m1 = instanceFromTemplate(starter, 'm1');
      m1.level = num(s.level, 1, 1, MAX_LEVEL);
      m1.xp = num(s.xp, 0, 0, 1e7);
      m1.skills = validSkills(s.skills, m1);
      mounts = [m1]; activeId = 'm1'; nextUid = 2; stableSlots = start; breedCounter = 0;
    } else {
      // v3+: mounts que não é array vira [] (recria o inicial e mantém o Ouro)
      mounts = [];
      var seen = {}, maxUid = 0;
      (Array.isArray(s.mounts) ? s.mounts : []).forEach(function (raw) {
        var m = sanitizeMount(raw);
        if (!m || seen[m.uid]) return;
        seen[m.uid] = true;
        mounts.push(m);
        if (raw.equip && typeof raw.equip === 'object') rawEquip[m.uid] = raw.equip;
        if (/^m\d{1,9}$/.test(m.uid)) maxUid = Math.max(maxUid, Number(m.uid.slice(1)));
      });
      if (!mounts.length) { mounts.push(instanceFromTemplate(GD.STARTERS[0], 'm1')); maxUid = 1; }
      activeId = mounts.some(function (m) { return m.uid === s.activeId; }) ? s.activeId : mounts[0].uid;
      nextUid = Math.max(num(s.nextUid, 0, 0, 1e9), maxUid + 1);
      stableSlots = clamp(num(s.stableSlots, start, 0, 1e9), Math.max(start, mounts.length), max);
      breedCounter = num(s.breedCounter, 0, 0, 1e9);
    }
    var base = newState(GD.STARTERS[0].id);
    base.rev = num(s.rev, 0, 0, 1e12);
    base.gold = num(s.gold, E.startingGold, 0, 1e9);
    base.tier = E.entryTiers.indexOf(s.tier) >= 0 ? s.tier : E.entryTiers[0];
    base.seedBase = num(s.seedBase, base.seedBase, 0, 4294967295);
    base.raceCounter = num(s.raceCounter, 0, 0, 1e9);
    var p = s.pending;
    if (p && typeof p === 'object' && isFinite(p.counter) && p.counter >= 1 && p.counter <= base.raceCounter) {
      var fee = num(p.fee, 0, 0, 1e6);
      if (p.training ? fee === 0 : E.entryTiers.indexOf(fee) >= 0) {
        base.pending = { counter: num(p.counter, 1, 1, 1e9), training: !!p.training, fee: fee, pr: num(p.pr, 600, 1, 1e5) };
      }
    }
    base.races = num(s.races, 0, 0, 1e9);
    base.wins = num(s.wins, 0, 0, 1e9);
    base.podiums = num(s.podiums, 0, 0, 1e9);
    base.goldWon = num(s.goldWon, 0, 0, 1e12);
    base.mounts = mounts;
    base.activeId = activeId;
    base.nextUid = nextUid;
    base.stableSlots = stableSlots;
    base.breedCounter = breedCounter;
    sanitizeGear(s, v4, base, rawEquip);
    return base;
  }

  // Peças, pedras e equipamento (sobrescreve o equipamento inicial de newState). v4: lê s.items;
  // v1–v3: migra s.inventory/s.equipped. Peça inválida (uid, id, plus ou uid repetido) some em silêncio;
  // equip só aponta para peça existente, do slot certo, e cada peça fica em uma montaria só
  // (vence a primeira na ordem de mounts). Nunca mexe no Ouro.
  function sanitizeGear(s, v4, base, rawEquip) {
    var items = [], byUid = {}, maxItemUid = 0, pedras = num(s.pedras, 0, 0, 1e6);
    var legacyEquip = null;   // peça migrada do antigo 'equipped' (vai para a montaria ativa)
    if (v4) {
      (Array.isArray(s.items) ? s.items : []).forEach(function (it) {
        if (!it || typeof it !== 'object') return;
        if (typeof it.uid !== 'string' || !/^i\d{1,9}$/.test(it.uid) || hasOwn(byUid, it.uid)) return;
        if (typeof it.id !== 'string' || !hasOwn(GD.GEAR, it.id)) return;
        var p = it.plus;
        if (!(typeof p === 'number' && p === Math.floor(p) && p >= 0 && p <= GE.plusMax)) return;
        var out = { uid: it.uid, id: it.id, plus: p };
        items.push(out);
        byUid[out.uid] = out;
        maxItemUid = Math.max(maxItemUid, Number(out.uid.slice(1)));
      });
    } else {
      pedras = 0;
      var n = 0;
      (Array.isArray(s.inventory) ? s.inventory : []).forEach(function (oldId) {
        if (typeof oldId !== 'string' || !hasOwn(OLD_ITEM_MAP, oldId)) return;
        var newId = OLD_ITEM_MAP[oldId];
        if (newId === null) { pedras += OLD_RAPADURA_PEDRAS; return; }
        if (!hasOwn(GD.GEAR, newId)) return;
        n += 1;
        var out = { uid: 'i' + n, id: newId, plus: 0 };
        items.push(out);
        byUid[out.uid] = out;
        if (oldId === s.equipped && !legacyEquip) legacyEquip = out;
      });
      maxItemUid = n;
      pedras = Math.min(pedras, 1e6);
    }
    var taken = {};
    base.mounts.forEach(function (m) {
      var raw = v4 && hasOwn(rawEquip, m.uid) ? rawEquip[m.uid] : null;
      var eq = GR.emptyEquip();
      GR.SLOTS.forEach(function (slot) {
        var uid = raw ? raw[slot] : null;
        if (typeof uid !== 'string' || !hasOwn(byUid, uid) || taken[uid]) return;
        if (GD.GEAR[byUid[uid].id].slot !== slot) return;
        eq[slot] = uid;
        taken[uid] = true;
      });
      m.equip = eq;
    });
    if (legacyEquip) {
      var act = null;
      base.mounts.forEach(function (m) { if (m.uid === base.activeId) act = m; });
      if (act) act.equip[GD.GEAR[legacyEquip.id].slot] = legacyEquip.uid;
    }
    base.items = items;
    base.nextItemUid = v4 ? Math.max(num(s.nextItemUid, 0, 0, 1e9), maxItemUid + 1) : maxItemUid + 1;
    base.pedras = pedras;
    base.enhanceCounter = v4 ? num(s.enhanceCounter, 0, 0, 1e9) : 0;
  }

  // Skills salvas de uma montaria: só ids que ela pode ter (mesmas regras do RaceSim.learnSkill:
  // elemento dela ou neutro; exclusiva só do template dono), sem repetir, até o nº de vagas da raridade.
  // Ausente/vazio/inválido -> as skills de nascença do template (potro sem template: nenhuma).
  function validSkills(list, mount) {
    var st = mount.templateId ? horseById(mount.templateId) : null;
    var slots = (GD.RARITIES[mount.rarity] || GD.RARITIES.comum).skillSlots;
    var out = [];
    if (Array.isArray(list)) {
      list.forEach(function (id) {
        var sk = typeof id === 'string' && hasOwn(GD.SKILLS, id) ? GD.SKILLS[id] : null;
        if (!sk || out.indexOf(id) >= 0 || out.length >= slots) return;
        if (sk.exclusive && sk.exclusive !== mount.templateId) return;
        if (sk.element !== 'neutro' && sk.element !== mount.element) return;
        out.push(id);
      });
    }
    return out.length ? out : (st ? st.skills.slice() : []);
  }

  // Montaria ativa: a instância viva (para mutar). playerHorse() devolve um clone dela.
  function activeMount() {
    for (var i = 0; i < state.mounts.length; i++) if (state.mounts[i].uid === state.activeId) return state.mounts[i];
    return state.mounts[0];
  }
  function playerHorse() {
    return clone(activeMount());
  }
  function mountByUid(uid) {
    for (var i = 0; i < state.mounts.length; i++) if (state.mounts[i].uid === uid) return state.mounts[i];
    return null;
  }

  // Equipamento: peças em state.items, equipadas por montaria em mount.equip (slot -> uid|null).
  function emptyEquip() { return GR.emptyEquip(); }
  function itemsByUid() {
    var o = {};
    state.items.forEach(function (it) { o[it.uid] = it; });
    return o;
  }
  function itemByUid(uid) {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].uid === uid) return state.items[i];
    return null;
  }
  function gearOf(mount) { return GR.resolve(mount, itemsByUid()); }
  function playerGear() { return gearOf(activeMount()); }
  function newItem(id) { return addItem(state, id); }
  // onde a peça está equipada: { mount, slot } ou null
  function isEquipped(uid) {
    for (var i = 0; i < state.mounts.length; i++) {
      var eq = state.mounts[i].equip || {};
      for (var j = 0; j < GR.SLOTS.length; j++) if (eq[GR.SLOTS[j]] === uid) return { mount: state.mounts[i], slot: GR.SLOTS[j] };
    }
    return null;
  }

  // XP ganho -> níveis (até o máximo) e, a cada nível, chance de aprender uma skill
  // (sorteio determinístico pela seed do save, pelo seedTag (nº do páreo) e pelo nível alcançado).
  function applyXp(mount, xpGain, seedTag) {
    var levels = 0, learned = [];
    mount.xp += xpGain;
    while (mount.level < MAX_LEVEL && mount.xp >= E.xpToLevel(mount.level)) {
      mount.xp -= E.xpToLevel(mount.level);
      mount.level += 1;
      levels += 1;
    }
    if (mount.level >= MAX_LEVEL) mount.xp = Math.min(mount.xp, E.xpToLevel(mount.level));
    for (var k = 1; k <= levels; k++) {
      var lrng = RS.mulberry32(RS.hash2(state.seedBase, seedTag * 100 + (mount.level - levels + k)));
      // learnSkill confere a exclusiva por .id: a instância usa o id do template de origem
      var sid = RS.learnSkill({ id: mount.templateId, element: mount.element, rarity: mount.rarity, skills: mount.skills }, lrng);
      if (sid) { mount.skills.push(sid); learned.push(sid); }
    }
    return { levels: levels, learned: learned };
  }

  // ===========================================================================
  // Estado de UI (não persistido)
  // ===========================================================================
  var state = null;
  var ui = { screen: 'inicial', lobby: null, result: null, confirmReset: false, confirmLiberar: null, notice: null, haras: null, montaria: null, tab: 'estabulo' };
  var live = [];          // canvases animados da tela atual
  var raceView = null;
  var portraitQueue = [];

  // Outra aba gravou um save mais novo: adota e volta para um ponto seguro.
  function adoptExternal(raw) {
    var s = sanitize(raw);
    if (!s) {
      state = null; ui.lobby = null; ui.result = null;
      go('inicial');
      return;
    }
    state = s;
    if (ui.screen === 'corrida' || ui.screen === 'resultado') return;  // o resultado já mostrado continua válido
    ui.notice = 'O jogo foi atualizado em outra aba; este é o progresso mais recente.';
    ui.lobby = null;
    go(ui.screen === 'inicial' ? 'inicial' : 'estabulo');
  }

  // ===========================================================================
  // Canvas nítido (escala inteira em pixels de dispositivo)
  // ===========================================================================
  function setupCanvas(cv, artW, artH, cssScale) {
    var r = dpr();
    var k = Math.max(1, Math.round(cssScale * r));
    cv.width = artW * k;
    cv.height = artH * k;
    cv.style.width = (artW * k / r) + 'px';
    cv.style.height = (artH * k / r) + 'px';
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { ctx: ctx, k: k };
  }

  function iconHtml(element) {
    return '<canvas class="icone" data-icon="' + esc(element) + '" aria-hidden="true"></canvas>';
  }

  // Retrato: baia com parede de tábuas e palha; cavalo parado (respira, pisca, abana o rabo,
  // descansa um posterior e abaixa a cabeça de vez em quando).
  var PORTRAIT_W = 48, PORTRAIT_H = 36;
  function portraitHtml(horse, opts) {
    opts = opts || {};
    var id = portraitQueue.length;
    portraitQueue.push({ horse: horse, opts: opts });
    return '<canvas class="retrato" data-retrato="' + id + '" role="img" aria-label="' +
      esc('Retrato de ' + horse.name) + '"></canvas>';
  }

  function drawStall(ctx, k, w, h, seed) {
    ctx.fillStyle = C.painel2; ctx.fillRect(0, 0, w * k, h * k);
    ctx.fillStyle = C.tabua;
    for (var y = 5; y < 31; y += 6) ctx.fillRect(0, y * k, w * k, k);
    for (var row = 0; row < 5; row++) {
      var off = (row * 13 + seed * 7) % 17;
      for (var x = off; x < w; x += 17) ctx.fillRect(x * k, (row * 6 + 6) * k, k, 5 * k);
    }
    // palha
    ctx.fillStyle = C.palha2; ctx.fillRect(0, 31 * k, w * k, (h - 31) * k);
    ctx.fillStyle = C.palha;
    for (var i = 0; i < 26; i++) {
      var px = (i * 11 + seed * 5) % w, py = 32 + (i * 7) % (h - 32);
      ctx.fillRect(px * k, py * k, 2 * k, k);
    }
    ctx.fillStyle = C.escuro; ctx.fillRect(0, 31 * k, w * k, k);
  }

  function hydrate(root) {
    var icons = root.querySelectorAll('canvas[data-icon]');
    for (var i = 0; i < icons.length; i++) {
      var cv = icons[i];
      var s = setupCanvas(cv, 10, 10, 2);
      SP.drawElementIcon(s.ctx, 0, 0, cv.getAttribute('data-icon'), s.k);
    }
    var ps = root.querySelectorAll('canvas[data-retrato]');
    for (var j = 0; j < ps.length; j++) {
      (function (cv) {
        var entry = portraitQueue[Number(cv.getAttribute('data-retrato'))];
        if (!entry) return;
        var o = entry.opts, horse = entry.horse;
        var s = setupCanvas(cv, PORTRAIT_W, PORTRAIT_H, PORTRAIT_SCALE);
        var seed = (horse.name.charCodeAt(0) || 0) + (horse.name.length * 3);
        var phase = (seed % 10) * 0.37;
        var item = {
          drawn: false,
          draw: function (t) {
            if (item.drawn && reduced()) return;
            item.drawn = true;
            drawStall(s.ctx, s.k, PORTRAIT_W, PORTRAIT_H, seed);
            SP.drawHorse(s.ctx, 5 * s.k, 1 * s.k, {
              palette: horse.palette, element: horse.element, idle: true, t: reduced() ? 0.5 : t + phase,
              scale: s.k, jockey: !!o.jockey, silks: o.silks || PLAYER_SILKS
            });
          }
        };
        item.draw(0);
        live.push(item);
      })(ps[j]);
    }
    var perfis = root.querySelectorAll('canvas[data-perfil]');
    for (var q = 0; q < perfis.length; q++) drawProfileCanvas(perfis[q]);
    var podios = root.querySelectorAll('canvas[data-podio]');
    for (var z = 0; z < podios.length; z++) setupPodium(podios[z]);
  }

  // ===========================================================================
  // Fragmentos de UI
  // ===========================================================================
  function elementHtml(element) {
    var el = GD.ELEMENTS[element] || GD.ELEMENTS.neutro;
    return '<span class="el el--' + esc(el.id) + '">' + iconHtml(el.id) + esc(el.name) + '</span>';
  }
  function rarityHtml(rarity) {
    var r = GD.RARITIES[rarity] || GD.RARITIES.comum;
    return '<span class="raridade raridade--' + esc(r.id) + '">' + esc(r.name) + '</span>';
  }
  function leagueHtml(rating) {
    var L = RS.leagueFor(rating);
    return '<span class="liga liga--' + esc(L.id) + '">Liga ' + esc(L.name) + '</span>';
  }
  // Barras em 20 segmentos inteiros (cada um = 5 pontos): nada de meio segmento.
  function barHtml(v, b) {
    var SEG = 20;
    var fill = clamp(Math.round(v / 5), 0, SEG), base = b == null ? fill : clamp(Math.round(b / 5), 0, SEG);
    var out = '';
    for (var i = 0; i < SEG; i++) {
      var cls = '';
      if (i < Math.min(fill, base)) cls = 'on';
      else if (i < fill) cls = 'on extra';
      else if (i < base) cls = 'menos';
      out += '<i' + (cls ? ' class="' + cls + '"' : '') + '></i>';
    }
    return out;
  }
  function statsHtml(stats, baseStats) {
    var out = '<dl class="status">';
    STAT_KEYS.forEach(function (k) {
      var info = GD.STATS[k];
      var v = stats[k], b = baseStats ? baseStats[k] : v, d = v - b;
      var delta = d ? '<span class="delta ' + (d > 0 ? 'mais' : 'menos-t') + '">' + (d > 0 ? '+' : '−') + Math.abs(d) + '</span>' : '';
      out += '<dt title="' + esc(info.name + ': ' + info.desc) + '">' + statIcon(k) + '<span>' + esc(info.short) + '</span></dt>' +
        '<dd><div class="barra barra--seg" role="img" aria-label="' + esc(info.name + ' ' + v) + '">' + barHtml(v, b) + '</div></dd>' +
        '<dd class="valor">' + v + delta + '</dd>';
    });
    return out + '</dl>';
  }
  function xpHtml(level, xp) {
    var need = E.xpToLevel(level);
    var maxed = level >= (E.maxLevel || 50);
    var pct = maxed ? 100 : clamp(xp / need * 100, 0, 100);
    return '<div class="xp"><div class="xp-linha"><span class="nivel">Nv ' + level + '</span><span>' +
      (maxed ? 'Nível máximo' : fmt(xp) + ' / ' + fmt(need) + ' XP') + '</span></div>' +
      '<div class="barra barra--xp" role="img" aria-label="' + esc('Experiência ' + Math.round(pct) + '%') + '"><i style="width:' + (Math.round(pct / 5) * 5) + '%"></i></div></div>';
  }
  function skillHtml(id) {
    var sk = GD.SKILLS[id];
    if (!sk) return '';
    return '<div class="habilidade"><b>' + iconHtml(sk.element) + esc(sk.name) + '</b><span>' + esc(sk.desc) + '</span></div>';
  }
  function silkClass(r) { return r.isPlayer ? 'seda-voce' : 'seda-' + r.silkIdx; }
  function laneChip(r, i, extra) {
    return '<span class="raia ' + silkClass(r) + (extra ? ' ' + extra : '') + '" aria-label="Raia ' + (i + 1) + '">' + (i + 1) + '</span>';
  }

  // selo do conjunto (a partir de 3 peças, quando o bônus começa)
  function setBadgeHtml(gear) {
    if (!gear || !gear.set || !gear.set.id || gear.set.count < 3 || !hasOwn(GD.GEAR_SETS, gear.set.id)) return '';
    return '<span class="set-badge">' + esc(GD.GEAR_SETS[gear.set.id].name + ' ×' + gear.set.count) + '</span>';
  }
  // resumo do equipamento de uma montaria: um quadrinho por slot (+N ou vazio) e o selo do conjunto
  function gearSummaryHtml(mount) {
    var gear = gearOf(mount);
    var bySlot = {};
    gear.pieces.forEach(function (p) { bySlot[p.slot] = p; });
    var slots = GR.SLOTS.map(function (slot) {
      var p = bySlot[slot], info = GD.GEAR_SLOT_INFO[slot];
      if (!p) return '<span class="slot slot--vazio" title="' + esc(info.name + ': vazio') + '">—</span>';
      return '<span class="slot slot--cheio" title="' + esc(GD.GEAR[p.id].name + ' +' + p.plus) + '">+' + p.plus + '</span>';
    }).join('');
    return '<div class="slots" aria-label="Equipamento">' + slots + setBadgeHtml(gear) + '</div>';
  }

  // ===========================================================================
  // Navegação (+ botão Voltar do Android/navegador)
  // ===========================================================================
  // Tipos de tela: 'aba' (raiz, com cabeçalho e barra; não empilha histórico), 'sub' (com cabeçalho e barra;
  // empilha um estado e o Voltar devolve a ui.tab) e 'full' (tela cheia, sem casca).
  var SCREEN_KIND = { inicial: 'full', estabulo: 'aba', correr: 'aba', expedicao: 'aba', haras: 'aba', loja: 'aba', montaria: 'sub', perfil: 'sub', largada: 'full', corrida: 'full', resultado: 'full' };
  var ABAS = [{ id: 'estabulo', icone: '🐴', rotulo: 'Estábulo' }, { id: 'correr', icone: '🏁', rotulo: 'Correr' }, { id: 'expedicao', icone: '🧭', rotulo: 'Expedição' }, { id: 'haras', icone: '💞', rotulo: 'Haras' }, { id: 'loja', icone: '🛒', rotulo: 'Loja' }];
  function kindOf(screen) { return hasOwn(SCREEN_KIND, screen) ? SCREEN_KIND[screen] : 'full'; }
  var guardPushed = false, ignorePop = false;
  function isRoot(screen) { return kindOf(screen) === 'aba' || screen === 'inicial'; }
  function syncHistory(screen) {
    try {
      if (!isRoot(screen) && !guardPushed) { window.history.pushState({ galope: 1 }, ''); guardPushed = true; }
      else if (isRoot(screen) && guardPushed) { guardPushed = false; ignorePop = true; window.history.back(); }
    } catch (e) { guardPushed = false; }
  }
  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop = false; return; }
    guardPushed = false;
    if (ui.screen === 'corrida') { if (raceView) raceView.skip(); else go('resultado'); }
    else if (!isRoot(ui.screen) && state) go(ui.tab);
  });

  function go(screen) {
    if (raceView && screen !== 'corrida') { raceView.destroy(); raceView = null; }
    if (screen !== ui.screen) {
      ui.confirmReset = false; ui.confirmLiberar = null;
      SP.limparCacheMoldes();   // os moldes recoloridos da tela anterior não voltam a ser usados
    }
    // voltar de uma sub-tela (Perfil, Montaria) para a mesma aba de origem preserva o estado do Haras e da Loja
    var voltaMesmaAba = kindOf(ui.screen) === 'sub' && screen === ui.tab;
    if (screen === 'haras' && ui.screen !== 'haras' && !voltaMesmaAba) ui.haras = newHaras();
    if (screen !== 'montaria') ui.montaria = null;   // sair da Montaria descarta o "Desfazer venda" e a confirmação
    // a Loja guarda o estado enquanto uma sub-tela aberta a partir dela está por cima
    if (screen !== 'loja' && !(kindOf(screen) === 'sub' && ui.tab === 'loja')) ui.loja = null;
    if (kindOf(screen) === 'aba') ui.tab = screen;   // a barra de abas lê ui.tab
    ui.screen = screen;
    if (appEl) appEl.classList.toggle('app--corrida', screen === 'corrida');
    render();
    try { window.scrollTo(0, 0); } catch (e) { /* ignora */ }
    var h = telaEl.querySelector('[data-foco]');
    if (h) { try { h.focus({ preventScroll: true }); } catch (e2) { h.focus(); } }
    syncHistory(screen);
  }

  function devAtivo() {
    return /[?&]dev=1(&|$)/.test(window.location.search);
  }

  function render() {
    live = [];
    portraitQueue = [];
    var html;
    switch (ui.screen) {
      case 'estabulo': html = renderEstabulo(); break;
      case 'largada': html = renderLargada(); break;
      case 'corrida': html = renderCorrida(); break;
      case 'resultado': html = renderResultado(); break;
      case 'haras': html = renderHaras(); break;
      case 'montaria': html = renderMontaria(); break;
      case 'loja': html = renderLoja(); break;
      case 'correr': html = renderCorrer(); break;
      case 'expedicao': html = renderExpedicao(); break;
      case 'perfil': html = renderPerfil(); break;
      default: html = renderInicial();
    }
    var comCasca = kindOf(ui.screen) !== 'full';
    if (comCasca) html = appTopoHtml() + '<main class="app-conteudo">' + html + '</main>' + appAbasHtml();
    if (appEl) appEl.classList.toggle('app-com-abas', comCasca);
    document.documentElement.classList.toggle('app-com-abas', comCasca);   // scroll-padding do foco (CSS)
    document.documentElement.classList.toggle('dev-ativo', devAtivo());     // telas cheias: barra de ação acima do painel dev
    if (devAtivo() && ui.screen !== 'corrida') {
      html += '<div class="dev-espaco" style="height:56px" aria-hidden="true"></div><div class="dev-painel" role="group" aria-label="Painel de desenvolvimento"><span>dev</span>' +
        '<button type="button" class="btn btn--pequeno" data-acao="dev-niveis">+10 níveis (ativa)</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="dev-ouro">+1000 Ouro</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="dev-cruz">+1 cruzamento (ativa)</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="dev-pedras">+5 Pedras</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="dev-set">+ conjunto Lendário (ativa)</button></div>';
    }
    telaEl.innerHTML = ordFix(html);
    hydrate(telaEl);
    if (ui.screen === 'corrida') {
      if (raceView) raceView.destroy();
      raceView = createRaceView(ui.lobby, telaEl);
    }
  }

  // ===========================================================================
  // Casca: cabeçalho fixo e barra de abas (abas e sub-telas)
  // ===========================================================================
  function appTopoHtml() {
    return '<header class="app-topo"><span class="logo-mini">Galope Elemental</span>' +
      '<span class="topo-saldos">' + pedrasSaldoHtml() +
      '<span class="saldo" aria-label="Saldo">' + ouroHtml(state.gold) + '</span></span>' +
      '<button type="button" class="btn btn--pequeno app-perfil" data-acao="perfil" aria-label="Perfil">👤</button></header>';
  }
  // saldo de Pedras Negras ("🪨 N"), igual no cabeçalho e no Perfil
  function pedrasSaldoHtml() {
    return '<span class="pedras" aria-label="' + esc(pedrasTxt(state.pedras) + (state.pedras === 1 ? ' negra' : ' negras')) + '">🪨 ' + fmt(state.pedras) + '</span>';
  }
  function appAbasHtml() {
    return '<nav class="app-abas" role="navigation" aria-label="Seções">' + ABAS.map(function (a) {
      var ativa = ui.tab === a.id;
      var cls = 'app-aba' + (ativa ? ' app-aba--ativa' : '') + (a.id === 'correr' && state.pending ? ' app-aba--ponto' : '');
      return '<button type="button" class="' + cls + '" data-acao="aba" data-id="' + esc(a.id) + '"' + (ativa ? ' aria-current="page"' : '') + '>' +
        '<span class="app-aba-icone" aria-hidden="true">' + a.icone + '</span><span class="app-aba-rotulo">' + esc(a.rotulo) + '</span></button>';
    }).join('') + '</nav>';
  }
  // Perfil: estatísticas, saldo, inventário e "Recomeçar com outro inicial"
  function renderPerfil() {
    return '<section class="tela" aria-labelledby="t-perfil">' +
      '<button type="button" class="btn btn--pequeno" data-acao="perfil-voltar">Voltar</button>' +
      '<h1 class="titulo titulo--tela" id="t-perfil" tabindex="-1" data-foco>Perfil</h1>' +
      '<div class="caixa">' +
        '<div class="linha-meta"><span>Corridas <b>' + fmt(state.races) + '</b></span><span>Vitórias <b>' + fmt(state.wins) + '</b></span>' +
          '<span>Pódios <b>' + fmt(state.podiums) + '</b></span><span>Prêmios ' + ouroHtml(state.goldWon) + '</span></div>' +
        '<div class="linha-meta"><span>Ouro ' + ouroHtml(state.gold) + '</span><span>Pedras ' + pedrasSaldoHtml() + '</span></div>' +
        '<div class="linha-meta"><span>' + esc(state.mounts.length) + (state.mounts.length === 1 ? ' montaria' : ' montarias') + ' · ' +
          esc(state.items.length) + (state.items.length === 1 ? ' peça' : ' peças') + '</span></div>' +
      '</div>' +
      '<footer class="caixa">' + resetHtml() + '</footer></section>';
  }

  // ===========================================================================
  // Tela 1 — Escolha do inicial (carrossel no celular)
  // ===========================================================================
  function renderInicial() {
    var cards = GD.STARTERS.map(function (h, idx) {
      var stats = RS.computeStats(h, null);
      var el = GD.ELEMENTS[h.element];
      var rating = RS.powerRating(h, null);
      var wPct = Math.round((RS.TUNING.weatherMult - 1) * 100);
      var best = el.weather && GD.WEATHERS[el.weather] ? GD.WEATHERS[el.weather].name + ' (+' + wPct + '%)' : '—';
      var worst = Object.keys(GD.WEATHERS).filter(function (w) { return GD.WEATHERS[w].penalizes === h.element; })
        .map(function (w) { return GD.WEATHERS[w].name + ' (−' + wPct + '%)'; }).join(', ') || '—';
      var bonus = el.statBonus ? '+' + el.statBonus.amount + ' de ' + GD.STATS[el.statBonus.stat].name : '—';
      return '<article class="caixa inicial" id="ini-' + esc(h.id) + '" aria-label="' + esc(h.name + ', ' + (idx + 1) + ' de ' + GD.STARTERS.length) + '">' +
        '<div class="retrato-palco">' + portraitHtml(h) + '<span class="contador">' + (idx + 1) + '/' + GD.STARTERS.length + '</span></div>' +
        '<div class="inicial-topo"><h2 class="cavalo-nome">' + esc(h.name) + '</h2>' + elementHtml(h.element) + '</div>' +
        '<p class="cavalo-titulo"><b>' + esc(h.title) + '.</b> ' + esc(h.bio) + '</p>' +
        '<div class="linha-meta">' + rarityHtml(h.rarity) + '<span>Poder <b>' + rating + '</b></span>' + leagueHtml(rating) + '</div>' +
        statsHtml(stats) +
        skillHtml(h.skills[0]) +
        '<dl class="afinidade"><dt>Bônus</dt><dd>' + esc(bonus) + '</dd><dt>Clima bom</dt><dd class="mais">' + esc(best) +
        '</dd><dt>Clima ruim</dt><dd class="menos-t">' + esc(worst) + '</dd></dl>' +
        '<button type="button" class="btn btn--ouro btn--grande" data-acao="escolher" data-id="' + esc(h.id) + '">Escolher ' + esc(h.name) + '</button>' +
        '</article>';
    }).join('');
    var nav = GD.STARTERS.map(function (h) {
      return '<button type="button" class="btn btn--pequeno pilula el--' + esc(h.element) + '" data-acao="ver-inicial" data-id="' + esc(h.id) + '">' +
        iconHtml(h.element) + '<span>' + esc(h.name) + '</span></button>';
    }).join('');
    return '<section class="tela tela--larga" aria-labelledby="t-inicial">' +
      '<header class="tela-cabeca"><h1 class="logo" id="t-inicial" tabindex="-1" data-foco>Galope Elemental</h1>' +
      '<p class="sub">Escolha seu primeiro cavalo. Ele corre sozinho nas corridas valendo Ouro: você decide o item e a aposta antes da largada.</p></header>' +
      '<div class="iniciais-nav" role="group" aria-label="Comparar os 3 iniciais">' + nav + '<span class="nota">Deslize para comparar</span></div>' +
      '<div class="iniciais">' + cards + '</div>' +
      '<p class="nota">Elementos não batem de frente: Fogo, Água e Grama ganham ou perdem conforme o clima de cada corrida, que pode virar no Dado da Sorte.</p>' +
      '</section>';
  }

  // ===========================================================================
  // Tela 2 — Estábulo
  // ===========================================================================
  function affordableTier(gold, wanted) {
    if (gold >= wanted) return wanted;
    var ok = E.entryTiers.filter(function (t) { return t <= gold; });
    return ok.length ? ok[ok.length - 1] : null;
  }
  // state.tier é a preferência; a entrada efetiva é calculada na hora (sem regravar a preferência).
  function effectiveTier() { return affordableTier(state.gold, state.tier); }

  var SLOT_PRICE = BR.stableSlotPrice;
  function estrelasHtml(grau) {
    var g = clamp(Math.floor(Number(grau) || 0), 0, 3), txt = '';
    for (var i = 0; i < 3; i++) txt += i < g ? '★' : '☆';
    return '<span class="estrelas" aria-label="Grau ' + g + '">' + txt + '</span>';
  }
  function uidNum(uid) { return String(uid).replace(/\D+/g, ''); }

  // opts.semAcoes: sem os botões (ex.: card do potro no resultado do Haras).
  // O cartão inteiro abre a montaria (data-acao="montaria"); os botões internos têm a própria ação.
  // Renomear e Liberar ficam na tela da Montaria.
  function mountCardHtml(m, isActive, opts) {
    var P = state.pending;
    var semAcoes = !!(opts && opts.semAcoes);
    var corcel = window.Breed && window.Breed.isCorcel(m)
      ? '<span class="corcel" title="Corcel: herança garantida">⚑ Corcel</span>' : '';
    var acoes = semAcoes ? '' : '<div class="montaria-acoes">' +
        '<button type="button" class="btn btn--pequeno" data-acao="ativar" data-id="' + esc(m.uid) + '"' + (isActive || P ? ' disabled' : '') + '>Tornar ativa</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="montaria" data-id="' + esc(m.uid) + '">Ver</button>' +
        '</div>';
    var abre = semAcoes ? '' : ' data-acao="montaria" data-id="' + esc(m.uid) + '"';
    return '<article class="montaria' + (isActive ? ' montaria--ativa' : '') + '" data-uid="' + esc(m.uid) + '"' + abre + '>' +
      portraitHtml(m) +
      '<h3 class="cavalo-nome">' + esc(m.name) + ' <small>#' + esc(uidNum(m.uid)) + '</small></h3>' +
      '<div class="linha-meta">' + rarityHtml(m.rarity) + estrelasHtml(m.grau) + elementHtml(m.element) +
        '<span>' + (m.sex === 'f' ? '♀ Fêmea' : '♂ Macho') + '</span>' +
        '<span class="nivel">Nv ' + esc(m.level) + '</span>' +
        '<span>cruza ' + esc(m.breedLeft) + 'x</span>' + corcel +
        (isActive ? '<span class="badge-ativa">Ativa</span>' : '') +
      '</div>' + gearSummaryHtml(m) + acoes +
    '</article>';
  }

  function montariasHtml() {
    var maxed = state.stableSlots >= BR.stableSlotsMax;
    var canExpand = !maxed && state.gold >= SLOT_PRICE;
    return '<section class="caixa" aria-label="Suas montarias"><div class="montarias">' + state.mounts.map(function (m) { return mountCardHtml(m, m.uid === state.activeId); }).join('') + '</div>' +
      '<div class="acoes"><button type="button" data-acao="expandir" class="btn"' + (canExpand ? '' : ' disabled') + '>' +
        (maxed ? 'Estábulo no máximo' : 'Expandir estábulo (' + fmt(SLOT_PRICE) + ')') + '</button></div></section>';
  }

  // aviso pendente (ex.: "Ouro insuficiente", save de outra aba): mostra uma vez e limpa
  function noticeHtml() {
    var html = ui.notice ? '<p class="aviso">' + esc(ui.notice) + '</p>' : '';
    ui.notice = null;
    return html;
  }

  // Aba Estábulo: só a lista de montarias
  function renderEstabulo() {
    return '<section class="tela" aria-labelledby="t-estabulo">' +
      '<h1 class="titulo titulo--tela" id="t-estabulo" tabindex="-1" data-foco>Estábulo <span class="nota">' +
        state.mounts.length + '/' + state.stableSlots + ' vagas</span></h1>' + noticeHtml() +
      montariasHtml() +
      '</section>';
  }

  // ===========================================================================
  // Aba Correr: montaria ativa, entrada e "Procurar corrida" (a sala aberta nunca é re-sorteada)
  // ===========================================================================
  function renderCorrer() {
    var h = playerHorse();
    var rating = RS.powerRating(h, playerGear());
    var broke = state.gold < MIN_ENTRY;
    var tier = effectiveTier();
    var P = state.pending;

    var tierOpts = E.entryTiers.map(function (t) {
      var can = state.gold >= t && !P;
      var on = P ? (!P.training && P.fee === t) : (state.gold >= t && tier === t);
      return '<button type="button" class="btn opcao opcao--centro" data-acao="tier" data-id="' + t + '" aria-pressed="' + on + '"' + (can ? '' : ' disabled') + '>' +
        '<span class="opcao-nome">' + ouroHtml(t) + '</span><span class="opcao-desc">' + (state.gold >= t ? 'Entrada' : 'Sem Ouro') + '</span></button>';
    }).join('');

    var cta;
    if (P) {
      cta = '<p class="aviso">Sua sala do Páreo nº ' + P.counter + ' continua aberta' + (P.training ? ' (treino)' : ' com entrada de ' + fmt(P.fee) + ' de Ouro') +
        '. As condições e os rivais não mudam até você correr.</p>' +
        '<button type="button" class="btn btn--ouro btn--grande" data-acao="procurar">Voltar à sala de largada</button>';
    } else if (broke) {
      cta = '<p class="aviso aviso--perda">Seu Ouro não cobre a menor entrada (' + MIN_ENTRY + '). Faça um treino gratuito: sem aposta, rende XP e de 10 a 30 de Ouro.</p>' +
        '<button type="button" class="btn btn--ouro btn--grande" data-acao="treino">Treino gratuito</button>';
    } else {
      cta = '<button type="button" class="btn btn--ouro btn--grande" data-acao="procurar">Procurar corrida</button>';
    }

    return '<section class="tela" aria-labelledby="t-correr">' +
      '<h1 class="titulo titulo--tela" id="t-correr" tabindex="-1" data-foco>Correr</h1>' + noticeHtml() +
      '<article class="caixa" aria-label="Montaria ativa">' +
        '<div class="cavalo-cabeca">' + portraitHtml(h) +
          '<div class="cavalo-info"><h2 class="cavalo-nome">' + esc(h.name) + '</h2>' +
          '<div class="linha-meta">' + rarityHtml(h.rarity) + elementHtml(h.element) + '</div>' +
          xpHtml(h.level, h.xp) +
          '<div class="linha-meta"><span>Poder <b>' + rating + '</b></span>' + leagueHtml(rating) + '</div>' +
        '</div></div>' +
        '<div class="tela-cabeca"><span class="rotulo">Equipamento</span>' + gearSummaryHtml(activeMount()) +
          '<div class="acoes"><button type="button" class="btn btn--pequeno" data-acao="equipar-tela" data-id="' + esc(state.activeId) + '">Equipar</button></div></div>' +
      '</article>' +
      '<section class="caixa" aria-labelledby="r-entrada">' +
        '<div class="tela-cabeca"><span class="rotulo" id="r-entrada">Entrada da corrida</span>' +
          '<div class="opcoes opcoes--3 opcoes--tier" role="group" aria-labelledby="r-entrada">' + tierOpts + '</div>' +
          '<p class="nota">Todos pagam a mesma entrada; a casa fica com 10% do pote. Com 4–5 corredores pagam 1º e 2º (70/30); com 6–7, 1º/2º/3º (50/30/20); com 8, 60/25/15. Quem leva prêmio nunca sai no prejuízo.</p></div>' +
        cta +
      '</section>' +
      '</section>';
  }

  // ===========================================================================
  // Aba Expedição (provisória): a vitrine dos cavalos selvagens
  // ===========================================================================
  function renderExpedicao() {
    var wild = WILD_SHOWCASE.map(horseById).filter(Boolean).map(function (w) {
      return '<div class="selvagem selvagem--' + esc(w.rarity) + '">' + portraitHtml(w) +
        '<b>' + esc(w.name) + '</b>' +
        '<span class="linha-meta">' + rarityHtml(w.rarity) + '<span class="nivel">Nv ' + w.level + '</span></span>' +
        elementHtml(w.element) +
        '<span class="nota">' + esc(w.habitat || '') + '</span></div>';
    }).join('');
    return '<section class="tela" aria-labelledby="t-expedicao">' +
      '<h1 class="titulo titulo--tela" id="t-expedicao" tabindex="-1" data-foco>Expedição</h1>' +
      '<p class="nota">Mundos com os biomas dos cavalos selvagens, batalhas por turnos e recompensas em Ouro, XP e moeda de pacotes. Em breve.</p>' +
      '<section class="caixa" aria-labelledby="t-selvagens"><h2 class="titulo" id="t-selvagens">Cavalos selvagens</h2>' +
        '<p class="nota">Exemplos de achados em expedições. A captura ainda não está neste protótipo.</p>' +
        '<div class="selvagens">' + wild + '</div>' +
      '</section>' +
      '</section>';
  }

  // "Recomeçar com outro inicial" com confirmação (vai para o Perfil)
  function resetHtml() {
    return ui.confirmReset
      ? '<div class="confirma" role="group" aria-label="Confirmar recomeço"><span>Apagar o progresso e escolher outro inicial?</span>' +
        '<button type="button" class="btn btn--pequeno btn--perigo" data-acao="reset-sim">Sim, recomeçar</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="reset-nao">Cancelar</button></div>'
      : '<button type="button" class="btn btn--texto" data-acao="reset">Recomeçar com outro inicial</button>';
  }

  // ===========================================================================
  // Haras: cruzar (reprodutor de aluguel ou duas suas) e Troca (dois seus viram um potro)
  // ===========================================================================
  var BRD = window.Breed;

  function defaultMine(mode) {
    var a = activeMount();
    if (mode === 'troca') return a ? a.uid : null;
    if (a && a.breedLeft >= 1) return a.uid;
    for (var i = 0; i < state.mounts.length; i++) if (state.mounts[i].breedLeft >= 1) return state.mounts[i].uid;
    return null;
  }
  function newHaras() {
    return { mine: defaultMine('cruzar'), tab: 'aluguel', partner: null, mode: 'cruzar', result: null, confirmTroca: false };
  }
  function rentalById(id) { return GD.WILD_HORSES.filter(function (h) { return h.id === id; })[0] || null; }
  function rentalList(mine) {
    return GD.WILD_HORSES.filter(function (h) { return h.sex !== mine.sex && h.rarity !== 'mitico' && BRD.rentalPrice(h) != null; });
  }
  function mineList(mode) {
    return state.mounts.filter(function (o) { return mode === 'troca' || o.breedLeft >= 1; });
  }
  function ownPartnerList(mine, mode) {
    return state.mounts.filter(function (o) { return o.uid !== mine.uid && o.sex !== mine.sex && (mode === 'troca' || o.breedLeft >= 1); });
  }
  // corrige ui.haras depois de qualquer mudança (montaria liberada, cruzas gastas, troca de modo)
  function harasNormalize() {
    var H = ui.haras || (ui.haras = newHaras());
    var mine = H.mine ? mountByUid(H.mine) : null;
    if (!mine || (H.mode === 'cruzar' && mine.breedLeft < 1)) H.mine = defaultMine(H.mode);
    if (H.mode === 'troca') H.tab = 'minhas';
    if (H.result && !mountByUid(H.result)) H.result = null;
    var P = harasPartner(H.mine ? mountByUid(H.mine) : null);
    if (!P) { H.partner = null; H.confirmTroca = false; }
    return H;
  }
  function harasPartner(mine) {
    var H = ui.haras, p = H.partner;
    if (!p || !mine) return null;
    if (p.kind === 'rent') {
      if (H.mode === 'troca') return null;
      var t = rentalById(p.id);
      return t && t.sex !== mine.sex && t.rarity !== 'mitico' && BRD.rentalPrice(t) != null ? t : null;
    }
    var o = mountByUid(p.id);
    return o && o.uid !== mine.uid && o.sex !== mine.sex && (H.mode === 'troca' || o.breedLeft >= 1) ? o : null;
  }
  // { mine, partner, kind, f, m, price }: f é sempre a fêmea e m o macho
  function harasPair() {
    var H = harasNormalize();
    var mine = H.mine ? mountByUid(H.mine) : null;
    var partner = harasPartner(mine);
    var out = { mine: mine, partner: partner, kind: null, f: null, m: null, price: null };
    if (!mine || !partner) return out;
    out.kind = H.partner.kind;
    out.f = mine.sex === 'f' ? mine : partner;
    out.m = mine.sex === 'f' ? partner : mine;
    out.price = H.mode === 'troca' ? BR.exchange : (out.kind === 'rent' ? BRD.rentalPrice(partner) : BR.ownRegistration);
    return out;
  }
  function harasProblems(P) {
    var mode = ui.haras.mode, out = [];
    if (state.pending) out.push('Termine o páreo aberto antes de cruzar');
    if (!P.mine) out.push('Nenhuma montaria sua pode cruzar agora');
    else if (!P.partner) out.push('Escolha um parceiro');
    if (mode === 'cruzar' && state.mounts.length >= state.stableSlots) out.push('Estábulo cheio: libere uma montaria ou expanda');
    if (P.price != null && state.gold < P.price) out.push('Ouro insuficiente');
    if (P.partner && mode === 'cruzar' && (P.mine.breedLeft < 1 || (P.kind === 'own' && P.partner.breedLeft < 1))) out.push('Uma das montarias não pode mais cruzar');
    if (P.partner && mode === 'troca' && P.kind !== 'own') out.push('A Troca é só entre duas montarias suas');
    return out;
  }

  // percentuais inteiros somando 100 (maiores restos: arredonda para baixo e distribui os pontos
  // que faltam para os maiores restos; empate fica com a ordem da lista). values já em %.
  function pctRound(values) {
    var out = [], rest = [], sum = 0;
    values.forEach(function (raw, k) {
      var fl = Math.floor(raw + 1e-9);
      out.push(fl); sum += fl; rest.push({ k: k, frac: raw - fl });
    });
    rest.sort(function (a, b) { return (b.frac - a.frac) || (a.k - b.k); });
    for (var j = 0; sum < 100 && j < rest.length; j++) { out[rest[j].k]++; sum++; }
    return out;
  }

  function harasCardHtml(h, acao, kind, id, on, extra) {
    return '<button type="button" class="btn opcao haras-card' + (on ? ' sel--on' : '') + '" data-acao="' + acao + '"' +
        (kind ? ' data-kind="' + kind + '"' : '') + ' data-id="' + esc(id) + '" aria-pressed="' + on + '">' +
      portraitHtml(h) +
      '<b class="haras-nome">' + esc(h.name) + '</b>' +
      '<span class="linha-meta">' + rarityHtml(h.rarity) + estrelasHtml(h.grau) + '</span>' +
      '<span class="linha-meta">' + elementHtml(h.element) + '</span>' +
      '<span class="linha-meta"><span>' + (h.sex === 'f' ? '♀' : '♂') + ' Nv ' + esc(h.level) + '</span>' + extra + '</span>' +
    '</button>';
  }

  function calcHtml(P) {
    var o = BRD.odds(P.f, P.m);
    var bars = BRD.RARITY_IDS.map(function (id) {
      var p = o.rarity[id] || 0, pct = Math.round(p * 100);
      if (p <= 0 && id !== 'mitico') return '';
      var label = GD.RARITIES[id].name + ' ' + (p > 0 && pct === 0 ? '<1' : pct) + '%' + (p <= 0 ? ' (só por despertar)' : '');
      return '<div class="calc-linha"><span>' + esc(label) + '</span>' +
        '<span class="calc-barra calc-barra--' + esc(id) + '"><i style="width:' + (p * 100).toFixed(1) + '%"></i></span></div>';
    }).join('');
    var gp = pctRound([o.grau[1] * 100, o.grau[2] * 100, o.grau[3] * 100]);
    var grau = 'Se mantiver a raridade: ★ ' + gp[0] + '% · ★★ ' + gp[1] + '% · ★★★ ' + gp[2] +
      '%; se subir, nasce ★; se descer, ★★★';
    var elName = function (e) { return (GD.ELEMENTS[e] || GD.ELEMENTS.neutro).name; };
    var els = P.f.element === P.m.element ? [P.f.element] : [P.f.element, P.m.element];
    var elTxt = 'Elemento: ' + (els.length === 1 ? elName(els[0]) : elName(els[0]) + ' ou ' + elName(els[1]) + ' (50/50)');
    var cands = [];
    els.forEach(function (e) {
      BRD.skillCandidates(P.f, P.m, e).forEach(function (id) { if (cands.indexOf(id) < 0) cands.push(id); });
    });
    var skTxt = 'Pode herdar: ' + (cands.length
      ? cands.map(function (id) { return GD.SKILLS[id] ? GD.SKILLS[id].name : id; }).join(', ')
      : 'nenhuma skill dos pais');
    var nc = (BRD.isCorcel(P.f) ? 1 : 0) + (BRD.isCorcel(P.m) ? 1 : 0);
    // garantia real = min(g, candidatas), e o corte nas vagas da raridade do potro ainda vale
    var nMax = Math.min(2, cands.length), nTxt;
    if (nc === 1 && nMax === 2) nTxt = '1 skill (50% de chance de 2)';
    else { var nG = Math.min(nc, cands.length); nTxt = nG + (nG === 1 ? ' skill' : ' skills'); }
    var corcel = !nc ? '' : '<p class="corcel">' + esc(cands.length
      ? '⚑ Corcel: herança garantida de até ' + nTxt + ' dos pais (limitado às vagas da raridade do potro)'
      : '⚑ Corcel, mas nenhuma skill herdável') + '</p>';
    var custoNome = ui.haras.mode === 'troca' ? 'Troca' : (P.kind === 'rent' ? 'Aluguel' : 'Registro');
    return '<section class="caixa calc" aria-labelledby="t-calc"><h2 class="titulo" id="t-calc">Calculadora</h2>' +
      '<p class="nota">' + esc(P.f.name + ' ♀ × ' + P.m.name + ' ♂') + '</p>' +
      '<div class="calc-barras">' + bars + '</div>' +
      '<p>' + esc(grau) + '</p>' +
      '<p>' + esc(elTxt) + '</p>' +
      '<p>' + esc(skTxt) + '</p>' + corcel +
      '<p>' + esc('Nível efetivo: ' + Math.round(o.L * 100) + '% do máximo') + '</p>' +
      '<p class="calc-custo">' + esc(custoNome) + ': ' + ouroHtml(P.price) + '</p>' +
    '</section>';
  }

  function harasResultHtml(foal) {
    var isActive = foal.uid === state.activeId;
    return '<section class="caixa" aria-labelledby="t-nasceu"><h2 class="titulo" id="t-nasceu">' + esc('Nasceu ' + foal.name + '!') + '</h2>' +
      mountCardHtml(foal, isActive, { semAcoes: true }) +
      '<div class="acoes">' +
        '<button type="button" class="btn btn--ouro" data-acao="haras-ativar"' + (isActive || state.pending ? ' disabled' : '') + '>Tornar ativa</button>' +
        '<button type="button" class="btn" data-acao="haras-denovo">Cruzar de novo</button>' +
      '</div></section>';
  }

  function renderHaras() {
    var H = harasNormalize();
    var head = '<h1 class="titulo titulo--tela" id="t-haras" tabindex="-1" data-foco>Haras</h1>';
    var foal = H.result ? mountByUid(H.result) : null;
    if (foal) return '<section class="tela" aria-labelledby="t-haras">' + head + harasResultHtml(foal) + '</section>';

    var troca = H.mode === 'troca';
    var P = harasPair();
    var probs = harasProblems(P);

    var modo = '<div class="abas" role="group" aria-label="Modo">' +
      '<button type="button" class="btn opcao opcao--centro" data-acao="haras-mode" data-id="cruzar" aria-pressed="' + !troca + '">Cruzar</button>' +
      '<button type="button" class="btn opcao opcao--centro" data-acao="haras-mode" data-id="troca" aria-pressed="' + troca + '">Troca</button></div>' +
      '<p class="nota">' + (troca
        ? esc('Troca: duas montarias suas, de sexos opostos e com qualquer número de cruzas, viram um potro (' + BR.exchange + ' de Ouro). Os dois pais deixam o estábulo.')
        : esc('Cruzar com um reprodutor de aluguel ou com outra montaria sua (registro de ' + BR.ownRegistration + ' de Ouro). O potro ocupa uma vaga.')) + '</p>';

    var mines = mineList(H.mode).map(function (o) {
      return harasCardHtml(o, 'haras-mine', null, o.uid, o.uid === H.mine, '<span>cruza ' + esc(o.breedLeft) + 'x</span>');
    }).join('');
    var mineBox = '<section class="caixa" aria-labelledby="t-sua"><h2 class="titulo" id="t-sua">Sua montaria</h2>' +
      (mines ? '<div class="haras-sel">' + mines + '</div>' : '<p class="nota">Nenhuma montaria sua pode cruzar agora.</p>') + '</section>';

    var partnerBox = '';
    if (P.mine) {
      var tabs = troca ? '' : '<div class="abas" role="group" aria-label="Parceiros">' +
        '<button type="button" class="btn opcao opcao--centro" data-acao="haras-tab" data-id="aluguel" aria-pressed="' + (H.tab === 'aluguel') + '">Aluguel</button>' +
        '<button type="button" class="btn opcao opcao--centro" data-acao="haras-tab" data-id="minhas" aria-pressed="' + (H.tab === 'minhas') + '">Minhas</button></div>';
      var sel = H.partner;
      var list = H.tab === 'aluguel'
        ? rentalList(P.mine).map(function (t) {
          return harasCardHtml(t, 'haras-partner', 'rent', t.id, !!(sel && sel.kind === 'rent' && sel.id === t.id), ouroHtml(BRD.rentalPrice(t)));
        }).join('')
        : ownPartnerList(P.mine, H.mode).map(function (o) {
          return harasCardHtml(o, 'haras-partner', 'own', o.uid, !!(sel && sel.kind === 'own' && sel.id === o.uid), '<span>cruza ' + esc(o.breedLeft) + 'x</span>');
        }).join('');
      partnerBox = '<section class="caixa" aria-labelledby="t-parceiro"><h2 class="titulo" id="t-parceiro">Parceiro ' +
          '<span class="nota">' + (P.mine.sex === 'f' ? 'machos' : 'fêmeas') + '</span></h2>' + tabs +
        (list ? '<div class="haras-sel">' + list + '</div>'
          : '<p class="nota">' + (H.tab === 'aluguel' ? 'Nenhum reprodutor de aluguel disponível.' : 'Nenhuma montaria sua de sexo oposto ' + (troca ? 'no estábulo.' : 'com cruzas restantes.')) + '</p>') +
      '</section>';
    }

    var calc = P.f && P.m ? calcHtml(P) : '';
    var avisos = probs.map(function (t) { return '<p class="aviso">' + esc(t) + '</p>'; }).join('');
    var acao;
    if (troca && H.confirmTroca && !probs.length) {
      acao = '<div class="confirma" role="group" aria-label="Confirmar troca"><span>' +
          esc('Os dois pais deixam de existir. Trocar ' + P.mine.name + ' e ' + P.partner.name + ' por um potro?') + '</span>' +
        '<button type="button" class="btn btn--pequeno btn--perigo" data-acao="troca-sim">Sim, trocar</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="troca-nao">Cancelar</button></div>';
    } else if (troca) {
      acao = '<button type="button" class="btn btn--ouro btn--grande" data-acao="troca"' + (probs.length ? ' disabled' : '') + '>Trocar por um potro</button>';
    } else {
      acao = '<button type="button" class="btn btn--ouro btn--grande" data-acao="cruzar"' + (probs.length ? ' disabled' : '') + '>Cruzar</button>';
    }
    return '<section class="tela" aria-labelledby="t-haras">' + head +
      '<section class="caixa" aria-label="Modo">' + modo + '</section>' +
      mineBox + partnerBox + calc + avisos +
      '<div class="barra-acao">' + acao + '</div>' +
    '</section>';
  }

  // gera o potro já com o Ouro debitado; nunca chamada sem validar antes
  function harasFoal(P) {
    var foal = BRD.foal({ f: P.f, m: P.m, seedBase: state.seedBase, breedCounter: state.breedCounter, nextUid: state.nextUid });
    foal.equip = GR.emptyEquip();   // entra no estábulo sem peças (Breed.foal não sabe de equipamento)
    state.nextUid += 1;
    state.breedCounter += 1;
    return foal;
  }

  // ===========================================================================
  // Equipamento (por montaria): equipar/tirar, melhorar com Pedras Negras, vender e trava parcial
  // ===========================================================================
  // cópia do equip da montaria com um slot trocado (uid ou null)
  function equipWith(mount, slot, uid) {
    var e = {}, cur = mount.equip || {};
    GR.SLOTS.forEach(function (s) { e[s] = cur[s] || null; });
    e[slot] = uid;
    return e;
  }
  function ratingWith(mount, equip) {
    return RS.powerRating(mount, GR.resolve({ equip: equip }, itemsByUid()));
  }
  // trava parcial (spec §9): com páreo aberto, a ativa só aceita um equip que não passe do rating da sala
  function canEquip(mount, equipNovo) {
    var P = state.pending;
    if (!P || mount.uid !== state.activeId) return { ok: true, limit: null };
    return { ok: ratingWith(mount, equipNovo) <= P.pr, limit: P.pr };
  }
  // peça equipada na ativa com páreo aberto não pode ser melhorada
  function enhanceLocked(uid) {
    var where = isEquipped(uid);
    return !!(state.pending && where && where.mount.uid === state.activeId);
  }
  function rarityRank(id) {
    var def = GR.piece(id);
    return def && GD.RARITIES[def.rarity] ? GD.RARITIES[def.rarity].order : -1;
  }
  // peças do slot no inventário (não equipadas em nenhuma montaria), da raridade maior para a menor e por +N
  function freePieces(slot) {
    return state.items.filter(function (it) {
      var def = GR.piece(it.id);
      return def && def.slot === slot && !isEquipped(it.uid);
    }).sort(function (a, b) { return (rarityRank(b.id) - rarityRank(a.id)) || (b.plus - a.plus); });
  }
  function pieceModsText(item) {
    var def = GR.piece(item.id), info = GD.GEAR_SLOT_INFO[def.slot];
    var t = '+' + (def.main + item.plus) + ' ' + GD.STATS[info.main].short;
    if (def.sub) t += ', +' + def.sub + ' ' + GD.STATS[info.sub].short;
    return t;
  }
  function pieceLabel(item) {
    var def = GR.piece(item.id);
    return def.name + ' · ' + GD.RARITIES[def.rarity].name + ' · +' + item.plus + ' · ' + pieceModsText(item);
  }
  function setLineHtml(gear) {
    var st = gear.set, sb = GE.setBonus;
    if (!st || !st.id || !st.count || !hasOwn(GD.GEAR_SETS, st.id)) return '<p class="set-linha nota">sem conjunto</p>';
    var bon = [];
    if (st.count >= sb.pieces[0]) bon.push('+' + sb.sorte + ' Sorte e +' + Math.round(sb.skillChance * 100) + '% de skill');
    if (st.count >= sb.pieces[1]) bon.push('bônus do clima reforçado (×1,07)');
    if (st.count >= sb.pieces[2]) bon.push('sem penalidade de clima');
    return '<p class="set-linha"><span class="set-badge">' + esc(GD.GEAR_SETS[st.id].name + ' ×' + st.count) + '</span> ' +
      '<span class="nota">' + esc(bon.length ? bon.join(' · ') : 'bônus a partir de ' + sb.pieces[0] + ' peças') + '</span></p>';
  }
  function pedrasTxt(n) { return n + (n === 1 ? ' pedra' : ' pedras'); }

  // uma peça da lista aberta: equipada (Tirar/Melhorar) ou do inventário (Equipar/Melhorar/Vender)
  function equipRowHtml(m, item, equipped, ratingNow) {
    var def = GR.piece(item.id);
    var novo = equipWith(m, def.slot, equipped ? null : item.uid);
    var depois = ratingWith(m, novo);
    var lock = canEquip(m, novo);
    var odds = GR.enhanceOdds(item.plus);
    var travada = enhanceLocked(item.uid);
    var uid = esc(item.uid);
    var d = depois - ratingNow;
    var poder = '<span class="peca-poder">Poder ' + ratingNow + ' → <b class="' + (d > 0 ? 'mais' : d < 0 ? 'menos-t' : '') + '">' + depois + '</b></span>';
    var acoes;
    if (ui.montaria.equip.confirm === item.uid && odds && !travada) {
      var falha = odds.dropTo < item.plus ? 'cai para +' + odds.dropTo : 'continua +' + item.plus;
      var semPedras = state.pedras < odds.cost;
      acoes = '<div class="confirma" role="group" aria-label="Confirmar melhoria"><span>' +
          esc('Melhorar ' + def.name + ' +' + item.plus + ' → +' + (item.plus + 1) + ': ' + Math.round(odds.chance * 100) + '% · ' +
            pedrasTxt(odds.cost) + ' · se falhar ' + falha) + '</span>' +
        '<button type="button" class="btn btn--pequeno btn--ouro" data-acao="melhorar-sim" data-id="' + uid + '"' + (semPedras ? ' disabled' : '') + '>' +
          (semPedras ? 'Sem pedras' : 'Tentar') + '</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="melhorar-nao" data-id="' + uid + '">Cancelar</button></div>';
    } else {
      var limite = lock.ok ? '' : ' disabled title="' + esc('Páreo aberto: passaria do rating ' + lock.limit) + '"';
      var mel = '<button type="button" class="btn btn--pequeno" data-acao="melhorar" data-id="' + uid + '"' +
        (!odds ? ' disabled title="Já está no máximo"' : travada ? ' disabled title="Páreo aberto"' : '') + '>Melhorar</button>';
      acoes = '<div class="acoes-peca">' + (equipped
        ? '<button type="button" class="btn btn--pequeno" data-acao="tirar" data-id="' + esc(def.slot) + '"' + limite + '>Tirar</button>' + mel
        : '<button type="button" class="btn btn--pequeno btn--ouro" data-acao="equipar" data-id="' + uid + '"' + limite + '>Equipar</button>' + mel +
          '<button type="button" class="btn btn--pequeno" data-acao="vender" data-id="' + uid + '">Vender (' + fmt(GR.sellPrice(item.id)) + ')</button>') +
        '</div>';
    }
    return '<div class="peca' + (equipped ? ' peca--equipada' : '') + '">' +
      '<div class="peca-info"><b>' + esc(def.name + ' +' + item.plus) + '</b>' +
        '<span class="linha-meta">' + rarityHtml(def.rarity) + (equipped ? '<span class="badge-ativa">Equipada</span>' : '') +
          '<span>' + esc(pieceModsText(item)) + '</span></span>' + poder + '</div>' +
      acoes + '</div>';
  }

  // conteúdo da sub-aba Equipamento da Montaria (estado em ui.montaria.equip)
  function montariaEquipHtml(m) {
    var Q = ui.montaria.equip, P = state.pending;
    var gear = gearOf(m);
    var rating = RS.powerRating(clone(m), gear);
    var avisos = '';
    if (Q.msg) avisos += '<p class="aviso" role="status">' + esc(Q.msg) + '</p>';
    if (Q.undo) {
      avisos += '<div class="acoes"><button type="button" class="btn btn--pequeno" data-acao="vender-desfazer">' +
        esc('Desfazer venda de ' + (GR.piece(Q.undo.item.id) || { name: '?' }).name + ' (−' + fmt(Q.undo.price) + ' de Ouro)') + '</button></div>';
    }
    if (P && m.uid === state.activeId) avisos += '<p class="aviso">' + esc('Páreo aberto: o rating não pode passar de ' + P.pr) + '</p>';

    var bySlot = {};
    gear.pieces.forEach(function (p) { bySlot[p.slot] = p; });
    var linhas = GR.SLOTS.map(function (slot) {
      var info = GD.GEAR_SLOT_INFO[slot], aberto = Q.slot === slot;
      var cur = bySlot[slot] ? itemByUid(bySlot[slot].uid) : null;
      var lista = '';
      if (aberto) {
        var rows = (cur ? [equipRowHtml(m, cur, true, rating)] : []).concat(freePieces(slot).map(function (it) {
          return equipRowHtml(m, it, false, rating);
        }));
        lista = '<div class="pecas" id="pecas-' + esc(slot) + '">' + (rows.length ? rows.join('')
          : '<p class="nota">' + esc('Nenhuma peça de ' + info.name + ' no inventário.') + '</p>') + '</div>';
      }
      return '<div class="slot-linha' + (aberto ? ' slot-linha--aberta' : '') + '">' +
        '<button type="button" class="btn slot-botao" data-acao="equip-slot" data-id="' + esc(slot) + '" aria-expanded="' + aberto + '">' +
          '<span class="slot-nome">' + esc(info.name) + '</span>' +
          '<span class="slot-peca">' + esc(cur ? pieceLabel(cur) : 'vazio') + '</span></button>' + lista + '</div>';
    }).join('');

    return avisos +
      '<section class="caixa" aria-labelledby="t-pecas"><h2 class="titulo" id="t-pecas">Peças</h2>' +
        setLineHtml(gear) +
        '<p class="nota">Toque num slot para ver as peças do inventário. Melhorar gasta Pedras Negras; vender devolve 25% do preço.</p>' +
        '<div class="slot-linhas">' + linhas + '</div></section>';
  }

  // ===========================================================================
  // Tela da Montaria (sub-tela): cabeça com ações e sub-abas Status / Skills / Equipamento
  // ===========================================================================
  var MONTARIA_ABAS = [{ id: 'status', rotulo: 'Status' }, { id: 'skills', rotulo: 'Skills' }, { id: 'equip', rotulo: 'Equipamento' }];

  // abre a Montaria numa sub-aba; o estado do equipamento (confirmação, Desfazer) começa zerado
  function goMontaria(uid, aba) {
    if (!state || !mountByUid(uid)) return;
    ui.montaria = { uid: uid, aba: aba, equip: { slot: null, confirm: null, undo: null, msg: null } };
    go('montaria');
  }

  // renderer de uma aba pelo id (sem passar por render(), para não entrar em recursão)
  function renderTab(tab) {
    switch (tab) {
      case 'correr': return renderCorrer();
      case 'expedicao': return renderExpedicao();
      case 'haras': return renderHaras();
      case 'loja': return renderLoja();
      default: return renderEstabulo();
    }
  }

  function renderMontaria() {
    var m = ui.montaria ? mountByUid(ui.montaria.uid) : null;
    if (!m) { ui.montaria = null; ui.screen = ui.tab; syncHistory(ui.tab); return renderTab(ui.tab); } // montaria sumiu (liberada, outra aba): volta à aba
    var M = ui.montaria, P = state.pending;
    var isActive = m.uid === state.activeId;
    var uid = esc(m.uid);
    var h = clone(m);
    var gear = gearOf(m);
    var stats = RS.computeStats(h, gear), baseStats = RS.computeStats(h, null);
    var rating = RS.powerRating(h, gear);
    var skillPct = Math.round(RS.skillChance(h, stats, gear.special.skillChanceBonus) * 100);
    var corcel = window.Breed && window.Breed.isCorcel(m)
      ? '<span class="corcel" title="Corcel: herança garantida">⚑ Corcel</span>' : '';
    var canRelease = !isActive && state.mounts.length > 1 && !P;

    var acoes = ui.confirmLiberar === m.uid && canRelease
      ? '<div class="confirma" role="group" aria-label="Confirmar liberação"><span>Liberar ' + esc(m.name) + '? Ela deixa o estábulo para sempre, sem Ouro de volta.</span>' +
        '<button type="button" class="btn btn--pequeno btn--perigo" data-acao="liberar-sim" data-id="' + uid + '">Sim, liberar</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="liberar-nao" data-id="' + uid + '">Cancelar</button></div>'
      : '<div class="montaria-acoes">' +
        '<button type="button" class="btn btn--pequeno" data-acao="ativar" data-id="' + uid + '"' + (isActive || P ? ' disabled' : '') + '>Tornar ativa</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="renomear" data-id="' + uid + '">Renomear</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="liberar" data-id="' + uid + '"' + (canRelease ? '' : ' disabled') + '>Liberar</button>' +
        '</div>';

    var cabeca = '<article class="caixa montaria-cabeca" aria-label="Montaria">' +
      '<div class="cavalo-cabeca">' + portraitHtml(m) +
        '<div class="cavalo-info">' +
          '<h1 class="titulo titulo--tela" id="t-montaria" tabindex="-1" data-foco>' + esc(m.name) + ' <small>#' + esc(uidNum(m.uid)) + '</small></h1>' +
          '<div class="linha-meta">' + rarityHtml(m.rarity) + estrelasHtml(m.grau) + elementHtml(m.element) +
            '<span>' + (m.sex === 'f' ? '♀ Fêmea' : '♂ Macho') + '</span>' +
            '<span>cruza ' + esc(m.breedLeft) + 'x</span>' + corcel +
            (isActive ? '<span class="badge-ativa">Ativa</span>' : '') +
          '</div>' +
          xpHtml(m.level, m.xp) +
          '<div class="linha-meta"><span>Poder <b>' + rating + '</b></span>' + leagueHtml(rating) +
            '<span>Skills: <b>' + skillPct + '%</b> de ativar</span></div>' +
          gearSummaryHtml(m) +
        '</div></div>' + acoes + '</article>';

    var subabas = '<div class="subabas" role="group" aria-label="Seções da montaria">' + MONTARIA_ABAS.map(function (a) {
      return '<button type="button" class="btn opcao opcao--centro" data-acao="montaria-aba" data-id="' + esc(a.id) + '" aria-pressed="' + (M.aba === a.id) + '">' + esc(a.rotulo) + '</button>';
    }).join('') + '</div>';

    var corpo;
    if (M.aba === 'skills') {
      var vagas = (GD.RARITIES[m.rarity] || GD.RARITIES.comum).skillSlots - m.skills.length;
      corpo = '<section class="caixa" aria-label="Skills">' + (m.skills.length ? m.skills.map(skillHtml).join('') : '<p class="nota">Nenhuma skill ainda.</p>') +
        '<p class="nota">' + (vagas > 0
          ? vagas + (vagas === 1 ? ' vaga livre' : ' vagas livres') + ' · ' + Math.round(RS.TUNING.learnChance * 100) + '% de chance de aprender uma skill nova a cada nível'
          : 'Sem vagas livres') + '</p></section>';
    } else if (M.aba === 'equip') {
      corpo = montariaEquipHtml(m);
    } else {
      corpo = '<section class="caixa" aria-label="Status">' + statsHtml(stats, baseStats) +
        '<p class="nota">Valores com o equipamento; a diferença para o valor puro aparece ao lado.</p></section>';
    }

    return '<section class="tela" aria-labelledby="t-montaria">' +
      '<button type="button" class="btn btn--pequeno" data-acao="montaria-voltar">Voltar</button>' +
      cabeca + subabas + corpo +
    '</section>';
  }

  // ===========================================================================
  // Loja: peças do catálogo (shop) por slot e Pedras Negras. Compra não equipa.
  // ===========================================================================
  var LOJA_TABS = GR.SLOTS.concat(['pedras']);

  function lojaStatsTxt(def) {
    var info = GD.GEAR_SLOT_INFO[def.slot];
    var t = '+' + def.main + ' ' + GD.STATS[info.main].short;
    if (def.sub) t += ' · +' + def.sub + ' ' + GD.STATS[info.sub].short;
    return t;
  }
  // diferença do principal para a peça que a montaria ativa usa no slot (com o +N dela)
  function lojaDiffTxt(def) {
    var gear = gearOf(activeMount()), cur = null;
    gear.pieces.forEach(function (p) { if (p.slot === def.slot) cur = p; });
    if (!cur) return 'slot vazio';
    var info = GD.GEAR_SLOT_INFO[def.slot];
    var d = def.main - (GD.GEAR[cur.id].main + cur.plus);
    if (!d) return 'igual à equipada';
    return (d > 0 ? '+' : '−') + Math.abs(d) + ' ' + GD.STATS[info.main].short + ' em relação à equipada';
  }
  function lojaBotaoHtml(acao, id, price) {
    var pode = state.gold >= price;
    return '<button type="button" class="btn btn--ouro btn--pequeno" data-acao="' + acao + '" data-id="' + esc(id) + '"' + (pode ? '' : ' disabled') + '>' +
      (pode ? 'Comprar' : 'Sem Ouro') + ' (' + fmt(price) + ')</button>';
  }
  function produtoHtml(def) {
    var chip = def.set && hasOwn(GD.GEAR_SETS, def.set) ? '<span class="chip">' + esc(GD.GEAR_SETS[def.set].name) + '</span>' : '';
    return '<article class="produto">' +
      '<h3 class="produto-nome">' + esc(def.name) + '</h3>' +
      '<div class="linha-meta">' + rarityHtml(def.rarity) + chip + '</div>' +
      '<p class="produto-stats">' + esc(lojaStatsTxt(def)) + '</p>' +
      '<p class="produto-diff">' + esc(lojaDiffTxt(def)) + '</p>' +
      '<div class="produto-preco">' + lojaBotaoHtml('comprar', def.id, def.price) + '</div>' +
    '</article>';
  }
  function pedraProdutoHtml(n) {
    return '<article class="produto">' +
      '<h3 class="produto-nome">Pedra Negra ×' + n + '</h3>' +
      '<p class="produto-diff">' + esc('Melhora peças na aba Equipamento da montaria. Você tem ' + pedrasTxt(state.pedras) + '.') + '</p>' +
      '<div class="produto-preco">' + lojaBotaoHtml('comprar-pedra', String(n), n * GE.stonePrice) + '</div>' +
    '</article>';
  }
  function renderLoja() {
    if (!ui.loja || LOJA_TABS.indexOf(ui.loja.tab) < 0) ui.loja = { tab: LOJA_TABS[0], msg: null };
    var Q = ui.loja;
    var head = '<h1 class="titulo titulo--tela" id="t-loja" tabindex="-1" data-foco>Loja</h1>';
    var msg = Q.msg ? '<p class="aviso" role="status">' + esc(Q.msg) + '</p>' : '';
    var abas = '<div class="abas abas--loja" role="group" aria-label="Seção da loja">' + LOJA_TABS.map(function (t) {
      var nome = t === 'pedras' ? 'Pedras' : GD.GEAR_SLOT_INFO[t].name;
      return '<button type="button" class="btn opcao opcao--centro" data-acao="loja-tab" data-id="' + esc(t) + '" aria-pressed="' + (Q.tab === t) + '">' + esc(nome) + '</button>';
    }).join('') + '</div>';
    var produtos;
    if (Q.tab === 'pedras') {
      produtos = pedraProdutoHtml(1) + pedraProdutoHtml(GE.stoneBundle);
    } else {
      produtos = Object.keys(GD.GEAR).filter(function (k) {
        return GD.GEAR[k].shop && GD.GEAR[k].slot === Q.tab;
      }).map(function (k) { return produtoHtml(GD.GEAR[k]); }).join('');
    }
    var nota = Q.tab === 'pedras' ? 'Pedras Negras melhoram peças (+1 a +10) na aba Equipamento da montaria.'
      : 'A diferença compara com a peça que ' + activeMount().name + ' (ativa) usa neste slot. Comprar não equipa.';
    return '<section class="tela" aria-labelledby="t-loja">' + head + msg +
      '<section class="caixa">' + abas + '<p class="nota">' + esc(nota) + '</p>' +
        '<div class="loja-grade">' + produtos + '</div></section>' +
    '</section>';
  }

  // ===========================================================================
  // Sala de largada: campo sorteado uma vez (state.pending) e simulado só no "Largar!"
  // ===========================================================================
  function bestLevelFor(template, gear, target, lo, hi) {
    var h = clone(template); // um clone por template, mudando só o level (clonar a cada nível custava ~10 ms por sala)
    var best = lo || 1, bestD = Infinity;
    for (var L = (lo || 1); L <= (hi || E.maxLevel || 50); L++) {
      h.level = L;
      var d = Math.abs(RS.powerRating(h, gear) - target);
      if (d < bestD - 0.5) { bestD = d; best = L; }
    }
    return { level: best, diff: bestD };
  }
  // índice da liga (em GD.LEAGUES) de um rating; RS.leagueFor devolve um objeto novo, então busca pelo id
  function leagueIndex(rating) {
    var id = RS.leagueFor(rating).id;
    for (var i = 0; i < GD.LEAGUES.length; i++) if (GD.LEAGUES[i].id === id) return i;
    return 0;
  }
  // Faixa de nível plausível para um cavalo selvagem: perto do nível em que ele é achado.
  function levelBand(tpl) {
    var L0 = tpl.level || 1;
    return [Math.max(1, L0 - 10), Math.min(E.maxLevel || 50, L0 + 20)];
  }

  // Abre a sala pendente ou sorteia uma nova (contador +1). Voltar/recarregar não sorteia de novo.
  function openLobby(training) {
    var P = state.pending;
    if (P && !P.training && state.gold < P.fee) P = null;          // não dá mais para pagar (ex.: save editado)
    if (P && P.training && !training && state.gold >= MIN_ENTRY) P = null; // treino pendente vira corrida valendo
    if (!P) {
      var fee = training ? 0 : effectiveTier();
      if (fee == null) { training = true; fee = 0; } // sem Ouro para nenhuma entrada (ex.: save editado): vira treino
      state.raceCounter += 1;
      P = {
        // pareamento pelo cavalo COM o equipamento: ele é persistente (não é escolha de sala), então entra
        // no rating que atrai os rivais; com o páreo aberto, trocas não podem passar deste rating
        counter: state.raceCounter, training: !!training, fee: fee,
        pr: RS.powerRating(playerHorse(), playerGear())
      };
      state.pending = P;
      persist();
    }
    return buildLobby(P);
  }

  function buildLobby(P) {
    var counter = P.counter;
    var seed = RS.hash2(state.seedBase, counter);
    var rng = RS.mulberry32(RS.hash2(seed, 0xA11CE)); // aleatoriedade só de UI/matchmaking, derivada da seed

    // pista
    var cond = RS.randomConditions(seed), trackName = pick(TRACK_NAMES, rng), trackDesc = '';
    withRanges(cond);

    var n = (E.minRacers || 4) + Math.floor(rng() * ((E.maxRacers || 8) - (E.minRacers || 4) + 1));
    var pr = P.pr;
    var player = {
      isPlayer: true, name: PLAYER_NAME, horse: playerHorse(), gear: playerGear(),
      silks: PLAYER_SILKS, silkIdx: -1
    };

    var names = shuffle(GD.BOT_NAMES.slice(), rng);
    var owned = {};   // nenhum bot corre com o modelo de uma montaria que o jogador tem
    state.mounts.forEach(function (m) { if (m.templateId) owned[m.templateId] = true; });
    var pool = GD.WILD_HORSES.concat(GD.STARTERS).filter(function (tpl) { return !owned[tpl.id]; });
    var used = {};
    var silkOrder = shuffle(BOT_SILKS.map(function (c, i) { return i; }), rng);
    var bots = [];
    for (var b = 0; b < n - 1; b++) {
      // alvo em torno do rating do jogador (−8,5%..+11,5%); o rating já pesa cada habilidade pela chance
      // do gatilho. O leve viés para cima mantém a margem da casa (~10%) também contra bots.
      var target = pr * (0.915 + 0.2 * rng());
      // equipamento do bot pela liga do alvo e pelo elemento do template (Neutro: conjunto pelo pick)
      var gpick = rng();
      var leagueIdx = leagueIndex(target);
      var inBand = pool.map(function (tpl) {
        var bd = levelBand(tpl), bg = GR.botGear(leagueIdx, tpl.element, gpick);
        return { tpl: tpl, gear: bg, fit: bestLevelFor(tpl, bg, target, bd[0], bd[1]) };
      })
        .filter(function (c) { return c.fit.diff <= target * 0.06; });
      var fresh = inBand.filter(function (c) { return !used[c.tpl.id]; });
      var cands = fresh.length ? fresh : inBand;
      if (!cands.length) {
        // ninguém plausível na faixa: o mais próximo do alvo em qualquer nível
        var all = pool.map(function (tpl) {
          var bg = GR.botGear(leagueIdx, tpl.element, gpick);
          return { tpl: tpl, gear: bg, fit: bestLevelFor(tpl, bg, target) };
        });
        all.sort(function (x, y) { return x.fit.diff - y.fit.diff; });
        cands = all.slice(0, 3);
      }
      var choice = pick(cands, rng);
      used[choice.tpl.id] = true;
      var horse = clone(choice.tpl);
      horse.level = choice.fit.level;
      horse.id = choice.tpl.id + '-b' + b;
      var silkIdx = SP.SILKS.indexOf(BOT_SILKS[silkOrder[b % silkOrder.length]]);
      bots.push({
        isPlayer: false, name: names[b % names.length], horse: horse, gear: choice.gear,
        silks: SP.SILKS[silkIdx], silkIdx: silkIdx,
        rating: RS.powerRating(horse, choice.gear)
      });
    }
    var racers = shuffle([player].concat(bots), rng);   // ordem = raia
    var playerIdx = racers.indexOf(player);

    return {
      counter: counter, seed: seed, training: !!P.training, fee: P.fee || 0, n: n,
      cond: cond, trackName: trackName, trackDesc: trackDesc,
      racers: racers, playerIdx: playerIdx, sim: null
    };
  }
  // trechos de subida/curva derivados dos blocos (só para desenhar: a simulação lê os blocos)
  function withRanges(cond) {
    cond.hills = RS.hillsFromBlocks(cond.blocks);
    cond.curves = RS.curvesFromBlocks(cond.blocks);
    return cond;
  }
  // o cavalo do jogador na sala reflete a montaria ativa e o equipamento atual
  function refreshPlayerEntry(L) {
    var r = L.racers[L.playerIdx];
    r.horse = playerHorse(); r.gear = playerGear();
  }

  // ===========================================================================
  // Tela 3 — Sala de largada
  // ===========================================================================
  // percentuais do traçado somando 100 (maiores restos: arredonda para baixo e distribui
  // os pontos que faltam para os maiores restos; empate fica com a ordem reta/curva/subida)
  function sharePct(cond) {
    var types = ['reta', 'curva', 'subida'];
    var pc = pctRound(types.map(function (t) { return RS.blockShare(cond.blocks, t) * 100; }));
    return { reta: pc[0], curva: pc[1], subida: pc[2] };
  }
  function conditionChips(cond) {
    var sh = sharePct(cond);
    return '<div class="chips">' +
      '<span class="chip"><span class="rotulo">Distância</span><b>' + esc(cond.distance + ' m') + '</b></span>' +
      '<span class="chip"><span class="rotulo">Piso</span><b>' + esc(GD.SURFACES[cond.surface].name) + '</b></span>' +
      '<span class="chip"><span class="rotulo">Clima inicial</span><b>' + esc(GD.WEATHERS[cond.weather].name) + '</b></span>' +
      '<span class="chip"><span class="rotulo">Traçado</span><b>' + esc(sh.reta + '% reta · ' + sh.curva + '% curva · ' + sh.subida + '% subida') + '</b></span></div>';
  }

  function strategyTips(L) {
    var tips = [];
    var sh = sharePct(L.cond);
    if (sh.curva >= 40) tips.push('Muitas curvas: Manobra segura a velocidade na curva e na saída dela.');
    if (sh.subida >= 30) tips.push('Muitas subidas: Força ajuda a não perder ritmo (a Armadura dá Força).');
    if (L.cond.distance >= 2000) tips.push('Pista longa: Estamina segura o ritmo até o fim.');
    var h = playerHorse();
    if (RS.weatherMult(h.element, L.cond.weather, false) < 1 && !playerGear().special.ignoreWeatherPenalty) {
      tips.push('Um conjunto completo (5 peças) anula a penalidade de clima.');
    }
    return tips;
  }

  function climaHints(L) {
    var h = playerHorse();
    var el = GD.ELEMENTS[h.element] || GD.ELEMENTS.neutro;
    var w = GD.WEATHERS[L.cond.weather];
    var m = RS.weatherMult(h.element, L.cond.weather, false);
    var pct = Math.round((m - 1) * 100);
    var eff = pct > 0 ? '+' + pct + '% para ' + el.name : pct < 0 ? '−' + Math.abs(pct) + '% para ' + el.name : 'neutro para ' + el.name;
    var sorte = RS.computeStats(h, playerGear()).sorte;
    var items = '<li' + (pct > 0 ? ' class="bom"' : pct < 0 ? ' class="ruim"' : '') + '>' + esc('Clima inicial ' + w.name + ': ' + eff) + '</li>' +
      '<li class="dica">' + esc('Dado da Sorte a 1/3 e 2/3 da pista: quem tira o maior dado puxa o clima para o seu elemento. Sua Sorte: ' + Math.min(100, sorte) + '% de rolar dois dados.') + '</li>';
    var tips = strategyTips(L).map(function (t) { return '<li class="dica">' + esc(t) + '</li>'; }).join('');
    return '<div class="tela-cabeca"><span class="rotulo">Clima e sorte</span><ul class="dicas">' + items + tips + '</ul></div>';
  }

  function racerRow(r, i) {
    var h = r.horse;
    var rating = r.isPlayer ? RS.powerRating(h, r.gear) : r.rating;
    return '<li class="' + (r.isPlayer ? 'voce' : '') + '">' + laneChip(r, i) +
      '<div class="corredor"><b>' + (r.isPlayer ? '<span class="tag-voce">VOCÊ</span>' : '') +
        '<span class="nome">' + esc(r.isPlayer ? h.name : r.name) + '</span></b>' +
        '<small>' + (r.isPlayer ? '' : '<span>' + esc(h.name) + '</span>') + elementHtml(h.element) + rarityHtml(h.rarity) +
        '<span>Nv ' + h.level + '</span>' +
        setBadgeHtml(r.gear) + '</small></div>' +
      '<div class="poder"><b>' + rating + '</b><small>Poder</small></div></li>';
  }

  function renderLargada() {
    var L = ui.lobby;
    refreshPlayerEntry(L);
    var D = L.cond.distance;
    var pay = L.training ? null : RS.payouts(L.fee, L.n, L.racers.map(function (r, i) { return i; }));
    var pote;
    if (L.training) {
      pote = '<section class="caixa" aria-labelledby="t-pote"><h2 class="titulo" id="t-pote">Treino gratuito</h2>' +
        '<p class="nota">Sem aposta e sem pote. Você ganha metade do XP normal e um pouco de Ouro pela colocação.</p>' +
        '<div class="premios">' + [0, 1, 2].map(function (p) {
          return '<div class="premio premio--' + (p + 1) + '"><span class="lugar">' + (p + 1) + 'º</span>' + ouroHtml(TRAINING_GOLD[p]) + '</div>';
        }).join('') + '</div></section>';
    } else {
      pote = '<section class="caixa" aria-labelledby="t-pote"><h2 class="titulo" id="t-pote">Pote</h2>' +
        '<dl class="pote"><dt>Entrada ' + fmt(L.fee) + ' × ' + L.n + ' corredores</dt><dd>' + ouroHtml(pay.pot) + '</dd>' +
        '<dt>Taxa da casa (' + Math.round(E.houseFee * 100) + '%)</dt><dd>−' + fmt(pay.fee) + '</dd>' +
        '<div class="total" style="display:contents"><dt>Prêmios</dt><dd>' + ouroHtml(pay.pot - pay.fee) + '</dd></div></dl>' +
        '<div class="premios premios--' + pay.prizes.length + '">' + pay.prizes.map(function (p) {
          return '<div class="premio premio--' + p.place + '"><span class="lugar">' + p.place + 'º</span>' + ouroHtml(p.amount) + '</div>';
        }).join('') + '</div>' +
        '<p class="nota">' + (pay.prizes.length < 3 ? 'Com ' + L.n + ' corredores só 1º e 2º são pagos. ' : '') +
        'Ao largar, ' + fmt(L.fee) + ' de Ouro saem do seu saldo (fica ' + fmt(state.gold - L.fee) + ').</p></section>';
    }
    var label = L.training ? 'Largar treino!' : 'Largar! (−' + fmt(L.fee) + ' Ouro)';

    return '<section class="tela" aria-labelledby="t-largada">' +
      '<header class="topo"><button type="button" class="btn btn--pequeno" data-acao="voltar">Voltar</button>' +
        '<span class="saldo" aria-label="Saldo">' + ouroHtml(state.gold) + '</span></header>' +
      '<header class="tela-cabeca placa"><span class="rotulo">Sala de largada · Páreo nº ' + L.counter + '</span>' +
        '<h1 class="titulo titulo--tela" id="t-largada" tabindex="-1" data-foco>' + esc(L.trackName) + '</h1>' +
        (L.trackDesc ? '<p class="nota">' + esc(L.trackDesc) + '</p>' : '') + '</header>' +
      '<section class="caixa" aria-label="Condições da pista">' + conditionChips(L.cond) +
        '<canvas class="perfil" data-perfil="1" role="img" aria-label="' + esc('Mapa da pista de ' + D + ' metros em ' + L.cond.blocks.length + ' trechos: ' +
          L.cond.blocks.map(function (bl) { return GD.BLOCK_TYPES[bl.type].name.toLowerCase(); }).join(', ')) + '"></canvas>' +
        climaHints(L) + '</section>' +
      '<section class="caixa" aria-labelledby="t-estrategia"><h2 class="titulo" id="t-estrategia">Sua estratégia</h2>' +
        '<div class="tela-cabeca"><span class="rotulo">Equipamento</span>' + gearSummaryHtml(activeMount()) +
          '<div class="acoes"><button type="button" class="btn btn--pequeno" data-acao="equipar-tela" data-id="' + esc(state.activeId) + '">Equipar</button></div>' +
          (state.pending ? '<p class="nota">' + esc('Com o páreo aberto, só trocas que não passem do rating da sala (' + state.pending.pr + ').') + '</p>' : '') +
        '</div></section>' +
      '<section class="caixa" aria-labelledby="t-corredores"><h2 class="titulo" id="t-corredores">Corredores<span class="nota">' + L.n + ' na raia</span></h2>' +
        '<ol class="programa">' + L.racers.map(racerRow).join('') + '</ol></section>' +
      pote +
      '<div class="barra-acao"><button type="button" class="btn btn--ouro btn--grande" data-acao="largar">' + esc(label) + '</button></div>' +
      '</section>';
  }

  // Mapa da pista: faixa colorida por bloco (reta na cor do piso, curva e subida na cor do tipo), morros nas
  // subidas, marcas de distância, largada e chegada.
  // Os rótulos de distância ficam abaixo da faixa, sobre o painel, com contraste de texto.
  function drawProfileCanvas(cv) {
    var L = ui.lobby; if (!L) return;
    var cond = L.cond, D = cond.distance;
    var par = cv.parentNode, avail = 336;
    if (par) {
      var pcs = getComputedStyle(par);
      avail = par.clientWidth - (parseFloat(pcs.paddingLeft) || 0) - (parseFloat(pcs.paddingRight) || 0);
    }
    var artW = clamp(Math.floor(avail / 2), 120, 240), artH = 36;
    var s = setupCanvas(cv, artW, artH, 2), ctx = s.ctx, k = s.k;
    function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x * k, y * k, w * k, h * k); }
    R(0, 0, artW, artH, C.painel2);
    var x0 = 8, x1 = artW - 10, base = 22, bandBottom = 27;
    var surf = (GD.SURFACES[cond.surface] || {}).color || C.palha;
    function hillH(m) {
      for (var i = 0; i < cond.hills.length; i++) {
        var a = cond.hills[i][0], b = cond.hills[i][1];
        if (m >= a && m <= b) return Math.round(8 * (SP.hillShape ? SP.hillShape(m, a, b) : Math.sin(Math.PI * (m - a) / (b - a))));
      }
      return 0;
    }
    for (var x = x0; x <= x1; x++) {
      var m = (x - x0) / (x1 - x0) * D, hh = hillH(m);
      var bt = cond.blocks[RS.blockAt(cond.blocks, m)].type;
      R(x, base - hh, 1, bandBottom - (base - hh), bt === 'reta' ? surf : GD.BLOCK_TYPES[bt].color);
      R(x, base - hh, 1, 1, hh > 0 ? C.ouro : C.texto);
    }
    var every = D <= 1000 ? 100 : 200;
    for (var mm = every; mm < D; mm += every) {
      var xm = Math.round(x0 + mm / D * (x1 - x0));
      R(xm, bandBottom, 1, 2, C.texto3);
    }
    // largada e chegada
    R(x0, 6, 1, bandBottom - 6, C.texto); R(x0 + 1, 6, 4, 3, C.texto);
    for (var fy = 4; fy < bandBottom; fy += 2) { R(x1, fy, 2, 1, (fy / 2) % 2 ? C.sombra : C.texto); R(x1 + 2, fy, 2, 1, (fy / 2) % 2 ? C.texto : C.sombra); }
    SP.drawText(ctx, '0', x0 * k, 30 * k, { scale: k, color: C.texto });
    SP.drawText(ctx, D + 'm', (x1 + 3) * k, 30 * k, { scale: k, color: C.texto, align: 'right' });
    // rótulos sobre os trechos; um rótulo que encostaria no anterior da mesma linha é omitido (a cor já diz o tipo)
    function labels(ranges, text, y, color) {
      var tw = SP.measureText ? SP.measureText(text, 1) : text.length * 4, lastRight = -Infinity;
      ranges.forEach(function (rg) {
        var cx = Math.round(x0 + (rg[0] + rg[1]) / 2 / D * (x1 - x0));
        if (cx - tw / 2 < lastRight + 3) return;
        lastRight = cx + tw / 2;
        SP.drawText(ctx, text, cx * k, y * k, { scale: k, color: color, align: 'center' });
      });
    }
    labels(cond.hills, 'SUBIDA', 3, C.ouro);
    labels(cond.curves, 'CURVA', 10, GD.BLOCK_TYPES.curva.color);
  }

  // ===========================================================================
  // Liquidação (no "Largar!"): debita, simula com a seed da sala e paga
  // ===========================================================================
  function settle(L) {
    refreshPlayerEntry(L);
    L.sim = RS.simulate({
      seed: L.seed,
      conditions: L.cond,
      racers: L.racers.map(function (r) {
        return { horse: r.horse, gear: r.gear, name: r.name, isPlayer: r.isPlayer };
      })
    });
    L.cond = withRanges(L.sim.conditions);
    var order = L.sim.finishOrder;
    var place = order.indexOf(L.playerIdx) + 1;
    var hBefore = playerHorse();
    var before = { level: hBefore.level, xp: hBefore.xp, gold: state.gold, stats: RS.computeStats(hBefore, null) };
    var pay = null, prize;
    if (L.training) {
      prize = TRAINING_GOLD[place - 1] || 10;
    } else {
      pay = RS.payouts(L.fee, L.n, order);
      var mine = pay.prizes.filter(function (p) { return p.racer === L.playerIdx; })[0];
      prize = mine ? mine.amount : 0;
    }
    var xpBase = E.xpPerPlace[place - 1] || E.xpPerPlace[E.xpPerPlace.length - 1];
    var xpGain = L.training ? Math.round(xpBase / 2) : xpBase;

    state.gold = state.gold - L.fee + prize;
    // Pedra Negra do pódio: só em corrida valendo, pela seed da sala, na mesma gravação do Ouro
    var stone = L.training ? 0 : GR.podiumStone(L.seed, place, L.fee);
    state.pedras += stone;
    var gained = applyXp(activeMount(), xpGain, state.raceCounter);
    var levels = gained.levels, learned = gained.learned;
    state.races += 1;
    if (place === 1) state.wins += 1;
    if (place <= 3) state.podiums += 1;
    if (!L.training) state.goldWon += prize;
    state.pending = null;
    persist();

    var hAfter = playerHorse();
    return {
      place: place, prize: prize, fee: L.fee, training: L.training, payouts: pay, stone: stone,
      xpGain: xpGain, levels: levels, learned: learned,
      before: before,
      after: { level: hAfter.level, xp: hAfter.xp, gold: state.gold, stats: RS.computeStats(hAfter, null) }
    };
  }

  // ===========================================================================
  // Tela 4 — Corrida (HUD desenhado dentro do canvas, tela inteira sem rolagem)
  // ===========================================================================
  function renderCorrida() {
    var L = ui.lobby, D = L.cond.distance;
    var shp = sharePct(L.cond);
    var tracado = ['curva', 'subida'].map(function (tp) {
      return shp[tp] ? shp[tp] + '% ' + tp : '';
    }).filter(Boolean).join(' · ') || 'reta pura';
    // o trecho do clima fica num span próprio: pushFeed troca o texto quando o Dado vira o clima
    var climaTxt = 'Clima: ' + GD.WEATHERS[L.cond.weather].name;
    var condTxt = D + ' m · ' + GD.SURFACES[L.cond.surface].name + ' · ' + climaTxt + ' · ' + tracado;
    return '<section class="tela tela--larga tela--corrida" aria-labelledby="t-corrida">' +
      '<header class="corrida-topo"><div class="corrida-titulo">' +
        '<h1 class="corrida-nome" id="t-corrida" tabindex="-1" data-foco>' + esc(L.trackName) + '</h1>' +
        '<span class="rotulo">' + esc(D + ' m · ' + GD.SURFACES[L.cond.surface].name + ' · ') +
          '<span id="clima-atual">' + esc(climaTxt) + '</span>' + esc(' · ' + tracado) + '</span></div>' +
        '<span class="saldo saldo--pote">' + (L.training ? '<span class="rotulo">Treino</span>' : '<span class="rotulo">Pote</span>' + ouroHtml(L.fee * L.n)) + '</span></header>' +
      '<div class="palco"><canvas id="pista" role="img" aria-label="' + esc('Corrida em ' + L.trackName + ', ' + condTxt) + '"></canvas></div>' +
      '<div class="corrida-baixo">' +
        '<ol class="feed" id="feed" aria-label="Narração"></ol>' +
        '<div class="controles" role="group" aria-label="Controles da corrida">' +
          '<div class="vel"><button type="button" class="btn btn--pequeno" data-acao="vel" data-id="1" aria-pressed="true">x1</button>' +
          '<button type="button" class="btn btn--pequeno" data-acao="vel" data-id="2" aria-pressed="false">x2</button></div>' +
          '<button type="button" class="btn btn--pequeno pular" data-acao="pular" id="btn-pular">Pular para o resultado</button>' +
        '</div>' +
      '</div>' +
      '<p class="sr" aria-live="polite" id="anuncio"></p>' +
      '</section>';
  }

  function createRaceView(L, root) {
    var sim = L.sim, n = L.n, D = L.cond.distance, hills = L.cond.hills, curves = L.cond.curves || [];
    var blocks = L.cond.blocks;
    // clima em cada instante: o inicial, trocado por cada evento 'clima' (Dado da Sorte) já ocorrido
    var climaEvs = sim.events.filter(function (ev) { return ev.type === 'clima'; });
    function climaAtual(simT) {
      var w = L.cond.weather;
      for (var c = 0; c < climaEvs.length && climaEvs[c].t <= simT; c++) w = climaEvs[c].weather;
      return w;
    }
    var frames = sim.frames, F = frames.length, dt = sim.dt;
    var me = L.playerIdx;
    var cv = root.querySelector('#pista');
    var palco = cv.parentNode;
    var tela = root.querySelector('.tela--corrida');
    var ctx = cv.getContext('2d');
    var hud = {
      feed: root.querySelector('#feed'), pular: root.querySelector('#btn-pular'), anuncio: root.querySelector('#anuncio'),
      clima: root.querySelector('#clima-atual')
    };
    var fTime = sim.finishTimes;
    var rankOf = new Array(n);
    sim.finishOrder.forEach(function (ri, k) { rankOf[ri] = k; });
    var tWin = fTime[sim.finishOrder[0]];
    var endT = Math.max(fTime[me], fTime[sim.finishOrder[Math.min(2, n - 1)]]) + 2.0;

    // depois da linha o cavalo segue galopando e reduz para um meio-galope (não empilha na chegada)
    var vFin = new Array(n), ffIdx = new Array(n), i;
    for (i = 0; i < n; i++) {
      var ff = F - 1;
      for (var f0 = 0; f0 < F; f0++) if (frames[f0].pos[i] >= D) { ff = f0; break; }
      ffIdx[i] = ff;
      vFin[i] = Math.max(8, frames[Math.max(0, ff - 1)].speed[i]);
    }
    var DEC = 1.1, CANTER = 0.62;
    function afterDist(j, ta) {
      var vf = vFin[j], tk = (1 - CANTER) * vf / DEC;
      if (ta <= tk) return vf * ta - 0.5 * DEC * ta * ta;
      return vf * tk - 0.5 * DEC * tk * tk + CANTER * vf * (ta - tk);
    }
    function afterSpeed(j, ta) { return Math.max(CANTER * vFin[j], vFin[j] - DEC * ta); }

    // rastros de elemento: habilidades e garra
    var boosts = [];
    sim.events.forEach(function (ev) {
      var r = L.racers[ev.racer];
      if (!r) return;
      if (ev.type === 'skill') {
        var sk = r.horse.skills.map(function (id) { return GD.SKILLS[id]; }).filter(function (s) { return s && ev.text.indexOf(s.name) >= 0; })[0];
        var dur = sk && sk.effect && sk.effect.durationS ? Math.min(sk.effect.durationS, 7) : 2.5;
        boosts.push({ i: ev.racer, from: ev.t, to: ev.t + dur, strong: 1 });
      } else if (ev.type === 'garra') {
        boosts.push({ i: ev.racer, from: ev.t, to: fTime[ev.racer] + 0.6, strong: 1 });
      }
    });

    var feedEvents = [{ t: 0, racer: -1, type: 'largada', text: 'Foi dada a largada!' }].concat(sim.events, narration());
    feedEvents.sort(function (a, b) { return a.t - b.t; });
    var feedPtr = 0, feedShown = [];

    // Narração de passagem: quem lidera aos 25%, 50% e na reta final, e onde você está.
    function narration() {
      var out = [];
      var marks = [[0.25, function (m) { return 'Passagem dos ' + m + ' m'; }], [0.5, function () { return 'Metade da corrida'; }], [0.8, function () { return 'Reta final'; }]];
      marks.forEach(function (mk) {
        var goal = mk[0] * D;
        for (var f2 = 0; f2 < F; f2++) {
          var P = frames[f2].pos, lead = 0;
          for (var j = 1; j < n; j++) if (P[j] > P[lead]) lead = j;
          if (P[lead] < goal) continue;
          var mine = 1;
          for (var q = 0; q < n; q++) if (q !== me && P[q] > P[me]) mine++;
          var txt = mk[1](Math.round(goal)) + ': ' + L.racers[lead].horse.name + ' na frente' +
            (lead === me ? ' (é você!)' : '; você em ' + mine + 'º') + '.';
          out.push({ t: frames[f2].t, racer: lead, type: 'narracao', text: txt });
          break;
        }
      });
      return out;
    }
    // Reprodução comprimida: a corrida dura 55–170 s no relógio da simulação (que o HUD mostra),
    // mas é assistida em ~20 s (1000 m) a ~34 s (2400 m) em x1, com câmera lenta na chegada.
    var realTarget = 20 + 14 * clamp((D - 1000) / 1400, 0, 1);
    var ts = sim.duration / realTarget;
    var self = {
      simT: 0, tReal: 0, last: 0, mult: 1, phase: 'contagem', count: reduced() ? 1.2 : 2.4,
      gallop: new Array(n), S: 2, W: 0, H: 0, done: false, endTimer: 0,
      lastHud: {}, flash: 0, winnerSeen: false, finishCam: false, playerRect: null, crossed: false,
      climaMsg: '', climaTimer: 0,
      lay: null
    };
    for (i = 0; i < n; i++) self.gallop[i] = i * 1.7;

    // ---- layout: o canvas ocupa a altura que sobra na tela (sem rolagem), escala inteira
    function layout() {
      var r = dpr();
      var cssW = palco.clientWidth || 360;
      if (hud.feed) hud.feed.style.height = '';
      var other = tela.getBoundingClientRect().height - palco.getBoundingClientRect().height;
      var cs = appEl ? getComputedStyle(appEl) : null;
      var padY = cs ? (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) : 16;
      var cssH = Math.max(150, (window.innerHeight || 700) - padY - other);
      var pick = null;
      [3, 2].forEach(function (k) {
        if (pick) return;
        var S = Math.max(1, Math.round(k * r));
        var artW = Math.floor(cssW * r / S), artH = Math.floor(cssH * r / S);
        var compact = artH < 190;
        var hudH = compact ? 15 : 20 + n;
        var bottom = compact ? 8 : 14;
        var minTop = hudH + (compact ? 12 : 30);
        var lane = Math.floor((artH - bottom - minTop) / n);
        if (k === 3 && (lane < 20 || artW < 300)) return;
        lane = clamp(lane, compact ? 12 : 13, 26);
        var top = Math.max(minTop, Math.min(artH - bottom - n * lane, minTop + 70));
        pick = {
          k: k, S: S, artW: artW, artH: top + n * lane + bottom, laneArt: lane, laneTopArt: top, hudH: hudH, compact: compact,
          maxLift: clamp(top - hudH - 12, 4, 24)   // a subida não invade o HUD
        };
      });
      var S = pick.S;
      self.S = S; self.lay = pick;
      self.W = pick.artW * S; self.H = pick.artH * S;
      cv.width = self.W; cv.height = self.H;
      cv.style.width = (self.W / r) + 'px';
      cv.style.height = (self.H / r) + 'px';
      palco.style.height = (self.H / r) + 'px';
      ctx.imageSmoothingEnabled = false;
      self.ppmArt = pick.artW < 260 ? 2 : 2.5;
      // a narração ocupa a altura que sobrar (campos pequenos): nada de faixa vazia sob os botões
      if (hud.feed && getComputedStyle(hud.feed).display !== 'none') {
        var rest = (window.innerHeight || 700) - padY - tela.getBoundingClientRect().height;
        if (rest > 8) hud.feed.style.height = Math.floor(hud.feed.getBoundingClientRect().height + rest - 4) + 'px';
      }
    }
    layout();

    function sample(t) {
      var out = { pos: new Array(n), speed: new Array(n), stamina: new Array(n) };
      var fi = t / dt, a = clamp(Math.floor(fi), 0, Math.max(0, F - 2)), u = clamp(fi - a, 0, 1);
      var A = frames[a], B = frames[Math.min(F - 1, a + 1)];
      for (var j = 0; j < n; j++) {
        var ft = fTime[j];
        if (t >= ft) {
          out.pos[j] = D + afterDist(j, t - ft);
          out.speed[j] = afterSpeed(j, t - ft);
          out.stamina[j] = frames[Math.min(F - 1, ffIdx[j])].stamina[j];
        } else {
          if (B.pos[j] >= D) {
            var ta0 = a * dt, uu = clamp((t - ta0) / Math.max(1e-6, ft - ta0), 0, 1);
            out.pos[j] = lerp(A.pos[j], D, uu);
          } else out.pos[j] = lerp(A.pos[j], B.pos[j], u);
          out.speed[j] = lerp(A.speed[j], B.speed[j], u);
          out.stamina[j] = lerp(A.stamina[j], B.stamina[j], u);
        }
      }
      return out;
    }

    // Quem já cruzou fica na ordem oficial (sim.finishOrder, sem arredondamento); o resto, por posição.
    function ranking(st, t) {
      var idx = [];
      for (var j = 0; j < n; j++) idx.push(j);
      idx.sort(function (a, b) {
        var fa = fTime[a] <= t, fb = fTime[b] <= t;
        if (fa && fb) return rankOf[a] - rankOf[b];
        if (fa) return -1;
        if (fb) return 1;
        return (st.pos[b] - st.pos[a]) || (a - b);
      });
      return idx;
    }

    function boostIntensity(j, t) {
      var best = 0;
      for (var b = 0; b < boosts.length; b++) {
        var B = boosts[b];
        if (B.i !== j || t < B.from || t > B.to) continue;
        var age = t - B.from, left = B.to - t;
        var v = Math.min(1, age / 0.3) * (age < 1.5 ? 1 : 0.65) * Math.min(1, left / 0.6 + 0.2);
        if (v > best) best = v;
      }
      return best;
    }

    function pushFeed(ev) {
      feedShown.unshift(ev);
      if (feedShown.length > 6) feedShown.length = 6;
      hud.feed.innerHTML = ordFix(feedShown.map(function (e) {
        var mine = e.racer === me;
        var chip = e.racer >= 0 && L.racers[e.racer] ? laneChip(L.racers[e.racer], e.racer, 'raia--mini') : '';
        return '<li class="tipo-' + esc(e.type) + (mine ? ' voce' : '') + '"><time>' + fmtClock(e.t) + '</time>' + chip + '<span>' + esc(e.text) + '</span></li>';
      }).join(''));
      if (ev.racer === me && (ev.type === 'chegada' || ev.type === 'garra' || ev.type === 'skill')) hud.anuncio.textContent = ev.text;
      if (ev.type === 'clima' && hud.clima && GD.WEATHERS[ev.weather]) hud.clima.textContent = 'Clima: ' + GD.WEATHERS[ev.weather].name;
      if (ev.type === 'dado' && ev.changed && GD.WEATHERS[ev.weather]) {
        // virada de clima: anúncio por ~2 s (faixa no canvas + leitor de tela) e um clarão leve
        self.climaMsg = 'CLIMA: ' + GD.WEATHERS[ev.weather].name.toUpperCase();
        self.climaTimer = 2;
        hud.anuncio.textContent = 'O clima virou: ' + GD.WEATHERS[ev.weather].name + '.';
        if (!reduced()) self.flash = Math.max(self.flash, 0.12);
      }
    }

    // ---- desenho em pixels de arte (A = escala)
    function box(x, y, w, h, bg, border) {
      var S = self.S;
      if (border) { ctx.fillStyle = border; ctx.fillRect(x * S, (y - 1) * S, w * S, S); ctx.fillRect(x * S, (y + h) * S, w * S, S); ctx.fillRect((x - 1) * S, y * S, S, h * S); ctx.fillRect((x + w) * S, y * S, S, h * S); }
      ctx.fillStyle = bg; ctx.fillRect(x * S, y * S, w * S, h * S);
    }
    function text(str, x, y, color, scale, align, shadow) {
      SP.drawText(ctx, str, x * self.S, y * self.S, { scale: (scale || 1) * self.S, color: color, align: align, shadow: shadow });
    }
    function tw(str, scale) { return SP.measureText(str, scale || 1); }
    function digitColor(silk) { return hexLum(silk) > 0.5 ? C.tinta : C.texto; }

    function drawHud(st, order) {
      var lay = self.lay, A = lay.artW;
      // posição
      var place = order.indexOf(me) + 1;
      var big = self.phase === 'contagem' ? '—' : String(place);
      var small = '/' + n;
      var bw = tw(big, 2) + 2 + Math.max(tw('º'), tw(small)) + 6;
      box(2, 2, bw, 14, C.veu, C.ouro);
      text(big, 5, 4, C.ouro, 2, null, C.sombra);
      if (self.phase !== 'contagem') text('º', 5 + tw(big, 2) + 2, 3, C.ouro);
      text(small, 5 + tw(big, 2) + 2, 9, C.texto);
      // estamina
      var sx = 2 + bw + 5, barW = clamp(Math.floor(A * 0.28), 32, 84);
      var stam = clamp(st.stamina[me], 0, 1);
      box(sx, 2, barW + 4, 14, C.veu);
      text('EST', sx + 2, 3, C.texto2);
      var col = stam > 0.5 ? C.ganho : stam > 0.25 ? C.ouro : C.perda;
      var segs = Math.floor(barW / 4), on = Math.round(stam * segs);
      for (var s = 0; s < segs; s++) {
        ctx.fillStyle = s < on ? col : C.sombra;
        ctx.fillRect((sx + 2 + s * 4) * self.S, 10 * self.S, 3 * self.S, 4 * self.S);
      }
      // tempo e velocidade (relógio da corrida)
      var tShown = Math.min(self.simT, fTime[me]);
      var tTxt = fmtClock(tShown), kmh = Math.round(st.speed[me] * 3.6) + ' KM/H';
      var tw2 = Math.max(tw(tTxt), tw(kmh)) + 4;
      box(A - 2 - tw2, 2, tw2, 14, C.veu);
      text(tTxt, A - 4, 3, C.texto, 1, 'right');
      text(kmh, A - 4, 10, C.texto2, 1, 'right');
      // clima atual (vira com o Dado da Sorte), à esquerda do relógio; no layout compacto
      // não há espaço (a CURVA/SUBIDA fica ali) e o cabeçalho da tela mostra o clima
      var wName = GD.WEATHERS[climaAtual(self.simT)].name.toUpperCase();
      var ww = Math.max(tw('CLIMA'), tw(wName)) + 4, wx = A - 2 - tw2 - 4 - ww;
      if (!lay.compact && wx > sx + barW + 4 + 4) {
        box(wx, 2, ww, 14, C.veu);
        text('CLIMA', wx + 2, 3, C.texto2);
        text(wName, wx + 2, 10, C.texto);
      }
      // tipo do bloco do jogador: SUBIDA ou CURVA (nada na reta)
      var bType = blocks[RS.blockAt(blocks, st.pos[me])].type;
      var lbl = bType === 'subida' ? '▲SUBIDA' : bType === 'curva' ? '↪CURVA' : '';
      if (lbl && self.phase !== 'contagem') {
        var lw = tw(lbl) + 4;
        var hy = lay.compact ? 6 : 18 + n + 4;
        var hx = lay.compact ? A - 2 - tw2 - 4 - lw : 2;
        box(hx, hy, lw, 7, bType === 'curva' ? GD.BLOCK_TYPES.curva.color : C.ouro, C.sombra);
        text(lbl, hx + 2, hy + 1, C.tinta);
      }
      if (lay.compact) return;
      // faixa de progresso: uma linha por raia (pontos nunca se escondem atrás do seu marcador)
      var x0 = 4, x1 = A - 9, y0 = 19;
      box(x0 - 1, y0 - 1, x1 - x0 + 3, n + 2, C.veu);
      ctx.fillStyle = C.linha; ctx.fillRect(x0 * self.S, y0 * self.S, (x1 - x0 + 1) * self.S, n * self.S);
      ctx.fillStyle = C.brilho;   // curvas: a faixa clareada
      curves.forEach(function (cl) {
        var ca = Math.round(x0 + cl[0] / D * (x1 - x0)), cb = Math.round(x0 + cl[1] / D * (x1 - x0));
        ctx.fillRect(ca * self.S, y0 * self.S, Math.max(1, cb - ca) * self.S, n * self.S);
      });
      ctx.fillStyle = C.ouroEscuro;
      hills.forEach(function (hl) {
        var ha = Math.round(x0 + hl[0] / D * (x1 - x0)), hb = Math.round(x0 + hl[1] / D * (x1 - x0));
        ctx.fillRect(ha * self.S, y0 * self.S, Math.max(1, hb - ha) * self.S, n * self.S);
      });
      for (var fy = 0; fy < n + 2; fy++) for (var fx = 0; fx < 3; fx++) {
        ctx.fillStyle = (fx + fy) % 2 ? C.texto : C.sombra;
        ctx.fillRect((x1 + 2 + fx) * self.S, (y0 - 1 + fy) * self.S, self.S, self.S);
      }
      for (var j = 0; j < n; j++) {
        if (j === me) continue;
        var px = Math.round(x0 + clamp(st.pos[j] / D, 0, 1) * (x1 - x0));
        ctx.fillStyle = L.racers[j].silks;
        ctx.fillRect((px - 1) * self.S, (y0 + j) * self.S, 3 * self.S, self.S);
      }
      var mx = Math.round(x0 + clamp(st.pos[me] / D, 0, 1) * (x1 - x0));
      ctx.fillStyle = C.ouro;
      ctx.fillRect((mx - 1) * self.S, (y0 - 1) * self.S, 3 * self.S, (n + 2) * self.S);
      ctx.fillStyle = C.sombra;
      ctx.fillRect(mx * self.S, (y0 + me) * self.S, self.S, self.S);
    }

    function draw(st, order) {
      var S = self.S, W = self.W, H = self.H, lay = self.lay;
      var ppm = self.ppmArt * S;
      var visM = W / ppm;
      var p = st.pos[me];
      // câmera sem atraso: o focinho do jogador fica perto de 48% da largura (rivais à frente visíveis)
      var follow = Math.max(-0.3 * visM, p - 0.48 * visM);
      var lineX = (D - follow) / visM;
      self.finishCam = self.phase === 'corrida' && self.simT > tWin - 1.1 && self.simT < tWin + 0.7 && p < D - 2 && (lineX > 0.95 || lineX < 0.08);
      var cam = self.finishCam ? D - 0.62 * visM : follow;
      var laneH = lay.laneArt * S, laneTop = lay.laneTopArt * S;
      var tr = self.tReal;
      var clima = climaAtual(self.simT);
      SP.drawTrack(ctx, {
        width: W, height: H, cameraX: cam, pxPerMeter: ppm, lanes: n, laneTop: laneTop, laneH: laneH,
        surface: L.cond.surface, finishM: D, hills: hills, curves: curves, distanceMarkersEvery: D <= 1000 ? 100 : 200,
        t: reduced() ? 0 : tr, weather: clima, pixel: S, highlightLane: me, hillMaxLift: lay.maxLift
      });
      var tagsR = [], tagsL = [], badges = [], youTag = null;
      for (var j = 0; j < n; j++) {
        var r = L.racers[j];
        var standing = self.phase === 'contagem' || st.speed[j] < 0.4;
        // âncoras do sprite por código ou do molde (convertidas): o focinho é sempre o mesmo NOSE
        var an = SP.anchorsFor(r.horse.element, S, standing ? 'parado' : 'galope');
        var hoofM = st.pos[j] - (an.nose[0] - 20) / self.ppmArt;
        var lift = SP.hillLiftAt ? SP.hillLiftAt(hoofM, hills, lay.maxLift) * S : 0;
        var feetY = laneTop + (j + 1) * laneH - 3 * S - lift;
        var y = feetY - (SP.FOOT_Y + 1) * S;
        var x = Math.round(((st.pos[j] - cam) * ppm - an.nose[0] * S) / S) * S;
        if (j === me) self.playerRect = { x: x, y: y, w: SP.HORSE_W * S, h: SP.HORSE_H * S, W: W, H: H };
        if (x > W - 2 * S) { tagsR.push({ j: j, y: feetY - 12 * S, txt: '+' + Math.round(st.pos[j] - p) + 'm' }); continue; }
        if (x + SP.HORSE_W * S < 2 * S) { tagsL.push({ j: j, y: feetY - 12 * S, txt: '-' + Math.round(p - st.pos[j]) + 'm' }); continue; }
        if (j === me) {
          // anel dourado no chão sob os cascos do jogador
          var ry = feetY - 2 * S;
          ctx.fillStyle = C.ouro;
          ctx.fillRect(x + 11 * S, ry - S, 18 * S, S); ctx.fillRect(x + 11 * S, ry + 2 * S, 18 * S, S);
          ctx.fillRect(x + 8 * S, ry, 3 * S, 2 * S); ctx.fillRect(x + 29 * S, ry, 3 * S, 2 * S);
        }
        var inten = standing ? 0 : boostIntensity(j, self.simT);
        if (inten > 0.02) SP.drawTrail(ctx, x + an.rear[0] * S, y + an.rear[1] * S, r.horse.element, tr + j * 0.31, inten, S);
        if (lift > 0 && !standing && !reduced()) {
          // poeira levantada na subida
          var dp = Math.floor(tr * 10 + j) % 3;
          ctx.fillStyle = 'rgba(214,190,140,0.55)';
          ctx.fillRect(x + (4 - dp) * S, feetY - (2 + dp) * S, 2 * S, S);
          ctx.fillRect(x + (1 + dp) * S, feetY - 4 * S, S, S);
        }
        SP.drawHorse(ctx, x, y, {
          palette: r.horse.palette, element: r.horse.element, frame: Math.floor(self.gallop[j]),
          scale: S, silks: r.silks, t: tr, idle: standing
        });
        var finished = fTime[j] <= self.simT;
        if (j === me) youTag = { x: x + (an.nose[0] + 3) * S, y: y + 3 * S, place: finished ? rankOf[j] + 1 : 0 };
        else if (finished) badges.push({ x: x + 22 * S, y: y - 2 * S, j: j, place: rankOf[j] + 1 });
      }
      // segunda passada: etiquetas por cima de todos os cavalos
      badges.forEach(function (b) {
        var t = b.place + 'º', w = tw(t) + 4;
        var bx = Math.round(b.x / S) - Math.round(w / 2), by = Math.round(b.y / S) - 7;
        box(bx, by, w, 7, L.racers[b.j].silks, C.sombra);
        text(t, bx + 2, by + 1, digitColor(L.racers[b.j].silks));
      });
      if (youTag) {
        var yt = '◀VOCÊ' + (youTag.place ? ' ' + youTag.place + 'º' : ''), yw = tw(yt) + 4;
        var tx = Math.min(Math.round(youTag.x / S), lay.artW - yw - 2), ty = Math.round(youTag.y / S) - 2;
        box(tx, ty, yw, 9, C.veu, C.ouro);
        text(yt, tx + 2, ty + 3, C.ouro);
      }
      layoutTags(tagsR, true); layoutTags(tagsL, false);
      SP.drawWeather(ctx, clima, reduced() ? 0 : tr, W, H, S);
      if (self.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * self.flash / 0.3).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      drawHud(st, order);
      if (self.finishCam || (self.phase !== 'contagem' && Math.abs(self.simT - tWin) < 0.6)) {
        var bt = 'FOTO DE CHEGADA', bw = tw(bt) + 6, bx2 = Math.round(lay.artW / 2 - bw / 2), by2 = lay.hudH + 3;
        box(bx2, by2, bw, 9, C.sombra, C.ouro);
        text(bt, bx2 + 3, by2 + 2, C.ouro);
      } else if (self.climaTimer > 0) {
        var ct = self.climaMsg, cw2 = tw(ct) + 6, cx3 = Math.round(lay.artW / 2 - cw2 / 2), cy3 = lay.hudH + 3;
        box(cx3, cy3, cw2, 9, C.sombra, GD.BLOCK_TYPES.curva.color);
        text(ct, cx3 + 3, cy3 + 2, C.texto);
      }
      if (self.phase === 'contagem') {
        var c = Math.ceil(self.count / (reduced() ? 0.4 : 0.8));
        var label = c >= 3 ? '3' : c === 2 ? '2' : c === 1 ? '1' : 'JÁ!';
        var sc = 5, cw = tw(label, sc);
        var cy = lay.laneTopArt + Math.round((n * lay.laneArt) / 2) - 13;
        var cx = Math.round(lay.artW / 2);
        box(cx - Math.round(cw / 2) - 5, cy - 5, cw + 10, 5 * sc + 10, C.veu, C.ouro);
        text(label, cx + 1, cy + 1, C.sombra, sc, 'center');
        text(label, cx, cy, C.ouro, sc, 'center');
      }
    }

    // etiquetas de quem está fora da tela: coluna própria, sem se sobrepor, com nº da raia
    function layoutTags(tags, right) {
      if (!tags.length) return;
      var S = self.S, lay = self.lay;
      tags.sort(function (a, b) { return a.y - b.y; });
      var minY = (lay.compact ? lay.hudH + 2 : lay.hudH + 14);
      var prev = minY - 9;
      tags.forEach(function (t) {
        var y = Math.max(Math.round(t.y / S), prev + 9);
        y = Math.min(y, lay.artH - 9);
        prev = y;
        var r = L.racers[t.j], num = String(t.j + 1);
        var w = 7 + tw(t.txt) + 4;
        var bx = right ? lay.artW - w - 1 : 1;
        box(bx, y, w, 8, C.veu);
        box(bx + 1, y + 1, 5, 6, r.silks);
        text(num, bx + 2, y + 1, digitColor(r.silks));
        text(t.txt, bx + 8, y + 1, C.texto);
        ctx.fillStyle = C.texto2;
        var ax = right ? bx + w : bx - 1;
        ctx.fillRect(ax * S, (y + 3) * S, S, 2 * S);
      });
    }

    function frame(now) {
      var dtReal = self.last ? Math.min(0.1, (now - self.last) / 1000) : 0;
      self.last = now;
      self.tReal += dtReal;
      var slowK = 1;
      if (self.phase === 'contagem') {
        self.count -= dtReal;
        if (self.count <= -0.25) self.phase = 'corrida';
      } else if (self.phase === 'corrida') {
        // câmera lenta quando o vencedor cruza a linha
        if (!reduced() && self.simT > tWin - 0.9 && self.simT < tWin + 0.5) slowK = 0.3;
        self.simT += dtReal * ts * self.mult * slowK;
        if (self.simT >= endT) { self.phase = 'fim'; self.endTimer = 1.2; hud.pular.textContent = 'Ver resultado'; }
      } else if (self.phase === 'fim') {
        self.simT += dtReal * ts * self.mult * 0.5;
        self.endTimer -= dtReal;
        if (self.endTimer <= 0 && !self.done) { self.done = true; go('resultado'); return; }
      }
      if (!self.winnerSeen && self.simT >= tWin) { self.winnerSeen = true; if (!reduced()) self.flash = 0.3; }
      if (self.flash > 0) self.flash = Math.max(0, self.flash - dtReal);
      if (self.climaTimer > 0) self.climaTimer = Math.max(0, self.climaTimer - dtReal);
      if (!self.crossed && self.simT >= fTime[me]) {
        self.crossed = true;
        hud.anuncio.textContent = 'Você cruzou a linha em ' + (rankOf[me] + 1) + 'º lugar.';
      }
      var st = sample(self.simT);
      // galope: cadência em tempo real proporcional à velocidade (mais lenta na câmera lenta)
      for (var j = 0; j < n; j++) self.gallop[j] += dtReal * 13 * (st.speed[j] / 17) * (self.mult > 1 ? 1.3 : 1) * Math.max(0.35, slowK);
      // narração
      while (self.phase !== 'contagem' && feedPtr < feedEvents.length && feedEvents[feedPtr].t <= self.simT) pushFeed(feedEvents[feedPtr++]);
      var order = ranking(st, self.simT);
      draw(st, order);
    }

    // primeiro quadro estático
    frame(performance.now());
    var onResize = function () { layout(); };
    window.addEventListener('resize', onResize);

    return {
      frame: frame,
      setSpeed: function (m) { self.mult = m; },
      skip: function () { if (!self.done) { self.done = true; go('resultado'); } },
      destroy: function () { window.removeEventListener('resize', onResize); },
      _state: self
    };
  }

  // ===========================================================================
  // Tela 5 — Resultado
  // ===========================================================================
  var PODIUM_W = 168, PODIUM_H = 84;
  function setupPodium(cv) {
    var L = ui.lobby; if (!L || !L.sim) return;
    var s = setupCanvas(cv, PODIUM_W, PODIUM_H, 2), ctx = s.ctx, k = s.k;
    var top3 = L.sim.finishOrder.slice(0, 3);
    var slots = [{ place: 2, cx: 30, top: 57, col: C.prata }, { place: 1, cx: 84, top: 49, col: C.ouro }, { place: 3, cx: 138, top: 63, col: C.bronze }];
    var playerOnPodium = top3.indexOf(L.playerIdx) >= 0;
    var confetti = [];
    for (var c = 0; c < 26; c++) confetti.push({ x: (c * 37) % PODIUM_W, y: (c * 23) % PODIUM_H, v: 6 + (c % 5) * 3, col: [C.ouro, C.ganho, C.agua, C.fogo, C.texto][c % 5] });
    function R(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x) * k, Math.round(y) * k, w * k, h * k); }
    var item = {
      draw: function (t) {
        R(0, 0, PODIUM_W, PODIUM_H, C.painel);
        // holofotes
        ctx.fillStyle = C.holofote;
        for (var b = 0; b < 3; b++) {
          var bx = slots[b].cx;
          for (var yy = 0; yy < 56; yy += 2) { var hw = 4 + yy * 0.32; ctx.fillRect(Math.round(bx - hw) * k, yy * k, Math.round(hw * 2) * k, 2 * k); }
        }
        if (playerOnPodium && !reduced()) {
          confetti.forEach(function (p, i) {
            var y = (p.y + t * p.v) % PODIUM_H, x = p.x + Math.round(Math.sin(t * 2 + i) * 2);
            R(x, y, 1 + (i % 2), 1, p.col);
          });
        }
        R(0, PODIUM_H - 4, PODIUM_W, 4, C.sombra);
        slots.forEach(function (sl) {
          var ri = top3[sl.place - 1];
          if (ri == null) return;
          var r = L.racers[ri];
          var bw = 48, bx = sl.cx - bw / 2;
          R(bx - 1, sl.top - 1, bw + 2, PODIUM_H - sl.top, C.sombra);
          R(bx, sl.top, bw, PODIUM_H - sl.top - 4, sl.col);
          R(bx, sl.top, bw, 1, C.brilho);
          R(bx, PODIUM_H - 7, bw, 3, C.escuro);
          SP.drawText(ctx, String(sl.place), sl.cx * k, (sl.top + 3) * k, { scale: 2 * k, color: C.tinta, align: 'center' });
          SP.drawHorse(ctx, (sl.cx - 21) * k, (sl.top - 32) * k, {
            palette: r.horse.palette, element: r.horse.element, idle: true, t: reduced() ? 0.5 : t + sl.place * 0.8,
            scale: k, silks: r.silks, shadow: false
          });
          if (r.isPlayer) {
            // seta dourada sobre o seu cavalo
            R(sl.cx - 3, sl.top - 40, 7, 1, C.ouro); R(sl.cx - 2, sl.top - 39, 5, 1, C.ouro); R(sl.cx - 1, sl.top - 38, 3, 1, C.ouro); R(sl.cx, sl.top - 37, 1, 1, C.ouro);
          }
        });
      }
    };
    item.draw(0);
    live.push(item);
  }

  function renderResultado() {
    var L = ui.lobby, R = ui.result, sim = L.sim;
    var order = sim.finishOrder, winT = sim.finishTimes[order[0]];
    var top3 = order.slice(0, 3);
    var art = trackArt(L.trackName);
    var names = [1, 0, 2].map(function (k) {
      var ri = top3[k]; if (ri == null) return '<div></div>';
      var r = L.racers[ri];
      return '<div class="' + (r.isPlayer ? 'voce' : '') + '"><b>' + esc(r.horse.name) + '</b><span>' + esc(r.isPlayer ? PLAYER_NAME : r.name) + '</span></div>';
    }).join('');

    var head = R.place === 1 ? 'Vitória! <em>1º</em> de ' + L.n
      : 'Você chegou em <em>' + R.place + 'º</em> de ' + L.n;
    var paid = R.payouts ? R.payouts.prizes.length : 3;
    var sub = R.place === 1 ? 'Na frente de todo mundo ' + art.em + ' ' + esc(L.trackName) + '.'
      : R.place <= paid ? 'No pódio ' + art.de + ' ' + esc(L.trackName) + '.'
      : R.place <= 3 ? 'Pódio sem prêmio: com ' + L.n + ' corredores só 1º e 2º são pagos.'
      : 'Fora do pódio desta vez ' + art.em + ' ' + esc(L.trackName) + '.';

    var net = R.prize - R.fee;
    var balanco = R.training
      ? '<dl class="balanco"><dt>Entrada</dt><dd>Treino, sem aposta</dd><dt>Ouro do treino</dt><dd class="mais">+' + fmt(R.prize) + '</dd>' +
        '<div class="final" style="display:contents"><dt>Saldo</dt><dd>' + ouroHtml(R.after.gold) + '</dd></div></dl>'
      : '<dl class="balanco"><dt>Entrada</dt><dd class="menos-t">−' + fmt(R.fee) + '</dd>' +
        '<dt>Prêmio (' + R.place + 'º lugar)</dt><dd class="' + (R.prize ? 'mais' : '') + '">' + (R.prize ? '+' + fmt(R.prize) : '0') + '</dd>' +
        '<dt>Resultado</dt><dd class="' + (net > 0 ? 'mais' : net < 0 ? 'menos-t' : '') + '">' + signed(net) + '</dd>' +
        (R.stone ? '<dt>Pedra Negra</dt><dd class="mais">🪨 +1</dd>' : '') +
        '<div class="final" style="display:contents"><dt>Saldo</dt><dd>' + ouroHtml(R.after.gold) + '</dd></div></dl>';

    var lvl = '';
    if (R.levels > 0) {
      var ups = STAT_KEYS.map(function (k) {
        var d = R.after.stats[k] - R.before.stats[k];
        return d ? '<span>' + esc(GD.STATS[k].short) + ' ' + R.before.stats[k] + ' → ' + R.after.stats[k] + ' <b class="mais">+' + d + '</b></span>' : '';
      }).join('');
      lvl = '<div class="levelup" role="status"><b>Subiu para o nível ' + R.after.level + '!</b>' +
        '<div class="ganhos">' + (ups || '<span>Os status já estão no teto da raridade.</span>') + '</div></div>';
    }
    if (R.learned && R.learned.length) {
      var skNames = R.learned.map(function (id) { return GD.SKILLS[id] ? GD.SKILLS[id].name : id; }).join(', ');
      lvl += '<div class="levelup" role="status"><b>' + esc('Nova skill: ' + skNames + '!') + '</b></div>';
    }
    // momentos da corrida (spec §10): skills, garra, cansaço, Dados da Sorte e viradas de clima,
    // de todos os corredores; sem ultrapassagens/chegadas/narração (a tabela já conta isso)
    var MOMENTOS = { skill: 1, garra: 1, cansou: 1, dado: 1, clima: 1 };
    var momentos = sim.events.filter(function (ev) { return MOMENTOS[ev.type]; }).map(function (ev) {
      var txt = ev.text;
      if (ev.type === 'dado') {
        var mine = ev.rolls && ev.rolls[L.playerIdx];
        if (mine) txt += ' · você tirou ' + mine.best + (mine.dice.length > 1 ? ' (' + mine.dice.join(', ') + ')' : '') + (mine.rerolls > 0 ? ' (desempate)' : '');
      }
      var chip = ev.racer >= 0 && L.racers[ev.racer] ? laneChip(L.racers[ev.racer], ev.racer, 'raia--mini') : '';
      return '<li class="tipo-' + esc(ev.type) + (ev.racer === L.playerIdx ? ' voce' : '') + '"><time>' + esc(fmtClock(ev.t)) + '</time>' + chip + '<span>' + esc(txt) + '</span></li>';
    }).join('');

    var broke = state.gold < MIN_ENTRY;
    var actions = broke
      ? '<p class="aviso aviso--perda">Seu Ouro acabou abaixo da menor entrada (' + MIN_ENTRY + '). O treino gratuito não cobra nada e paga de 10 a 30 de Ouro.</p>' +
        '<div class="acoes"><button type="button" class="btn btn--ouro" data-acao="treino">Treino gratuito</button>' +
        '<button type="button" class="btn" data-acao="voltar">Voltar</button></div>'
      : '<div class="acoes"><button type="button" class="btn btn--ouro" data-acao="denovo">Correr de novo</button>' +
        '<button type="button" class="btn" data-acao="voltar">Voltar</button></div>';

    var prizeOf = {};
    if (R.payouts) R.payouts.prizes.forEach(function (p) { prizeOf[p.racer] = p.amount; });
    var rows = order.map(function (ri, k) {
      var r = L.racers[ri], info = sim.racerInfo ? sim.racerInfo[ri] : null;
      var t = sim.finishTimes[ri];
      var gap = k === 0 ? 'vencedor' : '+' + (t - winT).toFixed(2).replace('.', ',') + 's';
      var prize = R.training ? (r.isPlayer ? '+' + R.prize : '—') : (prizeOf[ri] ? fmt(prizeOf[ri]) : '—');
      return '<tr class="' + (r.isPlayer ? 'voce' : '') + '"><td class="pos" aria-label="' + (k + 1) + ' lugar">' + (k + 1) + 'º</td>' +
        '<td><div class="quem"><b>' + laneChip(r, ri, 'raia--mini') + esc(r.horse.name) +
        (r.isPlayer ? ' <span class="tag-voce">VOCÊ</span>' : '') + '</b>' +
        (r.isPlayer ? '' : '<small>' + esc(r.name) + '</small>') +
        '<small>' + esc('Nv ' + r.horse.level + (info ? ' · skills ' + Math.round(info.skillChance * 100) + '%' : '')) + '</small></div></td>' +
        '<td class="num"><span class="tempo">' + fmtSec(t) + '</span><small>' + gap + '</small></td><td class="num">' + prize + '</td></tr>';
    }).join('');

    return '<section class="tela" aria-labelledby="t-resultado">' +
      '<header class="topo topo--fixo"><span class="logo-mini">' + esc(L.trackName) + '</span><span class="saldo" aria-label="Saldo">' + ouroHtml(state.gold) + '</span></header>' +
      '<div class="podio-palco"><canvas data-podio="1" role="img" aria-label="Pódio com os três primeiros"></canvas><div class="podio-nomes">' + names + '</div></div>' +
      '<section class="caixa"><h1 class="manchete" id="t-resultado" tabindex="-1" data-foco>' + head + '</h1>' +
        '<p class="sub">' + sub + '</p>' + balanco +
        '<div class="tela-cabeca"><span class="rotulo">Experiência ' + '<span class="mais">+' + R.xpGain + ' XP</span>' + (R.training ? ' (treino: metade)' : '') + '</span>' +
        xpHtml(R.after.level, R.after.xp) + '</div>' + lvl + '</section>' +
      actions +
      (momentos ? '<section class="caixa" aria-labelledby="t-dados"><h2 class="titulo" id="t-dados">Momentos da corrida</h2>' +
        '<ol class="feed feed--estatica">' + momentos + '</ol></section>' : '') +
      '<section class="caixa" aria-labelledby="t-chegada"><h2 class="titulo" id="t-chegada">Ordem de chegada</h2>' +
        '<div class="rolagem"><table class="tabela"><thead><tr><th>Pos</th><th>Cavalo</th><th class="num">Tempo</th><th class="num">Prêmio</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        '<p class="nota">🎲 Dado da Sorte: a 1/3 e 2/3 da pista o maior dado puxa o clima para o elemento de quem tirou.</p>' +
        '</section>' +
      '</section>';
  }

  // ===========================================================================
  // Ações
  // ===========================================================================
  function startLobby(training) {
    var s = state;
    var lobby = openLobby(training);
    if (state !== s) return; // outra aba gravou um save mais novo durante o persist: adoptExternal já navegou
    ui.lobby = lobby;
    go('largada');
  }

  telaEl.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-acao]') : null;
    if (!b || b.disabled) return;
    var id = b.getAttribute('data-id');
    switch (b.getAttribute('data-acao')) {
      case 'dev-niveis':
        if (!devAtivo() || !state) break;
        var dm = activeMount();
        var alvo = Math.min(E.maxLevel || 50, dm.level + 10);
        var need = 0;
        for (var dl = dm.level; dl < alvo; dl++) need += E.xpToLevel(dl);
        need -= dm.xp;
        if (need > 0) applyXp(dm, need, 9000000 + state.breedCounter);
        persist();
        rerenderKeepScroll();
        break;
      case 'dev-ouro':
        if (!devAtivo() || !state) break;
        state.gold += 1000;
        persist();
        rerenderKeepScroll();
        break;
      case 'dev-cruz':
        if (!devAtivo() || !state) break;
        var dc = activeMount();
        dc.breedLeft = Math.min(4, dc.breedLeft + 1);
        persist();
        rerenderKeepScroll();
        break;
      case 'dev-pedras':
        if (!devAtivo() || !state) break;
        state.pedras += 5;
        persist();
        rerenderKeepScroll();
        break;
      case 'dev-set': {
        // 5 Lendárias +0 do conjunto do clima do elemento da ativa (Neutro: Sol); as peças antigas voltam ao inventário
        if (!devAtivo() || !state) break;
        var ds = activeMount();
        var dw = GD.ELEMENTS[ds.element] ? GD.ELEMENTS[ds.element].weather : null;
        var dSet = dw && hasOwn(GD.GEAR_SETS, dw) ? dw : 'sol';
        if (!ds.equip) ds.equip = emptyEquip();
        GR.SLOTS.forEach(function (sl) { ds.equip[sl] = newItem(sl + '-' + dSet + '-lendario').uid; });
        persist();
        rerenderKeepScroll();
        break;
      }
      case 'aba':
        if (state && hasOwn(SCREEN_KIND, id) && SCREEN_KIND[id] === 'aba') go(id);
        break;
      case 'perfil':
        if (state) go('perfil');
        break;
      case 'loja-tab':
        if (!ui.loja || LOJA_TABS.indexOf(id) < 0) break;
        ui.loja.tab = id; ui.loja.msg = null;
        rerenderKeepScroll(); break;
      case 'comprar': {
        // nunca confia no botão: confere catálogo, flag da loja e Ouro de novo
        if (!ui.loja) break;
        var sC = state;
        persist();                    // sincroniza com outras abas antes de debitar
        if (state !== sC) break;
        var pd = hasOwn(GD.GEAR, id) ? GD.GEAR[id] : null;
        if (!pd || !pd.shop || !(pd.price > 0) || state.gold < pd.price) { rerenderKeepScroll(); break; }
        state.gold -= pd.price;
        newItem(id);
        persist();
        if (state !== sC) break;
        ui.loja.msg = 'Comprou ' + pd.name + '. Equipe na aba Equipamento da montaria.';
        rerenderKeepScroll(); break;
      }
      case 'comprar-pedra': {
        var pn = id === '1' ? 1 : id === String(GE.stoneBundle) ? GE.stoneBundle : 0;
        if (!ui.loja || !pn) break;
        var sP = state;
        persist();
        if (state !== sP) break;
        var pc = pn * GE.stonePrice;
        if (state.gold < pc) { rerenderKeepScroll(); break; }
        state.gold -= pc;
        state.pedras += pn;
        persist();
        if (state !== sP) break;
        ui.loja.msg = 'Comprou ' + pedrasTxt(pn) + ' negra' + (pn === 1 ? '' : 's') + '.';
        rerenderKeepScroll(); break;
      }
      case 'montaria':                // cartão do Estábulo e botão "Ver"
        goMontaria(id, 'status'); break;
      case 'equipar-tela':            // "Equipar" da aba Correr e da largada
        goMontaria(id, 'equip'); break;
      case 'montaria-aba':
        if (!ui.montaria || !MONTARIA_ABAS.some(function (a) { return a.id === id; })) break;
        ui.montaria.aba = id; rerenderKeepScroll(); break;
      case 'montaria-voltar':
      case 'perfil-voltar':
        go(ui.tab); break;
      case 'equip-slot':
        if (!ui.montaria || GR.SLOTS.indexOf(id) < 0) break;
        ui.montaria.equip.slot = ui.montaria.equip.slot === id ? null : id;
        ui.montaria.equip.confirm = null; ui.montaria.equip.msg = null;
        rerenderKeepScroll(); break;
      case 'equipar': {
        var qm = ui.montaria ? mountByUid(ui.montaria.uid) : null;
        var qi = itemByUid(id), qd = qi ? GR.piece(qi.id) : null;
        if (!qm || !qd || isEquipped(id)) break;
        var qe = equipWith(qm, qd.slot, id);
        ui.montaria.equip.confirm = null; ui.montaria.equip.msg = null;
        if (canEquip(qm, qe).ok) { qm.equip = qe; persist(); }
        rerenderKeepScroll(); break;
      }
      case 'tirar': {
        var tm = ui.montaria ? mountByUid(ui.montaria.uid) : null;
        if (!tm || GR.SLOTS.indexOf(id) < 0 || !tm.equip || !tm.equip[id]) break;
        var te = equipWith(tm, id, null);
        ui.montaria.equip.confirm = null; ui.montaria.equip.msg = null;
        if (canEquip(tm, te).ok) { tm.equip = te; persist(); }
        rerenderKeepScroll(); break;
      }
      case 'melhorar': {
        var mi0 = itemByUid(id);
        if (!ui.montaria || !mi0 || !GR.enhanceOdds(mi0.plus) || enhanceLocked(id)) break;
        ui.montaria.equip.confirm = id; ui.montaria.equip.msg = null;
        rerenderKeepScroll(); focusAction('melhorar-nao', id); break;
      }
      case 'melhorar-nao':
        if (ui.montaria) ui.montaria.equip.confirm = null;
        rerenderKeepScroll(); focusAction('melhorar', id); break;
      case 'melhorar-sim': {
        if (!ui.montaria || ui.montaria.equip.confirm !== id) break;
        ui.montaria.equip.confirm = null;
        var sM = state;
        persist();                    // sincroniza com outras abas antes de debitar
        if (state !== sM) break;      // save mais novo adotado: adoptExternal já navegou
        var mi = itemByUid(id);
        var mo = mi ? GR.enhanceOdds(mi.plus) : null;
        if (!mo || state.pedras < mo.cost || enhanceLocked(id)) { rerenderKeepScroll(); break; }
        // paga antes de ver: debita as pedras e avança o contador, só então sorteia (um sorteio por tentativa)
        state.pedras -= mo.cost;
        var mc = state.enhanceCounter;
        state.enhanceCounter += 1;
        var mr = GR.enhance(mi, state.seedBase, mc);
        var mAntes = mi.plus;
        mi.plus = mr.plus;
        persist();
        if (state !== sM) break;
        var mNome = GR.piece(mi.id).name;
        ui.montaria.equip.msg = mr.success ? 'Sucesso! ' + mNome + ' agora é +' + mr.plus
          : mr.plus < mAntes ? 'Falhou e ' + mNome + ' caiu para +' + mr.plus : 'Falhou. ' + mNome + ' continua +' + mr.plus;
        rerenderKeepScroll(); focusAction('melhorar', id); break;
      }
      case 'vender': {
        if (!ui.montaria) break;
        var sV = state;
        persist();
        if (state !== sV) break;
        var vi = itemByUid(id);
        if (!vi || isEquipped(id)) { rerenderKeepScroll(); break; }
        var vp = GR.sellPrice(vi.id);
        state.gold += vp;
        state.items = state.items.filter(function (x) { return x.uid !== id; });
        persist();
        if (state !== sV) break;
        ui.montaria.equip.undo = { item: vi, price: vp };
        ui.montaria.equip.confirm = null;
        ui.montaria.equip.msg = 'Vendida por ' + fmt(vp) + ' de Ouro';
        rerenderKeepScroll(); focusAction('vender-desfazer'); break;
      }
      case 'vender-desfazer': {
        if (!ui.montaria || !ui.montaria.equip.undo) break;
        var un = ui.montaria.equip.undo;
        var sU = state;
        persist();
        if (state !== sU) break;
        ui.montaria.equip.undo = null;
        if (state.gold < un.price) { ui.montaria.equip.msg = 'Sem Ouro para desfazer a venda.'; rerenderKeepScroll(); break; }
        if (itemByUid(un.item.uid)) { rerenderKeepScroll(); break; }
        state.items.push(un.item);
        state.gold -= un.price;
        persist();
        if (state !== sU) break;
        ui.montaria.equip.msg = 'Venda desfeita: ' + GR.piece(un.item.id).name + ' voltou ao inventário';
        rerenderKeepScroll(); break;
      }
      case 'escolher':
        state = newState(id);
        persist();
        go('estabulo');
        break;
      case 'ver-inicial': {
        var card = document.getElementById('ini-' + id);
        if (card) { try { card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest', inline: 'center' }); } catch (e2) { card.scrollIntoView(); } }
        break;
      }
      case 'tier':
        if (state.pending) break;
        state.tier = Number(id); persist(); rerenderKeepScroll(); break;
      case 'procurar':
        if (!state.pending && state.gold < MIN_ENTRY) { rerenderKeepScroll(); break; }
        startLobby(false); break;
      case 'treino':
        startLobby(true); break;
      case 'voltar':
        go('correr'); break;
      case 'largar': {
        var L = ui.lobby;
        if (!L || L.sim) { go('correr'); break; }
        persist();                    // sincroniza com outras abas antes de debitar
        if (ui.lobby !== L) break;    // save mais novo adotado: adoptExternal já navegou para um ponto seguro
        if (!L.training && state.gold < L.fee) { ui.notice = 'Ouro insuficiente para esta entrada.'; state.pending = null; persist(); go('correr'); break; }
        var sAntes = state;
        ui.result = settle(L);
        if (state !== sAntes) { ui.result = null; break; } // conflito no meio da liquidação: descarta o resultado misto
        go('corrida');
        break;
      }
      case 'vel':
        if (raceView) raceView.setSpeed(Number(id));
        Array.prototype.forEach.call(telaEl.querySelectorAll('[data-acao="vel"]'), function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        break;
      case 'pular':
        if (raceView) raceView.skip(); else go('resultado');
        break;
      case 'denovo':
        if (state.gold < MIN_ENTRY) startLobby(true); else startLobby(false);
        break;
      case 'ativar':
        if (state.pending || !mountByUid(id)) break;
        state.activeId = id; persist(); rerenderKeepScroll();
        if (ui.screen === 'montaria') {   // o botão "Ativar" fica desabilitado: o foco iria para o body
          var hf = telaEl.querySelector('[data-foco]');
          if (hf) { try { hf.focus({ preventScroll: true }); } catch (e) { hf.focus(); } }
        }
        break;
      case 'renomear': {
        var rm = mountByUid(id);
        if (!rm) break;
        var nome = window.prompt('Novo nome (2–16 letras)', rm.name);
        if (nome == null) break;
        nome = String(nome).replace(/\s+/g, ' ').trim().slice(0, 16);
        if (nome.length < 2) break;
        rm.name = nome; persist(); rerenderKeepScroll(); break;
      }
      case 'liberar':
        ui.confirmLiberar = id; rerenderKeepScroll(); focusAction('liberar-nao', id); break;
      case 'liberar-nao':
        ui.confirmLiberar = null; rerenderKeepScroll(); focusAction('liberar', id); break;
      case 'liberar-sim':
        ui.confirmLiberar = null;
        if (!state.pending && id !== state.activeId && state.mounts.length > 1 && mountByUid(id)) {
          state.mounts = state.mounts.filter(function (m) { return m.uid !== id; });
          persist();
        }
        if (ui.screen === 'montaria') go(ui.tab); else rerenderKeepScroll();
        break;
      case 'expandir':
        if (state.stableSlots >= BR.stableSlotsMax || state.gold < SLOT_PRICE) { rerenderKeepScroll(); break; }
        state.gold -= SLOT_PRICE; state.stableSlots += 1; persist(); rerenderKeepScroll(); break;
      case 'haras-mine':
        if (!ui.haras || !mountByUid(id)) break;
        ui.haras.mine = id; ui.haras.partner = null; ui.haras.confirmTroca = false; rerenderKeepScroll(); break;
      case 'haras-tab':
        if (!ui.haras || (id !== 'aluguel' && id !== 'minhas')) break;
        ui.haras.tab = id; ui.haras.partner = null; ui.haras.confirmTroca = false; rerenderKeepScroll(); break;
      case 'haras-mode':
        if (!ui.haras || (id !== 'cruzar' && id !== 'troca') || id === ui.haras.mode) break;
        ui.haras.mode = id; ui.haras.partner = null; ui.haras.confirmTroca = false;
        ui.haras.tab = id === 'troca' ? 'minhas' : 'aluguel';
        rerenderKeepScroll(); break;
      case 'haras-partner': {
        var kind = b.getAttribute('data-kind');
        if (!ui.haras || (kind !== 'own' && kind !== 'rent')) break;
        ui.haras.partner = { kind: kind, id: id }; ui.haras.confirmTroca = false; rerenderKeepScroll(); break;
      }
      case 'cruzar': {
        if (!ui.haras || ui.haras.mode !== 'cruzar') break;
        var sC = state;
        persist();                    // sincroniza com outras abas antes de debitar
        if (state !== sC) break;      // save mais novo adotado: adoptExternal já navegou
        var PC = harasPair();
        if (!PC.f || harasProblems(PC).length) { rerenderKeepScroll(); break; }
        state.gold -= PC.price;
        var potro = harasFoal(PC);
        PC.mine.breedLeft -= 1;
        if (PC.kind === 'own') PC.partner.breedLeft -= 1;
        state.mounts.push(potro);
        persist();
        if (state !== sC) break;
        ui.haras.result = potro.uid; ui.haras.partner = null;
        rerenderKeepScroll(); break;
      }
      case 'troca': {
        if (!ui.haras || ui.haras.mode !== 'troca') break;
        var PT = harasPair();
        ui.haras.confirmTroca = !!PT.f && PT.kind === 'own' && !harasProblems(PT).length;
        rerenderKeepScroll(); focusAction('troca-nao'); break;
      }
      case 'troca-nao':
        if (ui.haras) ui.haras.confirmTroca = false;
        rerenderKeepScroll(); focusAction('troca'); break;
      case 'troca-sim': {
        if (!ui.haras || ui.haras.mode !== 'troca' || !ui.haras.confirmTroca) break;
        ui.haras.confirmTroca = false;
        var sT = state;
        persist();
        if (state !== sT) break;
        var PX = harasPair();
        if (!PX.f || PX.kind !== 'own' || harasProblems(PX).length) { rerenderKeepScroll(); break; }
        state.gold -= BR.exchange;
        var potroT = harasFoal(PX);
        var gone = [PX.mine.uid, PX.partner.uid];
        state.mounts = state.mounts.filter(function (m) { return gone.indexOf(m.uid) < 0; });
        state.mounts.push(potroT);
        if (gone.indexOf(state.activeId) >= 0) state.activeId = potroT.uid;
        persist();
        if (state !== sT) break;
        ui.haras.result = potroT.uid; ui.haras.partner = null;
        rerenderKeepScroll(); break;
      }
      case 'haras-ativar':
        if (!ui.haras || state.pending || !mountByUid(ui.haras.result)) break;
        state.activeId = ui.haras.result; persist(); rerenderKeepScroll(); break;
      case 'haras-denovo':
        if (ui.haras) { ui.haras.result = null; ui.haras.partner = null; }
        rerenderKeepScroll(); break;
      case 'reset':
        ui.confirmReset = true; rerenderKeepScroll(); focusAction('reset-nao'); break;
      case 'reset-nao':
        ui.confirmReset = false; rerenderKeepScroll(); focusAction('reset'); break;
      case 'reset-sim':
        ui.confirmReset = false; wipeSave(); state = null; ui.lobby = null; ui.result = null; go('inicial'); break;
    }
  });

  function focusAction(acao, id) {
    var sel = '[data-acao="' + acao + '"]' + (id != null ? '[data-id="' + id + '"]' : '');
    var el = telaEl.querySelector(sel);
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  }
  function rerenderKeepScroll() {
    var y = window.scrollY;
    var active = document.activeElement;
    var acao = active && active.getAttribute && active.getAttribute('data-acao');
    var id = active && active.getAttribute && active.getAttribute('data-id');
    render();
    window.scrollTo(0, y);
    if (acao) focusAction(acao, id);
  }

  // ===========================================================================
  // Laço de animação
  // ===========================================================================
  var lastIdle = 0;
  function loop(now) {
    window.requestAnimationFrame(loop);
    if (raceView) raceView.frame(now);
    if (live.length && !reduced() && now - lastIdle > 70) {
      lastIdle = now;
      var t = now / 1000;
      for (var i = 0; i < live.length; i++) live[i].draw(t);
    }
  }

  // ===========================================================================
  // Início (com suporte opcional a window.claude.hot)
  // ===========================================================================
  // start() ignora data.screen (sempre abre no Estábulo ou no inicial): o snapshot só leva o save
  function snapshot() {
    return { save: state };
  }

  var started = false;
  function start(data) {
    if (started) return;   // nunca dois laços de animação
    started = true;
    readTokens();
    data = data || {};
    state = sanitize(data.save) || sanitize(loadSave());
    ui.screen = state ? 'estabulo' : 'inicial';
    // moldes do PixelLab (embutidos pelo build): decodificam em segundo plano; até lá (ou sem eles, ou
    // com ?semmoldes=1) os cavalos saem do desenho por código. Ao chegarem, a tela é redesenhada — menos
    // a corrida, que redesenha sozinha a cada quadro (re-renderizar recriaria a corrida).
    if (!/[?&]semmoldes=1(&|$)/.test(window.location.search) && window.__MOLDES) {
      SP.loadMolds(window.__MOLDES, function () { if (ui.screen !== 'corrida') rerenderKeepScroll(); });
    }
    try {
      var hot = window.claude && window.claude.hot;
      if (hot && typeof hot.snapshot === 'function') hot.snapshot(snapshot);
    } catch (e) { /* opcional */ }
    render();
    window.requestAnimationFrame(loop);
    // só a largura (ou a densidade) muda o layout fora da corrida: a barra de endereço do celular
    // mudando a altura não reconstrói a tela no meio da rolagem
    var resizeTimer = null, lastW = window.innerWidth, lastDpr = dpr();
    window.addEventListener('resize', function () {
      if (ui.screen === 'corrida') return;
      if (window.innerWidth === lastW && dpr() === lastDpr) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (ui.screen === 'corrida') return;
        lastW = window.innerWidth; lastDpr = dpr();
        rerenderKeepScroll();
      }, 150);
    });
    // outra aba gravou: adota o save mais novo em vez de sobrescrevê-lo depois
    window.addEventListener('storage', function (ev) {
      if (ev.key !== SAVE_KEY && ev.key !== null) return;
      var raw = null;
      try { raw = ev.newValue ? JSON.parse(ev.newValue) : null; } catch (e) { raw = null; }
      if (raw && state && Number(raw.rev) <= state.rev) return;
      adoptExternal(raw);
    });
    // ganchos para testes automatizados
    window.__galope = {
      get state() { return state; }, get ui() { return ui; }, get race() { return raceView; }
    };
  }

  var hotApi = window.claude && window.claude.hot;
  if (hotApi && hotApi.ready) hotApi.ready(start);
  else start((hotApi && hotApi.data) || {});
})();
