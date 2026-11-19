// Fluidez das trocas de tela: quanto tempo cada troca leva do toque até a tela nova pintada, num celular simples.
//   node tools/fluidez.mjs                 -> imprime a tabela (mediana de 5 rodadas)
//   node tools/fluidez.mjs --teto 60       -> idem, e sai com código 1 se alguma troca (a carga não conta) passar de 60 ms
//   node tools/fluidez.mjs --rodadas 9     -> mais rodadas (a mediana oscila menos)
//   node tools/fluidez.mjs --arquivo X.html -> mede outro build (ex.: o de um commit antigo, para comparar)
// Cenário (o mesmo da medição de 2026-11-19): Chromium do Playwright com a CPU 4× mais lenta (CDP
// Emulation.setCPUThrottlingRate), janela 360 × 780 com deviceScaleFactor 3, dist/jogo-dev.html com o save DEV novo
// (cada rodada num contexto novo: localStorage vazio), state.gold = 5000 e o Ginásio da Grama na etapa 2. As trocas, nesta
// ordem: aba Expedição (mapa-múndi), abrir o Ginásio da Grama (mapa do ginásio), abrir o preparo da etapa, voltar do
// preparo, aba Estábulo, aba Correr e a aba Expedição de novo (a 2ª vez). Cada troca: do click() até o 2º
// requestAnimationFrame depois dele (a tela nova pintada); "imagens" é até as <img> da tela decodificarem (só informação).
// A carga é do início da navegação até o 2º quadro depois de o título do Estábulo aparecer.
// Também exporta medirFluidez(browser, url, rodadas), que o bloco "fluidez" do tools/ui-test.mjs usa.
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))

export const TROCAS = [
  ['expedicao', 'aba Expedição (mapa-múndi)', '[data-acao="aba"][data-id="expedicao"]', '#t-expedicao'],
  ['ginasio', 'abrir o ginásio (mapa do ginásio)', '[data-acao="ginasio-abrir"][data-id="grama"]', '#t-ginasio'],
  ['preparo', 'abrir o preparo da etapa', '[data-acao="ginasio-etapa"][aria-current="step"]', '#t-etapa'],
  ['voltar', 'voltar do preparo', '[data-acao="ginasio-voltar"]', '#t-ginasio'],
  ['estabulo', 'aba Estábulo', '[data-acao="aba"][data-id="estabulo"]', '#t-estabulo'],
  ['correr', 'aba Correr', '[data-acao="aba"][data-id="correr"]', '#t-correr'],
  ['expedicao2', 'aba Expedição (2ª vez)', '[data-acao="aba"][data-id="expedicao"]', '#t-expedicao']
]

const mediana = (xs) => { const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2) }

// uma rodada: contexto novo, carga, e as trocas em sequência. Devolve { carga, trocas: { nome: { quadro, imagens } } }
async function rodada(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3 })
  try {
    const pg = await ctx.newPage()
    const erros = []
    pg.on('pageerror', (e) => erros.push(e.message))
    const cdp = await ctx.newCDPSession(pg)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    // a carga, medida dentro da página: o título do Estábulo aparece e mais dois quadros
    await pg.addInitScript(() => {
      const ob = new MutationObserver(() => {
        if (!document.getElementById('t-estabulo')) return
        ob.disconnect()
        requestAnimationFrame(() => requestAnimationFrame(() => { window.__fluidezCarga = performance.now() }))
      })
      ob.observe(document, { childList: true, subtree: true })
    })
    await pg.goto(url)
    await pg.waitForFunction(() => window.__fluidezCarga > 0, null, { timeout: 30000 })
    const carga = Math.round(await pg.evaluate(() => window.__fluidezCarga))
    // os moldes chegam depois e redesenham a tela: espera, e deixa a página assentar
    await pg.waitForFunction(() => window.Sprites && window.Sprites.moldsReady === true, null, { timeout: 15000 }).catch(() => {})
    await pg.evaluate(() => { const g = window.__galope; g.state.gold = 5000; Object.assign(g.state.ginasios.grama, { etapa: 2 }) })
    await pg.waitForTimeout(500)
    const trocas = {}
    for (const [nome, , sel, titulo] of TROCAS) {
      const r = await pg.evaluate(async ([s, tt]) => {
        const el = document.querySelector(s)
        if (!el) return { erro: 'sem ' + s }
        const t = performance.now()
        el.click()
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))
        const quadro = performance.now() - t
        if (!document.querySelector(tt)) return { erro: 'a troca não chegou em ' + tt }
        await Promise.all([...document.querySelectorAll('#tela img')].map((i) => i.decode().catch(() => {})))
        return { quadro: Math.round(quadro), imagens: Math.round(performance.now() - t) }
      }, [sel, titulo])
      if (r.erro) throw new Error(`fluidez: ${nome}: ${r.erro}`)
      trocas[nome] = r
      await pg.waitForTimeout(400)   // o desenho adiado (retratos fora da tela) termina antes da próxima troca
    }
    if (erros.length) throw new Error('fluidez: erro na página: ' + erros.join(' | '))
    return { carga, trocas }
  } finally {
    await ctx.close()
  }
}

// mede `rodadas` vezes e devolve as medianas: { carga, trocas: { nome: { quadro, imagens } }, rodadas: [...] }
export async function medirFluidez(browser, url, rodadas = 5) {
  const todas = []
  for (let i = 0; i < rodadas; i++) todas.push(await rodada(browser, url))
  const trocas = {}
  for (const [nome] of TROCAS) {
    trocas[nome] = { quadro: mediana(todas.map((r) => r.trocas[nome].quadro)), imagens: mediana(todas.map((r) => r.trocas[nome].imagens)) }
  }
  return { carga: mediana(todas.map((r) => r.carga)), trocas, rodadas: todas }
}

export function tabelaFluidez(m) {
  const linhas = ['| Troca | ms (até o 2º quadro) | ms (até as imagens) |', '|---|---|---|', `| carga da página até o Estábulo | ${m.carga} | |`]
  for (const [nome, rotulo] of TROCAS) linhas.push(`| ${rotulo} | ${m.trocas[nome].quadro} | ${m.trocas[nome].imagens} |`)
  return linhas.join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined }
  const teto = arg('--teto') !== undefined ? Number(arg('--teto')) : null
  const rodadas = Math.max(1, Math.floor(Number(arg('--rodadas')) || 5))
  const arquivo = resolve(arg('--arquivo') || join(AQUI, '..', 'dist', 'jogo-dev.html'))
  if (teto !== null && !(teto > 0)) { console.error('--teto precisa de um número de ms'); process.exit(2) }
  const { chromium } = createRequire(import.meta.url)('playwright')
  const browser = await chromium.launch()
  let m
  try {
    m = await medirFluidez(browser, pathToFileURL(arquivo).href, rodadas)
  } finally {
    await browser.close()
  }
  console.log(`Fluidez (${arquivo}; CPU 4× mais lenta, 360 × 780, dpr 3; mediana de ${rodadas} rodadas)\n`)
  console.log(tabelaFluidez(m))
  if (teto !== null) {
    const acima = TROCAS.filter(([nome]) => m.trocas[nome].quadro > teto).map(([nome, rotulo]) => `${rotulo}: ${m.trocas[nome].quadro} ms`)
    if (acima.length) { console.log(`\nACIMA DO TETO de ${teto} ms:\n  ` + acima.join('\n  ')); process.exit(1) }
    console.log(`\nOK: todas as trocas em ${teto} ms ou menos`)
  }
}
