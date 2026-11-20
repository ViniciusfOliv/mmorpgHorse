// prototype/tools/arte-ginasios.mjs — etapa 5 da direção de arte: o fundo da cena do desafio de cada ginásio (Fornalha,
// Remanso, Capoeira). Hoje a cena (game.js, drawGinCena) é de 160 × 112 com parede e piso desenhados em retângulos e os
// cavalos a 1,5×. Na escala do guia (cavalos 1:1, treinadores de ~40 px) ela passa a 256 × 160, a largura de referência
// da coluna em retrato, e o fundo vem em duas camadas pela Retro Diffusion:
//   parede  256 × 64, a parede do fundo vista de lado (rd_core__platformer, o estilo das camadas das regiões);
//   piso    256 × 96, o chão visto de cima em ângulo (rd_plus__textured, a textura do chão da amostra).
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
import { RESURRECT64, quantizar, imagemPaleta, conferir } from './arte-paleta.mjs';

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
const CAMADAS = {
  parede: { estilo: 'rd_core__platformer', w: 256, h: 64, n: 2, extra: 'side view, flat front facing wall filling the whole image, no floor, no characters, no people' },
  piso: { estilo: 'rd_plus__textured', w: 256, h: 96, n: 2, extra: 'seen from above at an angle, even texture filling the whole image, no characters, no objects in the middle' },
};

function args() {
  const a = { gerar: false, custo: false, tetoUsd: null };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--gerar') a.gerar = true;
    else if (v[i] === '--custo') a.custo = true;
    else if (v[i] === '--teto-usd') a.tetoUsd = Number(v[++i]);
    else throw new Error('opção desconhecida: ' + v[i]);
  }
  return a;
}
const lerJson = (f, p) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : p);
const assinatura = p => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);
const semB64 = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)));

function chamadas() {
  return Object.entries(GIN).flatMap(([g, G]) => Object.entries(CAMADAS).map(([c, C], k) => ({
    gin: g, camada: c, base: `${g}-${c}`, estimativa: PRECO[C.estilo] * C.n,
    pedido: { prompt: `${G[c]}, ${C.extra}, pixel art game background`, prompt_style: C.estilo, width: C.w, height: C.h,
      num_images: C.n, seed: G.seed + k, input_palette: PALETA },
  })));
}

function folha() {
  const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const sec = Object.entries(GIN).map(([g, G]) => {
    const d = path.join(DIR, 'ginasios', g);
    if (!fs.existsSync(d)) return '';
    const fs_ = fs.readdirSync(d).filter(f => f.endsWith('.png')).sort();
    return `<h2>${G.nome}</h2><div class="grade">` + fs_.map(f => `<figure><img src="${uri(path.join(d, f))}" style="width:512px"><figcaption>${f.replace('.png', '')}</figcaption></figure>`).join('') + '</div>';
  }).join('');
  fs.writeFileSync(path.join(RAIZ, 'prototype', 'arte', 'folha-ginasios.html'), `<title>Fundos dos ginásios</title>
<style>:root{color-scheme:dark} body{background:#2e222f;color:#c7dcd0;font:14px monospace;margin:0} .p{padding:16px}
h2{color:#f9c22b;font-weight:normal} .grade{display:flex;flex-wrap:wrap;gap:8px} figure{margin:0} img{image-rendering:pixelated;display:block;max-width:100%}
figcaption{color:#9babb2;font-size:12px}</style><div class="p"><h1 style="color:#f9c22b;font-weight:normal">Fundos dos ginásios · 2×</h1>${sec}</div>`);
}

async function main() {
  const a = args(), lista = chamadas(), total = lista.reduce((s, c) => s + c.estimativa, 0), teto = a.tetoUsd ?? Math.ceil(total * 100 + 20) / 100;
  console.log(`Fundos dos ginásios: ${lista.length} chamadas na Retro Diffusion, ${lista.reduce((s, c) => s + c.pedido.num_images, 0)} imagens, ~US$ ${total.toFixed(2)} pela tabela. Teto: US$ ${teto.toFixed(2)}`);
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
    pngs.forEach((b, i) => {
      const img = quantizar(decodePng(b), RESURRECT64), k = conferir(img, RESURRECT64);
      fs.writeFileSync(path.join(fim, `${c.camada}-${i}.png`), encodePng(img));
      console.log(`    ${c.camada}-${i}: ${img.width}×${img.height}, fora ${k.fora}, alfa ${k.alfa}, falso ${k.falso ? 'SIM' : 'não'}`);
    });
  }
  console.log('Saldo da Retro Diffusion depois: US$', await rdSaldo());
  folha();
  console.log(`Gasto: US$ ${usd.toFixed(2)} · folha em prototype/arte/folha-ginasios.html`);
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
