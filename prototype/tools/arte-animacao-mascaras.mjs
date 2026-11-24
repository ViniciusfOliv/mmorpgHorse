// prototype/tools/arte-animacao-mascaras.mjs — node prototype/tools/arte-animacao-mascaras.mjs [--saida <arquivo.png>]
// Folha de conferência do manifesto da animação ambiente (prototype/assets/arte/animacao.json; plano
// docs/superpowers/plans/2026-11-24-animacao-ambiente.md, etapa 1): cada imagem animada com as máscaras pintadas por
// cima, uma cor por peça (o que pisca no ciclo de cor, o que dobra na deformação), para conferir se a peça pega o que
// devia e nada além. As máscaras são as do próprio motor (prototype/src/ambiente.js), montadas na amostra
// (prototype/arte/animacao-amostra.html; rode antes node prototype/tools/arte-animacao-build.mjs).
// Sem rede e sem créditos. Padrão da saída: <tmp>/animacao-mascaras.png.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const i = process.argv.indexOf('--saida');
const SAIDA = path.resolve(i > 0 ? process.argv[i + 1] : path.join(os.tmpdir(), 'animacao-mascaras.png'));
const { chromium } = createRequire(path.join(RAIZ, 'prototype') + '/')('playwright');

const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const erros = []; pg.on('pageerror', (e) => erros.push(e.message));
await pg.addInitScript(() => { window.requestAnimationFrame = () => 0; });
await pg.goto('file://' + path.join(RAIZ, 'prototype', 'arte', 'animacao-amostra.html'));
await pg.waitForFunction(() => window.__animacao, null, { timeout: 30000 });
const png = await pg.evaluate(() => {
  const A = window.__animacao, E = window.Ambiente;
  // [cena, campo, tipo, rótulo]: as peças de cada cena (CicloCor: px; Deforma: m)
  const PECAS = [
    ['litoral', 'mar', 'ciclo', 'Litoral · mar'], ['litoral', 'coqueiros', 'deforma', 'Litoral · coqueiros'],
    ['litoral', 'torcida', 'deforma', 'Litoral · torcida'], ['litoral', 'capim', 'deforma', 'Litoral · capim'],
    ['planalto', 'copas', 'deforma', 'Planalto · araucárias'], ['planalto', 'capim', 'deforma', 'Planalto · capim'],
    ['expedicao', 'ciclo', 'ciclo', 'Expedição · lava e rio'], ['expedicao', 'giro', 'deforma', 'Expedição · placas'],
    ['expedicao', 'capim', 'deforma', 'Expedição · capim e pinheiros'], ['expedicao', 'mata', 'deforma', 'Expedição · matas'],
    ['cavalos', 'pasto', 'ciclo', 'Haras · pasto'], ['cavalos', 'arvores', 'deforma', 'Haras · árvores']
  ];
  const TINTAS = ['#f04f78', '#4d9be6', '#f9c22b', '#1ebc73', '#a884f3', '#fb6b1d', '#30e1b9'];
  const blocos = [];
  for (const [id, campo, tipo, rot] of PECAS) {
    A.trocaCena(id);
    const p = A.CENAS[id][campo];
    if (!p) { blocos.push({ rot: rot + ' (não montada)', c: null }); continue; }
    const base = tipo === 'ciclo' ? p.base : p.o, w = base.w, h = base.h;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.putImageData(new ImageData(new Uint8ClampedArray(base.d.buffer.slice(0)), w, h), 0, 0);
    g.globalAlpha = 1;
    const marca = (x, y, k) => { g.fillStyle = TINTAS[k % TINTAS.length]; g.fillRect(x, y, 1, 1); };
    let n = 0;
    if (tipo === 'ciclo') { for (let j = 0; j < p.n; j++) { if ((p.px[j * 5 + 1] + p.px[j * 5 + 2]) % 2) continue; marca(p.px[j * 5 + 1], p.px[j * 5 + 2], p.px[j * 5 + 3]); n++; } }
    else { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = p.m[y * w + x]; if (v && (x + y) % 2 === 0) { marca(x, y, v - 1); n++; } } }
    blocos.push({ rot: `${rot} (${n * 2} px)`, c });
  }
  // folha: 2 colunas, cada imagem com o rótulo em cima, em escala 2 (as largas, como o Litoral de 384+, cabem inteiras)
  const ESC = 2, larg = Math.max(...blocos.filter((x) => x.c).map((x) => x.c.width)) * ESC, colW = larg + 16;
  let y = 8; const pos = [];
  for (let k = 0; k < blocos.length; k += 2) {
    const alt = Math.max(...blocos.slice(k, k + 2).map((x) => (x.c ? x.c.height : 0))) * ESC + 22;
    pos.push(...blocos.slice(k, k + 2).map((x, j) => ({ ...x, x: 8 + j * colW, y }))); y += alt + 8;
  }
  const F = document.createElement('canvas'); F.width = colW * 2 + 8; F.height = y; const fg = F.getContext('2d');
  fg.fillStyle = '#ffffff'; fg.fillRect(0, 0, F.width, F.height); fg.imageSmoothingEnabled = false;
  fg.font = '14px sans-serif'; fg.fillStyle = '#2e222f';
  pos.forEach((p) => { fg.fillStyle = '#2e222f'; fg.fillText(p.rot, p.x, p.y + 14); if (p.c) fg.drawImage(p.c, p.x, p.y + 20, p.c.width * ESC, p.c.height * ESC); });
  return F.toDataURL('image/png');
});
fs.writeFileSync(SAIDA, Buffer.from(png.split(',')[1], 'base64'));
await b.close();
if (erros.length) { console.log('erros na página: ' + erros.join(' | ')); process.exit(1); }
console.log('folha das máscaras: ' + SAIDA);
