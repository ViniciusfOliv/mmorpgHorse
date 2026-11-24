// prototype/tools/arte-mapa-mundo.mjs — piloto pago da arte do mapa-múndi dos ginásios (frente 2 das melhorias
// visuais, 2026-11-24). Três testes pequenos para decidir a ferramenta antes de qualquer lote:
//   terreno   a ilha inteira, 256 × 384, vista de cima, sem prédios nem estradas: Fornalha (vulcão) ao norte, Remanso
//             (lago e rio) no meio, Capoeira (mata) ao sul. PixelLab /create-image-pixen (o que fez os mapas das
//             trilhas), 4 seeds — 4 gerações.
//   base      o mesmo terreno, mas partindo do mapa por código da amostra v1 (prototype/assets/arte/mapa-mundo/
//             terreno-codigo.png) como imagem inicial, para guardar a geografia (rio, lago, vulcão, estradas) e ganhar
//             a textura pintada. /create-image-pixflux com init_image, 2 forças × 2 seeds — 4 gerações.
//   ginasios  os três ginásios como objetos do mapa, 64 × 64 com fundo transparente, vista de cima, luz da esquerda:
//             a arena de pedra da Fornalha, a plataforma de tábuas do Remanso e o picadeiro com cerca da Capoeira (os
//             mesmos lugares das arenas da cena do desafio). /create-image-pixen, 2 seeds cada — 6 gerações.
// Total previsto: 14 gerações (teto padrão 15, autorizado para o piloto). As sombras de contato, a luz e a cor casando
// com o chão são feitas por código ao pôr os objetos no mapa (a amostra), não pela IA.
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/arte-mapa-mundo.mjs [--lote terreno|base|ginasios|todos] [--gerar] [--teto N]
//   Sem --gerar é SEMPRE dry-run, sem rede. Pedido já gravado em raw/ é reaproveitado (não cobra de novo).
// Saída: crus em prototype/assets/arte/raw/mapa-mundo/, candidatos quantizados na Resurrect 64 em
// prototype/assets/arte/mapa-mundo/<lote>/ e a folha prototype/arte/folha-mapa-mundo.html.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, estado, chamar, saldo, fmt } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, quantizar, conferir } from './arte-paleta.mjs';

const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte');
const RAW = path.join(DIR, 'raw', 'mapa-mundo');
const ARQ_GASTO = path.join(DIR, 'raw', 'gasto.json');
const ILHA = 'top-down fantasy island world map for a pixel art horse racing RPG, seen from high above: in the north a smoking '
  + 'volcano with glowing lava streams and dark rocky mountains on reddish volcanic ground; in the middle a calm blue lake fed by '
  + 'a winding river that flows east into the sea, surrounded by bright green meadows; in the south a dense forest of round '
  + 'tree canopies with soft drop shadows; sandy beaches and rocky shores all around, deep blue sea at every edge, light from the '
  + 'upper left, rich detailed pixel art like a cozy RPG overworld';
const SEM = ', no buildings, no roads, no paths, no text, no characters';
const GIN = 'game map building seen from high top-down, light from the upper left, soft shadow on the ground, cozy RPG overworld '
  + 'pixel art, centered, fills most of the canvas';
const GINASIOS = {
  fogo: 'a small round stone arena fortress with dark volcanic stone walls, a hot orange sand floor inside, two red banners '
    + 'on poles and two burning braziers at the gate',
  agua: 'a small round wooden arena platform on stilts over blue lake water, plank floor with a pale sand ring in the middle, '
    + 'blue banners on posts and a short wooden pier',
  grama: 'a small round dirt riding ring surrounded by a rustic log fence, in a grassy forest clearing, green banners on '
    + 'poles and two torches at the entrance'
};

function args() {
  const a = { lote: 'todos', gerar: false, teto: 15 };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--lote') a.lote = v[++i];
    else if (v[i] === '--gerar') a.gerar = true;
    else if (v[i] === '--teto') a.teto = Number(v[++i]);
    else throw new Error('opção desconhecida: ' + v[i]);
  }
  if (!['terreno', 'base', 'ginasios', 'todos'].includes(a.lote)) throw new Error('use --lote terreno|base|ginasios|todos');
  return a;
}
const lerJson = (f, p) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : p);
const assinatura = p => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);
const semB64 = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)));

function chamadas(lote) {
  const out = [];
  if (lote === 'terreno' || lote === 'todos') for (const seed of [9901, 9902, 9903, 9904]) out.push({ lote: 'terreno', base: `terreno-s${seed}`, ep: '/create-image-pixen',
    pedido: { description: ILHA + SEM, image_size: { width: 256, height: 384 }, view: 'high top-down', outline: 'lineless', detail: 'highly detailed', seed } });
  if (lote === 'base' || lote === 'todos') {
    const init = fs.readFileSync(path.join(DIR, 'mapa-mundo', 'terreno-codigo.png')).toString('base64');
    for (const forca of [250, 450]) for (const seed of [9911, 9912]) out.push({ lote: 'base', base: `base-f${forca}-s${seed}`, ep: '/create-image-pixflux',
      pedido: { description: ILHA + SEM, image_size: { width: 256, height: 384 }, view: 'high top-down', outline: 'lineless', shading: 'detailed shading',
        detail: 'highly detailed', init_image: { type: 'base64', base64: init }, init_image_strength: forca, seed } });
  }
  if (lote === 'ginasios' || lote === 'todos') for (const [g, d] of Object.entries(GINASIOS)) for (const k of [0, 1]) {
    const seed = 9921 + Object.keys(GINASIOS).indexOf(g) * 10 + k;
    out.push({ lote: 'ginasios', base: `ginasio-${g}-s${seed}`, ep: '/create-image-pixen',
      pedido: { description: `${d}, ${GIN}`, image_size: { width: 64, height: 64 }, view: 'high top-down', outline: 'selective outline', detail: 'highly detailed', no_background: true, seed } });
  }
  return out;
}

function folha() {
  const sec = ['terreno', 'base', 'ginasios'].map(l => {
    const d = path.join(DIR, 'mapa-mundo', l);
    if (!fs.existsSync(d)) return '';
    const imgs = fs.readdirSync(d).filter(f => f.endsWith('.png')).sort().map(f => {
      const b64 = fs.readFileSync(path.join(d, f)).toString('base64'), esc = l === 'ginasios' ? 4 : 2;
      const im = decodePng(fs.readFileSync(path.join(d, f)));
      return `<figure><img src="data:image/png;base64,${b64}" width="${im.width * esc}" height="${im.height * esc}"><figcaption>${f}</figcaption></figure>`;
    }).join('');
    return `<h2>${l}</h2><div class="g">${imgs}</div>`;
  }).join('');
  fs.writeFileSync(path.join(RAIZ, 'prototype', 'arte', 'folha-mapa-mundo.html'), `<title>Piloto do mapa-múndi</title>
<style>body{background:#2e222f;color:#c7dcd0;font:14px system-ui;margin:0}.p{padding:16px}.g{display:flex;flex-wrap:wrap;gap:12px}
img{image-rendering:pixelated;background:#3e3546}figure{margin:0}figcaption{color:#9babb2;font-size:12px}</style>
<div class="p"><h1 style="color:#f9c22b;font-weight:normal">Piloto do mapa-múndi (PixelLab)</h1>${sec}</div>`);
}

async function main() {
  const a = args(), lista = chamadas(a.lote);
  console.log(`Mapa-múndi, lote ${a.lote}: ${lista.length} chamadas, ~${lista.length} gerações do PixelLab (teto ${a.teto})`);
  for (const c of lista) console.log(`  ${c.base}  ${c.ep} ${c.pedido.image_size.width}×${c.pedido.image_size.height}, seed ${c.pedido.seed}`);
  if (!a.gerar) { console.log('\nDry-run: nada foi gerado. --gerar gasta (até o teto).'); return; }
  estado.redeLiberada = true;
  const gasto = lerJson(ARQ_GASTO, { pl: 0, usd: 0, chamadas: [] });
  let pl = 0;
  await saldo('do PixelLab antes');
  fs.mkdirSync(RAW, { recursive: true });
  for (const c of lista) {
    const arqJson = path.join(RAW, c.base + '.json'), assin = assinatura(c.pedido), salvo = lerJson(arqJson, null), fim = path.join(DIR, 'mapa-mundo', c.lote);
    fs.mkdirSync(fim, { recursive: true });
    let png;
    if (salvo && salvo.assinatura === assin) png = fs.readFileSync(path.join(RAW, salvo.arquivo));
    else {
      if (pl + 1 > a.teto) { console.log(`  ${c.base}: PAROU (teto de ${a.teto} gerações)`); break; }
      const r = await chamar('POST', c.ep, c.pedido);
      if (r.usage && r.usage.type === 'usd' && r.usage.usd > 0) throw new Error('cobrança inesperada em US$ no PixelLab');
      const g = (r.usage && r.usage.generations) ?? 1;
      pl += g; gasto.pl += g; gasto.chamadas.push({ base: `mapa-mundo/${c.base}`, geracoes: g, data: new Date().toISOString() });
      png = Buffer.from(r.image.base64, 'base64');
      fs.writeFileSync(path.join(RAW, c.base + '.png'), png);
      fs.writeFileSync(arqJson, JSON.stringify({ assinatura: assin, endpoint: c.ep, pedido: semB64(c.pedido), arquivo: c.base + '.png' }, null, 2));
      fs.writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2));
      console.log(`  ${c.base}: ${fmt(g)} geração(ões) [total ${fmt(pl)}/${a.teto}]`);
    }
    const img = quantizar(decodePng(png), RESURRECT64), k = conferir(img, RESURRECT64);
    fs.writeFileSync(path.join(fim, c.base + '.png'), encodePng(img));
    console.log(`    ${c.base}: ${img.width}×${img.height}, fora ${k.fora}, alfa ${k.alfa}, falso ${k.falso ? 'SIM' : 'não'}`);
  }
  await saldo('do PixelLab depois');
  folha();
  console.log(`Gasto nesta rodada: ${fmt(pl)} gerações · folha em prototype/arte/folha-mapa-mundo.html`);
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
