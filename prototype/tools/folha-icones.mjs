// prototype/tools/folha-icones.mjs — folha de conferência dos ícones (dist/icones.html).
// Função pura: HTML e CSS inline, sem rede. Cada ícone em 16 e 32 px, no fundo escuro e no creme.
import { FAMILIAS, RESERVADOS } from './icones-catalogo.mjs';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function img(url, id, lado) {
  return `<img src="${esc(url)}" alt="${esc(id)}" width="${lado}" height="${lado}">`;
}
function celula(icones, item) {
  const url = icones[item.id];
  const par = url
    ? ['escuro', 'claro'].map(f => `<div class="fundo ${f}">${img(url, item.id, 16)}${img(url, item.id, 32)}</div>`).join('')
    : '<div class="falta">falta</div>';
  const marca = RESERVADOS.includes(item.id) ? '<span class="marca">reservado</span>' : '';
  return `<figure class="ic">${par}<figcaption>${esc(item.id)}${marca}</figcaption></figure>`;
}
function secao(titulo, itens, icones) {
  return `<section><h2>${esc(titulo)} <small>(${itens.length})</small></h2><div class="grade">${itens.map(i => celula(icones, i)).join('')}</div></section>`;
}

export function htmlFolhaIcones(icones, catalogo, antigos) {
  const hoje = antigos.map(id => ({ id }));
  const secoes = [secao('Os 16 de hoje', hoje, icones)]
    .concat(FAMILIAS.map(f => secao(f.nome, catalogo.filter(i => i.familia === f.id), icones)));
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ícones: folha de conferência</title>
<style>
:root { --bg: #16271f; --texto: #f1e9d4; --suave: #9fb8a8; --marca: #f2c230; --borda: #335446; }
@media (prefers-color-scheme: light) { :root { --bg: #f1e9d4; --texto: #16271f; --suave: #335446; --marca: #9c7210; --borda: #b8a878; } }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--texto); font: 14px/1.4 system-ui, sans-serif; }
h1 { font-size: 20px; margin: 0 0 8px; }
h2 { font-size: 16px; margin: 24px 0 8px; }
small { color: var(--suave); font-weight: normal; }
.grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; }
.ic { margin: 0; padding: 6px; border: 1px solid var(--borda); border-radius: 6px; }
.fundo { display: flex; align-items: center; gap: 8px; padding: 6px; margin-bottom: 4px; border-radius: 4px; min-height: 32px; }
.escuro { background: #16271f; }
.claro { background: #f1e9d4; }
.fundo img { image-rendering: pixelated; }
.falta { padding: 14px 6px; color: var(--marca); font-weight: bold; text-align: center; }
figcaption { font-size: 11px; word-break: break-all; color: var(--suave); }
.marca { display: block; color: var(--marca); font-weight: bold; }
</style>
</head>
<body>
<h1>Ícones: folha de conferência</h1>
${secoes.join('\n')}
</body>
</html>
`;
}
