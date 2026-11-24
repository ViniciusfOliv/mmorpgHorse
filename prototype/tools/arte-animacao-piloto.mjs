// prototype/tools/arte-animacao-piloto.mjs — piloto pago do idle dos cavalos (frente de animação ambiente,
// 2026-11-23): o PixelLab /v2/animate-with-text-v3 (4 quadros) a partir de UM molde, para as ações que o código não faz
// de forma natural (comer = baixar a cabeça até o chão; cavar = patear) e, para comparar com o código, abanar a cauda.
//
// O 1º quadro é o molde de hoje pintado nas cores de papel do moldes-lib (pelagem #ff0000, crina #00ff00, ...): os
// quadros que voltam são levados de novo aos papéis (normalizar) e gravados em cinza, como os moldes, para servirem a
// qualquer pelagem, marca e raridade (a recoloração do jogo).
//
// Lotes: `--lote piloto` (padrão; o piloto de 2026-11-23, molde padrão-lisa: comer ×2, cavar ×2, cauda, respiração) e
// `--lote todos` (comer e cavar nos 12 moldes, com as seeds que deram certo no piloto; os quadros com pixels soltos —
// peças desconectadas do corpo — são refeitos com a seed de reserva enquanto o teto deixar, depois de todos os primeiros).
// Uso:  node prototype/tools/arte-animacao-piloto.mjs [--lote todos]  (dry-run: mostra o plano e o custo; não chama a rede)
//       NODE_USE_ENV_PROXY=1 node prototype/tools/arte-animacao-piloto.mjs --gerar [--teto N]   (gasta gerações)
//       node prototype/tools/arte-animacao-piloto.mjs --reprocessar    (refaz os PNGs finais a partir de raw/, sem rede)
// Crus em prototype/assets/pixellab/raw/idle-*.json|png; finais em prototype/assets/pixellab/idle/.
// Custo: 1 geração por chamada (cota da assinatura; o saldo é conferido antes por GET /balance, que não gasta).
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng, encodeGray } from './png.mjs';
import { normalizar, paraCinza, PAPEIS } from './moldes-lib.mjs';
import { DIR_MOLDES, DIR_MOLDES_RAW, ANIMA, estado, chamar, executarReal, quadrosDoJob, geracoesDe, gravarCru, lerCru, bufDe, imagem } from './pixellab-comum.mjs';

const ESTADO = 'retrato';
const BASE_ACAO = 'side view horse facing right, standing in place, same body, same colors, flat colors, no anti-aliasing, seamless loop, ';
const ACOES = {
  comer: { quadros: 8, acao: 'lowers its head and neck all the way down to the ground to graze grass, then lifts its head back up' },
  cavar: { quadros: 8, acao: 'paws the ground: lifts one front leg, scrapes the hoof forward on the ground and puts it back down' },
  cauda: { quadros: 4, acao: 'swishes its tail to the side and back, flicks one ear, body still' },
  respira: { quadros: 4, acao: 'idle breathing, very subtle rise and fall of the barrel and a slight head bob' },
};
const MOLDES = ['esguio', 'padrao', 'robusto'].flatMap(p => ['lisa', 'chamas', 'ondas', 'folhas'].map(c => `${p}-${c}`));
// seeds: a primeira é a do lote; as outras, reservas para refazer um defeituoso
const LOTES = {
  piloto: [['padrao-lisa', 'comer', [8101]], ['padrao-lisa', 'comer', [8102]], ['padrao-lisa', 'cavar', [8111]], ['padrao-lisa', 'cavar', [8112]],
    ['padrao-lisa', 'cauda', [8121]], ['padrao-lisa', 'respira', [8131]]],
  todos: MOLDES.flatMap(m => [[m, 'comer', [8102, 8103, 8104]], [m, 'cavar', [8111, 8113, 8114]]]),
};

const args = process.argv.slice(2);
const gerar = args.includes('--gerar'), reprocessar = args.includes('--reprocessar');
const iTeto = args.indexOf('--teto'), teto = iTeto >= 0 ? Number(args[iTeto + 1]) : Infinity;
const iLote = args.indexOf('--lote'), lote = iLote >= 0 ? args[iLote + 1] : 'piloto';
if (!LOTES[lote]) { console.error(`lote desconhecido: ${lote} (piloto | todos)`); process.exit(1); }
const DIR_FINAL = path.join(DIR_MOLDES, 'idle');

// o molde (cinza = papel × 25) pintado nas cores de papel
const primeiros = {};
function primeiroQuadro(molde) {
  if (primeiros[molde]) return primeiros[molde];
  const im = decodePng(fs.readFileSync(path.join(DIR_MOLDES, `molde-${molde}-${ESTADO}.png`)));
  const rgba = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    if (im.rgba[i * 4 + 3] < 128) continue;
    const papel = Math.min(9, Math.round(im.rgba[i * 4] / 25)), h = PAPEIS[papel];
    if (!h) continue;
    rgba.set([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255], i * 4);
  }
  return (primeiros[molde] = encodePng({ width: 64, height: 64, rgba }));
}
const pedidoDe = (molde, acao, seed) => ({
  first_frame: imagem(primeiroQuadro(molde)), action: BASE_ACAO + ACOES[acao].acao, frame_count: ACOES[acao].quadros, seed, no_background: true, drift_threshold: 0,
});
const baseDe = (molde, acao, seed) => `idle-${molde}-${ESTADO}-${acao}-s${seed}`;

// pixels soltos: tudo que não está na maior peça conexa (vizinhança 8) do quadro. Com limpar, apaga essas peças quando
// somam até LIMPA_MAX px — no comer, são fiapos de capim saindo da boca nos últimos quadros, soltos do corpo (os crus
// ficam intactos em raw/; o corpo do cavalo é sempre a maior peça)
const LIMPA_MAX = 60;
function soltos(idx, limpar) {
  const vis = new Int32Array(4096).fill(-1), tam = [];
  for (let i = 0; i < 4096; i++) {
    if (!idx[i] || vis[i] >= 0) continue;
    let n = 0; const id = tam.length, pilha = [i]; vis[i] = id;
    while (pilha.length) {
      const j = pilha.pop(), x = j & 63, y = j >> 6; n++;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox, ny = y + oy, k = ny * 64 + nx;
        if (nx >= 0 && ny >= 0 && nx < 64 && ny < 64 && idx[k] && vis[k] < 0) { vis[k] = id; pilha.push(k); }
      }
    }
    tam.push(n);
  }
  let maior = 0; tam.forEach((n, k) => { if (n > tam[maior]) maior = k; });
  const fora = tam.reduce((a, n, k) => a + (k === maior ? 0 : n), 0);
  if (limpar && fora && fora <= LIMPA_MAX) for (let i = 0; i < 4096; i++) if (idx[i] && vis[i] !== maior) idx[i] = 0;
  return fora;
}
function finalizar(molde, acao, seed, pngs) {
  fs.mkdirSync(DIR_FINAL, { recursive: true });
  let pior = 0, removidos = 0;
  pngs.forEach((buf, i) => {
    const im = decodePng(buf);
    if (im.width !== 64 || im.height !== 64) throw new Error(`${baseDe(molde, acao, seed)}-${i}: ${im.width}×${im.height}, esperado 64×64`);
    const n = normalizar(im.rgba, 64, 64);
    if (i > 0) { const f = soltos(n.idx, true); removidos += f <= LIMPA_MAX ? f : 0; pior = Math.max(pior, soltos(n.idx)); }
    fs.writeFileSync(path.join(DIR_FINAL, `${molde}-${ESTADO}-${acao}-s${seed}-${i}.png`), encodeGray({ width: 64, height: 64, data: paraCinza(n.idx) }));
  });
  finalizar.removidos = removidos;
  return pior;   // o maior número de pixels soltos que sobrou num quadro (depois da limpeza)
}
const crusDe = base => { const p = []; for (let i = 0; fs.existsSync(path.join(DIR_MOLDES_RAW, `${base}-${i}.png`)); i++) p.push(fs.readFileSync(path.join(DIR_MOLDES_RAW, `${base}-${i}.png`))); return p; };

async function saldo() {
  const r = await chamar('GET', '/balance');
  return r.subscription ? `${r.subscription.generations}/${r.subscription.total} gerações` : JSON.stringify(r);
}

const plano = LOTES[lote];
console.log(`Lote ${lote}: ${plano.length} animações em ${ANIMA} (1 geração cada) = ${plano.length} gerações, mais as refações de defeituosos (até o teto).`);
for (const [m, a, seeds] of plano) {
  const cru = lerCru(DIR_MOLDES_RAW, baseDe(m, a, seeds[0]), pedidoDe(m, a, seeds[0]));
  console.log(`  ${m.padEnd(16)} ${a.padEnd(8)} seed ${seeds[0]}  ${ACOES[a].quadros} quadros ${cru ? '(já gerado: raw/)' : ''}`);
}
if (!gerar && !reprocessar) {
  console.log(`\nDry-run: nada foi chamado. Para gerar (gasta gerações): NODE_USE_ENV_PROXY=1 node prototype/tools/arte-animacao-piloto.mjs --lote ${lote} --gerar --teto N`);
  process.exit(0);
}
if (gerar) { estado.redeLiberada = true; console.log('\nSaldo antes:', await saldo()); }
let gastas = 0, parou = false;
// uma tentativa: o cru se já existe, senão gera (respeitando o teto); devolve os pixels soltos ou null (não feito)
async function tenta(m, a, seed) {
  const base = baseDe(m, a, seed), pedido = pedidoDe(m, a, seed);
  let pngs;
  if (lerCru(DIR_MOLDES_RAW, base, pedido)) pngs = crusDe(base);
  else if (reprocessar) return null;
  else {
    if (gastas >= teto) { parou = true; return null; }
    console.log(`  gerando ${base} ...`);
    const { resultado, respostas } = await executarReal(ANIMA, pedido);
    gastas += geracoesDe(...respostas) ?? 1;
    pngs = quadrosDoJob(resultado.job).map((img, i) => bufDe(img, `${base} quadro ${i}`));
    gravarCru(DIR_MOLDES_RAW, base, ANIMA, pedido, resultado.job, pngs.map((b, i) => [`${base}-${i}.png`, b]));
  }
  const solto = finalizar(m, a, seed, pngs);
  console.log(`    ${base}: ${pngs.length} quadros, ${solto ? solto + ' px soltos' : 'limpo'}${finalizar.removidos ? ` (${finalizar.removidos} px de fiapos soltos apagados)` : ''}`);
  return solto;
}
// 1ª passada: a seed do lote em todos; 2ª: as reservas só nos que vieram com pixels soltos
const escolhas = {};
const arqEsc = path.join(DIR_FINAL, `escolhas-${lote}.json`);
for (const [m, a, seeds] of plano) {
  const r = await tenta(m, a, seeds[0]);
  if (r === null) continue;
  (escolhas[m] ||= {})[a] = { seed: seeds[0], soltos: r, tentativas: [[seeds[0], r]] };
}
for (const [m, a, seeds] of plano) {
  const e = escolhas[m] && escolhas[m][a]; if (!e || !e.soltos) continue;
  for (const sd of seeds.slice(1)) {
    if (!e.soltos) break;
    const r = await tenta(m, a, sd); if (r === null) break;
    e.tentativas.push([sd, r]);
    if (r < e.soltos) { e.seed = sd; e.soltos = r; }
  }
}
if (lote === 'todos') { fs.writeFileSync(arqEsc, JSON.stringify(escolhas, null, 2) + '\n'); console.log(`\nEscolhas em ${path.relative(process.cwd(), arqEsc)}`); }
const ruins = Object.entries(escolhas).flatMap(([m, o]) => Object.entries(o).filter(([, e]) => e.soltos).map(([a, e]) => `${m} ${a} (${e.soltos} px)`));
if (ruins.length) console.log('Ainda com pixels soltos:', ruins.join(', '));
if (parou) console.log(`Teto de ${teto} gerações atingido: o que faltou ficou de fora (rode de novo com teto maior, depois de perguntar).`);
if (gerar) console.log(`\nGastas nesta rodada: ${gastas}. Saldo depois:`, await saldo());
