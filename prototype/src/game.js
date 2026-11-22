/*
 * Galope Elemental — interface jogável do protótipo (descartável).
 *
 * Depende de window.GameData (data.js), window.RaceSim (sim.js), window.Gear (gear.js),
 * window.Sprites (sprites.js) e window.RaceFx (fx.js, efeitos da corrida); no modo DEV (?dev=1 ou o build
 * de teste jogo-dev.html), também do script do modo DEV — ver a seção "Modo DEV" (o jogo de produção,
 * dist/jogo.html, sai sem ela: ver build.mjs).
 * Fluxo: Escolha do inicial -> Estábulo -> Sala de largada -> Corrida -> Resultado.
 *
 * Sala de largada: o campo (seed, condições, rivais, entrada) é sorteado UMA vez e fica salvo em
 * state.pending até ser corrido. Voltar à aba Correr ou recarregar reabre a mesma sala (sem
 * re-sorteio grátis). O Poder da sala (pareamento) é o da montaria ativa com os pontos de quando a sala
 * abriu; com páreo aberto, nenhum ponto passa desse Poder. O equipamento está suspenso (GEAR_ON, bloco 1b).
 * A corrida é calculada por RaceSim.simulate (função pura da seed) só quando o jogador aperta
 * "Largar!", depois de pagar a entrada, como um servidor faria; a tela de corrida só anima os
 * frames. Ouro e XP são liquidados nesse momento: recarregar no meio da corrida não muda nada.
 * A seed base é sorteada por save (crypto), fora da simulação.
 */
(function () {
  'use strict';

  var GD = window.GameData, RS = window.RaceSim, SP = window.Sprites, GR = window.Gear, FX = window.RaceFx, IT = window.Itens, GN = window.Ginasio;
  var telaEl = document.getElementById('tela');
  var appEl = document.getElementById('app');
  if (!GD || !RS || !SP || !GR || !FX || !IT || !GN || !telaEl) {
    if (telaEl) telaEl.textContent = 'Não foi possível carregar o jogo (faltam data.js, sim.js, gear.js, itens.js, ginasio.js, sprites.js ou fx.js).';
    return;
  }
  // Modo DEV: decidido uma vez, na carga. O código DEV fica entre marcadores de bloco "@dev" (e o gancho de
  // teste entre "@teste"), que o build tira do jogo de produção (dist/jogo.html, ver build.mjs): lá estas
  // variáveis ficam como abaixo e devHooks continua null. Fora dos blocos, nada chama código de dentro deles
  // a não ser por devHooks.
  var DV = null, DEV_MODE = false, DEV_BUILD = false, devHooks = null;
  /*@dev:inicio*/
  // ?dev=1 ou o build de teste (prototype/dist/jogo-dev.html, que traz window.__GALOPE_DEV = true: o artefato do
  // claude.ai não repassa a query). Nele o jogo só lê e grava o save de teste.
  DV = window.Dev;
  DEV_MODE = /[?&]dev=1(&|$)/.test(window.location.search) || window.__GALOPE_DEV === true;
  DEV_BUILD = window.__GALOPE_DEV === true;   // jogo-dev.html: não há "jogo real" para onde voltar
  if (DEV_MODE && !DV) {
    telaEl.textContent = 'Não foi possível carregar o jogo (falta dev.js).';
    return;
  }
  /*@dev:fim*/

  // ===========================================================================
  // Constantes
  // ===========================================================================
  var SAVE_KEY = 'galope-elemental:v1';
  /*@dev:inicio*/
  if (DEV_MODE) SAVE_KEY = DV.SAVE_KEY;   // modo DEV: só o save de teste; o real ('galope-elemental:v1') não é lido nem gravado
  /*@dev:fim*/
  var E = GD.ECONOMY;
  var GE = E.gear;
  // Equipamento suspenso (bloco 1b, spec 2026-11-12-crescimento-livre §8). A corrida, o Poder e os status já ignoram
  // as peças (sim.js). Com GEAR_ON = false:
  // - a aba Loja e a sub-aba Equipamento somem, e o resumo das peças sai do Estábulo, do Correr, da ficha e da largada;
  // - o saldo de Pedras Negras sai do cabeçalho e do Perfil;
  // - a Pedra Negra do pódio não cai (GR.podiumStone não é chamado) e os bots correm sem peças;
  // - as ações de peça (equipar, tirar, melhorar, vender, comprar) não fazem nada, nem com o botão forçado.
  // Peças, melhorias, o que está equipado e as Pedras ficam no save sem mudança: nada é vendido nem convertido.
  // O código do equipamento fica, desligado por esta constante, para voltar depois. Ligar a constante não basta: o gear
  // precisa entrar de novo na corrida (`entry`), no `powerRating` e na trava do páreo (`canEquip` hoje passaria sempre).
  var GEAR_ON = false;
  var STAT_KEYS = GD.STAT_KEYS || ['vel', 'acel', 'man', 'forca', 'est', 'garra', 'sorte'];
  var TRAINING_GOLD = [30, 22, 16, 12, 10, 10, 10, 10];
  var MIN_ENTRY = Math.min.apply(null, E.entryTiers);
  var WILD_SHOWCASE = ['w-faisca', 'w-mandacaru', 'w-ventania', 'w-fogareu', 'w-iara', 'w-boitata'];
  var TRACK_NAMES = [
    'Prado do Cerrado', 'Hipódromo da Lagoa', 'Raia do Engenho', 'Prado Beira-Rio',
    'Hipódromo do Planalto', 'Raia da Ventania', 'Prado das Palmeiras', 'Hipódromo do Sertão Velho'
  ];
  var PLAYER_NAME = 'Você';
  // Quanto a corrida dura na tela em x1, sem as câmeras lentas: TELA_S_MIN segundos numa pista de 1000 m até TELA_S_MAX
  // numa de 2400 m (em linha reta entre os dois). Só a animação: a simulação e o resultado não mudam.
  // 2026-11-18: +25% a pedido do Vinicius ("as corridas estão muito rápidas"; era de 20 a 34 s) e, no mesmo dia, mais
  // +20% ("adicione um pouco mais de tempo"): 50% acima do original.
  var TELA_S_MIN = 30, TELA_S_MAX = 51;
  // câmera da corrida e cadência do galope (guia §8a, etapa 2.4 da direção de arte): 12 px de arte por metro (o chão a
  // 16 m/s passa a ~190 px/s) e 14 quadros por segundo no ciclo de 6 do código = 21 no ciclo de 9 do molde, a 17 m/s
  var PPM_ARTE = 12, GALOPE_QPS = 14;
  var PLAYER_SILKS = '#f2c230';
  var BOT_SILKS = SP.SILKS.filter(function (c) { return c.toLowerCase() !== PLAYER_SILKS; });
  var PORTRAIT_SCALE = 3;        // escala dos retratos (portraitHtml sem opts.tamanho)
  var PORTRAIT_SCALE_PEQUENO = 2; // retrato pequeno: a linha do Estábulo (3b §4)
  // retrato grande: a cabeça da ficha (3b §5). A maior escala inteira que cabe na coluna a 360 px (288 px + a moldura no
  // palco de 324); a 360x780 a linha de abas da ficha ainda fica inteira acima da barra de abas do app (folga de 97 px)
  var PORTRAIT_SCALE_GRANDE = 6;
  var CANVAS_MAX_PX = 1500000;   // teto (pixels) do canvas da corrida antes de desenhar numa escala menor

  // Movimento: opção "Animações" do Perfil (state.settings.motion). 'sistema' (padrão) segue o
  // prefers-reduced-motion do aparelho; 'completas' e 'reduzidas' mandam. Toda checagem de movimento do
  // jogo passa por reduced() — também o CSS, pela classe html.mov-reduzido (syncMotionClass).
  var MOTIONS = ['sistema', 'completas', 'reduzidas'];
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function systemReduced() { return !!(motionQuery && motionQuery.matches); }
  // sem save (tela de escolha depois de "Recomeçar"), vale a escolha guardada em ui.motionKeep
  function motionPref() {
    var m = state ? state.settings && state.settings.motion : ui.motionKeep;
    return MOTIONS.indexOf(m) >= 0 ? m : 'sistema';
  }
  // dentro do laço de animação vale a leitura do começo do quadro (reducedQuadro): a corrida pergunta várias
  // vezes por cavalo por quadro e matchMedia não é de graça
  var reducedQuadro = null;
  function reduced() {
    if (reducedQuadro !== null) return reducedQuadro;
    var m = motionPref(); return m === 'reduzidas' || (m === 'sistema' && systemReduced());
  }
  function syncMotionClass() { document.documentElement.classList.toggle('mov-reduzido', reduced()); }
  function dpr() { return Math.max(1, window.devicePixelRatio || 1); }
  // Grade de pixel da interface (guia de arte §2): 1 pixel de arte = s pixels do aparelho, com s inteiro tal que a
  // coluna do app (até 520 px de CSS) tenha pelo menos 240 pixels de arte (com o arredondamento puro, a densidade 3
  // de 390 px dava 234 e o rótulo "Expedição" não cabia na aba); o CSS recebe --px = s / densidade e mede
  // letras, molduras e sombras em múltiplos dele (a Galmuri só fica nítida no tamanho nativo em pixels inteiros)
  var gradeS = 0;
  function aplicaGrade() {
    // a coluna fica com 240 a 479 pixels de arte; deitado (pouca altura), a altura também manda: pelo menos 300 pixels de
    // arte na vertical, senão a letra fica grande demais para a tela (780 × 360: s = 2 em vez de 4)
    var L = Math.min(window.innerWidth || 390, 520) * dpr(), A = (window.innerHeight || 844) * dpr();
    var s = Math.max(1, Math.min(Math.floor(L / 240), Math.floor(A / 300)));
    if (s === gradeS && document.documentElement.style.getPropertyValue('--px')) return;
    gradeS = s;
    document.documentElement.style.setProperty('--px', (s / dpr()) + 'px');
  }

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
      brilho: t('--brilho-33', 'rgba(255,255,255,0.33)'), brilho08: t('--brilho-08', 'rgba(255,255,255,0.08)'), holofote: t('--holofote', 'rgba(255,226,122,0.06)')
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
  // apenas no texto (nunca dentro de atributos). O sobrescrito é escondido dos leitores de tela, que leem o "º" do .sr.
  // (o .sr é absoluto: num texto cortado, o elemento que corta precisa de position: relative, senão ele estoura a
  // rolagem lateral — ex.: a narração e a faixa de ordem da corrida)
  function ordFix(html) {
    return html.replace(/>([^<]*)</g, function (m, t) { return '>' + t.replace(/º/g, '<sup class="ord" aria-hidden="true">o</sup><span class="sr">º</span>') + '<'; });
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
  // Ícone do PixelLab (window.__ICONES, embutido pelo build): <img> pixelado e decorativo. Sem o ícone
  // (ou sem o mapa), devolve o fallback (o caractere/SVG de antes), nunca um <img> quebrado.
  // Em 32 px leva também a classe icone--32 (tamanho cheio, sem redução).
  function iconeSrc(nome) {
    var m = window.__ICONES;
    if (!m || typeof m !== 'object' || !hasOwn(m, nome) || typeof m[nome] !== 'string' || !m[nome]) return '';
    return m[nome];
  }
  // Ícones da corrida (canvas): uma Image por ícone sk-*, cl-* e ui-dado; a cada onload o RaceFx recebe os que já
  // carregaram (ele só desenha o PNG quando está no cache; antes disso fica o desenho em código). Sem Image (Node): nada.
  function carregarIconesCorrida() {
    var m = window.__ICONES;
    if (typeof Image !== 'function' || !m || typeof m !== 'object') return;
    var prontas = {};
    Object.keys(m).forEach(function (nome) {
      if (!/^(sk-|cl-|ui-dado$)/.test(nome) || !iconeSrc(nome)) return;
      var img = new Image();
      img.onload = function () { prontas[nome] = img; FX.setIconImages(prontas); };
      img.src = iconeSrc(nome);
    });
  }
  carregarIconesCorrida();
  // Camadas das regiões na corrida (window.__REGIOES, embutidas pelo build; etapa 2.3 da direção de arte): uma Image por
  // camada; a cada onload o Sprites recebe as regiões (só desenha a que tem as 5 camadas; antes disso, o cenário por código)
  function carregarRegioes() {
    var m = window.__REGIOES;
    if (typeof Image !== 'function' || !m || typeof m !== 'object') return;
    var prontas = {};
    Object.keys(m).forEach(function (r) {
      var cam = m[r] && m[r].camadas;
      if (!cam || typeof cam !== 'object') return;
      var reg = { posicao: m[r].posicao || {}, camadas: {} };
      Object.keys(cam).forEach(function (k) {
        if (typeof cam[k] !== 'string') return;
        var img = new Image();
        img.onload = function () { reg.camadas[k] = img; prontas[r] = reg; SP.setRegioes(prontas); };
        img.src = cam[k];
      });
    });
  }
  carregarRegioes();
  // a região do cenário de uma corrida: a do ginásio (Fornalha no Sertão, Remanso no Litoral, Capoeira no Cerrado, as
  // mesmas paletas das arenas) ou a da pista (regioes.json, "pistas"); senão o Cerrado
  var GIN_REGIAO = { fogo: 'sertao', agua: 'litoral', grama: 'cerrado' };
  function regiaoDaPista(L) {
    var m = window.__REGIOES;
    if (L && L.regiao) return L.regiao;
    if (m && typeof m === 'object' && L) for (var r in m) if (hasOwn(m, r) && m[r] && (m[r].pistas || []).indexOf(L.trackName) >= 0) return r;
    return 'cerrado';
  }
  function iconeHtml(nome, fallback, tam) {
    var src = iconeSrc(nome);
    if (!src) return fallback || '';
    var t = tam || 16;
    return '<img class="icone icone--' + esc(nome) + (t === 32 ? ' icone--32' : '') + '" src="' + esc(src) + '" alt="" width="' + t + '" height="' + t + '">';
  }
  // Logotipo do Canva (window.__MARCA.logo): <img> com o título como alt; sem arquivo, o texto de antes.
  // width/height reservam o espaço antes de a imagem decodificar (sem salto de layout); o build manda o
  // tamanho do PNG em __MARCA.w/h. Com `altura`, a largura sai na mesma proporção.
  function logoHtml(fallback, altura) {
    var m = window.__MARCA;
    if (!m || typeof m !== 'object' || typeof m.logo !== 'string' || !m.logo) return fallback;
    var w = m.w > 0 ? m.w : 0, h = m.h > 0 ? m.h : 0, tam = '';
    if (altura) tam = ' height="' + altura + '"' + (w && h ? ' width="' + Math.round(w * altura / h) + '"' : '');
    else if (w && h) tam = ' width="' + w + '" height="' + h + '"';
    return '<img class="logo-img" src="' + esc(m.logo) + '" alt="Galope Elemental"' + tam + '>';
  }
  function ouroHtml(n, extraClass) {
    return '<span class="ouro' + (extraClass ? ' ' + extraClass : '') + '">' + iconeHtml('moeda-ouro', COIN) + '<span>' + fmt(n) + '</span><span class="sr">Ouro</span></span>';
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
  // ---- Ícones das telas (spec 2026-11-12-icones §4): cada função cai na reserva de hoje sem o arquivo ----
  // O ícone é decorativo (alt=""): o texto fica ao lado (ou no aria-label do pai, como nas estrelas).
  function statIcon(k) {
    return iconeHtml('st-' + k, pixelSvg(STAT_ICON_ROWS[k] || STAT_ICON_ROWS.vel, 'icone-status icone-status--' + k), 16);
  }
  // ---- Explicações curtas (spec 1b §11): botão "ⓘ" ao lado do rótulo ----
  // No computador o texto aparece com o mouse (title); no toque, abrir/fechar mostra a frase embaixo do rótulo
  // (aria-expanded no botão, texto com role="note"). Os textos são os de GameData.HELP, os mesmos do wiki.
  // nome: o que o botão explica, para o nome acessível ("O que é Velocidade?").
  // O botão não tem texto: o "ⓘ" é a peça de pixel do ::before (acabamento 3a §4.13; o caractere não existe nas fontes).
  // conteudo (opcional): o rótulo à vista vira o próprio botão (.ajuda--nome, 3b §6: o nome do status), com a peça ⓘ
  // pequena junto dele; cls vai junto da classe. Sem o texto em GD.HELP, o rótulo fica num <span> com a mesma classe.
  function ajudaBtn(chave, nome, conteudo, cls) {
    if (!hasOwn(GD.HELP, chave)) return conteudo ? '<span class="' + (cls || '') + '">' + conteudo + '</span>' : '';
    return '<button type="button" class="ajuda' + (conteudo ? ' ajuda--nome' : '') + (cls ? ' ' + cls : '') + '" data-ajuda="' + esc(chave) +
      '" aria-expanded="false" aria-label="' + esc('O que é ' + nome + '?') + '" title="' + esc(GD.HELP[chave]) + '">' + (conteudo || '') + '</button>';
  }
  // onde o texto aberto entra: 'dt' depois da linha de status (a grade do <dl>), 'in' no fim do bloco, 'after' logo depois dele
  var AJUDA_ONDE = [['li', 'in'], ['.vaga-tipo', 'in'], ['.redistribuir', 'in'], ['.tela-cabeca', 'in'],
    ['dt', 'dt'], ['.linha-meta', 'after'], ['.chips', 'after'], ['.build-topo', 'after']];
  // ---- Botão indisponível com motivo (3b §7): aria-disabled em vez de disabled, para o toque e o teclado mostrarem
  // o porquê. O atributo só avisa: cada ação confere a condição de novo e nunca executa com o botão forçado.
  function indisponivel(motivo) {
    if (!motivo) return '';
    return ' aria-disabled="true" data-motivo="' + esc(motivo) + '" title="' + esc(motivo) + '"';
  }
  // onde a linha do motivo entra: 'in' no fim do bloco, 'after' logo depois dele (a 1ª regra que casar)
  var MOTIVO_ONDE = [['.item-escolha > li', 'in'], ['.etapa', 'in'], ['.item-uso', 'in'], ['.build-linha', 'in'], ['.barra-acao', 'in'], ['.build-acoes', 'after'], ['.redistribuir', 'in'],
    ['.montaria-acoes', 'after'], ['.acoes', 'after'], ['.item-linha', 'in'], ['.diaria', 'in']];
  // região viva fixa (fora da tela que redesenha): leitores de tela anunciam o texto escrito nela, e o .motivo criado já
  // com o texto muitas vezes passa em silêncio. Limpa antes de escrever, para o mesmo texto ser anunciado de novo.
  var motivoVivoTimer = 0;
  function motivoVivo(txt) {
    var el = document.getElementById('motivo-vivo');
    if (!el) return;
    clearTimeout(motivoVivoTimer);
    el.textContent = '';
    if (txt) motivoVivoTimer = setTimeout(function () { el.textContent = txt; }, 60);
  }
  // destaque parado (3c §9.1) da frase do motivo que já estava na tela: a classe .motivo-alvo por MOTIVO_ALVO_MS. Um toque
  // novo reinicia o tempo; tiraMotivo() e o render() o tiram antes (o elemento pode já ter saído da tela: nada quebra)
  var MOTIVO_ALVO_MS = 2000;
  var motivoAlvoTimer = 0;
  function tiraAlvo() {
    clearTimeout(motivoAlvoTimer);
    motivoAlvoTimer = 0;
    var alvos = telaEl.querySelectorAll('.motivo-alvo');
    for (var i = 0; i < alvos.length; i++) alvos[i].classList.remove('motivo-alvo');
  }
  // alvo: o elemento tocado. Se a .motivo removida estava acima dele na página, a lista subiria e o tirava de baixo do dedo
  // (3c §9.2): rola de volta o que ele andou. Só mede quando algo acima saiu; a barra presa não anda (a medida dá 0)
  function tiraMotivo(alvo) {
    motivoVivo('');
    tiraAlvo();
    var velhas = telaEl.querySelectorAll('.motivo');
    if (!velhas.length) return;
    // mede só com o alvo na tela, fora das .motivo que saem e abaixo de alguma delas
    var y0 = alvo && telaEl.contains(alvo) ? alvo.getBoundingClientRect().top : null, acima = false, i;
    for (i = 0; i < velhas.length && y0 !== null; i++) {
      if (velhas[i].contains(alvo)) y0 = null;
      else if (velhas[i].getBoundingClientRect().bottom <= y0) acima = true;
    }
    for (i = 0; i < velhas.length; i++) if (velhas[i].parentNode) velhas[i].parentNode.removeChild(velhas[i]);
    medeBarra();   // a .motivo do Confirmar fica dentro da barra presa
    if (y0 !== null && acima) {
      var subiu = y0 - alvo.getBoundingClientRect().top;
      if (subiu > 0) window.scrollBy(0, -subiu);
    }
  }
  // a frase do motivo já à vista no contêiner do botão (o mesmo do MOTIVO_ONDE: ele mesmo no 'in', o pai no 'after'): o
  // elemento mais de dentro com exatamente aquele texto, ou null
  function fraseNaTela(caixa, txt, btn) {
    var limpa = function (x) { return String(x).replace(/\s+/g, ' ').trim(); };
    var alvo = limpa(txt), achado = null, els = caixa.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.contains(btn) || !e.getClientRects().length || limpa(e.textContent) !== alvo) continue;
      if (!achado || achado.contains(e)) achado = e;
    }
    return achado;
  }
  function mostraMotivo(btn) {
    tiraMotivo();
    var txt = btn.getAttribute('data-motivo');
    if (!txt) return;
    var host = null, modo = '';
    for (var i = 0; i < MOTIVO_ONDE.length && !host; i++) {
      host = btn.closest(MOTIVO_ONDE[i][0]);
      if (host) modo = MOTIVO_ONDE[i][1];
    }
    motivoVivo(txt);
    if (!host) return;
    // a frase já está na tela (Confirmar travado, Redistribuir, Expandir com reserva): não repete, destaca a que está lá
    var ja = fraseNaTela(modo === 'in' ? host : host.parentNode, txt, btn);
    if (ja) {
      ja.classList.add('motivo-alvo');
      motivoAlvoTimer = setTimeout(function () { motivoAlvoTimer = 0; ja.classList.remove('motivo-alvo'); }, MOTIVO_ALVO_MS);
      return;
    }
    var p = document.createElement('p');
    p.className = 'motivo';
    p.setAttribute('role', 'status');
    p.textContent = txt;
    if (modo === 'in') host.appendChild(p);
    else host.parentNode.insertBefore(p, host.nextSibling);
    medeBarra();
  }
  var ajudaSeq = 0;
  function alternaAjuda(btn) {
    var chave = btn.getAttribute('data-ajuda');
    if (!hasOwn(GD.HELP, chave)) return;
    var aberto = btn.getAttribute('aria-expanded') === 'true', nid = btn.getAttribute('data-nota');
    if (nid) {
      var velha = document.getElementById(nid);
      if (velha && velha.parentNode) velha.parentNode.removeChild(velha);
      btn.removeAttribute('data-nota');
    }
    btn.setAttribute('aria-expanded', aberto ? 'false' : 'true');
    if (aberto) return;
    var host = null, modo = '';
    for (var i = 0; i < AJUDA_ONDE.length && !host; i++) {
      host = btn.closest(AJUDA_ONDE[i][0]);
      if (host) modo = AJUDA_ONDE[i][1];
    }
    if (!host) { btn.setAttribute('aria-expanded', 'false'); return; }
    var ref = host;
    if (modo === 'dt' && host.nextElementSibling && host.nextElementSibling.nextElementSibling) ref = host.nextElementSibling.nextElementSibling;   // depois do valor
    var nota = document.createElement(modo === 'dt' ? 'dd' : 'div');
    nota.className = 'ajuda-txt';
    nota.id = 'ajuda-' + (++ajudaSeq);
    nota.setAttribute('role', 'note');
    nota.textContent = GD.HELP[chave];
    if (modo === 'in') host.appendChild(nota);
    else host.parentNode.insertBefore(nota, ref.nextSibling);
    btn.setAttribute('data-nota', nota.id);
  }
  // grau do cavalo: três estrelas, cheias e vazias (reserva ★/☆), lidas como "N de 3 estrelas"
  function estrelasHtml(grau) {
    var g = clamp(Math.floor(Number(grau) || 0), 0, 3), out = '';
    for (var i = 0; i < 3; i++) out += i < g ? iconeHtml('ui-estrela', '★', 16) : iconeHtml('ui-estrela-vazia', '☆', 16);
    return '<span class="estrelas" role="img" aria-label="' + g + ' de 3 estrelas">' + out + '</span>';
  }
  function sexoHtml(sexo) {
    return sexo === 'f' ? iconeHtml('ui-femea', '♀', 16) + ' Fêmea' : iconeHtml('ui-macho', '♂', 16) + ' Macho';
  }
  function corcelHtml() { return iconeHtml('ui-corcel', '⚑', 16) + ' Corcel'; }
  // skill de vaga (sk-<id>) ou de tipo (sk-tipo-<elemento>); reserva: o selo do elemento da skill
  function skillIcone(id, tam) {
    if (hasOwn(GD.SKILLS, id)) return iconeHtml('sk-' + id, iconHtml(GD.SKILLS[id].element), tam || 16);
    for (var e in GD.TYPE_SKILLS) {
      if (hasOwn(GD.TYPE_SKILLS, e) && GD.TYPE_SKILLS[e].id === id) return iconeHtml('sk-tipo-' + e, iconHtml(e), tam || 16);
    }
    return '';
  }
  // clima, piso, liga, raridade e pódio: o nome já está ao lado, então sem arquivo não fica nada no lugar
  function climaIcone(id) { return iconeHtml('cl-' + id, '', 16); }
  function pisoIcone(id) { return iconeHtml('pi-' + id, '', 16); }
  function ligaIcone(id) { return iconeHtml('liga-' + id, '', 16); }
  function raridadeIcone(id) { return iconeHtml('rar-' + id, '', 16); }
  function podioIcone(lugar) { return lugar >= 1 && lugar <= 3 ? iconeHtml('podio-' + lugar, '', 16) : ''; }
  // texto de evento da simulação (narração e momentos): o "🎲 " dos eventos do tipo 'dado' vira o ícone ui-dado
  // (sem o arquivo, fica o emoji); o resto passa por esc
  var DADO_PREFIXO = '🎲 ';
  function eventoHtml(txt, tipo) {
    var s = txt == null ? '' : String(txt);
    if (tipo === 'dado' && s.indexOf(DADO_PREFIXO) === 0) return iconeHtml('ui-dado', '🎲', 16) + ' ' + esc(s.slice(DADO_PREFIXO.length));
    return esc(s);
  }
  // "Clima: X" do painel da corrida, montado por DOM (o nome vem do catálogo; nada de innerHTML)
  function climaNoPainel(el, id) {
    if (!el || !hasOwn(GD.WEATHERS, id)) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    var src = iconeSrc('cl-' + id);
    if (src) {
      var img = document.createElement('img');
      img.className = 'icone icone--cl-' + id;
      img.src = src; img.alt = ''; img.width = 16; img.height = 16;
      el.appendChild(img);
    }
    el.appendChild(document.createTextNode('Clima: ' + GD.WEATHERS[id].name));
  }

  // ===========================================================================
  // Persistência (localStorage é opcional: tudo funciona sem ele)
  // Cada gravação leva uma revisão (state.rev): uma aba antiga não sobrescreve a mais nova.
  // ===========================================================================
  // Save que não se lê (JSON inválido): antes de o jogo recomeçar e gravar por cima, o texto bruto vai para
  // SAVE_KEY + ':corrompido' (uma cópia só, a mais recente) e a tela inicial avisa (start).
  var CORROMPIDO_KEY = SAVE_KEY + ':corrompido';
  var saveCorrompido = false;   // false | 'guardado' (a cópia foi gravada) | 'sem-copia' (não coube)
  function guardaCorrompido(raw) {
    try { window.localStorage.setItem(CORROMPIDO_KEY, String(raw)); saveCorrompido = 'guardado'; } catch (e) { saveCorrompido = 'sem-copia'; }
  }
  function loadSave() {
    var raw = null;
    try { raw = window.localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e2) { guardaCorrompido(raw); return null; }
  }
  // O save guardado: { rev, novo } (novo: é de uma versão mais nova que a deste código, saveMaisNovo).
  function storedInfo() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return { rev: -1, novo: false };
      var s = JSON.parse(raw);
      return { rev: s && isFinite(s.rev) ? Number(s.rev) : 0, novo: saveMaisNovo(s) };
    } catch (e) { return { rev: -1, novo: false }; }
  }
  // Há armazenamento? Sem ele (iframe sem localStorage, acesso bloqueado) o jogo roda só em memória e
  // persist() não tem o que gravar. Com ele, uma gravação que lança (cota cheia) é uma FALHA: quem gasta
  // desfaz a ação (gravaGasto).
  var STORAGE_OK = (function () {
    try { var ls = window.localStorage; if (!ls) return false; ls.getItem(SAVE_KEY); return true; } catch (e) { return false; }
  })();
  // Grava o state. Devolve true se gravou (ou se não há armazenamento: tudo segue em memória) e false se a
  // gravação falhou ou se outra aba tinha gravado depois (aí o state já é o adotado: quem chama compara).
  // Save guardado de versão mais nova (qualquer revisão): não grava por cima; o jogo passa à tela de bloqueio
  // (o state vira null: quem chama compara com o de antes e para).
  function persist() {
    if (!state || saveBloqueado) return !saveBloqueado;
    /*@dev:inicio*/
    if (DEV_MODE && ui.dev.ouroInf) DV.refillGold(state);   // Ouro infinito do perfil DEV: repõe depois de cada gasto
    /*@dev:fim*/
    var guardado = storedInfo(), sr = guardado.rev;
    if (guardado.novo) { bloqueiaSaveNovo(); return false; }
    if (sr > state.rev) { adoptExternal(loadSave()); return false; }   // outra aba gravou depois: não sobrescreve
    var revAntes = state.rev;
    state.rev = Math.max(state.rev, sr) + 1;
    if (!STORAGE_OK) return true;
    // a gravação que falha não muda a revisão: a da memória nunca fica à frente do disco (senão a gravação de outra aba,
    // com revisão menor ou igual à desta, seria sobrescrita em vez de adotada)
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch (e) { state.rev = revAntes; return false; }
  }
  var FALHA_SALVAR = 'Não foi possível salvar. Libere espaço e tente de novo.';
  // Grava uma ação que gasta (o débito e o resultado vão juntos na mesma gravação). s0: o state de antes da
  // ação (para saber se outra aba gravou por cima); antes: clone(state) tirado antes da mudança.
  // 'ok'; 'outra-aba' (adoptExternal já navegou); 'falhou' (o state volta a ser o de antes; quem chama avisa
  // com FALHA_SALVAR e não mostra resultado nenhum).
  function gravaGasto(s0, antes) {
    var ok = persist();
    if (state !== s0) return 'outra-aba';
    if (ok) return 'ok';
    state = antes;
    return 'falhou';
  }
  // Apaga o save ("Recomeçar", "Zerar perfil de teste"). Se o guardado é de versão mais nova, não apaga: vai à tela de
  // bloqueio e devolve false (quem chama para).
  function wipeSave() {
    if (storedInfo().novo) { bloqueiaSaveNovo(); return false; }
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignora */ }
    return true;
  }
  // Opção "Animações" enquanto não há save (de "Recomeçar" até escolher o inicial): numa chave própria,
  // para não se perder se a aba fechar na tela de escolha. Só existe nesse intervalo.
  var MOTION_KEY = SAVE_KEY + ':animacoes';
  function guardaMotionKeep(m) {
    try {
      if (m && m !== 'sistema') window.localStorage.setItem(MOTION_KEY, m);
      else window.localStorage.removeItem(MOTION_KEY);
    } catch (e) { /* sem armazenamento: vale só nesta aba */ }
  }
  function leMotionKeep() {
    try { var m = window.localStorage.getItem(MOTION_KEY); return MOTIONS.indexOf(m) >= 0 ? m : null; } catch (e) { return null; }
  }
  // O jóquei também passa para o save novo (decisão de 2026-11-13: é a identidade do jogador, como a opção Animações),
  // numa chave própria pelo mesmo motivo; só existe de "Recomeçar" até escolher o inicial. Lixo na chave: o inicial.
  var JOQUEI_KEY = SAVE_KEY + ':joquei';
  function guardaJoqueiKeep(j) {
    try {
      if (j) window.localStorage.setItem(JOQUEI_KEY, JSON.stringify(j));
      else window.localStorage.removeItem(JOQUEI_KEY);
    } catch (e) { /* sem armazenamento: vale só nesta aba */ }
  }
  function leJoqueiKeep() {
    try {
      var raw = window.localStorage.getItem(JOQUEI_KEY);
      return raw ? validJoquei(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }

  // Save v5: várias montarias (instâncias) e uma ativa; peças de equipamento como instâncias em
  // state.items ({ uid: 'i<n>', id, plus }) e equipadas por montaria em mount.equip (slot -> uid|null).
  // Montaria v5: genética em potential (0–31), estrelas em grau (1–3) e pontos livres distribuídos em
  // alloc (as 7 chaves; RaceSim.validAlloc); não há status base guardado (sai da genética).
  // Saves v1/v2 (um inicial com level/xp/skills na raiz) são migrados em sanitize(): o inicial vira
  // mounts[0] ('m1'); o inventário de itens antigos (v1–v3) vira peças pelo OLD_ITEM_MAP.
  // v4 -> v5 (também em sanitize, e gravado logo ao abrir): o status base é descartado; alloc zerado (os
  // pontos dos níveis já ganhos ficam para distribuir); Neutro vira Fogo/Água/Grama pela seed do save e pelo
  // número do uid (neutroParaTipo); as skills de tipo (Labareda, Maré Alta, Raízes Firmes) saem da lista;
  // modelo que saiu do catálogo (ex.: Pangaré) fica com templateId null e a própria paleta; a sala aberta
  // fica (mesma seed, entrada e treino) com o Poder recalculado.
  // Visual da parte 2a (spec 2026-11-12-cavalos-marcas), sem versão nova: mount.marcas = { cara, patas, corpo } e
  // state.joquei = { padrao, capacete }, opcionais no save; ausentes ou inválidos, o sanitize põe os calculados
  // (marcasDe) e o jóquei inicial (validJoquei). Só desenho: nada disso entra na corrida, no Poder nem na sala.
  // Parte 2b (spec 2026-11-13-cavalos-portes §3), também sem versão nova: mount.porte (GameData.PORTES.valores),
  // opcional; ausente ou inválido, o sanitize põe o da escada do Breed.porteDe (o do modelo do catálogo, senão
  // porteDoId do uid). Só desenho, como as marcas.
  // v5 -> v6 (bloco 1b, crescimento livre; spec 2026-11-12-crescimento-livre §10), também em sanitize e gravado logo ao
  // abrir: todos os cavalos ficam com alloc zerado (todos os pontos devolvidos, no custo por faixa novo) e
  // mount.respecFree = true (a primeira redistribuição de cada cavalo é grátis); state.redeas = 0 (Rédeas novas, que
  // pagam as redistribuições seguintes); peças, equipamento e Pedras ficam como estão; a sala aberta continua (mesma
  // seed, entrada e treino), com o retrato dos pontos zerado e o Poder pela R16. state.avisoV6 = true marca o aviso
  // da migração ainda não mostrado: o Estábulo o mostra uma vez na abertura (start) e grava false.
  // Campos novos da v6: respecFree só booleano (padrão true); redeas inteiro 0–999 (fora disso, 0); avisoV6 booleano.
  // v6 -> v7 (itens, loja e diária; spec 2026-11-16-itens-loja-diaria §10), em sanitize e gravado logo ao abrir: tudo novo
  // começa zerado, com a diária no dia 1 para resgatar; nada do save antigo muda. Campos novos da v7 (inteiro fora da
  // faixa, fração, texto, null ou objeto voltam ao padrão):
  //   state.mochila = { torrao, estrela, cupom, manual }: 0 a GameData.BAG_MAX (a Rédea nova fica em state.redeas);
  //   state.diaria = { prox: 0–6, ciclos: ≥ 0, ultimo: dia do último resgate | null };
  //   state.lojaItens = { dia: dia | null, comprados: { torrao, manual, cupom } (0 ao limite do dia), estrelaDia: dia | null };
  //   (dia ou limite corrompido num save v7 não libera nada: vale hojeDia() ou o limite; ver sanitize e Itens);
  //   state.itemCounter: usos sorteados (Cupom, Manual), inteiro ≥ 0; mount.torroes: 0 ao teto do Torrão;
  //   o deslocamento de dias da gaveta DEV: −400 a 400, só no save de teste (no jogo real o campo não existe; o nome
  //   fica nos blocos DEV, e o build.mjs falha se ele aparecer no jogo de produção).
  // v7 -> v8 (Ginásios da Expedição; spec 2026-11-17-ginasios §14), em sanitize e gravado logo ao abrir: os três ginásios
  // começam zerados (nenhuma etapa vencida) e o contador de desafios em 0; nada do save antigo muda (o que um save v7
  // tiver nesses campos não é lido). Campos novos da v8:
  //   state.ginasios = a forma de Ginasio.sanear: { fogo|agua|grama: { etapa: 0–5 (etapas vencidas; a insígnia é a etapa
  //     5, sem campo próprio), revDia: null | dia da última revanche, revVitorias: inteiro ≥ 0 } } — num save v8, lixo
  //     volta ao coerente pelo Ginasio.sanear (etapa fora de 0–5 vale 0; dia estragado vale hoje, "já tentou hoje", e é
  //     gravado consertado ao abrir, como a diária: ver start);
  //   state.gymCounter: desafios sorteados (a seed de cada duelo), inteiro ≥ 0 (lixo: 0).
  // Save de versão MAIOR que SAVE_VERSION (saveMaisNovo) nunca é adotado nem gravado por cima: tela de bloqueio.
  var SAVE_VERSION = 8;
  var AVISO_V6 = 'As regras de crescimento mudaram: os pontos dos seus cavalos voltaram para distribuir.';
  var REDEAS_MAX = 999;
  var MOCHILA_IDS = Object.keys(GD.ITEMS).filter(function (id) { return id !== 'redea'; });   // torrao, estrela, cupom, manual
  // os itens à venda, na ordem fixa da loja (GameData.SHOP_ORDER, spec de itens §6: Torrão, Manual, Cupom, Estrela)
  var LOJA_ITENS = GD.SHOP_ORDER.filter(function (id) { return hasOwn(GD.ITEMS, id) && GD.ITEMS[id].price != null; });
  // os que têm limite por dia (perDay), tirados do catálogo (o itens.js lê os mesmos campos): torrao, manual, cupom
  var LOJA_LIMITADOS = LOJA_ITENS.filter(function (id) { return !!GD.ITEMS[id].perDay; });
  var DIA_MAX = IT.DIA_MAX;   // dia guardado no save: inteiro de 0 a este (diaLocal(9999, 11, 31))
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
      potential: clone(tpl.potential),
      alloc: zeroAlloc(),
      respecFree: true,   // a primeira redistribuição dos pontos é grátis (bloco 1b §9)
      torroes: 0,         // Torrões de açúcar usados (o potro nasce com 0)
      palette: tpl.palette ? clone(tpl.palette) : null,
      marcas: marcasDe(tpl.marcas, null, uid),
      porte: BRD.porteDe(tpl.porte, null, uid),   // o do modelo (todo modelo, do catálogo ou do painel DEV, tem um)
      breedLeft: tpl.breedLeftMax || GD.BREED_LEFT[tpl.sex],
      parents: null,
      born: 0,
      equip: GR.emptyEquip()
    };
  }

  // Marcas na pelagem (spec 2026-11-12-cavalos-marcas §2; só desenho, fora do Poder e da corrida): a regra é uma só,
  // Breed.marcasDe(marcas, templateId, chave) — as do cavalo, se válidas; senão as do modelo do catálogo; senão as
  // calculadas da chave (o uid). Sempre uma cópia com os três genes.
  function marcasDe(marcas, templateId, chave) { return BRD.marcasDe(marcas, templateId, chave); }
  // Jóquei do jogador (spec §4): padrão da seda e cor do capacete, só das listas de GameData.JOQUEI (a cor aceita
  // maiúsculas e fica como na lista); qualquer outra coisa (save de antes da 2a, lixo) volta ao jóquei inicial.
  function joqueiInicial() { return { padrao: GD.JOQUEI.padrao, capacete: GD.JOQUEI.capacete }; }
  function validJoquei(j) {
    if (!j || typeof j !== 'object') return joqueiInicial();
    var cap = typeof j.capacete === 'string' ? j.capacete.toLowerCase() : null;
    if (GD.JOQUEI.padroes.indexOf(j.padrao) < 0 || GD.JOQUEI.capacetes.indexOf(cap) < 0) return joqueiInicial();
    return { padrao: j.padrao, capacete: cap };
  }

  function zeroAlloc() {
    var a = {};
    STAT_KEYS.forEach(function (k) { a[k] = 0; });
    return a;
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
      v: SAVE_VERSION,
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
      enhanceCounter: 0,
      redeas: 0,          // Rédeas novas (bloco 1b §9): vêm no 7º dia da recompensa diária (e da gaveta DEV)
      avisoV6: false,     // aviso da migração v5 -> v6 ainda por mostrar (só em save migrado)
      mochila: mochilaVazia(),
      diaria: { prox: 0, ciclos: 0, ultimo: null },   // save novo: o dia 1 para resgatar
      lojaItens: lojaItensVazia(),
      itemCounter: 0,
      ginasios: GN.sanear(null, 0),   // os três ginásios sem nenhuma etapa vencida (revDia null: nunca tentou a revanche)
      gymCounter: 0,
      settings: { motion: 'sistema' },
      joquei: joqueiInicial()
    };
    /*@dev:inicio*/
    if (DEV_MODE) st.devDias = 0;   // deslocamento de dias da gaveta DEV: só no save de teste
    /*@dev:fim*/
    // equipamento inicial (+0) já equipado no inicial
    GE.startGear.forEach(function (id) {
      if (!hasOwn(GD.GEAR, id)) return;
      var it = addItem(st, id);
      st.mounts[0].equip[GD.GEAR[id].slot] = it.uid;
    });
    return st;
  }

  function mochilaVazia() {
    var mo = {};
    MOCHILA_IDS.forEach(function (id) { mo[id] = 0; });
    return mo;
  }
  function lojaItensVazia() {
    var c = {};
    LOJA_LIMITADOS.forEach(function (id) { c[id] = 0; });
    return { dia: null, comprados: c, estrelaDia: null };
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
  // inteiro de lo a hi, como está; qualquer outra coisa (fora da faixa, fração, texto, null, objeto) vale d
  function inteiroOu(v, d, lo, hi) { return typeof v === 'number' && v === Math.floor(v) && v >= lo && v <= hi ? v : d; }
  function objetoOu(o) { return o && typeof o === 'object' && !Array.isArray(o) ? o : null; }
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

  // Cavalo Neutro (o tipo saiu na v3) vira Fogo, Água ou Grama: sorteio fixo pela seed do save e pelo
  // número do uid, sem RNG de jogo. Vale para save de qualquer versão; o convertido não é mais Neutro.
  var NEUTRO_PARA = ['fogo', 'agua', 'grama'];
  function neutroParaTipo(seedBase, uid) {
    return NEUTRO_PARA[(RS.hash2(seedBase >>> 0, Number(uid.slice(1))) >>> 0) % NEUTRO_PARA.length];
  }

  // Uma montaria do save v3+: tipos e faixas; campo essencial ausente ou genética inválida -> null.
  // seedBase: a seed do save (converte o Neutro); v6: o save já é v6 (antes dele, os pontos vêm zerados, todos
  // devolvidos, e a redistribuição grátis volta); v7: já é v7 (antes dele, sem torrões). Modelo fora do catálogo:
  // a montaria fica, sem modelo.
  function sanitizeMount(m, seedBase, v6, v7) {
    if (!m || typeof m !== 'object') return null;
    if (typeof m.uid !== 'string' || !/^m\d{1,9}$/.test(m.uid)) return null;
    var element = m.element === 'neutro' ? neutroParaTipo(seedBase, m.uid) : m.element;
    if (typeof element !== 'string' || !hasOwn(GD.ELEMENTS, element)) return null;
    if (typeof m.rarity !== 'string' || !hasOwn(GD.RARITIES, m.rarity)) return null;
    if (m.sex !== 'm' && m.sex !== 'f') return null;
    // modelo que não existe mais (ou id inválido): fica sem modelo, como um potro (aparência pela paleta)
    var templateId = null;
    if (typeof m.templateId === 'string' && (horseById(m.templateId) || (devHooks && devHooks.templateId(m.templateId)))) templateId = m.templateId;
    var grau = num(m.grau, 2, 1, 3);
    var potential = statBlock(m.potential, 0, 31);
    if (!potential) return null;
    var name = typeof m.name === 'string' ? String(m.name).replace(/\s+/g, ' ').trim().slice(0, 16) : '';
    if (name.length < 2) name = 'Montaria';
    var out = {
      uid: m.uid,
      templateId: templateId,
      name: name,
      especie: 'cavalo',
      element: element,
      rarity: m.rarity,
      grau: grau,
      sex: m.sex,
      level: num(m.level, 1, 1, MAX_LEVEL),
      xp: num(m.xp, 0, 0, 1e7),
      skills: [],
      potential: potential,
      alloc: null,
      // só booleano; ausente ou lixo (e todo save de antes da v6): true
      respecFree: v6 && typeof m.respecFree === 'boolean' ? m.respecFree : true,
      torroes: v7 ? inteiroOu(m.torroes, 0, 0, GD.ITEMS.torrao.cap) : 0,   // antes do alloc: os torrões entram nos pontos
      palette: validPalette(m.palette),
      marcas: marcasDe(m.marcas, templateId, m.uid),   // sem versão nova: ausentes ou inválidas, as calculadas
      porte: BRD.porteDe(m.porte, templateId, m.uid),  // idem: ausente ou inválido, o do modelo ou o do uid
      breedLeft: num(m.breedLeft, GD.BREED_LEFT[m.sex], 0, 4),
      parents: validParents(m.parents),
      born: num(m.born, 0, 0, 1e9),
      // ('gestacao', gravado por saves antigos e nunca lido, fica de fora)
      equip: GR.emptyEquip()      // preenchido em sanitize(), que conhece as peças válidas
    };
    out.alloc = RS.validAlloc(out, v6 ? m.alloc : null);   // save antigo: zerado; inválido: cortado pelo teto e pelo custo
    out.skills = validSkills(m.skills, out);
    return out;
  }

  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var mounts, activeId, nextUid, stableSlots, breedCounter;
    var start = BR.stableSlotsStart, max = BR.stableSlotsMax;
    var v3 = Number(s.v) >= 3, v4 = Number(s.v) >= 4, v6 = Number(s.v) >= 6, v7 = Number(s.v) >= 7, v8 = Number(s.v) >= 8;
    var seedBase = num(s.seedBase, null, 0, 4294967295);
    if (seedBase == null) seedBase = freshSeedBase(0);
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
        var m = sanitizeMount(raw, seedBase, v6, v7);
        if (!m || seen[m.uid]) return;
        seen[m.uid] = true;
        mounts.push(m);
        if (raw.equip && typeof raw.equip === 'object') rawEquip[m.uid] = raw.equip;
        if (/^m\d{1,9}$/.test(m.uid)) maxUid = Math.max(maxUid, Number(m.uid.slice(1)));
      });
      if (!mounts.length) { mounts.push(instanceFromTemplate(GD.STARTERS[0], 'm1')); maxUid = 1; }
      activeId = mounts.some(function (m) { return m.uid === s.activeId; }) ? s.activeId : mounts[0].uid;
      nextUid = Math.max(num(s.nextUid, 0, 0, 1e9), maxUid + 1);
      // perfil DEV: o painel cria cavalos sem limite de vagas (o estábulo cresce junto)
      stableSlots = clamp(num(s.stableSlots, start, 0, 1e9), Math.max(start, mounts.length), DEV_MODE ? Math.max(max, mounts.length) : max);
      breedCounter = num(s.breedCounter, 0, 0, 1e9);
    }
    var base = newState(GD.STARTERS[0].id);
    base.rev = num(s.rev, 0, 0, 1e12);
    base.gold = num(s.gold, E.startingGold, 0, 1e9);
    base.tier = E.entryTiers.indexOf(s.tier) >= 0 ? s.tier : E.entryTiers[0];
    base.seedBase = seedBase;
    base.raceCounter = num(s.raceCounter, 0, 0, 1e9);
    var p = s.pending;
    if (p && typeof p === 'object' && isFinite(p.counter) && p.counter >= 1 && p.counter <= base.raceCounter) {
      var fee = num(p.fee, 0, 0, 1e6);
      if (p.training ? fee === 0 : E.entryTiers.indexOf(fee) >= 0) {
        base.pending = { counter: num(p.counter, 1, 1, 1e9), training: !!p.training, fee: fee, pr: num(p.pr, 600, 1, 1e5) };
        base.pending.gear = validGearSnapshot(p.gear);   // null: save de antes do retrato, ou retrato inválido
        // retrato dos pontos: saneado abaixo, quando a montaria ativa já está pronta (null: sala de antes dele)
        base.pending.alloc = p.alloc && typeof p.alloc === 'object' && !Array.isArray(p.alloc) ? p.alloc : null;
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
    sanitizeGear(s, v4, base, rawEquip);   // peças, equipado e Pedras: guardados como estão (o equipamento está suspenso)
    // Rédeas novas: inteiro de 0 a 999; qualquer outra coisa (negativo, fração, texto, acima de 999) volta a 0.
    // Save de antes da v6: 0. Aviso da migração: pendente em todo save de antes da v6; na v6, só se gravado true.
    var rd = s.redeas;
    base.redeas = v6 && typeof rd === 'number' && rd === Math.floor(rd) && rd >= 0 && rd <= REDEAS_MAX ? rd : 0;
    base.avisoV6 = v6 ? s.avisoV6 === true : true;
    // Itens, loja e diária (v7): save de antes da v7 fica com o padrão do newState (tudo zerado, o dia 1 para resgatar)
    /*@dev:inicio*/
    if (DEV_MODE) base.devDias = inteiroOu(s.devDias, 0, -DEV_DIAS_MAX, DEV_DIAS_MAX);
    /*@dev:fim*/
    // Num save v7, dado de dia ou de limite corrompido não libera nada (Rulings 7 e 8): dia (ultimo, dia, estrelaDia)
    // que não é null nem inteiro de 0 a DIA_MAX vale hoje; compra do dia corrompida vale o limite; diária ou loja que
    // não é objeto é tudo isso junto. null continua sendo "nunca". Mochila, torrões e itemCounter corrompidos: 0.
    if (v7) {
      var hoje = hojeDia(base);
      var diaOu = function (x) { return x === null ? null : inteiroOu(x, hoje, 0, DIA_MAX); };
      var mch = objetoOu(s.mochila) || {}, di = objetoOu(s.diaria), lj = objetoOu(s.lojaItens), cp = lj && objetoOu(lj.comprados) || {};
      MOCHILA_IDS.forEach(function (id) { base.mochila[id] = inteiroOu(mch[id], 0, 0, GD.BAG_MAX); });
      base.diaria = {
        prox: inteiroOu(di && di.prox, 0, 0, GD.DAILY.dias.length - 1),
        ciclos: inteiroOu(di && di.ciclos, 0, 0, 1e9),
        ultimo: di ? diaOu(di.ultimo) : hoje
      };
      LOJA_LIMITADOS.forEach(function (id) { base.lojaItens.comprados[id] = inteiroOu(cp[id], GD.ITEMS[id].perDay, 0, GD.ITEMS[id].perDay); });
      base.lojaItens.dia = lj ? diaOu(lj.dia) : hoje;
      base.lojaItens.estrelaDia = lj ? diaOu(lj.estrelaDia) : hoje;
      base.itemCounter = inteiroOu(s.itemCounter, 0, 0, 1e9);
    }
    // Ginásios (v8): save de antes da v8 fica com o padrão do newState (tudo zerado). Num save v8, o Ginasio.sanear (dia
    // estragado vale hoje) e o contador inteiro ≥ 0 (lixo: 0)
    if (v8) {
      base.ginasios = GN.sanear(s.ginasios, hojeDia(base));
      base.gymCounter = inteiroOu(s.gymCounter, 0, 0, 1e9);
    }
    // Poder da sala (R16) = o maior entre o Poder do retrato dos pontos de quando a sala abriu (pending.alloc, tirado
    // em openLobby) e o Poder com que a ativa corre agora. Nem mais (liberaria pontos acima do que a sala viu) nem
    // menos (os rivais sairiam mais fracos). O equipamento não entra (spec 1b §8): o retrato dele (pending.gear) fica
    // guardado, sem efeito. O pr é sempre recalculado: um pr adulterado (para cima ou para baixo) volta ao do retrato, e
    // o de um save de antes da v6 (modelo de status antigo, com ou sem o retrato do equipamento) passa ao modelo novo
    // uma vez (o save migrado é gravado logo ao abrir). Antes da v6 os pontos foram todos devolvidos, então o retrato
    // vai a zero junto. Sem retrato (sala de antes dele, ou lixo que não é objeto) vale o alloc atual, uma vez: o
    // retrato passa a existir e vai na próxima gravação. Retrato com lixo é cortado (validAlloc) e só pode subir o
    // Poder da sala (rivais mais fortes: só atrapalha quem adulterou). Pelas travas da tela o Poder da ativa nunca
    // passa do da sala, então o max só corrige um retrato adulterado para baixo.
    if (base.pending) {
      var act = null;
      base.mounts.forEach(function (m) { if (m.uid === base.activeId) act = m; });
      base.pending.alloc = RS.validAlloc(act, v6 ? (base.pending.alloc || act.alloc) : null);
      var retrato = clone(act);
      retrato.alloc = base.pending.alloc;
      base.pending.pr = Math.max(RS.powerRating(retrato), RS.powerRating(act));
    }
    // preferências (sem mudar a versão do save): save antigo sem settings, ou com valor inválido, segue o sistema
    var mo = s.settings && typeof s.settings === 'object' ? s.settings.motion : null;
    base.settings = { motion: MOTIONS.indexOf(mo) >= 0 ? mo : 'sistema' };
    base.joquei = validJoquei(s.joquei);   // idem: sem jóquei (save de antes da 2a) ou inválido, o inicial
    return base;
  }

  // Retrato do equipamento da montaria ativa quando a sala abre (state.pending.gear): [{ slot, id, plus }].
  // Não aponta para as peças do inventário (que podem ser vendidas ou melhoradas depois), só copia. Com o
  // equipamento suspenso (GEAR_ON) ele continua gravado e saneado, mas não entra no Poder da sala.
  function gearSnapshot(gear) {
    return gear.pieces.map(function (p) { return { slot: p.slot, id: p.id, plus: p.plus }; });
  }
  // retrato salvo: peças do catálogo no slot certo, +N válido, um por slot; qualquer coisa fora disso -> null
  function validGearSnapshot(arr) {
    if (!Array.isArray(arr) || arr.length > GR.SLOTS.length) return null;
    var out = [], seen = {};
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (!p || typeof p !== 'object' || GR.SLOTS.indexOf(p.slot) < 0 || seen[p.slot]) return null;
      if (typeof p.id !== 'string' || !hasOwn(GD.GEAR, p.id) || GD.GEAR[p.id].slot !== p.slot) return null;
      if (!(typeof p.plus === 'number' && p.plus === Math.floor(p.plus) && p.plus >= 0 && p.plus <= GE.plusMax)) return null;
      seen[p.slot] = true;
      out.push({ slot: p.slot, id: p.id, plus: p.plus });
    }
    return out;
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
  // elemento dela ou geral), sem repetir, até o nº de vagas da raridade.
  // Ausente/vazio/inválido -> as skills de nascença do template (potro sem template: nenhuma).
  // As skills de tipo de saves antigos (Labareda, Maré Alta, Raízes Firmes) não são de vaga e saem da lista;
  // uma lista que só tinha elas fica vazia (não volta para as de nascença).
  // Perfil DEV: qualquer skill do catálogo (o painel dá de outro elemento), ainda até as vagas.
  var TYPE_SKILL_IDS = Object.keys(GD.TYPE_SKILLS).map(function (e) { return GD.TYPE_SKILLS[e].id; });
  function validSkills(list, mount) {
    var st = mount.templateId ? horseById(mount.templateId) : null;
    var slots = (GD.RARITIES[mount.rarity] || GD.RARITIES.comum).skillSlots;
    var out = [];
    if (Array.isArray(list)) {
      list.forEach(function (id) {
        var sk = typeof id === 'string' && hasOwn(GD.SKILLS, id) ? GD.SKILLS[id] : null;
        if (!sk || out.indexOf(id) >= 0 || out.length >= slots) return;
        if (!DEV_MODE && sk.element !== 'geral' && sk.element !== mount.element) return;
        out.push(id);
      });
    }
    var tinhaTipo = Array.isArray(list) && list.some(function (id) { return TYPE_SKILL_IDS.indexOf(id) >= 0; });
    return out.length || tinhaTipo ? out : (st ? st.skills.slice() : []);
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

  // Bônus das insígnias (spec dos ginásios §9): da conta, nunca da simulação. { ouro, xp, skill }, a soma das
  // insígnias conquistadas (Ginasio.bonus; sem insígnia, tudo 0 e o jogo é o de antes dos ginásios).
  function bonusConta() { return GN.bonus(state.ginasios); }
  // Todo XP somado a um cavalo passa por aqui uma vez (corrida valendo, treino e, na Tarefa 5, os duelos): o XP mais o
  // bônus da insígnia de Água, arredondado.
  function xpComBonus(xp) { return xp + Math.round(xp * bonusConta().xp); }
  // A chance de aprender uma skill nova a cada nível, com o bônus da insígnia de Grama: o applyXp sorteia com este bônus
  // (RaceSim.learnSkill soma learnChance + bônus) e a aba Skills mostra chanceSkillNivel (a mesma conta)
  function bonusSkillNivel() { return bonusConta().skill; }
  function chanceSkillNivel() { return RS.TUNING.learnChance + bonusSkillNivel(); }
  // O prêmio de Ouro da corrida valendo mais o bônus da insígnia de Fogo, arredondado para baixo (o 1e-9 só segura o
  // erro do ponto flutuante: 0,03 × 100 não pode dar 2,999…).
  function ouroComBonus(premio) { return premio + Math.floor(premio * bonusConta().ouro + 1e-9); }

  // XP ganho -> níveis (até o máximo) e, a cada nível, chance de aprender uma skill
  // (sorteio determinístico pela seed do save, pelo seedTag (nº do páreo) e pelo nível alcançado). A chance soma o
  // bônus da insígnia de Grama (o XP chega aqui já com o bônus de Água: xpComBonus).
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
      var sid = RS.learnSkill({ id: mount.templateId, element: mount.element, rarity: mount.rarity, skills: mount.skills }, lrng, bonusSkillNivel());
      if (sid) { mount.skills.push(sid); learned.push(sid); }
    }
    return { levels: levels, learned: learned };
  }

  // ===========================================================================
  // Estado de UI (não persistido)
  // ===========================================================================
  var state = null;
  var ui = { screen: 'inicial', lobby: null, result: null, resultAba: 'chegada', confirmReset: false, confirmLiberar: null, notice: null, haras: null, montaria: null, gym: null, tab: 'estabulo',
    lojaParte: 'comprar',   // parte aberta da aba Loja: 'comprar' | 'mochila'
    lojaMsg: null,          // aviso da última compra da Loja de itens: { id, txt } (na linha do item)
    // uso de um item (seção "Usar os itens"): { id, mountUid, skillId, passo: 'cavalo' | 'skill' | 'confirma', origem:
    // 'mochila' | 'ficha' } ou null; itemMsg: o aviso do último uso, em duas formas: { id, uid, origem, txt } (o resultado,
    // na linha do item ou na ficha) ou { passo: true, txt } (a gravação que falhou, no passo de confirmação). Zerados em
    // toda troca de tela
    item: null, itemMsg: null,
    diariaVer: false,   // "Ver os 7 dias" aberto no cartão da recompensa diária (Estábulo); fecha ao trocar de tela
    diaTela: null,      // o dia (hojeDia) do último desenho da tela: o dia que vira com o jogo aberto (diaVirou)
    motionKeep: null,   // "Recomeçar": a opção Animações passa para o save novo
    joqueiKeep: null,   // e o jóquei também (padrão e capacete)
    // modo DEV (só com DEV_MODE): gaveta, confirmação do "Zerar" e valores armados para a próxima corrida
    // (ver a seção "Modo DEV")
    dev: { aberto: false, ouroInf: true, msg: '', f: null, confirmZerar: false }, devNext: null };
  var live = [];          // canvases animados da tela atual
  var raceView = null;
  var portraitQueue = [];

  // ===========================================================================
  // O dia (spec de itens §9) e o save de versão mais nova (§10)
  // ===========================================================================
  // O dia do jogo: a data local do aparelho em dias inteiros (Itens.diaLocal; o mês do Date vai de 0 a 11). É o
  // ÚNICO lugar do jogo que lê o relógio para as regras (diária e limites da loja). No modo DEV soma o deslocamento
  // da gaveta (guardado só no save de teste); o jogo de produção sai sem ele (build.mjs proíbe o nome do campo). st: o
  // save do deslocamento (padrão: o state).
  function hojeDia(st) {
    var d = new Date(), dia = IT.diaLocal(d.getFullYear(), d.getMonth(), d.getDate());
    /*@dev:inicio*/
    st = st || state;
    if (DEV_MODE && st) dia += inteiroOu(st.devDias, 0, -DEV_DIAS_MAX, DEV_DIAS_MAX);
    /*@dev:fim*/
    return dia;
  }
  // O dia virou com o jogo aberto (decisão 19 do controlador): sem temporizador, o dia só é conferido quando a aba volta a
  // ficar visível (visibilitychange, no start) e no começo de um toque (o clique delegado da tela). Se hojeDia() mudou desde
  // o último desenho, a tela é desenhada de novo (redesenhaDia) e esse toque não vale (o alvo era da tela de ontem). Nunca
  // na corrida nem no resultado (a corrida não para nem é redesenhada por isso), nem na tela de bloqueio ou sem save.
  function diaVirou() {
    return !!state && !saveBloqueado && ui.screen !== 'corrida' && ui.screen !== 'entreduelos' && ui.screen !== 'desafio' && ui.screen !== 'resultado' && ui.screen !== 'bloqueio' &&
      ui.diaTela !== null && hojeDia() !== ui.diaTela;
  }
  // a tela atual de novo, com a rolagem; o uso de um item aberto continua aberto e é conferido de novo (como com o save de
  // outra aba); o aviso da última compra ("Comprou 1 …") é de ontem e sai
  function redesenhaDia() {
    ui.lojaMsg = null;
    if (ui.item && (ui.screen === 'loja' || ui.screen === 'montaria')) itemPasso(); else rerenderKeepScroll();
    motivoVivo('Virou o dia: a tela foi atualizada.');
  }
  // Save gravado por uma versão mais nova do jogo: Number(v) > SAVE_VERSION (vale também "8" em texto, que o sanitize
  // leria como v7+; v ausente ou lixo dá NaN e segue o caminho de sempre do sanitize).
  function saveMaisNovo(s) {
    return !!s && typeof s === 'object' && Number(s.v) > SAVE_VERSION;
  }
  // Achou um save mais novo (na leitura ao abrir, no evento de outra aba, no estado do hot ou ao gravar): o jogo
  // larga o state (nada mais grava: persist() sai sem tocar na chave) e mostra só a tela de bloqueio, com o
  // "Recarregar". Não há volta sem recarregar a página.
  var saveBloqueado = false;
  // naCarga: chamado no start(), antes do primeiro desenho (o start desenha).
  function bloqueiaSaveNovo(naCarga) {
    saveBloqueado = true;
    state = null; ui.lobby = null; ui.result = null; ui.notice = null; ui.montaria = null; ui.devNext = null;
    if (naCarga) ui.screen = 'bloqueio';
    else go('bloqueio');
  }
  function renderBloqueio() {
    return '<section class="tela tela--bloqueio" aria-labelledby="t-bloqueio">' +
      '<div class="caixa"><h1 class="titulo" id="t-bloqueio" tabindex="-1" data-foco>Save de uma versão mais nova</h1>' +
      '<p>O seu progresso foi salvo por uma versão mais nova do Galope Elemental. Esta página é de uma versão anterior e não vai abrir nem mudar esse save.</p>' +
      '<p>Atualize a página para jogar na versão nova. Nada foi apagado.</p>' +
      '<button type="button" class="btn btn--ouro btn--grande" data-acao="recarregar">Recarregar</button></div></section>';
  }

  // Outra aba gravou um save mais novo: adota e volta para um ponto seguro. Save de versão mais nova: bloqueio.
  function adoptExternal(raw) {
    if (saveBloqueado) return;
    if (saveMaisNovo(raw)) { bloqueiaSaveNovo(); return; }
    var s = sanitize(raw);
    if (!s && devHooks) s = devHooks.novoPerfil();   // perfil DEV apagado em outra aba: nasce de novo com a Brasa
    if (!s) {
      state = null; ui.lobby = null; ui.result = null;
      go('inicial');
      return;
    }
    state = s;
    // o resultado já mostrado continua válido (também os duelos de um desafio já gravado, a tela de desafio e o cartão entre eles)
    if (ui.screen === 'corrida' || ui.screen === 'resultado' || ui.screen === 'entreduelos' || ui.screen === 'desafio') return;
    ui.notice = 'O jogo foi atualizado em outra aba; este é o progresso mais recente.';
    ui.lobby = null;
    // com o uso de um item aberto (escolha do cavalo, da skill ou a confirmação), a tela fica: ela é desenhada de novo com o
    // save adotado e confere tudo outra vez (o cavalo que saiu, virou o ativo com a sala aberta ou o item que acabou)
    if (ui.item && (ui.screen === 'loja' || ui.screen === 'montaria')) { itemPasso(); return; }
    // na subtela do ginásio, também: o preparo é desenhado de novo com o save adotado e confere tudo outra vez (o "Desafiar"
    // apagado com o motivo); o progresso que andou volta à trilha; o resumo de um desafio já gravado continua
    // (o aviso de uma gravação que falhou nesta aba sai: o save agora é o da outra aba)
    if (ui.screen === 'ginasio' && ui.gym) { ui.gym.msg = null; rerenderKeepScroll(); return; }
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
    return iconeHtml('el-' + element, '<canvas class="icone" data-icon="' + esc(element) + '" aria-hidden="true"></canvas>');
  }

  // Retrato: baia com parede de tábuas e palha; cavalo parado (respira, pisca, abana o rabo,
  // descansa um posterior e abaixa a cabeça de vez em quando).
  var PORTRAIT_W = 48, PORTRAIT_H = 36;
  // opts.selo: moldura com o selo "Nv N" no canto (e, com opts.pontos > 0, o aviso "+N" dos pontos que sobram para
  // distribuir enquanto algum cabe: pontosQueCabem);
  // opts.jockey: montado (seda opts.silks, a sua por padrão; jóquei opts.joquei, o seu por padrão). Marcas e raridade
  // do cavalo sempre (opcoesVisuais).
  // opts.tamanho: 'pequeno' (linha do Estábulo) ou 'grande' (ficha) desenha na PORTRAIT_SCALE_PEQUENO ou _GRANDE, no
  // lugar da PORTRAIT_SCALE. O canvas sai do tamanho da escala: nunca é encolhido pelo CSS (fica nítido).
  function escalaRetrato(tamanho) {
    return tamanho === 'pequeno' ? PORTRAIT_SCALE_PEQUENO : tamanho === 'grande' ? PORTRAIT_SCALE_GRANDE : PORTRAIT_SCALE;
  }
  // Na grade de pixel (etapa 1b da direção de arte, guia §2 e §7): o retrato tem um tamanho em pixels de arte e sai na
  // escala da grade (gradeS); o cavalo aparece 1:1 (1 pixel do molde = 1 pixel de arte) em todos os tamanhos — o grande
  // mostra mais baia, não um cavalo maior. O cavalo parado tem ~52 px até as orelhas: a baia tem pelo menos 56 de altura.
  var RETRATO_ARTE = { normal: [96, 72], pequeno: [64, 56], grande: [160, 96] };
  function setupCanvasGrade(cv, artW, artH) {
    var r = dpr(), k = gradeS || Math.max(1, Math.round(1.5 * r));
    cv.width = artW * k; cv.height = artH * k;
    cv.style.width = (artW * k / r) + 'px'; cv.style.height = (artH * k / r) + 'px';
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { ctx: ctx, k: k };
  }
  function portraitHtml(horse, opts) {
    opts = opts || {};
    var id = portraitQueue.length;
    portraitQueue.push({ horse: horse, opts: opts });
    var tam = opts.tamanho === 'pequeno' || opts.tamanho === 'grande' ? opts.tamanho : '';
    var cv = '<canvas class="retrato' + (tam ? ' retrato--' + tam : '') + '" data-retrato="' + id + '" role="img" aria-label="' +
      esc('Retrato de ' + horse.name) + '"></canvas>';
    if (!opts.selo) return cv;
    var pts = opts.pontos > 0 ? '<span class="pontos-livres pontos-livres--selo" title="' +
      esc((opts.pontos === 1 ? 'Sobra 1 ponto' : 'Sobram ' + opts.pontos + ' pontos') + ' para distribuir na aba Status') + '">+' + esc(opts.pontos) +
      (opts.tamanho === 'grande' ? '<span class="sr">' + esc(opts.pontos === 1 ? ' ponto para distribuir' : ' pontos para distribuir') + '</span>' : '') + '</span>' : '';
    return '<span class="retrato-moldura">' + cv + '<span class="selo-nivel">Nv ' + esc(horse.level) + '</span>' + pts + '</span>';
  }

  // Opções da parte 2a (spec 2026-11-12-cavalos-marcas) para o Sprites.drawHorse de qualquer cavalo (montaria,
  // modelo do catálogo ou rival): marcas (marcasDe), semente do padrão (Breed.hashChave da chave: o uid da montaria
  // ou o id do modelo; o rival usa o id do modelo, sem o sufixo da raia), jóquei ({ padrao, capacete }; null quando o desenho não tem jóquei), raridade e
  // movimento reduzido; e o porte da parte 2b (Breed.porteDe, com a mesma chave das marcas: o rival, cópia do modelo,
  // fica com o porte do modelo). Só desenho. Usada no retrato (estábulo, ficha, sala, Haras...), na corrida (com rastro:
  // true; o porte vai também às âncoras e à caixa do cavalo) e no pódio; quem desenha várias vezes calcula uma vez e
  // atualiza o `reduzido` a cada quadro.
  function opcoesVisuais(horse, joquei) {
    var chave = horse.uid || horse.id;
    // rival: o id da raia é id do modelo + '-b<n>'; a semente (e as manchas) vêm do modelo, como no Haras e no catálogo
    var sem = horse.uid ? chave : String(chave).replace(/-b\d+$/, '');
    return {
      marcas: marcasDe(horse.marcas, horse.templateId, chave), semente: BRD.hashChave(sem), joquei: joquei || null,
      raridade: horse.rarity, reduzido: reduced(), porte: BRD.porteDe(horse.porte, horse.templateId, chave)
    };
  }
  // copia as opções visuais (vis) para as opções de desenho (o) e devolve o
  function comVisuais(o, vis) {
    for (var k in vis) if (hasOwn(vis, k)) o[k] = vis[k];
    return o;
  }
  // O seu jóquei vale para todos os seus cavalos; os rivais têm o deles, da seed da sala e da raia j (índice em
  // L.racers): 1 sorteio para o padrão e 1 para o capacete. Calculado ao desenhar: a sala (salva ou não) não guarda.
  function joqueiDoJogador() { return state && state.joquei ? state.joquei : joqueiInicial(); }
  function joqueiDoCorredor(L, j) {
    if (L.racers[j].isPlayer) return joqueiDoJogador();
    var J = GD.JOQUEI, rng = RS.mulberry32(RS.hash2(L.seed, 0x4A4F0000 + j));
    var padrao = J.padroes[Math.floor(rng() * J.padroes.length)];
    return { padrao: padrao, capacete: J.capacetes[Math.floor(rng() * J.capacetes.length)] };
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
        var dim = RETRATO_ARTE[o.tamanho === 'pequeno' || o.tamanho === 'grande' ? o.tamanho : 'normal'], RW = dim[0], RH = dim[1];
        if (o.tamanho === 'grande') {   // a ficha: de borda a borda da coluna (menos a moldura de 6 px de cada lado), em pixels de arte inteiros
          var kG = gradeS || Math.max(1, Math.round(1.5 * dpr())), caixa = cv.parentNode && cv.parentNode.parentNode;
          var largG = caixa && caixa.clientWidth ? caixa.clientWidth - 12 : RW * kG / dpr();
          RW = clamp(Math.floor(largG * dpr() / kG), 112, 256);
        }
        var s = setupCanvasGrade(cv, RW, RH);
        var seed = (horse.name.charCodeAt(0) || 0) + (horse.name.length * 3);
        var phase = (seed % 10) * 0.37;
        var vis = opcoesVisuais(horse, o.jockey ? (o.joquei || joqueiDoJogador()) : null);
        var item = {
          drawn: false,
          draw: function (t) {
            if (item.drawn && reduced()) return;
            item.drawn = true;
            drawStall(s.ctx, s.k, RW, RH, seed);
            // o molde 1:1 na grade, com os cascos na palha e o corpo no meio da baia (sem moldes, o desenho por código)
            vis.reduzido = reduced();
            SP.drawHorse(s.ctx, Math.round((RW - 40) / 2) * s.k, (RH - 37) * s.k, comVisuais({
              palette: horse.palette, element: horse.element, idle: true, t: reduced() ? 0.5 : t + phase,
              scale: s.k, jockey: !!o.jockey, silks: o.silks || PLAYER_SILKS,
              quadro: { topo: 0, base: (RH - 3) * s.k, grade: s.k, centro: Math.round(RW / 2) * s.k }
            }, vis));
          }
        };
        item.draw(0);
        vivo(item, cv);
      })(ps[j]);
    }
    var perfis = root.querySelectorAll('canvas[data-perfil]');
    for (var q = 0; q < perfis.length; q++) drawProfileCanvas(perfis[q]);
    var podios = root.querySelectorAll('canvas[data-podio]');
    for (var z = 0; z < podios.length; z++) setupPodium(podios[z]);
    var cenas = root.querySelectorAll('canvas[data-cena]');
    for (var w = 0; w < cenas.length; w++) drawGinCena(cenas[w]);
  }

  // ===========================================================================
  // Fragmentos de UI
  // ===========================================================================
  // Elemento para mostrar: o do catálogo ou, para as skills gerais (element 'geral') e qualquer valor
  // desconhecido, o grupo "Geral" (ícone el-geral).
  var EL_GERAL = { id: 'geral', name: 'Geral' };
  function elementOf(element) { return hasOwn(GD.ELEMENTS, element) ? GD.ELEMENTS[element] : EL_GERAL; }
  function elementHtml(element) {
    var el = elementOf(element);
    return '<span class="el el--' + esc(el.id) + '">' + iconHtml(el.id) + esc(el.name) + '</span>';
  }
  function rarityHtml(rarity) {
    var r = GD.RARITIES[rarity] || GD.RARITIES.comum;
    return '<span class="raridade raridade--' + esc(r.id) + '">' + raridadeIcone(r.id) + esc(r.name) + '</span>';
  }
  function leagueHtml(rating) {
    var L = RS.leagueFor(rating), ic = ligaIcone(L.id);
    // com o ícone, o quadradinho colorido (::before) sai: o escudo faz o papel dele
    return '<span class="liga liga--' + esc(L.id) + (ic ? ' liga--icone' : '') + '">' + ic + 'Liga ' + esc(L.name) + '</span>';
  }
  // Barras até o teto único dos status (RaceSim.TUNING.statMax, 150) em 30 segmentos inteiros (cada um = 5
  // pontos): nada de meio segmento. b (opcional): o valor de antes; o que passa dele fica .extra (o rascunho).
  var BARRA_SEG = 30;
  function barHtml(v, b) {
    var porSeg = RS.TUNING.statMax / BARRA_SEG;
    var fill = clamp(Math.round(v / porSeg), 0, BARRA_SEG), base = b == null ? fill : clamp(Math.round(b / porSeg), 0, BARRA_SEG);
    var out = '';
    for (var i = 0; i < BARRA_SEG; i++) {
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
      out += '<dt title="' + esc(info.name + ': ' + info.desc) + '">' + statIcon(k) + '<span>' + esc(info.short) + '</span>' + ajudaBtn(k, info.name) + '</dt>' +
        '<dd><div class="barra barra--seg" role="img" aria-label="' + esc(info.name + ' ' + v) + '">' + barHtml(v, b) + '</div></dd>' +
        '<dd class="valor">' + v + delta + '</dd>';
    });
    return out + '</dl>';
  }
  // semNivel: o nível já está no selo do retrato (a linha diz só "XP")
  function xpHtml(level, xp, semNivel) {
    var need = E.xpToLevel(level);
    var maxed = level >= (E.maxLevel || 50);
    var pct = maxed ? 100 : clamp(xp / need * 100, 0, 100);
    return '<div class="xp"><div class="xp-linha">' + (semNivel ? '<span>XP</span>' : '<span class="nivel">Nv ' + level + '</span>') + '<span>' +
      (maxed ? 'Nível máximo' : fmt(xp) + ' / ' + fmt(need) + ' XP') + '</span></div>' +
      '<div class="barra barra--xp" role="img" aria-label="' + esc('Experiência ' + Math.round(pct) + '%') + '"><i style="width:' + (Math.round(pct / 5) * 5) + '%"></i></div></div>';
  }
  // tam: tamanho do ícone (32 na aba Skills; 16 no resto)
  function skillHtml(id, tam, quando) {
    var sk = hasOwn(GD.SKILLS, id) ? GD.SKILLS[id] : null;
    if (!sk) return '';
    return '<div class="habilidade"><b>' + skillIcone(id, tam) + esc(sk.name) + '</b><span>' + esc(sk.desc) + '</span>' +
      (quando ? '<span class="habilidade-quando">' + esc(quando) + '</span>' : '') + '</div>';
  }
  // Porcentagem para texto: inteira quando é redonda, senão com uma casa ("44,5%").
  function pctTxt(x) {
    var v = Math.round(x * 1000) / 10;
    return (v === Math.round(v) ? String(v) : v.toFixed(1).replace('.', ',')) + '%';
  }
  // Quando cada skill de vaga tenta ativar (o gatilho dela, GameData.SKILLS[id].trigger), com os números da corrida
  // (RaceSim.TUNING) e, na arrancada final, o ponto da pista deste cavalo (RaceSim.garraInfo). Cada skill tenta uma vez
  // por corrida; as de bloco (blockScoped: Drift, Fôlego de Montanha, Casco Firme), uma vez em cada curva ou subida.
  function skillQuandoTxt(id, m) {
    var sk = hasOwn(GD.SKILLS, id) ? GD.SKILLS[id] : null;
    if (!sk) return '';
    var t = sk.trigger, T = RS.TUNING, bloco = !!(sk.effect && sk.effect.blockScoped), q;
    if (t === 'start') q = 'na largada';
    else if (t === 'straight') q = 'na 1ª reta de ' + T.straightMinM + ' m ou mais (fora a da largada)';
    else if (t === 'curve') q = bloco ? 'ao entrar em cada curva' : 'ao entrar na 1ª curva';
    else if (t === 'curveExit') q = 'ao sair da 1ª curva';
    else if (t === 'hill') q = bloco ? 'ao entrar em cada subida' : 'ao entrar na 1ª subida';
    else if (t === 'lowStamina') q = 'quando a estamina cai a ' + pctTxt(T.lowStaminaAt);
    else if (t === 'final') q = 'na arrancada final, aos ' + pctTxt(RS.garraInfo(m).from) + ' da pista (junto com a Garra)';
    else if (t === 'dice') q = 'antes do 1º Dado da Sorte';
    else if (t.indexOf('weather:') === 0 && hasOwn(GD.WEATHERS, t.slice(8))) q = 'quando o clima for ' + GD.WEATHERS[t.slice(8)].name;
    else return '';
    return 'Quando: ' + q + (bloco ? '' : ' · 1 vez por corrida') + '.';
  }
  // A chance de cada skill de vaga ativar quando o momento dela chega, com a conta (RaceSim.skillChance): a base da
  // raridade, + por nível acima do 1, + por ponto de Sorte; o teto do TUNING.
  function skillChanceHtml(m) {
    var T = RS.TUNING, st = RS.computeStats(m), rar = RS.rarityOf(m), nv = RS.sanitizeLevel(m.level);
    var total = RS.skillChance(m, st, 0), bruto = rar.skillChance + T.skillPerLevel * (nv - 1) + T.skillPerSorte * st.sorte;
    var conta = rar.name + ' ' + pctTxt(rar.skillChance) + ' + nível ' + nv + ': +' + pctTxt(T.skillPerLevel * (nv - 1)).replace('%', '') + ' + Sorte ' + st.sorte +
      ': +' + pctTxt(T.skillPerSorte * st.sorte).replace('%', '') + (bruto > T.skillChanceMax ? '; máximo ' + pctTxt(T.skillChanceMax) : '');
    return '<p class="skill-chance">Chance de cada skill ativar: <strong>' + pctTxt(total) + '</strong> (' + esc(conta) + ').</p>';
  }
  // A Garra deste cavalo (RaceSim.garraInfo, as contas da corrida, sem clima): onde a arrancada começa, a chance e o teto;
  // com a Arrancada Final, os números se ela ativar.
  function garraInfoHtml(m) {
    var g = RS.garraInfo(m), st = RS.computeStats(m), linhas = [];
    linhas.push('1 vez por corrida, aos ' + pctTxt(g.from) + ' da pista: ' + pctTxt(g.chance) + ' de chance' + (g.tipo ? ' (com a ' + RS.typeSkill(m).name + ')' : '') +
      '. Se der certo: velocidade máxima ×' + g.boost.toFixed(2).replace('.', ',') + ' até a chegada.');
    if (m.skills.indexOf('arrancada-final') >= 0 && hasOwn(GD.SKILLS, 'arrancada-final')) {
      var e = GD.SKILLS['arrancada-final'].effect, gb = RS.garraInfo(m, { chance: e.garraChanceBonus, boost: e.garraBoostBonus });
      linhas.push('Com a ' + GD.SKILLS['arrancada-final'].name + ' ativa: ' + pctTxt(gb.chance) + ' de chance e ×' + gb.boost.toFixed(2).replace('.', ',') + '.');
    }
    linhas.push('Mais Garra: começa antes, com mais chance e mais força.');
    return '<div class="habilidade habilidade--garra"><b>' + iconeHtml('st-garra', '', 32) + 'Garra ' + st.garra + ' · todo cavalo tem</b>' +
      linhas.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>';
  }
  // Skill de tipo: vaga própria, sempre ativa, num terço da pista; o efeito já multiplicado pela força P
  // (RaceSim.typeSkill), os mesmos números que a simulação usa.
  var TERCOS = ['primeiro terço', 'terço do meio', 'último terço'];
  function num1(x) { return (Math.round(x * 10) / 10).toFixed(1).replace('.', ','); }
  function tercoTxt(ts) { return TERCOS[clamp(Math.round(ts.zone[0] * 3), 0, 2)]; }
  function efeitoTipoTxt(ts, el) {
    var e = ts.effect, P = ts.power, out = [];
    // bloco 1b: os dois status do tipo valem × (1 + statMul·P) no terço (RaceSim.TYPE_STATS)
    if (e.statMul) {
      var nomes = (RS.TYPE_STATS[el] || []).map(function (k) { return GD.STATS[k].name; }).join(' e ');
      out.push(nomes + ' +' + num1(e.statMul * P * 100) + '%');
    }
    if (e.accelMult) out.push('+' + num1(e.accelMult * P * 100) + '% de aceleração');
    if (e.forcaAdd) out.push('+' + num1(e.forcaAdd * P * 100) + ' de Força' + (e.manAdd ? ' e de Manobra' : ''));
    if (e.drainCut) out.push('−' + num1(e.drainCut * P * 100) + '% de gasto de fôlego');
    if (e.speedMult) out.push('+' + num1(e.speedMult * P * 100) + '% de velocidade');
    if (e.staminaRestore) out.push('recupera ' + num1(e.staminaRestore * P * 100) + '% do fôlego ao entrar');
    return out.join(' · ');
  }
  // Efeito da skill de tipo em pontos de status para este cavalo (spec 1b §5 e §11): no terço, cada status do tipo
  // vale status × (1 + statMul·P), então ganha status × statMul·P, dos status atuais (sem o clima, que a corrida soma
  // por fora). "Velocidade e Aceleração +12 no 1º terço"; se os dois ganhos diferem, um número para cada status.
  // '' para skill sem statMul (chaves antigas, sem uso).
  var TERCO_ORD = ['1º', '2º', '3º'];
  function efeitoTipoPontosTxt(horse, ts) {
    var e = ts.effect, keys = e.statKeys || RS.TYPE_STATS[horse.element] || [];
    if (!e.statMul || !keys.length) return '';
    var st = RS.computeStats(horse), mul = e.statMul * ts.power;
    var ganhos = keys.map(function (k) { return Math.round(st[k] * mul); });
    var nomes = keys.map(function (k) { return GD.STATS[k].name; });
    var onde = ' no ' + TERCO_ORD[clamp(Math.round(ts.zone[0] * 3), 0, 2)] + ' terço';
    if (ganhos.every(function (g) { return g === ganhos[0]; })) return nomes.join(' e ') + ' +' + ganhos[0] + onde;
    return nomes.map(function (n, i) { return n + ' +' + ganhos[i]; }).join(' e ') + onde;
  }
  function vagaTipoHtml(horse) {
    var ts = RS.typeSkill(horse);
    if (!ts) return '';
    var el = elementOf(horse.element), def = GD.TYPE_SKILLS[horse.element];
    var pontos = efeitoTipoPontosTxt(horse, ts);
    return '<div class="vaga-tipo vaga-tipo--' + esc(el.id) + '"><span class="vaga-tipo-rotulo">Skill de tipo · sempre ativa' + ajudaBtn('skillTipo', 'a skill de tipo') + '</span>' +
      '<b>' + skillIcone(ts.id, 32) + esc(ts.name) + '</b>' +
      (pontos ? '<span class="vaga-tipo-pontos">' + esc(pontos) + '</span>' + '<span>' + esc(def.desc) + '</span>'
        : '<span>' + esc('Age no ' + tercoTxt(ts) + ' da pista: ' + efeitoTipoTxt(ts, horse.element) + '.') + '</span>') +
      '<span class="vaga-tipo-forca">' + esc('Intensidade ×' + ts.power.toFixed(2).replace('.', ',')) + '</span></div>';
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
      if (!p) return '<span class="slot slot--vazio" title="' + esc(info.name + ': vazio') + '">' + iconeHtml('slot-' + slot, '') + '—</span>';
      return '<span class="slot slot--cheio" title="' + esc(GD.GEAR[p.id].name + ' +' + p.plus) + '">' + iconeHtml('slot-' + slot, '') + '+' + p.plus + '</span>';
    }).join('');
    return '<div class="slots" aria-label="Equipamento">' + slots + setBadgeHtml(gear) + '</div>';
  }

  // ===========================================================================
  // Navegação (+ botão Voltar do Android/navegador)
  // ===========================================================================
  // Tipos de tela: 'aba' (raiz, com cabeçalho e barra; não empilha histórico), 'sub' (com cabeçalho e barra;
  // empilha um estado e o Voltar devolve a ui.tab) e 'full' (tela cheia, sem casca).
  var SCREEN_KIND = { bloqueio: 'full', inicial: 'full', estabulo: 'aba', correr: 'aba', expedicao: 'aba', haras: 'aba', loja: 'aba', montaria: 'sub', perfil: 'sub', ginasio: 'sub', largada: 'full', corrida: 'full', desafio: 'full', entreduelos: 'full', resultado: 'full' };
  // as 5 abas da barra (o handler 'aba' só abre as desta lista; o wiki lê esta linha). A Loja (itens e mochila, spec de
  // itens §6) fica sempre: o que é do equipamento dentro dela (peças e Pedras Negras) continua atrás do GEAR_ON
  var ABAS = [{ id: 'estabulo', icone: '🐴', rotulo: 'Estábulo' }, { id: 'correr', icone: '🏁', rotulo: 'Correr' }, { id: 'expedicao', icone: '🧭', rotulo: 'Expedição' }, { id: 'haras', icone: '💞', rotulo: 'Haras' }, { id: 'loja', icone: '🛒', rotulo: 'Loja' }];
  function abaVisivel(id) { return ABAS.some(function (a) { return a.id === id; }); }
  function kindOf(screen) { return hasOwn(SCREEN_KIND, screen) ? SCREEN_KIND[screen] : 'full'; }
  var guardPushed = false, ignorePop = false;
  // a rolagem é do jogo (go() volta ao topo; o "Voltar" da ficha rola até a linha do cavalo no Estábulo): o navegador não
  // a restaura por cima quando o history.back() do guarda volta à entrada da aba
  try { if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'; } catch (e) { /* ignora */ }
  function isRoot(screen) { return kindOf(screen) === 'aba' || screen === 'inicial' || screen === 'bloqueio'; }
  function syncHistory(screen) {
    try {
      if (!isRoot(screen) && !guardPushed) { window.history.pushState({ galope: 1 }, ''); guardPushed = true; }
      else if (isRoot(screen) && guardPushed) { guardPushed = false; ignorePop = true; window.history.back(); }
    } catch (e) { guardPushed = false; }
  }
  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop = false; return; }
    guardPushed = false;
    if (ui.screen === 'corrida') corridaAtual().voltar();
    else if (ui.screen === 'entreduelos' || ui.screen === 'desafio') ginPulaTudo();   // o cartão e a tela de desafio: vale como "Pular tudo" (Ruling 23)
    else if (!isRoot(ui.screen) && state) voltaDaSubtela();
  });

  // Toque duplo no "Largar!": o 2º toque não pode cair no "Pular" da corrida que acabou de abrir (com a Galmuri, a tela da
  // corrida ficou mais baixa e o "Pular" passou a ficar onde estava o "Largar!"). Um clique que é o 2º de um toque duplo
  // (event.detail ≥ 2) até PULAR_GUARDA_MS depois de a corrida abrir não pula; um toque de propósito no "Pular", por mais
  // rápido que seja, é um clique simples (detail 1) e vale, como o teclado (detail 0).
  var PULAR_GUARDA_MS = 1000, corridaDesde = 0;
  function go(screen) {
    if (screen === 'corrida' && ui.screen !== 'corrida') corridaDesde = Date.now();
    if (saveBloqueado) screen = 'bloqueio';   // a tela de bloqueio não tem saída (só o Recarregar)
    // sem o que mostrar, a navegação leva a um lugar que existe: sem cartão, o resumo (ou o Estábulo); sem corrida, a aba
    // Correr (não acontece: só garante que a tela de corrida e o cartão nunca são desenhados vazios)
    if (screen === 'entreduelos' && !ginTemCartao()) { if (ui.gym) ui.gym.ver = null; screen = ui.gym && ui.gym.res ? 'ginasio' : 'estabulo'; }
    if (screen === 'desafio' && !(ui.gym && ui.gym.ver && ui.gym.res && ui.gym.res.duelos[ui.gym.ver.k])) { if (ui.gym) ui.gym.ver = null; screen = ui.gym && ui.gym.res ? 'ginasio' : 'estabulo'; }
    if (screen === 'corrida' && !corridaAtual().L) screen = state ? 'correr' : 'inicial';
    if (raceView && screen !== 'corrida') { raceView.destroy(); raceView = null; }
    ui.item = null; ui.itemMsg = null;   // o uso de item aberto e o aviso dele não passam para outra tela
    if (screen !== ui.screen) {
      ui.confirmReset = false; ui.confirmLiberar = null; ui.diariaVer = false;
      SP.limparCacheMoldes();   // os moldes recoloridos da tela anterior não voltam a ser usados
    }
    // voltar de uma sub-tela (Perfil, Montaria) para a mesma aba de origem preserva o estado do Haras e da Loja
    var voltaMesmaAba = kindOf(ui.screen) === 'sub' && screen === ui.tab;
    if (screen === 'haras' && ui.screen !== 'haras' && !voltaMesmaAba) ui.haras = newHaras();
    if (screen !== 'montaria') ui.montaria = null;   // sair da Montaria descarta o "Desfazer venda" e a confirmação
    // a trilha (e o detalhe da etapa) só vive na subtela do ginásio; os duelos de um desafio pago (ui.gym.ver) passam na
    // tela de desafio, na tela de corrida e no cartão entre eles, e saem ao ir a qualquer outra tela
    var assiste = !!(ui.gym && ui.gym.ver) && (screen === 'corrida' || screen === 'entreduelos' || screen === 'desafio');
    if (screen !== 'ginasio' && !assiste) ui.gym = null;
    else if (!assiste && ui.gym) ui.gym.ver = null;
    // a Loja guarda o estado enquanto uma sub-tela aberta a partir dela está por cima
    if (screen !== 'loja' && !(kindOf(screen) === 'sub' && ui.tab === 'loja')) ui.loja = null;
    // entrar na aba Loja abre na parte Comprar (voltar de uma sub-tela aberta a partir dela mantém a parte)
    if (screen === 'loja' && ui.screen !== 'loja' && !voltaMesmaAba) { ui.lojaParte = 'comprar'; ui.lojaMsg = null; }
    if (kindOf(screen) === 'aba') ui.tab = screen;   // a barra de abas lê ui.tab
    ui.screen = screen;
    if (appEl) appEl.classList.toggle('app--corrida', screen === 'corrida');
    render();
    try { window.scrollTo(0, 0); } catch (e) { /* ignora */ }
    var h = telaEl.querySelector('[data-foco]');
    if (h) { try { h.focus({ preventScroll: true }); } catch (e2) { h.focus(); } }
    syncHistory(screen);
  }
  // "Voltar" (ou o voltar do aparelho) de uma sub-tela (Montaria, Perfil) para a aba de origem. Da ficha para o Estábulo
  // o foco vai para a linha daquele cavalo, não para o título (3b, Review Focus 2), e a página rola só o que precisar
  // para a linha aparecer (o scroll-padding desconta o cabeçalho e a barra de abas)
  function voltaDaSubtela() {
    // ginásio: do detalhe da etapa volta à trilha (foco na etapa); da trilha, à aba (foco no cartão do ginásio)
    // do resumo do desafio, à trilha (já atualizada), mostrando a etapa próxima como ao abrir
    if (ui.screen === 'ginasio' && ui.gym) {
      var gym = ui.gym;
      if (gym.res) {
        gym.res = null; gym.etapa = null; gym.time = []; gym.msg = null;
        go('ginasio');
        mostraInteiro(telaEl.querySelector('.etapa[data-estado="proxima"], .etapa[data-estado="revanche"]'));
        return;
      }
      if (gym.etapa !== null) { var ie = gym.etapa; gym.etapa = null; go('ginasio'); focoNaLinha('ginasio-etapa', String(ie)); return; }
      go(ui.tab);
      if (ui.screen === 'expedicao') focoNaLinha('ginasio-abrir', gym.id);
      return;
    }
    var uid = ui.screen === 'montaria' && ui.montaria ? ui.montaria.uid : null;
    go(ui.tab);
    if (!uid || ui.screen !== 'estabulo') return;
    focoNaLinha('montaria', uid);
  }
  // rola a página na hora (sem animação) só o que precisar para el ficar inteiro entre o cabeçalho fixo (com a faixa DEV
  // acima dele) e a barra de abas. A barra é a de baixo quando o topo dela está na metade de baixo da janela; senão é a
  // coluna da esquerda (900 px ou mais) e o limite é o fim da janela. Decide pela posição, não pela largura: com a barra de
  // rolagem clássica a barra de baixo fica mais estreita que a janela. Não mexe no foco; sem el, ou já inteiro, não rola.
  function mostraInteiro(el) {
    if (!el) return;
    var topoEl = document.querySelector('.app-topo'), abasEl = document.querySelector('.app-abas');
    var topo = topoEl ? topoEl.getBoundingClientRect().bottom : 0, base = window.innerHeight;
    if (abasEl) { var ab = abasEl.getBoundingClientRect(); if (ab.top > window.innerHeight / 2) base = ab.top; }
    var r = el.getBoundingClientRect(), dy = 0;
    if (r.bottom > base) dy = r.bottom - base;
    if (r.top - dy < topo) dy = r.top - topo;   // mais alto que o espaço: o topo dele fica à vista
    if (dy) window.scrollTo({ top: window.scrollY + dy, left: 0, behavior: 'instant' });
  }
  // o foco no botão (acao, id) e a página rolando só o que precisar para ele aparecer
  function focoNaLinha(acao, id) {
    focusAction(acao, id);
    var el = document.activeElement;
    if (!el || el.getAttribute('data-id') !== id || !el.scrollIntoView) return;
    try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { el.scrollIntoView(false); }
  }

  /*@dev:inicio*/
  // ===========================================================================
  // Modo DEV (DEV_MODE: ?dev=1 ou o build jogo-dev.html): perfil de teste, faixa no topo, botão "DEV" e gaveta
  // ---------------------------------------------------------------------------
  // - Save: SAVE_KEY = Dev.SAVE_KEY ('galope-elemental:dev'); o save real nunca é lido nem gravado.
  //   Perfil novo (ou apagado) nasce com a Brasa, sem a escolha inicial (devNovoPerfil). "Zerar perfil de
  //   teste" (confirmação em dois passos na gaveta: window.confirm não abre num iframe sem allow-modals) faz o
  //   mesmo (devZerarPerfil). O "Recomeçar com outro inicial" do Perfil volta à escolha, como no jogo real
  //   (devRecomecaEscolha, com a marca devEscolha).
  // - "Voltar ao jogo real" é um link para a página sem dev=1; no build jogo-dev.html vira um aviso curto.
  // - Ouro infinito (ui.dev.ouroInf, ligado por padrão): persist() chama Dev.refillGold.
  // - O painel cria cavalos fora das regras: sanitize aceita o templateId 'dev-<n>' e qualquer skill
  //   do catálogo (devTemplateId, validSkills); o estábulo cresce sem limite de vagas.
  // - Próxima corrida: ui.devNext = { seed, cond, wind, skillsAlways } (cond = filtro de Dev.conditions,
  //   sem a sala; null = nada armado). buildLobby aplica seed e condições e grava L.dev = { wind,
  //   skillsAlways } para a tela da corrida; settle passa skillsAlways ao RaceSim e limpa ui.devNext.
  // - A gaveta mora em #dev (fora de #tela): re-renderizar a tela não perde a rolagem dela; os campos
  //   ficam em ui.dev.f (lidos do DOM a cada mudança e antes de cada ação).
  // As funções puras (cavalo, peça, condições, vento, seed, Ouro) estão em dev.js.
  // ===========================================================================
  var DEV_SKILL_VAGAS = 5;   // selects de skill na gaveta (o máximo de vagas, Mítico)
  var DEV_DIAS_MAX = 400;   // "Avançar/Voltar 1 dia": deslocamento de −400 a 400 dias (state.devDias, só no save de teste)
  var devEl = null;
  if (DEV_MODE) {
    devEl = document.createElement('div');
    devEl.className = 'dev-painel';
    devEl.id = 'dev';
    devEl.setAttribute('role', 'region');
    devEl.setAttribute('aria-label', 'Modo DEV');
    (appEl || document.body).appendChild(devEl);
  }

  function devTemplateId(id) { return DEV_MODE && /^dev-\d{1,9}$/.test(String(id)); }

  // perfil de teste novo: a Brasa (com o Ouro infinito já aplicado); quem chama decide se grava
  function devNovoPerfil() {
    var st = newState('brasa');
    if (ui.dev.ouroInf) DV.refillGold(st);
    return st;
  }
  // "Recomeçar com outro inicial" (Perfil) no modo DEV, como no jogo real (pedido do Vinicius, 2026-11-18): o save de
  // teste é apagado e a tela volta à escolha do inicial. A marca em SAVE_KEY + ':escolha' segura a escolha se a aba
  // recarregar antes de escolher (sem ela, a abertura do DEV criaria a Brasa); o "Escolher" apaga a marca.
  // devEscolha(): a marca existe? devEscolha(true/false): põe ou tira.
  var DEV_ESCOLHA_KEY = SAVE_KEY + ':escolha';
  function devEscolha(liga) {
    try {
      if (liga === undefined) return window.localStorage.getItem(DEV_ESCOLHA_KEY) === '1';
      if (liga) window.localStorage.setItem(DEV_ESCOLHA_KEY, '1');
      else window.localStorage.removeItem(DEV_ESCOLHA_KEY);
    } catch (e) { /* sem armazenamento: vale só nesta aba */ }
    return false;
  }
  // depois de apagar o save de teste para a escolha: a gaveta, a próxima corrida armada e os campos voltam ao começo
  function devRecomecaEscolha() {
    ui.devNext = null; ui.dev.f = null; ui.dev.confirmZerar = false; ui.dev.aberto = false; ui.dev.msg = '';
    devEscolha(true);
  }
  // "Zerar perfil de teste" (gaveta) no modo DEV: o save de teste volta à Brasa, sem a escolha inicial; a opção
  // Animações e o jóquei continuam. Quem chama navega.
  function devZerarPerfil() {
    var motion = motionPref(), joquei = validJoquei(joqueiDoJogador());
    if (!wipeSave()) return;   // save de versão mais nova: tela de bloqueio
    state = devNovoPerfil();
    state.settings.motion = motion;
    state.joquei = joquei;   // o jóquei continua, como no "Recomeçar" do jogo real
    ui.lobby = null; ui.result = null; ui.devNext = null; ui.dev.f = null; ui.dev.confirmZerar = false; ui.confirmReset = false;
    persist();
    ui.dev.msg = 'Perfil de teste zerado: começa de novo com a Brasa.';
    ui.dev.aberto = false;        // a gaveta fecha (senão cobre a barra de abas); o aviso aparece no estábulo
    ui.notice = ui.dev.msg;
  }

  // condições da sala com o filtro do painel por cima; o que não foi forçado segue a sala normal
  function devCondicoes(f, base, seed) {
    var forced = DV.conditions(f, base), c = {}, k;
    for (k in base) if (hasOwn(base, k)) c[k] = base[k];
    for (k in forced) if (hasOwn(forced, k)) c[k] = forced[k];
    return RS.normalizeConditions(c, seed);
  }

  // cavalos prontos que o painel copia: os iniciais e os aluguéis do Haras
  function devProntos() {
    return GD.STARTERS.concat(GD.WILD_HORSES.filter(function (h) { return h.rarity !== 'mitico' && BRD.rentalPrice(h) != null; }));
  }

  // campos da gaveta (strings, como no DOM; checkboxes como booleanos)
  function devForm() {
    if (!ui.dev.f) {
      ui.dev.f = {
        pedras: null, redeas: null, 'mochila-torrao': null, 'mochila-estrela': null, 'mochila-cupom': null, 'mochila-manual': null,
        copiar: GD.STARTERS[0].id,
        slot: GR.SLOTS[0], conjunto: 'sol', rpeca: 'lendario', melhoria: '0', equipar: false,
        clima: '', piso: '', distancia: '', tracado: 'normal', blocos: '', vento: '', direcao: '1', seed: '', sempre: false
      };
      devCavaloDaAtiva();
    }
    return ui.dev.f;
  }
  // o grupo Cavalo mostra a ativa (ao abrir, depois de criar/copiar/aplicar e em "Carregar a ativa")
  function devCavaloDaAtiva() {
    var f = ui.dev.f, a = activeMount();
    var pal = a.palette || DV.horseTemplate({ element: a.element }).palette;
    f.nome = a.name; f.elemento = a.element; f.raridade = a.rarity; f.sexo = a.sex;
    // genética toda 31: "Máximo"; senão "Por status" (trocar só as estrelas ou o nível não a apaga)
    var todo31 = STAT_KEYS.every(function (k) { return a.potential[k] === 31; });
    f.nivel = String(a.level); f.potencial = todo31 ? 'max' : 'cada'; f.estrelas = String(RS.starsOf(a));
    // genética por status (vale com "Genética: por status") e pontos distribuídos, da ativa
    var al = RS.validAlloc(a, a.alloc);
    STAT_KEYS.forEach(function (k) { f['gen-' + k] = String(a.potential[k]); f['pt-' + k] = String(al[k]); });
    for (var i = 0; i < DEV_SKILL_VAGAS; i++) f['skill' + i] = a.skills[i] || '';
    f.coat = pal.coat.toLowerCase(); f.coatshade = pal.coatShade.toLowerCase();
    f.mane = pal.mane.toLowerCase(); f.accent = pal.accent.toLowerCase();
    var mk = marcasDe(a.marcas, a.templateId, a.uid);
    f.cara = mk.cara; f.patas = String(mk.patas); f.corpo = mk.corpo;
    f.porte = BRD.porteDe(a.porte, a.templateId, a.uid);
  }
  // caixas que agem na hora (não são campos de formulário): o Ouro infinito e a redistribuição grátis da ativa
  var DEV_CAIXAS_NA_HORA = { ouroinf: 1, respecfree: 1 };
  function devLerCampos() {
    var f = devForm();
    if (!devEl) return f;
    Array.prototype.forEach.call(devEl.querySelectorAll('[data-dev-campo]'), function (el) {
      var k = el.getAttribute('data-dev-campo');
      if (!hasOwn(DEV_CAIXAS_NA_HORA, k)) f[k] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return f;
  }
  function devCavaloEscolhido(f) {
    var skills = [];
    for (var i = 0; i < DEV_SKILL_VAGAS; i++) if (f['skill' + i]) skills.push(f['skill' + i]);
    var gen = {}, pts = {};
    STAT_KEYS.forEach(function (k) { gen[k] = f['gen-' + k]; pts[k] = f['pt-' + k]; });
    return {
      name: f.nome, element: f.elemento, rarity: f.raridade, sex: f.sexo,
      potential: f.potencial === 'max' ? 'max' : f.potencial === 'cada' ? gen : Number(f.potencial), skills: skills,
      grau: f.estrelas, alloc: pts,
      palette: { coat: f.coat, coatShade: f.coatshade, mane: f.mane, accent: f.accent },
      marcas: { cara: f.cara, patas: f.patas, corpo: f.corpo },
      porte: f.porte
    };
  }
  // pontos do template (inteiros ≥ 0) cortados pelo teto de 150 e pelo custo, com os pontos do nível da instância
  function devAplicaPontos(m, tpl) { m.alloc = RS.validAlloc(m, tpl.alloc); }
  function devNivel(f) { return clamp(Math.floor(Number(f.nivel)) || 1, 1, MAX_LEVEL); }
  function devDescreveCavalo(m) {
    return m.name + ' (' + GD.RARITIES[m.rarity].name + ', ' + GD.ELEMENTS[m.element].name + ', Nv ' + m.level + ')';
  }

  // entra no estábulo (sem limite de vagas no perfil DEV) e vira a ativa
  function devAdicionaCavalo(m) {
    state.mounts.push(m);
    state.stableSlots = Math.max(state.stableSlots, state.mounts.length);
    state.activeId = m.uid;
  }

  // "Próxima corrida": filtro dos campos -> ui.devNext (ou null se nada foi pedido)
  function devArmar(f) {
    var cond = {}, erros = [];
    if (f.clima) cond.weather = f.clima;
    if (f.piso) cond.surface = f.piso;
    if (f.distancia) cond.distance = Number(f.distancia);
    if (f.tracado === 'curvas' || f.tracado === 'subidas') cond.tracado = f.tracado;
    else if (f.tracado === 'lista') {
      var lista = String(f.blocos || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
      if (DV.conditions({ tracado: lista }).blocks) cond.tracado = lista;
      else erros.push('lista de blocos inválida (use reta, curva e subida, até 12)');
    }
    var seed = DV.parseSeed(f.seed);
    if (seed == null && String(f.seed || '').trim()) erros.push('seed inválida (inteiro de 0 a 4294967295)');
    var wind = f.vento ? DV.wind({ intensity: f.vento, dir: Number(f.direcao) }) : null;
    var hasCond = false;
    for (var k in cond) if (hasOwn(cond, k)) hasCond = true;
    var dv = (hasCond || seed != null || wind || f.sempre)
      ? { seed: seed, cond: hasCond ? cond : null, wind: wind, skillsAlways: !!f.sempre } : null;
    return { next: dv, erros: erros };
  }
  function devResumoArmado(dv) {
    if (!dv) return 'Nada armado: a próxima sala segue o normal.';
    var p = [], c = dv.cond || {};
    if (c.weather) p.push('clima ' + GD.WEATHERS[c.weather].name);
    if (c.surface) p.push('piso ' + GD.SURFACES[c.surface].name);
    if (c.distance) p.push(DV.conditions({ distance: c.distance }).distance + ' m');
    if (c.tracado === 'curvas') p.push('mais curvas');
    else if (c.tracado === 'subidas') p.push('mais subidas');
    else if (Array.isArray(c.tracado)) p.push('blocos ' + c.tracado.join(' '));
    if (dv.wind) p.push('vento ' + dv.wind.intensity + (dv.wind.dir > 0 ? ' →' : ' ←'));
    if (dv.seed != null) p.push('seed ' + dv.seed);
    if (dv.skillsAlways) p.push('skills sempre ativam');
    return 'Armado para a próxima corrida: ' + p.join(' · ') + '.';
  }
  // a sala aberta na tela reflete o que acabou de ser armado (o resultado ainda não existe)
  function devAtualizaSala() {
    if (ui.screen === 'largada' && ui.lobby && !ui.lobby.sim && state.pending) ui.lobby = buildLobby(state.pending);
  }

  // ---- HTML da gaveta ----
  function devOpcoes(list, sel) {
    return list.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(sel) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }
  function devSelect(campo, rotulo, list, sel) {
    return '<label class="dev-campo" for="dev-' + campo + '"><span class="rotulo">' + esc(rotulo) + '</span>' +
      '<select id="dev-' + campo + '" data-dev-campo="' + campo + '">' + devOpcoes(list, sel) + '</select></label>';
  }
  function devEntrada(campo, rotulo, attrs, val) {
    return '<label class="dev-campo" for="dev-' + campo + '"><span class="rotulo">' + esc(rotulo) + '</span>' +
      '<input id="dev-' + campo + '" data-dev-campo="' + campo + '" ' + attrs + ' value="' + esc(val == null ? '' : val) + '"></label>';
  }
  function devCheck(campo, rotulo, on) {
    return '<label class="dev-check" for="dev-' + campo + '"><input type="checkbox" id="dev-' + campo + '" data-dev-campo="' + campo + '"' +
      (on ? ' checked' : '') + '><span>' + esc(rotulo) + '</span></label>';
  }
  function devBotao(acao, texto, cls) {
    return '<button type="button" class="btn btn--pequeno' + (cls ? ' ' + cls : '') + '" data-acao="' + acao + '">' + esc(texto) + '</button>';
  }
  function devGrupo(id, titulo, corpo) {
    return '<section class="caixa dev-grupo" aria-labelledby="dev-g-' + id + '"><h3 class="titulo" id="dev-g-' + id + '">' + esc(titulo) + '</h3>' + corpo + '</section>';
  }
  function devListaDe(obj, nome) {
    return Object.keys(obj).map(function (k) { return [k, nome ? nome(obj[k]) : obj[k].name]; });
  }

  function devGavetaHtml() {
    var f = devForm();
    var nomeDe = function (o) { return o.name; };
    var elementos = devListaDe(GD.ELEMENTS, nomeDe), raridades = devListaDe(GD.RARITIES, nomeDe);
    var vagas = GD.RARITIES[f.raridade] ? GD.RARITIES[f.raridade].skillSlots : 1;
    var potenciais = [['max', 'Máximo (31)'], ['cada', 'Por status (abaixo)']];
    for (var pv = 31; pv >= 0; pv--) potenciais.push([String(pv), String(pv)]);
    var skillOpts = [['', '— vazia —']].concat(Object.keys(GD.SKILLS).map(function (id) {
      var sk = GD.SKILLS[id];
      return [id, sk.name + ' · ' + elementOf(sk.element).name];
    }));
    var skillSel = '';
    for (var i = 0; i < DEV_SKILL_VAGAS; i++) skillSel += devSelect('skill' + i, 'Skill ' + (i + 1), skillOpts, f['skill' + i]);
    var prontos = devProntos().map(function (h) {
      return [h.id, h.name + ' (' + GD.RARITIES[h.rarity].name + ', ' + GD.ELEMENTS[h.element].name + ', Nv ' + (h.level || 1) + ')'];
    });
    var raridadesPeca = Object.keys(GE.price).map(function (r) { return [r, GD.RARITIES[r].name]; });
    var melhorias = [];
    for (var mv = 0; mv <= GE.plusMax; mv++) melhorias.push([String(mv), '+' + mv]);
    // marcas da montaria (parte 2a), com nomes sem símbolos
    var MARCA_NOMES = { nenhuma: 'Sem marca', estrela: 'Estrela', listra: 'Listra', frente: 'Frente branca',
      liso: 'Liso', malhado: 'Malhado', pintado: 'Pintado', ruao: 'Ruão' };
    var marcaOpts = function (gene) {
      return GD.MARCAS[gene].map(function (v) {
        return [String(v), gene === 'patas' ? (v === 0 ? 'Sem meias' : v + (v === 1 ? ' meia' : ' meias')) : MARCA_NOMES[v] || String(v)];
      });
    };
    // porte da montaria (parte 2b): os nomes do GameData, sem símbolos
    var porteOpts = GD.PORTES.valores.map(function (p) { return [p, GD.PORTES.nomes[p]]; });
    var distancias = [['', '— da sala —']];
    for (var dd = 1000; dd <= 2400; dd += 100) distancias.push([String(dd), dd + ' m']);

    var moedas = devGrupo('moedas', 'Moedas',
      devCheck('ouroinf', 'Ouro infinito (volta a ' + fmt(DV.GOLD_INF) + ' depois de cada gasto)', ui.dev.ouroInf) +
      '<div class="dev-campos">' + devEntrada('pedras', 'Pedras Negras', 'type="number" min="0" max="1000000" inputmode="numeric"', f.pedras != null ? f.pedras : state.pedras) +
        '<div class="dev-acoes dev-acoes--base">' + devBotao('dev-pedras', 'Definir Pedras') + '</div></div>' +
      // Rédeas novas (bloco 1b §9): pagam a redistribuição depois da primeira; no jogo normal vêm no 7º dia da diária
      '<div class="dev-campos">' + devEntrada('redeas', 'Rédeas novas', 'type="number" min="0" max="' + REDEAS_MAX + '" inputmode="numeric"', f.redeas != null ? f.redeas : state.redeas) +
        '<div class="dev-acoes dev-acoes--base">' + devBotao('dev-redeas', 'Definir Rédeas') + '</div></div>' +
      '<div class="dev-acoes">' + devBotao('dev-ouro', '+' + fmt(1000) + ' Ouro') + '</div>');

    // Itens e dia (spec de itens §12): a mochila, o deslocamento do dia (só no save de teste) e zerar a diária e os limites
    var desloc = inteiroOu(state.devDias, 0, -DEV_DIAS_MAX, DEV_DIAS_MAX);
    var itensDia = devGrupo('itensdia', 'Itens e dia',
      '<div class="dev-campos">' + MOCHILA_IDS.map(function (id) {
        var v = f['mochila-' + id];
        return devEntrada('mochila-' + id, GD.ITEMS[id].name, 'type="number" min="0" max="' + GD.BAG_MAX + '" inputmode="numeric"', v != null ? v : state.mochila[id]);
      }).join('') + '</div>' +
      '<div class="dev-acoes">' + devBotao('dev-mochila', 'Definir mochila') + '</div>' +
      '<p class="nota" id="dev-dia">Dia do jogo: ' + (desloc === 0 ? 'o do aparelho' : (desloc > 0 ? '+' : '−') + Math.abs(desloc) + (Math.abs(desloc) === 1 ? ' dia' : ' dias') + ' do aparelho') +
        ' (de −' + DEV_DIAS_MAX + ' a +' + DEV_DIAS_MAX + '; só no save de teste).</p>' +
      '<div class="dev-acoes">' + devBotao('dev-dia-menos', 'Voltar 1 dia') + devBotao('dev-dia-mais', 'Avançar 1 dia') + '</div>' +
      '<div class="dev-acoes">' + devBotao('dev-zerar-diaria', 'Zerar diária e limites') + '</div>');

    // Ginásios (spec dos ginásios §15): a etapa de cada trilha (5 = as cinco vencidas, com a insígnia), liberar a revanche
    // de hoje nos três e zerar o progresso (o contador de desafios fica: as seeds dos desafios nunca se repetem)
    var etapasGin = [];
    for (var ge = 0; ge <= 5; ge++) etapasGin.push([String(ge), ge === 0 ? '0 (nenhuma vencida)' : ge === 5 ? '5 (insígnia)' : ge + ' vencida' + (ge > 1 ? 's' : '')]);
    var ginasios = devGrupo('ginasios', 'Ginásios',
      '<p class="nota">Etapas vencidas de cada trilha; a 5ª é o líder e dá a insígnia (o bônus da conta vale na hora).</p>' +
      '<div class="dev-campos">' + GD.GYM_ORDER.map(function (id) {
        var v = f['gin-' + id];
        return devSelect('gin-' + id, GD.GYMS[id].name + ' (' + GD.ELEMENTS[GD.GYMS[id].element].name + ')', etapasGin, v != null ? v : String(state.ginasios[id].etapa));
      }).join('') + '</div>' +
      '<div class="dev-acoes">' + devBotao('dev-gin-etapas', 'Definir etapas') + devBotao('dev-gin-revanche', 'Liberar revanche') +
        devBotao('dev-gin-zerar', 'Zerar ginásios', 'btn--perigo') + '</div>');

    var cavalo = devGrupo('cavalo', 'Cavalo',
      '<p class="nota">Cria um cavalo novo (entra no estábulo sem limite de vagas e vira a ativa) ou substitui a ativa (status, skills, cores, marcas e porte; mantém equipamento e cruzas).</p>' +
      '<div class="dev-campos dev-campos--1">' + devEntrada('nome', 'Nome', 'type="text" maxlength="16" autocomplete="off"', f.nome) + '</div>' +
      '<div class="dev-campos">' +
        devSelect('elemento', 'Elemento', elementos, f.elemento) + devSelect('raridade', 'Raridade', raridades, f.raridade) +
        devSelect('sexo', 'Sexo', [['m', 'Macho'], ['f', 'Fêmea']], f.sexo) +
        devEntrada('nivel', 'Nível (1–' + MAX_LEVEL + ')', 'type="number" min="1" max="' + MAX_LEVEL + '" inputmode="numeric"', f.nivel) +
        devSelect('potencial', 'Genética', potenciais, f.potencial) +
        devSelect('estrelas', 'Estrelas', [['1', '1 estrela'], ['2', '2 estrelas'], ['3', '3 estrelas']], f.estrelas) +
      '</div>' +
      '<p class="nota">Genética por status (0–31, com "Genética: por status") e pontos distribuídos (cortados pelo teto de 150 e pelo custo por faixa, com os pontos do nível; a Sorte não recebe pontos).</p>' +
      '<div class="dev-campos dev-campos--4">' + STAT_KEYS.map(function (k) {
        return devEntrada('gen-' + k, 'Gen. ' + GD.STATS[k].short, 'type="number" min="0" max="31" inputmode="numeric"', f['gen-' + k]);
      }).join('') + '</div>' +
      '<div class="dev-campos dev-campos--4">' + STAT_KEYS.map(function (k) {
        return devEntrada('pt-' + k, 'Pontos ' + GD.STATS[k].short, 'type="number" min="0" max="' + RS.TUNING.statMax + '" inputmode="numeric"', f['pt-' + k]);
      }).join('') + '</div>' +
      '<p class="nota">Skills: qualquer uma do catálogo; ' + GD.RARITIES[f.raridade in GD.RARITIES ? f.raridade : 'comum'].name + ' usa até ' + vagas + '.</p>' +
      '<div class="dev-campos dev-campos--1">' + skillSel + '</div>' +
      '<div class="dev-campos dev-campos--4">' +
        devEntrada('coat', 'Pelagem', 'type="color"', f.coat) + devEntrada('coatshade', 'Sombra', 'type="color"', f.coatshade) +
        devEntrada('mane', 'Crina', 'type="color"', f.mane) + devEntrada('accent', 'Detalhe', 'type="color"', f.accent) +
      '</div>' +
      '<div class="dev-campos">' +
        devSelect('cara', 'Marca na cara', marcaOpts('cara'), f.cara) + devSelect('patas', 'Meias', marcaOpts('patas'), f.patas) +
        devSelect('corpo', 'Pelagem do corpo', marcaOpts('corpo'), f.corpo) + devSelect('porte', 'Porte', porteOpts, f.porte) +
      '</div>' +
      '<div class="dev-acoes">' + devBotao('dev-criar', 'Criar cavalo', 'btn--ouro') + devBotao('dev-aplicar', 'Aplicar na ativa') + devBotao('dev-carregar', 'Carregar a ativa') + '</div>' +
      '<div class="dev-campos dev-campos--1">' + devSelect('copiar', 'Copiar cavalo pronto (iniciais e aluguéis do Haras)', prontos, f.copiar) + '</div>' +
      '<div class="dev-acoes">' + devBotao('dev-copiar', 'Copiar para o estábulo') + devBotao('dev-niveis', '+10 níveis (ativa)') + devBotao('dev-cruz', '+1 cruzamento (ativa)') + devBotao('dev-devolver', 'Devolver pontos (ativa)') + '</div>' +
      // redistribuição grátis do cavalo ativo (mount.respecFree): vale na hora, como o Ouro infinito
      devCheck('respecfree', 'Redistribuição grátis (' + activeMount().name + ', ativa)', activeMount().respecFree === true));

    var itens = devGrupo('itens', 'Itens',
      '<p class="nota">Qualquer peça do catálogo, inclusive Lendária (só no perfil DEV). Comum e Mágico são peças soltas; Raro e Lendário usam o conjunto.' +
        (GEAR_ON ? '' : ' Com o equipamento suspenso, as peças só ficam guardadas no save: não entram na corrida nem no Poder.') + '</p>' +
      '<div class="dev-campos">' +
        devSelect('slot', 'Slot', GR.SLOTS.map(function (sl) { return [sl, GD.GEAR_SLOT_INFO[sl].name]; }), f.slot) +
        devSelect('conjunto', 'Conjunto', devListaDe(GD.GEAR_SETS, nomeDe), f.conjunto) +
        devSelect('rpeca', 'Raridade', raridadesPeca, f.rpeca) + devSelect('melhoria', 'Melhoria', melhorias, f.melhoria) +
      '</div>' + devCheck('equipar', 'Equipar na ativa', f.equipar) +
      '<div class="dev-acoes">' + devBotao('dev-peca', 'Dar peça') + devBotao('dev-conjunto', 'Conjunto completo (5 peças)') + '</div>');

    var corrida = devGrupo('corrida', 'Próxima corrida',
      '<p class="nota">Vale só para a próxima corrida; campo vazio segue a sala normal.</p>' +
      '<div class="dev-campos">' +
        devSelect('clima', 'Clima inicial', [['', '— da sala —']].concat(devListaDe(GD.WEATHERS, nomeDe)), f.clima) +
        devSelect('piso', 'Piso', [['', '— da sala —']].concat(devListaDe(GD.SURFACES, nomeDe)), f.piso) +
        devSelect('distancia', 'Distância', distancias, f.distancia) +
        devSelect('tracado', 'Traçado', [['normal', 'Da sala'], ['curvas', 'Mais curvas'], ['subidas', 'Mais subidas'], ['lista', 'Lista de blocos']], f.tracado) +
      '</div>' +
      '<div class="dev-campos dev-campos--1">' + devEntrada('blocos', 'Lista de blocos (traçado "Lista")', 'type="text" autocomplete="off" placeholder="reta curva subida reta"', f.blocos) + '</div>' +
      '<div class="dev-campos">' +
        devSelect('vento', 'Vento', [['', '— sorteado —']].concat(DV.WIND_INTENSITIES.map(function (w) { return [w, w.charAt(0).toUpperCase() + w.slice(1)]; })), f.vento) +
        devSelect('direcao', 'Direção do vento', [['1', '→ Direita'], ['-1', '← Esquerda']], f.direcao) +
        devEntrada('seed', 'Seed', 'type="text" inputmode="numeric" autocomplete="off" placeholder="da sala"', f.seed) +
      '</div>' + devCheck('sempre', 'Skills sempre ativam', f.sempre) +
      '<p class="dev-armado' + (ui.devNext ? ' dev-armado--on' : '') + '" id="dev-armado">' + esc(devResumoArmado(ui.devNext)) + '</p>' +
      '<div class="dev-acoes">' + devBotao('dev-armar', 'Armar', 'btn--ouro') + devBotao('dev-limpar', 'Limpar') + '</div>');

    // Perfil: "Zerar perfil de teste" em dois passos, na própria gaveta (volta à Brasa; o "Recomeçar" do Perfil volta à escolha), e
    // "Voltar ao jogo real" (a página sem dev=1; no build de teste jogo-dev.html, um aviso: não há para onde voltar)
    var acoes = [];
    if (!ui.dev.confirmZerar) acoes.push(devBotao('dev-zerar', 'Zerar perfil de teste', 'btn--perigo'));
    if (!DEV_BUILD) {
      var parts = window.location.search.replace(/^\?/, '').split('&').filter(function (q) { return q && q !== 'dev=1'; });
      var realUrl = window.location.pathname + (parts.length ? '?' + parts.join('&') : '') + window.location.hash;
      acoes.push('<a class="btn btn--pequeno dev-real" href="' + esc(realUrl) + '">Voltar ao jogo real</a>');
    }
    var perfil = devGrupo('perfil', 'Perfil',
      '<p class="nota">O perfil de teste fica em "' + esc(DV.SAVE_KEY) + '"; o save do jogo real não é lido nem gravado aqui.</p>' +
      (ui.dev.confirmZerar
        ? '<div class="confirma" role="group" aria-label="Confirmar zerar o perfil de teste"><span>Zerar o perfil de teste? Cavalos, peças e progresso do save DEV voltam ao começo (o save do jogo real não é tocado).</span>' +
          devBotao('dev-zerar-sim', 'Sim, zerar', 'btn--perigo') + devBotao('dev-zerar-nao', 'Cancelar') + '</div>'
        : '') +
      (acoes.length ? '<div class="dev-acoes">' + acoes.join('') + '</div>' : '') +
      (DEV_BUILD ? '<p class="nota dev-real-aviso">Este é o build de teste; abra o jogo normal.</p>' : ''));

    return '<div class="dev-gaveta" id="dev-gaveta" role="region" aria-labelledby="dev-titulo">' +
      '<div class="dev-cabeca"><h2 class="titulo" id="dev-titulo" tabindex="-1">Modo DEV</h2>' + devBotao('dev-fechar', 'Fechar') + '</div>' +
      '<p class="' + (ui.dev.msg ? 'aviso' : 'sr') + '" role="status" id="dev-msg">' + esc(ui.dev.msg) + '</p>' +
      moedas + itensDia + ginasios + cavalo + itens + corrida + perfil +
    '</div>';
  }

  // Faixa (sempre), botão DEV (fora da corrida) e gaveta (aberta). Guarda a rolagem e o foco da gaveta.
  function renderDev() {
    if (!devEl) return;
    var semBotao = ui.screen === 'corrida' || !state;
    if (semBotao) ui.dev.aberto = false;
    var g = devEl.querySelector('.dev-gaveta'), top = g ? g.scrollTop : 0;
    var ae = document.activeElement, foco = null;
    if (ae && ae !== devEl && devEl.contains(ae)) {
      foco = ae.id ? '#' + ae.id : (ae.getAttribute('data-acao') ? '[data-acao="' + ae.getAttribute('data-acao') + '"]' : null);
    }
    var armado = !!ui.devNext;
    var html = '<div class="dev-faixa">MODO DEV — save de teste</div>';
    if (!semBotao) {
      html += '<button type="button" class="btn btn--pequeno dev-botao' + (armado ? ' dev-botao--armado' : '') + '" data-acao="dev-abrir"' +
        ' aria-expanded="' + ui.dev.aberto + '" aria-controls="dev-gaveta">DEV' +
        (armado ? '<span aria-hidden="true"> ●</span><span class="sr"> (próxima corrida armada)</span>' : '') + '</button>';
      if (ui.dev.aberto) html += devGavetaHtml();
    }
    devEl.innerHTML = html;
    g = devEl.querySelector('.dev-gaveta');
    if (g) g.scrollTop = top;
    var el = foco ? devEl.querySelector(foco) : null;
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  }
  function devFoca(sel) {
    var el = devEl && devEl.querySelector(sel);
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  }

  // Ação do painel que mexeu no save: grava (com o Ouro infinito) e redesenha a tela e a gaveta.
  function devGrava(msg) {
    var s0 = state;
    ui.dev.msg = msg;
    persist();
    if (state !== s0) return;   // outra aba gravou um save mais novo: adoptExternal já navegou
    if (ui.lobby && !ui.lobby.sim) refreshPlayerEntry(ui.lobby);
    rerenderKeepScroll();
  }

  function devAcao(acao) {
    var f = devLerCampos(), a = activeMount(), m, tpl;
    switch (acao) {
      case 'dev-ouro':
        state.gold += 1000;
        devGrava('+' + fmt(1000) + ' Ouro.'); break;
      case 'dev-pedras': {
        var pv = Math.floor(Number(f.pedras));
        if (String(f.pedras).trim() === '' || !isFinite(pv)) { ui.dev.msg = 'Pedras: digite um número.'; renderDev(); break; }
        state.pedras = clamp(pv, 0, 1e6); f.pedras = null;
        devGrava('Pedras Negras: ' + fmt(state.pedras) + '.'); break;
      }
      case 'dev-redeas': {
        var rv = Math.floor(Number(f.redeas));
        if (String(f.redeas).trim() === '' || !isFinite(rv)) { ui.dev.msg = 'Rédeas: digite um número.'; renderDev(); break; }
        state.redeas = clamp(rv, 0, REDEAS_MAX); f.redeas = null;
        devGrava('Rédeas novas: ' + fmt(state.redeas) + '.'); break;
      }
      case 'dev-mochila': {
        var mq = {};
        for (var mi = 0; mi < MOCHILA_IDS.length; mi++) {
          var mv = String(f['mochila-' + MOCHILA_IDS[mi]] == null ? state.mochila[MOCHILA_IDS[mi]] : f['mochila-' + MOCHILA_IDS[mi]]).trim();
          if (mv === '' || !isFinite(Number(mv))) { mq = null; break; }
          mq[MOCHILA_IDS[mi]] = clamp(Math.floor(Number(mv)), 0, GD.BAG_MAX);
        }
        if (!mq) { ui.dev.msg = 'Mochila: digite um número em cada item.'; renderDev(); break; }
        MOCHILA_IDS.forEach(function (id) { state.mochila[id] = mq[id]; f['mochila-' + id] = null; });
        devGrava('Mochila: ' + MOCHILA_IDS.map(function (id) { return fmt(mq[id]) + ' ' + GD.ITEMS[id].name; }).join(', ') + '.'); break;
      }
      case 'dev-dia-mais':
      case 'dev-dia-menos':
        state.devDias = clamp(inteiroOu(state.devDias, 0, -DEV_DIAS_MAX, DEV_DIAS_MAX) + (acao === 'dev-dia-mais' ? 1 : -1), -DEV_DIAS_MAX, DEV_DIAS_MAX);
        devGrava('Dia do jogo: ' + (state.devDias > 0 ? '+' : state.devDias < 0 ? '−' : '') + Math.abs(state.devDias) + ' dia(s) do aparelho.'); break;
      case 'dev-gin-etapas': {
        var ge2 = {};
        for (var gi = 0; gi < GD.GYM_ORDER.length; gi++) {
          var gid = GD.GYM_ORDER[gi], gv = Number(f['gin-' + gid] == null ? state.ginasios[gid].etapa : f['gin-' + gid]);
          ge2[gid] = inteiroOu(gv, state.ginasios[gid].etapa, 0, 5);
          f['gin-' + gid] = null;
        }
        GD.GYM_ORDER.forEach(function (id) { state.ginasios[id].etapa = ge2[id]; });
        devGrava('Ginásios: ' + GD.GYM_ORDER.map(function (id) { return GD.ELEMENTS[GD.GYMS[id].element].name + ' ' + ge2[id] + '/5'; }).join(', ') + '.'); break;
      }
      case 'dev-gin-revanche':
        GD.GYM_ORDER.forEach(function (id) { state.ginasios[id].revDia = null; f['gin-' + id] = null; });
        devGrava('Revanche liberada hoje nos três ginásios.'); break;
      case 'dev-gin-zerar':
        state.ginasios = GN.sanear(null, 0);
        GD.GYM_ORDER.forEach(function (id) { f['gin-' + id] = null; });
        devGrava('Ginásios zerados: nenhuma etapa vencida.'); break;
      case 'dev-zerar-diaria':
        state.diaria = { prox: 0, ciclos: 0, ultimo: null };
        state.lojaItens = lojaItensVazia();
        devGrava('Diária no dia 1 para resgatar e limites da loja zerados.'); break;
      case 'dev-niveis': {
        var alvo = Math.min(MAX_LEVEL, a.level + 10), need = 0;
        for (var dl = a.level; dl < alvo; dl++) need += E.xpToLevel(dl);
        need -= a.xp;
        if (need > 0) applyXp(a, need, 9000000 + state.breedCounter);
        devCavaloDaAtiva();
        devGrava(a.name + ' está no nível ' + a.level + '.'); break;
      }
      case 'dev-cruz':
        a.breedLeft = Math.min(4, a.breedLeft + 1);
        devGrava(a.name + ' tem ' + a.breedLeft + ' cruza(s).'); break;
      case 'dev-devolver':
        a.alloc = zeroAlloc();
        devCavaloDaAtiva();
        devGrava(a.name + ': ' + RS.freePoints(a) + ' ponto(s) livre(s) para distribuir.'); break;
      case 'dev-criar':
        tpl = DV.horseTemplate(devCavaloEscolhido(f), state.nextUid);
        m = instanceFromTemplate(tpl, 'm' + state.nextUid);
        m.level = devNivel(f); m.xp = 0;
        devAplicaPontos(m, tpl);
        state.nextUid += 1;
        devAdicionaCavalo(m);
        devCavaloDaAtiva();
        devGrava('Criado: ' + devDescreveCavalo(m) + '. Agora é a ativa.'); break;
      case 'dev-aplicar':
        tpl = DV.horseTemplate(devCavaloEscolhido(f), uidNum(a.uid));
        a.name = tpl.name; a.element = tpl.element; a.rarity = tpl.rarity; a.sex = tpl.sex; a.grau = tpl.grau;
        a.level = devNivel(f); a.xp = 0;
        a.skills = tpl.skills.slice(); a.potential = clone(tpl.potential); a.palette = clone(tpl.palette);
        a.marcas = clone(tpl.marcas);
        a.porte = tpl.porte;
        devAplicaPontos(a, tpl);
        devCavaloDaAtiva();
        devGrava('Ativa substituída: ' + devDescreveCavalo(a) + '.'); break;
      case 'dev-carregar':
        devCavaloDaAtiva();
        ui.dev.msg = 'Campos com os dados da ativa.'; renderDev(); break;
      case 'dev-copiar':
        tpl = devProntos().filter(function (h) { return h.id === f.copiar; })[0];
        if (!tpl) break;
        m = instanceFromTemplate(tpl, 'm' + state.nextUid);
        m.level = clamp(tpl.level || 1, 1, MAX_LEVEL); m.xp = 0;
        state.nextUid += 1;
        devAdicionaCavalo(m);
        devCavaloDaAtiva();
        devGrava('Copiado: ' + devDescreveCavalo(m) + '. Agora é a ativa.'); break;
      case 'dev-peca':
      case 'dev-conjunto': {
        var slots = acao === 'dev-peca' ? [f.slot] : GR.SLOTS.slice();
        if (acao === 'dev-conjunto' && (f.rpeca === 'comum' || f.rpeca === 'magico')) {
          ui.dev.msg = 'Conjunto completo: escolha Raro ou Lendário (Comum e Mágico não têm conjunto).'; renderDev(); break;
        }
        var ids = slots.map(function (sl) { return DV.itemId({ slot: sl, set: f.conjunto, rarity: f.rpeca }); });
        if (ids.some(function (id) { return !id; })) { ui.dev.msg = 'Essa peça não existe no catálogo.'; renderDev(); break; }
        var plus = clamp(Math.floor(Number(f.melhoria)) || 0, 0, GE.plusMax);
        if (!a.equip) a.equip = emptyEquip();
        ids.forEach(function (id) {
          var it = newItem(id);
          it.plus = plus;
          if (f.equipar) a.equip[GD.GEAR[id].slot] = it.uid;   // a peça que estava no slot volta ao inventário
        });
        devGrava((ids.length > 1 ? 'Conjunto: 5 peças ' : 'Peça: ' + GR.piece(ids[0]).name + ' ') + '+' + plus +
          (f.equipar ? ', equipada(s) na ativa.' : ', no inventário.')); break;
      }
      case 'dev-armar': {
        var r = devArmar(f);
        if (r.erros.length) { ui.dev.msg = 'Não armado: ' + r.erros.join('; ') + '.'; renderDev(); break; }
        ui.devNext = r.next;
        devAtualizaSala();
        ui.dev.msg = devResumoArmado(ui.devNext);
        rerenderKeepScroll(); break;
      }
      case 'dev-limpar':
        ui.devNext = null;
        devAtualizaSala();
        ui.dev.msg = devResumoArmado(null);
        rerenderKeepScroll(); break;
      case 'dev-zerar':
        ui.dev.confirmZerar = true; ui.dev.msg = '';
        renderDev(); devFoca('[data-acao="dev-zerar-nao"]'); break;
      case 'dev-zerar-nao':
        ui.dev.confirmZerar = false;
        renderDev(); devFoca('[data-acao="dev-zerar"]'); break;
      case 'dev-zerar-sim':
        devZerarPerfil();
        go('estabulo'); break;
    }
  }

  if (devEl) {
    devEl.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-acao]') : null;
      if (!b || b.disabled || !devEl.contains(b)) return;
      var acao = b.getAttribute('data-acao');
      if (acao === 'dev-abrir' || acao === 'dev-fechar') {
        ui.dev.aberto = acao === 'dev-abrir' ? !ui.dev.aberto : false;
        ui.dev.msg = ''; ui.dev.confirmZerar = false;
        renderDev();
        devFoca(ui.dev.aberto ? '#dev-titulo' : '.dev-botao');
        return;
      }
      if (state) devAcao(acao);
    });
    devEl.addEventListener('change', function (e) {
      var k = e.target && e.target.getAttribute ? e.target.getAttribute('data-dev-campo') : null;
      if (!k || !state) return;
      if (k === 'ouroinf') {
        ui.dev.ouroInf = !!e.target.checked;
        if (ui.dev.ouroInf) devGrava('Ouro infinito ligado.');
        else { ui.dev.msg = 'Ouro infinito desligado.'; renderDev(); }
        return;
      }
      if (k === 'respecfree') {
        var ra = activeMount();
        ra.respecFree = !!e.target.checked;
        if (ui.montaria) ui.montaria.confirmaRedist = false;
        devGrava(ra.name + ': redistribuição grátis ' + (ra.respecFree ? 'ligada' : 'desligada') + '.');
        return;
      }
      devLerCampos();
      if (k === 'raridade') renderDev();   // a nota das vagas de skill muda com a raridade
    });
    devEl.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && ui.dev.aberto) { ui.dev.aberto = false; ui.dev.confirmZerar = false; renderDev(); devFoca('.dev-botao'); }
    });
  }
  // o que o resto do jogo chama do modo DEV (no jogo de produção, devHooks fica null)
  if (DEV_MODE) devHooks = { templateId: devTemplateId, novoPerfil: devNovoPerfil, zerarPerfil: devZerarPerfil, condicoes: devCondicoes, render: renderDev,
    escolha: devEscolha, recomecaEscolha: devRecomecaEscolha };
  /*@dev:fim*/

  // A barra presa dos pontos (aba Status, 3b §6) aparece no 1º +N do rascunho e pode surgir por cima do botão que acabou
  // de ser tocado (os +N das linhas que estão nos ~76 px de baixo da tela). Por BARRA_GUARDA_MS depois de aparecer, ela
  // deixa o toque passar (.barra-acao--chegando: pointer-events none) para o +N de baixo: um 2º toque rápido nunca cai
  // em Desfazer nem em Confirmar. Do mesmo jeito, quando o 1º toque no Confirmar arma o pedido de confirmação (que entra
  // em cima dos botões, com a barra presa no lugar), os botões dela não pegam toque por BARRA_GUARDA_MS
  // (.barra-acao--armando): um toque duplo não grava sem o pedido ser lido; o toque cai na bandeja e nada acontece.
  // O teclado não muda (nenhuma das duas mexe no foco nem no Enter).
  var BARRA_GUARDA_MS = 400, barraDesde = 0, armadaDesde = 0, barraArmada = false, timerChegando = 0, timerArmando = 0;
  function barraGuarda(barra, cls, desde, timer) {
    var resta = BARRA_GUARDA_MS - (Date.now() - desde);
    clearTimeout(timer);
    if (resta <= 0) return 0;
    barra.classList.add(cls);
    return setTimeout(function () { barra.classList.remove(cls); }, resta);
  }
  function barraPontosChegou(barra) {
    var raiz = document.documentElement, tinha = raiz.classList.contains('com-barra-pontos');
    var armada = !!(barra && ui.montaria && ui.montaria.confirmaPontos);
    raiz.classList.toggle('com-barra-pontos', !!barra);
    if (!tinha && barra) barraDesde = Date.now();
    if (armada && !barraArmada) armadaDesde = Date.now();
    barraArmada = armada;
    medeBarra();
    if (!barra) return;
    timerChegando = barraGuarda(barra, 'barra-acao--chegando', barraDesde, timerChegando);
    timerArmando = armada ? barraGuarda(barra, 'barra-acao--armando', armadaDesde, timerArmando) : 0;
  }
  // O foco por teclado nunca fica atrás da barra presa: a altura de verdade dela (o pedido de confirmação e a .motivo a
  // deixam mais alta) vai para --barra-pontos-alt, que entra no scroll-padding de baixo (CSS: o Tab e o scrollIntoView
  // param acima dela). Medida a cada desenho e quando a .motivo entra ou sai.
  function medeBarra() {
    var raiz = document.documentElement, barra = telaEl.querySelector('.barra-acao--pontos');
    if (barra) raiz.style.setProperty('--barra-pontos-alt', Math.ceil(barra.getBoundingClientRect().height) + 'px');
    else raiz.style.removeProperty('--barra-pontos-alt');
  }
  // depois de devolver o foco a um botão sem rolar (focusAction): se o foco é de teclado (:focus-visible) e ficou atrás
  // da barra presa, rola o mínimo para ele aparecer acima dela. No toque, a tela não anda sob o dedo.
  function focoAcimaDaBarra(el) {
    var barra = telaEl.querySelector('.barra-acao--pontos');
    if (!barra || !el || barra.contains(el)) return;
    var teclado = false;
    try { teclado = el.matches(':focus-visible'); } catch (e) { teclado = false; }
    if (!teclado) return;
    if (el.getBoundingClientRect().bottom > barra.getBoundingClientRect().top) el.scrollIntoView({ block: 'nearest' });
  }

  function render() {
    ui.avisoNaTela = null;   // noticeHtml() o preenche se a tela desenhar um aviso
    ui.diaTela = hojeDia();  // o dia que esta tela mostra (diária, limites da loja): diaVirou compara com ele
    tiraAlvo();   // o destaque da frase do motivo não passa para a tela nova
    if (visObs) visObs.disconnect();
    live = [];
    portraitQueue = [];
    cenaQueue = []; cenaItems = [];
    var html;
    if (saveBloqueado) ui.screen = 'bloqueio';
    switch (ui.screen) {
      case 'bloqueio': html = renderBloqueio(); break;
      case 'estabulo': html = renderEstabulo(); break;
      case 'largada': html = renderLargada(); break;
      case 'corrida': html = renderCorrida(); break;
      case 'desafio': html = renderDesafio(); break;
      case 'entreduelos': html = renderEntreDuelos(); break;
      case 'resultado': html = renderResultado(); break;
      case 'haras': html = renderHaras(); break;
      case 'montaria': html = renderMontaria(); break;
      case 'loja': html = renderLoja(); break;
      case 'correr': html = renderCorrer(); break;
      case 'expedicao': html = renderExpedicao(); break;
      case 'perfil': html = renderPerfil(); break;
      case 'ginasio': html = renderGinasio(); break;
      default: html = renderInicial();
    }
    var comCasca = kindOf(ui.screen) !== 'full';
    if (comCasca) html = appTopoHtml() + '<main class="app-conteudo">' + html + '</main>' + appAbasHtml();
    if (appEl) appEl.classList.toggle('app-com-abas', comCasca);
    document.documentElement.classList.toggle('app-com-abas', comCasca);   // scroll-padding do foco (CSS)
    document.documentElement.classList.toggle('dev-ativo', DEV_MODE);   // faixa no topo e botão DEV (seção "Modo DEV")
    syncMotionClass();
    // folga no fim da tela para o conteúdo rolar acima do botão DEV fixo
    if (DEV_MODE && ui.screen !== 'corrida') html += '<div class="dev-espaco" aria-hidden="true"></div>';
    telaEl.innerHTML = ordFix(html);
    barraPontosChegou(telaEl.querySelector('.barra-acao--pontos'));
    hydrate(telaEl);
    if (ui.screen === 'corrida') {
      if (raceView) raceView.destroy();
      var cor = corridaAtual();
      raceView = createRaceView(cor.L, telaEl, cor.fim, cor.cab.pularFim);
    }
    if (devHooks) devHooks.render();
    acordaLaco();
  }

  // ===========================================================================
  // Casca: cabeçalho fixo e barra de abas (abas e sub-telas)
  // ===========================================================================
  function appTopoHtml() {
    return '<header class="app-topo"><span class="logo-mini">' + logoHtml('Galope Elemental', 24) + '</span>' +
      '<span class="topo-saldos">' + (GEAR_ON ? pedrasSaldoHtml() : '') +
      '<span class="saldo" aria-label="Saldo">' + ouroHtml(state.gold) + '</span></span>' +
      '<button type="button" class="btn btn--pequeno app-perfil" data-acao="perfil" aria-label="Perfil">' + iconeHtml('ui-perfil', '👤', 16) + '</button></header>';
  }
  // saldo de Pedras Negras ("🪨 N"), igual no cabeçalho e no Perfil
  function pedrasSaldoHtml() {
    return '<span class="pedras" aria-label="' + esc(pedrasTxt(state.pedras) + (state.pedras === 1 ? ' negra' : ' negras')) + '">' + iconeHtml('pedra-negra', '🪨') + ' ' + fmt(state.pedras) + '</span>';
  }
  function appAbasHtml() {
    return '<nav class="app-abas" role="navigation" aria-label="Seções">' + ABAS.map(function (a) {
      var ativa = ui.tab === a.id;
      // o ponto: na aba Correr com o páreo aberto; na aba Estábulo com a recompensa do dia para resgatar; na Expedição com a
      // revanche de algum líder livre hoje (o dia é lido agora)
      var ponto = a.id === 'correr' ? !!state.pending : a.id === 'estabulo' ? IT.diariaEstado(state.diaria, hojeDia()).pode : a.id === 'expedicao' && ginAlgumaRevanche();
      var cls = 'app-aba' + (ativa ? ' app-aba--ativa' : '') + (ponto ? ' app-aba--ponto' : '');
      return '<button type="button" class="' + cls + '" data-acao="aba" data-id="' + esc(a.id) + '"' + (ativa ? ' aria-current="page"' : '') + '>' +
        '<span class="app-aba-icone" aria-hidden="true">' + iconeHtml('aba-' + a.id, a.icone, 32) + '</span><span class="app-aba-rotulo">' + esc(a.rotulo) + '</span></button>';
    }).join('') + '</nav>';
  }
  // Linha "Marcas: ..." (ficha da Montaria e Haras): nomes em português, sem símbolos
  var CARA_ROT = { nenhuma: 'nenhuma', estrela: 'estrela', listra: 'listra', frente: 'frente branca' };
  var CORPO_ROT = { liso: 'liso', malhado: 'malhado', pintado: 'pintado', ruao: 'ruão' };
  // só o que existe (cara, patas, corpo); sem marca nenhuma: "Marcas: nenhuma"
  function marcasTexto(h) {
    var m = marcasDe(h.marcas, h.templateId, h.uid || h.id), t = [];
    if (m.cara !== 'nenhuma') t.push(CARA_ROT[m.cara]);
    if (m.patas > 0) t.push(m.patas === 1 ? '1 meia' : m.patas + ' meias');
    if (m.corpo !== 'liso') t.push(CORPO_ROT[m.corpo]);
    return 'Marcas: ' + (t.length ? t.join(', ') : 'nenhuma');
  }
  // Linha "Porte: Robusto" (ficha da Montaria e Haras, antes da das marcas): o porte pela escada do Breed.porteDe,
  // com a mesma chave das marcas, e o nome do GameData
  function porteTexto(h) {
    return 'Porte: ' + GD.PORTES.nomes[BRD.porteDe(h.porte, h.templateId, h.uid || h.id)];
  }
  // Editor do jóquei (Perfil): padrão da seda e cor do capacete; a prévia é o cavalo ativo, parado e montado
  var PADRAO_ROT = { liso: 'Liso', listras: 'Listras', faixa: 'Faixa', xadrez: 'Xadrez', estrelas: 'Estrelas', losangos: 'Losangos' };
  var CAPACETE_ROT = GD.JOQUEI.nomes;   // hex → nome (data.js)
  function joqueiHtml() {
    var j = joqueiDoJogador();
    var pads = GD.JOQUEI.padroes.map(function (p) {
      return '<button type="button" class="btn opcao opcao--centro" data-acao="joquei-padrao" data-id="' + esc(p) + '" data-v="' + esc(p) +
        '" aria-pressed="' + (j.padrao === p) + '"><span class="opcao-nome">' + esc(PADRAO_ROT[p] || p) + '</span></button>';
    }).join('');
    var caps = GD.JOQUEI.capacetes.map(function (c) {
      return '<button type="button" class="btn capacete-btn" data-acao="joquei-capacete" data-id="' + esc(c) + '" data-v="' + esc(c) +
        '" aria-pressed="' + (j.capacete === c) + '" aria-label="' + esc(CAPACETE_ROT[c] || 'Capacete') + '" title="' + esc(CAPACETE_ROT[c] || 'Capacete') +
        '" style="background:' + esc(c) + '"></button>';
    }).join('');
    var m = activeMount();
    var previa = m ? '<div class="joquei-previa">' + portraitHtml(m, { jockey: true, joquei: j }) + '</div>' : '';
    return '<section class="caixa" aria-labelledby="r-joquei"><div class="tela-cabeca">' +
      '<h2 class="titulo" id="r-joquei">Seu jóquei</h2>' + previa +
      '<span class="rotulo" id="r-joq-padrao">Seda</span>' +
      '<div class="opcoes opcoes--3" role="group" aria-labelledby="r-joq-padrao">' + pads + '</div>' +
      '<span class="rotulo" id="r-joq-cap">Capacete</span>' +
      '<div class="capacetes" role="group" aria-labelledby="r-joq-cap">' + caps + '</div>' +
      '<p class="nota">O jóquei só muda o visual: vale para todos os seus cavalos e não afeta a corrida.</p>' +
      '</div></section>';
  }
  // Perfil: estatísticas, saldo, inventário e "Recomeçar com outro inicial"
  function renderPerfil() {
    return '<section class="tela" aria-labelledby="t-perfil">' +
      '<button type="button" class="btn btn--pequeno" data-acao="perfil-voltar">Voltar</button>' +
      '<h1 class="titulo titulo--tela" id="t-perfil" tabindex="-1" data-foco>Perfil</h1>' + noticeHtml() +
      '<div class="caixa">' +
        '<div class="linha-meta"><span>Corridas <b>' + fmt(state.races) + '</b></span><span>Vitórias <b>' + fmt(state.wins) + '</b></span>' +
          '<span>Pódios <b>' + fmt(state.podiums) + '</b></span><span>Prêmios ' + ouroHtml(state.goldWon) + '</span></div>' +
        // com o equipamento suspenso (GEAR_ON), sem o saldo de Pedras e sem a contagem de peças (as telas delas somem)
        '<div class="linha-meta"><span>Ouro ' + ouroHtml(state.gold) + '</span>' + (GEAR_ON ? '<span>Pedras ' + pedrasSaldoHtml() + '</span>' : '') + '</div>' +
        '<div class="linha-meta"><span>' + esc(state.mounts.length) + (state.mounts.length === 1 ? ' montaria' : ' montarias') +
          (GEAR_ON ? ' · ' + esc(state.items.length) + (state.items.length === 1 ? ' peça' : ' peças') : '') + '</span></div>' +
      '</div>' +
      perfilInsigniasHtml() + joqueiHtml() + animacoesHtml() +
      '<footer class="caixa">' + resetHtml() + '</footer></section>';
  }
  // As insígnias no Perfil (spec §9), as três na ordem de GYM_ORDER: a conquistada com o ícone, o nome e o bônus (o mesmo
  // texto da trilha, ginBonusTxt); a que falta apagada, sem o bônus, com o que falta escrito
  function perfilInsigniasHtml() {
    var n = GD.GYM_ORDER.filter(ginTemInsignia).length;
    var lis = GD.GYM_ORDER.map(function (id) {
      var g = GD.GYMS[id], tem = ginTemInsignia(id);
      return '<li class="perfil-insignia' + (tem ? '' : ' perfil-insignia--falta') + '" data-gym="' + esc(id) + '">' + ginInsigniaIcone(id) +
        '<span><b>' + esc(g.insignia.name) + '</b><br>' + esc(tem ? ginBonusTxt(id) + '.' : 'Vença o líder do ' + g.name + '.') + '</span></li>';
    }).join('');
    return '<section class="caixa" aria-labelledby="t-insignias"><h2 class="titulo" id="t-insignias">Insígnias (' + n + ' de ' + GD.GYM_ORDER.length + ')</h2>' +
      '<ul class="perfil-insignias">' + lis + '</ul></section>';
  }
  // opção "Animações": mesmo controle de escolhas (aria-pressed) da entrada e das abas internas
  var MOTION_ROTULOS = { sistema: 'Seguir o sistema', completas: 'Completas', reduzidas: 'Reduzidas' };
  function animacoesHtml() {
    var m = motionPref();
    var opts = MOTIONS.map(function (k) {
      return '<button type="button" class="btn opcao opcao--centro" data-acao="motion" data-id="' + k + '" aria-pressed="' + (m === k) + '">' +
        '<span class="opcao-nome">' + esc(MOTION_ROTULOS[k]) + '</span></button>';
    }).join('');
    var agora = m === 'sistema' ? ' Agora o aparelho pede animações ' + (systemReduced() ? 'reduzidas' : 'completas') + '.' : '';
    return '<section class="caixa" aria-labelledby="r-animacoes"><div class="tela-cabeca">' +
      '<span class="rotulo" id="r-animacoes">Animações</span>' +
      '<div class="opcoes opcoes--3" role="group" aria-labelledby="r-animacoes">' + opts + '</div>' +
      '<p class="nota">Reduzidas: a chuva cai mais devagar e mais rala; sem relâmpagos, clarões, faíscas nem giro dos dados.' + esc(agora) + '</p>' +
      '</div></section>';
  }

  // ===========================================================================
  // Tela 1 — Escolha do inicial (carrossel no celular)
  // ===========================================================================
  function renderInicial() {
    var cards = GD.STARTERS.map(function (h, idx) {
      var stats = RS.computeStats(h);
      var el = GD.ELEMENTS[h.element];
      var rating = RS.powerRating(h);
      var wPct = Math.round((RS.TUNING.weatherMult - 1) * 100);
      // melhor e pior clima, cada um com o ícone (HTML pronto: o texto passa por esc)
      var best = el.weather && GD.WEATHERS[el.weather] ? climaIcone(el.weather) + esc(GD.WEATHERS[el.weather].name + ' (+' + wPct + '%)') : '—';
      var worst = Object.keys(GD.WEATHERS).filter(function (w) { return GD.WEATHERS[w].penalizes === h.element; })
        .map(function (w) { return climaIcone(w) + esc(GD.WEATHERS[w].name + ' (−' + wPct + '%)'); }).join(', ') || '—';
      // os dois status de genética mais alta (empate: a ordem de STAT_KEYS)
      var fortes = [];
      for (var f = 0; f < 2; f++) {
        var best1 = null;
        STAT_KEYS.forEach(function (k) { if (fortes.indexOf(k) < 0 && (best1 == null || h.potential[k] > h.potential[best1])) best1 = k; });
        fortes.push(best1);
      }
      return '<article class="caixa inicial" id="ini-' + esc(h.id) + '" aria-label="' + esc(h.name + ', ' + (idx + 1) + ' de ' + GD.STARTERS.length) + '">' +
        '<div class="retrato-palco">' + portraitHtml(h) + '<span class="contador">' + (idx + 1) + '/' + GD.STARTERS.length + '</span></div>' +
        '<div class="inicial-topo"><h2 class="cavalo-nome">' + esc(h.name) + '</h2>' + elementHtml(h.element) + '</div>' +
        '<p class="cavalo-titulo"><b>' + esc(h.title) + '.</b> ' + esc(h.bio) + '</p>' +
        '<div class="linha-meta">' + rarityHtml(h.rarity) + ajudaBtn('raridade', 'a raridade') + estrelasHtml(h.grau) + ajudaBtn('estrelas', 'as estrelas') +
          '<span>Poder <b>' + rating + '</b>' + ajudaBtn('poder', 'o Poder') + '</span>' + leagueHtml(rating) + ajudaBtn('liga', 'a liga') + '</div>' +
        '<p class="inicial-fortes">Fortes: <b>' + esc(GD.STATS[fortes[0]].name) + '</b> e <b>' + esc(GD.STATS[fortes[1]].name) + '</b></p>' +
        statsHtml(stats) +
        vagaTipoHtml(h) +
        '<dl class="afinidade"><dt>Clima bom</dt><dd class="mais">' + best +
        '</dd><dt>Clima ruim</dt><dd class="menos-t">' + worst + '</dd></dl>' +
        '<button type="button" class="btn btn--ouro btn--grande" data-acao="escolher" data-id="' + esc(h.id) + '">Escolher ' + esc(h.name) + '</button>' +
        '</article>';
    }).join('');
    var nav = GD.STARTERS.map(function (h) {
      return '<button type="button" class="btn btn--pequeno pilula el--' + esc(h.element) + '" data-acao="ver-inicial" data-id="' + esc(h.id) + '">' +
        iconHtml(h.element) + '<span>' + esc(h.name) + '</span></button>';
    }).join('');
    return '<section class="tela tela--larga" aria-labelledby="t-inicial">' +
      '<header class="tela-cabeca"><h1 class="logo" id="t-inicial" tabindex="-1" data-foco>' + logoHtml('Galope Elemental') + '</h1>' +
      (saveCorrompido ? '<p class="aviso" role="status">Não foi possível ler o seu progresso salvo (o arquivo está corrompido). O jogo recomeçou; ' +
        (saveCorrompido === 'guardado' ? 'uma cópia do arquivo antigo foi guardada.' : 'não foi possível guardar uma cópia do arquivo antigo.') + '</p>' : '') +
      '<p class="sub">Escolha seu primeiro cavalo. Ele corre sozinho nas corridas valendo Ouro: você decide ' +
        (GEAR_ON ? 'o item' : 'onde vão os pontos') + ' e a aposta antes da largada.</p></header>' +
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

  // Entrada reservada: com uma sala valendo aberta (state.pending, ainda não corrida), a entrada dela fica
  // separada; nenhum gasto de Ouro pode deixar o saldo abaixo dela (senão a sala teria de ser descartada e
  // outra sorteada de graça). ouroLivre() é o que se pode gastar; podeGastar(v) confere um gasto.
  function ouroReservado() {
    var P = state && state.pending;
    return P && !P.training ? P.fee : 0;
  }
  function ouroLivre() { return Math.max(0, state.gold - ouroReservado()); }
  function podeGastar(valor) { return valor <= ouroLivre(); }
  function reservaTxt() { return fmt(ouroReservado()) + ' de Ouro reservados para a entrada do páreo aberto'; }
  // aviso da reserva (Loja, Estábulo), só quando há Ouro reservado
  function reservaHtml() { return ouroReservado() ? '<p class="nota nota--reserva">' + esc(reservaTxt()) + '.</p>' : ''; }

  var SLOT_PRICE = BR.stableSlotPrice;
  function uidNum(uid) { return String(uid).replace(/\D+/g, ''); }

  // por que "Tornar ativa" está indisponível ('' quando pode). A ficha da ativa nem mostra o botão (3b §5)
  function motivoAtivar(P) {
    return P ? 'Páreo aberto: corra a sala antes de trocar a montaria ativa.' : '';
  }
  // por que a montaria não pode ser liberada ('' quando pode)
  function motivoLiberar(m) {
    var P = state.pending;
    if (m.uid === state.activeId) return 'A montaria ativa não pode ser liberada.';
    if (state.mounts.length <= 1) return 'É o único cavalo do estábulo: não dá para liberar.';
    if (P) return 'Páreo aberto: corra a sala antes de liberar uma montaria.';
    return '';
  }
  // Cartão do potro no resultado do Haras (sem botões: "Tornar ativa" fica no próprio resultado). O Estábulo usa mountRowHtml.
  function mountCardHtml(m, isActive) {
    var corcel = window.Breed && window.Breed.isCorcel(m)
      ? '<span class="corcel" title="Corcel: herança garantida">' + corcelHtml() + '</span>' : '';
    return '<article class="montaria' + (isActive ? ' montaria--ativa' : '') + '" data-uid="' + esc(m.uid) + '">' +
      portraitHtml(m, { selo: true, pontos: pontosQueCabem(m) }) +
      '<h3 class="cavalo-nome">' + esc(m.name) + ' <small>#' + esc(uidNum(m.uid)) + '</small></h3>' +
      '<div class="linha-meta">' + rarityHtml(m.rarity) + estrelasHtml(m.grau) + elementHtml(m.element) +
        '<span>' + sexoHtml(m.sex) + '</span>' +
        '<span>cruza ' + esc(m.breedLeft) + 'x</span>' + corcel +
        (isActive ? '<span class="badge-ativa">Ativa</span>' : '') +
      '</div>' + xpHtml(m.level, m.xp, true) + (GEAR_ON ? gearSummaryHtml(m) : '') +
    '</article>';
  }

  // Linha do Estábulo (3b §4): um botão por cavalo, que abre a ficha. À esquerda o retrato pequeno com o selo do nível e
  // o "+N" (escondido do leitor de tela: o nome acessível já diz nome, número, nível e se é a ativa); à direita o nome e o
  // #N, a raridade e as estrelas (e o selo "Ativa" na ativa), o tipo e o Poder (sem equipamento, spec 1b §7), e a seta.
  // Sexo, cruzas, Corcel e XP ficam na ficha; "Tornar ativa" também.
  var SETA_ROWS = ['..#.....', '..##....', '...##...', '....##..', '...##...', '..##....', '..#.....', '........'];
  // o: a linha na escolha do cavalo de um item: { acao (no lugar de "montaria"), fim (no lugar de "Abrir ficha."), motivo
  // (a linha apagada, no padrão indisponivel) } e, no time do ginásio, também pressed (aria-pressed), meta (html no fim da
  // linha do elemento e do Poder) e lado (html no lugar da seta)
  function mountRowHtml(m, isActive, o) {
    var n = uidNum(m.uid);
    var pq = pontosQueCabem(m);
    var rotulo = m.name + ' #' + n + ', nível ' + m.level + (isActive ? ', ativa' : '') +
      (pq > 0 ? ', ' + pq + (pq === 1 ? ' ponto' : ' pontos') + ' para distribuir' : '') + '. ' + (o ? o.fim : 'Abrir ficha.');
    return '<button type="button" class="montaria-linha' + (isActive ? ' montaria--ativa' : '') + '" data-acao="' + (o ? o.acao : 'montaria') + '" data-id="' + esc(m.uid) +
        '" aria-label="' + esc(rotulo) + '"' + (o ? indisponivel(o.motivo) : '') + (o && o.pressed != null ? ' aria-pressed="' + !!o.pressed + '"' : '') + '>' +
      '<span class="montaria-linha-retrato" aria-hidden="true">' + portraitHtml(m, { tamanho: 'pequeno', selo: true, pontos: pq }) + '</span>' +
      '<span class="montaria-linha-nome">' + esc(m.name) + '<small>#' + esc(n) + '</small></span>' +
      '<span class="montaria-linha-meta">' + rarityHtml(m.rarity) + estrelasHtml(m.grau) +
        (isActive ? '<span class="badge-ativa">Ativa</span>' : '') + '</span>' +
      '<span class="montaria-linha-meta">' + elementHtml(m.element) +
        '<span class="montaria-linha-poder">Poder <b>' + RS.powerRating(m) + '</b></span>' + (o && o.meta ? o.meta : '') + '</span>' +
      (o && o.lado != null ? o.lado : pixelSvg(SETA_ROWS, 'montaria-linha-seta')) +
    '</button>';
  }

  function montariasHtml() {
    var maxed = state.stableSlots >= BR.stableSlotsMax;
    var canExpand = !maxed && podeGastar(SLOT_PRICE);
    var reservaBloqueia = !maxed && state.gold >= SLOT_PRICE && !canExpand;
    var motivoExp = canExpand ? '' : maxed ? 'O estábulo já está no máximo.'
      : reservaBloqueia ? reservaTxt() + '.' : 'Falta Ouro para expandir o estábulo.';
    return '<section class="caixa" aria-label="Suas montarias"><ul class="montarias">' + state.mounts.map(function (m) { return '<li>' + mountRowHtml(m, m.uid === state.activeId) + '</li>'; }).join('') + '</ul>' +
      '<div class="acoes"><button type="button" data-acao="expandir" class="btn"' + indisponivel(motivoExp) + '>' +
        (maxed ? 'Estábulo no máximo' : 'Expandir estábulo (' + fmt(SLOT_PRICE) + ')') + '</button></div>' +
      (reservaBloqueia ? reservaHtml() : '') + '</section>';
  }

  // aviso pendente (ex.: "Ouro insuficiente", save de outra aba): mostra uma vez e limpa
  // (ui.avisoNaTela guarda o aviso desenhado agora: um redesenho passivo, sem ação do jogador, o mostra de novo)
  function noticeHtml() {
    var html = ui.notice ? '<p class="aviso">' + esc(ui.notice) + '</p>' : '';
    ui.avisoNaTela = ui.notice;
    ui.notice = null;
    return html;
  }

  // ---- Recompensa diária (spec de itens §7, §8, §9, §13): o cartão no topo do Estábulo. As regras são as do Itens; o dia é
  // lido só ao desenhar (hojeDia), sem temporizador: o dia que vira com o jogo aberto aparece no próximo desenho da tela ----
  // o prêmio em texto, com os nomes do catálogo: "60 de Ouro", "1 Torrão de açúcar", "200 de Ouro, 1 Rédea nova e 1 Estrela de treino"
  function premioTxt(p) {
    var partes = p.ouro ? [fmt(p.ouro) + ' de Ouro'] : [];
    Object.keys(p.itens).forEach(function (id) { partes.push(itemQtdTxt(id, p.itens[id])); });
    return partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes.join('');
  }
  // o `cabe` do Itens.resgatar: o teto de cada prêmio é de quem chama (o Itens não sabe onde a Rédea mora): 99 de cada item
  // na mochila (GameData.BAG_MAX) e 999 Rédeas novas (state.redeas, REDEAS_MAX)
  function diariaCabe(id, n) {
    return id === 'redea' ? state.redeas + n <= REDEAS_MAX : itemQtd(id) + n <= GD.BAG_MAX;
  }
  function diariaCheiaTxt(id) {
    return (id === 'redea' ? 'Você já tem ' + itemQtdTxt(id, REDEAS_MAX) : 'A mochila já tem ' + itemQtdTxt(id, GD.BAG_MAX)) +
      ', o máximo. O resgate espera até sobrar espaço.';
  }
  // os 7 dias do calendário em curso (o cartão grande: hoje há prêmio): os já resgatados marcados, o de hoje em destaque
  function diariaDiasHtml(e) {
    var ciclos = state.diaria.ciclos, hoje = e.dia - 1;
    return '<ol class="diaria-dias" id="diaria-dias">' + GD.DAILY.dias.map(function (x, i) {
      // o prêmio do dia i deste calendário: o estado de um calendário parado nesse dia (com o mesmo nº de calendários completos)
      var p = IT.diariaEstado({ prox: i, ciclos: ciclos, ultimo: null }, 0).premio, feito = i < hoje, atual = i === hoje;
      return '<li class="diaria-dia' + (feito ? ' diaria-dia--feito' : '') + '"' + (atual ? ' aria-current="date"' : '') + '>' +
        '<span class="diaria-dia-n">Dia ' + (i + 1) + '</span><span class="diaria-dia-premio">' + esc(premioTxt(p)) + '</span>' +
        (feito || atual ? '<span class="diaria-dia-marca">' + (feito ? 'Resgatado' : 'Hoje') + '</span>' : '') + '</li>';
    }).join('') + '</ol>';
  }
  // Grande com prêmio para resgatar: o título; o dia "N / 7" e o prêmio na largura inteira (o do 7º dia pode ocupar duas
  // linhas); o "Ver os 7 dias" e o Resgatar na mesma linha. Depois do resgate, uma linha com o prêmio de amanhã (com o relógio
  // para trás, só "volte amanhã"). A mochila cheia daquele item apaga o botão e o cartão diz por quê. O leitor de tela lê o
  // título, o dia e o prêmio num texto só (o h2).
  function diariaCartaoHtml() {
    var hoje = hojeDia(), e = IT.diariaEstado(state.diaria, hoje), n = GD.DAILY.dias.length;
    if (!e.pode) {
      var atras = state.diaria.ultimo !== null && hoje < state.diaria.ultimo;
      return '<section class="caixa diaria diaria--linha" aria-label="Recompensa do dia"><p class="diaria-linha" tabindex="-1">' +
        esc(atras ? 'Recompensa: volte amanhã' : 'Recompensa: amanhã ' + premioTxt(e.amanha)) + '</p></section>';
    }
    var r = IT.resgatar(state.diaria, hoje, diariaCabe), motivo = r && r.cheia ? diariaCheiaTxt(r.cheia) : '', premio = premioTxt(e.premio);
    return '<section class="caixa diaria diaria--grande" aria-label="Recompensa do dia">' +
      '<h2 class="titulo">Recompensa do dia<span class="sr">' + esc(', dia ' + e.dia + ' de ' + n + ': ' + premio) + '</span></h2>' +
      '<p class="diaria-premio" aria-hidden="true"><span class="diaria-num">' + e.dia + ' / ' + n + '</span> ' + esc(premio) + '</p>' +
      (motivo ? '<p class="nota diaria-motivo">' + esc(motivo) + '</p>' : '') +
      '<div class="diaria-acoes"><button type="button" class="btn btn--texto diaria-ver" data-acao="diaria-ver" aria-expanded="' + !!ui.diariaVer +
        // aria-controls só aponta para a lista quando ela está na tela (aberta)
        '"' + (ui.diariaVer ? ' aria-controls="diaria-dias"' : '') + '>Ver os 7 dias</button>' +
        '<button type="button" class="btn btn--ouro btn--pequeno" data-acao="diaria-resgatar"' + indisponivel(motivo) + '>Resgatar' +
          '<span class="sr"> ' + esc(premio) + '</span></button></div>' +
      (ui.diariaVer ? diariaDiasHtml(e) : '') + '</section>';
  }

  // Aba Estábulo: o cartão da recompensa diária e a lista de montarias
  function renderEstabulo() {
    return '<section class="tela" aria-labelledby="t-estabulo">' +
      '<h1 class="titulo titulo--tela" id="t-estabulo" tabindex="-1" data-foco>Estábulo <span class="nota">' +
        state.mounts.length + '/' + state.stableSlots + ' vagas</span></h1>' + noticeHtml() +
      diariaCartaoHtml() + montariasHtml() +
      '</section>';
  }

  // ===========================================================================
  // Aba Correr: montaria ativa, entrada e "Procurar corrida" (a sala aberta nunca é re-sorteada)
  // ===========================================================================
  function renderCorrer() {
    var h = playerHorse();
    var rating = RS.powerRating(h);   // sem equipamento (spec 1b §7)
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
        '<div class="cavalo-cabeca">' + portraitHtml(h, { selo: true }) +
          '<div class="cavalo-info"><h2 class="cavalo-nome">' + esc(h.name) + '</h2>' +
          '<div class="linha-meta">' + rarityHtml(h.rarity) + elementHtml(h.element) + '</div>' +
          xpHtml(h.level, h.xp, true) +
          '<div class="linha-meta"><span>Poder <b>' + rating + '</b>' + ajudaBtn('poder', 'o Poder') + '</span>' + leagueHtml(rating) + ajudaBtn('liga', 'a liga') + '</div>' +
        '</div></div>' +
        (GEAR_ON ? '<div class="tela-cabeca"><span class="rotulo">Equipamento</span>' + gearSummaryHtml(activeMount()) +
          '<div class="acoes"><button type="button" class="btn btn--pequeno" data-acao="equipar-tela" data-id="' + esc(state.activeId) + '">Equipar</button></div></div>' : '') +
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
  // Aba Expedição: os ginásios (spec 2026-11-17-ginasios §4, §8–§10) e, embaixo, a vitrine dos cavalos selvagens
  // ===========================================================================
  // Os textos saem do catálogo (GameData.GYMS, ELEMENTS, SURFACES, BLOCK_TYPES, ITEMS, GYM): nada de nome ou número
  // escrito aqui. O progresso é state.ginasios[id].etapa (0–5: quantas vencidas; 5 é a insígnia).
  function ginEtapasTotal(id) { return GD.GYMS[id].etapas.length; }
  function ginProgresso(id) { return state.ginasios[id].etapa; }
  function ginTemInsignia(id) { return ginProgresso(id) === ginEtapasTotal(id); }
  function ginProgressoTxt(id) { return ginProgresso(id) + ' de ' + ginEtapasTotal(id) + ' vencidos'; }
  // "Ponto fraco: Água vence Fogo" (o elemento que vence o do ginásio)
  function ginFracoTxt(id) { return 'Ponto fraco: ' + elementOf(GD.GYMS[id].fraco).name + ' vence ' + elementOf(GD.GYMS[id].element).name; }
  // O modo da etapa i hoje, perguntado ao Ginasio.podeDesafiar só pela parte da etapa e do dia (Ouro, mochila e time à
  // vontade): { pode: o preparo abre (a etapa próxima, ou a revanche do líder livre hoje), revanche: é a revanche do líder
  // (livre hoje, ou já tentada hoje: o motivo 'revanche-hoje') }. A regra do dia e da revanche fica inteira no módulo: a tela
  // nunca decide sozinha se é revanche (o texto, a entrada mostrada e a cobrada saem daqui ou do mesmo podeDesafiar).
  function ginModo(id, i, hoje) {
    var r = GN.podeDesafiar({ gymId: id, etapa: i, progresso: state.ginasios, hoje: hoje === undefined ? hojeDia() : hoje, ouroLivre: Infinity,
      cabe: function () { return true; }, timeLen: 1 });
    return { pode: r.ok, revanche: r.ok ? r.revanche === true : r.motivo === 'revanche-hoje' };
  }
  // a revanche do líder livre hoje / já tentada hoje (com a insígnia; sem ela, nenhuma das duas)
  function ginRevancheHoje(id) { var m = ginModo(id, ginEtapasTotal(id) - 1); return m.pode && m.revanche; }
  function ginRevancheFeita(id) { var m = ginModo(id, ginEtapasTotal(id) - 1); return !m.pode && m.revanche; }
  function ginAlgumaRevanche() { return GD.GYM_ORDER.some(ginRevancheHoje); }
  // o bônus da insígnia em uma frase (o mesmo do wiki, mais curto)
  function ginBonusTxt(id) {
    var ins = GD.GYM.insignias[id];
    var v = (ins.valor * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    if (ins.tipo === 'ouro') return '+' + v + '% de Ouro nos prêmios das corridas valendo';
    if (ins.tipo === 'xp') return '+' + v + '% de XP para os cavalos';
    if (ins.tipo === 'skill') return '+' + v + ' pontos na chance de aprender skill ao subir de nível';
    return '';
  }
  function ginInsigniaIcone(id) { return iconeHtml(GD.GYMS[id].insignia.icone, '', 32); }
  function ginEtapaRotulo(e, i) { return e.lider ? 'Líder' : 'Soldado ' + (i + 1); }
  function ginCavalosTxt(n) { return n === 1 ? '1 cavalo' : n + ' cavalos'; }
  // "Nível 12" (ou "Nível 12 a 14", se os cavalos da etapa tiverem níveis diferentes)
  function ginNivelTxt(e) {
    var ns = e.cavalos.map(function (c) { return c.level; });
    var lo = Math.min.apply(null, ns), hi = Math.max.apply(null, ns);
    return 'Nível ' + lo + (hi > lo ? ' a ' + hi : '');
  }
  function ginEntradaTxt(e) { return 'Entrada: ' + fmt(e.entrada) + ' de Ouro'; }
  function ginJunta(partes) { return partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes.join(''); }
  // o prêmio da 1ª vitória: o Ouro, os itens (nomes do catálogo) e, no líder, a insígnia
  function ginPremioTxt(id, e) {
    var partes = e.premio.ouro ? [fmt(e.premio.ouro) + ' de Ouro'] : [];
    e.premio.itens.forEach(function (it) { partes.push(itemQtdTxt(it, 1)); });
    if (e.lider) partes.push('a ' + GD.GYMS[id].insignia.name);
    return ginJunta(partes);
  }
  // a pista da casa numa frase: "1.200 m de terra: subida 650 m, curva 350 m e subida 200 m."
  function ginPistaTxt(p) {
    return fmt(p.distance) + ' m de ' + GD.SURFACES[p.surface].name.toLowerCase() + ': ' +
      ginJunta(p.blocks.map(function (b) { return GD.BLOCK_TYPES[b.type].name.toLowerCase() + ' ' + fmt(b.to - b.from) + ' m'; })) + '.';
  }

  // Cartão do ginásio na aba (um botão que abre a trilha): nome, elemento, "N de 5 vencidos", a insígnia conquistada e
  // "Revanche hoje" quando a revanche do líder está livre (ou "Revanche amanhã", sem destaque, com a de hoje já tentada)
  function ginasioCartaoHtml(id) {
    var g = GD.GYMS[id], ins = ginTemInsignia(id);
    return '<li><button type="button" class="ginasio-cartao ginasio-cartao--' + esc(g.element) + '" data-acao="ginasio-abrir" data-id="' + esc(id) + '">' +
      '<span class="ginasio-cartao-nome">' + esc(g.name) + '</span>' +
      '<span class="ginasio-cartao-meta">' + elementHtml(g.element) + '<span class="ginasio-progresso">' + esc(ginProgressoTxt(id)) + '</span></span>' +
      (ins ? '<span class="ginasio-cartao-meta ginasio-insignia">' + ginInsigniaIcone(id) + '<span>' + esc(g.insignia.name) + '</span></span>' : '') +
      (ginRevancheHoje(id) ? '<span class="ginasio-cartao-meta"><span class="ginasio-revanche">Revanche hoje</span></span>'
        : ginRevancheFeita(id) ? '<span class="ginasio-cartao-meta"><span class="ginasio-revanche-amanha">Revanche amanhã</span></span>' : '') +
      pixelSvg(SETA_ROWS, 'montaria-linha-seta ginasio-cartao-seta') +
    '</button></li>';
  }
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
      '<p class="nota">Cada ginásio tem soldados e um líder. Vença um por um, em ordem, para ganhar Ouro, itens e a insígnia.</p>' +
      '<section class="caixa" aria-labelledby="t-ginasios"><h2 class="titulo" id="t-ginasios">Ginásios</h2>' +
        '<ul class="ginasios">' + GD.GYM_ORDER.map(ginasioCartaoHtml).join('') + '</ul>' +
      '</section>' +
      '<section class="caixa" aria-labelledby="t-selvagens"><h2 class="titulo" id="t-selvagens">Cavalos selvagens</h2>' +
        '<p class="nota">Exemplos de achados em expedições. A captura ainda não está neste protótipo.</p>' +
        '<div class="selvagens">' + wild + '</div>' +
      '</section>' +
      '</section>';
  }

  // Subtela "ginasio" (ui.gym = { id, etapa }): a trilha do ginásio (etapa null) ou o detalhe da etapa próxima (etapa
  // 0–4) ou da revanche do líder. O detalhe só fica aberto enquanto o módulo deixa (ginModo: a etapa próxima, ou a revanche
  // livre hoje); se o progresso mudou (outra aba, gaveta DEV, a revanche de hoje feita em outra aba), volta à trilha.
  // Com o resumo de um desafio pago (ui.gym.res), o resumo. O cavalo do time que saiu do save (outra aba) sai do time.
  function renderGinasio() {
    var G0 = ui.gym;
    if (!G0 || !hasOwn(GD.GYMS, G0.id)) return renderExpedicao();
    if (G0.res) return ginResumoHtml(G0.res);
    G0.time = (G0.time || []).filter(function (u) { return !!mountByUid(u); });
    if (G0.etapa !== null && !ginModo(G0.id, G0.etapa).pode) G0.etapa = null;
    return G0.etapa === null ? trilhaTelaHtml(G0.id) : etapaDetalheHtml(G0.id, G0.etapa);
  }
  // Uma etapa da trilha. Vencida: só texto (não se repete). Próxima: o único botão tocável (aria-current="step"), que abre
  // o detalhe. Fechada: botão apagado (aria-disabled) com o motivo escrito. Com a insígnia, o líder mostra o ícone dela e
  // vira a revanche (o módulo diz qual, ginModo): livre hoje, um botão como a próxima ("Revanche hoje", a entrada da revanche
  // e o prêmio de hoje do rodízio); já tentada hoje, só texto ("Revanche de hoje feita. Volte amanhã.").
  function trilhaEtapaHtml(id, e, i) {
    var p = ginProgresso(id), modo = e.lider && ginTemInsignia(id) ? ginModo(id, i) : null;
    var estado = modo && modo.revanche ? (modo.pode ? 'revanche' : 'feita') : i < p ? 'vencida' : i === p ? 'proxima' : 'fechada';
    var MOTIVO = 'Vença a etapa anterior';
    var estadoTxt = { vencida: 'Vencida', proxima: 'Próxima', fechada: 'Fechada', revanche: 'Revanche hoje', feita: 'Feita hoje' }[estado];
    var rev = estado === 'revanche' || estado === 'feita';
    var corpo = '<span class="etapa-rotulo">' + esc(ginEtapaRotulo(e, i)) + '</span>' +
      '<span class="etapa-nome">' + esc(e.nome) + '</span>' +
      '<span class="etapa-meta">' + esc(ginCavalosTxt(e.cavalos.length)) + ' · ' + esc(ginNivelTxt(e)) + ' · ' + esc(ginEntradaTxt({ entrada: ginEntrada(id, i, rev) })) + '</span>' +
      '<span class="etapa-estado etapa-estado--' + estado + '">' + esc(estadoTxt) + '</span>' +
      (estado === 'fechada' ? '<span class="etapa-motivo">' + esc(MOTIVO) + '</span>' : '') +
      (estado === 'revanche' ? '<span class="etapa-motivo">' + esc('Prêmio de hoje: ' + ginRevPremioTxt(id)) + '</span>' : '') +
      (estado === 'feita' ? '<span class="etapa-motivo">Revanche de hoje feita. Volte amanhã.</span>' : '') +
      (e.lider && ginTemInsignia(id) ? '<span class="etapa-insignia">' + ginInsigniaIcone(id) + '</span>' : '');
    var caixa = estado === 'vencida' || estado === 'feita'
      ? '<div class="etapa-btn">' + corpo + '</div>'
      : '<button type="button" class="etapa-btn" data-acao="ginasio-etapa" data-id="' + i + '"' +
          (estado === 'proxima' || estado === 'revanche' ? ' aria-current="step"' : indisponivel(MOTIVO)) + '>' + corpo + '</button>';
    return '<li class="etapa etapa--' + estado + (e.lider ? ' etapa--lider' : '') + '" data-etapa="' + i + '" data-estado="' + estado + '">' + caixa + '</li>';
  }
  // A trilha: de baixo para cima (a 1ª etapa embaixo; o DOM vai da 1ª à 5ª, o CSS vira a coluna)
  function trilhaHtml(id) {
    var g = GD.GYMS[id];
    return '<ol class="trilha">' + g.etapas.map(function (e, i) { return trilhaEtapaHtml(id, e, i); }).join('') + '</ol>';
  }
  // A tela da trilha: o elemento, o progresso, o ponto fraco escrito e, com a insígnia, o nome e o bônus dela; embaixo, a trilha
  function trilhaTelaHtml(id) {
    var g = GD.GYMS[id];
    return '<section class="tela" aria-labelledby="t-ginasio">' +
      '<button type="button" class="btn btn--pequeno" data-acao="ginasio-voltar">Voltar</button>' +
      '<h1 class="titulo titulo--tela" id="t-ginasio" tabindex="-1" data-foco>' + esc(g.name) + '</h1>' + noticeHtml() +
      '<div class="caixa ginasio-topo">' +
        '<div class="linha-meta">' + elementHtml(g.element) + '<span>' + esc(ginProgressoTxt(id)) + '</span></div>' +
        '<p class="ginasio-fraco">' + esc(ginFracoTxt(id)) + '</p>' +
        (ginTemInsignia(id) ? '<p class="ginasio-insignia">' + ginInsigniaIcone(id) + '<span><b>' + esc(g.insignia.name) + ':</b> ' + esc(ginBonusTxt(id)) + '.</span></p>' : '') +
      '</div>' +
      '<section class="caixa" aria-labelledby="t-trilha"><h2 class="titulo" id="t-trilha">Trilha</h2>' +
        '<p class="nota">Vença as etapas em ordem, de baixo para cima.</p>' + trilhaHtml(id) +
      '</section>' +
      '</section>';
  }
  // Detalhe da etapa (só leitura): os cavalos do adversário, a pista da casa, a entrada e o prêmio. A Tarefa 5 junta o
  // time e o "Desafiar" (etapaDetalheHtml monta a tela com as partes abaixo; cada parte é uma função).
  function etapaAdversarioHtml(e) {
    return '<section class="caixa" aria-labelledby="t-adversario"><h2 class="titulo" id="t-adversario">Adversário<span class="sr">, </span><span class="nota">' + esc(ginCavalosTxt(e.cavalos.length)) + '</span></h2>' +
      '<ol class="adv-cavalos">' + e.cavalos.map(function (c) {
        var h = GN.cavalo(c);
        return '<li class="adv-cavalo">' + portraitHtml(h, { tamanho: 'pequeno' }) +
          '<div class="adv-cavalo-info"><b class="cavalo-nome">' + esc(h.name) + '</b>' +
          '<div class="linha-meta"><span>Nível ' + esc(h.level) + '</span>' + estrelasHtml(h.grau) + '</div>' +
          '<div class="linha-meta">' + elementHtml(h.element) + '<span>Poder <b>' + RS.powerRating(h) + '</b></span></div></div></li>';
      }).join('') + '</ol></section>';
  }
  function etapaPistaHtml(id) {
    return '<section class="caixa" aria-labelledby="t-pista-casa"><h2 class="titulo" id="t-pista-casa">Pista da casa</h2>' +
      '<p class="ginasio-pista">' + esc(ginPistaTxt(GD.GYMS[id].pista)) + '</p>' +
      '<p class="ginasio-fraco">' + esc(ginFracoTxt(id)) + '</p></section>';
  }
  // rev: a revanche do líder (a entrada da revanche e o prêmio de hoje do rodízio no lugar do da 1ª vitória)
  function etapaPremioHtml(id, e, i, rev) {
    return '<section class="caixa" aria-labelledby="t-premio-etapa"><h2 class="titulo" id="t-premio-etapa">Entrada e prêmio</h2>' +
      '<p>' + esc(ginEntradaTxt({ entrada: ginEntrada(id, i, rev) })) + '</p>' +
      (rev ? '<p>' + esc('Prêmio de hoje: ' + ginRevPremioTxt(id)) + '</p>' : '<p>Prêmio da 1ª vitória: ' + esc(ginPremioTxt(id, e)) + '</p>') + '</section>';
  }
  // O detalhe é também o preparo (Tarefa 5): embaixo do adversário, da pista e do prêmio, o "Seu time" e o "Desafiar". Na
  // revanche do líder (o módulo diz, ginModo), "Revanche" no título, a entrada da revanche e o prêmio de hoje.
  function etapaDetalheHtml(id, i) {
    var g = GD.GYMS[id], e = g.etapas[i], rev = ginModo(id, i).revanche;
    return '<section class="tela" aria-labelledby="t-etapa">' +
      '<button type="button" class="btn btn--pequeno" data-acao="ginasio-voltar">Voltar</button>' +
      '<header class="tela-cabeca placa"><span class="rotulo">' + esc(g.name + ' · ' + ginEtapaRotulo(e, i)) + '</span>' +
        '<h1 class="titulo titulo--tela" id="t-etapa" tabindex="-1" data-foco>' + esc((rev ? 'Revanche: ' : '') + e.nome) + '</h1></header>' + noticeHtml() +
      etapaAdversarioHtml(e) + etapaPistaHtml(id) + etapaPremioHtml(id, e, i, rev) + etapaTimeHtml(id, i) + etapaDesafiarHtml(id, i) +
      '</section>';
  }

  // ---- O desafio (spec §5, §7, §8): o time, o pagamento e o resumo ----
  // ui.gym = { id, etapa, time: [uids na ordem dos toques], res: null | o resumo do desafio já pago e gravado, msg: o
  // aviso da gravação que falhou (no preparo) }. Nada do desafio é calculado antes do toque em "Desafiar": o preparo só
  // mostra o catálogo, o time e a vantagem de elemento (Ginasio.vantagem); o resultado sai no desafia, já pago.
  // Ruling 29: o jogo não tem como fechar uma sala sem correr; a frase diz só o que existe
  var GIN_CORRA_TXT = 'Corra essa corrida primeiro.';
  var GIN_SALA_TXT = 'Está na sala aberta. ' + GIN_CORRA_TXT;
  var GIN_SO_UM_TXT = 'Seu único cavalo está na sala aberta. ' + GIN_CORRA_TXT;
  // o sorteio de skill ao subir de nível num desafio (Ruling 18): seedTag = GIN_SEED_TAG + contador · 4 + posição no time
  var GIN_SEED_TAG = 20000000;
  function ginLimite(id, i) { return GD.GYMS[id].etapas[i].cavalos.length; }
  // o cavalo não entra no time: o ativo de uma sala aberta (ganhar XP mudaria o Poder que a sala viu; spec §5). A aba
  // Correr não tem outro estado em que um cavalo não possa correr.
  function ginPreso(m) { return !!state.pending && m.uid === state.activeId; }
  function ginLivres() { return state.mounts.filter(function (m) { return !ginPreso(m); }); }
  // "Vantagem", "Desvantagem" ou '' contra o elemento do ginásio
  function ginVantTxt(m, id) {
    var v = GN.vantagem(m.element, GD.GYMS[id].element);
    return v === 1 ? 'Vantagem' : v === -1 ? 'Desvantagem' : '';
  }
  function ginCheioTxt(n) { return n === 1 ? 'O time já tem 1 cavalo. Toque nele para tirar.' : 'O time já tem ' + n + ' cavalos. Toque num deles para tirar.'; }
  // a entrada da etapa i, com rev (é a revanche) vindo do Ginasio.podeDesafiar (ginModo ou ginConfere): o botão e o desafia
  // usam esta mesma função com a resposta do módulo
  function ginEntrada(id, i, rev) { return rev ? GD.GYM.revanche.entrada : GD.GYMS[id].etapas[i].entrada; }
  // o prêmio da próxima revanche vencida, perguntado ao módulo (Ginasio.revanchePremio, o mesmo que o acerto paga; Ruling 26)
  function ginRevPremio(id) { return GN.revanchePremio(state.ginasios[id].revVitorias) || {}; }
  function ginRevPremioTxt(id) { var p = ginRevPremio(id); return p.item ? itemQtdTxt(p.item, 1) : fmt(p.ouro || 0) + ' de Ouro'; }
  // os itens que o prêmio da vitória daria (o da revanche, o de hoje do rodízio)
  function ginItensPremio(id, i, rev) {
    if (!rev) return GD.GYMS[id].etapas[i].premio.itens;
    var p = ginRevPremio(id);
    return p.item ? [p.item] : [];
  }
  // o motivo da mochila cheia, com o nome e o teto do catálogo (itemQtdTxt; a Rédea nova mora fora da mochila: 999)
  function ginCheiaTxt(it) {
    return 'Você já tem ' + (it === 'redea' ? itemQtdTxt(it, REDEAS_MAX) + ', o máximo.' : itemQtdTxt(it, GD.BAG_MAX) + ', o máximo da mochila.') +
      ' Use antes de desafiar.';
  }
  // o texto de cada recusa do Ginasio.podeDesafiar
  function ginMotivoTxt(id, i, motivo, rev) {
    switch (motivo) {
      case 'sem-time': return 'Escolha pelo menos 1 cavalo.';
      case 'sem-ouro':
        return 'Falta Ouro: a entrada custa ' + fmt(ginEntrada(id, i, rev)) + ' de Ouro.' +
          (ouroReservado() ? ' ' + reservaTxt() + ': sobram ' + fmt(ouroLivre()) + ' para gastar.' : '');
      case 'cheia': {
        var its = ginItensPremio(id, i, rev);
        for (var k = 0; k < its.length; k++) if (!diariaCabe(its[k], 1)) return ginCheiaTxt(its[k]);
        return 'A mochila está cheia. Use um item antes de desafiar.';
      }
      case 'time-grande': return 'O time passou do limite: até ' + ginCavalosTxt(ginLimite(id, i)) + '.';
      case 'vencida': return 'Esta etapa já foi vencida.';
      case 'revanche-hoje': return 'A revanche de hoje já foi feita. Volte amanhã.';
      default: return 'Esta etapa ainda não está aberta.';
    }
  }
  // Confere o desafio: { motivo ('' quando pode), revanche }. Na ordem: nenhum cavalo livre; a regra do Ginasio.podeDesafiar
  // (etapa, dia, Ouro livre, mochila, tamanho do time); o time (cada uid no estábulo, sem repetir, nenhum preso na sala
  // aberta). O botão "Desafiar" (o número e o motivo) e o desafia (a entrada cobrada; de novo, depois de sincronizar com as
  // outras abas) usam esta mesma conferência. revanche: a do podeDesafiar que passou; se ele recusa, a do ginModo (o mesmo
  // módulo, para o número do botão e o texto do motivo). hoje: o dia já lido por quem chama (o desafia lê uma vez só)
  function ginConfere(id, i, uids, hoje) {
    if (!hasOwn(GD.GYMS, id)) return { motivo: ginMotivoTxt(id, i, 'fechada'), revanche: false };
    var hj = hoje === undefined ? hojeDia() : hoje, rev = ginModo(id, i, hj).revanche;
    if (!ginLivres().length) return { motivo: GIN_SO_UM_TXT, revanche: rev };
    var lista = Array.isArray(uids) ? uids : [];
    var r = GN.podeDesafiar({ gymId: id, etapa: i, progresso: state.ginasios, hoje: hj, ouroLivre: ouroLivre(), cabe: diariaCabe, timeLen: lista.length });
    if (!r.ok) return { motivo: ginMotivoTxt(id, i, r.motivo, rev), revanche: rev };
    for (var k = 0; k < lista.length; k++) {
      var m = typeof lista[k] === 'string' ? mountByUid(lista[k]) : null;
      if (!m) return { motivo: 'Um cavalo do time não está mais no estábulo.', revanche: r.revanche };
      if (lista.indexOf(lista[k]) !== k) return { motivo: 'O mesmo cavalo está duas vezes no time.', revanche: r.revanche };
      if (ginPreso(m)) return { motivo: m.name + ' está na sala aberta. ' + GIN_CORRA_TXT, revanche: r.revanche };
    }
    return { motivo: '', revanche: r.revanche };
  }
  // "Seu time": as linhas do Estábulo (mountRowHtml), na ordem do estábulo. Tocar põe no fim do time; tocar de novo tira.
  // A linha escolhida mostra a posição e tem aria-pressed. Com o time cheio, as de fora ficam apagadas com o motivo; o ativo
  // da sala aberta também (no time, ele mostra o motivo e ainda pode sair). Sem nenhum cavalo livre, a frase do que fazer.
  function etapaTimeHtml(id, i) {
    var G0 = ui.gym, lim = ginLimite(id, i), time = G0.time, cheio = time.length >= lim, el = elementOf(GD.GYMS[id].element).name;
    var cab = '<section class="caixa" aria-labelledby="t-time"><h2 class="titulo" id="t-time">Seu time <span class="nota">(até ' + esc(ginCavalosTxt(lim)) + ')</span></h2>';
    if (!ginLivres().length) return cab + '<p class="aviso">' + esc(GIN_SO_UM_TXT) + '</p></section>';
    var linhas = state.mounts.map(function (m) {
      var pos = time.indexOf(m.uid), dentro = pos >= 0, preso = ginPreso(m);
      var motivo = dentro ? '' : preso ? GIN_SALA_TXT : cheio ? ginCheioTxt(lim) : '';
      var nota = preso ? GIN_SALA_TXT : motivo, vt = ginVantTxt(m, id);
      // a linha apagada diz o motivo no lugar da instrução (o toque nela não põe no time)
      var fim = (vt ? vt + ' contra ' + el + '. ' : '') + (dentro ? (pos + 1) + 'º do time. Toque para tirar.' : motivo || 'Toque para pôr no time.');
      return '<li>' + mountRowHtml(m, m.uid === state.activeId, { acao: 'ginasio-time', fim: fim, motivo: motivo, pressed: dentro,
          meta: vt ? '<span class="gin-vant gin-vant--' + (vt === 'Vantagem' ? 'mais' : 'menos') + '">' + esc(vt) + '</span>' : '',
          lado: '<span class="gin-pos" aria-hidden="true">' + (dentro ? (pos + 1) + 'º' : '') + '</span>' }) +
        (nota ? '<p class="nota">' + esc(nota) + '</p>' : '') + '</li>';
    }).join('');
    return cab + '<p class="nota">Toque nos cavalos na ordem em que vão correr.</p><ul class="montarias item-escolha gin-time">' + linhas + '</ul></section>';
  }
  function etapaDesafiarHtml(id, i) {
    var G0 = ui.gym, c = ginConfere(id, i, G0.time);
    return '<section class="caixa gin-desafio" aria-label="Desafiar">' + (G0.msg ? '<p class="aviso" role="status">' + esc(G0.msg) + '</p>' : '') +
      '<div class="acoes"><button type="button" class="btn btn--ouro btn--grande" data-acao="ginasio-desafiar"' + indisponivel(c.motivo) + '>' +
        esc('Desafiar (' + fmt(ginEntrada(id, i, c.revanche)) + ' de Ouro)') + '</button></div>' +
      (c.motivo ? '<p class="nota">' + esc(c.motivo) + '</p>' : '') + '</section>';
  }
  // Paga e acerta o desafio, tudo numa gravação só (o padrão do usaItem): sincroniza com as outras abas (persist), confere
  // de novo (ginConfere), só então resolve (Ginasio.resolver, com os cavalos como estão ao pagar) e acerta (Ginasio.acerto);
  // aplica a entrada, o prêmio, os itens, o XP de cada cavalo (com o bônus das insígnias de ANTES: a ganha agora vale dali em
  // diante), o progresso e o contador + 1, e grava (gravaGasto). 'ok' (o resumo em ui.gym.res), 'outra-aba' (um save de outra
  // aba foi adotado: nada foi cobrado nem sorteado) ou o motivo da recusa (FALHA_SALVAR: o state volta ao de antes, sem resumo).
  function desafia(gymId, etapa, uids) {
    var s0 = state;
    persist();
    if (state !== s0) return 'outra-aba';
    var hoje = hojeDia();   // o dia lido uma vez: a conferência e o acerto usam o mesmo
    var c = ginConfere(gymId, etapa, uids, hoje);
    if (c.motivo) return c.motivo;
    var antes = clone(state), contador = state.gymCounter, et = GD.GYMS[gymId].etapas[etapa];
    var res = GN.resolver({ gymId: gymId, etapa: etapa, time: uids.map(function (u) { return clone(mountByUid(u)); }), seedBase: state.seedBase, contador: contador });
    var ac = res ? GN.acerto({ gymId: gymId, etapa: etapa, revanche: c.revanche, progresso: state.ginasios, resultado: res, hoje: hoje, timeLen: uids.length }) : null;
    if (!ac) return 'Este desafio não pode ser feito agora.';   // não acontece: o ginConfere já passou pelo podeDesafiar
    var entrada = ginEntrada(gymId, etapa, c.revanche);   // a entrada cobrada: a mesma conta do número do botão, com o revanche do podeDesafiar
    state.gold = state.gold - entrada + ac.ouro;   // o prêmio do ginásio não leva o bônus de Ouro (só a corrida valendo)
    ac.itens.forEach(function (it) { if (it === 'redea') state.redeas += 1; else state.mochila[it] += 1; });
    var cavalos = uids.map(function (u, k) {
      var m = mountByUid(u), xp = xpComBonus(ac.xp[k]);
      var g = applyXp(m, xp, GIN_SEED_TAG + contador * 4 + k);
      return { uid: u, nome: m.name, correu: res.duelos.some(function (d) { return d.a === k; }), xp: xp, levels: g.levels, nivel: m.level, learned: g.learned };
    });
    state.ginasios = ac.progresso;
    state.gymCounter = contador + 1;
    var gv = gravaGasto(s0, antes);
    if (gv === 'outra-aba') return 'outra-aba';
    if (gv === 'falhou') return FALHA_SALVAR;
    var prox = ac.progresso[gymId].etapa;
    var R = { gymId: gymId, etapa: etapa, revanche: c.revanche, contador: contador, venceu: res.venceu, entrada: entrada, ouro: ac.ouro, itens: ac.itens,
      insignia: ac.insignia, proxima: res.venceu && !c.revanche && prox < ginEtapasTotal(gymId) ? prox : null, cavalos: cavalos,
      adversario: et.cavalos.map(function (d) { return GN.cavalo(d).name; }), duelos: res.duelos };
    if (ui.gym) ui.gym.res = R;
    return 'ok';
  }
  // O resumo (só leitura; não é gravado: recarregar mostra a trilha já atualizada). R = ui.gym.res: { gymId, etapa,
  // revanche, contador, venceu, entrada, ouro, itens, insignia, proxima (índice da etapa aberta ou null), cavalos: [{ uid,
  // nome, correu, xp, levels, nivel, learned }], adversario: [nomes], duelos: os do Ginasio.resolver (com a cfg de cada um) }
  function ginDueloHtml(R, d, k) {
    var a = R.cavalos[d.a].nome, b = R.adversario[d.b], jog = d.vencedor === 'jogador', quem = jog ? a : b;
    var m = d.metros, prox = R.duelos[k + 1];
    var folego = prox ? (jog ? prox.folegoA : prox.folegoB) : 1;
    return '<li class="gin-duelo gin-duelo--' + (jog ? 'vitoria' : 'derrota') + '">' +
      '<span class="gin-duelo-txt">' + esc('Duelo ' + (k + 1) + ': ' + a + ' × ' + b + ' — ' + quem + ' vence por ' + ginMetrosTxt(m)) + '</span>' +
      '<span class="gin-duelo-tag">' + (jog ? 'Você venceu' : 'Você perdeu') + '</span>' +
      (folego < 1 ? '<span class="gin-duelo-folego">' + esc(quem + ' segue com ' + Math.round(folego * 100) + '% do fôlego') + '</span>' : '') + '</li>';
  }
  function ginResumoHtml(R) {
    var g = GD.GYMS[R.gymId], e = g.etapas[R.etapa];
    var ouro = '<p>' + esc('Entrada: −' + fmt(R.entrada) + ' de Ouro') + '</p>' + (R.ouro ? '<p>' + esc('Prêmio: +' + fmt(R.ouro) + ' de Ouro') + '</p>' : '') +
      (R.itens.length ? '<p>' + esc('Itens: ' + ginJunta(R.itens.map(function (it) { return itemQtdTxt(it, 1); }))) + '</p>' : '');
    var cavalos = R.cavalos.map(function (c) {
      var partes = [c.correu ? c.nome + ': +' + c.xp + ' XP' : c.nome + ': não correu'];
      if (c.levels) partes.push('subiu ' + (c.levels === 1 ? '1 nível' : c.levels + ' níveis') + ' (Nível ' + c.nivel + ')');
      c.learned.forEach(function (s) { partes.push('aprendeu ' + skillNome(s)); });
      return '<li data-uid="' + esc(c.uid) + '">' + esc(partes.join(' · ')) + '</li>';
    }).join('');
    return '<section class="tela" aria-labelledby="t-resumo">' +
      '<header class="tela-cabeca placa"><span class="rotulo">' + esc(g.name + ' · ' + (R.revanche ? 'Revanche' : ginEtapaRotulo(e, R.etapa)) + ' · ' + e.nome) + '</span>' +
        '<h1 class="titulo titulo--tela" id="t-resumo" tabindex="-1" data-foco>' + (R.venceu ? 'Vitória!' : 'Derrota') + '</h1></header>' + noticeHtml() +
      '<section class="caixa" aria-labelledby="t-duelos"><h2 class="titulo" id="t-duelos">Duelos</h2><ol class="gin-duelos">' +
        R.duelos.map(function (d, k) { return ginDueloHtml(R, d, k); }).join('') + '</ol></section>' +
      '<section class="caixa gin-ganhos" aria-labelledby="t-ganhos"><h2 class="titulo" id="t-ganhos">Ouro e itens</h2>' + ouro + '</section>' +
      '<section class="caixa" aria-labelledby="t-xp-time"><h2 class="titulo" id="t-xp-time">Seu time</h2><ul class="gin-xp">' + cavalos + '</ul></section>' +
      (R.insignia ? '<section class="caixa"><p class="ginasio-insignia">' + ginInsigniaIcone(R.gymId) + '<span><b>' + esc(g.insignia.name) + ' conquistada:</b> ' + esc(ginBonusTxt(R.gymId)) + '.</span></p></section>' : '') +
      (R.proxima !== null ? '<p class="gin-liberada">' + esc('Próxima etapa liberada: ' + g.etapas[R.proxima].nome) + '</p>' : '') +
      // a revanche perdida gastou a tentativa do dia: sem "Tentar de novo"
      (R.revanche && !R.venceu ? '<p class="nota">Volte amanhã para tentar de novo.</p>' : '') +
      '<div class="acoes acoes--linha">' +
        (R.venceu || R.revanche ? '' : '<button type="button" class="btn btn--ouro" data-acao="ginasio-resumo" data-id="denovo">Tentar de novo</button>') +
        '<button type="button" class="btn" data-acao="ginasio-resumo" data-id="trilha">Voltar à trilha</button></div>' +
      '</section>';
  }

  // ---------------------------------------------------------------------------------------------
  // Os duelos na tela (Tarefa 6): depois de pagar (tudo já gravado), duelo 1 → cartão → duelo 2 → … → resumo. Só animação do
  // que está em ui.gym.res: nada grava nem muda o state. ui.gym.ver = { k (o duelo), tela: 'desafio' | 'duelo' | 'cartao', L e cab (a
  // corrida e o cabeçalho que a tela de corrida mostra, só na tela 'duelo') }. Tudo o que a tela diz de um duelo (nomes,
  // vantagem, vencedor, metros, faixa, fôlego) sai do R gravado; a simulação refeita com quadros só desenha a corrida.
  // Nada fala dos duelos seguintes nem de quantos serão (Ruling 22).
  // ---------------------------------------------------------------------------------------------
  var GIN_SEDA = { fogo: 0, agua: 1, grama: 4 };   // a seda dos cavalos de cada ginásio (índice em Sprites.SILKS)
  // metros da chegada truncados para baixo (Ruling 24: as faixas do cansaço têm limites inteiros, e o número nunca as
  // contradiz); abaixo de 1 m, "menos de 1 m" (Ruling 20)
  function ginMetrosTxt(m) { var r = Math.floor(m); return r < 1 ? 'menos de 1 m' : r + ' m'; }
  function ginFolegoTxt(quem, f) { return quem + ' larga com ' + Math.round(f * 100) + '% do fôlego'; }
  // o duelo k de R: a (o seu cavalo), b (o do adversário, com o dono: os cavalos do adversário têm o nome do inicial), a
  // vantagem de elemento por escrito e a linha do cabeçalho (com o fôlego de quem larga cansado)
  function ginDueloTxt(R, k) {
    var d = R.duelos[k], dono = GD.GYMS[R.gymId].etapas[R.etapa].nome;
    var a = R.cavalos[d.a].nome, b = R.adversario[d.b] + ' (' + dono + ')';
    var ea = elementOf(d.cfg.racers[0].horse.element).name, eb = elementOf(d.cfg.racers[1].horse.element).name;
    var vant = d.vantagem === 1 ? 'Vantagem: ' + a + ' (' + ea + ' vence ' + eb + ')'
      : d.vantagem === -1 ? 'Vantagem: adversário (' + eb + ' vence ' + ea + ')' : 'Sem vantagem de elemento';
    var fol = d.folegoA < 1 ? ginFolegoTxt(a, d.folegoA) : d.folegoB < 1 ? ginFolegoTxt(b, d.folegoB) : '';
    return { a: a, b: b, vant: vant, linha: fol ? vant + ' · ' + fol : vant };
  }
  // A corrida do duelo k para a tela de corrida (o L que ela lê, como o da sala, e o cabeçalho): a cfg gravada simulada de
  // novo com os quadros (a mesma seed e os mesmos cavalos: o mesmo resultado). O nome do dono no 2º corredor só muda o texto
  // da narração (o RaceSim põe "Brasa (Cabo Tocha)" quando os dois cavalos têm o mesmo nome).
  function ginDueloVer(R, k) {
    var d = R.duelos[k], g = GD.GYMS[R.gymId], dono = g.etapas[R.etapa].nome;
    var cfg = clone(d.cfg);
    cfg.recordFrames = true;
    cfg.racers[1].name = dono;
    var sim = RS.simulate(cfg);
    // a corrida refeita tem de ser a gravada (o mesmo vencedor e a mesma distância); se não for (regra de outra versão), o
    // duelo não é animado: a tela nunca mostra uma chegada que contradiz o que foi gravado
    if ((sim.finishOrder[0] === 0) !== (d.vencedor === 'jogador') || GN.metros(sim) !== d.metros) {
      if (window.console && window.console.warn) window.console.warn('Duelo ' + (k + 1) + ': a corrida refeita não bate com o gravado; o duelo não é animado.');
      return { k: k, tela: 'duelo', L: null, cab: null };
    }
    var a = cfg.racers[0].horse, b = cfg.racers[1].horse, seda = hasOwn(GIN_SEDA, R.gymId) ? GIN_SEDA[R.gymId] : 0, t = ginDueloTxt(R, k);
    var L = {
      counter: 0, seed: sim.seed, training: false, fee: 0, n: 2, cond: withRanges(sim.conditions), trackName: g.name,
      regiao: hasOwn(GIN_REGIAO, R.gymId) ? GIN_REGIAO[R.gymId] : null,
      racers: [
        { isPlayer: true, name: PLAYER_NAME, horse: a, gear: null, silks: PLAYER_SILKS, silkIdx: -1 },
        { isPlayer: false, name: dono, horse: b, gear: null, silks: SP.SILKS[seda], silkIdx: seda, rotulo: a.name === b.name ? b.name + ' (' + dono + ')' : null }
      ],
      playerIdx: 0, sim: sim, dev: null
    };
    return { k: k, tela: 'duelo', L: L, cab: {
      titulo: g.name, aria: 'Duelo ' + (k + 1) + ': ' + t.a + ' contra ' + t.b, linha: t.linha, pular: 'Pular', pularFim: 'Continuar',
      placa: '<span class="rotulo">' + esc('Duelo ' + (k + 1)) + '</span>',
      extra: '<button type="button" class="btn btn--pequeno" data-acao="ginasio-pular-tudo">Pular tudo</button>'
    } };
  }
  // o cartão depois do duelo k (há um seguinte): o resultado do ponto de vista do jogador, quem saiu e quem entra, a faixa com
  // o fôlego de quem ficou (o do duelo seguinte, gravado) e a vantagem do próximo
  function ginCartaoTxt(R, k) {
    var d = R.duelos[k], p = R.duelos[k + 1], jog = d.vencedor === 'jogador', x = ginDueloTxt(R, k), y = ginDueloTxt(R, k + 1);
    return {
      titulo: x.a + (jog ? ' venceu por ' : ' perdeu por ') + ginMetrosTxt(d.metros),
      saiu: jog ? x.b + ' saiu. Entra ' + y.b + ', Nível ' + p.cfg.racers[1].horse.level + '.' : x.a + ' saiu. Entra ' + y.a + '.',
      folego: 'Vitória ' + d.faixa.name.toLowerCase() + ' (' + ginMetrosTxt(d.metros) + '): ' + ginFolegoTxt(jog ? x.a : x.b, jog ? p.folegoA : p.folegoB),
      vant: y.vant
    };
  }
  function renderEntreDuelos() {
    // go() só chega aqui com um cartão a mostrar (ginTemCartao)
    var v = ui.gym.ver, R = ui.gym.res;
    var t = ginCartaoTxt(R, v.k);
    return '<section class="tela tela--entreduelos" aria-labelledby="t-cartao">' +
      '<header class="tela-cabeca placa"><span class="rotulo">' + esc(GD.GYMS[R.gymId].name + ' · Duelo ' + (v.k + 1)) + '</span>' +
        '<h1 class="titulo titulo--tela" id="t-cartao" tabindex="-1" data-foco>' + esc(t.titulo) + '</h1></header>' +
      '<div class="caixa gin-cartao">' +
        '<p class="gin-cartao-saiu">' + esc(t.saiu) + '</p>' +
        '<p class="gin-cartao-folego">' + esc(t.folego) + '</p>' +
        '<p class="gin-cartao-vant">' + esc(t.vant) + '</p></div>' +
      '<div class="acoes acoes--linha">' +
        '<button type="button" class="btn btn--ouro" data-acao="ginasio-proximo">Próximo duelo</button>' +
        '<button type="button" class="btn" data-acao="ginasio-pular-tudo">Pular tudo</button></div>' +
      '</section>';
  }
  // ---------------------------------------------------------------------------------------------
  // A tela de desafio antes de cada duelo (a "Cena 2" que o Vinicius escolheu em 2026-11-18): o oponente (arte do PixelLab,
  // window.__TREINADORES, embutida pelo build) e o cavalo dele em cima, à direita, virado para o seu cavalo, embaixo, à
  // esquerda; as placas com o nome, o cavalo, o nível e o tipo; e a linha da vantagem de elemento. Só mostra o que o cartão
  // e a tela do duelo já mostram: nada do resultado nem dos duelos seguintes (Ruling 22). ui.gym.ver = { k, tela:
  // 'desafio' }; "Começar duelo" leva ao duelo k; "Pular tudo" e o voltar do aparelho, ao resumo. Sem a arte do oponente,
  // a cena fica só com o cavalo dele. Só desenho: nada grava nem muda o state.
  // ---------------------------------------------------------------------------------------------
  var CENA_W = 160, CENA_H = 112, CENA_PISO = 30;   // a cena em pixels de arte (o canvas sai em escala inteira, 1 a 3)
  // o fundo de cada ginásio: parede (tijolo na Fornalha, pedra com um filete de água no Remanso, tábuas com cipó na
  // Capoeira), duas luzes, o piso e os dois tablados
  var CENA_CORES = {
    fogo: { parede: '#3a1410', junta: '#4c1a12', piso: '#6a2a14', risco: '#7c3418', borda: '#2c1008', palco: '#8c3c1c', palco2: '#4a1c10', luz: '#ff6a1a', luz2: '#ffb020', suporte: '#5a4a4c' },
    agua: { parede: '#142c38', junta: '#1d3a48', piso: '#24505e', risco: '#2d606f', borda: '#0c1e26', palco: '#3f7c8c', palco2: '#1a3a46', luz: '#62b8ff', luz2: '#c8ecff', suporte: '#4a5a64', agua: '#2f7fa8', espuma: '#7fc8e8' },
    grama: { parede: '#33240f', junta: '#46321a', piso: '#3d6b2a', risco: '#4c7d33', borda: '#1e3612', palco: '#7a5a2e', palco2: '#4a3418', luz: '#8ee06a', luz2: '#e8f8a0', suporte: '#5a4a32', cipo: '#3f8a3a' }
  };
  var cenaQueue = [];   // as cenas da tela atual (como o portraitQueue): { gymId, dono, a, b }
  var cenaItems = [];   // os desenhos dessas cenas (para redesenhar só o canvas quando a arte do oponente chega)
  var treinadorImgs = {};
  // o id da arte do oponente: o nome do catálogo sem acento, em minúsculas e com hífen ("Capitã Labareda" → capita-labareda)
  function ginTreinadorId(nome) {
    var s = String(nome);
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  // a imagem do oponente, carregada uma vez; ao chegar, só as cenas na tela são desenhadas de novo (redesenhar a tela
  // inteira tiraria o foco do título). null enquanto não chega (ou sem arte para ele)
  function treinadorImg(id) {
    var m = window.__TREINADORES;
    if (!m || !hasOwn(m, id)) return null;
    var im = treinadorImgs[id];
    if (!im) {
      im = treinadorImgs[id] = new Image();
      im.onload = function () { cenaItems.forEach(function (it) { it.drawn = false; it.draw(it.t || 0); }); };
      im.src = m[id];
    }
    return im.complete && im.naturalWidth ? im : null;
  }
  // as placas e o palco da cena do duelo k (o canvas é desenhado no hydrate: drawGinCena)
  function ginCenaHtml(R, k) {
    var d = R.duelos[k], dono = GD.GYMS[R.gymId].etapas[R.etapa].nome;
    var a = d.cfg.racers[0].horse, b = d.cfg.racers[1].horse, an = R.cavalos[d.a].nome, bn = R.adversario[d.b];
    var n = cenaQueue.length;
    cenaQueue.push({ gymId: R.gymId, dono: dono, a: a, b: b });
    var placa = function (cls, quem, nome, h) {
      return '<div class="gin-placa gin-placa--' + cls + '"><b class="gin-placa-quem">' + esc(quem) + '</b>' +
        '<span class="gin-placa-cavalo">' + esc(nome + ' · Nv ' + h.level) + '</span>' + elementHtml(h.element) + '</div>';
    };
    return '<div class="gin-cena gin-cena--' + esc(R.gymId) + '">' + placa('rival', dono, bn, b) +
      '<div class="gin-cena-palco"><canvas class="gin-cena-tela" data-cena="' + n + '" role="img" aria-label="' +
        esc(dono + ' e ' + bn + ' contra você e ' + an) + '"></canvas><span class="gin-vs" aria-hidden="true">VS</span></div>' +
      placa('voce', 'Você', an, a) + '</div>';
  }
  function drawGinCena(cv) {
    var e = cenaQueue[Number(cv.getAttribute('data-cena'))];
    if (!e) return;
    // escala inteira que cabe na largura do palco e deixa a tela inteira sem rolar (em paisagem, só a cena ao lado)
    // na grade da interface (etapa 1b da direção de arte): 1 pixel de arte = gradeS pixels do aparelho, como o resto da
    // tela; os cavalos 1:1 (antes a 1,5×)
    var s = setupCanvasGrade(cv, CENA_W, CENA_H);
    var k = s.k, ctx = s.ctx, c = CENA_CORES[e.gymId] || CENA_CORES.fogo;
    var visB = opcoesVisuais(e.b, null), visA = opcoesVisuais(e.a, null), img = null;
    function px(x, y, w, h, cor) { ctx.fillStyle = cor; ctx.fillRect(x * k, y * k, w * k, h * k); }
    function palco(cx, cy, rx, ry) {
      for (var y = -ry; y <= ry; y++) { var w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry))); px(cx - w, cy + y, 2 * w, 1, y < 0 ? c.palco : c.palco2); }
    }
    function fundo() {
      var x, y, P = CENA_PISO;
      px(0, 0, CENA_W, P, c.parede);
      if (e.gymId === 'grama') {
        for (x = 0; x < CENA_W; x += 6) px(x, 0, 1, P, c.junta);
        for (x = 3; x < CENA_W; x += 23) { var comp = 6 + (x * 7) % 9; px(x, 0, 1, comp, c.cipo); px(x + 1, comp - 2, 1, 2, c.cipo); }
      } else {
        var alto = e.gymId === 'agua' ? 6 : 4, largo = e.gymId === 'agua' ? 12 : 8;
        for (y = 0; y < P; y += alto) { px(0, y, CENA_W, 1, c.junta); for (x = (y / alto) % 2 ? 0 : largo / 2; x < CENA_W; x += largo) px(x, y, 1, alto, c.junta); }
      }
      if (e.gymId === 'agua') { px(0, P - 4, CENA_W, 4, c.agua); for (x = 0; x < CENA_W; x += 8) px(x, P - 4, 3, 1, c.espuma); }
      [6, CENA_W - 9].forEach(function (tx) { px(tx, 8, 3, 6, c.suporte); px(tx, 4, 3, 4, c.luz); px(tx + 1, 2, 1, 3, c.luz2); px(tx, 14, 3, 1, c.borda); });
      px(0, P, CENA_W, CENA_H - P, c.piso);
      for (y = P + 3; y < CENA_H; y += 4) px(0, y, CENA_W, 1, c.risco);
      px(0, P, CENA_W, 1, c.borda);
      palco(104, 64, 52, 5);
      palco(38, 106, 36, 5);
    }
    // o cavalo 1:1 com o corpo centrado em cx e os cascos em base (pixels de arte); espelhado em volta de cx
    function cavalo(h, vis, cx, base, t, espelha) {
      vis.reduzido = reduced();
      var o = comVisuais({ palette: h.palette, element: h.element, idle: true, t: t, scale: k, jockey: false, silks: PLAYER_SILKS,
        quadro: { topo: -1e6, base: base * k, grade: k, centro: cx * k } }, vis);
      if (!espelha) { SP.drawHorse(ctx, (cx - 20) * k, (base - 36) * k, o); return; }
      ctx.save(); ctx.translate(2 * cx * k, 0); ctx.scale(-1, 1);
      SP.drawHorse(ctx, (cx - 20) * k, (base - 36) * k, o);
      ctx.restore();
    }
    var item = {
      drawn: false,
      draw: function (t) {
        if (item.drawn && reduced()) return;
        item.drawn = true;
        item.t = t;
        var tt = reduced() ? 0.5 : t;
        ctx.clearRect(0, 0, cv.width, cv.height);
        fundo();
        cavalo(e.b, visB, 102, 64, tt + 0.9, true);   // o cavalo do oponente, virado para a esquerda
        img = img || treinadorImg(ginTreinadorId(e.dono));
        if (img) ctx.drawImage(img, 96 * k, 0, 64 * k, 64 * k);
        cavalo(e.a, visA, 38, 106, tt, false);
      }
    };
    item.draw(0);
    vivo(item, cv);
    cenaItems.push(item);
  }
  // a tela de desafio do duelo k (go() só chega aqui com o desafio pago e o duelo k gravado)
  function renderDesafio() {
    var v = ui.gym.ver, R = ui.gym.res, g = GD.GYMS[R.gymId], e = g.etapas[R.etapa], d = R.duelos[v.k];
    var t = ginDueloTxt(R, v.k);
    return '<section class="tela tela--desafio" aria-labelledby="t-desafio">' +
      '<header class="tela-cabeca placa"><span class="rotulo">' + esc(g.name + ' · ' + (R.revanche ? 'Revanche' : ginEtapaRotulo(e, R.etapa)) + ' · Duelo ' + (v.k + 1)) + '</span>' +
        '<h1 class="titulo titulo--tela" id="t-desafio" tabindex="-1" data-foco>' + esc(v.k === 0 ? e.nome + ' desafia você!' : e.nome + ' entra com ' + R.adversario[d.b] + '!') + '</h1></header>' +
      ginCenaHtml(R, v.k) +
      '<p class="gin-cena-vant">' + esc(t.linha) + '</p>' +
      '<div class="acoes acoes--linha">' +
        '<button type="button" class="btn btn--ouro" data-acao="ginasio-comecar">Começar duelo</button>' +
        '<button type="button" class="btn" data-acao="ginasio-pular-tudo">Pular tudo</button></div>' +
      '</section>';
  }
  // a tela de desafio do duelo k (depois de pagar, k = 0; depois do cartão, o duelo seguinte)
  function ginDesafio(k) {
    ui.gym.ver = { k: k, tela: 'desafio', L: null, cab: null };
    go('desafio');   // o foco no título
  }
  // o duelo k na tela de corrida; se a corrida refeita não bate com o gravado, direto ao que vem depois dele
  function ginAssiste(k) {
    ui.gym.ver = ginDueloVer(ui.gym.res, k);
    if (ui.gym.ver.L) go('corrida'); else ginDueloAcabou();
  }
  // há um cartão a mostrar: um desafio assistido e um duelo depois do atual
  function ginTemCartao() { return !!(ui.gym && ui.gym.ver && ui.gym.res && ui.gym.res.duelos[ui.gym.ver.k + 1]); }
  // o duelo acabou (ou foi pulado): o cartão, se há outro duelo; senão o resumo
  function ginDueloAcabou() {
    var gym = ui.gym, v = gym && gym.ver;
    if (!v || !gym.res) return;
    if (!gym.res.duelos[v.k + 1]) { ginPulaTudo(); return; }
    v.tela = 'cartao'; v.L = null; v.cab = null;
    go('entreduelos');   // o foco no título do cartão
    motivoVivo(ginCartaoTxt(gym.res, v.k).titulo);
  }
  // "Pular tudo" (e o "Voltar" do aparelho num duelo ou num cartão, Ruling 23): o resumo
  function ginPulaTudo() {
    var gym = ui.gym;
    if (!gym || !gym.res) return;
    gym.ver = null;
    go('ginasio');   // o resumo, com o foco no título dele
    motivoVivo(gym.res.venceu ? 'Vitória!' : 'Derrota');
  }

  // "Recomeçar com outro inicial" com confirmação (vai para o Perfil): apaga o save e volta à escolha do inicial. No modo
  // DEV faz o mesmo com o perfil de teste (desde 2026-11-18; antes voltava direto à Brasa, que segue no "Zerar" da gaveta).
  function resetHtml() {
    return ui.confirmReset
      ? '<div class="confirma" role="group" aria-label="Confirmar recomeço"><span>' +
          (DEV_MODE ? 'Apagar o perfil de teste e escolher outro inicial? (O save do jogo real não é tocado.)' : 'Apagar o progresso e escolher outro inicial?') + '</span>' +
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
    if (P.price != null && !podeGastar(P.price)) out.push(state.gold >= P.price ? reservaTxt() : 'Ouro insuficiente');
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
      portraitHtml(h, { selo: true, tamanho: 'pequeno' }) +
      '<b class="haras-nome">' + esc(h.name) + '</b>' +
      '<span class="linha-meta">' + rarityHtml(h.rarity) + estrelasHtml(h.grau) + '</span>' +
      '<span class="linha-meta">' + elementHtml(h.element) + '</span>' +
      '<span class="linha-meta"><span>' + sexoHtml(h.sex) + '</span>' + extra + '</span>' +
    '</button>';
  }

  function calcHtml(P) {
    var o = BRD.odds(P.f, P.m);
    var bars = BRD.RARITY_IDS.map(function (id) {
      var p = o.rarity[id] || 0, pct = Math.round(p * 100);
      if (p <= 0 && id !== 'mitico') return '';
      var label = GD.RARITIES[id].name + ' ' + (p > 0 && pct === 0 ? '<1' : pct) + '%' + (p <= 0 ? ' (Mítico não nasce de cruzamento)' : '');
      return '<div class="calc-linha"><span>' + esc(label) + '</span>' +
        '<span class="calc-barra calc-barra--' + esc(id) + '"><i style="width:' + (p * 100).toFixed(1) + '%"></i></span></div>';
    }).join('');
    var gp = pctRound([o.grau[1] * 100, o.grau[2] * 100, o.grau[3] * 100]);
    // estrelas do potro com o mesmo selo das fichas (HTML pronto: o texto passa por esc)
    var grau = esc('Estrelas (multiplicam os pontos livres do treino). Se mantiver a raridade: ') +
      estrelasHtml(1) + ' ' + gp[0] + '% · ' + estrelasHtml(2) + ' ' + gp[1] + '% · ' + estrelasHtml(3) + ' ' + gp[2] +
      '%; ' + esc('se subir, nasce com ') + estrelasHtml(1) + esc('; se descer, com ') + estrelasHtml(3);
    var genTxt = 'Genética: metade herdada. Cada status tem ' + Math.round(BRD.TUNING.potInherit * 100) +
      '% de chance de vir de um dos pais (meio a meio entre os dois); senão, nasce sorteada de 0 a 31.';
    var elName = function (e) { return elementOf(e).name; };
    var els = P.f.element === P.m.element ? [P.f.element] : [P.f.element, P.m.element];
    var elTxt = 'Elemento: ' + (els.length === 1 ? elName(els[0]) : elName(els[0]) + ' ou ' + elName(els[1]) + ' (50/50)');
    // porte do potro (parte 2b): o de um dos pais (na ordem de GameData.PORTES.valores) ou, com a mutação, qualquer um
    var pf = BRD.porteDe(P.f.porte, P.f.templateId, P.f.uid || P.f.id), pm = BRD.porteDe(P.m.porte, P.m.templateId, P.m.uid || P.m.id);
    var porteTxt = 'Porte do potro: ' + GD.PORTES.valores.filter(function (p) { return p === pf || p === pm; })
      .map(function (p) { return GD.PORTES.nomes[p]; }).join(' ou ') +
      ' (' + Math.round(GD.PORTES.mutacao * 100) + '% de chance de mutação)';
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
    var corcel = !nc ? '' : '<p class="corcel">' + corcelHtml() + esc(cands.length
      ? ': herança garantida de até ' + nTxt + ' dos pais (limitado às vagas da raridade do potro)'
      : ', mas nenhuma skill herdável') + '</p>';
    var custoNome = ui.haras.mode === 'troca' ? 'Troca' : (P.kind === 'rent' ? 'Aluguel' : 'Registro');
    return '<section class="caixa calc" aria-labelledby="t-calc"><h2 class="titulo" id="t-calc">Calculadora</h2>' +
      '<p class="nota">' + esc(P.f.name) + ' (' + sexoHtml('f') + ') × ' + esc(P.m.name) + ' (' + sexoHtml('m') + ')</p>' +
      '<p class="nota marcas-linha">' + esc(P.f.name + ' · ' + porteTexto(P.f) + ' · ' + marcasTexto(P.f)) + '</p>' +
      '<p class="nota marcas-linha">' + esc(P.m.name + ' · ' + porteTexto(P.m) + ' · ' + marcasTexto(P.m)) + '</p>' +
      '<div class="calc-barras">' + bars + '</div>' +
      '<p>' + grau + '</p>' +
      '<p>' + esc(genTxt) + '</p>' +
      '<p>' + esc(elTxt) + '</p>' +
      '<p>' + esc(porteTxt) + '</p>' +
      '<p>' + esc(skTxt) + '</p>' + corcel +
      '<p>' + esc('Nível efetivo: ' + Math.round(o.L * 100) + '% do máximo') + '</p>' +
      '<p class="calc-custo">' + esc(custoNome) + ': ' + ouroHtml(P.price) + '</p>' +
    '</section>';
  }

  function harasResultHtml(foal) {
    var isActive = foal.uid === state.activeId;
    return '<section class="caixa" aria-labelledby="t-nasceu"><h2 class="titulo" id="t-nasceu">' + esc('Nasceu ' + foal.name + '!') + '</h2>' +
      mountCardHtml(foal, isActive) +
      '<div class="acoes">' +
        '<button type="button" class="btn btn--ouro" data-acao="haras-ativar"' + (isActive || state.pending ? ' disabled' : '') + '>Tornar ativa</button>' +
        '<button type="button" class="btn" data-acao="haras-denovo">Cruzar de novo</button>' +
      '</div></section>';
  }

  function renderHaras() {
    var H = harasNormalize();
    var head = '<h1 class="titulo titulo--tela" id="t-haras" tabindex="-1" data-foco>Haras</h1>' + noticeHtml();
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
    foal.alloc = zeroAlloc();       // e sem pontos distribuídos (nasce no nível 1: nenhum ponto livre)
    foal.respecFree = true;         // com a primeira redistribuição grátis, como todo cavalo (bloco 1b §9)
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
  // Os mods de UMA peça, pelo mesmo cálculo da simulação (Gear.resolve: main + plus × plusStep no principal);
  // a tela nunca refaz a conta. Peça sozinha não forma conjunto, então só entram principal e secundário.
  function pieceMods(id, plus) {
    var equip = {};
    equip[GR.piece(id).slot] = 'x';
    return GR.resolve({ equip: equip }, { x: { uid: 'x', id: id, plus: plus } }).mods;
  }
  // valor de status para a tela: inteiro sem casa ("8"), meio ponto com uma casa e vírgula ("4,5")
  function statNum(v) {
    var r = Math.round(v * 10) / 10;
    return r === Math.floor(r) ? String(r) : String(r).replace('.', ',');
  }
  function pieceModsText(item) {
    var def = GR.piece(item.id), info = GD.GEAR_SLOT_INFO[def.slot], mods = pieceMods(item.id, item.plus);
    var t = '+' + statNum(mods[info.main]) + ' ' + GD.STATS[info.main].short;
    if (def.sub) t += ', +' + statNum(mods[info.sub]) + ' ' + GD.STATS[info.sub].short;
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
      var limite = lock.ok ? '' : ' disabled title="' + esc('Páreo aberto: passaria do Poder ' + lock.limit) + '"';
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
    if (P && m.uid === state.activeId) avisos += '<p class="aviso">' + esc('Páreo aberto: o Poder não pode passar de ' + P.pr) + '</p>';

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
          '<span class="slot-nome">' + iconeHtml('slot-' + slot, '') + esc(info.name) + '</span>' +
          '<span class="slot-peca">' + esc(cur ? pieceLabel(cur) : 'vazio') + '</span></button>' + lista + '</div>';
    }).join('');

    return avisos +
      '<section class="caixa" aria-labelledby="t-pecas"><h2 class="titulo" id="t-pecas">Peças</h2>' +
        setLineHtml(gear) +
        '<p class="nota">Toque num slot para ver as peças do inventário. Melhorar gasta Pedras Negras; vender devolve 25% do preço.</p>' +
        '<div class="slot-linhas">' + linhas + '</div></section>';
  }

  // ===========================================================================
  // Tela da Montaria (sub-tela): cabeça com o retrato grande e sub-abas Status / Skills / (Equipamento) / Ficha
  // ===========================================================================
  // a sub-aba Equipamento some com o equipamento suspenso (GEAR_ON); o handler 'montaria-aba' só abre as desta lista
  var MONTARIA_ABAS = [{ id: 'status', rotulo: 'Status' }, { id: 'skills', rotulo: 'Skills' }, { id: 'equip', rotulo: 'Equipamento' },
    { id: 'ficha', rotulo: 'Ficha' }]
    .filter(function (a) { return GEAR_ON || a.id !== 'equip'; });
  function montariaAbaValida(id) { return MONTARIA_ABAS.some(function (a) { return a.id === id; }); }

  // ---- Aba Status: comprar pontos (spec v3 §10 e spec 1b §11) ----
  // Cada status tem os botões +1, +5 e +10 (a Sorte não: é de nascimento) e "Distribuir sugerido" põe no rascunho a
  // build dos bots. O rascunho (ui.montaria.rascunho: pontos a somar por status, ou null) fica só na memória da tela:
  // sair da tela ou trocar de sub-aba o descarta. Somado ao que já foi comprado, ele nunca passa do que
  // RaceSim.validAlloc aceita (custo por faixa dentro dos pontos, teto de 150 e Sorte sem pontos). "Confirmar" pede
  // um segundo toque e grava como um gasto (gravaGasto: se a gravação falha, nada muda). Com páreo aberto, o Poder
  // da ativa não passa do da sala (state.pending.pr): os +N que passariam ficam desabilitados e, se o sugerido
  // passar, o Confirmar fica bloqueado (RF3); as outras montarias ficam livres.
  function rascunhoMais(r, k) {
    var out = {};
    STAT_KEYS.forEach(function (j) { out[j] = (r ? r[j] : 0) + (j === k ? 1 : 0); });
    return out;
  }
  function rascunhoSoma(r) {
    var t = 0;
    if (r) STAT_KEYS.forEach(function (k) { t += r[k]; });
    return t;
  }
  // o rascunho cabe nos pontos da montaria? Inteiros ≥ 0 e, somado ao que já foi comprado, um alloc que
  // RaceSim.validAlloc aceita sem cortar nada (custo por faixa dentro dos pontos, base + pontos ≤ 150, Sorte 0).
  function rascunhoOk(m, r) {
    if (!r) return true;
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var v = r[STAT_KEYS[i]];
      if (!(typeof v === 'number' && v >= 0 && v === Math.floor(v))) return false;
    }
    var a = allocComRascunho(m, r), va = RS.validAlloc(m, a);
    return STAT_KEYS.every(function (k) { return va[k] === a[k]; });
  }
  // custo de um alloc (soma de RaceSim.costOf: o ponto fica mais caro a cada TUNING.costStep no mesmo status)
  function custoAlloc(a) {
    var c = 0;
    STAT_KEYS.forEach(function (k) { c += RS.costOf(a[k] || 0); });
    return c;
  }
  // os pontos gravados com o rascunho por cima
  function allocComRascunho(m, r) {
    var a = RS.validAlloc(m, m.alloc), out = {};
    STAT_KEYS.forEach(function (k) { out[k] = a[k] + (r ? r[k] : 0); });
    return out;
  }
  // O selo "+N" do Estábulo: os pontos que sobram, o mesmo número do topo da aba Status ("sobram N"), enquanto algum
  // ponto ainda cabe (RaceSim.allocInfo().room, que já respeita o teto de 150 e a Sorte sem pontos). Quando o que sobra
  // não paga o próximo ponto de nenhum status, dá 0 e o selo some.
  function pontosQueCabem(m) {
    var i = RS.allocInfo(m);
    return algumPontoCabe(i) ? i.left : 0;
  }
  // algum status ainda aceita um ponto? (info: RaceSim.allocInfo dos pontos gravados). Sem isso e sem rascunho, a aba
  // Status esconde os +N e o "Distribuir sugerido"
  function algumPontoCabe(info) {
    return STAT_KEYS.some(function (k) { return info.room[k] > 0; });
  }
  function travaPontos(m, alloc) {
    var P = state.pending;
    if (!P || m.uid !== state.activeId) return { ok: true, limit: null };
    var h = clone(m);
    h.alloc = alloc;
    return { ok: RS.powerRating(h) <= P.pr, limit: P.pr };
  }

  // ---- Redistribuir (bloco 1b §9): devolve todos os pontos comprados (o alloc volta a zero) ----
  // A primeira de cada cavalo é grátis (mount.respecFree, que nasce true e vira false ao usar); as seguintes gastam
  // 1 Rédea nova (state.redeas; vem no 7º dia da recompensa diária, nunca por Ouro). Com páreo aberto, a montaria
  // ativa não redistribui (o retrato dos pontos da sala já foi tirado); as outras podem. Dois toques no mesmo botão,
  // como o Confirmar dos pontos, e grava como um gasto (gravaGasto: se a gravação falha, nada muda).
  // Devolve { ok, motivo, custo: 'gratis' | 'redea' } (motivo: o texto do botão indisponível (aria-disabled); '' quando ok).
  function temPontos(m) {
    var a = RS.validAlloc(m, m.alloc);
    return STAT_KEYS.some(function (k) { return a[k] > 0; });
  }
  function podeRedistribuir(m) {
    var custo = m.respecFree === true ? 'gratis' : 'redea';
    var P = state.pending;
    if (!temPontos(m)) return { ok: false, motivo: 'Nenhum ponto distribuído para devolver.', custo: custo };
    if (P && m.uid === state.activeId) return { ok: false, motivo: 'Páreo aberto: a montaria ativa só redistribui depois de correr.', custo: custo };
    if (custo === 'redea' && !(state.redeas >= 1)) return { ok: false, motivo: 'A redistribuição grátis deste cavalo já foi usada, e você não tem Rédea nova.', custo: custo };
    return { ok: true, motivo: '', custo: custo };
  }
  // o que a redistribuição vai gastar (o texto do segundo toque)
  function custoRedistribuirTxt(pode) {
    return pode.custo === 'gratis' ? 'Grátis: a primeira deste cavalo'
      : 'Usa 1 Rédea nova; você tem ' + state.redeas;
  }
  // bloco do botão (só quando o cavalo tem pontos comprados), embaixo e separado dos botões de compra. itens: os botões de
  // Torrão e Estrela (itensStatusHtml), que entram no mesmo bloco, acima do Redistribuir; sem pontos comprados, ficam sozinhos
  function redistribuirHtml(m, itens) {
    if (!temPontos(m)) return itens || '';
    var M = ui.montaria, pode = podeRedistribuir(m);
    if (!pode.ok) M.confirmaRedist = false;
    var conf = M.confirmaRedist && pode.ok
      ? '<p class="aviso" role="status">' + esc(custoRedistribuirTxt(pode) + '. Todos os pontos voltam para distribuir. Toque em Redistribuir pontos de novo para confirmar.') + '</p>' : '';
    return '<div class="redistribuir">' + (itens || '') + conf +
      '<div class="acoes"><button type="button" class="btn btn--pequeno" data-acao="redistribuir"' +
        indisponivel(pode.ok ? '' : pode.motivo) + '>Redistribuir pontos</button>' + ajudaBtn('redea', 'a Rédea nova') + '</div>' +
      (pode.ok ? '' : '<p class="nota">' + esc(pode.motivo) + '</p>') + '</div>';
  }
  function notaGenetica(g) { return g >= 24 ? 'S' : g >= 16 ? 'A' : g >= 8 ? 'B' : 'C'; }
  function pontosTxt(n) { return n + (n === 1 ? ' ponto' : ' pontos'); }
  // os botões de compra de cada status (spec 1b §11): cada um soma exatamente N pontos ao rascunho
  var BUILD_PASSOS = [1, 5, 10];
  function rascunhoMaisN(r, k, n) {
    var out = {};
    STAT_KEYS.forEach(function (j) { out[j] = (r ? r[j] : 0) + (j === k ? n : 0); });
    return out;
  }
  // o botão "+N" de um status: o custo de N vai no title e no aria-label ("+5 em Velocidade: custa 15 pontos").
  // Indisponível (aria-disabled, o foco fica nele) quando N não cabe, com o motivo no title, nesta ordem: passaria de 150, faltam pontos, trava do
  // páreo (com páreo aberto, o Poder da ativa não passa do da sala). livres: o que sobra com o rascunho.
  function botaoMaisInfo(m, r, k, n, livres) {
    var st = GD.STATS[k], atual = allocComRascunho(m, r)[k];
    var custo = RS.costOf(atual + n) - RS.costOf(atual);
    var txt = '+' + n + ' em ' + st.name + ': custa ' + pontosTxt(custo);
    var motivo = '';
    if (atual + n > RS.maxBuy(m, k)) motivo = 'Passaria de ' + RS.TUNING.statMax + '.';
    else if (custo > livres) motivo = 'Faltam pontos: ' + (livres === 1 ? 'sobra 1.' : 'sobram ' + livres + '.');
    else if (!rascunhoOk(m, rascunhoMaisN(r, k, n))) motivo = 'Não cabe nos pontos desta montaria.';
    else {
      var lock = travaPontos(m, allocComRascunho(m, rascunhoMaisN(r, k, n)));
      if (!lock.ok) motivo = 'Páreo aberto: passaria do Poder ' + lock.limit + ' que a sala viu.';
    }
    return { ok: !motivo, titulo: txt + (motivo ? '. ' + motivo : '') };
  }
  // "Distribuir sugerido" (spec 1b §6 e §11): a build dos bots (RaceSim.botAlloc) continuando dos pontos já
  // comprados mais o rascunho; devolve o rascunho novo (o que passa dos pontos gravados). Não olha a trava do páreo:
  // o rascunho pode passar do Poder da sala, e aí é o Confirmar que fica bloqueado (RF3).
  function rascunhoSugerido(m, r) {
    var gravado = RS.validAlloc(m, m.alloc), b = RS.botAlloc(m, allocComRascunho(m, r)), out = {};
    STAT_KEYS.forEach(function (k) { out[k] = b[k] - gravado[k]; });
    return out;
  }
  // Aba Status (3b §6): uma linha por status. Na linha: o nome (ícone e sigla; é o próprio botão de ajuda), a nota de
  // genética, o valor (com o rascunho) e, embaixo dele, o "+N" do rascunho e o custo do próximo ponto ("·2", com a frase
  // inteira para o leitor de tela); à direita, +1, +5 e +10; embaixo de tudo, a barra fina em segmentos. A Sorte não
  // tem botões: "de nascimento". Com rascunho, Desfazer e Confirmar ficam na barra presa embaixo (.barra-acao, sticky),
  // com o Poder de antes e de depois, o pedido de confirmação e o motivo do Confirmar travado; sem rascunho, ela não existe.
  function montariaStatusHtml(m) {
    var M = ui.montaria;
    if (M.rascunho && (!rascunhoSoma(M.rascunho) || !rascunhoOk(m, M.rascunho))) { M.rascunho = null; M.confirmaPontos = false; }
    var r = M.rascunho, soma = rascunhoSoma(r);
    var info = RS.allocInfo(m), comR = allocComRascunho(m, r), livres = info.free - custoAlloc(comR);
    var cap = RS.TUNING.statMax, nb = RS.TUNING.noBuy || [];
    var h = clone(m);
    h.alloc = comR;
    var stats = RS.computeStats(h), antes = RS.computeStats(m);
    var P = state.pending, trava = P && m.uid === state.activeId;
    // sem rascunho e sem nenhum ponto que caiba (nível 1, ou o que sobra não paga ponto nenhum), os +N e o "Distribuir
    // sugerido" não aparecem; com algum ponto cabendo, os que não cabem ficam desabilitados com o motivo (spec 1b §11)
    var compra = !!soma || algumPontoCabe(info);
    var linhas = STAT_KEYS.map(function (k) {
      var st = GD.STATS[k], g = m.potential[k], nota = notaGenetica(g);
      var v = stats[k], rk = r ? r[k] : 0, d = v - antes[k];
      var delta = d > 0 ? '<span class="delta mais" aria-hidden="true">+' + d + '</span>' : '';
      var fixo = nb.indexOf(k) >= 0, custo, botoes = '';
      if (fixo) {
        custo = '<span class="build-custo">de nascimento</span>';   // a Sorte não recebe pontos (TUNING.noBuy): sem custo nem botões
      } else {
        // à vista, curto ("·2", ou "teto" no teto); o leitor de tela ouve a frase inteira, com espaço sem quebra antes do número
        var noTeto = comR[k] >= RS.maxBuy(m, k), pc = RS.pointCost(comR[k]);
        custo = '<span class="build-custo"><span aria-hidden="true">' + (noTeto ? 'teto' : '\u00b7' + pc) + '</span>' +
          '<span class="sr">' + esc(noTeto ? 'no teto de\u00a0' + cap : 'próximo ponto custa\u00a0' + pc) + '</span></span>';
        if (compra) botoes = BUILD_PASSOS.map(function (n) {
          var bi = botaoMaisInfo(m, r, k, n, livres);
          return '<button type="button" class="btn btn--pequeno build-mais" data-acao="ponto-mais" data-id="' + k + '" data-n="' + n + '"' +
            ' aria-label="' + esc(bi.titulo) + '"' + (bi.ok ? ' title="' + esc(bi.titulo) + '"' : indisponivel(bi.titulo)) + '>+' + n + '</button>';
        }).join('');
      }
      return '<li class="build-linha' + (fixo ? ' build-linha--fixa' : '') + '" data-status="' + k + '">' +
        ajudaBtn(k, st.name, statIcon(k) + '<span class="build-sigla">' + esc(st.short) + '</span>', 'build-nome') +
        '<span class="nota-genetica nota-genetica--' + nota.toLowerCase() + '" title="' + esc('Genética ' + g + ' de 31') + '" aria-label="' + esc('Genética ' + nota + ' (' + g + ' de 31)') + '">' + nota + '</span>' +
        '<span class="build-valor"><span class="valor' + (rk ? ' valor--rascunho' : '') + '">' + v + (rk ? '<span class="sr"> (+' + rk + ' no rascunho)</span>' : '') + '</span>' +
          (fixo ? '' : '<span class="build-sub">' + delta + custo + '</span>') + '</span>' +
        (fixo ? custo : '') +
        (botoes ? '<span class="build-acao" role="group" aria-label="' + esc('Comprar pontos em ' + st.name) + '">' + botoes + '</span>' : '') +
        '<div class="barra barra--seg build-barra" role="img" aria-label="' + esc(st.name + ' ' + v + ' de ' + cap) + '">' + barHtml(v, antes[k]) + '</div></li>';
    }).join('');
    // com páreo aberto, um rascunho acima do Poder da sala bloqueia o Confirmar (RF3); o motivo vai junto das ações
    var lockR = soma ? travaPontos(m, comR) : { ok: true };
    var motivoConf = lockR.ok ? '' : 'Páreo aberto: com este rascunho o Poder iria a ' + RS.powerRating(h) + ', e a sala viu ' + lockR.limit + '. Use Desfazer ou corra antes de confirmar.';
    if (!lockR.ok) M.confirmaPontos = false;
    var avisos = '';
    if (M.pontosMsg) avisos += '<p class="aviso" role="status">' + esc(M.pontosMsg) + '</p>';
    var algumMais = STAT_KEYS.some(function (k) { return rascunhoOk(m, rascunhoMais(r, k)); });
    if (livres > 0 && !algumMais) avisos += '<p class="nota">' + esc((livres === 1 ? 'Sobra 1 ponto' : 'Sobram ' + livres + ' pontos') + ': não pagam o próximo ponto de nenhum status.') + '</p>';
    // o aviso geral do páreo não se repete quando o motivo do Confirmar bloqueado já está na tela
    if (trava && info.left > 0 && !motivoConf) avisos += '<p class="aviso">' + esc('Páreo aberto: os pontos da montaria ativa não podem passar o Poder de ' + P.pr + ' que a sala viu.') + '</p>';
    // topo numa linha (quebra se precisar): os pontos que sobram e o ⓘ do custo; "Genética" e o ⓘ da nota. O Poder de antes
    // e de depois do rascunho fica na barra presa, junto do Confirmar (aqui ele empurraria a lista no 1º toque de um +N)
    var topo = '<div class="build-topo"><p class="pontos-livres">Pontos: <b>' + esc('sobram ' + livres + ' de ' + info.free) + '</b>' + ajudaBtn('custo', 'o custo dos pontos') + '</p>' +
      '<span class="nota">Genética' + ajudaBtn('genetica', 'a nota de genética') + '</span>' +
      (info.free ? '' : '<span class="nota">Cada nível ganho dá pontos para distribuir.</span>') + '</div>';
    // "Distribuir sugerido" no fim da lista (com algum ponto cabendo ou com rascunho)
    var acoes = '';
    if (compra) {
      var sug = rascunhoSoma(rascunhoSugerido(m, r)) > soma;
      acoes = '<div class="acoes build-acoes"><button type="button" class="btn btn--pequeno" data-acao="pontos-sugerir"' +
        indisponivel(sug ? '' : livres > 0 ? 'Os pontos que sobram não pagam o próximo ponto de nenhum status.' : 'Nenhum ponto sobrando para distribuir.') + '>Distribuir sugerido</button></div>';
    }
    // a barra presa (só com rascunho): o pedido de confirmação e o motivo do Confirmar travado, o Poder e os dois botões.
    // É o último bloco da aba: rolando até o fim, ela fica no lugar dela, embaixo do Redistribuir, sem cobrir nada
    var barra = '';
    if (soma) {
      var depois = 'Para mudar depois, use Redistribuir ' + (m.respecFree === true ? '(a primeira deste cavalo é grátis).' : '(gasta uma Rédea nova).');
      barra = '<div class="barra-acao barra-acao--pontos">' +
        (M.confirmaPontos ? '<p class="aviso" role="status">' + esc(depois + ' Toque em Confirmar de novo para gravar.') + '</p>' : '') +
        (motivoConf ? '<p class="aviso" role="status">' + esc(motivoConf) + '</p>' : '') +
        '<div class="barra-pontos"><p class="barra-poder">Poder <b>' + RS.powerRating(m) + '</b> → <b class="barra-poder-novo">' + RS.powerRating(h) + '</b></p>' +
          '<div class="barra-botoes"><button type="button" class="btn btn--pequeno" data-acao="pontos-desfazer">Desfazer</button>' +
          '<button type="button" class="btn btn--pequeno btn--ouro" data-acao="pontos-confirmar"' + indisponivel(motivoConf) + '>Confirmar</button></div></div></div>';
    }
    return avisos + '<section class="caixa" aria-label="Status">' + topo +
      '<ul class="build">' + linhas + '</ul>' + acoes + redistribuirHtml(m, itensStatusHtml(m)) +
      '<p class="nota build-rodape">' + esc('Nota de genética (C, B, A ou S): vem do nascimento. A barra vai até ' + cap + '. O custo do ponto sobe a cada ' + RS.TUNING.costStep + ' pontos no mesmo status.') + '</p>' +
      barra + '</section>';
  }

  // abre a Montaria numa sub-aba; o estado do equipamento (confirmação, Desfazer) começa zerado
  function goMontaria(uid, aba) {
    if (!state || !mountByUid(uid)) return;
    if (!montariaAbaValida(aba)) aba = 'status';   // a sub-aba Equipamento some com o equipamento suspenso
    ui.montaria = { uid: uid, aba: aba, renomear: null, equip: { slot: null, confirm: null, undo: null, msg: null },
      rascunho: null, confirmaPontos: false, pontosMsg: null,   // rascunho dos pontos livres (só na memória da tela)
      confirmaRedist: false };                                   // 1º toque do "Redistribuir pontos"
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

  // ---- Aba Ficha (3b §5): as ações da montaria e os dados que saíram da cabeça ----
  // Ações no contêiner .montaria-acoes (o MOTIVO_ONDE põe o motivo do toque logo depois dele): Tornar ativa só nas outras
  // (trava com páreo aberto), Renomear (o campo na própria tela) e Liberar (com a confirmação; trava na ativa, no único
  // cavalo e com páreo aberto). Os handlers conferem tudo de novo. Dados: sexo (e Corcel), porte, marcas, cruzas
  // restantes, chance de skill e, com m.parents, os pais pelo nome salvo, com "(fora do estábulo)" quando o uid é null ou
  // não está mais em state.mounts (o critério é o uid: nomes podem repetir).
  function fichaLinha(rotulo, valorHtml) {
    return '<li><span class="ficha-rotulo">' + esc(rotulo) + ':</span> <span class="ficha-valor">' + valorHtml + '</span></li>';
  }
  // "Porte: Robusto" (porteTexto) e "Marcas: ..." (marcasTexto) separados em rótulo e valor
  function fichaLinhaTexto(txt) {
    var i = txt.indexOf(': ');
    return fichaLinha(txt.slice(0, i), esc(txt.slice(i + 2)));
  }
  function paiHtml(p) {
    var fora = p.uid == null || !mountByUid(p.uid);
    return esc(p.name || 'sem nome') + (fora ? ' <span class="ficha-fora">(fora do estábulo)</span>' : '');
  }
  function montariaFichaHtml(m) {
    var M = ui.montaria, P = state.pending, uid = esc(m.uid), isActive = m.uid === state.activeId;
    var h = clone(m);
    // a corrida não usa mais o bônus de chance de skill do conjunto (o equipamento não entra: sim.js)
    var skillPct = Math.round(RS.skillChance(h, RS.computeStats(h), 0) * 100);
    var corcel = window.Breed && window.Breed.isCorcel(m)
      ? fichaLinha('Corcel', '<span class="corcel" title="Corcel: herança garantida">' + iconeHtml('ui-corcel', '⚑', 16) + ' herança garantida</span>') : '';
    // renomear: campo na própria tela (window.prompt não abre num iframe sem allow-modals, como o do artefato)
    var R = M.renomear;
    var acoes = R
      ? '<div class="renomear" role="group" aria-label="Renomear montaria">' +
          '<label class="rotulo" for="renomear-campo">Novo nome (2–16 letras)</label>' +
          '<input type="text" id="renomear-campo" class="campo" maxlength="16" autocomplete="off" enterkeyhint="done" value="' + esc(R.valor) + '">' +
          (R.erro ? '<p class="aviso" role="status">' + esc(R.erro) + '</p>' : '') +
          '<div class="montaria-acoes"><button type="button" class="btn btn--pequeno btn--ouro" data-acao="renomear-ok" data-id="' + uid + '">Salvar</button>' +
          '<button type="button" class="btn btn--pequeno" data-acao="renomear-nao" data-id="' + uid + '">Cancelar</button></div></div>'
      : ui.confirmLiberar === m.uid && !motivoLiberar(m)
      ? '<div class="confirma" role="group" aria-label="Confirmar liberação"><span>Liberar ' + esc(m.name) + '? Ela deixa o estábulo para sempre, sem Ouro de volta.</span>' +
        '<button type="button" class="btn btn--pequeno btn--perigo" data-acao="liberar-sim" data-id="' + uid + '">Sim, liberar</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="liberar-nao" data-id="' + uid + '">Cancelar</button></div>'
      : '<div class="montaria-acoes">' +
        (isActive ? '' : '<button type="button" class="btn btn--pequeno btn--ouro" data-acao="ativar" data-id="' + uid + '"' + indisponivel(motivoAtivar(P)) + '>Tornar ativa</button>') +
        '<button type="button" class="btn btn--pequeno" data-acao="renomear" data-id="' + uid + '">Renomear</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="liberar" data-id="' + uid + '"' + indisponivel(motivoLiberar(m)) + '>Liberar</button>' +
        '</div>';
    return '<section class="caixa montaria-ficha" aria-label="Ficha">' + acoes +
      '<ul class="ficha-dados">' +
        fichaLinha('Sexo', sexoHtml(m.sex)) + corcel +
        fichaLinhaTexto(porteTexto(m)) +
        fichaLinhaTexto(marcasTexto(m)) +
        fichaLinha('Cruzas restantes', esc(m.breedLeft)) +
        fichaLinha('Skills', '<b>' + skillPct + '%</b> de ativar') +
        (m.parents ? fichaLinha('Pais', paiHtml(m.parents.f) + ' e ' + paiHtml(m.parents.m)) : '') +
      '</ul></section>';
  }

  // Ficha da montaria (3b §5). Cabeça: o retrato grande na baia, de borda a borda do painel (escala PORTRAIT_SCALE_GRANDE,
  // a maior inteira que cabe na coluna a 360 px com a linha de abas ainda inteira acima da barra de abas do app), com os
  // selos do nível e do +N nos cantos; o nome na placa (h1, com o #N e o selo "Ativa"); raridade, estrelas e tipo; Poder
  // e liga; o XP. Abaixo, as sub-abas; ações e os outros dados ficam na aba Ficha.
  function renderMontaria() {
    var m = ui.montaria ? mountByUid(ui.montaria.uid) : null;
    if (!m) { ui.montaria = null; ui.item = null; ui.screen = ui.tab; syncHistory(ui.tab); return renderTab(ui.tab); } // montaria sumiu (liberada, outra aba): volta à aba
    var M = ui.montaria;
    var isActive = m.uid === state.activeId;
    var rating = RS.powerRating(clone(m));

    var cabeca = '<article class="caixa montaria-cabeca" aria-label="Montaria">' +
      '<div class="retrato-palco">' + portraitHtml(m, { tamanho: 'grande', selo: true, pontos: pontosQueCabem(m) }) + '</div>' +
      '<div class="cavalo-info">' +
        '<h1 class="titulo titulo--tela" id="t-montaria" tabindex="-1" data-foco><span class="montaria-nome">' + esc(m.name) + ' <small>#' + esc(uidNum(m.uid)) + '</small></span>' +
          (isActive ? ' <span class="badge-ativa">Ativa</span>' : '') + '</h1>' +   // o espaço: o leitor de tela lê "Brasa #1 Ativa"
        '<div class="linha-meta">' + rarityHtml(m.rarity) + ajudaBtn('raridade', 'a raridade') + estrelasHtml(m.grau) + ajudaBtn('estrelas', 'as estrelas') + elementHtml(m.element) + '</div>' +
        '<div class="linha-meta"><span>Poder <b>' + rating + '</b>' + ajudaBtn('poder', 'o Poder') + '</span>' + leagueHtml(rating) + ajudaBtn('liga', 'a liga') + '</div>' +
        xpHtml(m.level, m.xp, true) +
        (GEAR_ON ? gearSummaryHtml(m) : '') +
      '</div></article>';

    var subabas = '<div class="subabas" role="group" aria-label="Seções da montaria">' + MONTARIA_ABAS.map(function (a) {
      return '<button type="button" class="btn opcao opcao--centro" data-acao="montaria-aba" data-id="' + esc(a.id) + '" aria-pressed="' + (M.aba === a.id) + '">' + esc(a.rotulo) + '</button>';
    }).join('') + '</div>';

    var corpo;
    if (M.aba === 'skills') {
      var vagas = (GD.RARITIES[m.rarity] || GD.RARITIES.comum).skillSlots - m.skills.length;
      corpo = '<section class="caixa" aria-label="Skills">' + vagaTipoHtml(m) +
        (m.skills.length ? skillChanceHtml(m) + skillsVagasHtml(m) : '<p class="nota">Nenhuma skill de vaga ainda.</p>') +
        '<p class="nota">' + (vagas > 0
          ? vagas + (vagas === 1 ? ' vaga livre' : ' vagas livres') + ' · ' + Math.round(chanceSkillNivel() * 100) + '% de chance de aprender uma skill nova a cada nível'
          : 'Sem vagas livres') + '</p>' +
        (itemQtd('manual') > 0 ? itemUsoHtml('manual', m, [naMochilaTxt('manual'), Math.round(GD.ITEMS.manual.chance * 100) + '% de chance de aprender']) : '') +
        garraInfoHtml(m) + '</section>';
    } else if (M.aba === 'equip' && GEAR_ON) {
      corpo = montariaEquipHtml(m);
    } else if (M.aba === 'ficha') {
      corpo = montariaFichaHtml(m);
    } else {
      corpo = montariaStatusHtml(m);
    }
    // o uso de um item aberto pela ficha deste cavalo: o passo dele no lugar da sub-aba; o aviso do último uso, em cima dela
    if (ui.item && ui.item.origem === 'ficha' && ui.item.mountUid === m.uid) corpo = itemPassoHtml();
    else if (ui.itemMsg && ui.itemMsg.origem === 'ficha' && ui.itemMsg.uid === m.uid) corpo = '<p class="aviso" role="status">' + esc(ui.itemMsg.txt) + '</p>' + corpo;

    return '<section class="tela" aria-labelledby="t-montaria">' +
      '<button type="button" class="btn btn--pequeno" data-acao="montaria-voltar">Voltar</button>' +
      cabeca + subabas + corpo +
    '</section>';
  }

  // ===========================================================================
  // Loja de itens e mochila (spec 2026-11-16-itens-loja-diaria §5, §6, §8, §13): a aba Loja, sempre na barra, com
  // as partes Comprar (os itens à venda, um toque por compra, só com Ouro) e Mochila (os cinco itens, com a quantidade).
  // As regras (limites do dia, a Estrela a cada 7 dias, a mochila cheia, Ouro e Ouro reservado) são do Itens
  // (itens.js); aqui só se mostra e se grava. Com GEAR_ON, a parte Comprar também mostra as peças e as Pedras.
  // ===========================================================================
  var LOJA_PARTES = [{ id: 'comprar', rotulo: 'Comprar' }, { id: 'mochila', rotulo: 'Mochila' }];
  // o rótulo do botão de compra por motivo do Itens.podeComprar (motivo sem rótulo: LOJA_ROTULO_OUTRO, nunca "Comprar")
  var LOJA_ROTULO_OUTRO = 'Indisponível';
  var LOJA_ROTULO = { 'sem-ouro': 'Sem Ouro', reservado: 'Reservado', limite: 'Limite de hoje', cheia: 'Mochila cheia', 'nao-vende': 'Não está à venda' };
  // quantos o jogador tem do item (a Rédea nova fica em state.redeas; a mochila só a mostra)
  function itemQtd(id) {
    if (id === 'redea') return state.redeas;
    return state.mochila && hasOwn(state.mochila, id) ? state.mochila[id] : 0;
  }
  // a quantidade lida como "3 Torrões de açúcar" (spec §13): o plural vem do catálogo
  function itemQtdTxt(id, n) { return fmt(n) + ' ' + (n === 1 ? GD.ITEMS[id].name : GD.ITEMS[id].plural); }
  // o ícone do item (peça de pixel item-<id> do interface-arte.mjs, em background): decorativo, o nome vem ao lado
  function itemIconeHtml(id) {
    return hasOwn(GD.ITEMS, id) ? '<span class="item-icone item-icone--' + esc(id) + '" aria-hidden="true"></span>' : '';
  }
  // A linha de um item: ícone, nome, a quantidade e a linha de para que serve. Usada na loja, na mochila e na escolha
  // do uso. opções: { qtd: número (sem ele, não mostra a quantidade), forma: 'x' (×3, padrão) | 'tem' (tem 3), texto: a
  // linha de baixo (padrão: o para que serve do catálogo), apagada: true (a linha de quantidade 0), classe: classe a mais,
  // extra: html no fim da linha (preço, botões), aviso: texto de um aviso no fim da linha, nivel: 'h2' (padrão) | 'h3' }. O leitor de tela lê a quantidade como
  // "3 Torrões de açúcar" (o ×3 é aria-hidden).
  function itemLinhaHtml(id, o) {
    if (!hasOwn(GD.ITEMS, id)) return '';
    o = o || {};
    var it = GD.ITEMS[id], h = o.nivel === 'h3' ? 'h3' : 'h2', qtd = '';
    if (o.qtd != null) {
      var tem = o.forma === 'tem';
      qtd = '<span class="item-qtd"><span aria-hidden="true">' + (tem ? 'tem ' : '×') + fmt(o.qtd) + '</span>' +
        '<span class="sr">' + esc((tem ? 'Você tem ' : '') + itemQtdTxt(id, o.qtd)) + '</span></span>';
    }
    var aviso = o.aviso ? '<p class="aviso item-aviso">' + esc(o.aviso) + '</p>' : '';
    return '<article class="item-linha' + (o.classe ? ' ' + o.classe : '') + (o.apagada ? ' item-linha--vazia' : '') + '" data-item="' + esc(id) + '">' +
      itemIconeHtml(id) + '<' + h + ' class="item-nome">' + esc(it.name) + '</' + h + '>' + qtd +
      '<p class="item-desc">' + esc(o.texto != null ? o.texto : it.desc) + '</p>' + (o.extra || '') + aviso + '</article>';
  }
  // por que o item não pode ser comprado agora (p: o { ok: false, motivo, emDias } do Itens.podeComprar)
  function lojaMotivo(id, p) {
    var it = GD.ITEMS[id];
    switch (p.motivo) {
      case 'sem-ouro': return 'Faltam ' + fmt(it.price - state.gold) + ' de Ouro para comprar ' + it.name + '.';
      case 'reservado': return reservaTxt() + ': sobram ' + fmt(ouroLivre()) + ' para gastar.';
      case 'cheia': return 'A mochila já tem ' + itemQtdTxt(id, GD.BAG_MAX) + ', o máximo.';
      case 'limite':
        if (it.everyDays && p.emDias) return it.name + ' volta à venda em ' + p.emDias + (p.emDias === 1 ? ' dia.' : ' dias.');
        if (it.perDay) return 'Você já comprou ' + it.perDay + ' hoje, o limite do dia. Amanhã tem de novo.';
        return 'Limite de hoje.';
      default: return it.name + ' não está à venda.';
    }
  }
  // o limite do dia do produto, sem contar Ouro nem mochila ("Restam 1 de 2 hoje", Ruling 10; na Estrela, "disponível" ou "de novo em N dias")
  function lojaLimiteHtml(id, hoje) {
    var it = GD.ITEMS[id], l = IT.podeComprar(id, state.lojaItens, hoje, Infinity, Infinity, 0);
    if (it.everyDays) {
      var txt = l.ok ? 'disponível' : l.emDias ? 'de novo em ' + l.emDias + (l.emDias === 1 ? ' dia' : ' dias') : 'Limite de hoje';
      return '<span class="item-limite">' + esc(txt) + '</span>';
    }
    return '<span class="item-limite">' + esc('Restam ' + (l.ok ? l.restam : 0) + ' de ' + it.perDay + ' hoje') + '</span>';
  }
  function lojaProdutoHtml(id) {
    var it = GD.ITEMS[id], hoje = hojeDia(), tem = itemQtd(id);
    var p = IT.podeComprar(id, state.lojaItens, hoje, state.gold, ouroLivre(), tem);
    var botao = '<button type="button" class="btn btn--ouro btn--pequeno" data-acao="item-comprar" data-id="' + esc(id) + '"' +
      (p.ok ? '' : indisponivel(lojaMotivo(id, p))) + '>' + esc(p.ok ? 'Comprar' : hasOwn(LOJA_ROTULO, p.motivo) ? LOJA_ROTULO[p.motivo] : LOJA_ROTULO_OUTRO) + '<span class="sr"> ' + esc(it.name) + '</span></button>';
    return itemLinhaHtml(id, { qtd: tem, forma: 'tem', classe: 'item-linha--produto', aviso: ui.lojaMsg && ui.lojaMsg.id === id ? ui.lojaMsg.txt : null,
      extra: '<div class="item-compra"><span class="item-preco">' + ouroHtml(it.price) + lojaLimiteHtml(id, hoje) + '</span>' + botao + '</div>' });
  }
  function lojaComprarHtml() {
    // a Rédea nova não se vende: uma linha diz de onde ela vem, sem botão
    return '<section class="caixa item-lista" aria-label="Itens à venda">' + LOJA_ITENS.map(lojaProdutoHtml).join('') +
      itemLinhaHtml('redea', { qtd: itemQtd('redea'), forma: 'tem', classe: 'item-linha--fora', texto: GD.ITEMS.redea.origem }) + '</section>';
  }
  // os cinco, na ordem do catálogo; com 0, a linha apagada diz de onde o item vem (sem "Usar"); o aviso do último uso
  // pela Mochila fica na linha do item
  function lojaMochilaHtml() {
    var msg = ui.itemMsg && ui.itemMsg.origem === 'mochila' ? ui.itemMsg : null;
    return '<section class="caixa item-lista" aria-label="Mochila">' + Object.keys(GD.ITEMS).map(function (id) {
      var n = itemQtd(id);
      var usar = n > 0 ? '<div class="item-compra item-compra--usar"><button type="button" class="btn btn--pequeno" data-acao="item-usar" data-id="' + esc(id) + '">Usar' +
        '<span class="sr"> ' + esc(GD.ITEMS[id].name) + '</span></button></div>' : '';
      return itemLinhaHtml(id, { qtd: n, classe: 'item-linha--mochila', apagada: n === 0, texto: n === 0 ? GD.ITEMS[id].origem : null, extra: usar,
        aviso: msg && msg.id === id ? msg.txt : null });
    }).join('') + '</section>';
  }
  function renderLoja() {
    if (!LOJA_PARTES.some(function (a) { return a.id === ui.lojaParte; })) ui.lojaParte = 'comprar';
    var head = '<h1 class="titulo titulo--tela" id="t-loja" tabindex="-1" data-foco>Loja</h1>';
    var partes = '<div class="subabas" role="group" aria-label="Partes da loja">' + LOJA_PARTES.map(function (a) {
      return '<button type="button" class="btn opcao opcao--centro" data-acao="loja-parte" data-id="' + esc(a.id) + '" aria-pressed="' + (ui.lojaParte === a.id) + '">' + esc(a.rotulo) + '</button>';
    }).join('') + '</div>';
    // com o uso de um item aberto pela Mochila, o passo dele no lugar das partes
    if (ui.item && ui.item.origem === 'mochila') return '<section class="tela" aria-labelledby="t-loja">' + head + itemPassoHtml() + '</section>';
    var corpo = ui.lojaParte === 'mochila' ? lojaMochilaHtml() : reservaHtml() + lojaComprarHtml() + (GEAR_ON ? lojaEquipHtml() : '');
    return '<section class="tela" aria-labelledby="t-loja">' + head + partes + corpo + '</section>';
  }

  // ===========================================================================
  // Usar os itens (spec de itens §4, §5, §8): pela Mochila (a escolha do cavalo, no Cupom a da skill que sai, e a
  // confirmação) e pela ficha (Torrão e Estrela na aba Status; Manual e "Trocar" na aba Skills; direto à confirmação). As
  // regras são do Itens: aqui cada passo confere de novo com o estado atual, e usaItem grava o uso de uma vez. O resultado
  // do Cupom e do Manual só é sorteado no Confirmar (a confirmação diz o que o item faz e a chance, nunca o resultado). A
  // Rédea nova não passa por usaItem: ela só escolhe o cavalo e leva ao Redistribuir da ficha dele (o custo é o de sempre).
  // ===========================================================================
  var CAVALO_SAIU = 'Este cavalo não está mais no estábulo.';
  var SKILL_SAIU = 'Esta skill não está mais nas vagas deste cavalo.';
  // por que o item não pode ser usado neste cavalo agora ('' quando pode); m null: o cavalo saiu do save
  function motivoUso(id, m) {
    if (!m) return CAVALO_SAIU;
    if (id === 'redea') { var pr = podeRedistribuir(m); return pr.ok ? '' : pr.motivo; }
    var p = IT.podeUsar(id, m, { tem: itemQtd(id), ativaComSala: m.uid === state.activeId && !!state.pending });
    return p.ok ? '' : p.motivo;
  }
  // o Cupom precisa que a skill escolhida continue nas vagas (outra aba pode tê-la trocado)
  function motivoUsoSkill(id, m, skillId) {
    var mot = motivoUso(id, m);
    if (!mot && id === 'cupom' && (m.skills.indexOf(skillId) < 0 || !hasOwn(GD.SKILLS, skillId))) mot = SKILL_SAIU;
    return mot;
  }
  function skillNome(id) { return hasOwn(GD.SKILLS, id) ? GD.SKILLS[id].name : String(id); }
  function torroesTxt(m) { return 'Torrões usados: ' + RS.torroesOf(m) + ' de ' + GD.ITEMS.torrao.cap; }
  function naMochilaTxt(id) { return 'Na mochila: ' + fmt(itemQtd(id)); }
  // um botão de uso na ficha ("Usar Torrão de açúcar"), ao lado das linhas de informação (o que o jogador tem, ...) e,
  // quando não pode, com o motivo escrito embaixo
  function itemUsoHtml(id, m, infos) {
    var mot = motivoUso(id, m);
    return '<div class="item-uso"><button type="button" class="btn btn--pequeno" data-acao="item-usar" data-id="' + esc(id) + '" data-mount="' + esc(m.uid) + '"' +
      indisponivel(mot) + '>' + esc('Usar ' + GD.ITEMS[id].name) + '</button><span class="item-uso-info">' +
      infos.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</span>' + (mot ? '<p class="nota">' + esc(mot) + '</p>' : '') + '</div>';
  }
  // aba Status: Torrão e Estrela, só quando a mochila tem o item (sem eles, a aba fica como era)
  function itensStatusHtml(m) {
    var usos = [];
    if (itemQtd('torrao') > 0) usos.push(itemUsoHtml('torrao', m, [naMochilaTxt('torrao'), torroesTxt(m)]));
    if (itemQtd('estrela') > 0) usos.push(itemUsoHtml('estrela', m, [naMochilaTxt('estrela')]));
    return usos.length ? '<div class="item-usos">' + usos.join('') + '</div>' : '';
  }
  // aba Skills: as skills das vagas, cada uma com "Trocar" quando há Cupom (a skill de tipo não ocupa vaga e nunca troca)
  function skillsVagasHtml(m) {
    var cupom = itemQtd('cupom') > 0, mot = cupom ? motivoUso('cupom', m) : '', algum = false;
    var lista = m.skills.map(function (id) {
      if (!cupom || !hasOwn(GD.SKILLS, id)) return skillHtml(id, 32, skillQuandoTxt(id, m));
      algum = true;
      return '<div class="item-uso item-uso--skill">' + skillHtml(id, 32, skillQuandoTxt(id, m)) +
        '<button type="button" class="btn btn--pequeno" data-acao="item-usar" data-id="cupom" data-mount="' + esc(m.uid) + '" data-skill="' + esc(id) + '"' + indisponivel(mot) + '>' +
        'Trocar<span class="sr"> ' + esc(skillNome(id) + ' (usa 1 ' + GD.ITEMS.cupom.name + ')') + '</span></button></div>';
    }).join('');
    return lista + (algum && mot ? '<p class="nota">' + esc('Trocar: ' + mot) + '</p>' : '');
  }
  // o que o item vai fazer, no passo da confirmação (sem sortear nada)
  function confirmaTxt(F, m) {
    var fim = ' O item é gasto e não tem volta.';
    switch (F.id) {
      case 'torrao': return m.name + ' ganha 1 ponto a mais para distribuir, para sempre (' + torroesTxt(m) + ').' + fim;
      case 'estrela':
        var g = RS.starsOf(m);
        return (g < 3 ? m.name + ' sobe de ' + g + ' para ' + (g + 1) + ' estrelas; os pontos a mais aparecem para distribuir.' : m.name + ' já tem 3 estrelas.') + fim;
      case 'cupom': return skillNome(F.skillId) + ' sai das vagas de ' + m.name + ' e entra outra skill, sorteada entre as que ele pode aprender.' + fim;
      default: return m.name + ' tenta aprender uma skill nova na hora: ' + Math.round(GD.ITEMS.manual.chance * 100) + '% de chance. Aprendendo ou não, o manual é gasto e não tem volta.';
    }
  }
  // o passo aberto do uso (ui.item): a escolha do cavalo (as linhas do Estábulo, apagadas com o motivo), a da skill que sai
  // (Cupom) ou a confirmação. Desenhado a cada vez com o estado atual: o que mudou (outra aba) aparece apagado com o motivo.
  function itemPassoHtml() {
    var F = ui.item, it = GD.ITEMS[F.id], m = F.mountUid ? mountByUid(F.mountUid) : null, corpo = '', confirmar = '';
    if (F.passo === 'cavalo') {
      corpo = '<p class="nota">Escolha o cavalo.</p><ul class="montarias item-escolha">' + state.mounts.map(function (c) {
        var mot = motivoUso(F.id, c);
        return '<li>' + mountRowHtml(c, c.uid === state.activeId, { acao: 'item-cavalo', fim: 'Usar ' + it.name + ' neste cavalo.', motivo: mot }) +
          (mot ? '<p class="nota">' + esc(mot) + '</p>' : '') + '</li>';
      }).join('') + '</ul>';
    } else if (F.passo === 'skill') {
      var motS = motivoUso(F.id, m);
      if (m) {
        corpo = '<p>' + esc('Qual skill sai das vagas de ' + m.name + '? Entra outra, sorteada entre as que ele pode aprender.') + '</p>' +
          '<div class="opcoes item-skills">' + m.skills.filter(function (s) { return hasOwn(GD.SKILLS, s); }).map(function (s) {
            return '<button type="button" class="btn item-skill" data-acao="item-skill" data-id="' + esc(s) + '"' + indisponivel(motS) + '>' + skillIcone(s, 16) + esc(skillNome(s)) + '</button>';
          }).join('') + '</div>';
      }
      if (motS) corpo += '<p class="nota">' + esc(motS) + '</p>';
    } else {
      var motC = motivoUsoSkill(F.id, m, F.skillId), falha = ui.itemMsg && ui.itemMsg.passo ? ui.itemMsg.txt : '';
      corpo = (m ? '<p class="item-confirma-txt">' + esc(confirmaTxt(F, m)) + '</p>' : '') + (motC ? '<p class="nota">' + esc(motC) + '</p>' : '') +
        (falha ? '<p class="aviso" role="status">' + esc(falha) + '</p>' : '');
      confirmar = '<button type="button" class="btn btn--ouro" data-acao="item-confirmar"' + indisponivel(motC) + '>Confirmar</button>';
    }
    return '<section class="caixa item-passo" aria-labelledby="t-item">' + noticeHtml() +
      '<h2 class="titulo" id="t-item" tabindex="-1" data-foco-item>' + esc('Usar ' + it.name) + '</h2>' +
      itemLinhaHtml(F.id, { qtd: itemQtd(F.id), forma: 'tem', nivel: 'h3' }) + corpo +
      '<div class="acoes">' + confirmar + '<button type="button" class="btn" data-acao="item-cancelar">Cancelar</button></div></section>';
  }
  // desenha o passo do uso (ou a tela de origem, sem ele) do topo, com o foco no título do passo
  function itemPasso() {
    render();
    try { window.scrollTo(0, 0); } catch (e) { /* ignora */ }
    var h = telaEl.querySelector('[data-foco-item]') || telaEl.querySelector('[data-foco]');
    if (h) { try { h.focus({ preventScroll: true }); } catch (e2) { h.focus(); } }
  }
  // de volta à tela de origem (depois de usar ou cancelar): o foco no botão de onde o uso começou, se ele continua lá
  function itemVolta(F) {
    render();
    var el = telaEl.querySelector('[data-acao="item-usar"][data-id="' + F.id + '"]' + (F.origem === 'ficha' && F.skillId ? '[data-skill="' + F.skillId + '"]' : ''));
    if (!el) { itemPasso(); return; }
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }
  // toque recusado num passo: desenha de novo (a tela pode estar velha) e diz o porquê, como no botão indisponível
  function recusaItem(sel, txt) {
    rerenderKeepScroll();
    var bt = sel ? telaEl.querySelector(sel) : null;
    if (bt && bt.getAttribute('data-motivo') === txt) mostraMotivo(bt); else motivoVivo(txt);
  }
  function seletorDe(b) {
    var s = '[data-acao="' + b.getAttribute('data-acao') + '"]';
    ['data-id', 'data-mount', 'data-skill'].forEach(function (a) { var v = b.getAttribute(a); if (v != null) s += '[' + a + '="' + v + '"]'; });
    return s;
  }
  // Usa o item no cavalo: confere de novo (depois de sincronizar com outras abas), aplica numa cópia do estado, soma 1 ao
  // contador de usos sorteados (Cupom, Manual: o sorteio é o da seed do save com esse contador), tira 1 da mochila e grava
  // tudo de uma vez (gravaGasto). Devolve 'ok' (o aviso do resultado fica em ui.itemMsg), 'outra-aba' (um save de outra
  // aba foi adotado e a tela já foi desenhada de novo: nada foi gasto nem sorteado) ou o motivo da recusa (FALHA_SALVAR
  // se a gravação falhou: o state volta ao de antes e nenhum resultado aparece).
  function usaItem(id, uid, skillId) {
    if (id !== 'torrao' && id !== 'estrela' && id !== 'cupom' && id !== 'manual') return IT.podeUsar(id, null, {}).motivo;
    var s0 = state;
    persist();
    if (state !== s0) return 'outra-aba';
    var m = mountByUid(uid), mot = motivoUsoSkill(id, m, skillId);
    if (mot) return mot;
    var antes = clone(state), livres0 = RS.freePoints(m), r = null, txt;
    if (id === 'cupom' || id === 'manual') {
      r = id === 'cupom' ? IT.trocarSkill(m, skillId, state.seedBase, state.itemCounter) : IT.tentarDoma(m, state.seedBase, state.itemCounter);
      if (!r) return 'Este item não pode ser usado neste cavalo agora.';   // não acontece: podeUsar já garantiu a skill, a vaga e a candidata
      m.skills = r.skills;
      state.itemCounter += 1;
      txt = id === 'cupom' ? skillNome(r.sai) + ' saiu e entrou ' + skillNome(r.entra) + '.'
        : r.aprendeu ? m.name + ' aprendeu ' + skillNome(r.aprendeu) + '!' : 'Não foi desta vez: ' + m.name + ' não aprendeu. O manual foi usado.';
    } else if (id === 'torrao') {
      m.torroes = IT.usarTorrao(m).torroes;
      txt = m.name + ' ganhou 1 ponto para distribuir. ' + torroesTxt(m) + '.';
    } else {
      m.grau = IT.usarEstrela(m).grau;
      txt = m.name + ' agora tem ' + m.grau + ' estrelas e ganhou ' + pontosTxt(RS.freePoints(m) - livres0) + ' para distribuir.';
    }
    state.mochila[id] -= 1;
    var g = gravaGasto(s0, antes);
    if (g === 'outra-aba') return 'outra-aba';
    if (g === 'falhou') return FALHA_SALVAR;
    ui.itemMsg = { id: id, uid: m.uid, origem: ui.item ? ui.item.origem : 'mochila', txt: txt };
    return 'ok';
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
    var d = pieceMods(def.id, 0)[info.main] - pieceMods(cur.id, cur.plus)[info.main];
    if (!d) return 'igual à equipada';
    return (d > 0 ? '+' : '−') + statNum(Math.abs(d)) + ' ' + GD.STATS[info.main].short + ' em relação à equipada';
  }
  function lojaBotaoHtml(acao, id, price) {
    var pode = podeGastar(price);
    var rotulo = pode ? 'Comprar' : state.gold >= price ? 'Reservado' : 'Sem Ouro';
    return '<button type="button" class="btn btn--ouro btn--pequeno" data-acao="' + acao + '" data-id="' + esc(id) + '"' + (pode ? '' : ' disabled') + '>' +
      rotulo + ' (' + fmt(price) + ')</button>';
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
  // a seção de peças e Pedras da aba Loja (só com GEAR_ON; o renderLoja, na seção da Loja de itens, a põe na parte Comprar)
  function lojaEquipHtml() {
    if (!ui.loja || LOJA_TABS.indexOf(ui.loja.tab) < 0) ui.loja = { tab: LOJA_TABS[0], msg: null };
    var Q = ui.loja;
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
    return msg + '<section class="caixa" aria-label="Equipamento">' + abas + '<p class="nota">' + esc(nota) + '</p>' +
        '<div class="loja-grade">' + produtos + '</div></section>';
  }

  // ===========================================================================
  // Sala de largada: campo sorteado uma vez (state.pending) e simulado só no "Largar!"
  // ===========================================================================
  // Poder de um modelo do catálogo como bot no nível L, com os pontos pela build fixa dos bots (botAlloc). É função
  // pura do modelo e do nível (sem equipamento: spec 1b §7), então fica guardado por (id do modelo, nível): o
  // botAlloc do bloco 1b compra ponto a ponto, e chamá-lo para cada nível, modelo e bot deixava a sala ~5× mais lenta
  // (~57 ms no Node, contra ~11 ms antes do 1b; com a memória, ~13 ms a 1ª sala e menos de 1 ms as seguintes).
  // Só os modelos fixos do catálogo (GD.WILD_HORSES e GD.STARTERS) passam por aqui.
  var poderBotMemo = {};
  function poderBot(template, L) {
    var k = template.id + '|' + L;
    if (!hasOwn(poderBotMemo, k)) {
      var h = clone(template);
      h.level = L;
      h.alloc = RS.botAlloc(h);
      poderBotMemo[k] = RS.powerRating(h);
    }
    return poderBotMemo[k];
  }
  function bestLevelFor(template, target, lo, hi) {
    var best = lo || 1, bestD = Infinity;
    for (var L = (lo || 1); L <= (hi || E.maxLevel || 50); L++) {
      var d = Math.abs(poderBot(template, L) - target);
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
    // Ouro abaixo da entrada da sala aberta (só com save adulterado: a entrada fica reservada): a MESMA sala
    // (mesma seed, rivais e condições) corre como treino, sem entrada e sem prêmio de aposta. Nunca é
    // descartada, senão seria um re-sorteio de graça. Treino aberto também só some depois de corrido (mesmo que
    // o Ouro volte a cobrir uma entrada, por exemplo vendendo uma peça).
    // Como os gastos, só vale se gravou: senão a memória teria treino e o disco a sala valendo.
    if (P && !P.training && state.gold < P.fee) {
      var sR = state, antesR = clone(state);
      P.training = true; P.fee = 0;
      var gR = gravaGasto(sR, antesR);
      if (gR === 'falhou') ui.notice = FALHA_SALVAR;
      if (gR !== 'ok') return null;
    }
    if (!P) {
      var s0 = state, antes = clone(state);
      var fee = training ? 0 : effectiveTier();
      if (fee == null) { training = true; fee = 0; } // sem Ouro para nenhuma entrada (ex.: save editado): vira treino
      state.raceCounter += 1;
      P = {
        // pareamento pelo Poder do cavalo com os pontos de agora; com o páreo aberto, pontos não podem passar dele
        counter: state.raceCounter, training: !!training, fee: fee,
        pr: RS.powerRating(playerHorse()),   // sem equipamento (spec 1b §7)
        gear: gearSnapshot(playerGear()),   // retrato do equipamento: guardado, sem efeito com o equipamento suspenso
        alloc: RS.validAlloc(activeMount(), activeMount().alloc)   // retrato dos pontos (R16): o sanitize limita pr por ele
      };
      state.pending = P;
      // a sala só abre se ficou gravada: sem isso, recarregar a sortearia de novo
      var g = gravaGasto(s0, antes);
      if (g === 'falhou') ui.notice = FALHA_SALVAR;
      if (g !== 'ok') return null;
    }
    return buildLobby(P);
  }

  function buildLobby(P) {
    var counter = P.counter;
    var seed = RS.hash2(state.seedBase, counter);
    // modo DEV: seed e condições armadas no painel valem para esta sala (os campos vazios seguem a normal)
    var dv = DEV_MODE ? ui.devNext : null;
    if (dv && dv.seed != null) seed = dv.seed >>> 0;
    var rng = RS.mulberry32(RS.hash2(seed, 0xA11CE)); // aleatoriedade só de UI/matchmaking, derivada da seed

    // pista
    var cond = RS.randomConditions(seed), trackName = pick(TRACK_NAMES, rng);
    if (dv && dv.cond && devHooks) cond = devHooks.condicoes(dv.cond, cond, seed);
    withRanges(cond);

    var n = (E.minRacers || 4) + Math.floor(rng() * ((E.maxRacers || 8) - (E.minRacers || 4) + 1));
    var pr = P.pr;
    var player = {
      isPlayer: true, name: PLAYER_NAME, horse: playerHorse(), gear: corredorGear(),
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
      // equipamento do bot pela liga do alvo e pelo elemento do template; com o equipamento suspenso (GEAR_ON) o bot
      // corre sem peças, mas o sorteio continua consumido (a ordem da RNG da sala não muda com a constante)
      var gpick = rng();
      var leagueIdx = leagueIndex(target);
      var botGear = function (tpl) { return GEAR_ON ? GR.botGear(leagueIdx, tpl.element, gpick) : null; };
      var inBand = pool.map(function (tpl) {
        var bd = levelBand(tpl);
        return { tpl: tpl, gear: botGear(tpl), fit: bestLevelFor(tpl, target, bd[0], bd[1]) };
      })
        .filter(function (c) { return c.fit.diff <= target * 0.06; });
      var fresh = inBand.filter(function (c) { return !used[c.tpl.id]; });
      var cands = fresh.length ? fresh : inBand;
      if (!cands.length) {
        // ninguém plausível na faixa: o mais próximo do alvo em qualquer nível
        var all = pool.map(function (tpl) {
          return { tpl: tpl, gear: botGear(tpl), fit: bestLevelFor(tpl, target) };
        });
        all.sort(function (x, y) { return x.fit.diff - y.fit.diff; });
        cands = all.slice(0, 3);
      }
      var choice = pick(cands, rng);
      used[choice.tpl.id] = true;
      var horse = clone(choice.tpl);   // genética do catálogo; os pontos livres pela build fixa
      horse.level = choice.fit.level;
      horse.alloc = RS.botAlloc(horse);
      horse.id = choice.tpl.id + '-b' + b;
      var silkIdx = SP.SILKS.indexOf(BOT_SILKS[silkOrder[b % silkOrder.length]]);
      bots.push({
        isPlayer: false, name: names[b % names.length], horse: horse, gear: choice.gear,
        silks: SP.SILKS[silkIdx], silkIdx: silkIdx,
        rating: RS.powerRating(horse)
      });
    }
    var racers = shuffle([player].concat(bots), rng);   // ordem = raia
    var playerIdx = racers.indexOf(player);

    return {
      counter: counter, seed: seed, training: !!P.training, fee: P.fee || 0, n: n,
      cond: cond, trackName: trackName,
      racers: racers, playerIdx: playerIdx, sim: null,
      // modo DEV: vento forçado (a tela da corrida o desenha) e "skills sempre ativam" (vai ao RaceSim)
      dev: dv ? { wind: dv.wind, skillsAlways: !!dv.skillsAlways } : null
    };
  }
  // vento da corrida (só visual): o forçado no modo DEV (L.dev é null sem nada armado) ou o da seed da sala
  function ventoDaSala(L) { return (L.dev && L.dev.wind) || FX.wind(L.seed); }
  var VENTO_NOME = { calmo: 'Calmo', brisa: 'Brisa', ventania: 'Ventania' };
  function ventoTxt(w) { return VENTO_NOME[w.intensity] + (w.intensity === 'calmo' ? '' : w.dir > 0 ? ' \u2192' : ' \u2190'); }
  function ventoFala(w) { return VENTO_NOME[w.intensity].toLowerCase() + (w.intensity === 'calmo' ? '' : w.dir > 0 ? ' para a direita' : ' para a esquerda'); }
  // trechos de subida/curva derivados dos blocos (só para desenhar: a simulação lê os blocos)
  function withRanges(cond) {
    cond.hills = RS.hillsFromBlocks(cond.blocks);
    cond.curves = RS.curvesFromBlocks(cond.blocks);
    return cond;
  }
  // o cavalo do jogador na sala reflete a montaria ativa (e o equipamento atual, quando ele não está suspenso)
  function refreshPlayerEntry(L) {
    var r = L.racers[L.playerIdx];
    r.horse = playerHorse(); r.gear = corredorGear();
  }
  // equipamento do jogador na sala e na corrida: com o equipamento suspenso (GEAR_ON), nenhum (a corrida já o ignora)
  function corredorGear() { return GEAR_ON ? playerGear() : null; }

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
      '<span class="chip"><span class="rotulo">Piso</span>' + pisoIcone(cond.surface) + '<b>' + esc(GD.SURFACES[cond.surface].name) + '</b>' + ajudaBtn('piso', 'o piso') + '</span>' +
      '<span class="chip"><span class="rotulo">Clima inicial</span>' + climaIcone(cond.weather) + '<b>' + esc(GD.WEATHERS[cond.weather].name) + '</b>' + ajudaBtn('clima', 'o clima') + '</span>' +
      '<span class="chip"><span class="rotulo">Traçado</span><b>' + esc(sh.reta + '% reta · ' + sh.curva + '% curva · ' + sh.subida + '% subida') + '</b></span></div>';
  }

  function strategyTips(L) {
    var tips = [];
    var sh = sharePct(L.cond);
    if (sh.curva >= 40) tips.push('Muitas curvas: Manobra segura a velocidade na curva e na saída dela.');
    if (sh.subida >= 30) tips.push('Muitas subidas: Força ajuda a não perder ritmo' + (GEAR_ON ? ' (a Armadura dá Força).' : '.'));
    if (L.cond.distance >= 1800) tips.push('Pista longa: Estamina segura o ritmo até o fim.');   // longa a partir de 1.800 m, como no balance.js (distGroup)
    // clima contra o elemento: a penalidade vale sempre (o conjunto de 5 peças não a anula mais, porque o
    // equipamento não entra na corrida), e só o Dado da Sorte pode virar o clima
    var h = playerHorse();
    if (RS.weatherMult(h.element, L.cond.weather, false) < 1) {
      tips.push('Clima ruim para o seu elemento: só o Dado da Sorte pode virá-lo durante a corrida.');
    }
    return tips;
  }

  function climaHints(L) {
    var h = playerHorse();
    var el = elementOf(h.element);
    var w = GD.WEATHERS[L.cond.weather];
    var m = RS.weatherMult(h.element, L.cond.weather, false);
    var pct = Math.round((m - 1) * 100);
    var eff = pct > 0 ? '+' + pct + '% para ' + el.name : pct < 0 ? '−' + Math.abs(pct) + '% para ' + el.name : 'sem efeito para ' + el.name;
    // chance de rolar o 2º dado, pela mesma conta do RaceSim.rollDice: (Sorte − sorteDiceLo)/(sorteDiceFull − sorteDiceLo)
    var T = RS.TUNING, sorte = RS.computeStats(h).sorte;
    var dois = Math.round(clamp((sorte - T.sorteDiceLo) / (T.sorteDiceFull - T.sorteDiceLo), 0, 1) * 100);
    var items = '<li' + (pct > 0 ? ' class="bom"' : pct < 0 ? ' class="ruim"' : '') + '>' + esc('Clima inicial ' + w.name + ': ' + eff) + '</li>' +
      '<li class="dica">' + esc('Dado da Sorte a 1/3 e 2/3 da pista: quem tira o maior dado puxa o clima para o seu elemento. Sua Sorte (' + sorte + '): ' + dois + '% de rolar dois dados.') + ajudaBtn('dado', 'o Dado da Sorte') + '</li>';
    var tips = strategyTips(L).map(function (t) { return '<li class="dica">' + esc(t) + '</li>'; }).join('');
    return '<div class="tela-cabeca"><span class="rotulo">Clima e sorte</span>' + ajudaBtn('clima', 'o clima') + '<ul class="dicas">' + items + tips + '</ul></div>';
  }

  function racerRow(r, i) {
    var h = r.horse;
    var rating = r.isPlayer ? RS.powerRating(h) : r.rating;
    return '<li class="' + (r.isPlayer ? 'voce' : '') + '">' + laneChip(r, i) +
      '<div class="corredor"><b>' + (r.isPlayer ? '<span class="tag-voce">VOCÊ</span>' : '') +
        '<span class="nome">' + esc(r.isPlayer ? h.name : r.name) + '</span></b>' +
        '<small>' + (r.isPlayer ? '' : '<span>' + esc(h.name) + '</span>') + elementHtml(h.element) + rarityHtml(h.rarity) +
        '<span>Nv ' + h.level + '</span>' +
        (GEAR_ON ? setBadgeHtml(r.gear) : '') + '</small></div>' +
      '<div class="poder"><b>' + rating + '</b><small>Poder</small></div></li>';
  }

  function renderLargada() {
    var L = ui.lobby;
    refreshPlayerEntry(L);
    var eu = L.racers[L.playerIdx];
    var D = L.cond.distance;
    var pay = L.training ? null : RS.payouts(L.fee, L.n, L.racers.map(function (r, i) { return i; }));
    var pote;
    if (L.training) {
      pote = '<section class="caixa" aria-labelledby="t-pote"><h2 class="titulo" id="t-pote">Treino gratuito</h2>' +
        '<p class="nota">Sem aposta e sem pote. Você ganha metade do XP normal e um pouco de Ouro pela colocação.</p>' +
        '<div class="premios">' + [0, 1, 2].map(function (p) {
          return '<div class="premio premio--' + (p + 1) + '"><span class="lugar">' + podioIcone(p + 1) + (p + 1) + 'º</span>' + ouroHtml(TRAINING_GOLD[p]) + '</div>';
        }).join('') + '</div></section>';
    } else {
      pote = '<section class="caixa" aria-labelledby="t-pote"><h2 class="titulo" id="t-pote">Pote</h2>' +
        '<dl class="pote"><dt>Entrada ' + fmt(L.fee) + ' × ' + L.n + ' corredores</dt><dd>' + ouroHtml(pay.pot) + '</dd>' +
        '<dt>Taxa da casa (' + Math.round(E.houseFee * 100) + '%)</dt><dd>−' + fmt(pay.fee) + '</dd>' +
        '<div class="total" style="display:contents"><dt>Prêmios</dt><dd>' + ouroHtml(pay.pot - pay.fee) + '</dd></div></dl>' +
        '<div class="premios premios--' + pay.prizes.length + '">' + pay.prizes.map(function (p) {
          return '<div class="premio premio--' + p.place + '"><span class="lugar">' + podioIcone(p.place) + p.place + 'º</span>' + ouroHtml(p.amount) + '</div>';
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
        '</header>' + noticeHtml() +
      '<section class="caixa" aria-label="Condições da pista">' + conditionChips(L.cond) +
        '<canvas class="perfil" data-perfil="1" role="img" aria-label="' + esc('Mapa da pista visto de cima, ' + D + ' metros em ' + L.cond.blocks.length + ' trechos: ' +
          L.cond.blocks.map(function (bl) { return GD.BLOCK_TYPES[bl.type].name.toLowerCase(); }).join(', ')) + '"></canvas>' +
        climaHints(L) + '</section>' +
      '<section class="caixa" aria-labelledby="t-estrategia"><h2 class="titulo" id="t-estrategia">Sua estratégia</h2>' +
        '<div class="cavalo-cabeca">' + portraitHtml(eu.horse, { selo: true }) +
          '<div class="cavalo-info"><b class="cavalo-nome">' + esc(eu.horse.name) + '</b>' +
          '<div class="linha-meta">' + rarityHtml(eu.horse.rarity) + elementHtml(eu.horse.element) +
            '<span>Poder <b>' + RS.powerRating(eu.horse) + '</b></span></div></div></div>' +
        (GEAR_ON ? '<div class="tela-cabeca"><span class="rotulo">Equipamento</span>' + gearSummaryHtml(activeMount()) +
          '<div class="acoes"><button type="button" class="btn btn--pequeno" data-acao="equipar-tela" data-id="' + esc(state.activeId) + '">Equipar</button></div>' +
          (state.pending ? '<p class="nota">' + esc('Com o páreo aberto, só trocas que não passem do Poder da sala (' + state.pending.pr + ').') + '</p>' : '') +
        '</div>' : '') + '</section>' +
      '<section class="caixa" aria-labelledby="t-corredores"><h2 class="titulo" id="t-corredores">Corredores<span class="nota">' + L.n + ' na raia</span></h2>' +
        '<ol class="programa">' + L.racers.map(racerRow).join('') + '</ol></section>' +
      pote +
      '<div class="barra-acao"><button type="button" class="btn btn--ouro btn--grande" data-acao="largar">' + esc(label) + '</button></div>' +
      '</section>';
  }

  // Mapa da pista: o traçado visto de cima (RaceFx.trackPath / drawTrackMap), com retas na cor do piso, curvas e
  // subidas na cor do tipo, largada (quadrado claro) e chegada (xadrez). A altura do canvas acompanha o formato
  // do traçado (escala única, sem distorcer); embaixo, a legenda dos tipos presentes e a distância.
  function drawProfileCanvas(cv) {
    var L = ui.lobby; if (!L) return;
    var cond = L.cond, D = cond.distance;
    var par = cv.parentNode, avail = 336;
    if (par) {
      var pcs = getComputedStyle(par);
      avail = par.clientWidth - (parseFloat(pcs.paddingLeft) || 0) - (parseFloat(pcs.paddingRight) || 0);
    }
    var artW = clamp(Math.floor(avail / 2), 120, 240);
    var path = FX.trackPath(cond.blocks), bb = path.bbox, folga = 4;   // folga = a do drawTrackMap com linha 3
    var sW = bb.w > 0 ? (artW - 2 * folga) / bb.w : 0;
    var mapH = clamp(Math.ceil(bb.h * sW) + 2 * folga, 28, 84), artH = mapH + 11;
    var s = setupCanvas(cv, artW, artH, 2), ctx = s.ctx, k = s.k;
    function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x * k, y * k, w * k, h * k); }
    R(0, 0, artW, artH, C.painel2);
    var surf = (GD.SURFACES[cond.surface] || {}).color || C.palha;
    FX.drawTrackMap(ctx, path, { x: 0, y: 0, w: artW, h: mapH, P: k }, { piso: surf, linha: 3 });
    // legenda: tipos presentes (amostra da cor + nome) e a distância à direita
    var ly = mapH + 3, lx = 4;
    ['reta', 'curva', 'subida'].forEach(function (tp) {
      if (!cond.blocks.some(function (bl) { return bl.type === tp; })) return;
      var nome = GD.BLOCK_TYPES[tp].name.toUpperCase();
      R(lx, ly + 2, 5, 3, tp === 'reta' ? surf : GD.BLOCK_TYPES[tp].color);
      SP.drawText(ctx, nome, (lx + 7) * k, ly * k, { fonte: 'g7', scale: k, color: C.texto2 });
      lx += 7 + SP.measureText(nome, 1, 'g7') + 5;
    });
    SP.drawText(ctx, D + 'm', (artW - 4) * k, ly * k, { fonte: 'g7', scale: k, color: C.texto, align: 'right' });
  }

  // ===========================================================================
  // Liquidação (no "Largar!"): debita, simula com a seed da sala e paga
  // ===========================================================================
  function settle(L) {
    refreshPlayerEntry(L);
    var cfg = {
      seed: L.seed,
      conditions: L.cond,
      racers: L.racers.map(function (r) {
        return { horse: r.horse, gear: r.gear, name: r.name, isPlayer: r.isPlayer };
      })
    };
    if (DEV_MODE && L.dev && L.dev.skillsAlways) cfg.dev = { skillsAlways: true };   // só o modo DEV
    L.sim = RS.simulate(cfg);
    L.cond = withRanges(L.sim.conditions);
    var order = L.sim.finishOrder;
    var place = order.indexOf(L.playerIdx) + 1;
    var hBefore = playerHorse();
    var before = { level: hBefore.level, xp: hBefore.xp, gold: state.gold, stats: RS.computeStats(hBefore), free: RS.freePoints(hBefore) };
    var pay = null, prize;
    if (L.training) {
      prize = TRAINING_GOLD[place - 1] || 10;
    } else {
      pay = RS.payouts(L.fee, L.n, order);
      var mine = pay.prizes.filter(function (p) { return p.racer === L.playerIdx; })[0];
      prize = ouroComBonus(mine ? mine.amount : 0);   // o pago (e o mostrado no resultado), com a insígnia de Fogo
    }
    var xpBase = E.xpPerPlace[place - 1] || E.xpPerPlace[E.xpPerPlace.length - 1];
    var xpGain = L.training ? Math.round(xpBase / 2) : xpBase;
    xpGain = xpComBonus(xpGain);   // com a insígnia de Água (o treino também: todo XP somado passa por aqui)

    state.gold = state.gold - L.fee + prize;
    // Pedra Negra do pódio: só em corrida valendo, pela seed da sala, na mesma gravação do Ouro. Com o equipamento
    // suspenso (GEAR_ON) não cai: o podiumStone (RNG própria, da seed da sala) nem é chamado; o resto não muda
    var stone = L.training || !GEAR_ON ? 0 : GR.podiumStone(L.seed, place, L.fee);
    state.pedras += stone;
    var gained = applyXp(activeMount(), xpGain, state.raceCounter);
    var levels = gained.levels, learned = gained.learned;
    state.races += 1;
    if (place === 1) state.wins += 1;
    if (place <= 3) state.podiums += 1;
    if (!L.training) state.goldWon += prize;
    state.pending = null;
    // quem chama grava (gravaGasto) e, se gravou, limpa ui.devNext (os valores armados no painel DEV valem
    // só para esta corrida)

    var hAfter = playerHorse();
    return {
      place: place, prize: prize, fee: L.fee, training: L.training, payouts: pay, stone: stone,
      xpGain: xpGain, levels: levels, learned: learned,
      before: before,
      after: { level: hAfter.level, xp: hAfter.xp, gold: state.gold, stats: RS.computeStats(hAfter),
        free: RS.freePoints(hAfter), allCap: todosNoTeto(hAfter) }
    };
  }
  // os status que recebem pontos no teto (base + pontos ≥ TUNING.statMax)? A Sorte não recebe (TUNING.noBuy).
  function todosNoTeto(h) {
    var cap = RS.TUNING.statMax, a = RS.validAlloc(h, h.alloc), nb = RS.TUNING.noBuy || [];
    return STAT_KEYS.every(function (k) { return nb.indexOf(k) >= 0 || RS.naturalStat(h, k) + a[k] >= cap - 1e-9; });
  }

  // ===========================================================================
  // Tela 4 — Corrida (HUD desenhado dentro do canvas, tela inteira sem rolagem)
  // ===========================================================================
  // A tela de corrida mostra uma corrida só: a da sala (ui.lobby) ou, depois de pagar um desafio de ginásio, o duelo que
  // está passando (ui.gym.ver, Tarefa 6). Este é o único ponto que decide: devolve o que mostrar (L, que a tela e o
  // createRaceView leem, e o cabeçalho cab), o que fazer quando a corrida acaba ou é pulada (fim) e no "Voltar" do aparelho
  // (voltar). cab: { titulo, aria (o começo do nome do canvas), placa (HTML do canto do topo), linha (texto abaixo do topo
  // ou null), pular e pularFim (o texto do botão Pular durante e depois da chegada), extra (HTML de botões a mais) }.
  function corridaAtual() {
    var v = ui.gym && ui.gym.ver;
    if (v && v.tela === 'duelo') return { L: v.L, cab: v.cab, fim: ginDueloAcabou, voltar: ginPulaTudo };
    var L = ui.lobby;
    return {
      L: L, fim: function () { go('resultado'); }, voltar: function () { if (raceView) raceView.skip(); else go('resultado'); },
      cab: !L ? null : { titulo: L.trackName, aria: 'Corrida em ' + L.trackName, linha: null, pular: 'Pular para o resultado', pularFim: 'Ver resultado', extra: '',
        placa: L.training ? '<span class="rotulo">Treino</span>' : '<span class="rotulo">Pote</span>' + ouroHtml(L.fee * L.n) }
    };
  }
  function renderCorrida() {
    var cor = corridaAtual(), L = cor.L, cab = cor.cab, D = L.cond.distance;
    var shp = sharePct(L.cond);
    var tracado = ['curva', 'subida'].map(function (tp) {
      return shp[tp] ? shp[tp] + '% ' + tp : '';
    }).filter(Boolean).join(' · ') || 'reta pura';
    // o trecho do clima fica num span próprio: pushFeed troca o texto quando o Dado vira o clima
    var climaTxt = 'Clima: ' + GD.WEATHERS[L.cond.weather].name;
    var condTxt = D + ' m · ' + GD.SURFACES[L.cond.surface].name + ' · ' + climaTxt + ' · Vento: ' + ventoFala(ventoDaSala(L)) + ' · ' + tracado;
    return '<section class="tela tela--larga tela--corrida" aria-labelledby="t-corrida">' +
      '<header class="corrida-topo"><div class="corrida-titulo">' +
        '<h1 class="corrida-nome" id="t-corrida" tabindex="-1" data-foco>' + esc(cab.titulo) + '</h1>' +
        '<span class="rotulo">' + esc(D + ' m · ' + GD.SURFACES[L.cond.surface].name + ' · ') +
          '<span id="clima-atual">' + climaIcone(L.cond.weather) + esc(climaTxt) + '</span>' + esc(' · ' + tracado) + '</span></div>' +
        '<span class="saldo saldo--pote">' + cab.placa + '</span></header>' +
      (cab.linha ? '<p class="corrida-duelo" id="corrida-duelo">' + esc(cab.linha) + '</p>' : '') +
      '<div class="palco"><canvas id="pista" role="img" aria-label="' + esc(cab.aria + ', ' + condTxt) + '"></canvas></div>' +
      '<div class="corrida-baixo">' +
        // faixa de ordem (spec 3c §4), logo abaixo da pista: preenchida por atualizaOrdem (createRaceView); altura fixa
        // no CSS. Fica dentro do .corrida-baixo para, em paisagem, ir para a linha dos controles sem somar altura
        '<section class="ordem" id="ordem" aria-label="Classificação"><ol class="ordem-lista" id="ordem-lista"></ol>' +
          '<p class="ordem-vizinhos" id="ordem-vizinhos"></p></section>' +
        '<ol class="feed" id="feed" aria-label="Narração"></ol>' +
        '<div class="controles" role="group" aria-label="Controles da corrida">' +
          '<div class="vel"><button type="button" class="btn btn--pequeno" data-acao="vel" data-id="1" aria-pressed="true">x1</button>' +
          '<button type="button" class="btn btn--pequeno" data-acao="vel" data-id="2" aria-pressed="false">x2</button></div>' +
          '<button type="button" class="btn btn--pequeno pular" data-acao="pular" id="btn-pular">' + esc(cab.pular) + '</button>' + cab.extra +
        '</div>' +
      '</div>' +
      '<p class="sr" aria-live="polite" id="anuncio"></p>' +
      '</section>';
  }

  // fim: chamado uma vez, quando a corrida acaba ou é pulada; fimTxt: o texto do botão Pular depois da chegada
  // o nome do corredor na faixa de ordem e na narração: o do cavalo, ou o rótulo que a corrida der (no duelo de ginásio,
  // "Brasa (Cabo Tocha)" quando os dois cavalos têm o mesmo nome; a sala não tem rótulo)
  function nomeDoCorredor(r) { return r.rotulo || r.horse.name; }
  function createRaceView(L, root, fim, fimTxt) {
    var sim = L.sim, n = L.n, D = L.cond.distance, hills = L.cond.hills;
    var blocks = L.cond.blocks;
    // curvas (só visual): o traçado de cima do minimapa e quanto a raia sobe (pixels de arte inteiros, ≥ 0)
    // no metro m — o mesmo arredondamento do Sprites.drawTrack, então o cavalo fica em cima das linhas da raia.
    // No desenho, blocos de curva colados são UMA curva (RaceFx.curveRuns: arco, placas e tracejados por
    // sequência); L.cond.curves continua por bloco (é o que a simulação usa e o selo ↪CURVA do HUD lê o bloco).
    var curves = FX.curveRuns(L.cond.curves || []);
    var mapa = FX.trackPath(blocks);
    var pisoCor = (GD.SURFACES[L.cond.surface] || {}).color || C.palha;
    var silksCores = L.racers.map(function (r) { return r.silks; });
    // (o fator lay.arcoK encolhe o arco quando falta espaço acima da raia 1, como o maxLift das subidas)
    function arcoArt(m) { return curves.length ? Math.round(-FX.curveOffsetTela(curves, m, self.camTela) * self.lay.arcoK) || 0 : 0; }
    // clima em cada instante: o inicial, trocado por cada evento 'clima' (Dado da Sorte) já ocorrido
    var climaEvs = sim.events.filter(function (ev) { return ev.type === 'clima'; });
    // o Dado de um evento ('dado', ou a virada de clima com o mesmo t), ou null
    function dadoDoEvento(ev) {
      if (ev.type !== 'dado' && ev.type !== 'clima') return null;
      for (var q = 0; q < dadoItens.length; q++) if (dadoItens[q].t0 === ev.t) return dadoItens[q];
      return null;
    }
    // Ruling 12: a frase do Dado e a virada de clima que ele causa (com o #anuncio, o clima do painel e o clarão, que
    // saem do pushFeed delas) esperam a revelação daquele Dado; as frases seguintes esperam atrás, na ordem de sempre.
    // Com movimento reduzido a revelação é em t0 e nada espera
    function esperaRevelacao(ev) {
      var d = dadoDoEvento(ev);
      return !!d && !FX.diceRevealed(d, self.simT, reduced());
    }
    // o clima que o painel do topo mostra e a pista desenha (chuva, névoa): o da simulação, mas a virada de um Dado só
    // depois da revelação (Ruling 18; a velocidade dos cavalos é a da simulação, que já conta o clima novo)
    function climaMostrado(simT) {
      var w = L.cond.weather;
      for (var c = 0; c < climaEvs.length && climaEvs[c].t <= simT; c++) {
        var d = dadoDoEvento(climaEvs[c]);
        if (d && !FX.diceRevealed(d, simT, reduced())) break;
        w = climaEvs[c].weather;
      }
      return w;
    }
    var frames = sim.frames, F = frames.length, dt = sim.dt;
    var me = L.playerIdx;
    var cv = root.querySelector('#pista');
    var palco = cv.parentNode;
    var tela = root.querySelector('.tela--corrida');
    // a corrida desenha num canvas do tamanho da arte (etapa 2.1 da direção de arte, guia §2 e §9): 1 pixel de arte = 1
    // pixel do buffer (self.S = 1, o molde do cavalo 1:1), e cada quadro é copiado para o canvas da tela com um drawImage
    // só, ampliado s vezes (s inteiro, a grade da interface), sem suavização
    var vctx = cv.getContext('2d'), buf = document.createElement('canvas'), ctx = buf.getContext('2d');
    var hud = {
      feed: root.querySelector('#feed'), pular: root.querySelector('#btn-pular'), anuncio: root.querySelector('#anuncio'),
      clima: root.querySelector('#clima-atual'),
      ordem: root.querySelector('#ordem-lista'), vizinhos: root.querySelector('#ordem-vizinhos')
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
          var txt = mk[1](Math.round(goal)) + ': ' + nomeDoCorredor(L.racers[lead]) + ' na frente' +
            (lead === me ? ' (é você!)' : '; você em ' + mine + 'º') + '.';
          out.push({ t: frames[f2].t, racer: lead, type: 'narracao', text: txt });
          break;
        }
      });
      return out;
    }
    // Reprodução comprimida: a corrida dura 55–170 s no relógio da simulação (que o HUD mostra),
    // mas é assistida em TELA_S_MIN (1000 m) a TELA_S_MAX (2400 m) segundos em x1, mais as câmeras lentas.
    // Só a animação: o resultado da corrida não muda.
    var realTarget = TELA_S_MIN + (TELA_S_MAX - TELA_S_MIN) * clamp((D - 1000) / 1400, 0, 1);
    var ts = sim.duration / realTarget;
    // Efeitos (fx.js): a linha do tempo é montada uma vez. Os Dados recebem a escala de reprodução
    // (segundos de simulação por segundo real em x1): câmera lenta ~2 s, giro ~1 s, brilho do vencedor
    // ~2 s e faixa ~3,6 s reais.
    var fxTl = FX.timeline(sim, L.racers, ts);
    var dadoItens = fxTl.filter(function (it) { return it.kind === 'dado'; });
    // skills e Garra: rastro de elemento e contorno enquanto duram; balões (skill, Garra, cansou) por ~1,5 s.
    // A skill de tipo só entra nos balões (e na faixa do jogador): o efeito dela é a aura do terço inteiro
    // (RaceFx.drawTypeAura, pela posição em racerInfo[j].typeSkill)
    var efeitoItens = fxTl.filter(function (it) { return (it.kind === 'skill' && !it.typeSkill) || it.kind === 'garra'; });
    // skill de tipo de cada corredor ({ el, from, to, ... }), resolvida como no balão (RaceFx.typeSkillOf): o
    // elemento da aura é o mesmo do balão
    var tipoTerco = L.racers.map(function (r, q) { return FX.typeSkillOf(sim, q, r.horse); });
    var balaoItens = fxTl.filter(function (it) { return it.kind === 'skill' || it.kind === 'garra' || it.kind === 'cansou'; });
    function dadoAtivo(t) {
      for (var q = 0; q < dadoItens.length; q++) if (t >= dadoItens[q].t0 && t < dadoItens[q].t1) return dadoItens[q];
      return null;
    }
    FX.resetStats(true);
    var self = {
      simT: 0, tReal: 0, last: 0, mult: 1, phase: 'contagem', count: reduced() ? 1.2 : 2.4,
      gallop: new Array(n), S: 2, W: 0, H: 0, done: false, endTimer: 0,
      lastHud: {}, flash: 0, winnerSeen: false, finishCam: false, playerRect: null, crossed: false,
      slowK: 1, fx: fxTl,
      lay: null,
      wind: ventoDaSala(L)   // só visual (RaceFx.wind da seed, ou o forçado no DEV)
    };
    for (i = 0; i < n; i++) self.gallop[i] = i * 1.7;
    // as camadas da região nos climas que trocam a paleta, pré-desenhadas na largada (uma virada de clima não custa um quadro)
    SP.prepararRegiao(regiaoDaPista(L), ['nublado', 'chuva', 'nevoa']);
    // marcas, jóquei, raridade (parte 2a) e porte (parte 2b) de cada corredor, calculados uma vez; cada cavalo é
    // montado já na largada, no molde do porte (Sprites.prepararCavalo: o parado e todo o galope recoloridos agora,
    // ~0,8 ms por quadro com marcas e jóquei), e não aos poucos no 1º ciclo do galope. Só desenho: a corrida já foi
    // simulada.
    var visuais = L.racers.map(function (r, q) {
      var v = opcoesVisuais(r.horse, joqueiDoCorredor(L, q));
      v.rastro = true;   // rastro de luz do Mítico: só na corrida
      SP.prepararCavalo(comVisuais({ palette: r.horse.palette, element: r.horse.element, silks: r.silks }, v));
      return v;
    });

    // minimapa do HUD (fora do layout compacto): caixa em pixels de arte logo abaixo da linha de cima
    function miniCaixa(artW) {
      var w = clamp(Math.round(artW * 0.2), 40, 72);
      return { x: 3, y: 28, w: w, h: clamp(Math.round(w * 0.45), 22, 30) };   // embaixo do lugar (HUD de 20 + 5)
    }

    // maior redutor d (divisor de S, com S/d ≥ 2 e os moldes compatíveis) até o canvas caber em CANVAS_MAX_PX
    function reducaoEscala(S, artPx) {
      var melhor = 1;
      if (artPx * S * S <= CANVAS_MAX_PX) return 1;
      for (var dd = 2; S / dd >= 2; dd++) {
        if (S % dd || !SP.escalaMoldeCompativel(S, S / dd)) continue;
        melhor = dd;
        if (artPx * (S / dd) * (S / dd) <= CANVAS_MAX_PX) break;
      }
      return melhor;
    }

    // ---- layout: o canvas ocupa a altura que sobra na tela (sem rolagem), escala inteira
    // lugar da faixa do Dado (decideLugarDado): o Dado da decisão e se a faixa fica no pé da pista; e o da faixa do
    // lugar na chegada (decideLugarFaixa): decidida ou não, e a caixa dela
    var lugarDado = { item: null, embaixo: false }, lugarFaixa = { decidida: false, embaixo: false, caixa: null };
    function layout() {
      var r = dpr();
      // as decisões do lugar das faixas grandes valem para este layout: girar ou redimensionar no meio de um Dado (ou
      // com a faixa do lugar na tela) muda artH e hudH, e o próximo quadro decide de novo
      lugarDado.item = null; lugarFaixa.decidida = false;
      var cssW = palco.clientWidth || 360;
      // tela baixa (< 700 px): a faixa de ordem só com a linha dos corredores e a narração com 1 frase em 1 linha
      // (spec 3c §4 e §5: senão, a 360×640, a pista cai no layout compacto)
      var baixa = (window.innerHeight || 700) < 700;
      if (baixa) tela.classList.add('tela--baixa'); else tela.classList.remove('tela--baixa');
      if (hud.feed) hud.feed.style.height = '';
      var other = tela.getBoundingClientRect().height - palco.getBoundingClientRect().height;
      var cs = appEl ? getComputedStyle(appEl) : null;
      var padY = cs ? (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) : 16;
      var cssH = Math.max(150, (window.innerHeight || 700) - padY - other);
      // a grade da corrida: s pixels do aparelho por pixel de arte, a mesma regra da interface (aplicaGrade: pelo menos
      // 240 de largura e 300 de altura da janela em pixels de arte), e a cena com a largura e a altura que sobram
      var sTela = Math.max(1, Math.min(Math.floor(cssW * r / 240), Math.floor((window.innerHeight || 700) * r / 300)));
      var artW = Math.floor(cssW * r / sTela), artH = Math.floor(cssH * r / sTela);
      var compact = artH < 190;
      var mini = compact ? null : miniCaixa(artW);
      var hudH = compact ? 15 : Math.max(20 + n, mini.y + mini.h + 2);
      // embaixo da pista, o capim do primeiro plano (drawTrackFront): 22 de arte, 8 de cima do teto do topo (a altura da
      // cena fica a mesma quando o topo está no teto)
      var bottom = compact ? 8 : 22;
      var minTop = hudH + (compact ? 12 : 30);
      var lane = clamp(Math.floor((artH - bottom - minTop) / n), compact ? 12 : 13, 26);
      var top = Math.max(minTop, Math.min(artH - bottom - n * lane, minTop + 62));
      var pick = {
        k: sTela, S: sTela, artW: artW, artH: top + n * lane + bottom, laneArt: lane, laneTopArt: top, hudH: hudH, compact: compact, mini: mini,
        maxLift: clamp(top - hudH - 12, 4, 24),   // a subida não invade o HUD
        // arco da curva: o cavalo da raia 1 (pés em top + lane − 3, sprite de FOOT_Y + 1 de altura) não sai
        // por cima do canvas; só o layout compacto (raias de 12) fica abaixo dos 6 px de arte
        arcoK: clamp(top + lane - 3 - (SP.FOOT_Y + 1), 0, FX.CURVA.tela) / FX.CURVA.tela
      };
      self.S = 1; self.sTela = sTela; self.lay = pick; pick.reducao = 1;
      // nome da skill dos balões em duas linhas só quando o balão alto (BALAO.h2) cabe na raia com a folga de cima (2)
      // e de baixo (1); senão o nome curto numa linha (spec 3c §5)
      self.linhasBalao = pick.laneArt >= FX.BALAO.h2 + 3 ? 2 : 1;
      self.W = pick.artW; self.H = pick.artH;
      buf.width = self.W; buf.height = self.H;
      ctx.imageSmoothingEnabled = false;
      cv.width = self.W * sTela; cv.height = self.H * sTela;
      cv.style.width = (self.W * sTela / r) + 'px';
      cv.style.height = (self.H * sTela / r) + 'px';
      palco.style.height = (self.H * sTela / r) + 'px';
      vctx.imageSmoothingEnabled = false;
      self.ppmArt = PPM_ARTE;   // guia §8a: 12 px de arte por metro (era 2 a 2,5)
      // a narração ocupa a altura que sobrar (campos pequenos): nada de faixa vazia sob os botões. Só aqui (no
      // redimensionar) a altura dela muda: durante a corrida, a faixa de ordem e a narração têm altura fixa
      if (!baixa && hud.feed && getComputedStyle(hud.feed).display !== 'none') {
        var rest = (window.innerHeight || 700) - padY - tela.getBoundingClientRect().height;
        if (rest > 8) hud.feed.style.height = Math.floor(hud.feed.getBoundingClientRect().height + rest - 4) + 'px';
      }
      ajustaFeed();
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

    // rastro de elemento: vem da linha do tempo (skill e Garra); mais forte nos primeiros 1,5 s reais
    function boostIntensity(j, t) {
      var best = 0;
      for (var b = 0; b < efeitoItens.length; b++) {
        var B = efeitoItens[b];
        if (B.racer !== j || t < B.t0 || t > B.t1) continue;
        var e = B.escala || 1, age = t - B.t0, left = B.t1 - t;
        var v = Math.min(1, age / (0.3 * e)) * (age < FX.BALAO.dur * e ? 1 : 0.65) * Math.min(1, left / (0.6 * e) + 0.2);
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
        return '<li class="tipo-' + esc(e.type) + (mine ? ' voce' : '') + '"><time>' + fmtClock(e.t) + '</time>' + chip + '<span>' + eventoHtml(e.text, e.type) + '</span></li>';
      }).join(''));
      ajustaFeed();
      if (ev.racer === me && (ev.type === 'chegada' || ev.type === 'garra' || ev.type === 'skill')) hud.anuncio.textContent = ev.text;
      if (ev.type === 'clima') climaNoPainel(hud.clima, ev.weather);
      if (ev.type === 'dado' && ev.changed && GD.WEATHERS[ev.weather]) {
        // virada de clima: o leitor de tela ouve no #anuncio e a pista ganha um clarão leve (na pista, a faixa do Dado
        // já diz o efeito na linha 2: a faixa "CLIMA: X" que vinha depois saiu, spec 3c §6)
        hud.anuncio.textContent = 'O clima virou: ' + GD.WEATHERS[ev.weather].name + '.';
        if (!reduced()) self.flash = Math.max(self.flash, 0.12);
      }
    }

    // a narração tem altura fixa e cada frase até 2 linhas: mostra as mais novas que cabem inteiras (a que ficaria
    // cortada embaixo some, e as mais velhas com ela). Roda a cada frase nova e no layout, nunca a cada quadro.
    function ajustaFeed() {
      var feed = hud.feed;
      if (!feed) return;
      var lis = feed.children, alt = feed.clientHeight, corta = false;
      for (var q = 0; q < lis.length; q++) lis[q].hidden = false;
      for (q = 0; q < lis.length; q++) {
        if (!corta && q > 0 && lis[q].offsetTop + lis[q].offsetHeight > alt) corta = true;
        if (corta) lis[q].hidden = true;
      }
    }

    // ---- faixa de ordem (spec 3c §4): a mesma ordem do painel do topo, ranking(st, simT) do quadro que a pista
    // mostra (quem já cruzou fica no lugar de chegada; na contagem, a ordem das raias). Nada é reescrito a cada
    // quadro: a lista só quando a ordem muda e no máximo a cada 250 ms; a linha dos vizinhos a cada 500 ms.
    var ORDEM_MS = 250, VIZ_MS = 500, ordemT = -1e9, vizT = -1e9;
    self.ordemEscritas = 0; self.ordemAtual = null; self.quadro = null;
    function mesmaOrdem(a, b) {
      if (!a || !b || a.length !== b.length) return false;
      for (var q = 0; q < a.length; q++) if (a[q] !== b[q]) return false;
      return true;
    }
    function vizinhoHtml(rot, j, m) {
      // os espaços ficam dentro dos spans (o texto lido segue "À frente: Nome +3 m"); na tela, o espaço é o gap do flex
      return '<span class="viz"><span class="viz-rot">' + esc(rot + ' ') + '</span><b class="viz-nome">' + esc(nomeDoCorredor(L.racers[j])) +
        '</b><span class="viz-m">' + esc(' ' + m) + '</span></span>';
    }
    // distância em metros inteiros ("+3 m", "−4 m"); arredondada a 0, "colado" ("+0 m" lê como defeito)
    function metrosTxt(sinal, d) {
      var m = Math.max(0, Math.round(d));
      return m === 0 ? 'colado' : sinal + m + ' m';
    }
    // números do Dado na faixa de ordem (spec 3c §6): com o Dado ativo e revelado (dItem; enquanto os dados giram,
    // null), cada item mostra o best do corredor (embaixo do selo; em tela baixa, no lugar da posição) e o do vencedor
    // ganha .ordem-item--maior; fora disso, nada. Escritos só quando esse estado muda (revelação, fim ou outro Dado),
    // quando a lista é reescrita durante ele ou quando a tela vira baixa/normal no meio dele — nunca a cada quadro (e
    // fora de ordemEscritas, que conta as reescritas da lista)
    var dadoMostrado = null, dadoBaixa = false;
    function marcaDado(dItem, baixa) {
      var lis = hud.ordem.children;
      for (var q = 0; q < lis.length; q++) {
        var li = lis[q], j = Number(li.getAttribute('data-raia')), num = dItem ? '<span class="sr">dado </span>' + esc(String(dItem.rolls[j].best)) : '';
        li.querySelector('.ordem-dado').innerHTML = baixa ? '' : num;
        // em tela baixa o número fica no lugar da posição; a posição continua para o leitor de tela (.sr)
        if (baixa || dadoBaixa) li.querySelector('.ordem-pos').innerHTML = dItem && baixa ? '<span class="sr">' + (q + 1) + 'º </span>' + num : ordFix('>' + (q + 1) + 'º<').slice(1, -1);   // ordFix só troca o º entre tags
        li.classList.toggle('ordem-item--maior', !!dItem && j === dItem.winner);
      }
      dadoMostrado = dItem; dadoBaixa = baixa;
    }
    function atualizaOrdem(order, st, dItem) {
      self.quadro = { order: order, pos: st.pos };
      var agora = window.performance.now(), escreveu = false;
      if (!mesmaOrdem(order, self.ordemAtual) && agora - ordemT >= ORDEM_MS) {
        ordemT = agora; escreveu = true;
        self.ordemAtual = order.slice();
        self.ordemEscritas++;
        hud.ordem.innerHTML = ordFix(order.map(function (j, k) {
          var r = L.racers[j];
          return '<li class="ordem-item' + (r.isPlayer ? ' ordem-item--voce' : '') + '" data-raia="' + j + '">' +
            '<span class="ordem-pos">' + (k + 1) + 'º</span>' + laneChip(r, j, 'raia--mini') + '<span class="ordem-dado"></span>' +
            '<span class="sr">' + esc(nomeDoCorredor(r) + (r.isPlayer ? ' (você)' : '')) + '</span></li>';
        }).join(''));
      }
      var baixa = tela.classList.contains('tela--baixa');
      if (escreveu ? !!(dItem || dadoMostrado) : dItem !== dadoMostrado || (!!dItem && baixa !== dadoBaixa)) marcaDado(dItem, baixa);
      if (agora - vizT < VIZ_MS) return;
      vizT = agora;
      var html;
      if (self.phase === 'contagem') html = esc('Largada em instantes');
      else if (self.crossed) html = ordFix('<span>' + esc('Você chegou em ' + (rankOf[me] + 1) + 'º') + '</span>');
      else {
        var mostrada = self.ordemAtual || order, k = mostrada.indexOf(me), partes = [];
        var frente = k > 0 ? mostrada[k - 1] : -1, atras = k < n - 1 ? mostrada[k + 1] : -1;
        if (frente < 0) partes.push('<span class="viz"><span class="viz-rot">Você lidera</span></span>');
        else partes.push(vizinhoHtml('À frente:', frente, metrosTxt('+', st.pos[frente] - st.pos[me])));
        if (atras >= 0) partes.push(vizinhoHtml('Atrás:', atras, metrosTxt('−', st.pos[me] - st.pos[atras])));
        html = partes.join('<span class="viz-sep"> · </span>');
      }
      hud.vizinhos.innerHTML = html;
    }

    // ---- desenho em pixels de arte (A = escala)
    function box(x, y, w, h, bg, border) {
      if (border) borda(x, y, w, h, border);
      ctx.fillStyle = bg; ctx.fillRect(x * self.S, y * self.S, w * self.S, h * self.S);
    }
    // borda de 1 pixel de arte por fora da caixa (x, y, w, h), sem os cantos
    function borda(x, y, w, h, cor) {
      var S = self.S;
      ctx.fillStyle = cor; ctx.fillRect(x * S, (y - 1) * S, w * S, S); ctx.fillRect(x * S, (y + h) * S, w * S, S); ctx.fillRect((x - 1) * S, y * S, S, h * S); ctx.fillRect((x + w) * S, y * S, S, h * S);
    }
    // caixa do painel do topo (spec 3c §5, as caixas da 3a): contorno --sombra por fora, friso opcional entre a caixa e o
    // contorno (o ouro da posição) e bisel de 1 pixel de arte, claro em cima (--brilho-08) e escuro embaixo (--escuro-25)
    function caixaPainel(x, y, w, h, bg, friso) {
      var S = self.S;
      if (friso) { borda(x - 1, y - 1, w + 2, h + 2, C.sombra); box(x, y, w, h, bg, friso); } else box(x, y, w, h, bg, C.sombra);
      // bisel na mestra, sem alfa (guia §3 e a amostra): luz de cima na cor da linha, sombra embaixo
      ctx.fillStyle = C.linha; ctx.fillRect(x * S, y * S, w * S, S);
      ctx.fillStyle = C.sombra; ctx.fillRect(x * S, (y + h - 1) * S, w * S, S);
    }
    // volatil: texto que muda quase a cada quadro (relógio, km/h, distâncias), pintado fora do cache de texto
    // a fonte do texto da corrida (etapa 2.2 da direção de arte): 'g7', 'g9' ou 'g11' (Galmuri no tamanho nativo); um
    // número é a escala antiga da fonte 3×5 — 1 vira a Galmuri7, 2 a Galmuri11 Bold, 3 ou mais continua a 3×5 ampliada
    // (os números grandes da contagem, que são desenho, não letra)
    function fonteDe(f) { return typeof f === 'string' ? f : (f || 1) >= 3 ? null : (f === 2 ? 'g11' : 'g7'); }
    function text(str, x, y, color, f, align, shadow, volatil) {
      var fo = fonteDe(f);
      return SP.drawText(ctx, str, x * self.S, y * self.S, { fonte: fo, scale: fo ? self.S : (f || 1) * self.S, color: color, align: align, shadow: shadow, volatil: volatil });
    }
    function tw(str, f) { var fo = fonteDe(f); return fo ? SP.measureText(str, 1, fo) : SP.measureText(str, f || 1); }
    function digitColor(silk) { return hexLum(silk) > 0.5 ? C.tinta : C.texto; }

    // HUD no céu (guia §8, a amostra aprovada): placas de 20 pixels de arte, o lugar em Galmuri11 Bold, rótulos em
    // Galmuri7 e os números em Galmuri9; o minimapa embaixo do lugar
    var HUD_Y = 3, HUD_H = 20;
    function drawHud(st, order) {
      var lay = self.lay, A = lay.artW, y = HUD_Y, h = lay.compact ? 14 : HUD_H;
      // posição
      var place = order.indexOf(me) + 1;
      var big = self.phase === 'contagem' ? '—' : String(place) + 'º';
      var small = '/' + n;
      var bw = tw(big, 'g11') + tw(small, 'g7') + 9;
      caixaPainel(3, y, bw, h, C.painel, C.ouro);
      text(big, 7, y + Math.floor((h - 11) / 2), C.ouro, 'g11', null, C.sombra);
      text(small, 7 + tw(big, 'g11') + 1, y + h - 10, C.texto, 'g7');
      // estamina: 12 segmentos (ou o que couber)
      var sx = 3 + bw + 5, segs = clamp(Math.floor((A * 0.28 - 8) / 4), 8, 12), barW = segs * 4 - 1;
      var stam = clamp(st.stamina[me], 0, 1);
      caixaPainel(sx, y, barW + 8, h, C.painel);
      if (!lay.compact) text('EST', sx + 4, y + 3, C.texto2, 'g7');
      var col = stam > 0.5 ? C.ganho : stam > 0.25 ? C.ouro : C.perda;
      var on = Math.round(stam * segs);
      for (var s = 0; s < segs; s++) {
        ctx.fillStyle = s < on ? col : C.sombra;
        ctx.fillRect((sx + 4 + s * 4) * self.S, (y + h - 8) * self.S, 3 * self.S, 5 * self.S);
      }
      // tempo e velocidade (relógio da corrida)
      var tShown = Math.min(self.simT, fTime[me]);
      var tTxt = fmtClock(tShown), kmh = Math.round(st.speed[me] * 3.6) + ' KM/H';
      var tw2 = Math.max(tw('0:00,0', 'g9'), tw(tTxt, 'g9'), tw(kmh, 'g7'), tw('00 KM/H', 'g7')) + 8, tx = A - 3 - tw2;
      caixaPainel(tx, y, tw2, h, C.painel);
      if (lay.compact) text(tTxt, A - 7, y + 3, C.texto, 'g9', 'right', null, true);
      else {
        text(tTxt, A - 7, y + 2, C.texto, 'g9', 'right', null, true);
        text(kmh, A - 7, y + 12, C.texto2, 'g7', 'right', null, true);
      }
      // clima atual (vira com o Dado da Sorte), à esquerda do relógio; no layout compacto
      // não há espaço (a CURVA/SUBIDA fica ali) e o cabeçalho da tela mostra o clima
      var wName = GD.WEATHERS[climaMostrado(self.simT)].name.toUpperCase();
      var ww = Math.max(tw('CLIMA', 'g7'), tw(wName, 'g7')) + 8, wx = tx - 4 - ww;
      var livre = sx + barW + 8 + 4, climaVisivel = !lay.compact && wx > livre;
      if (climaVisivel) {
        caixaPainel(wx, y, ww, h, C.painel);
        text('CLIMA', wx + 4, y + 3, C.texto2, 'g7');
        text(wName, wx + 4, y + 12, C.texto, 'g7');
      }
      // vento (só visual) à esquerda do clima: "VENTO / BRISA →"; sem espaço, ou no layout compacto (onde
      // o selo CURVA/SUBIDA ocupa o lugar do clima), só o ícone: seta (traço no calmo) e 1–3 barrinhas
      var vw = self.wind, vNome = ventoTxt(vw).toUpperCase(), dir0 = climaVisivel ? wx : tx;
      var vbw = Math.max(tw('VENTO', 'g7'), tw(vNome, 'g7')) + 8, vx = dir0 - 4 - vbw;
      if (!lay.compact && vx > livre) {
        caixaPainel(vx, y, vbw, h, C.painel);
        text('VENTO', vx + 4, y + 3, C.texto2, 'g7');
        text(vNome, vx + 4, y + 12, C.texto, 'g7');
        FX._stats.ventoHud = 'texto';
      } else {
        var reserva = lay.compact ? Math.max(tw('\u25b2SUBIDA', 'g7'), tw('CURVA', 'g7')) + 8 + 4 : 0;
        var iw = 14, ix = dir0 - 4 - reserva - iw;
        if (ix > livre) {
          caixaPainel(ix, y, iw, h, C.painel);
          var seta = vw.intensity === 'calmo' ? '\u2013' : vw.dir > 0 ? '\u2192' : '\u2190';
          text(seta, ix + Math.round((iw - tw(seta, 'g7')) / 2), y + 2, C.texto, 'g7');
          var nivel = ['calmo', 'brisa', 'ventania'].indexOf(vw.intensity) + 1;
          for (var vb = 0; vb < 3; vb++) {
            ctx.fillStyle = vb < nivel ? C.texto : C.sombra;
            ctx.fillRect((ix + 3 + vb * 3) * self.S, (y + h - 4 - vb * 2) * self.S, 2 * self.S, (vb * 2 + 2) * self.S);
          }
          FX._stats.ventoHud = 'icone';
        }
      }
      // tipo do bloco do jogador: SUBIDA ou CURVA (nada na reta)
      var bType = blocks[RS.blockAt(blocks, st.pos[me])].type;
      var lbl = bType === 'subida' ? '▲SUBIDA' : bType === 'curva' ? 'CURVA' : '';   // a Galmuri não tem o ↪
      var mc = lay.mini;
      if (lbl && self.phase !== 'contagem') {
        var lw = tw(lbl, 'g7') + 6;
        var hy = lay.compact ? y + 2 : mc.y + 1;
        var hx = lay.compact ? tx - 4 - lw : mc.x + mc.w + 4;
        caixaPainel(hx, hy, lw, 11, bType === 'curva' ? GD.BLOCK_TYPES.curva.color : C.ouro);
        text(lbl, hx + 3, hy + 2, C.tinta, 'g7');
      }
      if (lay.compact) return;
      // minimapa: o traçado visto de cima (curvas na cor da curva, subidas em ouro, retas na cor do piso) com
      // um ponto por cavalo na cor da raia; o seu é maior, com contorno claro, e vem por cima
      caixaPainel(mc.x, mc.y, mc.w, mc.h, C.painel);
      FX.drawMiniMap(ctx, mapa, st.pos, silksCores, me, { x: mc.x, y: mc.y, w: mc.w, h: mc.h, P: self.S, piso: pisoCor });
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
      // o arco das curvas é preso à tela (RaceFx.curveOffsetTela): o meio da tela e a meia largura, em metros
      self.camTela = { c: cam + visM / 2, meia: visM / 2 };
      var laneH = lay.laneArt * S, laneTop = lay.laneTopArt * S;
      var tr = self.tReal, red = reduced();
      var clima = climaMostrado(self.simT);
      FX._stats.climaPista = clima;   // para o ui-test: o clima desenhado na pista neste quadro
      // em reduced nada congela: o cenário (nuvens, torcida, bandeiras, grama) anda a 40 % e a natureza
      // (fx.js) recebe o tempo real com a marca reduced (chuva a 40 %, metade dos pingos, sem relâmpago)
      SP.drawTrack(ctx, {
        width: W, height: H, cameraX: cam, pxPerMeter: ppm, lanes: n, laneTop: laneTop, laneH: laneH,
        surface: L.cond.surface, finishM: D, hills: hills, curves: curves, distanceMarkersEvery: D <= 1000 ? 100 : 200,
        t: red ? tr * 0.4 : tr, weather: clima, pixel: S, highlightLane: me, hillMaxLift: lay.maxLift, wind: self.wind,
        curveScale: lay.arcoK, regiao: regiaoDaPista(L)
      });
      // natureza, camada de trás (calor, respingos, névoa do fundo): antes dos cavalos. lift acompanha o
      // relevo das subidas e o arco das curvas (os respingos e o calor ficam no chão levantado)
      var natO = {
        weather: clima, wind: self.wind, t: tr, W: W, H: H, P: S, laneTop: laneTop, trackBottom: laneTop + n * laneH,
        reduced: red, seed: L.seed, cam: cam * ppm, camada: 'tras', surface: L.cond.surface,
        paleta: !!SP.regiaoPronta(regiaoDaPista(L)),   // cenário da região: o clima já está na paleta, sem véus translúcidos
        lift: hills.length || curves.length ? function (px) { var m = cam + px / ppm; return (SP.hillLiftAt(m, hills, lay.maxLift) + arcoArt(m)) * S; } : null
      };
      FX.drawNature(ctx, natO);
      var poeira = clima !== 'chuva' && (L.cond.surface === 'terra' || L.cond.surface === 'areia');
      var tagsR = [], tagsL = [], badges = [], youTag = null, vis = [];
      for (var j = 0; j < n; j++) {
        var r = L.racers[j];
        var standing = self.phase === 'contagem' || st.speed[j] < 0.4;
        // âncoras do sprite por código ou do molde (convertidas): o focinho é sempre o mesmo NOSE
        var an = SP.anchorsFor(r.horse.element, S, standing ? 'parado' : 'galope', visuais[j].porte);
        var hoofM = st.pos[j] - (an.nose[0] - 20) / self.ppmArt;
        var lift = SP.hillLiftAt ? SP.hillLiftAt(hoofM, hills, lay.maxLift) * S : 0;
        // na curva a raia sobe com a cerca (RaceFx.curveOffset no meio do cavalo, como as colunas da pista)
        var arcoJ = arcoArt(hoofM);
        var feetY = laneTop + (j + 1) * laneH - 3 * S - lift - arcoJ * S;
        var y = feetY - (SP.FOOT_Y + 1) * S;
        var x = Math.round(((st.pos[j] - cam) * ppm - an.nose[0] * S) / S) * S;
        var cavalo = comVisuais({
          // fase contínua do galope: o código usa o quadro inteiro; o molde mapeia o ciclo (mesma duração)
          palette: r.horse.palette, element: r.horse.element, frame: self.gallop[j],
          scale: S, silks: r.silks, t: tr, idle: standing
        }, visuais[j]);
        cavalo.reduzido = red;
        // caixa do que vai ser desenhado (molde ou código): o corte nas bordas e o monitor de câmera usam ela,
        // então a cauda do molde (que passa do x do sprite) não some de uma vez na borda
        var caixaCav = SP.horseBox(x, y, cavalo);
        if (j === me) self.playerRect = { x: caixaCav.x, y: caixaCav.y, w: caixaCav.w, h: caixaCav.h, W: W, H: H };
        // fora da tela: a seta (layoutTags) com o meio na altura do corpo do cavalo
        if (caixaCav.x > W - 2 * S) { tagsR.push({ j: j, y: feetY - 20 * S }); continue; }
        if (caixaCav.x + caixaCav.w < 2 * S) { tagsL.push({ j: j, y: feetY - 20 * S }); continue; }
        // aura da skill de tipo enquanto o cavalo está no terço dela (antes do anel e do cavalo: não cobre nada);
        // relógio = segundos de apresentação (simT / ts), deslocado por raia
        if (self.phase !== 'contagem' && FX.typeZone(tipoTerco[j], st.pos[j]) != null &&
            FX.drawTypeAura(ctx, tipoTerco[j].el, x, y, S, self.simT / ts + j * 0.37, red)) {
          FX._stats.tipoAuras.push({ racer: j, element: tipoTerco[j].el });
        }
        if (j === me) {
          // anel dourado no chão sob os cascos do jogador
          var ry = feetY - 2 * S;
          ctx.fillStyle = C.ouro;
          ctx.fillRect(x + 11 * S, ry - S, 18 * S, S); ctx.fillRect(x + 11 * S, ry + 2 * S, 18 * S, S);
          ctx.fillRect(x + 8 * S, ry, 3 * S, 2 * S); ctx.fillRect(x + 29 * S, ry, 3 * S, 2 * S);
        }
        var inten = standing ? 0 : boostIntensity(j, self.simT);
        if (inten > 0.02) SP.drawTrail(ctx, x + an.rear[0] * S, y + an.rear[1] * S, r.horse.element, tr + j * 0.31, inten, S);
        // poeira dos cascos em terra ou areia (fora da chuva), atrás do cavalo
        if (poeira && !standing) FX.drawHoofDust(ctx, x + an.rear[0] * S, feetY, S, tr + j * 0.37, L.cond.surface, red);
        if (lift > 0 && !standing && !reduced()) {
          // poeira levantada na subida
          var dp = Math.floor(tr * 10 + j) % 3;
          ctx.fillStyle = '#ab947a';
          ctx.fillRect(x + (4 - dp) * S, feetY - (2 + dp) * S, 2 * S, S);
          ctx.fillRect(x + (1 + dp) * S, feetY - 4 * S, S, S);
        }
        // contorno da silhueta (skill / Garra) atrás do cavalo: o de brilho mais forte, na cor do elemento
        var gl = null;
        for (var gi = 0; gi < efeitoItens.length; gi++) {
          if (efeitoItens[gi].racer !== j) continue;
          var g1 = FX.glow(efeitoItens[gi], self.simT, reduced());
          if (g1 && (!gl || g1.alpha > gl.alpha)) gl = g1;
        }
        if (gl) SP.drawHorseSilhouette(ctx, x, y, cavalo, gl.cor, gl.alpha);
        SP.drawHorse(ctx, x, y, cavalo);
        FX._stats.caixasCavalos.push({ racer: j, x: Math.round(caixaCav.x / S), y: Math.round(caixaCav.y / S), w: Math.round(caixaCav.w / S), h: Math.round(caixaCav.h / S), arco: arcoJ });
        // vento, "+" e faíscas da skill / Garra no próprio cavalo (fx.js)
        for (var ei = 0; ei < efeitoItens.length; ei++) {
          if (efeitoItens[ei].racer === j) FX.drawSkillAura(ctx, { x: caixaCav.x, y: caixaCav.y, w: caixaCav.w, h: caixaCav.h, S: S }, efeitoItens[ei], self.simT, reduced());
        }
        vis.push({ j: j, x: x, y: y, caixa: caixaCav, an: an, sobe: Math.round(lift / S) + arcoJ });
        var finished = fTime[j] <= self.simT;
        if (j === me) youTag = { x: x + (an.nose[0] + 3) * S, y: y + 3 * S, place: finished ? rankOf[j] + 1 : 0 };
        else if (finished) badges.push({ x: x + 22 * S, y: y - 2 * S, j: j, place: rankOf[j] + 1 });
      }
      // primeiro plano da região (capim, paralaxe 1,25) por cima dos cavalos, abaixo das etiquetas
      SP.drawTrackFront(ctx);
      // segunda passada: etiquetas por cima de todos os cavalos
      badges.forEach(function (b) {
        var t = b.place + 'º', w = tw(t) + 3;   // Galmuri7: 7 da maiúscula, 1 de folga em cima (o º sobe 1) e embaixo
        var bx = Math.round(b.x / S) - Math.round(w / 2), by = Math.round(b.y / S) - 9;
        box(bx, by, w, 9, L.racers[b.j].silks, C.sombra);
        text(t, bx + 2, by + 1, digitColor(L.racers[b.j].silks));
      });
      if (youTag) {
        var yb = youTagBox(youTag);
        box(yb.x, yb.y, yb.w, YOU_H, C.painel, C.ouro);
        text(yb.txt, yb.x + 2, yb.y + 3, C.ouro);   // 2 de acento (o Ê) e 1 de folga acima da maiúscula
      }
      // Dado ativo e a caixa da faixa dele, uma vez por quadro: a faixa, as plaquinhas, as etiquetas e os balões usam
      // a mesma. Com a etiqueta "FOTO DE CHEGADA" na tela, a faixa do Dado não é desenhada
      var dItem = self.phase === 'contagem' ? null : dadoAtivo(self.simT), dCaixa = null;
      var foto = self.finishCam || (self.phase !== 'contagem' && Math.abs(self.simT - tWin) < 0.6);
      // a faixa do lugar fica LUGAR_S s depois de o jogador cruzar a linha; a caixa dela é decidida uma vez (Ruling 14).
      // Um Dado que começa com ela na tela evita a caixa dela; ela, a do Dado que já estava na tela
      var lugarNaTela = !!self.lugar && self.tReal < self.lugar.ate;
      var lCaixa = lugarNaTela && lugarFaixa.decidida ? lugarFaixa.caixa : null;
      if (dItem) { decideLugarDado(dItem, vis, lCaixa ? [lCaixa] : null); dCaixa = FX.bannerLayout(dItem, L.racers, lay, me, lugarDado.embaixo); }
      if (lugarNaTela) { if (!lugarFaixa.decidida) decideLugarFaixa(vis, youTag, dCaixa); lCaixa = lugarFaixa.caixa; }
      // com uma faixa grande em cima (a do Dado ou a do lugar), as etiquetas de quem está fora da tela ficam abaixo dela
      var tagsTopo = null;
      if (dCaixa && !foto && !lugarDado.embaixo) tagsTopo = dCaixa.y + dCaixa.h + 2;
      if (lCaixa && !lugarFaixa.embaixo) tagsTopo = Math.max(tagsTopo || 0, lCaixa.y + lCaixa.h + 2);
      var tagsObst = [dCaixa && lugarDado.embaixo ? dCaixa : null, lCaixa && lugarFaixa.embaixo ? lCaixa : null];
      layoutTags(tagsR, true, tagsTopo, tagsObst); layoutTags(tagsL, false, tagsTopo, tagsObst);
      // natureza, camada da frente (véu, pingos, relâmpago, sol, sombras, folhas) e a névoa da frente
      natO.camada = 'frente';
      FX.drawNature(ctx, natO);
      FX.drawFogFront(ctx, natO);
      if (self.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * self.flash / 0.3).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      self.voceRect = null;
      if (dItem) drawDadosNaPista(dItem, vis, youTag, dCaixa);
      drawHud(st, order);
      if (foto) {
        var bt = 'FOTO DE CHEGADA', bw = tw(bt) + 5, bx2 = Math.round(lay.artW / 2 - bw / 2), by2 = lay.hudH + 3;
        box(bx2, by2, bw, 11, C.sombra, C.ouro);
        text(bt, bx2 + 3, by2 + 2, C.ouro);
      } else if (dItem) {
        FX.drawDiceBanner(ctx, dItem, L.racers, lay, S, self.simT, reduced(), me, lugarDado.embaixo, dCaixa);
      }
      if (lCaixa) FX.drawPlaceBanner(ctx, lCaixa, self.lugar.cor, S);
      if (self.phase !== 'contagem') drawSkillsNaPista(vis, youTag, dItem, dCaixa, foto, lCaixa);
      if (self.phase === 'contagem') {
        var c = Math.ceil(self.count / (reduced() ? 0.4 : 0.8));
        var label = c >= 3 ? '3' : c === 2 ? '2' : c === 1 ? '1' : 'JÁ!';
        // Galmuri14 (maiúscula de 14, guia §6: título maior numa fonte maior, nunca ampliada); 4 de acento (o Á) em cima
        var cw = tw(label, 'g14');
        var cy = lay.laneTopArt + Math.round((n * lay.laneArt) / 2) - 7;
        var cx = Math.round(lay.artW / 2);
        box(cx - Math.round(cw / 2) - 5, cy - 7, cw + 11, 7 + 14 + 6, C.painel, C.ouro);
        text(label, cx, cy, C.ouro, 'g14', 'center', C.sombra);
      }
    }

    // Faixa grande no centro com o nome da skill do jogador (1,5·escala cada; duas ao mesmo tempo entram em
    // sequência) e balões de skill / Garra / cansou presos à raia de cada cavalo: à frente do focinho (do
    // "◀VOCÊ", no jogador), na altura do jóquei e dentro da faixa vertical da própria raia. O balão mais novo
    // tem texto; até 2 mais antigos viram chip + ícone, crescendo para a frente.
    var faixasJogador = [];
    (function () {
      var fim = -1e9;
      balaoItens.forEach(function (it) {
        if (it.kind !== 'skill' || it.racer !== me || !it.nome) return;
        var a0 = Math.max(it.t0, fim);
        fim = a0 + FX.BALAO.dur * it.escala;
        faixasJogador.push({ item: it, a: a0, b: fim });
      });
    })();
    function drawSkillsNaPista(vis, youTag, dItem, dCaixa, topoOcupado, lCaixa) {
      var S = self.S, lay = self.lay, t = self.simT, k;
      var faixa = null, fx0 = null;
      for (k = 0; k < faixasJogador.length; k++) if (t >= faixasJogador[k].a && t < faixasJogador[k].b) fx0 = faixasJogador[k];
      if (fx0) {
        var ft = fx0.item.nome.toUpperCase() + '!', skId = FX.iconNameOf(fx0.item);
        var bl = FX.skillBannerLayout(ft, lay.artW, S, !!FX.iconImage(skId), tw), fs = bl.fs, fw = bl.w, fh = bl.h;
        var fxx = bl.x, fyy = lay.hudH + (lay.compact ? 3 : 12) + (topoOcupado ? 17 : 0);
        // com o Dado na pista, logo abaixo da faixa dele
        if (dItem && !lugarDado.embaixo) fyy = Math.max(fyy, dCaixa.y + dCaixa.h + 2);
        // com a faixa do lugar em cima, logo abaixo dela
        if (lCaixa && !lugarFaixa.embaixo) fyy = Math.max(fyy, lCaixa.y + lCaixa.h + 2);
        var esc0 = (t - fx0.a) / fx0.item.escala, af = esc0 > FX.BALAO.dur - 0.3 ? Math.max(0, (FX.BALAO.dur - esc0) / 0.3) : 1;
        var cor = ({ fogo: C.fogo, agua: C.agua, grama: C.ganho })[fx0.item.element] || C.ouro;
        ctx.globalAlpha = af;
        box(fxx, fyy, fw, fh, C.painel, cor);
        if (bl.icone) FX.drawIconPng(ctx, skId, bl.iconX * S, (fyy + bl.iconDy) * S, 8, S);   // 1:1 (nada ampliado)
        text(ft, bl.textX, fyy + bl.textDy, C.texto, fs, 'center', C.sombra);
        ctx.globalAlpha = 1;
        faixa = { x: fxx - 1, y: fyy - 1, w: fw + 2, h: fh + 2 };
        FX._stats.faixaSkill = ft;
      }
      // balões ativos por cavalo visível: no máximo os 3 mais novos
      var porCavalo = {};
      for (k = 0; k < balaoItens.length; k++) {
        var it = balaoItens[k];
        if (t >= it.t0 && t < it.t0 + FX.BALAO.dur * it.escala) (porCavalo[it.racer] = porCavalo[it.racer] || []).push(it);
      }
      var obst = [];
      if (faixa) obst.push(faixa);
      if (lCaixa) obst.push(lCaixa);
      if (dItem) { obst.push(dCaixa); FX._stats.placas.forEach(function (p) { obst.push(p); }); }
      function bate(a, o) { return a.x < o.x + o.w + 1 && o.x < a.x + a.w + 1 && a.y < o.y + o.h + 1 && o.y < a.y + a.h + 1; }
      if (youTag && !self.voceRect) { var yb2 = youTagBox(youTag); self.voceRect = { x: yb2.x - 1, y: yb2.y - 1, w: yb2.w + 2, h: YOU_H + 2 }; }
      if (self.voceRect) obst.push(self.voceRect);
      vis.forEach(function (v) {
        var lista = porCavalo[v.j];
        if (!lista) return;
        lista = lista.slice(-3);
        // o nome da skill no balão mais novo: inteiro numa linha, ou em duas quando a raia comporta (self.linhasBalao)
        var novo = lista[lista.length - 1];
        var linhas = novo.kind === 'skill' ? FX.nomeEmLinhas(novo.nome, FX.BALAO.textoMax, self.linhasBalao, novo.nomeCurto) : null;
        var h0 = FX.balloonSize(novo, 0, linhas).h;
        var y0 = lay.laneTopArt + v.j * lay.laneArt - (v.sobe || 0), y1 = y0 + lay.laneArt;
        // na altura do jóquei (como o "◀VOCÊ"), mas sempre dentro da faixa da raia (o de duas linhas, que só existe em
        // raia de BALAO.h2 + 3 ou mais, pode subir até 2 px abaixo do topo dela)
        var by = Math.max(y0 + (h0 > 11 ? 2 : 3), Math.min(y1 - h0 - 1, Math.round(v.y / S) + 1));
        var bx;
        if (v.j === me && youTag) { var yb = youTagBox(youTag); bx = yb.x + yb.w + 4; }
        else bx = Math.round((v.x + (v.an.nose[0] + 3) * S) / S) + 4;
        var ant = null;
        for (var q = 0; q < lista.length; q++) {
          var item = lista[lista.length - 1 - q], sz = FX.balloonSize(item, q, q ? null : linhas);
          var r = { x: bx, y: by, w: sz.w, h: sz.h };
          // desvia para a frente do que estiver no caminho: faixas do topo, plaquinhas do Dado e a caixa dos
          // outros cavalos (a de um cavalo da raia de baixo invade a de cima em até ~17 px)
          var cavalos = vis.filter(function (o2) { return o2.j !== v.j; }).map(function (o2) {
            return { x: Math.round(o2.caixa.x / S), y: Math.round(o2.caixa.y / S), w: Math.round(o2.caixa.w / S), h: Math.round(o2.caixa.h / S) };
          });
          for (var passo = 0; passo < 3; passo++) {
            var movido = false;
            obst.concat(cavalos).forEach(function (ob) { if (bate(r, ob)) { r.x = ob.x + ob.w + 2; movido = true; } });
            if (!movido) break;
          }
          r.x = Math.max(0, Math.min(lay.artW - r.w, r.x));
          // preso à borda da direita (o cavalo da raia de baixo encostado nela), o balão pode voltar para cima do que
          // ele desviou: então vai para logo atrás do primeiro obstáculo que ainda bate, se ali estiver livre
          var todos = obst.concat(cavalos), ruim = null;
          for (var oi = 0; oi < todos.length && !ruim; oi++) if (bate(r, todos[oi])) ruim = todos[oi];
          if (ruim) {
            var tras = { x: ruim.x - r.w - 2, y: r.y, w: r.w, h: r.h };
            if (tras.x >= 0 && !todos.some(function (ob) { return bate(tras, ob); })) r.x = tras.x;
          }
          // preso à borda, um balão mais velho pode voltar para cima do anterior do mesmo cavalo (e cobrir o fim do nome
          // no de texto): então ele e os mais velhos ficam de fora
          if (ant && bate(r, ant)) break;
          if (FX.drawBalloon(ctx, r.x * S, r.y * S, S, item, t, q, q ? null : linhas)) {
            FX._stats.caixasBaloes.push({ racer: item.racer, kind: item.kind, tipo: !!item.typeSkill, texto: q ? '' : linhas ? linhas.join(' ') : (item.nomeCurto || ''), pilha: q, x: r.x, y: r.y, w: r.w, h: r.h, y0: y0, y1: y1 });
          }
          bx = r.x + r.w + 2; ant = r;
        }
      });
    }

    // faixa do lugar na chegada (spec 3c §7): texto e cor por lugar; fica LUGAR_S segundos de tempo real
    var LUGAR_S = 2.5;
    function faixaDoLugar(k) {
      if (k === 1) return { texto: 'VITÓRIA!', cor: C.ouro };
      return { texto: k + 'º LUGAR', cor: k === 2 ? C.prata : k === 3 ? C.bronze : C.texto };
    }

    // etiqueta "◀VOCÊ" (pixels de arte; caixa de 9 de altura, borda por fora): texto e posição
    var YOU_H = 11;   // a etiqueta "◀VOCÊ" (com o acento), em Galmuri7
    function youTagBox(yt) {
      var s = '◀VOCÊ' + (yt.place ? ' ' + yt.place + 'º' : ''), w = tw(s) + 3;
      return { txt: s, x: Math.min(Math.round(yt.x / self.S), self.lay.artW - w - 2), y: Math.round(yt.y / self.S) - 2, w: w };
    }

    // Lugar de uma faixa grande na pista (Rulings 11 e 14): em cima por padrão; se ali ela cobriria a caixa do cavalo do
    // jogador (ou um dos obstáculos obst, como outra faixa já na tela), no pé da pista. caixaDe(embaixo) dá a caixa da
    // faixa em cada posição. A caixa do cavalo vale para a janela [t0, t1] da simulação inteira: o sobe-e-desce dele
    // (subida e arco da curva, as mesmas contas do desenho) é medido nos quadros da simulação, com 1 px de folga (a câmera
    // segue o jogador, então o x não muda). Se as duas posições cobrirem algo, fica a que cobre menos (empate: em cima).
    // Devolve { embaixo, cavalo, sobe }, com cavalo e sobe null quando o jogador não está na tela (aí, em cima).
    function decideLugar(vis, t0, t1, caixaDe, obst) {
      var lay = self.lay, S = self.S, v = null, k;
      for (k = 0; k < vis.length; k++) if (vis[k].j === me) v = vis[k];
      if (!v) return { embaixo: false, cavalo: null, sobe: null };
      var sobeMin = v.sobe, sobeMax = v.sobe;
      for (var t = t0; t <= t1 + 1e-9; t += dt) {
        var hoof = sample(t).pos[me] - (v.an.nose[0] - 20) / self.ppmArt;
        var sobe = Math.round(SP.hillLiftAt ? SP.hillLiftAt(hoof, hills, lay.maxLift) : 0) + arcoArt(hoof);
        sobeMin = Math.min(sobeMin, sobe); sobeMax = Math.max(sobeMax, sobe);
      }
      // subir sobeMax − v.sobe leva o topo para cima; descer até sobeMin leva a base para baixo
      var c = { x: v.caixa.x / S, y: v.caixa.y / S - (sobeMax - v.sobe) - 1, w: v.caixa.w / S, h: v.caixa.h / S + (sobeMax - sobeMin) + 2 };
      function area(b, o) {
        var w = Math.min(b.x + b.w, o.x + o.w) - Math.max(b.x, o.x), h = Math.min(b.y + b.h, o.y + o.h) - Math.max(b.y, o.y);
        return w > 0 && h > 0 ? w * h : 0;
      }
      function cobre(b) {
        var a = area(b, c);
        for (var q = 0; obst && q < obst.length; q++) if (obst[q]) a += area(b, obst[q]);
        return a;
      }
      var cima = cobre(caixaDe(false));
      return { embaixo: cima > 0 && cobre(caixaDe(true)) < cima, cavalo: c, sobe: [sobeMin, sobeMax] };
    }
    // a faixa do Dado (Ruling 11): uma decisão por Dado, no 1º quadro em que ele fica ativo, na janela dele; não muda de
    // lugar até ele acabar (um layout novo esquece a decisão e o quadro seguinte decide de novo). obst = a faixa do lugar,
    // se estiver na tela
    function decideLugarDado(item, vis, obst) {
      if (lugarDado.item === item) return;
      var d = decideLugar(vis, item.t0, item.t1, function (emb) { return FX.bannerLayout(item, L.racers, self.lay, me, emb); }, obst);
      lugarDado.item = item; lugarDado.embaixo = d.embaixo;
      if (d.cavalo) self.lugarDado = { t0: item.t0, embaixo: d.embaixo, cavalo: d.cavalo, sobe: d.sobe };   // para o teste e o relatório
    }
    // a faixa do lugar (Ruling 14): em cima, logo abaixo da etiqueta "FOTO DE CHEGADA" (que vai de hudH + 2 a hudH + 12),
    // ou no pé da pista; decidida no quadro em que o jogador cruza a linha, na janela dos 2,5 s reais até em x2, e parada
    // até sumir. Com a faixa do Dado na tela (dCaixa), fica do lado de fora dela: abaixo, se ela está em cima; acima, se no
    // pé. O "◀VOCÊ Nº" do jogador entra como obstáculo
    function decideLugarFaixa(vis, youTag, dCaixa) {
      var lay = self.lay, topo = lay.hudH + 15, base = lay.artH - 2, dEmCima = !!dCaixa && !lugarDado.embaixo;
      if (dCaixa && dEmCima) topo = Math.max(topo, dCaixa.y + dCaixa.h + 2);
      if (dCaixa && !dEmCima) base = Math.min(base, dCaixa.y - 2);
      function caixaDe(emb) { return FX.lugarLayout(self.lugar.texto, lay, topo, emb, base); }
      var obst = [dCaixa];
      if (youTag) { var yb = youTagBox(youTag); obst.push({ x: yb.x - 1, y: yb.y - 1, w: yb.w + 2, h: YOU_H + 2 }); }
      var d = decideLugar(vis, self.simT, self.simT + LUGAR_S * ts * 2, caixaDe, obst);
      lugarFaixa.decidida = true; lugarFaixa.embaixo = d.embaixo; lugarFaixa.caixa = caixaDe(d.embaixo);
      self.lugarFaixa = { embaixo: d.embaixo, caixa: lugarFaixa.caixa, cavalo: d.cavalo };   // para o teste e o relatório
    }

    // Dado da Sorte sobre cada cavalo visível (fx.js): plaquinha centrada no jóquei, logo acima da caixa do desenho
    // (molde ou código), arranjada sem sobreposição entre a faixa do Dado e o pé da pista (com a faixa no pé, entre o
    // painel e a faixa) e desviando da etiqueta "◀VOCÊ" (obstáculo fixo). faixa = a caixa da faixa no quadro
    // (bannerLayout). Depois da revelação, a do vencedor é o dobro (DADO_MAIOR): o destaque dourado pulsa só sem
    // movimento reduzido (FX.diceState fixa o brilho e o drawDice omite as faíscas)
    var DADO_MAIOR = 2;
    function drawDadosNaPista(item, vis, youTag, faixa) {
      var S = self.S, lay = self.lay, red = reduced(), maior = FX.diceRevealed(item, self.simT, red) ? DADO_MAIOR : 1;
      var topo = lugarDado.embaixo ? lay.hudH + 2 : faixa.y + faixa.h + 2, base = lugarDado.embaixo ? faixa.y - 2 : lay.artH;
      var fixos = [];
      if (youTag) { var yb = youTagBox(youTag); fixos.push({ x: yb.x - 1, y: yb.y - 1 - topo, w: yb.w + 2, h: YOU_H + 2 }); }
      self.voceRect = fixos.length ? { x: fixos[0].x, y: fixos[0].y + topo, w: fixos[0].w, h: fixos[0].h } : null;
      var rects = vis.map(function (v) {
        var sz = FX.badgeSize(item.rolls[v.j]), k = v.j === item.winner ? maior : 1;
        sz = { w: sz.w * k, h: sz.h * k };
        var cx = v.an.saddle ? Math.round(v.x / S + v.an.saddle[0]) : Math.round((v.caixa.x + v.caixa.w / 2) / S);
        return { j: v.j, x: cx - Math.floor(sz.w / 2), y: Math.floor(v.caixa.y / S) - 1 - sz.h - topo, w: sz.w, h: sz.h };
      });
      var arr = FX.layoutBadges(rects, lay.artW, base - topo, fixos);
      arr.sort(function (a, b) { return (a.j === item.winner) - (b.j === item.winner); });   // vencedor por cima
      arr.forEach(function (r) {
        var est = FX.diceState(item, self.simT, red, r.j), win = r.j === item.winner;
        var num = FX.drawDice(ctx, r.x * S, (r.y + topo) * S, S * (win ? maior : 1), item.rolls[r.j], est, win, self.simT, L.racers[r.j].silks);
        FX._stats.placas.push({ racer: r.j, numero: num, vencedor: win, fase: est.fase, x: r.x, y: r.y + topo, w: r.w, h: r.h });
      });
    }

    // quem está fora da tela vira uma seta de 5 × 9 na borda, na altura da raia, na cor da seda e sem metros (guia §8;
    // etapa 2.4: com a câmera a 12 px/m quase sempre há alguém fora). topo (opcional) = a primeira linha livre abaixo de
    // uma faixa no alto da pista; obst = caixas que a seta não cobre (uma faixa no pé da pista): ela sobe para cima da
    // caixa. Anota as caixas em _stats.caixasEtiquetas
    var SETA_W = 5, SETA_H = 9;
    function layoutTags(tags, right, topo, obst) {
      if (!tags.length) return;
      var lay = self.lay, minY = Math.max(lay.hudH + 2, topo || 0);
      tags.forEach(function (t) {
        var y = clamp(Math.round(t.y / self.S), minY, lay.artH - SETA_H - 1);
        var ax = right ? lay.artW - SETA_W - 1 : 1, i, cx;
        (obst || []).forEach(function (b) {
          if (b && ax < b.x + b.w && ax + SETA_W > b.x && y < b.y + b.h && y + SETA_H > b.y) y = b.y - SETA_H - 1;
        });
        // contorno escuro e o miolo na cor da seda; a ponta para o lado de fora da tela
        for (i = 0; i < 5; i++) { cx = right ? ax + i : ax + 4 - i; box(cx, y + i, 1, SETA_H - 2 * i, C.tinta); }
        for (i = 0; i < 4; i++) { cx = right ? ax + i : ax + 4 - i; box(cx, y + 1 + i, 1, SETA_H - 2 - 2 * i, L.racers[t.j].silks); }
        FX._stats.caixasEtiquetas.push({ racer: t.j, x: ax, y: y, w: SETA_W, h: SETA_H });
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
        // câmera lenta do Dado da Sorte (fx.js); compõe com a da chegada pelo mínimo
        slowK = Math.min(slowK, FX.slowFactor(fxTl, self.simT, reduced()));
        self.simT += dtReal * ts * self.mult * slowK;
        if (self.simT >= endT) { self.phase = 'fim'; self.endTimer = 1.2; hud.pular.textContent = fimTxt; }
      } else if (self.phase === 'fim') {
        self.simT += dtReal * ts * self.mult * 0.5;
        self.endTimer -= dtReal;
        // a faixa do lugar fica os 2,5 s inteiros mesmo quando o jogador é dos últimos a cruzar ("Ver resultado" pula)
        if (self.endTimer <= 0 && !self.done && !(self.lugar && self.tReal < self.lugar.ate)) { self.done = true; fim(); return; }
      }
      if (!self.winnerSeen && self.simT >= tWin) { self.winnerSeen = true; if (!reduced()) self.flash = 0.3; }
      if (self.flash > 0) self.flash = Math.max(0, self.flash - dtReal);
      self.slowK = slowK;
      if (!self.crossed && self.simT >= fTime[me]) {
        self.crossed = true;
        hud.anuncio.textContent = 'Você cruzou a linha em ' + (rankOf[me] + 1) + 'º lugar.';
        // faixa do lugar (spec 3c §7): o lugar do sim.finishOrder, só para quem assiste (pular vai direto ao resultado)
        self.lugar = faixaDoLugar(rankOf[me] + 1);
        self.lugar.ate = self.tReal + LUGAR_S;
      }
      var st = sample(self.simT);
      // galope: cadência em tempo real proporcional à velocidade (mais lenta na câmera lenta)
      // (guia §8a: 21 quadros do molde por segundo a 17 m/s = 14 dos 6 do ciclo do código)
      for (var j = 0; j < n; j++) self.gallop[j] += dtReal * GALOPE_QPS * (st.speed[j] / 17) * (self.mult > 1 ? 1.3 : 1) * Math.max(0.35, slowK);
      // narração
      while (self.phase !== 'contagem' && feedPtr < feedEvents.length && feedEvents[feedPtr].t <= self.simT && !esperaRevelacao(feedEvents[feedPtr])) pushFeed(feedEvents[feedPtr++]);
      var order = ranking(st, self.simT);
      // o Dado só entra na faixa de ordem na revelação (Ruling 6: os dados pararam, ou movimento reduzido)
      var dVisto = self.phase === 'contagem' ? null : dadoAtivo(self.simT);
      atualizaOrdem(order, st, dVisto && FX.diceRevealed(dVisto, self.simT, reduced()) ? dVisto : null);
      // tempo de desenho do quadro (média móvel em RaceFx._stats.msQuadro)
      var tDes = window.performance.now();
      FX.beginFrame();
      draw(st, order);
      vctx.drawImage(buf, 0, 0, cv.width, cv.height);   // a única cópia do quadro para a tela, ampliada s vezes
      FX.endFrame(window.performance.now() - tDes, now);
    }

    // primeiro quadro estático
    frame(performance.now());
    // redimensionar: espera 150 ms parar; a altura CRESCENDO menos de 120 px (a barra do navegador do celular
    // sumindo) não refaz o layout — sobra um pouco de espaço embaixo. Encolher refaz sempre: senão o canvas
    // fica mais alto que a janela, a página rola e os controles somem.
    var rzTimer = null, rzW = window.innerWidth, rzH = window.innerHeight, rzDpr = dpr();
    var onResize = function () {
      clearTimeout(rzTimer);
      rzTimer = setTimeout(function () {
        var w = window.innerWidth, h = window.innerHeight, r = dpr();
        if (w === rzW && r === rzDpr && h >= rzH && h - rzH < 120) return;
        rzW = w; rzH = h; rzDpr = r;
        layout();
      }, 150);
    };
    window.addEventListener('resize', onResize);

    return {
      frame: frame,
      setSpeed: function (m) { self.mult = m; },
      relayout: function () { layout(); },
      skip: function () { if (!self.done) { self.done = true; fim(); } },
      destroy: function () { clearTimeout(rzTimer); window.removeEventListener('resize', onResize); FX.resetStats(false); },
      _state: self
    };
  }

  // ===========================================================================
  // Tela 5 — Resultado
  // ===========================================================================
  // Pódio (3c §8): o 1º lugar desenhado um passo de escala acima (k + passo: 3 quando os outros estão em 2), no centro;
  // o 2º e o 3º na escala de hoje, cada um centrado no espaço que sobra do seu lado, para as caixas não se tocarem. O
  // canvas tem 168 de arte de largura (336 px) e a altura que o cavalo maior pedir (a caixa dele, mais o lugar da seta
  // do jogador acima). Degraus, números, nomes, holofotes, confete e a seta como antes.
  var PODIUM_W = 224, PODIUM_H_MIN = 84;   // na grade (etapa 1b): 224 pixels de arte, os cavalos 1:1
  var PODIO_DEGRAU = { 1: 29, 2: 25, 3: 21 };   // altura de cada degrau em arte (o "3" ainda cabe acima da faixa escura)
  var PODIO_BLOCO = { 1: 56, 2: 44, 3: 44 };     // largura de cada degrau em arte
  var PODIO_SETA = 9;                             // arte acima da caixa do cavalo: 1 de folga, a seta (4) e 4 até a caixa
  var HORSE_PE = 32;                              // dos cascos ao topo do sprite por código (FOOT_Y + 1), em px de arte
  function setupPodium(cv) {
    var L = ui.lobby; if (!L || !L.sim) return;
    var top3 = L.sim.finishOrder.slice(0, 3);
    var playerOnPodium = top3.indexOf(L.playerIdx) >= 0;
    var k = gradeS || Math.max(1, Math.round(1.5 * dpr()));   // a escala da grade (setupCanvasGrade abaixo)
    // cada lugar: o cavalo (opções do drawHorse) e a caixa medida com os cascos em y = 0 e o corpo em x = 0. Na grade
    // (etapa 1b da direção de arte) os três cavalos saem 1:1, do mesmo tamanho: o 1º se destaca pelo degrau mais alto, o
    // holofote e o ouro (o guia não deixa ampliar o molde); o canvas cresce para a caixa caber
    var slots = [1, 2, 3].map(function (place) {
      var ri = top3[place - 1];
      if (ri == null) return null;
      var r = L.racers[ri], kS = k;
      var opts = comVisuais({
        palette: r.horse.palette, element: r.horse.element, idle: true, t: 0,
        scale: kS, silks: r.silks, shadow: false, quadro: { topo: -1e6, base: 0, grade: k, centro: 0 }
      }, opcoesVisuais(r.horse, joqueiDoCorredor(L, ri)));   // parte 2a
      var b = SP.horseBox(0, -HORSE_PE * kS, opts);
      var alto = Math.max(-b.y, HORSE_PE * kS);   // o desenho por código ocupa HORSE_PE·kS acima dos cascos
      return { place: place, r: r, kS: kS, opts: opts, bx: b.x, bw: b.w, alto: alto,
        col: place === 1 ? C.ouro : place === 2 ? C.prata : C.bronze };
    });
    var H = PODIUM_H_MIN;
    slots.forEach(function (sl) { if (sl) H = Math.max(H, PODIO_DEGRAU[sl.place] + Math.ceil(sl.alto / k) + PODIO_SETA); });
    var s = setupCanvasGrade(cv, PODIUM_W, H), ctx = s.ctx;
    // posições (px do canvas): o 1º centrado; o 2º no meio do espaço à esquerda dele; o 3º no da direita
    var W = PODIUM_W * k, g = slots[0];
    g.left = Math.round(W / 2 - g.bw / 2);
    if (slots[1]) slots[1].left = Math.max(0, Math.round(g.left / 2 - slots[1].bw / 2));
    if (slots[2]) slots[2].left = Math.min(W - slots[2].bw, Math.round((g.left + g.bw + W) / 2 - slots[2].bw / 2));
    var podio = [];
    slots.forEach(function (sl) {
      if (!sl) return;
      sl.top = H - PODIO_DEGRAU[sl.place];        // topo do degrau, em arte
      sl.cx = (sl.left + sl.bw / 2) / k;           // centro do cavalo e do degrau, em arte
      sl.hx = sl.left - sl.bx;
      sl.hy = sl.top * k - HORSE_PE * sl.kS;
      sl.opts.quadro = { topo: -1e6, base: sl.top * k, grade: k, centro: sl.left - sl.bx };   // em pé no degrau, 1:1
      sl.caixa = SP.horseBox(sl.hx, sl.hy, sl.opts);
      podio.push({ lugar: sl.place, x: sl.caixa.x / dpr(), y: sl.caixa.y / dpr(), w: sl.caixa.w / dpr(), h: sl.caixa.h / dpr(), escala: sl.kS / dpr() });
    });
    /*@teste:inicio*/
    if (window.__galope) window.__galope.podio = podio;   // caixas dos três cavalos em px de CSS do canvas (ui-test)
    /*@teste:fim*/
    var confetti = [];
    for (var c = 0; c < 26; c++) confetti.push({ x: (c * 37) % PODIUM_W, y: (c * 23) % H, v: 6 + (c % 5) * 3, col: [C.ouro, C.ganho, C.agua, C.fogo, C.texto][c % 5] });
    function R(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x) * k, Math.round(y) * k, w * k, h * k); }
    var item = {
      draw: function (t) {
        R(0, 0, PODIUM_W, H, C.painel);
        // holofotes
        ctx.fillStyle = C.holofote;
        slots.forEach(function (sl) {
          if (!sl) return;
          for (var yy = 0; yy < sl.top - 1; yy += 2) { var hw = 4 + yy * 0.32; ctx.fillRect(Math.round(sl.cx - hw) * k, yy * k, Math.round(hw * 2) * k, 2 * k); }
        });
        if (playerOnPodium && !reduced()) {
          confetti.forEach(function (p, i) {
            var y = (p.y + t * p.v) % H, x = p.x + Math.round(Math.sin(t * 2 + i) * 2);
            R(x, y, 1 + (i % 2), 1, p.col);
          });
        }
        R(0, H - 4, PODIUM_W, 4, C.sombra);
        slots.forEach(function (sl) {
          if (!sl) return;
          var bw = PODIO_BLOCO[sl.place], bx = sl.cx - bw / 2;
          R(bx - 1, sl.top - 1, bw + 2, H - sl.top, C.sombra);
          R(bx, sl.top, bw, H - sl.top - 4, sl.col);
          R(bx, sl.top, bw, 1, C.brilho);
          R(bx, H - 7, bw, 3, C.escuro);
          SP.drawText(ctx, String(sl.place), Math.round(sl.cx) * k, (sl.top + 3) * k, { fonte: 'g11', scale: k, color: C.tinta, align: 'center' });
          sl.opts.t = reduced() ? 0.5 : t + sl.place * 0.8;
          sl.opts.reduzido = reduced();
          SP.drawHorse(ctx, sl.hx, sl.hy, sl.opts);
          if (sl.r.isPlayer) {
            // seta dourada sobre o seu cavalo: a ponta fica 4 px de arte acima do topo do desenho (o molde pode ser
            // mais alto que o sprite por código, cujo topo é sl.hy)
            var ponta = Math.min(Math.floor(sl.hy / k), Math.floor(sl.caixa.y / k)) - 5, ax = Math.round(sl.cx);
            R(ax - 3, ponta - 3, 7, 1, C.ouro); R(ax - 2, ponta - 2, 5, 1, C.ouro); R(ax - 1, ponta - 1, 3, 1, C.ouro); R(ax, ponta, 1, 1, C.ouro);
          }
        });
      }
    };
    item.draw(0);
    vivo(item, cv);
  }

  var RESULTADO_ABAS = [{ id: 'chegada', rotulo: 'Chegada' }, { id: 'momentos', rotulo: 'Momentos' }];
  function renderResultado() {
    var L = ui.lobby, R = ui.result, sim = L.sim;
    var order = sim.finishOrder, winT = sim.finishTimes[order[0]];
    var top3 = order.slice(0, 3);
    var names = [1, 0, 2].map(function (k) {
      var ri = top3[k]; if (ri == null) return '<div></div>';
      var r = L.racers[ri];
      return '<div class="' + (r.isPlayer ? 'voce' : '') + '"><b>' + esc(r.horse.name) + '</b><span>' + esc(r.isPlayer ? PLAYER_NAME : r.name) + '</span></div>';
    }).join('');

    var head = R.place === 1 ? 'Vitória! <em>1º</em> de ' + L.n
      : 'Você chegou em <em>' + R.place + 'º</em> de ' + L.n;
    // frase embaixo da manchete só quando explica algo (3c §8): as de enfeite saíram (a pista está no topo e o lugar
    // na manchete)
    var paid = R.payouts ? R.payouts.prizes.length : 3;
    var sub = R.place > paid && R.place <= 3 ? 'Pódio sem prêmio: com ' + L.n + ' corredores só 1º e 2º são pagos.' : '';

    // entrada, prêmio e resultado numa linha que quebra se precisar; o saldo vai ao lado do XP
    var net = R.prize - R.fee;
    var par = function (dt, dd, cls) { return '<div><dt>' + dt + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + dd + '</dd></div>'; };
    var balanco = '<dl class="balanco">' + (R.training
      ? par('Entrada', 'Treino, sem aposta') + par('Ouro do treino', '+' + fmt(R.prize), 'mais')
      : par('Entrada', '−' + fmt(R.fee), 'menos-t') +
        par('Prêmio (' + R.place + 'º lugar)', R.prize ? '+' + fmt(R.prize) : '0', R.prize ? 'mais' : '') +
        par('Resultado', signed(net), net > 0 ? 'mais' : net < 0 ? 'menos-t' : '') +
        (R.stone ? par('Pedra Negra', iconeHtml('pedra-negra', '🪨') + ' +1', 'mais') : '')) + '</dl>';

    var lvl = '';
    if (R.levels > 0) {
      var ups = STAT_KEYS.map(function (k) {
        var d = R.after.stats[k] - R.before.stats[k];
        return d ? '<span>' + esc(GD.STATS[k].short) + ' ' + R.before.stats[k] + ' → ' + R.after.stats[k] + ' <b class="mais">+' + d + '</b></span>' : '';
      }).join('');
      // pontos livres ganhos (subir mais de um nível soma); com os status que recebem pontos no teto de 150,
      // nenhum ponto rende: aí só a frase do teto. Sem status que mude e fora do teto, não diz nada sobre teto.
      var ganhos = R.after.free - R.before.free;
      var pontos = ganhos > 0 && !R.after.allCap
        ? '<span>' + esc('+' + ganhos + (ganhos === 1 ? ' ponto livre' : ' pontos livres') + ' para distribuir na aba Status da Montaria.') + '</span>' : '';
      var teto = R.after.allCap ? '<span>' + esc('Os status já estão no teto de ' + RS.TUNING.statMax + '.') + '</span>' : '';
      var corpoNivel = ups + pontos + teto;
      lvl = '<div class="levelup" role="status"><b>Subiu para o nível ' + R.after.level + '!</b>' +
        (corpoNivel ? '<div class="ganhos">' + corpoNivel + '</div>' : '') + '</div>';
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
      return '<li class="tipo-' + esc(ev.type) + (ev.racer === L.playerIdx ? ' voce' : '') + '"><time>' + esc(fmtClock(ev.t)) + '</time>' + chip + '<span>' + eventoHtml(txt, ev.type) + '</span></li>';
    }).join('');

    var broke = state.gold < MIN_ENTRY;
    var actions = broke
      ? '<p class="aviso aviso--perda">Seu Ouro acabou abaixo da menor entrada (' + MIN_ENTRY + '). O treino gratuito não cobra nada e paga de 10 a 30 de Ouro.</p>' +
        '<div class="acoes acoes--linha"><button type="button" class="btn btn--ouro" data-acao="treino">Treino gratuito</button>' +
        '<button type="button" class="btn" data-acao="voltar">Voltar</button></div>'
      : '<div class="acoes acoes--linha"><button type="button" class="btn btn--ouro" data-acao="denovo">Correr de novo</button>' +
        '<button type="button" class="btn" data-acao="voltar">Voltar</button></div>';

    var prizeOf = {};
    if (R.payouts) R.payouts.prizes.forEach(function (p) { prizeOf[p.racer] = p.amount; });
    var rows = order.map(function (ri, k) {
      var r = L.racers[ri], info = sim.racerInfo ? sim.racerInfo[ri] : null;
      var t = sim.finishTimes[ri];
      var gap = k === 0 ? 'vencedor' : '+' + (t - winT).toFixed(2).replace('.', ',') + 's';
      // a linha do jogador mostra o prêmio pago (com o bônus da insígnia de Fogo); a dos rivais, o da tabela do pote
      var prize = R.training ? (r.isPlayer ? '+' + R.prize : '—') : r.isPlayer ? (R.prize ? fmt(R.prize) : '—') : (prizeOf[ri] ? fmt(prizeOf[ri]) : '—');
      return '<tr class="' + (r.isPlayer ? 'voce' : '') + '"><td class="pos" aria-label="' + (k + 1) + ' lugar">' + podioIcone(k + 1) + (k + 1) + 'º</td>' +
        // duas linhas de texto (3c §8): o nome numa; dono, nível e chance de skill na outra. Esta quebra só entre os
        // pedaços (Ruling 17): cada um sem quebra por dentro e o " ·" no fim do pedaço de cima
        '<td><div class="quem"><b>' + laneChip(r, ri, 'raia--mini') + esc(r.horse.name) +
        (r.isPlayer ? ' <span class="tag-voce">VOCÊ</span>' : '') + '</b>' +
        '<small>' + (r.isPlayer ? [] : [r.name]).concat(['Nv ' + r.horse.level]).concat(info ? ['skills ' + Math.round(info.skillChance * 100) + '%'] : [])
          .map(function (p, i, ps) { return '<span class="quem-peca">' + esc(p + (i < ps.length - 1 ? ' ·' : '')) + '</span>'; }).join(' ') + '</small></div></td>' +
        '<td class="num"><span class="tempo">' + fmtSec(t) + '</span><small>' + gap + '</small></td><td class="num">' + prize + '</td></tr>';
    }).join('');

    // abas Chegada | Momentos (como as sub-abas da ficha): só a aberta vai para a página
    var aba = ui.resultAba === 'momentos' ? 'momentos' : 'chegada';
    var subabas = '<div class="subabas" role="group" aria-label="Detalhes da corrida">' + RESULTADO_ABAS.map(function (a) {
      return '<button type="button" class="btn opcao opcao--centro" data-acao="resultado-aba" data-id="' + a.id + '" aria-pressed="' + (aba === a.id) + '">' + a.rotulo + '</button>';
    }).join('') + '</div>';
    var corpo = aba === 'momentos'
      ? (momentos ? '<section class="caixa" aria-labelledby="t-dados"><h2 class="titulo" id="t-dados">Momentos da corrida</h2>' +
          '<ol class="feed feed--estatica">' + momentos + '</ol></section>' : '<p class="nota">Nenhum momento marcante nesta corrida.</p>')
      : '<section class="caixa" aria-labelledby="t-chegada"><h2 class="titulo" id="t-chegada">Ordem de chegada</h2>' +
          '<div class="rolagem"><table class="tabela"><thead><tr><th>Pos</th><th>Cavalo</th><th class="num">Tempo</th><th class="num">Prêmio</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' +
          '<p class="nota">' + iconeHtml('ui-dado', '🎲', 16) + ' Dado da Sorte: a 1/3 e 2/3 da pista o maior dado puxa o clima para o elemento de quem tirou.</p>' +
        '</section>';

    return '<section class="tela" aria-labelledby="t-resultado">' +
      '<header class="topo topo--fixo"><span class="logo-mini">' + esc(L.trackName) + '</span><span class="saldo" aria-label="Saldo">' + ouroHtml(state.gold) + '</span></header>' +
      '<div class="podio-palco"><canvas data-podio="1" role="img" aria-label="Pódio com os três primeiros"></canvas><div class="podio-nomes">' + names + '</div></div>' +
      '<section class="caixa resultado-caixa"><h1 class="manchete" id="t-resultado" tabindex="-1" data-foco>' + head + '</h1>' +
        (sub ? '<p class="sub">' + sub + '</p>' : '') + balanco +
        '<div class="resultado-xp"><div class="tela-cabeca"><span class="rotulo">Experiência ' + '<span class="mais">+' + R.xpGain + ' XP</span>' + (R.training ? ' (treino: metade)' : '') + '</span>' +
          xpHtml(R.after.level, R.after.xp) + '</div>' +
          '<dl class="saldo-final"><dt>Saldo</dt><dd>' + ouroHtml(R.after.gold) + '</dd></dl></div>' +
        lvl + '</section>' +
      actions + subabas + corpo +
      '</section>';
  }

  // ===========================================================================
  // Ações
  // ===========================================================================
  function startLobby(training) {
    var s = state;
    var lobby = openLobby(training);
    // sem sala: não gravou (o aviso está em ui.notice) ou outra aba gravou um save mais novo (adoptExternal já navegou)
    if (!lobby) { if (ui.notice === FALHA_SALVAR) rerenderKeepScroll(); return; }
    if (state !== s) return;
    ui.lobby = lobby;
    go('largada');
  }

  // ações de peça e da Loja: com o equipamento suspenso (GEAR_ON) não fazem nada, nem com o botão forçado (nada é
  // equipado, melhorado, vendido nem comprado; peças e Pedras ficam no save como estão)
  var ACOES_EQUIP = { 'loja-tab': 1, comprar: 1, 'comprar-pedra': 1, 'equipar-tela': 1, 'equip-slot': 1, equipar: 1, tirar: 1,
    melhorar: 1, 'melhorar-nao': 1, 'melhorar-sim': 1, vender: 1, 'vender-desfazer': 1 };
  telaEl.addEventListener('click', function (e) {
    if (saveBloqueado) {   // tela de bloqueio: só o Recarregar faz alguma coisa
      var rb = e.target.closest ? e.target.closest('[data-acao="recarregar"]') : null;
      if (rb) window.location.reload();
      return;
    }
    if (diaVirou()) { redesenhaDia(); return; }   // o dia virou desde o último desenho: a tela nova, e este toque não vale
    tiraMotivo(e.target);   // qualquer toque tira a linha do motivo (também o do ⓘ, que abre a ajuda); nunca há duas na tela
    var aj = e.target.closest ? e.target.closest('[data-ajuda]') : null;
    if (aj) { alternaAjuda(aj); return; }   // "ⓘ" (ou o nome do status): abre/fecha o texto, sem re-renderizar nem acionar o cartão em volta
    var b = e.target.closest ? e.target.closest('[data-acao]') : null;
    if (!b || b.disabled) return;
    if (b.getAttribute('aria-disabled') === 'true') { mostraMotivo(b); return; }   // indisponível: só diz o porquê, sem ação
    var id = b.getAttribute('data-id');
    var acaoClicada = b.getAttribute('data-acao');
    if (!GEAR_ON && hasOwn(ACOES_EQUIP, acaoClicada)) return;
    switch (acaoClicada) {
      case 'aba':
        if (state && hasOwn(SCREEN_KIND, id) && SCREEN_KIND[id] === 'aba' && abaVisivel(id)) go(id);
        break;
      case 'perfil':
        if (state) go('perfil');
        break;
      // ---- Loja de itens (fora do portão do equipamento): a parte aberta e a compra de um toque ----
      case 'loja-parte':
        if (ui.screen !== 'loja' || !LOJA_PARTES.some(function (a) { return a.id === id; })) break;
        ui.lojaParte = id; ui.lojaMsg = null; ui.item = null; ui.itemMsg = null;
        rerenderKeepScroll(); break;   // o foco volta ao botão da parte
      case 'item-comprar': {
        // nunca confia no botão: confere de novo pelas regras do Itens, depois de sincronizar com outras abas; um toque
        // recusado só diz o porquê (não grava nada, nem toca na sala aberta)
        if (ui.screen !== 'loja' || !hasOwn(GD.ITEMS, id)) break;
        var sI = state;
        persist();
        if (state !== sI) break;
        var hojeI = hojeDia(), itI = GD.ITEMS[id];
        var pI = IT.podeComprar(id, state.lojaItens, hojeI, state.gold, ouroLivre(), itemQtd(id));
        if (!pI.ok) {
          // a tela estava velha (outra aba, o dia virou): redesenha e diz o porquê como no botão indisponível
          var txtI = lojaMotivo(id, pI);
          ui.lojaMsg = null;
          rerenderKeepScroll();
          var bI = telaEl.querySelector('[data-acao="item-comprar"][data-id="' + id + '"]');
          if (bI && bI.getAttribute('data-motivo') === txtI) mostraMotivo(bI); else motivoVivo(txtI);
          break;
        }
        var antesI = clone(state);
        state.gold -= itI.price;
        state.mochila[id] += 1;
        state.lojaItens = IT.comprar(id, state.lojaItens, hojeI);
        var gI = gravaGasto(sI, antesI);
        if (gI === 'outra-aba') break;
        ui.lojaMsg = { id: id, txt: gI === 'falhou' ? FALHA_SALVAR : 'Comprou 1 ' + itI.name + '. Agora você tem ' + fmt(state.mochila[id]) + ' na mochila.' };
        rerenderKeepScroll();
        motivoVivo(ui.lojaMsg.txt);   // a região viva anuncia (o aviso na linha é só para ver)
        break;
      }
      // ---- Recompensa diária (cartão do Estábulo): o resgate no padrão do item-comprar e o "Ver os 7 dias" ----
      case 'diaria-resgatar': {
        // nunca confia no botão: sincroniza com outras abas, confere de novo pelo Itens com o dia deste instante, e o Ouro, os
        // itens e a diária vão numa gravação só; um toque recusado só diz o porquê (não grava nada)
        if (ui.screen !== 'estabulo') break;
        var sD = state;
        persist();
        if (state !== sD) break;      // outra aba gravou depois: adoptExternal já levou ao Estábulo com o save dela
        var hojeD = hojeDia();
        var rD = IT.resgatar(state.diaria, hojeD, diariaCabe);
        if (!rD || rD.cheia) {
          // a tela estava velha (o dia virou, voltou) ou a mochila está cheia: redesenha e diz o porquê
          var txtD = rD ? diariaCheiaTxt(rD.cheia) : 'A recompensa de hoje já foi resgatada. Volte amanhã.';
          rerenderKeepScroll();
          var bD = telaEl.querySelector('[data-acao="diaria-resgatar"]');
          if (bD && bD.getAttribute('data-motivo') === txtD) mostraMotivo(bD); else motivoVivo(txtD);
          break;
        }
        var antesD = clone(state);
        state.gold += rD.ouro;
        Object.keys(rD.itens).forEach(function (iid) {
          if (iid === 'redea') state.redeas += rD.itens[iid]; else state.mochila[iid] += rD.itens[iid];
        });
        state.diaria = rD.diaria;
        var gD = gravaGasto(sD, antesD);
        if (gD === 'outra-aba') break;
        if (gD === 'falhou') { ui.notice = FALHA_SALVAR; rerenderKeepScroll(); motivoVivo(FALHA_SALVAR); break; }
        ui.diariaVer = false;
        rerenderKeepScroll();
        var lD = telaEl.querySelector('.diaria-linha');   // o botão saiu: o foco fica no cartão de uma linha
        if (lD) { try { lD.focus({ preventScroll: true }); } catch (e3) { lD.focus(); } }
        motivoVivo('Você recebeu ' + premioTxt({ ouro: rD.ouro, itens: rD.itens }) + '.');
        break;
      }
      case 'diaria-ver':
        if (ui.screen !== 'estabulo') break;
        ui.diariaVer = !ui.diariaVer;
        rerenderKeepScroll(); break;   // o foco volta ao botão, agora com o aria-expanded novo
      // ---- Usar os itens (seção "Usar os itens"): nunca confia no botão; cada passo confere de novo com o estado atual ----
      case 'item-usar': {
        // da Mochila abre a escolha do cavalo; da ficha (data-mount) vai direto à confirmação, ou à escolha da skill no
        // Cupom ("Trocar" já traz a skill em data-skill)
        var uidU = b.getAttribute('data-mount'), skU = b.getAttribute('data-skill'), naFicha = uidU != null;
        if (!hasOwn(GD.ITEMS, id)) break;
        if (naFicha ? ui.screen !== 'montaria' || !ui.montaria || ui.montaria.uid !== uidU || id === 'redea' : ui.screen !== 'loja') break;
        var sU = state;
        persist();                    // tela velha (outra aba): adota o save mais novo antes de abrir o uso
        if (state !== sU) break;
        ui.itemMsg = null;
        var motU = itemQtd(id) < 1 ? 'Você não tem ' + GD.ITEMS[id].name + '.' : naFicha ? (skU ? motivoUsoSkill(id, mountByUid(uidU), skU) : motivoUso(id, mountByUid(uidU))) : '';
        if (motU) { recusaItem(seletorDe(b), motU); break; }
        ui.item = { id: id, mountUid: naFicha ? uidU : null, skillId: null, passo: 'cavalo', origem: naFicha ? 'ficha' : 'mochila' };
        if (naFicha && id === 'cupom' && skU) { ui.item.skillId = skU; ui.item.passo = 'confirma'; }
        else if (naFicha) ui.item.passo = id === 'cupom' ? 'skill' : 'confirma';
        itemPasso(); break;
      }
      case 'item-cavalo': {
        var FC = ui.item;
        if (!FC || FC.passo !== 'cavalo' || ui.screen !== 'loja') break;
        var motCv = motivoUso(FC.id, mountByUid(id));
        if (motCv) { recusaItem(seletorDe(b), motCv); break; }
        if (FC.id === 'redea') {   // a Rédea nova: a aba Status do cavalo, com o foco no Redistribuir (o custo é o de sempre)
          goMontaria(id, 'status');
          var bRd = telaEl.querySelector('[data-acao="redistribuir"]');
          if (bRd) { try { bRd.focus({ preventScroll: true }); } catch (e1) { bRd.focus(); } if (bRd.scrollIntoView) bRd.scrollIntoView({ block: 'center' }); }
          break;
        }
        FC.mountUid = id; FC.passo = FC.id === 'cupom' ? 'skill' : 'confirma';
        itemPasso(); break;
      }
      case 'item-skill': {
        var FS = ui.item;
        if (!FS || FS.passo !== 'skill' || FS.id !== 'cupom') break;
        var motSk = motivoUsoSkill('cupom', mountByUid(FS.mountUid), id);
        if (motSk) { recusaItem(seletorDe(b), motSk); break; }
        FS.skillId = id; FS.passo = 'confirma';
        itemPasso(); break;
      }
      case 'item-confirmar': {
        var FF = ui.item;
        if (!FF || FF.passo !== 'confirma') break;
        ui.itemMsg = null;
        var rU = usaItem(FF.id, FF.mountUid, FF.skillId);
        if (rU === 'outra-aba') break;   // o save de outra aba foi adotado e a tela já foi desenhada de novo
        if (rU !== 'ok') {               // recusado (o motivo fica no Confirmar apagado) ou a gravação falhou (nada mudou)
          if (rU === FALHA_SALVAR) ui.itemMsg = { passo: true, txt: rU };
          recusaItem('[data-acao="item-confirmar"]', rU); break;
        }
        ui.item = null;
        itemVolta(FF);
        motivoVivo(ui.itemMsg.txt);   // a região viva anuncia; o aviso fica na tela
        break;
      }
      case 'item-cancelar': {
        var FX = ui.item;
        if (!FX) break;
        ui.item = null; ui.itemMsg = null;
        itemVolta(FX); break;
      }
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
        if (!pd || !pd.shop || !(pd.price > 0) || !podeGastar(pd.price)) {
          if (pd && state.gold >= pd.price) ui.loja.msg = reservaTxt() + '.';
          rerenderKeepScroll(); break;
        }
        var antesC = clone(state);
        state.gold -= pd.price;
        newItem(id);
        var gC = gravaGasto(sC, antesC);
        if (gC === 'outra-aba') break;
        if (gC === 'falhou') { ui.loja.msg = FALHA_SALVAR; rerenderKeepScroll(); break; }
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
        if (!podeGastar(pc)) { if (state.gold >= pc) ui.loja.msg = reservaTxt() + '.'; rerenderKeepScroll(); break; }
        var antesP = clone(state);
        state.gold -= pc;
        state.pedras += pn;
        var gP = gravaGasto(sP, antesP);
        if (gP === 'outra-aba') break;
        if (gP === 'falhou') { ui.loja.msg = FALHA_SALVAR; rerenderKeepScroll(); break; }
        ui.loja.msg = 'Comprou ' + pedrasTxt(pn) + ' negra' + (pn === 1 ? '' : 's') + '.';
        rerenderKeepScroll(); break;
      }
      case 'montaria':                // linha do Estábulo
        goMontaria(id, 'status'); break;
      case 'equipar-tela':            // "Equipar" da aba Correr e da largada
        goMontaria(id, 'equip'); break;
      case 'resultado-aba':           // Chegada | Momentos do resultado
        if (ui.screen !== 'resultado' || !RESULTADO_ABAS.some(function (a) { return a.id === id; })) break;
        ui.resultAba = id;
        rerenderKeepScroll(); break;
      case 'montaria-aba':
        if (!ui.montaria || !montariaAbaValida(id)) break;
        ui.montaria.aba = id;
        ui.montaria.rascunho = null; ui.montaria.confirmaPontos = false; ui.montaria.pontosMsg = null;   // o rascunho não sai da aba Status
        ui.montaria.confirmaRedist = false;
        ui.montaria.renomear = null; ui.confirmLiberar = null;   // nem o campo de renomear e a confirmação de liberar da aba Ficha
        ui.item = null; ui.itemMsg = null;                       // nem o uso de item aberto
        rerenderKeepScroll(); break;
      case 'ponto-mais': {
        // +1, +5 ou +10 (data-n): soma exatamente N ao rascunho, ou nada
        var pm = ui.montaria ? mountByUid(ui.montaria.uid) : null, pn = Number(b.getAttribute('data-n'));
        if (!pm || ui.montaria.aba !== 'status' || STAT_KEYS.indexOf(id) < 0 || BUILD_PASSOS.indexOf(pn) < 0) break;   // só na aba Status
        var pr2 = rascunhoMaisN(ui.montaria.rascunho, id, pn);
        if (!rascunhoOk(pm, pr2) || !travaPontos(pm, allocComRascunho(pm, pr2)).ok) break;   // nunca confia no botão
        ui.montaria.rascunho = pr2; ui.montaria.confirmaPontos = false; ui.montaria.pontosMsg = null; ui.montaria.confirmaRedist = false;
        rerenderKeepScroll();   // o +N que ficou indisponível (aria-disabled) continua no lugar: o foco volta para ele
        break;
      }
      case 'pontos-sugerir': {
        // "Distribuir sugerido": a build dos bots a partir dos pontos gravados + o rascunho; ainda pede o Confirmar
        var MS = ui.montaria, sm = MS ? mountByUid(MS.uid) : null;
        if (!sm || MS.aba !== 'status') break;   // só na aba Status
        var rs0 = MS.rascunho && rascunhoOk(sm, MS.rascunho) ? MS.rascunho : null;
        var rs1 = rascunhoSugerido(sm, rs0);
        if (rascunhoSoma(rs1) <= rascunhoSoma(rs0) || !rascunhoOk(sm, rs1)) break;   // nada a somar (nunca confia no botão)
        MS.rascunho = rs1; MS.confirmaPontos = false; MS.pontosMsg = null; MS.confirmaRedist = false;
        rerenderKeepScroll();   // o "Distribuir sugerido" indisponível (aria-disabled) continua no lugar: o foco volta para ele
        break;
      }
      case 'pontos-desfazer':
        if (!ui.montaria) break;
        ui.montaria.rascunho = null; ui.montaria.confirmaPontos = false; ui.montaria.pontosMsg = null; ui.montaria.confirmaRedist = false;
        rerenderKeepScroll(); focusAction('ponto-mais', 'vel', 1); break;
      case 'pontos-confirmar': {
        var MQ = ui.montaria, cq = MQ ? mountByUid(MQ.uid) : null;
        if (!cq || MQ.aba !== 'status' || !rascunhoSoma(MQ.rascunho)) break;   // só na aba Status
        MQ.confirmaRedist = false;
        // nunca confia no botão: com páreo aberto, um rascunho acima do Poder da sala não arma nem grava (RF3)
        if (!rascunhoOk(cq, MQ.rascunho) || !travaPontos(cq, allocComRascunho(cq, MQ.rascunho)).ok) { MQ.confirmaPontos = false; rerenderKeepScroll(); break; }
        if (!MQ.confirmaPontos) {   // primeiro toque: só o aviso de como mudar depois (Redistribuir)
          MQ.confirmaPontos = true; MQ.pontosMsg = null;
          rerenderKeepScroll(); focusAction('pontos-confirmar'); break;
        }
        MQ.confirmaPontos = false;
        var sQ = state;
        persist();                    // sincroniza com outras abas antes de gravar
        if (state !== sQ) break;      // save mais novo adotado: adoptExternal já navegou
        cq = mountByUid(MQ.uid);
        var rq = MQ.rascunho;
        MQ.rascunho = null;
        if (!cq || !rascunhoOk(cq, rq) || !travaPontos(cq, allocComRascunho(cq, rq)).ok) {
          MQ.pontosMsg = 'Os pontos não cabem mais nesta montaria; o rascunho foi descartado.';
          rerenderKeepScroll(); break;
        }
        var antesQ = clone(state);
        cq.alloc = allocComRascunho(cq, rq);
        var gQ = gravaGasto(sQ, antesQ);
        if (gQ === 'outra-aba') break;
        // gravação que falhou: o rascunho volta (o jogador só toca "Confirmar" de novo, o aviso já foi dado)
        if (gQ === 'falhou') { MQ.rascunho = rq; MQ.confirmaPontos = true; }
        MQ.pontosMsg = gQ === 'falhou' ? FALHA_SALVAR : 'Pontos distribuídos.';
        rerenderKeepScroll(); break;
      }
      case 'redistribuir': {
        // 1º toque: o texto do que vai gastar; 2º toque: devolve os pontos e grava (Rédea ou a grátis na mesma gravação)
        var MR = ui.montaria, rm = MR ? mountByUid(MR.uid) : null;
        if (!rm || MR.aba !== 'status') break;   // só na aba Status
        if (!podeRedistribuir(rm).ok) { MR.confirmaRedist = false; rerenderKeepScroll(); break; }   // nunca confia no botão
        if (!MR.confirmaRedist) {
          MR.confirmaRedist = true; MR.confirmaPontos = false; MR.pontosMsg = null;
          rerenderKeepScroll(); focusAction('redistribuir'); break;
        }
        MR.confirmaRedist = false;
        var sR = state;
        persist();                    // sincroniza com outras abas antes de gravar
        if (state !== sR) break;      // save mais novo adotado: adoptExternal já navegou
        rm = mountByUid(MR.uid);
        var podeR = rm ? podeRedistribuir(rm) : null;
        if (!podeR || !podeR.ok) {
          MR.pontosMsg = 'Não deu para redistribuir: ' + (podeR ? podeR.motivo : 'a montaria não está mais no estábulo.');
          rerenderKeepScroll(); break;
        }
        var antesR = clone(state), rqR = MR.rascunho;
        if (podeR.custo === 'gratis') rm.respecFree = false; else state.redeas -= 1;
        rm.alloc = zeroAlloc();
        MR.rascunho = null; MR.confirmaPontos = false;
        var gR = gravaGasto(sR, antesR);
        if (gR === 'outra-aba') break;
        // gravação que falhou: nada mudou (state voltou ao de antes); o 1º toque continua valendo, como no Confirmar
        if (gR === 'falhou') { MR.rascunho = rqR; MR.confirmaRedist = true; }
        MR.pontosMsg = gR === 'falhou' ? FALHA_SALVAR : 'Pontos devolvidos: distribua de novo.';
        rerenderKeepScroll();
        if (!telaEl.contains(document.activeElement)) focusAction('ponto-mais', 'vel', 1);   // o botão sumiu (sem pontos)
        break;
      }
      // ---- Ginásios (aba Expedição): abrir a trilha, abrir o detalhe da etapa próxima, voltar ----
      case 'ginasio-abrir':
        if (!state || ui.screen !== 'expedicao' || !hasOwn(GD.GYMS, id)) break;
        ui.gym = { id: id, etapa: null, time: [], res: null, msg: null };
        go('ginasio');
        // exceção ao "go() volta ao topo" (Ruling 17): a etapa próxima é a única ação da trilha, então a tela rola na hora o
        // mínimo para ela aparecer inteira; o foco fica no título
        mostraInteiro(telaEl.querySelector('.etapa[data-estado="proxima"], .etapa[data-estado="revanche"]'));
        break;
      case 'ginasio-etapa': {
        // só abre o que o módulo deixa hoje (ginModo): a etapa próxima ou a revanche do líder livre hoje (o aria-disabled só
        // avisa: confere de novo pelo progresso salvo e pelo dia)
        var gE = ui.gym, iE = Number(id);
        if (ui.screen !== 'ginasio' || !gE || gE.etapa !== null || !(iE >= 0 && iE < ginEtapasTotal(gE.id)) || !ginModo(gE.id, iE).pode) break;
        gE.etapa = iE; gE.time = []; gE.res = null; gE.msg = null;   // o preparo abre com o time vazio
        go('ginasio'); break;
      }
      // o time do preparo: tocar põe no fim, tocar de novo tira (os de trás sobem). Confere de novo: o cavalo existe, não está
      // preso na sala aberta e cabe no time (o aria-disabled só avisa)
      case 'ginasio-time': {
        var gT = ui.gym, mT = mountByUid(id);
        if (ui.screen !== 'ginasio' || !gT || gT.etapa === null || gT.res || !mT) break;
        var pT = gT.time.indexOf(id);
        if (pT >= 0) gT.time.splice(pT, 1);
        else if (!ginPreso(mT) && gT.time.length < ginLimite(gT.id, gT.etapa)) gT.time.push(id);
        else break;
        gT.msg = null;
        rerenderKeepScroll(); break;
      }
      case 'ginasio-desafiar': {
        var gDf = ui.gym;
        if (ui.screen !== 'ginasio' || !gDf || gDf.etapa === null || gDf.res) break;
        var rDf = desafia(gDf.id, gDf.etapa, gDf.time.slice());
        if (rDf === 'ok') {
          // tudo já gravado: a tela de desafio e o duelo, um a um, com o cartão entre eles, e depois o resumo (Tarefa 6)
          ginDesafio(0);
          break;
        }
        var bDf;
        if (rDf === 'outra-aba') {
          // o save da outra aba já foi adotado e a tela, desenhada de novo: diz por que o "Desafiar" ficou apagado, se ficou
          bDf = telaEl.querySelector('[data-acao="ginasio-desafiar"]');
          if (bDf && bDf.getAttribute('aria-disabled') === 'true') mostraMotivo(bDf);
          break;
        }
        if (ui.gym) ui.gym.msg = rDf === FALHA_SALVAR ? FALHA_SALVAR : null;
        rerenderKeepScroll();
        bDf = telaEl.querySelector('[data-acao="ginasio-desafiar"]');
        if (bDf && bDf.getAttribute('data-motivo') === rDf) mostraMotivo(bDf); else motivoVivo(rDf);
        break;
      }
      // os botões do resumo: "Voltar à trilha" e, na derrota, "Tentar de novo" (o preparo com o mesmo time, só os cavalos
      // que ainda podem entrar)
      case 'ginasio-resumo': {
        var gR2 = ui.gym;
        if (ui.screen !== 'ginasio' || !gR2 || !gR2.res) break;
        if (id === 'denovo' && !gR2.res.venceu && !gR2.res.revanche && gR2.etapa === ginProgresso(gR2.id)) {
          gR2.time = gR2.res.cavalos.map(function (c) { return c.uid; }).filter(function (u) { var m = mountByUid(u); return !!m && !ginPreso(m); });
          gR2.res = null; gR2.msg = null;
          go('ginasio');
        } else if (id === 'trilha' || id === 'denovo') voltaDaSubtela();
        break;
      }
      // o cartão entre duelos: a tela de desafio do próximo duelo; e, nele, na tela de desafio e na do duelo, "Pular tudo" (o resumo)
      case 'ginasio-proximo': {
        var gPx = ui.gym, vPx = gPx && gPx.ver;
        if (ui.screen !== 'entreduelos' || !vPx || !gPx.res || !gPx.res.duelos[vPx.k + 1]) break;
        ginDesafio(vPx.k + 1);
        break;
      }
      // a tela de desafio: "Começar duelo" (o duelo k na tela de corrida)
      case 'ginasio-comecar': {
        var gCm = ui.gym, vCm = gCm && gCm.ver;
        if (ui.screen !== 'desafio' || !vCm || !gCm.res || !gCm.res.duelos[vCm.k]) break;
        ginAssiste(vCm.k);
        break;
      }
      case 'ginasio-pular-tudo':
        if ((ui.screen === 'corrida' || ui.screen === 'entreduelos' || ui.screen === 'desafio') && ui.gym && ui.gym.ver) ginPulaTudo();
        break;
      case 'ginasio-voltar':
      case 'montaria-voltar':
      case 'perfil-voltar':
        voltaDaSubtela(); break;
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
        var antesM = clone(state);
        state.pedras -= mo.cost;
        var mc = state.enhanceCounter;
        state.enhanceCounter += 1;
        var mr = GR.enhance(mi, state.seedBase, mc);
        var mAntes = mi.plus;
        mi.plus = mr.plus;
        var gM = gravaGasto(sM, antesM);
        if (gM === 'outra-aba') break;
        if (gM === 'falhou') { ui.montaria.equip.msg = FALHA_SALVAR; rerenderKeepScroll(); break; }
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
        var vp = GR.sellPrice(vi.id), antesV = clone(state);
        state.gold += vp;
        state.items = state.items.filter(function (x) { return x.uid !== id; });
        var gV = gravaGasto(sV, antesV);
        if (gV === 'outra-aba') break;
        if (gV === 'falhou') { ui.montaria.equip.msg = FALHA_SALVAR; rerenderKeepScroll(); break; }
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
        if (!podeGastar(un.price)) { ui.montaria.equip.msg = state.gold >= un.price ? reservaTxt() + '.' : 'Sem Ouro para desfazer a venda.'; rerenderKeepScroll(); break; }
        if (itemByUid(un.item.uid)) { rerenderKeepScroll(); break; }
        var antesU = clone(state);
        state.items.push(un.item);
        state.gold -= un.price;
        var gU = gravaGasto(sU, antesU);
        if (gU === 'outra-aba') break;
        if (gU === 'falhou') { ui.montaria.equip.undo = un; ui.montaria.equip.msg = FALHA_SALVAR; rerenderKeepScroll(); break; }
        ui.montaria.equip.msg = 'Venda desfeita: ' + GR.piece(un.item.id).name + ' voltou ao inventário';
        rerenderKeepScroll(); break;
      }
      case 'escolher':
        saveCorrompido = false;   // o aviso da tela inicial vale até o jogo recomeçar
        state = newState(id);
        if (ui.motionKeep) { state.settings.motion = ui.motionKeep; ui.motionKeep = null; }   // "Recomeçar" não apaga a preferência
        if (ui.joqueiKeep) { state.joquei = validJoquei(ui.joqueiKeep); ui.joqueiKeep = null; }   // nem o jóquei
        persist();
        guardaMotionKeep(null);   // a preferência agora está no save
        guardaJoqueiKeep(null);
        if (devHooks) devHooks.escolha(false);   // modo DEV: a escolha feita tira a marca do "Recomeçar"
        go('estabulo');
        break;
      case 'ver-inicial': {
        var card = document.getElementById('ini-' + id);
        if (card) { try { card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest', inline: 'center' }); } catch (e2) { card.scrollIntoView(); } }
        break;
      }
      case 'joquei-padrao':
      case 'joquei-capacete': {
        if (!state) break;
        var campoJ = b.getAttribute('data-acao') === 'joquei-padrao' ? 'padrao' : 'capacete';
        var vJ = b.getAttribute('data-v');
        var novoJ = validJoquei(joqueiDoJogador());
        novoJ[campoJ] = vJ;
        if (validJoquei(novoJ)[campoJ] !== (campoJ === 'capacete' ? String(vJ).toLowerCase() : vJ)) break;   // valor fora das listas
        novoJ = validJoquei(novoJ);
        var sJ = state, antesJ = clone(state);
        state.joquei = novoJ;
        var gJ = gravaGasto(sJ, antesJ);
        if (gJ === 'outra-aba') break;
        if (gJ === 'falhou') ui.notice = FALHA_SALVAR;
        rerenderKeepScroll(); break;
      }
      case 'motion':
        if (!state || MOTIONS.indexOf(id) < 0) break;
        state.settings = { motion: id };
        persist(); syncMotionClass(); rerenderKeepScroll(); break;
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
        if (!L.training && state.gold < L.fee) {
          // Ouro abaixo da entrada (outra aba, save adulterado): a mesma sala vira treino e a tela mostra isso
          var LR = openLobby(false);
          if (!LR) { if (ui.notice === FALHA_SALVAR) rerenderKeepScroll(); break; }   // não gravou (ou outra aba)
          ui.lobby = LR;
          ui.notice = 'Seu Ouro ficou abaixo da entrada: este páreo corre como treino, sem aposta.';
          go('largada'); break;
        }
        var sAntes = state, antesL = clone(state), condAntes = L.cond;
        var resL = settle(L);
        var gL = gravaGasto(sAntes, antesL);
        if (gL === 'outra-aba') { ui.result = null; break; } // conflito no meio da liquidação: descarta o resultado misto
        if (gL === 'falhou') {   // sem gravar o débito, nada de resultado: a sala continua aberta como estava
          L.sim = null; L.cond = condAntes;
          ui.notice = FALHA_SALVAR;
          rerenderKeepScroll(); break;
        }
        if (DEV_MODE) ui.devNext = null;
        ui.result = resL;
        ui.resultAba = 'chegada';   // cada resultado novo abre na aba Chegada
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
        if (e.detail >= 2 && Date.now() - corridaDesde < PULAR_GUARDA_MS) break;   // o 2º toque do "Largar!" (ver PULAR_GUARDA_MS)
        if (raceView) raceView.skip(); else corridaAtual().fim();
        break;
      case 'denovo':
        if (state.gold < MIN_ENTRY) startLobby(true); else startLobby(false);
        break;
      case 'ativar':
        if (state.pending || !mountByUid(id) || id === state.activeId) break;   // nunca confia no botão
        state.activeId = id; persist(); rerenderKeepScroll();
        if (ui.screen === 'montaria') {   // o "Tornar ativa" some da aba Ficha da nova ativa: o foco iria para o body
          var hf = telaEl.querySelector('[data-foco]');
          if (hf) { try { hf.focus({ preventScroll: true }); } catch (e) { hf.focus(); } }
        }
        break;
      case 'renomear': {
        if (!ui.montaria || !mountByUid(id)) break;
        ui.montaria.renomear = { valor: mountByUid(id).name, erro: null };
        render(); focaRenomear(); break;
      }
      case 'renomear-ok':
        renomearConfirma(); break;
      case 'renomear-nao':
        renomearCancela(); break;
      case 'liberar':
        if (!mountByUid(id) || motivoLiberar(mountByUid(id))) break;   // nunca confia no botão
        ui.confirmLiberar = id; rerenderKeepScroll(); focusAction('liberar-nao', id); break;
      case 'liberar-nao':
        ui.confirmLiberar = null; rerenderKeepScroll(); focusAction('liberar', id); break;
      case 'liberar-sim':
        ui.confirmLiberar = null;
        if (mountByUid(id) && !motivoLiberar(mountByUid(id))) {
          state.mounts = state.mounts.filter(function (m) { return m.uid !== id; });
          persist();
        }
        if (ui.screen === 'montaria') go(ui.tab); else rerenderKeepScroll();
        break;
      case 'expandir':
        if (state.stableSlots >= BR.stableSlotsMax || !podeGastar(SLOT_PRICE)) {
          if (state.gold >= SLOT_PRICE) ui.notice = reservaTxt() + '.';
          rerenderKeepScroll(); break;
        }
        var sE = state, antesE = clone(state);
        state.gold -= SLOT_PRICE; state.stableSlots += 1;
        var gE = gravaGasto(sE, antesE);
        if (gE === 'outra-aba') break;
        if (gE === 'falhou') ui.notice = FALHA_SALVAR;
        rerenderKeepScroll(); break;
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
        var antesCz = clone(state);
        state.gold -= PC.price;
        var potro = harasFoal(PC);
        PC.mine.breedLeft -= 1;
        if (PC.kind === 'own') PC.partner.breedLeft -= 1;
        state.mounts.push(potro);
        var gCz = gravaGasto(sC, antesCz);
        if (gCz === 'outra-aba') break;
        if (gCz === 'falhou') { ui.notice = FALHA_SALVAR; rerenderKeepScroll(); break; }
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
        var antesT = clone(state);
        state.gold -= BR.exchange;
        var potroT = harasFoal(PX);
        var gone = [PX.mine.uid, PX.partner.uid];
        state.mounts = state.mounts.filter(function (m) { return gone.indexOf(m.uid) < 0; });
        state.mounts.push(potroT);
        if (gone.indexOf(state.activeId) >= 0) state.activeId = potroT.uid;
        var gT = gravaGasto(sT, antesT);
        if (gT === 'outra-aba') break;
        if (gT === 'falhou') { ui.notice = FALHA_SALVAR; rerenderKeepScroll(); break; }
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
        ui.motionKeep = motionPref();
        guardaMotionKeep(ui.motionKeep);
        ui.joqueiKeep = validJoquei(joqueiDoJogador());
        guardaJoqueiKeep(ui.joqueiKeep);
        ui.confirmReset = false;
        if (!wipeSave()) break;   // save de versão mais nova: tela de bloqueio
        if (devHooks) devHooks.recomecaEscolha();   // perfil de teste: a escolha fica marcada (recarregar não cria a Brasa)
        state = null; ui.lobby = null; ui.result = null; go('inicial'); break;
    }
  });

  // campo de renomear (tela da Montaria): mesmas regras de antes (espaços juntados, 2 a 16 letras; o nome é
  // escapado ao desenhar). Enter confirma, Esc cancela.
  function focaRenomear() {
    var el = document.getElementById('renomear-campo');
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } el.select(); }
  }
  function renomearConfirma() {
    var M = ui.montaria, rm = M && M.renomear ? mountByUid(M.uid) : null;
    if (!rm) return;
    var el = document.getElementById('renomear-campo');
    var nome = String(el ? el.value : M.renomear.valor).replace(/\s+/g, ' ').trim().slice(0, 16);
    if (nome.length < 2) {
      M.renomear = { valor: el ? el.value : '', erro: 'O nome precisa ter de 2 a 16 letras.' };
      rerenderKeepScroll(); focaRenomear(); return;
    }
    rm.name = nome; M.renomear = null; persist();
    rerenderKeepScroll(); focusAction('renomear', rm.uid);
  }
  function renomearCancela() {
    if (!ui.montaria || !ui.montaria.renomear) return;
    ui.montaria.renomear = null;
    rerenderKeepScroll(); focusAction('renomear', ui.montaria.uid);
  }
  telaEl.addEventListener('keydown', function (e) {
    if (saveBloqueado || !e.target || e.target.id !== 'renomear-campo') return;
    if (e.key === 'Enter') { e.preventDefault(); renomearConfirma(); }
    else if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); renomearCancela(); }
  });

  // n (opcional): data-n, para os botões que repetem a ação e o id (os +1, +5 e +10 da aba Status)
  function focusAction(acao, id, n) {
    var sel = '[data-acao="' + acao + '"]' + (id != null ? '[data-id="' + id + '"]' : '') + (n != null ? '[data-n="' + n + '"]' : '');
    var el = telaEl.querySelector(sel);
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
    focoAcimaDaBarra(el);
  }
  // Redesenho que não vem do jogador (moldes carregados, largura da janela mudou): o aviso da tela continua.
  function redesenhoPassivo() {
    if (ui.avisoNaTela && !ui.notice) ui.notice = ui.avisoNaTela;
    rerenderKeepScroll();
  }
  function rerenderKeepScroll() {
    var y = window.scrollY;
    var active = document.activeElement;
    var acao = active && active.getAttribute && active.getAttribute('data-acao');
    var id = active && active.getAttribute && active.getAttribute('data-id');
    var n = active && active.getAttribute && active.getAttribute('data-n');
    var naDiaria = !!(active && active.classList && active.classList.contains('diaria-linha'));   // o foco depois do resgate
    render();
    window.scrollTo(0, y);
    if (acao) focusAction(acao, id, n);
    else if (naDiaria) { var ld = telaEl.querySelector('.diaria-linha'); if (ld) { try { ld.focus({ preventScroll: true }); } catch (e) { ld.focus(); } } }
  }

  // ===========================================================================
  // Laço de animação
  // ===========================================================================
  // Só roda com corrida na tela ou retrato animado visível (IntersectionObserver); parado nos menus sem
  // animação e no resultado depois do pódio sair da tela. acordaLaco() religa (render, rolagem, preferência).
  var lastIdle = 0, lacoAtivo = false;
  var visObs = window.IntersectionObserver ? new window.IntersectionObserver(function (ents) {
    for (var e = 0; e < ents.length; e++) ents[e].target.__visivel = ents[e].isIntersecting;
    acordaLaco();
  }) : null;
  function vivo(item, cv) {
    item.cv = cv;
    cv.__visivel = !visObs;
    if (visObs) visObs.observe(cv);
    live.push(item);
  }
  function precisaLaco() {
    if (raceView) return true;
    if (reduced()) return false;   // em movimento reduzido os retratos ficam parados (já desenhados)
    for (var i = 0; i < live.length; i++) if (live[i].cv.__visivel) return true;
    return false;
  }
  function acordaLaco() {
    if (lacoAtivo || !precisaLaco()) return;
    lacoAtivo = true;
    window.requestAnimationFrame(loop);
  }
  function loop(now) {
    reducedQuadro = null;
    reducedQuadro = reduced();
    try {
      if (!precisaLaco()) { lacoAtivo = false; return; }
      window.requestAnimationFrame(loop);
      if (raceView) raceView.frame(now);
      if (live.length && !reducedQuadro && now - lastIdle > 70) {
        lastIdle = now;
        var t = now / 1000;
        for (var i = 0; i < live.length; i++) if (live[i].cv.__visivel) live[i].draw(t);
      }
    } finally { reducedQuadro = null; }
  }

  // ===========================================================================
  // Início (com suporte opcional a window.claude.hot)
  // ===========================================================================
  // start() ignora data.screen (sempre abre no Estábulo ou no inicial): o snapshot só leva o save
  function snapshot() {
    return { save: state, dev: DEV_MODE };   // o snapshot de um modo nunca é adotado pelo outro
  }

  // O saneamento consertou o dia da revanche de algum ginásio? (o do disco, bruto, contra o saneado) Ginásio ausente não
  // conta (vira novo, revDia null, sem dia para consertar); presente e não objeto, ou com revDia que não é null nem um dia
  // válido, conta (o saneado vale hoje).
  function revDiaConsertado(bruto, gs) {
    var b = objetoOu(bruto);
    if (!b) return false;
    return GD.GYM_ORDER.some(function (id) {
      if (!hasOwn(b, id) || b[id] === undefined) return false;
      var o = objetoOu(b[id]);
      return !o || o.revDia !== gs[id].revDia;
    });
  }

  var started = false;
  function start(data) {
    if (started) return;   // nunca dois laços de animação
    started = true;
    readTokens();
    data = data || {};
    var lido = loadSave(), doHot = !!data.dev === DEV_MODE ? data.save : null;
    // save de versão mais nova no disco ou no estado do hot: nada é saneado, migrado nem gravado (tela de bloqueio)
    if (saveMaisNovo(doHot) || saveMaisNovo(lido)) bloqueiaSaveNovo(true);
    if (!saveBloqueado) {
      var doHotOk = sanitize(doHot);
      state = doHotOk || sanitize(lido);
      // JSON válido mas que não vira save (sanitize null): também guarda a cópia antes de recomeçar
      if (!state && lido != null && !saveCorrompido) { try { guardaCorrompido(window.localStorage.getItem(SAVE_KEY)); } catch (e) { /* ignora */ } }

      // save migrado para a v6 (bloco 1b): o Estábulo avisa uma vez que os pontos voltaram para distribuir; o aviso
      // sai do save na mesma gravação da migração (logo abaixo), então recarregar não o mostra de novo
      var gravaAviso = false;
      if (state && state.avisoV6) { ui.notice = AVISO_V6; state.avisoV6 = false; gravaAviso = true; }
      // save de versão anterior migrado: grava já a versão nova (a migração acontece uma vez só; o Neutro
      // convertido, os pontos devolvidos e o Poder da sala recalculado ficam no disco)
      if (state && ((lido && typeof lido === 'object' && !(Number(lido.v) >= SAVE_VERSION)) || gravaAviso)) persist();
      // save da versão atual do disco com dia ou limite corrompido (diária, limites da loja): grava já o consertado, para o bloqueio durar
      // um dia (Rulings 8 e 21); sem isso, cada abertura tornava a valer "hoje". O persist() de sempre (guarda do save mais novo)
      // O mesmo para o dia da revanche de um ginásio (save v8; Ruling 3 dos ginásios): estragado vale hoje e vai já ao disco
      else if (state && !doHotOk && lido && typeof lido === 'object' && Number(lido.v) >= SAVE_VERSION &&
        (JSON.stringify(lido.diaria) !== JSON.stringify(state.diaria) || JSON.stringify(lido.lojaItens) !== JSON.stringify(state.lojaItens) ||
          revDiaConsertado(lido.ginasios, state.ginasios))) persist();
      // perfil DEV novo: Brasa, sem a escolha inicial (menos depois do "Recomeçar com outro inicial": aí a escolha continua)
      if (!state && !saveBloqueado && devHooks && !devHooks.escolha()) { state = devHooks.novoPerfil(); persist(); }
      if (!state && !saveBloqueado) { ui.motionKeep = leMotionKeep(); ui.joqueiKeep = leJoqueiKeep(); }   // "Recomeçar" e a aba fechou na escolha: as escolhas continuam
    }
    ui.screen = saveBloqueado ? 'bloqueio' : state ? 'estabulo' : 'inicial';
    // moldes do PixelLab (embutidos pelo build): decodificam em segundo plano; até lá (ou sem eles, ou
    // com ?semmoldes=1) os cavalos saem do desenho por código. Ao chegarem, a tela é redesenhada — menos
    // a corrida, que redesenha sozinha a cada quadro (re-renderizar recriaria a corrida).
    if (!/[?&]semmoldes=1(&|$)/.test(window.location.search) && window.__MOLDES) {
      // (na corrida, refaz só o layout: a escala de trabalho do canvas depende da escala dos moldes)
      SP.loadMolds(window.__MOLDES, function () { if (ui.screen !== 'corrida') redesenhoPassivo(); else if (raceView) raceView.relayout(); });
    }
    try {
      var hot = window.claude && window.claude.hot;
      if (hot && typeof hot.snapshot === 'function') hot.snapshot(snapshot);
    } catch (e) { /* opcional */ }
    aplicaGrade();
    render();   // liga o laço de animação se a tela tiver o que animar
    // só a largura (ou a densidade) muda o layout fora da corrida: a barra de endereço do celular
    // mudando a altura não reconstrói a tela no meio da rolagem
    var resizeTimer = null, lastW = window.innerWidth, lastDpr = dpr();
    window.addEventListener('resize', function () {
      aplicaGrade();
      if (ui.screen === 'corrida') return;
      if (window.innerWidth === lastW && dpr() === lastDpr) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (ui.screen === 'corrida') return;
        lastW = window.innerWidth; lastDpr = dpr();
        redesenhoPassivo();
      }, 150);
    });
    // a preferência de movimento do aparelho mudou: vale na hora para quem segue o sistema
    if (motionQuery) {
      var onMotion = function () { syncMotionClass(); if (ui.screen === 'perfil') rerenderKeepScroll(); acordaLaco(); };
      if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
      else if (motionQuery.addListener) motionQuery.addListener(onMotion);
    }
    // outra aba gravou: adota o save mais novo em vez de sobrescrevê-lo depois; save de versão mais nova (qualquer
    // revisão): tela de bloqueio (adoptExternal); já bloqueado, nada mais é adotado
    window.addEventListener('storage', function (ev) {
      if (saveBloqueado || (ev.key !== SAVE_KEY && ev.key !== null)) return;
      var raw = null;
      try { raw = ev.newValue ? JSON.parse(ev.newValue) : null; } catch (e) { raw = null; }
      if (raw && state && !saveMaisNovo(raw) && Number(raw.rev) <= state.rev) return;
      adoptExternal(raw);
    });
    // a aba voltou a ficar visível (o jogo ficou aberto de um dia para o outro): se o dia virou, a tela é desenhada de novo
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && diaVirou()) redesenhaDia();
    });
    /*@teste:inicio*/
    // ganchos para testes automatizados (fora do jogo de produção)
    window.__galope = {
      get state() { return state; }, get ui() { return ui; }, get race() { return raceView; },
      // monta a sala de um pending ({ counter, training, fee, pr }) sem gravar nada (medição do pareamento no ui-test)
      buildLobby: function (P) { return buildLobby(P); },
      hojeDia: function () { return hojeDia(); },
      bonusConta: function () { return bonusConta(); },
      GEAR_ON: GEAR_ON
    };
    // rascunho dos pontos livres da tela da Montaria (null sem rascunho), para o teste ler
    Object.defineProperty(ui, 'rascunho', { configurable: true, get: function () { return ui.montaria ? ui.montaria.rascunho : null; } });
    /*@teste:fim*/
  }

  var hotApi = window.claude && window.claude.hot;
  if (hotApi && hotApi.ready) hotApi.ready(start);
  else start((hotApi && hotApi.data) || {});
})();
