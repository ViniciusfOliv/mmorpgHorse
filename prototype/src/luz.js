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
    oliva: ['#2e222f', '#4c3e24', '#676633', '#a2a947', '#d5e04b', '#fbff86'],
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

  return { RAMPAS: RAMPAS, rampaDe: rampaDe, degrau: degrau, valor: valor, sombraDoChao: sombraDoChao };
}));
