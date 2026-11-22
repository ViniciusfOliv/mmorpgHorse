// prototype/tools/arte-icones-pro.mjs — ícones complexos em 24 × 24 pelo modo Pro do PixelLab (`/generate-image-v2`),
// (2026-11-22, etapa 8: os ícones antigos de 32×32 que este script usava como referência saíram de prototype/assets/icons/;
// para gerar de novo, recupere a pasta do histórico do git. Os finais estão em prototype/assets/arte/icones/.)
// etapa 4 da direção de arte. O /resize falhou em 16 e em 24 (2026-11-20); o Pro em 16–32 px devolve 64 candidatos por
// chamada de 10 gerações, já na paleta mestra (target_palette), com:
//   reference_images  o ícone atual de 32 × 32 (o desenho que o Vinicius já aprovou: o assunto);
//   style_image       uma folha com os ícones de 16 × 16 desenhados em código (o traço aprovado: contorno, luz, detalhe).
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/arte-icones-pro.mjs --lote teste [--gerar] [--teto-pl N]
//   Sem --gerar é SEMPRE dry-run. Pedido já gravado em raw/ é reaproveitado. Só cota do plano (aborta se cobrar US$).
// Saída: crus em prototype/assets/arte/raw/icones24pro/<id>/, candidatos quantizados em
// prototype/assets/arte/icones24pro/<id>/<n>.png e uma folha prototype/arte/folha-icones24pro.html.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, estado, chamar, esperarJob, saldo, fmt, imagem } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, quantizar, separarFolha } from './arte-paleta.mjs';
import { MAPAS, desenhar } from './icones16-mapas.mjs';

const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte');
const ARQ_GASTO = path.join(DIR, 'raw', 'gasto.json');
const TESTE = {
  'aba-estabulo': 'a horse head seen from the side, facing right, with a mane, as a game ui icon',
  'slot-sela': 'a horse riding saddle seen from the side, brown leather with a gold trim, as a game ui icon',
  'liga-ouro': 'a gold shield badge with a dark horse head silhouette in the middle, as a game ui icon',
};
// lote complexos (aprovado pelo Vinicius em 2026-11-20, ~170 gerações): os outros 17 ícones de desenho elaborado.
// raridade e pódio: gera-se um (rar-raro, podio-1) e as outras cores saem por troca de paleta em código.
const COMPLEXOS = {
  'slot-armadura': 'horse barding armor with chest and flank plates, seen from the side',
  'slot-testeira': 'horse head chamfron armor plate with a small crest, seen from the side',
  'slot-estribos': 'a single stirrup iron, D-shaped metal loop with a flat footplate, hanging from a short leather strap',
  'ui-perfil': 'jockey riding helmet with a short visor, side view',
  'ins-fogo': 'round pin badge with a flame emblem inside a ring',
  'ins-agua': 'round pin badge with a water drop emblem inside a ring',
  'ins-grama': 'round pin badge with a leaf emblem inside a ring',
  'rar-raro': 'blue round medallion with a white horse head and four small blue sparkles',
  'podio-1': 'gold medal hanging from a ribbon',
  'sk-canto-da-iara': 'seashell with two music notes',
  'sk-casco-firme': 'horse hoof pressing down on a rock step',
  'sk-chama-final': 'flame shaped like an arrow pointing right',
  'sk-folego-de-montanha': 'small mountain with a puff of breath',
  'sk-nascente': 'small blue water spring bubbling up from a gray rock, single isolated object',
  'sk-nevoa-amiga': 'soft mist cloud with a small leaf',
  'sk-pe-na-chuva': 'horseshoe under falling raindrops',
  'sk-sol-a-pino': 'blazing sun with sharp rays',
};
// lote complexos2 (aprovado pelo Vinicius em 2026-11-20, 30 gerações): os 3 que não ficaram bons desenhados em código
const COMPLEXOS2 = {
  'st-forca': 'a strong flexed arm showing the biceps muscle, side view',
  'sk-tipo-grama': 'a small tree whose thick roots grip the ground, roots spreading into the soil',
  'sk-drift': 'two curved black tire skid marks swooping in an arc on the ground, with small gray dust puffs at the end',
};
// escolhas do Vinicius no teste (2026-11-20): o número do ícone em limpos/
export const ESCOLHAS = { 'aba-estabulo': '00', 'liga-ouro': '00', 'slot-sela': '19' };
const ESTILO = 'pixel art game ui icon, 24x24, centered, clean bold shapes, dark single color outline, light from the upper left';

function folhaEstilo() {
  // os ícones de código em grade 4 × 2 (64 × 32), 1:1
  const ids = Object.keys(MAPAS).slice(0, 8), w = 64, h = 32, rgba = new Uint8Array(w * h * 4);
  ids.forEach((id, k) => {
    const ic = desenhar(id), ox = (k % 4) * 16, oy = Math.floor(k / 4) * 16;
    for (let y = 0; y < 16; y++) rgba.set(ic.rgba.subarray(y * 64, y * 64 + 64), ((oy + y) * w + ox) * 4);
  });
  return encodePng({ width: w, height: h, rgba });
}
function args() {
  const a = { lote: 'teste', gerar: false, tetoPl: null };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--lote') a.lote = v[++i];
    else if (v[i] === '--gerar') a.gerar = true;
    else if (v[i] === '--teto-pl') a.tetoPl = Number(v[++i]);
    else throw new Error('opção desconhecida: ' + v[i]);
  }
  if (!['teste', 'complexos', 'complexos2'].includes(a.lote)) throw new Error('lote desconhecido: ' + a.lote);
  return a;
}
const lerJson = (f, p) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : p);
const semB64 = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)));
const assinatura = p => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);

async function main() {
  const a = args(), estilo = folhaEstilo();
  const LOTE = a.lote === 'teste' ? TESTE : a.lote === 'complexos2' ? COMPLEXOS2 : COMPLEXOS;
  const seed0 = a.lote === 'teste' ? 9301 : a.lote === 'complexos2' ? 9331 : 9311;
  const lista = Object.entries(LOTE).map(([id, desc], i) => ({ id, pedido: {
    description: `${desc}, ${ESTILO}`, image_size: { width: 24, height: 24 }, no_background: true, seed: seed0 + i,
    reference_images: [{ image: imagem(fs.readFileSync(path.join(RAIZ, 'prototype', 'assets', 'icons', id + '.png'))),
      size: { width: 32, height: 32 }, usage_description: 'the subject and its main shapes (what to draw)' }],
    style_image: { image: imagem(estilo), size: { width: 64, height: 32 }, usage_description: 'the pixel art style: outline, shading and detail level' },
    style_options: { color_palette: false, outline: true, detail: true, shading: true },
    target_palette: { colors: RESURRECT64.map(h => '#' + h), name: 'Resurrect 64' },
  } }));
  const teto = a.tetoPl ?? lista.length * 10;
  console.log(`Ícones Pro 24×24, lote ${a.lote}: ${lista.length} chamadas × 10 gerações (64 candidatos cada) = ~${lista.length * 10}. Teto: ${teto}`);
  for (const c of lista) console.log(`  ${c.id}  /generate-image-v2 24×24, seed ${c.pedido.seed}`);
  if (!a.gerar) { console.log('\nDry-run: nada foi gerado. Use --gerar para gastar.'); return; }
  estado.redeLiberada = true;
  const gasto = lerJson(ARQ_GASTO, { pl: 0, usd: 0, chamadas: [] });
  let pl = 0;
  await saldo('do PixelLab antes');
  for (const c of lista) {
    const raw = path.join(DIR, 'raw', 'icones24pro', c.id), fim = path.join(DIR, 'icones24pro', c.id);
    fs.mkdirSync(raw, { recursive: true }); fs.mkdirSync(fim, { recursive: true });
    const arqJson = path.join(raw, 'pedido.json'), assin = assinatura(c.pedido), salvo = lerJson(arqJson, null);
    let imgs;
    if (salvo && salvo.assinatura === assin) { imgs = fs.readdirSync(raw).filter(f => f.endsWith('.png')).sort().map(f => fs.readFileSync(path.join(raw, f))); console.log(`  ${c.id}: reaproveitado`); }
    else {
      if (pl + 10 > teto) { console.log(`  ${c.id}: PAROU (teto de ${teto})`); break; }
      const post = await chamar('POST', '/generate-image-v2', c.pedido);
      const job = await esperarJob(post.background_job_id);
      const g = Math.max((post.usage && post.usage.generations) || 0, (job.usage && job.usage.generations) || 0, (job.last_response && job.last_response.usage && job.last_response.usage.generations) || 0) || 10;
      for (const r of [post, job, job.last_response]) if (r && r.usage && r.usage.type === 'usd' && r.usage.usd > 0) throw new Error('cobrança inesperada em US$');
      pl += g; gasto.pl += g; gasto.chamadas.push({ base: `icones24pro/${c.id}`, geracoes: g, data: new Date().toISOString() });
      const lr = job.last_response || {}, lista64 = lr.images || lr.image && [lr.image] || [];
      imgs = lista64.map(im => Buffer.from(im.base64, 'base64'));
      imgs.forEach((b, n) => fs.writeFileSync(path.join(raw, String(n).padStart(2, '0') + '.png'), b));
      fs.writeFileSync(arqJson, JSON.stringify({ assinatura: assin, pedido: semB64(c.pedido), resposta: semB64({ post, job }) }, null, 2));
      fs.writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2));
      console.log(`  ${c.id}: ${fmt(g)} gerações, ${imgs.length} candidatos [total ${fmt(pl)}/${teto}]`);
    }
    imgs.forEach((b, n) => fs.writeFileSync(path.join(fim, String(n).padStart(2, '0') + '.png'), encodePng(quantizar(decodePng(b), RESURRECT64))));
    // o Pro corta os 64 candidatos de uma folha 8 × 8 com a grade fora do lugar (cada quadro traz pedaços dos vizinhos
    // e o ícone sai cortado): remonta a folha e separa cada ícone inteiro pelos grupos de pixels (separarFolha)
    const L = 24, cols = 8, folha = { width: L * cols, height: L * Math.ceil(imgs.length / cols), rgba: null };
    folha.rgba = new Uint8Array(folha.width * folha.height * 4);
    imgs.forEach((b, n) => {
      const q = quantizar(decodePng(b), RESURRECT64), ox = (n % cols) * L, oy = Math.floor(n / cols) * L;
      for (let y = 0; y < L; y++) folha.rgba.set(q.rgba.subarray(y * L * 4, (y + 1) * L * 4), ((oy + y) * folha.width + ox) * 4);
    });
    const limpos = path.join(fim, 'limpos');
    fs.rmSync(limpos, { recursive: true, force: true }); fs.mkdirSync(limpos, { recursive: true });
    separarFolha(folha, L).forEach((ic, k) => fs.writeFileSync(path.join(limpos, String(k).padStart(2, '0') + '.png'), encodePng(ic)));
  }
  await saldo('do PixelLab depois');
  // folha: os candidatos de cada ícone em grade, ampliados 4×, ao lado do atual
  const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const secoes = Object.keys({ ...TESTE, ...COMPLEXOS, ...COMPLEXOS2 }).map(id => {
    const d = path.join(DIR, 'icones24pro', id, 'limpos');
    if (!fs.existsSync(d)) return '';
    const fs_ = fs.readdirSync(d).filter(f => f.endsWith('.png')).sort();
    return `<h2>${id}</h2><div class="grade"><figure><img src="${uri(path.join(RAIZ, 'prototype', 'assets', 'icons', id + '.png'))}" style="width:96px"><figcaption>atual</figcaption></figure>`
      + fs_.map(f => `<figure><img src="${uri(path.join(d, f))}" style="width:96px"><figcaption>${f.replace('.png', '')}</figcaption></figure>`).join('') + '</div>';
  }).join('');
  fs.writeFileSync(path.join(RAIZ, 'prototype', 'arte', 'folha-icones24pro.html'), `<title>Ícones Pro 24×24</title>
<style>:root{color-scheme:dark} body{background:#2e222f;color:#c7dcd0;font:14px monospace;margin:0} .p{padding:16px max(16px,env(safe-area-inset-left,0px))}
h2{color:#f9c22b;font-weight:normal} .grade{display:flex;flex-wrap:wrap;gap:6px} figure{margin:0;text-align:center} img{image-rendering:pixelated;background:#3e3546;display:block}
figcaption{color:#9babb2;font-size:12px}</style><div class="p"><h1 style="color:#f9c22b;font-weight:normal">Ícones complexos 24×24 · modo Pro</h1>${secoes}</div>`);
  console.log(`Gasto: ${fmt(pl)} gerações do PixelLab · folha em prototype/arte/folha-icones24pro.html`);
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
