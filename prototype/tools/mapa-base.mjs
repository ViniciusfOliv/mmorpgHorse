// prototype/tools/mapa-base.mjs — os rascunhos de composição do mapa da Expedição (spec 2026-11-18-mapa-expedicao).
// Desenha por código, sem rede e sem sorteio fora da semente, uma imagem simples de cada mapa (o mapa-múndi e o mapa
// de cada ginásio) com cada coisa num lugar combinado. O rascunho NÃO vai para o jogo: é a "init image" (ou a imagem de
// referência) das receitas do piloto do pixellab-mapa.mjs (as `*-flux*` e a `mundo-pro`). O piloto mostrou que o modelo
// pixen, que não aceita rascunho, desenha muito melhor; a arte que foi para o jogo saiu dele, e os lugares de cada mapa
// foram marcados depois, em cima da arte escolhida (prototype/assets/pixellab/mapa/mapa.json). Este arquivo fica para
// as receitas do piloto continuarem reproduzíveis (o pedido gravado em raw/mapa/ leva o hash do rascunho).
//
// Uso: node prototype/tools/mapa-base.mjs          grava prototype/assets/pixellab/mapa/base/*.png
//      node prototype/tools/mapa-base.mjs --check  só confere se o que está gravado é o que o código desenha
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIR_MAPA = path.join(RAIZ, 'prototype', 'assets', 'pixellab', 'mapa');
export const DIR_BASE = path.join(DIR_MAPA, 'base');

// Os lugares do rascunho, em pixels de arte.
// mundo: a ilha dos três ginásios embaixo e, no alto, a terra desconhecida sob as nuvens; lugares: o ponto do chão de
//   cada construção; caminho: a trilha que leva a cada lugar (`rota` é a travessia de mar, que o rascunho não desenha).
// ginasio: o mesmo traçado nos três (muda a cor): a entrada embaixo e os cinco tablados, do Recruta ao líder.
export const RASCUNHO = {
  escala: 2,
  mundo: {
    w: 168, h: 304,
    lugares: { casa: [66, 286], grama: [50, 242], agua: [108, 222], fogo: [98, 152], desconhecido: [84, 46] },
    caminho: {
      grama: [[66, 286], [60, 270], [50, 256], [50, 242]],
      agua: [[50, 242], [62, 234], [78, 230], [94, 226], [108, 222]],
      fogo: [[108, 222], [106, 206], [98, 190], [94, 174], [98, 152]],
      desconhecido: [[98, 152], [118, 150], [130, 134], [124, 114], [112, 102]],   // por terra, contornando o vulcão até a praia do norte
      rota: [[112, 102], [106, 88], [96, 74], [88, 60], [84, 46]],                    // pelo mar, até a terra sob as nuvens (o rascunho não desenha)
    },
  },
  ginasio: {
    w: 168, h: 400,
    entrada: [84, 398],
    etapas: [[52, 364], [116, 296], [52, 228], [116, 160], [84, 88]],
  },
};

// ---------------------------------------------------------------- desenho
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function tela(w, h) {
  const rgba = new Uint8Array(w * h * 4);
  const px = (x, y, lw, lh, cor) => {
    const [r, g, b] = hex(cor);
    for (let j = Math.max(0, Math.round(y)); j < Math.min(h, Math.round(y) + lh); j++) {
      for (let i = Math.max(0, Math.round(x)); i < Math.min(w, Math.round(x) + lw); i++) {
        const k = (j * w + i) * 4; rgba[k] = r; rgba[k + 1] = g; rgba[k + 2] = b; rgba[k + 3] = 255;
      }
    }
  };
  return { w, h, rgba, px };
}
function rngDe(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruido(x, y, esc, s) {
  const gx = x / esc, gy = y / esc, x0 = Math.floor(gx), y0 = Math.floor(gy);
  let fx = gx - x0, fy = gy - y0;
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const mancha = (x, y, cx, cy, rx, ry) => 1 - Math.hypot((x - cx) / rx, (y - cy) / ry);
// uma trilha grossa entre os pontos (largura em px), com a borda mais escura
function trilha(T, pts, larg, cor, borda) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let q = 0; q <= n; q++) { const X = ax + (bx - ax) * q / n, Y = ay + (by - ay) * q / n; T.px(X - larg / 2 - 1, Y - larg / 2 - 1, larg + 2, larg + 2, borda); }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let q = 0; q <= n; q++) { const X = ax + (bx - ax) * q / n, Y = ay + (by - ay) * q / n; T.px(X - larg / 2, Y - larg / 2, larg, larg, cor); }
  }
}
function elipse(T, cx, cy, rx, ry, cor, cor2) {
  for (let j = -ry; j <= ry; j++) { const w = Math.round(rx * Math.sqrt(1 - (j * j) / (ry * ry))); T.px(cx - w, cy + j, 2 * w, 1, j < 0 || !cor2 ? cor : cor2); }
}

function desenhaMundo() {
  const M = RASCUNHO.mundo, W = M.w, H = M.h, T = tela(W, H), px = T.px, L = M.lugares;
  const DY = 88;   // a ilha fica 88 px abaixo do alto: o alto é o mar do norte e a terra desconhecida
  const terra = [], bioma = [];
  for (let y = 0; y < H; y++) {
    terra.push([]); bioma.push([]);
    for (let x = 0; x < W; x++) {
      const yy = y - DY;
      const v = Math.max(mancha(x, yy, 84, 118, 58, 78), mancha(x, yy, 104, 50, 46, 36), mancha(x, yy, 56, 164, 46, 40)) + (ruido(x, y, 14, 3) - 0.5) * 0.42 + (ruido(x, y, 5, 9) - 0.5) * 0.12;
      const lago = mancha(x, yy, 118, 122, 17, 12) + (ruido(x, y, 7, 5) - 0.5) * 0.3;
      const rio = Math.abs(yy - (122 + Math.sin(x / 7) * 3)) < 2.2 && x > 126;
      // a terra desconhecida: uma costa larga no alto do mapa
      const norte = mancha(x, y, 84, -6, 110, 64) + (ruido(x, y, 16, 71) - 0.5) * 0.5;
      const t = (v > 0 && !(lago > 0) && !rio) || norte > 0;
      terra[y].push(t ? 1 : 0);
      const seco = (78 - yy) / 30 + (ruido(x, y, 18, 21) - 0.5) * 0.8, mata = (yy - 118) / 30 + (95 - x) / 60 + (ruido(x, y, 16, 33) - 0.5) * 0.9;
      const brejo = (x - 96) / 30 - Math.abs(yy - 122) / 34 + (ruido(x, y, 12, 44) - 0.5) * 0.6;
      bioma[y].push(!t ? 'mar' : norte > 0 && !(v > 0) ? 'norte' : seco > 0.55 ? 'sertao' : brejo > 0.5 ? 'brejo' : mata > 0.55 ? 'mata' : 'campo');
    }
  }
  const COR = { mar: ['#1f5f8f', '#236a9c'], raso: ['#3a8ab8', '#4a9ac4'], areia: ['#e2cf98', '#d6c088'], campo: ['#5fae4a', '#69b852'], mata: ['#3f8f3c', '#48993f'],
    sertao: ['#c98a48', '#d0954f'], brejo: ['#4f9f78', '#58a880'], norte: ['#6f7f86', '#78888f'] };
  const perto = (xx, yy, r, quer) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const X = xx + i, Y = yy + j; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; if ((terra[Y][X] > 0) === quer) return true; }
    return false;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const bm = bioma[y][x], k = hash(x >> 1, y >> 1, 7) > 0.5 ? 1 : 0;
    px(x, y, 1, 1, bm === 'mar' ? (perto(x, y, 3, true) ? COR.raso[k] : COR.mar[k]) : (bm !== 'norte' && perto(x, y, 2, false) ? COR.areia[k] : COR[bm][k]));
  }
  const r = rngDe(11);
  for (let i = 0; i < 130; i++) { const wx = Math.floor(r() * W), wy = Math.floor(r() * H); if (bioma[wy][wx] === 'mar' && !perto(wx, wy, 5, true)) { px(wx, wy, 3, 1, '#4f93bd'); px(wx + 1, wy - 1, 1, 1, '#4f93bd'); } }
  // enfeites: árvores na mata e no campo, cactos e pedras no sertão, juncos no brejo (longe dos lugares e do caminho)
  const livres = [[L.casa, 12, 10], [L.grama, 16, 14], [L.agua, 16, 14], [L.fogo, 22, 34]].map(([p, a, b]) => [p[0], p[1], a, b]);
  Object.values(M.caminho).forEach((c) => c.forEach((p) => livres.push([p[0], p[1], 6, 8])));
  const arvore = (ax, ay) => { px(ax + 1, ay + 4, 1, 2, '#5a3a1c'); px(ax, ay + 1, 3, 3, '#1f6a2c'); px(ax + 1, ay, 1, 1, '#1f6a2c'); px(ax, ay + 1, 1, 1, '#2f8a3a'); px(ax + 1, ay + 1, 1, 1, '#3fa046'); };
  const enf = [];
  for (let i = 0; i < 700; i++) { const ex = Math.floor(r() * (W - 4)), ey = DY + Math.floor(r() * (H - DY - 7)), eb = bioma[ey + 4][ex + 1]; if (eb === 'mar' || eb === 'norte' || perto(ex + 1, ey + 4, 3, false)) continue; enf.push([ex, ey, eb, r()]); }
  enf.sort((p, q) => p[1] - q[1]);
  for (const e of enf) {
    if (livres.some((z) => Math.abs(e[0] - z[0]) < z[2] && Math.abs(e[1] - z[1]) < z[3])) continue;
    if (e[2] === 'mata' && e[3] < 0.85) arvore(e[0], e[1]); else if (e[2] === 'campo' && e[3] < 0.3) arvore(e[0], e[1]);
    else if (e[2] === 'sertao' && e[3] < 0.3) { px(e[0] + 1, e[1], 1, 5, '#2f7a3a'); px(e[0], e[1] + 1, 1, 2, '#2f7a3a'); px(e[0] + 2, e[1] + 2, 1, 2, '#2f7a3a'); }
    else if (e[2] === 'sertao' && e[3] < 0.55) { px(e[0], e[1] + 4, 3, 2, '#8a6a4a'); px(e[0] + 1, e[1] + 3, 1, 1, '#a88560'); }
    else if (e[2] === 'brejo' && e[3] < 0.5) { px(e[0], e[1] + 2, 1, 3, '#2f6f4a'); px(e[0] + 2, e[1] + 3, 1, 2, '#2f6f4a'); }
  }
  // o vulcão atrás da Fornalha
  const vx = L.fogo[0], vy = L.fogo[1] - 42;
  for (let j = 0; j < 28; j++) { const meia = 4 + Math.round(j * 0.74); px(vx - meia, vy + j, meia * 2, 1, j < 4 ? '#5a2a1a' : (j % 5 === 0 ? '#6f4a34' : '#7f553a')); }
  px(vx - 4, vy - 1, 8, 2, '#ff6a1a'); px(vx - 2, vy - 2, 4, 1, '#ffb020'); px(vx - 1, vy + 1, 2, 9, '#ff6a1a'); px(vx + 1, vy + 6, 1, 7, '#ff8a2a');
  // o caminho: uma trilha de terra clara, do estábulo ao vulcão e dali para o norte
  for (const k of ['grama', 'agua', 'fogo', 'desconhecido']) trilha(T, M.caminho[k], 3, '#ead9a0', '#8a6a3a');
  // clareiras nos lugares (o chão onde cada construção fica)
  for (const k of ['casa', 'grama', 'agua', 'fogo']) elipse(T, L[k][0], L[k][1] - 2, 12, 6, '#d9c088', '#c4a870');
  // a terra desconhecida sob as nuvens: um banco de nuvens brancas cobrindo o alto do mapa
  const rn = rngDe(23);
  for (let i = 0; i < 150; i++) {
    const cx = Math.floor(rn() * (W + 20)) - 10, cy = Math.floor(rn() * 74) - 6, rx = 8 + Math.floor(rn() * 12), ry = 4 + Math.floor(rn() * 5);
    if (cy > 58 && rn() < 0.6) continue;
    elipse(T, cx, cy + 2, rx, ry, '#b8c4d0'); elipse(T, cx, cy, rx, ry, rn() < 0.5 ? '#f4f7fa' : '#e3eaf0');
  }
  return T;
}

// O mapa de um ginásio: a trilha em S, da entrada (embaixo) ao líder (no alto), com os cinco tablados
const TEMA = {
  grama: { chao: ['#4f9f48', '#58a850'], margem: ['#2f7a34', '#37843a'], trilha: '#c9a868', borda: '#7a5a2e', tablado: '#a5823f', tablado2: '#6a4f24', lider: '#d9b25a' },
  agua: { chao: ['#58a880', '#62b088'], margem: ['#2f7fa8', '#3a8ab8'], trilha: '#d8c490', borda: '#7a6a3e', tablado: '#a5823f', tablado2: '#6a4f24', lider: '#c8d8e0' },
  fogo: { chao: ['#5a3a30', '#644238'], margem: ['#ff6a1a', '#ffa020'], trilha: '#9a8a80', borda: '#3a2620', tablado: '#8a7a74', tablado2: '#4a3c38', lider: '#d9a05a' },
};
function desenhaGinasio(id) {
  const G = RASCUNHO.ginasio, W = G.w, H = G.h, T = tela(W, H), px = T.px, c = TEMA[id];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = hash(x >> 1, y >> 1, 5) > 0.5 ? 1 : 0, b1 = ruido(x, y, 16, 8) * 12, b2 = ruido(x, y, 16, 19) * 12;
    const fora = x < 6 + b1 || x > W - 7 - b2;
    px(x, y, 1, 1, fora ? c.margem[k] : c.chao[k]);
  }
  const r = rngDe(id === 'grama' ? 4 : id === 'agua' ? 5 : 6);
  for (let i = 0; i < 260; i++) {
    const ex = Math.floor(r() * (W - 6)), ey = Math.floor(r() * (H - 8)), dentro = ex > 26 && ex < W - 30;
    if (id === 'grama') { if (!dentro || r() < 0.12) { px(ex + 1, ey + 5, 1, 2, '#5a3a1c'); px(ex - 1, ey + 1, 5, 4, '#1f6a2c'); px(ex, ey, 3, 1, '#1f6a2c'); px(ex, ey + 1, 2, 2, '#3fa046'); } else if (r() < 0.3) { px(ex, ey, 1, 1, '#f4e06a'); } }
    else if (id === 'agua') { if (!dentro) px(ex, ey, 3, 1, '#7fc8e8'); else if (r() < 0.25) { px(ex, ey, 1, 3, '#2f6f4a'); px(ex + 2, ey + 1, 1, 2, '#2f6f4a'); } }
    else { if (!dentro) px(ex, ey, 2, 1, '#ffd24a'); else if (r() < 0.3) { px(ex, ey + 1, 3, 2, '#3a2620'); px(ex + 1, ey, 1, 1, '#7a5a50'); } }
  }
  trilha(T, [G.entrada].concat(G.etapas), 9, c.trilha, c.borda);
  G.etapas.forEach((p, i) => { const lider = i === G.etapas.length - 1; elipse(T, p[0], p[1] + 1, lider ? 34 : 26, lider ? 11 : 9, c.borda); elipse(T, p[0], p[1], lider ? 32 : 24, lider ? 9 : 7, lider ? c.lider : c.tablado, c.tablado2); });
  return T;
}

export function bases() {
  const out = { 'mundo.png': desenhaMundo() };
  for (const id of ['grama', 'agua', 'fogo']) out[`ginasio-${id}.png`] = desenhaGinasio(id);
  return Object.fromEntries(Object.entries(out).map(([nome, T]) => [nome, encodePng({ width: T.w, height: T.h, rgba: T.rgba })]));
}

function main() {
  const check = process.argv.includes('--check'), arqs = bases();
  let difere = 0;
  for (const [nome, buf] of Object.entries(arqs)) {
    const arq = path.join(DIR_BASE, nome), igual = fs.existsSync(arq) && Buffer.compare(fs.readFileSync(arq), Buffer.from(buf)) === 0;
    if (check) { if (!igual) { console.log('DIFERE: ' + path.relative(RAIZ, arq)); difere++; } continue; }
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    if (!igual) fs.writeFileSync(arq, buf);
    console.log((igual ? 'igual   ' : 'gravado ') + path.relative(RAIZ, arq));
  }
  if (check) { console.log(difere ? `${difere} rascunho(s) fora de dia: rode node prototype/tools/mapa-base.mjs` : 'OK: rascunhos em dia'); process.exit(difere ? 1 : 0); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
