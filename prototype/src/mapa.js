/* Mapa dos ginásios — desenho do mapa-múndi, da viagem até o ginásio e da trilha (spec 2026-11-24-mapa-ginasios §3).
 *
 * Só desenho: nada aqui é regra, nada é gravado e nada é sorteado pela seed das regras. O game.js passa o progresso
 * (montado do save) e as imagens já carregadas; este módulo desenha num buffer de arte (256 × 384, a grade da Resurrect
 * 64) que o game.js copia ampliado para o canvas da tela. Os efeitos cosméticos (fumaça, bombas do vulcão, pássaros)
 * usam a RNG própria (mulberry32 de uma semente fixa); nada de Math.random.
 *
 * Partes puras (testadas no Node, prototype/tools/mapa-test.mjs): nevoaDe, marcadores, ginasioEm, POS, rng.
 * Partes de desenho (navegador): mundo(arte, opcoes).
 *
 * Veio da amostra prototype/arte/mapa.js (a variante "ilha B pintada", escolhida pelo Vinicius em 2026-11-24).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Mapa = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 256, H = 384;
  var ORDEM = ['fogo', 'agua', 'grama'];
  // a ilha B (terreno-s9901): o chão de cada ginásio (centro do objeto de 64 × 64), a cratera do vulcão e as faixas das
  // regiões (y onde o fogo acaba e onde a água acaba) para a névoa; a lava só existe acima de lavaAte
  var ILHA = { cratera: [87, 41], pos: { fogo: [180, 112], agua: [118, 184], grama: [130, 284] }, reg: [146, 214], lavaAte: 160 };
  var NOMES = { fogo: 'Fornalha', agua: 'Remanso', grama: 'Capoeira' };
  var COR_EL = { fogo: ['6e2727', 'e83b3b', 'fb6b1d', 'f9c22b'], agua: ['323353', '4d65b4', '4d9be6', '8fd3ff'], grama: ['165a4c', '239063', '1ebc73', '91db69'] };
  var MARCA = { ex: -10, base: -18, placa: 24 };   // o estandarte e a placa em volta do ginásio (pixels de arte)
  var DENS = [0.78, 0.64, 0.5, 0.38, 0.27];          // a névoa pelo número de etapas vencidas (5 = insígnia: some)

  var R64 = ['2e222f', '3e3546', '625565', '966c6c', 'ab947a', '694f62', '7f708a', '9babb2', 'c7dcd0', 'ffffff', '6e2727',
    'b33831', 'ea4f36', 'f57d4a', 'ae2334', 'e83b3b', 'fb6b1d', 'f79617', 'f9c22b', '7a3045', '9e4539', 'cd683d', 'e6904e',
    'fbb954', '4c3e24', '676633', 'a2a947', 'd5e04b', 'fbff86', '165a4c', '239063', '1ebc73', '91db69', 'cddf6c', '313638',
    '374e4a', '547e64', '92a984', 'b2ba90', '0b5e65', '0b8a8f', '0eaf9b', '30e1b9', '8ff8e2', '323353', '484a77', '4d65b4',
    '4d9be6', '8fd3ff', '45293f', '6b3e75', '905ea9', 'a884f3', 'eaaded', '753c54', 'a24b6f', 'cf657f', 'ed8099', '831c5d',
    'c32454', 'f04f78', 'f68181', 'fca790', 'fdcbb0'];

  // ------------------------------------------------------------------ utilidades (puras)
  function rgbDe(h) { return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function c32(h) { var v = rgbDe(h); return ((255 << 24) | (v[2] << 16) | (v[1] << 8) | v[0]) >>> 0; }
  var K = {}; R64.forEach(function (h) { K[h] = c32(h); });
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function rng(s) { s = s | 0; return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function ruido(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi + z * 7919, yi - z * 104729), b = hash(xi + 1 + z * 7919, yi - z * 104729), c = hash(xi + z * 7919, yi + 1 - z * 104729), d = hash(xi + 1 + z * 7919, yi + 1 - z * 104729);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, z, oit) { var s = 0, a = 0.5, n = 0; for (var o = 0; o < (oit || 4); o++) { s += ruido(x, y, z + o * 13) * a; n += a; x *= 2.03; y *= 2.03; a *= 0.5; } return s / n; }
  function lim(v, a, b) { return v < a ? a : v > b ? b : v; }
  function suave(a, b, x) { x = lim((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function mod(a, n) { return ((a % n) + n) % n; }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var BAY = new Float32Array(16); for (var bi = 0; bi < 16; bi++) BAY[bi] = (BAYER[bi] + 0.5) / 16;
  var SEN = new Float32Array(1024); for (var si = 0; si < 1024; si++) SEN[si] = Math.sin(si / 1024 * Math.PI * 2);
  function fsin(x) { return SEN[(x * 162.97466 | 0) & 1023]; }
  function vento(t) { return 0.5 + 0.3 * Math.sin(t * 0.37) + 0.2 * Math.sin(t * 0.91 + 1.3); }   // 0..1, cosmético
  // a cor da paleta mais perto de um alvo RGB (com pesos), em cache por cor de entrada
  function maisPerto(alvo, lista, pesos) {
    var melhor = 0, md = 1e9, w = pesos || [1, 1, 1];
    for (var i = 0; i < lista.length; i++) {
      var v = rgbDe(lista[i]), dd = Math.pow(v[0] - alvo[0], 2) * w[0] + Math.pow(v[1] - alvo[1], 2) * w[1] + Math.pow(v[2] - alvo[2], 2) * w[2];
      if (dd < md) { md = dd; melhor = K[lista[i]]; }
    }
    return melhor;
  }
  var ESC = {};
  function escurecer(c) {   // um degrau abaixo, puxado para o frio (sombra de nuvem, sombra de objeto): troca de paleta
    if (ESC[c] !== undefined) return ESC[c];
    var r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
    return (ESC[c] = maisPerto([r * 0.62 + 20, g * 0.6 + 12, b * 0.66 + 30], R64, [0.9, 1.2, 1]));
  }
  var LAV = {}, LAVADAS = ['9babb2', 'c7dcd0', '7f708a', '92a984', 'b2ba90', '547e64', 'ab947a', '625565', '694f62'];
  function lavar(c) {      // o terreno "lavado" sob a névoa: cada cor puxada para o claro e o frio
    if (LAV[c] !== undefined) return LAV[c];
    var r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255, l = r * 0.3 + g * 0.59 + b * 0.11;
    return (LAV[c] = maisPerto([l * 0.62 + 160 * 0.38, l * 0.62 + 176 * 0.38, l * 0.62 + 182 * 0.38], LAVADAS));
  }

  // ------------------------------------------------------------------ o progresso visto pelo mapa (puro)
  // progresso = { fogo: { vencidas: 0..5, insignia: bool, revanche: 'livre' | 'feita' | null }, agua: …, grama: … }
  function vencidasDe(p) { return p ? lim(p.vencidas | 0, 0, 5) : 0; }
  // a densidade da névoa de cada ginásio (0 com a insígnia)
  function nevoaDe(progresso) {
    var out = {};
    ORDEM.forEach(function (el) { var p = progresso && progresso[el], v = vencidasDe(p); out[el] = p && p.insignia || v >= 5 ? 0 : DENS[v]; });
    return out;
  }
  // o que cada ginásio mostra: o estandarte (sempre), a insígnia (conquistado), o "!" (revanche livre hoje) e as 5 marcas
  function marcadores(progresso) {
    var out = {};
    ORDEM.forEach(function (el) {
      var p = progresso && progresso[el], v = vencidasDe(p), conq = !!(p && p.insignia) || v >= 5;
      out[el] = { conquistado: conq, vencidas: v, revanche: conq && p && p.revanche === 'livre', revancheFeita: conq && p && p.revanche === 'feita' };
    });
    return out;
  }
  // o ginásio sob um ponto do mapa (pixels de arte): o objeto (64 × 64 centrado), o estandarte e a placa; null fora
  function ginasioEm(x, y) {
    for (var i = 0; i < ORDEM.length; i++) {
      var p = ILHA.pos[ORDEM[i]];
      if (x >= p[0] - 30 && x <= p[0] + 30 && y >= p[1] - 52 && y <= p[1] + MARCA.placa + 16) return ORDEM[i];
    }
    return null;
  }

  // ------------------------------------------------------------------ desenho (navegador)
  function tela(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // um buffer de pixels (Uint32, RGBA little-endian) com um canvas para desenhar
  function Buf(w, h) {
    this.w = w; this.h = h; this.c = tela(w, h); this.g = this.c.getContext('2d', { willReadFrequently: true });
    this.g.imageSmoothingEnabled = false;
    this.img = this.g.createImageData(w, h); this.d = new Uint32Array(this.img.data.buffer);
  }
  Buf.prototype.poe = function () { this.g.putImageData(this.img, 0, 0); return this; };
  Buf.prototype.em = function (x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x]; };
  Buf.de = function (im) {   // a imagem com alfa binário
    var b = new Buf(im.width || im.naturalWidth, im.height || im.naturalHeight);
    b.g.drawImage(im, 0, 0);
    var dd = new Uint32Array(b.g.getImageData(0, 0, b.w, b.h).data.buffer);
    for (var i = 0; i < dd.length; i++) b.d[i] = (dd[i] >>> 24) >= 128 ? (dd[i] | 0xff000000) >>> 0 : 0;
    return b;
  }
  function hexC(c) { return '#' + [c & 255, (c >>> 8) & 255, (c >>> 16) & 255].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }

  var AGUA_NAVY = ['323353', '484a77', '4d65b4'].map(function (h) { return K[h]; });
  var AGUA_TEAL = ['0b5e65', '0b8a8f', '0eaf9b', '8fd3ff'].map(function (h) { return K[h]; });
  var LAVA_R = ['b33831', 'ea4f36', 'fb6b1d', 'f79617', 'f9c22b', 'fbff86'].map(function (h) { return K[h]; });

  // O mapa-múndi. arte = { terreno: Image (256 × 384), ginasios: { fogo, agua, grama: Image 64 × 64 },
  // lideres: { fogo, agua, grama: Image do corpo do líder (32 × 48) ou null } }; opcoes = { sprites (o Sprites, para o
  // texto da placa) }. Devolve null se faltar imagem. O desenho vai para m.c (W × H).
  function mundo(arte, opcoes) {
    if (!arte || !arte.terreno || !arte.ginasios || ORDEM.some(function (el) { return !arte.ginasios[el]; })) return null;
    var SP = opcoes && opcoes.sprites, N = W * H;
    var out = new Buf(W, H), g = out.g;
    function R(x, y, w, h, cor) { g.fillStyle = cor; g.fillRect(x | 0, y | 0, w, h); }
    function D(im, x, y) { g.drawImage(im, Math.round(x), Math.round(y)); }

    // ---- o chão: a ilha com os ginásios assentados (sombra de contato e capim invadindo a base, guia de integração)
    var terr = Buf.de(arte.terreno), base = new Buf(W, H), cobre = new Uint8Array(N), agua = [], lava = [];
    base.d.set(terr.d);
    var esc = function (c) { return escurecer((c | 0xff000000) >>> 0); };
    ORDEM.forEach(function (el) {
      var o = Buf.de(arte.ginasios[el]), pp = ILHA.pos[el], ox = pp[0] - 32, oy = pp[1] - 32, x, y, y1 = 0;
      for (var q = 0; q < o.d.length; q++) if (o.d[q]) y1 = Math.max(y1, (q / 64) | 0);
      for (y = 0; y < 64; y++) for (x = 0; x < 64; x++) {
        if (!o.d[y * 64 + x]) continue;
        [[3, 3], [2, 2]].forEach(function (dd, j) {
          var X = ox + x + dd[0], Y = oy + y + dd[1]; if (X < 0 || Y < 0 || X >= W || Y >= H) return;
          if (j === 0 || !o.em(x + dd[0], y + dd[1] + 1)) base.d[Y * W + X] = j === 1 && y > y1 - 6 ? esc(esc(terr.d[Y * W + X])) : esc(terr.d[Y * W + X]);
          cobre[Y * W + X] = 1;
        });
      }
      for (y = 0; y < 64; y++) for (x = 0; x < 64; x++) { var c = o.d[y * 64 + x], X = ox + x, Y = oy + y; if (c && X >= 0 && Y >= 0 && X < W && Y < H) { base.d[Y * W + X] = c; cobre[Y * W + X] = 1; } }
      for (x = 0; x < 64; x++) for (y = 63; y > 0; y--) if (o.d[y * 64 + x]) {
        var X2 = ox + x, Y2 = oy + y, chao = terr.d[Math.min(H - 1, Y2 + 4) * W + X2];
        if (hash(X2 >> 1, Y2) < 0.38) base.d[Y2 * W + X2] = chao;
        if (hash(X2 >> 1, Y2 + 9) < 0.16) base.d[(Y2 - 1) * W + X2] = chao;
        break;
      }
    });
    var p, i;
    for (p = 0; p < N; p++) {
      if (cobre[p]) continue;
      var c0 = terr.d[p];
      // água: só os pixels que podem mudar (os candidatos a brilho, que são fixos por posição, e os do tom mais claro, que
      // apagam); o resto fica com a cor do chão
      var px0 = p % W, py0 = (p / W) | 0;
      if ((i = AGUA_NAVY.indexOf(c0)) >= 0) { if (hash(px0 >> 1, py0) < 0.14 || i === AGUA_NAVY.length - 1) agua.push(p, 0, i); }
      else if ((i = AGUA_TEAL.indexOf(c0)) >= 0) { if (hash(px0 >> 1, py0) < 0.35 || i === AGUA_TEAL.length - 1) agua.push(p, 1, i); }
      else if (((p / W) | 0) < ILHA.lavaAte && (i = LAVA_R.indexOf(c0)) >= 0) lava.push(p, i);
    }
    var ehAgua = function (q) { var c2 = terr.d[q]; return AGUA_NAVY.indexOf(c2) >= 0 || AGUA_TEAL.indexOf(c2) >= 0 || LAVA_R.indexOf(c2) >= 0 || c2 === K.ffffff || c2 === K.c7dcd0; };
    var espuma = [];   // água encostada na terra: espuma que pisca
    for (p = W * 70; p < N - W; p++) {
      if (cobre[p] || (AGUA_NAVY.indexOf(terr.d[p]) < 0 && AGUA_TEAL.indexOf(terr.d[p]) < 0)) continue;
      if (!ehAgua(p - 1) || !ehAgua(p + 1) || !ehAgua(p - W) || !ehAgua(p + W)) espuma.push(p);
    }
    var escuro = new Buf(W, H), lavado = new Uint32Array(N);
    for (p = 0; p < N; p++) { lavado[p] = lavar((base.d[p] | 0xff000000) >>> 0); escuro.d[p] = esc(terr.d[p]); }
    escuro.poe(); base.poe();
    var vivo = new Buf(W, H); vivo.d.set(base.d); vivo.poe();

    // ---- ciclo de cor (8 passos por segundo, no ritmo do laço do jogo): água com brilhos em ondas cruzadas, lava
    // escorrendo, espuma piscando
    var cicloT = -1, CICLO_FPS = 8;
    function ciclo(t) {
      var q = Math.floor(t * CICLO_FPS); if (q === cicloT) return; cicloT = q; t = q / CICLO_FPS;
      var d = vivo.d, x, y, j;
      for (i = 0; i < agua.length; i += 3) {
        p = agua[i]; x = p % W; y = (p / W) | 0;
        var ramp = agua[i + 1] ? AGUA_TEAL : AGUA_NAVY; j = agua[i + 2];
        var o = fsin(x * 0.21 + y * 0.13 - t * 1.6) + fsin(x * 0.07 - y * 0.19 + t * 1.1);
        if (o > 1.2 && hash(x >> 1, y) < (agua[i + 1] ? 0.35 : 0.14) && j < ramp.length - 1) j++;
        else if (j === ramp.length - 1 && fsin(t * 2.3 + x * 1.7 + y) < -0.6) j--;
        d[p] = ramp[j];
      }
      for (i = 0; i < lava.length; i += 2) {
        p = lava[i]; x = p % W; y = (p / W) | 0;
        var f = mod(y * 0.55 - x * 0.12 - t * 6 + hash(x >> 2, y >> 2) * 3, 9);
        d[p] = LAVA_R[lim(lava[i + 1] + (f < 1.5 ? 2 : f < 3.5 ? 1 : f > 7 ? -1 : 0), 0, 5)];
      }
      var fase = Math.floor(t * 3);
      for (i = 0; i < espuma.length; i++) { p = espuma[i]; var hh = hash(p % W >> 1, (p / W | 0) + fase); if (hh < 0.45) d[p] = hh < 0.2 ? K.c7dcd0 : K['8ff8e2']; }
      vivo.poe();
    }

    // ---- névoa sobre o que não foi conquistado (só visual): manchas que andam devagar, sólidas no miolo e em massas de
    // 2 × 2 na borda, com o terreno lavado no meio-termo; o peso de cada região é borrado para não parar na fronteira
    var pesos = (function () {
      var reg = new Uint8Array(N), o = { 1: new Float32Array(N), 2: new Float32Array(N), 3: new Float32Array(N) };
      for (p = 0; p < N; p++) {
        var c = terr.d[p], x = p % W, y = (p / W) | 0;
        if (AGUA_NAVY.indexOf(c) >= 0 || (AGUA_TEAL.indexOf(c) >= 0 && y < 60)) continue;
        var ry = y + (fbm(x / 30, y / 30, 7, 3) - 0.5) * 30;
        reg[p] = ry < ILHA.reg[0] ? 1 : ry < ILHA.reg[1] ? 2 : 3;
      }
      [1, 2, 3].forEach(function (r) {
        var a = o[r], tmp = new Float32Array(N), R2 = 9, x, y, s;
        for (var q = 0; q < N; q++) a[q] = reg[q] === r ? 1 : 0;
        for (var pass = 0; pass < 2; pass++) {
          for (y = 0; y < H; y++) { s = 0; for (x = -R2; x < W + R2; x++) { if (x + R2 < W) s += a[y * W + x + R2]; if (x - R2 - 1 >= 0) s -= a[y * W + x - R2 - 1]; if (x >= 0 && x < W) tmp[y * W + x] = s / (2 * R2 + 1); } }
          for (x = 0; x < W; x++) { s = 0; for (y = -R2; y < H + R2; y++) { if (y + R2 < H) s += tmp[(y + R2) * W + x]; if (y - R2 - 1 >= 0) s -= tmp[(y - R2 - 1) * W + x]; if (y >= 0 && y < H) a[y * W + x] = s / (2 * R2 + 1); } }
        }
      });
      return o;
    })();
    var nevCampo = new Float32Array(N);
    for (var ny = 0; ny < H; ny++) for (var nx = 0; nx < W; nx++) {   // emendado nas pontas (anda sem salto)
      var f1 = fbm(nx / 34, ny / 26, 91, 4), f2 = fbm((nx - W) / 34, ny / 26, 91, 4);
      nevCampo[ny * W + nx] = suave(0.34, 0.66, (f1 * (W - nx) + f2 * nx) / W);
    }
    var nevoa = new Buf(W, H), nevT = -1, nevChave = '', nevLista = [], nevV = new Float32Array(N), nevMetade = 2, NEV_FPS = 3, NEV_PARTES = 2, nevCaixa = null;
    var NV = [K['9babb2'], K.c7dcd0, K.ffffff];
    function atualizaNevoa(t) {
      var dens = nevoaDe(est), chave = dens.fogo + ',' + dens.agua + ',' + dens.grama, d = nevoa.d;
      if (chave !== nevChave) {
        nevChave = chave; nevT = -1; nevLista = [];
        var dr = { 1: dens.fogo, 2: dens.agua, 3: dens.grama };
        for (p = 0; p < N; p++) d[p] = 0;
        // por bloco de 2 × 2 (a borda da névoa já anda em massas desse tamanho): o canto de cima à esquerda decide o bloco
        for (var by = 0; by < H; by += 2) for (var bx = 0; bx < W; bx += 2) {
          p = by * W + bx;
          var v = 0; for (var r = 1; r <= 3; r++) if (dr[r] > 0) v += dr[r] * pesos[r][p];
          nevV[p] = v * 1.25;
          if (v * 1.25 * 1.35 > 0.6) nevLista.push(p);
        }
        // a caixa onde pode haver névoa: só ela volta para o canvas a cada passo
        var ys = nevLista.map(function (q) { return (q / W) | 0; });
        nevCaixa = nevLista.length ? [Math.min.apply(null, ys), Math.max.apply(null, ys) + 2] : null;
        nevMetade = NEV_PARTES; nevoa.poe();
      }
      var q = Math.floor(t * NEV_FPS);
      if (q !== nevT) { nevT = q; nevMetade = 0; }
      if (nevMetade >= NEV_PARTES) return;
      t = nevT / NEV_FPS;   // metade dos pixels por quadro, em dois quadros seguidos (3 passos por segundo)
      var ox = Math.floor(t * 2.5), oy = Math.floor(t * 0.6), L = nevLista;
      for (i = nevMetade; i < L.length; i += NEV_PARTES) {
        p = L[i]; var x = p % W, y = (p / W) | 0;
        var c = nevCampo[((y + oy) % H) * W + mod(x - ox, W)], f = nevV[p] * (0.3 + c * 1.05);
        var l1 = BAY[(((y >> 1) & 3) << 2) | ((x >> 1) & 3)];
        // 0 = sem névoa, 1 = terreno lavado, ou a cor da névoa
        var nv = f > 1.02 ? NV[c > 0.85 ? 2 : c > 0.6 ? 1 : 0] : f > 0.86 ? (l1 < (f - 0.86) * 6 ? NV[c > 0.7 ? 1 : 0] : 1) : (f > 0.6 && l1 < (f - 0.6) * 3.8) ? 1 : 0;
        if (nv === 1) { d[p] = lavado[p]; d[p + 1] = lavado[p + 1]; d[p + W] = lavado[p + W]; d[p + W + 1] = lavado[p + W + 1]; }
        else { d[p] = d[p + 1] = d[p + W] = d[p + W + 1] = nv; }
      }
      nevMetade++;
      if (nevMetade === NEV_PARTES && nevCaixa) nevoa.g.putImageData(nevoa.img, 0, 0, 0, nevCaixa[0], W, nevCaixa[1] - nevCaixa[0]);
    }

    // ---- nuvens altas com sombra (o chão escurecido na forma da nuvem, refeito só quando a nuvem anda um pixel)
    function nuvemForma(sem, w, h) {
      var c = new Buf(w, h), r = rng(sem), bolhas = [];
      for (var k = 0; k < 7; k++) bolhas.push([w * (0.18 + r() * 0.64), h * (0.45 + r() * 0.25), h * (0.25 + r() * 0.22)]);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var dent = false, luz = 0;
        bolhas.forEach(function (b) { var dd = Math.hypot(x - b[0], (y - b[1]) * 1.3); if (dd < b[2]) { dent = true; luz = Math.max(luz, 1 - Math.hypot(x - b[0] + b[2] * 0.4, y - b[1] + b[2] * 0.5) / b[2]); } });
        if (!dent || y > h * 0.82) continue;
        c.d[y * w + x] = luz > 0.45 ? K.ffffff : luz > 0.12 || y < h * 0.6 ? K.c7dcd0 : K['9babb2'];
      }
      return c.poe();
    }
    var nuvens = [[0, 40, 46, 18, 3.2], [140, 170, 38, 15, 2.4], [70, 300, 52, 20, 2.9]].map(function (n, k) {
      return { x0: n[0], y: n[1], w: n[2], h: n[3], v: n[4], c: nuvemForma(700 + k, n[2], n[3]).c, sx: null, sc: null };
    });
    function desenhaNuvens(t, sombra) {
      nuvens.forEach(function (n) {
        var x = Math.round(mod(n.x0 + t * n.v, W + n.w + 40) - n.w - 20), y = n.y;
        if (!sombra) { D(n.c, x, y); return; }
        if (n.sx !== x) {
          n.sx = x; n.sc = n.sc || tela(n.w, n.h); var sg = n.sc.getContext('2d');
          sg.globalCompositeOperation = 'copy'; sg.drawImage(n.c, 0, 0);
          sg.globalCompositeOperation = 'source-in'; sg.drawImage(escuro.c, -(x + 10), -(y + 16));
          sg.globalCompositeOperation = 'source-over';
        }
        D(n.sc, x + 10, y + 16);
      });
    }

    // ---- pássaros, fumaça e bombas do vulcão (partículas em vetores fixos; nada de objeto novo por quadro)
    var ASA = [[[0, 0], [1, 1], [3, 1], [4, 0]], [[0, 1], [1, 0], [2, 1], [3, 0], [4, 1]]];
    function desenhaPassaros(t) {
      var k0 = Math.floor(t / 14), u = (t % 14) / 9;
      if (u > 1) return;
      var r = rng(300 + k0), y0 = 60 + r() * 250, sobe = (r() - 0.5) * 60, esq = r() < 0.5;
      g.fillStyle = '#2e222f';
      for (var b = 0; b < 4; b++) {
        var x = esq ? -20 + u * (W + 40) - b * 7 : W + 20 - u * (W + 40) + b * 7, y = y0 + u * sobe + (b % 2 ? 4 : -2) * Math.min(b, 2);
        var q = ASA[Math.floor(t * 6 + b) & 1], xr = Math.round(x), yr = Math.round(y);
        for (var j = 0; j < q.length; j++) g.fillRect(xr + q[j][0], yr + q[j][1], 1, 1);
      }
    }
    var NP = 60, pX = new Float32Array(NP), pY = new Float32Array(NP), pVX = new Float32Array(NP), pVY = new Float32Array(NP), pV = new Float32Array(NP), pT = new Uint8Array(NP), pVida = new Float32Array(NP);
    var rP = rng(55), proxErupcao = 3, proxFumaca = 0, C0 = ILHA.cratera;
    function solta(tp, x, y, vx, vy, vida) { for (var j = 0; j < NP; j++) if (pV[j] <= 0) { pT[j] = tp; pX[j] = x; pY[j] = y; pVX[j] = vx; pVY[j] = vy; pV[j] = vida; pVida[j] = vida; return; } }
    function particulas(t, dt) {
      if (t > proxFumaca) { proxFumaca = t + 0.22; solta(0, C0[0] + (rP() - 0.5) * 8, C0[1] - 1, 0, -6 - rP() * 4, 3.2 + rP()); }
      if (t > proxErupcao) {
        proxErupcao = t + 3 + rP() * 3;
        for (var b = 0; b < 7; b++) solta(1, C0[0] + (rP() - 0.5) * 4, C0[1] - 2, (rP() - 0.5) * 34, -30 - rP() * 22, 1.6);
        for (b = 0; b < 4; b++) solta(0, C0[0] + (rP() - 0.5) * 6, C0[1] - 3, (rP() - 0.5) * 6, -14 - rP() * 6, 2.6);
      }
      var vv = vento(t);
      for (var j = 0; j < NP; j++) {
        if (pV[j] <= 0) continue;
        pV[j] -= dt;
        if (pT[j] === 0) { pX[j] += (pVX[j] + 4 + vv * 6) * dt; pY[j] += pVY[j] * dt; pVY[j] *= 0.995; }
        else { pX[j] += pVX[j] * dt; pY[j] += pVY[j] * dt; pVY[j] += 46 * dt; if (pY[j] > C0[1] + 26) pV[j] = 0; }
      }
      for (j = 0; j < NP; j++) {
        if (pV[j] <= 0) continue;
        var f = 1 - pV[j] / pVida[j], x = Math.round(pX[j]), y = Math.round(pY[j]);
        if (pT[j] === 0) { var tam = f < 0.25 ? 2 : f < 0.7 ? 3 : 2; R(x, y, tam, tam, f < 0.3 ? '#625565' : f < 0.65 ? '#7f708a' : '#9babb2'); }
        else R(x, y, 1, 1, f < 0.5 ? '#fbff86' : '#fb6b1d');
      }
    }

    // ---- os marcadores: estandarte do líder (a cabeça do corpo dele no pano, 4 fases do vento pré-assadas), insígnia,
    // balão da revanche e a placa com o nome e as 5 etapas (a única peça de interface no mapa)
    var cabecaDe = {};
    ORDEM.forEach(function (el) {
      var im = arte.lideres && arte.lideres[el]; if (!im) return;
      var cb = Buf.de(im), topo = -1, x, y;
      for (y = 0; y < cb.h && topo < 0; y++) for (x = 0; x < cb.w; x++) if (cb.d[y * cb.w + x]) { topo = y; break; }
      var x0 = cb.w, x1 = 0; for (y = topo; y < topo + 10; y++) for (x = 0; x < cb.w; x++) if (cb.em(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      cabecaDe[el] = { b: cb, topo: topo, cx: Math.round((x0 + x1) / 2) };
    });
    var estandartes = {};
    function estandarte(el, fase, conq) {
      var kk = el + fase + (conq ? 'c' : ''); if (estandartes[kk]) return estandartes[kk];
      var b = new Buf(22, 34), cor = COR_EL[el].map(function (h) { return K[h]; }), TINTA = K['2e222f'], OURO = [K.f79617, K.f9c22b, K.fbb954], MAD = [K['4c3e24'], K['9e4539']], cab = cabecaDe[el], x, y;
      for (y = 1; y < 34; y++) { b.d[y * 22 + 1] = MAD[0]; b.d[y * 22 + 2] = y < 32 ? MAD[1] : MAD[0]; }
      b.d[1] = OURO[1]; b.d[2] = OURO[2];
      for (x = 1; x < 19; x++) b.d[2 * 22 + x] = conq ? (x < 4 ? OURO[2] : OURO[0]) : MAD[1];
      for (var r = 0; r < 19; r++) {
        var dx = Math.round(fsin(fase * 1.5708 + r * 0.33) * Math.min(1, r / 9)), y2 = 3 + r, larg = 15;
        for (x = 0; x < larg; x++) {
          if (r >= 16 && Math.abs(x - 7) < (r - 15) * 2.4) continue;   // ponta em rabo de andorinha
          var X = 3 + x + dx, cc = x === 0 ? cor[2] : x === larg - 1 || r === 18 || (r >= 16 && Math.abs(x - 7) < (r - 14) * 2.4) ? cor[0] : cor[1];
          if (conq && (x === 0 || x === larg - 1)) cc = x === 0 ? OURO[2] : OURO[0];
          if (r < 1) cc = cor[0];
          var hx = x - 1, hy = r - 2;
          if (cab && hx >= 0 && hx < 13 && hy >= 0 && hy < 13) { var hc = cab.b.em(cab.cx - 6 + hx, cab.topo - 1 + hy); if (hc) cc = hc; }
          b.d[y2 * 22 + X] = cc;
        }
      }
      if (conq) for (y = 0; y < 6; y++) for (x = 0; x < 6; x++) { var d = Math.hypot(x - 2.5, y - 2.5); if (d < 3.1) b.d[(27 + y) * 22 + 8 + x] = d > 2.2 ? TINTA : (x + y < 4 ? OURO[2] : OURO[1]); }
      return (estandartes[kk] = b.poe().c);
    }
    function balao(x, y, t, cor) {
      var by = y - Math.round(Math.abs(fsin(t * 3.3)) * 3);
      R(x - 3, by - 9, 7, 9, '#2e222f'); R(x - 2, by - 8, 5, 7, '#ffffff'); R(x, by - 7, 1, 3, cor); R(x, by - 3, 1, 1, cor);
      R(x - 1, by, 2, 2, '#2e222f'); R(x - 1, by, 1, 1, '#ffffff');
    }
    // a placa (nome e as 5 etapas) e a sombra do mastro mudam só com o progresso: pré-assadas, 1 desenho cada por quadro
    var placas = {}, sombrasMastro = {};
    function placa(el, mk) {
      var kk = el + (mk.conquistado ? 'c' : '') + mk.vencidas; if (placas[kk]) return placas[kk];
      var nome = NOMES[el], lw = SP && SP.measureText ? SP.measureText(nome, 1, 'g7') : nome.length * 5, pw = Math.max(lw + 6, 33);
      var c = tela(pw + 2, 15), q = c.getContext('2d'), r = function (x, y, w, h, cor) { q.fillStyle = cor; q.fillRect(x, y, w, h); };
      r(0, 0, pw + 2, 15, '#2e222f'); r(1, 1, pw, 13, '#3e3546'); r(1, 1, pw, 1, '#484a77');
      if (SP && SP.drawText) SP.drawText(q, nome, Math.round((pw + 2) / 2), 3, { fonte: 'g7', scale: 1, color: mk.conquistado ? '#f9c22b' : '#ffffff', shadow: '#2e222f', align: 'center' });
      var cx = Math.round((pw + 2) / 2);
      for (var e = 0; e < 5; e++) r(cx - 12 + e * 5, 11, 3, 2, e < mk.vencidas ? '#f9c22b' : '#625565');
      return (placas[kk] = c);
    }
    function sombraMastro(el) {
      if (sombrasMastro[el]) return sombrasMastro[el];
      var pp = ILHA.pos[el], bx = pp[0] + MARCA.ex, by = pp[1] + MARCA.base, c = tela(12, 6), q = c.getContext('2d');
      for (var k = 1; k < 9; k++) { var sx = bx + 2 + k, sy = by + (k >> 1); q.fillStyle = hexC(escuro.d[sy * W + sx] || K['3e3546']); q.fillRect(2 + k, k >> 1, 1, 1); }
      return (sombrasMastro[el] = c);
    }
    function marcador(el, t, k, mk) {
      var pp = ILHA.pos[el], bx = pp[0] + MARCA.ex, by = pp[1] + MARCA.base, fase = Math.floor(t * 4 + k) & 3;
      D(sombraMastro(el), bx, by);
      D(estandarte(el, fase, mk.conquistado), bx - 1, by - 33);
      if (mk.conquistado) { var br = mod(t * 9, 30); if (br < 6) R(bx + 9 + Math.floor(br / 2), by - 5 + (Math.floor(br) % 3), 1, 1, '#ffffff'); }
      if (mk.revanche) balao(bx - 4, by - 30, t, '#f79617');
      var pl = placa(el, mk);
      D(pl, pp[0] - Math.round(pl.width / 2), pp[1] + MARCA.placa + (el === 'agua' ? 0 : 1) - 1);
    }

    // ---- o quadro inteiro, de baixo para cima
    var est = {}, mkEst = marcadores(est);
    var api = {
      W: W, H: H, c: out.c,
      // o progresso do save (ver marcadores/nevoaDe); a névoa só é refeita quando muda
      estado: function (progresso) { est = progresso || {}; mkEst = marcadores(est); },
      // desenha o quadro do instante t (segundos), com dt desde o anterior; reduzido = movimento reduzido (quadro parado)
      quadro: function (t, dt, reduzido) {
        if (reduzido) t = 0;
        if (!reduzido) ciclo(t); else if (cicloT !== -2) { vivo.d.set(base.d); vivo.poe(); cicloT = -2; }
        D(vivo.c, 0, 0);
        desenhaNuvens(t, true);
        if (!reduzido) particulas(t, Math.min(0.1, dt || 0));
        atualizaNevoa(t); D(nevoa.c, 0, 0);
        desenhaNuvens(t, false);
        for (var k = 0; k < ORDEM.length; k++) marcador(ORDEM[k], t, k, mkEst[ORDEM[k]]);   // por cima das nuvens: sempre legível
        if (!reduzido) desenhaPassaros(t);
        return out.c;
      },
      ginasioEm: ginasioEm,
      // o centro de cada ginásio (para a aproximação da viagem)
      posicao: function (el) { return ILHA.pos[el].slice(); }
    };
    return api;
  }

  return {
    W: W, H: H, ORDEM: ORDEM, NOMES: NOMES, COR_EL: COR_EL, POS: ILHA.pos, R64: R64,
    rng: rng, nevoaDe: nevoaDe, marcadores: marcadores, ginasioEm: ginasioEm, escurecer: escurecer,
    mundo: mundo
  };
});
