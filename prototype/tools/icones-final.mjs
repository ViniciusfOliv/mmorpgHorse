// prototype/tools/icones-final.mjs — monta o conjunto final dos ícones no padrão do guia (etapa 4 da direção de arte):
//   • 24 × 24 (complexos): o candidato escolhido do modo Pro (arte-icones-pro.mjs, pasta limpos/);
//   • 24 × 24 por troca de cor, em código: as outras ligas (da liga ouro), as outras raridades (da rar-raro), o 2º e o 3º
//     do pódio (do podio-1) e o rastro da derrapagem (o Pro desenhou preto; vira dourado, como o ícone de hoje);
//   • 16 × 16 (simples): os desenhados em código (icones16-mapas.mjs).
// Sem rede e sem custo. Uso: node prototype/tools/icones-final.mjs
// Saída: prototype/assets/arte/icones/<id>.png, icones.json ({ id: lado }) e a folha prototype/arte/folha-icones.html.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, rgbDe, conferir } from './arte-paleta.mjs';
import { MAPAS, desenhar } from './icones16-mapas.mjs';

const A = path.join(RAIZ, 'prototype', 'assets');
const PRO = path.join(A, 'arte', 'icones24pro');
const SAIDA = path.join(A, 'arte', 'icones');

// escolhas do Vinicius (2026-11-20: cavalo, liga e sela) e as da direção de arte nos lotes complexos (aprovação na folha)
export const ESCOLHAS_PRO = {
  'aba-estabulo': '00', 'liga-ouro': '00', 'slot-sela': '19',
  'slot-armadura': '13', 'slot-testeira': '17', 'slot-estribos': '19', 'ui-perfil': '20',
  'ins-fogo': '00', 'ins-agua': '00', 'ins-grama': '38', 'rar-raro': '00', 'podio-1': '01',
  'sk-canto-da-iara': '37', 'sk-casco-firme': '16', 'sk-chama-final': '04', 'sk-folego-de-montanha': '29',
  'sk-nascente': '12', 'sk-nevoa-amiga': '09', 'sk-pe-na-chuva': '72', 'sk-sol-a-pino': '00',
  'st-forca': '00', 'sk-tipo-grama': '03', 'sk-drift': '13',
};
// rampas (claro → escuro) da Resurrect 64 para a troca de cor
const RAMPAS = {
  bronze: ['e6904e', 'cd683d', '9e4539', '6e2727'], prata: ['ffffff', 'c7dcd0', '9babb2', '625565'],
  platina: ['8ff8e2', '30e1b9', '0eaf9b', '0b8a8f'], diamante: ['8fd3ff', '4d9be6', '4d65b4', '484a77'],
  lenda: ['f57d4a', 'ea4f36', 'b33831', '6e2727'], cinza: ['c7dcd0', '9babb2', '7f708a', '625565'],
  verde: ['91db69', '1ebc73', '239063', '165a4c'], laranja: ['fbb954', 'f79617', 'cd683d', '9e4539'],
  roxo: ['a884f3', '905ea9', '6b3e75', '45293f'], azulRaro: ['8fd3ff', '4d9be6', '4d65b4', '484a77'], ouro: ['fbff86', 'f9c22b', 'f79617', 'cd683d'],
};
const DERIVADOS = {
  'liga-bronze': ['liga-ouro', 'dourado', 'bronze'], 'liga-prata': ['liga-ouro', 'dourado', 'prata'],
  'liga-platina': ['liga-ouro', 'dourado', 'platina'], 'liga-diamante': ['liga-ouro', 'dourado', 'diamante'],
  'liga-lenda': ['liga-ouro', 'dourado', 'lenda'],
  'rar-comum': ['rar-raro', 'medalhao', 'cinza'], 'rar-magico': ['rar-raro', 'medalhao', 'verde'],
  'rar-lendario': ['rar-raro', 'medalhao', 'laranja'], 'rar-mitico': ['rar-raro', 'medalhao', 'roxo'],
  'podio-2': ['podio-1', 'dourado', 'prata'], 'podio-3': ['podio-1', 'dourado', 'bronze'],
};

function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
const FAMILIA = {
  dourado: ([h, s]) => h >= 20 && h <= 65 && s > 0.45,
  azul: ([h, s]) => h >= 185 && h <= 250 && s > 0.3,
  // raridade: o azul e também o cavalo claro (quase sem cor), para a cor da raridade pegar o medalhão inteiro (pedido do
  // Vinicius em 2026-11-20: as raridades mudavam pouco entre si)
  verdeAnel: ([h, s, l]) => h >= 70 && h <= 175 && s > 0.2 && l > 0.15,
  medalhao: ([h, s, l]) => (h >= 155 && h <= 250 && s > 0.25 && l > 0.18) || (s < 0.25 && l > 0.6),
};
// troca as cores da família (pelo matiz) pela rampa nova, pela luminosidade (quartis dos pixels da família)
function trocarCor(img, familia, rampa, onde = () => true) {
  const p = new Uint8Array(img.rgba), idx = [];
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3] || !onde((i / 4) % img.width, Math.floor(i / 4 / img.width))) continue;
    const c = hsl([p[i], p[i + 1], p[i + 2]]);
    if (FAMILIA[familia](c)) idx.push([i, c[2]]);
  }
  const ls = idx.map(v => v[1]).sort((a, b) => b - a), q = k => ls[Math.min(ls.length - 1, Math.floor(ls.length * k))];
  const cortes = [q(0.15), q(0.5), q(0.85)];
  for (const [i, l] of idx) {
    const k = l >= cortes[0] ? 0 : l >= cortes[1] ? 1 : l >= cortes[2] ? 2 : 3;
    p.set(rgbDe(rampa[k]), i);
  }
  return { width: img.width, height: img.height, rgba: p };
}
// insígnia da grama: o candidato de folha grande (38) tem o anel verde; o anel vira dourado, como o das insígnias de
// fogo e água, e a folha continua verde (só os pixels verdes fora do raio da folha mudam)
function anelDourado(img) {
  const c = (img.width - 1) / 2, R = 8.5;
  return trocarCor(img, 'verdeAnel', RAMPAS.ouro, (x, y) => Math.hypot(x - c, y - c) >= R);
}
// derrapagem: os rastros escuros (que somem no fundo da interface) viram dourado, com o contorno escuro em volta
function rastroDourado(img) {
  const W = img.width, p = new Uint8Array(img.rgba), K = rgbDe('2e222f');
  const escuro = i => p[i + 3] && hsl([p[i], p[i + 1], p[i + 2]])[2] < 0.3;
  const marca = new Uint8Array(W * img.height);
  for (let j = 0; j < W * img.height; j++) if (escuro(j * 4)) marca[j] = 1;
  for (let j = 0; j < marca.length; j++) if (marca[j]) { const x = j % W, y = (j / W) | 0; p.set(rgbDe(x + y < W ? 'f9c22b' : 'f79617'), j * 4); }
  for (let j = 0; j < marca.length; j++) {
    if (p[j * 4 + 3]) continue;
    const x = j % W, y = (j / W) | 0;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const k = (y + dy) * W + x + dx; return x + dx >= 0 && x + dx < W && y + dy >= 0 && marca[k]; })) p.set([...K, 255], j * 4);
  }
  return { width: W, height: img.height, rgba: p };
}

export function montar() {
  fs.mkdirSync(SAIDA, { recursive: true });
  const lados = {};
  const lerPro = id => decodePng(fs.readFileSync(path.join(PRO, id, 'limpos', ESCOLHAS_PRO[id] + '.png')));
  for (const id of Object.keys(ESCOLHAS_PRO)) {
    const img = id === 'sk-drift' ? rastroDourado(lerPro(id)) : id === 'ins-grama' ? anelDourado(lerPro(id)) : lerPro(id);
    fs.writeFileSync(path.join(SAIDA, id + '.png'), encodePng(img)); lados[id] = 24;
  }
  fs.writeFileSync(path.join(SAIDA, 'rar-raro.png'), encodePng(trocarCor(lerPro('rar-raro'), 'medalhao', RAMPAS.azulRaro)));
  for (const [id, [base, fam, rampa]] of Object.entries(DERIVADOS)) {
    fs.writeFileSync(path.join(SAIDA, id + '.png'), encodePng(trocarCor(lerPro(base), fam, RAMPAS[rampa]))); lados[id] = 24;
  }
  for (const id of Object.keys(MAPAS)) {
    if (lados[id]) continue;
    fs.writeFileSync(path.join(SAIDA, id + '.png'), encodePng(desenhar(id))); lados[id] = 16;
  }
  fs.writeFileSync(path.join(SAIDA, 'icones.json'), JSON.stringify(lados, null, 2) + '\n');
  return lados;
}

if (process.argv[1] && process.argv[1].endsWith('icones-final.mjs')) {
  const lados = montar();
  const atuais = fs.readdirSync(path.join(A, 'icons')).filter(f => f.endsWith('.png')).map(f => f.replace('.png', ''));
  const faltam = atuais.filter(id => !lados[id]);
  let problemas = 0;
  for (const id of Object.keys(lados)) {
    const c = conferir(decodePng(fs.readFileSync(path.join(SAIDA, id + '.png'))), RESURRECT64);
    if (c.fora || c.alfa) { problemas++; console.log(`  PROBLEMA ${id}: fora da paleta ${c.fora}, alfa ${c.alfa}`); }
  }
  console.log(`${Object.keys(lados).length} ícones (${Object.values(lados).filter(v => v === 24).length} de 24×24, ${Object.values(lados).filter(v => v === 16).length} de 16×16); faltam ${faltam.length}: ${faltam.join(', ') || '—'}; problemas ${problemas}`);
  // folha: no tamanho do jogo (1 px de arte = 1,5 px CSS) e ampliados 4×, em grupos
  const uri = id => 'data:image/png;base64,' + fs.readFileSync(path.join(SAIDA, id + '.png')).toString('base64');
  const grupos = [['Abas e interface', /^(aba|ui|moeda|pedra|item)-/], ['Elementos, clima e piso', /^(el|cl|pi)-/], ['Status', /^st-/],
    ['Skills', /^sk-/], ['Equipamento', /^slot-/], ['Ligas, raridades, pódio e insígnias', /^(liga|rar|podio|ins)-/]];
  const ids = Object.keys(lados).sort();
  const secoes = grupos.map(([nome, re]) => `<h2>${nome}</h2><div class="grade">` + ids.filter(i => re.test(i)).map(id =>
    `<figure><img src="${uri(id)}" style="width:${lados[id] * 4}px"><span class="jogo"><img src="${uri(id)}" style="width:${lados[id] * 1.5}px"> ${id}</span><figcaption>${lados[id]}×${lados[id]}</figcaption></figure>`).join('') + '</div>').join('');
  fs.writeFileSync(path.join(RAIZ, 'prototype', 'arte', 'folha-icones.html'), `<title>Ícones do jogo</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>:root{color-scheme:dark;--fundo:#2e222f;--painel:#313638;--texto:#c7dcd0;--texto-2:#9babb2;--ouro:#f9c22b}
body{background:var(--fundo);color:var(--texto);font:14px/1.4 monospace;margin:0}
.p{max-width:1200px;margin:0 auto;padding-block:16px 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1,h2{color:var(--ouro);font-weight:normal} p{color:var(--texto-2);max-width:75ch}
.grade{display:flex;flex-wrap:wrap;gap:10px} figure{margin:0;display:grid;gap:4px;justify-items:center;background:#3e3546;padding:8px}
img{image-rendering:pixelated;display:block} .jogo{display:flex;align-items:center;gap:6px;background:var(--painel);padding:4px 6px;font-size:12px}
figcaption{color:var(--texto-2);font-size:11px}</style>
<div class="p"><h1>Ícones do jogo · conjunto novo</h1><p>Os ${ids.length} ícones no padrão do guia: os complexos em 24×24 (modo Pro do PixelLab, escolhidos entre 64 candidatos; as outras cores de ligas, raridades e pódio feitas em código) e os simples em 16×16, desenhados em código. Cada um ampliado 4× e, embaixo, no tamanho do jogo.</p>${secoes}</div>`);
  console.log('folha: prototype/arte/folha-icones.html');
}
