// prototype/tools/portes-criterios.mjs — critérios automáticos de aceite dos moldes dos portes (spec
// 2026-11-13-cavalos-portes §4 e §5). Módulo puro: sem rede e sem arquivo; lê índices de papel (0–9, os de
// moldes-lib.mjs) e âncoras (as de ancoras(), as mesmas do JSON do molde) e devolve números e listas.
//
// Molde (o que os critérios recebem): { w, h, retrato: idx, parado: idx, galope: [idx × 9], ancoras: { retrato,
// parado, 'galope-0'…'galope-8', corrida? }, larguraUtil, corrida?: idx }. Estado ausente fica de fora (o
// pixellab-moldes confere cada etapa sozinha); âncora ausente é calculada do quadro. A pose de corrida é
// `corrida` quando vem; senão o quadro 0 do galope, que o animate-with-text-v3 devolve igual ao first_frame.
//
// CORPO (spec §4, "só os papéis 1 a 3"): a pelagem (2 e 3) e o contorno (1) que encosta nela (8-vizinhança). O
// contorno que só toca crina, cauda, jóquei, sela ou casco fica de fora — senão a borda preta da cauda e da crina
// entraria no comprimento e na altura. Orelhas são pelagem, então contam.
//   altura      = footY − (linha do pixel de corpo mais alto) + 1. footY = o da âncora (a linha dos cascos, onde o
//                 jogo apoia o cavalo);
//   comprimento = largura do corpo acima da linha da barriga (footY − 0,30 × altura, a fração do Marcas): do
//                 pixel de corpo mais à esquerda ao mais à direita nessas linhas. É o larguraUtil da spec sem a cauda,
//                 a crina e as pernas — no galope as patas passam da garupa e do peito e mudariam a medida a cada
//                 passada (5 a 7 px nos moldes de hoje), sem o corpo mudar;
//   nose        = o pixel de corpo mais à direita na metade de cima do corpo, empate ⇒ o mais alto (a regra de
//                 ancoras(), só com o corpo: uma crina maior não mexe nele);
//   espessura   = do lombo à barriga numa coluna: a da sela (âncora saddle) ou, sem sela (retrato), a do meio do
//                 bbox da âncora — a mesma referência que o Marcas.zonas usa para separar as pernas de trás das da
//                 frente; com as 4 pernas achadas, ela cai entre elas, no barril (o meio do corpo sem a cauda cai na
//                 base do pescoço no retrato de ondas). Lombo = o pixel mais alto da coluna que é corpo ou sela (a sela
//                 fica sobre o lombo e o esconde); barriga = o último pixel de corpo descendo dali. A descida
//                 atravessa crina, jóquei e casco (a crina de folhas cai sobre o lombo) e vãos de até 2 px vazios (a
//                 aba da sela e a perna do jóquei deixam um vão no galope de ondas); para no 3º vazio seguido e, abaixo
//                 da linha da barriga, numa linha estreita (menos de 40 % do comprimento: é perna). Também devolve
//                 `lombo` (y) e `coluna`, para o galope.
// Cada critério é { criterio, ok, valor, limite } (valor numérico, ou null quando não dá para medir; limite em
// texto, para a folha e o criterios.json).
import { createRequire } from 'node:module';
import { ancoras } from './moldes-lib.mjs';

// marcas.js é UMD: no Node ele mesmo faz require do data.js e do sim.js (como no moldes-test)
const Marcas = createRequire(import.meta.url)('../src/marcas.js');

export const LIMITES = Object.freeze({
  pernas: 4,            // retrato e parado: exatamente 4 pernas achadas pelo Marcas.zonas
  // galope (e a pose de corrida, que vira o quadro 0 dele): pelo menos 2 em todo quadro. Na vista de lado as pernas se
  // cruzam no galope; os galopes dos mestres pareciam bons na folha e reprovavam só pela regra antiga (≥ 3 em todo
  // quadro e 4 em pelo menos 5 dos 9). Decidido pelo Vinicius em 2026-11-13.
  galopeMin: 2,
  mesmoCorpo: 2,        // |Δ| máximo, em px, de cada versão para o mestre (footY, nose, altura, comprimento)
  esguioAltura: 1.10,   // (altura/comprimento do esguio) ÷ (a do padrão) ≥ 1,10
  robustoAltura: 0.92,  // (altura/comprimento do robusto) ÷ (a do padrão) ≤ 0,92
  robustoEspessura: 1.15, // (espessura/comprimento do robusto) ÷ (a do padrão) ≥ 1,15
  quadros: 9,           // galope: exatamente 9 quadros (galope-0…8; o molde conta com eles)
  lombo: 3,             // galope: o lombo na coluna da sela varia no máximo 3 px
  nose: 6,              // galope: nose.x a ±6 px do da pose de corrida (o critério do primeiro lote)
  comprimento: 4,       // galope: o comprimento varia no máximo 4 px
});

const num = v => String(v).replace('.', ',');
const arred = v => Math.round(v * 1000) / 1000;
const pelagem = v => v === 2 || v === 3;
const BARRIGA = 0.30; // linha da barriga = footY − 0,30 × altura (a mesma fração do Marcas.LIMITES.barriga)
const VAO_MAX = 2;    // vazios seguidos que a descida do lombo à barriga atravessa
const ESTREITA = 0.4; // abaixo da linha da barriga, linha mais estreita que 40 % do comprimento é perna

/** Máscara do corpo: pelagem e o contorno que encosta nela (8-vizinhança). */
export function mascaraCorpo(idx, w, h) {
  const corpo = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, v = idx[i];
    if (pelagem(v)) { corpo[i] = 1; continue; }
    if (v !== 1) continue;
    for (let dy = -1; dy <= 1 && !corpo[i]; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if ((dx || dy) && xx >= 0 && yy >= 0 && xx < w && yy < h && pelagem(idx[yy * w + xx])) { corpo[i] = 1; break; }
    }
  }
  return corpo;
}

/**
 * Medidas do corpo de um quadro (spec §4).
 * @returns {{ altura: number, comprimento: number, espessura: number, footY: number, nose: [number, number]|null,
 *            lombo: number|null, coluna: number|null, topo: number|null }}
 */
export function medidas(idx, w, h, ancora) {
  const a = ancora || ancoras(idx, w, h), corpo = mascaraCorpo(idx, w, h);
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!corpo[y * w + x]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { altura: 0, comprimento: 0, espessura: 0, footY: a.footY, nose: null, lombo: null, coluna: null, topo: null };
  const altura = a.footY - y0 + 1, linha = a.footY - BARRIGA * altura, yMeio = y0 + Math.floor((y1 - y0 + 1) / 2);
  let c0 = w, c1 = -1;
  for (let y = y0; y <= linha; y++) for (let x = 0; x < w; x++) if (corpo[y * w + x]) { if (x < c0) c0 = x; if (x > c1) c1 = x; }
  const comprimento = c1 < 0 ? 0 : c1 - c0 + 1;
  let nose = null;
  for (let y = y0; y <= yMeio; y++) for (let x = x0; x <= x1; x++) if (corpo[y * w + x] && (!nose || x > nose[0])) nose = [x, y];
  const coluna = a.saddle ? a.saddle[0] : Math.floor(a.bbox.x + a.bbox.w / 2);
  // largura da corrida de pixels opacos (qualquer papel) da linha y que passa pela coluna
  const largura = y => { let e = coluna, d = coluna; while (e > 0 && idx[y * w + e - 1]) e--; while (d < w - 1 && idx[y * w + d + 1]) d++; return d - e + 1; };
  let lombo = null, barriga = null;
  for (let y = 0; y < h && lombo == null; y++) { const i = y * w + coluna; if (corpo[i] || idx[i] === 9) lombo = y; }
  if (lombo != null) {
    for (let y = lombo, vao = 0; y < h; y++) {
      if (!idx[y * w + coluna]) { if (++vao > VAO_MAX) break; continue; }
      vao = 0;
      if (y > linha && largura(y) < ESTREITA * comprimento) break;
      if (corpo[y * w + coluna]) barriga = y;
    }
  }
  return {
    altura, comprimento, espessura: barriga == null ? 0 : barriga - lombo + 1,
    footY: a.footY, nose, lombo, coluna, topo: y0,
  };
}

/** Número de pernas distintas que o Marcas.zonas acha no quadro (0 a 4). */
export function pernas(idx, w, h, ancora) {
  const { perna } = Marcas.zonas(idx, w, h, ancora || ancoras(idx, w, h));
  const achadas = new Set();
  for (let i = 0; i < perna.length; i++) if (perna[i] >= 0) achadas.add(perna[i]);
  return achadas.size;
}

const ancoraDe = (m, nome, idx) => (m.ancoras && m.ancoras[nome]) || ancoras(idx, m.w, m.h);
const galopeDe = m => (m.galope || []).map((idx, i) => ({ idx, a: ancoraDe(m, 'galope-' + i, idx) }));

/** Pernas: retrato = 4 e parado = 4; no galope, ≥ 2 em todo quadro. */
export function criterioPernas(molde) {
  const out = [];
  for (const estado of ['retrato', 'parado']) {
    if (!molde[estado]) continue;
    const n = pernas(molde[estado], molde.w, molde.h, ancoraDe(molde, estado, molde[estado]));
    out.push({ criterio: `pernas no ${estado}`, ok: n === LIMITES.pernas, valor: n, limite: `= ${LIMITES.pernas}` });
  }
  const g = galopeDe(molde);
  if (g.length) {
    const ns = g.map(q => pernas(q.idx, molde.w, molde.h, q.a)), min = Math.min(...ns);
    out.push({ criterio: 'pernas no galope (todo quadro)', ok: min >= LIMITES.galopeMin, valor: min, limite: `≥ ${LIMITES.galopeMin}`, quadros: ns });
  }
  return out;
}

/** Mesmo corpo: no retrato e no parado, |Δ| ≤ 2 px da versão para o mestre em footY, nose.x, nose.y, altura e comprimento. */
export function criterioMesmoCorpo(versao, mestre) {
  const out = [], lim = `|Δ| ≤ ${LIMITES.mesmoCorpo} px`;
  for (const estado of ['retrato', 'parado']) {
    if (!versao[estado] || !mestre[estado]) continue;
    const v = medidas(versao[estado], versao.w, versao.h, ancoraDe(versao, estado, versao[estado]));
    const m = medidas(mestre[estado], mestre.w, mestre.h, ancoraDe(mestre, estado, mestre[estado]));
    const pares = [
      ['footY', v.footY, m.footY],
      ['nose.x', v.nose && v.nose[0], m.nose && m.nose[0]],
      ['nose.y', v.nose && v.nose[1], m.nose && m.nose[1]],
      ['altura', v.altura, m.altura],
      ['comprimento', v.comprimento, m.comprimento],
    ];
    for (const [nome, a, b] of pares) {
      const d = a == null || b == null ? null : a - b;
      out.push({ criterio: `mesmo corpo no ${estado}: ${nome}`, ok: d != null && Math.abs(d) <= LIMITES.mesmoCorpo, valor: d, limite: lim });
    }
  }
  return out;
}

/**
 * Portes distintos, nos retratos dos mestres: (altura/comprimento) do esguio ≥ 1,10 × a do padrão; a do robusto
 * ≤ 0,92 × a do padrão; (espessura/comprimento) do robusto ≥ 1,15 × a do padrão. Só entram os critérios dos portes
 * presentes; sem o padrão, cada um reprova com valor null.
 */
export function criterioPortes({ esguio, padrao, robusto } = {}) {
  const prop = m => {
    const md = medidas(m.retrato, m.w, m.h, ancoraDe(m, 'retrato', m.retrato));
    return md.comprimento ? { altura: md.altura / md.comprimento, espessura: md.espessura / md.comprimento } : null;
  };
  const ref = padrao && padrao.retrato ? prop(padrao) : null;
  const um = (m, nome, chave, cmp, lim) => {
    const p = m && m.retrato ? prop(m) : null, r = p && ref && ref[chave] ? arred(p[chave] / ref[chave]) : null;
    return {
      criterio: `portes: ${chave}/comprimento do ${nome} ÷ a do padrão`,
      ok: r != null && (cmp === '≥' ? r >= lim : r <= lim), valor: r, limite: `${cmp} ${num(lim.toFixed(2))}`,
    };
  };
  const out = [];
  if (esguio) out.push(um(esguio, 'esguio', 'altura', '≥', LIMITES.esguioAltura));
  if (robusto) {
    out.push(um(robusto, 'robusto', 'altura', '≤', LIMITES.robustoAltura));
    out.push(um(robusto, 'robusto', 'espessura', '≥', LIMITES.robustoEspessura));
  }
  return out;
}

/**
 * Galope estável: exatamente 9 quadros; nos quadros do galope, o lombo na coluna da sela varia ≤ 3 px; o nose.x (da
 * âncora) fica a ±6 px do da pose de corrida; o comprimento do corpo varia ≤ 4 px. O porte não pode mudar no meio do
 * galope. Um galope com outro número de quadros é medido do mesmo jeito, mas reprova no primeiro critério.
 */
export function criterioGalope(molde) {
  const g = galopeDe(molde);
  if (!g.length) return [];
  const ms = g.map(q => medidas(q.idx, molde.w, molde.h, q.a));
  const pose = molde.corrida ? ancoraDe(molde, 'corrida', molde.corrida) : g[0].a;
  const lombos = ms.map(m => m.lombo), comps = ms.map(m => m.comprimento);
  const varia = v => (v.some(x => x == null) ? null : Math.max(...v) - Math.min(...v));
  const nx = g.map(q => (q.a.nose ? q.a.nose[0] : null)), x0 = pose.nose ? pose.nose[0] : null;
  const deriva = x0 == null || nx.some(x => x == null) ? null : Math.max(...nx.map(x => Math.abs(x - x0)));
  const vl = varia(lombos), vc = varia(comps);
  return [
    { criterio: `galope: ${LIMITES.quadros} quadros`, ok: g.length === LIMITES.quadros, valor: g.length, limite: `= ${LIMITES.quadros}` },
    { criterio: 'galope: lombo na coluna da sela', ok: vl != null && vl <= LIMITES.lombo, valor: vl, limite: `varia ≤ ${LIMITES.lombo} px`, quadros: lombos },
    { criterio: 'galope: nose.x contra a pose de corrida', ok: deriva != null && deriva <= LIMITES.nose, valor: deriva, limite: `±${LIMITES.nose} px`, quadros: nx },
    { criterio: 'galope: comprimento do corpo', ok: vc != null && vc <= LIMITES.comprimento, valor: vc, limite: `varia ≤ ${LIMITES.comprimento} px`, quadros: comps },
  ];
}
