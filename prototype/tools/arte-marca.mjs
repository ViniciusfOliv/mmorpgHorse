// prototype/tools/arte-marca.mjs — etapa 7 da direção de arte: a marca na grade de pixel.
// O logotipo de hoje (prototype/assets/marca/logo.png, Canva) é 320 × 63 reduzido de uma arte maior, com letras finas
// que não seguem a grade; a capa (docs/capa.png, Canva) é ilustração lisa. Na etapa 7:
//   emblema  o cavalo dourado de crina de fogo, água e folha (o mesmo símbolo do logo de hoje, que vai de referência),
//            48 × 48, pelo modo Pro do PixelLab (~25 candidatos por 10 gerações);
//   icone    o ícone do app, 128 × 128 (ampliado 4× para 512 × 512 por código), quadrado cheio e sem texto (regra do
//            Play), pelo Pro (de 86 a 128 px: 4 candidatos por 10 gerações; 2 chamadas = 8 candidatos);
//   letreiro "Galope Elemental" desenhado à mão em código, letra por letra (a IA erra letras: a capa do Canva saiu
//            "Calope"), e o logo montado em código com o emblema; a imagem de destaque (1024 × 500 = 512 × 250 × 2) e a
//            capa, compostas em código com as camadas das regiões, os cavalos e o logo. Essas partes não gastam nada.
// Paleta mestra (Resurrect 64) travada no Pro; alfa binário e paleta conferidos por código.
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/arte-marca.mjs --lote emblema|icone [--gerar] [--teto-pl N]
//   Sem --gerar é SEMPRE dry-run. Pedido já gravado em raw/ é reaproveitado. Só cota do plano (aborta se cobrar US$).
// Saída: crus em prototype/assets/arte/raw/marca/<lote>/, candidatos em prototype/assets/arte/marca/<lote>/NN.png e a
// folha prototype/arte/folha-marca.html.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RAIZ, estado, chamar, esperarJob, saldo, fmt, imagem } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, quantizar, conferir } from './arte-paleta.mjs';

const DIR = path.join(RAIZ, 'prototype', 'assets', 'arte');
const ARQ_GASTO = path.join(DIR, 'raw', 'gasto.json');
const SIMBOLO = 'a golden galloping horse head facing right whose flowing mane is made of three elements: red and orange '
  + 'flames, blue water waves and green leaves';
const LOTES = {
  emblema: { lado: 48, seeds: [9901], teto: 10,
    desc: `${SIMBOLO}, game logo emblem, bold readable silhouette, transparent background, dark single color outline, light from the upper left` },
  icone: { lado: 128, seeds: [9911, 9912], teto: 20,
    desc: `mobile game app icon: ${SIMBOLO}, big and centered, filling most of the square, on a deep dark green background `
      + 'with a thin gold border around the whole square, no text, dark single color outline, light from the upper left' },
};

// o símbolo do logo de hoje (a parte da direita do logo.png), em 64 × 64, como referência
function simboloAtual() {
  const im = decodePng(fs.readFileSync(path.join(RAIZ, 'prototype', 'assets', 'marca', 'logo.png'))), out = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < Math.min(63, im.height); y++) out.set(im.rgba.subarray((y * im.width + im.width - 64) * 4, (y * im.width + im.width) * 4), (y + 1) * 64 * 4);
  return encodePng({ width: 64, height: 64, rgba: out });
}
function args() {
  const a = { lote: null, gerar: false, tetoPl: null };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '--lote') a.lote = v[++i];
    else if (v[i] === '--gerar') a.gerar = true;
    else if (v[i] === '--teto-pl') a.tetoPl = Number(v[++i]);
    else throw new Error('opção desconhecida: ' + v[i]);
  }
  if (!(a.lote in LOTES)) throw new Error('use --lote emblema ou --lote icone');
  return a;
}
const lerJson = (f, p) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : p);
const assinatura = p => crypto.createHash('sha1').update(JSON.stringify(p)).digest('hex').slice(0, 12);
const semB64 = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length} chars>` : v)));

function folha() {
  const uri = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  const M = path.join(DIR, 'marca'), tem = f => fs.existsSync(path.join(M, f));
  const escolhidos = tem('destaque-1024x500.png') ? '<h2>Escolhidos: emblema 10 e ícone 03 (Vinicius, 2026-11-20); destaque e capa montados em código</h2>'
    + `<figure><img src="${uri(path.join(M, 'destaque-1024x500.png'))}" style="width:100%;max-width:1024px"><figcaption>destaque do Play 1024×500 (512×250 de arte, 2×; sem alfa)</figcaption></figure>`
    + '<div class="grade" style="margin-top:8px">'
    + (tem('icone-512.png') ? `<figure><img src="${uri(path.join(M, 'icone-512.png'))}" style="width:256px"><figcaption>ícone do app 512×512 (128 × 4; sem alfa), mostrado pela metade</figcaption></figure>` : '')
    + (tem('logo.png') ? `<figure><img src="${uri(path.join(M, 'logo.png'))}" style="zoom:3"><figcaption>logo (3×)</figcaption></figure>` : '') + '</div>' : '';
  const sec = escolhidos + Object.keys(LOTES).map(l => {
    const d = path.join(DIR, 'marca', l);
    if (!fs.existsSync(d)) return '';
    const z = l === 'emblema' ? 4 : 2;
    return `<h2>${l}</h2><div class="grade">` + fs.readdirSync(d).filter(f => f.endsWith('.png')).sort()
      .map(f => `<figure><img src="${uri(path.join(d, f))}" style="width:${LOTES[l].lado * z}px"><figcaption>${f.replace('.png', '')}</figcaption></figure>`).join('') + '</div>';
  }).join('') + (() => {
    const d = path.join(DIR, 'marca', 'previas'), l = path.join(DIR, 'marca', 'letreiro-linha.png');
    const fsP = fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.png')).sort() : [];
    return '<h2>logo montado em código (3×): letreiro desenhado à mão + emblema</h2><div class="grade">'
      + fsP.map(f => `<figure><img src="${uri(path.join(d, f))}" style="zoom:3"><figcaption>${f.replace('.png', '')}</figcaption></figure>`).join('')
      + (fs.existsSync(l) ? `<figure><img src="${uri(l)}" style="zoom:3"><figcaption>letreiro numa linha (cabeçalho)</figcaption></figure>` : '') + '</div>';
  })();
  fs.writeFileSync(path.join(RAIZ, 'prototype', 'arte', 'folha-marca.html'), `<title>Marca</title>
<style>:root{color-scheme:dark} body{background:#2e222f;color:#c7dcd0;font:14px monospace;margin:0} .p{padding:16px}
h2{color:#f9c22b;font-weight:normal} .grade{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end} figure{margin:0;text-align:center}
img{image-rendering:pixelated;display:block;background:#3e3546} figcaption{color:#9babb2;font-size:12px}</style>
<div class="p"><h1 style="color:#f9c22b;font-weight:normal">Marca · emblema 4× e ícone do app 2×</h1>${sec}</div>`);
}

async function main() {
  if (process.argv.includes('--folha')) { folha(); console.log('folha em prototype/arte/folha-marca.html'); return; }
  const a = args(), L = LOTES[a.lote], teto = a.tetoPl ?? L.teto, fim = path.join(DIR, 'marca', a.lote);
  const pedidos = L.seeds.map(seed => ({ description: L.desc, image_size: { width: L.lado, height: L.lado }, no_background: a.lote === 'emblema', seed,
    reference_images: [{ image: imagem(simboloAtual()), size: { width: 64, height: 64 }, usage_description: 'the brand symbol to redraw: same horse and mane' }],
    target_palette: { colors: RESURRECT64.map(h => '#' + h), name: 'Resurrect 64' } }));
  console.log(`Marca, lote ${a.lote}: ${pedidos.length} chamada(s) /generate-image-v2 ${L.lado}×${L.lado}, seeds ${L.seeds.join(', ')}; ~10 gerações cada; teto ${teto}`);
  if (!a.gerar) { console.log('\nDry-run: nada foi gerado. Use --gerar para gastar.'); return; }
  estado.redeLiberada = true;
  fs.rmSync(fim, { recursive: true, force: true }); fs.mkdirSync(fim, { recursive: true });
  let pl = 0, n = 0;
  for (const pedido of pedidos) {
    const raw = path.join(DIR, 'raw', 'marca', `${a.lote}-s${pedido.seed}`);
    fs.mkdirSync(raw, { recursive: true });
    const arqJson = path.join(raw, 'pedido.json'), assin = assinatura(pedido), salvo = lerJson(arqJson, null);
    let bufs;
    if (salvo && salvo.assinatura === assin) bufs = fs.readdirSync(raw).filter(f => f.endsWith('.png')).sort().map(f => fs.readFileSync(path.join(raw, f)));
    else {
      if (pl + 10 > teto) { console.log(`  seed ${pedido.seed}: PAROU (teto de ${teto})`); break; }
      await saldo('do PixelLab antes');
      const gasto = lerJson(ARQ_GASTO, { pl: 0, usd: 0, chamadas: [] });
      const post = await chamar('POST', '/generate-image-v2', pedido);
      const job = await esperarJob(post.background_job_id);
      for (const r of [post, job, job.last_response]) if (r && r.usage && r.usage.type === 'usd' && r.usage.usd > 0) throw new Error('cobrança inesperada em US$');
      const g = Math.max((post.usage && post.usage.generations) || 0, (job.usage && job.usage.generations) || 0, (job.last_response && job.last_response.usage && job.last_response.usage.generations) || 0) || 10;
      pl += g; gasto.pl += g; gasto.chamadas.push({ base: `marca/${a.lote}-s${pedido.seed}`, geracoes: g, data: new Date().toISOString() });
      const lr = job.last_response || {}, imgs = lr.images || (lr.image && [lr.image]) || [];
      bufs = imgs.map(im => Buffer.from(im.base64, 'base64'));
      bufs.forEach((b, k) => fs.writeFileSync(path.join(raw, String(k).padStart(2, '0') + '.png'), b));
      fs.writeFileSync(arqJson, JSON.stringify({ assinatura: assin, pedido: semB64(pedido), resposta: semB64({ post, job }) }, null, 2));
      fs.writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2));
      console.log(`  seed ${pedido.seed}: ${fmt(g)} gerações, ${bufs.length} candidatos [total ${fmt(pl)}/${teto}]`);
      await saldo('do PixelLab depois');
    }
    bufs.forEach(b => {
      const img = quantizar(decodePng(b), RESURRECT64), k = conferir(img, RESURRECT64);
      fs.writeFileSync(path.join(fim, String(n).padStart(2, '0') + '.png'), encodePng(img));
      if (k.fora || k.alfa || k.falso) console.log(`    ${n}: fora ${k.fora}, alfa ${k.alfa}, falso ${k.falso ? 'SIM' : 'não'}`);
      n++;
    });
  }
  folha();
  console.log('folha em prototype/arte/folha-marca.html');
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
