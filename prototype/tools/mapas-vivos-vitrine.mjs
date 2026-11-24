// uso: node prototype/tools/mapas-vivos-vitrine.mjs <saída.html> (publicada em https://claude.ai/artifact/AAxGUNY1Fa8SjoRNTrfoRW)
// Vitrine dos 3 mapas das trilhas animados (etapa 4): ambiente.js + as imagens; caminho de exemplo desenhado por cima
import { readFileSync, writeFileSync } from 'node:fs'
const R = new URL('../', import.meta.url).pathname
const amb = readFileSync(R + 'src/ambiente.js', 'utf8')
const man = readFileSync(R + 'assets/arte/animacao.json', 'utf8')
const img = (el) => 'data:image/png;base64,' + readFileSync(R + 'assets/arte/telas/finais/mapa-' + el + '.png').toString('base64')
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mapas vivos</title><style>
:root{--fundo:#2e222f;--texto:#ffffff;--suave:#c7dcd0}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--fundo:#2e222f;--texto:#fff;--suave:#c7dcd0}}
:root[data-theme="dark"]{--fundo:#2e222f}
body{margin:0;background:var(--fundo);color:var(--texto);font:14px/1.4 system-ui,sans-serif;padding:16px}
h1{font-size:18px;margin:0 0 4px}p{color:var(--suave);margin:0 0 12px;max-width:820px}
.grade{display:flex;flex-wrap:wrap;gap:16px}.mapa{flex:0 1 auto}.mapa b{display:block;margin-bottom:4px}
canvas{image-rendering:pixelated;width:256px;height:384px;display:block;max-width:calc(100vw - 32px)}
@media (min-width:900px){canvas{width:256px;height:384px}}
@media (min-width:1300px){canvas{width:384px;height:576px}}
label{display:inline-flex;gap:6px;align-items:center;margin:0 16px 12px 0;color:var(--suave)}
</style></head><body>
<h1>Mapas das trilhas vivos (animação ambiente, etapa 4)</h1>
<p>Fundo de cada trilha com o motor de ambiente: água (correnteza, espuma, coqueiros, junco, peixe), fogo (lava em ciclo de cor, brasas, fumaça, tufos) e grama (copas ao vento, sombras de nuvem, borboletas, folhas). A faixa clara é um caminho de exemplo; no jogo, o caminho, as bases e os oponentes da frente 2 vão por cima.</p>
<label><input type="checkbox" id="cam" checked> mostrar o caminho de exemplo</label><label><input type="checkbox" id="red"> movimento reduzido (parado)</label>
<div class="grade">${['agua', 'fogo', 'grama'].map((el) => `<div class="mapa"><b>${{ agua: 'Água', fogo: 'Fogo', grama: 'Grama' }[el]}</b><canvas id="c-${el}" width="256" height="384"></canvas></div>`).join('')}</div>
<script>${amb}</script>
<script>
var IMGS = ${JSON.stringify({ agua: img('agua'), fogo: img('fogo'), grama: img('grama') })};
Ambiente.dados({ manifesto: ${man} });
var W = 256, H = 384, cam = new Uint8Array(W * H);
for (var y = 0; y < H; y++) { var xc = 128 + Math.sin(y / 60) * 50; for (var x = Math.round(xc - 7); x <= xc + 7; x++) if (x >= 0 && x < W) cam[y * W + x] = 1; }
var camada = document.createElement('canvas'); camada.width = W; camada.height = H;
var cg = camada.getContext('2d'), id = cg.createImageData(W, H);
for (var i = 0; i < W * H; i++) if (cam[i]) { id.data[i*4] = 0xc7; id.data[i*4+1] = 0xb0; id.data[i*4+2] = 0x8b; id.data[i*4+3] = 255; }
cg.putImageData(id, 0, 0);
var mapas = [];
Promise.all(['agua', 'fogo', 'grama'].map(function (el) { return new Promise(function (ok) { var im = new Image(); im.onload = function () { ok([el, im]); }; im.src = IMGS[el]; }); })).then(function (l) {
  l.forEach(function (p) { var c = Ambiente.cena('mapa:' + p[0], { imagem: p[1], caminho: cam }); mapas.push({ c: c, g: document.getElementById('c-' + p[0]).getContext('2d') }); });
  var ant = 0;
  function quadro(now) {
    var t = now / 1000, dt = ant ? Math.min(0.1, t - ant) : 1 / 60; ant = t;
    var red = document.getElementById('red').checked, mostra = document.getElementById('cam').checked;
    mapas.forEach(function (m) {
      if (red) m.c.parada(m.g); else { m.c.atualiza(t, dt); m.c.desenha(m.g, { x0: 0, x1: W, y0: 0, y1: H }); }
      if (mostra) m.g.drawImage(camada, 0, 0);
    });
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
});
</script></body></html>`
writeFileSync(process.argv[2], html)
console.log('ok', (html.length / 1024).toFixed(0), 'KB')
