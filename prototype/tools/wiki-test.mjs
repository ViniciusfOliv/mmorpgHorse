// Teste do wiki (rápido, sem instalar nada).
//   node prototype/tools/wiki-test.mjs                    testes
//   node prototype/tools/wiki-test.mjs --capturas <pasta>  também salva wiki-1280.png e wiki-390.png na pasta
// Confere: geração determinística; cobertura (todo nome de skill, raridade, elemento, clima, montaria, slot,
// conjunto e peça aparece no md e no html); chave desconhecida quebra; fragmento de artefato válido; e no
// navegador (390 e 1280 px, dentro do esqueleto que o host usa): sem erro de console, sem rolagem horizontal,
// retratos desenhados, busca filtrando e todo link do índice apontando para uma seção que existe.
import { createRequire } from 'node:module'
import { mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gerarWiki, descreverEfeito, descreverEfeitoTipo, descreverGatilho, descreverEspecial, descreverBloco, efeitoGeralClima, papelDoStatus } from './wiki.mjs'

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

// chance de skill com conjunto: SOR + bônus de Sorte do conjunto e + bônus de chance (Comum Nv 1)
confere(/\| Comum \| 40% \/ 45,5% \|/.test(a.md), 'tabela de chance de skill: Comum Nv 1 com conjunto devia mostrar 45,5%')

// modelo v3 (cavalos v3, bloco 1): fórmula do status, raridades, estrelas, skill de tipo, sem Neutro
confere(a.md.includes('natural = início da faixa da raridade + 16 × g / 31 + (level − 1) × (0,3 + 0,08 × g / 31)'), 'seção Status sem a fórmula v3 com a genética g')
confere(/nota da genética[^\n]*C 0–7 · B 8–15 · A 16–23 · S 24–31/i.test(a.md), 'seção Status sem as notas de genética (C 0–7 … S 24–31)')
for (const [rar, lo, hi, teto] of [['Comum', 40, 56, 80], ['Mágico', 45, 61, 85], ['Raro', 50, 66, 90], ['Lendário', 55, 71, 95], ['Mítico', 60, 76, 100]]) {
  confere(new RegExp(`\\| (?:!\\[\\]\\([^)]*\\) )?${rar} \\|[^\\n]*\\| ${lo}–${hi} \\| ${teto} \\|`).test(a.md), `tabela de raridades: ${rar} devia nascer entre ${lo} e ${hi} com teto ${teto}`)
}
for (const [est, m, livres, lim] of [['★', '×1', 49, 17], ['★★', '×1,2', 58, 20], ['★★★', '×1,5', 73, 25]]) {
  confere(new RegExp(`\\| ${est} \\| ${m} \\| ${livres} \\| ${lim} \\|`).test(a.md), `tabela de estrelas: ${est} devia ter ${m}, ${livres} pontos livres e limite ${lim} no Nv 50`)
}
confere(/### Skill de tipo/.test(a.md) && a.html.includes('id="skills-tipo"'), 'falta a seção da skill de tipo (md e html)')
confere(a.md.includes('P = 1 + 0,4 × (level − 1) / 49 + 0,4 × ordem da raridade / 4'), 'skill de tipo sem a fórmula da força P')
for (const [nome, el, terco, efeito] of [
  ['Labareda', 'Fogo', 'primeiro terço (da largada a 1/3)', 'aceleração +23%'],
  ['Raízes Firmes', 'Grama', 'terço do meio (de 1/3 a 2/3)', 'Força efetiva +7; Manobra efetiva +7; gasto de estamina −1,2%'],
  ['Maré Alta', 'Água', 'último terço (de 2/3 à chegada)', 'velocidade +1,8%; recupera 1,2% do tanque ao entrar no terço']
]) {
  confere(a.md.includes(`| ![](../prototype/assets/icons/sk-tipo-${{ Fogo: 'fogo', Água: 'agua', Grama: 'grama' }[el]}.png) **${nome}** | ${el} | ${terco} | ${efeito} |`), `skill de tipo ${nome}: linha com elemento, terço e efeito (P = 1) não confere`)
}
confere(!/neutro/i.test(a.md), 'md ainda fala de "Neutro"')
confere(!/neutro/i.test(a.html.replace(/<script>\n\/\* src\/sprites\.js \*\/[\s\S]*?<\/script>/, '')), 'html ainda fala de "Neutro" (fora do sprites.js embutido)')
confere(!/oculto no jogo|status base|bônus fixo|janela do grau|exclusivas/i.test(a.md), 'md com redação do modelo antigo (oculto, status base, bônus fixo, janela, exclusivas)')
confere(a.html.includes('<li><b>15</b> skills</li>') && a.html.includes('<li><b>15</b> montarias</li>') && a.html.includes('<li><b>3</b> elementos</li>'), 'contagens do topo: 15 skills, 15 montarias, 3 elementos')
confere(/id="filtro-el-geral"[^>]*>(<img[^>]*>)?Gerais</.test(a.html), 'falta o filtro "Gerais" (skills gerais)')
confere(/<span class="el el--geral"><img /.test(a.html), 'skills gerais sem o ícone el-geral')

// 2a. marcas e jóquei (parte 2a dos cavalos): seção com os genes, a herança, o jóquei, a raridade e a tabela dos 15 cavalos
{
  const ini = a.md.indexOf('## Marcas e jóquei')
  const fim = a.md.indexOf('<a id="cruzamento">')
  const sec = ini >= 0 && fim > ini ? a.md.slice(ini, fim) : ''
  confere(sec.length > 0, 'falta a seção "Marcas e jóquei" no md (antes do Cruzamento)')
  confere(/<section class="secao" id="marcas"/.test(a.html), 'falta a seção "marcas" no html')
  for (const v of G.MARCAS.cara) confere(sec.includes(v === 'frente' ? 'frente branca' : v), `seção Marcas sem o valor de cara "${v}"`)
  for (const v of G.MARCAS.patas) confere(sec.includes(`| Patas | ${G.MARCAS.patas.join(', ').replace(/, (\d)$/, ' e $1')} meias brancas`), `seção Marcas sem a lista de patas (${v})`)
  for (const v of G.MARCAS.corpo) confere(new RegExp(`\\| Corpo \\|[^\\n]*${v === 'ruao' ? 'ruão' : v}`).test(sec), `seção Marcas sem o valor de corpo "${v}"`)
  confere(sec.includes('10% de chance de **mutação**'), 'seção Marcas sem os 10% de mutação')
  for (const p of G.JOQUEI.padroes) confere(sec.includes(p), `seção Marcas sem o padrão de jóquei "${p}"`)
  for (const c of G.JOQUEI.capacetes) confere(sec.includes(G.JOQUEI.nomes[c]), `seção Marcas sem o nome do capacete ${G.JOQUEI.nomes[c]}`)
  confere(sec.includes(`o capacete inicial é ${G.JOQUEI.nomes[G.JOQUEI.capacete]}`), 'seção Marcas sem o nome do capacete inicial')
  confere(!/#[0-9a-fA-F]{6}/.test(sec), 'a seção Marcas mostra um hex de cor ("#rrggbb")')
  confere(/\| Comum \| nada \|/.test(sec), 'raridade Comum devia ser "nada"')
  confere(/\| Mágico \| brilho na crina \(mistura de 25% da cor da raridade\) \|/.test(sec), 'raridade Mágico: só brilho de 25%')
  confere(/\| Raro \| brilho na crina \(mistura de 30%[^|]*3 faíscas/.test(sec), 'raridade Raro: brilho de 30% e 3 faíscas')
  confere(/\| Lendário \| brilho na crina \(mistura de 45%[^|]*5 faíscas/.test(sec), 'raridade Lendário: brilho de 45% e 5 faíscas')
  confere(/\| Mítico \| brilho na crina \(mistura de 45%[^|]*5 faíscas[^|]*rastro/.test(sec), 'raridade Mítico: 5 faíscas e rastro')
  const catalogo = G.STARTERS.concat(G.WILD_HORSES)
  confere(catalogo.length === 15, 'o catálogo devia ter 15 cavalos')
  for (const h of catalogo) {
    const cara = h.marcas.cara === 'frente' ? 'frente branca' : h.marcas.cara
    confere(new RegExp(`\\| ${h.name} \\| ${cara} \\| ${h.marcas.patas} \\| ${h.marcas.corpo === 'ruao' ? 'ruão' : h.marcas.corpo}`).test(sec), `tabela de marcas: linha de ${h.name} não confere com o data.js`)
  }
  const linhasTab = sec.slice(sec.indexOf('### Marcas dos iniciais e selvagens')).split('\n').filter((l) => /^\| /.test(l)).length - 2
  confere(linhasTab === 15, `tabela de marcas devia ter 15 linhas, tem ${linhasTab}`)
}

// 2b. ícones: skill (e skill de tipo), status, clima, piso, liga e raridade que têm arquivo ganham o <img> antes do nome
const DIR_ICONES = resolve(import.meta.dirname, '..', 'assets', 'icons')
const temIcone = (id) => existsSync(join(DIR_ICONES, id + '.png'))
const IMG = '<img class="ic" src="data:image/png;base64,[A-Za-z0-9+/=]+" alt="" width="16" height="16">'
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const comIconeHtml = (nome) => new RegExp(IMG + '(?:<[^>]+>)*' + reEsc(escHtml(nome))).test(a.html)
const comIconeMd = (id, nome) => new RegExp('!\\[\\]\\(\\.\\./prototype/assets/icons/' + id + '\\.png\\) (?:\\*\\*)?' + reEsc(nome)).test(a.md)
const alvos = []
for (const id in G.SKILLS) alvos.push(['sk-' + id, G.SKILLS[id].name])
for (const el in G.TYPE_SKILLS) alvos.push(['sk-tipo-' + el, G.TYPE_SKILLS[el].name])
for (const k of G.STAT_KEYS) alvos.push(['st-' + k, G.STATS[k].name])
for (const id in G.WEATHERS) alvos.push(['cl-' + id, G.WEATHERS[id].name])
for (const id in G.SURFACES) alvos.push(['pi-' + id, G.SURFACES[id].name])
for (const L of G.LEAGUES) alvos.push(['liga-' + L.id, L.name])
for (const id in G.RARITIES) alvos.push(['rar-' + id, G.RARITIES[id].name])
let comArquivo = 0
for (const [id, nome] of alvos) {
  if (!temIcone(id)) { confere(!a.md.includes(`icons/${id}.png`), `${id}: sem arquivo, mas o md tem link`); continue }
  comArquivo++
  confere(comIconeHtml(nome), `ícone ${id} não aparece antes de "${nome}" no html`)
  confere(comIconeMd(id, nome), `ícone ${id} não aparece antes de "${nome}" no md`)
}
confere(comArquivo === alvos.length, `só ${comArquivo} de ${alvos.length} dos ícones de skill/status/clima/piso/liga/raridade têm arquivo`)
// todo link de imagem do md aponta para um PNG que existe (nada de link quebrado)
const linksImg = [...a.md.matchAll(/!\[\]\(\.\.\/prototype\/assets\/icons\/([a-z0-9-]+)\.png\)/g)].map((m) => m[1])
confere(linksImg.length >= 40, `md com só ${linksImg.length} imagens de ícone`)
for (const id of linksImg) confere(temIcone(id), `link do md para ícone que não existe: ${id}`)
// seção de reservados: os 5 da spec §2.6, em 32 px no html e com link no md
confere(a.html.includes('id="icones-reservados"') && /## Ícones reservados/.test(a.md), 'falta a seção "Ícones reservados"')
for (const id of ['item-redea', 'moeda-gema', 'ins-fogo', 'ins-agua', 'ins-grama']) {
  confere(a.md.includes(`![](../prototype/assets/icons/${id}.png)`) && a.md.includes('`' + id + '`'), `reservado ${id} sem imagem/nome no md`)
  confere(new RegExp('<img class="ic ic32" src="data:image/png;base64,[A-Za-z0-9+/=]+" alt="" width="32" height="32">(?:<[^>]+>)*<code>' + id + '</code>').test(a.html), `reservado ${id} sem <img> de 32 px no html`)
}

// 3. chave desconhecida quebra
lanca(() => descreverEfeito({ speedMult: 1.1, chaveInventada: 3 }), 'effect com chave inventada')
lanca(() => descreverGatilho('gatilhoInventado'), 'gatilho inventado')
lanca(() => descreverGatilho('weather:granizo'), 'gatilho de clima inventado')
lanca(() => descreverEspecial('bonusInventado', 1), 'bônus especial inventado')
lanca(() => descreverBloco('tunel', {}), 'tipo de bloco inventado')
lanca(() => efeitoGeralClima('granizo'), 'clima inventado')
lanca(() => papelDoStatus('carisma', {}), 'status inventado')
lanca(() => descreverEfeitoTipo({ accelMult: 0.2, chaveInventada: 1 }, 1), 'efeito de skill de tipo com chave inventada')
for (const el in G.TYPE_SKILLS) {
  try { descreverEfeitoTipo(G.TYPE_SKILLS[el].effect, 1) } catch (e) { problemas.push(`skill de tipo ${el}: ${e.message}`) }
}
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
    // filtro Gerais: só as skills gerais (nenhuma montaria é "geral")
    if (await page.$('#filtro-el-geral')) await page.click('#filtro-el-geral')
    const fg = await page.evaluate(() => {
      const vis = [...document.querySelectorAll('[data-entrada="skill"], [data-entrada="montaria"]')].filter((e) => !e.hidden)
      return { n: vis.length, todas: vis.every((e) => e.getAttribute('data-entrada') === 'skill' && e.getAttribute('data-el') === 'geral') }
    })
    const nGerais = Object.keys(G.SKILLS).filter((id) => G.SKILLS[id].element === 'geral').length
    confere(fg.todas && fg.n === nGerais, `[${largura}] filtro Gerais: ${fg.n} visíveis (esperado ${nGerais} skills gerais), só gerais: ${fg.todas}`)
    await page.click('#filtro-el-todos')
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
