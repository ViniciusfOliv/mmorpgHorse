// prototype/tools/folha-icones16.mjs — folha dos ícones pequenos (etapa 4 da direção de arte): para cada ícone, o atual
// (32 × 32), o desenhado em código em 16 × 16 (icones16-mapas.mjs) e as tentativas do PixelLab (redimensionado 16 e 24,
// do zero 16), ampliados para o mesmo tamanho, e o de código no tamanho do jogo sobre um painel.
// Uso: node prototype/tools/folha-icones16.mjs → prototype/arte/folha-icones16.html
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './pixellab-comum.mjs';
import { MAPAS } from './icones16-mapas.mjs';

const A = path.join(RAIZ, 'prototype', 'assets');
const CAND = path.join(A, 'arte', 'icones16', 'candidatos');
const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const cand = fs.existsSync(CAND) ? fs.readdirSync(CAND) : [];
const achar = (id, m) => { const f = cand.find(f => new RegExp(`^${id}-${m}-s\\d+\\.png$`).test(f)); return f ? path.join(CAND, f) : null; };
const ids = [...new Set([...Object.keys(MAPAS), ...cand.map(f => f.replace(/-(resize24|resize|pixen)-s\d+\.png$/, ''))])].sort();
const cel = (f, n = 96) => f ? `<img src="${uri(f)}" style="width:${n}px;height:${n}px" alt="">` : '<span class="vazio">—</span>';
const linhas = ids.map(id => {
  const cod = MAPAS[id] ? path.join(A, 'arte', 'icones16', id + '.png') : null;
  const jogo = cod ? `<span class="painel"><img src="${uri(cod)}" style="width:24px;height:24px" alt=""> Texto</span>` : '';
  return `<tr><th>${id}</th><td>${cel(path.join(A, 'icons', id + '.png'))}</td><td class="cod">${cel(cod)}</td><td>${cel(achar(id, 'resize'))}</td>`
    + `<td>${cel(achar(id, 'pixen'))}</td><td>${cel(achar(id, 'resize24'))}</td><td>${jogo}</td></tr>`;
}).join('');
const html = `<title>Ícones 16×16</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root { --fundo: #2e222f; --painel: #313638; --texto: #c7dcd0; --texto-2: #9babb2; --ouro: #f9c22b; color-scheme: dark; }
body { background: var(--fundo); color: var(--texto); font: 16px/1.5 monospace; }
.pagina { max-width: 1100px; margin: 0 auto; padding-block: 16px 40px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1 { color: var(--ouro); font-size: 22px; } p { color: var(--texto-2); max-width: 75ch; }
.rolo { overflow-x: auto; } table { border-collapse: collapse; } th, td { padding: 8px; text-align: center; border-bottom: 1px solid #3e3546; }
th { text-align: left; font-weight: normal; color: var(--texto-2); } thead th { color: var(--ouro); text-align: center; }
td.cod { background: #3e3546; } img { image-rendering: pixelated; background: #3e3546; display: block; margin: 0 auto; }
.vazio { color: #625565; } .painel { background: var(--painel); padding: 6px 8px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 0 2px #2e222f; }
.painel img { background: none; margin: 0; }
</style>
<div class="pagina"><h1>Ícones pequenos · desenho em código × IA</h1>
<p>Ampliados para o mesmo tamanho. A coluna destacada é o ícone de 16×16 desenhado em código, pixel a pixel, na paleta do guia (contorno escuro, luz de cima e da esquerda). As três seguintes são as tentativas do PixelLab: o atual redimensionado para 16 e para 24, e um gerado do zero em 16. A última mostra o de código no tamanho do jogo.</p>
<div class="rolo"><table><thead><tr><th></th><th>Atual 32×32</th><th>Código 16×16</th><th>PixelLab redim. 16</th><th>PixelLab do zero 16</th><th>PixelLab redim. 24</th><th>No jogo</th></tr></thead><tbody>${linhas}</tbody></table></div></div>`;
const saida = path.join(RAIZ, 'prototype', 'arte', 'folha-icones16.html');
fs.writeFileSync(saida, html);
console.log(path.relative(RAIZ, saida));
