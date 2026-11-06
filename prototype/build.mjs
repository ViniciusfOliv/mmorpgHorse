// Gera o artefato de página única do protótipo (sem dependências).
//   node build.mjs
// Saída:
//   dist/jogo.html    -> conteúdo do artefato (sem doctype/html/head/body: o host embrulha)
//   dist/preview.html -> o mesmo conteúdo embrulhado num documento completo, para testar localmente
import { readFile, writeFile, mkdir } from 'node:fs/promises'
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

const scripts = []
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

await mkdir(join(ROOT, 'dist'), { recursive: true })
await writeFile(join(ROOT, 'dist', 'jogo.html'), body)
await writeFile(join(ROOT, 'dist', 'preview.html'), preview)
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB'
console.log(`dist/jogo.html    ${kb(body)}`)
console.log(`dist/preview.html ${kb(preview)}`)
