// prototype/tools/moldes-lib.mjs — normalização e validação dos moldes de cavalo (spec §3.1–§3.2).
// Um "molde" é uma imagem 64×64 em que cada pixel carrega um PAPEL (0–9), não uma cor final.
import { encodePng } from './png.mjs';

// Índice = papel. 0 = transparente. Cores de referência dos papéis: as que o prompt pede por texto e as
// das prévias. (paletaPng() vem da paleta forçada, testada e descartada no lote; segue para testes e consultas.)
export const PAPEIS = [null, '#000000', '#ff0000', '#800000', '#00ff00', '#008000', '#0000ff', '#ffff00', '#ffc0cb', '#808080'];
export const NOMES_PAPEIS = [
  'transparente', 'contorno', 'pelagem', 'pelagem-sombra', 'crina', 'crina-sombra',
  'extra', 'jóquei-roupa', 'jóquei-pele', 'sela',
];

const RGB = PAPEIS.map(h => h && [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

/** PNG 9×1 com as 9 cores da paleta, na ordem dos papéis 1..9 (para color_image/palette_image). */
export function paletaPng() {
  const rgba = new Uint8Array(9 * 4);
  for (let i = 1; i <= 9; i++) { rgba.set(RGB[i], (i - 1) * 4); rgba[(i - 1) * 4 + 3] = 255; }
  return encodePng({ width: 9, height: 1, rgba });
}

/**
 * Mapeia RGBA para índices de papel. Alfa < 128 ⇒ 0; cor exata ⇒ seu papel; senão papel da cor mais
 * próxima (distância RGB) e conta em `aproximados`. Devolve também w/h e `opacos` para uso em validar().
 * @returns {{ idx: Uint8Array, papeis: Set<number>, aproximados: number, opacos: number, w: number, h: number }}
 */
export function normalizar(rgba, w, h) {
  const idx = new Uint8Array(w * h), papeis = new Set();
  let aproximados = 0, opacos = 0;
  for (let i = 0; i < w * h; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    opacos++;
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    let melhor = 1, dMin = Infinity;
    for (let p = 1; p <= 9; p++) {
      const d = (r - RGB[p][0]) ** 2 + (g - RGB[p][1]) ** 2 + (b - RGB[p][2]) ** 2;
      if (d < dMin) { dMin = d; melhor = p; }
    }
    if (dMin !== 0) aproximados++;
    idx[i] = melhor; papeis.add(melhor);
  }
  return { idx, papeis, aproximados, opacos, w, h };
}

/**
 * Valida um quadro normalizado.
 * @param {{ idx: Uint8Array, papeis: Set<number>, aproximados: number, w: number, h: number, opacos?: number }} quadro
 *        o objeto devolvido por normalizar() (que já traz w e h).
 * @param {{ exigeJoquei?: boolean }} opts retrato: false (papéis 1–4); demais quadros: true (+ 7 e 8).
 * @returns {{ ok: true } | { ok: false, motivo: string }}
 */
export function validar(quadro, { exigeJoquei = false } = {}) {
  const { idx, papeis, aproximados, w, h } = quadro;
  const opacos = quadro.opacos != null ? quadro.opacos : idx.reduce((n, v) => n + (v ? 1 : 0), 0);
  if (opacos === 0) return { ok: false, motivo: 'quadro vazio: faltam papéis (nenhum pixel opaco)' };
  if (aproximados / opacos > 0.02) {
    return { ok: false, motivo: 'fora da paleta: ' + aproximados + ' de ' + opacos + ' pixels (' + (100 * aproximados / opacos).toFixed(1) + '%) acima de 2%' };
  }
  const obrig = exigeJoquei ? [1, 2, 3, 4, 7, 8] : [1, 2, 3, 4];
  const faltam = obrig.filter(p => !papeis.has(p));
  if (faltam.length) return { ok: false, motivo: 'faltam papéis: ' + faltam.map(p => p + ' (' + NOMES_PAPEIS[p] + ')').join(', ') };

  // Silhueta aberta: pixel transparente inalcançável a partir das bordas e vizinho de 2/3 é "buraco".
  const alc = new Uint8Array(w * h), pilha = [];
  const semear = i => { if (!idx[i] && !alc[i]) { alc[i] = 1; pilha.push(i); } };
  for (let x = 0; x < w; x++) { semear(x); semear((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { semear(y * w); semear(y * w + w - 1); }
  while (pilha.length) {
    const i = pilha.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0) semear(i - 1);
    if (x < w - 1) semear(i + 1);
    if (y > 0) semear(i - w);
    if (y < h - 1) semear(i + w);
  }
  let buracos = 0;
  const pele = i => idx[i] === 2 || idx[i] === 3;
  for (let i = 0; i < w * h; i++) {
    if (idx[i] || alc[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if ((x > 0 && pele(i - 1)) || (x < w - 1 && pele(i + 1)) || (y > 0 && pele(i - w)) || (y < h - 1 && pele(i + w))) buracos++;
  }
  if (buracos > 4) return { ok: false, motivo: 'silhueta aberta: ' + buracos + ' buracos de transparência dentro da pelagem (máx. 4)' };
  return { ok: true };
}

/**
 * Âncoras de um quadro de índices. bbox sobre pixels opacos; nose/rear = pixel mais à direita/esquerda
 * na metade superior (linhas bbox.y .. bbox.y + floor(bbox.h/2)), empate ⇒ o mais alto;
 * saddle = centro (arredondado) dos pixels de papel 9, ou null.
 */
export function ancoras(idx, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1, sx = 0, sy = 0, sn = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = idx[y * w + x];
    if (!v) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (v === 9) { sx += x; sy += y; sn++; }
  }
  if (x1 < 0) return { footY: -1, nose: null, rear: null, saddle: null, bbox: { x: 0, y: 0, w: 0, h: 0 } };
  const bbox = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  const yFim = y0 + Math.floor(bbox.h / 2);
  let nose = null, rear = null;
  for (let y = y0; y <= yFim; y++) for (let x = x0; x <= x1; x++) {
    if (!idx[y * w + x]) continue;
    if (!nose || x > nose[0]) nose = [x, y];
    if (!rear || x < rear[0]) rear = [x, y];
  }
  return { footY: y1, nose, rear, saddle: sn ? [Math.round(sx / sn), Math.round(sy / sn)] : null, bbox };
}

/**
 * Passada de um quadro de galope (aceite do galope de corrida, spec 2026-11-09 §4): distância horizontal
 * entre o pixel de perna/casco mais à esquerda e o mais à direita nas linhas do terço de baixo do contorno
 * (as floor(bbox.h / 3) últimas linhas do bbox, no mínimo 1).
 * Só conta perna/casco: pixels opacos que não são crina (4/5), agrupados em componentes 8-conexos DENTRO
 * dessa faixa, e só os componentes com algum pixel de corpo (papéis 2, 3, 6–9). Assim a ponta da cauda que
 * desce até a faixa (crina, ou contorno/sombra escura sem pelagem, como nas folhas) não conta, e a perna
 * fina desenhada só com contorno (lisa) conta, porque se liga à pelagem da coxa ou da barriga na faixa.
 * Com "qualquer pixel opaco" a cauda baixa de ondas, folhas e lisa passaria por passada longa.
 * @param {Uint8Array} idx índices de papel (w × h)
 * @returns {number} 0 se nada de perna cair na faixa
 */
export function passada(idx, w, h) {
  const { bbox } = ancoras(idx, w, h);
  if (!bbox.h) return 0;
  const y1 = bbox.y + bbox.h - 1, y0 = y1 - Math.max(1, Math.floor(bbox.h / 3)) + 1;
  const crina = v => v === 4 || v === 5;
  const naFaixa = i => idx[i] && !crina(idx[i]);
  const visto = new Uint8Array(w * h);
  let xMin = w, xMax = -1;
  for (let i = y0 * w; i < (y1 + 1) * w; i++) {
    if (visto[i] || !naFaixa(i)) continue;
    const pilha = [i], membros = [];
    let temCorpo = false;
    visto[i] = 1;
    while (pilha.length) {
      const j = pilha.pop(), x = j % w, y = (j / w) | 0;
      membros.push(j);
      if (idx[j] >= 2) temCorpo = true; // crina já ficou de fora: ≥ 2 aqui é pelagem, casco ou jóquei
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, k = yy * w + xx;
        if ((dx || dy) && xx >= 0 && xx < w && yy >= y0 && yy <= y1 && !visto[k] && naFaixa(k)) { visto[k] = 1; pilha.push(k); }
      }
    }
    if (temCorpo) for (const j of membros) { const x = j % w; if (x < xMin) xMin = x; if (x > xMax) xMax = x; }
  }
  return xMax < 0 ? 0 : xMax - xMin;
}

/** Índices de papel → tons de cinza (valor = índice × 25), para enviar como imagem de cinza. */
export function paraCinza(idx) {
  const out = new Uint8Array(idx.length);
  for (let i = 0; i < idx.length; i++) out[i] = idx[i] * 25;
  return out;
}

/** Tons de cinza → índices de papel (round(v / 25), limitado a 0–9). */
export function deCinza(data) {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = Math.min(9, Math.round(data[i] / 25));
  return out;
}

// ---------------------------------------------------------------- cores livres → papéis (Task 2)
// Os moldes vêm do pixflux SEM paleta forçada (a paleta forçada usava um só tom de cada par e misturava
// cores do jóquei na crina). Cada quadro é classificado por família de cor; claro × sombra da pelagem e da
// crina saem de um limiar de Otsu calculado uma vez por grupo de quadros que precisa dos mesmos tons (os
// quadros do galope juntos, para não piscar); depois limpa os papéis do jóquei, sombreia por procedimento o
// par desequilibrado e fecha o contorno.

const JOQUEI = v => v === 7 || v === 8 || v === 9;
const ORDEM_DESEMPATE = [4, 2, 6, 1, 3, 5];
const FAMILIAS = { pelagem: 2, crina: 4 }; // índice do tom claro; a sombra é o seguinte

/**
 * Sombreado procedural: em cada região pedida (pelagem = papéis 2/3 juntos, crina = 4/5 juntos), percorre
 * cada coluna; em cada corrida vertical contínua da região, o terço de baixo (floor(L/3), no mínimo 1 px
 * quando L ≥ 3) vira o tom de sombra (3 ou 5) e o resto vira o tom claro (2 ou 4). Pura e determinística.
 * @param {Uint8Array} idx índices de papel (w × h)
 * @param {{ regioes?: number[] }} opts tons claros das regiões a sombrear (padrão [2, 4])
 * @returns {{ idx: Uint8Array, alterados: number }} novo vetor de índices e quantos pixels mudaram
 */
export function sombrearRegioes(idx, w, h, { regioes = [2, 4] } = {}) {
  const out = Uint8Array.from(idx);
  const regiao = v => { const r = v === 2 || v === 3 ? 2 : v === 4 || v === 5 ? 4 : 0; return regioes.includes(r) ? r : 0; };
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      const r = regiao(idx[y * w + x]);
      if (!r) { y++; continue; }
      let y1 = y;
      while (y1 + 1 < h && regiao(idx[(y1 + 1) * w + x]) === r) y1++;
      const L = y1 - y + 1, sombra = L >= 3 ? Math.max(1, Math.floor(L / 3)) : 0;
      for (let k = y; k <= y1; k++) out[k * w + x] = k > y1 - sombra ? r + 1 : r;
      y = y1 + 1;
    }
  }
  let alterados = 0;
  for (let i = 0; i < out.length; i++) if (out[i] !== idx[i]) alterados++;
  return { idx: out, alterados };
}

/**
 * Limpeza espacial dos papéis do jóquei (7/8/9). Sem jóquei (retrato): todo pixel 7/8/9 é remapeado.
 * Com jóquei: fica o maior componente conexo (8-vizinhança) de pixels {7,8,9} e os componentes "junto do
 * jóquei", em cadeia: a até 2 px (Chebyshev) de um componente que já fica (capacete → rosto → seda); e, se
 * o componente for majoritariamente cinza (9), também a até 4 px ou embaixo do jóquei (sobrepõe a faixa x
 * do maior componente ± 2 e começa até 8 linhas abaixo do fim dele) — a sela fica sob a calça e o contorno,
 * a 3–6 px da seda; rédea na cabeça e casco cinza saem.
 * Os demais 7/8/9 são remapeados para o papel 1–6
 * mais comum entre os 8 vizinhos (desempate 4, 2, 6, 1, depois 3, 5), em passadas simultâneas até
 * resolver os pixels cercados só por jóquei; sem vizinho nenhum ⇒ 1 (contorno).
 * @param {Uint8Array} idx
 * @param {{ comJoquei?: boolean }} opts
 * @returns {{ idx: Uint8Array, remapeados: number }}
 */
export function limparJoquei(idx, w, h, { comJoquei = false } = {}) {
  const out = Uint8Array.from(idx), pendente = new Uint8Array(w * h);
  const viz = i => {
    const x = i % w, y = (i / w) | 0, r = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) r.push(i + dy * w + dx);
    }
    return r;
  };
  if (!comJoquei) {
    for (let i = 0; i < w * h; i++) if (JOQUEI(idx[i])) pendente[i] = 1;
  } else {
    const comp = new Int32Array(w * h).fill(-1), tamanhos = [], cinzas = [], caixas = [];
    for (let i = 0; i < w * h; i++) {
      if (!JOQUEI(idx[i]) || comp[i] >= 0) continue;
      const c = tamanhos.length, pilha = [i];
      comp[i] = c; tamanhos.push(0); cinzas.push(0); caixas.push([w, h, -1, -1]);
      while (pilha.length) {
        const j = pilha.pop(), x = j % w, y = (j / w) | 0, cx = caixas[c];
        tamanhos[c]++; if (idx[j] === 9) cinzas[c]++;
        cx[0] = Math.min(cx[0], x); cx[1] = Math.min(cx[1], y); cx[2] = Math.max(cx[2], x); cx[3] = Math.max(cx[3], y);
        for (const n of viz(j)) if (JOQUEI(idx[n]) && comp[n] < 0) { comp[n] = c; pilha.push(n); }
      }
    }
    if (tamanhos.length) {
      const maior = tamanhos.indexOf(Math.max(...tamanhos)); // empate: o primeiro na ordem de varredura
      const [mx0, my0, mx1, my1] = caixas[maior];
      const embaixo = c => { const [x0, y0, x1, y1] = caixas[c]; return x1 >= mx0 - 2 && x0 <= mx1 + 2 && y0 <= my1 + 8 && y1 >= my0; };
      const fica = tamanhos.map((_, c) => c === maior);
      for (let mudou = true; mudou;) { // cadeia: recalcula a distância aos que ficam até estabilizar
        mudou = false;
        const dist = new Int8Array(w * h).fill(-1); // Chebyshev (BFS em 8-vizinhança), até 4 px
        let fila = [];
        for (let i = 0; i < w * h; i++) if (comp[i] >= 0 && fica[comp[i]]) { dist[i] = 0; fila.push(i); }
        for (let d = 1; d <= 4 && fila.length; d++) {
          const prox = [];
          for (const i of fila) for (const n of viz(i)) if (dist[n] < 0) { dist[n] = d; prox.push(n); }
          fila = prox;
        }
        const perto = new Array(tamanhos.length).fill(99);
        for (let i = 0; i < w * h; i++) if (comp[i] >= 0 && dist[i] >= 0) perto[comp[i]] = Math.min(perto[comp[i]], dist[i]);
        perto.forEach((d, c) => {
          if (fica[c] || !(d <= 2 || (cinzas[c] * 2 > tamanhos[c] && (d <= 4 || embaixo(c))))) return;
          fica[c] = true; mudou = true;
        });
      }
      for (let i = 0; i < w * h; i++) if (comp[i] >= 0 && !fica[comp[i]]) pendente[i] = 1;
    }
  }
  let fila = [];
  for (let i = 0; i < w * h; i++) if (pendente[i]) fila.push(i);
  const remapeados = fila.length;
  while (fila.length) {
    const decididos = [];
    for (const i of fila) {
      const cont = [0, 0, 0, 0, 0, 0, 0];
      for (const n of viz(i)) if (!pendente[n] && out[n] >= 1 && out[n] <= 6) cont[out[n]]++;
      const max = Math.max(...cont);
      if (max) decididos.push([i, ORDEM_DESEMPATE.find(p => cont[p] === max)]);
    }
    if (!decididos.length) { for (const i of fila) { out[i] = 1; pendente[i] = 0; } break; }
    for (const [i, p] of decididos) { out[i] = p; pendente[i] = 0; } // atualização simultânea por passada
    fila = fila.filter(i => pendente[i]);
  }
  return { idx: out, remapeados };
}

/**
 * Limiar de Otsu de uma lista de valores 0–255: devolve t que maximiza a variância entre as classes
 * (≤ t e > t), ou -1 se todos os valores forem iguais.
 * @param {ArrayLike<number>} valores
 */
export function limiarOtsu(valores) {
  const hist = new Array(256).fill(0);
  let soma = 0, n = 0;
  for (const v of valores) { const k = Math.max(0, Math.min(255, Math.round(v))); hist[k]++; soma += k; n++; }
  let melhor = -1, t = -1, w0 = 0, s0 = 0;
  for (let k = 0; k < 255; k++) {
    w0 += hist[k]; s0 += k * hist[k];
    const w1 = n - w0;
    if (!w0 || !w1) continue;
    const d = s0 / w0 - (soma - s0) / w1, v = w0 * w1 * d * d;
    if (v > melhor) { melhor = v; t = k; }
  }
  return t;
}

/**
 * Classifica uma imagem de cores livres em famílias de papel (HSV), sem separar claro de sombra, nesta
 * ordem: contorno = V < 60; rosa/pêssego claro (matiz ≥ 335° ou < 40°, 0.15 ≤ S < 0.5, V ≥ 170) ⇒ 8;
 * cinza (S < 0.3) ⇒ 9; vermelho (≥ 330° ou < 25°) ⇒ 2 (pelagem); amarelo (38–72°) ⇒ 7; verde a ciano
 * (72–190°) ⇒ 4 (crina); azul (190–265°) ⇒ 6; magenta/roxo (265–330°) ⇒ 7 (o modelo sombreia a seda amarela
 * puxando para o magenta; longe do jóquei, limparJoquei remapeia). Laranja (25–38°) vai para a família de
 * centro mais próximo (0°, 55°, 120°, 225°) e conta em `aproximados`. Alfa < 128 ⇒ 0. `lum` é a luminância
 * (0,299 R + 0,587 G + 0,114 B) de cada pixel. `magenta` marca os pixels que viraram seda pela faixa magenta:
 * os que a limpeza tirar do jóquei contam como aproximados em posProcessar(). `cor` é o RGB de cada pixel opaco
 * (0xRRGGBB), para as correções que decidem por cor no grupo de quadros (corrigirGrupo).
 * @returns {{ idx: Uint8Array, lum: Float32Array, magenta: Uint8Array, cor: Uint32Array, aproximados: number, opacos: number, w: number, h: number }}
 */
export function classificarFamilias(rgba, w, h) {
  const idx = new Uint8Array(w * h), lum = new Float32Array(w * h), magenta = new Uint8Array(w * h), cor = new Uint32Array(w * h);
  const CENTROS = [[0, 2], [55, 7], [120, 4], [225, 6]];
  const distMatiz = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  let aproximados = 0, opacos = 0;
  for (let i = 0; i < w * h; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    opacos++;
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b), c = max - min, s = max ? c / max : 0;
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b; cor[i] = (r << 16) | (g << 8) | b;
    let hue = 0;
    if (c) hue = max === r ? 60 * (((g - b) / c) % 6) : max === g ? 60 * ((b - r) / c + 2) : 60 * ((r - g) / c + 4);
    if (hue < 0) hue += 360;
    let p;
    if (max < 60) p = 1;
    else if ((hue >= 335 || hue < 40) && s >= 0.15 && s < 0.5 && max >= 170) p = 8; // antes do cinza: a pele é pouco saturada
    else if (s < 0.3) p = 9; // a sela pode vir levemente tingida (ex.: #85789d, S 0.24)
    else if (hue >= 330 || hue < 25) p = 2;
    else if (hue >= 38 && hue < 72) p = 7;
    else if (hue >= 72 && hue < 190) p = 4; // inclui o turquesa/ciano: crina pedida verde às vezes sai assim
    else if (hue >= 190 && hue < 265) p = 6;
    else if (hue >= 265 && hue < 330) { p = 7; magenta[i] = 1; } // sombra da seda amarela (hue shift do pixel art)
    else {
      aproximados++;
      p = CENTROS.reduce((m, cc) => (distMatiz(hue, cc[0]) < distMatiz(hue, m[0]) ? cc : m))[1];
    }
    idx[i] = p;
  }
  return { idx, lum, magenta, cor, aproximados, opacos, w, h };
}

// Candidata a sombra da pelagem em sombraMagenta(): magenta escura (maior canal < 128), muito saturada (S ≥ 0,75) e do
// lado vermelho da faixa (matiz ≥ 300°). As sombras de pelagem medidas nos crus dos portes ficam em 314–330°, S 0,82–0,99
// e maior canal 60–118; as cores roxas escuras (crina, linhas e calça do jóquei, 270–299°) e as pouco saturadas
// (linhas acinzentadas) ficam de fora.
export const MAGENTA_ESCURO = 128, MAGENTA_SAT = 0.75, MAGENTA_MATIZ = 300;
function sombraDaPelagem(c) {
  const r = c >> 16, g = (c >> 8) & 255, b = c & 255, max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!max || max >= MAGENTA_ESCURO || d / max < MAGENTA_SAT || max !== r) return false;
  let hue = 60 * (((g - b) / d) % 6);
  if (hue < 0) hue += 360;
  return hue >= MAGENTA_MATIZ;
}

/**
 * Sombra da pelagem que caiu na faixa magenta (tarefa 6a dos portes, 2026-11-13). O pixel art escurece a pelagem
 * puxando o matiz para o roxo: numa pelagem carmim ou castanho-arroxeada, as sombras (#3c0229, #450336, #76013c…)
 * caem em 314–330°, a faixa que classificarFamilias() dá à sombra da seda. Encostadas no jóquei (que monta no
 * cavalo), elas entravam no componente dele e o limparJoquei as mantinha como seda: o corpo saía com listras da cor
 * da seda.
 * Decide por COR (o RGB exato), com os quadros do grupo juntos (o galope não pisca): uma cor magenta escura, muito
 * saturada e do lado vermelho da faixa (sombraDaPelagem: MAGENTA_ESCURO, MAGENTA_SAT, MAGENTA_MATIZ; a seda e a
 * sela magenta são claras, a crina e as linhas roxas ficam abaixo de 300°) cujos pixels encostam (8-vizinhança,
 * somada no grupo) mais na pelagem (família 2) do que no jóquei (7/8/9 fora da faixa magenta e as magenta que não
 * são candidatas) vira pelagem (2), sem a marca de magenta: entra no Otsu da pelagem e no claro × sombra como
 * qualquer pixel dela. Em cadeia: a cor que virou pelagem conta como pelagem para as outras, até estabilizar (só
 * cresce, então a ordem não importa). Uma candidata que encosta mais no jóquei (a sombra da seda rosa do jóquei)
 * continua seda, como antes. Vale para todos os pixels da cor, mesmo os que não encostam na pelagem: a sombra sob a
 * sela fica cercada de contorno e de sela, e ligada à pelagem por ela voltava a ser seda (testado; o preço é um pixel
 * solto da cor na cauda virar pelagem, como no galope 2 do robusto-ondas). Os 4 moldes antigos não têm candidata:
 * saem iguais. Pura (devolve cópias).
 * @param {Array<ReturnType<typeof classificarFamilias>>} fams os quadros de um grupo (retrato, parado ou o galope)
 * @returns {{ fams: Array<ReturnType<typeof classificarFamilias>>, cores: number[], pixels: number }} os quadros
 *          corrigidos, as cores que viraram pelagem (0xRRGGBB, em ordem) e quantos pixels mudaram
 */
export function sombraMagenta(fams) {
  const escuro = (f, i) => f.magenta[i] && sombraDaPelagem(f.cor[i]);
  const candidatas = new Set();
  for (const f of fams) for (let i = 0; i < f.idx.length; i++) if (escuro(f, i)) candidatas.add(f.cor[i]);
  const pelagem = new Set();
  // contatos de cada candidata com o jóquei (fixos) e com a pelagem (crescem com as cores que viram pelagem)
  const contar = () => {
    const pel = new Map(), joq = new Map();
    for (const f of fams) {
      const { w, h } = f;
      for (let i = 0; i < f.idx.length; i++) {
        if (!escuro(f, i) || pelagem.has(f.cor[i])) continue;
        const x = i % w, y = (i / w) | 0, c = f.cor[i];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx, v = f.idx[j];
          if (!v || f.cor[j] === c) continue;
          if (v === 2 || (f.magenta[j] && pelagem.has(f.cor[j]))) pel.set(c, (pel.get(c) || 0) + 1);
          else if (JOQUEI(v) && (!f.magenta[j] || !candidatas.has(f.cor[j]))) joq.set(c, (joq.get(c) || 0) + 1);
        }
      }
    }
    return { pel, joq };
  };
  for (let mudou = true; mudou;) {
    mudou = false;
    const { pel, joq } = contar();
    for (const c of [...candidatas].sort((a, b) => a - b)) {
      if (pelagem.has(c) || !((pel.get(c) || 0) > (joq.get(c) || 0))) continue;
      pelagem.add(c); mudou = true;
    }
  }
  let pixels = 0;
  const saida = fams.map(f => {
    if (!pelagem.size) return f;
    const idx = Uint8Array.from(f.idx), magenta = Uint8Array.from(f.magenta);
    for (let i = 0; i < idx.length; i++) if (magenta[i] && pelagem.has(f.cor[i])) { idx[i] = 2; magenta[i] = 0; pixels++; }
    return { ...f, idx, magenta };
  });
  return { fams: saida, cores: [...pelagem].sort((a, b) => a - b), pixels };
}

// ---------------------------------------------------------------- cru de cores naturais (tarefa 6a dos portes)
// Às vezes o PixelLab ignora as cores de papel pedidas por texto e desenha um cavalo de cores naturais: pelagem
// castanha, crina e cauda pretas ou azul-marinho, jóquei de seda rosa, carmim ou laranja. Foi o que aconteceu com o
// robusto guiado pelo padrão com força 35 (2026-11-13) e, por herança do init_image, com as versões dele: em todo
// parado, pose de corrida e galope do robusto nenhum pixel caiu na família da crina (o retrato saiu com a crina
// verde pedida). Nesse caso — grupo sem NENHUM pixel da família crina, o "modo natural" — a crina é procurada pela
// forma (crinaEscura) e a seda que caiu na família da pelagem, pela cor (sedaNaPelagem). Grupo com crina pedida
// (os 4 moldes antigos e os portes que seguiram as cores) não passa por aqui.

// Vizinhos (8) de i num quadro w × h.
function vizinhos8(i, w, h) {
  const x = i % w, y = (i / w) | 0, r = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((dx || dy) && x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h) r.push(i + dy * w + dx);
  }
  return r;
}
// Componentes 8-conexos dos pixels com dentro(i) verdadeiro: lista de listas de índices, na ordem de varredura.
function componentes8(n, w, h, dentro) {
  const visto = new Uint8Array(n), lista = [];
  for (let i = 0; i < n; i++) {
    if (visto[i] || !dentro(i)) continue;
    const pilha = [i], m = [];
    visto[i] = 1;
    while (pilha.length) {
      const j = pilha.pop();
      m.push(j);
      for (const k of vizinhos8(j, w, h)) if (!visto[k] && dentro(k)) { visto[k] = 1; pilha.push(k); }
    }
    lista.push(m);
  }
  return lista;
}

/** Grupo no modo natural: nenhum pixel da família crina (4) em nenhum quadro. */
export function modoNatural(fams) {
  return fams.length > 0 && fams.every(f => !f.idx.includes(4));
}

/**
 * Seda do jóquei que caiu na família da pelagem (modo natural, com jóquei). A seda carmim ou rosa do jóquei
 * (#90274c, #ec578e…, matiz 336–345°) cai na família vermelha, como a pelagem castanha (352–357°): o tronco do
 * jóquei saía da cor da pelagem e, sem ele, o capacete e o rosto ficavam soltos e a limpeza os apagava (jóquei
 * escuro). A cor separa os dois: as cores da pelagem são as do maior componente 8-conexo de pixels da família 2 de
 * cada quadro, mais as dos componentes em que elas são maioria (em cadeia, até estabilizar); uma cor da família 2
 * que fica de fora (só aparece em componentes à parte, como o tronco do jóquei) vira seda (7) se algum pixel dela
 * encosta no jóquei (7/8/9) ou, em cadeia, numa cor que já virou seda. Ela entra no jóquei pela limpeza de sempre
 * (limparJoquei): longe dele, volta para o vizinho mais comum. Pura (devolve cópias).
 * @param {Array<ReturnType<typeof classificarFamilias>>} fams
 * @returns {{ fams: Array<ReturnType<typeof classificarFamilias>>, cores: number[], pixels: number }}
 */
export function sedaNaPelagem(fams) {
  const comps = fams.map(f => componentes8(f.idx.length, f.w, f.h, i => f.idx[i] === 2));
  const pelagem = new Set();
  fams.forEach((f, k) => {
    const maior = comps[k].reduce((a, b) => (b.length > a.length ? b : a), []);
    for (const j of maior) pelagem.add(f.cor[j]);
  });
  for (let mudou = true; mudou;) {
    mudou = false;
    fams.forEach((f, k) => comps[k].forEach(m => {
      if (m.filter(j => pelagem.has(f.cor[j])).length * 2 <= m.length) return;
      for (const j of m) if (!pelagem.has(f.cor[j])) { pelagem.add(f.cor[j]); mudou = true; }
    }));
  }
  // em cadeia: a cor de fora que encosta no jóquei ou numa cor que já virou seda (o brilho do tronco só encosta na
  // sombra dele)
  const seda = new Set();
  for (let mudou = true; mudou;) {
    mudou = false;
    for (const f of fams) for (let i = 0; i < f.idx.length; i++) {
      if (f.idx[i] !== 2 || pelagem.has(f.cor[i]) || seda.has(f.cor[i])) continue;
      if (vizinhos8(i, f.w, f.h).some(j => JOQUEI(f.idx[j]) || (f.idx[j] === 2 && seda.has(f.cor[j])))) { seda.add(f.cor[i]); mudou = true; }
    }
  }
  let pixels = 0;
  const saida = fams.map(f => {
    if (!seda.size) return f;
    const idx = Uint8Array.from(f.idx);
    for (let i = 0; i < idx.length; i++) if (idx[i] === 2 && seda.has(f.cor[i])) { idx[i] = 7; pixels++; }
    return { ...f, idx };
  });
  return { fams: saida, cores: [...seda].sort((a, b) => a - b), pixels };
}

// crinaEscura(): luminância abaixo da qual um pixel (fora da pelagem e da pele) conta como escuro; pixels mínimos de
// uma mecha; fração da altura da pelagem (de cima) até onde a mecha tem de começar.
export const CRINA_ESCURA = Object.freeze({ lum: 80, minimo: 6, topo: 0.5 });
/**
 * Crina e cauda escuras pela forma (modo natural, um quadro por vez). No cru natural a crina e a cauda são pretas ou
 * azul-marinho — às vezes da mesma cor do contorno (robusto-folhas parado, robusto-chamas corrida) —, então a cor
 * não basta: o contorno é uma linha fina, e a crina e a cauda são manchas escuras GROSSAS presas no alto do cavalo.
 * 1. Escuros: pixels opacos com luminância < CRINA_ESCURA.lum que não são pelagem (2/3) nem pele (8).
 * 2. Grossos: os escuros que fazem parte de um bloco 2 × 2 todo escuro (a abertura morfológica 2 × 2). A linha de
 *    contorno de 1 px some; a mecha de 2 px da crina esticada no galope fica (com 3 × 3 ela sumia em quase todo
 *    quadro e a cor da crina piscava).
 * 3. Com jóquei, tira dos grossos a caixa do jóquei (a dos pixels de seda e pele, 7/8, que a limparJoquei mantém,
 *    + 1 px; sem o cinza, porque a rédea vai até a boca do cavalo e a caixa cobriria a crina): as botas pretas entre a
 *    seda e a sela e o capacete escuro não são crina (a base da crina que cai dentro dela fica como estava).
 * 4. Cada componente 8-conexo do que sobrou, com ≥ CRINA_ESCURA.minimo pixels, vira crina se começa (pixel mais alto)
 *    na metade de cima da pelagem (CRINA_ESCURA.topo: a crina nasce nas orelhas e a cauda na garupa; as patas escuras
 *    e as pernas do outro lado, sombreadas, começam abaixo da barriga).
 * 5. Fica como contorno a borda da mancha: o pixel que encosta (4-vizinhança) no fundo transparente.
 * evitar = cores que outra correção já decidiu (a seda de sedaNaPelagem: a sombra do tronco do jóquei é escura).
 * A crina marcada entra na família 4 (claro × sombra pelo Otsu do grupo, ou o sombreado procedural). Mecha de 1 px
 * não é achada e fica como estava (contorno ou detalhe). Pura.
 * @param {ReturnType<typeof classificarFamilias>} f
 * @param {{ evitar?: Set<number>, comJoquei?: boolean }} opts
 * @returns {{ fam: ReturnType<typeof classificarFamilias>, pixels: number }}
 */
export function crinaEscura(f, { evitar = new Set(), comJoquei = false } = {}) {
  const { w, h, idx, lum } = f, n = w * h;
  const escuro = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (idx[i] && idx[i] !== 2 && idx[i] !== 3 && idx[i] !== 8 && lum[i] < CRINA_ESCURA.lum && !evitar.has(f.cor[i])) escuro[i] = 1;
  const grosso = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % w, y = (i / w) | 0;
    if (x < w - 1 && y < h - 1 && escuro[i] && escuro[i + 1] && escuro[i + w] && escuro[i + w + 1]) grosso[i] = grosso[i + 1] = grosso[i + w] = grosso[i + w + 1] = 1;
  }
  // altura da pelagem e caixa do jóquei
  let y0 = h, y1 = -1;
  for (let i = 0; i < n; i++) if (idx[i] === 2 || idx[i] === 3) { const y = (i / w) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (y1 < 0) return { fam: f, pixels: 0 };
  const yTopo = y0 + CRINA_ESCURA.topo * (y1 - y0 + 1);
  let cx0 = w, cy0 = h, cx1 = -1, cy1 = -1;
  if (comJoquei) {
    const lj = limparJoquei(idx, w, h, { comJoquei: true }).idx;
    for (let j = 0; j < n; j++) {
      if (!(idx[j] === 7 || idx[j] === 8) || !JOQUEI(lj[j])) continue;
      const x = j % w, y = (j / w) | 0;
      cx0 = Math.min(cx0, x - 1); cy0 = Math.min(cy0, y - 1); cx1 = Math.max(cx1, x + 1); cy1 = Math.max(cy1, y + 1);
    }
  }
  const naCaixa = j => { const x = j % w, y = (j / w) | 0; return x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1; };
  const borda = j => {
    const x = j % w, y = (j / w) | 0;
    return x === 0 || y === 0 || x === w - 1 || y === h - 1 || !idx[j - 1] || !idx[j + 1] || !idx[j - w] || !idx[j + w];
  };
  const out = Uint8Array.from(idx), magenta = Uint8Array.from(f.magenta);
  let pixels = 0;
  for (const m of componentes8(n, w, h, i => grosso[i] && !naCaixa(i))) {
    if (m.length < CRINA_ESCURA.minimo) continue;
    const topo = Math.min(...m.map(j => (j / w) | 0));
    if (topo >= yTopo) continue;
    // a crina roxa escura caiu na faixa magenta: deixa de ser "magenta tirado do jóquei" (não conta como aproximado)
    for (const j of m) if (!borda(j)) { out[j] = 4; magenta[j] = 0; pixels++; }
  }
  return { fam: pixels ? { ...f, idx: out, magenta } : f, pixels };
}

/**
 * As correções que olham o grupo de quadros inteiro (retrato, parado ou o galope), entre classificarFamilias() e
 * limiaresDeTons(): a sombra da pelagem na faixa magenta (sombraMagenta, sempre) e, no modo natural (grupo sem
 * família crina), a seda que caiu na pelagem (sedaNaPelagem, só com jóquei) e a crina escura pela forma
 * (crinaEscura, quadro a quadro). Pura.
 * @param {Array<ReturnType<typeof classificarFamilias>>} fams
 * @param {{ comJoquei?: boolean }} opts
 * @returns {{ fams: Array<ReturnType<typeof classificarFamilias>>, sombraMagenta: { cores: number[], pixels: number },
 *   natural: boolean, seda: { cores: number[], pixels: number }, crina: number[] }} crina = pixels marcados por quadro
 */
export function corrigirGrupo(fams, { comJoquei = false } = {}) {
  const sm = sombraMagenta(fams);
  let saida = sm.fams, seda = { cores: [], pixels: 0 }, crina = saida.map(() => 0);
  const natural = modoNatural(saida);
  if (natural) {
    if (comJoquei) { const s = sedaNaPelagem(saida); saida = s.fams; seda = { cores: s.cores, pixels: s.pixels }; }
    const evitar = new Set(seda.cores), ce = saida.map(f => crinaEscura(f, { evitar, comJoquei }));
    saida = ce.map(c => c.fam); crina = ce.map(c => c.pixels);
  }
  return { fams: saida, sombraMagenta: { cores: sm.cores, pixels: sm.pixels }, natural, seda, crina };
}

/**
 * Limiares de claro × sombra de um grupo de quadros (ex.: os do galope), com os pixels de pelagem e de
 * crina de todos eles juntos, para os tons não piscarem entre quadros.
 * Para cada família: limiar de Otsu da luminância (pixel com lum ≤ limiar é sombra). Se um dos lados ficar
 * com menos de 10% da família (ou não houver contraste), `procedural` = true: a família inteira vira o tom
 * claro e recebe o sombreado procedural.
 * @param {Array<{ idx: Uint8Array, lum: Float32Array }>} quadros saídas de classificarFamilias()
 * @returns {{ pelagem: { limiar: number, procedural: boolean }, crina: { limiar: number, procedural: boolean } }}
 */
export function limiaresDeTons(quadros) {
  const res = {};
  for (const [nome, claro] of Object.entries(FAMILIAS)) {
    const valores = [];
    for (const q of quadros) for (let i = 0; i < q.idx.length; i++) if (q.idx[i] === claro) valores.push(q.lum[i]);
    const limiar = limiarOtsu(valores);
    const sombra = valores.filter(v => Math.round(v) <= limiar).length;
    const menor = Math.min(sombra, valores.length - sombra);
    res[nome] = { limiar, procedural: !valores.length || menor / valores.length < 0.1 };
  }
  return res;
}

/**
 * Contorno procedural: todo pixel transparente com vizinho (4-vizinhança) opaco que não seja contorno vira
 * contorno (1). Fecha as falhas de contorno sem engrossar onde ele já existe — o animate-with-text-v3 e às
 * vezes o pixflux devolvem a silhueta sem a borda preta pedida. Pura.
 * @returns {{ idx: Uint8Array, adicionados: number }}
 */
export function contornar(idx, w, h) {
  const out = Uint8Array.from(idx);
  let adicionados = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (idx[i]) continue;
    const borda = (x > 0 && idx[i - 1] > 1) || (x < w - 1 && idx[i + 1] > 1) || (y > 0 && idx[i - w] > 1) || (y < h - 1 && idx[i + w] > 1);
    if (borda) { out[i] = 1; adicionados++; }
  }
  return { idx: out, adicionados };
}

/**
 * Quadro classificado → papéis finais: separa claro/sombra com os limiares do grupo, limpa os papéis do
 * jóquei (limparJoquei), sombreia por procedimento as famílias marcadas como `procedural` e, só com
 * `contorno: true` (montado e galope, que o animate devolve sem borda), fecha o contorno (contornar). No
 * retrato e no parado o contorno fica como veio, para o validar() continuar pegando silhueta aberta.
 * `aproximados` = os da classificação + magenta que a limpeza tirou do jóquei (virou papel de cavalo).
 * Devolve o formato de normalizar() (serve para validar()) e as contagens das etapas.
 * @param {{ idx: Uint8Array, lum: Float32Array, magenta?: Uint8Array, aproximados: number, opacos: number, w: number, h: number }} fam
 * @param {ReturnType<typeof limiaresDeTons>} tons
 * @param {{ comJoquei?: boolean, contorno?: boolean }} opts
 */
export function posProcessar(fam, tons, { comJoquei = false, contorno = false } = {}) {
  const { w, h } = fam, idx = Uint8Array.from(fam.idx);
  for (const [nome, claro] of Object.entries(FAMILIAS)) {
    const t = tons[nome];
    for (let i = 0; i < idx.length; i++) if (idx[i] === claro && !t.procedural && Math.round(fam.lum[i]) <= t.limiar) idx[i] = claro + 1;
  }
  const lj = limparJoquei(idx, w, h, { comJoquei });
  const regioes = Object.entries(FAMILIAS).filter(([nome]) => tons[nome].procedural).map(([, claro]) => claro);
  const s = regioes.length ? sombrearRegioes(lj.idx, w, h, { regioes }) : { idx: lj.idx, alterados: 0 };
  const c = contorno ? contornar(s.idx, w, h) : { idx: s.idx, adicionados: 0 };
  let aproximados = fam.aproximados;
  if (fam.magenta) for (let i = 0; i < idx.length; i++) if (fam.magenta[i] && !JOQUEI(lj.idx[i])) aproximados++;
  const papeis = new Set();
  for (const v of c.idx) if (v) papeis.add(v);
  return { idx: c.idx, papeis, aproximados, opacos: fam.opacos, w, h, remapeados: lj.remapeados, sombreados: s.alterados, contornados: c.adicionados };
}
