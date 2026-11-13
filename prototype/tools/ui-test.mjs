// Teste de fluxo completo da interface com Playwright (sem instalar nada).
//   node build.mjs && node tools/ui-test.mjs
// Gera as capturas finais em prototype/screens/final-*.png (ou em $SHOTS_DIR) (deviceScaleFactor 2) e falha se houver
// erro de console, rolagem horizontal, cavalo do jogador fora da tela, sala re-sorteada de graça,
// resultado calculado antes de pagar, a tela de corrida não couber na altura da janela, o Dado da Sorte
// não aparecer na pista (plaquinhas, faixa, câmera lenta e "Pular" no meio dela), a chuva congelar com
// movimento reduzido, a natureza custar demais por quadro ou um save antigo perder a opção "Animações".
// Também confere a entrada reservada do páreo aberto, a gravação que falha, o save adulterado ou corrompido,
// o jogo de produção (jogo.html sem DEV nem gancho), a área segura do topo, o tamanho mínimo do texto e o teto
// de chamadas de canvas por quadro na corrida mais cara.
//   UI_SO=reserva,gravacao,adulterado,corrompido,areasegura,texto,producao,redimensiona,escala,teto,marcas node tools/ui-test.mjs  -> só esses
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
const G_ELS = Object.keys(G.ELEMENTS)
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
// SHOTS_T6: pasta (fora do repositório) para as capturas de conferência das telas da build; sem ela, não captura
const SHOTS_T6 = process.env.SHOTS_T6 || null
const capT6 = (pg, nome, full = false) => (SHOTS_T6 ? pg.screenshot({ path: join(SHOTS_T6, nome), fullPage: full }).catch(() => {}) : null)
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
      // o Ouro vai para 100 no próprio save gravado (como um save editado), e a página recarrega a partir dele
      await rv.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem('galope-elemental:v1'))
        raw.gold = 100
        localStorage.setItem('galope-elemental:v1', JSON.stringify(raw))
      })
      await rv.reload({ waitUntil: 'domcontentloaded' })
      await rv.waitForSelector('#t-estabulo')
      if ((await rv.evaluate(() => window.__galope.state.gold)) !== 100) problems.push('reserva: o save editado não abriu com 100 de Ouro')
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

  // ---------------- gravação que falha (2): cruzar, Troca, vender, desfazer venda, vaga e sala rebaixada ----------------
  if (quer('gravacao2')) {
    const g2 = await newPage(browser, { width: 390, height: 844 }, 'gravacao2')
    const st = () => g2.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    const quebrar = () => g2.evaluate(() => {
      if (!window.__setOrig) window.__setOrig = Storage.prototype.setItem
      Storage.prototype.setItem = function () { throw new DOMException('cheio', 'QuotaExceededError') }
    })
    const consertar = () => g2.evaluate(() => { Storage.prototype.setItem = window.__setOrig })
    const FALHA = 'Não foi possível salvar. Libere espaço e tente de novo.'
    const temAviso = async () => ((await g2.locator('#tela').textContent()) || '').includes(FALHA)
    // a ação com a gravação quebrada não pode mudar o save em memória e tem de avisar
    const semMudar = async (nome, acao, campos) => {
      const a = await st()
      await quebrar()
      await acao()
      const d = await st()
      await consertar()
      for (const k of campos) if (JSON.stringify(a[k]) !== JSON.stringify(d[k])) problems.push(`gravacao2: ${nome} sem gravar mudou ${k}`)
      if (!(await temAviso())) problems.push(`gravacao2: ${nome} sem gravar não avisou`)
    }
    try {
      await g2.getByRole('button', { name: 'Escolher Brasa' }).click()
      await g2.waitForSelector('#t-estabulo')
      // seed do save em que Brasa × Faísca dá potra (a Troca precisa de sexos opostos)
      const m1 = (await st()).mounts[0], faisca = G.WILD_HORSES.find((h) => h.id === 'w-faisca')
      let SEED = 0
      for (let sd = 1; sd <= 300 && !SEED; sd++) if (B.foal({ f: faisca, m: m1, seedBase: sd, breedCounter: 0, nextUid: 2 }).sex === 'f') SEED = sd
      await g2.evaluate((seed) => { const s = window.__galope.state; s.gold = 5000; s.seedBase = seed }, SEED)
      // 1. cruzar
      await g2.locator('[data-acao="aba"][data-id="haras"]').click()
      await g2.waitForSelector('#t-haras')
      await g2.locator('[data-acao="haras-partner"][data-kind="rent"][data-id="w-faisca"]').click()
      await semMudar('cruzar', () => g2.locator('[data-acao="cruzar"]').click(), ['gold', 'mounts', 'breedCounter', 'nextUid'])
      if (await g2.locator('#t-nasceu').count()) problems.push('gravacao2: cruzar sem gravar mostrou o potro')
      await g2.locator('[data-acao="haras-partner"][data-kind="rent"][data-id="w-faisca"]').click()
      await g2.locator('[data-acao="cruzar"]').click()
      await g2.waitForSelector('#t-nasceu')
      // 2. Troca
      await g2.locator('[data-acao="haras-denovo"]').click()
      await g2.locator('[data-acao="haras-mode"][data-id="troca"]').click()
      await g2.locator('[data-acao="haras-mine"][data-id="m1"]').click()
      await g2.locator('[data-acao="haras-partner"][data-kind="own"][data-id="m2"]').click()
      await g2.locator('[data-acao="troca"]').click()
      await semMudar('Troca', () => g2.locator('[data-acao="troca-sim"]').click(), ['gold', 'mounts', 'activeId', 'breedCounter'])
      // 3. vender e desfazer venda
      await g2.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await g2.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await g2.waitForSelector('#t-montaria')
      await g2.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      await g2.locator('[data-acao="equip-slot"][data-id="sela"]').click()
      const sela = (await st()).mounts[0].equip.sela
      await g2.locator('[data-acao="tirar"][data-id="sela"]').click()
      await semMudar('vender', () => g2.locator(`[data-acao="vender"][data-id="${sela}"]`).click(), ['gold', 'items'])
      await g2.locator(`[data-acao="vender"][data-id="${sela}"]`).click()
      await g2.waitForSelector('[data-acao="vender-desfazer"]')
      await semMudar('desfazer venda', () => g2.locator('[data-acao="vender-desfazer"]').click(), ['gold', 'items'])
      // 4. vaga do estábulo
      await g2.locator('[data-acao="montaria-voltar"]').click()
      await g2.waitForSelector('#t-estabulo')
      await semMudar('expandir', () => g2.locator('[data-acao="expandir"]').click(), ['gold', 'stableSlots'])
      // 5. sala valendo rebaixada a treino (Ouro abaixo da entrada): sem gravar, continua valendo e não abre
      await abrirSala(g2, 250)
      await g2.getByRole('button', { name: /^Voltar/ }).click()
      await g2.waitForSelector('#t-correr')
      await g2.evaluate(() => { window.__galope.state.gold = 100 })
      await semMudar('rebaixar a sala', () => g2.locator('[data-acao="procurar"]').click(), ['pending'])
      if (await g2.locator('#t-largada').count()) problems.push('gravacao2: a sala rebaixada abriu sem gravar')
      const sala = await abrirSala(g2)
      if (!sala.training || sala.fee !== 0) problems.push('gravacao2: com a gravação de volta a sala não virou treino ' + JSON.stringify(sala))
    } catch (e) {
      problems.push('gravacao2: ' + e.message)
    }
    await g2.context().close()
  }

  // ---------------- treino aberto: só some depois de corrido (vender peça e subir o Ouro não troca a sala) ----------------
  if (quer('treino')) {
    const tr = await newPage(browser, { width: 390, height: 844 }, 'treino')
    const st = () => tr.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    try {
      await tr.getByRole('button', { name: 'Escolher Brasa' }).click()
      await tr.waitForSelector('#t-estabulo')
      await tr.evaluate(() => { window.__galope.state.gold = 30 })
      await tr.locator('[data-acao="aba"][data-id="correr"]').click()
      await tr.waitForSelector('[data-acao="treino"]')
      await tr.locator('[data-acao="treino"]').click()
      await tr.waitForSelector('#t-largada')
      const salaA = await salaAtual(tr)
      if (!salaA.training) problems.push('treino: a sala aberta não é treino')
      await tr.getByRole('button', { name: /^Voltar/ }).click()
      // tira e vende a sela inicial (+25 de Ouro): 55, acima da menor entrada
      const s0 = await st()
      const sela = s0.mounts[0].equip.sela
      await tr.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await tr.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await tr.waitForSelector('#t-montaria')
      await tr.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      await tr.locator('[data-acao="equip-slot"][data-id="sela"]').click()
      await tr.locator('[data-acao="tirar"][data-id="sela"]').click()
      await tr.locator(`[data-acao="vender"][data-id="${sela}"]`).click()
      const g = (await st()).gold
      if (g < 50) problems.push('treino: Ouro depois da venda ' + g + ' (o teste precisa passar de 50)')
      await tr.locator('[data-acao="montaria-voltar"]').click()
      const salaB = await abrirSala(tr)
      if (salaB.seed !== salaA.seed || salaB.counter !== salaA.counter || !salaB.training) problems.push('treino: o treino aberto virou outra sala ' + JSON.stringify({ antes: [salaA.seed, salaA.counter], depois: [salaB.seed, salaB.counter, salaB.training] }))
    } catch (e) {
      problems.push('treino: ' + e.message)
    }
    await tr.context().close()
  }

  // ---------------- aviso sobrevive ao redesenho passivo (moldes carregando, largura mudando) ----------------
  if (quer('aviso')) {
    const av = await newPage(browser, { width: 390, height: 844 }, 'aviso')
    const RES = /250 de Ouro reservados para a entrada do páreo aberto/
    const avisos = async () => (await av.locator('#tela .aviso').allTextContents()).join(' | ')
    try {
      await av.getByRole('button', { name: 'Escolher Brasa' }).click()
      await av.waitForSelector('#t-estabulo')
      await abrirSala(av, 250)
      await av.getByRole('button', { name: /^Voltar/ }).click()
      await av.evaluate(() => { window.__galope.state.gold = 500 })
      await av.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await av.waitForSelector('#t-estabulo')
      // vaga do estábulo (300) com só 250 livres: clique forçado, o aviso aparece
      await av.evaluate(() => { const b = document.querySelector('[data-acao="expandir"]'); b.disabled = false; b.click() })
      if (!RES.test(await avisos())) problems.push('aviso: recusa da vaga sem o aviso de Ouro reservado: ' + await avisos())
      // redesenho passivo (o mesmo dos moldes chegando): mudar a largura da janela
      await av.evaluate(() => { document.getElementById('t-estabulo').dataset.antigo = '1' })
      await av.setViewportSize({ width: 380, height: 844 })
      await av.waitForSelector('#t-estabulo:not([data-antigo])', { timeout: 5000 })   // a tela foi redesenhada
      if (!RES.test(await avisos())) problems.push('aviso: o aviso sumiu no redesenho passivo: ' + await avisos())
      // a próxima ação do jogador limpa o aviso
      await av.locator('[data-acao="aba"][data-id="estabulo"]').click()
      if (RES.test(await avisos())) problems.push('aviso: o aviso continuou depois de uma ação do jogador')
    } catch (e) {
      problems.push('aviso: ' + e.message)
    }
    await av.context().close()
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

  // ---------------- save adulterado: Poder da sala, status base (campo que saiu na v5) e campo morto ----------------
  if (quer('adulterado')) {
    const ad = await newPage(browser, { width: 390, height: 844 }, 'adulterado')
    const st = () => ad.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    const bruto = () => ad.evaluate(() => JSON.parse(localStorage.getItem('galope-elemental:v1')))
    const grava = (raw) => ad.evaluate((r) => localStorage.setItem('galope-elemental:v1', JSON.stringify(r)), raw)
    const poderReal = () => ad.evaluate(() => {
      const s = window.__galope.state, m = s.mounts.find((x) => x.uid === s.activeId), it = {}
      s.items.forEach((x) => { it[x.uid] = x })
      return window.RaceSim.powerRating(m, window.Gear.resolve(m, it))
    })
    try {
      await ad.getByRole('button', { name: 'Escolher Brasa' }).click()
      await ad.waitForSelector('#t-estabulo')
      const sala = await abrirSala(ad)
      const s0 = await st()
      if (!s0.pending || !Array.isArray(s0.pending.gear) || !s0.pending.gear.length) problems.push('adulterado: a sala aberta não guardou o retrato do equipamento ' + JSON.stringify(s0.pending))
      // 1. save legítimo: recarregar não muda nada
      await ad.reload({ waitUntil: 'domcontentloaded' })
      await ad.waitForSelector('#t-estabulo')
      let s = await st()
      if (s.pending.pr !== s0.pending.pr || JSON.stringify(s.mounts[0]) !== JSON.stringify(s0.mounts[0])) problems.push('adulterado: o save legítimo mudou ao recarregar ' + JSON.stringify({ pr: [s0.pending.pr, s.pending.pr] }))
      // 2. adulterado: Poder da sala 99 999, status base 100 (não existe mais: é descartado), gestacao 1e300 e uma
      //    peça Lendária +10 (fica: pode vir do painel antigo)
      const raw = await bruto()
      raw.pending.pr = 99999
      raw.mounts[0].base = { vel: 100, acel: 100, man: 100, forca: 100, est: 100, garra: 100, sorte: 100 }
      raw.mounts[0].gestacao = 1e300
      raw.items.push({ uid: 'i99', id: 'armadura-chuva-lendario', plus: 10 })
      await grava(raw)
      await ad.reload({ waitUntil: 'domcontentloaded' })
      await ad.waitForSelector('#t-estabulo')
      s = await st()
      const m = s.mounts[0]
      if ('base' in m) problems.push('adulterado: o status base adulterado continua no save ' + JSON.stringify(m.base))
      if (JSON.stringify(S.computeStats(m, null)) !== JSON.stringify(S.computeStats(s0.mounts[0], null))) problems.push('adulterado: o status base adulterado mudou os status')
      if ('gestacao' in m) problems.push('adulterado: campo gestacao continua no save')
      if (!s.items.some((x) => x.uid === 'i99' && x.plus === 10)) problems.push('adulterado: a peça Lendária foi descartada')
      const real = await poderReal()
      if (s.pending.pr !== real) problems.push(`adulterado: Poder da sala ${s.pending.pr} != Poder real ${real}`)
      // a trava continua: com o Poder da sala real, a Lendária não pode ser equipada
      await ad.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await ad.waitForSelector('#t-montaria')
      await ad.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      await ad.locator('[data-acao="equip-slot"][data-id="armadura"]').click()
      if (!(await ad.locator('[data-acao="equipar"][data-id="i99"]').isDisabled())) problems.push('adulterado: a peça Lendária pode ser equipada com o páreo aberto')
      const sala2 = await salaAtual(ad).catch(() => null)
      if (sala2 && sala2.seed !== sala.seed) problems.push('adulterado: seed da sala mudou')
      // 3. retrato inválido (peça inexistente) vale como save sem retrato: é descartado e o pr gravado fica
      //    (recalcular pelo equipamento atual mudaria os rivais da sala; ver o contexto "retrato")
      const raw2 = await bruto()
      const prGravado = raw2.pending.pr
      raw2.pending.gear = [{ slot: 'sela', id: 'nao-existe', plus: 99 }]
      await grava(raw2)
      await ad.reload({ waitUntil: 'domcontentloaded' })
      await ad.waitForSelector('#t-estabulo')
      s = await st()
      if (s.pending.gear !== null || s.pending.pr !== prGravado) problems.push('adulterado: retrato inválido ' + JSON.stringify({ gear: s.pending.gear, pr: s.pending.pr, prGravado }))
    } catch (e) {
      problems.push('adulterado: ' + e.message)
    }
    await ad.context().close()
  }

  // ---------------- migração v4 -> v5: status base sai, pontos livres para distribuir, Neutro vira tipo ----------------
  // Save v4 de exemplo: Brasa Raro nível 12 com status base e Labareda; Ventania Neutro; Pangaré (modelo que saiu do
  // catálogo, também Neutro); peças (uma +2 equipada, uma solta) e uma sala aberta valendo com retrato do equipamento.
  // A pista da sala sai da seed pelas regras v3 (o v4 não guardava a pista): o que tem de valer é a mesma seed,
  // entrada e treino, e a sala nunca mais mudar ao recarregar.
  const MIG_SEED = 4242
  const MIG_V4 = {
    v: 4, rev: 10, gold: 900, tier: 100, seedBase: MIG_SEED, raceCounter: 7,
    pending: { counter: 7, training: false, fee: 100, pr: 777, gear: [{ slot: 'sela', id: 'sela-comum', plus: 0 }, { slot: 'ferraduras', id: 'ferraduras-comum', plus: 2 }] },
    races: 6, wins: 2, podiums: 3, goldWon: 400,
    mounts: [
      { uid: 'm1', templateId: 'brasa', name: 'Brasa', especie: 'cavalo', element: 'fogo', rarity: 'raro', grau: 2, sex: 'm', level: 12, xp: 30,
        skills: ['labareda', 'sprint'], base: { vel: 64, acel: 62, man: 60, forca: 52, est: 58, garra: 62, sorte: 50 },
        potential: { vel: 22, acel: 24, man: 18, forca: 14, est: 12, garra: 18, sorte: 14 },
        palette: { coat: '#c4471d', coatShade: '#7f2a0e', mane: '#ffb02e', accent: '#ffe066' }, breedLeft: 2, parents: null, born: 0,
        equip: { sela: 'i1', ferraduras: 'i2' } },
      { uid: 'm2', templateId: 'w-ventania', name: 'Ventania', especie: 'cavalo', element: 'neutro', rarity: 'raro', grau: 3, sex: 'f', level: 15, xp: 5,
        skills: ['sprint', 'arrancada-final'], base: { vel: 62, acel: 58, man: 56, forca: 52, est: 56, garra: 57, sorte: 50 },
        potential: { vel: 21, acel: 18, man: 20, forca: 13, est: 15, garra: 17, sorte: 14 },
        palette: { coat: '#e9e4da', coatShade: '#b6aea0', mane: '#7a7a7a', accent: '#9ad0ff' }, breedLeft: 3, parents: null, born: 0, equip: {} },
      { uid: 'm3', templateId: 'w-pangare', name: 'Pangaré', especie: 'cavalo', element: 'neutro', rarity: 'comum', grau: 1, sex: 'm', level: 4, xp: 0,
        skills: [], base: { vel: 44, acel: 42, man: 39, forca: 48, est: 46, garra: 40, sorte: 40 },
        potential: { vel: 10, acel: 12, man: 11, forca: 15, est: 14, garra: 9, sorte: 10 },
        palette: { coat: '#8d6e52', coatShade: '#5c4532', mane: '#3b2a1e', accent: '#c9b28f' }, breedLeft: 2, parents: null, born: 0, equip: {} }
    ],
    activeId: 'm1', nextUid: 4, stableSlots: 3, breedCounter: 0,
    items: [{ uid: 'i1', id: 'sela-comum', plus: 0 }, { uid: 'i2', id: 'ferraduras-comum', plus: 2 }, { uid: 'i3', id: 'armadura-magico', plus: 1 }],
    nextItemUid: 4, pedras: 4, enhanceCounter: 2, settings: { motion: 'sistema' }
  }
  const TIPOS_V3 = ['fogo', 'agua', 'grama']
  const neutroVira = (seedBase, uid) => TIPOS_V3[(S.hash2(seedBase, Number(uid.slice(1))) >>> 0) % 3]
  const SKILLS_DE_TIPO = Object.keys(G.TYPE_SKILLS).map((e) => G.TYPE_SKILLS[e].id)
  // problemas de um save já carregado (state do jogo) depois da migração
  const conferirMigrado = (s, rotulo) => {
    const out = []
    if (s.v !== 5) out.push(`${rotulo}: versão ${s.v}`)
    if (s.mounts.length !== 3) out.push(`${rotulo}: ${s.mounts.length} montarias (eram 3)`)
    for (const m of s.mounts) {
      if ('base' in m) out.push(`${rotulo}: ${m.uid} ainda tem base`)
      if (!G.ELEMENTS[m.element]) out.push(`${rotulo}: ${m.uid} com elemento ${m.element}`)
      if (m.skills.some((id) => SKILLS_DE_TIPO.includes(id))) out.push(`${rotulo}: ${m.uid} ainda tem skill de tipo na lista ${m.skills}`)
      if (!m.alloc || G.STAT_KEYS.some((k) => m.alloc[k] !== 0) || Object.keys(m.alloc).length !== 7) out.push(`${rotulo}: ${m.uid} veio com pontos distribuídos ${JSON.stringify(m.alloc)}`)
    }
    const [m1, m2, m3] = s.mounts
    if (m1.rarity !== 'raro' || m1.level !== 12 || m1.xp !== 30 || m1.grau !== 2 || m1.name !== 'Brasa' || JSON.stringify(m1.skills) !== '["sprint"]') out.push(`${rotulo}: Brasa mudou ` + JSON.stringify(m1))
    if (m2.element !== neutroVira(MIG_SEED, 'm2') || m2.grau !== 3 || m2.level !== 15) out.push(`${rotulo}: Ventania ${m2.element} (esperado ${neutroVira(MIG_SEED, 'm2')})`)
    if (m3.templateId !== null || m3.element !== neutroVira(MIG_SEED, 'm3') || JSON.stringify(m3.palette) !== JSON.stringify(MIG_V4.mounts[2].palette) || m3.name !== 'Pangaré') out.push(`${rotulo}: Pangaré ` + JSON.stringify(m3))
    if (s.gold !== 900 || s.pedras !== 4 || JSON.stringify(s.items) !== JSON.stringify(MIG_V4.items)) out.push(`${rotulo}: Ouro/peças mudaram ` + JSON.stringify({ gold: s.gold, pedras: s.pedras, items: s.items }))
    if (m1.equip.sela !== 'i1' || m1.equip.ferraduras !== 'i2') out.push(`${rotulo}: equipamento da Brasa ` + JSON.stringify(m1.equip))
    const p = s.pending
    if (!p || p.counter !== 7 || p.fee !== 100 || p.training !== false) out.push(`${rotulo}: sala aberta ` + JSON.stringify(p))
    else {
      const its = {}; p.gear.forEach((x, i) => { its['s' + i] = { uid: 's' + i, id: x.id, plus: x.plus } })
      const eq = {}; p.gear.forEach((x, i) => { eq[x.slot] = 's' + i })
      const pr = S.powerRating(m1, GR.resolve({ equip: eq }, its))
      if (p.pr !== pr) out.push(`${rotulo}: Poder da sala ${p.pr} (v3 com o retrato: ${pr})`)
    }
    return out
  }
  if (quer('migracao')) {
    const mg = await newPage(browser, { width: 390, height: 844 }, 'migracao', {
      init: { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem('galope-elemental:v1', ${JSON.stringify(JSON.stringify(MIG_V4))}) } } catch (e) {}` }
    })
    const st = () => mg.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    try {
      await mg.waitForSelector('#t-estabulo')
      const s1 = await st()
      problems.push(...conferirMigrado(s1, 'migracao'))
      const info = await mg.evaluate(() => { const m = window.__galope.state.mounts[0]; return window.RaceSim.allocInfo(m) })
      const livres = Math.floor(11 * 1.2)
      if (info.free !== livres || info.left !== livres || info.used !== 0) problems.push('migracao: pontos livres do nível 12 ' + JSON.stringify(info))
      const gravado = await mg.evaluate(() => JSON.parse(localStorage.getItem('galope-elemental:v1')))
      if (gravado.v !== 5) problems.push('migracao: o save migrado não foi gravado (v ' + gravado.v + ')')
      // o Pangaré (sem modelo) aparece no estábulo sem erro, com retrato
      if ((await mg.locator('canvas.retrato').count()) < 3) problems.push('migracao: o estábulo não mostra os três cavalos')
      // a sala: mesma seed, e recarregar duas vezes dá exatamente a mesma sala
      const sala = async () => {
        const a = await abrirSala(mg)
        a.distance = await mg.evaluate(() => window.__galope.ui.lobby.cond.distance)
        return a
      }
      const salaA = await sala()
      if (salaA.counter !== 7 || salaA.seed !== (S.hash2(MIG_SEED, 7) >>> 0) || salaA.fee !== 100 || salaA.training) problems.push('migracao: sala ' + JSON.stringify(salaA))
      if (!(salaA.distance >= 1400 && salaA.distance <= 2000)) problems.push('migracao: distância da sala ' + salaA.distance)
      const mounts1 = JSON.stringify((await st()).mounts)
      for (let k = 1; k <= 2; k++) {
        await mg.reload({ waitUntil: 'domcontentloaded' })
        await mg.waitForSelector('#t-estabulo')
        const salaK = await sala()
        for (const c of ['seed', 'counter', 'fee', 'training', 'track', 'blocks', 'weather', 'rivais', 'distance', 'gold']) {
          if (salaA[c] !== salaK[c]) problems.push(`migracao: recarga ${k} mudou a sala (${c}: ${salaA[c]} -> ${salaK[c]})`)
        }
      }
      const s3 = await st()
      // idempotente: o save v5 recarregado não muda nada (fora o rev)
      if (JSON.stringify(s3.mounts) !== mounts1) problems.push('migracao: recarregar o save v5 mudou as montarias')
      problems.push(...conferirMigrado(s3, 'migracao (recarregado)'))
      if (s3.gold !== 900) problems.push('migracao: Ouro mudou para ' + s3.gold)
    } catch (e) {
      problems.push('migracao: ' + e.message)
    }
    await mg.context().close()
    // modo DEV: o save de teste migra pela mesma regra, e o save real não é lido nem gravado
    const md = await newPage(browser, { width: 390, height: 844 }, 'migracao-dev', {
      pagina: 'jogo-dev.html',
      init: { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem('galope-elemental:dev', ${JSON.stringify(JSON.stringify(MIG_V4))}) } } catch (e) {}` }
    })
    try {
      await md.waitForSelector('#t-estabulo')
      const s = await md.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      if (s.v !== 5 || s.mounts.some((m) => 'base' in m || !G_ELS.includes(m.element))) problems.push('migracao-dev: save de teste não migrou ' + JSON.stringify(s.mounts.map((m) => [m.uid, m.element, 'base' in m])))
      if (s.mounts.length !== 3 || s.mounts[1].element !== neutroVira(MIG_SEED, 'm2')) problems.push('migracao-dev: montarias ' + JSON.stringify(s.mounts.map((m) => m.element)))
      if ((await md.evaluate(() => localStorage.getItem('galope-elemental:v1'))) !== null) problems.push('migracao-dev: o modo DEV gravou o save real')
    } catch (e) {
      problems.push('migracao-dev: ' + e.message)
    }
    await md.context().close()
    // save v4 sem o retrato do equipamento (pending.gear ausente): o pr da sala é recalculado uma vez pelo
    // equipamento vestido, no modelo v3, e a sala fica igual depois de duas recargas
    const SEM_RETRATO = JSON.parse(JSON.stringify(MIG_V4))
    delete SEM_RETRATO.pending.gear
    const mr = await newPage(browser, { width: 390, height: 844 }, 'migracao-sem-retrato', {
      init: { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem('galope-elemental:v1', ${JSON.stringify(JSON.stringify(SEM_RETRATO))}) } } catch (e) {}` }
    })
    try {
      await mr.waitForSelector('#t-estabulo')
      const s = await mr.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      const m1 = s.mounts[0], its = Object.fromEntries(s.items.map((x) => [x.uid, x]))
      const prV3 = S.powerRating(m1, GR.resolve(m1, its))
      if (!s.pending || s.pending.pr !== prV3 || s.pending.pr === 777) problems.push(`migracao-sem-retrato: pr da sala ${s.pending && s.pending.pr} (Poder v3 com o equipamento vestido: ${prV3})`)
      if (s.pending && s.pending.gear !== null) problems.push('migracao-sem-retrato: retrato inventado ' + JSON.stringify(s.pending.gear))
      const salaA = await abrirSala(mr)
      for (let k = 1; k <= 2; k++) {
        await mr.reload({ waitUntil: 'domcontentloaded' })
        await mr.waitForSelector('#t-estabulo')
        const sk = await mr.evaluate(() => window.__galope.state.pending.pr)
        if (sk !== prV3) problems.push(`migracao-sem-retrato: recarga ${k} mudou o pr (${prV3} -> ${sk})`)
        const salaK = await abrirSala(mr)
        for (const c of ['seed', 'counter', 'fee', 'training', 'track', 'blocks', 'weather', 'rivais', 'gold']) {
          if (salaA[c] !== salaK[c]) problems.push(`migracao-sem-retrato: recarga ${k} mudou a sala (${c}: ${salaA[c]} -> ${salaK[c]})`)
        }
      }
    } catch (e) {
      problems.push('migracao-sem-retrato: ' + e.message)
    }
    await mr.context().close()
  }

  // ---------------- save v5 adulterado: alloc com 999, negativo, texto e soma acima dos pontos livres; Neutro ----------------
  // e o jogo novo: inicial Comum ★★, sem pontos distribuídos, save versão 5
  if (quer('adulterado-v5')) {
    const av = await newPage(browser, { width: 390, height: 844 }, 'adulterado-v5')
    const st = () => av.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    try {
      await av.getByRole('button', { name: 'Escolher Brasa' }).click()
      await av.waitForSelector('#t-estabulo')
      const s0 = await st()
      const m0 = s0.mounts[0]
      if (s0.v !== 5 || m0.templateId !== 'brasa' || m0.rarity !== 'comum' || m0.grau !== 2 || 'base' in m0 || !m0.alloc || G.STAT_KEYS.some((k) => m0.alloc[k] !== 0)) problems.push('adulterado-v5: jogo novo ' + JSON.stringify({ v: s0.v, m0 }))
      const raw = await av.evaluate(() => JSON.parse(localStorage.getItem('galope-elemental:v1')))
      raw.mounts[0].level = 20
      raw.mounts[0].alloc = { vel: 999, acel: -5, man: 'abc', forca: 3.7, est: 1e300, garra: null, sorte: '4' }
      raw.mounts[0].base = { vel: 100, acel: 100, man: 100, forca: 100, est: 100, garra: 100, sorte: 100 }
      raw.mounts.push({ uid: 'm2', templateId: null, name: 'Velho', element: 'neutro', rarity: 'magico', grau: 3, sex: 'f', level: 30, xp: 0, skills: ['sprint', 'raizes-firmes'],
        potential: { vel: 5, acel: 5, man: 5, forca: 5, est: 5, garra: 5, sorte: 5 }, alloc: 'tudo', palette: null, breedLeft: 2, parents: null, born: 0, equip: {} })
      raw.mounts.push({ uid: 'm3', templateId: null, name: 'Guloso', element: 'agua', rarity: 'comum', grau: 1, sex: 'm', level: 11, xp: 0, skills: [],
        potential: { vel: 5, acel: 5, man: 5, forca: 5, est: 5, garra: 5, sorte: 5 }, alloc: { vel: 4, acel: 4, man: 4, forca: 4, est: 4, garra: 4, sorte: 4 }, palette: null, breedLeft: 2, parents: null, born: 0, equip: {} })
      raw.nextUid = 4; raw.stableSlots = 3
      await av.evaluate((r) => localStorage.setItem('galope-elemental:v1', JSON.stringify(r)), raw)
      await av.reload({ waitUntil: 'domcontentloaded' })
      await av.waitForSelector('#t-estabulo')
      const s = await st()
      if (s.mounts.length !== 3) problems.push('adulterado-v5: montarias ' + s.mounts.length)
      for (const m of s.mounts) {
        const lim = S.statLimit(m), free = S.freePoints(m)
        let soma = 0
        for (const k of G.STAT_KEYS) {
          const a = m.alloc && m.alloc[k]
          if (!(Number.isInteger(a) && a >= 0 && a <= lim)) problems.push(`adulterado-v5: ${m.uid} alloc.${k} = ${a} (limite ${lim})`)
          soma += a
        }
        if (soma > free) problems.push(`adulterado-v5: ${m.uid} soma ${soma} > ${free} pontos livres`)
        if ('base' in m) problems.push(`adulterado-v5: ${m.uid} com base`)
        if (!G.ELEMENTS[m.element]) problems.push(`adulterado-v5: ${m.uid} elemento ${m.element}`)
        const cap = G.RARITIES[m.rarity].statCap, stt = S.computeStats(m, null)
        if (G.STAT_KEYS.some((k) => stt[k] > cap)) problems.push(`adulterado-v5: ${m.uid} passou do teto ` + JSON.stringify(stt))
      }
      const [a1, a2, a3] = s.mounts
      // nível 20 ★★: 22 livres, limite 8 por status; vel 999 -> 8, forca 3,7 -> 3, sorte '4' -> 4
      if (JSON.stringify(a1.alloc) !== JSON.stringify({ vel: 8, acel: 0, man: 0, forca: 3, est: 8, garra: 0, sorte: 3 })) problems.push('adulterado-v5: alloc saneado da Brasa ' + JSON.stringify(a1.alloc))
      if (a2.element !== neutroVira(s.seedBase, 'm2') || a2.skills.includes('raizes-firmes') || G.STAT_KEYS.some((k) => a2.alloc[k] !== 0)) problems.push('adulterado-v5: Neutro ' + JSON.stringify(a2))
      if (G.STAT_KEYS.reduce((t, k) => t + a3.alloc[k], 0) !== 10) problems.push('adulterado-v5: soma acima dos pontos livres não foi cortada em 10 ' + JSON.stringify(a3.alloc))
      // idempotente: recarregar o save saneado não muda nada
      await av.reload({ waitUntil: 'domcontentloaded' })
      await av.waitForSelector('#t-estabulo')
      const s2 = await st()
      if (JSON.stringify(s2.mounts) !== JSON.stringify(s.mounts)) problems.push('adulterado-v5: recarregar mudou as montarias')
      // sala adulterada (R16): o retrato dos pontos (pending.alloc) zerado, com lixo ou ausente carrega saneado
      // e o Poder da sala nunca fica abaixo do Poder com que a ativa corre
      const bruto = () => av.evaluate(() => JSON.parse(localStorage.getItem('galope-elemental:v1')))
      const grava = async (r) => {
        await av.evaluate((x) => localStorage.setItem('galope-elemental:v1', JSON.stringify(x)), r)
        await av.reload({ waitUntil: 'domcontentloaded' })
        await av.waitForSelector('#t-estabulo')
      }
      const poderAtivo = (x) => { const m = x.mounts.find((y) => y.uid === x.activeId); return S.powerRating(m, GR.resolve(m, Object.fromEntries(x.items.map((it) => [it.uid, it])))) }
      await abrirSala(av)
      await av.getByRole('button', { name: /^Voltar/ }).click()
      const sA = await st()
      if (JSON.stringify(sA.pending.alloc) !== JSON.stringify(a1.alloc)) problems.push('adulterado-v5: a sala não guardou o retrato dos pontos ' + JSON.stringify(sA.pending.alloc))
      if (JSON.stringify((await bruto()).pending.alloc) !== JSON.stringify(a1.alloc)) problems.push('adulterado-v5: o retrato dos pontos não foi gravado ao abrir a sala')
      const ZERO = Object.fromEntries(G.STAT_KEYS.map((k) => [k, 0]))
      const LIXOS = [['zerado', ZERO], ['lixo', { vel: 'abc', acel: -3, man: 999, forca: 2.5, est: null, garra: '7', sorte: 1e300 }], ['texto', 'tudo'], ['lista', [8, 8, 8]], ['ausente', undefined]]
      for (const [nome, lixo] of LIXOS) {
        const r = await bruto()
        if (lixo === undefined) delete r.pending.alloc; else r.pending.alloc = lixo
        await grava(r)
        const x = await st(), p = x.pending, m = x.mounts.find((y) => y.uid === x.activeId)
        if (!p) { problems.push(`adulterado-v5: retrato dos pontos ${nome} fechou a sala`); continue }
        const lim = S.statLimit(m), free = S.freePoints(m)
        if (!p.alloc || G.STAT_KEYS.some((k) => !(Number.isInteger(p.alloc[k]) && p.alloc[k] >= 0 && p.alloc[k] <= lim)) || G.STAT_KEYS.reduce((t, k) => t + p.alloc[k], 0) > free) problems.push(`adulterado-v5: retrato dos pontos ${nome} não foi saneado ` + JSON.stringify(p.alloc))
        if (p.pr < poderAtivo(x)) problems.push(`adulterado-v5: retrato dos pontos ${nome} baixou o Poder da sala para ${p.pr} (a ativa corre com ${poderAtivo(x)})`)
        // retrato com lixo pode SUBIR o Poder da sala (rivais mais fortes: só atrapalha quem adulterou); os outros não mudam
        if (nome !== 'lixo' && p.pr !== sA.pending.pr) problems.push(`adulterado-v5: retrato dos pontos ${nome} mudou o Poder da sala (${sA.pending.pr} -> ${p.pr})`)
      }
      // sala que abriu sem o retrato dos pontos: vale o alloc atual e o retrato passa a existir
      if (JSON.stringify((await st()).pending.alloc) !== JSON.stringify(a1.alloc)) problems.push('adulterado-v5: sala sem retrato dos pontos não ganhou o retrato')
      const semSala = await bruto()
      semSala.pending = null
      await grava(semSala)
      // o cavalo convertido corre sem erro
      await av.evaluate(() => { window.__galope.state.activeId = 'm2' })
      await abrirSala(av)
      await av.getByRole('button', { name: /^Largar/ }).click()
      await av.waitForSelector('#pista')
      await av.getByRole('button', { name: /Pular|Ver resultado/ }).click()
      await av.waitForSelector('#t-resultado')
    } catch (e) {
      problems.push('adulterado-v5: ' + e.message)
    }
    await av.context().close()
  }

  // ---------------- retrato do equipamento: save sem retrato não mexe na sala; pr adulterado volta ao do retrato ----------------
  if (quer('retrato')) {
    const rt = await newPage(browser, { width: 390, height: 844 }, 'retrato')
    const st = () => rt.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    const bruto = () => rt.evaluate(() => JSON.parse(localStorage.getItem('galope-elemental:v1')))
    const grava = (raw) => rt.evaluate((r) => localStorage.setItem('galope-elemental:v1', JSON.stringify(r)), raw)
    const recarregaSala = async () => {
      await rt.reload({ waitUntil: 'domcontentloaded' })
      await rt.waitForSelector('#t-estabulo')
      return abrirSala(rt)
    }
    try {
      await rt.getByRole('button', { name: 'Escolher Brasa' }).click()
      await rt.waitForSelector('#t-estabulo')
      const salaA = await abrirSala(rt)
      const prA = (await st()).pending.pr
      // 1. tira sela e ferraduras com a sala aberta (o Poder cai), apaga o retrato do save (save de antes dele)
      await rt.locator('[data-acao="equipar-tela"]').click()
      await rt.waitForSelector('#t-montaria')
      for (const slot of ['sela', 'ferraduras']) {
        await rt.locator(`[data-acao="equip-slot"][data-id="${slot}"]`).click()
        await rt.locator(`[data-acao="tirar"][data-id="${slot}"]`).click()
      }
      const raw = await bruto()
      if (raw.mounts[0].equip.sela || raw.mounts[0].equip.ferraduras) problems.push('retrato: as peças não saíram')
      delete raw.pending.gear
      await grava(raw)
      const salaB = await recarregaSala()
      const sB = await st()
      if (sB.pending.pr !== prA) problems.push(`retrato: save sem retrato mudou o Poder da sala (${prA} -> ${sB.pending.pr})`)
      for (const k of ['seed', 'counter', 'rivais', 'blocks']) if (salaA[k] !== salaB[k]) problems.push(`retrato: save sem retrato mudou a sala (${k}: ${salaA[k]} -> ${salaB[k]})`)
      // 2. com retrato válido, pr adulterado para baixo volta ao Poder do retrato (e os rivais aos de antes)
      const raw2 = await bruto()
      raw2.pending.gear = [{ slot: 'sela', id: 'sela-comum', plus: 0 }, { slot: 'ferraduras', id: 'ferraduras-comum', plus: 0 }]
      raw2.pending.pr = 500
      await grava(raw2)
      const salaC = await recarregaSala()
      const sC = await st()
      if (sC.pending.pr !== prA) problems.push(`retrato: pr adulterado para baixo ficou em ${sC.pending.pr} (Poder do retrato ${prA})`)
      if (salaC.rivais !== salaA.rivais) problems.push('retrato: pr adulterado para baixo trouxe outros rivais')
    } catch (e) {
      problems.push('retrato: ' + e.message)
    }
    await rt.context().close()
  }

  // ---------------- save corrompido: cópia do texto bruto e aviso na tela inicial ----------------
  if (quer('corrompido')) {
    const BRUTO = '{"v":4,"gold":12345,"mounts":[{"uid":"m1"'   // JSON cortado no meio
    const cp = await newPage(browser, { width: 390, height: 844 }, 'corrompido', {
      init: { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem('galope-elemental:v1', ${JSON.stringify(BRUTO)}) } } catch (e) {}` }
    })
    try {
      await cp.waitForSelector('.inicial')
      const aviso = (await cp.locator('#tela .aviso').allTextContents()).join(' ')
      if (!/corrompido/.test(aviso)) problems.push('corrompido: a tela inicial não avisa do save corrompido: ' + aviso)
      await cp.getByRole('button', { name: 'Escolher Brasa' }).click()
      await cp.waitForSelector('#t-estabulo')
      const ls = await cp.evaluate(() => ({ copia: localStorage.getItem('galope-elemental:v1:corrompido'), real: localStorage.getItem('galope-elemental:v1') }))
      if (ls.copia !== BRUTO) problems.push('corrompido: cópia do save bruto ' + JSON.stringify(ls.copia))
      if (!ls.real || ls.real === BRUTO) problems.push('corrompido: o jogo novo não gravou o save')
      await cp.reload({ waitUntil: 'domcontentloaded' })
      await cp.waitForSelector('#t-estabulo')
      if ((await cp.evaluate(() => localStorage.getItem('galope-elemental:v1:corrompido'))) !== BRUTO) problems.push('corrompido: a cópia sumiu depois de recarregar')
    } catch (e) {
      problems.push('corrompido: ' + e.message)
    }
    await cp.context().close()
    // sem espaço para a cópia: o aviso não pode dizer que ela foi guardada
    const cp2 = await newPage(browser, { width: 390, height: 844 }, 'corrompido-sem-copia', {
      init: { content: `try {
        localStorage.setItem('galope-elemental:v1', ${JSON.stringify(BRUTO)})
        const orig = Storage.prototype.setItem
        Storage.prototype.setItem = function (k) { if (/:corrompido$/.test(k)) throw new DOMException('cheio', 'QuotaExceededError'); return orig.apply(this, arguments) }
      } catch (e) {}` }
    })
    try {
      await cp2.waitForSelector('.inicial')
      const aviso = (await cp2.locator('#tela .aviso').allTextContents()).join(' ')
      if (/cópia do arquivo antigo foi guardada/.test(aviso) || !/não foi possível guardar uma cópia/i.test(aviso)) problems.push('corrompido: sem espaço para a cópia, o aviso diz: ' + aviso)
    } catch (e) {
      problems.push('corrompido-sem-copia: ' + e.message)
    }
    await cp2.context().close()
  }

  // ---------------- área segura do topo: com inset, o cabeçalho e o conteúdo descem; sem inset, nada muda ----------------
  // O Chromium do teste não simula entalhe: o inset entra pela variável --sat (que no jogo vale env(safe-area-inset-top)).
  if (quer('areasegura')) {
    for (const [label, query, inset] of [['areasegura-0', '', 0], ['areasegura-30', '', 30], ['areasegura-dev', '?dev=1', 30]]) {
      const pg = await newPage(browser, { width: 390, height: 844 }, label, { query })
      try {
        if (inset) await pg.addStyleTag({ content: `:root { --sat: ${inset}px !important; }` })
        if (!query) { await pg.getByRole('button', { name: 'Escolher Brasa' }).click() }
        await pg.waitForSelector('#t-estabulo')
        const r = await pg.evaluate(() => {
          const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) } }
          const topo = document.querySelector('.app-topo'), cs = getComputedStyle(topo)
          return { topo: box('.app-topo'), logo: box('.app-topo .logo-mini'), titulo: box('#t-estabulo'), faixa: box('.dev-faixa'), padTopo: parseFloat(cs.paddingTop) }
        })
        const faixa = query ? 24 : 0
        // o conteúdo do cabeçalho começa abaixo do inset (e da faixa DEV), o título abaixo do cabeçalho
        if (r.logo.top < inset + faixa) problems.push(`[${label}] cabeçalho sob a área segura: ` + JSON.stringify(r))
        if (r.titulo.top < r.topo.bottom) problems.push(`[${label}] título da tela atrás do cabeçalho: ` + JSON.stringify(r))
        if (!inset && (r.topo.top !== 0 || r.topo.bottom !== 48 || r.padTopo !== 0)) problems.push(`[${label}] sem inset o cabeçalho mudou: ` + JSON.stringify(r))
        if (query && (!r.faixa || r.faixa.top !== 0 || r.faixa.bottom !== 24 + inset || r.topo.top !== 24 + inset)) problems.push(`[${label}] faixa DEV e cabeçalho com inset: ` + JSON.stringify(r))
        notes[label] = r
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      }
      await pg.context().close()
    }
  }

  // ---------------- texto legível em 360x640: Poder, Nv, VOCÊ e rótulos das abas ----------------
  if (quer('texto')) {
    const tx = await newPage(browser, { width: 360, height: 640 }, 'texto')
    const tamanhos = (sels) => tx.evaluate((ss) => ss.map((sel) => {
      const els = Array.from(document.querySelectorAll(sel))
      return { sel, n: els.length, min: els.length ? Math.min(...els.map((e) => parseFloat(getComputedStyle(e).fontSize))) : null }
    }), sels)
    const confere = (lista, onde) => lista.forEach((t) => {
      if (!t.n) problems.push(`texto: nenhum ${t.sel} em ${onde}`)
      else if (t.min < 11) problems.push(`texto: ${t.sel} com ${t.min}px em ${onde} (mínimo 11)`)
    })
    try {
      await tx.waitForSelector('.inicial')
      confere(await tamanhos(['.inicial .contador', '.inicial .status dt']), 'tela inicial')
      await checkOverflow(tx, 'texto-inicial')
      if (process.env.SHOTS_DIR) { await tx.locator('.inicial .status').first().scrollIntoViewIfNeeded(); await tx.screenshot({ path: join(SHOTS, 'texto-360-inicial.png') }) }   // só na pasta temporária
      await tx.getByRole('button', { name: 'Escolher Brasa' }).click()
      await tx.waitForSelector('#t-estabulo')
      confere(await tamanhos(['.montaria .selo-nivel', '.app-aba-rotulo', '.badge-ativa']), 'estábulo')
      await checkOverflow(tx, 'texto-estabulo')
      if (process.env.SHOTS_DIR) await tx.screenshot({ path: join(SHOTS, 'texto-360-estabulo.png') })   // só na pasta temporária
      await abrirSala(tx)
      confere(await tamanhos(['.programa .poder b', '.programa .tag-voce']), 'largada')
      await checkOverflow(tx, 'texto-largada')
      // a linha de cada corredor não quebra o Poder em duas linhas
      const quebra = await tx.evaluate(() => Array.from(document.querySelectorAll('.programa .poder b')).filter((b) => b.getBoundingClientRect().height > parseFloat(getComputedStyle(b).fontSize) * 1.6).length)
      if (quebra) problems.push('texto: ' + quebra + ' Poder(es) quebrado(s) em duas linhas na largada')
      await tx.locator('.programa').scrollIntoViewIfNeeded()
      if (process.env.SHOTS_DIR) await tx.screenshot({ path: join(SHOTS, 'texto-360-largada.png') })   // só na pasta temporária
      await tx.evaluate(() => { const m = window.__galope.state.mounts[0]; m.xp = 10000 })   // sobe de nível nesta corrida
      await tx.getByRole('button', { name: /^Largar/ }).click()
      await tx.getByRole('button', { name: /Pular/ }).click()
      await tx.waitForSelector('#t-resultado')
      confere(await tamanhos(['.tabela .tag-voce', '.tabela .raia--mini', '.levelup b']), 'resultado')
      await checkOverflow(tx, 'texto-resultado')
      await tx.locator('.tabela').scrollIntoViewIfNeeded()
      if (process.env.SHOTS_DIR) await tx.screenshot({ path: join(SHOTS, 'texto-360-resultado.png') })   // só na pasta temporária
    } catch (e) {
      problems.push('texto: ' + e.message)
    }
    await tx.context().close()
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
        const cssDev = await pd.evaluate(() => Array.from(document.styleSheets).flatMap((sh) => Array.from(sh.cssRules)).map((r) => r.cssText).filter((t) => /\.dev-/.test(t)).length)
        if (cssDev) problems.push(`[${label}] produção com ${cssDev} regra(s) de CSS do modo DEV`)
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

  // ---------------- corrida redimensionada: continua cabendo na altura da janela ----------------
  // no meio da corrida a janela encolhe 100 a 110 px só na altura (abaixo do limite que ignora a barra do
  // navegador crescendo): o layout tem de ser refeito, sem rolagem e com os controles visíveis
  if (quer('redimensiona')) {
    for (const [de, para] of [[{ width: 390, height: 844 }, { width: 390, height: 744 }], [{ width: 1280, height: 800 }, { width: 1280, height: 690 }]]) {
      const label = `redimensiona-${de.width}x${de.height}-${para.height}`
      const pg = await newPage(browser, de, label, { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await devArmar(pg, { distancia: 1600, seed: 4242 })
        await abrirSala(pg)
        await pg.getByRole('button', { name: /^Largar/ }).click()
        await pg.waitForSelector('#pista')
        await pg.waitForFunction(() => window.__galope.race && window.__galope.race._state.phase === 'corrida', null, { timeout: 20000 })
        await pg.setViewportSize(para)
        await sleep(500)
        const f = await checkRaceFits(pg, label)
        const sh = await pg.evaluate(() => ({ sh: document.documentElement.scrollHeight, vh: window.innerHeight }))
        notes[label] = { ...f, ...sh }
        if (sh.sh > sh.vh + 1) problems.push(`[${label}] a corrida não cabe na altura da janela depois de encolher: scrollHeight ${sh.sh} > ${sh.vh}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
  }

  // ---------------- escala de trabalho reduzida (d > 1): DPR 3 em 390x844 desenha com S = 3 em vez de 6 ----------------
  // cabe na tela, o cavalo tem o mesmo tamanho em pixels de CSS que teria na escala cheia, o canvas é ampliado
  // pelo CSS com image-rendering: pixelated e nada de erro de console (newPage já registra)
  if (quer('escala')) {
    const label = 'escala-390x844@3'
    const pg = await newPage(browser, { width: 390, height: 844 }, label, { query: '?dev=1', deviceScaleFactor: 3 })
    try {
      await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
      await devArmar(pg, { clima: 'chuva', tracado: 'subidas', distancia: 1200, seed: 4242 })
      await abrirSala(pg)
      await pg.getByRole('button', { name: /^Largar/ }).click()
      await pg.waitForSelector('#pista')
      await pg.waitForFunction(() => window.__galope.race && window.__galope.race._state.phase === 'corrida' && window.RaceFx._stats.caixasCavalos.length, null, { timeout: 20000 })
      const f = await checkRaceFits(pg, label)
      const r = await pg.evaluate(() => {
        const s = window.__galope.race._state, d = s.lay.reducao, dpr = window.devicePixelRatio, cv = document.getElementById('pista')
        const L = window.__galope.ui.lobby, h = L.racers[L.playerIdx].horse, SP = window.Sprites
        const o = (k) => ({ scale: k, element: h.element, palette: h.palette, frame: 2 })
        const cav = SP.horseBox(0, 0, o(s.S)), cheio = SP.horseBox(0, 0, o(s.S * d))
        return { d, S: s.S, dpr, cssCavalo: [cav.w * d / dpr, cav.h * d / dpr], cssCheio: [cheio.w / dpr, cheio.h / dpr],
          canvas: [cv.width, cv.height], css: [cv.getBoundingClientRect().width, cv.getBoundingClientRect().height],
          render: getComputedStyle(cv).imageRendering, sh: document.documentElement.scrollHeight, vh: window.innerHeight }
      })
      notes[label] = { ...f, ...r }
      if (!(r.d > 1)) problems.push(`[${label}] a escala de trabalho não foi reduzida (d = ${r.d}, S = ${r.S})`)
      if (r.sh > r.vh + 1) problems.push(`[${label}] a corrida não cabe na altura da janela: scrollHeight ${r.sh} > ${r.vh}`)
      if (r.cssCavalo.join() !== r.cssCheio.join()) problems.push(`[${label}] cavalo com tamanho diferente da escala cheia: ${r.cssCavalo} px de CSS contra ${r.cssCheio}`)
      if (Math.abs(r.css[0] - r.canvas[0] * r.d / r.dpr) > 0.5 || Math.abs(r.css[1] - r.canvas[1] * r.d / r.dpr) > 0.5) problems.push(`[${label}] o CSS não amplia o canvas d vezes: ${r.canvas} → ${r.css}`)
      if (r.render !== 'pixelated') problems.push(`[${label}] canvas sem image-rendering: pixelated (${r.render})`)
      await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
      await pg.waitForSelector('#t-resultado')
    } catch (e) {
      problems.push(`[${label}] ` + e.message)
    } finally {
      await pg.context().close()
    }
  }

  // ---------------- teto do desenho no pior caso ----------------
  // 1280, 1600 m com subidas e curvas, chuva + ventania, skills sempre: conta as chamadas de canvas de um quadro
  // em instantes fixos da simulação (determinístico; o tempo varia com a carga da máquina e fica só como
  // informação). Pega quem reintroduzir um desenho caro (ex.: a hachura das subidas com um fillRect por listra
  // eram 4 a 11 mil por quadro; as serras do fundo coluna a coluna, +1,4 mil; hoje, com as auras da skill de tipo e os
  // terços do minimapa, o máximo fica perto de 4,1 mil; 8 auras no mesmo quadro somariam ~150 a mais).
  if (quer('teto')) {
    const TETO = { fillRect: 4500, drawImage: 300 }
    const pg = await newPage(browser, { width: 1280, height: 800 }, 'teto-desenho', { query: '?dev=1' })
    try {
      await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
      await devArmar(pg, { clima: 'chuva', vento: 'ventania', direcao: 1, sempre: true, tracado: 'lista', blocos: 'reta,subida,curva,subida,curva,subida,reta', distancia: 1600, seed: 4242 })
      await abrirSala(pg)
      await pg.getByRole('button', { name: /^Largar/ }).click()
      await pg.waitForSelector('#pista')
      // tempo (informação): 120 quadros reais de corrida — JS do desenho e intervalo real entre quadros
      const q0 = await (await pg.waitForFunction(() => {
        const r = window.__galope.race
        return r && r._state.phase === 'corrida' ? window.RaceFx._stats.quadros : false
      }, null, { timeout: 60000, polling: 'raf' })).jsonValue()
      const tempo = await (await pg.waitForFunction((q) => {
        const st = window.RaceFx._stats
        return st.quadros >= q ? { msJs: +st.msQuadro.toFixed(2), intervalo: st.intervalo } : false
      }, q0 + 120, { timeout: 60000, polling: 'raf' })).jsonValue()
      // chamadas: congela a corrida (o laço passa a chamar um frame vazio) e desenha à mão a cada 2 s de simulação
      const r = await pg.evaluate(() => {
        const rv = window.__galope.race, s = rv._state, L = window.__galope.ui.lobby, desenha = rv.frame
        rv.frame = function () {}
        const P = CanvasRenderingContext2D.prototype, nomes = ['fillRect', 'drawImage'], orig = {}, cont = {}
        nomes.forEach((n) => { orig[n] = P[n]; P[n] = function () { cont[n]++; return orig[n].apply(this, arguments) } })
        const fim = Math.max(...L.sim.finishTimes), por = []
        try {
          for (let T = 1; T < fim; T += 2) {
            s.phase = 'corrida'; s.simT = T; s.tReal = T * 0.3; s.last = 0; s.flash = 0; s.winnerSeen = true; s.mult = 1
            nomes.forEach((n) => { cont[n] = 0 })
            desenha(1)
            por.push({ T, fillRect: cont.fillRect, drawImage: cont.drawImage, auras: window.RaceFx._stats.auras })
          }
        } finally { nomes.forEach((n) => { P[n] = orig[n] }); rv.frame = desenha }
        return { por, canvas: [s.W, s.H, s.S] }
      })
      const max = (k) => r.por.reduce((m, q) => (q[k] > m[k] ? q : m), r.por[0])
      const med = (k) => { const v = r.por.map((q) => q[k]).sort((a, b) => a - b); return v[v.length >> 1] }
      notes.tetoDesenho = { canvas: r.canvas, quadros: r.por.length, fillRect: { med: med('fillRect'), max: max('fillRect').fillRect, em: max('fillRect').T },
        drawImage: { med: med('drawImage'), max: max('drawImage').drawImage, em: max('drawImage').T }, teto: TETO, tempo }
      notes.tetoDesenho.auras = { max: max('auras').auras, quadrosCom: r.por.filter((q) => q.auras > 0).length, noPiorQuadro: max('fillRect').auras }
      if (r.por.length < 30) problems.push('teto-desenho: poucos quadros amostrados ' + r.por.length)
      // a skill de tipo (aura do terço) entra na conta: o pior caso tem de ter auras ligadas
      if (!(max('fillRect').auras > 0)) problems.push('teto-desenho: o pior caso não mediu com as auras da skill de tipo ' + JSON.stringify(notes.tetoDesenho.auras))
      if (!r.por.some((q) => q.auras > 0)) problems.push('teto-desenho: nenhum quadro amostrado teve aura da skill de tipo ' + JSON.stringify(notes.tetoDesenho.auras))
      for (const k of Object.keys(TETO)) {
        const m = max(k)
        if (m[k] > TETO[k]) problems.push(`teto-desenho: ${m[k]} ${k} num quadro (simT ${m.T} s) > teto ${TETO[k]} — algum desenho ficou caro de novo`)
      }
    } catch (e) {
      problems.push('teto-desenho: ' + e.message)
    } finally {
      await pg.context().close()
    }
  }

  // ---------------- telas da build, do nível e da skill de tipo (Tarefa 6 do bloco 1 do v3) ----------------
  // Monta um save v5 a partir do jogo novo (Brasa) com o que cada contexto pede e recarrega a página.
  const SAVE_REAL = 'galope-elemental:v1'
  const montaSave = async (pg, mexe) => {
    const raw = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_REAL)
    mexe(raw)
    await pg.evaluate(([k, r]) => localStorage.setItem(k, JSON.stringify(r)), [SAVE_REAL, raw])
    await pg.reload({ waitUntil: 'domcontentloaded' })
    await pg.waitForSelector('#t-estabulo')
  }
  // tamanho mínimo das fontes (11 px) dos seletores pedidos e sem rolagem horizontal
  const confereLegivel = async (pg, sels, onde) => {
    const t = await pg.evaluate((ss) => ss.map((sel) => {
      const els = Array.from(document.querySelectorAll(sel))
      const tam = []
      els.forEach((e) => { tam.push(parseFloat(getComputedStyle(e).fontSize)); e.querySelectorAll('*').forEach((f) => { if ((f.textContent || '').trim()) tam.push(parseFloat(getComputedStyle(f).fontSize)) }) })
      return { sel, n: els.length, min: tam.length ? Math.min(...tam) : null }
    }), sels)
    for (const x of t) {
      if (!x.n) problems.push(`${onde}: nenhum ${x.sel}`)
      else if (x.min < 11) problems.push(`${onde}: ${x.sel} com texto de ${x.min}px (mínimo 11)`)
    }
    await checkOverflow(pg, onde)
  }
  const nota = (g) => (g >= 24 ? 'S' : g >= 16 ? 'A' : g >= 8 ? 'B' : 'C')
  const poderNaCabeca = (pg) => pg.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.montaria-cabeca .linha-meta span')).find((s) => /^Poder/.test(s.textContent.trim()))
    return b ? Number(b.querySelector('b').textContent) : null
  })
  // cavalo de teste no teto: Comum nível 50 com genética 31 (natural 74,6: só 6 pontos até o teto de 80)
  const TETO_M2 = { uid: 'm2', templateId: null, name: 'Teto', especie: 'cavalo', element: 'agua', rarity: 'comum', grau: 2, sex: 'f', level: 50, xp: 0, skills: [],
    potential: { vel: 31, acel: 31, man: 31, forca: 31, est: 31, garra: 31, sorte: 31 }, alloc: { vel: 6, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 },
    palette: null, breedLeft: 2, parents: null, born: 0, equip: {} }

  if (quer('build')) {
    const bd = await newPage(browser, { width: 360, height: 780 }, 'build', { init: { content: 'window.confirm = function () { window.__confirmou = true; return true }; window.alert = function () { window.__confirmou = true }' } })
    const st = () => bd.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    const disco = () => bd.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_REAL)
    const rascunho = () => bd.evaluate(() => { const r = window.__galope.ui.rascunho; return r ? JSON.parse(JSON.stringify(r)) : null })
    const mais = (k) => bd.locator(`[data-acao="ponto-mais"][data-id="${k}"]`)
    const quebrar = () => bd.evaluate(() => { if (!window.__setOrig) window.__setOrig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('cheio', 'QuotaExceededError') } })
    const consertar = () => bd.evaluate(() => { Storage.prototype.setItem = window.__setOrig })
    const FALHA = 'Não foi possível salvar. Libere espaço e tente de novo.'
    const abreMontaria = async (uid) => {
      await bd.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await bd.waitForSelector('#t-estabulo')
      await bd.locator(`button[data-acao="montaria"][data-id="${uid}"]`).click()
      await bd.waitForSelector('#t-montaria')
    }
    try {
      await bd.getByRole('button', { name: 'Escolher Brasa' }).click()
      await bd.waitForSelector('#t-estabulo')
      // Brasa Comum ★★ nível 12: 13 pontos livres, até 5 por status; m2 no teto (Comum nível 50, genética 31)
      await montaSave(bd, (raw) => { raw.mounts[0].level = 12; raw.mounts.push(JSON.parse(JSON.stringify(TETO_M2))); raw.nextUid = 3; raw.stableSlots = 3 })
      await abreMontaria('m1')
      const txt = ((await bd.locator('.pontos-livres').first().textContent()) || '').replace(/\s+/g, ' ')
      if (!/pontos livres:? 13\b/i.test(txt)) problems.push('build: topo da aba Status sem "pontos livres: 13": ' + txt)
      const s0 = await st(), d0 = await disco(), m0 = s0.mounts[0]
      // uma linha por status com nota de genética, barra e "+"
      const linhas = await bd.evaluate(() => Array.from(document.querySelectorAll('[data-status]')).map((l) => ({
        k: l.getAttribute('data-status'), nota: (l.querySelector('.nota-genetica') || {}).textContent, barra: !!l.querySelector('.barra'), mais: !!l.querySelector('[data-acao="ponto-mais"]')
      })))
      if (linhas.length !== 7) problems.push('build: ' + linhas.length + ' linhas de status (esperado 7)')
      for (const l of linhas) {
        if (l.nota !== nota(m0.potential[l.k])) problems.push(`build: nota de genética de ${l.k} = ${l.nota} (genética ${m0.potential[l.k]}: ${nota(m0.potential[l.k])})`)
        if (!l.barra || !l.mais) problems.push('build: linha sem barra ou sem "+" ' + JSON.stringify(l))
      }
      await confereLegivel(bd, ['.pontos-livres', '.nota-genetica', '.selo-nivel', '[data-status]'], 'build-360')
      // capturas oficiais (só na rodada completa): aba Status com os 13 pontos livres e aba Skills com a vaga de tipo
      if (!SO.length) {
        // janela de 360 px com as sub-abas no topo (página inteira deixaria a barra de abas fixa no meio)
        const subabasNoTopo = () => bd.evaluate(() => { const e = document.querySelector('.subabas'); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 8) })
        await subabasNoTopo()
        await sleep(300)
        await bd.screenshot({ path: join(SHOTS, 'final-03b-montaria-status.png') })
        await bd.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
        if ((await bd.locator('.vaga-tipo').count()) !== 1) problems.push('build: aba Skills sem a vaga de tipo na captura')
        await subabasNoTopo()
        await sleep(300)
        await bd.screenshot({ path: join(SHOTS, 'final-03c-montaria-skills.png') })
        await bd.locator('[data-acao="montaria-aba"][data-id="status"]').click()
      }
      const poder0 = await poderNaCabeca(bd)
      // limite por status: 5 pontos em Velocidade e o "+" some
      for (let i = 0; i < 5; i++) await mais('vel').click()
      if ((await mais('vel').count()) !== 0) problems.push('build: o "+" de Velocidade continua depois de 5 pontos (limite por status)')
      let r = await rascunho()
      if (!r || r.vel !== 5) problems.push('build: rascunho depois de 5 pontos ' + JSON.stringify(r))
      if (JSON.stringify((await st()).mounts[0].alloc) !== JSON.stringify(m0.alloc) || JSON.stringify(await disco()) !== JSON.stringify(d0)) problems.push('build: o rascunho chegou ao save antes de confirmar')
      if ((await poderNaCabeca(bd)) !== poder0) problems.push('build: o Poder da cabeça mudou com o rascunho')
      await capT6(bd, 'build-360-rascunho.png', true)
      if (!/pontos livres:? 8\b/i.test(((await bd.locator('.pontos-livres').first().textContent()) || '').replace(/\s+/g, ' '))) problems.push('build: os pontos livres não descontam o rascunho')
      // Desfazer limpa o rascunho
      await bd.locator('[data-acao="pontos-desfazer"]').click()
      r = await rascunho()
      if (r && G.STAT_KEYS.some((k) => r[k])) problems.push('build: Desfazer não limpou o rascunho ' + JSON.stringify(r))
      if ((await mais('vel').count()) !== 1) problems.push('build: o "+" de Velocidade não voltou depois de Desfazer')
      // Confirmar: o primeiro toque só avisa; com a gravação falhando, nada muda
      await mais('vel').click(); await mais('vel').click(); await mais('acel').click()
      await bd.locator('[data-acao="pontos-confirmar"]').click()
      const aviso = ((await bd.locator('#tela').textContent()) || '')
      await capT6(bd, 'build-360-confirma.png', true)
      if (!/não dá para voltar atrás/i.test(aviso)) problems.push('build: o primeiro "Confirmar" não avisou que não dá para voltar atrás')
      if (JSON.stringify((await st()).mounts[0].alloc) !== JSON.stringify(m0.alloc)) problems.push('build: o primeiro "Confirmar" já gravou')
      await quebrar()
      await bd.locator('[data-acao="pontos-confirmar"]').click()
      let s = await st()
      if (JSON.stringify(s.mounts[0].alloc) !== JSON.stringify(m0.alloc)) problems.push('build: gravação que falhou deixou os pontos na memória ' + JSON.stringify(s.mounts[0].alloc))
      if (!((await bd.locator('#tela').textContent()) || '').includes(FALHA)) problems.push('build: gravação que falhou não avisou')
      if ((await poderNaCabeca(bd)) !== poder0) problems.push('build: gravação que falhou mudou o Poder')
      // o rascunho continua (não precisa refazer os pontos) e a tela o mostra como rascunho
      r = await rascunho()
      if (!r || r.vel !== 2 || r.acel !== 1) problems.push('build: gravação que falhou perdeu o rascunho ' + JSON.stringify(r))
      if ((await bd.locator('[data-status="vel"] .valor--rascunho').count()) !== 1) problems.push('build: depois da falha, a linha de Velocidade não mostra o rascunho')
      await consertar()
      // de novo, agora gravando: só "Confirmar" (o aviso já foi dado), e status e Poder sobem
      await bd.locator('[data-acao="pontos-confirmar"]').click()
      s = await st()
      const d1 = await disco()
      const alvo = { vel: 2, acel: 1, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 }
      if (JSON.stringify(s.mounts[0].alloc) !== JSON.stringify(alvo) || JSON.stringify(d1.mounts[0].alloc) !== JSON.stringify(alvo)) problems.push('build: pontos confirmados ' + JSON.stringify({ mem: s.mounts[0].alloc, disco: d1.mounts[0].alloc }))
      const its = Object.fromEntries(s.items.map((x) => [x.uid, x]))
      const st0 = S.computeStats(m0, null), st1 = S.computeStats(s.mounts[0], null)
      if (st1.vel !== st0.vel + 2 || st1.acel !== st0.acel + 1) problems.push('build: os status não subiram com os pontos ' + JSON.stringify({ st0, st1 }))
      const poder1 = await poderNaCabeca(bd)
      if (!(poder1 > poder0) || poder1 !== S.powerRating(s.mounts[0], GR.resolve(s.mounts[0], its))) problems.push(`build: Poder depois de confirmar ${poder0} -> ${poder1}`)
      if (await rascunho()) problems.push('build: o rascunho ficou depois de gravar')
      // clique forjado fora da aba Status: "+" e "Confirmar" não fazem nada
      await bd.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      const forja = (acao, idf) => bd.evaluate(([a, i]) => {
        const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-acao', a); if (i) b.setAttribute('data-id', i)
        document.getElementById('tela').appendChild(b); b.click(); b.remove()
      }, [acao, idf])
      await forja('ponto-mais', 'man')
      if (await rascunho()) problems.push('build: "+" forjado fora da aba Status entrou no rascunho ' + JSON.stringify(await rascunho()))
      const allocAntes = JSON.stringify((await st()).mounts[0].alloc)
      await bd.evaluate(() => { const M = window.__galope.ui.montaria; M.rascunho = { vel: 0, acel: 0, man: 1, forca: 0, est: 0, garra: 0, sorte: 0 }; M.confirmaPontos = true })
      await forja('pontos-confirmar')
      if (JSON.stringify((await st()).mounts[0].alloc) !== allocAntes) problems.push('build: "Confirmar" forjado fora da aba Status gravou pontos')
      await bd.evaluate(() => { const M = window.__galope.ui.montaria; M.rascunho = null; M.confirmaPontos = false })
      await bd.locator('[data-acao="montaria-aba"][data-id="status"]').click()
      // sair da tela descarta o rascunho
      await mais('man').click()
      await bd.locator('[data-acao="montaria-voltar"]').click()
      await bd.waitForSelector('#t-estabulo')
      await abreMontaria('m1')
      if (await rascunho()) problems.push('build: o rascunho voltou depois de sair da tela')
      if ((await st()).mounts[0].alloc.man !== 0) problems.push('build: sair da tela gravou o rascunho')
      // teto da raridade: m2 já tem 6 em Velocidade (no teto de 80): sem "+"; Aceleração aceita só 6 pontos
      await abreMontaria('m2')
      if ((await mais('vel').count()) !== 0) problems.push('build: status no teto ainda oferece "+"')
      for (let i = 0; i < 6; i++) await mais('acel').click()
      if ((await mais('acel').count()) !== 0) problems.push('build: o "+" de Aceleração continua depois de chegar ao teto')
      if ((await rascunho() || {}).acel !== 6) problems.push('build: rascunho no teto ' + JSON.stringify(await rascunho()))
      await bd.locator('[data-acao="pontos-desfazer"]').click()
      // sala aberta: na ativa, o "+" que passaria do Poder da sala não vale; na outra, segue livre
      const sala = await abrirSala(bd)
      const pr = (await st()).pending.pr
      await bd.getByRole('button', { name: /^Voltar/ }).click()
      await abreMontaria('m1')
      if (!/Páreo aberto/.test((await bd.locator('#tela').textContent()) || '')) problems.push('build: sala aberta sem o aviso do Poder da sala na aba Status')
      // cada "+" habilitado tem de caber no Poder da sala (ponto num status de peso baixo pode não mudar o Poder
      // arredondado); o de Velocidade, não
      const sAb = await st(), mAb = sAb.mounts[0], itAb = Object.fromEntries(sAb.items.map((x) => [x.uid, x]))
      const habilitados = await bd.evaluate(() => Array.from(document.querySelectorAll('[data-acao="ponto-mais"]:not([disabled])')).map((b) => b.getAttribute('data-id')))
      for (const k of habilitados) {
        const h2 = JSON.parse(JSON.stringify(mAb)); h2.alloc[k] += 1
        if (S.powerRating(h2, GR.resolve(h2, itAb)) > pr) problems.push(`build: com a sala aberta, o "+" de ${k} habilitado passaria do Poder ${pr}`)
      }
      if (!(await mais('vel').isDisabled())) problems.push('build: com a sala aberta, o "+" de Velocidade da ativa está habilitado')
      await bd.evaluate(() => { const b = document.querySelector('[data-acao="ponto-mais"][data-id="vel"]'); if (b) { b.disabled = false; b.click() } })   // botão forçado: a regra vale no clique
      if (await rascunho()) problems.push('build: com a sala aberta, o clique forçado entrou no rascunho')
      // tirar ferraduras baixa o Poder: aí cabe ponto até o Poder da sala
      await bd.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      await bd.locator('[data-acao="equip-slot"][data-id="ferraduras"]').click()
      await bd.locator('[data-acao="tirar"][data-id="ferraduras"]').click()
      await bd.locator('[data-acao="montaria-aba"][data-id="status"]').click()
      let n = 0
      while (n < 13 && (await bd.locator('[data-acao="ponto-mais"]:not([disabled])').count())) { await bd.locator('[data-acao="ponto-mais"]:not([disabled])').first().click(); n++ }
      if (!n) problems.push('build: sem as ferraduras, nenhum ponto cabe no Poder da sala')
      if (n) {
        await bd.locator('[data-acao="pontos-confirmar"]').click()
        await bd.locator('[data-acao="pontos-confirmar"]').click()
        s = await st()
        const a = s.mounts[0], it2 = Object.fromEntries(s.items.map((x) => [x.uid, x]))
        if (S.powerRating(a, GR.resolve(a, it2)) > pr) problems.push('build: pontos com a sala aberta passaram do Poder da sala')
        if (G.STAT_KEYS.reduce((t, k) => t + a.alloc[k], 0) !== 3 + n) problems.push('build: pontos com a sala aberta não gravaram ' + JSON.stringify(a.alloc))
        // recarregar (duas vezes) não muda a sala: o Poder dela sai do retrato dos pontos e do equipamento de
        // quando abriu, não dos pontos novos sem as ferraduras (R16)
        const salaFina = () => bd.evaluate(() => {
          const L = window.__galope.ui.lobby
          return JSON.stringify({ seed: L.seed, counter: L.counter, pr: window.__galope.state.pending.pr, dist: L.cond.distance,
            rivais: L.racers.map((x) => (x.isPlayer ? 'VOCE' : x.horse.id + ':Nv' + x.horse.level + ':P' + x.rating)) })
        })
        await abrirSala(bd)
        const fina0 = await salaFina()
        for (let i = 1; i <= 2; i++) {
          await bd.reload({ waitUntil: 'domcontentloaded' })
          await bd.waitForSelector('#t-estabulo')
          await abrirSala(bd)
          const fina = await salaFina()
          if (fina !== fina0) problems.push(`build: recarregar (${i}ª vez) depois dos pontos sem as ferraduras mudou a sala: ${fina0} -> ${fina}`)
        }
        if ((await st()).pending.pr !== pr) problems.push(`build: depois de recarregar, o Poder da sala ${(await st()).pending.pr} != ${pr}`)
        await bd.getByRole('button', { name: /^Voltar/ }).click()
        // e as ferraduras não voltam: passariam do Poder da sala
        await abreMontaria('m1')
        await bd.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
        await bd.locator('[data-acao="equip-slot"][data-id="ferraduras"]').click()
        const eqBtn = bd.locator('[data-acao="equipar"]').first()
        if (!(await eqBtn.count()) || !(await eqBtn.isDisabled())) problems.push('build: depois dos pontos sem as ferraduras, reequipar não está barrado')
        await bd.evaluate(() => { const b = document.querySelector('[data-acao="equipar"]'); if (b) { b.disabled = false; b.click() } })   // botão forçado
        if ((await st()).mounts[0].equip.ferraduras) problems.push('build: reequipar as ferraduras passou da trava da sala')
        await bd.locator('[data-acao="montaria-aba"][data-id="status"]').click()
      }
      // outra montaria (não é a ativa): livre com a sala aberta
      await abreMontaria('m2')
      if ((await mais('acel').count()) !== 1 || (await mais('acel').isDisabled())) problems.push('build: com a sala aberta, a montaria que não é a ativa não aceita ponto')
      await mais('acel').click()
      await bd.locator('[data-acao="pontos-confirmar"]').click()
      await bd.locator('[data-acao="pontos-confirmar"]').click()
      s = await st()
      if (s.mounts[1].alloc.acel !== 1) problems.push('build: ponto na montaria que não é a ativa, com sala aberta ' + JSON.stringify(s.mounts[1].alloc))
      if (s.pending.pr !== pr) problems.push(`build: o Poder da sala mudou (${pr} -> ${s.pending.pr})`)
      const sala2 = await abrirSala(bd)
      for (const k of ['seed', 'counter', 'rivais', 'blocks']) if (sala[k] !== sala2[k]) problems.push(`build: a sala mudou (${k})`)
      if (await bd.evaluate(() => !!window.__confirmou)) problems.push('build: usou window.confirm/alert')
    } catch (e) {
      problems.push('build: ' + e.message)
    }
    await bd.context().close()
  }

  // ---------------- valor da peça: a tela mostra o mesmo número que a simulação usa (Gear.resolve, plusStep 0,5) ----------------
  if (quer('valor-peca')) {
    const vp = await newPage(browser, { width: 360, height: 780 }, 'valor-peca')
    const numTxt = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10).replace('.', ','))
    const modsDe = (id, plus) => GR.resolve({ equip: { [G.GEAR[id].slot]: 'x' } }, { x: { uid: 'x', id, plus } }).mods
    try {
      await vp.getByRole('button', { name: 'Escolher Brasa' }).click()
      await vp.waitForSelector('#t-estabulo')
      const PLUS = { ferraduras: 3, sela: 4 }   // melhoria ímpar (meio ponto) e par
      await montaSave(vp, (raw) => {
        raw.gold = 5000
        for (const slot of Object.keys(PLUS)) {
          const it = raw.items.find((x) => x.uid === raw.mounts[0].equip[slot])
          it.plus = PLUS[slot]
        }
      })
      const s = await vp.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      const equipados = {}
      for (const slot of Object.keys(PLUS)) equipados[slot] = s.items.find((x) => x.uid === s.mounts[0].equip[slot]).id
      await vp.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await vp.waitForSelector('#t-montaria')
      await vp.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      for (const slot of Object.keys(PLUS)) {
        const id = equipados[slot], info = G.GEAR_SLOT_INFO[slot], m = modsDe(id, PLUS[slot])
        let esperado = '+' + numTxt(m[info.main]) + ' ' + G.STATS[info.main].short
        if (G.GEAR[id].sub) esperado += ', +' + numTxt(m[info.sub]) + ' ' + G.STATS[info.sub].short
        const rotulo = ((await vp.locator(`[data-acao="equip-slot"][data-id="${slot}"] .slot-peca`).textContent()) || '').trim()
        if (!rotulo.endsWith('· ' + esperado)) problems.push(`valor-peca: rótulo do slot ${slot} +${PLUS[slot]} = "${rotulo}" (a simulação usa ${esperado})`)
        await vp.locator(`[data-acao="equip-slot"][data-id="${slot}"]`).click()
        const linha = ((await vp.locator('.peca--equipada .linha-meta').first().textContent()) || '').replace(/\s+/g, ' ')
        if (!linha.includes(esperado)) problems.push(`valor-peca: peça equipada ${slot} +${PLUS[slot]} mostra "${linha}" (a simulação usa ${esperado})`)
      }
      // Loja: a diferença do principal para a equipada sai dos mesmos mods
      await vp.locator('[data-acao="montaria-voltar"]').click()
      await vp.locator('[data-acao="aba"][data-id="loja"]').click()
      await vp.waitForSelector('#t-loja')
      for (const slot of Object.keys(PLUS)) {
        await vp.locator(`[data-acao="loja-tab"][data-id="${slot}"]`).click()
        const info = G.GEAR_SLOT_INFO[slot], cur = modsDe(equipados[slot], PLUS[slot])[info.main]
        const prods = await vp.evaluate(() => Array.from(document.querySelectorAll('.produto')).map((p) => ({
          id: (p.querySelector('[data-acao="comprar"]') || {}).getAttribute ? p.querySelector('[data-acao="comprar"]').getAttribute('data-id') : null,
          diff: ((p.querySelector('.produto-diff') || {}).textContent || '').trim() })))
        if (!prods.length) problems.push('valor-peca: Loja sem produtos em ' + slot)
        for (const p of prods) {
          const d = modsDe(p.id, 0)[info.main] - cur
          const esperado = d === 0 ? 'igual à equipada' : (d > 0 ? '+' : '−') + numTxt(Math.abs(d)) + ' ' + G.STATS[info.main].short + ' em relação à equipada'
          if (p.diff !== esperado) problems.push(`valor-peca: Loja ${p.id} contra ${equipados[slot]} +${PLUS[slot]} diz "${p.diff}" (real: "${esperado}")`)
        }
      }
    } catch (e) {
      problems.push('valor-peca: ' + e.message)
    }
    await vp.context().close()
  }

  // ---------------- subida de nível na tela de resultado: pontos livres ganhos; "teto" só no teto de verdade ----------------
  if (quer('nivel-pontos')) {
    const np = await newPage(browser, { width: 390, height: 844 }, 'nivel-pontos')
    const corre = async () => {
      await abrirSala(np)
      await np.getByRole('button', { name: /^Largar/ }).click()
      await np.waitForSelector('#pista')
      await np.getByRole('button', { name: /Pular|Ver resultado/ }).click()
      await np.waitForSelector('#t-resultado')
      return np.evaluate(() => Array.from(document.querySelectorAll('.levelup')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' | '))
    }
    try {
      await np.getByRole('button', { name: 'Escolher Brasa' }).click()
      await np.waitForSelector('#t-estabulo')
      // Brasa ★★ 2 -> 3: nenhum status arredondado muda, mas ganha 1 ponto livre (1 -> 2)
      await montaSave(np, (raw) => { raw.mounts[0].level = 2; raw.mounts[0].xp = G.ECONOMY.xpToLevel(2) - 1 })
      const t1 = await corre()
      if (!/Subiu para o nível 3/.test(t1)) problems.push('nivel-pontos: sem o aviso de nível 3: ' + t1)
      if (!/\+1 ponto livre\b/.test(t1) || !/aba Status/.test(t1)) problems.push('nivel-pontos: 2 -> 3 não fala do ponto livre ganho nem da aba Status: ' + t1)
      if (/teto/i.test(t1)) problems.push('nivel-pontos: 2 -> 3 fala em teto sem estar no teto: ' + t1)
      // Comum de genética 31 com 6 pontos em cada status: os sete no teto de 80 (natural 74,2 + 6) já no nível 49
      await montaSave(np, (raw) => {
        const m = raw.mounts[0]
        m.level = 49; m.xp = G.ECONOMY.xpToLevel(49) - 1
        m.potential = Object.fromEntries(G.STAT_KEYS.map((k) => [k, 31]))
        m.alloc = Object.fromEntries(G.STAT_KEYS.map((k) => [k, 6]))
      })
      const t2 = await corre()
      if (!/Subiu para o nível 50/.test(t2) || !/teto da raridade/.test(t2)) problems.push('nivel-pontos: cavalo no teto sem a frase do teto: ' + t2)
      if (/ponto livre/.test(t2)) problems.push('nivel-pontos: cavalo com os sete status no teto convidado a distribuir pontos: ' + t2)
    } catch (e) {
      problems.push('nivel-pontos: ' + e.message)
    }
    await np.context().close()
  }

  // ---------------- selo "+N": só os pontos que ainda cabem; no teto, a aba Status explica a sobra ----------------
  if (quer('selo-teto')) {
    const sq = await newPage(browser, { width: 360, height: 780 }, 'selo-teto')
    try {
      await sq.getByRole('button', { name: 'Escolher Brasa' }).click()
      await sq.waitForSelector('#t-estabulo')
      // m2: Comum nível 50 de genética 31 com 6 pontos em cada status: os sete no teto, 16 dos 58 pontos sobrando
      const CHEIO = Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { alloc: Object.fromEntries(G.STAT_KEYS.map((k) => [k, 6])) })
      await montaSave(sq, (raw) => { raw.mounts.push(CHEIO); raw.nextUid = 3; raw.stableSlots = 3 })
      const m2 = (await sq.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state.mounts))))[1]
      const info = S.allocInfo(m2)
      if (info.left !== 16 || G.STAT_KEYS.some((k) => info.room[k])) problems.push('selo-teto: montaria de teste ' + JSON.stringify(info))
      if (await sq.locator('.montaria[data-uid="m2"] .pontos-livres').count()) problems.push('selo-teto: o cartão do Estábulo mostra "+N" com os sete status no teto: ' + await sq.locator('.montaria[data-uid="m2"] .pontos-livres').first().textContent())
      await sq.locator('button[data-acao="montaria"][data-id="m2"]').click()
      await sq.waitForSelector('#t-montaria')
      if (await sq.locator('.montaria-cabeca .pontos-livres').count()) problems.push('selo-teto: o retrato da Montaria mostra "+N" com os sete status no teto')
      const tx = ((await sq.locator('#tela').textContent()) || '').replace(/\s+/g, ' ')
      if (!/Sobram 16 pontos: todos os status estão no teto ou no limite/.test(tx)) problems.push('selo-teto: a aba Status não explica os 16 pontos que sobram')
      // a Brasa nível 12 (13 pontos, nada no teto) continua com o "+13"
      await montaSave(sq, (raw) => { raw.mounts[0].level = 12 })
      if (((await sq.locator('.montaria[data-uid="m1"] .pontos-livres').first().textContent().catch(() => '')) || '').trim() !== '+13') problems.push('selo-teto: a Brasa nível 12 perdeu o "+13"')
    } catch (e) {
      problems.push('selo-teto: ' + e.message)
    }
    await sq.context().close()
  }

  if (quer('build-nivel1')) {
    const b1 = await newPage(browser, { width: 360, height: 780 }, 'build-nivel1')
    try {
      await b1.getByRole('button', { name: 'Escolher Brasa' }).click()
      await b1.waitForSelector('#t-estabulo')
      if ((await b1.locator('.montaria .pontos-livres').count()) !== 0) problems.push('build-nivel1: o cartão do Estábulo avisa pontos no nível 1')
      await b1.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await b1.waitForSelector('#t-montaria')
      const txt = ((await b1.locator('.pontos-livres').first().textContent()) || '').replace(/\s+/g, ' ')
      if (!/pontos livres:? 0\b/i.test(txt)) problems.push('build-nivel1: topo sem "pontos livres: 0": ' + txt)
      if ((await b1.locator('[data-acao="ponto-mais"]').count()) !== 0) problems.push('build-nivel1: nível 1 oferece "+"')
      if ((await b1.locator('[data-acao="pontos-confirmar"]').count()) !== 0) problems.push('build-nivel1: nível 1 oferece "Confirmar"')
      if ((await b1.locator('[data-status] .nota-genetica').count()) !== 7) problems.push('build-nivel1: sem as 7 notas de genética')
      await confereLegivel(b1, ['.pontos-livres', '.nota-genetica'], 'build-nivel1-360')
    } catch (e) {
      problems.push('build-nivel1: ' + e.message)
    }
    await b1.context().close()
  }

  if (quer('selo')) {
    for (const vp of [{ width: 360, height: 780 }, { width: 1280, height: 800 }]) {
      const tag = 'selo-' + vp.width
      const sl = await newPage(browser, vp, tag)
      const seloEm = async (sel) => ((await sl.locator(sel).first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim()
      try {
        await sl.getByRole('button', { name: 'Escolher Brasa' }).click()
        await sl.waitForSelector('#t-estabulo')
        await montaSave(sl, (raw) => { raw.mounts[0].level = 12; raw.mounts[0].xp = 40; raw.mounts.push(Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { sex: 'f', level: 7 })); raw.nextUid = 3; raw.stableSlots = 3 })
        // Estábulo: selo no retrato, barra de XP, "+N" e sem "Nv" na fileira de etiquetas
        if ((await seloEm('.montaria[data-uid="m1"] .retrato-moldura .selo-nivel')) !== 'Nv 12') problems.push(`${tag}: selo do cartão do Estábulo = "${await seloEm('.montaria[data-uid="m1"] .selo-nivel')}"`)
        if ((await sl.locator('.montaria[data-uid="m1"] .barra--xp').count()) !== 1) problems.push(tag + ': cartão do Estábulo sem barra de XP')
        if ((await seloEm('.montaria[data-uid="m1"] .pontos-livres')) !== '+13') problems.push(`${tag}: aviso de pontos do cartão = "${await seloEm('.montaria[data-uid="m1"] .pontos-livres')}"`)
        const etiquetas = await sl.evaluate(() => Array.from(document.querySelectorAll('.montaria .linha-meta')).map((e) => e.textContent).join(' | '))
        if (/Nv\s*\d/.test(etiquetas)) problems.push(tag + ': "Nv" continua na fileira de etiquetas do cartão: ' + etiquetas)
        await confereLegivel(sl, ['.montaria .selo-nivel', '.montaria .pontos-livres'], tag + '-estabulo')
        if (vp.width === 360) await capT6(sl, tag + '-estabulo.png')
        // Montaria
        await sl.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await sl.waitForSelector('#t-montaria')
        if ((await seloEm('.montaria-cabeca .retrato-moldura .selo-nivel')) !== 'Nv 12') problems.push(tag + ': Montaria sem o selo "Nv 12"')
        await confereLegivel(sl, ['.montaria-cabeca .selo-nivel'], tag + '-montaria')
        if (vp.width === 360 || vp.width === 1280) await capT6(sl, tag + '-montaria.png', true)
        await sl.locator('[data-acao="montaria-voltar"]').click()
        // Correr
        await sl.locator('[data-acao="aba"][data-id="correr"]').click()
        await sl.waitForSelector('#t-correr')
        if ((await seloEm('#tela .retrato-moldura .selo-nivel')) !== 'Nv 12') problems.push(tag + ': Correr sem o selo "Nv 12"')
        await confereLegivel(sl, ['.selo-nivel'], tag + '-correr')
        // Haras (a Brasa é macho: a montaria dele aparece em "Sua montaria")
        await sl.locator('[data-acao="aba"][data-id="haras"]').click()
        await sl.waitForSelector('#t-haras')
        if ((await seloEm('.haras-card[data-id="m1"] .retrato-moldura .selo-nivel')) !== 'Nv 12') problems.push(tag + ': Haras sem o selo "Nv 12" no cartão da Brasa')
        const harasMeta = await sl.evaluate(() => Array.from(document.querySelectorAll('.haras-card .linha-meta')).map((e) => e.textContent).join(' | '))
        if (/Nv\s*\d/.test(harasMeta)) problems.push(tag + ': "Nv" continua nas etiquetas do Haras')
        await confereLegivel(sl, ['.haras-card .selo-nivel'], tag + '-haras')
        const calcTxt = ((await sl.locator('#tela').textContent()) || '')
        await sl.locator('[data-acao="haras-partner"]').first().click()
        const calc = ((await sl.locator('.calc').textContent().catch(() => '')) || '')
        if (!/metade herdada/i.test(calc)) problems.push(tag + ': calculadora do Haras sem "a genética é metade herdada": ' + calc)
        if (/janela/i.test(calc + calcTxt)) problems.push(tag + ': Haras ainda fala em janela de status')
        // sala de largada
        await sl.locator('[data-acao="aba"][data-id="correr"]').click()
        await sl.locator('[data-acao="procurar"]').click()
        await sl.waitForSelector('#t-largada')
        if ((await seloEm('#tela .retrato-moldura .selo-nivel')) !== 'Nv 12') problems.push(tag + ': sala de largada sem o selo "Nv 12" no retrato')
        await confereLegivel(sl, ['.selo-nivel'], tag + '-sala')
        if (/Neutro/i.test((await sl.locator('#tela').textContent()) || '')) problems.push(tag + ': "Neutro" na sala')
      } catch (e) {
        problems.push(tag + ': ' + e.message)
      }
      await sl.context().close()
    }
  }

  if (quer('vaga-tipo')) {
    const vt = await newPage(browser, { width: 360, height: 780 }, 'vaga-tipo')
    const num1 = (x) => x.toFixed(1).replace('.', ',')
    // o efeito que a tela tem de mostrar, na força atual P (os números do RaceSim.typeSkill)
    const efeitoEsperado = (m) => {
      const ts = S.typeSkill(m), P = ts.power, e = G.TYPE_SKILLS[m.element].effect
      if (m.element === 'fogo') return { terco: 'primeiro terço', nums: ['+' + num1(e.accelMult * P * 100) + '%'] }
      if (m.element === 'grama') return { terco: 'terço do meio', nums: ['+' + num1(e.forcaAdd * P * 100), '−' + num1(e.drainCut * P * 100) + '%'] }
      return { terco: 'último terço', nums: ['+' + num1(e.speedMult * P * 100) + '%', num1(e.staminaRestore * P * 100) + '%'] }
    }
    try {
      await vt.getByRole('button', { name: 'Escolher Brasa' }).click()
      await vt.waitForSelector('#t-estabulo')
      await montaSave(vt, (raw) => {
        raw.mounts[0].level = 12
        raw.mounts.push(Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { uid: 'm2', rarity: 'raro', level: 30, skills: ['pe-na-chuva'] }))
        raw.mounts.push(Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { uid: 'm3', element: 'grama', rarity: 'lendario', level: 50, alloc: null }))
        raw.nextUid = 4; raw.stableSlots = 3
      })
      const s = await vt.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      for (const m of s.mounts) {
        await vt.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await vt.locator(`button[data-acao="montaria"][data-id="${m.uid}"]`).click()
        await vt.waitForSelector('#t-montaria')
        await vt.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
        const ts = S.typeSkill(m), esp = efeitoEsperado(m)
        const vaga = ((await vt.locator('.vaga-tipo').textContent().catch(() => '')) || '').replace(/\s+/g, ' ')
        if ((await vt.locator('.vaga-tipo').count()) !== 1) problems.push(`vaga-tipo: ${m.uid} com ${await vt.locator('.vaga-tipo').count()} vagas de tipo`)
        if (!vaga.includes(ts.name) || !vaga.toLowerCase().includes(esp.terco)) problems.push(`vaga-tipo: ${m.uid} sem nome/terço (${ts.name}, ${esp.terco}): ${vaga}`)
        const inten = 'Intensidade ×' + ts.power.toFixed(2).replace('.', ',')
        if (!vaga.includes(inten) || /Força ×/.test(vaga)) problems.push(`vaga-tipo: ${m.uid} sem o rótulo "${inten}" (ou ainda com "Força ×"): ${vaga}`)
        for (const nn of esp.nums) if (!vaga.includes(nn)) problems.push(`vaga-tipo: ${m.uid} sem o efeito na força atual ${nn}: ${vaga}`)
        // a vaga de tipo vem antes das vagas normais
        const ordem = await vt.evaluate(() => { const sec = document.querySelector('.vaga-tipo').closest('section'); const all = Array.from(sec.querySelectorAll('.vaga-tipo, .habilidade, .nota')); return all.map((e) => e.className.split(' ')[0]) })
        if (ordem[0] !== 'vaga-tipo') problems.push(`vaga-tipo: ${m.uid} a vaga de tipo não é a primeira: ${ordem.join(',')}`)
        if (m.skills.length && !(await vt.locator('.habilidade').count())) problems.push(`vaga-tipo: ${m.uid} sem as vagas normais`)
        await confereLegivel(vt, ['.vaga-tipo'], 'vaga-tipo-' + m.uid)
        if (m.uid === 'm2') await capT6(vt, 'vaga-tipo-360.png', true)
        await vt.locator('[data-acao="montaria-voltar"]').click()
      }
    } catch (e) {
      problems.push('vaga-tipo: ' + e.message)
    }
    await vt.context().close()
  }

  if (quer('inicial')) {
    for (const vp of [{ width: 360, height: 780 }, { width: 1280, height: 800 }]) {
      const tag = 'inicial-' + vp.width
      const ini = await newPage(browser, vp, tag)
      try {
        await ini.waitForSelector('.inicial')
        const corpo = (await ini.locator('#tela').textContent()) || ''
        if (/Neutro/i.test(corpo)) problems.push(tag + ': a tela inicial cita Neutro')
        for (const h of G.STARTERS) {
          const card = ini.locator('#ini-' + h.id)
          const t = ((await card.textContent()) || '').replace(/\s+/g, ' ')
          const ts = S.typeSkill(h), terco = h.element === 'fogo' ? 'primeiro terço' : h.element === 'grama' ? 'terço do meio' : 'último terço'
          const fortes = G.STAT_KEYS.slice().sort((a, b) => h.potential[b] - h.potential[a]).slice(0, 2).map((k) => G.STATS[k].name)
          if (!/Comum/.test(t)) problems.push(`${tag}: ${h.name} sem "Comum"`)
          // estrelas: o aria-label diz o grau; dentro, os ícones (ou ★/☆ de reserva, sem o arquivo)
          const est = await card.locator('.estrelas').first().getAttribute('aria-label').catch(() => '')
          if (est !== '2 de 3 estrelas' || h.grau !== 2) problems.push(`${tag}: ${h.name} sem as ★★ (estrelas "${est}", grau ${h.grau})`)
          if ((await card.locator('.vaga-tipo').count()) !== 1 || !t.includes(ts.name) || !t.toLowerCase().includes(terco)) problems.push(`${tag}: ${h.name} sem a skill de tipo e o terço (${ts.name}, ${terco})`)
          const fortesTxt = (await card.locator('.inicial-fortes').count()) ? await card.locator('.inicial-fortes').textContent() : ''
          for (const f of fortes) if (!fortesTxt.includes(f)) problems.push(`${tag}: ${h.name} sem o status forte ${f}`)
        }
        await confereLegivel(ini, ['.inicial .vaga-tipo', '.inicial .inicial-fortes'], tag)
        await capT6(ini, tag + '.png', vp.width > 400)
      } catch (e) {
        problems.push(tag + ': ' + e.message)
      }
      await ini.context().close()
    }
  }

  // ---------------- skill de tipo na pista (Tarefa 7 do bloco 1 do v3): aura, balão e terços do minimapa ----------------
  // Corrida DEV (seed 4242, 1600 m) com cavalos dos três tipos. Congela a corrida e desenha à mão em instantes
  // escolhidos (como o teto): cada cavalo com aura está no terço da própria skill de tipo e todo cavalo visível
  // nesse terço tem aura; com o pelotão no primeiro terço só os de Fogo, no do meio só os de Grama, no último só
  // os de Água; o balão com o nome curto entra na entrada de cada terço; o minimapa pinta os três terços; o mesmo
  // instante desenha o mesmo quadro; em movimento reduzido a aura continua (só o contorno), sem partículas.
  if (quer('aura')) {
    const corridaAura = async (vp, label, extra) => {
      const pg = await newPage(browser, vp, label, { query: '?dev=1', ...extra })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await devArmar(pg, { seed: 4242, distancia: 1600 })
        await abrirSala(pg)
        await pg.getByRole('button', { name: /^Largar/ }).click()
        await pg.waitForSelector('#pista')
        await pg.waitForFunction(() => window.__galope.race && window.__galope.race._state.phase === 'corrida', null, { timeout: 20000 })
        // os instantes saem da posição do JOGADOR (0,17·D, 0,5·D e 0,83·D) e contam com o pelotão junto dele:
        // trocar a seed ou a distância pode exigir reajustar as frações (ou o conjunto de tipos esperado)
        const r = await pg.evaluate((fracs) => {
          const rv = window.__galope.race, s = rv._state, L = window.__galope.ui.lobby, sim = L.sim, FX = window.RaceFx
          const desenha = rv.frame
          rv.frame = function () {}
          const D = L.cond.distance, els = L.racers.map((x) => x.horse.element), me = L.playerIdx
          const TS = sim.racerInfo.map((x) => x.typeSkill)
          const quadro = (T) => {
            s.phase = 'corrida'; s.simT = T; s.tReal = 7; s.last = 0; s.flash = 0; s.winnerSeen = true; s.mult = 1; s.climaTimer = 0
            desenha(performance.now())
            const st = FX._stats, fr = sim.frames[Math.min(sim.frames.length - 1, Math.round(T / sim.dt))]
            return { T, pos: fr.pos.slice(), auras: st.auras, quem: st.tipoAuras.map((a) => ({ ...a })), vis: st.caixasCavalos.map((c) => c.racer),
              baloes: st.caixasBaloes.map((b) => ({ racer: b.racer, tipo: b.tipo, texto: b.texto, pilha: b.pilha })), tercos: st.tercos, part: st.particulas }
          }
          const tDe = (f) => { for (const q of sim.frames) if (q.pos[me] >= f * D) return q.t; return 0 }
          const amostras = fracs.map((f) => ({ f, ...quadro(tDe(f)) }))
          // balão na entrada de cada terço: 0,2 s reais depois do evento da skill de tipo
          const entradas = s.fx.filter((it) => it.typeSkill).map((it) => {
            const q = quadro(it.t0 + 0.2 * it.escala)
            return { racer: it.racer, el: it.element, curto: it.nomeCurto, visivel: q.vis.includes(it.racer), balao: q.baloes.find((b) => b.racer === it.racer && b.tipo) || null }
          })
          // minimapa: pixels exatos das três cores dos elementos dentro da caixa
          const cv = document.getElementById('pista'), mc = s.lay.mini, S = s.S
          const img = cv.getContext('2d').getImageData(mc.x * S, mc.y * S, mc.w * S, mc.h * S).data
          const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
          const mini = {}
          for (const el of ['fogo', 'grama', 'agua']) {
            const c = hex(FX.ELEM[el]); let n = 0
            for (let i = 0; i < img.length; i += 4) if (img[i] === c[0] && img[i + 1] === c[1] && img[i + 2] === c[2]) n++
            mini[el] = n
          }
          // o mesmo instante desenha o mesmo quadro (aura animada pelo relógio da corrida)
          const hash = () => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (Math.imul(h, 31) + d[i]) >>> 0; return h }
          const tm = tDe(0.5)
          quadro(tm); const h1 = hash(); quadro(tm + 3); quadro(tm); const h2 = hash()
          rv.frame = desenha
          return { D, els, me, TS: TS.map((x) => x && [x.from, x.to]), amostras, entradas, mini, mesmoQuadro: h1 === h2 }
        }, [0.17, 0.5, 0.83])
        const zona = (j, p) => r.TS[j] && p >= r.TS[j][0] && p < r.TS[j][1]
        const esperado = { 0.17: 'fogo', 0.5: 'grama', 0.83: 'agua' }
        for (const a of r.amostras) {
          const comAura = a.quem.map((q) => q.racer)
          if (a.auras !== a.quem.length) problems.push(`[${label}] aura: _stats.auras ${a.auras} ≠ anotadas ${a.quem.length}`)
          for (const q of a.quem) {
            if (!zona(q.racer, a.pos[q.racer])) problems.push(`[${label}] aura: raia ${q.racer + 1} (${q.element}) com aura fora do terço em ${a.f} (pos ${a.pos[q.racer].toFixed(1)})`)
            if (q.element !== r.els[q.racer]) problems.push(`[${label}] aura: elemento trocado na raia ${q.racer + 1}`)
          }
          for (const j of a.vis) if (zona(j, a.pos[j]) && !comAura.includes(j)) problems.push(`[${label}] aura: raia ${j + 1} (${r.els[j]}) no terço sem aura em ${a.f}`)
          const tipos = [...new Set(a.quem.map((q) => q.element))]
          if (tipos.length !== 1 || tipos[0] !== esperado[a.f]) problems.push(`[${label}] aura: com o pelotão em ${a.f}·D, auras de ${JSON.stringify(tipos)} (esperado só ${esperado[a.f]})`)
          if (a.tercos !== 3) problems.push(`[${label}] aura: minimapa sem os três terços (${a.tercos})`)
          if (extra && extra.reducedMotion === 'reduce' && a.part !== 0) problems.push(`[${label}] aura: movimento reduzido com ${a.part} partículas`)
        }
        const porEl = {}
        for (const e of r.entradas) {
          if (!e.visivel) continue
          if (!e.balao) problems.push(`[${label}] aura: raia ${e.racer + 1} entrou no terço (${e.el}) sem balão`)
          else if (e.balao.pilha === 0 && e.balao.texto !== e.curto) problems.push(`[${label}] aura: balão da raia ${e.racer + 1} com "${e.balao.texto}" (esperado ${e.curto})`)
          if (e.balao) porEl[e.el] = (porEl[e.el] || 0) + 1
        }
        for (const el of ['fogo', 'grama', 'agua']) {
          if (!porEl[el]) problems.push(`[${label}] aura: nenhum balão de skill de tipo de ${el} na entrada do terço ${JSON.stringify(r.entradas)}`)
          if (!(r.mini[el] > 0)) problems.push(`[${label}] aura: minimapa sem a faixa de ${el} ${JSON.stringify(r.mini)}`)
        }
        if (!r.mesmoQuadro) problems.push(`[${label}] aura: o mesmo instante desenhou quadros diferentes`)
        notes['aura-' + label] = { els: r.els, auras: r.amostras.map((a) => a.f + ':' + a.quem.map((q) => q.racer + 1 + q.element[0]).join(',')), balões: porEl, mini: r.mini }
        await capT6(pg, label + '.png')
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado')
      } catch (e) {
        problems.push(`[${label}] aura: ${e.message}`)
      } finally {
        await pg.context().close()
      }
    }
    await corridaAura({ width: 1280, height: 800 }, 'aura1280')
    await corridaAura({ width: 360, height: 780 }, 'aura360-reduzido', { reducedMotion: 'reduce' })
  }

  // ---------------- Skills visíveis (DEV): balão, faixa central, contorno e "skills sempre ativam" ----------------
  // Cavalo Raro de Fogo (chance de skill 0,55) com Arranque (largada) e Arrancada Final (reta final, gatilho certo);
  // a Labareda, skill de tipo do Fogo, entra sozinha em t = 0 junto com o Arranque (sem sorteio). Primeiro acha uma seed em que, SEM armar, as três
  // não ativam; depois repete a mesma seed armada com "skills sempre ativam" e confere que as três ativam, com
  // balões presos à raia, faixa central em sequência e contorno da silhueta.
  if (quer('skills')) {
    const SK_SEEDS = [301, 302, 303, 304, 305, 306, 307, 308]
    const preparar = async (pg) => {
      await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
      await devAbrir(pg)
      await pg.fill('#dev-nome', 'Skill DEV')
      await pg.selectOption('#dev-elemento', 'fogo')
      await pg.selectOption('#dev-raridade', 'raro')
      await pg.fill('#dev-nivel', '1')
      const sks = ['arranque', 'arrancada-final', '', '', '']
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
          if (b.tipo) g.baloesTipo = (g.baloesTipo || 0) + 1
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
        // o Raro tem 3 vagas e só 2 vêm da gaveta: subindo de nível entre as corridas ele pode aprender uma
        // terceira, que também ativa armada
        const vagasUsadas = await pg.evaluate(() => { const s = window.__galope.state; return s.mounts.find((m) => m.uid === s.activeId).skills.length })
        if (armada.length !== 1 + vagasUsadas || !/Arranque/.test(armada.join(' ')) || !/Labareda/.test(armada.join(' ')) || !/Arrancada Final/.test(armada.join(' '))) problems.push(`[${label}] skills: sempre ativam deu ${JSON.stringify(armada)} (sem armar: ${JSON.stringify(semArmar)})`)
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
        // Arranque (vaga) e Labareda (skill de tipo) entram juntos em t = 0: as duas faixas, uma depois da outra
        if (!['ARRANQUE!', 'LABAREDA!'].every((f) => g.faixas.includes(f))) problems.push(`[${label}] skills: as duas skills de t = 0 não ganharam faixa ${JSON.stringify(g.faixas)}`)
        else {
          const esc = await pg.evaluate(() => window.__galope.race._state.fx.find((x) => x.kind === 'skill').escala)
          const t1 = g.faixasT[g.faixas.indexOf('ARRANQUE!')], t2 = g.faixasT[g.faixas.indexOf('LABAREDA!')]
          if (Math.abs(t2 - t1) < 1.3 * esc) problems.push(`[${label}] skills: faixas das duas skills de t = 0 não entram em sequência (${t1.toFixed(2)} e ${t2.toFixed(2)}, escala ${esc.toFixed(2)})`)
        }
        if (!g.baloesTipo) problems.push(`[${label}] skills: a Labareda (skill de tipo) não ganhou balão`)
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

  // ---------------- ícones nas telas (Visuais 2, parte 1: spec 2026-11-12-icones §4 e §5) ----------------
  // Em cada tela principal (Estábulo, Montaria: Status e Skills, Haras, Perfil, sala aberta, corrida, resultado e a
  // escolha do inicial), no celular (360) e no computador (1280): os símbolos trocados (👤 🎲 ♂ ♀ ★ ☆ ⚑) somem do
  // texto visível quando o ícone deles existe (sem o arquivo, a reserva volta); cada ícone novo é decorativo
  // (alt="") e tem texto ao lado (ou o aria-label do pai: botão do Perfil e estrelas); as estrelas dizem "N de 3
  // estrelas"; nenhuma imagem quebrada; o cartão de skill com o ícone de 32 px não cria rolagem horizontal; o
  // "Clima: X" da corrida troca o ícone junto quando o Dado vira o clima.
  // Depois, Review Focus 1: sem 'st-vel' e 'sk-arranque' no mapa, só esses dois voltam à reserva.
  if (quer('icones')) {
    const TROCA = { 'ui-perfil': '👤', 'ui-dado': '🎲', 'ui-macho': '♂', 'ui-femea': '♀', 'ui-estrela': '★', 'ui-estrela-vazia': '☆', 'ui-corcel': '⚑' }
    // a tela aberta: confere as regras gerais e devolve os nomes dos ícones novos que ela mostra
    const confereTela = async (pg, tela) => {
      await pg.waitForFunction(() => Array.prototype.every.call(document.images, (i) => i.complete), null, { timeout: 5000 }).catch(() => {})
      const r = await pg.evaluate((troca) => {
        const m = window.__ICONES || {}
        const txt = document.body.innerText
        const nome = (i) => { const c = Array.prototype.find.call(i.classList, (x) => /^icone--[a-z]/.test(x)); return c ? c.slice(7) : '' }
        const imgs = Array.prototype.filter.call(document.querySelectorAll('img.icone'), (i) => /^(ui|st|sk|cl|pi|liga|rar|podio)-/.test(nome(i)))
        return {
          simbolos: Object.keys(troca).filter((n) => Object.prototype.hasOwnProperty.call(m, n) && txt.includes(troca[n])).map((n) => troca[n]),
          semAlt: imgs.filter((i) => i.getAttribute('alt') !== '').map(nome),
          semTexto: imgs.filter((i) => { const p = i.parentElement; return !((p.innerText || '').trim() || (p.getAttribute('aria-label') || '').trim()) }).map(nome),
          quebradas: Array.prototype.filter.call(document.images, (i) => !i.complete || i.naturalWidth === 0).map((i) => i.className),
          estrelas: Array.prototype.map.call(document.querySelectorAll('.estrelas'), (e) => e.getAttribute('aria-label')),
          nomes: imgs.map(nome)
        }
      }, TROCA)
      for (const s of r.simbolos) problems.push(`${tela}: o símbolo ${s} continua no texto da tela (o ícone dele existe)`)
      if (r.semAlt.length) problems.push(`${tela}: ícones sem alt="": ${r.semAlt.join(', ')}`)
      if (r.semTexto.length) problems.push(`${tela}: ícones sem texto ao lado: ${r.semTexto.join(', ')}`)
      if (r.quebradas.length) problems.push(`${tela}: imagens quebradas: ${r.quebradas.join(' | ')}`)
      const malEstrelas = r.estrelas.filter((a) => !/^[0-3] de 3 estrelas$/.test(a || ''))
      if (malEstrelas.length) problems.push(`${tela}: estrelas com aria-label fora de "N de 3 estrelas": ${JSON.stringify(malEstrelas)}`)
      return r
    }
    // a corrida na tela tem virada de clima? Pula até ela e confere o "Clima: X" (texto e ícone novos)
    const confereViradaClima = async (pg, tag, ICONES) => {
      const ev = await pg.evaluate(() => { const e = window.__galope.ui.lobby.sim.events.find((x) => x.type === 'clima'); return e ? { t: e.t, weather: e.weather } : null })
      if (!ev) return false
      const antes = await pg.evaluate(() => window.__galope.ui.lobby.cond.weather)
      await pg.evaluate((t) => { const s = window.__galope.race._state; s.phase = 'corrida'; s.simT = Math.max(s.simT, t + 0.01) }, ev.t)
      const nome = G.WEATHERS[ev.weather].name
      try {
        await pg.waitForFunction((w) => { const el = document.getElementById('clima-atual'); return !!el && el.textContent === 'Clima: ' + w }, nome, { timeout: 5000 })
      } catch (e) {
        problems.push(`${tag} corrida: "Clima: ${nome}" não apareceu na virada (ficou "${await pg.locator('#clima-atual').textContent()}")`)
        return true
      }
      // só o ícone do clima novo (o antigo sai), decorativo
      const hud = await pg.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#clima-atual img'), (i) => ((/icone--(cl-[a-z]+)/.exec(i.className) || [])[1] || i.className) + '|' + i.getAttribute('alt')))
      const esperado = ICONES.includes('cl-' + ev.weather) ? ['cl-' + ev.weather + '|'] : []
      if (JSON.stringify(hud) !== JSON.stringify(esperado)) problems.push(`${tag} corrida: ícone do clima depois da virada ${antes} -> ${ev.weather}: ${JSON.stringify(hud)}`)
      // a narração já mostra o Dado que virou o clima: o 🎲 dela também vira ícone
      const rv = await confereTela(pg, tag + ' corrida (virada)')
      if (ICONES.includes('ui-dado') && !rv.nomes.includes('ui-dado')) problems.push(`${tag} corrida: a linha do Dado na narração sem o ícone ui-dado`)
      notes['icones-virada-' + tag] = { de: antes, para: ev.weather, t: ev.t }
      return true
    }
    for (const vp of [{ width: 360, height: 780 }, { width: 1280, height: 800 }]) {
      const tag = 'icones-' + vp.width
      const pg = await newPage(browser, vp, tag)
      try {
        const ICONES = await pg.evaluate(() => Object.keys(window.__ICONES || {}))
        // nomes (ou prefixos terminados em '-') que a tela tem de mostrar, só os que têm arquivo
        const espera = (r, tela, nomes) => {
          for (const n of nomes) {
            const tem = n.endsWith('-') ? ICONES.some((x) => x.startsWith(n)) : ICONES.includes(n)
            const viu = n.endsWith('-') ? r.nomes.some((x) => x.startsWith(n)) : r.nomes.includes(n)
            if (tem && !viu) problems.push(`${tag} ${tela}: sem o ícone ${n}`)
          }
        }
        await pg.waitForSelector('.inicial')
        espera(await confereTela(pg, tag + ' inicial'), 'inicial', ['ui-estrela', 'ui-estrela-vazia', 'rar-comum', 'liga-', 'st-vel', 'sk-tipo-fogo', 'sk-tipo-agua', 'sk-tipo-grama', 'cl-sol', 'cl-chuva', 'cl-nevoa'])
        await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
        await pg.waitForSelector('#t-estabulo')
        // Brasa (macho, Comum ★★) com a skill de linha da Comum: Corcel; m2 fêmea Rara ★★★, Corcel da Rara; Ouro para várias corridas
        await montaSave(pg, (raw) => {
          raw.gold = 99999; raw.seedBase = 7   // salas fixas: a busca pela virada de clima (abaixo) é sempre a mesma
          raw.mounts[0].skills = ['arranque']
          raw.mounts.push(Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { uid: 'm2', rarity: 'raro', grau: 3, level: 30, skills: ['arranque', 'sprint', 'drift'] }))
          raw.nextUid = 3; raw.stableSlots = 3
        })
        const est = await confereTela(pg, tag + ' estábulo')
        espera(est, 'estábulo', ['ui-perfil', 'ui-macho', 'ui-femea', 'ui-corcel', 'ui-estrela', 'ui-estrela-vazia', 'rar-comum', 'rar-raro'])
        const estTxt = ((await pg.locator('.montarias').textContent()) || '').replace(/\s+/g, ' ')
        for (const p of ['Macho', 'Fêmea', 'Corcel']) if (!estTxt.includes(p)) problems.push(`${tag} estábulo: sem o texto "${p}" ao lado do ícone`)
        const rotPerfil = await pg.locator('.app-perfil').getAttribute('aria-label')
        if (rotPerfil !== 'Perfil') problems.push(`${tag} estábulo: botão do Perfil com aria-label "${rotPerfil}"`)
        // Montaria m1: aba Status (os 7 status) e aba Skills (ícones de 32 px)
        await pg.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pg.waitForSelector('#t-montaria')
        espera(await confereTela(pg, tag + ' montaria-status'), 'montaria-status', G.STAT_KEYS.map((k) => 'st-' + k).concat(['liga-', 'ui-corcel', 'ui-macho']))
        for (const uid of ['m1', 'm2', 'm3', 'm4']) {
          if (uid === 'm2') {
            await pg.locator('[data-acao="montaria-voltar"]').click()
            await pg.locator('button[data-acao="montaria"][data-id="m2"]').click()
            await pg.waitForSelector('#t-montaria')
          }
          await pg.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
          await pg.waitForSelector('.vaga-tipo')
          const sk = await confereTela(pg, `${tag} skills ${uid}`)
          espera(sk, 'skills ' + uid, uid === 'm1' ? ['sk-arranque', 'sk-tipo-fogo'] : ['sk-arranque', 'sk-sprint', 'sk-drift', 'sk-tipo-agua', 'ui-femea'])
          const tam = await pg.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.habilidade img.icone, .vaga-tipo img.icone'), (i) => {
            const b = i.getBoundingClientRect()
            return { c: i.className, w: i.getAttribute('width'), h: i.getAttribute('height'), rw: Math.round(b.width), rh: Math.round(b.height) }
          }))
          const sk32 = tam.filter((t) => /icone--sk-/.test(t.c))
          if (ICONES.some((x) => x.startsWith('sk-')) && !sk32.length) problems.push(`${tag} skills ${uid}: nenhum img.icone--sk-* no cartão`)
          for (const t of sk32) if (t.w !== '32' || t.h !== '32' || t.rw !== 32 || t.rh !== 32) problems.push(`${tag} skills ${uid}: ícone de skill fora de 32 px ${JSON.stringify(t)}`)
          await checkOverflow(pg, `skills ${vp.width} ${uid}`)
        }
        await pg.locator('[data-acao="montaria-voltar"]').click()
        // Haras: cartões (sexo, estrelas) e calculadora (estrelas do potro, Corcel, "Fêmea × Macho")
        await pg.locator('[data-acao="aba"][data-id="haras"]').click()
        await pg.waitForSelector('#t-haras')
        await pg.locator('[data-acao="haras-partner"]').first().click()
        await pg.waitForSelector('.calc')
        espera(await confereTela(pg, tag + ' haras'), 'haras', ['ui-macho', 'ui-femea', 'ui-corcel', 'ui-estrela', 'ui-estrela-vazia'])
        const calcEst = await pg.locator('.calc .estrelas').count()
        if (calcEst < 3) problems.push(`${tag} haras: a calculadora mostra ${calcEst} grupos de estrelas (esperado 1, 2 e 3 estrelas)`)
        // Perfil
        await pg.locator('[data-acao="perfil"]').click()
        await pg.waitForSelector('#t-perfil')
        espera(await confereTela(pg, tag + ' perfil'), 'perfil', ['ui-perfil'])
        await pg.locator('[data-acao="perfil-voltar"]').click()
        // sala aberta: chips de Piso e Clima, prêmios do 1º ao 3º
        await abrirSala(pg)
        const sala = await pg.evaluate(() => { const L = window.__galope.ui.lobby; return { piso: L.cond.surface, clima: L.cond.weather, premios: document.querySelectorAll('.premio').length } })
        const rs = await confereTela(pg, tag + ' sala')
        espera(rs, 'sala', ['pi-' + sala.piso, 'cl-' + sala.clima, 'podio-1', 'podio-2'].concat(sala.premios >= 3 ? ['podio-3'] : []))
        const chips = await pg.evaluate(() => Array.prototype.map.call(document.querySelectorAll('[aria-label="Condições da pista"] .chip img.icone'), (i) => i.className))
        if (ICONES.includes('pi-' + sala.piso) && !chips.some((c) => c.includes('icone--pi-' + sala.piso))) problems.push(`${tag} sala: chip do Piso sem ícone ${JSON.stringify(chips)}`)
        if (ICONES.includes('cl-' + sala.clima) && !chips.some((c) => c.includes('icone--cl-' + sala.clima))) problems.push(`${tag} sala: chip do Clima sem ícone ${JSON.stringify(chips)}`)
        // corrida: "Clima: X" com o ícone; virada de clima troca os dois
        await pg.getByRole('button', { name: /^Largar/ }).click()
        await pg.waitForSelector('#pista')
        const rc = await confereTela(pg, tag + ' corrida')
        espera(rc, 'corrida', ['cl-' + sala.clima])
        const climaHud = ((await pg.locator('#clima-atual').textContent()) || '')
        if (climaHud !== 'Clima: ' + G.WEATHERS[sala.clima].name) problems.push(`${tag} corrida: painel com "${climaHud}"`)
        let virou = await confereViradaClima(pg, tag, ICONES)
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado')
        // resultado: medalhas na ordem de chegada e a nota do Dado
        espera(await confereTela(pg, tag + ' resultado'), 'resultado', ['podio-1', 'podio-2', 'podio-3', 'ui-dado'])
        const pos = await pg.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.tabela td.pos'), (td) => (td.querySelector('img.icone') || {}).className || ''))
        for (let k = 0; k < Math.min(3, pos.length); k++) if (ICONES.includes('podio-' + (k + 1)) && !pos[k].includes('icone--podio-' + (k + 1))) problems.push(`${tag} resultado: ${k + 1}º lugar da tabela sem a medalha (${pos[k]})`)
        if (pos.slice(3).some(Boolean)) problems.push(`${tag} resultado: medalha depois do 3º lugar ${JSON.stringify(pos)}`)
        // sem virada na 1ª corrida: corre de novo (a seed do save muda a cada sala) até achar uma
        for (let i = 0; i < 8 && !virou; i++) {
          await pg.getByRole('button', { name: 'Correr de novo' }).click()
          await pg.waitForSelector('#t-largada')
          await pg.getByRole('button', { name: /^Largar/ }).click()
          await pg.waitForSelector('#pista')
          virou = await confereViradaClima(pg, tag, ICONES)
          await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
          await pg.waitForSelector('#t-resultado')
        }
        if (!virou) problems.push(`${tag}: nenhuma das 9 corridas virou o clima (a troca do "Clima: X" ficou sem teste)`)
      } catch (e) {
        problems.push(tag + ': ' + e.message)
      }
      await pg.context().close()
    }

    // Review Focus 1: um ícone faltando mostra a reserva daquele item e o ícone dos outros, sem <img> quebrado
    const fa = await newPage(browser, { width: 360, height: 780 }, 'icones-falta', {
      init: () => {
        let v
        Object.defineProperty(window, '__ICONES', { configurable: true, get: () => v, set: (x) => { v = Object.assign({}, x); delete v['st-vel']; delete v['sk-arranque'] } })
      }
    })
    try {
      await fa.getByRole('button', { name: 'Escolher Brasa' }).click()
      await fa.waitForSelector('#t-estabulo')
      await montaSave(fa, (raw) => { raw.mounts[0].skills = ['arranque'] })
      await fa.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await fa.waitForSelector('#t-montaria')
      const st = await fa.evaluate((ks) => ks.map((k) => {
        const nm = document.querySelector('.build-linha[data-status="' + k + '"] .build-nome')
        return { k, svg: nm ? nm.querySelectorAll('svg.icone-status').length : -1, img: nm ? Array.prototype.map.call(nm.querySelectorAll('img'), (i) => i.className) : [] }
      }), G.STAT_KEYS)
      for (const s of st) {
        const ok = s.k === 'vel' ? s.svg === 1 && !s.img.length : s.svg === 0 && s.img.length === 1 && s.img[0].includes('icone--st-' + s.k)
        if (!ok) problems.push('icones-falta: aba Status, ' + s.k + ' ' + JSON.stringify(s))
      }
      await fa.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
      await fa.waitForSelector('.habilidade')
      const hab = await fa.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.habilidade b img, .habilidade b canvas'), (i) => i.tagName + ':' + i.className))
      if (hab.some((c) => /icone--sk-arranque/.test(c)) || !hab.some((c) => /icone--el-geral|^CANVAS/.test(c))) problems.push('icones-falta: Arranque sem a reserva (selo do elemento) ' + JSON.stringify(hab))
      if (!(await fa.locator('.vaga-tipo img.icone--sk-tipo-fogo').count())) problems.push('icones-falta: a skill de tipo perdeu o próprio ícone')
      await fa.waitForFunction(() => Array.prototype.every.call(document.images, (i) => i.complete), null, { timeout: 5000 }).catch(() => {})
      const queb = await fa.evaluate(() => Array.prototype.filter.call(document.images, (i) => i.naturalWidth === 0).map((i) => i.className))
      if (queb.length) problems.push('icones-falta: imagens quebradas ' + JSON.stringify(queb))
    } catch (e) {
      problems.push('icones-falta: ' + e.message)
    }
    await fa.context().close()
  }

  // ---------------- Marcas e jóquei: dados (Visuais 2, parte 2a, Task 4) ----------------
  // O save sem marcas e sem jóquei abre com as marcas calculadas (as do modelo do catálogo, senão marcasDoId do uid)
  // e o jóquei inicial; lixo nos dois (Review Focus 1) e o alugado de antes da 2a (Review Focus 4) também. Cada
  // drawHorse (retrato, sala, corrida e pódio) recebe as marcas, a semente (Breed.hashChave da chave), o jóquei e a
  // raridade do cavalo; o dos rivais sai da seed da sala e da raia, sem mudar a sala salva. A gaveta DEV escolhe as
  // marcas da montaria (3 seletores, texto sem símbolos); o potro nasce com marcas que ficam no save. A corrida DEV
  // com 8 Míticos (Review Focus 5) monta os quadros de cada cavalo na largada (o cache dos moldes não cresce depois)
  // e fica abaixo dos 6 ms por quadro que o teste de desempenho usa de teto. Nada quebra nem rola de lado a 360 px.
  if (quer('marcas')) {
    const JQ0 = { padrao: G.JOQUEI.padrao, capacete: G.JOQUEI.capacete }
    const TETO_MS = 6   // o mesmo teto do teste de desempenho (Completas − Reduzidas)
    const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    const doCatalogo = (id) => { const h = G.STARTERS.concat(G.WILD_HORSES).find((x) => x.id === id); return h ? h.marcas : null }
    const mStr = (m) => (m && typeof m === 'object' ? m.cara + '/' + m.patas + '/' + m.corpo : String(m))
    // jóquei de um rival: 1 sorteio para o padrão e 1 para o capacete, da seed da sala e da raia (índice em L.racers)
    const joqueiRival = (seed, j) => {
      const r = S.mulberry32(S.hash2(seed, 0x4A4F0000 + j))
      const padrao = G.JOQUEI.padroes[Math.floor(r() * G.JOQUEI.padroes.length)]
      return { padrao, capacete: G.JOQUEI.capacetes[Math.floor(r() * G.JOQUEI.capacetes.length)] }
    }
    // espia do Sprites.drawHorse (o jogo chama SP.drawHorse a cada desenho): guarda as opções das primeiras 400
    // chamadas desde a última ligação em window.__desenhos; ligar = false devolve o original
    const espia = (pg, ligar = true) => pg.evaluate((on) => {
      const SP = window.Sprites
      if (!SP.__drawOrig) SP.__drawOrig = SP.drawHorse
      window.__desenhos = []
      const campos = ['element', 'idle', 'jockey', 'silks', 'marcas', 'semente', 'joquei', 'raridade', 'rastro', 'reduzido']
      SP.drawHorse = !on ? SP.__drawOrig : function (ctx, x, y, o) {
        if (window.__desenhos.length < 400) {
          const c = { quadro: !!(o && o.quadro) }
          campos.forEach((k) => { const v = o ? o[k] : undefined; c[k] = v === undefined ? '(ausente)' : (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v) })
          window.__desenhos.push(c)
        }
        return SP.__drawOrig.apply(this, arguments)
      }
    }, ligar)
    const desenhos = (pg) => pg.evaluate(() => window.__desenhos.slice())
    // para cada cavalo esperado ({ chave, marcas, joquei, raridade }): uma chamada com a semente da chave e os valores
    // certos; filtro escolhe as chamadas da tela (ex.: só as com quadro, as dos retratos e do pódio)
    const confereDesenhos = (lista, esperados, onde, filtro = () => true, extra = {}) => {
      const daTela = lista.filter(filtro)
      for (const e of esperados) {
        const sem = B.hashChave(e.chave)
        const dela = daTela.filter((d) => d.semente === sem)
        if (!dela.length) {
          problems.push(`marcas (${onde}): nenhum drawHorse com a semente de ${e.chave} (${sem}); sementes: ${[...new Set(daTela.map((d) => d.semente))].join(', ')}`)
          continue
        }
        // dois rivais do mesmo modelo têm a mesma semente (as manchas iguais) e jóqueis diferentes: basta uma chamada que bata
        const bate = (x) => igual(x.marcas, e.marcas) && igual(x.joquei, e.joquei) && x.raridade === e.raridade
        const d = dela.slice().reverse().find(bate) || dela[dela.length - 1], erros = []
        if (!igual(d.marcas, e.marcas)) erros.push(`marcas ${mStr(d.marcas)} (esperado ${mStr(e.marcas)})`)
        if (!igual(d.joquei, e.joquei)) erros.push(`joquei ${JSON.stringify(d.joquei)} (esperado ${JSON.stringify(e.joquei)})`)
        if (d.raridade !== e.raridade) erros.push(`raridade ${d.raridade} (esperado ${e.raridade})`)
        if (typeof d.reduzido !== 'boolean') erros.push('reduzido ' + d.reduzido)
        for (const [k, v] of Object.entries(extra)) if (d[k] !== v) erros.push(`${k} ${d[k]} (esperado ${v})`)
        if (erros.length) problems.push(`marcas (${onde}): ${e.chave}: ${erros.join('; ')}`)
      }
    }
    // nenhuma imagem quebrada e nenhuma rolagem horizontal
    const semQuebra = async (pg, onde) => {
      await pg.waitForFunction(() => Array.prototype.every.call(document.images, (i) => i.complete), null, { timeout: 5000 }).catch(() => {})
      const q = await pg.evaluate(() => Array.prototype.filter.call(document.images, (i) => i.naturalWidth === 0).map((i) => i.className || 'img'))
      if (q.length) problems.push(`${onde}: imagens quebradas ${JSON.stringify(q)}`)
      await checkOverflow(pg, onde)
    }
    const estado = (pg) => pg.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    const daAtiva = (s) => s.mounts.find((m) => m.uid === s.activeId)

    // 1. save real sem marcas e sem jóquei, com lixo e com o alugado de antes da 2a (360 px)
    {
      const label = 'marcas-save'
      const pg = await newPage(browser, { width: 360, height: 780 }, label)
      try {
        await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
        await pg.waitForSelector('#t-estabulo')
        const garoa = G.WILD_HORSES.find((h) => h.id === 'w-garoa')
        const outro = (uid, o) => Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { uid, name: 'Cavalo ' + uid.slice(1) }, o)
        await montaSave(pg, (raw) => {
          delete raw.joquei
          delete raw.mounts[0].marcas                                                      // Brasa: as do modelo
          raw.mounts.push(outro('m2', {}))                                                  // sem modelo: marcasDoId('m2')
          raw.mounts.push(outro('m3', { templateId: 'w-garoa', element: garoa.element, rarity: garoa.rarity, name: 'Garoa' }))   // RF4
          raw.mounts.push(outro('m4', { marcas: { cara: 'x', patas: 7 } }))                  // RF1: lixo, sem modelo
          raw.mounts.push(outro('m5', { templateId: 'w-garoa', marcas: { cara: 'frente', patas: 3, corpo: 'pintado' } }))   // válidas: ficam
          raw.mounts.push(outro('m6', { templateId: 'w-garoa', marcas: { cara: 'listra', patas: '2', corpo: 'liso' } }))     // patas em texto: o modelo
          raw.nextUid = 7; raw.stableSlots = 6
        })
        const esperadas = {
          m1: doCatalogo('brasa'), m2: B.marcasDoId('m2'), m3: doCatalogo('w-garoa'), m4: B.marcasDoId('m4'),
          m5: { cara: 'frente', patas: 3, corpo: 'pintado' }, m6: doCatalogo('w-garoa')
        }
        if (mStr(esperadas.m3) !== 'estrela/0/ruao') problems.push(`${label}: as marcas da Garoa no catálogo mudaram (${mStr(esperadas.m3)})`)
        let s = await estado(pg)
        for (const [uid, m] of Object.entries(esperadas)) {
          const got = (s.mounts.find((x) => x.uid === uid) || {}).marcas
          if (!igual(got, m) || !B.marcasValidas(got)) problems.push(`${label}: ${uid} abriu com marcas ${JSON.stringify(got)} (esperado ${mStr(m)})`)
        }
        if (!igual(s.joquei, JQ0)) problems.push(`${label}: save sem joquei abriu com ${JSON.stringify(s.joquei)} (esperado ${JSON.stringify(JQ0)})`)
        // retratos do estábulo: as marcas, a semente e a raridade de cada montaria (o retrato não tem jóquei)
        await espia(pg)
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.waitForSelector('#t-estabulo')
        confereDesenhos(await desenhos(pg), s.mounts.map((m) => ({ chave: m.uid, marcas: esperadas[m.uid], joquei: null, raridade: m.rarity })), 'estábulo', (d) => d.quadro)
        await semQuebra(pg, label + '-estabulo')
        // RF1: jóquei com lixo volta ao inicial; válido fica (capacete sem diferença de maiúsculas)
        for (const [joq, esp] of [[{ capacete: 'red' }, JQ0], ['lixo', JQ0], [{ padrao: 'xadrez', capacete: '#123456' }, JQ0],
          [{ padrao: 'nada', capacete: '#62b8ff' }, JQ0], [{ padrao: 'xadrez', capacete: '#62B8FF' }, { padrao: 'xadrez', capacete: '#62b8ff' }]]) {
          await montaSave(pg, (raw) => { raw.joquei = joq })
          s = await estado(pg)
          if (!igual(s.joquei, esp)) problems.push(`${label}: joquei ${JSON.stringify(joq)} abriu como ${JSON.stringify(s.joquei)} (esperado ${JSON.stringify(esp)})`)
        }
        // ficha da Garoa alugada antes da 2a (RF4): o retrato com as marcas do modelo
        await espia(pg)
        await pg.locator('button[data-acao="montaria"][data-id="m3"]').click()
        await pg.waitForSelector('#t-montaria')
        confereDesenhos(await desenhos(pg), [{ chave: 'm3', marcas: esperadas.m3, joquei: null, raridade: garoa.rarity }], 'ficha', (d) => d.quadro)
        await semQuebra(pg, label + '-montaria')
        // sala de largada: o retrato da ativa; a sala gravada não ganha campo de jóquei nem de marcas
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.waitForSelector('#t-estabulo')
        await espia(pg)
        await abrirSala(pg)
        confereDesenhos(await desenhos(pg), [{ chave: 'm1', marcas: esperadas.m1, joquei: null, raridade: 'comum' }], 'sala', (d) => d.quadro)
        await semQuebra(pg, label + '-largada')
        await espia(pg, false)
        const disco = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_REAL)
        if (disco.v !== 5) problems.push(`${label}: a versão do save mudou para ${disco.v}`)
        if (!igual(disco.joquei, { padrao: 'xadrez', capacete: '#62b8ff' })) problems.push(`${label}: o save gravado tem joquei ${JSON.stringify(disco.joquei)}`)
        for (const m of disco.mounts) if (!igual(m.marcas, esperadas[m.uid])) problems.push(`${label}: ${m.uid} gravado com marcas ${JSON.stringify(m.marcas)} (esperado ${mStr(esperadas[m.uid])})`)
        const chaves = Object.keys(disco.pending || {}).sort().join(',')
        if (chaves !== 'alloc,counter,fee,gear,pr,training') problems.push(`${label}: a sala gravada mudou de forma: ${chaves}`)
      } catch (e) {
        problems.push(`${label}: ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 2. gaveta DEV (marcas da montaria) e corrida DEV com 8 Míticos (1280: o canvas maior)
    {
      const label = 'marcas-corrida'
      // 8 corredores numa sala DEV: a seed armada é a da sala; o nº de corredores é o 2º sorteio do rng da sala
      let SEED8_DEV = 0
      for (let sd = 1; sd <= 2000 && !SEED8_DEV; sd++) {
        const rng = S.mulberry32(S.hash2(sd, 0xA11CE))
        rng()
        if (4 + Math.floor(rng() * 5) === 8) SEED8_DEV = sd
      }
      const pg = await newPage(browser, { width: 1280, height: 800 }, label, { query: '?dev=1' })
      const ativa = async () => daAtiva(await estado(pg))
      const seletores = () => pg.evaluate(() => ['cara', 'patas', 'corpo'].map((k) => { const el = document.getElementById('dev-' + k); return el ? el.value : '(sem seletor)' }).join('/'))
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await devAbrir(pg)
        const opc = await pg.evaluate(() => ['cara', 'patas', 'corpo'].map((k) => {
          const el = document.getElementById('dev-' + k)
          return { k, valores: el ? Array.from(el.options).map((o) => o.value) : null, textos: el ? Array.from(el.options).map((o) => o.textContent) : [] }
        }))
        const listas = { cara: G.MARCAS.cara, patas: G.MARCAS.patas.map(String), corpo: G.MARCAS.corpo }
        let temSeletores = true
        for (const o of opc) {
          if (!o.valores) { problems.push(`${label}: a gaveta DEV não tem o seletor de ${o.k}`); temSeletores = false; continue }
          if (!igual(o.valores, listas[o.k])) problems.push(`${label}: seletor de ${o.k} com ${o.valores.join(',')} (esperado ${listas[o.k].join(',')})`)
          const sujos = o.textos.filter((t) => !/^[A-Za-zÀ-ÿ0-9 ]+$/.test(t))
          if (sujos.length) problems.push(`${label}: opções de ${o.k} com símbolos: ${sujos.join(' | ')}`)
        }
        if (temSeletores && (await seletores()) !== mStr(doCatalogo('brasa'))) problems.push(`${label}: a gaveta abriu com as marcas ${await seletores()} (as da Brasa: ${mStr(doCatalogo('brasa'))})`)
        const escolhe = async (rar, m) => {
          await pg.selectOption('#dev-raridade', rar)
          if (temSeletores) for (const k of ['cara', 'patas', 'corpo']) await pg.selectOption('#dev-' + k, String(m[k]))
        }
        // aplicar na ativa (m1), copiar um pronto (m2, as marcas do modelo) e criar (m3)
        await escolhe('mitico', { cara: 'listra', patas: 3, corpo: 'malhado' })
        await pg.locator('[data-acao="dev-aplicar"]').click()
        let a = await ativa()
        if (a.rarity !== 'mitico' || mStr(a.marcas) !== 'listra/3/malhado') problems.push(`${label}: "Aplicar na ativa" deixou ${a.rarity} ${mStr(a.marcas)} (esperado mitico listra/3/malhado)`)
        await pg.selectOption('#dev-copiar', 'w-garoa')
        await pg.locator('[data-acao="dev-copiar"]').click()
        a = await ativa()
        if (a.uid !== 'm2' || mStr(a.marcas) !== 'estrela/0/ruao') problems.push(`${label}: cópia da Garoa ${a.uid} com marcas ${mStr(a.marcas)} (esperado m2 estrela/0/ruao)`)
        if (temSeletores && (await seletores()) !== 'estrela/0/ruao') problems.push(`${label}: a gaveta não carregou as marcas da ativa (${await seletores()})`)
        await escolhe('mitico', { cara: 'frente', patas: 4, corpo: 'pintado' })
        await pg.locator('[data-acao="dev-criar"]').click()
        a = await ativa()
        if (a.uid !== 'm3' || a.rarity !== 'mitico' || mStr(a.marcas) !== 'frente/4/pintado') problems.push(`${label}: "Criar cavalo" deixou ${a.uid} ${a.rarity} ${mStr(a.marcas)} (esperado m3 mitico frente/4/pintado)`)
        await devFechar(pg)
        // as marcas escolhidas ficam no save DEV
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        await pg.waitForFunction(() => window.Sprites && window.Sprites.moldsReady === true, null, { timeout: 8000 })
        let s = await estado(pg)
        const salvas = s.mounts.map((m) => m.uid + ':' + mStr(m.marcas)).join(' ')
        if (salvas !== 'm1:listra/3/malhado m2:estrela/0/ruao m3:frente/4/pintado') problems.push(`${label}: depois de recarregar, marcas ${salvas}`)

        // corrida com 8 Míticos: a ativa (m3) já é; os rivais viram Míticos na sala aberta (só neste teste)
        await devArmar(pg, { seed: SEED8_DEV })
        await abrirSala(pg)
        const sala = await pg.evaluate(() => {
          const L = window.__galope.ui.lobby
          L.racers.forEach((r) => { r.horse.rarity = 'mitico' })
          return { n: L.n, seed: L.seed, racers: L.racers.map((r) => ({ isPlayer: r.isPlayer, chave: r.horse.uid || r.horse.id.replace(/-b\d+$/, ''), id: r.horse.id, element: r.horse.element })) }
        })
        if (sala.n !== 8) problems.push(`${label}: a sala da seed ${SEED8_DEV} tem ${sala.n} corredores (esperado 8)`)
        s = await estado(pg)
        const esperados = sala.racers.map((r, j) => ({
          chave: r.chave, raridade: 'mitico',
          marcas: r.isPlayer ? daAtiva(s).marcas : doCatalogo(r.id.replace(/-b\d+$/, '')),
          joquei: r.isPlayer ? s.joquei : joqueiRival(sala.seed, j)
        }))
        // quadros do galope por estilo (Sprites._quadroGalope), para o tamanho do cache depois da largada
        const nQuadros = await pg.evaluate((els) => els.map((el) => {
          const q = new Set()
          for (let f = 0; f < window.Sprites.GALLOP_FRAMES; f += 1 / 16) q.add(window.Sprites._quadroGalope(el, f))
          return q.size
        }), sala.racers.map((r) => r.element))
        await espia(pg)
        await pg.evaluate(() => {
          const m = window.__mc8 = { inicio: null, max: 0, primeiros: [] }
          const FX = window.RaceFx, fim = FX.endFrame
          FX.endFrame = function (ms) {
            const r = window.__galope.race
            if (r && r._state.phase === 'corrida' && m.primeiros.length < 90) m.primeiros.push(ms)
            return fim.apply(this, arguments)
          }
          const tick = () => {
            if (window.__galope.ui.screen === 'corrida') {
              const c = window.Sprites._cacheMoldes()
              if (m.inicio == null) m.inicio = c
              m.max = Math.max(m.max, c)
            }
            if (window.__galope.ui.screen !== 'resultado') requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        })
        await pg.getByRole('button', { name: /^Largar/ }).click()
        await pg.waitForSelector('#pista')
        const q0 = await (await pg.waitForFunction(() => {
          const r = window.__galope.race
          return r && r._state.phase === 'corrida' ? window.RaceFx._stats.quadros : false
        }, null, { timeout: 60000, polling: 'raf' })).jsonValue()
        // a sala não ganhou o jóquei dos rivais (calculado ao desenhar)
        const comJoquei = await pg.evaluate(() => window.__galope.ui.lobby.racers.filter((r) => 'joquei' in r || 'joquei' in r.horse).length)
        if (comJoquei) problems.push(`${label}: ${comJoquei} corredor(es) da sala com o campo joquei`)
        confereDesenhos(await desenhos(pg), esperados, 'corrida', (d) => !d.quadro, { rastro: true })
        // a semente de um rival vem do id do modelo (o do Haras e do catálogo), não do id da raia ('-b<n>')
        {
          const lista = await desenhos(pg)
          const sementes = new Set(lista.map((d) => d.semente))
          let rivais = 0
          sala.racers.forEach((r) => {
            if (r.isPlayer) return
            rivais++
            const tpl = r.id.replace(/-b\d+$/, '')
            if (tpl === r.id) problems.push(`${label}: o rival ${r.id} não tem o sufixo -b<n>`)
            else if (sementes.has(B.hashChave(r.id))) problems.push(`${label}: o rival ${r.id} foi desenhado com a semente do id da raia, não a do modelo ${tpl}`)
          })
          if (!rivais) problems.push(`${label}: sem rivais para conferir a semente`)
        }
        await espia(pg, false)
        // desenho por quadro com os 8 Míticos (média dos últimos 60 de 120 quadros de corrida)
        const ms = await (await pg.waitForFunction((q) => {
          const st = window.RaceFx._stats
          return st.quadros >= q ? st.msQuadro : false
        }, q0 + 120, { timeout: 60000, polling: 'raf' })).jsonValue()
        const mc = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__mc8)))
        const primeiros = mc.primeiros.length ? { max: +Math.max(...mc.primeiros).toFixed(2), media: +(mc.primeiros.reduce((x, y) => x + y, 0) / mc.primeiros.length).toFixed(2), n: mc.primeiros.length } : null
        const montados = nQuadros.reduce((x, q) => x + 1 + q, 0)   // parado + quadros do galope de cada corredor
        notes.marcas8 = { seed: SEED8_DEV, msQuadro: +ms.toFixed(2), teto: TETO_MS, primeiros90: primeiros, cache: { largada: mc.inicio, max: mc.max, esperado: montados } }
        if (ms > TETO_MS) problems.push(`${label}: ${ms.toFixed(2)} ms por quadro com 8 Míticos (teto ${TETO_MS})`)
        if (!(mc.inicio >= montados)) problems.push(`${label}: na largada o cache dos moldes tinha ${mc.inicio} quadros (esperado ${montados}: cada cavalo montado uma vez na largada)`)
        if (mc.max !== mc.inicio) problems.push(`${label}: o cache dos moldes cresceu durante a corrida (${mc.inicio} -> ${mc.max})`)
        // pódio: os 3 primeiros com marcas, jóquei e raridade
        await espia(pg)
        const top3 = await pg.evaluate(() => window.__galope.ui.lobby.sim.finishOrder.slice(0, 3))
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado')
        await sleep(300)
        confereDesenhos(await desenhos(pg), top3.map((j) => esperados[j]), 'pódio', (d) => d.quadro && d.idle === true)
        await espia(pg, false)
      } catch (e) {
        problems.push(`${label}: ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 3. cruzar no DEV (360): o potro nasce com marcas válidas (as do Breed.foal) e elas ficam no save
    {
      const label = 'marcas-potro'
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        const s0 = await estado(pg)
        const faisca = G.WILD_HORSES.find((h) => h.id === 'w-faisca')
        const potroNode = B.foal({ f: faisca, m: s0.mounts[0], seedBase: s0.seedBase, breedCounter: s0.breedCounter, nextUid: s0.nextUid })
        await pg.locator('[data-acao="aba"][data-id="haras"]').click()
        await pg.waitForSelector('#t-haras')
        await espia(pg)
        await pg.locator('[data-acao="haras-partner"][data-kind="rent"][data-id="w-faisca"]').click()
        await sleep(150)
        confereDesenhos(await desenhos(pg), [{ chave: 'w-faisca', marcas: faisca.marcas, joquei: null, raridade: faisca.rarity }], 'haras', (d) => d.quadro)
        await semQuebra(pg, label + '-haras')
        await espia(pg)
        await pg.locator('[data-acao="cruzar"]').click()
        await pg.waitForSelector('#t-nasceu')
        const uid = 'm' + s0.nextUid
        const potro = (await estado(pg)).mounts.find((m) => m.uid === uid)
        if (!potro || !B.marcasValidas(potro.marcas) || !igual(potro.marcas, potroNode.marcas)) problems.push(`${label}: potro com marcas ${JSON.stringify(potro && potro.marcas)} (no Node: ${mStr(potroNode.marcas)})`)
        confereDesenhos(await desenhos(pg), [{ chave: uid, marcas: potroNode.marcas, joquei: null, raridade: potroNode.rarity }], 'potro', (d) => d.quadro)
        await espia(pg, false)
        await semQuebra(pg, label + '-nasceu')
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        const depois = (await estado(pg)).mounts.find((m) => m.uid === uid)
        const disco = await pg.evaluate(() => JSON.parse(localStorage.getItem('galope-elemental:dev')))
        const noDisco = (disco.mounts || []).find((m) => m.uid === uid)
        if (!depois || !igual(depois.marcas, potroNode.marcas)) problems.push(`${label}: depois de recarregar, o potro ficou com marcas ${JSON.stringify(depois && depois.marcas)} (esperado ${mStr(potroNode.marcas)})`)
        if (!noDisco || !igual(noDisco.marcas, potroNode.marcas)) problems.push(`${label}: o save DEV gravou o potro com marcas ${JSON.stringify(noDisco && noDisco.marcas)}`)
        await semQuebra(pg, label + '-estabulo')
        notes.marcasPotro = { uid, marcas: mStr(potroNode.marcas) }
      } catch (e) {
        problems.push(`${label}: ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 4. telas (Task 5): editor do jóquei no Perfil, linha "Marcas:" na ficha e no Haras (360 e 1280)
    {
      const label = 'marcas-telas'
      const PADROES = { liso: 'Liso', listras: 'Listras', faixa: 'Faixa', xadrez: 'Xadrez', estrelas: 'Estrelas', losangos: 'Losangos' }
      const CORES = { '#f2c230': 'Dourado', '#ff6b5e': 'Vermelho', '#62b8ff': 'Azul', '#86d86a': 'Verde', '#c77dff': 'Roxo', '#ff9f43': 'Laranja', '#f1e9d4': 'Creme', '#2a2a2a': 'Preto' }
      const CARAS = { nenhuma: 'nenhuma', estrela: 'estrela', listra: 'listra', frente: 'frente branca' }
      const CORPOS = { liso: 'liso', malhado: 'malhado', pintado: 'pintado', ruao: 'ruão' }
      const linhaMarcas = (m) => {
        const p = []
        if (m.cara !== 'nenhuma') p.push(CARAS[m.cara])
        if (m.patas > 0) p.push(m.patas === 1 ? '1 meia' : m.patas + ' meias')
        if (m.corpo !== 'liso') p.push(CORPOS[m.corpo])
        return 'Marcas: ' + (p.length ? p.join(', ') : 'nenhuma')
      }
      const norm = (t) => t.replace(/\s+/g, ' ').trim()
      const pressionado = (pg, acao) => pg.evaluate((a) => Array.from(document.querySelectorAll(`[data-acao="${a}"]`)).map((b) => (b.getAttribute('data-v') + '=' + b.getAttribute('aria-pressed'))).join(','), acao)
      for (const vp of [{ width: 360, height: 780 }, { width: 1280, height: 800 }]) {
        const tag = `${label}-${vp.width}`
        const pg = await newPage(browser, vp, tag)
        try {
          await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
          await pg.waitForSelector('#t-estabulo')
          await montaSave(pg, (raw) => {
            raw.mounts[0].marcas = { cara: 'frente', patas: 2, corpo: 'ruao' }
            raw.mounts.push(Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { uid: 'm2', name: 'Egua', sex: 'f', breedLeft: 3, marcas: { cara: 'nenhuma', patas: 0, corpo: 'pintado' } }))
            raw.mounts.push(Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { uid: 'm3', name: 'Lisa', sex: 'f', marcas: { cara: 'nenhuma', patas: 0, corpo: 'liso' } }))
            raw.mounts.push(Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { uid: 'm4', name: 'Meia', sex: 'f', marcas: { cara: 'nenhuma', patas: 1, corpo: 'liso' } }))
            raw.nextUid = 5; raw.stableSlots = 6
          })
          // Perfil: os 6 padrões e os 8 capacetes, nomes em português, o inicial marcado
          await pg.locator('[data-acao="perfil"]').click()
          await pg.waitForSelector('#t-perfil')
          const pads = await pg.evaluate(() => Array.from(document.querySelectorAll('[data-acao="joquei-padrao"]')).map((b) => ({ v: b.getAttribute('data-v'), t: b.textContent.trim(), p: b.getAttribute('aria-pressed') })))
          if (!igual(pads.map((x) => x.v), G.JOQUEI.padroes)) problems.push(`${tag}: botões de padrão ${pads.map((x) => x.v).join(',')} (esperado ${G.JOQUEI.padroes.join(',')})`)
          for (const x of pads) if (x.t !== PADROES[x.v]) problems.push(`${tag}: padrão ${x.v} com o texto "${x.t}" (esperado ${PADROES[x.v]})`)
          const caps = await pg.evaluate(() => Array.from(document.querySelectorAll('[data-acao="joquei-capacete"]')).map((b) => {
            const r = b.getBoundingClientRect()
            return { v: b.getAttribute('data-v'), n: b.getAttribute('aria-label'), p: b.getAttribute('aria-pressed'), w: r.width, h: r.height }
          }))
          if (!igual(caps.map((x) => x.v), G.JOQUEI.capacetes)) problems.push(`${tag}: botões de capacete ${caps.map((x) => x.v).join(',')}`)
          for (const x of caps) {
            if (x.n !== CORES[x.v]) problems.push(`${tag}: capacete ${x.v} com aria-label "${x.n}" (esperado ${CORES[x.v]})`)
            if (x.w < 32 || x.h < 32) problems.push(`${tag}: capacete ${x.v} com alvo de toque ${x.w}x${x.h} (mínimo 32)`)
          }
          if ((await pressionado(pg, 'joquei-padrao')) !== 'liso=true,listras=false,faixa=false,xadrez=false,estrelas=false,losangos=false') problems.push(`${tag}: padrão inicial ${await pressionado(pg, 'joquei-padrao')}`)
          if (!(await pg.locator('[data-acao="joquei-capacete"][data-v="#f2c230"]').getAttribute('aria-pressed') === 'true')) problems.push(`${tag}: capacete inicial sem aria-pressed`)
          if ((await pg.locator('[aria-labelledby="r-joquei"], #r-joquei').count()) < 1) problems.push(`${tag}: sem a seção "Seu jóquei"`)
          if (!/Seu jóquei/.test(await pg.locator('#tela').textContent())) problems.push(`${tag}: texto "Seu jóquei" ausente`)
          // a prévia: a ativa (m1) parada e montada, com o jóquei escolhido
          await espia(pg)
          await pg.locator('[data-acao="joquei-padrao"][data-v="xadrez"]').click()
          await pg.locator('[data-acao="joquei-capacete"][data-v="#62b8ff"]').click()
          await sleep(200)
          if ((await pressionado(pg, 'joquei-padrao')).indexOf('xadrez=true') < 0 || (await pressionado(pg, 'joquei-padrao')).indexOf('liso=false') < 0) problems.push(`${tag}: Xadrez não ficou marcado: ${await pressionado(pg, 'joquei-padrao')}`)
          if ((await pg.locator('[data-acao="joquei-capacete"][aria-pressed="true"]').getAttribute('data-v')) !== '#62b8ff') problems.push(`${tag}: Azul não ficou marcado`)
          // foco do teclado no capacete selecionado: o anel de foco (--foco) aparece mesmo com o contorno dourado de selecionado
          await pg.keyboard.press('Shift+Tab'); await pg.keyboard.press('Tab')
          const foco = await pg.evaluate(() => {
            const a = document.activeElement
            const sonda = document.createElement('i'); sonda.style.color = 'var(--foco)'; document.body.appendChild(sonda)
            const cor = getComputedStyle(sonda).color; sonda.remove()
            const cs = a && getComputedStyle(a)
            return { v: a && a.getAttribute('data-v'), p: a && a.getAttribute('aria-pressed'), oc: cs && cs.outlineColor, ow: cs && cs.outlineWidth, cor }
          })
          if (foco.v !== '#62b8ff' || foco.p !== 'true') problems.push(`${tag}: foco do teclado não voltou ao capacete selecionado (${JSON.stringify(foco)})`)
          else if (foco.oc !== foco.cor || parseFloat(foco.ow) < 2) problems.push(`${tag}: capacete selecionado e focado sem o anel --foco (${JSON.stringify(foco)})`)
          const lista = await desenhos(pg)
          const prev = lista.filter((d) => d.quadro && d.jockey === true && d.joquei && d.joquei.padrao === 'xadrez' && d.joquei.capacete === '#62b8ff')
          if (!prev.length) problems.push(`${tag}: a prévia não foi redesenhada com o jóquei xadrez/azul (${lista.length} desenhos)`)
          else {
            const u = prev[prev.length - 1]
            if (u.idle !== true) problems.push(`${tag}: a prévia não está parada (idle ${u.idle})`)
            if (u.semente !== B.hashChave('m1') || !igual(u.marcas, { cara: 'frente', patas: 2, corpo: 'ruao' })) problems.push(`${tag}: a prévia não é o cavalo ativo (m1): semente ${u.semente}, marcas ${mStr(u.marcas)}`)
          }
          await espia(pg, false)
          await semQuebra(pg, tag + '-perfil')
          let s = await estado(pg)
          if (!igual(s.joquei, { padrao: 'xadrez', capacete: '#62b8ff' })) problems.push(`${tag}: state.joquei ${JSON.stringify(s.joquei)}`)
          if (vp.width === 360) await pg.screenshot({ path: join(SHOTS, 'marcas-perfil-celular.png'), fullPage: true })
          else await pg.screenshot({ path: join(SHOTS, 'marcas-perfil-desktop.png') })
          // recarregar mantém
          await pg.reload({ waitUntil: 'domcontentloaded' })
          await pg.waitForSelector('#t-estabulo')
          await pg.locator('[data-acao="perfil"]').click()
          await pg.waitForSelector('#t-perfil')
          if ((await pressionado(pg, 'joquei-padrao')).indexOf('xadrez=true') < 0 || (await pg.locator('[data-acao="joquei-capacete"][aria-pressed="true"]').getAttribute('data-v')) !== '#62b8ff') problems.push(`${tag}: depois de recarregar o jóquei não ficou`)
          // gravação que falha: nada muda (nem o state, nem o aria-pressed) e o aviso aparece
          await pg.evaluate(() => { Storage.prototype.__setOrig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('cheio') } })
          await pg.locator('[data-acao="joquei-padrao"][data-v="listras"]').click()
          await pg.locator('[data-acao="joquei-capacete"][data-v="#c77dff"]').click()
          s = await estado(pg)
          if (!igual(s.joquei, { padrao: 'xadrez', capacete: '#62b8ff' })) problems.push(`${tag}: gravação falhou e o state mudou: ${JSON.stringify(s.joquei)}`)
          if ((await pressionado(pg, 'joquei-padrao')).indexOf('xadrez=true') < 0) problems.push(`${tag}: gravação falhou e a tela mudou o padrão`)
          if (!/Não foi possível salvar/.test(await pg.locator('#tela').textContent())) problems.push(`${tag}: gravação falhou sem aviso`)
          await pg.evaluate(() => { Storage.prototype.setItem = Storage.prototype.__setOrig })
          // ficha da Montaria: a linha "Marcas:" junto do sexo, batendo com o save
          await pg.locator('[data-acao="perfil-voltar"]').click()
          await pg.waitForSelector('#t-estabulo')
          for (const uid of ['m1', 'm2', 'm3', 'm4']) {
            await pg.locator(`button[data-acao="montaria"][data-id="${uid}"]`).click()
            await pg.waitForSelector('#t-montaria')
            const m = (await estado(pg)).mounts.find((x) => x.uid === uid)
            const txt = await pg.evaluate(() => Array.from(document.querySelectorAll('.montaria-cabeca .linha-meta span')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).find((t) => /^Marcas:/.test(t)) || null)
            if (txt !== linhaMarcas(m.marcas)) problems.push(`${tag}: ficha de ${uid}: "${txt}" (esperado "${linhaMarcas(m.marcas)}")`)
            if (uid === 'm3' && txt !== 'Marcas: nenhuma') problems.push(`${tag}: ficha sem marcas com "${txt}"`)
            if (uid === 'm4' && txt !== 'Marcas: 1 meia') problems.push(`${tag}: ficha só com 1 meia com "${txt}"`)
            if (uid === 'm1' && txt !== 'Marcas: frente branca, 2 meias, ruão') problems.push(`${tag}: ficha de m1 com "${txt}"`)
            await semQuebra(pg, `${tag}-ficha-${uid}`)
            await pg.locator('[data-acao="montaria-voltar"]').click()
            await pg.waitForSelector('#t-estabulo')
          }
          // Haras: as linhas dos dois pais escolhidos
          await pg.locator('[data-acao="aba"][data-id="haras"]').click()
          await pg.waitForSelector('#t-haras')
          await pg.locator('[data-acao="haras-mine"][data-id="m1"]').click()
          await pg.locator('[data-acao="haras-partner"][data-kind="rent"]').first().click()
          await pg.waitForSelector('.calc')
          const par = await pg.evaluate(() => ({
            linhas: Array.from(document.querySelectorAll('.calc .marcas-linha')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
            parceiro: window.__galope.ui.haras.partner && window.__galope.ui.haras.partner.id
          }))
          const rent = G.WILD_HORSES.find((h) => h.id === par.parceiro)
          if (par.linhas.length !== 2) problems.push(`${tag}: Haras com ${par.linhas.length} linhas de marcas (esperado 2)`)
          else {
            const esp = [linhaMarcas({ cara: 'frente', patas: 2, corpo: 'ruao' }), rent ? linhaMarcas(rent.marcas) : '?']
            for (const e of esp) if (!par.linhas.some((l) => l.indexOf(e) >= 0)) problems.push(`${tag}: Haras sem a linha "${e}" (${par.linhas.join(' | ')})`)
          }
          await semQuebra(pg, tag + '-haras')
        } catch (e) {
          problems.push(`${tag}: ` + e.message)
        } finally {
          await pg.context().close()
        }
      }
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
  // renomear num campo da própria tela (window.prompt não abre no iframe do artefato): Enter confirma, Esc cancela
  page.on('dialog', (d) => { problems.push('renomear: diálogo do navegador aberto: ' + d.message()); d.dismiss().catch(() => {}) })
  await page.locator('[data-acao="renomear"][data-id="m1"]').click()
  await page.fill('#renomear-campo', '<b>x</b>')
  await page.press('#renomear-campo', 'Enter')
  if (await page.locator('#renomear-campo').count()) problems.push('renomear: o campo continuou aberto depois do Enter')
  const ren = await page.evaluate(() => ({
    name: window.__galope.state.mounts[0].name,
    html: document.querySelector('#t-montaria').innerHTML,
    text: document.querySelector('#t-montaria').textContent
  }))
  if (ren.name !== '<b>x</b>') problems.push('renomear: nome salvo ' + JSON.stringify(ren.name))
  if (!ren.html.includes('&lt;b&gt;') || ren.html.includes('<b>')) problems.push('renomear: nome sem escapar: ' + ren.html)
  if (!ren.text.includes('#1')) problems.push('tela da montaria sem o #1: ' + ren.text)
  await page.locator('[data-acao="renomear"][data-id="m1"]').click()
  await page.fill('#renomear-campo', 'Outro Nome')
  await page.press('#renomear-campo', 'Escape')
  if ((await page.evaluate(() => window.__galope.state.mounts[0].name)) !== '<b>x</b>' || (await page.locator('#renomear-campo').count())) problems.push('renomear: Esc não cancelou')
  await page.locator('[data-acao="renomear"][data-id="m1"]').click()
  await page.fill('#renomear-campo', 'x')
  await page.locator('[data-acao="renomear-ok"]').click()
  if ((await page.evaluate(() => window.__galope.state.mounts[0].name)) !== '<b>x</b>' || !(await page.locator('#renomear-campo').count())) problems.push('renomear: aceitou nome de 1 letra ou fechou o campo')
  await page.fill('#renomear-campo', '  Brasa  ')
  await page.locator('[data-acao="renomear-ok"]').click()
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
  // bots recebem equipamento pela liga do alvo: com o jogador em Bronze (o inicial v3 ainda é Bronze aqui) e o
  // alvo sem chance de chegar a Prata, nenhum bot tem peça; senão, algum tem
  const botGear = await page.evaluate(() => {
    const L = window.__galope.ui.lobby
    return { pr: window.__galope.state.pending.pr, bots: L.racers.filter((r) => !r.isPlayer).map((r) => ({ rating: r.rating, pieces: r.gear ? r.gear.pieces.length : -1, set: r.gear && r.gear.set ? r.gear.set.id + '×' + r.gear.set.count : null })) }
  })
  botGear.bots.forEach((b) => { b.league = S.leagueFor(b.rating).id })
  notes.botGear = botGear
  const alvoMax = S.leagueFor(botGear.pr * 1.115).id
  if (alvoMax === 'bronze' ? botGear.bots.some((b) => b.pieces !== 0) : !botGear.bots.some((b) => b.pieces > 0)) problems.push('sala: equipamento dos bots fora da liga do alvo (' + alvoMax + ') ' + JSON.stringify(botGear))
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
  // a narração só mostra as 6 últimas linhas: um observador registra se o Dado apareceu em algum momento
  // (a linha do Dado leva o ícone ui-dado no lugar do 🎲; sem o arquivo, o emoji)
  await page.evaluate(() => {
    window.__sawDice = false
    const tela = document.getElementById('tela')
    const obs = new MutationObserver(() => {
      if (window.__sawDice) return
      for (const li of document.querySelectorAll('#feed li.tipo-dado')) if (li.querySelector('img.icone--ui-dado[alt=""]') || li.textContent.includes('🎲')) { window.__sawDice = true; obs.disconnect(); return }
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
      ok: s.mounts.length === 1 && s.mounts[0].templateId === 'mare' && JSON.stringify(s.mounts[0].skills) === '[]' && s.activeId === 'm1' && s.gold === 777 && s.level === undefined &&
        s.v === 5 && !('base' in s.mounts[0]) && s.items.length === 1 && s.items[0].id === 'sela-comum' && s.mounts[0].equip.sela === null && s.pedras === 0 &&
        s.inventory === undefined && s.equipped === undefined,
      tactic: s.tactic, save: JSON.stringify(s)
    }
  })
  if (!mig.ok || mig.tactic !== undefined) problems.push('save antigo não migrou: ' + mig.save)
  await oldCtx.close()

  // save v2 (um inicial com nível, XP e skills na raiz) vira v5 com mounts[0] (a Labareda, agora skill de tipo, sai da lista)
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
      ok: m.templateId === 'brasa' && m.level === 7 && m.xp === 40 && JSON.stringify(m.skills) === '["sprint"]' && !('base' in m) &&
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
    const ok = s.v === 5 && s.items.length === 9 && s.pedras === 3 && arm && s.mounts[0].equip.armadura === arm.uid &&
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
    if (!/Mítico 0% \(Mítico não nasce de cruzamento\)/.test(calcTxt) || /despertar/.test(calcTxt)) problems.push('cruzamento: calculadora com o texto antigo do Mítico: ' + calcTxt)
    await cz.locator('[data-acao="cruzar"]').click()
    const c1 = await cz.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    if (c1.gold !== 4875) problems.push('cruzamento: ouro ' + c1.gold + ' (esperado 4875)')
    if (c1.mounts.length !== 2) problems.push('cruzamento: ' + c1.mounts.length + ' montarias (esperado 2)')
    if (c1.breedCounter !== 1) problems.push('cruzamento: breedCounter ' + c1.breedCounter)
    if (c1.mounts[0].breedLeft !== 1) problems.push('cruzamento: breedLeft de Brasa ' + c1.mounts[0].breedLeft)
    // o potro entra no estábulo com o equipamento vazio (Breed.foal não sabe de equipamento)
    const esperadoJogo = Object.assign({}, esperado, { equip: GR.emptyEquip(), alloc: { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 } })
    if (c1.mounts.length > 1 && JSON.stringify(c1.mounts[1]) !== JSON.stringify(esperadoJogo)) {
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
      await mn.locator('[data-acao="renomear"][data-id="m1"]').click()   // campo na própria tela, como no teste principal
      await mn.fill('#renomear-campo', 'Trovão')
      await mn.locator('[data-acao="renomear-ok"]').click()
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
      // 3. cavalo Mítico de Água nível 30 com 2 skills (uma de outro elemento: o perfil DEV aceita)
      await dv.fill('#dev-nome', 'Teste DEV')
      await dv.selectOption('#dev-elemento', 'agua')
      await dv.selectOption('#dev-raridade', 'mitico')
      await dv.fill('#dev-nivel', '30')
      // a gaveta abre com a ativa (Brasa, genética que não é toda 31): "por status"; o cavalo novo pede o Máximo
      if ((await dv.locator('#dev-potencial').inputValue()) !== 'cada') problems.push('dev: a gaveta abriu a genética da Brasa como "Máximo"')
      await dv.selectOption('#dev-potencial', 'max')
      const skillsDev = ['pe-na-chuva', 'chama-final', '', '', '']
      for (let k = 0; k < 5; k++) await dv.selectOption('#dev-skill' + k, skillsDev[k])
      await dv.locator('[data-acao="dev-criar"]').click()
      s = await st()
      const novo = s.mounts.find((m) => m.uid === s.activeId)
      if (s.mounts.length !== 2 || !novo || novo.uid !== 'm2' || novo.templateId !== 'dev-2' || novo.name !== 'Teste DEV' || novo.element !== 'agua' || novo.rarity !== 'mitico' || novo.level !== 30 || JSON.stringify(novo.skills) !== '["pe-na-chuva","chama-final"]') {
        problems.push('dev: cavalo criado ' + JSON.stringify(novo))
      }
      // 3b. genética por status, estrelas e pontos ("Aplicar na ativa"), "Devolver pontos" e de volta ao Máximo ★★
      await dv.selectOption('#dev-potencial', 'cada')
      await dv.fill('#dev-gen-vel', '7'); await dv.fill('#dev-gen-acel', '40'); await dv.fill('#dev-gen-man', '-3')
      await dv.selectOption('#dev-estrelas', '3')
      await dv.fill('#dev-pt-vel', '10'); await dv.fill('#dev-pt-acel', '999'); await dv.fill('#dev-pt-man', '-4')
      await dv.locator('[data-acao="dev-aplicar"]').click()
      let ap = (await st()).mounts.find((m) => m.uid === 'm2')
      // nível 30 ★★★: 43 pontos livres, até 15 num status
      if (ap.grau !== 3 || ap.potential.vel !== 7 || ap.potential.acel !== 31 || ap.potential.man !== 0 || ap.potential.forca !== 31 ||
        JSON.stringify(ap.alloc) !== JSON.stringify({ vel: 10, acel: 15, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 }) || 'base' in ap) problems.push('dev: aplicar genética/estrelas/pontos ' + JSON.stringify(ap))
      await dv.locator('[data-acao="dev-devolver"]').click()
      ap = (await st()).mounts.find((m) => m.uid === 'm2')
      if (G.STAT_KEYS.some((k) => ap.alloc[k] !== 0) || ap.grau !== 3) problems.push('dev: devolver pontos ' + JSON.stringify(ap.alloc))
      if ((await dv.locator('#dev-pt-acel').inputValue()) !== '0') problems.push('dev: os campos de pontos não voltaram a 0 depois de devolver')
      // a genética da ativa não é toda 31: os campos ficam em "por status" e trocar só as estrelas não a apaga
      if ((await dv.locator('#dev-potencial').inputValue()) !== 'cada') problems.push('dev: depois de devolver, a genética da ativa voltou para "Máximo" ' + (await dv.locator('#dev-potencial').inputValue()))
      await dv.selectOption('#dev-estrelas', '1')
      await dv.locator('[data-acao="dev-aplicar"]').click()
      ap = (await st()).mounts.find((m) => m.uid === 'm2')
      if (ap.grau !== 1 || ap.potential.vel !== 7 || ap.potential.man !== 0 || ap.potential.acel !== 31) problems.push('dev: trocar só as estrelas apagou a genética ' + JSON.stringify({ grau: ap.grau, potential: ap.potential }))
      await dv.locator('[data-acao="dev-carregar"]').click()
      if ((await dv.locator('#dev-potencial').inputValue()) !== 'cada' || (await dv.locator('#dev-gen-vel').inputValue()) !== '7') problems.push('dev: "Carregar a ativa" não manteve a genética por status')
      await dv.selectOption('#dev-potencial', 'max')
      await dv.selectOption('#dev-estrelas', '2')
      await dv.locator('[data-acao="dev-aplicar"]').click()
      ap = (await st()).mounts.find((m) => m.uid === 'm2')
      if (ap.grau !== 2 || G.STAT_KEYS.some((k) => ap.potential[k] !== 31) || JSON.stringify(ap.skills) !== '["pe-na-chuva","chama-final"]' || ap.level !== 30) problems.push('dev: voltar ao Máximo ★★ ' + JSON.stringify(ap))
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
          chamaFinal: L.sim.events.some((e) => e.type === 'skill' && e.racer === L.playerIdx && /Chama Final/.test(e.text)) }
      })
      if (corrida.weather !== 'nevoa' || !/Névoa/.test(corrida.clima)) problems.push('dev: clima da corrida ' + JSON.stringify(corrida))
      if (!corrida.chamaFinal) problems.push('dev: com "skills sempre ativam" a Chama Final (de outro elemento) não ativou')
      if (corrida.devNext !== null) problems.push('dev: devNext não foi limpo depois da corrida')
      await dv.getByRole('button', { name: /Pular/ }).click()
      await dv.waitForSelector('#t-resultado')
      // 6. depois de pagar a entrada, o Ouro volta a 999 999 (acima disso só se o prêmio passar da entrada)
      const pago = await dv.evaluate(() => ({ gold: window.__galope.state.gold, fee: window.__galope.ui.result.fee, prize: window.__galope.ui.result.prize }))
      if (pago.fee <= 0 || pago.gold !== Math.max(999999, 999999 - pago.fee + pago.prize)) problems.push('dev: Ouro depois da corrida ' + JSON.stringify(pago))
      if ((await dv.locator('.dev-botao--armado').count()) !== 0) problems.push('dev: botão DEV continua armado depois da corrida')
      notes.dev = pago
      await conferirReal('depois da corrida')
      // 7. o save DEV gravado abre de novo com o cavalo DEV (template dev-2, skill de outro elemento)
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
      if (!m2 || m2.level !== 30 || m2.templateId !== 'dev-2' || JSON.stringify(m2.skills) !== '["pe-na-chuva","chama-final"]' || s.activeId !== 'm2') problems.push('dev: cavalo DEV ao abrir o save de novo ' + JSON.stringify(m2))
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
      if ((await dv.locator('.dev-gaveta').count()) !== 0) problems.push('dev: a gaveta continuou aberta depois de "Zerar perfil" (cobre a barra de abas)')
      if (!/Perfil de teste zerado/.test((await dv.locator('#tela .aviso').allTextContents()).join(' '))) problems.push('dev: sem o aviso de perfil zerado no estábulo')
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

    // 1. Save sem settings (como os saves de antes da opção): carrega com "Seguir o sistema" sem perder
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
        if (velho.v !== 5 || 'settings' in velho) problems.push('save-antigo: o save montado não é um v5 sem settings ' + JSON.stringify({ v: velho.v }))
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
        if (s.v !== 5 || s.gold !== 4321 || s.races !== 9 || s.wins !== 2 || s.mounts.length !== velho.mounts.length || s.items.length !== velho.items.length || s.mounts[0].templateId !== 'brasa') {
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
        await devArmar(pg, { clima: 'sol', vento: 'calmo', tracado: 'curvas', distancia: 1600, seed: 4247 })
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
      // ícones novos (spec 2026-11-12-icones): sem o mapa, as telas abrem com a reserva de hoje (★/☆, ♂ Macho, 👤,
      // o status em SVG, o selo do elemento na skill, o texto dos chips e do "Clima: X", 🎲), sem nenhum img.icone
      const semImg = async (tela) => {
        const n = await sem.evaluate(() => ({ icones: document.querySelectorAll('img.icone').length, quebradas: Array.prototype.filter.call(document.images, (i) => i.complete && i.naturalWidth === 0).length }))
        if (n.icones || n.quebradas) problems.push(`sem-icones: ${tela} com ${n.icones} img.icone e ${n.quebradas} imagem(ns) quebrada(s)`)
      }
      const estTxt = (await sem.locator('.montarias').textContent()) || ''
      if (!/★★☆/.test(estTxt) || !/♂ Macho/.test(estTxt)) problems.push('sem-icones: estábulo sem a reserva das estrelas e do sexo: ' + estTxt.replace(/\s+/g, ' ').slice(0, 200))
      if ((await sem.locator('.montaria .estrelas').first().getAttribute('aria-label')) !== '2 de 3 estrelas') problems.push('sem-icones: estrelas sem o aria-label')
      if (((await sem.locator('.app-perfil').textContent()) || '').trim() !== '👤') problems.push('sem-icones: botão do Perfil sem o emoji')
      await sem.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await sem.waitForSelector('#t-montaria')
      if ((await sem.locator('.build-nome svg.icone-status').count()) !== 7) problems.push('sem-icones: aba Status sem os 7 status em SVG')
      await semImg('Montaria (Status)')
      await sem.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
      await sem.waitForSelector('.vaga-tipo')
      if ((await sem.locator('.vaga-tipo b canvas[data-icon]').count()) !== 1) problems.push('sem-icones: skill de tipo sem o selo do elemento de reserva')
      await semImg('Montaria (Skills)')
      await sem.locator('[data-acao="montaria-voltar"]').click()
      await abrirSala(sem)
      const chips = ((await sem.locator('[aria-label="Condições da pista"] .chips').textContent()) || '')
      if (!/Piso\s*(Grama|Terra|Areia)/.test(chips) || !/Clima inicial\s*(Sol|Chuva|Névoa|Nublado)/.test(chips)) problems.push('sem-icones: chips da sala sem o texto: ' + chips)
      await semImg('sala')
      await sem.getByRole('button', { name: /^Largar/ }).click()
      await sem.waitForSelector('#pista')
      if (!/^Clima: (Sol|Chuva|Névoa|Nublado)$/.test((await sem.locator('#clima-atual').textContent()) || '')) problems.push('sem-icones: painel da corrida sem "Clima: X"')
      await semImg('corrida')
      await sem.getByRole('button', { name: /Pular/ }).click()
      await sem.waitForSelector('#t-resultado')
      if (!/🎲 Dado da Sorte/.test((await sem.locator('#tela').textContent()) || '')) problems.push('sem-icones: resultado sem a nota do Dado com o emoji')
      await semImg('resultado')
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
