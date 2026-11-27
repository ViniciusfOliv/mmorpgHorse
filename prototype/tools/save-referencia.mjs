// Grava (ou confere) a referência do saneamento e da migração do save (T16): passa um conjunto de saves pelo sanitize
// do jogo no navegador, pelo gancho de teste window.__galope.saneiaTeste (sem gravar nada), e guarda um hash do save
// saneado e do que ficou de fora (cavalos e peças que não se leem). Com --check confere também o módulo save.js no Node:
// o mesmo save tem de dar o mesmo texto.
//   node prototype/tools/save-referencia.mjs           grava (rodar com o jogo de ANTES da mudança; regravar só de propósito)
//   node prototype/tools/save-referencia.mjs --check   confere o jogo de agora (e o save.js no Node) contra o gravado
// Casos: saves de todas as versões (v1/v2 com o inicial na raiz, v3 com o Neutro e o inventário antigo, o save rico de
// agora com o número da versão de 4 a 10, um de versão mais nova e lixo), cada um também com 1 a 3 campos estragados
// sorteados por uma seed fixa; tudo no jogo normal e no modo DEV (que sanea diferente: vagas, skills, modelos dev-N).
// O relógio do navegador fica parado num instante fixo (o dia da diária e o agora do AFK) e o sorteio da seed de um save
// novo (crypto.getRandomValues) dá sempre o mesmo número.
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { servirDist } from './sala-referencia.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const AQUI = dirname(fileURLToPath(import.meta.url))
const SRC = join(AQUI, '..', 'src')
const ARQ = join(AQUI, 'save-referencia.json')
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)
const INSTANTE = new Date('2026-11-27T12:00:00Z')
const SEED_NOVA = 0x9e3779b9   // o que o crypto.getRandomValues parado devolve (a seed de um save sem seed)
const MUTACOES = 46            // saves estragados por save-base

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const clone = (o) => JSON.parse(JSON.stringify(o))

// o save rico de agora (v10): o do jogo logo depois de abrir, com cinco cavalos (cruzados, com pontos, torrões, paleta e
// pais), peças de vários tipos equipadas, sala aberta da preparação, mochila, diária, loja, ginásios e o AFK com um cavalo
function saveRico(G, s0) {
  const s = clone(s0)
  s.seedBase = 424242; s.rev = 17; s.gold = 3210; s.tier = 100; s.raceCounter = 9
  s.races = 9; s.wins = 3; s.podiums = 5; s.goldWon = 1400
  const m1 = s.mounts[0]
  m1.level = 14; m1.xp = 40; m1.alloc = Object.assign({}, m1.alloc, { vel: 3, acel: 2, est: 1 }); m1.torroes = 2
  const fichas = [
    ['m2', 'agua', 'magico', 'f', 'mare', ['arranque', 'pe-na-chuva'], { 'arranque': 2, 'pe-na-chuva': 1 }],
    ['m3', 'grama', 'raro', 'm', null, ['sprint', 'nevoa-amiga', 'drift'], { sprint: 3, 'nevoa-amiga': 1, drift: 5 }],
    ['m4', 'fogo', 'lendario', 'f', 'w-faisca', ['sol-a-pino', 'chama-final'], { 'sol-a-pino': 4 }],
    ['m7', 'agua', 'comum', 'm', 'w-lambari', ['canto-da-iara'], { 'canto-da-iara': 1 }]
  ]
  fichas.forEach(([uid, element, rarity, sex, templateId, skills, ranks], i) => {
    const m = clone(m1)
    Object.assign(m, { uid, element, rarity, sex, templateId, name: 'Cavalo ' + uid, level: 3 + i * 7, xp: 5 * i, skills, skillRanks: ranks,
      torroes: i, breedLeft: 2, born: 100 + i, respecFree: i % 2 === 0, alloc: Object.assign({}, m1.alloc, { forca: i, garra: 1 }) })
    if (!templateId) { m.palette = { coat: '#a0522d', coatShade: '#7a3e22', mane: '#2a2a2a', accent: '#f2c230' }; m.parents = { f: { uid: 'm1', name: m1.name }, m: { uid: 'm2', name: 'Cavalo m2' } } }
    m.equip = { ferraduras: null, sela: null, armadura: null, testeira: null, estribos: null }
    s.mounts.push(m)
  })
  s.nextUid = 8
  const ids = Object.keys(G.GEAR)
  const pecas = [ids[1], ids[3], ids[9], ids.find((id) => G.GEAR[id].slot === 'armadura'), ids.find((id) => G.GEAR[id].slot === 'estribos'), ids[5]]
  const linhas = s.items[0] && s.items[0].linhas
  pecas.forEach((id, i) => {
    const it = { uid: 'i' + (10 + i), id, plus: i % 4, rerolls: i }
    if (i % 2 === 0 && linhas) it.linhas = clone(linhas)
    if (i === 2) it.origem = 'afk'
    if (i === 3) it.origem = 'forja'
    s.items.push(it)
  })
  s.nextItemUid = 20
  s.mounts[1].equip[G.GEAR[pecas[0]].slot] = 'i10'
  s.mounts[2].equip[G.GEAR[pecas[2]].slot] = 'i12'
  s.mounts[3].equip[G.GEAR[pecas[3]].slot] = 'i13'
  s.pedras = 4; s.enhanceCounter = 6; s.forjaCounter = 2; s.redeas = 3; s.breedCounter = 2; s.stableSlots = 5
  s.pending = { counter: 9, training: false, fee: 100, pr: 900, gear: [], alloc: clone(m1.alloc), prazo: 1796000000000, uid: 'm1', rank: 2, donos: ['w-faisca', 'mare'] }
  Object.keys(s.mochila).forEach((id, i) => { s.mochila[id] = i % 3 })
  s.diaria = { prox: 3, ciclos: 1, ultimo: 20420 }
  s.lojaItens = { dia: 20420, comprados: Object.fromEntries(Object.keys(s.lojaItens.comprados).map((id) => [id, 1])), estrelaDia: null }
  s.itemCounter = 5
  G.GYM_ORDER.forEach((id, i) => { s.ginasios[id] = Object.assign({}, s.ginasios[id], { etapa: [5, 2, 0][i], revDia: i ? null : 20419, revVitorias: i ? 0 : 1 }) })
  s.gymCounter = 4
  if (s.afk && s.afk.vagas && s.afk.vagas[0]) { s.afk.vagas[0].uid = 'm3' }
  s.settings = { motion: 'reduzidas' }; s.joquei = { padrao: 'xadrez', capacete: '#62B8FF' }
  return s
}

function basesDe(G, s0) {
  const rico = saveRico(G, s0)
  const velho = { starterId: 'mare', level: 6, xp: 33, tactic: 'arrancar', gold: 480, races: 4, wins: 1, podiums: 2, goldWon: 90, seedBase: 31337, raceCounter: 4,
    inventory: ['ferradura-leve', 'rapadura-engenho', 'antolhos', 'nao-existe', 'figa-sorte'], equipped: 'antolhos' }
  const v3 = Object.assign(clone(velho), { v: 3, mounts: [
    Object.assign(clone(s0.mounts[0]), { uid: 'm1', element: 'neutro', skills: ['arranque', 'labareda'] }),
    Object.assign(clone(s0.mounts[0]), { uid: 'm2', element: 'neutro', templateId: 'cavalo-que-saiu', sex: 'f' }),
    Object.assign(clone(s0.mounts[0]), { uid: 'm2', name: 'Repetido' })
  ], activeId: 'm2', nextUid: 3 })
  delete v3.mounts[0].equip; v3.mounts[1].equip = 'lixo'
  const bases = [
    ['v1', Object.assign({ v: 1 }, clone(velho))],
    ['v2', Object.assign({ v: 2 }, clone(velho), { skills: ['arranque', 'sprint', 'chama-final', 'arranque'] })],
    ['v3', v3]
  ]
  for (let v = 4; v <= 10; v++) bases.push(['rico-v' + v, Object.assign(clone(rico), { v })])
  bases.push(['rico-v-texto', Object.assign(clone(rico), { v: '10' })])
  bases.push(['rico-sem-v', (() => { const s = clone(rico); delete s.v; return s })()])
  bases.push(['rico-v11', Object.assign(clone(rico), { v: 11 })])
  bases.push(['rico-dev', Object.assign(clone(rico), { devDias: 3, devMin: 45, mounts: rico.mounts.concat([Object.assign(clone(rico.mounts[4]), { uid: 'm9', templateId: 'dev-12', skills: ['sol-a-pino', 'nascente'] })]) })])
  bases.push(['novo', clone(s0)])
  return bases
}

// estraga 1 a 3 campos (folhas ou objetos) sorteados: some, null, texto, negativo, fração, enorme, array, objeto, booleano,
// repete um elemento de lista
const ESTRAGOS = [
  (o, k) => { delete o[k] }, (o, k) => { o[k] = null }, (o, k) => { o[k] = 'texto' }, (o, k) => { o[k] = -1 },
  (o, k) => { o[k] = 1.5 }, (o, k) => { o[k] = 1e15 }, (o, k) => { o[k] = [] }, (o, k) => { o[k] = {} },
  (o, k) => { o[k] = true }, (o, k) => { o[k] = typeof o[k] === 'number' ? String(o[k]) : 7 },
  (o, k) => { if (Array.isArray(o[k]) && o[k].length) o[k].push(clone(o[k][0])); else o[k] = 0 }
]
function caminhos(o, pre, out, prof) {
  if (!o || typeof o !== 'object' || prof > 4) return out
  for (const k of Object.keys(o)) { out.push([pre, k]); caminhos(o[k], pre.concat([k]), out, prof + 1) }
  return out
}
function estragado(base, rng) {
  const s = clone(base), n = 1 + Math.floor(rng() * 3), feitos = []
  for (let i = 0; i < n; i++) {
    const cs = caminhos(s, [], [], 0)
    if (!cs.length) break
    const [pre, k] = cs[Math.floor(rng() * cs.length)]
    let o = s
    for (const p of pre) o = o[p]
    const e = Math.floor(rng() * ESTRAGOS.length)
    ESTRAGOS[e](o, k)
    feitos.push(pre.concat([k]).join('.') + '#' + e)
  }
  return s
}

export function casosDe(G, s0) {
  const casos = []
  const rng = mulberry32(161616)
  for (const [nome, base] of basesDe(G, s0)) {
    casos.push([nome, JSON.stringify(base)])
    for (let i = 0; i < MUTACOES; i++) casos.push([nome + '~' + i, JSON.stringify(estragado(base, rng))])
  }
  for (const [nome, lixo] of [['null', null], ['numero', 7], ['texto', 'oi'], ['lista', []], ['vazio', {}], ['so-v3', { v: 3 }], ['v2-sem-inicial', { v: 2, starterId: 'nao-existe' }]]) casos.push(['lixo-' + nome, JSON.stringify(lixo)])
  return casos
}

const MODOS = { normal: { query: '', chave: 'galope-elemental:v1' }, dev: { query: '?dev=1', chave: 'galope-elemental:dev' } }

async function abrir(browser, base, modo, save) {
  const ctx = await browser.newContext()
  const pg = await ctx.newPage()
  await pg.clock.setFixedTime(INSTANTE)
  await pg.addInitScript(({ chave, save, seed }) => {
    window.__GALOPE_SEM_RELOGIO = true
    window.crypto.getRandomValues = (a) => { for (let i = 0; i < a.length; i++) a[i] = seed; return a }
    if (save) localStorage.setItem(chave, save)
  }, { chave: MODOS[modo].chave, save, seed: SEED_NOVA })
  await pg.goto(base + 'preview.html' + MODOS[modo].query, { waitUntil: 'domcontentloaded' })
  await pg.waitForFunction(() => window.__galope)
  return { ctx, pg }
}

export async function sanearNoJogo(browser, base) {
  // o save de agora: o do jogo depois de abrir com um save v2 mínimo (migrado na carga), lido do navegador
  const G = require(join(SRC, 'data.js'))
  const semente = JSON.stringify({ v: 2, starterId: 'brasa', level: 4, xp: 0, skills: [], gold: 555, seedBase: 777, raceCounter: 1 })
  const a = await abrir(browser, base, 'normal', semente)
  await a.pg.waitForFunction(() => window.__galope.state)
  const s0 = await a.pg.evaluate(() => JSON.parse(JSON.stringify(window.__galope.state)))
  await a.ctx.close()
  const casos = casosDe(G, s0)
  const out = {}
  for (const modo of Object.keys(MODOS)) {
    const { ctx, pg } = await abrir(browser, base, modo, null)
    const r = await pg.evaluate((casos) => {
      const g = window.__galope, r = {}
      for (const [id, txt] of casos) r[id] = g.saneiaTeste(txt)
      return r
    }, casos)
    for (const [id] of casos) out[modo + ':' + id] = r[id]
    await ctx.close()
  }
  return { out, casos }
}

// o save.js no Node com a mesma entrada (só depois do T16: antes o módulo não existe), com o relógio parado e a seed
// nova fixa, como no navegador (faz o mesmo que o sanitize do game.js: o dia e o agora com o deslocamento da gaveta DEV)
function noNode(casos) {
  if (!existsSync(join(SRC, 'save.js'))) return null
  const SV = require(join(SRC, 'save.js')), IT = require(join(SRC, 'itens.js'))
  const out = {}
  for (const modo of Object.keys(MODOS)) {
    const dev = modo === 'dev'
    const desloc = (st) => dev && st && typeof st.devDias === 'number' && st.devDias === Math.floor(st.devDias) && Math.abs(st.devDias) <= SV.DEV_DIAS_MAX ? st.devDias : 0
    const deslocMin = (st) => dev && st && typeof st.devMin === 'number' && st.devMin === Math.floor(st.devMin) && st.devMin >= 0 && st.devMin <= SV.DEV_MIN_MAX ? st.devMin : 0
    const ctx = {
      dev,
      seedNova: () => SEED_NOVA,
      hojeDia: (st) => IT.diaLocal(INSTANTE.getFullYear(), INSTANTE.getMonth(), INSTANTE.getDate()) + desloc(st),
      agoraMin: (st) => INSTANTE.getTime() / 60000 + desloc(st) * 1440 + deslocMin(st)
    }
    for (const [id, txt] of casos) {
      const r = SV.sanear(JSON.parse(txt), ctx)
      out[modo + ':' + id] = JSON.stringify({ state: r.state, descarte: r.descarte })
    }
  }
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check')
  const srv = await servirDist()
  const browser = await chromium.launch()
  try {
    const { out, casos } = await sanearNoJogo(browser, `http://127.0.0.1:${srv.address().port}/`)
    const ids = Object.keys(out)
    const h = Object.fromEntries(ids.map((id) => [id, hash(out[id])]))
    const nulos = ids.filter((id) => JSON.parse(out[id]).state === null).length
    if (check) {
      const ref = JSON.parse(await readFile(ARQ, 'utf8')).casos
      const faltam = Object.keys(ref).filter((id) => !(id in h))
      const dif = ids.filter((id) => ref[id] !== h[id])
      const node = noNode(casos)
      const difNode = node ? ids.filter((id) => hash(node[id]) !== h[id]) : []
      if (faltam.length) console.log(`DIFERENTE: ${faltam.length} casos da referência não rodaram (${faltam.slice(0, 6).join(', ')})`)
      if (dif.length) console.log(`DIFERENTE: ${dif.length} de ${ids.length} saves saneados mudaram em relação à referência (${dif.slice(0, 6).join(', ')})`)
      if (difNode.length) console.log(`DIFERENTE: o save.js no Node diverge do jogo em ${difNode.length} de ${ids.length} saves (${difNode.slice(0, 6).join(', ')})`)
      if (!faltam.length && !dif.length && !difNode.length) console.log(`OK: ${ids.length} saves saneados iguais à referência (${nulos} recusados)` + (node ? ', no jogo e no save.js em Node' : ' (sem save.js no Node)'))
      process.exitCode = faltam.length || dif.length || difNode.length ? 1 : 0
    } else {
      await writeFile(ARQ, JSON.stringify({
        sobre: 'hash do save saneado e do descarte de cada caso de save-referencia.mjs, gravado com o jogo de antes do T16 (2026-11-27); regravar só de propósito, quando uma regra do saneamento muda',
        casos: h
      }, null, 1) + '\n')
      const distintos = new Set(Object.values(h)).size
      console.log(`gravada: ${ids.length} saves (${distintos} resultados distintos, ${nulos} recusados) em ${ARQ}`)
    }
  } finally { await browser.close(); srv.close() }
}
