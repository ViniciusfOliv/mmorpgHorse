// Teste do wiki (rápido, sem instalar nada).
//   node prototype/tools/wiki-test.mjs                    testes
//   node prototype/tools/wiki-test.mjs --capturas <pasta>  também salva wiki-1280.png e wiki-390.png na pasta
// Confere: geração determinística; cobertura (todo nome de skill, raridade, elemento, clima, montaria, slot,
// conjunto e peça aparece no md e no html); chave desconhecida quebra; fragmento de artefato válido; e no
// navegador (390 e 1280 px, dentro do esqueleto que o host usa): sem erro de console, sem rolagem horizontal,
// retratos desenhados, busca filtrando e todo link do índice apontando para uma seção que existe.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gerarWiki, descreverEfeito, descreverGatilho, descreverEspecial, descreverBloco, efeitoGeralClima, papelDoStatus } from './wiki.mjs'

const require = createRequire(import.meta.url)
const G = require('../src/data.js')
const inicio = Date.now()
const problemas = []
let testes = 0
function confere(ok, msg) { testes++; if (!ok) problemas.push(msg) }
function lanca(fn, msg) {
  testes++
  try { fn(); problemas.push(msg + ' (não lançou erro)') } catch (e) { /* esperado */ }
}
const arg = process.argv.indexOf('--capturas')
const capturas = arg >= 0 ? resolve(process.argv[arg + 1] || '.') : null

// 1. determinismo
const a = await gerarWiki()
const b = await gerarWiki()
confere(a.md === b.md, 'md difere entre duas gerações')
confere(a.html === b.html, 'html difere entre duas gerações')

// 2. cobertura
const nomes = []
for (const id in G.SKILLS) nomes.push(['skill', G.SKILLS[id].name])
for (const id in G.RARITIES) nomes.push(['raridade', G.RARITIES[id].name])
for (const id in G.ELEMENTS) nomes.push(['elemento', G.ELEMENTS[id].name])
for (const id in G.WEATHERS) nomes.push(['clima', G.WEATHERS[id].name])
for (const h of G.STARTERS.concat(G.WILD_HORSES)) nomes.push(['montaria', h.name])
for (const id in G.GEAR_SLOT_INFO) nomes.push(['slot', G.GEAR_SLOT_INFO[id].name])
for (const id in G.GEAR_SETS) nomes.push(['conjunto', G.GEAR_SETS[id].name])
for (const id in G.GEAR) nomes.push(['peça', G.GEAR[id].name])
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
for (const [tipo, nome] of nomes) {
  confere(a.md.includes(nome), `${tipo} "${nome}" não aparece no md`)
  confere(a.html.includes(escHtml(nome)), `${tipo} "${nome}" não aparece no html`)
}
for (const id in G.GEAR) confere(a.html.includes(`id="peca-${id}"`), `peça ${id} sem linha própria no html`)
for (const id in G.SKILLS) confere(a.html.includes(`id="skill-${id}"`), `skill ${id} sem cartão no html`)

// 3. chave desconhecida quebra
lanca(() => descreverEfeito({ speedMult: 1.1, chaveInventada: 3 }), 'effect com chave inventada')
lanca(() => descreverGatilho('gatilhoInventado'), 'gatilho inventado')
lanca(() => descreverGatilho('weather:granizo'), 'gatilho de clima inventado')
lanca(() => descreverEspecial('bonusInventado', 1), 'bônus especial inventado')
lanca(() => descreverBloco('tunel', {}), 'tipo de bloco inventado')
lanca(() => efeitoGeralClima('granizo'), 'clima inventado')
lanca(() => papelDoStatus('carisma', {}), 'status inventado')
for (const id in G.SKILLS) {
  try { descreverEfeito(G.SKILLS[id].effect); descreverGatilho(G.SKILLS[id].trigger) } catch (e) { problemas.push(`skill ${id}: ${e.message}`) }
}

// 4. fragmento de artefato
for (const re of [/<!doctype/i, /<html[\s>]/i, /<head[\s>]/i, /<body[\s>]/i]) confere(!re.test(a.html), `html contém ${re}`)
confere(a.html.startsWith('<title>Wiki do Galope Elemental</title>'), 'html não começa por <title>Wiki do Galope Elemental</title>')
confere(/<meta name="claude:viewport-fit-sides" content="cover">/.test(a.html.slice(0, 400)), 'meta viewport-fit-sides ausente no topo')
confere(!/\b(alert|confirm|prompt)\s*\(/.test(a.html.replace(/<script>\n\/\* src\/sprites\.js \*\/[\s\S]*?<\/script>/, '')), 'html usa alert/confirm/prompt')
confere(!/Math\.random|new Date|Date\.now/.test(a.md), 'md com aleatoriedade/data')
const externos = [...a.html.matchAll(/<(?:script|link)[^>]+(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1])
for (const u of externos) confere(/^https:\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/.test(u), 'recurso externo não permitido: ' + u)
const ids = new Set([...a.html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
for (const reservado of ['settings', 'sidebar', 'customize', 'upgrade', 'downloads']) confere(!ids.has(reservado), `id reservado pelo host: ${reservado}`)

// 5. navegador
const { chromium } = require('playwright')
const navegador = await chromium.launch()
const pagina = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + a.html + '</body></html>'
const skill = G.SKILLS[Object.keys(G.SKILLS)[1]].name
try {
  for (const largura of [390, 1280]) {
    const ctx = await navegador.newContext({ viewport: { width: largura, height: 900 }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    const erros = []
    page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
    page.on('pageerror', (e) => erros.push(e.message))
    // fontes do Google: o teste usa as fontes de reserva (não depende da rede e confere o pior caso de
    // largura); com --capturas carrega as de verdade, para a captura mostrar a página como o host mostra
    if (!capturas) await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }))
    await page.setContent(pagina, { waitUntil: 'load' })
    await page.waitForFunction(() => window.Sprites && window.Sprites.moldsReady === true, null, { timeout: 5000 }).catch(() => problemas.push(`[${largura}] moldes do PixelLab não carregaram (retratos no desenho por código)`))
    await page.waitForTimeout(100)
    const r = await page.evaluate(() => {
      const de = document.documentElement
      const canvases = [...document.querySelectorAll('canvas[data-montaria]')]
      const vazios = canvases.filter((cv) => {
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return false
        return true
      }).map((cv) => cv.getAttribute('data-montaria'))
      const links = [...document.querySelectorAll('.indice a')].map((x) => x.getAttribute('href'))
      const quebrados = links.filter((h) => !/^#[a-z0-9-]+$/.test(h) || !document.getElementById(h.slice(1)))
      return { rolagem: de.scrollWidth - de.clientWidth, canvases: canvases.length, vazios, links: links.length, quebrados }
    })
    confere(r.rolagem <= 0, `[${largura}] rolagem horizontal de ${r.rolagem} px`)
    confere(r.canvases === G.STARTERS.length + G.WILD_HORSES.length, `[${largura}] ${r.canvases} retratos (esperado ${G.STARTERS.length + G.WILD_HORSES.length})`)
    confere(!r.vazios.length, `[${largura}] retratos vazios: ${r.vazios.join(', ')}`)
    confere(r.links >= 10 && !r.quebrados.length, `[${largura}] índice com links quebrados: ${r.quebrados.join(', ')}`)
    if (capturas) {
      mkdirSync(capturas, { recursive: true })
      await page.screenshot({ path: join(capturas, `wiki-${largura}.png`), fullPage: false })
      await page.locator('#montarias').scrollIntoViewIfNeeded()
      await page.evaluate(() => document.getElementById('montarias').scrollIntoView())
      await page.waitForTimeout(100)
      await page.screenshot({ path: join(capturas, `wiki-${largura}-montarias.png`), fullPage: false })
      await page.evaluate(() => window.scrollTo(0, 0))
    }
    // busca: o nome de uma skill deixa só entradas que casam
    await page.fill('#busca', skill)
    const f = await page.evaluate((nome) => {
      const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      const vis = [...document.querySelectorAll('[data-entrada]')].filter((e) => !e.hidden)
      return {
        vis: vis.length,
        todasCasam: vis.every((e) => e.getAttribute('data-busca').includes(norm(nome))),
        skillVisivel: vis.some((e) => e.getAttribute('data-entrada') === 'skill' && e.querySelector('h4') && e.querySelector('h4').textContent === nome),
        resultado: document.getElementById('busca-resultado').textContent
      }
    }, skill)
    confere(f.vis >= 1 && f.todasCasam && f.skillVisivel, `[${largura}] busca por "${skill}": ${f.vis} visíveis, todas casam: ${f.todasCasam}, skill visível: ${f.skillVisivel}`)
    if (capturas && largura === 390) await page.screenshot({ path: join(capturas, 'wiki-390-busca.png'), fullPage: false })
    // estado vazio
    await page.fill('#busca', 'zzzzinexistente')
    const vazio = await page.evaluate(() => ({
      vis: [...document.querySelectorAll('[data-entrada]')].filter((e) => !e.hidden).length,
      msg: [...document.querySelectorAll('[data-vazio]')].every((e) => !e.hidden)
    }))
    confere(vazio.vis === 0 && vazio.msg, `[${largura}] busca sem resultado não mostra o estado vazio`)
    // filtro de elemento
    await page.fill('#busca', '')
    await page.click('#filtro-el-fogo')
    const fe = await page.evaluate(() => [...document.querySelectorAll('[data-entrada="skill"], [data-entrada="montaria"]')].filter((e) => !e.hidden).every((e) => e.getAttribute('data-el') === 'fogo'))
    confere(fe, `[${largura}] filtro Fogo deixou passar outro elemento`)
    confere(!erros.length, `[${largura}] erros de console: ${erros.join(' | ')}`)
    await ctx.close()
  }
} finally {
  await navegador.close()
}

const seg = ((Date.now() - inicio) / 1000).toFixed(1)
if (problemas.length) {
  console.log('PROBLEMAS:\n' + problemas.join('\n'))
  process.exit(1)
}
console.log(`OK: wiki determinístico, completo e navegável (${testes} conferências, ${nomes.length} nomes, ${seg} s)`)
