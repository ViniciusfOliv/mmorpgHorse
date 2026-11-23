// prototype/tools/arte-capa.mjs — etapa 7 da direção de arte: a imagem de destaque do Google Play (1024 × 500, sem
// alfa) e a capa, montadas em código, sem custo. A cena vem da própria amostra da corrida (prototype/arte/
// corrida-amostra.html no modo ?captura=LARGURA: as camadas da região, a pista e os cavalos 1:1 recoloridos na paleta,
// sem texto e sem HUD), um quadro parado no meio da corrida; o logo (arte-letreiro.mjs: emblema escolhido + letreiro)
// vai por cima, no céu. Tudo em pixels de arte, ampliado por fator inteiro (2×) e recortado no tamanho final.
// Uso:  node prototype/tools/arte-capa.mjs [--t SEGUNDOS] [--regiao cerrado]
// Saída: prototype/assets/arte/marca/destaque-1024x500.png e capa.png (a mesma composição, para o README e a loja).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RAIZ } from './pixellab-comum.mjs';
import { decodePng, encodePng, encodeRgb } from './png.mjs';
import { RESURRECT64, conferir } from './arte-paleta.mjs';
import { logo, ESCOLHA_EMBLEMA } from './arte-letreiro.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte', 'marca');
const v = process.argv.slice(2), opt = (k, p) => (v.includes(k) ? v[v.indexOf(k) + 1] : p);
const T = Number(opt('--t', '55')), REGIAO = opt('--regiao', 'cerrado');
const ESC = 2, LARG = 1024 / ESC, ALT = 500 / ESC;   // 512 × 250 pixels de arte (o plano: 512 × 250 × 2)
const Y0 = Number(opt('--y0', '0'));                                      // a janela vertical da cena (céu + raias)

function recorte(img, x0, y0, w, h) {
  const out = { width: w, height: h, rgba: new Uint8Array(w * h * 4) };
  for (let y = 0; y < h; y++) out.rgba.set(img.rgba.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4), y * w * 4);
  return out;
}
function colar(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const i = (y * src.width + x) * 4;
    if (src.rgba[i + 3]) dst.rgba.set(src.rgba.subarray(i, i + 4), ((oy + y) * dst.width + ox + x) * 4);
  }
}
// amplia por fator inteiro (vizinho mais próximo) e recorta no tamanho final, a partir do canto de cima à esquerda
function ampliar(img, k, w, h) {
  const out = { width: w, height: h, rgba: new Uint8Array(w * h * 4) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((Math.floor(y / k)) * img.width + Math.floor(x / k)) * 4;
    out.rgba.set([img.rgba[i], img.rgba[i + 1], img.rgba[i + 2], 255], (y * w + x) * 4);
  }
  return out;
}

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1200, height: 900 } });
await pg.goto('file://' + path.join(RAIZ, 'prototype', 'arte', 'corrida-amostra.html') + `?captura=${LARG}`);
await pg.waitForFunction(() => window.__amostra);
await pg.waitForTimeout(800);
const uri = await pg.evaluate(([t, r]) => window.__amostra.quadro(t, r), [T, REGIAO]);
await b.close();
const cena = decodePng(Buffer.from(uri.split(',')[1], 'base64'));
const janela = recorte(cena, 0, Y0, LARG, ALT);
const emb = decodePng(fs.readFileSync(path.join(DIR, 'emblema', String(ESCOLHA_EMBLEMA).padStart(2, '0') + '.png')));
const lg = logo(emb);
colar(janela, lg, 6, 4);
const k = conferir(janela, RESURRECT64);
const final = ampliar(janela, ESC, 1024, 500);
fs.writeFileSync(path.join(DIR, 'destaque-1024x500.png'), encodeRgb(final));
fs.writeFileSync(path.join(DIR, 'capa.png'), encodePng(final));
fs.writeFileSync(path.join(DIR, 'logo.png'), encodePng(lg));
// o ícone do app escolhido (marca/icone/03.png, 128 × 128) ampliado 4× para 512 × 512, sem alfa (regra do Play)
const ICONE = '03', ic = decodePng(fs.readFileSync(path.join(DIR, 'icone', ICONE + '.png')));
fs.writeFileSync(path.join(DIR, 'icone-512.png'), encodeRgb(ampliar(ic, 4, 512, 512)));
console.log(`cena ${cena.width}×${cena.height} (t = ${T} s, ${REGIAO}), janela ${LARG}×${ALT} a partir de y ${Y0}; fora da paleta ${k.fora}; destaque 1024×500`);
