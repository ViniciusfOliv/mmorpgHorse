// prototype/arte/amostra.js — a tela da corrida refeita no padrão do guia de arte (docs/arte/guia.md), região Cerrado.
// Página própria: não usa nada de prototype/src/. Os assets chegam embutidos em window.__ARTE (build:
// prototype/tools/arte-amostra-build.mjs).
//
// Regras do guia aplicadas aqui:
//   §2  tudo é desenhado num canvas do tamanho da arte (W × H pixels de arte) e copiado para a tela com UM drawImage
//       ampliado s vezes (s inteiro, sem suavização). O molde do cavalo (64 × 64) entra 1:1.
//   §3  só cores da Resurrect 64; o cenário usa a paleta do Cerrado (32 cores); o clima troca a paleta das camadas
//       (pré-desenhadas por clima), sem alfa por quadro.
//   §4  vista lateral, luz de cima e da esquerda, perspectiva atmosférica nas chapadas.
//   §6  Galmuri 11 Bold, 9 e 7 em atlas de glifos com alfa binário.
//   §8  nas raias, só o "VOCÊ" e no máximo 2 balões; o resto no céu ou abaixo da pista.
//   §9  contagem de chamadas de desenho e tempo de JavaScript por quadro, mostrados embaixo.
(function () {
  'use strict';
  var A = window.__ARTE;

  // ---------------------------------------------------------------- paleta
  var MESTRA = ['2e222f', '3e3546', '625565', '966c6c', 'ab947a', '694f62', '7f708a', '9babb2', 'c7dcd0', 'ffffff',
    '6e2727', 'b33831', 'ea4f36', 'f57d4a', 'ae2334', 'e83b3b', 'fb6b1d', 'f79617', 'f9c22b', '7a3045',
    '9e4539', 'cd683d', 'e6904e', 'fbb954', '4c3e24', '676633', 'a2a947', 'd5e04b', 'fbff86', '165a4c',
    '239063', '1ebc73', '91db69', 'cddf6c', '313638', '374e4a', '547e64', '92a984', 'b2ba90', '0b5e65',
    '0b8a8f', '0eaf9b', '30e1b9', '8ff8e2', '323353', '484a77', '4d65b4', '4d9be6', '8fd3ff', '45293f',
    '6b3e75', '905ea9', 'a884f3', 'eaaded', '753c54', 'a24b6f', 'cf657f', 'ed8099', '831c5d', 'c32454',
    'f04f78', 'f68181', 'fca790', 'fdcbb0'];
  var REGIAO = ['4d65b4', '4d9be6', '8fd3ff', 'c7dcd0', 'ffffff', '7f708a', '9babb2', '966c6c', 'ab947a', '694f62',
    '165a4c', '239063', '1ebc73', '91db69', '547e64', '92a984', '676633', 'a2a947', '374e4a', 'f79617', 'f9c22b',
    'fbb954', '6e2727', '9e4539', 'cd683d', 'e6904e', 'b33831', '4c3e24', '2e222f', '3e3546', 'fdcbb0', 'e83b3b'];
  var C = {
    tinta: '#2e222f', sombra: '#3e3546', painel: '#313638', painel2: '#374e4a', painel3: '#547e64', texto: '#c7dcd0',
    branco: '#ffffff', ouro: '#f9c22b', ouro2: '#f79617', ouroC: '#fbb954', terra: '#cd683d', terraE: '#9e4539',
    terraEE: '#6e2727', terraC: '#e6904e', poeira: '#ab947a', grama: '#239063', gramaC: '#1ebc73', gramaE: '#165a4c',
    cinza: '#9babb2', ceu1: '#4d65b4', ceu2: '#4d9be6', ceu3: '#8fd3ff', fogo: '#fb6b1d', fogoE: '#ea4f36', agua: '#8fd3ff'
  };
  function rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function hex(c) { return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function lab(c) {
    var l = function (v) { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
    var r = l(c[0]), g = l(c[1]), b = l(c[2]);
    var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722,
      z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  function perto(c, lista) {
    var L = lab(c), best = null, bd = Infinity;
    lista.forEach(function (h) { var p = lab(rgb(h)), d = Math.pow(p[0] - L[0], 2) + Math.pow(p[1] - L[1], 2) + Math.pow(p[2] - L[2], 2); if (d < bd) { bd = d; best = h; } });
    return '#' + best;
  }
  function mistura(a, b, k) { var x = rgb(a), y = rgb(b); return [0, 1, 2].map(function (i) { return Math.round(x[i] + (y[i] - x[i]) * k); }); }

  // Climas: troca de paleta das camadas (guia §3), resolvida para a mestra.
  var CLIMAS = {
    sol: { nome: 'SOL', rumo: null, k: 0 },
    nublado: { nome: 'NUBLADO', rumo: '#7f708a', k: 0.38 },
    chuva: { nome: 'CHUVA', rumo: '#323353', k: 0.42 },
    nevoa: { nome: 'NÉVOA', rumo: '#c7dcd0', k: 0.5 }
  };
  var lutCache = {};
  function lutClima(clima) {
    if (lutCache[clima]) return lutCache[clima];
    var cl = CLIMAS[clima], t = {};
    MESTRA.forEach(function (h) { t['#' + h] = cl.rumo ? perto(mistura('#' + h, cl.rumo, cl.k), MESTRA) : '#' + h; });
    return (lutCache[clima] = t);
  }
  // perspectiva atmosférica das chapadas: 45% para o claro do céu, resolvida na paleta da região
  var lutNevoa = {};
  MESTRA.forEach(function (h) { lutNevoa['#' + h] = perto(mistura('#' + h, '#9babb2', 0.45), REGIAO); });

  // ---------------------------------------------------------------- utilidades de canvas
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); g.imageSmoothingEnabled = false; return c; }
  function carregar(src) { return new Promise(function (ok, erro) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = erro; i.src = src; }); }
  function emCanvas(img, x, y, w, h) { var c = canvas(w, h); c.getContext('2d').drawImage(img, -x, -y); return c; }
  // troca cada cor de um canvas pela da tabela (lut: '#rrggbb' -> '#rrggbb'); alfa binário
  function remapear(src, lut) {
    var c = canvas(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    var d = g.getImageData(0, 0, c.width, c.height), p = d.data, cache = {};
    for (var i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 128) { p[i + 3] = 0; continue; }
      p[i + 3] = 255;
      var k = hex([p[i], p[i + 1], p[i + 2]]), v = cache[k];
      if (!v) { v = rgb(lut[k] || perto([p[i], p[i + 1], p[i + 2]], MESTRA)); cache[k] = v; }
      p[i] = v[0]; p[i + 1] = v[1]; p[i + 2] = v[2];
    }
    g.putImageData(d, 0, 0);
    return c;
  }
  function caixaOpaca(c) {
    var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] >= 128) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  // hash determinístico (nada de Math.random: regra do projeto)
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ---------------------------------------------------------------- estado do desenho
  var folhaChuva = null;
  var g, buf, tela, gt, s = 3, W = 256, H = 330, chamadas = 0;
  function R(x, y, w, h, cor) { g.fillStyle = cor; g.fillRect(x, y, w, h); chamadas++; }
  function D(img, sx, sy, sw, sh, dx, dy, dw, dh) {
    if (arguments.length === 3) g.drawImage(img, sx, sy); else g.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    chamadas++;
  }

  // ---------------------------------------------------------------- fonte (atlas de glifos com alfa binário)
  var FONTES = { g7: { fam: 'Galmuri7A', px: 8 }, g9: { fam: 'Galmuri9A', px: 10 }, g11: { fam: 'Galmuri11BA', px: 12 } };
  var CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ºªÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç·…–—▼◀▶';
  function atlasFonte(f) {
    var m = canvas(4, 4).getContext('2d');
    m.font = f.px + 'px "' + f.fam + '"';
    var cima = m.measureText('ÁÊÔÕÃÍ'), baixo = m.measureText('gjpqyç');
    var asc = Math.ceil(Math.max(cima.actualBoundingBoxAscent || 0, f.px)) + 1, desc = Math.ceil(baixo.actualBoundingBoxDescent || 3) + 1;
    var alto = asc + desc, larg = [], total = 0;
    for (var i = 0; i < CHARS.length; i++) { var w = Math.round(m.measureText(CHARS[i]).width); larg.push(w); total += w + 2; }
    var c = canvas(total, alto), cg = c.getContext('2d');
    cg.font = m.font; cg.fillStyle = '#fff'; cg.textBaseline = 'alphabetic';
    var x = 0, glifos = {};
    for (i = 0; i < CHARS.length; i++) { cg.fillText(CHARS[i], x, asc); glifos[CHARS[i]] = { x: x, w: larg[i] }; x += larg[i] + 2; }
    var d = cg.getImageData(0, 0, c.width, c.height), p = d.data;
    for (i = 3; i < p.length; i += 4) p[i] = p[i] >= 128 ? 255 : 0;
    cg.putImageData(d, 0, 0);
    f.atlas = c; f.glifos = glifos; f.alto = alto; f.asc = asc; f.cores = {};
  }
  function atlasCor(f, cor) {
    if (f.cores[cor]) return f.cores[cor];
    var c = canvas(f.atlas.width, f.atlas.height), cg = c.getContext('2d');
    cg.drawImage(f.atlas, 0, 0); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = cor; cg.fillRect(0, 0, c.width, c.height);
    return (f.cores[cor] = c);
  }
  function larguraTexto(str, fonte) { var f = FONTES[fonte], w = 0; for (var i = 0; i < str.length; i++) { var gl = f.glifos[str[i]] || f.glifos['?']; w += gl.w; } return w; }
  // base = linha de base (o pé das maiúsculas); sombra de 1 px embaixo e à direita (guia §6)
  function texto(str, x, base, fonte, cor, sombra) {
    var f = FONTES[fonte], y = base - f.asc;
    if (sombra) texto(str, x + 1, base + 1, fonte, sombra);
    var at = atlasCor(f, cor);
    for (var i = 0; i < str.length; i++) {
      var gl = f.glifos[str[i]] || f.glifos['?'];
      if (str[i] !== ' ') D(at, gl.x, 0, gl.w + 1, f.alto, x, y, gl.w + 1, f.alto);
      x += gl.w;
    }
    return x;
  }

  // ---------------------------------------------------------------- ícones 8×8 (código; # = pixel aceso)
  var ICONES = {
    fogo: ['...#....', '...##...', '..#.#...', '..#..#..', '.#.##.#.', '.#.##.#.', '.#....#.', '..####..'],
    garra: ['#..#..#.', '#..#..#.', '.#..#..#', '.#..#..#', '..#..#..', '..#..#..', '........', '........'],
    sol: ['...#....', '.#...#..', '...##...', '#.####.#', '..####..', '...##...', '.#...#..', '...#....'],
    chuva: ['..###...', '.#####..', '########', '........', '.#..#...', '#..#..#.', '..#..#..', '........'],
    nuvem: ['........', '..###...', '.#####..', '#######.', '########', '.######.', '........', '........'],
    nevoa: ['........', '######..', '........', '.######.', '........', '######..', '........', '.######.'],
    seta: ['........', '....#...', '....##..', '#######.', '#######.', '....##..', '....#...', '........']
  };
  var iconeCache = {};
  function icone(nome, cor) {
    var k = nome + cor; if (iconeCache[k]) return iconeCache[k];
    var c = canvas(8, 8), cg = c.getContext('2d'); cg.fillStyle = cor;
    ICONES[nome].forEach(function (lin, y) { for (var x = 0; x < 8; x++) if (lin[x] === '#') cg.fillRect(x, y, 1, 1); });
    return (iconeCache[k] = c);
  }

  // ---------------------------------------------------------------- placas da interface (guia §5: contorno + bisel)
  function placa(x, y, w, h, fundo, friso) {
    R(x - 1, y, 1, h, C.tinta); R(x + w, y, 1, h, C.tinta); R(x, y - 1, w, 1, C.tinta); R(x, y + h, w, 1, C.tinta);
    R(x, y, w, h, friso || fundo);
    if (friso) R(x + 1, y + 1, w - 2, h - 2, fundo);
    R(x + (friso ? 1 : 0), y + (friso ? 1 : 0), w - (friso ? 2 : 0), 1, friso ? C.ouroC : C.painel3);
  }

  // ---------------------------------------------------------------- cena
  var Y = { railTopo: 120, pista0: 128, raia0: 130, raia: 22, n: 7 };
  Y.pistaFim = Y.raia0 + Y.n * Y.raia;      // 284
  Y.frente = Y.pistaFim + 4;               // cerca da frente
  H = Y.frente + 40;                       // 328
  var LARG = 384;                          // largura das camadas que emendam
  var camadas = {}, cenaPorClima = {};

  function prepararCamadas(imgs) {
    var ch = imgs.chapadas, cer = imgs.cerrado, fr = imgs.frente, nu = imgs.nuvens, ar = imgs.arquibancada;
    camadas.chapadas = emCanvas(ch, 0, 0, ch.width, ch.height - 5);          // tira a fileira de baixo
    camadas.cerrado = emCanvas(cer, 0, 0, cer.width, cer.height);
    camadas.frente = emCanvas(fr, 0, 0, fr.width, fr.height);
    camadas.nuvens = emCanvas(nu, 0, 0, nu.width, 56);                     // só a faixa das nuvens
    var a = emCanvas(ar, 0, 0, ar.width, ar.height), b = caixaOpaca(a);
    camadas.arquibancada = emCanvas(a, b.x, b.y, b.w, b.h);
    camadas.chapadas = remapear(camadas.chapadas, lutNevoa);
    camadas.pista = desenharPista();
    camadas.ceu = desenharCeu();
    camadas.sol = desenharSol();
  }
  // chão, cerca de trás, faixa de grama e cerca da frente: código (as texturas geradas foram reprovadas)
  function desenharPista() {
    var h = Y.frente + 6 - Y.railTopo + 8, c = canvas(LARG, h), cg = c.getContext('2d'), o = Y.railTopo - 8;
    function r(x, y, w, hh, cor) { cg.fillStyle = cor; cg.fillRect(x, y - o, w, hh); }
    // faixa de grama atrás da cerca
    r(0, o, LARG, Y.pista0 - o, C.grama);
    for (var x = 0; x < LARG; x++) {
      var t = hash(x, 7); if (t < 0.35) r(x, o + (t < 0.12 ? 1 : 2), 1, 2, C.gramaC);
      if (hash(x, 9) < 0.18) r(x, Y.pista0 - 2, 1, 2, C.gramaE);
    }
    // chão de terra
    r(0, Y.pista0, LARG, Y.frente - Y.pista0, C.terra);
    r(0, Y.pista0, LARG, 2, C.terraE);                                   // sombra da cerca
    for (var y = Y.pista0 + 2; y < Y.frente; y++) for (x = 0; x < LARG; x++) {
      var q = hash(x, y);
      if (q < 0.012) r(x, y, 1, 1, C.terraE);
      else if (q < 0.022) r(x, y, 2, 1, C.terraC);
      else if (q < 0.0235) r(x, y, 4, 1, C.terraC);
    }
    // marcas do rastelo entre as raias (claras, tracejadas) e cascos no meio das raias
    for (var k = 1; k < Y.n; k++) {
      var yy = Y.raia0 + k * Y.raia;
      for (x = 0; x < LARG; x += 8) r(x + (k % 2) * 4, yy, 4, 1, C.terraC);
    }
    for (k = 0; k < Y.n; k++) for (x = 0; x < LARG; x += 2) if (hash(x, k + 99) < 0.035) {
      var yc = Y.raia0 + k * Y.raia + 9 + Math.floor(hash(x, k) * 8);
      r(x, yc, 2, 1, C.terraE); r(x + 3, yc + 2, 2, 1, C.terraE);
    }
    // cerca de trás: dois trilhos brancos, postes a cada 16 px, luz de cima e da esquerda
    r(0, Y.railTopo, LARG, 1, C.branco); r(0, Y.railTopo + 1, LARG, 1, C.texto); r(0, Y.railTopo + 4, LARG, 1, C.texto);
    for (x = 0; x < LARG; x += 16) { r(x, Y.railTopo, 1, 9, C.branco); r(x + 1, Y.railTopo + 1, 1, 8, C.cinza); r(x + 2, Y.pista0, 2, 1, C.terraEE); }
    // cerca da frente
    r(0, Y.frente, LARG, 1, C.branco); r(0, Y.frente + 1, LARG, 1, C.texto); r(0, Y.frente - 1, LARG, 1, C.terraE);
    for (x = 8; x < LARG; x += 16) { r(x, Y.frente, 1, 6, C.branco); r(x + 1, Y.frente + 1, 1, 5, C.cinza); }
    return c;
  }
  // céu em faixas com pontilhado de 2 linhas entre elas (guia §3: sem degradê suave)
  function desenharCeu() {
    var c = canvas(4, Y.pista0), cg = c.getContext('2d');
    var faixas = [[0, C.ceu1], [26, C.ceu2], [64, C.ceu3], [100, '#c7dcd0']];
    for (var i = 0; i < faixas.length; i++) {
      var y0 = faixas[i][0], y1 = i + 1 < faixas.length ? faixas[i + 1][0] : Y.pista0;
      cg.fillStyle = faixas[i][1]; cg.fillRect(0, y0, 4, y1 - y0);
      if (i + 1 < faixas.length) { cg.fillStyle = faixas[i + 1][1]; for (var x = 0; x < 4; x += 2) { cg.fillRect(x, y1 - 2, 1, 1); cg.fillRect(x + 1, y1 - 1, 1, 1); } cg.fillRect(0, y1 - 1, 4, 1); cg.fillStyle = faixas[i][1]; cg.fillRect(1, y1 - 1, 1, 1); }
    }
    return c;
  }
  function desenharSol() {
    var c = canvas(23, 23), cg = c.getContext('2d');
    for (var y = 0; y < 23; y++) for (var x = 0; x < 23; x++) {
      var d = Math.hypot(x - 11, y - 11);
      if (d <= 7) { cg.fillStyle = C.branco; cg.fillRect(x, y, 1, 1); }
      else if (d <= 9) { cg.fillStyle = '#fbff86'; cg.fillRect(x, y, 1, 1); }
      else if (d <= 11 && (x + y) % 2 === 0) { cg.fillStyle = '#fbff86'; cg.fillRect(x, y, 1, 1); }
    }
    return c;
  }
  // todas as camadas do cenário trocadas para um clima, uma vez (guia §9: pré-desenhadas)
  function cenaDoClima(clima) {
    if (cenaPorClima[clima]) return cenaPorClima[clima];
    var lut = lutClima(clima), out = {};
    ['ceu', 'nuvens', 'chapadas', 'cerrado', 'arquibancada', 'pista', 'frente'].forEach(function (k) { out[k] = clima === 'sol' ? camadas[k] : remapear(camadas[k], lut); });
    if (clima === 'nevoa') {   // véu: pontilhado em xadrez de 50% na cor clara (guia §3)
      var v = canvas(LARG, Y.pista0 + 10), vg = v.getContext('2d'); vg.fillStyle = '#c7dcd0';
      for (var y = 40; y < v.height; y++) for (var x = (y % 2); x < LARG; x += 2) if (y > 70 || hash(x, y) < (y - 40) / 30) vg.fillRect(x, y, 1, 1);
      out.veu = v;
    }
    return (cenaPorClima[clima] = out);
  }

  // ---------------------------------------------------------------- cavalos (moldes 64×64 1:1, recoloridos na mestra)
  var CORREDORES = [
    { nome: 'Lambari', molde: 'padrao-chamas', pal: ['#c4471d', '#7f2a0e', '#ffb02e', '#ffe066'], seda: '#d8353b' },
    { nome: 'Maré', molde: 'esguio-ondas', pal: ['#9ba7b4', '#646f7e', '#5fd8ee', '#e6f4fb'], seda: '#2f6fd8' },
    { nome: 'Ipê', molde: 'robusto-folhas', pal: ['#7a4a2a', '#4c2b18', '#f5c518', '#f2e6c8'], seda: '#30b060' },
    { nome: 'Brasa', molde: 'padrao-chamas', pal: ['#d9772b', '#9a4d16', '#f7d08a', '#ff8a3d'], seda: '#f2c230', voce: true },
    { nome: 'Garoa', molde: 'padrao-ondas', pal: ['#7fa6c4', '#4f7594', '#e8f4fb', '#5ec2d9'], seda: '#8a4ad8' },
    { nome: 'Tição', molde: 'robusto-chamas', pal: ['#3a2a26', '#1e1513', '#ff5a1f', '#ffb347'], seda: '#f07a2a' },
    { nome: 'Capim', molde: 'esguio-folhas', pal: ['#9a8a4a', '#6a5e2e', '#5b7d2a', '#b9d46a'], seda: '#2ab8b0' }
  ];
  var EU = 3;
  function escurecer(h, k) { return mistura(h, '#000000', k); }
  function coresCavalo(r) {
    var coat = perto(rgb(r.pal[0]), MESTRA), som = perto(rgb(r.pal[1]), MESTRA), crina = perto(rgb(r.pal[2]), MESTRA);
    var crinaS = perto(escurecer(r.pal[2], 0.35), MESTRA), det = perto(rgb(r.pal[3]), MESTRA), seda = perto(rgb(r.seda), MESTRA);
    if (som === coat) som = perto(escurecer(coat, 0.3), MESTRA);
    if (crinaS === crina) crinaS = perto(escurecer(crina, 0.3), MESTRA);
    r.sedaPal = seda;
    // papéis do molde: 1 contorno, 2 pelo, 3 sombra do pelo, 4 crina, 5 sombra da crina, 6 detalhe, 7 seda, 8 pele, 9 sela
    return [null, C.tinta, coat, som, crina, crinaS, det, seda, '#fdcbb0', '#4c3e24'];
  }
  function prepararCavalos(moldesImgs) {
    CORREDORES.forEach(function (r) {
      var M = A.moldes[r.molde], cores = coresCavalo(r).map(function (h) { return h ? rgb(h) : null; });
      r.quadros = moldesImgs[r.molde].map(function (img) {
        var c = canvas(64, 64), cg = c.getContext('2d'); cg.drawImage(img, 0, 0);
        var d = cg.getImageData(0, 0, 64, 64), p = d.data;
        for (var i = 0; i < p.length; i += 4) {
          var v = cores[Math.round(p[i] / 25)];
          if (!v || p[i + 3] < 128) { p[i + 3] = 0; continue; }
          p[i] = v[0]; p[i + 1] = v[1]; p[i + 2] = v[2]; p[i + 3] = 255;
        }
        cg.putImageData(d, 0, 0);
        return c;
      });
      // silhueta para o brilho da skill (pré-assada: guia §9)
      if (r.voce) r.brilho = r.quadros.map(function (q) {
        var c = canvas(66, 66), cg = c.getContext('2d');
        [[0, 1], [2, 1], [1, 0], [1, 2]].forEach(function (o) { cg.drawImage(q, o[0], o[1]); });
        cg.globalCompositeOperation = 'source-in'; cg.fillStyle = C.ouro2; cg.fillRect(0, 0, 66, 66);
        return c;
      });
      var an = M.ancoras, pes = 0, narizes = [], topo = 64;
      for (var f = 0; f < 9; f++) { var a = an['galope-' + f]; pes = Math.max(pes, a.footY); narizes.push(a.nose[0]); topo = Math.min(topo, a.bbox.y); }
      narizes.sort(function (x, y) { return x - y; });
      r.pes = pes; r.nariz = narizes[4]; r.topo = topo; r.traseira = an['galope-0'].rear[0];
    });
  }

  // ---------------------------------------------------------------- corrida de mentira (determinística, só para a amostra)
  // Escala visual da câmera (pedido do Vinicius, 2026-11-20: "velocidade máxima", cenário passando rápido, mesma pista
  // e mesmo tempo de corrida). 12 px de arte por metro: a 16 m/s o chão passa a 192 px/s, quase uma tela por segundo
  // (antes 2,5 px/m: 40 px/s). O galope acompanha: ~2,3 passadas por segundo (21 quadros/s no ciclo de 9).
  var PPM = 12, GALOPE_QPS = 21, VEL = 16, DIST = 2000, DURACAO = DIST / VEL;
  function posicao(j, t) {
    return VEL * t + [2.5, -1.5, 3.5, 0, -3.5, 1, -6][j] + 2.5 * Math.sin(0.23 * t * (1 + j * 0.11) + j * 1.7) + 1.2 * Math.sin(0.61 * t + j);
  }
  function ordem(t) {
    var idx = CORREDORES.map(function (r, j) { return j; });
    return idx.sort(function (a, b) { return posicao(b, t) - posicao(a, t); });
  }
  // efeitos em ciclo de 8 s: a skill do jogador (0–2,5 s) e a Garra de um rival (4–6 s); nunca mais de 2 balões
  function efeitos(t) {
    var c = t % 8, out = [];
    if (c < 2.5) out.push({ j: EU, nome: 'LABAREDA', icone: 'fogo', cor: C.fogo, idade: c, tipo: 'skill' });
    if (c >= 4 && c < 6) out.push({ j: 1, nome: 'GARRA!', icone: 'garra', cor: C.ouro, idade: c - 4, tipo: 'garra' });
    return out;
  }

  // ---------------------------------------------------------------- quadro
  var estado = { clima: 'sol', t: 0, vel: 1, pausa: false, ultimo: 0, ms: 0, msMedia: 0, narr: '' };
  function camadaRepetida(img, desloc, y) {
    var w = img.width, x = -(((Math.floor(desloc) % w) + w) % w);
    for (; x < W; x += w) D(img, x, y);
  }
  function quadro() {
    chamadas = 0;
    var LC = lutClima(estado.clima), kc = function (c) { return LC[c] || c; };   // cores do cenário pintadas no quadro seguem o clima
    var t = estado.t, tc = t % DURACAO, cena = cenaDoClima(estado.clima), cam = posicao(EU, tc) * PPM - Math.round(W * 0.42);
    // céu, sol (de cima e da esquerda), nuvens, chapadas, cerrado, arquibancada
    D(cena.ceu, 0, 0, 4, Y.pista0, 0, 0, W, Y.pista0);
    if (estado.clima === 'sol') D(camadas.sol, 66, 24);
    camadaRepetida(cena.nuvens, cam * 0.04 + t * 3, 18);
    camadaRepetida(cena.chapadas, cam * 0.1, 96 - cena.chapadas.height);
    if (cena.veu) D(cena.veu, 0, 0, W, cena.veu.height, 0, 0, W, cena.veu.height);
    camadaRepetida(cena.cerrado, cam * 0.3, Y.railTopo - cena.cerrado.height + 34);
    var per = 2600, xa = -(((Math.floor(cam * 0.75) % per) + per) % per) + 60;
    for (; xa < W; xa += per) D(cena.arquibancada, xa, Y.railTopo - cena.arquibancada.height + 2);
    // pista (chão, cercas) e as placas de distância presas à cerca de trás (objetos do cenário: guia §8)
    camadaRepetida(cena.pista, cam, Y.railTopo - 8);
    var m0 = Math.floor(cam / PPM / 100) * 100;
    for (var m = m0; m < m0 + W / PPM + 200; m += 100) {
      if (m % 200) continue;
      var sx = Math.round(m * PPM - cam), rot = String(Math.max(0, DIST - m)), lw = larguraTexto(rot, 'g7') + 4;
      if (sx < -lw || sx > W) continue;
      R(sx, Y.railTopo - 11, 1, 12, kc(C.texto));
      placa(sx - Math.floor(lw / 2), Y.railTopo - 22, lw, 10, kc(C.texto));
      texto(rot, sx - Math.floor(lw / 2) + 2, Y.railTopo - 14, 'g7', C.tinta);
    }
    // cavalos, da raia de cima para a de baixo
    var efs = efeitos(t), chuva = estado.clima === 'chuva', fora = [];
    var info = [];
    CORREDORES.forEach(function (r, j) {
      var px = Math.round(posicao(j, tc) * PPM - cam), pes = Y.raia0 + (j + 1) * Y.raia - 4;
      var x = px - r.nariz, y = pes - r.pes, f = Math.floor(t * GALOPE_QPS + j * 2.3) % 9;
      if (x + 60 < 0 || x > W) { fora.push({ r: r, j: j, dir: x > W ? 1 : -1, y: pes - 14 }); return; }
      // sombra no chão (2 tons, 2 px para a direita: luz de cima e da esquerda)
      R(x + 14, pes, 38, 2, kc(C.terraE)); R(x + 20, pes + 1, 26, 1, kc(C.terraEE));
      // poeira dos cascos (ou respingos, na chuva), atrás do cavalo
      var rx = x + r.traseira + 2;
      for (var k = 0; k < 8; k++) {
        var idade = (t * 3.2 + k / 8 + j * 0.37) % 1;
        if (idade > 0.85) continue;
        var dx = Math.round(rx - idade * 34 - (k % 3) * 2), dy = Math.round(pes - 1 - Math.sin(idade * Math.PI) * (3 + k % 3));
        R(dx, dy, idade < 0.35 ? 2 : 1, idade < 0.35 ? 2 : 1, chuva ? (idade < 0.4 ? C.texto : C.ceu3) : kc(idade < 0.5 ? C.terraC : C.poeira));
      }
      var ef = efs.filter(function (e) { return e.j === j; })[0];
      if (ef && ef.tipo === 'skill') {
        // rastro de fogo atrás e contorno brilhante (silhueta pré-assada)
        for (k = 0; k < 14; k++) {
          var q = (t * 9 + k * 0.37) % 1, fx = Math.round(rx - 4 - q * 26 - hash(k, 3) * 6), fy = Math.round(y + 26 + hash(k, f) * 16 - q * 8);
          R(fx, fy, q < 0.3 ? 2 : 1, q < 0.3 ? 2 : 1, q < 0.25 ? '#fbff86' : q < 0.6 ? C.ouro : C.fogo);
        }
        if (Math.floor(t * 8) % 2 === 0) D(r.brilho[f], x - 1, y - 1);
      }
      if (ef && ef.tipo === 'garra') for (k = 0; k < 3; k++) {     // linhas de velocidade
        var lx = x + 6 - ((Math.floor(t * 40) + k * 9) % 18), ly = y + 20 + k * 6;
        R(lx - 10, ly, 8, 1, C.texto);
      }
      D(r.quadros[f], x, y);
      info.push({ r: r, j: j, x: x, y: y, ef: ef });
    });
    // chuva: pingos inclinados pelo vento (≤ 150 partículas)
    // (140 pingos pré-desenhados numa folha da altura da tela; por quadro, 2 cópias deslocadas: guia §9)
    if (chuva) {
      if (!folhaChuva || folhaChuva.width !== W + 64) {
        folhaChuva = canvas(W + 64, H);
        var fg = folhaChuva.getContext('2d');
        for (var p = 0; p < 140; p++) {
          fg.fillStyle = p % 3 ? C.ceu3 : C.texto;
          var gx = Math.floor(hash(p, 1) * (W + 64)), gy = Math.floor(hash(p, 2) * H);
          fg.fillRect(gx, gy, 1, 2); fg.fillRect(gx - 1, gy + 2, 1, 2);
        }
      }
      var dy = Math.floor((t * 220) % H), dxc = -Math.floor(dy * 0.25) % 64;
      D(folhaChuva, dxc - 32, dy - H); D(folhaChuva, dxc - 32 + Math.floor(H * 0.25) % 64 - 0, dy);
    }
    // primeiro plano: chão de fora (sólido) e capim dourado (paralaxe 1,25)
    R(0, Y.frente + 6, W, H - Y.frente - 6, kc('#4c3e24'));
    camadaRepetida(cena.frente, cam * 1.25, Y.frente - 4);
    // texto na pista: "VOCÊ" e no máximo 2 balões (guia §8)
    info.forEach(function (v) {
      var topoCav = v.y + v.r.topo;
      if (v.r.voce) {
        // acento do Ê precisa de 2 px livres acima da maiúscula (guia §6): placa de 13 com a base em +11
        var w = larguraTexto('VOCÊ', 'g7') + 5, mx = v.x + 34 - Math.floor(w / 2), my = topoCav - 17;
        placa(mx, my, w, 13, C.tinta, C.ouro);
        texto('VOCÊ', mx + 3, my + 11, 'g7', C.ouro);
        R(mx + Math.floor(w / 2) - 2, my + 14, 5, 1, C.ouro); R(mx + Math.floor(w / 2) - 1, my + 15, 3, 1, C.ouro); R(mx + Math.floor(w / 2), my + 16, 1, 1, C.ouro);
      }
      if (v.ef) {
        var bw = larguraTexto(v.ef.nome, 'g7') + 15, bx = v.x + v.r.nariz + 3, by = topoCav + 2 - Math.min(2, Math.floor(v.ef.idade * 8));
        if (bx + bw > W - 2) bx = W - 2 - bw;
        placa(bx, by, bw, 13, C.tinta, v.ef.cor);
        D(icone(v.ef.icone, v.ef.cor), bx + 3, by + 3);
        texto(v.ef.nome, bx + 12, by + 11, 'g7', C.texto);
      }
    });
    // quem está fora da tela: seta na borda com a cor da seda, na altura da raia
    fora.forEach(function (o) {
      var ax = o.dir > 0 ? W - 7 : 2;
      for (var i = 0; i < 5; i++) R(o.dir > 0 ? ax + i : ax + 4 - i, o.y - 4 + i, 1, 9 - 2 * i, C.tinta);
      for (i = 0; i < 4; i++) R(o.dir > 0 ? ax + i : ax + 4 - i, o.y - 3 + i, 1, 7 - 2 * i, o.r.sedaPal);
    });
    // HUD no céu (guia §8), com a mesma informação da tela de hoje: lugar, estamina, vento, clima, tempo e velocidade,
    // e o minimapa embaixo do lugar
    var ord = ordem(tc);
    hud(tc, ord);
    // narração e ordem: abaixo da pista (HTML)
    atualizarHtml(ord, efs, tc);
  }

  // ---------------------------------------------------------------- HUD (pixels de arte)
  var MINI = { w: 44, h: 20 }, miniPista = null;
  function desenharMini() {
    // traçado em estádio: duas retas e duas curvas; terra com a borda clara, linha de chegada embaixo no meio
    var c = canvas(MINI.w, MINI.h), cg = c.getContext('2d'), r = 8, cx0 = r + 1, cx1 = MINI.w - r - 2, cy = Math.floor(MINI.h / 2);
    function ponto(x, y, cor) { cg.fillStyle = cor; cg.fillRect(x, y, 1, 1); }
    for (var y = 0; y < MINI.h; y++) for (var x = 0; x < MINI.w; x++) {
      var dx = x < cx0 ? x - cx0 : x > cx1 ? x - cx1 : 0, d = Math.hypot(dx, y - cy);
      if (d <= r + 0.5 && d > r - 2.5) ponto(x, y, d > r - 0.5 ? C.texto : C.terra);
    }
    var mx = Math.floor((cx0 + cx1) / 2);
    for (y = cy + r - 2; y <= cy + r; y++) ponto(mx, y, (y % 2) ? C.branco : C.tinta), ponto(mx + 1, y, (y % 2) ? C.tinta : C.branco);
    MINI.cx0 = cx0; MINI.cx1 = cx1; MINI.cy = cy; MINI.r = r - 1;
    return c;
  }
  // ponto do traçado para a fração u da volta (0 = chegada, embaixo no meio, sentido anti-horário na tela)
  function pontoMini(u) {
    var L = MINI.cx1 - MINI.cx0, per = 2 * L + 2 * Math.PI * MINI.r, d = (((u % 1) + 1) % 1) * per, mx = (MINI.cx0 + MINI.cx1) / 2;
    var seg = [L / 2, Math.PI * MINI.r, L, Math.PI * MINI.r, L / 2];
    if (d < seg[0]) return [mx + d, MINI.cy + MINI.r];
    d -= seg[0];
    if (d < seg[1]) { var a = d / MINI.r; return [MINI.cx1 + Math.sin(a) * MINI.r, MINI.cy + Math.cos(a) * MINI.r]; }
    d -= seg[1];
    if (d < seg[2]) return [MINI.cx1 - d, MINI.cy - MINI.r];
    d -= seg[2];
    if (d < seg[3]) { a = d / MINI.r; return [MINI.cx0 - Math.sin(a) * MINI.r, MINI.cy - Math.cos(a) * MINI.r]; }
    d -= seg[3];
    return [MINI.cx0 + d, MINI.cy + MINI.r];
  }
  function hud(tc, ord) {
    var y = 3, h = 20, n = CORREDORES.length;
    // lugar
    var a = (ord.indexOf(EU) + 1) + 'º', b = '/' + n, w1 = larguraTexto(a, 'g11') + larguraTexto(b, 'g7') + 9;
    placa(3, y, w1, h, C.painel, C.ouro);
    var xl = texto(a, 7, y + 16, 'g11', C.ouro, C.tinta);
    texto(b, xl + 1, y + 16, 'g7', C.texto);
    // estamina: 12 segmentos
    var x2 = 3 + w1 + 5, w2 = 12 * 4 + 7, est = Math.max(0, 1 - tc / (DURACAO * 1.15)), cheios = Math.round(est * 12);
    placa(x2, y, w2, h, C.painel);
    texto('EST', x2 + 4, y + 9, 'g7', C.texto);
    for (var i = 0; i < 12; i++) R(x2 + 4 + i * 4, y + 12, 3, 5, i < cheios ? C.ouro : C.sombra);
    // tempo e velocidade (à direita), clima e vento
    var seg = Math.floor(tc), rel = Math.floor(seg / 60) + ':' + ('0' + (seg % 60)).slice(-2);
    var kmh = Math.round(VEL * 3.6 + 2 * Math.sin(tc * 0.9)) + ' KM/H';
    var w3 = Math.max(larguraTexto('0:00', 'g9'), larguraTexto('00 KM/H', 'g7')) + 8, x3 = W - 3 - w3;
    placa(x3, y, w3, h, C.painel);
    texto(rel, x3 + w3 - 4 - larguraTexto(rel, 'g9'), y + 10, 'g9', C.texto, C.tinta);
    texto(kmh, x3 + w3 - 4 - larguraTexto(kmh, 'g7'), y + 18, 'g7', C.texto);
    var cl = CLIMAS[estado.clima], w4 = Math.max(larguraTexto('CLIMA', 'g7'), larguraTexto(cl.nome, 'g7')) + 8, x4 = x3 - 4 - w4;
    placa(x4, y, w4, h, C.painel);
    texto('CLIMA', x4 + 4, y + 9, 'g7', C.cinza);
    texto(cl.nome, x4 + 4, y + 18, 'g7', C.texto);
    var w5 = 14, x5 = x4 - 4 - w5;
    placa(x5, y, w5, h, C.painel);
    D(icone('seta', C.texto), x5 + 3, y + 2);
    R(x5 + 4, y + 16, 2, 2, C.texto); R(x5 + 7, y + 14, 2, 4, C.texto); R(x5 + 10, y + 12, 2, 6, C.sombra);
    // minimapa embaixo do lugar: os corredores na volta, o jogador maior e contornado
    var my = y + h + 5;
    placa(3, my, MINI.w + 4, MINI.h + 4, C.painel);
    if (!miniPista) miniPista = desenharMini();
    D(miniPista, 5, my + 2);
    ord.slice().reverse().forEach(function (j) {
      var r = CORREDORES[j], pt = pontoMini(posicao(j, tc) / DIST), px = Math.round(5 + pt[0]), py = Math.round(my + 2 + pt[1]);
      if (r.voce) { R(px - 2, py - 2, 5, 5, C.tinta); R(px - 1, py - 1, 3, 3, C.ouro); }
      else { R(px - 1, py - 1, 3, 3, C.tinta); R(px, py, 1, 1, r.sedaPal); }
    });
  }

  // ---------------------------------------------------------------- HTML abaixo da pista (a estrutura da tela de hoje)
  // Nada é reescrito a cada quadro: a ordem no máximo 4 vezes por segundo, os vizinhos 2, a narração só com frase nova.
  var ordemHtml = '', ordemT = 0, vizT = 0, narrLog = [], narrChave = '';
  function raiaHtml(j) {
    var r = CORREDORES[j], claro = lab(rgb(r.sedaPal))[0] > 60;
    return '<span class="raia" style="background:' + r.sedaPal + ';color:' + (claro ? C.tinta : C.branco) + '">' + (j + 1) + '</span>';
  }
  function fmtRel(seg) { seg = Math.floor(seg); return Math.floor(seg / 60) + ':' + ('0' + (seg % 60)).slice(-2); }
  function metros(sinal, d) { var m = Math.max(0, Math.round(d)); return m === 0 ? 'colado' : sinal + m + ' m'; }
  function atualizarHtml(ord, efs, tc) {
    var agora = performance.now();
    if (agora - ordemT > 250) {
      ordemT = agora;
      var h = ord.map(function (j, k) {
        return '<li' + (CORREDORES[j].voce ? ' class="voce"' : '') + '><span>' + (k + 1) + 'º</span>' + raiaHtml(j) +
          '<span class="sr" style="position:absolute;left:-9999px">' + CORREDORES[j].nome + '</span></li>';
      }).join('');
      if (h !== ordemHtml) { ordemHtml = h; document.getElementById('ordem').innerHTML = h; }
    }
    if (agora - vizT > 500) {
      vizT = agora;
      var k = ord.indexOf(EU), partes = [];
      if (k === 0) partes.push('Você lidera');
      else { var f = ord[k - 1]; partes.push('À frente: <b>' + CORREDORES[f].nome + '</b> ' + metros('+', posicao(f, tc) - posicao(EU, tc))); }
      if (k < ord.length - 1) { var a = ord[k + 1]; partes.push('Atrás: <b>' + CORREDORES[a].nome + '</b> ' + metros('−', posicao(EU, tc) - posicao(a, tc))); }
      document.getElementById('vizinhos').innerHTML = partes.join(' · ');
    }
    efs.forEach(function (e) {
      var chave = e.tipo + Math.floor(estado.t / 8);
      if (narrChave.indexOf('|' + chave + '|') >= 0) return;
      narrChave = ('|' + chave + '|' + narrChave).slice(0, 80);
      var r = CORREDORES[e.j], txt = e.tipo === 'skill' ? r.nome + ' ativou LABAREDA!' : r.nome + ' mostrou GARRA na reta!';
      narrLog.unshift({ t: tc, j: e.j, txt: txt });
      narrLog.length = Math.min(narrLog.length, 2);
      document.getElementById('narr').innerHTML = narrLog.map(function (n) {
        return '<li' + (CORREDORES[n.j].voce ? ' class="voce"' : '') + '><time>' + fmtRel(n.t) + '</time>' + raiaHtml(n.j) + '<span class="ev">' + n.txt + '</span></li>';
      }).join('');
    });
  }

  // ícones do cabeçalho (moeda 9×9 e clima 8×8), desenhados em código como os da pista
  function iconeCabecalho() {
    var c = canvas(9, 9), cg = c.getContext('2d');
    for (var y = 0; y < 9; y++) for (var x = 0; x < 9; x++) {
      var d = Math.hypot(x - 4, y - 4);
      if (d <= 4.4) { cg.fillStyle = d > 3.4 ? C.ouro2 : (x + y < 7 ? '#fbff86' : C.ouro); cg.fillRect(x, y, 1, 1); }
    }
    cg.fillStyle = C.ouro2; cg.fillRect(4, 2, 1, 5); cg.fillRect(3, 3, 1, 1); cg.fillRect(5, 5, 1, 1);
    var mo = document.getElementById('ic-moeda');
    mo.style.backgroundImage = 'url(' + c.toDataURL() + ')';
    mo.style.width = 'calc(var(--p) * 9)'; mo.style.height = 'calc(var(--p) * 9)';
  }
  function iconeClimaCabecalho() {
    var nome = { sol: 'sol', nublado: 'nuvem', chuva: 'chuva', nevoa: 'nevoa' }[estado.clima];
    var el = document.getElementById('ic-clima');
    el.style.backgroundImage = 'url(' + icone(nome, estado.clima === 'sol' ? C.ouro : C.texto).toDataURL() + ')';
    el.style.width = 'calc(var(--p) * 8)'; el.style.height = 'calc(var(--p) * 8)';
    document.getElementById('info-clima').textContent = 'CLIMA: ' + CLIMAS[estado.clima].nome;
  }

  // ---------------------------------------------------------------- escala e laço
  function medir() {
    var col = document.getElementById('palco'), dpr = window.devicePixelRatio || 1;
    var L = Math.floor(col.clientWidth * dpr);
    s = Math.max(1, Math.round(L / 256));
    W = Math.floor(L / s);
    buf = canvas(W, H); g = buf.getContext('2d');
    tela.width = W * s; tela.height = H * s;
    tela.style.width = (W * s / dpr) + 'px'; tela.style.height = (H * s / dpr) + 'px';
    gt = tela.getContext('2d'); gt.imageSmoothingEnabled = false;
    document.documentElement.style.setProperty('--px', (s / dpr) + 'px');
    document.getElementById('escala').textContent = 's = ' + s + ' · ' + W + ' × ' + H + ' px de arte · 1 px de arte = ' + (s / dpr).toFixed(2).replace('.', ',') + ' px CSS';
  }
  function laco(agora) {
    var dt = estado.ultimo ? Math.min(0.1, (agora - estado.ultimo) / 1000) : 0;
    estado.ultimo = agora;
    if (!estado.pausa) estado.t += dt * estado.vel * (reduzido ? 0.4 : 1);
    var t0 = performance.now();
    quadro();
    gt.drawImage(buf, 0, 0, W * s, H * s); chamadas++;
    var ms = performance.now() - t0;
    estado.msMedia = estado.msMedia ? estado.msMedia * 0.95 + ms * 0.05 : ms;
    if (Math.floor(agora / 500) !== estado.mostrado) {
      estado.mostrado = Math.floor(agora / 500);
      document.getElementById('medidas').textContent = chamadas + ' chamadas de desenho por quadro · ' + estado.msMedia.toFixed(2).replace('.', ',') + ' ms de JavaScript (limites do guia: 300 e 2 ms)';
    }
    requestAnimationFrame(laco);
  }
  var reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ligarControles() {
    document.querySelectorAll('[data-clima]').forEach(function (b) {
      b.addEventListener('click', function () {
        estado.clima = b.getAttribute('data-clima');
        iconeClimaCabecalho();
        document.querySelectorAll('[data-clima]').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      });
    });
    var pausa = document.getElementById('pausa');
    pausa.addEventListener('click', function () { estado.pausa = !estado.pausa; pausa.textContent = estado.pausa ? 'Continuar' : 'Pausar'; pausa.setAttribute('aria-pressed', String(estado.pausa)); });
    ['x1', 'x2'].forEach(function (id, i) {
      document.getElementById(id).addEventListener('click', function () {
        estado.vel = i + 1;
        document.getElementById('x1').setAttribute('aria-pressed', String(i === 0));
        document.getElementById('x2').setAttribute('aria-pressed', String(i === 1));
      });
    });
    document.querySelectorAll('[data-aba]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.body.setAttribute('data-vista', b.getAttribute('data-aba'));
        document.querySelectorAll('[data-aba]').forEach(function (o) { o.setAttribute('aria-selected', String(o === b)); });
        medir();
      });
    });
    var espera; window.addEventListener('resize', function () { clearTimeout(espera); espera = setTimeout(medir, 120); });
  }

  // ---------------------------------------------------------------- partida
  function iniciar() {
    tela = document.getElementById('corrida');
    if (!document.body.getAttribute('data-vista')) document.body.setAttribute('data-vista', 'novo');
    // as faces vêm do @font-face da página (data: URI); aqui só se espera carregarem
    var fontes = ['8px Galmuri7A', '10px Galmuri9A', '12px Galmuri11A', '12px Galmuri11BA'].map(function (f) { return document.fonts.load(f); });
    var nomes = ['chapadas', 'cerrado', 'frente', 'nuvens', 'arquibancada'], imgs = {};
    var carregaCamadas = Promise.all(nomes.map(function (n) { return carregar(A.camadas[n]).then(function (i) { imgs[n] = i; }); }));
    var mImgs = {};
    var carregaMoldes = Promise.all(Object.keys(A.moldes).map(function (k) {
      return Promise.all(A.moldes[k].galope.map(carregar)).then(function (l) { mImgs[k] = l; });
    }));
    Promise.all([Promise.all(fontes), carregaCamadas, carregaMoldes]).then(function () {
      Object.keys(FONTES).forEach(function (k) { atlasFonte(FONTES[k]); });
      prepararCamadas(imgs);
      prepararCavalos(mImgs);
      medir();
      iconeCabecalho(); iconeClimaCabecalho();
      ligarControles();
      requestAnimationFrame(laco);
    }).catch(function (e) { document.getElementById('narracao').textContent = 'Erro ao carregar a amostra: ' + e; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
