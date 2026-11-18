// prototype/tools/pixellab-mapa.mjs — a arte do mapa da Expedição (spec 2026-11-18-mapa-expedicao; pedido do Vinicius
// em 2026-11-18: "Use pixellab para TUDO, sempre priorizar qualidade"): o mapa-múndi com a terra desconhecida, o mapa de
// cada ginásio, as construções e marcadores do mapa e a figura do jogador.
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/pixellab-mapa.mjs --lote <lote> [--teto N] [--gerar]
//   Sem --gerar é SEMPRE dry-run: lista as chamadas (endpoint, receita, seed, custo previsto) e o total, sem rede.
//   --teto N  máximo de gerações no lote (obrigatório com --gerar). Para ANTES de uma chamada que passaria do teto.
//   Com --gerar, confere o saldo do plano (o teto tem de caber nele: nada sai dos créditos em US$) e aborta se uma
//   resposta cobrar em US$ (o pago() do pixellab-comum.mjs).
//   Pedido já feito (raw/mapa/<receita>-s<seed>.json com o mesmo corpo e a imagem em candidatas/) é reaproveitado sem
//   rede e sem custo.
//
// Cada RECEITA é um pedido (modelo, tamanho, texto, rascunho de composição) e as seeds dele; um LOTE é uma lista de
// receitas. Modelos: `pixflux` (1 geração; aceita o rascunho do mapa-base.mjs como init image: `base` e `forca`,
// quanto do rascunho fica — ~50 só a composição, 150 uma edição, 300 quase igual), `pixen` (1 geração; sem rascunho) e
// `pro` (/generate-image-v2: 10, 15 ou 25 gerações por chamada, pelo tamanho; o rascunho vai como imagem de referência).
//
// Saída: o pedido e a resposta de cada chamada em prototype/assets/pixellab/raw/mapa/<receita>-s<seed>.json e as imagens
// em prototype/assets/pixellab/mapa/candidatas/<receita>-s<seed>.png (ou -<i>.png, quando a chamada devolve várias). A
// que vai para o jogo é copiada para prototype/assets/pixellab/mapa/<nome>.png pelo --escolher (e anotada em
// mapa/escolhas.json), que o build embute. Os lugares de cada mapa (em cima da arte escolhida) ficam em mapa/mapa.json.
//   node prototype/tools/pixellab-mapa.mjs --escolher <nome>=<receita>-s<seed>[-<i>] [...]   (sem rede)
// Cada lote gerado entra no docs/memoria/assets.md (uma linha por lote; o texto de cada receita fica neste arquivo).
import fs from 'node:fs';
import path from 'node:path';
import {
  RAIZ, DIR_MOLDES, DIR_MOLDES_RAW, HOJE, fmt, estado, chamar, esperarJob, criarOrcamento, pago, saldo, gravarCru,
  lerCru, bufDe, imagem, TetoAtingido, ErroApi,
} from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RASCUNHO, DIR_MAPA, DIR_BASE } from './mapa-base.mjs';

const DIR_RAW = path.join(DIR_MOLDES_RAW, 'mapa');
const DIR_CAND = path.join(DIR_MAPA, 'candidatas');
const ARQ_ESCOLHAS = path.join(DIR_MAPA, 'escolhas.json');
const ARQ_ASSETS = path.join(RAIZ, 'docs', 'memoria', 'assets.md');
const EP = { pixflux: '/create-image-pixflux', pixen: '/create-image-pixen', pro: '/generate-image-v2' };
// custo previsto de uma chamada (gerações): o Pro cobra pela faixa do maior lado (171–256: 10; 257–341: 15; acima: 25;
// abaixo de 171 a tabela do guia varia de 10 a 15: vale o pior caso)
const custoPrevisto = (r) => {
  if (r.modelo !== 'pro') return 1;
  const m = Math.max(r.w, r.h);
  return m > 341 ? 25 : m > 256 ? 15 : m > 170 ? 10 : m > 128 ? 15 : m > 85 ? 10 : m > 64 ? 15 : m > 42 ? 10 : m > 32 ? 15 : 10;
};

const MW = RASCUNHO.mundo.w, MH = RASCUNHO.mundo.h, GW = RASCUNHO.ginasio.w, GH = RASCUNHO.ginasio.h;
const CENA = { view: 'high top-down', outline: 'selective outline', shading: 'detailed shading', detail: 'highly detailed' };
const MUNDO_TXT = 'overworld map of a fantasy island for a 16-bit SNES JRPG, seen from above, bright cheerful colors, deep blue ocean '
  + 'with small white wave crests, sandy beaches all around the coast, a dense green forest and meadows in the south, a blue lake with '
  + 'reeds in the east, dry orange badlands with cactus and a big volcano with glowing lava in the north of the island, a pale dirt '
  + 'trail linking four small clearings, and in the far north of the map an unexplored land completely hidden under a thick bank of '
  + 'white clouds and fog, clean detailed pixel art, no text, no letters, no characters, no interface';
// 2ª versão do texto (depois do piloto: o pixen desenha muito melhor que o pixflux com rascunho, mas não aceita
// rascunho; a composição vai toda no texto e os lugares são marcados depois, em cima da arte escolhida)
const MUNDO_TXT2 = 'Top-down overworld map for a 16-bit SNES JRPG, portrait format. A whole tropical island fills the lower two thirds '
  + 'of the image, surrounded by deep blue ocean on the left, right and bottom, with sandy beaches. On the island: a dense pine forest '
  + 'and green meadows in the south-west, a blue lake with reeds in the east, orange desert badlands with cactus and a big volcano with '
  + 'glowing lava in the north. A pale dirt road with round stopping points links the south beach, the forest, the lake and the volcano '
  + 'and ends at a small wooden pier on the north shore. The top third of the image is open sea leading to a mysterious unexplored land '
  + 'completely hidden under a thick bank of white clouds and fog. Bright cheerful colors, clean detailed pixel art, no text, no '
  + 'letters, no characters, no interface.';
const GIN_TXT = {
  grama: 'forest training ground seen from above for a 16-bit SNES JRPG, a winding pale dirt trail climbing in zigzag from the bottom to '
    + 'the top of the image, five round wooden plank platforms along the trail, the top one bigger and golden, lush green grass with '
    + 'flowers and bushes, big leafy trees crowding both side edges, clean detailed pixel art, no text, no characters',
  agua: 'riverside training ground seen from above for a 16-bit SNES JRPG, a winding sandy trail climbing in zigzag from the bottom to '
    + 'the top of the image, five round wooden dock platforms along the trail, the top one bigger with silver trim, green river bank '
    + 'with reeds, clear blue flowing water with foam and lily pads along both side edges, clean detailed pixel art, no text, no characters',
  fogo: 'volcanic training ground seen from above for a 16-bit SNES JRPG, a winding grey stone trail climbing in zigzag from the bottom '
    + 'to the top of the image, five round stone slab platforms along the trail, the top one bigger with bronze trim, dark cracked '
    + 'volcanic rock ground with embers, rivers of bright glowing lava along both side edges, clean detailed pixel art, no text, no characters',
};

// Os mapas dos ginásios no pixen (a composição toda no texto; os cinco pontos dos oponentes são marcados depois)
const GIN_FIM = ' Bright cheerful colors, clean detailed pixel art, no text, no letters, no characters, no interface.';
const GIN_TXT2 = {
  grama: 'Top-down map of a forest training ground for a 16-bit SNES JRPG, tall portrait format. A pale dirt footpath enters at the bottom '
    + 'center and winds upward in a wide zigzag to the top, passing five round wooden plank platforms spaced evenly along it; the last '
    + 'platform at the top is bigger, with green banners. Lush green grass, flowers, bushes, mossy rocks, and big leafy trees crowding '
    + 'the left and right edges.' + GIN_FIM,
  agua: 'Top-down map of a riverside training ground for a 16-bit SNES JRPG, tall portrait format. A sandy footpath enters at the bottom '
    + 'center and winds upward in a wide zigzag to the top, passing five round wooden dock platforms spaced evenly along it; the last '
    + 'platform at the top is bigger, with blue banners. Green river banks with reeds and lily pads, clear blue river water with foam '
    + 'flowing along the left and right edges.' + GIN_FIM,
  fogo: 'Top-down map of a volcanic training ground for a 16-bit SNES JRPG, tall portrait format. A grey cobblestone path enters at the '
    + 'bottom center and winds upward in a wide zigzag to the top, passing five round stone slab platforms spaced evenly along it; the '
    + 'last platform at the top is bigger, with red banners and braziers. Dark cracked volcanic rock with glowing embers, rivers of '
    + 'bright orange lava flowing along the left and right edges.' + GIN_FIM,
};
// Remanso, 2ª versão: nas três primeiras os tablados saíram juntos demais para as figuras dos oponentes (64 px de altura)
const GIN_AGUA2 = 'Top-down map of a riverside training ground for a 16-bit SNES JRPG, tall portrait format. A sandy footpath enters at the '
  + 'bottom center and winds upward in a very wide zigzag to the top, passing exactly four small round wooden dock platforms, alternating '
  + 'far left and far right, widely spaced, far apart from each other, and ending at one large round wooden stage with blue banners at the '
  + 'very top. Green river banks with reeds and lily pads, clear blue river water with foam and small waterfalls along the left and right '
  + 'edges.' + GIN_FIM;
// As peças soltas (sem fundo), no Pro: abaixo de 33 px uma chamada devolve 64 candidatas e de 51 a 64 px, 16 (10
// gerações cada). `estilo`: a imagem de estilo (arquivo e, se for o caso, o recorte [x, y, w, h]) para a peça sair no
// traço do que já está no jogo: as construções no do mapa escolhido, os ícones no dos ícones da interface e a figura
// do jogador no dos oponentes.
const ICONE = path.join(RAIZ, 'prototype', 'assets', 'icons', 'ins-grama.png');
const OPONENTE = path.join(DIR_MOLDES, 'treinadores', 'sargento-correnteza-s4232.png');
const NO_MAPA = { arq: path.join(DIR_MAPA, 'mundo.png'), recorte: [28, 132, 32, 32] };
const LUGAR = (txt) => `tiny building icon for a 16-bit SNES JRPG overworld map, seen from above at a three-quarter angle, ${txt}, compact, centered, clean detailed pixel art, no text`;
const ICONE_TXT = (txt) => `pixel art game interface icon, ${txt}, centered, bold readable silhouette, dark outline, no text`;
const PECAS = {
  'lugar-grama': { nome: 'lugar-grama', w: 32, h: 32, estilo: NO_MAPA, desc: LUGAR('a small wooden horse-racing training arena with a thatched roof, a green leaf banner flag on top and a wooden fence') },
  'lugar-agua': { nome: 'lugar-agua', w: 32, h: 32, estilo: NO_MAPA, desc: LUGAR('a small lakeside pavilion on wooden stilts with a blue tiled roof and a blue wave banner flag on top') },
  'lugar-fogo': { nome: 'lugar-fogo', w: 32, h: 32, estilo: NO_MAPA, desc: LUGAR('a small dark stone forge temple with a red tiled roof, glowing orange windows and a red flame banner flag on top') },
  'lugar-casa': { nome: 'lugar-casa', w: 32, h: 32, estilo: NO_MAPA, desc: LUGAR('a small cozy red horse stable barn with a brown shingle roof, an open door and a hay bale beside it') },
  'icone-cadeado': { nome: 'icone-cadeado', w: 32, h: 32, estilo: { arq: ICONE }, desc: ICONE_TXT('a closed iron padlock with a golden keyhole') },
  'icone-marcador': { nome: 'icone-marcador', w: 32, h: 32, estilo: { arq: ICONE }, desc: ICONE_TXT('a golden yellow map pin marker pointing down, with a small white horseshoe on it') },
  'icone-vencido': { nome: 'icone-vencido', w: 32, h: 32, estilo: { arq: ICONE }, desc: ICONE_TXT('a round green badge with a white check mark') },
  'icone-misterio': { nome: 'icone-misterio', w: 32, h: 32, estilo: { arq: ICONE }, desc: ICONE_TXT('a round dark blue badge with a white question mark and small stars') },
  jogador: { nome: 'jogador', w: 64, h: 64, estilo: { arq: OPONENTE },
    desc: 'full body pixel art game character seen from behind, back view, standing with his back to the viewer, a horse racing jockey: plain white '
      + 'jockey helmet, golden yellow racing silks jacket, white riding breeches, tall black riding boots with brown tops, holding a short riding '
      + 'crop, whole figure visible from helmet to boots, clean silhouette' },
};
const SEED_PECA = { 'lugar-grama': 5401, 'lugar-agua': 5402, 'lugar-fogo': 5403, 'lugar-casa': 5404, 'icone-cadeado': 5411, 'icone-marcador': 5412, 'icone-vencido': 5413, 'icone-misterio': 5414, jogador: 5421 };
// As receitas. `base`: o rascunho de composição (mapa-base.mjs); `seeds`: uma chamada por seed.
const RECEITAS = {
  // ---- mapa-múndi (168×304)
  'mundo-flux60': { nome: 'mundo', modelo: 'pixflux', w: MW, h: MH, desc: MUNDO_TXT, extra: CENA, base: 'mundo.png', forca: 60, seeds: [5101, 5102] },
  'mundo-flux120': { nome: 'mundo', modelo: 'pixflux', w: MW, h: MH, desc: MUNDO_TXT, extra: CENA, base: 'mundo.png', forca: 120, seeds: [5111, 5112] },
  'mundo-flux200': { nome: 'mundo', modelo: 'pixflux', w: MW, h: MH, desc: MUNDO_TXT, extra: CENA, base: 'mundo.png', forca: 200, seeds: [5121] },
  'mundo-pixen': { nome: 'mundo', modelo: 'pixen', w: MW, h: MH, desc: MUNDO_TXT, extra: { view: 'high top-down', outline: 'selective outline', detail: 'highly detailed' }, seeds: [5131, 5132] },
  'mundo-pro': { nome: 'mundo', modelo: 'pro', w: MW, h: MH, desc: MUNDO_TXT, base: 'mundo.png',
    uso: 'rough layout sketch of the map: keep the same composition (where the island, forest, lake, volcano, trail, clearings and the cloud bank are) and repaint it as polished pixel art',
    seeds: [5141] },
  'mundo-pixen2': { nome: 'mundo', modelo: 'pixen', w: MW, h: MH, desc: MUNDO_TXT2, extra: { view: 'high top-down', outline: 'selective outline', detail: 'highly detailed' }, seeds: [5151, 5152, 5153, 5154, 5155, 5156] },
  // ---- mapa de cada ginásio (168×400)
  ...Object.fromEntries(['grama', 'agua', 'fogo'].flatMap((id, k) => [
    [`ginasio-${id}-flux80`, { nome: `ginasio-${id}`, modelo: 'pixflux', w: GW, h: GH, desc: GIN_TXT[id], extra: CENA, base: `ginasio-${id}.png`, forca: 80, seeds: [5201 + 20 * k, 5202 + 20 * k] }],
    [`ginasio-${id}-flux150`, { nome: `ginasio-${id}`, modelo: 'pixflux', w: GW, h: GH, desc: GIN_TXT[id], extra: CENA, base: `ginasio-${id}.png`, forca: 150, seeds: [5211 + 20 * k] }],
  ])),
  ...Object.fromEntries(['grama', 'agua', 'fogo'].map((id, k) => [`ginasio-${id}-pixen`, { nome: `ginasio-${id}`, modelo: 'pixen', w: GW, h: GH, desc: GIN_TXT2[id],
    extra: { view: 'high top-down', outline: 'selective outline', detail: 'highly detailed' }, seeds: [5301 + 10 * k, 5302 + 10 * k, 5303 + 10 * k] }])),
  'ginasio-agua-pixen2': { nome: 'ginasio-agua', modelo: 'pixen', w: GW, h: GH, desc: GIN_AGUA2, extra: { view: 'high top-down', outline: 'selective outline', detail: 'highly detailed' }, seeds: [5331, 5332, 5333, 5334] },
  ...Object.fromEntries(Object.keys(PECAS).map((id) => [id, { ...PECAS[id], modelo: 'pro', semFundo: true, seeds: [SEED_PECA[id]] }])),
};
const LOTES = {
  'piloto-mundo': ['mundo-flux60', 'mundo-flux120', 'mundo-flux200', 'mundo-pixen'],
  'mundo-pro': ['mundo-pro'],
  'mundo-2': ['mundo-pixen2'],
  'piloto-ginasio': ['ginasio-agua-flux80', 'ginasio-agua-flux150'],
  lugares: ['lugar-grama', 'lugar-agua', 'lugar-fogo', 'lugar-casa'],
  icones: ['icone-cadeado', 'icone-marcador', 'icone-vencido', 'icone-misterio'],
  jogador: ['jogador'],
  'ginasio-agua-2': ['ginasio-agua-pixen2'],
  'ginasios-pixen': ['ginasio-grama-pixen', 'ginasio-agua-pixen', 'ginasio-fogo-pixen'],
  ginasios: ['ginasio-grama-flux80', 'ginasio-grama-flux150', 'ginasio-agua-flux80', 'ginasio-agua-flux150', 'ginasio-fogo-flux80', 'ginasio-fogo-flux150'],
};

// a imagem de estilo de uma receita: o arquivo inteiro ou um recorte dele
function estiloDe(e) {
  const buf = fs.readFileSync(e.arq);
  if (!e.recorte) { const d = decodePng(buf); return { image: imagem(buf), size: { width: d.width, height: d.height } }; }
  const d = decodePng(buf), [x0, y0, w, h] = e.recorte, rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) rgba.set(d.rgba.subarray(((y0 + y) * d.width + x0) * 4, ((y0 + y) * d.width + x0 + w) * 4), y * w * 4);
  return { image: imagem(Buffer.from(encodePng({ width: w, height: h, rgba }))), size: { width: w, height: h } };
}
function pedido(r, seed) {
  const tam = { width: r.w, height: r.h };
  if (r.modelo === 'pro') {
    const p = { description: r.desc, image_size: tam, seed, no_background: !!r.semFundo };
    if (r.estilo) p.style_image = estiloDe(r.estilo);
    if (r.base) p.reference_images = [{ image: imagem(fs.readFileSync(path.join(DIR_BASE, r.base))), size: tam, usage_description: r.uso || null }];
    return p;
  }
  const p = { description: r.desc, image_size: tam, ...(r.extra || {}), no_background: !!r.semFundo, seed };
  if (r.modelo === 'pixflux' && r.base) { p.init_image = imagem(fs.readFileSync(path.join(DIR_BASE, r.base))); p.init_image_strength = r.forca; }
  return p;
}
// A chamada de verdade: { resultado: { imagens: [{ base64 }] }, respostas } (o Pro é um job; devolve 1 ou mais imagens)
async function executar(r, corpo) {
  const ep = EP[r.modelo];
  if (r.modelo !== 'pro') { const x = await chamar('POST', ep, corpo); return { resultado: { imagens: [x.image] }, respostas: [x] }; }
  const post = await chamar('POST', ep, corpo);
  const job = await esperarJob(post.background_job_id);
  const lr = job.last_response || {};
  return { resultado: { imagens: lr.images || (lr.image ? [lr.image] : []) }, respostas: [post, job] };
}

function sair(msg) { console.error(msg); process.exit(2); }
function args(argv) {
  const a = { lote: null, teto: null, gerar: false, escolher: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--lote') a.lote = argv[++i];
    else if (k === '--teto') a.teto = Number(argv[++i]);
    else if (k === '--gerar') a.gerar = true;
    else if (k === '--escolher') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) a.escolher.push(argv[++i]); }
    else sair(`argumento desconhecido: ${k}`);
  }
  if (a.escolher.length) return a;
  if (!a.lote || !LOTES[a.lote]) sair(`--lote ${a.lote}: não existe (lotes: ${Object.keys(LOTES).join(', ')})`);
  if (a.gerar && !(Number.isFinite(a.teto) && a.teto > 0)) sair('com --gerar, --teto N é obrigatório (N > 0)');
  return a;
}

function plano(lote) {
  const itens = [];
  for (const rid of LOTES[lote]) {
    const r = RECEITAS[rid];
    if (!r) sair(`lote ${lote}: receita ${rid} não existe`);
    for (const seed of r.seeds) {
      const corpo = pedido(r, seed), base = `${rid}-s${seed}`, reg = lerCru(DIR_RAW, base, corpo);
      const cru = !!(reg && !reg.erro && (fs.existsSync(path.join(DIR_CAND, base + '.png')) || fs.existsSync(path.join(DIR_CAND, base + '-0.png'))));
      itens.push({ rid, r, seed, corpo, base, cru, custo: custoPrevisto(r), rotulo: `${rid} seed ${seed}` });
    }
  }
  return itens;
}

function registrarLote(lote, feitos, geracoes) {
  const rids = [...new Set(feitos.map((x) => x.rid))];
  const arquivos = `\`prototype/assets/pixellab/mapa/candidatas/\` do lote \`${lote}\` (${feitos.reduce((n, x) => n + x.n, 0)} imagens de ${rids.length} receitas; pedidos e respostas em \`raw/mapa/\`)`;
  const linha = `| ${HOJE} | ${arquivos} | PixelLab API v2 ${[...new Set(feitos.map((x) => EP[x.r.modelo]))].join(', ')} | Mapa da Expedição, receitas ${rids.map((rid) => {
    const r = RECEITAS[rid];
    return `\`${rid}\` (${r.w}×${r.h}${r.base ? `, rascunho \`base/${r.base}\`${r.forca ? ` com força ${r.forca}` : ' como referência'}` : ''}; seeds ${feitos.filter((x) => x.rid === rid).map((x) => x.seed).join('/')})`;
  }).join(', ')}; o texto de cada uma em \`prototype/tools/pixellab-mapa.mjs\` | ${fmt(geracoes)} ${geracoes === 1 ? 'geração' : 'gerações'} da cota | Não (candidatas; a que vai para o jogo fica em \`mapa/escolhas.json\`) |`;
  const linhas = fs.readFileSync(ARQ_ASSETS, 'utf8').split('\n');
  const igual = linhas.findIndex((l) => l.startsWith('|') && (l.split('|')[2] || '').trim() === arquivos);
  if (igual >= 0) linhas[igual] = linha;
  else linhas.splice(linhas.reduce((u, l, i) => (l.startsWith('|') ? i : u), -1) + 1, 0, linha);
  fs.writeFileSync(ARQ_ASSETS, linhas.join('\n'));
}

// --escolher nome=candidata: copia a candidata para mapa/<nome>.png e anota em escolhas.json (sem rede)
function escolher(pares) {
  const esc = fs.existsSync(ARQ_ESCOLHAS) ? JSON.parse(fs.readFileSync(ARQ_ESCOLHAS, 'utf8')) : {};
  for (const par of pares) {
    const [nome, cand] = par.split('=');
    const src = path.join(DIR_CAND, cand + '.png');
    if (!nome || !cand || !fs.existsSync(src)) sair(`--escolher ${par}: não achei candidatas/${cand}.png`);
    fs.copyFileSync(src, path.join(DIR_MAPA, nome + '.png'));
    esc[nome] = cand;
    console.log(`${nome} = ${cand}`);
  }
  fs.writeFileSync(ARQ_ESCOLHAS, JSON.stringify(Object.fromEntries(Object.keys(esc).sort().map((k) => [k, esc[k]])), null, 1) + '\n');
}

async function main() {
  const a = args(process.argv.slice(2));
  if (a.escolher.length) return escolher(a.escolher);
  const itens = plano(a.lote), novos = itens.filter((x) => !x.cru), previsto = novos.reduce((n, x) => n + x.custo, 0);
  if (!a.gerar) {
    console.log(`DRY-RUN (sem --gerar): nenhuma chamada à API. Lote "${a.lote}".`);
    itens.forEach((x, i) => console.log(`${String(i + 1).padStart(3)}. ${x.cru ? 'REAPROVEITA raw/' : 'POST ' + EP[x.r.modelo]}  ${x.rotulo.padEnd(34)} ${x.r.w}×${x.r.h}${x.r.base ? ' base ' + x.r.base + (x.r.forca ? ' força ' + x.r.forca : ' (referência)') : ''}  ${x.cru ? '0' : '~' + x.custo} geração(ões)`));
    console.log(`\nTotal previsto: ~${previsto} gerações em ${novos.length} chamadas novas (+ ${itens.length - novos.length} reaproveitadas).`);
    return;
  }
  estado.redeLiberada = true;
  const s0 = await saldo('antes');
  const disponivel = s0.subscription && s0.subscription.generations;
  if (novos.length && !(disponivel >= Math.min(a.teto, previsto))) {
    throw new ErroApi(`saldo do plano (${disponivel}) menor que o necessário: o resto sairia dos créditos em US$; abortado`, { fatal: true });
  }
  const orc = criarOrcamento(a.teto);
  fs.mkdirSync(DIR_CAND, { recursive: true });
  const feitos = [];
  for (const x of itens) {
    let pngs;
    if (x.cru) {
      pngs = fs.existsSync(path.join(DIR_CAND, x.base + '.png')) ? [fs.readFileSync(path.join(DIR_CAND, x.base + '.png'))] : [];
      for (let i = 0; !pngs.length || i < 64; i++) { const f = path.join(DIR_CAND, `${x.base}-${i}.png`); if (!fs.existsSync(f)) break; pngs.push(fs.readFileSync(f)); }
      console.log(`  ${x.rotulo}: reaproveitada (candidatas/)`);
    } else {
      const item = { rotulo: x.rotulo, geracoes: 0 }, ep = EP[x.r.modelo];
      orc.maximo[ep] = Math.max(orc.maximo[ep] || 0, x.custo);   // a 1ª chamada do Pro já reserva o custo dele
      let res;
      try {
        res = await pago(orc, ep, item, () => executar(x.r, x.corpo));
      } catch (e) {
        if (e instanceof TetoAtingido) { console.log(`  ${e.message}`); break; }
        throw e;
      }
      pngs = res.imagens.map((im) => bufDe(im, x.rotulo));
      if (!pngs.length) throw new ErroApi(`${x.rotulo}: resposta sem imagem`, { fatal: true });
      gravarCru(DIR_RAW, x.base, ep, x.corpo, res, []);   // só o .json: as imagens ficam em candidatas/
    }
    pngs.forEach((png, i) => {
      const d = decodePng(png);
      if (d.width !== x.r.w || d.height !== x.r.h) throw new ErroApi(`${x.rotulo}: ${d.width}×${d.height}, esperado ${x.r.w}×${x.r.h}`, { fatal: true });
      fs.writeFileSync(path.join(DIR_CAND, (pngs.length === 1 ? x.base : `${x.base}-${i}`) + '.png'), png);
    });
    feitos.push({ rid: x.rid, r: x.r, seed: x.seed, n: pngs.length });
  }
  if (feitos.length && orc.gasto > 0) registrarLote(a.lote, feitos, orc.gasto);
  await saldo('depois');
  console.log(`Gerações gastas neste lote: ${fmt(orc.gasto)} de teto ${a.teto}, em ${orc.chamadas} chamadas pagas.`);
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
