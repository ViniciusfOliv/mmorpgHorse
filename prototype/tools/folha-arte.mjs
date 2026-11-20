// prototype/tools/folha-arte.mjs — folha de contato de uma região de corrida, para a aprovação do Vinicius (plano da
// direção de arte, etapa 0): a paleta da região, a cena montada na escala do jogo, cada camada final repetida duas
// vezes lado a lado (para ver a emenda) e, se houver, os candidatos ainda não escolhidos.
// Uso: node prototype/tools/folha-arte.mjs <regiao>|todas   → prototype/arte/folha-<regiao>.html (autocontida)
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './pixellab-comum.mjs';
import { decodePng } from './png.mjs';
import { REGIOES, conferir } from './arte-paleta.mjs';

const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte');
const manifesto = JSON.parse(fs.readFileSync(path.join(DIR, 'regioes.json'), 'utf8'));
const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const Z = 2;   // px CSS por pixel de arte na folha

function folha(r) {
  const reg = manifesto[r], pal = REGIOES[r], partes = [];
  partes.push(`<h2>Paleta (${pal.length} cores)</h2><div class="pal">${pal.map(h => `<i style="background:#${h}" title="#${h}"></i>`).join('')}</div>`);
  const cam = reg.camadas, tem = k => fs.existsSync(path.join(DIR, r, k + '.png'));
  if (['nuvens', 'horizonte', 'meio', 'frente'].every(tem)) {
    // cena montada como na amostra (prototype/arte/amostra.js): céu em faixas, nuvens, horizonte, meio, arquibancada,
    // faixa de grama, pista (cor chapada aqui), capim da frente; 2 cópias de largura (768 px de arte)
    const img = k => decodePng(fs.readFileSync(path.join(DIR, r, k + '.png')));
    const L = 768, H = 328, el = (k, y, x = 0) => { const d = img(k); return `<img src="${uri(path.join(DIR, r, k + '.png'))}" style="left:${x * Z}px;top:${y * Z}px;width:${d.width * Z}px;height:${d.height * Z}px">`; };
    const hz = img('horizonte').height, me = img('meio').height;
    const camadas = [
      el('nuvens', 18), el('nuvens', 18, 384), el('horizonte', 96 - hz), el('horizonte', 96 - hz, 384),
      el('meio', 154 - me + ((reg.posicao || {}).meio || 0)), el('meio', 154 - me + ((reg.posicao || {}).meio || 0), 384),
      tem('arquibancada') ? el('arquibancada', 122 - img('arquibancada').height, 200) : '',
      `<b style="left:0;top:${112 * Z}px;width:${L * Z}px;height:${16 * Z}px;background:#239063"></b>`,
      `<b style="left:0;top:${128 * Z}px;width:${L * Z}px;height:${160 * Z}px;background:#cd683d"></b>`,
      `<b style="left:0;top:${294 * Z}px;width:${L * Z}px;height:${34 * Z}px;background:#4c3e24"></b>`,
      el('frente', 284), el('frente', 284, 384),
    ].join('');
    partes.push(`<h2>Cena montada (sem cavalos; pista em cor chapada)</h2><div class="rolo"><div class="cena" style="width:${L * Z}px;height:${H * Z}px">${camadas}</div></div>`);
  }
  partes.push('<h2>Camadas finais (cada uma duas vezes, lado a lado)</h2>');
  for (const k of Object.keys(cam)) {
    const f = path.join(DIR, r, k + '.png');
    if (!fs.existsSync(f)) { partes.push(`<p>${k}: falta o final</p>`); continue; }
    const d = decodePng(fs.readFileSync(f)), c = conferir(d, pal), u = uri(f);
    partes.push(`<h3>${k} <small>${d.width}×${d.height}${cam[k].emenda ? ` · emenda ${c.emenda.toFixed(2)}` : ''} · ${cam[k].origem}</small></h3>` +
      `<div class="rolo"><div class="tira">${(cam[k].emenda ? [u, u] : [u]).map(s => `<img src="${s}" style="width:${d.width * Z}px">`).join('')}</div></div>`);
  }
  const dirC = path.join(DIR, r, 'candidatos');
  if (fs.existsSync(dirC)) {
    partes.push('<h2>Candidatos (para escolher)</h2>');
    for (const f of fs.readdirSync(dirC).filter(f => f.endsWith('.png')).sort()) {
      const d = decodePng(fs.readFileSync(path.join(dirC, f))), u = uri(path.join(dirC, f));
      partes.push(`<h3>${f.replace('.png', '')} <small>${d.width}×${d.height}</small></h3><div class="rolo"><div class="tira">${[u, u].map(s => `<img src="${s}" style="width:${d.width * Z}px">`).join('')}</div></div>`);
    }
  }
  return `<title>Folha ${reg.nome}</title>
<style>
:root { --fundo: #2e222f; --texto: #c7dcd0; --texto-2: #9babb2; --ouro: #f9c22b; color-scheme: dark; }
body { background: var(--fundo); color: var(--texto); font: 16px/1.5 monospace; }
.pagina { max-width: 1600px; margin: 0 auto; padding-block: 16px 40px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1 { color: var(--ouro); font-size: 22px; } h2 { font-size: 18px; margin-top: 28px; } h3 { font-size: 15px; margin: 14px 0 4px; } small { color: var(--texto-2); }
.pal { display: flex; flex-wrap: wrap; gap: 4px; } .pal i { width: 28px; height: 28px; outline: 1px solid #000; }
.rolo { overflow-x: auto; } .tira { display: flex; width: max-content; background: #8fd3ff; }
.tira img, .cena img { image-rendering: pixelated; display: block; }
.cena { position: relative; background: linear-gradient(#4d65b4 0 8%, #4d9be6 8% 20%, #8fd3ff 20% 31%, #c7dcd0 31%); }
.cena img, .cena b { position: absolute; }
</style>
<div class="pagina"><h1>${reg.nome} · folha de contato</h1><p>Pistas: ${reg.pistas.join(', ')}. Escala: 1 pixel de arte = ${Z} px.</p>${partes.join('\n')}</div>`;
}

const alvo = process.argv[2] || 'todas', feitas = [];
for (const r of alvo === 'todas' ? Object.keys(manifesto).filter(k => !k.startsWith('_')) : [alvo]) {
  const temAlgo = Object.keys(manifesto[r].camadas).length || fs.existsSync(path.join(DIR, r, 'candidatos'));
  if (!temAlgo) continue;
  const saida = path.join(RAIZ, 'prototype', 'arte', `folha-${r}.html`), html = folha(r);
  fs.writeFileSync(saida, html); feitas.push(html);
  console.log(`${path.relative(RAIZ, saida)} (${(fs.statSync(saida).size / 1024).toFixed(0)} KB)`);
}
// todas: também uma página só com as regiões, para publicar de uma vez (a primeira traz o <title> e o estilo)
if (alvo === 'todas' && feitas.length > 1) {
  const corpo = h => h.slice(h.indexOf('<div class="pagina">'));
  const topo = feitas[0].slice(0, feitas[0].indexOf('<div class="pagina">')).replace(/<title>[^<]*<\/title>/, '<title>Regiões de corrida</title>');
  const saida = path.join(RAIZ, 'prototype', 'arte', 'folhas-regioes.html');
  fs.writeFileSync(saida, topo + feitas.map(corpo).join('\n'));
  console.log(`${path.relative(RAIZ, saida)} (${(fs.statSync(saida).size / 1024).toFixed(0)} KB)`);
}
