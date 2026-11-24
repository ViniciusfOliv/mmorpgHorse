/*
 * sprites.js — camada de pixel art do protótipo MMORPG Horse.
 * Procedural em <canvas>; os cavalos podem vir dos moldes do PixelLab embutidos pelo build (data:).
 *
 * API (global `Sprites` no navegador; module.exports no Node):
 *   Sprites.HORSE_W, Sprites.HORSE_H, Sprites.GALLOP_FRAMES, Sprites.FOOT_Y
 *   Sprites.drawHorse(ctx, x, y, { palette, element, frame, scale, silks, idle, t, jockey, shadow, quadro,
 *                                  marcas, semente, joquei, raridade, rastro, reduzido, porte })
 *     frame pode ser fracionário (fase contínua do galope); quadro = { topo, base } em px: quadro de altura
 *     fixa onde o molde inteiro tem de caber (retratos, pódio) — o desenho por código o ignora.
 *     Parte 2a (spec 2026-11-12-cavalos-marcas), todas opcionais — sem elas, o desenho é o de antes, byte a byte:
 *       marcas = { cara, patas, corpo } (GameData.MARCAS) e semente (uint32, Breed.hashChave da chave do cavalo,
 *         calculada por quem chama): marcas na pelagem, só nos moldes (Marcas.camadaMarcas);
 *       joquei = { padrao, capacete } (GameData.JOQUEI): padrão da seda num tom 2 da cor `silks`, capacete na cor
 *         escolhida e manta no capacete escurecido, só nos moldes (Marcas.camadaJoquei);
 *       raridade (id de GameData.RARITIES), rastro (só na corrida), reduzido (movimento reduzido): os efeitos de
 *         Sprites.drawRaridade, desenhados depois do cavalo (as faíscas e o rastro também no desenho por código).
 *     Parte 2b (spec 2026-11-13-cavalos-portes), opcional: porte (GameData.PORTES.valores; fora da lista ou ausente,
 *       'padrao') escolhe o molde do porte; no desenho por código, não muda nada.
 *   Sprites.drawRaridade(ctx, caixa, o)  caixa = horseBox(x, y, o): brilho na crina (só com molde), faíscas e
 *     rastro do Mítico (ver a seção RARIDADE VISÍVEL). Comum não desenha nada.
 *   Sprites.drawTrack(ctx, { width, height, cameraX, pxPerMeter, camPx?, lanes, laneTop, laneH, surface,
 *                           finishM, hills, curves, distanceMarkersEvery, t, weather, pixel, wind, curveScale })
 *     wind = { intensity: 'calmo'|'brisa'|'ventania', dir: 1|-1 } (só visual; padrão brisa ←): bandeirinhas
 *     da arquibancada, grama da borda e nuvens seguem o vento
 *     curves = [[a, b], …] (metros): as SEQUÊNCIAS de curva (a corrida passa RaceFx.curveRuns(cond.curves):
 *     blocos de curva colados viram um intervalo só). Com o fx.js carregado, enquanto o meio da tela está numa
 *     curva a pista se arqueia NA TELA, com as pontas mais altas — cerca externa, piso, raias, linhas e campo
 *     interno sobem round(−RaceFx.curveOffsetTela) pixels de arte por coluna (0 no meio da tela, até 20 nas
 *     pontas), a arquibancada 10/6 disso; por intervalo: tracejados de início e fim, placas CURVA (início) e FIM
 *     nos postes e placas "CURVA" presas à cerca a cada 40 m. O chamador soma o mesmo deslocamento no y dos
 *     cavalos. Sem fx.js, a pista fica reta. curveScale (0..1) encolhe o arco quando falta espaço acima da
 *     pista (o y dos cavalos usa o mesmo fator).
 *     regiao: id de window.__REGIOES já passado ao setRegioes (cerrado, varzea, planalto, sertao, litoral): o fundo vira
 *     as camadas da região (céu em faixas, nuvens, horizonte, meio, arquibancada, faixa de grama) e o chão de dentro
 *     fica para o primeiro plano; sem ela, o cenário por código.
 *   Sprites.setRegioes({ id: { posicao, camadas: { nuvens, horizonte, meio, arquibancada, frente } (Image) } }),
 *   Sprites.regiaoPronta(id), Sprites.drawTrackFront(ctx) — primeiro plano da região (paralaxe 1,25), depois dos cavalos
 *   Sprites.cloudCanvas(seed, P, tom) — nuvem de pixels em cache (usada pelo nublado do fx.js)
 *   Sprites.drawTrail(ctx, x, y, element, t, intensity, scale)
 *   Sprites.drawElementIcon(ctx, x, y, element, scale)
 *   Sprites.drawText(ctx, text, x, y, { scale, color, shadow, align, volatil })  // fonte pixel 3x5 com acentos;
 *     volatil: texto que muda quase a cada quadro, pintado direto (fora do cache de texto pronto)
 *   Sprites.PALETTES  // paletas de exemplo
 *   Moldes do PixelLab (recolor por paleta; sem eles, desenho por código):
 *   Sprites.loadMolds(window.__MOLDES, pronto), Sprites.moldsReady, Sprites.ESTILO_POR_ELEMENTO,
 *   Sprites.moldesConjunto ('portes': os 12 moldes '<porte>-<estilo>' carregados; null: sem moldes),
 *   Sprites.drawHorseSilhouette(ctx, x, y, opts, cor, alpha)  (contorno tingido, chamar antes de drawHorse),
 *   Sprites.anchorsFor(element, scale, estado, porte), Sprites.horseBox(x, y, opts),
 *   Sprites.limparCacheMoldes() (moldes recoloridos, silhuetas do contorno, máscaras do brilho da crina e textos
 *     prontos; o game.js chama ao trocar de tela),
 *   Sprites.prepararCavalo(opts) -> n: recolore já, no cache dos moldes, os quadros que drawHorse(…, opts) usa (parado
 *     e todo o galope; sem jóquei, o retrato), para a corrida montar cada cavalo uma vez na largada; 0 sem moldes,
 *   Sprites.drawHorseCodigo(...)
 *   Dependências: Marcas (marcas.js) e GameData (data.js) — require no Node, globais no navegador (procurados na
 *   hora do desenho). Sem eles (o wiki embute só este arquivo), marcas, jóquei e raridade não desenham nada.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./marcas.js'), require('./data.js'), require('./luz.js'));
  else root.Sprites = factory(null, null, null);   // no navegador: Marcas, GameData e Luz globais, procurados na hora (ver marcasApi)
}(typeof self !== 'undefined' ? self : this, function (MARCAS_NODE, DADOS_NODE, LUZ_NODE) {
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

  // Desenho por código (sempre disponível): usado quando os moldes não carregaram ou a pose não tem molde.
  function drawHorseCodigo(ctx, x, y, opts) {
    opts = opts || {};
    var s = Math.max(1, Math.round(opts.scale || 1));
    x = Math.round(x); y = Math.round(y);
    crisp(ctx);
    if (opts.shadow !== false) {   // opaca, na rampa do chão (Regra 2), 2 px de arte para a direita
      var Lz = luzApi(), Sz = Lz ? Lz.sombraDoChao(opts.chao || '#cd683d') : { projetada: '#9e4539', contato: '#6e2727' };
      var sy = y + (FOOT_Y - 1) * s;
      ctx.fillStyle = Sz.projetada; ctx.fillRect(x + 11 * s, sy, 22 * s, s); ctx.fillRect(x + 13 * s, sy + s, 18 * s, s);
      ctx.fillStyle = Sz.contato; ctx.fillRect(x + 15 * s, sy, 12 * s, s);
    }
    ctx.drawImage(horseBase(opts).canvas, x, y, HORSE_W * s, HORSE_H * s);
  }
  function cacheStats() { return { baseBytes: baseCache.bytes, baseCount: baseCache.map.size }; }

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
  // Os moldes são os 12 '<porte>-<estilo>' (spec 2026-11-13-cavalos-portes §4 e §6; porte de GameData.PORTES:
  // esguio, padrao, robusto). O molde de um cavalo é porte + '-' + estiloDe(element); sem porte nas opções, ou com
  // um porte fora da lista, 'padrao'. A carga é tudo ou nada: faltou uma das 12 chaves (ou um quadro não decodificou),
  // nenhum molde liga, com um console.warn do motivo, e os cavalos ficam no desenho por código. Os 4 moldes antigos
  // ('<estilo>', o lote de 2026-11-08) saíram na 2b: uma chave sem porte na tabela é ignorada.
  // Sprites.moldesConjunto = 'portes' com os moldes ligados (null sem moldes). Os caches dos moldes recoloridos, das
  // máscaras do brilho e das silhuetas usam a chave do molde (o porte vai junto).
  //
  // Encaixe no sprite por código (40×32, escala k): o molde é desenhado em escala inteira
  // S = max(1, round(k × 40 / Lref)), ÚNICA para todos os moldes. Lref = maior larguraUtil entre os 4 moldes do
  // padrão (lisa incluída): na pista, os cavalos do padrão ficam do tamanho dos antigos, e o esguio e o robusto se
  // distinguem pelas proporções do desenho, sem mudar a escala dos outros. Cavalos de estilos e portes diferentes
  // ficam na mesma escala. Na pista:
  //   • a última linha dos cascos (o maior footY entre os quadros do estado) termina em y + (FOOT_Y + 1)·k,
  //     a mesma linha de chão do sprite por código;
  //   • a coluna do focinho (mediana de nose.x entre os quadros do estado) fica em x + NOSE·k (NOSE = 38).
  // Num quadro de altura fixa (opção `quadro`: retratos e pódio) o cavalo fica centrado no x do sprite e a escala
  // é a única enquanto o MAIS ALTO dos 12 moldes naquele estado couber com o topo (crista, orelhas) cortado em no
  // máximo 10 % da altura do bbox; senão a escala desce um passo para todos os moldes juntos (layoutMolde), e os 3
  // portes ficam proporcionais em qualquer zoom. Com zoom de 125 % (k = 4), todos ficam um passo menores que antes
  // da 2b (decisão do Vinicius em 2026-11-13). Se o bbox do estado for mais alto que o quadro, os cascos ficam na base.
  // As referências são POR ESTADO, não por quadro: por quadro o cavalo tremeria no galope (cauda e patas
  // mudam rear e footY). Como o focinho cai no mesmo NOSE, a câmera e as etiquetas da corrida não mudam;
  // anchorsFor() converte rear/saddle do molde para as unidades do sprite por código. As âncoras POR QUADRO
  // (M.ancoras = { retrato, parado, galope: [9] }, as do JSON + larguraUtil) só servem às zonas das marcas e
  // do jóquei (marcas.js), presas a cada quadro.
  // Galope: o ciclo do molde (frames quadros) dura o mesmo que o ciclo do código (GALLOP_FRAMES quadros);
  // `frame` pode ser fracionário (fase contínua) e o índice é floor((frame mod GALLOP_FRAMES) × frames / GALLOP_FRAMES).
  var ESTILO_POR_ELEMENTO = { fogo: 'chamas', agua: 'ondas', grama: 'folhas', neutro: 'lisa' };
  var ESTILOS_MOLDE = ['chamas', 'ondas', 'folhas', 'lisa'];
  // os portes vêm de GameData.PORTES.valores; esta cópia vale sem o GameData (o wiki embute só o sprites.js)
  var PORTES_MOLDE = ['esguio', 'padrao', 'robusto'], PORTE_PADRAO = 'padrao';
  // na paleta-mestra já na origem (guia de integração, Regra 3; antes: #1a1405, #e8b48a e #5a3a22, levados à mestra só
  // no coresNaMestra)
  var MOLDE_CORES_FIXAS = { contorno: '#2e222f', pele: '#fdcbb0', sela: '#4c3e24' };
  var moldes = null;       // chave do molde -> { w, h, frames, larguraUtil, retrato, parado, galope: [], estados, ancoras }
  var moldsOk = false;
  var moldesLref = 0;      // maior larguraUtil entre os 4 moldes do padrão: escala única
  var alturaMaxEstado = {}; // estado -> maior altura de bbox entre os 12 moldes: o passo da escala num quadro fixo
  var moldesGeracao = 0;   // descarta um carregamento antigo se loadMolds for chamado de novo
  var CORTE_MAX = 0.1;     // fração da altura do bbox que pode ser cortada no topo de um quadro de altura fixa
  // 64×64×4 = 16 KB por entrada; o teto em bytes é só uma rede de segurança (go() limpa ao trocar de tela)
  var moldCache = new LruCanvasCache(8 * 1024 * 1024);
  var sombraCache = new LruCanvasCache(2 * 1024 * 1024);   // sombras dos moldes por quadro, chão e vista (sombraMolde)
  LruCanvasCache.prototype.clear = function () { this.map.clear(); this.bytes = 0; };
  // máscaras da crina para o brilho da raridade (recortadas na crina: poucos KB cada); fora do moldCache, que o
  // ui-test conta por corrida e no pódio
  var brilhoCache = new LruCanvasCache(1024 * 1024);

  function estiloDe(element) { return ESTILO_POR_ELEMENTO[element] || 'lisa'; }
  function portesMolde() {
    var GD = dadosApi(), v = GD && GD.PORTES && GD.PORTES.valores;
    return Array.isArray(v) ? v : PORTES_MOLDE;
  }
  // porte das opções do desenho: fora da lista (ou ausente), o padrão
  function porteDe(p) { return typeof p === 'string' && portesMolde().indexOf(p) >= 0 ? p : PORTE_PADRAO; }
  // chave do molde de um cavalo: '<porte>-<estilo>'
  function chaveMolde(element, porte) { return porteDe(porte) + '-' + estiloDe(element); }
  // as 12 chaves dos moldes (porte × estilo)
  function chavesPortes() {
    var out = [];
    portesMolde().forEach(function (p) { ESTILOS_MOLDE.forEach(function (e) { out.push(p + '-' + e); }); });
    return out;
  }
  function moldScale(k) { return Math.max(1, Math.round(k * 40 / moldesLref)); }
  // A corrida pode desenhar numa escala de trabalho k/d e deixar o CSS ampliar d vezes (pixelated): os moldes
  // continuam do mesmo tamanho na tela só se a escala deles também dividir certinho. Sem moldes (ainda), não.
  function escalaMoldeCompativel(k, kTrabalho) {
    if (!moldsOk || !(kTrabalho > 0) || k % kTrabalho) return false;
    return moldScale(kTrabalho) * (k / kTrabalho) === moldScale(k);
  }
  function mediana(v) {
    var s = v.slice().sort(function (a, b) { return a - b; }), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function ponto(p) { return p && p.length === 2 && isFinite(p[0]) && isFinite(p[1]); }
  function caixa(b) { return b && isFinite(b.x) && isFinite(b.y) && b.w > 0 && b.h > 0; }
  function avisa(msg) { if (typeof console !== 'undefined' && console.warn) console.warn('Sprites: ' + msg); }
  function aviso(motivo) { avisa('moldes desligados (' + motivo + '); os cavalos usam o desenho por código.'); }
  // cópia rasa da âncora de um quadro com a larguraUtil do molde (a zona da cara usa a do molde, não a do bbox)
  function ancoraComL(a, larguraUtil) {
    var c = {};
    for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) c[k] = a[k];
    c.larguraUtil = larguraUtil;
    return c;
  }

  // Referência de um estado a partir das âncoras dos seus quadros (calculada uma vez, ao carregar).
  function refEstado(lista) {
    var foot = -1, topo = Infinity, esq = Infinity, dir = -Infinity, nx = [], ny = [], rx = [], ry = [], sx = [], sy = [], cx = [];
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (!a || !isFinite(a.footY) || !ponto(a.nose) || !ponto(a.rear) || !caixa(a.bbox)) throw new Error('âncora inválida');
      foot = Math.max(foot, a.footY);
      topo = Math.min(topo, a.bbox.y);
      esq = Math.min(esq, a.bbox.x); dir = Math.max(dir, a.bbox.x + a.bbox.w);
      nx.push(a.nose[0]); ny.push(a.nose[1]); rx.push(a.rear[0]); ry.push(a.rear[1]);
      if (ponto(a.saddle)) { sx.push(a.saddle[0]); sy.push(a.saddle[1]); }
      cx.push(a.bbox.x + a.bbox.w / 2);
    }
    return {
      footY: foot,
      nose: [Math.round(mediana(nx)), Math.round(mediana(ny))],
      rear: [Math.round(mediana(rx)), Math.round(mediana(ry))],
      saddle: sx.length ? [Math.round(mediana(sx)), Math.round(mediana(sy))] : null,
      centro: mediana(cx),       // centro horizontal do corpo (sombra e centralização no quadro)
      altura: foot + 1 - topo,   // linhas do bbox do estado (da linha mais alta à dos cascos)
      esq: esq, dir: dir         // colunas do bbox do estado (união dos quadros), para horseBox
    };
  }

  // PNG em data: URL -> índices de papel (round(cinza / 25)); falha (com o motivo) se o tamanho ou os tons
  // não baterem. ok/falha são chamados fora do try: um erro no pronto() do loadMolds aparece no console.
  function decodificaMolde(url, w, h, ok, falha) {
    var img = new Image();
    img.onload = function () {
      var lido = null, motivo = '';
      try {
        if (img.width !== w || img.height !== h) throw new Error('tamanho ' + img.width + '×' + img.height + ', esperado ' + w + '×' + h);
        var c = makeCanvas(w, h), g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        var d = g.getImageData(0, 0, w, h).data, idx = new Array(w * h);
        for (var i = 0; i < w * h; i++) {
          var r = d[i * 4], v = Math.round(r / 25);
          if (d[i * 4 + 3] < 128) v = 0;
          else if (v > 9 || Math.abs(r - v * 25) > 3) throw new Error('tom de cinza ' + r + ' fora dos papéis');
          idx[i] = v;
        }
        lido = idx;
      } catch (e) { motivo = e.message; }
      if (lido) ok(lido); else falha(motivo);
    };
    img.onerror = function () { falha('a imagem não decodificou'); };
    img.src = url;
  }

  // tabela = { estilos: { <chave>: { json, retrato, parado, galope: [...] }, ... } } (window.__MOLDES), com as 12
  // chaves '<porte>-<estilo>'. Só liga os moldes quando os 12 estão na tabela e todos os quadros carregam; faltou
  // uma chave, os moldes ficam desligados com um console.warn "conjunto dos portes incompleto (N de 12 moldes;
  // faltam …)", e qualquer outra falha (quadro que não decodifica, âncora inválida) também deixa moldsReady = false
  // e moldesConjunto = null, sem exceção, com um console.warn do motivo (o jogo segue com o desenho por código).
  // Chave a mais na tabela (a de um molde antigo '<estilo>') é ignorada.
  function loadMolds(tabela, pronto) {
    var geracao = ++moldesGeracao;
    moldsOk = false; api.moldsReady = false; api.moldesConjunto = null; moldes = null; moldCache.clear(); brilhoCache.clear();
    if (typeof Image === 'undefined' || typeof document === 'undefined') return;   // Node: sem canvas
    var est = tabela && tabela.estilos;
    if (!est) { aviso('a tabela de moldes não tem estilos'); return; }
    var chaves = chavesPortes(), faltam = chaves.filter(function (ch) { return !(Object.prototype.hasOwnProperty.call(est, ch) && est[ch]); });
    if (faltam.length) {
      avisa('conjunto dos portes incompleto (' + (chaves.length - faltam.length) + ' de ' + chaves.length + ' moldes; faltam ' +
        faltam.join(', ') + '): moldes desligados; os cavalos usam o desenho por código.');
      return;
    }
    var novos = {}, pendentes = 1, motivo = null;   // 1 = o próprio laço abaixo (fecha no fim)
    function falha(m) { if (!motivo) motivo = m || 'falha'; }
    function fim() {
      pendentes--;
      if (pendentes > 0 || geracao !== moldesGeracao) return;
      if (motivo) { aviso(motivo); return; }
      // escala única: o maior larguraUtil entre os 4 moldes do padrão
      moldesLref = 0;
      ESTILOS_MOLDE.forEach(function (e) { moldesLref = Math.max(moldesLref, novos[PORTE_PADRAO + '-' + e].larguraUtil); });
      // num quadro de altura fixa, o passo da escala sai do mais alto dos 12 moldes em cada estado (ver layoutMolde)
      alturaMaxEstado = {};
      Object.keys(novos).forEach(function (ch) {
        var E = novos[ch].estados;
        for (var est in E) if (Object.prototype.hasOwnProperty.call(E, est)) alturaMaxEstado[est] = Math.max(alturaMaxEstado[est] || 0, E[est].altura);
      });
      moldes = novos; api.moldesConjunto = 'portes'; moldsOk = true; api.moldsReady = true;
      if (typeof pronto === 'function') pronto();
    }
    try {
      chaves.forEach(function (nome) {
        var e = est[nome], J = e && e.json;
        if (!J || !e.retrato || !e.parado || !e.galope) throw new Error('molde ausente: ' + nome);
        function refDe(rotulo, lista) {
          try { return refEstado(lista); } catch (x) { throw new Error(nome + '/' + rotulo + ': ' + x.message); }
        }
        var frames = J.frames | 0, A = J.ancoras || {};
        if (!(frames > 0) || e.galope.length !== frames || !(J.w > 0) || !(J.h > 0) || !(J.larguraUtil > 0)) throw new Error('molde inválido: ' + nome);
        var lista = [];
        for (var f = 0; f < frames; f++) lista.push(A['galope-' + f]);
        var M = novos[nome] = {
          w: J.w, h: J.h, frames: frames, larguraUtil: J.larguraUtil, retrato: null, parado: null, galope: [],
          estados: { retrato: refDe('retrato', [A.retrato]), parado: refDe('parado', [A.parado]), galope: refDe('galope', lista) }
        };
        // âncoras por quadro (as do JSON, já validadas acima) + larguraUtil, para as zonas do marcas.js
        M.ancoras = { retrato: ancoraComL(A.retrato, J.larguraUtil), parado: ancoraComL(A.parado, J.larguraUtil), galope: [] };
        for (f = 0; f < frames; f++) M.ancoras.galope.push(ancoraComL(lista[f], J.larguraUtil));
        function carrega(url, rotulo, guarda) {
          pendentes++;
          decodificaMolde(url, M.w, M.h, function (idx) { guarda(idx); fim(); },
            function (m) { falha(nome + '/' + rotulo + ': ' + m); fim(); });
        }
        carrega(e.retrato, 'retrato', function (idx) { M.retrato = idx; });
        carrega(e.parado, 'parado', function (idx) { M.parado = idx; });
        e.galope.forEach(function (url, q) { carrega(url, 'galope-' + q, function (idx) { M.galope[q] = idx; }); });
      });
    } catch (ex) {
      falha(ex.message);   // as decodificações já pedidas terminam sem ligar os moldes
    }
    fim();
  }

  // Estado do molde para as opções do drawHorse; null = pose sem molde (galope sem jóquei): usa o código.
  function estadoMolde(o) {
    if (o.retrato) return 'retrato';
    if (o.jockey === false) return o.idle ? 'retrato' : null;
    return o.idle ? 'parado' : 'galope';
  }

  // Paleta-mestra (guia de arte §3, etapa 1b): toda cor de cavalo pintada sai da Resurrect 64. O dado do cavalo (o hex do
  // save, a mistura do potro) não muda: a cor é trocada pela mais próxima da mestra (CIELAB) na hora de recolorir. A
  // sombra de um papel não pode cair na mesma cor da base (a sombra sumiria): aí vale a mais próxima entre as mais escuras.
  var MESTRA = ('2e222f 3e3546 625565 966c6c ab947a 694f62 7f708a 9babb2 c7dcd0 ffffff 6e2727 b33831 ea4f36 f57d4a ae2334 ' +
    'e83b3b fb6b1d f79617 f9c22b 7a3045 9e4539 cd683d e6904e fbb954 4c3e24 676633 a2a947 d5e04b fbff86 165a4c 239063 1ebc73 ' +
    '91db69 cddf6c 313638 374e4a 547e64 92a984 b2ba90 0b5e65 0b8a8f 0eaf9b 30e1b9 8ff8e2 323353 484a77 4d65b4 4d9be6 8fd3ff ' +
    '45293f 6b3e75 905ea9 a884f3 eaaded 753c54 a24b6f cf657f ed8099 831c5d c32454 f04f78 f68181 fca790 fdcbb0').split(' ');
  function labDe(hex) {
    var v = hexToRgb(hex).map(function (c) { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; });
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    var x = f((v[0] * 0.4124 + v[1] * 0.3576 + v[2] * 0.1805) / 0.95047), y = f(v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722);
    var z = f((v[0] * 0.0193 + v[1] * 0.1192 + v[2] * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  var MESTRA_LAB = null, mestraCache = {};
  // a cor da mestra mais perto de hex; com evitar, uma diferente dela e mais escura (para as sombras), ou mais clara
  // com claro = true
  function naMestra(hex, evitar, claro) {
    if (!hex) return hex;
    var chave = hex + '|' + (evitar || '') + (claro ? '+' : '');
    if (mestraCache[chave]) return mestraCache[chave];
    if (!MESTRA_LAB) MESTRA_LAB = MESTRA.map(labDe);
    var a = labDe(hex), lEvitar = evitar ? labDe(evitar)[0] : 0, melhor = null, md = Infinity;
    for (var i = 0; i < MESTRA.length; i++) {
      var b = MESTRA_LAB[i], h = '#' + MESTRA[i];
      if (evitar && (h === evitar || (claro ? b[0] <= lEvitar : b[0] >= lEvitar))) continue;
      var d = (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]);
      if (d < md) { md = d; melhor = h; }
    }
    return (mestraCache[chave] = melhor || naMestra(hex));
  }
  // as cores por papel (coresMolde ou coresComCamadas) levadas à mestra; cada tom derivado diferente da sua base e do lado
  // certo dela: as sombras (pelagem, crina, branco das marcas, a manta sob o capacete) mais escuras; o tom 2 da seda mais
  // escuro numa seda clara e mais claro numa escura (como o coresComCamadas o deriva)
  var SOMBRA_DE = { 3: 2, 5: 4, 11: 10, 15: 14 };
  function coresNaMestra(cores) {
    var out = cores.map(function (c) { return c ? naMestra(c.toLowerCase()) : c; });
    var escuro = function (a, b) { return lum(a) < lum(b); };
    Object.keys(SOMBRA_DE).forEach(function (k) {
      var b = SOMBRA_DE[k];
      if (out[k] && out[b] && !escuro(out[k], out[b])) out[k] = naMestra(cores[k].toLowerCase(), out[b]);
    });
    if (out[13] && out[7]) {
      var claro = lum(cores[7]) < 0.5;
      if (claro ? !escuro(out[7], out[13]) : !escuro(out[13], out[7])) out[13] = naMestra(cores[13].toLowerCase(), out[7], claro);
    }
    return out;
  }

  // Cores por papel (índice 0–9) para as opções do drawHorse. As sombras da pelagem e da crina são 1 degrau abaixo na
  // rampa (Luz.degrau; guia de integração, Regra 4), para caírem nas mesmas famílias frias da sombra do chão; sem o
  // luz.js, as de antes.
  function coresMolde(o) {
    var pal = o.palette || PALETTES.neutro, Lz = luzApi();
    var coat = pal.coat || '#a0704a', mane = corCrina(o);
    var coatS = Lz ? Lz.degrau(naMestra(coat.toLowerCase()), -1) : pal.coatShade || shade(coat, 0.35);
    var maneS = Lz ? Lz.degrau(naMestra(mane.toLowerCase()), -1) : shade(mane, 0.35);
    return [null, MOLDE_CORES_FIXAS.contorno, coat, coatS, mane, maneS,
      pal.accent || '#f2ead8', o.silks || '#d8353b', MOLDE_CORES_FIXAS.pele, MOLDE_CORES_FIXAS.sela];
  }
  // Pelagem e crina em 4 tons (guia de integração, Regra 4; plano da animação ambiente, etapa 0.3). Os moldes trazem 2
  // tons (papéis 2/3 e 4/5); os outros 2 saem de um sombreado por código, com a luz de cima e da esquerda:
  //   luz (16 pelo, 18 crina): o tom claro (2, 4) na borda de cima da silhueta (sem corpo acima) ou no canto de cima e da
  //     esquerda (sem corpo à esquerda nem na diagonal);
  //   sombra profunda (17 pelo, 19 crina): o tom escuro (3, 5) na borda de baixo ou da direita (sem corpo abaixo ou à
  //     direita);
  //   em massas: o pixel só muda se tiver um vizinho 4-conexo do mesmo papel com a mesma marca (nada de pixel solto).
  // "Corpo" é todo papel > 1 (o contorno e o vazio não contam). Puro: devolve um novo Uint8Array de índices.
  var TOM_LUZ = { 2: 16, 4: 18 }, TOM_FUNDO = { 3: 17, 5: 19 };
  function sombreiaPelagem(idx, w, h) {
    var n = w * h, out = new Uint8Array(n), marca = new Uint8Array(n), x, y, i, p;
    function corpo(xx, yy) { return xx >= 0 && yy >= 0 && xx < w && yy < h && idx[yy * w + xx] > 1; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; p = idx[i]; out[i] = p;
      if (TOM_LUZ[p]) { if (!corpo(x, y - 1) || (!corpo(x - 1, y) && !corpo(x - 1, y - 1))) marca[i] = 1; }
      else if (TOM_FUNDO[p]) { if (!corpo(x, y + 1) || !corpo(x + 1, y)) marca[i] = 2; }
    }
    function igual(i0, xx, yy) { if (xx < 0 || yy < 0 || xx >= w || yy >= h) return false; var j = yy * w + xx; return marca[j] === marca[i0] && idx[j] === idx[i0]; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (!marca[i] || !(igual(i, x - 1, y) || igual(i, x + 1, y) || igual(i, x, y - 1) || igual(i, x, y + 1))) continue;
      out[i] = marca[i] === 1 ? TOM_LUZ[idx[i]] : TOM_FUNDO[idx[i]];
    }
    return out;
  }
  // as cores dos índices 16–19 (luz e sombra profunda da pelagem e da crina), das cores por papel já na mestra: 1 degrau
  // acima e 2 abaixo na rampa (sem o luz.js, clareada e escurecida)
  function coresTons(cores) {
    var Lz = luzApi();
    function t(c, n) { return Lz ? Lz.degrau(c, n) : (n > 0 ? light(c, 0.25) : shade(c, 0.55)); }
    return [t(cores[2], 1), t(cores[2], -2), t(cores[4], 1), t(cores[4], -2)];
  }
  // a cor da crina (papel 4) do molde nas opções do drawHorse; o brilho da raridade escolhe a cor por ela
  function corCrina(o) {
    var pal = o.palette || PALETTES.neutro;
    return pal.mane || shade(pal.coat || '#a0704a', 0.5);
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
  function ancoraMolde(M, estado, quadro) { return estado === 'galope' ? M.ancoras.galope[quadro] : M.ancoras[estado]; }

  // Marcas e jóquei (spec 2026-11-12-cavalos-marcas §3–§4) das opções do drawHorse, normalizados pelas listas do
  // GameData (fora da lista: sem marca, padrão liso; capacete que não é '#rgb'/'#rrggbb': sem capacete — o
  // capacete fica na seda e a manta na sela). null sem as duas opções (ou sem o marcas.js): a recoloração de hoje.
  function visuaisMolde(o) {
    var MK = marcasApi(), GD = dadosApi();
    if (!MK || !GD || !GD.MARCAS || !GD.JOQUEI) return null;
    var m = o.marcas && typeof o.marcas === 'object' ? o.marcas : null;
    var j = o.joquei && typeof o.joquei === 'object' ? o.joquei : null;
    if (!m && !j) return null;
    var L = GD.MARCAS, v = { MK: MK, branco: L.branco || '#f1e9d4', marcas: null, semente: o.semente >>> 0, padrao: null, capacete: null, chave: '' };
    if (m) {
      v.marcas = {
        cara: L.cara.indexOf(m.cara) >= 0 ? m.cara : 'nenhuma',
        patas: L.patas.indexOf(m.patas) >= 0 ? m.patas : 0,
        corpo: L.corpo.indexOf(m.corpo) >= 0 ? m.corpo : 'liso'
      };
      v.chave += '|m' + v.marcas.cara + ',' + v.marcas.patas + ',' + v.marcas.corpo + ',' + v.semente;
    }
    if (j) {
      v.padrao = GD.JOQUEI.padroes.indexOf(j.padrao) >= 0 ? j.padrao : 'liso';
      v.capacete = opaca(j.capacete) ? j.capacete.toLowerCase() : null;
      v.chave += '|j' + v.padrao + ',' + (v.capacete || '-');
    }
    return v;
  }

  // Índices 10–15 por cima dos papéis: 10–12 = camada das marcas (1 branco, 2 branco-sombra, 3 escuro),
  // 13–15 = camada do jóquei (1 tom 2 da seda, 2 capacete, 3 manta). As camadas não se cruzam (marcas só na
  // pelagem, jóquei só na roupa e na sela).
  // (base: os índices já sombreados, que ficam fora das camadas; as camadas saem dos papéis originais)
  function indicesComCamadas(idx, w, h, ancora, v, base) {
    var cm = v.marcas ? v.MK.camadaMarcas(idx, w, h, ancora, v.marcas, v.semente) : null;
    var cj = v.padrao ? v.MK.camadaJoquei(idx, w, h, ancora, v.padrao) : null;
    var out = new Uint8Array(w * h);
    base = base || idx;
    for (var i = 0; i < w * h; i++) out[i] = cm && cm[i] ? 9 + cm[i] : (cj && cj[i] ? 12 + cj[i] : base[i]);
    return out;
  }
  function coresComCamadas(cores, v) {
    var seda = cores[7], cap = v.capacete;
    return cores.concat([
      v.branco, shade(v.branco, 0.3), shade(cores[3], 0.45),                  // marcas
      lum(seda) < 0.5 ? light(seda, 0.35) : shade(seda, 0.3),                  // tom 2 da seda
      cap || seda, cap ? shade(cap, 0.4) : cores[9]                            // capacete e manta
    ]);
  }

  // Canvas 1× recolorido; a escala fica no drawImage (vizinho mais próximo), então a chave não leva a
  // escala: uma entrada por molde|estado|quadro|cores (molde = a chave do molde, com o porte; + marcas,
  // semente, padrão e capacete, quando vêm nas opções), em qualquer tamanho de tela. Sem marcas e sem jóquei: a
  // chave e os pixels de antes da parte 2a.
  // As camadas saem do marcas.js só na falta (uma vez por cavalo e quadro; na corrida, na largada).
  // o.clima (corrida): as cores passam pela LUT do clima, a mesma das camadas da região, e o cavalo escurece junto com o
  // fundo (Regra 8 (a)); sol ou sem clima: a chave e os pixels de antes
  // (a LUT de figura: Luz.lutFigura, mais branda que a do fundo; um clima em que ela é a identidade fica como o sol)
  function climaDoCavalo(o) {
    var Lz = luzApi();
    if (!o.clima || !CLIMA_PALETA[o.clima] || !Lz || !Lz.CONDICAO_FIGURA) return null;
    return (Lz.CONDICAO_FIGURA[o.clima] || 'sol') === 'sol' ? null : o.clima;
  }
  // (clima: a LUT de figura do clima; 'cena|<nome>': a tinta ambiente da cena)
  function lutFigura(clima) {
    if (lutClimas['fig|' + clima]) return lutClimas['fig|' + clima];
    var Lz = luzApi(), L = clima.indexOf('cena|') === 0 ? Lz.lutCondicao(clima.slice(5)) : Lz.lutFigura(clima), t = {};
    MESTRA.forEach(function (h) { t['#' + h] = L['#' + h] || '#' + h; });
    return (lutClimas['fig|' + clima] = t);
  }
  // o.cena (cenas paradas: 'fornalha', 'estabulo', 'remanso'): a tinta ambiente da cena nas figuras (Luz.CONDICOES) e o
  // contraluz da fonte emissiva dela (Luz.CONTRALUZ; o.contraluz === false tira), do lado da fonte (o.espelhado vira o
  // lado, para a fonte ficar no mesmo lado da tela)
  function cenaDoCavalo(o) { var Lz = luzApi(); return o.cena && Lz && Lz.CONDICOES && Lz.CONDICOES[o.cena] ? o.cena : null; }
  function contraluzDe(o, cena) {
    var Lz = luzApi(), c = cena && o.contraluz !== false && Lz.CONTRALUZ ? Lz.CONTRALUZ[cena] : null;
    if (!c) return null;
    var lado = c.lado;
    if (o.espelhado && lado !== 'cima') lado = lado === 'esquerda' ? 'direita' : 'esquerda';
    return { lado: lado, cor: c.cor };
  }
  // contraluz de 1 px: o pixel do tom de luz (16 pelo, 18 crina) com o vazio ou o contorno do lado da fonte vira o
  // índice 20 (a cor da fonte); só onde o pixel já é o degrau mais claro (Regra 8)
  function comContraluz(sb, idx, w, h, lado) {
    var dx = lado === 'esquerda' ? -1 : lado === 'direita' ? 1 : 0, dy = lado === 'cima' ? -1 : 0, out = new Uint8Array(sb);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = y * w + x;
      if (sb[i] !== 16 && sb[i] !== 18) continue;
      var xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || idx[yy * w + xx] <= 1) out[i] = 20;
    }
    return out;
  }
  function moldeRecolorido(nome, estado, quadro, o) {
    var cores = coresNaMestra(coresMolde(o)), v = visuaisMolde(o), cl = climaDoCavalo(o), ce = cenaDoCavalo(o), cz = contraluzDe(o, ce);
    var key = nome + '|' + estado + '|' + quadro + '|' + cores.slice(2, 8).join(',') + (v ? v.chave : '') + (cl ? '|c' + cl : '') +
      (ce ? '|s' + ce + (cz ? ',' + cz.lado : '') : '');
    var c = moldCache.get(key);
    if (!c) {
      var M = moldes[nome], idx = indicesMolde(M, estado, quadro), sb = sombreiaPelagem(idx, M.w, M.h), tons = coresTons(cores);
      if (cz) sb = comContraluz(sb, idx, M.w, M.h, cz.lado);
      var lut = cl ? lutFigura(cl) : null, lutC = ce ? lutFigura('cena|' + ce) : null;
      var noClima = function (lista) {
        return lista.map(function (x) { if (!x) return x; x = x.toLowerCase(); if (lut) x = corClima(lut, x); return lutC ? corClima(lutC, x) : x; });
      };
      var extra = [cz ? cz.cor : null];
      c = v ? pintaIndices(indicesComCamadas(idx, M.w, M.h, ancoraMolde(M, estado, quadro), v, sb), M.w, M.h, noClima(coresNaMestra(coresComCamadas(cores, v)).concat(tons)).concat(extra))
        : pintaIndices(sb, M.w, M.h, noClima(cores.concat([null, null, null, null, null, null], tons)).concat(extra));
      moldCache.set(key, c);
    }
    return c;
  }

  // Monta agora, no cache dos moldes, todos os quadros recoloridos que drawHorse(…, opts) usa com estas opções
  // (o parado e os quadros do galope; sem jóquei, o retrato), para a corrida não recolorir no 1º ciclo do
  // galope (~0,8 ms por quadro com marcas e jóquei; spec 2026-11-12-cavalos-marcas §3: cada cavalo montado uma
  // vez na largada). Só o número de quadros do molde decide o laço, e ele mora aqui. Devolve quantos quadros
  // ficaram prontos (0 sem moldes).
  function prepararCavalo(opts) {
    opts = opts || {};
    if (!moldsOk) return 0;
    var nome = chaveMolde(opts.element, opts.porte), M = moldes[nome], n = 0, feitos = {}, q;
    [true, false].forEach(function (idle) {
      var estado = estadoMolde({ idle: idle, jockey: opts.jockey, retrato: opts.retrato });
      if (!estado || feitos[estado]) return;
      feitos[estado] = true;
      var quadros = estado === 'galope' ? M.frames : 1;
      for (q = 0; q < quadros; q++) { moldeRecolorido(nome, estado, q, opts); n++; }
    });
    return n;
  }

  // Quadro do galope do molde para o contador do sprite por código (pode ser fracionário).
  function quadroGalope(M, frame) {
    var f = mod(Number(frame) || 0, GALLOP.length);
    return Math.min(M.frames - 1, Math.floor(f * M.frames / GALLOP.length));
  }

  // Posição do molde na tela para drawHorse(ctx, x, y, { scale: k, quadro }): escala S, canto (ox, oy),
  // linha dos cascos (pe), topo do bbox (topo) e centro do corpo (cx), em px. Sem quadro: cascos no chão do
  // sprite e focinho no NOSE. Com quadro { topo, base } (px): o corpo centrado no x do sprite e
  //   • se o bbox do estado cabe na altura do quadro: cascos no chão do sprite, ou mais baixos (até a base)
  //     o necessário para o cavalo ficar centrado na altura do quadro;
  //   • se não cabe: cascos na base e o topo cortado — no máximo CORTE_MAX da altura do bbox.
  // A escala do quadro é a única (moldScale) enquanto o MAIS ALTO dos 12 moldes naquele estado (alturaMaxEstado)
  // couber com corte de no máximo CORTE_MAX; senão desce um passo, para TODOS os moldes juntos. Assim a escala segue
  // única entre portes e estilos em qualquer k: decidir pelo bbox de cada molde fazia o robusto (o retrato mais alto)
  // descer de S 3 para S 2 em k = 4 (dpr 1,25 a 1,4, o zoom de 125 % do Windows) e ficar menor que o padrão. O corte de
  // cada molde fica no máximo o do mais alto (com os moldes dos portes, até 6,9 % no retrato do robusto-ondas em k = 3,
  // 6 e 9). A outra saída, tolerar mais corte, cortaria a cabeça do robusto (14 % em k = 4).
  // quadro.grade (etapa 1b da direção de arte, guia §2 e §7): o molde 1:1 na grade de pixel — 1 pixel do molde = 1 pixel
  // de arte = quadro.grade pixels do canvas —, com os cascos em quadro.base e o corpo centrado em quadro.centro (pixels do
  // canvas); nada de escala variável nem de "meia escala"
  function layoutMolde(nome, estado, x, y, k, quadro) {
    var M = moldes[nome], ref = M.estados[estado];
    if (quadro && quadro.grade) {
      var G = quadro.grade, peG = quadro.base, oxG = Math.round((quadro.centro != null ? quadro.centro : x) - ref.centro * G);
      return { S: G, ox: oxG, oy: peG - (ref.footY + 1) * G, pe: peG, topo: peG - ref.altura * G, cx: Math.round(oxG + ref.centro * G), grade: true };
    }
    var S = moldScale(k), pe = y + (FOOT_Y + 1) * k, ox;
    if (quadro && isFinite(quadro.topo) && isFinite(quadro.base) && quadro.base > quadro.topo) {
      var livre = quadro.base - quadro.topo, alta = Math.max(ref.altura, alturaMaxEstado[estado] || 0);
      while (S > 1 && alta * S - livre > CORTE_MAX * alta * S) S--;
      if (ref.altura * S > livre) pe = quadro.base;
      else pe = Math.min(quadro.base, Math.max(pe, Math.round((quadro.topo + quadro.base + ref.altura * S) / 2)));
      ox = Math.round(x + HORSE_W / 2 * k - ref.centro * S);
    } else {
      ox = x + ANCHORS.nose[0] * k - ref.nose[0] * S;
    }
    return { S: S, ox: ox, oy: pe - (ref.footY + 1) * S, pe: pe, topo: pe - ref.altura * S, cx: Math.round(ox + ref.centro * S) };
  }

  // Sombra do cavalo (guia de integração, Regra 2: a causa nº 1 do "PNG colado"). Opaca, na rampa do chão da cena
  // (Luz.sombraDoChao: 1 degrau abaixo = projetada, 2 = contato), nunca preto com alfa. Pura: devolve os pixels
  // [{ x, y, cor, n }] no espaço do molde (pintados nessa ordem; o contato vem por último; n = degraus abaixo do chão).
  //   'lateral' (corrida, idle, retratos): elipse achatada sob os cascos, centrada 2 px à direita do corpo (luz de cima e
  //             da esquerda, guia §4), mais a faixa de contato logo abaixo de cada casco
  //   'cima'    (cenas vistas de cima: arena, desafio, trilha): a silhueta inteira deslocada 3 px à direita e 2 para baixo,
  //             em 1 tom, mais o contato sob os cascos
  var SOMBRA = { dxLateral: 2, ryLateral: 1.7, rxFrac: 0.42, dxCima: 3, dyCima: 2 };
  function pixelsSombra(idx, w, h, ancora, chao, vista, espelho) {
    var L = luzApi(), S = L ? L.sombraDoChao(chao || '#cd683d') : { projetada: '#9e4539', contato: '#6e2727' };
    var out = [], foot = ancora.footY, b = ancora.bbox, x, y;
    if (vista === 'cima') {
      // espelho: o desenho vai ser virado (cena do desafio), então a sombra sai para a esquerda e volta à direita na tela
      var dxC = espelho ? -SOMBRA.dxCima : SOMBRA.dxCima;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (idx[y * w + x]) out.push({ x: x + dxC, y: y + SOMBRA.dyCima, cor: S.projetada, n: -1 });
    } else {
      var cx = b.x + b.w / 2 + (espelho ? -SOMBRA.dxLateral : SOMBRA.dxLateral), rx = Math.max(6, Math.round(b.w * SOMBRA.rxFrac)), ry = SOMBRA.ryLateral, cy = foot + 0.5;
      for (y = foot - 1; y <= foot + 2; y++) for (x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var ex = (x - cx) / rx, ey = (y - cy) / ry;
        if (ex * ex + ey * ey <= 1 && x >= 0 && x < w + 4) out.push({ x: x, y: y, cor: S.projetada, n: -1 });
      }
    }
    // contato: logo abaixo de cada casco (pixel opaco na linha dos pés com o de baixo vazio), e 1 à direita
    for (x = 0; x < w; x++) {
      if (idx[foot * w + x] && !(foot + 1 < h && idx[(foot + 1) * w + x])) { out.push({ x: x, y: foot + 1, cor: S.contato, n: -2 }); out.push({ x: x + (espelho ? -1 : 1), y: foot + 1, cor: S.contato, n: -2 }); }
    }
    return out;
  }
  // o sprite da sombra de um quadro do molde, num chão e numa vista (cache próprio, fora dos moldes recoloridos).
  // em (opcional, cenas pintadas de chão variado, como a arena do desafio): { fn(x, y) -> hex do chão ou null, chave, x, y }
  // — cada pixel da sombra é o chão de verdade sob ele, 1 ou 2 degraus abaixo (Luz.degrau); (x, y) é o pixel de arte, no
  // espaço do ctx, do canto do sprite da sombra; chave identifica a cena e a posição (entra no cache)
  function sombraMolde(nome, estado, quadro, chao, vista, espelho, em) {
    var key = 'sombra|' + nome + '|' + estado + '|' + quadro + '|' + chao + '|' + vista + (espelho ? '|e' : '') +
      (em ? '|' + em.chave + '|' + em.x + '|' + em.y : ''), c = sombraCache.get(key);
    if (c) return c;
    var M = moldes[nome], idx = indicesMolde(M, estado, quadro), anc = ancoraMolde(M, estado, quadro), Lz = luzApi();
    var ps = pixelsSombra(idx, M.w, M.h, anc, chao, vista, espelho);
    // margem de 4 px em volta (o deslocamento da sombra sai do quadro do molde)
    c = makeCanvas(M.w + 8, M.h + 8);
    var g = c.getContext('2d');
    ps.forEach(function (p) {
      var cor = p.cor, sob = em && Lz ? em.fn(em.x + p.x + 4, em.y + p.y + 4) : null;
      if (sob) cor = Lz.degrau(naMestra(sob), p.n);
      g.fillStyle = cor; g.fillRect(p.x + 4, p.y + 4, 1, 1);
    });
    c.sombra = true;   // marca para os testes separarem a sombra do cavalo
    sombraCache.set(key, c);
    return c;
  }

  // a cor-base do piso da pista (a mesma do tile do surfaceTile, como o drawTrack o escolhe), para a sombra dos cavalos na
  // corrida: com a arte da região pronta, o piso no clima mostrado pela LUT; sem ela, o tile de sempre (molhado na chuva)
  function corDoPiso(surface, clima, regiao) {
    var a = (SURF[surface] || SURF.grama).a, RG = regiaoPronta(regiao);
    if (RG) return corClima(lutClima(clima || 'sol'), naMestra(a)).toLowerCase();
    return corClima(null, naMestra(clima === 'chuva' ? shade(a, 0.22) : a)).toLowerCase();
  }
  // a cor mais comum na faixa de pixels [x0, x1] × [y, y1] de uma imagem (o chão sob os pés numa cena pintada; a faixa
  // pula as linhas de borda, como a beira bege do piso do estábulo); lida uma vez por imagem e posição (fora do laço)
  var chaoCache = {};
  function corDoChaoEm(img, x0, x1, y, y1) {
    if (y1 == null || y1 < y) y1 = y;
    if (!img || img.complete === false || img.naturalWidth === 0) return null;   // ainda carregando: nada no cache
    var key = (img.src || img.width + 'x' + img.height) + '|' + x0 + '|' + x1 + '|' + y + '|' + y1;
    if (chaoCache[key]) return chaoCache[key];
    var w = Math.max(1, x1 - x0 + 1), hh = y1 - y + 1, c = makeCanvas(w, hh), g = c.getContext('2d');
    g.drawImage(img, -x0, -y);
    var d = g.getImageData(0, 0, w, hh).data, cont = {}, melhor = '#cd683d', mc = 0;
    for (var i = 0; i < w * hh; i++) {
      if (d[i * 4 + 3] < 128) continue;
      var h = rgbToHex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]).toLowerCase();
      cont[h] = (cont[h] || 0) + 1; if (cont[h] > mc) { mc = cont[h]; melhor = h; }
    }
    return (chaoCache[key] = naMestra(melhor).toLowerCase());
  }
  // o chão de uma imagem pintada, pixel a pixel: fn(x, y) -> '#rrggbb' (null fora dela, no transparente ou ainda carregando);
  // os pixels são lidos uma vez por imagem (para a sombra por pixel, opção chaoEm do drawHorse)
  var imgPxCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function chaoDaImagem(img) {
    if (!img || img.complete === false || img.naturalWidth === 0 || !imgPxCache) return null;
    var P = imgPxCache.get(img);
    if (!P) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, c = makeCanvas(w, h), g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      P = { w: w, h: h, d: g.getImageData(0, 0, w, h).data };
      imgPxCache.set(img, P);
    }
    return function (x, y) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= P.w || y >= P.h) return null;
      var i = (y * P.w + x) * 4;
      return P.d[i + 3] < 128 ? null : rgbToHex(P.d[i], P.d[i + 1], P.d[i + 2]).toLowerCase();
    };
  }
  // uma imagem de figura (treinador) na tinta ambiente de uma cena (Luz.CONDICOES[cena]), pré-assada uma vez por imagem
  // e cena; sem cena conhecida ou ainda carregando, a própria imagem
  var naCenaCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function imagemNaCena(img, cena) {
    var Lz = luzApi();
    if (!img || !cena || !Lz || !Lz.CONDICOES || !Lz.CONDICOES[cena] || !naCenaCache || img.complete === false || img.naturalWidth === 0) return img;
    var m = naCenaCache.get(img);
    if (!m) { m = {}; naCenaCache.set(img, m); }
    return m[cena] || (m[cena] = remapeia(img, lutFigura('cena|' + cena)));
  }
  // tufos do próprio chão da cena na frente da linha dos cascos (Regra 7: palha no estábulo, grama ou cascalho na arena):
  // fios de 1 px de largura e 1 a 3 de altura em ~1/3 das colunas entre cx − larg/2 e cx + larg/2 (pixels de arte), com a
  // base na linha y (a de baixo dos cascos), nas cores da rampa do chão (o chão e 1 degrau acima e abaixo). O padrão sai
  // de semente (a cena), sem Math.random; cobre a última linha do casco (some o brilho dela) só onde há fio.
  // tapete (palha): antes dos fios, uma linha do próprio chão na linha y inteira (o casco afunda nela: some a última
  // linha dele, com o brilho), com as pontas recortadas
  function drawTufosFrente(ctx, cx, y, larg, chao, k, semente, tapete) {
    var Lz = luzApi(), cores = Lz ? [Lz.degrau(chao, 1), chao, Lz.degrau(chao, -1)] : [light(chao, 0.2), chao, shade(chao, 0.3)];
    var x0 = Math.round(cx - larg / 2), sd = (semente | 0) * 7 + 3, dens = tapete ? 0.55 : 0.36;
    if (tapete) {
      ctx.fillStyle = chao;
      var a = Math.round(hash2(sd, 47) * 3), b = Math.round(hash2(sd, 53) * 3);
      ctx.fillRect((x0 + a) * k, y * k, (larg - a - b) * k, k);
    }
    for (var x = 0; x < larg; x++) {
      var h = hash2(x + sd, 31);
      if (h > dens) continue;
      var alt = 1 + Math.floor(hash2(x + sd, 37) * 3), lean = hash2(x + sd, 41) < 0.5 ? 0 : (hash2(x + sd, 43) < 0.5 ? -1 : 1);
      for (var dy = 0; dy < alt; dy++) {
        ctx.fillStyle = cores[dy === alt - 1 ? 0 : (dy === 0 ? 2 : 1)];
        ctx.fillRect((x0 + x + (dy === alt - 1 ? lean : 0)) * k, (y + 1 - dy - 1) * k, k, k);
      }
    }
  }
  // sombra dos pés de um personagem que não é molde (treinador, objeto): elipse de 2 tons da rampa do chão, 2 px de arte
  // para a direita, com os pés em (cx, y) e a largura larg (pixels de arte; k = escala)
  function drawSombraPes(ctx, cx, y, larg, chao, k) {
    var Lz = luzApi(), S = Lz ? Lz.sombraDoChao(chao) : { projetada: '#9e4539', contato: '#6e2727' }, rx = larg / 2;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      var e = (dx / rx) * (dx / rx) + (dy / 1.4) * (dy / 1.4);
      if (e > 1) continue;
      ctx.fillStyle = e < 0.3 ? S.contato : S.projetada;
      ctx.fillRect((Math.round(cx) + 2 + dx) * k, (y + dy) * k, k, k);
    }
  }

  function drawHorseMolde(ctx, x, y, o, estado) {
    var k = Math.max(1, Math.round(o.scale || 1));
    var nome = chaveMolde(o.element, o.porte), M = moldes[nome];
    var quadro = estado === 'galope' ? quadroGalope(M, o.frame) : 0;
    x = Math.round(x); y = Math.round(y);
    var L = layoutMolde(nome, estado, x, y, k, o.quadro);
    crisp(ctx);
    if (o.shadow !== false) {   // sombra opaca na rampa do chão (o.chao, o.vista; padrão: terra da pista, lateral)
      var em = typeof o.chaoEm === 'function' ? { fn: o.chaoEm, chave: String(o.chaoChave || ''), x: Math.round(L.ox / L.S) - 4, y: Math.round(L.oy / L.S) - 4 } : null;
      var som = sombraMolde(nome, estado, quadro, (o.chao || '#cd683d').toLowerCase(), o.vista === 'cima' ? 'cima' : 'lateral', !!o.espelhado, em);
      ctx.drawImage(som, L.ox - 4 * L.S, L.oy - 4 * L.S, som.width * L.S, som.height * L.S);
    }
    ctx.drawImage(moldeRecolorido(nome, estado, quadro, o), L.ox, L.oy, M.w * L.S, M.h * L.S);
  }

  function drawHorse(ctx, x, y, opts) {
    opts = opts || {};
    var estado = moldsOk ? estadoMolde(opts) : null;
    if (estado) drawHorseMolde(ctx, x, y, opts, estado);
    else drawHorseCodigo(ctx, x, y, opts);
    if (opts.raridade != null) {   // depois do cavalo; Comum não tem efeito (e nem calcula a caixa)
      var R = infoRaridade(opts);
      if (R) desenhaRaridade(ctx, horseBox(x, y, opts), opts, R);
    }
  }

  // Silhueta do cavalo (com jóquei) tingida de uma cor, para o contorno de skill da corrida: o desenho
  // normal (molde ou código, sem sombra) vai para um canvas pequeno, é tingido com 'source-in' e fica no
  // cache por molde|estado|quadro|escala|cor (molde = a chave do molde, com o porte). O quadro é o que
  // drawHorse desenha de fato: com molde, o do molde (quadroGalope: 9 quadros no ciclo dos 6 do código; parado
  // e retrato = 0); sem molde, o do código
  // (e a pose parada). Desenha 4 cópias deslocadas 1 px de arte (= k px) para cima/baixo/esquerda/direita;
  // chamar ANTES de drawHorse para o contorno ficar atrás. Cache LRU com teto em bytes (8 MB), limpo junto
  // com o dos moldes (limparCacheMoldes, ao trocar de tela).
  var silCache = new LruCanvasCache(8 * 1024 * 1024);
  function drawHorseSilhouette(ctx, x, y, opts, cor, alpha) {
    opts = opts || {};
    var k = Math.max(1, Math.round(opts.scale || 1));
    var estado = moldsOk ? estadoMolde(opts) : null, key;
    if (estado) {
      var nome = chaveMolde(opts.element, opts.porte);
      key = 'm|' + nome + '|' + estado + '|' + (estado === 'galope' ? quadroGalope(moldes[nome], opts.frame) : 0);
    } else {
      key = 'c|' + opts.element + '|' + mod(Math.floor(opts.frame || 0), GALLOP.length) + '|' + (opts.idle ? 1 : 0);
    }
    key += '|' + k + '|' + cor;
    var hit = silCache.get(key);
    if (!hit) {
      var b0 = horseBox(0, 0, opts), pad = 2 * k;
      var c = document.createElement('canvas');
      c.width = Math.max(1, b0.w + 2 * pad); c.height = Math.max(1, b0.h + 2 * pad);
      var cx = c.getContext('2d');
      cx.imageSmoothingEnabled = false;
      var o2 = {};
      for (var q in opts) if (Object.prototype.hasOwnProperty.call(opts, q)) o2[q] = opts[q];
      o2.shadow = false;
      o2.raridade = null;   // faíscas, brilho e rastro mudam com o tempo e não fazem parte da silhueta
      drawHorse(cx, pad - b0.x, pad - b0.y, o2);
      cx.globalCompositeOperation = 'source-in';
      cx.fillStyle = cor;
      cx.fillRect(0, 0, c.width, c.height);
      // width/height: o LruCanvasCache conta os bytes da entrada por eles
      hit = { c: c, dx: b0.x - pad, dy: b0.y - pad, width: c.width, height: c.height };
      silCache.set(key, hit);
    }
    var prev = ctx.globalAlpha, bx = Math.round(x) + hit.dx, by = Math.round(y) + hit.dy;
    ctx.globalAlpha = prev * Math.max(0, Math.min(1, alpha == null ? 1 : alpha));
    crisp(ctx);
    ctx.drawImage(hit.c, bx - k, by);
    ctx.drawImage(hit.c, bx + k, by);
    ctx.drawImage(hit.c, bx, by - k);
    ctx.drawImage(hit.c, bx, by + k);
    ctx.globalAlpha = prev;
  }

  // Caixa (px) do que drawHorse(ctx, x, y, opts) desenha: com molde, o bbox do estado (união dos quadros do
  // galope) na posição do layout, inclusive a parte cortada pelo topo de um quadro; sem molde, o sprite 40×32.
  function horseBox(x, y, opts) {
    opts = opts || {};
    var k = Math.max(1, Math.round(opts.scale || 1));
    x = Math.round(x); y = Math.round(y);
    var estado = moldsOk ? estadoMolde(opts) : null;
    if (!estado) return { x: x, y: y, w: HORSE_W * k, h: HORSE_H * k };
    var nome = chaveMolde(opts.element, opts.porte), ref = moldes[nome].estados[estado];
    var L = layoutMolde(nome, estado, x, y, k, opts.quadro);
    return { x: L.ox + ref.esq * L.S, y: L.topo, w: (ref.dir - ref.esq) * L.S, h: L.pe - L.topo };
  }

  // ===================================================================
  // RARIDADE VISÍVEL (spec 2026-11-12-cavalos-marcas §5)
  // ===================================================================
  // drawRaridade(ctx, caixa, o): efeitos na cor da raridade (GameData.RARITIES[o.raridade].color) por cima do
  // cavalo; caixa = horseBox(x, y, o) (o drawHorse chama sozinho quando as opções trazem `raridade`). 1 px de
  // arte = u: com molde, a escala do molde (S = caixa.w ÷ colunas do bbox do estado, o inverso do horseBox);
  // sem molde, a escala k do sprite por código.
  //   • brilho da crina (Marcas.BRILHO; só com molde): a máscara dos papéis 4 e 5 do quadro, recortada na
  //     crina e pintada numa cor da raridade que SE AJUSTA À CRINA (corBrilho; brilhoCache, uma por
  //     molde|estado|quadro|cor). Uma fatia de 3 colunas (alfa BRILHO[raridade]: a mistura de 25/30/45 % dessa cor),
  //     com 1 coluna a meio alfa de cada lado, atravessa a crina da cabeça para a cauda a cada BRILHO_CICLO (1,2 s);
  //     fatia sem crina não desenha. Com o.reduzido, a fatia fica parada na coluna com mais crina da metade da
  //     cabeça (a crina do pescoço, não a cauda).
  //     A cor (corBrilho, parte 2b, 2026-11-13): o brilho é um reflexo claro, então fica a cor da raridade
  //     CLAREADA (light) em RARIDADE_CLARO (35 %) sempre que ela muda a luminância relativa (WCAG) da crina
  //     (corCrina: palette.mane, o papel 4), misturada no alfa de pico, em pelo menos BRILHO_CONTRASTE (0,05). Só
  //     quando não muda, vale a clareada ou a escurecida (shade), a de maior diferença; se nenhuma das duas chega a
  //     0,05, as duas vão mais longe (BRILHO_PASSOS, até 65 %) e fica a primeira que chega (no último passo, a de maior
  //     diferença). A cor pura some numa crina do mesmo tom (o verde do Mágico na crina verde da Grama) e a clareada,
  //     numa crina de luminância parecida (o Mágico na crina laranja do Tição: 0,005, onde fica a escurecida); o matiz
  //     fica o da raridade. Só cores, sem sorteio.
  //   • faíscas: Marcas.faiscas(o.semente, Marcas.N_FAISCAS[raridade]) (0/0/3/5/5), na caixa com margem de
  //     FAISCA_MARGEM px de arte (com o.quadro, presas na altura do quadro), no grid de arte da caixa. Cruz de
  //     1 px de arte (barra 3u × u + barra u × 3u, mesmo centro) que pisca (alfa 0,15 … 1) pelo tempo o.t e pela
  //     fase da faísca, num ciclo de FAISCA_CICLO s. Com o.reduzido, alfa fixo.
  //   • rastro (o.rastro, só Mítico, só no galope, nunca com o.reduzido): 3 faixas de 1 px de arte que acabam
  //     na âncora traseira do estado (sem molde, ANCHORS.rear) e somem para trás em 3 trechos; comprimento =
  //     a passada (RASTRO_PASSO da largura da caixa), tremulando com o tempo; cor = a da raridade clareada. As
  //     faíscas ficam na cor pura da raridade.
  // Ordem: rastro, brilho, faíscas. Comum (ou raridade fora de GameData.RARITIES) não desenha nada; nada de
  // Math.random; o globalAlpha volta ao que era. Sem o marcas.js ou o GameData (o wiki só embute o
  // sprites.js), não desenha nada.
  var BRILHO_CICLO = 1.2;
  var RARIDADE_CLARO = 0.35;   // quanto a cor da raridade é clareada (light) no rastro e no 1º passo do brilho da crina
  var BRILHO_PASSOS = [RARIDADE_CLARO, 0.45, 0.55, 0.65];   // clareada ou escurecida no brilho, da mais fiel à mais forte
  var BRILHO_CONTRASTE = 0.05;   // diferença de luminância relativa mínima entre a crina e a crina com o brilho no pico
  var FAISCA_MARGEM = 3, FAISCA_CICLO = 1.6, FAISCA_REDUZIDO = 0.85;
  var RASTRO_PASSO = 0.45;
  var RASTRO_FAIXAS = [{ dy: -2, alfa: 0.45, l: 0.8 }, { dy: 0, alfa: 0.6, l: 1 }, { dy: 2, alfa: 0.45, l: 0.65 }];
  var RASTRO_TRECHOS = [1, 0.55, 0.25];   // alfa relativo de cada terço da faixa, da traseira para trás

  function infoRaridade(o) {
    var MK = marcasApi(), GD = dadosApi(), id = o.raridade, tem = Object.prototype.hasOwnProperty;
    if (!MK || !GD || !GD.RARITIES || typeof id !== 'string' || !tem.call(GD.RARITIES, id)) return null;
    var n = tem.call(MK.N_FAISCAS, id) ? MK.N_FAISCAS[id] : 0, b = tem.call(MK.BRILHO, id) ? MK.BRILHO[id] : 0;
    var R = { MK: MK, cor: GD.RARITIES[id].color, faiscas: n > 0 ? n : 0, brilho: b > 0 ? b : 0, rastro: !!o.rastro && id === 'mitico' && !o.reduzido };
    return R.faiscas || R.brilho || R.rastro ? R : null;
  }

  function drawRaridade(ctx, caixa, o) {
    o = o || {};
    var R = infoRaridade(o);
    if (R && caixa) desenhaRaridade(ctx, caixa, o, R);
  }

  function desenhaRaridade(ctx, caixa, o, R) {
    var a0 = typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : 1, t = o.reduzido ? 0 : (Number(o.t) || 0);
    var L = layoutRaridade(caixa, o);
    if (R.rastro && L.galope) desenhaRastro(ctx, caixa, L, R, t, a0);
    if (R.brilho && L.molde) desenhaBrilho(ctx, L.molde, corBrilho(R.cor, corCrina(o), R.brilho), R.brilho, t, !!o.reduzido, a0);
    if (R.faiscas) desenhaFaiscas(ctx, caixa, o, R, L.u, t, a0);
    ctx.globalAlpha = a0;
  }

  // O layout do desenho a partir da caixa (o inverso do horseBox): px de arte, âncora traseira e, com molde,
  // a posição do molde (ox, oy, S) e o quadro.
  function layoutRaridade(caixa, o) {
    var k = Math.max(1, Math.round(o.scale || 1)), estado = moldsOk ? estadoMolde(o) : null;
    if (!estado) return { u: k, molde: null, galope: !o.idle && !o.retrato, rear: [caixa.x + ANCHORS.rear[0] * k, caixa.y + ANCHORS.rear[1] * k] };
    var nome = chaveMolde(o.element, o.porte), M = moldes[nome], ref = M.estados[estado];
    var S = Math.max(1, Math.round(caixa.w / (ref.dir - ref.esq)));
    var ox = caixa.x - ref.esq * S, oy = caixa.y + caixa.h - (ref.footY + 1) * S;
    return {
      u: S, galope: estado === 'galope', rear: [ox + ref.rear[0] * S, oy + ref.rear[1] * S],
      molde: { nome: nome, estado: estado, quadro: estado === 'galope' ? quadroGalope(M, o.frame) : 0, ox: ox, oy: oy, S: S }
    };
  }

  // Máscara da crina (papéis 4 e 5) de um quadro, recortada no retângulo da crina e pintada na cor; col[x] =
  // pixels de crina por coluna do recorte, pico = a coluna com mais crina na metade direita (a da cabeça). null se
  // o quadro não tem crina.
  function mascaraCrina(Lm, cor) {
    var key = Lm.nome + '|' + Lm.estado + '|' + Lm.quadro + '|' + cor, hit = brilhoCache.get(key);
    if (!hit) {
      var M = moldes[Lm.nome], idx = indicesMolde(M, Lm.estado, Lm.quadro), w = M.w, h = M.h;
      var x0 = w, y0 = h, x1 = -1, y1 = -1, x, y, v;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        v = idx[y * w + x];
        if (v !== 4 && v !== 5) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      hit = { c: null, width: 0, height: 0 };
      if (x1 >= 0) {
        var cw = x1 - x0 + 1, ch = y1 - y0 + 1, rec = new Uint8Array(cw * ch), col = new Uint16Array(cw), pico = 0;
        for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
          v = idx[(y0 + y) * w + x0 + x];
          if (v === 4 || v === 5) { rec[y * cw + x] = 1; col[x]++; }
        }
        // pico na metade da cabeça (direita: a crina do pescoço; a cauda, à esquerda, é mais grossa)
        for (pico = x = cw >> 1; x < cw; x++) if (col[x] > col[pico]) pico = x;
        hit = { c: pintaIndices(rec, cw, ch, [null, cor]), x0: x0, y0: y0, w: cw, h: ch, col: col, pico: pico, width: cw, height: ch };
      }
      brilhoCache.set(key, hit);
    }
    return hit.c ? hit : null;
  }

  // Luminância relativa (WCAG 2) de '#rrggbb'.
  function lumRel(c) {
    var v = hexToRgb(c).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  // A cor do brilho da crina (ver o cabeçalho do drawRaridade): a cor da raridade clareada em 35 % quando ela já muda a
  // luminância da crina misturada no alfa de pico em BRILHO_CONTRASTE; senão, a clareada ou a escurecida, a que mais
  // muda, indo mais longe (BRILHO_PASSOS) até chegar. Em cache por cor|crina|alfa (no máximo 512 entradas; depois,
  // recomeça).
  var corBrilhoCache = {}, corBrilhoN = 0;
  function corBrilho(cor, crina, alfa) {
    var key = cor + '|' + crina + '|' + alfa, hit = corBrilhoCache[key];
    if (hit) return hit;
    var L0 = lumRel(crina), melhor = light(cor, BRILHO_PASSOS[0]), i, j, c, d;
    var dMelhor = Math.abs(lumRel(mix(crina, melhor, alfa)) - L0);
    // a clareada que já aparece fica (o brilho é um reflexo claro); senão, a busca pela maior diferença
    if (!(dMelhor >= BRILHO_CONTRASTE)) dMelhor = -1;
    for (i = 0; i < BRILHO_PASSOS.length && !(dMelhor >= BRILHO_CONTRASTE); i++) {
      c = [light(cor, BRILHO_PASSOS[i]), shade(cor, BRILHO_PASSOS[i])];
      for (j = 0; j < 2; j++) {
        d = Math.abs(lumRel(mix(crina, c[j], alfa)) - L0);
        if (d > dMelhor) { dMelhor = d; melhor = c[j]; }
      }
    }
    if (++corBrilhoN > 512) { corBrilhoCache = {}; corBrilhoN = 1; }
    corBrilhoCache[key] = melhor;
    return melhor;
  }

  function desenhaBrilho(ctx, Lm, cor, alfa, t, reduzido, a0) {
    var mk = mascaraCrina(Lm, cor);
    if (!mk) return;
    // centro da fatia, em colunas do recorte: entra pela direita (cabeça) e sai pela esquerda a cada ciclo
    var c = reduzido ? mk.pico : Math.round(mk.w + 1 - frac(t / BRILHO_CICLO) * (mk.w + 3));
    var fatias = [[c - 1, 3, 1], [c - 2, 1, 0.5], [c + 2, 1, 0.5]];
    for (var i = 0; i < fatias.length; i++) {
      var sx = Math.max(0, fatias[i][0]), ex = Math.min(mk.w, fatias[i][0] + fatias[i][1]), n = 0, x;
      for (x = sx; x < ex; x++) n += mk.col[x];
      if (!n) continue;
      ctx.globalAlpha = a0 * alfa * fatias[i][2];
      ctx.drawImage(mk.c, sx, 0, ex - sx, mk.h, Lm.ox + (mk.x0 + sx) * Lm.S, Lm.oy + mk.y0 * Lm.S, (ex - sx) * Lm.S, mk.h * Lm.S);
    }
  }

  function piscar(t, fase) {
    var s = Math.sin(2 * Math.PI * (t / FAISCA_CICLO + fase));
    return s > 0 ? 0.15 + 0.85 * s * s : 0.15;
  }

  function desenhaFaiscas(ctx, caixa, o, R, u, t, a0) {
    var lista = R.MK.faiscas(o.semente >>> 0, R.faiscas), m = FAISCA_MARGEM * u;
    var W = caixa.w + 2 * m, H = caixa.h + 2 * m, q = o.quadro, topo = -Infinity, base = Infinity;
    if (q && isFinite(q.topo) && isFinite(q.base) && q.base - q.topo > 4 * u) { topo = q.topo + u; base = q.base - 2 * u; }
    ctx.fillStyle = R.cor;
    for (var i = 0; i < lista.length; i++) {
      var f = lista[i];
      var cx = caixa.x - m + Math.round(f.dx * W / u) * u, cy = caixa.y - m + Math.round(f.dy * H / u) * u;
      if (cy < topo) cy = caixa.y + Math.ceil((topo - caixa.y) / u) * u;
      if (cy > base) cy = caixa.y + Math.floor((base - caixa.y) / u) * u;
      ctx.globalAlpha = a0 * (o.reduzido ? FAISCA_REDUZIDO : piscar(t, f.fase));
      ctx.fillRect(cx - u, cy, 3 * u, u);
      ctx.fillRect(cx, cy - u, u, 3 * u);
    }
  }

  function desenhaRastro(ctx, caixa, L, R, t, a0) {
    var u = L.u, passo = Math.max(6, Math.round(RASTRO_PASSO * caixa.w / u)), x1 = L.rear[0], nT = RASTRO_TRECHOS.length;
    ctx.fillStyle = light(R.cor, RARIDADE_CLARO);
    for (var i = 0; i < RASTRO_FAIXAS.length; i++) {
      var F = RASTRO_FAIXAS[i], y = L.rear[1] + F.dy * u, fim = x1;
      var len = Math.max(nT, Math.round(passo * F.l * (0.85 + 0.15 * Math.sin(2 * Math.PI * (t * 2.5 + i / 3)))));
      for (var s = 0; s < nT; s++) {
        var ini = x1 - Math.round(len * (s + 1) / nT) * u;
        if (fim > ini) {
          ctx.globalAlpha = a0 * F.alfa * RASTRO_TRECHOS[s];
          ctx.fillRect(ini, y, fim - ini, u);
        }
        fim = ini;
      }
    }
  }

  // Âncoras nas unidades do sprite por código (some x + v·escala, y + v·escala), para o estado pedido
  // ('galope' por padrão, 'parado' ou 'retrato'), na pista (sem quadro). Com a escala, a conversão é exata
  // para aquele tamanho; sem ela, usa a proporção ideal 40 / Lref. Sem moldes: ANCHORS. O focinho é sempre NOSE.
  // porte (opcional, como o opts.porte do drawHorse): o molde do porte; fora da lista, o padrão.
  function anchorsFor(element, scale, estado, porte) {
    if (!moldsOk) return ANCHORS;
    var M = moldes[chaveMolde(element, porte)];
    var ref = M.estados[estado === 'parado' || estado === 'retrato' ? estado : 'galope'];
    var k = scale > 0 ? Math.max(1, Math.round(scale)) : 0;
    var r = k ? moldScale(k) / k : 40 / moldesLref;
    function conv(p) { return p ? [ANCHORS.nose[0] + (p[0] - ref.nose[0]) * r, FOOT_Y + 1 - (ref.footY + 1 - p[1]) * r] : null; }
    return { rear: conv(ref.rear), nose: conv(ref.nose), saddle: conv(ref.saddle) };
  }

  // Contato com o chão no galope (guia de integração, Regra 12). Pura, por molde, calculada uma vez: os cascos no chão de
  // cada quadro (grupos de pixels do molde nas 2 linhas de baixo, footY e footY − 1, com o x do meio), e o casco que
  // recua de um quadro para o seguinte (2 a 14 px para trás) é o de apoio. passada = a mediana desses recuos, em pixels
  // de arte por quadro; pousa[q] = o quadro q tem um casco que acabou de pousar (no chão, sem vir de um casco de apoio do
  // quadro anterior) — é nele que a poeira nasce.
  function cascosNoChao(idx, w, h, foot) {
    var g = [], x, ini = -1;
    for (x = 0; x <= w; x++) {
      var tem = x < w && ((foot < h && idx[foot * w + x] > 0) || (foot > 0 && idx[(foot - 1) * w + x] > 0));
      if (tem && ini < 0) ini = x;
      if (!tem && ini >= 0) { g.push((ini + x - 1) / 2); ini = -1; }
    }
    return g;
  }
  function passadaDe(quadros) {
    var n = quadros.length, recuos = [], pousa = [], pousos = [], q, a, b;
    for (q = 0; q < n; q++) { pousa.push(false); pousos.push([]); }
    for (q = 0; q < n; q++) {
      var cur = quadros[q], nx = quadros[(q + 1) % n];
      nx.forEach(function (xb) {
        var melhor = null;
        cur.forEach(function (xa) { var d = xa - xb; if (d >= 2 && d <= 14 && (melhor === null || d < melhor)) melhor = d; });
        if (melhor !== null) recuos.push(melhor);
      });
    }
    // pouso: o casco que não vem de um casco de apoio do quadro anterior e continua de apoio no seguinte (recua nele)
    function recua(de, para) { for (var i = 0; i < para.length; i++) { var d = de - para[i]; if (d >= 2 && d <= 14) return true; } return false; }
    for (q = 0; q < n; q++) {
      var ant = quadros[(q - 1 + n) % n], prox = quadros[(q + 1) % n];
      for (a = 0; a < quadros[q].length; a++) {
        var xa = quadros[q][a], veio = false;
        for (b = 0; b < ant.length; b++) if (recua(ant[b], [xa])) veio = true;
        if (!veio && recua(xa, prox)) { pousa[q] = true; pousos[q].push(xa); }
      }
    }
    recuos.sort(function (x, y) { return x - y; });
    return { passada: recuos.length ? recuos[recuos.length >> 1] : 0, pousa: pousa, pousos: pousos, cascos: quadros };
  }
  function passadaMolde(M) {
    if (M._passada) return M._passada;
    var quadros = [];
    for (var q = 0; q < M.frames; q++) quadros.push(cascosNoChao(M.galope[q], M.w, M.h, M.ancoras.galope[q].footY));
    return (M._passada = passadaDe(quadros));
  }
  // a passada e os quadros de pouso do galope (null sem moldes) e, com x/y/opts do drawHorse (corrida, sem quadro), os
  // x de tela dos cascos no chão do quadro de agora
  function contatoGalope(element, porte) { return moldsOk ? passadaMolde(moldes[chaveMolde(element, porte)]) : null; }
  function cascosNaTela(x, y, opts) {
    if (!moldsOk) return null;
    var k = Math.max(1, Math.round(opts.scale || 1)), nome = chaveMolde(opts.element, opts.porte), M = moldes[nome];
    var q = quadroGalope(M, opts.frame), L = layoutMolde(nome, 'galope', Math.round(x), Math.round(y), k, opts.quadro);
    var P = passadaMolde(M), tela = function (cx) { return L.ox + Math.round(cx) * L.S; };
    return { quadro: q, S: L.S, pe: L.pe, xs: P.cascos[q].map(tela), pousos: P.pousos[q].map(tela), passada: P.passada, quadros: M.frames };
  }

  // Contato da raia (Regra 7): sulcos e torrões na cor do chão sobre a linha dos cascos de uma raia, presos ao chão
  // (paralaxe 1,0), desenhados logo depois do cavalo dela (atrás dos das raias de baixo). Um padrão de 128 px de arte que
  // se repete, com torrões de 1 a 3 px de altura em ~1/4 das colunas: cobrem o casco só às vezes (uniforme vira barra).
  // Cores: o chão 1 degrau abaixo (sulco) e 1 acima (a crista do torrão, na luz). Pré-desenhado por chão.
  var CONTATO_W = 128, CONTATO_H = 4, contatoCache = {};
  function alturaContato(xa) {   // altura do torrão na coluna xa (pixels de arte do chão), 0 sem torrão
    var c = mod(Math.floor(xa), CONTATO_W), bloco = Math.floor(c / 4), h = hash2(bloco, 7);
    if (h > 0.34) return 0;
    var dentro = c - bloco * 4, larg = 1 + Math.floor(hash2(bloco, 11) * 3);
    if (dentro >= larg) return 0;
    return 1 + Math.floor(hash2(bloco, 13) * 3);
  }
  function faixaContato(chao) {
    if (contatoCache[chao]) return contatoCache[chao];
    var Lz = luzApi(), esc = Lz ? Lz.degrau(chao, -1) : shade(chao, 0.3), cla = Lz ? Lz.degrau(chao, 1) : light(chao, 0.2);
    var c = makeCanvas(CONTATO_W, CONTATO_H), g = c.getContext('2d');
    for (var x = 0; x < CONTATO_W; x++) {
      var a = alturaContato(x);
      if (!a) continue;
      g.fillStyle = esc; g.fillRect(x, CONTATO_H - a, 1, a);
      if (a > 1) { g.fillStyle = cla; g.fillRect(x, CONTATO_H - a, 1, 1); }
    }
    return (contatoCache[chao] = c);
  }
  // a faixa de contato de uma raia: a linha dos cascos em pe (px de tela), o chão rolado por camPx (px de tela), escala P,
  // só entre x0 e x1 (px de tela; a faixa do cavalo daquela raia, para seguir o relevo e o arco dele)
  function drawContatoRaia(ctx, x0, x1, pe, camPx, P, chao) {
    var t = faixaContato(String(chao || '#cd683d').toLowerCase()), tw = CONTATO_W * P, cam = Math.round(camPx / P) * P;
    x0 = Math.floor(x0 / P) * P; x1 = Math.ceil(x1 / P) * P;
    for (var x = x0; x < x1;) {
      var u = mod(x + cam, tw), w = Math.min(tw - u, x1 - x);   // u: a coluna do padrão (px de tela) em x
      ctx.drawImage(t, u / P, 0, w / P, CONTATO_H, x, pe - CONTATO_H * P, w, CONTATO_H * P);
      x += w;
    }
  }
  // a sombra da cerca de trás sobre a raia de cima (Regra 7): o chão 1 degrau abaixo, 1 a 2 px de altura com a borda
  // recortada, presa ao chão
  var cercaCache = {};
  function drawSombraCerca(ctx, W, y, camPx, P, chao) {
    chao = String(chao || '#cd683d').toLowerCase();
    var t = cercaCache[chao];
    if (!t) {
      var Lz = luzApi(), esc = Lz ? Lz.degrau(chao, -1) : shade(chao, 0.3);
      t = cercaCache[chao] = makeCanvas(CONTATO_W, 3);
      var g = t.getContext('2d');
      g.fillStyle = esc;
      for (var x = 0; x < CONTATO_W; x++) g.fillRect(x, 0, 1, 1 + (hash2(Math.floor(x / 3), 23) < 0.55 ? 1 : 0) + (hash2(Math.floor(x / 5), 29) < 0.2 ? 1 : 0));
    }
    var tw = CONTATO_W * P, off = mod(Math.round(camPx / P) * P, tw);
    for (var xx = -off; xx < W; xx += tw) ctx.drawImage(t, xx, y, tw, 3 * P);
  }
  // a altura do contato sob uma coluna da tela (px de tela; para o ui-test conferir se cobre o casco)
  function contatoEm(xTela, camPx, P) { return alturaContato(Math.floor((xTela + Math.round(camPx / P) * P) / P)); }

  // Para testes: o layout e o quadro do galope que drawHorse usaria (null sem moldes); porte opcional, como no drawHorse.
  function layoutTeste(element, estado, x, y, k, quadro, porte) {
    return moldsOk ? layoutMolde(chaveMolde(element, porte), estado, Math.round(x), Math.round(y), Math.max(1, Math.round(k)), quadro) : null;
  }
  function quadroGalopeTeste(element, frame, porte) { return moldsOk ? quadroGalope(moldes[chaveMolde(element, porte)], frame) : null; }

  function limparCacheMoldes() { moldCache.clear(); sombraCache.clear(); silCache.clear(); brilhoCache.clear(); textoCache.clear(); glifosCache.clear(); rascunho = null; }
  function cacheMoldes() { return moldCache.map.size; }
  function cacheSilhuetas() { return { n: silCache.map.size, bytes: silCache.bytes, max: silCache.max }; }

  // Para o comparativo.html: um quadro do molde pintado com cores livres (índice -> cor), sem cache. chave = a do
  // molde ('<porte>-<estilo>'); outra chave: null.
  function moldeCanvas(chave, estado, quadro, cores) {
    var M = moldsOk && moldes[chave];
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
    '\u21bb': ['.##..', '#..##', '#..#.', '#...#', '.###.'],   // ↻: desempate do Dado da Sorte (fx.js)
    '\u2192': ['..#..', '...#.', '#####', '...#.', '..#..'], '\u2190': ['..#..', '.#...', '#####', '.#...', '..#..'],   // → ← (vento)
    ' ': ['..', '..', '..', '..', '..']
  };
  var ACCENTS = { '́': ['..#', '.#.'], '̀': ['#..', '.#.'], '̂': ['.#.', '#.#'], '̃': ['.##', '##.'] };

  // glifos por texto: o HUD mede e desenha as mesmas strings a cada quadro (normalize('NFD') não é de graça)
  var glifosCache = new Map();
  function textGlyphs(text) {
    var k = String(text), out = glifosCache.get(k);
    if (out) return out;
    out = textGlyphsNovo(k);
    if (glifosCache.size >= 512) glifosCache.clear();
    glifosCache.set(k, out);
    return out;
  }
  function textGlyphsNovo(text) {
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
  function measureText(text, scale, fonte) {
    scale = scale || 1;
    var Fm = fonte ? fontePixel(fonte) : null;
    if (Fm) return larguraFonte(text, Fm) * scale;
    var gl = textGlyphs(text), w = 0;
    for (var i = 0; i < gl.length; i++) w += (gl[i].g[0].length + 1);
    return Math.max(0, w - 1) * scale;
  }
  // pinta os glifos de text, de uma cor, com o canto de cima da linha de base em (x, y)
  function pintaTexto(ctx, gl, x, y, s, col) {
    ctx.fillStyle = col;
    var cx = x;
    for (var i = 0; i < gl.length; i++) {
      var g = gl[i].g, gw = g[0].length;
      for (var r = 0; r < 5; r++) for (var c = 0; c < gw; c++) if (g[r][c] === '#') ctx.fillRect(cx + c * s, y + r * s, s, s);
      for (var m = 0; m < gl[i].marks.length; m++) {
        var mk = gl[i].marks[m], off = Math.floor((gw - 3) / 2);
        if (mk === '̧') { ctx.fillRect(cx + Math.floor(gw / 2) * s, y + 5 * s, s, s); continue; }
        var am = ACCENTS[mk];
        for (var rr = 0; rr < 2; rr++) for (var cc = 0; cc < 3; cc++) if (am[rr][cc] === '#') ctx.fillRect(cx + (cc + off) * s, y + (rr - 3) * s, s, s);
      }
      cx += (gw + 1) * s;
    }
  }
  // Texto pronto em canvas, por (escala, cor, texto): o HUD repete as mesmas strings a cada quadro e cada uma
  // eram 50 a 100 fillRect. A sombra é o mesmo texto em outra cor (outra entrada), colada antes — pixel a pixel
  // igual a pintar as duas passadas (só cores opacas com globalAlpha 1; senão pinta direto). LRU com teto de
  // 4 MB, limpo com os outros caches (limparCacheMoldes). Sem canvas (Node), pinta direto.
  var textoCache = new LruCanvasCache(4 * 1024 * 1024);
  var podeCanvas = (typeof document !== 'undefined' && !!document.createElement) || typeof OffscreenCanvas !== 'undefined';
  function opaca(col) { return typeof col === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(col); }
  function textoCanvas(text, gl, w, s, col) {
    var k = s + '|' + col + '|' + text, c = textoCache.get(k);
    if (c) return c;
    var acima = 0, abaixo = 5;
    for (var i = 0; i < gl.length; i++) for (var m = 0; m < gl[i].marks.length; m++) {
      if (gl[i].marks[m] === '̧') abaixo = 6; else acima = 3;
    }
    c = makeCanvas(w, (acima + abaixo) * s);
    c.acima = acima * s;
    pintaTexto(c.getContext('2d'), gl, 0, acima * s, s, col);
    textoCache.set(k, c);
    return c;
  }
  // Galmuri no canvas (etapa 2.2 da direção de arte, guia §6): os glifos rasterizados uma vez, com alfa binário, em
  // prototype/assets/fontes/galmuri-glifos.json (tools/fonte-glifos.mjs); o build os embute em window.__GLIFOS e o Node
  // lê o arquivo, então a largura e os pixels são os mesmos no jogo e nos testes. o.fonte: 'g7' (Galmuri7, 8 px), 'g9'
  // (Galmuri9, 10 px) ou 'g11' (Galmuri11 Bold, 12 px); o.scale é o tamanho do pixel da fonte (1 no buffer de arte).
  // O y é o topo da maiúscula (como na fonte 3×5); o acento sobe acima dele e a descendente desce abaixo.
  var glifosNode = null;
  function glifosApi() {
    if (typeof window !== 'undefined' && window.__GLIFOS) return window.__GLIFOS;
    if (glifosNode === null) {
      glifosNode = false;
      if (typeof require === 'function') { try { glifosNode = require('../assets/fontes/galmuri-glifos.json'); } catch (e) { glifosNode = false; } }
    }
    return glifosNode || null;
  }
  function fontePixel(id) {
    var G = glifosApi(), F = G && G.fontes && G.fontes[id];
    if (!F) return null;
    if (F.capTop == null) {   // a primeira linha acesa do "H": o topo da maiúscula
      var h = F.glifos.H || [0, 0, 0], r = 0;
      while (r < h.length - 3 && !h[3 + r]) r++;
      F.capTop = r;
    }
    return F;
  }
  function glifoDe(F, ch) { return F.glifos[ch] || F.glifos['?']; }
  function larguraFonte(text, F) {
    var w = 0, t = String(text).normalize ? String(text).normalize('NFC') : String(text);
    for (var i = 0; i < t.length; i++) w += glifoDe(F, t[i])[0];
    return w;
  }
  function pintaFonte(ctx, text, F, x, y, s, col) {
    ctx.fillStyle = col;
    var cx = x, t = String(text).normalize ? String(text).normalize('NFC') : String(text), y0 = y - F.capTop * s;
    for (var i = 0; i < t.length; i++) {
      var g = glifoDe(F, t[i]), gw = g[2], ox = cx + g[1] * s;
      for (var r = 3; r < g.length; r++) {
        var v = g[r]; if (!v) continue;
        for (var c = 0; c < gw; c++) {
          if (!((v >> (gw - 1 - c)) & 1)) continue;
          var c2 = c; while (c2 + 1 < gw && ((v >> (gw - 2 - c2)) & 1)) c2++;
          ctx.fillRect(ox + c * s, y0 + (r - 3) * s, (c2 - c + 1) * s, s);
          c = c2;
        }
      }
      cx += g[0] * s;
    }
  }
  function textoFonteCanvas(text, F, id, w, s, col) {
    var k = id + '|' + s + '|' + col + '|' + text, c = textoCache.get(k);
    if (c) return c;
    c = makeCanvas(Math.max(1, w), F.altura * s);
    c.acima = F.capTop * s;
    pintaFonte(c.getContext('2d'), text, F, 0, F.capTop * s, s, col);
    textoCache.set(k, c);
    return c;
  }
  function drawText(ctx, text, x, y, o) {
    o = o || {};
    var Fp = o.fonte ? fontePixel(o.fonte) : null;
    if (Fp) return drawTextFonte(ctx, text, x, y, o, Fp);
    var s = o.scale || 1, color = o.color || '#ffffff';
    var w = measureText(text, s);
    if (o.align === 'center') x -= Math.round(w / 2);
    else if (o.align === 'right') x -= w;
    x = Math.round(x); y = Math.round(y);
    var gl = textGlyphs(text);
    // cor translúcida ou globalAlpha < 1: colar o canvas arredonda diferente (±1 no canal); pinta direto. Texto
    // volátil (o.volatil: relógio, km/h, distâncias, números do Dado girando) muda quase a cada quadro: no cache
    // viraria um canvas novo por valor, então também pinta direto
    if (o.volatil || !podeCanvas || w <= 0 || !ctx.drawImage || ctx.globalAlpha !== 1 || !opaca(color) || (o.shadow && !opaca(o.shadow))) {
      if (o.shadow) pintaTexto(ctx, gl, x + s, y + s, s, o.shadow);
      pintaTexto(ctx, gl, x, y, s, color);
      return w;
    }
    var c;
    if (o.shadow) { c = textoCanvas(text, gl, w, s, o.shadow); ctx.drawImage(c, x + s, y + s - c.acima); }
    c = textoCanvas(text, gl, w, s, color);
    ctx.drawImage(c, x, y - c.acima);
    return w;
  }
  function drawTextFonte(ctx, text, x, y, o, F) {
    var s = o.scale || 1, color = o.color || '#ffffff', w = larguraFonte(text, F) * s;
    if (o.align === 'center') x -= Math.round(w / 2);
    else if (o.align === 'right') x -= w;
    x = Math.round(x); y = Math.round(y);
    // a sombra de 1 pixel embaixo e à direita (guia §6: nunca contorno de 4 lados)
    if (o.volatil || !podeCanvas || w <= 0 || !ctx.drawImage || ctx.globalAlpha !== 1 || !opaca(color) || (o.shadow && !opaca(o.shadow))) {
      if (o.shadow) pintaFonte(ctx, text, F, x + s, y + s, s, o.shadow);
      pintaFonte(ctx, text, F, x, y, s, color);
      return w;
    }
    var c;
    if (o.shadow) { c = textoFonteCanvas(text, F, o.fonte, w, s, o.shadow); ctx.drawImage(c, x + s, y + s - c.acima); }
    c = textoFonteCanvas(text, F, o.fonte, w, s, color);
    ctx.drawImage(c, x, y - c.acima);
    return w;
  }
  // a altura da maiúscula de uma fonte (7, 9 ou 11; a fonte 3×5 tem 5), em pixels da fonte
  function alturaFonte(fonte) {
    var F = fonte ? fontePixel(fonte) : null;
    if (!F) return 5;
    var h = F.glifos.H, r = h.length - 1; while (r > 3 && !h[r]) r--;
    return r - 3 - F.capTop + 1;
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
  // os pisos na paleta-mestra (etapa 2.3; a terra é a da amostra aprovada); cada pixel do tile sai por naMestra
  var SURF = {
    grama: { a: '#239063', b: '#239063', dark: '#165a4c', lite: '#1ebc73', edge: '#676633' },
    terra: { a: '#cd683d', b: '#cd683d', dark: '#9e4539', lite: '#e6904e', edge: '#6e2727' },
    areia: { a: '#fbb954', b: '#fbb954', dark: '#e6904e', lite: '#fdcbb0', edge: '#cd683d' }
  };

  // Névoa usa as mesmas cores apagadas do nublado (céu, colinas, gramados, arquibancada).
  function isDim(weather) { return weather === 'nublado' || weather === 'nevoa'; }
  function skyKey(weather) { return weather === 'nevoa' ? 'nublado' : weather; }

  var tileCache = new Map();
  // regiao: o piso no clima por troca de paleta (sem o escurecido e as poças de antes, que eram mistura fora da mestra)
  function surfaceTile(surface, weather, artH, regiao) {
    var key = surface + '|' + weather + '|' + artH + (regiao ? '|r' : '');
    var c = tileCache.get(key);
    if (c) return c;
    var TW = 64, S = SURF[surface] || SURF.grama;
    var cols = new Array(TW * artH);
    var wet = weather === 'chuva' && !regiao, lutT = regiao ? lutClima(weather) : null;
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
        cols[y * TW + x] = corClima(lutT, naMestra(col));
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
    // mastros das bandeirinhas (o pano é desenhado a cada quadro em drawTrack, pelo vento: FLAGS)
    for (var fx = x0 + 8; fx < x1; fx += 16) {
      for (var fy = 0; fy < 6; fy++) px(fx, fy, C('#d8d2c6'));
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

  // Primeiro plano da região (paralaxe 1,25), por cima dos cavalos: chamar depois deles, no mesmo quadro do drawTrack.
  // Sem a região (ou sem drawTrack neste quadro) não desenha nada e devolve false
  function drawTrackFront(ctx) {
    var F = frenteQuadro;
    if (!F) return false;
    var img = camadasNoClima(F.RG, F.clima).frente, P = F.P;
    if (!F.trA) camadaRepetida(ctx, img, F.camArt * 1.25, F.y, F.W, P);
    else for (var i = 0; i < F.trA.length; i++) camadaColunas(ctx, img, F.camArt * 1.25, F.y - F.trA[i][2] * P, F.trA[i][0], F.trA[i][1], P);
    return true;
  }

  // Placa com texto (borda escura), em Galmuri7: 7 da maiúscula e 2 de folga em cima e embaixo. top é o da placa de
  // 9 de antes: a de agora cresce 2 para cima, e o pé (preso no poste) fica onde estava
  function drawBoard(ctx, cx, top, text, P, bg, fg) {
    var tw = measureText(text, 1, 'g7') * P;
    var w = tw + 4 * P, h = 11 * P;
    var x = Math.round(cx - w / 2);
    top -= 2 * P;
    ctx.fillStyle = '#2e222f'; ctx.fillRect(x - P, top - P, w + 2 * P, h + 2 * P);
    ctx.fillStyle = bg; ctx.fillRect(x, top, w, h);
    ctx.fillStyle = naMestra(shade(bg, 0.25), bg); ctx.fillRect(x, top + h - P, w, P);   // a última linha, um tom abaixo
    drawText(ctx, text, x + 2 * P, top + 2 * P, { scale: P, color: fg, fonte: 'g7' });
    return { x: x, y: top, w: w, h: h };
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

  // Vento (o.wind = { intensity: 'calmo'|'brisa'|'ventania', dir: 1|-1 }; padrão brisa ←, o visual de antes):
  // bandeirinhas da arquibancada, grama da borda da pista e velocidade/sentido das nuvens.
  var FLAGS = { x: [14, 30, 46, 62, 78], cores: ['#e84a4a', '#3a7ae0', '#f2c230', '#f0f0f0', '#38b25a', '#e07ab8', '#f08a2a', '#7a5ae0'] };
  var VENTO_PISTA = {
    calmo:    { pano: 0, onda: 0, freq: 1.5, grama: 0, nuvem: 0.5 },
    brisa:    { pano: 3, onda: 1, freq: 5, grama: 1, nuvem: 1 },
    ventania: { pano: 5, onda: 1, freq: 9, grama: 2, nuvem: 2.2 }
  };
  function ventoPista(w) {
    var v = w && VENTO_PISTA[w.intensity] ? w : { intensity: 'brisa', dir: -1 };
    return { k: VENTO_PISTA[v.intensity], dir: v.dir < 0 ? -1 : 1 };
  }
  // pano de uma bandeirinha (pixels de arte a partir do topo do mastro em (mx, my)): calmo pendurado,
  // senão estendido no sentido do vento, ondulando mais rápido na ventania
  function drawFlagCloth(ctx, mx, my, P, cor, vk, dir, t, fase) {
    ctx.fillStyle = cor;
    if (!vk.pano) { ctx.fillRect(mx + P, my, P, 3 * P); ctx.fillRect(mx + 2 * P, my, P, 2 * P); return; }
    for (var c = 1; c <= vk.pano; c++) {
      var dy = Math.round(Math.sin(t * vk.freq - c * 1.1 + fase) * vk.onda * Math.min(1, c / 2)) * P;
      ctx.fillRect(mx + dir * c * P, my + dy, P, (c === vk.pano ? 1 : 2) * P);
    }
  }

  // Curvas: RaceFx (fx.js) dá o arco (curveOffset e CURVA); sem ele, a pista fica reta.
  function curvaApi() { var FX = fxApi(); return FX && FX.curveOffsetTela && FX.CURVA ? FX : null; }
  var CURVA_PLACA_M = 40;   // placas "CURVA" na cerca a cada 40 m dentro da curva

  // Hachura diagonal das subidas: em cada linha de arte r (y = laneTop + r·P) da faixa, retângulos de 3P × P
  // que começam nas colunas s ≡ org + r·P (mód. 10P), para os começos s em [ini, fim). É o mesmo desenho do
  // laço antigo (um fillRect por retângulo, 4 a 11 mil por quadro): a 1ª coluna de cada linha era
  // round(x0 − mod(camPx − r·P, 10P) + 10P) e iam enquanto o valor sem arredondar ficasse abaixo de x1; como
  // todos têm a mesma parte fracionária fr, isso vira os limites inteiros ini e fim abaixo.
  function hachuraFaixa(x0, x1, camPx, P) {
    var step = 10 * P, hx = x0 - mod(camPx, step) + step, fr = hx - Math.floor(hx);
    return { passo: step, org: mod(Math.round(hx), step), ini: x0 + (fr >= 0.5 || fr === 0 ? 1 : 0), fim: x1 + (fr >= 0.5 ? 1 : 0) };
  }
  // padrões (por P) de 10P × 10P: listras inteiras (3P de largura) e só a 1ª coluna de pixel de cada listra
  var hachuraPadroes = {};
  // cor: com a região, a listra é sólida, num tom da mestra (sem o branco a 7%)
  function hachuraPadrao(ctx, P, coluna, cor) {
    var k = P + (coluna ? 'c' : 'l') + (cor || ''), p = hachuraPadroes[k];
    if (p) return p;
    var step = 10 * P, c = makeCanvas(step, step), g = c.getContext('2d');
    g.fillStyle = cor || 'rgba(255,255,255,0.07)';
    for (var r = 0; r < 10; r++) {
      if (coluna) g.fillRect(r * P, r * P, 1, P);
      else for (var q = 0; q < (cor ? 1 : 3); q++) g.fillRect(((r + q) % 10) * P, r * P, P, P);   // sólida: listra de 1 px
    }
    return (hachuraPadroes[k] = ctx.createPattern(c, 'repeat'));
  }
  // pinta a hachura h (de hachuraFaixa) nas linhas [y, y + alt) com no máximo 6P + 1 fillRect: o miolo, onde toda
  // listra é inteira, de uma vez; nas pontas, a coluna j de cada listra (j = 0..3P−1) vale para os começos em
  // [ini, fim), ou seja, para x em [ini + j, fim + j) — a listra que começa antes de ini não aparece e a que
  // começa antes de fim sai inteira (passa de x1, como antes)
  function hachura(ctx, h, y, alt, P, cor) {
    var L = 3 * P, m0 = h.ini + L - 1, m1 = h.fim, j;
    var lis = hachuraPadrao(ctx, P, false, cor), col = hachuraPadrao(ctx, P, true, cor);
    function faixa(pat, dx, xa, xb) {
      if (xb <= xa) return;
      var ox = h.org + dx;
      ctx.fillStyle = pat;
      ctx.translate(ox, y); ctx.fillRect(xa - ox, 0, xb - xa, alt); ctx.translate(-ox, -y);
    }
    if (m1 > m0) {
      faixa(lis, 0, m0, m1);
      for (j = 0; j < L; j++) { faixa(col, j, h.ini + j, m0); faixa(col, j, m1, h.fim + j); }
    } else for (j = 0; j < L; j++) faixa(col, j, h.ini + j, h.fim + j);
  }

  // Relevo das subidas: desloca para cima as colunas da faixa [y0, Hh) (pixels do canvas), dyPx(x) ≥ 0 por
  // coluna de P pixels, em trechos de mesmo deslocamento; o rodapé exposto de cada trecho recebe `fundo`.
  // A faixa é copiada UMA vez para um canvas de rascunho e colada de lá: copiar o canvas sobre ele mesmo,
  // trecho a trecho, faz o navegador tirar uma cópia da tela inteira a cada drawImage (~120 ms por quadro
  // numa subida em 1280 px; ~11 ms assim). Sem document (Node), copia do próprio canvas. Devolve o nº de
  // trechos. (O arco das curvas não copia pixels: cada peça da faixa já é desenhada no lugar — mais barato.)
  var rascunho = null;
  function deslocaFaixa(ctx, W, Hh, y0, P, dyPx, fundo) {
    var trechos = [], xa = -1, dyA = 0;
    for (var x = 0; x < W; x += P) {
      var dy = dyPx(x);
      if (dy !== dyA || xa < 0) { if (xa >= 0 && dyA > 0) trechos.push([xa, x, dyA]); xa = x; dyA = dy; }
    }
    if (xa >= 0 && dyA > 0) trechos.push([xa, W, dyA]);
    if (!trechos.length) return 0;
    var h = Hh - y0, src = ctx.canvas, sy = y0;
    var c0 = trechos[0][0], c1 = trechos[trechos.length - 1][1];
    if (typeof document !== 'undefined' && document.createElement) {
      if (!rascunho) rascunho = document.createElement('canvas');
      // do tamanho exato da faixa: troca de tamanho (girar o celular) também encolhe
      if (rascunho.width !== W || rascunho.height !== h) { rascunho.width = W; rascunho.height = h; }
      var rc = rascunho.getContext('2d');
      rc.imageSmoothingEnabled = false;
      rc.drawImage(ctx.canvas, c0, y0, c1 - c0, h, c0, 0, c1 - c0, h);
      src = rascunho; sy = 0;
    }
    for (var i = 0; i < trechos.length; i++) {
      var tr = trechos[i], w = tr[1] - tr[0];
      ctx.drawImage(src, tr[0], sy, w, h, tr[0], y0 - tr[2], w, h);
      ctx.fillStyle = fundo; ctx.fillRect(tr[0], Hh - tr[2], w, tr[2]);
    }
    return trechos.length;
  }

  // ---------------------------------------------------------------------------
  // Camadas das regiões (etapa 2.3 da direção de arte; guia §7 e §8a): window.__REGIOES (build) vira Image no game.js e
  // chega aqui por setRegioes({ regiao: { posicao, camadas: { nuvens, horizonte, meio, arquibancada, frente } } }).
  // Sem a região pronta, a pista cai no cenário por código de antes. Posições como na amostra (prototype/arte/amostra.js),
  // contadas a partir do topo da pista (laneTop): céu até laneTop; nuvens com o topo em laneTop − 110; horizonte com o pé
  // em laneTop − 32; meio com o pé em laneTop + 26 (+ posicao.meio); arquibancada com o pé em laneTop − 6, a cada 2600 px
  // da sua paralaxe; faixa de grama de laneTop − 16 a laneTop; primeiro plano (drawTrackFront) com o topo no pé da pista
  // − 3. Paralaxe (fração da câmera): nuvens 0,04 (mais o vento), horizonte 0,1, meio 0,3, arquibancada 0,75, pista 1,
  // primeiro plano 1,25; cada camada arredondada para o pixel de arte.
  // ---------------------------------------------------------------------------
  var CAMADAS_REGIAO = ['nuvens', 'horizonte', 'meio', 'arquibancada', 'frente'];
  var regioesImg = {};
  function setRegioes(m) { regioesImg = m || {}; }
  function regiaoPronta(id) {
    var r = id && regioesImg[id];
    if (!r || !r.camadas) return null;
    for (var i = 0; i < CAMADAS_REGIAO.length; i++) if (!r.camadas[CAMADAS_REGIAO[i]]) return null;
    return r;
  }
  // Clima por troca de paleta (guia §3; a mesma conta da amostra): cada cor da mestra misturada k com o rumo e levada de
  // volta à mestra. Sol = a paleta como está. As camadas da região, a faixa de grama, o céu, o piso e as cercas trocam
  // juntos, uma vez por região e clima (pré-desenhados, guia §9).
  var CLIMA_PALETA = { nublado: ['#7f708a', 0.38], chuva: ['#323353', 0.42], nevoa: ['#c7dcd0', 0.5] };
  var lutClimas = {};
  // a LUT de um clima: por degrau de rampa (Luz.lutCondicao; guia de integração, Regra 8), que não funde os tons; sem o
  // luz.js, a mistura com a tinta do clima levada à mestra (o jeito antigo)
  function lutClima(clima) {
    if (lutClimas[clima]) return lutClimas[clima];
    var cl = CLIMA_PALETA[clima], t = {}, Lz = luzApi();
    if (Lz && Lz.lutCondicao) {
      var L = Lz.lutCondicao(cl ? clima : 'sol');
      MESTRA.forEach(function (h) { t['#' + h] = L['#' + h] || '#' + h; });
    } else MESTRA.forEach(function (h) { t['#' + h] = cl ? naMestra(mix('#' + h, cl[0], cl[1])) : '#' + h; });
    return (lutClimas[clima] = t);
  }
  function corClima(lut, c) { return (lut && lut[c]) || c; }
  // uma imagem com as cores trocadas pelo lut (pixels opacos; as cores fora da mestra vão antes para a mais próxima)
  function remapeia(img, lut) {
    var c = makeCanvas(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    var d = g.getImageData(0, 0, img.width, img.height), px = d.data, memo = {};
    for (var i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      var k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2], o = memo[k];
      if (!o) { o = hexToRgb(corClima(lut, naMestra(rgbToHex(px[i], px[i + 1], px[i + 2])))); memo[k] = o; }
      px[i] = o[0]; px[i + 1] = o[1]; px[i + 2] = o[2];
    }
    g.putImageData(d, 0, 0);
    return c;
  }
  // as camadas de uma região num clima (cache na própria região)
  function camadasNoClima(RG, clima) {
    if (clima === 'sol' || !CLIMA_PALETA[clima]) return RG.camadas;
    RG.porClima = RG.porClima || {};
    if (RG.porClima[clima]) return RG.porClima[clima];
    var lut = lutClima(clima), out = {};
    CAMADAS_REGIAO.forEach(function (k) { out[k] = remapeia(RG.camadas[k], lut); });
    out.grama = remapeia(faixaGrama(), lut);
    return (RG.porClima[clima] = out);
  }
  // pré-desenha os climas da corrida (o game.js chama na largada, para a virada de clima não custar um quadro)
  function prepararRegiao(id, climas) {
    var RG = regiaoPronta(id);
    if (!RG) return false;
    (climas || []).forEach(function (c) { camadasNoClima(RG, c); });
    return true;
  }
  // o céu em 4 faixas da paleta com 2 linhas de pontilhado entre elas (guia §3: sem degradê suave); limites como na
  // amostra (0, 26, 64 e 100 de 128 até o chão), nas cores do clima
  var CEU_REGIAO = ['#4d65b4', '#4d9be6', '#8fd3ff', '#c7dcd0'];
  var ceuCache = new Map();
  function ceuRegiao(clima, alto) {
    var lut = lutClima(CLIMA_PALETA[clima] ? clima : 'sol'), cores = CEU_REGIAO.map(function (c) { return corClima(lut, c); });
    var key = cores.join() + '|' + alto, c = ceuCache.get(key);
    if (c) return c;
    c = makeCanvas(4, Math.max(1, alto));
    var g = c.getContext('2d'), lim = [0, 26, 64, 100].map(function (v) { return alto - 128 + v; });
    for (var i = 0; i < 4; i++) {
      var y0 = i === 0 ? 0 : Math.max(0, lim[i]), y1 = i < 3 ? lim[i + 1] : alto;   // a 1ª faixa vai até o topo
      if (y1 <= 0) continue;
      g.fillStyle = cores[i]; g.fillRect(0, y0, 4, y1 - y0);
      if (i < 3 && y1 - 2 >= 0) {
        g.fillStyle = cores[i + 1]; g.fillRect(0, y1 - 2, 1, 1); g.fillRect(2, y1 - 2, 1, 1); g.fillRect(0, y1 - 1, 4, 1);
        g.fillStyle = cores[i]; g.fillRect(1, y1 - 1, 1, 1);
      }
    }
    if (ceuCache.size > 20) ceuCache.clear();
    ceuCache.set(key, c);
    return c;
  }
  // véu da névoa: pontilhado em xadrez de 50% na cor clara, de laneTop − 88 (rareando) até laneTop + 10 (guia §3)
  var veuCache = null;
  function veuNevoa(W, lt) {
    var key = W + '|' + lt;
    if (veuCache && veuCache.key === key) return veuCache.c;
    // (por ImageData: um fillRect por pixel passava do teto de chamadas do quadro em que a névoa aparece)
    var h = Math.max(1, lt + 10), w = Math.max(1, W), c = makeCanvas(w, h), g = c.getContext('2d');
    var img = g.createImageData(w, h), d = img.data, cor = hexToRgb('#c7dcd0');
    for (var y = Math.max(0, lt - 88); y < h; y++) {
      var r = y - (lt - 88);
      for (var x = y % 2; x < w; x += 2) if (r > 30 || hash2(x, y) < r / 30) {
        var i = (y * w + x) * 4; d[i] = cor[0]; d[i + 1] = cor[1]; d[i + 2] = cor[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    veuCache = { key: key, c: c };
    return c;
  }
  var solRegiao = null;
  function solDaRegiao() {
    if (solRegiao) return solRegiao;
    var c = makeCanvas(23, 23), g = c.getContext('2d');
    for (var y = 0; y < 23; y++) for (var x = 0; x < 23; x++) {
      var d = Math.sqrt((x - 11) * (x - 11) + (y - 11) * (y - 11));
      if (d <= 7) g.fillStyle = '#ffffff';
      else if (d <= 9 || (d <= 11 && (x + y) % 2 === 0)) g.fillStyle = '#fbff86';
      else continue;
      g.fillRect(x, y, 1, 1);
    }
    return (solRegiao = c);
  }
  // a faixa de grama atrás da cerca de trás (16 de altura, 384 de largura, emenda nas pontas), presa à pista
  var gramaFaixa = null;
  function faixaGrama() {
    if (gramaFaixa) return gramaFaixa;
    var c = makeCanvas(384, 16), g = c.getContext('2d');
    g.fillStyle = '#239063'; g.fillRect(0, 0, 384, 16);
    for (var x = 0; x < 384; x++) {
      var t = hash2(x, 7);
      if (t < 0.35) { g.fillStyle = '#1ebc73'; g.fillRect(x, t < 0.12 ? 1 : 2, 1, 2); }
      if (hash2(x, 9) < 0.18) { g.fillStyle = '#165a4c'; g.fillRect(x, 14, 1, 2); }
    }
    return (gramaFaixa = c);
  }
  // camada repetida na horizontal, deslocada desloc pixels de arte (arredondado), com o topo em y (pixels do canvas)
  function camadaRepetida(ctx, img, desloc, y, W, P) {
    var w = img.width * P, x = -mod(Math.floor(desloc) * P, w);
    for (; x < W; x += w) ctx.drawImage(img, x, y, w, img.height * P);
  }
  // a mesma camada só nas colunas [xa, xb) do canvas: um drawImage por emenda atravessada (1 ou 2), sem recorte
  // (no arco das curvas, um trecho de colunas por subida; guia §9: poucas chamadas por quadro)
  function camadaColunas(ctx, img, desloc, y, xa, xb, P) {
    var w = img.width, a = Math.round(xa / P), b = Math.round(xb / P), sx = mod(a + Math.floor(desloc), w);
    while (a < b) {
      var n = Math.min(b - a, w - sx);
      ctx.drawImage(img, sx, 0, n, img.height, a * P, y, n * P, img.height * P);
      a += n; sx = 0;
    }
  }
  // o fundo da região: céu, sol, nuvens, horizonte e meio (a arquibancada e a faixa de grama vêm depois, com o arco)
  function fundoRegiao(ctx, RG, W, laneTop, camArt, t, weather, vento, P) {
    var lt = Math.round(laneTop / P), cm = camadasNoClima(RG, weather);
    ctx.drawImage(ceuRegiao(weather, lt), 0, 0, W, lt * P);
    if (weather === 'sol') ctx.drawImage(solDaRegiao(), 100 * P, (lt - 104) * P, 23 * P, 23 * P);   // à esquerda (a luz vem de cima e da esquerda), fora do minimapa
    camadaRepetida(ctx, cm.nuvens, camArt * 0.04 - vento.dir * t * 3 * (vento.k.nuvem || 1), (lt - 110) * P, W, P);
    camadaRepetida(ctx, cm.horizonte, camArt * 0.1, (lt - 32 - cm.horizonte.height) * P, W, P);
    if (weather === 'nevoa') ctx.drawImage(veuNevoa(Math.ceil(W / P), lt), 0, 0, Math.ceil(W / P) * P, (lt + 10) * P);
    camadaRepetida(ctx, cm.meio, camArt * 0.3, (lt + 26 - cm.meio.height + ((RG.posicao || {}).meio || 0)) * P, W, P);
  }
  // o que drawTrack deixou para o primeiro plano do mesmo quadro (drawTrackFront): os trechos do arco das curvas
  var frenteQuadro = null;

  function drawTrack(ctx, o) {
    var W = o.width, Hh = o.height;
    var lanes = o.lanes || 6, laneH = o.laneH || 24, laneTop = o.laneTop || Math.round(Hh * 0.35);
    var ppm = Math.max(0.05, o.pxPerMeter || 4), cam = o.cameraX || 0, t = o.t || 0;
    var weather = skyKey(o.weather || 'sol'), surface = o.surface || 'grama';
    var P = o.pixel || Math.max(1, Math.round(laneH / 12));
    var trackH = lanes * laneH, trackBottom = laneTop + trackH;
    // camPx: quanto o cenário já rolou, em pixels (texturas, cercas, camadas da região). Com a câmera que muda de escala
    // (o zoom da corrida), o jogo manda o rolar acumulado (o.camPx): cam × ppm daria um salto no fundo a cada mudança de ppm
    var camPx = o.camPx != null ? +o.camPx : cam * ppm, vento = ventoPista(o.wind);
    function sx(m) { return Math.round((m - cam) * ppm); }
    crisp(ctx);
    // (weather junta a névoa ao nublado, para o cenário por código; a troca de paleta da região usa o clima de verdade)
    var clima = o.weather || 'sol', RG = regiaoPronta(o.regiao), camArt = camPx / P, lutRG = RG ? lutClima(clima) : null;
    function K(c) { return corClima(lutRG, c); }   // com a região, a cor da cerca e do chão no clima (troca de paleta)
    frenteQuadro = null;
    if (RG) fundoRegiao(ctx, RG, W, laneTop, camArt, t, clima, vento, P);

    // --- céu em faixas (sem a região: o cenário por código de antes)
    var sky = SKY[weather] || SKY.sol;
    var horizon = laneTop - 22 * P; // linha do chão atrás da arquibancada
    var bandH = Math.ceil(horizon / sky.length / P) * P;
    if (!RG) {
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
      var cxp = mod(hash(ci + 40) * span - camPx * 0.02 + vento.dir * t * (3 + ci % 3) * P * vento.k.nuvem, span) - cc.width;
      var cyp = Math.round((0.08 + 0.55 * hash(ci + 70)) * (horizon - 30 * P));
      if (weather !== 'sol') cyp = Math.round((hash(ci + 70) * 0.6) * (horizon - 30 * P));
      ctx.drawImage(cc, Math.round(cxp), Math.max(0, cyp));
    }

    // montanhas distantes e colinas
    var HC = HILLS[weather] || HILLS.sol;
    // uma coluna de P pixels por pixel de arte; colunas vizinhas de mesma altura saem num fillRect só
    // (~240 por quadro nas três serras em vez de 3 × W/P)
    function ridge(par, base, amp, freq, col, seedOff) {
      ctx.fillStyle = col;
      var off = camPx * par, xa = 0, ha = 0, x;
      for (x = 0; x < W; x += P) {
        var wx = (x + off) / P;
        var hgt = base + amp * (0.65 * vnoise(wx * freq + seedOff) + 0.35 * vnoise(wx * freq * 3.1 + seedOff * 2));
        hgt = Math.round(hgt) * P;
        if (hgt !== ha) { if (x > xa) ctx.fillRect(xa, horizon - ha, x - xa, ha); xa = x; ha = hgt; }
      }
      if (x > xa) ctx.fillRect(xa, horizon - ha, x - xa, ha);
    }
    ridge(0.03, 8, 22, 0.012, HC.far, 10);
    ridge(0.08, 4, 14, 0.02, HC.mid, 50);
    // copas de árvores na colina próxima
    ridge(0.15, 2, 6, 0.08, HC.near, 90);
    }

    // --- curvas (o.curves): arco da pista NA TELA (RaceFx.curveOffsetTela, "as pontas mais altas"). Com o meio da
    // tela numa curva, a cerca, as raias e os cavalos (no game.js, com o mesmo camTela) sobem até 20 px de arte
    // nas pontas da tela e a arquibancada 10/6 disso; placas "CURVA" na cerca. Precisa do fx.js (RaceFx); sem ele
    // a pista fica reta.
    var curves = o.curves || [];
    var FXc = curves.length ? curvaApi() : null, arco = false;
    var camTela = { c: cam + W / ppm / 2, meia: W / ppm / 2 };
    if (FXc) arco = -FXc.curveOffset(curves, camTela.c) > 0;
    // quanto sobe (pixels de arte, ≥ 0) no metro m: k = 1 para a cerca e as raias, 10/6 para a arquibancada.
    // o.curveScale (0..1, padrão 1) encolhe o arco quando falta espaço acima da pista (como hillMaxLift)
    var escArco = o.curveScale >= 0 && o.curveScale < 1 ? o.curveScale : 1;
    function arcoEm(m, k) { return arco ? Math.round(-FXc.curveOffsetTela(curves, m, camTela) * (k * escArco)) || 0 : 0; }
    // trechos de colunas com a mesma subida: [xa, xb, dy em pixels de arte]
    function trechosArco(k) {
      var out = [], xa = 0, dyA = null;
      for (var x = 0; x < W; x += P) {
        var dy = arcoEm(cam + (x + P / 2) / ppm, k);
        if (dy !== dyA) { if (dyA !== null) out.push([xa, x, dyA]); xa = x; dyA = dy; }
      }
      out.push([xa, W, dyA || 0]);
      return out;
    }

    // arquibancada (tile repetido). Atrás dela, abaixo do horizonte, o pé das colinas (as frestas entre as
    // arquibancadas são transparentes; sem isso ficava o quadro anterior)
    var HCn = (HILLS[weather] || HILLS.sol).near;
    var gramC = weather === 'chuva' ? '#3f6a3c' : isDim(weather) ? '#4a7c44' : '#58944a';
    if (RG) {
      // a da região: um objeto a cada 2600 px da paralaxe 0,75 (a primeira 60 px depois da largada); na curva sobe
      // como a de código (10/6 do arco da cerca), cada trecho de colunas recortado
      var CMc = camadasNoClima(RG, clima), ar = CMc.arquibancada, arW = ar.width * P, arY = laneTop - (6 + ar.height) * P, PER_AR = 2600 * P;
      var arX0 = -mod(Math.floor(camArt * 0.75) * P, PER_AR) + 60 * P;
      var arTr = arco ? trechosArco(FXc.CURVA.arquibancada / FXc.CURVA.arco) : [[0, W, 0]];
      for (var ati = 0; ati < arTr.length; ati++) {
        var atr = arTr[ati];
        for (var axx = arX0 - PER_AR; axx < W; axx += PER_AR) {
          var ca = Math.max(axx, atr[0]), cb = Math.min(axx + arW, atr[1]);   // só as colunas do trecho (sem recorte)
          if (cb > ca) ctx.drawImage(ar, (ca - axx) / P, 0, (cb - ca) / P, ar.height, ca, arY - atr[2] * P, cb - ca, ar.height * P);
        }
      }
    } else {
    ctx.fillStyle = HCn; ctx.fillRect(0, horizon, W, laneTop - 4 * P - horizon);
    var frame = Math.floor(t * 3) % 2;
    var st = standTile(weather, frame);
    var stW = st.width * P, stH = st.height * P;
    var stY = laneTop - 4 * P - stH;
    var stOff = mod(camPx * 0.35, stW);
    var flagDim = weather === 'chuva' ? 0.35 : isDim(weather) ? 0.15 : 0;
    // desenha as arquibancadas que tocam as colunas [xa, xb), dy pixels de arte acima do lugar
    function arquibancadas(xa, xb, dy) {
      var y = stY - dy * P;
      for (var sxp = -stOff; sxp < W; sxp += stW) {
        var x0s = Math.round(sxp);
        if (x0s + stW + 8 * P <= xa || x0s - 8 * P >= xb) continue;
        ctx.drawImage(st, x0s, y, stW, stH);
        for (var fi = 0; fi < FLAGS.x.length; fi++) {
          var fxm = x0s + FLAGS.x[fi] * P;
          if (fxm + 7 * P < xa || fxm - 7 * P > xb) continue;
          var fc = FLAGS.cores[(FLAGS.x[fi] >> 4) % FLAGS.cores.length];
          drawFlagCloth(ctx, fxm, y, P, flagDim ? shade(fc, flagDim) : fc, vento.k, vento.dir, t, fi * 0.9);
        }
      }
    }
    var stTrechos = arco ? trechosArco(FXc.CURVA.arquibancada / FXc.CURVA.arco) : null;
    if (!stTrechos || (stTrechos.length === 1 && !stTrechos[0][2])) arquibancadas(0, W, 0);
    else {
      // na curva, cada trecho de colunas desliza para cima (recortado); o vão que sobra embaixo é gramado
      for (var sti = 0; sti < stTrechos.length; sti++) {
        var tr = stTrechos[sti];
        ctx.save();
        ctx.beginPath(); ctx.rect(tr[0], 0, tr[1] - tr[0], laneTop - 4 * P); ctx.clip();
        if (tr[2]) { ctx.fillStyle = HCn; ctx.fillRect(tr[0], horizon - tr[2] * P, tr[1] - tr[0], tr[2] * P); }
        arquibancadas(tr[0], tr[1], tr[2]);
        if (tr[2]) { ctx.fillStyle = gramC; ctx.fillRect(tr[0], laneTop - 4 * P - tr[2] * P, tr[1] - tr[0], tr[2] * P); }
        ctx.restore();
      }
    }

    // gramado entre arquibancada e pista
    ctx.fillStyle = gramC;
    ctx.fillRect(0, laneTop - 4 * P, W, 4 * P);
    }

    // --- faixa da pista no arco das curvas: da cerca externa à interna, tudo sobe dyX(x) pixels do canvas na
    // coluna x (0 fora das curvas). Peças por coluna (postes, tracejados, placas) usam dyX; faixas de largura
    // total são desenhadas por trecho de colunas (faixaLarga); o piso, recortado por trecho.
    var trA = arco ? trechosArco(1) : null;
    if (trA && trA.length === 1 && !trA[0][2]) trA = null;
    function dyX(x) { return trA ? arcoEm(cam + (Math.floor(x / P) * P + P / 2) / ppm, 1) * P : 0; }
    function faixaLarga(y, h) {
      if (!trA) { ctx.fillRect(0, y, W, h); return; }
      for (var i = 0; i < trA.length; i++) ctx.fillRect(trA[i][0], y - trA[i][2] * P, trA[i][1] - trA[i][0], h);
    }
    // camada presa à pista (paralaxe k) em y, acompanhando o arco: um recorte por trecho de colunas
    function camadaNoArco(img, k, y) {
      if (!trA) { camadaRepetida(ctx, img, camArt * k, y, W, P); return; }
      for (var i = 0; i < trA.length; i++) camadaColunas(ctx, img, camArt * k, y - trA[i][2] * P, trA[i][0], trA[i][1], P);
    }
    if (RG) {
      camadaNoArco(camadasNoClima(RG, clima).grama || faixaGrama(), 1, laneTop - 16 * P);
      frenteQuadro = { RG: RG, clima: clima, trA: trA, camArt: camArt, P: P, W: W, H: Hh, y: trackBottom - 3 * P };
    }

    // --- superfície da pista
    var artH = Math.ceil(trackH / P);
    var tile = surfaceTile(surface, RG ? clima : weather, artH, !!RG);
    var tw = tile.width * P;
    var tOff = mod(camPx, tw);
    function piso(xa, xb, dy) {
      for (var tx = -tOff; tx < W; tx += tw) if (tx + tw > xa && tx < xb) ctx.drawImage(tile, Math.round(tx), laneTop - dy, tw, artH * P);
    }
    if (!trA) piso(0, W, 0);
    else {
      for (var pti = 0; pti < trA.length; pti++) {
        var ptr = trA[pti];
        ctx.save(); ctx.beginPath(); ctx.rect(ptr[0], 0, ptr[1] - ptr[0], Hh); ctx.clip();
        piso(ptr[0], ptr[1], ptr[2] * P);
        ctx.restore();
      }
    }

    // divisórias de raia
    var SC = SURF[surface] || SURF.grama;
    for (var l = 1; l < lanes; l++) {
      var ly = laneTop + l * laneH;
      ctx.fillStyle = K(SC.lite);
      var dash = 6 * P, gap = 4 * P, dOff = mod(camPx, dash + gap);
      for (var dx = -dOff; dx < W; dx += dash + gap) ctx.fillRect(Math.round(dx), ly - Math.floor(P / 2) - dyX(dx + dash / 2), dash, Math.max(1, Math.floor(P / 2) || 1));
    }
    // borda escura no topo da pista (sombra da cerca)
    ctx.fillStyle = K(SC.dark); faixaLarga(laneTop, P);
    // raia destacada (a do jogador): faixa dourada translúcida com bordas tracejadas
    var hl = o.highlightLane;
    if (hl != null && hl >= 0 && hl < lanes) {
      var hly = laneTop + hl * laneH;
      // (com a região, sem o véu translúcido: só os tracejados, em ouro sólido)
      if (!RG) { ctx.fillStyle = 'rgba(242,194,48,0.12)'; faixaLarga(hly, laneH); }
      ctx.fillStyle = RG ? K('#f9c22b') : 'rgba(242,194,48,0.6)';
      var hd = 4 * P, hOff = mod(camPx, hd * 2);
      for (var hlx = -hOff; hlx < W; hlx += hd * 2) {
        var hdy = dyX(hlx + hd / 2);
        ctx.fillRect(Math.round(hlx), hly - hdy, hd, P); ctx.fillRect(Math.round(hlx), hly + laneH - P - hdy, hd, P);
      }
    }

    // --- subidas
    var hills = o.hills || [];
    for (var hi = 0; hi < hills.length; hi++) {
      var a = sx(hills[hi][0]), bb = sx(hills[hi][1]);
      if (bb < -60 * P || a > W + 60 * P) continue;
      var x0 = Math.max(0, a), x1 = Math.min(W, bb);
      if (x1 > x0) {
        if (!RG) { ctx.fillStyle = 'rgba(40,20,10,0.22)'; ctx.fillRect(x0, laneTop, x1 - x0, trackH); }
        // hachura diagonal ancorada no mundo
        hachura(ctx, hachuraFaixa(x0, x1, camPx, P), laneTop, trackH, P, RG ? K(SC.dark) : null);
      }
      // linhas amarelas de início/fim
      ctx.fillStyle = '#f9c22b';
      for (var ly2 = laneTop; ly2 < trackBottom; ly2 += 4 * P) {
        if (a >= 0 && a < W) ctx.fillRect(a, ly2, P, 2 * P);
        if (bb >= 0 && bb < W) ctx.fillRect(bb, ly2, P, 2 * P);
      }
    }

    // --- curvas: linhas tracejadas de início e fim (o arco e as placas na cerca dizem que é curva)
    for (var cvi = 0; cvi < curves.length; cvi++) {
      var ca = sx(curves[cvi][0]), cb = sx(curves[cvi][1]);
      if (cb < -60 * P || ca > W + 60 * P) continue;
      ctx.fillStyle = '#8fd3ff';
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
      var mx = sx(mm), mdy = dyX(mx);
      ctx.fillStyle = K(SC.lite);
      for (var my = laneTop; my < trackBottom; my += 3 * P) ctx.fillRect(mx, my - mdy, P, P * 2);
    }
    // largada
    var sx0 = sx(0);
    if (sx0 > -10 && sx0 < W + 10) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx0, laneTop - dyX(sx0), P, trackH); }

    // --- linha de chegada quadriculada
    var fx = sx(finishM);
    if (fx > -40 * P && fx < W + 40 * P) {
      var sq = 2 * P, fdy = dyX(fx);
      for (var fy = laneTop, k = 0; fy < trackBottom; fy += sq, k++) {
        for (var col = 0; col < 2; col++) {
          ctx.fillStyle = (k + col) % 2 ? '#ffffff' : '#2e222f';
          ctx.fillRect(fx + col * sq, fy - fdy, sq, Math.min(sq, trackBottom - fy));
        }
      }
    }

    // --- cercas (externa em cima, interna embaixo)
    function rail(y, postsUp) {
      // postes a cada 4 m
      var every = 4, ps = Math.floor((cam - 8) / every) * every;
      for (var pm = ps; pm < cam + W / ppm + 8; pm += every) {
        var pxp = sx(pm);
        ctx.fillStyle = K('#9babb2');
        ctx.fillRect(pxp, y - (postsUp ? 6 * P : 0) - dyX(pxp), P, 6 * P);
      }
      ctx.fillStyle = K('#2e222f'); faixaLarga(y - 6 * P - P, P);
      ctx.fillStyle = K('#ffffff'); faixaLarga(y - 6 * P, 2 * P);
      ctx.fillStyle = K('#9babb2'); faixaLarga(y - 4 * P, P);
      ctx.fillStyle = RG ? K('#165a4c') : 'rgba(0,0,0,0.25)'; faixaLarga(y - 3 * P, P);
    }
    rail(laneTop, true);

    // --- cerca interna e gramado interno (na curva o gramado começa mais acima: o rodapé fica maior)
    // (com a região, chão de terra escura: o primeiro plano, drawTrackFront, cobre quase tudo)
    var innerC = RG ? K('#4c3e24') : weather === 'chuva' ? '#355c38' : isDim(weather) ? '#41703f' : '#4c8a44';
    ctx.fillStyle = innerC;
    if (!trA) ctx.fillRect(0, trackBottom, W, Hh - trackBottom);
    else for (var iti = 0; iti < trA.length; iti++) ctx.fillRect(trA[iti][0], trackBottom - trA[iti][2] * P, trA[iti][1] - trA[iti][0], Hh - trackBottom + trA[iti][2] * P);
    // tufos e flores do gramado interno
    var inOff = camPx;
    for (var gi = 0; !RG && gi < 40; gi++) {
      var gw = 1200;
      var gx = mod(hash(gi + 300) * gw - inOff, gw);
      if (gx > W) continue;
      var gy = trackBottom + 4 * P + Math.round(hash(gi + 400) * Math.max(1, (Hh - trackBottom - 8 * P) / P)) * P;
      if (gy > Hh - 2 * P) continue;
      gy -= dyX(gx);
      ctx.fillStyle = weather === 'chuva' ? '#2c4c2e' : '#3a7238';
      var tufo = Math.round(vento.k.grama * (0.55 + 0.45 * Math.sin(t * vento.k.freq * 0.6 + gi))) * vento.dir * P;
      ctx.fillRect(Math.round(gx), gy, P, 2 * P); ctx.fillRect(Math.round(gx) + 2 * P, gy, P, 2 * P);
      ctx.fillRect(Math.round(gx) + 2 * P + tufo, gy - P, P, P);
      if (gi % 4 === 0) { ctx.fillStyle = gi % 8 ? '#f2e04a' : '#f0f0f0'; ctx.fillRect(Math.round(gx) + P, gy - 2 * P, P, P); }
    }
    ctx.fillStyle = K(SC.dark); faixaLarga(trackBottom, P);
    // cerca interna (postes para baixo)
    var every2 = 4, ps2 = Math.floor((cam - 8) / every2) * every2;
    for (var pm2 = ps2; pm2 < cam + W / ppm + 8; pm2 += every2) {
      var px2 = sx(pm2);
      ctx.fillStyle = K('#9babb2'); ctx.fillRect(px2, trackBottom + P - dyX(px2), P, 4 * P);
    }
    ctx.fillStyle = K('#ffffff'); faixaLarga(trackBottom + P, 2 * P);
    ctx.fillStyle = K('#2e222f'); faixaLarga(trackBottom + 3 * P, P);
    // grama da borda: folhinhas logo abaixo da cerca interna, presas ao mundo, deitando com o vento
    if (!RG && Hh - trackBottom >= 8 * P) {
      var gBase = weather === 'chuva' ? '#4a7a48' : isDim(weather) ? '#5a8c52' : '#6aa85a';
      var gPonta = weather === 'chuva' ? '#5f8f5a' : isDim(weather) ? '#76a468' : '#8cc46a';
      var camArt = camPx / P, g0 = Math.floor(camArt / 5) * 5;
      for (var gw2 = g0; (gw2 - camArt) * P < W; gw2 += 5) {
        var gh = hash(gw2 * 7 + 3);
        if (gh < 0.3) continue;
        var gx2 = Math.round((gw2 - camArt) * P), alto = gh > 0.75 ? 3 : 2;
        var ginga = Math.round(vento.k.grama * (0.55 + 0.45 * Math.sin(t * vento.k.freq * 0.6 + gw2 * 0.37))) * vento.dir;
        var yb = trackBottom + 6 * P - dyX(gx2);
        ctx.fillStyle = gBase; ctx.fillRect(gx2, yb, P, P);
        ctx.fillRect(gx2 + Math.round(ginga / 2) * P, yb - P, P, P);
        if (alto === 3) { ctx.fillStyle = gPonta; ctx.fillRect(gx2 + ginga * P, yb - 2 * P, P, P); }
      }
    }
    if (fx > -10 && fx < W + 10) { ctx.fillStyle = '#ffffff'; ctx.fillRect(fx, trackBottom - dyX(fx), 2 * P, 8 * P); }

    // --- placas (depois do campo interno; nenhuma passa da cerca para baixo), acompanhando a cerca no arco
    // placas de distância sobre a cerca externa
    for (var m2 = mStart; m2 <= mEnd; m2 += ev) {
      if (m2 >= finishM) break;
      var bx = sx(m2), bdy = dyX(bx);
      ctx.fillStyle = '#c7dcd0'; ctx.fillRect(bx, laneTop - 18 * P - bdy, P, 18 * P);
      ctx.fillStyle = '#b33831';
      for (var sy2 = laneTop - 18 * P; sy2 < laneTop - 6 * P; sy2 += 4 * P) ctx.fillRect(bx, sy2 - bdy, P, 2 * P);
      drawBoard(ctx, bx, laneTop - 28 * P - bdy, m2 + 'm', P, '#c7dcd0', '#2e222f');
    }
    // placas de subida
    for (var h2 = 0; h2 < hills.length; h2++) {
      var ha = sx(hills[h2][0]), hb = sx(hills[h2][1]);
      if (ha > -40 * P && ha < W + 40 * P) {
        ctx.fillStyle = '#4c3e24'; ctx.fillRect(ha, laneTop - 16 * P, P, 16 * P);
        var bd = drawBoard(ctx, ha, laneTop - 26 * P, 'SUBIDA', P, '#f9c22b', '#2e222f');
        // rampinha
        ctx.fillStyle = '#2e222f';
        for (var q = 0; q < 4; q++) ctx.fillRect(bd.x + bd.w + 2 * P + q * P, laneTop - 19 * P - q * P, P, (q + 1) * P);
      }
      if (hb > -40 * P && hb < W + 40 * P) {
        ctx.fillStyle = '#4c3e24'; ctx.fillRect(hb, laneTop - 12 * P, P, 12 * P);
        drawBoard(ctx, hb, laneTop - 22 * P, 'FIM', P, '#f9c22b', '#2e222f');
      }
    }
    // placas de curva: CURVA no poste do início, FIM no do fim e, ao longo da curva, placas "CURVA" presas
    // à cerca a cada CURVA_PLACA_M (ancoradas no mundo; longe das pontas e dos postes de distância)
    for (var c2 = 0; c2 < curves.length; c2++) {
      var ka = sx(curves[c2][0]), kb = sx(curves[c2][1]);
      if (kb < -40 * P || ka > W + 40 * P) continue;
      var c2a = curves[c2][0], c2b = curves[c2][1];
      var mp0 = Math.ceil(Math.max(c2a + 15, cam - 30 * P / ppm) / CURVA_PLACA_M) * CURVA_PLACA_M;
      for (var mp = mp0; mp < c2b - 15 && mp < cam + (W + 30 * P) / ppm; mp += CURVA_PLACA_M) {
        var dm = mod(mp, ev);
        if (dm < 8 || dm > ev - 8) continue;
        var mpx = sx(mp);
        drawBoard(ctx, mpx, laneTop - 12 * P - dyX(mpx), 'CURVA', P, '#8fd3ff', '#2e222f');
      }
      if (ka > -40 * P && ka < W + 40 * P) {
        ctx.fillStyle = '#484a77'; ctx.fillRect(ka, laneTop - 16 * P, P, 16 * P);
        drawBoard(ctx, ka, laneTop - 26 * P, 'CURVA', P, '#8fd3ff', '#2e222f');
      }
      if (kb > -40 * P && kb < W + 40 * P) {
        ctx.fillStyle = '#484a77'; ctx.fillRect(kb, laneTop - 12 * P, P, 12 * P);
        drawBoard(ctx, kb, laneTop - 22 * P, 'FIM', P, '#8fd3ff', '#2e222f');
      }
    }
    if (sx0 > -40 * P && sx0 < W + 40 * P) {
      ctx.fillStyle = '#c7dcd0'; ctx.fillRect(sx0, laneTop - 14 * P, P, 14 * P);
      drawBoard(ctx, sx0, laneTop - 24 * P, 'LARGADA', P, '#4d65b4', '#ffffff');
    }
    // poste de chegada + faixa quadriculada
    if (fx > -60 * P && fx < W + 60 * P) {
      var postTop = Math.max(22 * P, laneTop - 40 * P);
      ctx.fillStyle = '#2e222f'; ctx.fillRect(fx - P, postTop - P, 4 * P, laneTop - postTop + P);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(fx, postTop, 2 * P, laneTop - postTop);
      // disco vermelho no topo
      ctx.fillStyle = '#2e222f'; ctx.fillRect(fx - 3 * P, postTop - 7 * P, 8 * P, 7 * P);
      ctx.fillStyle = '#e83b3b'; ctx.fillRect(fx - 2 * P, postTop - 6 * P, 6 * P, 5 * P);
      ctx.fillStyle = '#f68181'; ctx.fillRect(fx - P, postTop - 5 * P, 2 * P, P);
      // bandeira quadriculada ondulando
      var fw = 14, fh = 8;
      for (var bxi = 0; bxi < fw; bxi++) {
        var wave = Math.round(Math.sin(t * 6 - bxi * 0.6) * 1.2);
        for (var byi = 0; byi < fh; byi++) {
          ctx.fillStyle = ((bxi >> 1) + (byi >> 1)) % 2 ? '#2e222f' : '#ffffff';
          ctx.fillRect(fx + 2 * P + bxi * P, postTop + 2 * P + (byi + wave) * P, P, P);
        }
      }
      drawBoard(ctx, fx + P, postTop - 19 * P, 'CHEGADA', P, '#2e222f', '#ffffff');
    }

    // --- relevo das subidas: copia as colunas da faixa (da cerca externa para baixo) para cima
    if (hills.length && o.hillRelief !== false) {
      deslocaFaixa(ctx, W, Hh, laneTop - 8 * P, P, function (x) { return hillLiftAt(cam + (x + P / 2) / ppm, hills, o.hillMaxLift) * P; }, innerC);
    }
  }

  // RaceFx (fx.js) carregado no navegador ou no Node; sem ele, null (a pista fica reta)
  function fxApi() {
    if (typeof self !== 'undefined' && self.RaceFx) return self.RaceFx;
    if (typeof global !== 'undefined' && global.RaceFx) return global.RaceFx;
    return null;
  }
  // Marcas (marcas.js) e GameData (data.js): no Node, os do require do topo; no navegador, os globais (o build
  // carrega os dois antes do sprites.js). Sem eles (o wiki embute só o sprites.js): sem marcas, jóquei e raridade.
  function marcasApi() { return MARCAS_NODE || (typeof self !== 'undefined' && self.Marcas) || null; }
  function dadosApi() { return DADOS_NODE || (typeof self !== 'undefined' && self.GameData) || null; }
  function luzApi() { return LUZ_NODE || (typeof self !== 'undefined' && self.Luz) || null; }

  var api = {
    HORSE_W: HORSE_W, HORSE_H: HORSE_H, GALLOP_FRAMES: GALLOP.length, FOOT_Y: FOOT_Y, MOLDE_CORES_FIXAS: MOLDE_CORES_FIXAS,
    pixelsSombra: pixelsSombra, passadaDe: passadaDe, cascosNoChao: cascosNoChao, contatoGalope: contatoGalope, cascosNaTela: cascosNaTela, drawContatoRaia: drawContatoRaia, drawSombraCerca: drawSombraCerca, contatoEm: contatoEm, imagemNaCena: imagemNaCena, sombreiaPelagem: sombreiaPelagem, coresTons: coresTons, chaoDaImagem: chaoDaImagem, corDoPiso: corDoPiso, corDoChaoEm: corDoChaoEm, drawSombraPes: drawSombraPes, drawTufosFrente: drawTufosFrente,
    // pontos úteis em pixels nativos (multiplique pela escala): traseira p/ rastro, focinho, sela.
    // Com moldes, use anchorsFor(element, scale, estado): mesmas unidades, já convertidas.
    ANCHORS: ANCHORS,
    PALETTES: PALETTES,
    SILKS: SILKS,
    randomPalette: randomPalette,
    ELEMENTS: ['fogo', 'agua', 'grama'],   // os três tipos do v3 (a paleta e o estilo 'neutro' ficam como queda)
    drawHorse: drawHorse,
    alturaFonte: alturaFonte,   // a altura da maiúscula da fonte do canvas ('g7', 'g9', 'g11'; sem fonte: a 3×5)
    naMestra: naMestra,   // a cor da paleta-mestra mais perto de um hex (etapa 1b; os testes conferem as cores por ela)
    drawHorseCodigo: drawHorseCodigo,
    horseBox: horseBox,
    drawHorseSilhouette: drawHorseSilhouette,
    drawRaridade: drawRaridade,
    // moldes do PixelLab (ver a seção MOLDES)
    ESTILO_POR_ELEMENTO: ESTILO_POR_ELEMENTO,
    moldsReady: false,
    moldesConjunto: null,   // 'portes' (os 12 moldes ligados) ou null (ver loadMolds)
    loadMolds: loadMolds,
    anchorsFor: anchorsFor,
    escalaMoldeCompativel: escalaMoldeCompativel,
    limparCacheMoldes: limparCacheMoldes,
    prepararCavalo: prepararCavalo,
    moldeCanvas: moldeCanvas,
    _cacheMoldes: cacheMoldes,
    _cacheSilhuetas: cacheSilhuetas,
    _layoutMolde: layoutTeste,
    _quadroGalope: quadroGalopeTeste,
    _corBrilho: corBrilho,   // para testes: a cor do brilho da crina (cor da raridade, crina, alfa de pico)
    drawTrack: drawTrack,
    drawTrackFront: drawTrackFront,
    setRegioes: setRegioes,
    prepararRegiao: prepararRegiao,
    regiaoPronta: regiaoPronta,
    cloudCanvas: cloudCanvas,
    drawTrail: drawTrail,
    drawElementIcon: drawElementIcon,
    hillLiftAt: hillLiftAt,
    _hachuraFaixa: hachuraFaixa,
    _hachura: hachura,
    hillShape: hillShape,
    HILL_AMP: HILL_AMP,
    cacheStats: cacheStats,
    _cacheTexto: function () { return { n: textoCache.map.size, bytes: textoCache.bytes, max: textoCache.max }; },
    drawText: drawText,
    measureText: measureText
  };
  return api;
}));
