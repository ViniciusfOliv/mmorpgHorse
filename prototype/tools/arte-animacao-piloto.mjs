// prototype/tools/arte-animacao-piloto.mjs — piloto pago do idle dos cavalos (frente de animação ambiente,
// 2026-11-23): o PixelLab /v2/animate-with-text-v3 (4 quadros) a partir de UM molde, para as ações que o código não faz
// de forma natural (comer = baixar a cabeça até o chão; cavar = patear) e, para comparar com o código, abanar a cauda.
//
// O 1º quadro é o molde de hoje pintado nas cores de papel do moldes-lib (pelagem #ff0000, crina #00ff00, ...): os
// quadros que voltam são levados de novo aos papéis (normalizar) e gravados em cinza, como os moldes, para servirem a
// qualquer pelagem, marca e raridade (a recoloração do jogo).
//
// Uso:  node prototype/tools/arte-animacao-piloto.mjs                 (dry-run: mostra o plano e o custo; não chama a rede)
//       NODE_USE_ENV_PROXY=1 node prototype/tools/arte-animacao-piloto.mjs --gerar [--teto N]   (gasta gerações)
//       node prototype/tools/arte-animacao-piloto.mjs --reprocessar    (refaz os PNGs finais a partir de raw/, sem rede)
// Crus em prototype/assets/pixellab/raw/idle-*.json|png; finais em prototype/assets/pixellab/idle/.
// Custo: 1 geração por chamada (cota da assinatura; o saldo é conferido antes por GET /balance, que não gasta).
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng, encodeGray } from './png.mjs';
import { normalizar, paraCinza, PAPEIS } from './moldes-lib.mjs';
import { DIR_MOLDES, DIR_MOLDES_RAW, ANIMA, estado, chamar, executarReal, quadrosDoJob, geracoesDe, gravarCru, lerCru, bufDe, imagem } from './pixellab-comum.mjs';

const MOLDE = 'padrao-lisa', ESTADO = 'retrato';
const BASE_ACAO = 'side view horse facing right, standing in place, same body, same colors, flat colors, no anti-aliasing, seamless loop, ';
const PLANO = [
  { id: 'comer', seeds: [8101, 8102], quadros: 8, acao: 'lowers its head and neck all the way down to the ground to graze grass, then lifts its head back up' },
  { id: 'cavar', seeds: [8111, 8112], quadros: 8, acao: 'paws the ground: lifts one front leg, scrapes the hoof forward on the ground and puts it back down' },
  { id: 'cauda', seeds: [8121], acao: 'swishes its tail to the side and back, flicks one ear, body still' },
  { id: 'respira', seeds: [8131], acao: 'idle breathing, very subtle rise and fall of the barrel and a slight head bob' },
];
const QUADROS = 4;   // loops curtos; comer e cavar (ida e volta) pedem 8 — o custo é o mesmo: 1 geração por chamada

const args = process.argv.slice(2);
const gerar = args.includes('--gerar'), reprocessar = args.includes('--reprocessar');
const iTeto = args.indexOf('--teto'), teto = iTeto >= 0 ? Number(args[iTeto + 1]) : Infinity;
const DIR_FINAL = path.join(DIR_MOLDES, 'idle');

// o molde (cinza = papel × 25) pintado nas cores de papel
function primeiroQuadro() {
  const im = decodePng(fs.readFileSync(path.join(DIR_MOLDES, `molde-${MOLDE}-${ESTADO}.png`)));
  const rgba = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    if (im.rgba[i * 4 + 3] < 128) continue;
    const papel = Math.min(9, Math.round(im.rgba[i * 4] / 25)), h = PAPEIS[papel];
    if (!h) continue;
    rgba.set([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255], i * 4);
  }
  return encodePng({ width: 64, height: 64, rgba });
}
const pedidoDe = (item, seed, frame) => ({
  first_frame: imagem(frame), action: BASE_ACAO + item.acao, frame_count: item.quadros || QUADROS, seed, no_background: true, drift_threshold: 0,
});
const baseDe = (item, seed) => `idle-${MOLDE}-${ESTADO}-${item.id}-s${seed}`;

function finalizar(item, seed, pngs) {
  fs.mkdirSync(DIR_FINAL, { recursive: true });
  const saidas = [];
  pngs.forEach((buf, i) => {
    const im = decodePng(buf);
    if (im.width !== 64 || im.height !== 64) throw new Error(`${baseDe(item, seed)}-${i}: ${im.width}×${im.height}, esperado 64×64`);
    const n = normalizar(im.rgba, 64, 64);
    const f = path.join(DIR_FINAL, `${MOLDE}-${ESTADO}-${item.id}-s${seed}-${i}.png`);
    fs.writeFileSync(f, encodeGray({ width: 64, height: 64, data: paraCinza(n.idx) }));
    saidas.push(`${path.basename(f)} (${n.aproximados} px aproximados)`);
  });
  return saidas;
}

async function saldo() {
  const r = await chamar('GET', '/balance');
  return r.subscription ? `${r.subscription.generations}/${r.subscription.total} gerações` : JSON.stringify(r);
}

const frame = primeiroQuadro();
const itens = PLANO.flatMap(item => item.seeds.map(seed => ({ item, seed })));
console.log(`Piloto do idle: molde ${MOLDE} (${ESTADO}), ${itens.length} chamadas em ${ANIMA} (4 ou 8 quadros) = ${itens.length} gerações.`);
for (const { item, seed } of itens) {
  const cru = lerCru(DIR_MOLDES_RAW, baseDe(item, seed), pedidoDe(item, seed, frame));
  console.log(`  ${item.id.padEnd(8)} seed ${seed}  ${item.quadros || QUADROS} quadros  ${cru ? '(já gerado: raw/)' : ''}  "${item.acao}"`);
}
if (!gerar && !reprocessar) {
  console.log('\nDry-run: nada foi chamado. Para gerar (gasta gerações): NODE_USE_ENV_PROXY=1 node prototype/tools/arte-animacao-piloto.mjs --gerar [--teto N]');
  process.exit(0);
}
if (gerar) {
  estado.redeLiberada = true;
  console.log('\nSaldo antes:', await saldo());
}
let gastas = 0;
for (const { item, seed } of itens) {
  const base = baseDe(item, seed), pedido = pedidoDe(item, seed, frame);
  let pngs = null;
  const cru = lerCru(DIR_MOLDES_RAW, base, pedido);
  if (cru) {
    pngs = [];
    for (let i = 0; fs.existsSync(path.join(DIR_MOLDES_RAW, `${base}-${i}.png`)); i++) pngs.push(fs.readFileSync(path.join(DIR_MOLDES_RAW, `${base}-${i}.png`)));
  } else if (reprocessar) { console.log(`  ${base}: sem cru em raw/ (pulado)`); continue; }
  else {
    if (gastas >= teto) { console.log(`  teto de ${teto} gerações atingido; parei antes de ${base}`); break; }
    console.log(`  gerando ${base} ...`);
    const { resultado, respostas } = await executarReal(ANIMA, pedido);
    const g = geracoesDe(...respostas) ?? 1; gastas += g;
    pngs = quadrosDoJob(resultado.job).map((img, i) => bufDe(img, `${base} quadro ${i}`));
    gravarCru(DIR_MOLDES_RAW, base, ANIMA, pedido, resultado.job, pngs.map((b, i) => [`${base}-${i}.png`, b]));
    console.log(`    ${pngs.length} quadros, ${g} geração(ões)`);
  }
  console.log('   ', finalizar(item, seed, pngs).join(', '));
}
if (gerar) console.log(`\nGastas nesta rodada: ${gastas}. Saldo depois:`, await saldo());
