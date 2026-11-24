// prototype/tools/arte-desafio-moldes.mjs — as vistas de frente e de costas dos 12 moldes entram nos moldes do jogo (plano do
// mapa dos ginásios, tarefa B1; spec 2026-11-24-mapa-ginasios §4). Sem rede, sem custo.
// Entrada: prototype/assets/arte/desafio/bakeoff/meshy-<molde>-papeis-dir1.png (frente: 3/4, cabeça à esquerda) e -dir5.png
// (costas: 3/4), mapas de papéis 72 × 72 (cinza = papel × 25), e as âncoras de meshy-ancoras.json (arte-desafio-ancoras.mjs).
// Saída: prototype/assets/arte/desafio/vistas/vista-<molde>-frente.png e -costas.png, recortados para a grade dos moldes
// (64 × 64: deslocamento DX em x e DY em y; as caixas medidas vão de x 9 a 63 e de y 7 a 68), e vistas-3d.json na mesma pasta
// com as âncoras deslocadas no formato dos outros estados (footY, bbox { x, y, w, h }) mais as peças do idle combinadas com
// a frente 1 (olho, orelhas, crina, respira, cauda). Fora de assets/pixellab: os moldes do PixelLab (os JSONs e os PNGs que o
// pixellab-moldes.mjs refaz byte a byte) não mudam; o arte-embutida.mjs junta as duas coisas na carga.
// Uso: node prototype/tools/arte-desafio-moldes.mjs
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './pixellab-comum.mjs';
import { decodePng, encodeGray } from './png.mjs';

const B = path.join(RAIZ, 'prototype', 'assets', 'arte', 'desafio', 'bakeoff'), OUT = path.join(RAIZ, 'prototype', 'assets', 'arte', 'desafio', 'vistas');
fs.mkdirSync(OUT, { recursive: true });
export const DX = -4, DY = -5, LADO = 64;
const MOLDES = ['esguio', 'padrao', 'robusto'].flatMap((p) => ['chamas', 'ondas', 'folhas', 'lisa'].map((e) => `${p}-${e}`));
const VISTAS = { frente: 1, costas: 5 };
const anc = JSON.parse(fs.readFileSync(path.join(B, 'meshy-ancoras.json'), 'utf8'));
const caixa = (c) => (c ? [c[0] + DX, c[1] + DY, c[2] + DX, c[3] + DY] : null);
const out = { gerado: 'arte-desafio-moldes.mjs', origem: 'Meshy image-to-3d (papéis), arte-desafio-render.mjs --papeis', dx: DX, dy: DY, moldes: {} };
for (const m of MOLDES) {
  out.moldes[m] = {};
  for (const [v, d] of Object.entries(VISTAS)) {
    const im = decodePng(fs.readFileSync(path.join(B, `meshy-${m}-papeis-dir${d}.png`)));
    const g = new Uint8Array(LADO * LADO);   // como os outros moldes: cinza = papel × 25, 0 = transparente (sem alfa)
    let perdidos = 0;
    for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
      const i = (y * im.width + x) * 4; if (!im.rgba[i + 3]) continue;
      const X = x + DX, Y = y + DY;
      if (X < 0 || Y < 0 || X >= LADO || Y >= LADO) { perdidos++; continue; }
      g[Y * LADO + X] = im.rgba[i];
    }
    if (perdidos) throw new Error(`${m} ${v}: ${perdidos} pixels fora da grade de 64 × 64`);
    fs.writeFileSync(path.join(OUT, `vista-${m}-${v}.png`), encodeGray({ width: LADO, height: LADO, data: g }));
    const A = anc[m][v], bb = caixa(A.bbox);
    const r = { footY: A.footY + DY, bbox: { x: bb[0], y: bb[1], w: bb[2] - bb[0], h: bb[3] - bb[1] }, olho: [], orelhas: caixa(A.orelhas),
      crina: caixa(A.crina), respira: [A.respira[0] + DX, A.respira[1] + DX, A.respira[2] + DY] };
    for (let k = 0; k < A.olho.length; k += 2) r.olho.push(A.olho[k] + DX, A.olho[k + 1] + DY);
    if (v === 'costas') r.cauda = caixa(A.cauda);
    // nose e rear (os outros estados têm; o sprites.js os exige em toda âncora): o alto da cabeça (o meio das orelhas) e o
    // meio da cauda nas costas, ou o meio do corpo na frente
    const meio = (c) => [Math.round((c[0] + c[2]) / 2), Math.round((c[1] + c[3]) / 2)];
    r.nose = r.orelhas ? meio(r.orelhas) : [bb[0] + Math.round((bb[2] - bb[0]) / 2), bb[1]];
    r.rear = r.cauda ? meio(r.cauda) : [bb[0] + Math.round((bb[2] - bb[0]) / 2), Math.round((bb[1] + r.footY) / 2)];
    out.moldes[m][v] = r;
  }
}
fs.writeFileSync(path.join(OUT, 'vistas-3d.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`${MOLDES.length} moldes × 2 vistas em prototype/assets/arte/desafio/vistas/ (vista-<molde>-frente.png, -costas.png, vistas-3d.json)`);
