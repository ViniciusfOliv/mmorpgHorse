// Fluidez das trocas de tela: quanto tempo cada troca leva do toque até a tela nova pintada, num celular simples.
//   node tools/fluidez.mjs                 -> imprime a tabela (mediana de 5 rodadas)
//   node tools/fluidez.mjs --teto 60       -> idem, e sai com código 1 se alguma troca (a carga não conta) passar de 60 ms
//   node tools/fluidez.mjs --rodadas 9     -> mais rodadas (a mediana oscila menos)
//   node tools/fluidez.mjs --arquivo X.html -> mede outro build (ex.: o de um commit antigo, para comparar)
//   node tools/fluidez.mjs --json          -> a medição em JSON (para guardar o "antes")
//   node tools/fluidez.mjs --sem-aquecer   -> não espera o aquecimento das telas (o toque logo que o jogo abre)
// Cenário: Chromium do Playwright com a CPU 4× mais lenta (CDP Emulation.setCPUThrottlingRate), janela 360 × 780 com
// deviceScaleFactor 3, dist/jogo-dev.html com o save DEV novo (cada rodada num contexto novo: localStorage vazio), e, por
// cima dele, o "save de quem já joga": 8 montarias no estábulo (cópias da inicial), state.gold = 5000 e o Ginásio da Grama
// na etapa 2 (o Estábulo é desenhado de novo com elas antes de medir, como na carga de quem já as tem). A medição começa
// depois de o aquecimento das telas acabar (game.js, aqueceTelas: uns 3 s depois da carga neste perfil; --sem-aquecer
// mede sem esperar). As trocas, em ordem, estão em TROCAS. Dois tipos:
//   'troca'  — do click() até o 2º requestAnimationFrame depois dele (a tela nova pintada). É o número que tem meta.
//   'viagem' — a troca que acontece no meio de uma animação (zoom e íris entre o mapa-múndi e a trilha): o número é o
//              pior intervalo entre dois quadros seguidos do toque até a animação acabar (o engasgo que o jogador vê; um
//              quadro sem engasgo dá ~17 ms). "resposta" é do toque ao 2º quadro e "total" é a viagem inteira.
// "js" é só o tempo do tratador do toque (montar o HTML e o 1º desenho dos canvas); "imagens" é até as <img> da tela
// decodificarem (só informação). A carga é do início da navegação até o 2º quadro depois de o título do Estábulo aparecer.
// Também exporta medirFluidez(browser, url, rodadas), que o bloco "fluidez" do tools/ui-test.mjs usa.
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ABA = (id) => `[data-acao="aba"][data-id="${id}"]`

// [nome, rótulo, seletor do toque, seletor que prova a chegada, tipo]; tipo 'prepara' é um toque que não é medido
export const TROCAS = [
  ['correr', 'aba Correr', ABA('correr'), '#t-correr', 'troca'],
  ['expedicao', 'aba Expedição (mapa-múndi)', ABA('expedicao'), '#t-expedicao', 'troca'],
  ['viagem', 'viagem ao ginásio (mapa → trilha)', '[data-acao="ginasio-abrir"][data-id="grama"]', '#t-ginasio', 'viagem'],
  ['preparo', 'abrir o preparo da etapa', '[data-acao="ginasio-etapa"][aria-current="step"]', '#t-etapa', 'troca'],
  ['voltar', 'voltar do preparo à trilha', '[data-acao="ginasio-voltar"]', '#t-ginasio', 'troca'],
  ['', '', '[data-acao="ginasio-etapa"][aria-current="step"]', '#t-etapa', 'prepara'],
  ['time', 'pôr um cavalo no time (mesma tela)', '[data-acao="ginasio-time"]:not([aria-disabled="true"])', '[data-acao="ginasio-time"][aria-pressed="true"]', 'troca'],
  ['desafio', 'Desafiar → cena de desafio', '[data-acao="ginasio-desafiar"]', '#t-desafio', 'troca'],
  ['resumo', 'Pular tudo → resumo do desafio', '[data-acao="ginasio-pular-tudo"]', '#t-resumo', 'troca'],
  ['trilha', 'resumo → trilha', '[data-acao="ginasio-resumo"][data-id="trilha"]', '#t-ginasio', 'troca'],
  ['volta-mapa', 'voltar da trilha ao mapa-múndi', '[data-acao="ginasio-voltar"]', '#t-expedicao', 'viagem'],
  ['haras', 'aba Haras', ABA('haras'), '#t-haras', 'troca'],
  ['loja', 'aba Loja', ABA('loja'), '#t-loja', 'troca'],
  ['mochila', 'Loja → Mochila', '[data-acao="loja-parte"][data-id="mochila"]', '[data-acao="loja-parte"][data-id="mochila"][aria-pressed="true"]', 'troca'],
  ['estabulo', 'aba Estábulo (8 montarias)', ABA('estabulo'), '#t-estabulo', 'troca'],
  ['ficha', 'abrir a ficha de um cavalo', '[data-acao="montaria"]', '#t-montaria', 'troca'],
  ['ficha-voltar', 'voltar da ficha ao Estábulo', '[data-acao="montaria-voltar"]', '#t-estabulo', 'troca'],
  ['perfil', 'abrir o Perfil', '[data-acao="perfil"]', '#t-perfil', 'troca'],
  ['perfil-voltar', 'voltar do Perfil', '[data-acao="perfil-voltar"]', '#t-estabulo', 'troca'],
  ['expedicao2', 'aba Expedição (2ª vez)', ABA('expedicao'), '#t-expedicao', 'troca']
]
export const MEDIDAS = TROCAS.filter((t) => t[4] !== 'prepara')

const mediana = (xs) => { const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2) }

// o toque e a medição, dentro da página
/* c8 ignore next */
async function tocaEMede([sel, chega, tipo]) {
  const el = document.querySelector(sel)
  if (!el) return { erro: 'sem ' + sel }
  const quadro = () => new Promise((ok) => requestAnimationFrame(() => ok(performance.now())))
  const t = performance.now()
  el.click()
  const js = performance.now() - t
  const q1 = await quadro(), q2 = await quadro()
  const r = { js: Math.round(js), quadro: Math.round(q2 - t) }
  if (tipo === 'viagem') {
    // a viagem: quadro a quadro até a tela de chegada estar lá e nenhum canvas estar mais na animação (ou 3 s)
    const naViagem = () => [...document.querySelectorAll('#tela canvas[data-viagem]')].some((c) => c.getAttribute('data-viagem'))
    let ant = q2, pior = Math.max(q1 - t, q2 - q1), calmos = 0
    while (ant - t < 3000 && calmos < 4) {
      const agora = await quadro()
      pior = Math.max(pior, agora - ant)
      ant = agora
      calmos = document.querySelector(chega) && !naViagem() ? calmos + 1 : 0
    }
    r.resposta = r.quadro
    r.quadro = Math.round(pior)
    r.total = Math.round(ant - t)
  }
  if (!document.querySelector(chega)) return { erro: 'a troca não chegou em ' + chega }
  await Promise.all([...document.querySelectorAll('#tela img')].map((i) => i.decode().catch(() => {})))
  r.imagens = Math.round(performance.now() - t)
  return r
}

// o "save de quem já joga" por cima do save DEV novo (na página): 8 montarias, Ouro e o Ginásio da Grama na etapa 2
/* c8 ignore next */
function preparaSave() {
  const g = window.__galope, st = g.state
  st.gold = 5000
  Object.assign(st.ginasios.grama, { etapa: 2 })
  const nomes = ['Aurora', 'Trovão', 'Faísca', 'Neblina', 'Cometa', 'Jurema', 'Tição']
  for (let i = 0; st.mounts.length < 8; i++) {
    const c = JSON.parse(JSON.stringify(st.mounts[0]))
    c.uid = 'm' + st.nextUid; st.nextUid += 1
    c.name = nomes[i % nomes.length]; c.level = 3 + i * 2
    Object.keys(c.equip || {}).forEach((k) => { c.equip[k] = null })
    st.mounts.push(c)
  }
  st.stableSlots = Math.max(st.stableSlots, st.mounts.length)
}

// uma rodada: contexto novo, carga, e as trocas em sequência. Devolve { carga, trocas: { nome: { quadro, js, imagens, ... } } }
async function rodada(browser, url, semAquecer) {
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
    await pg.evaluate(preparaSave)
    // o Estábulo de novo, agora com as 8 montarias (como na carga de quem já as tem): não é medido
    await pg.evaluate(async (sel) => { document.querySelector(sel).click(); await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))) }, ABA('estabulo'))
    // o aquecimento das telas (game.js, aqueceTelas) roda em tempo ocioso depois da carga: a medição espera ele acabar,
    // como o jogador que olha o Estábulo uns segundos antes do 1º toque (`aquecido` diz em quanto tempo acabou, em ms
    // desde a navegação; null num build sem aquecimento, que só espera o tempo de sempre)
    let aquecido = null
    if (!semAquecer && await pg.evaluate(() => typeof window.__galope.aquecido === 'function')) {
      await pg.waitForFunction(() => window.__galope.aquecido() === true, null, { timeout: 30000 })
      aquecido = Math.round(await pg.evaluate(() => performance.now()))
    }
    await pg.waitForTimeout(500)
    const trocas = {}
    for (const [nome, , sel, chega, tipo] of TROCAS) {
      const r = await pg.evaluate(tocaEMede, [sel, chega, tipo])
      if (r.erro) throw new Error(`fluidez: ${nome || sel}: ${r.erro}`)
      if (tipo !== 'prepara') trocas[nome] = r
      await pg.waitForTimeout(400)   // o desenho adiado (o que ficou fora da tela) termina antes da próxima troca
    }
    if (erros.length) throw new Error('fluidez: erro na página: ' + erros.join(' | '))
    return { carga, aquecido, trocas }
  } finally {
    await ctx.close()
  }
}

// mede `rodadas` vezes e devolve as medianas: { carga, trocas: { nome: { quadro, js, imagens, ... } }, rodadas: [...] }
// semAquecer: não espera o aquecimento (o jogador que toca logo que o jogo abre)
export async function medirFluidez(browser, url, rodadas = 5, semAquecer = false) {
  const todas = []
  for (let i = 0; i < rodadas; i++) todas.push(await rodada(browser, url, semAquecer))
  const trocas = {}
  for (const [nome] of MEDIDAS) {
    trocas[nome] = {}
    for (const k of Object.keys(todas[0].trocas[nome])) trocas[nome][k] = mediana(todas.map((r) => r.trocas[nome][k]))
  }
  const aq = todas.map((r) => r.aquecido).filter((x) => x != null)
  return { carga: mediana(todas.map((r) => r.carga)), aquecido: aq.length ? mediana(aq) : null, trocas, rodadas: todas }
}

export function tabelaFluidez(m) {
  const linhas = ['| Troca | ms (toque → tela pintada) | js | até as imagens | obs. |', '|---|---|---|---|---|', `| carga da página até o Estábulo | ${m.carga} | | | ${m.aquecido != null ? `aquecimento das telas pronto aos ${m.aquecido} ms` : ''} |`]
  for (const [nome, rotulo, , , tipo] of MEDIDAS) {
    const v = m.trocas[nome]
    linhas.push(`| ${rotulo} | ${v.quadro} | ${v.js} | ${v.imagens} | ${tipo === 'viagem' ? `pior quadro da animação; resposta ${v.resposta} ms, viagem ${v.total} ms` : ''} |`)
  }
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
    m = await medirFluidez(browser, pathToFileURL(arquivo).href, rodadas, process.argv.includes('--sem-aquecer'))
  } finally {
    await browser.close()
  }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ carga: m.carga, aquecido: m.aquecido, trocas: m.trocas }))
  } else {
    console.log(`Fluidez (${arquivo}; CPU 4× mais lenta, 360 × 780, dpr 3; mediana de ${rodadas} rodadas)\n`)
    console.log(tabelaFluidez(m))
  }
  if (teto !== null) {
    const acima = MEDIDAS.filter(([nome]) => m.trocas[nome].quadro > teto).map(([nome, rotulo]) => `${rotulo}: ${m.trocas[nome].quadro} ms`)
    if (acima.length) { console.log(`\nACIMA DO TETO de ${teto} ms:\n  ` + acima.join('\n  ')); process.exit(1) }
    console.log(`\nOK: todas as trocas em ${teto} ms ou menos`)
  }
}
