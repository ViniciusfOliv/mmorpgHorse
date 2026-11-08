// Gera o artefato de página única do protótipo (sem dependências).
//   node build.mjs
// Saída:
//   dist/jogo.html    -> conteúdo do artefato (sem doctype/html/head/body: o host embrulha)
//   dist/preview.html -> o mesmo conteúdo embrulhado num documento completo, para testar localmente
//   dist/moldes.js    -> só a tabela window.__MOLDES, para o comparativo.html (que abre por file://
//                        e não pode ler PNG de arquivo num canvas)
// A arte (moldes do PixelLab, ícones, logotipo) entra como data: num <script> antes dos scripts do jogo.
// Arquivo de arte ausente nunca falha o build: a parte correspondente fica vazia e o jogo cai no
// desenho por código / no texto.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFile(join(ROOT, p), 'utf8')

const SCRIPTS = ['src/data.js', 'src/sim.js', 'src/breed.js', 'src/gear.js', 'src/sprites.js', 'src/game.js']

const index = await read('index.html')
const m = index.match(/<!-- app:start -->([\s\S]*?)<!-- app:end -->/)
if (!m) throw new Error('index.html: marcadores <!-- app:start --> / <!-- app:end --> não encontrados')
const markup = m[1].trim()

const css = (await read('src/game.css')).trim()
if (/<\/style/i.test(css)) throw new Error('game.css contém "</style"')

// ---------------------------------------------------------------------------
// Arte embutida
// ---------------------------------------------------------------------------
const dataUrl = async (rel) => 'data:image/png;base64,' + (await readFile(join(ROOT, rel))).toString('base64')
const listar = async (rel) => (existsSync(join(ROOT, rel)) ? (await readdir(join(ROOT, rel))).sort() : [])
const avisos = []

// Moldes: assets/pixellab/molde-<estilo>.json + -retrato.png, -parado.png, -galope-0..N-1.png.
// Do JSON vão só os campos que o jogo lê (o resto — seeds, limiares, contagens — fica no arquivo).
async function moldes() {
  const estilos = {}
  const dir = 'assets/pixellab'
  for (const nome of await listar(dir)) {
    const mm = nome.match(/^molde-([a-z]+)\.json$/)
    if (!mm) continue
    const estilo = mm[1]
    try {
      const J = JSON.parse(await read(join(dir, nome)))
      const frames = J.frames | 0
      if (!(frames > 0) || !J.ancoras || !(J.larguraUtil > 0)) throw new Error('JSON sem frames, ancoras ou larguraUtil')
      const png = (q) => join(dir, `molde-${estilo}-${q}.png`)
      const quadros = ['retrato', 'parado']
      for (let i = 0; i < frames; i++) quadros.push('galope-' + i)
      const faltam = quadros.filter((q) => !existsSync(join(ROOT, png(q))))
      if (faltam.length) throw new Error('faltam ' + faltam.map((q) => `molde-${estilo}-${q}.png`).join(', '))
      const galope = []
      for (let i = 0; i < frames; i++) galope.push(await dataUrl(png('galope-' + i)))
      estilos[estilo] = {
        json: { estilo, w: J.w, h: J.h, footY: J.footY, frames, larguraUtil: J.larguraUtil, ancoras: J.ancoras },
        retrato: await dataUrl(png('retrato')),
        parado: await dataUrl(png('parado')),
        galope
      }
    } catch (e) {
      avisos.push(`molde "${estilo}" ignorado: ${e.message}`)
    }
  }
  return { estilos }
}

// Ícones: assets/icons/<nome>.png (a pasta raw/ fica de fora).
async function icones() {
  const out = {}
  for (const nome of await listar('assets/icons')) {
    const mm = nome.match(/^([a-z0-9-]+)\.png$/)
    if (mm) out[mm[1]] = await dataUrl(join('assets/icons', nome))
  }
  return out
}

// Logotipo: data: URL e o tamanho em px (lido do cabeçalho IHDR do PNG), para o <img> reservar o espaço.
async function marca() {
  const logo = 'assets/marca/logo.png'
  if (!existsSync(join(ROOT, logo))) return { logo: null }
  const buf = await readFile(join(ROOT, logo))
  const png = buf.length > 24 && buf.toString('latin1', 12, 16) === 'IHDR'
  return { logo: 'data:image/png;base64,' + buf.toString('base64'), w: png ? buf.readUInt32BE(16) : 0, h: png ? buf.readUInt32BE(20) : 0 }
}

// JSON seguro dentro de <script>: nada de "<" literal (fecharia a tag).
const jsonJs = (v) => JSON.stringify(v).replace(/</g, '\\u003c')
const MOLDES = await moldes()
const arteJs = [
  `window.__MOLDES = ${jsonJs(MOLDES)};`,
  `window.__ICONES = ${jsonJs(await icones())};`,
  `window.__MARCA = ${jsonJs(await marca())};`
].join('\n')

const scripts = [`<script>\n/* arte embutida (moldes, ícones, marca) */\n${arteJs}\n</script>`]
for (const file of SCRIPTS) {
  let js = (await read(file)).trim()
  // nunca fechar a tag por acidente dentro de uma string
  js = js.replace(/<\/script/gi, '<\\/script')
  scripts.push(`<script>\n/* ${file} */\n${js}\n</script>`)
}

const body = [
  '<title>Galope Elemental</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  `<style>\n${css}\n</style>`,
  markup,
  ...scripts,
  ''
].join('\n')

for (const tag of [/<!doctype/i, /<html[\s>]/i, /<head[\s>]/i, /<body[\s>]/i]) {
  if (tag.test(body)) throw new Error(`jogo.html não pode conter ${tag}`)
}

const preview = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' +
  body + '</body></html>\n'

const moldesJs = '// Gerado por build.mjs — não editar. Tabela dos moldes para o comparativo.html.\n' +
  `window.__MOLDES = ${jsonJs(MOLDES)};\n`

await mkdir(join(ROOT, 'dist'), { recursive: true })
await writeFile(join(ROOT, 'dist', 'jogo.html'), body)
await writeFile(join(ROOT, 'dist', 'preview.html'), preview)
await writeFile(join(ROOT, 'dist', 'moldes.js'), moldesJs)
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB'
for (const a of avisos) console.log('AVISO: ' + a)
console.log(`moldes: ${Object.keys(MOLDES.estilos).join(', ') || 'nenhum'} · arte embutida ${kb(arteJs)}`)
console.log(`dist/jogo.html    ${kb(body)}`)
console.log(`dist/preview.html ${kb(preview)}`)
console.log(`dist/moldes.js    ${kb(moldesJs)}`)
