// prototype/tools/folha-cavalos-idle.mjs — node prototype/tools/folha-cavalos-idle.mjs [--saida <arquivo.png>]
// Folha de conferência do idle dos cavalos no jogo (animação ambiente, etapa 2): os 12 moldes (porte × crina) com as 4
// pelagens dos elementos, no chão do Estábulo, cada um num instante diferente do idle (respiração, piscar, cauda,
// orelha, cabeça, gestos do PixelLab), pelo mesmo Sprites.drawHorse do jogo (prototype/dist/preview.html; rode o build
// antes). Sem rede e sem créditos. Padrão da saída: <tmp>/cavalos-idle.png.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const i = process.argv.indexOf('--saida');
const SAIDA = path.resolve(i > 0 ? process.argv[i + 1] : path.join(os.tmpdir(), 'cavalos-idle.png'));
const { chromium } = createRequire(path.join(RAIZ, 'prototype') + '/')('playwright');
const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 1200, height: 900 } });
const erros = []; pg.on('pageerror', (e) => erros.push(e.message));
await pg.goto('file://' + path.join(RAIZ, 'prototype', 'dist', 'preview.html') + '?dev=1');
await pg.waitForFunction(() => window.Sprites && window.Sprites.moldsReady, null, { timeout: 30000 });
const png = await pg.evaluate(() => {
  const SP = window.Sprites, PORTES = ['esguio', 'padrao', 'robusto'], ELEM = { chamas: 'fogo', ondas: 'agua', folhas: 'grama', lisa: 'neutro' };
  const PEL = ['fogo', 'agua', 'grama', 'neutro'], K = 2, CW = 76, CH = 66, X0 = 150, Y0 = 26;
  const c = document.createElement('canvas'); c.width = X0 + PEL.length * 3 * CW * K / 2 + 20; c.height = Y0 + 12 * CH * K / 2 * 1.0 + 20;
  c.width = X0 + PEL.length * 2 * CW * K; c.height = Y0 + 12 * CH * K;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#2e222f'; g.font = '13px sans-serif';
  PEL.forEach((p, j) => { g.fillText('pelagem ' + p + ' (retrato · parado)', X0 + j * 2 * CW * K, 16); });
  let linha = 0;
  for (const po of PORTES) for (const es of ['chamas', 'ondas', 'folhas', 'lisa']) {
    const y = Y0 + linha * CH * K;
    g.fillStyle = '#2e222f'; g.fillText(po + '-' + es, 8, y + CH * K / 2);
    PEL.forEach((p, j) => {
      [['retrato', false], ['parado', true]].forEach(([est, joq], q) => {
        const x = X0 + (j * 2 + q) * CW * K;
        g.fillStyle = '#e6904e'; g.fillRect(x, y, CW * K - 4, CH * K - 4);
        const t = 3 + linha * 1.7 + j * 2.3 + q * 0.9;
        // o idle anda até t (os eventos dependem do caminho): alguns passos antes do instante desenhado
        const o = { palette: SP.PALETTES[p], element: ELEM[es], porte: po, idle: true, jockey: joq, scale: K, chao: '#e6904e', cena: 'estabulo', anima: 'cena', semente: 1000 + linha * 7 + j * 3 + q, silks: '#4d65b4',
          quadro: { topo: -1e6, base: y + (CH - 6) * K, grade: K, centro: x + CW * K / 2 } };
        const rasc = document.createElement('canvas').getContext('2d');
        for (let tt = 0; tt < t; tt += 0.25) SP.drawHorse(rasc, 0, 0, Object.assign({}, o, { t: tt }));
        SP.drawHorse(g, x, y, Object.assign({}, o, { t }));
      });
    });
    linha++;
  }
  return c.toDataURL('image/png');
});
fs.writeFileSync(SAIDA, Buffer.from(png.split(',')[1], 'base64'));
await b.close();
if (erros.length) { console.log('erros na página: ' + erros.join(' | ')); process.exit(1); }
console.log('folha do idle: ' + SAIDA);
