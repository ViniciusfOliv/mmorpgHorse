/*
 * MMORPG Horse — efeitos da corrida (protótipo descartável): window.RaceFx.
 *
 * Só apresentação. Nada daqui volta para a simulação (RaceSim): a tela lê o resultado pronto e
 * desenha por cima. Sem Math.random e sem estado sorteado: tudo é função do tempo de simulação
 * (simT), do índice do corredor e de hashes fixos. O módulo tem duas partes, nesta ordem:
 *
 * ============================== FUNÇÕES PURAS ===============================
 * Sem DOM e sem canvas; testadas no Node por tools/fx-test.js.
 *
 *   RaceFx.timeline(sim, racers, escala) -> [{ kind, t0, t1, racer, ... }] ordenada por t0 (estável).
 *     Uma lista de efeitos montada UMA vez por corrida a partir de sim.events. Hoje:
 *       'dado' { t0: ev.t, t1: ev.t + 2.4·escala, racer: winner, winner, rolls (cópia), changed,
 *                weather, escala }   — um por evento 'dado'.
 *     As próximas tarefas acrescentam 'skill', 'garra' e 'cansou' (racers serve para achar a
 *     skill pelo nome, como a tela faz hoje).
 *     escala (padrão 1) = segundos de simulação por segundo real em x1. As janelas do Dado (2,4 s,
 *     câmera lenta de 0,8 s, giro de 0,4 s, novo giro até 0,64 s) estão em "segundos de
 *     apresentação": com escala 1 são segundos de simulação; a tela passa a sua escala de
 *     reprodução (sim.duration / duração real alvo, ~3,6–4,8). Em segundos reais (x1): câmera lenta
 *     ~2 s, giro ~1 s, novo giro até 0,6 s, brilho do vencedor ~2 s e faixa ~3,6 s (spec §5).
 *
 *   RaceFx.slowFactor(tl, simT, reduced) -> 0.4 dentro de [t0, t0 + 0.8·escala] de cada 'dado'
 *     ([t0, t0 + 0.4·escala] se reduced), senão 1. A tela usa slowK = min(slowK, slowFactor).
 *
 *   RaceFx.diceState(item, simT, reduced, racer) -> { fase, brilho, dourado, tempo, reduced }
 *     racer = índice do corredor (padrão: item.racer, o vencedor). Com d = (simT − t0) / escala:
 *       'gira'   em [0, 0.4)              (pulada se reduced)
 *       'regira' em [0.4, 0.64)           só para rolls[racer].rerolls > 0 (pulada se reduced)
 *       'mostra' até 2.4                   'fim' fora de [t0, t1)
 *     brilho (0..1) só do vencedor: pulsa em [0.64, 2.4] (fixo em 1 se reduced, desde t0);
 *     dourado = o vencedor já foi revelado (plaquinha dourada). tempo = segundos reais desde t0
 *     em x1 (a câmera lenta descontada): é o relógio das animações do dado e das faíscas.
 *
 *   RaceFx.diceLabels(roll) -> { marca, best: '87', outros: ['42'] }  (outros = os demais dados, na
 *     ordem rolada; marca '↻' quando houve desempate: a simulação reescreve dice/best de quem empatou
 *     no topo e o valor empatado não fica no evento, então o número mostrado é o da nova rolagem).
 *   RaceFx.badgeSize(roll)  -> { w, h } em pixels de arte do retângulo da plaquinha (com a pontinha).
 *   RaceFx.stripOrder(item) -> índices da faixa: o vencedor primeiro, depois rerolls decrescente
 *     (quem disputou o desempate empatou no topo) e best decrescente; por fim a raia.
 *   RaceFx.stripLayout(item, racers, lay) -> caixa da faixa "DADO DA SORTE" em pixels de arte
 *     ({ x, y, w, h, linhas, rotulo: {x, y}, entradas: {x, y} }); lay = layout da tela da corrida
 *     ({ artW, hudH, compact }). Uma linha quando cabe; senão o rótulo em cima e os números embaixo.
 *   RaceFx.layoutBadges(rects, W, H, fixos) -> rects (cópias, mesma ordem): cada um preso a
 *     [0, W] × [0, H] e, na ordem do y desejado, deslocado na vertical (para cima no empate) até não
 *     sobrepor os já colocados nem os fixos (obstáculos que não se movem e não voltam, como a
 *     etiqueta "◀VOCÊ"), com 1 px de folga. Sem altura para empilhar, vai para o lado. Unidade livre.
 *
 * ================================= DESENHO ==================================
 * Canvas 2D em pixel art (x, y em px do canvas; S = px por pixel de arte). Precisa de window.Sprites
 * (fonte 3×5). Nenhuma imagem: dados, plaquinhas e faíscas saem de fillRect.
 *
 *   RaceFx.drawDice(ctx, x, y, S, roll, estado, isWinner, simT, cor) -> texto desenhado ('' no giro)
 *     (x, y) = canto do retângulo de badgeSize. 'gira'/'regira': cubo de 9×9 girando (4 quadros) e
 *     quicando; 'mostra': plaquinha com o best (precedido de "↻" se houve desempate) e, depois de um
 *     traço, os outros dados em cinza; borda na cor da raia (cor). Vencedor revelado: plaquinha dourada, halo pulsando com o brilho e
 *     faíscas em volta (omitidas em reduced).
 *   RaceFx.drawDiceStrip(ctx, item, racers, lay, S, simT, reduced) -> caixa (stripLayout) ou null
 *     Faixa "DADO DA SORTE" abaixo do HUD: chip na cor da raia (com o nº da raia) + número de cada
 *     cavalo ("↻" antes do número de quem desempatou). Enquanto os dados giram: ordem das raias e
 *     números rolando; depois da revelação (d ≥ 0.64, ou já em t0 se reduced): ordem de stripOrder,
 *     vencedor em dourado pulsante.
 *
 *   RaceFx._stats = { dados, faixaDado, baloes, particulas, msQuadro, quadros, placas }
 *     Contadores do quadro atual (zerados por beginFrame) para o ui-test: dados desenhados, faixa
 *     visível, balões (próximas tarefas), partículas, e placas = [{ racer, numero, vencedor, fase }]
 *     (a tela anota o que desenhou). msQuadro = média do tempo de desenho dos últimos 60 quadros
 *     (endFrame(ms), medido pela tela com performance.now()); quadros = quadros medidos.
 *   RaceFx.beginFrame(), RaceFx.endFrame(ms), RaceFx.resetStats(tudo) (tudo: também a média).
 *
 * UMD: no browser vira window.RaceFx (carregar depois de sprites.js); no Node, module.exports.
 */
(function (root) {
  'use strict';

  // ===========================================================================
  // Constantes (segundos de apresentação; ver escala no topo)
  // ===========================================================================
  var DADO = {
    dur: 2.4,          // plaquinhas e faixa ficam até t0 + 2.4 (brilho do vencedor ~2 s reais)
    lento: 0.4,        // velocidade da corrida na câmera lenta
    janela: 0.8,       // câmera lenta em [t0, t0 + 0.8]
    janelaReduzida: 0.4,
    gira: 0.4,         // cubo girando em [t0, t0 + 0.4)
    regira: 0.64,      // quem teve desempate gira de novo até t0 + 0.64 (e aí o vencedor é revelado)
    pulso: 0.8         // período do brilho do vencedor (segundos reais)
  };
  var EPS = 1e-6;
  var PLACA_H = 9, PONTA_H = 2, GAP = 1;
  var MARCA = '\u21bb', MARCA_W = 6;   // "↻" (glifo de 5 colunas na fonte do Sprites) + 1 de espaço

  // paleta (mesmos valores dos tokens de game.css)
  var COR = {
    tinta: '#1a1405', texto: '#f1e9d4', texto3: '#95a99b', painel: '#16271f', sombra: '#060d0a',
    ouro: '#f2c230', ouroClaro: '#ffe27a', ouroEscuro: '#9c7210', palha2: '#6f5526', faisca: '#fff6c8'
  };

  // ===========================================================================
  // Utilidades
  // ===========================================================================
  function hexRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    var A = hexRgb(a), B = hexRgb(b), o = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * t)));
      o += (v < 16 ? '0' : '') + v.toString(16);
    }
    return o;
  }
  function rgba(hex, a) { var v = hexRgb(hex); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a.toFixed(3) + ')'; }
  function lum(hex) { var v = hexRgb(hex); return (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) / 255; }
  function frac(x) { return x - Math.floor(x); }
  // hash inteiro -> [0, 1) (o mesmo misturador do sprites.js); só para números "rolando" na faixa
  function hash(n) {
    n = n | 0;
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  }
  // Sprites (fonte pixel): no browser, window.Sprites; no Node, carregado só se alguém pedir
  var spNode = null;
  function sp() {
    if (root && root.Sprites) return root.Sprites;
    if (!spNode && typeof module !== 'undefined' && module.exports) {
      try { spNode = require('./sprites.js'); } catch (e) { spNode = null; }
    }
    return spNode;
  }
  // largura em pixels de arte: dígitos têm sempre 3 colunas (+1 de espaço)
  function numW(s) { return Math.max(0, String(s).length * 4 - 1); }
  function textW(s) { var S = sp(); return S ? S.measureText(s, 1) : numW(s); }

  // ===========================================================================
  // Funções puras
  // ===========================================================================
  function copiaRolls(rolls) {
    var out = [];
    for (var i = 0; i < (rolls || []).length; i++) {
      var r = rolls[i];
      out.push({ racer: r.racer, dice: (r.dice || []).slice(), best: r.best, rerolls: r.rerolls | 0 });
    }
    return out;
  }

  function timeline(sim, racers, escala) {
    var e = escala > 0 ? escala : 1;
    var out = [];
    var evs = (sim && sim.events) || [];
    for (var k = 0; k < evs.length; k++) {
      var ev = evs[k];
      if (ev.type === 'dado') {
        out.push({
          kind: 'dado', t0: ev.t, t1: ev.t + DADO.dur * e, racer: ev.winner, winner: ev.winner,
          rolls: copiaRolls(ev.rolls), changed: !!ev.changed, weather: ev.weather, escala: e
        });
      }
    }
    // ordem por t0, estável (o sort do motor nem sempre é)
    var idx = out.map(function (it, q) { return q; });
    idx.sort(function (a, b) { return (out[a].t0 - out[b].t0) || (a - b); });
    return idx.map(function (q) { return out[q]; });
  }

  function slowFactor(tl, simT, reduced) {
    if (!tl) return 1;
    for (var k = 0; k < tl.length; k++) {
      var it = tl[k];
      if (it.kind !== 'dado') continue;
      var e = it.escala || 1, j = (reduced ? DADO.janelaReduzida : DADO.janela) * e;
      if (simT >= it.t0 - EPS && simT - it.t0 <= j + EPS) return DADO.lento;
    }
    return 1;
  }

  // segundos reais (em x1) desde t0, descontando a câmera lenta
  function tempoReal(d, reduced) {
    var j = reduced ? DADO.janelaReduzida : DADO.janela;
    if (d <= j) return d / DADO.lento;
    return j / DADO.lento + (d - j);
  }

  function diceState(item, simT, reduced, racer) {
    var red = !!reduced;
    var e = item.escala || 1, d = (simT - item.t0) / e;
    var j = racer == null ? item.racer : racer;
    if (d < -EPS || simT >= item.t1 - EPS * e) return { fase: 'fim', brilho: 0, dourado: false, tempo: 0, reduced: red };
    var roll = item.rolls && item.rolls[j];
    var desempate = !!(roll && roll.rerolls > 0);
    var fase;
    if (red) fase = 'mostra';
    else if (d < DADO.gira - EPS) fase = 'gira';
    else if (desempate && d < DADO.regira - EPS) fase = 'regira';
    else fase = 'mostra';
    var tempo = tempoReal(Math.max(0, d), red);
    var brilho = 0, dourado = false;
    if (j === item.winner) {
      if (red) { brilho = 1; dourado = true; }
      else if (d >= DADO.regira - EPS) {
        dourado = true;
        var r0 = tempoReal(DADO.regira, false);
        brilho = 0.5 + 0.5 * Math.cos(2 * Math.PI * (tempo - r0) / DADO.pulso);
        brilho = Math.max(0, Math.min(1, brilho));
      }
    }
    return { fase: fase, brilho: brilho, dourado: dourado, tempo: tempo, reduced: red };
  }

  function diceLabels(roll) {
    var dice = (roll && roll.dice) || [], best = roll ? roll.best : 0, outros = [], tirou = false;
    for (var i = 0; i < dice.length; i++) {
      if (!tirou && dice[i] === best) { tirou = true; continue; }
      outros.push(String(dice[i]));
    }
    return { marca: roll && roll.rerolls > 0 ? MARCA : '', best: String(best), outros: outros };
  }

  // [borda 1][2][↻ 5 + 1 se desempate][best][2]  e, com outros dados: [traço 1][2][o1][2][o2]…[2]  [borda 1]
  function badgeSize(roll) {
    var L = diceLabels(roll), w = numW(L.best) + 6 + (L.marca ? MARCA_W : 0);
    if (L.outros.length) {
      w += 5;
      for (var i = 0; i < L.outros.length; i++) w += numW(L.outros[i]) + (i ? 2 : 0);
    }
    return { w: w, h: PLACA_H + PONTA_H };
  }

  function stripOrder(item) {
    var rolls = item.rolls || [], idx = [];
    for (var i = 0; i < rolls.length; i++) idx.push(i);
    idx.sort(function (a, b) {
      return ((b === item.winner) - (a === item.winner)) || ((rolls[b].rerolls | 0) - (rolls[a].rerolls | 0)) ||
        (rolls[b].best - rolls[a].best) || (a - b);
    });
    return idx;
  }

  // largura de uma entrada da faixa: chip 5 + espaço do número (fixo: os números rolando cabem)
  function slotW(roll) { return (roll && roll.best >= 100 ? 11 : 7) + 2 + (roll && roll.rerolls > 0 ? MARCA_W : 0); }
  function entradaW(roll) { return 5 + slotW(roll); }
  var ROTULO = 'DADO DA SORTE', GAP_E = 2;

  function stripLayout(item, racers, lay) {
    var rolls = item.rolls || [], A = lay.artW;
    var lab = textW(ROTULO), ent = 0;
    for (var i = 0; i < rolls.length; i++) ent += entradaW(rolls[i]) + (i ? GAP_E : 0);
    var y = lay.compact ? lay.hudH + 3 : lay.hudH + 12;   // fora do selo de CURVA/SUBIDA do HUD largo
    var uma = 2 + lab + 4 + ent + 2, L;
    if (uma <= A - 4) {
      var x1 = Math.max(1, Math.round((A - uma) / 2));
      L = { x: x1, y: y, w: uma, h: 7, linhas: 1, rotulo: { x: x1 + 2, y: y + 1 }, entradas: { x: x1 + 2 + lab + 4, y: y } };
    } else {
      var w = Math.min(A - 2, Math.max(lab, ent) + 4), x2 = Math.max(1, Math.round((A - w) / 2));
      L = { x: x2, y: y, w: w, h: 15, linhas: 2, rotulo: { x: x2 + Math.round((w - lab) / 2), y: y + 1 },
        entradas: { x: x2 + Math.max(2, Math.round((w - ent) / 2)), y: y + 8 } };
    }
    L.largura = ent;
    return L;
  }

  function sobrepoe(a, b) {
    return a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;
  }

  function layoutBadges(rects, W, H, fixos) {
    var out = [], i, k;
    for (i = 0; i < rects.length; i++) {
      var c = {}, src = rects[i];
      for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) c[k] = src[k];
      c.x = Math.max(0, Math.min(W - c.w, c.x));
      c.y = Math.max(0, Math.min(H - c.h, c.y));
      out.push(c);
    }
    var ordem = out.map(function (r, q) { return q; });
    ordem.sort(function (a, b) { return (out[a].y - out[b].y) || (out[a].x - out[b].x) || (a - b); });
    var postos = [];
    for (i = 0; fixos && i < fixos.length; i++) {
      var f = fixos[i];
      if (f && f.w > 0 && f.h > 0) postos.push({ x: f.x, y: f.y, w: f.w, h: f.h });
    }
    function livre(x, y, w, h) {
      if (x < 0 || y < 0 || x + w > W || y + h > H) return false;
      var cand = { x: x, y: y, w: w, h: h };
      for (var p = 0; p < postos.length; p++) if (sobrepoe(cand, postos[p])) return false;
      return true;
    }
    for (var o = 0; o < ordem.length; o++) {
      var r = out[ordem[o]], y0 = r.y, x0 = r.x;
      if (!livre(r.x, r.y, r.w, r.h)) {
        // alturas candidatas: logo acima / logo abaixo de cada já colocado, e as bordas
        var ys = [0, H - r.h], xs = [x0], p;
        for (p = 0; p < postos.length; p++) {
          ys.push(postos[p].y - r.h - GAP, postos[p].y + postos[p].h + GAP);
          xs.push(postos[p].x - r.w - GAP, postos[p].x + postos[p].w + GAP);
        }
        var melhor = null;
        // 1) só na vertical
        for (p = 0; p < ys.length; p++) {
          if (!livre(x0, ys[p], r.w, r.h)) continue;
          var dy = Math.abs(ys[p] - y0);
          if (!melhor || dy < melhor.custo || (dy === melhor.custo && ys[p] < melhor.y)) melhor = { x: x0, y: ys[p], custo: dy };
        }
        // 2) sem altura para empilhar: também para o lado (deslocar na horizontal custa o dobro)
        if (!melhor) {
          ys.push(y0);
          for (var a = 0; a < xs.length; a++) for (p = 0; p < ys.length; p++) {
            var xx = Math.max(0, Math.min(W - r.w, xs[a]));
            if (!livre(xx, ys[p], r.w, r.h)) continue;
            var custo = 2 * Math.abs(xx - x0) + Math.abs(ys[p] - y0);
            if (!melhor || custo < melhor.custo) melhor = { x: xx, y: ys[p], custo: custo };
          }
        }
        if (melhor) { r.x = melhor.x; r.y = melhor.y; }
      }
      postos.push(r);
    }
    return out;
  }

  // ===========================================================================
  // Estatísticas do quadro (ui-test e teste de desempenho)
  // ===========================================================================
  var stats = { dados: 0, faixaDado: false, baloes: 0, particulas: 0, msQuadro: 0, quadros: 0, placas: [] };
  var JANELA_MS = 60, amostras = [], somaMs = 0;
  function beginFrame() {
    stats.dados = 0; stats.faixaDado = false; stats.baloes = 0; stats.particulas = 0; stats.placas = [];
  }
  function endFrame(ms) {
    if (!(ms >= 0) || !isFinite(ms)) return;
    amostras.push(ms); somaMs += ms;
    if (amostras.length > JANELA_MS) somaMs -= amostras.shift();
    stats.msQuadro = somaMs / amostras.length;
    stats.quadros++;
  }
  function resetStats(tudo) {
    beginFrame();
    if (tudo) { amostras = []; somaMs = 0; stats.msQuadro = 0; stats.quadros = 0; }
  }

  // ===========================================================================
  // Desenho
  // ===========================================================================
  // Dado de 9×9 em 4 quadros (frente, quina, outra face, quina ao contrário).
  // o contorno · w face clara · h luz · s face na sombra · d base · p pinta · r pinta vermelha
  var CUBO_COR = { o: COR.tinta, w: '#fbf4e2', h: '#ffffff', s: '#cdbf9f', d: '#9b8a6a', p: '#24122e', r: '#d8353b' };
  var CUBO = [
    ['.ooooooo.', 'ohhhhhhho', 'owpwwwpwo', 'owwwwwwwo', 'owwwpwwwo', 'owwwwwwwo', 'owpwwwpwo', 'ossssssso', '.ooooooo.'],
    ['..ooooo..', '.owwwsso.', '.owpwsso.', '.owwwspo.', '.owwwsso.', '.owwwpso.', '.owwwsso.', '.odddddo.', '..ooooo..'],
    ['.ooooooo.', 'ohhhhhhho', 'owwwwwpwo', 'owwwwwwwo', 'owwwrwwwo', 'owwwwwwwo', 'owpwwwwwo', 'ossssssso', '.ooooooo.'],
    ['..ooooo..', '.osswwwo.', '.osswwwo.', '.opswrwo.', '.osswwwo.', '.osswwwo.', '.osswwwo.', '.odddddo.', '..ooooo..']
  ];

  function texto(ctx, s, x, y, S, color) {
    var SP = sp();
    if (SP) SP.drawText(ctx, s, x, y, { scale: S, color: color });
  }

  function drawDice(ctx, x, y, S, roll, estado, isWinner, simT, cor) {
    if (!roll || !estado || estado.fase === 'fim') return '';
    var w = badgeSize(roll).w;
    var tempo = estado.tempo != null ? estado.tempo : (simT || 0);
    function R(dx, dy, ww, hh, col) { ctx.fillStyle = col; ctx.fillRect(x + dx * S, y + dy * S, ww * S, hh * S); }
    stats.dados++;

    if (estado.fase === 'gira' || estado.fase === 'regira') {
      var q = Math.floor(Math.max(0, tempo) * 14) % 4;
      var pulo = Math.round(Math.abs(Math.sin(tempo * Math.PI * 3)) * (estado.fase === 'regira' ? 3 : 2));
      var cx = Math.floor((w - 9) / 2), mapa = CUBO[q];
      R(cx + 2, 9, 5, 1, 'rgba(0,0,0,0.35)');   // sombra no chão
      for (var ry = 0; ry < 9; ry++) for (var rx = 0; rx < 9; rx++) {
        var ch = mapa[ry].charAt(rx);
        if (ch !== '.') R(cx + rx, ry - pulo, 1, 1, CUBO_COR[ch]);
      }
      return '';
    }

    var L = diceLabels(roll);
    var ouro = !!isWinner && (estado.dourado == null ? true : !!estado.dourado);
    var b = ouro ? (estado.brilho != null ? estado.brilho : 1) : 0;
    var borda = ouro ? COR.ouroEscuro : (cor || COR.texto);
    var fundo = ouro ? mix(COR.ouro, COR.ouroClaro, b) : COR.painel;
    var tBest = ouro ? COR.tinta : COR.texto, tOutros = ouro ? COR.palha2 : COR.texto3;
    if (ouro) R(-1, -1, w + 2, PLACA_H + 2, rgba(COR.ouroClaro, 0.3 + 0.55 * b));   // halo
    R(0, 0, w, PLACA_H, borda);
    R(1, 1, w - 2, PLACA_H - 2, fundo);
    var bx = 3;
    if (L.marca) {
      texto(ctx, L.marca, x + bx * S, y + 2 * S, S, ouro ? COR.palha2 : COR.ouroClaro);
      bx += MARCA_W;
    }
    texto(ctx, L.best, x + bx * S, y + 2 * S, S, tBest);
    if (L.outros.length) {
      var sx = bx + numW(L.best) + 2;
      R(sx, 1, 1, PLACA_H - 2, borda);
      var ox = sx + 3;
      for (var i = 0; i < L.outros.length; i++) {
        texto(ctx, L.outros[i], x + ox * S, y + 2 * S, S, tOutros);
        ox += numW(L.outros[i]) + 2;
      }
    }
    // pontinha para o cavalo
    var mx = Math.floor(w / 2);
    R(mx - 1, PLACA_H, 3, 1, borda);
    R(mx, PLACA_H + 1, 1, 1, borda);
    // faíscas do vencedor (posição = função do tempo e do índice)
    if (ouro && !estado.reduced) {
      var ccx = w / 2, ccy = PLACA_H / 2, rxx = w / 2 + 3, ryy = PLACA_H / 2 + 3;
      for (var k = 0; k < 6; k++) {
        var ph = frac(tempo * 1.8 + k * 0.41);
        if (ph >= 0.7) continue;
        var ang = k * Math.PI / 3 + tempo * 1.4;
        var px = Math.round(ccx + Math.cos(ang) * rxx), py = Math.round(ccy + Math.sin(ang) * ryy);
        if (ph < 0.25) {
          R(px - 1, py, 3, 1, COR.faisca); R(px, py - 1, 1, 3, COR.faisca); R(px, py, 1, 1, '#ffffff');
        } else {
          R(px, py, 1, 1, COR.faisca);
        }
        stats.particulas++;
      }
    }
    return L.best;
  }

  function drawDiceStrip(ctx, item, racers, lay, S, simT, reduced) {
    if (!item || !lay) return null;
    var st = diceState(item, simT, reduced, item.winner);
    if (st.fase === 'fim') return null;
    var L = stripLayout(item, racers, lay);
    var e = item.escala || 1, d = (simT - item.t0) / e;
    var revelado = !!reduced || d >= DADO.regira - EPS;
    function R(ax, ay, w, h, col) { ctx.fillStyle = col; ctx.fillRect(ax * S, ay * S, w * S, h * S); }
    R(L.x - 1, L.y - 1, L.w + 2, L.h + 2, COR.ouro);
    R(L.x, L.y, L.w, L.h, COR.sombra);
    texto(ctx, ROTULO, L.rotulo.x * S, L.rotulo.y * S, S, COR.ouro);
    var ordem = revelado ? stripOrder(item) : item.rolls.map(function (r, q) { return q; });
    var ex = L.entradas.x, ey = L.entradas.y;
    for (var k = 0; k < ordem.length; k++) {
      var j = ordem[k], roll = item.rolls[j], r = racers && racers[j];
      var silk = (r && r.silks) || COR.texto3;
      R(ex, ey, 5, 7, silk);
      texto(ctx, String(j + 1), (ex + 1) * S, (ey + 1) * S, S, lum(silk) > 0.5 ? COR.tinta : COR.texto);
      var sw = slotW(roll), nx = ex + 5;
      var est = diceState(item, simT, reduced, j);
      var num, cor;
      if (est.fase === 'gira' || est.fase === 'regira') {
        // número "rolando": hash do corredor e do quadro do giro (10..99, cabe no espaço)
        num = String(10 + Math.floor(hash(j * 7919 + Math.floor(est.tempo * 14) * 131 + 17) * 90));
        cor = COR.texto3;
      } else {
        num = String(roll.best);
        cor = r && r.isPlayer ? COR.ouro : COR.texto;
        if (j === item.winner && est.dourado) {
          R(nx, ey, sw, 7, mix(COR.ouro, COR.ouroClaro, est.brilho));
          cor = COR.tinta;
        }
      }
      var marca = est.fase === 'mostra' && roll.rerolls > 0;
      var tx = nx + Math.round((sw - numW(num) - (marca ? MARCA_W : 0)) / 2);
      if (marca) {
        texto(ctx, MARCA, tx * S, (ey + 1) * S, S, cor === COR.tinta ? COR.palha2 : COR.ouroClaro);
        tx += MARCA_W;
      }
      texto(ctx, num, tx * S, (ey + 1) * S, S, cor);
      ex += entradaW(roll) + GAP_E;
    }
    stats.faixaDado = true;
    return L;
  }

  var RaceFx = {
    DADO: DADO,
    // puras
    timeline: timeline,
    slowFactor: slowFactor,
    diceState: diceState,
    diceLabels: diceLabels,
    badgeSize: badgeSize,
    stripOrder: stripOrder,
    stripLayout: stripLayout,
    layoutBadges: layoutBadges,
    // desenho
    drawDice: drawDice,
    drawDiceStrip: drawDiceStrip,
    // estatísticas
    _stats: stats,
    beginFrame: beginFrame,
    endFrame: endFrame,
    resetStats: resetStats
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RaceFx;
  else root.RaceFx = RaceFx;
})(typeof self !== 'undefined' ? self : this);
