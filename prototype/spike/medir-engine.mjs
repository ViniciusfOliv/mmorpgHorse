// Spike do teste de engine — roda a bateria do engine.html no Chromium do contêiner (Playwright já instalado).
//   node prototype/spike/medir-engine.mjs [--fator 1] [--so desktop,celular,celular-4x,celular-6x] [--captura arquivo.png]
//                                         [--sem-vsync] [--json arquivo.json] [--etapa6]
// --sem-vsync: o Chromium não espera a tela (rAF sem limite de 60 Hz): o FPS vira o teto, a folga que sobra.
// Cada cenário abre a página (embrulhada num documento, como o artefato faz), espera os moldes, roda a bateria e
// imprime o resumo. Atenção: no contêiner o Chromium desenha o canvas na CPU (sem GPU), então os números servem para
// comparar camadas entre si e para ver o peso do JavaScript; o número que decide é o do celular.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium, devices } = require('playwright')
const AQUI = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d }
const fator = Number(opt('fator', '1'))
const so = opt('so', 'desktop,celular,celular-4x,celular-6x').split(',')
const captura = opt('captura', null)

const corpo = await readFile(join(AQUI, 'engine.html'), 'utf8')
const doc = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + corpo + '</body></html>'

const CENARIOS = {
  desktop: { contexto: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, cpu: 1 },
  celular: { contexto: { ...devices['Pixel 7'] }, cpu: 1 },
  'celular-4x': { contexto: { ...devices['Pixel 7'] }, cpu: 4 },
  'celular-6x': { contexto: { ...devices['Pixel 7'] }, cpu: 6 }
}

const semVsync = args.includes('--sem-vsync')
const browser = await chromium.launch({ args: semVsync ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [] })
const saida = {}
for (const nome of so) {
  const c = CENARIOS[nome]
  if (!c) { console.log('cenário desconhecido: ' + nome); continue }
  const ctx = await browser.newContext(c.contexto)
  const page = await ctx.newPage()
  const erros = []
  page.on('pageerror', (e) => erros.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
  await page.setContent(doc, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__spikeEngine && window.__spikeEngine.pronto, null, { timeout: 15000 })
  const moldes = await page.evaluate(() => window.__spikeEngine.moldes())
  if (c.cpu > 1) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: c.cpu })
  }
  await page.waitForTimeout(1500)
  if (captura && nome === so[0]) await page.screenshot({ path: captura, fullPage: true })
  const t0 = Date.now()
  // --etapa6: só a rodada da etapa 6 da animação ambiente (60 s travada em 60 FPS no pior caso de hoje)
  const r = await page.evaluate(([f, e6]) => e6 === 'diag' ? window.__spikeEngine.bateria({ fases: window.__spikeEngine.diag, fator: f, titulo: 'Diagnóstico' }) : e6 ? window.__spikeEngine.bateria({ fases: [window.__spikeEngine.etapa6], fator: f, titulo: 'Etapa 6' }) : window.__spikeEngine.bateria({ fator: f }), [fator, args.includes('--diag') ? 'diag' : args.includes('--etapa6')])
  const texto = await page.evaluate(() => window.__spikeEngine.texto())
  console.log(`\n===== ${nome}${semVsync ? ' SEM VSYNC' : ''} (CPU ${c.cpu}×, moldes ${moldes ? 'sim' : 'NÃO'}, ${((Date.now() - t0) / 1000).toFixed(0)} s) =====`)
  console.log(texto)
  if (erros.length) console.log('ERROS NA PÁGINA:\n' + erros.join('\n'))
  saida[nome] = r
  await ctx.close()
}
await browser.close()
const arq = opt('json', null)
if (arq) { const { writeFile } = await import('node:fs/promises'); await writeFile(arq, JSON.stringify(saida, null, 2)) }
