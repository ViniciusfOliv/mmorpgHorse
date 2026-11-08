/*
 * sprites.js — camada de pixel art do protótipo MMORPG Horse.
 * Procedural em <canvas>; os cavalos podem vir dos moldes do PixelLab embutidos pelo build (data:).
 *
 * API (global `Sprites` no navegador; module.exports no Node):
 *   Sprites.HORSE_W, Sprites.HORSE_H, Sprites.GALLOP_FRAMES, Sprites.FOOT_Y
 *   Sprites.drawHorse(ctx, x, y, { palette, element, frame, scale, silks, idle, t, jockey, shadow })
 *   Sprites.drawTrack(ctx, { width, height, cameraX, pxPerMeter, lanes, laneTop, laneH, surface,
 *                           finishM, hills, curves, distanceMarkersEvery, t, weather, pixel })
 *   Sprites.drawWeather(ctx, weather, t, width, height)
 *   Sprites.drawTrail(ctx, x, y, element, t, intensity, scale)
 *   Sprites.drawElementIcon(ctx, x, y, element, scale)
 *   Sprites.drawText(ctx, text, x, y, { scale, color, shadow, align })  // fonte pixel 3x5 com acentos
 *   Sprites.PALETTES  // paletas de exemplo
 *   Moldes do PixelLab (recolor por paleta; sem eles, desenho por código):
 *   Sprites.loadMolds(window.__MOLDES, pronto), Sprites.moldsReady, Sprites.ESTILO_POR_ELEMENTO,
 *   Sprites.anchorsFor(element, scale, estado), Sprites.limparCacheMoldes(), Sprites.drawHorseCodigo(...)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Sprites = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ===================================================================
  // Utilidades: cor, hash, canvas
  // ===================================================================
  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    function c(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }
    return '#' + c(r) + c(g) + c(b);
  }
  function mix(a, b, t) {
    var A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  // Sombras puxam para um roxo escuro e luzes para um creme quente (hue shift clássico de pixel art).
  function shade(c, t) { return mix(c, '#24122e', t); }
  function light(c, t) { return mix(c, '#fff4d6', t); }
  function lum(c) { var v = hexToRgb(c); return (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) / 255; }
  function rgba(hex, a) { var v = hexToRgb(hex); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }

  function hash(n) {
    n = n | 0;
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  }
  function hash2(x, y) { return hash(Math.imul(x | 0, 73856093) ^ Math.imul((y | 0) + 7919, 19349663)); }
  function vnoise(x) {
    var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return hash(i) * (1 - u) + hash(i + 1) * u;
  }
  function frac(x) { return x - Math.floor(x); }
  function mod(a, n) { return ((a % n) + n) % n; }

  function makeCanvas(w, h) {
    if (typeof document !== 'undefined' && document.createElement) {
      var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
    }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    throw new Error('Sprites: nenhum canvas disponível neste ambiente');
  }
  function crisp(ctx) {
    ctx.imageSmoothingEnabled = false;
    if ('webkitImageSmoothingEnabled' in ctx) ctx.webkitImageSmoothingEnabled = false;
  }
  // Pinta uma grade de cores (array de '#hex' ou null) num canvas 1:1.
  function gridToCanvas(colors, w, h) {
    var c = makeCanvas(w, h), g = c.getContext('2d');
    var img = g.createImageData(w, h), d = img.data;
    for (var i = 0; i < w * h; i++) {
      var col = colors[i];
      if (!col) continue;
      var v = col.length === 9 ? null : hexToRgb(col);
      if (v) { d[i * 4] = v[0]; d[i * 4 + 1] = v[1]; d[i * 4 + 2] = v[2]; d[i * 4 + 3] = 255; }
      else { // '#rrggbbaa'
        var a = hexToRgb(col.slice(0, 7)); d[i * 4] = a[0]; d[i * 4 + 1] = a[1]; d[i * 4 + 2] = a[2];
        d[i * 4 + 3] = parseInt(col.slice(7), 16);
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function scaleCanvas(src, s) {
    if (s === 1) return src;
    var c = makeCanvas(src.width * s, src.height * s), g = c.getContext('2d');
    crisp(g);
    g.drawImage(src, 0, 0, src.width * s, src.height * s);
    return c;
  }
  // Mapa de pixels (array de strings) -> desenha com fillRect em escala s.
  function drawMap(ctx, map, x, y, s, pal) {
    for (var r = 0; r < map.length; r++) {
      var row = map[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        var col = pal[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x + c * s, y + r * s, s, s);
      }
    }
  }

  // ===================================================================
  // CAVALO — mapas de pixels desenhados à mão
  // ===================================================================
  // Papéis (chars):
  //   c pelagem  s sombra  h luz  d sombra profunda (pernas do lado de lá)
  //   m crina  n crina escura  k crina clara/pontas
  //   a meia/canela (accent)  x meia lado de lá  A lista/focinho (accent)
  //   e olho  f casco  g casco escuro  b couro (rédea)
  //   S sela  q manta (cor do jóquei)  Q debrum branco
  //   H capacete  j camisa (silks)  J camisa sombra  i camisa luz  V óculos
  //   K pele  p culote  P culote sombra  B bota
  var HORSE_W = 40, HORSE_H = 32, FOOT_Y = 31; // FOOT_Y: linha nativa onde os cascos tocam o chão (base do sprite)
  // pontos úteis em pixels nativos (multiplique pela escala): traseira p/ rastro, focinho, sela
  var ANCHORS = { rear: [8, 14], nose: [38, 8], saddle: [18, 10] };

  // Cabeça + pescoço (galope e parado compartilham). origem x=21 y=3
  var HEAD = {
    x: 21, y: 3, map: [
      '..........c........',
      '.........hcs.......',
      '........hhhcc......',
      '.......hhcccecA....',
      '......hhcccccccA...',
      '.....hhcccccsccA...',
      '....hcccccsscccsA..',
      '...hcccccs.ssscs...',
      '..hcccccss.........',
      '.hcccccccss........'
    ]
  };

  // Tronco. origem x=9 y=11
  var BODY = {
    x: 9, y: 11, map: [
      '...hhhh................',
      '..hhhhhhhhhhhcccccccccc',
      '.hhhhcccccccccccccccccc',
      '.hhccccccccccccsccccccc',
      '.cccccccccccccccscccccc',
      '.sccccccscccccccsccccss',
      '.scccccccsccccccccccss.',
      '..sccccccsccccccccccss.',
      '..sssss.ssssssssssssss.',
      '...ssss.....sssssssss..'
    ]
  };

  // Sela + manta (número). origem x=14 y=11
  var SADDLE = {
    x: 14, y: 11, map: [
      '..TSSS..',
      'qqqqqqq.',
      'qqQQqqq.',
      'JJJJJJJ.'
    ]
  };

  // Jóquei agachado (galope). origem x=14 y=2. Braço em camada própria (contorno interno).
  var JOCKEY_RUN = {
    x: 14, y: 2, map: [
      '........HHH.',
      '.......HHHHH',
      '.......HHVK.',
      '........KK..',
      '..iiiiiii...',
      '.ijjjjjjjj..',
      '.pJJJJJJ....',
      '.pppp.......',
      '...pppp.....',
      '.....Ppp....',
      '......RR....',
      '......BBB...'
    ]
  };
  var ARM_RUN = { x: 22, y: 7, map: [
    'j...',
    'jj..',
    '.jj.',
    '..KK'] };

  // Jóquei sentado ereto (parado). origem x=14 y=1
  var JOCKEY_IDLE = {
    x: 14, y: 1, map: [
      '...HHH....',
      '..HHHHH...',
      '..HHVK....',
      '...KK.....',
      '..iijj....',
      '..ijjjj...',
      '..jjjjj...',
      '..jjJJ....',
      '..JJJ.....',
      '.ppp......',
      '.pppppp...',
      '.....Pp...',
      '.....RR...',
      '.....BBB..'
    ]
  };
  var ARM_IDLE = { x: 19, y: 6, map: [
    'j...',
    'jj..',
    '.jj.',
    '..jK',
    '...K'] };

  // ---- Pernas: poses (topo na linha 18). dx relativo ao ponto de encaixe.
  var LEG_TOP = 18;
  var FORE = {
    PLANT: { dx: 0, map: [
      'ccc.',
      'ccc.',
      'ccs.',
      'ccs.',
      'ccs.',
      '.cs.',
      '.ccs',
      '.cs.',
      '.cs.',
      '.cs.',
      '.aa.',
      '.ff.',
      '.fff'] },
    LAND: { dx: 0, map: [
      'ccc.....',
      'ccc.....',
      'ccs.....',
      'cccs....',
      '.ccs....',
      '.ccs....',
      '..ccs...',
      '...cs...',
      '...cs...',
      '....cs..',
      '....aa..',
      '....ff..',
      '....fff.'] },
    REACH: { dx: 0, map: [
      'ccc........',
      'cccc.......',
      '.cccs......',
      '..cccs.....',
      '...cccs....',
      '.....ccs...',
      '......ccs..',
      '.......cs..',
      '........aa.',
      '........fff',
      '.........f.'] },
    LIFT: { dx: 0, map: [
      'ccc.....',
      'cccc....',
      '.cccss..',
      '..ccccs.',
      '....cccs',
      '.....cs.',
      '.....cs.',
      '....aa..',
      '....ff..'] },
    FOLD: { dx: 0, map: [
      'ccc...',
      'cccc..',
      '.cccs.',
      '..cccs',
      '...ccs',
      '..aas.',
      '.ffa..',
      '.f....'] },
    PUSH: { dx: -3, map: [
      '...ccc',
      '...ccc',
      '...ccs',
      '..ccs.',
      '..ccs.',
      '..cs..',
      '.ccs..',
      '.cs...',
      '.cs...',
      'cs....',
      'aa....',
      'ff....',
      'fff...'] }
  };
  var HIND = {
    PLANT: { dx: 0, map: [
      'ccccc',
      'ccccc',
      'cccc.',
      'cccs.',
      'ccs..',
      'cs...',
      '.cs..',
      '.cs..',
      '.cs..',
      '.cs..',
      '.aa..',
      '.ff..',
      '.fff.'] },
    LAND: { dx: 0, map: [
      'ccccc...',
      'ccccc...',
      '.cccc...',
      '.cccs...',
      '..ccs...',
      '..cs....',
      '..ccs...',
      '...cs...',
      '...cs...',
      '....cs..',
      '....aa..',
      '....ff..',
      '....fff.'] },
    REACH: { dx: 0, map: [
      'ccccc....',
      'cccccs...',
      '.ccccs...',
      '..cccs...',
      '..ccs....',
      '...ccs...',
      '....ccs..',
      '.....cs..',
      '......aa.',
      '......ff.',
      '.......f.'] },
    PUSH: { dx: -3, map: [
      '...ccccc',
      '...ccccc',
      '...cccc.',
      '..cccs..',
      '..ccs...',
      '.ccs....',
      '.cs.....',
      '.cs.....',
      'cs......',
      'cs......',
      'aa......',
      'ff......',
      'fff.....'] },
    EXTEND: { dx: -7, map: [
      '.......ccccc',
      '......ccccc.',
      '....ccccss..',
      '..cccss.....',
      '.ccs........',
      'cs..........',
      'aa..........',
      'ff..........'] },
    FOLD: { dx: -1, map: [
      '.ccccc',
      '.ccccc',
      '.cccc.',
      '.ccs..',
      'ccs...',
      'cs....',
      '.cs...',
      '..aa..',
      '..ff..'] },
    // parado, descansando o posterior: jarrete dobrado e pinça do casco apoiada
    REST: { dx: 0, map: [
      'ccccc',
      'ccccc',
      'cccc.',
      '.ccs.',
      '.ccs.',
      '..cs.',
      '..cs.',
      '..cs.',
      '..cs.',
      '..aa.',
      '..ff.',
      '.ff..'] }
  };

  // Encaixe das pernas (x da coluna 0 do mapa quando dx=0)
  var ATTACH = { nf: 26, ff: 24, nh: 12, fh: 14 };
  var ATTACH_IDLE = { nf: 26, ff: 23, nh: 11, fh: 14 };

  // Ciclo de galope (6 quadros). Ordem de apoio: posterior perto, posterior longe, anterior perto, anterior longe.
  var GALLOP = [
    { nh: 'REACH', fh: 'FOLD', nf: 'FOLD', ff: 'PUSH', bob: -1, head: -1 },
    { nh: 'LAND', fh: 'REACH', nf: 'LIFT', ff: 'FOLD', bob: -1, head: 0 },
    { nh: 'PLANT', fh: 'LAND', nf: 'REACH', ff: 'LIFT', bob: 0, head: 0 },
    { nh: 'PUSH', fh: 'PLANT', nf: 'LAND', ff: 'REACH', bob: 0, head: 1 },
    { nh: 'EXTEND', fh: 'PUSH', nf: 'PLANT', ff: 'LAND', bob: 1, head: 1 },
    { nh: 'FOLD', fh: 'EXTEND', nf: 'PUSH', ff: 'PLANT', bob: 0, head: 0 }
  ];

  // ---- Crinas e caudas por estilo de elemento -----------------------
  // Crina: origem x=19 y=2 (crista do pescoço desce de (29,5) até (22,12)). z = brilho sem contorno.
  var MANE = {
    plain: [
      ['', '',
       '..........mm',
       '.........kmn',
       '.......kmmn',
       '.......kmn',
       '.....kmmn',
       '.....kmn',
       '...kmmn',
       '...kmn',
       '...mn'],
      ['', '',
       '..........mm',
       '........kmmn',
       '........kmn',
       '......kmmn',
       '......kmn',
       '....kmmn',
       '....kmn',
       '..kmmn',
       '...mn']
    ],
    flame: [
      ['.........k',
       '......k..km',
       '......km.kmm',
       '....k.kmmzmn',
       '....kmkmzmn',
       '..k.kmzmmn',
       '..kmkmzmn',
       '...kmzmn',
       '.kmkmmn',
       '..kmmn',
       '...mn'],
      ['......k',
       '......km.k',
       '....k.kmkmm',
       '....kmkmmzmn',
       '..k.kmmzmmn',
       '..kmkmzmmn',
       '.k.kmzmmn',
       '.kmkmmmn',
       '..kmmmn',
       '..kmmn',
       '...mn']
    ],
    wave: [
      ['', '',
       '..........m',
       '.....kk..kmn',
       '....kmmnkmmn',
       '....mn.kmmn',
       '..kk..kmmn',
       '.kmmnkmmn',
       '.mn.kmmn',
       '...kmmn',
       '...mn'],
      ['', '',
       '.........km',
       '.........kmn',
       '......kk.kmn',
       '.....kmmnmmn',
       '.....mn.kmn',
       '...kk.kmmn',
       '..kmmnkmn',
       '..mn.kmn',
       '...mn']
    ],
    leaf: [
      ['',
       '.........k',
       '......k..km',
       '......mk.mmn',
       '....k.nmkmn',
       '....mk.kmmn',
       '..k.nmkmmn',
       '..mk.kmmn',
       '..nmkmmn',
       '...kmmn',
       '...mn'],
      ['',
       '..........k',
       '.......k.kmn',
       '.......mkmmn',
       '.....k.nmmn',
       '.....mk.kmn',
       '...k.nmkmn',
       '...mk.kmmn',
       '...nmkmmn',
       '...kmmn',
       '...mn']
    ]
  };

  // Cauda em galope: origem x=1 y=10 (inserção em ~(11,12))
  var TAIL_RUN = {
    plain: [
      ['',
       '.....kmmm..',
       '...kmmmmmmm',
       '..kmmnnnmm.',
       '....mnn....',
       '.....n.....'],
      ['',
       '......mmm..',
       '....kmmmmmm',
       '...kmmnnnm.',
       '..kmnn.....',
       '...nn......'],
      ['',
       '....kmm....',
       '...kmmmmmmm',
       '....mmnnmm.',
       '....mnn....',
       '.....n.....']
    ],
    flame: [
      ['.k...k.....',
       '.mk.kmk.k..',
       'kmzkmzmkmmm',
       '.kmmmmnnmm.',
       '..kmnn.....',
       '....n......'],
      ['...k...k...',
       '..kmk.kmk..',
       '.kmzmkmzmmm',
       'kmmmmmnnmm.',
       '.kmnn......',
       '..n........'],
      ['k....k.....',
       'mk..kmk.k..',
       'kmkkmzmkmmm',
       '.kmzmmnnmm.',
       '...kmn.....',
       '...n.......']
    ],
    wave: [
      ['',
       '.kk..kmmm..',
       'kmmnkmmmmmm',
       'mn.kmmnnmm.',
       '..kmnn.....',
       '..nn.......'],
      ['',
       '..kk.kmmm..',
       '.kmmnkmmmmm',
       '.mn.kmnnmm.',
       '.kkmnn.....',
       'kmn........'],
      ['.kk........',
       'kmmn.kmmm..',
       'mn.kmmmmmmm',
       '..kmmnnnmm.',
       '..mnn......',
       '...n.......']
    ],
    leaf: [
      ['',
       '.k...kmm...',
       'kmk.kmmmmmm',
       '.nmkmmnnmm.',
       '..nmkn.....',
       '...n.......'],
      ['',
       '..k..kmm...',
       '.kmk.kmmmmm',
       'k.nmkmnnmm.',
       'mk.nmn.....',
       'nm..n......'],
      ['.k.........',
       'kmk.kmm....',
       '.nmkmmmmmmm',
       '..kmmnnnmm.',
       '.kmnn......',
       '..n........']
    ]
  };

  // Cauda parada (pendurada, abanando): origem x=5 y=12
  var TAIL_IDLE_PLAIN = [
    ['....kmm',
     '...kmmn',
     '...mmn.',
     '..kmmn.',
     '..mmnn.',
     '..mmn..',
     '..mnn..',
     '..mnn..',
     '..nn...',
     '..n....'],
    ['....kmm',
     '...kmmn',
     '..kmmn.',
     '..mmn..',
     '.kmnn..',
     '.mmn...',
     '.mnn...',
     '.mn....',
     '.nn....',
     'n......'],
    ['....kmm',
     '....mmn',
     '....mmn',
     '....kmn',
     '...kmmn',
     '...mmnn',
     '....mnn',
     '....mnn',
     '.....nn',
     '......n']
  ];
  // Variações por elemento: fogo tem pontas acesas, água com espuma, grama com folhas.
  function restyleTail(maps, fn) { return maps.map(function (m) { return m.map(fn); }); }
  var TAIL_IDLE = {
    plain: TAIL_IDLE_PLAIN,
    flame: restyleTail(TAIL_IDLE_PLAIN, function (row, i) { return i > 6 ? row.replace(/n/g, 'k') : i > 3 ? row.replace(/m/, 'z') : row; }),
    wave: restyleTail(TAIL_IDLE_PLAIN, function (row, i) { return i === 8 || i === 4 ? row.replace(/n/, 'k') : row; }),
    leaf: restyleTail(TAIL_IDLE_PLAIN, function (row, i) { return i % 3 === 1 ? row.replace(/\.(?=k|m)/, 'k') : row; })
  };

  var ELEMENT_STYLE = { fogo: 'flame', agua: 'wave', grama: 'leaf', neutro: 'plain' };

  // ===================================================================
  // Composição + contorno automático em camadas
  // ===================================================================
  // Grupos que recebem linha separadora quando um está atrás do outro.
  var SEP = {
    'farleg|tail': 1, 'farleg|horse': 1, 'farleg|nearleg': 1, 'farleg|farleg': 1, 'farleg|mane': 1,
    'tail|horse': 1, 'tail|nearleg': 1, 'nearleg|nearleg': 1,
    'horse|saddle': 1, 'horse|jockey': 1, 'mane|jockey': 1, 'saddle|jockey': 1, 'tail|jockey': 1,
    'jockey|jarm': 1, 'horse|jarm': 1, 'mane|jarm': 1, 'saddle|jarm': 1
  };
  var NO_OUTLINE = { z: 1 }; // brilhos que não ganham contorno externo

  function compose(layers) {
    var N = HORSE_W * HORSE_H;
    var role = new Array(N).fill(null), zl = new Int16Array(N).fill(-1);
    for (var li = 0; li < layers.length; li++) {
      var L = layers[li], map = L.map;
      for (var r = 0; r < map.length; r++) {
        var row = map[r];
        for (var c = 0; c < row.length; c++) {
          var ch = row[c];
          if (ch === '.' || ch === ' ') continue;
          var x = L.x + c, y = L.y + r;
          if (x < 0 || y < 0 || x >= HORSE_W || y >= HORSE_H) continue;
          if (L.remap && L.remap[ch]) ch = L.remap[ch];
          role[y * HORSE_W + x] = ch; zl[y * HORSE_W + x] = li;
        }
      }
    }
    return { role: role, zl: zl, layers: layers };
  }

  function outlineAndColor(comp, colors) {
    var W = HORSE_W, H = HORSE_H, role = comp.role, zl = comp.zl, layers = comp.layers;
    var out = new Array(W * H).fill(null);
    var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = y * W + x, ch = role[i];
        if (ch) {
          var internal = false;
          for (var k = 0; k < 4; k++) {
            var nx = x + nb[k][0], ny = y + nb[k][1];
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            var j = ny * W + nx;
            if (!role[j] || zl[j] <= zl[i]) continue;
            var ga = layers[zl[i]].group, gb = layers[zl[j]].group;
            if (SEP[ga + '|' + gb] && (ga !== gb || zl[i] !== zl[j])) { internal = true; break; }
          }
          out[i] = internal ? colors.oi : (colors[ch] || '#ff00ff');
        } else {
          for (var k2 = 0; k2 < 4; k2++) {
            var mx = x + nb[k2][0], my = y + nb[k2][1];
            if (mx < 0 || my < 0 || mx >= W || my >= H) continue;
            var r2 = role[my * W + mx];
            if (r2 && !NO_OUTLINE[r2]) { out[i] = colors.o; break; }
          }
        }
      }
    }
    return out;
  }

  // ---- Paletas -------------------------------------------------------
  var ELEMENT_MANE = {
    fogo: { n: '#b8261a', k: '#ffe04a', z: '#fff7b0' },
    agua: { n: '#1d74a8', k: '#d4fbff', z: '#ffffff' },
    grama: { n: '#1f5a2a', k: '#a8e05c', z: '#d9ff9a' }
  };

  function buildColors(pal, element, silks, skin) {
    var coat = pal.coat || '#a0704a', cs = pal.coatShade || shade(coat, 0.35);
    var mane = pal.mane || shade(coat, 0.5), acc = pal.accent || '#f2ead8';
    var em = ELEMENT_MANE[element] || {};
    var outline = mix(shade(cs, 0.75), '#140c16', 0.6);
    var silkS = shade(silks, 0.32), silkL = light(silks, 0.3);
    var lightAcc = lum(acc) > 0.5;
    return {
      o: outline,
      oi: mix(outline, cs, 0.25),
      c: coat, s: cs, h: light(coat, 0.22), d: shade(cs, 0.35),
      m: mane, n: em.n || shade(mane, 0.35), k: em.k || light(mane, 0.3), z: em.z || light(mane, 0.6),
      a: acc, x: shade(acc, 0.3),
      A: lightAcc ? acc : mix(cs, acc, 0.6),
      e: '#140a10',
      f: '#4a3c36', g: '#2e2428',
      b: '#3b2216',
      S: '#5b3520', T: '#8a5634',
      q: silks, Q: '#f3efe6',
      H: silks, j: silks, J: silkS, i: silkL, V: '#2b3a4a',
      K: skin || '#e3a878', L: shade(skin || '#e3a878', 0.25),
      p: '#f3efe6', P: '#c7bfb0', B: '#2a2024', R: '#b0703a'
    };
  }

  var FAR_REMAP = { c: 's', h: 'c', s: 'd', a: 'x', f: 'g' };

  // Monta as camadas de um quadro.
  function horseLayers(o) {
    var style = ELEMENT_STYLE[o.element] || 'plain';
    var layers = [];
    var idle = o.idle;
    var bob = o.bob || 0, headDy = o.head || 0;
    var att = idle ? ATTACH_IDLE : ATTACH;
    function leg(set, poseName, key, group) {
      var p = set[poseName];
      layers.push({ map: p.map, x: att[key] + p.dx, y: LEG_TOP, group: group, remap: group === 'farleg' ? FAR_REMAP : null });
    }
    // pernas do lado de lá
    leg(HIND, o.legs.fh, 'fh', 'farleg');
    leg(FORE, o.legs.ff, 'ff', 'farleg');
    // cauda
    var tails = idle ? TAIL_IDLE[style] : TAIL_RUN[style];
    var tmap = tails[o.tailVar % tails.length];
    layers.push({ map: tmap, x: idle ? 5 : 1, y: (idle ? 12 : 10) + bob, group: 'tail' });
    // corpo + cabeça
    layers.push({ map: BODY.map, x: BODY.x, y: BODY.y + bob, group: 'horse' });
    var headMap = HEAD.map;
    if (o.blink) headMap = headMap.map(function (r) { return r.replace('e', 's'); });
    if (o.ear) headMap = ['.........c.........', '.........hcs.......'].concat(headMap.slice(2));
    layers.push({ map: headMap, x: HEAD.x, y: HEAD.y + bob + headDy, group: 'horse' });
    // crina
    var manes = MANE[style];
    layers.push({ map: manes[o.maneVar % manes.length], x: 19, y: 2 + bob + headDy, group: 'mane' });
    // pernas do lado de cá
    leg(HIND, o.legs.nh, 'nh', 'nearleg');
    leg(FORE, o.legs.nf, 'nf', 'nearleg');
    if (o.jockey) {
      layers.push({ map: SADDLE.map, x: SADDLE.x, y: SADDLE.y + bob, group: 'saddle' });
      var J = idle ? JOCKEY_IDLE : JOCKEY_RUN, AR = idle ? ARM_IDLE : ARM_RUN;
      layers.push({ map: J.map, x: J.x, y: J.y + bob, group: 'jockey' });
      layers.push({ map: AR.map, x: AR.x, y: AR.y + bob, group: 'jarm' });
    }
    return layers;
  }

  // ===================================================================
  // Cache de quadros renderizados
  // ===================================================================
  // Cache LRU limitado por bytes (largura × altura × 4). Os quadros base ficam em 1x; drawHorse
  // amplia na hora com imageSmoothingEnabled=false (vizinho mais próximo, sem custo de memória).
  // Antes cada escala virava um canvas próprio e a memória crescia ~5 MB por corrida em telas DPR 3.
  function LruCanvasCache(maxBytes) { this.map = new Map(); this.bytes = 0; this.max = maxBytes; }
  LruCanvasCache.prototype.get = function (k) {
    var v = this.map.get(k);
    if (v) { this.map.delete(k); this.map.set(k, v); }
    return v;
  };
  LruCanvasCache.prototype.set = function (k, c) {
    var old = this.map.get(k);
    if (old) { this.bytes -= old.width * old.height * 4; this.map.delete(k); }
    this.map.set(k, c);
    this.bytes += c.width * c.height * 4;
    while (this.bytes > this.max && this.map.size > 1) {
      var first = this.map.keys().next().value, fc = this.map.get(first);
      this.map.delete(first);
      this.bytes -= fc.width * fc.height * 4;
    }
  };
  var baseCache = new LruCanvasCache(12 * 1024 * 1024);    // ~2400 quadros de 40x32
  var scaledCache = new LruCanvasCache(24 * 1024 * 1024);  // só para quem chama horseCanvas() direto
  function palKey(p) { return [p.coat, p.coatShade, p.mane, p.accent].join(','); }

  function horseState(opts) {
    var t = opts.t || 0;
    var st = { element: opts.element || 'neutro', jockey: opts.jockey !== false, idle: !!opts.idle };
    if (st.idle) {
      var breath = Math.sin(t * Math.PI * 2 / 2.8);
      st.bob = breath > 0.55 ? -1 : 0;
      st.head = -1;
      var tp = mod(t, 4.2);
      st.tailVar = tp < 3.0 ? 0 : tp < 3.3 ? 1 : tp < 3.6 ? 2 : tp < 3.9 ? 1 : 0;
      st.blink = mod(t, 3.7) < 0.14;
      st.ear = mod(t, 5.3) > 4.95;
      st.maneVar = mod(st.element === 'fogo' ? Math.floor(t * 6) : Math.floor(t * 0.8), 2);
      // troca o apoio (descansa um posterior) e de vez em quando abaixa a cabeça
      var rest = mod(t, 6.4) > 3.4;
      var np = mod(t, 7.1);
      if (np > 5.7 && np < 6.5) st.head = np > 5.9 && np < 6.3 ? 1 : 0;
      st.legs = { nf: 'PLANT', ff: 'PLANT', nh: rest ? 'REST' : 'PLANT', fh: 'PLANT' };
      st.key = 'I' + st.bob + st.tailVar + (st.blink ? 1 : 0) + (st.ear ? 1 : 0) + st.maneVar + (rest ? 1 : 0) + st.head;
    } else {
      var f = mod(Math.floor(opts.frame || 0), GALLOP.length);
      var G = GALLOP[f];
      st.bob = G.bob; st.head = G.head;
      st.legs = G;
      st.tailVar = f % 3;
      st.maneVar = mod(Math.floor(f / 2) + (st.element === 'fogo' ? Math.floor(t * 10) : 0), 2);
      st.key = 'R' + f + st.maneVar;
    }
    return st;
  }

  function horseBase(opts) {
    var pal = opts.palette || PALETTES.neutro;
    var silks = opts.silks || '#d8353b';
    var st = horseState(opts);
    var baseKey = palKey(pal) + '|' + st.element + '|' + silks + '|' + (st.jockey ? 1 : 0) + '|' + st.key;
    var base = baseCache.get(baseKey);
    if (!base) {
      var colors = buildColors(pal, st.element, silks, opts.skin);
      var comp = compose(horseLayers(st));
      base = gridToCanvas(outlineAndColor(comp, colors), HORSE_W, HORSE_H);
      baseCache.set(baseKey, base);
    }
    return { canvas: base, key: baseKey };
  }

  function horseCanvas(opts) {
    var scale = Math.max(1, Math.round(opts.scale || 1));
    var b = horseBase(opts);
    if (scale === 1) return b.canvas;
    var key = b.key + '|x' + scale;
    var hit = scaledCache.get(key);
    if (hit) return hit;
    var scaled = scaleCanvas(b.canvas, scale);
    scaledCache.set(key, scaled);
    return scaled;
  }

  // Desenho por código (sempre disponível): usado quando os moldes não carregaram ou a pose não tem molde.
  function drawHorseCodigo(ctx, x, y, opts) {
    opts = opts || {};
    var s = Math.max(1, Math.round(opts.scale || 1));
    x = Math.round(x); y = Math.round(y);
    crisp(ctx);
    if (opts.shadow !== false) {
      ctx.fillStyle = 'rgba(20,10,20,0.28)';
      var sy = y + (FOOT_Y - 1) * s;
      ctx.fillRect(x + 9 * s, sy, 22 * s, s);
      ctx.fillRect(x + 11 * s, sy + s, 18 * s, s);
    }
    ctx.drawImage(horseBase(opts).canvas, x, y, HORSE_W * s, HORSE_H * s);
  }
  function cacheStats() { return { baseBytes: baseCache.bytes, baseCount: baseCache.map.size, scaledBytes: scaledCache.bytes, scaledCount: scaledCache.map.size }; }

  // ===================================================================
  // MOLDES DO PIXELLAB — recolor por paleta em tempo de execução
  // ===================================================================
  // Um molde é um PNG 64×64 em tons de cinza em que cada pixel guarda um PAPEL (cinza = papel × 25):
  //   0 transparente · 1 contorno · 2 pelo · 3 sombra do pelo · 4 crina · 5 sombra da crina
  //   6 detalhe · 7 seda · 8 pele · 9 sela.
  // Cada estilo (chamas, ondas, folhas, lisa) tem três estados: retrato (sem jóquei), parado (com jóquei)
  // e galope (N quadros). O build embute PNGs e âncoras em window.__MOLDES; loadMolds decodifica os PNGs
  // num canvas e guarda os índices. drawHorse pinta cada papel com as cores da montaria e do corredor.
  //
  // Encaixe no sprite por código (40×32, escala k): o molde é desenhado em escala inteira
  // S = max(1, round(k × 40 / larguraUtil)), com
  //   • a última linha dos cascos (o maior footY entre os quadros do estado) terminando em y + (FOOT_Y + 1)·k,
  //     a mesma linha de chão do sprite por código;
  //   • a coluna do focinho (mediana de nose.x entre os quadros do estado) em x + NOSE·k (NOSE = 38).
  // As referências são POR ESTADO, não por quadro: por quadro o cavalo tremeria no galope (cauda e patas
  // mudam rear e footY). Como o focinho cai no mesmo NOSE, a câmera e as etiquetas da corrida não mudam;
  // anchorsFor() converte rear/saddle do molde para as unidades do sprite por código.
  var ESTILO_POR_ELEMENTO = { fogo: 'chamas', agua: 'ondas', grama: 'folhas', neutro: 'lisa' };
  var ESTILOS_MOLDE = ['chamas', 'ondas', 'folhas', 'lisa'];
  var MOLDE_CORES_FIXAS = { contorno: '#1a1405', pele: '#e8b48a', sela: '#5a3a22' };
  var moldes = null;       // estilo -> { w, h, frames, larguraUtil, retrato, parado, galope: [], estados }
  var moldsOk = false;
  var moldesGeracao = 0;   // descarta um carregamento antigo se loadMolds for chamado de novo
  // 64×64×4 = 16 KB por entrada; o teto em bytes é só uma rede de segurança (go() limpa ao trocar de tela)
  var moldCache = new LruCanvasCache(8 * 1024 * 1024);
  LruCanvasCache.prototype.clear = function () { this.map.clear(); this.bytes = 0; };

  function estiloDe(element) { return ESTILO_POR_ELEMENTO[element] || 'lisa'; }
  function moldScale(k, larguraUtil) { return Math.max(1, Math.round(k * 40 / larguraUtil)); }
  function mediana(v) {
    var s = v.slice().sort(function (a, b) { return a - b; }), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function ponto(p) { return p && p.length === 2 && isFinite(p[0]) && isFinite(p[1]); }

  // Referência de um estado a partir das âncoras dos seus quadros (calculada uma vez, ao carregar).
  function refEstado(lista) {
    var foot = -1, nx = [], ny = [], rx = [], ry = [], sx = [], sy = [], cx = [];
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (!a || !isFinite(a.footY) || !ponto(a.nose) || !ponto(a.rear) || !a.bbox) throw new Error('âncora inválida');
      foot = Math.max(foot, a.footY);
      nx.push(a.nose[0]); ny.push(a.nose[1]); rx.push(a.rear[0]); ry.push(a.rear[1]);
      if (ponto(a.saddle)) { sx.push(a.saddle[0]); sy.push(a.saddle[1]); }
      cx.push(a.bbox.x + a.bbox.w / 2);
    }
    return {
      footY: foot,
      nose: [Math.round(mediana(nx)), Math.round(mediana(ny))],
      rear: [Math.round(mediana(rx)), Math.round(mediana(ry))],
      saddle: sx.length ? [Math.round(mediana(sx)), Math.round(mediana(sy))] : null,
      centro: mediana(cx)   // centro horizontal do corpo (para a sombra)
    };
  }

  // PNG em data: URL -> índices de papel (round(cinza / 25)); falha se o tamanho ou os tons não baterem.
  function decodificaMolde(url, w, h, ok, falha) {
    var img = new Image();
    img.onload = function () {
      try {
        if (img.width !== w || img.height !== h) throw new Error('tamanho do molde');
        var c = makeCanvas(w, h), g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        var d = g.getImageData(0, 0, w, h).data, idx = new Array(w * h);
        for (var i = 0; i < w * h; i++) {
          var r = d[i * 4], v = Math.round(r / 25);
          if (d[i * 4 + 3] < 128) v = 0;
          else if (v > 9 || Math.abs(r - v * 25) > 3) throw new Error('tom de cinza fora dos papéis');
          idx[i] = v;
        }
        ok(idx);
      } catch (e) { falha(); }
    };
    img.onerror = function () { falha(); };
    img.src = url;
  }

  // tabela = { estilos: { chamas: { json, retrato, parado, galope: [...] }, ... } } (window.__MOLDES).
  // Só liga os moldes quando os 4 estilos carregam; qualquer falha deixa moldsReady = false, sem exceção.
  function loadMolds(tabela, pronto) {
    var geracao = ++moldesGeracao;
    moldsOk = false; api.moldsReady = false; moldes = null; moldCache.clear();
    var est = tabela && tabela.estilos;
    if (!est || typeof Image === 'undefined' || typeof document === 'undefined') return;
    var novos = {}, pendentes = 1, falhou = false;   // 1 = o próprio laço abaixo (fecha no fim)
    function falha() { falhou = true; }
    function fim() {
      pendentes--;
      if (falhou || pendentes > 0 || geracao !== moldesGeracao) return;
      moldes = novos; moldsOk = true; api.moldsReady = true;
      if (typeof pronto === 'function') pronto();
    }
    try {
      ESTILOS_MOLDE.forEach(function (nome) {
        var e = est[nome], J = e && e.json;
        if (!J || !e.retrato || !e.parado || !e.galope) throw new Error('estilo ausente: ' + nome);
        var frames = J.frames | 0, A = J.ancoras || {};
        if (!(frames > 0) || e.galope.length !== frames || !(J.w > 0) || !(J.h > 0) || !(J.larguraUtil > 0)) throw new Error('molde inválido: ' + nome);
        var lista = [];
        for (var f = 0; f < frames; f++) lista.push(A['galope-' + f]);
        var M = novos[nome] = {
          w: J.w, h: J.h, frames: frames, larguraUtil: J.larguraUtil, retrato: null, parado: null, galope: [],
          estados: { retrato: refEstado([A.retrato]), parado: refEstado([A.parado]), galope: refEstado(lista) }
        };
        function carrega(url, guarda) {
          pendentes++;
          decodificaMolde(url, M.w, M.h, function (idx) { guarda(idx); fim(); }, function () { falha(); fim(); });
        }
        carrega(e.retrato, function (idx) { M.retrato = idx; });
        carrega(e.parado, function (idx) { M.parado = idx; });
        e.galope.forEach(function (url, q) { carrega(url, function (idx) { M.galope[q] = idx; }); });
      });
    } catch (ex) {
      falhou = true;   // as decodificações já pedidas terminam sem ligar os moldes
    }
    fim();
  }

  // Estado do molde para as opções do drawHorse; null = pose sem molde (galope sem jóquei): usa o código.
  function estadoMolde(o) {
    if (o.retrato) return 'retrato';
    if (o.jockey === false) return o.idle ? 'retrato' : null;
    return o.idle ? 'parado' : 'galope';
  }

  // Cores por papel (índice 0–9) para as opções do drawHorse.
  function coresMolde(o) {
    var pal = o.palette || PALETTES.neutro;
    var coat = pal.coat || '#a0704a', mane = pal.mane || shade(coat, 0.5);
    return [null, MOLDE_CORES_FIXAS.contorno, coat, pal.coatShade || shade(coat, 0.35), mane, shade(mane, 0.35),
      pal.accent || '#f2ead8', o.silks || '#d8353b', MOLDE_CORES_FIXAS.pele, MOLDE_CORES_FIXAS.sela];
  }

  function pintaIndices(idx, w, h, cores) {
    var rgb = cores.map(function (c) { return c ? hexToRgb(c) : null; });
    var c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (var i = 0; i < w * h; i++) {
      var v = rgb[idx[i]];
      if (!v) continue;
      d[i * 4] = v[0]; d[i * 4 + 1] = v[1]; d[i * 4 + 2] = v[2]; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
  function indicesMolde(M, estado, quadro) { return estado === 'galope' ? M.galope[quadro] : M[estado]; }

  // Canvas 1× recolorido; a escala fica no drawImage (vizinho mais próximo), então a chave não leva a
  // escala: uma entrada por estilo|estado|quadro|cores, em qualquer tamanho de tela.
  function moldeRecolorido(nome, estado, quadro, o) {
    var cores = coresMolde(o);
    var key = nome + '|' + estado + '|' + quadro + '|' + cores.slice(2, 8).join(',');
    var c = moldCache.get(key);
    if (!c) {
      var M = moldes[nome];
      c = pintaIndices(indicesMolde(M, estado, quadro), M.w, M.h, cores);
      moldCache.set(key, c);
    }
    return c;
  }

  function drawHorseMolde(ctx, x, y, o, estado) {
    var k = Math.max(1, Math.round(o.scale || 1));
    var nome = estiloDe(o.element), M = moldes[nome], ref = M.estados[estado];
    var quadro = estado === 'galope' ? mod(Math.floor(o.frame || 0), M.frames) : 0;
    var S = moldScale(k, M.larguraUtil);
    x = Math.round(x); y = Math.round(y);
    var ox = x + ANCHORS.nose[0] * k - ref.nose[0] * S;
    var oy = y + (FOOT_Y + 1) * k - (ref.footY + 1) * S;
    crisp(ctx);
    if (o.shadow !== false) {   // a mesma sombra do sprite por código, centrada sob o corpo do molde
      ctx.fillStyle = 'rgba(20,10,20,0.28)';
      var cx = Math.round(ox + ref.centro * S), sy = y + (FOOT_Y - 1) * k;
      ctx.fillRect(cx - 11 * k, sy, 22 * k, k);
      ctx.fillRect(cx - 9 * k, sy + k, 18 * k, k);
    }
    ctx.drawImage(moldeRecolorido(nome, estado, quadro, o), ox, oy, M.w * S, M.h * S);
  }

  function drawHorse(ctx, x, y, opts) {
    opts = opts || {};
    var estado = moldsOk ? estadoMolde(opts) : null;
    if (estado) drawHorseMolde(ctx, x, y, opts, estado);
    else drawHorseCodigo(ctx, x, y, opts);
  }

  // Âncoras nas unidades do sprite por código (some x + v·escala, y + v·escala), para o estado pedido
  // ('galope' por padrão, 'parado' ou 'retrato'). Com a escala, a conversão é exata para aquele tamanho;
  // sem ela, usa a proporção ideal 40 / larguraUtil. Sem moldes: ANCHORS. O focinho é sempre NOSE.
  function anchorsFor(element, scale, estado) {
    if (!moldsOk) return ANCHORS;
    var M = moldes[estiloDe(element)];
    var ref = M.estados[estado === 'parado' || estado === 'retrato' ? estado : 'galope'];
    var k = scale > 0 ? Math.max(1, Math.round(scale)) : 0;
    var r = k ? moldScale(k, M.larguraUtil) / k : 40 / M.larguraUtil;
    function conv(p) { return p ? [ANCHORS.nose[0] + (p[0] - ref.nose[0]) * r, FOOT_Y + 1 - (ref.footY + 1 - p[1]) * r] : null; }
    return { rear: conv(ref.rear), nose: conv(ref.nose), saddle: conv(ref.saddle) };
  }

  function limparCacheMoldes() { moldCache.clear(); }
  function cacheMoldes() { return moldCache.map.size; }

  // Para o comparativo.html: um quadro do molde pintado com cores livres (índice -> cor), sem cache.
  function moldeCanvas(estilo, estado, quadro, cores) {
    var M = moldsOk && moldes[estilo];
    if (!M) return null;
    var idx = indicesMolde(M, estado, estado === 'galope' ? mod(quadro | 0, M.frames) : 0);
    return idx ? pintaIndices(idx, M.w, M.h, cores) : null;
  }

  // ===================================================================
  // Paletas de exemplo
  // ===================================================================
  var PALETTES = {
    fogo: { coat: '#b8562c', coatShade: '#7e321c', mane: '#ff7a1e', accent: '#f6e9cf' },     // alazão, crina de chamas
    agua: { coat: '#93a8bf', coatShade: '#5e7290', mane: '#3fd2ea', accent: '#e8f6ff' },     // tordilho azulado, crina aqua
    grama: { coat: '#6a4127', coatShade: '#40241a', mane: '#3f9a3a', accent: '#24160f' },    // castanho escuro, crina de folhas
    neutro: { coat: '#d8b064', coatShade: '#a57a38', mane: '#f3e8cc', accent: '#fff6e4' },   // baio/palomino
    neutro2: { coat: '#3e3846', coatShade: '#26212c', mane: '#2c2634', accent: '#ece8e0' }   // preto com meias brancas
  };

  // Pelagens naturais para bots / sorteio determinístico.
  var COATS = [
    { coat: '#b8562c', coatShade: '#7e321c', mane: '#8a3a1c', accent: '#f6e9cf' },  // alazão
    { coat: '#6a4127', coatShade: '#40241a', mane: '#1e1418', accent: '#24160f' },  // castanho
    { coat: '#8a5a32', coatShade: '#5a3620', mane: '#2a1c18', accent: '#f2ead8' },  // baio escuro
    { coat: '#d8b064', coatShade: '#a57a38', mane: '#f3e8cc', accent: '#fff6e4' },  // palomino
    { coat: '#c9c4bc', coatShade: '#8e8a86', mane: '#ecebe6', accent: '#ffffff' },  // tordilho claro
    { coat: '#3e3846', coatShade: '#26212c', mane: '#2c2634', accent: '#ece8e0' },  // preto
    { coat: '#b89a6a', coatShade: '#7e6440', mane: '#3a2a20', accent: '#2a1e18' },  // lobuno
    { coat: '#9a6a5a', coatShade: '#664238', mane: '#4a2e26', accent: '#f0e6dc' }   // ruão
  ];
  var ELEMENT_MANE_COLOR = { fogo: '#ff7a1e', agua: '#3fd2ea', grama: '#3f9a3a' };
  function randomPalette(seed, element) {
    seed = Math.floor(seed || 0);
    var b = COATS[Math.floor(hash(seed * 7 + 11) * COATS.length)];
    return {
      coat: b.coat, coatShade: b.coatShade,
      mane: ELEMENT_MANE_COLOR[element] || b.mane,
      accent: hash(seed * 3 + 5) < 0.45 ? b.coatShade : b.accent   // sem marcas x com meias/lista
    };
  }
  var SILKS = ['#d8353b', '#2f6fd8', '#f2c230', '#8a4ad8', '#30b060', '#f07a2a', '#e85aa8', '#2ab8b0'];

  // ===================================================================
  // Fonte pixel 3x5 (com acentos do português)
  // ===================================================================
  var GLYPHS = {
    'A': ['.#.', '#.#', '###', '#.#', '#.#'], 'B': ['##.', '#.#', '##.', '#.#', '##.'],
    'C': ['.##', '#..', '#..', '#..', '.##'], 'D': ['##.', '#.#', '#.#', '#.#', '##.'],
    'E': ['###', '#..', '##.', '#..', '###'], 'F': ['###', '#..', '##.', '#..', '#..'],
    'G': ['.##', '#..', '#.#', '#.#', '.##'], 'H': ['#.#', '#.#', '###', '#.#', '#.#'],
    'I': ['###', '.#.', '.#.', '.#.', '###'], 'J': ['..#', '..#', '..#', '#.#', '.#.'],
    'K': ['#.#', '#.#', '##.', '#.#', '#.#'], 'L': ['#..', '#..', '#..', '#..', '###'],
    'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#'], 'N': ['#..#', '##.#', '#.##', '#..#', '#..#'],
    'O': ['.#.', '#.#', '#.#', '#.#', '.#.'], 'P': ['##.', '#.#', '##.', '#..', '#..'],
    'Q': ['.#.', '#.#', '#.#', '##.', '.##'], 'R': ['##.', '#.#', '##.', '#.#', '#.#'],
    'S': ['.##', '#..', '.#.', '..#', '##.'], 'T': ['###', '.#.', '.#.', '.#.', '.#.'],
    'U': ['#.#', '#.#', '#.#', '#.#', '###'], 'V': ['#.#', '#.#', '#.#', '.#.', '.#.'],
    'W': ['#...#', '#...#', '#.#.#', '##.##', '#...#'], 'X': ['#.#', '#.#', '.#.', '#.#', '#.#'],
    'Y': ['#.#', '#.#', '.#.', '.#.', '.#.'], 'Z': ['###', '..#', '.#.', '#..', '###'],
    '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'],
    '2': ['##.', '..#', '.#.', '#..', '###'], '3': ['##.', '..#', '.#.', '..#', '##.'],
    '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'],
    '6': ['.##', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'],
    '8': ['###', '#.#', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '##.'],
    'm': ['.....', '.....', '####.', '#.#.#', '#.#.#'],
    '.': ['.', '.', '.', '.', '#'], ',': ['.', '.', '.', '#', '#'], ':': ['.', '#', '.', '#', '.'],
    '!': ['#', '#', '#', '.', '#'], '?': ['##.', '..#', '.#.', '...', '.#.'],
    '-': ['...', '...', '###', '...', '...'], '+': ['...', '.#.', '###', '.#.', '...'],
    '/': ['..#', '..#', '.#.', '#..', '#..'], '%': ['#.#', '..#', '.#.', '#..', '#.#'],
    "'": ['#', '#', '.', '.', '.'], '(': ['.#', '#.', '#.', '#.', '.#'], ')': ['#.', '.#', '.#', '.#', '#.'],
    'x': ['...', '#.#', '.#.', '#.#', '...'], '#': ['#.#', '###', '#.#', '###', '#.#'],
    '>': ['#..', '.#.', '..#', '.#.', '#..'], '<': ['..#', '.#.', '#..', '.#.', '..#'],
    '\u00b7': ['.', '.', '#', '.', '.'], '\u2014': ['....', '....', '####', '....', '....'], '\u2013': ['...', '...', '###', '...', '...'],
    '=': ['...', '###', '...', '###', '...'], '*': ['...', '#.#', '.#.', '#.#', '...'], '"': ['#.#', '#.#', '...', '...', '...'],
    '$': ['.##', '##.', '.#.', '.##', '##.'], '_': ['...', '...', '...', '...', '###'], '[': ['##', '#.', '#.', '#.', '##'], ']': ['##', '.#', '.#', '.#', '##'],
    '\u00ba': ['.#.', '#.#', '.#.', '...', '###'], '\u00aa': ['.##', '#.#', '.##', '...', '###'],
    '\u25bc': ['#####', '.###.', '..#..', '.....', '.....'], '\u25c0': ['..#', '.##', '###', '.##', '..#'],
    '\u25b6': ['#..', '##.', '###', '##.', '#..'], '\u25b2': ['.....', '..#..', '.###.', '#####', '.....'],
    '\u21aa': ['.##..', '#....', '#..#.', '.####', '...#.'],
    ' ': ['..', '..', '..', '..', '..']
  };
  var ACCENTS = { '́': ['..#', '.#.'], '̀': ['#..', '.#.'], '̂': ['.#.', '#.#'], '̃': ['.##', '##.'] };

  function textGlyphs(text) {
    var out = [];
    var s = String(text).normalize ? String(text).normalize('NFD') : String(text);
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ACCENTS[ch] || ch === '̧') { if (out.length) out[out.length - 1].marks.push(ch); continue; }
      var g = GLYPHS[ch] || GLYPHS[ch.toUpperCase()] || GLYPHS['?'];
      out.push({ g: g, marks: [] });
    }
    return out;
  }
  function measureText(text, scale) {
    scale = scale || 1;
    var gl = textGlyphs(text), w = 0;
    for (var i = 0; i < gl.length; i++) w += (gl[i].g[0].length + 1);
    return Math.max(0, w - 1) * scale;
  }
  function drawText(ctx, text, x, y, o) {
    o = o || {};
    var s = o.scale || 1, color = o.color || '#ffffff';
    var w = measureText(text, s);
    if (o.align === 'center') x -= Math.round(w / 2);
    else if (o.align === 'right') x -= w;
    x = Math.round(x); y = Math.round(y);
    function pass(dx, dy, col) {
      ctx.fillStyle = col;
      var cx = x + dx;
      var gl = textGlyphs(text);
      for (var i = 0; i < gl.length; i++) {
        var g = gl[i].g, gw = g[0].length;
        for (var r = 0; r < 5; r++) for (var c = 0; c < gw; c++) if (g[r][c] === '#') ctx.fillRect(cx + c * s, y + dy + r * s, s, s);
        for (var m = 0; m < gl[i].marks.length; m++) {
          var mk = gl[i].marks[m], off = Math.floor((gw - 3) / 2);
          if (mk === '̧') { ctx.fillRect(cx + Math.floor(gw / 2) * s, y + dy + 5 * s, s, s); continue; }
          var am = ACCENTS[mk];
          for (var rr = 0; rr < 2; rr++) for (var cc = 0; cc < 3; cc++) if (am[rr][cc] === '#') ctx.fillRect(cx + (cc + off) * s, y + dy + (rr - 3) * s, s, s);
        }
        cx += (gw + 1) * s;
      }
    }
    if (o.shadow) pass(s, s, o.shadow);
    pass(0, 0, color);
    return w;
  }

  // ===================================================================
  // Ícones de elemento (10x10)
  // ===================================================================
  var ICONS = {
    fogo: { map: [
      '....o.....',
      '...oyo....',
      '...oyro...',
      '..oyrro.o.',
      '..orryroyo',
      '.orryyrrro',
      '.orywwyrro',
      '.orywwyro.',
      '..orrrro..',
      '...oooo...'], pal: { o: '#3a0f12', y: '#ffd23a', r: '#f0581e', w: '#fff6c8' } },
    agua: { map: [
      '....o.....',
      '...obo....',
      '...obbo...',
      '..obbbbo..',
      '..obwbbo..',
      '.obwbbbbo.',
      '.obwbbbbo.',
      '.obbbbbdo.',
      '..obbddo..',
      '...oooo...'], pal: { o: '#0e2440', b: '#38b6ee', w: '#d8f7ff', d: '#1f78c2' } },
    grama: { map: [
      '......ooo.',
      '....oolgo.',
      '...olllgo.',
      '..ollggdo.',
      '..olgdggo.',
      '.olgdggo..',
      '.ogdggo...',
      '.odggo....',
      'od.oo.....',
      'o.........'], pal: { o: '#0f2a12', l: '#b6ec6a', g: '#4cae3c', d: '#2a6e2a' } },
    neutro: { map: [
      '...oooo...',
      '.oowwssoo.',
      '.owwsssdo.',
      'owsnnnnsdo',
      'owsnssnsdo',
      'owsnssnddo',
      'ossnnnnddo',
      '.ossssddo.',
      '.oosdddoo.',
      '...oooo...'], pal: { o: '#2a2630', w: '#f0ece4', s: '#b8b2ac', d: '#7a7480', n: '#4a4450' } }
  };
  var iconCache = new Map();
  function drawElementIcon(ctx, x, y, element, scale) {
    var s = Math.max(1, Math.round(scale || 1));
    var ic = ICONS[element] || ICONS.neutro;
    var key = (element || 'neutro') + '|' + s;
    var c = iconCache.get(key);
    if (!c) {
      c = makeCanvas(10 * s, 10 * s);
      var g = c.getContext('2d'); crisp(g);
      drawMap(g, ic.map, 0, 0, s, ic.pal);
      iconCache.set(key, c);
    }
    crisp(ctx);
    ctx.drawImage(c, Math.round(x), Math.round(y));
  }

  // ===================================================================
  // Rastro de elemento (partículas atrás do cavalo)
  // ===================================================================
  // Cada elemento tem estágios (nascimento -> fim) e algumas formas alternativas.
  var TRAIL = {
    fogo: {
      pal: { w: '#fff6c0', Y: '#ffd23a', y: '#ff9a1e', r: '#e2401a', d: '#8a2a1a', s: '#5a4a52' },
      stages: [
        [['..y..', '.yYy.', 'yYwYy', 'yrYry', '.rrr.'], ['.y...', '.Yy.y', 'yYwYy', 'rYYyr', '.rrr.']],
        [['.y.', 'yYy', 'ryr'], ['y..', 'yYy', '.rr']],
        [['yr', 'rd'], ['.y', 'rd']],
        [['ss', 'ss'], ['s.', 'ss']]
      ]
    },
    agua: {
      pal: { w: '#effeff', l: '#a8ecff', b: '#46c2f0', d: '#2382c6' },
      stages: [
        [['.w.', 'wlb', 'lbb', 'bbd', '.d.'], ['.w..', 'wlb.', 'lbbd', '.dd.']],
        [['.w.', 'wbb', '.d.'], ['wb', 'bd']],
        [['l.l', '.b.'], ['b.', '.l']],
        [['l'], ['.l', 'l.']]
      ]
    },
    grama: {
      pal: { l: '#c4f27a', g: '#56b640', d: '#2c6e2c', s: '#8a6a3a' },
      stages: [
        [['..lg', '.lgd', 'lgd.', 's...'], ['lg..', 'dlg.', '.dlg', '...s'], ['.ll.', 'lggd', '.dd.']],
        [['.l', 'lg', 'd.'], ['lg', '.d'], ['l.', 'gd']],
        [['.l', 'lg', 'd.'], ['lg', '.d'], ['l.', 'gd']],
        [['g'], ['l']]
      ]
    },
    neutro: {
      pal: { d: '#d8c8a8', D: '#bca888', l: '#efe4cc' },
      stages: [
        [['ld', 'dD']],
        [['.ld.', 'lddD', '.DD.']],
        [['.ll.', 'lddd', 'dddD', '.dD.']],
        [['.l.l', 'l.d.', '.d.l']]
      ]
    }
  };
  function drawTrail(ctx, x, y, element, t, intensity, scale) {
    var s = Math.max(1, Math.round(scale || 2));
    var I = Math.max(0, Math.min(1, intensity == null ? 1 : intensity));
    if (I <= 0.01) return;
    var def = TRAIL[element] || TRAIL.neutro;
    var n = Math.round(5 + 13 * I);
    t = t || 0;
    for (var i = 0; i < n; i++) {
      var life = 0.5 + 0.35 * hash(i * 13 + 1);
      var u = t / life + hash(i * 7 + 3);
      var age = frac(u), cyc = Math.floor(u);
      var jx = hash(i * 31 + cyc * 17), jy = hash(i * 17 + cyc * 29);
      var px, py;
      if (element === 'fogo') {          // labaredas sobem e ficam para trás
        px = x - age * (16 + 14 * jx) * s - jx * 3 * s;
        py = y + (jy - 0.5) * 9 * s - age * (6 + 8 * jy) * s;
      } else if (element === 'agua') {   // gotas em arco que caem
        px = x - age * (18 + 12 * jx) * s - jx * 3 * s;
        py = y + (jy - 0.5) * 8 * s + (age * age * 20 - age * 9) * s;
      } else if (element === 'grama') {  // folhas rodopiando
        px = x - age * (20 + 14 * jx) * s;
        py = y + (jy - 0.5) * 10 * s + Math.sin(age * 8 + i) * 3 * s + age * 5 * s;
      } else {                           // poeira
        px = x - age * (10 + 8 * jx) * s - jx * 3 * s;
        py = y + 8 * s + (jy - 0.5) * 4 * s - age * 4 * s;
      }
      var st = def.stages[Math.min(def.stages.length - 1, Math.floor(age * def.stages.length))];
      var shape = st[(i + Math.floor(age * 7)) % st.length];
      ctx.globalAlpha = Math.max(0, (1 - age * age) * (0.55 + 0.45 * I));
      drawMap(ctx, shape, Math.round(px / s) * s, Math.round(py / s) * s, s, def.pal);
    }
    ctx.globalAlpha = 1;
  }

  // ===================================================================
  // PISTA
  // ===================================================================
  var SKY = {
    sol: ['#4aa6f0', '#63b8f6', '#7fc8f8', '#9ad6f8', '#b6e2f6', '#d2ecf2'],
    nublado: ['#7f93a8', '#8ea0b3', '#9caebd', '#aab9c6', '#b8c4ce', '#c6ced6'],
    chuva: ['#3c4858', '#45525f', '#4f5c68', '#5a6672', '#66717c', '#727c86']
  };
  var HILLS = {
    sol: { far: '#8fb8d8', mid: '#6aa65a', near: '#4f8f45', tree: '#3c7638', treeL: '#5ea24e' },
    nublado: { far: '#8e9fb0', mid: '#69906a', near: '#557d55', tree: '#436a45', treeL: '#5b875a' },
    chuva: { far: '#5d6a78', mid: '#4b6655', near: '#3f5a48', tree: '#33493b', treeL: '#46604c' }
  };
  var SURF = {
    grama: { a: '#5cb44a', b: '#4ea640', dark: '#3f8f36', lite: '#7ccc5c', edge: '#8a7a4c' },
    terra: { a: '#a46c3e', b: '#9a6337', dark: '#6e4324', lite: '#c08a58', edge: '#7a5030' },
    areia: { a: '#e2c98f', b: '#d9be82', dark: '#bf9f62', lite: '#f4e4b8', edge: '#c8aa70' }
  };

  // Névoa usa as mesmas cores apagadas do nublado (céu, colinas, gramados, arquibancada).
  function isDim(weather) { return weather === 'nublado' || weather === 'nevoa'; }
  function skyKey(weather) { return weather === 'nevoa' ? 'nublado' : weather; }

  var tileCache = new Map();
  function surfaceTile(surface, weather, artH) {
    var key = surface + '|' + weather + '|' + artH;
    var c = tileCache.get(key);
    if (c) return c;
    var TW = 64, S = SURF[surface] || SURF.grama;
    var cols = new Array(TW * artH);
    var wet = weather === 'chuva';
    for (var y = 0; y < artH; y++) {
      for (var x = 0; x < TW; x++) {
        var h = hash2(x, y), col;
        if (surface === 'grama') {
          col = (x < 32) ? S.a : S.b;
          var bl = hash2(x, y + 1);
          if (h < 0.035 || bl < 0.03) col = mix(col, S.dark, 0.75);
          else if (h > 0.975) col = S.lite;
          if (x === 0 || x === 32) col = mix(col, S.dark, 0.12);
        } else if (surface === 'terra') {
          col = (h < 0.5) ? S.a : S.b;
          if (y % 4 === 3 && hash2(x, 99) > 0.25) col = mix(col, S.dark, 0.35);
          if (h > 0.965) col = S.lite;
          var cl = hash2(Math.floor(x / 2), Math.floor(y / 2) + 500);
          if (cl < 0.035) col = S.dark;
        } else {
          col = (h < 0.5) ? S.a : S.b;
          var wave = Math.round(1.5 * Math.sin(x * 0.35 + y * 0.1));
          if ((y + wave) % 6 === 0) col = mix(col, S.dark, 0.35);
          if (h > 0.93) col = S.lite; else if (h < 0.05) col = S.dark;
        }
        if (wet) {
          col = shade(col, 0.22);
          var pd = vnoise(x * 0.18 + y * 0.9) * vnoise(y * 0.5 + 11);
          if (surface !== 'grama' && pd > 0.42) col = mix(col, '#9fb4c8', 0.35);
          if (surface === 'grama' && h > 0.9) col = mix(col, '#cfe8ff', 0.4);
        }
        cols[y * TW + x] = col;
      }
    }
    c = gridToCanvas(cols, TW, artH);
    tileCache.set(key, c);
    if (tileCache.size > 60) tileCache.clear();
    return c;
  }

  // Arquibancada (tile em pixels de arte), 2 quadros de torcida.
  function standTile(weather, frame) {
    var key = 'stand|' + weather + '|' + frame;
    var c = tileCache.get(key);
    if (c) return c;
    var TW = 120, TH = 40;
    var cols = new Array(TW * TH).fill(null);
    function px(x, y, col) { if (x >= 0 && y >= 0 && x < TW && y < TH) cols[y * TW + x] = col; }
    var dim = weather === 'chuva' ? 0.35 : isDim(weather) ? 0.15 : 0;
    function C(h) { return dim ? shade(h, dim) : h; }
    // estrutura: x 6..86
    var x0 = 6, x1 = 88;
    for (var x = x0; x <= x1; x++) {
      // telhado
      px(x, 6, C('#7a2a30')); px(x, 7, C('#a83a3a')); px(x, 8, C(x % 6 < 3 ? '#e8e2d6' : '#c83c3c'));
      px(x, 9, C('#5a2026'));
      // fundo sombra interna
      for (var y = 10; y < 34; y++) px(x, y, C('#3c3446'));
      // degraus
      for (var yy = 12; yy < 34; yy += 4) px(x, yy, C('#6b6070'));
      // base
      for (var y2 = 34; y2 < 40; y2++) px(x, y2, C(y2 === 34 ? '#d6cfc2' : '#b8b0a2'));
    }
    // colunas
    for (var cx = x0; cx <= x1; cx += 16) for (var cy = 9; cy < 34; cy++) { px(cx, cy, C('#e6e0d4')); px(cx + 1, cy, C('#b8b0a2')); }
    // torcida
    var crowd = ['#e84a4a', '#3a7ae0', '#f2c230', '#f0f0f0', '#38b25a', '#e07ab8', '#f08a2a', '#7a5ae0'];
    var skin = ['#f1c8a0', '#d9a070', '#a86a40', '#7a4a2a'];
    for (var row = 0; row < 5; row++) {
      var by = 13 + row * 4;
      for (var hx = x0 + 3; hx < x1 - 1; hx += 2) {
        if ((hx - x0) % 16 < 2) continue;
        var hh = hash2(hx, row * 7);
        if (hh < 0.12) continue;
        var up = ((hash2(hx, row) > 0.5) ? 1 : 0) ^ frame ? 1 : 0;
        var bodyC = crowd[Math.floor(hash2(hx, row + 50) * crowd.length)];
        if (weather === 'chuva' && hash2(hx, row + 90) < 0.35) {
          // guarda-chuva
          var uc = crowd[Math.floor(hash2(hx, row + 91) * crowd.length)];
          px(hx - 1, by - 2 - up, C(uc)); px(hx, by - 3 - up, C(uc)); px(hx + 1, by - 2 - up, C(uc)); px(hx, by - 2 - up, C(uc));
          px(hx, by - 1 - up, C('#2a2a2a'));
        } else {
          px(hx, by - up, C(skin[Math.floor(hash2(hx, row + 70) * skin.length)]));
        }
        px(hx, by + 1 - up, C(bodyC));
        px(hx, by + 2, C(shade(bodyC, 0.3)));
      }
    }
    // bandeirinhas
    for (var fx = x0 + 8; fx < x1; fx += 16) {
      for (var fy = 0; fy < 6; fy++) px(fx, fy, C('#d8d2c6'));
      var fc = crowd[(fx >> 4) % crowd.length];
      var wv = frame ? 0 : 1;
      px(fx + 1, 0 + wv, C(fc)); px(fx + 2, 0 + wv, C(fc)); px(fx + 3, 1, C(fc)); px(fx + 1, 1 + wv, C(fc)); px(fx + 2, 1, C(fc));
    }
    // árvores depois da arquibancada
    for (var tx = 94; tx < 118; tx += 9) {
      var th = 10 + Math.floor(hash(tx) * 8);
      for (var ty = 0; ty < th; ty++) {
        var wdt = Math.round(4 - Math.abs(ty - th * 0.45) * 0.5);
        for (var dx = -wdt; dx <= wdt; dx++) px(tx + dx, 34 - th - 2 + ty, C((dx + ty) % 3 === 0 ? HILLS.sol.treeL : HILLS.sol.tree));
      }
      for (var ty2 = 32; ty2 < 40; ty2++) { px(tx, ty2, C('#5a3a24')); }
    }
    c = gridToCanvas(cols, TW, TH);
    tileCache.set(key, c);
    return c;
  }

  // Nuvem de pixels (cache)
  function cloudCanvas(seed, P, tone) {
    var key = 'cloud|' + seed + '|' + P + '|' + tone;
    var c = tileCache.get(key);
    if (c) return c;
    var w = 34 + Math.floor(hash(seed) * 20), h = 12;
    var cols = new Array(w * h).fill(null);
    var blobs = [];
    var nb = 3 + Math.floor(hash(seed + 1) * 3);
    for (var i = 0; i < nb; i++) blobs.push([6 + hash(seed * 7 + i) * (w - 12), 5 + hash(seed * 3 + i) * 3, 4 + hash(seed * 5 + i) * 4]);
    var tones = {
      sol: ['#ffffff', '#e4f0fa', '#c4d8ea'],
      nublado: ['#e6eaee', '#c8d0d8', '#a4b0bc'],
      chuva: ['#8a949e', '#727c86', '#5c6670']
    }[tone] || ['#ffffff', '#e4f0fa', '#c4d8ea'];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var inside = false, top = 99;
      for (var b = 0; b < blobs.length; b++) {
        var dx = x - blobs[b][0], dy = (y - blobs[b][1]) * 1.4;
        if (dx * dx + dy * dy < blobs[b][2] * blobs[b][2]) { inside = true; top = Math.min(top, dy); }
      }
      if (y >= h - 2) inside = inside && x > 3 && x < w - 4;
      if (inside) cols[y * w + x] = y > h - 4 ? tones[2] : (y < 5 ? tones[0] : tones[1]);
    }
    c = scaleCanvas(gridToCanvas(cols, w, h), P);
    tileCache.set(key, c);
    return c;
  }

  // Placa com texto (borda escura)
  function drawBoard(ctx, cx, top, text, P, bg, fg) {
    var tw = measureText(text, P);
    var w = tw + 4 * P, h = 9 * P;
    var x = Math.round(cx - w / 2);
    ctx.fillStyle = '#1c1820'; ctx.fillRect(x - P, top - P, w + 2 * P, h + 2 * P);
    ctx.fillStyle = bg; ctx.fillRect(x, top, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x, top + h - P, w, P);
    drawText(ctx, text, x + 2 * P, top + 2 * P, { scale: P, color: fg });
    return { x: x, w: w, h: h };
  }

  // Subidas em relevo: a faixa da pista (e quem corre nela) sobe em rampa ao longo do trecho e
  // desce rápido no fim (placa FIM), o mesmo desenho do perfil da sala de largada. Em rampa (e não
  // em lombada) a inclinação aparece em qualquer ponto da subida, não só nas bordas.
  var HILL_AMP = 24;   // altura máxima em pixels de arte (trechos longos)
  function hillShape(m, a, b) {
    if (!(m > a && m < b)) return 0;
    var len = b - a, d = Math.min(0.3, 30 / len), u = (m - a) / len;
    return u < 1 - d ? u / (1 - d) : (1 - u) / d;
  }
  function hillAmp(a, b) { return Math.max(10, Math.min(HILL_AMP, Math.round((b - a) * 0.1))); }
  // maxLift (opcional): teto da altura quando falta espaço acima da pista (ex.: celular deitado)
  function hillLiftAt(m, hills, maxLift) {
    if (!hills) return 0;
    for (var i = 0; i < hills.length; i++) {
      var a = hills[i][0], b = hills[i][1];
      if (m > a && m < b) {
        var amp = hillAmp(a, b);
        if (maxLift != null) amp = Math.min(amp, maxLift);
        return Math.round(amp * hillShape(m, a, b));
      }
    }
    return 0;
  }

  function drawTrack(ctx, o) {
    var W = o.width, Hh = o.height;
    var lanes = o.lanes || 6, laneH = o.laneH || 24, laneTop = o.laneTop || Math.round(Hh * 0.35);
    var ppm = Math.max(0.05, o.pxPerMeter || 4), cam = o.cameraX || 0, t = o.t || 0;
    var weather = skyKey(o.weather || 'sol'), surface = o.surface || 'grama';
    var P = o.pixel || Math.max(1, Math.round(laneH / 12));
    var trackH = lanes * laneH, trackBottom = laneTop + trackH;
    var camPx = cam * ppm;
    function sx(m) { return Math.round((m - cam) * ppm); }
    crisp(ctx);

    // --- céu em faixas
    var sky = SKY[weather] || SKY.sol;
    var horizon = laneTop - 22 * P; // linha do chão atrás da arquibancada
    var bandH = Math.ceil(horizon / sky.length / P) * P;
    for (var b = 0; b < sky.length; b++) { ctx.fillStyle = sky[b]; ctx.fillRect(0, b * bandH, W, bandH + 1); }
    if (horizon > sky.length * bandH) { ctx.fillStyle = sky[sky.length - 1]; ctx.fillRect(0, sky.length * bandH, W, horizon - sky.length * bandH); }

    // sol de fundo
    if (weather === 'sol') {
      var sunX = Math.round(W * 0.82), sunY = Math.round(Math.max(10 * P, horizon * 0.25)), r = 7 * P;
      ctx.fillStyle = 'rgba(255,240,180,0.35)';
      ctx.fillRect(sunX - r - 3 * P, sunY - r + 2 * P, 2 * r + 6 * P, 2 * r - 4 * P);
      ctx.fillRect(sunX - r + 2 * P, sunY - r - 3 * P, 2 * r - 4 * P, 2 * r + 6 * P);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(sunX - r, sunY - r + 2 * P, 2 * r, 2 * r - 4 * P);
      ctx.fillRect(sunX - r + 2 * P, sunY - r, 2 * r - 4 * P, 2 * r);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sunX - r + 3 * P, sunY - r + 2 * P, 3 * P, 2 * P);
    }

    // nuvens de fundo
    var nClouds = weather === 'sol' ? 3 : isDim(weather) ? 7 : 9;
    for (var ci = 0; ci < nClouds; ci++) {
      var cc = cloudCanvas(ci % 5, P, weather);
      var span = W + cc.width * 2;
      var cxp = mod(hash(ci + 40) * span - camPx * 0.02 - t * (3 + ci % 3) * P, span) - cc.width;
      var cyp = Math.round((0.08 + 0.55 * hash(ci + 70)) * (horizon - 30 * P));
      if (weather !== 'sol') cyp = Math.round((hash(ci + 70) * 0.6) * (horizon - 30 * P));
      ctx.drawImage(cc, Math.round(cxp), Math.max(0, cyp));
    }

    // montanhas distantes e colinas
    var HC = HILLS[weather] || HILLS.sol;
    function ridge(par, base, amp, freq, col, seedOff) {
      ctx.fillStyle = col;
      var off = camPx * par;
      for (var x = 0; x < W; x += P) {
        var wx = (x + off) / P;
        var hgt = base + amp * (0.65 * vnoise(wx * freq + seedOff) + 0.35 * vnoise(wx * freq * 3.1 + seedOff * 2));
        hgt = Math.round(hgt) * P;
        ctx.fillRect(x, horizon - hgt, P, hgt);
      }
    }
    ridge(0.03, 8, 22, 0.012, HC.far, 10);
    ridge(0.08, 4, 14, 0.02, HC.mid, 50);
    // copas de árvores na colina próxima
    ridge(0.15, 2, 6, 0.08, HC.near, 90);

    // arquibancada (tile repetido)
    var frame = Math.floor(t * 3) % 2;
    var st = standTile(weather, frame);
    var stW = st.width * P, stH = st.height * P;
    var stY = laneTop - 4 * P - stH;
    var stOff = mod(camPx * 0.35, stW);
    for (var sxp = -stOff; sxp < W; sxp += stW) ctx.drawImage(st, Math.round(sxp), stY, stW, stH);

    // gramado entre arquibancada e pista
    ctx.fillStyle = weather === 'chuva' ? '#3f6a3c' : isDim(weather) ? '#4a7c44' : '#58944a';
    ctx.fillRect(0, laneTop - 4 * P, W, 4 * P);

    // --- superfície da pista
    var artH = Math.ceil(trackH / P);
    var tile = surfaceTile(surface, weather, artH);
    var tw = tile.width * P;
    var tOff = mod(camPx, tw);
    for (var tx = -tOff; tx < W; tx += tw) ctx.drawImage(tile, Math.round(tx), laneTop, tw, artH * P);

    // divisórias de raia
    var SC = SURF[surface] || SURF.grama;
    for (var l = 1; l < lanes; l++) {
      var ly = laneTop + l * laneH;
      ctx.fillStyle = rgba('#ffffff', surface === 'areia' ? 0.28 : 0.16);
      var dash = 6 * P, gap = 4 * P, dOff = mod(camPx, dash + gap);
      for (var dx = -dOff; dx < W; dx += dash + gap) ctx.fillRect(Math.round(dx), ly - Math.floor(P / 2), dash, Math.max(1, Math.floor(P / 2) || 1));
    }
    // borda escura no topo da pista (sombra da cerca)
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, laneTop, W, P);
    // raia destacada (a do jogador): faixa dourada translúcida com bordas tracejadas
    var hl = o.highlightLane;
    if (hl != null && hl >= 0 && hl < lanes) {
      var hly = laneTop + hl * laneH;
      ctx.fillStyle = 'rgba(242,194,48,0.12)'; ctx.fillRect(0, hly, W, laneH);
      ctx.fillStyle = 'rgba(242,194,48,0.6)';
      var hd = 4 * P, hOff = mod(camPx, hd * 2);
      for (var hlx = -hOff; hlx < W; hlx += hd * 2) { ctx.fillRect(Math.round(hlx), hly, hd, P); ctx.fillRect(Math.round(hlx), hly + laneH - P, hd, P); }
    }

    // --- subidas
    var hills = o.hills || [];
    for (var hi = 0; hi < hills.length; hi++) {
      var a = sx(hills[hi][0]), bb = sx(hills[hi][1]);
      if (bb < -60 * P || a > W + 60 * P) continue;
      var x0 = Math.max(0, a), x1 = Math.min(W, bb);
      if (x1 > x0) {
        ctx.fillStyle = 'rgba(40,20,10,0.22)'; ctx.fillRect(x0, laneTop, x1 - x0, trackH);
        // hachura diagonal ancorada no mundo
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        var step = 10 * P;
        for (var yy = laneTop; yy < trackBottom; yy += P) {
          var shift = mod(-(yy - laneTop) + camPx, step);
          for (var hx = x0 - shift + step; hx < x1; hx += step) ctx.fillRect(Math.round(hx), yy, 3 * P, P);
        }
      }
      // linhas amarelas de início/fim
      ctx.fillStyle = '#f2c230';
      for (var ly2 = laneTop; ly2 < trackBottom; ly2 += 4 * P) {
        if (a >= 0 && a < W) ctx.fillRect(a, ly2, P, 2 * P);
        if (bb >= 0 && bb < W) ctx.fillRect(bb, ly2, P, 2 * P);
      }
    }

    // --- curvas: tinta azulada sobre as raias e setas ↪ ao longo da cerca externa (ancoradas no mundo)
    var curves = o.curves || [];
    for (var cvi = 0; cvi < curves.length; cvi++) {
      var ca = sx(curves[cvi][0]), cb = sx(curves[cvi][1]);
      if (cb < -60 * P || ca > W + 60 * P) continue;
      var cx0 = Math.max(0, ca), cx1 = Math.min(W, cb);
      if (cx1 > cx0) { ctx.fillStyle = 'rgba(30,60,120,0.18)'; ctx.fillRect(cx0, laneTop, cx1 - cx0, trackH); }
      ctx.fillStyle = '#7ab8ff';
      for (var ly3 = laneTop; ly3 < trackBottom; ly3 += 4 * P) {
        if (ca >= 0 && ca < W) ctx.fillRect(ca, ly3, P, 2 * P);
        if (cb >= 0 && cb < W) ctx.fillRect(cb, ly3, P, 2 * P);
      }
    }

    // --- marcas de distância (linhas na pista)
    var ev = Math.max(10, o.distanceMarkersEvery || 200);
    var finishM = o.finishM || 1000;
    var mStart = Math.max(ev, Math.ceil((cam - 40 / ppm) / ev) * ev);
    var mEnd = cam + (W + 80) / ppm;
    for (var mm = mStart; mm <= mEnd; mm += ev) {
      if (mm >= finishM) break;
      var mx = sx(mm);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (var my = laneTop; my < trackBottom; my += 3 * P) ctx.fillRect(mx, my, P, P * 2);
    }
    // largada
    var sx0 = sx(0);
    if (sx0 > -10 && sx0 < W + 10) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(sx0, laneTop, P, trackH); }

    // --- linha de chegada quadriculada
    var fx = sx(finishM);
    if (fx > -40 * P && fx < W + 40 * P) {
      var sq = 2 * P;
      for (var fy = laneTop, k = 0; fy < trackBottom; fy += sq, k++) {
        for (var col = 0; col < 2; col++) {
          ctx.fillStyle = (k + col) % 2 ? '#ffffff' : '#141218';
          ctx.fillRect(fx + col * sq, fy, sq, Math.min(sq, trackBottom - fy));
        }
      }
    }

    // --- cercas (externa em cima, interna embaixo)
    function rail(y, postsUp) {
      // postes a cada 4 m
      var every = 4, ps = Math.floor((cam - 8) / every) * every;
      for (var pm = ps; pm < cam + W / ppm + 8; pm += every) {
        var pxp = sx(pm);
        ctx.fillStyle = '#c9c2b6';
        ctx.fillRect(pxp, y - (postsUp ? 6 * P : 0), P, 6 * P);
      }
      ctx.fillStyle = '#1c1820'; ctx.fillRect(0, y - 6 * P - P, W, P);
      ctx.fillStyle = '#f6f2ea'; ctx.fillRect(0, y - 6 * P, W, 2 * P);
      ctx.fillStyle = '#c9c2b6'; ctx.fillRect(0, y - 4 * P, W, P);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y - 3 * P, W, P);
    }
    rail(laneTop, true);

    // placas de distância sobre a cerca externa
    for (var m2 = mStart; m2 <= mEnd; m2 += ev) {
      if (m2 >= finishM) break;
      var bx = sx(m2);
      ctx.fillStyle = '#e8e2d6'; ctx.fillRect(bx, laneTop - 18 * P, P, 18 * P);
      ctx.fillStyle = '#c83c3c';
      for (var sy2 = laneTop - 18 * P; sy2 < laneTop - 6 * P; sy2 += 4 * P) ctx.fillRect(bx, sy2, P, 2 * P);
      drawBoard(ctx, bx, laneTop - 28 * P, m2 + 'm', P, '#f6f2ea', '#1c1820');
    }
    // placas de subida
    for (var h2 = 0; h2 < hills.length; h2++) {
      var ha = sx(hills[h2][0]), hb = sx(hills[h2][1]);
      if (ha > -40 * P && ha < W + 40 * P) {
        ctx.fillStyle = '#5a3a24'; ctx.fillRect(ha, laneTop - 16 * P, P, 16 * P);
        var bd = drawBoard(ctx, ha, laneTop - 26 * P, 'SUBIDA', P, '#f2c230', '#1c1820');
        // rampinha
        ctx.fillStyle = '#1c1820';
        for (var q = 0; q < 4; q++) ctx.fillRect(bd.x + bd.w + 2 * P + q * P, laneTop - 19 * P - q * P, P, (q + 1) * P);
      }
      if (hb > -40 * P && hb < W + 40 * P) {
        ctx.fillStyle = '#5a3a24'; ctx.fillRect(hb, laneTop - 12 * P, P, 12 * P);
        drawBoard(ctx, hb, laneTop - 22 * P, 'FIM', P, '#f2c230', '#1c1820');
      }
    }
    // placas de curva e setas ↪ (chevron de 3 pixels) a cada 40·P sobre a cerca externa
    for (var c2 = 0; c2 < curves.length; c2++) {
      var ka = sx(curves[c2][0]), kb = sx(curves[c2][1]);
      if (kb < -40 * P || ka > W + 40 * P) continue;
      var aStep = 40 * P, aFrom = ka + aStep / 2;
      if (aFrom < 0) aFrom += Math.ceil(-aFrom / aStep) * aStep;
      ctx.fillStyle = '#7ab8ff';
      for (var ax = aFrom; ax < Math.min(kb - 4 * P, W); ax += aStep) {
        var ay = laneTop - 10 * P;
        ctx.fillRect(ax, ay, P, P); ctx.fillRect(ax + P, ay + P, P, P); ctx.fillRect(ax, ay + 2 * P, P, P);
        ctx.fillRect(ax + 2 * P, ay, P, P); ctx.fillRect(ax + 3 * P, ay + P, P, P); ctx.fillRect(ax + 2 * P, ay + 2 * P, P, P);
      }
      if (ka > -40 * P && ka < W + 40 * P) {
        ctx.fillStyle = '#2a4a78'; ctx.fillRect(ka, laneTop - 16 * P, P, 16 * P);
        drawBoard(ctx, ka, laneTop - 26 * P, 'CURVA', P, '#7ab8ff', '#1c1820');
      }
      if (kb > -40 * P && kb < W + 40 * P) {
        ctx.fillStyle = '#2a4a78'; ctx.fillRect(kb, laneTop - 12 * P, P, 12 * P);
        drawBoard(ctx, kb, laneTop - 22 * P, 'FIM', P, '#7ab8ff', '#1c1820');
      }
    }
    if (sx0 > -40 * P && sx0 < W + 40 * P) {
      ctx.fillStyle = '#e8e2d6'; ctx.fillRect(sx0, laneTop - 14 * P, P, 14 * P);
      drawBoard(ctx, sx0, laneTop - 24 * P, 'LARGADA', P, '#3a7ae0', '#ffffff');
    }
    // poste de chegada + faixa quadriculada
    if (fx > -60 * P && fx < W + 60 * P) {
      var postTop = Math.max(22 * P, laneTop - 40 * P);
      ctx.fillStyle = '#1c1820'; ctx.fillRect(fx - P, postTop - P, 4 * P, laneTop - postTop + P);
      ctx.fillStyle = '#f6f2ea'; ctx.fillRect(fx, postTop, 2 * P, laneTop - postTop);
      // disco vermelho no topo
      ctx.fillStyle = '#1c1820'; ctx.fillRect(fx - 3 * P, postTop - 7 * P, 8 * P, 7 * P);
      ctx.fillStyle = '#d83030'; ctx.fillRect(fx - 2 * P, postTop - 6 * P, 6 * P, 5 * P);
      ctx.fillStyle = '#ff8a7a'; ctx.fillRect(fx - P, postTop - 5 * P, 2 * P, P);
      // bandeira quadriculada ondulando
      var fw = 14, fh = 8;
      for (var bxi = 0; bxi < fw; bxi++) {
        var wave = Math.round(Math.sin(t * 6 - bxi * 0.6) * 1.2);
        for (var byi = 0; byi < fh; byi++) {
          ctx.fillStyle = ((bxi >> 1) + (byi >> 1)) % 2 ? '#141218' : '#f6f2ea';
          ctx.fillRect(fx + 2 * P + bxi * P, postTop + 2 * P + (byi + wave) * P, P, P);
        }
      }
      drawBoard(ctx, fx + P, postTop - 19 * P, 'CHEGADA', P, '#141218', '#ffffff');
    }

    // --- cerca interna e gramado interno
    ctx.fillStyle = weather === 'chuva' ? '#355c38' : isDim(weather) ? '#41703f' : '#4c8a44';
    ctx.fillRect(0, trackBottom, W, Hh - trackBottom);
    // tufos e flores do gramado interno
    var inOff = camPx;
    for (var gi = 0; gi < 40; gi++) {
      var gw = 1200;
      var gx = mod(hash(gi + 300) * gw - inOff, gw);
      if (gx > W) continue;
      var gy = trackBottom + 4 * P + Math.round(hash(gi + 400) * Math.max(1, (Hh - trackBottom - 8 * P) / P)) * P;
      if (gy > Hh - 2 * P) continue;
      ctx.fillStyle = weather === 'chuva' ? '#2c4c2e' : '#3a7238';
      ctx.fillRect(Math.round(gx), gy, P, 2 * P); ctx.fillRect(Math.round(gx) + 2 * P, gy - P, P, 3 * P);
      if (gi % 4 === 0) { ctx.fillStyle = gi % 8 ? '#f2e04a' : '#f0f0f0'; ctx.fillRect(Math.round(gx) + P, gy - 2 * P, P, P); }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, trackBottom, W, P);
    // cerca interna (postes para baixo)
    var every2 = 4, ps2 = Math.floor((cam - 8) / every2) * every2;
    for (var pm2 = ps2; pm2 < cam + W / ppm + 8; pm2 += every2) {
      ctx.fillStyle = '#c9c2b6'; ctx.fillRect(sx(pm2), trackBottom + P, P, 4 * P);
    }
    ctx.fillStyle = '#f6f2ea'; ctx.fillRect(0, trackBottom + P, W, 2 * P);
    ctx.fillStyle = '#1c1820'; ctx.fillRect(0, trackBottom + 3 * P, W, P);
    if (fx > -10 && fx < W + 10) { ctx.fillStyle = '#f6f2ea'; ctx.fillRect(fx, trackBottom, 2 * P, 8 * P); }

    // --- relevo das subidas: copia as colunas da faixa (da cerca externa para baixo) para cima
    if (hills.length && o.hillRelief !== false) {
      var y0 = laneTop - 8 * P, innerC = weather === 'chuva' ? '#355c38' : isDim(weather) ? '#41703f' : '#4c8a44';
      var spanX = -1, spanDy = 0;
      var flush = function (xEnd) {
        if (spanX < 0 || spanDy <= 0) return;
        var w = xEnd - spanX;
        ctx.drawImage(ctx.canvas, spanX, y0, w, Hh - y0, spanX, y0 - spanDy, w, Hh - y0);
        // encosta: faixa de terra escura sob a cerca levantada e gramado no rodapé exposto
        ctx.fillStyle = innerC; ctx.fillRect(spanX, Hh - spanDy, w, spanDy);
      };
      for (var cx2 = 0; cx2 < W; cx2 += P) {
        var dy = hillLiftAt(cam + (cx2 + P / 2) / ppm, hills, o.hillMaxLift) * P;
        if (dy !== spanDy || spanX < 0) { flush(cx2); spanX = cx2; spanDy = dy; }
      }
      flush(W);
    }
  }

  // ===================================================================
  // CLIMA (sobreposição em tela)
  // ===================================================================
  function drawWeather(ctx, weather, t, W, H, pixel) {
    t = t || 0;
    var P = pixel || Math.max(2, Math.round(Math.min(W, H) / 150));
    if (weather === 'chuva') {
      ctx.fillStyle = 'rgba(16,26,52,0.30)'; ctx.fillRect(0, 0, W, H);
      var n = Math.round(W * H / (450 * P * P));   // densidade constante em pixels de arte (independe do DPR)
      for (var i = 0; i < n; i++) {
        var sp = 0.75 + 0.5 * hash(i * 3 + 2);
        var yy = mod(hash(i * 3 + 1) * H * 1.3 + t * H * 1.4 * sp, H * 1.3) - H * 0.15;
        var xx = mod(hash(i * 3) * (W + 120) - yy * 0.3 - t * 30, W + 120) - 60;
        var near = hash(i * 5 + 9) > 0.7;
        ctx.fillStyle = near ? 'rgba(210,228,255,0.55)' : 'rgba(180,200,235,0.35)';
        var segs = near ? 4 : 3;
        for (var k = 0; k < segs; k++) ctx.fillRect(Math.round(xx - k * P * 0.6), Math.round(yy - k * P * 2), P, P * 2);
      }
      // respingos
      var ns = Math.round(W * H / (1500 * P * P));
      for (var j = 0; j < ns; j++) {
        var per = 0.5 + 0.4 * hash(j + 900);
        var ph = frac(t / per + hash(j + 901));
        if (ph > 0.25) continue;
        var cyc = Math.floor(t / per + hash(j + 901));
        var px = Math.round(hash(j * 7 + cyc * 13) * W), py = Math.round((0.4 + 0.6 * hash(j * 11 + cyc * 3)) * H);
        ctx.fillStyle = 'rgba(220,235,255,0.6)';
        var spread = ph < 0.12 ? 1 : 2;
        ctx.fillRect(px - spread * P, py - P, P, P); ctx.fillRect(px + spread * P, py - P, P, P); ctx.fillRect(px, py - 2 * P, P, P);
      }
      // relâmpago raro
      var lp = mod(t, 11.0);
      if (lp < 0.06 || (lp > 0.14 && lp < 0.2)) { ctx.fillStyle = 'rgba(230,240,255,0.22)'; ctx.fillRect(0, 0, W, H); }
    } else if (weather === 'nublado') {
      ctx.fillStyle = 'rgba(70,92,125,0.16)'; ctx.fillRect(0, 0, W, H);
      // sombras de nuvens passando
      for (var s = 0; s < 3; s++) {
        var cw = W * (0.5 + 0.3 * hash(s + 5));
        var cx = mod(hash(s + 1) * (W + cw) - t * (14 + 6 * s) * P, W + cw) - cw / 2;
        var cy = H * (0.35 + 0.4 * hash(s + 3));
        ctx.fillStyle = 'rgba(10,20,40,0.05)';
        for (var ring = 0; ring < 2; ring++) {
          var rw = Math.round(cw * (ring ? 0.3 : 0.5) / P) * P, rh = Math.round(rw * 0.35 / P) * P;
          ctx.fillRect(Math.round(cx / P) * P - rw, Math.round(cy / P) * P - rh, rw * 2, rh * 2);
        }
      }
      // nuvens em primeiro plano no topo
      for (var c = 0; c < 4; c++) {
        var cc = cloudCanvas(10 + c, P * 2, 'nublado');
        var span = W + cc.width * 2;
        var x = mod(hash(c + 77) * span - t * (8 + 4 * c) * P, span) - cc.width;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(cc, Math.round(x), Math.round(-cc.height * 0.35 + hash(c + 9) * H * 0.06));
        ctx.globalAlpha = 1;
      }
    } else if (weather === 'nevoa') {
      ctx.fillStyle = 'rgba(200,212,222,0.10)'; ctx.fillRect(0, 0, W, H);
      // 3 faixas de névoa deslizando na horizontal
      var bandH = 6 * P, rows = [0.3, 0.55, 0.8];
      ctx.fillStyle = 'rgba(230,236,240,0.18)';
      for (var bi = 0; bi < rows.length; bi++) {
        var bw = Math.round(W * (0.55 + 0.25 * hash(bi + 21)) / P) * P;
        var bspan = W + bw;
        var bx = Math.round((mod(hash(bi + 31) * bspan + t * (10 + 5 * bi) * P, bspan) - bw) / P) * P;
        var by = Math.round(H * rows[bi] / P) * P;
        ctx.fillRect(bx, by, bw, bandH);
      }
    } else { // sol
      ctx.fillStyle = 'rgba(255,196,110,0.06)'; ctx.fillRect(0, 0, W, H);
      // brilho do sol em 3 degraus de pixel (sem gradiente suave)
      var gx = Math.round(W * 0.86), R0 = Math.max(W, H) * 0.5;
      var steps = [[1.0, 0.05], [0.62, 0.06], [0.32, 0.08]];
      for (var gs = 0; gs < steps.length; gs++) {
        var rr = Math.round(R0 * steps[gs][0] / P) * P;
        ctx.fillStyle = 'rgba(255,240,190,' + steps[gs][1] + ')';
        for (var ry = 0; ry < rr; ry += 2 * P) {
          var hw = Math.round(Math.sqrt(Math.max(0, rr * rr - ry * ry)) / P) * P;
          ctx.fillRect(gx - hw, ry, hw * 2, 2 * P);
        }
      }
      // reflexos de lente em pixels
      var pulse = 0.5 + 0.5 * Math.sin(t * 1.3);
      var flares = [[0.62, 0.22, 5, 0.10], [0.48, 0.38, 3, 0.12], [0.3, 0.6, 7, 0.06]];
      for (var f = 0; f < flares.length; f++) {
        var fx = W * flares[f][0], fy = H * flares[f][1], fr = flares[f][2] * P;
        ctx.fillStyle = 'rgba(255,250,220,' + (flares[f][3] * (0.7 + 0.3 * pulse)).toFixed(3) + ')';
        ctx.fillRect(Math.round(fx - fr), Math.round(fy - fr / 2), Math.round(fr * 2), Math.round(fr));
        ctx.fillRect(Math.round(fx - fr / 2), Math.round(fy - fr), Math.round(fr), Math.round(fr * 2));
      }
    }
  }

  var api = {
    HORSE_W: HORSE_W, HORSE_H: HORSE_H, GALLOP_FRAMES: GALLOP.length, FOOT_Y: FOOT_Y,
    // pontos úteis em pixels nativos (multiplique pela escala): traseira p/ rastro, focinho, sela.
    // Com moldes, use anchorsFor(element, scale, estado): mesmas unidades, já convertidas.
    ANCHORS: ANCHORS,
    PALETTES: PALETTES,
    SILKS: SILKS,
    randomPalette: randomPalette,
    ELEMENTS: ['fogo', 'agua', 'grama', 'neutro'],
    drawHorse: drawHorse,
    drawHorseCodigo: drawHorseCodigo,
    horseCanvas: horseCanvas,
    // moldes do PixelLab (ver a seção MOLDES)
    ESTILO_POR_ELEMENTO: ESTILO_POR_ELEMENTO,
    moldsReady: false,
    loadMolds: loadMolds,
    anchorsFor: anchorsFor,
    limparCacheMoldes: limparCacheMoldes,
    moldeCanvas: moldeCanvas,
    _cacheMoldes: cacheMoldes,
    drawTrack: drawTrack,
    drawWeather: drawWeather,
    drawTrail: drawTrail,
    drawElementIcon: drawElementIcon,
    hillLiftAt: hillLiftAt,
    hillShape: hillShape,
    HILL_AMP: HILL_AMP,
    cacheStats: cacheStats,
    drawText: drawText,
    measureText: measureText,
    _debug: { compose: compose, horseLayers: horseLayers, horseState: horseState, outlineAndColor: outlineAndColor, buildColors: buildColors }
  };
  return api;
}));
