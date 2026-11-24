/*
 * MMORPG Horse — luz, sombra e clima por rampa (protótipo). Guia de integração visual: docs/arte/integracao.md, Regras 2
 * (sombra opaca na cor do chão), 4 (rampas com hue shift), 8 (clima e hora por degrau de rampa) e 14 (leitura por valor).
 * Plano: docs/superpowers/plans/2026-11-24-animacao-ambiente.md, etapa 0.
 *
 * Módulo PURO e só de apresentação: sem DOM, sem canvas, sem estado, sem Math.random. Não entra na simulação nem no
 * servidor. Entradas e saídas em hex '#rrggbb' da Resurrect 64.
 *
 *   Luz.RAMPAS             { nome: [hex do escuro ao claro] } — as 64 cores, cada rampa com hue shift (a sombra puxa
 *                          para o frio e o violeta, a luz para o quente)
 *   Luz.rampaDe(hex)       nome da rampa principal da cor (a que manda nos degraus dela)
 *   Luz.degrau(hex, n)     a cor n degraus acima (n > 0) ou abaixo (n < 0) na rampa principal; para nas pontas
 *   Luz.valor(hex)         luminância relativa (0 a 1), para comparar valor (Regra 14)
 *   Luz.sombraDoChao(hex)  { projetada, contato }: 1 e 2 degraus abaixo da cor do chão (Regra 2)
 *   Luz.lutCondicao(cond)  { hex: hex } das 64 cores na condição (sol, nublado, chuva, nevoa, noite, tarde, calor), por
 *                          degrau de rampa (Regra 8); Luz.CONDICOES tem os passos de cada uma
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Luz = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Rampas da Resurrect 64, do escuro ao claro (a validação do fx-test confere a paleta, a cobertura das 64 cores e a
  // ordem de valor). Várias cores aparecem em mais de uma rampa (as pontas escuras e claras são partilhadas).
  var RAMPAS = {
    terra: ['#45293f', '#6e2727', '#9e4539', '#cd683d', '#e6904e', '#fbb954', '#fdcbb0'],      // pistas, palha, pelagens quentes
    neutroQuente: ['#2e222f', '#45293f', '#694f62', '#966c6c', '#ab947a', '#c7dcd0', '#ffffff'],
    neutroFrio: ['#2e222f', '#3e3546', '#625565', '#7f708a', '#9babb2', '#c7dcd0', '#ffffff'],
    vermelho: ['#45293f', '#6e2727', '#b33831', '#ea4f36', '#f57d4a', '#fca790', '#fdcbb0'],
    carmim: ['#45293f', '#7a3045', '#ae2334', '#e83b3b', '#f68181', '#fca790'],
    fogo: ['#6e2727', '#b33831', '#fb6b1d', '#f79617', '#f9c22b', '#fbff86'],
    oliva: ['#2e222f', '#313638', '#4c3e24', '#676633', '#a2a947', '#d5e04b', '#fbff86'],
    verde: ['#313638', '#165a4c', '#239063', '#1ebc73', '#91db69', '#cddf6c'],
    musgo: ['#313638', '#374e4a', '#547e64', '#92a984', '#b2ba90', '#c7dcd0'],
    mar: ['#323353', '#0b5e65', '#0b8a8f', '#0eaf9b', '#30e1b9', '#8ff8e2'],
    azul: ['#2e222f', '#323353', '#484a77', '#4d65b4', '#4d9be6', '#8fd3ff', '#c7dcd0'],
    roxo: ['#2e222f', '#45293f', '#6b3e75', '#905ea9', '#a884f3', '#eaaded'],
    rosa: ['#45293f', '#753c54', '#a24b6f', '#cf657f', '#ed8099', '#fca790'],
    magenta: ['#45293f', '#831c5d', '#c32454', '#f04f78', '#f68181', '#fdcbb0']
  };
  // Rampa principal: a primeira (na ordem acima) em que a cor fica no meio, não numa ponta partilhada; algumas cores
  // de ponta são fixadas à mão, pelo material em que mais aparecem.
  var FIXAS = {
    '#2e222f': 'neutroQuente', '#45293f': 'roxo', '#313638': 'musgo', '#323353': 'azul', '#c7dcd0': 'neutroFrio',
    '#ffffff': 'neutroFrio', '#fdcbb0': 'terra', '#fca790': 'vermelho', '#fbff86': 'oliva', '#6e2727': 'terra'
  };
  var RAMPA_DE = {};
  Object.keys(RAMPAS).forEach(function (n) {
    var r = RAMPAS[n];
    r.forEach(function (h, i) { if (!RAMPA_DE[h] && i > 0 && i < r.length - 1) RAMPA_DE[h] = n; });
  });
  Object.keys(RAMPAS).forEach(function (n) { RAMPAS[n].forEach(function (h) { if (!RAMPA_DE[h]) RAMPA_DE[h] = n; }); });
  Object.keys(FIXAS).forEach(function (h) { RAMPA_DE[h] = FIXAS[h]; });

  function norm(hex) { return String(hex || '').toLowerCase(); }
  function rampaDe(hex) { return RAMPA_DE[norm(hex)] || null; }
  function degrau(hex, n) {
    var h = norm(hex), nome = RAMPA_DE[h];
    if (!nome || !n) return h;
    var r = RAMPAS[nome], i = r.indexOf(h);
    return r[Math.max(0, Math.min(r.length - 1, i + n))];
  }
  function valor(hex) {
    var h = norm(hex).replace('#', '');
    var v = [0, 2, 4].map(function (i) {
      var c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  // a sombra no chão é o próprio chão um degrau abaixo (projetada) e dois abaixo (contato sob o casco): opaca, nunca
  // preto com alfa (Regra 2; referências do Vinicius, R3)
  function sombraDoChao(hex) {
    var p = degrau(hex, -1), c = degrau(hex, -2);
    if (valor(c) > valor(p)) c = p;
    return { projetada: p, contato: c };
  }

  // LUT de luz e clima por degrau de rampa (Regra 8): cada cor anda n degraus DENTRO da sua rampa principal, em vez de
  // ir para a "mais próxima" de uma mistura (o jeito antigo fundia metade dos tons: nublado 64 → 32 cores, névoa → 22).
  // Abaixo da ponta escura a rampa segue para #2e222f e acima da clara para #ffffff, então só as pontas se fundem.
  // Cada condição: { passos, tinta }
  //   passos  um número para todas as rampas, ou { padrao, <rampa>: n } quando a condição muda o matiz (a tarde esfria
  //           só as rampas frias; o calor esquenta só as quentes)
  //   tinta   { <rampa>: <rampa alvo> }: antes dos passos, a cor vai para a rampa alvo na mesma posição relativa (a névoa
  //           tira a saturação: as quentes viram a neutra quente, o verde vira musgo, as frias a neutra fria)
  //   ate     (opcional) a tinta só vale até essa fração da rampa (0 = a ponta escura, 1 = a clara)
  // As condições que a corrida usa hoje são sol, nublado, chuva e nevoa (GameData.WEATHERS); tarde, noite e calor ficam
  // prontas para as cenas. CONDICAO_FIGURA: a LUT dos cavalos e das pessoas, em primeiro plano, mais branda que a do
  // fundo (na chuva a figura escurece 1 degrau, não 2; na névoa, que fica atrás, não muda) — ainda escurece junto.
  var FRIAS = ['neutroFrio', 'musgo', 'mar', 'azul', 'roxo'], QUENTES = ['terra', 'vermelho', 'carmim', 'fogo', 'oliva', 'rosa', 'magenta'];
  function porRampas(lista, n, padrao) { var o = { padrao: padrao || 0 }; lista.forEach(function (r) { o[r] = n; }); return o; }
  function tintaDe(lista, alvo, o) { o = o || {}; lista.forEach(function (r) { o[r] = alvo; }); return o; }
  var CONDICOES = {
    sol: { passos: 0 },
    nublado: { passos: -1 },
    chuva: { passos: -2 },
    nevoa: { passos: 1, tinta: tintaDe(QUENTES, 'neutroQuente', tintaDe(['mar', 'azul', 'roxo'], 'neutroFrio', { verde: 'musgo' })) },
    noite: { passos: -3 },
    tarde: { passos: porRampas(FRIAS, -1, 0) },
    calor: { passos: porRampas(QUENTES, 1, 0) },
    // só para figuras (CONDICAO_FIGURA)
    'chuva-figura': { passos: -1 },
    // tinta ambiente das cenas paradas, nas figuras (cavalo, treinador): só o começo escuro de cada rampa (ate) muda de
    // matiz (o terço escuro: as sombras), a base e as luzes ficam (a luz da cena entra pelo contraluz, CONTRALUZ abaixo)
    //   Fornalha: as sombras frias puxam para o vinho e o roxo da lava (6e2727/45293f)
    //   Estábulo: âmbar dos lampiões, as sombras frias viram neutras quentes
    //   Remanso: frio da água, as sombras quentes puxam para o roxo e o azul
    fornalha: { passos: 0, ate: 0.34, tinta: tintaDe(['neutroFrio', 'azul', 'roxo', 'mar', 'musgo'], 'terra', { verde: 'oliva' }) },
    estabulo: { passos: 0, ate: 0.34, tinta: tintaDe(['neutroFrio', 'azul', 'mar', 'musgo'], 'neutroQuente') },
    remanso: { passos: 0, ate: 0.34, tinta: tintaDe(['terra', 'vermelho', 'fogo', 'rosa', 'magenta', 'carmim'], 'roxo', { oliva: 'musgo' }) }
  };
  // contraluz de 1 px nas figuras, só com fonte emissiva na cena (lava, lampião, pôr do sol), do lado da fonte e só onde o
  // pixel já é o degrau mais claro (Regra 8); a cor é a do brilho da fonte
  var CONTRALUZ = { fornalha: { lado: 'esquerda', cor: '#f79617' }, estabulo: { lado: 'cima', cor: '#fbb954' } };
  var CONDICAO_FIGURA = { sol: 'sol', nublado: 'nublado', chuva: 'chuva-figura', nevoa: 'sol', noite: 'chuva', tarde: 'tarde', calor: 'sol' };
  var PONTA_ESCURA = '#2e222f', PONTA_CLARA = '#ffffff';
  function estendida(nome) {
    var r = RAMPAS[nome].slice();
    if (r[0] !== PONTA_ESCURA) r.unshift(PONTA_ESCURA);
    if (r[r.length - 1] !== PONTA_CLARA) r.push(PONTA_CLARA);
    return r;
  }
  function degrauEstendido(hex, n, rampa) {
    var h = norm(hex), nome = rampa || RAMPA_DE[h];
    if (!nome || !n) return h;
    var r = estendida(nome), i = r.indexOf(h);
    if (i < 0) return h;
    return r[Math.max(0, Math.min(r.length - 1, i + n))];
  }
  function passosDe(c, rampa) {
    var p = c.passos;
    if (typeof p === 'number') return p;
    if (!p) return 0;
    return Object.prototype.hasOwnProperty.call(p, rampa) ? p[rampa] : p.padrao;
  }
  // a cor na rampa alvo, na mesma posição relativa da rampa de origem
  function tinge(h, de, alvo) {
    var r = RAMPAS[de], t = RAMPAS[alvo], i = r.indexOf(h);
    return t[Math.round(i * (t.length - 1) / Math.max(1, r.length - 1))];
  }
  var luts = {};
  // { '#rrggbb': '#rrggbb' } das 64 cores numa condição (sol e condição desconhecida: a identidade)
  function lutCondicao(cond) {
    if (luts[cond]) return luts[cond];
    var c = CONDICOES[cond] || CONDICOES.sol, t = {};
    Object.keys(RAMPA_DE).forEach(function (h) {
      var r = RAMPA_DE[h], alvo = c.tinta && c.tinta[r];
      if (alvo && c.ate != null && RAMPAS[r].indexOf(h) / Math.max(1, RAMPAS[r].length - 1) > c.ate) alvo = null;
      if (alvo) t[h] = degrauEstendido(tinge(h, r, alvo), passosDe(c, r), alvo);
      else t[h] = degrauEstendido(h, passosDe(c, r));
    });
    return (luts[cond] = t);
  }
  // a LUT das figuras (cavalos, pessoas) numa condição do fundo
  function lutFigura(cond) { return lutCondicao(CONDICAO_FIGURA[cond] || 'sol'); }

  // Leitura por valor (Regra 14): a claridade L* (CIE, 0 a 100) e o remédio "outra cor de chão na faixa das raias". Para
  // um piso e as pelagens que correm nele, em cada condição: se a menor diferença de L* entre o corpo (na LUT de figura)
  // e o chão (na LUT da condição) fica abaixo de LEITURA_MIN, o piso desloca 1 degrau (para baixo ou para cima, o que mais
  // separa); senão fica. Na escada sol → nublado → chuva o chão nunca clareia (o degrau escolhido respeita a ordem do
  // anterior); a névoa escolhe sozinha. leituraPiso(piso, pelagens) -> { <cond>: { passo, min, chao } }.
  var LEITURA_MIN = 5, ESCADA_LEITURA = ['sol', 'nublado', 'chuva'];
  function claridade(hex) { var y = valor(hex); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; }
  function leituraPiso(piso, pelagens) {
    piso = norm(piso);
    function opcao(cond, passo) {
      var fig = lutFigura(cond), ch = lutCondicao(cond)[degrau(piso, passo)], m = Infinity;
      pelagens.forEach(function (c) { m = Math.min(m, Math.abs(claridade(fig[norm(c)] || norm(c)) - claridade(ch))); });
      return { passo: passo, min: m, chao: ch };
    }
    function escolhe(cond, teto) {
      var ops = [0, -1, 1].map(function (p) { return opcao(cond, p); }).filter(function (o) { return teto == null || claridade(o.chao) <= teto + 1e-9; });
      if (!ops.length) ops = [opcao(cond, -1)];
      var base = ops[0].passo === 0 ? ops[0] : null;
      if (base && base.min >= LEITURA_MIN) return base;
      var melhor = ops[0];
      ops.forEach(function (o) { if (o.min > melhor.min + 0.5) melhor = o; });
      return melhor;
    }
    var out = {}, teto = null;
    ESCADA_LEITURA.forEach(function (c) { out[c] = escolhe(c, teto); teto = claridade(out[c].chao); });
    out.nevoa = escolhe('nevoa', null);
    return out;
  }

  return { RAMPAS: RAMPAS, LEITURA_MIN: LEITURA_MIN, claridade: claridade, leituraPiso: leituraPiso, rampaDe: rampaDe, degrau: degrau, valor: valor, sombraDoChao: sombraDoChao,
    CONDICOES: CONDICOES, CONDICAO_FIGURA: CONDICAO_FIGURA, CONTRALUZ: CONTRALUZ, lutCondicao: lutCondicao, lutFigura: lutFigura, degrauEstendido: degrauEstendido };
}));
