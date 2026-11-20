// prototype/tools/arte-regioes.mjs — camadas de cenário das regiões de corrida (plano da direção de arte, etapa 3;
// docs/arte/guia.md). Mesmo caminho aprovado no piloto do Cerrado: horizonte no PixelLab Pixen, meio, capim da frente e
// arquibancada na Retro Diffusion Core (`rd_core__platformer`), emendas com a `seam_tiling` da Retro Diffusion. As
// nuvens são as do Cerrado, requantizadas na paleta da região (sem custo).
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/arte-regioes.mjs --regiao varzea|planalto|sertao|litoral|todas
//         --fase 1|2 [--gerar] [--teto-pl N] [--teto-usd X]
//       node prototype/tools/arte-regioes.mjs --finalizar <regiao>|todas     (sem rede: grava os finais do regioes.json)
//   Sem --gerar é SEMPRE dry-run: lista as chamadas e o custo estimado, sem rede.
//   fase 1: horizonte (Pixen, 2 sementes), meio e frente (RD Core, 2 imagens cada).
//   fase 1b: refação das camadas que falharam na fase 1 (REFAZER): pedido de faixa densa e contínua e a versão sem a
//           remoção de fundo junto (return_non_bg_removed), porque a remoção da RD apagou a mata em alguns casos.
//   fase 2: arquibancada (RD Core, 2 imagens, com o meio escolhido de referência) e as emendas do horizonte, do meio e
//           da frente escolhidos (precisa das escolhas da fase 1 em prototype/assets/arte/regioes.json).
//   Com --gerar: o preço da RD vem do check_cost/estimate (grátis) antes de cada chamada; a que passaria do teto não é
//   feita. Pedido já gravado em raw/ é reaproveitado sem custo. O PixelLab só usa a cota do plano (aborta se cobrar US$).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, estado, chamar, saldo, fmt } from './pixellab-comum.mjs';
import { rdGerar, rdCusto, rdFerramenta, rdFerramentaCusto, rdSaldo } from './rd-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { REGIOES, quantizar, imagemPaleta, conferir } from './arte-paleta.mjs';

const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte');
const ARQ_MANIFESTO = path.join(DIR, 'regioes.json');
const ARQ_GASTO = path.join(DIR, 'raw', 'gasto.json');
const LUZ = 'late afternoon sunlight from the upper left';
const base = r => `2D side-scrolling game parallax background layer, side view, ${r}, ${LUZ}, no text`;
const FAIXA = 'one long continuous horizontal band across the whole width, empty sky above';

const TEXTOS = {
  varzea: {
    seed: 8100, lugar: 'Brazilian floodplain lagoon (varzea) countryside',
    horizonte: 'a distant wide calm lagoon reflecting the sky, a low line of riparian forest on the far shore and a few '
      + 'wooden stilt houses, hazy blue atmospheric distance, low contrast, flat bottom edge',
    meio: 'riparian forest at the edge of a lagoon seen from the side: tall leafy trees with hanging vines, a few white '
      + 'egrets standing among reeds at the base',
    frente: 'foreground strip of tall green reeds and water hyacinths with small purple flowers along the water edge, '
      + 'seen from the side at ground level',
    arquibancada: 'a long wooden racecourse grandstand on short stilts by a lagoon, painted teal and white, full of a '
      + 'small colorful cheering crowd, little flags on the roof, seen exactly from the side',
  },
  planalto: {
    seed: 8200, lugar: 'Brazilian southern highlands (planalto) with windy grasslands',
    horizonte: 'distant rolling highland hills with grey rocky outcrops under a wide sky, hazy blue atmospheric distance, '
      + 'low contrast, flat bottom edge',
    meio: 'a row of tall araucaria pine trees with flat umbrella crowns and rounded bushes on a grassy highland, one old '
      + 'wooden windmill',
    frente: 'foreground strip of windswept golden-green highland grass tufts bending in the wind with small yellow '
      + 'flowers, seen from the side at ground level',
    arquibancada: 'a stone and wood racecourse grandstand with a red clay tile roof in the southern highlands, full of a '
      + 'small colorful cheering crowd in warm coats, seen exactly from the side',
  },
  sertao: {
    seed: 8300, lugar: 'Brazilian semi-arid backlands (sertao) with caatinga scrub',
    horizonte: 'a distant flat caatinga plain with low eroded mesas and the brick chimney of an old sugar mill on the '
      + 'horizon, hot hazy atmospheric distance, low contrast, flat bottom edge',
    meio: 'caatinga vegetation seen from the side: grey leafless thorny shrubs, tall mandacaru cacti, one juazeiro tree '
      + 'with a green crown, dry soil at the base',
    frente: 'foreground strip of sugarcane leaves, dry yellow grass and small xique-xique cactus clumps, seen from the '
      + 'side at ground level',
    arquibancada: 'a whitewashed adobe racecourse grandstand with a clay tile roof and colorful festa junina bunting '
      + 'flags, packed with a small cheering crowd, seen exactly from the side',
  },
  litoral: {
    seed: 8400, lugar: 'Brazilian northeastern coast with beaches and coconut palms',
    horizonte: 'a distant calm turquoise sea with a long sandy beach, a white lighthouse on a green headland and a few '
      + 'small sailboats, hazy atmospheric distance, low contrast, flat bottom edge',
    meio: 'a row of tall coconut palm trees leaning in the sea breeze, with white sand dunes and green beach shrubs at '
      + 'the base',
    frente: 'foreground strip of beach grass and sea creeper vines with small pink flowers on white sand, seen from the '
      + 'side at ground level',
    arquibancada: 'a colorful painted wooden racecourse grandstand by the beach with a red and white striped awning roof, '
      + 'full of a small cheering crowd, seen exactly from the side',
  },
};
// camadas que falharam na fase 1 (2026-11-20): a remoção de fundo apagou a mata (várzea), sobrou uma moita isolada
// (sertão) ou saíram árvores ralas com fantasmas azulados (planalto)
const REFAZER = { varzea: ['meio'], planalto: ['meio'], sertao: ['meio', 'frente'], litoral: ['frente'] };
const DENSO = 'dense and continuous, filling the whole width from edge to edge with no gaps and no isolated objects, '
  + 'solid ground line along the bottom';
const TAM = { horizonte: [384, 96], meio: [384, 112], frente: [384, 64], arquibancada: [384, 96] };

function args() {
  const a = { regiao: null, fase: 1, gerar: false, finalizar: null, tetoPl: null, tetoUsd: null };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--regiao') a.regiao = v[++i];
    else if (v[i] === '--fase') { a.fase = v[++i]; if (a.fase !== '1b') a.fase = Number(a.fase); }
    else if (v[i] === '--gerar') a.gerar = true;
    else if (v[i] === '--finalizar') a.finalizar = v[++i];
    else if (v[i] === '--teto-pl') a.tetoPl = Number(v[++i]);
    else if (v[i] === '--teto-usd') a.tetoUsd = Number(v[++i]);
    else throw new Error('opção desconhecida: ' + v[i]);
  }
  return a;
}
const lerJson = (f, p) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : p);
const semB64 = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)));
const assinatura = p => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);
const paletaB64 = r => encodePng(imagemPaleta(REGIOES[r])).toString('base64');

function chamadas(r, fase, manifesto) {
  const T = TEXTOS[r], out = [], s = T.seed, rdPed = (camada, seed, extra = {}) => ({
    prompt: `${T[camada]}, ${FAIXA}, ${base(T.lugar)}`, prompt_style: 'rd_core__platformer', width: TAM[camada][0],
    height: TAM[camada][1], num_images: 2, seed, remove_bg: true, input_palette: paletaB64(r), ...extra,
  });
  if (fase === '1b') {
    for (const c of REFAZER[r] || []) {
      const ped = rdPed(c, s + (c === 'meio' ? 12 : 22), { return_non_bg_removed: true });
      ped.prompt = `${T[c]}, ${DENSO}, ${FAIXA}, ${base(T.lugar)}`;
      out.push({ regiao: r, camada: c, api: 'rd', usd: 0.2, base: `${c}-rd-core-s${ped.seed}`, pedido: ped });
    }
    return out;
  }
  if (fase === 1) {
    for (const i of [1, 2]) out.push({ regiao: r, camada: 'horizonte', api: 'pl', ger: 1, base: `horizonte-pl-pixen-s${s + i}`,
      pedido: { description: `${T.horizonte}, ${FAIXA}, ${base(T.lugar)}`, image_size: { width: 384, height: 96 },
        no_background: true, view: 'side', outline: 'lineless', detail: 'highly detailed', seed: s + i } });
    out.push({ regiao: r, camada: 'meio', api: 'rd', usd: 0.2, base: `meio-rd-core-s${s + 11}`, pedido: rdPed('meio', s + 11) });
    out.push({ regiao: r, camada: 'frente', api: 'rd', usd: 0.2, base: `frente-rd-core-s${s + 21}`, pedido: rdPed('frente', s + 21) });
  } else {
    const esc = (manifesto[r] && manifesto[r].escolhas) || {};
    for (const c of ['horizonte', 'meio', 'frente']) if (!esc[c]) throw new Error(`${r}: falta a escolha da fase 1 para "${c}" em regioes.json (escolhas)`);
    const ref = fs.readFileSync(path.join(DIR, 'raw', r, esc.meio)).toString('base64');
    out.push({ regiao: r, camada: 'arquibancada', api: 'rd', usd: 0.2, base: `arquibancada-rd-core-s${s + 31}`,
      pedido: rdPed('arquibancada', s + 31, { reference_images: [ref] }) });
    ['horizonte', 'meio', 'frente'].forEach((c, i) => {
      const cru = fs.readFileSync(path.join(DIR, 'raw', r, esc[c]));
      out.push({ regiao: r, camada: c, api: 'rd-edit', usd: 0.12, base: `${path.basename(esc[c], '.png')}-emenda-s${s + 41 + i}`,
        pedido: { input_image: cru.toString('base64'), tile_x: true, tile_y: false, seed: s + 41 + i } });
    });
  }
  return out;
}

function gravarCandidato(r, nome, buf) {
  const img = quantizar(decodePng(buf), REGIOES[r]), dir = path.join(DIR, r, 'candidatos');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, nome + '.png'), encodePng(img));
  const c = conferir(img, REGIOES[r]);
  return `${img.width}×${img.height}, fora ${c.fora}, alfa ${c.alfa}, falso ${c.falso ? 'SIM' : 'não'}, emenda ${c.emenda.toFixed(2)}`;
}

// --finalizar: o final de cada camada a partir das escolhas (corte, recorte opaco, requantização na paleta da região)
function cortar(img, y, h) {
  if (h < 0) h = img.height - y + h;
  const out = new Uint8Array(img.width * h * 4);
  out.set(img.rgba.subarray(y * img.width * 4, (y + h) * img.width * 4));
  return { width: img.width, height: h, rgba: out };
}
function recorteOpaco(img) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.rgba[(y * img.width + x) * 4 + 3] === 255) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) out.set(img.rgba.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4), y * w * 4);
  return { width: w, height: h, rgba: out };
}
export function finalizar(r, manifesto) {
  const reg = manifesto[r], dir = path.join(DIR, r);
  fs.mkdirSync(dir, { recursive: true });
  for (const [camada, e] of Object.entries(reg.camadas)) {
    let img = decodePng(fs.readFileSync(path.join(DIR, e.origem)));
    if (e.corte) img = cortar(img, e.corte.y, e.corte.h);
    if (e.recorte === 'opaco') img = recorteOpaco(img);
    img = quantizar(img, REGIOES[r]);
    fs.writeFileSync(path.join(dir, camada + '.png'), encodePng(img));
    console.log(`  ${r}/${camada}.png ${img.width}×${img.height}`);
  }
}

async function main() {
  const a = args(), manifesto = lerJson(ARQ_MANIFESTO, {});
  const lista = a.regiao === 'todas' ? Object.keys(TEXTOS) : a.regiao ? [a.regiao] : [];
  if (a.finalizar) {
    for (const r of a.finalizar === 'todas' ? Object.keys(manifesto).filter(k => !k.startsWith('_')) : [a.finalizar]) {
      if (Object.keys(manifesto[r].camadas).length) finalizar(r, manifesto);
    }
    return;
  }
  for (const r of lista) if (!TEXTOS[r]) throw new Error('região desconhecida: ' + r);
  const todas = lista.flatMap(r => chamadas(r, a.fase, manifesto));
  const estPl = todas.filter(c => c.api === 'pl').reduce((s, c) => s + c.ger, 0);
  const estUsd = todas.filter(c => c.api !== 'pl').reduce((s, c) => s + c.usd, 0);
  const tetoPl = a.tetoPl ?? estPl, tetoUsd = a.tetoUsd ?? Math.round(estUsd * 100) / 100;
  console.log(`Fase ${a.fase} (${lista.join(', ')}): ${todas.length} chamadas; estimativa ${estPl} gerações do PixelLab e US$ ${estUsd.toFixed(2)} na Retro Diffusion. Tetos: ${tetoPl} gerações, US$ ${tetoUsd.toFixed(2)}`);
  for (const c of todas) console.log(`  ${c.regiao}/${c.base}  ${c.api === 'pl' ? 'PixelLab Pixen 384×96 (1 geração)' : c.api === 'rd' ? `RD ${c.pedido.prompt_style} ${c.pedido.width}×${c.pedido.height} ×2 (US$ ${c.usd})` : `RD seam_tiling (US$ ${c.usd})`}`);
  if (!a.gerar) { console.log('\nDry-run: nada foi gerado. Use --gerar para gastar.'); return; }

  estado.redeLiberada = true;
  const gasto = lerJson(ARQ_GASTO, { pl: 0, usd: 0, chamadas: [] });
  let pl = 0, usd = 0;
  await saldo('do PixelLab antes');
  console.log('Saldo da Retro Diffusion antes: US$', await rdSaldo());
  for (const c of todas) {
    const raw = path.join(DIR, 'raw', c.regiao), arqJson = path.join(raw, c.base + '.json'), assin = assinatura(c.pedido);
    fs.mkdirSync(raw, { recursive: true });
    const salvo = lerJson(arqJson, null);
    let pngs;
    if (salvo && salvo.assinatura === assin) {
      pngs = salvo.arquivos.map(f => fs.readFileSync(path.join(raw, f)));
      console.log(`  ${c.regiao}/${c.base}: reaproveitado de raw/ (sem custo)`);
    } else if (c.api === 'pl') {
      if (pl + c.ger > tetoPl) { console.log(`  ${c.base}: PAROU (teto de ${tetoPl} gerações)`); break; }
      const r = await chamar('POST', '/create-image-pixen', c.pedido);
      if (r.usage && r.usage.type === 'usd' && r.usage.usd > 0) throw new Error('cobrança inesperada em US$ no PixelLab');
      const g = (r.usage && r.usage.generations) ?? c.ger;
      pl += g; gasto.pl += g; pngs = [Buffer.from(r.image.base64, 'base64')];
      gasto.chamadas.push({ base: `${c.regiao}/${c.base}`, geracoes: g, data: new Date().toISOString() });
      console.log(`  ${c.regiao}/${c.base}: ${fmt(g)} geração(ões) [total ${fmt(pl)}/${tetoPl}]`);
    } else {
      const q = c.api === 'rd' ? await rdCusto(c.pedido) : await rdFerramentaCusto('seam_tiling', c.pedido);
      if (usd + q.balance_cost > tetoUsd + 1e-9) { console.log(`  ${c.base}: PAROU (US$ ${q.balance_cost} passaria do teto)`); break; }
      let r;
      if (c.api === 'rd') { r = await rdGerar(c.pedido); pngs = r.base64_images.map(b => Buffer.from(b, 'base64')); }
      else { const f = await rdFerramenta('seam_tiling', c.pedido); r = f.resposta; pngs = [f.png]; }
      const cobrado = r.balance_cost ?? q.balance_cost;
      usd += cobrado; gasto.usd += cobrado;
      gasto.chamadas.push({ base: `${c.regiao}/${c.base}`, usd: cobrado, data: new Date().toISOString() });
      console.log(`  ${c.regiao}/${c.base}: US$ ${cobrado} [total US$ ${usd.toFixed(2)}/${tetoUsd}]`);
    }
    if (!(salvo && salvo.assinatura === assin)) {
      const arquivos = pngs.map((b, i) => { const f = `${c.base}-${i}.png`; fs.writeFileSync(path.join(raw, f), b); return f; });
      fs.writeFileSync(arqJson, JSON.stringify({ assinatura: assin, api: c.api, pedido: semB64(c.pedido), arquivos }, null, 2));
      fs.writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2));
    }
    pngs.forEach((b, i) => console.log(`    ${c.base}-${i}: ${gravarCandidato(c.regiao, `${c.base}-${i}`, b)}`));
  }
  await saldo('do PixelLab depois');
  console.log('Saldo da Retro Diffusion depois: US$', await rdSaldo());
  console.log(`Gasto: ${fmt(pl)} gerações do PixelLab e US$ ${usd.toFixed(2)} na Retro Diffusion`);
}

if (process.argv[1] && process.argv[1].endsWith('arte-regioes.mjs')) main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
