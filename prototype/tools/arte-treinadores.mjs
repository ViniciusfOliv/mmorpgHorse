// prototype/tools/arte-treinadores.mjs — etapa 5 da direção de arte: os 15 oponentes dos ginásios na escala do guia.
// Hoje a arte deles (pixellab-treinadores.mjs, escolhas em prototype/assets/pixellab/treinadores/escolhas.json) é uma
// figura de 58 a 64 px num quadro de 64 × 64, 1,5 vez maior que os cavalos (que o guia mostra 1:1). Aqui saem, pelo modo
// Pro do PixelLab (`/generate-image-v2`), com a arte atual de referência (roupa, cores, o que o Vinicius já escolheu):
//   corpo  a figura inteira com ~40 px de altura, gerada num quadro de 48 × 48 e recortada para 32 × 48 (pés embaixo);
//   busto  cabeça e ombros em 64 × 64, para os cartões e o cabeçalho do duelo.
// Paleta mestra travada (target_palette Resurrect 64); depois, alfa binário e a paleta conferida por código.
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/arte-treinadores.mjs --lote piloto|corpos|bustos [--gerar] [--teto-pl N]
//   Sem --gerar é SEMPRE dry-run: lista as chamadas e o total, sem rede. Pedido já gravado em raw/ é reaproveitado.
//   --reprocessar  refaz os candidatos a partir dos crus, sem rede. Só cota do plano (aborta se uma resposta cobrar US$).
// Lotes: piloto = a Capitã Labareda (corpo + busto, ~20 gerações), para acertar o pedido antes do resto;
//        corpos e bustos = os outros 14 (~140 gerações cada).
// Saída: crus em prototype/assets/arte/raw/treinadores/<id>-<tipo>/, candidatos em
// prototype/assets/arte/treinadores/<id>-<tipo>/NN.png e a folha prototype/arte/folha-treinadores.html.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, estado, chamar, esperarJob, saldo, fmt, imagem } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, quantizar, conferir } from './arte-paleta.mjs';

const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte');
const DIR_ATUAL = path.join(RAIZ, 'prototype', 'assets', 'pixellab', 'treinadores');
const ARQ_GASTO = path.join(DIR, 'raw', 'gasto.json');
// o essencial de cada um (a roupa inteira vem da imagem de referência; o texto completo está no pixellab-treinadores.mjs)
const QUEM = {
  'capita-labareda': 'fire gym leader, young woman captain, red captain hat with a flame plume, red coat with gold epaulettes, white trousers, black riding boots',
  'recruta-fagulha': 'fire gym recruit, cheerful teenage girl with short orange hair, red cap, red tunic, brown trousers',
  'cabo-tocha': 'fire gym corporal, young man, red forage cap, red jacket, holding a burning torch, dark trousers',
  'sargento-candeeiro': 'fire gym sergeant, stout man with a thick mustache, red peaked cap, red coat, holding a brass oil lantern',
  'tenente-coivara': 'fire gym lieutenant, tall woman with dark braided hair, red officer cap, dark red coat with a gold sash, white trousers',
  'mestre-aguaceiro': 'water gym leader, old riverboat master with a long white beard, navy captain hat, long dark blue coat, wooden staff',
  'recruta-orvalho': 'water gym recruit, shy young boy with light blue hair, white sailor cap, white and blue sailor uniform',
  'cabo-goteira': 'water gym corporal, young woman with a black bob haircut, blue sailor cap, navy sailor jumper, small metal bucket',
  'sargento-correnteza': 'water gym sergeant, broad-shouldered man with a short grey beard, navy cap, blue naval coat, coiled rope on the shoulder',
  'tenente-cacimba': 'water gym lieutenant, calm woman with long dark blue hair, white officer cap, teal naval coat, brass spyglass',
  'dona-capineira': 'grass gym leader, strong older woman with grey hair in a bun, wide straw hat, green and brown leather jacket, long green skirt, walking cane',
  'recruta-broto': 'grass gym recruit, small energetic kid with messy green hair, green bandana, light green shirt, brown shorts',
  'cabo-carrapicho': 'grass gym corporal, wiry young man with spiky brown hair, olive green cap, green ranger shirt, brown trousers',
  'sargento-juazeiro': 'grass gym sergeant, sturdy man with a dark beard, brown leather cowboy hat, leather vest over a green shirt',
  'tenente-aroeira': 'grass gym lieutenant, confident woman with curly dark hair, green officer cap, dark green ranger coat, beige trousers',
};
const TIPOS = {
  corpo: { lado: 48, cand: 25, seed: 9401,
    estilo: 'full body pixel art game character standing, facing front, about 40 pixels tall, whole figure visible from head to boots, '
      + 'small character scale like a horse racing game sprite, dark single color outline, light from the upper left' },
  busto: { lado: 64, cand: 16, seed: 9501,
    estilo: 'pixel art portrait bust, head and shoulders, three-quarter view facing left, expressive face, '
      + 'dark single color outline, light from the upper left, game dialogue portrait' },
};
const IDS = Object.keys(QUEM), OUTROS = IDS.filter(i => i !== 'capita-labareda');

function args() {
  const a = { lote: 'piloto', gerar: false, tetoPl: null, reprocessar: false };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--lote') a.lote = v[++i];
    else if (v[i] === '--gerar') a.gerar = true;
    else if (v[i] === '--reprocessar') a.reprocessar = true;
    else if (v[i] === '--teto-pl') a.tetoPl = Number(v[++i]);
    else throw new Error('opção desconhecida: ' + v[i]);
  }
  if (!['piloto', 'corpos', 'bustos'].includes(a.lote)) throw new Error('lote desconhecido: ' + a.lote);
  return a;
}
const lerJson = (f, p) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : p);
const semB64 = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)));
const assinatura = p => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);

function chamadas(lote) {
  const escolhas = JSON.parse(fs.readFileSync(path.join(DIR_ATUAL, 'escolhas.json'), 'utf8'));
  const pares = lote === 'piloto' ? [['capita-labareda', 'corpo'], ['capita-labareda', 'busto']]
    : OUTROS.map(id => [id, lote === 'corpos' ? 'corpo' : 'busto']);
  return pares.map(([id, tipo]) => {
    const T = TIPOS[tipo], atual = path.join(DIR_ATUAL, `${id}-s${escolhas[id]}.png`);
    return { id, tipo, base: `${id}-${tipo}`, pedido: {
      description: `${QUEM[id]}, ${T.estilo}`, image_size: { width: T.lado, height: T.lado }, no_background: true,
      seed: T.seed + IDS.indexOf(id),
      reference_images: [{ image: imagem(fs.readFileSync(atual)), size: { width: 64, height: 64 },
        usage_description: tipo === 'corpo' ? 'the character: same person, same clothes and colors, redrawn smaller'
          : 'the character: same face, hair, hat and clothes, shown as a head and shoulders portrait' }],
      target_palette: { colors: RESURRECT64.map(h => '#' + h), name: 'Resurrect 64' },
    } };
  });
}

// o maior grupo de pixels opacos (com 8 vizinhos) e o que estiver colado nele — tira os restos dos vizinhos da folha
function principal(img) {
  const W = img.width, H = img.height, p = img.rgba, g = new Int32Array(W * H).fill(-1), tam = [];
  for (let i = 0; i < W * H; i++) {
    if (!p[i * 4 + 3] || g[i] >= 0) continue;
    const id = tam.length, fila = [i]; g[i] = id; let n = 0;
    while (fila.length) {
      const j = fila.pop(), x = j % W, y = (j / W) | 0; n++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, k = yy * W + xx;
        if (xx >= 0 && xx < W && yy >= 0 && yy < H && p[k * 4 + 3] && g[k] < 0) { g[k] = id; fila.push(k); }
      }
    }
    tam.push(n);
  }
  const maior = tam.indexOf(Math.max(...tam)), out = new Uint8Array(p);
  for (let i = 0; i < W * H; i++) if (g[i] !== maior && tam[g[i]] < 12) out.fill(0, i * 4, i * 4 + 4);
  return { width: W, height: H, rgba: out };
}
// corpo: recorta pela caixa dos pixels opacos e põe num quadro 32 × 48, centrado na horizontal, pés na última linha
function quadroCorpo(img) {
  const W = img.width, H = img.height, p = img.rgba;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p[(y * W + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const out = { width: 32, height: 48, rgba: new Uint8Array(32 * 48 * 4) }, w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (x1 < 0 || w > 32 || h > 48) return null;
  const ox = Math.floor((32 - w) / 2), oy = 48 - h;
  for (let y = 0; y < h; y++) out.rgba.set(p.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x1 + 1) * 4), ((oy + y) * 32 + ox) * 4);
  return { img: out, altura: h };
}

function processar(c, bufs) {
  const fim = path.join(DIR, 'treinadores', c.base);
  fs.rmSync(fim, { recursive: true, force: true }); fs.mkdirSync(fim, { recursive: true });
  const info = [];
  bufs.forEach((b, n) => {
    let img = principal(quantizar(decodePng(b), RESURRECT64)), altura = null;
    if (c.tipo === 'corpo') { const q = quadroCorpo(img); if (!q) return; img = q.img; altura = q.altura; }
    const k = conferir(img, RESURRECT64), nome = String(n).padStart(2, '0');
    fs.writeFileSync(path.join(fim, nome + '.png'), encodePng(img));
    info.push({ n: nome, altura, fora: k.fora, falso: k.falso });
  });
  fs.writeFileSync(path.join(fim, 'info.json'), JSON.stringify(info, null, 1));
  return info;
}

function folha() {
  const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const escolhas = JSON.parse(fs.readFileSync(path.join(DIR_ATUAL, 'escolhas.json'), 'utf8'));
  const secoes = IDS.flatMap(id => ['corpo', 'busto'].map(tipo => {
    const d = path.join(DIR, 'treinadores', `${id}-${tipo}`);
    if (!fs.existsSync(d)) return '';
    const info = lerJson(path.join(d, 'info.json'), []), z = tipo === 'corpo' ? 3 : 2;
    const escala = tipo === 'corpo' && info.length ? `<figure class="escala"><div><img src="${uri(path.join(RAIZ, 'prototype', 'assets', 'pixellab', 'molde-padrao-chamas-parado.png'))}" style="width:192px;margin-bottom:-12px"><img src="${uri(path.join(d, info[0].n + '.png'))}" style="width:96px"></div><figcaption>escala: cavalo 1:1 e o ${info[0].n}</figcaption></figure>` : '';
    return `<h2>${id} · ${tipo}</h2><div class="grade">${escala}<figure><img src="${uri(path.join(DIR_ATUAL, `${id}-s${escolhas[id]}.png`))}" style="width:${64 * z}px"><figcaption>atual (64)</figcaption></figure>`
      + info.map(i => `<figure><img src="${uri(path.join(d, i.n + '.png'))}" style="width:${(tipo === 'corpo' ? 32 : 64) * z}px"><figcaption>${i.n}${i.altura ? ` · ${i.altura} px` : ''}</figcaption></figure>`).join('') + '</div>';
  })).join('');
  fs.writeFileSync(path.join(RAIZ, 'prototype', 'arte', 'folha-treinadores.html'), `<title>Treinadores 40 px</title>
<style>:root{color-scheme:dark} body{background:#2e222f;color:#c7dcd0;font:14px monospace;margin:0} .p{padding:16px}
h2{color:#f9c22b;font-weight:normal} .grade{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end} figure{margin:0;text-align:center}
img{image-rendering:pixelated;background:#3e3546;display:block} figcaption{color:#9babb2;font-size:12px} .escala div{display:flex;align-items:flex-end;background:#3e3546} .escala img{background:none}</style>
<div class="p"><h1 style="color:#f9c22b;font-weight:normal">Treinadores · corpo 32×48 (3×) e busto 64×64 (2×)</h1>${secoes}</div>`);
}

async function main() {
  const a = args(), lista = chamadas(a.lote), teto = a.tetoPl ?? lista.length * 10;
  console.log(`Treinadores, lote ${a.lote}: ${lista.length} chamadas Pro × 10 gerações = ~${lista.length * 10}. Teto: ${teto}`);
  for (const c of lista) console.log(`  ${c.base}  /generate-image-v2 ${c.pedido.image_size.width}×${c.pedido.image_size.height} (~${TIPOS[c.tipo].cand} candidatos), seed ${c.pedido.seed}`);
  if (!a.gerar && !a.reprocessar) { console.log('\nDry-run: nada foi gerado. Use --gerar para gastar.'); return; }
  if (a.gerar) estado.redeLiberada = true;
  const gasto = lerJson(ARQ_GASTO, { pl: 0, usd: 0, chamadas: [] });
  let pl = 0;
  if (a.gerar) await saldo('do PixelLab antes');
  for (const c of lista) {
    const raw = path.join(DIR, 'raw', 'treinadores', c.base);
    fs.mkdirSync(raw, { recursive: true });
    const arqJson = path.join(raw, 'pedido.json'), assin = assinatura(c.pedido), salvo = lerJson(arqJson, null);
    let bufs;
    if (salvo && salvo.assinatura === assin) bufs = fs.readdirSync(raw).filter(f => f.endsWith('.png')).sort().map(f => fs.readFileSync(path.join(raw, f)));
    else if (!a.gerar) { console.log(`  ${c.base}: sem cru (pulado)`); continue; }
    else {
      if (pl + 10 > teto) { console.log(`  ${c.base}: PAROU (teto de ${teto})`); break; }
      const post = await chamar('POST', '/generate-image-v2', c.pedido);
      const job = await esperarJob(post.background_job_id);
      for (const r of [post, job, job.last_response]) if (r && r.usage && r.usage.type === 'usd' && r.usage.usd > 0) throw new Error('cobrança inesperada em US$');
      const g = Math.max((post.usage && post.usage.generations) || 0, (job.usage && job.usage.generations) || 0, (job.last_response && job.last_response.usage && job.last_response.usage.generations) || 0) || 10;
      pl += g; gasto.pl += g; gasto.chamadas.push({ base: `treinadores/${c.base}`, geracoes: g, data: new Date().toISOString() });
      const lr = job.last_response || {}, imgs = lr.images || (lr.image && [lr.image]) || [];
      bufs = imgs.map(im => Buffer.from(im.base64, 'base64'));
      bufs.forEach((b, n) => fs.writeFileSync(path.join(raw, String(n).padStart(2, '0') + '.png'), b));
      fs.writeFileSync(arqJson, JSON.stringify({ assinatura: assin, pedido: semB64(c.pedido), resposta: semB64({ post, job }) }, null, 2));
      fs.writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2));
      console.log(`  ${c.base}: ${fmt(g)} gerações, ${bufs.length} candidatos [total ${fmt(pl)}/${teto}]`);
    }
    const info = processar(c, bufs);
    console.log(`    ${info.length} candidatos inteiros${c.tipo === 'corpo' ? `; alturas ${[...new Set(info.map(i => i.altura))].sort((x, y) => x - y).join(', ')} px` : ''}`);
  }
  if (a.gerar) await saldo('do PixelLab depois');
  folha();
  console.log(`Gasto: ${fmt(pl)} gerações do PixelLab · folha em prototype/arte/folha-treinadores.html`);
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
