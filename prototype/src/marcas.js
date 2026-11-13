/*
 * MMORPG Horse — marcas, jóquei e faíscas nos moldes (protótipo). Spec: docs/superpowers/specs/2026-11-12-cavalos-marcas-design.md §3–§5
 *
 * Módulo PURO: sem DOM, sem canvas, sem estado, sem Math.random; as entradas nunca são mutadas. Mesmas
 * entradas ⇒ mesmas camadas. Recebe os índices de papel de UM quadro de molde (idx[y·w + x]; papéis de
 * tools/moldes-lib.mjs: 0 vazio, 1 contorno, 2 pelagem, 3 pelagem-sombra, 4/5 crina, 6 detalhe, 7 roupa do
 * jóquei, 8 pele, 9 sela) e as âncoras desse quadro (as do JSON do molde: { footY, nose:[x,y], saddle:[x,y]|null,
 * bbox:{x,y,w,h} }, mais o campo opcional larguraUtil do molde) e devolve CAMADAS (Uint8Array w·h) que o
 * sprites.js pinta por cima da recoloração. Sem âncora (ou bbox vazio): zonas e camadas zeradas, sem lançar.
 * Os limites ficam nas constantes de LIMITES (exportadas, só leitura), para o ajuste fino no portão visual.
 *
 * ============================== ZONAS: zonas(idx, w, h, ancora) =============================
 * Só pixels de pelagem (2 e 3); o resto é zona 0. Cada pixel de pelagem cai em uma zona só:
 *   1 cara:  distância (euclidiana) ao nose ≤ caraRaio · L (0,19; L = ancora.larguraUtil, a largura do retrato do
 *            molde, igual em todos os quadros; sem ela, bbox.w) e y ≤ nose.y + caraBaixo (1 px). Raio e corte
 *            presos ao focinho ⇒ a zona não cresce nem encolhe no galope; o alvo é a cabeça, sem pescoço nem
 *            orelhas (nos 4 moldes antigos: borda de baixo sempre nose.y + 1, área variando ≤ 18% nos 9 quadros;
 *            nos 12 dos portes, borda em nose.y ou nose.y + 1 e área variando até 111%: ver PENDENTES_2A no
 *            moldes-test);
 *   2 patas: y > footY − barriga · bbox.h (0,30), a "linha da barriga";
 *   3 corpo: o resto.
 * PERNAS (perna[i] = −1 fora das patas):
 *   - pernas = componentes 4-conexas da zona de patas. Uma componente com cascos separados nas suas
 *     linhasCascos (3) linhas de baixo é partida na coluna do vão entre eles. Cascos = os pedaços 4-conexos da
 *     componente dentro dessas linhas (pedaços cujas colunas se cruzam contam como um); entre dois cascos
 *     seguidos, coluna de corte = floor((última coluna do da esquerda + primeira do da direita + 1) / 2), e
 *     x < corte fica na parte da esquerda. (Projetar as colunas não basta: casco inclinado encosta, em x, na
 *     perna vizinha sem tocar nela — ondas galope-3.)
 *   - lado: traseira se o centro da perna (média dos x) fica à esquerda da referência (x da sela; sem sela, o meio
 *     do bbox), senão dianteira. Lado com mais de 2: a perna menor junta-se à vizinha mais perto (centro) do
 *     mesmo lado (empate: a da esquerda), até sobrarem 2 — pernas que o desenho não separa contam como uma;
 *   - no lado, a de perto é a de MAIS pixels; empate: a que desce mais (maior y), depois a da esquerda.
 *     Lado com uma perna só: é a de perto;
 *   - ordem fixa: 0 traseira de perto, 1 dianteira de perto, 2 traseira de longe, 3 dianteira de longe.
 *   Quadro com menos pernas (ou sem cara) só pinta o que achou.
 *
 * ============== MARCAS: camadaMarcas(idx, w, h, ancora, marcas, semente) =======================
 * marcas = { cara, patas, corpo } (GameData.MARCAS); cada campo fora da lista vale como "sem marca".
 * Camada: 0 nada · 1 branco (sobre o papel 2) · 2 branco-sombra (sobre o papel 3) · 3 escuro (pintado).
 * Só pinta pelagem, e cada marca só na zona dela (contorno, crina, jóquei e sela nunca mudam).
 *   CENTRO DA CARA (S): o pixel de cara mais perto do ponto médio entre o nose e o pixel mais alto da zona da
 *     cara (o primeiro na ordem de leitura); empate: o primeiro na ordem de leitura.
 *   estrela: S e os 2 primeiros pixels de cara entre (x+1,y), (x,y+1), (x−1,y), (x,y−1) ⇒ até 3 px (2 a 3 em
 *            todos os quadros dos 4 moldes antigos; nos 12 dos portes, 1 px em 3 quadros do galope do robusto-ondas;
 *            só 1 se S for um pixel de cara isolado).
 *   listra:  pixels de cara a até 0,75 px do segmento S → F (1 a 2 px de largura, da testa ao focinho), F = o
 *            pixel de cara mais perto do nose (o nose costuma ser contorno, e o focinho pode fazer curva).
 *   frente:  toda a zona da cara.
 *   N meias: as 3 linhas de baixo (fundo − 2 … fundo, fundo = maior y da perna) das N primeiras pernas ACHADAS,
 *            na ordem fixa (quadro sem a perna 1 passa para a 2): o número de meias visíveis fica limitado às
 *            pernas achadas, e cada perna a mais pinta uma meia a mais.
 *   Padrões do corpo, presos à REFERÊNCIA (sela; sem sela, o centro do bbox, arredondado para baixo):
 *     (u, v) = (x − ref.x, y − ref.y), então o padrão é o mesmo em todos os quadros do galope.
 *   malhado: rng = mulberry32(hash2(semente, 0x4D414C48)); 1 chamada: n = 2 + floor(3·rng) manchas; por mancha
 *     4 chamadas: cx = −20 + L·(k + 0,5) + (rng − 0,5)·L/2 (L = 34/n), cy = 2 + 6·rng, rx = 3,5 + 3·rng,
 *     ry = 2,5 + 2,5·rng. Pinta se (du/rx)² + (dv/ry)² ≤ 1 + 0,4·(ruído(u,v) − 0,5) em alguma mancha
 *     (ruído = byte de hash2(hash2(semente ^ 0x52554944, u), v) / 255: borda irregular, presa a (u, v)).
 *   pintado: células 3×3 de (u, v); em cada uma, h = hash2(hash2(semente ^ 0x50494E54, cu), cv): pinta se
 *     (h & 255) < 154 (60%) um ponto de 1 px (escuro) em ((h >>> 8) % 3, (h >>> 16) % 3) da célula (~6,7%).
 *   ruão: blocos 5×2 de (u, v) (posição p = du + 5·dv, 0–9); h = hash2(hash2(semente ^ 0x5255414F, bu), bv),
 *     m = 3 ou 7 (h & 1), d = (h >>> 1) % 10: branco se (m·p + d) % 10 < 3 — exatamente 3 de cada 10 (30%).
 *
 * ================== JÓQUEI: camadaJoquei(idx, w, h, ancora, padrao) ==========================
 * Camada: 0 nada · 1 tom 2 da seda (padrão) · 2 capacete · 3 manta.
 *   manta: todo pixel de sela (9).
 *   capacete: grupos 4-conexos do papel 7; o de cima é o primeiro com ≥ 3 px na ordem de leitura (nenhum com
 *     3: o primeiro). LINHA DO CAPACETE = maior y desse grupo, cortada no fundo do rosto (o grupo 8-conexo de
 *     pele que tem o pixel de pele mais alto) quando o rosto acaba antes — o cabelo pode ligar o capacete à
 *     roupa. Capacete = os pixels do grupo de cima até a linha.
 *   padrão (GameData.JOQUEI.padroes; fora da lista vale liso): só no papel 7 fora do capacete e abaixo da
 *     linha, em (u, v) relativos à referência (como as marcas do corpo), ~1/3 dos pixels:
 *       liso nada · listras u % 3 = 0 · faixa (u + v) % 6 < 2 · xadrez casas 2×2 alternadas sem o canto de baixo
 *       à direita (3/8) · estrelas cruzes de 5 px numa grade 4×4, fileiras alternadas deslocadas 2 (5/16) ·
 *       losangos (u + v) % 6 = 0 ou (u − v) % 6 = 0, a rede de diagonais (11/36). (% sempre positivo.)
 *     Nos 120 quadros parado/galope dos 12 moldes dos portes o padrão fica entre 15% e 45% da seda (sempre menos
 *     que a base; nos 4 moldes antigos, entre 18% e 44%).
 *
 * ================== FAÍSCAS: faiscas(semente, n) =============================================
 * n faíscas { dx, dy, fase }: dx, dy em [0, 1] na caixa do cavalo com margem (quem desenha escolhe a margem),
 * fase em [0, 1). rng = mulberry32(hash2(semente, 0x46410000)); 1 chamada: giro; por faísca 3 chamadas: posição
 * t = (giro + (k + 0,2 + 0,6·rng) / n) % 1 no perímetro (topo, direita, baixo, esquerda, nesta ordem), recuo para
 * dentro (0,2·rng da distância ao centro) e fase. n inválido ou ≤ 0: []; n é preso a no máximo 16.
 * N_FAISCAS e BRILHO (mistura da cor da raridade na faixa de brilho da crina) são por raridade (spec §5).
 */
(function (root) {
  'use strict';

  var G = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./data.js') : root.GameData;
  var S = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('./sim.js') : root.RaceSim;

  // Limites das zonas (ajuste fino no portão visual).
  var CARA_RAIO = 0.19;   // raio da cara a partir do nose, em fração de larguraUtil (sem ela, de bbox.w)
  var CARA_BAIXO = 1;     // a cara vai até nose.y + CARA_BAIXO (corte preso ao focinho)
  var BARRIGA = 0.30;     // linha da barriga = footY − BARRIGA · bbox.h
  var LINHAS_CASCOS = 3;  // linhas de baixo de uma perna onde se procuram cascos separados
  var MAX_FAISCAS = 16;
  var LIMITES = { caraRaio: CARA_RAIO, caraBaixo: CARA_BAIXO, barriga: BARRIGA, linhasCascos: LINHAS_CASCOS };
  if (Object.freeze) Object.freeze(LIMITES);

  var N_FAISCAS = { comum: 0, magico: 0, raro: 3, lendario: 5, mitico: 5 };
  var BRILHO = { comum: 0, magico: 0.25, raro: 0.30, lendario: 0.45, mitico: 0.45 };

  function mod(a, n) { return ((a % n) + n) % n; }
  function pelagem(v) { return v === 2 || v === 3; }
  function ancoraValida(a) { return !!(a && a.bbox && a.bbox.w > 0 && a.bbox.h > 0); }
  function emLista(lista, v) { return lista.indexOf(v) >= 0; }
  function vazias(n) {
    var perna = new Int8Array(n);
    for (var i = 0; i < n; i++) perna[i] = -1;
    return { zona: new Uint8Array(n), perna: perna };
  }
  // Referência dos padrões: a sela; sem sela (retrato), o centro do bbox.
  function referencia(a) {
    if (a.saddle) return [a.saddle[0], a.saddle[1]];
    return [Math.floor(a.bbox.x + a.bbox.w / 2), Math.floor(a.bbox.y + a.bbox.h / 2)];
  }

  // ------------------------------------------------------------------ zonas
  function zonas(idx, w, h, ancora) {
    var n = w * h, Z = vazias(n), zona = Z.zona, perna = Z.perna;
    if (!ancoraValida(ancora)) return Z;
    var bb = ancora.bbox, nose = ancora.nose;
    var L = ancora.larguraUtil > 0 ? ancora.larguraUtil : bb.w, raio2 = Math.pow(CARA_RAIO * L, 2);
    var barriga = (typeof ancora.footY === 'number' && ancora.footY >= 0) ? ancora.footY - BARRIGA * bb.h : Infinity;
    var x, y, i;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      if (!pelagem(idx[i])) continue;
      if (nose && y <= nose[1] + CARA_BAIXO && (x - nose[0]) * (x - nose[0]) + (y - nose[1]) * (y - nose[1]) <= raio2) zona[i] = 1;
      else if (y > barriga) zona[i] = 2;
      else zona[i] = 3;
    }
    marcarPernas(zona, perna, w, h, ancora);
    return Z;
  }

  // Componentes 4-conexas da zona 2, cada uma uma lista de índices (na ordem de leitura do primeiro pixel).
  function componentesPatas(zona, w, h) {
    var n = w * h, visto = new Uint8Array(n), lista = [], i;
    for (i = 0; i < n; i++) {
      if (zona[i] !== 2 || visto[i]) continue;
      var px = [], pilha = [i];
      visto[i] = 1;
      while (pilha.length) {
        var j = pilha.pop(), x = j % w, y = (j / w) | 0;
        px.push(j);
        var viz = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1];
        for (var k = 0; k < 4; k++) if (viz[k] >= 0 && zona[viz[k]] === 2 && !visto[viz[k]]) { visto[viz[k]] = 1; pilha.push(viz[k]); }
      }
      lista.push(px);
    }
    return lista;
  }

  // Parte uma componente nos vãos entre cascos das suas LINHAS_CASCOS linhas de baixo: os cascos são os pedaços
  // 4-conexos da componente dentro dessas linhas; pedaços com colunas que se cruzam contam como um casco só.
  function partirCascos(px, w) {
    var fundo = -1, k, x, y, dentro = {}, visto = {};
    for (k = 0; k < px.length; k++) { y = (px[k] / w) | 0; if (y > fundo) fundo = y; }
    for (k = 0; k < px.length; k++) if (((px[k] / w) | 0) > fundo - LINHAS_CASCOS) dentro[px[k]] = 1;
    var cascos = [];
    for (k = 0; k < px.length; k++) {
      if (!dentro[px[k]] || visto[px[k]]) continue;
      var c = { x0: Infinity, x1: -1 }, pilha = [px[k]];
      visto[px[k]] = 1;
      while (pilha.length) {
        var j = pilha.pop();
        x = j % w;
        if (x < c.x0) c.x0 = x;
        if (x > c.x1) c.x1 = x;
        var viz = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w];
        for (var v = 0; v < 4; v++) if (dentro[viz[v]] && !visto[viz[v]]) { visto[viz[v]] = 1; pilha.push(viz[v]); }
      }
      cascos.push(c);
    }
    cascos.sort(function (a, b) { return a.x0 - b.x0; });
    var cortes = [], fim = cascos.length ? cascos[0].x1 : -1;
    for (k = 1; k < cascos.length; k++) {
      if (cascos[k].x0 > fim) cortes.push(Math.floor((fim + cascos[k].x0 + 1) / 2));
      if (cascos[k].x1 > fim) fim = cascos[k].x1;
    }
    if (!cortes.length) return [px];
    var partes = [];
    for (k = 0; k <= cortes.length; k++) partes.push([]);
    for (k = 0; k < px.length; k++) {
      x = px[k] % w;
      var p = 0;
      while (p < cortes.length && x >= cortes[p]) p++;
      partes[p].push(px[k]);
    }
    return partes;
  }

  function resumo(px, w) {
    var soma = 0, fundo = -1;
    for (var k = 0; k < px.length; k++) { soma += px[k] % w; if (((px[k] / w) | 0) > fundo) fundo = (px[k] / w) | 0; }
    return { px: px, n: px.length, fundo: fundo, cx: soma / px.length };
  }

  function marcarPernas(zona, perna, w, h, ancora) {
    var comps = componentesPatas(zona, w, h), pernas = [], k, j;
    for (k = 0; k < comps.length; k++) {
      var partes = partirCascos(comps[k], w);
      for (j = 0; j < partes.length; j++) pernas.push(resumo(partes[j], w));
    }
    var refX = referencia(ancora)[0], tras = [], frente = [];
    for (k = 0; k < pernas.length; k++) (pernas[k].cx < refX ? tras : frente).push(pernas[k]);
    // lado com mais de 2: a menor junta-se à vizinha mais perto do mesmo lado
    function juntar(lado) {
      while (lado.length > 2) {
        var m = 0;
        for (var a = 1; a < lado.length; a++) if (lado[a].n < lado[m].n) m = a;
        var alvo = -1;
        for (var b = 0; b < lado.length; b++) {
          if (b === m) continue;
          var d = Math.abs(lado[b].cx - lado[m].cx);
          if (alvo < 0 || d < Math.abs(lado[alvo].cx - lado[m].cx) ||
              (d === Math.abs(lado[alvo].cx - lado[m].cx) && lado[b].cx < lado[alvo].cx)) alvo = b;
        }
        lado[alvo] = resumo(lado[alvo].px.concat(lado[m].px), w);
        lado.splice(m, 1);
      }
      // de perto primeiro: mais pixels; empate: desce mais; depois a da esquerda (e, por fim, o 1º pixel)
      return lado.sort(function (p, q) { return (q.n - p.n) || (q.fundo - p.fundo) || (p.cx - q.cx) || (p.px[0] - q.px[0]); });
    }
    tras = juntar(tras); frente = juntar(frente);
    var ordem = [tras[0], frente[0], tras[1], frente[1]];
    for (k = 0; k < 4; k++) if (ordem[k]) for (j = 0; j < ordem[k].px.length; j++) perna[ordem[k].px[j]] = k;
  }

  // ------------------------------------------------------------------ marcas
  // O pixel de cara mais perto de (px, py); empate: o primeiro na ordem de leitura. −1 sem cara.
  function maisPerto(zona, w, h, px, py) {
    var melhor = -1, dMin = Infinity;
    for (var i = 0; i < w * h; i++) {
      if (zona[i] !== 1) continue;
      var dx = i % w - px, dy = ((i / w) | 0) - py, d = dx * dx + dy * dy;
      if (d < dMin) { dMin = d; melhor = i; }
    }
    return melhor;
  }
  // Centro da cara: o pixel de cara mais perto do meio entre o nose e o pixel mais alto da zona.
  function centroCara(zona, w, h, nose) {
    var topo = -1;
    for (var i = 0; i < w * h && topo < 0; i++) if (zona[i] === 1) topo = i;
    if (topo < 0 || !nose) return -1;
    return maisPerto(zona, w, h, (topo % w + nose[0]) / 2, (((topo / w) | 0) + nose[1]) / 2);
  }

  function distSegmento2(px, py, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    var t = l2 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var dx = px - (ax + t * vx), dy = py - (ay + t * vy);
    return dx * dx + dy * dy;
  }

  // ruído de 0 a 1 preso a (u, v)
  function ruido(semente, u, v) { return (S.hash2(S.hash2(semente ^ 0x52554944, u), v) & 255) / 255; }

  function manchasMalhado(semente) {
    var rng = S.mulberry32(S.hash2(semente, 0x4D414C48)), n = 2 + Math.floor(3 * rng()), L = 34 / n, out = [];
    for (var k = 0; k < n; k++) {
      out.push({
        cx: -20 + L * (k + 0.5) + (rng() - 0.5) * L / 2,
        cy: 2 + 6 * rng(),
        rx: 3.5 + 3 * rng(),
        ry: 2.5 + 2.5 * rng()
      });
    }
    return out;
  }

  function camadaMarcas(idx, w, h, ancora, marcas, semente) {
    var n = w * h, out = new Uint8Array(n);
    if (!marcas || !ancoraValida(ancora)) return out;
    var M = G.MARCAS;
    var cara = emLista(M.cara, marcas.cara) ? marcas.cara : 'nenhuma';
    var patas = emLista(M.patas, marcas.patas) ? marcas.patas : 0;
    var corpo = emLista(M.corpo, marcas.corpo) ? marcas.corpo : 'liso';
    semente = semente >>> 0;
    var Z = zonas(idx, w, h, ancora), zona = Z.zona, perna = Z.perna, i, x, y, k;
    function branco(j) { out[j] = idx[j] === 2 ? 1 : 2; }

    // cara
    if (cara === 'frente') {
      for (i = 0; i < n; i++) if (zona[i] === 1) branco(i);
    } else if (cara === 'estrela' || cara === 'listra') {
      var s = centroCara(zona, w, h, ancora.nose);
      if (s >= 0) {
        var sx = s % w, sy = (s / w) | 0;
        if (cara === 'estrela') {
          branco(s);
          var viz = [[1, 0], [0, 1], [-1, 0], [0, -1]], postos = 0;
          for (k = 0; k < viz.length && postos < 2; k++) {
            x = sx + viz[k][0]; y = sy + viz[k][1];
            if (x >= 0 && y >= 0 && x < w && y < h && zona[y * w + x] === 1) { branco(y * w + x); postos++; }
          }
        } else {
          var f = maisPerto(zona, w, h, ancora.nose[0], ancora.nose[1]), fx = f % w, fy = (f / w) | 0;
          for (i = 0; i < n; i++) {
            if (zona[i] === 1 && distSegmento2(i % w, (i / w) | 0, sx, sy, fx, fy) <= 0.5625) branco(i);
          }
        }
      }
    }

    // meias: as 3 linhas de baixo das N primeiras pernas achadas, na ordem fixa
    if (patas > 0) {
      var fundo = [-1, -1, -1, -1], comMeia = [false, false, false, false], postas = 0;
      for (i = 0; i < n; i++) if (perna[i] >= 0 && ((i / w) | 0) > fundo[perna[i]]) fundo[perna[i]] = (i / w) | 0;
      for (k = 0; k < 4 && postas < patas; k++) if (fundo[k] >= 0) { comMeia[k] = true; postas++; }
      for (i = 0; i < n; i++) if (perna[i] >= 0 && comMeia[perna[i]] && ((i / w) | 0) >= fundo[perna[i]] - 2) branco(i);
    }

    // corpo, preso à referência
    if (corpo !== 'liso') {
      var ref = referencia(ancora), manchas = corpo === 'malhado' ? manchasMalhado(semente) : null;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        i = y * w + x;
        if (zona[i] !== 3) continue;
        var u = x - ref[0], v = y - ref[1], hh;
        if (corpo === 'malhado') {
          var borda = 1 + 0.4 * (ruido(semente, u, v) - 0.5);
          for (k = 0; k < manchas.length; k++) {
            var du = (u - manchas[k].cx) / manchas[k].rx, dv = (v - manchas[k].cy) / manchas[k].ry;
            if (du * du + dv * dv <= borda) { branco(i); break; }
          }
        } else if (corpo === 'pintado') {
          var cu = Math.floor(u / 3), cv = Math.floor(v / 3);
          hh = S.hash2(S.hash2(semente ^ 0x50494E54, cu), cv);
          if ((hh & 255) < 154 && u - 3 * cu === (hh >>> 8) % 3 && v - 3 * cv === (hh >>> 16) % 3) out[i] = 3;
        } else { // ruao
          var bu = Math.floor(u / 5), bv = Math.floor(v / 2), p = (u - 5 * bu) + 5 * (v - 2 * bv);
          hh = S.hash2(S.hash2(semente ^ 0x5255414F, bu), bv);
          if (((hh & 1 ? 3 : 7) * p + (hh >>> 1) % 10) % 10 < 3) branco(i);
        }
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ jóquei
  var PADROES = {
    liso: function () { return false; },
    listras: function (u) { return mod(u, 3) === 0; },
    faixa: function (u, v) { return mod(u + v, 6) < 2; },
    xadrez: function (u, v) {
      return ((Math.floor(u / 2) + Math.floor(v / 2)) & 1) === 0 && !(mod(u, 2) === 1 && mod(v, 2) === 1);
    },
    estrelas: function (u, v) {
      var a = mod(u + 2 * (Math.floor(v / 4) & 1), 4), b = mod(v, 4);
      return (b === 2 && a !== 0) || (a === 2 && b !== 0);
    },
    losangos: function (u, v) { return mod(u + v, 6) === 0 || mod(u - v, 6) === 0; }
  };

  // Grupos conexos (4 ou 8) dos pixels com papel `papel`, na ordem de leitura do primeiro pixel de cada um.
  function grupos(idx, w, h, papel, oito) {
    var n = w * h, rot = new Int32Array(n), lista = [], i;
    for (i = 0; i < n; i++) rot[i] = -1;
    for (i = 0; i < n; i++) {
      if (idx[i] !== papel || rot[i] >= 0) continue;
      var g = { px: [], y1: -1 }, pilha = [i];
      rot[i] = lista.length;
      while (pilha.length) {
        var j = pilha.pop(), x = j % w, y = (j / w) | 0;
        g.px.push(j); if (y > g.y1) g.y1 = y;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || (!oito && dx && dy)) continue;
          var xx = x + dx, yy = y + dy, k = yy * w + xx;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && idx[k] === papel && rot[k] < 0) { rot[k] = lista.length; pilha.push(k); }
        }
      }
      lista.push(g);
    }
    return lista;
  }

  function camadaJoquei(idx, w, h, ancora, padrao) {
    var n = w * h, out = new Uint8Array(n), i;
    if (!ancoraValida(ancora)) return out;
    for (i = 0; i < n; i++) if (idx[i] === 9) out[i] = 3;
    var roupa = grupos(idx, w, h, 7, false);
    if (!roupa.length) return out;
    var cima = roupa[0];
    for (i = 0; i < roupa.length; i++) if (roupa[i].px.length >= 3) { cima = roupa[i]; break; }
    var linha = cima.y1, pele = grupos(idx, w, h, 8, true);
    if (pele.length && pele[0].y1 < linha) linha = pele[0].y1;
    for (i = 0; i < cima.px.length; i++) if (((cima.px[i] / w) | 0) <= linha) out[cima.px[i]] = 2;
    var f = Object.prototype.hasOwnProperty.call(PADROES, padrao) && emLista(G.JOQUEI.padroes, padrao) ? PADROES[padrao] : PADROES.liso;
    var ref = referencia(ancora);
    for (i = 0; i < n; i++) {
      var y = (i / w) | 0;
      if (idx[i] === 7 && out[i] !== 2 && y > linha && f(i % w - ref[0], y - ref[1])) out[i] = 1;
    }
    return out;
  }

  // ------------------------------------------------------------------ faíscas
  function faiscas(semente, n) {
    n = Math.floor(Number(n));
    if (!(n > 0)) return [];
    if (n > MAX_FAISCAS) n = MAX_FAISCAS;
    var rng = S.mulberry32(S.hash2(semente >>> 0, 0x46410000)), giro = rng(), out = [];
    for (var k = 0; k < n; k++) {
      var t = (giro + (k + 0.2 + 0.6 * rng()) / n) % 1, s = 4 * t, lado = Math.floor(s), f = s - lado;
      var px = lado === 0 ? f : (lado === 1 ? 1 : (lado === 2 ? 1 - f : 0));
      var py = lado === 0 ? 0 : (lado === 1 ? f : (lado === 2 ? 1 : 1 - f));
      var dentro = 0.2 * rng();
      out.push({ dx: px + (0.5 - px) * dentro, dy: py + (0.5 - py) * dentro, fase: rng() });
    }
    return out;
  }

  var Marcas = {
    LIMITES: LIMITES,
    N_FAISCAS: N_FAISCAS,
    BRILHO: BRILHO,
    zonas: zonas,
    camadaMarcas: camadaMarcas,
    camadaJoquei: camadaJoquei,
    faiscas: faiscas
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Marcas;
  else root.Marcas = Marcas;
})(typeof self !== 'undefined' ? self : this);
