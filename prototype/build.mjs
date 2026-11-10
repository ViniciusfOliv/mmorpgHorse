// Gera o artefato de página única do protótipo (sem dependências).
//   node build.mjs
// Saída (três alvos do jogo):
//   dist/jogo.html    -> PRODUÇÃO, o que vai para o jogador (conteúdo do artefato, sem doctype/html/head/body: o
//                        host embrulha). Sem dev.js, sem os blocos /*@dev:inicio*/…/*@dev:fim*/ e
//                        /*@teste:inicio*/…/*@teste:fim*/ do game.js (modo DEV e gancho window.__galope do
//                        ui-test); ?dev=1 não faz nada. O build falha se sobrar algo do DEV ou do gancho.
//   dist/jogo-dev.html -> TESTE: tudo, com window.__GALOPE_DEV = true antes dos scripts (modo DEV ligado sozinho,
//                        save de teste) para o artefato do claude.ai, que não repassa ?dev=1
//   dist/preview.html -> DESENVOLVIMENTO e alvo do ui-test: tudo, num documento completo (com ?dev=1 abre o modo
//                        DEV)
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
const SO_DEV = ['src/dev.js']   // fora do jogo de produção

// Blocos marcados (/*@dev:inicio*/ … /*@dev:fim*/, /*@teste:inicio*/ … /*@teste:fim*/): confere o balanço (sem
// aninhar, cada início com o seu fim) e, com tirar = true, remove os blocos inteiros (marcadores incluídos).
const MARCADOR = /\/\*@(dev|teste):(inicio|fim)\*\//g
function blocos(js, file, tirar) {
  let out = '', desde = 0, aberto = null
  const linha = (i) => js.slice(0, i).split('\n').length
  for (const m of js.matchAll(MARCADOR)) {
    const [txt, tipo, lado] = m
    if (lado === 'inicio') {
      if (aberto) throw new Error(`${file}:${linha(m.index)}: /*@${tipo}:inicio*/ dentro do bloco @${aberto.tipo} aberto na linha ${linha(aberto.i)} (blocos não se aninham)`)
      aberto = { tipo, i: m.index }
      if (tirar) out += js.slice(desde, m.index)
    } else {
      if (!aberto) throw new Error(`${file}:${linha(m.index)}: /*@${tipo}:fim*/ sem /*@${tipo}:inicio*/ antes`)
      if (aberto.tipo !== tipo) throw new Error(`${file}:${linha(m.index)}: /*@${tipo}:fim*/ fecha o bloco @${aberto.tipo} aberto na linha ${linha(aberto.i)}`)
      aberto = null
      desde = m.index + txt.length
    }
  }
  if (aberto) throw new Error(`${file}:${linha(aberto.i)}: /*@${aberto.tipo}:inicio*/ sem /*@${aberto.tipo}:fim*/`)
  return tirar ? out + js.slice(desde) : js
}

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

const arteTag = `<script>\n/* arte embutida (moldes, ícones, marca) */\n${arteJs}\n</script>`
const scripts = [arteTag], scriptsProd = [arteTag]
for (const file of SCRIPTS) {
  const fonte = await read(file)
  // nunca fechar a tag por acidente dentro de uma string
  const tag = (js) => `<script>\n/* ${file} */\n${js.trim().replace(/<\/script/gi, '<\\/script')}\n</script>`
  scripts.push(tag(blocos(fonte, file, false)))
  if (!SO_DEV.includes(file)) scriptsProd.push(tag(blocos(fonte, file, true)))
}

// extra: <script>s que entram antes dos do jogo (o build de teste liga o modo DEV assim)
const pagina = (extra, js) => [
  '<title>Galope Elemental</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  `<style>\n${css}\n</style>`,
  markup,
  ...extra,
  ...js,
  ''
].join('\n')
const body = pagina([], scriptsProd)                    // produção
const bodyDev = pagina(['<script>window.__GALOPE_DEV = true;</script>'], scripts)
const bodyPreview = pagina([], scripts)

for (const [nome, html] of [['jogo.html', body], ['jogo-dev.html', bodyDev]]) {
  for (const tag of [/<!doctype/i, /<html[\s>]/i, /<head[\s>]/i, /<body[\s>]/i]) {
    if (tag.test(html)) throw new Error(`${nome} não pode conter ${tag}`)
  }
}
// produção: nada do modo DEV nem do gancho de teste pode sobrar
for (const [proibido, o_que] of [[/__galope/i, 'o gancho de teste (__galope / __GALOPE_DEV)'], [/\bDev\./, 'referência a Dev. (dev.js)'], [/galope-elemental:dev/, "a chave do save DEV ('galope-elemental:dev')"]]) {
  const m = body.match(proibido)
  if (m) {
    const linha = body.slice(0, m.index).split('\n').length
    throw new Error(`dist/jogo.html (produção) ainda contém ${o_que}, na linha ${linha}: "${body.split('\n')[linha - 1].trim().slice(0, 120)}". Ponha o trecho dentro de /*@dev:inicio*/…/*@dev:fim*/ (ou @teste) no fonte.`)
  }
}

const preview = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' +
  bodyPreview + '</body></html>\n'

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
