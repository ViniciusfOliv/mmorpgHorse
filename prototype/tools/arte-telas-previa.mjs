// prototype/tools/arte-telas-previa.mjs — prévia das cenas das abas (etapa 6) dentro do jogo de verdade, sem mexer no
// código: abre prototype/dist/preview.html num celular (390 × 844, densidade 2), escolhe o inicial e, em cada aba, põe
// a cena escolhida numa faixa no topo (escala inteira do guia: 3 px de tela por pixel de arte), com o título por cima da
// borda de baixo e um pontilhado no fim. No Estábulo, um cavalo alazão de exemplo parado na cena, 1:1.
// É só uma captura para o Vinicius julgar; a integração de verdade é a parte de código da etapa 6.
// Uso:  node prototype/tools/arte-telas-previa.mjs [estabulo=3 haras=3 loja=1 expedicao=3]
// Saída: prototype/assets/arte/telas/previas/tela-<aba>.png
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RAIZ } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte', 'telas');
const ESC = { estabulo: 3, haras: 3, loja: 1, expedicao: 3 };
for (const a of process.argv.slice(2)) { const [k, v] = a.split('='); if (k in ESC) ESC[k] = Number(v); }
const ROTULO = { estabulo: 'Estábulo', haras: 'Haras', loja: 'Loja', expedicao: 'Expedição' };
const rgb = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
const ALAZAO = { 25: '2e222f', 50: '6e2727', 75: '9e4539', 100: 'cd683d', 125: 'e6904e', 150: 'fbb954', 175: 'fbb954', 200: 'fbb954', 225: 'fbb954' };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function faixa(aba) {
  const img = decodePng(fs.readFileSync(path.join(DIR, 'cenas', `${aba}-${ESC[aba]}.png`))), W = img.width, H = img.height, p = new Uint8Array(img.rgba);
  if (aba === 'estabulo') {
    const m = decodePng(fs.readFileSync(path.join(RAIZ, 'prototype', 'assets', 'pixellab', 'molde-padrao-chamas-retrato.png')));
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4, c = ALAZAO[m.rgba[i]];
      if (!c || !m.rgba[i + 3]) continue;
      const X = 96 + x, Y = 112 - 57 + y;   // os pés acima da placa do título (que cobre as últimas ~45 linhas)
      if (X < W && Y < H) p.set([...rgb(c), 255], (Y * W + X) * 4);
    }
  }
  // as últimas 24 linhas somem em pontilhado ordenado (alfa binário), deixando ver o fundo da interface
  for (let y = H - 24; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y - (H - 24)) / 24 * 16;
    if (BAYER[y % 4][x % 4] < k) p[(y * W + x) * 4 + 3] = 0;
  }
  return 'data:image/png;base64,' + encodePng({ width: W, height: H, rgba: p }).toString('base64');
}

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await pg.goto('file://' + path.join(RAIZ, 'prototype', 'dist', 'preview.html'));
await pg.waitForSelector('.inicial');
await pg.getByRole('button', { name: 'Escolher Brasa' }).click();
await pg.waitForSelector('#t-estabulo');
fs.mkdirSync(path.join(DIR, 'previas'), { recursive: true });
for (const aba of Object.keys(ESC)) {
  if (aba !== 'estabulo') { await pg.locator('nav.app-abas button', { hasText: ROTULO[aba] }).click(); await pg.waitForTimeout(400); }
  await pg.evaluate(src => {
    document.querySelectorAll('.cena-previa').forEach(e => e.remove());
    const h = document.querySelector('main.app-conteudo h1'), alvo = h.closest('header') || h;
    const d = document.createElement('div');
    d.className = 'cena-previa';
    d.style.cssText = `width:384px;height:240px;margin:-8px 0 0 calc(50% - 192px);background:url(${src}) 0 0/384px 240px no-repeat;image-rendering:pixelated`;
    alvo.parentNode.insertBefore(d, alvo);
    alvo.style.marginTop = '-64px'; alvo.style.position = 'relative';
    window.scrollTo(0, 0);
  }, faixa(aba));
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(DIR, 'previas', `tela-${aba}.png`) });
  console.log(`tela-${aba}.png (cena ${aba}-${ESC[aba]})`);
}
await b.close();
