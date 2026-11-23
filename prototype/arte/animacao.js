// prototype/arte/animacao.js — motor da amostra de animação ambiente (entrega 1 da frente de animação; o build é
// prototype/tools/arte-animacao-build.mjs, que embute este arquivo e os PNGs em prototype/arte/animacao-amostra.html).
// Spike: não lê nem escreve nada de prototype/src/ ou prototype/dist/.
//
// Regras do guia de arte (docs/arte/guia.md) que valem aqui:
//   §2 tudo desenhado num buffer na resolução de arte e copiado para a tela por um drawImage ampliado num inteiro;
//      deslocamentos sempre arredondados para o pixel de arte (sem rotação nem escala suave)
//   §3 toda cor sai da Resurrect 64; alfa binário (nenhum véu translúcido)
//   §9 orçamento: ≤ 2 ms de JavaScript por quadro, ≤ 150 partículas, ≤ 300 chamadas de desenho
// Sorteios: só a RNG cosmética daqui (mulberry32 com semente fixa por cena), separada da seed das regras (CLAUDE.md §8).
// Nada de Math.random.
(function () {
  'use strict';
  var A = window.__ANIM;

  // ================================================================ cores e canvas
  function rgbDe(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  // cor em 32 bits na ordem do ImageData (little-endian: ABGR)
  function c32(h) { var v = rgbDe(h); return ((255 << 24) | (v[2] << 16) | (v[1] << 8) | v[0]) >>> 0; }
  function hexDe(c) { return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function tela(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return c; }
  function Buf(w, h) {
    this.w = w; this.h = h; this.c = tela(w, h); this.g = this.c.getContext('2d', { willReadFrequently: true });
    this.img = this.g.createImageData(w, h); this.d = new Uint32Array(this.img.data.buffer);
  }
  Buf.de = function (src) {
    var b = new Buf(src.width, src.height); b.g.drawImage(src, 0, 0);
    b.img = b.g.getImageData(0, 0, b.w, b.h); b.d = new Uint32Array(b.img.data.buffer);
    for (var i = 0; i < b.d.length; i++) if ((b.d[i] >>> 24) < 128) b.d[i] = 0; else b.d[i] = (b.d[i] | 0xff000000) >>> 0;   // alfa binário
    return b;
  };
  Buf.prototype.poe = function () { this.g.putImageData(this.img, 0, 0); };
  Buf.prototype.clone = function () { var b = new Buf(this.w, this.h); b.d.set(this.d); b.poe(); return b; };
  Buf.prototype.em = function (x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x]; };

  // paleta (só os nomes usados aqui; todas da Resurrect 64)
  var P = {
    tinta: '#2e222f', sombra: '#3e3546', cinzaE: '#625565', cinza: '#9babb2', claro: '#c7dcd0', branco: '#ffffff',
    vinho: '#6e2727', verm: '#b33831', vermC: '#ea4f36', vermV: '#e83b3b', laranja: '#fb6b1d', laranjaC: '#f79617', ouro: '#f9c22b',
    amarelo: '#fbff86', ouroC: '#fbb954', madE: '#4c3e24', mad: '#9e4539', madC: '#cd683d', madCC: '#e6904e', areia: '#fdcbb0',
    areiaE: '#ab947a', rosa: '#fca790', violetaE: '#45293f', violeta: '#694f62', roxo: '#7f708a', terra: '#966c6c',
    mar0: '#0b5e65', mar1: '#0b8a8f', mar2: '#0eaf9b', mar3: '#30e1b9', mar4: '#8ff8e2', ceu1: '#4d65b4', ceu2: '#4d9be6', ceu3: '#8fd3ff',
    verdeE: '#165a4c', verde: '#239063', verdeC: '#1ebc73', verdeCC: '#91db69', musgo: '#547e64', oliva: '#676633', azulE: '#323353',
    rosaV: '#f04f78'
  };
  var C = {}; Object.keys(P).forEach(function (k) { C[k] = c32(P[k]); });

  // ================================================================ ruído e RNG cosmética
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function hash3(x, y, z) { return hash(x + z * 7919, y - z * 104729); }
  function rngCosmetica(semente) {   // mulberry32; só para o que é enfeite (nunca entra na regra)
    var a = semente >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  var SEN = new Float32Array(1024); for (var si = 0; si < 1024; si++) SEN[si] = Math.sin(si / 1024 * Math.PI * 2);
  function fsin(x) { return SEN[(x * 162.97466 | 0) & 1023]; }   // seno por tabela (1024 passos): basta para o pixel inteiro
  function suave(a, b, x) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
  function mod(a, n) { return ((a % n) + n) % n; }

  // vento cosmético: 0 a 1, com rajadas que atravessam a cena da esquerda para a direita (frente a 110 px de arte/s);
  // tudo que reage ao vento (capim, coqueiros, bandeirolas, biruta, placa, poeira) lê a mesma função
  // MAIS: a variante "mais movimento" da cena na tela (pedido do Vinicius, 2026-11-23); a "atual" é a principal
  var MAIS = false;
  function vento(t) {
    var base = 0.42 + 0.12 * Math.sin(t * 0.13 + 0.4);
    var r1 = Math.pow(Math.max(0, Math.sin(t * 0.31 + 1.3)), 8) * 0.55;
    var r2 = Math.pow(Math.max(0, Math.sin(t * 0.83 + 0.2)), 10) * 0.25;
    if (!MAIS) return Math.min(1, base + r1 + r2);
    // mais movimento: uma rajada forte a cada ~15 s que dobra tudo junto, e as comuns 20% mais fortes
    var forte = Math.pow(Math.max(0, Math.sin(t * 0.42 + 2.2)), 10) * 0.8;
    return Math.min(1, base * 1.05 + r1 * 1.2 + r2 * 1.2 + forte);
  }
  function rajadaForte(t) { return MAIS && vento(t) > 0.92; }
  function ventoEm(x, t) { return vento(t - x / 110); }

  // ================================================================ medidor de custo
  // Cada camada é medida em volta do seu trabalho (atualizar + desenhar) com performance.now(); média móvel de ~1 s e
  // pico dos últimos ~2 s. Chamadas de desenho contadas pelos ajudantes R() e D().
  var medidor = { camadas: [], chamadas: 0, chamadasMedia: 0, particulas: 0, fps: 0, total: 0, totalPico: 0 };
  function Camada(id, rotulo, descricao) {
    this.id = id; this.rotulo = rotulo; this.descricao = descricao || ''; this.ativo = true;
    this.ms = 0; this.pico = 0; this.picos = []; this.acc = 0;
  }
  function mede(cam, fn) {
    if (!cam.ativo) return false;
    var t0 = performance.now(); fn(); cam.acc += performance.now() - t0;
    return true;
  }
  var g = null;   // contexto do buffer da cena (resolução de arte)
  function R(x, y, w, h, cor) { g.fillStyle = cor; g.fillRect(x, y, w, h); medidor.chamadas++; }
  function D(img, a, b, c, d, e, f, h, i) {
    if (c === undefined) g.drawImage(img, a, b); else g.drawImage(img, a, b, c, d, e, f, h, i);
    medidor.chamadas++;
  }
  // camada de largura w repetida na horizontal, deslocada desloc px (inteiro), com o topo em y
  function repetida(img, desloc, y, W) {
    var w = img.width, x = -mod(Math.floor(desloc), w);
    for (; x < W; x += w) D(img, x, y);
  }

  // ================================================================ primitivas
  // --- 1. Ciclo de cor (Mark Ferrari): uma lista dos pixels animados de uma camada, cada um com a sua rampa e o seu
  // degrau; a cada passo (fps próprio) só esses pixels são reescritos no ImageData e a camada volta por um putImageData.
  function CicloCor(base, escolhe, rampas, cor, fps) {
    // escolhe(x, y, hex) -> índice da rampa ou -1; rampas: listas de hex; cor(x, y, rampa, degrau, t) -> degrau novo
    this.base = base; this.saida = base.clone(); this.fps = fps || 10; this.passo = -1; this.cor = cor;
    this.rampas = rampas.map(function (r) { return r.map(c32); });
    var px = [], hexes = {};
    for (var y = 0; y < base.h; y++) for (var x = 0; x < base.w; x++) {
      var i = y * base.w + x, v = base.d[i]; if (!v) continue;
      var h = hexes[v] || (hexes[v] = hexDe(v)), r = escolhe(x, y, h);
      if (r < 0) continue;
      var deg = rampas[r].indexOf(h); if (deg < 0) continue;
      px.push(i, x, y, r, deg);
    }
    this.px = new Int32Array(px); this.n = px.length / 5;
  }
  CicloCor.prototype.precisa = function (t) { return Math.floor(t * this.fps) !== this.passo; };
  CicloCor.prototype.atualiza = function (t) {
    var p = Math.floor(t * this.fps); if (p === this.passo) return false;
    this.passo = p;
    var d = this.saida.d, px = this.px, R_ = this.rampas, tq = p / this.fps;
    for (var k = 0; k < px.length; k += 5) {
      var r = R_[px[k + 3]], deg = this.cor(px[k + 1], px[k + 2], px[k + 3], px[k + 4], tq, k / 5);
      d[px[k]] = r[deg < 0 ? 0 : deg >= r.length ? r.length - 1 : deg];
    }
    return true;
  };

  // --- Agenda: cada atualização pesada (ciclo de cor, deformação) só roda quando o seu passo mudou, e no máximo uma por
  // quadro (a mais atrasada primeiro); as outras mostram o resultado anterior por 1–2 quadros (16–33 ms), o que não se
  // vê, e o pico do quadro fica no custo de uma só.
  function Agenda() { this.itens = []; }
  Agenda.prototype.roda = function (t, ligado) {
    var melhor = null, atraso = -1;
    for (var i = 0; i < this.itens.length; i++) {
      var it = this.itens[i]; if (ligado && !ligado(it)) continue;
      if (!it.precisa(t)) continue;
      var a = t - (it.feito || 0); if (a > atraso) { atraso = a; melhor = it; }
    }
    if (melhor) { melhor.feito = t; return melhor; }
    return null;
  };

  // --- 2. Deformação por pixel inteiro (capim, folhas de coqueiro, torcida, placas): "puxa" cada pixel de destino da
  // posição (x − dx, y − dy) da imagem de origem, se ali houver um pixel da mesma peça; dx e dy são inteiros. Sem
  // rotação nem escala suave: a folha "dobra" porque as pontas andam 1–2 px e o miolo fica.
  function Deforma(origem, mascara, caixas, desloc, fps, prepara) {
    // origem: Buf; mascara: Int16Array (0 = fora, n = peça n); caixas: [{x0,y0,x1,y1,id,...}] (já com a margem);
    // prepara(t), opcional: uma vez por passo, para a cena calcular o que vale para a peça ou a coluna inteira (o desloc
    // por pixel fica só com multiplicações)
    this.o = origem; this.m = mascara; this.caixas = caixas; this.desloc = desloc; this.fps = fps || 12; this.passo = -1; this.prepara = prepara;
    this.saida = origem.clone();
    this.limpo = new Uint32Array(origem.d); for (var i = 0; i < mascara.length; i++) if (mascara[i]) this.limpo[i] = 0;
    this.v = [0, 0];
  }
  Deforma.prototype.precisa = function (t) { return Math.floor(t * this.fps) !== this.passo; };
  Deforma.prototype.atualiza = function (t, origemNova) {
    var p = Math.floor(t * this.fps); if (p === this.passo && !origemNova) return false;
    this.passo = p;
    var o = origemNova || this.o.d, w = this.o.w, h = this.o.h, m = this.m, d = this.saida.d, v = this.v, tq = p / this.fps;
    if (this.prepara) this.prepara(tq);
    if (origemNova) { for (var q = 0; q < d.length; q++) d[q] = m[q] ? 0 : o[q]; } else d.set(this.limpo);
    for (var c = 0; c < this.caixas.length; c++) {
      var cx = this.caixas[c], id = cx.id;
      for (var y = cx.y0; y < cx.y1; y++) for (var x = cx.x0; x < cx.x1; x++) {
        this.desloc(x, y, cx, tq, v, y * w + x);
        var sx = x - v[0], sy = y - v[1];
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        var s = sy * w + sx;
        if (m[s] === id) d[y * w + x] = o[s];
      }
    }
    return true;
  };
  // em imagem achatada (sem transparência atrás): lê de src e escreve em dst só dentro das caixas; onde a peça saiu,
  // buraco(x, y, caixa, src) diz o que aparece (sem ele, fica o pixel de antes: a folha "engrossa" 1 px em vez de furar)
  Deforma.prototype.aplica = function (src, dst, tq, buraco) {
    if (this.prepara) this.prepara(tq);
    var w = this.o.w, h = this.o.h, m = this.m, v = this.v;
    for (var c = 0; c < this.caixas.length; c++) {
      var cx = this.caixas[c], id = cx.id;
      for (var y = cx.y0; y < cx.y1; y++) for (var x = cx.x0; x < cx.x1; x++) {
        var i = y * w + x;
        this.desloc(x, y, cx, tq, v, i);
        var sx = x - v[0], sy = y - v[1];
        if (sx >= 0 && sy >= 0 && sx < w && sy < h && m[sy * w + sx] === id) dst[i] = src[sy * w + sx];
        else if (m[i] === id) dst[i] = buraco ? buraco(x, y, cx, src) : src[i];
      }
    }
  };

  // máscara e caixas das peças conexas (vizinhança 8) dos pixels que passam no filtro
  function pecas(base, filtro, margem, minPx) {
    var w = base.w, h = base.h, m = new Int16Array(w * h), caixas = [], id = 0, pilha = [];
    var ok = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var v = base.d[y * w + x]; if (v && filtro(x, y, hexDe(v))) ok[y * w + x] = 1; }
    for (var i = 0; i < w * h; i++) {
      if (!ok[i] || m[i]) continue;
      id++; var lista = [i]; m[i] = id; pilha.length = 0; pilha.push(i);
      var x0 = w, y0 = h, x1 = 0, y1 = 0, sx = 0, sy = 0;
      while (pilha.length) {
        var j = pilha.pop(), jx = j % w, jy = (j / w) | 0;
        x0 = Math.min(x0, jx); y0 = Math.min(y0, jy); x1 = Math.max(x1, jx); y1 = Math.max(y1, jy); sx += jx; sy += jy;
        for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
          var nx = jx + ox, ny = jy + oy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var k = ny * w + nx; if (ok[k] && !m[k]) { m[k] = id; pilha.push(k); lista.push(k); }
        }
      }
      if (lista.length < (minPx || 1)) { lista.forEach(function (k) { m[k] = 0; ok[k] = 0; }); id--; continue; }
      caixas.push({ id: id, n: lista.length, cx: sx / lista.length, cy: sy / lista.length, bx0: x0, by0: y0, bx1: x1, by1: y1,
        x0: Math.max(0, x0 - margem), y0: Math.max(0, y0 - margem), x1: Math.min(w, x1 + margem + 1), y1: Math.min(h, y1 + margem + 1) });
    }
    return { m: m, caixas: caixas };
  }

  // --- 3. Partículas (vetores fixos; nenhum objeto novo por quadro)
  var T_BRASA = 1, T_FUMACA = 2, T_BOMBA = 3, T_AREIA = 4, T_FOLHA = 5, T_FAISCA = 6, T_PENA = 7, T_GIRO = 8, T_BOLHA = 9, T_GOTA = 10;
  function Particulas(max) {
    this.max = max; this.n = 0;
    this.x = new Float32Array(max); this.y = new Float32Array(max); this.vx = new Float32Array(max); this.vy = new Float32Array(max);
    this.idade = new Float32Array(max); this.vida = new Float32Array(max); this.tipo = new Uint8Array(max); this.s = new Float32Array(max);
    this.a = new Float32Array(max); this.r = new Float32Array(max);   // ângulo e raio do redemoinho
  }
  Particulas.prototype.nasce = function (tipo, x, y, vx, vy, vida, s) {
    if (this.n >= this.max) return;
    var i = this.n++;
    this.tipo[i] = tipo; this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.vida[i] = vida; this.idade[i] = 0; this.s[i] = s || 0;
    this.a[i] = (s || 0) * 6.283; this.r[i] = 1 + (s || 0) * 2;
  };
  Particulas.prototype.passo = function (dt, t) {
    for (var i = 0; i < this.n; i++) {
      this.idade[i] += dt;
      if (this.idade[i] >= this.vida[i]) {   // troca com a última
        var u = --this.n;
        this.tipo[i] = this.tipo[u]; this.x[i] = this.x[u]; this.y[i] = this.y[u]; this.vx[i] = this.vx[u]; this.vy[i] = this.vy[u];
        this.vida[i] = this.vida[u]; this.idade[i] = this.idade[u]; this.s[i] = this.s[u]; this.a[i] = this.a[u]; this.r[i] = this.r[u]; i--; continue;
      }
      var tp = this.tipo[i], w = ventoEm(this.x[i], t);
      if (tp === T_BRASA || tp === T_FAISCA) { this.vy[i] -= 6 * dt; this.vx[i] += (w * 14 - this.vx[i]) * dt * 0.8 + Math.sin(t * 7 + this.s[i] * 9) * 6 * dt; }
      else if (tp === T_FUMACA) { this.vy[i] *= (1 - 0.25 * dt); this.vx[i] += (w * 9 - this.vx[i]) * dt * 0.5; }
      else if (tp === T_BOMBA) { this.vy[i] += 46 * dt; }
      else if (tp === T_AREIA) { this.vx[i] += (w * 46 - this.vx[i]) * dt * 1.5; this.vy[i] = Math.sin(t * 5 + this.s[i] * 6) * 4; }
      else if (tp === T_FOLHA || tp === T_PENA) { this.vx[i] += (w * 26 - this.vx[i]) * dt; this.vy[i] = 6 + Math.sin(t * 3 + this.s[i] * 6) * 9; }
      else if (tp === T_GIRO) { this.vx[i] = w * 24; this.a[i] += (5 + this.s[i] * 3) * dt; this.r[i] = Math.min(10, this.r[i] + 5 * dt); }
      else if (tp === T_GOTA) { this.vy[i] += 60 * dt; }
      else if (tp === T_BOLHA) { this.vx[i] = 0; this.vy[i] = 0; }
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
    }
    medidor.particulas += this.n;
  };
  var RAMPA_BRASA = [P.amarelo, P.ouro, P.laranjaC, P.laranja, P.vermV, P.vinho];
  var RAMPA_FUMACA = [P.roxo, P.cinzaE, P.violeta, P.sombra];
  Particulas.prototype.desenha = function (dx, dy, quadro) {
    for (var i = 0; i < this.n; i++) {
      var tp = this.tipo[i], k = this.idade[i] / this.vida[i], x = Math.round(this.x[i] + dx), y = Math.round(this.y[i] + dy);
      if (tp === T_BRASA || tp === T_FAISCA || tp === T_BOMBA) {
        var cor = RAMPA_BRASA[Math.min(5, Math.floor(k * (tp === T_FAISCA ? 4 : 6)))];
        if (tp === T_BRASA && hash3(i, Math.floor(this.s[i] * 99), quadro >> 2) < 0.12) continue;   // cintila
        R(x, y, tp === T_BOMBA && k < 0.5 ? 2 : 1, tp === T_BOMBA && k < 0.5 ? 2 : 1, cor);
      } else if (tp === T_FUMACA) {
        var tam = k < 0.15 ? 2 : k < 0.45 ? 3 : k < 0.8 ? 4 : 3, c = RAMPA_FUMACA[Math.min(3, Math.floor(k * 4))];
        R(x - (tam >> 1), y - (tam >> 1), tam, tam, c);
        if (tam >= 3) { R(x - (tam >> 1) - 1, y, 1, 1, c); R(x + tam - (tam >> 1), y - 1, 1, 1, c); }   // borda irregular
      } else if (tp === T_AREIA) {
        R(x, y, k > 0.8 && (quadro & 1) ? 0 : 1, 1, this.s[i] < 0.5 ? P.areia : P.areiaE);
      } else if (tp === T_FOLHA) {
        var deitada = Math.floor(this.idade[i] * 6 + this.s[i] * 4) & 1;
        R(x, y, deitada ? 2 : 1, deitada ? 1 : 2, this.s[i] < 0.5 ? P.verdeC : P.oliva);
      } else if (tp === T_PENA) {
        R(x, y, 1, 1, P.branco);
      } else if (tp === T_GIRO) {   // folha ou areia girando em volta de um centro que o vento leva, subindo
        var gx = Math.round(this.x[i] + dx + Math.cos(this.a[i]) * this.r[i]), gy = Math.round(this.y[i] + dy + Math.sin(this.a[i]) * this.r[i] * 0.45 - this.idade[i] * 7);
        var dt2 = Math.floor(this.a[i] * 2) & 1;
        if (this.s[i] < 0.5) R(gx, gy, dt2 ? 2 : 1, dt2 ? 1 : 2, this.s[i] < 0.25 ? P.verdeC : P.oliva); else R(gx, gy, 1, 1, this.s[i] < 0.75 ? P.areia : P.areiaE);
      } else if (tp === T_GOTA) {
        R(x, y, 1, 1, k < 0.5 ? P.branco : P.claro);
      } else if (tp === T_BOLHA) {   // bolha de lava: incha 1 → 2 px e estoura em 4 respingos
        if (k < 0.35) R(x, y, 1, 1, P.ouro);
        else if (k < 0.7) { R(x, y - 1, 2, 2, P.amarelo); R(x, y - 1, 1, 1, P.branco); }
        else { var e = k < 0.85 ? 2 : 3; R(x - e, y - 1, 1, 1, P.laranjaC); R(x + e + 1, y - 1, 1, 1, P.laranjaC); R(x, y - e - 1, 1, 1, P.ouro); R(x + 1, y - e, 1, 1, P.laranja); }
      }
    }
  };

  // --- 4. Pássaros: silhuetas de 5 a 7 px em 3 quadros de asa (alto, meio, baixo) + planar; batem as asas em surtos
  // e planam, com 1 px de sobe-e-desce na batida. Quadros pré-desenhados por cor (1 drawImage por pássaro).
  var ASAS = {
    longe: [['#...#', '.#.#.', '..#..'], ['.....', '##.##', '..#..'], ['.....', '..#..', '##.##']],
    gaivota: [['#.....#', '.#...#.', '..#.#..', '...#...'], ['.......', '##...##', '..###..', '...#...'], ['.......', '...#...', '.##.##.', '#.....#']]
  };
  function quadrosAsa(desenho, cor, ponta) {
    return desenho.map(function (linhas) {
      var c = tela(linhas[0].length, linhas.length), cg = c.getContext('2d');
      linhas.forEach(function (l, y) { for (var x = 0; x < l.length; x++) if (l[x] === '#') { cg.fillStyle = (ponta && (x === 0 || x === l.length - 1)) ? ponta : cor; cg.fillRect(x, y, 1, 1); } });
      return c;
    });
  }
  function Bando(rng, n, conf) {
    this.q = quadrosAsa(ASAS[conf.tipo], conf.cor, conf.ponta); this.conf = conf; this.b = [];
    for (var i = 0; i < n; i++) this.b.push({ x: rng() * conf.largura, y: conf.y0 + rng() * (conf.y1 - conf.y0), v: conf.v * (0.75 + rng() * 0.5),
      fase: rng() * 10, surto: 1.5 + rng() * 2.5, plana: 1 + rng() * 2.5, onda: rng() * 6 });
  }
  Bando.prototype.desenha = function (t, cam, W) {
    var cf = this.conf, L = cf.largura;
    for (var i = 0; i < this.b.length; i++) {
      var p = this.b[i], ciclo = p.surto + p.plana, tc = mod(t + p.fase, ciclo), bate = tc < p.surto;
      var f = bate ? [0, 1, 2, 1][Math.floor(t * cf.qps + p.fase * 3) % 4] : 1;
      var x = Math.round(mod(p.x + t * p.v * (cf.dir || 1) - cam * cf.paralaxe, L) - 20);
      var y = Math.round(p.y + Math.sin(t * 0.4 + p.onda) * 4 + (bate && f === 0 ? -1 : 0));
      if (x < -10 || x > W + 4) continue;
      D(this.q[f], x, y);
    }
  };

  // revoada em V que atravessa a cena a cada `periodo` s (mais movimento): o líder na frente, os outros em escada atrás,
  // cada um batendo as asas no seu tempo
  function Revoada(conf) { this.q = quadrosAsa(ASAS[conf.tipo], conf.cor, conf.ponta); this.c = conf; }
  Revoada.prototype.desenha = function (t, cam, W) {
    var c = this.c, tc = mod(t + (c.fase || 0), c.periodo), x0 = -24 + tc * c.v, y0 = c.y + Math.sin(t * 0.5) * 3;
    if (x0 > W + 40) return;
    for (var i = 0; i < c.n; i++) {
      var fila = Math.ceil(i / 2), lado = i % 2 ? 1 : -1;
      var x = Math.round(x0 - fila * 6), y = Math.round(y0 + lado * fila * 3);
      var f = [0, 1, 2, 1][Math.floor(t * c.qps + i * 1.7) % 4];
      if (x > -8 && x < W) D(this.q[f], x, y);
    }
  };
  // jorro de lava do vulcão (mais movimento): coluna de 1–3 px que sobe e cai em `dur` s, quente na base
  function desenhaJorro(vx, vy, u, alt, q) {
    var h = Math.round(alt * Math.sin(Math.PI * Math.min(1, u)));
    for (var k = 0; k < h; k++) {
      var larg = k < h * 0.35 ? 3 : k < h * 0.75 ? 2 : 1, cor = RAMPA_BRASA[Math.min(4, Math.floor(k / Math.max(1, h) * 3.5 + hash3(k, 3, q) * 1.3))];
      R(vx - (larg >> 1) + (k > h * 0.5 && hash3(k, 7, q) < 0.3 ? 1 : 0), vy - k, larg, 1, cor);
    }
  }

  // --- 5. Céu em faixas (o do jogo) e o sol com o halo em ciclo de cor (o pontilhado do halo gira e "respira")
  function ceuFaixas(W, H) {
    var c = tela(W, H), cg = c.getContext('2d'), faixas = [[0, P.ceu1], [26, P.ceu2], [64, P.ceu3], [100, P.claro]];
    for (var i = 0; i < faixas.length; i++) {
      var y0 = faixas[i][0], y1 = i + 1 < faixas.length ? faixas[i + 1][0] : H;
      cg.fillStyle = faixas[i][1]; cg.fillRect(0, y0, W, y1 - y0);
      if (i + 1 < faixas.length) { cg.fillStyle = faixas[i + 1][1]; for (var x = 0; x < W; x += 2) { cg.fillRect(x, y1 - 2, 1, 1); cg.fillRect(x + 1, y1 - 1, 1, 1); } }
    }
    return c;
  }
  var SOL = [];   // 4 quadros
  for (var sq = 0; sq < 4; sq++) {
    var sc = tela(25, 25), sg = sc.getContext('2d');
    for (var yy = 0; yy < 25; yy++) for (var xx = 0; xx < 25; xx++) {
      var dd = Math.hypot(xx - 12, yy - 12), ang = Math.atan2(yy - 12, xx - 12);
      if (dd <= 7) { sg.fillStyle = P.branco; sg.fillRect(xx, yy, 1, 1); }
      else if (dd <= 9) { sg.fillStyle = P.amarelo; sg.fillRect(xx, yy, 1, 1); }
      else if (dd <= 10.6 + (sq === 2 ? 0.8 : sq === 1 || sq === 3 ? 0.4 : 0) && (xx + yy + sq) % 2 === 0) { sg.fillStyle = P.amarelo; sg.fillRect(xx, yy, 1, 1); }
      else if (dd <= 12.2 && (xx + yy) % 2 === 0 && Math.cos(ang * 8 + sq * Math.PI / 4) > 0.75) { sg.fillStyle = P.amarelo; sg.fillRect(xx, yy, 1, 1); }   // raios que giram
    }
    SOL.push(sc);
  }
  function SOL_PARADO() { return SOL[0]; }

  // --- 6. Bandeirolas num varal: cada uma com 4 quadros (a ponta vai e volta 1 px), fora de fase, mais rápidas no vento
  function quadrosBandeirola(cor) {
    var Q = [];
    [0, 1, 0, -1].forEach(function (dx, k) {
      var c = tela(5, 7), cg = c.getContext('2d');
      var forma = [[0, 4], [0, 4], [1, 3], [1, 3], [2, 2]];   // triângulo de 5 de largura × 5 de altura
      forma.forEach(function (f, y) {
        var desv = Math.round(dx * y / 4) + (k === 2 && y >= 3 ? 1 : 0);
        cg.fillStyle = P.tinta; cg.fillRect(f[0] + desv, y + 1, f[1] - f[0] + 1, 1);
        if (f[1] - f[0] >= 2) { cg.fillStyle = cor; cg.fillRect(f[0] + 1 + desv, y + 1, f[1] - f[0] - 1, 1); }
      });
      cg.fillStyle = P.tinta; cg.fillRect(2 + Math.round(dx * 5 / 4), 6, 1, 1);
      Q.push(c);
    });
    return Q;
  }
  var CORES_BAND = [P.vermV, P.ouro, P.ceu2, P.verdeC, P.branco, P.rosaV];
  var BAND = CORES_BAND.map(quadrosBandeirola);
  // varal de x0 a x1 com a barriga de "flecha" px; uma bandeirola a cada 7 px
  var cordas = {};
  function corda(L, flecha) {
    var k = L + ':' + flecha; if (cordas[k]) return cordas[k];
    var c = tela(L + 1, flecha + 2), cg = c.getContext('2d'); cg.fillStyle = P.tinta;
    for (var x = 0; x <= L; x++) { var u = x / L; cg.fillRect(x, Math.round(flecha * 4 * u * (1 - u)), 1, 1); }
    return (cordas[k] = c);
  }
  function desenhaVaral(x0, x1, y, flecha, t, semente) {
    var n = Math.floor((x1 - x0) / 7);
    D(corda(x1 - x0, flecha), x0, y);
    for (var i = 1; i < n; i++) {
      var bx = x0 + i * 7 - 2, u2 = (bx + 2 - x0) / (x1 - x0), by = y + Math.round(flecha * 4 * u2 * (1 - u2));
      var w = ventoEm(bx, t), q = Math.floor(t * (5 + w * 9) + hash(i, semente) * 4) % 4;
      D(BAND[(i + semente) % BAND.length][q], bx, by);
    }
  }

  // --- 7. Biruta: tecido de 4 listras que enche com o vento (de caída a esticada) e tremula 1 px
  function desenhaBiruta(x, y, t) {
    R(x, y, 1, 34, P.tinta); R(x + 1, y, 1, 34, P.cinza); R(x - 1, y - 1, 3, 1, P.tinta);
    var w = vento(t), queda = 1 - w;   // 0 = esticada, 1 = caída
    for (var i = 0; i < 10; i++) {
      var u = i / 9, yy = y + Math.round(queda * queda * 11 * u * u + queda * 3 * u + Math.sin(t * (6 + w * 8) - i * 0.9) * (0.3 + w * 0.7) * u);
      var alt = i < 3 ? 3 : i < 7 ? 2 : 1, xx = x + 2 + Math.round(i * (0.55 + w * 0.45));
      R(xx, yy, 1, alt, (Math.floor(i / 2.5) % 2) ? P.branco : P.vermV);
      R(xx, yy + alt, 1, 1, P.tinta);
    }
  }

  // --- 8. Placa de madeira pendurada: balança nas correntes e, nas rajadas, gira no eixo (fica estreita e mostra o
  // cantinho escuro); a ferradura gravada some quando ela está de lado
  function desenhaPlaca(x, y, t) {
    var w = vento(t);
    R(x, y, 1, 26, P.madE); R(x + 1, y, 1, 26, P.mad);                   // poste
    R(x, y - 1, 22, 1, P.tinta); R(x, y, 22, 2, P.mad); R(x, y, 22, 1, P.madC);   // braço
    var giro = Math.cos(t * (1.4 + w * 2.2) + Math.sin(t * 0.7)) , abre = 1 - Math.pow(Math.max(0, w - 0.45) / 0.55, 1.2) * (0.5 - 0.5 * giro);
    var bal = Math.round(Math.sin(t * 2.1) * (0.5 + w * 1.3));
    var LW = 15, lw = Math.max(1, Math.round(LW * abre)), cx = x + 12 + bal, bx = cx - Math.floor(lw / 2), by = y + 6;
    // correntes (2 elos)
    for (var k = 0; k < 2; k++) { var hx = x + 7 + k * 10, tx = bx + (k ? lw - 1 : 0); R(Math.round((hx + tx) / 2), y + 3, 1, 1, P.cinzaE); R(hx, y + 2, 1, 1, P.cinzaE); R(tx, y + 4, 1, 2, P.cinzaE); }
    if (lw <= 2) { R(bx, by, Math.max(1, lw), 10, P.madE); return; }
    R(bx, by, lw, 10, P.tinta);
    R(bx + 1, by + 1, lw - 2, 8, abre > 0.6 ? P.madC : P.mad);
    R(bx + 1, by + 1, lw - 2, 1, abre > 0.6 ? P.madCC : P.madC);
    R(bx + 1, by + 5, lw - 2, 1, P.mad);
    if (lw >= 11) {   // ferradura gravada
      var fx = bx + Math.floor(lw / 2) - 2;
      R(fx, by + 2, 1, 4, P.ouro); R(fx + 4, by + 2, 1, 4, P.ouro); R(fx + 1, by + 6, 3, 1, P.ouro);
      R(fx, by + 2, 1, 1, P.ouroC); R(fx + 4, by + 2, 1, 1, P.ouroC);
    }
    if (abre < 0.85) R(giro > 0 ? bx + lw - 2 : bx + 1, by + 1, 1, 8, P.madE);   // a espessura aparece de lado
  }

  // --- 9. Chama de tocha/braseiro: 5 de largura × até 7 de altura, desenhada por coluna a cada quadro (12 q/s), com a
  // ponta que tremula e lambe para o lado do vento
  // 8 quadros × 2 alturas × 2 lados (reto e lambendo para o vento), pré-desenhados: 1 drawImage por chama
  var CHAMAS = {};
  function quadroChama(q, tam, lado) {
    var k = q + ':' + tam + ':' + lado; if (CHAMAS[k]) return CHAMAS[k];
    var c = tela(7, 9), cg = c.getContext('2d');
    var alt = [3, 5, 6, 5, 3].map(function (a, i) { return Math.max(1, Math.round((a + (hash3(i, 3, q) < 0.5 ? 1 : 0) - (hash3(i + 9, 5, q) < 0.25 ? 1 : 0)) * tam)); });
    for (var i = 0; i < 5; i++) for (var j = 0; j < alt[i]; j++) {
      var u = j / Math.max(1, alt[i] - 1), cor = u < 0.3 ? (i === 2 ? P.amarelo : P.ouro) : u < 0.6 ? P.laranjaC : u < 0.85 ? P.laranja : P.vermV;
      if (i === 0 || i === 4) cor = u < 0.5 ? P.laranja : P.vermV;
      cg.fillStyle = cor; cg.fillRect(i + 1 + (j >= alt[i] - 2 ? lado : 0), 8 - j, 1, 1);
    }
    return (CHAMAS[k] = c);
  }
  function desenhaChama(x, y, t, sem, tam) {
    var q = Math.floor(t * 12 + sem * 5) % 8, lado = ventoEm(x, t) > 0.62 ? 1 : 0;
    D(quadroChama(q, tam || 1, lado), x - 3, y - 8);
  }

  // ================================================================ cavalo: idle em camadas
  // O molde é um mapa de papéis (0 vazio, 1 contorno, 2 pelagem, 3 sombra, 4 crina, 5 sombra da crina, 6 detalhe,
  // 7 seda, 8 pele, 9 sela; sprites.js). As peças saem do mapa e das âncoras (nariz, garupa):
  //   olho  = contorno no meio da cabeça; orelhas = o topo da cabeça; cauda = crina atrás da garupa;
  //   barriga = o contorno de baixo do tronco entre as patas.
  // A cada quadro monta-se um mapa novo (respiração + eventos) e ele é pintado com a pelagem: 1 drawImage por cavalo.
  // olhos que a busca automática não separa das linhas da cara (na integração: âncora "olho" no JSON de cada molde)
  var OLHO_MANUAL = { 'robusto-folhas:retrato': [54, 14, 55, 14, 56, 14, 54, 15, 55, 15, 56, 15] };
  function CavaloIdle(molde, estado, cores, semente, opts) {
    opts = opts || {}; this.nome = (molde.nome || '') + ':' + estado;
    this.idx = molde[estado]; this.anc = molde.ancoras[estado]; this.w = 64; this.h = 64;
    this.cores = [0].concat(cores.slice(1).map(c32)); this.rng = rngCosmetica(semente); this.espelho = !!opts.espelho;
    this.buf = new Buf(64, 64); this.mapa = new Uint8Array(64 * 64); this.ultimaChave = '';
    this.respira = 3.2 + this.rng() * 1.2; this.faseR = this.rng() * 6;
    this.eventos = []; this.proximo = 1 + this.rng() * 3; this.ventoCrina = opts.ventoCrina !== false;
    this.pecas();
  }
  CavaloIdle.prototype.em = function (x, y) { return x < 0 || y < 0 || x >= 64 || y >= 64 ? 0 : this.idx[y * 64 + x]; };
  CavaloIdle.prototype.pecas = function () {
    var I = this.idx, a = this.anc, nx = a.nose[0], ny = a.nose[1], rx = a.rear[0], ry = a.rear[1], self = this, x, y;
    // cabeça: topo
    var topo = 64; for (y = 0; y < 64 && topo === 64; y++) for (x = nx - 12; x <= nx; x++) if (this.em(x, y)) { topo = y; break; }
    this.orelhas = [];
    for (y = topo; y <= topo + 2; y++) for (x = nx - 12; x <= nx + 1; x++) { var v = this.em(x, y); if (v) this.orelhas.push(x, y, v); }
    // olho: entre os grupos de contorno "por dentro" da cara (4 vizinhos pintados), o pequeno (≤ 6 px) mais perto de onde
    // o olho fica num cavalo de perfil (8 px atrás e 6 acima do nariz); as linhas do cabresto e da cara são compridas
    // (com 4 vizinhos pintados; se nenhum grupo servir, com 3: o olho de alguns moldes tem um furo transparente)
    var dentro, grupos, minViz = 4, melhor = null, md;
    for (; minViz >= 3 && !melhor; minViz--) {
    dentro = {}; grupos = []; md = 1e9;
    for (y = ny - 11; y <= ny - 1; y++) for (x = nx - 14; x <= nx - 3; x++)
      if (this.em(x, y) === 1 && (!!this.em(x - 1, y) + !!this.em(x + 1, y) + !!this.em(x, y - 1) + !!this.em(x, y + 1)) >= minViz) dentro[x + ',' + y] = 1;
    Object.keys(dentro).forEach(function (k) {
      if (dentro[k] !== 1) return;
      var g = [], pilha = [k]; dentro[k] = 2;
      while (pilha.length) {
        var c = pilha.pop(), xy = c.split(',').map(Number); g.push(xy[0], xy[1]);
        for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) { var kk = (xy[0] + ox) + ',' + (xy[1] + oy); if (dentro[kk] === 1) { dentro[kk] = 2; pilha.push(kk); } }
      }
      grupos.push(g);
    });
    grupos.forEach(function (g) {
      if (g.length / 2 > 6) return;
      var mx = 0, my = 0; for (var i = 0; i < g.length; i += 2) { mx += g[i]; my += g[i + 1]; } mx /= g.length / 2; my /= g.length / 2;
      var d = Math.pow(mx - (nx - 8), 2) + Math.pow(my - (ny - 6), 2) * 1.5; if (d < md && d < 40) { md = d; melhor = g; }
    });
    }
    this.olho = melhor || OLHO_MANUAL[this.nome] || [];
    this.olhoBaixo = 0; for (var k = 1; k < this.olho.length; k += 2) this.olhoBaixo = Math.max(this.olhoBaixo, this.olho[k]);
    // cauda: crina (4/5) atrás da garupa + o contorno que só encosta nela
    var cauda = new Uint8Array(64 * 64), c0 = 64, c1 = 0;
    for (y = ry - 10; y < 64; y++) for (x = 0; x <= rx + 7; x++) { var p = this.em(x, y); if (p === 4 || p === 5) cauda[y * 64 + x] = 1; }
    for (y = ry - 10; y < 64; y++) for (x = 0; x <= rx + 7; x++)   // o detalhe (6) só quando encosta na crina da cauda (os cascos ficam)
      if (this.em(x, y) === 6 && (cauda[y * 64 + x - 1] || cauda[y * 64 + x + 1] || cauda[(y - 1) * 64 + x] || cauda[(y + 1) * 64 + x])) cauda[y * 64 + x] = 1;
    for (y = ry - 10; y < 64; y++) for (x = 0; x <= rx + 8; x++) {
      if (this.em(x, y) !== 1) continue;
      var toca = false, corpo = false;
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue; var q = this.em(x + ox, y + oy);
        if (cauda[(y + oy) * 64 + x + ox]) toca = true; else if (q >= 2 && q !== 4 && q !== 5) corpo = true;
      }
      if (toca && !corpo) cauda[y * 64 + x] = 2;
    }
    this.cauda = [];
    for (y = 0; y < 64; y++) for (x = 0; x < 64; x++) if (cauda[y * 64 + x]) { this.cauda.push(x, y, I[y * 64 + x]); c0 = Math.min(c0, y); c1 = Math.max(c1, y); }
    this.caudaY0 = c0; this.caudaY1 = c1;
    // barriga: colunas entre as patas (o pixel de baixo do tronco tem 3 vazios embaixo)
    this.barriga = [];
    for (x = rx + 8; x <= nx - 16; x++) {
      for (y = a.footY - 6; y > ry; y--) {
        if (this.em(x, y) && !this.em(x, y + 1) && !this.em(x, y + 2) && !this.em(x, y + 3)) { this.barriga.push(x, y); break; }
        if (this.em(x, y) && this.em(x, y + 1)) break;
      }
    }
    // cabeça e pescoço para o aceno (x a partir de nariz − 15, y até nariz + 5)
    this.cabeca = { x0: nx - 15, y1: ny + 5 };
    // crina do pescoço (borda de cima) para tremular no vento
    this.crina = [];
    for (x = rx + 20; x <= nx - 6; x++) for (y = 0; y < ny + 4; y++) {
      var vv = this.em(x, y); if (!vv) continue;
      if (vv === 1 && (this.em(x, y + 1) === 4 || this.em(x, y + 1) === 5)) this.crina.push(x, y);
      break;
    }
  };
  // eventos raros (o que um cavalo parado faz): piscar, abanar a cauda, girar a orelha, acenar a cabeça
  var EVENTOS = { piscar: 0.22, cauda: 0.9, orelha: 0.7, cabeca: 1.3, sacode: 0.75 };
  CavaloIdle.prototype.dispara = function (nome, t) { this.eventos.push({ nome: nome, t0: t, lado: this.rng() < 0.5 ? -1 : 1, forte: (0.6 + this.rng() * 0.4) * (MAIS ? 1.3 : 1) }); };
  CavaloIdle.prototype.agenda = function (t, auto) {
    if (!auto) return;
    if (t >= this.proximo) {
      var r = this.rng(), nome = MAIS ? (r < 0.26 ? 'piscar' : r < 0.5 ? 'cauda' : r < 0.66 ? 'orelha' : r < 0.84 ? 'cabeca' : 'sacode')
        : (r < 0.38 ? 'piscar' : r < 0.62 ? 'cauda' : r < 0.85 ? 'orelha' : 'cabeca');
      this.dispara(nome, t);
      if (nome === 'piscar' && this.rng() < 0.3) this.dispara('piscar', t + 0.32);   // às vezes pisca duas vezes
      this.proximo = t + (MAIS ? 1 + this.rng() * 2.5 : 2.5 + this.rng() * 5);   // 3–8 s entre variações (mais movimento: 1–3,5 s)
      if (MAIS && nome !== 'cauda' && this.rng() < 0.35) this.dispara('cauda', t + 0.2 + this.rng() * 0.4);   // gestos que se juntam
    }
  };
  CavaloIdle.prototype.monta = function (t) {
    var m = this.mapa, I = this.idx, i, k, x, y;
    m.set(I);
    var chave = '';
    // respiração: a barriga desce 1 px no "inspira" (≈ 40% do ciclo)
    var fr = mod(t + this.faseR, this.respira) / this.respira, inspira = fr > 0.1 && fr < 0.55;
    if (inspira) for (k = 0; k < this.barriga.length; k += 2) { x = this.barriga[k]; y = this.barriga[k + 1]; m[(y + 1) * 64 + x] = 1; m[y * 64 + x] = 3; }
    chave += inspira ? 'r' : '-';
    // eventos ativos
    var cauda = 0, orelha = 0, olho = 0, cabeca = 0;
    for (k = this.eventos.length - 1; k >= 0; k--) {
      var e = this.eventos[k], u = (t - e.t0) / EVENTOS[e.nome];
      if (u < 0) continue;
      if (u >= 1) { this.eventos.splice(k, 1); continue; }
      if (e.nome === 'piscar') olho = u < 0.25 || u > 0.75 ? 1 : 2;
      else if (e.nome === 'cauda') cauda = Math.round(e.lado * e.forte * 3 * Math.sin(u * Math.PI * 2) * (1 - u * 0.4));
      else if (e.nome === 'orelha') orelha = u < 0.75 ? 1 : 0;
      else if (e.nome === 'cabeca') cabeca = u < 0.15 || u > 0.85 ? 0 : u < 0.3 || u > 0.7 ? 1 : 2;
      else if (e.nome === 'sacode') { cabeca = Math.floor(u * 6) % 2; orelha = u > 0.2 && u < 0.8 ? 1 : orelha; }   // sacode a cabeça: 3 toques rápidos
    }
    // vento na cauda (bem pouco: a ponta vai 1 px)
    var vc = this.ventoCrina ? Math.round(Math.max(0, vento(t) - 0.55) * 2.2 * Math.max(0, Math.sin(t * 3.1 + this.faseR))) : 0;
    var dc = cauda || -vc;
    if (dc) {
      for (k = 0; k < this.cauda.length; k += 3) { x = this.cauda[k]; y = this.cauda[k + 1]; if (m[y * 64 + x] === this.cauda[k + 2]) m[y * 64 + x] = 0; }
      var span = Math.max(1, this.caudaY1 - this.caudaY0);
      for (k = 0; k < this.cauda.length; k += 3) {
        x = this.cauda[k]; y = this.cauda[k + 1];
        var u2 = (y - this.caudaY0) / span, dx = Math.round(dc * Math.pow(u2, 1.4)), dy = Math.abs(dc) >= 2 && u2 > 0.8 ? -1 : 0, nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < 64 && ny >= 0 && ny < 64) m[ny * 64 + nx] = this.cauda[k + 2];
      }
    }
    chave += 'c' + dc;
    // cabeça baixa (aceno de 1–2 px; o pescoço "dobra" na coluna da emenda)
    if (cabeca) {
      var cb = this.cabeca;
      for (y = cb.y1; y >= 0; y--) for (x = cb.x0; x < 64; x++) {
        var dy2 = x < cb.x0 + 3 ? Math.min(1, cabeca) : cabeca, sy = y - dy2;
        m[y * 64 + x] = sy >= 0 ? (I[sy * 64 + x] || (y > cb.y1 - dy2 ? m[y * 64 + x] : 0)) : 0;
      }
      chave += 'h' + cabeca;
    }
    // orelha: as 2 linhas de cima giram 1 px para trás
    if (orelha) {
      var o = this.orelhas, yTop = o[1];
      for (k = 0; k < o.length; k += 3) if (o[k + 1] <= yTop + 1) m[(o[k + 1] + cabeca) * 64 + o[k]] = 0;
      for (k = 0; k < o.length; k += 3) if (o[k + 1] <= yTop + 1) { var xx = o[k] - 1; if (xx >= 0) m[(o[k + 1] + cabeca) * 64 + xx] = o[k + 2]; }
      chave += 'o';
    }
    // piscar: meio fechado (o de cima vira pálpebra) ou fechado (só a linha de baixo)
    if (olho) {
      for (k = 0; k < this.olho.length; k += 2) {
        x = this.olho[k]; y = this.olho[k + 1];
        if (olho === 2 ? y < this.olhoBaixo : y < this.olhoBaixo - 1) m[(y + (cabeca || 0)) * 64 + x] = 3;
      }
      chave += 'p' + olho;
    }
    // crina do pescoço tremulando no vento (1 px, onda que corre para trás)
    if (this.ventoCrina && vento(t) > 0.5) {
      var fq = Math.floor(t * 8);
      for (k = 0; k < this.crina.length; k += 2) {
        x = this.crina[k]; y = this.crina[k + 1] + (x >= this.cabeca.x0 ? cabeca : 0);
        if (Math.sin(x * 0.9 + fq * 1.3) > 0.55 && y > 0 && !m[(y - 1) * 64 + x]) { m[(y - 1) * 64 + x] = 1; m[y * 64 + x] = 4; }
      }
      chave += 'v' + fq;
    }
    return chave;
  };
  CavaloIdle.prototype.quadro = function (t, auto) {
    this.agenda(t, auto);
    var chave = this.monta(t);
    if (chave !== this.ultimaChave) {   // só repinta quando o mapa mudou
      this.ultimaChave = chave;
      var d = this.buf.d, m = this.mapa, cs = this.cores;
      for (var i = 0; i < 4096; i++) {
        var x = i & 63, src = this.espelho ? (i - x) + 63 - x : i;
        d[i] = m[src] ? cs[m[src]] : 0;
      }
      this.buf.poe();
    }
    return this.buf.c;
  };
  CavaloIdle.prototype.parado = function () {   // a imagem de hoje (sem nada mexendo)
    var b = new Buf(64, 64);
    for (var i = 0; i < 4096; i++) { var x = i & 63, src = this.espelho ? (i - x) + 63 - x : i; b.d[i] = this.idx[src] ? this.cores[this.idx[src]] : 0; }
    b.poe(); return b.c;
  };

  // pelagens na mestra (contorno, pelagem, sombra, crina, sombra da crina, detalhe, seda, pele, sela)
  var PELAGENS = {
    baio: [null, P.tinta, P.ouroC, P.madCC, P.areia, P.areiaE, P.branco, P.vermV, P.areia, P.madE],
    alazao: [null, P.tinta, P.madC, P.mad, P.vinho, P.violetaE, P.claro, P.ceu2, P.areia, P.madE],
    tordilho: [null, P.tinta, P.cinza, P.roxo, P.ceu3, P.ceu2, P.branco, P.verdeC, P.areia, P.madE],
    castanho: [null, P.tinta, P.terra, P.violeta, P.verde, P.verdeE, P.sombra, P.ouro, P.areia, P.madE]
  };

  // ================================================================ cenas
  var IMG = {};   // Image decodificadas (A.imagens)
  var CENAS = {};
  var estado = { cena: 'litoral', t0: 0, ultimo: 0, camera: false, cam: 0, auto: true, lupa: false };

  // ---------------------------------------------------------------- Litoral (corrida)
  CENAS.litoral = {
    titulo: 'Litoral · corrida', legenda: 'Prado das Palmeiras, antes da largada',
    W: 256, lt: 130, nRaias: 3, raia: 22,
    notas: [
      '<span class="tag cod">código</span> <b>Mar</b>: ciclo de cor nos pixels do mar (rampa de 8 tons); faixas de brilho descem para a praia e cintilam.',
      '<span class="tag cod">código</span> <b>Farol</b> gira a luz a cada 2,4 s; <b>veleiros</b> sobem e descem 1 px fora de fase.',
      '<span class="tag cod">código</span> <b>Coqueiros</b>: as pontas das folhas dobram 1–2 px com o vento; cada coqueiro na sua fase.',
      '<span class="tag cod">código</span> <b>Capim da praia</b>: rajadas que atravessam a tela da esquerda para a direita (o mesmo vento move tudo).',
      '<span class="tag cod">código</span> <b>Torcida</b> pula 1 px em grupos; <b>bandeirolas</b> no toldo (4 quadros, fora de fase).',
      '<span class="tag cod">código</span> <b>Placa de madeira</b> balança e gira nas rajadas; <b>biruta</b> enche e murcha com o vento.',
      '<span class="tag cod">código</span> <b>Nuvens</b> em 2 velocidades, <b>gaivotas</b> em 2 profundidades, <b>areia</b> soprada e o <b>sol</b> com o halo em ciclo.',
      '<span class="tag cod">código</span> <b>Cavalos</b> esperando a largada com o idle (respiração, piscar, cauda, orelha, cabeça).',
      'Sem custo de crédito. A amostra de corrida (câmera andando) mostra que as camadas continuam emendando com a paralaxe.'
    ],
    camadas: [
      ['ceu', 'Céu, sol e nuvens'], ['mar', 'Mar, farol e veleiros'], ['coqueiros', 'Coqueiros ao vento'], ['torcida', 'Torcida e bandeirolas'],
      ['adereco', 'Placa e biruta'], ['passaros', 'Gaivotas'], ['cavalos', 'Cavalos (idle)'], ['particulas', 'Areia soprada'],
      ['capim', 'Capim da praia'], ['fundo', 'Fundo parado (pista e cópias)']
    ],
    init: function () {
      var s = this, R_ = A.regioes.litoral, lt = s.lt;
      s.raia0 = lt + 2; s.pistaFim = s.raia0 + s.nRaias * s.raia; s.frenteY = s.pistaFim + 4; s.H = s.frenteY + 40;
      s.ceu = ceuFaixas(s.W, lt);
      var nuv = IMG['litoral/nuvens'];
      s.nuvemAlta = tela(nuv.width, 15); s.nuvemAlta.getContext('2d').drawImage(nuv, 0, 0);
      s.nuvemBaixa = tela(nuv.width, nuv.height); s.nuvemBaixa.getContext('2d').drawImage(nuv, 0, 0); s.nuvemBaixa.getContext('2d').clearRect(0, 0, nuv.width, 15);
      // --- mar (horizonte): rampa de brilho; os pixels do mar são os destes tons abaixo da linha do horizonte, fora da ilha
      var hz = Buf.de(IMG['litoral/horizonte']);
      s.hz = hz;
      var RAMPA = ['2e222f', '3e3546', '0b5e65', '547e64', '0eaf9b', '9babb2', 'c7dcd0', 'ffffff'];
      var praiaX = 296;
      s.mar = new CicloCor(hz, function (x, y, h) {
        if (y < 30 || y > 88) return -1;
        if (x >= 122 && x <= 206 && y < 46) return -1;   // a ilha do farol
        if (x >= 268 && y < 50) return -1;                // a ponta de terra à direita
        if (x >= praiaX + (y - 50) * 0.6 && (h === 'fdcbb0' || h === 'ab947a')) return -1;
        return RAMPA.indexOf(h) >= 0 ? 0 : -1;
      }, [RAMPA], function (x, y, r, d, t, j) {
        if (d < 2) return d;                                       // as sombras do mar ficam
        if (MAIS) {   // ondulação: uma crista a cada 8 s desce do horizonte até a mureta, mais larga perto
          var yc = 30 + mod(t, 8) * 7.5, dc = y - yc, larg = 1 + (y - 30) / 30;
          if (dc <= 0 && dc > -larg && hash(x >> 1, y) < 0.85) return Math.min(7, d + (dc > -1 ? 3 : 2));
        }
        if (d >= 6) return hash3(x, y, Math.floor(t * 5 + s.mH[j] * 7)) < 0.35 ? d - 2 : d;   // cintilar dos brilhos
        var onda = fsin(s.mA[j] - t * s.mS[j] + fsin(s.mB[j] + t * 0.5) * 1.6);
        if (d >= 4 && onda < -0.6) return d - 1;
        return onda > 0.72 && hash(Math.floor((x + t * 4) * s.mL[j]), y) < 0.55 ? d + 1 : d;
      }, 8);
      // as partes fixas da onda, por pixel (perto = 0 no horizonte e 1 na mureta)
      var nm = s.mar.n; s.mA = new Float32Array(nm); s.mS = new Float32Array(nm); s.mB = new Float32Array(nm); s.mL = new Float32Array(nm); s.mH = new Float32Array(nm);
      for (var jm = 0; jm < nm; jm++) {
        var xm = s.mar.px[jm * 5 + 1], ym = s.mar.px[jm * 5 + 2], pt = (ym - 30) / 58;
        s.mA[jm] = ym * (2.1 - pt * 1.2); s.mS[jm] = 1.6 + pt * 1.4; s.mB[jm] = xm * (0.11 - pt * 0.05) + ym * 0.7; s.mL[jm] = 1 / (6 + pt * 10); s.mH[jm] = hash(xm, ym);
      }
      s.barcos = [[113, 30, 123, 40], [232, 30, 243, 40], [273, 32, 283, 42], [221, 39, 231, 48]];
      // --- coqueiros (meio): folhas = verdes acima da linha 72, mais o contorno encostado nelas
      var meio = Buf.de(IMG['litoral/meio']), VERDES = ['165a4c', '239063', '1ebc73', '91db69', '547e64', '676633', '0b5e65', '0eaf9b', '30e1b9', '8ff8e2'];
      var pc = pecas(meio, function (x, y, h) {
        if (y > 74) return false;
        if (VERDES.indexOf(h) >= 0) return true;
        if (h !== '2e222f') return false;
        for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) { var v = meio.em(x + ox, y + oy); if (v && VERDES.indexOf(hexDe(v)) >= 0) return true; }
        return false;
      }, 3, 40);
      pc.caixas.forEach(function (cx, i) {
        cx.raio = Math.max(cx.bx1 - cx.bx0, cx.by1 - cx.by0) / 2 + 1; cx.fase = hash(i, 3) * 6;
        cx.coroaY = cx.by0 + (cx.by1 - cx.by0) * 0.45;   // a coroa fica um pouco abaixo do meio da copa
      });
      // peso de cada pixel (0 no miolo da copa, 1 nas pontas), calculado uma vez
      var KX = new Float32Array(meio.w * meio.h), KY = new Float32Array(meio.w * meio.h);
      pc.caixas.forEach(function (cx) {
        for (var y = cx.y0; y < cx.y1; y++) for (var x = cx.x0; x < cx.x1; x++) {
          var dxp = x - cx.cx, dyp = y - cx.coroaY, dist = Math.sqrt(dxp * dxp + dyp * dyp) / cx.raio, w = Math.min(1, Math.max(0, dist - 0.18) / 0.82);
          KX[y * meio.w + x] = 2.4 * w * (dxp < 0 ? 0.7 : 1); KY[y * meio.w + x] = (dxp > 0 ? 1 : -0.5) * 1.2 * w * w;
        }
      });
      s.coqueiros = new Deforma(meio, pc.m, pc.caixas, function (x, y, cx, t, v, i) {
        v[0] = Math.round(cx.bal * KX[i]); v[1] = Math.round(cx.bal * KY[i]);
      }, 10, function (t) {
        pc.caixas.forEach(function (cx) { var vv = ventoEm(cx.cx, t); cx.bal = vv * (0.55 + 0.45 * Math.sin(t * (1.6 + vv * 1.8) + cx.fase)) * (MAIS ? 1.45 : 1); });
      });
      s.meioY = lt + 26 - meio.h + (R_.posicao.meio || 0);
      // --- torcida (arquibancada): grupos de 3 colunas pulam 1 px
      var arq = Buf.de(IMG['litoral/arquibancada']), mt = new Int16Array(arq.w * arq.h), caixasT = [];
      for (var y = 34; y <= 54; y++) for (var x = 0; x < arq.w; x++) if (arq.d[y * arq.w + x]) mt[y * arq.w + x] = 1 + ((x / 3) | 0);
      for (var gx = 0; gx * 3 < arq.w; gx++) caixasT.push({ id: gx + 1, x0: gx * 3, x1: Math.min(arq.w, gx * 3 + 3), y0: 33, y1: 55, gx: gx });
      s.torcida = new Deforma(arq, mt, caixasT, function (x, y, cx, t, v) {
        v[0] = 0; v[1] = cx.pula;
      }, 6, function (t) {
        // mais movimento: a "ola" atravessa a arquibancada a cada 9 s (a torcida se levanta 2 px na crista)
        var ola = MAIS ? mod(t, 9) * 70 - 30 : -999;
        caixasT.forEach(function (cx) {
          var q = Math.floor(t * 3 + hash(cx.gx, 1) * 3), d = Math.abs(cx.gx * 3 - ola);
          cx.pula = d < 5 ? -2 : d < 14 ? -1 : hash3(cx.gx, 7, q) < (MAIS ? 0.24 : 0.16) ? -1 : 0;
        });
      });
      s.arqY = lt - 6 - arq.h; s.arqX = 168;   // no jogo a 1ª fica em 60; aqui mais à direita para o mar aparecer
      // --- capim da praia (frente): tudo acima da linha 33 balança, mais no alto
      var fr = Buf.de(IMG['litoral/frente']), mf = new Int16Array(fr.w * fr.h);
      for (var y2 = 0; y2 < 34; y2++) for (var x2 = 0; x2 < fr.w; x2++) if (fr.d[y2 * fr.w + x2]) mf[y2 * fr.w + x2] = 1;
      var ALT = new Float32Array(34), GC = new Float32Array(fr.w);
      for (var ya = 0; ya < 34; ya++) { var al = Math.max(0, 33 - ya) / 27; ALT[ya] = al * al; }
      s.capim = new Deforma(fr, mf, [{ id: 1, x0: 0, x1: fr.w, y0: 0, y1: 34 }], function (x, y, cx, t, v) {
        v[0] = Math.round(ALT[y] * GC[x]); v[1] = 0;
      }, 10, function (t) {
        for (var x = 0; x < fr.w; x++) { var w = ventoEm(x * 0.9, t), onda = Math.sin(x * 0.07 - t * 3.2) * 0.5 + 0.5; GC[x] = (w * 2.2 + (w - 0.4) * onda * 1.6) * (MAIS ? 1.4 : 1); }
      });
      // --- pista, cercas e o pé da cena (fundo parado)
      s.pista = desenhaPistaLitoral(s);
      s.gaivotas = new Bando(rngCosmetica(11), 3, { tipo: 'gaivota', cor: P.branco, ponta: P.tinta, y0: 40, y1: 80, v: 9, qps: 9, largura: 420, paralaxe: 0.5 });
      // mais movimento: mais gaivotas, uma revoada em V e pássaros ao longe em bando
      s.gaivotasMais = new Bando(rngCosmetica(13), 4, { tipo: 'gaivota', cor: P.branco, ponta: P.tinta, y0: 30, y1: 90, v: 12, qps: 10, largura: 380, paralaxe: 0.5, dir: -1 });
      s.revoada = new Revoada({ tipo: 'gaivota', cor: P.branco, ponta: P.tinta, n: 7, y: 22, v: 22, qps: 9, periodo: 14 });
      s.bandoLonge = new Revoada({ tipo: 'longe', cor: P.sombra, n: 9, y: 12, v: 9, qps: 7, periodo: 34, fase: 12 });
      s.longe = new Bando(rngCosmetica(12), 4, { tipo: 'longe', cor: P.sombra, y0: 8, y1: 36, v: 4, qps: 7, largura: 380, paralaxe: 0.08, dir: -1 });
      s.areia = new Particulas(130); s.rngA = rngCosmetica(21);
      // --- cavalos na largada
      var defs = [['padrao-lisa', 'baio', 0], ['esguio-ondas', 'tordilho', 1], ['padrao-chamas', 'alazao', 2]];
      s.cavalos = defs.map(function (d, j) {
        var cv = new CavaloIdle(A.moldes[d[0]], 'parado', PELAGENS[d[1]], 100 + j * 17);
        return { cv: cv, x: [150, 86, 22][j], pe: s.raia0 + (j + 1) * s.raia - 4, ref: cv.anc.footY };
      });
      s.antes = this.desenhaAntes();
      s.agenda = new Agenda(); s.agenda.itens = [s.mar, s.coqueiros, s.capim, s.torcida];
      s.mar.camada = 'mar'; s.coqueiros.camada = 'coqueiros'; s.capim.camada = 'capim'; s.torcida.camada = 'torcida';
    },
    desenhaAntes: function () {
      var s = this, c = tela(s.W, s.H), g0 = g; g = c.getContext('2d');
      D(s.ceu, 0, 0); D(SOL_PARADO(), 99, s.lt - 105);
      repetida(IMG['litoral/nuvens'], 0, s.lt - 110, s.W);
      repetida(IMG['litoral/horizonte'], 0, s.lt - 32 - 96, s.W);
      repetida(IMG['litoral/meio'], 0, s.meioY, s.W);
      D(IMG['litoral/arquibancada'], s.arqX, s.arqY);
      D(s.pista, 0, s.lt - 16);
      s.cavalos.forEach(function (h) { D(h.cv.parado(), h.x, h.pe - h.ref); });
      repetida(IMG['litoral/frente'], 0, s.frenteY - 4, s.W);
      g = g0; return c;
    },
    quadro: function (t, dt, L) {
      var s = this, cam = estado.cam, W = s.W, lt = s.lt;
      var vez = s.agenda.roda(t, function (it) { return L[it.camada].ativo; });
      mede(L.fundo, function () { D(s.ceu, 0, 0); });
      if (!mede(L.ceu, function () {
        D(SOL[Math.floor(t * 2.5) % 4], 99, lt - 105);
        var nuv = IMG['litoral/nuvens'];
        repetida(s.nuvemAlta, cam * 0.03 + t * 1.2, lt - 110, W);
        repetida(s.nuvemBaixa, cam * 0.04 + t * 3.5, lt - 110, W);
      })) { D(SOL_PARADO(), 99, lt - 105); repetida(IMG['litoral/nuvens'], cam * 0.04, lt - 110, W); }
      if (!mede(L.passaros, function () { s.longe.desenha(t, cam, W); if (MAIS) s.bandoLonge.desenha(t, cam, W); })) {}
      if (!mede(L.mar, function () {
        if (vez === s.mar && s.mar.atualiza(t)) {
          var o = s.mar.saida, d = o.d, wB = o.w;
          // veleiros: a caixa inteira (barco + o mar em volta) sobe e desce 1 px, cada um na sua fase
          s.barcos.forEach(function (b, i) {
            var dy = Math.sin(t * 2.2 + i * 1.7) > 0.2 ? 1 : 0; if (!dy) return;
            for (var y = b[3]; y > b[1]; y--) for (var x = b[0]; x < b[2]; x++) d[y * wB + x] = d[(y - 1) * wB + x];
          });
          // farol: a luz gira (8 passos de 0,3 s)
          var f = Math.floor(t / 0.3) % 8, L0 = [157, 161], ly = 14;
          if (f === 1 || f === 5) d[ly * wB + 159] = C.ouro;
          if (f === 2 || f === 4) { d[ly * wB + 158] = C.amarelo; d[ly * wB + 159] = C.amarelo; d[ly * wB + 160] = C.amarelo; }
          if (f === 3) { for (var lx = L0[0]; lx <= L0[1]; lx++) d[ly * wB + lx] = C.branco; for (var r = 1; r <= 4; r++) { if (r % 2 || r < 3) { d[ly * wB + L0[0] - r] = C.claro; d[ly * wB + L0[1] + r] = C.claro; } } }
          o.poe();
        }
        repetida(s.mar.saida.c, cam * 0.1, lt - 32 - 96, W);
      })) repetida(IMG['litoral/horizonte'], cam * 0.1, lt - 32 - 96, W);
      if (!mede(L.coqueiros, function () { if (vez === s.coqueiros) s.coqueiros.atualiza(t); repetida(s.coqueiros.saida.c, cam * 0.3, s.meioY, W); }))
        repetida(IMG['litoral/meio'], cam * 0.3, s.meioY, W);
      var arqX = s.arqX - Math.floor(cam * 0.75) % 2600;
      if (!mede(L.torcida, function () {
        if (vez === s.torcida) s.torcida.atualiza(t); D(s.torcida.saida.c, arqX, s.arqY);
        // dois varais de bandeirolas na beira do toldo
        desenhaVaral(arqX + 4, arqX + 96, s.arqY - 4, 3, t, 0);
        desenhaVaral(arqX + 100, arqX + 196, s.arqY - 4, 3, t, 2);   // (o 2º fica fora da tela na largada)
        R(arqX + 2, s.arqY - 9, 1, 10, P.tinta); R(arqX + 98, s.arqY - 9, 1, 10, P.tinta); R(arqX + 197, s.arqY - 9, 1, 10, P.tinta);
      })) D(IMG['litoral/arquibancada'], arqX, s.arqY);
      mede(L.fundo, function () { D(s.pista, -mod(Math.floor(cam), 32), lt - 16); });
      mede(L.adereco, function () {
        desenhaPlaca(mod(52 - cam, 600) - 40, lt - 30, t);
        desenhaBiruta(mod(92 - cam, 600) - 40, lt - 44, t);
      });
      if (!mede(L.passaros, function () { s.gaivotas.desenha(t, cam, W); if (MAIS) { s.gaivotasMais.desenha(t, cam, W); s.revoada.desenha(t, cam, W); } })) {}
      var auto = estado.auto;
      if (!estado.camera) {
        if (!mede(L.cavalos, function () { s.cavalos.forEach(function (h) { D(h.cv.quadro(t, auto), h.x, h.pe - h.ref); }); }))
          s.cavalos.forEach(function (h) { D(h.cv.parado(), h.x, h.pe - h.ref); });
      }
      mede(L.particulas, function () {
        // areia soprada das dunas e redemoinhos baixos na pista, mais nas rajadas
        var w = vento(t), r = s.rngA;
        if (r() < dt * (4 + w * 22)) s.areia.nasce(T_AREIA, -4 + r() * 30, s.meioY + 96 + r() * 12, 20 + r() * 20, 0, 1.4 + r() * 2.2, r());
        if (r() < dt * (2 + w * 10)) s.areia.nasce(T_AREIA, -4 + r() * 60, s.raia0 + r() * (s.pistaFim - s.raia0), 30 + r() * 20, 0, 0.8 + r() * 1.6, r());
        if (MAIS) {
          // a onda quebra na mureta (quando a crista chega lá): respingos brancos na frente do mar
          var fase = mod(t, 8);
          if (fase > 7.3 && r() < dt * 70) s.areia.nasce(T_GOTA, r() * W, lt - 128 + 88, (r() - 0.5) * 10, -22 - r() * 18, 0.7 + r() * 0.3, r());
          // rajada forte: folhas dos coqueiros e areia da pista em redemoinho
          if (rajadaForte(t) && r() < dt * 14) s.areia.nasce(T_GIRO, 10 + r() * 150, s.meioY + 10 + r() * 30, 0, 0, 2.2 + r() * 1.2, r() * 0.5);
          if (rajadaForte(t) && r() < dt * 18) s.areia.nasce(T_GIRO, 20 + r() * 40, s.pistaFim - 10 - r() * 30, 0, 0, 1.4 + r() * 1, 0.5 + r() * 0.5);
        }
        s.areia.passo(dt, t); s.areia.desenha(0, 0, Math.floor(t * 12));
      });
      if (!mede(L.capim, function () { if (vez === s.capim) s.capim.atualiza(t); repetida(s.capim.saida.c, cam * 1.25, s.frenteY - 4, W); }))
        repetida(IMG['litoral/frente'], cam * 1.25, s.frenteY - 4, W);
    }
  };
  // pista do Litoral: faixa de grama atrás da cerca, cerca de trás, chão de areia batida, cerca da frente (código, como no jogo)
  function desenhaPistaLitoral(s) {
    var lt = s.lt, o = lt - 16, h = s.frenteY + 6 - o, Wp = s.W + 32, c = tela(Wp, h), cg = c.getContext('2d');
    function r(x, y, w, hh, cor) { cg.fillStyle = cor; cg.fillRect(x, y - o, w, hh); }
    r(0, o, Wp, 16, P.verde);
    for (var x = 0; x < Wp; x++) { var q = hash(x % 32, 7); if (q < 0.35) r(x, o + (q < 0.12 ? 1 : 2), 1, 2, P.verdeC); if (hash(x % 32, 9) < 0.18) r(x, lt - 2, 1, 2, P.verdeE); }
    r(0, lt, Wp, s.frenteY - lt, P.madC);
    r(0, lt, Wp, 2, P.mad);
    for (var y = lt + 2; y < s.frenteY; y++) for (x = 0; x < Wp; x++) { var k = hash(x % 32, y); if (k < 0.012) r(x, y, 1, 1, P.mad); else if (k < 0.022) r(x, y, 2, 1, P.madCC); }
    for (var j = 1; j < s.nRaias; j++) { var yy = s.raia0 + j * s.raia; for (x = 0; x < Wp; x += 8) r(x + (j % 2) * 4, yy, 4, 1, P.madCC); }
    var rt = lt - 8;
    r(0, rt, Wp, 1, P.branco); r(0, rt + 1, Wp, 1, P.claro); r(0, rt + 4, Wp, 1, P.claro);
    for (x = 0; x < Wp; x += 16) { r(x, rt, 1, 9, P.branco); r(x + 1, rt + 1, 1, 8, P.cinza); }
    r(0, s.frenteY, Wp, 1, P.branco); r(0, s.frenteY + 1, Wp, 1, P.claro); r(0, s.frenteY - 1, Wp, 1, P.mad);
    for (x = 8; x < Wp; x += 16) { r(x, s.frenteY, 1, 6, P.branco); r(x + 1, s.frenteY + 1, 1, 5, P.cinza); }
    return c;
  }

  // ---------------------------------------------------------------- Fornalha (arena do ginásio de fogo)
  CENAS.fornalha = {
    titulo: 'Fornalha · arena', legenda: 'arena do ginásio de Fogo, com o vulcão ao fundo',
    W: 256, H: 160,
    notas: [
      '<span class="tag cod">código</span> <b>Vulcão</b>: a arena gerada não tem vulcão; este é o pico da esquerda com cratera, lava escorrendo, fumaça e bombas de lava desenhadas por código, em erupção contínua com estouros a cada 3–7 s. Dá para desligar e comparar.',
      '<span class="tag cod">código</span> <b>Fosso de lava</b> em volta da areia: ciclo de cor que corre em volta do anel; <b>lava das encostas</b> desce.',
      '<span class="tag cod">código</span> <b>Ar quente</b>: as linhas do céu e das serras ondulam 1 px (miragem).',
      '<span class="tag cod">código</span> <b>Braseiros e tochas</b> com chama de 12 q/s e fagulhas; <b>emblemas</b> dos estandartes pulsam; <b>brasas</b> sobem do fosso.',
      '<span class="tag pago">PixelLab</span> Se o vulcão por código não convencer, o <code>/v2/vfx</code> faz a coluna de fogo e fumaça (poucas gerações; só com a sua confirmação).'
    ],
    camadas: [
      ['vulcao', 'Vulcão em erupção'], ['lava', 'Fosso e encostas de lava'], ['calor', 'Ar quente (miragem)'], ['fogo', 'Braseiros e emblemas'],
      ['particulas', 'Brasas e fumaça'], ['fundo', 'Fundo parado']
    ],
    init: function () {
      var s = this, b = Buf.de(IMG['ginasios/fogo']); s.base = b;
      var cx = 128, cy = 113;
      var RAMPA = ['6e2727', 'e83b3b', 'f79617', 'fbb954', 'fbff86'];
      // fosso de lava: tons de lava no anel entre a areia e a mureta, mais o caminho de lava da frente
      s.lava = new CicloCor(b, function (x, y, h) {
        var ex = (x - cx) / 100, ey = (y - cy) / 50, rr = Math.sqrt(ex * ex + ey * ey);
        var anel = rr > 0.78 && rr < 1.12 && y > 70, frente = y > 140 && x > 110 && x < 146;
        var encosta = y < 72 && (x < 44 || x > 214) && y > 6;
        if (!(anel || frente || encosta)) return -1;
        return h === 'e83b3b' || h === '6e2727' ? 0 : -1;   // só o vermelho da lava (a pedra e a areia ficam)
      }, [RAMPA], function (x, y, r, d, t, j) {
        var v = fsin(s.lA[j] - t * s.lS[j]) + fsin(s.lA[j] * 0.37 + t * 0.7) * 0.6;
        if (s.lE[j]) return s.lH[j] < 0.3 && v > 1.0 ? d + 1 : d;              // encosta: veios esparsos que descem
        return Math.max(0, Math.min(4, d + (v > 1.35 ? 2 : v > 0.55 ? 1 : v < -1.1 ? -1 : 0)));
      }, 10);
      // partes fixas por pixel: fase (ângulo no anel; altura na encosta), velocidade, ruído
      var nl = s.lava.n; s.lA = new Float32Array(nl); s.lS = new Float32Array(nl); s.lH = new Float32Array(nl); s.lE = new Uint8Array(nl);
      for (var jl = 0; jl < nl; jl++) {
        var xl = s.lava.px[jl * 5 + 1], yl = s.lava.px[jl * 5 + 2], enc = yl < 72 && (xl < 44 || xl > 214);
        s.lE[jl] = enc ? 1 : 0; s.lH[jl] = hash(xl, yl);
        s.lA[jl] = enc ? yl * 0.55 + xl * 0.1 + hash(xl >> 1, yl >> 2) * 2 : Math.atan2((yl - cy) * 2, xl - cx) * 9 + hash(xl >> 2, yl >> 1) * 1.4;
        s.lS[jl] = enc ? 3.2 : 2.4;
      }
      // emblemas de fogo nos estandartes (pixels quentes dentro das 5 caixas)
      var CAIXAS = [[22, 52, 40, 76], [68, 38, 84, 60], [119, 34, 137, 56], [164, 38, 182, 60], [216, 52, 234, 76]];
      var RAMPA_E = ['e83b3b', 'f79617', 'fbb954', 'fbff86', 'f9c22b'];
      s.emblemas = new CicloCor(s.lava.saida, function (x, y, h) {
        for (var i = 0; i < CAIXAS.length; i++) { var c = CAIXAS[i]; if (x >= c[0] && x < c[2] && y >= c[1] && y < c[3]) return RAMPA_E.indexOf(h) >= 0 ? 0 : -1; }
        return -1;
      }, [RAMPA_E], function (x, y, r, d, t) {
        var pulso = Math.sin(t * 4.2 + x * 0.05) * 0.5 + Math.sin(t * 9.1 + y * 0.6) * 0.5;
        return d === 0 ? 0 : Math.max(0, Math.min(3, d + (pulso > 0.55 ? 1 : pulso < -0.6 ? -1 : 0)));
      }, 12);
      // braseiros e tochas (topo da chama de cada um)
      s.chamas = [[10, 50], [51, 58], [204, 58], [246, 50], [16, 99], [241, 99], [108, 31], [149, 31]];
      s.brasas = new Particulas(150); s.rng = rngCosmetica(31);
      // vulcão: o pico da esquerda (cratera em 78..82, y 16)
      s.vx = 80; s.vy = 16; s.proxEstouro = 2; s.estouro = -9;
      s.antes = tela(256, 160); s.antes.getContext('2d').drawImage(IMG['ginasios/fogo'], 0, 0);
      s.saida = new Buf(256, 160);
      s.muralha = new Uint8Array(256 * 160);   // a muralha (escura) não ondula no ar quente
      for (var y = 20; y < 34; y++) for (var x = 0; x < 256; x++) { var h = hexDe(b.d[y * 256 + x]); if (h === '3e3546' || h === '2e222f') s.muralha[y * 256 + x] = 1; }
    },
    quadro: function (t, dt, L) {
      var s = this, q = Math.floor(t * 12);
      // a imagem é composta num tique de 12 q/s: lava → emblemas → ar quente (cada etapa medida na sua camada)
      if (q !== s.tique || s.ligadas !== '' + L.lava.ativo + L.fogo.ativo + L.calor.ativo) {
        s.tique = q; s.ligadas = '' + L.lava.ativo + L.fogo.ativo + L.calor.ativo;
        var src = s.base.d;
        mede(L.lava, function () { s.lava.passo = -1; s.lava.atualiza(t); src = s.lava.saida.d; });
        mede(L.fogo, function () { s.emblemas.saida.d.set(src); s.emblemas.passo = -1; s.emblemas.atualiza(t); src = s.emblemas.saida.d; });
        var d = s.saida.d; d.set(src);
        mede(L.calor, function () {
          for (var y = 2; y < 34; y++) {
            var dx = Math.round(fsin(y * 0.9 + q * 0.55) * 0.55 + fsin(y * 0.31 - q * 0.21) * 0.45);
            if (!dx) continue;
            for (var x = 0; x < 256; x++) { var sx = x - dx, i = y * 256 + x; if (sx >= 0 && sx < 256 && !s.muralha[i]) d[i] = src[y * 256 + sx]; }
          }
        });
        s.saida.poe();
      }
      mede(L.fundo, function () { D(s.saida.c, 0, 0); });
      mede(L.vulcao, function () { desenhaVulcao(s, t, dt); });
      mede(L.fogo, function () { s.chamas.forEach(function (c, i) { desenhaChama(c[0], c[1], t, i * 0.37, i >= 6 ? 0.7 : 1); }); });
      mede(L.particulas, function () {
        var r = s.rng;
        if (MAIS && r() < dt * 7) {   // bolhas que estouram no fosso de lava
          var ab = r() * Math.PI * 2, bx = 128 + Math.cos(ab) * 93, by = 113 + Math.sin(ab) * 44;
          if (by > 84) s.brasas.nasce(T_BOLHA, bx, by, 0, 0, 0.9, r());
        }
        if (r() < dt * (MAIS ? 44 : 26)) {   // brasas do fosso
          var a = r() * Math.PI * 2, ex = 128 + Math.cos(a) * 94, ey = 113 + Math.sin(a) * 45;
          if (ey > 80) s.brasas.nasce(T_BRASA, ex, ey, (r() - 0.5) * 6, -10 - r() * 14, 1.2 + r() * 1.8, r());
        }
        if (r() < dt * 10) { var c = s.chamas[Math.floor(r() * s.chamas.length)]; s.brasas.nasce(T_FAISCA, c[0], c[1] - 5, (r() - 0.5) * 8, -14 - r() * 10, 0.5 + r() * 0.6, r()); }
        s.brasas.passo(dt, t); s.brasas.desenha(0, 0, Math.floor(t * 12));
      });
      if (L.vulcao.ativo && s.jorro >= 0) mede(L.vulcao, function () { desenhaJorro(s.vx, s.vy - 1, s.jorro, 13, Math.floor(t * 12)); });
    }
  };
  function desenhaVulcao(s, t, dt) {
    var vx = s.vx, vy = s.vy, r = s.rng;
    // estouros: 3 a 7 s, cada um com um clarão na cratera e um leque de bombas
    if (t >= s.proxEstouro) { s.estouro = t; s.proxEstouro = t + (MAIS ? 2.5 + r() * 2 : 3 + r() * 4); for (var k = 0; k < (MAIS ? 14 : 9); k++) s.brasas.nasce(T_BOMBA, vx + (r() - 0.5) * 2, vy - 1, (r() - 0.5) * 26, -26 - r() * (MAIS ? 30 : 20), 1.1 + r() * 0.6, r()); }
    var fl = t - s.estouro < 0.5;
    s.jorro = MAIS && t - s.estouro < 1.3 ? (t - s.estouro) / 1.3 : -1;   // jorro de lava em cada estouro (desenhado na frente da fumaça)
    // cratera: 5 px de lava viva no topo do pico, com o brilho em ciclo
    var q = Math.floor(t * 8);
    var cr = [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1]];
    cr.forEach(function (p, i) { R(vx + p[0], vy + p[1], 1, 1, RAMPA_BRASA[(fl ? 0 : 1) + ((i + q) % 3)]); });
    R(vx - 3, vy + 1, 1, 1, P.vinho); R(vx + 3, vy + 1, 1, 1, P.vinho);
    // lava que escorre pela encosta (2 fios), em ciclo de cor descendo
    var fios = [[-1, 1, -1], [1, 1, 1]];
    fios.forEach(function (f, j) {
      var x = vx + f[0], y = vy + f[1];
      for (var k = 0; k < 8 + j * 3; k++) {
        y++; if (k % 2 === j) x += f[2];
        var cor = RAMPA_BRASA[1 + ((k - Math.floor(t * 6) + 60) % 3)];
        R(x, y, 1, 1, k > 7 ? P.vinho : cor);
      }
    });
    // fumaça contínua: um tufo a cada ~0,12 s, sobe e o vento leva para a direita
    if (r() < dt * (fl ? 16 : 8) * (MAIS ? 1.8 : 1)) s.brasas.nasce(T_FUMACA, vx + (r() - 0.5) * 3, vy - 2, (r() - 0.3) * 3, -9 - r() * 6, 2.6 + r() * 1.6, r());
    if (fl && r() < dt * 30) s.brasas.nasce(T_BRASA, vx + (r() - 0.5) * 3, vy - 1, (r() - 0.5) * 10, -18 - r() * 10, 0.8 + r() * 0.6, r());
  }

  // ---------------------------------------------------------------- Expedição (cena da aba)
  CENAS.expedicao = {
    titulo: 'Expedição · cena da aba', legenda: 'o vale com o rio e o vulcão',
    W: 256, H: 160,
    notas: [
      '<span class="tag cod">código</span> <b>Vulcão</b> em erupção contínua: a lava da cratera e das encostas em ciclo de cor, fumaça que sobe pela coluna pintada, bombas e brasas, e um estouro a cada 2–6 s.',
      '<span class="tag cod">código</span> <b>Rio</b>: o brilho da água corre para a frente (para quem olha), em ciclo de cor.',
      '<span class="tag cod">código</span> <b>Placas de madeira</b> giram no poste com o vento: encolhem até 3 px na ponta e voltam, cada uma no seu tempo.',
      '<span class="tag cod">código</span> <b>Capim</b> do primeiro plano em rajadas; <b>pinheiros</b> das bordas com a ponta balançando 1 px; <b>pássaros</b> sobre o vale; <b>folhas</b> e <b>nuvens finas</b> passando.',
      'As nuvens grandes são pintadas no fundo e não dá para movê-las sem o céu por trás; por isso passam nuvens finas novas na frente delas.'
    ],
    camadas: [
      ['vulcao', 'Vulcão em erupção'], ['rio', 'Rio'], ['placas', 'Placas ao vento'], ['capim', 'Capim e pinheiros'],
      ['ceu', 'Nuvens finas e pássaros'], ['particulas', 'Fumaça, brasas e folhas'], ['fundo', 'Fundo parado']
    ],
    init: function () {
      var s = this, b = Buf.de(IMG['telas/expedicao']); s.base = b;
      // lava do vulcão (cratera e encostas) e rio: duas rampas no mesmo ciclo
      var LAVA = ['7a3045', 'b33831', 'ea4f36', 'fb6b1d', 'f79617', 'f9c22b', 'fbff86'];
      var AGUA = ['0b5e65', '0b8a8f', '0eaf9b', '4d9be6', '8fd3ff', '8ff8e2', 'c7dcd0', 'ffffff'];
      s.ciclo = new CicloCor(b, function (x, y, h) {
        if (x > 186 && x < 238 && y > 18 && y < 90 && LAVA.indexOf(h) >= 0) return 0;
        if (x > 90 && x < 182 && y > 100 && y < 146 && AGUA.indexOf(h) >= 0) return 1;
        return -1;
      }, [LAVA, AGUA], function (x, y, r, d, t, j) {
        if (r === 0) {
          if (!s.lavaOn) return d;
          var v = fsin(y * 0.7 - t * 3.5 + x * 0.2) + 0.5 * fsin(t * 5 + x);
          return Math.max(0, Math.min(6, d + (v > 0.9 ? 1 : v < -1 ? -1 : 0)));
        }
        if (!s.rioOn || d <= 1) return d;
        if (MAIS && d >= 3 && hash3(x, y, Math.floor(t * 9 + s.rH[j] * 4)) < 0.05) return 7;   // corredeira: espuma que pisca
        if (d >= 6) return hash3(x, y, Math.floor(t * 6 + s.rH[j] * 5)) < 0.3 ? d - 2 : d;
        var onda = fsin(s.rA[j] - t * s.rS[j] + fsin(s.rB[j]) * 1.4);
        return Math.max(0, Math.min(7, d + (onda > 0.75 ? 1 : onda < -0.8 ? -1 : 0)));
      }, 12);
      var n = s.ciclo.n; s.rA = new Float32Array(n); s.rS = new Float32Array(n); s.rB = new Float32Array(n); s.rH = new Float32Array(n);
      for (var j = 0; j < n; j++) {
        var x = s.ciclo.px[j * 5 + 1], y = s.ciclo.px[j * 5 + 2], pt = (y - 100) / 46;
        s.rA[j] = y * (1.6 - pt * 0.8); s.rS[j] = 3 + pt * 2; s.rB[j] = x * 0.2 + y * 0.3; s.rH[j] = hash(x, y);
      }
      // placas: os três braços (sem o poste), encolhendo em volta do poste
      var POSTE = [52, 63], MADEIRA = ['9e4539', 'cd683d', '6e2727', '4c3e24', 'e6904e', '2e222f', '753c54', '45293f', '7a3045', '966c6c', 'ab947a', '694f62', '3e3546'];
      var placas = [[30, 37, 100, 54], [33, 52, 82, 67], [28, 67, 95, 82]];
      var mp = new Int16Array(256 * 160), caixasP = [];
      placas.forEach(function (p, i) {
        for (var y = p[1]; y < p[3]; y++) for (var x = p[0]; x < p[2]; x++) {
          if (x >= POSTE[0] && x <= POSTE[1]) continue;
          if (MADEIRA.indexOf(hexDe(b.d[y * 256 + x])) >= 0) mp[y * 256 + x] = i + 1;
        }
        caixasP.push({ id: i + 1, x0: p[0] - 1, x1: p[2] + 1, y0: p[1], y1: p[3], fase: i * 2.1, a: p[0], b: p[2] });
      });
      s.mascaraPlacas = mp;
      s.giro = new Deforma(b, mp, caixasP, function (x, y, cx, t, v) {
        var dist = x - 57.5, L = dist > 0 ? cx.b - 57.5 : 57.5 - cx.a;
        var dd = Math.round(Math.abs(dist) / L * cx.enc);
        v[0] = dist > 0 ? -dd : dd; v[1] = 0;
      }, 12, function (t) {
        caixasP.forEach(function (cx) { var w = vento(t), ang = Math.sin(t * (1.1 + w) * (MAIS ? 1.4 : 1) + cx.fase) * (0.25 + w * 0.75); cx.enc = Math.max(0, ang) * (MAIS ? 5 : 3); });
      });
      // onde a placa encolheu aparece o fundo da mesma linha logo além da ponta (o céu ou a mata que ela cobria)
      s.buracoPlaca = function (x, y, cx, src) {
        var fx = x < 57 ? cx.a - 1 - ((cx.a - x) & 1) : cx.b + ((x - cx.b) & 1);
        return src[y * 256 + Math.max(0, Math.min(255, fx))];
      };
      // capim do primeiro plano (1) e pontas dos pinheiros das bordas (2)
      var CAPIM = ['a2a947', 'cddf6c', 'd5e04b', '676633', '92a984', 'fbff86', '91db69', 'b2ba90'];
      var PINHO = ['165a4c', '374e4a', '313638', '239063', '547e64', '0b5e65'];
      var mc = new Int16Array(256 * 160);
      for (var y2 = 108; y2 < 160; y2++) for (var x2 = 0; x2 < 256; x2++) if (CAPIM.indexOf(hexDe(b.d[y2 * 256 + x2])) >= 0 && !(x2 >= 50 && x2 <= 64)) mc[y2 * 256 + x2] = 1;
      for (y2 = 30; y2 < 100; y2++) for (x2 = 0; x2 < 256; x2++) { if (!(x2 < 26 || x2 > 236)) continue; if (PINHO.indexOf(hexDe(b.d[y2 * 256 + x2])) >= 0) mc[y2 * 256 + x2] = 2; }
      var AC = new Float32Array(160), AP = new Float32Array(160), GC = new Float32Array(256);
      for (y2 = 0; y2 < 160; y2++) { AC[y2] = suave(150, 112, y2); AP[y2] = suave(80, 40, y2); }
      s.capim = new Deforma(b, mc, [{ id: 1, x0: 0, x1: 256, y0: 106, y1: 160 }, { id: 2, x0: 0, x1: 28, y0: 28, y1: 100 }, { id: 2, x0: 234, x1: 256, y0: 28, y1: 100 }], function (x, y, cx, t, v) {
        v[0] = Math.round((cx.id === 1 ? AC[y] : AP[y]) * GC[x]); v[1] = 0;
      }, 12, function (t) {
        for (var x = 0; x < 256; x++) {
          var w = ventoEm(x, t);
          GC[x] = ((x < 28 || x > 233) ? w * 1.3 * (0.6 + 0.4 * Math.sin(t * 1.7 + x * 0.1)) : w * 1.6 + (Math.sin(x * 0.11 - t * 3) * 0.5 + 0.5) * w * 1.2) * (MAIS ? 1.4 : 1);
        }
      });
      // nuvens finas (código) na frente das nuvens pintadas; as placas e o poste são redesenhados por cima delas
      s.fiapos = [];
      var rr = rngCosmetica(41);
      for (var i = 0; i < 6; i++) s.fiapos.push({ x: rr() * 320, y: 10 + rr() * 50, w: 14 + Math.floor(rr() * 22), v: 1.2 + rr() * 2.4 });
      s.passaros = new Bando(rngCosmetica(42), 5, { tipo: 'longe', cor: P.sombra, y0: 66, y1: 96, v: 6, qps: 7, largura: 320, paralaxe: 0 });
      s.revoada = new Revoada({ tipo: 'longe', cor: P.sombra, n: 9, y: 58, v: 14, qps: 8, periodo: 18 });
      s.part = new Particulas(140); s.rng = rngCosmetica(43); s.proxEstouro = 1.5; s.estouro = -9;
      s.antes = tela(256, 160); s.antes.getContext('2d').drawImage(IMG['telas/expedicao'], 0, 0);
      s.comp = new Buf(256, 160);
      // o que fica na frente dos fiapos: placas e poste (recortados da cena composta a cada tique)
      s.posteMask = new Uint8Array(256 * 160);
      for (y2 = 26; y2 < 150; y2++) for (x2 = 24; x2 < 104; x2++) {
        var hh = hexDe(b.d[y2 * 256 + x2]);
        if ((y2 < 84 && x2 >= 26 && x2 < 102 && (mp[y2 * 256 + x2] || (x2 >= POSTE[0] && x2 <= POSTE[1] && MADEIRA.indexOf(hh) >= 0)))) s.posteMask[y2 * 256 + x2] = 1;
      }
      s.frente = new Buf(256, 160);
    },
    quadro: function (t, dt, L) {
      var s = this, q = Math.floor(t * 12), lig = '' + L.vulcao.ativo + L.rio.ativo + L.placas.ativo + L.capim.ativo;
      if (q !== s.tique || lig !== s.ligadas) {
        s.tique = q; s.ligadas = lig; var tq = q / 12;
        var src = s.base.d, d = s.comp.d;
        s.lavaOn = L.vulcao.ativo; s.rioOn = L.rio.ativo;
        if (s.lavaOn || s.rioOn) mede(s.lavaOn ? L.vulcao : L.rio, function () { s.ciclo.passo = -1; s.ciclo.atualiza(t); src = s.ciclo.saida.d; });
        d.set(src);
        mede(L.placas, function () {
          s.giro.aplica(src, d, tq, s.buracoPlaca);
          // placas e poste por cima dos fiapos (recorte da cena já com o giro)
          var f = s.frente.d, m = s.posteMask, mp = s.mascaraPlacas;
          for (var y = 26; y < 84; y++) for (var x = 24; x < 104; x++) { var i = y * 256 + x; f[i] = (m[i] && (!mp[i] || d[i] === src[i] || true)) ? d[i] : 0; }
          s.frente.poe();
        });
        mede(L.capim, function () { s.capim.aplica(src, d, tq); });
        if (!L.placas.ativo) { var f = s.frente.d, m = s.posteMask; for (var i = 0; i < f.length; i++) f[i] = m[i] ? src[i] : 0; s.frente.poe(); }
        s.comp.poe();
      }
      mede(L.fundo, function () { D(s.comp.c, 0, 0); });
      mede(L.ceu, function () {
        s.fiapos.forEach(function (f) {
          var x = Math.round(mod(f.x + t * f.v, 330) - 40), y = Math.round(f.y);
          R(x, y, f.w, 1, P.claro); R(x + 3, y - 1, f.w - 8, 1, P.branco); R(x + 6, y + 1, f.w - 10, 1, P.cinza);
        });
        s.passaros.desenha(t, 0, 256);
        if (MAIS) s.revoada.desenha(t, 0, 256);
        D(s.frente.c, 0, 0);
      });
      mede(L.vulcao, function () {
        var r = s.rng, vx = 220, vy = 30;
        if (t >= s.proxEstouro) { s.estouro = t; s.proxEstouro = t + (MAIS ? 2.2 + r() * 2 : 2 + r() * 4); for (var k = 0; k < (MAIS ? 13 : 8); k++) s.part.nasce(T_BOMBA, vx + (r() - 0.5) * 3, vy, (r() - 0.5) * 24, -24 - r() * (MAIS ? 28 : 18), 1.1 + r() * 0.5, r()); }
        var fl = t - s.estouro < 0.4;
        s.jorro = MAIS && t - s.estouro < 1.4 ? (t - s.estouro) / 1.4 : -1;
        if (fl) { R(vx - 2, vy - 1, 5, 2, P.amarelo); R(vx - 1, vy - 2, 3, 1, P.branco); }
        if (r() < dt * 9 * (MAIS ? 1.8 : 1)) s.part.nasce(T_FUMACA, vx + 2 + (r() - 0.5) * 4, vy - 6, 2 + r() * 4, -8 - r() * 5, 3 + r() * 1.5, r());
        if (r() < dt * 10) s.part.nasce(T_BRASA, vx + (r() - 0.5) * 4, vy - 2, (r() - 0.5) * 10, -14 - r() * 10, 0.9 + r() * 0.8, r());
      });
      mede(L.particulas, function () {
        var r = s.rng;
        if (r() < dt * (0.6 + vento(t) * 2.2) * (MAIS ? 2 : 1)) s.part.nasce(T_FOLHA, -4, 70 + r() * 70, 18 + r() * 10, 0, 9 + r() * 4, r());
        if (rajadaForte(t) && r() < dt * 16) s.part.nasce(T_GIRO, 10 + r() * 200, 110 + r() * 30, 0, 0, 2 + r() * 1.2, r() * 0.5);   // folhas em redemoinho
        s.part.passo(dt, t); s.part.desenha(0, 0, Math.floor(t * 12));
      });
      if (L.vulcao.ativo && s.jorro >= 0) mede(L.vulcao, function () { desenhaJorro(220, 29, s.jorro, 16, Math.floor(t * 12)); });
    }
  };

  // ---------------------------------------------------------------- Cavalos (idle no Haras)
  CENAS.cavalos = {
    titulo: 'Cavalos · idle', legenda: 'quatro cavalos no pasto do Haras',
    W: 256, H: 160,
    notas: [
      '<span class="tag cod">código</span> <b>Respiração</b>: a barriga desce 1 px a cada 3–4 s (cada cavalo no seu ritmo).',
      '<span class="tag cod">código</span> <b>Variações raras</b>, sorteadas a cada 3–8 s pela RNG cosmética (fora da seed das regras): piscar (às vezes duas vezes), abanar a cauda, girar a orelha, baixar a cabeça 1–2 px.',
      '<span class="tag cod">código</span> <b>Vento</b> na crina do pescoço e na ponta da cauda (o mesmo vento das outras cenas).',
      '<span class="tag cod">código</span> Tudo sai do molde que já existe (o mapa de papéis), para qualquer pelagem e marca: custo de arte zero, 1 desenho por cavalo.',
      '<span class="tag pago">PixelLab</span> <b>Cavar</b> e <b>comer</b> (baixar a cabeça até o chão) não ficam naturais por código: são o piloto pago proposto (4 quadros por ação, a partir do molde).',
      'Use os botões para disparar cada variação e a lupa para ver os pixels de perto.'
    ],
    camadas: [['cavalos', 'Cavalos (idle)'], ['ceu', 'Pássaros'], ['fundo', 'Fundo parado']],
    init: function () {
      var s = this;
      var defs = [['robusto-folhas', 'castanho', 'retrato', 4, 150, false], ['padrao-lisa', 'baio', 'retrato', 62, 156, true], ['esguio-ondas', 'tordilho', 'retrato', 118, 152, false], ['padrao-chamas', 'alazao', 'parado', 186, 158, false]];
      s.cavalos = defs.map(function (d, j) {
        var cv = new CavaloIdle(A.moldes[d[0]], d[2], PELAGENS[d[1]], 300 + j * 29, { espelho: d[5] });
        return { cv: cv, x: d[3], pe: d[4], ref: cv.anc.footY };
      });
      s.passaros = new Bando(rngCosmetica(51), 3, { tipo: 'longe', cor: P.sombra, y0: 8, y1: 40, v: 7, qps: 7, largura: 320, paralaxe: 0 });
      s.revoada = new Revoada({ tipo: 'longe', cor: P.sombra, n: 7, y: 20, v: 16, qps: 8, periodo: 16 });
      s.part = new Particulas(60); s.rng = rngCosmetica(52);
      s.borboletas = [{ x: 40, y: 112, f: 0, cor: P.ouro }, { x: 170, y: 120, f: 2.1, cor: P.branco }, { x: 230, y: 108, f: 4.3, cor: P.ouroC }];
      s.antes = tela(256, 160); var ag = s.antes.getContext('2d'); ag.drawImage(IMG['telas/haras'], 0, 0);
      s.cavalos.forEach(function (h) { ag.drawImage(h.cv.parado(), h.x, h.pe - h.ref); });
    },
    quadro: function (t, dt, L) {
      var s = this;
      mede(L.fundo, function () { D(IMG['telas/haras'], 0, 0); });
      mede(L.ceu, function () {
        s.passaros.desenha(t, 0, 256);
        if (!MAIS) return;
        s.revoada.desenha(t, 0, 256);
        // borboletas: voo em laço, batendo as asas (aberta 3 px, fechada 1 px), pousando de vez em quando
        s.borboletas.forEach(function (b, i) {
          var pousa = Math.sin(t * 0.35 + b.f) > 0.75, bx = Math.round(b.x + Math.sin(t * 0.6 + b.f) * 26 + Math.sin(t * 1.7 + b.f) * 6);
          var by = Math.round(b.y + Math.sin(t * 1.1 + b.f * 2) * 7 + (pousa ? 6 : 0)), aberta = pousa ? Math.floor(t * 2 + i) % 3 === 0 : Math.floor(t * 12 + i) % 2;
          if (aberta) { R(bx - 1, by, 1, 1, b.cor); R(bx + 1, by, 1, 1, b.cor); R(bx, by, 1, 1, P.tinta); } else R(bx, by - 1, 1, 2, b.cor);
        });
        // folhas soltas das árvores no vento
        var r = s.rng;
        if (r() < dt * (0.4 + vento(t) * 2)) s.part.nasce(T_FOLHA, 200 + r() * 60, 40 + r() * 30, 10, 0, 8, r());
        if (rajadaForte(t) && r() < dt * 10) s.part.nasce(T_GIRO, 60 + r() * 150, 120 + r() * 20, 0, 0, 2 + r(), r() * 0.5);
        s.part.passo(dt, t); s.part.desenha(0, 0, Math.floor(t * 12));
      });
      if (!mede(L.cavalos, function () { s.cavalos.forEach(function (h) { D(h.cv.quadro(t, estado.auto), h.x, h.pe - h.ref); }); }))
        s.cavalos.forEach(function (h) { D(h.cv.parado(), h.x, h.pe - h.ref); });
    }
  };

  // ================================================================ interface
  var ORDEM = ['litoral', 'fornalha', 'expedicao', 'cavalos'];
  var el = function (id) { return document.getElementById(id); };
  var cvAntes = el('antes'), cvDepois = el('depois'), gA = cvAntes.getContext('2d'), gD = cvDepois.getContext('2d');
  var buf = null, cenaAtual = null, camadas = {}, linhas = {}, escala = 1;

  function escalaPara(cena) {
    var larg = el('molduraDepois').clientWidth, dpr = window.devicePixelRatio || 1;
    var s = Math.max(1, Math.floor(larg * dpr / cena.W));
    if (estado.lupa) s *= 2;
    return s;
  }
  function ajustaCanvas() {
    var c = cenaAtual; if (!c) return;
    escala = escalaPara(c);
    var dpr = window.devicePixelRatio || 1;
    [cvAntes, cvDepois].forEach(function (cv) {
      cv.width = c.W * escala; cv.height = c.H * escala;
      cv.style.width = (c.W * escala / dpr) + 'px'; cv.style.height = (c.H * escala / dpr) + 'px';
    });
    [gA, gD].forEach(function (x) { x.imageSmoothingEnabled = false; });
    gA.drawImage(c.antes, 0, 0, c.W * escala, c.H * escala);
  }
  function montaMedidor(cena) {
    camadas = {}; linhas = {};
    var tb = el('camadas'); tb.innerHTML = '';
    cena.camadas.forEach(function (d) {
      var L = new Camada(d[0], d[1]); camadas[d[0]] = L;
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><label><input type="checkbox" id="cam-' + cena.id + '-' + d[0] + '" checked> ' + d[1] + '</label></td><td class="n">–</td><td class="n">–</td><td><div class="barra"><i></i></div></td>';
      tr.querySelector('input').addEventListener('change', function (e) { L.ativo = e.target.checked; });
      if (d[0] === 'fundo') { tr.querySelector('input').disabled = true; }
      tb.appendChild(tr); linhas[d[0]] = tr;
    });
  }
  function botao(rotulo, ativo, fn, id) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = rotulo; if (id) b.id = id;
    if (ativo !== null) b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    b.addEventListener('click', function () { fn(b); });
    return b;
  }
  // o que a variante "mais movimento" acrescenta em cada cena
  var NOTAS_MAIS = {
    litoral: 'Rajada forte a cada ~15 s que dobra coqueiros, capim, bandeirolas e biruta juntos; ondas grandes que descem até a mureta e quebram com respingo; "ola" na torcida; revoada de gaivotas em V e bando ao longe; folhas e areia em redemoinho; cavalos com gestos a cada 1–3,5 s.',
    fornalha: 'Jorro de lava a cada estouro (2,5–4,5 s), mais bombas e fumaça; bolhas que estouram no fosso; mais brasas.',
    expedicao: 'Jorro de lava no vulcão, mais fumaça e bombas; espuma de corredeira no rio; placas girando mais; capim com rajadas fortes; revoada sobre o vale; folhas em redemoinho.',
    cavalos: 'Gestos a cada 1–3,5 s e mais fortes, gestos que se juntam (cauda junto com outro), sacudir a cabeça; borboletas, folhas soltas e revoada.'
  };
  function montaNotas(cena) {
    el('notas').innerHTML = cena.notas.map(function (n) { return '<li>' + n + '</li>'; }).join('') +
      '<li><span class="tag mais">mais movimento</span> ' + NOTAS_MAIS[cena.id] + '</li>';
  }
  function montaControles(cena) {
    var ctl = el('ctlCena'); ctl.innerHTML = '';
    // Atual (a principal, aprovada) × Mais movimento (para comparar)
    var bA = botao('Atual', !cena.mais, function () { cena.mais = false; bA.setAttribute('aria-pressed', 'true'); bM.setAttribute('aria-pressed', 'false'); }),
      bM = botao('Mais movimento', !!cena.mais, function () { cena.mais = true; bM.setAttribute('aria-pressed', 'true'); bA.setAttribute('aria-pressed', 'false'); });
    var grupo = document.createElement('div'); grupo.className = 'estilo'; grupo.setAttribute('role', 'group'); grupo.setAttribute('aria-label', 'Versão');
    grupo.appendChild(bA); grupo.appendChild(bM); ctl.appendChild(grupo);
    if (cena.id === 'litoral') {
      ctl.appendChild(botao('Câmera em corrida', estado.camera, function (b) { estado.camera = !estado.camera; b.setAttribute('aria-pressed', estado.camera); }));
    }
    if (cena.id === 'litoral' || cena.id === 'cavalos') {
      ctl.appendChild(botao('Variações automáticas', estado.auto, function (b) { estado.auto = !estado.auto; b.setAttribute('aria-pressed', estado.auto); }));
    }
    if (cena.id === 'cavalos') {
      var sp = document.createElement('span'); sp.textContent = 'Disparar:'; ctl.appendChild(sp);
      [['Piscar', 'piscar'], ['Cauda', 'cauda'], ['Orelha', 'orelha'], ['Cabeça', 'cabeca'], ['Sacudir', 'sacode']].forEach(function (p) {
        ctl.appendChild(botao(p[0], null, function () { var t = agora(); cena.cavalos.forEach(function (h, i) { h.cv.dispara(p[1], t + i * 0.12); }); }));
      });
    }
    ctl.appendChild(botao('Lupa ×2', estado.lupa, function (b) { estado.lupa = !estado.lupa; b.setAttribute('aria-pressed', estado.lupa); ajustaCanvas(); }));
  }
  function trocaCena(id) {
    var c = CENAS[id]; c.id = id; estado.cena = id;
    if (!c.pronta) { c.init(); c.pronta = true; }
    cenaAtual = c;
    buf = tela(c.W, c.H); g = buf.getContext('2d');
    el('legenda').textContent = c.legenda;
    montaNotas(c);
    Array.prototype.forEach.call(el('cenas').children, function (b) { b.setAttribute('aria-pressed', b.dataset.cena === id ? 'true' : 'false'); });
    montaMedidor(c); montaControles(c); ajustaCanvas();
    try { localStorage.setItem('galope-animacao:cena', id); } catch (e) {}
  }
  var T0 = performance.now();
  function agora() { return (performance.now() - T0) / 1000; }

  var janela = [], ultimoT = 0, ultimaUI = 0, quadros = 0;
  var reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop() {
    var t = agora(), dt = Math.min(0.05, t - ultimoT || 0.016); ultimoT = t;
    if (estado.camera && estado.cena === 'litoral') estado.cam += dt * 16 * 12; else if (estado.cena === 'litoral') estado.cam = 0;
    medidor.chamadas = 0; medidor.particulas = 0;
    var t0 = performance.now();
    for (var k in camadas) camadas[k].acc = 0;
    MAIS = !!cenaAtual.mais;
    cenaAtual.quadro(t, dt, camadas);
    // custo das animações por versão (média móvel), para comparar as duas no medidor
    var animQ = 0; for (k in camadas) if (k !== 'fundo' && camadas[k].ativo) animQ += camadas[k].acc;
    var me = cenaAtual.msVersao || (cenaAtual.msVersao = {});
    var kv = MAIS ? 'mais' : 'atual'; me[kv] = me[kv] == null ? animQ : me[kv] * 0.97 + animQ * 0.03;
    gD.drawImage(buf, 0, 0, cenaAtual.W * escala, cenaAtual.H * escala);
    var total = performance.now() - t0;
    // médias
    for (k in camadas) { var L = camadas[k]; L.ms = L.ms * 0.95 + L.acc * 0.05; L.picos.push(L.acc); if (L.picos.length > 120) L.picos.shift(); }
    medidor.total = medidor.total * 0.95 + total * 0.05;
    (medidor.picosTot || (medidor.picosTot = [])).push(total); if (medidor.picosTot.length > 120) medidor.picosTot.shift();
    medidor.chamadasMedia = medidor.chamadasMedia * 0.9 + medidor.chamadas * 0.1;
    janela.push(t); while (janela.length && t - janela[0] > 1) janela.shift();
    quadros++;
    if (t - ultimaUI > 0.25) { ultimaUI = t; atualizaUI(total); }
    if (!reduzido || estado.forcar) requestAnimationFrame(loop);
  }
  function fmtV(k) { var v = (cenaAtual.msVersao || {})[k]; return v == null ? '– (abra a versão)' : v.toFixed(2) + ' ms (≈ ' + (v * 4).toFixed(2) + ' no celular)'; }
  function atualizaUI() {
    var max = 2, tot = 0, totPico = 0;
    for (var k in camadas) {
      var L = camadas[k], tr = linhas[k], tds = tr.children, pico = Math.max.apply(null, L.picos.concat([0]));
      tds[1].textContent = L.ativo ? L.ms.toFixed(3) : 'desligada';
      tds[2].textContent = L.ativo ? pico.toFixed(2) : '–';
      var bar = tds[3].firstChild.firstChild, pct = Math.min(100, L.ms / max * 100 * 4);
      bar.style.width = (L.ativo ? pct : 0) + '%'; bar.className = pct > 100 ? 'estouro' : pct > 50 ? 'alto' : '';
      tot += L.ativo ? L.ms : 0; totPico = Math.max(totPico, pico);
    }
    el('totMs').textContent = medidor.total.toFixed(3);
    el('totPico').textContent = Math.max.apply(null, medidor.picosTot.concat([0])).toFixed(2);
    var pctT = Math.min(100, medidor.total * 4 / max * 100), tb = el('totBarra');
    tb.style.width = pctT + '%'; tb.className = pctT > 100 ? 'estouro' : pctT > 50 ? 'alto' : '';
    var anim = 0; for (k in camadas) if (k !== 'fundo' && camadas[k].ativo) anim += camadas[k].ms;
    el('resumo').innerHTML =
      '<span>quadros/s: <b>' + janela.length + '</b></span>' +
      '<span>animações: <b>' + anim.toFixed(2) + ' ms</b> aqui, <b>≈ ' + (anim * 4).toFixed(2) + ' ms</b> num celular médio (×4, se aberto no computador) de 2 ms</span>' +
      '<span>por versão: atual <b>' + fmtV('atual') + '</b> · mais movimento <b>' + fmtV('mais') + '</b></span>' +
      '<span>quadro inteiro (com a cópia ampliada): <b>' + medidor.total.toFixed(2) + ' ms</b></span>' +
      '<span>chamadas de desenho: <b>' + Math.round(medidor.chamadasMedia) + '</b> de 300</span>' +
      '<span>partículas: <b>' + medidor.particulas + '</b> de 150</span>' +
      '<span>escala: <b>' + escala + '×</b> (' + cenaAtual.W + '×' + cenaAtual.H + ' px de arte)</span>';
  }

  function carrega() {
    var nomes = Object.keys(A.imagens), falta = nomes.length;
    nomes.forEach(function (n) {
      var im = new Image(); im.onload = function () { IMG[n] = im; if (--falta === 0) pronto(); }; im.src = A.imagens[n];
    });
    // moldes: PNG em cinza → mapa de papéis (como o decodificaMolde do sprites.js)
    Object.keys(A.moldes).forEach(function (k) {
      var M = A.moldes[k]; M.nome = k;
      ['retrato', 'parado'].forEach(function (est) {
        falta++;
        var im = new Image(); im.onload = function () {
          var c = tela(64, 64), cg = c.getContext('2d'); cg.drawImage(im, 0, 0);
          var d = cg.getImageData(0, 0, 64, 64).data, idx = new Uint8Array(4096);
          for (var i = 0; i < 4096; i++) idx[i] = d[i * 4 + 3] < 128 ? 0 : Math.round(d[i * 4] / 25);
          M[est] = idx; if (--falta === 0) pronto();
        };
        im.src = M.png[est];
      });
    });
  }
  function pronto() {
    var nav = el('cenas');
    ORDEM.forEach(function (id) {
      var b = botao(CENAS[id].titulo, false, function () { trocaCena(id); });
      b.dataset.cena = id; nav.appendChild(b);
    });
    var ini = 'litoral'; try { var m = localStorage.getItem('galope-animacao:cena'); if (CENAS[m]) ini = m; } catch (e) {}
    var q = /[?&]cena=(\w+)/.exec(location.search) || /#(\w+)/.exec(location.hash); if (q && CENAS[q[1]]) ini = q[1];
    trocaCena(ini);
    window.addEventListener('resize', ajustaCanvas);
    if (reduzido) {   // movimento reduzido: mostra parado e oferece ligar
      var aviso = botao('Ligar a animação (o sistema pede movimento reduzido)', false, function (b) { estado.forcar = true; b.remove(); requestAnimationFrame(loop); });
      el('ctlCena').prepend(aviso);
      loop();
    } else requestAnimationFrame(loop);
    window.__animacao = { estado: estado, CENAS: CENAS, trocaCena: trocaCena, medidor: medidor, camadas: function () { return camadas; } };
  }
  carrega();
})();
