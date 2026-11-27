// Grava (ou confere) a referência do determinismo da corrida (T12, INF-6): roda os mesmos casos no Node (require dos
// módulos de prototype/src) e no jogo dentro do Chromium (window.RaceSim e window.Ginasio do preview.html), e guarda um
// hash do resultado INTEIRO de cada caso em corrida-referencia.json (ordem, tempos, eventos, racerInfo, condições, clima
// final, duração, simVersion e tuningHash; os quadros da animação ficam de fora: recordFrames false).
//   node prototype/tools/corrida-referencia.mjs           grava (só de propósito: quando o motor ou um número de regra muda)
//   node prototype/tools/corrida-referencia.mjs --check   confere: Node e navegador iguais entre si e iguais ao arquivo
// Casos: 48 corridas (4 a 8 corredores, os 4 climas e o sorteado, níveis, estrelas, ranks de skill, fôlego e statMul) e
// os 15 desafios de ginásio (Ginasio.resolver, com os duelos encadeados). Não grava save nenhum.
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { servirDist } from './sala-referencia.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const AQUI = dirname(fileURLToPath(import.meta.url))
const SRC = join(AQUI, '..', 'src')
const ARQ = join(AQUI, 'corrida-referencia.json')
const G = require(join(SRC, 'data.js'))
const S = require(join(SRC, 'sim.js'))
const GIN = require(join(SRC, 'ginasio.js'))
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)

// casos fixos (nenhum sorteio fora das contas abaixo): cada um é { id, tipo: 'corrida', cfg } ou { id, tipo: 'ginasio', e }
export function casos() {
  const CAVALOS = G.STARTERS.concat(G.WILD_HORSES)
  const CLIMAS = Object.keys(G.WEATHERS).concat([null])   // null: o clima sai da seed
  const skillIds = Object.keys(G.SKILLS)
  const lista = []
  for (let k = 0; k < 48; k++) {
    const n = 4 + (k % 5)
    const racers = []
    for (let i = 0; i < n; i++) {
      const h = JSON.parse(JSON.stringify(CAVALOS[(k * 5 + i * 3) % CAVALOS.length]))
      h.level = 1 + ((k * 7 + i * 11) % 50)
      h.stars = 1 + ((k + i) % 3)
      h.skillRanks = {}
      ;(h.skills || []).forEach((id, q) => { h.skillRanks[id] = 1 + ((k + i + q) % 5) })
      if (i === 0 && k % 4 === 1) {   // o jogador com uma skill a mais, de qualquer elemento (cobre todas as 15 ao longo dos casos)
        const extra = skillIds[k % skillIds.length]
        if ((h.skills || []).indexOf(extra) < 0) { h.skills = (h.skills || []).concat([extra]); h.skillRanks[extra] = 1 + (k % 5) }
      }
      const r = { horse: h, name: 'r' + i, isPlayer: i === 0 }
      if (k % 6 === 2) r.folego = 0.6 + 0.1 * (i % 4)
      if (k % 6 === 3) r.statMul = 0.9 + 0.05 * (i % 4)
      racers.push(r)
    }
    const cfg = { seed: S.hash2(12345, k) >>> 0, recordFrames: false, racers }
    const clima = CLIMAS[k % CLIMAS.length]
    if (clima) cfg.conditions = { weather: clima }
    lista.push({ id: 'corrida-' + String(k).padStart(2, '0'), tipo: 'corrida', cfg })
  }
  G.GYM_ORDER.forEach((gymId, gi) => {
    G.GYMS[gymId].etapas.forEach((et, e) => {
      const time = []
      for (let t = 0; t < et.cavalos.length; t++) {
        const h = JSON.parse(JSON.stringify(G.STARTERS[(gi + e + t) % G.STARTERS.length]))
        h.level = Math.min(50, 2 + gi * 10 + e * 2 + t)
        h.stars = 2
        time.push(h)
      }
      lista.push({ id: `ginasio-${gymId}-${e}`, tipo: 'ginasio', e: { gymId, etapa: e, time, seedBase: 777 + gi, contador: e } })
    })
  })
  return lista
}

// roda um caso e devolve o texto do resultado (o mesmo código no Node e no navegador: S = RaceSim, GIN = Ginasio)
function rodar(S, GIN, c) {
  if (c.tipo === 'corrida') {
    const res = S.simulate(JSON.parse(JSON.stringify(c.cfg)))
    delete res.frames
    return JSON.stringify(res)
  }
  return JSON.stringify(GIN.resolver(JSON.parse(JSON.stringify(c.e))))
}

export function noNode(lista) {
  return Object.fromEntries(lista.map((c) => [c.id, hash(rodar(S, GIN, c))]))
}

export async function noNavegador(browser, base, lista) {
  const ctx = await browser.newContext()
  const pg = await ctx.newPage()
  await pg.goto(base + 'preview.html', { waitUntil: 'domcontentloaded' })
  await pg.waitForFunction(() => window.RaceSim && window.Ginasio)
  const textos = await pg.evaluate(({ lista, rodarSrc }) => {
    const rodar = new Function('return ' + rodarSrc)()
    const out = {}
    for (const c of lista) out[c.id] = rodar(window.RaceSim, window.Ginasio, c)
    return out
  }, { lista, rodarSrc: rodar.toString() })
  await ctx.close()
  return Object.fromEntries(Object.entries(textos).map(([id, t]) => [id, hash(t)]))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check')
  const lista = casos()
  const node = noNode(lista)
  const srv = await servirDist()
  const browser = await chromium.launch()
  try {
    const nav = await noNavegador(browser, `http://127.0.0.1:${srv.address().port}/`, lista)
    const entreSi = lista.filter((c) => node[c.id] !== nav[c.id]).map((c) => c.id)
    if (entreSi.length) {
      console.log(`DIFERENTE: Node e navegador divergem em ${entreSi.length} de ${lista.length} casos (${entreSi.slice(0, 8).join(', ')})`)
      process.exitCode = 1
    } else if (check) {
      const ref = JSON.parse(await readFile(ARQ, 'utf8')).casos
      const dif = lista.filter((c) => ref[c.id] !== node[c.id]).map((c) => c.id)
      const sobra = Object.keys(ref).filter((id) => !(id in node))
      console.log(dif.length || sobra.length
        ? `DIFERENTE: ${dif.length} de ${lista.length} corridas e desafios mudaram em relação à referência (${dif.concat(sobra).slice(0, 8).join(', ')})`
        : `OK: ${lista.length} corridas e desafios iguais à referência, no Node e no navegador`)
      process.exitCode = dif.length || sobra.length ? 1 : 0
    } else {
      await writeFile(ARQ, JSON.stringify({
        sobre: 'hash do resultado inteiro de cada caso de corrida-referencia.mjs (Node e navegador iguais); regravada de propósito quando o motor ou um número de regra muda (T12: 2026-11-27)',
        simVersion: S.VERSION, casos: node
      }, null, 1) + '\n')
      console.log(`gravada: ${lista.length} casos em ${ARQ}`)
    }
  } finally { await browser.close(); srv.close() }
}
