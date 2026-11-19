// Spike do teste de engine (2026-11-19) — DESCARTÁVEL, fora do jogo e do check.sh.
//   node prototype/spike/gerar-engine.mjs
// Gera prototype/spike/engine.html: uma página única (conteúdo de artefato, sem doctype/html/head/body) que roda
// uma corrida sintética no pior caso visual do lançamento com o desenho REAL do jogo (src/sprites.js, src/fx.js,
// src/marcas.js e src/data.js, embutidos como estão, sem alteração) e as camadas extras que queremos medir
// (parallax em bitmaps, partículas de explosão, câmera com zoom e tremida). Só lê src/ e assets/; nunca escreve
// fora de prototype/spike/. O sim.js entra só porque o marcas.js usa o hash dele: as posições da corrida são
// sintéticas (o custo medido é só de desenho).
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lerMoldes, lerIcones, jsonJs } from '../tools/arte-embutida.mjs'
import { cssFontes } from '../tools/interface-arte.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ROOT = join(AQUI, '..')
const ler = (p) => readFile(join(ROOT, p), 'utf8')

const MODULOS = ['src/data.js', 'src/sim.js', 'src/marcas.js', 'src/sprites.js', 'src/fx.js']
const avisos = []
const moldes = await lerMoldes(ROOT, avisos)
const icones = await lerIcones(ROOT)
// só os ícones que a corrida desenha (skills, clima, dado): o resto não entra na página
const iconesCorrida = Object.fromEntries(Object.entries(icones).filter(([k]) => /^(sk-|cl-|ui-dado$)/.test(k)))

const tag = (nome, js) => `<script>\n/* ${nome} */\n${js.trim().replace(/<\/script/gi, '<\\/script')}\n</script>`
const scripts = [tag('arte embutida', `window.__MOLDES = ${jsonJs(moldes)};\nwindow.__ICONES = ${jsonJs(iconesCorrida)};`)]
for (const m of MODULOS) scripts.push(tag(m + ' (cópia sem alteração)', await ler(m)))
scripts.push(tag('spike/engine.js', await readFile(join(AQUI, 'engine.js'), 'utf8')))

const css = (await cssFontes(ROOT)) + '\n' + (await readFile(join(AQUI, 'engine.css'), 'utf8'))
const corpo = await readFile(join(AQUI, 'engine.corpo.html'), 'utf8')
const html = [
  '<title>Teste de Engine</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  `<style>\n${css}\n</style>`,
  corpo.trim(),
  ...scripts,
  ''
].join('\n')
for (const proibido of [/<!doctype/i, /<html[\s>]/i, /<head[\s>]/i, /<body[\s>]/i]) {
  if (proibido.test(html)) throw new Error('engine.html não pode conter ' + proibido)
}
const bytes = Buffer.byteLength(html)
if (bytes > 15 * 1024 * 1024) throw new Error(`engine.html tem ${bytes} bytes (limite do artefato: 16 MB)`)
await writeFile(join(AQUI, 'engine.html'), html)
for (const a of avisos) console.log('AVISO: ' + a)
console.log(`spike/engine.html ${(bytes / 1024).toFixed(1)} KB · moldes: ${Object.keys(moldes.estilos || {}).length} · ícones: ${Object.keys(iconesCorrida).length}`)
