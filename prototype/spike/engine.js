/*
 * engine.js — spike do teste de engine (2026-11-19). DESCARTÁVEL: não é código do jogo.
 *
 * Uma corrida sintética no pior caso visual do lançamento, desenhada com o código real do jogo (window.Sprites e
 * window.RaceFx, embutidos sem alteração pelo gerar-engine.mjs) mais as camadas que o jogo ainda não tem e que
 * queremos medir: parallax em bitmaps, partículas (explosões de skill e torrões), câmera com zoom e tremida.
 * Nada aqui é regra: as posições são funções do tempo (sem sim.js) e os "sorteios" são hashes fixos (sem Math.random).
 *
 * Gancho para o Playwright: window.__spikeEngine = { pronto, bateria(opts) -> Promise<resultado>, cfg, aplicar(cfg) }.
 */
(function () {
  'use strict';
  var SP = window.Sprites, FX = window.RaceFx, GD = window.GameData;
  var VERSAO = 'spike-engine v4 (2026-11-24)';
  function el(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hsh(i, s) { var x = Math.sin(i * 127.1 + (s || 0) * 311.7) * 43758.5453; return x - Math.floor(x); }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ===================================================================
  // Configuração (o que os botões mudam)
  // ===================================================================
  // v4 (2026-11-24, animação ambiente, etapa 6): o cenário é o das regiões do jogo (CFG.regiao), com a camada 'ambiente'
  // (a região viva do ambiente.js) e o que a etapa 0 pôs na corrida (sombra opaca, contato, sombra da cerca, poeira de
  // pouso, luz do clima nos cavalos). O parallax extra da v3 (ambição de 2026-11-19) fica desligado por padrão: as
  // camadas da região já são o parallax do jogo.
  var CAMADAS = ['cenario', 'ambiente', 'parallax', 'clima', 'poeira', 'skills', 'camera', 'hud'];
  var CFG = { n: 12, escala: 'jogo', clima: 'ciclo', limite: 'livre', regiao: 'litoral', camadas: {} };   // limite '60': desenha no máximo a 60 FPS
  CAMADAS.forEach(function (c) { CFG.camadas[c] = c !== 'parallax'; });
  var CLIMAS = ['sol', 'chuva', 'nevoa', 'nublado'];
  var CANVAS_MAX_PX = 1500000;   // o mesmo teto do game.js

  // ===================================================================
  // Pista (sintética) e elenco
  // ===================================================================
  var D = 3000, VEL = 50, VOLTA = 58;   // metros, m/s "de tela", segundos até recomeçar
  var BLOCOS = [
    { type: 'reta', from: 0, to: 300 }, { type: 'curva', from: 300, to: 650 }, { type: 'reta', from: 650, to: 1000 },
    { type: 'subida', from: 1000, to: 1250 }, { type: 'reta', from: 1250, to: 1600 }, { type: 'curva', from: 1600, to: 2000 },
    { type: 'reta', from: 2000, to: 2350 }, { type: 'subida', from: 2350, to: 2600 }, { type: 'reta', from: 2600, to: 3000 }
  ];
  function faixas(tipo) { return BLOCOS.filter(function (b) { return b.type === tipo; }).map(function (b) { return [b.from, b.to]; }); }
  var CURVAS = FX.curveRuns(faixas('curva')), MORROS = faixas('subida');
  var MAPA = FX.trackPath(BLOCOS);
  var PISO = 'terra', VENTO = { intensity: 'ventania', dir: -1 }, SEMENTE = 20261119;
  var ELEM = ['fogo', 'agua', 'grama'];
  var RARIDADES = ['mitico', 'lendario', 'raro', 'magico', 'comum', 'raro', 'mitico', 'lendario', 'magico', 'raro', 'comum', 'magico'];
  var NOMES = ['Brasa', 'Maré', 'Ipê', 'Faísca', 'Garoa', 'Cipó', 'Labareda', 'Correnteza', 'Jatobá', 'Pavio', 'Orvalho',
    'Capim', 'Fagulha', 'Tormenta', 'Aroeira', 'Tição', 'Neblina', 'Samambaia', 'Cometa', 'Riacho'];
  // skills com ícone PNG (sk-<id>) e o efeito que o fx.js desenha (vel/ace: vento; folego: "+"; curva: faíscas)
  var SKILLS = [
    { id: 'sprint', nome: 'Sprint', icon: 'vel' }, { id: 'arranque', nome: 'Arranque', icon: 'ace' },
    { id: 'segundo-ar', nome: 'Segundo Ar', icon: 'folego' }, { id: 'drift', nome: 'Drift', icon: 'curva' },
    { id: 'chama-final', nome: 'Chama Final', icon: 'vel', el: 'fogo' }, { id: 'canto-da-iara', nome: 'Canto da Iara', icon: 'folego', el: 'agua' },
    { id: 'folego-de-montanha', nome: 'Fôlego de Montanha', icon: 'folego', el: 'grama' }, { id: 'saida-rapida', nome: 'Saída Rápida', icon: 'ace' },
    { id: 'arrancada-final', nome: 'Arrancada Final', icon: 'vel' }, { id: 'casco-firme', nome: 'Casco Firme', icon: 'curva' }
  ];
  var CAV = [];
  for (var j0 = 0; j0 < 20; j0++) {
    var e0 = ELEM[j0 % 3];
    CAV.push({
      nome: NOMES[j0], el: e0, palette: SP.randomPalette(1000 + j0 * 17, e0), silks: SP.SILKS[j0 % SP.SILKS.length],
      raridade: RARIDADES[j0 % RARIDADES.length], porte: GD.PORTES.valores[(j0 * 7 + 1) % 3],
      marcas: { cara: GD.MARCAS.cara[j0 % 4], patas: (j0 * 3) % 5, corpo: GD.MARCAS.corpo[(j0 * 5 + 2) % 4] },
      semente: (Math.imul(j0 + 1, 2654435761) >>> 0), joquei: { padrao: GD.JOQUEI.padroes[j0 % 6], capacete: GD.JOQUEI.capacetes[(j0 * 3 + 1) % 8] },
      f1: hsh(j0, 1) * 6.28, f2: hsh(j0, 2) * 6.28, off: (hsh(j0, 3) - 0.5) * 12
    });
  }
  function posDe(j, t) { var c = CAV[j]; return VEL * t + 9 * Math.sin(0.21 * t + c.f1) + 5 * Math.sin(0.53 * t + c.f2) + c.off; }
  function velDe(j, t) { var c = CAV[j]; return VEL + 9 * 0.21 * Math.cos(0.21 * t + c.f1) + 5 * 0.53 * Math.cos(0.53 * t + c.f2); }

  // ===================================================================
  // Canvas, layout (as regras do game.js: 2 px CSS por pixel de arte, raias de 13 a 26)
  // ===================================================================
  var cv = el('tela'), ctxTela = cv.getContext('2d', { alpha: false });
  var mundo = document.createElement('canvas'), ctxMundo = mundo.getContext('2d', { alpha: false });
  var CHAM = { n: 0 };
  [ctxTela, ctxMundo].forEach(function (c) {   // conta fillRect + drawImage por quadro (só os desta página)
    var fr = c.fillRect, di = c.drawImage;
    c.fillRect = function (a, b, w, h) { CHAM.n++; return fr.call(this, a, b, w, h); };
    c.drawImage = function () { CHAM.n++; return di.apply(this, arguments); };
  });
  var L = null, PARA = null, POUSOS = [];

  function reducaoEscala(S, artPx) {
    var melhor = 1;
    if (artPx * S * S <= CANVAS_MAX_PX) return 1;
    for (var d = 2; S / d >= 2; d++) {
      if (S % d || !SP.escalaMoldeCompativel(S, S / d)) continue;
      melhor = d;
      if (artPx * (S / d) * (S / d) <= CANVAS_MAX_PX) break;
    }
    return melhor;
  }

  function montar() {
    var dpr = Math.max(1, window.devicePixelRatio || 1), n = CFG.n;
    var cssW = el('palco').clientWidth || 360;
    var cssH = clamp(Math.round((window.innerHeight || 700) * 0.5), 220, 560);
    var artW = Math.floor(cssW / 2), artH0 = Math.floor(cssH / 2);
    var mw = clamp(Math.round(artW * 0.2), 40, 72), mini = { x: 2, y: 18, w: mw, h: clamp(Math.round(mw * 0.45), 22, 30) };
    var hudH = Math.max(20 + Math.min(n, 12), mini.y + mini.h + 2), bottom = 14, minTop = hudH + 30;
    var lane = clamp(Math.floor((artH0 - bottom - minTop) / n), 13, 26);
    var top = Math.max(minTop, Math.min(artH0 - bottom - n * lane, minTop + 70));
    var artH = top + n * lane + bottom;
    var Sn = Math.max(1, Math.round(2 * dpr)), S;
    if (CFG.escala === '1x') S = 1;
    else if (CFG.escala === '2x') S = 2;
    else if (CFG.escala === '3x') S = 3;   // a menor escala em que os moldes (1,5 px de molde por pixel de arte) ficam iguais
    else if (CFG.escala === 'nativo') S = Sn;
    else S = Sn / reducaoEscala(Sn, artW * artH);
    L = {
      dpr: dpr, cssW: cssW, artW: artW, artH: artH, S: S, Sn: Sn, n: n, lane: lane, top: top, hudH: hudH, mini: mini,
      maxLift: clamp(top - hudH - 12, 4, 24), arcoK: clamp(top + lane - 3 - (SP.FOOT_Y + 1), 0, FX.CURVA.tela) / FX.CURVA.tela,
      ppmArt: artW < 260 ? 2 : 2.5, W: artW * S, H: artH * S, me: Math.floor(n / 2)
    };
    cv.width = L.W; cv.height = L.H; mundo.width = L.W; mundo.height = L.H;
    cv.style.width = (artW * 2) + 'px'; cv.style.height = (artH * 2) + 'px'; cv.style.margin = '0 auto';
    ctxTela.imageSmoothingEnabled = false; ctxMundo.imageSmoothingEnabled = false;
    // cada cavalo montado já na largada, como o game.js (Sprites.prepararCavalo: parado e galope recoloridos)
    SP.limparCacheMoldes();
    for (var j = 0; j < n; j++) CLIMAS.forEach(function (cl) { var o = opcoesCavalo(j, 0, false, 0); o.clima = cl; SP.prepararCavalo(o); });
    POUSOS = []; for (j = 0; j < n; j++) POUSOS.push({ q: -1, lista: [] });
    if (SP.regiaoPronta(CFG.regiao)) {
      SP.prepararRegiao(CFG.regiao, ['nublado', 'chuva', 'nevoa']);
      if (CFG.camadas.ambiente && SP.prepararRegiaoViva) SP.prepararRegiaoViva(CFG.regiao, CFG.clima === 'ciclo' ? CLIMAS : [CFG.clima]);
    }
    PARA = gerarParallax();
    ORD.html = '';
  }

  function opcoesCavalo(j, frame, idle, t) {
    var c = CAV[j];
    return {
      palette: c.palette, element: c.el, frame: frame, scale: L.S, silks: c.silks, t: t, idle: idle,
      marcas: c.marcas, semente: c.semente, joquei: c.joquei, raridade: c.raridade, rastro: true, reduzido: false, porte: c.porte
    };
  }

  // ===================================================================
  // Parallax extra: três faixas pré-desenhadas (bitmaps) que andam em velocidades diferentes
  // ===================================================================
  function faixaCanvas(wArt, hArt, desenha) {
    var c = document.createElement('canvas'), S = L.S;
    c.width = wArt * S; c.height = hArt * S;
    var x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    desenha(function (ax, ay, w, h, cor) { x.fillStyle = cor; x.fillRect(ax * S, ay * S, w * S, h * S); }, wArt, hArt);
    return c;
  }
  function gerarParallax() {
    var w = L.artW * 2, r = rng(SEMENTE);
    // serra distante com neve (fica atrás, com véu)
    var serra = faixaCanvas(w, 40, function (R, W, H) {
      var alt = 0;
      for (var x = 0; x < W; x++) {
        var u = x / W * Math.PI * 2;
        alt = Math.round(18 + 9 * Math.sin(u * 3) + 6 * Math.sin(u * 7 + 1.3) + 3 * Math.sin(u * 17 + 0.4));
        R(x, H - alt, 1, alt, '#4d6a8a');
        R(x, H - alt, 1, Math.max(1, Math.round(alt * 0.18)), '#dfe8f2');
        if (x % 3 === 0) R(x, H - alt + 3, 1, Math.round(alt * 0.5), '#3f5a78');
      }
    });
    // bosque (copas em degraus)
    var bosque = faixaCanvas(w, 22, function (R, W, H) {
      R(0, H - 4, W, 4, '#1f4a2c');
      for (var x = 0; x < W; x += 5 + Math.floor(r() * 4)) {
        var h = 8 + Math.floor(r() * 12), lg = 5 + Math.floor(r() * 4);
        R(x + Math.floor(lg / 2), H - 4, 1, 4, '#3a2a1c');
        R(x, H - h, lg, h - 3, '#2c6b3a');
        R(x + 1, H - h - 2, lg - 2, 2, '#2c6b3a');
        R(x + 1, H - h, 2, 2, '#4f9a52');
        R(x + lg - 2, H - h + 3, 1, h - 7, '#1f4a2c');
      }
    });
    // primeiro plano: moitas, flores e mourões (passa na frente da última raia, mais rápido que a pista)
    var frente = faixaCanvas(w, 14, function (R, W, H) {
      for (var x = 0; x < W; x += 3 + Math.floor(r() * 6)) {
        var h = 4 + Math.floor(r() * 9), lg = 4 + Math.floor(r() * 6);
        R(x, H - h, lg, h, '#24502e'); R(x + 1, H - h - 1, lg - 2, 1, '#24502e'); R(x + 1, H - h, 2, 1, '#4c8f4a');
        if (r() < 0.35) R(x + 2, H - h - 2, 1, 1, ['#ff6b5e', '#f2c230', '#f1e9d4'][Math.floor(r() * 3)]);
      }
      for (var p = 10; p < W; p += 37) { R(p, H - 12, 2, 12, '#6b4a2b'); R(p, H - 12, 2, 1, '#8a6440'); }
    });
    return { serra: serra, bosque: bosque, frente: frente };
  }
  function desenhaFaixa(ctx, c, fator, camPx, yBase, alpha) {
    var w = c.width, x = -((camPx * fator) % w);
    if (x > 0) x -= w;
    x = Math.round(x / L.S) * L.S;
    var prev = ctx.globalAlpha; ctx.globalAlpha = alpha;
    for (; x < L.W; x += w) ctx.drawImage(c, x, yBase - c.height);
    ctx.globalAlpha = prev;
  }

  // ===================================================================
  // Partículas (explosões de skill, anéis e torrões): pool de tamanho fixo, sem alocação por quadro
  // ===================================================================
  var PMAX = 8000;
  var P = { n: 0, x: new Float32Array(PMAX), y: new Float32Array(PMAX), vx: new Float32Array(PMAX), vy: new Float32Array(PMAX),
    vida: new Float32Array(PMAX), max: new Float32Array(PMAX), g: new Float32Array(PMAX), tam: new Uint8Array(PMAX), cor: new Uint8Array(PMAX) };
  var CORES = ['#ffd36b', '#ff8a4c', '#ff4a2a', '#bfe9ff', '#62b8ff', '#2a7fd8', '#d8ffb0', '#86d86a', '#3f9a3a', '#7a5534', '#5a3c22', '#ffffff', '#f2c230'];
  var COR_EL = { fogo: [0, 1, 2], agua: [3, 4, 5], grama: [6, 7, 8] };
  var ANEIS = [], prng = rng(77);
  function emite(x, y, vx, vy, vida, g, tam, cor) {   // x, y em pixels de arte do mundo (x preso ao chão)
    if (P.n >= PMAX) return;
    var i = P.n++;
    P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy; P.vida[i] = vida; P.max[i] = vida; P.g[i] = g; P.tam[i] = tam; P.cor[i] = cor;
  }
  function explosao(xw, yw, elem) {
    var cs = COR_EL[elem] || [12, 11, 0];
    for (var k = 0; k < 48; k++) {
      var a = prng() * Math.PI * 2, v = 30 + prng() * 80;
      emite(xw, yw, Math.cos(a) * v + VEL * 0.3 * L.ppmArt, Math.sin(a) * v - 20, 0.45 + prng() * 0.5, 90, prng() < 0.3 ? 2 : 1, cs[k % 3]);
    }
    for (var s = 0; s < 10; s++) emite(xw, yw, (prng() - 0.5) * 30 + VEL * 0.5 * L.ppmArt, -40 - prng() * 50, 0.9 + prng() * 0.4, 20, 1, 11);
    ANEIS.push({ x: xw, y: yw, t: 0, cor: CORES[cs[1]] });
    CAM.tremida = Math.min(4, CAM.tremida + 1.6);
  }
  function atualizaParticulas(dt) {
    var i = 0;
    while (i < P.n) {
      P.vida[i] -= dt;
      if (P.vida[i] <= 0) {   // tira trocando com o último
        var u = --P.n;
        P.x[i] = P.x[u]; P.y[i] = P.y[u]; P.vx[i] = P.vx[u]; P.vy[i] = P.vy[u]; P.vida[i] = P.vida[u]; P.max[i] = P.max[u]; P.g[i] = P.g[u]; P.tam[i] = P.tam[u]; P.cor[i] = P.cor[u];
        continue;
      }
      P.vy[i] += P.g[i] * dt; P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt;
      i++;
    }
    for (var a = ANEIS.length - 1; a >= 0; a--) { ANEIS[a].t += dt; if (ANEIS[a].t > 0.45) ANEIS.splice(a, 1); }
  }
  function desenhaParticulas(ctx, camArt) {
    var S = L.S, corAtual = -1, alfaAtual = -1;
    for (var i = 0; i < P.n; i++) {
      var sx = Math.round(P.x[i] - camArt), sy = Math.round(P.y[i]);
      if (sx < -2 || sx > L.artW + 2 || sy < -2 || sy > L.artH) continue;
      var al = Math.ceil(P.vida[i] / P.max[i] * 4) / 4;   // 4 degraus de alfa: menos trocas de estado
      if (al !== alfaAtual) { ctx.globalAlpha = al; alfaAtual = al; }
      if (P.cor[i] !== corAtual) { ctx.fillStyle = CORES[P.cor[i]]; corAtual = P.cor[i]; }
      ctx.fillRect(sx * S, sy * S, P.tam[i] * S, P.tam[i] * S);
    }
    ctx.globalAlpha = 1;
    ANEIS.forEach(function (a) {   // anel quadrado (octógono de 8 traços) que cresce e some
      var r = Math.round(4 + a.t / 0.45 * 22), cx = Math.round(a.x - camArt), cy = Math.round(a.y), q = Math.round(r * 0.7);
      ctx.globalAlpha = 1 - a.t / 0.45; ctx.fillStyle = a.cor;
      ctx.fillRect((cx - q) * S, (cy - r) * S, 2 * q * S, S); ctx.fillRect((cx - q) * S, (cy + r) * S, 2 * q * S, S);
      ctx.fillRect((cx - r) * S, (cy - q) * S, S, 2 * q * S); ctx.fillRect((cx + r) * S, (cy - q) * S, S, 2 * q * S);
      ctx.fillRect((cx - r + 1) * S, (cy - q - 1) * S, S, S); ctx.fillRect((cx + r - 1) * S, (cy - q - 1) * S, S, S);
      ctx.fillRect((cx - r + 1) * S, (cy + q + 1) * S, S, S); ctx.fillRect((cx + r - 1) * S, (cy + q + 1) * S, S, S);
    });
    ctx.globalAlpha = 1;
  }

  // ===================================================================
  // Skills: uma "onda" a cada 2 s com 3 a 5 cavalos (efeito de 2,6 s, balão de 1,5 s, explosão na ativação)
  // ===================================================================
  var ITENS = [], ondaFeita = -1;
  function geraOndas(T) {
    var k = Math.floor(T / 2);
    while (ondaFeita < k) {
      ondaFeita++;
      var quantos = 3 + (ondaFeita % 3), usados = {};
      for (var q = 0; q < quantos; q++) {
        var j = Math.floor(hsh(ondaFeita * 7 + q, 9) * L.n), tent = 0;
        while (usados[j] && tent++ < L.n) j = (j + 1) % L.n;
        usados[j] = true;
        var sk = SKILLS[Math.floor(hsh(ondaFeita, q + 20) * SKILLS.length)], c = CAV[j], t0 = ondaFeita * 2 + q * 0.12;
        ITENS.push({ kind: 'skill', t0: t0, t1: t0 + 2.6, racer: j, skillId: sk.id, icon: sk.icon, element: sk.el || c.el, cavalo: c.el,
          nome: sk.nome, nomeCurto: FX.nomeCurto(sk.nome), silks: c.silks, raia: j + 1, escala: 1, explodiu: false });
      }
      var jc = Math.floor(hsh(ondaFeita, 40) * L.n);   // um "CANSOU" por onda
      ITENS.push({ kind: 'cansou', t0: ondaFeita * 2 + 0.5, t1: ondaFeita * 2 + 2, racer: jc, silks: CAV[jc].silks, raia: jc + 1, escala: 1 });
    }
    for (var i = ITENS.length - 1; i >= 0; i--) if (ITENS[i].t1 < T - 0.1) ITENS.splice(i, 1);
  }

  // ===================================================================
  // Estado da corrida, câmera
  // ===================================================================
  var R = { T: 0, gal: new Float32Array(20) }, ULT_SEC = null, SECS = ['cen', 'cav', 'efe', 'cam', 'hud'];
  var CAM = { tremida: 0 };
  var ORD = { html: '', t: -1e9, vizT: -1e9 };
  function climaEm(T) { return CFG.clima === 'ciclo' ? ['sol', 'chuva', 'nevoa'][Math.floor(T / 2) % 3] : CFG.clima; }
  function reinicia() {
    R.T = 0; ITENS = []; ondaFeita = -1; P.n = 0; ANEIS = []; CAM.tremida = 0; prng = rng(77);
    for (var j = 0; j < 20; j++) R.gal[j] = j * 1.7;
  }

  function quadro(dt) {
    var S = L.S, n = L.n, me = L.me, W = L.W, H = L.H, C = CFG.camadas;
    R.T += dt;
    var T = R.T, tc = T % VOLTA, ppm = L.ppmArt * S, visM = W / ppm;
    var pos = [], vel = [];
    for (var j = 0; j < n; j++) { pos[j] = posDe(j, tc); vel[j] = velDe(j, tc); R.gal[j] += dt * 13 * (vel[j] / 50); }
    var p = pos[me], cam = Math.max(-0.3 * visM, p - 0.48 * visM), camArt = cam * L.ppmArt;
    var camTela = { c: cam + visM / 2, meia: visM / 2 };
    var laneH = L.lane * S, laneTop = L.top * S, clima = climaEm(T);
    var chao = SP.corDoPiso(PISO, clima, CFG.regiao);   // a sombra opaca, o contato e a poeira de pouso nesse piso e clima
    function arcoArt(m) { return Math.round(-FX.curveOffsetTela(CURVAS, m, camTela) * L.arcoK) || 0; }
    if (C.skills) geraOndas(T);
    var ctx = C.camera ? ctxMundo : ctxTela;
    var tp = performance.now(), SEC = { cen: 0, cav: 0, efe: 0, cam: 0, hud: 0 };
    function marca(k) { var a = performance.now(); SEC[k] += a - tp; tp = a; }

    // ---- cenário (Sprites.drawTrack: céu, serras, arquibancada, cerca, raias, placas)
    if (C.cenario) {
      SP.drawTrack(ctx, { width: W, height: H, cameraX: cam, pxPerMeter: ppm, camPx: cam * ppm, lanes: n, laneTop: laneTop, laneH: laneH,
        surface: PISO, finishM: D, hills: MORROS, curves: CURVAS, distanceMarkersEvery: 200, t: T, weather: clima, pixel: S,
        highlightLane: me, hillMaxLift: L.maxLift, wind: VENTO, curveScale: L.arcoK, regiao: CFG.regiao === 'nenhuma' ? null : CFG.regiao, vivo: !!C.ambiente, hillRelief: !CFG.semRelevo });
      SP.drawSombraCerca(ctx, W, laneTop, cam * ppm, S, chao);
    } else {
      ctx.fillStyle = '#6fa8d8'; ctx.fillRect(0, 0, W, laneTop);
      ctx.fillStyle = '#8a6440'; ctx.fillRect(0, laneTop, W, H - laneTop);
    }
    if (C.parallax) {
      var horiz = laneTop - 22 * S;
      desenhaFaixa(ctx, PARA.serra, 0.05, cam * ppm, horiz - 10 * S, 0.8);
      desenhaFaixa(ctx, PARA.bosque, 0.12, cam * ppm, horiz - 2 * S, 1);
    }
    var natO = { weather: clima, wind: VENTO, t: T, W: W, H: H, P: S, laneTop: laneTop, trackBottom: laneTop + n * laneH, reduced: false,
      seed: SEMENTE, cam: cam * ppm, camada: 'tras', surface: PISO,
      lift: function (px) { var m = cam + px / ppm; return (SP.hillLiftAt(m, MORROS, L.maxLift) + arcoArt(m)) * S; } };
    if (C.clima) FX.drawNature(ctx, natO);

    marca('cen');
    // ---- cavalos (o mesmo passo a passo do game.js)
    var vis = [];
    for (j = 0; j < n; j++) {
      var c = CAV[j], an = SP.anchorsFor(c.el, S, 'galope', c.porte);
      var hoofM = pos[j] - (an.nose[0] - 20) / L.ppmArt;
      var lift = SP.hillLiftAt(hoofM, MORROS, L.maxLift) * S, arcoJ = arcoArt(hoofM);
      var feetY = laneTop + (j + 1) * laneH - 3 * S - lift - arcoJ * S, y = feetY - (SP.FOOT_Y + 1) * S;
      var x = Math.round(((pos[j] - cam) * ppm - an.nose[0] * S) / S) * S;
      var o = opcoesCavalo(j, R.gal[j], false, T);
      o.chao = chao; o.clima = clima;
      var caixa = SP.horseBox(x, y, o);
      if (caixa.x > W || caixa.x + caixa.w < 0) continue;
      var meus = [];
      if (C.skills) for (var ii = 0; ii < ITENS.length; ii++) if (ITENS[ii].racer === j && T >= ITENS[ii].t0 && T < ITENS[ii].t1) meus.push(ITENS[ii]);
      // aura da skill de tipo: o terço da pista em que o pelotão está é de um elemento; os cavalos dele acendem
      if (C.skills && ELEM[Math.floor(T / 6) % 3] === c.el) FX.drawTypeAura(ctx, c.el, x, y, S, T + j * 0.37, false);
      if (j === me) {
        var ry = feetY - 2 * S; ctx.fillStyle = '#f2c230';
        ctx.fillRect(x + 11 * S, ry - S, 18 * S, S); ctx.fillRect(x + 11 * S, ry + 2 * S, 18 * S, S);
        ctx.fillRect(x + 8 * S, ry, 3 * S, 2 * S); ctx.fillRect(x + 29 * S, ry, 3 * S, 2 * S);
      }
      var gl = null, rastro = false;
      for (var m = 0; m < meus.length; m++) {
        if (meus[m].kind !== 'skill') continue;
        if (meus[m].icon === 'vel' || meus[m].icon === 'ace') rastro = true;
        var g1 = FX.glow(meus[m], T, false);
        if (g1 && (!gl || g1.alpha > gl.alpha)) gl = g1;
      }
      if (rastro) SP.drawTrail(ctx, x + an.rear[0] * S, y + an.rear[1] * S, c.el, T + j * 0.31, 1, S);
      if (C.poeira) {
        // poeira de pouso (etapa 0): nasce no quadro em que o casco pousa, presa ao chão, em 2 tons do chão
        var cascos = SP.cascosNaTela(x, y, o), pj = POUSOS[j];
        if (cascos && pj) {
          if (cascos.quadro !== pj.q) { if (pj.q >= 0) cascos.pousos.forEach(function (px) { pj.lista.push({ t0: T, xa: (px + cam * ppm) / S }); }); pj.q = cascos.quadro; }
          pj.lista = pj.lista.filter(function (pz) { return T - pz.t0 < FX.POUSO_S; });
          var corP = window.Luz.degrau(chao, 1), bordaP = window.Luz.degrau(chao, 2);
          pj.lista.forEach(function (pz) { FX.drawPoeiraPouso(ctx, pz.xa * S - cam * ppm, feetY, S, T - pz.t0, corP, bordaP); });
        } else FX.drawHoofDust(ctx, x + an.rear[0] * S, feetY, S, T + j * 0.37, PISO, false);
        // torrões de terra (partículas da página), presos ao chão do mundo
        var xr = (x + an.rear[0] * S) / S + camArt, yr = feetY / S;
        for (var tq = 0; tq < 2; tq++) if (prng() < dt * 6) emite(xr - prng() * 3, yr - 1, -10 - prng() * 25, -25 - prng() * 35, 0.35 + prng() * 0.25, 160, 1, prng() < 0.5 ? 9 : 10);
      }
      if (gl) SP.drawHorseSilhouette(ctx, x, y, o, gl.cor, gl.alpha);
      SP.drawHorse(ctx, x, y, o);
      if (C.cenario) SP.drawContatoRaia(ctx, caixa.x - 4 * S, caixa.x + caixa.w + 4 * S, feetY, cam * ppm, S, chao);
      for (m = 0; m < meus.length; m++) {
        FX.drawSkillAura(ctx, { x: caixa.x, y: caixa.y, w: caixa.w, h: caixa.h, S: S }, meus[m], T, false);
        if (meus[m].kind === 'skill' && !meus[m].explodiu) { meus[m].explodiu = true; explosao((caixa.x + caixa.w / 2) / S + camArt, (caixa.y + caixa.h / 2) / S, meus[m].element); }
      }
      vis.push({ j: j, x: x, y: y, an: an, caixa: caixa, meus: meus, feetY: feetY });
    }
    marca('cav');
    if (C.skills || C.poeira) { atualizaParticulas(dt); desenhaParticulas(ctx, camArt); }
    // balões (fx.js) à frente do focinho, dentro da raia
    if (C.skills) vis.forEach(function (v) {
      var b = 0;
      for (var q = v.meus.length - 1; q >= 0 && b < 3; q--) {
        var it = v.meus[q];
        if (T >= it.t0 + FX.BALAO.dur * it.escala) continue;
        var bx = Math.round(v.x / S) + v.an.nose[0] + 3 + b * 14, by = L.top + v.j * L.lane + 1;
        if (FX.drawBalloon(ctx, bx * S, by * S, S, it, T, b, null)) b++;
      }
    });
    if (C.cenario) SP.drawTrackFront(ctx);   // o primeiro plano da região (capim; vivo com o ambiente)
    if (C.parallax) desenhaFaixa(ctx, PARA.frente, 1.35, cam * ppm, H, 1);
    if (C.clima) { natO.camada = 'frente'; FX.drawNature(ctx, natO); FX.drawFogFront(ctx, natO); }
    var youV = vis.filter(function (v) { return v.j === me; })[0];
    if (youV) {
      var yx = Math.round(youV.x / S) + youV.an.nose[0] + 3, yy = Math.round(youV.y / S) + 1;
      caixaArte(ctx, Math.min(yx, L.artW - 30), yy, 26, 9, 'rgba(15,28,23,0.86)', '#f2c230');
      SP.drawText(ctx, '◀VOCÊ', (Math.min(yx, L.artW - 30) + 2) * S, (yy + 3) * S, { scale: S, color: '#f2c230' });
    }

    marca('efe');
    // ---- câmera: o mundo vai para a tela com zoom em volta do jogador e tremida das explosões
    if (C.camera) {
      var z = 1 + 0.14 * (0.5 - 0.5 * Math.cos(T * Math.PI * 2 / 8));
      CAM.tremida = Math.max(0, CAM.tremida - dt * 8);
      var tx = Math.round(Math.sin(T * 91) * CAM.tremida), ty = Math.round(Math.cos(T * 77) * CAM.tremida);
      var fx = youV ? youV.x + 20 * S : W / 2, fy = youV ? youV.y : H / 2;
      var sw = W / z, sh = H / z;
      var sx = clamp(fx - fx / z + tx * S, 0, W - sw), sy = clamp(fy - fy / z + ty * S, 0, H - sh);
      ctxTela.drawImage(mundo, sx, sy, sw, sh, 0, 0, W, H);
    }
    marca('cam');
    if (C.hud) { desenhaHud(ctxTela, pos, vel, T, clima); atualizaOrdem(pos, vel); }
    marca('hud');
    ULT_SEC = SEC;
    var natu = FX._stats.natureza || {};
    return P.n + (FX._stats.particulas || 0) + (natu.pingos || 0) + (natu.respingos || 0) + (natu.folhas || 0) + (natu.poeiraCascos || 0);
  }

  // ---- HUD em pixels de arte (o mesmo desenho do painel do topo do jogo, resumido)
  function caixaArte(ctx, x, y, w, h, bg, borda) {
    var S = L.S;
    if (borda) { ctx.fillStyle = borda; ctx.fillRect((x - 1) * S, (y - 1) * S, (w + 2) * S, (h + 2) * S); }
    ctx.fillStyle = bg; ctx.fillRect(x * S, y * S, w * S, h * S);
  }
  function txt(ctx, s, x, y, cor, esc, alinha, volatil) { SP.drawText(ctx, s, x * L.S, y * L.S, { scale: (esc || 1) * L.S, color: cor, align: alinha, shadow: '#060d0a', volatil: volatil }); }
  function desenhaHud(ctx, pos, vel, T, clima) {
    var S = L.S, A = L.artW, me = L.me;
    var ordem = ordemDe(pos), lugar = ordem.indexOf(me) + 1, big = String(lugar), bw = SP.measureText(big, 2) + 16;
    caixaArte(ctx, 2, 2, bw, 14, '#16271f', '#f2c230');
    txt(ctx, big, 5, 4, '#f2c230', 2); txt(ctx, '/' + L.n, 5 + SP.measureText(big, 2) + 2, 9, '#f1e9d4');
    var sx = 2 + bw + 5, barW = clamp(Math.floor(A * 0.28), 32, 84), segs = Math.floor(barW / 4), on = Math.round((1 - (T % VOLTA) / VOLTA) * segs);
    caixaArte(ctx, sx, 2, barW + 4, 14, '#16271f', '#060d0a'); txt(ctx, 'EST', sx + 2, 3, '#b3c2b2');
    for (var s = 0; s < segs; s++) { ctx.fillStyle = s < on ? '#7be07a' : '#060d0a'; ctx.fillRect((sx + 2 + s * 4) * S, 10 * S, 3 * S, 4 * S); }
    var seg = T % VOLTA, tTxt = Math.floor(seg / 60) + ':' + ('0' + Math.floor(seg % 60)).slice(-2) + '.' + Math.floor((seg % 1) * 10);
    var kmh = Math.round(vel[me] * 1.2) + ' KM/H', tw2 = Math.max(SP.measureText(tTxt, 1), SP.measureText(kmh, 1)) + 4;
    caixaArte(ctx, A - 2 - tw2, 2, tw2, 14, '#16271f', '#060d0a');
    txt(ctx, tTxt, A - 4, 3, '#f1e9d4', 1, 'right', true); txt(ctx, kmh, A - 4, 10, '#b3c2b2', 1, 'right', true);
    var wName = GD.WEATHERS[clima] ? GD.WEATHERS[clima].name.toUpperCase() : clima.toUpperCase();
    var ww = Math.max(SP.measureText('CLIMA', 1), SP.measureText(wName, 1)) + 4, wx = A - 2 - tw2 - 4 - ww;
    if (wx > sx + barW + 8) { caixaArte(ctx, wx, 2, ww, 14, '#16271f', '#060d0a'); txt(ctx, 'CLIMA', wx + 2, 3, '#b3c2b2'); txt(ctx, wName, wx + 2, 10, '#f1e9d4'); }
    var mc = L.mini, posM = pos.map(function (v) { return ((v % D) + D) % D; }), cores = CAV.slice(0, L.n).map(function (c) { return c.silks; });
    caixaArte(ctx, mc.x, mc.y, mc.w, mc.h, '#16271f', '#060d0a');
    FX.drawMiniMap(ctx, MAPA, posM, cores, me, { x: mc.x, y: mc.y, w: mc.w, h: mc.h, P: S, piso: '#b08a5a' });
  }
  function ordemDe(pos) {
    var o = []; for (var j = 0; j < L.n; j++) o.push(j);
    return o.sort(function (a, b) { return pos[b] - pos[a]; });
  }
  // faixa de ordem em DOM: reescrita por innerHTML quando a ordem muda (no máximo a cada 250 ms) e "vizinhos" a cada
  // 500 ms, os mesmos intervalos do game.js
  function atualizaOrdem(pos) {
    var agora = performance.now(), ordem = ordemDe(pos), me = L.me;
    var html = ordem.map(function (j, k) {
      return '<li' + (j === me ? ' class="voce"' : '') + '>' + (k + 1) + 'º<span class="chip" style="background:' + CAV[j].silks + '">' + (j + 1) + '</span></li>';
    }).join('');
    if (html !== ORD.html && agora - ORD.t >= 250) { el('ordem').innerHTML = html; ORD.html = html; ORD.t = agora; }
    if (agora - ORD.vizT >= 500) {
      ORD.vizT = agora;
      var k = ordem.indexOf(me), partes = [];
      partes.push(k > 0 ? 'À frente: ' + CAV[ordem[k - 1]].nome + ' +' + Math.round(pos[ordem[k - 1]] - pos[me]) + ' m' : 'Você lidera');
      if (k < L.n - 1) partes.push('Atrás: ' + CAV[ordem[k + 1]].nome + ' −' + Math.round(pos[me] - pos[ordem[k + 1]]) + ' m');
      el('vizinhos').textContent = partes.join(' · ');
    }
  }

  // ===================================================================
  // Medição
  // ===================================================================
  var JAN = [];   // intervalos do último segundo (medidor ao vivo)
  var GRAV = null;   // gravação da fase/rodada em curso
  function novaGravacao(nome) { return { nome: nome, cfg: copiaCfg(), res: '', inter: [], js: [], part: [], cham: [], porClima: {}, oculto: false, sec: { cen: [], cav: [], efe: [], cam: [], hud: [] } }; }
  function copiaCfg() { var c = JSON.parse(JSON.stringify(CFG)); return c; }
  function stats(g) {
    var iv = g.inter.slice().sort(function (a, b) { return a - b; }), n = iv.length;
    if (!n) return null;
    var soma = iv.reduce(function (a, b) { return a + b; }, 0), k = Math.max(1, Math.ceil(n * 0.01));
    var pior = iv.slice(n - k).reduce(function (a, b) { return a + b; }, 0) / k;
    var js = g.js.slice().sort(function (a, b) { return a - b; });
    function med(v) { return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : 0; }
    var porClima = {};
    Object.keys(g.porClima).forEach(function (cl) {
      var v = g.porClima[cl].slice().sort(function (a, b) { return a - b; }), kk = Math.max(1, Math.ceil(v.length * 0.01));
      porClima[cl] = { fps: 1000 / med(v), low: 1000 / med(v.slice(v.length - kk)), n: v.length };
    });
    return {
      quadros: n, fps: 1000 / (soma / n), low1: 1000 / pior, msMed: soma / n, msP99: iv[Math.min(n - 1, Math.floor(n * 0.99))],
      lentos: iv.filter(function (v) { return v > 20; }).length, jsMed: med(js), jsP95: js[Math.min(js.length - 1, Math.floor(js.length * 0.95))] || 0,
      part: Math.round(med(g.part)), cham: Math.round(med(g.cham)), porClima: porClima,
      sec: SECS.map(function (k) { var v = g.sec[k].slice().sort(function (a, b) { return a - b; }); return { k: k, med: med(v), p95: v[Math.min(v.length - 1, Math.floor(v.length * 0.95))] || 0, max: v[v.length - 1] || 0 }; }),
      // quadros lentos: a parte do JS que mais pesou em cada um (o JS daquele quadro passou de 12 ms)
      culpa: (function () { var c = {}; g.js.forEach(function (ms, i) { if (ms <= 12) return; var pior = null; SECS.forEach(function (k) { if (!pior || g.sec[k][i] > g.sec[pior][i]) pior = k; }); c[pior] = (c[pior] || 0) + 1; }); return c; }())
    };
  }
  var HZ = null;
  function mede(dtMs, jsMs, part) {
    JAN.push({ dt: dtMs, js: jsMs });
    var soma = 0; for (var i = JAN.length - 1; i >= 0; i--) { soma += JAN[i].dt; if (soma > 1000) { JAN.splice(0, i); break; } }
    if (GRAV && R.T > 0.5) {
      if (document.hidden) GRAV.oculto = true;
      GRAV.inter.push(dtMs); GRAV.js.push(jsMs); GRAV.part.push(part); GRAV.cham.push(CHAM.n);
      if (ULT_SEC) SECS.forEach(function (k) { GRAV.sec[k].push(ULT_SEC[k]); });
      var cl = climaEm(R.T); (GRAV.porClima[cl] = GRAV.porClima[cl] || []).push(dtMs);
    }
  }
  var medT = 0;
  function pintaMedidor(part) {
    var agora = performance.now();
    if (agora - medT < 250) return;
    medT = agora;
    var s = 0, sj = 0; JAN.forEach(function (q) { s += q.dt; sj += q.js; });
    var fps = JAN.length ? 1000 / (s / JAN.length) : 0;
    put('m-fps', fps.toFixed(0), fps >= 55 ? 'bom' : fps >= 45 ? 'meio' : 'ruim');
    var g = GRAV && stats(GRAV);
    put('m-med', g ? g.fps.toFixed(1) : '—', g ? (g.fps >= 55 ? 'bom' : g.fps >= 45 ? 'meio' : 'ruim') : '');
    put('m-low', g ? g.low1.toFixed(1) : '—', g ? (g.low1 >= 55 ? 'bom' : g.low1 >= 45 ? 'meio' : 'ruim') : '');
    put('m-ms', JAN.length ? (s / JAN.length).toFixed(1) : '—');
    put('m-js', JAN.length ? (sj / JAN.length).toFixed(1) : '—');
    put('m-res', L.W + '×' + L.H + ' S' + L.S);
    put('m-part', String(part));
    put('m-cham', String(CHAM.n));
  }
  function put(id, v, cls) { var e = el(id); if (e.textContent !== v) e.textContent = v; e.className = 'm-v' + (cls ? ' ' + cls : ''); }

  // ===================================================================
  // Laço
  // ===================================================================
  var ultimo = null, ultimoBruto = null, ACUM = 0, ultimaPart = 0, calibrando = null;
  function laco(agora) {
    window.requestAnimationFrame(laco);
    if (ultimo == null) { ultimo = agora; ultimoBruto = agora; return; }
    var bruto = agora - ultimoBruto; ultimoBruto = agora;
    if (calibrando) { ultimo = agora; if (bruto <= 250) calibrando.push(bruto); return; }
    // travado em 60: um acumulador no ritmo da tela (numa tela de 120 Hz, desenha uma batida sim, uma não). A v2 comparava
    // o tempo desde o último quadro com 13 ms: uma batida que chegava um tico cedo era pulada e o quadro saía com 25 ms
    // (3 batidas de 8,3 ms), o que derrubava o 1% low sem o jogo ter atrasado nada.
    if (CFG.limite === '60' && bruto <= 250) {
      ACUM += bruto;
      if (ACUM < 12.5) return;
      ACUM = clamp(ACUM - 1000 / 60, -4, 4);
    }
    var dtMs = agora - ultimo;
    ultimo = agora;
    if (dtMs > 250) return;   // aba escondida ou pausa longa
    var t0 = performance.now();
    CHAM.n = 0;
    FX.beginFrame();
    var part = quadro(Math.min(dtMs, 50) / 1000);
    var jsMs = performance.now() - t0;
    mede(dtMs, jsMs, part);
    ultimaPart = part;
    pintaMedidor(part);
    if (RODADA) RODADA.passo(dtMs);
  }

  function calibrar(ms) {
    return new Promise(function (ok) {
      calibrando = [];
      setTimeout(function () {
        var v = calibrando.slice(5).sort(function (a, b) { return a - b; }); calibrando = null;
        var med = v.length ? v[Math.floor(v.length / 2)] : 16.7;
        HZ = Math.round(1000 / med);
        ok(HZ);
      }, ms);
    });
  }

  // ===================================================================
  // Bateria e rodada livre
  // ===================================================================
  var TUDO = {}; CAMADAS.forEach(function (c) { TUDO[c] = c !== 'parallax'; });
  function sem(lista) { var o = {}; CAMADAS.forEach(function (c) { o[c] = lista.indexOf(c) < 0 && c !== 'parallax'; }); return o; }
  // a rodada da etapa 6 da animação ambiente (docs/teste-engine.md §7): 60 s travada em 60 FPS no pior caso do jogo
  var ETAPA6 = { nome: 'ETAPA 6: 12 cavalos, Litoral vivo, chuva + ventania, travado em 60 FPS, 60 s', n: 12, escala: 'jogo',
    camadas: TUDO, clima: 'chuva', regiao: 'litoral', limite: '60', s: 60 };
  var FASES = [
    { nome: 'PIOR CASO: 12 cavalos, escala jogo, tudo ligado', n: 12, escala: 'jogo', camadas: TUDO, limite: 'livre', s: 12 },
    { nome: 'PIOR CASO travado em 60 FPS', n: 12, escala: 'jogo', camadas: TUDO, limite: '60', s: 10 },
    { nome: '12, escala nativo, tudo', n: 12, escala: 'nativo', camadas: TUDO, limite: 'livre', s: 6 },
    { nome: '12, jogo, sem clima/poeira/skills', n: 12, escala: 'jogo', camadas: sem(['clima', 'poeira', 'skills']), limite: 'livre', s: 6 },
    { nome: '12, jogo, sem câmera (sem zoom)', n: 12, escala: 'jogo', camadas: sem(['camera']), limite: 'livre', s: 6 },
    { nome: '12, jogo, sem o ambiente vivo (camadas paradas)', n: 12, escala: 'jogo', camadas: sem(['parallax', 'ambiente']), limite: 'livre', s: 6 },
    { nome: '12, jogo, sem cenário (drawTrack)', n: 12, escala: 'jogo', camadas: sem(['cenario']), limite: 'livre', s: 6 },
    { nome: '12, escala 3x, tudo', n: 12, escala: '3x', camadas: TUDO, limite: 'livre', s: 6 },
    { nome: '12, escala 2x, tudo', n: 12, escala: '2x', camadas: TUDO, limite: 'livre', s: 6 },
    { nome: '12, escala 1x, tudo', n: 12, escala: '1x', camadas: TUDO, limite: 'livre', s: 6 },
    { nome: '20 cavalos, jogo, tudo', n: 20, escala: 'jogo', camadas: TUDO, limite: 'livre', s: 6 },
    { nome: '6 cavalos, jogo, tudo', n: 6, escala: 'jogo', camadas: TUDO, limite: 'livre', s: 6 }
  ];
  // o tempo do ambiente na fase (Sprites.statsViva e o msPor/msMax da região viva): zera no começo, lê no fim
  function vivaAtual() { try { return CFG.camadas.ambiente && CFG.regiao !== 'nenhuma' ? SP.regiaoViva(CFG.regiao, CFG.clima === 'ciclo' ? 'sol' : CFG.clima) : null; } catch (e) { return null; } }
  function zeraAmbiente() {
    var st = SP.statsViva && SP.statsViva(); if (st) { st.ms = 0; st.quadros = 0; st.por = {}; st.max = {}; }
    var v = vivaAtual(); if (v) { v.msPor = {}; v.msMax = {}; }
  }
  function leAmbiente() {
    var st = SP.statsViva && SP.statsViva(), v = vivaAtual();
    if (!st || !st.quadros) return null;
    return { q: st.quadros, ms: st.ms, por: JSON.parse(JSON.stringify(st.por)), max: JSON.parse(JSON.stringify(st.max)),
      camadas: v && v.msPor ? JSON.parse(JSON.stringify(v.msPor)) : {}, camadasMax: v && v.msMax ? JSON.parse(JSON.stringify(v.msMax)) : {} };
  }
  // diagnóstico (~80 s): liga e desliga cada parte do cenário, travado em 60 FPS, para achar o que pesa no aparelho
  var BASE6 = { n: 12, escala: 'jogo', clima: 'chuva', regiao: 'litoral', limite: '60', s: 12 };
  function fase6(nome, extra) { var f = {}; Object.keys(BASE6).forEach(function (k) { f[k] = BASE6[k]; }); Object.keys(extra || {}).forEach(function (k) { f[k] = extra[k]; }); f.nome = nome; return f; }
  var DIAG = [
    fase6('D1. tudo (como a etapa 6)', { camadas: TUDO }),
    fase6('D2. regiões paradas (sem o ambiente vivo)', { camadas: sem(['ambiente']) }),
    fase6('D3. ambiente vivo, camadas congeladas (só o que vai por cima)', { camadas: TUDO, regiaoSem: { camadas: true } }),
    fase6('D4. ambiente vivo, sem o que vai por cima (só as camadas)', { camadas: TUDO, regiaoSem: { cima: true } }),
    fase6('D5. cenário por código (sem as imagens das regiões)', { camadas: sem(['ambiente']), regiao: 'nenhuma' }),
    fase6('D6. sem cenário', { camadas: sem(['cenario', 'ambiente']) })
  ];
  // as subidas (a pista anda 50 m/s: 17 s = 850 m, um pouco antes da 1ª subida, que vai até 1.250 m)
  var SUBIDAS = [
    fase6('S1. subida com o relevo (como o jogo)', { camadas: TUDO, t0: 17, s: 20 }),
    fase6('S2. subida sem o relevo (pista plana)', { camadas: TUDO, t0: 17, s: 20, semRelevo: true })
  ];
  var RODADA = null;
  function aplicar(c) {
    if (c.n) CFG.n = c.n;
    if (c.escala) CFG.escala = c.escala;
    if (c.clima) CFG.clima = c.clima;
    if (c.limite) CFG.limite = c.limite;
    if (c.regiao) CFG.regiao = c.regiao;
    CFG.semRelevo = !!c.semRelevo;
    if (window.Ambiente) window.Ambiente.config({ regiaoSem: c.regiaoSem || {} });
    if (c.camadas) CAMADAS.forEach(function (k) { if (k in c.camadas) CFG.camadas[k] = !!c.camadas[k]; });
    montar(); reinicia(); marcaBotoes();
  }
  function rodar(fases, fator, titulo) {
    var guarda = copiaCfg(), res = [], i = -1, wake = null;
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wake = w; }, function () {}); } catch (e) { /* sem wake lock */ }
    travar(true);
    return calibrar(1000).then(function () {
      return new Promise(function (ok) {
        function proxima() {
          if (GRAV) { var st = stats(GRAV); res.push({ nome: GRAV.nome, cfg: GRAV.cfg, res: GRAV.res, oculto: GRAV.oculto, st: st, amb: leAmbiente() }); }
          i++;
          if (i >= fases.length) { GRAV = null; RODADA = null; return ok(res); }
          var f = fases[i];
          aplicar({ n: f.n || CFG.n, escala: f.escala || CFG.escala, clima: f.clima || CFG.clima, camadas: f.camadas || CFG.camadas, limite: f.limite || CFG.limite, regiao: f.regiao || CFG.regiao, regiaoSem: f.regiaoSem, semRelevo: f.semRelevo });
          if (f.t0) R.T = f.t0;   // começa noutro ponto da pista (as subidas ficam em 1.000–1.250 m e 2.350–2.600 m)
          GRAV = novaGravacao(f.nome); GRAV.res = L.W + '×' + L.H + ' (S' + L.S + ')';
          zeraAmbiente();
          var restante = f.s * 1000 * fator + 500;
          el('estado').textContent = titulo + ': fase ' + (i + 1) + ' de ' + fases.length + ' — ' + f.nome;
          RODADA = { passo: function (dt) { restante -= dt; if (restante <= 0) proxima(); } };
        }
        proxima();
      });
    }).then(function (res2) {
      try { if (wake) wake.release(); } catch (e) { /* nada */ }
      aplicar(guarda); travar(false);
      var r = { versao: VERSAO, titulo: titulo, aparelho: aparelho(), hz: HZ, fases: res2 };
      ULTIMO = r;
      el('resumo').value = textoResumo(r);
      el('estado').textContent = titulo + ' terminada. O resumo está abaixo.';
      return r;
    });
  }
  var ULTIMO = null;
  function aparelho() {
    var ua = navigator.userAgent || '';
    return {
      ua: ua, dpr: Math.max(1, window.devicePixelRatio || 1), css: (window.innerWidth || 0) + '×' + (window.innerHeight || 0),
      tela: (screen && screen.width ? screen.width + '×' + screen.height : '?'), nucleos: navigator.hardwareConcurrency || '?',
      memoria: navigator.deviceMemory || '?'
    };
  }
  function f1(v) { return v == null || !isFinite(v) ? '—' : v.toFixed(1); }
  function textoResumo(r) {
    var a = r.aparelho, linhas = [];
    linhas.push('Galope Elemental — teste de engine · ' + r.versao + ' · ' + r.titulo);
    linhas.push('Navegador: ' + a.ua);
    linhas.push('Ambiente: ' + (/; wv\)/.test(a.ua) ? 'WebView (dentro de um aplicativo)' : 'navegador') + (/Claude\//.test(a.ua) ? ', app do Claude' : ''));
    linhas.push('Tela: ' + a.css + ' css, DPR ' + a.dpr + ', tela física ' + a.tela + ', ~' + r.hz + ' Hz · núcleos ' + a.nucleos + ' · memória ' + a.memoria + ' GB');
    linhas.push('');
    linhas.push('fase | canvas | FPS méd | 1% low | ms méd | ms p99 | >20ms | JS méd/p95 | partíc. | chamadas');
    r.fases.forEach(function (f, i) {
      var s = f.st;
      if (!s) { linhas.push((i + 1) + '. ' + f.nome + ' | sem quadros'); return; }
      linhas.push((i + 1) + '. ' + f.nome + (f.oculto ? ' (ABA ESCONDIDA: descartar)' : '') + ' | ' + f.res + ' | ' + f1(s.fps) + ' | ' + f1(s.low1) + ' | ' + f1(s.msMed) +
        ' | ' + f1(s.msP99) + ' | ' + s.lentos + '/' + s.quadros + ' | ' + f1(s.jsMed) + '/' + f1(s.jsP95) + ' | ' + s.part + ' | ' + s.cham);
    });
    // cenário por fase e o ambiente por parte (média e pior, em ms por quadro)
    r.fases.forEach(function (f, i) {
      if (!f.st || !f.st.sec) return;
      var c = f.st.sec[0];
      linhas.push('cenário na fase ' + (i + 1) + ' (méd/p95/máx ms): ' + f1(c.med) + '/' + f1(c.p95) + '/' + f1(c.max));
      var a = f.amb;
      if (!a) return;
      var d2 = function (v) { return v == null ? '—' : v.toFixed(2); };
      linhas.push('  ambiente (méd/máx ms): ' + Object.keys(a.por).map(function (k) { return k + ' ' + d2(a.por[k] / a.q) + '/' + f1(a.max[k]); }).join(' · '));
      var ks = Object.keys(a.camadas);
      if (ks.length) linhas.push('  passos das camadas (méd por quadro/pior passo ms): ' + ks.map(function (k) { return k + ' ' + d2(a.camadas[k] / a.q) + '/' + f1(a.camadasMax[k]); }).join(' · '));
    });
    r.fases.forEach(function (f) {
      if (f.nome !== ETAPA6.nome || !f.st) return;
      var pct = 100 * f.st.lentos / f.st.quadros, ok1 = pct <= 1, ok2 = f.st.low1 >= 55;
      linhas.push('');
      linhas.push('Critério da etapa 6: quadros acima de 20 ms ≤ 1% → ' + f1(pct) + '% (' + (ok1 ? 'ok' : 'NÃO') + ') · 1% low ≥ 55 → ' + f1(f.st.low1) + ' (' + (ok2 ? 'ok' : 'NÃO') + ')');
      linhas.push('RESULTADO: ' + (ok1 && ok2 ? 'APROVADO' : 'REPROVADO') + (f.oculto ? ' (a aba ficou escondida: rodar de novo)' : ''));
      if (f.st.sec) linhas.push('JS por parte (méd/p95/máx ms): ' + f.st.sec.map(function (q) { return { cen: 'cenário', cav: 'cavalos', efe: 'efeitos', cam: 'câmera', hud: 'HUD' }[q.k] + ' ' + f1(q.med) + '/' + f1(q.p95) + '/' + f1(q.max); }).join(' · '));
    });
    var p = r.fases[0] && r.fases[0].st;
    if (p && r.fases[0].nome !== ETAPA6.nome) {
      linhas.push('');
      linhas.push('Por clima na fase 1: ' + Object.keys(p.porClima).map(function (k) { return k + ' ' + f1(p.porClima[k].fps) + ' (1% ' + f1(p.porClima[k].low) + ')'; }).join(' · '));
      var NOMES_SEC = { cen: 'cenário', cav: 'cavalos', efe: 'efeitos', cam: 'câmera', hud: 'HUD' };
      r.fases.forEach(function (f, i) {
        if (i > 1 || !f.st || !f.st.sec) return;
        linhas.push('JS por parte na fase ' + (i + 1) + ' (méd/p95/máx ms): ' + f.st.sec.map(function (q) { return NOMES_SEC[q.k] + ' ' + f1(q.med) + '/' + f1(q.p95) + '/' + f1(q.max); }).join(' · '));
        var cu = Object.keys(f.st.culpa);
        linhas.push('  quadros com JS > 12 ms, pela parte que mais pesou: ' + (cu.length ? cu.map(function (k) { return NOMES_SEC[k] + ' ' + f.st.culpa[k]; }).join(' · ') : 'nenhum'));
      });
      var meta = 55, trav = r.fases.filter(function (f) { return f.cfg.limite === '60' && f.st; })[0];
      var base = (r.hz || 60) > 75 && trav ? trav : r.fases[0], st0 = base.st;
      linhas.push('Critério: 1% low >= ' + meta + ' FPS em "' + base.nome + '" → ' + (st0.low1 >= meta ? 'PASSA (' + f1(st0.low1) + ')' : 'NÃO PASSA (' + f1(st0.low1) + ')'));
      r.fases.forEach(function (f) {
        if (!f.st || f.cfg.n !== 12 || (f.cfg.escala !== '3x' && f.cfg.escala !== '1x')) return;
        var lim = f.cfg.escala === '3x' ? meta : 45;
        linhas.push('  ' + f.nome + ': 1% low ' + f1(f.st.low1) + (f.st.low1 >= lim ? ' (>= ' + lim + ')' : ' (abaixo de ' + lim + ')'));
      });
    }
    return linhas.join('\n');
  }

  // ===================================================================
  // Botões
  // ===================================================================
  var travado = false;
  function travar(v) {
    travado = v;
    document.querySelectorAll('.controles button, #b-bateria, #b-livre, #b-etapa6, #b-diag, #b-subidas').forEach(function (b) { b.disabled = v; });
  }
  function marcaBotoes() {
    document.querySelectorAll('.seg').forEach(function (g) {
      var k = g.getAttribute('data-grupo');
      g.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(String(CFG[k]) === b.getAttribute('data-v'))); });
    });
    document.querySelectorAll('.liga button').forEach(function (b) { b.setAttribute('aria-pressed', String(!!CFG.camadas[b.getAttribute('data-v')])); });
  }
  document.querySelectorAll('.seg').forEach(function (g) {
    var k = g.getAttribute('data-grupo');
    g.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b || travado) return;
      var v = b.getAttribute('data-v'), c = {}; c[k] = k === 'n' ? Number(v) : v;
      aplicar(c);
    });
  });
  document.querySelector('.liga').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b || travado) return;
    var k = b.getAttribute('data-v'), c = { camadas: {} }; c.camadas[k] = !CFG.camadas[k];
    aplicar(c);
  });
  el('b-bateria').addEventListener('click', function () { rodar(FASES, 1, 'Bateria'); });
  el('b-etapa6').addEventListener('click', function () { rodar([ETAPA6], 1, 'Etapa 6'); });
  el('b-diag').addEventListener('click', function () { rodar(DIAG, 1, 'Diagnóstico'); });
  el('b-subidas').addEventListener('click', function () { rodar(SUBIDAS, 1, 'Subidas'); });
  el('b-livre').addEventListener('click', function () {
    rodar([{ nome: 'Rodada livre: ' + CFG.n + ' cavalos, escala ' + CFG.escala + ', limite ' + CFG.limite + ', camadas ' + CAMADAS.filter(function (c) { return CFG.camadas[c]; }).join('+'), s: 60 }], 1, 'Rodada livre');
  });
  el('b-copiar').addEventListener('click', function () {
    var t = el('resumo'), msg = el('copiado');
    function seleciona() { t.focus(); t.select(); msg.textContent = 'Texto selecionado: copie com o menu do aparelho.'; }
    try {
      navigator.clipboard.writeText(t.value).then(function () { msg.textContent = 'Copiado.'; }, seleciona);
    } catch (e) { seleciona(); }
  });
  var rz = null;
  window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (!travado) { montar(); } }, 200); });

  // ===================================================================
  // Partida: moldes e ícones (data:) carregados, como no game.js
  // ===================================================================
  var M = window.__ICONES || {}, prontas = {};
  Object.keys(M).forEach(function (nome) {
    var img = new Image();
    img.onload = function () { prontas[nome] = img; FX.setIconImages(prontas); };
    img.src = M[nome];
  });
  // as camadas das regiões (window.__REGIOES) e o motor do ambiente (Ambiente.regiao), como o game.js
  var REG = window.__REGIOES || {}, regProntas = {};
  Object.keys(REG).forEach(function (r) {
    var cam = REG[r].camadas || {}, reg = { posicao: REG[r].posicao || {}, camadas: {}, nevoa: REG[r].nevoa || null }, ks = Object.keys(cam), falta = ks.length;
    ks.forEach(function (k) {
      var img = new Image();
      img.onload = function () { reg.camadas[k] = img; if (--falta === 0) { regProntas[r] = reg; SP.setRegioes(regProntas); if (comecou && r === CFG.regiao && !travado) montar(); } };
      img.src = cam[k];
    });
  });
  if (window.Ambiente && SP.setAmbiente) SP.setAmbiente(function (id, imgs, lut, opts) {
    if (!window.Ambiente.REGIOES_VIVAS[id]) return null;
    window.Ambiente.dados({ manifesto: window.__ANIM_MANIFESTO });
    return window.Ambiente.regiao(id, imgs, lut, opts);
  });
  var comecou = false;
  function comeca() {
    if (comecou) return; comecou = true;
    montar(); reinicia(); marcaBotoes();
    window.requestAnimationFrame(laco);
    api.pronto = true;
  }
  var api = {
    pronto: false, cfg: CFG, aplicar: aplicar, fases: FASES, etapa6: ETAPA6, diag: DIAG, subidas: SUBIDAS,
    bateria: function (o) { o = o || {}; return rodar(o.fases || FASES, o.fator || 1, o.titulo || 'Bateria'); },
    ultimo: function () { return ULTIMO; }, texto: function () { return ULTIMO ? textoResumo(ULTIMO) : ''; },
    moldes: function () { return SP.moldsReady; }
  };
  window.__spikeEngine = api;
  SP.loadMolds(window.__MOLDES, comeca);
  setTimeout(comeca, 4000);   // sem moldes (falha ao carregar): cavalos pelo desenho por código
}());
