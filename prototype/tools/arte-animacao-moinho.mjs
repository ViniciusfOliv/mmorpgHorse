// prototype/tools/arte-animacao-moinho.mjs — o cata-vento do Planalto girando (opcional aprovado em 2026-11-24; spec
// docs/superpowers/specs/2026-11-23-animacao-ambiente-design.md §3.6).
//
// As pás estão pintadas na camada do meio (prototype/assets/arte/planalto/meio.png) por cima das araucárias, da neblina
// e do céu, e são assimétricas (6 braços, sem os verticais). Para girar:
//   1. PixelLab /v2/inpaint (1 geração por chamada; o /inpaint-v3 é Pro e custaria 10–20) refaz o fundo atrás das pás
//      num recorte de 100 × 112 em volta do cubo; a máscara são os braços (segmentos grossos do cubo às pontas) e o cubo,
//      sem a torre. O céu do recorte vai pintado de 8fd3ff e volta a ser transparente no fim (a camada tem céu vazado).
//   2. O resultado é levado à paleta do Planalto e só os pixels da máscara entram na camada nova:
//      prototype/assets/arte/planalto/meio-sem-pas.png (a original fica como está).
//   3. O rotor (4 pás de treliça) é desenhado por código, em quadros por ângulo no pixel inteiro (amostra e ambiente.js).
//
// Uso:  node prototype/tools/arte-animacao-moinho.mjs              (dry-run; não chama a rede)
//       NODE_USE_ENV_PROXY=1 node prototype/tools/arte-animacao-moinho.mjs --gerar [--teto N]
//       node prototype/tools/arte-animacao-moinho.mjs --reprocessar [--seed S]   (refaz o final a partir de raw/, sem rede)
// Crus em prototype/assets/arte/raw/moinho/; candidatos em prototype/assets/arte/planalto/candidatos/moinho-s<seed>.png.
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng } from './png.mjs';
import { REGIOES, quantizar, imagemPaleta } from './arte-paleta.mjs';
import { RAIZ, estado, chamar, gravarCru, lerCru, bufDe, imagem } from './pixellab-comum.mjs';

const ARTE = path.join(RAIZ, 'prototype', 'assets', 'arte');
const ORIGEM = path.join(ARTE, 'planalto', 'meio.png');
const SAIDA = path.join(ARTE, 'planalto', 'meio-sem-pas.png');
const DIR_RAW = path.join(ARTE, 'raw', 'moinho'), DIR_CAND = path.join(ARTE, 'planalto', 'candidatos');
const CX = 140, CY = 0, CW = 100, CH = 112;           // recorte na camada (384 × 112)
const CUBO = [193, 37];                              // centro do rotor pintado (coordenadas da camada)
// braços pintados: do cubo às pontas (medidos na folha ampliada, 2026-11-24)
const BRACOS = [[171, 14], [215, 14], [172, 57], [214, 58], [160, 35], [231, 36]];
const LARG = 6.2, RAIO_CUBO = 7, ALONGA = 1.15;      // ALONGA: os braços medidos vão um pouco além (as pontas e o contorno)                   // meia-largura do braço (com a vela e o contorno) e raio do cubo
const TORRE = { x0: 184, x1: 202, y0: 44 };          // a torre fica (abaixo do cubo)
// 1ª tentativa (8201, 8202; 2026-11-24): o recorte ainda tinha as pás e o texto falava da torre: o modelo repintou pás.
// 2ª (8203): a entrada já vem preenchida por código e o texto só descreve o fundo.
const SEEDS = [8203];
const DESCRICAO = 'dense dark green araucaria tree canopies with flat tops, soft white low mist, pale blue sky, side view pixel art landscape';
const CEU = [0x8f, 0xd3, 0xff];

const args = process.argv.slice(2);
const gerar = args.includes('--gerar'), reprocessar = args.includes('--reprocessar');
const iTeto = args.indexOf('--teto'), teto = iTeto >= 0 ? Number(args[iTeto + 1]) : Infinity;
const iSeed = args.indexOf('--seed'), seedEscolhida = iSeed >= 0 ? Number(args[iSeed + 1]) : null;

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
// máscara na camada inteira: 1 onde as pás pintadas estão
function mascara(w, h) {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= TORRE.x0 && x <= TORRE.x1 && y >= TORRE.y0) continue;
    const perto = BRACOS.some(([bx, by]) => distSeg(x, y, CUBO[0], CUBO[1], CUBO[0] + (bx - CUBO[0]) * ALONGA, CUBO[1] + (by - CUBO[1]) * ALONGA) <= LARG) || Math.hypot(x - CUBO[0], y - CUBO[1]) <= RAIO_CUBO;
    if (perto) m[y * w + x] = 1;
  }
  return m;
}

const camada = decodePng(fs.readFileSync(ORIGEM));
const M = mascara(camada.width, camada.height);
// recorte com o céu pintado e a máscara em preto e branco
const rec = new Uint8Array(CW * CH * 4), mrec = new Uint8Array(CW * CH * 4);
let nMasc = 0;
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
  const i = ((CY + y) * camada.width + CX + x) * 4, o = (y * CW + x) * 4;
  if (camada.rgba[i + 3] < 128) rec.set([...CEU, 255], o); else rec.set([camada.rgba[i], camada.rgba[i + 1], camada.rgba[i + 2], 255], o);
  const v = M[(CY + y) * camada.width + CX + x] ? 255 : 0; if (v) nMasc++;
  mrec.set([v, v, v, 255], o);
}
// preenchimento por código (sem custo): cada pixel da máscara recebe a cor mais comum dos vizinhos já resolvidos,
// crescendo da borda para dentro. Serve de entrada do inpaint (sem as pás no desenho, o modelo não as repinta) e de
// reserva (--so-codigo) se o inpaint não ficar bom.
const TINTA = (255 << 24 | 0x2f << 16 | 0x22 << 8 | 0x2e) >>> 0;   // 2e222f no Uint32 (ABGR)
function preencher(rgba, w, h, masc) {
  const px = new Uint32Array(rgba.buffer.slice(0)), falta = Uint8Array.from(masc);
  let resta = falta.reduce((a, b) => a + b, 0);
  while (resta) {
    const muda = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!falta[i]) continue;
      const cont = new Map(); let n = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox, ny = y + oy; if ((!ox && !oy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx; if (falta[k]) continue; n++; cont.set(px[k], (cont.get(px[k]) || 0) + 1);
      }
      // o contorno (2e222f) só vence se não houver outra cor: senão ele "escorre" para dentro do buraco
      if (n >= 3) { let best = 0, bc = 0; for (const [c, v] of cont) { const peso = c === TINTA ? v * 0.2 : v; if (peso > bc) { bc = peso; best = c; } } muda.push(i, best); }
    }
    if (!muda.length) break;
    for (let k = 0; k < muda.length; k += 2) { px[muda[k]] = muda[k + 1]; falta[muda[k]] = 0; resta--; }
  }
  return new Uint8Array(px.buffer);
}
const mascRec = new Uint8Array(CW * CH); for (let i = 0; i < CW * CH; i++) mascRec[i] = mrec[i * 4] ? 1 : 0;
const recCod = preencher(rec, CW, CH, mascRec);
fs.writeFileSync(path.join(DIR_CAND, 'moinho-codigo-recorte.png'), encodePng({ width: CW, height: CH, rgba: recCod }));
const pngRec = encodePng({ width: CW, height: CH, rgba: recCod }), pngMasc = encodePng({ width: CW, height: CH, rgba: mrec });
fs.mkdirSync(DIR_CAND, { recursive: true });
fs.writeFileSync(path.join(DIR_CAND, 'moinho-recorte.png'), pngRec);
fs.writeFileSync(path.join(DIR_CAND, 'moinho-mascara.png'), pngMasc);
const paleta = REGIOES.planalto;
const pedidoDe = seed => ({
  description: DESCRICAO, negative_description: 'windmill, sails, blades, wooden planks, cross, beams, text',
  image_size: { width: CW, height: CH }, inpainting_image: imagem(pngRec), mask_image: imagem(pngMasc),
  color_image: imagem(encodePng(imagemPaleta(paleta))), view: 'side', outline: 'lineless', shading: 'medium shading', detail: 'medium detail', seed,
});
const baseDe = seed => `moinho-planalto-s${seed}`;

// final: a camada com os pixels da máscara trocados pelo inpaint (na paleta; o céu volta a ser vazado)
function finalizar(seed, png) {
  const r = decodePng(png);
  if (r.width !== CW || r.height !== CH) throw new Error(`${baseDe(seed)}: ${r.width}×${r.height}, esperado ${CW}×${CH}`);
  const q = quantizar(r, paleta), out = new Uint8Array(camada.rgba);
  let ceu = 0;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const li = (CY + y) * camada.width + CX + x; if (!M[li]) continue;
    const o = (y * CW + x) * 4, h = [0, 1, 2].map(k => q.rgba[o + k].toString(16).padStart(2, '0')).join('');
    if (['8fd3ff', '4d9be6', '4d65b4'].includes(h)) { out.set([0, 0, 0, 0], li * 4); ceu++; continue; }   // céu: vazado
    out.set([q.rgba[o], q.rgba[o + 1], q.rgba[o + 2], 255], li * 4);
  }
  const f = path.join(DIR_CAND, `moinho-s${seed}.png`);
  fs.writeFileSync(f, encodePng({ width: camada.width, height: camada.height, rgba: out }));
  return { f, ceu };
}

console.log(`Cata-vento do Planalto: máscara de ${nMasc} px num recorte de ${CW}×${CH}; ${SEEDS.length} chamadas de /inpaint (1 geração cada).`);
// composição final (escolha de 2026-11-24): o inpaint 8203 fora do topo da torre (lá ele desenhou uma copa de
// araucária em cima da torre) e o preenchimento por código no topo (o cubo do rotor fica por cima); pixels opacos
// isolados no céu (restos do contorno das pontas) são apagados
const ZONA_TORRE = { x0: 176, x1: 210, y0: 22, y1: 48 };
function compor(seed) {
  const a = decodePng(fs.readFileSync(path.join(DIR_CAND, `moinho-s${seed}.png`))), b = decodePng(fs.readFileSync(path.join(DIR_CAND, 'moinho-scodigo.png')));
  const w = a.width, h = a.height, out = new Uint8Array(a.rgba);
  for (let y = ZONA_TORRE.y0; y < ZONA_TORRE.y1; y++) for (let x = ZONA_TORRE.x0; x < ZONA_TORRE.x1; x++) {
    const i = (y * w + x) * 4; if (!M[y * w + x]) continue; out.set(b.rgba.subarray(i, i + 4), i);
  }
  let apagados = 0;
  for (let y = 0; y < 60; y++) for (let x = CX; x < CX + CW; x++) {
    const i = (y * w + x) * 4; if (out[i + 3] < 128) continue;
    let viz = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { if (!ox && !oy) continue; const nx = x + ox, ny = y + oy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && out[(ny * w + nx) * 4 + 3] >= 128) viz++; }
    if (viz <= 1) { out[i + 3] = 0; out[i] = out[i + 1] = out[i + 2] = 0; apagados++; }
  }
  fs.writeFileSync(SAIDA, encodePng({ width: w, height: h, rgba: out }));
  console.log(`Composição: ${path.relative(RAIZ, SAIDA)} (inpaint ${seed} + código no topo da torre; ${apagados} px isolados apagados)`);
}
if (args.includes('--compor')) { compor(Number(args[args.indexOf('--compor') + 1])); process.exit(0); }
if (args.includes('--so-codigo')) {
  const png = encodePng({ width: CW, height: CH, rgba: recCod });
  const { f, ceu } = finalizar('codigo', png);
  console.log(`Só código: ${path.relative(RAIZ, f)} (${ceu} px voltaram a céu vazado)`);
  if (seedEscolhida === null && args.includes('--escolher')) { fs.copyFileSync(f, SAIDA); console.log('→', path.relative(RAIZ, SAIDA)); }
  process.exit(0);
}
if (!gerar && !reprocessar) {
  console.log('Dry-run: nada foi chamado. Recorte e máscara em', path.relative(RAIZ, DIR_CAND));
  console.log('Para gerar (gasta gerações): NODE_USE_ENV_PROXY=1 node prototype/tools/arte-animacao-moinho.mjs --gerar --teto N');
  process.exit(0);
}
if (gerar) estado.redeLiberada = true;
let gastas = 0;
for (const seed of SEEDS) {
  const base = baseDe(seed), pedido = pedidoDe(seed);
  let png = null;
  if (lerCru(DIR_RAW, base, pedido) && fs.existsSync(path.join(DIR_RAW, base + '.png'))) png = fs.readFileSync(path.join(DIR_RAW, base + '.png'));
  else if (reprocessar) { console.log(`  ${base}: sem cru (pulado)`); continue; }
  else {
    if (gastas >= teto) { console.log(`  teto de ${teto} atingido; parei antes de ${base}`); break; }
    console.log(`  gerando ${base} ...`);
    const r = await chamar('POST', '/inpaint', pedido);
    gastas += (r.usage && r.usage.generations) || 1;
    png = bufDe(r.image, base);
    gravarCru(DIR_RAW, base, '/inpaint', pedido, r, [[base + '.png', png]]);
  }
  const { f, ceu } = finalizar(seed, png);
  console.log(`    ${path.relative(RAIZ, f)} (${ceu} px da máscara voltaram a céu vazado)`);
}
if (seedEscolhida) {
  fs.copyFileSync(path.join(DIR_CAND, `moinho-s${seedEscolhida}.png`), SAIDA);
  console.log('Escolhida:', seedEscolhida, '→', path.relative(RAIZ, SAIDA));
}
if (gerar) console.log(`Gastas: ${gastas}.`);
