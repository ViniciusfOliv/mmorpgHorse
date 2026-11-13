// Arte embutida (data:) compartilhada entre o build do jogo (build.mjs) e o gerador do wiki (tools/wiki.mjs).
//   lerMoldes(root, avisos) -> { estilos }   (a tabela window.__MOLDES)
//   lerIcones(root)         -> { nome: dataUrl }  (window.__ICONES; a pasta raw/ fica de fora)
//   lerMarca(root)          -> { logo, w, h } ou { logo: null }  (window.__MARCA)
//   jsonJs(v)               -> JSON seguro dentro de <script> (nada de "<" literal)
// root = a pasta prototype/. Arquivo de arte ausente nunca falha: a parte correspondente fica vazia
// (o molde inválido vira um aviso em `avisos`) e quem usa cai no desenho por código / no texto.
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const dataUrl = async (root, rel) => 'data:image/png;base64,' + (await readFile(join(root, rel))).toString('base64')
const listar = async (root, rel) => (existsSync(join(root, rel)) ? (await readdir(join(root, rel))).sort() : [])

// JSON seguro dentro de <script>: nada de "<" literal (fecharia a tag).
export const jsonJs = (v) => JSON.stringify(v).replace(/</g, '\\u003c')

// Moldes: assets/pixellab/molde-<chave>.json + molde-<chave>-retrato.png, -parado.png, -galope-0..N-1.png, com
// estilo ∈ chamas|ondas|folhas|lisa e dois formatos de chave (spec 2026-11-13-cavalos-portes §4 e §6):
//   • '<porte>-<estilo>' (porte ∈ esguio|padrao|robusto): o conjunto dos portes, 12 moldes;
//   • '<estilo>': o conjunto antigo ('legado'), 4 moldes.
// A tabela guarda as chaves que achar, das duas formas, com json.estilo = a chave; quem escolhe o conjunto é o
// sprites.js (os 12 dos portes, senão os 4 antigos; nunca mistura). A escala dos cavalos sai do maior larguraUtil
// entre os 4 moldes do padrão (no 'legado', entre os 4 estilos). Outro molde-*.json é ignorado com aviso.
// Do JSON vão só os campos que o jogo lê (o resto — seeds, limiares, contagens — fica no arquivo).
export async function lerMoldes(root, avisos = []) {
  const estilos = {}
  const dir = 'assets/pixellab'
  for (const nome of await listar(root, dir)) {
    if (!/^molde-.*\.json$/.test(nome)) continue
    const mm = nome.match(/^molde-((?:(?:esguio|padrao|robusto)-)?(?:chamas|ondas|folhas|lisa))\.json$/)
    if (!mm) { avisos.push(`molde "${nome}" ignorado: o nome não é molde-<estilo>.json nem molde-<porte>-<estilo>.json`); continue }
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
export async function lerIcones(root) {
  const out = {}
  for (const nome of await listar(root, 'assets/icons')) {
    const mm = nome.match(/^([a-z0-9-]+)\.png$/)
    if (mm) out[mm[1]] = await dataUrl(root, join('assets/icons', nome))
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
