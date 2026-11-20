// prototype/tools/arte-ginasios.mjs — etapa 5 da direção de arte: o fundo da cena do desafio de cada ginásio (Fornalha,
// Remanso, Capoeira). Hoje a cena (game.js, drawGinCena) é de 160 × 112 com parede e piso desenhados em retângulos e os
// cavalos a 1,5×. Na escala do guia (cavalos 1:1, treinadores de ~40 px) ela passa a 256 × 160, a largura de referência
// da coluna em retrato, e o fundo vem em duas camadas pela Retro Diffusion:
//   parede  256 × 64, a parede do fundo vista de lado (rd_core__platformer, o estilo das camadas das regiões);
//   piso    256 × 96, o chão visto de cima em ângulo (rd_plus__textured, a textura do chão da amostra).
// (Primeira versão, `--versao paredes`. A atual é `--versao aberta`, o padrão: uma arena ao ar livre por ginásio; ver ARENA.)
// Os dois palcos (o tablado de cada cavalo) e a luz continuam em código, para casar com o lugar dos cavalos.
// Paleta mestra (Resurrect 64) como input_palette; depois, quantização e alfa binário por código.
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/arte-ginasios.mjs [--custo] [--gerar] [--teto-usd N]
//   Sem --gerar é SEMPRE dry-run: lista as chamadas e a estimativa da tabela, sem rede. --custo pergunta à RD o preço de
//   cada chamada (check_cost, gratuito) sem gerar. Pedido já gravado em raw/ é reaproveitado.
// Saída: crus em prototype/assets/arte/raw/ginasios/, candidatos em prototype/assets/arte/ginasios/<gin>/<camada>-<n>.png
// e a folha prototype/arte/folha-ginasios.html (cada combinação com os palcos, os cavalos e o treinador na escala).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, estado } from './pixellab-comum.mjs';
import { rdGerar, rdCusto, rdSaldo } from './rd-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, REGIOES, quantizar, imagemPaleta, conferir } from './arte-paleta.mjs';

const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte');
const ARQ_GASTO = path.join(DIR, 'raw', 'gasto.json');
const PALETA = encodePng(imagemPaleta(RESURRECT64)).toString('base64');
const PRECO = { rd_core__platformer: 0.10, rd_plus__textured: 0.06 };   // US$ por imagem (tabela da pesquisa; --custo confere)
const GIN = {
  fogo: { nome: 'Ginásio da Fornalha', seed: 9701,
    parede: 'interior back wall of a fire gym hall: dark red brick wall with two glowing furnace openings, iron braziers with '
      + 'flames, hanging red banners with a flame emblem, warm orange light',
    piso: 'floor of a fire gym hall: worn dark red clay tiles with soot, scattered embers, warm light' },
  agua: { nome: 'Ginásio do Remanso', seed: 9711,
    parede: 'interior back wall of a water gym hall: smooth blue grey stone wall with small waterfalls pouring from carved '
      + 'stone spouts into a narrow water channel along the base, blue tiles, hanging blue banners with a drop emblem, cool light',
    piso: 'floor of a water gym hall: wet blue stone slabs with shallow puddles reflecting light, cool light' },
  grama: { nome: 'Ginásio da Capoeira', seed: 9721,
    parede: 'interior back wall of a grass gym hall: rustic wooden plank wall covered with climbing vines and leaves, hanging '
      + 'flower pots, green banners with a leaf emblem, sunlight from small windows',
    piso: 'floor of a grass gym hall: packed earth floor with patches of short grass and wooden boards, soft daylight' },
};
// Versão aberta (2026-11-20, o Vinicius: "use cenário aberto nos ginásios"): parede + piso não casaram (cada piso veio
// como uma sala inteira em perspectiva). Agora uma imagem só por ginásio: a arena ao ar livre inteira em 256 × 160, chão
// e fundo vistos do mesmo ângulo, com a paleta da região mais próxima (32 cores, a mesma das corridas).
const ARENA = {
  fogo: { regiao: 'sertao', seed: 9731,
    prompt: 'open-air fire gym arena in the dry backlands: a wide ring of packed red clay ground with a low stone border, '
      + 'stone braziers with flames at the edges, red banners with a flame emblem on poles, rocky orange hills and a forge '
      + 'chimney smoking in the distance under a warm late afternoon sky' },
  agua: { regiao: 'litoral', seed: 9741,
    prompt: 'open-air water gym arena on a calm river backwater: a wide ring of firm pale sand with a low wooden border, '
      + 'wooden posts with blue banners with a drop emblem, calm blue water and a small waterfall behind, palm trees and '
      + 'distant green hills under a clear blue sky' },
  grama: { regiao: 'cerrado', seed: 9751,
    prompt: 'open-air grass gym arena in a forest clearing: a wide ring of short green grass with a low log border, '
      + 'wooden posts with green banners with a leaf emblem, young trees and dense shrubs around the clearing, twisted '
      + 'savanna trees in the distance under a soft daylight sky' },
};
// escolhas do Vinicius (2026-11-20): a arena de cada ginásio; `--montar` copia para prototype/assets/arte/ginasios/finais/<gin>.png
export const ESCOLHAS = { fogo: 1, agua: 0, grama: 2 };
const ARENA_EXTRA = 'empty arena with no characters and no people, seen from a raised camera at a three-quarter angle, the ground '
  + 'fills the bottom two thirds of the image and is mostly open and flat, the scenery fills the top third, pixel art game battle background';
const CAMADAS = {
  parede: { estilo: 'rd_core__platformer', w: 256, h: 64, n: 2, extra: 'side view, flat front facing wall filling the whole image, no floor, no characters, no people' },
  piso: { estilo: 'rd_plus__textured', w: 256, h: 96, n: 2, extra: 'seen from above at an angle, even texture filling the whole image, no characters, no objects in the middle' },
};

function args() {
  const a = { gerar: false, custo: false, tetoUsd: null, versao: 'aberta' };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--gerar') a.gerar = true;
    else if (v[i] === '--montar') a.montar = true;
    else if (v[i] === '--custo') a.custo = true;
    else if (v[i] === '--versao') a.versao = v[++i];
    else if (v[i] === '--teto-usd') a.tetoUsd = Number(v[++i]);
    else throw new Error('opção desconhecida: ' + v[i]);
  }
  return a;
}
const lerJson = (f, p) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : p);
const assinatura = p => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);
const semB64 = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)));

function chamadas(versao) {
  if (versao === 'aberta') return Object.entries(ARENA).map(([g, A]) => ({
    gin: g, camada: 'arena', base: `${g}-arena`, estimativa: 0.06 * 4,
    pedido: { prompt: `${A.prompt}, ${ARENA_EXTRA}`, prompt_style: 'rd_plus__default', width: 256, height: 160, num_images: 4,
      seed: A.seed, input_palette: encodePng(imagemPaleta(REGIOES[A.regiao])).toString('base64') },
  }));
  if (versao !== 'paredes') throw new Error('versão desconhecida: ' + versao);
  return Object.entries(GIN).flatMap(([g, G]) => Object.entries(CAMADAS).map(([c, C], k) => ({
    gin: g, camada: c, base: `${g}-${c}`, estimativa: PRECO[C.estilo] * C.n,
    pedido: { prompt: `${G[c]}, ${C.extra}, pixel art game background`, prompt_style: C.estilo, width: C.w, height: C.h,
      num_images: C.n, seed: G.seed + k, input_palette: PALETA },
  })));
}

// --- montagem (sem rede): a parede vem com fundo branco (o estilo platformer desenha um objeto): o branco ligado à borda
// vira transparente e a parede é recortada; a cena 256 × 160 junta piso, parede, os palcos, um cavalo de exemplo de cada
// lado (o molde do retrato, pintado de alazão) e o treinador escolhido do ginásio, tudo 1:1
const rgb = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
function chaveBranco(img) {
  const W = img.width, H = img.height, p = new Uint8Array(img.rgba), viu = new Uint8Array(W * H), fila = [];
  const claro = j => p[j * 4 + 3] && p[j * 4] > 225 && p[j * 4 + 1] > 225 && p[j * 4 + 2] > 225;
  for (let x = 0; x < W; x++) fila.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) fila.push(y * W, y * W + W - 1);
  while (fila.length) {
    const j = fila.pop();
    if (viu[j] || !claro(j)) continue;
    viu[j] = 1; p[j * 4 + 3] = 0;
    const x = j % W, y = (j / W) | 0;
    if (x > 0) fila.push(j - 1); if (x < W - 1) fila.push(j + 1); if (y > 0) fila.push(j - W); if (y < H - 1) fila.push(j + W);
  }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p[(y * W + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) out.set(p.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x1 + 1) * 4), y * w * 4);
  return { width: w, height: h, rgba: out };
}
function colar(dst, src, ox, oy, espelha = false) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const sx = espelha ? src.width - 1 - x : x, i = (y * src.width + sx) * 4, X = ox + x, Y = oy + y;
    if (!src.rgba[i + 3] || X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
    dst.rgba.set(src.rgba.subarray(i, i + 4), (Y * dst.width + X) * 4);
  }
}
const PALCO = { fogo: ['9e4539', '6e2727'], agua: ['4d65b4', '323353'], grama: ['a26a35', '6e4a2a'] };
const ALAZAO = { 25: '2e222f', 50: '6e2727', 75: '9e4539', 100: 'cd683d', 125: 'e6904e', 150: 'fbb954', 175: 'fbb954', 200: 'fbb954', 225: 'fbb954' };
function cavalo() {
  const m = decodePng(fs.readFileSync(path.join(RAIZ, 'prototype', 'assets', 'pixellab', 'molde-padrao-chamas-retrato.png'))), p = new Uint8Array(m.rgba);
  for (let i = 0; i < p.length; i += 4) { const c = ALAZAO[p[i]]; if (!c || !p[i + 3]) p[i + 3] = 0; else p.set(rgb(c), i); }
  return { width: m.width, height: m.height, rgba: p };
}
function compor(g, parede, piso, treinador, arena = null) {
  const W = 256, H = 160, cena = { width: W, height: H, rgba: new Uint8Array(W * H * 4) }, fundo = rgb('2e222f');
  for (let i = 0; i < W * H; i++) cena.rgba.set([...fundo, 255], i * 4);
  if (arena) colar(cena, arena, 0, 0);
  else { colar(cena, piso, 0, 64); colar(cena, parede, Math.floor((W - parede.width) / 2), 64 - parede.height); }
  const palco = (cx, cy, rx, ry) => {
    for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry))), c = rgb(PALCO[g][y < 0 ? 0 : 1]);
      for (let x = cx - w; x < cx + w; x++) cena.rgba.set([...c, 255], ((cy + y) * W + x) * 4); }
  };
  palco(180, 102, 46, 6); palco(76, 150, 50, 6);
  const cv = cavalo(), PE = 57;
  if (treinador) colar(cena, treinador, 202, 100 - treinador.height);
  colar(cena, cv, 144, 102 - PE, true);   // o do oponente, virado para a esquerda
  colar(cena, cv, 40, 150 - PE);
  return cena;
}
const LIDER = { fogo: 'capita-labareda', agua: 'mestre-aguaceiro', grama: 'dona-capineira' };
function montar() {
  const F = path.join(DIR, 'ginasios', 'finais');
  fs.mkdirSync(F, { recursive: true });
  for (const [g, n] of Object.entries(ESCOLHAS)) {
    const arq = path.join(DIR, 'ginasios', g, `arena-${n}.png`);
    if (fs.existsSync(arq)) fs.copyFileSync(arq, path.join(F, g + '.png'));
  }
  for (const g of Object.keys(GIN)) {
    const d = path.join(DIR, 'ginasios', g);
    if (!fs.existsSync(d)) continue;
    const tr = path.join(DIR, 'treinadores', 'finais', LIDER[g] + '-corpo.png'), treinador = fs.existsSync(tr) ? decodePng(fs.readFileSync(tr)) : null;
    for (const n of [0, 1, 2, 3]) {
      const arq = path.join(d, `arena-${n}.png`);
      if (fs.existsSync(arq)) fs.writeFileSync(path.join(d, `cena-arena-${n}.png`), encodePng(compor(g, null, null, treinador, decodePng(fs.readFileSync(arq)))));
    }
    for (const pa of [0, 1]) {
      const arq = path.join(d, `parede-${pa}.png`);
      if (!fs.existsSync(arq)) continue;
      const parede = chaveBranco(decodePng(fs.readFileSync(arq)));
      fs.writeFileSync(path.join(d, `parede-${pa}-recorte.png`), encodePng(parede));
      for (const pi of [0, 1]) {
        const piso = decodePng(fs.readFileSync(path.join(d, `piso-${pi}.png`)));
        fs.writeFileSync(path.join(d, `cena-p${pa}-c${pi}.png`), encodePng(compor(g, parede, piso, treinador)));
      }
    }
  }
}

function folha() {
  const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const sec = Object.entries(GIN).map(([g, G]) => {
    const d = path.join(DIR, 'ginasios', g);
    if (!fs.existsSync(d)) return '';
    const fs_ = fs.readdirSync(d).filter(f => f.startsWith('cena-')).sort((x, y) => (y.includes('arena') - x.includes('arena')) || x.localeCompare(y));
    return `<h2>${G.nome}</h2><div class="grade">` + fs_.map(f => `<figure><img src="${uri(path.join(d, f))}" style="width:512px"><figcaption>${f.replace('.png', '').replace(/cena-p(\d)-c(\d)/, 'parede $1 · piso $2').replace(/cena-arena-(\d)/, 'aberta $1')}</figcaption></figure>`).join('') + '</div>';
  }).join('');
  fs.writeFileSync(path.join(RAIZ, 'prototype', 'arte', 'folha-ginasios.html'), `<title>Fundos dos ginásios</title>
<style>:root{color-scheme:dark} body{background:#2e222f;color:#c7dcd0;font:14px monospace;margin:0} .p{padding:16px}
h2{color:#f9c22b;font-weight:normal} .grade{display:flex;flex-wrap:wrap;gap:8px} figure{margin:0} img{image-rendering:pixelated;display:block;max-width:100%}
figcaption{color:#9babb2;font-size:12px}</style><div class="p"><h1 style="color:#f9c22b;font-weight:normal">Cena do desafio 256×160 · 2×</h1><p style="color:#9babb2">Piso e parede da Retro Diffusion; palcos em código; cavalo de exemplo (alazão) dos dois lados e o líder do ginásio, tudo 1:1.</p>${sec}</div>`);
}

async function main() {
  if (process.argv.includes('--montar')) { montar(); folha(); console.log('cenas montadas · folha em prototype/arte/folha-ginasios.html'); return; }
  const a = args(), lista = chamadas(a.versao), total = lista.reduce((s, c) => s + c.estimativa, 0), teto = a.tetoUsd ?? Math.ceil(total * 100 + 20) / 100;
  console.log(`Fundos dos ginásios (versão ${a.versao}): ${lista.length} chamadas na Retro Diffusion, ${lista.reduce((s, c) => s + c.pedido.num_images, 0)} imagens, ~US$ ${total.toFixed(2)} pela tabela. Teto: US$ ${teto.toFixed(2)}`);
  for (const c of lista) console.log(`  ${c.base}  ${c.pedido.prompt_style} ${c.pedido.width}×${c.pedido.height} ×${c.pedido.num_images}, seed ${c.pedido.seed}, ~US$ ${c.estimativa.toFixed(2)}`);
  if (!a.gerar && !a.custo) { console.log('\nDry-run: nada foi gerado nem consultado. --custo pergunta o preço à RD (gratuito); --gerar gasta.'); return; }
  estado.redeLiberada = true;
  if (!a.gerar) {
    let s = 0;
    for (const c of lista) { const q = await rdCusto(c.pedido); s += q.balance_cost; console.log(`  ${c.base}: US$ ${q.balance_cost}`); }
    console.log(`Total pela RD: US$ ${s.toFixed(2)} · saldo US$ ${await rdSaldo()}`);
    return;
  }
  const gasto = lerJson(ARQ_GASTO, { pl: 0, usd: 0, chamadas: [] });
  let usd = 0;
  console.log('Saldo da Retro Diffusion antes: US$', await rdSaldo());
  for (const c of lista) {
    const raw = path.join(DIR, 'raw', 'ginasios'), fim = path.join(DIR, 'ginasios', c.gin);
    fs.mkdirSync(raw, { recursive: true }); fs.mkdirSync(fim, { recursive: true });
    const arqJson = path.join(raw, c.base + '.json'), assin = assinatura(c.pedido), salvo = lerJson(arqJson, null);
    let pngs;
    if (salvo && salvo.assinatura === assin) pngs = salvo.arquivos.map(f => fs.readFileSync(path.join(raw, f)));
    else {
      const q = await rdCusto(c.pedido);
      if (usd + q.balance_cost > teto + 1e-9) { console.log(`  ${c.base}: PAROU (US$ ${q.balance_cost} passaria do teto)`); break; }
      const r = await rdGerar(c.pedido);
      pngs = r.base64_images.map(b => Buffer.from(b, 'base64'));
      const cobrado = r.balance_cost ?? q.balance_cost;
      usd += cobrado; gasto.usd += cobrado; gasto.chamadas.push({ base: `ginasios/${c.base}`, usd: cobrado, data: new Date().toISOString() });
      const arquivos = pngs.map((b, i) => { const f = `${c.base}-${i}.png`; fs.writeFileSync(path.join(raw, f), b); return f; });
      fs.writeFileSync(arqJson, JSON.stringify({ assinatura: assin, pedido: semB64(c.pedido), arquivos }, null, 2));
      fs.writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2));
      console.log(`  ${c.base}: US$ ${cobrado} [total US$ ${usd.toFixed(2)}/${teto.toFixed(2)}]`);
    }
    const pal = c.camada === 'arena' ? REGIOES[ARENA[c.gin].regiao] : RESURRECT64;
    pngs.forEach((b, i) => {
      const img = quantizar(decodePng(b), pal), k = conferir(img, pal);
      fs.writeFileSync(path.join(fim, `${c.camada}-${i}.png`), encodePng(img));
      console.log(`    ${c.camada}-${i}: ${img.width}×${img.height}, fora ${k.fora}, alfa ${k.alfa}, falso ${k.falso ? 'SIM' : 'não'}`);
    });
  }
  console.log('Saldo da Retro Diffusion depois: US$', await rdSaldo());
  montar(); folha();
  console.log(`Gasto: US$ ${usd.toFixed(2)} · folha em prototype/arte/folha-ginasios.html`);
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
