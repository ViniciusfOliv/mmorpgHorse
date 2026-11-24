// prototype/tools/arte-desafio-bakeoff.mjs — comparação de ferramentas para a cena de desafio (frente 2, 2026-11-24),
// cada teste confirmado pelo Vinicius neste chat. Entrada: a cena montada da amostra (prototype/assets/arte/desafio/
// bakeoff/cena-semplacas.png e fundo.png, exportadas da amostra). Saída: os crus em raw/desafio-bakeoff/ e, prontos para
// a página, os PNGs na grade de arte (256 × 160 ou 64 × 64), quantizados na Resurrect 64, em desafio/bakeoff/.
//   inpaint  PixelLab /inpaint-v3: repinta só o chão em volta dos cascos (máscara = elipses nos pés, menos os pixels dos
//            personagens), para o chão "abraçar" os cavalos. 1 chamada, ~10 gerações. Teto 10.
//   gemini   Gemini (via compatível com OpenAI, chave injetada pelo proxy): a cena ampliada 4× (vizinho mais próximo) e o
//            pedido de composição com luz e contato; a resposta é reduzida à grade 256 × 160 (moda por bloco) e quantizada.
//            4 variações, ~US$ 0,04 cada.
//   meshy    Meshy image-to-3d a partir do molde da Brasa (ampliado 8× sem suavizar); o GLB é renderizado por
//            prototype/tools/arte-desafio-render.html (three.js no navegador de teste) já no tamanho final. ~30 créditos.
// O gasto é medido pelo saldo de cada serviço antes e depois e gravado em raw/gasto.json; nenhuma chave no código.
// Uso: NODE_USE_ENV_PROXY=1 node prototype/tools/arte-desafio-bakeoff.mjs --lote inpaint|gemini|meshy [--gerar]
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, estado, chamar, esperarJob } from './pixellab-comum.mjs';
import { decodePng, encodePng } from './png.mjs';
import { RESURRECT64, quantizar } from './arte-paleta.mjs';

const D = path.join(RAIZ, 'prototype', 'assets', 'arte', 'desafio');
const B = path.join(D, 'bakeoff'), RAW = path.join(RAIZ, 'prototype', 'assets', 'arte', 'raw', 'desafio-bakeoff');
const ARQ_GASTO = path.join(RAIZ, 'prototype', 'assets', 'arte', 'raw', 'gasto.json');
const W = 256, H = 160;
// pés na cena (arena 0 da amostra: ARENAS.a0 no mapa.js): oponente, líder e o nosso
const PES = [[164, 126, 26, 7], [197, 122, 14, 5], [72, 158, 40, 9]];
const lote = process.argv[process.argv.indexOf('--lote') + 1], gerar = process.argv.includes('--gerar');
fs.mkdirSync(RAW, { recursive: true });
const gasto = fs.existsSync(ARQ_GASTO) ? JSON.parse(fs.readFileSync(ARQ_GASTO, 'utf8')) : { pl: 0, usd: 0, chamadas: [] };
const registra = (base, extra) => { gasto.chamadas.push({ base: 'desafio-bakeoff/' + base, ...extra, data: new Date().toISOString() }); fs.writeFileSync(ARQ_GASTO, JSON.stringify(gasto, null, 2)); };
const png64 = f => fs.readFileSync(f).toString('base64');
const dormir = ms => new Promise(r => setTimeout(r, ms));

function ampliar(img, k) {
  const o = { width: img.width * k, height: img.height * k, rgba: new Uint8Array(img.width * k * img.height * k * 4) };
  for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) { const s = ((y / k | 0) * img.width + (x / k | 0)) * 4, d = (y * o.width + x) * 4; for (let c = 0; c < 4; c++) o.rgba[d + c] = img.rgba[s + c]; }
  return o;
}
function reduzirModa(img, w, h) {   // cada pixel de arte = a cor mais comum do seu bloco (sem misturar cores)
  const o = { width: w, height: h, rgba: new Uint8Array(w * h * 4) }, bx = img.width / w, by = img.height / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const conta = new Map();
    for (let j = Math.floor(y * by + by * 0.2); j < Math.floor((y + 1) * by - by * 0.2); j++) for (let i = Math.floor(x * bx + bx * 0.2); i < Math.floor((x + 1) * bx - bx * 0.2); i++) {
      const s = (j * img.width + i) * 4, k = (img.rgba[s] >> 3) << 10 | (img.rgba[s + 1] >> 3) << 5 | (img.rgba[s + 2] >> 3);
      const v = conta.get(k) || [0, s]; v[0]++; conta.set(k, v);
    }
    let m = null; for (const v of conta.values()) if (!m || v[0] > m[0]) m = v;
    const d = (y * w + x) * 4; if (m) { for (let c = 0; c < 3; c++) o.rgba[d + c] = img.rgba[m[1] + c]; o.rgba[d + 3] = 255; }
  }
  return o;
}
function salvaFinal(nome, img) { fs.writeFileSync(path.join(B, nome + '.png'), encodePng(quantizar(img, RESURRECT64))); console.log('  ' + nome + '.png'); }

async function inpaint() {
  const cena = decodePng(fs.readFileSync(path.join(B, 'cena-semplacas.png'))), fundo = decodePng(fs.readFileSync(path.join(B, 'fundo.png')));
  const mask = { width: W, height: H, rgba: new Uint8Array(W * H * 4) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, personagem = [0, 1, 2].some(c => Math.abs(cena.rgba[i + c] - fundo.rgba[i + c]) > 6);
    const perto = PES.some(([px, py, rx, ry]) => ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2 <= 1);
    const v = perto && !personagem ? 255 : 0; mask.rgba[i] = mask.rgba[i + 1] = mask.rgba[i + 2] = v; mask.rgba[i + 3] = 255;
  }
  fs.writeFileSync(path.join(B, 'mascara-inpaint.png'), encodePng(mask));
  const pedido = { description: 'hot packed dirt arena ground continuing under the horses hooves: trampled earth, small pebbles, dust, dark contact shadows right under the hooves, same pixel art style and colors as the rest of the image, light from the upper left',
    inpainting_image: { image: { type: 'base64', base64: png64(path.join(B, 'cena-semplacas.png')) }, size: { width: W, height: H } }, mask_image: { image: { type: 'base64', base64: encodePng(mask).toString('base64') }, size: { width: W, height: H } }, crop_to_mask: false, seed: 9993 };
  console.log('inpaint: /inpaint-v3 256×160, 1 chamada (~10 gerações)');
  if (!gerar) return console.log('Dry-run.');
  estado.redeLiberada = true;
  const s0 = (await chamar('GET', '/balance')).subscription.generations;
  let r = await chamar('POST', '/inpaint-v3', pedido);
  if (r.background_job_id) r = (await esperarJob(r.background_job_id)).last_response || r;
  const s1 = (await chamar('GET', '/balance')).subscription.generations;
  const b64 = (r.image && r.image.base64) || (r.images && r.images[0] && (r.images[0].base64 || r.images[0])) || null;
  fs.writeFileSync(path.join(RAW, 'inpaint.json'), JSON.stringify(r, (k, v) => (typeof v === 'string' && v.length > 300 ? `<${v.length}>` : v), 2));
  if (!b64) throw new Error('inpaint sem imagem na resposta (ver raw/inpaint.json)');
  fs.writeFileSync(path.join(RAW, 'inpaint.png'), Buffer.from(b64, 'base64'));
  const im = decodePng(Buffer.from(b64, 'base64'));
  salvaFinal('pixellab-inpaint', im.width === W ? im : reduzirModa(im, W, H));
  gasto.pl += s0 - s1; registra('inpaint', { geracoes: s0 - s1 });
  console.log(`gasto: ${s0 - s1} gerações (${s0} → ${s1})`);
}

async function gemini() {
  const cena = decodePng(fs.readFileSync(path.join(B, 'cena-semplacas.png'))), grande = ampliar(cena, 4);
  const uri = 'data:image/png;base64,' + encodePng(grande).toString('base64');
  const PED = ['Keep this exact composition, camera and pixel-art style. Make the two horses and the trainer feel physically part of the scene: they stand ON the hot dirt ground of the volcanic arena, with dark contact shadows under the hooves, trampled dirt and dust around the feet, and the same warm sunset light from the upper left on the horses as on the ground. Do not add any text or user interface. Keep the horse and rider designs.',
    'Repaint this game battle scene as clean 16-bit pixel art: the far horse with its rider and the trainer stand on the arena dirt in the middle distance, our horse is seen from behind in the foreground at the bottom left, all grounded with contact shadows and dust, warm volcanic sunset light, mountains behind. Keep the layout, no text.'];
  console.log('gemini: 4 variações (2 pedidos × 2), gemini-2.5-flash-image, ~US$ 0,04 cada');
  if (!gerar) return console.log('Dry-run.');
  let n = 0;
  for (let k = 0; k < 4; k++) {
    const corpo = { model: 'gemini-2.5-flash-image', messages: [{ role: 'user', content: [{ type: 'text', text: PED[k % 2] }, { type: 'image_url', image_url: { url: uri } }] }] };
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer proxy-injected', 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const txt = await res.text();
    fs.writeFileSync(path.join(RAW, `gemini-${k}.json`), txt.replace(/"data:image\/[a-z]+;base64,[^"]+"/g, '"<img>"').replace(/"[A-Za-z0-9+/=]{2000,}"/g, '"<b64>"'));
    if (!res.ok) { console.log(`  gemini ${k}: HTTP ${res.status} ${txt.slice(0, 300)}`); continue; }
    const m = txt.match(/data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)/) || txt.match(/"([A-Za-z0-9+/]{5000,}={0,2})"/);
    const j = JSON.parse(txt), uso = j.usage || {};
    registra(`gemini-${k}`, { usd_estimado: 0.039, tokens: uso });
    if (!m) { console.log(`  gemini ${k}: sem imagem na resposta (texto: ${(j.choices && j.choices[0] && JSON.stringify(j.choices[0].message).slice(0, 200))})`); continue; }
    const buf = Buffer.from(m[2] || m[1], 'base64'); fs.writeFileSync(path.join(RAW, `gemini-${k}.${m[1] === 'jpeg' ? 'jpg' : 'png'}`), buf);
    if (m[1] !== 'png' && m[2]) { console.log(`  gemini ${k}: veio ${m[1]}; convertido pela página de teste depois`); n++; continue; }
    salvaFinal(`gemini-${k}`, reduzirModa(decodePng(buf), W, H)); n++;
  }
  console.log(`gemini: ${n} imagens`);
}

async function meshy() {
  const molde = decodePng(fs.readFileSync(path.join(D, 'brasa-parado-64.png'))), grande = ampliar(molde, 8);
  const uri = 'data:image/png;base64,' + encodePng(grande).toString('base64');
  console.log('meshy: image-to-3d do molde da Brasa (512×512), com textura, ~20–30 créditos');
  if (!gerar) return console.log('Dry-run.');
  const api = async (m, p, b) => { const r = await fetch('https://api.meshy.ai' + p, { method: m, headers: { Authorization: 'Bearer proxy-injected', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); const t = await r.text(); if (!r.ok) throw new Error(`${m} ${p} → ${r.status} ${t.slice(0, 400)}`); return JSON.parse(t); };
  const s0 = (await api('GET', '/openapi/v1/balance')).balance;
  const post = await api('POST', '/openapi/v1/image-to-3d', { image_url: uri, should_texture: true, enable_pbr: false, should_remesh: true, target_polycount: 30000, symmetry_mode: 'auto' });
  const id = post.result; console.log('  tarefa', id);
  let t;
  for (let i = 0; i < 120; i++) { await dormir(10000); t = await api('GET', '/openapi/v1/image-to-3d/' + id); if (t.status === 'SUCCEEDED' || t.status === 'FAILED') break; process.stdout.write(`  ${t.status} ${t.progress}%\r`); }
  fs.writeFileSync(path.join(RAW, 'meshy.json'), JSON.stringify(t, null, 2));
  if (t.status !== 'SUCCEEDED') throw new Error('meshy: ' + t.status + ' ' + JSON.stringify(t.task_error || {}));
  const glb = Buffer.from(await (await fetch(t.model_urls.glb)).arrayBuffer());
  fs.writeFileSync(path.join(RAW, 'meshy-brasa.glb'), glb);
  if (t.thumbnail_url) fs.writeFileSync(path.join(RAW, 'meshy-thumb.png'), Buffer.from(await (await fetch(t.thumbnail_url)).arrayBuffer()));
  const s1 = (await api('GET', '/openapi/v1/balance')).balance;
  registra('meshy', { creditos_meshy: s0 - s1 });
  console.log(`\nmeshy: GLB salvo (${(glb.length / 1024).toFixed(0)} KB); gasto ${s0 - s1} créditos (${s0} → ${s1})`);
}

const L = { inpaint, gemini, meshy }[lote];
if (!L) { console.error('use --lote inpaint|gemini|meshy [--gerar]'); process.exit(1); }
L().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
