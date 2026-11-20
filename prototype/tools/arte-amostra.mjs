// prototype/tools/arte-amostra.mjs — assets da amostra da direção de arte (a tela da corrida no Cerrado), segundo
// docs/arte/guia.md. Gasto aprovado pelo Vinicius em 2026-11-20: até 200 gerações do PixelLab e a conta da Retro
// Diffusion (US$ 5 de saldo).
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/arte-amostra.mjs --lote piloto [--gerar] [--teto-pl N] [--teto-usd X]
//   Sem --gerar é SEMPRE dry-run: lista as chamadas e o custo estimado, sem rede.
//   --teto-pl N    máximo de gerações do PixelLab neste lote (padrão: a estimativa do lote).
//   --teto-usd X   máximo em US$ na Retro Diffusion neste lote (padrão: a estimativa do lote).
//   Com --gerar, antes de cada chamada da Retro Diffusion o preço exato vem do check_cost (grátis); a chamada que
//   passaria do teto não é feita. Resultado já gravado em raw/ com o mesmo pedido é reaproveitado sem custo.
//   --reprocessar  refaz os finais só a partir de raw/, sem rede.
//
// Lotes:
//   piloto  as mesmas 3 camadas (chapadas, cerrado, primeiro plano) em três caminhos, para decidir a ferramenta das
//           camadas (custos.md, etapa A): Retro Diffusion Plus com emenda nativa (tile_x), Retro Diffusion Core
//           (estilo platformer, vista lateral) e PixelLab Pixen. Todas quantizadas para a paleta do Cerrado.
//
// Saída: crus em prototype/assets/arte/raw/<lote>/ (pedido e resposta .json sem base64, imagem .png) e finais
// quantizados em prototype/assets/arte/<lote>/. O gasto real fica em prototype/assets/arte/raw/gasto.json e o lote
// entra em docs/memoria/assets.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, estado, chamar, saldo, fmt } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { REGIOES, quantizar, imagemPaleta, conferir } from './arte-paleta.mjs';

const RD = 'https://api.retrodiffusion.ai';
const RD_TOKEN = process.env.RD_API_KEY || 'proxy-injected';
const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte');
const DIR_RAW = path.join(DIR, 'raw');
const ARQ_GASTO = path.join(DIR_RAW, 'gasto.json');
const PALETA = REGIOES.cerrado;
const PALETA_B64 = encodePng(imagemPaleta(PALETA)).toString('base64');   // input_palette da Retro Diffusion

const LUZ = 'late afternoon sunlight from the upper left';
const BASE = `2D side-scrolling game parallax background layer, side view, Brazilian cerrado savanna, ${LUZ}, no text`;
const CAMADAS = {
  chapadas: {
    w: 384, h: 96,
    prompt: 'distant flat-topped plateaus (chapadas) with steep reddish sandstone cliffs on the horizon, hazy blue-violet '
      + 'atmospheric distance, low contrast, one long continuous horizontal band across the whole width, flat bottom edge, '
      + `empty sky above, ${BASE}`,
  },
  cerrado: {
    w: 384, h: 112,
    prompt: 'a continuous row of Brazilian cerrado vegetation seen from the side: short twisted trees with thick corky '
      + 'bark and rounded canopies, two yellow flowering ipe trees, one buriti palm, dry golden grass along the bottom, '
      + `one long continuous horizontal band across the whole width, empty sky above, ${BASE}`,
  },
  frente: {
    w: 384, h: 64,
    prompt: 'foreground strip of tall dry golden grass tufts with a few small purple and white wildflowers, seen from '
      + `the side at ground level, one long continuous horizontal band across the whole width, empty above, ${BASE}`,
  },
};

// Caminhos do piloto. custo: estimativa (o RD confere com check_cost antes de cada chamada).
const CAMINHOS = {
  'rd-plus': { api: 'rd', estilo: 'rd_plus__default', imagens: 2, usd: 0.06, extra: { tile_x: true }, seed: 7101 },
  'rd-core': { api: 'rd', estilo: 'rd_core__platformer', imagens: 2, usd: 0.10, extra: {}, seed: 7201 },
  'pl-pixen': { api: 'pl', imagens: 2, ger: 1, seed: 7301 },
};

function args() {
  const a = { lote: 'piloto', gerar: false, reprocessar: false, tetoPl: null, tetoUsd: null };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--lote') a.lote = v[++i];
    else if (v[i] === '--gerar') a.gerar = true;
    else if (v[i] === '--reprocessar') a.reprocessar = true;
    else if (v[i] === '--teto-pl') a.tetoPl = Number(v[++i]);
    else if (v[i] === '--teto-usd') a.tetoUsd = Number(v[++i]);
    else throw new Error('opção desconhecida: ' + v[i]);
  }
  if (!['piloto', 'emendas', 'camadas'].includes(a.lote)) throw new Error('lote desconhecido: ' + a.lote);
  return a;
}

// Lote emendas: a ferramenta seam_tiling da Retro Diffusion (US$ 0,12) nas camadas escolhidas do piloto que não saíram
// sem emenda (a entrada é o cru do piloto, com fundo transparente).
const EMENDAS = [
  { base: 'cerrado-rd-core-s7201-0', seed: 7401 },
  { base: 'chapadas-pl-pixen-s7301-0', seed: 7402 },
  { base: 'frente-rd-core-s7201-1', seed: 7403 },
];
function chamadasEmendas() {
  return EMENDAS.map(e => {
    const cru = fs.readFileSync(path.join(DIR_RAW, 'piloto', e.base + '.png'));
    return { camada: e.base.split('-')[0], caminho: 'emenda', api: 'rd-edit', base: `${e.base}-emenda-s${e.seed}`, usd: 0.12,
      pedido: { input_image: cru.toString('base64'), tile_x: true, tile_y: false, seed: e.seed } };
  });
}

// Lote camadas: o que falta da cena depois do piloto (decisão: a melhor geração de cada camada + a emenda da RD).
// A arquibancada usa a camada do cerrado escolhida como referência de estilo (RD Core aceita até 9 referências).
function chamadasCamadas() {
  const ref = fs.readFileSync(path.join(DIR_RAW, 'piloto', 'cerrado-rd-core-s7201-0.png')).toString('base64');
  const rdPed = (estilo, w, h, n, seed, prompt, extra = {}) => ({ prompt, prompt_style: estilo, width: w, height: h, num_images: n, seed, input_palette: PALETA_B64, ...extra });
  return [
    { camada: 'nuvens', caminho: 'rd-plus', api: 'rd', base: 'nuvens-rd-plus-s7501', usd: 0.12,
      pedido: rdPed('rd_plus__default', 384, 96, 2, 7501, 'a few soft fluffy white cumulus clouds with light blue-grey shading, '
        + `scattered across a wide strip, nothing else, ${BASE}`, { remove_bg: true, tile_x: true }) },
    { camada: 'arquibancada', caminho: 'rd-core', api: 'rd', base: 'arquibancada-rd-core-s7601', usd: 0.20,
      pedido: rdPed('rd_core__platformer', 384, 96, 2, 7601, 'a long covered wooden horse racing grandstand seen exactly from '
        + 'the side, white roof with a red trim, full of a small colorful cheering crowd, little flags on the roof, a rural '
        + `Brazilian racecourse, one long continuous horizontal band across the whole width, empty sky above, ${BASE}`,
        { remove_bg: true, reference_images: [ref] }) },
    { camada: 'arquibancada', caminho: 'rd-core', api: 'rd', base: 'arquibancada-rd-core-s7602', usd: 0.20,
      pedido: rdPed('rd_core__platformer', 384, 96, 2, 7602, 'side view of a rural racecourse grandstand: a long low wooden '
        + 'bleacher with a corrugated roof painted white and red, packed with a tiny colorful crowd waving, a small judge '
        + `tower at one end, one long continuous horizontal band, empty sky above, ${BASE}`,
        { remove_bg: true, reference_images: [ref] }) },
    { camada: 'pista', caminho: 'rd-plus', api: 'rd', base: 'pista-rd-plus-s7701', usd: 0.12,
      pedido: rdPed('rd_plus__textured', 128, 128, 2, 7701, 'red clay dirt racetrack surface texture seen from slightly above, '
        + 'raked soil with faint hoof prints and small pebbles, even lighting, seamless texture, no objects, no grass',
        { tile_x: true, tile_y: true }) },
  ];
}

// As chamadas do lote: uma por (camada, caminho); o RD faz as 2 imagens numa chamada, o PixelLab uma por seed.
function chamadas() {
  const out = [];
  for (const [camada, c] of Object.entries(CAMADAS)) for (const [nome, k] of Object.entries(CAMINHOS)) {
    if (k.api === 'rd') {
      out.push({ camada, caminho: nome, api: 'rd', base: `${camada}-${nome}-s${k.seed}`, usd: k.usd * k.imagens,
        pedido: { prompt: c.prompt, prompt_style: k.estilo, width: c.w, height: c.h, num_images: k.imagens, seed: k.seed,
          remove_bg: true, input_palette: PALETA_B64, ...k.extra } });
    } else {
      for (let i = 0; i < k.imagens; i++) {
        const seed = k.seed + i;
        out.push({ camada, caminho: nome, api: 'pl', base: `${camada}-${nome}-s${seed}`, ger: k.ger,
          pedido: { description: c.prompt, image_size: { width: c.w, height: c.h }, no_background: true, view: 'side',
            outline: 'lineless', detail: 'highly detailed', seed } });
      }
    }
  }
  return out;
}

const dormir = ms => new Promise(r => setTimeout(r, ms));
const lerJson = (f, padrao) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : padrao);
const semB64 = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)));
const assinatura = p => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);

async function rd(metodo, caminho, corpo, idem) {
  if (!estado.redeLiberada) throw new Error('chamada de rede sem --gerar (bug do script)');
  const headers = { 'X-RD-Token': RD_TOKEN, 'Content-Type': 'application/json' };
  if (idem) headers['Idempotency-Key'] = idem;
  const res = await fetch(RD + caminho, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
  const texto = await res.text();
  if (!res.ok) throw new Error(`RD ${metodo} ${caminho} → HTTP ${res.status}: ${texto.slice(0, 500)}`);
  return JSON.parse(texto);
}

async function rdGerar(pedido) {
  const r = await rd('POST', '/v2/inferences', pedido, crypto.randomUUID());
  const fim = Date.now() + 10 * 60 * 1000;
  while (Date.now() < fim) {
    await dormir(3000);
    const t = await rd('GET', `/v2/inferences/tasks/${r.task_id}`);
    if (t.status === 'pending' || t.status === 'running') continue;
    if (t.status !== 'succeeded') throw new Error(`RD tarefa ${r.task_id} ${t.status}: ${JSON.stringify(t.error)}`);
    return t.result;
  }
  throw new Error(`RD tarefa ${r.task_id}: tempo esgotado`);
}

function gravarFinal(lote, nome, buf) {
  const img = quantizar(decodePng(buf), PALETA);
  const dir = path.join(DIR, lote);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, nome + '.png'), encodePng(img));
  const c = conferir(img, PALETA);
  return `${img.width}×${img.height}, fora da paleta ${c.fora}, alfa parcial ${c.alfa}, blocos 2×2 iguais ${(c.grade2x2 * 100).toFixed(0)}%`;
}

async function main() {
  const a = args();
  estado.reprocessar = a.reprocessar;
  const lista = a.lote === 'emendas' ? chamadasEmendas() : a.lote === 'camadas' ? chamadasCamadas() : chamadas();
  const estPl = lista.filter(c => c.api === 'pl').reduce((s, c) => s + c.ger, 0);
  const estUsd = lista.filter(c => c.api !== 'pl').reduce((s, c) => s + c.usd, 0);
  const tetoPl = a.tetoPl ?? estPl, tetoUsd = a.tetoUsd ?? Math.round(estUsd * 100) / 100;
  console.log(`Lote ${a.lote}: ${lista.length} chamadas; estimativa ${estPl} gerações do PixelLab e US$ ${estUsd.toFixed(2)} na Retro Diffusion`);
  console.log(`Tetos: ${tetoPl} gerações, US$ ${tetoUsd.toFixed(2)}`);
  for (const c of lista) console.log(`  ${c.base}  ${c.api === 'rd-edit' ? 'seam_tiling' : c.api === 'rd' ? `${c.pedido.prompt_style} ${c.pedido.width}×${c.pedido.height} ×${c.pedido.num_images}` : `pixen ${c.pedido.image_size.width}×${c.pedido.image_size.height}`}`);
  if (!a.gerar && !a.reprocessar) { console.log('\nDry-run: nada foi gerado. Use --gerar para gastar.'); return; }

  estado.redeLiberada = a.gerar;
  const rawDir = path.join(DIR_RAW, a.lote);
  fs.mkdirSync(rawDir, { recursive: true });
  const gasto = lerJson(ARQ_GASTO, { pl: 0, usd: 0, chamadas: [] });
  let pl = 0, usd = 0;
  if (a.gerar) {
    await saldo('do PixelLab antes');
    console.log('Saldo da Retro Diffusion antes: US$', (await rd('GET', '/v2/inferences/credits')).balance);
  }
  for (const c of lista) {
    const arqJson = path.join(rawDir, c.base + '.json');
    const assin = assinatura(c.pedido);
    const salvo = lerJson(arqJson, null);
    let pngs;
    if (salvo && salvo.assinatura === assin) {
      pngs = salvo.arquivos.map(f => fs.readFileSync(path.join(rawDir, f)));
      console.log(`  ${c.base}: reaproveitado de raw/ (sem custo)`);
    } else if (!a.gerar) {
      console.log(`  ${c.base}: falta o cru (rode com --gerar)`); continue;
    } else if (c.api === 'rd-edit') {
      const q = await rd('POST', '/v1/edit/tools/seam_tiling/estimate', c.pedido);
      if (usd + q.balance_cost > tetoUsd + 1e-9) { console.log(`  ${c.base}: PAROU (US$ ${q.balance_cost} passaria do teto)`); break; }
      const r = await rd('POST', '/v1/edit/tools/seam_tiling', c.pedido);
      const cobrado = r.balance_cost ?? q.balance_cost;
      usd += cobrado; gasto.usd += cobrado;
      let b = r.base64_images && r.base64_images[0] ? Buffer.from(r.base64_images[0], 'base64') : null;
      if (!b) b = Buffer.from(await (await fetch(r.output_urls[0])).arrayBuffer());
      pngs = [b];
      const f = `${c.base}-0.png`; fs.writeFileSync(path.join(rawDir, f), b);
      fs.writeFileSync(arqJson, JSON.stringify({ assinatura: assin, api: 'retrodiffusion', ferramenta: 'seam_tiling', pedido: semB64(c.pedido), resposta: semB64(r), arquivos: [f] }, null, 2));
      gasto.chamadas.push({ base: c.base, usd: cobrado, data: new Date().toISOString() });
      console.log(`  ${c.base}: US$ ${cobrado} [total US$ ${usd.toFixed(3)}/${tetoUsd}]`);
    } else if (c.api === 'rd') {
      const q = await rd('POST', '/v2/inferences', { ...c.pedido, check_cost: true });
      const custo = q.balance_cost;
      if (usd + custo > tetoUsd + 1e-9) { console.log(`  ${c.base}: PAROU (US$ ${custo} passaria do teto)`); break; }
      const r = await rdGerar(c.pedido);
      const cobrado = r.balance_cost ?? custo;
      usd += cobrado; gasto.usd += cobrado;
      pngs = r.base64_images.map(b => Buffer.from(b, 'base64'));
      const arquivos = pngs.map((b, i) => { const f = `${c.base}-${i}.png`; fs.writeFileSync(path.join(rawDir, f), b); return f; });
      fs.writeFileSync(arqJson, JSON.stringify({ assinatura: assin, api: 'retrodiffusion', pedido: c.pedido, resposta: semB64(r), arquivos }, null, 2));
      gasto.chamadas.push({ base: c.base, usd: cobrado, data: new Date().toISOString() });
      console.log(`  ${c.base}: US$ ${cobrado} [total US$ ${usd.toFixed(3)}/${tetoUsd}] (restante ${r.remaining_balance})`);
    } else {
      if (pl + c.ger > tetoPl) { console.log(`  ${c.base}: PAROU (passaria do teto de ${tetoPl} gerações)`); break; }
      const r = await chamar('POST', '/create-image-pixen', c.pedido);
      const g = (r.usage && r.usage.generations) ?? c.ger;
      if (r.usage && r.usage.type === 'usd' && r.usage.usd > 0) throw new Error('cobrança inesperada em US$ no PixelLab');
      pl += g; gasto.pl += g;
      pngs = [Buffer.from(r.image.base64, 'base64')];
      const f = `${c.base}-0.png`; fs.writeFileSync(path.join(rawDir, f), pngs[0]);
      fs.writeFileSync(arqJson, JSON.stringify({ assinatura: assin, api: 'pixellab', endpoint: '/create-image-pixen', pedido: c.pedido, resposta: semB64(r), arquivos: [f] }, null, 2));
      gasto.chamadas.push({ base: c.base, geracoes: g, data: new Date().toISOString() });
      console.log(`  ${c.base}: ${fmt(g)} geração(ões) [total ${fmt(pl)}/${tetoPl}]`);
    }
    fs.writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2));
    pngs.forEach((b, i) => console.log(`    final ${c.base}-${i}: ${gravarFinal(a.lote, `${c.base}-${i}`, b)}`));
  }
  fs.writeFileSync(path.join(DIR, a.lote, 'paleta.png'), encodePng(imagemPaleta(PALETA)));
  if (a.gerar) {
    await saldo('do PixelLab depois');
    console.log('Saldo da Retro Diffusion depois: US$', (await rd('GET', '/v2/inferences/credits')).balance);
  }
  console.log(`Gasto neste lote: ${fmt(pl)} gerações do PixelLab e US$ ${usd.toFixed(3)} na Retro Diffusion`);
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
