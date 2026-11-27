// Grava (ou confere) a referência da liquidação do fim da corrida (T14): monta salas com o jogo no navegador e liquida
// cada uma numa cópia do save pelo gancho de teste window.__galope.liquidaTeste (sem gravar nada), guardando um hash do
// save resultante, do resumo do resultado e da sala com a simulação. Com --check confere também o módulo conta.js no
// Node: a mesma entrada (save e sala de antes, lidos do navegador) tem de dar o mesmo texto.
//   node prototype/tools/conta-referencia.mjs           grava (rodar com o jogo de ANTES da mudança; regravar só de propósito)
//   node prototype/tools/conta-referencia.mjs --check   confere o jogo de agora (e o conta.js no Node) contra o gravado
// Casos: 10 perfis de save (nível 1, perto de subir, perto do máximo, no máximo, as 3 insígnias, mochila cheia de
// Pergaminho e Selo, treino AFK do cavalo ativo, outro elemento e o campeão, com e sem o Selo no teto) × treino ou
// valendo × 20 salas = 400 liquidações.
// O relógio do navegador fica parado num instante fixo (o treino AFK do ativo lê a hora).
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { servirDist } from './sala-referencia.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const AQUI = dirname(fileURLToPath(import.meta.url))
const SRC = join(AQUI, '..', 'src')
const ARQ = join(AQUI, 'conta-referencia.json')
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)
const INSTANTE = new Date('2026-11-27T12:00:00Z')

// os perfis: cada um mexe num save-base (o do jogo logo depois de escolher a Brasa)
function perfis(G, agoraMin) {
  const ativo = (s) => s.mounts.find((m) => m.uid === s.activeId)
  return [
    ['nivel1', () => {}],
    ['quase-sobe', (s) => { const m = ativo(s); m.level = 12; m.xp = G.ECONOMY.xpToLevel(12) - 5 }],
    ['quase-max', (s) => { const m = ativo(s); m.level = 49; m.xp = G.ECONOMY.xpToLevel(49) - 3 }],
    ['no-max', (s) => { const m = ativo(s); m.level = 50; m.xp = G.ECONOMY.xpToLevel(50) }],
    ['insignias', (s) => { G.GYM_ORDER.forEach((id) => { s.ginasios[id].etapa = 5 }); const m = ativo(s); m.level = 20; m.xp = G.ECONOMY.xpToLevel(20) - 8 }],
    ['mochila-cheia', (s) => { s.mochila.pergaminho = G.BAG_MAX; s.mochila.selo = G.ITEMS.selo.cap }],
    ['afk-ativo', (s) => { s.afk.vagas[0].uid = s.activeId; s.afk.vagas[0].inicioMin = agoraMin - 90 }],
    ['outro-elemento', (s) => { const m = ativo(s); m.element = 'grama'; m.level = 7; m.xp = G.ECONOMY.xpToLevel(7) - 2 }],
    // campeão: a sala é montada para 60% do Poder do cavalo (prFator), e ele vence quase sempre: cobre o Selo do campeão,
    // que só cai no 1º lugar de corrida valendo (10%), com a mochila normal e com o Selo no teto
    ['campeao', (s) => { const m = ativo(s); m.level = 50; m.xp = 0 }, 0.6],
    ['campeao-cheio', (s) => { const m = ativo(s); m.level = 50; m.xp = 0; s.mochila.selo = G.ITEMS.selo.cap }, 0.6]
  ]
}

export async function liquidarNoJogo(browser, base) {
  const G = require(join(SRC, 'data.js'))
  const ctx = await browser.newContext()
  const pg = await ctx.newPage()
  await pg.clock.setFixedTime(INSTANTE)
  await pg.addInitScript(() => { window.__GALOPE_SEM_RELOGIO = true })
  await pg.goto(base + 'preview.html', { waitUntil: 'domcontentloaded' })
  await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
  await pg.waitForSelector('#t-estabulo')
  const { s0, agoraMin } = await pg.evaluate(() => ({ s0: JSON.parse(JSON.stringify(window.__galope.state)), agoraMin: window.__galope.agoraMin() }))
  const casos = []
  for (const [nome, mexe, prFator] of perfis(G, agoraMin)) {
    for (const training of [false, true]) {
      for (let k = 0; k < 20; k++) {
        const s = JSON.parse(JSON.stringify(s0))
        s.gold = 5000
        s.seedBase = 424242   // o save novo nasce com uma seed sorteada: fixa, para o caso ser sempre o mesmo
        mexe(s)
        const fee = training ? 0 : [50, 100, 250][k % 3]
        casos.push({ id: `${nome}-${training ? 'treino' : 'valendo'}-${k}`, s, prFator: prFator || 1, P: { counter: 1 + k * 3, training, fee } })
      }
    }
  }
  const out = await pg.evaluate((casos) => {
    const g = window.__galope, RS = window.RaceSim, r = {}
    for (const c of casos) {
      const ativo = c.s.mounts.find((m) => m.uid === c.s.activeId)
      const P = Object.assign({ pr: Math.round(RS.powerRating(JSON.parse(JSON.stringify(ativo))) * c.prFator) }, c.P)
      r[c.id] = g.liquidaTeste(c.s, P)
    }
    return r
  }, casos)
  await ctx.close()
  return out
}

// o conta.js no Node com a mesma entrada (só depois do T14: antes o módulo não existe)
// (faz o mesmo que o settle do game.js: o bônus das insígnias pelo Ginasio, a simulação em L.sim e as condições com os
// trechos de subida e curva, como o withRanges da tela)
function noNode(entradas) {
  if (!existsSync(join(SRC, 'conta.js'))) return null
  const C = require(join(SRC, 'conta.js')), S = require(join(SRC, 'sim.js')), GIN = require(join(SRC, 'ginasio.js'))
  return Object.fromEntries(Object.entries(entradas).map(([id, txt]) => {
    const { state, L, agoraMin } = JSON.parse(txt)
    const out = C.liquidar(state, L, { bonus: GIN.bonus(state.ginasios), agoraMin, gearPvp: false, playerGear: null })
    L.sim = out.sim
    const cond = L.sim.conditions
    cond.hills = S.hillsFromBlocks(cond.blocks); cond.curves = S.curvesFromBlocks(cond.blocks)
    L.cond = cond
    return [id, JSON.stringify({ state, res: out.res, L })]
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check')
  const srv = await servirDist()
  const browser = await chromium.launch()
  try {
    const r = await liquidarNoJogo(browser, `http://127.0.0.1:${srv.address().port}/`)
    const ids = Object.keys(r)
    const h = Object.fromEntries(ids.map((id) => [id, hash(r[id].saida)]))
    if (check) {
      const ref = JSON.parse(await readFile(ARQ, 'utf8')).casos
      const dif = ids.filter((id) => ref[id] !== h[id])
      const node = noNode(Object.fromEntries(ids.map((id) => [id, r[id].entrada])))
      const difNode = node ? ids.filter((id) => hash(node[id]) !== h[id]) : []
      if (dif.length) console.log(`DIFERENTE: ${dif.length} de ${ids.length} liquidações mudaram em relação à referência (${dif.slice(0, 6).join(', ')})`)
      if (difNode.length) console.log(`DIFERENTE: o conta.js no Node diverge do jogo em ${difNode.length} de ${ids.length} liquidações (${difNode.slice(0, 6).join(', ')})`)
      if (!dif.length && !difNode.length) console.log(`OK: ${ids.length} liquidações iguais à referência` + (node ? ', no jogo e no conta.js em Node' : ' (sem conta.js no Node)'))
      process.exitCode = dif.length || difNode.length ? 1 : 0
    } else {
      await writeFile(ARQ, JSON.stringify({
        sobre: 'hash do save, do resumo e da sala depois de cada liquidação de conta-referencia.mjs, gravado com o jogo de antes do T14 (2026-11-27); regravar só de propósito, quando uma regra do fim da corrida muda',
        casos: h
      }, null, 1) + '\n')
      console.log(`gravada: ${ids.length} liquidações em ${ARQ}`)
    }
  } finally { await browser.close(); srv.close() }
}
