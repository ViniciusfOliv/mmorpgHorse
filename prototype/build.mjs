// Gera o artefato de página única do protótipo (sem dependências).
//   node build.mjs
// Saída:
//   dist/jogo.html    -> conteúdo do artefato (sem doctype/html/head/body: o host embrulha)
//   dist/jogo-dev.html -> o mesmo, com window.__GALOPE_DEV = true antes dos scripts: o build de teste (modo DEV,
//                        save 'galope-elemental:dev') para o artefato do claude.ai, que não repassa ?dev=1
//   dist/preview.html -> o conteúdo do jogo.html embrulhado num documento completo, para testar localmente
//                        (com ?dev=1 abre o modo DEV)
//   dist/moldes.js    -> só a tabela window.__MOLDES, para o comparativo.html (que abre por file://
//                        e não pode ler PNG de arquivo num canvas)
//   dist/wiki.html e ../docs/wiki.md -> o wiki gerado do código (tools/wiki.mjs), no fim
// A arte (moldes do PixelLab, ícones, logotipo) entra como data: num <script> antes dos scripts do jogo.
// Arquivo de arte ausente nunca falha o build: a parte correspondente fica vazia e o jogo cai no
// desenho por código / no texto.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lerMoldes, lerIcones, lerMarca, jsonJs } from './tools/arte-embutida.mjs'
import { gravarWiki } from './tools/wiki.mjs'

const ROOT = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFile(join(ROOT, p), 'utf8')

const SCRIPTS = ['src/data.js', 'src/sim.js', 'src/breed.js', 'src/gear.js', 'src/sprites.js', 'src/fx.js', 'src/dev.js', 'src/game.js']

const index = await read('index.html')
const m = index.match(/<!-- app:start -->([\s\S]*?)<!-- app:end -->/)
if (!m) throw new Error('index.html: marcadores <!-- app:start --> / <!-- app:end --> não encontrados')
const markup = m[1].trim()

const css = (await read('src/game.css')).trim()
if (/<\/style/i.test(css)) throw new Error('game.css contém "</style"')

// ---------------------------------------------------------------------------
// Arte embutida (moldes, ícones, logotipo): tools/arte-embutida.mjs, a mesma que o wiki usa
// ---------------------------------------------------------------------------
const avisos = []
const MOLDES = await lerMoldes(ROOT, avisos)
const arteJs = [
  `window.__MOLDES = ${jsonJs(MOLDES)};`,
  `window.__ICONES = ${jsonJs(await lerIcones(ROOT))};`,
  `window.__MARCA = ${jsonJs(await lerMarca(ROOT))};`
].join('\n')

const scripts = [`<script>\n/* arte embutida (moldes, ícones, marca) */\n${arteJs}\n</script>`]
for (const file of SCRIPTS) {
  let js = (await read(file)).trim()
  // nunca fechar a tag por acidente dentro de uma string
  js = js.replace(/<\/script/gi, '<\\/script')
  scripts.push(`<script>\n/* ${file} */\n${js}\n</script>`)
}

// extra: <script>s que entram antes dos do jogo (o build de teste liga o modo DEV assim)
const pagina = (extra = []) => [
  '<title>Galope Elemental</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  `<style>\n${css}\n</style>`,
  markup,
  ...extra,
  ...scripts,
  ''
].join('\n')
const body = pagina()
const bodyDev = pagina(['<script>window.__GALOPE_DEV = true;</script>'])

for (const [nome, html] of [['jogo.html', body], ['jogo-dev.html', bodyDev]]) {
  for (const tag of [/<!doctype/i, /<html[\s>]/i, /<head[\s>]/i, /<body[\s>]/i]) {
    if (tag.test(html)) throw new Error(`${nome} não pode conter ${tag}`)
  }
}

const preview = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' +
  body + '</body></html>\n'

const moldesJs = '// Gerado por build.mjs — não editar. Tabela dos moldes para o comparativo.html.\n' +
  `window.__MOLDES = ${jsonJs(MOLDES)};\n`

await mkdir(join(ROOT, 'dist'), { recursive: true })
await writeFile(join(ROOT, 'dist', 'jogo.html'), body)
await writeFile(join(ROOT, 'dist', 'jogo-dev.html'), bodyDev)
await writeFile(join(ROOT, 'dist', 'preview.html'), preview)
await writeFile(join(ROOT, 'dist', 'moldes.js'), moldesJs)
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB'
for (const a of avisos) console.log('AVISO: ' + a)
console.log(`moldes: ${Object.keys(MOLDES.estilos).join(', ') || 'nenhum'} · arte embutida ${kb(arteJs)}`)
console.log(`dist/jogo.html    ${kb(body)}`)
console.log(`dist/jogo-dev.html ${kb(bodyDev)}`)
console.log(`dist/preview.html ${kb(preview)}`)
console.log(`dist/moldes.js    ${kb(moldesJs)}`)

// Wiki gerado do código (docs/wiki.md e dist/wiki.html): sempre junto, para nunca ficar para trás do jogo
const wiki = await gravarWiki()
console.log(`dist/wiki.html    ${kb(wiki.html)}`)
console.log(`docs/wiki.md      ${kb(wiki.md)}`)
