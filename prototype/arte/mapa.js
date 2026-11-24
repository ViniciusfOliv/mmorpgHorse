// prototype/arte/mapa.js — motor da amostra do mapa dos ginásios (frente 2 das melhorias visuais, entrega 1). O build
// é prototype/tools/mapa-amostra-build.mjs, que embute este arquivo, os PNGs e os módulos de desenho do jogo (data.js,
// marcas.js, sprites.js: só para o cavalo e a fonte) em prototype/arte/mapa-amostra.html. Não toca no jogo.
//
// Duas telas, as duas em 256 × 384 px de arte (o tamanho do mapa da trilha de hoje, MAPA_H do game.js):
//   mundo   o mapa-múndi em tela única: uma ilha com as três regiões (Fornalha no vulcão, Remanso no lago, Capoeira na
//           mata), o ginásio de cada uma com o líder de pé na porta, névoa sobre o que ainda não foi conquistado e o
//           mundo vivo (mar, rio e lava em ciclo de cor, copas no vento, nuvens com sombra, pássaros, fumaça).
//   trilha  o mapa da trilha de hoje (a arte paga da etapa 6) com o caminho virando uma pista de terra que se pinta
//           tile a tile ao vencer, as cinco paradas com os estados legíveis e o cavalo ativo trotando entre elas.
// Transições: aproximação em escala inteira (1× → 2× → 3×) e íris na cor do elemento; e de volta.
//
// Regras do guia de arte (docs/arte/guia.md): tudo num buffer na resolução de arte, copiado à tela por um drawImage
// ampliado num inteiro (§2); toda cor da Resurrect 64 e alfa binário (§3); luz de cima e da esquerda (§4); cenário sem
// contorno (§5); orçamento de quadro (§9). Sorteios só pela RNG cosmética daqui (mulberry32 de semente fixa), separada
// da seed das regras (CLAUDE.md §8): nada de Math.random. O terreno do mundo é desenhado por código nesta amostra; a
// arte final dele pode vir de um piloto pago (ver as notas da página).
(function () {
  'use strict';
  var M = window.__MAPA, SP = window.Sprites, GD = window.GameData;
  var W = 256, H = 384;

  // ================================================================ paleta (Resurrect 64)
  function rgbDe(h) { return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function c32(h) { var v = rgbDe(h); return ((255 << 24) | (v[2] << 16) | (v[1] << 8) | v[0]) >>> 0; }
  var R64 = ('2e222f 3e3546 625565 966c6c ab947a 694f62 7f708a 9babb2 c7dcd0 ffffff 6e2727 b33831 ea4f36 f57d4a ae2334 ' +
    'e83b3b fb6b1d f79617 f9c22b 7a3045 9e4539 cd683d e6904e fbb954 4c3e24 676633 a2a947 d5e04b fbff86 165a4c 239063 ' +
    '1ebc73 91db69 cddf6c 313638 374e4a 547e64 92a984 b2ba90 0b5e65 0b8a8f 0eaf9b 30e1b9 8ff8e2 323353 484a77 4d65b4 ' +
    '4d9be6 8fd3ff 45293f 6b3e75 905ea9 a884f3 eaaded 753c54 a24b6f cf657f ed8099 831c5d c32454 f04f78 f68181 fca790 fdcbb0').split(' ');
  var K = {}; R64.forEach(function (h) { K[h] = c32(h); });
  function k(h) { if (!K[h]) throw new Error('cor fora da Resurrect 64: ' + h); return K[h]; }
  function css(h) { k(h); return '#' + h; }
  // rampas (escuro → claro) por material
  var RAMPA = {
    mar: ['323353', '484a77', '4d65b4', '4d9be6', '8fd3ff'],
    doce: ['484a77', '4d65b4', '4d9be6', '8fd3ff', 'c7dcd0'],
    lava: ['6e2727', 'ae2334', 'e83b3b', 'fb6b1d', 'f79617', 'f9c22b', 'fbff86'],
    cinza: ['2e222f', '3e3546', '45293f', '694f62', '7f708a'],
    rocha: ['2e222f', '3e3546', '625565', '966c6c', 'ab947a'],
    brasa: ['45293f', '6e2727', '7a3045', '9e4539', 'cd683d'],
    campo: ['165a4c', '239063', '1ebc73', '91db69', 'cddf6c'],
    mata: ['313638', '165a4c', '374e4a', '239063', '547e64'],
    areia: ['ab947a', 'e6904e', 'fca790', 'fdcbb0'],
    terra: ['4c3e24', '9e4539', 'cd683d', 'e6904e', 'fbb954']
  };
  var RK = {}; Object.keys(RAMPA).forEach(function (n) { RK[n] = RAMPA[n].map(k); });

  // ================================================================ canvas e buffers
  function tela(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function Buf(w, h) {
    this.w = w; this.h = h; this.c = tela(w, h); this.g = this.c.getContext('2d', { willReadFrequently: true });
    this.g.imageSmoothingEnabled = false;
    this.img = this.g.createImageData(w, h); this.d = new Uint32Array(this.img.data.buffer);
  }
  Buf.de = function (img) {
    var b = new Buf(img.width, img.height); b.g.drawImage(img, 0, 0);
    b.img = b.g.getImageData(0, 0, b.w, b.h); b.d = new Uint32Array(b.img.data.buffer);
    for (var i = 0; i < b.d.length; i++) b.d[i] = (b.d[i] >>> 24) < 128 ? 0 : (b.d[i] | 0xff000000) >>> 0;
    return b;
  };
  Buf.prototype.poe = function () { this.g.putImageData(this.img, 0, 0); return this; };
  Buf.prototype.px = function (x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; };
  Buf.prototype.em = function (x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x]; };
  Buf.prototype.ret = function (x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.px(x + i, y + j, c); };

  // ================================================================ ruído e RNG cosmética
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function hash3(x, y, z) { return hash(x + z * 7919, y - z * 104729); }
  function rngCosmetica(s) { return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function ruido(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash3(xi, yi, z), b = hash3(xi + 1, yi, z), c = hash3(xi, yi + 1, z), d = hash3(xi + 1, yi + 1, z);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y, z, oit) { var s = 0, a = 0.5, n = 0; for (var o = 0; o < (oit || 4); o++) { s += ruido(x, y, z + o * 13) * a; n += a; x *= 2.03; y *= 2.03; a *= 0.5; } return s / n; }
  function lim(v, a, b) { return v < a ? a : v > b ? b : v; }
  function suave(a, b, x) { x = lim((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function mod(a, n) { return ((a % n) + n) % n; }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(x, y) { return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }

  // ================================================================ curvas (Catmull-Rom com comprimento de arco)
  function curva(pts, passo) {
    var out = [], s = 0, ant = null;
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      var n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / (passo || 0.25));
      for (var j = 0; j < n; j++) {
        var t = j / n, t2 = t * t, t3 = t2 * t;
        var x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        var y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        if (ant) s += Math.hypot(x - ant[0], y - ant[1]);
        out.push([x, y, s, i]); ant = [x, y];
      }
    }
    var u = pts[pts.length - 1]; if (ant) s += Math.hypot(u[0] - ant[0], u[1] - ant[1]); out.push([u[0], u[1], s, pts.length - 2]);
    out.comp = s;
    return out;
  }
  // traço grosso: para cada pixel a até `raio` da curva, a menor distância e o arco (s) do ponto mais perto
  function tracar(c, raio, dist, arco, larg) {
    for (var i = 0; i < c.length; i++) {
      var p = c[i], r = typeof raio === 'function' ? raio(p[2] / c.comp) : raio;
      for (var y = Math.floor(p[1] - r - 1); y <= p[1] + r + 1; y++) for (var x = Math.floor(p[0] - r - 1); x <= p[0] + r + 1; x++) {
        if (x < 0 || y < 0 || x >= larg || y >= dist.length / larg) continue;
        var d = Math.hypot(x + 0.5 - p[0], y + 0.5 - p[1]) / r, q = y * larg + x;
        if (d <= 1 && d < dist[q]) { dist[q] = d; if (arco) arco[q] = p[2]; }
      }
    }
  }
  function ponto(c, s) {   // o ponto da curva no arco s (busca binária)
    var a = 0, b = c.length - 1; s = lim(s, 0, c.comp);
    while (b - a > 1) { var m = (a + b) >> 1; if (c[m][2] < s) a = m; else b = m; }
    var p = c[a], q = c[b], f = q[2] > p[2] ? (s - p[2]) / (q[2] - p[2]) : 0;
    return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
  }

  // ================================================================ o mundo (gerado uma vez, por código)
  // Geografia da ilha (x, y em px de arte). A Fornalha fica no pé do vulcão, ao norte; o Remanso numa plataforma no lago,
  // no meio; a Capoeira numa clareira da mata, ao sul; o rancho (de onde o jogador sai) na praia de baixo.
  var GEO = {
    vulcao: [170, 66],
    lago: [96, 200, 40, 25],
    rio: [[38, 112], [48, 134], [62, 158], [74, 180]],            // nasce na serra e desce ao lago
    saida: [[128, 205], [152, 219], [176, 236], [204, 252], [236, 266], [262, 276]],   // do lago ao mar
    ginasios: { fogo: [96, 104], agua: [100, 198], grama: [86, 302] },
    rancho: [150, 350],
    estradas: [
      [[150, 344], [144, 326], [120, 316], [100, 310]],                          // rancho → Capoeira
      [[144, 326], [160, 296], [170, 264], [170, 240], [158, 216], [140, 204]],   // rancho → ponte → píer do Remanso
      [[146, 200], [150, 176], [138, 150], [118, 128], [104, 116]]                // Remanso → Fornalha
    ]
  };
  var REG_Y = { fogo: 142, agua: 250 };
  function clareiraEm(x, y) {   // as clareiras em volta dos ginásios e do rancho (sem árvore, capim mais claro)
    var g = GEO.ginasios, m = 0;
    [[g.grama, 26], [g.fogo, 0], [GEO.rancho, 16]].forEach(function (c) { if (c[1]) m = Math.max(m, 1 - Math.hypot(x - c[0][0], (y - c[0][1]) * 1.25) / c[1]); });
    return m + (fbm(x / 6, y / 6, 31, 2) - 0.5) * 0.5 > 0 ? m : 0;
  }   // fronteiras (com ruído) entre as regiões, de cima para baixo
  function regiaoEm(x, y) { var ry = y + (fbm(x / 30, y / 30, 7, 4) - 0.5) * 70 + Math.sin(x / 40) * 10; return ry < REG_Y.fogo ? 'fogo' : ry < REG_Y.agua ? 'agua' : 'grama'; }

  function gerarMundo() {
    var N = W * H, b = new Buf(W, H), tipo = new Uint8Array(N), regiao = new Uint8Array(N);
    var T = { MAR: 0, PRAIA: 1, CHAO: 2, AGUA: 3, LAVA: 4, ESTRADA: 5, ROCHA: 6 };
    var RG = { fogo: 1, agua: 2, grama: 3 };
    // 1) terra × mar: superelipse com ruído e uma baía na foz do rio
    var terra = new Float32Array(N);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var nx = (x - 128) / 112, ny = (y - 194) / 172, q = Math.pow(Math.abs(nx), 2.6) + Math.pow(Math.abs(ny), 2.6);
      var v = 1 - q + (fbm(x / 38, y / 38, 1, 5) - 0.5) * 1.15;
      v -= Math.max(0, 1 - Math.hypot(x - 244, y - 272) / 30) * 0.8;   // baía da foz
      terra[y * W + x] = v;
    }
    // distância à costa (chanfro 3-4, nos dois lados)
    var dc = new Float32Array(N);
    for (var i = 0; i < N; i++) dc[i] = 1e9;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var t0 = terra[y * W + x] > 0;
      if ((x > 0 && (terra[y * W + x - 1] > 0) !== t0) || (y > 0 && (terra[(y - 1) * W + x] > 0) !== t0) ||
          (x < W - 1 && (terra[y * W + x + 1] > 0) !== t0) || (y < H - 1 && (terra[(y + 1) * W + x] > 0) !== t0)) dc[y * W + x] = 0;
    }
    function chanfro() {
      var p, x, y;
      for (p = 0; p < 2; p++) {
        for (y = 0; y < H; y++) for (x = 0; x < W; x++) { var i = y * W + x, m = dc[i];
          if (x > 0) m = Math.min(m, dc[i - 1] + 1); if (y > 0) m = Math.min(m, dc[i - W] + 1);
          if (x > 0 && y > 0) m = Math.min(m, dc[i - W - 1] + 1.4); if (x < W - 1 && y > 0) m = Math.min(m, dc[i - W + 1] + 1.4); dc[i] = m; }
        for (y = H - 1; y >= 0; y--) for (x = W - 1; x >= 0; x--) { var j = y * W + x, n = dc[j];
          if (x < W - 1) n = Math.min(n, dc[j + 1] + 1); if (y < H - 1) n = Math.min(n, dc[j + W] + 1);
          if (x < W - 1 && y < H - 1) n = Math.min(n, dc[j + W + 1] + 1.4); if (x > 0 && y < H - 1) n = Math.min(n, dc[j + W - 1] + 1.4); dc[j] = n; }
      }
    }
    chanfro();
    // 2) rio, lago, estradas, lava (traços com distância e arco)
    var dRio = new Float32Array(N).fill(9), sRio = new Float32Array(N), dEst = new Float32Array(N).fill(9), sEst = new Float32Array(N);
    var rio = curva(GEO.rio), saida = curva(GEO.saida);
    tracar(rio, function (f) { return 1.6 + f * 1.4; }, dRio, sRio, W);
    var dSai = new Float32Array(N).fill(9), sSai = new Float32Array(N);
    tracar(saida, function (f) { return 2.6 + f * 3.2; }, dSai, sSai, W);
    var estradas = GEO.estradas.map(function (p) { return curva(p); });
    estradas.forEach(function (c) { tracar(c, 2.2, dEst, sEst, W); });
    var V = GEO.vulcao, fluxos = [
      curva([[V[0] - 2, V[1] - 16], [V[0] - 9, V[1] - 2], [V[0] - 12, V[1] + 12], [V[0] - 22, V[1] + 26], [V[0] - 34, V[1] + 36]]),
      curva([[V[0] + 3, V[1] - 16], [V[0] + 8, V[1] - 4], [V[0] + 6, V[1] + 10], [V[0] + 14, V[1] + 24], [V[0] + 20, V[1] + 40]]),
      curva([[V[0], V[1] - 16], [V[0] - 1, V[1] + 2], [V[0] + 2, V[1] + 18]])
    ];
    var dLava = new Float32Array(N).fill(9), sLava = new Float32Array(N);
    fluxos.forEach(function (c, i) { tracar(c, function (f) { return (i === 2 ? 1.0 : 1.3) + f * 0.6; }, dLava, sLava, W); });

    // 3) classificação e cor, pixel a pixel
    var aguaPx = [], lavaPx = [], marPx = [];
    var L = GEO.lago;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var p = y * W + x, ter = terra[p] > 0, rg = regiaoEm(x, y), d = dc[p];
      regiao[p] = RG[rg];
      var nt = fbm(x / 9, y / 9, 3, 3), grao = hash(x, y);
      var lago = Math.pow((x - L[0]) / L[2], 2) + Math.pow((y - L[1]) / L[3], 2) + (fbm(x / 12, y / 12, 9, 3) - 0.5) * 0.7;
      var cor;
      if (!ter) {   // mar: tom pela profundidade (distância à costa), com faixas de rasa perto da praia
        var prof = lim(d / 30 + (fbm(x / 20, y / 20, 4, 3) - 0.5) * 0.5 + (bayer(x, y) - 0.5) * 0.06, 0, 1);
        var ii = prof < 0.07 ? 3 : prof < 0.3 ? 2 : prof < 0.62 ? 1 : 0;
        cor = RK.mar[ii]; tipo[p] = T.MAR; marPx.push(p, d, ii);
      } else if (lago < 1 || dRio[p] <= 1 || dSai[p] <= 1) {   // água doce
        var borda = lago < 1 ? (1 - lago) * 10 : (1 - Math.min(dRio[p], dSai[p])) * 3;
        var jj = borda < 0.8 ? 3 : borda < 2.2 ? 2 : 1;
        cor = RK.doce[jj]; tipo[p] = T.AGUA;
        aguaPx.push(p, lago < 1 ? -1 : (dRio[p] <= 1 ? sRio[p] : rio.comp + sSai[p]), jj);
      } else if (d < 2.5 + nt * 2.5 && rg !== 'fogo') {   // praia
        cor = RK.areia[d < 1.2 ? 1 : grao < 0.5 ? 2 : 3]; tipo[p] = T.PRAIA;
      } else if (d < 2 + nt * 2) {   // costa de pedra preta no norte
        cor = RK.cinza[grao < 0.5 ? 1 : 2]; tipo[p] = T.PRAIA;
      } else {
        // chão de cada região: manchas grandes de 3 tons (borda pontilhada), relevo suave (luz da esquerda e de cima),
        // tufos claros com a sombra embaixo e pintas escuras
        var hC = fbm(x / 26, y / 26, 5, 3), hE = fbm((x - 1) / 26, y / 26, 5, 3), hN = fbm(x / 26, (y - 1) / 26, 5, 3);
        var luz = ((hC - hE) + (hC - hN)) * 40, mancha = fbm(x / 30, y / 30, 3, 3) + luz * 0.25 + (bayer(x, y) - 0.5) * 0.05;
        var rampa = rg === 'fogo' ? RK.brasa : rg === 'agua' ? RK.campo : RK.mata;
        var base = rg === 'fogo' ? 3 : rg === 'agua' ? 2 : 3;
        var umido = rg !== 'fogo' && (lago < 1.6 || Math.min(dRio[p], dSai[p]) < 2.4);
        var clareira = clareiraEm(x, y);
        if (umido || clareira > 0) { rampa = RK.campo; base = umido ? 3 : 2; }
        var tom = base + (mancha > 0.56 ? 1 : mancha < 0.43 ? -1 : 0);
        if (grao < 0.035) tom += 1; else if (hash(x, y - 1) < 0.035) tom -= 1; else if (grao > 0.985) tom -= 1;
        cor = rampa[lim(tom, 0, rampa.length - 1)];
        tipo[p] = T.CHAO;
        // rachaduras de brasa no chão da Fornalha (crista do ruído), mais perto do vulcão
        if (rg === 'fogo' && Math.abs(fbm(x / 15, y / 15, 21, 3) - 0.5) < 0.011 && Math.hypot(x - V[0], y - V[1]) < 90) {
          cor = RK.lava[2]; tipo[p] = T.LAVA; lavaPx.push(p, -1 - hash(x >> 3, y >> 3) * 50, 0.5);
        }
      }
      if (ter && tipo[p] !== T.AGUA && dEst[p] <= 1) {   // estrada de terra batida: borda escura, miolo claro, sulcos
        var e = dEst[p];
        cor = e > 0.78 ? RK.terra[1] : (e > 0.3 && e < 0.48 && hash(x, y + 7) < 0.6) ? RK.terra[2] : RK.terra[grao < 0.3 ? 2 : 3];
        tipo[p] = T.ESTRADA;
      }
      b.d[p] = cor;
    }
    return { b: b, tipo: tipo, T: T, regiao: regiao, dc: dc, terra: terra, aguaPx: aguaPx, lavaPx: lavaPx, marPx: marPx,
      rio: rio, saida: saida, estradas: estradas, fluxos: fluxos, dLava: dLava, sLava: sLava, dEst: dEst, dRio: dRio, dSai: dSai };
  }

  // ================================================================ o mundo: relevo, árvores, ginásios (por código)
  // Cone de montanha ou vulcão visto de 3/4: luz da esquerda (face esquerda clara), sulcos verticais pelo ruído, pé que
  // some no chão em pontilhado. wt = meia largura do topo (0 = pico).
  function cone(m, cx, by, alt, wb, wt, rampa, sem) {
    var b = m.b, ty = by - alt;
    for (var y = Math.floor(ty); y <= by; y++) {
      var f = (y - ty) / alt, w = wt + (wb - wt) * Math.pow(f, 0.72) + (fbm(y / 4, sem, sem, 2) - 0.5) * 3 * f;
      for (var x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        var u = (x + 0.5 - cx) / Math.max(1, w);
        if (Math.abs(u) > 1) continue;
        if (f > 0.86 && bayer(x, y) < (f - 0.86) / 0.14) continue;                 // o pé some no chão
        var sulco = fbm(u * 5 + sem, f * 1.6, sem + 3, 2) - 0.5;
        var tom = 2 - u * 1.6 + sulco * 2.2 - f * 0.4 + (wt === 0 && f < 0.18 ? 0.8 : 0);
        if (Math.abs(u) > 0.9) tom -= 0.6;
        b.d[y * W + x] = rampa[lim(Math.round(tom), 0, rampa.length - 1)];
        m.tipo[y * W + x] = m.T.ROCHA;
      }
    }
  }
  function elipse(cx, cy, rx, ry, fn) {
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      var e = Math.pow((x + 0.5 - cx) / rx, 2) + Math.pow((y + 0.5 - cy) / ry, 2);
      if (e <= 1) fn(x, y, e, (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    }
  }
  var SERRAS = [[40, 86, 34, 20], [64, 72, 40, 22], [92, 62, 30, 18], [20, 110, 24, 14], [120, 50, 24, 16], [222, 112, 22, 14], [238, 94, 18, 11], [14, 84, 20, 12]];
  // árvore de copa redonda: a copa vai para as camadas que balançam; o tronco e a sombra ficam no chão
  function quadroCopa(r, rampa, sem) {
    var w = 2 * r + 1, c = new Buf(w, w), rng = rngCosmetica(sem);
    for (var y = 0; y < w; y++) for (var x = 0; x < w; x++) {
      var dx = x - r, dy = y - r, d = Math.sqrt(dx * dx + dy * dy * 1.15) + (rng() - 0.5) * 0.9;
      if (d > r + 0.2) continue;
      var dl = Math.hypot(dx + r * 0.38, dy + r * 0.42), tom = dl < r * 0.45 ? 3 : dl < r * 0.95 ? 2 : 1;
      if (dx + dy > r * 0.55 && d > r - 1.3) tom = 0;
      if (tom === 2 && rng() < 0.12) tom = 3; else if (tom === 2 && rng() < 0.1) tom = 1;
      c.d[y * w + x] = rampa[tom];
    }
    return c.poe();
  }
  function decorarMundo(m, semGinasios) {
    var b = m.b, V = GEO.vulcao, T = m.T, rng = rngCosmetica(4242);
    var livre = function (x, y, r) {   // chão sem estrada, água, lava, rocha nem clareira por perto
      for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) {
        var xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false;
        var t = m.tipo[yy * W + xx]; if (t !== T.CHAO) return false;
      }
      return true;
    };
    // serras e vulcão, de trás para a frente
    SERRAS.slice().sort(function (a, c) { return a[0] - c[0]; }).forEach(function (s, i) { cone(m, s[0], s[1], s[2], s[3], 0, RK.rocha, 50 + i); });
    cone(m, V[0], V[1] + 30, 48, 36, 7, RK.rocha, 77);
    // cratera e os fios de lava por cima do cone
    m.cratera = [V[0], V[1] - 17];
    elipse(V[0], V[1] - 17, 8, 3, function (x, y, e, u, v) { var p = y * W + x;
      if (e > 0.55) { b.d[p] = v < 0 ? RK.rocha[3] : RK.rocha[1]; m.tipo[p] = T.ROCHA; }
      else { b.d[p] = RK.lava[4]; m.tipo[p] = T.LAVA; m.lavaPx.push(p, -1, 0); } });
    for (var p = 0; p < W * H; p++) {
      if (m.dLava[p] > 1) continue;
      var x = p % W, y = (p / W) | 0;
      if (Math.hypot(x - V[0], (y - V[1]) * 1.2) > 58 || y < V[1] - 15) continue;
      b.d[p] = RK.lava[3]; m.tipo[p] = T.LAVA; m.lavaPx.push(p, m.sLava[p], m.dLava[p]);
    }
    // pedras e arbustos secos na Fornalha; juncos na beira do lago
    for (var n = 0; n < 900; n++) {
      var x = (rng() * W) | 0, y = (rng() * H) | 0, rg = m.regiao[y * W + x];
      if (!livre(x, y, 2)) continue;
      if (rg === 1 && rng() < 0.55) {
        if (rng() < 0.5) { b.px(x, y, RK.rocha[3]); b.px(x + 1, y, RK.rocha[2]); b.px(x, y + 1, RK.rocha[2]); b.px(x + 1, y + 1, RK.rocha[1]); b.px(x + 2, y + 1, RK.brasa[0]); }
        else { b.px(x, y, RK.terra[0]); b.px(x - 1, y - 1, RK.terra[1]); b.px(x + 1, y - 1, RK.terra[0]); b.px(x, y - 2, RK.terra[1]); b.px(x + 1, y + 1, RK.brasa[0]); }
      }
    }
    var L = GEO.lago;
    for (var a = 0; a < 360; a += 4) {
      var rr = 1.08 + hash(a, 9) * 0.25, jx = Math.round(L[0] + Math.cos(a * Math.PI / 180) * L[2] * rr), jy = Math.round(L[1] + Math.sin(a * Math.PI / 180) * L[3] * rr);
      if (m.tipo[jy * W + jx] !== T.CHAO || hash(a, 3) < 0.35) continue;
      for (var hh = 0; hh < 3; hh++) { b.px(jx, jy - hh, hh === 0 ? RK.mata[1] : hh === 2 ? RK.campo[4] : RK.campo[3]); }
      b.px(jx + 1, jy, RK.mata[1]); b.px(jx + 1, jy - 1, RK.campo[3]);
    }
    // árvores: mata densa na Capoeira, bosques no Remanso
    var copas = {}, arvores = [], RAMPA_COPA = ['165a4c', '239063', '1ebc73', '91db69'].map(k);
    for (var gy = 4; gy < H; gy += 5) for (var gx = 2; gx < W; gx += 5) {
      var tx = gx + Math.round((hash(gx, gy) - 0.5) * 4), ty = gy + Math.round((hash(gy, gx) - 0.5) * 4);
      if (tx < 3 || ty < 3 || tx >= W - 3 || ty >= H - 3) continue;
      var rgn = m.regiao[ty * W + tx], dens = fbm(tx / 26, ty / 26, 61, 3);
      var quer = rgn === 3 ? dens > 0.44 : rgn === 2 ? dens > 0.64 && hash(tx, ty + 5) < 0.5 : false;
      if (!quer || m.dc[ty * W + tx] < 5 || clareiraEm(tx, ty) > 0) continue;
      var gperto = false; for (var g in GEO.ginasios) if (Math.hypot(tx - GEO.ginasios[g][0], ty - GEO.ginasios[g][1]) < 22) gperto = true;
      if (gperto || Math.hypot(tx - GEO.rancho[0], ty - GEO.rancho[1]) < 18 || !livre(tx, ty, 3)) continue;
      var r = 3 + ((hash(tx + 1, ty) * 3) | 0), q = r + '-' + ((hash(tx, ty + 2) * 3) | 0);
      if (!copas[q]) copas[q] = quadroCopa(r, RAMPA_COPA, 900 + r * 7 + q.length);
      arvores.push({ x: tx, y: ty, r: r, c: copas[q] });
    }
    // sombra (para a direita e para baixo) e tronco no chão
    var SOMBRA = { 2: k('165a4c'), 3: k('313638') };
    arvores.forEach(function (a) {
      elipse(a.x + 2, a.y + a.r - 1, a.r, a.r * 0.55, function (x, y) { var p = y * W + x; if (m.tipo[p] === T.CHAO) b.d[p] = SOMBRA[m.regiao[p]] || SOMBRA[3]; });
      b.px(a.x, a.y + a.r, RK.terra[0]); b.px(a.x, a.y + a.r + 1, RK.terra[0]);
    });
    arvores.sort(function (a, c) { return a.y - c.y; });
    m.arvores = arvores;
    if (!semGinasios) ginasiosNoChao(m); else m.cerca = [];
  }
  // os ginásios, o píer, a ponte e o rancho (a parte parada; bandeiras, fogo e líder são desenhados a cada quadro)
  function ginasiosNoChao(m) {
    var b = m.b, T = m.T, G = GEO.ginasios, PED = RK.rocha, MAD = ['4c3e24', '9e4539', 'cd683d', 'e6904e'].map(k);
    var marca = function (x, y, c) { if (x >= 0 && y >= 0 && x < W && y < H) { b.d[y * W + x] = c; m.tipo[y * W + x] = T.ROCHA; } };
    // Fornalha: anel de pedra com o muro da frente à mostra e o piso de areia quente
    var f = G.fogo;
    elipse(f[0], f[1] + 2, 17, 10, function (x, y, e, u, v) {
      if (e > 0.5) { var junta = ((x + (y >> 1) * 2) % 5 === 0); marca(x, y, junta ? PED[1] : (u + v < -0.3 ? PED[4] : u + v < 0.4 ? PED[3] : PED[2])); }
      else marca(x, y, e < 0.18 ? RK.terra[4] : (hash(x, y) < 0.15 ? RK.lava[4] : RK.terra[3]));
    });
    for (var x = f[0] - 16; x <= f[0] + 16; x++) {   // o muro da frente: 3 px de face, escura
      var yb = Math.round(f[1] + 2 + 10 * Math.sqrt(Math.max(0, 1 - Math.pow((x + 0.5 - f[0]) / 17, 2))));
      if (Math.abs(x - f[0]) <= 2) continue;   // o portão
      for (var j = 0; j < 3; j++) marca(x, yb - 1 + j, j === 2 ? PED[0] : (x % 4 === 0 ? PED[0] : PED[1]));
    }
    // Remanso: plataforma de tábuas no lago, piso de areia, píer até a estrada
    var a = G.agua;
    for (var px0 = a[0] + 12; px0 <= 142; px0++) {   // o píer, antes da plataforma (ela cobre a ponta)
      var py = Math.round(a[1] + 1 + (px0 - a[0] - 12) * 0.2);
      for (var jj = -1; jj <= 1; jj++) marca(px0, py + jj, px0 % 3 === 0 ? MAD[1] : jj < 0 ? MAD[3] : MAD[2]);
      marca(px0, py + 2, MAD[0]); if (px0 % 6 === 0) marca(px0, py + 3, MAD[0]);
    }
    elipse(a[0], a[1], 15, 8.5, function (x, y, e, u, v) {
      if (e < 0.42) marca(x, y, e < 0.15 ? RAMPA.areia && RK.areia[3] : RK.areia[2]);
      else marca(x, y, y % 3 === 0 ? MAD[1] : (u + v < -0.2 ? MAD[3] : MAD[2]));
    });
    for (x = a[0] - 15; x <= a[0] + 15; x++) {
      var yb2 = Math.round(a[1] + 8.5 * Math.sqrt(Math.max(0, 1 - Math.pow((x + 0.5 - a[0]) / 15, 2))));
      marca(x, yb2 + 1, MAD[0]); marca(x, yb2 + 2, k('323353'));
    }
    // Capoeira: picadeiro de areia com cerca de toras
    var g = G.grama;
    elipse(g[0], g[1], 16, 9.5, function (x, y, e) { marca(x, y, e < 0.2 ? RK.terra[4] : hash(x, y) < 0.1 ? RK.terra[2] : RK.terra[3]); });
    m.cerca = [];
    for (var ang = 0; ang < 360; ang += 15) {
      var cx = Math.round(g[0] + Math.cos(ang * Math.PI / 180) * 16), cy = Math.round(g[1] + Math.sin(ang * Math.PI / 180) * 9.5);
      if (ang === 90) continue;   // a entrada
      m.cerca.push([cx, cy]);
    }
    // ponte sobre o rio de saída
    var est = m.estradas[1];
    for (var i = 0; i < est.length; i += 2) {
      var q = est[i], qx = Math.round(q[0]), qy = Math.round(q[1]);
      if (m.tipo[qy * W + qx] !== T.AGUA && m.tipo[qy * W + qx] !== T.ESTRADA) continue;
      var naAgua = m.dSai[qy * W + qx] <= 1.6;
      if (!naAgua) continue;
      for (var d = -3; d <= 3; d++) marca(qx + d, qy, Math.abs(d) === 3 ? MAD[0] : (qy % 2 ? MAD[2] : MAD[3]));
    }
    // rancho: celeiro de telhado vermelho
    var r = GEO.rancho, TEL = ['6e2727', 'b33831', 'ea4f36', 'f57d4a'].map(k);
    for (var yy = 0; yy < 7; yy++) for (var xx = -8; xx <= 8; xx++) marca(r[0] + xx, r[1] - 12 + yy, yy === 0 ? TEL[3] : xx < -6 || xx > 6 ? TEL[0] : yy < 3 ? TEL[2] : TEL[1]);
    for (yy = 0; yy < 6; yy++) for (xx = -7; xx <= 7; xx++) marca(r[0] + xx, r[1] - 5 + yy, yy === 5 ? MAD[0] : Math.abs(xx) <= 1 && yy > 1 ? MAD[0] : xx < 0 ? MAD[3] : MAD[2]);
  }

  // ================================================================ dados dos ginásios (os do jogo, GameData.GYMS)
  var NOMES = { fogo: 'Fornalha', agua: 'Remanso', grama: 'Capoeira' };
  var COR_EL = { fogo: ['6e2727', 'e83b3b', 'fb6b1d', 'f9c22b'], agua: ['323353', '4d65b4', '4d9be6', '8fd3ff'], grama: ['165a4c', '239063', '1ebc73', '91db69'] };
  var GYM = {};
  ['fogo', 'agua', 'grama'].forEach(function (el) {
    var g = null;
    if (GD && GD.GYMS) for (var id in GD.GYMS) if (GD.GYMS[id].element === el) g = GD.GYMS[id];
    GYM[el] = { el: el, nome: g ? g.name : 'Ginásio ' + NOMES[el], etapas: g ? g.etapas.map(function (e) { return e.nome; }) : ['Recruta', 'Cabo', 'Sargento', 'Tenente', 'Líder'] };
  });
  function idTreinador(nome) { return String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  var ROTULO = ['Soldado 1', 'Soldado 2', 'Soldado 3', 'Soldado 4', 'Líder'];

  // estado de exemplo (só da amostra; no jogo vem do save e do ginasio.js)
  var PRESETS = {
    exemplo: { fogo: 2, agua: 5, grama: 0, revanche: { agua: 'livre' } },
    comeco: { fogo: 0, agua: 0, grama: 0, revanche: {} },
    tudo: { fogo: 5, agua: 5, grama: 5, revanche: { fogo: 'livre', agua: 'feita', grama: 'livre' } }
  };
  var est = null;
  function usaPreset(n) { var p = PRESETS[n]; est = { prog: { fogo: p.fogo, agua: p.agua, grama: p.grama }, revanche: JSON.parse(JSON.stringify(p.revanche)), preset: n }; }
  usaPreset('exemplo');
  function estadoEtapa(el, i) {
    var p = est.prog[el];
    if (i === 4 && p >= 5) return est.revanche[el] === 'livre' ? 'revanche' : 'feita';
    return i < p ? 'vencida' : i === p ? 'proxima' : 'fechada';
  }
  var EST_TXT = { vencida: 'vencida', proxima: 'próxima: o seu cavalo está aqui', fechada: 'fechada, vença a anterior', revanche: 'revanche hoje', feita: 'revanche de hoje feita' };

  // ================================================================ imagens
  var IMG = {}, faltam = 0;
  function carrega(nome, src) { faltam++; var im = new Image(); im.onload = function () { IMG[nome] = im; if (--faltam === 0) pronto(); }; im.onerror = function () { if (--faltam === 0) pronto(); }; im.src = src; }
  ['fogo', 'agua', 'grama'].forEach(function (g) { carrega('mapa-' + g, M.mapas[g]); });
  Object.keys(M.treinadores).forEach(function (t) { carrega('t-' + t, M.treinadores[t]); });
  Object.keys(M.icones).forEach(function (t) { if (M.icones[t]) carrega('i-' + t, M.icones[t]); });
  Object.keys(M.piloto.usados).forEach(function (t) { carrega('p-' + t, M.piloto.usados[t]); });
  ['fogo', 'agua', 'grama'].forEach(function (el) { carrega('g-' + el, M.piloto.usados['ginasio-' + el]); });
  carrega('d-arena', M.desafio.arena); carrega('d-arena0', M.desafio.arena0);
  M.desafio.costas.forEach(function (u, i) { carrega('d-costas-' + i, u); });
  M.desafio.oito.forEach(function (u, i) { carrega('d-oito-' + i, u); });
  // os moldes do PixelLab (os mesmos do jogo): sem eles o sprites.js cai no cavalo desenhado por código
  if (SP.loadMolds && window.__MOLDES) { faltam++; SP.loadMolds(window.__MOLDES, function () { if (--faltam === 0) pronto(); }); }
  document.getElementById('hojeMundo').src = M.hoje.mundo;
  document.getElementById('hojeTrilha').src = M.hoje.trilha;

  // ================================================================ medidor e relógio
  var medidor = { ms: [], chamadas: 0, part: 0 };
  var reduzido = false;
  try { reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* sem matchMedia */ }
  var Q = /[?&]quadro=([\d.]+)/.exec(location.search), T_FIXO = Q ? +Q[1] : null;
  var T0 = performance.now();
  function agora() { return T_FIXO !== null ? T_FIXO : (performance.now() - T0) / 1000; }
  function vento(t) { return 0.5 + 0.3 * Math.sin(t * 0.37) + 0.2 * Math.sin(t * 0.91 + 1.3); }   // 0..1, cosmético
  function ventoEm(x, t) { return vento(t - x / 110); }

  // ================================================================ o buffer de arte e a cópia para a tela
  var arte = tela(W, H), g = arte.getContext('2d'); g.imageSmoothingEnabled = false;
  function R(x, y, w, h, cor) { g.fillStyle = cor; g.fillRect(x | 0, y | 0, w, h); medidor.chamadas++; }
  function D(img, x, y) { g.drawImage(img, Math.round(x), Math.round(y)); medidor.chamadas++; }
  function texto(t, x, y, cor, alinha, fonte) {
    medidor.chamadas++;
    return SP.drawText(g, t, Math.round(x), Math.round(y), { fonte: fonte || 'g7', scale: 1, color: cor || '#ffffff', shadow: '#2e222f', align: alinha });
  }
  var largCache = {}, largCtx = null;
  var HEX = {};
  function hexC(c) { if (!HEX[c]) HEX[c] = '#' + [c & 255, (c >>> 8) & 255, (c >>> 16) & 255].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); return HEX[c]; }
  function larguraTexto(t, fonte) { var kk = (fonte || 'g7') + t; if (largCache[kk] == null) { largCtx = largCtx || tela(1, 1).getContext('2d'); largCache[kk] = SP.drawText(largCtx, t, 0, 0, { fonte: fonte || 'g7', scale: 1, color: '#ffffff' }); } return largCache[kk]; }

  // ================================================================ o mundo vivo
  var mundo = gerarMundo(); decorarMundo(mundo);
  mundo.b.poe();
  // camadas de copas em faixas verticais de 24 px: cada faixa balança inteira (o vento atravessa da esquerda para a direita)
  var FAIXA = 24, faixas = [];
  for (var fx0 = 0; fx0 < W; fx0 += FAIXA) faixas.push({ x0: fx0, c: null, y0: 0, arv: [] });
  mundo.arvores.forEach(function (a) { faixas[Math.min(faixas.length - 1, (a.x / FAIXA) | 0)].arv.push(a); });
  faixas = faixas.filter(function (f) { return f.arv.length; });
  faixas.forEach(function (f) {   // cada faixa só da altura das copas dela
    var y0 = Math.min.apply(null, f.arv.map(function (a) { return a.y - a.r; })), y1 = Math.max.apply(null, f.arv.map(function (a) { return a.y + a.r + 1; }));
    f.y0 = y0; f.c = tela(FAIXA + 16, y1 - y0); var gg = f.c.getContext('2d');
    f.arv.forEach(function (a) { gg.drawImage(a.c.c, a.x - a.r - f.x0 + 8, a.y - a.r - y0); });
  });
  // o chão vivo: cópia do chão onde o ciclo de cor reescreve só os pixels de água e lava (a 12 q/s)
  var vivo = new Buf(W, H); vivo.d.set(mundo.b.d); vivo.poe();
  var cicloT = -1, CICLO_FPS = 12;
  var marProf = new Float32Array(W * H), marFase = new Float32Array(W * H);
  (function () {
    for (var i = 0; i < mundo.marPx.length; i += 3) { var p = mundo.marPx[i], x = p % W, y = (p / W) | 0;
      marProf[p] = lim(mundo.dc[p] / 30 + (fbm(x / 20, y / 20, 4, 3) - 0.5) * 0.5 + (bayer(x, y) - 0.5) * 0.06, 0, 1); marFase[p] = hash(x, y + 77) * 6.283; }
  })();
  // só os pixels do mar que podem mudar: perto de uma fronteira de tom (a faixa ondula ±0,035), na arrebentação ou
  // candidatos a brilho; o resto fica com a cor do chão vivo
  var marAtivo = [];
  for (var mi = 0; mi < mundo.marPx.length; mi += 3) {
    var mp = mundo.marPx[mi], pr0 = marProf[mp], perto = [0.07, 0.3, 0.62].some(function (l) { return Math.abs(pr0 - l) < 0.04; });
    if (perto || mundo.dc[mp] < 5 || marFase[mp] < 0.018) marAtivo.push(mp);
  }
  var SEN = new Float32Array(1024); for (var si = 0; si < 1024; si++) SEN[si] = Math.sin(si / 1024 * Math.PI * 2);
  function fsin(x) { return SEN[(x * 162.97466 | 0) & 1023]; }
  function cicloMundo(t) {
    var q = Math.floor(t * CICLO_FPS); if (q === cicloT) return; cicloT = q; t = q / CICLO_FPS;
    var d = vivo.d, MAR = RK.mar, DOCE = RK.doce, LAVA = RK.lava, i, p, x, y;
    // mar: as faixas de profundidade ondulam, a arrebentação vem em ondas para a praia e o fundo cintila
    for (i = 0; i < marAtivo.length; i++) {
      p = marAtivo[i]; var dc = mundo.dc[p];
      var pr = marProf[p] + 0.035 * fsin(t * 0.9 + marFase[p] * 0.15 + (p % W) * 0.05);
      var ii = pr < 0.07 ? 3 : pr < 0.3 ? 2 : pr < 0.62 ? 1 : 0;
      if (dc < 5) { var onda = mod(dc - t * 2.2 + fsin((p % W) * 0.08 + ((p / W) | 0) * 0.05) * 0.8, 6); if (onda < 0.9) ii = dc < 1.6 ? 5 : 4; }
      else if (ii <= 1 && marFase[p] < 0.018 && fsin(t * 2.1 + marFase[p] * 400) > 0.7) ii = 3;
      d[p] = ii === 5 ? K.c7dcd0 : MAR[ii];
    }
    // rio e lago: a correnteza desce o rio (faixas claras andando pelo arco); o lago tem ondinhas que brilham
    for (i = 0; i < mundo.aguaPx.length; i += 3) {
      p = mundo.aguaPx[i]; var s = mundo.aguaPx[i + 1], jj = mundo.aguaPx[i + 2];
      x = p % W; y = (p / W) | 0;
      if (s < 0) { if (jj >= 2 && hash(x >> 1, y) < 0.08 && fsin(t * 1.3 + hash(x, y) * 40) > 0.6) jj = Math.min(4, jj + 1); }
      else if (mod(s - t * 9 + (x & 1) * 2, 10) < 1.6 && jj >= 2) jj = Math.min(4, jj + 1);
      d[p] = DOCE[jj];
    }
    // lava: escorre do topo pelos fios (faixas quentes andando para baixo); as rachaduras pulsam
    for (i = 0; i < mundo.lavaPx.length; i += 3) {
      p = mundo.lavaPx[i]; var sl = mundo.lavaPx[i + 1], dl = mundo.lavaPx[i + 2], li;
      if (sl >= 0) { var ff = mod(sl - t * 7, 9); li = (ff < 2 ? 6 : ff < 4.5 ? 5 : 4) - (dl > 0.6 ? 2 : 0); }
      else if (sl === -1) li = 4 + Math.round(1 + fsin(t * 1.7 + (p % 7)));
      else li = fsin(t * 1.2 + sl) > 0.25 ? 3 : 2;
      d[p] = LAVA[lim(li, 1, 6)];
    }
    vivo.poe();
  }

  // ---- névoa sobre o que não foi conquistado (Hollow Knight): manchas que andam devagar, sólidas no miolo e em
  // pontilhado na borda, com o terreno lavado no meio-termo. Densidade pelo progresso: 0/5 densa, 4/5 rala, insígnia: some.
  var REG_ID = { fogo: 1, agua: 2, grama: 3 };
  var pesoReg = { 1: new Float32Array(W * H), 2: new Float32Array(W * H), 3: new Float32Array(W * H) };
  function calculaPesos(regiaoDe) {   // o peso de cada região, borrado (caixa de 9 px, duas passadas): a névoa não para na fronteira seca
    var out = { 1: new Float32Array(W * H), 2: new Float32Array(W * H), 3: new Float32Array(W * H) };
    [1, 2, 3].forEach(function (r) {
      var a = out[r], tmp = new Float32Array(W * H), R2 = 9, x, y, s;
      for (var p = 0; p < W * H; p++) a[p] = regiaoDe(p) === r ? 1 : 0;
      for (var pass = 0; pass < 2; pass++) {
        for (y = 0; y < H; y++) { s = 0; for (x = -R2; x < W + R2; x++) { if (x + R2 < W) s += a[y * W + x + R2]; if (x - R2 - 1 >= 0) s -= a[y * W + x - R2 - 1]; if (x >= 0 && x < W) tmp[y * W + x] = s / (2 * R2 + 1); } }
        for (x = 0; x < W; x++) { s = 0; for (y = -R2; y < H + R2; y++) { if (y + R2 < H) s += tmp[(y + R2) * W + x]; if (y - R2 - 1 >= 0) s -= tmp[(y - R2 - 1) * W + x]; if (y >= 0 && y < H) a[y * W + x] = s / (2 * R2 + 1); } }
      }
    });
    return out;
  }
  pesoReg = calculaPesos(function (p) { return mundo.terra[p] > -0.25 ? mundo.regiao[p] : 0; });
  var NEV_W = 256, nevCampo = new Float32Array(NEV_W * H);
  for (var ny0 = 0; ny0 < H; ny0++) for (var nx0 = 0; nx0 < NEV_W; nx0++) {   // emendado nas pontas (anda sem salto)
    var f1 = fbm(nx0 / 34, ny0 / 26, 91, 4), f2 = fbm((nx0 - NEV_W) / 34, ny0 / 26, 91, 4);
    nevCampo[ny0 * NEV_W + nx0] = (f1 * (NEV_W - nx0) + f2 * nx0) / NEV_W;
  }
  var nevoa = new Buf(W, H), nevT = -1, nevChave = '';
  var lavado = new Uint32Array(W * H);   // o terreno "lavado": cada cor puxada para o claro e o frio (troca de paleta)
  var LAVA_MAPA = {};
  function lavar(c) {
    if (LAVA_MAPA[c] !== undefined) return LAVA_MAPA[c];
    var r = c & 255, gg = (c >>> 8) & 255, bb = (c >>> 16) & 255, lum = (r * 0.3 + gg * 0.59 + bb * 0.11);
    var alvo = [lum * 0.62 + 160 * 0.38, lum * 0.62 + 176 * 0.38, lum * 0.62 + 182 * 0.38], melhor = 0, md = 1e9;
    ['9babb2', 'c7dcd0', '7f708a', '92a984', 'b2ba90', '547e64', 'ab947a', '625565', '694f62'].forEach(function (h) {
      var v = rgbDe(h), dd = Math.pow(v[0] - alvo[0], 2) + Math.pow(v[1] - alvo[1], 2) + Math.pow(v[2] - alvo[2], 2);
      if (dd < md) { md = dd; melhor = K[h]; }
    });
    return (LAVA_MAPA[c] = melhor);
  }
  function densNevoa(el) { var p = est.prog[el]; return p >= 5 ? 0 : [0.78, 0.64, 0.5, 0.38, 0.27][p]; }
  var BAY = new Float32Array(16); for (var bi = 0; bi < 16; bi++) BAY[bi] = (BAYER[bi] + 0.5) / 16;
  for (var ci = 0; ci < nevCampo.length; ci++) nevCampo[ci] = suave(0.34, 0.66, nevCampo[ci]);   // já como cobertura 0..1
  var nevLista = null, nevV = new Float32Array(W * H), nevMetade = 0;
  function atualizaNevoa(t) {
    var chave = est.prog.fogo + ',' + est.prog.agua + ',' + est.prog.grama, d = nevoa.d, p, i;
    if (chave !== nevChave) {   // os pixels que podem ter névoa com este progresso (v alto o bastante)
      nevChave = chave; nevT = -1; nevLista = [];
      var dens = { 1: densNevoa('fogo'), 2: densNevoa('agua'), 3: densNevoa('grama') };
      for (p = 0; p < W * H; p++) {
        var v = 0; for (var r = 1; r <= 3; r++) if (dens[r] > 0) v += dens[r] * pesoReg[r][p];
        nevV[p] = v * 1.25; d[p] = 0;
        if (v * 1.25 * 1.35 > 0.6) nevLista.push(p);
      }
      nevMetade = 2;
    }
    var q = Math.floor(t * 6);
    if (q !== nevT) { nevT = q; nevMetade = 0; }
    if (nevMetade >= 2) return;
    // metade dos pixels por quadro (pares e ímpares), em dois quadros seguidos
    t = nevT / 6;
    var ox = Math.floor(t * 2.5), oy = Math.floor(t * 0.6), NV = [K['9babb2'], K.c7dcd0, K.ffffff], L = nevLista;
    for (i = nevMetade; i < L.length; i += 2) {
      p = L[i]; var x = p % W, y = (p / W) | 0;
      var c = nevCampo[((y + oy) % H) * NEV_W + (((x - ox) % NEV_W) + NEV_W) % NEV_W], f = nevV[p] * (0.3 + c * 1.05);
      var lim1 = BAY[(((y >> 1) & 3) << 2) | ((x >> 1) & 3)];   // borda em massas de 2 × 2, não pontinhos
      d[p] = f > 1.02 ? NV[c > 0.85 ? 2 : c > 0.6 ? 1 : 0] : f > 0.86 ? (lim1 < (f - 0.86) * 6 ? NV[c > 0.7 ? 1 : 0] : lavado[p]) : (f > 0.6 && lim1 < (f - 0.6) * 3.8) ? lavado[p] : 0;
    }
    nevMetade++;
    if (nevMetade === 2) nevoa.poe();
  }

  // ---- nuvens altas com sombra (a sombra é o chão escurecido, troca de paleta) e pássaros
  var escuro = new Buf(W, H), ESC = {};
  function escurecer(c) {
    if (ESC[c] !== undefined) return ESC[c];
    var r = c & 255, gg = (c >>> 8) & 255, bb = (c >>> 16) & 255, alvo = [r * 0.62 + 20, gg * 0.6 + 12, bb * 0.66 + 30], melhor = 0, md = 1e9;
    R64.forEach(function (h) { var v = rgbDe(h), dd = Math.pow(v[0] - alvo[0], 2) * 0.9 + Math.pow(v[1] - alvo[1], 2) * 1.2 + Math.pow(v[2] - alvo[2], 2); if (dd < md) { md = dd; melhor = K[h]; } });
    return (ESC[c] = melhor);
  }
  function nuvemForma(sem, w, h) {
    var c = new Buf(w, h), rng = rngCosmetica(sem), bolhas = [];
    for (var i = 0; i < 7; i++) bolhas.push([w * (0.18 + rng() * 0.64), h * (0.45 + rng() * 0.25), h * (0.25 + rng() * 0.22)]);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var dent = false, luz = 0;
      bolhas.forEach(function (b) { var dd = Math.hypot(x - b[0], (y - b[1]) * 1.3); if (dd < b[2]) { dent = true; luz = Math.max(luz, 1 - Math.hypot(x - b[0] + b[2] * 0.4, y - b[1] + b[2] * 0.5) / b[2]); } });
      if (!dent || y > h * 0.82) continue;
      c.d[y * w + x] = luz > 0.45 ? K.ffffff : luz > 0.12 || y < h * 0.6 ? K.c7dcd0 : K['9babb2'];
    }
    return c.poe();
  }
  var nuvens = [[0, 40, 46, 18, 3.2], [140, 170, 38, 15, 2.4], [70, 300, 52, 20, 2.9]].map(function (n, i) {
    var f = nuvemForma(700 + i, n[2], n[3]), sombra = tela(n[2], n[3]), sg = sombra.getContext('2d');
    sg.drawImage(f.c, 0, 0);
    return { x0: n[0], y: n[1], w: n[2], h: n[3], v: n[4], c: f.c, sombra: sombra };
  });
  var tmpSombra = tela(80, 40), tsg = tmpSombra.getContext('2d');
  function desenhaNuvens(t, so) {
    nuvens.forEach(function (n) {
      var x = Math.round(mod(n.x0 + t * n.v, W + n.w + 40) - n.w - 20), y = n.y;
      if (so === 'sombra') {   // a sombra cai 16 px abaixo e 10 à direita: o chão daquela forma, escurecido (refeita só
        // quando a nuvem anda um pixel)
        if (n.sx !== x) {
          n.sx = x; n.sc = n.sc || tela(n.w, n.h); var sg = n.sc.getContext('2d');
          sg.globalCompositeOperation = 'copy'; sg.drawImage(n.sombra, 0, 0);
          sg.globalCompositeOperation = 'source-in'; sg.drawImage(escuro.c, -(x + 10), -(y + 16));
          sg.globalCompositeOperation = 'source-over'; medidor.chamadas += 2;
        }
        D(n.sc, x + 10, y + 16);
      } else D(n.c, x, y);
    });
  }
  var ASA = [[[0, 0], [1, 1], [3, 1], [4, 0]], [[0, 1], [1, 0], [2, 1], [3, 0], [4, 1]]];
  function desenhaPassaros(t) {
    var ciclo = 14, k0 = Math.floor(t / ciclo), u = (t % ciclo) / 9;
    if (u > 1) return;
    var rng = rngCosmetica(300 + k0), y0 = 60 + rng() * 250, sobe = (rng() - 0.5) * 60, esq = rng() < 0.5;
    for (var b = 0; b < 4; b++) {
      var x = esq ? -20 + u * (W + 40) - b * 7 : W + 20 - u * (W + 40) + b * 7, y = y0 + u * sobe + (b % 2 ? 4 : -2) * Math.min(b, 2);
      var q = ASA[Math.floor(t * 6 + b) & 1];
      for (var i = 0; i < q.length; i++) R(Math.round(x) + q[i][0], Math.round(y) + q[i][1], 1, 1, '#2e222f');
      medidor.part++;
    }
  }
  // ---- fumaça e bombas do vulcão (partículas em vetores fixos; nada de objeto novo por quadro)
  var CRATERA = mundo.cratera;
  var NP = 60, pX = new Float32Array(NP), pY = new Float32Array(NP), pVX = new Float32Array(NP), pVY = new Float32Array(NP), pV = new Float32Array(NP), pT = new Uint8Array(NP), pVida = new Float32Array(NP);
  var rngP = rngCosmetica(55), proxErupcao = 3, proxFumaca = 0, tAnt = 0;
  function solta(tp, x, y, vx, vy, vida) { for (var i = 0; i < NP; i++) if (pV[i] <= 0) { pT[i] = tp; pX[i] = x; pY[i] = y; pVX[i] = vx; pVY[i] = vy; pV[i] = vida; pVida[i] = vida; return; } }
  function particulas(t, dt) {
    var C0 = CRATERA;
    if (t > proxFumaca) { proxFumaca = t + 0.22; solta(0, C0[0] + (rngP() - 0.5) * 8, C0[1] - 1, 0, -6 - rngP() * 4, 3.2 + rngP()); }
    if (t > proxErupcao) {
      proxErupcao = t + 3 + rngP() * 3;
      for (var b = 0; b < 7; b++) solta(1, C0[0] + (rngP() - 0.5) * 4, C0[1] - 2, (rngP() - 0.5) * 34, -30 - rngP() * 22, 1.6);
      for (b = 0; b < 4; b++) solta(0, C0[0] + (rngP() - 0.5) * 6, C0[1] - 3, (rngP() - 0.5) * 6, -14 - rngP() * 6, 2.6);
    }
    var vv = vento(t);
    for (var i = 0; i < NP; i++) {
      if (pV[i] <= 0) continue;
      pV[i] -= dt;
      if (pT[i] === 0) { pX[i] += (pVX[i] + 4 + vv * 6) * dt; pY[i] += pVY[i] * dt; pVY[i] *= 0.995; }
      else { pX[i] += pVX[i] * dt; pY[i] += pVY[i] * dt; pVY[i] += 46 * dt; if (pY[i] > C0[1] + 26) pV[i] = 0; }
    }
  }
  function desenhaParticulas() {
    for (var i = 0; i < NP; i++) {
      if (pV[i] <= 0) continue;
      var f = 1 - pV[i] / pVida[i], x = Math.round(pX[i]), y = Math.round(pY[i]);
      if (pT[i] === 0) { var tam = f < 0.25 ? 2 : f < 0.7 ? 3 : 2; R(x, y, tam, tam, f < 0.3 ? '#625565' : f < 0.65 ? '#7f708a' : '#9babb2'); }
      else R(x, y, 1, 1, f < 0.5 ? '#fbff86' : '#fb6b1d');
      medidor.part++;
    }
  }
  // ---- os ginásios no mundo: medalhão do líder (a cabeça do corpo de 32 × 48, recortada 1:1), placa com o nome e o
  // progresso, bandeiras e fogo que mexem, insígnia brilhando no conquistado, "!" da revanche do dia, cursor de seleção
  var cabecas = {};
  function cabeca(el) {
    if (cabecas[el]) return cabecas[el];
    var im = IMG['t-' + idTreinador(GYM[el].etapas[4])]; if (!im) return null;
    var b = Buf.de(im), topo = 0, x, y;
    for (y = 0; y < b.h && !topo; y++) for (x = 0; x < b.w; x++) if (b.d[y * b.w + x]) { topo = y; break; }
    var x0 = b.w, x1 = 0;
    for (y = topo; y < topo + 10; y++) for (x = 0; x < b.w; x++) if (b.d[y * b.w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    var cx = Math.round((x0 + x1) / 2), m = new Buf(16, 16), anel = COR_EL[el];
    for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) {
      var d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 7.9) continue;
      m.d[y * 16 + x] = d > 6.9 ? K['2e222f'] : d > 5.9 ? (x + y < 14 ? k(anel[3]) : k(anel[2])) : (b.em(cx - 6 + x, topo - 1 + y) || k(anel[0]));
    }
    return (cabecas[el] = m.poe().c);
  }
  var POS_G = GEO.ginasios, MARCA = { topo: -40, ex: -4, base: -6, placa: 13 };
  function bandeira(x, y, cor, t, fase) {
    R(x, y - 9, 1, 10, '#4c3e24');
    for (var i = 0; i < 5; i++) {
      var dy = Math.round(fsin(t * 5.5 - i * 0.9 + fase) * 0.7 * Math.min(1, i / 2 + 0.3) + vento(t) * 0.4);
      R(x + 1 + i, y - 9 + dy, 1, 3, i === 4 ? css(cor[1]) : css(cor[2]));
      if (i === 0) R(x + 1, y - 9 + dy, 1, 1, css(cor[3]));
    }
  }
  function chama(x, y, t, fase) {
    var q = Math.floor(t * 10 + fase) % 3, h = 2 + (q === 1 ? 1 : 0);
    R(x - 1, y, 3, 1, '#4c3e24');
    R(x - 1, y - 1, 3, 1, '#e83b3b'); R(x, y - 1 - h, 1, h, '#f79617'); R(x + (q === 2 ? 1 : -1), y - 2, 1, 1, '#fb6b1d');
    R(x, y - 2, 1, 1, '#fbff86');
  }
  function enfeitesGinasios(t) {
    var f = POS_G.fogo, a = POS_G.agua, gm = POS_G.grama;
    bandeira(f[0] - 10, f[1] - 6, COR_EL.fogo, t, 0); bandeira(f[0] + 8, f[1] - 6, COR_EL.fogo, t, 1.7);
    chama(f[0] - 4, f[1] + 11, t, 0); chama(f[0] + 4, f[1] + 11, t, 1.3);
    bandeira(a[0] - 13, a[1] - 2, COR_EL.agua, t, 0.4); bandeira(a[0] + 11, a[1] - 2, COR_EL.agua, t, 2.2);
    mundo.cerca.forEach(function (c) { R(c[0], c[1] - 2, 1, 3, '#4c3e24'); R(c[0], c[1] - 2, 1, 1, '#cd683d'); });
    bandeira(gm[0] - 7, gm[1] - 9, COR_EL.grama, t, 0.9); bandeira(gm[0] + 5, gm[1] - 9, COR_EL.grama, t, 2.9);
    chama(gm[0] - 3, gm[1] + 11, t, 0.6); chama(gm[0] + 3, gm[1] + 11, t, 2.1);
  }
  var sel = { mundo: 0, trilha: 0 };
  var ORDEM = ['fogo', 'agua', 'grama'];
  // estandarte do líder: mastro fincado atrás do ginásio, pano na cor do elemento com a cabeça do líder (do corpo 32 × 48,
  // 1:1), barra dourada e medalha pendurada quando conquistado; 4 fases do vento pré-assadas (1 desenho por quadro)
  var estandartes = {};
  function estandarte(el, fase, conq) {
    var kk = el + fase + (conq ? 'c' : ''), c0 = estandartes[kk]; if (c0) return c0;
    var b = new Buf(22, 34), cor = COR_EL[el].map(k), TINTA = K['2e222f'], OURO = [K.f79617, K.f9c22b, K.fbb954], MAD = [K['4c3e24'], K['9e4539']];
    var im = IMG['t-' + idTreinador(GYM[el].etapas[4])], cb = im ? Buf.de(im) : null, topo = 0, cx = 16, x, y;
    if (cb) { for (y = 0; y < cb.h && !topo; y++) for (x = 0; x < cb.w; x++) if (cb.d[y * cb.w + x]) { topo = y; break; }
      var x0 = cb.w, x1 = 0; for (y = topo; y < topo + 10; y++) for (x = 0; x < cb.w; x++) if (cb.d[y * cb.w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } cx = Math.round((x0 + x1) / 2); }
    for (y = 1; y < 34; y++) { b.d[y * 22 + 1] = MAD[0]; b.d[y * 22 + 2] = y < 32 ? MAD[1] : MAD[0]; }   // mastro (luz da esquerda)
    b.d[0 * 22 + 1] = OURO[1]; b.d[0 * 22 + 2] = OURO[2];
    for (x = 1; x < 19; x++) b.d[2 * 22 + x] = conq ? (x < 4 ? OURO[2] : OURO[0]) : MAD[1];             // travessa
    for (var r = 0; r < 19; r++) {
      var dx = Math.round(fsin(fase * 1.5708 + r * 0.33) * Math.min(1, r / 9)), y2 = 3 + r, larg = 15;
      for (x = 0; x < larg; x++) {
        if (r >= 16 && Math.abs(x - 7) < (r - 15) * 2.4) continue;   // ponta em rabo de andorinha
        var X = 3 + x + dx, cc = x === 0 ? cor[2] : x === larg - 1 || r === 18 || (r >= 16 && Math.abs(x - 7) < (r - 14) * 2.4) ? cor[0] : cor[1];
        if (conq && (x === 0 || x === larg - 1)) cc = x === 0 ? OURO[2] : OURO[0];
        if (r < 1) cc = cor[0];
        var hx = x - 1, hy = r - 2;   // a cabeça do líder no pano
        if (cb && hx >= 0 && hx < 13 && hy >= 0 && hy < 13) { var hc = cb.em(cx - 6 + hx, topo - 1 + hy); if (hc) cc = hc; }
        b.d[y2 * 22 + X] = cc;
      }
    }
    if (conq) {   // a insígnia: medalha de ouro pendurada na ponta
      for (y = 0; y < 6; y++) for (x = 0; x < 6; x++) { var d = Math.hypot(x - 2.5, y - 2.5); if (d < 3.1) b.d[(27 + y) * 22 + 8 + x] = d > 2.2 ? TINTA : (x + y < 4 ? OURO[2] : OURO[1]); }
    }
    return (estandartes[kk] = b.poe().c);
  }
  function marcadorGinasio(el, t, i) {
    var p = POS_G[el], conq = est.prog[el] >= 5, bx = p[0] + MARCA.ex, by = p[1] + MARCA.base, fase = Math.floor(t * 4 + i) & 3;
    // sombra do mastro no chão: diagonal para baixo e para a direita, no chão escurecido
    for (var q = 1; q < 9; q++) { var sx = bx + 2 + q, sy = by + (q >> 1); if (sx >= 0 && sy >= 0 && sx < W && sy < H) R(sx, sy, 1, 1, hexC(escuro.d[sy * W + sx] || K['3e3546'])); }
    D(estandarte(el, fase, conq), bx - 1, by - 33);
    if (conq) { var br = mod(t * 9, 30); if (br < 6) R(bx + 9 + Math.floor(br / 2), by - 5 + (Math.floor(br) % 3), 1, 1, '#ffffff'); }
    var rv = est.revanche[el];
    if (conq && rv === 'livre') balao(bx - 4, by - 30, t, '#f79617');
    // placa: nome e as 5 etapas (cheia = vencida); a única peça de interface no mapa
    var x = p[0], nome = NOMES[el], lw = larguraTexto(nome), pw = Math.max(lw + 6, 33), px = x - Math.round(pw / 2), py = p[1] + MARCA.placa + (el === 'agua' ? 0 : 1);
    R(px - 1, py - 1, pw + 2, 15, '#2e222f'); R(px, py, pw, 13, '#3e3546'); R(px, py, pw, 1, '#484a77');
    texto(nome, x, py + 2, conq ? '#f9c22b' : '#ffffff', 'center');
    var pr = est.prog[el];
    for (var e = 0; e < 5; e++) R(x - 12 + e * 5, py + 10, 3, 2, e < pr ? '#f9c22b' : '#625565');
  }
  function cursorMundo(t) {
    var el = ORDEM[sel.mundo], p0 = POS_G[el], p = [p0[0] + MARCA.ex + 8, p0[1]], y = p0[1] + MARCA.base - 44 - Math.round(Math.abs(fsin(t * 3)) * 3);
    var cor = '#f9c22b';
    R(p[0] - 3, y, 7, 1, '#2e222f'); R(p[0] - 3, y + 1, 7, 1, cor); R(p[0] - 2, y + 2, 5, 1, cor); R(p[0] - 1, y + 3, 3, 1, cor); R(p[0], y + 4, 1, 1, cor);
    R(p[0] - 4, y + 1, 1, 1, '#2e222f'); R(p[0] + 4, y + 1, 1, 1, '#2e222f'); R(p[0] - 3, y + 2, 1, 1, '#2e222f'); R(p[0] + 3, y + 2, 1, 1, '#2e222f');
    R(p[0] - 2, y + 3, 1, 1, '#2e222f'); R(p[0] + 2, y + 3, 1, 1, '#2e222f'); R(p[0] - 1, y + 4, 1, 1, '#2e222f'); R(p[0] + 1, y + 4, 1, 1, '#2e222f'); R(p[0], y + 5, 1, 1, '#2e222f');
  }
  var camadas = { ciclo: true, copas: true, nevoa: true, nuvens: true, vida: true };
  function quadroMundo(t, dt) {
    if (VAR.id !== 'v1') return quadroMundoPintado(t, dt);
    if (camadas.ciclo && !reduzido) cicloMundo(t); else if (cicloT !== -2) { vivo.d.set(mundo.b.d); vivo.poe(); cicloT = -2; }
    D(vivo.c, 0, 0);
    if (camadas.nuvens) desenhaNuvens(reduzido ? 0 : t, 'sombra');
    faixas.forEach(function (f) {
      var dx = camadas.copas && !reduzido ? Math.round((ventoEm(f.x0, t) - 0.45) * 1.8 + fsin(t * 1.3 - f.x0 / 40) * 0.45) : 0;
      D(f.c, f.x0 - 8 + lim(dx, -1, 1), f.y0);
    });
    enfeitesGinasios(reduzido ? 0 : t);
    if (camadas.vida && !reduzido) { particulas(t, dt); desenhaParticulas(); }
    if (camadas.nevoa) { atualizaNevoa(reduzido ? 0 : t); D(nevoa.c, 0, 0); }
    if (camadas.nuvens) desenhaNuvens(reduzido ? 0 : t);
    ORDEM.forEach(function (el, i) { marcadorGinasio(el, reduzido ? 0 : t, i); });   // por cima das nuvens: sempre legível
    if (camadas.vida && !reduzido) desenhaPassaros(t);
    if (!trans) cursorMundo(reduzido ? 0 : t);
  }
  // ================================================================ variantes do mapa-múndi: v1 (por código) e as ilhas do
  // piloto pago (PixelLab /create-image-pixen, 2026-11-24), com os ginásios do piloto assentados no chão por código:
  // sombra de contato (o chão escurecido por troca de paleta, deslocada para a direita e para baixo, luz da esquerda),
  // cores já na Resurrect 64. Sobre a arte pintada, o código anima a água e a lava (ciclo de cor pelas cores da imagem), a
  // fumaça do vulcão, as nuvens, os pássaros e a névoa.
  var PINT = {
    a: { img: 'terreno-s9902', nome: 'Ilha A (s9902)', cratera: [131, 40], pos: { fogo: [98, 130], agua: [138, 190], grama: [166, 282] },
      reg: [150, 240], lavaAte: 175 },
    b: { img: 'terreno-s9901', nome: 'Ilha B (s9901)', cratera: [87, 41], pos: { fogo: [180, 112], agua: [118, 184], grama: [130, 284] },
      reg: [146, 214], lavaAte: 160 },
    m: { img: 'montado', nome: 'Mapa de peças', cratera: [170, 44], pos: { fogo: [96, 104], agua: [100, 198], grama: [86, 302] },
      reg: [142, 250], lavaAte: 110 }
  };
  var GIN_IMG = { fogo: 'ginasio-fogo-s9921', agua: 'ginasio-agua-s9932', grama: 'ginasio-grama-s9953' };
  var VAR = { id: 'v1' }, varCache = {}, MARCA_V1 = MARCA;
  var AGUA_NAVY = ['323353', '484a77', '4d65b4'].map(k), AGUA_TEAL = ['0b5e65', '0b8a8f', '0eaf9b', '8fd3ff'].map(k);
  var LAVA_R = ['b33831', 'ea4f36', 'fb6b1d', 'f79617', 'f9c22b', 'fbff86'].map(k);
  function objetoGinasio(el) {   // o objeto 64 × 64 com alfa binário; o da Capoeira veio com a mata em volta: recorte oval
    var b = Buf.de(IMG['g-' + el]);
    if (false) for (var y = 0; y < 64; y++) for (var x = 0; x < 64; x++) if (Math.pow((x - 32) / 29, 2) + Math.pow((y - 35) / 25, 2) > 1) b.d[y * 64 + x] = 0;
    var x0 = 64, x1 = 0, y0 = 64, y1 = 0;
    for (var p = 0; p < b.d.length; p++) if (b.d[p]) { var xx = p % 64, yy = (p / 64) | 0; x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); }
    return { c: b.poe().c, b: b, x0: x0, x1: x1, y0: y0, y1: y1 };
  }
  function preparaVariante(id) {
    if (varCache[id]) return varCache[id];
    var P = PINT[id], terr = Buf.de(IMG['p-' + P.img]), N = W * H, base = new Buf(W, H), agua = [], lava = [], obj = {}, cobre = new Uint8Array(N);
    base.d.set(terr.d);
    var esc = function (c) { return escurecer((c | 0xff000000) >>> 0); };
    // sombra de contato e objeto de cada ginásio, assados no chão (a água e a lava debaixo deles não ciclam)
    ORDEM.forEach(function (el) {
      var o = objetoGinasio(el), pp = P.pos[el], ox = pp[0] - 32, oy = pp[1] - 32, x, y;
      // sombra: a silhueta inteira do objeto deslocada (+3, +3), no chão escurecido 1 degrau; e contato sob a base (2 degraus)
      for (y = 0; y < 64; y++) for (x = 0; x < 64; x++) {
        if (!o.b.d[y * 64 + x]) continue;
        [[3, 3], [2, 2]].forEach(function (dd, j) {
          var X = ox + x + dd[0], Y = oy + y + dd[1]; if (X < 0 || Y < 0 || X >= W || Y >= H) return;
          if (j === 0 || !o.b.em(x + dd[0], y + dd[1] + 1)) base.d[Y * W + X] = j === 1 && y > o.y1 - 6 ? esc(esc(terr.d[Y * W + X])) : esc(terr.d[Y * W + X]);
          cobre[Y * W + X] = 1;
        });
      }
      for (y = 0; y < 64; y++) for (x = 0; x < 64; x++) { var c = o.b.d[y * 64 + x], X = ox + x, Y = oy + y; if (c && X >= 0 && Y >= 0 && X < W && Y < H) { base.d[Y * W + X] = c; cobre[Y * W + X] = 1; } }
      // capim do chão invadindo a base do objeto (contato, Regra 7): na borda de baixo, o pixel vira o chão de 3 px abaixo
      for (x = 0; x < 64; x++) for (y = 63; y > 0; y--) if (o.b.d[y * 64 + x]) {
        var X2 = ox + x, Y2 = oy + y, chao = terr.d[Math.min(H - 1, Y2 + 4) * W + X2];
        if (hash(X2 >> 1, Y2) < 0.38) base.d[Y2 * W + X2] = chao;
        if (hash(X2 >> 1, Y2 + 9) < 0.16) base.d[(Y2 - 1) * W + X2] = chao;
        break;
      }
      obj[el] = o;
    });
    for (var p = 0; p < N; p++) {
      if (cobre[p]) continue;
      var c = terr.d[p], y2 = (p / W) | 0, i;
      if ((i = AGUA_NAVY.indexOf(c)) >= 0) agua.push(p, 0, i);
      else if ((i = AGUA_TEAL.indexOf(c)) >= 0) agua.push(p, 1, i);
      else if (y2 < P.lavaAte && (i = LAVA_R.indexOf(c)) >= 0) lava.push(p, i);
    }
    var espuma = [];   // água encostada na terra (abaixo do céu): espuma que pisca em 2 quadros
    for (p = W * 70; p < N - W; p++) {
      if (cobre[p]) continue; var cw = terr.d[p]; if (AGUA_NAVY.indexOf(cw) < 0 && AGUA_TEAL.indexOf(cw) < 0) continue;
      var ehAgua = function (q) { var c2 = terr.d[q]; return AGUA_NAVY.indexOf(c2) >= 0 || AGUA_TEAL.indexOf(c2) >= 0 || LAVA_R.indexOf(c2) >= 0 || c2 === K.ffffff || c2 === K.c7dcd0; };
      if (!ehAgua(p - 1) || !ehAgua(p + 1) || !ehAgua(p - W) || !ehAgua(p + W)) espuma.push(p);
    }
    var regDe = function (pp) {
      var c = terr.d[pp]; if (AGUA_NAVY.indexOf(c) >= 0 || AGUA_TEAL.indexOf(c) >= 0 && ((pp / W) | 0) < 60) return 0;
      var x = pp % W, y = (pp / W) | 0, ry = y + (fbm(x / 30, y / 30, 7, 3) - 0.5) * 30;
      return ry < P.reg[0] ? 1 : ry < P.reg[1] ? 2 : 3;
    };
    var lav = new Uint32Array(N), es = new Buf(W, H);
    for (p = 0; p < N; p++) { lav[p] = lavar((base.d[p] | 0xff000000) >>> 0); es.d[p] = esc(terr.d[p]); }
    es.poe(); base.poe();
    return (varCache[id] = { id: id, P: P, base: base, agua: agua, lava: lava, espuma: espuma, pesos: calculaPesos(regDe), lavado: lav, escuro: es, cicloT: -1 });
  }
  function usaVariante(id) {
    if (id === 'v1') {
      VAR = { id: 'v1' }; POS_G = GEO.ginasios; MARCA = MARCA_V1; CRATERA = mundo.cratera;
      pesoReg = varCache.v1.pesos; lavado = varCache.v1.lavado; escuro = varCache.v1.escuro;
      vivo.d.set(mundo.b.d); vivo.poe(); cicloT = -1;
    } else {
      VAR = preparaVariante(id); POS_G = VAR.P.pos; MARCA = { topo: -52, ex: -10, base: -18, placa: 24 }; CRATERA = VAR.P.cratera;
      pesoReg = VAR.pesos; lavado = VAR.lavado; escuro = VAR.escuro;
      vivo.d.set(VAR.base.d); vivo.poe(); VAR.cicloT = -1;
    }
    nevChave = ''; nuvens.forEach(function (n) { n.sx = null; });
    for (var i = 0; i < NP; i++) pV[i] = 0;
  }
  function cicloPintado(t) {
    var q = Math.floor(t * CICLO_FPS); if (q === VAR.cicloT) return; VAR.cicloT = q; t = q / CICLO_FPS;
    var d = vivo.d, A = VAR.agua, L = VAR.lava, i, p, x, y;
    // água: brilhos que andam em duas ondas cruzadas (sobe um tom onde as duas se somam) e o 8fd3ff piscando
    for (i = 0; i < A.length; i += 3) {
      p = A[i]; x = p % W; y = (p / W) | 0;
      var ramp = A[i + 1] ? AGUA_TEAL : AGUA_NAVY, j = A[i + 2];
      var o = fsin(x * 0.21 + y * 0.13 - t * 1.6) + fsin(x * 0.07 - y * 0.19 + t * 1.1);
      // brilho esparso: só alguns pixels de cada faixa clara acendem (traços curtos na horizontal, não manchas)
      if (o > 1.2 && hash(x >> 1, y) < (A[i + 1] ? 0.35 : 0.14) && j < ramp.length - 1) j++;
      else if (j === ramp.length - 1 && fsin(t * 2.3 + x * 1.7 + y) < -0.6) j--;
      d[p] = ramp[j];
    }
    // lava: escorre para baixo (faixa quente andando pelo y), no tom de cada pixel ±2
    for (i = 0; i < L.length; i += 2) {
      p = L[i]; x = p % W; y = (p / W) | 0;
      var f = mod(y * 0.55 - x * 0.12 - t * 6 + hash(x >> 2, y >> 2) * 3, 9);
      d[p] = LAVA_R[lim(L[i + 1] + (f < 1.5 ? 2 : f < 3.5 ? 1 : f > 7 ? -1 : 0), 0, 5)];
    }
    var E = VAR.espuma, fase2 = Math.floor(t * 3);
    for (i = 0; i < E.length; i++) { p = E[i]; var hh = hash(p % W >> 1, (p / W | 0) + fase2); if (hh < 0.45) d[p] = hh < 0.2 ? K.c7dcd0 : K['8ff8e2']; }
    vivo.poe();
  }
  function quadroMundoPintado(t, dt) {
    if (camadas.ciclo && !reduzido) cicloPintado(t); else if (VAR.cicloT !== -2) { vivo.d.set(VAR.base.d); vivo.poe(); VAR.cicloT = -2; }
    D(vivo.c, 0, 0);
    if (camadas.nuvens) desenhaNuvens(reduzido ? 0 : t, 'sombra');
    if (camadas.vida && !reduzido) { particulas(t, dt); desenhaParticulas(); }
    if (camadas.nevoa) { atualizaNevoa(reduzido ? 0 : t); D(nevoa.c, 0, 0); }
    if (camadas.nuvens) desenhaNuvens(reduzido ? 0 : t);
    ORDEM.forEach(function (el, i) { marcadorGinasio(el, reduzido ? 0 : t, i); });
    if (camadas.vida && !reduzido) desenhaPassaros(t);
    if (!trans) cursorMundo(reduzido ? 0 : t);
  }
  // ================================================================ a trilha de um ginásio
  // As paradas são as de hoje (MAPA_PARADAS do game.js, o chão de cada oponente); a curva passa por elas com
  // curvas em S entre uma e outra, entrando pela borda de baixo.
  var PARADAS = [[88, 360], [168, 292], [84, 224], [168, 156], [128, 84]];
  var CURVA_T = curva([[134, 404], [112, 384], [88, 360], [116, 338], [150, 320], [168, 292], [140, 266], [104, 250], [84, 224],
    [110, 200], [150, 182], [168, 156], [162, 128], [142, 104], [128, 84], [128, 70]], 0.25);
  var arcoParada = PARADAS.map(function (pp) { var m = 0, md = 1e9; CURVA_T.forEach(function (c) { var d = Math.hypot(c[0] - pp[0], c[1] - pp[1]); if (d < md) { md = d; m = c[2]; } }); return m; });
  var PISTA = {
    fogo: { rampa: ['2e222f', '45293f', '694f62', '966c6c', 'ab947a'], agua: [] },
    agua: { rampa: ['4c3e24', '9e4539', 'cd683d', 'e6904e', 'fbb954'], agua: ['9babb2', 'c7dcd0'] },
    grama: { rampa: ['4c3e24', '9e4539', 'cd683d', 'e6904e', 'fbb954'], agua: [] }
  };
  var trilhas = {};
  function preparaTrilha(el) {
    if (trilhas[el]) return trilhas[el];
    var base = Buf.de(IMG['mapa-' + el]), N = W * H, dist = new Float32Array(N).fill(9), arco = new Float32Array(N);
    tracar(CURVA_T, 4.6, dist, arco, W);
    var px = [], agua = PISTA[el].agua.map(k);
    for (var p = 0; p < N; p++) if (dist[p] <= 1) px.push(p);
    // o ciclo de cor do mapa: rachaduras de lava (Fornalha), água (Remanso), capim claro (Capoeira)
    var ciclo = [], quentes = ['e83b3b', 'f79617', 'f9c22b'].map(k), aguas = [k('9babb2'), k('c7dcd0')], capim = [k('a2a947')];
    for (p = 0; p < N; p++) {
      var c = base.d[p];
      if (el === 'fogo' && quentes.indexOf(c) >= 0) ciclo.push(p);
      else if (el === 'agua' && aguas.indexOf(c) >= 0) ciclo.push(p);
      else if (el === 'grama' && capim[0] === c && hash(p % W, (p / W) | 0) < 0.25) ciclo.push(p);
    }
    var camada = new Buf(W, H), vivoT = new Buf(W, H); vivoT.d.set(base.d); vivoT.poe();
    var escT = new Buf(W, H); for (p = 0; p < N; p++) escT.d[p] = escurecer((base.d[p] | 0xff000000) >>> 0); escT.poe();
    // sombra das bases de pedra no chão: a elipse deslocada (+3, +3), 1 degrau abaixo na rampa do próprio chão
    var somb = new Buf(W, H);
    PARADAS.forEach(function (pp, i) {
      var rx = i === 4 ? 14 : 11;
      elipse(pp[0] + 3, pp[1] + 4, rx + 1, 5.5, function (x, y) { if (x >= 0 && y >= 0 && x < W && y < H) somb.d[y * W + x] = escT.d[y * W + x]; });
    });
    somb.poe();
    return (trilhas[el] = { el: el, base: base, vivo: vivoT, esc: escT, sombras: somb, dist: dist, arco: arco, px: px, ponte: agua, camada: camada, ciclo: ciclo, cicloT: -1, chave: '' });
  }
  function cicloTrilha(tr, t) {
    var q = Math.floor(t * CICLO_FPS); if (q === tr.cicloT) return; tr.cicloT = q; t = q / CICLO_FPS;
    var d = tr.vivo.d, b = tr.base.d, LAVA = ['e83b3b', 'fb6b1d', 'f79617', 'f9c22b', 'fbff86'].map(k), i, p, x, y;
    for (i = 0; i < tr.ciclo.length; i++) {
      p = tr.ciclo[i]; x = p % W; y = (p / W) | 0;
      if (tr.el === 'fogo') { var o = LAVA.indexOf(b[p]); var f = mod(x * 0.35 + y * 0.6 - t * 5, 10); d[p] = LAVA[lim(o + (f < 1.5 ? 2 : f < 3.5 ? 1 : 0), 0, 4)]; }
      else if (tr.el === 'agua') { var w = mod(x * 0.25 - y * 0.12 - t * 1.6 + fsin(y * 0.2 + t) * 1.2, 7); d[p] = b[p] === K.c7dcd0 ? (w < 3.5 ? K.c7dcd0 : K['9babb2']) : (w < 0.7 && hash(x, y) < 0.5 ? K.c7dcd0 : K['9babb2']); }
      else d[p] = fsin(t * 2 - x * 0.12 + y * 0.04) > 0.55 ? K.cddf6c : K.a2a947;
    }
    tr.vivo.poe();
  }
  var pintado = 0, pintaAlvo = 0, pintaT = 0;   // até onde (em px de arco) a pista está pintada; a animação anda até o alvo
  var TILE = 7;
  function desenhaPista(tr, t) {
    var tiles = Math.floor(pintado / TILE), novo = pintaAlvo > pintado + 0.01 ? Math.floor(pintado / TILE) : -9;
    var chave = tiles + ':' + novo;
    if (chave !== tr.chave) {
      tr.chave = chave;
      var d = tr.camada.d, RA = PISTA[tr.el].rampa.map(k), MAD = ['4c3e24', '9e4539', 'cd683d', 'e6904e'].map(k);
      d.fill(0);
      for (var i = 0; i < tr.px.length; i++) {
        var p = tr.px[i], s = tr.arco[p], e = tr.dist[p], x = p % W, y = (p / W) | 0, tile = Math.floor(s / TILE);
        var sobreAgua = tr.ponte.indexOf(tr.base.d[p]) >= 0;
        if (tile < tiles) {
          if (sobreAgua) { d[p] = e > 0.82 ? MAD[0] : (Math.floor(s) % 3 === 0 ? MAD[1] : e < 0 ? MAD[3] : MAD[2]); continue; }
          // borda recortada em massas de 2 px (nunca reta); o capim do chão invade em tufos; faixa escura de 1 px na junta
          var borda = 0.74 + (hash(x >> 1, y >> 1) - 0.5) * 0.36;
          if (e > borda) continue;
          if (e > borda - 0.3 && hash((x >> 1) + 40, y >> 1) < 0.13) continue;
          var c = e > borda - 0.14 ? RA[1] : (e > 0.28 && e < 0.42 && hash(x, y >> 1) < 0.5) ? RA[2] : RA[hash(x >> 1, (y >> 1) + 3) < 0.3 ? 2 : 3];
          if (e < 0.55 && hash(x >> 1, (y >> 1) + 17) < 0.03) c = RA[4];
          if (e < 0.6 && hash(x, y - 1 + 17) < 0.008) c = RA[1];
          if (tile === tiles - 1 && novo >= 0) c = e > 0.8 ? RA[2] : RA[4];   // o tile que acabou de pintar acende
          d[p] = c;
        } else {   // pontilhado: uma pegada de terra a cada tile, com a sombra embaixo
          // trecho fechado: só marcas de chão pisado (o próprio chão, 1 degrau mais escuro), em tufos irregulares
          var m = s - tile * TILE;
          if (m > 1.5 && m < 5 && e < 0.5 && hash(x >> 1, (y >> 1) + 23) < 0.7) d[p] = sobreAgua ? MAD[1] : tr.esc.d[p];
        }
      }
      tr.camada.poe();
    }
    D(tr.camada.c, 0, 0);
  }
  // ---- oponentes nas paradas, com o estado legível
  var corpos = {}, apagados = {};
  function corpo(nome, apagado) {
    var id = idTreinador(nome), im = IMG['t-' + id]; if (!im) return null;
    if (!corpos[id]) {
      var b = Buf.de(im), pe = 0; for (var p = 0; p < b.d.length; p++) if (b.d[p]) pe = (p / b.w) | 0;
      corpos[id] = { c: b.poe().c, pe: pe, b: b };
      var a = new Buf(b.w, b.h), TONS = ['2e222f', '3e3546', '45293f', '625565', '694f62', '7f708a'].map(k);
      for (p = 0; p < b.d.length; p++) { var c = b.d[p]; if (!c) continue; var l = ((c & 255) * 0.3 + ((c >>> 8) & 255) * 0.59 + ((c >>> 16) & 255) * 0.11) / 255; a.d[p] = TONS[lim(Math.round(l * 6.5) - 1, 0, 5)]; }
      apagados[id] = { c: a.poe().c, pe: pe };
    }
    return apagado ? apagados[id] : corpos[id];
  }
  // base de pedra baixa (3/4 de cima): tampo com luz da esquerda, face da frente escura; o estado vem num friso
  // embutido no tampo (dourado pulsando na vez, dourado fixo na vencida, nada na fechada), sem disco chapado
  var pedras = {};
  function pedra(rx) {   // a base parada, pré-assada (1 desenho por quadro)
    if (pedras[rx]) return pedras[rx];
    var c = tela(2 * rx + 2, 12), q = c.getContext('2d'), ry = 4.5;
    function r(x, y, w, h, cor) { q.fillStyle = cor; q.fillRect(x + rx, y + 4, w, h); }
    for (var yy = -4; yy <= 6; yy++) {
      var w = Math.round(rx * Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(yy, 3.4) / ry, 2))));
      if (yy > 3) { r(-w, yy, 2 * w, 1, yy === 6 ? '#2e222f' : '#3e3546'); r(-w, yy, 2, 1, '#625565'); continue; }
      r(-w, yy, 2 * w, 1, yy < -1 ? '#ab947a' : yy < 2 ? '#966c6c' : '#7f708a');
      r(-w, yy, 1, 1, '#c7dcd0'); r(w - 1, yy, 1, 1, '#625565');
    }
    return (pedras[rx] = c);
  }
  // base de pedra baixa (3/4 de cima): tampo com luz da esquerda, face da frente escura; o estado vem num friso
  // embutido no tampo (dourado pulsando na vez, dourado fixo na vencida, nada na fechada), sem disco chapado
  function tablado(x, y, rx, estado, t) {
    var vez = estado === 'proxima' || estado === 'revanche', ouro = estado === 'vencida' || estado === 'feita';
    D(pedra(rx), x - rx, y - 4);
    var friso = vez ? (fsin(t * 4) > 0 ? '#fbff86' : '#f9c22b') : ouro ? '#f79617' : null;
    if (!friso) return;
    var wf = rx - 3;
    R(x - wf + 2, y - 2, 2 * wf - 4, 1, friso); R(x - wf + 2, y + 2, 2 * wf - 4, 1, friso);
    R(x - wf, y - 1, 1, 3, friso); R(x + wf - 1, y - 1, 1, 3, friso); R(x - wf + 1, y - 2, 1, 1, friso); R(x + wf - 2, y - 2, 1, 1, friso); R(x - wf + 1, y + 2, 1, 1, friso); R(x + wf - 2, y + 2, 1, 1, friso);
    if (vez) { var a = mod(t * 2.2, 6.283); R(Math.round(x + Math.cos(a) * wf), Math.round(y + Math.sin(a) * 2.2), 1, 1, '#ffffff'); }
  }
  // sombra do treinador: a silhueta cisalhada para baixo e para a direita, deitada no tampo (1 degrau abaixo da pedra)
  var sombrasT = {};
  function sombraTreinador(nome) {
    var id = idTreinador(nome); if (sombrasT[id]) return sombrasT[id];
    var cp = corpo(nome, false); if (!cp) return null;
    var b = cp.b, sb = new Buf(48, 24), pe = cp.pe;
    for (var y = 0; y <= pe; y++) for (var x = 0; x < 32; x++) {
      if (!b.d[y * 32 + x]) continue;
      var h = pe - y, X = x + Math.round(h * 0.5) + 2, Y = 4 + Math.round(h * 0.22);
      for (var k2 = 0; k2 < 2; k2++) if (X + k2 < 48 && Y < 24) sb.d[Y * 48 + X + k2] = K['625565'];
    }
    return (sombrasT[id] = { c: sb.poe().c });
  }
  function cadeado(x, y) { R(x - 2, y - 7, 5, 1, '#2e222f'); R(x - 3, y - 6, 1, 3, '#2e222f'); R(x + 3, y - 6, 1, 3, '#2e222f'); R(x - 2, y - 6, 1, 2, '#9babb2'); R(x + 2, y - 6, 1, 2, '#9babb2'); R(x - 4, y - 3, 9, 6, '#2e222f'); R(x - 3, y - 2, 7, 4, '#f79617'); R(x - 3, y - 2, 7, 1, '#f9c22b'); R(x, y - 1, 1, 2, '#2e222f'); }
  function balao(x, y, t, cor) { cor = cor || '#e83b3b'; var by = y - Math.round(Math.abs(fsin(t * 3.3)) * 3); R(x - 3, by - 9, 7, 9, '#2e222f'); R(x - 2, by - 8, 5, 7, '#ffffff'); R(x, by - 7, 1, 3, cor); R(x, by - 3, 1, 1, cor); R(x - 1, by, 2, 2, '#2e222f'); R(x - 1, by, 1, 1, '#ffffff'); }
  function tablados(tr, t) {
    D(tr.sombras.c, 0, 0);
    PARADAS.forEach(function (pp, i) {
      tablado(pp[0], pp[1], i === 4 ? 14 : 11, estadoEtapa(tr.el, i), t);
      var sm = sombraTreinador(GYM[tr.el].etapas[i]); if (sm) D(sm.c, pp[0] - 16, pp[1] - 4);
    });
  }
  function oponente(tr, t, i) {
    var el = tr.el, pp = PARADAS[i], st = estadoEtapa(el, i);
    var cp = corpo(GYM[el].etapas[i], st === 'fechada'); if (!cp) return;
    var resp = st === 'fechada' ? 0 : Math.round(Math.max(0, fsin(t * 1.4 + i * 1.7)) * 0.6);
    D(cp.c, pp[0] - 16, pp[1] - cp.pe - 1 + resp);
    var topo = pp[1] - cp.pe - 1 + 6;
    if (st === 'fechada') cadeado(pp[0] + 10, pp[1] - 20);
    else if (st === 'proxima') balao(pp[0] + 9, topo + 4, t);
    else if (st === 'vencida') { var es = IMG['i-ui-estrela']; if (es) D(es, pp[0] + 4, topo - 4 + Math.round(fsin(t * 2 + i) * 1)); }
    else { var ins = IMG['i-ins-' + el]; if (ins) D(ins, pp[0] + 6, topo - 10); if (st === 'revanche') balao(pp[0] - 9, topo + 4, t); }
    if (selTrilhaAtiva && sel.trilha === i) {   // a seleção do teclado: cantos em volta da parada
      var q = Math.round(Math.abs(fsin(t * 3))), x0 = pp[0] - 18 - q, x1 = pp[0] + 17 + q, y0 = pp[1] - 46 - q, y1 = pp[1] + 6 + q;
      [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(function (c) { R(c[2] > 0 ? c[0] : c[0] - 3, c[1], 4, 1, '#8ff8e2'); R(c[0], c[3] > 0 ? c[1] : c[1] - 3, 1, 4, '#8ff8e2'); });
    }
  }
  // ---- o cavalo ativo do jogador (o molde do jogo, recolorido pelo sprites.js): idle na parada, trote entre elas
  var CAVALO = (GD && GD.STARTERS && GD.STARTERS[0]) || { palette: { coat: '#c4471d', coatShade: '#7f2a0e', mane: '#ffb02e', accent: '#ffe066' }, element: 'fogo' };
  var cav = { s: 0, alvo: 0, olhaEsq: false, fase: 0, poeira: 0 };
  var cavC = tela(80, 70), cavG = cavC.getContext('2d'), somC = tela(80, 70), somG = somC.getContext('2d');
  cavG.imageSmoothingEnabled = false;
  var NPO = 24, poX = new Float32Array(NPO), poY = new Float32Array(NPO), poV = new Float32Array(NPO);
  function arcoDoCavalo(i) { return Math.max(0, arcoParada[i] - 12); }
  // onde o cavalo fica em cada parada: ao lado do tablado, do lado de dentro da tela, virado para o oponente; no
  // caminho ele segue a pista e, chegando, sai dela até esse lugar (e volta a ela ao partir)
  function ladoParada(i) { var pp = PARADAS[i], d = pp[0] < 128 ? 1 : -1; return [pp[0] + d * 37, pp[1] + 3, d > 0]; }
  function posCavalo(sa) {
    var b = ponto(CURVA_T, sa), x = b[0], y = b[1], olha = null;
    for (var i = 0; i < PARADAS.length; i++) {
      var a = arcoParada[i], w = suave(a - 46, a - 12, sa) * (1 - suave(a - 6, a + 22, sa));
      if (w > 0) { var l = ladoParada(i); x += (l[0] - x) * w; y += (l[1] - y) * w; if (w > 0.85) olha = l[2]; }
    }
    return [x, y, olha];
  }
  function cavaloNaParada(el) { var p = Math.min(est.prog[el], 4); return arcoDoCavalo(p); }
  function desenhaCavalo(t, dt) {
    var anda = Math.abs(cav.alvo - cav.s) > 0.5;
    if (anda && !(pintaAlvo > pintado + 0.01)) {
      var passo = Math.min(Math.abs(cav.alvo - cav.s), 38 * dt); cav.s += cav.alvo > cav.s ? passo : -passo;
      cav.fase += dt * 13;
      if (t > cav.poeira) { cav.poeira = t + 0.09; for (var i = 0; i < NPO; i++) if (poV[i] <= 0) { var pp = posCavalo(cav.s); poX[i] = pp[0] + (hash(i, t * 10 | 0) - 0.5) * 8; poY[i] = pp[1] - 1; poV[i] = 0.5; break; } }
    }
    for (i = 0; i < NPO; i++) if (poV[i] > 0) { poV[i] -= dt; poY[i] -= dt * 6; R(Math.round(poX[i]), Math.round(poY[i]), poV[i] > 0.25 ? 2 : 1, 1, poV[i] > 0.25 ? '#ab947a' : '#c7dcd0'); medidor.part++; }
    var p0 = posCavalo(cav.s), p1 = posCavalo(cav.s + (cav.alvo >= cav.s ? 3 : -3));
    if (!anda && p0[2] !== null) cav.olhaEsq = p0[2]; else if (Math.abs(p1[0] - p0[0]) > 0.6) cav.olhaEsq = p1[0] < p0[0];
    var cx = Math.round(p0[0]), base = Math.round(p0[1]) + 2, base0 = base;
    var o = { palette: CAVALO.palette, element: CAVALO.element, scale: 1, jockey: true, silks: '#f9c22b', reduzido: reduzido,
      quadro: { topo: -1e6, base: base, grade: 1, centro: cx } };
    // um padrão só (pedido do Vinicius): andando ou parado é o mesmo desenho do molde ('parado'); o trote é o passo
    // de 1 px do corpo, em 2 tempos, e a poeira nos cascos — nunca troca para o quadro do galope de corrida
    o.idle = true; o.t = reduzido ? 0.5 : t;
    if (anda && !reduzido && (Math.floor(cav.fase * 0.9) & 1)) base -= 1;
    // o cavalo vai primeiro para um quadro próprio (80 × 70, cascos em y 60); dele saem a sombra e o desenho
    var hx = cx - 40, hy = base - 60;
    cavG.setTransform(1, 0, 0, 1, 0, 0); cavG.globalCompositeOperation = 'source-over'; cavG.clearRect(0, 0, 80, 70);
    if (cav.olhaEsq) { cavG.translate(80, 0); cavG.scale(-1, 1); }
    o.quadro = { topo: -1e6, base: 60, grade: 1, centro: 40 };   // no quadro próprio: cascos em y 60, centro em x 40
    SP.drawHorse(cavG, 20, 24, o);
    cavG.setTransform(1, 0, 0, 1, 0, 0);
    var tr0 = trilhas[atual];
    if (tr0) {
      somG.globalCompositeOperation = 'copy'; somG.drawImage(cavC, 0, 0);
      somG.globalCompositeOperation = 'source-in'; somG.drawImage(tr0.esc.c, -(hx + 3), -(hy + 2));
      somG.globalCompositeOperation = 'source-over';
      g.drawImage(somC, hx + 3, hy + 2);
      var chao = tr0.base.d[lim(base, 0, H - 1) * W + lim(cx, 0, W - 1)], cc = hexC(escurecer(escurecer((chao | 0xff000000) >>> 0)));
      R(cx - 13, base, 26, 1, cc); R(cx - 10, base + 1, 20, 1, cc);
    }
    g.drawImage(cavC, hx, hy); medidor.chamadas += 8;
    return base;
  }
  var selTrilhaAtiva = false;
  function quadroTrilha(t, dt) {
    var tr = preparaTrilha(atual);
    if (!reduzido) cicloTrilha(tr, t); else if (tr.cicloT !== -2) { tr.vivo.d.set(tr.base.d); tr.vivo.poe(); tr.cicloT = -2; }
    D(tr.vivo.c, 0, 0);
    // a pintura anda tile a tile até o alvo; com o tile novo, poeira
    if (pintaAlvo > pintado) {
      var antes = Math.floor(pintado / TILE);
      pintado = reduzido ? pintaAlvo : Math.min(pintaAlvo, pintado + dt * 60);
      if (Math.floor(pintado / TILE) !== antes) { var q = ponto(CURVA_T, pintado); for (var i = 0; i < 3; i++) for (var j = 0; j < NPO; j++) if (poV[j] <= 0) { poX[j] = q[0] + (i - 1) * 3; poY[j] = q[1]; poV[j] = 0.45; break; } }
    }
    desenhaPista(tr, t);
    tablados(tr, t);
    // de trás para a frente: quem está mais acima na tela primeiro
    var yc = posCavalo(cav.s)[1] + 2;
    var lista = PARADAS.map(function (pp, i) { return { y: pp[1], i: i }; }).concat([{ y: yc + 1, cav: true }]).sort(function (a, b) { return a.y - b.y; });
    lista.forEach(function (it) {
      if (it.cav) desenhaCavalo(t, dt);
      else oponente(tr, t, it.i);
    });
    // placa do ginásio no alto
    var nome = GYM[atual].nome, lw = larguraTexto(nome);
    R(5, 5, lw + 34, 18, '#2e222f'); R(6, 6, lw + 32, 16, '#3e3546'); R(6, 6, lw + 32, 1, '#484a77');
    var ic = IMG['i-el-' + atual]; if (ic) D(ic, 7, 6);
    texto(nome, 25, 9, '#ffffff', null);
    for (var e = 0; e < 5; e++) R(25 + e * 5, 18, 3, 2, e < est.prog[atual] ? '#f9c22b' : '#625565');
  }
  // ================================================================ telas, transições e entrada
  var telaAtual = 'mundo', atual = 'fogo', trans = null, explosao = null;
  var cv = document.getElementById('tela'), ctx = cv.getContext('2d'), s = 2;
  function anuncia(txt) { var a = document.getElementById('anuncio'); a.textContent = ''; setTimeout(function () { a.textContent = txt; }, 30); }
  function txtGinasio(el) { var p = est.prog[el]; return GYM[el].nome + ', ' + ({ fogo: 'Fogo', agua: 'Água', grama: 'Grama' })[el] + ': ' + (p >= 5 ? 'insígnia conquistada' + (est.revanche[el] === 'livre' ? ', revanche hoje' : est.revanche[el] === 'feita' ? ', revanche de hoje feita' : '') : p + ' de 5 vencidos'); }
  function txtEtapa(el, i) { return ROTULO[i] + ', ' + GYM[el].etapas[i] + ': ' + EST_TXT[estadoEtapa(el, i)]; }
  function posicionaTrilha(chegando) {
    var p = Math.min(est.prog[atual], 4);
    pintado = pintaAlvo = arcoParada[p];
    cav.alvo = arcoDoCavalo(p); cav.s = chegando && !reduzido ? Math.max(0, cav.alvo - 44) : cav.alvo;
    if (chegando && !reduzido) { pintado = Math.max(0, pintaAlvo - 0.01); }
    sel.trilha = p; trilhas[atual] && (trilhas[atual].chave = '');
  }
  function entra(el) {
    if (trans) return;
    atual = el; sel.mundo = ORDEM.indexOf(el);
    if (reduzido) { telaAtual = 'trilha'; posicionaTrilha(false); montaUI(); anuncia('Dentro do ' + GYM[el].nome + '. ' + txtEtapa(el, sel.trilha)); return; }
    trans = { tipo: 'entra', t0: agora(), trocou: false };
  }
  function sai() {
    if (trans || telaAtual !== 'trilha') return;
    if (reduzido) { telaAtual = 'mundo'; montaUI(); anuncia('Mapa-múndi. ' + txtGinasio(atual)); return; }
    trans = { tipo: 'sai', t0: agora(), trocou: false };
  }
  function vence() {
    if (telaAtual !== 'trilha' || trans || pintaAlvo > pintado + 0.01 || Math.abs(cav.alvo - cav.s) > 0.5) return;
    var el = atual, p = est.prog[el], txt;
    if (p >= 5) { if (est.revanche[el] !== 'livre') return; est.revanche[el] = 'feita'; txt = 'Revanche vencida. Volte amanhã para a próxima.'; }
    else {
      est.prog[el] = p + 1;
      if (p + 1 === 5) { est.revanche[el] = 'livre'; txt = 'Líder vencido: insígnia do ' + NOMES[el] + ' conquistada. A névoa do ' + NOMES[el] + ' some no mapa.'; }
      else txt = GYM[el].etapas[p] + ' vencido. A trilha se pinta até ' + GYM[el].etapas[p + 1] + '.';
    }
    explosao = { i: Math.min(p, 4), t0: agora() };
    var q = Math.min(est.prog[el], 4);
    setTimeout(function () { pintaAlvo = arcoParada[q]; cav.alvo = arcoDoCavalo(q); sel.trilha = q; }, reduzido ? 0 : 550);
    if (reduzido) { pintado = pintaAlvo = arcoParada[q]; cav.s = cav.alvo = arcoDoCavalo(q); sel.trilha = q; }
    montaUI(); anuncia(txt);
  }
  function desenhaExplosao(t) {
    if (!explosao || reduzido) return;
    var u = t - explosao.t0; if (u > 0.9) { explosao = null; return; }
    var pp = PARADAS[explosao.i];
    for (var i = 0; i < 14; i++) {
      var an = i / 14 * Math.PI * 2 + hash(i, 3), v = 26 + hash(i, 7) * 22, x = pp[0] + Math.cos(an) * v * u, y = pp[1] - 22 + Math.sin(an) * v * u + 30 * u * u;
      R(Math.round(x), Math.round(y), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1, i % 2 ? '#f9c22b' : '#fbff86'); medidor.part++;
    }
  }
  // íris em pixels de arte da tela (o pixel mostrado), com o aro na cor do elemento
  function iris(cx, cy, r, z, el) {
    var u = s * z, Wd = Math.ceil(W * s / u), Hd = Math.ceil(H * s / u), cor = COR_EL[el];
    ctx.fillStyle = '#2e222f';
    for (var j = 0; j < Hd; j++) {
      var dy = j + 0.5 - cy;
      if (Math.abs(dy) >= r) { ctx.fillRect(0, j * u, Wd * u, u); continue; }
      var w = Math.round(Math.sqrt(r * r - dy * dy)), a = Math.round(cx - w), b = Math.round(cx + w);
      ctx.fillStyle = '#2e222f'; ctx.fillRect(0, j * u, Math.max(0, a - 2) * u, u); ctx.fillRect((b + 2) * u, j * u, Math.max(0, Wd - b - 2) * u, u);
      ctx.fillStyle = '#' + cor[2]; ctx.fillRect((a - 2) * u, j * u, u, u); ctx.fillRect((b + 1) * u, j * u, u, u);
      ctx.fillStyle = '#' + cor[3]; ctx.fillRect((a - 1) * u, j * u, u, u); ctx.fillRect(b * u, j * u, u, u);
      ctx.fillStyle = '#2e222f';
    }
  }

  // ================================================================ o laço
  var tAnt = null, amostras = [], copias = [], pico = 0;
  function quadro() {
    var t = agora(), dt = tAnt === null ? 0 : Math.min(0.05, Math.max(0, t - tAnt)); tAnt = t;
    var t0 = performance.now(); medidor.chamadas = 0; medidor.part = 0;
    var z = 1, foco = [W / 2, H / 2], ir = null, R0 = 260;
    if (trans) {
      var u = t - trans.t0, P = POS_G[atual];
      if (trans.tipo === 'entra') {
        if (u < 0.5) { z = u < 0.12 ? 1 : u < 0.24 ? 2 : 3; foco = [P[0], P[1] - 8]; if (u > 0.24) ir = { x: P[0], y: P[1] - 8, r: R0 * (1 - (u - 0.24) / 0.26), z: z }; }
        else if (u < 0.58) ir = { x: 0, y: 0, r: 0, z: 1 };
        else {
          if (!trans.trocou) { trans.trocou = true; telaAtual = 'trilha'; posicionaTrilha(true); montaUI(); anuncia('Dentro do ' + GYM[atual].nome + '. ' + txtEtapa(atual, sel.trilha)); }
          var hp = posCavalo(arcoDoCavalo(Math.min(est.prog[atual], 4)));
          ir = { x: hp[0], y: hp[1] - 20, r: R0 * Math.min(1, (u - 0.58) / 0.4), z: 1 };
          if (u > 0.98) { trans = null; ir = null; if (pintado < pintaAlvo) pintado = pintaAlvo; }
        }
      } else {
        var hp2 = posCavalo(cav.s);
        if (u < 0.3) ir = { x: hp2[0], y: hp2[1] - 20, r: R0 * (1 - u / 0.3), z: 1 };
        else if (u < 0.38) ir = { x: 0, y: 0, r: 0, z: 1 };
        else {
          if (!trans.trocou) { trans.trocou = true; telaAtual = 'mundo'; montaUI(); anuncia('Mapa-múndi. ' + txtGinasio(atual)); }
          z = u < 0.72 ? 3 : u < 0.84 ? 2 : 1; foco = [P[0], P[1] - 8];
          if (u < 0.66) ir = { x: P[0], y: P[1] - 8, r: R0 * (u - 0.38) / 0.28, z: z };
          if (u > 0.9) trans = null;
        }
      }
    }
    selTrilhaAtiva = document.activeElement === cv || document.activeElement && document.activeElement.closest && !!document.activeElement.closest('#lista');
    if (telaAtual === 'mundo') quadroMundo(t, dt); else { quadroTrilha(t, dt); desenhaExplosao(t); }
    var msJS0 = performance.now() - t0;
    var msJS = msJS0;
    // cópia ampliada num inteiro (s × z), recortando em volta do foco
    var vw = W / z, vh = H / z, sx = Math.round(lim(foco[0] - vw / 2, 0, W - vw)), sy = Math.round(lim(foco[1] - vh / 2, 0, H - vh));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(arte, sx, sy, vw, vh, 0, 0, W * s, H * s);
    if (ir) iris(Math.round((ir.x - (ir.z > 1 ? sx : 0)) * 1), Math.round((ir.y - (ir.z > 1 ? sy : 0)) * 1), Math.max(0, ir.r), ir.z, atual);
    var ms = performance.now() - t0;
    amostras.push(msJS); copias.push(ms - msJS); if (amostras.length > 90) { amostras.shift(); copias.shift(); }
    if (!trans) pico = Math.max(pico * 0.995, msJS);
    quadroDesafio(t);
    if (++contaUI % 20 === 0) atualizaMedidor();
    requestAnimationFrame(quadro);
  }
  var contaUI = 0;
  function atualizaMedidor() {
    var media = function (v) { return v.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, v.length); };
    var m = media(amostras), mc = media(copias), cel = m * 4;
    document.getElementById('resumo').innerHTML =
      '<span>desenho do quadro (média)</span><b>' + m.toFixed(2) + ' ms</b>' +
      '<span>≈ celular médio (×4)</span><b>' + (m * 4).toFixed(2) + ' ms</b>' +
      '<span>pico recente (fora das transições)</span><b>' + pico.toFixed(2) + ' ms</b>' +
      '<span>cópia ampliada para a tela</span><b>' + mc.toFixed(2) + ' ms</b>' +
      '<span>chamadas de desenho</span><b>' + medidor.chamadas + '</b>' +
      '<span>partículas</span><b>' + medidor.part + '</b>' +
      '<span>escala na tela</span><b>' + s + '× ' + (trans ? '(em transição)' : '') + '</b>';
    var bar = document.getElementById('barra'), f = cel / 2;
    bar.style.width = Math.min(100, f * 100) + '%'; bar.className = f > 1 ? 'estouro' : f > 0.7 ? 'alto' : '';
  }
  function ajusta() {
    var r = window.devicePixelRatio || 1, mold = document.getElementById('moldura'), larg = mold.clientWidth || 300;
    var altMax = Math.max(300, (window.innerHeight || 800) - 60);
    s = Math.max(1, Math.min(Math.floor(larg * r / W), Math.floor(altMax * r / H)));
    cv.width = W * s; cv.height = H * s; cv.style.width = (W * s / r) + 'px'; cv.style.height = (H * s / r) + 'px';
    ctx.imageSmoothingEnabled = false;
  }
  function artePara(ev) { var b = cv.getBoundingClientRect(); return [(ev.clientX - b.left) / b.width * W, (ev.clientY - b.top) / b.height * H]; }
  cv.addEventListener('click', function (ev) {
    if (trans) return;
    var a = artePara(ev);
    if (telaAtual === 'mundo') {
      ORDEM.forEach(function (el, i) { var p = POS_G[el]; if (Math.abs(a[0] - p[0]) < 26 && a[1] > p[1] + MARCA.topo - 14 && a[1] < p[1] + MARCA.placa + 15) { sel.mundo = i; entra(el); } });
    } else {
      if (a[0] < 120 && a[1] < 26) { sai(); return; }
      PARADAS.forEach(function (pp, i) { if (Math.abs(a[0] - pp[0]) < 20 && a[1] > pp[1] - 48 && a[1] < pp[1] + 8) { sel.trilha = i; montaUI(); anuncia(txtEtapa(atual, i) + (estadoEtapa(atual, i) === 'proxima' ? '. No jogo, abre o desafio: a entrada é paga antes do sorteio.' : '')); } });
    }
  });
  cv.addEventListener('keydown', function (ev) {
    var kk = ev.key, n = telaAtual === 'mundo' ? 3 : 5, chave = telaAtual === 'mundo' ? 'mundo' : 'trilha';
    if (['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].indexOf(kk) >= 0) {
      ev.preventDefault();
      // no mundo, para cima = norte (Fornalha); na trilha, para cima = a etapa seguinte (a trilha sobe)
      var d = (kk === 'ArrowUp' || kk === 'ArrowRight') ? 1 : -1;
      if (telaAtual === 'mundo') d = -d;
      sel[chave] = mod(sel[chave] + d, n); montaUI();
      anuncia(telaAtual === 'mundo' ? txtGinasio(ORDEM[sel.mundo]) : txtEtapa(atual, sel.trilha));
    } else if (kk === 'Enter' || kk === ' ') {
      ev.preventDefault();
      if (telaAtual === 'mundo') entra(ORDEM[sel.mundo]);
      else anuncia(txtEtapa(atual, sel.trilha) + (estadoEtapa(atual, sel.trilha) === 'proxima' ? '. No jogo, abre o desafio.' : ''));
    } else if ((kk === 'Escape' || kk === 'Backspace') && telaAtual === 'trilha') { ev.preventDefault(); sai(); }
  });

  // ================================================================ interface da página
  function botao(rotulo, fn, o) {
    var b = document.createElement('button'); b.type = 'button'; b.innerHTML = rotulo; b.addEventListener('click', fn);
    if (o && o.pressed != null) b.setAttribute('aria-pressed', o.pressed ? 'true' : 'false');
    if (o && o.disabled) b.disabled = true;
    return b;
  }
  function montaUI() {
    var ctl = document.getElementById('ctl'), lista = document.getElementById('lista'), leg = document.getElementById('legenda');
    ctl.innerHTML = ''; lista.innerHTML = '';
    if (telaAtual === 'mundo') {
      leg.textContent = 'mapa-múndi';
      cv.setAttribute('aria-label', 'Mapa-múndi com os três ginásios. ' + ORDEM.map(txtGinasio).join('. ') + '. Setas escolhem, Enter entra.');
      ORDEM.forEach(function (el, i) {
        var li = document.createElement('li'), b = botao('<b>' + GYM[el].nome + '</b><span class="est">' + txtGinasio(el).split(': ')[1] + '</span>', function () { sel.mundo = i; entra(el); });
        if (sel.mundo === i) b.setAttribute('aria-current', 'true');
        li.appendChild(b); lista.appendChild(li);
      });
    } else {
      leg.textContent = GYM[atual].nome;
      cv.setAttribute('aria-label', 'Trilha do ' + GYM[atual].nome + ', de baixo para cima. ' + [0, 1, 2, 3, 4].map(function (i) { return txtEtapa(atual, i); }).join('. ') + '. Esc volta ao mapa.');
      var p = est.prog[atual], pode = p < 5 || est.revanche[atual] === 'livre';
      ctl.appendChild(botao(p < 5 ? 'Vencer a próxima etapa' : 'Vencer a revanche do dia', vence, { disabled: !pode }));
      ctl.appendChild(botao('Voltar ao mapa', sai));
      [4, 3, 2, 1, 0].forEach(function (i) {
        var st = estadoEtapa(atual, i), li = document.createElement('li');
        var b = botao('<b>' + ROTULO[i] + ' · ' + GYM[atual].etapas[i] + '</b><span class="est">' + EST_TXT[st] + '</span>', function () { sel.trilha = i; montaUI(); anuncia(txtEtapa(atual, i)); });
        if (st === 'fechada') b.setAttribute('aria-disabled', 'true');
        if (sel.trilha === i) b.setAttribute('aria-current', 'true');
        li.appendChild(b); lista.appendChild(li);
      });
    }
    if (telaAtual === 'mundo') [['b', 'Ilha B (escolhida)'], ['m', 'Mapa de peças'], ['a', 'Ilha A'], ['v1', 'v1: por código']].forEach(function (v) {
      ctl.appendChild(botao(v[1], function () { usaVariante(v[0]); montaUI(); anuncia('Mapa: ' + v[1]); }, { pressed: VAR.id === v[0] }));
    });
    ctl.appendChild(botao('Animações reduzidas', function () { reduzido = !reduzido; montaUI(); }, { pressed: reduzido }));
    var e = document.getElementById('estados'); e.innerHTML = '';
    [['exemplo', 'Exemplo'], ['comeco', 'Começo'], ['tudo', 'Tudo conquistado']].forEach(function (pp) {
      e.appendChild(botao(pp[1], function () { usaPreset(pp[0]); if (telaAtual === 'trilha') posicionaTrilha(false); montaUI(); anuncia('Estado: ' + pp[1]); }, { pressed: est.preset === pp[0] }));
    });
    montaNotas();
  }
  function montaNotas() {
    var N = telaAtual === 'mundo' ? [
      VAR.id === 'm' ? '<span class="tag pago">piloto pago</span> <b>Mapa de peças</b> (exemplo pedido): 5 conjuntos de terreno de 16 px (mar/areia, areia/grama, grama/rocha, rocha/lava, grama/terra; 1 geração cada) postos por cantos por código, seguindo a geografia da v1, e 4 objetos (árvores, serra, vulcão). Fica com cara de grade de peças e a rocha saiu verde: a ilha pintada continua melhor.' : VAR.id === 'v1' ? '<span class="tag cod">código</span> <b>Terreno da ilha</b> gerado por código (v1): relevo com luz da esquerda, praia, rio, lago, serras, vulcão, mata.'
        : '<span class="tag pago">piloto pago</span> <b>Ilha pintada</b> pelo PixelLab (Pixen, 256 × 384, 1 geração cada) e <b>ginásios</b> como objetos 64 × 64 (arena de pedra, plataforma de tábuas, picadeiro com cerca), assentados por código: sombra de contato com a luz da esquerda e cores na Resurrect 64. Sobre a pintura, o código anima a água, a lava, a fumaça, as nuvens e a névoa.',
      '<span class="tag cod">código</span> <b>Mundo vivo</b>: mar com arrebentação e brilho, correnteza no rio, ondinhas no lago e lava descendo do vulcão (ciclo de cor, 12 q/s); copas no vento em faixas; fumaça e bombas do vulcão; nuvens com a sombra correndo no chão; pássaros.',
      '<span class="tag cod">código</span> <b>Névoa</b> sobre o que não foi conquistado: densa com 0 de 5, mais rala a cada etapa vencida, some com a insígnia. Só visual: as três trilhas continuam abertas desde o começo, como hoje.',
      '<span class="tag jogo">arte do jogo</span> <b>Estandarte do líder</b> fincado em cada ginásio (pano na cor do elemento com a cabeça do líder, recortada 1:1 do corpo já pago; mastro com sombra), barra e medalha de ouro no conquistado e o "!" da revanche do dia. Só a placa do nome é interface.',
      '<b>Entrar</b>: aproximação em escala inteira (1× → 2× → 3×) e íris na cor do elemento; na volta, o caminho inverso.'
    ] : [
      '<span class="tag jogo">arte do jogo</span> <b>Mapa da trilha</b> de hoje (etapa 6), com a lava, a água ou o capim em ciclo de cor.',
      '<span class="tag cod">código</span> <b>Pista de terra</b> pelas paradas, em S, com borda recortada, capim invadindo e pedrinhas: no trecho fechado é só chão pisado; ao vencer, ela se pinta pedaço a pedaço, com poeira; no Remanso vira ponte de tábuas sobre a água.',
      '<span class="tag jogo">arte do jogo</span> <b>Cavalo ativo</b> (o molde do jogo, com jóquei): parado em idle diante do oponente da vez e trotando até o próximo quando a trilha termina de pintar.',
      '<b>Estados</b>: fechada (oponente apagado e cadeado), próxima (friso dourado pulsando na base de pedra e "!"), vencida (friso dourado e estrela), líder conquistado (insígnia) e revanche do dia ("!") ou feita. <b>Sombras</b> (guia de integração): treinadores e cavalo com a silhueta deitada para baixo e para a direita, na cor do chão escurecida.',
      '<b>Acessível</b>: a trilha continua numa lista de botões abaixo do mapa (leitor de tela e teclado: setas, Enter, Esc volta).'
    ];
    if (telaAtual === 'mundo' && VAR.id !== 'v1') N.push('<b>Ainda por código na versão final</b>: as árvores da ilha pintada não balançam nesta amostra (a técnica de deformação da frente da animação faz isso na implementação).');
    document.getElementById('notas').innerHTML = N.map(function (n) { return '<li>' + n + '</li>'; }).join('');
  }
  // ================================================================ cena de desafio, nova direção (piloto, 2026-11-24)
  // Convenção do gênero de batalha de criaturas (só o layout, nada de arte nem interface de outro jogo): o cavalo do
  // oponente de frente numa base de chão no alto à direita, com o treinador ao lado; o nosso, de costas, numa base perto
  // da borda de baixo; a arena viva ao fundo. Integração pelo guia (docs/arte/integracao.md): base de chão na rampa da
  // arena com face e contato, sombras de silhueta deslocadas (+3, +2) no chão escurecido, luz da esquerda, tudo 1:1.
  var DW = 256, DH = 160, dArte = tela(DW, DH), dg = dArte.getContext('2d'), dCv = null, dCtx = null, dS = 2;
  var desafio = { costas: 0, frente: 'molde', arena: 'a1', base: null, esc: null, quentes: [], fundo: null, t0: 0 };
  var dSomC = tela(100, 100), dSomG = dSomC.getContext('2d');
  function dR(x, y, w, h, c) { dg.fillStyle = c; dg.fillRect(x | 0, y | 0, w, h); }
  function preparaDesafio() {
    var A = ARENAS[desafio.arena], arena = Buf.de(IMG[A.img]), b = new Buf(DW, DH), e = new Buf(DW, DH), viv = new Buf(DW, DH), q = [], QU = [K.f9c22b, K.fbff86, K.fb6b1d, K.f79617];
    var HZ = A.hz, x, y, p;
    for (p = 0; p < DW * HZ; p++) b.d[p] = arena.d[p];
    // rampa do piso: as cores mais comuns do chão da arena, do escuro ao claro (perspectiva atmosférica: longe, mais claro)
    var conta = {};
    for (y = HZ + 20; y < Math.min(DH, HZ + 70); y++) for (x = 60; x < 196; x++) { var c = arena.d[y * DW + x]; conta[c] = (conta[c] || 0) + 1; }
    var rampa = Object.keys(conta).sort(function (u, v) { return conta[v] - conta[u]; }).slice(0, 5).map(Number)
      .sort(function (u, v) { return ((u & 255) + ((u >>> 8) & 255)) - ((v & 255) + ((v >>> 8) & 255)); });
    var LAVA = [K.e83b3b, K.fb6b1d, K.f79617];
    for (y = HZ; y < DH; y++) {
      var d = y - HZ + 4, z = 260 / d;                         // profundidade: maior perto do horizonte
      for (x = 0; x < DW; x++) {
        var wx = (x - 128) * z / 40, wz = z;                   // chão no mundo (unidades de chão)
        var n = fbm(wx / 1.9, wz / 1.9, 41, 3), grao = hash(Math.floor(wx * 3), Math.floor(wz * 3));
        var longe = lim((70 - (y - HZ)) / 70, 0, 1);
        var idx = lim(Math.round(1.6 + (n - 0.5) * 3.2 + longe * 1.4 + (grao < 0.08 ? 1 : grao > 0.95 ? -1 : 0)), 0, rampa.length - 1);
        var cor = rampa[idx];
        // o anel da arena no chão (pedra clara), em perspectiva: círculo de raio 9 em volta do centro do piso
        var rr = Math.hypot(wx, wz - 13);
        if (z > 6 && Math.abs(rr - 9.5) < 0.16 + z * 0.01) cor = rampa[rampa.length - 1];   // só ao fundo, no tom claro do chão
        // rachaduras de lava (cristas do ruído no chão do mundo), mais finas ao longe
        var cr = Math.abs(fbm(wx / 5, wz / 5, 52, 3) - 0.5);
        if (cr < 0.004 + 0.012 / (z + 1) * 0 + (z > 6 ? 0.006 : 0.003) && rr > 10.2) { cor = LAVA[cr < 0.0025 ? 2 : 1]; q.push(y * DW + x); }
        if (y - HZ < 3) cor = escurecer(cor);                  // pé do muro: faixa de sombra
        b.d[y * DW + x] = cor;
      }
    }
    for (p = 0; p < DW * HZ; p++) if (QU.indexOf(b.d[p]) >= 0 && ((p / DW) | 0) < HZ) q.push(p);
    for (p = 0; p < DW * DH; p++) e.d[p] = escurecer((b.d[p] | 0xff000000) >>> 0);
    viv.d.set(b.d); e.poe(); viv.poe(); b.poe();
    desafio.base = b; desafio.esc = e; desafio.viv = viv; desafio.quentes = q;
  }
  function baseDeChao(cx, cy, rx, ry) {   // disco de chão da própria arena: tampo claro, borda e face escuras, sombra à direita
    var B = desafio.base, E = desafio.esc;
    for (var y = Math.floor(cy - ry); y <= cy + ry + 3; y++) for (var x = Math.floor(cx - rx - 1); x <= cx + rx + 4; x++) {
      if (x < 0 || y < 0 || x >= DW || y >= DH) continue;
      var e0 = Math.pow((x + 0.5 - cx) / rx, 2) + Math.pow((y + 0.5 - cy) / ry, 2), e1 = Math.pow((x + 0.5 - cx - 3) / rx, 2) + Math.pow((y + 0.5 - cy - 3) / ry, 2);
      var c = null, chao = B.d[y * DW + x];
      if (e0 <= 1) c = e0 > 0.82 ? (x < cx && y < cy ? lighten(chao) : escurecer(chao)) : (e0 < 0.25 && x < cx ? lighten(chao) : chao);
      else if (e1 <= 1) c = escurecer(escurecer(chao));
      if (c) dR(x, y, 1, 1, hexC(c));
    }
  }
  var LIGHT = {};
  function lighten(c) {   // 1 degrau acima (a mais próxima mais clara da paleta, na mesma família)
    if (LIGHT[c] !== undefined) return LIGHT[c];
    var r = c & 255, g2 = (c >>> 8) & 255, b2 = (c >>> 16) & 255, alvo = [r * 1.18 + 18, g2 * 1.15 + 14, b2 * 1.1 + 8], melhor = c, md = 1e9;
    R64.forEach(function (h) { var v = rgbDe(h), dd = Math.pow(v[0] - alvo[0], 2) + Math.pow(v[1] - alvo[1], 2) + Math.pow(v[2] - alvo[2], 2); if (dd < md) { md = dd; melhor = K[h]; } });
    return (LIGHT[c] = melhor);
  }
  function spriteComSombra(im, x, y) {   // sombra: a silhueta deslocada (+3, +2) no chão escurecido; depois o sprite
    dSomG.globalCompositeOperation = 'copy'; dSomG.drawImage(im, 0, 0);
    dSomG.globalCompositeOperation = 'source-in'; dSomG.drawImage(desafio.esc.c, -(x + 3), -(y + 2));
    dSomG.globalCompositeOperation = 'source-over';
    dg.drawImage(dSomC, 0, 0, im.width, im.height, x + 3, y + 2, im.width, im.height);
    dg.drawImage(im, x, y);
  }
  var moldeEsqC = null;
  function moldeEsq() {   // o molde do jogo (Brasa parada, com jóquei), espelhado: o mesmo traço do cavalo em todo o jogo
    if (moldeEsqC) return moldeEsqC;
    var c = tela(64, 64), q = c.getContext('2d'); q.imageSmoothingEnabled = false; q.translate(64, 0); q.scale(-1, 1);
    SP.drawHorse(q, 12, 24, { palette: CAVALO.palette, element: CAVALO.element, scale: 1, jockey: true, silks: '#e83b3b', idle: true, t: 0.5, quadro: { topo: -1e6, base: 60, grade: 1, centro: 32 } });
    return (moldeEsqC = c);
  }
  function pe(im) { if (im.__pe != null) return im.__pe; var b = Buf.de(im), p0 = 0, x0 = im.width, x1 = 0; for (var p = 0; p < b.d.length; p++) if (b.d[p]) { p0 = (p / b.w) | 0; var x = p % b.w; x0 = Math.min(x0, x); x1 = Math.max(x1, x); } im.__pe = p0; im.__cx = (x0 + x1) / 2; return p0; }
  function placa(x, y, w, nome, sub, folego) {
    dR(x - 1, y - 1, w + 2, 24, '#2e222f'); dR(x, y, w, 22, '#3e3546'); dR(x, y, w, 1, '#484a77');
    SP.drawText(dg, nome, x + 4, y + 3, { fonte: 'g7', scale: 1, color: '#ffffff', shadow: '#2e222f' });
    SP.drawText(dg, sub, x + w - 4, y + 3, { fonte: 'g7', scale: 1, color: '#c7dcd0', shadow: '#2e222f', align: 'right' });
    dR(x + 4, y + 15, w - 8, 4, '#2e222f'); dR(x + 5, y + 16, Math.round((w - 10) * folego), 2, folego > 0.5 ? '#91db69' : '#f9c22b');
  }
  // a cena tem o chão da arena (a própria imagem, que já é um piso visto de cima e de longe) como plano: cada coisa
  // pisa num ponto dele; o oponente ao fundo, o nosso na frente, cortado pela borda de baixo. As "bases" são marcas
  // gastas no próprio chão (elipses achatadas na perspectiva do piso), e as sombras são a silhueta deitada no chão.
  // hz: a linha até onde a imagem da arena vale como fundo (céu, montanhas, muro); abaixo dela, o piso em perspectiva
  var ARENAS = { a1: { img: 'd-arena', hz: 74, op: [170, 104], lider: [204, 101], nos: [70, 172], marca: [26, 4, 46, 7] },
    a0: { img: 'd-arena0', hz: 92, op: [168, 114], lider: [201, 111], nos: [70, 172], marca: [24, 4, 46, 7] } };
  function marcaNoChao(cx, cy, rx, ry) {   // terra gasta: 1 degrau abaixo do chão, borda em massas de 2 px
    var B = desafio.base;
    for (var y = Math.floor(cy - ry); y <= cy + ry; y++) for (var x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (x < 0 || y < 0 || x >= DW || y >= DH) continue;
      var e = Math.pow((x + 0.5 - cx) / rx, 2) + Math.pow((y + 0.5 - cy) / ry, 2) + (hash(x >> 1, y >> 1) - 0.5) * 0.35;
      if (e > 1) continue;
      var c = B.d[y * DW + x]; dR(x, y, 1, 1, hexC(e < 0.45 && hash(x, y) < 0.08 ? lighten(c) : escurecer(c)));
    }
  }
  var sombrasD = new Map();
  function sombraDeitada(im) {   // a silhueta "deitada" no piso: 1 linha a cada 3 (amostrada, sem escala), puxada para a direita
    if (sombrasD.has(im)) return sombrasD.get(im);
    var b = Buf.de(im), pe0 = pe(im), h = Math.ceil((pe0 + 1) / 3), out = new Buf(b.w + 24, h + 1);
    for (var r = 0; r < h; r++) {
      var sy = pe0 - r * 3, dx = Math.round(r * 2.2);
      for (var x = 0; x < b.w; x++) if (b.em(x, sy) || b.em(x, sy - 1)) out.d[(h - r) * out.w + x + dx] = 0xff000000;
    }
    var o = { c: out.poe().c, h: h };
    sombrasD.set(im, o); return o;
  }
  function deitaSombra(im, x, y) {   // sombra no chão escurecido (troca de paleta), com os pés em (x, y)
    var sd = sombraDeitada(im);
    dSomG.globalCompositeOperation = 'copy'; dSomG.drawImage(sd.c, 0, 0);
    dSomG.globalCompositeOperation = 'source-in'; dSomG.drawImage(desafio.esc.c, -(x - im.__cx), -(y - sd.h));
    dSomG.globalCompositeOperation = 'source-over';
    dg.drawImage(dSomC, 0, 0, sd.c.width, sd.c.height, Math.round(x - im.__cx), y - sd.h, sd.c.width, sd.c.height);
  }
  function pisa(im, x, y, bob) {   // desenha o sprite com os pés (última linha opaca) em (x, y), centrado em x
    pe(im); deitaSombra(im, x, y);
    dg.drawImage(im, Math.round(x - im.__cx), y - im.__pe + (bob || 0));
  }
  function quadroDesafio(t) {
    if (!dCv || !desafio.base) return;
    var A = ARENAS[desafio.arena];
    if (!reduzido) {   // o brilho da lava do fundo corre (ciclo de cor)
      var d = desafio.viv.d, B = desafio.base.d, L = [K.fb6b1d, K.f79617, K.f9c22b, K.fbff86];
      for (var i = 0; i < desafio.quentes.length; i++) { var p = desafio.quentes[i], x = p % DW, y = (p / DW) | 0, f = mod(x * 0.3 + y * 0.5 - t * 5, 8), o = L.indexOf(B[p]); d[p] = L[lim((o < 0 ? 1 : o) + (f < 1.5 ? 1 : f > 6 ? -1 : 0), 0, 3)]; }
      desafio.viv.poe();
    }
    dg.drawImage(desafio.viv.c, 0, 0);
    var resp = reduzido ? 0 : (Math.floor(t * 1.4) & 1), resp2 = reduzido ? 0 : (Math.floor(t * 1.4 + 0.5) & 1);
    var M0 = A.marca;
    marcaNoChao(A.op[0] + 6, A.op[1], M0[0], M0[1]);
    marcaNoChao(A.nos[0], A.nos[1] - 6, M0[2], M0[3]);
    var fr = desafio.frente === 'molde' ? moldeEsq() : IMG['d-oito-' + desafio.frente], lider = corpo(GYM.fogo.etapas[4], false), cs = IMG['d-costas-' + desafio.costas];
    // de trás para a frente: a líder e o cavalo dela no fundo, o nosso na frente
    if (lider) { var li = lider.c; li.__pe = lider.pe; li.__cx = 16; deitaSombra(li, A.lider[0], A.lider[1]); dg.drawImage(li, A.lider[0] - 16, A.lider[1] - lider.pe + resp2); }
    if (fr) pisa(fr, A.op[0], A.op[1], resp);
    if (cs) pisa(cs, A.nos[0], A.nos[1], resp2);
    placa(8, 8, 104, 'Capitã Labareda', 'Nv 20', 0.82);
    placa(140, 116, 108, 'Brasa', 'Nv 12', 0.64);
    dCtx.imageSmoothingEnabled = false;
    dCtx.drawImage(dArte, 0, 0, DW, DH, 0, 0, DW * dS, DH * dS);
  }
  function iniciaDesafio() {
    dCv = document.getElementById('desafio'); if (!dCv) return;
    dCtx = dCv.getContext('2d'); preparaDesafio();
    var aj = function () { var r = window.devicePixelRatio || 1, larg = dCv.parentElement.clientWidth || 300; dS = Math.max(1, Math.floor(larg * r / DW)); dCv.width = DW * dS; dCv.height = DH * dS; dCv.style.width = (DW * dS / r) + 'px'; dCv.style.height = (DH * dS / r) + 'px'; };
    aj(); window.addEventListener('resize', aj);
    document.getElementById('hojeDesafio').src = M.desafio.hoje;
    var ctl = document.getElementById('ctlDesafio');
    var monta = function () {
      ctl.innerHTML = '';
      ctl.appendChild(botao('◀ De costas', function () { desafio.costas = mod(desafio.costas - 1, 16); monta(); }));
      var sp = document.createElement('span'); sp.textContent = 'candidato ' + (desafio.costas + 1) + ' de 16'; ctl.appendChild(sp);
      ctl.appendChild(botao('De costas ▶', function () { desafio.costas = mod(desafio.costas + 1, 16); monta(); }));
      [['a1', 'Arena 1'], ['a0', 'Arena 0']].forEach(function (a) { ctl.appendChild(botao(a[1], function () { desafio.arena = a[0]; preparaDesafio(); monta(); }, { pressed: desafio.arena === a[0] })); });
      ctl.appendChild(botao('Oponente: ' + ({ molde: 'molde (mesmo traço)', 7: '8 direções, frente-esq.', 0: '8 direções, frente' })[desafio.frente], function () { desafio.frente = desafio.frente === 'molde' ? 7 : desafio.frente === 7 ? 0 : 'molde'; monta(); }));
    };
    monta();
    var c8 = document.getElementById('candDesafio');
    c8.innerHTML = M.desafio.costas.concat(M.desafio.frente, M.desafio.oito, M.desafio.oito96).map(function (u, i) { return '<figure class="cand"><img src="' + u + '" style="width:' + (i < 32 ? 128 : 184) + 'px" alt=""><figcaption>' + (i < 16 ? 'de costas ' + (i + 1) : i < 32 ? '"de frente" (saiu de lado) ' + (i - 15) : (i < 40 ? '8 direções 64 · ' : '8 direções 96 · ') + ['sul', 'oeste', 'leste', 'norte', 'sudeste', 'nordeste', 'noroeste', 'sudoeste'][(i - 32) % 8]) + '</figcaption></figure>'; }).join('');
  }
  function montaCandidatos() {
    var el = document.getElementById('candidatos'); if (!el) return;
    el.innerHTML = M.piloto.todos.map(function (c) {
      var g = /ginasio/.test(c.nome), usado = M.piloto.escolhidos.indexOf(c.nome) >= 0;
      return '<figure class="cand' + (usado ? ' usado' : '') + '"><img src="' + c.uri + '" alt="' + c.nome + '" style="width:' + (g ? 128 : 128) + 'px"><figcaption>' + c.nome + (usado ? ' · na amostra' : '') + '</figcaption></figure>';
    }).join('');
  }
  function pronto() {
    // o chão escurecido (sombra das nuvens) e o lavado (névoa), por troca de paleta do mundo parado
    var snap = new Buf(W, H); snap.g.drawImage(mundo.b.c, 0, 0); faixas.forEach(function (f) { snap.g.drawImage(f.c, f.x0 - 8, f.y0); });
    var im = snap.g.getImageData(0, 0, W, H), dd = new Uint32Array(im.data.buffer);
    for (var p = 0; p < W * H; p++) { lavado[p] = lavar(dd[p] | 0xff000000); escuro.d[p] = escurecer((mundo.b.d[p] | 0xff000000) >>> 0); }
    escuro.poe();
    varCache.v1 = { pesos: pesoReg, lavado: lavado, escuro: escuro };
    usaVariante('b');
    montaCandidatos(); iniciaDesafio();
    ajusta(); window.addEventListener('resize', ajusta);
    montaUI();
    requestAnimationFrame(quadro);
    window.__mapa = { _t: { cavaloPng: function (lado, idle) { var c = tela(lado, lado), q = c.getContext('2d'); q.imageSmoothingEnabled = false; var cx = lado / 2, base = lado - 4; SP.drawHorse(q, cx - 20, base - 36, { palette: CAVALO.palette, element: CAVALO.element, scale: 1, jockey: true, silks: '#f9c22b', idle: idle !== false, t: 0.5, frame: 3, quadro: { topo: -1e6, base: base, grade: 1, centro: cx } }); return c.toDataURL('image/png'); }, exportar: function () { var m2 = gerarMundo(); decorarMundo(m2, true); m2.b.poe(); m2.arvores.forEach(function (a) { m2.b.g.drawImage(a.c.c, a.x - a.r, a.y - a.r); }); return m2.b.c.toDataURL('image/png'); }, camadas: camadas, ciclo: function (t) { cicloT = -9; cicloMundo(t); }, nevoa: function (t) { nevT = -9; atualizaNevoa(t); atualizaNevoa(t); }, mundo: quadroMundo, trilha: quadroTrilha, copia: function () { ctx.drawImage(arte, 0, 0, W, H, 0, 0, W * s, H * s); } }, entra: entra, sai: sai, vence: vence, preset: function (n) { usaPreset(n); montaUI(); }, est: function () { return est; }, reduz: function (v) { reduzido = v; montaUI(); }, tela: function () { return telaAtual; } };
    window.__mapaPronto = true;
  }
})();
