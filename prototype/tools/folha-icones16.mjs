// prototype/tools/folha-icones16.mjs — folha de comparação do piloto dos ícones em 16 × 16 (etapa 4 da direção de arte):
// para cada ícone, o atual (32 × 32), o redimensionado pelo PixelLab e o gerado do zero, ampliados para o mesmo tamanho,
// e os três no tamanho do jogo sobre um painel. Uso: node prototype/tools/folha-icones16.mjs → prototype/arte/folha-icones16.html
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './pixellab-comum.mjs';

const CAND = path.join(RAIZ, 'prototype', 'assets', 'arte', 'icones16', 'candidatos');
const ATUAIS = path.join(RAIZ, 'prototype', 'assets', 'icons');
const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const ids = [...new Set(fs.readdirSync(CAND).map(f => f.replace(/-(resize|pixen)-s\d+\.png$/, '')))].sort();
const achar = (id, m) => fs.readdirSync(CAND).find(f => f.startsWith(id + '-' + m + '-'));
const linhas = ids.map(id => {
  const a = uri(path.join(ATUAIS, id + '.png')), r = uri(path.join(CAND, achar(id, 'resize'))), p = uri(path.join(CAND, achar(id, 'pixen')));
  const grande = (s, n) => `<img src="${s}" style="width:96px;height:96px" alt="">`;
  const jogo = s => `<span class="painel"><img src="${s}" style="width:24px;height:24px" alt=""> Texto</span>`;
  return `<tr><th>${id}</th><td>${grande(a)}</td><td>${grande(r)}</td><td>${grande(p)}</td>
    <td class="jogo">${jogo(a)}${jogo(r)}${jogo(p)}</td></tr>`;
}).join('');
const html = `<title>Ícones 16×16</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root { --fundo: #2e222f; --painel: #313638; --texto: #c7dcd0; --texto-2: #9babb2; --ouro: #f9c22b; color-scheme: dark; }
body { background: var(--fundo); color: var(--texto); font: 16px/1.5 monospace; }
.pagina { max-width: 1000px; margin: 0 auto; padding-block: 16px 40px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1 { color: var(--ouro); font-size: 22px; } p { color: var(--texto-2); max-width: 70ch; }
.rolo { overflow-x: auto; } table { border-collapse: collapse; } th, td { padding: 8px; text-align: center; border-bottom: 1px solid #3e3546; }
th { text-align: left; font-weight: normal; color: var(--texto-2); } thead th { color: var(--ouro); text-align: center; }
img { image-rendering: pixelated; background: #3e3546; display: block; margin: 0 auto; }
.jogo { display: flex; gap: 8px; } .painel { background: var(--painel); padding: 6px 8px; display: flex; align-items: center; gap: 6px; box-shadow: 0 0 0 2px #2e222f; }
.painel img { background: none; margin: 0; }
</style>
<div class="pagina"><h1>Ícones em 16×16 · piloto</h1>
<p>Cada ícone em três versões, ampliadas para o mesmo tamanho: o atual (32×32, hoje mostrado reduzido), o atual redesenhado em 16×16 pelo PixelLab e um gerado do zero em 16×16. À direita, os três no tamanho do jogo (16 pixels de arte, 24 px na tela de um celular comum).</p>
<div class="rolo"><table><thead><tr><th></th><th>Atual 32×32</th><th>Redimensionado 16×16</th><th>Do zero 16×16</th><th>No jogo (atual · redim. · do zero)</th></tr></thead><tbody>${linhas}</tbody></table></div></div>`;
const saida = path.join(RAIZ, 'prototype', 'arte', 'folha-icones16.html');
fs.writeFileSync(saida, html);
console.log(path.relative(RAIZ, saida));
