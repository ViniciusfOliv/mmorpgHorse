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
const G = require('../src/data.js')
const S = require('../src/sim.js')
const B = require('../src/breed.js')
const GR = require('../src/gear.js')
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const URL = pathToFileURL(join(ROOT, 'dist', 'preview.html')).href
const SHOTS = process.env.SHOTS_DIR || join(ROOT, 'screens') // SHOTS_DIR: usado pelo scripts/check.sh
await mkdir(SHOTS, { recursive: true })

const problems = []
const notes = {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function newPage(browser, viewport, label, extra = {}) {
  const { query = '', ...ctxExtra } = extra
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ...ctxExtra })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${label}] console: ${m.text()}`) })
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`))
  await page.goto(URL + query, { waitUntil: 'domcontentloaded' })
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
  if ((await page.locator('.dev-painel').count()) !== 0) problems.push('painel dev presente sem ?dev=1')

  // tela da Montaria (pelo "Ver" do cartão): renomear (escapado), a ativa não pode ser liberada; depois expandir o estábulo
  await page.locator('button[data-acao="montaria"][data-id="m1"]').click()
  await page.waitForSelector('#t-montaria')
  await page.evaluate(() => { window.prompt = () => '<b>x</b>' })
  await page.locator('[data-acao="renomear"][data-id="m1"]').click()
  const ren = await page.evaluate(() => ({
    name: window.__galope.state.mounts[0].name,
    html: document.querySelector('#t-montaria').innerHTML,
    text: document.querySelector('#t-montaria').textContent
  }))
  if (ren.name !== '<b>x</b>') problems.push('renomear: nome salvo ' + JSON.stringify(ren.name))
  if (!ren.html.includes('&lt;b&gt;') || ren.html.includes('<b>')) problems.push('renomear: nome sem escapar: ' + ren.html)
  if (!ren.text.includes('#1')) problems.push('tela da montaria sem o #1: ' + ren.text)
  await page.evaluate(() => { window.prompt = () => 'Brasa' })
  await page.locator('[data-acao="renomear"][data-id="m1"]').click()
  if ((await page.evaluate(() => window.__galope.state.mounts[0].name)) !== 'Brasa') problems.push('renomear de volta para Brasa falhou')
  if (!(await page.locator('[data-acao="liberar"][data-id="m1"]').isDisabled())) problems.push('liberar da montaria ativa não está desabilitado')
  await page.locator('[data-acao="montaria-voltar"]').click()
  await page.waitForSelector('#t-estabulo')
  await page.evaluate(() => { window.__galope.state.gold = 2000 })
  await page.locator('[data-acao="aba"][data-id="estabulo"]').click()   // re-renderiza o estábulo
  await page.locator('[data-acao="expandir"]').click()
  const exp = await page.evaluate(() => ({ slots: window.__galope.state.stableSlots, gold: window.__galope.state.gold }))
  if (exp.slots !== 4 || exp.gold !== 1700) problems.push('expandir estábulo: ' + JSON.stringify(exp))

  // sala de largada: voltar não re-sorteia, e nada de resultado antes de pagar
  await page.locator('[data-acao="aba"][data-id="correr"]').click()
  await page.waitForSelector('#t-correr')
  await page.locator('[data-acao="tier"][data-id="50"]').first().click()   // re-renderiza a aba Correr
  await page.getByRole('button', { name: 'Procurar corrida' }).click()
  await page.waitForSelector('#t-largada')
  const lobbyA = await page.evaluate(() => ({ seed: window.__galope.ui.lobby.seed, counter: window.__galope.ui.lobby.counter, sim: !!window.__galope.ui.lobby.sim, gold: window.__galope.state.gold }))
  if (lobbyA.sim) problems.push('sala de largada já tem o resultado antes do Largar!')
  const mapa = await page.evaluate(() => ({ blocks: window.__galope.ui.lobby.cond.blocks ? window.__galope.ui.lobby.cond.blocks.length : 0, perfil: !!document.querySelector('.perfil') }))
  if (mapa.blocks < 5 || mapa.blocks > 9) problems.push('sala: mapa com ' + mapa.blocks + ' blocos (esperado 5–9)')
  if (!mapa.perfil) problems.push('sala: sem o desenho do mapa (.perfil)')
  // bots recebem equipamento pela liga do alvo (o rating do jogador já fica em Prata ou acima)
  const botGear = await page.evaluate(() => {
    const L = window.__galope.ui.lobby
    return { pr: window.__galope.state.pending.pr, bots: L.racers.filter((r) => !r.isPlayer).map((r) => ({ rating: r.rating, pieces: r.gear ? r.gear.pieces.length : -1, set: r.gear && r.gear.set ? r.gear.set.id + '×' + r.gear.set.count : null })) }
  })
  botGear.bots.forEach((b) => { b.league = S.leagueFor(b.rating).id })
  notes.botGear = botGear
  if (!botGear.bots.some((b) => b.pieces > 0)) problems.push('sala: nenhum bot com equipamento ' + JSON.stringify(botGear))
  await page.getByRole('button', { name: /^Voltar/ }).click()
  await page.waitForSelector('#t-correr')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#t-estabulo')
  await page.locator('[data-acao="aba"][data-id="correr"]').click()
  await page.waitForSelector('#t-correr')
  await page.getByRole('button', { name: /Voltar à sala/ }).click()
  await page.waitForSelector('#t-largada')
  const lobbyB = await page.evaluate(() => ({ seed: window.__galope.ui.lobby.seed, counter: window.__galope.ui.lobby.counter, gold: window.__galope.state.gold }))
  if (lobbyA.seed !== lobbyB.seed || lobbyA.counter !== lobbyB.counter) problems.push(`voltar/recarregar re-sorteou a sala (${lobbyA.counter} -> ${lobbyB.counter})`)
  if (lobbyB.gold !== lobbyA.gold) problems.push('voltar à sala cobrou Ouro')
  // a sala mostra o resumo do equipamento da montaria ativa
  if ((await page.locator('.slots').count()) < 1) problems.push('sala: sem resumo do equipamento')
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(300)
  await checkOverflow(page, 'largada')
  await page.screenshot({ path: join(SHOTS, 'final-03-largada.png') })

  const goldBefore = await page.evaluate(() => window.__galope.state.gold)
  // a narração só mostra as 6 últimas linhas: um observador registra se o 🎲 apareceu em algum momento
  await page.evaluate(() => {
    window.__sawDice = false
    const tela = document.getElementById('tela')
    const obs = new MutationObserver(() => {
      if (window.__sawDice) return
      for (const li of document.querySelectorAll('#feed li')) if (li.textContent.includes('🎲')) { window.__sawDice = true; obs.disconnect(); return }
    })
    obs.observe(tela, { subtree: true, childList: true, characterData: true })
  })
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
  if (!(await page.evaluate(() => window.__sawDice))) problems.push('narração nunca mostrou um Dado da Sorte')
  if (!(await page.evaluate(() => !!document.getElementById('t-dados')))) problems.push('resultado sem a seção de momentos/dados')
  notes.cam390 = await page.evaluate(() => window.__cc)
  await sleep(600)
  await checkOverflow(page, 'resultado')
  await page.screenshot({ path: join(SHOTS, 'final-05-resultado.png') })
  const after = await page.evaluate(() => ({ gold: window.__galope.state.gold, pedras: window.__galope.state.pedras, level: window.__galope.state.mounts.filter((m) => m.uid === window.__galope.state.activeId)[0].level, xp: window.__galope.state.mounts.filter((m) => m.uid === window.__galope.state.activeId)[0].xp, result: window.__galope.ui.result, pending: window.__galope.state.pending }))
  if (after.gold !== goldBefore - after.result.fee + after.result.prize) problems.push(`ouro: ${after.gold} != ${goldBefore} - ${after.result.fee} + ${after.result.prize}`)
  if (after.pending) problems.push('sala continuou pendente depois de correr')
  // pedra do pódio: determinística pela seed da sala (1ª sala do save)
  const expectStone = GR.podiumStone(S.hash2(seedBase1, 1), after.result.place, after.result.fee)
  if (after.pedras !== expectStone || after.result.stone !== expectStone) problems.push(`pedra do pódio: ${after.pedras} (resultado ${after.result.stone}) != ${expectStone}`)
  const res = await page.evaluate(() => ({
    dados: window.__galope.ui.lobby.sim.events.filter((e) => e.type === 'dado').length,
    tabela: document.querySelector('.tabela').textContent
  }))
  if (res.dados !== 2) problems.push(`resultado: ${res.dados} eventos 'dado' (esperado 2)`)
  if (/forma/i.test(res.tabela)) problems.push('resultado: tabela ainda fala em "forma"')

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

  // recomeçar com o mesmo inicial (pelo Perfil): seed base nova
  await page.locator('[data-acao="perfil"]').click()
  await page.waitForSelector('#t-perfil')
  await page.getByRole('button', { name: 'Recomeçar com outro inicial' }).click()
  await page.getByRole('button', { name: 'Sim, recomeçar' }).click()
  await page.getByRole('button', { name: 'Escolher Brasa' }).click()
  const seedBase2 = await page.evaluate(() => window.__galope.state.seedBase)
  if (seedBase1 === seedBase2) problems.push('seedBase repetiu depois de recomeçar')

  // sem Ouro: oferece treino gratuito
  await page.evaluate(() => { window.__galope.state.gold = 20 })
  // a aba Correr, aberta sem Ouro para a menor entrada, oferece o treino (as entradas ficam desabilitadas)
  await page.locator('[data-acao="aba"][data-id="correr"]').click()
  await page.waitForSelector('#t-correr')
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
  const mig = await old.evaluate(() => {
    const s = window.__galope.state
    return {
      ok: s.mounts.length === 1 && s.mounts[0].templateId === 'mare' && JSON.stringify(s.mounts[0].skills) === '["mare-alta"]' && s.activeId === 'm1' && s.gold === 777 && s.level === undefined &&
        s.v === 4 && s.items.length === 1 && s.items[0].id === 'sela-comum' && s.mounts[0].equip.sela === null && s.pedras === 0 &&
        s.inventory === undefined && s.equipped === undefined,
      tactic: s.tactic, save: JSON.stringify(s)
    }
  })
  if (!mig.ok || mig.tactic !== undefined) problems.push('save antigo não migrou: ' + mig.save)
  await oldCtx.close()

  // save v2 (um inicial com nível, XP e skills na raiz) vira v3 com mounts[0]
  const v2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const v2 = await v2Ctx.newPage()
  v2.on('console', (m) => { if (m.type() === 'error') problems.push(`[save-v2] console: ${m.text()}`) })
  v2.on('pageerror', (e) => problems.push(`[save-v2] pageerror: ${e.message}`))
  const V2_SAVE = '{"v":2,"rev":2,"starterId":"brasa","level":7,"xp":40,"gold":321,"inventory":["sela-couro"],"equipped":"sela-couro","skills":["labareda","sprint"],"tier":100,"seedBase":77,"raceCounter":3,"pending":null,"races":3,"wins":1,"podiums":2,"goldWon":150}'
  await v2.addInitScript((raw) => { window.localStorage.setItem('galope-elemental:v1', raw) }, V2_SAVE)
  await v2.goto(URL, { waitUntil: 'domcontentloaded' })
  await v2.waitForSelector('#t-estabulo')
  const migV2 = await v2.evaluate(() => {
    const s = window.__galope.state, m = s.mounts[0]
    return {
      ok: m.templateId === 'brasa' && m.level === 7 && m.xp === 40 && JSON.stringify(m.skills) === '["labareda","sprint"]' &&
        s.items.length === 1 && s.mounts[0].equip.sela === s.items[0].uid && s.equipped === undefined && s.gold === 321 && s.tier === 100,
      save: JSON.stringify(s)
    }
  })
  if (!migV2.ok) problems.push('save v2 não migrou: ' + migV2.save)
  await v2Ctx.close()

  // save v3 corrompido: montaria inválida descartada, activeId/vagas/nextUid corrigidos, Ouro preservado
  const badCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const bad = await badCtx.newPage()
  bad.on('console', (m) => { if (m.type() === 'error') problems.push(`[save-v3-corrompido] console: ${m.text()}`) })
  bad.on('pageerror', (e) => problems.push(`[save-v3-corrompido] pageerror: ${e.message}`))
  const BAD_V3 = '{"v":3,"rev":1,"gold":555,"inventory":[],"equipped":null,"tier":50,"seedBase":9,"raceCounter":0,"pending":null,"races":0,"wins":0,"podiums":0,"goldWon":0,"mounts":[{"uid":"m1","templateId":"brasa","name":"Ok","element":"fogo","rarity":"raro","grau":2,"sex":"m","level":3,"xp":0,"skills":["labareda"],"base":{"vel":64,"acel":62,"man":60,"forca":52,"est":58,"garra":62,"sorte":50},"potential":{"vel":1,"acel":1,"man":1,"forca":1,"est":1,"garra":1,"sorte":1},"palette":null,"breedLeft":2,"parents":null,"born":0},{"uid":"m2","templateId":null,"name":"Quebrado","element":"fogo","rarity":"xxx","grau":9,"sex":"m","level":1,"xp":0,"skills":[],"base":{},"potential":{},"palette":null,"breedLeft":2,"parents":null,"born":0}],"activeId":"m9","nextUid":1,"stableSlots":1,"breedCounter":0}'
  await bad.addInitScript((raw) => { window.localStorage.setItem('galope-elemental:v1', raw) }, BAD_V3)
  await bad.goto(URL, { waitUntil: 'domcontentloaded' })
  await bad.waitForSelector('#t-estabulo')
  const migBad = await bad.evaluate(() => {
    const s = window.__galope.state
    return { ok: s.mounts.length === 1 && s.activeId === 'm1' && s.gold === 555 && s.stableSlots === 3 && s.nextUid >= 2, save: JSON.stringify(s) }
  })
  if (!migBad.ok) problems.push('save v3 corrompido não foi saneado: ' + migBad.save)
  await badCtx.close()

  // fixtures de equipamento: v3 completo (todos os itens antigos) e v4 corrompido
  const openSave = async (label, raw) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const pg = await ctx.newPage()
    pg.on('console', (m) => { if (m.type() === 'error') problems.push(`[${label}] console: ${m.text()}`) })
    pg.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`))
    await pg.addInitScript((r) => { window.localStorage.setItem('galope-elemental:v1', r) }, raw)
    await pg.goto(URL, { waitUntil: 'domcontentloaded' })
    await pg.waitForSelector('#t-estabulo')
    const st = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    await ctx.close()
    return st
  }
  const BAD_V3_OBJ = JSON.parse(BAD_V3)
  const M1 = BAD_V3_OBJ.mounts[0]
  const V3_FULL = JSON.stringify(Object.assign({}, BAD_V3_OBJ, {
    gold: 999, mounts: [M1], activeId: 'm1', nextUid: 2,
    inventory: ['ferradura-leve', 'ferradura-cravos', 'sela-couro', 'manta-la', 'antolhos', 'rapadura-engenho', 'esporas-prata', 'capa-impermeavel', 'figa-sorte', 'penas-gaviao'],
    equipped: 'capa-impermeavel'
  }))
  {
    const s = await openSave('save-v3-completo', V3_FULL)
    const arm = s.items.filter((it) => it.id === 'armadura-magico')[0]
    const ok = s.v === 4 && s.items.length === 9 && s.pedras === 3 && arm && s.mounts[0].equip.armadura === arm.uid &&
      s.gold === 999 && s.nextItemUid === 10 && s.inventory === undefined && s.equipped === undefined
    if (!ok) problems.push('save v3 completo não migrou os itens: ' + JSON.stringify({ items: s.items, equip: s.mounts[0] && s.mounts[0].equip, pedras: s.pedras, gold: s.gold, nextItemUid: s.nextItemUid }))
  }
  const BAD_V4 = JSON.stringify(Object.assign({}, BAD_V3_OBJ, {
    v: 4, gold: 444, inventory: undefined, equipped: undefined,
    items: [{ uid: 'i1', id: 'sela-comum', plus: 3 }, { uid: 'i1', id: 'sela-magico', plus: 0 }, { uid: 'i2', id: 'ferraduras-comum', plus: 99 },
      { uid: 'i3', id: 'estribos-magico', plus: 1 }, { uid: 'zz', id: 'sela-comum', plus: 0 }, { uid: 'i4', id: 'nada', plus: 0 }],
    mounts: [Object.assign({}, M1, { uid: 'm1', equip: { ferraduras: 'i1', sela: 'i1', estribos: 'i3' } }), Object.assign({}, M1, { uid: 'm2', name: 'Dois', equip: { estribos: 'i3' } })],
    activeId: 'm1', nextUid: 3, pedras: -5, enhanceCounter: 'x'
  }))
  {
    const s = await openSave('save-v4-corrompido', BAD_V4)
    const m1 = s.mounts[0] || {}, m2 = s.mounts[1] || {}
    const ok = JSON.stringify(s.items) === JSON.stringify([{ uid: 'i1', id: 'sela-comum', plus: 3 }, { uid: 'i3', id: 'estribos-magico', plus: 1 }]) &&
      s.mounts.length === 2 && m1.equip.ferraduras === null && m1.equip.sela === 'i1' && m1.equip.estribos === 'i3' && m2.equip.estribos === null &&
      s.pedras === 0 && s.enhanceCounter === 0 && s.nextItemUid === 4 && s.gold === 444
    if (!ok) problems.push('save v4 corrompido não foi saneado: ' + JSON.stringify({ items: s.items, e1: m1.equip, e2: m2.equip, pedras: s.pedras, enh: s.enhanceCounter, next: s.nextItemUid, gold: s.gold }))
  }

  // ---------------- cruzamento (haras): aluguel, determinismo ponta a ponta, bloqueios e Troca ----------------
  {
    const cz = await newPage(browser, { width: 390, height: 844 }, 'cruzamento', { query: '?dev=1' })
    const avisos = async () => (await cz.locator('.aviso').allTextContents()).join(' | ')
    const rerender = async () => { await cz.locator('[data-acao="aba"][data-id="correr"]').click(); await cz.locator('[data-acao="tier"][data-id="50"]').first().click() }
    await cz.getByRole('button', { name: 'Escolher Brasa' }).click()
    await cz.waitForSelector('#t-estabulo')
    if ((await cz.locator('.dev-painel').count()) !== 1) problems.push('cruzamento: painel dev ausente com ?dev=1')
    await cz.locator('[data-acao="dev-niveis"]').click()
    const lvDev = await cz.evaluate(() => window.__galope.state.mounts[0].level)
    if (lvDev !== 11) problems.push('cruzamento: dev-niveis deixou nível ' + lvDev + ' (esperado 11)')
    const m1 = await cz.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state.mounts[0])))
    const faisca = G.WILD_HORSES.find((h) => h.id === 'w-faisca')
    let SEED = 0
    for (let sd = 1; sd <= 300; sd++) {
      if (B.foal({ f: faisca, m: m1, seedBase: sd, breedCounter: 0, nextUid: 2 }).sex === 'f') { SEED = sd; break }
    }
    if (!SEED) problems.push('cruzamento: nenhuma seed 1..300 gera potro fêmea')
    const esperado = B.foal({ f: faisca, m: m1, seedBase: SEED, breedCounter: 0, nextUid: 2 })
    notes.cruzamento = { SEED, potro: { name: esperado.name, rarity: esperado.rarity, grau: esperado.grau, element: esperado.element, sex: esperado.sex, skills: esperado.skills } }
    await cz.evaluate((seed) => { const s = window.__galope.state; s.gold = 5000; s.seedBase = seed }, SEED)
    await rerender()
    await cz.locator('[data-acao="aba"][data-id="haras"]').click()
    await cz.waitForSelector('#t-haras')
    await cz.locator('[data-acao="haras-partner"][data-kind="rent"][data-id="w-faisca"]').click()
    const calcTxt = await cz.locator('.calc').textContent()
    if (!/125/.test(calcTxt)) problems.push('cruzamento: calculadora sem o preço 125: ' + calcTxt)
    await cz.locator('[data-acao="cruzar"]').click()
    const c1 = await cz.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    if (c1.gold !== 4875) problems.push('cruzamento: ouro ' + c1.gold + ' (esperado 4875)')
    if (c1.mounts.length !== 2) problems.push('cruzamento: ' + c1.mounts.length + ' montarias (esperado 2)')
    if (c1.breedCounter !== 1) problems.push('cruzamento: breedCounter ' + c1.breedCounter)
    if (c1.mounts[0].breedLeft !== 1) problems.push('cruzamento: breedLeft de Brasa ' + c1.mounts[0].breedLeft)
    // o potro entra no estábulo com o equipamento vazio (Breed.foal não sabe de equipamento)
    if (c1.mounts.length > 1 && JSON.stringify(c1.mounts[1]) !== JSON.stringify(Object.assign({}, esperado, { equip: GR.emptyEquip() }))) {
      problems.push('cruzamento: potro diferente do calculado no Node\n  jogo: ' + JSON.stringify(c1.mounts[1]) + '\n  node: ' + JSON.stringify(esperado))
    }
    if (!/Nasceu/.test(await cz.locator('#tela').textContent())) problems.push('cruzamento: resultado sem "Nasceu"')
    if (await cz.locator('.montaria .montaria-acoes').count()) problems.push('cruzamento: card do potro no resultado com ativar/renomear/liberar')
    await cz.locator('[data-acao="haras-ativar"]').click()
    if ((await cz.evaluate(() => window.__galope.state.activeId)) !== 'm2') problems.push('cruzamento: haras-ativar não ativou m2')
    // o potro corre
    await cz.locator('[data-acao="aba"][data-id="correr"]').click()
    await cz.waitForSelector('#t-correr')
    await cz.getByRole('button', { name: 'Procurar corrida' }).click()
    await cz.waitForSelector('#t-largada')
    await cz.getByRole('button', { name: /^Largar/ }).click()
    await cz.waitForSelector('#pista')
    await cz.getByRole('button', { name: /Pular/ }).click()
    await cz.waitForSelector('#t-resultado')
    const racedUid = await cz.evaluate(() => { const L = window.__galope.ui.lobby; return L.racers[L.playerIdx].horse.uid })
    if (racedUid !== 'm2') problems.push('cruzamento: quem correu foi ' + racedUid + ' (esperado m2)')
    await cz.getByRole('button', { name: /^Voltar/ }).click()
    await cz.waitForSelector('#t-correr')
    // estábulo cheio
    await cz.evaluate(() => { const s = window.__galope.state; s.stableSlots = s.mounts.length })
    await rerender()
    await cz.locator('[data-acao="aba"][data-id="haras"]').click()
    await cz.waitForSelector('#t-haras')
    await cz.locator('[data-acao="haras-mine"][data-id="m1"]').click()
    await cz.locator('[data-acao="haras-partner"][data-kind="rent"][data-id="w-faisca"]').click()
    if (!(await cz.locator('[data-acao="cruzar"]').isDisabled())) problems.push('cruzamento: cruzar habilitado com o estábulo cheio')
    if (!/cheio/.test(await avisos())) problems.push('cruzamento: sem aviso de estábulo cheio: ' + await avisos())
    await cz.evaluate(() => { window.__galope.state.stableSlots = 3 })
    // páreo aberto bloqueia
    await cz.locator('[data-acao="aba"][data-id="correr"]').click()
    await cz.waitForSelector('#t-correr')
    await cz.getByRole('button', { name: 'Procurar corrida' }).click()
    await cz.waitForSelector('#t-largada')
    await cz.getByRole('button', { name: /^Voltar/ }).click()
    await cz.waitForSelector('#t-correr')
    await cz.locator('[data-acao="aba"][data-id="estabulo"]').click()
    await cz.waitForSelector('#t-estabulo')
    if (!(await cz.locator('.montaria:not(.montaria--ativa) [data-acao="ativar"]').first().isDisabled())) problems.push('cruzamento: ativar habilitado com páreo aberto')
    await cz.locator('[data-acao="aba"][data-id="haras"]').click()
    await cz.waitForSelector('#t-haras')
    await cz.locator('[data-acao="haras-mine"][data-id="m1"]').click()
    await cz.locator('[data-acao="haras-partner"][data-kind="rent"][data-id="w-faisca"]').click()
    if (!(await cz.locator('[data-acao="cruzar"]').isDisabled())) problems.push('cruzamento: cruzar habilitado com páreo aberto')
    if (!/páreo/.test(await avisos())) problems.push('cruzamento: sem aviso de páreo aberto: ' + await avisos())
    await cz.locator('[data-acao="aba"][data-id="correr"]').click()
    await cz.waitForSelector('#t-correr')
    await cz.getByRole('button', { name: /Voltar à sala/ }).click()
    await cz.waitForSelector('#t-largada')
    await cz.getByRole('button', { name: /^Largar/ }).click()
    await cz.waitForSelector('#pista')
    await cz.getByRole('button', { name: /Pular/ }).click()
    await cz.waitForSelector('#t-resultado')
    await cz.getByRole('button', { name: /^Voltar/ }).click()
    await cz.waitForSelector('#t-correr')
    // cruzamento próprio: Brasa (m1, ♂, 1 cruza) × potro (m2, ♀, 1 cruza), registro
    await cz.locator('[data-acao="aba"][data-id="haras"]').click()
    await cz.waitForSelector('#t-haras')
    await cz.locator('[data-acao="haras-mode"][data-id="cruzar"]').click()
    await cz.locator('[data-acao="haras-mine"][data-id="m1"]').click()
    await cz.locator('[data-acao="haras-tab"][data-id="minhas"]').click()
    await cz.locator('[data-acao="haras-partner"][data-kind="own"][data-id="m2"]').click()
    const goldBeforeOwn = await cz.evaluate(() => window.__galope.state.gold)
    await cz.locator('[data-acao="cruzar"]').click()
    const own = await cz.evaluate(() => {
      const s = window.__galope.state, by = (u) => s.mounts.filter((m) => m.uid === u)[0]
      return { gold: s.gold, n: s.mounts.length, m1: by('m1') && by('m1').breedLeft, m2: by('m2') && by('m2').breedLeft, counter: s.breedCounter, novo: s.mounts[s.mounts.length - 1].uid }
    })
    if (own.gold !== goldBeforeOwn - G.ECONOMY.breeding.ownRegistration || own.n !== 3 || own.m1 !== 0 || own.m2 !== 0 || own.counter !== 2 || own.novo !== 'm3') {
      problems.push('cruzamento próprio: ' + JSON.stringify(own) + ' (ouro antes ' + goldBeforeOwn + ')')
    }
    notes.cruzamentoProprio = own
    await cz.locator('[data-acao="haras-denovo"]').click()
    // Troca: Brasa (m1, ♂, 0 cruzas) × potro (m2, ♀, 0 cruzas) — a Troca ignora as cruzas
    await cz.locator('[data-acao="haras-mode"][data-id="troca"]').click()
    await cz.locator('[data-acao="haras-mine"][data-id="m1"]').click()
    if (await cz.locator('[data-acao="haras-tab"][data-id="aluguel"]').count()) problems.push('troca: aba Aluguel visível no modo Troca')
    await cz.locator('[data-acao="haras-partner"][data-kind="own"][data-id="m2"]').click()
    await cz.locator('[data-acao="troca"]').click()
    if (!/deixam de existir/.test(await cz.locator('#tela').textContent())) problems.push('troca: sem a confirmação "deixam de existir"')
    const goldBeforeTroca = await cz.evaluate(() => window.__galope.state.gold)
    await cz.locator('[data-acao="troca-sim"]').click()
    const tr = await cz.evaluate(() => { const s = window.__galope.state; return { n: s.mounts.length, uids: s.mounts.map((m) => m.uid).join(','), active: s.activeId, gold: s.gold } })
    if (tr.n !== 2 || tr.uids !== 'm3,m4' || tr.active !== 'm4' || tr.gold !== goldBeforeTroca - G.ECONOMY.breeding.exchange) problems.push('troca: ' + JSON.stringify(tr) + ' (ouro antes ' + goldBeforeTroca + ')')
    notes.troca = tr
    // persistência
    await cz.reload({ waitUntil: 'domcontentloaded' })
    await cz.waitForSelector('#t-estabulo')
    const per = await cz.evaluate(() => ({ n: window.__galope.state.mounts.length, active: window.__galope.state.activeId }))
    if (per.n !== 2 || per.active !== 'm4') problems.push('troca: não persistiu ' + JSON.stringify(per))
    // captura do haras com a calculadora
    await cz.locator('[data-acao="aba"][data-id="haras"]').click()
    await cz.waitForSelector('#t-haras')
    const capim = cz.locator('[data-acao="haras-partner"][data-kind="rent"][data-id="w-capim"]')
    if (await capim.count()) await capim.click()
    else await cz.locator('[data-acao="haras-partner"][data-kind="rent"]').first().click()
    if (!(await cz.locator('.calc').count())) problems.push('haras: sem calculadora para a captura')
    await cz.evaluate(() => document.getElementById('t-parceiro').scrollIntoView({ block: 'start' }))
    await sleep(400)
    await checkOverflow(cz, 'haras')
    await cz.screenshot({ path: join(SHOTS, 'final-06-haras.png') })
    await cz.context().close()
  }

  // ---------------- menu de abas: casca, foco, aria-current e histórico ----------------
  {
    const mn = await newPage(browser, { width: 390, height: 844 }, 'menu')
    try {
      await mn.getByRole('button', { name: 'Escolher Brasa' }).click()
      await mn.waitForSelector('#t-estabulo')
      // 1. as 5 abas abrem e focam o h1 certo
      for (const [id, h1] of [['correr', 't-correr'], ['expedicao', 't-expedicao'], ['haras', 't-haras'], ['loja', 't-loja'], ['estabulo', 't-estabulo']]) {
        await mn.locator(`[data-acao="aba"][data-id="${id}"]`).click()
        await mn.waitForSelector('#' + h1)
        const focused = await mn.evaluate(() => document.activeElement && document.activeElement.id)
        if (focused !== h1) problems.push(`menu: foco em ${focused} ao abrir ${id} (esperado ${h1})`)
        const current = await mn.locator('[data-acao="aba"][aria-current="page"]').getAttribute('data-id')
        if (current !== id) problems.push(`menu: aria-current em ${current} (esperado ${id})`)
      }
      // 2. trocar de aba não empilha histórico
      const len0 = await mn.evaluate(() => history.length)
      for (let i = 0; i < 10; i++) await mn.locator(`[data-acao="aba"][data-id="${['correr', 'haras', 'loja', 'estabulo', 'expedicao'][i % 5]}"]`).click()
      const len1 = await mn.evaluate(() => history.length)
      if (len1 !== len0) problems.push(`menu: history.length ${len0} -> ${len1} ao trocar de aba`)
      // 3. cabeçalho e barra presentes nas abas, ausentes na corrida
      if ((await mn.locator('.app-topo').count()) !== 1 || (await mn.locator('.app-abas').count()) !== 1) problems.push('menu: casca ausente numa aba')
      await mn.locator('[data-acao="aba"][data-id="correr"]').click()
      await mn.getByRole('button', { name: 'Procurar corrida' }).click()
      await mn.waitForSelector('#t-largada')
      if ((await mn.locator('.app-abas').count()) !== 0) problems.push('menu: barra visível na largada')
      await mn.getByRole('button', { name: /^Largar/ }).click()
      await mn.waitForSelector('#pista')
      if ((await mn.locator('.app-topo').count()) !== 0 || (await mn.locator('.app-abas').count()) !== 0) problems.push('menu: casca visível na corrida')
      await mn.getByRole('button', { name: /Pular|Ver resultado/ }).click()
      await mn.waitForSelector('#t-resultado')
      await checkOverflow(mn, 'menu-390')
      await mn.getByRole('button', { name: /^Voltar/ }).click()
      await mn.waitForSelector('#t-correr')
      // 4. ponto na aba Correr com páreo aberto; Voltar da largada volta à aba Correr com a mesma sala
      await mn.locator('[data-acao="aba"][data-id="correr"]').click()
      await mn.getByRole('button', { name: 'Procurar corrida' }).click()
      await mn.waitForSelector('#t-largada')
      const counter0 = await mn.evaluate(() => window.__galope.state.pending.counter)
      await mn.goBack()
      await mn.waitForSelector('#t-correr')
      if ((await mn.locator('.app-aba--ponto[data-id="correr"]').count()) !== 1) problems.push('menu: sem ponto na aba Correr com páreo aberto')
      const counter1 = await mn.evaluate(() => window.__galope.state.pending && window.__galope.state.pending.counter)
      if (counter1 !== counter0) problems.push(`menu: sala re-sorteada ao voltar (${counter0} -> ${counter1})`)
      // 5. recarregar com páreo aberto: abre no Estábulo, Correr mostra o ponto e "Voltar à sala"
      await mn.reload(); await mn.waitForSelector('#t-estabulo')
      if ((await mn.locator('.app-aba--ponto[data-id="correr"]').count()) !== 1) problems.push('menu: ponto sumiu após reload')
      await mn.locator('[data-acao="aba"][data-id="correr"]').click()
      if (!(await mn.getByRole('button', { name: 'Voltar à sala de largada' }).count())) problems.push('menu: Correr sem "Voltar à sala" com páreo aberto')
      // 6. estábulo só lista: sem "Preparar corrida", sem selvagens, sem estatísticas
      await mn.locator('[data-acao="aba"][data-id="estabulo"]').click()
      const estTxt = await mn.locator('#tela').textContent()
      if (/Preparar corrida|Cavalos selvagens|Recomeçar/.test(estTxt)) problems.push('menu: estábulo ainda tem conteúdo das outras abas')
      if ((await mn.locator('button[data-acao="montaria"][data-id="m1"]').count()) !== 1) problems.push('menu: cartão sem "Ver"')
      // 7. expedição mostra a vitrine dos selvagens
      await mn.locator('[data-acao="aba"][data-id="expedicao"]').click()
      if ((await mn.locator('.selvagem').count()) < 3) problems.push('menu: expedição sem selvagens')
      // 8. tela da Montaria: 3 sub-abas, Renomear e Liberar
      await mn.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await mn.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await mn.waitForSelector('#t-montaria')
      for (const aba of ['skills', 'equip', 'status']) {
        await mn.locator(`[data-acao="montaria-aba"][data-id="${aba}"]`).click()
        if ((await mn.locator(`[data-acao="montaria-aba"][data-id="${aba}"][aria-pressed="true"]`).count()) !== 1) problems.push('menu: sub-aba ' + aba + ' não ativou')
      }
      if ((await mn.locator('.slots').count()) < 1) problems.push('menu: sub-aba status sem resumo do equipamento')   // o cabeçalho da montaria traz gearSummaryHtml
      await mn.evaluate(() => { window.prompt = () => 'Trovão' })   // renomear usa window.prompt, como o teste principal já faz
      await mn.locator('[data-acao="renomear"][data-id="m1"]').click()
      if ((await mn.evaluate(() => window.__galope.state.mounts[0].name)) !== 'Trovão') problems.push('menu: renomear na Montaria não aplicou')
      if (!/Trovão/.test(await mn.locator('#t-montaria').textContent())) problems.push('menu: h1 da Montaria não mostra o nome novo')
      // Liberar desabilitado na ativa/única
      if (!(await mn.locator('[data-acao="liberar"][data-id="m1"]').isDisabled())) problems.push('menu: Liberar habilitado na única montaria')
    } catch (e) {
      problems.push('menu: ' + e.message)
    }
    await mn.context().close()
  }

  // ---------------- equipamento: dev, equipar/tirar, melhorar determinístico, venda com desfazer e trava ----------------
  {
    const eq = await newPage(browser, { width: 390, height: 844 }, 'equipamento', { query: '?dev=1' })
    try {
      const st = () => eq.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      const txt = async () => (await eq.locator('#tela').textContent()) || ''
      const itemOf = (s, uid) => s.items.find((it) => it.uid === uid)
      // 1. inicial com o equipamento de partida
      await eq.getByRole('button', { name: 'Escolher Brasa' }).click()
      await eq.waitForSelector('#t-estabulo')
      let s = await st()
      if (s.items.length !== 2 || s.mounts[0].equip.sela !== 'i1' || s.mounts[0].equip.ferraduras !== 'i2' || s.pedras !== 0) {
        problems.push('equipamento: estado inicial ' + JSON.stringify({ items: s.items, equip: s.mounts[0].equip, pedras: s.pedras }))
      }
      // 2. painel dev: pedras e conjunto Lendário do Sol (Brasa é Fogo)
      await eq.locator('[data-acao="dev-pedras"]').click()
      if ((await st()).pedras !== 5) problems.push('equipamento: dev-pedras não deu 5 pedras')
      await eq.locator('[data-acao="dev-set"]').click()
      s = await st()
      if (s.items.length !== 7) problems.push('equipamento: dev-set deixou ' + s.items.length + ' peças (esperado 7)')
      const ids = GR.SLOTS.map((sl) => { const it = itemOf(s, s.mounts[0].equip[sl]); return it ? it.id : null })
      GR.SLOTS.forEach((sl, k) => { if (ids[k] !== sl + '-sol-lendario') problems.push('equipamento: dev-set ' + sl + ' = ' + ids[k]) })
      const L = s.mounts[0].equip.sela
      // 3. tela da Montaria (pelo "Ver" do cartão do Estábulo), sub-aba Equipamento
      await eq.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await eq.waitForSelector('#t-montaria', { timeout: 5000 })
      await eq.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      if (!/Sol ×5/.test(await txt())) problems.push('equipamento: tela sem "Sol ×5"')
      // 4. tirar a sela
      await eq.locator('[data-acao="equip-slot"][data-id="sela"]').click()
      await eq.locator('[data-acao="tirar"][data-id="sela"]').click()
      s = await st()
      if (s.mounts[0].equip.sela !== null) problems.push('equipamento: tirar deixou sela ' + s.mounts[0].equip.sela)
      if (!/Sol ×4/.test(await txt())) problems.push('equipamento: tela sem "Sol ×4" depois de tirar')
      // 5. equipar a sela comum de volta; a Lendária fica no inventário
      await eq.locator('[data-acao="equipar"][data-id="i1"]').click()
      s = await st()
      if (s.mounts[0].equip.sela !== 'i1') problems.push('equipamento: equipar i1 deixou sela ' + s.mounts[0].equip.sela)
      if (!itemOf(s, L)) problems.push('equipamento: a sela Lendária ' + L + ' sumiu do inventário')
      // 6. melhorar i1 três vezes, conferindo cada sorteio com o Node
      const seedBase = s.seedBase
      let plus = itemOf(s, 'i1').plus, gastas = 0
      const seq = [plus]
      for (let k = 0; k < 3; k++) {
        const odds = GR.enhanceOdds(plus)
        const r = GR.enhance({ uid: 'i1', id: 'sela-comum', plus }, seedBase, k)
        await eq.locator('[data-acao="melhorar"][data-id="i1"]').click()
        await eq.locator('[data-acao="melhorar-sim"][data-id="i1"]').click()
        plus = r.plus; gastas += odds.cost; seq.push(plus)
        s = await st()
        if (itemOf(s, 'i1').plus !== plus || s.pedras !== 5 - gastas || s.enhanceCounter !== k + 1) {
          problems.push('equipamento: melhoria ' + k + ' jogo ' + JSON.stringify({ plus: itemOf(s, 'i1').plus, pedras: s.pedras, counter: s.enhanceCounter }) + ' node ' + JSON.stringify({ plus, pedras: 5 - gastas, counter: k + 1 }))
        }
      }
      if (s.enhanceCounter !== 3) problems.push('equipamento: enhanceCounter ' + s.enhanceCounter)
      if (!/Sucesso|Falhou/.test(await txt())) problems.push('equipamento: sem mensagem de Sucesso/Falhou')
      notes.equipamento = { seedBase, plusSeq: seq, pedras: s.pedras }
      // 7. vender a Lendária e desfazer; sair limpa o desfazer
      const gold0 = s.gold
      await eq.locator(`[data-acao="vender"][data-id="${L}"]`).click()
      s = await st()
      if (s.gold !== gold0 + 375 || s.items.length !== 6) problems.push('equipamento: venda ' + JSON.stringify({ gold: s.gold, gold0, n: s.items.length }))
      await eq.locator('[data-acao="vender-desfazer"]').click()
      s = await st()
      if (s.gold !== gold0 || s.items.length !== 7 || !itemOf(s, L)) problems.push('equipamento: desfazer ' + JSON.stringify({ gold: s.gold, gold0, n: s.items.length }))
      // 7c. vender de novo e desfazer uma vez; um segundo clique forçado não pode desfazer de novo
      await eq.locator('[data-acao="vender"][data-id="' + L + '"]').click()
      s = await st()
      if (s.gold !== gold0 + 375 || s.items.length !== 6) problems.push('equipamento: 2ª venda ' + JSON.stringify({ gold: s.gold, gold0, n: s.items.length }))
      await eq.locator('[data-acao="vender-desfazer"]').click()
      s = await st()
      if (s.gold !== gold0 || s.items.length !== 7 || !itemOf(s, L)) problems.push('equipamento: 2º desfazer ' + JSON.stringify({ gold: s.gold, gold0, n: s.items.length }))
      if (await eq.locator('[data-acao="vender-desfazer"]').count() !== 0) problems.push('equipamento: "Desfazer venda" continua depois de usado')
      await eq.evaluate(() => { const b = document.querySelector('[data-acao="vender-desfazer"]'); if (b) { b.disabled = false; b.click() } })
      s = await st()
      if (s.gold !== gold0 || s.items.length !== 7) problems.push('equipamento: desfazer usado duas vezes ' + JSON.stringify({ gold: s.gold, gold0, n: s.items.length }))
      // 8. persistência
      const antes = await st()
      await eq.reload({ waitUntil: 'domcontentloaded' })
      await eq.waitForSelector('#t-estabulo')
      s = await st()
      if (JSON.stringify(s.mounts[0].equip) !== JSON.stringify(antes.mounts[0].equip) || itemOf(s, 'i1').plus !== itemOf(antes, 'i1').plus || s.items.length !== 7) {
        problems.push('equipamento: não persistiu ' + JSON.stringify({ equip: s.mounts[0].equip, plus: itemOf(s, 'i1').plus }))
      }
      // 9. trava parcial com páreo aberto
      await eq.locator('[data-acao="aba"][data-id="correr"]').click()
      await eq.waitForSelector('#t-correr')
      await eq.getByRole('button', { name: 'Procurar corrida' }).click()
      await eq.waitForSelector('#t-largada')
      await eq.locator('[data-acao="voltar"]').first().click()
      await eq.waitForSelector('#t-correr')
      await eq.locator('[data-acao="equipar-tela"][data-id="m1"]').click()   // "Equipar" da aba Correr
      await eq.waitForSelector('#t-montaria')
      if ((await eq.locator('[data-acao="montaria-aba"][data-id="equip"][aria-pressed="true"]').count()) !== 1) problems.push('equipamento: "Equipar" da aba Correr não abriu a sub-aba Equipamento')
      await eq.locator('[data-acao="equip-slot"][data-id="sela"]').click()
      const pr = await eq.evaluate(() => window.__galope.state.pending && window.__galope.state.pending.pr)
      if (!(await eq.locator(`[data-acao="equipar"][data-id="${L}"]`).isDisabled())) problems.push('equipamento: equipar a Lendária habilitado com páreo aberto')
      if (!/Páreo aberto/.test(await txt())) problems.push('equipamento: sem aviso "Páreo aberto"')
      if (!(await eq.locator('[data-acao="melhorar"][data-id="i1"]').isDisabled())) problems.push('equipamento: melhorar peça da ativa habilitado com páreo aberto')
      // clique forçado no handler: equipar a Lendária e melhorar i1 continuam bloqueados
      const travaAntes = await st()
      await eq.evaluate((L) => { const b = document.querySelector('[data-acao="equipar"][data-id="' + L + '"]'); b.disabled = false; b.click() }, L)
      if ((await st()).mounts[0].equip.sela !== 'i1') problems.push('equipamento: clique forçado equipou a Lendária com páreo aberto')
      if (!/Páreo aberto/.test(await txt())) problems.push('equipamento: sem aviso "Páreo aberto" depois do clique forçado')
      await eq.evaluate(() => { const b = document.querySelector('[data-acao="melhorar"][data-id="i1"]'); if (b) { b.disabled = false; b.click() } })
      await eq.evaluate(() => { const b = document.querySelector('[data-acao="melhorar-sim"][data-id="i1"]'); if (b) { b.disabled = false; b.click() } })
      const travaDepois = await st()
      if (travaDepois.enhanceCounter !== travaAntes.enhanceCounter || travaDepois.pedras !== travaAntes.pedras || itemOf(travaDepois, 'i1').plus !== itemOf(travaAntes, 'i1').plus) {
        problems.push('equipamento: clique forçado melhorou i1 com páreo aberto ' + JSON.stringify({ antes: [travaAntes.enhanceCounter, travaAntes.pedras], depois: [travaDepois.enhanceCounter, travaDepois.pedras] }))
      }
      await eq.locator('[data-acao="tirar"][data-id="sela"]').click()
      if ((await st()).mounts[0].equip.sela !== null) problems.push('equipamento: tirar bloqueado com páreo aberto')
      await eq.locator('[data-acao="equipar"][data-id="i1"]').click()
      if ((await st()).mounts[0].equip.sela !== 'i1') problems.push('equipamento: re-equipar i1 bloqueado com páreo aberto')
      const ratingL = S.powerRating(antes.mounts[0], GR.resolve({ equip: Object.assign({}, antes.mounts[0].equip, { sela: L }) }, Object.fromEntries(antes.items.map((it) => [it.uid, it]))))
      notes.equipamentoTrava = { pr, liga: S.leagueFor(pr).name, ratingComLendaria: ratingL, ligaComLendaria: S.leagueFor(ratingL).name }
      // 10. sem rolagem horizontal; captura com o slot aberto
      await sleep(300)
      await checkOverflow(eq, 'equipamento')
      await eq.screenshot({ path: join(SHOTS, 'final-07-equipamento.png') })
      // 11. vender a Lendária pela 3ª vez e sair: a venda fica e o "Desfazer" some
      //     (depois da trava e da captura, que ainda usam a Lendária no inventário)
      const goldAntes3 = (await st()).gold
      await eq.locator('[data-acao="vender"][data-id="' + L + '"]').click()
      s = await st()
      const gold3 = s.gold
      if (gold3 !== goldAntes3 + 375 || s.items.length !== 6) problems.push('equipamento: 3ª venda ' + JSON.stringify({ gold: s.gold, goldAntes3, n: s.items.length }))
      await eq.locator('[data-acao="montaria-voltar"]').click()
      await eq.waitForSelector('#t-correr')   // ui.tab é correr: a Montaria foi aberta pela aba Correr
      await eq.locator('[data-acao="equipar-tela"][data-id="m1"]').click()
      await eq.waitForSelector('#t-montaria')
      if (await eq.locator('[data-acao="vender-desfazer"]').count()) problems.push('equipamento: "Desfazer venda" continua depois de sair da tela')
      s = await st()
      if (s.items.length !== 6 || s.gold !== gold3 || itemOf(s, L)) problems.push('equipamento: venda não ficou depois de sair ' + JSON.stringify({ gold: s.gold, gold3, n: s.items.length }))
      // 12. trocar de aba pela barra também descarta o "Desfazer" (vende as ferraduras comuns, i2)
      await eq.locator('[data-acao="equip-slot"][data-id="ferraduras"]').click()
      await eq.locator('[data-acao="vender"][data-id="i2"]').click()
      if ((await eq.locator('[data-acao="vender-desfazer"]').count()) !== 1) problems.push('equipamento: sem "Desfazer venda" depois de vender i2')
      const n12 = (await st()).items.length
      await eq.locator('[data-acao="aba"][data-id="loja"]').click()
      await eq.waitForSelector('#t-loja')
      await eq.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await eq.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await eq.waitForSelector('#t-montaria')
      await eq.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      if ((await eq.locator('[data-acao="vender-desfazer"]').count()) !== 0) problems.push('equipamento: "Desfazer venda" continua depois de trocar de aba')
      s = await st()
      if (s.items.length !== n12 || itemOf(s, 'i2')) problems.push('equipamento: venda de i2 não ficou depois de trocar de aba ' + JSON.stringify({ n: s.items.length, n12 }))
      notes.equipamentoVenda = { gold0, goldVenda: gold0 + 375, goldAntes3, goldVendida3: gold3, goldFinal: s.gold }
    } catch (e) {
      problems.push('equipamento: ' + e.message)
    }
    await eq.context().close()
  }

  // ---------------- loja: abas, comprar (com recusa sem Ouro), Pedras Negras e resumo na largada ----------------
  {
    const lj = await newPage(browser, { width: 390, height: 844 }, 'loja')
    try {
      const st = () => lj.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      const txt = async () => (await lj.locator('#tela').textContent()) || ''
      // 1. Ipê; abrir a loja; aba inicial ferraduras com 5 produtos; aba sela com os 3 conjuntos
      await lj.getByRole('button', { name: 'Escolher Ipê' }).click()
      await lj.waitForSelector('#t-estabulo')
      await lj.locator('[data-acao="aba"][data-id="loja"]').click()
      await lj.waitForSelector('#t-loja', { timeout: 5000 })
      const nProd = await lj.locator('.produto').count()
      if (nProd !== 5) problems.push('loja: aba inicial com ' + nProd + ' produtos (esperado 5)')
      await lj.locator('[data-acao="loja-tab"][data-id="sela"]').click()
      const t1 = await txt()
      for (const nome of ['Sela do Sol', 'Sela da Chuva', 'Sela da Névoa']) if (!t1.includes(nome)) problems.push('loja: aba sela sem "' + nome + '"')
      // 2. comprar a sela mágica
      await lj.locator('[data-acao="comprar"][data-id="sela-magico"]').click()
      let s = await st()
      const last = s.items[s.items.length - 1]
      if (s.gold !== 250 || s.items.length !== 3 || last.id !== 'sela-magico' || last.plus !== 0 || last.uid !== 'i3') {
        problems.push('loja: compra ' + JSON.stringify({ gold: s.gold, n: s.items.length, last }))
      }
      // 3. sem Ouro: botão desabilitado e o handler recusa mesmo com clique forçado
      if (!(await lj.locator('[data-acao="comprar"][data-id="sela-sol-raro"]').isDisabled())) problems.push('loja: comprar 600 habilitado com 250 de Ouro')
      await lj.evaluate(() => { window.__galope.state.gold = 10 })
      await lj.locator('[data-acao="loja-tab"][data-id="sela"]').click()
      // o botão fica disabled: reabilita no DOM para o clique chegar ao handler, que precisa recusar
      await lj.evaluate(() => { const b = document.querySelector('[data-acao="comprar"][data-id="sela-comum"]'); b.disabled = false; b.click() })
      s = await st()
      if (s.gold !== 10 || s.items.length !== 3) problems.push('loja: compra sem Ouro aceita ' + JSON.stringify({ gold: s.gold, n: s.items.length }))
      // 4. Pedras Negras
      await lj.evaluate(() => { window.__galope.state.gold = 250 })
      await lj.locator('[data-acao="loja-tab"][data-id="pedras"]').click()
      await lj.locator('[data-acao="comprar-pedra"][data-id="5"]').click()
      s = await st()
      if (s.pedras !== 5 || s.gold !== 50) problems.push('loja: pedras ' + JSON.stringify({ pedras: s.pedras, gold: s.gold }))
      if (!(await lj.locator('[data-acao="comprar-pedra"][data-id="5"]').isDisabled())) problems.push('loja: comprar 5 pedras habilitado com 50 de Ouro')
      await lj.evaluate(() => { const b = document.querySelector('[data-acao="comprar-pedra"][data-id="5"]'); b.disabled = false; b.click() })
      s = await st()
      if (s.pedras !== 5 || s.gold !== 50) problems.push('loja: compra de pedras sem Ouro aceita ' + JSON.stringify({ pedras: s.pedras, gold: s.gold }))
      // 5. captura na aba sela; sem rolagem horizontal
      await lj.locator('[data-acao="loja-tab"][data-id="sela"]').click()
      await sleep(300)
      await checkOverflow(lj, 'loja')
      await lj.screenshot({ path: join(SHOTS, 'final-08-loja.png') })
      // 6. equipar a sela comprada e ver o resumo + atalho na largada
      await lj.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await lj.waitForSelector('#t-estabulo')
      await lj.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await lj.waitForSelector('#t-montaria')
      await lj.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      await lj.locator('[data-acao="equip-slot"][data-id="sela"]').click()
      await lj.locator('[data-acao="equipar"][data-id="i3"]').click()
      s = await st()
      if (s.mounts[0].equip.sela !== 'i3') problems.push('loja: equipar i3 deixou sela ' + s.mounts[0].equip.sela)
      await lj.locator('[data-acao="montaria-voltar"]').click()
      await lj.waitForSelector('#t-estabulo')
      await lj.locator('[data-acao="aba"][data-id="correr"]').click()
      await lj.waitForSelector('#t-correr')
      await lj.getByRole('button', { name: 'Procurar corrida' }).click()
      await lj.waitForSelector('#t-largada')
      const cheios = await lj.locator('#tela .slots .slot--cheio').count()
      if (cheios !== 2) problems.push('loja: largada com ' + cheios + ' slots cheios (esperado 2)')
      const atalho = lj.locator('#tela [data-acao="equipar-tela"]')
      if ((await atalho.count()) !== 1) problems.push('loja: largada sem o atalho Equipar')
      else {
        await atalho.click()
        await lj.waitForSelector('#t-montaria')
        if ((await lj.locator('[data-acao="montaria-aba"][data-id="equip"][aria-pressed="true"]').count()) !== 1) problems.push('loja: atalho da largada não abriu a sub-aba Equipamento')
        if (!/Páreo aberto/.test(await txt())) problems.push('loja: Equipamento aberto da largada sem "Páreo aberto"')
      }
    } catch (e) {
      problems.push('loja: ' + e.message)
    }
    await lj.context().close()
  }

  // ---------------- desktop 1280x800 ----------------
  const desk = await newPage(browser, { width: 1280, height: 800 }, 'desktop')
  await desk.waitForSelector('.inicial')
  await sleep(300)
  await checkOverflow(desk, 'desktop-inicial')
  await desk.getByRole('button', { name: 'Escolher Maré' }).click()
  await desk.locator('[data-acao="aba"][data-id="correr"]').click()
  await desk.waitForSelector('#t-correr')
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
    await p.locator('[data-acao="aba"][data-id="correr"]').click()
    await p.waitForSelector('#t-correr')
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
  await rm.locator('[data-acao="aba"][data-id="correr"]').click()
  await rm.waitForSelector('#t-correr')
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
