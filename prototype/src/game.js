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
 * re-sorteio grátis). O equipamento (persistente, por montaria) entra no pareamento; com páreo aberto
 * só trocas que não passem do Poder da sala.
 * A corrida é calculada por RaceSim.simulate (função pura da seed) só quando o jogador aperta
 * "Largar!", depois de pagar a entrada, como um servidor faria; a tela de corrida só anima os
 * frames. Ouro e XP são liquidados nesse momento: recarregar no meio da corrida não muda nada.
 * A seed base é sorteada por save (crypto), fora da simulação.
 */
(function () {
  'use strict';

  var GD = window.GameData, RS = window.RaceSim, SP = window.Sprites, GR = window.Gear, FX = window.RaceFx;
  var telaEl = document.getElementById('tela');
  var appEl = document.getElementById('app');
  if (!GD || !RS || !SP || !GR || !FX || !telaEl) {
    if (telaEl) telaEl.textContent = 'Não foi possível carregar o jogo (faltam data.js, sim.js, gear.js, sprites.js ou fx.js).';
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
  var STAT_KEYS = GD.STAT_KEYS || ['vel', 'acel', 'man', 'forca', 'est', 'garra', 'sorte'];
  var TRAINING_GOLD = [30, 22, 16, 12, 10, 10, 10, 10];
  var MIN_ENTRY = Math.min.apply(null, E.entryTiers);
  var WILD_SHOWCASE = ['w-faisca', 'w-mandacaru', 'w-ventania', 'w-fogareu', 'w-iara', 'w-boitata'];
  var TRACK_NAMES = [
    'Prado do Cerrado', 'Hipódromo da Lagoa', 'Raia do Engenho', 'Prado Beira-Rio',
    'Hipódromo do Planalto', 'Raia da Ventania', 'Prado das Palmeiras', 'Hipódromo do Sertão Velho'
  ];
  var PLAYER_NAME = 'Você';
  var PLAYER_SILKS = '#f2c230';
  var BOT_SILKS = SP.SILKS.filter(function (c) { return c.toLowerCase() !== PLAYER_SILKS; });
  var PORTRAIT_SCALE = 3;        // escala única dos retratos em todas as telas
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
  function storedRev() {
    try {
      var raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return -1;
      var s = JSON.parse(raw);
      return s && isFinite(s.rev) ? Number(s.rev) : 0;
    } catch (e) { return -1; }
  }
  // Há armazenamento? Sem ele (iframe sem localStorage, acesso bloqueado) o jogo roda só em memória e
  // persist() não tem o que gravar. Com ele, uma gravação que lança (cota cheia) é uma FALHA: quem gasta
  // desfaz a ação (gravaGasto).
  var STORAGE_OK = (function () {
    try { var ls = window.localStorage; if (!ls) return false; ls.getItem(SAVE_KEY); return true; } catch (e) { return false; }
  })();
  // Grava o state. Devolve true se gravou (ou se não há armazenamento: tudo segue em memória) e false se a
  // gravação falhou ou se outra aba tinha gravado depois (aí o state já é o adotado: quem chama compara).
  function persist() {
    if (!state) return true;
    /*@dev:inicio*/
    if (DEV_MODE && ui.dev.ouroInf) DV.refillGold(state);   // Ouro infinito do perfil DEV: repõe depois de cada gasto
    /*@dev:fim*/
    var sr = storedRev();
    if (sr > state.rev) { adoptExternal(loadSave()); return false; }   // outra aba gravou depois: não sobrescreve
    state.rev = Math.max(state.rev, sr) + 1;
    if (!STORAGE_OK) return true;
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
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
  function wipeSave() {
    try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignora */ }
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
  var SAVE_VERSION = 5;
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
      palette: tpl.palette ? clone(tpl.palette) : null,
      breedLeft: tpl.breedLeftMax || GD.BREED_LEFT[tpl.sex],
      parents: null,
      born: 0,
      equip: GR.emptyEquip()
    };
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
      settings: { motion: 'sistema' }
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

  // Cavalo Neutro (o tipo saiu na v3) vira Fogo, Água ou Grama: sorteio fixo pela seed do save e pelo
  // número do uid, sem RNG de jogo. Vale para save de qualquer versão; o convertido não é mais Neutro.
  var NEUTRO_PARA = ['fogo', 'agua', 'grama'];
  function neutroParaTipo(seedBase, uid) {
    return NEUTRO_PARA[(RS.hash2(seedBase >>> 0, Number(uid.slice(1))) >>> 0) % NEUTRO_PARA.length];
  }

  // Uma montaria do save v3+: tipos e faixas; campo essencial ausente ou genética inválida -> null.
  // seedBase: a seed do save (converte o Neutro); v5: o save já é v5 (antes dele, os pontos vêm zerados).
  // Modelo fora do catálogo: a montaria fica, sem modelo.
  function sanitizeMount(m, seedBase, v5) {
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
      palette: validPalette(m.palette),
      breedLeft: num(m.breedLeft, GD.BREED_LEFT[m.sex], 0, 4),
      parents: validParents(m.parents),
      born: num(m.born, 0, 0, 1e9),
      // ('gestacao', gravado por saves antigos e nunca lido, fica de fora)
      equip: GR.emptyEquip()      // preenchido em sanitize(), que conhece as peças válidas
    };
    out.alloc = RS.validAlloc(out, v5 ? m.alloc : null);   // save antigo: zerado; inválido: saneado pelos pontos livres
    out.skills = validSkills(m.skills, out);
    return out;
  }

  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var mounts, activeId, nextUid, stableSlots, breedCounter;
    var start = BR.stableSlotsStart, max = BR.stableSlotsMax;
    var v3 = Number(s.v) >= 3, v4 = Number(s.v) >= 4, v5 = Number(s.v) >= SAVE_VERSION;
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
        var m = sanitizeMount(raw, seedBase, v5);
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
    sanitizeGear(s, v4, base, rawEquip);
    // Poder da sala = Poder da montaria ativa com o equipamento e os pontos de quando a sala abriu (retratos
    // pending.gear e pending.alloc, tirados em openLobby), nem mais (liberaria trocas de peça e de pontos) nem
    // menos (os rivais sairiam mais fracos). Sem o retrato do equipamento (save de antes dele) o pr gravado fica
    // como está: recalcular pelo equipamento atual mudaria os rivais da mesma sala. Exceção: save de antes da
    // v5 (o pr é do modelo de status antigo), recalculado uma vez pelo equipamento atual; o save migrado é
    // gravado logo ao abrir e daí em diante o pr fica. Sem o retrato dos pontos (sala de antes dele, ou lixo
    // que não é objeto) vale o alloc atual, uma vez: o retrato passa a existir e vai na próxima gravação.
    // Em qualquer caso o pr nunca fica abaixo do Poder com que a ativa corre agora (R16): pelas travas da tela
    // ele nunca passa do pr, então só um retrato adulterado para baixo é corrigido.
    if (base.pending) {
      var act = null, its = {};
      base.mounts.forEach(function (m) { if (m.uid === base.activeId) act = m; });
      base.items.forEach(function (it) { its[it.uid] = it; });
      base.pending.alloc = RS.validAlloc(act, base.pending.alloc || act.alloc);
      if (base.pending.gear || !v5) {
        var retrato = clone(act);
        retrato.alloc = base.pending.alloc;
        base.pending.pr = RS.powerRating(retrato, base.pending.gear ? gearFromSnapshot(base.pending.gear) : GR.resolve(act, its));
      }
      base.pending.pr = Math.max(base.pending.pr, RS.powerRating(act, GR.resolve(act, its)));
    }
    // preferências (sem mudar a versão do save): save antigo sem settings, ou com valor inválido, segue o sistema
    var mo = s.settings && typeof s.settings === 'object' ? s.settings.motion : null;
    base.settings = { motion: MOTIONS.indexOf(mo) >= 0 ? mo : 'sistema' };
    return base;
  }

  // Retrato do equipamento da montaria ativa quando a sala abre (state.pending.gear): [{ slot, id, plus }].
  // Não aponta para as peças do inventário (que podem ser vendidas ou melhoradas depois), só copia.
  function gearSnapshot(gear) {
    return gear.pieces.map(function (p) { return { slot: p.slot, id: p.id, plus: p.plus }; });
  }
  function gearFromSnapshot(snap) {
    var equip = {}, items = {};
    snap.forEach(function (p, i) { equip[p.slot] = 's' + i; items['s' + i] = { uid: 's' + i, id: p.id, plus: p.plus }; });
    return GR.resolve({ equip: equip }, items);
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
      var sid = RS.learnSkill({ id: mount.templateId, element: mount.element, rarity: mount.rarity, skills: mount.skills }, lrng);
      if (sid) { mount.skills.push(sid); learned.push(sid); }
    }
    return { levels: levels, learned: learned };
  }

  // ===========================================================================
  // Estado de UI (não persistido)
  // ===========================================================================
  var state = null;
  var ui = { screen: 'inicial', lobby: null, result: null, confirmReset: false, confirmLiberar: null, notice: null, haras: null, montaria: null, tab: 'estabulo',
    motionKeep: null,   // "Recomeçar": a opção Animações passa para o save novo
    // modo DEV (só com DEV_MODE): gaveta, confirmação do "Zerar" e valores armados para a próxima corrida
    // (ver a seção "Modo DEV")
    dev: { aberto: false, ouroInf: true, msg: '', f: null, confirmZerar: false }, devNext: null };
  var live = [];          // canvases animados da tela atual
  var raceView = null;
  var portraitQueue = [];

  // Outra aba gravou um save mais novo: adota e volta para um ponto seguro.
  function adoptExternal(raw) {
    var s = sanitize(raw);
    if (!s && devHooks) s = devHooks.novoPerfil();   // perfil DEV apagado em outra aba: nasce de novo com a Brasa
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
    return iconeHtml('el-' + element, '<canvas class="icone" data-icon="' + esc(element) + '" aria-hidden="true"></canvas>');
  }

  // Retrato: baia com parede de tábuas e palha; cavalo parado (respira, pisca, abana o rabo,
  // descansa um posterior e abaixa a cabeça de vez em quando).
  var PORTRAIT_W = 48, PORTRAIT_H = 36;
  // opts.selo: moldura com o selo "Nv N" no canto (e, com opts.pontos > 0, o aviso "+N" de pontos livres)
  function portraitHtml(horse, opts) {
    opts = opts || {};
    var id = portraitQueue.length;
    portraitQueue.push({ horse: horse, opts: opts });
    var cv = '<canvas class="retrato" data-retrato="' + id + '" role="img" aria-label="' +
      esc('Retrato de ' + horse.name) + '"></canvas>';
    if (!opts.selo) return cv;
    var pts = opts.pontos > 0 ? '<span class="pontos-livres pontos-livres--selo" title="' +
      esc(opts.pontos + (opts.pontos === 1 ? ' ponto livre' : ' pontos livres') + ' para distribuir') + '">+' + esc(opts.pontos) + '</span>' : '';
    return '<span class="retrato-moldura">' + cv + '<span class="selo-nivel">Nv ' + esc(horse.level) + '</span>' + pts + '</span>';
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
            // quadro: o molde inteiro cabe na altura da baia (o desenho por código já cabe)
            SP.drawHorse(s.ctx, 5 * s.k, 1 * s.k, {
              palette: horse.palette, element: horse.element, idle: true, t: reduced() ? 0.5 : t + phase,
              scale: s.k, jockey: !!o.jockey, silks: o.silks || PLAYER_SILKS, quadro: { topo: 0, base: PORTRAIT_H * s.k }
            });
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
  // Barras em 20 segmentos inteiros (cada um = 5 pontos): nada de meio segmento. teto (opcional): os
  // segmentos vazios acima do teto da raridade ficam marcados (.teto).
  function barHtml(v, b, teto) {
    var SEG = 20;
    var fill = clamp(Math.round(v / 5), 0, SEG), base = b == null ? fill : clamp(Math.round(b / 5), 0, SEG);
    var lim = teto == null ? SEG : clamp(Math.round(teto / 5), 0, SEG);
    var out = '';
    for (var i = 0; i < SEG; i++) {
      var cls = '';
      if (i < Math.min(fill, base)) cls = 'on';
      else if (i < fill) cls = 'on extra';
      else if (i < base) cls = 'menos';
      else if (i >= lim) cls = 'teto';
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
  function skillHtml(id, tam) {
    var sk = hasOwn(GD.SKILLS, id) ? GD.SKILLS[id] : null;
    if (!sk) return '';
    return '<div class="habilidade"><b>' + skillIcone(id, tam) + esc(sk.name) + '</b><span>' + esc(sk.desc) + '</span></div>';
  }
  // Skill de tipo: vaga própria, sempre ativa, num terço da pista; o efeito já multiplicado pela força P
  // (RaceSim.typeSkill), os mesmos números que a simulação usa.
  var TERCOS = ['primeiro terço', 'terço do meio', 'último terço'];
  function num1(x) { return (Math.round(x * 10) / 10).toFixed(1).replace('.', ','); }
  function tercoTxt(ts) { return TERCOS[clamp(Math.round(ts.zone[0] * 3), 0, 2)]; }
  function efeitoTipoTxt(ts) {
    var e = ts.effect, P = ts.power, out = [];
    if (e.accelMult) out.push('+' + num1(e.accelMult * P * 100) + '% de aceleração');
    if (e.forcaAdd) out.push('+' + num1(e.forcaAdd * P * 100) + ' de Força' + (e.manAdd ? ' e de Manobra' : ''));
    if (e.drainCut) out.push('−' + num1(e.drainCut * P * 100) + '% de gasto de fôlego');
    if (e.speedMult) out.push('+' + num1(e.speedMult * P * 100) + '% de velocidade');
    if (e.staminaRestore) out.push('recupera ' + num1(e.staminaRestore * P * 100) + '% do fôlego ao entrar');
    return out.join(' · ');
  }
  function vagaTipoHtml(horse) {
    var ts = RS.typeSkill(horse);
    if (!ts) return '';
    var el = elementOf(horse.element);
    return '<div class="vaga-tipo vaga-tipo--' + esc(el.id) + '"><span class="vaga-tipo-rotulo">Skill de tipo · sempre ativa</span>' +
      '<b>' + skillIcone(ts.id, 32) + esc(ts.name) + '</b>' +
      '<span>' + esc('Age no ' + tercoTxt(ts) + ' da pista: ' + efeitoTipoTxt(ts) + '.') + '</span>' +
      '<span class="vaga-tipo-forca">' + esc('Intensidade ×' + ts.power.toFixed(2).replace('.', ',') + ': cresce com o nível e a raridade') + '</span></div>';
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

  /*@dev:inicio*/
  // ===========================================================================
  // Modo DEV (DEV_MODE: ?dev=1 ou o build jogo-dev.html): perfil de teste, faixa no topo, botão "DEV" e gaveta
  // ---------------------------------------------------------------------------
  // - Save: SAVE_KEY = Dev.SAVE_KEY ('galope-elemental:dev'); o save real nunca é lido nem gravado.
  //   Perfil novo (ou apagado) nasce com a Brasa, sem a escolha inicial (devNovoPerfil). "Zerar perfil de
  //   teste" (confirmação em dois passos na gaveta: window.confirm não abre num iframe sem allow-modals) e o
  //   "Recomeçar" do Perfil fazem o mesmo (devZerarPerfil).
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
  // "Zerar perfil de teste" (gaveta) e "Recomeçar" (Perfil) no modo DEV: o save de teste volta à Brasa, sem a
  // escolha inicial; a opção Animações continua. Quem chama navega.
  function devZerarPerfil() {
    var motion = motionPref();
    wipeSave();
    state = devNovoPerfil();
    state.settings.motion = motion;
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
        pedras: null, copiar: GD.STARTERS[0].id,
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
  }
  function devLerCampos() {
    var f = devForm();
    if (!devEl) return f;
    Array.prototype.forEach.call(devEl.querySelectorAll('[data-dev-campo]'), function (el) {
      var k = el.getAttribute('data-dev-campo');
      if (k !== 'ouroinf') f[k] = el.type === 'checkbox' ? el.checked : el.value;
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
      palette: { coat: f.coat, coatShade: f.coatshade, mane: f.mane, accent: f.accent }
    };
  }
  // pontos do template (inteiros ≥ 0) cortados pelo limite e pelos pontos livres do nível da instância
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
    var distancias = [['', '— da sala —']];
    for (var dd = 1000; dd <= 2400; dd += 100) distancias.push([String(dd), dd + ' m']);

    var moedas = devGrupo('moedas', 'Moedas',
      devCheck('ouroinf', 'Ouro infinito (volta a ' + fmt(DV.GOLD_INF) + ' depois de cada gasto)', ui.dev.ouroInf) +
      '<div class="dev-campos">' + devEntrada('pedras', 'Pedras Negras', 'type="number" min="0" max="1000000" inputmode="numeric"', f.pedras != null ? f.pedras : state.pedras) +
        '<div class="dev-acoes dev-acoes--base">' + devBotao('dev-pedras', 'Definir Pedras') + '</div></div>' +
      '<div class="dev-acoes">' + devBotao('dev-ouro', '+' + fmt(1000) + ' Ouro') + '</div>');

    var cavalo = devGrupo('cavalo', 'Cavalo',
      '<p class="nota">Cria um cavalo novo (entra no estábulo sem limite de vagas e vira a ativa) ou substitui a ativa (status, skills e cores; mantém equipamento e cruzas).</p>' +
      '<div class="dev-campos dev-campos--1">' + devEntrada('nome', 'Nome', 'type="text" maxlength="16" autocomplete="off"', f.nome) + '</div>' +
      '<div class="dev-campos">' +
        devSelect('elemento', 'Elemento', elementos, f.elemento) + devSelect('raridade', 'Raridade', raridades, f.raridade) +
        devSelect('sexo', 'Sexo', [['m', 'Macho'], ['f', 'Fêmea']], f.sexo) +
        devEntrada('nivel', 'Nível (1–' + MAX_LEVEL + ')', 'type="number" min="1" max="' + MAX_LEVEL + '" inputmode="numeric"', f.nivel) +
        devSelect('potencial', 'Genética', potenciais, f.potencial) +
        devSelect('estrelas', 'Estrelas', [['1', '1 estrela'], ['2', '2 estrelas'], ['3', '3 estrelas']], f.estrelas) +
      '</div>' +
      '<p class="nota">Genética por status (0–31, com "Genética: por status") e pontos distribuídos (cortados pelo limite por status e pelos pontos livres do nível).</p>' +
      '<div class="dev-campos dev-campos--4">' + STAT_KEYS.map(function (k) {
        return devEntrada('gen-' + k, 'Gen. ' + GD.STATS[k].short, 'type="number" min="0" max="31" inputmode="numeric"', f['gen-' + k]);
      }).join('') + '</div>' +
      '<div class="dev-campos dev-campos--4">' + STAT_KEYS.map(function (k) {
        return devEntrada('pt-' + k, 'Pontos ' + GD.STATS[k].short, 'type="number" min="0" max="' + MAX_LEVEL * 2 + '" inputmode="numeric"', f['pt-' + k]);
      }).join('') + '</div>' +
      '<p class="nota">Skills: qualquer uma do catálogo; ' + GD.RARITIES[f.raridade in GD.RARITIES ? f.raridade : 'comum'].name + ' usa até ' + vagas + '.</p>' +
      '<div class="dev-campos dev-campos--1">' + skillSel + '</div>' +
      '<div class="dev-campos dev-campos--4">' +
        devEntrada('coat', 'Pelagem', 'type="color"', f.coat) + devEntrada('coatshade', 'Sombra', 'type="color"', f.coatshade) +
        devEntrada('mane', 'Crina', 'type="color"', f.mane) + devEntrada('accent', 'Detalhe', 'type="color"', f.accent) +
      '</div>' +
      '<div class="dev-acoes">' + devBotao('dev-criar', 'Criar cavalo', 'btn--ouro') + devBotao('dev-aplicar', 'Aplicar na ativa') + devBotao('dev-carregar', 'Carregar a ativa') + '</div>' +
      '<div class="dev-campos dev-campos--1">' + devSelect('copiar', 'Copiar cavalo pronto (iniciais e aluguéis do Haras)', prontos, f.copiar) + '</div>' +
      '<div class="dev-acoes">' + devBotao('dev-copiar', 'Copiar para o estábulo') + devBotao('dev-niveis', '+10 níveis (ativa)') + devBotao('dev-cruz', '+1 cruzamento (ativa)') + devBotao('dev-devolver', 'Devolver pontos (ativa)') + '</div>');

    var itens = devGrupo('itens', 'Itens',
      '<p class="nota">Qualquer peça do catálogo, inclusive Lendária (só no perfil DEV). Comum e Mágico são peças soltas; Raro e Lendário usam o conjunto.</p>' +
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

    // Perfil: "Zerar perfil de teste" em dois passos, na própria gaveta (como o "Recomeçar" do Perfil), e
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
      moedas + cavalo + itens + corrida + perfil +
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
      devLerCampos();
      if (k === 'raridade') renderDev();   // a nota das vagas de skill muda com a raridade
    });
    devEl.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && ui.dev.aberto) { ui.dev.aberto = false; ui.dev.confirmZerar = false; renderDev(); devFoca('.dev-botao'); }
    });
  }
  // o que o resto do jogo chama do modo DEV (no jogo de produção, devHooks fica null)
  if (DEV_MODE) devHooks = { templateId: devTemplateId, novoPerfil: devNovoPerfil, zerarPerfil: devZerarPerfil, condicoes: devCondicoes, render: renderDev };
  /*@dev:fim*/

  function render() {
    ui.avisoNaTela = null;   // noticeHtml() o preenche se a tela desenhar um aviso
    if (visObs) visObs.disconnect();
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
    document.documentElement.classList.toggle('dev-ativo', DEV_MODE);   // faixa no topo e botão DEV (seção "Modo DEV")
    syncMotionClass();
    // folga no fim da tela para o conteúdo rolar acima do botão DEV fixo
    if (DEV_MODE && ui.screen !== 'corrida') html += '<div class="dev-espaco" aria-hidden="true"></div>';
    telaEl.innerHTML = ordFix(html);
    hydrate(telaEl);
    if (ui.screen === 'corrida') {
      if (raceView) raceView.destroy();
      raceView = createRaceView(ui.lobby, telaEl);
    }
    if (devHooks) devHooks.render();
    acordaLaco();
  }

  // ===========================================================================
  // Casca: cabeçalho fixo e barra de abas (abas e sub-telas)
  // ===========================================================================
  function appTopoHtml() {
    return '<header class="app-topo"><span class="logo-mini">' + logoHtml('Galope Elemental', 24) + '</span>' +
      '<span class="topo-saldos">' + pedrasSaldoHtml() +
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
      var cls = 'app-aba' + (ativa ? ' app-aba--ativa' : '') + (a.id === 'correr' && state.pending ? ' app-aba--ponto' : '');
      return '<button type="button" class="' + cls + '" data-acao="aba" data-id="' + esc(a.id) + '"' + (ativa ? ' aria-current="page"' : '') + '>' +
        '<span class="app-aba-icone" aria-hidden="true">' + iconeHtml('aba-' + a.id, a.icone, 32) + '</span><span class="app-aba-rotulo">' + esc(a.rotulo) + '</span></button>';
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
      animacoesHtml() +
      '<footer class="caixa">' + resetHtml() + '</footer></section>';
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
      var stats = RS.computeStats(h, null);
      var el = GD.ELEMENTS[h.element];
      var rating = RS.powerRating(h, null);
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
        '<div class="linha-meta">' + rarityHtml(h.rarity) + estrelasHtml(h.grau) + '<span>Poder <b>' + rating + '</b></span>' + leagueHtml(rating) + '</div>' +
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

  // opts.semAcoes: sem os botões (ex.: card do potro no resultado do Haras).
  // O cartão inteiro abre a montaria (data-acao="montaria"); os botões internos têm a própria ação.
  // Renomear e Liberar ficam na tela da Montaria.
  function mountCardHtml(m, isActive, opts) {
    var P = state.pending;
    var semAcoes = !!(opts && opts.semAcoes);
    var corcel = window.Breed && window.Breed.isCorcel(m)
      ? '<span class="corcel" title="Corcel: herança garantida">' + corcelHtml() + '</span>' : '';
    var acoes = semAcoes ? '' : '<div class="montaria-acoes">' +
        '<button type="button" class="btn btn--pequeno" data-acao="ativar" data-id="' + esc(m.uid) + '"' + (isActive || P ? ' disabled' : '') + '>Tornar ativa</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="montaria" data-id="' + esc(m.uid) + '">Ver</button>' +
        '</div>';
    var abre = semAcoes ? '' : ' data-acao="montaria" data-id="' + esc(m.uid) + '"';
    return '<article class="montaria' + (isActive ? ' montaria--ativa' : '') + '" data-uid="' + esc(m.uid) + '"' + abre + '>' +
      portraitHtml(m, { selo: true, pontos: pontosQueCabem(m) }) +
      '<h3 class="cavalo-nome">' + esc(m.name) + ' <small>#' + esc(uidNum(m.uid)) + '</small></h3>' +
      '<div class="linha-meta">' + rarityHtml(m.rarity) + estrelasHtml(m.grau) + elementHtml(m.element) +
        '<span>' + sexoHtml(m.sex) + '</span>' +
        '<span>cruza ' + esc(m.breedLeft) + 'x</span>' + corcel +
        (isActive ? '<span class="badge-ativa">Ativa</span>' : '') +
      '</div>' + xpHtml(m.level, m.xp, true) + gearSummaryHtml(m) + acoes +
    '</article>';
  }

  function montariasHtml() {
    var maxed = state.stableSlots >= BR.stableSlotsMax;
    var canExpand = !maxed && podeGastar(SLOT_PRICE);
    var reservaBloqueia = !maxed && state.gold >= SLOT_PRICE && !canExpand;
    return '<section class="caixa" aria-label="Suas montarias"><div class="montarias">' + state.mounts.map(function (m) { return mountCardHtml(m, m.uid === state.activeId); }).join('') + '</div>' +
      '<div class="acoes"><button type="button" data-acao="expandir" class="btn"' + (canExpand ? '' : ' disabled') + '>' +
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
        '<div class="cavalo-cabeca">' + portraitHtml(h, { selo: true }) +
          '<div class="cavalo-info"><h2 class="cavalo-nome">' + esc(h.name) + '</h2>' +
          '<div class="linha-meta">' + rarityHtml(h.rarity) + elementHtml(h.element) + '</div>' +
          xpHtml(h.level, h.xp, true) +
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

  // "Recomeçar com outro inicial" com confirmação (vai para o Perfil). No modo DEV, zera o perfil de teste
  // (volta à Brasa, sem a escolha inicial; o botão DEV continua), como o "Zerar" da gaveta.
  function resetHtml() {
    return ui.confirmReset
      ? '<div class="confirma" role="group" aria-label="Confirmar recomeço"><span>' +
          (DEV_MODE ? 'Zerar o perfil de teste? Ele volta a começar com a Brasa (o save do jogo real não é tocado).' : 'Apagar o progresso e escolher outro inicial?') + '</span>' +
        '<button type="button" class="btn btn--pequeno btn--perigo" data-acao="reset-sim">' + (DEV_MODE ? 'Sim, zerar' : 'Sim, recomeçar') + '</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="reset-nao">Cancelar</button></div>'
      : '<button type="button" class="btn btn--texto" data-acao="reset">' + (DEV_MODE ? 'Recomeçar (zera o perfil de teste)' : 'Recomeçar com outro inicial') + '</button>';
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
      portraitHtml(h, { selo: true }) +
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
      '<div class="calc-barras">' + bars + '</div>' +
      '<p>' + grau + '</p>' +
      '<p>' + esc(genTxt) + '</p>' +
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
  // Tela da Montaria (sub-tela): cabeça com ações e sub-abas Status / Skills / Equipamento
  // ===========================================================================
  var MONTARIA_ABAS = [{ id: 'status', rotulo: 'Status' }, { id: 'skills', rotulo: 'Skills' }, { id: 'equip', rotulo: 'Equipamento' }];

  // ---- Aba Status: distribuir os pontos livres (spec v3 §10) ----
  // O rascunho (ui.montaria.rascunho: pontos a somar por status, ou null) fica só na memória da tela: sair da
  // tela ou trocar de sub-aba o descarta. Ele nunca passa do que RaceSim.allocInfo aceita (limite por status,
  // pontos que sobram e teto da raridade). "Confirmar" pede um segundo toque e grava como um gasto (gravaGasto:
  // se a gravação falha, nada muda). Com páreo aberto, a ativa segue a trava das peças: o Poder não passa do
  // da sala (state.pending.pr); as outras montarias ficam livres.
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
  // o rascunho cabe nos pontos da montaria (cada status no que ainda aceita e a soma nos pontos que sobram)?
  function rascunhoOk(m, r) {
    if (!r) return true;
    var info = RS.allocInfo(m), soma = 0;
    for (var i = 0; i < STAT_KEYS.length; i++) {
      var v = r[STAT_KEYS[i]];
      if (!(typeof v === 'number' && v >= 0 && v === Math.floor(v) && v <= info.room[STAT_KEYS[i]])) return false;
      soma += v;
    }
    return soma <= info.left;
  }
  // os pontos gravados com o rascunho por cima
  function allocComRascunho(m, r) {
    var a = RS.validAlloc(m, m.alloc), out = {};
    STAT_KEYS.forEach(function (k) { out[k] = a[k] + (r ? r[k] : 0); });
    return out;
  }
  // pontos livres que ainda cabem em algum status (o selo "+N" do Estábulo): com tudo no teto ou no limite
  // por status, os que sobram não rendem e o selo some
  function pontosQueCabem(m) {
    var info = RS.allocInfo(m), room = 0;
    STAT_KEYS.forEach(function (k) { room += info.room[k]; });
    return Math.min(info.left, room);
  }
  function travaPontos(m, alloc) {
    var P = state.pending;
    if (!P || m.uid !== state.activeId) return { ok: true, limit: null };
    var h = clone(m);
    h.alloc = alloc;
    return { ok: RS.powerRating(h, gearOf(m)) <= P.pr, limit: P.pr };
  }
  function notaGenetica(g) { return g >= 24 ? 'S' : g >= 16 ? 'A' : g >= 8 ? 'B' : 'C'; }
  function montariaStatusHtml(m, gear) {
    var M = ui.montaria;
    if (M.rascunho && (!rascunhoSoma(M.rascunho) || !rascunhoOk(m, M.rascunho))) { M.rascunho = null; M.confirmaPontos = false; }
    var r = M.rascunho, soma = rascunhoSoma(r);
    var info = RS.allocInfo(m), livres = info.left - soma;
    var cap = (GD.RARITIES[m.rarity] || GD.RARITIES.comum).statCap;
    var h = clone(m);
    h.alloc = allocComRascunho(m, r);
    var stats = RS.computeStats(h, gear), puro = RS.computeStats(h, null), antes = RS.computeStats(m, gear);
    var P = state.pending, trava = P && m.uid === state.activeId;
    var linhas = STAT_KEYS.map(function (k) {
      var st = GD.STATS[k], g = m.potential[k], nota = notaGenetica(g);
      var v = stats[k], d = v - puro[k], rk = r ? r[k] : 0;
      var delta = d ? '<span class="delta ' + (d > 0 ? 'mais' : 'menos-t') + '">' + (d > 0 ? '+' : '−') + Math.abs(d) + '</span>' : '';
      var botao = '';
      var r2 = rascunhoMais(r, k);
      if (rascunhoOk(m, r2)) {
        var lock = travaPontos(m, allocComRascunho(m, r2));
        botao = '<button type="button" class="btn btn--pequeno build-mais" data-acao="ponto-mais" data-id="' + k + '" aria-label="' +
          esc('Mais um ponto em ' + st.name) + '"' + (lock.ok ? '' : ' disabled title="' + esc('Páreo aberto: passaria do Poder ' + lock.limit) + '"') + '>+</button>';
      }
      return '<li class="build-linha" data-status="' + k + '">' +
        '<span class="build-nome" title="' + esc(st.name + ': ' + st.desc) + '">' + statIcon(k) + '<span>' + esc(st.short) + '</span></span>' +
        '<span class="nota-genetica nota-genetica--' + nota.toLowerCase() + '" title="' + esc('Genética ' + g + ' de 31') + '" aria-label="' + esc('Genética ' + nota + ' (' + g + ' de 31)') + '">' + nota + '</span>' +
        '<div class="barra barra--seg build-barra" role="img" aria-label="' + esc(st.name + ' ' + v + ' (teto ' + cap + ')') + '">' + barHtml(v, antes[k], cap) + '</div>' +
        '<span class="valor' + (rk ? ' valor--rascunho' : '') + '">' + v + delta + (rk ? '<span class="sr"> (+' + rk + ' no rascunho)</span>' : '') + '</span>' +
        '<span class="build-acao">' + botao + '</span></li>';
    }).join('');
    var avisos = '';
    if (M.pontosMsg) avisos += '<p class="aviso" role="status">' + esc(M.pontosMsg) + '</p>';
    var algumMais = STAT_KEYS.some(function (k) { return rascunhoOk(m, rascunhoMais(r, k)); });
    if (livres > 0 && !algumMais) avisos += '<p class="nota">' + esc((livres === 1 ? 'Sobra 1 ponto' : 'Sobram ' + livres + ' pontos') + ': todos os status estão no teto ou no limite.') + '</p>';
    if (trava && info.left > 0) avisos += '<p class="aviso">' + esc('Páreo aberto: os pontos da montaria ativa não podem passar o Poder de ' + P.pr + ' que a sala viu.') + '</p>';
    var topo = '<div class="build-topo"><p class="pontos-livres">Pontos livres: <b>' + livres + '</b></p>' +
      '<span class="nota">' + esc(info.free ? 'de ' + info.free + ' · até ' + info.perStat + ' por status' : 'cada nível ganho dá pontos para distribuir') + '</span>' +
      (soma ? '<span class="nota">' + esc('Poder ' + RS.powerRating(clone(m), gear) + ' → ' + RS.powerRating(h, gear)) + '</span>' : '') + '</div>';
    var acoes = '';
    if (soma) {
      acoes = (M.confirmaPontos ? '<p class="aviso" role="status">' + esc('Os pontos ficam para sempre: não dá para voltar atrás. Toque em Confirmar de novo para gravar.') + '</p>' : '') +
        '<div class="acoes build-acoes"><button type="button" class="btn btn--pequeno" data-acao="pontos-desfazer">Desfazer</button>' +
        '<button type="button" class="btn btn--pequeno btn--ouro" data-acao="pontos-confirmar">Confirmar</button></div>';
    }
    return avisos + '<section class="caixa" aria-label="Status">' + topo +
      '<ul class="build">' + linhas + '</ul>' + acoes +
      '<p class="nota">' + esc('Nota de genética (C, B, A ou S): vem do nascimento. Valores com o equipamento; a barra marca o teto de ' + cap + ' da raridade.') + '</p></section>';
  }

  // abre a Montaria numa sub-aba; o estado do equipamento (confirmação, Desfazer) começa zerado
  function goMontaria(uid, aba) {
    if (!state || !mountByUid(uid)) return;
    ui.montaria = { uid: uid, aba: aba, renomear: null, equip: { slot: null, confirm: null, undo: null, msg: null },
      rascunho: null, confirmaPontos: false, pontosMsg: null };   // rascunho dos pontos livres (só na memória da tela)
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
    var stats = RS.computeStats(h, gear);
    var rating = RS.powerRating(h, gear);
    var skillPct = Math.round(RS.skillChance(h, stats, gear.special.skillChanceBonus) * 100);
    var corcel = window.Breed && window.Breed.isCorcel(m)
      ? '<span class="corcel" title="Corcel: herança garantida">' + corcelHtml() + '</span>' : '';
    var canRelease = !isActive && state.mounts.length > 1 && !P;

    // renomear: campo na própria tela (window.prompt não abre num iframe sem allow-modals, como o do artefato)
    var R = M.renomear;
    var acoes = R
      ? '<div class="renomear" role="group" aria-label="Renomear montaria">' +
          '<label class="rotulo" for="renomear-campo">Novo nome (2–16 letras)</label>' +
          '<input type="text" id="renomear-campo" class="campo" maxlength="16" autocomplete="off" enterkeyhint="done" value="' + esc(R.valor) + '">' +
          (R.erro ? '<p class="aviso" role="status">' + esc(R.erro) + '</p>' : '') +
          '<div class="montaria-acoes"><button type="button" class="btn btn--pequeno btn--ouro" data-acao="renomear-ok" data-id="' + uid + '">Salvar</button>' +
          '<button type="button" class="btn btn--pequeno" data-acao="renomear-nao" data-id="' + uid + '">Cancelar</button></div></div>'
      : ui.confirmLiberar === m.uid && canRelease
      ? '<div class="confirma" role="group" aria-label="Confirmar liberação"><span>Liberar ' + esc(m.name) + '? Ela deixa o estábulo para sempre, sem Ouro de volta.</span>' +
        '<button type="button" class="btn btn--pequeno btn--perigo" data-acao="liberar-sim" data-id="' + uid + '">Sim, liberar</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="liberar-nao" data-id="' + uid + '">Cancelar</button></div>'
      : '<div class="montaria-acoes">' +
        '<button type="button" class="btn btn--pequeno" data-acao="ativar" data-id="' + uid + '"' + (isActive || P ? ' disabled' : '') + '>Tornar ativa</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="renomear" data-id="' + uid + '">Renomear</button>' +
        '<button type="button" class="btn btn--pequeno" data-acao="liberar" data-id="' + uid + '"' + (canRelease ? '' : ' disabled') + '>Liberar</button>' +
        '</div>';

    var cabeca = '<article class="caixa montaria-cabeca" aria-label="Montaria">' +
      '<div class="cavalo-cabeca">' + portraitHtml(m, { selo: true }) +
        '<div class="cavalo-info">' +
          '<h1 class="titulo titulo--tela" id="t-montaria" tabindex="-1" data-foco>' + esc(m.name) + ' <small>#' + esc(uidNum(m.uid)) + '</small></h1>' +
          '<div class="linha-meta">' + rarityHtml(m.rarity) + estrelasHtml(m.grau) + elementHtml(m.element) +
            '<span>' + sexoHtml(m.sex) + '</span>' +
            '<span>cruza ' + esc(m.breedLeft) + 'x</span>' + corcel +
            (isActive ? '<span class="badge-ativa">Ativa</span>' : '') +
          '</div>' +
          xpHtml(m.level, m.xp, true) +
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
      corpo = '<section class="caixa" aria-label="Skills">' + vagaTipoHtml(m) +
        (m.skills.length ? m.skills.map(function (id) { return skillHtml(id, 32); }).join('') : '<p class="nota">Nenhuma skill de vaga ainda.</p>') +
        '<p class="nota">' + (vagas > 0
          ? vagas + (vagas === 1 ? ' vaga livre' : ' vagas livres') + ' · ' + Math.round(RS.TUNING.learnChance * 100) + '% de chance de aprender uma skill nova a cada nível'
          : 'Sem vagas livres') + '</p></section>';
    } else if (M.aba === 'equip') {
      corpo = montariaEquipHtml(m);
    } else {
      corpo = montariaStatusHtml(m, gear);
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
    return '<section class="tela" aria-labelledby="t-loja">' + head + msg + reservaHtml() +
      '<section class="caixa">' + abas + '<p class="nota">' + esc(nota) + '</p>' +
        '<div class="loja-grade">' + produtos + '</div></section>' +
    '</section>';
  }

  // ===========================================================================
  // Sala de largada: campo sorteado uma vez (state.pending) e simulado só no "Largar!"
  // ===========================================================================
  // O Poder de cada nível já conta os pontos livres distribuídos pela build fixa dos bots (botAlloc).
  function bestLevelFor(template, gear, target, lo, hi) {
    var h = clone(template); // um clone por template, mudando só o level e o alloc (clonar a cada nível custava ~10 ms por sala)
    var best = lo || 1, bestD = Infinity;
    for (var L = (lo || 1); L <= (hi || E.maxLevel || 50); L++) {
      h.level = L;
      h.alloc = RS.botAlloc(h);
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
        // pareamento pelo cavalo COM o equipamento: ele é persistente (não é escolha de sala), então entra
        // no rating que atrai os rivais; com o páreo aberto, trocas não podem passar deste rating
        counter: state.raceCounter, training: !!training, fee: fee,
        pr: RS.powerRating(playerHorse(), playerGear()),
        gear: gearSnapshot(playerGear()),   // retrato do equipamento: o sanitize limita pr por ele
        alloc: RS.validAlloc(activeMount(), activeMount().alloc)   // e o retrato dos pontos (R16), pelo mesmo motivo
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
      // equipamento do bot pela liga do alvo e pelo elemento do template
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
      var horse = clone(choice.tpl);   // genética do catálogo; os pontos livres pela build fixa
      horse.level = choice.fit.level;
      horse.alloc = RS.botAlloc(horse);
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
      '<span class="chip"><span class="rotulo">Piso</span>' + pisoIcone(cond.surface) + '<b>' + esc(GD.SURFACES[cond.surface].name) + '</b></span>' +
      '<span class="chip"><span class="rotulo">Clima inicial</span>' + climaIcone(cond.weather) + '<b>' + esc(GD.WEATHERS[cond.weather].name) + '</b></span>' +
      '<span class="chip"><span class="rotulo">Traçado</span><b>' + esc(sh.reta + '% reta · ' + sh.curva + '% curva · ' + sh.subida + '% subida') + '</b></span></div>';
  }

  function strategyTips(L) {
    var tips = [];
    var sh = sharePct(L.cond);
    if (sh.curva >= 40) tips.push('Muitas curvas: Manobra segura a velocidade na curva e na saída dela.');
    if (sh.subida >= 30) tips.push('Muitas subidas: Força ajuda a não perder ritmo (a Armadura dá Força).');
    if (L.cond.distance >= 1800) tips.push('Pista longa: Estamina segura o ritmo até o fim.');   // longa a partir de 1.800 m, como no balance.js (distGroup)
    var h = playerHorse();
    if (RS.weatherMult(h.element, L.cond.weather, false) < 1 && !playerGear().special.ignoreWeatherPenalty) {
      tips.push('Um conjunto completo (5 peças) anula a penalidade de clima.');
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
            '<span>Poder <b>' + RS.powerRating(eu.horse, eu.gear) + '</b></span></div></div></div>' +
        '<div class="tela-cabeca"><span class="rotulo">Equipamento</span>' + gearSummaryHtml(activeMount()) +
          '<div class="acoes"><button type="button" class="btn btn--pequeno" data-acao="equipar-tela" data-id="' + esc(state.activeId) + '">Equipar</button></div>' +
          (state.pending ? '<p class="nota">' + esc('Com o páreo aberto, só trocas que não passem do Poder da sala (' + state.pending.pr + ').') + '</p>' : '') +
        '</div></section>' +
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
      R(lx, ly + 1, 5, 3, tp === 'reta' ? surf : GD.BLOCK_TYPES[tp].color);
      SP.drawText(ctx, nome, (lx + 7) * k, ly * k, { scale: k, color: C.texto2 });
      lx += 7 + SP.measureText(nome, 1) + 5;
    });
    SP.drawText(ctx, D + 'm', (artW - 4) * k, ly * k, { scale: k, color: C.texto, align: 'right' });
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
    var before = { level: hBefore.level, xp: hBefore.xp, gold: state.gold, stats: RS.computeStats(hBefore, null), free: RS.freePoints(hBefore) };
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
    // quem chama grava (gravaGasto) e, se gravou, limpa ui.devNext (os valores armados no painel DEV valem
    // só para esta corrida)

    var hAfter = playerHorse();
    return {
      place: place, prize: prize, fee: L.fee, training: L.training, payouts: pay, stone: stone,
      xpGain: xpGain, levels: levels, learned: learned,
      before: before,
      after: { level: hAfter.level, xp: hAfter.xp, gold: state.gold, stats: RS.computeStats(hAfter, null),
        free: RS.freePoints(hAfter), allCap: todosNoTeto(hAfter) }
    };
  }
  // os sete status no teto da raridade (natural + pontos distribuídos, sem equipamento)?
  function todosNoTeto(h) {
    var cap = (GD.RARITIES[h.rarity] || GD.RARITIES.comum).statCap, a = RS.validAlloc(h, h.alloc);
    return STAT_KEYS.every(function (k) { return RS.naturalStat(h, k) + a[k] >= cap - 1e-9; });
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
    var condTxt = D + ' m · ' + GD.SURFACES[L.cond.surface].name + ' · ' + climaTxt + ' · Vento: ' + ventoFala(ventoDaSala(L)) + ' · ' + tracado;
    return '<section class="tela tela--larga tela--corrida" aria-labelledby="t-corrida">' +
      '<header class="corrida-topo"><div class="corrida-titulo">' +
        '<h1 class="corrida-nome" id="t-corrida" tabindex="-1" data-foco>' + esc(L.trackName) + '</h1>' +
        '<span class="rotulo">' + esc(D + ' m · ' + GD.SURFACES[L.cond.surface].name + ' · ') +
          '<span id="clima-atual">' + climaIcone(L.cond.weather) + esc(climaTxt) + '</span>' + esc(' · ' + tracado) + '</span></div>' +
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
    function arcoArt(m) { return curves.length ? Math.round(-FX.curveOffset(curves, m) * self.lay.arcoK) || 0 : 0; }
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
      climaMsg: '', climaTimer: 0, climaDesde: 0, slowK: 1, fx: fxTl,
      lay: null,
      wind: ventoDaSala(L)   // só visual (RaceFx.wind da seed, ou o forçado no DEV)
    };
    for (i = 0; i < n; i++) self.gallop[i] = i * 1.7;

    // minimapa do HUD (fora do layout compacto): caixa em pixels de arte logo abaixo da linha de cima
    function miniCaixa(artW) {
      var w = clamp(Math.round(artW * 0.2), 40, 72);
      return { x: 2, y: 18, w: w, h: clamp(Math.round(w * 0.45), 22, 30) };
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
        var mini = compact ? null : miniCaixa(artW);
        var hudH = compact ? 15 : Math.max(20 + n, mini.y + mini.h + 2);
        var bottom = compact ? 8 : 14;
        var minTop = hudH + (compact ? 12 : 30);
        var lane = Math.floor((artH - bottom - minTop) / n);
        if (k === 3 && (lane < 20 || artW < 300)) return;
        lane = clamp(lane, compact ? 12 : 13, 26);
        var top = Math.max(minTop, Math.min(artH - bottom - n * lane, minTop + 70));
        pick = {
          k: k, S: S, artW: artW, artH: top + n * lane + bottom, laneArt: lane, laneTopArt: top, hudH: hudH, compact: compact, mini: mini,
          maxLift: clamp(top - hudH - 12, 4, 24),   // a subida não invade o HUD
          // arco da curva: o cavalo da raia 1 (pés em top + lane − 3, sprite de FOOT_Y + 1 de altura) não sai
          // por cima do canvas; só o layout compacto (raias de 12) fica abaixo dos 6 px de arte
          arcoK: clamp(top + lane - 3 - (SP.FOOT_Y + 1), 0, FX.CURVA.arco) / FX.CURVA.arco
        };
      });
      // escala de trabalho: com o canvas acima de CANVAS_MAX_PX, desenha em S/d (d inteiro) e o CSS amplia d vezes
      // com image-rendering: pixelated — cada pixel de arte continua quadrado e do mesmo tamanho na tela (S/d·d = S
      // pixels do aparelho). Só quando a escala dos moldes também divide certinho: com os moldes atuais, S = 6, 9 ou
      // 12 (d = 2, 3 ou 2). S = 6 sai de DPR 2 com k = 3 (janela larga e alta o bastante, ex.: 1280×800@2 conforme a
      // sala) e de DPR 3 com k = 2 (celular); S = 4 (DPR 2 com k = 2) nunca reduz.
      var d = reducaoEscala(pick.S, pick.artW * pick.artH), S = pick.S / d;
      self.S = S; self.lay = pick; pick.reducao = d;
      self.W = pick.artW * S; self.H = pick.artH * S;
      cv.width = self.W; cv.height = self.H;
      cv.style.width = (self.W * d / r) + 'px';
      cv.style.height = (self.H * d / r) + 'px';
      palco.style.height = (self.H * d / r) + 'px';
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
      if (ev.racer === me && (ev.type === 'chegada' || ev.type === 'garra' || ev.type === 'skill')) hud.anuncio.textContent = ev.text;
      if (ev.type === 'clima') climaNoPainel(hud.clima, ev.weather);
      if (ev.type === 'dado' && ev.changed && GD.WEATHERS[ev.weather]) {
        // virada de clima: anúncio por ~2 s (faixa no canvas + leitor de tela) e um clarão leve
        self.climaMsg = 'CLIMA: ' + GD.WEATHERS[ev.weather].name.toUpperCase();
        self.climaIcone = 'cl-' + ev.weather;
        self.climaTimer = 2;
        // a faixa do clima entra em seguida à do Dado (mesmo lugar, abaixo do HUD)
        var di = dadoItens.filter(function (it) { return it.t0 === ev.t; })[0];
        self.climaDesde = di ? di.t1 : ev.t;
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
    // volatil: texto que muda quase a cada quadro (relógio, km/h, distâncias), pintado fora do cache de texto
    function text(str, x, y, color, scale, align, shadow, volatil) {
      SP.drawText(ctx, str, x * self.S, y * self.S, { scale: (scale || 1) * self.S, color: color, align: align, shadow: shadow, volatil: volatil });
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
      text(tTxt, A - 4, 3, C.texto, 1, 'right', null, true);
      text(kmh, A - 4, 10, C.texto2, 1, 'right', null, true);
      // clima atual (vira com o Dado da Sorte), à esquerda do relógio; no layout compacto
      // não há espaço (a CURVA/SUBIDA fica ali) e o cabeçalho da tela mostra o clima
      var wName = GD.WEATHERS[climaAtual(self.simT)].name.toUpperCase();
      var ww = Math.max(tw('CLIMA'), tw(wName)) + 4, wx = A - 2 - tw2 - 4 - ww;
      var livre = sx + barW + 4 + 4, climaVisivel = !lay.compact && wx > livre;
      if (climaVisivel) {
        box(wx, 2, ww, 14, C.veu);
        text('CLIMA', wx + 2, 3, C.texto2);
        text(wName, wx + 2, 10, C.texto);
      }
      // vento (só visual) à esquerda do clima: "VENTO / BRISA →"; sem espaço, ou no layout compacto (onde
      // o selo CURVA/SUBIDA ocupa o lugar do clima), só o ícone: seta (traço no calmo) e 1–3 barrinhas
      var vw = self.wind, vNome = ventoTxt(vw).toUpperCase(), dir0 = climaVisivel ? wx : A - 2 - tw2;
      var vbw = Math.max(tw('VENTO'), tw(vNome)) + 4, vx = dir0 - 4 - vbw;
      if (!lay.compact && vx > livre) {
        box(vx, 2, vbw, 14, C.veu);
        text('VENTO', vx + 2, 3, C.texto2);
        text(vNome, vx + 2, 10, C.texto);
        FX._stats.ventoHud = 'texto';
      } else {
        var reserva = lay.compact ? Math.max(tw('\u25b2SUBIDA'), tw('\u21aaCURVA')) + 4 + 4 : 0;
        var iw = 9, ix = dir0 - 4 - reserva - iw;
        if (ix > livre) {
          box(ix, 2, iw, 14, C.veu);
          var seta = vw.intensity === 'calmo' ? '\u2013' : vw.dir > 0 ? '\u2192' : '\u2190';
          text(seta, ix + Math.round((iw - tw(seta)) / 2), 3, C.texto);
          var nivel = ['calmo', 'brisa', 'ventania'].indexOf(vw.intensity) + 1;
          for (var vb = 0; vb < 3; vb++) {
            ctx.fillStyle = vb < nivel ? C.texto : C.sombra;
            ctx.fillRect((ix + 2 + vb * 2) * self.S, (13 - vb) * self.S, self.S, (vb + 1) * self.S);
          }
          FX._stats.ventoHud = 'icone';
        }
      }
      // tipo do bloco do jogador: SUBIDA ou CURVA (nada na reta)
      var bType = blocks[RS.blockAt(blocks, st.pos[me])].type;
      var lbl = bType === 'subida' ? '▲SUBIDA' : bType === 'curva' ? '↪CURVA' : '';
      var mc = lay.mini;
      if (lbl && self.phase !== 'contagem') {
        var lw = tw(lbl) + 4;
        var hy = lay.compact ? 6 : mc.y + 1;
        var hx = lay.compact ? A - 2 - tw2 - 4 - lw : mc.x + mc.w + 4;
        box(hx, hy, lw, 7, bType === 'curva' ? GD.BLOCK_TYPES.curva.color : C.ouro, C.sombra);
        text(lbl, hx + 2, hy + 1, C.tinta);
      }
      if (lay.compact) return;
      // minimapa: o traçado visto de cima (curvas na cor da curva, subidas em ouro, retas na cor do piso) com
      // um ponto por cavalo na cor da raia; o seu é maior, com contorno claro, e vem por cima
      box(mc.x, mc.y, mc.w, mc.h, C.veu);
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
      var laneH = lay.laneArt * S, laneTop = lay.laneTopArt * S;
      var tr = self.tReal, red = reduced();
      var clima = climaAtual(self.simT);
      // em reduced nada congela: o cenário (nuvens, torcida, bandeiras, grama) anda a 40 % e a natureza
      // (fx.js) recebe o tempo real com a marca reduced (chuva a 40 %, metade dos pingos, sem relâmpago)
      SP.drawTrack(ctx, {
        width: W, height: H, cameraX: cam, pxPerMeter: ppm, lanes: n, laneTop: laneTop, laneH: laneH,
        surface: L.cond.surface, finishM: D, hills: hills, curves: curves, distanceMarkersEvery: D <= 1000 ? 100 : 200,
        t: red ? tr * 0.4 : tr, weather: clima, pixel: S, highlightLane: me, hillMaxLift: lay.maxLift, wind: self.wind,
        curveScale: lay.arcoK
      });
      // natureza, camada de trás (calor, respingos, névoa do fundo): antes dos cavalos. lift acompanha o
      // relevo das subidas e o arco das curvas (os respingos e o calor ficam no chão levantado)
      var natO = {
        weather: clima, wind: self.wind, t: tr, W: W, H: H, P: S, laneTop: laneTop, trackBottom: laneTop + n * laneH,
        reduced: red, seed: L.seed, cam: cam * ppm, camada: 'tras', surface: L.cond.surface,
        lift: hills.length || curves.length ? function (px) { var m = cam + px / ppm; return (SP.hillLiftAt(m, hills, lay.maxLift) + arcoArt(m)) * S; } : null
      };
      FX.drawNature(ctx, natO);
      var poeira = clima !== 'chuva' && (L.cond.surface === 'terra' || L.cond.surface === 'areia');
      var tagsR = [], tagsL = [], badges = [], youTag = null, vis = [];
      for (var j = 0; j < n; j++) {
        var r = L.racers[j];
        var standing = self.phase === 'contagem' || st.speed[j] < 0.4;
        // âncoras do sprite por código ou do molde (convertidas): o focinho é sempre o mesmo NOSE
        var an = SP.anchorsFor(r.horse.element, S, standing ? 'parado' : 'galope');
        var hoofM = st.pos[j] - (an.nose[0] - 20) / self.ppmArt;
        var lift = SP.hillLiftAt ? SP.hillLiftAt(hoofM, hills, lay.maxLift) * S : 0;
        // na curva a raia sobe com a cerca (RaceFx.curveOffset no meio do cavalo, como as colunas da pista)
        var arcoJ = arcoArt(hoofM);
        var feetY = laneTop + (j + 1) * laneH - 3 * S - lift - arcoJ * S;
        var y = feetY - (SP.FOOT_Y + 1) * S;
        var x = Math.round(((st.pos[j] - cam) * ppm - an.nose[0] * S) / S) * S;
        var cavalo = {
          // fase contínua do galope: o código usa o quadro inteiro; o molde mapeia o ciclo (mesma duração)
          palette: r.horse.palette, element: r.horse.element, frame: self.gallop[j],
          scale: S, silks: r.silks, t: tr, idle: standing
        };
        // caixa do que vai ser desenhado (molde ou código): o corte nas bordas e o monitor de câmera usam ela,
        // então a cauda do molde (que passa do x do sprite) não some de uma vez na borda
        var caixaCav = SP.horseBox(x, y, cavalo);
        if (j === me) self.playerRect = { x: caixaCav.x, y: caixaCav.y, w: caixaCav.w, h: caixaCav.h, W: W, H: H };
        if (caixaCav.x > W - 2 * S) { tagsR.push({ j: j, y: feetY - 12 * S, txt: '+' + Math.round(st.pos[j] - p) + 'm' }); continue; }
        if (caixaCav.x + caixaCav.w < 2 * S) { tagsL.push({ j: j, y: feetY - 12 * S, txt: '-' + Math.round(p - st.pos[j]) + 'm' }); continue; }
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
          ctx.fillStyle = 'rgba(214,190,140,0.55)';
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
        FX._stats.caixasCavalos.push({ racer: j, x: Math.round(caixaCav.x / S), y: Math.round(caixaCav.y / S), w: Math.round(caixaCav.w / S), h: Math.round(caixaCav.h / S) });
        // vento, "+" e faíscas da skill / Garra no próprio cavalo (fx.js)
        for (var ei = 0; ei < efeitoItens.length; ei++) {
          if (efeitoItens[ei].racer === j) FX.drawSkillAura(ctx, { x: caixaCav.x, y: caixaCav.y, w: caixaCav.w, h: caixaCav.h, S: S }, efeitoItens[ei], self.simT, reduced());
        }
        vis.push({ j: j, x: x, y: y, caixa: caixaCav, an: an, sobe: Math.round(lift / S) + arcoJ });
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
        var yb = youTagBox(youTag);
        box(yb.x, yb.y, yb.w, 9, C.veu, C.ouro);
        text(yb.txt, yb.x + 2, yb.y + 3, C.ouro);
      }
      layoutTags(tagsR, true); layoutTags(tagsL, false);
      // natureza, camada da frente (véu, pingos, relâmpago, sol, sombras, folhas) e a névoa da frente
      natO.camada = 'frente';
      FX.drawNature(ctx, natO);
      FX.drawFogFront(ctx, natO);
      if (self.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * self.flash / 0.3).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      var dItem = self.phase === 'contagem' ? null : dadoAtivo(self.simT);
      self.voceRect = null;
      if (dItem) drawDadosNaPista(dItem, vis, youTag);
      drawHud(st, order);
      if (self.finishCam || (self.phase !== 'contagem' && Math.abs(self.simT - tWin) < 0.6)) {
        var bt = 'FOTO DE CHEGADA', bw = tw(bt) + 6, bx2 = Math.round(lay.artW / 2 - bw / 2), by2 = lay.hudH + 3;
        box(bx2, by2, bw, 9, C.sombra, C.ouro);
        text(bt, bx2 + 3, by2 + 2, C.ouro);
      } else if (dItem) {
        FX.drawDiceStrip(ctx, dItem, L.racers, lay, S, self.simT, reduced());
      } else if (self.climaTimer > 0 && self.simT >= self.climaDesde) {
        var ct = self.climaMsg, clIco = !!FX.iconImage(self.climaIcone) && 8 * S >= 16, cw2 = tw(ct) + 6 + (clIco ? 10 : 0);
        var cx3 = Math.round(lay.artW / 2 - cw2 / 2), cy3 = lay.hudH + 3;
        box(cx3, cy3, cw2, 9, C.sombra, GD.BLOCK_TYPES.curva.color);
        if (clIco) FX.drawIconPng(ctx, self.climaIcone, (cx3 + 2) * S, cy3 * S + Math.round(S / 2), 8, S);
        text(ct, cx3 + 3 + (clIco ? 10 : 0), cy3 + 2, C.texto);
      }
      if (self.phase !== 'contagem') drawSkillsNaPista(vis, youTag, dItem, !!(self.finishCam || Math.abs(self.simT - tWin) < 0.6 || dItem || (self.climaTimer > 0 && self.simT >= self.climaDesde)));
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
    function drawSkillsNaPista(vis, youTag, dItem, topoOcupado) {
      var S = self.S, lay = self.lay, t = self.simT, k;
      var faixa = null, fx0 = null;
      for (k = 0; k < faixasJogador.length; k++) if (t >= faixasJogador[k].a && t < faixasJogador[k].b) fx0 = faixasJogador[k];
      if (fx0) {
        var ft = fx0.item.nome.toUpperCase() + '!', skId = FX.iconNameOf(fx0.item);
        var bl = FX.skillBannerLayout(ft, lay.artW, S, !!FX.iconImage(skId), tw), fs = bl.fs, fw = bl.w, fh = bl.h;
        var fxx = bl.x, fyy = lay.hudH + (lay.compact ? 3 : 12) + (topoOcupado ? 17 : 0);
        var esc0 = (t - fx0.a) / fx0.item.escala, af = esc0 > FX.BALAO.dur - 0.3 ? Math.max(0, (FX.BALAO.dur - esc0) / 0.3) : 1;
        var cor = ({ fogo: C.fogo, agua: C.agua, grama: C.ganho })[fx0.item.element] || C.ouro;
        ctx.globalAlpha = af;
        box(fxx, fyy, fw, fh, C.veu, cor);
        if (bl.icone) FX.drawIconPng(ctx, skId, bl.iconX * S, (fyy + bl.iconDy) * S, 8 * fs, S);
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
      if (dItem) { obst.push(FX.stripLayout(dItem, L.racers, lay)); FX._stats.placas.forEach(function (p) { obst.push(p); }); }
      function bate(a, o) { return a.x < o.x + o.w + 1 && o.x < a.x + a.w + 1 && a.y < o.y + o.h + 1 && o.y < a.y + a.h + 1; }
      if (youTag && !self.voceRect) { var yb2 = youTagBox(youTag); self.voceRect = { x: yb2.x - 1, y: yb2.y - 1, w: yb2.w + 2, h: 11 }; }
      if (self.voceRect) obst.push(self.voceRect);
      vis.forEach(function (v) {
        var lista = porCavalo[v.j];
        if (!lista) return;
        lista = lista.slice(-3);
        var y0 = lay.laneTopArt + v.j * lay.laneArt - (v.sobe || 0), y1 = y0 + lay.laneArt;
        // na altura do jóquei (como o "◀VOCÊ"), mas sempre dentro da faixa da raia
        var by = Math.max(y0 + 3, Math.min(y1 - 11 - 1, Math.round(v.y / S) + 1));
        var bx;
        if (v.j === me && youTag) { var yb = youTagBox(youTag); bx = yb.x + yb.w + 4; }
        else bx = Math.round((v.x + (v.an.nose[0] + 3) * S) / S) + 4;
        for (var q = 0; q < lista.length; q++) {
          var item = lista[lista.length - 1 - q], sz = FX.balloonSize(item, q);
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
          if (FX.drawBalloon(ctx, r.x * S, r.y * S, S, item, t, q)) {
            FX._stats.caixasBaloes.push({ racer: item.racer, kind: item.kind, tipo: !!item.typeSkill, texto: q ? '' : (item.nomeCurto || ''), pilha: q, x: r.x, y: r.y, w: r.w, h: r.h, y0: y0, y1: y1 });
          }
          bx = r.x + r.w + 2;
        }
      });
    }

    // etiqueta "◀VOCÊ" (pixels de arte; caixa de 9 de altura, borda por fora): texto e posição
    function youTagBox(yt) {
      var s = '◀VOCÊ' + (yt.place ? ' ' + yt.place + 'º' : ''), w = tw(s) + 4;
      return { txt: s, x: Math.min(Math.round(yt.x / self.S), self.lay.artW - w - 2), y: Math.round(yt.y / self.S) - 2, w: w };
    }

    // Dado da Sorte sobre cada cavalo visível (fx.js): plaquinha centrada no jóquei, logo acima da caixa
    // do desenho (molde ou código), arranjada sem sobreposição entre a faixa do Dado e o fim da pista e
    // desviando da etiqueta "◀VOCÊ" (obstáculo fixo)
    function drawDadosNaPista(item, vis, youTag) {
      var S = self.S, lay = self.lay, red = reduced();
      var faixa = FX.stripLayout(item, L.racers, lay);
      var topo = faixa.y + faixa.h + 2;
      var fixos = [];
      if (youTag) { var yb = youTagBox(youTag); fixos.push({ x: yb.x - 1, y: yb.y - 1 - topo, w: yb.w + 2, h: 11 }); }
      self.voceRect = fixos.length ? { x: fixos[0].x, y: fixos[0].y + topo, w: fixos[0].w, h: fixos[0].h } : null;
      var rects = vis.map(function (v) {
        var sz = FX.badgeSize(item.rolls[v.j]);
        var cx = v.an.saddle ? Math.round(v.x / S + v.an.saddle[0]) : Math.round((v.caixa.x + v.caixa.w / 2) / S);
        return { j: v.j, x: cx - Math.floor(sz.w / 2), y: Math.floor(v.caixa.y / S) - 1 - sz.h - topo, w: sz.w, h: sz.h };
      });
      var arr = FX.layoutBadges(rects, lay.artW, lay.artH - topo, fixos);
      arr.sort(function (a, b) { return (a.j === item.winner) - (b.j === item.winner); });   // vencedor por cima
      arr.forEach(function (r) {
        var est = FX.diceState(item, self.simT, red, r.j), win = r.j === item.winner;
        var num = FX.drawDice(ctx, r.x * S, (r.y + topo) * S, S, item.rolls[r.j], est, win, self.simT, L.racers[r.j].silks);
        FX._stats.placas.push({ racer: r.j, numero: num, vencedor: win, fase: est.fase, x: r.x, y: r.y + topo, w: r.w, h: r.h });
      });
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
        text(t.txt, bx + 8, y + 1, C.texto, 1, null, null, true);
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
        // câmera lenta do Dado da Sorte (fx.js); compõe com a da chegada pelo mínimo
        slowK = Math.min(slowK, FX.slowFactor(fxTl, self.simT, reduced()));
        self.simT += dtReal * ts * self.mult * slowK;
        if (self.simT >= endT) { self.phase = 'fim'; self.endTimer = 1.2; hud.pular.textContent = 'Ver resultado'; }
      } else if (self.phase === 'fim') {
        self.simT += dtReal * ts * self.mult * 0.5;
        self.endTimer -= dtReal;
        if (self.endTimer <= 0 && !self.done) { self.done = true; go('resultado'); return; }
      }
      if (!self.winnerSeen && self.simT >= tWin) { self.winnerSeen = true; if (!reduced()) self.flash = 0.3; }
      if (self.flash > 0) self.flash = Math.max(0, self.flash - dtReal);
      self.slowK = slowK;
      if (self.climaTimer > 0 && self.simT >= self.climaDesde) self.climaTimer = Math.max(0, self.climaTimer - dtReal);
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
      // tempo de desenho do quadro (média móvel em RaceFx._stats.msQuadro)
      var tDes = window.performance.now();
      FX.beginFrame();
      draw(st, order);
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
      skip: function () { if (!self.done) { self.done = true; go('resultado'); } },
      destroy: function () { clearTimeout(rzTimer); window.removeEventListener('resize', onResize); FX.resetStats(false); },
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
          var hx = (sl.cx - 21) * k, hy = (sl.top - 32) * k, cavalo = {
            palette: r.horse.palette, element: r.horse.element, idle: true, t: reduced() ? 0.5 : t + sl.place * 0.8,
            scale: k, silks: r.silks, shadow: false, quadro: { topo: 0, base: sl.top * k }   // em pé no bloco, sem sair do canvas
          };
          SP.drawHorse(ctx, hx, hy, cavalo);
          if (r.isPlayer) {
            // seta dourada sobre o seu cavalo: a ponta fica 4 px de arte acima do topo do desenho (o molde pode ser
            // mais alto que o sprite por código, cujo topo dá a posição de antes, sl.top − 37)
            var ponta = Math.min(sl.top - 37, Math.floor(SP.horseBox(hx, hy, cavalo).y / k) - 5);
            R(sl.cx - 3, ponta - 3, 7, 1, C.ouro); R(sl.cx - 2, ponta - 2, 5, 1, C.ouro); R(sl.cx - 1, ponta - 1, 3, 1, C.ouro); R(sl.cx, ponta, 1, 1, C.ouro);
          }
        });
      }
    };
    item.draw(0);
    vivo(item, cv);
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
        (R.stone ? '<dt>Pedra Negra</dt><dd class="mais">' + iconeHtml('pedra-negra', '🪨') + ' +1</dd>' : '') +
        '<div class="final" style="display:contents"><dt>Saldo</dt><dd>' + ouroHtml(R.after.gold) + '</dd></div></dl>';

    var lvl = '';
    if (R.levels > 0) {
      var ups = STAT_KEYS.map(function (k) {
        var d = R.after.stats[k] - R.before.stats[k];
        return d ? '<span>' + esc(GD.STATS[k].short) + ' ' + R.before.stats[k] + ' → ' + R.after.stats[k] + ' <b class="mais">+' + d + '</b></span>' : '';
      }).join('');
      // pontos livres ganhos (subir mais de um nível soma); com os sete status no teto, nenhum ponto rende:
      // aí só a frase do teto. Sem status que mude e fora do teto, não diz nada sobre teto.
      var ganhos = R.after.free - R.before.free;
      var pontos = ganhos > 0 && !R.after.allCap
        ? '<span>' + esc('+' + ganhos + (ganhos === 1 ? ' ponto livre' : ' pontos livres') + ' para distribuir na aba Status da Montaria.') + '</span>' : '';
      var teto = R.after.allCap ? '<span>Os status já estão no teto da raridade.</span>' : '';
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
      return '<tr class="' + (r.isPlayer ? 'voce' : '') + '"><td class="pos" aria-label="' + (k + 1) + ' lugar">' + podioIcone(k + 1) + (k + 1) + 'º</td>' +
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
        '<p class="nota">' + iconeHtml('ui-dado', '🎲', 16) + ' Dado da Sorte: a 1/3 e 2/3 da pista o maior dado puxa o clima para o elemento de quem tirou.</p>' +
        '</section>' +
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

  telaEl.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-acao]') : null;
    if (!b || b.disabled) return;
    var id = b.getAttribute('data-id');
    switch (b.getAttribute('data-acao')) {
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
      case 'montaria':                // cartão do Estábulo e botão "Ver"
        goMontaria(id, 'status'); break;
      case 'equipar-tela':            // "Equipar" da aba Correr e da largada
        goMontaria(id, 'equip'); break;
      case 'montaria-aba':
        if (!ui.montaria || !MONTARIA_ABAS.some(function (a) { return a.id === id; })) break;
        ui.montaria.aba = id;
        ui.montaria.rascunho = null; ui.montaria.confirmaPontos = false; ui.montaria.pontosMsg = null;   // o rascunho não sai da aba Status
        rerenderKeepScroll(); break;
      case 'ponto-mais': {
        var pm = ui.montaria ? mountByUid(ui.montaria.uid) : null;
        if (!pm || ui.montaria.aba !== 'status' || STAT_KEYS.indexOf(id) < 0) break;   // só na aba Status
        var pr2 = rascunhoMais(ui.montaria.rascunho, id);
        if (!rascunhoOk(pm, pr2) || !travaPontos(pm, allocComRascunho(pm, pr2)).ok) break;   // nunca confia no botão
        ui.montaria.rascunho = pr2; ui.montaria.confirmaPontos = false; ui.montaria.pontosMsg = null;
        rerenderKeepScroll();
        if (!telaEl.contains(document.activeElement)) focusAction('pontos-confirmar');   // o "+" sumiu (limite ou teto)
        break;
      }
      case 'pontos-desfazer':
        if (!ui.montaria) break;
        ui.montaria.rascunho = null; ui.montaria.confirmaPontos = false; ui.montaria.pontosMsg = null;
        rerenderKeepScroll(); focusAction('ponto-mais', 'vel'); break;
      case 'pontos-confirmar': {
        var MQ = ui.montaria, cq = MQ ? mountByUid(MQ.uid) : null;
        if (!cq || MQ.aba !== 'status' || !rascunhoSoma(MQ.rascunho)) break;   // só na aba Status
        if (!MQ.confirmaPontos) {   // primeiro toque: só o aviso de que não dá para voltar atrás
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
        persist();
        guardaMotionKeep(null);   // a preferência agora está no save
        go('estabulo');
        break;
      case 'ver-inicial': {
        var card = document.getElementById('ini-' + id);
        if (card) { try { card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest', inline: 'center' }); } catch (e2) { card.scrollIntoView(); } }
        break;
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
        if (!ui.montaria || !mountByUid(id)) break;
        ui.montaria.renomear = { valor: mountByUid(id).name, erro: null };
        render(); focaRenomear(); break;
      }
      case 'renomear-ok':
        renomearConfirma(); break;
      case 'renomear-nao':
        renomearCancela(); break;
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
        if (devHooks) { devHooks.zerarPerfil(); go('estabulo'); break; }   // perfil de teste: volta à Brasa, sem a escolha
        ui.motionKeep = motionPref();
        guardaMotionKeep(ui.motionKeep);
        ui.confirmReset = false; wipeSave(); state = null; ui.lobby = null; ui.result = null; go('inicial'); break;
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
    if (!e.target || e.target.id !== 'renomear-campo') return;
    if (e.key === 'Enter') { e.preventDefault(); renomearConfirma(); }
    else if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); renomearCancela(); }
  });

  function focusAction(acao, id) {
    var sel = '[data-acao="' + acao + '"]' + (id != null ? '[data-id="' + id + '"]' : '');
    var el = telaEl.querySelector(sel);
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
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
    render();
    window.scrollTo(0, y);
    if (acao) focusAction(acao, id);
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

  var started = false;
  function start(data) {
    if (started) return;   // nunca dois laços de animação
    started = true;
    readTokens();
    data = data || {};
    var lido = loadSave();
    state = sanitize(!!data.dev === DEV_MODE ? data.save : null) || sanitize(lido);
    // JSON válido mas que não vira save (sanitize null): também guarda a cópia antes de recomeçar
    if (!state && lido != null && !saveCorrompido) { try { guardaCorrompido(window.localStorage.getItem(SAVE_KEY)); } catch (e) { /* ignora */ } }

    // save de versão anterior migrado: grava já a versão nova (a migração acontece uma vez só; o Neutro
    // convertido e o Poder da sala recalculado ficam no disco)
    if (state && lido && typeof lido === 'object' && !(Number(lido.v) >= SAVE_VERSION)) persist();
    if (!state && devHooks) { state = devHooks.novoPerfil(); persist(); }   // perfil DEV novo: Brasa, sem a escolha inicial
    if (!state) ui.motionKeep = leMotionKeep();   // "Recomeçar" e a aba fechou na escolha: a opção continua
    ui.screen = state ? 'estabulo' : 'inicial';
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
    render();   // liga o laço de animação se a tela tiver o que animar
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
        redesenhoPassivo();
      }, 150);
    });
    // a preferência de movimento do aparelho mudou: vale na hora para quem segue o sistema
    if (motionQuery) {
      var onMotion = function () { syncMotionClass(); if (ui.screen === 'perfil') rerenderKeepScroll(); acordaLaco(); };
      if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
      else if (motionQuery.addListener) motionQuery.addListener(onMotion);
    }
    // outra aba gravou: adota o save mais novo em vez de sobrescrevê-lo depois
    window.addEventListener('storage', function (ev) {
      if (ev.key !== SAVE_KEY && ev.key !== null) return;
      var raw = null;
      try { raw = ev.newValue ? JSON.parse(ev.newValue) : null; } catch (e) { raw = null; }
      if (raw && state && Number(raw.rev) <= state.rev) return;
      adoptExternal(raw);
    });
    /*@teste:inicio*/
    // ganchos para testes automatizados (fora do jogo de produção)
    window.__galope = {
      get state() { return state; }, get ui() { return ui; }, get race() { return raceView; }
    };
    // rascunho dos pontos livres da tela da Montaria (null sem rascunho), para o teste ler
    Object.defineProperty(ui, 'rascunho', { configurable: true, get: function () { return ui.montaria ? ui.montaria.rascunho : null; } });
    /*@teste:fim*/
  }

  var hotApi = window.claude && window.claude.hot;
  if (hotApi && hotApi.ready) hotApi.ready(start);
  else start((hotApi && hotApi.data) || {});
})();
