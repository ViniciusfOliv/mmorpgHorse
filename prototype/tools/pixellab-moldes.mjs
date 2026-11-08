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
// Credencial: o proxy de rede injeta a chave (nunca no código nem em arquivo). O fetch do Node não lê
// HTTPS_PROXY sozinho: na sessão na nuvem, rode com NODE_USE_ENV_PROXY=1 (Node ≥ 22.21), senão a API
// responde 401 (a chamada sai sem passar pelo proxy e sem a chave).
//
// Moldes (por estilo): retrato, parado e montado em /create-image-pixflux com as cores de papel pedidas
// por TEXTO, galope em /animate-with-text-v3 a partir do montado. Cada quadro é classificado por família de
// cor (moldes-lib: classificarFamilias); claro × sombra da pelagem e da crina usam um limiar de Otsu por
// geração — retrato, parado e os quadros do galope juntos (para o galope não piscar); juntar as três
// gerações não serve, porque cada uma vem com um brilho diferente. Depois limpa os papéis do jóquei,
// sombreia por procedimento o par desequilibrado, fecha o contorno (o animate devolve sem borda) e valida.
// Quadro inválido refaz o item com seed + 10 (até 2 repetições por item, contando no teto).
// A paleta forçada (color_image com as cores de papel + /reduce-colors) foi testada em 2026-11-08 e
// descartada: o modelo pintava cada par num tom só (pelagem toda #800000, crina toda #008000) e punha
// cores do jóquei na crina; com cores livres + classificação o resultado ficou melhor (relatório da Task 2).
// Uma imagem crua já gravada em raw/ com o MESMO pedido (prompt, parâmetros, seed e imagens de entrada)
// é reaproveitada sem nova chamada; uma tentativa que deu erro de API fica registrada (JSON com "erro") e
// a seed é pulada ao retomar o lote.
// Saídas:
//   prototype/assets/pixellab/molde-<estilo>-{retrato,parado,galope-N}.png  (cinza = papel × 25)
//   prototype/assets/pixellab/molde-<estilo>.json        (âncoras, larguraUtil, limiares por geração, seeds)
//   prototype/assets/pixellab/raw/  (PNGs crus e respostas JSON sem os base64)
// Ícones: 16 × /create-image-pixflux 32×32 com a paleta da interface em color_image (pedido do plano) →
// prototype/assets/icons/<nome>.png (RGBA) e icons/raw/. Cada arquivo final ganha uma linha em
// docs/memoria/assets.md.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, encodeGray } from './png.mjs';
import { validar, ancoras, paraCinza, classificarFamilias, limiaresDeTons, posProcessar } from './moldes-lib.mjs';

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
const JOQUEI = 'with a small jockey riding, jockey in yellow (#ffff00) silks and yellow helmet with pink (#ffc0cb) skin, grey (#808080) saddle and saddle pad and reins';
const POSES = {
  retrato: 'standing still horse, no rider, no saddle',
  parado: 'horse standing still ' + JOQUEI,
  montado: 'racing horse in mid-gallop stride ' + JOQUEI,
};
const ESTILOS = [
  { id: 'chamas', seed: 1101, crina: 'mane and tail shaped like flickering flames' },
  { id: 'ondas', seed: 1201, crina: 'mane and tail shaped like flowing water waves' },
  { id: 'folhas', seed: 1301, crina: 'mane and tail made of leaves' },
  { id: 'lisa', seed: 1401, crina: 'long straight flowing mane and tail' },
];
const ACAO_GALOPE = 'galloping at full racing speed in a seamless loop, legs extending and gathering, mane and tail flowing back';

const SUFIXO_ICONE = 'pixel art game ui icon, centered, simple, readable at small size';
const PALETA_ICONES = ['#000000', '#f2c230', '#ffe27a', '#9c7210', '#f1e9d4', '#16271f', '#335446'];
const ICONES = [
  ['aba-estabulo', 'horse head icon'], ['aba-correr', 'checkered racing flag icon'], ['aba-expedicao', 'compass icon'],
  ['aba-haras', 'two hearts icon'], ['aba-loja', 'shopping cart icon'], ['slot-ferraduras', 'horseshoe icon'],
  ['slot-sela', 'horse saddle icon'], ['slot-estribos', 'stirrup icon'], ['slot-testeira', 'horse head armor chamfron icon'],
  ['slot-armadura', 'horse barding armor icon'], ['moeda-ouro', 'gold coin icon'], ['pedra-negra', 'black polished stone gem icon'],
  ['el-fogo', 'flame icon (#ff8a4c)'], ['el-agua', 'water drop icon (#62b8ff)'], ['el-grama', 'green leaf icon (#7be07a)'],
  ['el-neutro', 'grey circle rune icon (#cfc8b4)'],
].map(([id, desc], i) => ({ id, desc, seed: 2101 + i }));

// ---------------------------------------------------------------- corpos das chamadas
const imagem = buf => ({ type: 'base64', base64: buf.toString('base64'), format: 'png' });

function pedidoPose(estilo, pose, seed) {
  return {
    description: `side view, facing right, ${POSES[pose]}, ${estilo.crina}, ${COR}`,
    image_size: { width: LADO, height: LADO },
    view: 'side', direction: 'east',
    outline: 'single color black outline', shading: 'basic shading', detail: 'medium detail',
    no_background: true, seed,
  };
}
function pedidoGalope(montado, seed) {
  return { first_frame: imagem(montado), action: ACAO_GALOPE, frame_count: 8, no_background: true, drift_threshold: 0, seed };
}
function coresIcone(icone) {
  const m = /\(#([0-9a-f]{6})\)/i.exec(icone.desc); // cor do tema, quando a descrição traz uma
  return m ? PALETA_ICONES.concat('#' + m[1].toLowerCase()) : PALETA_ICONES;
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
  const a = { lote: null, only: null, teto: 60, gerar: false, repetir: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--gerar') a.gerar = true;
    else if (k === '--lote') a.lote = argv[++i];
    else if (k === '--only') a.only = argv[++i];
    else if (k === '--teto') a.teto = Number(argv[++i]);
    else if (k === '--repetir') a.repetir = String(argv[++i] || '').split(',').filter(Boolean);
    else sair('argumento desconhecido: ' + k);
  }
  if (!['moldes', 'icones', 'tudo'].includes(a.lote)) {
    sair('uso: node prototype/tools/pixellab-moldes.mjs --lote moldes|icones|tudo [--only <id>] [--teto 60] [--gerar]');
  }
  if (!Number.isFinite(a.teto) || a.teto <= 0) sair('--teto precisa ser um número maior que zero');
  a.estilos = a.lote === 'icones' ? [] : ESTILOS.filter(e => !a.only || e.id === a.only);
  a.icones = a.lote === 'moldes' ? [] : ICONES.filter(ic => !a.only || ic.id === a.only);
  if (a.only && !a.estilos.length && !a.icones.length) sair(`--only ${a.only}: não existe no lote "${a.lote}"`);
  if (a.repetir.length > 2) sair('--repetir: no máximo 2 itens');
  const itens = [...ESTILOS.flatMap(e => ['retrato', 'parado', 'montado', 'galope'].map(k => `${e.id}/${k}`)), ...ICONES.map(ic => `icone/${ic.id}`)];
  for (const r of a.repetir) if (!itens.includes(r)) sair(`--repetir ${r}: item desconhecido (ex.: lisa/parado, icone/aba-loja)`);
  REPETIR_EXTRA = a.repetir;
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
// 1ª seed que o lote real usaria: pula as com erro registrado; "cru" se já houver a imagem em raw/
function seedPlanejada(dir, prefixo, seedBase, pedidoDe, rotulo) {
  for (let k = 0; k <= MAX_REPETICOES + (REPETIR_EXTRA.includes(rotulo) ? 1 : 0); k++) {
    const seed = seedBase + PASSO_SEED * k, corpo = pedidoDe(seed), reg = lerCru(dir, `${prefixo}-s${seed}`, corpo);
    if (reg && reg.erro) continue;
    return { seed, corpo, cru: !!(reg && pngsCrus(dir, `${prefixo}-s${seed}`, false)) };
  }
  return { seed: seedBase, corpo: pedidoDe(seedBase), cru: false };
}
function planoEstilo(e) {
  const poses = ['retrato', 'parado', 'montado'].map(p => {
    const s = seedPlanejada(DIR_MOLDES_RAW, `${e.id}-${p}`, e.seed, seed => pedidoPose(e, p, seed), `${e.id}/${p}`);
    return { item: `${e.id}/${p}`, endpoint: PIXFLUX, seed: s.seed, texto: s.corpo.description, cru: s.cru };
  });
  return [...poses, { item: `${e.id}/galope`, endpoint: ANIMA, seed: e.seed, texto: `${ACAO_GALOPE} [first_frame = ${e.id}/montado; frame_count 8; drift_threshold 0; reaproveitável se o montado for o mesmo]`, cru: false }];
}
function planoIcone(ic) {
  const s = seedPlanejada(DIR_ICONES_RAW, ic.id, ic.seed, seed => pedidoIcone(ic, seed), `icone/${ic.id}`);
  return { item: `icone/${ic.id}`, endpoint: PIXFLUX, seed: s.seed, texto: `${s.corpo.description} [32×32; paleta ${coresIcone(ic).join(' ')}]`, cru: s.cru };
}

function dryRun(a) {
  const plano = [...a.estilos.flatMap(planoEstilo), ...a.icones.map(planoIcone)];
  console.log(`DRY-RUN (sem --gerar): nenhuma chamada à API. Lote "${a.lote}"${a.only ? ` (--only ${a.only})` : ''}; teto ${a.teto} gerações.`);
  console.log('Estimativa: 1 geração por chamada (custo observado); "raw" = imagem crua com o mesmo pedido, reaproveitada sem custo.');
  console.log('Repetições (até 2 por item) não entram na previsão.\n');
  let total = 0, n = 0, crus = 0;
  for (const c of plano) {
    const custo = c.cru ? 0 : 1;
    if (total + custo > a.teto) break;
    total += custo; n++; if (c.cru) crus++;
    console.log(`${String(n).padStart(3)}. POST ${c.endpoint.padEnd(22)} ${c.item.padEnd(24)} seed ${c.seed}  ${c.cru ? 'raw (0)' : '~1 geração'}`);
    console.log(`       ${c.texto}`);
  }
  console.log(`\nTotal previsto: ${total} gerações em ${n - crus} chamadas (+ ${crus} reaproveitadas de raw/; teto ${a.teto}).`);
  if (n < plano.length) {
    console.log(`AVISO: o teto de ${a.teto} gerações cortou ${plano.length - n} de ${plano.length} itens planejados (a partir de ${plano[n].item}).`);
  }
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
function novoItem(rotulo, seedBase) {
  // geracoes: gastas neste lote; anteriores: de imagens cruas reaproveitadas (gastas antes)
  const it = { rotulo, seedBase, seeds: [], geracoes: 0, anteriores: 0, reaproveitadas: [], rejeicoes: [], extra: REPETIR_EXTRA.includes(rotulo) ? 1 : 0 };
  ITENS.push(it);
  return it;
}
// próxima seed do item (base, base + 10, base + 20 [, base + 30 com --repetir]) ou null quando acabaram
function proximaSeed(it) {
  if (it.seeds.length > MAX_REPETICOES + it.extra) return null;
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
// Classifica um grupo de quadros com limiares próprios do grupo, limpa, valida e devolve a 1ª falha.
// (Checagem antes de gastar mais; a validação definitiva usa os limiares do estilo inteiro.)
function preChecar(bufs, comJoquei, onde) {
  const fams = bufs.map((b, i) => classificarFamilias(decodificar64(b, `${onde} quadro ${i}`).rgba, LADO, LADO));
  const tons = limiaresDeTons(fams);
  const ruins = [];
  fams.forEach((f, i) => {
    const v = validar(posProcessar(f, tons, { comJoquei }), { exigeJoquei: comJoquei });
    if (!v.ok) ruins.push((bufs.length > 1 ? `galope-${i}: ` : '') + v.motivo);
  });
  return ruins.length ? { ok: false, motivo: ruins.join('; ') } : { ok: true };
}

// ---------------------------------------------------------------- moldes
async function gerarPose(estilo, pose, it) {
  for (let seed; (seed = proximaSeed(it)) != null;) {
    console.log(`  ${it.rotulo} seed ${seed}`);
    const corpo = pedidoPose(estilo, pose, seed), base = `${estilo.id}-${pose}-s${seed}`;
    const reg = lerCru(DIR_MOLDES_RAW, base, corpo), crus = reg && pngsCrus(DIR_MOLDES_RAW, base, false);
    if (reg && reg.erro) { rejeitar(it, seed, `erro registrado em lote anterior: ${reg.erro}`); continue; }
    let buf;
    if (crus) {
      reaproveitar(it, seed, reg); buf = crus[0];
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
    }
    const v = preChecar([buf], pose !== 'retrato', it.rotulo);
    if (v.ok) return buf;
    rejeitar(it, seed, v.motivo);
  }
  return null;
}

async function gerarGalope(estilo, it, montado) {
  for (let seed; (seed = proximaSeed(it)) != null;) {
    console.log(`  ${it.rotulo} seed ${seed} (job assíncrono; pode levar minutos)`);
    const corpo = pedidoGalope(montado, seed), base = `${estilo.id}-galope-s${seed}`;
    const reg = lerCru(DIR_MOLDES_RAW, base, corpo);
    if (reg && reg.erro) { rejeitar(it, seed, `erro registrado em lote anterior: ${reg.erro}`); continue; }
    let bufs = reg && pngsCrus(DIR_MOLDES_RAW, base, true);
    if (bufs) {
      reaproveitar(it, seed, reg);
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
      gravarCru(DIR_MOLDES_RAW, base, ANIMA, corpo, r, bufs.map((b, i) => [`${base}-${i}.png`, b]));
    }
    if (bufs.length !== 9 && bufs.length !== 8) {
      throw new ErroApi(`${it.rotulo}: veio com ${bufs.length} quadros (esperado 9, ou 8)`, { fatal: true });
    }
    if (bufs.length === 8) console.log(`    AVISO ${it.rotulo}: vieram 8 quadros (não 9); usando 8`);
    const v = preChecar(bufs, true, it.rotulo);
    if (v.ok) return bufs;
    rejeitar(it, seed, v.motivo);
  }
  return null;
}

async function gerarEstilo(estilo) {
  console.log(`\n== Molde ${estilo.id} (seed base ${estilo.seed}) ==`);
  const it = {};
  for (const k of ['retrato', 'parado', 'montado', 'galope']) it[k] = novoItem(`${estilo.id}/${k}`, estilo.seed);
  const falhou = motivo => { console.log(`  FALHOU ${estilo.id}: ${motivo} — nada gravado como final (crus em raw/)`); return { estilo: estilo.id, ok: false, motivo }; };

  const fontes = {};
  for (const pose of ['retrato', 'parado', 'montado']) {
    fontes[pose] = await gerarPose(estilo, pose, it[pose]);
    if (!fontes[pose]) return falhou(`${pose} rejeitado em todas as tentativas`);
  }
  let galope = await gerarGalope(estilo, it.galope, fontes.montado);
  if (!galope) return falhou('galope rejeitado em todas as tentativas');

  // limiares de claro × sombra por geração (retrato, parado, galope); um quadro inválido refaz o item dono
  let nomes, quadros, tons;
  const grupoDe = n => (n.startsWith('galope-') ? 'galope' : n);
  for (;;) {
    nomes = ['retrato', 'parado', ...galope.map((_, i) => 'galope-' + i)];
    const fams = nomes.map(n => classificarFamilias(decodificar64(n.startsWith('galope-') ? galope[Number(n.slice(7))] : fontes[n], n).rgba, LADO, LADO));
    tons = {};
    for (const g of ['retrato', 'parado', 'galope']) tons[g] = limiaresDeTons(fams.filter((_, i) => grupoDe(nomes[i]) === g));
    quadros = fams.map((f, i) => posProcessar(f, tons[grupoDe(nomes[i])], { comJoquei: nomes[i] !== 'retrato' }));
    const invalidos = {};
    quadros.forEach((q, i) => {
      const v = validar(q, { exigeJoquei: nomes[i] !== 'retrato' });
      if (v.ok) return;
      const dono = nomes[i].startsWith('galope-') ? 'galope' : nomes[i];
      (invalidos[dono] = invalidos[dono] || []).push(`${nomes[i]}: ${v.motivo}`);
    });
    if (!Object.keys(invalidos).length) break;
    for (const [dono, motivos] of Object.entries(invalidos)) {
      rejeitar(it[dono], ultimaSeed(it[dono]), 'com os limiares do estilo — ' + motivos.join('; '));
      if (dono === 'galope') {
        galope = await gerarGalope(estilo, it.galope, fontes.montado);
        if (!galope) return falhou('galope rejeitado em todas as tentativas');
      } else {
        fontes[dono] = await gerarPose(estilo, dono, it[dono]);
        if (!fontes[dono]) return falhou(`${dono} rejeitado em todas as tentativas`);
      }
    }
  }

  // grava os finais (remove galopes antigos: um lote de 8 quadros não pode herdar um galope-8 velho)
  for (const f of fs.readdirSync(DIR_MOLDES)) if (f.startsWith(`molde-${estilo.id}-galope-`)) fs.unlinkSync(path.join(DIR_MOLDES, f));
  const anc = {};
  nomes.forEach((n, i) => {
    fs.writeFileSync(path.join(DIR_MOLDES, `molde-${estilo.id}-${n}.png`), encodeGray({ width: LADO, height: LADO, data: paraCinza(quadros[i].idx) }));
    anc[n] = ancoras(quadros[i].idx, LADO, LADO);
  });
  const json = {
    estilo: estilo.id, w: LADO, h: LADO, footY: anc.retrato.footY, frames: galope.length,
    larguraUtil: anc.retrato.bbox.w,
    limiares: tons, // por geração; luminância ≤ limiar ⇒ sombra; procedural ⇒ sombreado por coluna
    seeds: { retrato: ultimaSeed(it.retrato), parado: ultimaSeed(it.parado), montado: ultimaSeed(it.montado), galope: ultimaSeed(it.galope) },
    gerado: HOJE,
  };
  const textoAnc = nomes.map(n => `    "${n}": ${JSON.stringify(anc[n])}`).join(',\n'); // uma linha por quadro
  fs.writeFileSync(path.join(DIR_MOLDES, `molde-${estilo.id}.json`),
    JSON.stringify(json, null, 2).replace(/\n}$/, `,\n  "ancoras": {\n${textoAnc}\n  }\n}\n`));

  const pre = `prototype/assets/pixellab/molde-${estilo.id}`, crina = `crina "${estilo.crina}"`, uso = 'Não (até a Task 3)';
  const proc = 'cores de papel pedidas por texto (pelo #ff0000, crina #00ff00 …; sem paleta forçada); papéis por família de cor + Otsu do estilo';
  registrarAsset(`\`${pre}-retrato.png\``, '`create-image-pixflux`',
    `retrato 64×64: cavalo parado sem jóquei nem sela, ${crina}, ${proc}`, seedTxt(it.retrato), custoTotal(it.retrato), uso);
  registrarAsset(`\`${pre}-parado.png\``, '`create-image-pixflux`',
    `parado 64×64: cavalo parado com jóquei (seda e capacete #ffff00, pele #ffc0cb, sela e manta #808080), ${crina}, ${proc}`,
    seedTxt(it.parado), custoTotal(it.parado), uso);
  registrarAsset(`\`${pre}-galope-0..${galope.length - 1}.png\` e \`${pre}.json\``, '`create-image-pixflux` + `animate-with-text-v3`',
    `montado (meio da passada, com jóquei, ${crina}; ${seedTxt(it.montado)}) animado com "${ACAO_GALOPE}", frame_count 8 (${galope.length} quadros recebidos), drift_threshold 0`,
    `galope ${seedTxt(it.galope)}`, custoTotal(it.montado) + custoTotal(it.galope), uso);

  const t = (g, k) => `${k} ${tons[g][k].procedural ? 'procedural' : tons[g][k].limiar}`;
  console.log(`  OK ${estilo.id}: ${nomes.length} quadros (${galope.length} de galope), larguraUtil ${json.larguraUtil}, footY ${json.footY}; `
    + ['retrato', 'parado', 'galope'].map(g => `${g}: ${t(g, 'pelagem')}, ${t(g, 'crina')}`).join(' | '));
  return { estilo: estilo.id, ok: true, frames: galope.length };
}

// ---------------------------------------------------------------- ícones
async function gerarIcone(ic) {
  console.log(`\n== Ícone ${ic.id} ==`);
  const it = novoItem(`icone/${ic.id}`, ic.seed);
  for (let seed; (seed = proximaSeed(it)) != null;) {
    console.log(`  ${it.rotulo} seed ${seed}`);
    const corpo = pedidoIcone(ic, seed), base = `${ic.id}-s${seed}`;
    const reg = lerCru(DIR_ICONES_RAW, base, corpo), crus = reg && pngsCrus(DIR_ICONES_RAW, base, false);
    if (reg && reg.erro) { rejeitar(it, seed, `erro registrado em lote anterior: ${reg.erro}`); continue; }
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
    fs.writeFileSync(path.join(DIR_ICONES, `${ic.id}.png`), encodePng(d));
    registrarAsset(`\`prototype/assets/icons/${ic.id}.png\``, '`create-image-pixflux`',
      `ícone 32×32 "${ic.desc}, ${SUFIXO_ICONE}", contorno preto, color_image = ${coresIcone(ic).join(' ')}`,
      seedTxt(it), custoTotal(it), 'Não (até a Task 4)');
    console.log(`  OK ${ic.id}: ${opacos} pixels opacos`);
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
  REDE_LIBERADA = true;
  orc.teto = a.teto;
  fs.mkdirSync(DIR_MOLDES, { recursive: true });
  console.log(`GERAÇÃO REAL — lote "${a.lote}"${a.only ? ` (--only ${a.only})` : ''}; teto ${a.teto} gerações.`);
  const antes = await saldo('antes');
  const disponivel = antes.subscription && antes.subscription.generations;
  if (!(disponivel >= a.teto)) {
    throw new ErroApi(`saldo do plano (${disponivel}) menor que o teto (${a.teto}): o resto sairia dos créditos em US$; abortado`, { fatal: true });
  }

  const resultados = [];
  let parada = null;
  try {
    for (const e of a.estilos) resultados.push(await gerarEstilo(e));
    for (const ic of a.icones) resultados.push(await gerarIcone(ic));
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
  const moldes = resultados.filter(r => r.estilo);
  if (moldes.length) console.log('  Quadros de galope: ' + moldes.map(r => `${r.estilo} ${r.ok ? r.frames : 'falhou'}`).join(', '));
  const falhas = resultados.filter(r => !r.ok);
  console.log(`  Itens finais: ${resultados.length - falhas.length} ok, ${falhas.length} com falha${parada ? '; lote interrompido' : ''}`);
  console.log(`  Gerações gastas neste lote (soma do usage): ${fmt(orc.gasto)} de teto ${a.teto}, em ${orc.chamadas} chamadas pagas`);
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
if (!args.gerar) {
  dryRun(args);
} else {
  try {
    process.exitCode = await gerar(args);
  } catch (e) {
    console.error('ERRO: ' + (e instanceof ErroApi ? e.message : e.stack));
    process.exitCode = 1;
  }
}
