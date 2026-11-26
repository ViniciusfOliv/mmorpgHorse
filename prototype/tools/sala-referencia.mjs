// Grava (ou confere) a referência da equivalência da sala (T15): monta as salas de sala-casos.mjs com o jogo no
// navegador, pelo gancho de teste window.__galope.buildLobby, e guarda um hash por sala em sala-referencia.json.
//   node prototype/tools/sala-referencia.mjs           grava (rodar com o jogo de ANTES da mudança)
//   node prototype/tools/sala-referencia.mjs --check   confere o jogo de agora contra o que foi gravado
// Guarda dois hashes por caso: "recorte" (o que a sala sorteia; o sala-test.js confere em Node pelo módulo) e "sala"
// (o objeto inteiro que a tela recebe). Não grava save nenhum: cada caso troca o estado em memória e o devolve.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { casos, cavaloDoCaso, recorteDaSala } from './sala-casos.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const AQUI = dirname(fileURLToPath(import.meta.url))
const DIST = join(AQUI, '..', 'dist')
const ARQ = join(AQUI, 'sala-referencia.json')
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)

export async function montarNoJogo(browser, base, lista) {
  // um save mínimo (v2, migrado na carga) para o jogo abrir no estábulo, e não na escolha do cavalo inicial
  const save = JSON.stringify({ v: 2, starterId: 'mare', level: 4, xp: 0, skills: [], gold: 555, races: 1, wins: 0, podiums: 0, goldWon: 0, seedBase: 777, raceCounter: 1 })
  const comSave = (chave, rapido) => [({ chave, save, rapido }) => { if (rapido) window.__GALOPE_RAPIDO = true; localStorage.setItem(chave, save) }, { chave, save, rapido }]
  const grupos = { normal: { query: '', init: comSave('galope-elemental:v1', false) }, rapido: { query: '', init: comSave('galope-elemental:teste-rapido', true) },
    'dev-seed': { query: '?dev=1', init: comSave('galope-elemental:dev', false) }, 'dev-cond': { query: '?dev=1', init: comSave('galope-elemental:dev', false) } }
  const out = {}
  for (const [modo, g] of Object.entries(grupos)) {
    const meus = lista.filter((c) => c.modo === modo).map((c) => ({ ...c, cavalo: cavaloDoCaso(c) }))
    if (!meus.length) continue
    const ctx = await browser.newContext()
    const pg = await ctx.newPage()
    await pg.addInitScript(g.init[0], g.init[1])
    await pg.goto(base + 'preview.html' + g.query, { waitUntil: 'domcontentloaded' })
    await pg.waitForFunction(() => window.__galope && window.__galope.state)
    const r = await pg.evaluate(({ meus, recorteSrc }) => {
      const recorte = new Function('return ' + recorteSrc)()
      const sedasBots = window.Sprites.SILKS.filter((c) => c.toLowerCase() !== '#f2c230')
      const g = window.__galope, st = g.state, res = {}
      const antes = { seedBase: st.seedBase, mounts: st.mounts, activeId: st.activeId, devNext: g.ui.devNext }
      try {
        for (const c of meus) {
          st.seedBase = c.seedBase
          st.mounts = [Object.assign({ uid: 9001, templateId: c.modelo }, c.cavalo)]
            .concat(c.donos.map((id, i) => ({ uid: 9100 + i, templateId: id })))
          st.activeId = 9001
          g.ui.devNext = c.devSeed != null ? { seed: c.devSeed, cond: c.devCond || null, wind: null } : null
          const L = g.buildLobby({ counter: c.counter, training: c.training, fee: c.training ? 0 : 50, pr: c.pr })
          res[c.id] = { recorte: JSON.stringify(recorte(L, sedasBots)), sala: JSON.stringify(L) }
        }
      } finally {
        st.seedBase = antes.seedBase; st.mounts = antes.mounts; st.activeId = antes.activeId; g.ui.devNext = antes.devNext
      }
      return res
    }, { meus, recorteSrc: recorteDaSala.toString() })
    Object.assign(out, r)
    await ctx.close()
  }
  return out
}

export function servirDist() {
  const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' }
  const srv = createServer(async (req, res) => {
    try {
      const p = join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname))
      res.writeHead(200, { 'content-type': tipos[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p))
    } catch (e) { res.writeHead(404); res.end() }
  })
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)))
}

export const hashes = (montadas) => Object.fromEntries(Object.entries(montadas).map(([id, m]) => [id, { recorte: hash(m.recorte), sala: hash(m.sala) }]))

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check')
  const srv = await servirDist()
  const browser = await chromium.launch()
  try {
    const lista = casos()
    const h = hashes(await montarNoJogo(browser, `http://127.0.0.1:${srv.address().port}/`, lista))
    if (check) {
      const ref = JSON.parse(await readFile(ARQ, 'utf8')).salas
      const dif = lista.filter((c) => !ref[c.id] || ref[c.id].recorte !== h[c.id].recorte || ref[c.id].sala !== h[c.id].sala).map((c) => c.id)
      console.log(dif.length ? `DIFERENTE: ${dif.length} de ${lista.length} salas (${dif.slice(0, 8).join(', ')}…)` : `OK: ${lista.length} salas iguais à referência`)
      process.exitCode = dif.length ? 1 : 0
    } else {
      await writeFile(ARQ, JSON.stringify({ sobre: 'hash de cada sala de sala-casos.mjs montada pelo jogo (buildLobby); regravada de propósito quando a regra da sala muda (D9: 2026-11-25)', salas: h }, null, 1) + '\n')
      console.log(`gravada: ${lista.length} salas em ${ARQ}`)
    }
  } finally { await browser.close(); srv.close() }
}
