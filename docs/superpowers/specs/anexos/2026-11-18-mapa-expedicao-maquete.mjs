// Maquete do mapa da Expedição (mapa-múndi + mapa de um ginásio), desenhada por código dentro da página do jogo
// (fontes, ícones e a arte dos oponentes são as do jogo). É o rascunho que gerou as duas imagens ao lado deste arquivo
// (spec 2026-11-18-mapa-expedicao-design.md): o desenho da ilha e do ginásio serve de partida para a tela de verdade.
// Uso, da raiz do repositório: node docs/superpowers/specs/anexos/2026-11-18-mapa-expedicao-maquete.mjs <mundo.png> <ginasio.png>
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const { chromium } = createRequire(import.meta.url)('playwright')
const PREVIEW = 'file://' + resolve('prototype/dist/preview.html')
const [,, saidaMundo, saidaGin] = process.argv
const b = await chromium.launch()

async function abre() {
  const pg = await b.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 })
  await pg.goto(PREVIEW)
  await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
  await pg.waitForSelector('#t-estabulo')
  await pg.locator('[data-acao="aba"][data-id="expedicao"]').click()
  await pg.waitForSelector('#t-expedicao')
  return pg
}

// ---------------------------------------------------------------- código comum, injetado na página
const COMUM = `
window.__mapa = (function () {
  function rngDe(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(x, y, s) { var h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function ruido(x, y, esc, s) { var gx = x / esc, gy = y / esc, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    var a = hash(x0, y0, s), b2 = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return a + (b2 - a) * fx + (c - a) * fy + (a - b2 - c + d) * fx * fy; }
  function tela(W, H) { var cv = document.createElement('canvas'), r = window.devicePixelRatio || 1; cv.width = W * 2 * r; cv.height = H * 2 * r; cv.style.cssText = 'width:' + W * 2 + 'px;height:' + H * 2 + 'px;display:block;image-rendering:pixelated';
    var ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.scale(2 * r, 2 * r); return { cv: cv, ctx: ctx, px: function (x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); } }; }
  function img(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.src = src; }); }
  function placa(txt, css) { var d = document.createElement('div'); d.style.cssText = 'position:absolute;margin:0;padding:3px 7px 4px;font-size:12px;line-height:1.25;white-space:nowrap;background:#12221c;color:#f1e9d4;border:2px solid #060d0a;box-shadow:inset 0 0 0 1px #2f4a3e;' + css; d.innerHTML = txt; return d; }
  return { rngDe: rngDe, hash: hash, ruido: ruido, tela: tela, img: img, placa: placa };
})();
`

// ---------------------------------------------------------------- 1) mapa-múndi
const MUNDO = `
(async function () {
  var M = window.__mapa, W = 168, H = 216, T = M.tela(W, H), px = T.px, ctx = T.ctx, x, y;
  // terra: união de três manchas, com a costa irregular pelo ruído; um lago e um rio no leste
  function mancha(cx, cy, rx, ry) { var dx = (x - cx) / rx, dy = (y - cy) / ry; return 1 - Math.sqrt(dx * dx + dy * dy); }
  var terra = [], bioma = [];
  for (y = 0; y < H; y++) { terra.push([]); bioma.push([]); for (x = 0; x < W; x++) {
    var v = Math.max(mancha(84, 118, 58, 78), mancha(104, 50, 46, 36), mancha(56, 164, 46, 40)) + (M.ruido(x, y, 14, 3) - 0.5) * 0.42 + (M.ruido(x, y, 5, 9) - 0.5) * 0.12;
    var lago = mancha(118, 122, 17, 12) + (M.ruido(x, y, 7, 5) - 0.5) * 0.3;
    var rio = Math.abs(y - (122 + Math.sin(x / 7) * 3)) < 2.2 && x > 126;
    var t = v > 0 && !(lago > 0) && !rio;
    terra[y].push(t ? v : 0);
    var seco = (78 - y) / 30 + (M.ruido(x, y, 18, 21) - 0.5) * 0.8, mata = (y - 118) / 30 + (95 - x) / 60 + (M.ruido(x, y, 16, 33) - 0.5) * 0.9, brejo = (x - 96) / 30 - Math.abs(y - 122) / 34 + (M.ruido(x, y, 12, 44) - 0.5) * 0.6;
    bioma[y].push(!t ? 'mar' : seco > 0.55 ? 'sertao' : brejo > 0.5 ? 'brejo' : mata > 0.55 ? 'mata' : 'campo');
  } }
  var COR = { mar: ['#1f5f8f', '#236a9c'], raso: ['#3a8ab8', '#4a9ac4'], areia: ['#e2cf98', '#d6c088'], campo: ['#5fae4a', '#69b852'], mata: ['#3f8f3c', '#48993f'], sertao: ['#c98a48', '#d0954f'], brejo: ['#4f9f78', '#58a880'] };
  function perto(xx, yy, r, quer) { for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) { var X = xx + i, Y = yy + j; if (X < 0 || Y < 0 || X >= W || Y >= H) { if (!quer) return true; continue; } if ((terra[Y][X] > 0) === quer) return true; } return false; }
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    var bm = bioma[y][x], k = (M.hash(x >> 1, y >> 1, 7) > 0.5) ? 1 : 0, c;
    if (bm === 'mar') c = perto(x, y, 3, true) ? COR.raso[k] : COR.mar[k];
    else c = perto(x, y, 2, false) ? COR.areia[k] : COR[bm][k];
    px(x, y, 1, 1, c);
  }
  // ondas no mar
  var r = M.rngDe(11);
  for (var i = 0; i < 90; i++) { var wx = Math.floor(r() * W), wy = Math.floor(r() * H); if (bioma[wy][wx] === 'mar' && !perto(wx, wy, 5, true)) { px(wx, wy, 3, 1, '#4f93bd'); px(wx + 1, wy - 1, 1, 1, '#4f93bd'); } }
  // enfeites: árvores na mata, tufos no campo, cactos e pedras no sertão, juncos no brejo
  function arvore(ax, ay) { px(ax + 1, ay + 4, 1, 2, '#5a3a1c'); px(ax, ay + 1, 3, 3, '#1f6a2c'); px(ax + 1, ay, 1, 1, '#1f6a2c'); px(ax, ay + 1, 1, 1, '#2f8a3a'); px(ax + 1, ay + 1, 1, 1, '#3fa046'); }
  function cacto(ax, ay) { px(ax + 1, ay, 1, 5, '#2f7a3a'); px(ax, ay + 1, 1, 2, '#2f7a3a'); px(ax + 2, ay + 2, 1, 2, '#2f7a3a'); }
  function pedra(ax, ay) { px(ax, ay + 1, 3, 2, '#8a6a4a'); px(ax + 1, ay, 1, 1, '#a88560'); }
  var livres = [];
  for (i = 0; i < 520; i++) { var ex = Math.floor(r() * (W - 4)), ey = Math.floor(r() * (H - 7)), eb = bioma[ey + 4][ex + 1]; if (eb === 'mar' || perto(ex + 1, ey + 4, 3, false)) continue; livres.push([ex, ey, eb, r()]); }
  window.__enfeites = function (zonasLivres) {
    livres.sort(function (p, q) { return p[1] - q[1]; });
    livres.forEach(function (e) { for (var z = 0; z < zonasLivres.length; z++) { var zz = zonasLivres[z]; if (Math.abs(e[0] - zz[0]) < zz[2] && Math.abs(e[1] - zz[1]) < zz[3]) return; }
      if (e[2] === 'mata' && e[3] < 0.85) arvore(e[0], e[1]); else if (e[2] === 'campo' && e[3] < 0.3) arvore(e[0], e[1]); else if (e[2] === 'campo' && e[3] < 0.6) { px(e[0], e[1] + 4, 1, 1, '#3f8f3c'); px(e[0] + 2, e[1] + 5, 1, 1, '#3f8f3c'); }
      else if (e[2] === 'sertao' && e[3] < 0.3) cacto(e[0], e[1]); else if (e[2] === 'sertao' && e[3] < 0.55) pedra(e[0], e[1] + 3); else if (e[2] === 'brejo' && e[3] < 0.5) { px(e[0], e[1] + 2, 1, 3, '#2f6f4a'); px(e[0] + 2, e[1] + 3, 1, 2, '#2f6f4a'); } });
  };
  // o caminho entre os lugares (pontilhado) e os lugares
  var LUG = { casa: [66, 196], grama: [50, 152], agua: [106, 132], fogo: [98, 62] };
  var CAM = [[66, 196], [60, 180], [50, 166], [50, 152], [62, 144], [78, 140], [94, 136], [106, 132], [104, 116], [96, 100], [92, 84], [98, 62]];
  window.__enfeites([[66, 196, 12, 10], [50, 152, 14, 12], [106, 132, 14, 12], [98, 62, 22, 30]].concat(CAM.map(function (p) { return [p[0], p[1], 6, 8]; })));
  // vulcão ao fundo da Fornalha
  for (var vy = 0; vy < 26; vy++) { var meia = 4 + Math.round(vy * 0.72); px(98 - meia, 22 + vy, meia * 2, 1, vy < 4 ? '#5a2a1a' : (vy % 5 === 0 ? '#6f4a34' : '#7f553a')); }
  px(94, 21, 8, 2, '#ff6a1a'); px(96, 20, 4, 1, '#ffb020'); px(97, 23, 2, 8, '#ff6a1a'); px(99, 28, 1, 6, '#ff8a2a');
  [[92, 12, 5], [98, 7, 6], [105, 3, 5]].forEach(function (f) { px(f[0], f[1], f[2], 3, '#b9b0a8'); px(f[0] + 1, f[1] - 1, f[2] - 2, 1, '#cfc8c0'); });
  function passo(ax, ay, bx, by, feito) { var d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(d / 4)); for (var q = 0; q <= n; q++) { var X = Math.round(ax + (bx - ax) * q / n), Y = Math.round(ay + (by - ay) * q / n); px(X - 1, Y - 1, 3, 3, '#3a2a18'); px(X - 1, Y - 1, 2, 2, feito ? '#ffe9a8' : '#b8a888'); } }
  for (i = 0; i < CAM.length - 1; i++) passo(CAM[i][0], CAM[i][1], CAM[i + 1][0], CAM[i + 1][1], i < 7);
  // os ginásios: uma arena pequena na cor do tipo; a casa: um estábulo
  function arena(cx, cy, cor, escura, fechado) { px(cx - 8, cy - 3, 16, 8, '#2a1a12'); px(cx - 7, cy - 2, 14, 6, fechado ? '#6a6a6a' : cor); px(cx - 7, cy - 2, 14, 2, fechado ? '#8a8a8a' : escura); px(cx - 2, cy, 4, 4, '#2a1a12'); px(cx - 9, cy - 5, 18, 2, '#2a1a12'); px(cx - 8, cy - 6, 16, 2, fechado ? '#9a9a9a' : '#f1e9d4'); px(cx - 1, cy - 12, 1, 6, '#2a1a12'); px(cx, cy - 12, 5, 3, fechado ? '#8a8a8a' : cor); }
  arena(LUG.grama[0], LUG.grama[1], '#86d86a', '#5fae4a', false); arena(LUG.agua[0], LUG.agua[1], '#62b8ff', '#3a8ab8', false); arena(LUG.fogo[0], LUG.fogo[1], '#ff8a4c', '#c9562a', true);
  px(LUG.casa[0] - 6, LUG.casa[1] - 4, 12, 8, '#2a1a12'); px(LUG.casa[0] - 5, LUG.casa[1] - 3, 10, 6, '#a5823f'); px(LUG.casa[0] - 7, LUG.casa[1] - 7, 14, 4, '#7a3a2a'); px(LUG.casa[0] - 2, LUG.casa[1] - 1, 4, 4, '#2a1a12');
  // "você está aqui": um marcador amarelo sobre o ginásio aberto
  var vx = LUG.agua[0], vy2 = LUG.agua[1] - 22; px(vx - 3, vy2 - 1, 7, 7, '#1a1405'); px(vx - 2, vy2, 5, 5, '#f2c230'); px(vx - 1, vy2 + 6, 3, 1, '#1a1405'); px(vx, vy2 + 7, 1, 1, '#1a1405'); px(vx - 1, vy2 + 5, 3, 1, '#f2c230'); px(vx, vy2 + 6, 1, 1, '#f2c230');

  var I = window.__ICONES || {};
  function ic(n) { return I[n] ? '<img src="' + I[n] + '" style="width:16px;height:16px;image-rendering:pixelated;vertical-align:-3px;margin-right:4px">' : ''; }
  var sec = document.querySelector('#tela .tela'), palco = document.createElement('div');
  palco.style.cssText = 'position:relative;width:336px;margin:0 auto;box-shadow:0 0 0 2px #060d0a';
  palco.appendChild(T.cv);
  palco.appendChild(M.placa(ic('ins-grama') + '<b>Capoeira</b> · vencido ✔', 'left:' + (LUG.grama[0] * 2) + 'px;top:' + (LUG.grama[1] * 2 + 14) + 'px;transform:translateX(-50%);border-color:#86d86a'));
  palco.appendChild(M.placa(ic('ins-agua') + '<b>Remanso</b> · 2 de 5', 'left:' + (LUG.agua[0] * 2) + 'px;top:' + (LUG.agua[1] * 2 + 14) + 'px;transform:translateX(-50%);border-color:#f2c230'));
  palco.appendChild(M.placa('🔒 <b>Fornalha</b> · vença o Remanso', 'left:' + (LUG.fogo[0] * 2) + 'px;top:' + (LUG.fogo[1] * 2 + 14) + 'px;transform:translateX(-50%);color:#b3c2b2'));
  palco.appendChild(M.placa('Seu estábulo', 'left:' + (LUG.casa[0] * 2 + 18) + 'px;top:' + (LUG.casa[1] * 2 - 14) + 'px;font-size:11px'));
  var h = sec.querySelector('h1'); sec.innerHTML = ''; if (h) sec.appendChild(h);
  var nota = document.createElement('p'); nota.className = 'nota'; nota.style.cssText = 'margin:0 0 6px'; nota.textContent = 'Toque num ginásio para entrar. Vença o líder para abrir o próximo.';
  sec.appendChild(nota); sec.appendChild(palco);
})();
`

// ---------------------------------------------------------------- 2) mapa de um ginásio (Remanso, com 2 de 5 vencidos)
const GINASIO = `
(async function () {
  var M = window.__mapa, W = 168, H = 208, T = M.tela(W, H), px = T.px, ctx = T.ctx, x, y;
  var TR = window.__TREINADORES || {};
  var nomes = ['Recruta Orvalho', 'Cabo Goteira', 'Sargento Correnteza', 'Tenente Cacimba', 'Mestre Aguaceiro'];
  var ids = ['recruta-orvalho', 'cabo-goteira', 'sargento-correnteza', 'tenente-cacimba', 'mestre-aguaceiro'];
  var niveis = ['Nv 14', 'Nv 16', 'Nv 18', 'Nv 20', 'Nv 22'];
  // margem de rio: água em volta, um caminho de terra em S com cinco tablados de madeira
  var POS = [[44, 176], [122, 144], [46, 108], [122, 76], [84, 38]];
  for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
    var k = (M.hash(x >> 1, y >> 1, 5) > 0.5) ? 1 : 0, borda = M.ruido(x, y, 12, 8) * 10;
    var agua = x < 10 + borda || x > W - 12 - borda * 0.8;
    px(x, y, 1, 1, agua ? (k ? '#2f7fa8' : '#3a8ab8') : (k ? '#4f9f78' : '#58a880'));
  }
  var r = M.rngDe(4);
  for (var i = 0; i < 60; i++) { var jx = Math.floor(r() * W), jy = Math.floor(r() * H); if (jx > 24 && jx < W - 26) { px(jx, jy, 1, 3, '#2f6f4a'); px(jx + 2, jy + 1, 1, 2, '#2f6f4a'); } else { px(jx, jy, 3, 1, '#7fc8e8'); } }
  function passo(ax, ay, bx, by, feito) { var d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(d / 5)); for (var q = 0; q <= n; q++) { var X = Math.round(ax + (bx - ax) * q / n), Y = Math.round(ay + (by - ay) * q / n); px(X - 2, Y - 1, 5, 4, '#3a2a18'); px(X - 2, Y - 1, 4, 3, feito ? '#ffe9a8' : '#a89878'); } }
  var ENT = [84, 206];
  passo(ENT[0], ENT[1], POS[0][0], POS[0][1], true);
  for (i = 0; i < 4; i++) passo(POS[i][0], POS[i][1], POS[i + 1][0], POS[i + 1][1], i < 2);
  function tablado(cx, cy, rx, lider) { for (var j = -4; j <= 4; j++) { var w = Math.round(rx * Math.sqrt(1 - (j * j) / 20)); px(cx - w, cy + j, w * 2, 1, j < 0 ? (lider ? '#c9a24a' : '#9a7a4a') : '#5a4226'); } }
  var estado = ['feito', 'feito', 'proximo', 'fechado', 'fechado'];
  POS.forEach(function (p, n) { tablado(p[0], p[1], n === 4 ? 26 : 18, n === 4); });
  // os oponentes (arte do jogo, 64×64, desenhada em pixel fino sobre o mapa); os fechados aparecem em silhueta
  var imgs = await Promise.all(ids.map(function (id) { return TR[id] ? M.img(TR[id]) : null; }));
  var r2 = window.devicePixelRatio || 1;
  POS.forEach(function (p, n) {
    var im = imgs[n]; if (!im) return;
    var tam = n === 4 ? 40 : 32, dx = p[0] - tam / 2, dy = p[1] - tam + 3;
    if (estado[n] === 'fechado') {
      var tmp = document.createElement('canvas'); tmp.width = 64; tmp.height = 64; var tc = tmp.getContext('2d'); tc.drawImage(im, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = '#12221c'; tc.fillRect(0, 0, 64, 64);
      ctx.drawImage(tmp, dx, dy, tam, tam);
    } else ctx.drawImage(im, dx, dy, tam, tam);
    if (estado[n] === 'feito') { px(p[0] + 8, p[1] - 30, 9, 9, '#1a1405'); px(p[0] + 9, p[1] - 29, 7, 7, '#7be07a'); px(p[0] + 10, p[1] - 26, 2, 2, '#1a1405'); px(p[0] + 12, p[1] - 25, 1, 1, '#1a1405'); px(p[0] + 13, p[1] - 27, 1, 2, '#1a1405'); px(p[0] + 14, p[1] - 28, 1, 1, '#1a1405'); }
    if (estado[n] === 'proximo') { var ax = p[0], ay = p[1] - 40; px(ax - 3, ay - 1, 7, 7, '#1a1405'); px(ax - 2, ay, 5, 5, '#f2c230'); px(ax - 1, ay + 5, 3, 1, '#f2c230'); px(ax, ay + 6, 1, 1, '#f2c230'); }
  });
  var sec = document.querySelector('#tela .tela'), palco = document.createElement('div');
  palco.style.cssText = 'position:relative;width:336px;margin:0 auto;box-shadow:0 0 0 2px #060d0a';
  palco.appendChild(T.cv);
  POS.forEach(function (p, n) {
    var e = estado[n], esq = p[0] < 84;
    var txt = e === 'fechado' ? '🔒 ' + (n === 4 ? '<b>Líder</b>' : '???') : '<b>' + nomes[n] + '</b><br><span style="color:#b3c2b2">' + (e === 'feito' ? 'Vencido' : niveis[n] + ' · 40 de Ouro') + '</span>';
    var css = 'left:' + (p[0] * 2) + 'px;top:' + (p[1] * 2 + 12) + 'px;transform:translateX(-50%);text-align:center;' + (e === 'proximo' ? 'border-color:#f2c230;' : e === 'fechado' ? 'color:#b3c2b2;' : '');
    palco.appendChild(M.placa(txt, css));
  });
  sec.innerHTML = '<button type="button" class="btn btn--pequeno">Voltar ao mapa</button><h1 class="titulo titulo--tela" style="margin:6px 0">Ginásio do Remanso</h1><p class="nota" style="margin:0 0 6px">Toque no próximo oponente para desafiar.</p>';
  sec.appendChild(palco);
})();
`

const p1 = await abre()
await p1.evaluate(COMUM); await p1.evaluate(MUNDO); await p1.waitForTimeout(400)
await p1.evaluate(() => window.scrollTo(0, 0))
await p1.screenshot({ path: saidaMundo })
const p2 = await abre()
await p2.evaluate(COMUM); await p2.evaluate(GINASIO); await p2.waitForTimeout(600)
await p2.evaluate(() => window.scrollTo(0, 0))
await p2.screenshot({ path: saidaGin })
await b.close()
console.log('ok')
