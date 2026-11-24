// Arte embutida (data:) compartilhada entre o build do jogo (build.mjs) e o gerador do wiki (tools/wiki.mjs).
//   lerMoldes(root, avisos, dir) -> { estilos }   (a tabela window.__MOLDES; dir = 'assets/pixellab', o único que o
//                           build lê; a folha dos portes, tools/folha-portes.mjs, passa a pasta de espera 'assets/pixellab/novos')
//   lerIcones(root)         -> { nome: dataUrl }  (window.__ICONES: os finais da direção de arte, assets/arte/icones/,
//                              16×16 ou 24×24; etapa 4)
//   lerIconesTam(root)      -> { nome: 16|24 }  (window.__ICONES_TAM: o lado nativo de cada um, lido do PNG)
//   lerMarca(root)          -> { logo, w, h, mini, miniW, miniH } ou { logo: null }  (window.__MARCA; etapa 7)
//   lerTreinadores(root)    -> { id: { corpo, busto } }  (window.__TREINADORES: os finais da etapa 5 da direção de arte)
//   lerArenas(root)         -> { fogo, agua, grama }  (window.__ARENAS: a arena 0 de cada ginásio, o fundo da cena do desafio, 256×160)
//   lerTelas(root)          -> { cenas: { estabulo, haras, loja, expedicao }, mapas: { fogo, agua, grama } }  (window.__TELAS:
//                              as cenas das abas, 256×160, com as 24 linhas de baixo sumindo em pontilhado; os mapas das
//                              trilhas, 256×384, só o terreno; etapa 6)
//   lerRegioes(root)        -> { regiao: { nome, pistas, posicao, camadas: { nuvens, horizonte, meio, arquibancada,
//                              frente } } }  (window.__REGIOES: as camadas da corrida, etapa 2.3; o horizonte já com a
//                              névoa da distância, como na amostra)
//   lerMapaMundo(root)      -> { terreno, ginasios: { fogo, agua, grama } }  (window.__MAPA_MUNDO: a ilha 256×384 e os
//                              ginásios 64×64 do mapa-múndi, spec 2026-11-24-mapa-ginasios §3.1; sem algum, {})
//   jsonJs(v)               -> JSON seguro dentro de <script> (nada de "<" literal)
// root = a pasta prototype/. Arquivo de arte ausente nunca falha: a parte correspondente fica vazia
// (o molde inválido vira um aviso em `avisos`) e quem usa cai no desenho por código / no texto.
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { decodePng, encodePng } from './png.mjs'
import { REGIOES as PALETAS, quantizar, rgbDe } from './arte-paleta.mjs'

export const dataUrl = async (root, rel) => 'data:image/png;base64,' + (await readFile(join(root, rel))).toString('base64')
const listar = async (root, rel) => (existsSync(join(root, rel)) ? (await readdir(join(root, rel))).sort() : [])

// JSON seguro dentro de <script>: nada de "<" literal (fecharia a tag).
export const jsonJs = (v) => JSON.stringify(v).replace(/</g, '\\u003c')

// Moldes: assets/pixellab/molde-<porte>-<estilo>.json + molde-<porte>-<estilo>-retrato.png, -parado.png,
// -galope-0..N-1.png, com porte ∈ esguio|padrao|robusto e estilo ∈ chamas|ondas|folhas|lisa (spec
// 2026-11-13-cavalos-portes §4 e §6): os 12 moldes dos portes, com chave '<porte>-<estilo>'. A tabela guarda as
// chaves que achar, com json.estilo = a chave; o sprites.js só liga os moldes com as 12 (tudo ou nada). A escala dos
// cavalos sai do maior larguraUtil entre os 4 moldes do padrão. Outro molde-*.json é ignorado com aviso, inclusive
// o nome antigo molde-<estilo>.json (o lote de 2026-11-08, que saiu na 2b).
// Do JSON vão só os campos que o jogo lê (o resto — seeds, limiares, contagens — fica no arquivo).
export async function lerMoldes(root, avisos = [], dir = 'assets/pixellab') {
  const estilos = {}
  for (const nome of await listar(root, dir)) {
    if (!/^molde-.*\.json$/.test(nome)) continue
    const mm = nome.match(/^molde-((?:esguio|padrao|robusto)-(?:chamas|ondas|folhas|lisa))\.json$/)
    if (!mm) { avisos.push(`molde "${nome}" ignorado: o nome não é molde-<porte>-<estilo>.json`); continue }
    const chave = mm[1]
    try {
      const J = JSON.parse(await readFile(join(root, dir, nome), 'utf8'))
      const frames = J.frames | 0
      if (!(frames > 0) || !J.ancoras || !(J.larguraUtil > 0)) throw new Error('JSON sem frames, ancoras ou larguraUtil')
      const png = (q) => join(dir, `molde-${chave}-${q}.png`)
      const quadros = ['retrato', 'parado']
      for (let i = 0; i < frames; i++) quadros.push('galope-' + i)
      const faltam = quadros.filter((q) => !existsSync(join(root, png(q))))
      if (faltam.length) throw new Error('faltam ' + faltam.map((q) => `molde-${chave}-${q}.png`).join(', '))
      const galope = []
      for (let i = 0; i < frames; i++) galope.push(await dataUrl(root, png('galope-' + i)))
      estilos[chave] = {
        json: { estilo: chave, w: J.w, h: J.h, footY: J.footY, frames, larguraUtil: J.larguraUtil, ancoras: Object.assign({}, J.ancoras) },
        retrato: await dataUrl(root, png('retrato')),
        parado: await dataUrl(root, png('parado')),
        galope,
        gestos: await lerGestos(root, chave, dir)
      }
    } catch (e) {
      avisos.push(`molde "${chave}" ignorado: ${e.message}`)
    }
  }
  // as vistas de frente e de costas (Meshy, cena de desafio; arte-desafio-moldes.mjs): tudo ou nada nos 12 moldes. Os PNGs
  // assets/arte/desafio/vistas/vista-<chave>-frente/costas.png e as âncoras de vistas-3d.json entram em cada estilo (frente, costas, json.ancoras.frente
  // e .costas); faltando alguma, nenhum molde leva vista (a cena usa o molde de lado) e fica um aviso
  const DV = 'assets/arte/desafio/vistas', vj = join(root, DV, 'vistas-3d.json'), chaves = Object.keys(estilos)
  if (chaves.length && existsSync(vj)) {
    const V = JSON.parse(await readFile(vj, 'utf8')).moldes || {}
    const falta = chaves.filter((ch) => !V[ch] || !V[ch].frente || !V[ch].costas || !['frente', 'costas'].every((q) => existsSync(join(root, DV, `vista-${ch}-${q}.png`))))
    if (falta.length) avisos.push(`vistas de frente e de costas ignoradas: faltam ${falta.join(', ')}`)
    else for (const ch of chaves) {
      estilos[ch].frente = await dataUrl(root, join(DV, `vista-${ch}-frente.png`))
      estilos[ch].costas = await dataUrl(root, join(DV, `vista-${ch}-costas.png`))
      estilos[ch].json.ancoras.frente = V[ch].frente
      estilos[ch].json.ancoras.costas = V[ch].costas
    }
  }
  return { estilos }
}

// Gestos do idle (animação ambiente, etapa 2): os quadros do PixelLab escolhidos para o molde (prototype/assets/pixellab/
// idle/escolhas-todos.json: comer e cavar no retrato; escolhas-joquei.json: cavar com jóquei no parado), em papéis
// (cinza = papel × 25), como os moldes. { comer: [url…], cavar: […], cavarJ: […] }; o que faltar fica de fora.
async function lerGestos(root, chave, dir) {
  const D = join(dir, 'idle'), out = {}
  const esc = async (n) => { try { return JSON.parse(await readFile(join(root, D, n), 'utf8')) } catch (e) { return {} } }
  const todos = await esc('escolhas-todos.json'), joq = await esc('escolhas-joquei.json')
  const pedidos = [['comer', 'retrato', 'comer', todos], ['cavar', 'retrato', 'cavar', todos], ['cavarJ', 'parado', 'cavar', joq]]
  for (const [nome, est, acao, tab] of pedidos) {
    const e = tab[chave] && tab[chave][acao]
    if (!e || !e.seed) continue
    const lista = []
    for (let q = 0; existsSync(join(root, D, `${chave}-${est}-${acao}-s${e.seed}-${q}.png`)); q++) lista.push(await dataUrl(root, join(D, `${chave}-${est}-${acao}-s${e.seed}-${q}.png`)))
    if (lista.length) out[nome] = lista
  }
  return out
}

// os ícones finais (etapa 4 da direção de arte): 16×16 desenhados em código e 24×24 do PixelLab Pro, mostrados 1:1 na
// grade (o tamanho nativo vem de lerIconesTam); a pasta antiga assets/icons/ (32×32) saiu na etapa 8 (fica no histórico do git)
export const DIR_ICONES = 'assets/arte/icones'
export async function lerIcones(root, dir = DIR_ICONES) {
  const out = {}
  for (const nome of await listar(root, dir)) {
    const mm = nome.match(/^([a-z0-9-]+)\.png$/)
    if (mm) out[mm[1]] = await dataUrl(root, join(dir, nome))
  }
  return out
}
export async function lerIconesTam(root, dir = DIR_ICONES) {
  const out = {}
  for (const nome of await listar(root, dir)) {
    const mm = nome.match(/^([a-z0-9-]+)\.png$/)
    if (!mm) continue
    const buf = await readFile(join(root, dir, nome))
    if (buf.length > 24 && buf.toString('latin1', 12, 16) === 'IHDR') out[mm[1]] = buf.readUInt32BE(16)
  }
  return out
}

// Oponentes dos ginásios (etapa 5 da direção de arte): assets/arte/treinadores/finais/<id>-corpo.png (32×48, corpo de
// ~40 px, a escala dos cavalos) e <id>-busto.png (64×64, para os cartões), escolhidos e copiados por
// tools/arte-treinadores.mjs finais. Um id só entra com as duas imagens.
export async function lerTreinadores(root) {
  const dir = 'assets/arte/treinadores/finais', out = {}
  const ids = new Set((await listar(root, dir)).map((n) => (n.match(/^([a-z0-9-]+)-(corpo|busto)\.png$/) || [])[1]).filter(Boolean))
  for (const id of [...ids].sort()) {
    const corpo = join(dir, id + '-corpo.png'), busto = join(dir, id + '-busto.png')
    if (existsSync(join(root, corpo)) && existsSync(join(root, busto))) out[id] = { corpo: await dataUrl(root, corpo), busto: await dataUrl(root, busto) }
  }
  return out
}
// As arenas dos ginásios (etapa 5): assets/arte/ginasios/finais/<fogo|agua|grama>.png, 256×160 ao ar livre
export async function lerArenas(root) {
  const out = {}
  for (const id of ['fogo', 'agua', 'grama']) {
    const png = join('assets/arte/ginasios', id, 'arena-0.png')   // a arena 0 (spec 2026-11-24-mapa-ginasios §3.4)
    if (existsSync(join(root, png))) out[id] = await dataUrl(root, png)
  }
  return out
}

// Logotipo: data: URL e o tamanho em px (lido do cabeçalho IHDR do PNG), para o <img> reservar o espaço.
// A marca (etapa 7 da direção de arte): assets/arte/marca/logo.png (o emblema e o letreiro em duas linhas, desenhados na
// grade) para a tela inicial e letreiro-mini.png (só o letreiro, letras de 8 px, 67×22) para o cabeçalho; o tamanho de cada um
// vem do PNG. O logo antigo do Canva (assets/marca/) saiu na etapa 8.
const tamPng = (buf) => (buf.length > 24 && buf.toString('latin1', 12, 16) === 'IHDR' ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : [0, 0])
// O mapa-múndi (spec 2026-11-24-mapa-ginasios §3.1): a ilha B pintada e os três ginásios escolhidos pelo Vinicius. Tudo
// ou nada: faltando um arquivo, {} (a aba Expedição fica só com os cartões).
export const MAPA_MUNDO = { terreno: 'assets/arte/mapa-mundo/terreno/terreno-s9901.png',
  ginasios: { fogo: 'assets/arte/mapa-mundo/ginasios/ginasio-fogo-s9921.png', agua: 'assets/arte/mapa-mundo/ginasios/ginasio-agua-s9932.png',
    grama: 'assets/arte/mapa-mundo/ginasios/ginasio-grama-s9953-00.png' } }
export async function lerMapaMundo(root) {
  const todos = [MAPA_MUNDO.terreno, ...Object.values(MAPA_MUNDO.ginasios)]
  if (!todos.every((f) => existsSync(join(root, f)))) return {}
  const ginasios = {}
  for (const [el, f] of Object.entries(MAPA_MUNDO.ginasios)) ginasios[el] = await dataUrl(root, f)
  return { terreno: await dataUrl(root, MAPA_MUNDO.terreno), ginasios }
}

export async function lerMarca(root) {
  const logo = 'assets/arte/marca/logo.png', mini = 'assets/arte/marca/letreiro-mini.png'
  if (!existsSync(join(root, logo))) return { logo: null }
  const b = await readFile(join(root, logo)), [w, h] = tamPng(b), out = { logo: 'data:image/png;base64,' + b.toString('base64'), w, h }
  if (existsSync(join(root, mini))) {
    const m = await readFile(join(root, mini)), [mw, mh] = tamPng(m)
    Object.assign(out, { mini: 'data:image/png;base64,' + m.toString('base64'), miniW: mw, miniH: mh })
  }
  return out
}

// Camadas das regiões: assets/arte/<regiao>/<camada>.png (as finais de arte-regioes.mjs --finalizar, escolhidas em
// assets/arte/regioes.json). O horizonte vai com a névoa da distância assada (cada cor misturada 45% com 9babb2 e de
// volta para a paleta da região: a mesma conta da amostra, prototype/arte/amostra.js, lutNevoaDe). Região sem alguma
// das 5 camadas fica de fora (a pista cai no cenário por código).
export const CAMADAS_REGIAO = ['nuvens', 'horizonte', 'meio', 'arquibancada', 'frente']
export function comNevoa(img, paleta, cor = '9babb2', k = 0.45) {
  const n = rgbDe(cor), out = new Uint8Array(img.rgba)
  for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) out[i + c] = Math.round(out[i + c] + (n[c] - out[i + c]) * k)
  return quantizar({ width: img.width, height: img.height, rgba: out }, paleta)
}
// cor crua -> cor com a névoa (hex sem '#'), pixel a pixel das duas versões do horizonte
function mapaNevoa(cru, com) {
  const m = {}, h = (a, i) => [a[i], a[i + 1], a[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')
  for (let i = 0; i < cru.rgba.length; i += 4) if (cru.rgba[i + 3] >= 128) m[h(cru.rgba, i)] = h(com.rgba, i)
  return m
}
export async function lerRegioes(root) {
  const man = join(root, 'assets/arte/regioes.json')
  if (!existsSync(man)) return {}
  const manifesto = JSON.parse(await readFile(man, 'utf8')), out = {}
  for (const [r, reg] of Object.entries(manifesto)) {
    if (r.startsWith('_')) continue
    const arqs = CAMADAS_REGIAO.map((k) => join(root, 'assets/arte', r, k + '.png'))
    if (!arqs.every((a) => existsSync(a))) continue
    const camadas = {}
    let nevoa = null
    for (const [i, k] of CAMADAS_REGIAO.entries()) {
      let buf = await readFile(arqs[i])
      if (k === 'horizonte' && PALETAS[r]) {
        const cru = decodePng(buf), com = comNevoa(cru, PALETAS[r])
        nevoa = mapaNevoa(cru, com)
        buf = encodePng(com)
      }
      camadas[k] = 'data:image/png;base64,' + buf.toString('base64')
    }
    // a animação ambiente (prototype/src/ambiente.js, etapa 5): o meio do Planalto sem as pás pintadas (o rotor é por
    // código) e o mapa cor crua -> cor com a névoa do horizonte (as rampas do manifesto são as cores cruas)
    const semPas = join(root, 'assets/arte', r, 'meio-sem-pas.png')
    if (existsSync(semPas)) camadas.meioSemPas = await dataUrl(root, join('assets/arte', r, 'meio-sem-pas.png'))
    out[r] = { nome: reg.nome, pistas: reg.pistas || [], posicao: reg.posicao || {}, camadas }
    if (nevoa) out[r].nevoa = nevoa
  }
  return out
}

// Cenas das abas e mapas das trilhas (etapa 6 da direção de arte): assets/arte/telas/finais/cena-<aba>.png (256×160) e
// mapa-<ginásio>.png (256×384). Nas cenas, as últimas 24 linhas somem em pontilhado ordenado (Bayer 4×4, alfa binário),
// deixando ver o fundo da interface embaixo da placa do título — o mesmo da prévia aprovada (arte-telas-previa.mjs).
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
export function cenaComPontilhado(img, linhas = 24) {
  const out = new Uint8Array(img.rgba), W = img.width, H = img.height
  for (let y = H - linhas; y < H; y++) for (let x = 0; x < W; x++) {
    if (BAYER4[y % 4][x % 4] < (y - (H - linhas)) / linhas * 16) out[(y * W + x) * 4 + 3] = 0
  }
  return { width: W, height: H, rgba: out }
}
export async function lerTelas(root) {
  const dir = 'assets/arte/telas/finais', out = { cenas: {}, mapas: {} }
  for (const aba of ['estabulo', 'haras', 'loja', 'expedicao']) {
    const arq = join(root, dir, `cena-${aba}.png`)
    if (existsSync(arq)) out.cenas[aba] = 'data:image/png;base64,' + encodePng(cenaComPontilhado(decodePng(await readFile(arq)))).toString('base64')
  }
  for (const g of ['fogo', 'agua', 'grama']) {
    const png = join(dir, `mapa-${g}.png`)
    if (existsSync(join(root, png))) out.mapas[g] = await dataUrl(root, png)
  }
  return out
}
