// prototype/tools/fonte-glifos.mjs — os glifos da Galmuri para o texto do canvas (etapa 2.2 da direção de arte, guia §6):
// cada tamanho (Galmuri7 a 8 px, Galmuri9 a 10 px, Galmuri11 Bold a 12 px, Galmuri14 a 15 px: a contagem) rasterizado UMA vez no navegador, no tamanho
// nativo, com alfa binário (o pixel acende se a cobertura passa de 50%), e gravado em prototype/assets/fontes/
// galmuri-glifos.json. O jogo (sprites.js, SP.drawText) e os testes em Node leem o mesmo JSON: as larguras e os pixels
// são iguais nos dois, sem depender da fonte instalada nem do rasterizador do aparelho.
// Formato: { fontes: { g7|g9|g11|g14: { px, altura, base, glifos: { "<caractere>": [avanço, esq, larg, linhas...] } } } },
// cada linha é um inteiro com os bits da esquerda para a direita (bit mais alto = coluna esq).
// Uso:  node prototype/tools/fonte-glifos.mjs   (refazer só se mudar a fonte ou o conjunto de caracteres)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RAIZ } from './pixellab-comum.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const DIR = path.join(RAIZ, 'prototype', 'assets', 'fontes');
const FONTES = { g7: ['galmuri7-latin.ttf', 8], g9: ['galmuri9-latin.ttf', 10], g11: ['galmuri11-bold-latin.ttf', 12], g14: ['galmuri14-latin.ttf', 15] };
let CHARS = '';
for (let c = 32; c < 127; c++) CHARS += String.fromCharCode(c);
CHARS += 'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüçºª°·×→←…–—“”‘’◀▶▲▼';   // só caracteres que a Galmuri tem (conferido com o fontTools): sem ↑↓↪↻

const b = await chromium.launch();
const pg = await b.newPage();
const saida = { fonte: 'Galmuri (Lee Minseo, OFL 1.1)', fontes: {} };
for (const [id, [arq, px]] of Object.entries(FONTES)) {
  const b64 = fs.readFileSync(path.join(DIR, arq)).toString('base64');
  saida.fontes[id] = await pg.evaluate(async ({ b64, px, chars, fam }) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const f = new FontFace(fam, bin.buffer); await f.load(); document.fonts.add(f);
    const c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    g.font = px + 'px "' + fam + '"';
    // a caixa: do topo do acento mais alto ao pé da descendente mais baixa (o "VULE" da amostra: o acento não pode cortar)
    const m = g.measureText('ÁÊÔÕÃÍÇgjpqy|'), asc = Math.ceil(Math.max(m.actualBoundingBoxAscent, px)) + 1, desc = Math.ceil(m.actualBoundingBoxDescent) + 1;
    const H = asc + desc, glifos = {};
    for (const ch of chars) {
      const adv = Math.round(g.measureText(ch).width), W = adv + 8;
      c.width = W; c.height = H;
      g.font = px + 'px "' + fam + '"'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
      g.clearRect(0, 0, W, H); g.fillText(ch, 4, asc);
      const d = g.getImageData(0, 0, W, H).data;
      let x0 = W, x1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      if (x1 < 0) { glifos[ch] = [adv, 0, 0]; continue; }
      const linhas = [];
      for (let y = 0; y < H; y++) { let v = 0; for (let x = x0; x <= x1; x++) v = v * 2 + (d[(y * W + x) * 4 + 3] > 127 ? 1 : 0); linhas.push(v); }
      glifos[ch] = [adv, x0 - 4, x1 - x0 + 1].concat(linhas);
    }
    return { px, altura: H, base: asc, glifos };
  }, { b64, px, chars: CHARS, fam: 'GalmuriAtlas_' + id });
  console.log(`${id}: ${px} px, altura ${saida.fontes[id].altura}, base ${saida.fontes[id].base}, ${Object.keys(saida.fontes[id].glifos).length} glifos`);
}
await b.close();
fs.writeFileSync(path.join(DIR, 'galmuri-glifos.json'), JSON.stringify(saida));
console.log('prototype/assets/fontes/galmuri-glifos.json', fs.statSync(path.join(DIR, 'galmuri-glifos.json')).size, 'bytes');
