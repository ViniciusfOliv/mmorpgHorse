// prototype/tools/pixellab-moldes.mjs — gera no PixelLab (API v2) os moldes de cavalo e os ícones.
//
// Uso:  NODE_USE_ENV_PROXY=1 node prototype/tools/pixellab-moldes.mjs --lote moldes|icones|tudo [--only <id>] [--teto 60] [--gerar]
//   Sem --gerar é SEMPRE dry-run: lista as chamadas planejadas (endpoint, item, seed, prompt) e o total
//   de gerações, sem tocar na rede (nem /balance).
//   --gerar   gasta a cota do PixelLab — só com confirmação do dono do projeto (CLAUDE.md §7).
//   --teto N  máximo de gerações no lote todo (padrão 60). Soma o usage.generations real de cada resposta
//             e para ANTES de uma chamada que passaria do teto; o que já foi gerado fica gravado.
//   --only id um estilo (chamas|ondas|folhas|lisa) ou um ícone (aba-estabulo, el-fogo, …).
//   --repetir item[,item]  dá UMA tentativa a mais (seed + 30) a cada item citado (ex.: lisa/parado,
//             icone/aba-loja): a repetição manual de item ruim (no máximo 2 itens por lote, plano Step 3).
//   --reprocessar  refaz os finais só a partir de raw/, sem rede (nem /balance): falha se faltar imagem crua.
//                  Não mexe em docs/memoria/assets.md (nada novo foi gerado).
//   --testar-crinas [--forca N]  rodada de crinas (2026-11-09): para os estilos com `testesCrina`, gera cada
//                  variante (corrida com a crina reforçada no texto + galope) com UMA tentativa por etapa, só
//                  anima se a corrida passar na pré-checagem e grava só em raw/ (nem finais, nem assets.md).
//                  --forca N roda só a variante dessa força. A escolhida vira o `corrida` do estilo e os finais
//                  saem num --gerar normal, que a reaproveita de raw/ sem custo.
// Credencial: o proxy de rede injeta a chave (nunca no código nem em arquivo). O fetch do Node não lê
// HTTPS_PROXY sozinho: na sessão na nuvem, rode com NODE_USE_ENV_PROXY=1 (Node ≥ 22.21), senão a API
// responde 401 (a chamada sai sem passar pelo proxy e sem a chave).
//
// Moldes (por estilo): retrato, parado e montado em /create-image-pixflux com as cores de papel pedidas
// por TEXTO, galope em /animate-with-text-v3 a partir do montado. Cada quadro é classificado por família de
// cor (moldes-lib: classificarFamilias); claro × sombra da pelagem e da crina usam um limiar de Otsu por
// geração — retrato, parado e os quadros do galope juntos (para o galope não piscar); juntar as três
// gerações não serve, porque cada uma vem com um brilho diferente. Depois limpa os papéis do jóquei,
// sombreia por procedimento o par desequilibrado, fecha o contorno só no montado e no galope (o animate
// devolve sem borda; no retrato e no parado a regra de silhueta do validar continua valendo) e valida.
// Quadro inválido refaz o item com seed + 10 (até 2 repetições por item, contando no teto).
// A paleta forçada (color_image com as cores de papel + /reduce-colors) foi testada em 2026-11-08 e
// descartada: o modelo pintava cada par num tom só (pelagem toda #800000, crina toda #008000) e punha
// cores do jóquei na crina; com cores livres + classificação o resultado ficou melhor (relatório da Task 2).
// Galope de corrida (spec 2026-11-09 §4): o galope de ondas, folhas e lisa saiu em meio-galope (corpo alto,
// patas recolhidas). Nesses estilos (campo `corrida` em ESTILOS) o montado vira a pose `corrida`: pixflux com
// init_image = 1º quadro cru do galope de chamas (o padrão), força `corrida.forca`, texto de corrida + crina
// + COR; o galope usa ACAO_CORRIDA. A pré-checagem aplica o aceite (moldes-lib: passada; altura do contorno)
// antes de gastar a etapa seguinte: corrida reprovada ⇒ nova seed da corrida (sem animar); galope reprovado
// ⇒ nova seed só do galope. Referência = galope final de chamas (molde-chamas-galope-*.png).
// Uma imagem crua já gravada em raw/ com o MESMO pedido (prompt, parâmetros, seed e imagens de entrada)
// é reaproveitada sem nova chamada; uma tentativa que deu erro de API fica registrada (JSON com "erro") e
// a seed é pulada ao retomar o lote. Uma imagem válida mas ruim na conferência visual é marcada à mão com
// "rejeitada": "<motivo>" no JSON cru, e a seed também é pulada.
// Saídas:
//   prototype/assets/pixellab/molde-<estilo>-{retrato,parado,galope-N}.png  (cinza = papel × 25)
//   prototype/assets/pixellab/molde-<estilo>.json        (âncoras, larguraUtil, limiares por geração, seeds)
//   prototype/assets/pixellab/raw/  (PNGs crus e respostas JSON sem os base64)
// Ícones: 16 × /create-image-pixflux 32×32 com a paleta da interface em color_image (pedido do plano) →
// prototype/assets/icons/<nome>.png (RGBA) e icons/raw/. Cada arquivo final que MUDOU ganha (ou troca) sua
// linha em docs/memoria/assets.md; o que só foi refeito igual a partir de raw/ não mexe no registro.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, encodeGray } from './png.mjs';
import { validar, ancoras, paraCinza, deCinza, classificarFamilias, limiaresDeTons, posProcessar, passada } from './moldes-lib.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR_MOLDES = path.join(RAIZ, 'prototype', 'assets', 'pixellab');
const DIR_ICONES = path.join(RAIZ, 'prototype', 'assets', 'icons');
const DIR_MOLDES_RAW = path.join(DIR_MOLDES, 'raw');
const DIR_ICONES_RAW = path.join(DIR_ICONES, 'raw');
const ARQ_ASSETS = path.join(RAIZ, 'docs', 'memoria', 'assets.md');
const API = 'https://api.pixellab.ai/v2';
const HOJE = new Date().toISOString().slice(0, 10);

const PIXFLUX = '/create-image-pixflux', ANIMA = '/animate-with-text-v3';
const MAX_REPETICOES = 2; // por item
let REPETIR_EXTRA = [];   // itens com uma tentativa a mais (--repetir)
const PASSO_SEED = 10;    // repetição: seed + 10
const LADO = 64;          // moldes 64×64

// ---------------------------------------------------------------- o que gerar (plano, Task 2)
const COR = 'pure red (#ff0000) coat with dark red (#800000) shading, bright green (#00ff00) mane and tail with dark green (#008000) shading, blue (#0000ff) hooves and muzzle, black outline, flat colors, no gradients, no anti-aliasing';
const JOQUEI_CORES = 'jockey in yellow (#ffff00) silks and yellow helmet with pink (#ffc0cb) skin, grey (#808080) saddle and saddle pad and reins';
const JOQUEI = 'with a small jockey riding, ' + JOQUEI_CORES;
// corrida: o texto da spec 2026-11-09 §4 + as cores de papel do jóquei (o validar exige seda 7 e pele 8)
const POSES = {
  retrato: 'standing still horse, no rider, no saddle',
  parado: 'horse standing still ' + JOQUEI,
  montado: 'racing horse in mid-gallop stride ' + JOQUEI,
  corrida: 'racing horse at full gallop, body stretched low, front legs reaching far forward and hind legs pushing far back, jockey crouched low, ' + JOQUEI_CORES,
};
// montado (opcional): seed e reforço próprios do montado — rodada 1 de correção: o montado da lisa saía
// com crina e cauda marrom-escuras e o jóquei borrado (o reforço vale também para a corrida).
// corrida (opcional): o montado deste estilo é a pose `corrida` (seed base da corrida e do galope; forca =
// init_image_strength, 1–999; reforcarCrina = a crina do estilo também no início do texto e repetida como
// "clearly visible and distinct"). chamas não tem: o galope dele é o padrão e a guia da corrida.
// testesCrina: variantes da rodada de crinas (--testar-crinas, 2026-11-09), só as que rodaram. A força 150 saiu
// quase uma cópia da guia (pose e penacho de chamas); a 200 a guia pesa mais, então não foi tentada. ondas: a
// seed 1801 deu HTTP 502 (sem imagem, não cobrado) e a tentativa a 150 foi refeita na 1811.
const ESTILOS = [
  { id: 'chamas', seed: 1101, crina: 'mane and tail shaped like flickering flames' },
  { id: 'ondas', seed: 1201, crina: 'mane and tail shaped like flowing water waves', corrida: { seed: 1501, forca: 300 },
    testesCrina: [{ seed: 1801, forca: 150, reforcarCrina: true }, { seed: 1811, forca: 150, reforcarCrina: true }] },
  { id: 'folhas', seed: 1301, crina: 'mane and tail made of leaves', corrida: { seed: 1601, forca: 300 },
    testesCrina: [{ seed: 1901, forca: 150, reforcarCrina: true }] },
  { id: 'lisa', seed: 1401, crina: 'long straight flowing mane and tail',
    montado: { seed: 1451, reforco: 'bright green (#00ff00) long straight mane and tail clearly visible, jockey in yellow silks and yellow helmet' },
    corrida: { seed: 1701, forca: 300 },
    testesCrina: [{ seed: 2001, forca: 150, reforcarCrina: true }] },
];
const poseMontada = estilo => (estilo.corrida ? 'corrida' : 'montado');
const posesDe = estilo => ['retrato', 'parado', poseMontada(estilo)];
function seedBaseDe(estilo, k) {
  if (estilo.corrida && (k === 'corrida' || k === 'galope')) return estilo.corrida.seed;
  return k === 'montado' && estilo.montado ? estilo.montado.seed : estilo.seed;
}
const ACAO_GALOPE = 'galloping at full racing speed in a seamless loop, legs extending and gathering, mane and tail flowing back';
const ACAO_CORRIDA = 'full speed racing gallop, long extended stride, moment of suspension with all four hooves off the ground, seamless loop, mane and tail streaming back';
const acaoDe = estilo => (estilo.corrida ? ACAO_CORRIDA : ACAO_GALOPE);
// guia da corrida: o 1º quadro cru (RGBA) do galope de chamas (= o montado de chamas, seed 1111)
const GUIA_CORRIDA = 'chamas-galope-m1111-s1101-0.png';
// nomes em raw/: a força entra no nome para uma força nova não sobrescrever a imagem crua de outra
const prefixoPose = (estilo, pose) => (pose === 'corrida' ? `${estilo.id}-corrida-f${estilo.corrida.forca}` : `${estilo.id}-${pose}`);
const prefixoGalope = (estilo, seedMontado) => `${estilo.id}-galope-${estilo.corrida ? `c${seedMontado}f${estilo.corrida.forca}` : `m${seedMontado}`}`;

const SUFIXO_ICONE = 'pixel art game ui icon, centered, simple, readable at small size';
const PALETA_ICONES = ['#000000', '#f2c230', '#ffe27a', '#9c7210', '#f1e9d4', '#16271f', '#335446'];
// [nome, descrição, opções]; opções da rodada 1 de correção (bússola parecia timão, estribo parecia
// ferradura): seed + 20 e descrição nova; `cor` = cor extra da paleta quando a descrição pede uma que a
// paleta da interface não tem (agulha vermelha ⇒ --perda do jogo). Bússola de novo em 2026-11-09 (spec da
// corrida viva §4): a da seed 2123 tinha a agulha pouco nítida; descrição nova e seed nova.
const ICONES = [
  ['aba-estabulo', 'horse head icon'], ['aba-correr', 'checkered racing flag icon'],
  ['aba-expedicao', 'round navigation compass, top view, crisp red and white needle pointing straight up, gold rim', { seed: 2143, cor: '#ff6b5e' }],
  ['aba-haras', 'two hearts icon'], ['aba-loja', 'shopping cart icon'], ['slot-ferraduras', 'horseshoe icon'],
  ['slot-sela', 'horse saddle icon'],
  ['slot-estribos', 'single stirrup iron: D-shaped metal loop with a flat footplate at the bottom, hanging from a short leather strap', { seed: 2128 }],
  ['slot-testeira', 'horse head armor chamfron icon'],
  ['slot-armadura', 'horse barding armor icon'], ['moeda-ouro', 'gold coin icon'], ['pedra-negra', 'black polished stone gem icon'],
  ['el-fogo', 'flame icon (#ff8a4c)'], ['el-agua', 'water drop icon (#62b8ff)'], ['el-grama', 'green leaf icon (#7be07a)'],
  ['el-neutro', 'grey circle rune icon (#cfc8b4)'],
].map(([id, desc, op = {}], i) => ({ id, desc, seed: op.seed || 2101 + i, cor: op.cor || null }));

// ---------------------------------------------------------------- corpos das chamadas
const imagem = buf => ({ type: 'base64', base64: buf.toString('base64'), format: 'png' });

let guiaBuf = null;
function guiaCorrida() {
  if (!guiaBuf) {
    const f = path.join(DIR_MOLDES_RAW, GUIA_CORRIDA);
    if (!fs.existsSync(f)) throw new ErroApi(`falta a guia da corrida ${path.relative(RAIZ, f)}`, { fatal: true });
    guiaBuf = fs.readFileSync(f);
  }
  return guiaBuf;
}
function pedidoPose(estilo, pose, seed) {
  const reforco = (pose === 'montado' || pose === 'corrida') && estilo.montado ? `, ${estilo.montado.reforco}` : '';
  const forte = pose === 'corrida' && estilo.corrida.reforcarCrina;
  const corpo = {
    description: forte
      ? `side view, facing right, ${estilo.crina}, ${POSES[pose]}, ${estilo.crina} clearly visible and distinct${reforco}, ${COR}`
      : `side view, facing right, ${POSES[pose]}, ${estilo.crina}${reforco}, ${COR}`,
    image_size: { width: LADO, height: LADO },
    view: 'side', direction: 'east',
    outline: 'single color black outline', shading: 'basic shading', detail: 'medium detail',
    no_background: true, seed,
  };
  if (pose === 'corrida') { corpo.init_image = imagem(guiaCorrida()); corpo.init_image_strength = estilo.corrida.forca; }
  return corpo;
}
function pedidoGalope(montado, seed, acao) {
  return { first_frame: imagem(montado), action: acao, frame_count: 8, no_background: true, drift_threshold: 0, seed };
}
function coresIcone(icone) {
  const m = /\(#([0-9a-f]{6})\)/i.exec(icone.desc); // cor do tema, quando a descrição traz uma
  const tema = icone.cor || (m && '#' + m[1].toLowerCase());
  return tema ? PALETA_ICONES.concat(tema) : PALETA_ICONES;
}
function paletaIconePng(icone) {
  const cores = coresIcone(icone), rgba = new Uint8Array(cores.length * 4);
  cores.forEach((h, i) => rgba.set([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255], i * 4));
  return encodePng({ width: cores.length, height: 1, rgba });
}
function pedidoIcone(icone, seed) {
  return {
    description: `${icone.desc}, ${SUFIXO_ICONE}`,
    image_size: { width: 32, height: 32 },
    no_background: true, outline: 'single color black outline', shading: 'basic shading',
    color_image: imagem(paletaIconePng(icone)), seed,
  };
}

// ---------------------------------------------------------------- argumentos
function sair(msg) { console.error(msg); process.exit(2); }

function lerArgs(argv) {
  const a = { lote: null, only: null, teto: 60, gerar: false, reprocessar: false, repetir: [], testarCrinas: false, forca: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--gerar') a.gerar = true;
    else if (k === '--reprocessar') a.reprocessar = true;
    else if (k === '--lote') a.lote = argv[++i];
    else if (k === '--only') a.only = argv[++i];
    else if (k === '--teto') a.teto = Number(argv[++i]);
    else if (k === '--repetir') a.repetir = String(argv[++i] || '').split(',').filter(Boolean);
    else if (k === '--testar-crinas') a.testarCrinas = true;
    else if (k === '--forca') a.forca = Number(argv[++i]);
    else sair('argumento desconhecido: ' + k);
  }
  if (!['moldes', 'icones', 'tudo'].includes(a.lote)) {
    sair('uso: node prototype/tools/pixellab-moldes.mjs --lote moldes|icones|tudo [--only <id>] [--teto 60] [--gerar]');
  }
  if (!Number.isFinite(a.teto) || a.teto <= 0) sair('--teto precisa ser um número maior que zero');
  if (a.gerar && a.reprocessar) sair('--gerar e --reprocessar não andam juntos');
  if (a.testarCrinas && (a.reprocessar || a.lote === 'icones' || a.repetir.length)) sair('--testar-crinas: só com --lote moldes|tudo, sem --reprocessar nem --repetir');
  if (a.forca != null && !a.testarCrinas) sair('--forca só vale com --testar-crinas');
  a.estilos = a.lote === 'icones' ? [] : ESTILOS.filter(e => !a.only || e.id === a.only);
  a.icones = a.lote === 'moldes' ? [] : ICONES.filter(ic => !a.only || ic.id === a.only);
  if (a.only && !a.estilos.length && !a.icones.length) sair(`--only ${a.only}: não existe no lote "${a.lote}"`);
  if (a.repetir.length > 2) sair('--repetir: no máximo 2 itens');
  const itens = [...ESTILOS.flatMap(e => [...posesDe(e), 'galope'].map(k => `${e.id}/${k}`)), ...ICONES.map(ic => `icone/${ic.id}`)];
  for (const r of a.repetir) if (!itens.includes(r)) sair(`--repetir ${r}: item desconhecido (ex.: lisa/parado, ondas/corrida, icone/aba-loja)`);
  REPETIR_EXTRA = a.repetir;
  if (a.testarCrinas) {
    a.icones = [];
    a.estilos = a.estilos.filter(e => e.testesCrina);
    if (!a.estilos.length) sair('--testar-crinas: nenhum estilo selecionado tem testesCrina');
  }
  return a;
}

// ---------------------------------------------------------------- arquivos crus (gravar e reaproveitar)
const fmt = n => String(Math.round(n * 1000) / 1000).replace('.', ',');
const limparB64 = s => s.replace(/^data:[^,]*,/, '');

function bufDe(img, onde) {
  if (!img || typeof img.base64 !== 'string') throw new ErroApi(`${onde}: resposta sem imagem`, { fatal: true });
  return Buffer.from(limparB64(img.base64), 'base64');
}
// Troca cada base64 por um marcador curto com tamanho e hash (as imagens ficam como PNG ao lado; o hash
// permite reconhecer o mesmo pedido, inclusive o first_frame do galope).
function semBase64(obj) {
  return JSON.parse(JSON.stringify(obj ?? null, (k, v) => {
    if (k !== 'base64' || typeof v !== 'string') return v;
    const b = Buffer.from(limparB64(v), 'base64');
    return `<base64 omitido: ${b.length} bytes, sha256 ${crypto.createHash('sha256').update(b).digest('hex').slice(0, 16)}>`;
  }));
}
const canonico = v => (Array.isArray(v) ? '[' + v.map(canonico).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonico(v[k])).join(',') + '}'
    : JSON.stringify(v));

function gravarCru(dir, base, endpoint, pedido, resposta, pngs) {
  fs.mkdirSync(dir, { recursive: true });
  const reg = { endpoint, data: new Date().toISOString(), pedido: semBase64(pedido), resposta: semBase64(resposta) };
  fs.writeFileSync(path.join(dir, base + '.json'), JSON.stringify(reg, null, 2) + '\n');
  for (const [nome, buf] of pngs) fs.writeFileSync(path.join(dir, nome), buf);
}
// Registro cru com o mesmo pedido (e as imagens dele), ou null.
function lerCru(dir, base, pedido) {
  const arq = path.join(dir, base + '.json');
  if (!fs.existsSync(arq)) return null;
  let reg;
  try { reg = JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return null; }
  return canonico(reg.pedido) === canonico(semBase64(pedido)) ? reg : null;
}
function gravarErro(dir, base, endpoint, pedido, e) {
  fs.mkdirSync(dir, { recursive: true });
  const reg = { endpoint, data: new Date().toISOString(), pedido: semBase64(pedido), erro: e.message };
  fs.writeFileSync(path.join(dir, base + '.json'), JSON.stringify(reg, null, 2) + '\n');
}
function pngsCrus(dir, base, varios) {
  if (!varios) { const f = path.join(dir, base + '.png'); return fs.existsSync(f) ? [fs.readFileSync(f)] : null; }
  const bufs = [];
  for (let i = 0; fs.existsSync(path.join(dir, `${base}-${i}.png`)); i++) bufs.push(fs.readFileSync(path.join(dir, `${base}-${i}.png`)));
  return bufs.length ? bufs : null;
}

function registrarAsset(arquivos, endpoint, prompt, seedTexto, geracoes, emUso) {
  // --reprocessar não gera nada novo (só refaz os finais de raw/): o registro existente fica como está — senão
  // a linha voltaria para a data de hoje e para o "Em uso" fixo da geração
  if (REPROCESSAR) return;
  const linha = `| ${HOJE} | ${arquivos} | PixelLab API v2 ${endpoint} | ${prompt}; ${seedTexto} | ${fmt(geracoes)} ${geracoes === 1 ? 'geração' : 'gerações'} da cota | ${emUso} |`;
  const linhas = fs.readFileSync(ARQ_ASSETS, 'utf8').split('\n');
  // mesmo(s) arquivo(s) já registrado(s) (lote repetido ou retomado): substitui a linha
  const igual = linhas.findIndex(l => l.startsWith('|') && (l.split('|')[2] || '').trim() === arquivos);
  if (igual >= 0) { linhas[igual] = linha; fs.writeFileSync(ARQ_ASSETS, linhas.join('\n')); return; }
  // entra na tabela existente, antes da linha fixa "| — |" (sprites por código); senão no fim da tabela
  let pos = linhas.findIndex(l => l.startsWith('| — |'));
  if (pos < 0) pos = linhas.reduce((u, l, i) => (l.startsWith('|') ? i : u), -1) + 1;
  linhas.splice(pos, 0, linha);
  fs.writeFileSync(ARQ_ASSETS, linhas.join('\n'));
}

// ---------------------------------------------------------------- dry-run
// 1ª seed que o lote real usaria, sem rede: pula as com erro registrado ou rejeitadas à mão e, quando a imagem
// crua já existe, também as que a pré-checagem (validar + aceite) reprova — como o lote real faria.
// Devolve "cru" (e as imagens) se a seed escolhida já tiver a imagem em raw/.
function seedPlanejada(dir, prefixo, seedBase, pedidoDe, rotulo, { varios = false, checar = null, tentativas = null } = {}) {
  for (let k = 0; k < (tentativas ?? MAX_REPETICOES + 1 + (REPETIR_EXTRA.includes(rotulo) ? 1 : 0)); k++) {
    const seed = seedBase + PASSO_SEED * k, corpo = pedidoDe(seed), base = `${prefixo}-s${seed}`, reg = lerCru(dir, base, corpo);
    if (reg && (reg.erro || reg.rejeitada)) continue;
    const bufs = reg && pngsCrus(dir, base, varios);
    if (bufs && checar && !checar(bufs).ok) continue;
    return { seed, corpo, cru: !!bufs, bufs };
  }
  return { seed: seedBase, corpo: pedidoDe(seedBase), cru: false, bufs: null };
}
function planoEstilo(e) {
  const plano = posesDe(e).map(p => {
    const s = seedPlanejada(DIR_MOLDES_RAW, prefixoPose(e, p), seedBaseDe(e, p), seed => pedidoPose(e, p, seed), `${e.id}/${p}`,
      { checar: bufs => checarPose(e, p, bufs[0], `${e.id}/${p}`) });
    const guia = p === 'corrida' ? ` [init_image = raw/${GUIA_CORRIDA}; init_image_strength ${e.corrida.forca}]` : '';
    return { item: `${e.id}/${p}`, endpoint: PIXFLUX, seed: s.seed, texto: s.corpo.description + guia, cru: s.cru, bufs: s.bufs };
  });
  const montado = plano[plano.length - 1], rotulo = `${e.id}/galope`, sufixo = `[first_frame = ${montado.item} seed ${montado.seed}; frame_count 8; drift_threshold 0]`;
  if (!montado.cru) {
    plano.push({ item: rotulo, endpoint: ANIMA, seed: seedBaseDe(e, 'galope'), texto: `${acaoDe(e)} ${sufixo}`, cru: false });
  } else { // montado já em raw/: o galope dele pode estar em raw/ também
    const s = seedPlanejada(DIR_MOLDES_RAW, prefixoGalope(e, montado.seed), seedBaseDe(e, 'galope'), seed => pedidoGalope(montado.bufs[0], seed, acaoDe(e)), rotulo,
      { varios: true, checar: bufs => checarGalope(e, bufs, rotulo) });
    plano.push({ item: rotulo, endpoint: ANIMA, seed: s.seed, texto: `${acaoDe(e)} ${sufixo}`, cru: s.cru });
  }
  return plano;
}
// rodada de crinas: uma tentativa por etapa e por variante; o galope só existe se a corrida passar
function planoTesteCrina(e, forca) {
  const plano = [];
  for (const v of e.testesCrina.filter(x => forca == null || x.forca === forca)) {
    const ev = { ...e, corrida: v }, rot = `${e.id}/corrida-f${v.forca}`;
    const c = seedPlanejada(DIR_MOLDES_RAW, prefixoPose(ev, 'corrida'), v.seed, seed => pedidoPose(ev, 'corrida', seed), rot,
      { tentativas: 1, checar: bufs => checarPose(ev, 'corrida', bufs[0], rot) });
    const cruOk = c.cru || !!(lerCru(DIR_MOLDES_RAW, `${prefixoPose(ev, 'corrida')}-s${v.seed}`, c.corpo));
    plano.push({ item: rot, endpoint: PIXFLUX, seed: v.seed, texto: `${c.corpo.description} [init_image = raw/${GUIA_CORRIDA}; init_image_strength ${v.forca}]`, cru: c.cru || cruOk });
    if (cruOk && !c.cru) continue; // já gerada e reprovada (ou com erro): sem galope
    const rg = `${e.id}/galope-f${v.forca}`, sufixo = `[first_frame = ${rot} seed ${v.seed}; só se a corrida passar na pré-checagem]`;
    if (!c.cru) { plano.push({ item: rg, endpoint: ANIMA, seed: v.seed, texto: `${ACAO_CORRIDA} ${sufixo}`, cru: false }); continue; }
    const g = seedPlanejada(DIR_MOLDES_RAW, prefixoGalope(ev, v.seed), v.seed, seed => pedidoGalope(c.bufs[0], seed, ACAO_CORRIDA), rg,
      { varios: true, tentativas: 1 });
    plano.push({ item: rg, endpoint: ANIMA, seed: v.seed, texto: `${ACAO_CORRIDA} ${sufixo}`, cru: g.cru || !!lerCru(DIR_MOLDES_RAW, `${prefixoGalope(ev, v.seed)}-s${v.seed}`, g.corpo) });
  }
  return plano;
}
function planoIcone(ic) {
  const s = seedPlanejada(DIR_ICONES_RAW, ic.id, ic.seed, seed => pedidoIcone(ic, seed), `icone/${ic.id}`);
  return { item: `icone/${ic.id}`, endpoint: PIXFLUX, seed: s.seed, texto: `${s.corpo.description} [32×32; paleta ${coresIcone(ic).join(' ')}]`, cru: s.cru };
}

function dryRun(a) {
  const plano = a.testarCrinas ? a.estilos.flatMap(e => planoTesteCrina(e, a.forca))
    : [...a.estilos.flatMap(planoEstilo), ...a.icones.map(planoIcone)];
  console.log(`DRY-RUN (sem --gerar): nenhuma chamada à API. Lote "${a.lote}"${a.only ? ` (--only ${a.only})` : ''}${a.testarCrinas ? `; rodada de crinas${a.forca != null ? ` (força ${a.forca})` : ''}` : ''}; teto ${a.teto} gerações.`);
  console.log('Estimativa: 1 geração por chamada (custo observado). Só os itens NOVOS aparecem em detalhe; os que já');
  console.log('têm imagem crua em raw/ com o mesmo pedido (e passam na pré-checagem) são reaproveitados sem custo.');
  console.log(a.testarCrinas ? 'Rodada de crinas: uma tentativa por etapa; o galope só é pedido se a corrida passar (a previsão conta o máximo).\n'
    : 'Repetições (até 2 por item) não entram na previsão.\n');
  let total = 0, n = 0;
  const crus = [];
  for (const [i, c] of plano.entries()) {
    if (c.cru) { crus.push(`${c.item} (seed ${c.seed})`); continue; }
    if (total + 1 > a.teto) {
      console.log(`AVISO: o teto de ${a.teto} gerações cortou os itens novos a partir de ${c.item} (${plano.slice(i).filter(x => !x.cru).length} sem previsão).`);
      break;
    }
    total++; n++;
    console.log(`${String(n).padStart(3)}. POST ${c.endpoint.padEnd(22)} ${c.item.padEnd(24)} seed ${c.seed}  ~1 geração`);
    console.log(`       ${c.texto}`);
  }
  console.log(`\nReaproveitados de raw/ (0 geração): ${crus.length ? crus.join(', ') : 'nenhum'}.`);
  console.log(`\nTotal previsto: ${total} gerações em ${n} chamadas novas (+ ${crus.length} reaproveitadas de raw/; teto ${a.teto}).`);
}

// ---------------------------------------------------------------- API, teto e erros
class TetoAtingido extends Error {}
class ErroApi extends Error {
  // talvezCobrado: a chamada pode ter consumido cota (conta no teto); fatal: não adianta repetir.
  constructor(msg, { talvezCobrado = false, fatal = false, geracoes = null } = {}) {
    super(msg); this.talvezCobrado = talvezCobrado; this.fatal = fatal; this.geracoes = geracoes;
  }
}
const recuperavel = e => e instanceof ErroApi && !e.fatal;
const dormir = ms => new Promise(r => setTimeout(r, ms));
const TOKEN = process.env.PIXELLAB_API_KEY || 'proxy-injected';
let REDE_LIBERADA = false; // só --gerar libera; o dry-run nunca chega aqui
let REPROCESSAR = false;   // --reprocessar: só raw/, nenhuma chamada

async function chamar(metodo, caminho, corpo) {
  if (!REDE_LIBERADA) throw new Error('chamada de rede sem --gerar (bug do script)');
  for (let espera = 0; ; espera++) {
    let res, texto;
    try {
      res = await fetch(API + caminho, {
        method: metodo,
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      texto = await res.text();
    } catch (e) {
      throw new ErroApi(`${metodo} ${caminho}: falha de rede (${e.message})`, { talvezCobrado: true });
    }
    if ((res.status === 429 || res.status === 529) && espera < 6) {
      console.log(`    ${metodo} ${caminho}: HTTP ${res.status} (muitas requisições); nova tentativa em ${10 * (espera + 1)} s`);
      await dormir(10000 * (espera + 1));
      continue;
    }
    let json = null;
    try { json = JSON.parse(texto); } catch { /* tratado abaixo */ }
    if (!res.ok) {
      const dica = res.status === 401 ? ' — atrás do proxy da sessão, rode com NODE_USE_ENV_PROXY=1' : '';
      throw new ErroApi(`${metodo} ${caminho} → HTTP ${res.status}: ${texto.slice(0, 600)}${dica}`,
        { talvezCobrado: res.status >= 500, fatal: res.status < 500 });
    }
    if (!json) throw new ErroApi(`${metodo} ${caminho}: resposta não é JSON`, { talvezCobrado: true });
    return json;
  }
}

async function esperarJob(id) {
  const limite = Date.now() + 15 * 60 * 1000;
  let falhas = 0;
  while (Date.now() < limite) {
    await dormir(5000);
    let job;
    try { job = await chamar('GET', `/background-jobs/${id}`); falhas = 0; } catch (e) {
      if (e.fatal || ++falhas > 5) throw e;
      continue;
    }
    if (job.status === 'completed') return job;
    if (job.status === 'failed') {
      throw new ErroApi(`job ${id} falhou: ${JSON.stringify(semBase64(job.last_response)).slice(0, 400)}`,
        { talvezCobrado: true, geracoes: geracoesDe(job) });
    }
  }
  throw new ErroApi(`job ${id}: tempo esgotado (15 min)`, { talvezCobrado: true });
}

// Gerações cobradas segundo as respostas (null se nenhuma informar). O POST do animate e o job
// reportam a MESMA cobrança, por isso vale o maior valor, não a soma.
function geracoesDe(...resps) {
  let g = null;
  for (const r of resps) for (const u of [r && r.usage, r && r.last_response && r.last_response.usage]) {
    if (u && typeof u.generations === 'number') g = Math.max(g ?? 0, u.generations);
  }
  return g;
}
function usdDe(...resps) {
  let usd = 0;
  for (const r of resps) for (const u of [r && r.usage, r && r.last_response && r.last_response.usage]) {
    if (u && u.type === 'usd' && u.usd > 0) usd = Math.max(usd, u.usd);
  }
  return usd;
}

const orc = {
  teto: 60, gasto: 0, chamadas: 0, maximo: {},
  // estimativa da próxima chamada: o maior custo já visto no endpoint, no mínimo 1
  estimativa(ep) { return Math.max(1, this.maximo[ep] || 0); },
  reservar(ep, rotulo) {
    const e = this.estimativa(ep);
    if (this.gasto + e > this.teto + 1e-9) {
      throw new TetoAtingido(`parou antes de ${rotulo} (${ep}, ~${e}): gasto ${fmt(this.gasto)} + ${e} passaria do teto de ${this.teto}`);
    }
  },
  registrar(ep, g) { this.gasto += g; this.chamadas++; this.maximo[ep] = Math.max(this.maximo[ep] || 0, g); },
};

// Executa uma chamada paga: confere o teto antes e soma o custo real depois (ou a estimativa, se a
// resposta não informar ou se a chamada falhar depois de possivelmente cobrar).
async function pago(ep, item, executar) {
  if (REPROCESSAR) throw new ErroApi(`--reprocessar: faltaria gerar ${item.rotulo} (sem imagem crua em raw/)`, { fatal: true });
  orc.reservar(ep, item.rotulo);
  const est = orc.estimativa(ep);
  let r;
  try {
    r = await executar();
  } catch (e) {
    if (!(e instanceof ErroApi) || e.talvezCobrado) {
      const g = e.geracoes ?? est;
      orc.registrar(ep, g); item.geracoes += g;
      console.log(`    ${item.rotulo}: chamada com erro, conta ${fmt(g)} geração(ões) [total ${fmt(orc.gasto)}/${orc.teto}]`);
    }
    throw e;
  }
  const real = geracoesDe(...r.respostas);
  const g = real ?? est;
  orc.registrar(ep, g); item.geracoes += g;
  console.log(`    ${item.rotulo}: ${fmt(g)} geração(ões)${real == null ? ' (resposta sem usage; contada a estimativa)' : ''} [total ${fmt(orc.gasto)}/${orc.teto}]`);
  const usd = usdDe(...r.respostas);
  if (usd > 0) throw new ErroApi(`cobrança inesperada em US$ ${usd} (esperado só cota do plano)`, { fatal: true });
  return r.resultado;
}

// ---------------------------------------------------------------- itens e repetições
const ITENS = [];
function novoItem(rotulo, seedBase, tentativas = null) {
  // geracoes: gastas neste lote; anteriores: de imagens cruas reaproveitadas (gastas antes)
  const extra = REPETIR_EXTRA.includes(rotulo) ? 1 : 0;
  const it = { rotulo, seedBase, seeds: [], geracoes: 0, anteriores: 0, reaproveitadas: [], rejeicoes: [], extra, tentativas: tentativas ?? MAX_REPETICOES + 1 + extra };
  ITENS.push(it);
  return it;
}
// próxima seed do item (base, base + 10, base + 20 [, base + 30 com --repetir]) ou null quando acabaram
function proximaSeed(it) {
  if (it.seeds.length >= it.tentativas) return null;
  const s = it.seedBase + PASSO_SEED * it.seeds.length;
  it.seeds.push(s);
  return s;
}
function rejeitar(it, seed, motivo) {
  it.rejeicoes.push(`seed ${seed}: ${motivo}`);
  console.log(`    REJEITADO ${it.rotulo} seed ${seed}: ${motivo}`);
}
function reaproveitar(it, seed, reg) {
  const g = geracoesDe(reg.resposta, reg.resposta && reg.resposta.job) ?? 1;
  it.anteriores += g; it.reaproveitadas.push(seed);
  console.log(`    ${it.rotulo}: reaproveitada a imagem crua da seed ${seed} (mesmo pedido; ${fmt(g)} geração gasta antes)`);
}
// seed com erro de API (não cobrada) ou rejeitada na conferência visual (cobrada: entra no custo da linha)
function pular(it, seed, reg) {
  if (reg.rejeitada) it.anteriores += geracoesDe(reg.resposta, reg.resposta && reg.resposta.job) ?? 1;
  rejeitar(it, seed, reg.erro ? `erro registrado em lote anterior: ${reg.erro}` : `rejeitada na conferência visual: ${reg.rejeitada}`);
}
const ultimaSeed = it => it.seeds[it.seeds.length - 1];
const custoTotal = it => it.geracoes + it.anteriores;
function seedTxt(it) {
  const rej = it.seeds.slice(0, -1), s = ultimaSeed(it);
  return `seed ${s}${it.reaproveitadas.includes(s) ? ' (imagem crua de rodada anterior, reaproveitada)' : ''}`
    + (rej.length ? ` (repetição; rejeitada${rej.length > 1 ? 's' : ''}: ${rej.join(', ')})` : '');
}

function decodificar64(buf, onde) {
  const d = decodePng(buf);
  if (d.width !== LADO || d.height !== LADO) {
    throw new ErroApi(`${onde}: imagem ${d.width}×${d.height}, esperado ${LADO}×${LADO}`, { fatal: true });
  }
  return d;
}
// Classifica um grupo de quadros com os limiares do próprio grupo (como nos finais: retrato, parado e o
// galope inteiro), limpa, valida e devolve a 1ª falha — antes de gastar a etapa seguinte.
function preChecar(bufs, comJoquei, onde, contorno) {
  const fams = bufs.map((b, i) => classificarFamilias(decodificar64(b, `${onde} quadro ${i}`).rgba, LADO, LADO));
  const tons = limiaresDeTons(fams);
  const ruins = [], quadros = fams.map(f => posProcessar(f, tons, { comJoquei, contorno }));
  quadros.forEach((q, i) => {
    const v = validar(q, { exigeJoquei: comJoquei });
    if (!v.ok) ruins.push((bufs.length > 1 ? `galope-${i}: ` : '') + v.motivo);
  });
  return ruins.length ? { ok: false, motivo: ruins.join('; ') } : { ok: true, quadros };
}

// ---------------------------------------------------------------- aceite do galope de corrida (spec 2026-11-09 §4)
// Referência: o galope final de chamas. Galope: maior passada ≥ 80 % da maior de chamas; altura do contorno
// de cada quadro ≤ 110 % da altura média de chamas; e o focinho não deriva mais de 6 px (o mesmo que o
// moldes-test confere). Corrida (montado, 1 quadro): altura ≤ 110 % da média e passada ≥ 80 % da passada do
// quadro-guia (o 1º de chamas) — a guia, que é corrida por definição, tem de passar no próprio filtro.
const ACEITE = { passada: 0.8, altura: 1.1, derivaFocinho: 6 };
let REF_CORRIDA = null;
function referenciaCorrida() {
  if (REF_CORRIDA) return REF_CORRIDA;
  const arq = path.join(DIR_MOLDES, 'molde-chamas.json');
  if (!fs.existsSync(arq)) throw new ErroApi('aceite da corrida: falta o molde de chamas (a referência)', { fatal: true });
  const J = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const qs = Array.from({ length: J.frames }, (_, i) => {
    const d = decodePng(fs.readFileSync(path.join(DIR_MOLDES, `molde-chamas-galope-${i}.png`)));
    return deCinza(Uint8Array.from({ length: LADO * LADO }, (_, k) => d.rgba[k * 4]));
  });
  const ps = qs.map(q => passada(q, LADO, LADO)), hs = qs.map(q => ancoras(q, LADO, LADO).bbox.h);
  REF_CORRIDA = { passadaMax: Math.max(...ps), passadaGuia: ps[0], alturaMedia: hs.reduce((s, v) => s + v, 0) / hs.length };
  return REF_CORRIDA;
}
const medidas = qs => ({ passadas: qs.map(q => passada(q.idx, LADO, LADO)), alturas: qs.map(q => ancoras(q.idx, LADO, LADO).bbox.h) });
function aceiteCorrida(q) {
  const r = referenciaCorrida(), { passadas: [p], alturas: [h] } = medidas([q]);
  const minP = ACEITE.passada * r.passadaGuia, maxH = ACEITE.altura * r.alturaMedia;
  const txt = `passada ${p} (mín. ${fmt(minP)}), altura ${h} (máx. ${fmt(maxH)})`;
  if (h > maxH) return { ok: false, motivo: `aceite da corrida: corpo alto — ${txt}` };
  if (p < minP) return { ok: false, motivo: `aceite da corrida: patas recolhidas — ${txt}` };
  return { ok: true, txt };
}
function aceiteGalope(qs) {
  const r = referenciaCorrida(), m = medidas(qs);
  const minP = ACEITE.passada * r.passadaMax, maxH = ACEITE.altura * r.alturaMedia;
  const nx = qs.map(q => ancoras(q.idx, LADO, LADO).nose[0]), deriva = Math.max(...nx.map(x => Math.abs(x - nx[0])));
  const txt = `passadas ${m.passadas.join(' ')} (maior ${Math.max(...m.passadas)}, mín. ${fmt(minP)}); alturas ${m.alturas.join(' ')} (máx. ${fmt(maxH)}); focinho deriva ${deriva} px (máx. ${ACEITE.derivaFocinho})`;
  const altos = m.alturas.map((h, i) => (h > maxH ? `galope-${i}` : null)).filter(Boolean);
  if (Math.max(...m.passadas) < minP) return { ok: false, motivo: `aceite do galope: passada curta — ${txt}` };
  if (altos.length) return { ok: false, motivo: `aceite do galope: corpo alto em ${altos.join(', ')} — ${txt}` };
  if (deriva > ACEITE.derivaFocinho) return { ok: false, motivo: `aceite do galope: focinho deriva — ${txt}` };
  return { ok: true, txt };
}
// pré-checagem completa de um item (validar + aceite da corrida, quando o estilo tem corrida)
function checarPose(estilo, pose, buf, rotulo) {
  const v = preChecar([buf], pose !== 'retrato', rotulo, pose === 'montado' || pose === 'corrida');
  return v.ok && pose === 'corrida' ? aceiteCorrida(v.quadros[0]) : v;
}
function checarGalope(estilo, bufs, rotulo) {
  if (bufs.length !== 9 && bufs.length !== 8) return { ok: false, motivo: `veio com ${bufs.length} quadros (esperado 9, ou 8)` };
  const v = preChecar(bufs, true, rotulo, true);
  return v.ok && estilo.corrida ? aceiteGalope(v.quadros) : v;
}

// ---------------------------------------------------------------- moldes
async function gerarPose(estilo, pose, it) {
  for (let seed; (seed = proximaSeed(it)) != null;) {
    console.log(`  ${it.rotulo} seed ${seed}${pose === 'corrida' ? ` (init_image raw/${GUIA_CORRIDA}, força ${estilo.corrida.forca})` : ''}`);
    const corpo = pedidoPose(estilo, pose, seed), base = `${prefixoPose(estilo, pose)}-s${seed}`;
    const reg = lerCru(DIR_MOLDES_RAW, base, corpo), crus = reg && pngsCrus(DIR_MOLDES_RAW, base, false);
    if (reg && (reg.erro || reg.rejeitada)) { pular(it, seed, reg); continue; }
    let buf;
    if (crus) {
      reaproveitar(it, seed, reg); buf = crus[0]; it.data = reg.data;
    } else {
      let resp;
      try {
        resp = await pago(PIXFLUX, it, async () => { const r = await chamar('POST', PIXFLUX, corpo); return { resultado: r, respostas: [r] }; });
      } catch (e) {
        if (recuperavel(e)) { gravarErro(DIR_MOLDES_RAW, base, PIXFLUX, corpo, e); rejeitar(it, seed, e.message); continue; }
        throw e;
      }
      buf = bufDe(resp.image, it.rotulo);
      gravarCru(DIR_MOLDES_RAW, base, PIXFLUX, corpo, resp, [[base + '.png', buf]]);
      it.data = new Date().toISOString();
    }
    const v = checarPose(estilo, pose, buf, it.rotulo);
    if (v.ok) { if (v.txt) { it.aceite = v.txt; console.log(`    aceite ok: ${v.txt}`); } return buf; }
    rejeitar(it, seed, v.motivo);
  }
  return null;
}

async function gerarGalope(estilo, it, montado, seedMontado) {
  for (let seed; (seed = proximaSeed(it)) != null;) {
    console.log(`  ${it.rotulo} seed ${seed} (montado ${seedMontado}; job assíncrono; pode levar minutos)`);
    const corpo = pedidoGalope(montado, seed, acaoDe(estilo)), base = `${prefixoGalope(estilo, seedMontado)}-s${seed}`;
    const reg = lerCru(DIR_MOLDES_RAW, base, corpo);
    if (reg && (reg.erro || reg.rejeitada)) { pular(it, seed, reg); continue; }
    let bufs = reg && pngsCrus(DIR_MOLDES_RAW, base, true);
    if (bufs) {
      reaproveitar(it, seed, reg); it.data = reg.data;
    } else {
      let r;
      try {
        r = await pago(ANIMA, it, async () => {
          const post = await chamar('POST', ANIMA, corpo);
          const job = post.background_job_id ? await esperarJob(post.background_job_id) : post;
          return { resultado: { post, job }, respostas: [post, job] };
        });
      } catch (e) {
        if (recuperavel(e)) { gravarErro(DIR_MOLDES_RAW, base, ANIMA, corpo, e); rejeitar(it, seed, e.message); continue; }
        throw e;
      }
      const imgs = (r.job.last_response && r.job.last_response.images) || r.job.images || [];
      bufs = imgs.map((img, i) => bufDe(img, `${it.rotulo} quadro ${i}`));
      // pedido refeito com o mesmo nome: apaga os quadros antigos para não misturar 8 com 9
      for (const f of fs.existsSync(DIR_MOLDES_RAW) ? fs.readdirSync(DIR_MOLDES_RAW) : []) {
        if (new RegExp(`^${base}-\\d+\\.png$`).test(f)) fs.unlinkSync(path.join(DIR_MOLDES_RAW, f));
      }
      gravarCru(DIR_MOLDES_RAW, base, ANIMA, corpo, r, bufs.map((b, i) => [`${base}-${i}.png`, b]));
      it.data = new Date().toISOString();
    }
    if (bufs.length !== 9 && bufs.length !== 8) {
      throw new ErroApi(`${it.rotulo}: veio com ${bufs.length} quadros (esperado 9, ou 8)`, { fatal: true });
    }
    if (bufs.length === 8) console.log(`    AVISO ${it.rotulo}: vieram 8 quadros (não 9); usando 8`);
    const v = checarGalope(estilo, bufs, it.rotulo);
    if (v.ok) { if (v.txt) { it.aceite = v.txt; console.log(`    aceite ok: ${v.txt}`); } return bufs; }
    rejeitar(it, seed, v.motivo);
  }
  return null;
}

// Grava um arquivo final e diz se o conteúdo mudou (um final refeito igual de raw/ não troca o registro).
function gravarFinal(arq, buf) {
  const igual = fs.existsSync(arq) && fs.readFileSync(arq).equals(buf);
  if (!igual) fs.writeFileSync(arq, buf);
  return !igual;
}

async function gerarEstilo(estilo) {
  const poseM = poseMontada(estilo);
  console.log(`\n== Molde ${estilo.id} (seed base ${estilo.seed}${estilo.corrida ? `; corrida e galope ${estilo.corrida.seed}` : ''}) ==`);
  const it = {};
  for (const k of [...posesDe(estilo), 'galope']) it[k] = novoItem(`${estilo.id}/${k}`, seedBaseDe(estilo, k));
  const falhou = motivo => { console.log(`  FALHOU ${estilo.id}: ${motivo} — nada gravado como final (crus em raw/)`); return { estilo: estilo.id, ok: false, motivo }; };

  const fontes = {};
  for (const pose of posesDe(estilo)) {
    fontes[pose] = await gerarPose(estilo, pose, it[pose]);
    if (!fontes[pose]) return falhou(`${pose} rejeitado em todas as tentativas`);
  }
  const galope = await gerarGalope(estilo, it.galope, fontes[poseM], ultimaSeed(it[poseM]));
  if (!galope) return falhou('galope rejeitado em todas as tentativas');

  // finais: limiares por geração (retrato, parado, galope) e contorno só no galope — o mesmo que a
  // pré-checagem de cada item já validou, então aqui um quadro inválido seria erro do script
  const nomes = ['retrato', 'parado', ...galope.map((_, i) => 'galope-' + i)];
  const grupoDe = n => (n.startsWith('galope-') ? 'galope' : n);
  const fams = nomes.map(n => classificarFamilias(decodificar64(n.startsWith('galope-') ? galope[Number(n.slice(7))] : fontes[n], n).rgba, LADO, LADO));
  const tons = {};
  for (const g of ['retrato', 'parado', 'galope']) tons[g] = limiaresDeTons(fams.filter((_, i) => grupoDe(nomes[i]) === g));
  const quadros = fams.map((f, i) => posProcessar(f, tons[grupoDe(nomes[i])], { comJoquei: nomes[i] !== 'retrato', contorno: grupoDe(nomes[i]) === 'galope' }));
  const invalidos = quadros.map((q, i) => [nomes[i], validar(q, { exigeJoquei: nomes[i] !== 'retrato' })]).filter(([, v]) => !v.ok);
  if (invalidos.length) return falhou('inconsistência entre pré-checagem e finais: ' + invalidos.map(([n, v]) => `${n}: ${v.motivo}`).join('; '));

  // grava os finais (remove galopes antigos: um lote de 8 quadros não pode herdar um galope-8 velho); guarda o
  // conteúdo antigo para saber o que mudou de fato
  const antigos = {};
  for (const f of fs.readdirSync(DIR_MOLDES)) {
    if (!f.startsWith(`molde-${estilo.id}-galope-`)) continue;
    antigos[f] = fs.readFileSync(path.join(DIR_MOLDES, f)); fs.unlinkSync(path.join(DIR_MOLDES, f));
  }
  const anc = {}, mudou = {};
  nomes.forEach((n, i) => {
    const f = `molde-${estilo.id}-${n}.png`, buf = encodeGray({ width: LADO, height: LADO, data: paraCinza(quadros[i].idx) });
    mudou[n] = n.startsWith('galope-') ? !(antigos[f] && antigos[f].equals(buf)) : gravarFinal(path.join(DIR_MOLDES, f), buf);
    if (n.startsWith('galope-')) fs.writeFileSync(path.join(DIR_MOLDES, f), buf);
    anc[n] = ancoras(quadros[i].idx, LADO, LADO);
  });
  // data da geração = a da imagem crua mais nova usada (refazer de raw/ não muda o JSON)
  const gerado = Object.values(it).map(x => x.data || '').reduce((a, b) => (b > a ? b : a), '').slice(0, 10) || HOJE;
  const json = {
    estilo: estilo.id, w: LADO, h: LADO, footY: anc.retrato.footY, frames: galope.length,
    larguraUtil: anc.retrato.bbox.w,
    limiares: tons, // por geração; luminância ≤ limiar ⇒ sombra; procedural ⇒ sombreado por coluna
    seeds: { retrato: ultimaSeed(it.retrato), parado: ultimaSeed(it.parado), montado: ultimaSeed(it[poseM]), galope: ultimaSeed(it.galope) },
    ...(estilo.corrida ? { corrida: { guia: `raw/${GUIA_CORRIDA}`, init_image_strength: estilo.corrida.forca } } : {}),
    gerado,
  };
  // uma linha por quadro: âncoras e contagens (aproximados, remapeados pela limpeza, contorno acrescentado)
  const linhas = obj => nomes.map(n => `    "${n}": ${JSON.stringify(obj[n])}`).join(',\n');
  const cont = {};
  nomes.forEach((n, i) => { cont[n] = { aproximados: quadros[i].aproximados, remapeados: quadros[i].remapeados, contornados: quadros[i].contornados }; });
  const jsonMudou = gravarFinal(path.join(DIR_MOLDES, `molde-${estilo.id}.json`), Buffer.from(
    JSON.stringify(json, null, 2).replace(/\n}$/, `,\n  "contagens": {\n${linhas(cont)}\n  },\n  "ancoras": {\n${linhas(anc)}\n  }\n}\n`)));
  const galopeMudou = jsonMudou || nomes.some(n => n.startsWith('galope-') && mudou[n]) || Object.keys(antigos).length !== galope.length;

  const pre = `prototype/assets/pixellab/molde-${estilo.id}`, crina = `crina "${estilo.crina}"`, uso = 'Sim';
  const proc = 'cores de papel pedidas por texto (pelo #ff0000, crina #00ff00 …; sem paleta forçada); papéis por família de cor + Otsu do estilo';
  const reforco = estilo.montado ? `, reforço "${estilo.montado.reforco}"` : '';
  if (mudou.retrato) registrarAsset(`\`${pre}-retrato.png\``, '`create-image-pixflux`',
    `retrato 64×64: cavalo parado sem jóquei nem sela, ${crina}, ${proc}`, seedTxt(it.retrato), custoTotal(it.retrato), uso);
  if (mudou.parado) registrarAsset(`\`${pre}-parado.png\``, '`create-image-pixflux`',
    `parado 64×64: cavalo parado com jóquei (seda e capacete #ffff00, pele #ffc0cb, sela e manta #808080), ${crina}, ${proc}`,
    seedTxt(it.parado), custoTotal(it.parado), uso);
  const montadoTxt = estilo.corrida
    ? `corrida (pose de corrida guiada pelo 1º quadro cru do galope de chamas, init_image raw/${GUIA_CORRIDA}, init_image_strength ${estilo.corrida.forca}; "${POSES.corrida}", ${crina}${reforco}; ${seedTxt(it[poseM])}; aceite ${it[poseM].aceite})`
    : `montado (meio da passada, com jóquei, ${crina}${reforco}; ${seedTxt(it[poseM])})`;
  if (galopeMudou) registrarAsset(`\`${pre}-galope-0..${galope.length - 1}.png\` e \`${pre}.json\``, '`create-image-pixflux` + `animate-with-text-v3`',
    `${montadoTxt} animado com "${acaoDe(estilo)}", frame_count 8 (${galope.length} quadros recebidos), drift_threshold 0`,
    `galope ${seedTxt(it.galope)}${it.galope.aceite ? `; aceite ${it.galope.aceite}` : ''}`, custoTotal(it[poseM]) + custoTotal(it.galope), uso);

  const t = (g, k) => `${k} ${tons[g][k].procedural ? 'procedural' : tons[g][k].limiar}`;
  console.log(`  OK ${estilo.id}: ${nomes.length} quadros (${galope.length} de galope), larguraUtil ${json.larguraUtil}, footY ${json.footY}; `
    + ['retrato', 'parado', 'galope'].map(g => `${g}: ${t(g, 'pelagem')}, ${t(g, 'crina')}`).join(' | ')
    + `; finais que mudaram: ${[mudou.retrato && 'retrato', mudou.parado && 'parado', galopeMudou && 'galope/json'].filter(Boolean).join(', ') || 'nenhum'}`);
  return { estilo: estilo.id, ok: true, frames: galope.length, aceite: it.galope.aceite };
}

// Rodada de crinas: cada variante com UMA tentativa de corrida e, se ela passar na pré-checagem (validar +
// aceite da pose), UMA de galope (validar + aceite). Grava só em raw/: a comparação da crina é visual, e a
// variante escolhida vira o `corrida` do estilo (os finais saem num --gerar normal, reaproveitando raw/).
async function testarCrinas(estilo, forca) {
  const res = [];
  for (const v of estilo.testesCrina.filter(x => forca == null || x.forca === forca)) {
    const ev = { ...estilo, corrida: v };
    console.log(`\n== Crina ${estilo.id}, força ${v.forca} (seed ${v.seed}; crina reforçada no texto) ==`);
    const itC = novoItem(`${estilo.id}/corrida-f${v.forca}`, v.seed, 1), itG = novoItem(`${estilo.id}/galope-f${v.forca}`, v.seed, 1);
    const montado = await gerarPose(ev, 'corrida', itC);
    const base = { estilo: estilo.id, forca: v.forca, seed: v.seed };
    if (!montado) { res.push({ ...base, ok: false, motivo: 'corrida reprovada (sem galope)' }); continue; }
    const galope = await gerarGalope(ev, itG, montado, v.seed);
    res.push(galope ? { ...base, ok: true, aceite: itG.aceite } : { ...base, ok: false, motivo: 'galope reprovado' });
  }
  for (const r of res) console.log(`  ${r.ok ? 'PASSOU' : 'REPROVOU'} ${r.estilo} força ${r.forca} seed ${r.seed}: ${r.ok ? r.aceite : r.motivo}`);
  return res;
}

// ---------------------------------------------------------------- ícones
async function gerarIcone(ic) {
  console.log(`\n== Ícone ${ic.id} ==`);
  const it = novoItem(`icone/${ic.id}`, ic.seed);
  for (let seed; (seed = proximaSeed(it)) != null;) {
    console.log(`  ${it.rotulo} seed ${seed}`);
    const corpo = pedidoIcone(ic, seed), base = `${ic.id}-s${seed}`;
    const reg = lerCru(DIR_ICONES_RAW, base, corpo), crus = reg && pngsCrus(DIR_ICONES_RAW, base, false);
    if (reg && (reg.erro || reg.rejeitada)) { pular(it, seed, reg); continue; }
    let buf;
    if (crus) {
      reaproveitar(it, seed, reg); buf = crus[0];
    } else {
      let resp;
      try {
        resp = await pago(PIXFLUX, it, async () => { const r = await chamar('POST', PIXFLUX, corpo); return { resultado: r, respostas: [r] }; });
      } catch (e) {
        if (recuperavel(e)) { gravarErro(DIR_ICONES_RAW, base, PIXFLUX, corpo, e); rejeitar(it, seed, e.message); continue; }
        throw e;
      }
      buf = bufDe(resp.image, it.rotulo);
      gravarCru(DIR_ICONES_RAW, base, PIXFLUX, corpo, resp, [[base + '.png', buf]]);
    }
    const d = decodePng(buf);
    if (d.width !== 32 || d.height !== 32) throw new ErroApi(`${it.rotulo}: imagem ${d.width}×${d.height}, esperado 32×32`, { fatal: true });
    let opacos = 0;
    for (let i = 3; i < d.rgba.length; i += 4) if (d.rgba[i] >= 128) opacos++;
    if (!opacos) { rejeitar(it, seed, 'ícone vazio (nenhum pixel opaco)'); continue; }
    fs.mkdirSync(DIR_ICONES, { recursive: true });
    const mudou = gravarFinal(path.join(DIR_ICONES, `${ic.id}.png`), encodePng(d));
    if (mudou) registrarAsset(`\`prototype/assets/icons/${ic.id}.png\``, '`create-image-pixflux`',
      `ícone 32×32 "${ic.desc}, ${SUFIXO_ICONE}", contorno preto, color_image = ${coresIcone(ic).join(' ')}`,
      seedTxt(it), custoTotal(it), 'Sim');
    console.log(`  OK ${ic.id}: ${opacos} pixels opacos${mudou ? '' : ' (final igual ao que já estava)'}`);
    return { icone: ic.id, ok: true };
  }
  console.log(`  FALHOU ${ic.id}: rejeitado em todas as tentativas`);
  return { icone: ic.id, ok: false };
}

// ---------------------------------------------------------------- principal
async function saldo(quando) {
  const b = await chamar('GET', '/balance');
  const s = b.subscription || {};
  console.log(`Saldo ${quando}: ${s.generations}/${s.total} gerações do plano (${s.plan || 'plano ?'}, ${s.status}); créditos US$ ${b.credits && b.credits.usd}`);
  return b;
}

async function gerar(a) {
  REPROCESSAR = a.reprocessar;
  REDE_LIBERADA = !REPROCESSAR;
  orc.teto = a.teto;
  fs.mkdirSync(DIR_MOLDES, { recursive: true });
  console.log(`${REPROCESSAR ? 'REPROCESSAMENTO a partir de raw/ (sem rede)' : 'GERAÇÃO REAL'} — lote "${a.lote}"${a.only ? ` (--only ${a.only})` : ''}; teto ${a.teto} gerações.`);
  const antes = REPROCESSAR ? null : await saldo('antes');
  const disponivel = antes && antes.subscription && antes.subscription.generations;
  if (!REPROCESSAR && !(disponivel >= a.teto)) {
    throw new ErroApi(`saldo do plano (${disponivel}) menor que o teto (${a.teto}): o resto sairia dos créditos em US$; abortado`, { fatal: true });
  }

  const resultados = [];
  let parada = null;
  try {
    if (a.testarCrinas) for (const e of a.estilos) for (const r of await testarCrinas(e, a.forca)) resultados.push({ ...r, teste: true });
    else {
      for (const e of a.estilos) resultados.push(await gerarEstilo(e));
      for (const ic of a.icones) resultados.push(await gerarIcone(ic));
    }
  } catch (e) {
    parada = e instanceof TetoAtingido ? `TETO: ${e.message}` : `ERRO FATAL: ${e instanceof ErroApi ? e.message : e.stack}`;
    console.log('\n' + parada);
  }

  console.log('\n== Resumo ==');
  for (const it of ITENS) {
    if (!it.seeds.length) continue;
    const reap = it.reaproveitadas.length ? `; reaproveitada(s) ${it.reaproveitadas.join(', ')} (${fmt(it.anteriores)} ger. anteriores)` : '';
    console.log(`  ${it.rotulo.padEnd(26)} ${fmt(it.geracoes)} ger.  seeds ${it.seeds.join(', ')}${reap}${it.rejeicoes.length ? `\n      rejeições: ${it.rejeicoes.join(' | ')}` : ''}`);
  }
  const moldes = resultados.filter(r => r.estilo && !r.teste);
  if (moldes.length) console.log('  Quadros de galope: ' + moldes.map(r => `${r.estilo} ${r.ok ? r.frames : 'falhou'}`).join(', '));
  if (moldes.some(r => r.aceite)) {
    const ref = referenciaCorrida();
    console.log(`  Aceite da corrida (chamas: maior passada ${ref.passadaMax}, passada da guia ${ref.passadaGuia}, altura média ${fmt(ref.alturaMedia)}):`);
    for (const r of moldes) if (r.aceite) console.log(`    ${r.estilo}: ${r.aceite}`);
  }
  const falhas = resultados.filter(r => !r.ok);
  console.log(`  Itens finais: ${resultados.length - falhas.length} ok, ${falhas.length} com falha${parada ? '; lote interrompido' : ''}`);
  console.log(`  Gerações gastas neste lote (soma do usage): ${fmt(orc.gasto)} de teto ${a.teto}, em ${orc.chamadas} chamadas pagas`);
  if (REPROCESSAR) return parada || falhas.length ? 1 : 0;
  try {
    const depois = await saldo('depois');
    const queda = antes.subscription.generations - depois.subscription.generations;
    console.log(`  Queda do saldo: ${fmt(queda)} gerações${Math.abs(queda - orc.gasto) > 1e-6 ? ` (ATENÇÃO: difere da soma do usage, ${fmt(orc.gasto)})` : ' (confere com a soma do usage)'}`);
  } catch (e) {
    console.log('  Saldo depois: indisponível (' + e.message + ')');
  }
  return parada || falhas.length ? 1 : 0;
}

const args = lerArgs(process.argv.slice(2));
if (!args.gerar && !args.reprocessar) {
  dryRun(args);
} else {
  try {
    process.exitCode = await gerar(args);
  } catch (e) {
    console.error('ERRO: ' + (e instanceof ErroApi ? e.message : e.stack));
    process.exitCode = 1;
  }
}
