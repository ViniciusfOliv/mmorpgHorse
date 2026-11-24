// prototype/arte/animacao.js — interface da amostra de animação ambiente (entrega 1 da frente de animação; o build é
// prototype/tools/arte-animacao-build.mjs, que embute prototype/src/ambiente.js, este arquivo e os PNGs em
// prototype/arte/animacao-amostra.html). O motor e as cenas estão em prototype/src/ambiente.js (etapa 1 do plano).
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
  var E = window.Ambiente, A = E.dados(window.__ANIM);
  // o motor e as cenas estão em prototype/src/ambiente.js (etapa 1); aqui fica só a interface da amostra
  var CENAS = E.CENAS, estado = E.estado, medidor = E.medidor, IMG = E.IMG, Camada = E.Camada, tela = E.tela;
  E.config({ pilotoCanvas: document.getElementById('piloto') });
  var MAIS = false;

  // ================================================================ interface
  var ORDEM = ['litoral', 'planalto', 'fornalha', 'expedicao', 'cavalos'];
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
    if (c.id === 'cavalos') tamanhoPiloto();
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
    planalto: 'Rotor mais rápido nas rajadas fortes, araucárias balançando mais, revoada.',
    fornalha: 'Jorro de lava a cada estouro (2,5–4,5 s), mais bombas e fumaça; bolhas que estouram no fosso; mais brasas.',
    expedicao: 'Jorro de lava no vulcão, mais fumaça e bombas; espuma de corredeira no rio; placas girando mais; capim com rajadas fortes; revoada sobre o vale; folhas em redemoinho.',
    cavalos: 'Gestos a cada 1–3,5 s e mais fortes, gestos que se juntam (cauda junto com outro), sacudir a cabeça; borboletas, folhas soltas e revoada.'
  };
  // vegetação e água que mexem o tempo todo, não só nas rajadas (pedido do Vinicius, 2026-11-23)
  var CONTINUO = {
    litoral: 'Folhas dos coqueiros ondulando da coroa para as pontas, capim da praia numa onda que não para, espuma correndo na mureta e o mar com brilho e ondulação.',
    expedicao: 'Copas das matas e dos pinheiros balançando 1 px na faixa de cima, fora de fase; capim em onda contínua; linhas de espuma descendo o rio.',
    planalto: 'Araucárias balançando na copa e capim alto em onda contínua.',
    cavalos: 'Pasto com faixas de brilho que correm (o vento no campo) e as copas das árvores balançando.',
    fornalha: 'Sem vegetação nem água: a lava do fosso e das encostas já corre o tempo todo.'
  };
  function montaNotas(cena) {
    el('notas').innerHTML = cena.notas.map(function (n) { return '<li>' + n + '</li>'; }).join('') +
      '<li><span class="tag mais">mais movimento</span> ' + NOTAS_MAIS[cena.id] + '</li>' +
      (CONTINUO[cena.id] ? '<li><span class="tag mais">sempre</span> ' + CONTINUO[cena.id] + '</li>' : '');
  }
  function montaControles(cena) {
    var ctl = el('ctlCena'); ctl.innerHTML = '';
    // Atual (a principal, aprovada) × Mais movimento (para comparar)
    // a "mais movimento" foi a escolhida pelo Vinicius (2026-11-23) e abre por padrão; a anterior fica para comparar
    if (cena.mais == null) cena.mais = true;
    var bM = botao('Mais movimento (escolhida)', !!cena.mais, function () { cena.mais = true; bM.setAttribute('aria-pressed', 'true'); bA.setAttribute('aria-pressed', 'false'); }),
      bA = botao('Versão anterior', !cena.mais, function () { cena.mais = false; bA.setAttribute('aria-pressed', 'true'); bM.setAttribute('aria-pressed', 'false'); });
    var grupo = document.createElement('div'); grupo.className = 'estilo'; grupo.setAttribute('role', 'group'); grupo.setAttribute('aria-label', 'Versão');
    grupo.appendChild(bM); grupo.appendChild(bA); ctl.appendChild(grupo);
    if (cena.id === 'litoral' || cena.id === 'planalto') {
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
  var ROTULO_PILOTO = { 'comer-8102': 'Comer', 'comer-8101': 'Comer (seed B)', 'cavar-8111': 'Cavar', 'cavar-8112': 'Cavar (seed B)', 'cauda-8121': 'Cauda', 'respira-8131': 'Respiração', 'cavarJ-8111': 'Cavar com jóquei', 'cavarJ-8113': 'Cavar com jóquei' };
  var NOME_PORTE = { esguio: 'Esguio', padrao: 'Padrão', robusto: 'Robusto' }, NOME_CRINA = { lisa: 'lisa', chamas: 'chamas', ondas: 'ondas', folhas: 'folhas' };
  function montaPiloto(c) {
    var ctl = el('ctlPiloto'), pl = c.pl; ctl.innerHTML = '';
    // seletor dos 12 moldes (o lote pago: comer e cavar em todos)
    var rot = document.createElement('label'); rot.className = 'sel'; rot.textContent = 'Molde ';
    var sel = document.createElement('select'); sel.id = 'moldePiloto';
    Object.keys(A.pilotoIdx).sort().forEach(function (mol) { var o = document.createElement('option'); o.value = mol; var p = mol.split('-'); o.textContent = NOME_PORTE[p[0]] + ', crina ' + NOME_CRINA[p[1]]; if (mol === pl.molde) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', function () { pl.trocaMolde(sel.value); montaPiloto(c); });
    rot.appendChild(sel); ctl.appendChild(rot);
    var bs = [];
    var seq = botao('Todas em sequência', pl.seq, function () { pl.seq = true; pl.fila = 0; pl.atual = pl.ordem[0]; pl.t0 = agora(); marca(seq); });
    ctl.appendChild(seq); bs.push(seq);
    pl.ordem.forEach(function (k) {
      var b = botao(ROTULO_PILOTO[k] || k, false, function () { pl.seq = false; pl.atual = k; pl.t0 = agora(); marca(b); });
      ctl.appendChild(b); bs.push(b);
    });
    function marca(b) { bs.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); }
    tamanhoPiloto();
  }
  function tamanhoPiloto() {
    var cv = el('piloto'), dpr = window.devicePixelRatio || 1;
    cv.width = 256 * escala; cv.height = 88 * escala; cv.style.width = (256 * escala / dpr) + 'px'; cv.style.height = (88 * escala / dpr) + 'px';
  }
  function trocaCena(id) {
    var c = CENAS[id]; c.id = id; estado.cena = id;
    if (!c.pronta) { c.init(); c.pronta = true; }
    cenaAtual = c;
    buf = tela(c.W, c.H); E.usa(buf.getContext('2d'));
    el('legenda').textContent = c.legenda;
    montaNotas(c);
    Array.prototype.forEach.call(el('cenas').children, function (b) { b.setAttribute('aria-pressed', b.dataset.cena === id ? 'true' : 'false'); });
    montaMedidor(c); montaControles(c); ajustaCanvas();
    var temPiloto = id === 'cavalos' && c.pl && c.pl.ordem.length;
    el('painelPiloto').hidden = !temPiloto;
    if (temPiloto) montaPiloto(c);
    try { localStorage.setItem('galope-animacao:cena', id); } catch (e) {}
  }
  var T0 = performance.now();
  function agora() { return (performance.now() - T0) / 1000; }

  var janela = [], ultimoT = 0, ultimaUI = 0, quadros = 0;
  var reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop() {
    var t = agora(), dt = Math.min(0.05, t - ultimoT || 0.016); ultimoT = t;
    var corrida = estado.cena === 'litoral' || estado.cena === 'planalto';
    if (estado.camera && corrida) estado.cam += dt * 16 * 12; else if (corrida) estado.cam = 0;
    medidor.chamadas = 0; medidor.particulas = 0;
    var t0 = performance.now();
    for (var k in camadas) camadas[k].acc = 0;
    MAIS = !!cenaAtual.mais; E.mais(MAIS);
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
      '<span>por versão: mais movimento <b>' + fmtV('mais') + '</b> · anterior <b>' + fmtV('atual') + '</b></span>' +
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
    // piloto pago: quadros em cinza → mapa de papéis, como os moldes
    A.pilotoIdx = {};   // molde → ação-seed → quadros (mapas de papéis)
    Object.keys(A.piloto || {}).forEach(function (mol) {
      A.pilotoIdx[mol] = {};
      Object.keys(A.piloto[mol]).forEach(function (k) {
        A.pilotoIdx[mol][k] = [];
        A.piloto[mol][k].forEach(function (u, q) {
          falta++;
          var im = new Image(); im.onload = function () {
            var c = tela(64, 64), cg = c.getContext('2d'); cg.drawImage(im, 0, 0);
            var d = cg.getImageData(0, 0, 64, 64).data, idx = new Uint8Array(4096);
            for (var i = 0; i < 4096; i++) idx[i] = d[i * 4 + 3] < 128 ? 0 : Math.round(d[i * 4] / 25);
            A.pilotoIdx[mol][k][q] = idx; if (--falta === 0) pronto();
          };
          im.src = u;
        });
      });
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
    window.__animacao = { estado: estado, CENAS: CENAS, trocaCena: trocaCena, medidor: medidor, camadas: function () { return camadas; }, setMais: function (v) { MAIS = !!v; E.mais(MAIS); } };
  }
  carrega();
})();
