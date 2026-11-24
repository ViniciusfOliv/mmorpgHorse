// prototype/tools/arte-mapa-montar.mjs — monta o "mapa de peças" (exemplo pedido pelo Vinicius, 2026-11-24) sem rede:
// as peças de 16 px dos conjuntos gerados pelo arte-mapa-piloto2.mjs (lote pecas) postas por cantos (Wang), seguindo a
// geografia do mapa v1 por código (prototype/assets/arte/mapa-mundo/terreno-codigo.png), mais árvores, serras e vulcão.
// Níveis de terreno encadeados: 0 água · 1 areia · 2 grama · 3 rocha vulcânica · 4 lava; cantos vizinhos diferem no
// máximo 1 nível (o lago ganha praia sozinho). A estrada de terra é uma camada por cima da grama (conjunto grama/terra).
// Saída: prototype/assets/arte/mapa-mundo/montado.png (256 × 384, sem os ginásios: a amostra os assenta por código).
// Uso: node prototype/tools/arte-mapa-piloto2.mjs --montar
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';

const D = path.join(RAIZ, 'prototype', 'assets', 'arte', 'mapa-mundo');
const RAW = path.join(RAIZ, 'prototype', 'assets', 'arte', 'raw', 'mapa-piloto2');
const W = 256, H = 384, T = 16, CX = W / T, CY = H / T;
const NIVEL = {
  0: '323353 484a77 4d65b4 4d9be6 8fd3ff c7dcd0', 1: 'ab947a e6904e fca790 fdcbb0',
  2: '165a4c 239063 1ebc73 91db69 cddf6c 313638 374e4a 547e64 4c3e24', 3: '45293f 6e2727 7a3045 9e4539 cd683d 2e222f 3e3546 625565 966c6c 7f708a',
  4: 'fb6b1d f79617 f9c22b fbff86 ae2334 e83b3b b33831'
};
const corNivel = {}; for (const [n, l] of Object.entries(NIVEL)) for (const h of l.split(' ')) if (corNivel[h] == null) corNivel[h] = +n;
const PARES = { '0-1': 'tiles-mar-areia', '1-2': 'tiles-areia-grama', '2-3': 'tiles-grama-rocha', '3-4': 'tiles-rocha-lava' };
// as estradas do mapa v1 (GEO.estradas do mapa.js)
const ESTRADAS = [[[150, 344], [144, 326], [120, 316], [100, 310]], [[144, 326], [160, 296], [170, 264], [170, 240], [158, 216], [140, 204]], [[146, 200], [150, 176], [138, 150], [118, 128], [104, 116]]];
const SERRAS = [[40, 86], [64, 72], [92, 62], [20, 110], [120, 50], [222, 112], [238, 94], [14, 84]], VULCAO = [170, 96];

const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function conjunto(base) {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, base + '.json'), 'utf8')), mapa = {};
  for (const a of j.arquivos) {
    const i = +a.cam.split('/')[3], t = j.resposta.tileset.tiles[i], c = t.corners;
    mapa[[c.NW, c.NE, c.SW, c.SE].map(v => (v === 'upper' ? 1 : 0)).join('')] = decodePng(fs.readFileSync(path.join(D, 'pecas', a.nome)));
  }
  return mapa;
}
function cola(dst, src, x0, y0) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const s = (y * src.width + x) * 4; if (src.rgba[s + 3] < 128) continue;
    const d = (Y * W + X) * 4; dst.rgba[d] = src.rgba[s]; dst.rgba[d + 1] = src.rgba[s + 1]; dst.rgba[d + 2] = src.rgba[s + 2]; dst.rgba[d + 3] = 255;
  }
}
export function montar() {
  const ref = decodePng(fs.readFileSync(path.join(D, 'terreno-codigo.png')));
  const hex = (x, y) => { const i = (y * ref.width + x) * 4; return [0, 1, 2].map(k => ref.rgba[i + k].toString(16).padStart(2, '0')).join(''); };
  // nível de cada canto: o mais comum num quadrado de 13 px em volta
  const L = [];
  for (let j = 0; j <= CY; j++) for (let i = 0; i <= CX; i++) {
    const conta = [0, 0, 0, 0, 0];
    for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
      const x = Math.min(W - 1, Math.max(0, i * T + dx)), y = Math.min(H - 1, Math.max(0, j * T + dy)), n = corNivel[hex(x, y)];
      if (n != null) conta[n === 4 && Math.hypot(x - VULCAO[0], y - (VULCAO[1] - 30)) > 22 ? 3 : n]++;   // lava só na boca do vulcão
    }
    L.push(conta.indexOf(Math.max(...conta)));
  }
  const at = (i, j) => L[j * (CX + 1) + i];
  for (let it = 0; it < 6; it++) for (let j = 0; j <= CY; j++) for (let i = 0; i <= CX; i++) {   // vizinhos com 1 nível no máximo
    let m = 9; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii <= CX && jj <= CY) m = Math.min(m, at(ii, jj)); }
    if (at(i, j) > m + 1) L[j * (CX + 1) + i] = m + 1;
  }
  // estrada: cantos de grama a até 9 px de uma estrada
  const estrada = new Uint8Array(L.length);
  for (const pts of ESTRADAS) for (let k = 0; k < pts.length - 1; k++) for (let u = 0; u <= 1; u += 0.02) {
    const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u, y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u;
    for (let j = 0; j <= CY; j++) for (let i = 0; i <= CX; i++) if (Math.hypot(i * T - x, j * T - y) < 9 && at(i, j) === 2) estrada[j * (CX + 1) + i] = 1;
  }
  const C = Object.fromEntries(Object.values(PARES).concat(['tiles-grama-terra']).map(b => [b, conjunto(b)]));
  const cheio = n => { const op = []; for (const [k, b] of Object.entries(PARES)) { const [a, c] = k.split('-').map(Number); if (a === n) op.push(C[b]['0000']); if (c === n) op.push(C[b]['1111']); } if (n === 2) op.push(C['tiles-grama-terra']['0000']); return op.filter(Boolean); };
  const out = { width: W, height: H, rgba: new Uint8Array(W * H * 4) };
  for (let j = 0; j < CY; j++) for (let i = 0; i < CX; i++) {
    const c = [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)], a = Math.min(...c), b = Math.max(...c);
    let peca;
    if (a === b) { const op = cheio(a); peca = a === 2 ? op[Math.floor(hash(i, j) * op.length)] : op[a === 3 ? 0 : op.length - 1]; }   // a rocha dos dois conjuntos saiu diferente: uma só
    else peca = C[PARES[a + '-' + b]][c.map(v => (v === b ? 1 : 0)).join('')];
    if (peca) cola(out, peca, i * T, j * T);
    const e = [estrada[j * (CX + 1) + i], estrada[j * (CX + 1) + i + 1], estrada[(j + 1) * (CX + 1) + i], estrada[(j + 1) * (CX + 1) + i + 1]];
    if (a === 2 && b === 2 && e.some(Boolean)) cola(out, C['tiles-grama-terra'][e.join('')], i * T, j * T);
  }
  // objetos, de trás para a frente: serras, vulcão, árvores (mata no sul, bosques no meio)
  const obj = n => decodePng(fs.readFileSync(path.join(D, 'pecas', n + '-00.png')));
  const serra = obj('obj-serra'), vulcao = obj('obj-vulcao'), arvA = obj('obj-arvore-a'), arvB = obj('obj-arvore-b');
  const coisas = SERRAS.map(([x, y]) => ({ y, d: () => cola(out, serra, x - 32, y - 48) }));
  coisas.push({ y: VULCAO[1], d: () => cola(out, vulcao, VULCAO[0] - 32, VULCAO[1] - 56) });
  const GIN = [[96, 104], [100, 198], [86, 302]];
  for (let y = 120; y < H - 20; y += 13) for (let x = 12; x < W - 12; x += 14) {
    const tx = x + Math.round((hash(x, y) - 0.5) * 8), ty = y + Math.round((hash(y, x) - 0.5) * 8);
    const ci = Math.round(tx / T), cj = Math.round(ty / T); if (at(ci, cj) !== 2 || estrada[cj * (CX + 1) + ci]) continue;
    if (GIN.some(g => Math.hypot(tx - g[0], ty - g[1]) < 30) || Math.hypot(tx - 150, ty - 350) < 20) continue;
    const quer = ty > 250 ? hash(tx, ty + 1) < 0.62 : hash(tx, ty + 1) < 0.22;
    if (quer) coisas.push({ y: ty, d: () => cola(out, ty > 250 && hash(tx, 3) < 0.7 ? arvA : arvB, tx - 16, ty - 28) });
  }
  coisas.sort((p, q) => p.y - q.y).forEach(c => c.d());
  fs.writeFileSync(path.join(D, 'montado.png'), encodePng(out));
  console.log('prototype/assets/arte/mapa-mundo/montado.png montado');
}
