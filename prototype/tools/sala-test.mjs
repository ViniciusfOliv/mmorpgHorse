// Testes da montagem da sala (prototype/src/sala.js, T15). Sem navegador.
//   node prototype/tools/sala-test.mjs
// 1. Equivalência: as 200 salas de sala-casos.mjs montadas pelo módulo batem com a referência gravada com o jogo de
//    antes do T15 (sala-referencia.json, hash "recorte"). O bloco "sala-equivalencia" do ui-test confere o jogo inteiro.
// 2. Regras: determinismo, nº de corredores, rival nunca com o modelo do jogador, sem repetir modelo quando dá, raias.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { casos, cavaloDoCaso, recorteDaSala } from './sala-casos.mjs'

const require = createRequire(import.meta.url)
const G = require('../src/data.js')
const S = require('../src/sim.js')
const DV = require('../src/dev.js')
const SL = require('../src/sala.js')
const AQUI = dirname(fileURLToPath(import.meta.url))
const REF = JSON.parse(readFileSync(join(AQUI, 'sala-referencia.json'), 'utf8')).salas
const JOGO = readFileSync(join(AQUI, '../src/game.js'), 'utf8')
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)

// as mesmas opções que o game.js passa: o alvo dos testadores (lido do game.js, para não divergir) e o DEV
const alvoRapido = JOGO.match(/RAPIDO = \{ xp: \d+, genetica: (\d+), alvo: \[([\d.]+), ([\d.]+)\] \}/)
if (!alvoRapido) throw new Error('sala-test: não achei o RAPIDO no game.js')
const RAPIDO = { alvo: [Number(alvoRapido[2]), Number(alvoRapido[3])] }
// No build dos testadores o game.js muda o catálogo ao carregar: os iniciais viram Raros com genética RAPIDO.genetica.
// Aqui, numa cópia nova dos módulos (a memória de Poder do sala.js não pode ver o catálogo de antes).
function modulosDosTestadores() {
  for (const k of Object.keys(require.cache)) if (/[\\/]src[\\/][a-z]+\.js$/.test(k)) delete require.cache[k]
  const G2 = require('../src/data.js')
  G2.STARTERS.forEach((h) => { h.rarity = 'raro'; Object.keys(h.potential).forEach((k) => { h.potential[k] = Number(alvoRapido[1]) }) })
  const mods = { S: require('../src/sim.js'), SL: require('../src/sala.js') }
  for (const k of Object.keys(require.cache)) if (/[\\/]src[\\/][a-z]+\.js$/.test(k)) delete require.cache[k]
  return mods
}
const TESTADORES = modulosDosTestadores()
const NSEDAS = 7   // as 8 sedas do Sprites menos a do jogador
const devCondicoes = (f) => (base, seed) => {
  const forced = DV.conditions(f, base), c = {}
  for (const k of Object.keys(base)) c[k] = base[k]
  for (const k of Object.keys(forced)) c[k] = forced[k]
  return S.normalizeConditions(c, seed)
}

function montarCaso(c) {
  const cavalo = cavaloDoCaso(c)
  const seed = c.devSeed != null ? c.devSeed >>> 0 : S.hash2(c.seedBase, c.counter)
  const sala = c.modo === 'rapido' ? TESTADORES.SL : SL
  return sala.montar({
    seed, pr: c.pr, cavalo, nSedas: NSEDAS, rapido: c.modo === 'rapido' ? RAPIDO : null,
    donos: [c.modelo].concat(c.donos), ajustaCond: c.devCond ? devCondicoes(c.devCond) : null
  })
}
// o recorte que o jogo grava, a partir da saída do módulo
function recorte(M) {
  const L = {
    seed: M.seed, cond: M.cond, trackName: M.trackName, n: M.n,
    racers: M.ordem.map((i) => i === 0 ? { isPlayer: true } : { name: M.rivais[i - 1].nome, horse: M.rivais[i - 1].horse, rating: M.rivais[i - 1].rating, silks: i - 1 })
  }
  // seda: o índice já é o da lista dos bots; recorteDaSala acha pelo indexOf, então a "lista" é a identidade
  return JSON.stringify(recorteDaSala(L, { indexOf: (x) => M.rivais[x].seda }))
}

let falhas = 0, n = 0
const test = (nome, f) => {
  n++
  try { f(); console.log('  ok  ' + nome) } catch (e) { falhas++; console.log('  FALHA ' + nome + '\n       ' + e.message) }
}
const igual = (a, b, msg) => { if (a !== b) throw new Error(msg + ': ' + a + ' ≠ ' + b) }

const lista = casos()
test('as ' + lista.length + ' salas do módulo batem com a referência gravada com o jogo de antes do T15', () => {
  const dif = lista.filter((c) => !REF[c.id] || hash(recorte(montarCaso(c))) !== REF[c.id].recorte).map((c) => c.id)
  igual(dif.length, 0, 'salas diferentes (' + dif.slice(0, 6).join(', ') + ')')
})
test('determinística: montar duas vezes dá a mesma sala', () => {
  for (const c of lista.slice(0, 40)) igual(JSON.stringify(montarCaso(c)), JSON.stringify(montarCaso(c)), c.id)
})
test('de 4 a 8 corredores, raias = uma permutação de jogador + rivais', () => {
  for (const c of lista) {
    const M = montarCaso(c)
    if (M.n < G.ECONOMY.minRacers || M.n > G.ECONOMY.maxRacers) throw new Error(c.id + ': n = ' + M.n)
    igual(M.rivais.length, M.n - 1, c.id + ' rivais')
    igual(M.ordem.slice().sort((a, b) => a - b).join(), [...Array(M.n).keys()].join(), c.id + ' raias')
  }
})
test('nenhum rival corre com um modelo que o jogador tem', () => {
  for (const c of lista) {
    const donos = new Set([c.modelo, ...c.donos])
    for (const r of montarCaso(c).rivais) if (donos.has(r.horse.id.replace(/-b\d+$/, ''))) throw new Error(c.id + ': ' + r.horse.id)
  }
})
test('fora do build dos testadores, o Poder de cada rival fica perto da faixa 91,5–111,5% (folga de 6% e do nível inteiro)', () => {
  let fora = 0, total = 0
  for (const c of lista.filter((x) => x.modo !== 'rapido')) {
    for (const r of montarCaso(c).rivais) { total++; if (r.rating < c.pr * 0.915 * 0.9 || r.rating > c.pr * 1.115 * 1.1) fora++ }
  }
  // sem modelo na faixa o rival é o mais perto em qualquer nível (o Mítico nv 50 não acha par): tolera poucos
  if (fora > total * 0.1) throw new Error(fora + ' de ' + total + ' rivais longe da faixa')
})
test('o sorteio da sala não usa Math.random nem Date', () => {
  const fonte = readFileSync(join(AQUI, '../src/sala.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  if (/Math\.random|Date\b|performance\./.test(fonte)) throw new Error('sala.js usa relógio ou Math.random')
})

console.log('\n' + n + ' testes, ' + falhas + ' falhas')
process.exitCode = falhas ? 1 : 0
