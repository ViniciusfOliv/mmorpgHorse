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
// Os blocos têm nome (lista BLOCOS abaixo, na ordem do arquivo; cada um no seu contexto do navegador):
//   node tools/ui-test.mjs --blocos             -> imprime os nomes, um por linha (sem abrir navegador nem servidor)
//   UI_SO=reserva,corrida-8,fluxo-loja node tools/ui-test.mjs  -> só esses (nome fora da lista é erro)
//   node tools/ui-test-paralelo.mjs             -> todos, um processo por bloco (é o que o scripts/check.sh roda)
// Sem UI_SO roda tudo, num processo só, e regrava as capturas oficiais (é assim que elas são regeneradas). Com UI_SO,
// os blocos do fluxo (fluxo, fluxo-*) gravam numa pasta temporária se não houver SHOTS_DIR, e a captura oficial do bloco
// build (final-03b/03c) só sai fora da pasta oficial: uma rodada à mão com UI_SO nunca regrava essas capturas.
// O tempo de cada bloco executado sai nas notas (temposBlocos, em segundos).
// Equipamento suspenso (bloco 1b, GEAR_ON = false no game.js): os blocos das telas de peças e da Loja conferem que elas
// não aparecem e que as ações de peça não fazem nada; com GEAR_ON = true voltam a testar as telas (GEAR_ON abaixo).
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'
import { PECAS as PECAS_ARTE } from './interface-arte.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const G = require('../src/data.js')
const S = require('../src/sim.js')
const B = require('../src/breed.js')
const GR = require('../src/gear.js')
const IT = require('../src/itens.js')
const G_ELS = Object.keys(G.ELEMENTS)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// os blocos, na ordem em que aparecem no arquivo: todo if (quer(nome)) usa um nome daqui (quer() lança erro se não), e o
// ui-test-paralelo.mjs roda exatamente esta lista. Bloco novo entra aqui, no lugar dele.
const BLOCOS = ['reserva', 'gravacao2', 'treino', 'aviso', 'gravacao', 'adulterado', 'migracao', 'adulterado-v5', 'retrato',
  'corrompido', 'areasegura', 'texto', 'producao', 'itens', 'ginasio', 'redimensiona', 'escala', 'teto',
  'corrida', 'corrida-390', 'corrida-forcado', 'corrida-girar', 'corrida-paisagem-8', 'corrida-8', 'corrida-lugar-dado',
  'corrida-lugar-dado-redimensiona', 'corrida-etiquetas-dado', 'corrida-faixa-lugar', 'corrida-faixa-lugar-pular',
  'corrida-faixa-lugar-pular-antes', 'corrida-dado-reduzido',
  'resultado', 'build', 'valor-peca', 'nivel-pontos', 'selo-teto', 'build-nivel1', 'selo', 'vaga-tipo', 'inicial', 'aura',
  'skills', 'icones', 'marcas', 'marcas-corrida', 'portes', 'portes-corrida', 'ajuda', 'acabamento', 'celular', 'crescimento',
  'crescimento-jogo',
  'fluxo', 'fluxo-saves', 'fluxo-cruzamento', 'fluxo-abas', 'fluxo-equipamento', 'fluxo-dev', 'fluxo-build-teste', 'fluxo-dado',
  'fluxo-natureza', 'fluxo-desempenho', 'fluxo-curvas', 'fluxo-capturas-itens', 'fluxo-loja', 'fluxo-desktop', 'fluxo-moldes', 'fluxo-sem-icones',
  'fluxo-pequeno']
if (process.argv.includes('--blocos')) { console.log(BLOCOS.join('\n')); process.exit(0) }
// UI_SO=reserva,gravacao,...: roda só os blocos com esses nomes (para desenvolver um teste sem esperar o resto); sem UI_SO
// (a rodada completa), roda tudo
const SO = (process.env.UI_SO || '').split(',').map((x) => x.trim()).filter(Boolean)
const SO_FORA = SO.filter((n) => !BLOCOS.includes(n))
if (SO_FORA.length) throw new Error(`ui-test: UI_SO com bloco que não existe: ${SO_FORA.join(', ')} (a lista: node tools/ui-test.mjs --blocos)`)
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
// SHOTS_DIR: usado pelo scripts/check.sh e pelo ui-test-paralelo.mjs. Com UI_SO de um bloco do fluxo e sem SHOTS_DIR, as
// capturas (que levam os nomes das oficiais) vão para uma pasta temporária
const SHOTS_OFICIAL = join(ROOT, 'screens')
const SHOTS = process.env.SHOTS_DIR ||
  (SO.some((n) => n === 'fluxo' || n.startsWith('fluxo-')) ? await mkdtemp(join(tmpdir(), 'ui-test-fluxo-')) : SHOTS_OFICIAL)
const SHOTS_SAO_OFICIAIS = resolve(SHOTS) === resolve(SHOTS_OFICIAL)
if (SHOTS !== process.env.SHOTS_DIR && !SHOTS_SAO_OFICIAIS) console.error('ui-test: capturas do fluxo em ' + SHOTS + ' (sem SHOTS_DIR)')
if (process.env.UI_PARALELO === '1' && SHOTS_SAO_OFICIAIS) throw new Error('ui-test: o modo paralelo nunca grava em prototype/screens/ (passe SHOTS_DIR)')
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
// extra.relogio: Date em que o relógio do navegador começa (page.clock.install, antes do goto; o tempo segue andando e
// page.clock.setSystemTime muda o dia) — use com timezoneId para o dia local não depender da máquina;
// extra.moldes (padrão true): espera os moldes do PixelLab carregarem (Sprites.moldsReady === true) — o jogo
// re-renderiza a tela quando eles chegam, e esperar evita clicar num botão que está sendo trocado.
async function newPage(browser, viewport, label, extra = {}) {
  const { pagina = 'preview.html', query = '', init = null, moldes = true, bloquear = [], relogio = null, ...ctxExtra } = extra
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ...ctxExtra })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${label}] console: ${m.text()}`) })
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`))
  for (const padrao of bloquear) await ctx.route(padrao, (r) => r.abort())   // sem rede para esses endereços
  if (init) await page.addInitScript(init)
  if (relogio) await page.clock.install({ time: relogio })
  await page.goto(BASE + pagina + query, { waitUntil: 'domcontentloaded' })
  // o teto de 4 s não segura o processo aberto no fim (unref): com um processo por bloco, cada um saía até 4 s depois
  await Promise.race([page.evaluate(() => document.fonts && document.fonts.ready), new Promise((r) => setTimeout(r, 4000).unref())])
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
// quer(nome): roda o bloco? (sem UI_SO, sempre). Também anota a ordem em que os blocos aparecem (conferida com BLOCOS no
// fim) e o tempo de cada bloco executado: os blocos rodam um depois do outro, então o tempo de um vai do quer() dele até o
// quer() do próximo bloco executado (ou até o fim)
const perguntados = []
const temposBlocos = {}
let blocoAberto = null, blocoT0 = 0
const fechaBloco = () => { if (blocoAberto) temposBlocos[blocoAberto] = (temposBlocos[blocoAberto] || 0) + (Date.now() - blocoT0); blocoAberto = null }
const quer = (nome) => {
  if (!BLOCOS.includes(nome)) throw new Error(`ui-test: bloco "${nome}" fora da lista BLOCOS (ponha o nome lá, na ordem do arquivo)`)
  if (!perguntados.includes(nome)) perguntados.push(nome)
  const roda = !SO.length || SO.includes(nome)
  if (roda && blocoAberto !== nome) { fechaBloco(); blocoAberto = nome; blocoT0 = Date.now() }
  return roda
}
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
      // (com as três insígnias, postas direto na memória: o bônus também não entra sem gravar)
      await gv.evaluate(() => { const g = window.__galope.state.ginasios; g.fogo.etapa = 5; g.agua.etapa = 5; g.grama.etapa = 5 })
      const g0 = (await st()).gold, m0 = JSON.stringify((await st()).mounts), gin0 = JSON.stringify((await st()).ginasios)
      await quebrar()
      await gv.getByRole('button', { name: /^Largar/ }).click()
      await sleep(300)
      s = await st()
      if (JSON.stringify(s.mounts) !== m0 || JSON.stringify(s.ginasios) !== gin0 || s.gymCounter !== 0) problems.push('gravacao: Largar sem gravar mudou o cavalo ou os ginásios ' + JSON.stringify({ ginasios: s.ginasios, gymCounter: s.gymCounter }))
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
    // ginásios (save v8): o save antigo chega com os três zerados e o contador de desafios em 0
    const ginZero = { etapa: 0, revDia: null, revVitorias: 0 }
    if (JSON.stringify(s.ginasios) !== JSON.stringify({ fogo: ginZero, agua: ginZero, grama: ginZero }) || s.gymCounter !== 0) out.push(`${rotulo}: ginásios ${JSON.stringify(s.ginasios)}, gymCounter ${s.gymCounter}`)
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
        // save v8 com os ginásios (zerados; o bônus das insígnias é da conta, não do modo DEV) e nada da gaveta "Ginásios"
        const sv = JSON.parse(ls.real), gz = { etapa: 0, revDia: null, revVitorias: 0 }
        if (sv.v !== SAVE_V || JSON.stringify(sv.ginasios) !== JSON.stringify({ fogo: gz, agua: gz, grama: gz }) || sv.gymCounter !== 0) problems.push(`[${label}] save da produção sem os ginásios ` + JSON.stringify({ v: sv.v, ginasios: sv.ginasios, gymCounter: sv.gymCounter }))
        if (/dev-gin-|Zerar ginásios|Liberar revanche/.test(await pd.evaluate(() => document.documentElement.outerHTML))) problems.push(`[${label}] produção com a gaveta DEV "Ginásios"`)
        await pd.getByRole('button', { name: 'Correr de novo' }).click()
        await pd.waitForSelector('#t-largada')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      }
      await pd.context().close()
    }
  }

  // ---------------- itens (save v7, save mais novo, o dia e a gaveta DEV; spec de itens, loja e diária §9, §10, §12) ----------------
  if (quer('itens')) {
    const REAL = 'galope-elemental:v1', DEVK = 'galope-elemental:dev'
    const VP = { width: 360, height: 780 }
    const estadoDe = (pg) => pg.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
    const bruto = (pg, k) => pg.evaluate((k) => localStorage.getItem(k), k)
    // grava o save na chave antes de o jogo carregar, uma vez só (recarregar não regrava: o que fica é o que o jogo deixou)
    const comSave = (chave, raw, extra = {}) => ({
      init: { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem(${JSON.stringify(chave)}, ${JSON.stringify(raw)}) } } catch (e) {}` + (extra.depois || '') },
      ...(extra.pagina ? { pagina: extra.pagina } : {}), ...(extra.query ? { query: extra.query } : {})
    })
    const hojeReal = (pg) => pg.evaluate(() => { const d = new Date(); return window.Itens.diaLocal(d.getFullYear(), d.getMonth(), d.getDate()) })
    const brasa = G.STARTERS.find((h) => h.id === 'brasa'), mare = G.STARTERS.find((h) => h.id === 'mare')
    const cav = (tpl, o) => Object.assign({ uid: 'm1', templateId: tpl.id, name: tpl.name, especie: 'cavalo', element: tpl.element, rarity: tpl.rarity,
      grau: tpl.grau || 2, sex: tpl.sex, level: 1, xp: 0, skills: tpl.skills.slice(), potential: JSON.parse(JSON.stringify(tpl.potential)),
      palette: JSON.parse(JSON.stringify(tpl.palette)), breedLeft: 2, parents: null, born: 0, equip: {}, respecFree: false,
      alloc: { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 } }, o)
    const SAVE_6 = {
      v: 6, rev: 9, gold: 777, tier: 50, seedBase: 4242, raceCounter: 0, pending: null, redeas: 3, avisoV6: false,
      races: 2, wins: 1, podiums: 1, goldWon: 90,
      mounts: [cav(brasa, { uid: 'm1', level: 12, skills: ['sprint'], alloc: { vel: 3, acel: 2, man: 0, forca: 0, est: 1, garra: 0, sorte: 0 } }),
        cav(mare, { uid: 'm2', level: 4 })],
      activeId: 'm1', nextUid: 3, stableSlots: 3, breedCounter: 0, items: [], nextItemUid: 1, pedras: 0, enhanceCounter: 0,
      settings: { motion: 'sistema' }, joquei: { padrao: 'liso', capacete: G.JOQUEI.capacete }
    }
    const ZERO_MOCHILA = { torrao: 0, estrela: 0, cupom: 0, manual: 0 }
    const DIARIA_0 = { prox: 0, ciclos: 0, ultimo: null }
    const LOJA_0 = { dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null }
    const LOJA_TETO = (hoje) => ({ dia: hoje, comprados: { torrao: G.ITEMS.torrao.perDay, manual: G.ITEMS.manual.perDay, cupom: G.ITEMS.cupom.perDay }, estrelaDia: hoje })
    // nem a diária nem nenhuma compra liberadas hoje (pelas regras puras, com o dia do jogo)
    // (ids: os itens que têm de estar no limite; os outros têm de estar à venda)
    const nadaLiberado = (pg, ids = ['torrao', 'manual', 'cupom', 'estrela']) => pg.evaluate((ids) => { const g = window.__galope, h = g.hojeDia(), I = window.Itens
      return !I.diariaEstado(g.state.diaria, h).pode && ['torrao', 'manual', 'cupom', 'estrela'].every((id) => (I.podeComprar(id, g.state.lojaItens, h, 1e6, 1e6, 0).motivo === 'limite') === ids.includes(id)) }, ids)
    const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    // 1. save v6 -> v8 (passa pela v7): tudo novo zerado, a diária no dia 1, o resto igual (na memória e no disco)
    {
      const label = 'itens-v6'
      const pg = await newPage(browser, VP, label, comSave(REAL, JSON.stringify(SAVE_6)))
      try {
        await pg.waitForSelector('#t-estabulo')
        const disco = JSON.parse(await bruto(pg, REAL))
        for (const [onde, s] of [['memória', await estadoDe(pg)], ['disco', disco]]) {
          const erro = (t) => problems.push(`${label} (${onde}): ${t}`)
          if (s.v !== 8) erro('versão ' + s.v)
          if (!igual(s.mochila, ZERO_MOCHILA)) erro('mochila ' + JSON.stringify(s.mochila))
          if (!igual(s.diaria, DIARIA_0)) erro('diária ' + JSON.stringify(s.diaria))
          if (!igual(s.lojaItens, LOJA_0)) erro('limites da loja ' + JSON.stringify(s.lojaItens))
          if (s.itemCounter !== 0) erro('itemCounter ' + s.itemCounter)
          if ('devDias' in s) erro('devDias no save real: ' + s.devDias)
          if (onde === 'memória') {   // a migração libera a diária do dia 1 e a loja inteira (Rulings 7 e 8 não valem aqui)
            const livre = await pg.evaluate(() => { const g = window.__galope, h = g.hojeDia(), I = window.Itens
              return { diaria: I.diariaEstado(g.state.diaria, h).pode, loja: ['torrao', 'manual', 'cupom', 'estrela'].map((id) => I.podeComprar(id, g.state.lojaItens, h, 1e6, 1e6, 0).ok) } })
            if (!livre.diaria || livre.loja.some((x) => !x)) erro('migração da v6 não liberou a diária e a loja ' + JSON.stringify(livre))
          }
          if (s.gold !== 777 || s.redeas !== 3 || s.races !== 2) erro('Ouro/Rédeas/corridas ' + JSON.stringify({ gold: s.gold, redeas: s.redeas, races: s.races }))
          if (s.mounts.length !== 2) erro('cavalos ' + s.mounts.length)
          for (const m0 of SAVE_6.mounts) {
            const m = s.mounts.find((x) => x.uid === m0.uid)
            if (!m || m.torroes !== 0) erro(`${m0.uid}: torroes ${m && m.torroes}`)
            else if (m.name !== m0.name || m.level !== m0.level || !igual(m.skills, m0.skills) || !igual(m.alloc, m0.alloc) || m.respecFree !== m0.respecFree || m.grau !== m0.grau) erro(`${m0.uid} mudou ` + JSON.stringify(m))
          }
        }
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 2. campos novos com lixo voltam ao padrão (o ultimo corrompido conta como resgatado hoje); valores bons ficam
    {
      const label = 'itens-lixo'
      const lixo = Object.assign({}, SAVE_6, {
        v: 7, mochila: { torrao: 'x', estrela: -3, cupom: 1e9, manual: { n: 1 } },
        diaria: { prox: 'NaN', ciclos: -3, ultimo: { d: 1 } },
        lojaItens: { dia: 'x', comprados: { torrao: 1e9, manual: -3, cupom: null }, estrelaDia: 2.5 },
        itemCounter: 'NaN',
        mounts: [cav(brasa, { uid: 'm1', torroes: 1e9 }), cav(mare, { uid: 'm2', torroes: 'x' }), cav(brasa, { uid: 'm3', name: 'Faísca', torroes: -3 })],
        nextUid: 4
      })
      const pg = await newPage(browser, VP, label, comSave(REAL, JSON.stringify(lixo)))
      try {
        await pg.waitForSelector('#t-estabulo')
        const s = await estadoDe(pg), hoje = await hojeReal(pg)
        if (!igual(s.mochila, ZERO_MOCHILA)) problems.push(`${label}: mochila ` + JSON.stringify(s.mochila))
        if (!igual(s.diaria, { prox: 0, ciclos: 0, ultimo: hoje })) problems.push(`${label}: diária ${JSON.stringify(s.diaria)} (ultimo corrompido = hoje ${hoje})`)
        // Rulings 7 e 8: dia corrompido vale hoje e compra corrompida vale o limite do dia (nada é liberado)
        if (!igual(s.lojaItens, LOJA_TETO(hoje))) problems.push(`${label}: limites da loja ${JSON.stringify(s.lojaItens)} (esperado o dia de hoje e os tetos)`)
        if (!(await nadaLiberado(pg))) problems.push(`${label}: dado corrompido liberou resgate ou compra`)
        if (s.itemCounter !== 0) problems.push(`${label}: itemCounter ` + s.itemCounter)
        // diária e loja que não são objeto; ultimo, dia e estrelaDia fora da faixa
        for (const [diaria, lojaItens, esperado, travados] of [
          [7, 'x', { diaria: { prox: 0, ciclos: 0, ultimo: hoje }, lojaItens: LOJA_TETO(hoje) }],
          [[1], [2], { diaria: { prox: 0, ciclos: 0, ultimo: hoje }, lojaItens: LOJA_TETO(hoje) }],
          // compras válidas ficam (o Cupom, sem compra hoje, continua à venda); o dia e a Estrela corrompidos valem hoje
          [{ prox: 3, ciclos: 1, ultimo: 1e9 }, { dia: -3, comprados: { torrao: 2, manual: 1, cupom: 0 }, estrelaDia: 3e6 },
            { diaria: { prox: 3, ciclos: 1, ultimo: hoje }, lojaItens: { dia: hoje, comprados: { torrao: 2, manual: 1, cupom: 0 }, estrelaDia: hoje } }, ['torrao', 'manual', 'estrela']]]) {
          await pg.evaluate(([k, raw]) => localStorage.setItem(k, raw), [REAL, JSON.stringify(Object.assign({}, lixo, { rev: 60, diaria, lojaItens }))])
          await pg.reload({ waitUntil: 'domcontentloaded' })
          await pg.waitForSelector('#t-estabulo')
          const x = await estadoDe(pg)
          if (!igual(x.diaria, esperado.diaria) || !igual(x.lojaItens, esperado.lojaItens)) problems.push(`${label}: diária ${JSON.stringify(diaria)} e loja ${JSON.stringify(lojaItens)} viraram ${JSON.stringify({ diaria: x.diaria, lojaItens: x.lojaItens })}`)
          if (!(await nadaLiberado(pg, travados))) problems.push(`${label}: diária ${JSON.stringify(diaria)} / loja ${JSON.stringify(lojaItens)} liberou resgate ou compra`)
        }
        if (s.mounts.some((m) => m.torroes !== 0)) problems.push(`${label}: torroes ` + JSON.stringify(s.mounts.map((m) => m.torroes)))
        // valores bons ficam como estão
        const bom = Object.assign({}, lixo, {
          rev: 50, mochila: { torrao: 5, estrela: 1, cupom: G.BAG_MAX, manual: 0 }, diaria: { prox: 6, ciclos: 3, ultimo: hoje - 1 },
          lojaItens: { dia: hoje, comprados: { torrao: 2, manual: 1, cupom: 0 }, estrelaDia: hoje - 3 }, itemCounter: 12,
          mounts: [cav(brasa, { uid: 'm1', torroes: G.ITEMS.torrao.cap }), cav(mare, { uid: 'm2', torroes: 4 })], nextUid: 3
        })
        await pg.evaluate(([k, raw]) => localStorage.setItem(k, raw), [REAL, JSON.stringify(bom)])
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        const b = await estadoDe(pg)
        for (const k of ['mochila', 'diaria', 'lojaItens', 'itemCounter']) if (!igual(b[k], bom[k])) problems.push(`${label}: ${k} bom mudou ${JSON.stringify(b[k])}`)
        if (!igual(b.mounts.map((m) => m.torroes), [G.ITEMS.torrao.cap, 4])) problems.push(`${label}: torroes bons ` + JSON.stringify(b.mounts.map((m) => m.torroes)))
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 3. save de versão 9 (mais nova que a 8 do jogo): tela de bloqueio, sem Estábulo, e a chave fica byte a byte igual
    //    (real, de teste e produção)
    const SAVE_9 = JSON.stringify(Object.assign({}, SAVE_6, { v: 9, rev: 3, coisaNova: { a: [1, 2] }, gold: 123456 }))
    const conferirBloqueio = async (pg, label, chave, raw) => {
      await pg.waitForSelector('#t-bloqueio', { timeout: 5000 })
      const txt = (await pg.locator('#tela').textContent()) || ''
      if (!/versão mais nova/.test(txt)) problems.push(`${label}: a tela não diz que o save é de uma versão mais nova: ${txt}`)
      if ((await pg.getByRole('button', { name: 'Recarregar' }).count()) !== 1) problems.push(`${label}: sem o botão Recarregar`)
      if (await pg.locator('#t-estabulo, .app-abas, .inicial, .dev-botao, .dev-gaveta').count()) problems.push(`${label}: a tela de bloqueio mostra o jogo (Estábulo, abas, inicial ou DEV)`)
      await sleep(2000)
      if ((await bruto(pg, chave)) !== raw) problems.push(`${label}: a chave ${chave} mudou depois de 2 s`)
      // toca em tudo que houver na tela (menos o Recarregar, tocado por último)
      const n = await pg.locator('button, a, [data-acao], input, select').count()
      for (let i = 0; i < n; i++) {
        const el = pg.locator('button, a, [data-acao], input, select').nth(i)
        if (((await el.textContent()) || '').trim() === 'Recarregar') continue
        await el.click({ timeout: 2000 }).catch(() => {})
      }
      await pg.keyboard.press('Escape'); await pg.keyboard.press('Enter')
      if ((await bruto(pg, chave)) !== raw) problems.push(`${label}: a chave ${chave} mudou depois de tocar na tela`)
      await Promise.all([pg.waitForNavigation({ waitUntil: 'domcontentloaded' }), pg.getByRole('button', { name: 'Recarregar' }).click()])
      await pg.waitForSelector('#t-bloqueio', { timeout: 5000 })
      await sleep(500)
      if ((await bruto(pg, chave)) !== raw) problems.push(`${label}: a chave ${chave} mudou depois de recarregar`)
    }
    // v como texto ("9"): Number("9") > 8, também é mais novo (o sanitize o leria como v8+ e gravaria v8 por cima)
    const SAVE_9_TXT = JSON.stringify(Object.assign(JSON.parse(SAVE_9), { v: '9' }))
    for (const [label, chave, extra, raw] of [['itens-v9', REAL, {}, SAVE_9], ['itens-v9-dev', DEVK, { query: '?dev=1' }, SAVE_9],
      ['itens-v9-producao', REAL, { pagina: 'producao.html' }, SAVE_9], ['itens-v9-texto', REAL, {}, SAVE_9_TXT]]) {
      const pg = await newPage(browser, VP, label, comSave(chave, raw, extra))
      try {
        await conferirBloqueio(pg, label, chave, raw)
        if (chave === DEVK && (await bruto(pg, REAL)) !== null) problems.push(`${label}: o modo DEV gravou o save real`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 4. outra aba grava um save v9 com o jogo aberto num v8: o evento storage leva à tela de bloqueio; sem o evento, a
    //    próxima gravação (persist) e o "Recomeçar" (que apaga o save) também não tocam no v9, no jogo real e no DEV
    for (const [label, comEvento, gatilho, query, chave] of [['itens-outra-aba', true, null, '', REAL], ['itens-outra-aba-persist', false, 'procurar', '', REAL],
      ['itens-outra-aba-recomecar', false, 'recomecar', '', REAL], ['itens-outra-aba-recomecar-dev', false, 'recomecar', '?dev=1', DEVK]]) {
      const pg = await newPage(browser, VP, label, { query })
      try {
        if (!query) await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
        await pg.waitForSelector('#t-estabulo')
        // revisão menor que a do jogo aberto: a versão vale mais que a revisão
        const raw9 = JSON.stringify(Object.assign(JSON.parse(SAVE_9), { rev: 0 }))
        if (gatilho === 'recomecar') {   // chega até o "Sim" do Recomeçar antes de o v9 aparecer
          await pg.locator('[data-acao="perfil"]').click()
          await pg.locator('[data-acao="reset"]').click()
          await pg.waitForSelector('[data-acao="reset-sim"]')
        }
        await pg.evaluate(([k, raw, ev]) => {
          localStorage.setItem(k, raw)
          if (ev) window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: raw }))
        }, [chave, raw9, comEvento])
        if (gatilho === 'procurar') await pg.locator('[data-acao="aba"][data-id="correr"]').click().then(() => pg.locator('[data-acao="procurar"]').click())
        if (gatilho === 'recomecar') await pg.locator('[data-acao="reset-sim"]').click()
        await conferirBloqueio(pg, label, chave, raw9)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 5. estado da atualização ao vivo (window.claude.hot) com save v9: bloqueio, e o save do disco (v7) não muda
    {
      const label = 'itens-hot'
      const raw7 = JSON.stringify(Object.assign({}, SAVE_6, { v: 7, rev: 40 }))
      const hot = `window.claude = { hot: { data: { save: ${SAVE_9}, dev: false } } };`
      const pg = await newPage(browser, VP, label, comSave(REAL, raw7, { depois: hot }))
      try {
        await pg.waitForSelector('#t-bloqueio', { timeout: 5000 })
        await sleep(1000)
        if ((await bruto(pg, REAL)) !== raw7) problems.push(`${label}: o save do disco mudou com o estado do hot bloqueado`)
        if (await pg.locator('#t-estabulo, .app-abas').count()) problems.push(`${label}: mostra o jogo`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 6. gaveta DEV, grupo "Itens e dia": mochila, avançar e voltar o dia, zerar a diária e os limites
    {
      const label = 'itens-dev'
      const pg = await newPage(browser, VP, label, { query: '?dev=1' })
      try {
        await pg.waitForSelector('#t-estabulo')
        const real = await hojeReal(pg)
        if ((await pg.evaluate(() => window.__galope.hojeDia())) !== real) problems.push(`${label}: hojeDia() sem deslocamento difere do dia do aparelho`)
        await devAbrir(pg)
        if (!(await pg.locator('#dev-g-itensdia').count()) || !/Itens e dia/.test((await pg.locator('#dev-g-itensdia').textContent()) || '')) problems.push(`${label}: sem o grupo "Itens e dia" na gaveta`)
        await pg.fill('#dev-mochila-torrao', '3')
        await pg.locator('[data-acao="dev-mochila"]').click()
        let s = await estadoDe(pg)
        if (s.mochila.torrao !== 3 || s.mochila.estrela !== 0) problems.push(`${label}: definir 3 torrões ` + JSON.stringify(s.mochila))
        for (const [id, v] of [['estrela', '2'], ['cupom', '150'], ['manual', '1']]) await pg.fill('#dev-mochila-' + id, v)
        await pg.locator('[data-acao="dev-mochila"]').click()
        s = await estadoDe(pg)
        if (!igual(s.mochila, { torrao: 3, estrela: 2, cupom: G.BAG_MAX, manual: 1 })) problems.push(`${label}: mochila depois de definir os quatro (150 vira o teto) ` + JSON.stringify(s.mochila))
        // campo vazio: nada muda e a gaveta diz por quê
        await pg.fill('#dev-mochila-manual', '')
        await pg.locator('[data-acao="dev-mochila"]').click()
        if (!igual((await estadoDe(pg)).mochila, s.mochila)) problems.push(`${label}: campo vazio mudou a mochila`)
        if (!/digite um número/.test((await pg.locator('#dev-msg').textContent()) || '')) problems.push(`${label}: campo vazio sem aviso`)
        if (!igual(JSON.parse(await bruto(pg, DEVK)).mochila, s.mochila)) problems.push(`${label}: a mochila não foi gravada no save de teste`)
        await pg.locator('[data-acao="dev-dia-mais"]').click()
        await pg.locator('[data-acao="dev-dia-mais"]').click()
        await pg.locator('[data-acao="dev-dia-menos"]').click()
        const h = await pg.evaluate(() => window.__galope.hojeDia())
        if (h !== real + 1) problems.push(`${label}: hojeDia() ${h}, esperado ${real + 1}`)
        if (JSON.parse(await bruto(pg, DEVK)).devDias !== 1) problems.push(`${label}: devDias não gravado no save de teste`)
        // zerar a diária e os limites (o deslocamento continua)
        await pg.evaluate(() => { const st = window.__galope.state; st.diaria = { prox: 4, ciclos: 2, ultimo: 5 }; st.lojaItens = { dia: 5, comprados: { torrao: 2, manual: 1, cupom: 1 }, estrelaDia: 5 } })
        await pg.locator('[data-acao="dev-zerar-diaria"]').click()
        s = await estadoDe(pg)
        if (!igual(s.diaria, DIARIA_0) || !igual(s.lojaItens, LOJA_0) || s.devDias !== 1) problems.push(`${label}: zerar diária ` + JSON.stringify({ diaria: s.diaria, loja: s.lojaItens, devDias: s.devDias }))
        if ((await bruto(pg, REAL)) !== null) problems.push(`${label}: o modo DEV gravou o save real`)
        // o deslocamento fica no limite (±400) e recarregar o mantém
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        if ((await pg.evaluate(() => window.__galope.hojeDia())) !== real + 1) problems.push(`${label}: recarregar perdeu o deslocamento`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 7. fora do modo DEV: um save real com devDias (adulterado, ou copiado do de teste) abre com o dia do aparelho, o
    //    campo sai do state e da próxima gravação; e a produção não tem o texto
    {
      const label = 'itens-real'
      const pg = await newPage(browser, VP, label, comSave(REAL, JSON.stringify(Object.assign({}, SAVE_6, { v: 7, rev: 30, devDias: 5 }))))
      try {
        await pg.waitForSelector('#t-estabulo')
        const real = await hojeReal(pg)
        if ((await pg.evaluate(() => window.__galope.hojeDia())) !== real) problems.push(`${label}: hojeDia() usou devDias fora do modo DEV`)
        if ('devDias' in (await estadoDe(pg))) problems.push(`${label}: o state do jogo real tem devDias`)
        await pg.locator('[data-acao="aba"][data-id="correr"]').click()
        await pg.locator('[data-acao="procurar"]').click()
        await pg.waitForSelector('#t-largada')
        const d = JSON.parse(await bruto(pg, REAL))
        if (d.rev <= 30 || ('devDias' in d && d.devDias !== 0)) problems.push(`${label}: o save real gravado tem devDias ${d.devDias} (rev ${d.rev})`)
        if ((await bruto(pg, DEVK)) !== null) problems.push(`${label}: o jogo real gravou o save de teste`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
      const prod = await readFile(join(DIST, 'jogo.html'), 'utf8')
      if (/devDias/.test(prod)) problems.push('itens-producao: dist/jogo.html contém devDias')
      if (!/devDias/.test(await readFile(join(ROOT, 'build.mjs'), 'utf8'))) problems.push('itens-producao: build.mjs não proíbe devDias na produção')
    }
    // 8. aba Loja (spec de itens §5, §6, §8, §13): a 5ª aba, as partes Comprar e Mochila, a compra de um toque, os limites
    //    do dia (o dia anda pela gaveta DEV), "Sem Ouro", "Reservado" com a sala aberta (sem re-sortear a sala) e a mochila cheia
    {
      const label = 'itens-loja'
      const pg = await newPage(browser, VP, label, { query: '?dev=1' })
      // o texto que o leitor de tela lê (sem o que é aria-hidden)
      const textoAcessivel = (loc) => loc.evaluate((el) => { const c = el.cloneNode(true); c.querySelectorAll('[aria-hidden="true"]').forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim() })
      const linha = (id) => pg.locator(`#tela .item-linha[data-item="${id}"]`)
      const botao = (id) => pg.locator(`#tela [data-acao="item-comprar"][data-id="${id}"]`)
      const txtLinha = async (id) => ((await linha(id).textContent()) || '').replace(/\s+/g, ' ')
      const txtBotao = async (id) => ((await botao(id).textContent()) || '').replace(/\s+/g, ' ').trim()
      const dev = async (acao, n = 1) => { await devAbrir(pg); for (let i = 0; i < n; i++) await pg.locator(`.dev-gaveta [data-acao="${acao}"]`).click(); await devFechar(pg) }
      const devMochila = async (q) => {
        await devAbrir(pg)
        for (const id of ['torrao', 'estrela', 'cupom', 'manual']) await pg.fill('#dev-mochila-' + id, String(q[id] != null ? q[id] : 0))
        await pg.locator('.dev-gaveta [data-acao="dev-mochila"]').click()
        await devFechar(pg)
      }
      const ouro = async (n) => { await pg.evaluate((n) => { window.__galope.state.gold = n }, n); await pg.locator('#tela [data-acao="loja-parte"][data-id="comprar"]').click() }
      const saldoMochila = async () => { const s = await estadoDe(pg); return { gold: s.gold, mochila: s.mochila, lojaItens: s.lojaItens, pending: s.pending } }
      // toque recusado (normal e forçado, sem o aria-disabled): nada muda no state nem no save gravado
      const recusa = async (id, rotulo, tag) => {
        if ((await txtBotao(id)).indexOf(rotulo) !== 0) problems.push(`${label} ${tag}: o botão de ${id} diz "${await txtBotao(id)}" (esperado "${rotulo}")`)
        if (!(await indisp(botao(id)))) problems.push(`${label} ${tag}: o botão "${rotulo}" de ${id} não está indisponível com aria-disabled`)
        const motivo = await botao(id).getAttribute('data-motivo')
        if (!motivo) problems.push(`${label} ${tag}: o botão "${rotulo}" sem o motivo`)
        const antes = await saldoMochila(), contador = (await estadoDe(pg)).raceCounter
        await botao(id).click({ force: true })   // o toque real (o click() normal espera o botão habilitado)
        // espera o motivo chegar à região viva (até 3 s, com a máquina carregada); se não chegar, a linha de baixo acusa
        await pg.waitForFunction((src) => new RegExp(src).test(document.getElementById('motivo-vivo').textContent || ''),
          motivo ? motivo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '^$', { timeout: 3000 }).catch(() => {})
        if (!new RegExp(motivo ? motivo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '^$').test((await pg.locator('#motivo-vivo').textContent()) || '')) problems.push(`${label} ${tag}: o toque em "${rotulo}" não pôs o motivo na região viva`)
        await pg.evaluate((i) => { const b = document.querySelector(`#tela [data-acao="item-comprar"][data-id="${i}"]`); b.removeAttribute('aria-disabled'); b.click() }, id)
        if (!igual(await saldoMochila(), antes)) problems.push(`${label} ${tag}: o toque em "${rotulo}" mudou o Ouro, a mochila, os limites ou a sala: ${JSON.stringify(await saldoMochila())}`)
        // o toque forçado grava (sincroniza com outras abas antes de conferir): o save gravado tem o que havia antes do toque
        const disco = JSON.parse(await bruto(pg, DEVK))
        for (const k of ['gold', 'mochila', 'lojaItens', 'pending']) if (!igual(disco[k], antes[k])) problems.push(`${label} ${tag}: o toque em "${rotulo}" gravou ${k} ${JSON.stringify(disco[k])} (antes ${JSON.stringify(antes[k])})`)
        if (disco.raceCounter !== contador) problems.push(`${label} ${tag}: o toque em "${rotulo}" mudou o contador de salas`)
      }
      const compra = async (id, tag) => {
        const a = await saldoMochila()
        await botao(id).click()
        const d = await saldoMochila()
        if (d.gold !== a.gold - G.ITEMS[id].price || d.mochila[id] !== a.mochila[id] + 1) problems.push(`${label} ${tag}: comprar ${id} levou o Ouro ${a.gold} -> ${d.gold} e a mochila ${a.mochila[id]} -> ${d.mochila[id]}`)
        const disco = JSON.parse(await bruto(pg, DEVK))
        if (disco.gold !== d.gold || !igual(disco.mochila, d.mochila) || !igual(disco.lojaItens, d.lojaItens)) problems.push(`${label} ${tag}: a compra de ${id} não foi gravada junto (Ouro, mochila e limites)`)
        const foco = await pg.evaluate(() => { const e = document.activeElement; return e && e.getAttribute('data-acao') + ':' + e.getAttribute('data-id') })
        if (foco !== 'item-comprar:' + id) problems.push(`${label} ${tag}: o foco saiu do botão de compra (${foco})`)
        // o aviso da compra entra na linha daquele produto (e só nela)
        if (!(await linha(id).locator('.item-aviso').textContent().catch(() => '')).includes('Comprou 1 ' + G.ITEMS[id].name) || (await pg.locator('#tela .item-aviso').count()) !== 1) problems.push(`${label} ${tag}: sem o aviso da compra só na linha de ${id}`)
      }
      try {
        await pg.waitForSelector('#t-estabulo')   // o modo DEV abre direto no Estábulo
        await devAbrir(pg)
        await pg.setChecked('#dev-ouroinf', false)
        await devFechar(pg)
        await pg.evaluate(() => { window.__galope.state.gold = 0 })
        await dev('dev-ouro', 3)   // 3.000 de Ouro pela gaveta
        // a barra: 5 abas, a última a Loja (com ícone e rótulo)
        const abas = await pg.locator('.app-abas [data-acao="aba"]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-id') + ':' + b.querySelector('.app-aba-rotulo').textContent.trim()))
        if (!igual(abas, ['estabulo:Estábulo', 'correr:Correr', 'expedicao:Expedição', 'haras:Haras', 'loja:Loja'])) problems.push(`${label}: abas ${abas.join(',')} (esperado as 5, com a Loja por último)`)
        await pg.locator('[data-acao="aba"][data-id="loja"]').click()
        await pg.waitForSelector('#t-loja')
        if ((await pg.evaluate(() => window.__galope.ui.lojaParte)) !== 'comprar') problems.push(`${label}: a Loja não abriu na parte Comprar`)
        const partes = await pg.locator('#tela .subabas[role="group"][aria-label="Partes da loja"] .btn.opcao.opcao--centro[data-acao="loja-parte"]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-id') + ':' + b.textContent.trim() + ':' + b.getAttribute('aria-pressed')))
        if (!igual(partes, ['comprar:Comprar:true', 'mochila:Mochila:false'])) problems.push(`${label}: partes da loja ${partes.join(',')}`)
        // quatro produtos na ordem e com os preços; a Rédea nova sem botão de compra
        const prods = await pg.locator('#tela .item-linha--produto').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-item')))
        if (!igual(prods, ['torrao', 'manual', 'cupom', 'estrela'])) problems.push(`${label}: produtos ${prods.join(',')} (esperado torrao,manual,cupom,estrela)`)
        for (const [id, preco] of [['torrao', '120'], ['manual', '200'], ['cupom', '250'], ['estrela', '2.000']]) {
          if (!new RegExp('(^|\\D)' + preco.replace('.', '\\.') + '(\\D|$)').test(await txtLinha(id))) problems.push(`${label}: ${id} sem o preço ${preco}: ${await txtLinha(id)}`)
          if ((await botao(id).count()) !== 1 || (await txtBotao(id)).indexOf('Comprar') !== 0) problems.push(`${label}: ${id} sem o botão Comprar (${await txtBotao(id)})`)
        }
        if ((await linha('redea').count()) !== 1 || (await linha('redea').locator('button').count()) !== 0 || (await botao('redea').count()) !== 0) problems.push(`${label}: a linha da Rédea nova falta ou tem botão`)
        else if (!(await textoAcessivel(linha('redea'))).includes(G.ITEMS.redea.origem)) problems.push(`${label}: a linha da Rédea nova não diz de onde ela vem: ${await textoAcessivel(linha('redea'))}`)
        if (!/Restam 2 de 2 hoje/.test(await txtLinha('torrao')) || !/Restam 1 de 1 hoje/.test(await txtLinha('manual')) || !/disponível/.test(await txtLinha('estrela'))) problems.push(`${label}: limites de hoje antes de comprar: ${await txtLinha('torrao')} | ${await txtLinha('estrela')}`)
        // Torrão: 1, 2 e o 3º no limite; o dia seguinte devolve o limite e voltar o dia não
        await compra('torrao', '1º torrão')
        if (!/Restam 1 de 2 hoje/.test(await txtLinha('torrao'))) problems.push(`${label}: depois de 1 torrão: ${await txtLinha('torrao')}`)
        if (/Ainda pode comprar/.test(await txtLinha('torrao')) || !/^Restam 1 de 2 hoje$/.test(((await linha('torrao').locator('.item-limite').textContent()) || '').trim())) problems.push(`${label}: o limite não se lê "Restam 1 de 2 hoje" (visível e para o leitor de tela): ${await txtLinha('torrao')}`)
        if (!/tem 1\b/.test(await txtLinha('torrao'))) problems.push(`${label}: o produto não diz quantos o jogador tem: ${await txtLinha('torrao')}`)
        await compra('torrao', '2º torrão')
        await recusa('torrao', 'Limite de hoje', '3º torrão')
        if (!/Restam 0 de 2 hoje/.test(await txtLinha('torrao'))) problems.push(`${label}: no limite: ${await txtLinha('torrao')}`)
        await dev('dev-dia-mais')
        if ((await txtBotao('torrao')).indexOf('Comprar') !== 0 || !/Restam 2 de 2 hoje/.test(await txtLinha('torrao'))) problems.push(`${label}: "Avançar 1 dia" não devolveu o limite: ${await txtLinha('torrao')}`)
        await compra('torrao', 'torrão do dia seguinte')
        await compra('torrao', '2º torrão do dia seguinte')
        await dev('dev-dia-menos')
        await recusa('torrao', 'Limite de hoje', 'voltar 1 dia depois de comprar')
        await dev('dev-dia-mais')
        // Estrela: compra com 2.000, depois "de novo em 7 dias"; 7 dias depois, compra de novo
        if ((await saldoMochila()).gold !== 3000 - 4 * 120) problems.push(`${label}: Ouro ${(await saldoMochila()).gold} depois de 4 torrões`)
        await compra('estrela', '1ª estrela')
        if (!/de novo em 7 dias/.test(await txtLinha('estrela'))) problems.push(`${label}: depois da Estrela: ${await txtLinha('estrela')}`)
        await recusa('estrela', 'Limite de hoje', 'estrela no mesmo dia')
        await dev('dev-dia-mais', 6)
        if (!/de novo em 1 dia(?!s)/.test(await txtLinha('estrela'))) problems.push(`${label}: 6 dias depois da Estrela: ${await txtLinha('estrela')}`)
        await dev('dev-dia-mais')
        await dev('dev-ouro', 2)
        if (!/disponível/.test(await txtLinha('estrela'))) problems.push(`${label}: 7 dias depois da Estrela: ${await txtLinha('estrela')}`)
        await compra('estrela', 'estrela 7 dias depois')
        // Sem Ouro (100 de Ouro) e mochila cheia (99 torrões, pela gaveta)
        await ouro(100)
        await recusa('torrao', 'Sem Ouro', 'com 100 de Ouro')
        await ouro(5000)
        await devMochila({ torrao: G.BAG_MAX })
        await recusa('torrao', 'Mochila cheia', 'com 99 torrões')
        if (!/99/.test((await botao('torrao').getAttribute('data-motivo')) || '')) problems.push(`${label}: o motivo da mochila cheia não diz o teto`)
        // a parte Mochila: os cinco na ordem do catálogo, com as quantidades; 0 apagado com a frase de origem
        await devMochila({ torrao: 3, estrela: 0, cupom: 0, manual: 1 })
        await devAbrir(pg); await pg.fill('#dev-redeas', '2'); await pg.locator('.dev-gaveta [data-acao="dev-redeas"]').click(); await devFechar(pg)
        await pg.locator('#tela [data-acao="loja-parte"][data-id="mochila"]').click()
        const focoParte = await pg.evaluate(() => { const e = document.activeElement; return e && e.getAttribute('data-acao') + ':' + e.getAttribute('data-id') + ':' + e.getAttribute('aria-pressed') })
        if (focoParte !== 'loja-parte:mochila:true') problems.push(`${label}: o foco depois de abrir a Mochila ficou em ${focoParte}`)
        if ((await pg.evaluate(() => window.__galope.ui.lojaParte)) !== 'mochila') problems.push(`${label}: ui.lojaParte não é mochila`)
        if (await pg.locator('#tela [data-acao="item-comprar"]').count()) problems.push(`${label}: a Mochila mostra botão de compra`)
        const bag = await pg.locator('#tela .item-linha--mochila').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-item')))
        if (!igual(bag, Object.keys(G.ITEMS))) problems.push(`${label}: mochila ${bag.join(',')} (esperado a ordem do catálogo)`)
        for (const [id, n, falado] of [['torrao', 3, '3 Torrões de açúcar'], ['estrela', 0, '0 Estrelas de treino'], ['redea', 2, '2 Rédeas novas'], ['cupom', 0, '0 Cupons de troca de skill'], ['manual', 1, '1 Manual de doma']]) {
          const t = await txtLinha(id), a = await textoAcessivel(linha(id)), vazia = await linha(id).evaluate((l) => l.classList.contains('item-linha--vazia'))
          if (!a.includes(falado) || /[x×]\s*\d/.test(a)) problems.push(`${label}: o leitor de tela lê a linha de ${id} como "${a}" (esperado "${falado}", sem "x${n}")`)
          if (n === 0 && (!vazia || !a.includes(G.ITEMS[id].origem))) problems.push(`${label}: ${id} com 0 não está apagado com a origem: ${a}`)
          if (n > 0 && (vazia || !a.includes(G.ITEMS[id].desc) || t.includes(G.ITEMS[id].origem))) problems.push(`${label}: ${id} com ${n} apagado ou sem o para que serve: ${a}`)
        }
        // medidas: sem rolagem lateral (360x780, 360x640, 1280x800), botões e linhas ≥ 44 px, os rótulos das 5 abas inteiros
        const medir = () => pg.evaluate(() => ({
          botoes: [...document.querySelectorAll('#tela .item-linha button, #tela .subabas .opcao')].map((b) => Math.round(b.getBoundingClientRect().height)),
          linhas: [...document.querySelectorAll('#tela .item-linha')].map((l) => l.getAttribute('data-item') + ':' + Math.round(l.getBoundingClientRect().height)),
          abas: [...document.querySelectorAll('.app-aba')].map((b) => { const r = b.querySelector('.app-aba-rotulo'); return b.getAttribute('data-id') + ':' + Math.round(b.getBoundingClientRect().width) + (r.scrollWidth > r.clientWidth ? ':cortado' : '') })
        }))
        const medidas = {}
        for (const [vp, tag] of [[VP, '360x780'], [{ width: 360, height: 640 }, '360x640'], [{ width: 1280, height: 800 }, '1280x800']]) {
          await pg.setViewportSize(vp)
          for (const parte of ['comprar', 'mochila']) {
            await pg.locator(`#tela [data-acao="loja-parte"][data-id="${parte}"]`).click()
            await sleep(100)
            await checkOverflow(pg, `${label} ${tag} ${parte}`)
            const m = await medir()
            medidas[tag + ' ' + parte] = m
            if (m.botoes.some((h) => h < 44)) problems.push(`${label} ${tag} ${parte}: botão com menos de 44 px (${m.botoes.join(',')})`)
            if (m.abas.some((a) => /cortado/.test(a))) problems.push(`${label} ${tag}: rótulo de aba cortado (${m.abas.join(',')})`)
          }
        }
        notes[label] = medidas
        await pg.setViewportSize(VP)
        // Reservado: sala de 50 aberta com 150 de Ouro (100 livres < 120); o toque não muda nada nem re-sorteia a sala
        await ouro(150)
        await devMochila({ torrao: 0 })
        await dev('dev-dia-mais')
        const sala = await abrirSala(pg, 50)
        const pend = (await estadoDe(pg)).pending
        await pg.getByRole('button', { name: /^Voltar/ }).click()
        await pg.waitForSelector('#t-correr')
        await pg.locator('[data-acao="aba"][data-id="loja"]').click()
        await pg.waitForSelector('#t-loja')
        if (!/50 de Ouro reservados/.test((await pg.locator('#tela').textContent()) || '')) problems.push(`${label}: a Loja não avisa o Ouro reservado`)
        await recusa('torrao', 'Reservado', 'sala aberta')
        if (!igual((await estadoDe(pg)).pending, pend)) problems.push(`${label}: o toque em "Reservado" mudou a sala guardada`)
        await pg.locator('[data-acao="aba"][data-id="correr"]').click()
        await pg.locator('[data-acao="procurar"]').click()
        await pg.waitForSelector('#t-largada')
        const sala2 = await salaAtual(pg)
        if (sala2.seed !== sala.seed || sala2.counter !== sala.counter || sala2.rivais !== sala.rivais) problems.push(`${label}: a sala foi re-sorteada depois do toque em "Reservado" ${JSON.stringify({ sala, sala2 })}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 8b. a ordem da loja é a do catálogo (GameData.SHOP_ORDER, Ruling 11), não a do preço: com os preços trocados antes de o
    //     jogo carregar (o Torrão o mais caro, a Estrela o mais barato), a loja e o rótulo de preço seguem na mesma ordem
    {
      const label = 'itens-loja-ordem'
      const init = () => {
        let gd
        Object.defineProperty(window, 'GameData', { configurable: true, get: () => gd, set: (v) => { v.ITEMS.torrao.price = 5000; v.ITEMS.estrela.price = 50; v.ITEMS.manual.price = 900; v.ITEMS.cupom.price = 300; gd = v } })
      }
      const pg = await newPage(browser, VP, label, { query: '?dev=1', init })
      try {
        await pg.waitForSelector('#t-estabulo')
        if ((await pg.evaluate(() => window.GameData.ITEMS.torrao.price)) !== 5000) problems.push(`${label}: os preços não foram trocados (o teste não prova nada)`)
        await pg.locator('[data-acao="aba"][data-id="loja"]').click()
        await pg.waitForSelector('#t-loja')
        const prods = await pg.locator('#tela .item-linha--produto').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-item')))
        if (!igual(prods, G.SHOP_ORDER) || !igual(prods, ['torrao', 'manual', 'cupom', 'estrela'])) problems.push(`${label}: com os preços trocados, a loja ficou em ${prods.join(',')} (esperado torrao,manual,cupom,estrela)`)
        if (!/5\.000/.test((await pg.locator('#tela .item-linha[data-item="torrao"]').textContent()) || '')) problems.push(`${label}: o Torrão não mostra o preço trocado`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 9. cores forçadas: produtos e linhas da mochila com borda de 2 px em cor do sistema e a parte aberta em Highlight
    {
      const label = 'itens-loja-forcado'
      const pg = await newPage(browser, VP, label, { query: '?dev=1', forcedColors: 'active' })
      try {
        await pg.waitForSelector('#t-estabulo')
        await pg.locator('[data-acao="aba"][data-id="loja"]').click()
        await pg.waitForSelector('#t-loja')
        for (const parte of ['comprar', 'mochila']) {
          await pg.locator(`#tela [data-acao="loja-parte"][data-id="${parte}"]`).click()
          const fc = await pg.evaluate(() => {
            const sonda = (c) => { const d = document.createElement('i'); d.style.border = '2px solid ' + c; document.body.appendChild(d); const v = getComputedStyle(d).borderTopColor; d.remove(); return v }
            const borda = (e) => { const cs = getComputedStyle(e); return { w: cs.borderTopWidth, s: cs.borderTopStyle, c: cs.borderTopColor } }
            return { ativo: matchMedia('(forced-colors: active)').matches, hl: sonda('Highlight'), sis: ['CanvasText', 'ButtonText', 'GrayText'].map(sonda),
              linhas: [...document.querySelectorAll('#tela .item-linha')].map(borda),
              aberta: [...document.querySelectorAll('#tela .subabas [data-acao="loja-parte"][aria-pressed="true"]')].map(borda) }
          })
          if (!fc.ativo) problems.push(`[${label}] a página não está em cores forçadas`)
          if (fc.linhas.length < 5 || fc.linhas.some((b) => b.w !== '2px' || b.s !== 'solid' || !fc.sis.includes(b.c))) problems.push(`[${label}] ${parte}: linhas sem borda de 2 px em cor do sistema ${JSON.stringify(fc.linhas)} (${fc.sis.join(' / ')})`)
          if (fc.aberta.length !== 1 || fc.aberta[0].c !== fc.hl) problems.push(`[${label}] ${parte}: a parte aberta sem Highlight ${JSON.stringify(fc.aberta)} (Highlight = ${fc.hl})`)
        }
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 10. usar os itens (Tarefa 4; spec de itens §4, §5, §8): pela mochila e pela ficha, no save de teste com a seed fixa.
    //     Os resultados sorteados (Cupom, Manual) têm de ser os que o Itens dá para o contador do save (os mesmos módulos,
    //     aqui no node). A altura da aba Status com os botões de item está no 2º bloco itens (depois do SAVE_3A).
    const ipe = G.STARTERS.find((h) => h.id === 'ipe')
    const ALLOC0 = { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 }
    // seed 1006: o 1º Manual (contador 0) num cavalo de Água sem skill aprende; o 2º (contador 1), num de Grama, não
    const SAVE_T4 = Object.assign({}, SAVE_6, {
      v: 8, rev: 5, seedBase: 1006, gold: 5000, redeas: 0, mochila: ZERO_MOCHILA, diaria: DIARIA_0, lojaItens: LOJA_0, itemCounter: 0,
      mounts: [
        cav(brasa, { uid: 'm1', level: 12, skills: ['sprint'], alloc: { ...ALLOC0, vel: 3, acel: 2, est: 1 }, respecFree: false, torroes: 0 }),
        cav(mare, { uid: 'm2', level: 10, skills: [], alloc: { ...ALLOC0, vel: 2 }, respecFree: true, torroes: 0 }),
        cav(brasa, { uid: 'm3', name: 'Faísca', level: 20, grau: 3, skills: ['arranque'], torroes: G.ITEMS.torrao.cap }),
        cav(ipe, { uid: 'm4', level: 8, grau: 1, skills: [] })
      ],
      activeId: 'm1', nextUid: 5, stableSlots: 4
    })
    const saveT4 = (o = {}) => comSave(DEVK, JSON.stringify(Object.assign({}, SAVE_T4, o)), { query: '?dev=1' })
    // o resultado da sala aberta, simulado no navegador com a sala montada de novo do save (sem gravar nada)
    const simSala = (pg) => pg.evaluate(() => {
      const g = window.__galope, L = g.buildLobby(g.state.pending)
      const r = window.RaceSim.simulate({ seed: L.seed, conditions: L.cond, racers: L.racers.map((x) => ({ horse: x.horse, gear: x.gear, name: x.name, isPlayer: x.isPlayer })) })
      return JSON.stringify({ seed: L.seed, ordem: r.finishOrder, tempos: r.finishTimes })
    })
    const usoHelpers = (pg, label) => {
      const h = {}
      h.estado = () => estadoDe(pg)
      h.disco = async () => JSON.parse(await bruto(pg, DEVK))
      h.mount = async (uid) => (await estadoDe(pg)).mounts.find((m) => m.uid === uid)
      h.uiItem = () => pg.evaluate(() => JSON.stringify(window.__galope.ui.item))
      h.irMochila = async () => {
        await pg.locator('[data-acao="aba"][data-id="loja"]').click()
        await pg.waitForSelector('#t-loja')
        await pg.locator('#tela [data-acao="loja-parte"][data-id="mochila"]').click()
        await pg.waitForSelector('#tela .item-linha--mochila')
      }
      h.usarMochila = (id) => pg.locator(`#tela .item-linha--mochila[data-item="${id}"] [data-acao="item-usar"]`)
      h.cavalo = (uid) => pg.locator(`#tela .item-escolha [data-acao="item-cavalo"][data-id="${uid}"]`)
      h.ficha = async (uid, aba = 'status') => {
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.waitForSelector('#t-estabulo')
        await pg.locator(`button[data-acao="montaria"][data-id="${uid}"]`).click()
        await pg.waitForSelector('#t-montaria')
        if (aba !== 'status') await pg.locator(`[data-acao="montaria-aba"][data-id="${aba}"]`).click()
      }
      h.usarFicha = (id) => pg.locator(`#tela [data-acao="item-usar"][data-id="${id}"][data-mount]:not([data-skill])`)
      h.trocar = (sk) => pg.locator(`#tela [data-acao="item-usar"][data-id="cupom"][data-skill="${sk}"]`)
      h.confirmar = () => pg.locator('#tela [data-acao="item-confirmar"]')
      h.cancelar = () => pg.locator('#tela [data-acao="item-cancelar"]')
      h.texto = async () => ((await pg.locator('#tela').textContent()) || '').replace(/\s+/g, ' ')
      // h.vivo(texto): espera (até 3 s) a região viva ter o texto e a devolve (se não chegar, quem chamou acusa);
      // h.vivo() sem texto, para conferir que algo NÃO foi anunciado: lê depois de uma espera fixa
      h.vivo = async (espera) => {
        if (espera == null) await sleep(150)
        else await pg.waitForFunction((t) => (document.getElementById('motivo-vivo').textContent || '').includes(t), espera, { timeout: 3000 }).catch(() => {})
        return (await pg.locator('#motivo-vivo').textContent()) || ''
      }
      h.pontos = async () => ((await pg.locator('#tela .pontos-livres b').textContent()) || '').trim()   // "sobram L de F"
      h.pontosEsperado = (m) => { const i = S.allocInfo(m); return `sobram ${i.left} de ${i.free}` }
      // o que um uso recusado ou cancelado não pode mudar: mochila, Rédeas, contador, sala e os cavalos
      const marca = (s) => JSON.stringify({ mochila: s.mochila, redeas: s.redeas, itemCounter: s.itemCounter, pending: s.pending, activeId: s.activeId,
        mounts: s.mounts.map((m) => [m.uid, m.torroes, m.grau, m.skills, m.alloc, m.respecFree]) })
      h.marca = async () => marca(await estadoDe(pg))
      h.marcaDisco = async () => marca(await h.disco())
      // um botão apagado (aria-disabled, sem disabled) com o motivo escrito na tela: o toque põe o motivo na região viva e
      // nada muda; o toque forçado (sem o aria-disabled) também não gasta (o handler confere de novo), no state e no disco
      h.apagado = async (loc, re, tag) => {
        if ((await loc.count()) !== 1) { problems.push(`${label} ${tag}: o botão não está na tela (${await loc.count()})`); return }
        if (!(await indisp(loc))) problems.push(`${label} ${tag}: o botão não está apagado (aria-disabled)`)
        const motivo = (await loc.getAttribute('data-motivo')) || ''
        if (!re.test(motivo)) problems.push(`${label} ${tag}: motivo "${motivo}" (esperado ${re})`)
        if (!motivo || !(await h.texto()).includes(motivo)) problems.push(`${label} ${tag}: o motivo "${motivo}" não está escrito na tela`)
        if (/\b\d+ de \d+\b/.test(motivo.replace(/[A-Za-zÀ-ú]+: \d+ de \d+/g, ''))) problems.push(`${label} ${tag}: motivo com "N de M" solto: "${motivo}"`)
        const antes = await h.marca(), antesDisco = await h.marcaDisco()
        await loc.click({ force: true })
        if (!(await h.vivo(motivo)).includes(motivo)) problems.push(`${label} ${tag}: o toque não pôs o motivo na região viva`)
        await loc.evaluate((b) => { b.removeAttribute('aria-disabled'); b.click() }).catch(() => {})
        await sleep(100)
        if ((await h.marca()) !== antes) problems.push(`${label} ${tag}: o toque forçado mudou o save: ${await h.marca()}`)
        // o disco fica como estava ou recebe o state de antes do toque (o toque sincroniza com outras abas gravando)
        const dd = await h.marcaDisco()
        if (dd !== antesDisco && dd !== antes) problems.push(`${label} ${tag}: o toque forçado gravou outra coisa: ${dd}`)
      }
      // cancela no passo em que está: nada muda e a tela volta à de origem
      h.cancela = async (tag, volta) => {
        const antes = await h.marca()
        await h.cancelar().click()
        if ((await h.uiItem()) !== 'null') problems.push(`${label} ${tag}: Cancelar deixou ui.item ${await h.uiItem()}`)
        if ((await h.marca()) !== antes) problems.push(`${label} ${tag}: Cancelar mudou o save`)
        const onde = await pg.evaluate(() => { const u = window.__galope.ui; return u.screen + ':' + (u.screen === 'loja' ? u.lojaParte : u.montaria ? u.montaria.aba : '') })
        if (onde !== volta) problems.push(`${label} ${tag}: Cancelar voltou a ${onde} (esperado ${volta})`)
      }
      return h
    }
    // 10a. Torrão, Estrela, Manual, Cupom e Rédea nova, pela mochila e pela ficha; cancelar em cada passo; os limites
    {
      const label = 'itens-usar'
      const pg = await newPage(browser, VP, label, saveT4())
      const h = usoHelpers(pg, label)
      try {
        await pg.waitForSelector('#t-estabulo')
        // a mochila pela gaveta DEV: 99 torrões (a mochila cheia não impede usar), 2 Estrelas, 3 Cupons, 3 Manuais e 2 Rédeas
        await devAbrir(pg)
        for (const [id, n] of [['torrao', G.BAG_MAX], ['estrela', 2], ['cupom', 3], ['manual', 3]]) await pg.fill('#dev-mochila-' + id, String(n))
        await pg.locator('.dev-gaveta [data-acao="dev-mochila"]').click()
        await pg.fill('#dev-redeas', '2')
        await pg.locator('.dev-gaveta [data-acao="dev-redeas"]').click()
        await devFechar(pg)
        let s = await h.estado()
        if (!igual(s.mochila, { torrao: G.BAG_MAX, estrela: 2, cupom: 3, manual: 3 }) || s.redeas !== 2 || s.seedBase !== 1006 || s.itemCounter !== 0) problems.push(`${label}: preparo ${JSON.stringify({ mochila: s.mochila, redeas: s.redeas, seed: s.seedBase, c: s.itemCounter })}`)
        // a parte Mochila: cada item com quantidade tem o "Usar" (com o nome do item para o leitor de tela)
        await h.irMochila()
        for (const id of Object.keys(G.ITEMS)) {
          const b = h.usarMochila(id), t = ((await b.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim()
          if ((await b.count()) !== 1 || !/^Usar/.test(t) || !t.includes(G.ITEMS[id].name)) problems.push(`${label}: a linha de ${id} sem o botão "Usar ${G.ITEMS[id].name}" (${t})`)
        }
        // ---- Torrão pela mochila (Brasa): a escolha do cavalo com as linhas do Estábulo; Faísca (10 torrões) apagada ----
        const m1a = await h.mount('m1')
        await h.usarMochila('torrao').click()
        const rows = await pg.locator('#tela .item-escolha [data-acao="item-cavalo"]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-id')))
        if (!igual(rows, ['m1', 'm2', 'm3', 'm4'])) problems.push(`${label}: a escolha do cavalo tem ${rows.join(',')} (esperado os 4, na ordem do estábulo)`)
        if ((await h.uiItem()) !== JSON.stringify({ id: 'torrao', mountUid: null, skillId: null, passo: 'cavalo', origem: 'mochila' })) problems.push(`${label}: ui.item na escolha do cavalo ${await h.uiItem()}`)
        await h.apagado(h.cavalo('m3'), /10/, 'Torrão em Faísca (10 torrões), pela mochila')
        await h.cancela('Torrão, na escolha do cavalo', 'loja:mochila')
        await h.usarMochila('torrao').click()
        await h.cavalo('m1').click()
        if (!/passo":"confirma"/.test(await h.uiItem()) || (await h.confirmar().count()) !== 1) problems.push(`${label}: Torrão em Brasa não foi à confirmação ${await h.uiItem()}`)
        await h.cancela('Torrão, na confirmação', 'loja:mochila')
        await h.usarMochila('torrao').click()
        await h.cavalo('m1').click()
        await h.confirmar().click()
        s = await h.estado()
        let m1 = s.mounts.find((m) => m.uid === 'm1')
        if (m1.torroes !== 1 || s.mochila.torrao !== G.BAG_MAX - 1 || S.freePoints(m1) !== S.freePoints(m1a) + 1 || s.itemCounter !== 0) problems.push(`${label}: Torrão pela mochila: torroes ${m1.torroes}, mochila ${s.mochila.torrao}, pontos ${S.freePoints(m1a)} -> ${S.freePoints(m1)}, contador ${s.itemCounter}`)
        let d = await h.disco()
        if (d.mochila.torrao !== G.BAG_MAX - 1 || d.mounts.find((m) => m.uid === 'm1').torroes !== 1) problems.push(`${label}: o Torrão não foi gravado junto (mochila e cavalo)`)
        const onde = await pg.evaluate(() => window.__galope.ui.screen + ':' + window.__galope.ui.lojaParte + ':' + JSON.stringify(window.__galope.ui.item))
        if (onde !== 'loja:mochila:null') problems.push(`${label}: depois do Torrão a tela ficou em ${onde} (esperado a Mochila)`)
        const avisoT = (await pg.locator('#tela .item-linha--mochila[data-item="torrao"] .item-aviso').textContent().catch(() => '')) || ''
        if (!/Brasa ganhou 1 ponto para distribuir/.test(avisoT) || !/Torrões usados: 1 de 10/.test(avisoT)) problems.push(`${label}: o aviso do Torrão na linha: "${avisoT}"`)
        if (!(await h.vivo('Brasa ganhou 1 ponto')).includes('Brasa ganhou 1 ponto')) problems.push(`${label}: o aviso do Torrão não foi para a região viva`)
        // ---- pela ficha: os pontos para distribuir sobem 1 e o cavalo mostra quantos torrões já usou ----
        await h.ficha('m1')
        if ((await h.pontos()) !== h.pontosEsperado(m1)) problems.push(`${label}: a ficha diz "${await h.pontos()}" (esperado "${h.pontosEsperado(m1)}", com o torrão)`)
        if (!/Torrões usados: 1 de 10/.test(await h.texto())) problems.push(`${label}: a ficha não mostra "Torrões usados: 1 de 10"`)
        const rotuloLinha = await pg.evaluate(() => window.__galope.state.mounts[0].uid)
        if (rotuloLinha !== 'm1') problems.push(`${label}: a ordem do estábulo mudou`)
        await h.usarFicha('torrao').click()
        if (!/"origem":"ficha"/.test(await h.uiItem()) || !/"passo":"confirma"/.test(await h.uiItem())) problems.push(`${label}: o Torrão da ficha não foi direto à confirmação ${await h.uiItem()}`)
        await h.cancela('Torrão da ficha, na confirmação', 'montaria:status')
        await h.usarFicha('torrao').click()
        await h.confirmar().click()
        m1 = await h.mount('m1')
        if (m1.torroes !== 2 || (await h.estado()).mochila.torrao !== G.BAG_MAX - 2) problems.push(`${label}: Torrão pela ficha: torroes ${m1.torroes}`)
        if ((await h.pontos()) !== h.pontosEsperado(m1) || S.freePoints(m1) !== S.freePoints(m1a) + 2) problems.push(`${label}: depois do 2º torrão a ficha diz "${await h.pontos()}" (esperado "${h.pontosEsperado(m1)}")`)
        if (!/Torrões usados: 2 de 10/.test(await h.texto()) || !/Brasa ganhou 1 ponto para distribuir/.test(await h.texto())) problems.push(`${label}: a ficha sem "Torrões usados: 2 de 10" ou sem o aviso do resultado`)
        const rot = (await pg.locator('#tela').evaluate(() => window.__galope.ui.screen + ':' + window.__galope.ui.montaria.aba)) || ''
        if (rot !== 'montaria:status') problems.push(`${label}: depois do Torrão da ficha a tela ficou em ${rot}`)
        // ---- o 11º torrão (Faísca já tem 10): apagado com o motivo, na ficha; nada é gasto ----
        await h.ficha('m3')
        await h.apagado(h.usarFicha('torrao'), /10/, 'o 11º torrão, pela ficha')
        if (!/Torrões usados: 10 de 10/.test(await h.texto())) problems.push(`${label}: Faísca sem "Torrões usados: 10 de 10"`)
        // ---- Estrela: Maré ★2 vira ★3 e os pontos sobem pelo fator das estrelas; em ★3, recusado ----
        const m2a = await h.mount('m2')
        await h.ficha('m2')
        await h.usarFicha('estrela').click()
        await h.confirmar().click()
        const m2b = await h.mount('m2')
        if (m2b.grau !== 3 || S.freePoints(m2b) !== S.freePoints({ ...m2a, grau: 3 }) || !(S.freePoints(m2b) > S.freePoints(m2a)) || (await h.estado()).mochila.estrela !== 1) problems.push(`${label}: Estrela: grau ${m2b.grau}, pontos ${S.freePoints(m2a)} -> ${S.freePoints(m2b)}`)
        if ((await h.pontos()) !== h.pontosEsperado(m2b)) problems.push(`${label}: depois da Estrela a ficha diz "${await h.pontos()}" (esperado "${h.pontosEsperado(m2b)}")`)
        if (!/Maré agora tem 3 estrelas/.test(await h.texto())) problems.push(`${label}: sem o aviso da Estrela`)
        await h.apagado(h.usarFicha('estrela'), /★★★/, 'Estrela em ★3, pela ficha')
        await h.irMochila()
        await h.usarMochila('estrela').click()
        await h.apagado(h.cavalo('m3'), /★★★/, 'Estrela em Faísca (★3), pela mochila')
        await h.cancela('Estrela, na escolha do cavalo', 'loja:mochila')
        // ---- Manual pela mochila (Maré, vaga livre): o resultado é o do Itens para o contador; a confirmação diz a chance,
        //      não o resultado; recarregar mostra o mesmo (Review Focus 1) ----
        let m2 = await h.mount('m2'), c0 = (await h.estado()).itemCounter
        const espera1 = IT.tentarDoma(m2, 1006, c0)
        await h.usarMochila('manual').click()
        await h.apagado(h.cavalo('m1'), /cheias/, 'Manual em Brasa (vaga cheia), pela mochila')
        await h.cavalo('m2').click()
        const conf = await h.texto()
        if (!conf.includes(Math.round(G.ITEMS.manual.chance * 100) + '%')) problems.push(`${label}: a confirmação do Manual não diz a chance: ${conf}`)
        if (espera1.aprendeu && conf.includes(G.SKILLS[espera1.aprendeu].name)) problems.push(`${label}: a confirmação do Manual mostra a skill que viria (${G.SKILLS[espera1.aprendeu].name})`)
        if (await pg.evaluate(() => window.__galope.state.itemCounter) !== c0) problems.push(`${label}: abrir a confirmação mexeu no contador`)
        await h.confirmar().click()
        s = await h.estado()
        m2 = s.mounts.find((m) => m.uid === 'm2')
        if (!igual(m2.skills, espera1.skills) || s.itemCounter !== c0 + 1 || s.mochila.manual !== 2) problems.push(`${label}: Manual: skills ${JSON.stringify(m2.skills)} (esperado ${JSON.stringify(espera1.skills)}), contador ${s.itemCounter}, mochila ${s.mochila.manual}`)
        const avisoM = await h.texto()
        if (espera1.aprendeu ? !avisoM.includes('Maré aprendeu ' + G.SKILLS[espera1.aprendeu].name + '!') : !/Não foi desta vez: Maré não aprendeu\. O manual foi usado\./.test(avisoM)) problems.push(`${label}: aviso do Manual (${JSON.stringify(espera1)}): ${avisoM}`)
        d = await h.disco()
        if (d.itemCounter !== c0 + 1 || d.mochila.manual !== 2 || !igual(d.mounts.find((m) => m.uid === 'm2').skills, espera1.skills)) problems.push(`${label}: o Manual não foi gravado junto (contador, mochila e skill)`)
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        s = await h.estado()
        if (!igual(s.mounts.find((m) => m.uid === 'm2').skills, espera1.skills) || s.itemCounter !== c0 + 1 || s.mochila.manual !== 2) problems.push(`${label}: Review Focus 1: depois de recarregar, Maré tem ${JSON.stringify(s.mounts.find((m) => m.uid === 'm2').skills)}, contador ${s.itemCounter}, mochila ${s.mochila.manual}`)
        // o uso seguinte, pela ficha (Ipê, aba Skills), usa o contador seguinte
        const m4 = s.mounts.find((m) => m.uid === 'm4'), espera2 = IT.tentarDoma(m4, 1006, c0 + 1)
        await h.ficha('m4', 'skills')
        await h.usarFicha('manual').click()
        if (!/"passo":"confirma"/.test(await h.uiItem())) problems.push(`${label}: o Manual da ficha não foi à confirmação`)
        await h.cancela('Manual da ficha, na confirmação', 'montaria:skills')
        await h.usarFicha('manual').click()
        await h.confirmar().click()
        s = await h.estado()
        if (!igual(s.mounts.find((m) => m.uid === 'm4').skills, espera2.skills) || s.itemCounter !== c0 + 2 || s.mochila.manual !== 1) problems.push(`${label}: 2º Manual: ${JSON.stringify(s.mounts.find((m) => m.uid === 'm4').skills)} (esperado ${JSON.stringify(espera2.skills)}), contador ${s.itemCounter}`)
        if (espera1.aprendeu === null || espera2.aprendeu !== null) problems.push(`${label}: a seed 1006 deveria dar um Manual que aprende e um que não (${JSON.stringify([espera1, espera2])})`)
        if (espera2.aprendeu === null && !/Não foi desta vez: Ipê não aprendeu\. O manual foi usado\./.test(await h.texto())) problems.push(`${label}: aviso do Manual que não aprende: ${await h.texto()}`)
        // Manual com as vagas cheias: apagado na ficha
        await h.ficha('m1', 'skills')
        await h.apagado(h.usarFicha('manual'), /cheias/, 'Manual em Brasa (vaga cheia), pela ficha')
        // ---- Cupom pela ficha (Brasa, Sprint): a skill de tipo não tem "Trocar"; a gravação que falha não mostra nada ----
        if (await pg.locator('#tela .vaga-tipo [data-acao="item-usar"]').count()) problems.push(`${label}: a skill de tipo tem botão de uso`)
        if ((await pg.locator('#tela [data-acao="item-usar"][data-id="cupom"]').count()) !== 1) problems.push(`${label}: Brasa tem ${await pg.locator('#tela [data-acao="item-usar"][data-id="cupom"]').count()} "Trocar" (esperado 1, o da Sprint)`)
        await h.trocar('sprint').click()
        if ((await h.uiItem()) !== JSON.stringify({ id: 'cupom', mountUid: 'm1', skillId: 'sprint', passo: 'confirma', origem: 'ficha' })) problems.push(`${label}: Trocar não foi à confirmação com a skill ${await h.uiItem()}`)
        await h.cancela('Trocar, na confirmação', 'montaria:skills')
        await h.trocar('sprint').click()
        const marcaF = await h.marca()
        await pg.evaluate(() => { window.__setOrig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('cheio', 'QuotaExceededError') } })
        await h.confirmar().click()
        await pg.evaluate(() => { Storage.prototype.setItem = window.__setOrig })
        if ((await h.marca()) !== marcaF) problems.push(`${label}: o Cupom com a gravação falhando mudou o save ${await h.marca()}`)
        if (!/Não foi possível salvar/.test(await h.texto()) || /saiu e entrou/.test(await h.texto())) problems.push(`${label}: o Cupom com a gravação falhando: ${await h.texto()}`)
        m1 = await h.mount('m1')
        const c1 = (await h.estado()).itemCounter, espera3 = IT.trocarSkill(m1, 'sprint', 1006, c1)
        await h.confirmar().click()
        s = await h.estado()
        m1 = s.mounts.find((m) => m.uid === 'm1')
        if (!igual(m1.skills, espera3.skills) || m1.skills[0] !== espera3.entra || s.itemCounter !== c1 + 1 || s.mochila.cupom !== 2) problems.push(`${label}: Cupom: ${JSON.stringify(m1.skills)} (esperado ${JSON.stringify(espera3)}), contador ${s.itemCounter}`)
        if (!(await h.texto()).includes(G.SKILLS.sprint.name + ' saiu e entrou ' + G.SKILLS[espera3.entra].name + '.')) problems.push(`${label}: aviso do Cupom: ${await h.texto()}`)
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        if (!igual((await h.mount('m1')).skills, espera3.skills) || (await h.estado()).itemCounter !== c1 + 1) problems.push(`${label}: depois de recarregar, o Cupom mudou`)
        // ---- Cupom pela mochila: Ipê sem skill nas vagas apagado; Faísca escolhe a skill que sai; cancelar na escolha da skill ----
        await h.irMochila()
        await h.usarMochila('cupom').click()
        await h.apagado(h.cavalo('m4'), /skill nas vagas/, 'Cupom em Ipê (sem skill nas vagas)')   // Ipê sem skill: o 2º Manual não ensinou (conferido acima)
        await h.cavalo('m3').click()
        if (!/"passo":"skill"/.test(await h.uiItem()) || (await pg.locator('#tela [data-acao="item-skill"]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-id')))).join() !== 'arranque') problems.push(`${label}: a escolha da skill de Faísca ${await h.uiItem()}`)
        await h.cancela('Cupom, na escolha da skill', 'loja:mochila')
        await h.usarMochila('cupom').click()
        await h.cavalo('m3').click()
        await pg.locator('#tela [data-acao="item-skill"][data-id="arranque"]').click()
        const m3 = await h.mount('m3'), c2 = (await h.estado()).itemCounter, espera4 = IT.trocarSkill(m3, 'arranque', 1006, c2)
        await h.confirmar().click()
        s = await h.estado()
        if (!igual(s.mounts.find((m) => m.uid === 'm3').skills, espera4.skills) || s.itemCounter !== c2 + 1 || s.mochila.cupom !== 1) problems.push(`${label}: Cupom pela mochila: ${JSON.stringify(s.mounts.find((m) => m.uid === 'm3').skills)} (esperado ${JSON.stringify(espera4.skills)})`)
        // ---- Rédea nova pela mochila: vai à aba Status do cavalo, com o foco no Redistribuir; a grátis primeiro ----
        await h.usarMochila('redea').click()
        await h.apagado(h.cavalo('m4'), /Nenhum ponto/, 'Rédea em Ipê (sem pontos distribuídos)')
        await h.cavalo('m2').click()
        await pg.waitForSelector('#t-montaria')
        const foco = await pg.evaluate(() => { const u = window.__galope.ui, e = document.activeElement; return u.screen + ':' + u.montaria.uid + ':' + u.montaria.aba + ':' + (e && e.getAttribute('data-acao')) })
        if (foco !== 'montaria:m2:status:redistribuir') problems.push(`${label}: a Rédea pela mochila foi a ${foco} (esperado a aba Status de Maré com o foco no Redistribuir)`)
        await pg.locator('#tela [data-acao="redistribuir"]').click()
        await pg.locator('#tela [data-acao="redistribuir"]').click()
        s = await h.estado()
        if (s.redeas !== 2 || s.mounts.find((m) => m.uid === 'm2').respecFree !== false || S.STAT_KEYS.some((k) => s.mounts.find((m) => m.uid === 'm2').alloc[k])) problems.push(`${label}: Rédea em Maré (com a grátis): redeas ${s.redeas}`)
        await h.irMochila()
        await h.usarMochila('redea').click()
        await h.cavalo('m1').click()
        await pg.waitForSelector('#t-montaria')
        await pg.locator('#tela [data-acao="redistribuir"]').click()
        await pg.locator('#tela [data-acao="redistribuir"]').click()
        s = await h.estado()
        if (s.redeas !== 1 || S.STAT_KEYS.some((k) => s.mounts.find((m) => m.uid === 'm1').alloc[k])) problems.push(`${label}: Rédea em Brasa (sem a grátis): redeas ${s.redeas} (esperado 1)`)
        // ---- Ruling 1: o ponto do Torrão também aparece depois de uma corrida que sobe o nível ----
        await pg.evaluate(() => { window.__galope.state.mounts[0].xp = 1e7 })
        await abrirSala(pg, 50)
        await pg.getByRole('button', { name: /^Largar/ }).click()
        await pg.waitForSelector('#pista')
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado')
        const R = await pg.evaluate(() => JSON.parse(JSON.stringify(window.__galope.ui.result)))
        m1 = await h.mount('m1')
        if (!(R.levels > 0) || R.after.free !== S.freePoints(m1) || S.freePoints(m1) !== S.freePoints({ ...m1, torroes: 0 }) + 2) problems.push(`${label}: Ruling 1: depois da corrida, pontos ${R.after.free} (esperado ${S.freePoints(m1)}, com os 2 torrões; níveis ${R.levels})`)
        await pg.locator('#tela [data-acao="voltar"]').first().click()
        await pg.waitForSelector('#t-correr')
        await h.ficha('m1')
        if ((await h.pontos()) !== h.pontosEsperado(m1)) problems.push(`${label}: Ruling 1: a ficha depois da corrida diz "${await h.pontos()}" (esperado "${h.pontosEsperado(m1)}")`)
        await checkOverflow(pg, label)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 10b. sala aberta: Cupom e Manual apagados no ativo (mochila e ficha) e aceitos em outro cavalo; Torrão e Estrela aceitos
    //      no ativo; a sala e o resultado da corrida aberta, simulado antes e depois, não mudam
    {
      const label = 'itens-usar-sala'
      const pg = await newPage(browser, VP, label, saveT4({ mochila: { torrao: 5, estrela: 2, cupom: 2, manual: 2 } }))
      const h = usoHelpers(pg, label)
      try {
        await pg.waitForSelector('#t-estabulo')
        await abrirSala(pg, 50)
        const pend = (await h.estado()).pending, sim0 = await simSala(pg)
        await pg.getByRole('button', { name: /^Voltar/ }).click()
        await pg.waitForSelector('#t-correr')
        await h.irMochila()
        for (const [id, outro] of [['cupom', 'm3'], ['manual', 'm2']]) {
          await h.usarMochila(id).click()
          await h.apagado(h.cavalo('m1'), /páreo aberto/, `${id} no ativo com a sala aberta, pela mochila`)
          if (await indisp(h.cavalo(outro))) problems.push(`${label}: ${id} recusado em ${outro} (não é o ativo)`)
          await h.cancela(`${id} com a sala aberta`, 'loja:mochila')
        }
        await h.ficha('m1', 'skills')
        await h.apagado(h.trocar('sprint'), /páreo aberto/, 'Trocar no ativo com a sala aberta, pela ficha')
        await h.apagado(h.usarFicha('manual'), /páreo aberto/, 'Manual no ativo com a sala aberta, pela ficha')
        // aceitos em outro cavalo: Cupom em Faísca, Manual em Maré
        await h.ficha('m3', 'skills')
        const m3 = await h.mount('m3'), e1 = IT.trocarSkill(m3, 'arranque', 1006, 0)
        await h.trocar('arranque').click()
        await h.confirmar().click()
        if (!igual((await h.mount('m3')).skills, e1.skills)) problems.push(`${label}: Cupom em Faísca com a sala aberta: ${JSON.stringify((await h.mount('m3')).skills)}`)
        await h.ficha('m2', 'skills')
        const e2 = IT.tentarDoma(await h.mount('m2'), 1006, 1)
        await h.usarFicha('manual').click()
        await h.confirmar().click()
        if (!igual((await h.mount('m2')).skills, e2.skills)) problems.push(`${label}: Manual em Maré com a sala aberta: ${JSON.stringify((await h.mount('m2')).skills)}`)
        // Torrão e Estrela no ativo, com a sala aberta
        await h.ficha('m1')
        await h.usarFicha('torrao').click()
        await h.confirmar().click()
        await h.usarFicha('estrela').click()
        await h.confirmar().click()
        let m1 = await h.mount('m1')
        if (m1.torroes !== 1 || m1.grau !== 3) problems.push(`${label}: Torrão e Estrela no ativo com a sala aberta: torroes ${m1.torroes}, grau ${m1.grau}`)
        if (!igual((await h.estado()).pending, pend)) problems.push(`${label}: a sala guardada mudou com os usos ${JSON.stringify((await h.estado()).pending)}`)
        if ((await simSala(pg)) !== sim0) problems.push(`${label}: o resultado da corrida aberta mudou com os usos`)
        // os pontos novos só entram até o Poder da sala: o sugerido que passa dele não grava, nem forçado
        // (sem o botão, ou com ele apagado, a tentativa não roda: é problema, para a asserção abaixo não passar à toa)
        const sug = pg.locator('#tela [data-acao="pontos-sugerir"]')
        if ((await sug.count()) !== 1 || (await indisp(sug))) problems.push(`${label}: sem o "Distribuir sugerido" disponível no ativo (a tentativa de passar do Poder da sala não rodou)`)
        await sug.click()
        const cf = pg.locator('#tela [data-acao="pontos-confirmar"]')
        await esperaBarra(pg)
        if ((await cf.count()) !== 1) problems.push(`${label}: sem o Confirmar dos pontos depois do sugerido`)
        for (let k = 0; k < 2; k++) await cf.evaluate((b) => { b.removeAttribute('aria-disabled'); b.click() }).catch(() => {})
        await sleep(100)
        m1 = await h.mount('m1')
        if (S.powerRating(m1) > pend.pr) problems.push(`${label}: com a sala aberta o Poder do ativo passou do da sala (${S.powerRating(m1)} > ${pend.pr})`)
        if ((await simSala(pg)) !== sim0) problems.push(`${label}: o resultado da corrida aberta mudou com os pontos`)
        await checkOverflow(pg, label)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 10c. Review Focus 5: com a confirmação aberta, outra aba muda o cavalo (vira o ativo com a sala aberta; sai do save):
    //      o "Confirmar" confere tudo de novo, recusa com o motivo e a mochila não muda
    {
      const label = 'itens-usar-rf5'
      const pg = await newPage(browser, VP, label, saveT4({ mochila: { ...ZERO_MOCHILA, manual: 2 } }))
      const h = usoHelpers(pg, label)
      // grava o save mudado por "outra aba" e dispara o evento storage
      const outraAba = (src) => pg.evaluate(([k, src]) => {
        const s = JSON.parse(localStorage.getItem(k))
        ;(new Function('s', src))(s)
        s.rev += 10
        const raw = JSON.stringify(s)
        localStorage.setItem(k, raw)
        window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: raw }))
      }, [DEVK, src])
      try {
        await pg.waitForSelector('#t-estabulo')
        await h.irMochila()
        await h.usarMochila('manual').click()
        await h.cavalo('m2').click()
        await outraAba("s.activeId = 'm2'; s.raceCounter += 1; s.pending = { counter: s.raceCounter, training: false, fee: 50, pr: 1, gear: null, alloc: s.mounts[1].alloc }")
        await sleep(200)
        const s = await h.estado()
        if (s.activeId !== 'm2' || !s.pending) problems.push(`${label}: o save da outra aba não foi adotado ${JSON.stringify({ ativo: s.activeId, sala: !!s.pending })}`)
        if (!/"passo":"confirma"/.test(await h.uiItem())) problems.push(`${label}: a confirmação sumiu com o save da outra aba ${await h.uiItem()}`)
        await h.apagado(h.confirmar(), /páreo aberto/, 'Confirmar depois de Maré virar a ativa com a sala aberta')
        if ((await h.estado()).mochila.manual !== 2) problems.push(`${label}: a mochila mudou`)
        await h.cancela('depois da outra aba', 'loja:mochila')
        // o cavalo sai do save (Ipê) entre escolher e confirmar
        await h.usarMochila('manual').click()
        await h.cavalo('m4').click()
        await outraAba("s.mounts = s.mounts.filter(function (m) { return m.uid !== 'm4' })")
        await sleep(200)
        if ((await h.estado()).mounts.some((m) => m.uid === 'm4')) problems.push(`${label}: Ipê continua no save adotado`)
        await h.apagado(h.confirmar(), /não está mais no estábulo/, 'Confirmar depois de Ipê sair do save')
        if ((await h.estado()).mochila.manual !== 2 || (await h.estado()).itemCounter !== 0) problems.push(`${label}: Ipê fora do save: a mochila ou o contador mudou`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 10d. duas abas no mesmo save: a 2ª não recebe o aviso de gravação (aba velha); o toque nela não gasta de novo nem sorteia
    //      de novo (decide a revisão do save, que já existe)
    {
      const label = 'itens-duas-abas'
      const pa = await newPage(browser, VP, label + ' A', saveT4({ mochila: { ...ZERO_MOCHILA, manual: 1 } }))
      const pb = await pa.context().newPage()
      pb.on('console', (m) => { if (m.type() === 'error') problems.push(`[${label} B] console: ${m.text()}`) })
      pb.on('pageerror', (e) => problems.push(`[${label} B] pageerror: ${e.message}`))
      const ha = usoHelpers(pa, label + ' A'), hb = usoHelpers(pb, label + ' B')
      try {
        await pa.waitForSelector('#t-estabulo')
        await pb.addInitScript(() => window.addEventListener('storage', (e) => e.stopImmediatePropagation(), true))
        await pb.goto(BASE + 'preview.html?dev=1', { waitUntil: 'domcontentloaded' })
        await pb.waitForSelector('#t-estabulo')
        await ha.irMochila()
        await hb.irMochila()
        // A usa o Manual em Maré; B ainda mostra o Manual
        const e1 = IT.tentarDoma(await ha.mount('m2'), 1006, 0)
        await ha.usarMochila('manual').click()
        await ha.cavalo('m2').click()
        await ha.confirmar().click()
        if ((await hb.usarMochila('manual').count()) !== 1) problems.push(`${label}: a 2ª aba já não mostra o Manual (o teste não prova nada)`)
        await hb.usarMochila('manual').click()
        await pb.waitForSelector('#t-estabulo')
        let sb = await hb.estado(), d = await hb.disco()
        if (sb.mochila.manual !== 0 || sb.itemCounter !== 1 || d.itemCounter !== 1 || d.mochila.manual !== 0 || !igual(sb.mounts.find((m) => m.uid === 'm2').skills, e1.skills)) problems.push(`${label}: o toque na 2ª aba gastou ou sorteou de novo ${JSON.stringify({ mochila: sb.mochila.manual, c: sb.itemCounter, disco: d.itemCounter })}`)
        if (!/outra aba/.test(await hb.texto())) problems.push(`${label}: a 2ª aba não avisa que o jogo mudou em outra aba`)
        // com a confirmação aberta na 2ª aba: A gasta o último Manual; o Confirmar de B recusa
        await devAbrir(pa); await pa.fill('#dev-mochila-manual', '1'); await pa.locator('.dev-gaveta [data-acao="dev-mochila"]').click(); await devFechar(pa)
        await pb.reload({ waitUntil: 'domcontentloaded' })
        await pb.waitForSelector('#t-estabulo')
        await hb.irMochila()
        await hb.usarMochila('manual').click()
        await hb.cavalo('m4').click()
        await ha.irMochila()
        await ha.usarMochila('manual').click()
        await ha.cavalo('m4').click()
        await ha.confirmar().click()
        const depoisA = await ha.marcaDisco()
        await hb.confirmar().click()
        await sleep(150)
        sb = await hb.estado()
        if ((await hb.marcaDisco()) !== depoisA || sb.itemCounter !== 2 || sb.mochila.manual !== 0) problems.push(`${label}: o Confirmar da 2ª aba gastou de novo ${JSON.stringify({ c: sb.itemCounter, mochila: sb.mochila.manual })}`)
        if (/aprendeu|Não foi desta vez/.test(await hb.texto())) problems.push(`${label}: a 2ª aba mostrou um resultado`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pa.context().close()
      }
    }
    // 10e. Review Focus 4, "sem candidata": com o catálogo reduzido à Sprint (antes de o jogo carregar), Brasa (Sprint) não tem
    //      para que trocar e Ipê (vaga livre) não tem o que aprender
    {
      const label = 'itens-usar-semcand'
      const init = () => {
        let gd
        Object.defineProperty(window, 'GameData', { configurable: true, get: () => gd, set: (v) => { Object.keys(v.SKILLS).forEach((k) => { if (k !== 'sprint') delete v.SKILLS[k] }); gd = v } })
      }
      // Tição (Mágico, 2 vagas) já tem a Sprint: tem vaga livre e nada para aprender
      const ticao = G.WILD_HORSES.find((x) => x.id === 'w-ticao')
      const base = saveT4({ mochila: { ...ZERO_MOCHILA, cupom: 1, manual: 1 }, mounts: SAVE_T4.mounts.slice(0, 2).concat([cav(ticao, { uid: 'm3', level: 6, skills: ['sprint'] })]), nextUid: 4 })
      const pg = await newPage(browser, VP, label, { ...base, init: { content: base.init.content + ';(' + init.toString() + ')()' } })
      const h = usoHelpers(pg, label)
      try {
        await pg.waitForSelector('#t-estabulo')
        if ((await pg.evaluate(() => Object.keys(window.GameData.SKILLS).join())) !== 'sprint') problems.push(`${label}: o catálogo não foi reduzido (o teste não prova nada)`)
        await h.ficha('m1', 'skills')
        await h.apagado(h.trocar('sprint'), /skill nova/, 'Trocar sem candidata')
        await h.irMochila()
        await h.usarMochila('manual').click()
        await h.apagado(h.cavalo('m3'), /skill nova/, 'Manual sem candidata (Tição, vaga livre)')
        await h.cancela('Manual sem candidata', 'loja:mochila')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 11. recompensa diária (Tarefa 5; spec de itens §7, §8, §9, §13): o cartão no topo do Estábulo, o ponto na aba, o resgate
    //     (uma vez por dia, gravado junto com o prêmio), o dia que vira sem recarregar (Review Focus 2), o relógio para trás
    //     (Review Focus 3), os 7 dias e a Estrela no 28º resgate, a mochila cheia e a Rédea no teto. O dia anda pela gaveta DEV.
    // a tabela da spec §7, escrita à mão (não lida do catálogo): o que cada dia do calendário dá e como o cartão o escreve
    const PREMIOS_DIARIA = [
      { ouro: 60, txt: '60 de Ouro' }, { torrao: 1, txt: '1 Torrão de açúcar' }, { ouro: 100, txt: '100 de Ouro' },
      { manual: 1, txt: '1 Manual de doma' }, { ouro: 150, txt: '150 de Ouro' }, { cupom: 1, txt: '1 Cupom de troca de skill' },
      { ouro: 200, redea: 1, txt: '200 de Ouro e 1 Rédea nova' }]
    const premioDiaria = (k) => k % 28 === 0   // o k-ésimo resgate (1, 2, …): no 28º (4 calendários), também a Estrela
      ? { ...PREMIOS_DIARIA[6], estrela: 1, txt: '200 de Ouro, 1 Rédea nova e 1 Estrela de treino' } : PREMIOS_DIARIA[(k - 1) % 7]
    const diariaHelpers = (pg, label) => {
      const h = {}
      h.cartao = () => pg.locator('#tela .diaria')
      h.botao = () => pg.locator('#tela [data-acao="diaria-resgatar"]')
      h.ver = () => pg.locator('#tela [data-acao="diaria-ver"]')
      h.texto = async () => ((await h.cartao().first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim()
      h.pontos = () => pg.locator('.app-abas .app-aba--ponto').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-id')).join(','))
      // h.vivo(texto): espera (até 3 s) a região viva ter o texto e a devolve (se não chegar, quem chamou acusa);
      // h.vivo() sem texto, para conferir que algo NÃO foi anunciado: lê depois de uma espera fixa
      h.vivo = async (espera) => {
        if (espera == null) await sleep(150)
        else await pg.waitForFunction((t) => (document.getElementById('motivo-vivo').textContent || '').includes(t), espera, { timeout: 3000 }).catch(() => {})
        return (await pg.locator('#motivo-vivo').textContent()) || ''
      }
      h.hoje = () => pg.evaluate(() => window.__galope.hojeDia())
      const marca = (s) => JSON.stringify({ gold: s.gold, mochila: s.mochila, redeas: s.redeas, diaria: s.diaria })
      h.marca = async () => marca(await estadoDe(pg))
      h.marcaDisco = async () => marca(JSON.parse(await bruto(pg, DEVK)))
      h.dev = async (acao, n = 1) => { await devAbrir(pg); for (let i = 0; i < n; i++) await pg.locator(`.dev-gaveta [data-acao="${acao}"]`).click(); await devFechar(pg) }
      // o Ouro infinito do perfil de teste repõe o saldo a cada gravação: desligado, o saldo é o que o resgate deu
      h.preparar = async () => { await pg.waitForSelector('#t-estabulo'); await devAbrir(pg); await pg.setChecked('#dev-ouroinf', false); await devFechar(pg) }
      // o cartão grande: o título, o dia "N / 7", o prêmio de hoje e o botão Resgatar (≥ 44 px), no topo do Estábulo; o ponto na aba
      h.grande = async (dia, txt, tag) => {
        const t = await h.texto()
        if ((await h.cartao().count()) !== 1 || !(await h.cartao().evaluate((c) => c.classList.contains('diaria--grande')))) problems.push(`${label} ${tag}: sem o cartão grande (${await h.cartao().count()})`)
        if (!t.includes('Recompensa do dia') || !t.includes(`${dia} / 7`) || !t.includes(txt)) problems.push(`${label} ${tag}: o cartão diz "${t}" (esperado "Recompensa do dia", "${dia} / 7" e "${txt}")`)
        const b = await h.botao().evaluateAll((bs) => bs.map((x) => ({ txt: x.textContent.replace(/\s+/g, ' ').trim(), h: x.getBoundingClientRect().height, w: x.getBoundingClientRect().width })))
        if (b.length !== 1 || b[0].txt.indexOf('Resgatar') !== 0 || b[0].h < 44 || b[0].w < 44) problems.push(`${label} ${tag}: o botão Resgatar ${JSON.stringify(b)}`)
        const v = await h.ver().evaluateAll((bs) => bs.map((x) => x.getBoundingClientRect().height))
        if (v.length !== 1 || v[0] < 44) problems.push(`${label} ${tag}: o botão "Ver os 7 dias" ${JSON.stringify(v)}`)
        // aria-controls só aponta para um id que existe na tela (a lista dos 7 dias só existe aberta)
        const ctl = await h.ver().evaluateAll((bs) => bs.map((b) => { const id = b.getAttribute('aria-controls'); return id === null || !!document.getElementById(id) }))
        if (ctl.some((x) => !x)) problems.push(`${label} ${tag}: o "Ver os 7 dias" tem aria-controls para um id que não está na tela`)
        const topo = await pg.evaluate(() => { const c = document.querySelector('#tela .diaria'), l = document.querySelector('#tela .caixa[aria-label="Suas montarias"]'); return !!(c && l && c.getBoundingClientRect().bottom <= l.getBoundingClientRect().top) })
        if (!topo) problems.push(`${label} ${tag}: o cartão não está acima da lista de cavalos`)
        if ((await h.pontos()) !== 'estabulo') problems.push(`${label} ${tag}: pontos na barra de abas "${await h.pontos()}" (esperado só o do Estábulo)`)
      }
      // o cartão de uma linha: sem botão, o texto pedido e sem o ponto na aba
      h.linha = async (re, tag) => {
        const t = await h.texto()
        if ((await h.cartao().count()) !== 1 || !(await h.cartao().evaluate((c) => c.classList.contains('diaria--linha')))) problems.push(`${label} ${tag}: sem o cartão de uma linha`)
        if ((await h.botao().count()) !== 0 || (await h.ver().count()) !== 0) problems.push(`${label} ${tag}: o cartão de uma linha tem botão`)
        if (!re.test(t)) problems.push(`${label} ${tag}: o cartão diz "${t}" (esperado ${re})`)
        if ((await h.pontos()) !== '') problems.push(`${label} ${tag}: pontos na barra de abas "${await h.pontos()}" (esperado nenhum)`)
      }
      // o toque na ação sem o botão na tela (um botão posto à mão): nada muda, nem no state nem no disco
      h.forcado = async (tag) => {
        const antes = await h.marca()
        await pg.evaluate(() => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-acao', 'diaria-resgatar'); b.textContent = 'x'; document.querySelector('#tela .tela').appendChild(b); b.click() })
        await sleep(100)
        if ((await h.marca()) !== antes) problems.push(`${label} ${tag}: o toque forçado em Resgatar mudou o save: ${await h.marca()}`)
        if ((await h.marcaDisco()) !== antes) problems.push(`${label} ${tag}: o toque forçado em Resgatar gravou outra coisa: ${await h.marcaDisco()}`)
      }
      // o k-ésimo resgate: o Ouro e os itens do dia entram (a Rédea em state.redeas), o calendário anda e tudo vai junto ao disco;
      // o cartão vira uma linha com o prêmio de amanhã, o ponto some e a região viva diz o que entrou
      h.resgata = async (k, tag) => {
        const p = premioDiaria(k), a = await estadoDe(pg), hoje = await h.hoje()
        await h.botao().click()
        const d = await estadoDe(pg)
        const esperado = { gold: a.gold + (p.ouro || 0), redeas: a.redeas + (p.redea || 0), diaria: { prox: k % 7, ciclos: Math.floor(k / 7), ultimo: hoje },
          mochila: Object.fromEntries(Object.keys(a.mochila).map((id) => [id, a.mochila[id] + (p[id] || 0)])) }
        const veio = { gold: d.gold, redeas: d.redeas, diaria: d.diaria, mochila: d.mochila }
        if (!igual(veio, esperado)) problems.push(`${label} ${tag} (resgate ${k}): ${JSON.stringify(veio)} (esperado ${JSON.stringify(esperado)})`)
        if ('redea' in d.mochila) problems.push(`${label} ${tag}: a Rédea nova entrou na mochila`)
        if ((await h.marcaDisco()) !== (await h.marca())) problems.push(`${label} ${tag}: o resgate ${k} não foi gravado junto (Ouro, itens e diária): ${await h.marcaDisco()}`)
        await h.linha(new RegExp('amanhã ' + premioDiaria(k + 1).txt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), tag + ' depois de resgatar')
        if (!(await h.vivo(p.txt)).includes(p.txt)) problems.push(`${label} ${tag}: a região viva não diz o que entrou (${p.txt}): "${await h.vivo()}"`)
        const foco = await pg.evaluate(() => { const e = document.activeElement; return !!(e && e !== document.body && e.closest('#tela .diaria')) })
        if (!foco) problems.push(`${label} ${tag}: depois do resgate o foco saiu do cartão`)
      }
      return h
    }
    // 11a. save novo (o perfil de teste): o cartão grande, o resgate, o dia seguinte sem recarregar, o relógio para trás, os 7
    //      dias abertos e os 28 resgates
    {
      const label = 'itens-diaria'
      const pg = await newPage(browser, VP, label, { query: '?dev=1' })
      const h = diariaHelpers(pg, label)
      try {
        await h.preparar()
        await pg.evaluate(() => { window.__galope.state.gold = 1000 })
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.waitForSelector('#t-estabulo')
        const s0 = await estadoDe(pg), hoje0 = await h.hoje()
        if (!igual(s0.diaria, DIARIA_0)) problems.push(`${label}: o save novo não começa no dia 1 para resgatar: ${JSON.stringify(s0.diaria)}`)
        await h.grande(1, '60 de Ouro', 'save novo')
        // o leitor de tela lê o título, o dia e o prêmio num texto só
        const titulo = await pg.locator('#tela .diaria h2').evaluate((e) => e.textContent.replace(/\s+/g, ' ').trim())
        if (!/^Recompensa do dia\b.*\b1 de 7\b.*60 de Ouro/.test(titulo)) problems.push(`${label}: o título do cartão não lê o dia e o prêmio juntos: "${titulo}"`)
        for (const [vp, tag] of [[VP, '360x780'], [{ width: 360, height: 640 }, '360x640'], [{ width: 1280, height: 800 }, '1280x800']]) {
          await pg.setViewportSize(vp)
          await checkOverflow(pg, `${label} ${tag} cartão grande`)
          await h.ver().click()
          await checkOverflow(pg, `${label} ${tag} 7 dias`)
          await h.ver().click()
        }
        await pg.setViewportSize(VP)
        await h.resgata(1, 'dia 1')
        if ((await estadoDe(pg)).gold !== 1060) problems.push(`${label}: o saldo não somou 60 (${(await estadoDe(pg)).gold})`)
        for (const [vp, tag] of [[VP, '360x780'], [{ width: 360, height: 640 }, '360x640'], [{ width: 1280, height: 800 }, '1280x800']]) {
          await pg.setViewportSize(vp)
          await checkOverflow(pg, `${label} ${tag} cartão de uma linha`)
        }
        await pg.setViewportSize(VP)
        // de novo no mesmo dia: não há botão, e o toque forçado não dá nada
        await h.forcado('mesmo dia')
        await pg.locator('[data-acao="aba"][data-id="correr"]').click()
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await h.linha(/amanhã 1 Torrão de açúcar/, 'voltar ao Estábulo no mesmo dia')
        // Review Focus 2: o dia vira com o jogo aberto (sem recarregar): o cartão volta a ser grande e os limites do dia da loja
        // voltam (a Estrela, comprada hoje, só volta em 7 dias)
        await pg.evaluate((L) => { window.__galope.state.lojaItens = L }, LOJA_TETO(hoje0))
        await h.dev('dev-dia-mais')
        await h.grande(2, '1 Torrão de açúcar', 'Avançar 1 dia')
        const loja = await pg.evaluate(() => { const g = window.__galope, hj = g.hojeDia(); return ['torrao', 'manual', 'cupom', 'estrela'].map((id) => window.Itens.podeComprar(id, g.state.lojaItens, hj, 1e6, 1e6, 0).ok) })
        if (!igual(loja, [true, true, true, false])) problems.push(`${label}: "Avançar 1 dia" e os limites da loja (Torrão, Manual, Cupom, Estrela) ${JSON.stringify(loja)} (esperado os 3 do dia de volta)`)
        await pg.locator('[data-acao="aba"][data-id="loja"]').click()
        await pg.waitForSelector('#t-loja')
        const rotulos = await pg.locator('#tela [data-acao="item-comprar"]').evaluateAll((bs) => bs.map((b) => b.textContent.replace(/\s+/g, ' ').trim()))
        if (rotulos.length !== 4 || rotulos.slice(0, 3).some((t) => t.indexOf('Comprar') !== 0) || rotulos[3].indexOf('Limite de hoje') !== 0) problems.push(`${label}: na Loja do dia seguinte os botões dizem ${JSON.stringify(rotulos)}`)
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.waitForSelector('#t-estabulo')
        await h.resgata(2, 'dia 2')
        if ((await estadoDe(pg)).mochila.torrao !== 1) problems.push(`${label}: o dia 2 não pôs 1 Torrão na mochila`)
        // Review Focus 3: o relógio para trás não libera e não tira nada; o cartão só diz "volte amanhã"
        const antesAtras = await h.marca()
        await h.dev('dev-dia-menos')
        await h.linha(/volte amanhã/, 'voltar 1 dia')
        await h.forcado('relógio para trás')
        if ((await h.marca()) !== antesAtras) problems.push(`${label}: voltar 1 dia mudou o save ${await h.marca()}`)
        await h.dev('dev-dia-mais')   // de volta ao dia do último resgate: ainda não
        await h.linha(/amanhã 100 de Ouro/, 'de volta ao dia do último resgate')
        await h.dev('dev-dia-mais')   // passou do último dia guardado: vale, do dia certo do calendário
        await h.grande(3, '100 de Ouro', 'depois de passar do último dia')
        await h.resgata(3, 'dia 3')
        // "Ver os 7 dias" no meio do calendário (dia 4 para resgatar): os 3 resgatados marcados e o de hoje em destaque
        await h.dev('dev-dia-mais')
        await h.grande(4, '1 Manual de doma', 'dia 4')
        if ((await h.ver().getAttribute('aria-expanded')) !== 'false' || (await pg.locator('#tela .diaria-dia').count()) !== 0) problems.push(`${label}: os 7 dias abertos antes do toque`)
        await h.ver().click()
        const cal = await pg.evaluate(() => ({
          exp: document.querySelector('#tela [data-acao="diaria-ver"]').getAttribute('aria-expanded'),
          foco: document.activeElement && document.activeElement.getAttribute('data-acao'),
          dias: [...document.querySelectorAll('#tela .diaria-dia')].map((d) => ({ txt: d.textContent.replace(/\s+/g, ' ').trim(), feito: d.classList.contains('diaria-dia--feito'), atual: d.getAttribute('aria-current') }))
        }))
        if (cal.exp !== 'true' || cal.foco !== 'diaria-ver') problems.push(`${label}: "Ver os 7 dias" com aria-expanded ${cal.exp} e o foco em ${cal.foco}`)
        const ctlAberto = await h.ver().evaluate((b) => { const id = b.getAttribute('aria-controls'), el = id && document.getElementById(id); return !!el && el.querySelectorAll('.diaria-dia').length })
        if (ctlAberto !== 7) problems.push(`${label}: com os 7 dias abertos, o aria-controls do "Ver os 7 dias" não aponta para a lista (${ctlAberto})`)
        if (cal.dias.length !== 7) problems.push(`${label}: ${cal.dias.length} células nos 7 dias`)
        cal.dias.forEach((d, i) => {
          if (!d.txt.includes('Dia ' + (i + 1)) || !d.txt.includes(PREMIOS_DIARIA[i].txt)) problems.push(`${label}: a célula ${i + 1} diz "${d.txt}" (esperado "Dia ${i + 1}" e "${PREMIOS_DIARIA[i].txt}")`)
          if (d.feito !== (i < 3) || (i < 3 && !/Resgatado/.test(d.txt))) problems.push(`${label}: a célula ${i + 1} ${d.feito ? '' : 'não '}está marcada como resgatada: "${d.txt}"`)
          if ((d.atual !== null) !== (i === 3)) problems.push(`${label}: a célula ${i + 1} com aria-current ${d.atual}`)
        })
        for (const [vp, tag] of [[VP, '360x780'], [{ width: 360, height: 640 }, '360x640'], [{ width: 1280, height: 800 }, '1280x800']]) {
          await pg.setViewportSize(vp)
          await checkOverflow(pg, `${label} ${tag} 7 dias no meio`)
        }
        await pg.setViewportSize(VP)
        await h.ver().click()
        if ((await h.ver().getAttribute('aria-expanded')) !== 'false' || (await pg.locator('#tela .diaria-dia').count()) !== 0) problems.push(`${label}: o 2º toque não fechou os 7 dias`)
        await h.resgata(4, 'dia 4')
        // faltar 3 dias não muda o dia do calendário
        await h.dev('dev-dia-mais', 4)
        await h.grande(5, '150 de Ouro', 'depois de 3 dias sem abrir')
        // os resgates 5 a 28: os 7 dias em sequência, o recomeço no dia 1 e a Estrela só no 28º (não no 7º, 14º e 21º)
        for (let k = 5; k <= 28; k++) {
          if (k > 5) {
            await h.dev('dev-dia-mais')
            await h.grande((k - 1) % 7 + 1, premioDiaria(k).txt, `resgate ${k}`)
          }
          await h.resgata(k, `resgate ${k}`)
          const st = (await estadoDe(pg)).mochila.estrela
          if (st !== (k >= 28 ? 1 : 0)) problems.push(`${label}: depois do resgate ${k}, ${st} Estrela(s) de treino na mochila`)
        }
        await h.dev('dev-dia-mais')
        await h.grande(1, '60 de Ouro', 'o 29º resgate é o dia 1')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 11b. o teto de cada prêmio: mochila com 99 torrões no dia 2 e 999 Rédeas no dia 7 apagam o botão com o motivo e o
    //      calendário não anda; gastando 1 (o Torrão usado em Brasa, a Rédea pela gaveta), resgata
    for (const [label, o, motivo, id] of [
      ['itens-diaria-cheia', { mochila: { ...ZERO_MOCHILA, torrao: G.BAG_MAX }, diaria: { prox: 1, ciclos: 0, ultimo: null } }, /99 Torrões de açúcar/, 'torrao'],
      ['itens-diaria-redeas', { redeas: 999, diaria: { prox: 6, ciclos: 0, ultimo: null } }, /999 Rédeas novas/, 'redea']]) {
      const pg = await newPage(browser, VP, label, saveT4(o))
      const h = diariaHelpers(pg, label), u = usoHelpers(pg, label)
      try {
        await h.preparar()
        const k = o.diaria.prox + 1
        await h.grande(k, PREMIOS_DIARIA[k - 1].txt, 'no teto')
        if (!(await indisp(h.botao()))) problems.push(`${label}: o botão Resgatar não está apagado (aria-disabled)`)
        const m = (await h.botao().getAttribute('data-motivo')) || ''
        if (!motivo.test(m)) problems.push(`${label}: motivo "${m}" (esperado ${motivo})`)
        if (!m || !(await h.texto()).includes(m)) problems.push(`${label}: o motivo "${m}" não está escrito no cartão`)
        const antes = await h.marca()
        await h.botao().click({ force: true })
        if (!(await h.vivo(m)).includes(m)) problems.push(`${label}: o toque não pôs o motivo na região viva`)
        await h.botao().evaluate((b) => { b.removeAttribute('aria-disabled'); b.click() })
        await sleep(100)
        if ((await h.marca()) !== antes || (await h.marcaDisco()) !== antes) problems.push(`${label}: o toque forçado no teto mudou o save: ${await h.marca()} / disco ${await h.marcaDisco()}`)
        if (id === 'torrao') {
          await u.irMochila()
          await u.usarMochila('torrao').click()
          await u.cavalo('m1').click()
          await u.confirmar().click()
          await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
          await pg.waitForSelector('#t-estabulo')
        } else {
          await devAbrir(pg); await pg.fill('#dev-redeas', '998'); await pg.locator('.dev-gaveta [data-acao="dev-redeas"]').click(); await devFechar(pg)
        }
        await h.grande(k, PREMIOS_DIARIA[k - 1].txt, 'gastando 1')
        if (await indisp(h.botao())) problems.push(`${label}: gastando 1, o botão continua apagado`)
        await h.resgata(k, 'gastando 1')
        const s = await estadoDe(pg)
        if ((id === 'redea' ? s.redeas : s.mochila[id]) !== (id === 'redea' ? 999 : G.BAG_MAX)) problems.push(`${label}: depois do resgate ${id} ficou em ${id === 'redea' ? s.redeas : s.mochila[id]}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 11c. a gravação que falha: o resgate volta atrás (nada é dado, o calendário não anda) e o aviso de falha aparece
    {
      const label = 'itens-diaria-falha'
      const pg = await newPage(browser, VP, label, saveT4())
      const h = diariaHelpers(pg, label)
      try {
        await h.preparar()
        await h.grande(1, '60 de Ouro', 'antes da falha')
        const antes = await h.marca(), antesDisco = await h.marcaDisco()
        await pg.evaluate(() => { window.__setOrig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('cheio', 'QuotaExceededError') } })
        await h.botao().click()
        await pg.evaluate(() => { Storage.prototype.setItem = window.__setOrig })
        if ((await h.marca()) !== antes || (await h.marcaDisco()) !== antesDisco) problems.push(`${label}: o resgate sem gravar mudou o save: ${await h.marca()}`)
        if (!((await pg.locator('#tela').textContent()) || '').includes('Não foi possível salvar')) problems.push(`${label}: sem o aviso de falha ao salvar`)
        if (/Você recebeu/.test(await h.vivo())) problems.push(`${label}: a região viva anunciou um prêmio que não foi gravado`)
        await h.grande(1, '60 de Ouro', 'depois da falha')
        await h.resgata(1, 'com a gravação de volta')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 11d. aba velha: duas páginas com o mesmo save; resgata na 1ª; a 2ª, que ainda mostra o botão (sem o evento de outra aba),
    //      não dá o prêmio de novo: sincroniza, adota o save da 1ª e não mostra resultado
    {
      const label = 'itens-diaria-duas-abas'
      const pa = await newPage(browser, VP, label + ' A', saveT4())
      const pb = await pa.context().newPage()
      pb.on('console', (m) => { if (m.type() === 'error') problems.push(`[${label} B] console: ${m.text()}`) })
      pb.on('pageerror', (e) => problems.push(`[${label} B] pageerror: ${e.message}`))
      const ha = diariaHelpers(pa, label + ' A'), hb = diariaHelpers(pb, label + ' B')
      try {
        await ha.preparar()
        await pb.addInitScript(() => window.addEventListener('storage', (e) => e.stopImmediatePropagation(), true))
        await pb.goto(BASE + 'preview.html?dev=1', { waitUntil: 'domcontentloaded' })
        await hb.preparar()
        await ha.resgata(1, 'na 1ª aba')
        const depoisA = await ha.marcaDisco()
        if ((await hb.botao().count()) !== 1) problems.push(`${label}: a 2ª aba já não mostra o Resgatar (o teste não prova nada)`)
        await hb.botao().click()
        await sleep(150)
        if ((await hb.marcaDisco()) !== depoisA || (await hb.marca()) !== depoisA) problems.push(`${label}: o toque na 2ª aba deu o prêmio de novo: ${await hb.marca()} (depois da 1ª: ${depoisA})`)
        if (!/outra aba/.test((await pb.locator('#tela').textContent()) || '')) problems.push(`${label}: a 2ª aba não avisa que o jogo mudou em outra aba`)
        if (/Você recebeu/.test(await hb.vivo())) problems.push(`${label}: a 2ª aba anunciou um prêmio`)
        await hb.linha(/amanhã 1 Torrão de açúcar/, 'a 2ª aba depois de adotar')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pa.context().close()
      }
    }
    // 11e. cores forçadas (o cartão com borda em cor do sistema, o dia de hoje em Highlight) e movimento reduzido (nada se move)
    {
      const label = 'itens-diaria-forcado'
      const pg = await newPage(browser, VP, label, { ...saveT4({ diaria: { prox: 2, ciclos: 0, ultimo: null } }), forcedColors: 'active' })
      try {
        await pg.waitForSelector('#t-estabulo')
        await pg.locator('#tela [data-acao="diaria-ver"]').click()
        const fc = await pg.evaluate(() => {
          const sonda = (c) => { const d = document.createElement('i'); d.style.border = '2px solid ' + c; document.body.appendChild(d); const v = getComputedStyle(d).borderTopColor; d.remove(); return v }
          const borda = (e) => { const cs = getComputedStyle(e); return { w: cs.borderTopWidth, s: cs.borderTopStyle, c: cs.borderTopColor } }
          return { ativo: matchMedia('(forced-colors: active)').matches, hl: sonda('Highlight'), sis: ['CanvasText', 'ButtonText', 'GrayText'].map(sonda),
            cartao: borda(document.querySelector('#tela .diaria')), hoje: [...document.querySelectorAll('#tela .diaria-dia[aria-current]')].map(borda),
            outros: [...document.querySelectorAll('#tela .diaria-dia:not([aria-current])')].map(borda) }
        })
        if (!fc.ativo) problems.push(`[${label}] a página não está em cores forçadas`)
        if (fc.cartao.w !== '2px' || fc.cartao.s !== 'solid' || !fc.sis.includes(fc.cartao.c)) problems.push(`[${label}] o cartão sem borda de 2 px em cor do sistema ${JSON.stringify(fc.cartao)} (${fc.sis.join(' / ')})`)
        if (fc.hoje.length !== 1 || fc.hoje[0].c !== fc.hl || fc.hoje[0].w !== '2px') problems.push(`[${label}] o dia de hoje sem a borda em Highlight ${JSON.stringify(fc.hoje)} (Highlight = ${fc.hl})`)
        if (fc.outros.length !== 6 || fc.outros.some((b) => b.w !== '2px' || !fc.sis.includes(b.c))) problems.push(`[${label}] os outros dias sem borda em cor do sistema ${JSON.stringify(fc.outros)}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      const label = 'itens-diaria-reduzido'
      const pg = await newPage(browser, VP, label, { ...saveT4(), reducedMotion: 'reduce' })
      // nada no cartão anima nem tem transição (no cartão grande, com os 7 dias abertos e no de uma linha)
      const parado = async (tag) => {
        const r = await pg.evaluate(() => {
          const c = document.querySelector('#tela .diaria'), els = c ? [c, ...c.querySelectorAll('*')] : []
          return { n: els.length, anim: document.getAnimations().filter((a) => a.effect && a.effect.target && c && c.contains(a.effect.target)).length,
            css: els.filter((e) => { const cs = getComputedStyle(e); return cs.animationName !== 'none' || cs.transitionDuration.split(',').some((t) => parseFloat(t) > 0) }).map((e) => e.className) }
        })
        if (!r.n || r.anim || r.css.length) problems.push(`[${label}] ${tag}: algo se move no cartão ${JSON.stringify(r)}`)
      }
      try {
        await pg.waitForSelector('#t-estabulo')
        await parado('cartão grande')
        await pg.locator('#tela [data-acao="diaria-ver"]').click()
        await parado('7 dias abertos')
        await pg.locator('#tela [data-acao="diaria-resgatar"]').click()
        await parado('cartão de uma linha')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 12. regras de dinheiro sem teste até a revisão final (E1 a E4): a sala aberta com o ativo de pontos todos gastos, as
    //     quatro compras na tela, a compra com a gravação falhando e os pontos de Torrão e Estrela gastos e recarregados
    // 12a. sala aberta, o ativo com TODOS os pontos gastos (o Poder dele é o da sala): Torrão e Estrela dão pontos novos, que
    //      são os únicos que sobram; nenhum +N abre, o sugerido forçado não grava e a sala e o resultado não mudam, nem
    //      depois de recarregar
    {
      const label = 'itens-usar-sala-cheio'
      const m1 = cav(brasa, { uid: 'm1', level: 12, skills: ['sprint'], torroes: 0 })
      m1.alloc = S.botAlloc(m1)
      const pg = await newPage(browser, VP, label, saveT4({ mochila: { ...ZERO_MOCHILA, torrao: 2, estrela: 1 }, mounts: [m1, SAVE_T4.mounts[1]], nextUid: 3 }))
      const h = usoHelpers(pg, label)
      try {
        await pg.waitForSelector('#t-estabulo')
        const i0 = S.allocInfo(await h.mount('m1'))
        if (i0.left !== 0 || !(i0.used > 0)) problems.push(`${label}: o preparo não tem os pontos todos gastos ${JSON.stringify({ left: i0.left, used: i0.used })} (o teste não prova nada)`)
        await abrirSala(pg, 50)
        const pend = (await h.estado()).pending, sim0 = await simSala(pg)
        if (pend.pr !== S.powerRating(await h.mount('m1'))) problems.push(`${label}: o Poder da sala ${pend.pr} não é o do ativo ${S.powerRating(await h.mount('m1'))}`)
        await pg.getByRole('button', { name: /^Voltar/ }).click()
        await pg.waitForSelector('#t-correr')
        await h.ficha('m1')
        for (const id of ['torrao', 'torrao', 'estrela']) { await h.usarFicha(id).click(); await h.confirmar().click() }
        let a = await h.mount('m1')
        const i1 = S.allocInfo(a)
        if (a.torroes !== 2 || a.grau !== 3 || !(i1.left > 0) || i1.used !== i0.used) problems.push(`${label}: depois de 2 Torrões e 1 Estrela: torroes ${a.torroes}, grau ${a.grau}, sobram ${i1.left}, gastos ${i1.used}`)
        const mais = await pg.locator('#tela [data-acao="ponto-mais"]').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-disabled') === 'true'))
        if (!mais.length || mais.some((x) => !x)) problems.push(`${label}: com o Poder igual ao da sala, ${mais.filter((x) => !x).length} de ${mais.length} botões +N abertos (esperado nenhum, e algum na tela)`)
        await pg.evaluate(() => { document.querySelectorAll('#tela [data-acao="ponto-mais"]').forEach((b) => { b.removeAttribute('aria-disabled'); b.click() }) })
        await sleep(100)
        if ((await pg.evaluate(() => JSON.stringify(window.__galope.ui.rascunho))) !== 'null') problems.push(`${label}: os +N forçados montaram um rascunho ${await pg.evaluate(() => JSON.stringify(window.__galope.ui.rascunho))}`)
        const sug = pg.locator('#tela [data-acao="pontos-sugerir"]')
        if ((await sug.count()) !== 1) problems.push(`${label}: sem o "Distribuir sugerido" (a tentativa de passar do Poder da sala não rodou)`)
        await sug.evaluate((b) => { b.removeAttribute('aria-disabled'); b.click() })
        await esperaBarra(pg)
        const cf = pg.locator('#tela [data-acao="pontos-confirmar"]')
        if ((await cf.count()) !== 1 || !(await indisp(cf)) || !/Páreo aberto/.test((await cf.getAttribute('data-motivo')) || '')) problems.push(`${label}: o Confirmar do sugerido não está apagado com o motivo do páreo aberto (${await cf.count()}, ${await cf.getAttribute('data-motivo').catch(() => '')})`)
        for (let k = 0; k < 2; k++) await cf.evaluate((b) => { b.removeAttribute('aria-disabled'); b.click() }).catch(() => {})
        await sleep(100)
        a = await h.mount('m1')
        const d = await h.disco(), dm = d.mounts.find((m) => m.uid === 'm1')
        if (!igual(a.alloc, m1.alloc) || !igual(dm.alloc, m1.alloc)) problems.push(`${label}: o sugerido forçado gravou pontos: memória ${JSON.stringify(a.alloc)}, disco ${JSON.stringify(dm.alloc)} (antes ${JSON.stringify(m1.alloc)})`)
        if (S.powerRating(a) > pend.pr) problems.push(`${label}: o Poder do ativo passou do da sala (${S.powerRating(a)} > ${pend.pr})`)
        if (!igual((await h.estado()).pending, pend) || !igual(d.pending, pend)) problems.push(`${label}: a sala guardada mudou ${JSON.stringify((await h.estado()).pending)}`)
        if ((await simSala(pg)) !== sim0) problems.push(`${label}: o resultado da corrida aberta mudou`)
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        if (!igual((await h.estado()).pending, pend)) problems.push(`${label}: depois de recarregar, a sala mudou ${JSON.stringify((await h.estado()).pending)} (antes ${JSON.stringify(pend)})`)
        if ((await simSala(pg)) !== sim0) problems.push(`${label}: depois de recarregar, o resultado da corrida aberta mudou`)
        if (!igual((await h.mount('m1')).alloc, m1.alloc)) problems.push(`${label}: depois de recarregar, os pontos do ativo mudaram ${JSON.stringify((await h.mount('m1')).alloc)}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 12b. as quatro compras na tela, cada uma conferida no saldo, na mochila, no limite e no disco ("Restam 0 de 1 hoje" no
    //      Manual e no Cupom); e a compra com a gravação falhando: nada muda na memória nem no disco, o aviso de falha aparece
    //      e nenhum item entra; com a gravação de volta, compra
    {
      const label = 'itens-loja-compras'
      const pg = await newPage(browser, VP, label, saveT4())
      const bt = (id) => pg.locator(`#tela [data-acao="item-comprar"][data-id="${id}"]`)
      const linhaTxt = async (id) => ((await pg.locator(`#tela .item-linha--produto[data-item="${id}"]`).textContent()) || '').replace(/\s+/g, ' ')
      const marca = (s) => JSON.stringify({ gold: s.gold, mochila: s.mochila, lojaItens: s.lojaItens, redeas: s.redeas, pending: s.pending })
      try {
        await pg.waitForSelector('#t-estabulo')
        await devAbrir(pg); await pg.setChecked('#dev-ouroinf', false); await devFechar(pg)
        await pg.locator('[data-acao="aba"][data-id="loja"]').click()
        await pg.waitForSelector('#t-loja')
        const hoje = await pg.evaluate(() => window.__galope.hojeDia())
        let gold = (await estadoDe(pg)).gold
        if (gold !== 5000) problems.push(`${label}: o preparo tem ${gold} de Ouro (esperado 5.000)`)
        for (const [id, limite] of [['torrao', /Restam 1 de 2 hoje/], ['manual', /Restam 0 de 1 hoje/], ['cupom', /Restam 0 de 1 hoje/], ['estrela', /de novo em 7 dias/]]) {
          const a = await estadoDe(pg)
          await bt(id).click()
          const s = await estadoDe(pg), d = JSON.parse(await bruto(pg, DEVK))
          gold -= G.ITEMS[id].price
          const esperado = Object.assign({}, a.mochila, { [id]: a.mochila[id] + 1 })
          if (s.gold !== gold || !igual(s.mochila, esperado)) problems.push(`${label} ${id}: Ouro ${a.gold} -> ${s.gold} (esperado ${gold}), mochila ${JSON.stringify(s.mochila)} (esperado ${JSON.stringify(esperado)})`)
          if (id === 'estrela' ? s.lojaItens.estrelaDia !== hoje : s.lojaItens.comprados[id] !== a.lojaItens.comprados[id] + 1 || s.lojaItens.dia !== hoje) problems.push(`${label} ${id}: o limite gravado ${JSON.stringify(s.lojaItens)}`)
          if (marca(d) !== marca(s)) problems.push(`${label} ${id}: a compra não foi gravada junto (disco ${marca(d)})`)
          if (!limite.test(await linhaTxt(id))) problems.push(`${label} ${id}: depois da compra a linha diz "${await linhaTxt(id)}" (esperado ${limite})`)
          if (id !== 'torrao' && ((await bt(id).textContent()) || '').trim().indexOf('Limite de hoje') !== 0) problems.push(`${label} ${id}: depois da única compra do dia o botão diz "${((await bt(id).textContent()) || '').trim()}"`)
        }
        // a gravação falhando: o 2º Torrão do dia
        const antes = marca(await estadoDe(pg)), antesDisco = await bruto(pg, DEVK)
        await pg.evaluate(() => { window.__setOrig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('cheio', 'QuotaExceededError') } })
        await bt('torrao').click()
        await pg.evaluate(() => { Storage.prototype.setItem = window.__setOrig })
        if (marca(await estadoDe(pg)) !== antes) problems.push(`${label}: a compra com a gravação falhando mudou a memória ${marca(await estadoDe(pg))} (antes ${antes})`)
        if ((await bruto(pg, DEVK)) !== antesDisco) problems.push(`${label}: a compra com a gravação falhando mudou o disco`)
        const aviso = (await pg.locator('#tela .item-linha--produto[data-item="torrao"] .item-aviso').textContent().catch(() => '')) || ''
        if (!/Não foi possível salvar/.test(aviso) || /Comprou/.test((await pg.locator('#tela').textContent()) || '')) problems.push(`${label}: o aviso da compra com a gravação falhando: "${aviso}"`)
        await pg.waitForFunction(() => /Não foi possível salvar/.test(document.getElementById('motivo-vivo').textContent), null, { timeout: 3000 }).catch(() => problems.push(`${label}: a região viva não diz que não salvou`))
        if (!/Restam 1 de 2 hoje/.test(await linhaTxt('torrao'))) problems.push(`${label}: depois da falha o limite diz "${await linhaTxt('torrao')}"`)
        await bt('torrao').click()
        const s = await estadoDe(pg), d = JSON.parse(await bruto(pg, DEVK))
        if (s.mochila.torrao !== 2 || s.gold !== gold - G.ITEMS.torrao.price || marca(d) !== marca(s)) problems.push(`${label}: com a gravação de volta, a compra ${JSON.stringify({ torrao: s.mochila.torrao, gold: s.gold })}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 12c. os pontos que o Torrão e a Estrela deram, depois de GASTOS, continuam depois de recarregar e depois de adotar o save
    //      de outra aba (os torrões e as estrelas entram no cavalo antes de os pontos guardados serem conferidos)
    {
      const label = 'itens-pontos-recarregar'
      const m1 = cav(brasa, { uid: 'm1', level: 5, skills: [], torroes: 0 })
      const pg = await newPage(browser, VP, label, saveT4({ mochila: { ...ZERO_MOCHILA, torrao: 2, estrela: 1 }, mounts: [m1, SAVE_T4.mounts[1]], nextUid: 3 }))
      const h = usoHelpers(pg, label)
      try {
        await pg.waitForSelector('#t-estabulo')
        await h.ficha('m1')
        for (const id of ['torrao', 'torrao', 'estrela']) { await h.usarFicha(id).click(); await h.confirmar().click() }
        let a = await h.mount('m1')
        const livres = S.freePoints(a), semItens = S.freePoints({ ...a, torroes: 0, grau: m1.grau })
        if (a.torroes !== 2 || a.grau !== 3 || !(livres > semItens)) problems.push(`${label}: depois dos itens: torroes ${a.torroes}, grau ${a.grau}, pontos ${semItens} -> ${livres}`)
        // gasta todos os pontos, 1 de cada vez, em 6 status
        const ks = ['vel', 'acel', 'man', 'forca', 'est', 'garra']
        for (let i = 0; i < livres; i++) {
          await pg.locator(`#tela [data-acao="ponto-mais"][data-id="${ks[i % ks.length]}"][data-n="1"]`).click()
          if (i === 0) await esperaBarra(pg)
        }
        await pg.locator('#tela [data-acao="pontos-confirmar"]').click()
        await pg.locator('#tela [data-acao="pontos-confirmar"]').click()
        a = await h.mount('m1')
        const gastos = JSON.stringify(a.alloc), info = S.allocInfo(a)
        if (info.used !== livres || info.left !== 0) problems.push(`${label}: os ${livres} pontos não foram todos gastos (gastos ${info.used}, sobram ${info.left})`)
        if (!(info.used > semItens)) problems.push(`${label}: os pontos gastos (${info.used}) não passam dos de sem os itens (${semItens}): o teste não prova nada`)
        if (JSON.stringify((await h.disco()).mounts.find((m) => m.uid === 'm1').alloc) !== gastos) problems.push(`${label}: os pontos gastos não foram gravados`)
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        a = await h.mount('m1')
        if (JSON.stringify(a.alloc) !== gastos || a.torroes !== 2 || a.grau !== 3) problems.push(`${label}: depois de recarregar, os pontos ${JSON.stringify(a.alloc)} (antes ${gastos}), torroes ${a.torroes}, grau ${a.grau}`)
        // o save de outra aba (o mesmo, com 1 de Ouro a mais) chega pelo evento storage e é adotado
        await pg.evaluate((k) => { const x = JSON.parse(localStorage.getItem(k)); x.rev += 10; x.gold += 1; const raw = JSON.stringify(x); localStorage.setItem(k, raw); window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: raw })) }, DEVK)
        await pg.waitForFunction((g) => window.__galope.state.gold === g, (await h.disco()).gold, { timeout: 3000 }).catch(() => problems.push(`${label}: o save da outra aba não foi adotado`))
        a = await h.mount('m1')
        if (JSON.stringify(a.alloc) !== gastos) problems.push(`${label}: depois de adotar o save de outra aba, os pontos ${JSON.stringify(a.alloc)} (antes ${gastos})`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 13. o dia vira com o jogo aberto (decisão 19 do controlador): sem temporizador, a tela é desenhada de novo quando a aba volta
    //     a ficar visível e no começo de um toque (e esse toque não vale: o alvo era da tela de ontem); nunca na corrida. O relógio
    //     do navegador é o do Playwright (page.clock), no fuso de São Paulo; o deslocamento de dias da gaveta DEV fica em 0.
    const FUSO = { timezoneId: 'America/Sao_Paulo' }
    const D17 = IT.diaLocal(2026, 10, 17)
    // a aba sai de vista e volta (o navegador sem janela nunca esconde a aba: o estado e o evento são simulados)
    const visibilidade = (pg, v) => pg.evaluate((v) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); document.dispatchEvent(new Event('visibilitychange')) }, v)
    const vivoTem = (pg, re) => pg.waitForFunction((src) => new RegExp(src).test(document.getElementById('motivo-vivo').textContent), re.source, { timeout: 3000 }).then(() => true, () => false)
    // 13a. resgata às 23:58; a aba sai de vista; 00:01; a aba volta: o cartão grande e o ponto na aba, sem recarregar nem navegar
    {
      const label = 'itens-virada-aba'
      const pg = await newPage(browser, VP, label, { query: '?dev=1', ...FUSO, relogio: new Date('2026-11-17T23:58:00-03:00') })
      const h = diariaHelpers(pg, label)
      try {
        await h.preparar()   // o perfil de teste novo (o deslocamento de dias da gaveta fica em 0: o dia é o do relógio)
        if ((await h.hoje()) !== D17) problems.push(`${label}: o dia do jogo é ${await h.hoje()} (esperado ${D17}, o relógio do teste)`)
        await h.botao().click()
        await h.linha(/amanhã 1 Torrão de açúcar/, 'resgatado às 23:58')
        await pg.evaluate(() => { window.__semRecarregar = true })
        await visibilidade(pg, 'hidden')
        await pg.clock.setSystemTime(new Date('2026-11-18T00:01:00-03:00'))
        await visibilidade(pg, 'visible')
        await pg.waitForFunction(() => !!document.querySelector('#tela .diaria--grande'), null, { timeout: 3000 }).catch(() => problems.push(`${label}: ao voltar à aba no dia seguinte, o cartão não voltou a ser grande`))
        await h.grande(2, '1 Torrão de açúcar', 'ao voltar à aba no dia seguinte')
        const onde = await pg.evaluate(() => ({ mesma: window.__semRecarregar === true, tela: window.__galope.ui.screen }))
        if (!onde.mesma || onde.tela !== 'estabulo') problems.push(`${label}: a volta à aba recarregou ou navegou ${JSON.stringify(onde)}`)
        if (!(await vivoTem(pg, /Virou o dia/))) problems.push(`${label}: a região viva não diz que o dia virou`)
        await h.resgata(2, 'o resgate do dia novo')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 13b. a Loja no limite do Torrão (com o aviso da compra); o dia vira sem a aba sair de vista; o toque em "Limite de hoje"
    //      desenha a tela de novo (o botão volta a "Comprar", o aviso de ontem some) e não compra nada; o toque seguinte compra
    {
      const label = 'itens-virada-loja'
      const save = Object.assign({}, SAVE_T4, { lojaItens: { dia: D17, comprados: { torrao: 1, manual: 0, cupom: 0 }, estrelaDia: null }, diaria: { prox: 1, ciclos: 0, ultimo: D17 } })
      const pg = await newPage(browser, VP, label, { ...comSave(REAL, JSON.stringify(save)), ...FUSO, relogio: new Date('2026-11-17T23:58:00-03:00') })
      const bt = () => pg.locator('#tela [data-acao="item-comprar"][data-id="torrao"]')
      const txt = async () => ((await bt().textContent()) || '').replace(/\s+/g, ' ').trim()
      const linhaTxt = async () => ((await pg.locator('#tela .item-linha--produto[data-item="torrao"]').textContent()) || '').replace(/\s+/g, ' ')
      const marca = (s) => JSON.stringify({ gold: s.gold, mochila: s.mochila, lojaItens: s.lojaItens })
      try {
        await pg.waitForSelector('#t-estabulo')
        await pg.locator('[data-acao="aba"][data-id="loja"]').click()
        await pg.waitForSelector('#t-loja')
        await bt().click()   // o 2º Torrão do dia: o limite
        if (!/Comprou 1 Torrão/.test((await pg.locator('#tela .item-linha--produto[data-item="torrao"] .item-aviso').textContent().catch(() => '')) || '')) problems.push(`${label}: sem o aviso da compra antes da virada`)
        if ((await txt()).indexOf('Limite de hoje') !== 0) problems.push(`${label}: antes da virada o botão diz "${await txt()}" (esperado "Limite de hoje")`)
        await pg.clock.setSystemTime(new Date('2026-11-18T00:01:00-03:00'))
        const antes = marca(await estadoDe(pg)), antesDisco = await bruto(pg, REAL)
        await bt().click({ force: true })   // o toque no botão apagado de ontem
        await pg.waitForFunction(() => { const b = document.querySelector('#tela [data-acao="item-comprar"][data-id="torrao"]'); return !!b && /^\s*Comprar/.test(b.textContent) }, null, { timeout: 3000 }).catch(() => problems.push(`${label}: o toque depois da virada não desenhou a Loja do dia novo (o botão diz "Limite de hoje")`))
        if (marca(await estadoDe(pg)) !== antes || (await bruto(pg, REAL)) !== antesDisco) problems.push(`${label}: o toque da virada comprou ou gravou: ${marca(await estadoDe(pg))} (antes ${antes})`)
        if (await pg.locator('#tela .item-aviso').count()) problems.push(`${label}: o aviso da compra de ontem continua na tela`)
        if (!/Restam 2 de 2 hoje/.test(await linhaTxt())) problems.push(`${label}: depois da virada a linha diz "${await linhaTxt()}"`)
        if (!(await vivoTem(pg, /Virou o dia/))) problems.push(`${label}: a região viva não diz que o dia virou`)
        const foco = await pg.evaluate(() => { const e = document.activeElement; return e && e.getAttribute('data-acao') + ':' + e.getAttribute('data-id') })
        if (foco !== 'item-comprar:torrao') problems.push(`${label}: depois da virada o foco ficou em ${foco}`)
        await bt().click()
        const s = await estadoDe(pg), d = JSON.parse(await bruto(pg, REAL))
        if (s.mochila.torrao !== 2 || s.gold !== 5000 - 2 * G.ITEMS.torrao.price || s.lojaItens.dia !== D17 + 1 || s.lojaItens.comprados.torrao !== 1 || marca(d) !== marca(s)) problems.push(`${label}: o toque seguinte não comprou no dia novo: ${marca(s)} (disco ${marca(d)})`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 13c. o dia vira durante a corrida (a aba sai de vista e volta, e um toque na pista): a corrida segue (a mesma, na tela) e o
    //      resultado é o simulado com a sala antes da largada; depois do resultado, o Estábulo já é o do dia novo
    {
      const label = 'itens-virada-corrida'
      const save = Object.assign({}, SAVE_T4, { diaria: { prox: 1, ciclos: 0, ultimo: D17 } })
      const pg = await newPage(browser, VP, label, { ...comSave(REAL, JSON.stringify(save)), ...FUSO, relogio: new Date('2026-11-17T23:59:00-03:00') })
      const h = diariaHelpers(pg, label)
      try {
        await pg.waitForSelector('#t-estabulo')
        await abrirSala(pg, 50)
        const esperado = await simSala(pg)
        await pg.getByRole('button', { name: /^Largar/ }).click()
        await pg.waitForSelector('#pista')
        await pg.evaluate(() => { window.__corrida0 = window.__galope.race })
        await visibilidade(pg, 'hidden')
        await pg.clock.setSystemTime(new Date('2026-11-18T00:01:00-03:00'))
        await visibilidade(pg, 'visible')
        await pg.locator('#pista').click()
        await sleep(200)
        const durante = await pg.evaluate(() => ({ tela: window.__galope.ui.screen, mesma: !!window.__corrida0 && window.__galope.race === window.__corrida0, hoje: window.__galope.hojeDia() }))
        if (durante.tela !== 'corrida' || !durante.mesma) problems.push(`${label}: a virada do dia mexeu na corrida ${JSON.stringify(durante)}`)
        if (durante.hoje !== D17 + 1) problems.push(`${label}: o relógio não virou o dia (${durante.hoje}): o teste não prova nada`)
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado')
        const veio = await pg.evaluate(() => { const L = window.__galope.ui.lobby; return JSON.stringify({ seed: L.seed, ordem: L.sim.finishOrder, tempos: L.sim.finishTimes }) })
        if (veio !== esperado) problems.push(`${label}: o resultado da corrida ${veio} não é o simulado antes da largada ${esperado}`)
        await pg.locator('#tela [data-acao="voltar"]').first().click()
        await pg.waitForSelector('#t-correr')
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.waitForSelector('#t-estabulo')
        await h.grande(2, '1 Torrão de açúcar', 'depois da corrida, no dia novo')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 14. dado de dia corrompido num save v8 (decisões 8 e 21): ao abrir, o disco recebe o valor consertado (o dia de hoje); no
    //     dia seguinte, abrindo sem fazer mais nada, o cartão está para resgatar e o Torrão à venda
    {
      const label = 'itens-dia-corrompido'
      const save = Object.assign({}, SAVE_T4, { rev: 20, diaria: { prox: 2, ciclos: 0, ultimo: 'x' }, lojaItens: { dia: 'x', comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: 'x' } })
      const pg = await newPage(browser, VP, label, { ...comSave(REAL, JSON.stringify(save)), ...FUSO, relogio: new Date('2026-11-17T10:00:00-03:00') })
      const h = diariaHelpers(pg, label)
      try {
        await pg.waitForSelector('#t-estabulo')
        const d = JSON.parse(await bruto(pg, REAL))
        if (d.diaria.ultimo !== D17 || d.lojaItens.dia !== D17 || d.lojaItens.estrelaDia !== D17 || !(d.rev > 20)) problems.push(`${label}: ao abrir, o disco ficou com ${JSON.stringify({ diaria: d.diaria, loja: d.lojaItens, rev: d.rev })} (esperado o dia ${D17} gravado)`)
        if (d.diaria.prox !== 2 || d.mochila.torrao !== 0 || d.gold !== SAVE_T4.gold) problems.push(`${label}: o conserto mexeu em outra coisa ${JSON.stringify({ prox: d.diaria.prox, mochila: d.mochila, gold: d.gold })}`)
        await h.linha(/amanhã 100 de Ouro/, 'no dia do conserto')
        await pg.clock.setSystemTime(new Date('2026-11-18T10:00:00-03:00'))
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        await h.grande(3, '100 de Ouro', 'no dia seguinte, sem outra ação')
        const loja = await pg.evaluate(() => { const g = window.__galope, hj = g.hojeDia(); return ['torrao', 'estrela'].map((id) => window.Itens.podeComprar(id, g.state.lojaItens, hj, 1e6, 1e6, 0).ok) })
        if (!igual(loja, [true, false])) problems.push(`${label}: no dia seguinte, Torrão e Estrela à venda ${JSON.stringify(loja)} (esperado o Torrão sim; a Estrela só 7 dias depois do conserto)`)
        // um save v8 bom não é regravado ao abrir
        const bom = JSON.stringify(Object.assign({}, SAVE_T4, { rev: 70, diaria: { prox: 2, ciclos: 0, ultimo: D17 }, lojaItens: { dia: D17, comprados: { torrao: 1, manual: 0, cupom: 0 }, estrelaDia: null } }))
        await pg.evaluate(([k, raw]) => localStorage.setItem(k, raw), [REAL, bom])
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        await sleep(300)
        if ((await bruto(pg, REAL)) !== bom) problems.push(`${label}: um save v8 sem nada para consertar foi regravado ao abrir`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
  }

  // ---------------- Ginásios da Expedição (spec 2026-11-17-ginasios §9, §14, §15, §16) ----------------
  // Tarefa 3: save versão 8 (novo, migrado da 7 com sala aberta, lixo, insígnia sem as cinco etapas, versão 9 bloqueia), os
  // bônus das insígnias (Ouro no prêmio da corrida valendo, XP em todo XP somado, chance de skill por nível; nada na
  // simulação) e a gaveta DEV "Ginásios". As próximas tarefas crescem este bloco com os ajudantes gin* abaixo.
  const GN = require('../src/ginasio.js')
  const GIN_REAL = 'galope-elemental:v1', GIN_DEV = 'galope-elemental:dev'
  const GIN_ZERO = GN.sanear(null, 0)   // os três ginásios sem nada: { etapa: 0, revDia: null, revVitorias: 0 }
  // abre a página com o save (objeto ou texto) gravado na chave antes de o jogo carregar, uma vez só (recarregar não
  // regrava: o que fica é o que o jogo deixou). Padrão: o build de teste (jogo-dev.html) e o save de teste.
  const ginAbre = async (label, { save = null, chave = GIN_DEV, pagina = 'jogo-dev.html', vp = { width: 360, height: 780 }, espera = '#t-estabulo', ...extra } = {}) => {
    const raw = save == null ? null : (typeof save === 'string' ? save : JSON.stringify(save))
    const init = raw == null ? null : { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); localStorage.setItem(${JSON.stringify(chave)}, ${JSON.stringify(raw)}) } } catch (e) {}` }
    const pg = await newPage(browser, vp, label, { pagina, ...(init ? { init } : {}), ...extra })
    if (espera) await pg.waitForSelector(espera, { timeout: 8000 }).catch(() => problems.push(`[${label}] a página não chegou a ${espera}`))
    return pg
  }
  const ginEstado = (pg) => pg.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
  const ginDisco = (pg, chave = GIN_DEV) => pg.evaluate((k) => localStorage.getItem(k), chave)
  const ginHoje = (pg) => pg.evaluate(() => window.__galope.hojeDia())
  const ginBonus = (pg) => pg.evaluate(() => window.__galope.bonusConta())
  // gaveta DEV, grupo "Ginásios": etapas = { fogo: 0–5, … } (só os dados mudam); acao: 'revanche' | 'zerar'
  const ginDevEtapas = async (pg, etapas) => {
    await devAbrir(pg)
    for (const [id, e] of Object.entries(etapas)) await pg.selectOption('#dev-gin-' + id, String(e))
    await pg.locator('[data-acao="dev-gin-etapas"]').click()
    await devFechar(pg)
  }
  const ginDevAcao = async (pg, acao) => {
    await devAbrir(pg)
    await pg.locator(`[data-acao="dev-gin-${acao}"]`).click()
    await devFechar(pg)
  }
  // "Ouro infinito" da gaveta (ligado ao abrir o build de teste): desligado, o Ouro do save é o que a regra deu
  const ginOuroInf = async (pg, on) => { await devAbrir(pg); await pg.setChecked('#dev-ouroinf', on); await devFechar(pg) }
  // a corrida da sala aberta simulada de novo do save (sem gravar nada): ordem, tempos e eventos
  const ginSimSala = (pg) => pg.evaluate(() => {
    const g = window.__galope, L = g.buildLobby(g.state.pending)
    const r = window.RaceSim.simulate({ seed: L.seed, conditions: L.cond, racers: L.racers.map((x) => ({ horse: x.horse, gear: x.gear, name: x.name, isPlayer: x.isPlayer })) })
    return JSON.stringify({ seed: L.seed, ordem: r.finishOrder, tempos: r.finishTimes, eventos: r.events })
  })
  // seed do save: no 1º páreo (contador 1) a Brasa sobe do nível 10 ao 11 e o sorteio da skill desse nível cai entre 8% e
  // 11% (sem a insígnia de Grama não aprende; com ela, aprende), e ela chega num lugar pago com prêmio de 34 ou mais
  // (o +3% de Ouro aparece). Conferido abaixo: se o pareamento mudar, o teste diz qual condição deixou de valer.
  const GIN_SEED = 79
  const ginBrasa = G.STARTERS.find((h) => h.id === 'brasa'), ginMare = G.STARTERS.find((h) => h.id === 'mare')
  const ginCav = (tpl, o) => Object.assign({ uid: 'm1', templateId: tpl.id, name: tpl.name, especie: 'cavalo', element: tpl.element, rarity: tpl.rarity,
    grau: tpl.grau || 2, sex: tpl.sex, level: 1, xp: 0, skills: tpl.skills.slice(), potential: JSON.parse(JSON.stringify(tpl.potential)),
    palette: JSON.parse(JSON.stringify(tpl.palette)), breedLeft: 2, parents: null, born: 0, equip: {}, respecFree: false, torroes: 0,
    alloc: { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 } }, o)
  // um save versão 8 completo (o:  campos trocados)
  const ginSave = (o = {}) => Object.assign({
    v: 8, rev: 5, gold: 5000, tier: 50, seedBase: GIN_SEED, raceCounter: 0, pending: null, races: 0, wins: 0, podiums: 0, goldWon: 0,
    mounts: [ginCav(ginBrasa, { uid: 'm1', level: 10, xp: 295 }), ginCav(ginMare, { uid: 'm2', level: 4 })],
    activeId: 'm1', nextUid: 3, stableSlots: 3, breedCounter: 0, items: [], nextItemUid: 1, pedras: 0, enhanceCounter: 0,
    redeas: 0, avisoV6: false, mochila: { torrao: 0, estrela: 0, cupom: 0, manual: 0 }, diaria: { prox: 0, ciclos: 0, ultimo: null },
    lojaItens: { dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null }, itemCounter: 0,
    ginasios: JSON.parse(JSON.stringify(GIN_ZERO)), gymCounter: 0,
    settings: { motion: 'sistema' }, joquei: { padrao: G.JOQUEI.padrao, capacete: G.JOQUEI.capacete }
  }, o)
  // o applyXp do jogo, no node: XP somado, níveis (até o máximo de G.ECONOMY, com o XP no teto dele) e a skill sorteada
  // por nível (seedTag: o nº do páreo, ou o do desafio de ginásio)
  const ginApplyXp = (m0, ganho, seedBase, seedTag, bonusSkill) => {
    const m = JSON.parse(JSON.stringify(m0)), learned = [], MAX = G.ECONOMY.maxLevel
    let levels = 0
    m.xp += ganho
    while (m.level < MAX && m.xp >= G.ECONOMY.xpToLevel(m.level)) { m.xp -= G.ECONOMY.xpToLevel(m.level); m.level += 1; levels += 1 }
    if (m.level >= MAX) m.xp = Math.min(m.xp, G.ECONOMY.xpToLevel(m.level))
    for (let k = 1; k <= levels; k++) {
      const rng = S.mulberry32(S.hash2(seedBase, seedTag * 100 + (m.level - levels + k)))
      const sid = S.learnSkill({ id: m.templateId, element: m.element, rarity: m.rarity, skills: m.skills }, rng, bonusSkill)
      if (sid) { m.skills.push(sid); learned.push(sid) }
    }
    return { m, levels, learned }
  }
  const ginIgual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  if (quer('ginasio')) {
    const VP = { width: 360, height: 780 }
    // 1. save novo (jogo real e build de teste): versão 8, ginásios zerados, contador 0, na memória e no disco
    for (const [label, pagina, chave] of [['ginasio-novo', 'preview.html', GIN_REAL], ['ginasio-novo-dev', 'jogo-dev.html', GIN_DEV]]) {
      const pg = await ginAbre(label, { pagina, chave, espera: pagina === 'preview.html' ? '.inicial' : '#t-estabulo' })
      try {
        if (pagina === 'preview.html') {
          await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
          await pg.waitForSelector('#t-estabulo')
        }
        const disco = JSON.parse(await ginDisco(pg, chave))
        for (const [onde, s] of [['memória', await ginEstado(pg)], ['disco', disco]]) {
          if (s.v !== 8 || !ginIgual(s.ginasios, GIN_ZERO) || s.gymCounter !== 0) problems.push(`${label} (${onde}): ` + JSON.stringify({ v: s.v, ginasios: s.ginasios, gymCounter: s.gymCounter }))
        }
        if (!ginIgual(await ginBonus(pg), { ouro: 0, xp: 0, skill: 0 })) problems.push(`${label}: bônus sem insígnia ` + JSON.stringify(await ginBonus(pg)))
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 2. migração da versão 7 com sala aberta (Review Focus 5): ginásios zerados (o que um save v7 tiver nesses campos não
    //    é lido), o resto igual ao do mesmo save já na versão 8, a sala idêntica (pending, rivais, seed e a corrida), na
    //    memória e no disco, e de novo depois de recarregar
    {
      const label = 'ginasio-migracao'
      const pend = { counter: 3, training: false, fee: 50, pr: 600, gear: [], alloc: { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 } }
      const s8 = ginSave({ raceCounter: 3, pending: pend })
      const s7 = Object.assign(JSON.parse(JSON.stringify(s8)), { v: 7, ginasios: { fogo: { etapa: 5, revDia: 1, revVitorias: 4 } }, gymCounter: 9 })
      const ref = await ginAbre(label + '-ref', { save: s8, chave: GIN_REAL, pagina: 'preview.html' })
      const pg = await ginAbre(label, { save: s7, chave: GIN_REAL, pagina: 'preview.html' })
      try {
        const semRev = (s) => { const c = JSON.parse(JSON.stringify(s)); delete c.rev; return c }
        const eRef = await ginEstado(ref), simRef = await ginSimSala(ref)
        const e7 = await ginEstado(pg), d7 = JSON.parse(await ginDisco(pg, GIN_REAL))
        for (const [onde, s] of [['memória', e7], ['disco', d7]]) {
          if (s.v !== 8 || !ginIgual(s.ginasios, GIN_ZERO) || s.gymCounter !== 0) problems.push(`${label} (${onde}): ginásios da v7 não zerados ` + JSON.stringify({ v: s.v, ginasios: s.ginasios, gymCounter: s.gymCounter }))
          if (!ginIgual(semRev(s), semRev(eRef))) problems.push(`${label} (${onde}): o save migrado difere do mesmo save na versão 8 ` + JSON.stringify(semRev(s)).slice(0, 400))
          if (!s.pending || s.pending.counter !== 3 || s.pending.fee !== 50 || s.pending.training !== false || !ginIgual(s.pending, eRef.pending)) problems.push(`${label} (${onde}): sala aberta ` + JSON.stringify(s.pending))
        }
        if (!(d7.rev > s7.rev)) problems.push(`${label}: o save migrado não foi gravado ao abrir (rev ${d7.rev})`)
        if ((await ginSimSala(pg)) !== simRef) problems.push(`${label}: a corrida da sala aberta mudou com a migração`)
        if (JSON.parse(simRef).seed !== (S.hash2(GIN_SEED, 3) >>> 0)) problems.push(`${label}: seed da sala ${JSON.parse(simRef).seed}`)
        const salaRef = await abrirSala(ref), sala7 = await abrirSala(pg)
        for (const c of ['seed', 'counter', 'fee', 'training', 'track', 'blocks', 'weather', 'rivais', 'gold']) if (salaRef[c] !== sala7[c]) problems.push(`${label}: a sala mudou (${c}: ${salaRef[c]} -> ${sala7[c]})`)
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        const r = await ginEstado(pg)
        if (!ginIgual(semRev(r), semRev(e7)) || (await ginSimSala(pg)) !== simRef) problems.push(`${label}: recarregar o save migrado mudou o save ou a sala`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
        await ref.context().close()
      }
    }

    // 3. lixo em cada campo (save v8): o progresso volta ao coerente (Ginasio.sanear), a insígnia só existe com as cinco
    //    etapas (não há campo de insígnia), o contador volta a 0; dia da revanche estragado vale hoje e é gravado
    //    consertado ao abrir (Ruling 3); um save bom não é regravado
    {
      const label = 'ginasio-lixo'
      const casos = [
        [7, -1], ['x', 'x'], [[1], 2.5], [null, null], [{}, 1e12],
        [{ fogo: 'x', agua: 5, grama: null }, -0.5],
        [{ fogo: { etapa: 6 }, agua: { etapa: -1, revDia: null }, grama: { etapa: 2.5, revDia: null } }, '3'],
        [{ fogo: { etapa: '5', revDia: null }, agua: { etapa: 5, revDia: 'x', revVitorias: -1 }, grama: { etapa: 4, insignia: true, revDia: null, revVitorias: 1.5 } }, { n: 1 }],
        [{ fogo: { etapa: 5, revDia: -3, revVitorias: 2 }, agua: { etapa: 5, revDia: 1e9 }, grama: { etapa: 5, revDia: null, revVitorias: 2 } }, 7]
      ]
      const pg = await ginAbre(label, { save: ginSave(), chave: GIN_REAL, pagina: 'preview.html' })
      try {
        const hoje = await ginHoje(pg)
        let rev = 100
        for (const [gin, cont] of casos) {
          rev += 10
          const raw = JSON.stringify(ginSave({ rev, ginasios: gin, gymCounter: cont }))
          await pg.evaluate(([k, r]) => localStorage.setItem(k, r), [GIN_REAL, raw])
          await pg.reload({ waitUntil: 'domcontentloaded' })
          await pg.waitForSelector('#t-estabulo')
          await sleep(200)
          const s = await ginEstado(pg), disco = await ginDisco(pg, GIN_REAL), esperado = GN.sanear(gin, hoje)
          const caso = JSON.stringify(gin) + ' / ' + JSON.stringify(cont)
          if (!ginIgual(s.ginasios, esperado)) problems.push(`${label}: ${caso} virou ${JSON.stringify(s.ginasios)} (esperado ${JSON.stringify(esperado)})`)
          const esperadoCont = typeof cont === 'number' && cont === Math.floor(cont) && cont >= 0 && cont <= 1e9 ? cont : 0
          if (s.gymCounter !== esperadoCont) problems.push(`${label}: gymCounter ${JSON.stringify(cont)} virou ${s.gymCounter}`)
          for (const id of G.GYM_ORDER) {
            const e = s.ginasios[id]
            if (!e || Object.keys(e).sort().join() !== 'etapa,revDia,revVitorias' || !(Number.isInteger(e.etapa) && e.etapa >= 0 && e.etapa <= 5)) problems.push(`${label}: ${caso}: ${id} incoerente ${JSON.stringify(e)}`)
          }
          if (!ginIgual(await ginBonus(pg), GN.bonus(esperado))) problems.push(`${label}: ${caso}: bônus ${JSON.stringify(await ginBonus(pg))}`)
          // o dia da revanche foi consertado (estava estragado: vale hoje)? então o disco já tem o consertado; senão, nada
          // de dia mudou e, se o resto estava bom, o disco fica byte a byte igual
          const b = gin && typeof gin === 'object' && !Array.isArray(gin) ? gin : null
          const diaConsertado = !!b && G.GYM_ORDER.some((id) => id in b && b[id] !== undefined &&
            (!(b[id] && typeof b[id] === 'object' && !Array.isArray(b[id])) || b[id].revDia !== esperado[id].revDia))
          if (diaConsertado) {
            const d = JSON.parse(disco)
            if (!ginIgual(G.GYM_ORDER.map((id) => d.ginasios && d.ginasios[id] && d.ginasios[id].revDia), G.GYM_ORDER.map((id) => esperado[id].revDia)) || !(d.rev > rev)) problems.push(`${label}: ${caso}: o dia consertado não foi gravado ao abrir ` + JSON.stringify({ ginasios: d.ginasios, rev: d.rev }))
          }
        }
        // casos fixados à mão (não só "o mesmo que o módulo"): etapa fora da faixa vale 0; insígnia sem as cinco etapas não
        // existe; dia estragado vale hoje; dia bom e null ficam
        const fix = GN.sanear(casos[7][0], hoje), fix2 = GN.sanear(casos[8][0], hoje)
        if (fix.fogo.etapa !== 0 || fix.agua.etapa !== 5 || fix.agua.revDia !== hoje || fix.agua.revVitorias !== 0 || fix.grama.etapa !== 4 || 'insignia' in fix.grama) problems.push(`${label}: casos fixos ` + JSON.stringify(fix))
        if (!ginIgual(GN.bonus(fix), { ouro: 0, xp: 0.03, skill: 0 }) || !ginIgual(GN.bonus(fix2), { ouro: 0.03, xp: 0.03, skill: 0.03 }) || fix2.fogo.revDia !== hoje || fix2.agua.revDia !== hoje || fix2.grama.revDia !== null) problems.push(`${label}: casos fixos (bônus) ` + JSON.stringify(fix2))
        // um save v8 bom (dia da revanche válido e null) não é regravado ao abrir
        const bom = JSON.stringify(ginSave({ rev: 500, gymCounter: 4, ginasios: { fogo: { etapa: 5, revDia: hoje - 1, revVitorias: 3 }, agua: { etapa: 2, revDia: null, revVitorias: 0 }, grama: { etapa: 0, revDia: null, revVitorias: 0 } } }))
        await pg.evaluate(([k, r]) => localStorage.setItem(k, r), [GIN_REAL, bom])
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        await sleep(300)
        if ((await ginDisco(pg, GIN_REAL)) !== bom) problems.push(`${label}: um save v8 sem nada para consertar foi regravado ao abrir`)
        const sb = await ginEstado(pg)
        if (!ginIgual(sb.ginasios, JSON.parse(bom).ginasios) || sb.gymCounter !== 4) problems.push(`${label}: save bom mudou na memória ` + JSON.stringify({ ginasios: sb.ginasios, gymCounter: sb.gymCounter }))
        // e o consertado, aberto de novo, também não é regravado (o conserto acontece uma vez)
        const estragado = JSON.stringify(ginSave({ rev: 600, ginasios: { fogo: { etapa: 5, revDia: 'x', revVitorias: 0 } } }))
        await pg.evaluate(([k, r]) => localStorage.setItem(k, r), [GIN_REAL, estragado])
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        const consertado = await ginDisco(pg, GIN_REAL)
        if (JSON.parse(consertado).ginasios.fogo.revDia !== hoje) problems.push(`${label}: dia "x" não foi gravado como hoje ` + consertado.slice(0, 200))
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        await sleep(300)
        if ((await ginDisco(pg, GIN_REAL)) !== consertado) problems.push(`${label}: o save consertado foi regravado de novo ao abrir`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 4. save de versão 9 (também "9" em texto): tela de bloqueio, e a chave fica byte a byte igual (real e de teste)
    for (const [label, pagina, chave, raw] of [['ginasio-v9', 'preview.html', GIN_REAL, JSON.stringify(ginSave({ v: 9, coisaNova: 1 }))],
      ['ginasio-v9-dev', 'jogo-dev.html', GIN_DEV, JSON.stringify(ginSave({ v: 9 }))], ['ginasio-v9-texto', 'preview.html', GIN_REAL, JSON.stringify(ginSave({ v: '9' }))]]) {
      const pg = await ginAbre(label, { save: raw, chave, pagina, espera: '#t-bloqueio' })
      try {
        if (await pg.locator('#t-estabulo, .app-abas, .dev-botao').count()) problems.push(`${label}: a tela de bloqueio mostra o jogo`)
        await sleep(1000)
        if ((await ginDisco(pg, chave)) !== raw) problems.push(`${label}: a chave mudou`)
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-bloqueio', { timeout: 5000 })
        await sleep(300)
        if ((await ginDisco(pg, chave)) !== raw) problems.push(`${label}: a chave mudou depois de recarregar`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 5. gaveta DEV "Ginásios": a etapa de cada trilha (5 dá a insígnia), liberar a revanche, zerar; cada um grava no save de
    //    teste (o save real não é tocado)
    {
      const label = 'ginasio-dev'
      const pg = await ginAbre(label, { save: ginSave(), chave: GIN_DEV })
      try {
        await devAbrir(pg)
        const grupo = (await pg.locator('#dev-g-ginasios').textContent().catch(() => '')) || ''
        if (!/Ginásios/.test(grupo)) problems.push(`${label}: sem o grupo "Ginásios" na gaveta`)
        for (const id of G.GYM_ORDER) {
          const opts = await pg.locator(`#dev-gin-${id} option`).evaluateAll((os) => os.map((o) => o.value))
          if (opts.join() !== '0,1,2,3,4,5') problems.push(`${label}: as etapas de ${id} na gaveta são ${opts.join()}`)
        }
        await devFechar(pg)
        await ginDevEtapas(pg, { fogo: 5, agua: 3, grama: 0 })
        let s = await ginEstado(pg), d = JSON.parse(await ginDisco(pg))
        for (const [onde, x] of [['memória', s], ['disco', d]]) {
          if (x.ginasios.fogo.etapa !== 5 || x.ginasios.agua.etapa !== 3 || x.ginasios.grama.etapa !== 0) problems.push(`${label} (${onde}): etapas ` + JSON.stringify(x.ginasios))
        }
        if (!ginIgual(await ginBonus(pg), { ouro: 0.03, xp: 0, skill: 0 })) problems.push(`${label}: bônus com a insígnia de Fogo ` + JSON.stringify(await ginBonus(pg)))
        // dar e tirar insígnia
        await ginDevEtapas(pg, { fogo: 4, agua: 5, grama: 5 })
        if (!ginIgual(await ginBonus(pg), { ouro: 0, xp: 0.03, skill: 0.03 })) problems.push(`${label}: tirar a de Fogo e dar as outras ` + JSON.stringify(await ginBonus(pg)))
        // liberar a revanche: o dia da última revanche dos três volta a null; nada mais muda
        await pg.evaluate(() => { const g = window.__galope.state.ginasios; g.fogo.revDia = 3; g.agua.revDia = 4; g.grama.revDia = 5; g.grama.revVitorias = 2 })
        await ginDevAcao(pg, 'revanche')
        s = await ginEstado(pg); d = JSON.parse(await ginDisco(pg))
        for (const [onde, x] of [['memória', s], ['disco', d]]) {
          if (G.GYM_ORDER.some((id) => x.ginasios[id].revDia !== null) || x.ginasios.grama.revVitorias !== 2 || x.ginasios.agua.etapa !== 5 || x.ginasios.fogo.etapa !== 4) problems.push(`${label} (${onde}): liberar a revanche ` + JSON.stringify(x.ginasios))
        }
        // zerar: os três ginásios voltam ao começo
        await pg.evaluate(() => { window.__galope.state.ginasios.fogo.revDia = 9 })
        await ginDevAcao(pg, 'zerar')
        s = await ginEstado(pg); d = JSON.parse(await ginDisco(pg))
        for (const [onde, x] of [['memória', s], ['disco', d]]) if (!ginIgual(x.ginasios, GIN_ZERO)) problems.push(`${label} (${onde}): zerar ` + JSON.stringify(x.ginasios))
        if (!ginIgual(await ginBonus(pg), { ouro: 0, xp: 0, skill: 0 })) problems.push(`${label}: bônus depois de zerar ` + JSON.stringify(await ginBonus(pg)))
        // recarregar mantém o que a gaveta gravou
        await ginDevEtapas(pg, { grama: 5 })
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        if ((await ginEstado(pg)).ginasios.grama.etapa !== 5) problems.push(`${label}: recarregar perdeu a etapa dada pela gaveta`)
        if ((await ginDisco(pg, GIN_REAL)) !== null) problems.push(`${label}: o modo DEV gravou o save real`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 6. os bônus numa corrida (build de teste, o mesmo save e a mesma sala em todos): o prêmio da corrida valendo sobe 3%
    //    para baixo com a de Fogo; o XP 3% arredondado com a de Água (também no treino, que não ganha o Ouro); a chance de
    //    skill por nível usa o bônus com a de Grama (comparado com RaceSim.learnSkill aqui no node); sem insígnia tudo é o
    //    de hoje; a ordem de chegada, os tempos e os eventos são idênticos em todos. 'sala-aberta': as três insígnias vêm
    //    pela gaveta com a sala já aberta: a sala e a corrida dela não mudam; o bônus só aparece no acerto.
    const corridas = {}
    for (const [nome, etapas, treino, antesDaSala] of [['nenhuma', {}, false, true], ['fogo', { fogo: 5 }, false, true], ['agua', { agua: 5 }, false, true],
      ['grama', { grama: 5 }, false, true], ['sala-aberta', { fogo: 5, agua: 5, grama: 5 }, false, false], ['treino', { fogo: 5, agua: 5, grama: 5 }, true, true]]) {
      const label = 'ginasio-bonus-' + nome
      const pg = await ginAbre(label, { save: ginSave(treino ? { gold: 30 } : {}), chave: GIN_DEV })
      try {
        await ginOuroInf(pg, false)
        if (antesDaSala && Object.keys(etapas).length) await ginDevEtapas(pg, etapas)
        await pg.locator('[data-acao="aba"][data-id="correr"]').click()
        await pg.waitForSelector('#t-correr')
        await pg.locator(treino ? '[data-acao="treino"]' : '[data-acao="procurar"]').click()
        await pg.waitForSelector('#t-largada')
        const sim0 = await ginSimSala(pg), pend0 = JSON.stringify((await ginEstado(pg)).pending), sala0 = await salaAtual(pg)
        if (!antesDaSala) {
          await ginDevEtapas(pg, etapas)
          const pend1 = JSON.stringify((await ginEstado(pg)).pending), disco1 = JSON.stringify(JSON.parse(await ginDisco(pg)).pending), sala1 = await salaAtual(pg)
          if (pend1 !== pend0 || disco1 !== pend0) problems.push(`${label}: a insígnia com a sala aberta mudou state.pending ` + JSON.stringify({ antes: pend0, depois: pend1, disco: disco1 }))
          if ((await ginSimSala(pg)) !== sim0) problems.push(`${label}: a insígnia com a sala aberta mudou a corrida simulada da sala`)
          for (const c of ['seed', 'counter', 'fee', 'training', 'track', 'blocks', 'weather', 'rivais', 'gold']) if (sala0[c] !== sala1[c]) problems.push(`${label}: a sala mudou (${c}: ${sala0[c]} -> ${sala1[c]})`)
        }
        const antes = await ginEstado(pg)
        const bonus = await ginBonus(pg)
        const L = await pg.evaluate(() => { const L = window.__galope.ui.lobby; return { playerIdx: L.playerIdx, n: L.n, fee: L.fee, training: L.training } })
        await pg.getByRole('button', { name: /^Largar/ }).click()
        await pg.waitForSelector('#pista')
        await pg.getByRole('button', { name: /Pular|Ver resultado/ }).click()
        await pg.waitForSelector('#t-resultado')
        const R = await pg.evaluate(() => {
          const g = window.__galope, L = g.ui.lobby, r = g.ui.result
          return { sim: JSON.stringify({ seed: L.seed, ordem: L.sim.finishOrder, tempos: L.sim.finishTimes, eventos: L.sim.events }), prize: r.prize, xpGain: r.xpGain, learned: r.learned, levels: r.levels, place: r.place }
        })
        const depois = await ginEstado(pg), disco = JSON.parse(await ginDisco(pg))
        // a célula do prêmio na linha do jogador (a última coluna), lida sozinha: o texto exato, não um pedaço da linha
        const balanco = (await pg.locator('.balanco').textContent()) || '', voce = ((await pg.locator('tr.voce td.num:last-child').first().textContent()) || '').trim()
        corridas[nome] = R.sim
        if (R.sim !== sim0) problems.push(`${label}: a corrida corrida difere da simulada da sala (a insígnia entrou na simulação?)`)
        // o esperado, aqui no node, com as fórmulas de hoje mais o bônus
        const ordem = JSON.parse(R.sim).ordem, lugar = ordem.indexOf(L.playerIdx) + 1
        const b = { ouro: etapas.fogo === 5 ? 0.03 : 0, xp: etapas.agua === 5 ? 0.03 : 0, skill: etapas.grama === 5 ? 0.03 : 0 }
        if (!ginIgual(bonus, b)) problems.push(`${label}: bonusConta ${JSON.stringify(bonus)} (esperado ${JSON.stringify(b)})`)
        const TREINO_OURO = [30, 22, 16, 12, 10, 10, 10, 10]
        let base
        if (treino) base = TREINO_OURO[lugar - 1] || 10
        else { const mine = S.payouts(L.fee, L.n, ordem).prizes.find((p) => p.racer === L.playerIdx); base = mine ? mine.amount : 0 }
        const premio = treino ? base : base + Math.floor(base * b.ouro + 1e-9)
        const xpBase = G.ECONOMY.xpPerPlace[lugar - 1] || G.ECONOMY.xpPerPlace[G.ECONOMY.xpPerPlace.length - 1]
        const xp0 = treino ? Math.round(xpBase / 2) : xpBase
        const xp = xp0 + Math.round(xp0 * b.xp)
        const ap = ginApplyXp(antes.mounts[0], xp, GIN_SEED, antes.raceCounter, b.skill)
        notes[label] = { lugar, base, premio, xp0, xp, aprendeu: ap.learned, nivel: ap.m.level }
        if (R.place !== lugar || R.prize !== premio) problems.push(`${label}: prêmio ${R.prize} no ${R.place}º (esperado ${premio} no ${lugar}º; base ${base})`)
        if (depois.gold !== antes.gold - L.fee + premio || depois.goldWon !== antes.goldWon + (treino ? 0 : premio) || disco.gold !== depois.gold) problems.push(`${label}: Ouro ${JSON.stringify({ antes: antes.gold, depois: depois.gold, disco: disco.gold, goldWon: depois.goldWon, premio })}`)
        if (R.xpGain !== xp) problems.push(`${label}: XP ${R.xpGain} (esperado ${xp}; base ${xp0})`)
        const m1 = depois.mounts[0]
        if (m1.level !== ap.m.level || m1.xp !== ap.m.xp || !ginIgual(m1.skills, ap.m.skills) || !ginIgual(R.learned, ap.learned) || R.levels !== ap.levels) problems.push(`${label}: cavalo ${JSON.stringify({ level: m1.level, xp: m1.xp, skills: m1.skills, learned: R.learned })} (esperado ${JSON.stringify({ level: ap.m.level, xp: ap.m.xp, skills: ap.m.skills, learned: ap.learned })})`)
        if (!ginIgual(disco.mounts[0].skills, m1.skills) || disco.mounts[0].xp !== m1.xp) problems.push(`${label}: o cavalo do disco difere do da memória`)
        // o que torna cada bônus visível com este save (se o pareamento mudar, diz qual condição caiu)
        if (ap.levels !== 1) problems.push(`${label}: o teste precisa de exatamente 1 nível no páreo (subiu ${ap.levels})`)
        if (!treino && !(base >= 34)) problems.push(`${label}: o teste precisa de um prêmio base de 34 ou mais (veio ${base} no ${lugar}º); troque GIN_SEED`)
        if (nome === 'nenhuma' && ap.learned.length !== 0) problems.push(`${label}: sem insígnia a skill do nível 11 não deveria sair com GIN_SEED`)
        if (nome === 'grama' && ap.learned.length !== 1) problems.push(`${label}: com a insígnia de Grama a skill do nível 11 deveria sair com GIN_SEED`)
        // o resultado mostra o prêmio pago (no balanço e na linha do jogador)
        const celula = treino ? '+' + premio : premio ? Math.round(premio).toLocaleString('pt-BR') : '—'
        if (premio && (!balanco.includes('+' + premio) || voce !== celula)) problems.push(`${label}: o resultado não mostra o prêmio pago ${premio}: ${JSON.stringify({ balanco, voce, celula })}`)
        if (!balanco.includes('+' + premio) && treino) problems.push(`${label}: o treino não mostra o Ouro ${premio}`)
        if (!((await pg.locator('#tela').textContent()) || '').includes('+' + xp + ' XP')) problems.push(`${label}: o resultado não mostra +${xp} XP`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // a mesma corrida (valendo) com e sem cada insígnia: ordem, tempos e eventos idênticos
    for (const nome of ['fogo', 'agua', 'grama', 'sala-aberta']) if (corridas[nome] && corridas.nenhuma && corridas[nome] !== corridas.nenhuma) problems.push(`ginasio-bonus: a corrida com "${nome}" difere da sem insígnia`)

    // ---------------- Tarefa 4: a aba Expedição e a trilha (spec §4, §8, §9, §10) ----------------
    // os textos esperados saem do catálogo (nomes, níveis, entradas, prêmios, pista): nada fixado à mão além do formato
    const ginFmt = (n) => Math.round(n).toLocaleString('pt-BR')
    const ginCavTxt = (n) => n === 1 ? '1 cavalo' : n + ' cavalos'
    const ginFraco = (id) => `Ponto fraco: ${G.ELEMENTS[G.GYMS[id].fraco].name} vence ${G.ELEMENTS[id].name}`
    const ginTotal = (id) => G.GYMS[id].etapas.length
    const ginLimpa = (s) => String(s || '').replace(/\s+/g, ' ').trim()
    // a aba Expedição: os cartões (na ordem da tela), o ponto da aba, a vitrine e as posições
    const ginAba = (pg) => pg.evaluate(() => {
      const r = (e) => e.getBoundingClientRect()
      const cartoes = [...document.querySelectorAll('#tela .ginasio-cartao')].map((b) => ({
        tag: b.tagName, acao: b.getAttribute('data-acao'), id: b.getAttribute('data-id'), txt: b.textContent.replace(/\s+/g, ' ').trim(),
        h: r(b).height, w: r(b).width, top: r(b).top + window.scrollY, ins: [...b.querySelectorAll('img.icone')].map((i) => i.className) }))
      const sel = document.getElementById('t-selvagens')
      return { cartoes, ponto: !!document.querySelector('.app-aba--ponto[data-id="expedicao"]'),
        pontos: [...document.querySelectorAll('.app-aba--ponto')].map((b) => b.getAttribute('data-id')).join(','),
        selvagens: document.querySelectorAll('#tela .selvagem').length, selvagensTxt: sel ? sel.textContent : null,
        selvagensTop: sel ? r(sel).top + window.scrollY : null, abertura: (document.querySelector('#tela .tela > .nota') || {}).textContent || '' }
    })
    // a trilha aberta: as etapas na ordem do DOM (0 a 4), com o estado, o botão e a posição na tela
    const ginTrilha = (pg) => pg.evaluate(() => {
      const r = (e) => e.getBoundingClientRect()
      return { titulo: (document.getElementById('t-ginasio') || {}).textContent || null, txt: document.getElementById('tela').textContent.replace(/\s+/g, ' '),
        etapas: [...document.querySelectorAll('#tela .etapa')].map((li) => {
          const b = li.querySelector('.etapa-btn')
          return { n: li.getAttribute('data-etapa'), estado: li.getAttribute('data-estado'), txt: li.textContent.replace(/\s+/g, ' ').trim(), top: r(li).top,
            tag: b && b.tagName, acao: b && b.getAttribute('data-acao'), id: b && b.getAttribute('data-id'), dis: b && b.getAttribute('aria-disabled'),
            motivo: b && b.getAttribute('data-motivo'), cur: b && b.getAttribute('aria-current'), h: b ? r(b).height : 0,
            ins: [...li.querySelectorAll('img.icone')].map((i) => i.className) }
        }),
        botoes: [...document.querySelectorAll('#tela button')].map((b) => b.getAttribute('data-acao')) }
    })
    const ginAbreAba = async (pg) => { await pg.locator('[data-acao="aba"][data-id="expedicao"]').click(); await pg.waitForSelector('#t-expedicao') }
    const ginAbreTrilha = async (pg, id) => {
      await pg.locator(`[data-acao="ginasio-abrir"][data-id="${id}"]`).click()
      await pg.waitForFunction((n) => { const h = document.getElementById('t-ginasio'); return !!h && h.textContent.includes(n) }, G.GYMS[id].name, { timeout: 4000 })
    }
    // o cartão do ginásio: nome, elemento, "N de 5 vencidos", a insígnia (ícone e nome) só com as cinco, "Revanche hoje"
    // só quando a revanche está livre; é um botão de 44 px ou mais que abre a trilha
    const ginConfereCartao = (label, c, id, etapa, revanche) => {
      const g = G.GYMS[id]
      if (!c) { problems.push(`${label}: sem o cartão de ${id}`); return }
      if (c.tag !== 'BUTTON' || c.acao !== 'ginasio-abrir' || c.h < 44) problems.push(`${label}: o cartão de ${id} não é um botão de 44 px que abre a trilha ${JSON.stringify(c)}`)
      for (const t of [g.name, G.ELEMENTS[g.element].name, `${etapa} de ${ginTotal(id)} vencidos`]) if (!c.txt.includes(t)) problems.push(`${label}: o cartão de ${id} sem "${t}": ${c.txt}`)
      const temIns = etapa === ginTotal(id)
      if (temIns !== c.txt.includes(g.insignia.name) || temIns !== c.ins.some((k) => k.includes('icone--' + g.insignia.icone))) problems.push(`${label}: a insígnia de ${id} (etapa ${etapa}) ${JSON.stringify(c)}`)
      if (revanche !== c.txt.includes('Revanche hoje')) problems.push(`${label}: "Revanche hoje" no cartão de ${id} devia ser ${revanche}: ${c.txt}`)
    }
    // a trilha: cinco etapas de baixo para cima (a 1ª embaixo), cada uma com o nome, os cavalos e o nível, a entrada e o
    // estado; vencida: sem botão; próxima: o único botão tocável (aria-current); fechada: aria-disabled com o motivo escrito
    const ginConfereTrilha = (label, t, id, etapa) => {
      const g = G.GYMS[id]
      if (!t.titulo || !t.titulo.includes(g.name)) problems.push(`${label}: trilha sem o nome ${g.name} (${t.titulo})`)
      if (!t.txt.includes(ginFraco(id))) problems.push(`${label}: trilha sem "${ginFraco(id)}"`)
      if (t.etapas.length !== ginTotal(id)) { problems.push(`${label}: ${t.etapas.length} etapas na trilha`); return }
      t.etapas.forEach((e, i) => {
        const def = g.etapas[i], esp = i < etapa ? 'vencida' : i === etapa ? 'proxima' : 'fechada'
        if (e.n !== String(i)) problems.push(`${label}: etapa ${i} fora de ordem no DOM (${e.n})`)
        for (const txt of [def.nome, ginCavTxt(def.cavalos.length), 'Nível ' + def.cavalos[0].level, `Entrada: ${ginFmt(def.entrada)} de Ouro`]) if (!e.txt.includes(txt)) problems.push(`${label}: etapa ${i} sem "${txt}": ${e.txt}`)
        if (e.estado !== esp) problems.push(`${label}: etapa ${i} ${e.estado} (esperado ${esp})`)
        if (i > 0 && !(e.top < t.etapas[i - 1].top)) problems.push(`${label}: a etapa ${i} não fica acima da ${i - 1} (${e.top} >= ${t.etapas[i - 1].top})`)
        if (esp === 'vencida' && (e.tag === 'BUTTON' || !e.txt.includes('Vencida'))) problems.push(`${label}: etapa ${i} vencida tocável ou sem "Vencida" ${JSON.stringify(e)}`)
        if (esp === 'proxima' && (e.tag !== 'BUTTON' || e.acao !== 'ginasio-etapa' || e.id !== String(i) || e.dis !== null || e.cur !== 'step' || e.h < 44 || !e.txt.includes('Próxima'))) problems.push(`${label}: etapa ${i} próxima ${JSON.stringify(e)}`)
        if (esp === 'fechada' && (e.tag !== 'BUTTON' || e.dis !== 'true' || e.motivo !== 'Vença a etapa anterior' || !e.txt.includes('Vença a etapa anterior') || e.cur !== null || e.h < 44)) problems.push(`${label}: etapa ${i} fechada ${JSON.stringify(e)}`)
        if (def.lider && (etapa === ginTotal(id)) !== e.ins.some((k) => k.includes('icone--' + g.insignia.icone))) problems.push(`${label}: a etapa do líder com a insígnia devia ser ${etapa === ginTotal(id)}`)
      })
      if (etapa === ginTotal(id) && !t.txt.includes(g.insignia.name)) problems.push(`${label}: trilha com a insígnia sem o nome dela`)
      const tocaveis = t.etapas.filter((e) => e.tag === 'BUTTON' && e.dis === null).length
      if (tocaveis !== (etapa < ginTotal(id) ? 1 : 0)) problems.push(`${label}: ${tocaveis} etapas tocáveis (esperado ${etapa < ginTotal(id) ? 1 : 0})`)
      if (t.botoes.some((a) => !a)) problems.push(`${label}: botão sem ação na trilha ${t.botoes.join(',')}`)
    }
    // o detalhe da etapa (só leitura nesta tarefa): os cavalos do adversário (nível, estrelas, elemento, Poder do cavalo
    // fixo do catálogo), a pista da casa numa frase, a entrada e o prêmio com os nomes dos itens; nenhum botão sem ação
    const ginConfereDetalhe = async (label, pg, id, i) => {
      const g = G.GYMS[id], def = g.etapas[i]
      const d = await pg.evaluate(() => ({ titulo: (document.getElementById('t-etapa') || {}).textContent || null, adv: (document.getElementById('t-adversario') || {}).textContent || null, txt: document.getElementById('tela').textContent.replace(/\s+/g, ' '),
        cavalos: [...document.querySelectorAll('#tela .adv-cavalo')].map((c) => ({ txt: c.textContent.replace(/\s+/g, ' '), retrato: !!c.querySelector('canvas.retrato'),
          estrelas: (c.querySelector('.estrelas') || { getAttribute: () => null }).getAttribute('aria-label') })),
        botoes: [...document.querySelectorAll('#tela button')].map((b) => b.getAttribute('data-acao')) }))
      if (!d.titulo || !d.titulo.includes(def.nome)) problems.push(`${label}: detalhe sem o nome ${def.nome} (${d.titulo})`)
      if (d.adv !== 'Adversário, ' + ginCavTxt(def.cavalos.length)) problems.push(`${label}: o título dos cavalos do adversário é lido como "${d.adv}"`)
      if (d.cavalos.length !== def.cavalos.length) problems.push(`${label}: detalhe com ${d.cavalos.length} cavalos (esperado ${def.cavalos.length})`)
      def.cavalos.forEach((c, k) => {
        const h = GN.cavalo(c), x = d.cavalos[k]
        if (!x) return
        for (const t of [h.name, 'Nível ' + c.level, G.ELEMENTS[h.element].name, 'Poder ' + S.powerRating(h)]) if (!x.txt.includes(t)) problems.push(`${label}: cavalo ${k} do detalhe sem "${t}": ${x.txt}`)
        if (!x.retrato || !x.estrelas || !x.estrelas.includes(String(c.grau))) problems.push(`${label}: cavalo ${k} do detalhe sem retrato ou sem as ${c.grau} estrelas ${JSON.stringify(x)}`)
      })
      const p = g.pista
      for (const t of [ginFmt(p.distance) + ' m', G.SURFACES[p.surface].name.toLowerCase(), ...p.blocks.map((b) => `${G.BLOCK_TYPES[b.type].name.toLowerCase()} ${ginFmt(b.to - b.from)} m`),
        `Entrada: ${ginFmt(def.entrada)} de Ouro`, `${ginFmt(def.premio.ouro)} de Ouro`, ...def.premio.itens.map((it) => '1 ' + G.ITEMS[it].name), ginFraco(id)]) {
        if (!d.txt.includes(t)) problems.push(`${label}: detalhe sem "${t}"`)
      }
      if (def.lider && !d.txt.includes(g.insignia.name)) problems.push(`${label}: detalhe do líder sem a insígnia no prêmio`)
      // Tarefa 5 (decisão 1): o detalhe é o preparo e ganha um "Desafiar", e só um (era "nenhum Desafiar" na Tarefa 4)
      if (d.botoes.some((a) => !a) || d.botoes.filter((a) => /desafiar/i.test(a)).join() !== 'ginasio-desafiar') problems.push(`${label}: botão sem ação no detalhe, ou sem um "Desafiar" só ${d.botoes.join(',')}`)
    }

    // 7. save novo, a 360×780 e a 1280: os três cartões com "0 de 5 vencidos", sem insígnia nem ponto; a vitrine abaixo; a
    //    trilha com só a 1ª aberta; tocar numa fechada só diz o motivo; o detalhe da 1ª; o "Voltar" do aparelho fecha o
    //    detalhe (volta à trilha, com o foco na etapa) e depois a trilha; o botão "Voltar" faz o mesmo
    for (const vp of [{ width: 360, height: 780 }, { width: 1280, height: 800 }, { width: 360, height: 640 }]) {
      const label = 'ginasio-aba-' + vp.width + 'x' + vp.height
      const pg = await ginAbre(label, { save: ginSave(), chave: GIN_DEV, vp })
      try {
        await ginAbreAba(pg)
        await checkOverflow(pg, label + ' aba')
        const a = await ginAba(pg)
        if (a.cartoes.map((c) => c.id).join() !== G.GYM_ORDER.join()) problems.push(`${label}: cartões ${a.cartoes.map((c) => c.id).join()} (esperado ${G.GYM_ORDER.join()})`)
        G.GYM_ORDER.forEach((id) => ginConfereCartao(label, a.cartoes.find((c) => c.id === id), id, 0, false))
        if (a.ponto) problems.push(`${label}: ponto na aba Expedição num save novo`)
        // a vitrine continua (Ruling 4), abaixo dos ginásios, com os textos dela
        if (a.selvagens !== 6 || !/Cavalos selvagens/.test(a.selvagensTxt || '') || !(a.selvagensTop > Math.max(...a.cartoes.map((c) => c.top)))) problems.push(`${label}: a vitrine não está abaixo dos ginásios ${JSON.stringify({ n: a.selvagens, t: a.selvagensTop, c: a.cartoes.map((c) => c.top) })}`)
        if (!/Exemplos de achados em expedições\. A captura ainda não está neste protótipo\./.test(await pg.locator('#tela').textContent())) problems.push(`${label}: a nota da vitrine mudou`)
        if (/Em breve/.test(a.abertura) || !/ginásio/i.test(a.abertura)) problems.push(`${label}: a abertura da aba não fala dos ginásios ou ainda diz "Em breve": ${a.abertura}`)
        for (const id of G.GYM_ORDER) {
          await ginAbreTrilha(pg, id)
          await checkOverflow(pg, label + ' trilha ' + id)
          ginConfereTrilha(label + ' ' + id, await ginTrilha(pg), id, 0)
          if (id === 'fogo') {
            // tocar numa etapa fechada: fica na trilha e diz o motivo (região viva); nada abre
            await pg.locator('[data-acao="ginasio-etapa"][data-id="2"]').click({ force: true })   // o toque real (aria-disabled: o Playwright não clica sem force)
            await pg.waitForFunction(() => (document.getElementById('motivo-vivo') || {}).textContent === 'Vença a etapa anterior', null, { timeout: 2000 })
              .catch(() => problems.push(`${label}: tocar na etapa fechada não anunciou o motivo`))
            if (await pg.locator('#t-etapa').count()) problems.push(`${label}: a etapa fechada abriu o detalhe`)
            // forçar o toque (sem o aria-disabled) também não abre
            await pg.evaluate(() => { const b = document.querySelector('[data-acao="ginasio-etapa"][data-id="3"]'); b.removeAttribute('aria-disabled'); b.click() })
            if (await pg.locator('#t-etapa').count()) problems.push(`${label}: a etapa fechada forçada abriu o detalhe`)
            // a próxima: o detalhe
            await pg.locator('[data-acao="ginasio-etapa"][data-id="0"]').click()
            await pg.waitForSelector('#t-etapa')
            await checkOverflow(pg, label + ' detalhe')
            await ginConfereDetalhe(label, pg, id, 0)
            // "Voltar" do aparelho: o detalhe fecha (a trilha, com o foco na etapa), depois a trilha (a aba)
            await pg.goBack()
            await pg.waitForSelector('#t-ginasio')
            if (await pg.locator('#t-etapa').count()) problems.push(`${label}: o voltar do aparelho não fechou o detalhe`)
            await pg.waitForFunction(() => { const e = document.activeElement; return !!e && e.getAttribute('data-acao') === 'ginasio-etapa' && e.getAttribute('data-id') === '0' }, null, { timeout: 2000 })
              .catch(() => problems.push(`${label}: ao fechar o detalhe o foco não voltou à etapa`))
            await pg.goBack()
            await pg.waitForSelector('#t-expedicao')
            // o botão "Voltar" faz o mesmo caminho
            await ginAbreTrilha(pg, id)
            await pg.locator('[data-acao="ginasio-etapa"][data-id="0"]').click()
            await pg.waitForSelector('#t-etapa')
            await pg.locator('#tela [data-acao="ginasio-voltar"]').click()
            await pg.waitForSelector('#t-ginasio')
            await pg.locator('#tela [data-acao="ginasio-voltar"]').click()
            await pg.waitForSelector('#t-expedicao')
            await pg.waitForFunction((i) => { const e = document.activeElement; return !!e && e.getAttribute('data-acao') === 'ginasio-abrir' && e.getAttribute('data-id') === i }, id, { timeout: 2000 })
              .catch(() => problems.push(`${label}: ao fechar a trilha o foco não voltou ao cartão`))
            // depois de voltar pela tela, o voltar do aparelho não deixa nada para trás (a aba continua)
            if (vp.width === 360 && vp.height === 780) {
              await ginAbreTrilha(pg, id)
              await pg.goBack()
              await pg.waitForSelector('#t-expedicao')
            }
          } else {
            await pg.goBack()
            await pg.waitForSelector('#t-expedicao')
          }
        }
        if (!(await pg.evaluate(() => window.__galope.ui.gym === null))) problems.push(`${label}: ui.gym ficou aberto na aba`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 8. com progresso pela gaveta DEV: Fogo com 2 de 5, Água com a insígnia e a revanche livre, Grama sem nada. Vencidas
    //    marcadas, a insígnia no cartão e na trilha, "Revanche hoje" e o ponto na aba só com a revanche livre; depois de
    //    tentar hoje (revDia = hoje) o ponto sai; o dia vira com o jogo aberto (gaveta "Avançar 1 dia") e ele volta;
    //    "Liberar revanche" também o traz; recarregar mantém
    {
      const label = 'ginasio-progresso'
      const pg = await ginAbre(label, { save: ginSave(), chave: GIN_DEV })
      try {
        await ginDevEtapas(pg, { fogo: 2, agua: 5, grama: 0 })
        await ginAbreAba(pg)
        await checkOverflow(pg, label + ' aba')
        let a = await ginAba(pg)
        ginConfereCartao(label, a.cartoes.find((c) => c.id === 'fogo'), 'fogo', 2, false)
        ginConfereCartao(label, a.cartoes.find((c) => c.id === 'agua'), 'agua', 5, true)
        ginConfereCartao(label, a.cartoes.find((c) => c.id === 'grama'), 'grama', 0, false)
        if (!a.ponto) problems.push(`${label}: sem o ponto na aba com a revanche livre (${a.pontos})`)
        await ginAbreTrilha(pg, 'fogo')
        ginConfereTrilha(label + ' fogo', await ginTrilha(pg), 'fogo', 2)
        await pg.locator('[data-acao="ginasio-etapa"][data-id="2"]').click()
        await pg.waitForSelector('#t-etapa')
        await ginConfereDetalhe(label + ' fogo 2', pg, 'fogo', 2)
        await pg.goBack()
        await pg.waitForSelector('#t-ginasio')
        await pg.goBack()
        await pg.waitForSelector('#t-expedicao')
        await ginAbreTrilha(pg, 'agua')
        await checkOverflow(pg, label + ' trilha agua')
        ginConfereTrilha(label + ' agua', await ginTrilha(pg), 'agua', 5)
        await pg.goBack()
        await pg.waitForSelector('#t-expedicao')
        // já tentou hoje: sem "Revanche hoje" e sem ponto (em qualquer aba)
        const hoje = await ginHoje(pg)
        await pg.evaluate((h) => { window.__galope.state.ginasios.agua.revDia = h }, hoje)
        await ginDevEtapas(pg, {})   // grava pela gaveta (devGrava redesenha a tela)
        a = await ginAba(pg)
        ginConfereCartao(label + ' tentou hoje', a.cartoes.find((c) => c.id === 'agua'), 'agua', 5, false)
        if (a.ponto) problems.push(`${label}: ponto na aba com a revanche de hoje já tentada`)
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.waitForSelector('#t-estabulo')
        if (await pg.locator('.app-aba--ponto[data-id="expedicao"]').count()) problems.push(`${label}: ponto na Expedição (no Estábulo) com a revanche já tentada`)
        // o dia vira com o jogo aberto: a revanche volta, com o ponto
        await devAbrir(pg)
        await pg.locator('[data-acao="dev-dia-mais"]').click()
        await devFechar(pg)
        await pg.waitForFunction(() => !!document.querySelector('.app-aba--ponto[data-id="expedicao"]'), null, { timeout: 3000 })
          .catch(() => problems.push(`${label}: o dia virou e o ponto da Expedição não voltou`))
        await ginAbreAba(pg)
        ginConfereCartao(label + ' dia seguinte', (await ginAba(pg)).cartoes.find((c) => c.id === 'agua'), 'agua', 5, true)
        // de volta ao dia de hoje (já tentou): sem ponto; "Liberar revanche" o traz de volta
        await devAbrir(pg)
        await pg.locator('[data-acao="dev-dia-menos"]').click()
        await devFechar(pg)
        await pg.waitForFunction(() => !document.querySelector('.app-aba--ponto[data-id="expedicao"]'), null, { timeout: 3000 })
          .catch(() => problems.push(`${label}: o relógio voltou e o ponto ficou`))
        await ginDevAcao(pg, 'revanche')
        await pg.waitForFunction(() => !!document.querySelector('.app-aba--ponto[data-id="expedicao"]'), null, { timeout: 3000 })
          .catch(() => problems.push(`${label}: "Liberar revanche" não trouxe o ponto`))
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        if (!(await pg.locator('.app-aba--ponto[data-id="expedicao"]').count())) problems.push(`${label}: recarregar tirou o ponto da revanche livre`)
        // só a insígnia de Fogo, sem a de Água: o ponto segue o ginásio com a revanche
        await ginDevEtapas(pg, { fogo: 5, agua: 4 })
        await ginAbreAba(pg)
        a = await ginAba(pg)
        ginConfereCartao(label + ' fogo', a.cartoes.find((c) => c.id === 'fogo'), 'fogo', 5, true)
        ginConfereCartao(label + ' fogo', a.cartoes.find((c) => c.id === 'agua'), 'agua', 4, false)
        if (!a.ponto) problems.push(`${label}: sem o ponto com a revanche de Fogo livre`)
        await ginDevAcao(pg, 'zerar')
        if ((await ginAba(pg)).ponto) problems.push(`${label}: ponto depois de zerar os ginásios`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 8b. Ruling 17: ao abrir a trilha pelo cartão, a etapa próxima aparece inteira entre a barra do topo (ou a faixa fixa em
    //     cima) e a barra de abas, rolando na hora o mínimo; com a insígnia (sem etapa próxima) a trilha fica no topo; o foco
    //     continua no título. A 1280×800 o caso real é medido antes (cabe sem rolar ou não) e a asserção é a desse caso.
    // a área visível medida pelo que as barras fixas cobrem de verdade (correção 2): cada barra (faixa DEV, cabeçalho,
    // abas) que passa na mesma faixa horizontal da etapa tira a parte de cima (se está acima do meio dela) ou a de baixo;
    // uma barra que não cruza a etapa na horizontal (a coluna de abas a 1280) não tira nada. Não usa o critério do jogo.
    const ginVisivel = (pg) => pg.evaluate(() => {
      const li = document.querySelector('#tela .etapa[data-estado="proxima"]'), r = li ? li.getBoundingClientRect() : null
      let topo = 0, base = window.innerHeight
      for (const e of document.querySelectorAll('.dev-faixa, .app-topo, .app-abas')) {
        const b = e.getBoundingClientRect()
        if (getComputedStyle(e).position !== 'fixed' || !b.width || !b.height || !r || b.right <= r.left || b.left >= r.right) continue
        if ((b.top + b.bottom) / 2 < (r.top + r.bottom) / 2) topo = Math.max(topo, b.bottom); else base = Math.min(base, b.top)
      }
      const ab = document.querySelector('.app-abas').getBoundingClientRect()
      return { topo, base, r: r && { top: r.top, bottom: r.bottom }, y: window.scrollY, foco: document.activeElement && document.activeElement.id,
        abas: { w: ab.width, top: ab.top }, ok: !!r && r.top >= topo - 0.5 && r.bottom <= base + 0.5 }
    })
    for (const vp of [{ width: 360, height: 780 }, { width: 360, height: 640 }]) {
      for (const [id, etapa] of [['grama', 0], ['fogo', 2], ['agua', 5]]) {
        const label = `ginasio-rola-${vp.width}x${vp.height}-${id}-${etapa}`
        const pg = await ginAbre(label, { save: ginSave({ ginasios: Object.assign(JSON.parse(JSON.stringify(GIN_ZERO)), { [id]: { etapa, revDia: null, revVitorias: 0 } }) }), chave: GIN_DEV, vp })
        try {
          await ginAbreAba(pg)
          await pg.locator(`[data-acao="ginasio-abrir"][data-id="${id}"]`).scrollIntoViewIfNeeded()
          await ginAbreTrilha(pg, id)
          if (etapa < 5) {
            await pg.waitForFunction(() => {
              const li = document.querySelector('#tela .etapa[data-estado="proxima"]'), ab = document.querySelector('.app-abas'), tp = document.querySelector('.app-topo')
              if (!li || !ab || !tp) return false
              const r = li.getBoundingClientRect()
              return r.top >= tp.getBoundingClientRect().bottom - 0.5 && r.bottom <= ab.getBoundingClientRect().top + 0.5
            }, null, { timeout: 2000 }).catch(() => {})
            const v = await ginVisivel(pg)
            if (!v.ok) problems.push(`${label}: a etapa próxima não está inteira na tela ${JSON.stringify(v)}`)
            // em todos estes casos ela começa abaixo da barra de abas (medido: no topo, a base dela passa da barra), então
            // rola, e o mínimo: a base dela fica rente à barra de abas
            if (!(v.y > 0) || Math.abs(v.r.bottom - v.base) > 1) problems.push(`${label}: a rolagem não foi a mínima ${JSON.stringify(v)}`)
            if (v.foco !== 't-ginasio') problems.push(`${label}: abrir a trilha mudou o foco (${v.foco})`)
          } else {
            const v = await ginVisivel(pg)
            if (v.y !== 0 || v.r !== null) problems.push(`${label}: com a insígnia a trilha devia abrir no topo ${JSON.stringify(v)}`)
          }
        } catch (e) {
          problems.push(`[${label}] ` + e.message)
        } finally {
          await pg.context().close()
        }
      }
    }
    {
      // barra de rolagem clássica (Windows, o painel do artefato com menos de 900 px): a barra de abas fica 17 px mais
      // estreita que a janela. O Chromium headless esconde as barras de rolagem, então o estreitamento é simulado com um
      // estilo injetado antes de abrir a trilha; a etapa próxima tem de ficar acima da barra de abas mesmo assim
      const label = 'ginasio-rola-barra-classica'
      const pg = await ginAbre(label, { save: ginSave(), chave: GIN_DEV })
      try {
        await pg.addStyleTag({ content: '.app-abas { right: 17px !important; }' })
        await ginAbreAba(pg)
        await ginAbreTrilha(pg, 'grama')
        const v = await ginVisivel(pg)
        if (!(v.abas.w < 360 && v.base === v.abas.top)) problems.push(`${label}: a simulação da barra clássica não pegou ${JSON.stringify(v)}`)
        if (!v.ok || Math.abs(v.r.bottom - v.base) > 1) problems.push(`${label}: a etapa próxima ficou por baixo da barra de abas ${JSON.stringify(v)}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      // já cabe: com 4 vencidas a próxima é o líder, no topo da trilha (medido: a 360×780 ele está inteiro na 1ª tela);
      // a trilha abre sem rolar
      const label = 'ginasio-rola-cabe-360x780'
      const pg = await ginAbre(label, { save: ginSave({ ginasios: Object.assign(JSON.parse(JSON.stringify(GIN_ZERO)), { fogo: { etapa: 4, revDia: null, revVitorias: 0 } }) }), chave: GIN_DEV })
      try {
        await ginAbreAba(pg)
        await ginAbreTrilha(pg, 'fogo')
        const v = await ginVisivel(pg)
        if (v.y !== 0 || !v.ok) problems.push(`${label}: a etapa próxima já cabia e a tela rolou (ou ela não está inteira) ${JSON.stringify(v)}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      // 1280×800, 0 vencidas: medido nesta tela, no topo a etapa próxima NÃO cabe (a base dela fica em ~1.028 px numa
      // janela de 800), então vale a regra das 360: inteira na tela, com a rolagem mínima (base rente ao fim da janela)
      const label = 'ginasio-rola-1280x800'
      const pg = await ginAbre(label, { save: ginSave(), chave: GIN_DEV, vp: { width: 1280, height: 800 } })
      try {
        await ginAbreAba(pg)
        await ginAbreTrilha(pg, 'fogo')
        const v = await ginVisivel(pg)
        if (!(v.r.bottom + v.y > v.base)) problems.push(`${label}: a etapa próxima já caberia sem rolar; reveja o caso ${JSON.stringify(v)}`)
        if (!v.ok || Math.abs(v.r.bottom - v.base) > 1) problems.push(`${label}: a etapa próxima não ficou inteira com a rolagem mínima ${JSON.stringify(v)}`)
        if (v.foco !== 't-ginasio') problems.push(`${label}: abrir a trilha mudou o foco (${v.foco})`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 9. cores forçadas: cartões e etapas com borda de 2 px em cor do sistema (a fechada em GrayText, a próxima em
    //    Highlight); movimento reduzido: nada na aba, na trilha e no detalhe anima ou tem transição
    {
      const label = 'ginasio-forcado'
      const pg = await ginAbre(label, { save: ginSave(), chave: GIN_DEV, forcedColors: 'active' })
      try {
        await ginDevEtapas(pg, { fogo: 2 })
        await ginAbreAba(pg)
        const borda = () => pg.evaluate(() => {
          const sonda = (c) => { const d = document.createElement('i'); d.style.border = '2px solid ' + c; document.body.appendChild(d); const v = getComputedStyle(d).borderTopColor; d.remove(); return v }
          const b = (e) => { const cs = getComputedStyle(e); return { w: cs.borderTopWidth, s: cs.borderTopStyle, c: cs.borderTopColor } }
          return { ativo: matchMedia('(forced-colors: active)').matches, hl: sonda('Highlight'), gray: sonda('GrayText'), sis: ['CanvasText', 'ButtonText', 'GrayText', 'Highlight'].map(sonda),
            cartoes: [...document.querySelectorAll('#tela .ginasio-cartao')].map(b),
            etapas: [...document.querySelectorAll('#tela .etapa')].map((li) => ({ estado: li.getAttribute('data-estado'), ...b(li.querySelector('.etapa-btn')) })) }
        })
        let f = await borda()
        if (!f.ativo) problems.push(`[${label}] a página não está em cores forçadas`)
        if (f.cartoes.length !== 3 || f.cartoes.some((c) => c.w !== '2px' || c.s !== 'solid' || !f.sis.includes(c.c))) problems.push(`[${label}] cartões sem borda de 2 px em cor do sistema ${JSON.stringify(f.cartoes)}`)
        await ginAbreTrilha(pg, 'fogo')
        f = await borda()
        if (f.etapas.length !== 5 || f.etapas.some((e) => e.w !== '2px' || e.s !== 'solid' || !f.sis.includes(e.c))) problems.push(`[${label}] etapas sem borda de 2 px em cor do sistema ${JSON.stringify(f.etapas)}`)
        if (f.etapas.filter((e) => e.estado === 'fechada').some((e) => e.c !== f.gray)) problems.push(`[${label}] etapa fechada sem a borda em GrayText ${JSON.stringify(f.etapas)}`)
        if (f.etapas.filter((e) => e.estado === 'proxima').some((e) => e.c !== f.hl)) problems.push(`[${label}] etapa próxima sem a borda em Highlight ${JSON.stringify(f.etapas)}`)
        await checkOverflow(pg, label)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      const label = 'ginasio-reduzido'
      const pg = await ginAbre(label, { save: ginSave(), chave: GIN_DEV, reducedMotion: 'reduce' })
      const parado = async (tag) => {
        const r = await pg.evaluate(() => {
          const c = document.querySelector('#tela .tela'), els = c ? [c, ...c.querySelectorAll('*')] : []
          return { n: els.length, anim: document.getAnimations().filter((a) => a.effect && a.effect.target && c && c.contains(a.effect.target)).length,
            css: els.filter((e) => { const cs = getComputedStyle(e); return cs.animationName !== 'none' || cs.transitionDuration.split(',').some((t) => parseFloat(t) > 0) }).map((e) => e.className) }
        })
        if (!r.n || r.anim || r.css.length) problems.push(`[${label}] ${tag}: algo se move ${JSON.stringify(r)}`)
      }
      try {
        await ginDevEtapas(pg, { agua: 5 })
        await ginAbreAba(pg)
        await parado('aba')
        await ginAbreTrilha(pg, 'fogo')
        await parado('trilha')
        await pg.locator('[data-acao="ginasio-etapa"][data-id="0"]').click()
        await pg.waitForSelector('#t-etapa')
        await parado('detalhe')
        await pg.goBack()
        await pg.waitForSelector('#t-ginasio')
        await pg.goBack()
        await ginAbreTrilha(pg, 'agua')
        await parado('trilha com a insígnia')
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // ---------------- Tarefa 5: o preparo (o time e o "Desafiar"), o pagamento e o resumo (spec §5, §7, §8, §10) ----------------
    // O resultado esperado sai aqui no node pelos mesmos módulos (Ginasio.resolver, Ginasio.acerto, RaceSim.learnSkill), a
    // partir do state lido da página antes de pagar (a seed do save é fixa em cada cenário); nada de número copiado à mão.
    const GIN_TAG_XP = 20000000   // Ruling 18: seedTag do sorteio de skill = 20000000 + contador · 4 + posição no time
    const ginIpe = G.STARTERS.find((h) => h.id === 'ipe')
    const ginSalaTxt = 'Está na sala aberta. Corra ou feche a sala primeiro.'
    const ginSoUmTxt = 'Seu único cavalo está na sala aberta. Corra ou feche a sala primeiro.'
    const ginCheioTxt = (n) => n === 1 ? 'O time já tem 1 cavalo. Toque nele para tirar.' : `O time já tem ${n} cavalos. Toque num deles para tirar.`
    const GIN_FALHA = 'Não foi possível salvar. Libere espaço e tente de novo.'
    const ginSemRev = (s) => { const c = JSON.parse(JSON.stringify(s)); delete c.rev; return c }
    // as chaves de primeiro nível em que a e b diferem (para a mensagem)
    const ginDifere = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => `${k}: ${JSON.stringify(b[k])} -> ${JSON.stringify(a[k])}`.slice(0, 160)).join('; ')
    const ginComProgresso = (o) => Object.assign(JSON.parse(JSON.stringify(GIN_ZERO)), o)
    // uma sala valendo aberta com a montaria m1 ativa (o mesmo formato do bloco 2)
    const ginPend = { counter: 3, training: false, fee: 50, pr: 600, gear: [], alloc: { vel: 0, acel: 0, man: 0, forca: 0, est: 0, garra: 0, sorte: 0 } }
    // o desafio no node: o state de antes (da página), o ginásio, a etapa, os uids na ordem e o dia -> { res, ac, entrada,
    // cavalos: [{ uid, nome, xp, correu, m, levels, learned }], depois (o state esperado depois de pagar, menos o rev) }.
    // O XP leva o bônus das insígnias de ANTES do desafio (a insígnia ganha nele vale dali em diante)
    const ginEsperado = (st, id, i, uids, hoje) => {
      const time = uids.map((u) => JSON.parse(JSON.stringify(st.mounts.find((m) => m.uid === u))))
      const res = GN.resolver({ gymId: id, etapa: i, time, seedBase: st.seedBase, contador: st.gymCounter })
      const ac = GN.acerto({ gymId: id, etapa: i, revanche: false, progresso: st.ginasios, resultado: res, hoje, timeLen: uids.length })
      const b = GN.bonus(st.ginasios), entrada = G.GYMS[id].etapas[i].entrada
      const depois = JSON.parse(JSON.stringify(st))
      depois.gold = st.gold - entrada + ac.ouro
      ac.itens.forEach((it) => { if (it === 'redea') depois.redeas += 1; else depois.mochila[it] += 1 })
      const cavalos = uids.map((u, k) => {
        const xp = ac.xp[k] + Math.round(ac.xp[k] * b.xp)
        const ap = ginApplyXp(time[k], xp, st.seedBase, GIN_TAG_XP + st.gymCounter * 4 + k, b.skill)
        depois.mounts[depois.mounts.findIndex((m) => m.uid === u)] = ap.m
        return { uid: u, nome: time[k].name, xp, correu: res.duelos.some((d) => d.a === k), m: ap.m, levels: ap.levels, learned: ap.learned }
      })
      depois.ginasios = ac.progresso
      depois.gymCounter = st.gymCounter + 1
      return { res, ac, entrada, cavalos, depois: ginSemRev(depois) }
    }
    // do estábulo ao preparo da etapa i (a aba, a trilha, a etapa próxima)
    const ginPreparo = async (pg, id, i) => {
      await ginAbreAba(pg)
      await ginAbreTrilha(pg, id)
      await pg.locator(`[data-acao="ginasio-etapa"][data-id="${i}"]`).click()
      await pg.waitForSelector('#t-etapa')
    }
    const ginToca = (pg, uid) => pg.locator(`#tela [data-acao="ginasio-time"][data-id="${uid}"]`).click()
    // espera o time da tela ficar igual a uids (na ordem)
    const ginEsperaTime = (pg, uids, label) => pg.waitForFunction((u) => {
      const g = window.__galope.ui.gym
      return !!g && JSON.stringify(g.time) === JSON.stringify(u) &&
        [...document.querySelectorAll('#tela [data-acao="ginasio-time"][aria-pressed="true"]')].length === u.length
    }, uids, { timeout: 3000 }).catch(() => problems.push(`${label}: o time não ficou ${JSON.stringify(uids)}`))
    // o "Seu time" e o "Desafiar" como a tela os mostra
    const ginTimeDom = (pg) => pg.evaluate(() => {
      const r = (e) => e.getBoundingClientRect()
      const bd = document.querySelector('#tela [data-acao="ginasio-desafiar"]'), caixa = bd && bd.closest('section')
      return { titulo: ((document.getElementById('t-time') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
        secao: ((document.getElementById('t-time') || { closest: () => null }).closest('section') || { textContent: '' }).textContent.replace(/\s+/g, ' '),
        linhas: [...document.querySelectorAll('#tela [data-acao="ginasio-time"]')].map((b) => ({ uid: b.getAttribute('data-id'), pressed: b.getAttribute('aria-pressed'),
          dis: b.getAttribute('aria-disabled'), motivo: b.getAttribute('data-motivo'), txt: b.textContent.replace(/\s+/g, ' ').trim(), label: b.getAttribute('aria-label') || '',
          pos: (() => { const p = b.querySelector('.gin-pos'); if (!p) return ''; const c = p.cloneNode(true); c.querySelectorAll('.ord').forEach((x) => x.remove()); return c.textContent.trim() })(), nota: ((b.parentNode.querySelector(':scope > .nota') || {}).textContent || '').trim(), h: r(b).height })),
        desafiar: bd && { txt: bd.textContent.replace(/\s+/g, ' ').trim(), dis: bd.getAttribute('aria-disabled'), motivo: bd.getAttribute('data-motivo'), h: r(bd).height,
          nota: ((caixa && caixa.querySelector(':scope > .nota')) || {}).textContent || '' },
        time: window.__galope.ui.gym ? window.__galope.ui.gym.time.slice() : null }
    })
    // Ruling 2: o ÚNICO caminho do teste do "Desafiar" ao resumo (a Tarefa 6 troca só este ajudante quando os duelos
    // passarem na tela de corrida)
    const ginDesafia = async (pg) => {
      await pg.locator('#tela [data-acao="ginasio-desafiar"]').click()
      await pg.waitForSelector('#t-resumo', { timeout: 6000 })
    }
    // toque forçado: tira o aria-disabled e clica (a ação tem de conferir tudo de novo e recusar); false = botão não achado
    const ginForca = (pg, sel) => pg.evaluate((s) => { const b = document.querySelector(s); if (!b) return false; b.removeAttribute('aria-disabled'); b.click(); return true }, sel)
    // grava o save mudado por "outra aba" (src: corpo de função sobre s) e, com evento, dispara o storage nesta aba
    const ginOutraAba = (pg, src, evento = true) => pg.evaluate(([k, src, ev]) => {
      const s = JSON.parse(localStorage.getItem(k))
      ;(new Function('s', src))(s)
      s.rev += 10
      const raw = JSON.stringify(s)
      localStorage.setItem(k, raw)
      if (ev) window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: raw }))
      return raw
    }, [GIN_DEV, src, evento])
    // nada do desafio calculado antes de pagar: ui.gym.res null, contador e disco iguais, nenhum texto de resultado na tela
    const ginNadaAntes = async (label, pg, st0, d0) => {
      const x = await pg.evaluate(() => ({ res: window.__galope.ui.gym ? window.__galope.ui.gym.res : 'sem ui.gym', c: window.__galope.state.gymCounter,
        txt: document.getElementById('tela').textContent, resumo: !!document.getElementById('t-resumo') }))
      if (x.res !== null || x.c !== st0.gymCounter || x.resumo || /Vitória!|Derrota|Duelo \d/.test(x.txt)) problems.push(`${label}: algo do desafio existe antes de pagar ${JSON.stringify({ res: x.res, c: x.c, resumo: x.resumo })}`)
      if ((await ginDisco(pg)) !== d0) problems.push(`${label}: o disco mudou antes de pagar`)
    }
    // nada cobrado: o state (menos o rev) igual ao de referência, e o disco ou intocado (byte a byte) ou com esse mesmo state
    // (o desafia grava o save como está antes de conferir, o padrão do usaItem; o save que a "outra aba" gravou ainda não
    // estava saneado, por isso a comparação é com o state da memória)
    const ginNadaCobrado = async (label, pg, stRef, dRef) => {
      const s = await ginEstado(pg), raw = await ginDisco(pg)
      if (!ginIgual(ginSemRev(s), ginSemRev(stRef))) problems.push(`${label}: o state mudou (${ginDifere(ginSemRev(s), ginSemRev(stRef))})`)
      if (raw !== dRef && !ginIgual(ginSemRev(JSON.parse(raw)), ginSemRev(stRef))) problems.push(`${label}: o disco mudou (${ginDifere(ginSemRev(JSON.parse(raw)), ginSemRev(stRef))})`)
      if (await pg.locator('#t-resumo').count()) problems.push(`${label}: apareceu um resumo`)
    }
    // espia o Ginasio.resolver da página (o sorteio dos duelos): conta as chamadas a partir de agora
    const ginEspiaSorteio = (pg) => pg.evaluate(() => {
      const GNp = window.Ginasio
      if (!GNp.__orig) GNp.__orig = GNp.resolver
      window.__sorteios = 0
      GNp.resolver = function () { window.__sorteios += 1; return GNp.__orig.apply(this, arguments) }
    })
    const ginSorteios = (pg) => pg.evaluate(() => window.__sorteios)
    const ginVivo = (pg, txt, label) => pg.waitForFunction((t) => (document.getElementById('motivo-vivo') || {}).textContent === t, txt, { timeout: 3000 })
      .catch(async () => problems.push(`${label}: a região viva não disse "${txt}" (disse "${await pg.evaluate(() => (document.getElementById('motivo-vivo') || {}).textContent)}")`))
    // o motivo do "Desafiar" apagado: no data-motivo e escrito embaixo dele
    const ginDesafiarApagado = async (label, pg, motivo) => {
      await pg.waitForFunction((m) => { const b = document.querySelector('#tela [data-acao="ginasio-desafiar"]'); return !!b && b.getAttribute('data-motivo') === m }, motivo, { timeout: 3000 }).catch(() => {})
      const d = (await ginTimeDom(pg)).desafiar
      if (!d || d.dis !== 'true' || d.motivo !== motivo || d.nota !== motivo) problems.push(`${label}: o "Desafiar" devia estar apagado com "${motivo}" ${JSON.stringify(d)}`)
    }
    // o resumo: título, um duelo por linha (metros inteiros; o fôlego de quem seguiu), Ouro, XP de cada cavalo (níveis e
    // skill), itens, insígnia e a etapa liberada, com os textos montados aqui do esperado e do catálogo
    const ginConfereResumo = async (label, pg, esp, id, i) => {
      const g = G.GYMS[id], e = g.etapas[i], adv = e.cavalos.map((c) => GN.cavalo(c).name), R = esp.res
      const d = await pg.evaluate(() => ({ titulo: (document.getElementById('t-resumo') || {}).textContent, foco: document.activeElement && document.activeElement.id,
        txt: document.getElementById('tela').textContent.replace(/\s+/g, ' '),
        duelos: [...document.querySelectorAll('#tela .gin-duelo')].map((li) => ({ txt: (li.querySelector('.gin-duelo-txt') || {}).textContent, tag: (li.querySelector('.gin-duelo-tag') || {}).textContent,
          folego: (li.querySelector('.gin-duelo-folego') || {}).textContent || null })),
        cavalos: [...document.querySelectorAll('#tela .gin-xp > li')].map((li) => ({ uid: li.getAttribute('data-uid'), txt: li.textContent.replace(/\s+/g, ' ').trim() })),
        ins: [...document.querySelectorAll('#tela img.icone')].map((x) => x.className), botoes: [...document.querySelectorAll('#tela .tela button')].map((b) => b.getAttribute('data-acao') + ':' + b.getAttribute('data-id')),
        res: JSON.parse(JSON.stringify(window.__galope.ui.gym.res)) }))
      if (d.titulo !== (R.venceu ? 'Vitória!' : 'Derrota')) problems.push(`${label}: título do resumo "${d.titulo}"`)
      if (d.foco !== 't-resumo') problems.push(`${label}: o foco não foi ao título do resumo (${d.foco})`)
      if (d.duelos.length !== R.duelos.length) problems.push(`${label}: ${d.duelos.length} duelos no resumo (esperado ${R.duelos.length})`)
      R.duelos.forEach((x, k) => {
        const a = esp.cavalos[x.a].nome, b = adv[x.b], jog = x.vencedor === 'jogador', quem = jog ? a : b, m = Math.round(x.metros)
        const txt = `Duelo ${k + 1}: ${a} × ${b} — ${quem} vence ` + (m === 0 ? 'por menos de 1 m' : `por ${m} m`)
        const prox = R.duelos[k + 1], f = prox ? (jog ? prox.folegoA : prox.folegoB) : null
        const fTxt = f !== null && f < 1 ? `${quem} segue com ${Math.round(f * 100)}% do fôlego` : null
        const y = d.duelos[k] || {}
        if (y.txt !== txt || y.tag !== (jog ? 'Você venceu' : 'Você perdeu') || y.folego !== fTxt) problems.push(`${label}: duelo ${k + 1} ${JSON.stringify(y)} (esperado ${JSON.stringify({ txt, fTxt })})`)
        // o resultado guardado para a Tarefa 6 é o do módulo (com a cfg e a seed do contador)
        if (!d.res || !d.res.duelos[k] || d.res.duelos[k].cfg.seed !== x.cfg.seed || d.res.duelos[k].vencedor !== x.vencedor) problems.push(`${label}: ui.gym.res.duelos[${k}] difere do Ginasio.resolver`)
      })
      for (const t of [`Entrada: −${ginFmt(esp.entrada)} de Ouro`, ...esp.ac.itens.map((it) => '1 ' + G.ITEMS[it].name)]) if (!d.txt.includes(t)) problems.push(`${label}: resumo sem "${t}"`)
      if (esp.ac.ouro !== 0 && !d.txt.includes(`Prêmio: +${ginFmt(esp.ac.ouro)} de Ouro`)) problems.push(`${label}: resumo sem o prêmio ${esp.ac.ouro}`)
      if (esp.ac.ouro === 0 && /Prêmio:/.test(d.txt)) problems.push(`${label}: resumo com prêmio sem ter ganho`)
      if (d.cavalos.map((c) => c.uid).join() !== esp.cavalos.map((c) => c.uid).join()) problems.push(`${label}: cavalos do resumo ${d.cavalos.map((c) => c.uid).join()}`)
      esp.cavalos.forEach((c, k) => {
        const y = (d.cavalos[k] || {}).txt || ''
        const partes = c.correu ? [`${c.nome}: +${c.xp} XP`] : [`${c.nome}: não correu`]
        if (c.levels) partes.push(`subiu ${c.levels === 1 ? '1 nível' : c.levels + ' níveis'} (Nível ${c.m.level})`)
        c.learned.forEach((s) => partes.push('aprendeu ' + G.SKILLS[s].name))
        for (const t of partes) if (!y.includes(t)) problems.push(`${label}: a linha de ${c.nome} sem "${t}": ${y}`)
        if (!c.levels && /subiu/.test(y)) problems.push(`${label}: a linha de ${c.nome} diz que subiu: ${y}`)
      })
      const temIns = esp.ac.insignia
      if (temIns !== d.ins.some((k) => k.includes('icone--' + g.insignia.icone)) || temIns !== d.txt.includes(g.insignia.name)) problems.push(`${label}: insígnia no resumo devia ser ${temIns}`)
      const prox = esp.ac.progresso[id].etapa
      const liberada = R.venceu && prox < g.etapas.length ? `Próxima etapa liberada: ${g.etapas[prox].nome}` : null
      if (liberada ? !d.txt.includes(liberada) : /Próxima etapa liberada/.test(d.txt)) problems.push(`${label}: "Próxima etapa liberada" devia ser ${JSON.stringify(liberada)}`)
      const esperaBotoes = (R.venceu ? [] : ['ginasio-resumo:denovo']).concat(['ginasio-resumo:trilha'])
      if (d.botoes.join() !== esperaBotoes.join()) problems.push(`${label}: botões do resumo ${d.botoes.join()} (esperado ${esperaBotoes.join()})`)
      const hs = await pg.evaluate(() => [...document.querySelectorAll('#tela .tela button')].map((b) => b.getBoundingClientRect().height))
      if (hs.some((h) => h < 44)) problems.push(`${label}: botão do resumo com menos de 44 px ${hs.join()}`)
      await ginVivo(pg, R.venceu ? 'Vitória!' : 'Derrota', label)
    }

    // 10. o preparo (decisões 1–5, 8, 22, 25), a 360×780, 360×640 e 1280: o adversário, a pista, a entrada e o prêmio
    //     continuam; "Seu time (até 2 cavalos)" com cada cavalo (nome, elemento, Poder e, por escrito, a vantagem); o time
    //     começa vazio e o "Desafiar" apagado com o motivo; a ordem é a dos toques; o time cheio apaga os de fora com o
    //     motivo; nada calculado antes de pagar
    for (const vp of [{ width: 360, height: 780 }, { width: 360, height: 640 }, { width: 1280, height: 800 }]) {
      const label = 'ginasio-preparo-' + vp.width + 'x' + vp.height
      const mounts = [ginCav(ginBrasa, { uid: 'm1', level: 10 }), ginCav(ginMare, { uid: 'm2', level: 4 }), ginCav(ginIpe, { uid: 'm3', level: 6 })]
      const pg = await ginAbre(label, { save: ginSave({ mounts, nextUid: 4, ginasios: ginComProgresso({ fogo: { etapa: 2, revDia: null, revVitorias: 0 } }) }), vp })
      try {
        await ginOuroInf(pg, false)
        const st0 = await ginEstado(pg), d0 = await ginDisco(pg)
        await ginEspiaSorteio(pg)
        await ginPreparo(pg, 'fogo', 2)
        await checkOverflow(pg, label)
        await ginConfereDetalhe(label, pg, 'fogo', 2)
        let t = await ginTimeDom(pg)
        if (t.titulo !== 'Seu time (até 2 cavalos)') problems.push(`${label}: título do time "${t.titulo}"`)
        if (t.linhas.map((l) => l.uid).join() !== 'm1,m2,m3') problems.push(`${label}: linhas do time ${t.linhas.map((l) => l.uid).join()}`)
        // a vantagem por escrito (Ginasio.vantagem contra o elemento do ginásio): Brasa nada, Maré vantagem, Ipê desvantagem
        const vants = st0.mounts.map((m) => GN.vantagem(m.element, G.GYMS.fogo.element))
        if (vants.join() !== '0,1,-1') problems.push(`${label}: o save devia ter um cavalo de cada relação (${vants.join()})`)
        st0.mounts.forEach((m, k) => {
          const l = t.linhas[k]
          if (!l) return problems.push(`${label}: sem a linha de ${m.uid}`)
          for (const x of [m.name, G.ELEMENTS[m.element].name, 'Poder ' + S.powerRating(m)]) if (!l.txt.includes(x)) problems.push(`${label}: linha de ${m.uid} sem "${x}": ${l.txt}`)
          if (!l.label.includes('nível ' + m.level)) problems.push(`${label}: a linha de ${m.uid} não diz o nível no nome acessível: ${l.label}`)
          const v = vants[k], vTxt = v === 1 ? 'Vantagem' : v === -1 ? 'Desvantagem' : null
          if (vTxt ? !(l.txt.includes(vTxt) && l.label.includes(vTxt)) : /Vantagem|Desvantagem/.test(l.txt + l.label)) problems.push(`${label}: a vantagem de ${m.uid} devia ser ${vTxt}: ${l.txt} / ${l.label}`)
          if (v === 1 && /Desvantagem/.test(l.txt)) problems.push(`${label}: ${m.uid} com as duas relações`)
          if (l.pressed !== 'false' || l.dis !== null || l.pos !== '' || l.h < 44) problems.push(`${label}: a linha de ${m.uid} no time vazio ${JSON.stringify(l)}`)
        })
        if (JSON.stringify(t.time) !== '[]') problems.push(`${label}: o time não começou vazio ${JSON.stringify(t.time)}`)
        if (!t.desafiar || t.desafiar.txt !== 'Desafiar (40 de Ouro)' || t.desafiar.h < 44) problems.push(`${label}: o botão Desafiar ${JSON.stringify(t.desafiar)}`)
        await ginDesafiarApagado(label + ' vazio', pg, 'Escolha pelo menos 1 cavalo.')
        await ginNadaAntes(label + ' vazio', pg, st0, d0)
        // o "Desafiar" apagado tocado de verdade só diz o porquê
        await pg.locator('#tela [data-acao="ginasio-desafiar"]').click({ force: true })   // o toque real (aria-disabled: o Playwright só clica com force)
        await ginVivo(pg, 'Escolha pelo menos 1 cavalo.', label)
        await ginNadaCobrado(label + ' desafiar vazio', pg, st0, d0)
        // Maré, depois Brasa: 1º e 2º; o Ipê fica apagado com o motivo do time cheio
        await ginToca(pg, 'm2')
        await ginEsperaTime(pg, ['m2'], label)
        await ginToca(pg, 'm1')
        await ginEsperaTime(pg, ['m2', 'm1'], label)
        t = await ginTimeDom(pg)
        const [l1, l2, l3] = t.linhas
        if (l2.pressed !== 'true' || l2.pos !== '1º' || !l2.label.includes('1º do time')) problems.push(`${label}: Maré devia ser o 1º ${JSON.stringify(l2)}`)
        if (l1.pressed !== 'true' || l1.pos !== '2º' || !l1.label.includes('2º do time')) problems.push(`${label}: Brasa devia ser o 2º ${JSON.stringify(l1)}`)
        if (l3.pressed !== 'false' || l3.dis !== 'true' || l3.motivo !== ginCheioTxt(2) || l3.nota !== ginCheioTxt(2)) problems.push(`${label}: com o time cheio o Ipê devia estar apagado com o motivo ${JSON.stringify(l3)}`)
        // o nome acessível da linha apagada diz o motivo, não a instrução que não funciona
        if (!l3.label.includes(ginCheioTxt(2)) || /Toque para pôr no time/.test(l3.label)) problems.push(`${label}: o nome acessível do Ipê apagado devia dizer o motivo: ${l3.label}`)
        if (!l2.label.includes('Toque para tirar') || /Toque para pôr no time/.test(t.linhas[0].label + l2.label)) problems.push(`${label}: nomes acessíveis dos escolhidos`)
        if (!t.desafiar || t.desafiar.dis !== null || t.desafiar.nota) problems.push(`${label}: com 2 cavalos o Desafiar devia estar livre ${JSON.stringify(t.desafiar)}`)
        // o toque real no apagado diz o motivo; o forçado não põe no time
        await pg.locator('#tela [data-acao="ginasio-time"][data-id="m3"]').click({ force: true })
        await ginVivo(pg, ginCheioTxt(2), label)
        if (!(await ginForca(pg, '#tela [data-acao="ginasio-time"][data-id="m3"]'))) problems.push(`${label}: sem a linha do Ipê para o toque forçado`)
        await sleep(100)
        if (JSON.stringify((await ginTimeDom(pg)).time) !== '["m2","m1"]') problems.push(`${label}: o toque forçado pôs o 3º cavalo no time`)
        // tirar a Maré: a Brasa sobe para 1º; pôr de novo: a ordem é a dos toques (Brasa, Maré)
        await ginToca(pg, 'm2')
        await ginEsperaTime(pg, ['m1'], label)
        t = await ginTimeDom(pg)
        if (t.linhas[0].pos !== '1º' || t.linhas[1].pressed !== 'false' || t.linhas[2].dis !== null) problems.push(`${label}: tirar a Maré ${JSON.stringify(t.linhas)}`)
        await ginToca(pg, 'm2')
        await ginEsperaTime(pg, ['m1', 'm2'], label)
        t = await ginTimeDom(pg)
        if (t.linhas[0].pos !== '1º' || t.linhas[1].pos !== '2º') problems.push(`${label}: a ordem não é a dos toques ${JSON.stringify(t.linhas.map((l) => l.pos))}`)
        await ginNadaAntes(label + ' com time', pg, st0, d0)
        if ((await ginSorteios(pg)) !== 0) problems.push(`${label}: montar o time sorteou os duelos`)
        await checkOverflow(pg, label + ' com time')
        const hs = await pg.evaluate(() => [...document.querySelectorAll('#tela button')].map((b) => [b.getAttribute('data-acao'), b.getBoundingClientRect().height]))
        if (hs.some(([, h]) => h < 44)) problems.push(`${label}: botão com menos de 44 px no preparo ${JSON.stringify(hs)}`)
        // o foco do teclado no "Desafiar" aparece (anel de 2 px ou mais)
        await pg.locator('#tela [data-acao="ginasio-time"][data-id="m3"]').focus()
        await pg.keyboard.press('Tab')
        const foco = await pg.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { acao: a.getAttribute('data-acao'), s: cs.outlineStyle, w: cs.outlineWidth, fv: a.matches(':focus-visible') } })
        if (foco.acao !== 'ginasio-desafiar' || foco.s === 'none' || parseFloat(foco.w) < 2 || !foco.fv) problems.push(`${label}: o foco do teclado no Desafiar não aparece ${JSON.stringify(foco)}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 10b. limite 1 (soldados 1 e 2): o mesmo comportamento, sem troca automática
    {
      const label = 'ginasio-preparo-limite-1'
      const pg = await ginAbre(label, { save: ginSave() })
      try {
        await ginPreparo(pg, 'grama', 0)
        let t = await ginTimeDom(pg)
        if (t.titulo !== 'Seu time (até 1 cavalo)') problems.push(`${label}: título do time "${t.titulo}"`)
        await ginToca(pg, 'm2')
        await ginEsperaTime(pg, ['m2'], label)
        t = await ginTimeDom(pg)
        if (t.linhas[0].dis !== 'true' || t.linhas[0].motivo !== ginCheioTxt(1) || t.linhas[0].nota !== ginCheioTxt(1) || t.linhas[1].pos !== '1º') problems.push(`${label}: com o time de 1 cheio ${JSON.stringify(t.linhas)}`)
        await pg.locator('#tela [data-acao="ginasio-time"][data-id="m1"]').click({ force: true })
        await ginVivo(pg, ginCheioTxt(1), label)
        if (JSON.stringify((await ginTimeDom(pg)).time) !== '["m2"]') problems.push(`${label}: o toque no apagado trocou o cavalo do time`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 11. vencer uma etapa (seed 94: a Maré vence o Cabo Tocha, sobe 1 nível e aprende uma skill): Ouro (− entrada +
    //     prêmio), o XP, o item na mochila, a etapa marcada, a seguinte aberta, gymCounter + 1, igual no disco; o resumo; o
    //     voltar do aparelho leva à trilha (a etapa vencida não se toca de novo); o desafio forçado da etapa vencida recusa;
    //     recarregar mostra a trilha já atualizada
    {
      const label = 'ginasio-vence'
      const mounts = [ginCav(ginBrasa, { uid: 'm1', level: 10 }), ginCav(ginMare, { uid: 'm2', level: 20, xp: G.ECONOMY.xpToLevel(20) - 10 })]
      const pg = await ginAbre(label, { save: ginSave({ seedBase: 94, gold: 1000, mounts, mochila: { torrao: 3, estrela: 0, cupom: 0, manual: 0 }, ginasios: ginComProgresso({ fogo: { etapa: 1, revDia: null, revVitorias: 0 } }) }) })
      try {
        await ginOuroInf(pg, false)
        await ginPreparo(pg, 'fogo', 1)
        await ginToca(pg, 'm2')
        await ginEsperaTime(pg, ['m2'], label)
        const st0 = await ginEstado(pg), d0 = await ginDisco(pg), hoje = await ginHoje(pg)
        const esp = ginEsperado(st0, 'fogo', 1, ['m2'], hoje)
        if (!esp.res.venceu || esp.cavalos[0].levels !== 1 || esp.cavalos[0].learned.length !== 1 || esp.ac.itens.join() !== 'torrao') problems.push(`${label}: o cenário precisa de uma vitória com 1 nível, 1 skill e o Torrão (troque a seedBase) ${JSON.stringify({ v: esp.res.venceu, c: esp.cavalos[0], it: esp.ac.itens })}`)
        if (esp.res.duelos[0].cfg.seed !== S.hash2(94, GN.SAL + 0)) problems.push(`${label}: a seed do duelo não é a do contador 0`)
        await ginNadaAntes(label, pg, st0, d0)
        await ginDesafia(pg)
        const s1 = await ginEstado(pg), disco = JSON.parse(await ginDisco(pg))
        if (!ginIgual(ginSemRev(s1), esp.depois)) problems.push(`${label}: o state depois do desafio difere do esperado ` + JSON.stringify({ gold: s1.gold, mochila: s1.mochila, gin: s1.ginasios.fogo, c: s1.gymCounter, m2: s1.mounts[1] }))
        if (!ginIgual(ginSemRev(disco), ginSemRev(s1)) || !(disco.rev > JSON.parse(d0).rev)) problems.push(`${label}: o disco difere da memória depois do desafio`)
        // e os números fixos do catálogo (não só "o mesmo que o módulo")
        if (s1.gold !== 1000 - 30 + 120 || s1.mochila.torrao !== 4 || s1.ginasios.fogo.etapa !== 2 || s1.gymCounter !== 1 || s1.mounts[1].level !== 21) problems.push(`${label}: Ouro, Torrão, etapa, contador ou nível ${JSON.stringify({ gold: s1.gold, t: s1.mochila.torrao, e: s1.ginasios.fogo.etapa, c: s1.gymCounter, n: s1.mounts[1].level })}`)
        await ginConfereResumo(label, pg, esp, 'fogo', 1)
        await checkOverflow(pg, label + ' resumo')
        // o voltar do aparelho no resumo: a trilha, com a etapa vencida e a seguinte aberta
        await pg.goBack()
        await pg.waitForSelector('#t-ginasio')
        ginConfereTrilha(label + ' trilha', await ginTrilha(pg), 'fogo', 2)
        if (await pg.locator('#t-resumo').count()) problems.push(`${label}: o resumo continuou depois do voltar`)
        // vencer de novo não existe: o desafio forçado da etapa vencida recusa sem cobrar
        const s2 = await ginEstado(pg), d2 = await ginDisco(pg)
        await pg.evaluate(() => {
          window.__galope.ui.gym.etapa = 1; window.__galope.ui.gym.time = ['m2']; window.__galope.ui.gym.res = null
          const b = document.createElement('button'); b.setAttribute('data-acao', 'ginasio-desafiar'); b.id = 'forcado'; document.querySelector('#tela .tela').appendChild(b)
        })
        await pg.locator('#forcado').click()
        await ginVivo(pg, 'Esta etapa já foi vencida.', label)
        await ginNadaCobrado(label + ' vencida forçada', pg, s2, d2)
        // recarregar: a trilha já atualizada (o resumo não é gravado)
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        if (!ginIgual(ginSemRev(await ginEstado(pg)), ginSemRev(s1))) problems.push(`${label}: recarregar mudou o save`)
        await ginAbreAba(pg)
        ginConfereCartao(label + ' recarregado', (await ginAba(pg)).cartoes.find((c) => c.id === 'fogo'), 'fogo', 2, false)
        await ginAbreTrilha(pg, 'fogo')
        ginConfereTrilha(label + ' recarregado', await ginTrilha(pg), 'fogo', 2)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 12. perder (Ipê nível 1 contra o Recruta Fagulha, seed 79): só a entrada e o XP; "Tentar de novo" volta ao preparo
    //     com o mesmo time, e o desafio seguinte usa o contador seguinte (a seed do duelo é outra)
    {
      const label = 'ginasio-perde'
      const mounts = [ginCav(ginBrasa, { uid: 'm1', level: 10 }), ginCav(ginIpe, { uid: 'm2', level: 1 })]
      const pg = await ginAbre(label, { save: ginSave({ mounts, gold: 300 }) })
      try {
        await ginOuroInf(pg, false)
        await ginPreparo(pg, 'fogo', 0)
        await ginToca(pg, 'm2')
        await ginEsperaTime(pg, ['m2'], label)
        const st0 = await ginEstado(pg), hoje = await ginHoje(pg)
        const esp = ginEsperado(st0, 'fogo', 0, ['m2'], hoje)
        if (esp.res.venceu) problems.push(`${label}: o cenário precisa de uma derrota (troque o cavalo)`)
        await ginDesafia(pg)
        const s1 = await ginEstado(pg)
        if (!ginIgual(ginSemRev(s1), esp.depois)) problems.push(`${label}: o state depois da derrota difere do esperado ` + JSON.stringify({ gold: s1.gold, gin: s1.ginasios.fogo, c: s1.gymCounter }))
        if (s1.gold !== 300 - 20 || s1.ginasios.fogo.etapa !== 0 || s1.gymCounter !== 1 || esp.cavalos[0].xp !== G.GYM.xp.perde) problems.push(`${label}: derrota devia custar só a entrada e dar o XP de quem perde ${JSON.stringify({ gold: s1.gold, e: s1.ginasios.fogo.etapa, c: s1.gymCounter, xp: esp.cavalos[0].xp })}`)
        if (!ginIgual(ginSemRev(JSON.parse(await ginDisco(pg))), ginSemRev(s1))) problems.push(`${label}: o disco difere da memória depois da derrota`)
        await ginConfereResumo(label, pg, esp, 'fogo', 0)
        await pg.locator('#tela [data-acao="ginasio-resumo"][data-id="denovo"]').click()
        await pg.waitForSelector('#t-etapa')
        await ginEsperaTime(pg, ['m2'], label + ' tentar de novo')
        if (!(await pg.evaluate(() => window.__galope.ui.gym.res === null))) problems.push(`${label}: "Tentar de novo" deixou o resumo guardado`)
        const st1 = await ginEstado(pg), d1 = await ginDisco(pg)
        await ginNadaAntes(label + ' de novo', pg, st1, d1)
        const esp2 = ginEsperado(st1, 'fogo', 0, ['m2'], hoje)
        if (esp2.res.duelos[0].cfg.seed !== S.hash2(GIN_SEED, GN.SAL + 1 * 8) || esp2.res.duelos[0].cfg.seed === esp.res.duelos[0].cfg.seed) problems.push(`${label}: a 2ª tentativa devia usar o contador 1`)
        await ginDesafia(pg)
        const s2 = await ginEstado(pg)
        if (!ginIgual(ginSemRev(s2), esp2.depois) || s2.gymCounter !== 2) problems.push(`${label}: a 2ª tentativa difere do esperado ` + JSON.stringify({ gold: s2.gold, gin: s2.ginasios.fogo, c: s2.gymCounter }))
        await ginConfereResumo(label + ' 2ª', pg, esp2, 'fogo', 0)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 13. Review Focus 1: a gravação que falha (nada muda, o aviso, nenhum resumo; o contador não anda: a próxima tentativa
    //     é a mesma); duas abas, com a velha sem o evento storage: o toque nela não cobra nem sorteia de novo
    {
      const label = 'ginasio-falha'
      const pg = await ginAbre(label, { save: ginSave() })
      try {
        await ginOuroInf(pg, false)
        await ginPreparo(pg, 'fogo', 0)
        await ginToca(pg, 'm1')
        await ginEsperaTime(pg, ['m1'], label)
        const st0 = await ginEstado(pg), d0 = await ginDisco(pg), hoje = await ginHoje(pg)
        await pg.evaluate(() => { window.__setOrig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('cheio', 'QuotaExceededError') } })
        await pg.locator('#tela [data-acao="ginasio-desafiar"]').click()
        await pg.waitForFunction((f) => document.getElementById('tela').textContent.includes(f), GIN_FALHA, { timeout: 3000 }).catch(() => problems.push(`${label}: sem o aviso da falha`))
        await ginVivo(pg, GIN_FALHA, label)
        await ginNadaCobrado(label, pg, st0, d0)
        if (!(await pg.evaluate(() => window.__galope.ui.gym.res === null)) || !(await pg.locator('#t-etapa').count())) problems.push(`${label}: a falha deixou um resumo ou saiu do preparo`)
        await pg.evaluate(() => { Storage.prototype.setItem = window.__setOrig })
        const esp = ginEsperado(st0, 'fogo', 0, ['m1'], hoje)
        await ginDesafia(pg)
        if (!ginIgual(ginSemRev(await ginEstado(pg)), esp.depois)) problems.push(`${label}: depois da falha o desafio não foi o do contador 0`)
        if (/Não foi possível salvar/.test(await pg.locator('#tela').textContent())) problems.push(`${label}: o aviso da falha ficou no resumo`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      const label = 'ginasio-duas-abas'
      const pa = await ginAbre(label + ' A', { save: ginSave() })
      const pb = await pa.context().newPage()
      pb.on('console', (m) => { if (m.type() === 'error') problems.push(`[${label} B] console: ${m.text()}`) })
      pb.on('pageerror', (e) => problems.push(`[${label} B] pageerror: ${e.message}`))
      try {
        await pb.addInitScript(() => window.addEventListener('storage', (e) => e.stopImmediatePropagation(), true))
        await pb.goto(BASE + 'jogo-dev.html', { waitUntil: 'domcontentloaded' })
        await pb.waitForSelector('#t-estabulo')
        for (const p of [pa, pb]) {
          await ginOuroInf(p, false)
          await ginPreparo(p, 'fogo', 0)
          await ginToca(p, 'm1')
          await ginEsperaTime(p, ['m1'], label)
        }
        const st0 = await ginEstado(pa), hoje = await ginHoje(pa)
        const esp = ginEsperado(st0, 'fogo', 0, ['m1'], hoje)
        await ginDesafia(pa)
        const dA = await ginDisco(pa)
        if (!ginIgual(ginSemRev(JSON.parse(dA)), esp.depois)) problems.push(`${label}: a aba A não gravou o desafio esperado`)
        // a aba B ainda mostra o "Desafiar" livre (sem o evento): o toque nela não cobra nem sorteia de novo
        const tb = (await ginTimeDom(pb)).desafiar
        if (!tb || tb.dis !== null) problems.push(`${label}: a aba B já não mostra o Desafiar livre (o teste não prova nada) ${JSON.stringify(tb)}`)
        await ginEspiaSorteio(pb)
        await pb.locator('#tela [data-acao="ginasio-desafiar"]').click()
        await pb.waitForFunction(() => /outra aba/.test(document.getElementById('tela').textContent), null, { timeout: 3000 }).catch(() => problems.push(`${label}: a aba B não avisa que o jogo mudou em outra aba`))
        if ((await ginDisco(pb)) !== dA) problems.push(`${label}: o toque na aba B gravou de novo`)
        const sb = await ginEstado(pb)
        if (!ginIgual(ginSemRev(sb), ginSemRev(JSON.parse(dA))) || sb.gymCounter !== 1) problems.push(`${label}: a aba B não adotou o save da A, ou cobrou de novo ${JSON.stringify({ gold: sb.gold, c: sb.gymCounter })}`)
        if ((await pb.locator('#t-resumo').count()) || !(await pb.evaluate(() => !window.__galope.ui.gym || window.__galope.ui.gym.res === null))) problems.push(`${label}: a aba B mostrou um resumo`)
        if ((await ginSorteios(pb)) !== 0) problems.push(`${label}: a aba B sorteou os duelos (${await ginSorteios(pb)} vezes) antes de ver o save da outra aba`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pa.context().close()
      }
    }

    // 14. Review Focus 2: com o preparo aberto, outra aba muda o save (com o evento storage): o cavalo sai do save; vira o
    //     ativo de uma sala aberta; o Ouro fica reservado; a mochila enche. O "Desafiar" recusa com o motivo e nada é
    //     cobrado (também o toque forçado). E a aba velha (sem o evento): o toque adota o save, não cobra e diz o motivo
    const ginSalaSrc = (uid) => `s.activeId = '${uid}'; s.raceCounter += 1; s.pending = { counter: s.raceCounter, training: false, fee: 50, pr: 1, gear: null, alloc: s.mounts.find(function (m) { return m.uid === '${uid}' }).alloc }`
    for (const [nome, etapa, src, motivo, uidsDepois] of [
      ['some', 0, "s.mounts = s.mounts.filter(function (m) { return m.uid !== 'm2' })", 'Escolha pelo menos 1 cavalo.', []],
      ['sala', 0, ginSalaSrc('m2'), 'Maré está na sala aberta. Corra ou feche a sala primeiro.', ['m2']],
      ['ouro', 0, 's.gold = 60; ' + ginSalaSrc('m1'), 'Falta Ouro: a entrada custa 20 de Ouro. 50 de Ouro reservados para a entrada do páreo aberto: sobram 10 para gastar.', ['m2']],
      ['mochila', 1, 's.mochila.torrao = 99', `Você já tem ${ginFmt(G.BAG_MAX)} ${G.ITEMS.torrao.plural}, o máximo da mochila. Use antes de desafiar.`, ['m2']]]) {
      const label = 'ginasio-rf2-' + nome
      const pg = await ginAbre(label, { save: ginSave({ ginasios: ginComProgresso({ fogo: { etapa, revDia: null, revVitorias: 0 } }) }) })
      try {
        await ginOuroInf(pg, false)
        await ginPreparo(pg, 'fogo', etapa)
        await ginToca(pg, 'm2')
        await ginEsperaTime(pg, ['m2'], label)
        if ((await ginTimeDom(pg)).desafiar.dis !== null) problems.push(`${label}: o Desafiar já estava apagado antes da outra aba`)
        await ginOutraAba(pg, src)
        await pg.waitForFunction(() => /outra aba/.test(document.getElementById('tela').textContent), null, { timeout: 3000 }).catch(() => problems.push(`${label}: o save da outra aba não foi adotado`))
        if (!(await pg.locator('#t-etapa').count())) problems.push(`${label}: o preparo fechou com o save da outra aba`)
        await ginEsperaTime(pg, uidsDepois, label)
        await ginDesafiarApagado(label, pg, motivo)
        if (nome === 'sala') {
          const l = (await ginTimeDom(pg)).linhas.find((x) => x.uid === 'm2')
          if (!l || l.pressed !== 'true' || l.nota !== ginSalaTxt || l.dis !== null) problems.push(`${label}: a Maré no time devia mostrar o motivo e poder sair ${JSON.stringify(l)}`)
        }
        const sRef = await ginEstado(pg), dRef = await ginDisco(pg)
        await pg.locator('#tela [data-acao="ginasio-desafiar"]').click({ force: true })
        await ginVivo(pg, motivo, label)
        if (!(await ginForca(pg, '#tela [data-acao="ginasio-desafiar"]'))) problems.push(`${label}: sem o Desafiar para o toque forçado`)
        await ginVivo(pg, motivo, label + ' forçado')
        await ginNadaCobrado(label, pg, sRef, dRef)
        if (nome === 'some') {
          // o desafia confere o uid: com o time forçado a um cavalo que saiu, recusa
          await pg.evaluate(() => { window.__galope.ui.gym.time = ['m2'] })
          if (!(await ginForca(pg, '#tela [data-acao="ginasio-desafiar"]'))) problems.push(`${label}: sem o Desafiar`)
          await ginVivo(pg, 'Um cavalo do time não está mais no estábulo.', label + ' uid')
          await ginNadaCobrado(label + ' uid', pg, sRef, dRef)
        }
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    // 14b. a conferência na hora de pagar (decisão 9), com o time ou a etapa forçados por fora da tela: uid repetido, time
    //      acima do limite e etapa fechada. Recusa com o motivo, nada cobrado, nenhum sorteio, nenhum resumo, disco igual
    for (const [nome, forca, motivo] of [
      ['repetido', "g.time = ['m2', 'm2']", 'O mesmo cavalo está duas vezes no time.'],
      ['time-grande', "g.time = ['m1', 'm2', 'm3']", 'O time passou do limite: até 2 cavalos.'],
      ['fechada', "g.etapa = 3; g.time = ['m2']", 'Esta etapa ainda não está aberta.']]) {
      const label = 'ginasio-confere-' + nome
      const mounts = [ginCav(ginBrasa, { uid: 'm1', level: 10 }), ginCav(ginMare, { uid: 'm2', level: 4 }), ginCav(ginIpe, { uid: 'm3', level: 6 })]
      const pg = await ginAbre(label, { save: ginSave({ mounts, nextUid: 4, ginasios: ginComProgresso({ fogo: { etapa: 2, revDia: null, revVitorias: 0 } }) }) })
      try {
        await ginOuroInf(pg, false)
        await ginPreparo(pg, 'fogo', 2)
        await ginToca(pg, 'm2')
        await ginEsperaTime(pg, ['m2'], label)
        const sRef = await ginEstado(pg), dRef = await ginDisco(pg)
        await ginEspiaSorteio(pg)
        await pg.evaluate((src) => { const g = window.__galope.ui.gym; (new Function('g', src))(g) }, forca)
        if (!(await ginForca(pg, '#tela [data-acao="ginasio-desafiar"]'))) problems.push(`${label}: sem o Desafiar`)
        await ginVivo(pg, motivo, label)
        await ginNadaCobrado(label, pg, sRef, dRef)
        if ((await ginSorteios(pg)) !== 0) problems.push(`${label}: sorteou os duelos (${await ginSorteios(pg)} vezes)`)
        if (!(await pg.evaluate(() => window.__galope.ui.gym.res === null))) problems.push(`${label}: guardou um resumo`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      const label = 'ginasio-rf2-velha'
      const pg = await ginAbre(label, { save: ginSave() })
      try {
        // a aba velha: sem o evento storage (recarrega com o bloqueio; o save do ginAbre não é gravado de novo)
        await pg.addInitScript(() => window.addEventListener('storage', (e) => e.stopImmediatePropagation(), true))
        await pg.reload({ waitUntil: 'domcontentloaded' })
        await pg.waitForSelector('#t-estabulo')
        await ginOuroInf(pg, false)
        await ginPreparo(pg, 'fogo', 0)
        await ginToca(pg, 'm2')
        await ginEsperaTime(pg, ['m2'], label)
        const raw = await ginOutraAba(pg, ginSalaSrc('m2'), false)
        await sleep(200)
        if ((await ginTimeDom(pg)).desafiar.dis !== null) problems.push(`${label}: a aba velha já mostra o Desafiar apagado (o teste não prova nada)`)
        await ginEspiaSorteio(pg)
        await pg.locator('#tela [data-acao="ginasio-desafiar"]').click()
        await ginVivo(pg, 'Maré está na sala aberta. Corra ou feche a sala primeiro.', label)
        if ((await ginDisco(pg)) !== raw) problems.push(`${label}: o toque na aba velha gravou`)
        const s = await ginEstado(pg)
        const r0 = JSON.parse(raw)
        if (s.rev !== r0.rev || s.activeId !== 'm2' || !s.pending || s.pending.counter !== r0.pending.counter || s.gold !== r0.gold || s.gymCounter !== 0 ||
          !ginIgual(s.mounts.map((m) => [m.uid, m.level, m.xp]), r0.mounts.map((m) => [m.uid, m.level, m.xp]))) problems.push(`${label}: a aba velha não adotou o save, ou cobrou ${JSON.stringify({ rev: s.rev, a: s.activeId, gold: s.gold, c: s.gymCounter })}`)
        if (await pg.locator('#t-resumo').count()) problems.push(`${label}: a aba velha mostrou um resumo`)
        if ((await ginSorteios(pg)) !== 0) problems.push(`${label}: a aba velha sorteou os duelos (${await ginSorteios(pg)} vezes)`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 15. Review Focus 4: sem nenhum cavalo livre (o único é o ativo da sala aberta); a mochila em 99 e 999 Rédeas: motivo
    //     escrito, nada cobrado, nenhum erro. 16. A sala aberta: o ativo apagado com o motivo; o desafio com outro cavalo
    //     deixa state.pending e a corrida simulada da sala idênticos
    for (const [nome, o, id, etapa, motivo] of [
      ['sem-livre', { mounts: [ginCav(ginBrasa, { uid: 'm1', level: 10 })], nextUid: 2, raceCounter: 3, pending: ginPend }, 'fogo', 0, ginSoUmTxt],
      ['mochila-99', { mochila: { torrao: G.BAG_MAX, estrela: 0, cupom: 0, manual: 0 }, ginasios: ginComProgresso({ fogo: { etapa: 1, revDia: null, revVitorias: 0 } }) }, 'fogo', 1, `Você já tem ${ginFmt(G.BAG_MAX)} ${G.ITEMS.torrao.plural}, o máximo da mochila. Use antes de desafiar.`],
      ['redeas-999', { redeas: 999, ginasios: ginComProgresso({ agua: { etapa: 4, revDia: null, revVitorias: 0 } }) }, 'agua', 4, `Você já tem ${ginFmt(999)} ${G.ITEMS.redea.plural}, o máximo. Use antes de desafiar.`]]) {
      const label = 'ginasio-limite-' + nome
      const pg = await ginAbre(label, { save: ginSave(o) })
      try {
        await ginOuroInf(pg, false)
        await ginPreparo(pg, id, etapa)
        await checkOverflow(pg, label)
        if (nome === 'sem-livre') {
          const t = await ginTimeDom(pg)
          if (!t.secao.includes(ginSoUmTxt) || t.linhas.length) problems.push(`${label}: o "Seu time" devia dizer o que fazer, sem linhas ${JSON.stringify(t)}`)
        } else {
          await ginToca(pg, 'm2')
          await ginEsperaTime(pg, ['m2'], label)
        }
        await ginDesafiarApagado(label, pg, motivo)
        const sRef = await ginEstado(pg), dRef = await ginDisco(pg)
        await pg.locator('#tela [data-acao="ginasio-desafiar"]').click({ force: true })
        await ginVivo(pg, motivo, label)
        if (!(await ginForca(pg, '#tela [data-acao="ginasio-desafiar"]'))) problems.push(`${label}: sem o Desafiar para o toque forçado`)
        await ginVivo(pg, motivo, label + ' forçado')
        await ginNadaCobrado(label, pg, sRef, dRef)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      const label = 'ginasio-sala-aberta'
      const pg = await ginAbre(label, { save: ginSave({ raceCounter: 3, pending: ginPend }) })
      try {
        await ginOuroInf(pg, false)
        const pend0 = JSON.stringify((await ginEstado(pg)).pending), sim0 = await ginSimSala(pg)
        await ginPreparo(pg, 'fogo', 0)
        let t = await ginTimeDom(pg)
        const l1 = t.linhas.find((l) => l.uid === 'm1')
        if (!l1 || l1.dis !== 'true' || l1.motivo !== ginSalaTxt || l1.nota !== ginSalaTxt) problems.push(`${label}: o ativo da sala devia estar apagado com o motivo ${JSON.stringify(l1)}`)
        if (!(await ginForca(pg, '#tela [data-acao="ginasio-time"][data-id="m1"]'))) problems.push(`${label}: sem a linha do ativo`)
        await sleep(100)
        if (JSON.stringify((await ginTimeDom(pg)).time) !== '[]') problems.push(`${label}: o toque forçado pôs o ativo da sala no time`)
        await ginToca(pg, 'm2')
        await ginEsperaTime(pg, ['m2'], label)
        const st0 = await ginEstado(pg), esp = ginEsperado(st0, 'fogo', 0, ['m2'], await ginHoje(pg))
        await ginDesafia(pg)
        const s1 = await ginEstado(pg), d1 = JSON.parse(await ginDisco(pg))
        if (!ginIgual(ginSemRev(s1), esp.depois)) problems.push(`${label}: o desafio com a sala aberta difere do esperado`)
        if (JSON.stringify(s1.pending) !== pend0 || JSON.stringify(d1.pending) !== pend0) problems.push(`${label}: o desafio mudou state.pending ${JSON.stringify({ antes: pend0, depois: s1.pending, disco: d1.pending })}`)
        if ((await ginSimSala(pg)) !== sim0) problems.push(`${label}: o desafio mudou a corrida simulada da sala`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 17. Review Focus 4, cavalo no nível máximo: entra, corre e o XP fica no teto (como o applyXp de sempre)
    const ginForte = (tpl, uid, xp) => { const c = ginCav(tpl, { uid, level: G.ECONOMY.maxLevel, grau: 3, xp }); c.alloc = S.botAlloc(c); return c }
    {
      const label = 'ginasio-nivel-max'
      const teto = G.ECONOMY.xpToLevel(G.ECONOMY.maxLevel)
      const pg = await ginAbre(label, { save: ginSave({ mounts: [ginCav(ginBrasa, { uid: 'm1', level: 10 }), ginForte(ginMare, 'm2', teto - 10)] }) })
      try {
        await ginOuroInf(pg, false)
        await ginPreparo(pg, 'fogo', 0)
        await ginToca(pg, 'm2')
        await ginEsperaTime(pg, ['m2'], label)
        const st0 = await ginEstado(pg), esp = ginEsperado(st0, 'fogo', 0, ['m2'], await ginHoje(pg))
        if (!(esp.cavalos[0].xp > 10)) problems.push(`${label}: o cenário precisa de XP que passe do teto`)
        await ginDesafia(pg)
        const s1 = await ginEstado(pg), m2 = s1.mounts[1]
        if (!ginIgual(ginSemRev(s1), esp.depois)) problems.push(`${label}: o state difere do esperado`)
        if (m2.level !== G.ECONOMY.maxLevel || m2.xp !== teto) problems.push(`${label}: o cavalo no nível máximo ${JSON.stringify({ level: m2.level, xp: m2.xp, teto })}`)
        await ginConfereResumo(label, pg, esp, 'fogo', 0)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 18. a insígnia ao vencer o líder do Remanso (um time de 3 no nível máximo; quem não correu diz "não correu"); o XP do
    //     desafio leva o bônus de antes (a insígnia de Água vale dali em diante); o resumo a 360×780, 360×640 e 1280 sem
    //     rolagem lateral
    {
      const label = 'ginasio-insignia'
      const mounts = [ginForte(ginIpe, 'm1', 0), ginForte(ginIpe, 'm2', 0), ginForte(ginBrasa, 'm3', 0)]
      const pg = await ginAbre(label, { save: ginSave({ mounts, nextUid: 4, ginasios: ginComProgresso({ agua: { etapa: 4, revDia: null, revVitorias: 0 } }) }) })
      try {
        await ginOuroInf(pg, false)
        await ginPreparo(pg, 'agua', 4)
        if ((await ginTimeDom(pg)).titulo !== 'Seu time (até 3 cavalos)') problems.push(`${label}: título do time`)
        for (const [k, u] of ['m1', 'm2', 'm3'].entries()) { await ginToca(pg, u); await ginEsperaTime(pg, ['m1', 'm2', 'm3'].slice(0, k + 1), label) }
        const st0 = await ginEstado(pg), esp = ginEsperado(st0, 'agua', 4, ['m1', 'm2', 'm3'], await ginHoje(pg))
        if (!esp.res.venceu || !esp.ac.insignia) problems.push(`${label}: o cenário precisa vencer o líder`)
        // o bônus de Água tem de aparecer se entrasse (50 × 3% = 1,5: arredonda para 2): o 1º vence pelo menos um duelo
        if (!(esp.ac.xp[0] >= G.GYM.xp.vence) || esp.cavalos.some((c) => c.correu) !== true || !esp.cavalos.some((c) => !c.correu)) problems.push(`${label}: o cenário precisa do 1º vencendo e de alguém que não correu ${JSON.stringify(esp.ac.xp)}`)
        await ginDesafia(pg)
        const s1 = await ginEstado(pg)
        if (!ginIgual(ginSemRev(s1), esp.depois)) problems.push(`${label}: o state depois do líder difere do esperado`)
        // o XP é o cru (sem a insígnia de Água que acabou de sair)
        if (s1.mounts[0].xp !== st0.mounts[0].xp + esp.ac.xp[0]) problems.push(`${label}: o XP do desafio levou o bônus da insígnia ganha nele ${JSON.stringify({ xp: s1.mounts[0].xp, cru: esp.ac.xp[0] })}`)
        if (s1.ginasios.agua.etapa !== 5 || s1.redeas !== 1 || s1.mochila.cupom !== 1 || s1.gold !== 5000 - 100 + 400) problems.push(`${label}: insígnia, Rédea, Cupom ou Ouro ${JSON.stringify({ e: s1.ginasios.agua, r: s1.redeas, c: s1.mochila.cupom, g: s1.gold })}`)
        if (!ginIgual(await ginBonus(pg), { ouro: 0, xp: 0.03, skill: 0 })) problems.push(`${label}: o bônus da insígnia de Água não ligou`)
        await ginConfereResumo(label, pg, esp, 'agua', 4)
        if (!(await pg.locator('#tela').textContent()).includes(G.GYMS.agua.insignia.name)) problems.push(`${label}: sem o nome da insígnia`)
        await checkOverflow(pg, label + ' 360')
        await pg.setViewportSize({ width: 360, height: 640 })
        await sleep(200)
        await checkOverflow(pg, label + ' 360x640')
        await pg.setViewportSize({ width: 1280, height: 800 })
        await sleep(200)
        await checkOverflow(pg, label + ' 1280')
        await pg.goBack()
        await pg.waitForSelector('#t-ginasio')
        ginConfereTrilha(label + ' trilha', await ginTrilha(pg), 'agua', 5)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 19. cores forçadas (as linhas do time e o Desafiar com borda de 2 px em cor do sistema; a escolhida em Highlight; os
    //     duelos do resumo com borda) e movimento reduzido (nada se move no preparo nem no resumo)
    {
      const label = 'ginasio-desafio-forcado'
      const pg = await ginAbre(label, { save: ginSave(), forcedColors: 'active' })
      try {
        await ginPreparo(pg, 'fogo', 0)
        await ginToca(pg, 'm1')
        await ginEsperaTime(pg, ['m1'], label)
        const borda = (sel) => pg.evaluate((s) => {
          const sonda = (c) => { const d = document.createElement('i'); d.style.border = '2px solid ' + c; document.body.appendChild(d); const v = getComputedStyle(d).borderTopColor; d.remove(); return v }
          return { sis: ['CanvasText', 'ButtonText', 'GrayText', 'Highlight'].map(sonda), hl: sonda('Highlight'),
            els: [...document.querySelectorAll(s)].map((e) => { const cs = getComputedStyle(e); return { w: cs.borderTopWidth, s: cs.borderTopStyle, c: cs.borderTopColor, p: e.getAttribute('aria-pressed') } }) }
        }, sel)
        let f = await borda('#tela [data-acao="ginasio-time"], #tela [data-acao="ginasio-desafiar"], #tela .gin-vant')
        if (f.els.length < 4 || f.els.some((e) => e.w !== '2px' || e.s !== 'solid' || !f.sis.includes(e.c))) problems.push(`[${label}] preparo sem borda de 2 px em cor do sistema ${JSON.stringify(f.els)}`)
        if (f.els.filter((e) => e.p === 'true').some((e) => e.c !== f.hl) || !f.els.some((e) => e.p === 'true')) problems.push(`[${label}] o cavalo escolhido sem a borda em Highlight ${JSON.stringify(f.els)}`)
        await ginDesafia(pg)
        f = await borda('#tela .gin-duelo, #tela .gin-duelo-tag, #tela [data-acao="ginasio-resumo"]')
        if (f.els.length < 3 || f.els.some((e) => e.w !== '2px' || e.s !== 'solid' || !f.sis.includes(e.c))) problems.push(`[${label}] resumo sem borda de 2 px em cor do sistema ${JSON.stringify(f.els)}`)
        await checkOverflow(pg, label)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }
    {
      const label = 'ginasio-desafio-reduzido'
      const pg = await ginAbre(label, { save: ginSave(), reducedMotion: 'reduce' })
      const parado = async (tag) => {
        const r = await pg.evaluate(() => {
          const c = document.querySelector('#tela .tela'), els = c ? [c, ...c.querySelectorAll('*')] : []
          return { n: els.length, anim: document.getAnimations().filter((a) => a.effect && a.effect.target && c && c.contains(a.effect.target)).length,
            css: els.filter((e) => { const cs = getComputedStyle(e); return cs.animationName !== 'none' || cs.transitionDuration.split(',').some((t) => parseFloat(t) > 0) }).map((e) => e.className) }
        })
        if (!r.n || r.anim || r.css.length) problems.push(`[${label}] ${tag}: algo se move ${JSON.stringify(r)}`)
      }
      try {
        await ginPreparo(pg, 'fogo', 0)
        await ginToca(pg, 'm1')
        await ginEsperaTime(pg, ['m1'], label)
        await parado('preparo')
        await ginDesafia(pg)
        await parado('resumo')
        // o foco do teclado no botão do resumo aparece
        await pg.keyboard.press('Tab')
        const foco = await pg.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { acao: a.getAttribute('data-acao'), s: cs.outlineStyle, w: cs.outlineWidth } })
        if (foco.acao !== 'ginasio-resumo' || foco.s === 'none' || parseFloat(foco.w) < 2) problems.push(`[${label}] o foco do teclado no botão do resumo não aparece ${JSON.stringify(foco)}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
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
  {   // corrida (e as partes corrida-*, cada uma na sua página): as ajudas abaixo valem para todas
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
            // o texto visível (fora dos .sr) e o que o leitor de tela lê (fora dos aria-hidden): o número do Dado leva um
            // .sr "dado " antes dele e, em tela baixa, a posição fica num .sr no lugar dela
            const visto = (el) => Array.from(el.childNodes).filter((x) => !(x.nodeType === 1 && x.classList.contains('sr'))).map((x) => x.textContent).join('')
            const lido = (el) => Array.from(el.childNodes).map((x) => x.nodeType === 3 ? x.nodeValue : x.nodeType === 1 && x.getAttribute('aria-hidden') !== 'true' ? lido(x) : '').join('')
            const txt1 = pos && Array.from(pos.childNodes).find((x) => x.nodeType === 3)
            return { raia: Number(li.dataset.raia), voce: li.classList.contains('ordem-item--voce'), pos: txt1 ? txt1.nodeValue : null, acessivel: lido(li),
              ord: ord ? ord.getAttribute('aria-hidden') + ':' + ord.textContent + ':' + (srOrd && srOrd.classList.contains('sr') ? srOrd.textContent : '-') : null,
              sr: sr ? sr.textContent : null, chip: !!li.querySelector('.raia--mini'), dado: !!li.querySelector('.ordem-dado'), top: Math.round(li.getBoundingClientRect().top),
              dadoTxt: li.querySelector('.ordem-dado') ? visto(li.querySelector('.ordem-dado')) : null, maior: li.classList.contains('ordem-item--maior'),
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
        // o leitor de tela: a posição sempre (em tela baixa, no Dado, num .sr) e, no Dado, "dado N"
        if (!it.acessivel.startsWith((k + 1) + 'º') || (r.dado && !it.acessivel.includes('dado ' + num))) problems.push(`[${label}] item ${k + 1} (raia ${it.raia + 1}): texto acessível ${JSON.stringify(it.acessivel)} (esperado começar por "${k + 1}º"${r.dado ? ` e ter "dado ${num}"` : ''}; tela baixa = ${r.baixa})`)
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
      // o clima da simulação logo antes de t (comT: contando as viradas em t, a do Dado)
      const climaEm = (t, comT) => { let c = L.cond.weather; L.sim.events.forEach((e) => { if (e.type === 'clima' && (comT ? e.t <= t : e.t < t)) c = e.weather }); return c }
      const w = window.__dadoVigia = { quadros: 0, red, porDado: itens.map((d, q) => ({ t0: d.t0, t1: d.t1, winner: d.winner, revela: red ? d.t0 : d.t0 + REG * d.escala, escala: d.escala,
        antes: 0, durante: 0, girando: 0, revelado: 0, depois: 0, esperadas: esperadas[q], linhas: null, primeiro: null,
        changed: evs[q].changed, feedDado: null, feedClima: null, anuncio: null, painel: null, painelAntes: null,
        climaAntes: climaEm(d.t0, false), climaDepois: climaEm(d.t0, true), climaGirando: 0, climaRevelado: 0,
        vencNormal: 0, vencDobro: 0, placasVistas: 0 })), alturas: {}, ruins: [], nRuins: 0, maxT: 0 }
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
          // o texto visível (fora dos .sr) e o que o leitor de tela lê (fora dos aria-hidden)
          const visto = (el) => Array.from(el.childNodes).filter((x) => !(x.nodeType === 1 && x.classList.contains('sr'))).map((x) => x.textContent).join('')
          const lido = (el) => Array.from(el.childNodes).map((x) => x.nodeType === 3 ? x.nodeValue : x.nodeType === 1 && x.getAttribute('aria-hidden') !== 'true' ? lido(x) : '').join('')
          document.querySelectorAll('#ordem-lista > li').forEach((li, k) => {
            const j = Number(li.dataset.raia), pos = li.querySelector('.ordem-pos'), dd = li.querySelector('.ordem-dado')
            const txt1 = Array.from(pos.childNodes).find((x) => x.nodeType === 3), posTxt = txt1 ? txt1.nodeValue : '', maior = li.classList.contains('ordem-item--maior')
            const num = mostrado ? String(mostrado.rolls[j].best) : '', ddTxt = visto(dd), aces = lido(li)
            const espPos = mostrado && baixa ? num : String(k + 1), espDado = mostrado && !baixa ? num : ''
            if (posTxt !== espPos || ddTxt !== espDado || maior !== (!!mostrado && j === mostrado.winner)) ruim({ t, ativo: !!ativo, rev, baixa, raia: j + 1, posTxt, dado: ddTxt, maior, espPos, espDado })
            // o leitor de tela: a posição sempre (em tela baixa, no Dado, num .sr no lugar dela) e "dado N" com o número
            if (!aces.startsWith((k + 1) + 'º') || (mostrado && !aces.includes('dado ' + num))) ruim({ t, rev, baixa, raia: j + 1, acessivel: aces, esperado: (k + 1) + 'º' + (mostrado ? ' … dado ' + num : '') })
          })
          const st = FX._stats
          if (ativo) {
            const p = w.porDado[itens.indexOf(ativo)], esp = rev ? p.esperadas : ['DADO DA SORTE']
            if (rev) p.revelado++; else p.girando++
            // o painel mostra o clima de antes do Dado até a revelação
            if (!rev && painel.textContent !== p.painelAntes) ruim({ t, painelAntesDaRevelacao: painel.textContent, era: p.painelAntes })
            if (!st.faixaDado || JSON.stringify(st.faixaDadoLinhas) !== JSON.stringify(esp)) ruim({ t, rev, faixa: st.faixaDado, linhas: st.faixaDadoLinhas, esperadas: esp })
            // Ruling 18: a chuva e a névoa desenhadas na pista são as do clima de antes do Dado até a revelação
            const climaEsp = rev ? p.climaDepois : p.climaAntes
            if (st.climaPista !== climaEsp) ruim({ t, rev, climaPista: st.climaPista, esperado: climaEsp })
            else if (p.climaAntes !== p.climaDepois) { if (rev) p.climaRevelado++; else p.climaGirando++ }
            // a plaquinha do vencedor no tamanho normal (badgeSize) enquanto os dados giram e no dobro depois da
            // revelação; as dos outros, sempre no normal
            st.placas.forEach((pl) => {
              const b = FX.badgeSize(ativo.rolls[pl.racer]), dobra = rev && pl.racer === ativo.winner ? 2 : 1
              p.placasVistas++
              if (pl.w !== b.w * dobra || pl.h !== b.h * dobra) ruim({ t, rev, placa: pl.racer + 1, vencedor: pl.racer === ativo.winner, w: pl.w, h: pl.h, esperado: [b.w * dobra, b.h * dobra] })
              else if (pl.racer === ativo.winner) { if (dobra === 2) p.vencDobro++; else p.vencNormal++ }
            })
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
        narracao: { dado: p.feedDado, clima: p.feedClima, anuncio: p.anuncio, painel: p.painel, changed: p.changed },
        climaPista: { de: p.climaAntes, para: p.climaDepois, girando: p.climaGirando, revelado: p.climaRevelado } })) }
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
        // Ruling 18: num Dado que vira o clima, o clima desenhado na pista foi visto nas duas fases (com movimento
        // reduzido só a de depois: a revelação é em t0)
        if (p.climaAntes !== p.climaDepois && (p.climaRevelado < 5 || (!w.red && !p.climaGirando))) problems.push(`[${label}] Dado ${q + 1} (${p.climaAntes} → ${p.climaDepois}): clima da pista conferido em ${p.climaGirando} quadros girando e ${p.climaRevelado} revelado (esperado os dois)`)
      })
      // a plaquinha dobrada do vencedor: vista no normal (girando; não com movimento reduzido) e no dobro (revelada)
      const vN = w.porDado.reduce((a, p) => a + p.vencNormal, 0), vD = w.porDado.reduce((a, p) => a + p.vencDobro, 0)
      notes[label + '-dado'].placaVencedor = { normal: vN, dobro: vD, placas: w.porDado.map((p) => p.placasVistas) }
      if (!vD || (!w.red && !vN)) problems.push(`[${label}] Dado: plaquinha do vencedor conferida em ${vN} quadros no tamanho normal e ${vD} no dobro (esperado os dois vistos)`)
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
      const w = window.__baloesVigia = { vistos: 0, inteirosLongos: 0, ruins: 0, ex: [], linhas: s.linhasBalao, lane: s.lay.laneArt, pilhas: 0, cobertos: 0, foraDaPista: 0, exCobre: null }
      const cruza = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      const tick = () => {
        if (!window.__galope.race) return
        const t = s.simT, cx = FX._stats.caixasBaloes
        // nenhum balão mais velho (pilha > 0) cobre um mais novo do mesmo cavalo (o de texto, pilha 0, mostra o nome
        // inteiro) e nenhum sai da pista
        cx.forEach((b) => {
          if (b.x < 0 || b.x + b.w > s.lay.artW) w.foraDaPista++
          if (b.pilha === 0) return
          w.pilhas++
          const c = cx.find((o) => o.racer === b.racer && o.pilha < b.pilha && cruza(b, o))
          if (c) { w.cobertos++; w.exCobre = w.exCobre || { t, velho: b, novo: c } }
        })
        cx.forEach((b) => {
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
    if (quer('corrida')) for (const [vp, baixa] of [[{ width: 360, height: 780 }, false], [{ width: 360, height: 640 }, true]]) {
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
        if (bv.cobertos || bv.foraDaPista) problems.push(`[${label}] plaquinhas: ${bv.cobertos} quadros com um balão mais velho por cima de um mais novo do mesmo cavalo e ${bv.foraDaPista} fora da pista, ex.: ${JSON.stringify(bv.exCobre)}`)
      } catch (e) {
        problems.push(`[${label}] ` + e.message)
      } finally {
        await pg.context().close()
      }
    }

    // 390x844: sem rolagem lateral com o .sr dos ordinais na narração e na faixa
    if (quer('corrida-390')) {
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
    if (quer('corrida-forcado')) {
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
    if (quer('corrida-girar')) {
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
    if (quer('corrida-paisagem-8')) {
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
    if (quer('corrida-8')) {
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
    if (quer('corrida-lugar-dado')) for (const [seed, embaixo] of [[102, true], [SEED8, false]]) {
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
    if (quer('corrida-lugar-dado-redimensiona')) {
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
    if (quer('corrida-etiquetas-dado')) {
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
    if (quer('corrida-faixa-lugar')) for (const [seed, esperado, vp] of [[3, 'VITÓRIA!', { width: 360, height: 780 }], [12, '3º LUGAR', { width: 360, height: 640 }],
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
    if (quer('corrida-faixa-lugar-pular')) {
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
    if (quer('corrida-faixa-lugar-pular-antes')) {
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
    if (quer('corrida-dado-reduzido')) {
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
    // seedBase do perfil DEV fixo (Ruling 21): o perfil novo sorteia o dele (crypto.getRandomValues), e a skill que o
    // cavalo aprende ao subir de nível sai de hash2(seedBase, …). Com uma skill aprendida na vitória, o Poder sobe, a sala
    // da seed 12 vem com rivais mais fortes e o resultado deixa de ser o pódio sem prêmio (falhava ~1 em 10)
    const SEED_BASE_RES = 7
    const MIN_ENTRADA = Math.min(...G.ECONOMY.entryTiers)
    // do resultado (ou de qualquer tela com a casca) até o próximo resultado da seed; prep(pg) roda na largada
    const correAteResultado = async (pg, seed, prep) => {
      if (await pg.locator('#t-resultado').count()) { await pg.locator('[data-acao="voltar"]').click(); await pg.waitForSelector('#t-correr') }
      await pg.evaluate((b) => { window.__galope.state.seedBase = b }, SEED_BASE_RES)
      await devArmar(pg, { seed })
      await abrirSala(pg)
      // só larga com a sala da seed armada e o seedBase fixo
      await pg.waitForFunction(([sd, b]) => { const G = window.__galope; return !!G.ui.lobby && G.ui.lobby.seed === sd && G.state.seedBase === b }, [seed, SEED_BASE_RES], { timeout: 5000 })
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
      // capturas oficiais (na rodada completa; com UI_SO, só fora da pasta oficial, como no ui-test-paralelo.mjs):
      // aba Status com os pontos e aba Skills com a vaga de tipo
      if (!SO.length || !SHOTS_SAO_OFICIAIS) {
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
      const g = window.__sk = { faixas: [], faixasT: [], baloesMax: 0, partMax: 0, baloesTipos: {}, cobriuVoce: 0, forasDaRaia: 0, cruzaOutro: 0, quadros: 0, pilhas: 0, cobreNovo: 0, foraDaPista: 0 }
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
          if (b.x < 0 || b.x + b.w > r._state.lay.artW) g.foraDaPista++
          if (b.pilha !== 0) {
            // um balão mais velho não fica por cima de um mais novo do mesmo cavalo (o de texto tem o nome inteiro)
            g.pilhas++
            const c = st.caixasBaloes.find((o) => o.racer === b.racer && o.pilha < b.pilha && cruza(b, o))
            if (c) { g.cobreNovo++; g.exCobre = g.exCobre || { velho: b, novo: c, simT: r._state.simT } }
            return
          }
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
        if (g.cobreNovo || g.foraDaPista) problems.push(`[${label}] skills: balão mais velho por cima de um mais novo do mesmo cavalo em ${g.cobreNovo} quadro(s) e balão fora da pista em ${g.foraDaPista} ${JSON.stringify(g.exCobre)}`)
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
  {   // marcas (e marcas-corrida, a parte com o teto de tempo por quadro): as ajudas abaixo valem para todas
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
    if (quer('marcas')) {
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
    if (quer('marcas-corrida')) {
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
    if (quer('marcas')) {
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
    if (quer('marcas')) {
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
  {   // portes (e portes-corrida, a parte com o teto de tempo por quadro): as ajudas abaixo valem para todas
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
    if (quer('portes')) {
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
    if (quer('portes')) for (const vp of [{ width: 360, height: 780 }, { width: 1280, height: 800 }]) {
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
    if (quer('portes')) {
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
    if (quer('portes-corrida')) {
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
  // 3b §2: o mesmo padrão com 6 cavalos (as metas de altura do Estábulo: 3 cavalos ≤ 780 px, 6 ≤ 1.100 px; com o cartão da
  // recompensa diária, spec de itens §8: 820 e 1.140 com a diária resgatada, 890 e 1.210 com prêmio)
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
  // o mesmo, com a recompensa diária já resgatada hoje (Tarefa 5 da frente de itens): o save vai como v7, com os campos novos
  // zerados e o último resgate no dia de hoje do aparelho (a conta do Itens.diaLocal, feita aqui porque o init roda antes do
  // jogo). Para os testes que medem ou conferem o Estábulo e não são sobre a diária: o cartão fica no de uma linha
  const comSaveResgatada = (save) => ({ init: { content: `try { if (!sessionStorage.getItem('ja')) { sessionStorage.setItem('ja', '1'); var s = ${JSON.stringify(save)}, d = new Date(); s.v = 7;` +
    ` s.mochila = { torrao: 0, estrela: 0, cupom: 0, manual: 0 }; s.lojaItens = { dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null }; s.itemCounter = 0;` +
    ` s.diaria = { prox: 1, ciclos: 0, ultimo: Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) }; localStorage.setItem('galope-elemental:v1', JSON.stringify(s)) } } catch (e) {}` } })

  // ---------------- acabamento da interface (Visuais 2, parte 3a): fontes embutidas, sem border-image, altura, peças, títulos compridos ----------------
  // alturas da página a 360x780 com o CSS de antes da 3a (as peças e as fontes embutidas não mudam métrica)
  // medido em 2026-11-14 na `main` (7fe5124), antes da 3a: build da `main`, o mesmo save (SAVE_3A) e o mesmo caminho do
  // bloco acabamento (servidor deste teste, 360x780, scrollHeight; Skills é a aba da montaria ativa). Usado também no celular.
  const ALTURA_ANTES_3A = { estabulo: 1284, status: 1894, correr: 802, skills: 1145 }
  // 3b §2 e decisão do controlador na Tarefa 4: a meta de 1.200 px da aba Status não fecha com a cabeça do retrato grande
  // (§5, que vence quando as metas brigam): a aba Status da ativa (SAVE_3A, 360x780, sem rascunho) fica na altura medida
  // com a linha única (medi 1.454 px a 2,625 de dpr e 1.457 a 2,75; teto 1.470), e as 7 linhas cabem inteiras numa tela com as abas no topo
  const ALTURA_STATUS_3B = 1470

  // ---------------- itens na aba Status (Tarefa 4 da frente de itens, spec de itens §8): sem Torrão e sem Estrela na mochila,
  // a aba tem a altura de hoje (o teto da 3b); com os dois, cresce no máximo 120 px e as 7 linhas continuam na primeira tela ----------------
  if (quer('itens')) {
    const label = 'itens-status-altura'
    const DIARIA = { prox: 0, ciclos: 0, ultimo: null }, LOJA = { dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null }
    const medeStatus = async (mochila, vp) => {
      const p = await newPage(browser, vp, label, comSave(Object.assign({}, SAVE_3A, { v: 7, mochila, diaria: DIARIA, lojaItens: LOJA, itemCounter: 0 })))
      try {
        await p.waitForSelector('#t-estabulo')
        await p.locator('button[data-acao="montaria"][data-id="m1"]').click()
        await p.waitForSelector('#t-montaria')
        const alt = await p.evaluate(() => document.documentElement.scrollHeight)
        const usos = await p.locator('#tela .item-usos [data-acao="item-usar"]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-id') + ':' + Math.round(b.getBoundingClientRect().height)))
        await checkOverflow(p, `${label} ${vp.width} ${JSON.stringify(mochila)}`)
        let fora = null
        if (vp.width < 600) {   // as 7 linhas inteiras numa tela com a linha de abas da ficha no topo (como o bloco celular mede)
          await p.evaluate(() => { const e = document.querySelector('#tela .subabas'), t = document.querySelector('.app-topo').getBoundingClientRect().bottom; window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - t) })
          fora = await p.evaluate(() => {
            const topo = document.querySelector('.app-topo').getBoundingClientRect().bottom, abas = document.querySelector('.app-abas').getBoundingClientRect().top
            const ls = [...document.querySelectorAll('#tela .build-linha')]
            return ls.length !== 7 ? ['só ' + ls.length + ' linhas'] : ls.filter((l) => { const b = l.getBoundingClientRect(); return b.top < topo - 0.5 || b.bottom > abas + 0.5 }).map((l) => l.getAttribute('data-status'))
          })
        }
        return { alt, usos, fora }
      } finally {
        await p.context().close()
      }
    }
    try {
      const vazia = { torrao: 0, estrela: 0, cupom: 0, manual: 0 }
      const sem = await medeStatus(vazia, { width: 360, height: 780 })
      const soSkills = await medeStatus({ ...vazia, cupom: 3, manual: 3 }, { width: 360, height: 780 })
      const com = await medeStatus({ ...vazia, torrao: 3, estrela: 1 }, { width: 360, height: 780 })
      await medeStatus({ ...vazia, torrao: 3, estrela: 1 }, { width: 1280, height: 800 })
      notes[label] = { sem: sem.alt, soSkills: soSkills.alt, com: com.alt, usos: com.usos }
      if (sem.alt > ALTURA_STATUS_3B || sem.usos.length) problems.push(`${label}: sem itens, a aba Status tem ${sem.alt}px (teto ${ALTURA_STATUS_3B}) e ${sem.usos.length} botões de item`)
      if (soSkills.alt !== sem.alt || soSkills.usos.length) problems.push(`${label}: só com Cupom e Manual (que são da aba Skills), a aba Status mudou: ${soSkills.alt}px (sem itens ${sem.alt}px), botões ${soSkills.usos.join(',')}`)
      if (com.usos.map((u) => u.split(':')[0]).join() !== 'torrao,estrela' || com.usos.some((u) => Number(u.split(':')[1]) < 44)) problems.push(`${label}: com Torrão e Estrela, os botões de item ${com.usos.join(',')} (esperado torrao,estrela com 44 px ou mais)`)
      if (com.alt - sem.alt > 120) problems.push(`${label}: com Torrão e Estrela, a aba Status cresceu ${com.alt - sem.alt}px (máximo 120)`)
      for (const [n, r] of [['sem itens', sem], ['com Torrão e Estrela', com]]) if (r.fora.length) problems.push(`${label}: ${n}, linhas de status fora da primeira tela: ${r.fora.join(',')}`)
    } catch (e) {
      problems.push(`[${label}] ` + e.message)
    }
  }
  // ---------------- altura do Estábulo com o cartão da recompensa diária (Tarefa 5 da frente de itens, spec de itens §8): 3 cavalos
  // ≤ 820 px com a diária resgatada e ≤ 890 com prêmio para resgatar; 6 cavalos ≤ 1.140 e ≤ 1.210; a lista de cavalos com a
  // altura de antes do cartão nos dois estados (medida em 90c5a2f, antes da Tarefa 5, a 360x780: 412 px com 3 e 748 com 6).
  // Ruling 16: o limite com prêmio vale em todo dia do calendário; mede o dia 1 (o save da v6 migrado), o 6 e o 7 (os prêmios
  // de texto mais longo) e o 7 do 4º calendário (com a Estrela, o 28º resgate); a altura do cartão é par (grade de 2 px) ----------------
  if (quer('itens')) {
    const label = 'itens-diaria-altura'
    const LISTA_ANTES = { 3: 412, 6: 748 }
    const v7 = (save, diaria) => Object.assign({}, save, { v: 7, mochila: { torrao: 0, estrela: 0, cupom: 0, manual: 0 }, diaria, itemCounter: 0,
      lojaItens: { dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null } })
    // [nome, diária do save (null: o save da v6, que migra no dia 1), o dia "N / 7" esperado]
    const DIAS = [['dia 1', null, 1], ['dia 6', { prox: 5, ciclos: 0, ultimo: null }, 6], ['dia 7', { prox: 6, ciclos: 0, ultimo: null }, 7],
      ['dia 7 do 4º calendário', { prox: 6, ciclos: 3, ultimo: null }, 7]]
    for (const [n, save, comPremio, resgatada] of [[3, SAVE_3A, 890, 820], [6, SAVE_3B_6, 1210, 1140]]) {
      for (const [dia, diaria, k] of DIAS) {
        const tag = `${n} cavalos, ${dia}`
        const p = await newPage(browser, { width: 360, height: 780 }, `${label}-${n}`, comSave(diaria ? v7(save, diaria) : save))
        const mede = () => p.evaluate(() => { const c = document.querySelector('#tela .diaria'); return { doc: document.documentElement.scrollHeight,
          lista: Math.round(document.querySelector('#tela .caixa[aria-label="Suas montarias"]').getBoundingClientRect().height),
          cartao: c ? c.getBoundingClientRect().height : null, txt: c ? c.textContent.replace(/\s+/g, ' ').trim() : '',
          grande: !!document.querySelector('#tela .diaria--grande'), linha: !!document.querySelector('#tela .diaria--linha') } })
        const par = (h) => h != null && Math.abs(h - 2 * Math.round(h / 2)) < 0.01
        try {
          await p.waitForSelector('#t-estabulo')
          const a = await mede()
          if (!a.grande || !a.txt.includes(`${k} / 7`)) problems.push(`${label} ${tag}: o save não abriu com o cartão grande do dia ${k}: "${a.txt}"`)
          if (dia.includes('4º') && !a.txt.includes('Estrela de treino')) problems.push(`${label} ${tag}: o cartão do 28º resgate não mostra a Estrela: "${a.txt}"`)
          if (a.doc > comPremio) problems.push(`${label} ${tag}: com prêmio para resgatar, o Estábulo tem ${a.doc}px (limite ${comPremio}; cartão ${a.cartao}px)`)
          if (!par(a.cartao)) problems.push(`${label} ${tag}: o cartão grande tem ${a.cartao}px (altura ímpar, fora da grade de 2 px)`)
          if (a.lista !== LISTA_ANTES[n]) problems.push(`${label} ${tag}: com o cartão grande, a lista tem ${a.lista}px (antes do cartão ${LISTA_ANTES[n]})`)
          await p.locator('#tela [data-acao="diaria-resgatar"]').click()
          const b = await mede()
          if (!b.linha) problems.push(`${label} ${tag}: depois do resgate, sem o cartão de uma linha`)
          if (b.doc > resgatada) problems.push(`${label} ${tag}: com a diária resgatada, o Estábulo tem ${b.doc}px (limite ${resgatada})`)
          if (!par(b.cartao)) problems.push(`${label} ${tag}: o cartão de uma linha tem ${b.cartao}px (altura ímpar, fora da grade de 2 px)`)
          if (b.lista !== LISTA_ANTES[n]) problems.push(`${label} ${tag}: com o cartão de uma linha, a lista tem ${b.lista}px (antes do cartão ${LISTA_ANTES[n]})`)
          notes[`${label} ${tag}`] = { comPremio: { doc: a.doc, cartao: a.cartao }, resgatada: { doc: b.doc, cartao: b.cartao } }
        } catch (e) {
          problems.push(`[${label} ${tag}] ` + e.message)
        } finally {
          await p.context().close()
        }
      }
    }
  }

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
      // altura: Estábulo e aba Status da ativa, save com 3 montarias, a 360x780 (Tarefa 5 da frente de itens: medido com a
      // recompensa diária já resgatada, o cartão de uma linha no topo; com prêmio, o bloco itens mede contra 890)
      const pg = await newPage(browser, { width: 360, height: 780 }, 'acabamento-altura', comSaveResgatada(SAVE_3A))
      try {
        await pg.waitForSelector('#t-estabulo')
        const altura = () => pg.evaluate(() => document.documentElement.scrollHeight)
        const aEst = await altura()
        notes.alturaAcabamento = { estabulo: aEst }
        // 3b §2: o Estábulo em lista de linhas cabia numa tela (780); o cartão da diária de uma linha mede 40 px e custa 64 px de
        // altura ao Estábulo, com o espaço até a lista (medido com 6 cavalos: 1.012 antes do cartão, 1.076 com ele; spec de itens §8)
        if (!(await pg.locator('#tela .diaria--linha').count())) problems.push('acabamento: o Estábulo não abriu com a diária resgatada (cartão de uma linha)')
        if (aEst > 820) problems.push(`acabamento: Estábulo com ${aEst}px (limite 820 com a diária resgatada, spec de itens §8; antes da 3a ${ALTURA_ANTES_3A.estabulo})`)
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
      const COMPONENTES = ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10', '4.11', '4.12', '4.13', '4.14', '4.15', '4.16', '4.17', '4.18', '4.19', '4.20']
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
          // itens, loja e diária (Tarefa 6 da frente de itens): o markup do itemLinhaHtml (ícone, nome, quantidade, para que serve,
          // nessa ordem, e o extra), com o ícone desenhado e em 32 px; botão de pelo menos 44 px; indisponível com aria-disabled
          // (nunca disabled) e o motivo em data-motivo
          const it = await pg.evaluate(() => {
            const col = (c) => document.querySelector(`[data-componente="${c}"] .col--estreita`)
            const linha = (a) => {
              const kids = [...a.children].map((c) => c.className)
              const ic = a.querySelector('.item-icone'), r = ic ? ic.getBoundingClientRect() : null
              return { item: a.getAttribute('data-item'), inicio: kids.slice(0, 2).join('|') + '|' + kids.slice(2).filter((k) => k === 'item-qtd' || k === 'item-desc').join('|'), icone: !!ic && getComputedStyle(ic).backgroundImage.startsWith('url('), ic32: !!r && Math.round(r.width) === 32 && Math.round(r.height) === 32 }
            }
            const botao = (b) => ({ txt: b.childNodes[0] ? b.childNodes[0].textContent : '', h: Math.round(b.getBoundingClientRect().height), aria: b.getAttribute('aria-disabled') === 'true', disabled: b.hasAttribute('disabled'), motivo: b.getAttribute('data-motivo') || '', sr: (b.querySelector('.sr') || {}).textContent || '' })
            const est = (c) => [...col(c).querySelectorAll('.estado')]
            return {
              produtos: est('4.18').map((e) => {
                const a = e.querySelector('.item-linha'), b = a && a.querySelector('[data-acao="item-comprar"]')
                return { rot: e.querySelector('.estado-rot').textContent, cls: a ? a.className : '', ...(a ? linha(a) : {}), limite: a && a.querySelector('.item-compra .item-preco .ouro + .item-limite') ? a.querySelector('.item-limite').textContent : null, botao: b ? botao(b) : null, aviso: a ? a.querySelectorAll(':scope > .aviso.item-aviso').length : 0 }
              }),
              mochila: est('4.19').map((e) => {
                const a = e.querySelector('.item-linha'), b = a && a.querySelector('.item-compra--usar [data-acao="item-usar"]')
                return { rot: e.querySelector('.estado-rot').textContent, cls: a ? a.className : '', ...(a ? linha(a) : {}), qtd: a ? a.querySelector('.item-qtd [aria-hidden="true"]').textContent : '', botao: b ? botao(b) : null }
              }),
              diaria: est('4.20').map((e) => {
                const d = e.querySelector('.diaria'), r = d && d.querySelector('[data-acao="diaria-resgatar"]'), v = d && d.querySelector('[data-acao="diaria-ver"]')
                return { rot: e.querySelector('.estado-rot').textContent, cls: d ? d.className : '', h2: !!(d && d.querySelector('h2.titulo .sr')), num: d && d.querySelector('.diaria-premio[aria-hidden="true"] > .diaria-num') ? d.querySelector('.diaria-num').textContent : null,
                  resgatar: r ? botao(r) : null, ver: v ? { h: Math.round(v.getBoundingClientRect().height), exp: v.getAttribute('aria-expanded') } : null, dias: d ? d.querySelectorAll('.diaria-dias > .diaria-dia').length : 0, hoje: d ? d.querySelectorAll('.diaria-dia[aria-current="date"]').length : 0,
                  linha: d && d.querySelector('p.diaria-linha') ? d.querySelector('p.diaria-linha').textContent : null, botoes: d ? d.querySelectorAll('button').length : 0, motivo: !!(d && d.querySelector('.nota.diaria-motivo')) }
              })
            }
          })
          const ESTRUTURA = 'item-icone item-icone--X|item-nome|item-qtd|item-desc'
          const estruturaOk = (x) => x.inicio === ESTRUTURA.replace('X', x.item) && x.icone && x.ic32
          // produto: os quatro estados do botão da spec (Comprar, Sem Ouro, Reservado, Limite de hoje), mais Mochila cheia; só "Comprar" sem motivo
          const rotulos = it.produtos.filter((x) => x.botao).map((x) => x.botao.txt)
          for (const r of ['Comprar', 'Limite de hoje', 'Sem Ouro', 'Reservado', 'Mochila cheia']) if (!rotulos.includes(r)) problems.push(`acabamento (folha ${larg}): o produto da loja sem o estado "${r}" (${rotulos.join(', ')})`)
          for (const x of it.produtos) {
            const ruim = []
            if (!estruturaOk(x)) ruim.push(`markup diferente do jogo (${x.inicio}, ícone ${x.icone ? 'desenhado' : 'sem arte'}, ${x.ic32 ? '32 px' : 'fora de 32 px'})`)
            if (x.item === 'redea') { if (x.botao || !/item-linha--fora/.test(x.cls)) ruim.push('a Rédea nova com botão de compra ou sem .item-linha--fora') }
            else {
              if (!/item-linha--produto/.test(x.cls) || !x.botao || x.limite == null) ruim.push('sem .item-linha--produto, sem o botão ou sem o preço com o limite do dia')
              else {
                if (x.botao.h < 44) ruim.push(`botão com ${x.botao.h} px de altura`)
                if (x.botao.disabled) ruim.push('botão com disabled (o padrão é aria-disabled)')
                if ((x.botao.txt === 'Comprar') === (x.botao.aria || !!x.botao.motivo)) ruim.push(`"${x.botao.txt}" ${x.botao.aria ? 'apagado' : 'sem aria-disabled'}${x.botao.motivo ? ' com motivo' : ' sem motivo'}`)
                if (!x.botao.sr.trim()) ruim.push('o botão sem o nome do item para o leitor de tela')
                if (!(/^Restam \d+ de \d+ hoje$/.test(x.limite) || /^(disponível|de novo em \d+ dias?)$/.test(x.limite))) ruim.push(`limite do dia "${x.limite}"`)
              }
            }
            if (ruim.length) problems.push(`acabamento (folha ${larg}): produto "${x.rot}": ${ruim.join('; ')}`)
          }
          if (!it.produtos.some((x) => x.aviso === 1)) problems.push(`acabamento (folha ${larg}): o produto da loja sem o estado com o aviso da compra na linha`)
          // mochila: com o item (×N e o Usar) e sem (apagada, sem o Usar)
          const comItem = it.mochila.filter((x) => !/item-linha--vazia/.test(x.cls)), semItem = it.mochila.filter((x) => /item-linha--vazia/.test(x.cls))
          if (!comItem.length || !semItem.length) problems.push(`acabamento (folha ${larg}): a linha da mochila sem os dois estados (com ${comItem.length}, sem ${semItem.length})`)
          for (const x of it.mochila) {
            const vazia = /item-linha--vazia/.test(x.cls), ruim = []
            if (!/item-linha--mochila/.test(x.cls) || !estruturaOk(x)) ruim.push(`markup diferente do jogo (${x.cls}; ${x.inicio})`)
            if (vazia ? x.botao || x.qtd !== '×0' : !x.botao || x.botao.h < 44 || x.botao.aria || x.botao.txt !== 'Usar' || !/^×[1-9]/.test(x.qtd)) ruim.push(`quantidade ${x.qtd} e botão ${JSON.stringify(x.botao)}`)
            if (ruim.length) problems.push(`acabamento (folha ${larg}): mochila "${x.rot}": ${ruim.join('; ')}`)
          }
          // diária: o cartão grande (título com o texto do leitor de tela, "N / 7" na linha do prêmio, "Ver os 7 dias" e Resgatar,
          // ambos de 44 px), os 7 dias abertos com o de hoje marcado, o resgate travado (aria-disabled com o motivo) e a linha
          const grandes = it.diaria.filter((x) => /diaria--grande/.test(x.cls)), linhas = it.diaria.filter((x) => /diaria--linha/.test(x.cls))
          if (!grandes.length || !linhas.length || !grandes.some((x) => x.dias) || !grandes.some((x) => x.motivo)) problems.push(`acabamento (folha ${larg}): o cartão da diária sem os estados grande, com os 7 dias, travado e de uma linha (${it.diaria.map((x) => x.rot).join(', ')})`)
          for (const x of grandes) {
            const ruim = []
            if (!x.h2 || !/^\d \/ 7$/.test(x.num || '')) ruim.push(`título ou "N / 7" fora do markup do jogo (${x.num})`)
            if (!x.resgatar || x.resgatar.txt !== 'Resgatar' || x.resgatar.h < 44 || x.resgatar.disabled || x.resgatar.aria !== x.motivo || x.resgatar.aria !== !!x.resgatar.motivo) ruim.push(`Resgatar ${JSON.stringify(x.resgatar)}`)
            if (!x.ver || x.ver.h < 44 || x.ver.exp !== String(!!x.dias)) ruim.push(`"Ver os 7 dias" ${JSON.stringify(x.ver)}`)
            if (x.dias && (x.dias !== 7 || x.hoje !== 1)) ruim.push(`${x.dias} dias abertos, ${x.hoje} marcado como hoje`)
            if (ruim.length) problems.push(`acabamento (folha ${larg}): diária "${x.rot}": ${ruim.join('; ')}`)
          }
          for (const x of linhas) if (x.botoes || !/^Recompensa: amanhã /.test(x.linha || '')) problems.push(`acabamento (folha ${larg}): diária "${x.rot}": a linha "${x.linha}" com ${x.botoes} botão(ões)`)
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
        for (const id of ['haras', 'expedicao', 'loja']) { await aba(id); await confere(id) }
        await pg.locator('[data-acao="loja-parte"][data-id="mochila"]').click()   // a Loja de itens (spec de itens §13), nas duas partes
        await confere('loja mochila')
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
        for (const id of ['correr', 'haras', 'expedicao', 'loja']) {
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
    // a .motivo, destaca a frase que já está lá (.motivo-alvo, por ~2 s); barra (só o Confirmar, onde há a .barra-acao): ela não cresce
    const confere = async (nome, sel, motivoRe, { alvo = false, barra = false } = {}) => {
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
      // barra: a tela tem a .barra-acao (Confirmar travado); só ali se mede que ela não cresce, e ela tem de existir
      if (barra) {
        const h1 = await altBarra()
        if (h0 === null) problems.push(`${label}: ${nome}: sem .barra-acao na tela (o teste espera a barra presa dos pontos)`)
        else if (h0 !== h1) problems.push(`${label}: ${nome}: a .barra-acao foi de ${h0} a ${h1} px com o toque (esperado igual)`)
      }
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
      await confere('Confirmar acima do Poder da sala', '[data-acao="pontos-confirmar"]', /^Páreo aberto: com este rascunho o Poder iria a \d+, e a sala viu \d+\./, { alvo: true, barra: true })
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
      // SAVE_3A (3 cavalos) a 360x780: ≤ 820 px com a diária resgatada (o cartão de uma linha; spec de itens §8, eram 780)
      const p3 = await newPage(browser, { width: 360, height: 780 }, label + '-estabulo3', comSaveResgatada(SAVE_3A))
      try {
        await p3.waitForSelector('#t-estabulo')
        await confereLista(p3, '3 cavalos', 820)
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
        await confereLista(p3, '3 cavalos, m3 ativa', 820)
      } catch (e) {
        problems.push(`${label}-estabulo3: ${e.message}`)
      } finally {
        await p3.context().close()
      }
    }
    {
      // SAVE_3B_6 (6 cavalos) a 360x780: ≤ 1.140 px com a diária resgatada (spec de itens §8, eram 1.100); a 6ª linha (abaixo
      // da dobra) recebe o foco e aparece ao voltar
      const p6 = await newPage(browser, { width: 360, height: 780 }, label + '-estabulo6', comSaveResgatada(SAVE_3B_6))
      try {
        await p6.waitForSelector('#t-estabulo')
        await confereLista(p6, '6 cavalos', 1140)
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

  {   // crescimento (e crescimento-jogo, a parte que mede o tempo de abrir a sala): as ajudas abaixo valem para todas
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
    if (quer('crescimento')) {
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
          if (x.v !== 8) erro('versão ' + x.v)
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
    if (quer('crescimento-jogo')) {
      const label = 'crescimento-jogo'
      const pg = await newPage(browser, { width: 360, height: 780 }, label)
      try {
        await pg.getByRole('button', { name: 'Escolher Brasa' }).click()
        await pg.waitForSelector('#t-estabulo')
        let s = await estado(pg)
        if (s.v !== 8 || s.redeas !== 0 || s.avisoV6 !== false || s.mounts[0].respecFree !== true || !igual(s.mounts[0].alloc, ZERO)) problems.push(`${label}: jogo novo ` + JSON.stringify({ v: s.v, redeas: s.redeas, avisoV6: s.avisoV6, m1: s.mounts[0] }))
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

        // sem equipamento: 5 abas (a Loja de itens volta como 5ª, spec de itens §6), a Loja sem peças nem Pedras, sem Pedras
        // no cabeçalho, sem resumo de peças no Estábulo
        // (uma peça solta e o conjunto do Sol inteiro na Brasa: o Poder e a chance de skill ignoram os dois)
        await montaSave(pg, (raw) => {
          raw.items = GR.SLOTS.map((sl, i) => ({ uid: 'i' + (i + 1), id: sl + '-sol-lendario', plus: 4 })).concat([{ uid: 'i9', id: 'sela-magico', plus: 0 }])
          raw.nextItemUid = 10; raw.pedras = 5; raw.gold = 2000
          raw.mounts[0].equip = Object.fromEntries(GR.SLOTS.map((sl, i) => [sl, 'i' + (i + 1)]))
        })
        const abas = await pg.locator('.app-abas [data-acao="aba"]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-id')))
        if (!igual(abas, ['estabulo', 'correr', 'expedicao', 'haras', 'loja'])) problems.push(`${label}: abas ${abas.join(',')} (esperado estabulo,correr,expedicao,haras,loja)`)
        await forca(pg, 'aba', 'loja')
        if (!(await pg.locator('#t-loja').count())) problems.push(`${label}: a Loja não abriu`)
        if (await pg.locator('#tela [data-acao="loja-tab"], #tela [data-acao="comprar"], #tela [data-acao="comprar-pedra"], #tela .loja-grade').count()) problems.push(`${label}: a Loja mostra peças ou Pedras com o equipamento suspenso`)
        if (await pg.locator('.app-topo .pedras').count()) problems.push(`${label}: saldo de Pedras no cabeçalho`)
        await pg.locator('[data-acao="aba"][data-id="estabulo"]').click()
        await pg.waitForSelector('#t-estabulo')
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
    if (quer('crescimento')) {
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
    if (quer('crescimento')) {
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

  // ---------------- o fluxo completo e os contextos antigos: um bloco por contexto (fluxo, fluxo-*) ----------------
  let goldBefore, after, trainGold   // do bloco fluxo, para o resumo do fim
  // ---------------- celular 390x844 ----------------
  if (quer('fluxo')) {
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
  // (a Loja de itens está sempre na barra: 5 abas, também com o equipamento suspenso)
  const ABAS_UI = [['estabulo', 'Estábulo'], ['correr', 'Correr'], ['expedicao', 'Expedição'], ['haras', 'Haras'], ['loja', 'Loja']]
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

  goldBefore = await page.evaluate(() => window.__galope.state.gold)
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
  after = await page.evaluate(() => ({ gold: window.__galope.state.gold, pedras: window.__galope.state.pedras, level: window.__galope.state.mounts.filter((m) => m.uid === window.__galope.state.activeId)[0].level, xp: window.__galope.state.mounts.filter((m) => m.uid === window.__galope.state.activeId)[0].xp, result: window.__galope.ui.result, pending: window.__galope.state.pending }))
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
  trainGold = await page.evaluate(() => window.__galope.state.gold)
  if (!(trainGold > 20)) problems.push(`treino não pagou Ouro: ${trainGold}`)
  await page.context().close()
  }

  // save antigo (v1, com tática e sem skills) é lido e migrado
  if (quer('fluxo-saves')) {
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
        s.v === 8 && !('base' in s.mounts[0]) && s.items.length === 1 && s.items[0].id === 'sela-comum' && s.mounts[0].equip.sela === null && s.pedras === 0 &&
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
    const ok = s.v === 8 && s.items.length === 9 && s.pedras === 3 && arm && s.mounts[0].equip.armadura === arm.uid &&
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
  }

  // ---------------- cruzamento (haras): aluguel, determinismo ponta a ponta, bloqueios e Troca ----------------
  if (quer('fluxo-cruzamento')) {
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
  if (quer('fluxo-abas')) {
    const mn = await newPage(browser, { width: 390, height: 844 }, 'menu')
    try {
      await mn.getByRole('button', { name: 'Escolher Brasa' }).click()
      await mn.waitForSelector('#t-estabulo')
      // Ruling 19: seedBase fixo (o save novo sorteia o dele com crypto.getRandomValues), para as capturas 03, 04, 10 e 11
      // (saldo e XP depois da corrida abaixo) só mudarem quando a interface muda
      await mn.evaluate(() => { window.__galope.state.seedBase = 7 })
      // 1. as 5 abas (a Loja de itens também com o equipamento suspenso) abrem e focam o h1 certo
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
      const cicloAbas = ['correr', 'haras', 'loja', 'estabulo', 'expedicao']
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
      // o único ponto na barra é o do Estábulo (save novo: a recompensa do dia ainda para resgatar; spec de itens §8, Ruling 2)
      const pontosMn = await mn.locator('.app-aba--ponto').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-id')).join(','))
      if (pontosMn !== 'estabulo') problems.push(`menu: depois da corrida, pontos na barra "${pontosMn}" (esperado só o do Estábulo, da recompensa do dia)`)
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
  if (quer('fluxo-equipamento')) {
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
  if (quer('fluxo-dev')) {
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
  if (quer('fluxo-build-teste')) {
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
  if (quer('fluxo-dado')) {
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
        return { simT: s.simT, slowK: s.slowK, dados: st.dados, faixa: st.faixaDado, particulas: st.particulas, placas: st.placas.slice(), ms: st.msQuadro, voce: s.voceRect,
          baloes: st.caixasBaloes.slice(), artW: s.lay.artW }
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
        // o quadro da captura: nenhum balão de skill mais velho por cima do mais novo (com o nome) do mesmo cavalo, e
        // nenhum fora da pista
        notes['dado-' + label].baloes = q.baloes.map((b) => ({ racer: b.racer, pilha: b.pilha, texto: b.texto, x: b.x, y: b.y, w: b.w, h: b.h }))
        q.baloes.forEach((b) => {
          if (b.x < 0 || b.x + b.w > q.artW) problems.push(`[${label}] Dado: balão da raia ${b.racer + 1} fora da pista ${JSON.stringify(b)} (artW ${q.artW})`)
          const c = b.pilha > 0 && q.baloes.find((o) => o.racer === b.racer && o.pilha < b.pilha && cruza(b, o))
          if (c) problems.push(`[${label}] Dado: o balão ${b.pilha} da raia ${b.racer + 1} cobre o balão ${c.pilha} ("${c.texto}") ${JSON.stringify([b, c])}`)
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
  {   // fluxo-natureza (e fluxo-desempenho, a parte que mede o desenho por quadro): as ajudas abaixo valem para todas
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
    if (quer('fluxo-natureza')) {
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
    if (quer('fluxo-natureza')) {
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
    if (quer('fluxo-desempenho')) {
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
    if (quer('fluxo-natureza')) {
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
  if (quer('fluxo-curvas')) {
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

  // ---------------- capturas da frente de itens (spec de itens §15): Estábulo com o cartão grande da diária, Loja (Comprar e
  // Mochila) e a ficha com os botões de item na aba Status. O estado é posto direto no jogo (sem a gaveta DEV, que muda a tela)
  if (quer('fluxo-capturas-itens')) {
    const it = await newPage(browser, { width: 390, height: 844 }, 'itens-capturas')
    try {
      await it.getByRole('button', { name: 'Escolher Brasa' }).click()
      await it.waitForSelector('#t-estabulo')
      // 4º dia do calendário para resgatar; 1.500 de Ouro (a Estrela fica "Sem Ouro"); na mochila, Torrão, Estrela e Manual
      await it.evaluate(() => {
        const s = window.__galope.state, hoje = window.__galope.hojeDia()
        s.diaria = { prox: 3, ciclos: 0, ultimo: hoje - 1 }
        s.gold = 1500
        s.mochila = { torrao: 3, estrela: 1, cupom: 0, manual: 1 }
      })
      await it.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await it.waitForSelector('#tela .diaria--grande')
      if (!/4 \/ 7/.test((await it.locator('#tela .diaria-num').textContent()) || '')) problems.push('itens-capturas: o cartão da diária não mostra o 4º dia')
      await it.evaluate(() => window.scrollTo(0, 0)); await sleep(300)
      await checkOverflow(it, 'itens-capturas-estabulo')
      await it.screenshot({ path: join(SHOTS, 'final-22-diaria.png') })
      await it.locator('[data-acao="aba"][data-id="loja"]').click()
      await it.waitForSelector('#t-loja')
      const rot = await it.locator('#tela [data-acao="item-comprar"]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-id') + ':' + b.childNodes[0].textContent))
      if (rot.join() !== 'torrao:Comprar,manual:Comprar,cupom:Comprar,estrela:Sem Ouro') problems.push(`itens-capturas: botões da loja ${rot.join()}`)
      await sleep(300)
      await checkOverflow(it, 'itens-capturas-loja')
      await it.screenshot({ path: join(SHOTS, 'final-20-loja.png') })
      await it.locator('#tela [data-acao="loja-parte"][data-id="mochila"]').click()
      await it.waitForSelector('#tela .item-linha--mochila')
      await it.evaluate(() => window.scrollTo(0, 0)); await sleep(300)
      await checkOverflow(it, 'itens-capturas-mochila')
      await it.screenshot({ path: join(SHOTS, 'final-21-mochila.png') })
      await it.locator('[data-acao="aba"][data-id="estabulo"]').click()
      await it.locator('button[data-acao="montaria"][data-id="m1"]').click()
      await it.waitForSelector('#t-montaria')
      const usos = await it.locator('#tela .item-usos [data-acao="item-usar"]').evaluateAll((bs) => bs.map((b) => b.textContent.trim()))
      if (usos.join('|') !== 'Usar Torrão de açúcar|Usar Estrela de treino') problems.push(`itens-capturas: a aba Status mostra os usos ${usos.join('|')}`)
      await it.locator('#tela .item-usos').evaluate((e) => e.scrollIntoView({ block: 'center' })); await sleep(300)
      await checkOverflow(it, 'itens-capturas-ficha')
      await it.screenshot({ path: join(SHOTS, 'final-23-ficha-itens.png') })
    } catch (e) {
      problems.push('itens-capturas: ' + e.message)
    } finally {
      await it.context().close()
    }
  }

  // ---------------- loja: abas, comprar (com recusa sem Ouro), Pedras Negras e resumo na largada ----------------
  // Só com o equipamento ligado: suspenso (GEAR_ON = false), a Loja sai da barra (o bloco crescimento confere que ela não
  // abre e que comprar não faz nada); a captura final-09-loja.png não é gerada.
  if (quer('fluxo-loja')) {
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
  }

  // ---------------- desktop 1280x800 ----------------
  if (quer('fluxo-desktop')) {
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
  }

  // ---------------- moldes: queda para o código e teto do cache ----------------
  if (quer('fluxo-moldes')) {
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
  }

  // ---------------- sem ícones nem logotipo: volta aos caracteres, sem <img> quebrado ----------------
  if (quer('fluxo-sem-icones')) {
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
  if (quer('fluxo-pequeno')) {
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
  }

  // depois de todos os blocos: as câmeras anotadas pelo fluxo, fluxo-desktop e fluxo-pequeno (só as que rodaram)
  for (const k of ['cam390', 'cam1280', 'camm360', 'camland']) {
    const c = notes[k]
    if (c && (c.partial > 0 || c.off > 0)) problems.push(`${k}: cavalo do jogador saiu da tela (${c.partial} quadros parciais, ${c.off} fora de ${c.frames})`)
  }
  fechaBloco()
  notes.temposBlocos = Object.fromEntries(Object.entries(temposBlocos).map(([k, ms]) => [k, +(ms / 1000).toFixed(1)]))
  // a lista BLOCOS é a do arquivo: todo nome dela tem o seu if (quer(...)), na mesma ordem
  const semBloco = BLOCOS.filter((n) => !perguntados.includes(n))
  if (semBloco.length) problems.push('ui-test: nomes da lista BLOCOS sem if (quer(...)) no arquivo: ' + semBloco.join(', '))
  else if (perguntados.join() !== BLOCOS.join()) problems.push('ui-test: a lista BLOCOS fora da ordem do arquivo: ' + perguntados.join(','))
  if (!SO.length) console.log(JSON.stringify({ goldBefore, after: { gold: after.gold, level: after.level, xp: after.xp, place: after.result.place, prize: after.result.prize, xpGain: after.result.xpGain }, trainGold, notes }, null, 1))
  else console.log(JSON.stringify({ so: SO, notes }, null, 1))
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
