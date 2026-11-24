// prototype/tools/arte-desafio-ancoras.mjs — as âncoras das vistas de frente e de costas dos 12 moldes (frente 2, cena de
// desafio), no formato combinado com a frente 1 para o Sprites.IdleMolde (peças explícitas, sem a geometria de perfil):
//   footY, bbox [x0, y0, x1, y1), olho [x, y, …], orelhas [x0, y0, x1, y1), crina [x0, y0, x1, y1), respira [x0, x1, y] e,
//   só nas costas, cauda [x0, y0, x1, y1). Caixas com fim exclusivo.
// Entrada: prototype/assets/arte/desafio/bakeoff/meshy-<molde>-papeis-dir1.png (frente) e -dir5.png (costas), mapas de
// papéis 72 × 72 (cinza = papel × 25: 1 contorno, 2/3 pelo, 4/5 crina, 6 detalhe, 7 seda, 8 pele, 9 sela).
// Saída: prototype/assets/arte/desafio/bakeoff/meshy-ancoras.json e uma folha de conferência (meshy-ancoras.png, 2×).
// Regras (heurísticas, conferidas na folha): o cavalo é tudo menos seda, pele e sela; as orelhas são as 3 linhas de cima do
// pelo, numa janela de 7 px em volta do pixel de pelo mais alto; crina e cauda são blocos contínuos dos papéis 4/5/6 que não encostam no
// jóquei nem na sela (a até 2 px): a crina, o bloco mais perto das orelhas; a cauda, o maior bloco que desce da metade
// do cavalo sem chegar aos cascos; a respiração é a linha do pelo a 55%
// da altura. O olho das vistas 3D não aparece a ~54 px: a lista fica vazia (sem piscar).
// Sem rede, sem custo. Uso: node prototype/tools/arte-desafio-ancoras.mjs
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';

const B = path.join(RAIZ, 'prototype', 'assets', 'arte', 'desafio', 'bakeoff');
const MOLDES = ['esguio', 'padrao', 'robusto'].flatMap(p => ['chamas', 'ondas', 'folhas', 'lisa'].map(e => `${p}-${e}`));
const VISTAS = { frente: 1, costas: 5 };

function ancoras(im, vista) {
  const W = im.width, H = im.height, P = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (im.rgba[i * 4 + 3]) P[i] = Math.round(im.rgba[i * 4] / 25);
  const em = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : P[y * W + x]);
  const caixa = (f) => { let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1]; };
  const bbox = caixa((x, y) => em(x, y) > 0), footY = bbox[3] - 1;
  const cavalo = (x, y) => { const v = em(x, y); return v > 0 && v < 7; };
  const pelo = (x, y) => em(x, y) === 2 || em(x, y) === 3;
  const pertoJoquei = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (em(x + dx, y + dy) >= 7) return true; return false; };
  const cav = caixa(cavalo), meio = Math.round((cav[1] + footY) / 2);
  // orelhas: o pelo mais alto e as 3 linhas abaixo dele, numa janela de 7 px
  let topo = null; for (let y = 0; y < H && !topo; y++) for (let x = 0; x < W; x++) if (pelo(x, y)) { topo = [x, y]; break; }
  const orelhas = caixa((x, y) => cavalo(x, y) && y >= topo[1] && y < topo[1] + 3 && Math.abs(x - topo[0]) <= 3);
  const juba = (x, y) => { const v = em(x, y); return (v === 4 || v === 5 || v === 6) && !pertoJoquei(x, y); };
  // blocos contínuos (vizinhança de 8) de crina/cauda; os pixels soltos da textura e os cascos ficam de fora
  const comp = new Int32Array(W * H).fill(-1), blocos = [];
  for (let i = 0; i < W * H; i++) {
    if (comp[i] >= 0 || !juba(i % W, (i / W) | 0)) continue;
    const pilha = [i], px = []; comp[i] = blocos.length;
    while (pilha.length) { const q = pilha.pop(), qx = q % W, qy = (q / W) | 0; px.push(qx, qy);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = qx + dx, ny = qy + dy, j = ny * W + nx;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < W && ny < H && comp[j] < 0 && juba(nx, ny)) { comp[j] = blocos.length; pilha.push(j); } } }
    let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let k = 0; k < px.length; k += 2) { x0 = Math.min(x0, px[k]); x1 = Math.max(x1, px[k]); y0 = Math.min(y0, px[k + 1]); y1 = Math.max(y1, px[k + 1]); }
    blocos.push({ n: px.length / 2, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, c: [x0, y0, x1 + 1, y1 + 1] });
  }
  const grandes = blocos.filter(b => b.n >= 4);
  // crina: o bloco mais perto das orelhas, acima da metade do cavalo e a até 16 px delas na horizontal (de frente, a cauda
  // também aparece no alto, do outro lado); sem bloco assim, sem crina (o vento não mexe)
  const crinaB = grandes.filter(b => b.c[1] < meio && Math.abs(b.cx - topo[0]) <= 16 && b.n >= 4).sort((a, b) => Math.hypot(a.cx - topo[0], a.cy - topo[1]) - Math.hypot(b.cx - topo[0], b.cy - topo[1]))[0];
  const crina = crinaB ? crinaB.c : null;
  // cauda (só nas costas): o maior bloco que desce abaixo da metade e não chega aos cascos
  const caudaB = vista === 'costas' ? grandes.filter(b => b !== crinaB && b.c[3] > meio && b.c[1] < footY - 6).sort((a, b) => b.n - a.n)[0] : null;
  const cauda = caudaB ? caudaB.c : null;
  const yr = Math.round(cav[1] + 0.55 * (footY - cav[1]));
  let rx0 = W, rx1 = -1; for (let x = 0; x < W; x++) if (pelo(x, yr)) { rx0 = Math.min(rx0, x); rx1 = Math.max(rx1, x); }
  const out = { footY, bbox, olho: [], orelhas, crina, respira: [rx0, rx1 + 1, yr] };
  if (vista === 'costas') out.cauda = cauda;
  return out;
}

const todas = {}, avisos = [];
for (const m of MOLDES) {
  todas[m] = {};
  for (const [v, d] of Object.entries(VISTAS)) {
    const f = path.join(B, `meshy-${m}-papeis-dir${d}.png`);
    if (!fs.existsSync(f)) { avisos.push(`falta ${path.basename(f)}`); continue; }
    const a = ancoras(decodePng(fs.readFileSync(f)), v);
    for (const k of ['orelhas', 'crina', 'cauda']) if (k in a && !a[k]) avisos.push(`${m} ${v}: sem ${k}`);
    todas[m][v] = a;
  }
}
fs.writeFileSync(path.join(B, 'meshy-ancoras.json'), JSON.stringify(todas, null, 1) + '\n');

// folha de conferência: cada vista em cinza, com as caixas por cima (orelhas verde, crina ciano, cauda magenta, respiração amarela)
const L = 72, K = 2, cols = 6, rows = Math.ceil(MOLDES.length * 2 / cols), F = { width: cols * L * K, height: rows * L * K, rgba: new Uint8Array(cols * L * K * rows * L * K * 4) };
const pinta = (ox, oy, x, y, c) => { for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) { const p = ((oy + y * K + j) * F.width + ox + x * K + i) * 4; F.rgba.set([...c, 255], p); } };
let n = 0;
for (const m of MOLDES) for (const [v, d] of Object.entries(VISTAS)) {
  const f = path.join(B, `meshy-${m}-papeis-dir${d}.png`); if (!fs.existsSync(f)) continue;
  const im = decodePng(fs.readFileSync(f)), ox = (n % cols) * L * K, oy = Math.floor(n / cols) * L * K; n++;
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) { const a = im.rgba[(y * L + x) * 4 + 3], g = im.rgba[(y * L + x) * 4]; pinta(ox, oy, x, y, a ? [40 + g * 0.7, 40 + g * 0.7, 40 + g * 0.7] : [24, 28, 36]); }
  const A = todas[m][v], borda = (c, cor) => { if (!c) return; for (let x = c[0]; x < c[2]; x++) { pinta(ox, oy, x, c[1], cor); pinta(ox, oy, x, c[3] - 1, cor); } for (let y = c[1]; y < c[3]; y++) { pinta(ox, oy, c[0], y, cor); pinta(ox, oy, c[2] - 1, y, cor); } };
  borda(A.orelhas, [60, 220, 90]); borda(A.crina, [60, 210, 230]); borda(A.cauda, [230, 70, 220]);
  for (let x = A.respira[0]; x < A.respira[1]; x++) pinta(ox, oy, x, A.respira[2], [250, 210, 40]);
}
fs.writeFileSync(path.join(B, 'meshy-ancoras.png'), encodePng(F));
console.log(`meshy-ancoras.json: ${Object.keys(todas).length} moldes × 2 vistas` + (avisos.length ? '\n' + avisos.join('\n') : ''));
