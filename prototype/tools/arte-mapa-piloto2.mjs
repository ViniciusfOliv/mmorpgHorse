// prototype/tools/arte-mapa-piloto2.mjs — segunda rodada de pilotos da frente 2 (mapa dos ginásios), 2026-11-24, os três
// confirmados pelo Vinicius neste chat, cada um com o seu teto:
//   capoeira  o ginásio da Capoeira refeito sem a mata em volta: /create-image-pixen 64×64 sem fundo, 3 seeds (teto 3).
//   pecas     o "mapa montado": 5 conjuntos de terreno por cantos (/create-tileset standard, peças de 16 px, 1 geração cada:
//             mar/areia, areia/grama, grama/rocha vulcânica, rocha/lava, grama/terra batida) e 4 objetos sem fundo
//             (/create-image-pixen: 2 árvores 32×32, serra e vulcão 64×64). A montagem é por código (--montar, sem rede),
//             seguindo a geografia do mapa v1 (prototype/assets/arte/mapa-mundo/terreno-codigo.png). Teto 12.
//   cavalo    a Brasa (molde do jogo recolorido: prototype/assets/arte/desafio/brasa-*-64.png) para a nova cena de
//             desafio: (a) /create-character-with-8-directions standard, template horse, a partir do nosso molde como
//             "east", em 64 e 96 px (1 geração cada); (b) /generate-with-style-v2 com o molde como estilo, de costas (16
//             candidatos de 64 px, 10 gerações). Teto 14.
// O custo real é medido pelo saldo antes e depois de cada chamada (o "usage" da resposta já veio menor que o saldo) e
// gravado em prototype/assets/arte/raw/gasto.json. As referências do Vinicius (vitrine do PixelLab) NÃO entram nas chamadas.
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/arte-mapa-piloto2.mjs --lote capoeira|pecas|cavalo [--gerar] [--teto N]
//       node prototype/tools/arte-mapa-piloto2.mjs --montar        (monta o mapa de peças a partir do que já foi gerado)
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, estado, chamar, esperarJob } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, quantizar } from './arte-paleta.mjs';

const ARTE = path.join(RAIZ, 'prototype', 'assets', 'arte');
const RAW = path.join(ARTE, 'raw', 'mapa-piloto2');
const ARQ_GASTO = path.join(ARTE, 'raw', 'gasto.json');
const b64 = f => fs.readFileSync(f).toString('base64');
const img = f => ({ type: 'base64', base64: b64(f), format: 'png' });
const OBJ = 'isolated game map object seen from high top-down, light from the upper left, cozy RPG overworld pixel art, transparent background, no shadow';

const TETOS = { capoeira: 3, pecas: 12, cavalo: 14, frente: 10 };
function chamadas(lote) {
  if (lote === 'capoeira') return [9951, 9952, 9953].map(seed => ({ base: `ginasio-grama-s${seed}`, dir: path.join(ARTE, 'mapa-mundo', 'ginasios'), ep: '/create-image-pixen',
    pedido: { description: 'a small round dirt riding ring enclosed by a rustic wooden log fence with posts, green banners on two poles and two lit torches at the '
      + 'open gate, the ring alone with nothing around it, no trees, no grass outside the fence, ' + OBJ, image_size: { width: 64, height: 64 },
      view: 'high top-down', outline: 'selective outline', detail: 'highly detailed', no_background: true, seed } }));
  if (lote === 'pecas') {
    const T = (base, lower, upper, trans, seed) => ({ base, dir: path.join(ARTE, 'mapa-mundo', 'pecas'), ep: '/create-tileset', async: 'tileset',
      pedido: { lower_description: lower, upper_description: upper, transition_description: trans, tile_size: { width: 16, height: 16 }, mode: 'standard',
        view: 'high top-down', detail: 'highly detailed', shading: 'detailed shading', transition_size: 0.25, raggedness: 0.5, seed } });
    const O = (base, w, desc, seed) => ({ base, dir: path.join(ARTE, 'mapa-mundo', 'pecas'), ep: '/create-image-pixen',
      pedido: { description: desc + ', ' + OBJ, image_size: { width: w, height: w }, view: 'high top-down', outline: 'selective outline', detail: 'highly detailed', no_background: true, seed } });
    return [
      T('tiles-mar-areia', 'deep blue sea water with small waves', 'pale golden sandy beach', 'white sea foam on the shoreline', 9961),
      T('tiles-areia-grama', 'pale golden sandy beach', 'lush green meadow grass', 'grass tufts over sand', 9962),
      T('tiles-grama-rocha', 'lush green meadow grass', 'dark reddish volcanic rock ground with cracks', 'scattered pebbles', 9963),
      T('tiles-rocha-lava', 'dark reddish volcanic rock ground with cracks', 'glowing orange molten lava', 'cooling dark crust', 9964),
      T('tiles-grama-terra', 'lush green meadow grass', 'packed brown dirt road', 'irregular grass edge with pebbles', 9965),
      O('obj-arvore-a', 32, 'a round leafy green tree with a dense canopy', 9971),
      O('obj-arvore-b', 32, 'a tall dark green pine tree', 9972),
      O('obj-serra', 64, 'a rocky brown mountain peak with a little snow on the top, seen from high above', 9973),
      O('obj-vulcao', 64, 'a smoking volcano cone with glowing lava streams flowing down, seen from high above', 9974)
    ];
  }
  const P = path.join(ARTE, 'desafio');
  if (lote === 'frente') return [{ base: 'brasa-frente-estilo', dir: path.join(P, 'piloto'), ep: '/generate-with-style-v2', async: 'job',
    pedido: { style_images: [{ image: img(path.join(P, 'brasa-parado-64.png')), width: 64, height: 64 }, { image: img(path.join(P, 'brasa-galope-64.png')), width: 64, height: 64 }],
      description: 'the same chestnut racing horse with orange mane and the small jockey in yellow silks, seen from the FRONT: three-quarter front view, '
        + 'the horse facing the camera and turned slightly to its right (our left), head and chest toward the viewer, both front legs visible, standing still, full body',
      style_description: 'clean pixel art, light from the upper left, selective dark outline, same proportions as the reference', no_background: true, seed: 9992 } }];
  return [
    ...[64, 96].map((lado, i) => ({ base: `brasa-8dir-${lado}`, dir: path.join(P, 'piloto'), ep: '/create-character-with-8-directions', async: 'personagem', lado,
      pedido: { description: 'a chestnut racing horse with a bright orange mane and tail, ridden by a small jockey in yellow silks and a yellow helmet', image_size: { width: lado, height: lado },
        mode: 'standard', view: 'low top-down', template_id: 'horse', outline: 'single color outline', shading: 'detailed shading', detail: 'high detail', seed: 9981 + i,
        directions: undefined } })),   // com referência, o template horse exige 'south' e 'east' (HTTP 422); vai só pela descrição
    { base: 'brasa-costas-estilo', dir: path.join(P, 'piloto'), ep: '/generate-with-style-v2', async: 'job',
      pedido: { style_images: [{ image: img(path.join(P, 'brasa-parado-64.png')), width: 64, height: 64 }, { image: img(path.join(P, 'brasa-galope-64.png')), width: 64, height: 64 }],
        description: 'the same chestnut racing horse with orange mane and the small jockey in yellow silks, seen from BEHIND: rear view, its back and tail facing the camera, '
          + 'looking away from the viewer towards the distance, camera slightly above, standing still, full body',
        style_description: 'clean pixel art, light from the upper left, selective dark outline', no_background: true, seed: 9991 } }
  ];
}

// ---------------------------------------------------------------- utilidades
const lerJson = (f, p) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : p);
const semB64 = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)));
async function saldoNum() { const b = await chamar('GET', '/balance'); return (b.subscription && b.subscription.generations) ?? null; }
const dormir = ms => new Promise(r => setTimeout(r, ms));
// todas as imagens de uma resposta: base64 (objetos {base64} ou strings PNG) e URLs de imagem, com o caminho no JSON
function imagens(o, cam = '', out = []) {
  if (!o || typeof o !== 'object') return out;
  if (typeof o.base64 === 'string' && o.base64.length > 100) { out.push({ cam, b64: o.base64 }); return out; }
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && v.startsWith('iVBOR')) out.push({ cam: cam + '/' + k, b64: v });
    else if (typeof v === 'string' && /^https?:\/\/.+\.(png|webp)(\?|$)/i.test(v)) out.push({ cam: cam + '/' + k, url: v });
    else if (v && typeof v === 'object') imagens(v, cam + '/' + k, out);
  }
  return out;
}
async function baixar(u) {
  const r = await fetch(u, { headers: /^https:\/\/api\.pixellab\.ai\//.test(u) ? { Authorization: 'Bearer proxy-injected' } : {} });
  if (!r.ok) throw new Error('download ' + r.status + ' ' + u);
  return Buffer.from(await r.arrayBuffer());
}
async function executar(c) {
  const rec = (process.env.RECUPERAR || '').split(':');
  const post = rec[0] === c.base ? { character_id: rec[1], recuperado: true } : await chamar('POST', c.ep, c.pedido);
  if (!c.async) return post;
  if (c.async === 'job' || (post.background_job_id && c.async !== 'personagem' && c.async !== 'tileset')) return (await esperarJob(post.background_job_id)).last_response || post;
  if (c.async === 'tileset') {
    const id = post.tileset_id || post.id || (post.tileset && post.tileset.id);
    if (post.tileset && post.tileset.tiles) return post;
    if (post.background_job_id) { const j = await esperarJob(post.background_job_id); if (j.last_response && j.last_response.tileset) return j.last_response; }
    for (let i = 0; i < 120; i++) { await dormir(5000); try { const t = await chamar('GET', `/tilesets/${id}`); if (t.tileset && t.tileset.tiles && t.tileset.tiles.length) return t; } catch (e) { if (e.fatal && !/423|404|425/.test(e.message)) throw e; } }
    throw new Error('tileset sem resposta em 10 min');
  }
  // personagem: espera o job e lê as rotações
  if (post.background_job_id) { try { await esperarJob(post.background_job_id); } catch (e) { if (e.fatal) throw e; } }
  for (let i = 0; i < 120; i++) { const ch = await chamar('GET', `/characters/${post.character_id}`); if (ch.status === 'completed' && ch.rotation_urls) return ch; if (ch.status === 'failed') throw new Error('personagem falhou'); await dormir(5000); }
  throw new Error('personagem sem resposta em 10 min');
}

async function gerar(lote, teto) {
  const lista = chamadas(lote);
  console.log(`Piloto ${lote}: ${lista.length} chamadas, teto ${teto} gerações`);
  for (const c of lista) console.log(`  ${c.base}  ${c.ep}`);
  if (!process.argv.includes('--gerar')) { console.log('\nDry-run: nada foi gerado. --gerar gasta (até o teto).'); return; }
  estado.redeLiberada = true;
  fs.mkdirSync(RAW, { recursive: true });
  const gasto = lerJson(ARQ_GASTO, { pl: 0, usd: 0, chamadas: [] });
  let total = 0, saldo = await saldoNum();
  console.log(`Saldo antes: ${saldo}`);
  for (const c of lista) {
    const arq = path.join(RAW, c.base + '.json');
    if (fs.existsSync(arq)) { console.log(`  ${c.base}: já gerado (raw)`); continue; }
    if (total + 1 > teto) { console.log(`  ${c.base}: PAROU (teto ${teto})`); break; }
    const r = await executar(c);
    const depois = await saldoNum(), g = saldo != null && depois != null ? saldo - depois : 1;
    saldo = depois; total += g;
    gasto.pl += g; gasto.chamadas.push({ base: `mapa-piloto2/${c.base}`, geracoes: g, data: new Date().toISOString() });
    fs.writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2));
    const ims = imagens(r), arquivos = [];
    fs.mkdirSync(c.dir, { recursive: true });
    for (let i = 0; i < ims.length; i++) {
      const buf = ims[i].b64 ? Buffer.from(ims[i].b64, 'base64') : await baixar(ims[i].url);
      const nome = `${c.base}-${String(i).padStart(2, '0')}.png`;
      fs.writeFileSync(path.join(RAW, nome), buf); arquivos.push({ nome, cam: ims[i].cam });
      try { fs.writeFileSync(path.join(c.dir, nome), encodePng(quantizar(decodePng(buf), RESURRECT64))); } catch (e) { console.log(`    ${nome}: não quantizou (${e.message})`); }
    }
    fs.writeFileSync(arq, JSON.stringify({ endpoint: c.ep, pedido: semB64(c.pedido), resposta: semB64(r), arquivos, geracoes: g }, null, 2));
    console.log(`  ${c.base}: ${g} geração(ões) pelo saldo [total ${total}/${teto}] · ${ims.length} imagens`);
  }
  console.log(`Saldo depois: ${saldo} · gasto nesta rodada: ${total}`);
}

const lote = process.argv[process.argv.indexOf('--lote') + 1];
const i = process.argv.indexOf('--teto');
if (process.argv.includes('--montar')) { const { montar } = await import('./arte-mapa-montar.mjs'); montar(); }
else if (!TETOS[lote]) { console.error('use --lote capoeira|pecas|cavalo|frente ou --montar'); process.exit(1); }
else await gerar(lote, i > 0 ? Number(process.argv[i + 1]) : TETOS[lote]).catch(e => { console.error('ERRO:', e.message); process.exit(1); });
