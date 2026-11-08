// prototype/tools/moldes-lib.mjs — normalização e validação dos moldes de cavalo (spec §3.1–§3.2).
// Um "molde" é uma imagem 64×64 em que cada pixel carrega um PAPEL (0–9), não uma cor final.
import { encodePng } from './png.mjs';

// Índice = papel. 0 = transparente. Cores exatas que se pede ao PixelLab (paleta forçada).
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
