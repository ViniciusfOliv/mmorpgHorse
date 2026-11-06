// Teste de fluxo completo da interface com Playwright (sem instalar nada).
//   node build.mjs && node tools/ui-test.mjs
// Gera as capturas finais em prototype/screens/final-*.png (ou em $SHOTS_DIR) (deviceScaleFactor 2) e falha se houver
// erro de console, rolagem horizontal, cavalo do jogador fora da tela, sala re-sorteada de graça,
// resultado calculado antes de pagar, ou a tela de corrida não couber na altura da janela.
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const URL = pathToFileURL(join(ROOT, 'dist', 'preview.html')).href
const SHOTS = process.env.SHOTS_DIR || join(ROOT, 'screens') // SHOTS_DIR: usado pelo scripts/check.sh
await mkdir(SHOTS, { recursive: true })

const problems = []
const notes = {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function newPage(browser, viewport, label, extra = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ...extra })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${label}] console: ${m.text()}`) })
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`))
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await Promise.race([page.evaluate(() => document.fonts && document.fonts.ready), sleep(4000)])
  return page
}

async function checkOverflow(page, label) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  if (o.sw > o.cw) problems.push(`[${label}] rolagem horizontal: scrollWidth ${o.sw} > ${o.cw}`)
  return o
}

// monitora, quadro a quadro, se o cavalo do jogador está inteiro na tela (fora da câmera de chegada)
async function startCamMonitor(page) {
  await page.evaluate(() => {
    const cc = window.__cc = { frames: 0, partial: 0, off: 0, x1: 0, x2: 0 }
    const tick = () => {
      const r = window.__galope && window.__galope.race
      if (!r) return
      const s = r._state
      if (s.phase === 'corrida' && !s.finishCam && s.playerRect) {
        const p = s.playerRect
        cc.frames++
        if (s.mult > 1) cc.x2++; else cc.x1++
        if (p.x < 0 || p.x + p.w > p.W) cc.partial++
        if (p.x + p.w <= 0 || p.x >= p.W) cc.off++
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

// a tela de corrida inteira (canvas + controles) cabe na janela?
async function checkRaceFits(page, label) {
  const f = await page.evaluate(() => {
    const cv = document.getElementById('pista').getBoundingClientRect()
    const ctl = document.querySelector('.controles').getBoundingClientRect()
    return { canvasBottom: Math.round(cv.bottom), ctlBottom: Math.round(ctl.bottom), vh: window.innerHeight, cssH: Math.round(cv.height), cssW: Math.round(cv.width), S: window.__galope.race._state.S, lane: window.__galope.race._state.lay.laneArt }
  })
  if (f.ctlBottom > f.vh + 1) problems.push(`[${label}] controles da corrida fora da tela (${f.ctlBottom} > ${f.vh})`)
  notes['fit-' + label] = f
  return f
}

// tempo de simulação para a captura: o momento com mais cavalos na tela, de preferência num boost
async function pickShotTime(page) {
  return page.evaluate(() => {
    const L = window.__galope.ui.lobby, sim = L.sim, me = L.playerIdx, st = window.__galope.race._state
    const visM = st.lay.artW / st.ppmArt, myFin = sim.finishTimes[me], n = L.n
    const boosts = []
    sim.events.forEach((e) => {
      if (e.type === 'garra') boosts.push({ i: e.racer, from: e.t + 0.3, to: sim.finishTimes[e.racer] })
      else if (e.type === 'skill') boosts.push({ i: e.racer, from: e.t + 0.3, to: e.t + 3.5 })
    })
    let best = { t: myFin * 0.5, score: -1, why: 'meio da corrida' }
    for (let t = Math.max(10, myFin * 0.2); t < myFin * 0.9; t += 0.25) {
      const fr = sim.frames[Math.min(sim.frames.length - 1, Math.round(t / sim.dt))]
      const p = fr.pos[me]
      const vis = (i) => fr.pos[i] > p - 0.45 * visM + 16 && fr.pos[i] < p + 0.5 * visM
      let count = 0
      for (let i = 0; i < n; i++) if (vis(i)) count++
      const bMe = boosts.find((b) => b.i === me && t >= b.from && t <= b.to)
      const bAny = boosts.find((b) => vis(b.i) && t >= b.from && t <= b.to)
      const score = count * 1.5 + (bMe ? 2.5 : 0) + (bAny ? 1 : 0)
      if (score > best.score) best = { t, score, why: count + ' cavalos na tela' + (bMe ? ', boost do jogador' : bAny ? ', boost de rival' : '') }
    }
    return best
  })
}

const browser = await chromium.launch()
try {
  // ---------------- celular 390x844 ----------------
  const page = await newPage(browser, { width: 390, height: 844 }, 'mobile')
  await page.waitForSelector('.inicial')
  await sleep(500)
  await checkOverflow(page, 'inicial')
  await page.screenshot({ path: join(SHOTS, 'final-01-inicial.png') })

  await page.getByRole('button', { name: 'Escolher Brasa' }).click()
  await page.waitForSelector('#t-estabulo')
  const seedBase1 = await page.evaluate(() => window.__galope.state.seedBase)
  await sleep(400)
  await checkOverflow(page, 'estabulo')
  await page.screenshot({ path: join(SHOTS, 'final-02-estabulo.png') })

  // sala de largada: voltar não re-sorteia, e nada de resultado antes de pagar
  await page.getByRole('button', { name: 'Procurar corrida' }).click()
  await page.waitForSelector('#t-largada')
  const lobbyA = await page.evaluate(() => ({ seed: window.__galope.ui.lobby.seed, counter: window.__galope.ui.lobby.counter, sim: !!window.__galope.ui.lobby.sim, gold: window.__galope.state.gold }))
  if (lobbyA.sim) problems.push('sala de largada já tem o resultado antes do Largar!')
  const mapa = await page.evaluate(() => ({ blocks: window.__galope.ui.lobby.cond.blocks ? window.__galope.ui.lobby.cond.blocks.length : 0, perfil: !!document.querySelector('.perfil') }))
  if (mapa.blocks < 5 || mapa.blocks > 9) problems.push('sala: mapa com ' + mapa.blocks + ' blocos (esperado 5–9)')
  if (!mapa.perfil) problems.push('sala: sem o desenho do mapa (.perfil)')
  await page.getByRole('button', { name: 'Voltar ao estábulo' }).click()
  await page.waitForSelector('#t-estabulo')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#t-estabulo')
  await page.getByRole('button', { name: /Voltar à sala/ }).click()
  await page.waitForSelector('#t-largada')
  const lobbyB = await page.evaluate(() => ({ seed: window.__galope.ui.lobby.seed, counter: window.__galope.ui.lobby.counter, gold: window.__galope.state.gold }))
  if (lobbyA.seed !== lobbyB.seed || lobbyA.counter !== lobbyB.counter) problems.push(`voltar/recarregar re-sorteou a sala (${lobbyA.counter} -> ${lobbyB.counter})`)
  if (lobbyB.gold !== lobbyA.gold) problems.push('voltar à sala cobrou Ouro')
  // item na própria sala
  await page.getByRole('group', { name: 'Item equipado' }).getByRole('button', { name: /Ferradura Leve/ }).click()
  const strat = await page.evaluate(() => ({ item: window.__galope.state.equipped, row: document.querySelector('.programa li.voce').textContent }))
  if (strat.item !== 'ferradura-leve' || !/Ferradura Leve/.test(strat.row)) problems.push('sala: troca de item não aplicou ' + JSON.stringify(strat))
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(300)
  await checkOverflow(page, 'largada')
  await page.screenshot({ path: join(SHOTS, 'final-03-largada.png') })

  const goldBefore = await page.evaluate(() => window.__galope.state.gold)
  await page.getByRole('button', { name: /^Largar/ }).dblclick()
  await page.waitForSelector('#pista')
  await startCamMonitor(page)
  const shot = await pickShotTime(page)
  notes.shot = shot
  await checkRaceFits(page, 'm390')
  await page.waitForFunction((t) => window.__galope.race && window.__galope.race._state.simT >= t, shot.t, { timeout: 60000 })
  const selected = await page.evaluate(() => String(window.getSelection()))
  if (selected) problems.push('texto selecionado na tela de corrida depois do duplo clique: ' + selected.slice(0, 40))
  await checkOverflow(page, 'corrida')
  await page.screenshot({ path: join(SHOTS, 'final-04-corrida.png') })
  // resto em x2 até a troca automática para o resultado
  await page.getByRole('button', { name: 'x2' }).click()
  await page.waitForSelector('#t-resultado', { timeout: 90000 })
  notes.cam390 = await page.evaluate(() => window.__cc)
  await sleep(600)
  await checkOverflow(page, 'resultado')
  await page.screenshot({ path: join(SHOTS, 'final-05-resultado.png') })
  const after = await page.evaluate(() => ({ gold: window.__galope.state.gold, level: window.__galope.state.level, xp: window.__galope.state.xp, result: window.__galope.ui.result, pending: window.__galope.state.pending }))
  if (after.gold !== goldBefore - after.result.fee + after.result.prize) problems.push(`ouro: ${after.gold} != ${goldBefore} - ${after.result.fee} + ${after.result.prize}`)
  if (after.pending) problems.push('sala continuou pendente depois de correr')

  // HUD x resultado oficial
  // correr de novo -> nova sala (contador +1)
  await page.getByRole('button', { name: /Correr de novo|Treino gratuito/ }).click()
  await page.waitForSelector('#t-largada')
  const lobbyC = await page.evaluate(() => window.__galope.ui.lobby.counter)
  if (lobbyC !== lobbyA.counter + 1) problems.push('correr de novo não abriu a sala seguinte')

  // persistência: recarregar volta ao estábulo com o mesmo saldo
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#t-estabulo')
  const goldReload = await page.evaluate(() => window.__galope.state.gold)
  if (goldReload !== after.gold) problems.push(`persistência: ouro ${goldReload} != ${after.gold}`)

  // recomeçar com o mesmo inicial: seed base nova
  await page.getByRole('button', { name: 'Recomeçar com outro inicial' }).click()
  await page.getByRole('button', { name: 'Sim, recomeçar' }).click()
  await page.getByRole('button', { name: 'Escolher Brasa' }).click()
  const seedBase2 = await page.evaluate(() => window.__galope.state.seedBase)
  if (seedBase1 === seedBase2) problems.push('seedBase repetiu depois de recomeçar')

  // sem Ouro: oferece treino gratuito
  await page.evaluate(() => { window.__galope.state.gold = 20 })
  await page.getByRole('button', { name: 'Sem item' }).first().click()   // re-renderiza o estábulo
  await page.waitForSelector('[data-acao="treino"]')
  await page.getByRole('button', { name: 'Treino gratuito' }).click()
  await page.waitForSelector('#t-largada')
  await page.getByRole('button', { name: /^Largar treino/ }).click()
  await page.getByRole('button', { name: /Pular/ }).click()
  await page.waitForSelector('#t-resultado')
  const trainGold = await page.evaluate(() => window.__galope.state.gold)
  if (!(trainGold > 20)) problems.push(`treino não pagou Ouro: ${trainGold}`)
  await page.context().close()

  // save antigo (v1, com tática e sem skills) é lido e migrado
  const oldCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const old = await oldCtx.newPage()
  old.on('console', (m) => { if (m.type() === 'error') problems.push(`[save-antigo] console: ${m.text()}`) })
  old.on('pageerror', (e) => problems.push(`[save-antigo] pageerror: ${e.message}`))
  const OLD_SAVE = '{"v":1,"rev":3,"starterId":"mare","level":4,"xp":10,"gold":777,"inventory":["sela-couro"],"equipped":null,"tactic":"ponteiro","tier":50,"seedBase":123,"raceCounter":2,"pending":null,"races":2,"wins":1,"podiums":1,"goldWon":100}'
  await old.addInitScript((raw) => { window.localStorage.setItem('galope-elemental:v1', raw) }, OLD_SAVE)
  await old.goto(URL, { waitUntil: 'domcontentloaded' })
  await old.waitForSelector('#t-estabulo')
  const mig = await old.evaluate(() => { const s = window.__galope.state; return { gold: s.gold, tactic: s.tactic, skills: JSON.stringify(s.skills) } })
  if (mig.gold !== 777 || mig.tactic !== undefined || mig.skills !== '["mare-alta"]') problems.push('save antigo não migrou: ' + JSON.stringify(mig))
  await oldCtx.close()

  // ---------------- desktop 1280x800 ----------------
  const desk = await newPage(browser, { width: 1280, height: 800 }, 'desktop')
  await desk.waitForSelector('.inicial')
  await sleep(300)
  await checkOverflow(desk, 'desktop-inicial')
  await desk.getByRole('button', { name: 'Escolher Maré' }).click()
  await desk.getByRole('button', { name: 'Procurar corrida' }).click()
  await desk.getByRole('button', { name: /^Largar/ }).click()
  await desk.waitForSelector('#pista')
  await startCamMonitor(desk)
  const dshot = await pickShotTime(desk)
  notes.dshot = dshot
  await checkRaceFits(desk, 'd1280')
  await desk.waitForFunction((t) => window.__galope.race && window.__galope.race._state.simT >= t, dshot.t, { timeout: 60000 })
  await checkOverflow(desk, 'desktop-corrida')
  await desk.screenshot({ path: join(SHOTS, 'final-desktop-corrida.png') })
  await desk.getByRole('button', { name: 'x2' }).click()
  await desk.waitForSelector('#t-resultado', { timeout: 90000 })
  notes.cam1280 = await desk.evaluate(() => window.__cc)
  await desk.context().close()

  // ---------------- celular pequeno, paisagem e movimento reduzido ----------------
  for (const [label, vp] of [['m360', { width: 360, height: 740 }], ['land', { width: 844, height: 390 }]]) {
    const p = await newPage(browser, vp, label)
    await p.getByRole('button', { name: 'Escolher Ipê' }).click()
    await p.getByRole('button', { name: 'Procurar corrida' }).click()
    await p.getByRole('button', { name: /^Largar/ }).click()
    await p.waitForSelector('#pista')
    await startCamMonitor(p)
    await sleep(2500)
    await checkRaceFits(p, label)
    await p.getByRole('button', { name: 'x2' }).click()
    await sleep(5000)
    await checkOverflow(p, label + '-corrida')
    notes['cam' + label] = await p.evaluate(() => window.__cc)
    await p.getByRole('button', { name: /Pular|Ver resultado/ }).click()
    await p.waitForSelector('#t-resultado')
    await checkOverflow(p, label + '-resultado')
    await p.context().close()
  }
  const rm = await newPage(browser, { width: 390, height: 844 }, 'reduced', { reducedMotion: 'reduce' })
  await rm.getByRole('button', { name: 'Escolher Brasa' }).click()
  await rm.getByRole('button', { name: 'Procurar corrida' }).click()
  await rm.getByRole('button', { name: /^Largar/ }).click()
  await sleep(2500)
  await rm.getByRole('button', { name: /Pular/ }).click()
  await rm.waitForSelector('#t-resultado')
  await rm.context().close()

  for (const k of ['cam390', 'cam1280', 'camm360', 'camland']) {
    const c = notes[k]
    if (c && (c.partial > 0 || c.off > 0)) problems.push(`${k}: cavalo do jogador saiu da tela (${c.partial} quadros parciais, ${c.off} fora de ${c.frames})`)
  }
  console.log(JSON.stringify({ goldBefore, after: { gold: after.gold, level: after.level, xp: after.xp, place: after.result.place, prize: after.result.prize, xpGain: after.result.xpGain }, trainGold, notes }, null, 1))
} finally {
  await browser.close()
}
if (problems.length) {
  console.log('PROBLEMAS:\n' + problems.join('\n'))
  process.exit(1)
}
console.log('OK: fluxo completo sem erros de console, sem rolagem horizontal e com o cavalo sempre na tela')
