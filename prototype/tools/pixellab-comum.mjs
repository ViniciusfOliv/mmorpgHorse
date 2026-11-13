// prototype/tools/pixellab-comum.mjs — o que os lotes do pixellab-moldes.mjs dividem: os textos de papel dos moldes,
// os corpos das chamadas, os registros crus em raw/ (gravar e reaproveitar), a chamada à API v2 com o teto de
// gerações, a pré-checagem dos quadros e a gravação dos finais de um molde. Saiu do pixellab-moldes.mjs sem mudar
// de comportamento (os dry-runs dos lotes de 2026-11-08/09 imprimem o mesmo); o lote `portes` (pixellab-portes.mjs)
// usa as mesmas peças.
//
// Rede: só chamar() fala com a API, e só depois que o pixellab-moldes.mjs liga estado.redeLiberada (com --gerar).
// O dry-run e o --reprocessar nunca ligam; com estado.reprocessar, pago() lança FaltaCru em vez de chamar.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodeGray } from './png.mjs';
import { validar, ancoras, paraCinza, classificarFamilias, corrigirGrupo, limiaresDeTons, posProcessar } from './moldes-lib.mjs';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIR_MOLDES = path.join(RAIZ, 'prototype', 'assets', 'pixellab');
export const DIR_MOLDES_RAW = path.join(DIR_MOLDES, 'raw');
export const API = 'https://api.pixellab.ai/v2';
export const HOJE = new Date().toISOString().slice(0, 10);
export const PIXFLUX = '/create-image-pixflux', ANIMA = '/animate-with-text-v3';
export const LADO = 64;          // moldes 64×64

// ---------------------------------------------------------------- textos dos moldes (plano de 2026-11-08, Task 2)
// As cores de papel vão por TEXTO e a classificação do script (moldes-lib) as transforma em papéis.
export const COR = 'pure red (#ff0000) coat with dark red (#800000) shading, bright green (#00ff00) mane and tail with dark green (#008000) shading, blue (#0000ff) hooves and muzzle, black outline, flat colors, no gradients, no anti-aliasing';
export const JOQUEI_CORES = 'jockey in yellow (#ffff00) silks and yellow helmet with pink (#ffc0cb) skin, grey (#808080) saddle and saddle pad and reins';
export const JOQUEI = 'with a small jockey riding, ' + JOQUEI_CORES;
// corrida: o texto da spec 2026-11-09 §4 + as cores de papel do jóquei (o validar exige seda 7 e pele 8)
export const POSES = {
  retrato: 'standing still horse, no rider, no saddle',
  parado: 'horse standing still ' + JOQUEI,
  montado: 'racing horse in mid-gallop stride ' + JOQUEI,
  corrida: 'racing horse at full gallop, body stretched low, front legs reaching far forward and hind legs pushing far back, jockey crouched low, ' + JOQUEI_CORES,
};
// crina e cauda de cada estilo (papel 4/5; o detalhe de cada uma é o papel 6)
export const CRINAS = {
  chamas: 'mane and tail shaped like flickering flames',
  ondas: 'mane and tail shaped like flowing water waves',
  folhas: 'mane and tail made of leaves',
  lisa: 'long straight flowing mane and tail',
};
export const ACAO_GALOPE = 'galloping at full racing speed in a seamless loop, legs extending and gathering, mane and tail flowing back';
export const ACAO_CORRIDA = 'full speed racing gallop, long extended stride, moment of suspension with all four hooves off the ground, seamless loop, mane and tail streaming back';

// ---------------------------------------------------------------- corpos das chamadas
export const imagem = buf => ({ type: 'base64', base64: buf.toString('base64'), format: 'png' });
export function pedidoGalope(montado, seed, acao) {
  return { first_frame: imagem(montado), action: acao, frame_count: 8, no_background: true, drift_threshold: 0, seed };
}

// ---------------------------------------------------------------- arquivos crus (gravar e reaproveitar)
export const fmt = n => String(Math.round(n * 1000) / 1000).replace('.', ',');
const limparB64 = s => s.replace(/^data:[^,]*,/, '');

export function bufDe(img, onde) {
  if (!img || typeof img.base64 !== 'string') throw new ErroApi(`${onde}: resposta sem imagem`, { fatal: true });
  return Buffer.from(limparB64(img.base64), 'base64');
}
// Troca cada base64 por um marcador curto com tamanho e hash (as imagens ficam como PNG ao lado; o hash
// permite reconhecer o mesmo pedido, inclusive o first_frame do galope).
export function semBase64(obj) {
  return JSON.parse(JSON.stringify(obj ?? null, (k, v) => {
    if (k !== 'base64' || typeof v !== 'string') return v;
    const b = Buffer.from(limparB64(v), 'base64');
    return `<base64 omitido: ${b.length} bytes, sha256 ${crypto.createHash('sha256').update(b).digest('hex').slice(0, 16)}>`;
  }));
}
export const canonico = v => (Array.isArray(v) ? '[' + v.map(canonico).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonico(v[k])).join(',') + '}'
    : JSON.stringify(v));

export function gravarCru(dir, base, endpoint, pedido, resposta, pngs) {
  fs.mkdirSync(dir, { recursive: true });
  const reg = { endpoint, data: new Date().toISOString(), pedido: semBase64(pedido), resposta: semBase64(resposta) };
  fs.writeFileSync(path.join(dir, base + '.json'), JSON.stringify(reg, null, 2) + '\n');
  for (const [nome, buf] of pngs) fs.writeFileSync(path.join(dir, nome), buf);
}
// Registro cru com o mesmo pedido (e as imagens dele), ou null.
export function lerCru(dir, base, pedido) {
  const arq = path.join(dir, base + '.json');
  if (!fs.existsSync(arq)) return null;
  let reg;
  try { reg = JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return null; }
  return canonico(reg.pedido) === canonico(semBase64(pedido)) ? reg : null;
}
export function gravarErro(dir, base, endpoint, pedido, e) {
  fs.mkdirSync(dir, { recursive: true });
  const reg = { endpoint, data: new Date().toISOString(), pedido: semBase64(pedido), erro: e.message };
  fs.writeFileSync(path.join(dir, base + '.json'), JSON.stringify(reg, null, 2) + '\n');
}
export function pngsCrus(dir, base, varios) {
  if (!varios) { const f = path.join(dir, base + '.png'); return fs.existsSync(f) ? [fs.readFileSync(f)] : null; }
  const bufs = [];
  for (let i = 0; fs.existsSync(path.join(dir, `${base}-${i}.png`)); i++) bufs.push(fs.readFileSync(path.join(dir, `${base}-${i}.png`)));
  return bufs.length ? bufs : null;
}
// pedido de galope refeito com o mesmo nome: apaga os quadros antigos para não misturar 8 com 9
export function apagarQuadrosCrus(dir, base) {
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (new RegExp(`^${base}-\\d+\\.png$`).test(f)) fs.unlinkSync(path.join(dir, f));
  }
}

// ---------------------------------------------------------------- API, teto e erros
export class TetoAtingido extends Error {}
export class ErroApi extends Error {
  // talvezCobrado: a chamada pode ter consumido cota (conta no teto); fatal: não adianta repetir.
  constructor(msg, { talvezCobrado = false, fatal = false, geracoes = null } = {}) {
    super(msg); this.talvezCobrado = talvezCobrado; this.fatal = fatal; this.geracoes = geracoes;
  }
}
// --reprocessar sem a imagem crua em raw/: faltaria gerar (fatal, como antes; o lote portes pega por item)
export class FaltaCru extends ErroApi {
  constructor(rotulo) { super(`--reprocessar: faltaria gerar ${rotulo} (sem imagem crua em raw/)`, { fatal: true }); }
}
export const recuperavel = e => e instanceof ErroApi && !e.fatal;
const dormir = ms => new Promise(r => setTimeout(r, ms));
const TOKEN = process.env.PIXELLAB_API_KEY || 'proxy-injected';
// redeLiberada: só --gerar liga (o dry-run e o --reprocessar nunca); reprocessar: --reprocessar (só raw/)
export const estado = { redeLiberada: false, reprocessar: false };

export async function chamar(metodo, caminho, corpo) {
  if (!estado.redeLiberada) throw new Error('chamada de rede sem --gerar (bug do script)');
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

export async function esperarJob(id) {
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

// A chamada de verdade de cada endpoint: { resultado, respostas } (respostas = as que trazem o usage).
// Pixflux: resultado = a resposta (com .image). Animate: resultado = { post, job } (quadros em job.last_response.images).
export async function executarReal(ep, corpo) {
  if (ep === PIXFLUX) { const r = await chamar('POST', PIXFLUX, corpo); return { resultado: r, respostas: [r] }; }
  const post = await chamar('POST', ANIMA, corpo);
  const job = post.background_job_id ? await esperarJob(post.background_job_id) : post;
  return { resultado: { post, job }, respostas: [post, job] };
}
export const quadrosDoJob = job => (job.last_response && job.last_response.images) || job.images || [];

// Gerações cobradas segundo as respostas (null se nenhuma informar). O POST do animate e o job
// reportam a MESMA cobrança, por isso vale o maior valor, não a soma.
export function geracoesDe(...resps) {
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

// Orçamento de um lote. gasto começa no que já foi gasto (o lote portes soma entre rodadas, em novos/gasto.json);
// aoRegistrar(ep, g) é chamado depois de cada chamada paga (para gravar o gasto na hora).
export function criarOrcamento(teto, { gasto = 0, aoRegistrar = null, log = console.log } = {}) {
  return {
    teto, gasto, chamadas: 0, maximo: {}, log,
    // estimativa da próxima chamada: o maior custo já visto no endpoint, no mínimo 1
    estimativa(ep) { return Math.max(1, this.maximo[ep] || 0); },
    reservar(ep, rotulo) {
      const e = this.estimativa(ep);
      if (this.gasto + e > this.teto + 1e-9) {
        throw new TetoAtingido(`parou antes de ${rotulo} (${ep}, ~${e}): gasto ${fmt(this.gasto)} + ${e} passaria do teto de ${this.teto}`);
      }
    },
    registrar(ep, g) {
      this.gasto += g; this.chamadas++; this.maximo[ep] = Math.max(this.maximo[ep] || 0, g);
      if (aoRegistrar) aoRegistrar(ep, g);
    },
  };
}

// Executa uma chamada paga: confere o teto antes e soma o custo real depois (ou a estimativa, se a
// resposta não informar ou se a chamada falhar depois de possivelmente cobrar).
export async function pago(orc, ep, item, executar) {
  if (estado.reprocessar) throw new FaltaCru(item.rotulo);
  orc.reservar(ep, item.rotulo);
  const est = orc.estimativa(ep);
  let r;
  try {
    r = await executar();
  } catch (e) {
    if (!(e instanceof ErroApi) || e.talvezCobrado) {
      const g = e.geracoes ?? est;
      orc.registrar(ep, g); item.geracoes += g;
      orc.log(`    ${item.rotulo}: chamada com erro, conta ${fmt(g)} geração(ões) [total ${fmt(orc.gasto)}/${orc.teto}]`);
    }
    throw e;
  }
  const real = geracoesDe(...r.respostas);
  const g = real ?? est;
  orc.registrar(ep, g); item.geracoes += g;
  orc.log(`    ${item.rotulo}: ${fmt(g)} geração(ões)${real == null ? ' (resposta sem usage; contada a estimativa)' : ''} [total ${fmt(orc.gasto)}/${orc.teto}]`);
  const usd = usdDe(...r.respostas);
  if (usd > 0) throw new ErroApi(`cobrança inesperada em US$ ${usd} (esperado só cota do plano)`, { fatal: true });
  return r.resultado;
}

export async function saldo(quando) {
  const b = await chamar('GET', '/balance');
  const s = b.subscription || {};
  console.log(`Saldo ${quando}: ${s.generations}/${s.total} gerações do plano (${s.plan || 'plano ?'}, ${s.status}); créditos US$ ${b.credits && b.credits.usd}`);
  return b;
}

// ---------------------------------------------------------------- quadros e finais
export function decodificar64(buf, onde) {
  const d = decodePng(buf);
  if (d.width !== LADO || d.height !== LADO) {
    throw new ErroApi(`${onde}: imagem ${d.width}×${d.height}, esperado ${LADO}×${LADO}`, { fatal: true });
  }
  return d;
}
// Classifica um grupo de quadros com as correções de grupo (corrigirGrupo) e os limiares do próprio grupo (como nos
// finais: retrato, parado e o galope inteiro), limpa e valida. Devolve os quadros e as falhas (o lote portes guarda a melhor tentativa
// mesmo reprovada); preChecar() é a forma antiga, com a 1ª falha.
export function classificarGrupo(bufs, comJoquei, onde, contorno) {
  const { fams } = corrigirGrupo(bufs.map((b, i) => classificarFamilias(decodificar64(b, `${onde} quadro ${i}`).rgba, LADO, LADO)), { comJoquei });
  const tons = limiaresDeTons(fams);
  const ruins = [], quadros = fams.map(f => posProcessar(f, tons, { comJoquei, contorno }));
  quadros.forEach((q, i) => {
    const v = validar(q, { exigeJoquei: comJoquei });
    if (!v.ok) ruins.push((bufs.length > 1 ? `galope-${i}: ` : '') + v.motivo);
  });
  return { quadros, tons, ruins };
}
export function preChecar(bufs, comJoquei, onde, contorno) {
  const { quadros, ruins } = classificarGrupo(bufs, comJoquei, onde, contorno);
  return ruins.length ? { ok: false, motivo: ruins.join('; ') } : { ok: true, quadros };
}

// Grava um arquivo final e diz se o conteúdo mudou (um final refeito igual de raw/ não troca o registro).
export function gravarFinal(arq, buf) {
  const igual = fs.existsSync(arq) && fs.readFileSync(arq).equals(buf);
  if (!igual) fs.writeFileSync(arq, buf);
  return !igual;
}

// Finais de um molde: limiares por geração (retrato, parado, galope) e contorno só no galope — o mesmo que a
// pré-checagem de cada item já validou, então um quadro inválido aqui seria erro do script (vai em `invalidos`).
export function quadrosDoMolde(retrato, parado, galope) {
  const nomes = ['retrato', 'parado', ...galope.map((_, i) => 'galope-' + i)];
  const grupoDe = n => (n.startsWith('galope-') ? 'galope' : n);
  const fonte = n => (n.startsWith('galope-') ? galope[Number(n.slice(7))] : n === 'retrato' ? retrato : parado);
  const fams = nomes.map(n => classificarFamilias(decodificar64(fonte(n), n).rgba, LADO, LADO));
  // as correções de grupo (corrigirGrupo) e os limiares, uma vez por geração, como na pré-checagem
  for (const g of ['retrato', 'parado', 'galope']) {
    const is = nomes.map((n, i) => (grupoDe(n) === g ? i : -1)).filter(i => i >= 0);
    corrigirGrupo(is.map(i => fams[i]), { comJoquei: g !== 'retrato' }).fams.forEach((f, k) => { fams[is[k]] = f; });
  }
  const tons = {};
  for (const g of ['retrato', 'parado', 'galope']) tons[g] = limiaresDeTons(fams.filter((_, i) => grupoDe(nomes[i]) === g));
  const quadros = fams.map((f, i) => posProcessar(f, tons[grupoDe(nomes[i])], { comJoquei: nomes[i] !== 'retrato', contorno: grupoDe(nomes[i]) === 'galope' }));
  const invalidos = quadros.map((q, i) => [nomes[i], validar(q, { exigeJoquei: nomes[i] !== 'retrato' })]).filter(([, v]) => !v.ok);
  return { nomes, quadros, tons, invalidos };
}

// Grava os PNGs (cinza = papel × 25) e o JSON de um molde em `dir`, com os nomes molde-<chave>-<estado>.png e
// molde-<chave>.json — o formato que o build lê (arte-embutida.mjs). Remove os galopes antigos (um lote de 8
// quadros não pode herdar um galope-8 velho) e diz o que mudou de fato: { mudou, galopeMudou, jsonMudou, json, anc }.
// extra: campos opcionais entre `seeds` e `gerado` (ex.: corrida, no lote de 2026-11-09).
export function gravarMolde(dir, chave, { nomes, quadros, tons }, { seeds, extra = {}, gerado }) {
  fs.mkdirSync(dir, { recursive: true });
  const antigos = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(`molde-${chave}-galope-`)) continue;
    antigos[f] = fs.readFileSync(path.join(dir, f)); fs.unlinkSync(path.join(dir, f));
  }
  const frames = nomes.filter(n => n.startsWith('galope-')).length;
  const anc = {}, mudou = {};
  nomes.forEach((n, i) => {
    const f = `molde-${chave}-${n}.png`, buf = encodeGray({ width: LADO, height: LADO, data: paraCinza(quadros[i].idx) });
    mudou[n] = n.startsWith('galope-') ? !(antigos[f] && antigos[f].equals(buf)) : gravarFinal(path.join(dir, f), buf);
    if (n.startsWith('galope-')) fs.writeFileSync(path.join(dir, f), buf);
    anc[n] = ancoras(quadros[i].idx, LADO, LADO);
  });
  const json = {
    estilo: chave, w: LADO, h: LADO, footY: anc.retrato.footY, frames,
    larguraUtil: anc.retrato.bbox.w,
    limiares: tons, // por geração; luminância ≤ limiar ⇒ sombra; procedural ⇒ sombreado por coluna
    seeds,
    ...extra,
    gerado,
  };
  // uma linha por quadro: âncoras e contagens (aproximados, remapeados pela limpeza, contorno acrescentado)
  const linhas = obj => nomes.map(n => `    "${n}": ${JSON.stringify(obj[n])}`).join(',\n');
  const cont = {};
  nomes.forEach((n, i) => { cont[n] = { aproximados: quadros[i].aproximados, remapeados: quadros[i].remapeados, contornados: quadros[i].contornados }; });
  const jsonMudou = gravarFinal(path.join(dir, `molde-${chave}.json`), Buffer.from(
    JSON.stringify(json, null, 2).replace(/\n}$/, `,\n  "contagens": {\n${linhas(cont)}\n  },\n  "ancoras": {\n${linhas(anc)}\n  }\n}\n`)));
  const galopeMudou = jsonMudou || nomes.some(n => n.startsWith('galope-') && mudou[n]) || Object.keys(antigos).length !== frames;
  return { mudou, galopeMudou, jsonMudou, json, anc };
}
