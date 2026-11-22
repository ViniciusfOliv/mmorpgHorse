// prototype/tools/arte-letreiro.mjs — etapa 7 da direção de arte: o letreiro "GALOPE ELEMENTAL" desenhado à mão, letra
// por letra, na grade (a IA erra letras; a capa do Canva saiu "Calope"). Sem rede e sem custo.
// Letras maiúsculas de 12 px, traço de 2 px; o dourado da paleta mestra (claro em cima, queimado embaixo), 2 px de
// relevo para baixo em marrom escuro e contorno de 1 px na cor do contorno do jogo (2e222f).
// Saída (prototype/assets/arte/marca/):
//   letreiro-linha.png   uma linha, 16 px de altura (o cabeçalho do jogo, em 1×);
//   letreiro-duas.png    GALOPE em cima de ELEMENTAL (a tela inicial, a capa);
//   letreiro-mini.png    o mesmo em duas linhas com letras de 8 px e relevo de 1 (o cabeçalho do jogo, 1:1: o de 12 px
//                        não cabe nos 48 px de CSS do cabeçalho quando a grade é 1,5 ou mais; integração, 2026-11-22);
//   logo.png             o emblema escolhido (marca/emblema/NN.png, ESCOLHA abaixo) ao lado do letreiro em duas linhas.
// Uso:  node prototype/tools/arte-letreiro.mjs
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, conferir } from './arte-paleta.mjs';

const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte', 'marca');
export const ESCOLHA_EMBLEMA = 10;   // escolha do Vinicius (2026-11-20), candidato de marca/emblema/
const L = {
  A: ['.######.', '########', '##....##', '##....##', '##....##', '########', '########', '##....##', '##....##', '##....##', '##....##', '##....##'],
  E: ['#######', '#######', '##.....', '##.....', '##.....', '######.', '######.', '##.....', '##.....', '##.....', '#######', '#######'],
  G: ['.######.', '########', '##....##', '##......', '##......', '##..####', '##..####', '##....##', '##....##', '##....##', '########', '.######.'],
  L: ['##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '#######', '#######'],
  M: ['##......##', '###....###', '####..####', '##.####.##', '##..##..##', '##......##', '##......##', '##......##', '##......##', '##......##', '##......##', '##......##'],
  N: ['##....##', '###...##', '####..##', '####..##', '##.##.##', '##.##.##', '##..####', '##..####', '##...###', '##....##', '##....##', '##....##'],
  O: ['.######.', '########', '##....##', '##....##', '##....##', '##....##', '##....##', '##....##', '##....##', '##....##', '########', '.######.'],
  P: ['#######.', '########', '##....##', '##....##', '##....##', '########', '#######.', '##......', '##......', '##......', '##......', '##......'],
  T: ['########', '########', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...'],
};
const OURO = ['fbff86', 'f9c22b', 'f9c22b', 'f9c22b', 'f9c22b', 'f9c22b', 'f79617', 'f79617', 'f79617', 'f79617', 'cd683d', 'cd683d'];
const RELEVO = '6e2727', CONTORNO = '2e222f', ESPACO = 5, ENTRE = 2, RELEVO_PX = 2;
// as letras pequenas (8 px de altura, traço de 2 px) do letreiro do cabeçalho
const L8 = {
  A: ['.####.', '######', '##..##', '##..##', '######', '######', '##..##', '##..##'],
  E: ['######', '######', '##....', '#####.', '#####.', '##....', '######', '######'],
  G: ['.#####', '######', '##....', '##.###', '##.###', '##..##', '######', '.####.'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '######', '######'],
  M: ['##....##', '###..###', '########', '##.##.##', '##....##', '##....##', '##....##', '##....##'],
  N: ['##...##', '###..##', '####.##', '##.####', '##..###', '##...##', '##...##', '##...##'],
  O: ['.####.', '######', '##..##', '##..##', '##..##', '##..##', '######', '.####.'],
  P: ['#####.', '######', '##..##', '######', '#####.', '##....', '##....', '##....'],
  T: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
};
const GRANDE = { L, ouro: OURO, h: 12, relevo: RELEVO_PX, espaco: ESPACO, entre: ENTRE };
const PEQUENA = { L: L8, ouro: ['fbff86', 'f9c22b', 'f9c22b', 'f9c22b', 'f79617', 'f79617', 'cd683d', 'cd683d'], h: 8, relevo: 1, espaco: 3, entre: 1 };
const rgb = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];

function novo(w, h) { return { width: w, height: h, rgba: new Uint8Array(w * h * 4) }; }
function pinta(img, x, y, c) { if (x >= 0 && y >= 0 && x < img.width && y < img.height) img.rgba.set([...rgb(c), 255], (y * img.width + x) * 4); }
const opaco = (img, x, y) => x >= 0 && y >= 0 && x < img.width && y < img.height && img.rgba[(y * img.width + x) * 4 + 3] > 0;
function colar(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const i = (y * src.width + x) * 4;
    if (src.rgba[i + 3]) dst.rgba.set(src.rgba.subarray(i, i + 4), ((oy + y) * dst.width + ox + x) * 4);
  }
}
const largura = (txt, F) => [...txt].reduce((s, ch, i) => s + (ch === ' ' ? F.espaco : F.L[ch][0].length) + (i ? F.entre : 0), 0);

// uma linha de texto: miolo dourado, relevo para baixo, contorno em volta de tudo (1 px de margem em cada lado)
export function linha(txt, F = GRANDE) {
  const W = largura(txt, F) + 2, H = F.h + F.relevo + 2, img = novo(W, H);
  const miolo = novo(W, H);
  let x0 = 1;
  for (const ch of txt) {
    if (ch === ' ') { x0 += F.espaco + F.entre; continue; }
    F.L[ch].forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') pinta(miolo, x0 + x, 1 + y, F.ouro[y]); }));
    x0 += F.L[ch][0].length + F.entre;
  }
  for (let d = F.relevo; d >= 1; d--) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (opaco(miolo, x, y - d)) pinta(img, x, y, RELEVO);
  colar(img, miolo, 0, 0);
  const base = novo(W, H); base.rgba.set(img.rgba);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (opaco(base, x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => opaco(base, x + dx, y + dy))) pinta(img, x, y, CONTORNO);
  }
  return img;
}
export function duasLinhas(F = GRANDE) {
  const a = linha('GALOPE', F), b = linha('ELEMENTAL', F), W = Math.max(a.width, b.width), img = novo(W, a.height + b.height);
  colar(img, a, Math.floor((W - a.width) / 2), 0); colar(img, b, Math.floor((W - b.width) / 2), a.height);
  return img;
}
function aparar(img) {   // tira a margem transparente
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (opaco(img, x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const out = novo(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = 0; y < out.height; y++) out.rgba.set(img.rgba.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x1 + 1) * 4), y * out.width * 4);
  return out;
}
export function logo(emblemaBruto) {
  const emblema = aparar(emblemaBruto), t = duasLinhas(), H = Math.max(emblema.height, t.height), img = novo(emblema.width + 3 + t.width, H);
  colar(img, emblema, 0, Math.floor((H - emblema.height) / 2)); colar(img, t, emblema.width + 3, Math.floor((H - t.height) / 2));
  return img;
}

if (process.argv[1] && process.argv[1].endsWith('arte-letreiro.mjs')) {
  fs.mkdirSync(DIR, { recursive: true });
  const saidas = { 'letreiro-linha.png': linha('GALOPE ELEMENTAL'), 'letreiro-duas.png': duasLinhas(), 'letreiro-mini.png': duasLinhas(PEQUENA) };
  const arqE = ESCOLHA_EMBLEMA === null ? null : path.join(DIR, 'emblema', String(ESCOLHA_EMBLEMA).padStart(2, '0') + '.png');
  if (arqE && fs.existsSync(arqE)) saidas['logo.png'] = logo(decodePng(fs.readFileSync(arqE)));
  // --previa 10,02,11: o logo montado com cada emblema candidato (para a escolha), em marca/previas/
  const iP = process.argv.indexOf('--previa');
  if (iP > 0) {
    fs.mkdirSync(path.join(DIR, 'previas'), { recursive: true });
    for (const n of process.argv[iP + 1].split(',')) saidas[`previas/logo-emblema-${n}.png`] = logo(decodePng(fs.readFileSync(path.join(DIR, 'emblema', n + '.png'))));
  }
  for (const [f, img] of Object.entries(saidas)) {
    const k = conferir(img, RESURRECT64);
    fs.writeFileSync(path.join(DIR, f), encodePng(img));
    console.log(`${f}: ${img.width}×${img.height}, fora ${k.fora}, alfa ${k.alfa}`);
  }
}
