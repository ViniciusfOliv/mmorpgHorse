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
//   UI_SO=reserva,gravacao,adulterado,corrompido,areasegura,texto,producao,redimensiona,escala,teto,corrida,resultado,marcas,portes,crescimento,ajuda,acabamento,celular node tools/ui-test.mjs  -> só esses
// Equipamento suspenso (bloco 1b, GEAR_ON = false no game.js): os blocos das telas de peças e da Loja conferem que elas
// não aparecem e que as ações de peça não fazem nada; com GEAR_ON = true voltam a testar as telas (GEAR_ON abaixo).
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { PECAS as PECAS_ARTE } from './interface-arte.mjs'

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
// versão do save e equipamento (spec 1b §8, §10), lidos do jogo gerado: o teste segue o que o build tem
const PREVIEW_JS = await readFile(join(DIST, 'preview.html'), 'utf8')
const SAVE_V = Number((PREVIEW_JS.match(/var SAVE_VERSION = (\d+);/) || [])[1])
const GEAR_ON = (PREVIEW_JS.match(/var GEAR_ON = (true|false);/) || [])[1] === 'true'
if (!(SAVE_V >= 6)) throw new Error('ui-test: não achei SAVE_VERSION (>= 6) no dist/preview.html')
// SHOTS_T6: pasta (fora do repositório) para as capturas de conferência das telas da build; sem ela, não captura
const SHOTS_T6 = process.env.SHOTS_T6 || null
const capT6 = (pg, nome, full = false) => (SHOTS_T6 ? pg.screenshot({ path: join(SHOTS_T6, nome), fullPage: full }).catch(() => {}) : null)
await mkdir(SHOTS, { recursive: true })

const problems = []
const notes = {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// extra.pagina: arquivo de dist/ (padrão preview.html); extra.query: sufixo da URL; extra.init: função para
// page.addInitScript (roda antes dos scripts da página);
// extra.bloquear: padrões de URL abortados (ctx.route) antes do goto;
// extra.moldes (padrão true): espera os moldes do PixelLab carregarem (Sprites.moldsReady === true) — o jogo
// re-renderiza a tela quando eles chegam, e esperar evita clicar num botão que está sendo trocado.
async function newPage(browser, viewport, label, extra = {}) {
  const { pagina = 'preview.html', query = '', init = null, moldes = true, bloquear = [], ...ctxExtra } = extra
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ...ctxExtra })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${label}] console: ${m.text()}`) })
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`))
  for (const padrao of bloquear) await ctx.route(padrao, (r) => r.abort())   // sem rede para esses endereços
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
// botão indisponível pela regra da 3b: aria-disabled="true" e NÃO disabled (o toque e o teclado ainda o alcançam e mostram o motivo)
const indisp = (loc) => loc.evaluate((b) => b.getAttribute('aria-disabled') === 'true' && !b.hasAttribute('disabled'))
// a barra presa dos pontos (aba Status, 3b §6) deixa o toque passar por ~400 ms depois de aparecer (.barra-acao--chegando):
// antes de um toque forçado ou do mouse nela, espera esse tempo acabar
// (e, depois do 1º toque no Confirmar, os botões dela também não pegam toque por ~400 ms: .barra-acao--armando)
const esperaBarra = (pg) => pg.waitForFunction(() => !document.querySelector('.barra-acao--chegando, .barra-acao--armando'), null, { timeout: 3000 }).catch(() => problems.push('a barra presa dos pontos não saiu do estado "chegando"/"armando"'))
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
      //    (com o equipamento suspenso não há Loja: o gasto que sobra com a sala aberta é a vaga do estábulo, no passo 3)
      let s
      if (GEAR_ON) {
        await rv.locator('[data-acao="aba"][data-id="loja"]').click()
        await rv.waitForSelector('#t-loja')
        await rv.locator('[data-acao="loja-tab"][data-id="pedras"]').click()
        if (!/250 de Ouro reservados para a entrada do páreo aberto/.test((await rv.locator('#tela').textContent()) || '')) problems.push('reserva: a Loja não avisa o Ouro reservado')
        await rv.locator('[data-acao="comprar-pedra"][data-id="5"]').click()   // 200 -> 300
        await rv.locator('[data-acao="comprar-pedra"][data-id="1"]').click()   // 40 -> 260
        s = await st()
        if (s.gold !== 260 || s.pedras !== 6) problems.push('reserva: compras dentro do livre ' + JSON.stringify({ gold: s.gold, pedras: s.pedras }))
        if (!(await rv.locator('[data-acao="comprar-pedra"][data-id="1"]').isDisabled())) problems.push('reserva: comprar pedra habilitado com o Ouro livre abaixo do preço')
        // clique forçado: o handler também recusa
        for (let k = 0; k < 2; k++) await rv.evaluate(() => { const b = document.querySelector('[data-acao="comprar-pedra"][data-id="1"]'); b.disabled = false; b.click() })
        await rv.locator('[data-acao="loja-tab"][data-id="sela"]').click()
        await rv.evaluate(() => { const b = document.querySelector('[data-acao="comprar"][data-id="sela-comum"]'); b.disabled = false; b.click() })
        s = await st()
        if (s.gold < 250) problems.push('reserva: gasto passou da entrada reservada (Ouro ' + s.gold + ')')
      }
      // 3. vaga do estábulo (300) com 260: recusada mesmo forçando o clique
      await rv.evaluate(() => { window.__galope.state.gold = 500 })
      await rv.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await rv.waitForSelector('#t-estabulo')
      if (!(await indisp(rv.locator('[data-acao="expandir"]')))) problems.push('reserva: expandir o estábulo habilitado com só 250 livres')
      await rv.evaluate(() => { const b = document.querySelector('[data-acao="expandir"]'); b.disabled = false; b.removeAttribute('aria-disabled'); b.click() })
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
      // 3. vender e desfazer venda (só com o equipamento ligado: suspenso, nada é vendido; o bloco crescimento confere)
      if (GEAR_ON) {
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
        await g2.locator('[data-acao="montaria-voltar"]').click()
      } else {
        await g2.locator('[data-acao="aba"][data-id="estabulo"]').click()
      }
      // 4. vaga do estábulo
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
      // tira e vende a sela inicial (+25 de Ouro): 55, acima da menor entrada. Com o equipamento suspenso nada é
      // vendido: o Ouro sobe direto no state (como uma outra fonte de Ouro)
      if (GEAR_ON) {
        const s0 = await st()
        const sela = s0.mounts[0].equip.sela
        await tr.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await tr.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await tr.waitForSelector('#t-montaria')
        await tr.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
        await tr.locator('[data-acao="equip-slot"][data-id="sela"]').click()
        await tr.locator('[data-acao="tirar"][data-id="sela"]').click()
        await tr.locator(`[data-acao="vender"][data-id="${sela}"]`).click()
      } else {
        await tr.evaluate(() => { window.__galope.state.gold = 55 })
      }
      const g = (await st()).gold
      if (g < 50) problems.push('treino: Ouro depois da venda ' + g + ' (o teste precisa passar de 50)')
      if (GEAR_ON) await tr.locator('[data-acao="montaria-voltar"]').click()
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
      await av.evaluate(() => { const b = document.querySelector('[data-acao="expandir"]'); b.disabled = false; b.removeAttribute('aria-disabled'); b.click() })
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
      // 1. melhoria de peça: pedras, +N e contador intactos (só com o equipamento ligado; a Redistribuição que falha
      //    está no bloco crescimento)
      let s
      if (GEAR_ON) {
        await gv.evaluate(() => { window.__galope.state.pedras = 10 })
        const s0 = await st()
        const slot = Object.keys(s0.mounts[0].equip).find((k) => s0.mounts[0].equip[k])
        const uid = s0.mounts[0].equip[slot]
        await gv.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await gv.waitForSelector('#t-montaria')
        await gv.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
        await gv.locator(`[data-acao="equip-slot"][data-id="${slot}"]`).click()
        await gv.locator(`[data-acao="melhorar"][data-id="${uid}"]`).click()
        await quebrar()
        await gv.locator(`[data-acao="melhorar-sim"][data-id="${uid}"]`).click()
        s = await st()
        const it0 = s0.items.find((x) => x.uid === uid), it1 = s.items.find((x) => x.uid === uid)
        if (s.pedras !== 10 || s.enhanceCounter !== s0.enhanceCounter || it1.plus !== it0.plus) problems.push('gravacao: melhoria sem gravar mudou o save ' + JSON.stringify({ pedras: s.pedras, cont: s.enhanceCounter, plus: it1.plus }))
        if (!(await temAviso())) problems.push('gravacao: melhoria sem gravar não avisou')
        if (/Sucesso!|Falhou/.test((await gv.locator('#tela').textContent()) || '')) problems.push('gravacao: melhoria sem gravar mostrou o resultado')
        await consertar()
        await gv.locator('[data-acao="montaria-voltar"]').click()
        await gv.waitForSelector('#t-estabulo')
      }
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
      // 4. compra na Loja sem gravar (só com o equipamento ligado: suspenso, não há Loja)
      await gv.getByRole('button', { name: /^Voltar/ }).click()
      if (GEAR_ON) {
        await gv.locator('[data-acao="aba"][data-id="loja"]').click()
        await gv.waitForSelector('#t-loja')
        await gv.locator('[data-acao="loja-tab"][data-id="pedras"]').click()
        const s1 = await st()
        await gv.locator('[data-acao="comprar-pedra"][data-id="1"]').click()
        s = await st()
        if (s.gold !== s1.gold || s.pedras !== s1.pedras) problems.push('gravacao: compra sem gravar ' + JSON.stringify({ gold: s.gold, pedras: s.pedras }))
        if (!(await temAviso())) problems.push('gravacao: compra sem gravar não avisou')
      }
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
      await ad.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await ad.waitForSelector('#t-montaria')
      if (GEAR_ON) {
        // a trava continua: com o Poder da sala real, a Lendária não pode ser equipada
        await ad.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
        await ad.locator('[data-acao="equip-slot"][data-id="armadura"]').click()
        if (!(await ad.locator('[data-acao="equipar"][data-id="i99"]').isDisabled())) problems.push('adulterado: a peça Lendária pode ser equipada com o páreo aberto')
      } else {
        // equipamento suspenso: sem a sub-aba Equipamento, e o "equipar" forçado (botão criado no DOM) não equipa a
        // Lendária; mesmo equipada ela não subiria o Poder (a corrida e o Poder ignoram as peças)
        if (await ad.locator('[data-acao="montaria-aba"][data-id="equip"]').count()) problems.push('adulterado: a sub-aba Equipamento continua com o equipamento suspenso')
        await ad.evaluate(() => { const b = document.createElement('button'); b.setAttribute('data-acao', 'equipar'); b.setAttribute('data-id', 'i99'); document.getElementById('tela').appendChild(b); b.click(); b.remove() })
        if ((await st()).mounts[0].equip.armadura === 'i99') problems.push('adulterado: o equipar forçado equipou a peça Lendária com o páreo aberto')
        const mL = Object.assign({}, s.mounts[0], { equip: Object.assign({}, s.mounts[0].equip, { armadura: 'i99' }) })
        if (S.powerRating(mL) !== S.powerRating(s.mounts[0])) problems.push('adulterado: a peça Lendária equipada mudou o Poder')
      }
      const sala2 = await salaAtual(ad).catch(() => null)
      if (sala2 && sala2.seed !== sala.seed) problems.push('adulterado: seed da sala mudou')
      // 3. retrato inválido (peça inexistente) vale como save sem retrato: é descartado e o pr fica (o Poder da sala sai
      //    do retrato dos pontos; ver o contexto "retrato")
      const raw2 = await bruto()
      const prGravado = raw2.pending.pr
      raw2.pending.gear = [{ slot: 'sela', id: 'nao-existe', plus: 99 }]
      await grava(raw2)
      await ad.reload({ waitUntil: 'domcontentloaded' })
      await ad.waitForSelector('#t-estabulo')
      s = await st()
      // (com o equipamento suspenso o pr sai sempre do retrato dos pontos, então o 99 999 ainda gravado volta ao real)
      const prEsperado = GEAR_ON ? prGravado : await poderReal()
      if (s.pending.gear !== null || s.pending.pr !== prEsperado) problems.push('adulterado: retrato inválido ' + JSON.stringify({ gear: s.pending.gear, pr: s.pending.pr, prGravado, prEsperado }))
    } catch (e) {
      problems.push('adulterado: ' + e.message)
    }
    await ad.context().close()
  }

  // ---------------- migração v4 -> v6: status base sai, pontos livres para distribuir, Neutro vira tipo ----------------
  // (o save v4 passa pela migração v4 -> v5 e pela v5 -> v6 do bloco 1b: pontos zerados, redistribuição grátis, 0 Rédeas)
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
    if (s.v !== SAVE_V) out.push(`${rotulo}: versão ${s.v}`)
    if (s.redeas !== 0 || s.avisoV6 !== false) out.push(`${rotulo}: redeas ${s.redeas}, avisoV6 ${s.avisoV6}`)
    if (s.mounts.length !== 3) out.push(`${rotulo}: ${s.mounts.length} montarias (eram 3)`)
    for (const m of s.mounts) {
      if ('base' in m) out.push(`${rotulo}: ${m.uid} ainda tem base`)
      if (!G.ELEMENTS[m.element]) out.push(`${rotulo}: ${m.uid} com elemento ${m.element}`)
      if (m.skills.some((id) => SKILLS_DE_TIPO.includes(id))) out.push(`${rotulo}: ${m.uid} ainda tem skill de tipo na lista ${m.skills}`)
      if (!m.alloc || G.STAT_KEYS.some((k) => m.alloc[k] !== 0) || Object.keys(m.alloc).length !== 7) out.push(`${rotulo}: ${m.uid} veio com pontos distribuídos ${JSON.stringify(m.alloc)}`)
      if (m.respecFree !== true) out.push(`${rotulo}: ${m.uid} sem a redistribuição grátis (respecFree ${m.respecFree})`)
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
      // o Poder ignora o equipamento (o retrato dele fica guardado, sem efeito): R16 com o retrato dos pontos zerado
      const pr = Math.max(S.powerRating(Object.assign({}, m1, { alloc: p.alloc })), S.powerRating(m1, GR.resolve({ equip: eq }, its)))
      if (p.pr !== pr || G.STAT_KEYS.some((k) => p.alloc[k] !== 0)) out.push(`${rotulo}: Poder da sala ${p.pr} (R16 com o retrato dos pontos zerado: ${pr}) e retrato ${JSON.stringify(p.alloc)}`)
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
      const livres = S.freePoints(s1.mounts[0])   // Brasa Raro ★★ nível 12: os pontos do nível, todos para distribuir
      if (!(livres > 0) || info.free !== livres || info.left !== livres || info.used !== 0) problems.push('migracao: pontos livres do nível 12 ' + JSON.stringify(info))
      const gravado = await mg.evaluate(() => JSON.parse(localStorage.getItem('galope-elemental:v1')))
      if (gravado.v !== SAVE_V) problems.push('migracao: o save migrado não foi gravado (v ' + gravado.v + ')')
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
      // idempotente: o save migrado recarregado não muda nada (fora o rev)
      if (JSON.stringify(s3.mounts) !== mounts1) problems.push('migracao: recarregar o save migrado mudou as montarias')
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
      if (s.v !== SAVE_V || s.mounts.some((m) => 'base' in m || !G_ELS.includes(m.element) || m.respecFree !== true)) problems.push('migracao-dev: save de teste não migrou ' + JSON.stringify(s.mounts.map((m) => [m.uid, m.element, 'base' in m, m.respecFree])))
      if (s.mounts.length !== 3 || s.mounts[1].element !== neutroVira(MIG_SEED, 'm2')) problems.push('migracao-dev: montarias ' + JSON.stringify(s.mounts.map((m) => m.element)))
      if ((await md.evaluate(() => localStorage.getItem('galope-elemental:v1'))) !== null) problems.push('migracao-dev: o modo DEV gravou o save real')
    } catch (e) {
      problems.push('migracao-dev: ' + e.message)
    }
    await md.context().close()
    // save v4 sem o retrato do equipamento (pending.gear ausente): o pr da sala é recalculado uma vez no modelo novo
    // (o Poder ignora o equipamento vestido: R16 com o retrato dos pontos zerado), e a sala fica igual depois de duas
    // recargas
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
      if (!s.pending || s.pending.pr !== prV3 || s.pending.pr === 777) problems.push(`migracao-sem-retrato: pr da sala ${s.pending && s.pending.pr} (Poder da ativa no modelo novo: ${prV3})`)
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

  // ---------------- save adulterado (versão atual): alloc com 999, negativo, texto e custo acima dos pontos; Neutro ----------------
  // e o jogo novo: inicial Comum ★★, sem pontos distribuídos, save na versão atual (SAVE_V). O nome do bloco é da v5;
  // desde a v6 (bloco 1b) o alloc é cortado pelo validAlloc novo: teto de 150, custo por faixa e Sorte sem pontos.
  if (quer('adulterado-v5')) {
    const av = await newPage(browser, { width: 390, height: 844 }, 'adulterado-v5')
    const st = () => av.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    try {
      await av.getByRole('button', { name: 'Escolher Brasa' }).click()
      await av.waitForSelector('#t-estabulo')
      const s0 = await st()
      const m0 = s0.mounts[0]
      if (s0.v !== SAVE_V || m0.templateId !== 'brasa' || m0.rarity !== 'comum' || m0.grau !== 2 || 'base' in m0 || !m0.alloc || G.STAT_KEYS.some((k) => m0.alloc[k] !== 0)) problems.push('adulterado-v5: jogo novo ' + JSON.stringify({ v: s0.v, m0 }))
      const raw = await av.evaluate(() => JSON.parse(localStorage.getItem('galope-elemental:v1')))
      const LIXO1 = { vel: 999, acel: -5, man: 'abc', forca: 3.7, est: 1e300, garra: null, sorte: '4' }
      const GULOSO = { vel: 4, acel: 4, man: 4, forca: 4, est: 4, garra: 4, sorte: 4 }
      raw.mounts[0].level = 20
      raw.mounts[0].alloc = LIXO1
      raw.mounts[0].base = { vel: 100, acel: 100, man: 100, forca: 100, est: 100, garra: 100, sorte: 100 }
      raw.mounts.push({ uid: 'm2', templateId: null, name: 'Velho', element: 'neutro', rarity: 'magico', grau: 3, sex: 'f', level: 30, xp: 0, skills: ['sprint', 'raizes-firmes'],
        potential: { vel: 5, acel: 5, man: 5, forca: 5, est: 5, garra: 5, sorte: 5 }, alloc: 'tudo', palette: null, breedLeft: 2, parents: null, born: 0, equip: {} })
      raw.mounts.push({ uid: 'm3', templateId: null, name: 'Guloso', element: 'agua', rarity: 'comum', grau: 1, sex: 'm', level: 11, xp: 0, skills: [],
        potential: { vel: 5, acel: 5, man: 5, forca: 5, est: 5, garra: 5, sorte: 5 }, alloc: GULOSO, palette: null, breedLeft: 2, parents: null, born: 0, equip: {} })
      raw.nextUid = 4; raw.stableSlots = 3
      await av.evaluate((r) => localStorage.setItem('galope-elemental:v1', JSON.stringify(r)), raw)
      await av.reload({ waitUntil: 'domcontentloaded' })
      await av.waitForSelector('#t-estabulo')
      const s = await st()
      if (s.mounts.length !== 3) problems.push('adulterado-v5: montarias ' + s.mounts.length)
      // alloc válido: as 7 chaves inteiras ≥ 0, base + pontos ≤ 150, Sorte 0 e o custo (por faixa) dentro dos pontos
      const allocValido = (m, a) => !!a && G.STAT_KEYS.every((k) => Number.isInteger(a[k]) && a[k] >= 0 && a[k] <= S.maxBuy(m, k)) && a.sorte === 0 &&
        G.STAT_KEYS.reduce((t, k) => t + S.costOf(a[k]), 0) <= S.freePoints(m)
      for (const m of s.mounts) {
        if (!allocValido(m, m.alloc)) problems.push(`adulterado-v5: ${m.uid} alloc inválido ${JSON.stringify(m.alloc)} (${S.freePoints(m)} pontos)`)
        if ('base' in m) problems.push(`adulterado-v5: ${m.uid} com base`)
        if (!G.ELEMENTS[m.element]) problems.push(`adulterado-v5: ${m.uid} elemento ${m.element}`)
        const stt = S.computeStats(m)
        if (G.STAT_KEYS.some((k) => stt[k] > S.TUNING.statMax)) problems.push(`adulterado-v5: ${m.uid} passou do teto ` + JSON.stringify(stt))
      }
      const [a1, a2, a3] = s.mounts
      // Brasa nível 20 ★★: o lixo cortado pelo validAlloc (vel 999 -> o que o custo paga, forca 3,7 -> 3, sorte '4' -> 0)
      const esp1 = S.validAlloc(a1, LIXO1)
      if (JSON.stringify(a1.alloc) !== JSON.stringify(esp1) || !(a1.alloc.vel > 0) || a1.alloc.sorte !== 0) problems.push('adulterado-v5: alloc saneado da Brasa ' + JSON.stringify(a1.alloc) + ' (validAlloc: ' + JSON.stringify(esp1) + ')')
      if (a2.element !== neutroVira(s.seedBase, 'm2') || a2.skills.includes('raizes-firmes') || G.STAT_KEYS.some((k) => a2.alloc[k] !== 0)) problems.push('adulterado-v5: Neutro ' + JSON.stringify(a2))
      // Guloso Comum ★ nível 11: 4 em cada status custa mais que os pontos do nível; cortado na ordem de STAT_KEYS
      const esp3 = S.validAlloc(a3, GULOSO)
      if (JSON.stringify(a3.alloc) !== JSON.stringify(esp3) || JSON.stringify(esp3) === JSON.stringify(GULOSO)) problems.push('adulterado-v5: custo acima dos pontos não foi cortado ' + JSON.stringify(a3.alloc) + ' (validAlloc: ' + JSON.stringify(esp3) + ')')
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
        if (!allocValido(m, p.alloc)) problems.push(`adulterado-v5: retrato dos pontos ${nome} não foi saneado ` + JSON.stringify(p.alloc))
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
  // (com o equipamento suspenso, o Poder da sala sai só do retrato dos pontos; o do equipamento fica guardado, sem efeito)
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
      // 1. tira sela e ferraduras com a sala aberta (com o equipamento ligado o Poder cairia; suspenso, as peças saem só
      //    no save e o Poder não muda), apaga o retrato do equipamento do save (save de antes dele)
      if (GEAR_ON) {
        await rt.locator('[data-acao="equipar-tela"]').click()
        await rt.waitForSelector('#t-montaria')
        for (const slot of ['sela', 'ferraduras']) {
          await rt.locator(`[data-acao="equip-slot"][data-id="${slot}"]`).click()
          await rt.locator(`[data-acao="tirar"][data-id="${slot}"]`).click()
        }
      }
      const raw = await bruto()
      if (!GEAR_ON) { raw.mounts[0].equip.sela = null; raw.mounts[0].equip.ferraduras = null }
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
      // 3. e para cima (99 999) também volta ao Poder do retrato dos pontos (o equipamento não entra)
      const raw3 = await bruto()
      raw3.pending.pr = 99999
      await grava(raw3)
      const salaD = await recarregaSala()
      const sD = await st()
      if (sD.pending.pr !== prA || salaD.rivais !== salaA.rivais) problems.push(`retrato: pr adulterado para cima ficou em ${sD.pending.pr} (Poder do retrato ${prA})`)
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
      confere(await tamanhos(['.montaria-linha .selo-nivel', '.app-aba-rotulo', '.badge-ativa']), 'estábulo')
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

  // ---------------- tela da corrida (3c, Tarefa 1): faixa de ordem e narração ----------------
  // A faixa de ordem (entre a pista e a narração) segue ranking(st, simT) do quadro que a pista mostra, é reescrita no
  // máximo a cada 250 ms (a linha dos vizinhos a cada 500 ms) e tem altura fixa; em tela baixa (< 700 px) fica com a
  // linha dos corredores só, e a narração com 1 frase em 1 linha. Seeds: 16 (7 corredores; dois Faísca, então a Garra de um rival sai com o dono), 4242 (8), 5 (6) e 1 (4).
  if (quer('corrida')) {
    const SEED7 = 16, SEED8 = 4242, SEED4 = 1, SEED6 = 5
    // arma a seed, abre a sala (onde a faixa não existe) e larga; devolve o n da sala
    // antesDeLargar(pg): roda na sala, antes do "Largar" (a simulação sai no Largar, com a sala como estiver)
    const abreCorrida = async (pg, label, seed, antesDeLargar) => {
      await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
      await devArmar(pg, { seed })
      await abrirSala(pg)
      if (await pg.locator('#ordem').count()) problems.push(`[${label}] a faixa de ordem aparece na sala de largada`)
      if (antesDeLargar) await antesDeLargar(pg)
      await pg.getByRole('button', { name: /^Largar/ }).click()
      await pg.waitForSelector('#pista')
      return pg.evaluate(() => window.__galope.ui.lobby.n)
    }
    const alturas = (pg) => pg.evaluate(() => {
      const h = (s) => +document.querySelector(s).getBoundingClientRect().height.toFixed(1)
      return { ordem: h('#ordem'), feed: h('#feed'), pista: h('#pista') }
    })
    // espera o tempo de simulação passar de uma fração da chegada do jogador
    const esperaFracao = (pg, k) => pg.waitForFunction((kk) => {
      const r = window.__galope.race, L = window.__galope.ui.lobby
      return r && r._state.phase !== 'contagem' && r._state.simT >= L.sim.finishTimes[L.playerIdx] * kk
    }, k, { timeout: 90000, polling: 'raf' })
    // a lista depois de 300 ms sem troca de ordem no quadro: os itens, a ordemAtual e o quadro.order do mesmo instante
    const listaEstavel = (pg) => pg.evaluate(() => new Promise((ok, falha) => {
      const s = window.__galope.race._state, L = window.__galope.ui.lobby, t0 = performance.now()
      let ult = null, desde = t0
      const tick = () => {
        const q = s.quadro ? s.quadro.order.join() : null
        if (q !== ult) { ult = q; desde = performance.now() }
        if (q !== null && performance.now() - desde >= 300) {
          const itens = Array.from(document.querySelectorAll('#ordem-lista > li')).map((li) => {
            const pos = li.querySelector('.ordem-pos'), ord = pos && pos.querySelector('.ord'), sr = li.querySelector(':scope > .sr')
            const srOrd = ord && ord.nextElementSibling
            return { raia: Number(li.dataset.raia), voce: li.classList.contains('ordem-item--voce'), pos: pos && pos.firstChild ? pos.firstChild.nodeValue : null,
              ord: ord ? ord.getAttribute('aria-hidden') + ':' + ord.textContent + ':' + (srOrd && srOrd.classList.contains('sr') ? srOrd.textContent : '-') : null,
              sr: sr ? sr.textContent : null, chip: !!li.querySelector('.raia--mini'), dado: !!li.querySelector('.ordem-dado'), top: Math.round(li.getBoundingClientRect().top),
              dadoTxt: li.querySelector('.ordem-dado') ? li.querySelector('.ordem-dado').textContent : null, maior: li.classList.contains('ordem-item--maior'),
              dir: li.getBoundingClientRect().right }
          })
          // o Dado ativo e já revelado no instante da lista (dadoAtivo(simT) da tela e os dados parados, Ruling 6): o
          // número de cada raia e o vencedor
          const red = document.documentElement.classList.contains('mov-reduzido')
          const d = s.phase === 'contagem' ? null : s.fx.find((x) => x.kind === 'dado' && s.simT >= x.t0 && s.simT < x.t1 &&
            (red || (s.simT - x.t0) / x.escala >= window.RaceFx.DADO.regira - 1e-6))
          ok({ itens, atual: s.ordemAtual.slice(), quadro: s.quadro.order.slice(), simT: s.simT, me: L.playerIdx, nomes: L.racers.map((r) => r.horse.name), vw: document.documentElement.clientWidth,
            baixa: document.querySelector('.tela--corrida').classList.contains('tela--baixa'), dado: d ? { winner: d.winner, bests: d.rolls.map((x) => x.best) } : null })
          return
        }
        if (performance.now() - t0 > 15000) { falha(new Error('a ordem do quadro não ficou 300 ms parada em 15 s')); return }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }))
    const confereLista = (r, label, n) => {
      const raias = r.itens.map((it) => it.raia).join()
      if (r.itens.length !== n) problems.push(`[${label}] faixa de ordem com ${r.itens.length} itens (esperado ${n})`)
      if (raias !== r.atual.join() || r.atual.join() !== r.quadro.join()) problems.push(`[${label}] faixa de ordem fora do quadro em simT ${r.simT.toFixed(1)}: itens ${raias}, ordemAtual ${r.atual}, quadro ${r.quadro}`)
      r.itens.forEach((it, k) => {
        const esperado = r.nomes[it.raia] + (it.raia === r.me ? ' (você)' : '')
        if (it.voce !== (it.raia === r.me)) problems.push(`[${label}] item ${k + 1} (raia ${it.raia + 1}) com o destaque do jogador = ${it.voce}`)
        // no Dado, em tela baixa, o número que o corredor tirou fica no lugar da posição (spec 3c §4 e §6)
        const num = r.dado ? String(r.dado.bests[it.raia]) : ''
        if (r.dado && r.baixa) { if (it.pos !== num || it.ord !== null) problems.push(`[${label}] item ${k + 1} no Dado (tela baixa): posição ${JSON.stringify(it.pos)} e ordinal ${it.ord} (esperado o número ${num}, sem ordinal)`) }
        else if (it.pos !== String(k + 1) || it.ord !== 'true:o:º') problems.push(`[${label}] item ${k + 1}: posição ${JSON.stringify(it.pos)} e ordinal ${it.ord} (esperado ${k + 1} e .ord[aria-hidden=true] "o" + .sr "º")`)
        if (it.dadoTxt !== (r.dado && !r.baixa ? num : '') || it.maior !== (!!r.dado && it.raia === r.dado.winner)) problems.push(`[${label}] item ${k + 1} (raia ${it.raia + 1}): .ordem-dado ${JSON.stringify(it.dadoTxt)} e maior = ${it.maior} (Dado ${JSON.stringify(r.dado)}, tela baixa = ${r.baixa})`)
        if (it.sr !== esperado) problems.push(`[${label}] item ${k + 1}: .sr ${JSON.stringify(it.sr)} (esperado ${JSON.stringify(esperado)})`)
        if (!it.chip || !it.dado) problems.push(`[${label}] item ${k + 1} sem o selo da raia ou sem o .ordem-dado`)
      })
    }
    // a próxima escrita da linha dos vizinhos (MutationObserver: o quadro lido é o mesmo que a escreveu)
    const proximaViz = (pg) => pg.evaluate(() => new Promise((ok, falha) => {
      const el = document.getElementById('ordem-vizinhos'), s = window.__galope.race._state, L = window.__galope.ui.lobby
      const obs = new MutationObserver(() => {
        obs.disconnect()
        ok({ txt: el.textContent, atual: s.ordemAtual.slice(), pos: Array.from(s.quadro.pos), me: L.playerIdx, crossed: s.crossed, phase: s.phase,
          nomes: L.racers.map((r) => r.horse.name), lugar: L.sim.finishOrder.indexOf(L.playerIdx) + 1,
          ords: Array.from(el.querySelectorAll('.ord')).map((o) => o.getAttribute('aria-hidden') + ':' + (o.nextElementSibling ? o.nextElementSibling.className + ':' + o.nextElementSibling.textContent : '-')) })
      })
      obs.observe(el, { childList: true, subtree: true, characterData: true })
      setTimeout(() => { obs.disconnect(); falha(new Error('a linha dos vizinhos não foi reescrita em 3 s')) }, 3000)
    }))
    const confereViz = (v, label) => {
      if (v.crossed) {
        if (v.txt !== `Você chegou em ${v.lugar}oº` || v.ords.join() !== 'true:sr:º') problems.push(`[${label}] vizinhos depois de cruzar: ${JSON.stringify(v.txt)} ${v.ords} (esperado "Você chegou em ${v.lugar}º", lugar do sim.finishOrder)`)
        return
      }
      const k = v.atual.indexOf(v.me), n = v.atual.length, ruim = (m) => problems.push(`[${label}] vizinhos ${JSON.stringify(v.txt)}: ${m}`)
      const metros = (a, b) => Math.max(0, Math.round(v.pos[a] - v.pos[b]))
      // Ruling 5: distância arredondada a 0 vira "colado" (nunca "+0 m" / "−0 m"); o número mostrado vale ± 1 m
      const lido = (m) => (m[2] === undefined ? 0 : Number(m[2]))
      if (/[+−]0 m/.test(v.txt)) ruim('distância 0 escrita como "+0 m" / "−0 m" (esperado "colado")')
      if (k === 0) { if (!/^Você lidera( · |$)/.test(v.txt) || v.txt.includes('À frente')) ruim('o jogador lidera') }
      else {
        const m = v.txt.match(/^À frente: (.+?) (?:\+(\d+) m|colado)( · |$)/), a = v.atual[k - 1]
        if (!m || m[1] !== v.nomes[a] || Math.abs(lido(m) - metros(a, v.me)) > 1) ruim(`à frente esperado ${v.nomes[a]} +${metros(a, v.me)} m`)
        else if (m[2] === undefined) v.colados = (v.colados || 0) + 1
      }
      if (k === n - 1) { if (v.txt.includes('Atrás')) ruim('o jogador é o último') }
      else {
        const m = v.txt.match(/(?:^| · )Atrás: (.+?) (?:−(\d+) m|colado)$/), b = v.atual[k + 1]
        if (!m || m[1] !== v.nomes[b] || Math.abs(lido(m) - metros(v.me, b)) > 1) ruim(`atrás esperado ${v.nomes[b]} −${metros(v.me, b)} m`)
        else if (m[2] === undefined) v.colados = (v.colados || 0) + 1
      }
    }
    // cada escrita da linha dos vizinhos na corrida inteira, com o quadro que a escreveu (conferidas por confereViz)
    const vigiaViz = (pg) => pg.evaluate(() => {
      const el = document.getElementById('ordem-vizinhos'), s = window.__galope.race._state, L = window.__galope.ui.lobby
      const w = window.__vizVigia = []
      new MutationObserver(() => {
        if (s.phase === 'contagem' || w.length >= 400) return
        w.push({ txt: el.textContent, atual: s.ordemAtual.slice(), pos: Array.from(s.quadro.pos), me: L.playerIdx, crossed: s.crossed, phase: s.phase,
          nomes: L.racers.map((r) => r.horse.name), lugar: L.sim.finishOrder.indexOf(L.playerIdx) + 1,
          ords: Array.from(el.querySelectorAll('.ord')).map((o) => o.getAttribute('aria-hidden') + ':' + (o.nextElementSibling ? o.nextElementSibling.className + ':' + o.nextElementSibling.textContent : '-')) })
      }).observe(el, { childList: true, subtree: true, characterData: true })
    })
    // Review Focus 1, nos primeiros 3 s da corrida (depois da largada o pelotão troca de lugar a cada poucos quadros):
    // cada reescrita da lista (MutationObserver), cada troca da ordem do quadro e quanto tempo a lista mostrada
    // ficou diferente do quadro
    const vigiaOrdem = (pg) => pg.evaluate(() => {
      const s = window.__galope.race._state, ul = document.getElementById('ordem-lista')
      const w = window.__ordemVigia = { escritas: [], trocas: [], atrasoMax: 0, quadros: 0, fim: false, inicio: null }
      const lista = () => Array.from(ul.children).map((li) => li.dataset.raia).join()
      new MutationObserver(() => { if (!w.fim) w.escritas.push(performance.now()) }).observe(ul, { childList: true })
      let ult = null, desde = null
      const tick = () => {
        if (w.fim || !window.__galope.race) return
        const agora = performance.now()
        if (s.phase !== 'contagem' && w.inicio === null) w.inicio = agora
        if (w.inicio !== null && agora - w.inicio > 3000) { w.fim = true; return }
        const q = s.quadro ? s.quadro.order.join() : null
        if (q !== ult) { if (ult !== null && w.inicio !== null) w.trocas.push(agora); ult = q }
        if (w.inicio !== null) w.quadros++
        if (q !== null && lista() !== q) { if (desde === null) desde = agora; w.atrasoMax = Math.max(w.atrasoMax, agora - desde) } else desde = null
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const confereVigiaOrdem = async (pg, label) => {
      await pg.waitForFunction(() => window.__ordemVigia.fim, null, { timeout: 20000 })
      const w = await pg.evaluate(() => window.__ordemVigia)
      const gaps = (v) => v.slice(1).map((t, i) => t - v[i])
      const gE = gaps(w.escritas), gT = gaps(w.trocas)
      const r = { escritas: w.escritas.length, menorIntervalo: gE.length ? +Math.min(...gE).toFixed(1) : null, trocas: w.trocas.length,
        trocasRapidas: gT.filter((g) => g < 200).length, atrasoMax: +w.atrasoMax.toFixed(1), quadros: w.quadros }
      notes[label + '-limite-ordem'] = r
      // a janela tem de ser difícil: sem trocas a menos de 200 ms umas das outras, o teste não provaria o limite
      if (r.trocasRapidas < 2) problems.push(`[${label}] Review Focus 1: a janela medida não tem trocas rápidas de ordem (${JSON.stringify(r)})`)
      if (r.escritas < 3 || gE.some((g) => g < 240)) problems.push(`[${label}] Review Focus 1: a lista da faixa de ordem foi reescrita com menos de 250 ms de intervalo (${JSON.stringify(r)})`)
      if (r.atrasoMax > 320) problems.push(`[${label}] Review Focus 1: a lista mostrada ficou ${r.atrasoMax} ms diferente da ordem do quadro (máximo ~300)`)
    }
    // Dado da Sorte (spec 3c §6), quadro a quadro na corrida inteira: fora da janela de cada Dado (dadoAtivo), a
    // faixa de ordem sem números e sem a marca e nenhuma faixa do Dado na pista; na janela, com os dados ainda girando
    // (Ruling 6), a faixa só com "DADO DA SORTE" e a faixa de ordem ainda sem números; da revelação até o fim da janela,
    // cada item com o best do seu corredor (embaixo do selo; em tela baixa, no lugar da posição), a marca só no
    // vencedor e a faixa do Dado com as linhas certas; e a altura da faixa de ordem a mesma antes, durante e depois.
    // Um MutationObserver anota o simT em que o primeiro número (ou a marca) entra na faixa de ordem em cada Dado.
    const vigiaDado = (pg) => pg.evaluate(() => {
      const s = window.__galope.race._state, L = window.__galope.ui.lobby, FX = window.RaceFx
      const tela = document.querySelector('.tela--corrida'), ordem = document.getElementById('ordem'), me = L.playerIdx
      const itens = s.fx.filter((x) => x.kind === 'dado'), evs = L.sim.events.filter((e) => e.type === 'dado')
      const esperadas = itens.map((d, q) => {
        const ev = evs[q], lin = ['MAIOR DADO: ' + L.racers[ev.winner].horse.name.toUpperCase() + ' ' + ev.rolls[ev.winner].best,
          ev.text.slice(ev.text.indexOf(' — ') + 3).toUpperCase()]
        if (ev.winner !== me) lin.push('VOCÊ TIROU ' + ev.rolls[me].best)
        return lin
      })
      const red = document.documentElement.classList.contains('mov-reduzido'), REG = FX.DADO.regira
      const w = window.__dadoVigia = { quadros: 0, red, porDado: itens.map((d, q) => ({ t0: d.t0, t1: d.t1, winner: d.winner, revela: red ? d.t0 : d.t0 + REG * d.escala, escala: d.escala,
        antes: 0, durante: 0, girando: 0, revelado: 0, depois: 0, esperadas: esperadas[q], linhas: null, primeiro: null,
        changed: evs[q].changed, feedDado: null, feedClima: null, anuncio: null, painel: null, painelAntes: null })), alturas: {}, ruins: [], nRuins: 0, maxT: 0 }
      const ruim = (m) => { w.nRuins++; if (w.ruins.length < 6) w.ruins.push(m) }
      const ul = document.getElementById('ordem-lista')
      new MutationObserver(() => {
        const tem = Array.from(ul.querySelectorAll('.ordem-dado')).some((e) => e.textContent !== '') || !!ul.querySelector('.ordem-item--maior') ||
          Array.from(ul.querySelectorAll('.ordem-pos')).some((e) => !e.querySelector('.ord'))
        const q = itens.findIndex((d) => s.simT >= d.t0 && s.simT < d.t1)
        if (tem && q >= 0 && w.porDado[q].primeiro === null) w.porDado[q].primeiro = s.simT
        if (tem && q < 0) ruim({ t: s.simT, numeroForaDaJanela: true })
      }).observe(ul, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] })
      // Ruling 12: o simT em que entram a frase do Dado e a da virada na narração (a mais nova é a 1ª), o "O clima virou"
      // do #anuncio e o clima novo no painel (#clima-atual), no Dado que já começou por último
      const feed = document.getElementById('feed'), anuncio = document.getElementById('anuncio'), painel = document.getElementById('clima-atual')
      const dadoAtual = () => { let q = -1; itens.forEach((d, k) => { if (s.simT >= d.t0) q = k }); return q }
      // as frases, pelo texto do evento (as duas podem entrar no mesmo quadro; a do Dado vem sem o "🎲 ")
      const frases = itens.map((d, q) => {
        const cl = L.sim.events.find((e) => e.type === 'clima' && e.t === d.t0)
        return { dado: evs[q].text.replace(/^🎲 /, ''), clima: cl ? cl.text : null }
      })
      new MutationObserver(() => {
        const q = dadoAtual()
        if (q < 0) return
        const p = w.porDado[q], txt = feed.textContent
        if (p.feedDado === null && txt.includes(frases[q].dado)) p.feedDado = s.simT
        if (p.feedClima === null && frases[q].clima && txt.includes(frases[q].clima)) p.feedClima = s.simT
      }).observe(feed, { childList: true, subtree: true })
      new MutationObserver(() => {
        const q = dadoAtual()
        if (q >= 0 && w.porDado[q].anuncio === null && /^O clima virou/.test(anuncio.textContent)) w.porDado[q].anuncio = s.simT
      }).observe(anuncio, { childList: true, subtree: true, characterData: true })
      new MutationObserver(() => {
        const q = dadoAtual()
        if (q >= 0 && w.porDado[q].painel === null && w.porDado[q].painelAntes !== null && painel.textContent !== w.porDado[q].painelAntes) w.porDado[q].painel = s.simT
      }).observe(painel, { childList: true, subtree: true, characterData: true })
      const tick = () => {
        if (!window.__galope.race) return
        if (s.phase !== 'contagem') {
          const t = s.simT, ativo = itens.find((d) => t >= d.t0 && t < d.t1) || null, baixa = tela.classList.contains('tela--baixa')
          const rev = !!ativo && t >= w.porDado[itens.indexOf(ativo)].revela - 1e-6 * ativo.escala, mostrado = rev ? ativo : null
          w.quadros++; w.maxT = t
          const h = ordem.getBoundingClientRect().height
          w.alturas[h] = (w.alturas[h] || 0) + 1
          itens.forEach((d, q) => { const p = w.porDado[q]; if (t < d.t0) { p.antes++; p.painelAntes = painel.textContent } else if (t < d.t1) p.durante++; else p.depois++ })
          document.querySelectorAll('#ordem-lista > li').forEach((li, k) => {
            const j = Number(li.dataset.raia), pos = li.querySelector('.ordem-pos'), dd = li.querySelector('.ordem-dado')
            const posTxt = pos.firstChild ? pos.firstChild.nodeValue : '', maior = li.classList.contains('ordem-item--maior')
            const num = mostrado ? String(mostrado.rolls[j].best) : ''
            const espPos = mostrado && baixa ? num : String(k + 1), espDado = mostrado && !baixa ? num : ''
            if (posTxt !== espPos || dd.textContent !== espDado || maior !== (!!mostrado && j === mostrado.winner)) ruim({ t, ativo: !!ativo, rev, baixa, raia: j + 1, posTxt, dado: dd.textContent, maior, espPos, espDado })
          })
          const st = FX._stats
          if (ativo) {
            const p = w.porDado[itens.indexOf(ativo)], esp = rev ? p.esperadas : ['DADO DA SORTE']
            if (rev) p.revelado++; else p.girando++
            // o painel mostra o clima de antes do Dado até a revelação
            if (!rev && painel.textContent !== p.painelAntes) ruim({ t, painelAntesDaRevelacao: painel.textContent, era: p.painelAntes })
            if (!st.faixaDado || JSON.stringify(st.faixaDadoLinhas) !== JSON.stringify(esp)) ruim({ t, rev, faixa: st.faixaDado, linhas: st.faixaDadoLinhas, esperadas: esp })
            if (rev && !p.linhas) p.linhas = Array.isArray(st.faixaDadoLinhas) ? st.faixaDadoLinhas.slice() : String(st.faixaDadoLinhas)
          } else if (st.faixaDado) ruim({ t, faixaForaDaJanela: st.faixaDadoLinhas })
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const confereVigiaDado = async (pg, label) => {
      const ult = await pg.evaluate(() => { const p = window.__dadoVigia.porDado; return p.length ? p[p.length - 1].t1 : 0 })
      await pg.waitForFunction((t1) => window.__dadoVigia.maxT >= t1 + 0.5, ult, { timeout: 60000, polling: 'raf' })
      const w = await pg.evaluate(() => window.__dadoVigia)
      notes[label + '-dado'] = { quadros: w.quadros, alturas: w.alturas, porDado: w.porDado.map((p) => ({ antes: p.antes, girando: p.girando, revelado: p.revelado, depois: p.depois,
        revela: +p.revela.toFixed(2), primeiroNumero: p.primeiro === null ? null : +p.primeiro.toFixed(2), linhas: p.linhas,
        narracao: { dado: p.feedDado, clima: p.feedClima, anuncio: p.anuncio, painel: p.painel, changed: p.changed } })) }
      if (w.porDado.length < 2) problems.push(`[${label}] Dado: a corrida tem ${w.porDado.length} Dados (esperado 2)`)
      w.porDado.forEach((p, q) => {
        if (!p.antes || p.durante < 5 || !p.depois) problems.push(`[${label}] Dado ${q + 1}: quadros antes/durante/depois ${p.antes}/${p.durante}/${p.depois} (esperado todos vistos)`)
        // Ruling 6: os dados girando aparecem (sem movimento reduzido) e o primeiro número entra só na revelação
        if ((!w.red && !p.girando) || p.revelado < 5) problems.push(`[${label}] Dado ${q + 1}: quadros girando/revelado ${p.girando}/${p.revelado} (esperado os dois vistos)`)
        if (p.primeiro === null || p.primeiro < p.revela - 0.02 * p.escala) problems.push(`[${label}] Dado ${q + 1}: o primeiro número entrou na faixa de ordem em simT ${p.primeiro} (revelação em ${p.revela.toFixed(2)})`)
        // Ruling 12: a frase do Dado e, se o clima virou, a frase da virada, o #anuncio e o painel, todos na revelação
        // (com movimento reduzido, em t0: até 0,1·escala depois)
        const quando = { dado: p.feedDado }
        if (p.changed) Object.assign(quando, { clima: p.feedClima, anuncio: p.anuncio, painel: p.painel })
        for (const [k, t] of Object.entries(quando)) {
          if (t === null || t < p.revela - 0.02 * p.escala || (w.red && t > p.t0 + 0.1 * p.escala)) problems.push(`[${label}] Dado ${q + 1}: ${k} entrou em simT ${t} (revelação em ${p.revela.toFixed(2)}${w.red ? ', movimento reduzido' : ''})`)
        }
        if (JSON.stringify(p.linhas) !== JSON.stringify(p.esperadas)) problems.push(`[${label}] Dado ${q + 1}: faixa com ${JSON.stringify(p.linhas)} (esperado ${JSON.stringify(p.esperadas)})`)
      })
      if (w.nRuins) problems.push(`[${label}] Dado: ${w.nRuins} quadros com a faixa de ordem ou a faixa do Dado fora do esperado, ex.: ${JSON.stringify(w.ruins)}`)
      if (Object.keys(w.alturas).length !== 1) problems.push(`[${label}] Dado: a faixa de ordem mudou de altura antes/durante/depois do Dado: ${JSON.stringify(w.alturas)}`)
    }
    // Ruling 11, quadro a quadro em cada Dado: a caixa da faixa (_stats.faixaDadoCaixa) não cruza a caixa do cavalo do
    // jogador (s.playerRect, a do "cavalo sempre na tela", em pixels de arte) e não muda de lugar durante o Dado; e
    // nenhuma etiqueta de quem está fora da tela (_stats.caixasEtiquetas) fica embaixo dela
    const vigiaLugarDado = (pg) => pg.evaluate(() => {
      const s = window.__galope.race._state, FX = window.RaceFx, itens = s.fx.filter((x) => x.kind === 'dado')
      const w = window.__lugarVigia = { porDado: itens.map((d) => ({ t1: d.t1, quadros: 0, ys: [], cruzou: 0, ex: null, comEtiqueta: 0, etiquetaCruzou: 0, exEtiqueta: null })), maxT: 0 }
      const cruza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      const tick = () => {
        if (!window.__galope.race) return
        const t = s.simT, q = s.phase === 'contagem' ? -1 : itens.findIndex((d) => t >= d.t0 && t < d.t1)
        w.maxT = t
        const c = FX._stats.faixaDadoCaixa, p = s.playerRect
        if (q >= 0 && c && p && !s.finishCam) {
          const P = w.porDado[q], S = s.S, eu = { x: p.x / S, y: p.y / S, w: p.w / S, h: p.h / S }
          P.quadros++
          if (!P.ys.includes(c.y)) P.ys.push(c.y)
          if (cruza(c, eu)) { P.cruzou++; if (!P.ex) P.ex = { t, faixa: c, cavalo: eu } }
          const tags = FX._stats.caixasEtiquetas
          if (tags.length) P.comEtiqueta++
          const t2 = tags.find((e) => cruza(e, c))
          if (t2) { P.etiquetaCruzou++; if (!P.exEtiqueta) P.exEtiqueta = { t, faixa: c, etiqueta: t2 } }
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    // espera o fim do último Dado e confere: embaixo = true (jogador na raia 1) ⇒ a faixa no pé da pista; false ⇒ em cima
    const confereLugarDado = async (pg, label, embaixo) => {
      const ult = await pg.evaluate(() => { const p = window.__lugarVigia.porDado; return p.length ? p[p.length - 1].t1 : 0 })
      await pg.waitForFunction((t1) => window.__lugarVigia.maxT >= t1 + 0.5, ult, { timeout: 90000, polling: 'raf' })
      const r = await pg.evaluate(() => ({ w: window.__lugarVigia, hudH: window.__galope.race._state.lay.hudH, artH: window.__galope.race._state.lay.artH }))
      notes[label + '-lugar-dado'] = r.w.porDado.map((p) => ({ quadros: p.quadros, ys: p.ys, cruzou: p.cruzou, comEtiqueta: p.comEtiqueta, etiquetaCruzou: p.etiquetaCruzou }))
      if (r.w.porDado.length < 2) problems.push(`[${label}] Ruling 11: ${r.w.porDado.length} Dados na corrida (esperado 2)`)
      r.w.porDado.forEach((p, q) => {
        if (p.quadros < 10) problems.push(`[${label}] Ruling 11: Dado ${q + 1} com só ${p.quadros} quadros amostrados`)
        if (p.ys.length !== 1) problems.push(`[${label}] Ruling 11: a faixa do Dado ${q + 1} mudou de lugar durante o Dado: y ${p.ys}`)
        if (p.cruzou) problems.push(`[${label}] Ruling 11: a faixa do Dado ${q + 1} cruzou o cavalo do jogador em ${p.cruzou} quadros, ex.: ${JSON.stringify(p.ex)}`)
        if (p.etiquetaCruzou) problems.push(`[${label}] a faixa do Dado ${q + 1} cobriu uma etiqueta de quem está fora da tela em ${p.etiquetaCruzou} quadros, ex.: ${JSON.stringify(p.exEtiqueta)}`)
        const y = p.ys[0], esp = embaixo ? 'no pé da pista' : 'logo abaixo do painel'
        if (y !== undefined && (embaixo ? y < r.artH / 2 : y !== r.hudH + 2)) problems.push(`[${label}] Ruling 11: faixa do Dado ${q + 1} em y ${y} (esperado ${esp}; hudH ${r.hudH}, artH ${r.artH})`)
      })
    }
    // narração: a 1ª frase de Garra de um rival (com o dono entre parênteses) medida quando chega, e os ordinais
    const vigiaFeed = (pg) => pg.evaluate(() => {
      const w = window.__feedVigia = { garra: null, ords: 0, ordRuim: [] }
      const feed = document.getElementById('feed')
      new MutationObserver(() => {
        feed.querySelectorAll('.ord').forEach((o) => {
          w.ords++
          const sr = o.nextElementSibling
          if (o.getAttribute('aria-hidden') !== 'true' || !sr || !sr.classList.contains('sr') || sr.textContent !== 'º') w.ordRuim.push(o.parentNode.textContent)
        })
        const li = feed.firstElementChild
        if (!w.garra && li && li.classList.contains('tipo-garra') && !li.classList.contains('voce')) {
          const sp = li.lastElementChild
          w.garra = { txt: sp.textContent, sw: sp.scrollWidth, cw: sp.clientWidth, sh: sp.scrollHeight, ch: sp.clientHeight, h: sp.getBoundingClientRect().height,
            lh: parseFloat(getComputedStyle(sp).lineHeight), visivel: !li.hidden && li.offsetTop + li.offsetHeight <= feed.clientHeight,
            docSw: document.documentElement.scrollWidth, docCw: document.documentElement.clientWidth }
        }
      }).observe(feed, { childList: true, subtree: true })
    })
    // faixa do lugar (spec 3c §7, Ruling 14), quadro a quadro: nunca antes de o jogador cruzar a linha (s.crossed); no quadro
    // em que cruza, o texto do lugar dele no sim.finishOrder ('VITÓRIA!', 'Nº LUGAR'); parada (uma caixa só) até sumir
    // ~2,5 s reais depois (e a tela não vai para o resultado antes); sem cobrir o cavalo do jogador, a etiqueta "FOTO DE
    // CHEGADA" (mesmo quando ela não está na tela: a faixa fica sempre fora do lugar dela) nem a faixa do Dado
    const vigiaLugar = (pg) => pg.evaluate(() => {
      const s = window.__galope.race._state, L = window.__galope.ui.lobby, FX = window.RaceFx, SP = window.Sprites, me = L.playerIdx
      const k = L.sim.finishOrder.indexOf(me) + 1
      const w = window.__lugarFaixa = { esperado: k === 1 ? 'VITÓRIA!' : k + 'º LUGAR', lugar: k, raia: me + 1, quadros: 0, antes: 0, noCruzar: null, textos: [], caixas: [],
        t0: null, t1: null, cruzouCavalo: 0, cobriuFoto: 0, cobriuDado: 0, ex: null, fim: false, cortada: false, hudH: s.lay.hudH, artH: s.lay.artH }
      const cruza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      const tick = () => {
        // a tela sai para o resultado no quadro em que a faixa acaba (sem desenhá-lo): acabou se o relógio passou do fim dela
        if (!window.__galope.race) {
          if (w.t0 !== null && w.t1 === null) { if (s.lugar && s.tReal >= s.lugar.ate) w.t1 = s.tReal; else w.cortada = true }
          w.fim = true; return
        }
        const st = FX._stats, txt = st.faixaLugar, c = st.faixaLugarCaixa
        w.quadros++
        if (!s.crossed) { if (txt) w.antes++ } else {
          if (w.noCruzar === null) w.noCruzar = txt
          if (txt) {
            if (w.t0 === null) w.t0 = s.tReal
            if (!w.textos.includes(txt)) w.textos.push(txt)
            if (!w.caixas.includes(JSON.stringify(c))) w.caixas.push(JSON.stringify(c))
            const p = s.playerRect, S = s.S, lay = s.lay, fw = SP.measureText('FOTO DE CHEGADA', 1) + 6
            const eu = p && { x: p.x / S, y: p.y / S, w: p.w / S, h: p.h / S }, foto = { x: Math.round(lay.artW / 2 - fw / 2) - 1, y: lay.hudH + 2, w: fw + 2, h: 11 }
            if (eu && cruza(c, eu)) { w.cruzouCavalo++; w.ex = w.ex || { t: s.simT, faixa: c, cavalo: eu } }
            if (cruza(c, foto)) w.cobriuFoto++
            if (st.faixaDadoCaixa && cruza(c, st.faixaDadoCaixa)) w.cobriuDado++
          } else if (w.t0 !== null) { w.t1 = s.tReal; w.fim = true; return }
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    // espera a faixa do lugar sumir e confere; esperado (opcional) = o texto que a seed tem de dar (o teste conta com ele)
    const confereLugar = async (pg, label, esperado) => {
      await pg.waitForFunction(() => window.__lugarFaixa.fim, null, { timeout: 120000, polling: 'raf' })
      const w = await pg.evaluate(() => window.__lugarFaixa)
      const dur = w.t0 !== null && w.t1 !== null ? +(w.t1 - w.t0).toFixed(2) : null
      notes[label + '-faixa-lugar'] = { esperado: w.esperado, raia: w.raia, textos: w.textos, caixas: w.caixas, duracao: dur, quadros: w.quadros, hudH: w.hudH, artH: w.artH }
      if (esperado && w.esperado !== esperado) problems.push(`[${label}] o jogador chegou em ${w.lugar}º (o teste conta com ${esperado})`)
      if (w.antes) problems.push(`[${label}] faixa do lugar em ${w.antes} quadros antes de o jogador cruzar a linha`)
      if (w.noCruzar !== w.esperado || w.textos.join() !== w.esperado) problems.push(`[${label}] faixa do lugar ${JSON.stringify(w.textos)} (no quadro da chegada: ${JSON.stringify(w.noCruzar)}; esperado ${JSON.stringify(w.esperado)})`)
      if (w.cortada || dur === null || dur < 2.4 || dur > 2.7) problems.push(`[${label}] a faixa do lugar ficou ${dur} s reais na tela${w.cortada ? ' (a corrida saiu antes de ela sumir)' : ''} (esperado ~2,5 s)`)
      if (w.caixas.length !== 1) problems.push(`[${label}] a faixa do lugar mudou de lugar: ${w.caixas.join(' ')}`)
      if (w.cruzouCavalo) problems.push(`[${label}] Ruling 14: a faixa do lugar cruzou o cavalo do jogador em ${w.cruzouCavalo} quadros, ex.: ${JSON.stringify(w.ex)}`)
      if (w.cobriuFoto) problems.push(`[${label}] a faixa do lugar cobre a etiqueta "FOTO DE CHEGADA" (${w.caixas[0]})`)
      if (w.cobriuDado) problems.push(`[${label}] a faixa do lugar cobriu a faixa do Dado em ${w.cobriuDado} quadros`)
      return w
    }
    // plaquinhas de skill dos rivais (spec 3c §5), quadro a quadro: o balão de texto mostra o nome inteiro — numa linha ou,
    // com a raia alta o bastante (s.linhasBalao = 2), em duas; com a raia baixa, o nome curto de sempre
    const vigiaBaloes = (pg) => pg.evaluate(() => {
      const s = window.__galope.race._state, FX = window.RaceFx, me = window.__galope.ui.lobby.playerIdx
      const w = window.__baloesVigia = { vistos: 0, inteirosLongos: 0, ruins: 0, ex: [], linhas: s.linhasBalao, lane: s.lay.laneArt }
      const tick = () => {
        if (!window.__galope.race) return
        const t = s.simT
        FX._stats.caixasBaloes.forEach((b) => {
          if (b.pilha !== 0 || b.kind !== 'skill' || b.racer === me) return
          // o item do balão de texto: o mais novo do cavalo entre os balões ativos (skill, Garra, cansou), como a tela
          const it = s.fx.filter((x) => (x.kind === 'skill' || x.kind === 'garra' || x.kind === 'cansou') && x.racer === b.racer && t >= x.t0 && t < x.t0 + FX.BALAO.dur * x.escala).pop()
          if (!it || it.kind !== 'skill') return
          w.vistos++
          const inteiro = it.nome.toUpperCase(), esp = s.linhasBalao === 2 ? inteiro : it.nomeCurto
          if (b.texto !== esp) { w.ruins++; if (w.ex.length < 4) w.ex.push({ texto: b.texto, esp, linhas: s.linhasBalao }) }
          else if (b.texto === inteiro && inteiro.includes(' ') && inteiro !== it.nomeCurto) w.inteirosLongos++
        })
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const visivel = (pg, sel) => pg.evaluate((s) => {
      const e = document.querySelector(s), b = e.getBoundingClientRect()
      return getComputedStyle(e).display !== 'none' && b.height > 0 && b.top >= 0 && b.bottom <= window.innerHeight
    }, sel)
    const SHOTS_C = process.env.SHOTS_CORRIDA || null   // pasta (fora do repositório) para as capturas de conferência

    // 360x780 e 360x640 (tela baixa): ordem, vizinhos, alturas fixas, narração e o limite de reescritas
    for (const [vp, baixa] of [[{ width: 360, height: 780 }, false], [{ width: 360, height: 640 }, true]]) {
      const label = `corrida-${vp.width}x${vp.height}`
      const pg = await newPage(browser, vp, label, { query: '?dev=1' })
      try {
        const n = await abreCorrida(pg, label, SEED7)
        if (!(await pg.locator('#ordem').count())) throw new Error('sem a faixa de ordem (#ordem) na corrida')
        await vigiaOrdem(pg)
        await vigiaViz(pg)
        await vigiaDado(pg)
        await vigiaLugarDado(pg)
        await vigiaFeed(pg)
        await vigiaLugar(pg)
        await vigiaBaloes(pg)
        // na contagem: a ordem das raias e "Largada em instantes" (quando ainda dá tempo de ler)
        const cont = await pg.evaluate(() => ({ phase: window.__galope.race._state.phase, raias: Array.from(document.querySelectorAll('#ordem-lista > li')).map((li) => li.dataset.raia).join(), viz: document.getElementById('ordem-vizinhos').textContent }))
        if (cont.phase === 'contagem' && (cont.raias !== Array.from({ length: n }, (_, i) => i).join() || cont.viz !== 'Largada em instantes')) problems.push(`[${label}] na contagem: ordem ${cont.raias} e vizinhos ${JSON.stringify(cont.viz)} (esperado as raias em ordem e "Largada em instantes")`)
        const h0 = await alturas(pg)
        const lay = await pg.evaluate(() => ({ compact: window.__galope.race._state.lay.compact, baixa: document.querySelector('.tela--corrida').classList.contains('tela--baixa') }))
        if (lay.compact) problems.push(`[${label}] a pista caiu no layout compacto`)
        if (lay.baixa !== baixa) problems.push(`[${label}] classe tela--baixa = ${lay.baixa} (esperado ${baixa})`)
        await checkRaceFits(pg, label)
        if (!(await visivel(pg, '.ordem-lista'))) problems.push(`[${label}] a linha dos corredores não está visível`)
        if ((await visivel(pg, '.ordem-vizinhos')) === baixa) problems.push(`[${label}] a linha dos vizinhos ${baixa ? 'aparece na tela baixa' : 'não está visível'}`)
        // logo depois da largada
        await esperaFracao(pg, 0.08)
        confereLista(await listaEstavel(pg), label + ' largada', n)
        confereViz(await proximaViz(pg), label + ' largada')
        // Review Focus 1: em 2 s de corrida em x2, a lista é reescrita no máximo 8 vezes
        await pg.getByRole('button', { name: 'x2' }).click()
        const escritas = await pg.evaluate(() => new Promise((ok) => { const s = window.__galope.race._state, e0 = s.ordemEscritas; setTimeout(() => ok(s.ordemEscritas - e0), 2000) }))
        notes[label + '-escritas2s'] = escritas
        if (escritas > 8) problems.push(`[${label}] a lista da faixa de ordem foi reescrita ${escritas} vezes em 2 s (máximo 8)`)
        await confereVigiaOrdem(pg, label)
        // meio
        await esperaFracao(pg, 0.5)
        const meio = await listaEstavel(pg)
        confereLista(meio, label + ' meio', n)
        confereViz(await proximaViz(pg), label + ' meio')
        const h1 = await alturas(pg)
        await checkOverflow(pg, label + ' meio')
        if (SHOTS_C) await pg.screenshot({ path: join(SHOTS_C, `${label}-meio.png`) })
        // perto do fim (antes de o jogador cruzar)
        await esperaFracao(pg, 0.92)
        confereLista(await listaEstavel(pg), label + ' fim', n)
        // depois de cruzar: "Você chegou em Nº" e as alturas da largada
        await pg.waitForFunction(() => window.__galope.race._state.crossed, null, { timeout: 30000, polling: 'raf' })
        let v = await proximaViz(pg)
        if (!v.crossed) v = await proximaViz(pg)
        confereViz(v, label + ' chegada')
        // todas as escritas da linha dos vizinhos da corrida (Ruling 5: "colado" no lugar de "+0 m")
        const todas = await pg.evaluate(() => window.__vizVigia)
        todas.forEach((x, i) => confereViz(x, `${label} vizinhos #${i + 1}`))
        notes[label + '-vizinhos'] = { escritas: todas.length, colados: todas.reduce((a, x) => a + (x.colados || 0), 0) }
        if (todas.length < 10) problems.push(`[${label}] só ${todas.length} escritas da linha dos vizinhos na corrida (esperado uma a cada 500 ms)`)
        // os dois Dados, quadro a quadro
        await confereVigiaDado(pg, label)
        await confereLugarDado(pg, label, false)
        const h2 = await alturas(pg)
        notes[label + '-alturas'] = { largada: h0, meio: h1, chegada: h2 }
        if (JSON.stringify(h0) !== JSON.stringify(h1) || JSON.stringify(h1) !== JSON.stringify(h2)) problems.push(`[${label}] a faixa, a narração ou a pista mudaram de altura durante a corrida: ${JSON.stringify(notes[label + '-alturas'])}`)
        if (baixa && (h0.ordem > 30 || h0.feed > 34)) problems.push(`[${label}] tela baixa com a faixa de ${h0.ordem}px e a narração de ${h0.feed}px (esperado ~28 e ~33)`)
        // narração
        const w = await pg.evaluate(() => window.__feedVigia)
        notes[label + '-narracao'] = w
        if (!w.ords) problems.push(`[${label}] a narração não mostrou nenhum ordinal`)
        if (w.ordRuim.length) problems.push(`[${label}] ordinais da narração sem .ord[aria-hidden] seguido de .sr: ${w.ordRuim.slice(0, 2).join(' | ')}`)
        if (!baixa) {
          const g = w.garra
          if (!g || !/\(.+\) mostrou GARRA na reta final!$/.test(g.txt)) problems.push(`[${label}] a narração não mostrou a Garra de um rival com dono: ${JSON.stringify(g)}`)
          else if (g.sw > g.cw || g.sh > g.ch || g.h > 2 * g.lh + 1 || !g.visivel || g.docSw > g.docCw) problems.push(`[${label}] a frase longa da narração não aparece inteira em até 2 linhas: ${JSON.stringify(g)}`)
        } else {
          const um = await pg.evaluate(() => Array.from(document.querySelectorAll('#feed > li')).filter((li) => getComputedStyle(li).display !== 'none').length)
          if (um > 1) problems.push(`[${label}] tela baixa com ${um} frases na narração (esperado 1)`)
        }
        await checkOverflow(pg, label + ' chegada')
        // por último (a tela vai para o resultado quando a faixa some): a faixa do lugar (o jogador chega em 7º de 7 na
        // seed 16) e as plaquinhas dos rivais
        await confereLugar(pg, label, '7º LUGAR')
        const bv = await pg.evaluate(() => window.__baloesVigia)
        notes[label + '-baloes'] = bv
        if (bv.linhas !== (baixa ? 1 : 2)) problems.push(`[${label}] nome da skill nos balões em ${bv.linhas} linha(s) com raias de ${bv.lane} (esperado ${baixa ? 1 : 2})`)
        if (!bv.vistos || bv.ruins) problems.push(`[${label}] plaquinhas de skill dos rivais: ${bv.ruins} de ${bv.vistos} com o texto errado, ex.: ${JSON.stringify(bv.ex)}`)
        if (!baixa && !bv.inteirosLongos) problems.push(`[${label}] nenhuma plaquinha de rival com o nome inteiro de uma skill de duas palavras que antes era abreviada (${JSON.stringify(bv)})`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 390x844: sem rolagem lateral com o .sr dos ordinais na narração e na faixa
    {
      const label = 'corrida-390x844'
      const pg = await newPage(browser, { width: 390, height: 844 }, label, { query: '?dev=1' })
      try {
        await abreCorrida(pg, label, SEED7)
        await pg.getByRole('button', { name: 'x2' }).click()
        for (const k of [0.3, 0.6, 0.95]) { await esperaFracao(pg, k); await checkOverflow(pg, `${label} ${k}`) }
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // cores forçadas: o item do jogador com Highlight e os outros com borda em cor do sistema
    {
      const label = 'corrida-forcado'
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1', forcedColors: 'active' })
      try {
        await abreCorrida(pg, label, SEED7)
        await esperaFracao(pg, 0.1)
        const fc = await pg.evaluate(() => {
          const sonda = (c) => { const d = document.createElement('i'); d.style.border = '2px solid ' + c; document.body.appendChild(d); const v = getComputedStyle(d).borderTopColor; d.remove(); return v }
          return { ativo: matchMedia('(forced-colors: active)').matches, hl: sonda('Highlight'), ct: sonda('CanvasText'),
            itens: Array.from(document.querySelectorAll('#ordem-lista > li')).map((li) => { const cs = getComputedStyle(li); return { voce: li.classList.contains('ordem-item--voce'), w: cs.borderTopWidth, s: cs.borderTopStyle, c: cs.borderTopColor, bg: cs.backgroundColor } }) }
        })
        notes[label] = fc
        if (!fc.ativo) problems.push(`[${label}] a página não está em cores forçadas`)
        const eu = fc.itens.filter((i) => i.voce), outros = fc.itens.filter((i) => !i.voce)
        if (eu.length !== 1 || !(eu[0].c === fc.hl || eu[0].bg === fc.hl) || eu[0].w !== '2px') problems.push(`[${label}] item do jogador sem Highlight: ${JSON.stringify(eu)} (Highlight = ${fc.hl})`)
        if (!outros.length || outros.some((i) => i.w !== '2px' || i.s !== 'solid' || i.c !== fc.ct)) problems.push(`[${label}] itens sem borda de 2px em cor do sistema: ${JSON.stringify(outros)} (CanvasText = ${fc.ct})`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // Review Focus 2: girar no meio da corrida (360x780 → 780x360 → 360x780) numa sala de n ≤ 6 (Ruling 3: com 7–8
    // corredores a paisagem já estourava na BASE — a raia mínima de 12 do compacto —, pendência conhecida)
    {
      const label = 'corrida-girar'
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1' })
      try {
        const n6 = await abreCorrida(pg, label, SEED6)
        if (n6 > 6) problems.push(`[${label}] a seed ${SEED6} abriu uma sala de ${n6} (esperado ≤ 6)`)
        await esperaFracao(pg, 0.3)
        const estado = async (tag) => {
          const f = await checkRaceFits(pg, `${label} ${tag}`)
          await checkOverflow(pg, `${label} ${tag}`)
          const r = await pg.evaluate(() => ({ baixa: document.querySelector('.tela--corrida').classList.contains('tela--baixa'), ordem: document.getElementById('ordem').getBoundingClientRect().height, vh: window.innerHeight, sh: document.documentElement.scrollHeight }))
          notes[`${label}-${tag}`] = { ...f, ...r }
          return r
        }
        const a = await estado('retrato')
        await pg.setViewportSize({ width: 780, height: 360 })
        await sleep(500)
        const b = await estado('paisagem')
        await pg.setViewportSize({ width: 360, height: 780 })
        await sleep(500)
        const c = await estado('volta')
        if (a.baixa || !b.baixa || c.baixa) problems.push(`[${label}] a classe tela--baixa não acompanhou o giro: ${a.baixa} → ${b.baixa} → ${c.baixa}`)
        if (b.ordem > 30 || a.ordem !== c.ordem) problems.push(`[${label}] a faixa não se reajustou no giro: ${a.ordem} → ${b.ordem} → ${c.ordem}px`)
        for (const [tag, r] of [['paisagem', b], ['volta', c]]) if (r.sh > r.vh + 1) problems.push(`[${label}] ${tag}: a corrida não cabe na altura da janela (${r.sh} > ${r.vh})`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // Ruling 3: em paisagem, com a sala de 8, a faixa vai para a linha dos controles e não soma altura
    {
      const label = 'corrida-paisagem-8'
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1' })
      try {
        const n = await abreCorrida(pg, label, SEED8)
        if (n !== 8) problems.push(`[${label}] a seed ${SEED8} abriu uma sala de ${n} (esperado 8)`)
        await esperaFracao(pg, 0.3)
        await pg.setViewportSize({ width: 780, height: 360 })
        await sleep(500)
        await checkOverflow(pg, label)
        const r = await pg.evaluate(() => {
          const ordem = document.getElementById('ordem'), baixo = document.querySelector('.corrida-baixo'), ctl = document.querySelector('.controles')
          const com = baixo.getBoundingClientRect().height
          ordem.style.display = 'none'
          const sem = baixo.getBoundingClientRect().height   // getBoundingClientRect força o layout
          ordem.style.display = ''
          return { baixa: document.querySelector('.tela--corrida').classList.contains('tela--baixa'), topOrdem: ordem.getBoundingClientRect().top,
            topCtl: ctl.getBoundingClientRect().top, hOrdem: ordem.getBoundingClientRect().height, com, sem,
            itens: Array.from(document.querySelectorAll('#ordem-lista > li')).map((li) => Math.round(li.getBoundingClientRect().top)) }
        })
        notes[label] = r
        if (!r.baixa) problems.push(`[${label}] sem a classe tela--baixa em 780x360`)
        if (Math.abs(r.topOrdem - r.topCtl) > 2) problems.push(`[${label}] a faixa de ordem não está na linha dos controles: ${JSON.stringify(r)}`)
        if (r.com !== r.sem) problems.push(`[${label}] a faixa de ordem soma altura ao .corrida-baixo em paisagem: ${r.com}px com ela, ${r.sem}px sem`)
        if (r.itens.length !== 8 || new Set(r.itens).size !== 1) problems.push(`[${label}] os 8 itens não estão numa linha: ${r.itens}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // Review Focus 3: sala de 8 com o cavalo do jogador renomeado (16 letras) pelo save e os rivais renomeados (16
    // letras, na sala, antes do "Largar": os vizinhos do jogador também têm nome comprido), contra a sala de 4
    {
      const label = 'corrida-8'
      const NOME = 'Relampagodourado'
      const RIVAIS = 'ABCDEFGH'.split('').map((c) => 'Tempestadeserra' + c)   // 16 letras, um nome por raia
      const altura4 = async () => {
        const p4 = await newPage(browser, { width: 360, height: 780 }, label + '-4', { query: '?dev=1' })
        try {
          const n4 = await abreCorrida(p4, label + '-4', SEED4)
          if (n4 !== 4) problems.push(`[${label}-4] a seed ${SEED4} abriu uma sala de ${n4} (esperado 4)`)
          await esperaFracao(p4, 0.2)
          const viz = await p4.evaluate(() => document.getElementById('ordem-vizinhos').getBoundingClientRect().height)
          return { ordem: (await alturas(p4)).ordem, viz }
        } finally { await p4.context().close() }
      }
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await pg.evaluate((nome) => {
          const k = 'galope-elemental:dev', raw = JSON.parse(localStorage.getItem(k))
          raw.mounts.find((m) => m.uid === raw.activeId).name = nome
          localStorage.setItem(k, JSON.stringify(raw))
        }, NOME)
        await pg.reload({ waitUntil: 'domcontentloaded' })
        const n = await abreCorrida(pg, label, SEED8, (p) => p.evaluate((nomes) => {
          window.__galope.ui.lobby.racers.forEach((r, j) => { if (!r.isPlayer) r.horse.name = nomes[j] })
        }, RIVAIS))
        if (n !== 8) problems.push(`[${label}] a seed ${SEED8} abriu uma sala de ${n} (esperado 8)`)
        await esperaFracao(pg, 0.4)
        const r = await listaEstavel(pg)
        confereLista(r, label, 8)
        if (r.nomes[r.me] !== NOME) problems.push(`[${label}] o cavalo do jogador corre como ${r.nomes[r.me]} (esperado ${NOME})`)
        const tops = [...new Set(r.itens.map((it) => it.top))]
        if (tops.length !== 1 || r.itens.some((it) => it.dir > r.vw)) problems.push(`[${label}] os 8 itens não cabem numa linha a 360px: tops ${tops}, direita ${r.itens.map((it) => Math.round(it.dir))} (largura ${r.vw})`)
        await checkOverflow(pg, label)
        const rivaisR = r.nomes.filter((x, j) => j !== r.me)
        if (rivaisR.some((x) => !RIVAIS.includes(x) || x.length !== 16)) problems.push(`[${label}] os rivais correm como ${rivaisR} (esperado os nomes de 16 letras da sala)`)
        // a linha dos vizinhos com os nomes compridos: confere com o quadro, sem rolagem lateral e na altura de sempre
        const v8 = await proximaViz(pg)
        confereViz(v8, label + ' vizinhos')
        const h8 = (await alturas(pg)).ordem
        const viz = await pg.evaluate(() => { const e = document.getElementById('ordem-vizinhos'); return { h: e.getBoundingClientRect().height, sw: e.scrollWidth, cw: e.clientWidth, txt: e.textContent } })
        if (!RIVAIS.some((x) => viz.txt.includes(x))) problems.push(`[${label}] a linha dos vizinhos não mostra nenhum rival de nome comprido: ${JSON.stringify(viz.txt)}`)
        if (viz.sw > viz.cw) problems.push(`[${label}] a linha dos vizinhos rola na horizontal com nomes de 16 letras: scrollWidth ${viz.sw} > ${viz.cw} (${JSON.stringify(viz.txt)})`)
        const h4 = await altura4()
        notes[label] = { ordem8: h8, ordem4: h4.ordem, viz, viz4: h4.viz }
        if (h8 !== h4.ordem) problems.push(`[${label}] a faixa de ordem tem ${h8}px com 8 corredores e ${h4.ordem}px com 4`)
        if (viz.h !== h4.viz) problems.push(`[${label}] a linha dos vizinhos tem ${viz.h}px com nomes de 16 letras e ${h4.viz}px com os nomes da sala de 4`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // Ruling 11: com o jogador na raia 1 (seed 102), a faixa do Dado vai para o pé da pista e não cobre o cavalo dele;
    // com o jogador na raia 7 (seed 4242), fica em cima. Nos dois casos, um lugar por Dado.
    for (const [seed, embaixo] of [[102, true], [SEED8, false]]) {
      for (const vp of [{ width: 360, height: 780 }, { width: 360, height: 640 }]) {
        const label = `corrida-lugar-dado-${seed}-${vp.width}x${vp.height}`
        const pg = await newPage(browser, vp, label, { query: '?dev=1' })
        try {
          await abreCorrida(pg, label, seed)
          const me = await pg.evaluate(() => window.__galope.ui.lobby.playerIdx)
          if ((me === 0) !== embaixo) problems.push(`[${label}] a seed ${seed} pôs o jogador na raia ${me + 1} (o teste conta com ${embaixo ? 'a raia 1' : 'outra raia'})`)
          await vigiaLugarDado(pg)
          await pg.getByRole('button', { name: 'x2' }).click()
          await confereLugarDado(pg, label, embaixo)
          await checkRaceFits(pg, label)
          if (SHOTS_C) await pg.screenshot({ path: join(SHOTS_C, `${label}.png`) })
        } catch (e) {
          problems.push(`[${label}] ` + e.message)
        } finally {
          await pg.context().close()
        }
      }
    }

    // girar ou redimensionar no meio de um Dado refaz a decisão do lugar da faixa: na seed 9 (jogador na raia 2), o 1º Dado
    // decide em cima a 360x780 e, a 360x640, a faixa em cima cruzaria o cavalo dele; depois do novo layout, nenhum quadro
    // do Dado tem a faixa sobre o cavalo do jogador
    {
      const label = 'corrida-lugar-dado-redimensiona'
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1' })
      try {
        await abreCorrida(pg, label, 9)
        // o 1º Dado já decidido, no começo da janela dele
        const antes = await (await pg.waitForFunction(() => {
          const s = window.__galope.race._state, d = s.fx.find((x) => x.kind === 'dado')
          return s.lugarDado && s.lugarDado.t0 === d.t0 && s.simT >= d.t0 ? { t0: d.t0, t1: d.t1, simT: s.simT, embaixo: s.lugarDado.embaixo, artH: s.lay.artH } : false
        }, null, { timeout: 90000, polling: 'raf' })).jsonValue()
        if (antes.embaixo !== false || antes.simT > antes.t0 + 0.3 * (antes.t1 - antes.t0)) problems.push(`[${label}] a 360x780 o 1º Dado devia decidir em cima, logo no começo: ${JSON.stringify(antes)}`)
        // vigia os quadros do Dado depois do layout novo (artH diferente do de antes)
        await pg.evaluate((a) => {
          const s = window.__galope.race._state, FX = window.RaceFx
          const w = window.__rzDado = { quadros: 0, cruzou: 0, ex: null, fim: false, embaixo: null }
          const tick = () => {
            if (!window.__galope.race || s.simT >= a.t1) { w.fim = true; return }
            const c = FX._stats.faixaDadoCaixa, p = s.playerRect
            if (s.lay.artH !== a.artH && c && p && !s.finishCam) {
              const S = s.S, eu = { x: p.x / S, y: p.y / S, w: p.w / S, h: p.h / S }
              w.quadros++; w.embaixo = s.lugarDado.embaixo
              if (c.x < eu.x + eu.w && eu.x < c.x + c.w && c.y < eu.y + eu.h && eu.y < c.y + c.h) { w.cruzou++; if (!w.ex) w.ex = { t: s.simT, faixa: c, cavalo: eu } }
            }
            requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }, antes)
        await pg.setViewportSize({ width: 360, height: 640 })
        await pg.waitForFunction(() => window.__rzDado.fim, null, { timeout: 30000, polling: 'raf' })
        const w = await pg.evaluate(() => window.__rzDado)
        notes[label] = { antes, depois: w }
        if (w.quadros < 5) problems.push(`[${label}] só ${w.quadros} quadros do Dado depois do layout novo`)
        if (w.cruzou) problems.push(`[${label}] depois de redimensionar no meio do Dado, a faixa cruzou o cavalo do jogador em ${w.cruzou} quadros, ex.: ${JSON.stringify(w.ex)}`)
        await checkRaceFits(pg, label)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // a faixa do Dado em cima não cobre as etiquetas de quem está fora da tela. No Dado o pelotão anda junto (ninguém fica
    // fora da câmera), então o teste afasta os rivais das raias 1 e 2 (150 m à frente e atrás, nos quadros da simulação
    // em volta do Dado, que só o desenho lê) e desenha à mão a janela do 1º Dado a 360x640, onde a etiqueta da raia 1
    // cairia embaixo da faixa
    {
      const label = 'corrida-etiquetas-dado'
      const pg = await newPage(browser, { width: 360, height: 640 }, label, { query: '?dev=1' })
      try {
        await abreCorrida(pg, label, SEED7)
        await pg.waitForFunction(() => window.__galope.race && window.__galope.race._state.phase === 'corrida', null, { timeout: 20000 })
        const r = await pg.evaluate(() => {
          const rv = window.__galope.race, s = rv._state, L = window.__galope.ui.lobby, FX = window.RaceFx, desenha = rv.frame
          rv.frame = function () {}
          const d = s.fx.find((x) => x.kind === 'dado'), me = L.playerIdx, longe = [0, 1].filter((j) => j !== me)
          L.sim.frames.forEach((f) => { if (f.t > d.t0 - 2 && f.t < d.t1 + 2) longe.forEach((j, k) => { f.pos[j] = f.pos[me] + (k ? -150 : 150) }) })
          const cruza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
          const w = { quadros: 0, comEtiqueta: 0, cruzou: 0, ex: null, embaixo: null }
          for (let T = d.t0; T < d.t1; T += 0.1) {
            s.phase = 'corrida'; s.simT = T; s.last = 0; s.mult = 1; s.flash = 0
            desenha(performance.now())
            const c = FX._stats.faixaDadoCaixa, tags = FX._stats.caixasEtiquetas
            if (!c) continue
            w.quadros++; w.embaixo = s.lugarDado.embaixo
            if (tags.length >= longe.length) w.comEtiqueta++
            const t2 = tags.find((e) => cruza(e, c))
            if (t2) { w.cruzou++; if (!w.ex) w.ex = { T, faixa: c, etiqueta: t2 } }
          }
          rv.frame = desenha
          return w
        })
        notes[label] = r
        if (r.embaixo !== false || r.quadros < 20 || r.comEtiqueta < r.quadros) problems.push(`[${label}] o teste não desenhou a faixa do Dado em cima com as etiquetas dos rivais afastados: ${JSON.stringify(r)}`)
        if (r.cruzou) problems.push(`[${label}] a faixa do Dado em cima cobriu uma etiqueta de quem está fora da tela em ${r.cruzou} quadros, ex.: ${JSON.stringify(r.ex)}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // faixa do lugar: vitória (seed 3, jogador em 1º), pódio (seed 12, 3º; com o jogador na raia 2 a 360x640 a faixa vai
    // para o pé) e Ruling 14 com o jogador na raia 1 (seed 102, 8º): a faixa não cruza o cavalo dele em nenhum quadro, a
    // 360x780 e a 360x640
    for (const [seed, esperado, vp] of [[3, 'VITÓRIA!', { width: 360, height: 780 }], [12, '3º LUGAR', { width: 360, height: 640 }],
      [102, '8º LUGAR', { width: 360, height: 780 }], [102, '8º LUGAR', { width: 360, height: 640 }]]) {
      const label = `corrida-faixa-lugar-${seed}-${vp.width}x${vp.height}`
      const pg = await newPage(browser, vp, label, { query: '?dev=1' })
      try {
        await abreCorrida(pg, label, seed)
        const me = await pg.evaluate(() => window.__galope.ui.lobby.playerIdx)
        if (seed === 102 && me !== 0) problems.push(`[${label}] a seed 102 pôs o jogador na raia ${me + 1} (o teste conta com a raia 1)`)
        await vigiaLugar(pg)
        await pg.getByRole('button', { name: 'x2' }).click()
        const w = await confereLugar(pg, label, esperado)
        // com o jogador na raia 1, a faixa em cima cruzaria o cavalo dele: fica no pé da pista
        if (seed === 102 && w.caixas.length && JSON.parse(w.caixas[0]).y < w.artH / 2) problems.push(`[${label}] Ruling 14: com o jogador na raia 1 a faixa do lugar ficou em cima (${w.caixas[0]})`)
        // em cima, logo abaixo da etiqueta "FOTO DE CHEGADA"; no pé, encostada na borda de baixo (sem Dado na chegada)
        const cx = w.caixas.length ? JSON.parse(w.caixas[0]) : null
        if (cx && (cx.y < w.artH / 2 ? cx.y !== w.hudH + 15 : cx.y + cx.h !== w.artH - 2)) problems.push(`[${label}] faixa do lugar fora das duas posições (${w.caixas[0]}; hudH ${w.hudH}, artH ${w.artH})`)
        await pg.waitForSelector('#t-resultado', { timeout: 30000 })
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // Review Focus 5a: "Pular" com a faixa do lugar na tela leva ao resultado sem deixar a faixa presa; pular antes de
    // cruzar nunca mostra a faixa
    {
      const label = 'corrida-faixa-lugar-pular'
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1' })
      try {
        await abreCorrida(pg, label, 12)
        await pg.getByRole('button', { name: 'x2' }).click()
        await pg.waitForFunction(() => window.RaceFx._stats.faixaLugar !== '', null, { timeout: 120000, polling: 'raf' })
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado', { timeout: 5000 })
        await sleep(300)
        const r = await pg.evaluate(() => ({ race: !!window.__galope.race, pista: !!document.getElementById('pista'), faixa: window.RaceFx._stats.faixaLugar, caixa: window.RaceFx._stats.faixaLugarCaixa }))
        notes[label] = r
        if (r.race || r.pista || r.faixa !== '' || r.caixa !== null) problems.push(`[${label}] depois de pular com a faixa do lugar na tela: ${JSON.stringify(r)}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      const label = 'corrida-faixa-lugar-pular-antes'
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1' })
      try {
        await abreCorrida(pg, label, SEED7)
        await pg.evaluate(() => {
          const w = window.__pularAntes = { quadros: 0, comFaixa: 0, cruzou: false }
          const tick = () => {
            const r = window.__galope.race
            if (!r) return
            w.quadros++
            if (window.RaceFx._stats.faixaLugar) w.comFaixa++
            if (r._state.crossed) w.cruzou = true
            requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        })
        await pg.getByRole('button', { name: 'x2' }).click()
        await esperaFracao(pg, 0.5)
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado', { timeout: 5000 })
        const w = await pg.evaluate(() => ({ ...window.__pularAntes, faixa: window.RaceFx._stats.faixaLugar }))
        notes[label] = w
        if (w.quadros < 30 || w.cruzou) problems.push(`[${label}] o teste não amostrou a corrida antes da chegada: ${JSON.stringify(w)}`)
        if (w.comFaixa || w.faixa !== '') problems.push(`[${label}] pulando antes de cruzar, a faixa do lugar apareceu em ${w.comFaixa} quadros (${JSON.stringify(w)})`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // Ruling 12 com movimento reduzido: a revelação é em t0, então a narração, o #anuncio e o painel não esperam
    {
      const label = 'corrida-dado-reduzido'
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1', reducedMotion: 'reduce' })
      try {
        await abreCorrida(pg, label, SEED7)
        if (!(await pg.evaluate(() => document.documentElement.classList.contains('mov-reduzido')))) problems.push(`[${label}] sem a classe mov-reduzido`)
        await vigiaDado(pg)
        await vigiaLugar(pg)
        await pg.getByRole('button', { name: 'x2' }).click()
        await confereVigiaDado(pg, label)
        // com movimento reduzido, o mesmo texto (aparece e some sem animação: drawPlaceBanner é parado)
        await confereLugar(pg, label, '7º LUGAR')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
  }

  // ---------------- resultado numa tela, com abas Chegada | Momentos (3c §8) ----------------
  if (quer('resultado')) {
    // seeds DEV (perfil DEV novo): 16 = 7 corredores, o jogador em 7º, sem subir de nível; 70 = vitória (7 corredores);
    // 12 = 5 corredores com o jogador em 3º (pódio sem prêmio)
    const SEED7 = 16, SEED_VITORIA = 70, SEED_SEM_PREMIO = 12
    const MIN_ENTRADA = Math.min(...G.ECONOMY.entryTiers)
    // do resultado (ou de qualquer tela com a casca) até o próximo resultado da seed; prep(pg) roda na largada
    const correAteResultado = async (pg, seed, prep) => {
      if (await pg.locator('#t-resultado').count()) { await pg.locator('[data-acao="voltar"]').click(); await pg.waitForSelector('#t-correr') }
      await devArmar(pg, { seed })
      await abrirSala(pg)
      if (prep) await prep(pg)
      await pg.getByRole('button', { name: /^Largar/ }).click()
      await pg.waitForSelector('#pista')
      await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
      await pg.waitForSelector('#t-resultado')
      await sleep(300)   // o pódio desenha o primeiro quadro
    }
    const abaRes = (pg, id) => pg.locator(`[data-acao="resultado-aba"][data-id="${id}"]`).click()
    // a tela de resultado lida do DOM e o que ela devia mostrar, do ui.result e da simulação
    const leResultado = (pg) => pg.evaluate(() => {
      const G = window.__galope, R = G.ui.result, L = G.ui.lobby, sim = L.sim
      // texto lido como o leitor de tela: sem o que é aria-hidden (o "o" do ordinal; o .sr "º" fica)
      const limpa = (el) => {
        if (!el) return null
        const c = el.cloneNode(true)
        c.querySelectorAll('[aria-hidden="true"]').forEach((x) => x.remove())
        return c.textContent.replace(/\s+/g, ' ').trim()
      }
      const fmt = (n) => Math.round(n).toLocaleString('pt-BR')
      const fmtSec = (s) => { const m = Math.floor(s / 60), r = s - m * 60, rs = r.toFixed(2).replace('.', ','); return m > 0 ? m + ':' + (r < 10 ? '0' : '') + rs : rs + 's' }
      const fmtClock = (s) => { const m = Math.floor(s / 60), r = Math.floor(s - m * 60); return m + ':' + (r < 10 ? '0' : '') + r }
      const net = R.prize - R.fee
      const prizeOf = {}
      if (R.payouts) R.payouts.prizes.forEach((p) => { prizeOf[p.racer] = p.amount })
      const winT = sim.finishTimes[sim.finishOrder[0]]
      // cada linha da Ordem de chegada: os pedaços de texto, na ordem em que aparecem
      const linhasEsperadas = sim.finishOrder.map((ri, k) => {
        const r = L.racers[ri], info = sim.racerInfo ? sim.racerInfo[ri] : null, t = sim.finishTimes[ri]
        return [(k + 1) + 'º', String(ri + 1), r.horse.name].concat(r.isPlayer ? ['VOCÊ'] : [r.name])
          .concat(['Nv ' + r.horse.level + (info ? ' · skills ' + Math.round(info.skillChance * 100) + '%' : ''), fmtSec(t),
            k === 0 ? 'vencedor' : '+' + (t - winT).toFixed(2).replace('.', ',') + 's',
            R.training ? (r.isPlayer ? '+' + R.prize : '—') : (prizeOf[ri] ? fmt(prizeOf[ri]) : '—')])
      })
      const MOM = { skill: 1, garra: 1, cansou: 1, dado: 1, clima: 1 }
      const momentosEsperados = sim.events.filter((ev) => MOM[ev.type]).map((ev) => {
        const mine = ev.type === 'dado' && ev.rolls && ev.rolls[L.playerIdx]
        return { tipo: ev.type, voce: ev.racer === L.playerIdx, hora: fmtClock(ev.t), raia: ev.racer >= 0 ? String(ev.racer + 1) : null, tirou: mine ? 'você tirou ' + mine.best : null }
      })
      // Entrada, prêmio e resultado (.balanco) e o saldo ao lado do XP (.saldo-final)
      const pares = Array.from(document.querySelectorAll('.balanco dt, .saldo-final dt')).map((dt) => [limpa(dt), limpa(dt.nextElementSibling)])
      const sub = document.querySelector('#tela .sub')
      const abas = Array.from(document.querySelectorAll('.subabas [data-acao="resultado-aba"]')).map((b) => ({ id: b.dataset.id, pressed: b.getAttribute('aria-pressed'), txt: limpa(b) }))
      const linhas = Array.from(document.querySelectorAll('.tabela tbody tr')).map((tr) => {
        const quem = tr.querySelector('.quem')
        // Ruling 17: os pedaços da 2ª linha (dono, nível, skills) — cada um numa linha só, o " ·" no fim do de cima
        const pecas = quem ? Array.from(quem.querySelectorAll('small .quem-peca')).map((e) => ({ txt: e.textContent, rects: e.getClientRects().length })) : []
        return { txt: limpa(tr), h: tr.getBoundingClientRect().height, filhos: quem ? quem.childElementCount : 0, chip: limpa(tr.querySelector('.raia--mini')), pecas }
      })
      const itens = Array.from(document.querySelectorAll('#t-dados ~ ol > li, [aria-labelledby="t-dados"] li')).map((li) => ({
        cls: li.className, hora: limpa(li.querySelector('time')), raia: limpa(li.querySelector('.raia--mini')), txt: limpa(li) }))
      const aviso = document.querySelector('.aviso--perda')
      return {
        R: { place: R.place, fee: R.fee, prize: R.prize, stone: R.stone, training: R.training, xpGain: R.xpGain, levels: R.levels, learned: R.learned, nivel: R.after.level, gold: R.after.gold, paid: R.payouts ? R.payouts.prizes.length : 3 },
        n: L.n, net, sinal: (net > 0 ? '+' : net < 0 ? '−' : '') + fmt(Math.abs(net)), saldoTxt: fmt(R.after.gold),
        manchete: limpa(document.getElementById('t-resultado')), sub: sub ? limpa(sub) : null, pares,
        xp: limpa(document.querySelector('.resultado-xp')), levelup: Array.from(document.querySelectorAll('.levelup')).map(limpa),
        aviso: aviso ? limpa(aviso) : null, abas, linhas, linhasEsperadas, itens, momentosEsperados,
        chegada: !!document.getElementById('t-chegada'), dados: !!document.getElementById('t-dados'),
        notaDado: Array.from(document.querySelectorAll('[aria-labelledby="t-chegada"] .nota')).map(limpa).join(' | '),
        notaVazia: Array.from(document.querySelectorAll('#tela .nota')).map(limpa).filter((t) => /Nenhum momento/.test(t)),
        foco: document.activeElement ? (document.activeElement.dataset.acao || '') + ':' + (document.activeElement.dataset.id || '') : null,
        skillNomes: R.learned.map((id) => (window.GameData.SKILLS[id] ? window.GameData.SKILLS[id].name : id))
      }
    })
    // manchete, frase, entrada, prêmio, resultado, saldo e XP com os valores do ui.result
    const confereCabeca = (r, label) => {
      const ruim = (m) => problems.push(`[${label}] ${m}`)
      const head = r.R.place === 1 ? `Vitória! 1º de ${r.n}` : `Você chegou em ${r.R.place}º de ${r.n}`
      if (r.manchete !== head) ruim(`manchete ${JSON.stringify(r.manchete)} (esperado ${JSON.stringify(head)})`)
      const semPremio = !r.R.training && r.R.place > r.R.paid && r.R.place <= 3
      const frase = semPremio ? `Pódio sem prêmio: com ${r.n} corredores só 1º e 2º são pagos.` : null
      if (r.sub !== frase) ruim(`frase embaixo da manchete ${JSON.stringify(r.sub)} (esperado ${JSON.stringify(frase)})`)
      const esperado = r.R.training
        ? [['Entrada', 'Treino, sem aposta'], ['Ouro do treino', '+' + r.R.prize]]
        : [['Entrada', '−' + r.R.fee], [`Prêmio (${r.R.place}º lugar)`, r.R.prize ? '+' + r.R.prize : '0'], ['Resultado', r.sinal]]
      if (r.R.stone) esperado.push(['Pedra Negra', '+' + r.R.stone])
      esperado.push(['Saldo', r.saldoTxt + 'Ouro'])   // ouroHtml: o número e o .sr "Ouro" colados
      if (JSON.stringify(r.pares) !== JSON.stringify(esperado)) ruim(`balanço ${JSON.stringify(r.pares)} (esperado ${JSON.stringify(esperado)})`)
      if (!r.xp || !r.xp.includes(`+${r.R.xpGain} XP`)) ruim(`XP ${JSON.stringify(r.xp)} sem "+${r.R.xpGain} XP"`)
      const sobe = r.R.levels > 0 ? [`Subiu para o nível ${r.R.nivel}!`] : []
      if (r.R.learned.length) sobe.push(`Nova skill: ${r.skillNomes.join(', ')}!`)
      if (r.levelup.length !== sobe.length || sobe.some((s, i) => !r.levelup[i].startsWith(s))) ruim(`avisos de nível/skill ${JSON.stringify(r.levelup)} (esperado ${JSON.stringify(sobe)})`)
    }
    // aba Chegada aberta: a tabela com os dados de hoje, em 2 linhas de texto na célula do cavalo, e a nota do Dado
    const confereChegada = (r, label) => {
      const ruim = (m) => problems.push(`[${label}] ${m}`)
      if (r.abas.map((a) => a.id + '=' + a.pressed).join() !== 'chegada=true,momentos=false' || r.abas.map((a) => a.txt).join() !== 'Chegada,Momentos') ruim(`abas ${JSON.stringify(r.abas)} (esperado Chegada marcada)`)
      if (!r.chegada || r.dados) ruim(`na aba Chegada: Ordem de chegada ${r.chegada}, Momentos ${r.dados}`)
      if (r.linhas.length !== r.n) ruim(`tabela com ${r.linhas.length} linhas (esperado ${r.n})`)
      r.linhas.forEach((l, k) => {
        const exp = r.linhasEsperadas[k]
        let de = 0
        for (const p of exp) { const i = l.txt.indexOf(p, de); if (i < 0) { ruim(`linha ${k + 1}: ${JSON.stringify(l.txt)} sem ${JSON.stringify(p)} (na ordem ${JSON.stringify(exp)})`); break } de = i + p.length }
        if (l.chip !== exp[1]) ruim(`linha ${k + 1}: raia ${l.chip} (esperado ${exp[1]})`)
        if (l.h > 70) ruim(`linha ${k + 1} com ${l.h.toFixed(1)} px de altura (máximo 70)`)
        if (l.filhos !== 2) ruim(`linha ${k + 1}: a célula do cavalo com ${l.filhos} linhas de texto (esperado 2: nome; dono, nível e skills)`)
        const nPecas = exp.includes('VOCÊ') ? 2 : 3
        if (l.pecas.length !== nPecas || l.pecas.some((p) => p.rects !== 1) || l.pecas.some((p, i) => (i < l.pecas.length - 1) !== / ·$/.test(p.txt)))
          ruim(`linha ${k + 1}: pedaços de dono, nível e skills ${JSON.stringify(l.pecas)} (esperado ${nPecas}, cada um numa linha, o " ·" no fim de todos menos o último)`)
      })
      if (!/Dado da Sorte: a 1\/3 e 2\/3 da pista o maior dado puxa o clima para o elemento de quem tirou\./.test(r.notaDado)) ruim(`nota do Dado ausente na aba Chegada: ${JSON.stringify(r.notaDado)}`)
    }
    // aba Momentos aberta: a lista com os mesmos itens de hoje (tipo, hora, raia, destaque do jogador, o "você tirou")
    const confereMomentos = (r, label) => {
      const ruim = (m) => problems.push(`[${label}] ${m}`)
      if (r.abas.map((a) => a.id + '=' + a.pressed).join() !== 'chegada=false,momentos=true') ruim(`abas ${JSON.stringify(r.abas)} (esperado Momentos marcada)`)
      if (r.chegada || r.linhas.length) ruim('a tabela da Ordem de chegada continua na aba Momentos')
      if (!r.momentosEsperados.length) {
        if (r.dados || r.itens.length || r.notaVazia.join() !== 'Nenhum momento marcante nesta corrida.') ruim(`corrida sem momentos: ${JSON.stringify({ dados: r.dados, itens: r.itens.length, nota: r.notaVazia })}`)
        return
      }
      if (!r.dados || r.notaVazia.length) ruim(`aba Momentos sem a lista (t-dados ${r.dados}) ou com a frase de vazio`)
      if (r.itens.length !== r.momentosEsperados.length) ruim(`${r.itens.length} momentos (esperado ${r.momentosEsperados.length})`)
      r.momentosEsperados.forEach((e, k) => {
        const it = r.itens[k]
        if (!it || !it.cls.split(' ').includes('tipo-' + e.tipo) || it.cls.split(' ').includes('voce') !== e.voce || it.hora !== e.hora || it.raia !== e.raia || (e.tirou && !it.txt.includes(e.tirou)))
          ruim(`momento ${k + 1}: ${JSON.stringify(it)} (esperado ${JSON.stringify(e)})`)
      })
    }
    // caixas na ordem da página, sem se sobrepor (Review Focus 5b)
    const blocosEmOrdem = (pg) => pg.evaluate(() => {
      const sels = ['.podio-palco', '#t-resultado', '.balanco', '.resultado-xp', '.levelup', '.aviso--perda', '.acoes', '.subabas', '[aria-labelledby="t-chegada"], [aria-labelledby="t-dados"]']
      const out = []
      sels.forEach((s) => document.querySelectorAll(s).forEach((el) => { const b = el.getBoundingClientRect(); out.push({ s, top: b.top + scrollY, bottom: b.bottom + scrollY }) }))
      return out
    })
    const confereOrdem = (bl, label, comAvisos) => {
      const ruim = (m) => problems.push(`[${label}] ${m}`)
      for (let i = 1; i < bl.length; i++) if (bl[i].top < bl[i - 1].bottom - 0.5) ruim(`${bl[i].s} (topo ${bl[i].top.toFixed(1)}) sobrepõe ${bl[i - 1].s} (fundo ${bl[i - 1].bottom.toFixed(1)})`)
      if (comAvisos) {
        const ac = bl.find((b) => b.s === '.acoes'), av = bl.filter((b) => b.s === '.levelup' || b.s === '.aviso--perda')
        if (av.length < 3 || !ac || av.some((b) => b.bottom > ac.top + 0.5)) ruim(`avisos (${av.length}) não estão todos acima dos botões ${JSON.stringify(bl)}`)
      }
    }
    // "Correr de novo"/"Treino gratuito" e "Voltar" lado a lado, com ≥ 44 px
    const confereBotoes = async (pg, label, primeiro) => {
      const b = await pg.evaluate((p) => [p, 'voltar'].map((a) => { const el = document.querySelector(`.acoes [data-acao="${a}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), h: r.height } }), primeiro)
      if (!b[0] || !b[1] || Math.abs(b[0].top - b[1].top) > 1 || b[0].h < 44 || b[1].h < 44) problems.push(`[${label}] botões ${primeiro} e voltar fora de uma linha ou baixos: ${JSON.stringify(b)}`)
    }
    // pódio: os três cavalos inteiros no canvas, sem sobrepor, o 1º maior (window.__galope.podio, em px de CSS do canvas)
    const conferePodio = async (pg, label) => {
      const p = await pg.evaluate(() => { const cv = document.querySelector('canvas[data-podio]').getBoundingClientRect(); return { w: cv.width, h: cv.height, caixas: window.__galope.podio } })
      const ruim = (m) => problems.push(`[${label}] pódio: ${m} ${JSON.stringify(p)}`)
      if (!p.caixas || p.caixas.length !== 3) { ruim('registro window.__galope.podio sem os três cavalos'); return p }
      const por = (n) => p.caixas.find((c) => c.lugar === n)
      if (!por(1) || !por(2) || !por(3)) { ruim('lugares 1, 2 e 3 não estão no registro'); return p }
      for (const c of p.caixas) if (c.x < -0.01 || c.y < -0.01 || c.x + c.w > p.w + 0.01 || c.y + c.h > p.h + 0.01) ruim(`cavalo do ${c.lugar}º fora do canvas`)
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
        const a = p.caixas[i], b = p.caixas[j]
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) ruim(`caixas do ${a.lugar}º e do ${b.lugar}º se sobrepõem`)
      }
      const g = por(1)
      for (const o of [por(2), por(3)]) if (!(g.escala > o.escala && g.w > o.w && g.h > o.h)) ruim(`o 1º não é maior que o ${o.lugar}º`)
      if (p.w !== 336) ruim(`canvas com ${p.w} px de largura (esperado 336)`)
      return p
    }

    // caso base a 360×780: 7 corredores, sem subir de nível
    {
      const label = 'resultado-360'
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await correAteResultado(pg, SEED7)
        let r = await leResultado(pg)
        if (r.n !== 7 || r.R.levels !== 0 || r.R.learned.length || r.R.gold < MIN_ENTRADA) problems.push(`[${label}] a seed ${SEED7} não deu o caso base (7 corredores, sem nível): ${JSON.stringify(r.R)}`)
        const tela = await pg.evaluate(() => ({ y: scrollY, vh: innerHeight, sub: document.querySelector('.subabas').getBoundingClientRect().bottom, doc: document.documentElement.scrollHeight }))
        if (tela.y !== 0 || tela.sub > tela.vh) problems.push(`[${label}] as abas não estão na primeira tela: fundo ${tela.sub.toFixed(1)} > ${tela.vh} (scrollY ${tela.y})`)
        if (tela.doc > 1500) problems.push(`[${label}] documento com ${tela.doc} px de altura na aba Chegada (máximo 1.500)`)
        confereCabeca(r, label)
        confereChegada(r, label)
        confereOrdem(await blocosEmOrdem(pg), label, false)
        await confereBotoes(pg, label, 'denovo')
        const podio = await conferePodio(pg, label)
        await checkOverflow(pg, label)
        await abaRes(pg, 'momentos')
        r = await leResultado(pg)
        confereMomentos(r, label + ' momentos')
        confereCabeca(r, label + ' momentos')
        if (r.foco !== 'resultado-aba:momentos') problems.push(`[${label}] o foco não ficou na aba Momentos depois do clique (${r.foco})`)
        const docM = await pg.evaluate(() => document.documentElement.scrollHeight)
        await checkOverflow(pg, label + ' momentos')
        await abaRes(pg, 'chegada')
        r = await leResultado(pg)
        confereChegada(r, label + ' volta')
        notes[label] = { ...tela, docMomentos: docM, linhas: r.linhas.map((l) => +l.h.toFixed(1)), podio }
        // um resultado novo abre de novo em Chegada (a vitória, que tem frase de enfeite hoje: sai)
        await abaRes(pg, 'momentos')
        await correAteResultado(pg, SEED_VITORIA)
        r = await leResultado(pg)
        if (r.R.place !== 1 || r.n !== 7) problems.push(`[${label}] a seed ${SEED_VITORIA} não deu vitória com 7: ${JSON.stringify(r.R)}`)
        confereCabeca(r, label + ' vitória')
        confereChegada(r, label + ' vitória')
        await conferePodio(pg, label + ' vitória')
        // corrida sem momentos (nenhuma seed os zera: os Dados sempre acontecem; a lista sai só do sim.events, que aqui
        // perde os momentos antes do redesenho da aba)
        await pg.evaluate(() => { const MOM = { skill: 1, garra: 1, cansou: 1, dado: 1, clima: 1 }, sim = window.__galope.ui.lobby.sim; sim.events = sim.events.filter((e) => !MOM[e.type]) })
        await abaRes(pg, 'momentos')
        confereMomentos(await leResultado(pg), label + ' sem momentos')
        // pódio sem prêmio: a única frase que fica embaixo da manchete
        await correAteResultado(pg, SEED_SEM_PREMIO)
        r = await leResultado(pg)
        if (r.R.place !== 3 || r.R.paid !== 2) problems.push(`[${label}] a seed ${SEED_SEM_PREMIO} não deu pódio sem prêmio: ${JSON.stringify(r.R)} n ${r.n}`)
        confereCabeca(r, label + ' sem prêmio')
        confereChegada(r, label + ' sem prêmio')
        await conferePodio(pg, label + ' sem prêmio')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // Review Focus 5b: nível, skill nova e Ouro abaixo da menor entrada na mesma corrida
    {
      const label = 'resultado-rf5b'
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await correAteResultado(pg, SEED7, (p) => p.evaluate((g) => {
          const G = window.__galope
          G.ui.dev.ouroInf = false; G.state.gold = g; G.state.mounts[0].xp += 1e7   // sobe até o nível máximo: 49 chances de skill
        }, MIN_ENTRADA))
        const r = await leResultado(pg)
        if (!(r.R.levels > 0) || !r.R.learned.length || !(r.R.gold < MIN_ENTRADA)) problems.push(`[${label}] o save não deu nível, skill nova e Ouro abaixo de ${MIN_ENTRADA}: ${JSON.stringify(r.R)}`)
        if (!r.aviso || !r.aviso.includes(`abaixo da menor entrada (${MIN_ENTRADA})`)) problems.push(`[${label}] sem o aviso de Ouro acabado: ${JSON.stringify(r.aviso)}`)
        confereCabeca(r, label)
        confereChegada(r, label)
        confereOrdem(await blocosEmOrdem(pg), label, true)
        await confereBotoes(pg, label, 'treino')
        const rola = await pg.evaluate(() => ({ doc: document.documentElement.scrollHeight, vh: innerHeight }))
        if (!(rola.doc > rola.vh)) problems.push(`[${label}] a tela não rola (${JSON.stringify(rola)})`)
        // as abas trocam com a tela rolada, sem perder a rolagem
        await pg.locator('.subabas').scrollIntoViewIfNeeded()
        await pg.evaluate(() => scrollBy(0, 120))
        const y0 = await pg.evaluate(() => scrollY)
        await abaRes(pg, 'momentos')
        const m = await leResultado(pg)
        confereMomentos(m, label + ' momentos')
        confereOrdem(await blocosEmOrdem(pg), label + ' momentos', true)
        const y1 = await pg.evaluate(() => scrollY)
        if (!(y0 > 0) || Math.abs(y1 - y0) > 1) problems.push(`[${label}] a troca de aba com a tela rolada mexeu na rolagem (${y0} → ${y1})`)
        await abaRes(pg, 'chegada')
        confereChegada(await leResultado(pg), label + ' volta')
        await checkOverflow(pg, label)
        notes[label] = { ...rola, y0, y1 }
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 1280: a mesma tela, sem rolagem lateral, botões lado a lado
    {
      const label = 'resultado-1280'
      const pg = await newPage(browser, { width: 1280, height: 800 }, label, { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await correAteResultado(pg, SEED7)
        const r = await leResultado(pg)
        confereCabeca(r, label)
        confereChegada(r, label)
        await confereBotoes(pg, label, 'denovo')
        await conferePodio(pg, label)
        await checkOverflow(pg, label)
        await abaRes(pg, 'momentos')
        confereMomentos(await leResultado(pg), label + ' momentos')
        await checkOverflow(pg, label + ' momentos')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // cores forçadas: a aba atual com Highlight, a outra com borda em cor do sistema
    {
      const label = 'resultado-forcado'
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1', forcedColors: 'active' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await correAteResultado(pg, SEED7)
        for (const atual of ['chegada', 'momentos']) {
          if (atual === 'momentos') await abaRes(pg, 'momentos')
          const fc = await pg.evaluate(() => {
            const sonda = (c) => { const d = document.createElement('i'); d.style.border = '2px solid ' + c; document.body.appendChild(d); const v = getComputedStyle(d).borderTopColor; d.remove(); return v }
            return { ativo: matchMedia('(forced-colors: active)').matches, hl: sonda('Highlight'), bt: sonda('ButtonText'),
              abas: Array.from(document.querySelectorAll('.subabas [data-acao="resultado-aba"]')).map((b) => { const cs = getComputedStyle(b); return { id: b.dataset.id, pressed: b.getAttribute('aria-pressed'), w: cs.borderTopWidth, c: cs.borderTopColor } }) }
          })
          if (!fc.ativo) problems.push(`[${label}] a página não está em cores forçadas`)
          for (const a of fc.abas) {
            const quer = a.id === atual ? fc.hl : fc.bt
            if (a.w !== '2px' || a.c !== quer || a.pressed !== String(a.id === atual)) problems.push(`[${label}] aba ${a.id} com ${atual} aberta: ${JSON.stringify(a)} (esperado borda 2px ${quer})`)
          }
          if (fc.abas.length !== 2) problems.push(`[${label}] ${fc.abas.length} abas`)
          notes[label + '-' + atual] = fc
        }
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
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
  // cavalo de teste: Comum ★★ nível 50 com genética 31 (base 56 em cada status; 213 pontos, 6 deles em Velocidade).
  // Era o do teto da raridade (80) no bloco 1; no 1b o teto é 150 para todos e ninguém chega lá com os pontos.
  const TETO_M2 = { uid: 'm2', templateId: null, name: 'Teto', especie: 'cavalo', element: 'agua', rarity: 'comum', grau: 2, sex: 'f', level: 50, xp: 0, skills: [],
    potential: { vel: 31, acel: 31, man: 31, forca: 31, est: 31, garra: 31, sorte: 31 }, alloc: { vel: 6, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 },
    palette: null, breedLeft: 2, parents: null, born: 0, equip: {} }
  // o selo "+N" do Estábulo (spec 1b §11, rodada de correção 1 da T3): os pontos que sobram, o mesmo número do topo da aba
  // Status, enquanto algum status aceita mais um ponto (abaixo do teto, fora da Sorte e com o próximo ponto cabendo no que
  // sobra); senão 0 (sem selo). Conta feita aqui sem o room do jogo
  const podeComprar = (m) => {
    const info = S.allocInfo(m), nb = S.TUNING.noBuy || []
    const cabe = G.STAT_KEYS.some((k) => !nb.includes(k) && info.perStat[k] < S.maxBuy(m, k) && S.pointCost(info.perStat[k]) <= info.left)
    return cabe ? info.left : 0
  }
  // o efeito da skill de tipo em pontos para o cavalo (spec 1b §5): status × statMul·P nos dois status do tipo, dos status
  // atuais; "Velocidade e Aceleração +N no 1º terço" (um número para cada status quando os dois diferem)
  const efeitoTipoPontos = (m) => {
    const ts = S.typeSkill(m), e = G.TYPE_SKILLS[m.element].effect, keys = e.statKeys || S.TYPE_STATS[m.element]
    const st = S.computeStats(m), g = keys.map((k) => Math.round(st[k] * e.statMul * ts.power)), nomes = keys.map((k) => G.STATS[k].name)
    const onde = ` no ${['1º', '2º', '3º'][Math.round(ts.zone[0] * 3)]} terço`
    return g[0] === g[1] ? `${nomes.join(' e ')} +${g[0]}${onde}` : `${nomes[0]} +${g[0]} e ${nomes[1]} +${g[1]}${onde}`
  }
  // o title e o aria-label de um botão "+N" (spec 1b §11): "+5 em Velocidade: custa 15 pontos", a partir dos pontos a
  const tituloMais = (a, k, n) => { const c = S.costOf(a[k] + n) - S.costOf(a[k]); return `+${n} em ${G.STATS[k].name}: custa ${c} ${c === 1 ? 'ponto' : 'pontos'}` }

  if (quer('build')) {
    const bd = await newPage(browser, { width: 360, height: 780 }, 'build', { init: { content: 'window.confirm = function () { window.__confirmou = true; return true }; window.alert = function () { window.__confirmou = true }' } })
    const st = () => bd.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    const disco = () => bd.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_REAL)
    const rascunho = () => bd.evaluate(() => { const r = window.__galope.ui.rascunho; return r ? JSON.parse(JSON.stringify(r)) : null })
    // +N de um status (bloco 1b: +1, +5 e +10)
    const mais = (k, n = 1) => bd.locator(`[data-acao="ponto-mais"][data-id="${k}"][data-n="${n}"]`)
    const topoTxt = async () => ((await bd.locator('.build-topo').textContent().catch(() => '')) || '').replace(/\s+/g, ' ')
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
      // Brasa Comum ★★ nível 12: 28 pontos, todos a 1 (nenhum status com 10 comprados); m2: Comum ★★ nível 50 (213 pontos)
      await montaSave(bd, (raw) => { raw.mounts[0].level = 12; raw.mounts.push(JSON.parse(JSON.stringify(TETO_M2))); raw.nextUid = 3; raw.stableSlots = 3 })
      await abreMontaria('m1')
      const s0 = await st(), d0 = await disco(), m0 = s0.mounts[0], livres0 = S.freePoints(m0)
      if (livres0 !== 28) problems.push('build: a Brasa nível 12 de teste tem ' + livres0 + ' pontos (esperado 28)')
      if (!(await topoTxt()).includes(`Pontos: sobram ${livres0} de ${livres0}`)) problems.push(`build: topo da aba Status sem "Pontos: sobram ${livres0} de ${livres0}": ` + await topoTxt())
      // uma linha por status com nota de genética e barra; +1, +5 e +10 nos seis de corrida; a Sorte sem botões
      const linhas = await bd.evaluate(() => Array.from(document.querySelectorAll('[data-status]')).map((l) => ({
        k: l.getAttribute('data-status'), nota: (l.querySelector('.nota-genetica') || {}).textContent, barra: !!l.querySelector('.barra'),
        mais: Array.from(l.querySelectorAll('[data-acao="ponto-mais"]')).map((b) => b.getAttribute('data-n')).join(',')
      })))
      if (linhas.length !== 7) problems.push('build: ' + linhas.length + ' linhas de status (esperado 7)')
      for (const l of linhas) {
        if (l.nota !== nota(m0.potential[l.k])) problems.push(`build: nota de genética de ${l.k} = ${l.nota} (genética ${m0.potential[l.k]}: ${nota(m0.potential[l.k])})`)
        if (!l.barra || l.mais !== (l.k === 'sorte' ? '' : '1,5,10')) problems.push('build: linha sem barra ou com os botões errados ' + JSON.stringify(l))
      }
      await confereLegivel(bd, ['.pontos-livres', '.nota-genetica', '.selo-nivel', '[data-status]'], 'build-360')
      // capturas oficiais (só na rodada completa): aba Status com os pontos e aba Skills com a vaga de tipo
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
      // custo por faixa (no lugar do limite de 34% por status): +10 em Velocidade custa 10; o +10 seguinte custaria 20 e
      // não cabe nos 18 que sobram (desabilitado, "Faltam pontos"); o +5 custa 10 e cabe
      await mais('vel', 10).click()
      if (!(await indisp(mais('vel', 10))) || !/custa 20 pontos\. Faltam pontos: sobram 18\./.test((await mais('vel', 10).getAttribute('title')) || '')) problems.push('build: o 2º +10 em Velocidade (custa 20, sobram 18) não está desabilitado com o motivo: ' + await mais('vel', 10).getAttribute('title'))
      if (await mais('vel', 5).isDisabled()) problems.push('build: +5 em Velocidade (custa 10, sobram 18) desabilitado')
      await mais('vel', 5).click()
      let r = await rascunho()
      if (!r || r.vel !== 15) problems.push('build: rascunho depois de +10 e +5 ' + JSON.stringify(r))
      if (JSON.stringify((await st()).mounts[0].alloc) !== JSON.stringify(m0.alloc) || JSON.stringify(await disco()) !== JSON.stringify(d0)) problems.push('build: o rascunho chegou ao save antes de confirmar')
      if ((await poderNaCabeca(bd)) !== poder0) problems.push('build: o Poder da cabeça mudou com o rascunho')
      await capT6(bd, 'build-360-rascunho.png', true)
      if (!(await topoTxt()).includes(`sobram 8 de ${livres0}`)) problems.push('build: os pontos que sobram não descontam o custo do rascunho (10 + 10): ' + await topoTxt())
      if (!/próximo ponto custa\s2$/.test(await bd.locator('[data-status="vel"] .build-custo').textContent())) problems.push('build: com 15 em Velocidade, o próximo ponto não custa 2')
      // Desfazer limpa o rascunho
      await bd.locator('[data-acao="pontos-desfazer"]').click()
      r = await rascunho()
      if (r && G.STAT_KEYS.some((k) => r[k])) problems.push('build: Desfazer não limpou o rascunho ' + JSON.stringify(r))
      if ((await mais('vel', 10).isDisabled())) problems.push('build: o +10 de Velocidade não voltou depois de Desfazer')
      // Confirmar: o primeiro toque só avisa (como mudar depois); com a gravação falhando, nada muda
      await mais('vel').click(); await mais('vel').click(); await mais('acel').click()
      await bd.locator('[data-acao="pontos-confirmar"]').click()
      const aviso = ((await bd.locator('#tela').textContent()) || '')
      await capT6(bd, 'build-360-confirma.png', true)
      if (!aviso.includes('Para mudar depois, use Redistribuir (a primeira deste cavalo é grátis).')) problems.push('build: o primeiro "Confirmar" não avisou como mudar depois (Redistribuir)')
      if (/não dá para voltar atrás/i.test(aviso)) problems.push('build: o primeiro "Confirmar" ainda diz que não dá para voltar atrás')
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
      const st0 = S.computeStats(m0), st1 = S.computeStats(s.mounts[0])
      if (st1.vel !== st0.vel + 2 || st1.acel !== st0.acel + 1) problems.push('build: os status não subiram com os pontos ' + JSON.stringify({ st0, st1 }))
      const poder1 = await poderNaCabeca(bd)
      if (!(poder1 > poder0) || poder1 !== S.powerRating(s.mounts[0])) problems.push(`build: Poder depois de confirmar ${poder0} -> ${poder1}`)
      if (await rascunho()) problems.push('build: o rascunho ficou depois de gravar')
      // clique forjado fora da aba Status (na aba Skills; a Equipamento está suspensa): +N, sugerido e Confirmar não fazem nada
      await bd.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
      const forja = (acao, idf, n) => bd.evaluate(([a, i, nn]) => {
        const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-acao', a); if (i) b.setAttribute('data-id', i); if (nn) b.setAttribute('data-n', nn)
        document.getElementById('tela').appendChild(b); b.click(); b.remove()
      }, [acao, idf, n])
      await forja('ponto-mais', 'man', '1')
      await forja('pontos-sugerir')
      if (await rascunho()) problems.push('build: +N ou "Distribuir sugerido" forjado fora da aba Status entrou no rascunho ' + JSON.stringify(await rascunho()))
      const allocAntes = JSON.stringify((await st()).mounts[0].alloc)
      await bd.evaluate(() => { const M = window.__galope.ui.montaria; M.rascunho = { vel: 0, acel: 0, man: 1, forca: 0, est: 0, garra: 0, sorte: 0 }; M.confirmaPontos = true })
      await forja('pontos-confirmar')
      if (JSON.stringify((await st()).mounts[0].alloc) !== allocAntes) problems.push('build: "Confirmar" forjado fora da aba Status gravou pontos')
      await bd.evaluate(() => { const M = window.__galope.ui.montaria; M.rascunho = null; M.confirmaPontos = false })
      await bd.locator('[data-acao="montaria-aba"][data-id="status"]').click()
      // +N forjado com N fora de 1, 5 e 10 (ou sem N) não faz nada
      for (const nf of ['3', '100', '']) await forja('ponto-mais', 'man', nf)
      if (await rascunho()) problems.push('build: +N forjado com N fora de 1/5/10 entrou no rascunho ' + JSON.stringify(await rascunho()))
      // sair da tela descarta o rascunho
      await mais('man').click()
      await bd.locator('[data-acao="montaria-voltar"]').click()
      await bd.waitForSelector('#t-estabulo')
      await abreMontaria('m1')
      if (await rascunho()) problems.push('build: o rascunho voltou depois de sair da tela')
      if ((await st()).mounts[0].alloc.man !== 0) problems.push('build: sair da tela gravou o rascunho')
      // sem o teto da raridade (bloco 1b): m2, Comum de genética 31 com 6 pontos em Velocidade (62, que era o teto 80 de
      // 74,6), passa de 80 em Aceleração (56 + 30) e o custo sobe a cada 10 pontos (1, 2, 3 e o 31º a 4)
      await abreMontaria('m2')
      for (let i = 0; i < 3; i++) await mais('acel', 10).click()
      if ((await rascunho() || {}).acel !== 30) problems.push('build: m2 sem o teto da raridade não aceitou +30 em Aceleração ' + JSON.stringify(await rascunho()))
      const valorAcel = ((await bd.locator('[data-status="acel"] .valor').textContent()) || ''), custoAcel = ((await bd.locator('[data-status="acel"] .build-custo').textContent()) || '')
      if (!/^86\D/.test(valorAcel) || !/próximo ponto custa\s4$/.test(custoAcel)) problems.push(`build: m2 com +30 em Aceleração: "${valorAcel}", "${custoAcel}" (esperado 86 e o próximo ponto a 4)`)
      await bd.locator('[data-acao="pontos-desfazer"]').click()
      // sala aberta: na ativa, o +N que passaria do Poder da sala não vale; na outra, segue livre
      const sala = await abrirSala(bd)
      let pr = (await st()).pending.pr
      await bd.getByRole('button', { name: /^Voltar/ }).click()
      await abreMontaria('m1')
      if (!/Páreo aberto/.test((await bd.locator('#tela').textContent()) || '')) problems.push('build: sala aberta sem o aviso do Poder da sala na aba Status')
      // cada +N habilitado tem de caber no Poder da sala; o +1 de Velocidade, não (todo ponto sobe o Poder arredondado)
      const confereSala = async (onde) => {
        const mAb = (await st()).mounts[0]
        const bs = await bd.evaluate(() => Array.from(document.querySelectorAll('[data-acao="ponto-mais"]')).map((b) => ({ k: b.getAttribute('data-id'), n: Number(b.getAttribute('data-n')), off: b.getAttribute('aria-disabled') === 'true', nativo: b.disabled, title: b.getAttribute('title') })))
      if (bs.some((b) => b.nativo)) problems.push('ponto-mais com disabled nativo (devia ser só aria-disabled): ' + JSON.stringify(bs.filter((b) => b.nativo)))
        for (const b of bs) {
          const h2 = JSON.parse(JSON.stringify(mAb)); h2.alloc[b.k] += b.n
          if (!b.off && S.powerRating(h2) > pr) problems.push(`build: ${onde}: o +${b.n} de ${b.k} habilitado passaria do Poder ${pr}`)
          if (b.off && S.powerRating(h2) > pr && !/Páreo aberto: passaria do Poder/.test(b.title || '')) problems.push(`build: ${onde}: o +${b.n} de ${b.k} desabilitado sem o motivo do páreo: ${b.title}`)
        }
      }
      await confereSala('sala aberta')
      if (!(await indisp(mais('vel')))) problems.push('build: com a sala aberta, o +1 de Velocidade da ativa está habilitado')
      await bd.evaluate(() => { const b = document.querySelector('[data-acao="ponto-mais"][data-id="vel"][data-n="1"]'); if (b) { b.disabled = false; b.removeAttribute('aria-disabled'); b.click() } })   // botão forçado: a regra vale no clique
      if (await rascunho()) problems.push('build: com a sala aberta, o clique forçado entrou no rascunho')
      // o Poder da sala sai do retrato dos pontos (R16). Sem equipamento, não há como baixar o Poder da ativa com a sala
      // aberta; o teste monta um retrato com +5 em Velocidade (no lugar das ferraduras do bloco 1): aí cabem até 5 pontos
      // em Velocidade, e o +10 continua barrado
      await montaSave(bd, (raw) => { raw.pending.alloc = Object.assign({}, raw.mounts[0].alloc, { vel: raw.mounts[0].alloc.vel + 5 }) })
      pr = (await st()).pending.pr
      const mRet = (await st()).mounts[0], hRet = JSON.parse(JSON.stringify(mRet)); hRet.alloc.vel += 5
      if (pr !== S.powerRating(hRet)) problems.push(`build: o Poder da sala ${pr} não é o do retrato com +5 em Velocidade (${S.powerRating(hRet)})`)
      await abreMontaria('m1')
      await confereSala('retrato com +5')
      if (await mais('vel', 5).isDisabled()) problems.push('build: com o retrato de +5, o +5 de Velocidade está desabilitado')
      if (!(await indisp(mais('vel', 10)))) problems.push('build: com o retrato de +5, o +10 de Velocidade está habilitado')
      await mais('vel', 5).click()
      await bd.locator('[data-acao="pontos-confirmar"]').click()
      await bd.locator('[data-acao="pontos-confirmar"]').click()
      s = await st()
      if (S.powerRating(s.mounts[0]) > pr) problems.push('build: pontos com a sala aberta passaram do Poder da sala')
      if (s.mounts[0].alloc.vel !== 7) problems.push('build: pontos com a sala aberta não gravaram ' + JSON.stringify(s.mounts[0].alloc))
      // recarregar (duas vezes) não muda a sala: o Poder dela sai do retrato dos pontos de quando abriu (R16)
      const salaFina = () => bd.evaluate(() => {
        const L = window.__galope.ui.lobby
        return JSON.stringify({ seed: L.seed, counter: L.counter, pr: window.__galope.state.pending.pr, dist: L.cond.distance,
          rivais: L.racers.map((x) => (x.isPlayer ? 'VOCE' : x.horse.id + ':Nv' + x.horse.level + ':P' + x.rating)) })
      })
      const salaRet = await abrirSala(bd)
      const fina0 = await salaFina()
      for (let i = 1; i <= 2; i++) {
        await bd.reload({ waitUntil: 'domcontentloaded' })
        await bd.waitForSelector('#t-estabulo')
        await abrirSala(bd)
        const fina = await salaFina()
        if (fina !== fina0) problems.push(`build: recarregar (${i}ª vez) depois dos pontos com a sala aberta mudou a sala: ${fina0} -> ${fina}`)
      }
      if ((await st()).pending.pr !== pr) problems.push(`build: depois de recarregar, o Poder da sala ${(await st()).pending.pr} != ${pr}`)
      await bd.getByRole('button', { name: /^Voltar/ }).click()
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
      // mesma sala (seed, páreo e mapa); os rivais mudaram uma vez, com o retrato montado pelo teste (o Poder da sala
      // subiu), e daí em diante o ponto em outra montaria não mexe neles (CLAUDE.md §8)
      for (const k of ['seed', 'counter', 'blocks']) if (sala[k] !== sala2[k]) problems.push(`build: a sala mudou (${k})`)
      if (sala2.rivais !== salaRet.rivais) problems.push(`build: o ponto na outra montaria mudou os rivais da sala: ${salaRet.rivais} -> ${sala2.rivais}`)
      if (await bd.evaluate(() => !!window.__confirmou)) problems.push('build: usou window.confirm/alert')
    } catch (e) {
      problems.push('build: ' + e.message)
    }
    await bd.context().close()
  }

  // ---------------- valor da peça: a tela mostra o mesmo número que a simulação usa (Gear.resolve, plusStep 0,5) ----------------
  // Só com o equipamento ligado: suspenso (GEAR_ON = false), não há sub-aba Equipamento nem Loja para mostrar as peças
  // (o bloco crescimento confere que elas não aparecem).
  if (quer('valor-peca') && !GEAR_ON) notes['valor-peca'] = 'pulado: equipamento suspenso (GEAR_ON = false, spec 1b §8)'
  if (quer('valor-peca') && GEAR_ON) {
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
      // Brasa ★★ 2 -> 3: nada cresce sozinho (nenhum status muda), mas ganha os pontos do nível (2 -> 4: +2)
      const brasa = G.STARTERS.find((h) => h.id === 'brasa')
      const ganho3 = S.freePoints({ ...brasa, level: 3 }) - S.freePoints({ ...brasa, level: 2 })
      await montaSave(np, (raw) => { raw.mounts[0].level = 2; raw.mounts[0].xp = G.ECONOMY.xpToLevel(2) - 1 })
      const t1 = await corre()
      if (!/Subiu para o nível 3/.test(t1)) problems.push('nivel-pontos: sem o aviso de nível 3: ' + t1)
      if (ganho3 !== 2 || !t1.includes(`+${ganho3} pontos livres`) || !/aba Status/.test(t1)) problems.push(`nivel-pontos: 2 -> 3 não fala dos ${ganho3} pontos livres ganhos nem da aba Status: ` + t1)
      if (/→/.test(t1)) problems.push('nivel-pontos: 2 -> 3 mostra status subindo sozinho: ' + t1)
      if (/teto/i.test(t1)) problems.push('nivel-pontos: 2 -> 3 fala em teto sem estar no teto: ' + t1)
      // sem o teto da raridade (bloco 1b): Comum ★★ de genética 31 com a build do bot inteira no nível 49 (o bloco 1 punha
      // os sete status no teto de 80 aqui). No 50 ganha os pontos do nível e é convidado a distribuí-los; nada de teto,
      // porque ninguém chega a 150 com os pontos
      const g31 = Object.fromEntries(G.STAT_KEYS.map((k) => [k, 31]))
      const h49 = { ...brasa, level: 49, potential: g31 }, a49 = S.botAlloc(h49)
      const ganho50 = S.freePoints({ ...h49, level: 50 }) - S.freePoints(h49)
      await montaSave(np, (raw) => {
        const m = raw.mounts[0]
        m.level = 49; m.xp = G.ECONOMY.xpToLevel(49) - 1
        m.potential = g31
        m.alloc = a49
      })
      if (JSON.stringify((await np.evaluate(() => window.__galope.state.mounts[0].alloc))) !== JSON.stringify(a49)) problems.push('nivel-pontos: a build do bot no nível 49 não ficou no save')
      const t2 = await corre()
      if (!/Subiu para o nível 50/.test(t2) || !t2.includes(`+${ganho50} pontos livres`)) problems.push(`nivel-pontos: nível 50 com a build cheia sem os +${ganho50} pontos livres: ` + t2)
      if (/teto/i.test(t2)) problems.push('nivel-pontos: nível 50 fala em teto (o teto da raridade saiu; 150 ninguém alcança): ' + t2)
    } catch (e) {
      problems.push('nivel-pontos: ' + e.message)
    }
    await np.context().close()
  }

  // ---------------- selo "+N": os pontos de status que ainda dá para comprar (não o custo); quando nada cabe, ele some e
  // a aba Status explica a sobra (bloco 1b: no lugar do teto da raridade, o custo por faixa) ----------------
  if (quer('selo-teto')) {
    const sq = await newPage(browser, { width: 360, height: 780 }, 'selo-teto')
    const seloDe = async (uid) => ((await sq.locator(`.montaria-linha[data-id="${uid}"] .pontos-livres`).first().textContent({ timeout: 500 }).catch(() => '')) || '').trim()
    try {
      await sq.getByRole('button', { name: 'Escolher Brasa' }).click()
      await sq.waitForSelector('#t-estabulo')
      // Comum ★★ nível 24 de genética 31: 73 pontos. m2 com 10 em cada status de corrida (custo 60): sobram 13 e o próximo
      // ponto custa 2 em todos; o selo mostra os 13 que sobram (o mesmo número do topo da aba Status). m3 com 11 em cada
      // (custo 72): sobra 1, que não paga nenhum ponto: sem selo
      const cada = (n) => Object.fromEntries(G.STAT_KEYS.map((k) => [k, k === 'sorte' ? 0 : n]))
      const M2 = Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { level: 24, alloc: cada(10) })
      const M3 = Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { uid: 'm3', level: 24, alloc: cada(11) })
      await montaSave(sq, (raw) => { raw.mounts.push(M2, M3); raw.nextUid = 4; raw.stableSlots = 3 })
      const ms = await sq.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state.mounts)))
      const i2 = S.allocInfo(ms[1]), i3 = S.allocInfo(ms[2])
      if (i2.left !== 13 || podeComprar(ms[1]) !== 13 || i3.left !== 1 || podeComprar(ms[2]) !== 0) problems.push('selo-teto: montarias de teste ' + JSON.stringify({ m2: [i2.left, podeComprar(ms[1])], m3: [i3.left, podeComprar(ms[2])] }))
      if ((await seloDe('m2')) !== '+13') problems.push(`selo-teto: com 13 sobrando e o ponto a 2, o selo é "${await seloDe('m2')}" (esperado "+13", o número do topo da aba Status)`)
      if (!/^Sobram 13 pontos para distribuir na aba Status$/.test((await sq.locator('.montaria-linha[data-id="m2"] .pontos-livres').first().getAttribute('title').catch(() => '')) || '')) problems.push('selo-teto: o title do selo da m2 não é "Sobram 13 pontos para distribuir na aba Status"')
      if (await seloDe('m3')) problems.push('selo-teto: a linha do Estábulo mostra "+N" sem nenhum ponto que caiba: ' + await seloDe('m3'))
      await sq.locator('button[data-acao="montaria"][data-id="m3"]').click()
      await sq.waitForSelector('#t-montaria')
      if (await sq.locator('.montaria-cabeca .pontos-livres').count()) problems.push('selo-teto: o retrato da Montaria mostra "+N" sem nenhum ponto que caiba')
      const tx = ((await sq.locator('#tela').textContent()) || '').replace(/\s+/g, ' ')
      if (!/Sobra 1 ponto: não pagam o próximo ponto de nenhum status/.test(tx)) problems.push('selo-teto: a aba Status não explica o ponto que sobra')
      if (!tx.includes('Pontos: sobram 1 de 73')) problems.push('selo-teto: topo da m3 sem "Pontos: sobram 1 de 73"')
      // nenhum ponto cabe e não há rascunho: os +N e o "Distribuir sugerido" não aparecem (decisão de 2026-11-13, spec §11)
      const nMais = await sq.locator('[data-acao="ponto-mais"]').count(), nSug = await sq.locator('[data-acao="pontos-sugerir"]').count()
      if (nMais || nSug) problems.push(`selo-teto: sem nenhum ponto que caiba, a aba Status mostra ${nMais} botões +N e ${nSug} "Distribuir sugerido"`)
      // a m2 (13 sobrando, ponto a 2): +1 e +5 cabem, +10 (custa 20) desabilitado com o motivo
      await sq.locator('[data-acao="montaria-voltar"]').click()
      await sq.waitForSelector('#t-estabulo')
      await sq.locator('button[data-acao="montaria"][data-id="m2"]').click()
      await sq.waitForSelector('#t-montaria')
      const b10 = sq.locator('[data-acao="ponto-mais"][data-id="vel"][data-n="10"]'), b1 = sq.locator('[data-acao="ponto-mais"][data-id="vel"][data-n="1"]')
      if ((await b1.isDisabled()) || !(await indisp(b10)) || (await b10.getAttribute('title')) !== tituloMais(ms[1].alloc, 'vel', 10) + '. Faltam pontos: sobram 13.') problems.push(`selo-teto: m2 com +1 ${await indisp(b1) ? 'desabilitado' : 'habilitado'} e +10 "${await b10.getAttribute('title')}"`)
      // a Brasa nível 12 (28 pontos, todos a 1) continua com o selo de todos os pontos
      await montaSave(sq, (raw) => { raw.mounts[0].level = 12 })
      const m1 = (await sq.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state.mounts[0]))))
      if ((await seloDe('m1')) !== '+' + podeComprar(m1) || podeComprar(m1) !== 28) problems.push(`selo-teto: a Brasa nível 12 com o selo "${await seloDe('m1')}" (esperado "+28")`)
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
      if ((await b1.locator('.montaria-linha').count()) !== 1) problems.push('build-nivel1: o Estábulo sem a linha da Brasa')
      if ((await b1.locator('.montaria-linha .pontos-livres').count()) !== 0) problems.push('build-nivel1: a linha do Estábulo avisa pontos no nível 1')
      await b1.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await b1.waitForSelector('#t-montaria')
      const txt = ((await b1.locator('.build-topo').first().textContent()) || '').replace(/\s+/g, ' ')
      if (!txt.includes('Pontos: sobram 0 de 0') || !txt.includes('Cada nível ganho dá pontos para distribuir.')) problems.push('build-nivel1: topo sem "Pontos: sobram 0 de 0" e a explicação: ' + txt)
      // sem nenhum ponto, os +1, +5 e +10 não aparecem (decisão de 2026-11-13, spec §11)
      if ((await b1.locator('[data-acao="ponto-mais"]').count()) !== 0) problems.push('build-nivel1: nível 1 oferece +N')
      if ((await b1.locator('[data-acao="pontos-confirmar"]').count()) !== 0) problems.push('build-nivel1: nível 1 oferece "Confirmar"')
      if ((await b1.locator('[data-acao="pontos-sugerir"]').count()) !== 0) problems.push('build-nivel1: nível 1 oferece "Distribuir sugerido"')
      if ((await b1.locator('[data-acao="redistribuir"]').count()) !== 0) problems.push('build-nivel1: nível 1 oferece "Redistribuir pontos"')
      if ((await b1.locator('[data-status] .nota-genetica').count()) !== 7) problems.push('build-nivel1: sem as 7 notas de genética')
      await confereLegivel(b1, ['.pontos-livres', '.nota-genetica', '.build-custo'], 'build-nivel1-360')
      // nível 2 (2 pontos): os +N aparecem; +1 cabe, +5 e +10 ficam desabilitados com o motivo; a Sorte sem botões
      await montaSave(b1, (raw) => { raw.mounts[0].level = 2 })
      await b1.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await b1.waitForSelector('#t-montaria')
      const m1 = await b1.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state.mounts[0])))
      const bs = await b1.evaluate(() => Array.from(document.querySelectorAll('[data-acao="ponto-mais"]')).map((b) => ({ k: b.getAttribute('data-id'), n: Number(b.getAttribute('data-n')), off: b.getAttribute('aria-disabled') === 'true', nativo: b.disabled, title: b.getAttribute('title') })))
      if (bs.some((b) => b.nativo)) problems.push('ponto-mais com disabled nativo (devia ser só aria-disabled): ' + JSON.stringify(bs.filter((b) => b.nativo)))
      if (S.freePoints(m1) !== 2 || bs.length !== 18 || bs.some((b) => b.k === 'sorte')) problems.push(`build-nivel1: nível 2 com ${bs.length} botões +N (esperado 18, nenhum na Sorte; ${S.freePoints(m1)} pontos)`)
      for (const b of bs) {
        const esp = tituloMais(m1.alloc, b.k, b.n) + (b.n === 1 ? '' : '. Faltam pontos: sobram 2.')
        if (b.off !== (b.n !== 1) || b.title !== esp) problems.push(`build-nivel1: nível 2, botão ${JSON.stringify(b)} (esperado "${esp}", ${b.n === 1 ? 'habilitado' : 'desabilitado'})`)
      }
      if ((await b1.locator('[data-acao="pontos-sugerir"]').count()) !== 1) problems.push('build-nivel1: nível 2 sem "Distribuir sugerido"')
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
        // Estábulo: selo no retrato, "+N" e sem "Nv" no texto da linha; a barra de XP saiu da linha (3b §4) e fica na
        // ficha (conferida abaixo)
        if ((await seloEm('.montaria-linha[data-id="m1"] .retrato-moldura .selo-nivel')) !== 'Nv 12') problems.push(`${tag}: selo da linha do Estábulo = "${await seloEm('.montaria-linha[data-id="m1"] .selo-nivel')}"`)
        if ((await sl.locator('.montaria-linha[data-id="m1"] .barra--xp').count()) !== 0) problems.push(tag + ': a linha do Estábulo com barra de XP (3b §4: o XP fica na ficha)')
        // os pontos que sobram, como no topo da aba Status: a Brasa nível 12 tem 28 (era "+13" no bloco 1)
        const espSelo = '+' + podeComprar(await sl.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state.mounts[0]))))
        if (espSelo !== '+28' || (await seloEm('.montaria-linha[data-id="m1"] .pontos-livres')) !== espSelo) problems.push(`${tag}: aviso de pontos da linha = "${await seloEm('.montaria-linha[data-id="m1"] .pontos-livres')}" (esperado "${espSelo}")`)
        if ((await sl.locator('.montaria-linha[data-id="m1"] .pontos-livres').first().getAttribute('title')) !== 'Sobram 28 pontos para distribuir na aba Status') problems.push(`${tag}: o title do selo não é "Sobram 28 pontos para distribuir na aba Status"`)
        // o texto das linhas fora do retrato (nome, raridade, tipo, Poder): o nível só no selo do retrato
        const etiquetas = await sl.evaluate(() => Array.from(document.querySelectorAll('.montaria-linha')).map((b) => { const c = b.cloneNode(true); c.querySelectorAll('.retrato-moldura').forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim() }).join(' | '))
        if (!etiquetas || /Nv\s*\d/.test(etiquetas)) problems.push(tag + ': "Nv" no texto da linha do Estábulo (ou linha sem texto): ' + etiquetas)
        await confereLegivel(sl, ['.montaria-linha .selo-nivel', '.montaria-linha .pontos-livres'], tag + '-estabulo')
        if (vp.width === 360) await capT6(sl, tag + '-estabulo.png')
        // Montaria
        await sl.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await sl.waitForSelector('#t-montaria')
        if ((await seloEm('.montaria-cabeca .retrato-moldura .selo-nivel')) !== 'Nv 12') problems.push(tag + ': Montaria sem o selo "Nv 12"')
        if ((await sl.locator('.montaria-cabeca .barra--xp').count()) !== 1) problems.push(tag + ': ficha sem a barra de XP')
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
    // o terço de cada tipo, como a descrição da skill de tipo diz (GameData.TYPE_SKILLS[el].desc)
    const tercoDe = (m) => ({ fogo: 'primeiro terço', grama: 'terço do meio', agua: 'último terço' })[m.element]
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
        const ts = S.typeSkill(m), terco = tercoDe(m)
        const vaga = ((await vt.locator('.vaga-tipo').textContent().catch(() => '')) || '').replace(/\s+/g, ' ')
        if ((await vt.locator('.vaga-tipo').count()) !== 1) problems.push(`vaga-tipo: ${m.uid} com ${await vt.locator('.vaga-tipo').count()} vagas de tipo`)
        if (!vaga.includes(ts.name) || !vaga.toLowerCase().includes(terco)) problems.push(`vaga-tipo: ${m.uid} sem nome/terço (${ts.name}, ${terco}): ${vaga}`)
        // a força P: a da Água só cresce com a raridade (spec 1b §5); a do Fogo e a da Grama variam com o nível e a raridade
        // (o "varia com nível e raridade" fica só na descrição da skill; a linha de intensidade não o repete)
        const inten = 'Intensidade ×' + ts.power.toFixed(2).replace('.', ',')
        if (!vaga.includes(inten) || (vaga.match(/varia com/g) || []).length > 1 || (vaga.match(/cresce com/g) || []).length > 1 || /Força ×/.test(vaga)) problems.push(`vaga-tipo: ${m.uid} sem o rótulo "${inten}" (ou ainda com "Força ×"): ${vaga}`)
        // bloco 1b: o efeito em pontos para o cavalo (status × statMul·P nos dois status do tipo) e a descrição com o %
        const pts = efeitoTipoPontos(m).replace(/º/g, 'oº')   // o "º" vira um "o" sobrescrito e um "º" só para leitor de tela (ordFix)
        if (!vaga.includes(pts) || !vaga.includes(G.TYPE_SKILLS[m.element].desc)) problems.push(`vaga-tipo: ${m.uid} sem o efeito em pontos "${pts}" ou a descrição: ${vaga}`)
        if (/NaN|undefined/.test(vaga)) problems.push(`vaga-tipo: ${m.uid} com NaN/undefined: ${vaga}`)
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
            s.phase = 'corrida'; s.simT = T; s.tReal = 7; s.last = 0; s.flash = 0; s.winnerSeen = true; s.mult = 1
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
            // spec 3c §5: com a raia alta o bastante (s.linhasBalao = 2), o nome inteiro (em duas linhas, se não couber em uma)
            return { racer: it.racer, el: it.element, curto: s.linhasBalao === 2 ? it.nome.toUpperCase() : it.nomeCurto, visivel: q.vis.includes(it.racer), balao: q.baloes.find((b) => b.racer === it.racer && b.tipo) || null }
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
          if (new Set(semArmar).size < 3) { seed = SK_SEEDS[k]; break }
        }
        if (seed == null) { problems.push(`[${label}] skills: nenhuma seed de ${SK_SEEDS} deixa o cavalo Raro sem as três skills`); return }
        // 2) a mesma seed, armada: as duas ativam
        await largar(pg, seed, true, false)
        const armada = await skillsDoJogador(pg)
        // o Raro tem 3 vagas e só 2 vêm da gaveta: subindo de nível entre as corridas ele pode aprender uma
        // terceira, que também ativa armada. As skills contadas são as do corredor da sala (L.racers), a cópia que a
        // simulação usou: ler state.mounts depois do Largar contaria uma skill aprendida no fim da própria corrida.
        // Conta nomes distintos: uma skill por bloco (Drift, Fôlego de Montanha) ativa uma vez em cada bloco
        const vagasUsadas = await pg.evaluate(() => { const L = window.__galope.ui.lobby; return L.racers[L.playerIdx].horse.skills.length })
        if (new Set(armada).size !== 1 + vagasUsadas || !/Arranque/.test(armada.join(' ')) || !/Labareda/.test(armada.join(' ')) || !/Arrancada Final/.test(armada.join(' '))) problems.push(`[${label}] skills: sempre ativam deu ${JSON.stringify(armada)} (sem armar: ${JSON.stringify(semArmar)})`)
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
      // Ruling 12: a virada de um Dado só aparece na revelação dele (t0 + DADO.regira·escala)
      const ev = await pg.evaluate(() => {
        const e = window.__galope.ui.lobby.sim.events.find((x) => x.type === 'clima'), s = window.__galope.race._state
        const d = e && s.fx.find((x) => x.kind === 'dado' && x.t0 === e.t)
        return e ? { t: d ? d.t0 + window.RaceFx.DADO.regira * d.escala : e.t, weather: e.weather } : null
      })
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
        // sexo e Corcel saíram da linha do Estábulo (3b §4) e da cabeça da ficha (3b §5): os ícones e o texto ao lado deles
        // são conferidos na aba Ficha da m1 (Macho, Corcel) e da m2 (Fêmea, Corcel), abaixo
        espera(est, 'estábulo', ['ui-perfil', 'ui-estrela', 'ui-estrela-vazia', 'rar-comum', 'rar-raro'])
        const fichaTxt = async () => ((await pg.locator('.montaria-ficha').textContent()) || '').replace(/\s+/g, ' ')
        const rotPerfil = await pg.locator('.app-perfil').getAttribute('aria-label')
        if (rotPerfil !== 'Perfil') problems.push(`${tag} estábulo: botão do Perfil com aria-label "${rotPerfil}"`)
        // Montaria m1: aba Status (os 7 status) e aba Skills (ícones de 32 px)
        await pg.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pg.waitForSelector('#t-montaria')
        espera(await confereTela(pg, tag + ' montaria-status'), 'montaria-status', G.STAT_KEYS.map((k) => 'st-' + k).concat(['liga-']))
        await pg.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
        espera(await confereTela(pg, tag + ' montaria-ficha'), 'montaria-ficha', ['ui-corcel', 'ui-macho'])
        const txt1 = await fichaTxt()
        for (const p of ['Macho', 'Corcel']) if (!txt1.includes(p)) problems.push(`${tag} ficha m1: sem o texto "${p}" ao lado do ícone`)
        for (const uid of ['m1', 'm2', 'm3', 'm4']) {
          if (uid === 'm2') {
            await pg.locator('[data-acao="montaria-voltar"]').click()
            await pg.locator('button[data-acao="montaria"][data-id="m2"]').click()
            await pg.waitForSelector('#t-montaria')
            // a aba Status da m2 (a ficha abre nela): as regras gerais da tela e os 7 status e a liga, como na m1
            espera(await confereTela(pg, tag + ' montaria-status m2'), 'montaria-status m2', G.STAT_KEYS.map((k) => 'st-' + k).concat(['liga-']))
            await pg.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
            espera(await confereTela(pg, tag + ' montaria-ficha m2'), 'montaria-ficha m2', ['ui-femea', 'ui-corcel'])
            const txt2 = await fichaTxt()
            for (const p of ['Fêmea', 'Corcel']) if (!txt2.includes(p)) problems.push(`${tag} ficha m2: sem o texto "${p}" ao lado do ícone`)
          }
          await pg.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
          await pg.waitForSelector('.vaga-tipo')
          const sk = await confereTela(pg, `${tag} skills ${uid}`)
          // o ui-femea da m2 aparecia aqui pela cabeça da ficha; com o sexo na aba Ficha (3b §5), é conferido lá (acima)
          espera(sk, 'skills ' + uid, uid === 'm1' ? ['sk-arranque', 'sk-tipo-fogo'] : ['sk-arranque', 'sk-sprint', 'sk-drift', 'sk-tipo-agua'])
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
        if (disco.v !== SAVE_V) problems.push(`${label}: a versão do save mudou para ${disco.v}`)
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
          // ficha da Montaria (aba Ficha, 3b §5): a linha "Marcas:" junto do sexo e do porte, batendo com o save
          await pg.locator('[data-acao="perfil-voltar"]').click()
          await pg.waitForSelector('#t-estabulo')
          for (const uid of ['m1', 'm2', 'm3', 'm4']) {
            await pg.locator(`button[data-acao="montaria"][data-id="${uid}"]`).click()
            await pg.waitForSelector('#t-montaria')
            await pg.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
            const m = (await estado(pg)).mounts.find((x) => x.uid === uid)
            const txt = await pg.evaluate(() => Array.from(document.querySelectorAll('.montaria-ficha .ficha-dados > li')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).find((t) => /^Marcas:/.test(t)) || null)
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

  // ---------------- Portes: save, telas, rivais, gaveta DEV e desempenho (Visuais 2, parte 2b, Task 3) ----------------
  // O porte (GameData.PORTES; só desenho) segue a escada do Breed.porteDe: o do cavalo, se válido; senão o do modelo do
  // catálogo; senão porteDoId(uid). O save com lixo no porte (Review Focus 1) e o alugado de antes da 2b (Review Focus 4)
  // abrem com um porte válido, que vai para o disco e fica na recarga. A ficha e as linhas dos pais no Haras mostram
  // "Porte: …"; a Calculadora, os portes que o potro pode ter. Cada drawHorse, horseBox, anchorsFor e prepararCavalo do
  // jogo recebe o porte do cavalo; o rival, o do modelo dele. A gaveta DEV escolhe o porte sem tocar no save real. A 360 px
  // a ativa fica inteira no cartão do estábulo e na raia nos 3 portes (Review Focus 3); a corrida DEV com 8 Míticos de
  // portes alternados fica abaixo do teto de 6 ms e o cache dos moldes não cresce depois da largada (Review Focus 5).
  // Desde a T7 os moldes são os 12 dos portes: cada porte desenha o seu molde, e aqui se confere que o porte chega a cada
  // desenho (com os 4 moldes antigos, antes da T7, todo porte desenhava igual e só isso se conferia).
  if (quer('portes')) {
    const TETO_MS = 6   // o mesmo teto do bloco marcas (e do teste de desempenho: Completas − Reduzidas)
    const PV = G.PORTES.valores, NOMES = G.PORTES.nomes, MUT = Math.round(G.PORTES.mutacao * 100)
    const CAT = G.STARTERS.concat(G.WILD_HORSES)
    const doModelo = (id) => { const h = CAT.find((x) => x.id === id); return h ? h.porte : null }
    const linhaPorte = (p) => 'Porte: ' + NOMES[p]
    // a linha da Calculadora: os portes dos pais na ordem de GameData.PORTES.valores, e a mutação
    const linhaPotro = (a, b) => 'Porte do potro: ' + PV.filter((p) => p === a || p === b).map((p) => NOMES[p]).join(' ou ') + ` (${MUT}% de chance de mutação)`
    const estado = (pg) => pg.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    const daAtiva = (s) => s.mounts.find((m) => m.uid === s.activeId)
    const semRaia = (id) => String(id).replace(/-b\d+$/, '')   // id do rival na sala = id do modelo + '-b<n>'
    // espia dos desenhos que o jogo pede ao Sprites (o jogo chama SP.<função> a cada vez): guarda as primeiras 600
    // chamadas de cada função desde a última ligação em window.__portes; ligar = false devolve as originais. Do
    // drawHorse com quadro (retratos e pódio) guarda também a linha do estábulo (data-id), o tamanho do canvas e a
    // caixa do desenho (horseBox original, com as mesmas opções).
    const espia = (pg, ligar = true) => pg.evaluate((on) => {
      const SP = window.Sprites, FN = ['drawHorse', 'horseBox', 'prepararCavalo', 'anchorsFor', 'drawHorseSilhouette']
      if (!SP.__origPortes) { SP.__origPortes = {}; for (const f of FN) SP.__origPortes[f] = SP[f] }
      const O = SP.__origPortes, reg = window.__portes = {}
      for (const f of FN) {
        reg[f] = []
        SP[f] = !on ? O[f] : function () {
          const a = arguments, lista = reg[f]
          if (lista.length < 600) {
            if (f === 'anchorsFor') lista.push({ element: a[0], estado: a[2], porte: a[3] === undefined ? '(ausente)' : a[3] })
            else {
              const o = (f === 'horseBox' ? a[2] : f === 'prepararCavalo' ? a[0] : a[3]) || {}
              const c = { porte: o.porte === undefined ? '(ausente)' : o.porte, semente: o.semente, element: o.element, quadro: !!o.quadro, idle: !!o.idle }
              if (f === 'drawHorse' && o.quadro && a[0] && a[0].canvas) {
                const cv = a[0].canvas, card = cv.closest ? cv.closest('.montaria-linha') : null
                c.cartao = card ? card.getAttribute('data-id') : null
                c.cv = [cv.width, cv.height]
                c.caixa = O.horseBox(a[1], a[2], o)
              }
              lista.push(c)
            }
          }
          return O[f].apply(this, arguments)
        }
      }
    }, ligar)
    const espiado = (pg) => pg.evaluate(() => JSON.parse(JSON.stringify(window.__portes)))
    // nenhuma chamada espiada sem um porte da lista
    const semPorte = (reg, onde) => {
      for (const [f, lista] of Object.entries(reg)) {
        const ruins = lista.filter((c) => PV.indexOf(c.porte) < 0)
        if (ruins.length) problems.push(`${onde}: ${ruins.length} de ${lista.length} chamadas de ${f} sem porte válido (${[...new Set(ruins.map((c) => c.porte))].join(', ')})`)
      }
    }
    // retratos (drawHorse com quadro) de cada cavalo esperado ({ chave, porte }): uma chamada com a semente da chave e o porte
    const confereRetratos = (reg, esperados, onde, filtro = (d) => d.quadro) => {
      const daTela = reg.drawHorse.filter(filtro)
      for (const e of esperados) {
        const dela = daTela.filter((d) => d.semente === B.hashChave(e.chave))
        if (!dela.length) problems.push(`${onde}: nenhum retrato de ${e.chave}`)
        else if (!dela.some((d) => d.porte === e.porte)) problems.push(`${onde}: retrato de ${e.chave} com porte ${[...new Set(dela.map((d) => d.porte))].join(',')} (esperado ${e.porte})`)
      }
      semPorte(reg, onde)
    }
    // corrida: cada corredor ({ chave, element, porte }) desenhado na pista (drawHorse sem quadro e horseBox) com o porte
    // esperado; prepararCavalo uma vez por corredor, com o porte dele; anchorsFor sempre com porte, nos pares
    // elemento|porte dos corredores (o jogo pede as âncoras de todos a cada quadro, antes do corte nas bordas)
    const confereCorrida = (reg, esperados, onde) => {
      const pista = reg.drawHorse.filter((d) => !d.quadro), caixas = reg.horseBox.filter((d) => !d.quadro)
      for (const e of esperados) {
        const sem = B.hashChave(e.chave)
        for (const [fn, lista] of [['drawHorse', pista], ['horseBox', caixas]]) {
          const dela = lista.filter((d) => d.semente === sem)
          if (!dela.length) problems.push(`${onde}: nenhum ${fn} de ${e.chave} na pista`)
          else if (!dela.some((d) => d.porte === e.porte)) problems.push(`${onde}: ${fn} de ${e.chave} com porte ${[...new Set(dela.map((d) => d.porte))].join(',')} (esperado ${e.porte})`)
        }
      }
      const prep = reg.prepararCavalo.map((d) => d.porte).sort().join(','), espPrep = esperados.map((e) => e.porte).sort().join(',')
      if (prep !== espPrep) problems.push(`${onde}: prepararCavalo com os portes ${prep || '(nenhum)'} (esperado ${espPrep})`)
      const pares = [...new Set(reg.anchorsFor.map((d) => d.element + '|' + d.porte))].sort().join(' ')
      const espPares = [...new Set(esperados.map((e) => e.element + '|' + e.porte))].sort().join(' ')
      if (pares !== espPares) problems.push(`${onde}: anchorsFor com ${pares || '(nenhum)'} (esperado ${espPares})`)
      semPorte(reg, onde)
    }
    // corredores da sala aberta: chave do desenho (uid da montaria ou id do modelo), elemento e o porte que o jogo tem
    const corredores = (pg) => pg.evaluate(() => {
      const L = window.__galope.ui.lobby
      return { n: L.n, seed: L.seed, racers: L.racers.map((r) => ({ isPlayer: r.isPlayer, id: r.horse.uid || r.horse.id, element: r.horse.element })) }
    })
    // linhas da aba Ficha da Montaria (3b §5): o "Porte: …" e se ele vem logo antes do "Marcas: …"
    const fichaPorte = async (pg, uid, onde) => {
      await pg.locator(`button[data-acao="montaria"][data-id="${uid}"]`).click()
      await pg.waitForSelector('#t-montaria')
      await pg.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
      const sp = await pg.evaluate(() => Array.from(document.querySelectorAll('.montaria-ficha .ficha-dados > li')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()))
      await checkOverflow(pg, onde)
      await pg.locator('[data-acao="montaria-voltar"]').click()
      await pg.waitForSelector('#t-estabulo')
      const iP = sp.findIndex((t) => /^Porte:/.test(t)), iM = sp.findIndex((t) => /^Marcas:/.test(t))
      return { txt: iP >= 0 ? sp[iP] : null, antes: iP >= 0 && iM === iP + 1 }
    }
    const confereFicha = async (pg, uid, porte, onde) => {
      const f = await fichaPorte(pg, uid, onde)
      if (f.txt !== linhaPorte(porte)) problems.push(`${onde}: ficha de ${uid} com "${f.txt}" (esperado "${linhaPorte(porte)}")`)
      else if (!f.antes) problems.push(`${onde}: na ficha de ${uid}, "${f.txt}" não vem logo antes da linha das marcas`)
    }
    // montaria de teste: a TETO_M2 com outro uid, ou a de um modelo do catálogo (o alugado / a cópia de antes da 2b)
    const outro = (uid, o = {}) => Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { uid, name: 'Cavalo ' + uid.slice(1), breedLeft: 2 }, o)
    const deModelo = (uid, id, o = {}) => { const t = CAT.find((x) => x.id === id); return outro(uid, { templateId: id, element: t.element, rarity: t.rarity, sex: t.sex, name: t.name, ...o }) }

    // 1. save de antes da 2b (sem porte, com o alugado de Pororoca: RF4) e save com lixo no porte (RF1), a 360 px
    {
      const label = 'portes-save'
      const pg = await newPage(browser, { width: 360, height: 780 }, label)
      try {
        await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
        await pg.waitForSelector('#t-estabulo')
        if (doModelo('brasa') !== 'padrao' || doModelo('w-ticao') !== 'robusto' || doModelo('w-pororoca') !== 'robusto') problems.push(`${label}: os portes do catálogo mudaram (Brasa ${doModelo('brasa')}, Tição ${doModelo('w-ticao')}, Pororoca ${doModelo('w-pororoca')})`)
        // RF4: nenhum cavalo com o campo porte; Tição e Pororoca pelo modelo, o sem modelo por porteDoId
        await montaSave(pg, (raw) => {
          raw.mounts.push(deModelo('m2', 'w-ticao'))
          raw.mounts.push(deModelo('m3', 'w-pororoca'))   // o alugado de antes da 2b
          raw.mounts.push(outro('m4'))
          raw.mounts.forEach((m) => { delete m.porte })
          raw.nextUid = 5; raw.stableSlots = 6
        })
        let esperados = { m1: 'padrao', m2: 'robusto', m3: 'robusto', m4: B.porteDoId('m4') }
        let s = await estado(pg)
        for (const [uid, p] of Object.entries(esperados)) {
          const got = (s.mounts.find((x) => x.uid === uid) || {}).porte
          if (got !== p) problems.push(`${label}: save sem porte: ${uid} abriu com porte ${JSON.stringify(got)} (esperado ${p})`)
        }
        await espia(pg)
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.waitForSelector('#t-estabulo')
        confereRetratos(await espiado(pg), Object.entries(esperados).map(([chave, porte]) => ({ chave, porte })), label + ' (estábulo)')
        await espia(pg, false)
        await confereFicha(pg, 'm1', 'padrao', label + '-ficha-brasa')
        await confereFicha(pg, 'm2', 'robusto', label + '-ficha-ticao')
        await confereFicha(pg, 'm3', 'robusto', label + '-ficha-pororoca')   // RF4
        await confereFicha(pg, 'm4', esperados.m4, label + '-ficha-m4')
        // RF1: lixo no porte de 3 montarias (texto fora da lista, número e a maiúscula), mais um porte válido que fica
        await montaSave(pg, (raw) => {
          const por = (uid) => raw.mounts.find((m) => m.uid === uid)
          por('m2').porte = 'gigante'      // Tição: o do modelo
          por('m3').porte = 7              // Pororoca: o do modelo
          por('m4').porte = 'Robusto'      // sem modelo e com maiúscula: porteDoId('m4')
          raw.mounts.push(deModelo('m5', 'w-ticao', { porte: 'esguio' }))   // válido: fica, mesmo com o modelo robusto
          raw.nextUid = 6
        })
        esperados = { m1: 'padrao', m2: 'robusto', m3: 'robusto', m4: B.porteDoId('m4'), m5: 'esguio' }
        s = await estado(pg)
        for (const [uid, p] of Object.entries(esperados)) {
          const got = (s.mounts.find((x) => x.uid === uid) || {}).porte
          if (got !== p) problems.push(`${label}: save com lixo: ${uid} abriu com porte ${JSON.stringify(got)} (esperado ${p})`)
        }
        await confereFicha(pg, 'm4', esperados.m4, label + '-ficha-lixo')
        await confereFicha(pg, 'm5', 'esguio', label + '-ficha-valido')
        // a gravação seguinte (a sala aberta) leva os portes saneados ao disco; recarregar não muda nada
        await abrirSala(pg)
        const disco = await pg.evaluate((k) => JSON.parse(localStorage.getItem(k)), SAVE_REAL)
        if (disco.v !== SAVE_V) problems.push(`${label}: a versão do save mudou para ${disco.v}`)
        for (const m of disco.mounts) if (m.porte !== esperados[m.uid]) problems.push(`${label}: ${m.uid} gravado com porte ${JSON.stringify(m.porte)} (esperado ${esperados[m.uid]})`)
        const chaves = Object.keys(disco.pending || {}).sort().join(',')
        if (chaves !== 'alloc,counter,fee,gear,pr,training') problems.push(`${label}: a sala gravada mudou de forma: ${chaves}`)
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        s = await estado(pg)
        const recarga = s.mounts.map((m) => m.uid + ':' + m.porte).join(' '), espRecarga = Object.entries(esperados).map(([u, p]) => u + ':' + p).join(' ')
        if (recarga !== espRecarga) problems.push(`${label}: depois de recarregar, portes ${recarga} (esperado ${espRecarga})`)
        await checkOverflow(pg, label + '-estabulo')
        notes.portesSave = { m4: esperados.m4 }
      } catch (e) {
        problems.push(`${label}: ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 2. Haras (360 e 1280): as linhas dos pais com o porte e a linha do porte do potro na Calculadora
    for (const vp of [{ width: 360, height: 780 }, { width: 1280, height: 800 }]) {
      const tag = `portes-haras-${vp.width}`
      const pg = await newPage(browser, vp, tag)
      try {
        await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
        await pg.waitForSelector('#t-estabulo')
        await montaSave(pg, (raw) => {
          raw.mounts.push(deModelo('m2', 'w-ticao'))
          raw.mounts.forEach((m) => { delete m.porte })   // pelo modelo: Brasa padrão, Tição robusto
          raw.nextUid = 3; raw.stableSlots = 6
        })
        await pg.locator('[data-acao="aba"][data-id="haras"]').click()
        await pg.waitForSelector('#t-haras')
        // [minha, aluguel]: Garoa padrão, Faísca esguio, Fogaréu robusto (a fêmea com o porte que vem depois na lista)
        const casos = [['m1', 'w-garoa'], ['m1', 'w-faisca'], ['m1', 'w-fogareu'], ['m2', 'w-faisca'], ['m2', 'w-fogareu']]
        const meu = { m1: { name: 'Brasa', porte: 'padrao' }, m2: { name: 'Tição', porte: 'robusto' } }
        const vistas = {}   // linha do potro de cada caso
        let mineAtual = null
        for (const [mine, rent] of casos) {
          if (mine !== mineAtual) {
            await pg.locator(`[data-acao="haras-mine"][data-id="${mine}"]`).click()
            await pg.waitForSelector(`[data-acao="haras-partner"][data-kind="rent"][data-id="${rent}"]`)
            mineAtual = mine
          }
          await pg.locator(`[data-acao="haras-partner"][data-kind="rent"][data-id="${rent}"]`).click()
          await pg.waitForFunction((id) => window.__galope.ui.haras.partner && window.__galope.ui.haras.partner.id === id && document.querySelector('.calc'), rent)
          const t = CAT.find((x) => x.id === rent)
          const calc = await pg.evaluate(() => ({
            pais: Array.from(document.querySelectorAll('.calc .marcas-linha')).map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
            linhas: Array.from(document.querySelectorAll('.calc p')).map((e) => e.textContent.replace(/\s+/g, ' ').trim())
          }))
          // f é sempre a fêmea (o aluguel) e m o macho (a minha): f primeiro
          const espPais = [[t.name, t.porte], [meu[mine].name, meu[mine].porte]].map(([nome, p]) => `${nome} · ${linhaPorte(p)} · Marcas: `)
          if (calc.pais.length !== 2 || espPais.some((e, i) => !calc.pais[i].startsWith(e))) problems.push(`${tag}: ${mine} × ${rent}: linhas dos pais ${JSON.stringify(calc.pais)} (esperado começar com ${JSON.stringify(espPais)})`)
          const potro = calc.linhas.filter((l) => /^Porte do potro:/.test(l)), esp = linhaPotro(t.porte, meu[mine].porte)
          vistas[mine + ' × ' + rent] = potro.join(' | ')
          if (potro.length !== 1 || potro[0] !== esp) problems.push(`${tag}: ${mine} × ${rent}: linha do potro ${JSON.stringify(potro)} (esperado "${esp}")`)
          const mesmos = t.porte === meu[mine].porte
          if (potro.length === 1 && (mesmos ? / ou /.test(potro[0]) : !/ ou /.test(potro[0]))) problems.push(`${tag}: ${mine} × ${rent}: "${potro[0]}" ${mesmos ? 'com "ou" para pais do mesmo porte' : 'sem "ou" para pais de portes diferentes'}`)
        }
        // os textos da spec, letra a letra; a ordem dentro do "ou" é a de GameData.PORTES.valores, não a dos pais (Fogaréu,
        // robusta, é a fêmea e vem primeiro nas linhas dos pais)
        const literais = {
          'm2 × w-fogareu': `Porte do potro: Robusto (${MUT}% de chance de mutação)`,
          'm2 × w-faisca': `Porte do potro: Esguio ou Robusto (${MUT}% de chance de mutação)`,
          'm1 × w-fogareu': `Porte do potro: Padrão ou Robusto (${MUT}% de chance de mutação)`
        }
        for (const [caso, txt] of Object.entries(literais)) if (vistas[caso] !== txt) problems.push(`${tag}: ${caso}: "${vistas[caso]}" (esperado "${txt}")`)
        await checkOverflow(pg, tag)
      } catch (e) {
        problems.push(`${tag}: ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 3. gaveta DEV (360): o seletor de porte vai ao save DEV e nunca toca no save real; com a ativa em cada porte,
    // ela fica inteira no cartão do estábulo e na raia (RF3) e o porte de cada rival é o do modelo dele
    {
      const label = 'portes-dev'
      const REAL = JSON.stringify({ v: 2, starterId: 'mare', level: 4, xp: 0, skills: [], gold: 555, races: 1, wins: 0, podiums: 0, goldWon: 0, seedBase: 777, raceCounter: 1 })
      const init = { content: `(() => {
        try { if (localStorage.getItem('galope-elemental:v1') === null) localStorage.setItem('galope-elemental:v1', ${JSON.stringify(REAL)}) } catch (e) {}
        const log = window.__acessos = []
        window.__lsGet = Storage.prototype.getItem
        for (const fn of ['getItem', 'setItem', 'removeItem']) {
          const orig = Storage.prototype[fn]
          Storage.prototype[fn] = function (k) { log.push(fn + ':' + k); return orig.apply(this, arguments) }
        }
      })()` }
      const pg = await newPage(browser, { width: 360, height: 780 }, label, { query: '?dev=1', init })
      const discoDev = () => pg.evaluate(() => JSON.parse(window.__lsGet.call(localStorage, 'galope-elemental:dev')))
      const seletor = () => pg.evaluate(() => { const el = document.getElementById('dev-porte'); return el ? el.value : '(sem seletor)' })
      const conferirReal = async (quando) => {
        const a = await pg.evaluate(() => ({ real: window.__lsGet.call(localStorage, 'galope-elemental:v1'), acessos: window.__acessos.slice() }))
        if (a.real !== REAL) problems.push(`${label}: o save real mudou (${quando}): ${a.real}`)
        if (a.acessos.some((x) => /galope-elemental:v1$/.test(x))) problems.push(`${label}: a página tocou no save real (${quando}): ${a.acessos.filter((x) => /v1$/.test(x)).join(', ')}`)
      }
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await devAbrir(pg)
        const opc = await pg.evaluate(() => {
          const el = document.querySelector('[data-dev-campo="porte"]')
          return el ? { tag: el.tagName, id: el.id, valores: Array.from(el.options).map((o) => o.value), textos: Array.from(el.options).map((o) => o.textContent), valor: el.value } : null
        })
        if (!opc) problems.push(`${label}: a gaveta DEV não tem o seletor data-dev-campo="porte"`)
        else {
          if (opc.tag !== 'SELECT' || opc.id !== 'dev-porte') problems.push(`${label}: o campo do porte é ${opc.tag}#${opc.id} (esperado SELECT#dev-porte)`)
          if (opc.valores.join(',') !== PV.join(',')) problems.push(`${label}: seletor de porte com ${opc.valores.join(',')} (esperado ${PV.join(',')})`)
          if (opc.textos.join(',') !== PV.map((p) => NOMES[p]).join(',')) problems.push(`${label}: textos do seletor de porte ${opc.textos.join(',')}`)
          const sujos = opc.textos.filter((t) => !/^[A-Za-zÀ-ÿ0-9 ]+$/.test(t))
          if (sujos.length) problems.push(`${label}: opções do porte com símbolos: ${sujos.join(' | ')}`)
          if (opc.valor !== 'padrao') problems.push(`${label}: a gaveta abriu com o porte ${opc.valor} (o da Brasa: padrao)`)
        }
        const casas = {}
        for (const p of ['robusto', 'esguio', 'padrao']) {
          const tag = `${label}-${p}`
          if (opc) await pg.selectOption('#dev-porte', p)
          await pg.locator('[data-acao="dev-aplicar"]').click()
          const a = daAtiva(await estado(pg)), noDisco = daAtiva(await discoDev())
          if (a.porte !== p || !noDisco || noDisco.porte !== p) problems.push(`${tag}: "Aplicar na ativa" deixou o porte ${a.porte} (no save DEV: ${noDisco && noDisco.porte}; esperado ${p})`)
          if ((await seletor()) !== (opc ? p : '(sem seletor)')) problems.push(`${tag}: o seletor ficou em ${await seletor()} depois de aplicar`)
          await devFechar(pg)
          // linha do estábulo: o retrato com o porte, o cavalo inteiro no canvas (o topo pode passar no máximo 10 % da
          // altura, o CORTE_MAX do sprites.js) e o canvas inteiro no cartão, que fica na largura da tela
          await espia(pg)
          await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
          await pg.waitForSelector('#t-estabulo')
          await sleep(150)
          let reg = await espiado(pg)
          await espia(pg, false)
          const doCartao = reg.drawHorse.filter((d) => d.cartao === a.uid)
          if (!doCartao.length) problems.push(`${tag}: nenhum retrato no cartão de ${a.uid}`)
          else {
            const d = doCartao[doCartao.length - 1], c = d.caixa, corte = Math.max(0, -c.y)
            if (d.porte !== p) problems.push(`${tag}: retrato do cartão com porte ${d.porte} (esperado ${p})`)
            if (c.x < 0 || c.x + c.w > d.cv[0] || c.y + c.h > d.cv[1] || corte > 0.1 * c.h) problems.push(`${tag}: cavalo fora do retrato do cartão: caixa ${JSON.stringify(c)} no canvas ${d.cv}`)
            casas[p] = { caixa: c, cv: d.cv }
          }
          const r = await pg.evaluate((uid) => {
            const card = document.querySelector(`.montaria-linha[data-id="${uid}"]`), cv = card && card.querySelector('canvas.retrato')
            if (!card || !cv) return null
            const A = card.getBoundingClientRect(), C = cv.getBoundingClientRect()
            return { card: [A.left, A.top, A.right, A.bottom], cv: [C.left, C.top, C.right, C.bottom], vw: document.documentElement.clientWidth }
          }, a.uid)
          if (!r) problems.push(`${tag}: sem o cartão de ${a.uid} no estábulo`)
          else if (r.cv[0] < r.card[0] - 0.5 || r.cv[1] < r.card[1] - 0.5 || r.cv[2] > r.card[2] + 0.5 || r.cv[3] > r.card[3] + 0.5 || r.card[0] < -0.5 || r.card[2] > r.vw + 0.5) problems.push(`${tag}: retrato fora do cartão ou cartão fora da tela ${JSON.stringify(r)}`)
          await checkOverflow(pg, tag + '-estabulo')
          // corrida: a ativa inteira na raia (câmera, quadro a quadro) e o porte de cada corredor
          await espia(pg)
          await abrirSala(pg)
          const sala = await corredores(pg)
          await pg.getByRole('button', { name: /^Largar/ }).click()
          await pg.waitForSelector('#pista')
          await startCamMonitor(pg)
          await pg.getByRole('button', { name: 'x2' }).click()
          await sleep(3500)
          await checkOverflow(pg, tag + '-corrida')
          reg = await espiado(pg)
          await espia(pg, false)
          const cc = await pg.evaluate(() => window.__cc)
          if (cc.partial > 0 || cc.off > 0 || cc.vfora > 0 || !(cc.frames > 30)) problems.push(`${tag}: a ativa saiu da raia ${JSON.stringify(cc)}`)
          const esperados = sala.racers.map((x) => ({ chave: x.isPlayer ? x.id : semRaia(x.id), element: x.element, porte: x.isPlayer ? p : doModelo(semRaia(x.id)) }))
          if (!sala.racers.some((x) => !x.isPlayer)) problems.push(`${tag}: sala sem rivais`)
          confereCorrida(reg, esperados, tag + ' (corrida)')
          casas[p].cam = cc
          await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
          await pg.waitForSelector('#t-resultado')
          await pg.locator('[data-acao="voltar"]').click()
          await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
          await pg.waitForSelector('#t-estabulo')
          await devAbrir(pg)
        }
        notes.portesDev = casas
        // copiar um pronto (Pororoca: o porte do modelo, e o seletor carrega o da ativa) e criar um com o porte escolhido
        await pg.selectOption('#dev-copiar', 'w-pororoca')
        await pg.locator('[data-acao="dev-copiar"]').click()
        let a = daAtiva(await estado(pg))
        if (a.uid !== 'm2' || a.porte !== 'robusto') problems.push(`${label}: cópia da Pororoca ${a.uid} com porte ${a.porte} (esperado m2 robusto)`)
        if ((await seletor()) !== 'robusto') problems.push(`${label}: a gaveta não carregou o porte da ativa (${await seletor()})`)
        if (opc) await pg.selectOption('#dev-porte', 'esguio')
        await pg.locator('[data-acao="dev-criar"]').click()
        a = daAtiva(await estado(pg))
        if (a.uid !== 'm3' || a.porte !== 'esguio') problems.push(`${label}: "Criar cavalo" deixou ${a.uid} com porte ${a.porte} (esperado m3 esguio)`)
        await devFechar(pg)
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        const salvas = (await estado(pg)).mounts.map((m) => m.uid + ':' + m.porte).join(' ')
        const disco = (await discoDev()).mounts.map((m) => m.uid + ':' + m.porte).join(' ')
        if (salvas !== 'm1:padrao m2:robusto m3:esguio' || disco !== salvas) problems.push(`${label}: depois de recarregar, portes ${salvas} (no save DEV: ${disco})`)
        await conferirReal('depois da gaveta, das corridas e da recarga')
      } catch (e) {
        problems.push(`${label}: ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 4. corrida DEV com 8 Míticos de portes alternados (1280: o canvas maior; RF5): a ativa robusta pela gaveta e os
    // rivais, na ordem das raias, esguio, robusto, padrão, robusto, esguio, robusto, padrão (4 robustos, 2 esguios e 2
    // padrões ao todo; Míticos e portes trocados na sala aberta, só neste teste). Abaixo do teto de 6 ms por quadro, o
    // cache dos moldes montado na largada e sem crescer depois, e o porte de cada um na pista e no pódio.
    {
      const label = 'portes-corrida'
      let SEED8_DEV = 0   // 8 corredores numa sala DEV: o nº de corredores é o 2º sorteio do rng da sala (como no bloco marcas)
      for (let sd = 1; sd <= 2000 && !SEED8_DEV; sd++) {
        const rng = S.mulberry32(S.hash2(sd, 0xA11CE))
        rng()
        if (4 + Math.floor(rng() * 5) === 8) SEED8_DEV = sd
      }
      const RIVAIS = ['esguio', 'robusto', 'padrao', 'robusto', 'esguio', 'robusto', 'padrao']
      const pg = await newPage(browser, { width: 1280, height: 800 }, label, { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await devAbrir(pg)
        await pg.selectOption('#dev-raridade', 'mitico')
        if (await pg.locator('#dev-porte').count()) await pg.selectOption('#dev-porte', 'robusto')
        await pg.locator('[data-acao="dev-aplicar"]').click()
        await devFechar(pg)
        const at = daAtiva(await estado(pg))
        if (at.rarity !== 'mitico' || at.porte !== 'robusto') problems.push(`${label}: a ativa ficou ${at.rarity} ${at.porte} (esperado mitico robusto)`)
        await devArmar(pg, { seed: SEED8_DEV })
        await abrirSala(pg)
        const sala = await pg.evaluate((rivais) => {
          const L = window.__galope.ui.lobby
          let b = 0
          L.racers.forEach((r) => { r.horse.rarity = 'mitico'; if (!r.isPlayer) r.horse.porte = rivais[b++ % rivais.length] })
          return { n: L.n, racers: L.racers.map((r) => ({ isPlayer: r.isPlayer, id: r.horse.uid || r.horse.id, element: r.horse.element, porte: r.horse.porte })) }
        }, RIVAIS)
        if (sala.n !== 8) problems.push(`${label}: a sala da seed ${SEED8_DEV} tem ${sala.n} corredores (esperado 8)`)
        const esperados = sala.racers.map((r) => ({ chave: r.isPlayer ? r.id : semRaia(r.id), element: r.element, porte: r.isPlayer ? 'robusto' : r.porte }))
        const conta = (p) => esperados.filter((e) => e.porte === p).length
        if (conta('robusto') !== 4 || conta('esguio') !== 2 || conta('padrao') !== 2) problems.push(`${label}: portes da sala ${esperados.map((e) => e.porte).join(',')} (esperado 4 robustos, 2 esguios e 2 padrões)`)
        // quadros do galope por molde (o do porte e do elemento), para o tamanho do cache depois da largada
        const nQuadros = await pg.evaluate((cs) => cs.map((c) => {
          const q = new Set()
          for (let f = 0; f < window.Sprites.GALLOP_FRAMES; f += 1 / 16) q.add(window.Sprites._quadroGalope(c.element, f, c.porte))
          return q.size
        }), esperados)
        await espia(pg)
        await pg.evaluate(() => {
          const m = window.__pc8 = { inicio: null, max: 0 }
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
        confereCorrida(await espiado(pg), esperados, label + ' (corrida)')
        await espia(pg, false)
        // desenho por quadro com os 8 Míticos (média dos últimos 60 de 120 quadros de corrida, sem a espia)
        const ms = await (await pg.waitForFunction((q) => {
          const st = window.RaceFx._stats
          return st.quadros >= q ? st.msQuadro : false
        }, q0 + 120, { timeout: 60000, polling: 'raf' })).jsonValue()
        const mc = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__pc8)))
        const montados = nQuadros.reduce((x, q) => x + 1 + q, 0)   // parado + quadros do galope de cada corredor
        notes.portes8 = { seed: SEED8_DEV, portes: esperados.map((e) => e.porte).join(','), msQuadro: +ms.toFixed(2), teto: TETO_MS, cache: { largada: mc.inicio, max: mc.max, esperado: montados } }
        if (ms > TETO_MS) problems.push(`${label}: ${ms.toFixed(2)} ms por quadro com 8 Míticos de portes alternados (teto ${TETO_MS})`)
        if (!(mc.inicio >= montados)) problems.push(`${label}: na largada o cache dos moldes tinha ${mc.inicio} quadros (esperado ${montados}: cada cavalo montado uma vez na largada)`)
        if (mc.max !== mc.inicio) problems.push(`${label}: o cache dos moldes cresceu durante a corrida (${mc.inicio} -> ${mc.max})`)
        // pódio: os 3 primeiros com o porte deles
        await espia(pg)
        const top3 = await pg.evaluate(() => window.__galope.ui.lobby.sim.finishOrder.slice(0, 3))
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado')
        await sleep(300)
        confereRetratos(await espiado(pg), top3.map((j) => esperados[j]), label + ' (pódio)', (d) => d.quadro && d.idle)
        await espia(pg, false)
      } catch (e) {
        problems.push(`${label}: ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
  }

  // ---------------- crescimento livre (bloco 1b): save v6, equipamento suspenso, Redistribuir, potro, jóquei e DEV ----------------
  // Spec 2026-11-12-crescimento-livre §8–§10. Migração v5 -> v6 com páreo aberto (RF1), lixo no save novo (RF2), gravação
  // que falha ao redistribuir (RF4) e jogador antigo com peças equipadas (RF5); o custo de abrir a sala (pareamento).
  // ---- ajuda: botão "ⓘ" com as explicações curtas (spec 1b §11) ----
  if (quer('ajuda')) {
    const CHAVES = ['vel', 'acel', 'man', 'forca', 'est', 'garra', 'sorte', 'genetica', 'estrelas', 'raridade', 'skillTipo', 'poder', 'liga', 'clima', 'piso', 'dado', 'custo', 'redea']
    for (const k of CHAVES) {
      const t = G.HELP[k]
      if (typeof t !== 'string' || !t) problems.push(`ajuda: GameData.HELP.${k} não existe`)
      else if (t.length > 160) problems.push(`ajuda: HELP.${k} tem ${t.length} caracteres (máximo 160)`)
    }
    // o botão do rótulo: nome acessível, title com o texto, alvo de 44 px, abre e fecha (clique e teclado) sem rolagem horizontal
    const confereAjuda = async (pg, escopo, chave, nome, tag, teclado) => {
      const btn = pg.locator(`${escopo} .ajuda[data-ajuda="${chave}"]`).first()
      if (!(await btn.count())) { problems.push(`${tag}: sem o ⓘ de ${chave} em ${escopo}`); return }
      const nomeAc = (await btn.getAttribute('aria-label')) || ''
      if (nomeAc !== `O que é ${nome}?`) problems.push(`${tag}: ⓘ de ${chave} com nome acessível "${nomeAc}" (esperado "O que é ${nome}?")`)
      if ((await btn.getAttribute('title')) !== G.HELP[chave]) problems.push(`${tag}: ⓘ de ${chave} com title diferente de HELP.${chave}`)
      if ((await btn.getAttribute('aria-expanded')) !== 'false') problems.push(`${tag}: ⓘ de ${chave} começa aberto`)
      await btn.scrollIntoViewIfNeeded()
      const box = await btn.boundingBox()
      if (!box || box.width < 43.5 || box.height < 43.5) problems.push(`${tag}: ⓘ de ${chave} com alvo ${box ? Math.round(box.width) + 'x' + Math.round(box.height) : 'sem caixa'} (mínimo 44x44)`)
      const texto = async () => pg.evaluate((id) => { const e = document.getElementById(id); return e ? { role: e.getAttribute('role'), t: e.textContent, vis: !!(e.offsetWidth || e.offsetHeight) } : null }, await btn.getAttribute('data-nota'))
      if (teclado) { await btn.focus(); await pg.keyboard.press('Enter') } else await btn.click()
      if ((await btn.getAttribute('aria-expanded')) !== 'true') problems.push(`${tag}: ⓘ de ${chave} não abriu (aria-expanded)`)
      const n = await texto()
      if (!n || n.role !== 'note' || n.t !== G.HELP[chave] || !n.vis) problems.push(`${tag}: ⓘ de ${chave} aberto sem o texto em role="note" visível: ${JSON.stringify(n)}`)
      await checkOverflow(pg, `${tag}-${chave}-aberto`)
      if (teclado) await pg.keyboard.press('Space'); else await btn.click()
      if ((await btn.getAttribute('aria-expanded')) !== 'false') problems.push(`${tag}: ⓘ de ${chave} não fechou`)
      if (await pg.locator('.ajuda-txt').count()) problems.push(`${tag}: ⓘ de ${chave} fechado, mas o texto continua na tela`)
    }
    const NOMES = { vel: 'Velocidade', acel: 'Aceleração', man: 'Manobra', forca: 'Força', est: 'Estamina', garra: 'Garra', sorte: 'Sorte' }
    const OUTROS = { genetica: 'a nota de genética', estrelas: 'as estrelas', raridade: 'a raridade', skillTipo: 'a skill de tipo', poder: 'o Poder', liga: 'a liga',
      clima: 'o clima', piso: 'o piso', dado: 'o Dado da Sorte', custo: 'o custo dos pontos', redea: 'a Rédea nova' }
    const pg = await newPage(browser, { width: 360, height: 780 }, 'ajuda')
    try {
      // escolha do inicial: os 7 status (dl.status), raridade, estrelas, Poder e liga
      await pg.waitForSelector('#ini-brasa')
      for (const k of G.STAT_KEYS) await confereAjuda(pg, '#ini-brasa', k, NOMES[k], 'ajuda-inicial', k === 'garra')
      for (const k of ['raridade', 'estrelas', 'poder', 'liga']) await confereAjuda(pg, '#ini-brasa', k, OUTROS[k], 'ajuda-inicial')
      await checkOverflow(pg, 'ajuda-inicial')
      await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
      await pg.waitForSelector('#t-estabulo')
      await montaSave(pg, (raw) => {
        raw.mounts[0].level = 12
        raw.mounts[0].alloc = Object.assign({}, raw.mounts[0].alloc || {}, { vel: 4, acel: 3, man: 0, forca: 0, est: 2, garra: 0, sorte: 0 })
      })
      await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await pg.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await pg.waitForSelector('#t-montaria')
      // aba Status: 7 status, nota de genética, custo dos pontos, Rédea nova; cabeça: raridade, estrelas, Poder e liga
      for (const k of G.STAT_KEYS) await confereAjuda(pg, '.build', k, NOMES[k], 'ajuda-status', k === 'vel')
      for (const k of ['genetica', 'custo']) await confereAjuda(pg, '.build-topo', k, OUTROS[k], 'ajuda-status')
      await confereAjuda(pg, '.redistribuir', 'redea', OUTROS.redea, 'ajuda-status')
      for (const k of ['raridade', 'estrelas', 'poder', 'liga']) await confereAjuda(pg, '.montaria-cabeca', k, OUTROS[k], 'ajuda-cabeca')
      // a linha de status cresce com o texto aberto, mas o Redistribuir e os botões +N seguem clicáveis e sem sobreposição
      await pg.locator('.build .ajuda[data-ajuda="vel"]').click()
      const sobrepoe = await pg.evaluate(() => { const n = document.querySelector('.ajuda-txt').getBoundingClientRect(), b = document.querySelector('[data-status="vel"] .build-mais').getBoundingClientRect(); return n.bottom > b.top + 1 && n.top < b.bottom - 1 })
      if (sobrepoe) problems.push('ajuda-status: o texto aberto sobrepõe os botões +N da mesma linha')
      await pg.locator('.build .ajuda[data-ajuda="vel"]').click()
      // aba Skills: a skill de tipo
      await pg.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
      await confereAjuda(pg, '.vaga-tipo', 'skillTipo', OUTROS.skillTipo, 'ajuda-skills')
      // o texto da descrição da skill de tipo diz o % e "varia"/"cresce" uma vez só
      const vt = ((x) => x.replace(/\s+/g, ' ').trim())(await pg.locator('.vaga-tipo').textContent())
      if (!/\+19%/.test(vt) || (vt.match(/varia com|cresce com/g) || []).length !== 1) problems.push(`ajuda-skills: descrição da skill de tipo "${vt}"`)
      // aba Correr, cartão "Montaria ativa": Poder e liga
      await pg.locator('[data-acao="aba"][data-id="correr"]').click()
      await pg.waitForSelector('#t-correr')
      for (const k of ['poder', 'liga']) await confereAjuda(pg, '[aria-label="Montaria ativa"]', k, OUTROS[k], 'ajuda-correr')
      await checkOverflow(pg, 'ajuda-correr')
      // sala de largada: piso, clima e Dado da Sorte
      await abrirSala(pg)
      for (const k of ['piso', 'clima']) await confereAjuda(pg, '.chips', k, OUTROS[k], 'ajuda-sala')
      await confereAjuda(pg, '.dicas', 'dado', OUTROS.dado, 'ajuda-sala')
      await checkOverflow(pg, 'ajuda-sala')
      // no computador (mouse): o title basta; o botão não depende de toque. A corrida não ganha ⓘ no canvas.
      if (await pg.locator('#pista .ajuda, .corrida-baixo .ajuda').count()) problems.push('ajuda: a tela da corrida ganhou ⓘ')
    } catch (e) {
      problems.push('ajuda: ' + e.message)
    } finally {
      await pg.context().close()
    }
  }

  // ---------------- saves das telas do celular (Visuais 2, partes 3a e 3b): usados nos blocos acabamento e celular ----------------
  const mod = (tpl, o) => Object.assign({ uid: 'm1', templateId: tpl.id, name: tpl.name, especie: 'cavalo', element: tpl.element, rarity: tpl.rarity,
    grau: tpl.grau || 2, sex: tpl.sex, level: 1, xp: 0, skills: tpl.skills.slice(), potential: JSON.parse(JSON.stringify(tpl.potential)),
    palette: JSON.parse(JSON.stringify(tpl.palette)), breedLeft: 2, parents: null, born: 0, equip: {}, respecFree: true,
    alloc: { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 } }, o)
  const SAVE_3A = {
    v: 6, rev: 20, gold: 1200, tier: 100, seedBase: 3131, raceCounter: 4, redeas: 0, avisoV6: false,
    races: 3, wins: 1, podiums: 2, goldWon: 300,
    mounts: [
      mod(G.STARTERS.find((h) => h.id === 'brasa'), { uid: 'm1', level: 20, xp: 10, skills: ['sprint'], alloc: { vel: 4, acel: 4, man: 0, forca: 0, est: 2, garra: 0, sorte: 0 }, equip: { sela: 'i1' } }),
      mod(G.WILD_HORSES.find((h) => h.id === 'w-ventania'), { uid: 'm2', level: 12 }),
      mod(G.STARTERS.find((h) => h.id === 'mare'), { uid: 'm3', level: 5 })
    ],
    activeId: 'm1', nextUid: 4, stableSlots: 3, breedCounter: 0,
    items: [{ uid: 'i1', id: 'sela-comum', plus: 3 }, { uid: 'i2', id: 'testeira-comum', plus: 0 }], nextItemUid: 3, pedras: 0, enhanceCounter: 0,
    settings: { motion: 'sistema' }, joquei: { padrao: 'xadrez', capacete: '#62b8ff' }
  }
  // títulos compridos (Review Focus 2): 10 vagas cheias e a ativa com nome de 24 caracteres. O jogo corta o nome em
  // 16 e as vagas em 8 ao ler o save; o teste repõe os dois no estado depois de abrir (pior caso, com folga)
  const NOME_LONGO = 'Relâmpago da Madrugada X'
  const MODELOS_3A = [...G.STARTERS, ...G.WILD_HORSES]
  const SAVE_3A_LONGO = Object.assign({}, SAVE_3A, {
    mounts: MODELOS_3A.concat(MODELOS_3A).slice(0, 10).map((tpl, i) => mod(tpl, { uid: 'm' + (i + 1), level: 1 + 3 * i })),
    nextUid: 11, stableSlots: 10, items: [], nextItemUid: 1
  })
  SAVE_3A_LONGO.mounts[0] = mod(G.STARTERS.find((h) => h.id === 'brasa'), { uid: 'm1', name: NOME_LONGO, level: 20, xp: 10, skills: ['sprint'] })
  // 3b §2: o mesmo padrão com 6 cavalos (as metas de altura do Estábulo: 3 cavalos ≤ 780 px, 6 ≤ 1.100 px)
  const SAVE_3B_6 = Object.assign({}, SAVE_3A, {
    mounts: SAVE_3A.mounts.concat([
      mod(G.WILD_HORSES.find((h) => h.id === 'w-fogareu'), { uid: 'm4', level: 30 }),
      mod(G.WILD_HORSES.find((h) => h.id === 'w-pororoca'), { uid: 'm5', level: 8 }),
      mod(G.WILD_HORSES.find((h) => h.id === 'w-iara'), { uid: 'm6', level: 1 })
    ]),
    nextUid: 7, stableSlots: 6
  })
  // abre o jogo com o save pedido (só no 1º carregamento da aba: um reload continua com o que o jogo gravou)
  const comSave = (save) => ({ init: { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem('galope-elemental:v1', ${JSON.stringify(JSON.stringify(save))}) } } catch (e) {}` } })

  // ---------------- acabamento da interface (Visuais 2, parte 3a): fontes embutidas, sem border-image, altura, peças, títulos compridos ----------------
  // alturas da página a 360x780 com o CSS de antes da 3a (as peças e as fontes embutidas não mudam métrica)
  // medido em 2026-11-14 na `main` (7fe5124), antes da 3a: build da `main`, o mesmo save (SAVE_3A) e o mesmo caminho do
  // bloco acabamento (servidor deste teste, 360x780, scrollHeight; Skills é a aba da montaria ativa). Usado também no celular.
  const ALTURA_ANTES_3A = { estabulo: 1284, status: 1894, correr: 802, skills: 1145 }
  // 3b §2 e decisão do controlador na Tarefa 4: a meta de 1.200 px da aba Status não fecha com a cabeça do retrato grande
  // (§5, que vence quando as metas brigam): a aba Status da ativa (SAVE_3A, 360x780, sem rascunho) fica na altura medida
  // com a linha única (medi 1.454 px a 2,625 de dpr e 1.457 a 2,75; teto 1.470), e as 7 linhas cabem inteiras numa tela com as abas no topo
  const ALTURA_STATUS_3B = 1470

  if (quer('acabamento')) {
    // sem border-image no elemento nem no ::before/::after (as peças de pixel entram por pseudo-elemento)
    const semBorderImage = async (pg, tag) => {
      const ruins = await pg.evaluate(() => {
        const nome = (e) => e.tagName.toLowerCase() + (e.className && e.className.baseVal === undefined ? '.' + String(e.className).trim().split(/\s+/).join('.') : '')
        const out = []
        for (const e of document.querySelectorAll('body *')) {
          if (!(e.offsetWidth || e.offsetHeight)) continue
          for (const ps of [null, '::before', '::after']) if (getComputedStyle(e, ps).borderImageSource !== 'none') out.push(nome(e) + (ps || ''))
        }
        return out.slice(0, 6)
      })
      if (ruins.length) problems.push(`acabamento (${tag}): border-image em ${ruins.join(', ')}`)
    }
    // peças no lugar (spec §8.4): o ::before de cada elemento visível desenha peças em data:image/png com
    // image-rendering: pixelated; o h1.titulo--tela é a própria placa (com o veio no fundo), ou fica dentro de uma .placa
    const pecasNoLugar = async (pg, tag, sels) => {
      const r = await pg.evaluate((ss) => ss.map((sel) => {
        const els = [...document.querySelectorAll(sel)].filter((e) => e.offsetWidth || e.offsetHeight)
        const ruins = []
        for (const e0 of els) {
          const titulo = e0.matches('h1.titulo--tela')
          const e = titulo ? (e0.closest('.placa') || e0) : e0
          const b = getComputedStyle(e, '::before')
          if (b.content === 'none' || !b.backgroundImage.includes('data:image/png') || b.imageRendering !== 'pixelated') ruins.push(`::before ${b.content.slice(0, 8)} ${b.backgroundImage.slice(0, 24)} ${b.imageRendering}`)
          if (titulo && !getComputedStyle(e).backgroundImage.includes('data:image/png')) ruins.push('sem o veio no fundo')
        }
        return { sel, n: els.length, ruins: ruins.slice(0, 3) }
      }), sels)
      for (const x of r) {
        if (!x.n) problems.push(`acabamento (${tag}): nenhum ${x.sel} visível`)
        else if (x.ruins.length) problems.push(`acabamento (${tag}): ${x.sel} sem as peças (${x.ruins.join('; ')})`)
      }
    }
    // moldura: o box-shadow de cada elemento visível do seletor leva todas as cores (tokens do :root) pedidas
    const temCores = async (pg, tag, sel, tokens) => {
      const r = await pg.evaluate(([s, toks]) => {
        const cor = (t) => { const d = document.createElement('i'); d.style.color = `var(${t})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c }
        const cores = toks.map(cor)
        const els = [...document.querySelectorAll(s)].filter((e) => e.offsetWidth || e.offsetHeight)
        const faltam = els.map((e) => { const bs = getComputedStyle(e).boxShadow; return toks.filter((t, i) => !bs.includes(cores[i])) }).find((f) => f.length) || []
        return { n: els.length, faltam }
      }, [sel, tokens])
      if (!r.n) problems.push(`acabamento (${tag}): nenhum ${sel} visível`)
      else if (r.faltam.length) problems.push(`acabamento (${tag}): ${sel} sem ${r.faltam.join(', ')} na moldura`)
    }
    // o texto do título fica dentro da placa (quebra a linha em vez de sair dela)
    const tituloCabe = async (pg, tag) => {
      const fora = await pg.evaluate(() => [...document.querySelectorAll('h1.titulo--tela')].filter((e) => e.offsetWidth && e.scrollWidth > e.clientWidth + 1).map((e) => e.id))
      if (fora.length) problems.push(`acabamento (${tag}): o texto sai da placa do título (${fora.join(', ')})`)
    }
    // ---- Tarefa 4: botões, abas, barras, selos, ⓘ e fonte display ----
    // fonte display (spec §3): nenhum elemento visível com a Press Start 2P fora de 8, 16 ou 24 px
    const displayNaEscala = async (pg, tag) => {
      const ruins = await pg.evaluate(() => {
        const nome = (e) => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '')
        const out = new Set()
        for (const e of document.querySelectorAll('body *')) {
          if (!(e.offsetWidth || e.offsetHeight)) continue
          const cs = getComputedStyle(e)
          if (!/^\s*["']?Press Start 2P/.test(cs.fontFamily)) continue
          if (!['8px', '16px', '24px'].includes(cs.fontSize)) out.add((e.parentElement ? nome(e.parentElement) + ' > ' : '') + nome(e) + ' ' + cs.fontSize)
        }
        return [...out].slice(0, 10)
      })
      if (ruins.length) problems.push(`acabamento (${tag}): Press Start 2P fora de 8/16/24 px em ${ruins.join(', ')}`)
    }
    // ⓘ desenhado (spec §4.13): sem o caractere no texto; o ::before de 14x14 px com --arte-ajuda (aberto: --arte-ajuda-ativa).
    // O mouse sai de cima antes (com o mouse em cima, a peça é a ativa).
    const ajudaDesenhada = async (pg, tag, abertos = 0) => {
      await pg.mouse.move(0, 0)
      const r = await pg.evaluate(() => {
        const b64 = (s) => (String(s).match(/base64,([A-Za-z0-9+/=]+)/) || [])[1] || ''
        const raiz = getComputedStyle(document.documentElement)
        const arte = b64(raiz.getPropertyValue('--arte-ajuda')), ativa = b64(raiz.getPropertyValue('--arte-ajuda-ativa'))
        const els = [...document.querySelectorAll('.ajuda')].filter((e) => e.offsetWidth || e.offsetHeight)
        const ruins = []
        let nAbertos = 0
        for (const e of els) {
          const id = e.getAttribute('data-ajuda') || e.getAttribute('aria-label')
          const aberto = e.getAttribute('aria-expanded') === 'true'
          if (aberto) nAbertos++
          const b = getComputedStyle(e, '::before')
          if (e.textContent.includes('ⓘ')) ruins.push(`${id}: "ⓘ" no texto`)
          if (b.content === 'none' || b64(b.backgroundImage) !== (aberto ? ativa : arte)) ruins.push(`${id}${aberto ? ' (aberto)' : ''}: ::before sem --arte-ajuda${aberto ? '-ativa' : ''}`)
          if (b.imageRendering !== 'pixelated' || b.width !== '14px' || b.height !== '14px') ruins.push(`${id}: peça ${b.width}x${b.height} ${b.imageRendering}`)
        }
        return { n: els.length, nAbertos, pecas: !!arte && !!ativa && arte !== ativa, ruins: ruins.slice(0, 4) }
      })
      if (!r.pecas) problems.push(`acabamento (${tag}): --arte-ajuda e --arte-ajuda-ativa ausentes ou iguais no :root`)
      if (!r.n) problems.push(`acabamento (${tag}): nenhum ⓘ visível`)
      if (r.nAbertos < abertos) problems.push(`acabamento (${tag}): nenhum ⓘ aberto para conferir a peça ativa`)
      if (r.ruins.length) problems.push(`acabamento (${tag}): ⓘ ${r.ruins.join('; ')}`)
    }
    // abre o primeiro ⓘ visível do escopo, confere a peça ativa (sem o mouse em cima) e fecha
    const ajudaAberta = async (pg, tag, escopo) => {
      const b = pg.locator(`${escopo} .ajuda`).first()
      await b.click()
      await ajudaDesenhada(pg, tag + ' aberto', 1)
      await b.click()
    }
    // contraste (spec §3): texto sobre o fundo calculado de botões, chips e selos; fundo transparente fica de fora.
    // Devolve as classes conferidas (para exigir as variantes onde todas aparecem).
    const SEL_CONTRASTE = '.btn, .raridade, .chip, .selo-nivel, .pontos-livres--selo, .badge-ativa, .set-badge, .tag-voce'
    const contrasteOk = async (pg, tag) => {
      const r = await pg.evaluate((sel) => {
        const rgb = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 } }
        const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
        const nome = (e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.')
        const ruins = new Set(), vistos = {}
        for (const e of document.querySelectorAll(sel)) {
          if (!(e.offsetWidth || e.offsetHeight) || !e.textContent.trim()) continue
          const cs = getComputedStyle(e), fg = rgb(cs.color), bg = rgb(cs.backgroundColor)
          if (!bg || bg.a === 0) continue
          if (bg.a < 1 || !fg || fg.a < 1) { ruins.add(`${nome(e)} com cor semitransparente (${cs.color} sobre ${cs.backgroundColor})`); continue }
          const l1 = lum(fg.c), l2 = lum(bg.c), razao = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
          const px = parseFloat(cs.fontSize), grande = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700)
          for (const c of e.classList) vistos[c] = (vistos[c] || 0) + 1
          if (razao < (grande ? 3 : 4.5)) ruins.add(`${nome(e)} "${e.textContent.trim().slice(0, 16)}" ${razao.toFixed(2)}:1`)
        }
        return { ruins: [...ruins].slice(0, 6), vistos }
      }, SEL_CONTRASTE)
      if (r.ruins.length) problems.push(`acabamento (${tag}): contraste abaixo do mínimo em ${r.ruins.join(', ')}`)
      return r.vistos
    }
    // sombras de um elemento (box-shadow calculado), com a cor em rgb() e os deslocamentos em px
    const sombrasDe = (pg, sel, ps = null) => pg.evaluate(([s, p]) => [...document.querySelectorAll(s)].filter((e) => e.offsetWidth || e.offsetHeight).map((e) => {
      const bs = getComputedStyle(e, p).boxShadow
      return bs === 'none' ? [] : bs.split(/,(?![^(]*\))/).map((x) => {
        const cor = (x.match(/rgba?\([^)]*\)/) || [''])[0]
        const n = x.replace(cor, '').trim().split(/\s+/)
        const v = n.filter((k) => k !== 'inset').map(parseFloat)
        return { cor, x: v[0] || 0, y: v[1] || 0, spread: v[3] || 0, inset: n.includes('inset') }
      })
    }), [sel, ps])
    const corDe = (pg, token) => pg.evaluate((t) => { const d = document.createElement('i'); d.style.color = `var(${t})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c }, token)
    // aba atual (spec §4.8): marca de ouro de 2 px por dentro (no topo; na barra lateral do desktop, à esquerda) e sem a
    // sombra de baixo; as outras abas são botões, com a sombra de 4 px
    const abaAtual = async (pg, tag, sel, lado) => {
      const ouro = await corDe(pg, '--ouro')
      const todas = await sombrasDe(pg, sel)
      if (!todas.length) { problems.push(`acabamento (${tag}): nenhuma ${sel} visível`); return }
      for (const s of todas) {
        const marca = s.some((x) => x.inset && x.cor === ouro && (lado === 'esquerda' ? x.x === 2 && x.y === 0 : x.x === 0 && x.y === 2) && !x.spread)
        if (!marca) problems.push(`acabamento (${tag}): ${sel} sem a marca de ouro de 2 px ${lado === 'esquerda' ? 'à esquerda' : 'no topo'}`)
        if (s.some((x) => !x.inset && x.y > 2)) problems.push(`acabamento (${tag}): ${sel} com a sombra de baixo (a aba atual encaixa)`)
      }
    }
    // apertar (mouse para baixo) mantém a moldura pedida e desce 2 px
    const apertaEConfere = async (pg, tag, sel, tokens) => {
      const el = pg.locator(sel).first()
      await el.scrollIntoViewIfNeeded()
      const box = await el.boundingBox()
      await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await pg.mouse.down()
      const r = await el.evaluate((e, toks) => {
        const cor = (t) => { const d = document.createElement('i'); d.style.color = `var(${t})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c }
        const cs = getComputedStyle(e)
        return { t: cs.transform, faltam: toks.filter((t) => !cs.boxShadow.includes(cor(t))) }
      }, tokens)
      await pg.mouse.up()
      if (r.t !== 'matrix(1, 0, 0, 1, 0, 2)') problems.push(`acabamento (${tag}): ${sel} apertado não desce 2 px (transform ${r.t})`)
      if (r.faltam.length) problems.push(`acabamento (${tag}): ${sel} apertado perde ${r.faltam.join(', ')} da moldura`)
    }
    // selos e chips (spec §4.10): contorno --sombra e, nos selos, o canto recortado por clip-path em degraus
    const selosRecortados = async (pg, tag, sel, comClip) => {
      const r = await pg.evaluate(([s, clip]) => {
        const d = document.createElement('i'); d.style.color = 'var(--sombra)'; document.body.appendChild(d); const sombra = getComputedStyle(d).color; d.remove()
        const els = [...document.querySelectorAll(s)].filter((e) => e.offsetWidth || e.offsetHeight)
        const ruins = els.filter((e) => { const cs = getComputedStyle(e); return !cs.boxShadow.includes(sombra) || (clip && !/^polygon\(/.test(cs.clipPath)) }).map((e) => e.className)
        return { n: els.length, ruins: ruins.slice(0, 3) }
      }, [sel, comClip])
      if (!r.n) problems.push(`acabamento (${tag}): nenhum ${sel} visível`)
      else if (r.ruins.length) problems.push(`acabamento (${tag}): ${sel} sem o contorno --sombra${comClip ? ' ou sem o canto recortado (clip-path)' : ''}: ${r.ruins.join(', ')}`)
    }
    {
      // fontes sem rede: os @font-face levam as duas famílias embutidas em data:
      const pg = await newPage(browser, { width: 360, height: 780 }, 'acabamento-fontes', { bloquear: ['**/fonts.googleapis.com/**', '**/fonts.gstatic.com/**'] })
      try {
        await pg.waitForSelector('.inicial')
        const r = await pg.evaluate(async () => {
          await document.fonts.ready
          const carregadas = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''))
          return { ps: document.fonts.check('16px "Press Start 2P"'), jy: document.fonts.check('20px "Jersey 10"'), carregadas }
        })
        if (!r.ps || !r.jy) problems.push(`acabamento: document.fonts.check sem rede deu ${JSON.stringify({ ps: r.ps, jy: r.jy })}`)
        for (const fam of ['Press Start 2P', 'Jersey 10']) if (!r.carregadas.includes(fam)) problems.push(`acabamento: a face "${fam}" não ficou loaded sem rede (${JSON.stringify(r.carregadas)})`)
        await semBorderImage(pg, 'inicial')
        // tela inicial: display na escala, ⓘ desenhado (fechado e aberto) e contraste
        await displayNaEscala(pg, 'inicial')
        await ajudaDesenhada(pg, 'inicial')
        await ajudaAberta(pg, 'inicial', '#ini-brasa .status')
        await contrasteOk(pg, 'inicial')
      } catch (e) {
        problems.push('acabamento-fontes: ' + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      // altura: Estábulo e aba Status da ativa, save v6 com 3 montarias, a 360x780
      const pg = await newPage(browser, { width: 360, height: 780 }, 'acabamento-altura', {
        init: { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem('galope-elemental:v1', ${JSON.stringify(JSON.stringify(SAVE_3A))}) } } catch (e) {}` }
      })
      try {
        await pg.waitForSelector('#t-estabulo')
        const altura = () => pg.evaluate(() => document.documentElement.scrollHeight)
        const aEst = await altura()
        notes.alturaAcabamento = { estabulo: aEst }
        // 3b §2: o Estábulo em lista de linhas cabe numa tela (era 1,04 × a medida de antes da 3a)
        if (aEst > 780) problems.push(`acabamento: Estábulo com ${aEst}px (limite 780, spec 3b §2; antes da 3a ${ALTURA_ANTES_3A.estabulo})`)
        await semBorderImage(pg, 'estabulo')
        // painel, saldo e título com as peças; molduras do painel, do destaque (montaria ativa), do saldo e do retrato
        await pecasNoLugar(pg, 'estabulo', ['.caixa', '.saldo', 'h1.titulo--tela', '.montaria--ativa'])
        await temCores(pg, 'estabulo', '.caixa', ['--sombra', '--linha', '--linha-luz', '--painel-3', '--noite-2'])
        await temCores(pg, 'estabulo', '.montaria--ativa', ['--sombra', '--ouro-escuro', '--ouro'])
        await temCores(pg, 'estabulo', '.saldo', ['--sombra', '--ouro-escuro'])
        await temCores(pg, 'estabulo', 'h1.titulo--tela', ['--sombra', '--madeira-luz', '--madeira-2'])
        await temCores(pg, 'estabulo', '.retrato', ['--sombra', '--madeira', '--madeira-luz'])
        await pg.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pg.waitForSelector('#t-montaria')
        await pg.locator('[data-acao="montaria-aba"][data-id="status"]').click()
        const aSt = await altura()
        notes.alturaAcabamento.status = aSt
        // 3b §2: a linha única (era 1,04 × a medida de antes da 3a)
        if (aSt > ALTURA_STATUS_3B) problems.push(`acabamento: aba Status com ${aSt}px (limite ${ALTURA_STATUS_3B}, Tarefa 4 da 3b; antes da 3a ${ALTURA_ANTES_3A.status})`)
        await semBorderImage(pg, 'status')
        await pecasNoLugar(pg, 'status', ['.caixa', 'h1.titulo--tela'])
        await temCores(pg, 'status', '.opcao[aria-pressed="true"]', ['--sombra', '--ouro-escuro', '--ouro'])
        await pg.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
        const aSk = await altura()
        notes.alturaAcabamento.skills = aSk
        if (aSk > 1.04 * ALTURA_ANTES_3A.skills) problems.push(`acabamento: aba Skills com ${aSk}px (limite ${Math.round(1.04 * ALTURA_ANTES_3A.skills)}, antes ${ALTURA_ANTES_3A.skills})`)
        await semBorderImage(pg, 'skills')
        await pg.locator('[data-acao="aba"][data-id="correr"]').click()
        await pg.waitForSelector('#t-correr')
        const aCor = await altura()
        notes.alturaAcabamento.correr = aCor
        if (aCor > 1.04 * ALTURA_ANTES_3A.correr) problems.push(`acabamento: aba Correr com ${aCor}px (limite ${Math.round(1.04 * ALTURA_ANTES_3A.correr)}, antes ${ALTURA_ANTES_3A.correr})`)
        await semBorderImage(pg, 'correr')
        await pecasNoLugar(pg, 'correr', ['.caixa', '.saldo', 'h1.titulo--tela'])
        await temCores(pg, 'correr', '.opcao[aria-pressed="true"]', ['--sombra', '--ouro-escuro', '--ouro'])
        // sala de largada: a .placa de hoje (rótulo + título) é uma placa só, sem placa dentro de placa
        await pg.locator('[data-acao="procurar"]').click()
        await pg.waitForSelector('#t-largada')
        await semBorderImage(pg, 'largada')
        await pecasNoLugar(pg, 'largada', ['.placa', 'h1.titulo--tela', '.saldo', '.caixa'])
        const dupla = await pg.evaluate(() => [...document.querySelectorAll('.placa .titulo--tela')].filter((e) => getComputedStyle(e).backgroundImage !== 'none' || getComputedStyle(e, '::before').content !== 'none').length)
        if (dupla) problems.push(`acabamento (largada): título com placa própria dentro da .placa (${dupla})`)
        await tituloCabe(pg, 'largada')
      } catch (e) {
        problems.push('acabamento-altura: ' + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      // títulos compridos a 360 px (Review Focus 2): a placa quebra a linha, sem rolagem lateral em nenhuma tela
      const pg = await newPage(browser, { width: 360, height: 780 }, 'acabamento-longo', {
        init: { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem('galope-elemental:v1', ${JSON.stringify(JSON.stringify(SAVE_3A_LONGO))}) } } catch (e) {}` }
      })
      const aba = async (id) => { await pg.locator(`[data-acao="aba"][data-id="${id}"]`).click(); await pg.waitForSelector('#t-' + id) }
      const confere = async (tag) => { await checkOverflow(pg, 'acabamento-longo ' + tag); await tituloCabe(pg, 'longo ' + tag) }
      try {
        await pg.waitForSelector('#t-estabulo')
        await pg.evaluate((nome) => { const s = window.__galope.state; s.stableSlots = 10; s.mounts[0].name = nome }, NOME_LONGO)
        await aba('correr')   // redesenha com o estado reposto
        await aba('estabulo')
        const t = await pg.evaluate(() => ({ est: document.getElementById('t-estabulo').textContent, n: document.querySelectorAll('.montaria-linha').length }))
        if (!/10\/10 vagas/.test(t.est) || t.n !== 10) problems.push(`acabamento-longo: o Estábulo não ficou com 10/10 vagas (${JSON.stringify(t)})`)
        await confere('estabulo')
        await pg.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pg.waitForSelector('#t-montaria')
        if (!(await pg.locator('#t-montaria').textContent()).includes(NOME_LONGO)) problems.push('acabamento-longo: a Montaria não mostra o nome de 24 caracteres')
        for (const sub of ['status', 'skills', 'ficha']) {
          await pg.locator(`[data-acao="montaria-aba"][data-id="${sub}"]`).click()
          await confere('montaria ' + sub)
        }
        for (const id of ['correr', 'haras', 'expedicao']) { await aba(id); await confere(id) }
        await pg.locator('[data-acao="perfil"]').click()
        await pg.waitForSelector('#t-perfil')
        await confere('perfil')
        if (process.env.SHOTS_DIR) { await aba('estabulo'); await pg.screenshot({ path: join(SHOTS, 'acabamento-longo-estabulo.png') }) }   // só na pasta temporária
      } catch (e) {
        problems.push('acabamento-longo: ' + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      // folha da interface (dist/interface.html): uma seção por componente da spec §4 e cada peça ampliada x4
      const COMPONENTES = ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10', '4.11', '4.12', '4.13', '4.14', '4.15', '4.16', '4.17']
      for (const [larg, alt] of [[360, 780], [1280, 800]]) {
        const pg = await newPage(browser, { width: larg, height: alt }, `acabamento-folha-${larg}`, { pagina: 'interface.html', moldes: false })
        try {
          await pg.waitForSelector('[data-componente]')
          await checkOverflow(pg, `folha ${larg}`)
          const r = await pg.evaluate(() => ({
            comps: [...document.querySelectorAll('[data-componente]')].map((e) => e.getAttribute('data-componente')),
            pecas: [...document.querySelectorAll('[data-peca]')].map((e) => ({ nome: e.getAttribute('data-peca'), w: e.querySelector('img') ? e.querySelector('img').getBoundingClientRect().width : 0, nat: e.querySelector('img') ? e.querySelector('img').naturalWidth : 0, txt: e.textContent }))
          }))
          for (const c of COMPONENTES) if (!r.comps.includes(c)) problems.push(`acabamento (folha ${larg}): falta a seção do componente ${c}`)
          for (const p of PECAS_ARTE) {
            const a = r.pecas.find((x) => x.nome === p.nome)
            if (!a) problems.push(`acabamento (folha ${larg}): a peça "${p.nome}" não aparece`)
            else if (!a.txt.includes(p.nome) || a.nat < 1 || Math.abs(a.w - 4 * a.nat) > 0.5) problems.push(`acabamento (folha ${larg}): a peça "${p.nome}" não está ampliada x4 com o nome (largura ${a.w}, original ${a.nat})`)
          }
          await semBorderImage(pg, `folha ${larg}`)
          // a folha mostra os componentes da Tarefa 3 com o acabamento (avisos só aparecem nela sem montar uma sala)
          await pecasNoLugar(pg, `folha ${larg}`, ['.caixa', '.placa', 'h1.titulo--tela', '.saldo', '.montaria--ativa'])
          await temCores(pg, `folha ${larg}`, '.aviso:not(.aviso--perda)', ['--sombra', '--ouro'])
          await temCores(pg, `folha ${larg}`, '.aviso--perda', ['--sombra', '--perda'])
          await temCores(pg, `folha ${larg}`, '.opcao[aria-pressed="true"]', ['--sombra', '--ouro-escuro', '--ouro'])
          const destaqueVelho = await pg.evaluate(() => document.querySelectorAll('.caixa--destaque').length)
          if (destaqueVelho) problems.push(`acabamento (folha ${larg}): a folha usa a classe .caixa--destaque, que não existe no jogo`)
          // Tarefa 4: display na escala, ⓘ desenhado (o exemplo "aberto" com a peça ativa) e contraste de todas as variantes
          await displayNaEscala(pg, `folha ${larg}`)
          await ajudaDesenhada(pg, `folha ${larg}`, 1)
          const vistos = await contrasteOk(pg, `folha ${larg}`)
          for (const c of ['btn', 'btn--ouro', 'btn--perigo', 'opcao', 'chip', 'raridade--comum', 'raridade--magico', 'raridade--raro', 'raridade--lendario', 'raridade--mitico', 'badge-ativa', 'selo-nivel', 'pontos-livres--selo', 'set-badge']) {
            if (!vistos[c]) problems.push(`acabamento (folha ${larg}): contraste de .${c} não conferido (sem texto ou sem fundo)`)
          }
          // botão (§4.4, §4.5): contorno --sombra e bisel em 3 tons
          await temCores(pg, `folha ${larg}`, '[data-componente="4.4"] .btn:not(:disabled):not(.apertado-demo)', ['--sombra', '--linha-luz', '--painel', '--noite-2'])
          await temCores(pg, `folha ${larg}`, '[data-componente="4.5"] .btn--ouro:not(:disabled):not(.apertado-demo)', ['--sombra', '--ouro-claro', '--ouro-medio', '--ouro-escuro'])
          // apertado (§4.4, §4.7): desce 2 px e a sombra muda, também na opção; a escolhida apertada continua com o destaque
          const APERTOS = [
            ['4.4', '.btn.apertado-demo', '.btn:not(.apertado-demo):not(.foco-demo):not(:disabled)'],
            ['4.5', '.btn--ouro.apertado-demo', '.btn--ouro:not(.apertado-demo):not(.foco-demo):not(:disabled)'],
            ['4.7', '.opcao[aria-pressed="false"].apertado-demo', '.opcao[aria-pressed="false"]:not(.apertado-demo):not(.foco-demo):not(:disabled)'],
            ['4.7', '.opcao[aria-pressed="true"].apertado-demo', '.opcao[aria-pressed="true"]:not(.apertado-demo)']
          ]
          const ap = await pg.evaluate((lista) => lista.map(([c, sa, sn]) => {
            const a = document.querySelector(`[data-componente="${c}"] .col--estreita ${sa}`), n = document.querySelector(`[data-componente="${c}"] .col--estreita ${sn}`)
            return { c, sa, ok: !!(a && n), t: a ? getComputedStyle(a).transform : '', igual: a && n ? getComputedStyle(a).boxShadow === getComputedStyle(n).boxShadow : true }
          }), APERTOS)
          for (const x of ap) {
            if (!x.ok) problems.push(`acabamento (folha ${larg}): falta o estado ${x.sa} em ${x.c}`)
            else if (x.t !== 'matrix(1, 0, 0, 1, 0, 2)' || x.igual) problems.push(`acabamento (folha ${larg}): ${x.sa} em ${x.c} não parece apertado (transform ${x.t}, sombra ${x.igual ? 'igual à do normal' : 'diferente'})`)
          }
          await temCores(pg, `folha ${larg} escolhida apertada`, '.opcao[aria-pressed="true"].apertado-demo', ['--sombra', '--ouro-escuro', '--ouro'])
          // abas (§4.8): a atual com a marca de ouro (no topo; na barra lateral do desktop, à esquerda) e sem a sombra de baixo
          await abaAtual(pg, `folha ${larg}`, '.app-aba--ativa', larg >= 900 ? 'esquerda' : 'topo')
          await abaAtual(pg, `folha ${larg}`, '.abas .opcao[aria-pressed="true"]', 'topo')
          await temCores(pg, `folha ${larg}`, '.app-abas', ['--sombra', '--linha'])
          // barras (§4.9): sulco com contorno --sombra e fundo --noite-2; selos e chips (§4.10)
          await temCores(pg, `folha ${larg}`, '[data-componente="4.9"] .barra', ['--sombra'])
          const fundoBarra = await pg.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--noite-2)'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return [...document.querySelectorAll('[data-componente="4.9"] .barra')].filter((e) => getComputedStyle(e).backgroundColor !== c).length })
          if (fundoBarra) problems.push(`acabamento (folha ${larg}): ${fundoBarra} barra(s) sem o fundo --noite-2`)
          await selosRecortados(pg, `folha ${larg}`, '[data-componente="4.10"] .raridade, [data-componente="4.10"] .badge-ativa, [data-componente="4.10"] .set-badge, .selo-nivel, .pontos-livres--selo', true)
          await selosRecortados(pg, `folha ${larg}`, '[data-componente="4.10"] .chip', false)
          // faixa de ordem da 3c (§4.16): o markup do atualizaOrdem (posição, selo da raia, linha do Dado, nome no .sr, nessa
          // ordem), 8 itens numa linha, altura 68 px (28 em tela baixa, sem os vizinhos), o jogador com o friso de ouro, o
          // vencedor do Dado com o número em --ouro/--tinta (em tela baixa, no lugar da posição)
          const fo = await pg.evaluate(() => {
            const cor = (t) => { const d = document.createElement('i'); d.style.color = `var(${t})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c }
            const ouro = cor('--ouro'), tinta = cor('--tinta')
            return [...document.querySelectorAll('[data-componente="4.16"] .col--estreita .estado')].map((est) => {
              const o = est.querySelector('.ordem'), baixa = !!est.querySelector('.tela--baixa'), itens = [...est.querySelectorAll('.ordem-item')]
              const estrutura = itens.every((li) => /^ordem-pos\|raia seda-(voce|[0-7]) raia--mini\|ordem-dado\|sr$/.test([...li.children].map((c) => c.className).join('|')))
              const tops = new Set(itens.map((li) => Math.round(li.getBoundingClientRect().top)))
              const maior = est.querySelector('.ordem-item--maior'), marca = maior && maior.querySelector(baixa ? '.ordem-pos' : '.ordem-dado')
              const cm = marca ? getComputedStyle(marca) : null
              const viz = est.querySelector('.ordem-vizinhos')
              return { rot: est.querySelector('.estado-rot').textContent, n: itens.length, voce: est.querySelectorAll('.ordem-item--voce').length, estrutura, linhas: tops.size,
                h: o ? Math.round(o.getBoundingClientRect().height) : 0, baixa, vizVisivel: !!(viz && viz.offsetHeight), nMaior: est.querySelectorAll('.ordem-item--maior').length,
                marcaOk: !maior || !!(cm && cm.backgroundColor === ouro && cm.color === tinta && marca.textContent.trim()), dados: itens.filter((li) => li.querySelector('.ordem-dado').textContent.trim()).length }
            })
          })
          if (fo.length !== 4) problems.push(`acabamento (folha ${larg}): a faixa de ordem tem ${fo.length} estados (esperado 4)`)
          for (const x of fo) {
            const ruim = []
            if (x.n !== 8 || x.voce !== 1 || !x.estrutura) ruim.push(`markup (${x.n} itens, ${x.voce} do jogador, estrutura ${x.estrutura ? 'ok' : 'diferente do jogo'})`)
            if (x.linhas !== 1) ruim.push(`itens em ${x.linhas} linhas`)
            if (x.h !== (x.baixa ? 28 : 68)) ruim.push(`altura ${x.h} px (esperado ${x.baixa ? 28 : 68})`)
            if (x.vizVisivel === x.baixa) ruim.push(x.baixa ? 'vizinhos visíveis em tela baixa' : 'sem a linha dos vizinhos')
            const comDado = /Dado/.test(x.rot)
            if (comDado && (x.nMaior !== 1 || !x.marcaOk)) ruim.push(`vencedor do Dado sem a marca --ouro/--tinta (${x.nMaior} marcados)`)
            if (comDado && x.dados !== (x.baixa ? 0 : 8)) ruim.push(`${x.dados} números na linha do Dado`)
            if (!comDado && (x.nMaior || x.dados)) ruim.push('números do Dado fora do Dado')
            if (ruim.length) problems.push(`acabamento (folha ${larg}): faixa de ordem "${x.rot}": ${ruim.join('; ')}`)
          }
          await temCores(pg, `folha ${larg}`, '[data-componente="4.16"] .ordem-item--voce', ['--sombra', '--ouro', '--ouro-escuro'])
          await temCores(pg, `folha ${larg}`, '[data-componente="4.16"] .ordem-item:not(.ordem-item--voce)', ['--sombra', '--brilho-08', '--escuro-25'])
          // abas do resultado (§4.17): duas sub-abas numa linha, uma só apertada, com a marca de ouro no topo
          const ab = await pg.evaluate(() => [...document.querySelectorAll('[data-componente="4.17"] .col--estreita .subabas')].map((g) => {
            const bs = [...g.querySelectorAll('.opcao')]
            return { n: bs.length, apertadas: bs.filter((b) => b.getAttribute('aria-pressed') === 'true').length, linhas: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size }
          }))
          if (ab.length !== 2 || ab.some((x) => x.n !== 2 || x.apertadas !== 1 || x.linhas !== 1)) problems.push(`acabamento (folha ${larg}): abas do resultado fora do esperado (${JSON.stringify(ab)})`)
          await abaAtual(pg, `folha ${larg}`, '[data-componente="4.17"] .subabas .opcao[aria-pressed="true"]', 'topo')
        } catch (e) {
          problems.push(`acabamento-folha-${larg}: ` + e.message)
        } finally {
          await pg.context().close()
        }
      }
      // densidade fracionada (2,625): captura para o controlador conferir as emendas (fora de prototype/screens/)
      const pg = await newPage(browser, { width: 360, height: 780 }, 'acabamento-folha-2625', { pagina: 'interface.html', moldes: false, deviceScaleFactor: 2.625 })
      try {
        await pg.waitForSelector('[data-componente]')
        if (process.env.SHOTS_DIR) await pg.screenshot({ path: join(SHOTS, 'interface-2625.png'), fullPage: true })
      } catch (e) {
        problems.push('acabamento-folha-2625: ' + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      // Tarefa 4 nas telas do jogo a 360x780: display na escala, ⓘ desenhado, contraste, abas e apertar a escolhida
      const pg = await newPage(browser, { width: 360, height: 780 }, 'acabamento-telas', comSave(SAVE_3A))
      const aba = async (id) => { await pg.locator(`[data-acao="aba"][data-id="${id}"]`).click(); await pg.waitForSelector('#t-' + id) }
      const confere = async (tag) => { await displayNaEscala(pg, tag); await contrasteOk(pg, tag); await checkOverflow(pg, 'acabamento-telas ' + tag) }
      try {
        await pg.waitForSelector('#t-estabulo')
        await confere('estabulo')
        await abaAtual(pg, 'estabulo', '.app-aba--ativa', 'topo')
        await temCores(pg, 'estabulo', '.app-abas', ['--sombra', '--linha'])
        await selosRecortados(pg, 'estabulo', '.raridade, .badge-ativa, .selo-nivel, .pontos-livres--selo', true)
        await pg.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pg.waitForSelector('#t-montaria')
        await pg.locator('[data-acao="montaria-aba"][data-id="status"]').click()
        await confere('status')
        await ajudaDesenhada(pg, 'status')
        await ajudaAberta(pg, 'status', '.build')
        await abaAtual(pg, 'status', '.subabas .opcao[aria-pressed="true"]', 'topo')
        // a sub-aba atual apertada continua com o destaque e só desce 2 px
        await apertaEConfere(pg, 'status', '.subabas .opcao[aria-pressed="true"]', ['--sombra', '--ouro-escuro', '--ouro'])
        await pg.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
        await confere('skills')
        // aba Ficha (3b §5) e a cabeça: o selo "Ativa" na placa, a raridade e os selos do retrato grande com o canto recortado
        await pg.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
        await confere('ficha')
        await selosRecortados(pg, 'ficha', '.montaria-cabeca .raridade, .montaria-cabeca .badge-ativa, .montaria-cabeca .selo-nivel, .montaria-cabeca .pontos-livres--selo', true)
        await aba('correr')
        await confere('correr')
        await ajudaDesenhada(pg, 'correr')
        // a opção escolhida (entrada da corrida) apertada continua com o destaque e só desce 2 px
        await apertaEConfere(pg, 'correr', '.opcao[aria-pressed="true"][data-acao="tier"]', ['--sombra', '--ouro-escuro', '--ouro'])
        await pg.locator('[data-acao="procurar"]').click()
        await pg.waitForSelector('#t-largada')
        await confere('largada')
        await ajudaDesenhada(pg, 'largada')
        await selosRecortados(pg, 'largada', '.chip', false)
        // uma corrida até o resultado (com subida de nível), pelo "Pular para o resultado"
        await pg.evaluate(() => { window.__galope.state.mounts[0].xp = 10000 })
        await pg.getByRole('button', { name: /^Largar/ }).click()
        await pg.waitForSelector('#pista')
        await sleep(600)
        await displayNaEscala(pg, 'corrida')
        {
          // a velocidade escolhida (ouro) apertada desce 2 px e perde a sombra de 4 px; desabilitada, bisel escuro também no topo
          const sel = '.controles .vel .btn[aria-pressed="true"]'
          const el = pg.locator(sel).first()
          const box = await el.boundingBox()
          await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          await pg.mouse.down()
          const ap = await el.evaluate((e) => ({ t: getComputedStyle(e).transform, bs: getComputedStyle(e).boxShadow }))
          await pg.mouse.up()
          if (ap.t !== 'matrix(1, 0, 0, 1, 0, 2)') problems.push(`acabamento (corrida): ${sel} apertado não desce 2 px (transform ${ap.t})`)
          if (/(^|, )rgb[^)]*\) 0px 4px 0px 0px(,|$)/.test(ap.bs)) problems.push(`acabamento (corrida): ${sel} apertado mantém a sombra de 4 px`)
          const des = await el.evaluate((e) => {
            const cor = (t) => { const d = document.createElement('i'); d.style.color = `var(${t})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c }
            e.disabled = true
            const bs = getComputedStyle(e).boxShadow
            e.disabled = false
            return bs.includes(`${cor('--ouro-escuro')} 0px 2px 0px 0px inset`)
          })
          if (!des) problems.push(`acabamento (corrida): ${sel} desabilitado sem o bisel escuro no topo`)
        }
        await pg.getByRole('button', { name: /Pular/ }).click()
        await pg.waitForSelector('#t-resultado')
        await confere('resultado')
        if (!(await pg.locator('.levelup').count())) problems.push('acabamento-telas: o resultado não mostrou a subida de nível')
        await pg.locator('[data-acao="voltar"]').click()   // o resultado não tem a casca: "Voltar" leva à aba Correr
        await pg.waitForSelector('#t-correr')
        for (const id of ['haras', 'expedicao']) { await aba(id); await confere(id) }
        await pg.locator('[data-acao="perfil"]').click()
        await pg.waitForSelector('#t-perfil')
        await confere('perfil')
      } catch (e) {
        problems.push('acabamento-telas: ' + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      // Review Focus 3: desktop (1280x800), a barra de abas vira coluna à esquerda: sem rolagem lateral em nenhuma aba e
      // a aba atual com a marca de ouro à esquerda
      const pg = await newPage(browser, { width: 1280, height: 800 }, 'acabamento-desktop', comSave(SAVE_3A))
      const aba = async (id) => { await pg.locator(`[data-acao="aba"][data-id="${id}"]`).click(); await pg.waitForSelector('#t-' + id) }
      try {
        await pg.waitForSelector('#t-estabulo')
        await checkOverflow(pg, 'acabamento-desktop estabulo')
        await abaAtual(pg, 'desktop', '.app-aba--ativa', 'esquerda')
        await temCores(pg, 'desktop', '.app-abas', ['--sombra', '--linha'])
        await pg.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pg.waitForSelector('#t-montaria')
        for (const sub of ['status', 'skills', 'ficha']) { await pg.locator(`[data-acao="montaria-aba"][data-id="${sub}"]`).click(); await checkOverflow(pg, 'acabamento-desktop montaria ' + sub) }
        for (const id of ['correr', 'haras', 'expedicao']) {
          await aba(id)
          await checkOverflow(pg, 'acabamento-desktop ' + id)
          await abaAtual(pg, 'desktop ' + id, '.app-aba--ativa', 'esquerda')
        }
        await pg.locator('[data-acao="perfil"]').click()
        await pg.waitForSelector('#t-perfil')
        await checkOverflow(pg, 'acabamento-desktop perfil')
        await displayNaEscala(pg, 'desktop perfil')
        if (process.env.SHOTS_DIR) { await aba('correr'); await pg.screenshot({ path: join(SHOTS, 'acabamento-desktop-correr.png') }) }   // só na pasta temporária
      } catch (e) {
        problems.push('acabamento-desktop: ' + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      // Review Focus 4: gaveta DEV aberta a 360x780 (?dev=1): sem rolagem lateral, nem na página nem dentro da gaveta
      const pg = await newPage(browser, { width: 360, height: 780 }, 'acabamento-dev', { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo', { timeout: 5000 })
        await devAbrir(pg)
        await checkOverflow(pg, 'acabamento-dev gaveta')
        const g = await pg.evaluate(() => { const e = document.querySelector('.dev-gaveta'); return { sw: e.scrollWidth, cw: e.clientWidth } })
        if (g.sw > g.cw) problems.push(`acabamento-dev: conteúdo da gaveta DEV mais largo que ela (${g.sw} > ${g.cw})`)
        await displayNaEscala(pg, 'gaveta DEV')
        if (process.env.SHOTS_DIR) await pg.screenshot({ path: join(SHOTS, 'acabamento-dev-gaveta.png') })   // só na pasta temporária
        await devFechar(pg)
      } catch (e) {
        problems.push('acabamento-dev: ' + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      // cores forçadas (spec §3): botões e painéis com borda de 2 px em cor do sistema, peças de pixel escondidas
      const PECAS_PSEUDO = ['.caixa', '.saldo', '.placa', '.titulo--tela', '.montaria--ativa', '.opcao[aria-pressed="true"]', '.ajuda']
      const confereForcado = async (pg, tag) => {
        const r = await pg.evaluate((pecas) => {
          const ruins = []
          if (!matchMedia('(forced-colors: active)').matches) ruins.push('a página não está em cores forçadas')
          for (const sel of ['.btn', '.caixa']) {
            const els = [...document.querySelectorAll(sel)].filter((e) => e.offsetWidth || e.offsetHeight)
            if (!els.length) ruins.push(`nenhum ${sel} visível`)
            const fino = els.filter((e) => parseFloat(getComputedStyle(e).borderTopWidth) < 2).length
            if (fino) ruins.push(`${fino} ${sel} sem a borda de 2 px`)
          }
          for (const sel of pecas) {
            for (const e of [...document.querySelectorAll(sel)].filter((x) => x.offsetWidth || x.offsetHeight)) {
              const b = getComputedStyle(e, '::before')
              if (b.display !== 'none' && b.content !== 'none' && b.backgroundImage.includes('data:image')) { ruins.push(`${sel}::before com a peça à mostra`); break }
              if (getComputedStyle(e).backgroundImage.includes('data:image')) { ruins.push(`${sel} com a peça no fundo`); break }
            }
          }
          return ruins
        }, PECAS_PSEUDO)
        if (r.length) problems.push(`acabamento (cores forçadas, ${tag}): ${r.join('; ')}`)
      }
      const pg = await newPage(browser, { width: 360, height: 780 }, 'acabamento-forcado', { forcedColors: 'active', ...comSave(SAVE_3A) })
      try {
        await pg.waitForSelector('#t-estabulo')
        await confereForcado(pg, 'estabulo')
        await pg.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pg.waitForSelector('#t-montaria')
        await confereForcado(pg, 'status')
        if (process.env.SHOTS_DIR) await pg.screenshot({ path: join(SHOTS, 'acabamento-forcado-status.png') })   // só na pasta temporária
        await pg.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
        await confereForcado(pg, 'ficha')
        // botão indisponível por aria-disabled (o Liberar da ativa): texto e borda em GrayText, a cor do texto do disabled nativo
        const dis = await pg.evaluate(() => {
          const a = document.querySelector('.montaria-acoes .btn[aria-disabled="true"]')
          if (!a) return { erro: 'nenhum botão aria-disabled na ficha da ativa' }
          const n = document.createElement('button'); n.disabled = true; n.className = a.className; n.textContent = 'x'; a.parentNode.appendChild(n)
          const ca = getComputedStyle(a), cn = getComputedStyle(n)
          const out = { aCor: ca.color, aBorda: ca.borderTopColor, nCor: cn.color, nBorda: cn.borderTopColor }
          n.remove()
          return out
        })
        if (dis.erro) problems.push('acabamento (cores forçadas, ficha): ' + dis.erro)
        else if (dis.aCor !== dis.nCor || dis.aBorda !== dis.nCor) problems.push(`acabamento (cores forçadas, ficha): botão aria-disabled com cor ${dis.aCor} e borda ${dis.aBorda} (GrayText, a cor do texto do disabled nativo: ${dis.nCor})`)
      } catch (e) {
        problems.push('acabamento-forcado: ' + e.message)
      } finally {
        await pg.context().close()
      }
      const fl = await newPage(browser, { width: 360, height: 780 }, 'acabamento-forcado-folha', { pagina: 'interface.html', moldes: false, forcedColors: 'active' })
      try {
        await fl.waitForSelector('[data-componente]')
        await confereForcado(fl, 'folha')
      } catch (e) {
        problems.push('acabamento-forcado-folha: ' + e.message)
      } finally {
        await fl.context().close()
      }
    }
  }

  // ---------------- celular (3b §7): botão indisponível com motivo no toque e no teclado ----------------
  // aria-disabled (não disabled) + uma linha .motivo role="status"; o toque, o Enter, o Espaço e o clique forçado nunca executam a ação
  if (quer('celular')) {
    const label = 'celular'
    const pg = await newPage(browser, { width: 360, height: 780 }, label)
    const tudo = () => pg.evaluate((k) => ({ disco: localStorage.getItem(k), mem: JSON.stringify(window.__galope.state),
      rasc: JSON.stringify(window.__galope.ui.montaria ? window.__galope.ui.montaria.rascunho : null),
      conf: JSON.stringify([window.__galope.ui.confirmLiberar || null, window.__galope.ui.montaria ? [window.__galope.ui.montaria.confirmaPontos, window.__galope.ui.montaria.confirmaRedist] : null]) }), SAVE_REAL)
    const motivos = () => pg.evaluate(() => Array.from(document.querySelectorAll('#tela .motivo')).map((p) => ({ txt: p.textContent, papel: p.getAttribute('role') })))
    const abreFicha = async (uid, aba = 'status') => {
      await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await pg.waitForSelector('#t-estabulo')
      await pg.locator(`button[data-acao="montaria"][data-id="${uid}"]`).click()
      await pg.waitForSelector('#t-montaria')
      if (aba !== 'status') await pg.locator(`[data-acao="montaria-aba"][data-id="${aba}"]`).click()
    }
    // as frases à vista na tela iguais a txt (só o elemento mais de dentro de cada uma), com as classes que importam (3c §9)
    const frases = (txt) => pg.evaluate((t) => {
      const n = (x) => x.replace(/\s+/g, ' ').trim()
      const vis = Array.from(document.querySelectorAll('#tela *')).filter((e) => e.getClientRects().length && n(e.textContent) === t)
      return vis.filter((e) => !vis.some((f) => f !== e && e.contains(f)))
        .map((e) => ({ txt: n(e.textContent), motivo: e.classList.contains('motivo'), alvo: e.classList.contains('motivo-alvo'), papel: e.getAttribute('role') }))
    }, txt)
    const altBarra = () => pg.evaluate(() => { const x = document.querySelector('.barra-acao'); return x ? x.getBoundingClientRect().height : null })
    const nAlvos = () => pg.evaluate(() => document.querySelectorAll('#tela .motivo-alvo').length)
    // o botão tem de estar aria-disabled e sem disabled; o toque (real), o Enter, o Espaço e o clique forçado (sem o atributo) mostram
    // o motivo (ou não fazem nada) e deixam o save, a ativa, os pontos, a Rédea e o rascunho como estavam.
    // alvo (3c §9.1): a frase do motivo já está na tela (Confirmar travado, Redistribuir, Expandir com reserva): o toque não cria
    // a .motivo, destaca a frase que já está lá (.motivo-alvo, por ~2 s) e a .barra-acao não cresce
    const confere = async (nome, sel, motivoRe, { alvo = false } = {}) => {
      const b = () => pg.locator(sel).first()
      if ((await pg.locator(sel).count()) < 1) { problems.push(`${label}: ${nome}: botão ausente (${sel})`); return }
      await esperaBarra(pg)   // o toque forçado vai nas coordenadas: a barra presa recém-aparecida deixaria o toque passar
      if (!(await indisp(b()))) { problems.push(`${label}: ${nome}: não está aria-disabled="true" sem disabled`); return }
      const t0 = await tudo()
      const igualA0 = async (onde) => { const t1 = await tudo(); if (t1.disco !== t0.disco || t1.mem !== t0.mem || t1.rasc !== t0.rasc || t1.conf !== t0.conf) problems.push(`${label}: ${nome}: ${onde} mudou o estado`) }
      // a frase do motivo à vista uma vez: na .motivo role="status" criada pelo toque ou (alvo) na que já estava na tela, destacada
      const dm = ((await b().getAttribute('data-motivo')) || '').replace(/\s+/g, ' ').trim()
      const vistoUma = async (onde) => {
        const ms = await motivos(), fs = await frases(dm)
        if (alvo) {
          if (ms.length || fs.length !== 1 || !fs[0].alvo || !motivoRe.test(fs[0].txt)) problems.push(`${label}: ${nome}: ${onde}: frase do motivo à vista ${JSON.stringify(fs)}, .motivo ${JSON.stringify(ms)} (esperado a frase uma vez, com .motivo-alvo e ${motivoRe}, sem .motivo nova)`)
        } else {
          if (ms.length !== 1 || ms[0].papel !== 'status' || !motivoRe.test(ms[0].txt)) problems.push(`${label}: ${nome}: ${onde}: motivo ${JSON.stringify(ms)} (esperado um role="status" com ${motivoRe})`)
          if (fs.length !== 1 || !fs[0].motivo) problems.push(`${label}: ${nome}: ${onde}: a frase do motivo à vista ${fs.length} vez(es) ${JSON.stringify(fs)} (esperado uma, na .motivo)`)
        }
      }
      const h0 = await altBarra()
      await b().click({ force: true })   // o toque real nas coordenadas do botão (o click() normal espera o botão habilitado)
      await vistoUma('toque'); await igualA0('o toque')
      if (alvo && h0 !== await altBarra()) problems.push(`${label}: ${nome}: a .barra-acao foi de ${h0} a ${await altBarra()} px com o toque (esperado igual)`)
      // a região viva fixa (#motivo-vivo, fora da tela que redesenha) leva o mesmo texto, para o leitor de tela anunciar
      const txtMotivo = ((await frases(dm))[0] || {}).txt || ''
      const vivo = (t) => pg.waitForFunction((x) => document.getElementById('motivo-vivo').textContent === x, t, { timeout: 1500 }).then(() => true, () => false)
      if (!(await vivo(txtMotivo))) problems.push(`${label}: ${nome}: #motivo-vivo sem o texto do motivo: ${JSON.stringify(await pg.evaluate(() => document.getElementById('motivo-vivo').textContent))}`)
      // o +N: a .motivo fica dentro da .build-linha daquele status e ocupa a largura dela (não cai numa célula vazia do grid)
      if (/ponto-mais/.test(sel)) {
        const lg = await pg.evaluate((s) => { const m = document.querySelector('#tela .motivo'), l = m && m.closest('.build-linha'), x = document.querySelector(s)
          return m && l ? { r: m.getBoundingClientRect().width / l.getBoundingClientRect().width, linha: l.getAttribute('data-status'), botao: x && x.getAttribute('data-id') } : null }, sel)
        if (!lg || !(lg.r >= 0.9) || lg.linha !== lg.botao) problems.push(`${label}: ${nome}: a .motivo ${JSON.stringify(lg)} (esperado dentro da linha do status do botão, com >= 0,9 da largura)`)
      }
      // Tornar ativa e Liberar (aba Ficha, Ruling 2): a .motivo vem logo depois do contêiner .montaria-acoes do botão
      if (/"(ativar|liberar)"/.test(sel)) {
        const lugar = await pg.evaluate((s) => { const m = document.querySelector('#tela .motivo'), b = document.querySelector(s), a = m && m.previousElementSibling
          return m && a ? { acoes: a.classList.contains('montaria-acoes'), doBotao: !!(b && a.contains(b)), naFicha: !!a.closest('.montaria-ficha') } : null }, sel)
        if (!lugar || !lugar.acoes || !lugar.doBotao || !lugar.naFicha) problems.push(`${label}: ${nome}: a .motivo não ficou logo depois das ações da aba Ficha (${JSON.stringify(lugar)})`)
      }
      await b().focus()
      await pg.keyboard.press('Enter')
      await vistoUma('Enter'); await igualA0('o Enter')
      await b().focus()
      await pg.keyboard.press('Space')
      await vistoUma('Espaço'); await igualA0('o Espaço')
      if (!(await b().evaluate((e) => e === document.activeElement))) problems.push(`${label}: ${nome}: o foco saiu do botão depois do Enter/Espaço`)
      if (alvo) {
        // o destaque dura ~2 s a partir do último toque: um toque novo o reinicia, e depois ele sai sozinho, sem mudar o estado
        await sleep(1200)
        await b().click({ force: true })
        await sleep(1200)   // 2,4 s depois do Espaço: só continua se o 2º toque reiniciou o tempo
        if ((await nAlvos()) !== 1) problems.push(`${label}: ${nome}: o destaque não durou ~2 s depois do último toque (${await nAlvos()} .motivo-alvo 1,2 s depois)`)
        const saiu = await pg.waitForFunction(() => !document.querySelector('#tela .motivo-alvo'), null, { timeout: 1500 }).then(() => true, () => false)
        if (!saiu) problems.push(`${label}: ${nome}: a .motivo-alvo não saiu ~2 s depois do toque`)
        await igualA0('o destaque')
        await b().click({ force: true })   // de novo, para o toque seguinte tirá-lo
      }
      // some no próximo toque em outro lugar
      await pg.locator('#tela h1').first().click()
      if ((await motivos()).length) problems.push(`${label}: ${nome}: o motivo não sumiu no toque seguinte`)
      if (await nAlvos()) problems.push(`${label}: ${nome}: o destaque da frase (.motivo-alvo) não saiu no toque seguinte`)
      // forçado: sem o atributo, o handler confere a condição de novo e também recusa
      await pg.evaluate((s) => { const x = document.querySelector(s); x.removeAttribute('aria-disabled'); x.disabled = false; x.click() }, sel)
      await igualA0('o clique forçado (sem aria-disabled)')
    }

    try {
      await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
      await pg.waitForSelector('#t-estabulo')
      // A: sem páreo aberto. Ouro 200 (a vaga custa 300); Brasa nível 12 (28 pontos) com 24 gastos: o +1 cabe, o +5 não
      await montaSave(pg, (raw) => {
        raw.gold = 200; raw.stableSlots = 3; raw.nextUid = 3; raw.pending = null
        Object.assign(raw.mounts[0], { level: 12, alloc: { vel: 10, acel: 10, man: 4, forca: 0, est: 0, garra: 0, sorte: 0 } })
        raw.mounts.push(JSON.parse(JSON.stringify(TETO_M2)))
      })
      await confere('Expandir estábulo sem Ouro', '[data-acao="expandir"]', /^Falta Ouro para expandir o estábulo\.$/)
      // 3b §4: "Tornar ativa" saiu da lista (só na ficha): nenhum botão de ativar no Estábulo; o da ficha, abaixo, tem os mesmos motivos
      if (await pg.locator('#tela [data-acao="ativar"]').count()) problems.push(`${label}: "Tornar ativa" na lista do Estábulo (sem páreo)`)
      await abreFicha('m1', 'ficha')
      // 3b §5: a ficha da ativa não tem "Tornar ativa" (nem na aba Ficha nem na cabeça); um botão forçado (criado no DOM e
      // clicado) não muda nada: o handler recusa a que já é a ativa
      if (await pg.locator('#tela [data-acao="ativar"]').count()) problems.push(`${label}: a ficha da ativa tem "Tornar ativa"`)
      {
        const t0 = await tudo()
        await pg.evaluate(() => { const x = document.createElement('button'); x.type = 'button'; x.setAttribute('data-acao', 'ativar'); x.setAttribute('data-id', 'm1'); document.getElementById('tela').appendChild(x); x.click(); x.remove() })
        const t1 = await tudo()
        if (t1.disco !== t0.disco || t1.mem !== t0.mem || t1.rasc !== t0.rasc || t1.conf !== t0.conf) problems.push(`${label}: "Tornar ativa" forçado na ficha da ativa mudou o estado`)
      }
      await confere('Liberar a ativa', '.montaria-ficha [data-acao="liberar"]', /^A montaria ativa não pode ser liberada\.$/)
      await pg.locator('[data-acao="montaria-aba"][data-id="status"]').click()
      const s1 = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      if (S.allocInfo(s1.mounts[0]).left !== 4) problems.push(`${label}: a Brasa de teste tem ${S.allocInfo(s1.mounts[0]).left} pontos livres (esperado 4)`)
      if (await pg.locator('[data-acao="ponto-mais"][data-id="est"][data-n="1"]').isDisabled()) problems.push(`${label}: o +1 de Resistência está indisponível com 4 pontos livres`)
      await confere('+5 quando só o +1 cabe', '[data-acao="ponto-mais"][data-id="est"][data-n="5"]', /Faltam pontos: sobram 4\./)
      // 3c §9.2: a .motivo que some no toque seguinte não tira da frente do dedo o botão tocado. Com a .motivo de um +N aberta numa
      // linha de cima, o toque no +1 de uma linha de baixo: o botão fica no lugar (± 1 px) e o ponto entra uma vez. Sem .motivo
      // aberta, ou com ela abaixo do botão tocado, nada é compensado (o botão também fica no lugar)
      {
        const maisSel = (k, n) => `[data-acao="ponto-mais"][data-id="${k}"][data-n="${n}"]`
        const topo = (s) => pg.evaluate((x) => document.querySelector(x).getBoundingClientRect().top, s)
        const rascunho = () => pg.evaluate(() => (window.__galope.ui.montaria && window.__galope.ui.montaria.rascunho) || {})
        const somaR = (r) => Object.values(r).reduce((a, v) => a + (v || 0), 0)
        const toca = async (tag, travado, alvoSel, k, esperado) => {
          if (travado) {
            await pg.locator(travado).click({ force: true })
            if ((await motivos()).length !== 1) problems.push(`${label}: ${tag}: o toque em ${travado} não abriu a .motivo`)
          }
          await pg.evaluate((s) => { const x = document.querySelector(s); window.scrollBy(0, x.getBoundingClientRect().top - 420) }, alvoSel)
          const y0 = await topo(alvoSel), sy = await pg.evaluate(() => window.scrollY)
          if (travado && sy < 120) problems.push(`${label}: ${tag}: a página só rolou ${sy} px (o teste precisa de espaço para compensar)`)
          await pg.locator(alvoSel).click()
          const y1 = await topo(alvoSel), r = await rascunho()
          if (Math.abs(y1 - y0) > 1) problems.push(`${label}: ${tag}: o botão tocado foi de ${y0} a ${y1} px (esperado o mesmo ± 1)`)
          if ((r[k] || 0) !== esperado || somaR(r) !== esperado) problems.push(`${label}: ${tag}: rascunho ${JSON.stringify(r)} (esperado ${k}: ${esperado} e nada mais)`)
          if ((await motivos()).length) problems.push(`${label}: ${tag}: a .motivo continua na tela`)
        }
        await toca('+1 da Garra com a .motivo da Velocidade aberta', maisSel('vel', 5), maisSel('garra', 1), 'garra', 1)
        await toca('+1 da Garra de novo, sem .motivo', null, maisSel('garra', 1), 'garra', 2)
        await pg.locator('[data-acao="pontos-desfazer"]').click()
        await toca('+1 da Aceleração com a .motivo da Garra (abaixo) aberta', maisSel('garra', 5), maisSel('acel', 1), 'acel', 1)
        await esperaBarra(pg)
        await pg.locator('[data-acao="pontos-desfazer"]').click()
      }
      await pg.locator('[data-acao="pontos-sugerir"]').click()   // gasta o que sobra no rascunho: nada mais cabe
      await confere('Distribuir sugerido com o rascunho cheio', '[data-acao="pontos-sugerir"]', /^(Os pontos que sobram não pagam o próximo ponto de nenhum status\.|Nenhum ponto sobrando para distribuir\.)$/)
      await pg.locator('[data-acao="pontos-desfazer"]').click()
      // ordinal: o "º" da aba Skills é um "o" sobrescrito escondido do leitor de tela mais um "º" só para ele
      await pg.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
      const ord = await pg.evaluate(() => {
        const p = document.querySelector('.vaga-tipo-pontos'), o = p && p.querySelector('.ord')
        return p ? { txt: p.textContent.replace(/\s+/g, ' ').trim(), sobre: o ? o.getAttribute('aria-hidden') + ':' + o.textContent : null,
          sr: o && o.nextElementSibling && o.nextElementSibling.classList.contains('sr') ? o.nextElementSibling.textContent : null } : null
      })
      if (!ord || ord.sobre !== 'true:o' || ord.sr !== 'º' || !/ no 1oº terço$/.test(ord.txt)) problems.push(`${label}: ordinal da aba Skills: ${JSON.stringify(ord)} (esperado .ord[aria-hidden=true] "o" seguido de .sr "º")`)
      await checkOverflow(pg, label + ' A')

      // B: páreo aberto com a Teto (m2) ativa, no Poder dela; a Brasa (m1) fica no estábulo
      await montaSave(pg, (raw) => {
        raw.activeId = 'm2'; raw.raceCounter = 4
        raw.pending = { counter: raw.raceCounter, training: false, fee: 100, pr: S.powerRating(raw.mounts[1]), alloc: JSON.parse(JSON.stringify(raw.mounts[1].alloc)), gear: [] }
        raw.gold = 350   // a vaga custa 300: com 100 da entrada reservados, sobram 250 (o aviso da reserva fica na tela)
      })
      await confere('Expandir com a entrada reservada', '[data-acao="expandir"]', /^100 de Ouro reservados para a entrada do páreo aberto\.$/, { alvo: true })
      if (await pg.locator('#tela [data-acao="ativar"]').count()) problems.push(`${label}: "Tornar ativa" na lista do Estábulo (páreo aberto)`)
      await abreFicha('m1', 'ficha')
      await confere('Tornar ativa na ficha (páreo aberto)', '.montaria-ficha [data-acao="ativar"]', /^Páreo aberto: corra a sala antes de trocar a montaria ativa\.$/)
      await confere('Liberar com páreo aberto', '.montaria-ficha [data-acao="liberar"]', /^Páreo aberto: corra a sala antes de liberar uma montaria\.$/)
      await abreFicha('m2')
      const maisTrava = await pg.evaluate(() => { const x = Array.from(document.querySelectorAll('[data-acao="ponto-mais"][aria-disabled="true"]')).find((e) => /Páreo aberto: passaria do Poder/.test(e.getAttribute('data-motivo') || '')); return x ? [x.getAttribute('data-id'), x.getAttribute('data-n')] : null })
      if (!maisTrava) problems.push(`${label}: a Teto ativa com páreo aberto não tem +N travado pelo Poder da sala`)
      else await confere('+N da ativa com páreo aberto', `[data-acao="ponto-mais"][data-id="${maisTrava[0]}"][data-n="${maisTrava[1]}"]`, /^\+\d+ em .+: custa \d+ pontos?\. Páreo aberto: passaria do Poder \d+ que a sala viu\.$/)
      await confere('Redistribuir com páreo aberto', '[data-acao="redistribuir"]', /^Páreo aberto: a montaria ativa só redistribui depois de correr\.$/, { alvo: true })
      await pg.locator('[data-acao="pontos-sugerir"]').click()
      await confere('Confirmar acima do Poder da sala', '[data-acao="pontos-confirmar"]', /^Páreo aberto: com este rascunho o Poder iria a \d+, e a sala viu \d+\./, { alvo: true })
      await pg.locator('[data-acao="pontos-desfazer"]').click()
      await checkOverflow(pg, label + ' B')
    } catch (e) {
      problems.push(`${label}: ${e.message}`)
    } finally {
      await pg.context().close()
    }

    // 3c §9.3: em cores forçadas, a plaquinha "Ativa" da linha do Estábulo tem contorno (borda de 2 px em cor do sistema)
    {
      const pf = await newPage(browser, { width: 360, height: 780 }, label + '-forcado', { forcedColors: 'active', ...comSave(SAVE_3A) })
      try {
        await pf.waitForSelector('#t-estabulo')
        const pl = await pf.evaluate(() => {
          const e = document.querySelector('.montaria-linha .badge-ativa')
          if (!e) return null
          const sonda = (c) => { const d = document.createElement('i'); d.style.border = '2px solid ' + c; document.body.appendChild(d); const v = getComputedStyle(d).borderTopColor; d.remove(); return v }
          const cs = getComputedStyle(e)
          return { largura: parseFloat(cs.borderTopWidth), estilo: cs.borderTopStyle, cor: cs.borderTopColor, sistema: ['ButtonText', 'CanvasText'].map(sonda) }
        })
        if (!pl || !(pl.largura >= 2) || pl.estilo !== 'solid' || !pl.sistema.includes(pl.cor)) problems.push(`${label}: cores forçadas: a plaquinha "Ativa" da linha do Estábulo ${JSON.stringify(pl)} (esperado borda sólida de 2 px ou mais em ButtonText/CanvasText)`)
      } catch (e) {
        problems.push(`${label} cores forçadas: ${e.message}`)
      } finally {
        await pf.context().close()
      }
    }

    // ---- Estábulo em lista de linhas (3b §4): um botão por cavalo, na ordem de state.mounts; altura; foco ao voltar ----
    // cada linha: uid, tipo, ação, destaque, nome acessível, texto à vista, selo "Ativa", o retrato (escondido do leitor de
    // tela e desenhado na escala 2: o canvas tem 96x72 px de CSS e 48x36 × round(2 × dpr) pixels, sem encolher pelo CSS)
    const linhasDe = (p) => p.evaluate(() => Array.from(document.querySelectorAll('#tela .montaria-linha')).map((b) => {
      const cv = b.querySelector('canvas.retrato'), oculto = cv && cv.closest('[aria-hidden="true"]'), r = cv ? cv.getBoundingClientRect() : null, bb = b.getBoundingClientRect()
      const semRetrato = b.cloneNode(true)
      semRetrato.querySelectorAll('.retrato-moldura').forEach((x) => x.remove())
      return { id: b.getAttribute('data-id'), tag: b.tagName, tipo: b.getAttribute('type'), acao: b.getAttribute('data-acao'), ativa: b.classList.contains('montaria--ativa'),
        rotulo: b.getAttribute('aria-label'), txt: semRetrato.textContent.replace(/\s+/g, ' ').trim(), selosAtiva: b.querySelectorAll('.badge-ativa').length,
        estrelas: b.querySelectorAll('.estrelas').length, retratoOculto: !!(oculto && b.contains(oculto)), dpr: window.devicePixelRatio,
        cv: cv ? [cv.width, cv.height, Math.round(r.width), Math.round(r.height)] : null, x: Math.round(bb.left), w: Math.round(bb.width), h: Math.round(bb.height), sw: b.scrollWidth, cw: b.clientWidth }
    }))
    // confere a lista contra o estado do jogo (alturaMax: altura do documento, ou null para não medir); devolve a altura
    const confereLista = async (p, tag, alturaMax) => {
      const s = await p.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      const ls = await linhasDe(p)
      const ids = ls.map((l) => l.id), esperado = s.mounts.map((m) => m.uid)
      if (JSON.stringify(ids) !== JSON.stringify(esperado)) problems.push(`${label} ${tag}: linhas ${JSON.stringify(ids)} fora da ordem de state.mounts ${JSON.stringify(esperado)}`)
      if (await p.locator('#tela [data-acao="ativar"]').count()) problems.push(`${label} ${tag}: "Tornar ativa" na lista do Estábulo`)
      if (await p.locator('#tela .montaria').count()) problems.push(`${label} ${tag}: o cartão antigo (.montaria) continua no Estábulo`)
      for (const l of ls) {
        const m = s.mounts.find((x) => x.uid === l.id)
        if (!m) continue
        const ativa = m.uid === s.activeId, num = m.uid.replace(/\D+/g, '')
        const pts = podeComprar(m)
        const rot = `${m.name} #${num}, nível ${m.level}${ativa ? ', ativa' : ''}${pts ? `, ${pts} ${pts === 1 ? 'ponto' : 'pontos'} para distribuir` : ''}. Abrir ficha.`
        if (l.tag !== 'BUTTON' || l.tipo !== 'button' || l.acao !== 'montaria') problems.push(`${label} ${tag}: linha de ${m.uid} não é um <button type="button" data-acao="montaria"> (${l.tag} ${l.tipo} ${l.acao})`)
        if (l.rotulo !== rot) problems.push(`${label} ${tag}: aria-label da linha de ${m.uid} "${l.rotulo}" (esperado "${rot}")`)
        if (l.ativa !== ativa || l.selosAtiva !== (ativa ? 1 : 0)) problems.push(`${label} ${tag}: linha de ${m.uid} com destaque ${l.ativa} e ${l.selosAtiva} selo(s) "Ativa" (ativa: ${ativa})`)
        // à vista: nome e #N, estrelas, raridade, tipo e Poder (sem equipamento); fora da linha: sexo, cruzas, Corcel e XP (3b §4)
        const visiveis = [m.name, '#' + num, G.RARITIES[m.rarity].name, G.ELEMENTS[m.element].name, 'Poder ' + S.powerRating(m)]
        const faltam = visiveis.filter((t) => !l.txt.includes(t))
        if (faltam.length || l.estrelas !== 1) problems.push(`${label} ${tag}: linha de ${m.uid} sem ${JSON.stringify(faltam)}${l.estrelas !== 1 ? ' e sem as estrelas' : ''}: "${l.txt}"`)
        if (/Macho|Fêmea|cruza|Corcel|XP/.test(l.txt)) problems.push(`${label} ${tag}: linha de ${m.uid} com sexo, cruzas, Corcel ou XP (ficam na ficha): "${l.txt}"`)
        if (!l.retratoOculto) problems.push(`${label} ${tag}: o retrato da linha de ${m.uid} não está aria-hidden`)
        const k = Math.max(1, Math.round(2 * l.dpr))
        if (!l.cv || l.cv[0] !== 48 * k || l.cv[1] !== 36 * k || Math.abs(l.cv[2] - 48 * k / l.dpr) > 0.5 || Math.abs(l.cv[3] - 36 * k / l.dpr) > 0.5) problems.push(`${label} ${tag}: retrato da linha de ${m.uid} ${JSON.stringify(l.cv)} (esperado ${48 * k}x${36 * k} pixels em ${48 * k / l.dpr}x${36 * k / l.dpr} px de CSS: escala 2, sem encolher pelo CSS)`)
        if (l.w < 44 || l.h < 44) problems.push(`${label} ${tag}: linha de ${m.uid} com ${l.w}x${l.h} px (alvo mínimo 44x44)`)
        if (l.sw > l.cw + 1) problems.push(`${label} ${tag}: o conteúdo sai da linha de ${m.uid} (scrollWidth ${l.sw} > ${l.cw})`)
      }
      // uma coluna também no computador (3b §4)
      if (new Set(ls.map((l) => l.x)).size > 1) problems.push(`${label} ${tag}: linhas em mais de uma coluna (x ${JSON.stringify(ls.map((l) => l.x))})`)
      const h = await p.evaluate(() => document.documentElement.scrollHeight)
      notes[`${label} ${tag}`] = { altura: h, linhas: ls.map((l) => l.h) }
      if (alturaMax != null && h > alturaMax) problems.push(`${label} ${tag}: Estábulo com ${h}px de altura (limite ${alturaMax}, spec 3b §2)`)
      await checkOverflow(p, `${label} ${tag}`)
      return h
    }
    // o foco depois de "Voltar" da ficha (Review Focus 2): a linha daquele cavalo, inteira entre o cabeçalho e a barra de abas
    const focoNaLinha = async (p, uid, tag) => {
      const f = await p.evaluate(() => {
        const a = document.activeElement
        if (!a || !a.classList.contains('montaria-linha')) return { fora: a ? `${a.tagName.toLowerCase()}#${a.id}.${String(a.className).trim().replace(/\s+/g, '.')}` : null }
        const r = a.getBoundingClientRect(), topo = document.querySelector('.app-topo').getBoundingClientRect(), abas = document.querySelector('.app-abas').getBoundingClientRect()
        return { id: a.getAttribute('data-id'), visivel: r.top >= topo.bottom - 1 && r.bottom <= abas.top + 1 }
      })
      if (f.id !== uid) problems.push(`${label} ${tag}: depois de "Voltar" o foco ficou em ${f.id ? 'outra linha (' + f.id + ')' : f.fora} (esperado a linha de ${uid})`)
      else if (!f.visivel) problems.push(`${label} ${tag}: a linha de ${uid}, com o foco, ficou fora da tela (atrás do cabeçalho ou da barra de abas)`)
    }
    // troca a ativa pela ficha: o "Tornar ativa" fica na aba Ficha (3b §5)
    const ativaPelaFicha = async (p, uid) => {
      await p.locator(`button[data-acao="montaria"][data-id="${uid}"]`).click()
      await p.waitForSelector('#t-montaria')
      await p.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
      await p.locator('.montaria-ficha [data-acao="ativar"]').click()
      if ((await p.evaluate(() => window.__galope.state.activeId)) !== uid) problems.push(`${label}: "Tornar ativa" da ficha não ativou ${uid}`)
    }
    {
      // SAVE_3A (3 cavalos) a 360x780: a tela inteira cabe numa tela
      const p3 = await newPage(browser, { width: 360, height: 780 }, label + '-estabulo3', comSave(SAVE_3A))
      try {
        await p3.waitForSelector('#t-estabulo')
        await confereLista(p3, '3 cavalos', 780)
        // tocar na 2ª linha abre a ficha daquele cavalo; "Voltar" devolve o foco à linha dele
        await p3.locator('#tela .montaria-linha').nth(1).click()
        await p3.waitForSelector('#t-montaria')
        const f = await p3.evaluate(() => ({ tela: window.__galope.ui.screen, uid: window.__galope.ui.montaria && window.__galope.ui.montaria.uid }))
        if (f.tela !== 'montaria' || f.uid !== 'm2') problems.push(`${label}: a 2ª linha abriu ${JSON.stringify(f)} (esperado a ficha da m2)`)
        await p3.locator('[data-acao="montaria-voltar"]').click()
        await p3.waitForSelector('#t-estabulo')
        await focoNaLinha(p3, 'm2', '3 cavalos, Voltar da m2')
        // o voltar do aparelho (history.back, popstate) faz o mesmo: o foco na linha daquele cavalo
        await p3.locator('button[data-acao="montaria"][data-id="m2"]').click()
        await p3.waitForSelector('#t-montaria')
        await p3.goBack()
        await p3.waitForSelector('#t-estabulo')
        await focoNaLinha(p3, 'm2', '3 cavalos, voltar do aparelho da m2')
        // trocar a ativa pela ficha e voltar: a ordem das linhas não muda (só o destaque passa para a nova ativa)
        await ativaPelaFicha(p3, 'm3')
        await p3.locator('[data-acao="montaria-voltar"]').click()
        await p3.waitForSelector('#t-estabulo')
        await focoNaLinha(p3, 'm3', '3 cavalos, Voltar depois de ativar a m3')
        const ordem = (await linhasDe(p3)).map((l) => l.id)
        if (JSON.stringify(ordem) !== '["m1","m2","m3"]') problems.push(`${label}: depois de trocar a ativa, as linhas ficaram na ordem ${JSON.stringify(ordem)} (esperado m1, m2, m3)`)
        await confereLista(p3, '3 cavalos, m3 ativa', 780)
      } catch (e) {
        problems.push(`${label}-estabulo3: ${e.message}`)
      } finally {
        await p3.context().close()
      }
    }
    {
      // SAVE_3B_6 (6 cavalos) a 360x780: ≤ 1.100 px; a 6ª linha (abaixo da dobra) recebe o foco e aparece ao voltar
      const p6 = await newPage(browser, { width: 360, height: 780 }, label + '-estabulo6', comSave(SAVE_3B_6))
      try {
        await p6.waitForSelector('#t-estabulo')
        await confereLista(p6, '6 cavalos', 1100)
        await p6.locator('button[data-acao="montaria"][data-id="m6"]').click()
        await p6.waitForSelector('#t-montaria')
        await p6.locator('[data-acao="montaria-voltar"]').click()
        await p6.waitForSelector('#t-estabulo')
        await focoNaLinha(p6, 'm6', '6 cavalos, Voltar da m6')
      } catch (e) {
        problems.push(`${label}-estabulo6: ${e.message}`)
      } finally {
        await p6.context().close()
      }
    }
    for (const [larg, alt] of [[360, 780], [1280, 800]]) {
      // SAVE_3A_LONGO (10 vagas, nome de 24 caracteres): sem rolagem lateral e nada saindo da linha
      const pl = await newPage(browser, { width: larg, height: alt }, `${label}-longo-${larg}`, comSave(SAVE_3A_LONGO))
      try {
        await pl.waitForSelector('#t-estabulo')
        await pl.evaluate((nome) => { const s = window.__galope.state; s.stableSlots = 10; s.mounts[0].name = nome }, NOME_LONGO)
        await pl.locator('[data-acao="aba"][data-id="correr"]').click()   // redesenha com o estado reposto
        await pl.waitForSelector('#t-correr')
        await pl.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pl.waitForSelector('#t-estabulo')
        if ((await pl.locator('#tela .montaria-linha').count()) !== 10) problems.push(`${label} longo ${larg}: o Estábulo não mostra as 10 linhas`)
        await confereLista(pl, `longo ${larg}`, null)
        // a ficha do nome de 24 caracteres nas três abas: sem rolagem lateral e o nome quebrando dentro da placa
        await pl.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pl.waitForSelector('#t-montaria')
        for (const sub of ['status', 'skills', 'ficha']) {
          await pl.locator(`[data-acao="montaria-aba"][data-id="${sub}"]`).click()
          await checkOverflow(pl, `${label} longo ${larg} ficha ${sub}`)
          const h1 = await pl.evaluate(() => { const e = document.getElementById('t-montaria'); return { sw: e.scrollWidth, cw: e.clientWidth, txt: e.textContent } })
          if (h1.sw > h1.cw + 1 || !h1.txt.includes(NOME_LONGO)) problems.push(`${label} longo ${larg} ficha ${sub}: o nome sai da placa ou some (${JSON.stringify(h1)})`)
        }
      } catch (e) {
        problems.push(`${label}-longo-${larg}: ${e.message}`)
      } finally {
        await pl.context().close()
      }
    }

    // ---- Ficha (3b §5): cabeça com o retrato grande na baia e as abas Status | Skills | Ficha ----
    // PORTRAIT_SCALE_GRANDE: a maior escala inteira que cabe na coluna a 360 px e deixa a linha de abas inteira acima da
    // barra de abas do app ao abrir a ficha (se as duas brigarem, as abas vencem e a escala desce um passo). O canvas tem
    // 48·k x 36·k pixels, k = round(escala · dpr), e 48·k/dpr x 36·k/dpr px de CSS (setupCanvas: nada encolhido pelo CSS)
    const ESCALA_GRANDE = 6
    const cabecaDe = (p) => p.evaluate(() => {
      const cab = document.querySelector('#tela .montaria-cabeca')
      if (!cab) return null
      const h1 = document.getElementById('t-montaria'), cv = cab.querySelector('canvas.retrato')
      const semRetrato = cab.cloneNode(true)
      semRetrato.querySelectorAll('.retrato-moldura').forEach((x) => x.remove())
      const r = cv ? cv.getBoundingClientRect() : null
      const sub = document.querySelector('#tela .subabas'), abas = document.querySelector('.app-abas')
      const poder = Array.from(cab.querySelectorAll('.linha-meta span')).find((x) => /^Poder/.test(x.textContent.trim()))
      return {
        h1: h1 ? { dentro: cab.contains(h1), placa: h1.classList.contains('titulo--tela') && getComputedStyle(h1).backgroundImage.includes('data:image/png'),
          ativa: h1.querySelectorAll('.badge-ativa').length, txt: h1.textContent.replace(/\s+/g, ' ').trim() } : null,
        ativasCab: cab.querySelectorAll('.badge-ativa').length,
        txt: semRetrato.textContent.replace(/\s+/g, ' ').trim(),
        raridade: cab.querySelectorAll('.raridade').length, estrelas: cab.querySelectorAll('.estrelas[aria-label]').length, tipo: cab.querySelectorAll('.el').length,
        liga: cab.querySelectorAll('.liga').length, xp: cab.querySelectorAll('.barra--xp').length,
        ajudas: Array.from(cab.querySelectorAll('.ajuda')).map((b) => b.getAttribute('data-ajuda')),
        poder: poder && poder.querySelector('b') ? Number(poder.querySelector('b').textContent) : null,
        acoes: cab.querySelectorAll('[data-acao="ativar"], [data-acao="renomear"], [data-acao="liberar"], .montaria-acoes').length,
        selo: (cab.querySelector('.retrato-moldura .selo-nivel') || {}).textContent || null,
        mais: (cab.querySelector('.retrato-moldura .pontos-livres--selo') || {}).textContent || null,
        cv: cv ? { grande: cv.classList.contains('retrato--grande'), w: cv.width, h: cv.height, cw: r.width, ch: r.height } : null,
        cab: cab.getBoundingClientRect().width, dpr: window.devicePixelRatio, scrollY: window.scrollY,
        abasFundo: sub ? sub.getBoundingClientRect().bottom : null, appAbasTopo: abas ? abas.getBoundingClientRect().top : null,
        subabas: Array.from(document.querySelectorAll('#tela .subabas [data-acao="montaria-aba"]')).map((b) => [b.getAttribute('data-id'), b.textContent.trim(), b.getAttribute('aria-pressed')]),
        aba: window.__galope.ui.montaria && window.__galope.ui.montaria.aba
      }
    })
    // abre a ficha pela linha do Estábulo e confere a cabeça (estreita: o celular, com a barra de abas do app embaixo e a
    // coluna de 360 px, onde o retrato ocupa a largura)
    const confereCabeca = async (p, tag, uid, estreita) => {
      await p.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await p.waitForSelector('#t-estabulo')
      await p.locator(`button[data-acao="montaria"][data-id="${uid}"]`).click()
      await p.waitForSelector('#t-montaria')
      const s = await p.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      const m = s.mounts.find((x) => x.uid === uid), ativa = uid === s.activeId, num = uid.replace(/\D+/g, '')
      const c = await cabecaDe(p)
      if (!c) { problems.push(`${label} ${tag}: a ficha sem a .montaria-cabeca`); return null }
      // abre em Status, com Status | Skills | Ficha na ordem e a linha de abas inteira acima da barra de abas do app, sem rolar
      if (c.scrollY !== 0) problems.push(`${label} ${tag}: a ficha abriu com scrollY ${c.scrollY}`)
      // (no computador a barra de abas do app é a coluna da esquerda: não cobre a linha de abas)
      if (estreita && !(c.abasFundo <= c.appAbasTopo)) problems.push(`${label} ${tag}: o fundo da linha de abas (${c.abasFundo}) passa do topo da barra de abas do app (${c.appAbasTopo})`)
      const esp = [['status', 'Status', 'true'], ['skills', 'Skills', 'false'], ['ficha', 'Ficha', 'false']]
      if (JSON.stringify(c.subabas) !== JSON.stringify(esp) || c.aba !== 'status') problems.push(`${label} ${tag}: abas ${JSON.stringify(c.subabas)} na aba ${c.aba} (esperado ${JSON.stringify(esp)}, aberta em Status)`)
      // cabeça: o h1 é a placa, com o nome, o #N e o selo "Ativa" (só na ativa); raridade, estrelas e tipo; Poder e liga com
      // os ⓘ; o XP. Porte, marcas, cruzas, sexo, Corcel, chance de skill, pais e os botões ficam na aba Ficha
      if (!c.h1 || !c.h1.dentro || !c.h1.placa || !c.h1.txt.includes(m.name) || !c.h1.txt.includes('#' + num) || c.h1.ativa !== (ativa ? 1 : 0) || c.ativasCab !== c.h1.ativa) problems.push(`${label} ${tag}: o h1 da cabeça ${JSON.stringify(c.h1)} (${c.ativasCab} selo(s) "Ativa" na cabeça; ativa: ${ativa})`)
      // o leitor de tela lê "Brasa #1 Ativa": um espaço entre o nome e o selo no markup (o flex da placa não o mostra)
      if (ativa && c.h1 && !new RegExp(`#${num} Ativa$`).test(c.h1.txt)) problems.push(`${label} ${tag}: o h1 lê "${c.h1.txt}" (esperado um espaço antes de "Ativa")`)
      if (c.raridade !== 1 || c.estrelas !== 1 || c.tipo < 1 || c.liga !== 1 || c.xp !== 1) problems.push(`${label} ${tag}: a cabeça sem raridade, estrelas, tipo, liga ou XP ${JSON.stringify(c)}`)
      for (const k of ['raridade', 'estrelas', 'poder', 'liga']) if (!c.ajudas.includes(k)) problems.push(`${label} ${tag}: a cabeça sem o ⓘ de ${k}`)
      if (c.poder !== S.powerRating(m)) problems.push(`${label} ${tag}: Poder ${c.poder} na cabeça (esperado ${S.powerRating(m)})`)
      for (const t of [G.RARITIES[m.rarity].name, G.ELEMENTS[m.element].name, 'XP']) if (!c.txt.includes(t)) problems.push(`${label} ${tag}: a cabeça sem "${t}": ${c.txt}`)
      if (/Macho|Fêmea|Porte:|Marcas:|[Cc]ruza|Corcel|Skills:|Pais:/.test(c.txt) || c.acoes) problems.push(`${label} ${tag}: a cabeça com dados ou ações da aba Ficha (${c.acoes} ações): ${c.txt}`)
      // retrato grande com os selos nos cantos: "Nv N" e o "+N" dos pontos que cabem
      const pts = podeComprar(m)
      if (c.selo !== 'Nv ' + m.level || c.mais !== (pts ? '+' + pts + (pts === 1 ? ' ponto' : ' pontos') + ' para distribuir' : null)) problems.push(`${label} ${tag}: selos do retrato ${JSON.stringify([c.selo, c.mais])} (esperado Nv ${m.level} e ${pts ? '+' + pts + ' (com o texto para o leitor de tela " pontos para distribuir")' : 'sem +N'})`)
      const k = Math.max(1, Math.round(ESCALA_GRANDE * c.dpr))
      if (!c.cv || !c.cv.grande || c.cv.w !== 48 * k || c.cv.h !== 36 * k || Math.abs(c.cv.cw - 48 * k / c.dpr) > 0.5 || Math.abs(c.cv.ch - 36 * k / c.dpr) > 0.5) {
        problems.push(`${label} ${tag}: retrato grande ${JSON.stringify(c.cv)} (esperado ${48 * k}x${36 * k} pixels em ${(48 * k / c.dpr).toFixed(2)}x${(36 * k / c.dpr).toFixed(2)} px: escala ${ESCALA_GRANDE}, dpr ${c.dpr}, sem encolher pelo CSS)`)
      } else if (estreita && (c.cv.cw + 12) / c.cab < 0.9) problems.push(`${label} ${tag}: o retrato com a moldura (${(c.cv.cw + 12).toFixed(1)} px) não ocupa a largura da coluna (${c.cab} px)`)
      notes[`${label} ${tag}`] = { abasFundo: c.abasFundo, appAbasTopo: c.appAbasTopo, retrato: c.cv, cabeca: c.cab }
      return m
    }
    // a aba Ficha da montaria aberta: ações (Tornar ativa só nas outras) no contêiner .montaria-acoes e os dados
    const confereAbaFicha = async (p, tag, m, pais) => {
      await p.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
      const s = await p.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      const ativa = m.uid === s.activeId
      const f = await p.evaluate(() => {
        const sec = document.querySelector('#tela .montaria-ficha')
        if (!sec) return null
        const bt = (a) => {
          const b = sec.querySelector(`[data-acao="${a}"]`)
          if (!b) return null
          const r = b.getBoundingClientRect(), ac = b.closest('.montaria-acoes')
          return { id: b.getAttribute('data-id'), noAcoes: !!ac, off: b.getAttribute('aria-disabled') === 'true' || b.disabled, txt: b.textContent.trim(), w: r.width, h: r.height }
        }
        const press = document.querySelector('#tela [data-acao="montaria-aba"][aria-pressed="true"]')
        return { rotulo: sec.getAttribute('aria-label'), tag: sec.tagName, aba: window.__galope.ui.montaria.aba, press: press && press.getAttribute('data-id'),
          ativar: bt('ativar'), renomear: bt('renomear'), liberar: bt('liberar'), ativarNaTela: document.querySelectorAll('#tela [data-acao="ativar"]').length,
          dados: Array.from(sec.querySelectorAll('.ficha-dados > li')).map((li) => li.textContent.replace(/[♂♀⚑]/g, ' ').replace(/\s+/g, ' ').trim()) }
      })
      if (!f) { problems.push(`${label} ${tag}: a aba Ficha sem a .montaria-ficha`); return }
      if (f.tag !== 'SECTION' || f.rotulo !== 'Ficha' || f.aba !== 'ficha' || f.press !== 'ficha') problems.push(`${label} ${tag}: aba Ficha ${JSON.stringify({ tag: f.tag, rotulo: f.rotulo, aba: f.aba, press: f.press })}`)
      // Tornar ativa só fora da ativa; Renomear e Liberar sempre (Liberar indisponível na ativa); todos no .montaria-acoes
      if (ativa ? f.ativar || f.ativarNaTela : !f.ativar || f.ativar.id !== m.uid || f.ativar.off || f.ativar.txt !== 'Tornar ativa') problems.push(`${label} ${tag}: "Tornar ativa" ${JSON.stringify(f.ativar)} (${f.ativarNaTela} na tela; ativa: ${ativa})`)
      if (!f.renomear || f.renomear.id !== m.uid || f.renomear.off || f.renomear.txt !== 'Renomear') problems.push(`${label} ${tag}: "Renomear" ${JSON.stringify(f.renomear)}`)
      if (!f.liberar || f.liberar.id !== m.uid || f.liberar.off !== ativa || f.liberar.txt !== 'Liberar') problems.push(`${label} ${tag}: "Liberar" ${JSON.stringify(f.liberar)} (ativa: ${ativa})`)
      for (const b of [f.ativar, f.renomear, f.liberar].filter(Boolean)) {
        if (!b.noAcoes) problems.push(`${label} ${tag}: "${b.txt}" fora do contêiner .montaria-acoes (Ruling 2)`)
        if (b.w < 44 || b.h < 44) problems.push(`${label} ${tag}: "${b.txt}" com ${b.w}x${b.h} px (alvo mínimo 44x44)`)
      }
      // dados: sexo (e Corcel), porte, marcas, cruzas restantes, chance de skill e, com parents, os pais
      const nomeSexo = 'Sexo: ' + (m.sex === 'f' ? 'Fêmea' : 'Macho')
      const esp = [nomeSexo].concat(B.isCorcel(m) ? ['Corcel: herança garantida'] : []).concat(['Porte: ' + G.PORTES.nomes[B.porteDe(m.porte, m.templateId, m.uid)], /^Marcas: \S/, 'Cruzas restantes: ' + m.breedLeft,
        'Skills: ' + Math.round(S.skillChance(m, S.computeStats(m), 0) * 100) + '% de ativar']).concat(pais ? [pais] : [])
      const ok = f.dados.length === esp.length && esp.every((e, i) => (e instanceof RegExp ? e.test(f.dados[i]) : e === f.dados[i]))
      if (!ok) problems.push(`${label} ${tag}: dados da aba Ficha ${JSON.stringify(f.dados)} (esperado ${esp.map(String).join(' | ')})`)
      await checkOverflow(p, `${label} ${tag} aba Ficha`)
    }
    {
      // SAVE_3A a 360x780: a ativa (m1) e as outras (m2 com pais: a mãe no estábulo e o pai fora; m3 com um uid que não
      // está mais no estábulo); Tornar ativa pela aba Ficha; Review Focus 5 (rascunho e troca de aba); altura da aba Skills
      const SAVE_PAIS = JSON.parse(JSON.stringify(SAVE_3A))
      SAVE_PAIS.mounts[1].parents = { f: { uid: 'm3', name: 'Maré' }, m: { uid: null, name: 'Trovão' } }
      SAVE_PAIS.mounts[2].parents = { f: { uid: 'm9', name: 'Iara' }, m: { uid: 'm1', name: 'Brasa' } }
      const pf = await newPage(browser, { width: 360, height: 780 }, label + '-ficha', comSave(SAVE_PAIS))
      try {
        await pf.waitForSelector('#t-estabulo')
        const m1 = await confereCabeca(pf, 'ficha da ativa', 'm1', true)
        // a aba Skills da ativa continua presa em +4% sobre a main (ALTURA_ANTES_3A)
        await pf.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
        const aSk = await pf.evaluate(() => document.documentElement.scrollHeight)
        notes[`${label} altura skills`] = aSk
        if (aSk > 1.04 * ALTURA_ANTES_3A.skills) problems.push(`${label}: aba Skills da ativa com ${aSk}px (limite ${Math.round(1.04 * ALTURA_ANTES_3A.skills)})`)
        if (m1) await confereAbaFicha(pf, 'ficha da ativa', m1, null)
        // Review Focus 5: com rascunho na aba Status, ir para a Ficha (ou Skills) e voltar: o rascunho some e nada é gravado
        for (const outra of ['ficha', 'skills']) {
          await pf.locator('[data-acao="montaria-aba"][data-id="status"]').click()
          const antes = await pf.evaluate((k) => ({ disco: localStorage.getItem(k), alloc: JSON.stringify(window.__galope.state.mounts[0].alloc) }), SAVE_REAL)
          await pf.locator('[data-acao="ponto-mais"][data-id="vel"][data-n="1"]').click()
          if ((await pf.evaluate(() => JSON.stringify(window.__galope.ui.montaria.rascunho))) === 'null') problems.push(`${label}: RF5: o +1 não pôs nada no rascunho`)
          await pf.locator(`[data-acao="montaria-aba"][data-id="${outra}"]`).click()
          await pf.locator('[data-acao="montaria-aba"][data-id="status"]').click()
          const dep = await pf.evaluate((k) => ({ disco: localStorage.getItem(k), alloc: JSON.stringify(window.__galope.state.mounts[0].alloc), rasc: JSON.stringify(window.__galope.ui.montaria.rascunho),
            marcas: document.querySelectorAll('#tela .valor--rascunho').length, confirmar: document.querySelectorAll('#tela [data-acao="pontos-confirmar"]').length }), SAVE_REAL)
          if (dep.rasc !== 'null' || dep.marcas || dep.confirmar || dep.disco !== antes.disco || dep.alloc !== antes.alloc) problems.push(`${label}: RF5: Status -> ${outra} -> Status com rascunho ${JSON.stringify({ rasc: dep.rasc, marcas: dep.marcas, confirmar: dep.confirmar, alloc: [antes.alloc, dep.alloc], disco: dep.disco === antes.disco })}`)
        }
        // trocar de aba também fecha o campo de renomear da aba Ficha (como o rascunho do Status), sem mudar o nome
        await pf.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
        await pf.locator('.montaria-ficha [data-acao="renomear"]').click()
        if ((await pf.locator('.montaria-ficha #renomear-campo').count()) !== 1) problems.push(`${label}: "Renomear" não abriu o campo na aba Ficha`)
        await pf.locator('[data-acao="montaria-aba"][data-id="status"]').click()
        await pf.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
        const ren = await pf.evaluate(() => ({ campo: document.querySelectorAll('#renomear-campo').length, aberto: window.__galope.ui.montaria.renomear, nome: window.__galope.state.mounts[0].name }))
        if (ren.campo || ren.aberto !== null || ren.nome !== 'Brasa') problems.push(`${label}: trocar de aba com o campo de renomear aberto ${JSON.stringify(ren)} (esperado o campo fechado e o nome igual)`)
        // m2: Tornar ativa disponível; pais com o pai fora do estábulo (uid null)
        const m2 = await confereCabeca(pf, 'ficha da m2', 'm2', true)
        if (m2) await confereAbaFicha(pf, 'ficha da m2', m2, 'Pais: Maré e Trovão (fora do estábulo)')
        // a confirmação de liberar também some ao trocar de aba, e nada sai do estábulo
        await pf.locator('.montaria-ficha [data-acao="liberar"]').click()
        if ((await pf.locator('.montaria-ficha [data-acao="liberar-sim"]').count()) !== 1) problems.push(`${label}: "Liberar" da m2 não pediu a confirmação`)
        await pf.locator('[data-acao="montaria-aba"][data-id="skills"]').click()
        await pf.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
        const lib = await pf.evaluate(() => ({ sim: document.querySelectorAll('[data-acao="liberar-sim"]').length, conf: window.__galope.ui.confirmLiberar, n: window.__galope.state.mounts.length }))
        if (lib.sim || lib.conf !== null || lib.n !== 3) problems.push(`${label}: trocar de aba com a confirmação de liberar aberta ${JSON.stringify(lib)} (esperado sem a confirmação e os 3 cavalos)`)
        // m3: a mãe com um uid que não está mais no estábulo
        const m3 = await confereCabeca(pf, 'ficha da m3', 'm3', true)
        if (m3) await confereAbaFicha(pf, 'ficha da m3', m3, 'Pais: Iara (fora do estábulo) e Brasa')
        // Tornar ativa pela aba Ficha: a m3 vira a ativa, o botão some, o foco vai para o título e a aba continua a Ficha
        await pf.locator('.montaria-ficha [data-acao="ativar"]').click()
        const at = await pf.evaluate(() => ({ ativa: window.__galope.state.activeId, aba: window.__galope.ui.montaria.aba, botao: document.querySelectorAll('#tela [data-acao="ativar"]').length,
          foco: document.activeElement && document.activeElement.id, selo: document.querySelectorAll('#t-montaria .badge-ativa').length }))
        if (at.ativa !== 'm3' || at.aba !== 'ficha' || at.botao || at.foco !== 't-montaria' || at.selo !== 1) problems.push(`${label}: Tornar ativa pela aba Ficha ${JSON.stringify(at)}`)
        await capT6(pf, 'celular-ficha-m3.png', true)
        // pai homônimo: a m2 com a mãe "Brasa" de uid null e o pai "Brasa" de uid m1, com a Brasa (m1) no estábulo. O critério
        // é o uid, não o nome: a mãe sai "(fora do estábulo)" e o pai, não (pelo save, que passa pela validação dos pais)
        await montaSave(pf, (raw) => { raw.mounts.find((x) => x.uid === 'm2').parents = { f: { uid: null, name: 'Brasa' }, m: { uid: 'm1', name: 'Brasa' } } })
        const nomes = await pf.evaluate(() => window.__galope.state.mounts.map((x) => x.uid + ':' + x.name).join(','))
        if (!nomes.includes('m1:Brasa')) problems.push(`${label}: o teste do pai homônimo precisa da Brasa no estábulo (${nomes})`)
        const m2h = await confereCabeca(pf, 'ficha da m2 (pai homônimo)', 'm2', true)
        if (m2h) await confereAbaFicha(pf, 'ficha da m2 (pai homônimo)', m2h, 'Pais: Brasa (fora do estábulo) e Brasa')
      } catch (e) {
        problems.push(`${label}-ficha: ${e.message}`)
      } finally {
        await pf.context().close()
      }
    }
    for (const [larg, alt, dpr] of [[360, 780, 2.625], [1280, 800, 2]]) {
      // densidade fracionada (o tamanho do retrato sai do setupCanvas: 48·k/dpr) e o computador (coluna de 520 px)
      const pd = await newPage(browser, { width: larg, height: alt }, `${label}-ficha-${larg}-${dpr}`, { deviceScaleFactor: dpr, ...comSave(SAVE_3A) })
      try {
        await pd.waitForSelector('#t-estabulo')
        const m1 = await confereCabeca(pd, `ficha ${larg} dpr ${dpr}`, 'm1', larg < 600)
        if (m1) await confereAbaFicha(pd, `ficha ${larg} dpr ${dpr}`, m1, null)
      } catch (e) {
        problems.push(`${label}-ficha-${larg}-${dpr}: ${e.message}`)
      } finally {
        await pd.context().close()
      }
    }

    // ---- Aba Status (3b §6): uma linha por status, a ajuda no nome, o topo numa linha e a barra presa com o rascunho ----
    // cada .build-linha: o nome (o próprio botão de ajuda), a nota, o valor e o custo e os três +N na faixa de 44 px dos
    // botões (a Sorte, sem botões: a do nome), com os centros alinhados, e a barra fina (6 px) embaixo; alvos de 44 px; um
    // só [data-ajuda] na linha (o do nome); o custo curto à vista ("·N" ou "teto") e a frase inteira para o leitor de tela
    const statusDe = (p) => p.evaluate(() => Array.from(document.querySelectorAll('#tela .build-linha')).map((l) => {
      const caixa = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, b: b.bottom, r: b.right } }
      const nome = l.querySelector('.build-nome'), custo = l.querySelector('.build-custo')
      const visto = custo ? (() => { const c = custo.cloneNode(true); c.querySelectorAll('.sr').forEach((x) => x.remove()); return c.textContent.trim() })() : null
      return { k: l.getAttribute('data-status'), linha: caixa(l), sw: l.scrollWidth, cw: l.clientWidth,
        nome: caixa(nome), nomeTxt: nome ? nome.textContent.trim() : null, nomeIcone: nome ? nome.querySelectorAll('svg.icone-status, img.icone').length : 0,
        nomeBotao: !!nome && nome.tagName === 'BUTTON' && nome.getAttribute('type') === 'button' && nome.classList.contains('ajuda') && nome.classList.contains('ajuda--nome') && nome.getAttribute('data-ajuda') === l.getAttribute('data-status'),
        ajudas: Array.from(l.querySelectorAll('[data-ajuda]')).map((b) => b.getAttribute('data-ajuda')),
        nota: caixa(l.querySelector('.nota-genetica')), valor: caixa(l.querySelector('.valor')), custo: caixa(custo), custoVisto: visto,
        custoSr: custo && custo.querySelector('.sr') ? custo.querySelector('.sr').textContent : null,
        mais: Array.from(l.querySelectorAll('.build-mais')).map(caixa), barra: caixa(l.querySelector('.build-barra')) }
    }))
    const confereLinhas = async (p, tag) => {
      const ls = await statusDe(p)
      if (ls.length !== 7) problems.push(`${label} ${tag}: ${ls.length} linhas de status (esperado 7)`)
      for (const l of ls) {
        const sorte = l.k === 'sorte', st = G.STATS[l.k], q = `${label} ${tag}: linha ${l.k}`
        if (!l.nomeBotao || l.nomeTxt !== st.short || l.nomeIcone !== 1) problems.push(`${q}: o nome não é o botão de ajuda com o ícone e a sigla ${JSON.stringify({ botao: l.nomeBotao, txt: l.nomeTxt, icone: l.nomeIcone })}`)
        if (JSON.stringify(l.ajudas) !== JSON.stringify([l.k])) problems.push(`${q}: [data-ajuda] na linha ${JSON.stringify(l.ajudas)} (esperado só o do nome, ${l.k})`)
        if (l.mais.length !== (sorte ? 0 : 3)) problems.push(`${q}: ${l.mais.length} botões +N (esperado ${sorte ? 0 : 3})`)
        for (const a of [l.nome].concat(l.mais)) if (!a || a.w < 43.5 || a.h < 43.5) problems.push(`${q}: alvo de ${a ? Math.round(a.w) + 'x' + Math.round(a.h) : 'nenhum'} px (mínimo 44x44)`)
        if (!l.nome || (!sorte && !l.mais.length)) continue
        // a faixa da linha: a dos três botões, todos na mesma altura (a Sorte: a do nome)
        if (l.mais.some((m) => Math.abs(m.y - l.mais[0].y) > 4)) problems.push(`${q}: os +N em alturas diferentes ${JSON.stringify(l.mais.map((m) => Math.round(m.y)))}`)
        const faixa = sorte ? { y: l.nome.y, b: l.nome.b } : { y: Math.min(...l.mais.map((m) => m.y)), b: Math.max(...l.mais.map((m) => m.b)) }, meio = (faixa.y + faixa.b) / 2
        for (const [n, c] of [['nome', l.nome], ['nota', l.nota], ['valor', l.valor], ['custo', l.custo]]) {
          if (!c || c.y < faixa.y - 4 || c.b > faixa.b + 4) problems.push(`${q}: ${n} fora da linha dos botões (${c ? Math.round(c.y) + '..' + Math.round(c.b) : 'ausente'}; faixa ${Math.round(faixa.y)}..${Math.round(faixa.b)})`)
        }
        for (const [n, c] of [['nome', l.nome], ['nota', l.nota]]) if (c && Math.abs((c.y + c.b) / 2 - meio) > 4) problems.push(`${q}: ${n} fora do meio da linha (${Math.round((c.y + c.b) / 2)}; meio ${Math.round(meio)})`)
        if (!l.barra || l.barra.y < faixa.b - 0.5 || Math.abs(l.barra.h - 6) > 0.5 || l.barra.w < 0.9 * l.linha.w) problems.push(`${q}: a barra não é a fina de 6 px embaixo da linha, na largura dela ${JSON.stringify(l.barra)}`)
        const vistoOk = sorte ? l.custoVisto === 'de nascimento' && l.custoSr === null : /^·\d+$|^teto$/.test(l.custoVisto || '') && /^(próximo ponto custa|no teto de) \d+$/.test(l.custoSr || '')
        if (!vistoOk) problems.push(`${q}: custo à vista "${l.custoVisto}" e para o leitor de tela "${l.custoSr}"`)
        if (l.sw > l.cw + 1) problems.push(`${q}: o conteúdo sai da linha (scrollWidth ${l.sw} > ${l.cw})`)
      }
      await checkOverflow(p, `${label} ${tag}`)
      return ls
    }
    const moldura = (p) => p.evaluate(() => ({ topo: document.querySelector('.app-topo').getBoundingClientRect().bottom, abas: document.querySelector('.app-abas').getBoundingClientRect(), alt: window.innerHeight }))
    // a barra presa com o rascunho: Desfazer e Confirmar (alvos de 44 px) dentro dela, presa acima da barra de abas do app
    // (no celular) ou no fundo da janela, na coluna (no computador); o "Poder A → B" nela
    const confereBarra = async (p, tag, estreita, poderTxt) => {
      await esperaBarra(p)
      const r = await p.evaluate(() => {
        const ba = document.querySelector('#tela .barra-acao'), cx = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, b: b.bottom, r: b.right } }
        return { n: document.querySelectorAll('#tela .barra-acao').length, barra: cx(ba), sw: ba ? ba.scrollWidth : 0, cw: ba ? ba.clientWidth : 0, txt: ba ? ba.textContent.replace(/\s+/g, ' ').trim() : '',
          desfazer: cx(ba && ba.querySelector('[data-acao="pontos-desfazer"]')), confirmar: cx(ba && ba.querySelector('[data-acao="pontos-confirmar"]')),
          sec: cx(document.querySelector('#tela section[aria-label="Status"]')), abas: cx(document.querySelector('.app-abas')), alt: window.innerHeight, pe: ba ? getComputedStyle(ba).pointerEvents : null }
      })
      if (r.n !== 1 || !r.barra) { problems.push(`${label} ${tag}: com rascunho, ${r.n} barras presas (esperado 1)`); return r }
      if (estreita ? Math.abs(r.barra.b - r.abas.y) > 1 : Math.abs(r.barra.b - r.alt) > 1) problems.push(`${label} ${tag}: a barra presa termina em ${r.barra.b} (esperado ${estreita ? 'no topo da barra de abas do app, ' + r.abas.y : 'no fundo da janela, ' + r.alt})`)
      if (!estreita && r.barra.x < r.abas.r) problems.push(`${label} ${tag}: a barra presa fica sob a barra lateral de abas (x ${r.barra.x} < ${r.abas.r})`)
      if (r.barra.x < r.sec.x - 0.5 || r.barra.r > r.sec.r + 0.5) problems.push(`${label} ${tag}: a barra presa sai da coluna do painel (${Math.round(r.barra.x)}..${Math.round(r.barra.r)}; painel ${Math.round(r.sec.x)}..${Math.round(r.sec.r)})`)
      for (const [n, b] of [['Desfazer', r.desfazer], ['Confirmar', r.confirmar]]) {
        if (!b || b.w < 43.5 || b.h < 43.5 || b.y < r.barra.y || b.b > r.barra.b + 0.5 || b.b > (estreita ? r.abas.y : r.alt)) problems.push(`${label} ${tag}: ${n} fora da barra presa ou pequeno ${JSON.stringify(b)} (barra ${JSON.stringify(r.barra)})`)
      }
      if (poderTxt && !r.txt.includes(poderTxt)) problems.push(`${label} ${tag}: a barra presa sem "${poderTxt}": "${r.txt}"`)
      if (r.pe !== 'auto') problems.push(`${label} ${tag}: a barra presa continua deixando o toque passar (pointer-events ${r.pe})`)
      if (r.sw > r.cw + 1) problems.push(`${label} ${tag}: o conteúdo sai da barra presa (${r.sw} > ${r.cw})`)
      await checkOverflow(p, `${label} ${tag} barra`)
      return r
    }
    // Review Focus 3: rolando até o fim com a barra presa, o bloco Redistribuir (o botão inteiro) e o rodapé ficam à vista,
    // entre o cabeçalho e a barra, e a barra acima da barra de abas do app (comRedist false: a montaria sem pontos gastos,
    // sem o bloco Redistribuir; aí o último é o rodapé)
    const confereFim = async (p, tag, estreita, comRedist = true) => {
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await esperaBarra(p)
      const f = await p.evaluate(() => {
        const cx = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { y: b.top, b: b.bottom } }
        return { red: cx('#tela [data-acao="redistribuir"]'), bloco: cx('#tela .redistribuir'), rodape: cx('#tela .build-rodape'), barra: cx('#tela .barra-acao'),
          topo: document.querySelector('.app-topo').getBoundingClientRect().bottom, abas: document.querySelector('.app-abas').getBoundingClientRect().top, alt: window.innerHeight }
      })
      const limite = estreita ? f.abas : f.alt
      if (!f.barra || f.barra.b > limite + 1) problems.push(`${label} ${tag}: no fim, a barra presa ${JSON.stringify(f.barra)} passa de ${limite}`)
      if (!comRedist && (f.red || f.bloco)) problems.push(`${label} ${tag}: o bloco Redistribuir numa montaria sem pontos gastos`)
      for (const [n, c] of (comRedist ? [['o botão Redistribuir', f.red], ['o bloco Redistribuir', f.bloco]] : []).concat([['o rodapé', f.rodape]])) {
        if (!c || !f.barra || c.y < f.topo - 0.5 || c.b > f.barra.y + 0.5) problems.push(`${label} ${tag}: RF3: rolando até o fim, ${n} não fica inteiro à vista acima da barra presa ${JSON.stringify({ c, barra: f.barra, topo: f.topo })}`)
      }
    }
    const rascunhoDe = (p) => p.evaluate(() => { const M = window.__galope.ui.montaria; return { r: M && M.rascunho ? JSON.parse(JSON.stringify(M.rascunho)) : null, conf: !!(M && M.confirmaPontos) } })
    const somaDe = (r) => (r ? G.STAT_KEYS.reduce((a, k) => a + (r[k] || 0), 0) : 0)
    {
      // SAVE_3A a 360x780, a ativa (m1): alturas, linhas, topo, barra presa e o fim da aba com a barra
      const ps = await newPage(browser, { width: 360, height: 780 }, label + '-status', comSave(SAVE_3A))
      try {
        await ps.waitForSelector('#t-estabulo')
        await ps.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await ps.waitForSelector('#t-montaria')
        const m1 = await ps.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state.mounts[0])))
        // altura do documento sem rascunho (decisão da Tarefa 4: a medida da linha única)
        const aSt = await ps.evaluate(() => document.documentElement.scrollHeight)
        notes[`${label} altura status`] = aSt
        if (aSt > ALTURA_STATUS_3B) problems.push(`${label}: aba Status da ativa com ${aSt}px (limite ${ALTURA_STATUS_3B}, Tarefa 4 da 3b)`)
        if (await ps.locator('#tela .barra-acao').count()) problems.push(`${label}: sem rascunho, a barra presa está na tela`)
        // a meta que importa: com a linha de abas no topo (logo abaixo do cabeçalho fixo), as 7 linhas inteiras numa tela
        await ps.evaluate(() => { const e = document.querySelector('#tela .subabas'), t = document.querySelector('.app-topo').getBoundingClientRect().bottom; window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - t) })
        const mo = await moldura(ps), ls = await confereLinhas(ps, '360 SAVE_3A')
        const fora = ls.filter((l) => l.linha.y < mo.topo - 0.5 || l.linha.b > mo.abas.top + 0.5).map((l) => l.k + ' ' + Math.round(l.linha.y) + '..' + Math.round(l.linha.b))
        if (ls.length !== 7 || fora.length) problems.push(`${label}: com as abas no topo, linhas fora da tela (entre ${mo.topo} e ${mo.abas.top}): ${JSON.stringify(fora)}`)
        await capT6(ps, 'celular-status-sem.png')
        // o topo numa linha: "Pontos: sobram X de Y" com o ⓘ do custo e "Genética" com o seu ⓘ
        const info = S.allocInfo(m1)
        const tp = await ps.evaluate(() => {
          const t = document.querySelector('#tela .build-topo'), pl = t.querySelector('.pontos-livres'), gen = Array.from(t.querySelectorAll(':scope > .nota')).find((e) => e.textContent.trim() === 'Genética')
          const tops = Array.from(t.children).map((e) => e.getBoundingClientRect()).map((b) => (b.top + b.bottom) / 2)
          return { pontos: pl ? pl.textContent.replace(/\s+/g, ' ').trim() : null, custo: !!(pl && pl.querySelector('.ajuda[data-ajuda="custo"]')), gen: !!gen, genAjuda: !!(gen && gen.querySelector('.ajuda[data-ajuda="genetica"]')),
            meios: tops, txt: t.textContent.replace(/\s+/g, ' ').trim() }
        })
        if (tp.pontos !== `Pontos: sobram ${info.left} de ${info.free}` || !tp.custo || !tp.gen || !tp.genAjuda) problems.push(`${label}: topo da aba Status ${JSON.stringify(tp)} (esperado "Pontos: sobram ${info.left} de ${info.free}" com o ⓘ do custo e "Genética" com o ⓘ)`)
        if (tp.meios.some((y) => Math.abs(y - tp.meios[0]) > 4)) problems.push(`${label}: o topo da aba Status em mais de uma linha a 360 px (${JSON.stringify(tp.meios.map(Math.round))})`)
        if (/Poder/.test(tp.txt)) problems.push(`${label}: o topo da aba Status com o Poder: "${tp.txt}"`)
        // com rascunho (+1 em Velocidade): a barra presa acima da barra de abas, com Desfazer, Confirmar e o Poder
        await ps.locator('[data-acao="ponto-mais"][data-id="vel"][data-n="1"]').click()
        const h1 = { ...m1, alloc: { ...m1.alloc, vel: m1.alloc.vel + 1 } }
        const poderTxt = `Poder ${S.powerRating(m1)} → ${S.powerRating(h1)}`
        await confereBarra(ps, '360 com rascunho', true, poderTxt)
        if (/Poder/.test(await ps.locator('#tela .build-topo').textContent())) problems.push(`${label}: com rascunho, o Poder foi para o topo (fica na barra presa)`)
        await capT6(ps, 'celular-status-com.png')
        await confereFim(ps, '360 fim', true)
        await capT6(ps, 'celular-status-fim.png')
        // o 1º Confirmar: o pedido de confirmação entra na barra (mais alta); o fim continua alcançável
        await ps.locator('[data-acao="pontos-confirmar"]').click()
        const pedido = await ps.evaluate(() => { const a = document.querySelector('#tela .barra-acao .aviso'); return a ? a.textContent : null })
        if (!pedido || !pedido.includes('Toque em Confirmar de novo para gravar.')) problems.push(`${label}: o pedido de confirmação fora da barra presa (${pedido})`)
        await confereBarra(ps, '360 pedido de confirmação', true, poderTxt)
        await confereFim(ps, '360 fim com o pedido de confirmação', true)
        await ps.locator('[data-acao="pontos-desfazer"]').click()
        const d = await rascunhoDe(ps)
        if (d.r || d.conf || (await ps.locator('#tela .barra-acao').count())) problems.push(`${label}: Desfazer deixou rascunho ou a barra presa ${JSON.stringify(d)}`)
      } catch (e) {
        problems.push(`${label}-status: ${e.message}`)
      } finally {
        await ps.context().close()
      }
    }
    {
      // Review Focus 1, a barra que aparece sob o dedo e o toque no ⓘ (pendência M1 da Tarefa 1): a Brasa nível 12 sem
      // pontos gastos (28 livres, todos a 1): o +10 cabe uma vez (o 2º custaria 20 e sobram 18)
      const SAVE_RF = JSON.parse(JSON.stringify(SAVE_3A))
      Object.assign(SAVE_RF.mounts[0], { level: 12, alloc: { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 } })
      const pr = await newPage(browser, { width: 360, height: 780 }, label + '-status-toques', comSave(SAVE_RF))
      const motivosR = () => pr.evaluate(() => Array.from(document.querySelectorAll('#tela .motivo')).map((p) => ({ txt: p.textContent, papel: p.getAttribute('role'), linha: p.closest('.build-linha') ? p.closest('.build-linha').getAttribute('data-status') : null })))
      const centro = (sel) => pr.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } }, sel)
      try {
        await pr.waitForSelector('#t-estabulo')
        await pr.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pr.waitForSelector('#t-montaria')
        const livres = await pr.evaluate(() => { const m = window.__galope.state.mounts[0]; return window.RaceSim.allocInfo(m).left })
        if (livres !== 28) problems.push(`${label}: a Brasa nível 12 de teste tem ${livres} pontos livres (esperado 28)`)
        // RF1: dois toques seguidos no +10 de Velocidade (no meio da tela): só o 1º entra; o 2º mostra o motivo na linha dele
        await pr.evaluate(() => { const e = document.querySelector('#tela .subabas'), t = document.querySelector('.app-topo').getBoundingClientRect().bottom; window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - t) })
        const c10 = await centro('[data-acao="ponto-mais"][data-id="vel"][data-n="10"]')
        await pr.mouse.click(c10.x, c10.y)
        await pr.mouse.click(c10.x, c10.y)
        let rd = await rascunhoDe(pr), ms = await motivosR()
        if (!rd.r || rd.r.vel !== 10 || somaDe(rd.r) !== 10 || rd.conf) problems.push(`${label}: RF1: dois toques no +10 deixaram o rascunho ${JSON.stringify(rd)} (esperado só +10 em Velocidade)`)
        if (ms.length !== 1 || ms[0].papel !== 'status' || ms[0].linha !== 'vel' || !/Faltam pontos: sobram 18\.$/.test(ms[0].txt)) problems.push(`${label}: RF1: o 2º toque no +10 mostrou ${JSON.stringify(ms)} (esperado o motivo "Faltam pontos: sobram 18." dentro da linha de Velocidade)`)
        // pendência M1: tocar no nome (o botão de ajuda) tira o motivo e abre a ajuda; nunca os dois na tela
        await pr.locator('.build-linha[data-status="vel"] .ajuda--nome').click()
        const aj = await pr.evaluate(() => ({ motivos: document.querySelectorAll('#tela .motivo').length, aberto: document.querySelector('.build-linha[data-status="vel"] .ajuda--nome').getAttribute('aria-expanded'), notas: document.querySelectorAll('#tela .ajuda-txt').length, vivo: document.getElementById('motivo-vivo').textContent }))
        if (aj.motivos || aj.aberto !== 'true' || aj.notas !== 1 || aj.vivo) problems.push(`${label}: M1: o toque no nome com o motivo na tela ${JSON.stringify(aj)} (esperado o motivo fora, a região viva vazia e a ajuda aberta)`)
        await pr.locator('.build-linha[data-status="vel"] .ajuda--nome').click()
        await pr.locator('[data-acao="pontos-desfazer"]').click()
        if ((await rascunhoDe(pr)).r || (await pr.locator('#tela .barra-acao').count())) problems.push(`${label}: Desfazer não limpou o rascunho do RF1`)
        // a barra aparece sob o dedo: o +1 e o +10 da Garra nos 76 px de baixo da área visível (logo acima da barra de abas).
        // Dois toques rápidos no mesmo lugar: o 1º faz a barra aparecer por cima do botão; o 2º passa por ela (só ~400 ms) e
        // vai para o +N, nunca para Desfazer nem Confirmar
        for (const [n, esp] of [[1, 2], [10, 10]]) {
          const sel = `[data-acao="ponto-mais"][data-id="garra"][data-n="${n}"]`
          await pr.evaluate(([s]) => { const b = document.querySelector(s).getBoundingClientRect(), a = document.querySelector('.app-abas').getBoundingClientRect().top; window.scrollBy(0, b.top + b.height / 2 - (a - 30)) }, [sel])
          const pt = await centro(sel), abasTopo = (await moldura(pr)).abas.top
          if (!(pt.y > abasTopo - 76 && pt.y < abasTopo)) problems.push(`${label}: o +${n} da Garra não ficou nos 76 px de baixo da área visível (${pt.y}; barra de abas em ${abasTopo})`)
          await pr.mouse.click(pt.x, pt.y)
          await pr.mouse.click(pt.x, pt.y)
          rd = await rascunhoDe(pr)
          const tela = await pr.evaluate(() => (document.getElementById('tela').textContent || ''))
          if (!rd.r || rd.r.garra !== esp || somaDe(rd.r) !== esp || rd.conf || /Toque em Confirmar de novo/.test(tela)) problems.push(`${label}: dois toques rápidos no +${n} da Garra, sob a barra que apareceu: ${JSON.stringify(rd)} (esperado só +${esp} na Garra, sem Desfazer nem Confirmar)`)
          // o cenário é de verdade: passado o tempo, o mesmo lugar é um botão da barra presa (Desfazer ou Confirmar)
          await esperaBarra(pr)
          const debaixo = await pr.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y), b = e && e.closest('[data-acao]'); return { barra: !!(e && e.closest('.barra-acao')), acao: b ? b.getAttribute('data-acao') : null } }, [pt.x, pt.y])
          if (!debaixo.barra || !/^pontos-(desfazer|confirmar)$/.test(debaixo.acao || '')) problems.push(`${label}: o +${n} da Garra não ficou sob Desfazer ou Confirmar da barra presa ${JSON.stringify(debaixo)} (o teste não exercita o caso)`)
          notes[`${label} barra sob o dedo +${n}`] = debaixo.acao
          if (n === 10) {
            const m10 = await motivosR()
            if (m10.length !== 1 || m10[0].linha !== 'garra') problems.push(`${label}: o 2º +10 da Garra (não cabe) sem o motivo na linha dela ${JSON.stringify(m10)}`)
          }
          await pr.locator('[data-acao="pontos-desfazer"]').click()
          if ((await rascunhoDe(pr)).r) problems.push(`${label}: Desfazer não limpou o rascunho do +${n} da Garra`)
        }
        // o teclado não espera: logo depois do +N, Enter no Desfazer já desfaz
        await pr.locator('[data-acao="ponto-mais"][data-id="man"][data-n="1"]').focus()
        await pr.keyboard.press('Enter')
        await pr.locator('[data-acao="pontos-desfazer"]').focus()
        await pr.keyboard.press('Enter')
        if ((await rascunhoDe(pr)).r) problems.push(`${label}: Desfazer pelo teclado, logo depois de a barra aparecer, não desfez`)
        // I1 da revisão: dois toques rápidos no Confirmar (no fim da aba e com a barra presa) só armam o pedido de confirmação
        // (que entra em cima dos botões); nada é gravado sem ele ser lido. Passada a espera, um toque grava
        const gravado = () => pr.evaluate((k) => JSON.stringify([window.__galope.state.mounts[0].alloc, JSON.parse(localStorage.getItem(k)).mounts[0].alloc]), SAVE_REAL)
        for (const onde of ['fim', 'presa']) {
          await pr.locator('[data-acao="ponto-mais"][data-id="vel"][data-n="1"]').click()
          await esperaBarra(pr)
          if (onde === 'fim') await pr.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
          else await pr.evaluate(() => { const e = document.querySelector('#tela .subabas'), t = document.querySelector('.app-topo').getBoundingClientRect().bottom; window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - t) })
          const presa = await pr.evaluate(() => Math.abs(document.querySelector('#tela .barra-acao').getBoundingClientRect().bottom - document.querySelector('.app-abas').getBoundingClientRect().top) <= 1)
          if (onde === 'presa' && !presa) problems.push(`${label}: I1: a barra não ficou presa acima da barra de abas para o teste`)
          const g0 = await gravado(), pc = await centro('#tela [data-acao="pontos-confirmar"]')
          await pr.mouse.click(pc.x, pc.y)
          await pr.mouse.click(pc.x, pc.y)
          const d1 = await rascunhoDe(pr), pedido = await pr.evaluate(() => { const a = document.querySelector('#tela .barra-acao .aviso'); return a ? a.textContent : '' })
          if ((await gravado()) !== g0 || !d1.r || d1.r.vel !== 1 || !d1.conf || !pedido.includes('Toque em Confirmar de novo para gravar.')) problems.push(`${label}: I1 (${onde}): dois toques rápidos no Confirmar ${JSON.stringify({ gravou: (await gravado()) !== g0, rascunho: d1, pedido })} (esperado só o pedido armado, nada gravado)`)
          if (onde === 'fim') { await pr.locator('[data-acao="pontos-desfazer"]').click(); continue }
          await esperaBarra(pr)
          const pc2 = await centro('#tela [data-acao="pontos-confirmar"]')
          await pr.mouse.click(pc2.x, pc2.y)
          const d2 = await rascunhoDe(pr)
          if ((await gravado()) === g0 || d2.r) problems.push(`${label}: I1: depois da espera, o toque no Confirmar armado não gravou ${JSON.stringify(d2)}`)
        }
        // I2 da revisão: o foco por teclado nunca fica atrás da barra presa
        const focoLivre = async (tag, esp) => {
          const f = await pr.evaluate(() => {
            const a = document.activeElement, r = a.getBoundingClientRect(), ba = document.querySelector('#tela .barra-acao')
            return { foco: [a.getAttribute('data-acao'), a.getAttribute('data-id'), a.getAttribute('data-n')].join(':'), y: r.top, b: r.bottom,
              barra: ba ? ba.getBoundingClientRect().top : null, topo: document.querySelector('.app-topo').getBoundingClientRect().bottom }
          })
          if (f.foco !== esp || f.barra == null || f.b > f.barra + 0.5 || f.y < f.topo - 0.5) problems.push(`${label}: I2 (${tag}): foco ${JSON.stringify(f)} (esperado ${esp} inteiro entre o cabeçalho e o topo da barra presa)`)
        }
        // (a) Enter no +1 da Garra nos 76 px de baixo: a barra aparece por cima, e o foco (devolvido ao +1) sobe acima dela
        await pr.evaluate(() => { const b = document.querySelector('[data-acao="ponto-mais"][data-id="garra"][data-n="1"]').getBoundingClientRect(), a = document.querySelector('.app-abas').getBoundingClientRect().top; window.scrollBy(0, b.top + b.height / 2 - (a - 30)) })
        await pr.locator('.build-linha[data-status="garra"] .ajuda--nome').focus()
        await pr.keyboard.press('Tab')
        await pr.keyboard.press('Enter')
        await focoLivre('Enter no +1 da Garra embaixo', 'ponto-mais:garra:1')
        if (((await rascunhoDe(pr)).r || {}).garra !== 1) problems.push(`${label}: I2: o Enter no +1 da Garra não pôs o ponto no rascunho`)
        // (b) com o pedido de confirmação aberto (barra mais alta), Shift+Tab até o +5 da Garra, que estava atrás dela
        await pr.locator('[data-acao="pontos-confirmar"]').click()
        await esperaBarra(pr)
        if (!(await rascunhoDe(pr)).conf) problems.push(`${label}: I2: o 1º Confirmar não armou o pedido`)
        await pr.evaluate(() => { const b = document.querySelector('[data-acao="ponto-mais"][data-id="garra"][data-n="5"]').getBoundingClientRect(), t = document.querySelector('#tela .barra-acao').getBoundingClientRect().top; window.scrollBy(0, b.top - (t + 30)) })
        const atras = await pr.evaluate(() => { const b = document.querySelector('[data-acao="ponto-mais"][data-id="garra"][data-n="5"]').getBoundingClientRect(), t = document.querySelector('#tela .barra-acao').getBoundingClientRect().top; return b.top >= t })
        if (!atras) problems.push(`${label}: I2: o +5 da Garra não ficou atrás da barra presa para o teste`)
        await pr.evaluate(() => document.querySelector('[data-acao="ponto-mais"][data-id="garra"][data-n="10"]').focus({ preventScroll: true }))
        await pr.keyboard.press('Shift+Tab')
        await focoLivre('Shift+Tab com o pedido de confirmação aberto', 'ponto-mais:garra:5')
        await pr.locator('[data-acao="pontos-desfazer"]').click()
      } catch (e) {
        problems.push(`${label}-status-toques: ${e.message}`)
      } finally {
        await pr.context().close()
      }
    }
    {
      // 1280x800: a barra presa fica na coluna, no fundo da janela, fora da barra lateral de abas
      const pk = await newPage(browser, { width: 1280, height: 800 }, label + '-status-1280', comSave(SAVE_3A))
      try {
        await pk.waitForSelector('#t-estabulo')
        await pk.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pk.waitForSelector('#t-montaria')
        await confereLinhas(pk, '1280 SAVE_3A')
        if (await pk.locator('#tela .barra-acao').count()) problems.push(`${label} 1280: sem rascunho, a barra presa está na tela`)
        await pk.locator('[data-acao="ponto-mais"][data-id="vel"][data-n="1"]').click()
        await pk.evaluate(() => window.scrollTo(0, 0))
        await confereBarra(pk, '1280 com rascunho', false, null)
        await confereFim(pk, '1280 fim', false)
      } catch (e) {
        problems.push(`${label}-status-1280: ${e.message}`)
      } finally {
        await pk.context().close()
      }
    }
    {
      // modo DEV (jogo-dev.html, save de teste): a barra presa sobe acima do botão DEV, que fica sobre a barra de abas
      const SAVE_KEY_DEV = 'galope-elemental:dev'
      const pv = await newPage(browser, { width: 360, height: 780 }, label + '-status-dev', { pagina: 'jogo-dev.html',
        init: { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem(${JSON.stringify(SAVE_KEY_DEV)}, ${JSON.stringify(JSON.stringify(SAVE_3A))}) } } catch (e) {}` } })
      try {
        await pv.waitForSelector('#t-estabulo')
        await pv.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pv.waitForSelector('#t-montaria')
        await pv.locator('[data-acao="ponto-mais"][data-id="vel"][data-n="1"]').click()
        await esperaBarra(pv)
        await pv.evaluate(() => { const e = document.querySelector('#tela .subabas'); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 80) })
        const dv = await pv.evaluate(() => {
          const cx = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, b: b.bottom, r: b.right } }
          return { barra: cx('#tela .barra-acao'), dev: cx('.dev-botao'), abas: cx('.app-abas'), desfazer: cx('#tela .barra-acao [data-acao="pontos-desfazer"]'), confirmar: cx('#tela .barra-acao [data-acao="pontos-confirmar"]') }
        })
        const cruza = (a, b) => !!(a && b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b)
        if (!dv.barra || !dv.dev || cruza(dv.barra, dv.dev) || dv.barra.b > dv.abas.y + 1) problems.push(`${label} DEV: a barra presa ${JSON.stringify(dv.barra)} cruza o botão DEV ${JSON.stringify(dv.dev)} ou passa da barra de abas (${dv.abas && dv.abas.y})`)
        if (cruza(dv.desfazer, dv.dev) || cruza(dv.confirmar, dv.dev)) problems.push(`${label} DEV: o botão DEV cobre Desfazer ou Confirmar`)
        await confereFim(pv, 'DEV fim', true)
        await checkOverflow(pv, `${label} DEV barra`)
      } catch (e) {
        problems.push(`${label}-status-dev: ${e.message}`)
      } finally {
        await pv.context().close()
      }
    }
    {
      // SAVE_3A_LONGO a 360 (10 vagas, nome de 24 caracteres): as linhas, a barra presa e o fim sem rolagem lateral
      const pl = await newPage(browser, { width: 360, height: 780 }, label + '-status-longo', comSave(SAVE_3A_LONGO))
      try {
        await pl.waitForSelector('#t-estabulo')
        await pl.evaluate((nome) => { const s = window.__galope.state; s.stableSlots = 10; s.mounts[0].name = nome }, NOME_LONGO)
        await pl.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pl.waitForSelector('#t-montaria')
        await confereLinhas(pl, 'longo 360')
        await pl.locator('[data-acao="ponto-mais"][data-id="vel"][data-n="1"]').click()
        await confereBarra(pl, 'longo 360 com rascunho', true, null)
        await confereFim(pl, 'longo 360 fim', true, false)
        await checkOverflow(pl, `${label} longo 360 fim`)
      } catch (e) {
        problems.push(`${label}-status-longo: ${e.message}`)
      } finally {
        await pl.context().close()
      }
    }
  }

  if (quer('crescimento')) {
    const AVISO_V6 = 'As regras de crescimento mudaram: os pontos dos seus cavalos voltaram para distribuir.'
    const FALHA = 'Não foi possível salvar. Libere espaço e tente de novo.'
    const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    const ZERO = Object.fromEntries(G.STAT_KEYS.map((k) => [k, 0]))
    const estado = (pg) => pg.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    const disco = (pg, k = SAVE_REAL) => pg.evaluate((kk) => JSON.parse(window.localStorage.getItem(kk)), k)
    const avisos = async (pg) => (await pg.locator('#tela .aviso').allTextContents()).join(' | ')
    const textoTela = async (pg) => (await pg.locator('#tela').textContent()) || ''
    const quebrar = (pg) => pg.evaluate(() => {
      if (!window.__setOrig) window.__setOrig = Storage.prototype.setItem
      Storage.prototype.setItem = function () { throw new DOMException('cheio', 'QuotaExceededError') }
    })
    const consertar = (pg) => pg.evaluate(() => { Storage.prototype.setItem = window.__setOrig })
    const custo = (a) => G.STAT_KEYS.reduce((t, k) => t + S.costOf(a[k] || 0), 0)
    // botão criado no DOM e clicado (o handler da tela é delegado): a ação chega ao jogo mesmo sem o botão na tela
    const forca = (pg, acao, id) => pg.evaluate(([a, i]) => {
      const b = document.createElement('button')
      b.type = 'button'; b.setAttribute('data-acao', a); if (i != null) b.setAttribute('data-id', i)
      document.getElementById('tela').appendChild(b); b.click(); b.remove()
    }, [acao, id])
    const brasa = G.STARTERS.find((h) => h.id === 'brasa'), ventania = G.WILD_HORSES.find((h) => h.id === 'w-ventania')
    const deModelo = (tpl, o) => Object.assign({ uid: 'm1', templateId: tpl.id, name: tpl.name, especie: 'cavalo', element: tpl.element, rarity: tpl.rarity,
      grau: tpl.grau || 2, sex: tpl.sex, level: 1, xp: 0, skills: tpl.skills.slice(), potential: JSON.parse(JSON.stringify(tpl.potential)),
      palette: JSON.parse(JSON.stringify(tpl.palette)), breedLeft: 2, parents: null, born: 0, equip: {} }, o)

    // 1. migração v5 -> v6 com páreo aberto (RF1) e peças equipadas (RF5)
    const MIG5_SEED = 5151
    const MIG_V5 = {
      v: 5, rev: 20, gold: 1200, tier: 100, seedBase: MIG5_SEED, raceCounter: 4,
      pending: { counter: 4, training: false, fee: 100, pr: 999, alloc: { vel: 4, acel: 4, man: 0, forca: 0, est: 2, garra: 0, sorte: 0 },
        gear: [{ slot: 'sela', id: 'sela-comum', plus: 3 }, { slot: 'ferraduras', id: 'ferraduras-comum', plus: 0 }, { slot: 'armadura', id: 'armadura-sol-lendario', plus: 5 }] },
      races: 3, wins: 1, podiums: 2, goldWon: 300,
      mounts: [
        deModelo(brasa, { uid: 'm1', level: 20, xp: 10, skills: ['sprint'], alloc: { vel: 4, acel: 4, man: 0, forca: 0, est: 2, garra: 0, sorte: 0 },
          equip: { sela: 'i1', ferraduras: 'i2', armadura: 'i3' } }),
        deModelo(ventania, { uid: 'm2', level: 12, alloc: { vel: 1, acel: 0, man: 3, forca: 3, est: 0, garra: 0, sorte: 0 }, equip: { estribos: 'i4' } })
      ],
      activeId: 'm1', nextUid: 3, stableSlots: 3, breedCounter: 0,
      items: [{ uid: 'i1', id: 'sela-comum', plus: 3 }, { uid: 'i2', id: 'ferraduras-comum', plus: 0 }, { uid: 'i3', id: 'armadura-sol-lendario', plus: 5 },
        { uid: 'i4', id: 'estribos-magico', plus: 2 }, { uid: 'i5', id: 'testeira-comum', plus: 0 }],
      nextItemUid: 6, pedras: 7, enhanceCounter: 3, settings: { motion: 'sistema' }, joquei: { padrao: 'xadrez', capacete: '#62b8ff' }
    }
    {
      const label = 'crescimento-migracao'
      const pg = await newPage(browser, { width: 390, height: 844 }, label, {
        init: { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem('galope-elemental:v1', ${JSON.stringify(JSON.stringify(MIG_V5))}) } } catch (e) {}` }
      })
      try {
        await pg.waitForSelector('#t-estabulo')
        const av = await avisos(pg)
        if (av.split(AVISO_V6).length - 1 !== 1) problems.push(`${label}: o aviso da migração apareceu ${av.split(AVISO_V6).length - 1} vez(es) no Estábulo: ${av}`)
        const s = await estado(pg), d = await disco(pg)
        for (const [onde, x] of [['memória', s], ['disco', d]]) {
          const erro = (t) => problems.push(`${label} (${onde}): ${t}`)
          if (x.v !== 6) erro('versão ' + x.v)
          if (x.redeas !== 0) erro('redeas ' + x.redeas)
          if (x.avisoV6 !== false) erro('avisoV6 ' + x.avisoV6 + ' depois de mostrar o aviso')
          for (const m of x.mounts) {
            if (!igual(m.alloc, ZERO)) erro(`${m.uid}: pontos não devolvidos ${JSON.stringify(m.alloc)}`)
            if (m.respecFree !== true) erro(`${m.uid}: respecFree ${m.respecFree}`)
          }
          // RF5: peças, melhorias, o que está equipado e as Pedras ficam iguais
          if (!igual(x.items, MIG_V5.items)) erro('peças mudaram ' + JSON.stringify(x.items))
          if (x.pedras !== 7 || x.enhanceCounter !== 3 || x.nextItemUid !== 6 || x.gold !== 1200) erro('Pedras/contadores/Ouro ' + JSON.stringify({ pedras: x.pedras, enh: x.enhanceCounter, next: x.nextItemUid, gold: x.gold }))
          for (const m0 of MIG_V5.mounts) {
            const m = x.mounts.find((y) => y.uid === m0.uid)
            if (!m || GR.SLOTS.some((sl) => (m.equip[sl] || null) !== (m0.equip[sl] || null))) erro(`${m0.uid}: equipamento mudou ${m && JSON.stringify(m.equip)}`)
          }
          if (!igual(x.joquei, MIG_V5.joquei)) erro('jóquei ' + JSON.stringify(x.joquei))
          // RF1: a sala continua, com o retrato dos pontos zerado, o do equipamento guardado e o Poder pela R16
          const p = x.pending
          if (!p || p.counter !== 4 || p.fee !== 100 || p.training !== false) { erro('sala aberta ' + JSON.stringify(p)); continue }
          if (!igual(p.alloc, ZERO)) erro('retrato dos pontos não zerado ' + JSON.stringify(p.alloc))
          if (!igual(p.gear, MIG_V5.pending.gear)) erro('retrato do equipamento mudou ' + JSON.stringify(p.gear))
          const m1 = x.mounts.find((y) => y.uid === 'm1')
          const r16 = Math.max(S.powerRating(Object.assign({}, m1, { alloc: p.alloc })), S.powerRating(m1))
          if (p.pr !== r16) erro(`Poder da sala ${p.pr} (R16: ${r16}; no save v5, ${MIG_V5.pending.pr})`)
        }
        // a sala: a mesma seed, o mapa da seed e os rivais com os nomes do sorteio da seed (o Poder entra só depois)
        const sala = async () => {
          const a = await abrirSala(pg)
          a.nomes = await pg.evaluate(() => window.__galope.ui.lobby.racers.filter((r) => !r.isPlayer).map((r) => r.name).sort().join('|'))
          a.poderVoce = Number(await pg.locator('.programa li.voce .poder b').textContent())
          return a
        }
        const salaA = await sala()
        if (salaA.seed !== (S.hash2(MIG5_SEED, 4) >>> 0) || salaA.counter !== 4 || salaA.fee !== 100 || salaA.training) problems.push(`${label}: sala ` + JSON.stringify(salaA))
        if (salaA.blocks !== JSON.stringify(S.randomConditions(salaA.seed).blocks)) problems.push(`${label}: o mapa da sala não é o da seed`)
        const rng = S.mulberry32(S.hash2(salaA.seed, 0xA11CE))
        rng()   // o nome da pista
        const n = G.ECONOMY.minRacers + Math.floor(rng() * (G.ECONOMY.maxRacers - G.ECONOMY.minRacers + 1))
        const nomes = G.BOT_NAMES.slice()
        for (let i = nomes.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = nomes[i]; nomes[i] = nomes[j]; nomes[j] = t }
        if (salaA.nomes !== nomes.slice(0, n - 1).sort().join('|')) problems.push(`${label}: rivais ${salaA.nomes} (da seed: ${nomes.slice(0, n - 1).sort().join('|')})`)
        // RF5: o Poder do jogador na sala é o do cavalo sem as peças
        const m1 = s.mounts.find((y) => y.uid === 'm1')
        if (salaA.poderVoce !== S.powerRating(Object.assign({}, m1, { equip: GR.emptyEquip() }))) problems.push(`${label}: Poder na sala ${salaA.poderVoce} (sem as peças: ${S.powerRating(m1)})`)
        // recarregar duas vezes: o aviso não volta e a sala é exatamente a mesma
        for (let k = 1; k <= 2; k++) {
          await pg.reload({ waitUntil: 'domcontentloaded' })
          await pg.waitForSelector('#t-estabulo')
          if ((await avisos(pg)).includes(AVISO_V6)) problems.push(`${label}: o aviso da migração voltou na recarga ${k}`)
          const salaK = await sala()
          for (const c of ['seed', 'counter', 'fee', 'training', 'track', 'blocks', 'weather', 'rivais', 'nomes', 'gold']) {
            if (salaA[c] !== salaK[c]) problems.push(`${label}: recarga ${k} mudou a sala (${c}: ${salaA[c]} -> ${salaK[c]})`)
          }
        }
        // RF5 na corrida: ninguém corre com peças, e o resultado é o mesmo da simulação com e sem as peças do save;
        // a Pedra Negra do pódio não cai (o podiumStone nem é chamado: a espia devolveria sempre 1 pedra)
        await pg.evaluate(() => {
          window.__pedraChamadas = 0
          window.Gear.podiumStone = function () { window.__pedraChamadas++; return 1 }
        })
        await pg.getByRole('button', { name: /^Largar/ }).click()
        await pg.waitForSelector('#pista')
        const L = await pg.evaluate(() => {
          const L = window.__galope.ui.lobby
          return { seed: L.seed, cond: L.sim.conditions, racers: L.racers.map((r) => ({ horse: r.horse, name: r.name, isPlayer: r.isPlayer, comPecas: !!r.gear })), times: L.sim.finishTimes }
        })
        if (L.racers.some((r) => r.comPecas)) problems.push(`${label}: corredor com peças na sala: ` + L.racers.filter((r) => r.comPecas).map((r) => r.name).join(', '))
        const its = Object.fromEntries(s.items.map((it) => [it.uid, it]))
        const simula = (comPecas) => S.simulate({ seed: L.seed, conditions: L.cond,
          racers: L.racers.map((r) => ({ horse: r.horse, name: r.name, isPlayer: r.isPlayer, gear: comPecas && r.isPlayer ? GR.resolve(m1, its) : null })) }).finishTimes
        if (!igual(simula(false), L.times) || !igual(simula(true), L.times)) problems.push(`${label}: a corrida do jogo difere da simulação sem peças ou com as peças do save`)
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado')
        const R = await pg.evaluate(() => ({ stone: window.__galope.ui.result.stone, place: window.__galope.ui.result.place, pedras: window.__galope.state.pedras, chamadas: window.__pedraChamadas }))
        if (R.chamadas !== 0 || R.stone !== 0 || R.pedras !== 7) problems.push(`${label}: Pedra Negra do pódio com o equipamento suspenso ` + JSON.stringify(R))
        if (/Pedra Negra/.test(await textoTela(pg))) problems.push(`${label}: o resultado fala em Pedra Negra`)
        await pg.locator('[data-acao="resultado-aba"][data-id="momentos"]').click()   // e a outra aba do resultado
        if (/Pedra Negra/.test(await textoTela(pg))) problems.push(`${label}: o resultado fala em Pedra Negra (aba Momentos)`)
        notes.crescimentoMigracao = { pr: s.pending.pr, prV5: MIG_V5.pending.pr, rivais: salaA.rivais, lugar: R.place }
      } catch (e) {
        problems.push(`${label}: ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 2. lixo no save novo (RF2), sem equipamento na tela, pareamento rápido, potro e jóquei mantido (jogo real, 360 px)
    {
      const label = 'crescimento-jogo'
      const pg = await newPage(browser, { width: 360, height: 780 }, label)
      try {
        await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
        await pg.waitForSelector('#t-estabulo')
        let s = await estado(pg)
        if (s.v !== 6 || s.redeas !== 0 || s.avisoV6 !== false || s.mounts[0].respecFree !== true || !igual(s.mounts[0].alloc, ZERO)) problems.push(`${label}: jogo novo ` + JSON.stringify({ v: s.v, redeas: s.redeas, avisoV6: s.avisoV6, m1: s.mounts[0] }))
        if ((await avisos(pg)).includes(AVISO_V6)) problems.push(`${label}: o jogo novo mostrou o aviso da migração`)
        // abrir a sala (pareamento): a 1ª monta a memória do Poder dos bots; as seguintes ficam bem abaixo de 15 ms
        const t = await pg.evaluate(() => {
          const g = window.__galope, pr0 = window.RaceSim.powerRating(g.state.mounts[0]), out = []
          for (let k = 0; k < 21; k++) {
            const t0 = performance.now()
            g.buildLobby({ counter: 1000 + k, training: false, fee: 50, pr: Math.round(pr0 * (1 + 0.05 * (k % 7))) })
            out.push(performance.now() - t0)
          }
          return out
        })
        const media = t.slice(1).reduce((a, b) => a + b, 0) / (t.length - 1)
        notes.crescimentoSalaMs = { primeira: +t[0].toFixed(2), media20: +media.toFixed(2), max20: +Math.max(...t.slice(1)).toFixed(2) }
        if (!(media < 15)) problems.push(`${label}: abrir a sala custa ${media.toFixed(1)} ms em média (esperado < 15 ms; a 1ª: ${t[0].toFixed(1)} ms)`)
        if ((await estado(pg)).raceCounter !== 0) problems.push(`${label}: medir o pareamento gravou uma sala`)

        // RF2: lixo em respecFree, redeas e avisoV6 volta ao padrão; valores válidos ficam
        for (const rd of [-3, 2.5, 'x', 5000, null, '4']) {
          await montaSave(pg, (raw) => { raw.redeas = rd; raw.mounts[0].respecFree = 'sim'; raw.avisoV6 = 'sim' })
          s = await estado(pg)
          if (s.redeas !== 0) problems.push(`${label}: redeas ${JSON.stringify(rd)} abriu como ${s.redeas} (esperado 0)`)
          if (s.mounts[0].respecFree !== true) problems.push(`${label}: respecFree 'sim' abriu como ${s.mounts[0].respecFree}`)
          if (s.avisoV6 !== false || (await avisos(pg)).includes(AVISO_V6)) problems.push(`${label}: avisoV6 'sim' mostrou o aviso da migração`)
        }
        for (const [rd, rf] of [[7, false], [999, true], [0, false]]) {
          await montaSave(pg, (raw) => { raw.redeas = rd; raw.mounts[0].respecFree = rf })
          s = await estado(pg)
          if (s.redeas !== rd || s.mounts[0].respecFree !== rf) problems.push(`${label}: valores válidos mudaram (redeas ${rd} -> ${s.redeas}, respecFree ${rf} -> ${s.mounts[0].respecFree})`)
        }
        // alloc acima do orçamento (e lixo) num save v6: cortado pelo validAlloc (teto, custo por faixa, Sorte 0)
        const LIXO = { vel: 60, acel: 60, man: 'abc', forca: -2, est: 3.7, garra: 1e300, sorte: 9 }
        await montaSave(pg, (raw) => { raw.mounts[0].level = 15; raw.mounts[0].alloc = LIXO })
        s = await estado(pg)
        const mL = s.mounts[0]
        if (!igual(mL.alloc, S.validAlloc(mL, LIXO)) || custo(mL.alloc) > S.freePoints(mL) || mL.alloc.sorte !== 0) problems.push(`${label}: alloc acima do orçamento abriu como ${JSON.stringify(mL.alloc)} (validAlloc: ${JSON.stringify(S.validAlloc(mL, LIXO))}, ${S.freePoints(mL)} pontos)`)
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        if (!igual((await estado(pg)).mounts[0].alloc, mL.alloc)) problems.push(`${label}: recarregar o alloc cortado mudou o alloc`)

        // sem equipamento: 4 abas (sem a Loja), sem Pedras no cabeçalho, sem resumo de peças no Estábulo
        // (uma peça solta e o conjunto do Sol inteiro na Brasa: o Poder e a chance de skill ignoram os dois)
        await montaSave(pg, (raw) => {
          raw.items = GR.SLOTS.map((sl, i) => ({ uid: 'i' + (i + 1), id: sl + '-sol-lendario', plus: 4 })).concat([{ uid: 'i9', id: 'sela-magico', plus: 0 }])
          raw.nextItemUid = 10; raw.pedras = 5; raw.gold = 2000
          raw.mounts[0].equip = Object.fromEntries(GR.SLOTS.map((sl, i) => [sl, 'i' + (i + 1)]))
        })
        const abas = await pg.locator('.app-abas [data-acao="aba"]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-id')))
        if (!igual(abas, ['estabulo', 'correr', 'expedicao', 'haras'])) problems.push(`${label}: abas ${abas.join(',')} (esperado estabulo,correr,expedicao,haras)`)
        await forca(pg, 'aba', 'loja')
        if (await pg.locator('#t-loja').count()) problems.push(`${label}: a Loja abriu pelo botão forçado`)
        if (await pg.locator('.app-topo .pedras').count()) problems.push(`${label}: saldo de Pedras no cabeçalho`)
        if (await pg.locator('#tela .slots, #tela .set-badge').count()) problems.push(`${label}: resumo de peças no Estábulo`)
        s = await estado(pg)
        const m1 = s.mounts[0]
        // Montaria: sub-abas Status, Skills e Ficha (sem Equipamento); a chance de skill (na aba Ficha, 3b §5) sem o bônus do conjunto
        await pg.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await pg.waitForSelector('#t-montaria')
        const subabas = await pg.locator('[data-acao="montaria-aba"]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-id')))
        if (!igual(subabas, ['status', 'skills', 'ficha'])) problems.push(`${label}: sub-abas da Montaria ${subabas.join(',')} (esperado status,skills,ficha)`)
        if (await pg.locator('#tela .slots, #tela .set-badge').count()) problems.push(`${label}: resumo de peças na ficha da Montaria`)
        const pctSkill = Math.round(S.skillChance(m1, S.computeStats(m1), 0) * 100)
        await pg.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
        if (await pg.locator('#tela .slots, #tela .set-badge').count()) problems.push(`${label}: resumo de peças na aba Ficha da Montaria`)
        if (!new RegExp('Skills:\\s*' + pctSkill + '%').test(await textoTela(pg))) problems.push(`${label}: chance de skill na ficha não é ${pctSkill}% (sem o bônus do conjunto)`)
        await pg.locator('[data-acao="montaria-aba"][data-id="status"]').click()
        // ações de peça e da Loja com o botão forçado: nada muda
        const antes = await estado(pg)
        for (const [acao, id] of [['equipar-tela', 'm1'], ['equip-slot', 'sela'], ['tirar', 'sela'], ['equipar', 'i9'], ['vender', 'i9'], ['melhorar', 'i1'], ['melhorar-sim', 'i1'],
          ['vender-desfazer', null], ['comprar', 'sela-comum'], ['comprar-pedra', '1'], ['loja-tab', 'pedras'], ['montaria-aba', 'equip']]) await forca(pg, acao, id)
        const depois = await estado(pg)
        for (const c of ['items', 'gold', 'pedras', 'enhanceCounter', 'nextItemUid']) if (!igual(antes[c], depois[c])) problems.push(`${label}: ação de peça forçada mudou ${c}: ${JSON.stringify(antes[c])} -> ${JSON.stringify(depois[c])}`)
        if (!igual(antes.mounts[0].equip, depois.mounts[0].equip)) problems.push(`${label}: ação de peça forçada mudou o equipado ` + JSON.stringify(depois.mounts[0].equip))
        const ui1 = await pg.evaluate(() => ({ tela: window.__galope.ui.screen, aba: window.__galope.ui.montaria && window.__galope.ui.montaria.aba }))
        if (ui1.tela !== 'montaria' || ui1.aba !== 'status') problems.push(`${label}: ação de peça forçada mudou a tela ` + JSON.stringify(ui1))
        // Perfil sem Pedras e sem a contagem de peças (as peças continuam no save)
        await pg.locator('[data-acao="perfil"]').click()
        await pg.waitForSelector('#t-perfil')
        const perfil = await textoTela(pg)
        if (/Pedras/.test(perfil) || /peças?\b/.test(perfil)) problems.push(`${label}: Perfil com Pedras ou peças: ` + perfil.replace(/\s+/g, ' ').slice(0, 200))
        await pg.locator('[data-acao="perfil-voltar"]').click()
        // Correr e largada: sem o resumo de peças nem o atalho Equipar; o Poder é o do cavalo sem as peças
        const poder = S.powerRating(Object.assign({}, m1, { equip: GR.emptyEquip() }))
        await pg.locator('[data-acao="aba"][data-id="correr"]').click()
        await pg.waitForSelector('#t-correr')
        if (await pg.locator('#tela .slots, #tela [data-acao="equipar-tela"]').count()) problems.push(`${label}: aba Correr com o resumo de peças ou o Equipar`)
        const poderCorrer = await pg.evaluate(() => { const sp = Array.from(document.querySelectorAll('[aria-label="Montaria ativa"] .linha-meta span')).find((x) => /^Poder/.test(x.textContent)); return sp ? Number(sp.querySelector('b').textContent) : null })
        if (poderCorrer !== poder) problems.push(`${label}: aba Correr com Poder ${poderCorrer} (o do cavalo sem peças: ${poder})`)
        await abrirSala(pg)
        if (await pg.locator('#tela .slots, #tela .set-badge, #tela [data-acao="equipar-tela"]').count()) problems.push(`${label}: a largada mostra o resumo de peças ou o Equipar`)
        if (/conjunto completo/i.test(await textoTela(pg))) problems.push(`${label}: a largada ainda fala do conjunto de peças`)
        const prSala = (await estado(pg)).pending.pr
        if (prSala !== poder) problems.push(`${label}: Poder da sala ${prSala} (o do cavalo sem peças: ${poder})`)
        await pg.getByRole('button', { name: /^Largar/ }).click()
        await pg.waitForSelector('#pista')
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado')
        s = await estado(pg)
        if (s.pedras !== 5 || !igual(s.items, depois.items)) problems.push(`${label}: a corrida mexeu nas Pedras ou nas peças ` + JSON.stringify({ pedras: s.pedras }))
        await pg.getByRole('button', { name: /^Voltar/ }).click()
        await pg.waitForSelector('#t-correr')

        // potro: nasce com a redistribuição grátis e nenhum ponto (também depois de recarregar)
        await pg.locator('[data-acao="aba"][data-id="haras"]').click()
        await pg.waitForSelector('#t-haras')
        await pg.locator('[data-acao="haras-partner"][data-kind="rent"][data-id="w-faisca"]').click()
        await pg.locator('[data-acao="cruzar"]').click()
        await pg.waitForSelector('#t-nasceu')
        s = await estado(pg)
        const potro = s.mounts[s.mounts.length - 1]
        if (s.mounts.length !== 2 || potro.respecFree !== true || !igual(potro.alloc, ZERO)) problems.push(`${label}: potro ` + JSON.stringify({ n: s.mounts.length, respecFree: potro.respecFree, alloc: potro.alloc }))
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        const potro2 = (await estado(pg)).mounts.find((m) => m.uid === potro.uid)
        if (!potro2 || potro2.respecFree !== true || !igual(potro2.alloc, ZERO)) problems.push(`${label}: potro depois de recarregar ` + JSON.stringify(potro2))

        // jóquei: "Recomeçar com outro inicial" mantém o padrão e o capacete (também se a aba recarregar na escolha)
        const JQ = { padrao: 'estrelas', capacete: '#c77dff' }
        await pg.locator('[data-acao="perfil"]').click()
        await pg.waitForSelector('#t-perfil')
        await pg.locator(`[data-acao="joquei-padrao"][data-id="${JQ.padrao}"]`).click()
        await pg.locator(`[data-acao="joquei-capacete"][data-id="${JQ.capacete}"]`).click()
        if (!igual((await estado(pg)).joquei, JQ)) problems.push(`${label}: o Perfil não trocou o jóquei ` + JSON.stringify((await estado(pg)).joquei))
        await pg.getByRole('button', { name: 'Recomeçar com outro inicial' }).click()
        await pg.getByRole('button', { name: 'Sim, recomeçar' }).click()
        await pg.waitForSelector('.inicial')
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('.inicial')
        await pg.getByRole('button', { name: 'Escolher Maré' }).click()
        await pg.waitForSelector('#t-estabulo')
        s = await estado(pg)
        const d = await disco(pg)
        if (s.mounts[0].templateId !== 'mare' || !igual(s.joquei, JQ) || !igual(d.joquei, JQ)) problems.push(`${label}: Recomeçar perdeu o jóquei ` + JSON.stringify({ t: s.mounts[0].templateId, memoria: s.joquei, disco: d.joquei }))
        if ((await pg.evaluate(() => window.localStorage.getItem('galope-elemental:v1:joquei'))) !== null) problems.push(`${label}: a chave do jóquei guardado ficou depois de escolher o inicial`)
        if (s.redeas !== 0 || s.mounts[0].respecFree !== true) problems.push(`${label}: o save novo não começou com 0 Rédeas e a redistribuição grátis`)
      } catch (e) {
        problems.push(`${label}: ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 3. Redistribuir (modo DEV, com a espia do localStorage): a 1ª grátis, a 2ª sem Rédea desabilitada, com Rédea gasta 1,
    //    dois toques, gravação que falha (RF4), páreo aberto (a ativa não, as outras sim) e a gaveta DEV (Rédeas e a caixa
    //    da redistribuição grátis), sem nunca tocar no save real
    {
      const label = 'crescimento-redistribuir'
      const REAL = JSON.stringify({ v: 2, starterId: 'mare', level: 7, xp: 10, skills: [], gold: 777, races: 3, wins: 1, podiums: 2, goldWon: 300, seedBase: 4242, raceCounter: 3 })
      const init = { content: `(() => {
        try { if (localStorage.getItem('galope-elemental:v1') === null) localStorage.setItem('galope-elemental:v1', ${JSON.stringify(REAL)}) } catch (e) {}
        const log = window.__acessos = []
        window.__lsGet = Storage.prototype.getItem
        for (const fn of ['getItem', 'setItem', 'removeItem']) {
          const orig = Storage.prototype[fn]
          Storage.prototype[fn] = function (k) { log.push(fn + ':' + k); return orig.apply(this, arguments) }
        }
      })()` }
      const pg = await newPage(browser, { width: 390, height: 844 }, label, { query: '?dev=1', init })
      const DEV_KEY = 'galope-elemental:dev'
      const botao = () => pg.locator('[data-acao="redistribuir"]')
      const da = (s, uid) => s.mounts.find((m) => m.uid === uid)
      const pontosDev = async (pts) => {   // "Aplicar na ativa" com os pontos pedidos (o resto em 0)
        await devAbrir(pg)
        for (const k of G.STAT_KEYS) await pg.fill('#dev-pt-' + k, String(pts[k] || 0))
        await pg.locator('[data-acao="dev-aplicar"]').click()
        await devFechar(pg)
      }
      const abreStatus = async (uid) => {
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.waitForSelector('#t-estabulo')
        await pg.locator(`button[data-acao="montaria"][data-id="${uid}"]`).click()
        await pg.waitForSelector('#t-montaria')
      }
      // dois toques com a gravação quebrada: nada muda e o aviso de falha aparece; depois, os dois toques de verdade
      const falhaEGrava = async (uid, quando) => {
        const a = await estado(pg)
        await botao().click()
        await quebrar(pg)
        await botao().click()
        const b = await estado(pg)
        await consertar(pg)
        if (!igual(da(a, uid).alloc, da(b, uid).alloc) || da(a, uid).respecFree !== da(b, uid).respecFree || a.redeas !== b.redeas) problems.push(`${label}: ${quando}: Redistribuir sem gravar mudou o save ` + JSON.stringify({ antes: [da(a, uid).alloc, da(a, uid).respecFree, a.redeas], depois: [da(b, uid).alloc, da(b, uid).respecFree, b.redeas] }))
        if (!(await avisos(pg)).includes(FALHA)) problems.push(`${label}: ${quando}: Redistribuir sem gravar não avisou`)
        const g = await disco(pg, DEV_KEY)
        if (!igual(da(g, uid).alloc, da(a, uid).alloc) || g.redeas !== a.redeas) problems.push(`${label}: ${quando}: o save de teste mudou com a gravação quebrada`)
        await botao().click()   // o 1º toque continua valendo depois da falha (como no Confirmar dos pontos)
        return estado(pg)
      }
      try {
        await pg.waitForSelector('#t-estabulo')
        await devAbrir(pg)
        await pg.locator('[data-acao="dev-niveis"]').click()
        if (!(await pg.locator('#dev-respecfree').isChecked())) problems.push(`${label}: a caixa da redistribuição grátis não mostra a da ativa (true)`)
        await devFechar(pg)
        await pontosDev({ vel: 4, acel: 2 })
        let s = await estado(pg)
        if (!igual(da(s, 'm1').alloc, Object.assign({}, ZERO, { vel: 4, acel: 2 })) || da(s, 'm1').respecFree !== true || s.redeas !== 0) problems.push(`${label}: preparo ` + JSON.stringify({ m1: da(s, 'm1'), redeas: s.redeas }))
        // a 1ª é grátis: dois toques; o 1º só mostra o que vai gastar
        await abreStatus('m1')
        if (!(await botao().count()) || (await botao().isDisabled())) problems.push(`${label}: Redistribuir ausente ou desabilitado na 1ª vez`)
        await botao().click()
        if (!(await avisos(pg)).includes('Grátis: a primeira deste cavalo')) problems.push(`${label}: o 1º toque não disse que é grátis: ` + await avisos(pg))
        s = await estado(pg)
        if (!igual(da(s, 'm1').alloc, Object.assign({}, ZERO, { vel: 4, acel: 2 })) || da(s, 'm1').respecFree !== true) problems.push(`${label}: o 1º toque já redistribuiu`)
        await botao().click()   // 2º toque: grava (a gravação que falha vem abaixo, com os pontos de novo)
        s = await estado(pg)
        if (!igual(da(s, 'm1').alloc, ZERO) || da(s, 'm1').respecFree !== false || s.redeas !== 0) problems.push(`${label}: a 1ª redistribuição ` + JSON.stringify({ alloc: da(s, 'm1').alloc, respecFree: da(s, 'm1').respecFree, redeas: s.redeas }))
        if (await botao().count()) problems.push(`${label}: Redistribuir continua na tela sem pontos comprados`)
        const g1 = await disco(pg, DEV_KEY)
        if (!igual(da(g1, 'm1').alloc, ZERO) || da(g1, 'm1').respecFree !== false) problems.push(`${label}: a 1ª redistribuição não foi gravada no save de teste`)
        // a 2ª, sem Rédea: desabilitada com o motivo; o clique forçado não muda nada
        await pontosDev({ vel: 3 })
        await abreStatus('m1')
        if (!(await indisp(botao())) || !/Rédea nova/.test((await botao().getAttribute('title')) || '')) problems.push(`${label}: a 2ª sem Rédea não está desabilitada com o motivo (title ${await botao().getAttribute('title')})`)
        if (!/Rédea nova/.test(await textoTela(pg))) problems.push(`${label}: o motivo da 2ª sem Rédea não aparece na tela`)
        const a2 = await estado(pg)
        for (let k = 0; k < 2; k++) await pg.evaluate(() => { const b = document.querySelector('[data-acao="redistribuir"]'); b.disabled = false; b.removeAttribute('aria-disabled'); b.click() })
        if (!igual(await estado(pg), a2)) problems.push(`${label}: o clique forçado na 2ª sem Rédea mudou o save`)
        // Rédeas pela gaveta DEV: lixo é cortado a 0–999; com 2 Rédeas a 2ª gasta 1 (RF4 antes: a falha não gasta)
        await devAbrir(pg)
        for (const [v, esp] of [['5000', 999], ['-4', 0], ['2', 2]]) {
          await pg.fill('#dev-redeas', v)
          await pg.locator('[data-acao="dev-redeas"]').click()
          if ((await estado(pg)).redeas !== esp) problems.push(`${label}: Rédeas "${v}" pela gaveta ficaram ${(await estado(pg)).redeas} (esperado ${esp})`)
        }
        if ((await disco(pg, DEV_KEY)).redeas !== 2) problems.push(`${label}: as Rédeas da gaveta não foram gravadas no save de teste`)
        await devFechar(pg)
        if (await botao().isDisabled()) problems.push(`${label}: com Rédea, Redistribuir continua desabilitado`)
        await botao().click()
        if (!(await avisos(pg)).includes('Usa 1 Rédea nova; você tem 2')) problems.push(`${label}: o 1º toque com Rédea não disse o que gasta: ` + await avisos(pg))
        await pg.locator('[data-acao="montaria-aba"][data-id="skills"]').click()   // trocar de sub-aba desarma o 1º toque
        await pg.locator('[data-acao="montaria-aba"][data-id="status"]').click()
        s = await falhaEGrava('m1', 'com Rédea')
        if (!igual(da(s, 'm1').alloc, ZERO) || s.redeas !== 1 || da(s, 'm1').respecFree !== false) problems.push(`${label}: a 2ª com Rédea ` + JSON.stringify({ alloc: da(s, 'm1').alloc, redeas: s.redeas, respecFree: da(s, 'm1').respecFree }))
        // RF4 na grátis: a caixa da gaveta devolve a redistribuição grátis à ativa (e grava); a falha não a gasta
        await devAbrir(pg)
        await pg.setChecked('#dev-respecfree', false)
        if (da(await estado(pg), 'm1').respecFree !== false) problems.push(`${label}: desmarcar a caixa não desligou a redistribuição grátis`)
        await pg.setChecked('#dev-respecfree', true)
        if (da(await estado(pg), 'm1').respecFree !== true || da(await disco(pg, DEV_KEY), 'm1').respecFree !== true) problems.push(`${label}: marcar a caixa não ligou (ou não gravou) a redistribuição grátis`)
        await devFechar(pg)
        await pontosDev({ est: 5 })
        await abreStatus('m1')
        s = await falhaEGrava('m1', 'grátis')
        if (!igual(da(s, 'm1').alloc, ZERO) || s.redeas !== 1 || da(s, 'm1').respecFree !== false) problems.push(`${label}: a grátis depois da falha ` + JSON.stringify({ alloc: da(s, 'm1').alloc, redeas: s.redeas, respecFree: da(s, 'm1').respecFree }))
        // páreo aberto: a ativa não redistribui (desabilitada com o motivo, nem forçando); outra montaria sim
        await pontosDev({ vel: 2 })   // m1, ativa, com pontos
        await devAbrir(pg)
        await pg.locator('[data-acao="dev-criar"]').click()   // m2 (vira a ativa), com os mesmos pontos
        await devFechar(pg)
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.locator('button[data-acao="montaria"][data-id="m1"]').click()   // 3b §4 e §5: "Tornar ativa" só na aba Ficha
        await pg.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
        await pg.locator('.montaria-ficha [data-acao="ativar"]').click()
        s = await estado(pg)
        if (s.activeId !== 'm1' || !(G.STAT_KEYS.some((k) => da(s, 'm2').alloc[k] > 0))) problems.push(`${label}: preparo do páreo ` + JSON.stringify({ ativa: s.activeId, m2: da(s, 'm2') && da(s, 'm2').alloc }))
        await abrirSala(pg)
        await pg.getByRole('button', { name: /^Voltar/ }).click()
        await abreStatus('m1')
        if (!(await indisp(botao())) || !/Páreo aberto/.test((await botao().getAttribute('title')) || '')) problems.push(`${label}: com páreo aberto, Redistribuir da ativa não está desabilitado com o motivo`)
        const a3 = await estado(pg)
        for (let k = 0; k < 2; k++) await pg.evaluate(() => { const b = document.querySelector('[data-acao="redistribuir"]'); b.disabled = false; b.removeAttribute('aria-disabled'); b.click() })
        if (!igual(await estado(pg), a3)) problems.push(`${label}: o clique forçado com páreo aberto redistribuiu a ativa`)
        await abreStatus('m2')
        if (await botao().isDisabled()) problems.push(`${label}: com páreo aberto, Redistribuir de outra montaria ficou desabilitado`)
        await botao().click()
        await botao().click()
        s = await estado(pg)
        if (!igual(da(s, 'm2').alloc, ZERO) || da(s, 'm2').respecFree !== false || s.redeas !== 1 || !s.pending) problems.push(`${label}: outra montaria com páreo aberto ` + JSON.stringify({ alloc: da(s, 'm2').alloc, respecFree: da(s, 'm2').respecFree, redeas: s.redeas, sala: !!s.pending }))
        await checkOverflow(pg, label)
        // o save real nunca foi lido nem gravado
        const ac = await pg.evaluate(() => ({ real: window.__lsGet.call(localStorage, 'galope-elemental:v1'), acessos: window.__acessos.slice() }))
        if (ac.real !== REAL) problems.push(`${label}: o save real mudou: ${ac.real}`)
        if (ac.acessos.some((x) => /galope-elemental:v1(:|$)/.test(x))) problems.push(`${label}: a página tocou no save real: ` + ac.acessos.filter((x) => /galope-elemental:v1/.test(x)).join(', '))
      } catch (e) {
        problems.push(`${label}: ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 4. abas Status e Skills da spec §11 (jogo real, 360 px): cada linha com o custo do próximo ponto e +1, +5 e +10 (o
    //    custo no title e no aria-label; desabilitado com o motivo quando não cabe: pontos, 150 ou trava do páreo), a Sorte
    //    de nascimento, o topo "sobram X de Y" e "Poder A → B", a barra até 150, "Distribuir sugerido" (e RF3: com páreo
    //    aberto, o rascunho sugerido passa do Poder da sala, o Confirmar fica bloqueado e nada é gravado), os dois avisos do
    //    Confirmar, o rodapé, a skill de tipo em pontos e o selo "+N" do Estábulo
    {
      const label = 'crescimento-status'
      const pg = await newPage(browser, { width: 360, height: 780 }, label)
      const rascunho = () => pg.evaluate(() => { const r = window.__galope.ui.rascunho; return r ? JSON.parse(JSON.stringify(r)) : null })
      const mais = (k, n) => pg.locator(`[data-acao="ponto-mais"][data-id="${k}"][data-n="${n}"]`)
      const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim()
      // 3b §6: o custo à vista é curto ("·2", "teto"); o leitor de tela ouve a frase inteira (.sr). custoLinha é o texto lido
      // (sem o que está aria-hidden), custoVisto o que aparece (sem o .sr)
      const custoLinha = async (k) => limpo(await pg.locator(`[data-status="${k}"] .build-custo`).evaluate((e) => { const c = e.cloneNode(true); c.querySelectorAll('[aria-hidden="true"]').forEach((x) => x.remove()); return c.textContent }).catch(() => ''))
      const custoVisto = async (k) => limpo(await pg.locator(`[data-status="${k}"] .build-custo`).evaluate((e) => { const c = e.cloneNode(true); c.querySelectorAll('.sr').forEach((x) => x.remove()); return c.textContent }).catch(() => ''))
      const topo = async () => limpo(await pg.locator('.build-topo').textContent().catch(() => ''))
      // 3b §6: o "Poder A → B" do rascunho fica na barra presa (.barra-acao), junto de Desfazer e Confirmar
      const barraTxt = async () => limpo(await pg.locator('#tela .barra-acao').textContent({ timeout: 500 }).catch(() => ''))
      const somaR = (a, r) => Object.fromEntries(G.STAT_KEYS.map((k) => [k, a[k] + (r ? r[k] || 0 : 0)]))
      const livresDe = (m, a) => S.freePoints(m) - custo(a)
      const sugerido = (m, de) => { const b = S.botAlloc(m, de); return Object.fromEntries(G.STAT_KEYS.map((k) => [k, b[k] - m.alloc[k]])) }
      const botoes = async () => { const r = await pg.evaluate(() => Array.from(document.querySelectorAll('[data-acao="ponto-mais"]')).map((b) => ({
        k: b.getAttribute('data-id'), n: Number(b.getAttribute('data-n')), txt: b.textContent.trim(), title: b.getAttribute('title'), aria: b.getAttribute('aria-label'), off: b.getAttribute('aria-disabled') === 'true', nativo: b.disabled }))); if (r.some((b) => b.nativo)) problems.push('ponto-mais com disabled nativo: ' + JSON.stringify(r.filter((b) => b.nativo))); return r }
      // os 18 botões a partir dos pontos a (gravados + rascunho) com `livres` sobrando, longe do teto e sem páreo:
      // desabilitado só quando o custo de N passa do que sobra, com "Faltam pontos" no title
      const confereBotoes = async (a, livres, onde) => {
        const bs = await botoes()
        if (bs.length !== 18 || bs.some((b) => b.k === 'sorte')) problems.push(`${label}: ${onde}: ${bs.length} botões +N (esperado 18, nenhum na Sorte)`)
        for (const b of bs) {
          const c = S.costOf(a[b.k] + b.n) - S.costOf(a[b.k]), off = c > livres
          const esp = tituloMais(a, b.k, b.n) + (off ? `. Faltam pontos: ${livres === 1 ? 'sobra 1.' : `sobram ${livres}.`}` : '')
          if (b.txt !== '+' + b.n || b.off !== off || b.title !== esp || b.aria !== esp) problems.push(`${label}: ${onde}: botão ${JSON.stringify(b)} (esperado "${esp}", ${off ? 'desabilitado' : 'habilitado'})`)
        }
      }
      const abre = async (uid, aba = 'status') => {
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.waitForSelector('#t-estabulo')
        await pg.locator(`button[data-acao="montaria"][data-id="${uid}"]`).click()
        await pg.waitForSelector('#t-montaria')
        if (aba !== 'status') await pg.locator(`[data-acao="montaria-aba"][data-id="${aba}"]`).click()
      }
      const seloDe = async (uid) => limpo(await pg.locator(`.montaria-linha[data-id="${uid}"] .pontos-livres`).first().textContent({ timeout: 500 }).catch(() => ''))
      try {
        await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
        await pg.waitForSelector('#t-estabulo')
        // m1: Brasa nível 30 (100 pontos) com 12 em Velocidade e 8 em Aceleração; m2: Maré nível 20 sem a redistribuição
        // grátis; m3: Lendário de Grama ★★★ nível 50 sem pontos
        await montaSave(pg, (raw) => {
          Object.assign(raw.mounts[0], { level: 30, alloc: Object.assign({}, ZERO, { vel: 12, acel: 8 }) })
          raw.mounts.push(deModelo(G.STARTERS.find((h) => h.id === 'mare'), { uid: 'm2', level: 20, alloc: ZERO, respecFree: false }))
          raw.mounts.push(Object.assign(JSON.parse(JSON.stringify(TETO_M2)), { uid: 'm3', element: 'grama', rarity: 'lendario', grau: 3, level: 50, alloc: ZERO }))
          raw.nextUid = 4; raw.stableSlots = 3
        })
        let s = await estado(pg)
        const m1 = s.mounts[0]
        if (m1.level !== 30 || !igual(m1.alloc, somaR(ZERO, { vel: 12, acel: 8 })) || s.mounts.length !== 3 || s.mounts[1].respecFree !== false) problems.push(`${label}: preparo ` + JSON.stringify(s.mounts.map((m) => [m.uid, m.level, m.alloc, m.respecFree])))
        // selo "+N" do Estábulo: os pontos que sobram (o número do topo da aba Status) enquanto algum ponto cabe
        for (const m of s.mounts) {
          const esp = podeComprar(m)
          if ((await seloDe(m.uid)) !== (esp ? '+' + esp : '')) problems.push(`${label}: selo de ${m.uid} "${await seloDe(m.uid)}" (esperado ${esp ? '+' + esp : 'nenhum'})`)
        }
        if ((await seloDe('m1')) !== '+78') problems.push(`${label}: selo da m1 "${await seloDe('m1')}" (esperado "+78", o "sobram 78" do topo)`)
        await abre('m1')
        const info = S.allocInfo(m1)
        // topo: "Pontos: sobram X de Y", sem "Poder A → B" enquanto não há rascunho (nem a barra presa, onde ele fica)
        let tp = await topo()
        if (!tp.includes(`Pontos: sobram ${info.left} de ${info.free}`) || /Poder/.test(tp)) problems.push(`${label}: topo "${tp}" (esperado "Pontos: sobram ${info.left} de ${info.free}", sem Poder)`)
        if (await pg.locator('#tela .barra-acao').count()) problems.push(`${label}: sem rascunho, a barra presa (com o Poder) está na tela: "${await barraTxt()}"`)
        // cada linha: "próximo ponto custa C"; a Sorte, "de nascimento" e sem botões; barra até 150 em 30 segmentos
        const st1 = S.computeStats(m1)
        for (const k of G.STAT_KEYS) {
          const c = await custoLinha(k), esp = k === 'sorte' ? 'de nascimento' : 'próximo ponto custa ' + S.pointCost(m1.alloc[k])
          if (c !== esp) problems.push(`${label}: linha de ${k} diz "${c}" (esperado "${esp}")`)
          const v = await custoVisto(k), espV = k === 'sorte' ? 'de nascimento' : '·' + S.pointCost(m1.alloc[k])
          if (v !== espV) problems.push(`${label}: linha de ${k} mostra "${v}" (esperado "${espV}")`)
        }
        await confereBotoes(m1.alloc, info.left, 'sem rascunho')
        const barras = await pg.evaluate(() => Array.from(document.querySelectorAll('[data-status]')).map((l) => ({ k: l.getAttribute('data-status'),
          n: l.querySelectorAll('.build-barra i').length, on: l.querySelectorAll('.build-barra i.on').length, aria: l.querySelector('.build-barra').getAttribute('aria-label') })))
        for (const b of barras) if (b.n !== 30 || b.on !== Math.round(st1[b.k] / 5) || !b.aria.endsWith(`${st1[b.k]} de 150`)) problems.push(`${label}: barra de ${b.k} ${JSON.stringify(b)} (status ${st1[b.k]}: ${Math.round(st1[b.k] / 5)} de 30 segmentos, até 150)`)
        if (!limpo(await textoTela(pg)).includes('A barra vai até 150. O custo do ponto sobe a cada 10 pontos no mesmo status.')) problems.push(`${label}: sem o rodapé "A barra vai até 150. O custo do ponto sobe a cada 10 pontos no mesmo status."`)
        await confereLegivel(pg, ['.build-topo', '.build-custo', '.build-mais'], label)

        // teto de 150: com os pontos de verdade ninguém chega lá (spec §2), então o teste baixa o teto na página
        // (RaceSim.TUNING.statMax) até a Velocidade da Brasa: "no teto" e os três botões desabilitados com o motivo
        const tetoV = Math.ceil(S.naturalStat(m1, 'vel') + m1.alloc.vel), tetoOrig = await pg.evaluate(() => window.RaceSim.TUNING.statMax)
        await pg.evaluate((t) => { window.RaceSim.TUNING.statMax = t }, tetoV)
        await pg.locator('[data-acao="montaria-aba"][data-id="status"]').click()   // redesenha a aba
        const bt = (await botoes()).filter((b) => b.k === 'vel')
        if ((await custoLinha('vel')) !== 'no teto de ' + tetoV || (await custoVisto('vel')) !== 'teto' || bt.length !== 3 || bt.some((b) => !b.off || b.title !== tituloMais(m1.alloc, 'vel', b.n) + `. Passaria de ${tetoV}.`)) problems.push(`${label}: no teto (${tetoV} na página): "${await custoLinha('vel')}" / "${await custoVisto('vel')}" ` + JSON.stringify(bt))
        await pg.evaluate((t) => { window.RaceSim.TUNING.statMax = t }, tetoOrig)
        await pg.locator('[data-acao="montaria-aba"][data-id="status"]').click()
        if (tetoOrig !== 150 || (await custoLinha('vel')) !== 'próximo ponto custa 2' || (await custoVisto('vel')) !== '·2') problems.push(`${label}: o teto não voltou a 150 (${tetoOrig})`)

        // +1, +5 e +10 somam exatamente N ao rascunho; o topo, o "Poder A → B" e o custo da linha seguem o rascunho
        const s0 = await estado(pg), d0 = await disco(pg), poder0 = await poderNaCabeca(pg)
        const esp = { ...ZERO }
        for (const [k, n] of [['vel', 10], ['garra', 5], ['man', 1], ['est', 10], ['est', 10]]) {
          await mais(k, n).click()
          esp[k] += n
          if (!igual(await rascunho(), esp)) problems.push(`${label}: +${n} em ${k}: rascunho ${JSON.stringify(await rascunho())} (esperado ${JSON.stringify(esp)})`)
        }
        const comR = somaR(m1.alloc, esp), livres = livresDe(m1, comR)
        tp = await topo()
        const poderTxt = `Poder ${S.powerRating(m1)} → ${S.powerRating({ ...m1, alloc: comR })}`
        if (!tp.includes(`Pontos: sobram ${livres} de ${info.free}`) || /Poder/.test(tp) || !(await barraTxt()).includes(poderTxt)) problems.push(`${label}: com rascunho, topo "${tp}" e barra presa "${await barraTxt()}" (esperado "sobram ${livres} de ${info.free}" no topo e "${poderTxt}" na barra)`)
        if ((await custoLinha('est')) !== 'próximo ponto custa ' + S.pointCost(comR.est) || (await custoVisto('est')) !== '·' + S.pointCost(comR.est)) problems.push(`${label}: o custo da Estamina não segue o rascunho: "${await custoLinha('est')}" / "${await custoVisto('est')}"`)
        // com 20 sobrando, +10 em Estamina custa 30 (desabilitado, "Faltam pontos") e +5 custa 15 (habilitado)
        if (livres !== 20 || S.costOf(comR.est + 10) - S.costOf(comR.est) !== 30) problems.push(`${label}: conta do teste mudou (sobram ${livres})`)
        await confereBotoes(comR, livres, 'com rascunho')
        await pg.evaluate(() => { const b = document.querySelector('[data-acao="ponto-mais"][data-id="est"][data-n="10"]'); b.disabled = false; b.removeAttribute('aria-disabled'); b.click() })   // clique forçado
        if (!igual(await rascunho(), esp)) problems.push(`${label}: o +10 forçado sem pontos mudou o rascunho ` + JSON.stringify(await rascunho()))
        if (!igual((await estado(pg)).mounts, s0.mounts) || !igual(await disco(pg), d0)) problems.push(`${label}: o rascunho chegou ao save antes de confirmar`)
        if ((await poderNaCabeca(pg)) !== poder0) problems.push(`${label}: o Poder da cabeça mudou com o rascunho`)
        // Desfazer limpa
        await pg.locator('[data-acao="pontos-desfazer"]').click()
        if (await rascunho()) problems.push(`${label}: Desfazer não limpou o rascunho ` + JSON.stringify(await rascunho()))
        await confereBotoes(m1.alloc, info.left, 'depois de Desfazer')

        // "Distribuir sugerido": o rascunho é o botAlloc a partir dos pontos gravados (e do rascunho), sem gravar
        await pg.locator('[data-acao="pontos-sugerir"]').click()
        let r = await rascunho()
        if (!igual(r, sugerido(m1, m1.alloc)) || r.sorte !== 0) problems.push(`${label}: sugerido ${JSON.stringify(r)} (esperado ${JSON.stringify(sugerido(m1, m1.alloc))})`)
        if (!(await indisp(pg.locator('[data-acao="pontos-sugerir"]')))) problems.push(`${label}: "Distribuir sugerido" continua habilitado sem nada a somar`)
        const comS = somaR(m1.alloc, r)
        tp = await topo()
        if (!tp.includes(`sobram ${livresDe(m1, comS)} de ${info.free}`) || /Poder/.test(tp) || !(await barraTxt()).includes(`Poder ${S.powerRating(m1)} → ${S.powerRating({ ...m1, alloc: comS })}`)) problems.push(`${label}: depois do sugerido, topo "${tp}" e barra presa "${await barraTxt()}"`)
        if (!igual((await estado(pg)).mounts, s0.mounts) || !igual(await disco(pg), d0)) problems.push(`${label}: "Distribuir sugerido" gravou sem Confirmar`)
        await pg.locator('[data-acao="pontos-desfazer"]').click()
        await mais('vel', 10).click()
        await pg.locator('[data-acao="pontos-sugerir"]').click()
        r = await rascunho()
        const espS = sugerido(m1, somaR(m1.alloc, { vel: 10 }))
        if (!igual(r, espS) || r.vel < 10) problems.push(`${label}: sugerido depois de +10 em Velocidade ${JSON.stringify(r)} (esperado ${JSON.stringify(espS)})`)
        // com rascunho e pontos gravados: lista, ações e "Redistribuir pontos" embaixo, separado dos botões de compra
        const ordemDe = () => pg.evaluate(() => {
          const sec = document.querySelector('section[aria-label="Status"]'), todos = Array.from(sec.querySelectorAll('*'))
          return ['.build', '.build-acoes', '.redistribuir'].map((q) => todos.indexOf(sec.querySelector(q)))
        })
        const ordem0 = await ordemDe()
        if (!(ordem0[0] >= 0 && ordem0[0] < ordem0[1] && ordem0[1] < ordem0[2])) problems.push(`${label}: ordem lista / ações / Redistribuir ${JSON.stringify(ordem0)}`)
        // Confirmar em dois toques: o 1º só avisa (redistribuição grátis), o 2º grava
        await pg.locator('[data-acao="pontos-confirmar"]').click()
        if (!(await avisos(pg)).includes('Para mudar depois, use Redistribuir (a primeira deste cavalo é grátis).')) problems.push(`${label}: o 1º Confirmar não disse "Para mudar depois, use Redistribuir (a primeira deste cavalo é grátis).": ` + await avisos(pg))
        if (/voltar atrás/.test(await textoTela(pg))) problems.push(`${label}: o aviso antigo ("não dá para voltar atrás") continua`)
        if (!igual((await estado(pg)).mounts, s0.mounts)) problems.push(`${label}: o 1º Confirmar já gravou`)
        await pg.locator('[data-acao="pontos-confirmar"]').click()
        s = await estado(pg)
        const gravado = somaR(m1.alloc, espS)
        if (!igual(s.mounts[0].alloc, gravado) || !igual((await disco(pg)).mounts[0].alloc, gravado) || await rascunho()) problems.push(`${label}: Confirmar ${JSON.stringify({ mem: s.mounts[0].alloc, esperado: gravado })}`)
        if ((await poderNaCabeca(pg)) !== S.powerRating(s.mounts[0])) problems.push(`${label}: o Poder da cabeça depois de confirmar`)
        // gastou tudo o que cabe e sem rascunho: os +N e o "Distribuir sugerido" somem (decisão de 2026-11-13, spec §11);
        // "Redistribuir pontos" fica embaixo da lista
        const nMais = await pg.locator('[data-acao="ponto-mais"]').count(), nSug = await pg.locator('[data-acao="pontos-sugerir"]').count()
        if (nMais || nSug) problems.push(`${label}: sem nenhum ponto que caiba, a aba mostra ${nMais} botões +N e ${nSug} "Distribuir sugerido"`)
        const ordem = await ordemDe()
        if (!(ordem[0] >= 0 && ordem[1] === -1 && ordem[0] < ordem[2])) problems.push(`${label}: ordem lista / (sem ações) / Redistribuir ${JSON.stringify(ordem)}`)

        // m2 já usou a redistribuição grátis: o aviso do Confirmar fala da Rédea nova
        await abre('m2')
        await mais('est', 1).click()
        await pg.locator('[data-acao="pontos-confirmar"]').click()
        if (!(await avisos(pg)).includes('Para mudar depois, use Redistribuir (gasta uma Rédea nova).')) problems.push(`${label}: sem a grátis, o 1º Confirmar não disse "(gasta uma Rédea nova)": ` + await avisos(pg))
        await pg.locator('[data-acao="pontos-desfazer"]').click()


        // RF3: m2 ativa com páreo aberto. Os +N que passariam do Poder da sala ficam desabilitados com o motivo; o sugerido
        // passa do Poder da sala, o Confirmar fica bloqueado com o motivo (na tela e no title) e nada é gravado, nem forçando
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.locator('button[data-acao="montaria"][data-id="m2"]').click()   // 3b §4 e §5: "Tornar ativa" só na aba Ficha
        await pg.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
        await pg.locator('.montaria-ficha [data-acao="ativar"]').click()
        await abrirSala(pg)
        s = await estado(pg)
        const m2 = s.mounts.find((m) => m.uid === 'm2'), pr = s.pending.pr
        if (s.activeId !== 'm2' || pr !== S.powerRating(m2)) problems.push(`${label}: páreo da m2 ${JSON.stringify({ ativa: s.activeId, pr, poder: S.powerRating(m2) })}`)
        await pg.getByRole('button', { name: /^Voltar/ }).click()
        await abre('m2')
        for (const b of await botoes()) {
          const h2 = JSON.parse(JSON.stringify(m2)); h2.alloc[b.k] += b.n
          const passa = S.powerRating(h2) > pr
          if (passa !== b.off || (passa && b.title !== tituloMais(m2.alloc, b.k, b.n) + `. Páreo aberto: passaria do Poder ${pr} que a sala viu.`)) problems.push(`${label}: páreo aberto, botão ${JSON.stringify(b)} (passa do Poder ${pr}: ${passa})`)
        }
        // sem rascunho, o aviso geral do páreo está na tela
        const AVISO_PAREO = `Páreo aberto: os pontos da montaria ativa não podem passar o Poder de ${pr} que a sala viu.`
        if (!(await avisos(pg)).includes(AVISO_PAREO)) problems.push(`${label}: páreo aberto sem o aviso geral "${AVISO_PAREO}": ` + await avisos(pg))
        const dA = await disco(pg)
        await pg.locator('[data-acao="pontos-sugerir"]').click()
        r = await rascunho()
        if (!igual(r, sugerido(m2, m2.alloc))) problems.push(`${label}: páreo aberto, sugerido ${JSON.stringify(r)} (esperado ${JSON.stringify(sugerido(m2, m2.alloc))})`)
        const conf = pg.locator('[data-acao="pontos-confirmar"]')
        const motivo = `Páreo aberto: com este rascunho o Poder iria a ${S.powerRating({ ...m2, alloc: somaR(m2.alloc, r) })}, e a sala viu ${pr}.`
        if (!(await indisp(conf)) || !((await conf.getAttribute('title')) || '').startsWith(motivo)) problems.push(`${label}: RF3: Confirmar ${await indisp(conf) ? '' : 'habilitado '}com title "${await conf.getAttribute('title')}" (esperado "${motivo}…")`)
        if (!(await avisos(pg)).includes(motivo)) problems.push(`${label}: RF3: o motivo do Confirmar bloqueado não aparece na tela: ` + await avisos(pg))
        // o motivo é anunciado (role="status") e o aviso geral do páreo não se repete junto dele
        const papel = await pg.evaluate((mt) => { const p = Array.from(document.querySelectorAll('#tela .aviso')).find((e) => e.textContent.startsWith(mt)); return p ? p.getAttribute('role') : null }, motivo)
        if (papel !== 'status') problems.push(`${label}: RF3: o parágrafo do motivo do Confirmar bloqueado tem role "${papel}" (esperado "status")`)
        if ((await avisos(pg)).includes(AVISO_PAREO)) problems.push(`${label}: RF3: o aviso geral do páreo se repete junto do motivo do Confirmar bloqueado`)
        for (let k = 0; k < 2; k++) await pg.evaluate(() => { const b = document.querySelector('[data-acao="pontos-confirmar"]'); b.disabled = false; b.removeAttribute('aria-disabled'); b.click() })
        s = await estado(pg)
        if (!igual(s.mounts.find((m) => m.uid === 'm2').alloc, m2.alloc) || !igual(await disco(pg), dA) || s.pending.pr !== pr) problems.push(`${label}: RF3: o Confirmar forçado gravou acima do Poder da sala ` + JSON.stringify(s.mounts.find((m) => m.uid === 'm2').alloc))
        if (/Para mudar depois/.test(await avisos(pg)) || !igual(await rascunho(), r)) problems.push(`${label}: RF3: o Confirmar forçado armou o 2º toque ou perdeu o rascunho`)
        await pg.locator('[data-acao="pontos-desfazer"]').click()
        await checkOverflow(pg, label)

        // aba Skills: a skill de tipo em pontos para o cavalo, dos status atuais (Fogo, Água e Grama)
        for (const m of s.mounts) {
          await abre(m.uid, 'skills')
          // o "º" vira um "o" sobrescrito mais um "º" para leitor de tela (ordFix do game.js): o textContent traz "1oº"
          const t = limpo(await pg.locator('.vaga-tipo-pontos').textContent().catch(() => '')), espT = efeitoTipoPontos(m).replace(/º/g, 'oº')
          if (t !== espT) problems.push(`${label}: aba Skills de ${m.uid} diz "${t}" (esperado "${espT}")`)
        }
        // o selo depois de gastar: a m1 sem nada que caiba (some), as outras como antes
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        for (const m of s.mounts) {
          const e2 = podeComprar(m)
          if ((await seloDe(m.uid)) !== (e2 ? '+' + e2 : '')) problems.push(`${label}: selo de ${m.uid} depois de gastar "${await seloDe(m.uid)}" (esperado ${e2 ? '+' + e2 : 'nenhum'})`)
        }
        if (podeComprar(s.mounts[0]) !== 0) problems.push(`${label}: o sugerido deixou pontos que cabem na m1 (${podeComprar(s.mounts[0])})`)
      } catch (e) {
        problems.push(`${label}: ` + e.message)
      } finally {
        await pg.context().close()
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
  // (a Loja só com o equipamento ligado: suspenso, a barra tem 4 abas)
  const ABAS_UI = [['estabulo', 'Estábulo'], ['correr', 'Correr'], ['expedicao', 'Expedição'], ['haras', 'Haras']].concat(GEAR_ON ? [['loja', 'Loja']] : [])
  if ((await page.locator('.app-aba').count()) !== ABAS_UI.length) problems.push(`abas: ${await page.locator('.app-aba').count()} na barra (esperado ${ABAS_UI.length})`)
  for (const [aba, rotulo] of ABAS_UI) {
    const b = page.locator(`.app-aba[data-id="${aba}"]`)
    if ((await b.locator('img.icone[alt=""]').count()) !== 1) problems.push('ícones: aba ' + aba + ' sem img.icone[alt=""]')
    if (((await b.locator('.app-aba-rotulo').textContent()) || '').trim() !== rotulo) problems.push('ícones: aba ' + aba + ' perdeu o rótulo de texto')
  }
  if ((await page.locator('.app-topo .saldo img.icone--moeda-ouro[alt=""]').count()) !== 1) problems.push('ícones: saldo de Ouro sem img.icone--moeda-ouro')
  if ((await page.locator('.app-topo .pedras img.icone--pedra-negra[alt=""]').count()) !== (GEAR_ON ? 1 : 0)) problems.push(GEAR_ON ? 'ícones: saldo de Pedras sem img.icone--pedra-negra' : 'cabeçalho: saldo de Pedras com o equipamento suspenso')
  if ((await page.locator('.app-topo img.logo-img[alt="Galope Elemental"]').count()) !== 1) problems.push('ícones: cabeçalho sem img.logo-img')
  const quebradas = await page.evaluate(() => Array.prototype.filter.call(document.querySelectorAll('img.icone, img.logo-img'), (i) => !i.complete || i.naturalWidth === 0).length)
  if (quebradas) problems.push('ícones: ' + quebradas + ' imagem(ns) quebrada(s)')
  if ((await page.locator('.dev-painel, .dev-faixa, .dev-botao').count()) !== 0) problems.push('painel/faixa dev presente sem ?dev=1')

  // tela da Montaria (pela linha do Estábulo), aba Ficha (3b §5): renomear (escapado), a ativa não pode ser liberada; depois
  // expandir o estábulo
  await page.locator('button[data-acao="montaria"][data-id="m1"]').click()
  await page.waitForSelector('#t-montaria')
  await page.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
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
  if (!(await indisp(page.locator('[data-acao="liberar"][data-id="m1"]')))) problems.push('liberar da montaria ativa não está desabilitado')
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
  if (!GEAR_ON) { if (botGear.bots.some((b) => b.pieces > 0)) problems.push('sala: bot com peças com o equipamento suspenso ' + JSON.stringify(botGear)) }
  else if (alvoMax === 'bronze' ? botGear.bots.some((b) => b.pieces !== 0) : !botGear.bots.some((b) => b.pieces > 0)) problems.push('sala: equipamento dos bots fora da liga do alvo (' + alvoMax + ') ' + JSON.stringify(botGear))
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
  // a sala mostra o resumo do equipamento da montaria ativa (com o equipamento suspenso, não mostra)
  if (GEAR_ON ? (await page.locator('.slots').count()) < 1 : (await page.locator('.slots').count()) !== 0) problems.push(GEAR_ON ? 'sala: sem resumo do equipamento' : 'sala: resumo do equipamento com ele suspenso')
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
  notes.cam390 = await page.evaluate(() => window.__cc)
  await sleep(600)
  await checkOverflow(page, 'resultado')
  await page.screenshot({ path: join(SHOTS, 'final-07-resultado.png') })
  // os momentos ficam na aba Momentos do resultado (3c §8); a tabela, lida abaixo, na Chegada
  await page.locator('[data-acao="resultado-aba"][data-id="momentos"]').click()
  if (!(await page.evaluate(() => !!document.getElementById('t-dados')))) problems.push('resultado sem a seção de momentos/dados')
  await checkOverflow(page, 'resultado-momentos')
  await page.locator('[data-acao="resultado-aba"][data-id="chegada"]').click()
  const after = await page.evaluate(() => ({ gold: window.__galope.state.gold, pedras: window.__galope.state.pedras, level: window.__galope.state.mounts.filter((m) => m.uid === window.__galope.state.activeId)[0].level, xp: window.__galope.state.mounts.filter((m) => m.uid === window.__galope.state.activeId)[0].xp, result: window.__galope.ui.result, pending: window.__galope.state.pending }))
  if (after.gold !== goldBefore - after.result.fee + after.result.prize) problems.push(`ouro: ${after.gold} != ${goldBefore} - ${after.result.fee} + ${after.result.prize}`)
  if (after.pending) problems.push('sala continuou pendente depois de correr')
  // pedra do pódio: determinística pela seed da sala (1ª sala do save)
  const expectStone = GEAR_ON ? GR.podiumStone(S.hash2(seedBase1, 1), after.result.place, after.result.fee) : 0   // suspenso: não cai
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
        s.v === 6 && !('base' in s.mounts[0]) && s.items.length === 1 && s.items[0].id === 'sela-comum' && s.mounts[0].equip.sela === null && s.pedras === 0 &&
        s.inventory === undefined && s.equipped === undefined,
      tactic: s.tactic, save: JSON.stringify(s)
    }
  })
  if (!mig.ok || mig.tactic !== undefined) problems.push('save antigo não migrou: ' + mig.save)
  await oldCtx.close()

  // save v2 (um inicial com nível, XP e skills na raiz) vira v6 com mounts[0] (a Labareda, agora skill de tipo, sai da lista)
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
    const ok = s.v === 6 && s.items.length === 9 && s.pedras === 3 && arm && s.mounts[0].equip.armadura === arm.uid &&
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
    // o potro entra no estábulo com o equipamento vazio (Breed.foal não sabe de equipamento), sem pontos e com a
    // redistribuição grátis (bloco 1b)
    const esperadoJogo = Object.assign({}, esperado, { equip: GR.emptyEquip(), alloc: { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 }, respecFree: true })
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
    // 3b §4: "Tornar ativa" saiu da lista (só na ficha): a lista não tem o botão, e o da ficha de outra montaria fica indisponível
    if (await cz.locator('#tela [data-acao="ativar"]').count()) problems.push('cruzamento: "Tornar ativa" na lista do Estábulo')
    const outraCz = await cz.evaluate(() => { const s = window.__galope.state; const m = s.mounts.find((x) => x.uid !== s.activeId); return m ? m.uid : null })
    await cz.locator(`button[data-acao="montaria"][data-id="${outraCz}"]`).click()
    await cz.waitForSelector('#t-montaria')
    await cz.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
    if (!(await indisp(cz.locator('.montaria-ficha [data-acao="ativar"]').first()))) problems.push('cruzamento: ativar habilitado com páreo aberto')
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
      await cz.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
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
      // 1. as abas (5; 4 com o equipamento suspenso, sem a Loja) abrem e focam o h1 certo
      for (const [id, h1] of [['correr', 't-correr'], ['expedicao', 't-expedicao'], ['haras', 't-haras']].concat(GEAR_ON ? [['loja', 't-loja']] : []).concat([['estabulo', 't-estabulo']])) {
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
      const cicloAbas = GEAR_ON ? ['correr', 'haras', 'loja', 'estabulo', 'expedicao'] : ['correr', 'haras', 'estabulo', 'expedicao']
      for (let i = 0; i < 10; i++) {
        const id = cicloAbas[i % cicloAbas.length]
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
      if ((await mn.locator('button[data-acao="montaria"][data-id="m1"]').count()) !== 1) problems.push('menu: o Estábulo sem o botão que abre a ficha (a linha da m1)')
      // 7. expedição mostra a vitrine dos selvagens
      await mn.locator('[data-acao="aba"][data-id="expedicao"]').click()
      if ((await mn.locator('.selvagem').count()) < 3) problems.push('menu: expedição sem selvagens')
      // 8. tela da Montaria: estado de guarda, captura, as sub-abas (Status, Skills, Ficha e, com o equipamento, Equipamento),
      //    Renomear e Liberar (na aba Ficha)
      await mn.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await mn.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await mn.waitForSelector('#t-montaria')
      await guarda('#t-montaria')
      // captura da Montaria na sub-aba Equipamento (com o equipamento suspenso, na Status), do topo (cabeça + sub-abas),
      // sem o painel dev
      if (GEAR_ON) await mn.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
      await mn.evaluate(() => window.scrollTo(0, 0))
      await sleep(300)
      if (GEAR_ON && (await mn.locator('.slot-botao img.icone[alt=""]').count()) !== 5) problems.push('ícones: os 5 slots do Equipamento deveriam ter img.icone')
      if (GEAR_ON && (await mn.locator('.slot-botao .slot-nome').count()) !== 5) problems.push('ícones: rótulos dos slots sumiram')
      await mn.screenshot({ path: join(SHOTS, 'final-03-montaria.png') })
      if ((await mn.locator('[data-acao="montaria-aba"]').count()) !== (GEAR_ON ? 4 : 3)) problems.push('menu: a Montaria tem ' + (await mn.locator('[data-acao="montaria-aba"]').count()) + ' sub-abas')
      for (const aba of GEAR_ON ? ['skills', 'equip', 'status', 'ficha'] : ['skills', 'status', 'ficha']) {
        await mn.locator(`[data-acao="montaria-aba"][data-id="${aba}"]`).click()
        if ((await mn.locator(`[data-acao="montaria-aba"][data-id="${aba}"][aria-pressed="true"]`).count()) !== 1) problems.push('menu: sub-aba ' + aba + ' não ativou')
      }
      // .slots vem do gearSummaryHtml da cabeça, visível em qualquer sub-aba (com o equipamento suspenso, ausente)
      if (GEAR_ON ? (await mn.locator('.slots').count()) < 1 : (await mn.locator('.slots').count()) !== 0) problems.push(GEAR_ON ? 'menu: resumo do equipamento ausente na cabeça da Montaria' : 'menu: resumo do equipamento na cabeça da Montaria com ele suspenso')
      await mn.locator('[data-acao="renomear"][data-id="m1"]').click()   // campo na própria tela, como no teste principal
      await mn.fill('#renomear-campo', 'Trovão')
      await mn.locator('[data-acao="renomear-ok"]').click()
      if ((await mn.evaluate(() => window.__galope.state.mounts[0].name)) !== 'Trovão') problems.push('menu: renomear na Montaria não aplicou')
      if (!/Trovão/.test(await mn.locator('#t-montaria').textContent())) problems.push('menu: h1 da Montaria não mostra o nome novo')
      // Liberar desabilitado na ativa/única
      if (!(await indisp(mn.locator('[data-acao="liberar"][data-id="m1"]')))) problems.push('menu: Liberar habilitado na única montaria')
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
      if (!/montaria/.test(perfilTxt) || (GEAR_ON ? !/peça/.test(perfilTxt) : /peça|Pedras/.test(perfilTxt))) problems.push('menu: perfil sem contagem de montarias/peças (ou com peças e Pedras com o equipamento suspenso)')
      await checkOverflow(mn, 'menu-perfil')
      await mn.screenshot({ path: join(SHOTS, 'final-11-perfil.png') })
      await mn.goBack(); await mn.waitForSelector('#t-' + abaAntes)
      await mn.locator('[data-acao="perfil"]').click(); await mn.waitForSelector('#t-perfil')
      await mn.locator('[data-acao="perfil-voltar"]').click(); await mn.waitForSelector('#t-' + abaAntes)
      // 11. Perfil -> Voltar devolve à Loja com a mesma aba interna (Pedras); só com o equipamento ligado (sem Loja,
      //     o mesmo vale para o Haras no contexto cruzamento)
      if (GEAR_ON) {
        await mn.locator('[data-acao="aba"][data-id="loja"]').click(); await mn.waitForSelector('#t-loja')
        await mn.locator('[data-acao="loja-tab"][data-id="pedras"]').click()
        await mn.locator('[data-acao="perfil"]').click(); await mn.waitForSelector('#t-perfil')
        await mn.locator('[data-acao="perfil-voltar"]').click(); await mn.waitForSelector('#t-loja')
        const lojaTab = await mn.evaluate(() => window.__galope.ui.loja && window.__galope.ui.loja.tab)
        if (lojaTab !== 'pedras') problems.push(`menu: Perfil -> Voltar perdeu a aba da Loja (${lojaTab}, esperado pedras)`)
      }
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
  // (com o equipamento suspenso, GEAR_ON = false: a gaveta dá peças, a tela não as mostra e as ações forçadas não fazem nada)
  {
    const eq = await newPage(browser, { width: 390, height: 844 }, 'equipamento', { query: '?dev=1' })
    try {
      const st = () => eq.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
      const txt = async () => (await eq.locator('#tela').textContent()) || ''
      const itemOf = (s, uid) => s.items.find((it) => it.uid === uid)
      if (!GEAR_ON) {
        // Equipamento suspenso (GEAR_ON = false, spec 1b §8): a gaveta DEV ainda dá peças e Pedras (RF5: nada quebra
        // com peças no save), mas a tela não as mostra, as ações de peça forçadas não fazem nada e o Poder as ignora
        await eq.waitForSelector('#t-estabulo')
        let s = await st()
        if (s.items.length !== 2 || s.mounts[0].equip.sela !== 'i1' || s.mounts[0].equip.ferraduras !== 'i2' || s.pedras !== 0) {
          problems.push('equipamento: estado inicial ' + JSON.stringify({ items: s.items, equip: s.mounts[0].equip, pedras: s.pedras }))
        }
        await devAbrir(eq)
        await eq.fill('#dev-pedras', '5')
        await eq.locator('[data-acao="dev-pedras"]').click()
        await eq.selectOption('#dev-conjunto', 'sol')
        await eq.selectOption('#dev-rpeca', 'lendario')
        await eq.selectOption('#dev-melhoria', '7')
        await eq.setChecked('#dev-equipar', true)
        await eq.locator('[data-acao="dev-conjunto"]').click()
        await devFechar(eq)
        s = await st()
        if (s.items.length !== 7 || s.pedras !== 5) problems.push('equipamento: a gaveta DEV não deu o conjunto e as Pedras ' + JSON.stringify({ n: s.items.length, pedras: s.pedras }))
        const L = s.mounts[0].equip.sela
        GR.SLOTS.forEach((sl) => { const it = itemOf(s, s.mounts[0].equip[sl]); if (!it || it.id !== sl + '-sol-lendario' || it.plus !== 7) problems.push('equipamento: dev-set ' + sl + ' = ' + JSON.stringify(it)) })
        if ((await eq.locator('#tela .slots, #tela .set-badge, .app-topo .pedras').count()) !== 0) problems.push('equipamento: o Estábulo mostra peças ou Pedras com o equipamento suspenso')
        // ficha da Montaria: sem a sub-aba Equipamento e sem resumo; o Poder é o do cavalo sem as peças
        await eq.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await eq.waitForSelector('#t-montaria', { timeout: 5000 })
        if (await eq.locator('[data-acao="montaria-aba"][data-id="equip"]').count()) problems.push('equipamento: sub-aba Equipamento com o equipamento suspenso')
        if (await eq.locator('#tela .slots, #tela .set-badge').count()) problems.push('equipamento: resumo das peças na ficha')
        const poderFicha = await eq.evaluate(() => { const sp = Array.from(document.querySelectorAll('.montaria-cabeca .linha-meta span')).find((x) => /^Poder/.test(x.textContent)); return sp ? Number(sp.querySelector('b').textContent) : null })
        const semPecas = S.powerRating(Object.assign({}, s.mounts[0], { equip: GR.emptyEquip() }))
        if (poderFicha !== semPecas) problems.push(`equipamento: Poder na ficha ${poderFicha} (sem as peças: ${semPecas})`)
        // ações de peça forçadas (botão criado no DOM): nada muda
        const antes = await st()
        for (const [acao, id] of [['equip-slot', 'sela'], ['tirar', 'sela'], ['equipar', 'i1'], ['melhorar', 'i1'], ['melhorar-sim', 'i1'], ['vender', L], ['vender', 'i1'], ['vender-desfazer', null]]) {
          await eq.evaluate(([a, i]) => { const b = document.createElement('button'); b.setAttribute('data-acao', a); if (i != null) b.setAttribute('data-id', i); document.getElementById('tela').appendChild(b); b.click(); b.remove() }, [acao, id])
        }
        s = await st()
        for (const c of ['items', 'pedras', 'enhanceCounter', 'gold']) if (JSON.stringify(s[c]) !== JSON.stringify(antes[c])) problems.push('equipamento: ação de peça forçada mudou ' + c)
        if (JSON.stringify(s.mounts[0].equip) !== JSON.stringify(antes.mounts[0].equip)) problems.push('equipamento: ação de peça forçada mudou o equipado')
        // persistência: as peças e o equipado continuam no save de teste
        await eq.reload({ waitUntil: 'domcontentloaded' })
        await eq.waitForSelector('#t-estabulo')
        s = await st()
        if (JSON.stringify(s.mounts[0].equip) !== JSON.stringify(antes.mounts[0].equip) || JSON.stringify(s.items) !== JSON.stringify(antes.items) || s.pedras !== 5) problems.push('equipamento: as peças não ficaram no save')
        // 8b. botão DEV inteiro acima da barra de abas
        const devBox = await eq.locator('.dev-botao').boundingBox()
        const abasBox = await eq.locator('.app-abas').boundingBox()
        if (!devBox || !abasBox || devBox.y + devBox.height > abasBox.y + 1) problems.push('menu: botão DEV cobre a barra ' + JSON.stringify({ devBox, abasBox }))
        // 9. aba Correr sem o resumo nem o atalho Equipar; na largada, o botão DEV não cobre o "Largar!"
        await eq.locator('[data-acao="aba"][data-id="correr"]').click()
        await eq.waitForSelector('#t-correr')
        if (await eq.locator('#tela .slots, #tela [data-acao="equipar-tela"]').count()) problems.push('equipamento: aba Correr com o resumo das peças ou o Equipar')
        await eq.getByRole('button', { name: 'Procurar corrida' }).click()
        await eq.waitForSelector('#t-largada')
        {
          const lb = await eq.locator('.barra-acao .btn').boundingBox()
          const db = await eq.locator('.dev-botao').boundingBox()
          const cruza = lb && db && lb.x < db.x + db.width && db.x < lb.x + lb.width && lb.y < db.y + db.height && db.y < lb.y + lb.height
          if (!lb || !db || cruza) problems.push('equipamento: botão DEV cobre o "Largar!" na largada ' + JSON.stringify({ lb, db }))
        }
        if ((await st()).pending.pr !== semPecas) problems.push(`equipamento: Poder da sala ${(await st()).pending.pr} (sem as peças: ${semPecas})`)
        await sleep(300)
        await checkOverflow(eq, 'equipamento')
        notes.equipamento = 'suspenso (GEAR_ON = false): telas de peças ausentes, ações forçadas sem efeito, Poder sem as peças'
      } else {
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
      }
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
      // Mítico ★★★ nível 30: os pontos cortados pelo validAlloc novo (teto de 150 e custo por faixa: ACE 999 vira o que
      // o custo paga, MAN −4 vira 0)
      const ptsDev = { vel: 10, acel: 999, man: -4, forca: 0, est: 0, garra: 0, sorte: 0 }, espDev = S.validAlloc(ap, ptsDev)
      if (ap.grau !== 3 || ap.potential.vel !== 7 || ap.potential.acel !== 31 || ap.potential.man !== 0 || ap.potential.forca !== 31 ||
        JSON.stringify(ap.alloc) !== JSON.stringify(espDev) || espDev.vel !== 10 || !(espDev.acel > 0) || 'base' in ap) problems.push('dev: aplicar genética/estrelas/pontos ' + JSON.stringify(ap) + ' (validAlloc: ' + JSON.stringify(espDev) + ')')
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
      if (GEAR_ON) {
        await dv.locator('[data-acao="montaria-aba"][data-id="equip"]').click()
        await dv.locator('[data-acao="equip-slot"][data-id="armadura"]').click()
        if (!peca || (await dv.locator(`[data-acao="equipar"][data-id="${peca.uid}"]`).count()) !== 1) problems.push('dev: a peça Lendária não aparece no inventário da Armadura')
        if (!/Armadura da Chuva/.test((await dv.locator('#tela').textContent()) || '')) problems.push('dev: inventário sem "Armadura da Chuva"')
      } else if ((await dv.locator('[data-acao="montaria-aba"][data-id="equip"]').count()) || /Armadura da Chuva/.test((await dv.locator('#tela').textContent()) || '')) {
        problems.push('dev: a peça dada aparece na tela com o equipamento suspenso (ela só fica no save)')
      }
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
        if (q.faixa !== true) problems.push(`[${label}] Dado: faixa do Dado ausente na janela`)
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
        if (velho.v !== SAVE_V || 'settings' in velho) problems.push('save-antigo: o save montado não é um v' + SAVE_V + ' sem settings ' + JSON.stringify({ v: velho.v }))
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
        if (s.v !== SAVE_V || s.gold !== 4321 || s.races !== 9 || s.wins !== 2 || s.mounts.length !== velho.mounts.length || s.items.length !== velho.items.length || s.mounts[0].templateId !== 'brasa') {
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
  // Só com o equipamento ligado: suspenso (GEAR_ON = false), a Loja sai da barra (o bloco crescimento confere que ela não
  // abre e que comprar não faz nada); a captura final-09-loja.png não é gerada.
  if (!GEAR_ON) notes.loja = 'pulado: equipamento suspenso (GEAR_ON = false, spec 1b §8)'
  else {
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
      // encaixe dos moldes: escala única entre estilos e portes, molde inteiro nos quadros de altura fixa e
      // ciclo do galope com a mesma duração do código, nos 12 moldes (3 portes × 4 estilos)
      const enc = await mc.evaluate(() => {
        const SP = window.Sprites, ELS = ['fogo', 'agua', 'grama', 'neutro'], PS = ['esguio', 'padrao', 'robusto'], erros = []
        for (let k = 1; k <= 9; k++) {
          const Ss = PS.flatMap((p) => ELS.map((el) => SP._layoutMolde(el, 'galope', 0, 0, k, null, p).S))
          if (new Set(Ss).size !== 1) erros.push(`pista k=${k}: escalas diferentes entre estilos e portes ${Ss}`)
        }
        // baia 48×36 (retratos): a mesma escala para os 12 moldes; cascos dentro do quadro; o topo pode sair
        // do quadro (crista de ondas, orelhas do robusto) em no máximo 10 % da altura do bbox. k = round(3 × dpr): 3, 6 e
        // 9 são os dpr 1, 2 e 3; 4 é o dpr 1,25 a 1,4 (o zoom de 125 % do Windows), 7, 8 e 10 os dpr 2,25 a 3,4 (o passo
        // da escala no quadro sai do molde mais alto, então todos descem juntos)
        for (const k of [3, 4, 6, 7, 8, 9, 10]) for (const est of ['retrato', 'parado']) {
          const Ls = PS.flatMap((p) => ELS.map((el) => Object.assign({ nome: el + ' ' + p }, SP._layoutMolde(el, est, 5 * k, 1 * k, k, { topo: 0, base: 36 * k }, p))))
          if (new Set(Ls.map((L) => L.S)).size !== 1) erros.push(`${est} k=${k}: escalas diferentes entre os moldes ${Ls.map((L) => L.nome + ' ' + L.S)}`)
          Ls.forEach((L) => {
            const alt = L.pe - L.topo, corte = Math.max(0, -L.topo)
            if (L.pe > 36 * k || L.pe < 33 * k) erros.push(`${est} ${L.nome} k=${k}: cascos em ${L.pe} (esperado ${33 * k}..${36 * k})`)
            if (corte > 0.1 * alt) erros.push(`${est} ${L.nome} k=${k}: topo cortado em ${corte}px de ${alt} (> 10 %)`)
          })
        }
        for (const k of [2, 4, 6]) for (const top of [49, 57, 63]) for (const p of PS) for (const el of ELS) {   // pódio: em pé no bloco
          const L = SP._layoutMolde(el, 'parado', (84 - 21) * k, (top - 32) * k, k, { topo: 0, base: top * k }, p)
          if (L.topo < 0 || L.pe !== top * k) erros.push(`pódio ${el} ${p} k=${k} topo ${top}: bbox ${L.topo}..${L.pe} (bloco em ${top * k})`)
        }
        const G = SP.GALLOP_FRAMES
        for (const p of PS) for (const el of ELS) {
          const vistos = new Set()
          let ant = -1
          for (let f = 0; f < G; f += 0.01) {
            const q = SP._quadroGalope(el, f, p)
            if (q < ant) erros.push(`galope ${el} ${p}: quadro ${q} depois de ${ant} dentro do ciclo`)
            ant = q; vistos.add(q)
          }
          if (SP._quadroGalope(el, G, p) !== 0) erros.push(`galope ${el} ${p}: o ciclo do molde não volta ao quadro 0 junto com o do código`)
          if (vistos.size !== Math.max(...vistos) + 1) erros.push(`galope ${el} ${p}: pulou quadros (${[...vistos]})`)
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
      if (icones.join('') !== '🐴🏁🧭💞' + (GEAR_ON ? '🛒' : '')) problems.push('sem-icones: abas sem os emojis de antes: ' + icones.join('|'))
      if (GEAR_ON && !/🪨/.test((await sem.locator('.app-topo .pedras').textContent()) || '')) problems.push('sem-icones: saldo de Pedras sem o emoji')
      if ((await sem.locator('.app-topo .saldo svg').count()) !== 1) problems.push('sem-icones: saldo de Ouro sem a moeda em SVG')
      if (((await sem.locator('.app-topo .logo-mini').textContent()) || '').trim() !== 'Galope Elemental') problems.push('sem-icones: cabeçalho sem o texto da marca')
      // ícones novos (spec 2026-11-12-icones): sem o mapa, as telas abrem com a reserva de hoje (★/☆, ♂ Macho, 👤,
      // o status em SVG, o selo do elemento na skill, o texto dos chips e do "Clima: X", 🎲), sem nenhum img.icone
      const semImg = async (tela) => {
        const n = await sem.evaluate(() => ({ icones: document.querySelectorAll('img.icone').length, quebradas: Array.prototype.filter.call(document.images, (i) => i.complete && i.naturalWidth === 0).length }))
        if (n.icones || n.quebradas) problems.push(`sem-icones: ${tela} com ${n.icones} img.icone e ${n.quebradas} imagem(ns) quebrada(s)`)
      }
      const estTxt = (await sem.locator('.montarias').textContent()) || ''
      if (!/★★☆/.test(estTxt)) problems.push('sem-icones: estábulo sem a reserva das estrelas: ' + estTxt.replace(/\s+/g, ' ').slice(0, 200))
      if ((await sem.locator('.montaria-linha .estrelas').first().getAttribute('aria-label')) !== '2 de 3 estrelas') problems.push('sem-icones: estrelas sem o aria-label')
      if (((await sem.locator('.app-perfil').textContent()) || '').trim() !== '👤') problems.push('sem-icones: botão do Perfil sem o emoji')
      await sem.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await sem.waitForSelector('#t-montaria')
      // a linha do Estábulo leva o aria-label do botão (os filhos não chegam ao leitor de tela): as estrelas com o
      // aria-label são conferidas também na cabeça da ficha
      const cabSemTxt = (await sem.locator('.montaria-cabeca').textContent()) || ''
      if (!/★★☆/.test(cabSemTxt)) problems.push('sem-icones: cabeça da ficha sem a reserva das estrelas: ' + cabSemTxt.replace(/\s+/g, ' ').slice(0, 200))
      if ((await sem.locator('.montaria-cabeca .estrelas').first().getAttribute('aria-label')) !== '2 de 3 estrelas') problems.push('sem-icones: estrelas da cabeça da ficha sem o aria-label')
      if ((await sem.locator('.build-nome svg.icone-status').count()) !== 7) problems.push('sem-icones: aba Status sem os 7 status em SVG')
      await semImg('Montaria (Status)')
      // o sexo saiu da linha do Estábulo (3b §4) e da cabeça (3b §5): a reserva dele é conferida na aba Ficha
      await sem.locator('[data-acao="montaria-aba"][data-id="ficha"]').click()
      const fichaSemTxt = (await sem.locator('.montaria-ficha').textContent()) || ''
      if (!/♂ Macho/.test(fichaSemTxt)) problems.push('sem-icones: ficha sem a reserva do sexo: ' + fichaSemTxt.replace(/\s+/g, ' ').slice(0, 200))
      await semImg('Montaria (Ficha)')
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
