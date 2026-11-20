// prototype/tools/arte-telas.mjs — etapa 6 da direção de arte: as cenas das abas e os mapas das trilhas dos ginásios.
//   cenas  uma cena 256 × 160 no topo de cada aba (Estábulo, Haras, Loja, Expedição), atrás do título e do primeiro
//          cartão, escurecida e terminando em pontilhado no fundo da interface (por código). No Estábulo, o cavalo ativo
//          fica parado e respirando na cena, no molde 1:1 (por código). Retro Diffusion rd_plus__default (o estilo das
//          arenas dos ginásios), 4 opções por aba.
//   mapas  o terreno de cada trilha de ginásio visto de cima, 256 × 384, sem caminho nem marcas: o caminho em zigue-zague
//          e as 5 paradas (com o busto de cada oponente) são desenhados por código, de baixo para cima, como a trilha de
//          hoje. PixelLab /create-image-pixen (o que fez os horizontes das regiões), 2 opções por ginásio.
// Paleta: as cenas na Resurrect 64; os mapas na paleta da região de cada ginásio (a mesma das arenas).
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/arte-telas.mjs --lote cenas|mapas [--custo] [--gerar] [--teto-usd N] [--teto-pl N]
//   Sem --gerar é SEMPRE dry-run, sem rede. --custo (só cenas) pergunta o preço à RD (check_cost, gratuito).
//   Pedido já gravado em raw/ é reaproveitado. No PixelLab, só a cota do plano (aborta se uma resposta cobrar US$).
// Saída: crus em prototype/assets/arte/raw/telas/, candidatos em prototype/assets/arte/telas/<lote>/<id>-<n>.png e a folha
// prototype/arte/folha-telas.html.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, estado, chamar, saldo, fmt } from './pixellab-comum.mjs';
import { rdGerar, rdCusto, rdSaldo } from './rd-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, REGIOES, quantizar, imagemPaleta, conferir } from './arte-paleta.mjs';

const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte');
const ARQ_GASTO = path.join(DIR, 'raw', 'gasto.json');
const CENA_EXTRA = 'no people, no animals, no text, the bottom half of the image is open floor or ground with nothing on it, '
  + 'soft even light, pixel art game background';
const CENAS = {
  estabulo: { seed: 9801, prompt: 'interior of a cozy wooden horse stable: a row of wooden stalls with half doors along the back wall, '
    + 'hay bales, bridles and saddles hanging on pegs, oil lanterns, warm light, straw on the floor' },
  haras: { seed: 9811, prompt: 'a horse breeding farm on a sunny day: green pasture with white wooden fences, a red barn and a '
    + 'water trough in the back, rolling hills and a few trees under a blue sky' },
  loja: { seed: 9821, prompt: 'interior of a saddlery and tack shop: a long wooden counter at the back, shelves with saddles, '
    + 'horseshoes, bridles, small potion bottles and sacks of feed, hanging wooden signs, warm light' },
  expedicao: { seed: 9831, prompt: 'a crossroads at the edge of the wilds: a wooden signpost with three arrows, a dirt road that '
    + 'splits toward a smoking volcano, a wide river and a dense forest far in the distance, wide sky with clouds' },
};
const MAPAS = {
  fogo: { regiao: 'sertao', seed: 9841, desc: 'top-down view of dry volcanic backlands: red and orange rocky ground, cracks with '
    + 'glowing lava, dry thorny bushes, scattered boulders' },
  agua: { regiao: 'litoral', seed: 9851, desc: 'top-down view of a river delta: pale sand banks, shallow blue water channels, '
    + 'small islands with palm trees, reeds along the water' },
  grama: { regiao: 'cerrado', seed: 9861, desc: 'top-down view of a savanna woodland: green grass, clusters of twisted trees and '
    + 'shrubs, a few rocks, small clearings' },
};
const MAPA_EXTRA = 'game world map terrain seen from directly above, no roads, no paths, no buildings, no text, no characters, '
  + 'evenly filled to all edges';

function args() {
  const a = { lote: null, gerar: false, custo: false, tetoUsd: null, tetoPl: null };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--lote') a.lote = v[++i];
    else if (v[i] === '--gerar') a.gerar = true;
    else if (v[i] === '--custo') a.custo = true;
    else if (v[i] === '--teto-usd') a.tetoUsd = Number(v[++i]);
    else if (v[i] === '--teto-pl') a.tetoPl = Number(v[++i]);
    else throw new Error('opção desconhecida: ' + v[i]);
  }
  if (!['cenas', 'mapas'].includes(a.lote)) throw new Error('use --lote cenas ou --lote mapas');
  return a;
}
const lerJson = (f, p) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : p);
const assinatura = p => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);
const semB64 = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)));
const palB64 = pal => encodePng(imagemPaleta(pal)).toString('base64');

function chamadas(lote) {
  if (lote === 'cenas') return Object.entries(CENAS).map(([id, C]) => ({ id, api: 'rd', base: `cena-${id}`, paleta: RESURRECT64,
    estimativa: 0.06 * 4, pedido: { prompt: `${C.prompt}, ${CENA_EXTRA}`, prompt_style: 'rd_plus__default', width: 256, height: 160,
      num_images: 4, seed: C.seed, input_palette: palB64(RESURRECT64) } }));
  return Object.entries(MAPAS).flatMap(([id, M]) => [0, 1].map(k => ({ id, api: 'pl', base: `mapa-${id}-s${M.seed + k}`,
    paleta: REGIOES[M.regiao], estimativa: 1, pedido: { description: `${M.desc}, ${MAPA_EXTRA}`, image_size: { width: 256, height: 384 },
      view: 'high top-down', outline: 'lineless', detail: 'highly detailed', seed: M.seed + k } })));
}

function folha() {
  const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const sec = ['cenas', 'mapas'].map(l => {
    const d = path.join(DIR, 'telas', l);
    if (!fs.existsSync(d)) return '';
    const fs_ = fs.readdirSync(d).filter(f => f.endsWith('.png')).sort();
    return `<h2>${l}</h2><div class="grade">` + fs_.map(f => `<figure><img src="${uri(path.join(d, f))}" style="width:512px"><figcaption>${f.replace('.png', '')}</figcaption></figure>`).join('') + '</div>';
  }).join('');
  fs.writeFileSync(path.join(RAIZ, 'prototype', 'arte', 'folha-telas.html'), `<title>Cenas e mapas</title>
<style>:root{color-scheme:dark} body{background:#2e222f;color:#c7dcd0;font:14px monospace;margin:0} .p{padding:16px}
h2{color:#f9c22b;font-weight:normal} .grade{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start} figure{margin:0} img{image-rendering:pixelated;display:block;max-width:100%}
figcaption{color:#9babb2;font-size:12px}</style><div class="p"><h1 style="color:#f9c22b;font-weight:normal">Cenas das abas e mapas das trilhas · 2×</h1>${sec}</div>`);
}

async function main() {
  const a = args(), lista = chamadas(a.lote);
  const usdTab = lista.filter(c => c.api === 'rd').reduce((s, c) => s + c.estimativa, 0), plTab = lista.filter(c => c.api === 'pl').length;
  const tetoUsd = a.tetoUsd ?? Math.ceil(usdTab * 100 + 20) / 100, tetoPl = a.tetoPl ?? plTab * 2;
  console.log(`Telas, lote ${a.lote}: ${lista.length} chamadas` + (usdTab ? `, ~US$ ${usdTab.toFixed(2)} na Retro Diffusion (teto US$ ${tetoUsd.toFixed(2)})` : '')
    + (plTab ? `, ~${plTab} gerações do PixelLab (teto ${tetoPl})` : ''));
  for (const c of lista) console.log(`  ${c.base}  ${c.api === 'rd' ? `${c.pedido.prompt_style} ${c.pedido.width}×${c.pedido.height} ×${c.pedido.num_images}` : `/create-image-pixen ${c.pedido.image_size.width}×${c.pedido.image_size.height}`}, seed ${c.pedido.seed}`);
  if (!a.gerar && !a.custo) { console.log('\nDry-run: nada foi gerado nem consultado. --custo pergunta o preço à RD (gratuito); --gerar gasta.'); return; }
  estado.redeLiberada = true;
  if (!a.gerar) {
    let s = 0;
    for (const c of lista.filter(x => x.api === 'rd')) { const q = await rdCusto(c.pedido); s += q.balance_cost; console.log(`  ${c.base}: US$ ${q.balance_cost}`); }
    console.log(`Total pela RD: US$ ${s.toFixed(2)} · saldo US$ ${await rdSaldo()}`);
    return;
  }
  const gasto = lerJson(ARQ_GASTO, { pl: 0, usd: 0, chamadas: [] });
  let usd = 0, pl = 0;
  if (lista.some(c => c.api === 'rd')) console.log('Saldo da Retro Diffusion antes: US$', await rdSaldo());
  if (lista.some(c => c.api === 'pl')) await saldo('do PixelLab antes');
  const raw = path.join(DIR, 'raw', 'telas'), fim = path.join(DIR, 'telas', a.lote);
  fs.mkdirSync(raw, { recursive: true }); fs.mkdirSync(fim, { recursive: true });
  for (const c of lista) {
    const arqJson = path.join(raw, c.base + '.json'), assin = assinatura(c.pedido), salvo = lerJson(arqJson, null);
    let pngs;
    if (salvo && salvo.assinatura === assin) pngs = salvo.arquivos.map(f => fs.readFileSync(path.join(raw, f)));
    else if (c.api === 'rd') {
      const q = await rdCusto(c.pedido);
      if (usd + q.balance_cost > tetoUsd + 1e-9) { console.log(`  ${c.base}: PAROU (teto US$ ${tetoUsd})`); break; }
      const r = await rdGerar(c.pedido);
      pngs = r.base64_images.map(b => Buffer.from(b, 'base64'));
      const cobrado = r.balance_cost ?? q.balance_cost;
      usd += cobrado; gasto.usd += cobrado; gasto.chamadas.push({ base: `telas/${c.base}`, usd: cobrado, data: new Date().toISOString() });
      console.log(`  ${c.base}: US$ ${cobrado} [total US$ ${usd.toFixed(2)}/${tetoUsd}]`);
    } else {
      if (pl + 1 > tetoPl) { console.log(`  ${c.base}: PAROU (teto de ${tetoPl} gerações)`); break; }
      const r = await chamar('POST', '/create-image-pixen', c.pedido);
      if (r.usage && r.usage.type === 'usd' && r.usage.usd > 0) throw new Error('cobrança inesperada em US$ no PixelLab');
      const g = (r.usage && r.usage.generations) ?? 1;
      pl += g; gasto.pl += g; gasto.chamadas.push({ base: `telas/${c.base}`, geracoes: g, data: new Date().toISOString() });
      pngs = [Buffer.from(r.image.base64, 'base64')];
      console.log(`  ${c.base}: ${fmt(g)} geração(ões) [total ${fmt(pl)}/${tetoPl}]`);
    }
    if (!(salvo && salvo.assinatura === assin)) {
      const arquivos = pngs.map((b, i) => { const f = `${c.base}-${i}.png`; fs.writeFileSync(path.join(raw, f), b); return f; });
      fs.writeFileSync(arqJson, JSON.stringify({ assinatura: assin, pedido: semB64(c.pedido), arquivos }, null, 2));
      fs.writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2));
    }
    pngs.forEach((b, i) => {
      const img = quantizar(decodePng(b), c.paleta), k = conferir(img, c.paleta), nome = c.api === 'rd' ? `${c.id}-${i}` : c.base.replace('mapa-', '');
      fs.writeFileSync(path.join(fim, nome + '.png'), encodePng(img));
      console.log(`    ${nome}: ${img.width}×${img.height}, fora ${k.fora}, alfa ${k.alfa}, falso ${k.falso ? 'SIM' : 'não'}`);
    });
  }
  if (lista.some(c => c.api === 'rd')) console.log('Saldo da Retro Diffusion depois: US$', await rdSaldo());
  if (lista.some(c => c.api === 'pl')) await saldo('do PixelLab depois');
  folha();
  console.log(`Gasto: US$ ${usd.toFixed(2)} e ${fmt(pl)} gerações · folha em prototype/arte/folha-telas.html`);
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
