// Teste de fluxo completo da interface com Playwright (sem instalar nada).
//   node build.mjs && node tools/ui-test.mjs
// Gera as capturas finais em prototype/screens/final-*.png (ou em $SHOTS_DIR) (deviceScaleFactor 2) e falha se houver
// erro de console, rolagem horizontal, cavalo do jogador fora da tela, sala re-sorteada de graça,
// resultado calculado antes de pagar, a tela de corrida não couber na altura da janela, o Dado da Sorte
// não aparecer na pista (plaquinhas, faixa, câmera lenta e "Pular" no meio dela), a chuva congelar com
// movimento reduzido, a natureza custar demais por quadro ou um save antigo perder a opção "Animações".
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const G = require('../src/data.js')
const S = require('../src/sim.js')
const B = require('../src/breed.js')
const GR = require('../src/gear.js')
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// prototype/dist/ servido por http://127.0.0.1:<porta livre> (node:http, sem dependências; fecha no fim): em
// file:// o localStorage deste Chromium às vezes some num reload e o check.sh falhava de vez em quando
const DIST = join(ROOT, 'dist')
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json' }
const servidor = createServer(async (req, res) => {
  try {
    const caminho = decodeURIComponent(new globalThis.URL(req.url, 'http://127.0.0.1').pathname)
    if (caminho === '/favicon.ico') { res.writeHead(204); res.end(); return }   // o navegador pede sozinho
    // producao.html: o jogo.html (fragmento sem doctype, como o artefato o recebe) num documento mínimo
    if (caminho === '/producao.html') {
      const frag = await readFile(join(DIST, 'jogo.html'), 'utf8')
      res.writeHead(200, { 'Content-Type': TIPOS['.html'], 'Cache-Control': 'no-store' })
      res.end('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' + frag + '</body></html>\n')
      return
    }
    const arq = resolve(DIST, '.' + caminho)
    if (req.method !== 'GET' || !arq.startsWith(DIST + sep)) throw new Error('fora de dist/')
    const corpo = await readFile(arq)
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    res.end(corpo)
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('não encontrado')
  }
})
await new Promise((ok, falha) => { servidor.once('error', falha); servidor.listen(0, '127.0.0.1', ok) })
const BASE = `http://127.0.0.1:${servidor.address().port}/`
const URL = BASE + 'preview.html'
const SHOTS = process.env.SHOTS_DIR || join(ROOT, 'screens') // SHOTS_DIR: usado pelo scripts/check.sh
await mkdir(SHOTS, { recursive: true })

const problems = []
const notes = {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// extra.pagina: arquivo de dist/ (padrão preview.html); extra.query: sufixo da URL; extra.init: função para
// page.addInitScript (roda antes dos scripts da página);
// extra.moldes (padrão true): espera os moldes do PixelLab carregarem (Sprites.moldsReady === true) — o jogo
// re-renderiza a tela quando eles chegam, e esperar evita clicar num botão que está sendo trocado.
async function newPage(browser, viewport, label, extra = {}) {
  const { pagina = 'preview.html', query = '', init = null, moldes = true, ...ctxExtra } = extra
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ...ctxExtra })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${label}] console: ${m.text()}`) })
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`))
  if (init) await page.addInitScript(init)
  await page.goto(BASE + pagina + query, { waitUntil: 'domcontentloaded' })
  await Promise.race([page.evaluate(() => document.fonts && document.fonts.ready), sleep(4000)])
  if (moldes) {
    try {
      await page.waitForFunction(() => window.Sprites && window.Sprites.moldsReady === true, null, { timeout: 8000 })
    } catch (e) {
      const v = await page.evaluate(() => String(window.Sprites && window.Sprites.moldsReady))
      problems.push(`[${label}] moldes: Sprites.moldsReady não virou true (ficou ${v})`)
    }
  }
  return page
}

// Corrida até o resultado sem os moldes (queda para o desenho por código): moldsReady fica false, nenhum
// canvas de molde é criado e o cache do desenho por código ganha entradas durante a corrida (os retratos
// das telas anteriores já o deixam com algumas, então o que conta é crescer na corrida).
async function corridaSemMoldes(browser, label, extra) {
  const pg = await newPage(browser, { width: 390, height: 844 }, label, { ...extra, moldes: false })
  try {
    await pg.waitForSelector('.inicial')
    await sleep(600)   // folga para um carregamento de moldes que não deve acontecer
    const r0 = await pg.evaluate(() => window.Sprites.moldsReady)
    if (r0 !== false) problems.push(`[${label}] Sprites.moldsReady = ${r0} na tela inicial (esperado false)`)
    await pg.getByRole('button', { name: 'Escolher Maré' }).click()
    await pg.waitForSelector('#t-estabulo')
    await pg.locator('[data-acao="aba"][data-id="correr"]').click()
    await pg.waitForSelector('#t-correr')
    await pg.getByRole('button', { name: 'Procurar corrida' }).click()
    await pg.waitForSelector('#t-largada')
    const antes = await pg.evaluate(() => window.Sprites.cacheStats().baseCount)
    await pg.getByRole('button', { name: /^Largar/ }).click()
    await pg.waitForSelector('#pista')
    await pg.getByRole('button', { name: 'x2' }).click()
    await sleep(2500)
    const meio = await pg.evaluate(() => ({ ready: window.Sprites.moldsReady, moldes: window.Sprites._cacheMoldes(), codigo: window.Sprites.cacheStats().baseCount }))
    meio.codigoAntes = antes
    if (meio.ready !== false || meio.moldes !== 0 || !(meio.codigo > antes)) problems.push(`[${label}] corrida sem moldes não usou o desenho por código: ${JSON.stringify(meio)}`)
    // o Dado da Sorte também aparece sobre o desenho por código (Sprites.horseBox devolve a caixa 40×32)
    try {
      meio.dado = await (await pg.waitForFunction(() => {
        const st = window.RaceFx._stats
        return st.faixaDado && st.dados >= 1 ? { dados: st.dados, placas: st.placas.length } : false
      }, null, { timeout: 40000, polling: 'raf' })).jsonValue()
    } catch (e) {
      problems.push(`[${label}] sem moldes: o Dado da Sorte não apareceu na pista`)
    }
    await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
    await pg.waitForSelector('#t-resultado')
    notes['queda-' + label] = meio
  } catch (e) {
    problems.push(`[${label}] ${e.message}`)
  }
  await pg.context().close()
}

// ---- modo DEV (?dev=1): gaveta do botão "DEV" (as tarefas seguintes reusam devArmar) ----
async function devAbrir(page) {
  if (!(await page.locator('.dev-gaveta').count())) await page.locator('.dev-botao').click()
  await page.waitForSelector('.dev-gaveta')
}
async function devFechar(page) {
  if (await page.locator('.dev-gaveta').count()) await page.locator('.dev-gaveta [data-acao="dev-fechar"]').click()
  await page.waitForSelector('.dev-gaveta', { state: 'detached' })
}
// arma a próxima corrida pela gaveta; campo ausente = segue a sala normal
// opts: { clima, piso, distancia, tracado: 'normal'|'curvas'|'subidas'|'lista', blocos, vento, direcao: 1|-1, seed, sempre }
async function devArmar(page, opts = {}) {
  await devAbrir(page)
  const sel = {
    clima: opts.clima || '', piso: opts.piso || '', distancia: opts.distancia ? String(opts.distancia) : '',
    tracado: opts.tracado || 'normal', vento: opts.vento || '', direcao: String(opts.direcao || 1)
  }
  for (const [k, v] of Object.entries(sel)) await page.selectOption('#dev-' + k, v)
  await page.fill('#dev-blocos', opts.blocos || '')
  await page.fill('#dev-seed', opts.seed != null ? String(opts.seed) : '')
  await page.setChecked('#dev-sempre', !!opts.sempre)
  await page.locator('[data-acao="dev-armar"]').click()
  await devFechar(page)
}

async function checkOverflow(page, label) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  if (o.sw > o.cw) problems.push(`[${label}] rolagem horizontal: scrollWidth ${o.sw} > ${o.cw}`)
  return o
}

// monitora, quadro a quadro, se o cavalo do jogador está inteiro na tela (fora da câmera de chegada);
// vfora = quadros em que a caixa do cavalo passa da borda de cima ou de baixo do canvas (arco das curvas)
async function startCamMonitor(page) {
  await page.evaluate(() => {
    const cc = window.__cc = { frames: 0, partial: 0, off: 0, x1: 0, x2: 0, vfora: 0 }
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
        if (p.y < 0 || p.y + p.h > p.H) cc.vfora++
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
// UI_SO=reserva,gravacao,...: roda só os contextos com esses nomes (para desenvolver um teste sem esperar os
// ~5 min do resto); sem UI_SO (o check.sh), roda tudo.
const SO = (process.env.UI_SO || '').split(',').map((x) => x.trim()).filter(Boolean)
const quer = (nome) => !SO.length || SO.includes(nome)
// abre a sala na entrada pedida (tier) a partir do estábulo e devolve o que identifica a sala
async function abrirSala(pg, tier) {
  await pg.locator('[data-acao="aba"][data-id="correr"]').click()
  await pg.waitForSelector('#t-correr')
  if (tier) await pg.locator(`[data-acao="tier"][data-id="${tier}"]`).click()
  await pg.locator('[data-acao="procurar"]').click()
  await pg.waitForSelector('#t-largada')
  return salaAtual(pg)
}
const salaAtual = (pg) => pg.evaluate(() => {
  const L = window.__galope.ui.lobby
  return { seed: L.seed, counter: L.counter, fee: L.fee, training: L.training, sim: !!L.sim, track: L.trackName,
    blocks: JSON.stringify(L.cond.blocks), weather: L.cond.weather, rivais: L.racers.map((r) => r.name + ':' + r.horse.id + ':' + r.horse.level).join('|'),
    gold: window.__galope.state.gold }
})
try {
  // ---------------- entrada reservada: com sala valendo aberta, nenhum gasto re-sorteia a sala ----------------
  if (quer('reserva')) {
    const rv = await newPage(browser, { width: 390, height: 844 }, 'reserva')
    const st = () => rv.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    try {
      await rv.getByRole('button', { name: 'Escolher Brasa' }).click()
      await rv.waitForSelector('#t-estabulo')
      // 1. Ouro 500, sala de 250 aberta
      const salaA = await abrirSala(rv, 250)
      if (salaA.fee !== 250 || salaA.gold !== 500) problems.push('reserva: sala inicial ' + JSON.stringify(salaA))
      await rv.getByRole('button', { name: /^Voltar/ }).click()
      await rv.waitForSelector('#t-correr')
      // 2. Loja: as pedras só podem gastar o Ouro acima da entrada reservada (500 - 250 = 250 livres)
      await rv.locator('[data-acao="aba"][data-id="loja"]').click()
      await rv.waitForSelector('#t-loja')
      await rv.locator('[data-acao="loja-tab"][data-id="pedras"]').click()
      if (!/250 de Ouro reservados para a entrada do páreo aberto/.test((await rv.locator('#tela').textContent()) || '')) problems.push('reserva: a Loja não avisa o Ouro reservado')
      await rv.locator('[data-acao="comprar-pedra"][data-id="5"]').click()   // 200 -> 300
      await rv.locator('[data-acao="comprar-pedra"][data-id="1"]').click()   // 40 -> 260
      let s = await st()
      if (s.gold !== 260 || s.pedras !== 6) problems.push('reserva: compras dentro do livre ' + JSON.stringify({ gold: s.gold, pedras: s.pedras }))
      if (!(await rv.locator('[data-acao="comprar-pedra"][data-id="1"]').isDisabled())) problems.push('reserva: comprar pedra habilitado com o Ouro livre abaixo do preço')
      // clique forçado: o handler também recusa
      for (let k = 0; k < 2; k++) await rv.evaluate(() => { const b = document.querySelector('[data-acao="comprar-pedra"][data-id="1"]'); b.disabled = false; b.click() })
      await rv.locator('[data-acao="loja-tab"][data-id="sela"]').click()
      await rv.evaluate(() => { const b = document.querySelector('[data-acao="comprar"][data-id="sela-comum"]'); b.disabled = false; b.click() })
      s = await st()
      if (s.gold < 250) problems.push('reserva: gasto passou da entrada reservada (Ouro ' + s.gold + ')')
      // 3. vaga do estábulo (300) com 260: recusada mesmo forçando o clique
      await rv.evaluate(() => { window.__galope.state.gold = 500 })
      await rv.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await rv.waitForSelector('#t-estabulo')
      if (!(await rv.locator('[data-acao="expandir"]').isDisabled())) problems.push('reserva: expandir o estábulo habilitado com só 250 livres')
      await rv.evaluate(() => { const b = document.querySelector('[data-acao="expandir"]'); b.disabled = false; b.click() })
      s = await st()
      if (s.gold !== 500 || s.stableSlots !== 3) problems.push('reserva: expandir com a entrada reservada ' + JSON.stringify({ gold: s.gold, slots: s.stableSlots }))
      await rv.evaluate(() => { window.__galope.state.gold = 260 })
      // 4. procurar de novo: a MESMA sala
      const salaB = await abrirSala(rv)
      for (const k of ['seed', 'counter', 'fee', 'track', 'blocks', 'weather', 'rivais']) if (salaA[k] !== salaB[k]) problems.push(`reserva: a sala mudou depois das compras (${k}: ${salaA[k]} -> ${salaB[k]})`)
      // 5. save adulterado (Ouro abaixo da entrada): a mesma sala corre como treino, sem entrada nem prêmio de aposta
      await rv.getByRole('button', { name: /^Voltar/ }).click()
      await rv.waitForSelector('#t-correr')
      await rv.evaluate(() => { window.__galope.state.gold = 100 })
      await rv.reload({ waitUntil: 'domcontentloaded' })
      await rv.waitForSelector('#t-estabulo')
      await rv.evaluate(() => { window.__galope.state.gold = 100 })
      const salaC = await abrirSala(rv)
      for (const k of ['seed', 'counter', 'track', 'blocks', 'weather', 'rivais']) if (salaA[k] !== salaC[k]) problems.push(`reserva: com o Ouro abaixo da entrada a sala mudou (${k}: ${salaA[k]} -> ${salaC[k]})`)
      if (!salaC.training || salaC.fee !== 0) problems.push('reserva: com o Ouro abaixo da entrada a sala deveria correr como treino ' + JSON.stringify({ training: salaC.training, fee: salaC.fee }))
      // voltar e procurar de novo (com Ouro acima da menor entrada) não troca o treino por uma sala nova
      await rv.getByRole('button', { name: /^Voltar/ }).click()
      await rv.waitForSelector('#t-correr')
      const salaD = await abrirSala(rv)
      if (salaD.seed !== salaA.seed || salaD.counter !== salaA.counter || !salaD.training) problems.push('reserva: o treino da sala rebaixada foi re-sorteado ' + JSON.stringify(salaD))
      await rv.getByRole('button', { name: /^Largar treino/ }).click()
      await rv.getByRole('button', { name: /Pular/ }).click()
      await rv.waitForSelector('#t-resultado')
      const r = await rv.evaluate(() => ({ gold: window.__galope.state.gold, res: window.__galope.ui.result, pending: window.__galope.state.pending, seed: window.__galope.ui.lobby.seed }))
      if (!r.res.training || r.res.fee !== 0 || r.res.stone !== 0 || r.gold !== 100 + r.res.prize || r.res.prize > 30 || r.pending || r.seed !== salaA.seed) problems.push('reserva: treino da sala rebaixada ' + JSON.stringify({ gold: r.gold, res: { training: r.res.training, fee: r.res.fee, prize: r.res.prize, stone: r.res.stone }, pending: r.pending }))
    } catch (e) {
      problems.push('reserva: ' + e.message)
    }
    await rv.context().close()
  }

  // ---------------- gravação que falha: nada de resultado nem débito sem o save gravado ----------------
  if (quer('gravacao')) {
    const gv = await newPage(browser, { width: 390, height: 844 }, 'gravacao')
    const st = () => gv.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    const quebrar = () => gv.evaluate(() => {
      if (!window.__setOrig) window.__setOrig = Storage.prototype.setItem
      Storage.prototype.setItem = function () { throw new DOMException('cheio', 'QuotaExceededError') }
    })
    const consertar = () => gv.evaluate(() => { Storage.prototype.setItem = window.__setOrig })
    const FALHA = 'Não foi possível salvar. Libere espaço e tente de novo.'
    const temAviso = async () => ((await gv.locator('#tela').textContent()) || '').includes(FALHA)
    try {
      await gv.getByRole('button', { name: 'Escolher Brasa' }).click()
      await gv.waitForSelector('#t-estabulo')
      // 1. melhoria de peça: pedras, +N e contador intactos
      await gv.evaluate(() => { window.__galope.state.pedras = 10 })
      let s0 = await st()
      const slot = Object.keys(s0.mounts[0].equip).find((k) => s0.mounts[0].equip[k])
      const uid = s0.mounts[0].equip[slot]
      await gv.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await gv.waitForSelector('#t-montaria')
      await gv.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      await gv.locator(`[data-acao="equip-slot"][data-id="${slot}"]`).click()
      await gv.locator(`[data-acao="melhorar"][data-id="${uid}"]`).click()
      await quebrar()
      await gv.locator(`[data-acao="melhorar-sim"][data-id="${uid}"]`).click()
      let s = await st()
      const it0 = s0.items.find((x) => x.uid === uid), it1 = s.items.find((x) => x.uid === uid)
      if (s.pedras !== 10 || s.enhanceCounter !== s0.enhanceCounter || it1.plus !== it0.plus) problems.push('gravacao: melhoria sem gravar mudou o save ' + JSON.stringify({ pedras: s.pedras, cont: s.enhanceCounter, plus: it1.plus }))
      if (!(await temAviso())) problems.push('gravacao: melhoria sem gravar não avisou')
      if (/Sucesso!|Falhou/.test((await gv.locator('#tela').textContent()) || '')) problems.push('gravacao: melhoria sem gravar mostrou o resultado')
      await consertar()
      await gv.locator('[data-acao="montaria-voltar"]').click()
      await gv.waitForSelector('#t-estabulo')
      // 2. abrir a sala: sem gravar, a sala não abre (recarregar a sortearia de novo)
      await gv.locator('[data-acao="aba"][data-id="correr"]').click()
      await gv.waitForSelector('#t-correr')
      await quebrar()
      await gv.locator('[data-acao="procurar"]').click()
      s = await st()
      if (s.pending || s.raceCounter !== 0 || (await gv.locator('#t-largada').count())) problems.push('gravacao: a sala abriu sem gravar ' + JSON.stringify({ pending: s.pending, counter: s.raceCounter }))
      if (!(await temAviso())) problems.push('gravacao: abrir a sala sem gravar não avisou')
      await consertar()
      await gv.locator('[data-acao="procurar"]').click()
      await gv.waitForSelector('#t-largada')
      // 3. "Largar!" sem gravar: nada de corrida nem de resultado, Ouro intacto, a sala continua
      const g0 = (await st()).gold
      await quebrar()
      await gv.getByRole('button', { name: /^Largar/ }).click()
      await sleep(300)
      s = await st()
      const lob = await gv.evaluate(() => ({ sim: !!window.__galope.ui.lobby.sim, result: !!window.__galope.ui.result, screen: window.__galope.ui.screen }))
      if (s.gold !== g0 || !s.pending || s.races !== 0 || lob.sim || lob.result || lob.screen !== 'largada' || (await gv.locator('#pista, #t-resultado').count())) problems.push('gravacao: Largar sem gravar ' + JSON.stringify({ gold: s.gold, g0, pending: !!s.pending, races: s.races, ...lob }))
      if (!(await temAviso())) problems.push('gravacao: Largar sem gravar não avisou')
      // 4. compra na Loja sem gravar
      await gv.getByRole('button', { name: /^Voltar/ }).click()
      await gv.locator('[data-acao="aba"][data-id="loja"]').click()
      await gv.waitForSelector('#t-loja')
      await gv.locator('[data-acao="loja-tab"][data-id="pedras"]').click()
      const s1 = await st()
      await gv.locator('[data-acao="comprar-pedra"][data-id="1"]').click()
      s = await st()
      if (s.gold !== s1.gold || s.pedras !== s1.pedras) problems.push('gravacao: compra sem gravar ' + JSON.stringify({ gold: s.gold, pedras: s.pedras }))
      if (!(await temAviso())) problems.push('gravacao: compra sem gravar não avisou')
      // 5. gravação de volta: a mesma sala larga normalmente
      await consertar()
      await gv.locator('[data-acao="aba"][data-id="correr"]').click()
      await gv.locator('[data-acao="procurar"]').click()
      await gv.waitForSelector('#t-largada')
      await gv.getByRole('button', { name: /^Largar/ }).click()
      await gv.waitForSelector('#pista')
      if ((await st()).gold >= g0 + 1000) problems.push('gravacao: Ouro estranho depois de largar')
    } catch (e) {
      problems.push('gravacao: ' + e.message)
    }
    await gv.context().close()
  }

  // ---------------- produção (jogo.html, o que vai para o jogador): sem DEV e sem gancho de teste ----------------
  if (quer('producao')) {
    for (const query of ['', '?dev=1']) {
      const label = 'producao' + query
      const pd = await newPage(browser, { width: 390, height: 844 }, label, { pagina: 'producao.html', query })
      try {
        await pd.waitForSelector('.inicial', { timeout: 5000 })
        const g = await pd.evaluate(() => ({ galope: typeof window.__galope, dev: typeof window.Dev, flag: typeof window.__GALOPE_DEV,
          html: document.documentElement.outerHTML.length, temDev: /dev\.js|galope-elemental:dev/.test(document.documentElement.outerHTML) }))
        if (g.galope !== 'undefined' || g.dev !== 'undefined' || g.temDev) problems.push(`[${label}] produção com DEV ou gancho de teste: ` + JSON.stringify(g))
        if ((await pd.locator('.dev-painel, .dev-faixa, .dev-botao, .dev-gaveta').count()) !== 0) problems.push(`[${label}] produção mostra o modo DEV`)
        // uma corrida inteira só com cliques
        await pd.getByRole('button', { name: 'Escolher Brasa' }).click()
        await pd.waitForSelector('#t-estabulo')
        if ((await pd.locator('.dev-painel, .dev-faixa, .dev-botao').count()) !== 0) problems.push(`[${label}] produção mostra o modo DEV no estábulo`)
        await pd.locator('[data-acao="aba"][data-id="correr"]').click()
        await pd.waitForSelector('#t-correr')
        await pd.getByRole('button', { name: 'Procurar corrida' }).click()
        await pd.waitForSelector('#t-largada')
        await pd.getByRole('button', { name: /^Largar/ }).click()
        await pd.waitForSelector('#pista')
        await pd.getByRole('button', { name: 'x2' }).click()
        await sleep(1500)
        await pd.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pd.waitForSelector('#t-resultado')
        const fim = ((await pd.locator('#t-resultado').textContent()) || '')
        if (!/Vitória|Você chegou em/.test(fim)) problems.push(`[${label}] resultado estranho: ` + fim)
        const ls = await pd.evaluate(() => ({ dev: localStorage.getItem('galope-elemental:dev'), real: localStorage.getItem('galope-elemental:v1') }))
        if (ls.dev !== null || !ls.real) problems.push(`[${label}] produção deveria gravar só o save real ` + JSON.stringify({ dev: ls.dev, real: !!ls.real }))
        await pd.getByRole('button', { name: 'Correr de novo' }).click()
        await pd.waitForSelector('#t-largada')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      }
      await pd.context().close()
    }
  }

  if (!SO.length) {   // o resto do teste (fluxo completo e contextos antigos) só roda sem UI_SO
  // ---------------- celular 390x844 ----------------
  // newPage já espera Sprites.moldsReady === true (moldes do PixelLab embutidos pelo build e decodificados)
  const page = await newPage(browser, { width: 390, height: 844 }, 'mobile')
  await page.waitForSelector('.inicial')
  await sleep(500)
  await checkOverflow(page, 'inicial')
  await page.screenshot({ path: join(SHOTS, 'final-01-inicial.png') })
  // marca: o h1 continua existindo e leva o logotipo (alt = título) quando o arquivo existe
  if (await page.evaluate(() => !!(window.__MARCA && window.__MARCA.logo))) {
    if ((await page.locator('h1#t-inicial img.logo-img[alt="Galope Elemental"]').count()) !== 1) problems.push('inicial: sem img.logo-img[alt="Galope Elemental"] dentro do h1')
  }

  await page.getByRole('button', { name: 'Escolher Brasa' }).click()
  await page.waitForSelector('#t-estabulo')
  const seedBase1 = await page.evaluate(() => window.__galope.state.seedBase)
  await sleep(400)
  await checkOverflow(page, 'estabulo')
  await page.screenshot({ path: join(SHOTS, 'final-02-estabulo.png') })
  // ícones do PixelLab: barra de abas e saldos do cabeçalho (img decorativa + rótulo de texto ao lado)
  for (const [aba, rotulo] of [['estabulo', 'Estábulo'], ['correr', 'Correr'], ['expedicao', 'Expedição'], ['haras', 'Haras'], ['loja', 'Loja']]) {
    const b = page.locator(`.app-aba[data-id="${aba}"]`)
    if ((await b.locator('img.icone[alt=""]').count()) !== 1) problems.push('ícones: aba ' + aba + ' sem img.icone[alt=""]')
    if (((await b.locator('.app-aba-rotulo').textContent()) || '').trim() !== rotulo) problems.push('ícones: aba ' + aba + ' perdeu o rótulo de texto')
  }
  if ((await page.locator('.app-topo .saldo img.icone--moeda-ouro[alt=""]').count()) !== 1) problems.push('ícones: saldo de Ouro sem img.icone--moeda-ouro')
  if ((await page.locator('.app-topo .pedras img.icone--pedra-negra[alt=""]').count()) !== 1) problems.push('ícones: saldo de Pedras sem img.icone--pedra-negra')
  if ((await page.locator('.app-topo img.logo-img[alt="Galope Elemental"]').count()) !== 1) problems.push('ícones: cabeçalho sem img.logo-img')
  const quebradas = await page.evaluate(() => Array.prototype.filter.call(document.querySelectorAll('img.icone, img.logo-img'), (i) => !i.complete || i.naturalWidth === 0).length)
  if (quebradas) problems.push('ícones: ' + quebradas + ' imagem(ns) quebrada(s)')
  if ((await page.locator('.dev-painel, .dev-faixa, .dev-botao').count()) !== 0) problems.push('painel/faixa dev presente sem ?dev=1')

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
  await page.screenshot({ path: join(SHOTS, 'final-05-largada.png') })

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
  await page.screenshot({ path: join(SHOTS, 'final-06-corrida.png') })
  // resto em x2 até a troca automática para o resultado
  await page.getByRole('button', { name: 'x2' }).click()
  await page.waitForSelector('#t-resultado', { timeout: 90000 })
  if (!(await page.evaluate(() => window.__sawDice))) problems.push('narração nunca mostrou um Dado da Sorte')
  if (!(await page.evaluate(() => !!document.getElementById('t-dados')))) problems.push('resultado sem a seção de momentos/dados')
  notes.cam390 = await page.evaluate(() => window.__cc)
  await sleep(600)
  await checkOverflow(page, 'resultado')
  await page.screenshot({ path: join(SHOTS, 'final-07-resultado.png') })
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
    await cz.waitForSelector('#t-estabulo')   // perfil DEV novo: nasce com a Brasa, sem a escolha inicial
    if ((await cz.locator('.dev-painel').count()) !== 1) problems.push('cruzamento: painel dev ausente com ?dev=1')
    // este contexto confere o Ouro exato: desliga o Ouro infinito; +10 níveis pela gaveta
    await devAbrir(cz)
    await cz.setChecked('#dev-ouroinf', false)
    await cz.locator('[data-acao="dev-niveis"]').click()
    await devFechar(cz)
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
    await cz.screenshot({ path: join(SHOTS, 'final-08-haras.png') })
    // Perfil -> Voltar devolve ao Haras com o mesmo parceiro selecionado
    {
      const parceiro0 = await cz.evaluate(() => JSON.stringify(window.__galope.ui.haras && window.__galope.ui.haras.partner))
      await cz.locator('[data-acao="perfil"]').click(); await cz.waitForSelector('#t-perfil')
      await cz.locator('[data-acao="perfil-voltar"]').click(); await cz.waitForSelector('#t-haras')
      const parceiro1 = await cz.evaluate(() => JSON.stringify(window.__galope.ui.haras && window.__galope.ui.haras.partner))
      if (parceiro0 === 'null' || parceiro1 !== parceiro0) problems.push(`cruzamento: Perfil -> Voltar mudou o parceiro do Haras (${parceiro0} -> ${parceiro1})`)
    }
    // liberar uma montaria pela tela da Montaria: volta ao Estábulo com o foco no h1 e a montaria some
    {
      const est = await cz.evaluate(() => ({ n: window.__galope.state.mounts.length, active: window.__galope.state.activeId, uids: window.__galope.state.mounts.map((m) => m.uid) }))
      const alvo = est.uids.find((u) => u !== est.active)
      await cz.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await cz.waitForSelector('#t-estabulo')
      await cz.locator(`button[data-acao="montaria"][data-id="${alvo}"]`).click()
      await cz.waitForSelector('#t-montaria')
      await cz.locator(`[data-acao="liberar"][data-id="${alvo}"]`).click()
      await cz.locator(`[data-acao="liberar-sim"][data-id="${alvo}"]`).click()
      await cz.waitForSelector('#t-estabulo')
      const dep = await cz.evaluate(() => ({ n: window.__galope.state.mounts.length, foco: document.activeElement && document.activeElement.id }))
      if (dep.n !== est.n - 1) problems.push('cruzamento: liberar pela Montaria não removeu (' + est.n + ' -> ' + dep.n + ')')
      if (dep.foco !== 't-estabulo') problems.push('cruzamento: foco em ' + dep.foco + ' após liberar (esperado t-estabulo)')
    }
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
      // 2. trocar de aba não empilha histórico: abas são raízes, sem o estado de guarda { galope: 1 }
      //    (só history.length não pega a regressão: o guarda único mantém o comprimento estável)
      const len0 = await mn.evaluate(() => history.length)
      for (let i = 0; i < 10; i++) {
        const id = ['correr', 'haras', 'loja', 'estabulo', 'expedicao'][i % 5]
        await mn.locator(`[data-acao="aba"][data-id="${id}"]`).click()
        await mn.waitForSelector('#t-' + id)
        const hs = await mn.evaluate(() => history.state)
        if (hs !== null) problems.push(`menu: history.state ${JSON.stringify(hs)} na aba ${id} (esperado null)`)
      }
      const len1 = await mn.evaluate(() => history.length)
      if (len1 !== len0) problems.push(`menu: history.length ${len0} -> ${len1} ao trocar de aba`)
      const guarda = async (onde) => {
        const hs = await mn.evaluate(() => history.state)
        if (!(hs && hs.galope === 1)) problems.push(`menu: sem o estado de guarda em ${onde} (history.state ${JSON.stringify(hs)})`)
      }
      // 3. cabeçalho e barra presentes nas abas, ausentes na corrida
      if ((await mn.locator('.app-topo').count()) !== 1 || (await mn.locator('.app-abas').count()) !== 1) problems.push('menu: casca ausente numa aba')
      await mn.locator('[data-acao="aba"][data-id="correr"]').click()
      await mn.getByRole('button', { name: 'Procurar corrida' }).click()
      await mn.waitForSelector('#t-largada')
      await guarda('#t-largada')
      if ((await mn.locator('.app-abas').count()) !== 0) problems.push('menu: barra visível na largada')
      await mn.getByRole('button', { name: /^Largar/ }).click()
      await mn.waitForSelector('#pista')
      if ((await mn.locator('.app-topo').count()) !== 0 || (await mn.locator('.app-abas').count()) !== 0) problems.push('menu: casca visível na corrida')
      await mn.getByRole('button', { name: /Pular|Ver resultado/ }).click()
      await mn.waitForSelector('#t-resultado')
      await checkOverflow(mn, 'menu-390')
      await mn.getByRole('button', { name: /^Voltar/ }).click()
      await mn.waitForSelector('#t-correr')
      if ((await mn.locator('.app-aba--ponto').count()) !== 0) problems.push('menu: ponto na aba Correr depois da corrida')
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
      // 8. tela da Montaria: estado de guarda, captura, 3 sub-abas, Renomear e Liberar
      await mn.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await mn.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await mn.waitForSelector('#t-montaria')
      await guarda('#t-montaria')
      // captura da Montaria na sub-aba Equipamento, do topo (cabeça + sub-abas), sem o painel dev
      await mn.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      await mn.evaluate(() => window.scrollTo(0, 0))
      await sleep(300)
      if ((await mn.locator('.slot-botao img.icone[alt=""]').count()) !== 5) problems.push('ícones: os 5 slots do Equipamento deveriam ter img.icone')
      if ((await mn.locator('.slot-botao .slot-nome').count()) !== 5) problems.push('ícones: rótulos dos slots sumiram')
      await mn.screenshot({ path: join(SHOTS, 'final-03-montaria.png') })
      for (const aba of ['skills', 'equip', 'status']) {
        await mn.locator(`[data-acao="montaria-aba"][data-id="${aba}"]`).click()
        if ((await mn.locator(`[data-acao="montaria-aba"][data-id="${aba}"][aria-pressed="true"]`).count()) !== 1) problems.push('menu: sub-aba ' + aba + ' não ativou')
      }
      if ((await mn.locator('.slots').count()) < 1) problems.push('menu: resumo do equipamento ausente na cabeça da Montaria')   // .slots vem do gearSummaryHtml da cabeça, visível em qualquer sub-aba
      await mn.evaluate(() => { window.prompt = () => 'Trovão' })   // renomear usa window.prompt, como o teste principal já faz
      await mn.locator('[data-acao="renomear"][data-id="m1"]').click()
      if ((await mn.evaluate(() => window.__galope.state.mounts[0].name)) !== 'Trovão') problems.push('menu: renomear na Montaria não aplicou')
      if (!/Trovão/.test(await mn.locator('#t-montaria').textContent())) problems.push('menu: h1 da Montaria não mostra o nome novo')
      // Liberar desabilitado na ativa/única
      if (!(await mn.locator('[data-acao="liberar"][data-id="m1"]').isDisabled())) problems.push('menu: Liberar habilitado na única montaria')
      // 9. capturas das abas Correr e Expedição
      await mn.locator('[data-acao="montaria-voltar"]').click()
      await mn.waitForSelector('#t-estabulo')
      await mn.locator('[data-acao="aba"][data-id="correr"]').click()
      await mn.waitForSelector('#t-correr')
      await sleep(300)
      await mn.screenshot({ path: join(SHOTS, 'final-04-correr.png') })
      await mn.locator('[data-acao="aba"][data-id="expedicao"]').click()
      await mn.waitForSelector('#t-expedicao')
      await sleep(300)
      await mn.screenshot({ path: join(SHOTS, 'final-10-expedicao.png') })
      // 10. perfil: estatísticas e Recomeçar; Voltar retorna à aba de onde veio
      const abaAntes = await mn.evaluate(() => window.__galope.ui.tab)
      await mn.locator('[data-acao="perfil"]').click(); await mn.waitForSelector('#t-perfil')
      await guarda('#t-perfil')
      const perfilTxt = await mn.locator('#tela').textContent()
      if (!/Corridas/.test(perfilTxt) || !/Vitórias/.test(perfilTxt) || !/Pódios/.test(perfilTxt) || !/Recomeçar/.test(perfilTxt)) problems.push('menu: perfil incompleto')
      if (!/montaria/.test(perfilTxt) || !/peça/.test(perfilTxt)) problems.push('menu: perfil sem contagem de montarias/peças')
      await checkOverflow(mn, 'menu-perfil')
      await mn.screenshot({ path: join(SHOTS, 'final-11-perfil.png') })
      await mn.goBack(); await mn.waitForSelector('#t-' + abaAntes)
      await mn.locator('[data-acao="perfil"]').click(); await mn.waitForSelector('#t-perfil')
      await mn.locator('[data-acao="perfil-voltar"]').click(); await mn.waitForSelector('#t-' + abaAntes)
      // 11. Perfil -> Voltar devolve à Loja com a mesma aba interna (Pedras)
      await mn.locator('[data-acao="aba"][data-id="loja"]').click(); await mn.waitForSelector('#t-loja')
      await mn.locator('[data-acao="loja-tab"][data-id="pedras"]').click()
      await mn.locator('[data-acao="perfil"]').click(); await mn.waitForSelector('#t-perfil')
      await mn.locator('[data-acao="perfil-voltar"]').click(); await mn.waitForSelector('#t-loja')
      const lojaTab = await mn.evaluate(() => window.__galope.ui.loja && window.__galope.ui.loja.tab)
      if (lojaTab !== 'pedras') problems.push(`menu: Perfil -> Voltar perdeu a aba da Loja (${lojaTab}, esperado pedras)`)
      // 12. barra embaixo no celular (390) e à esquerda no desktop (1280)
      const mbox = await mn.locator('.app-abas').boundingBox()
      if (!mbox || mbox.y < 700 || mbox.width < 380) problems.push('menu: barra não está embaixo em 390: ' + JSON.stringify(mbox))
      const desk = await newPage(browser, { width: 1280, height: 800 }, 'menu-desk')
      try {
        await desk.getByRole('button', { name: 'Escolher Maré' }).click(); await desk.waitForSelector('#t-estabulo')
        const box = await desk.locator('.app-abas').boundingBox()
        if (!box || box.x > 10 || box.width > 260 || box.height < 400) problems.push('menu: barra não está à esquerda em 1280: ' + JSON.stringify(box))
        await desk.locator('[data-acao="aba"][data-id="correr"]').click(); await desk.waitForSelector('#t-correr')
        await sleep(300)
        await checkOverflow(desk, 'menu-1280')
        await desk.screenshot({ path: join(SHOTS, 'final-desktop-correr.png') })
      } finally { await desk.context().close() }
      // 13. a casca não estoura a 360 px
      const p360 = await newPage(browser, { width: 360, height: 740 }, 'menu-360')
      try {
        await p360.getByRole('button', { name: 'Escolher Brasa' }).click(); await p360.waitForSelector('#t-estabulo')
        await checkOverflow(p360, 'menu-360-estabulo')
        await p360.locator('[data-acao="aba"][data-id="correr"]').click(); await p360.waitForSelector('#t-correr')
        await checkOverflow(p360, 'menu-360-correr')
      } finally { await p360.context().close() }
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
      // 1. perfil DEV novo (Brasa, sem a escolha inicial) com o equipamento de partida
      await eq.waitForSelector('#t-estabulo')
      let s = await st()
      if (s.items.length !== 2 || s.mounts[0].equip.sela !== 'i1' || s.mounts[0].equip.ferraduras !== 'i2' || s.pedras !== 0) {
        problems.push('equipamento: estado inicial ' + JSON.stringify({ items: s.items, equip: s.mounts[0].equip, pedras: s.pedras }))
      }
      // 2. gaveta DEV: 5 Pedras e conjunto Lendário do Sol +0 equipado na ativa (Brasa é Fogo)
      await devAbrir(eq)
      await eq.fill('#dev-pedras', '5')
      await eq.locator('[data-acao="dev-pedras"]').click()
      if ((await st()).pedras !== 5) problems.push('equipamento: dev-pedras não deu 5 pedras')
      await eq.selectOption('#dev-conjunto', 'sol')
      await eq.selectOption('#dev-rpeca', 'lendario')
      await eq.selectOption('#dev-melhoria', '0')
      await eq.setChecked('#dev-equipar', true)
      await eq.locator('[data-acao="dev-conjunto"]').click()
      await devFechar(eq)
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
      // 8b. botão DEV inteiro acima da barra de abas; a aba ainda responde com o botão presente
      const devBox = await eq.locator('.dev-botao').boundingBox()
      const abasBox = await eq.locator('.app-abas').boundingBox()
      if (!devBox || !abasBox || devBox.y + devBox.height > abasBox.y + 1) problems.push('menu: botão DEV cobre a barra ' + JSON.stringify({ devBox, abasBox }))
      await eq.locator('[data-acao="aba"][data-id="loja"]').click()
      await eq.waitForSelector('#t-loja', { timeout: 5000 })
      await eq.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await eq.waitForSelector('#t-estabulo')
      // 9. trava parcial com páreo aberto
      await eq.locator('[data-acao="aba"][data-id="correr"]').click()
      await eq.waitForSelector('#t-correr')
      await eq.getByRole('button', { name: 'Procurar corrida' }).click()
      await eq.waitForSelector('#t-largada')
      // 9a. na largada (tela cheia, no topo) o botão DEV não cobre o "Largar!"
      {
        const lb = await eq.locator('.barra-acao .btn').boundingBox()
        const db = await eq.locator('.dev-botao').boundingBox()
        const cruza = lb && db && lb.x < db.x + db.width && db.x < lb.x + lb.width && lb.y < db.y + db.height && db.y < lb.y + lb.height
        if (!lb || !db || cruza) problems.push('equipamento: botão DEV cobre o "Largar!" na largada ' + JSON.stringify({ lb, db }))
      }
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
      // 10. sem rolagem horizontal
      await sleep(300)
      await checkOverflow(eq, 'equipamento')
      // 11. vender a Lendária pela 3ª vez e sair: a venda fica e o "Desfazer" some
      //     (depois da trava, que ainda usa a Lendária no inventário)
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

  // ---------------- modo DEV: save separado, Ouro infinito, cavalo, peça e corrida forçada ----------------
  {
    // save real conhecido (v2) já gravado antes de a página carregar; uma espia anota toda chave que a página
    // lê, grava ou apaga no localStorage (instalada depois da gravação, a cada carga; o teste lê pelo
    // getItem original, __lsGet, para não entrar no registro)
    const REAL = JSON.stringify({ v: 2, starterId: 'mare', level: 7, xp: 10, skills: ['mare-alta'], gold: 777, races: 3, wins: 1, podiums: 2, goldWon: 300, seedBase: 4242, raceCounter: 3 })
    const init = { content: `(() => {
      try { if (localStorage.getItem('galope-elemental:v1') === null) localStorage.setItem('galope-elemental:v1', ${JSON.stringify(REAL)}) } catch (e) {}
      const log = window.__acessos = []
      window.__lsGet = Storage.prototype.getItem
      for (const fn of ['getItem', 'setItem', 'removeItem']) {
        const orig = Storage.prototype[fn]
        Storage.prototype[fn] = function (k) { log.push(fn + ':' + k); return orig.apply(this, arguments) }
      }
    })()` }
    const dv = await newPage(browser, { width: 360, height: 780 }, 'dev', { query: '?dev=1', init })
    const st = () => dv.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    const armazenado = (pg) => pg.evaluate(() => {
      const get = window.__lsGet   // leitura do teste fora da espia: não entra no __acessos
      return { real: get.call(localStorage, 'galope-elemental:v1'), dev: get.call(localStorage, 'galope-elemental:dev'), acessos: window.__acessos.slice() }
    })
    const conferirReal = async (quando, pg = dv) => {
      const a = await armazenado(pg)
      if (a.real !== REAL) problems.push('dev: save real mudou (' + quando + '): ' + a.real)
      if (a.acessos.some((x) => /galope-elemental:v1$/.test(x))) problems.push('dev: a página tocou no save real (' + quando + '): ' + a.acessos.join(', '))
      if (!a.dev || !a.acessos.some((x) => /:galope-elemental:dev$/.test(x))) problems.push('dev: save galope-elemental:dev ausente ou não usado (' + quando + ')')
      return a
    }
    try {
      // 1. perfil novo nasce com a Brasa, sem a escolha inicial; faixa e botão; Ouro infinito
      await dv.waitForSelector('#t-estabulo', { timeout: 5000 })
      let s = await st()
      if (s.mounts.length !== 1 || s.mounts[0].templateId !== 'brasa' || s.gold !== 999999) problems.push('dev: perfil novo ' + JSON.stringify({ n: s.mounts.length, t: s.mounts[0].templateId, gold: s.gold }))
      if (((await dv.locator('.dev-faixa').textContent()) || '').trim() !== 'MODO DEV — save de teste') problems.push('dev: faixa sem "MODO DEV — save de teste"')
      if ((await dv.locator('.dev-painel').count()) !== 1 || (await dv.locator('.dev-botao').count()) !== 1) problems.push('dev: sem .dev-painel/.dev-botao')
      // 2. gaveta em 360 px: sem rolagem horizontal na página nem dentro da gaveta
      await devAbrir(dv)
      await checkOverflow(dv, 'dev-gaveta')
      const gv = await dv.evaluate(() => { const g = document.querySelector('.dev-gaveta'); return { sw: g.scrollWidth, cw: g.clientWidth } })
      if (gv.sw > gv.cw) problems.push('dev: gaveta com rolagem horizontal ' + JSON.stringify(gv))
      for (const g of ['moedas', 'cavalo', 'itens', 'corrida', 'perfil']) if ((await dv.locator('#dev-g-' + g).count()) !== 1) problems.push('dev: gaveta sem o grupo ' + g)
      // 3. cavalo Mítico de Água nível 30 com 2 skills (uma exclusiva de outro elemento: o perfil DEV aceita)
      await dv.fill('#dev-nome', 'Teste DEV')
      await dv.selectOption('#dev-elemento', 'agua')
      await dv.selectOption('#dev-raridade', 'mitico')
      await dv.fill('#dev-nivel', '30')
      const skillsDev = ['pe-na-chuva', 'labareda', '', '', '']
      for (let k = 0; k < 5; k++) await dv.selectOption('#dev-skill' + k, skillsDev[k])
      await dv.locator('[data-acao="dev-criar"]').click()
      s = await st()
      const novo = s.mounts.find((m) => m.uid === s.activeId)
      if (s.mounts.length !== 2 || !novo || novo.uid !== 'm2' || novo.templateId !== 'dev-2' || novo.name !== 'Teste DEV' || novo.element !== 'agua' || novo.rarity !== 'mitico' || novo.level !== 30 || JSON.stringify(novo.skills) !== '["pe-na-chuva","labareda"]') {
        problems.push('dev: cavalo criado ' + JSON.stringify(novo))
      }
      await devFechar(dv)
      await dv.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await dv.waitForSelector('#t-estabulo')
      const card = ((await dv.locator('.montaria--ativa').textContent()) || '').replace(/\s+/g, ' ')
      if (!/Teste DEV/.test(card) || !/Mítico/i.test(card) || !/Nv 30/.test(card) || !/Água/.test(card)) problems.push('dev: estábulo sem o cavalo criado: ' + card)
      // 4. peça Lendária +7 (Armadura da Chuva) no inventário
      await devAbrir(dv)
      await dv.selectOption('#dev-slot', 'armadura')
      await dv.selectOption('#dev-conjunto', 'chuva')
      await dv.selectOption('#dev-rpeca', 'lendario')
      await dv.selectOption('#dev-melhoria', '7')
      await dv.setChecked('#dev-equipar', false)
      await dv.locator('[data-acao="dev-peca"]').click()
      s = await st()
      const peca = s.items[s.items.length - 1]
      if (!peca || peca.id !== 'armadura-chuva-lendario' || peca.plus !== 7) problems.push('dev: peça dada ' + JSON.stringify(peca))
      await devFechar(dv)
      await dv.locator(`button[data-acao="montaria"][data-id="${s.activeId}"]`).click()
      await dv.waitForSelector('#t-montaria')
      await dv.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      await dv.locator('[data-acao="equip-slot"][data-id="armadura"]').click()
      if (!peca || (await dv.locator(`[data-acao="equipar"][data-id="${peca.uid}"]`).count()) !== 1) problems.push('dev: a peça Lendária não aparece no inventário da Armadura')
      if (!/Armadura da Chuva/.test((await dv.locator('#tela').textContent()) || '')) problems.push('dev: inventário sem "Armadura da Chuva"')
      // 5. próxima corrida: clima Névoa, vento brisa ←, seed fixa e skills sempre ativam
      await devArmar(dv, { clima: 'nevoa', vento: 'brisa', direcao: -1, seed: 4321, sempre: true })
      const nx = await dv.evaluate(() => window.__galope.ui.devNext)
      if (JSON.stringify(nx) !== JSON.stringify({ seed: 4321, cond: { weather: 'nevoa' }, wind: { intensity: 'brisa', dir: -1 }, skillsAlways: true })) problems.push('dev: devNext ' + JSON.stringify(nx))
      if ((await dv.locator('.dev-botao--armado').count()) !== 1) problems.push('dev: botão DEV sem a marca de armado')
      await dv.locator('[data-acao="aba"][data-id="correr"]').click()
      await dv.waitForSelector('#t-correr')
      await dv.getByRole('button', { name: 'Procurar corrida' }).click()
      await dv.waitForSelector('#t-largada')
      const sala = await dv.evaluate(() => { const L = window.__galope.ui.lobby; return { seed: L.seed, weather: L.cond.weather, dev: L.dev, sim: !!L.sim, gold: window.__galope.state.gold } })
      if (sala.seed !== 4321 || sala.weather !== 'nevoa' || sala.sim || JSON.stringify(sala.dev) !== JSON.stringify({ wind: { intensity: 'brisa', dir: -1 }, skillsAlways: true })) problems.push('dev: sala ' + JSON.stringify(sala))
      if (!/Clima inicial\s*Névoa/.test((await dv.locator('[aria-label="Condições da pista"] .chips').textContent()) || '')) problems.push('dev: a sala não mostra o clima Névoa')
      await dv.getByRole('button', { name: /^Largar/ }).click()
      await dv.waitForSelector('#pista')
      const corrida = await dv.evaluate(() => {
        const L = window.__galope.ui.lobby
        return { weather: L.sim.conditions.weather, clima: document.getElementById('clima-atual').textContent, devNext: window.__galope.ui.devNext,
          labareda: L.sim.events.some((e) => e.type === 'skill' && e.racer === L.playerIdx && /Labareda/.test(e.text)) }
      })
      if (corrida.weather !== 'nevoa' || !/Névoa/.test(corrida.clima)) problems.push('dev: clima da corrida ' + JSON.stringify(corrida))
      if (!corrida.labareda) problems.push('dev: com "skills sempre ativam" a Labareda (gatilho de largada) não ativou')
      if (corrida.devNext !== null) problems.push('dev: devNext não foi limpo depois da corrida')
      await dv.getByRole('button', { name: /Pular/ }).click()
      await dv.waitForSelector('#t-resultado')
      // 6. depois de pagar a entrada, o Ouro volta a 999 999 (acima disso só se o prêmio passar da entrada)
      const pago = await dv.evaluate(() => ({ gold: window.__galope.state.gold, fee: window.__galope.ui.result.fee, prize: window.__galope.ui.result.prize }))
      if (pago.fee <= 0 || pago.gold !== Math.max(999999, 999999 - pago.fee + pago.prize)) problems.push('dev: Ouro depois da corrida ' + JSON.stringify(pago))
      if ((await dv.locator('.dev-botao--armado').count()) !== 0) problems.push('dev: botão DEV continua armado depois da corrida')
      notes.dev = pago
      await conferirReal('depois da corrida')
      // 7. o save DEV gravado abre de novo com o cavalo DEV (template dev-2, skill exclusiva de outro elemento)
      //    e a peça. Numa página nova que já começa com esse save (o caminho de carga é o mesmo de um reload).
      const salvo = (await armazenado(dv)).dev
      const dv2 = await dv.context().newPage()
      dv2.on('pageerror', (e) => problems.push('[dev-2] pageerror: ' + e.message))
      await dv2.addInitScript({ content: `try { localStorage.setItem('galope-elemental:dev', ${JSON.stringify(salvo)}) } catch (e) {}` })
      await dv2.addInitScript(init)
      await dv2.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' })
      await dv2.waitForSelector('#t-estabulo')
      s = await dv2.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      const m2 = s.mounts.find((m) => m.uid === 'm2')
      if (!m2 || m2.level !== 30 || m2.templateId !== 'dev-2' || JSON.stringify(m2.skills) !== '["pe-na-chuva","labareda"]' || s.activeId !== 'm2') problems.push('dev: cavalo DEV ao abrir o save de novo ' + JSON.stringify(m2))
      if (!s.items.some((it) => it.id === 'armadura-chuva-lendario' && it.plus === 7)) problems.push('dev: peça Lendária sumiu ao abrir o save de novo')
      if (s.rev !== JSON.parse(salvo).rev) problems.push('dev: abrir o save DEV de novo gravou por cima (rev ' + s.rev + ')')
      await conferirReal('ao abrir o save de novo', dv2)
      await dv2.close()
      // 8. "Voltar ao jogo real" aponta para a página sem dev=1; "Zerar perfil" pede confirmação na própria gaveta
      //    (window.confirm não abre num iframe sem allow-modals, como o do artefato): "Cancelar" não mexe em nada,
      //    "Sim, zerar" volta à Brasa. Nenhum diálogo do navegador pode abrir.
      dv.on('dialog', (d) => { problems.push('dev: diálogo do navegador aberto: ' + d.message()); d.dismiss().catch(() => {}) })
      await devAbrir(dv)
      const href = await dv.locator('.dev-real').getAttribute('href')
      if (!href || /dev=1/.test(href) || !/preview\.html/.test(href)) problems.push('dev: "Voltar ao jogo real" com href ' + href)
      if ((await dv.locator('.dev-real-aviso').count()) !== 0) problems.push('dev: aviso do build de teste com ?dev=1 no preview')
      await dv.locator('[data-acao="dev-zerar"]').click()
      await dv.waitForSelector('.dev-gaveta [data-acao="dev-zerar-sim"]')
      await dv.locator('[data-acao="dev-zerar-nao"]').click()
      if ((await st()).mounts.length !== 2 || (await dv.locator('[data-acao="dev-zerar"]').count()) !== 1) problems.push('dev: "Cancelar" do Zerar perfil mexeu no perfil ou não voltou ao botão')
      await dv.locator('[data-acao="dev-zerar"]').click()
      await dv.locator('[data-acao="dev-zerar-sim"]').click()
      await dv.waitForSelector('#t-estabulo')
      s = await st()
      if (s.mounts.length !== 1 || s.mounts[0].templateId !== 'brasa' || s.items.length !== 2 || s.gold !== 999999) problems.push('dev: zerar perfil ' + JSON.stringify({ n: s.mounts.length, t: s.mounts[0].templateId, itens: s.items.length, gold: s.gold }))
      await conferirReal('depois de zerar')
      // 9. no modo DEV o "Recomeçar" do Perfil zera o perfil de teste: Brasa nível 1, sem a escolha inicial, e o
      //    botão DEV continua
      await devAbrir(dv)
      await dv.locator('[data-acao="dev-niveis"]').click()
      await devFechar(dv)
      const lv9 = (await st()).mounts[0].level
      await dv.locator('[data-acao="perfil"]').click()
      await dv.waitForSelector('#t-perfil')
      await dv.locator('[data-acao="reset"]').click()
      await dv.locator('[data-acao="reset-sim"]').click()
      await dv.waitForSelector('#t-estabulo')
      s = await st()
      if (lv9 !== 11 || s.mounts.length !== 1 || s.mounts[0].templateId !== 'brasa' || s.mounts[0].level !== 1 || s.gold !== 999999) problems.push('dev: Recomeçar no modo DEV ' + JSON.stringify({ lv9, n: s.mounts.length, t: s.mounts[0].templateId, lv: s.mounts[0].level, gold: s.gold }))
      if ((await dv.locator('.inicial').count()) !== 0 || (await dv.locator('.dev-botao').count()) !== 1) problems.push('dev: Recomeçar no modo DEV abriu a escolha inicial ou tirou o botão DEV')
      await conferirReal('depois do Recomeçar')
    } catch (e) {
      problems.push('dev: ' + e.message)
    }
    await dv.context().close()
  }

  // ---------------- build de teste (jogo-dev.html) e jogo.html, sem query ----------------
  // O artefato do claude.ai não repassa ?dev=1: o jogo-dev.html liga o modo DEV sozinho (window.__GALOPE_DEV), com o
  // save de teste e um aviso no lugar de "Voltar ao jogo real". O jogo.html sem query não tem nada do DEV.
  {
    const jd = await newPage(browser, { width: 390, height: 844 }, 'jogo-dev', { pagina: 'jogo-dev.html' })
    try {
      await jd.waitForSelector('#t-estabulo', { timeout: 5000 })   // perfil DEV novo: Brasa, sem a escolha inicial
      if (((await jd.locator('.dev-faixa').textContent()) || '').trim() !== 'MODO DEV — save de teste') problems.push('jogo-dev: sem a faixa "MODO DEV — save de teste"')
      const ls = await jd.evaluate(() => ({ dev: localStorage.getItem('galope-elemental:dev'), real: localStorage.getItem('galope-elemental:v1'), query: location.search, gold: window.__galope.state.gold }))
      if (!ls.dev || ls.real !== null || ls.query !== '' || ls.gold !== 999999) problems.push('jogo-dev: save ' + JSON.stringify({ dev: !!ls.dev, real: ls.real, query: ls.query, gold: ls.gold }))
      await devAbrir(jd)
      const aviso = (await jd.locator('.dev-real-aviso').count()) ? await jd.locator('.dev-real-aviso').textContent() : ''
      if ((await jd.locator('.dev-real').count()) !== 0 || !/build de teste/.test(aviso)) problems.push('jogo-dev: "Voltar ao jogo real" deveria virar o aviso do build de teste (' + aviso + ')')
      await checkOverflow(jd, 'jogo-dev-gaveta')
    } catch (e) {
      problems.push('jogo-dev: ' + e.message)
    }
    await jd.context().close()
    const jr = await newPage(browser, { width: 390, height: 844 }, 'jogo', { pagina: 'jogo.html' })
    try {
      await jr.waitForSelector('.inicial', { timeout: 5000 })
      if ((await jr.locator('.dev-painel, .dev-faixa, .dev-botao').count()) !== 0) problems.push('jogo: modo DEV no jogo.html sem query')
      await jr.getByRole('button', { name: 'Escolher Brasa' }).click()
      await jr.waitForSelector('#t-estabulo')
      const ls = await jr.evaluate(() => ({ dev: localStorage.getItem('galope-elemental:dev'), real: localStorage.getItem('galope-elemental:v1') }))
      if (ls.dev !== null || !ls.real) problems.push('jogo: o jogo.html deveria gravar só o save real ' + JSON.stringify({ dev: ls.dev, real: !!ls.real }))
    } catch (e) {
      problems.push('jogo: ' + e.message)
    }
    await jr.context().close()
  }

  // ---------------- Dado da Sorte na pista (DEV, seed fixa): plaquinhas, faixa, câmera lenta e "Pular" ----------------
  // A seed 101 no perfil DEV novo (Brasa nível 1) dá 7 cavalos e o vencedor do 1º Dado na tela (390 e 1280 px).
  // Se a corrida mudar (rivais, balanceamento), as seeds seguintes são tentadas até o vencedor aparecer.
  {
    const DADO_SEEDS = [101, 102, 103, 104, 105, 106]
    // corre até o 1º Dado; devolve o quadro logo depois da revelação (vencedor dourado, ainda na câmera lenta)
    const correAteDado = async (pg, seed, primeira) => {
      await devArmar(pg, { seed })
      if (primeira) {
        await pg.locator('[data-acao="aba"][data-id="correr"]').click()
        await pg.waitForSelector('#t-correr')
        await pg.getByRole('button', { name: 'Procurar corrida' }).click()
      } else {
        await pg.getByRole('button', { name: /Correr de novo|Treino gratuito/ }).click()
      }
      await pg.waitForSelector('#t-largada')
      await pg.getByRole('button', { name: /^Largar/ }).click()
      await pg.waitForSelector('#pista')
      await pg.getByRole('button', { name: 'x2' }).click()
      const dados = await pg.evaluate(() => window.__galope.race._state.fx.filter((x) => x.kind === 'dado')
        .map((d) => ({ t0: d.t0, t1: d.t1, e: d.escala, winner: d.winner, best: d.rolls[d.winner].best })))
      const it = dados[0]
      const q = await (await pg.waitForFunction((it) => {
        const s = window.__galope.race && window.__galope.race._state
        if (!s || s.simT < it.t0 + 0.7 * it.e) return false
        const st = window.RaceFx._stats
        return { simT: s.simT, slowK: s.slowK, dados: st.dados, faixa: st.faixaDado, particulas: st.particulas, placas: st.placas.slice(), ms: st.msQuadro, voce: s.voceRect }
      }, it, { timeout: 60000, polling: 'raf' })).jsonValue()
      return { dados, it, q, seed }
    }
    const dadoNaPista = async (vp, label, shotName, testaPular) => {
      const pg = await newPage(browser, vp, label, { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        let r = null
        for (let k = 0; k < DADO_SEEDS.length; k++) {
          r = await correAteDado(pg, DADO_SEEDS[k], k === 0)
          if (r.q.placas.some((p) => p.racer === r.it.winner)) break
          notes['dado-' + label + '-pulou-seed-' + r.seed] = 'vencedor do 1º Dado fora da tela'
          await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
          await pg.waitForSelector('#t-resultado')
          r = null
        }
        if (!r) { problems.push(`[${label}] Dado: nenhuma seed de ${DADO_SEEDS} deixou o vencedor do 1º Dado na tela`); return }
        await pg.screenshot({ path: join(SHOTS, shotName) })
        const { it, q } = r
        const venc = q.placas.find((p) => p.racer === it.winner)
        notes['dado-' + label] = { seed: r.seed, t0: it.t0, escala: +it.e.toFixed(3), winner: it.winner, best: it.best, slowK: q.slowK, dados: q.dados, faixa: q.faixa, particulas: q.particulas, placaVencedor: venc, msQuadro: +q.ms.toFixed(2) }
        if (!(q.dados >= 1)) problems.push(`[${label}] Dado: RaceFx._stats.dados = ${q.dados} na janela do Dado`)
        if (q.faixa !== true) problems.push(`[${label}] Dado: faixa "DADO DA SORTE" ausente na janela`)
        if (!(q.slowK < 1)) problems.push(`[${label}] Dado: sem câmera lenta logo depois da revelação (slowK ${q.slowK})`)
        if (!venc || venc.numero !== String(it.best) || !venc.vencedor || venc.fase !== 'mostra') problems.push(`[${label}] Dado: plaquinha do vencedor ${JSON.stringify(venc)} (esperado ${it.best})`)
        if (!(q.particulas > 0)) problems.push(`[${label}] Dado: vencedor sem faíscas (particulas = ${q.particulas})`)
        q.placas.forEach((p) => { if (p.fase !== 'mostra' || !/^\d+$/.test(p.numero)) problems.push(`[${label}] Dado: plaquinha ainda girando ou sem número ${JSON.stringify(p)}`) })
        // nenhuma plaquinha cobre a etiqueta "◀VOCÊ" nem outra plaquinha (pixels de arte)
        const cruza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        if (!q.voce) problems.push(`[${label}] Dado: etiqueta VOCÊ não registrada como obstáculo`)
        q.placas.forEach((p, i) => {
          if (q.voce && cruza(p, q.voce)) problems.push(`[${label}] Dado: plaquinha da raia ${p.racer + 1} cobre o "◀VOCÊ" ${JSON.stringify([p, q.voce])}`)
          q.placas.slice(i + 1).forEach((o) => { if (cruza(p, o)) problems.push(`[${label}] Dado: plaquinhas ${p.racer + 1} e ${o.racer + 1} sobrepostas`) })
        })
        await checkOverflow(pg, label + '-dado')
        if (testaPular) {
          // Review Focus 2: "Pular" durante a câmera lenta do 2º Dado abre o resultado sem efeito preso nem erro
          const it2 = r.dados[1]
          if (!it2) { problems.push(`[${label}] Dado: corrida sem o 2º Dado`); return }
          await pg.evaluate(() => {
            document.addEventListener('click', (ev) => {
              if (!ev.target.closest || !ev.target.closest('#btn-pular') || !window.__galope.race) return
              const s = window.__galope.race._state
              window.__pularEm = { simT: s.simT, slowK: s.slowK, faixa: window.RaceFx._stats.faixaDado }
            }, true)
          })
          await pg.waitForFunction((it) => {
            const s = window.__galope.race && window.__galope.race._state
            return s && s.simT >= it.t0 + 0.05 * it.e && s.slowK < 1
          }, it2, { timeout: 60000, polling: 'raf' })
          await pg.getByRole('button', { name: /Pular/ }).click()
          await pg.waitForSelector('#t-resultado')
          await sleep(300)
          const dep = await pg.evaluate(() => ({ em: window.__pularEm, race: !!window.__galope.race, st: { dados: window.RaceFx._stats.dados, faixa: window.RaceFx._stats.faixaDado, placas: window.RaceFx._stats.placas.length } }))
          notes['dado-pular-' + label] = dep
          if (!dep.em || !(dep.em.slowK < 1) || dep.em.faixa !== true) problems.push(`[${label}] Dado: o "Pular" não foi clicado durante a câmera lenta ${JSON.stringify(dep.em)}`)
          if (dep.race || dep.st.dados !== 0 || dep.st.faixa !== false || dep.st.placas !== 0) problems.push(`[${label}] Dado: efeito preso depois do "Pular" ${JSON.stringify(dep)}`)
        }
      } catch (e) {
        problems.push(`[${label}] Dado: ${e.message}`)
      } finally {
        await pg.context().close()
      }
    }
    await dadoNaPista({ width: 390, height: 844 }, 'dado390', 'final-12-dado.png', true)
    await dadoNaPista({ width: 1280, height: 800 }, 'dado1280', 'final-desktop-dado.png', false)
  }

  // ---------------- Skills visíveis (DEV): balão, faixa central, contorno e "skills sempre ativam" ----------------
  // Cavalo Raro (chance de skill 0,55; a Comum só tem 1 vaga, o Mágico 2) com Arranque e Labareda (largada, as duas
  // juntas em t = 0) e Arrancada Final (reta final, gatilho certo). Primeiro acha uma seed em que, SEM armar, as três
  // não ativam; depois repete a mesma seed armada com "skills sempre ativam" e confere que as três ativam, com
  // balões presos à raia, faixa central em sequência e contorno da silhueta.
  {
    const SK_SEEDS = [301, 302, 303, 304, 305, 306, 307, 308]
    const preparar = async (pg) => {
      await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
      await devAbrir(pg)
      await pg.fill('#dev-nome', 'Skill DEV')
      await pg.selectOption('#dev-elemento', 'fogo')
      await pg.selectOption('#dev-raridade', 'raro')
      await pg.fill('#dev-nivel', '1')
      const sks = ['arranque', 'labareda', 'arrancada-final', '', '']
      for (let k = 0; k < 5; k++) await pg.selectOption('#dev-skill' + k, sks[k])
      await pg.locator('[data-acao="dev-criar"]').click()
      await devFechar(pg)
    }
    const largar = async (pg, seed, sempre, primeira) => {
      await devArmar(pg, { seed, sempre })
      if (primeira) {
        await pg.locator('[data-acao="aba"][data-id="correr"]').click()
        await pg.waitForSelector('#t-correr')
        await pg.getByRole('button', { name: 'Procurar corrida' }).click()
      } else {
        await pg.getByRole('button', { name: /Correr de novo|Treino gratuito/ }).click()
      }
      await pg.waitForSelector('#t-largada')
      await pg.getByRole('button', { name: /^Largar/ }).click()
      await pg.waitForSelector('#pista')
    }
    const skillsDoJogador = (pg) => pg.evaluate(() => {
      const L = window.__galope.ui.lobby
      return L.sim.events.filter((e) => e.type === 'skill' && e.racer === L.playerIdx).map((e) => e.text)
    })
    const gravador = (pg) => pg.evaluate(() => {
      const g = window.__sk = { faixas: [], faixasT: [], baloesMax: 0, partMax: 0, baloesTipos: {}, cobriuVoce: 0, forasDaRaia: 0, cruzaOutro: 0, quadros: 0 }
      const cruza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      const tick = () => {
        const r = window.__galope.race
        if (!r) return
        const st = window.RaceFx._stats
        g.quadros++
        if (st.faixaSkill && !g.faixas.includes(st.faixaSkill)) { g.faixas.push(st.faixaSkill); g.faixasT.push(r._state.simT) }
        g.baloesMax = Math.max(g.baloesMax, st.baloes); g.partMax = Math.max(g.partMax, st.particulas)
        const voce = r._state.voceRect
        st.caixasBaloes.forEach((b) => {
          g.baloesTipos[b.kind] = (g.baloesTipos[b.kind] || 0) + 1
          if (voce && cruza(b, voce)) g.cobriuVoce++
          if (b.pilha !== 0) return
          // o balão mais novo fica na faixa vertical da própria raia e não cruza a caixa de nenhum OUTRO cavalo
          if (b.y < b.y0 || b.y + b.h > b.y1) g.forasDaRaia++
          const o = st.caixasCavalos.find((c) => c.racer !== b.racer && cruza(b, c))
          if (o) { g.cruzaOutro++; g.exemplo = g.exemplo || { balao: b, cavalo: o, simT: r._state.simT } }
        })
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const skillsNaPista = async (vp, label, shotName, extra) => {
      const pg = await newPage(browser, vp, label, { query: '?dev=1', ...extra })
      try {
        await preparar(pg)
        // 1) uma seed em que, sem armar, as duas skills não ativam
        let seed = null, semArmar = null
        for (let k = 0; k < SK_SEEDS.length; k++) {
          await largar(pg, SK_SEEDS[k], false, k === 0)
          semArmar = await skillsDoJogador(pg)
          await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
          await pg.waitForSelector('#t-resultado')
          if (semArmar.length < 3) { seed = SK_SEEDS[k]; break }
        }
        if (seed == null) { problems.push(`[${label}] skills: nenhuma seed de ${SK_SEEDS} deixa o cavalo Raro sem as três skills`); return }
        // 2) a mesma seed, armada: as duas ativam
        await largar(pg, seed, true, false)
        const armada = await skillsDoJogador(pg)
        if (armada.length !== 3 || !/Arranque/.test(armada.join(' ')) || !/Labareda/.test(armada.join(' ')) || !/Arrancada Final/.test(armada.join(' '))) problems.push(`[${label}] skills: sempre ativam deu ${JSON.stringify(armada)} (sem armar: ${JSON.stringify(semArmar)})`)
        await gravador(pg)
        // logo depois da largada: balão + faixa central com o nome da skill do jogador
        const q = await (await pg.waitForFunction(() => {
          const st = window.RaceFx._stats, s = window.__galope.race && window.__galope.race._state
          return st.baloes >= 1 && st.faixaSkill && s ? { baloes: st.baloes, faixa: st.faixaSkill, simT: s.simT, part: st.particulas, ms: st.msQuadro } : false
        }, null, { timeout: 30000, polling: 'raf' })).jsonValue()
        await pg.screenshot({ path: join(SHOTS, shotName) })
        if (!/ARRANQUE|LABAREDA/.test(q.faixa)) problems.push(`[${label}] skills: faixa central ${JSON.stringify(q.faixa)} (esperado ARRANQUE! ou LABAREDA!)`)
        notes['skills-' + label] = { seed, semArmar: semArmar.length, armada: armada.length, baloes: q.baloes, faixa: q.faixa, simT: +q.simT.toFixed(2), msQuadro: +q.ms.toFixed(2) }
        // meio do efeito (contorno aceso): 2 s reais depois da largada, a Labareda/Arranque ainda duram
        await pg.waitForFunction(() => { const s = window.__galope.race && window.__galope.race._state; return s && s.simT >= 0.5 * (s.fx.find((x) => x.kind === 'skill').escala) * 2 && s.simT < 3 * s.fx.find((x) => x.kind === 'skill').escala }, null, { timeout: 30000, polling: 'raf' })
        await pg.screenshot({ path: join(SHOTS, shotName.replace('.png', '-contorno.png')) })
        // 3) até a reta final: a terceira skill também aparece
        await pg.getByRole('button', { name: 'x2' }).click()
        const fim = await pg.evaluate(() => window.__galope.race._state.fx.filter((x) => x.kind === 'skill').map((x) => ({ t0: x.t0, e: x.escala, icon: x.icon })))
        const ult = fim[fim.length - 1]
        await pg.waitForFunction((u) => { const s = window.__galope.race && window.__galope.race._state; return !s || s.simT >= u.t0 + 1.7 * u.e }, ult, { timeout: 90000, polling: 'raf' })
        const g = await pg.evaluate(() => window.__sk)
        if (!g.faixas.some((f) => /ARRANCADA FINAL/.test(f))) problems.push(`[${label}] skills: faixa da Arrancada Final nunca apareceu ${JSON.stringify(g.faixas)}`)
        if (!['ARRANQUE!', 'LABAREDA!'].every((f) => g.faixas.includes(f))) problems.push(`[${label}] skills: as duas skills de t = 0 não ganharam faixa ${JSON.stringify(g.faixas)}`)
        else {
          const esc = await pg.evaluate(() => window.__galope.race._state.fx.find((x) => x.kind === 'skill').escala)
          const t1 = g.faixasT[g.faixas.indexOf('ARRANQUE!')], t2 = g.faixasT[g.faixas.indexOf('LABAREDA!')]
          if (Math.abs(t2 - t1) < 1.3 * esc) problems.push(`[${label}] skills: faixas das duas skills de t = 0 não entram em sequência (${t1.toFixed(2)} e ${t2.toFixed(2)}, escala ${esc.toFixed(2)})`)
        }
        if (g.forasDaRaia) problems.push(`[${label}] skills: balão fora da faixa vertical da própria raia em ${g.forasDaRaia} quadro(s)`)
        if (g.cruzaOutro) problems.push(`[${label}] skills: balão cruzou a caixa de outro cavalo em ${g.cruzaOutro} quadro(s) ${JSON.stringify(g.exemplo)}`)
        if (g.cobriuVoce) problems.push(`[${label}] skills: balão cobriu o "◀VOCÊ" em ${g.cobriuVoce} quadro(s)`)
        if (!g.baloesTipos.skill) problems.push(`[${label}] skills: nenhum balão de skill posicionado ${JSON.stringify(g.baloesTipos)}`)
        notes['skills-' + label + '-corrida'] = g
        if (extra && extra.reducedMotion === 'reduce' && g.partMax !== 0) problems.push(`[${label}] skills: movimento reduzido com ${g.partMax} partículas`)
        if (!(extra && extra.reducedMotion === 'reduce') && !(g.partMax > 0)) problems.push(`[${label}] skills: sem partículas de efeito (vento/faíscas) no modo normal`)
        await checkOverflow(pg, label)
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado')
      } catch (e) {
        problems.push(`[${label}] skills: ${e.message}`)
      } finally {
        await pg.context().close()
      }
    }
    await skillsNaPista({ width: 390, height: 844 }, 'skills390', 'final-13-skills.png')
    await skillsNaPista({ width: 390, height: 844 }, 'skills390-reduzido', 'final-13-skills-reduzido.png', { reducedMotion: 'reduce' })
  }

  // ---------------- Natureza, vento e opção "Animações" (Task 5) ----------------
  {
    // largada DEV com a próxima corrida armada: do resultado pelo "Correr de novo"; senão pela aba Correr
    const largaDev = async (pg, arma) => {
      await devArmar(pg, arma)
      if (!(await pg.locator('#t-resultado').count())) {
        await pg.locator('[data-acao="aba"][data-id="correr"]').click()
        await pg.waitForSelector('#t-correr')
        await pg.getByRole('button', { name: 'Procurar corrida' }).click()
      } else {
        await pg.getByRole('button', { name: /Correr de novo|Treino gratuito/ }).click()
      }
      await pg.waitForSelector('#t-largada')
      await pg.getByRole('button', { name: /^Largar/ }).click()
      await pg.waitForSelector('#pista')
    }
    const pular = async (pg) => {
      await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
      await pg.waitForSelector('#t-resultado')
    }
    // Perfil -> opção Animações -> volta; confere o botão marcado e a classe do CSS
    const animacoes = async (pg, modo, label) => {
      if (await pg.locator('#t-resultado').count()) {   // o resultado não tem a casca: "Voltar" leva à aba Correr
        await pg.locator('[data-acao="voltar"]').click()
        await pg.waitForSelector('#t-correr')
      }
      await pg.locator('[data-acao="perfil"]').click()
      await pg.waitForSelector('#t-perfil')
      await pg.locator(`[data-acao="motion"][data-id="${modo}"]`).click()
      if ((await pg.locator(`[data-acao="motion"][data-id="${modo}"][aria-pressed="true"]`).count()) !== 1) problems.push(`[${label}] Animações: "${modo}" não ficou marcada`)
      const r = await pg.evaluate(() => ({ motion: window.__galope.state.settings.motion, classe: document.documentElement.classList.contains('mov-reduzido') }))
      if (r.motion !== modo) problems.push(`[${label}] Animações: state.settings.motion = ${r.motion} (esperado ${modo})`)
      await pg.locator('[data-acao="perfil-voltar"]').click()
      await pg.waitForSelector('#t-perfil', { state: 'detached' })
      return r
    }
    // recorte do canvas que só a chuva muda durante a contagem: o gramado interno, abaixo da cerca de dentro
    // (cavalos e câmera parados). Com vento CALMO a grama da borda e os tufos não balançam e não há folhas,
    // e os respingos ficam na pista (fora do recorte): sobra só a chuva. Com a chuva congelada (drawNature
    // com t = 0), dois recortes seguidos são iguais — mesmo que o cenário (drawTrack) continue andando.
    const recorte = (pg) => pg.evaluate(() => {
      const cv = document.getElementById('pista'), s = window.__galope.race._state, L = s.lay
      const y0 = (L.laneTopArt + window.__galope.ui.lobby.n * L.laneArt + 5) * s.S
      const d = cv.getContext('2d').getImageData(0, y0, cv.width, cv.height - y0).data
      let h = 0
      for (let i = 0; i < d.length; i += 3) h = (Math.imul(h, 31) + d[i]) >>> 0
      return { h, fase: s.phase, t: +s.tReal.toFixed(2), pingos: window.RaceFx._stats.natureza.pingos }
    })
    const estadoNat = (pg) => pg.evaluate(() => ({
      nat: JSON.parse(JSON.stringify(window.RaceFx._stats.natureza)), hud: window.RaceFx._stats.ventoHud,
      vento: window.__galope.race._state.wind, ms: +window.RaceFx._stats.msQuadro.toFixed(2)
    }))
    const ateMeio = async (pg, frac) => {
      await pg.getByRole('button', { name: 'x2' }).click()
      await pg.waitForFunction((f) => {
        const r = window.__galope.race, L = window.__galope.ui.lobby
        return r && r._state.simT >= f * L.sim.finishTimes[L.playerIdx]
      }, frac, { timeout: 60000, polling: 'raf' })
      await pg.getByRole('button', { name: 'x1' }).click()
      await sleep(200)
    }

    // 1. Save v4 antigo, sem settings (todo save real de hoje): carrega com "Seguir o sistema" sem perder
    //    nada; a escolha grava no save e vale para o CSS (Review Focus 3)
    {
      const p1 = await newPage(browser, { width: 390, height: 844 }, 'save-antigo')
      try {
        await p1.getByRole('button', { name: 'Escolher Brasa' }).click()
        await p1.waitForSelector('#t-estabulo')
        const velho = await p1.evaluate(() => {
          const s = JSON.parse(localStorage.getItem('galope-elemental:v1'))
          delete s.settings
          s.gold = 4321; s.races = 9; s.wins = 2
          return s
        })
        if (velho.v !== 4 || 'settings' in velho) problems.push('save-antigo: o save montado não é um v4 sem settings ' + JSON.stringify({ v: velho.v }))
        const ctx1 = p1.context()
        await p1.close()
        const p2 = await ctx1.newPage()
        p2.on('pageerror', (e) => problems.push('[save-antigo] pageerror: ' + e.message))
        p2.on('console', (m) => { if (m.type() === 'error') problems.push('[save-antigo] console: ' + m.text()) })
        await p2.addInitScript({ content: `try { localStorage.setItem('galope-elemental:v1', ${JSON.stringify(JSON.stringify(velho))}) } catch (e) {}` })
        await p2.goto(URL, { waitUntil: 'domcontentloaded' })
        await p2.waitForSelector('#t-estabulo')
        const s = await p2.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
        if (!s.settings || s.settings.motion !== 'sistema') problems.push('save-antigo: settings ' + JSON.stringify(s.settings) + ' (esperado { motion: "sistema" })')
        if (s.v !== 4 || s.gold !== 4321 || s.races !== 9 || s.wins !== 2 || s.mounts.length !== velho.mounts.length || s.items.length !== velho.items.length || s.mounts[0].templateId !== 'brasa') {
          problems.push('save-antigo: o save perdeu dados ao migrar ' + JSON.stringify({ v: s.v, gold: s.gold, races: s.races, wins: s.wins, mounts: s.mounts.length, items: s.items.length }))
        }
        await p2.locator('[data-acao="perfil"]').click()
        await p2.waitForSelector('#t-perfil')
        const marcado = ((await p2.locator('[data-acao="motion"][aria-pressed="true"]').textContent()) || '').trim()
        if (marcado !== 'Seguir o sistema') problems.push('save-antigo: o Perfil marca "' + marcado + '" (esperado "Seguir o sistema")')
        if ((await p2.locator('#r-animacoes').textContent()) !== 'Animações' || (await p2.locator('[data-acao="motion"]').count()) !== 3) problems.push('save-antigo: grupo "Animações" com 3 escolhas ausente no Perfil')
        await checkOverflow(p2, 'perfil-animacoes')
        await p2.screenshot({ path: join(SHOTS, 'final-17-perfil-animacoes.png') })
        // gravar: Reduzidas vai para o save e liga a classe do CSS; Completas desliga
        await p2.locator('[data-acao="motion"][data-id="reduzidas"]').click()
        const g1 = await p2.evaluate(() => ({ salvo: JSON.parse(localStorage.getItem('galope-elemental:v1')).settings, classe: document.documentElement.classList.contains('mov-reduzido') }))
        if (!g1.salvo || g1.salvo.motion !== 'reduzidas' || !g1.classe) problems.push('save-antigo: "Reduzidas" não gravou ou não ligou mov-reduzido ' + JSON.stringify(g1))
        await p2.locator('[data-acao="motion"][data-id="completas"]').click()
        const g2 = await p2.evaluate(() => ({ salvo: JSON.parse(localStorage.getItem('galope-elemental:v1')).settings, classe: document.documentElement.classList.contains('mov-reduzido') }))
        if (!g2.salvo || g2.salvo.motion !== 'completas' || g2.classe) problems.push('save-antigo: "Completas" não gravou ou deixou mov-reduzido ' + JSON.stringify(g2))
        // "Recomeçar": na tela de escolha (sem save) a opção continua valendo, sobrevive a fechar a aba e
        // passa para o save novo
        await p2.locator('[data-acao="motion"][data-id="reduzidas"]').click()
        await p2.locator('[data-acao="reset"]').click()
        await p2.locator('[data-acao="reset-sim"]').click()
        await p2.waitForSelector('.inicial')
        const e1 = await p2.evaluate(() => ({ classe: document.documentElement.classList.contains('mov-reduzido'), save: localStorage.getItem('galope-elemental:v1') }))
        if (!e1.classe || e1.save !== null) problems.push('save-antigo: na escolha inicial depois de Recomeçar, "Reduzidas" não vale ' + JSON.stringify(e1))
        await p2.close()
        const p3 = await ctx1.newPage()
        p3.on('pageerror', (e) => problems.push('[save-antigo-3] pageerror: ' + e.message))
        await p3.goto(URL, { waitUntil: 'domcontentloaded' })
        // como newPage: espera o jogo e os moldes (a tela é redesenhada quando eles chegam)
        await p3.waitForFunction(() => window.__galope && window.Sprites && window.Sprites.moldsReady === true, null, { timeout: 8000 })
        await p3.waitForFunction(() => window.__galope.ui.screen === 'inicial' && !!document.querySelector('.inicial'), null, { timeout: 10000 })
        const e2 = await p3.evaluate(() => document.documentElement.classList.contains('mov-reduzido'))
        if (!e2) problems.push('save-antigo: "Reduzidas" se perdeu ao fechar a aba na escolha inicial')
        await p3.getByRole('button', { name: 'Escolher Ipê' }).click()
        await p3.waitForSelector('#t-estabulo')
        const e3 = await p3.evaluate(() => ({ motion: window.__galope.state.settings.motion, salvo: JSON.parse(localStorage.getItem('galope-elemental:v1')).settings }))
        if (e3.motion !== 'reduzidas' || !e3.salvo || e3.salvo.motion !== 'reduzidas') problems.push('save-antigo: o save novo não herdou "Reduzidas" ' + JSON.stringify(e3))
        notes.saveAntigo = { settings: s.settings, gravado: [g1, g2], escolha: { e1: e1.classe, e2, e3 } }
        await p3.context().close()
      } catch (e) {
        problems.push('save-antigo: ' + e.message)
        await p1.context().close().catch(() => {})
      }
    }

    // 2. Em 360 px, com o aparelho pedindo menos movimento (reducedMotion: 'reduce'): em "Completas" a chuva anda;
    //    em "Reduzidas" também anda (mais devagar, metade dos pingos) — nada congela. Em "Completas", uma corrida
    //    com tudo ligado (chuva, ventania, "skills sempre ativam") até o 1º Dado na tela: selo do vento, chuva,
    //    skill do jogador, sem rolagem horizontal e com o canvas dentro da tela (Review Focus 5); depois a
    //    captura da chuva com ventania.
    {
      const pg = await newPage(browser, { width: 360, height: 780 }, 'animacoes', { query: '?dev=1', reducedMotion: 'reduce' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        const r0 = await pg.evaluate(() => ({ motion: window.__galope.state.settings.motion, classe: document.documentElement.classList.contains('mov-reduzido') }))
        if (r0.motion !== 'sistema' || !r0.classe) problems.push('animacoes: perfil novo sem "sistema" ou sem mov-reduzido com o aparelho em reduce ' + JSON.stringify(r0))
        const vistos = {}
        for (const modo of ['completas', 'reduzidas']) {
          const r = await animacoes(pg, modo, 'animacoes')
          if (r.classe !== (modo === 'reduzidas')) problems.push(`animacoes: classe mov-reduzido = ${r.classe} em "${modo}"`)
          await largaDev(pg, { clima: 'chuva', vento: 'calmo', seed: 4242 })
          const a = await recorte(pg)
          await sleep(350)
          const b = await recorte(pg)
          vistos[modo] = { a, b }
          if (a.fase !== 'contagem' || b.fase !== 'contagem') problems.push(`animacoes: recortes fora da contagem em "${modo}" ${JSON.stringify([a, b])}`)
          else if (a.h === b.h) problems.push(`animacoes: a chuva congelou em "${modo}" (recortes iguais em t ${a.t} e ${b.t})`)
          await pular(pg)
          if (modo === 'completas') {
            // tudo ligado (outra corrida: a do recorte é com vento calmo). Antes do 1º Dado o clima ainda é o
            // forçado (só o Dado o vira): estado da natureza e captura da chuva com ventania; depois, no Dado
            await largaDev(pg, { clima: 'chuva', vento: 'ventania', direcao: 1, sempre: true, seed: 4242 })
            const t0 = await pg.evaluate(() => window.__galope.race._state.fx.filter((x) => x.kind === 'dado')[0].t0)
            await pg.getByRole('button', { name: 'x2' }).click()
            await pg.waitForFunction((t) => { const r = window.__galope.race; return r && r._state.simT >= t }, 0.85 * t0, { timeout: 60000, polling: 'raf' })
            await pg.getByRole('button', { name: 'x1' }).click()
            await sleep(200)
            const e = await estadoNat(pg)
            vistos.meio = e
            if (!(e.nat.pingos > 0 && e.nat.respingos > 0 && e.nat.folhas > 0)) problems.push('animacoes: chuva com ventania sem pingos, respingos ou folhas ' + JSON.stringify(e.nat))
            if (!e.hud) problems.push('animacoes: selo do vento ausente no HUD em 360')
            if (JSON.stringify(e.vento) !== JSON.stringify({ intensity: 'ventania', dir: 1 })) problems.push('animacoes: vento forçado não chegou à corrida ' + JSON.stringify(e.vento))
            await pg.screenshot({ path: join(SHOTS, 'final-14-chuva-vento.png') })
            await pg.getByRole('button', { name: 'x2' }).click()
            const q = await (await pg.waitForFunction(() => {
              const st = window.RaceFx._stats
              return st.faixaDado && st.dados >= 1 ? { dados: st.dados, hud: st.ventoHud, baloes: st.baloes } : false
            }, null, { timeout: 60000, polling: 'raf' })).jsonValue()
            const skills = await pg.evaluate(() => { const L = window.__galope.ui.lobby; return L.sim.events.filter((e) => e.type === 'skill' && e.racer === L.playerIdx).length })
            vistos.tudo = { ...q, skillsJogador: skills }
            if (!q.hud) problems.push('animacoes (tudo ligado): sem selo do vento no Dado ' + JSON.stringify(q))
            if (!(skills > 0)) problems.push('animacoes (tudo ligado): "skills sempre ativam" sem skill do jogador')
            await checkOverflow(pg, 'tudo360-dado')
            const cv = await pg.evaluate(() => { const r = document.getElementById('pista').getBoundingClientRect(); return { right: r.right, vw: document.documentElement.clientWidth } })
            if (cv.right > cv.vw + 0.5) problems.push('animacoes (tudo ligado): canvas passa da largura da tela ' + JSON.stringify(cv))
            await pular(pg)
          }
        }
        const pc = vistos.completas.a.pingos, pr = vistos.reduzidas.a.pingos
        if (!(pr > 0 && pr <= Math.ceil(pc / 2))) problems.push(`animacoes: "Reduzidas" deveria ter metade dos pingos (${pr} de ${pc})`)
        notes.animacoes = vistos
      } catch (e) {
        problems.push('animacoes: ' + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 3. Desempenho (1280, chuva + ventania, traçado "curvas": sem o relevo da subida, que é lento por si):
    //    msQuadro médio em "Completas" menos o de "Reduzidas" ≤ 6 ms (meta da spec: 2 ms)
    {
      const pg = await newPage(browser, { width: 1280, height: 800 }, 'desempenho', { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        const ms = {}
        for (const modo of ['completas', 'reduzidas']) {
          await animacoes(pg, modo, 'desempenho')
          await largaDev(pg, { clima: 'chuva', vento: 'ventania', tracado: 'curvas', seed: 4242 })
          // amostras com 120 e 240 quadros de corrida (a média móvel cobre os 60 últimos: fora da contagem)
          const q0 = await (await pg.waitForFunction(() => {
            const r = window.__galope.race
            return r && r._state.phase === 'corrida' ? window.RaceFx._stats.quadros : false
          }, null, { timeout: 60000, polling: 'raf' })).jsonValue()
          const amostras = []
          for (const q of [120, 240]) {
            amostras.push(await (await pg.waitForFunction((q) => {
              const r = window.__galope.race, st = window.RaceFx._stats
              return r && r._state.phase === 'corrida' && st.quadros >= q ? st.msQuadro : false
            }, q0 + q, { timeout: 60000, polling: 'raf' })).jsonValue())
          }
          const nat = await pg.evaluate(() => window.RaceFx._stats.natureza)
          ms[modo] = { media: +(amostras.reduce((a, b) => a + b, 0) / amostras.length).toFixed(2), amostras: amostras.map((x) => +x.toFixed(2)), pingos: nat.pingos }
          await pular(pg)
        }
        ms.diferenca = +(ms.completas.media - ms.reduzidas.media).toFixed(2)
        notes.desempenho = ms
        if (ms.diferenca > 6) problems.push(`desempenho: "Completas" ${ms.completas.media} ms contra "Reduzidas" ${ms.reduzidas.media} ms por quadro (diferença ${ms.diferenca} > 6)`)
        if (!(ms.completas.pingos > ms.reduzidas.pingos)) problems.push('desempenho: "Reduzidas" sem menos pingos ' + JSON.stringify(ms))
      } catch (e) {
        problems.push('desempenho: ' + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 4. Sol (piso de terra: poeira dos cascos, raios e calor) e névoa (camadas de trás e da frente) em 390
    {
      const pg = await newPage(browser, { width: 390, height: 844 }, 'natureza390', { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await largaDev(pg, { clima: 'sol', vento: 'brisa', direcao: -1, piso: 'terra', tracado: 'curvas', seed: 12 })
        await ateMeio(pg, 0.25)
        const sol = await estadoNat(pg)
        await pg.screenshot({ path: join(SHOTS, 'final-15-sol.png') })
        if (!(sol.nat.raios > 0 && sol.nat.calor > 0 && sol.nat.poeiraCascos > 0 && sol.nat.folhas > 0)) problems.push('natureza390: sol sem raios, calor, poeira dos cascos ou folhas ' + JSON.stringify(sol.nat))
        if (JSON.stringify(sol.vento) !== JSON.stringify({ intensity: 'brisa', dir: -1 })) problems.push('natureza390: vento forçado (brisa ←) não chegou à corrida ' + JSON.stringify(sol.vento))
        await pular(pg)
        await largaDev(pg, { clima: 'sol', vento: 'brisa', direcao: 1, piso: 'areia', tracado: 'curvas', seed: 12 })
        await ateMeio(pg, 0.25)
        const areia = await estadoNat(pg)
        await pg.screenshot({ path: join(SHOTS, 'final-15b-sol-areia.png') })
        if (!(areia.nat.raios > 0 && areia.nat.calor > 0 && areia.nat.poeiraCascos > 0)) problems.push('natureza390: sol na areia sem raios, calor ou poeira dos cascos ' + JSON.stringify(areia.nat))
        await pular(pg)
        await largaDev(pg, { clima: 'nevoa', vento: 'ventania', direcao: -1, tracado: 'curvas', seed: 13 })
        await ateMeio(pg, 0.25)
        const nev = await estadoNat(pg)
        await pg.screenshot({ path: join(SHOTS, 'final-16-nevoa.png') })
        if (!(nev.nat.nevoa > 0 && nev.nat.nevoaFrente > 0 && nev.nat.folhas > 0)) problems.push('natureza390: névoa sem as duas camadas ou sem folhas ' + JSON.stringify(nev.nat))
        notes.natureza390 = { sol, areia, nevoa: nev }
        await pular(pg)
      } catch (e) {
        problems.push('natureza390: ' + e.message)
      } finally {
        await pg.context().close()
      }
    }
  }

  // ---------------- Curvas: traçado na sala, minimapa no HUD e arco na pista (Task 6) ----------------
  // DEV, traçado "curvas" (1600 m em 7 blocos de ~230 m, os 5 do meio em curva: no desenho, uma curva só de
  // 230 a 1370 m — RaceFx.curveRuns). Sala: o mapa é o traçado visto de cima (pixels da cor da curva e o xadrez
  // da chegada). Corrida: no meio da curva o cavalo do jogador e a etiqueta "◀VOCÊ" sobem o arco inteiro
  // (round(6 · lay.arcoK) px de arte) em relação à reta, a cerca externa desenhada no canvas sobe o mesmo
  // (pixels: o trilho branco com a borda escura em cima), as caixas dos cavalos (usadas por balões e
  // plaquinhas) sobem junto, o minimapa é desenhado fora do layout compacto e o cavalo nunca sai da tela
  // (startCamMonitor, também na vertical).
  {
    const corCurva = G.BLOCK_TYPES.curva.color
    const curvas = async (vp, label, shotSala, shotCorrida) => {
      const pg = await newPage(browser, vp, label, { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await devArmar(pg, { clima: 'sol', vento: 'calmo', tracado: 'curvas', distancia: 1600, seed: 4242 })
        await pg.locator('[data-acao="aba"][data-id="correr"]').click()
        await pg.waitForSelector('#t-correr')
        await pg.getByRole('button', { name: 'Procurar corrida' }).click()
        await pg.waitForSelector('#t-largada')
        // 1) sala: o traçado visto de cima — os 5 blocos de curva colados são um U de 180°, então a cor da
        //    curva aparece em muitas linhas do mapa (a faixa reta antiga tinha 5 linhas + o rótulo) — e a
        //    chegada em xadrez
        const mapa = await pg.evaluate((cor) => {
          const cv = document.querySelector('canvas.perfil'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
          const k = Math.round(cv.width / Math.max(1, Math.round(parseFloat(cv.style.width) / 2)))   // px do canvas por px de arte
          const rgb = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16))
          let curva = 0, xadrez = 0
          const linhas = new Set()
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2]) { curva++; linhas.add(Math.floor(i / 4 / cv.width / k)) }
            if (d[i] === 0x14 && d[i + 1] === 0x12 && d[i + 2] === 0x18) xadrez++
          }
          const r = cv.getBoundingClientRect(), pr = cv.parentElement.getBoundingClientRect()
          return { curva, linhasCurva: linhas.size, xadrez, k, w: Math.round(r.width), h: Math.round(r.height), cabe: r.left >= pr.left - 0.5 && r.right <= pr.right + 0.5 }
        }, corCurva)
        if (!(mapa.linhasCurva >= 20 && mapa.xadrez > 0 && mapa.cabe)) problems.push(`[${label}] sala: mapa sem o traçado das curvas, sem a chegada ou fora da caixa ${JSON.stringify(mapa)}`)
        await checkOverflow(pg, label + '-sala')
        await pg.locator('canvas.perfil').scrollIntoViewIfNeeded()
        if (shotSala) await pg.screenshot({ path: join(SHOTS, shotSala) })
        // 2) corrida em x1: a referência na primeira reta, depois o meio da primeira curva
        await pg.getByRole('button', { name: /^Largar/ }).click()
        await pg.waitForSelector('#pista')
        await startCamMonitor(pg)
        const medir = (faixa) => pg.waitForFunction((fx) => {
          const r = window.__galope.race, L = window.__galope.ui.lobby
          if (!r || r._state.phase !== 'corrida') return false
          const s = r._state, st = window.RaceFx._stats, me = L.playerIdx
          const f = L.sim.frames[Math.min(L.sim.frames.length - 1, Math.round(s.simT / L.sim.dt))]
          const p = f.pos[me], cv = st.caixasCavalos.find((c) => c.racer === me)
          if (!cv || !s.voceRect || f.speed[me] < 3) return false
          if (fx.reta) { if (!(p > 60 && p < 180)) return false } else {
            // o meio da SEQUÊNCIA de curva (blocos colados juntos, como o desenho)
            const c = window.RaceFx.curveRuns(L.cond.curves || []).find((cc) => p > cc[0] && p < cc[1])
            if (!c || c[1] - c[0] < 150) return false
            const u = (p - c[0]) / (c[1] - c[0])
            if (u < 0.42 || u > 0.58) return false
          }
          const arcoK = s.lay.arcoK === undefined ? 1 : s.lay.arcoK
          // cerca externa no canvas (o último quadro desenhado): em colunas a cada 3 px de arte, a 1ª linha, de
          // baixo para cima a partir do topo da raia 1, em que o trilho branco (#f6f2ea) tem a borda escura
          // (#1c1820) 1 px de arte acima; vale a linha mais comum (placas, cavalos e efeitos cobrem algumas
          // colunas). Na reta, só os 40 % de trás da tela (a frente pode já estar na curva).
          const cvEl = document.getElementById('pista'), g = cvEl.getContext('2d'), S = s.S, top = Math.round(s.lay.laneTopArt * S)
          const y0 = Math.max(0, top - 24 * S), w = cvEl.width, d = g.getImageData(0, y0, w, top - y0).data
          const px = (x, y) => { const i = ((y - y0) * w + x) * 4; return [d[i], d[i + 1], d[i + 2]] }
          const conta = new Map()
          let colunas = 0
          for (let x = Math.floor(S / 2); x < (fx.reta ? Math.floor(w * 0.4) : w); x += 3 * S) {
            colunas++
            for (let y = top - 1; y - S >= y0; y--) {
              const a = px(x, y), b = px(x, y - S)
              if (Math.min(...a) >= 200 && Math.max(...a) - Math.min(...a) <= 40 && a.every((v, i) => v - b[i] >= 90)) { conta.set(y, (conta.get(y) || 0) + 1); break }
            }
          }
          let cerca = null, votos = 0
          conta.forEach((v, y) => { if (v > votos) { votos = v; cerca = y } })
          return { p: +p.toFixed(1), y: cv.y, h: cv.h, voce: s.voceRect.y, mini: !!st.minimapa, compact: s.lay.compact, arcoK, ms: +st.msQuadro.toFixed(2),
            arco: Math.round(6 * arcoK), cavalos: st.caixasCavalos.map((c) => c.y), S, cerca, votos, colunas }   // spec: 6 px de arte no meio
        }, faixa, { timeout: 60000, polling: 'raf' }).then((h) => h.jsonValue())
        const reta = await medir({ reta: true })
        await pg.getByRole('button', { name: 'x2' }).click()   // até o meio da curva (a medida não depende do x1/x2)
        const curva = await medir({ reta: false })
        if (shotCorrida) await pg.screenshot({ path: join(SHOTS, shotCorrida) })
        const sobe = { cavalo: reta.y - curva.y, voce: reta.voce - curva.voce, cerca: reta.cerca != null && curva.cerca != null ? (reta.cerca - curva.cerca) / curva.S : null }
        if (!(curva.arco >= 4) || sobe.cavalo !== curva.arco || sobe.voce !== curva.arco) problems.push(`[${label}] curva: o cavalo do jogador / ◀VOCÊ subiram ${JSON.stringify(sobe)} px de arte no meio da curva (esperado ${curva.arco}) ${JSON.stringify({ reta, curva })}`)
        // a cerca desenhada sobe o mesmo arco (com Sprites.drawTrack sem o fx.js — curvaApi() nulo — fica em 0)
        const votosOk = (m) => m.votos >= Math.max(5, 0.3 * m.colunas)
        if (!votosOk(reta) || !votosOk(curva) || sobe.cerca !== curva.arco) problems.push(`[${label}] curva: a cerca externa no canvas subiu ${sobe.cerca} px de arte no meio da curva (esperado ${curva.arco}) ${JSON.stringify({ reta: [reta.cerca, reta.votos, reta.colunas], curva: [curva.cerca, curva.votos, curva.colunas] })}`)
        if (curva.mini === curva.compact || reta.mini === reta.compact) problems.push(`[${label}] minimapa ${curva.mini ? 'desenhado' : 'ausente'} com o layout ${curva.compact ? 'compacto' : 'normal'}`)
        await pg.getByRole('button', { name: 'x2' }).click()
        await sleep(2500)
        const cc = await pg.evaluate(() => window.__cc)
        if (cc.partial > 0 || cc.off > 0 || cc.vfora > 0 || !(cc.frames > 30)) problems.push(`[${label}] cavalo do jogador saiu da tela na pista com curvas ${JSON.stringify(cc)}`)
        notes['curvas-' + label] = { mapa, reta, curva, sobe, cam: cc }
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado')
      } catch (e) {
        problems.push(`[${label}] curvas: ${e.message}`)
      } finally {
        await pg.context().close()
      }
    }
    await curvas({ width: 390, height: 844 }, 'curvas390', 'final-19-tracado.png', 'final-18-curva.png')
    await curvas({ width: 1280, height: 800 }, 'curvas1280', 'final-desktop-tracado.png', 'final-desktop-curva.png')
    await curvas({ width: 844, height: 390 }, 'curvas-paisagem', null, 'final-18b-curva-paisagem.png')
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
      await lj.screenshot({ path: join(SHOTS, 'final-09-loja.png') })
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
  await desk.getByRole('button', { name: 'x2' }).click()
  await desk.waitForSelector('#t-resultado', { timeout: 90000 })
  notes.cam1280 = await desk.evaluate(() => window.__cc)
  await desk.context().close()

  // ---------------- moldes: queda para o código e teto do cache ----------------
  await corridaSemMoldes(browser, 'semmoldes', { query: '?semmoldes=1' })
  // build sem arte: a página vê uma tabela vazia. O build atribui window.__MOLDES num script inline que roda
  // depois do init script, então a propriedade ignora a atribuição (setter vazio) e continua vazia.
  await corridaSemMoldes(browser, 'moldes-vazio', {
    init: () => { Object.defineProperty(window, '__MOLDES', { configurable: true, get: () => ({}), set: () => {} }) }
  })
  {
    // corrida de 8: a 1ª sala do save sai de hash2(seedBase, 1); o nº de corredores é o 2º sorteio do rng da sala
    // (o 1º escolhe o nome da pista). Conferido no navegador abaixo (L.n === 8).
    let SEED8 = 0
    for (let sd = 1; sd <= 500 && !SEED8; sd++) {
      const rng = S.mulberry32(S.hash2(S.hash2(sd, 1), 0xA11CE))
      rng()
      if (4 + Math.floor(rng() * 5) === 8) SEED8 = sd
    }
    const mc = await newPage(browser, { width: 390, height: 844 }, 'moldes-cache')
    try {
      // encaixe dos moldes: escala única entre estilos, molde inteiro nos quadros de altura fixa e
      // ciclo do galope com a mesma duração do código
      const enc = await mc.evaluate(() => {
        const SP = window.Sprites, ELS = ['fogo', 'agua', 'grama', 'neutro'], erros = []
        for (let k = 1; k <= 9; k++) {
          const Ss = ELS.map((el) => SP._layoutMolde(el, 'galope', 0, 0, k).S)
          if (new Set(Ss).size !== 1) erros.push(`pista k=${k}: escalas diferentes entre estilos ${Ss}`)
        }
        // baia 48×36 (retratos): a mesma escala para os 4 estilos; cascos dentro do quadro; o topo pode sair
        // do quadro (crista de ondas) em no máximo 10 % da altura do bbox
        for (const k of [3, 6, 9]) for (const est of ['retrato', 'parado']) {
          const Ls = ELS.map((el) => SP._layoutMolde(el, est, 5 * k, 1 * k, k, { topo: 0, base: 36 * k }))
          if (new Set(Ls.map((L) => L.S)).size !== 1) erros.push(`${est} k=${k}: escalas diferentes entre estilos ${Ls.map((L) => L.S)}`)
          Ls.forEach((L, i) => {
            const alt = L.pe - L.topo, corte = Math.max(0, -L.topo)
            if (L.pe > 36 * k || L.pe < 33 * k) erros.push(`${est} ${ELS[i]} k=${k}: cascos em ${L.pe} (esperado ${33 * k}..${36 * k})`)
            if (corte > 0.1 * alt) erros.push(`${est} ${ELS[i]} k=${k}: topo cortado em ${corte}px de ${alt} (> 10 %)`)
          })
        }
        for (const k of [2, 4, 6]) for (const top of [49, 57, 63]) for (const el of ELS) {   // pódio: em pé no bloco
          const L = SP._layoutMolde(el, 'parado', (84 - 21) * k, (top - 32) * k, k, { topo: 0, base: top * k })
          if (L.topo < 0 || L.pe !== top * k) erros.push(`pódio ${el} k=${k} topo ${top}: bbox ${L.topo}..${L.pe} (bloco em ${top * k})`)
        }
        const G = SP.GALLOP_FRAMES
        for (const el of ELS) {
          const vistos = new Set()
          let ant = -1
          for (let f = 0; f < G; f += 0.01) {
            const q = SP._quadroGalope(el, f)
            if (q < ant) erros.push(`galope ${el}: quadro ${q} depois de ${ant} dentro do ciclo`)
            ant = q; vistos.add(q)
          }
          if (SP._quadroGalope(el, G) !== 0) erros.push(`galope ${el}: o ciclo do molde não volta ao quadro 0 junto com o do código`)
          if (vistos.size !== Math.max(...vistos) + 1) erros.push(`galope ${el}: pulou quadros (${[...vistos]})`)
        }
        return erros
      })
      enc.forEach((e) => problems.push('moldes-encaixe: ' + e))
      // contorno de skill: a silhueta é a do quadro que drawHorse desenha. Os pares 0.1/0.9 (2.1/2.9, 4.1/4.9)
      // caem no mesmo quadro do código e em quadros diferentes do molde: com a chave pelo quadro do código, a 2ª
      // silhueta reaproveitava a 1ª ("pernas fantasmas"). Máscara esperada = a do drawHorse deslocada 1 px de
      // arte nas 4 direções. limparCacheMoldes esvazia também este cache, que tem teto em bytes.
      const sil = await mc.evaluate(() => {
        const SP = window.Sprites, erros = [], k = 3, W = 200, H = 160, X = 40, Y = 30
        const tela = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g }
        const mascara = (g) => { const d = g.getImageData(0, 0, W, H).data, m = new Uint8Array(W * H); for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 0 ? 1 : 0; return m }
        SP.limparCacheMoldes()
        let casos = 0
        for (const el of ['fogo', 'agua', 'grama', 'neutro']) {
          for (const [f, idle] of [[0.1, false], [0.9, false], [2.1, false], [2.9, false], [4.1, false], [4.9, false], [0.1, true], [3.9, true]]) {
            const o = { palette: SP.PALETTES[el], element: el, frame: f, scale: k, silks: '#d8353b', t: 0, idle }
            const a = tela(); SP.drawHorseSilhouette(a, X, Y, o, '#ff00ff', 1)
            const b = tela(); SP.drawHorse(b, X, Y, Object.assign({}, o, { shadow: false }))
            const ma = mascara(a), mb = mascara(b)
            const em = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mb[y * W + x] === 1
            let dif = 0, tot = 0
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
              const esp = em(x - k, y) || em(x + k, y) || em(x, y - k) || em(x, y + k) ? 1 : 0
              tot += esp; if (esp !== ma[y * W + x]) dif++
            }
            casos++
            if (!tot || dif) erros.push(`${el} quadro ${f}${idle ? ' parado' : ' (molde ' + SP._quadroGalope(el, f) + ')'}: ${dif} de ${tot} px da silhueta fora da máscara do drawHorse`)
          }
        }
        const antes = SP._cacheSilhuetas()
        SP.limparCacheMoldes()
        const depois = SP._cacheSilhuetas()
        if (!(antes.n > 0) || antes.bytes > antes.max || !(antes.max <= 8 * 1024 * 1024)) erros.push('cache das silhuetas ' + JSON.stringify(antes))
        if (depois.n !== 0 || depois.bytes !== 0) erros.push('limparCacheMoldes não esvaziou o cache das silhuetas ' + JSON.stringify(depois))
        return { erros, casos, cache: antes }
      })
      notes.silhueta = { casos: sil.casos, cache: sil.cache }
      sil.erros.forEach((e) => problems.push('contorno da skill: ' + e))
      await mc.getByRole('button', { name: 'Escolher Ipê' }).click()
      await mc.waitForSelector('#t-estabulo')
      await mc.evaluate((sd) => { window.__galope.state.seedBase = sd }, SEED8)
      await mc.locator('[data-acao="aba"][data-id="correr"]').click()
      await mc.waitForSelector('#t-correr')
      await mc.getByRole('button', { name: 'Procurar corrida' }).click()
      await mc.waitForSelector('#t-largada')
      const n = await mc.evaluate(() => window.__galope.ui.lobby.n)
      if (n !== 8) problems.push(`moldes-cache: a sala da seed ${SEED8} tem ${n} corredores (esperado 8)`)
      // maior nº de entradas do cache de moldes enquanto a corrida está na tela (go() limpa ao sair)
      await mc.evaluate(() => {
        const m = window.__mcache = { max: 0, frames: 0 }
        const tick = () => {
          if (window.__galope.ui.screen === 'corrida') { m.frames++; m.max = Math.max(m.max, window.Sprites._cacheMoldes()) }
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
      await mc.getByRole('button', { name: /^Largar/ }).click()
      await mc.waitForSelector('#pista')
      await mc.getByRole('button', { name: 'x2' }).click()
      await mc.waitForSelector('#t-resultado', { timeout: 120000 })
      const cache = await mc.evaluate(() => ({ max: window.__mcache.max, frames: window.__mcache.frames, resultado: window.Sprites._cacheMoldes() }))
      notes.moldesCache = { seed: SEED8, n, ...cache }
      if (!(cache.max > 0)) problems.push('moldes-cache: a corrida não desenhou nenhum molde ' + JSON.stringify(cache))
      if (cache.max > 240) problems.push('moldes-cache: ' + cache.max + ' entradas no cache depois de uma corrida de 8 (teto 240)')
      if (cache.resultado > 3) problems.push('moldes-cache: o cache não foi limpo ao sair da corrida (' + cache.resultado + ' entradas no resultado; só o pódio = 3)')
    } catch (e) {
      problems.push('moldes-cache: ' + e.message)
    }
    await mc.context().close()
  }

  // ---------------- sem ícones nem logotipo: volta aos caracteres, sem <img> quebrado ----------------
  {
    const sem = await newPage(browser, { width: 390, height: 844 }, 'sem-icones', {
      init: () => {
        Object.defineProperty(window, '__ICONES', { get: () => ({}), set: () => {}, configurable: true })
        Object.defineProperty(window, '__MARCA', { get: () => ({ logo: null }), set: () => {}, configurable: true })
      }
    })
    try {
      await sem.waitForSelector('.inicial')
      if ((await sem.locator('img').count()) !== 0) problems.push('sem-icones: há <img> na tela inicial')
      if (((await sem.locator('h1#t-inicial').textContent()) || '').trim() !== 'Galope Elemental') problems.push('sem-icones: título da tela inicial perdeu o texto')
      await sem.getByRole('button', { name: 'Escolher Brasa' }).click()
      await sem.waitForSelector('#t-estabulo')
      if ((await sem.locator('img').count()) !== 0) problems.push('sem-icones: há <img> no estábulo')
      const icones = await sem.locator('.app-aba-icone').allTextContents()
      if (icones.join('') !== '🐴🏁🧭💞🛒') problems.push('sem-icones: abas sem os emojis de antes: ' + icones.join('|'))
      if (!/🪨/.test((await sem.locator('.app-topo .pedras').textContent()) || '')) problems.push('sem-icones: saldo de Pedras sem o emoji')
      if ((await sem.locator('.app-topo .saldo svg').count()) !== 1) problems.push('sem-icones: saldo de Ouro sem a moeda em SVG')
      if (((await sem.locator('.app-topo .logo-mini').textContent()) || '').trim() !== 'Galope Elemental') problems.push('sem-icones: cabeçalho sem o texto da marca')
    } catch (e) {
      problems.push('sem-icones: ' + e.message)
    }
    await sem.context().close()
  }

  // ---------------- celular pequeno, paisagem e movimento reduzido ----------------
  for (const [label, vp] of [['m360', { width: 360, height: 740 }], ['land', { width: 844, height: 390 }]]) {
    const p = await newPage(browser, vp, label)
    await p.getByRole('button', { name: 'Escolher Ipê' }).click()
    await p.waitForSelector('#t-estabulo')
    await checkOverflow(p, label + '-estabulo')   // telas com a casca (cabeçalho + barra de abas)
    await p.locator('[data-acao="aba"][data-id="correr"]').click()
    await p.waitForSelector('#t-correr')
    await checkOverflow(p, label + '-correr')
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
  }   // fim do if (!SO.length)
  if (SO.length) console.log(JSON.stringify({ so: SO, notes }, null, 1))
} finally {
  await browser.close()
  await new Promise((ok) => servidor.close(ok))
}
if (problems.length) {
  console.log('PROBLEMAS:\n' + problems.join('\n'))
  process.exit(1)
}
const dq = notes.desempenho
console.log('OK: fluxo completo sem erros de console, sem rolagem horizontal e com o cavalo sempre na tela' +
  (dq ? ` (desenho por quadro a 1280 com chuva e ventania: completas ${dq.completas.media} ms, reduzidas ${dq.reduzidas.media} ms)` : ''))
