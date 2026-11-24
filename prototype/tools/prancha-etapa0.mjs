// prototype/tools/prancha-etapa0.mjs — node prototype/tools/prancha-etapa0.mjs [--antes <html>] [--depois <html>] [--saida <dir>]
// Prancha de aceite da etapa 0 da animação ambiente (plano docs/superpowers/plans/2026-11-24-animacao-ambiente.md; guia
// de integração docs/arte/integracao.md §5): as mesmas cenas no build de antes e no de agora, lado a lado, a 1× e a 3×,
// com a versão em escala de cinza (leitura por valor), o checklist C1–C12 e as duas referências do Vinicius.
//   cenas: corrida na pista de terra do Litoral (seed 777) em sol, nublado, chuva e névoa; Estábulo; desafio da Fornalha
//   --antes   padrão: o jogo-dev.html da base deste ramo na main (git merge-base HEAD origin/main), extraído para a saída
//   --depois  padrão: prototype/dist/jogo-dev.html (rode o build antes)
//   --saida   padrão: <tmp>/prancha-etapa0; grava os PNGs e prancha-etapa0.html (as imagens embutidas)
// Sem rede e sem créditos: só o Chromium do Playwright. Não entra no check.sh (é para olhar).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (n, pad) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : pad; };
const SAIDA = path.resolve(arg('saida', path.join(os.tmpdir(), 'prancha-etapa0')));
fs.mkdirSync(SAIDA, { recursive: true });
let ANTES = arg('antes', null);
if (!ANTES) {
  const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: RAIZ }).toString().trim();
  ANTES = path.join(SAIDA, 'antes-jogo-dev.html');
  fs.writeFileSync(ANTES, execFileSync('git', ['show', base + ':prototype/dist/jogo-dev.html'], { cwd: RAIZ, maxBuffer: 1 << 28 }));
  console.log('antes: jogo-dev.html de ' + base.slice(0, 7));
}
const DEPOIS = path.resolve(arg('depois', path.join(RAIZ, 'prototype', 'dist', 'jogo-dev.html')));
const { chromium } = createRequire(path.join(RAIZ, 'prototype') + '/')('playwright');

// recortes de 3× (pixels da imagem de 1×): o cavalo do jogador na corrida, o cavalo no estábulo e o da frente no desafio
const CLIMAS = ['sol', 'nublado', 'chuva', 'nevoa'];
async function captura(html, tag) {
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 1000, height: 800 } });
  const erros = []; pg.on('pageerror', (e) => erros.push(e.message));
  const abre = async () => { await pg.goto('file://' + html); await pg.waitForSelector('#t-estabulo'); await pg.waitForTimeout(1200); };
  const out = {};
  await abre();
  await pg.locator('#tela canvas').first().screenshot({ path: path.join(SAIDA, `${tag}-estabulo.png`) });
  out.estabulo = { recorte: await pg.evaluate(() => { const c = document.querySelector('#tela canvas'), r = c.getBoundingClientRect(); return [Math.round(r.width / 2 - 70), Math.round(r.height * 0.45), 140, 90]; }) };
  // desafio da Fornalha: o 1º ginásio, a 1ª etapa, o time sugerido
  await pg.locator('[data-acao="aba"][data-id="expedicao"]').click(); await pg.waitForSelector('#t-expedicao');
  await pg.locator('[data-acao="ginasio-abrir"][data-id="fogo"]').click(); await pg.waitForTimeout(600);
  await pg.locator('[data-acao="ginasio-etapa"]').first().click(); await pg.waitForSelector('#t-etapa');
  for (const u of await pg.evaluate(() => [...document.querySelectorAll('#tela [data-acao="ginasio-time"]')].map((x) => x.getAttribute('data-id')).slice(0, 3))) {
    await pg.locator(`#tela [data-acao="ginasio-time"][data-id="${u}"]`).click().catch(() => {});
  }
  await pg.locator('#tela [data-acao="ginasio-desafiar"]').click();
  await pg.waitForSelector('#t-desafio', { timeout: 6000 }); await pg.waitForTimeout(1500);
  await pg.locator('#tela canvas').first().screenshot({ path: path.join(SAIDA, `${tag}-desafio.png`) });
  out.desafio = { recorte: [90, 120, 160, 120] };
  for (const clima of CLIMAS) {
    await abre();
    if (!(await pg.locator('.dev-gaveta').count())) await pg.locator('.dev-botao').click();
    await pg.waitForSelector('.dev-gaveta');
    await pg.selectOption('#dev-clima', clima); await pg.selectOption('#dev-piso', 'terra'); await pg.fill('#dev-seed', '777');
    await pg.locator('[data-acao="dev-armar"]').click();
    await pg.locator('.dev-gaveta [data-acao="dev-fechar"]').click();
    await pg.locator('[data-acao="aba"][data-id="correr"]').click(); await pg.waitForSelector('#t-correr');
    await pg.locator('[data-acao="procurar"]').click(); await pg.waitForSelector('#t-largada');
    await pg.getByRole('button', { name: /^Largar/ }).click(); await pg.waitForSelector('#pista');
    await pg.waitForTimeout(7000);
    const cx = await pg.evaluate(() => {
      const st = window.RaceFx._stats, me = window.__galope.ui.lobby.playerIdx, s = window.__galope.race._state;
      const c = st.caixasCavalos.find((k) => k.racer === me), r = document.getElementById('pista').getBoundingClientRect(), f = r.width / (s.W || r.width);
      return c ? [Math.round((c.x - 12) * f), Math.round((c.y - 10) * f), Math.round((c.w + 24) * f), Math.round((c.h + 16) * f)] : null;
    });
    await pg.locator('#pista').screenshot({ path: path.join(SAIDA, `${tag}-corrida-${clima}.png`) });
    out['corrida-' + clima] = { recorte: cx };
  }
  await b.close();
  if (erros.length) console.log(`${tag}: erros de página: ${erros.slice(0, 3).join(' | ')}`);
  return out;
}

const antes = await captura(path.resolve(ANTES), 'antes'), depois = await captura(DEPOIS, 'depois');
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const REF = path.join(RAIZ, 'docs', 'arte', 'referencias');
const refs = fs.existsSync(REF) ? fs.readdirSync(REF).filter((f) => f.endsWith('.png')).map((f) => ({ nome: f, src: b64(path.join(REF, f)) })) : [];
const CENAS = [['corrida-sol', 'Corrida, terra do Litoral, sol'], ['corrida-nublado', 'Corrida, nublado'], ['corrida-chuva', 'Corrida, chuva'],
  ['corrida-nevoa', 'Corrida, névoa'], ['estabulo', 'Estábulo'], ['desafio', 'Desafio da Fornalha']];
const dados = CENAS.map(([id, nome]) => ({ id, nome,
  antes: { src: b64(path.join(SAIDA, `antes-${id}.png`)), recorte: (antes[id] || {}).recorte },
  depois: { src: b64(path.join(SAIDA, `depois-${id}.png`)), recorte: (depois[id] || {}).recorte } }));
const CHECK = [
  ['C1', 'Mesma câmera da tela', 'sim', 'nada mudou na câmera'],
  ['C2', 'Luz de cima e da esquerda, por degrau', 'sim', 'sombreado de 4 tons: luz na borda de cima/esquerda, sombra profunda em baixo/direita'],
  ['C3', 'Sombra opaca na rampa do chão, forma da vista, contato', 'sim', 'lateral na corrida e no estábulo; silhueta na diagonal, pixel a pixel, no desafio'],
  ['C4', 'Pelo e crina com 4 tons, hue shift do chão', 'sim', '4 tons por molde (3 nas pelagens que encostam no contorno)'],
  ['C5', 'Contorno na cor do material', 'não (D3)', 'segue o guia §5 vigente: contorno fechado em 2e222f até o OK do Vinicius'],
  ['C6', 'Elemento de contato', 'sim', 'sulcos por raia, poeira no pouso, palha e tufos na frente dos cascos'],
  ['C7', 'Mesmo grão, sem ruído de 1 px', 'sim', 'massas; os tufos têm 1 px de largura (fios)'],
  ['C8', 'LUT de clima no personagem, sem perder degraus; contraluz só emissivo', 'sim', 'LUT por rampa; figura mais branda; contraluz só na Fornalha e no Estábulo'],
  ['C9', 'Resurrect 64, alfa binário', 'sim', 'catraca do alfa parcial no arte-check (fx 20, sprites 12, game 6 fontes antigas)'],
  ['C10', 'Separa do chão em valor', 'sim', 'degrau do piso das raias pela tabela; terra ao sol: L* de 0 para 13,9'],
  ['C11', 'Sem patinar, grade e ritmo comuns', 'parcial', 'só no "galope casado" do DEV (0,25 px); a cadência natural patina ~15 px: decisão pendente'],
  ['C12', 'Registrado em assets.md', 'sim', 'nenhum asset novo nesta etapa (só código)']
];
// (a página do artefato: o publish põe o doctype, o head e o body em volta; aqui vão só o title, o style e o conteúdo)
const html = `<title>Prancha da etapa 0</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* prancha de contato: pares antes × depois em grade de 2 colunas, uma coluna no celular */
:root{--fundo:#eceef2;--texto:#2e222f;--suave:#625565;--cartao:#fbfbfd;--borda:#c9ccd6;--ok:#1e7a4c;--nao:#b33831}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--fundo:#1b1c24;--texto:#ece6ef;--suave:#b0a8bd;--cartao:#262733;--borda:#3e3f52;--ok:#4fd18b;--nao:#f57d4a;color-scheme:dark}}
:root[data-theme="dark"]{--fundo:#1b1c24;--texto:#ece6ef;--suave:#b0a8bd;--cartao:#262733;--borda:#3e3f52;--ok:#4fd18b;--nao:#f57d4a;color-scheme:dark}
body{background:var(--fundo);color:var(--texto);font:15px/1.5 system-ui,sans-serif}
main{max-width:1240px;margin:0 auto;padding-block:16px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1,h2{text-wrap:balance}.tabela{overflow-x:auto}
h1{font-size:22px;margin:8px 0}h2{font-size:17px;margin:24px 0 8px}
.ctl{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 16px}.ctl label{display:flex;gap:6px;align-items:center}
.par{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:720px){.par{grid-template-columns:1fr}}
figure{margin:0;background:var(--cartao);border:1px solid var(--borda);border-radius:8px;padding:8px;min-width:0}
figcaption{font-size:13px;color:var(--suave);margin-bottom:6px}
img,canvas{max-width:100%;image-rendering:pixelated;display:block}
.cinza img,.cinza canvas{filter:grayscale(1)}
.z{margin-top:8px;overflow:auto}
table{border-collapse:collapse;width:100%;background:var(--cartao)}td,th{border:1px solid var(--borda);padding:6px 8px;text-align:left;vertical-align:top}
.s{font-weight:700}.s.sim{color:var(--ok)}.s.nao{color:var(--nao)}
.refs{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:720px){.refs{grid-template-columns:1fr}}
</style><main>
<h1>Prancha de aceite: etapa 0 (integração visual)</h1>
<p>Antes: a base deste ramo na <code>main</code>. Depois: o ramo <code>claude/animacao-ambiente</code> com a etapa 0 (sombra opaca, 4 tons, LUT por rampa, contato com o chão, leitura por valor). Mesma seed (777), mesmo momento da corrida (7 s).</p>
<div class="ctl"><label><input type="checkbox" id="cinza"> Escala de cinza (leitura por valor)</label></div>
<div id="cenas"></div>
<h2>Checklist C1–C12</h2>
<div class="tabela"><table><thead><tr><th>Item</th><th>O quê</th><th>Situação</th><th>Como</th></tr></thead><tbody>
${CHECK.map(([c, o, s, n]) => `<tr><td>${c}</td><td>${o}</td><td class="s ${s === 'sim' ? 'sim' : 'nao'}">${s}</td><td>${n}</td></tr>`).join('')}
</tbody></table></div>
<h2>Referências do Vinicius</h2>
<div class="refs">${refs.map((r) => `<figure><figcaption>${r.nome}</figcaption><img src="${r.src}" alt="${r.nome}"></figure>`).join('')}</div>
</main>
<script>
var DADOS = ${JSON.stringify(dados)};
var raiz = document.getElementById('cenas');
DADOS.forEach(function (c) {
  var h = document.createElement('h2'); h.textContent = c.nome; raiz.appendChild(h);
  var par = document.createElement('div'); par.className = 'par'; raiz.appendChild(par);
  [['antes', 'Antes'], ['depois', 'Depois']].forEach(function (v) {
    var d = c[v[0]], f = document.createElement('figure'), cap = document.createElement('figcaption');
    cap.textContent = v[1] + ' (1×)'; f.appendChild(cap);
    var im = new Image(); im.src = d.src; im.alt = c.nome + ', ' + v[1]; f.appendChild(im);
    if (d.recorte) {
      var cv = document.createElement('canvas'), r = d.recorte; cv.width = r[2] * 3; cv.height = r[3] * 3;
      var z = document.createElement('div'); z.className = 'z'; var c3 = document.createElement('figcaption'); c3.textContent = v[1] + ' (3×)';
      z.appendChild(c3); z.appendChild(cv); f.appendChild(z);
      im.onload = function () { var g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, r[0], r[1], r[2], r[3], 0, 0, cv.width, cv.height); };
    }
    par.appendChild(f);
  });
});
document.getElementById('cinza').addEventListener('change', function (e) { document.body.classList.toggle('cinza', e.target.checked); });
</script>`;
fs.writeFileSync(path.join(SAIDA, 'prancha-etapa0.html'), html);
console.log('prancha: ' + path.join(SAIDA, 'prancha-etapa0.html') + ' (' + Math.round(html.length / 1024) + ' KB)');
