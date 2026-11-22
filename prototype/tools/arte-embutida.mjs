// Arte embutida (data:) compartilhada entre o build do jogo (build.mjs) e o gerador do wiki (tools/wiki.mjs).
//   lerMoldes(root, avisos, dir) -> { estilos }   (a tabela window.__MOLDES; dir = 'assets/pixellab', o único que o
//                           build lê; a folha dos portes, tools/folha-portes.mjs, passa a pasta de espera 'assets/pixellab/novos')
//   lerIcones(root)         -> { nome: dataUrl }  (window.__ICONES: os finais da direção de arte, assets/arte/icones/,
//                              16×16 ou 24×24; etapa 4)
//   lerIconesTam(root)      -> { nome: 16|24 }  (window.__ICONES_TAM: o lado nativo de cada um, lido do PNG)
//   lerMarca(root)          -> { logo, w, h } ou { logo: null }  (window.__MARCA)
//   lerTreinadores(root)    -> { id: dataUrl }  (window.__TREINADORES: a candidata escolhida de cada oponente dos ginásios)
//   lerRegioes(root)        -> { regiao: { nome, pistas, posicao, camadas: { nuvens, horizonte, meio, arquibancada,
//                              frente } } }  (window.__REGIOES: as camadas da corrida, etapa 2.3; o horizonte já com a
//                              névoa da distância, como na amostra)
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
        json: { estilo: chave, w: J.w, h: J.h, footY: J.footY, frames, larguraUtil: J.larguraUtil, ancoras: J.ancoras },
        retrato: await dataUrl(root, png('retrato')),
        parado: await dataUrl(root, png('parado')),
        galope
      }
    } catch (e) {
      avisos.push(`molde "${chave}" ignorado: ${e.message}`)
    }
  }
  return { estilos }
}

// Ícones: assets/icons/<nome>.png (a pasta raw/ fica de fora).
// os ícones finais (etapa 4 da direção de arte): 16×16 desenhados em código e 24×24 do PixelLab Pro, mostrados 1:1 na
// grade (o tamanho nativo vem de lerIconesTam); a pasta antiga assets/icons/ (32×32) sai na limpeza da etapa 8
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

// Oponentes dos ginásios (a tela de desafio): assets/pixellab/treinadores/escolhas.json = { id: seed } diz qual
// candidata de cada um vai para o jogo (<id>-s<seed>.png, da pixellab-treinadores.mjs). O id é o nome do oponente sem
// acento, em minúsculas e com hífen. Sem o JSON ou sem o PNG, o oponente fica de fora (a tela mostra só o cavalo dele).
export async function lerTreinadores(root) {
  const dir = 'assets/pixellab/treinadores', arq = join(root, dir, 'escolhas.json'), out = {}
  if (!existsSync(arq)) return out
  const escolhas = JSON.parse(await readFile(arq, 'utf8'))
  for (const id of Object.keys(escolhas).sort()) {
    const png = join(dir, `${id}-s${escolhas[id]}.png`)
    if (/^[a-z0-9-]+$/.test(id) && Number.isInteger(escolhas[id]) && existsSync(join(root, png))) out[id] = await dataUrl(root, png)
  }
  return out
}

// Logotipo: data: URL e o tamanho em px (lido do cabeçalho IHDR do PNG), para o <img> reservar o espaço.
export async function lerMarca(root) {
  const logo = 'assets/marca/logo.png'
  if (!existsSync(join(root, logo))) return { logo: null }
  const buf = await readFile(join(root, logo))
  const png = buf.length > 24 && buf.toString('latin1', 12, 16) === 'IHDR'
  return { logo: 'data:image/png;base64,' + buf.toString('base64'), w: png ? buf.readUInt32BE(16) : 0, h: png ? buf.readUInt32BE(20) : 0 }
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
export async function lerRegioes(root) {
  const man = join(root, 'assets/arte/regioes.json')
  if (!existsSync(man)) return {}
  const manifesto = JSON.parse(await readFile(man, 'utf8')), out = {}
  for (const [r, reg] of Object.entries(manifesto)) {
    if (r.startsWith('_')) continue
    const arqs = CAMADAS_REGIAO.map((k) => join(root, 'assets/arte', r, k + '.png'))
    if (!arqs.every((a) => existsSync(a))) continue
    const camadas = {}
    for (const [i, k] of CAMADAS_REGIAO.entries()) {
      let buf = await readFile(arqs[i])
      if (k === 'horizonte' && PALETAS[r]) buf = encodePng(comNevoa(decodePng(buf), PALETAS[r]))
      camadas[k] = 'data:image/png;base64,' + buf.toString('base64')
    }
    out[r] = { nome: reg.nome, pistas: reg.pistas || [], posicao: reg.posicao || {}, camadas }
  }
  return out
}
