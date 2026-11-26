// Casos da equivalência da sala (T15): as mesmas ~200 salas montadas pelo jogo no navegador (sala-referencia.mjs e o
// bloco "sala-equivalencia" do ui-test) e pelo módulo em Node (sala-test.js). Tudo sai de uma RNG fixa: mudar este
// arquivo muda os casos, e a referência tem de ser regravada com o jogo de ANTES da mudança que se quer provar.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const G = require('../src/data.js')
const S = require('../src/sim.js')

const MODOS = [['normal', 140], ['rapido', 30], ['dev-seed', 15], ['dev-cond', 15]]
const TRACADOS = [null, 'curvas', 'subidas']

// o cavalo do jogador no caso: o modelo do catálogo no nível e rank pedidos, com os pontos pela build dos bots
export function cavaloDoCaso(c) {
  const tpl = G.STARTERS.concat(G.WILD_HORSES).find((t) => t.id === c.modelo)
  const h = S.withRanks(tpl, c.rank)
  h.level = c.nivel
  h.alloc = S.botAlloc(h)
  return h
}

export function casos() {
  const rng = S.mulberry32(0x5A1A0001)
  const modelos = G.STARTERS.concat(G.WILD_HORSES).filter((t) => t.rarity !== 'mitico').map((t) => t.id)
  const climas = Object.keys(G.WEATHERS), pisos = Object.keys(G.SURFACES)
  const de = (arr) => arr[Math.floor(rng() * arr.length)]
  const out = []
  for (const [modo, qtd] of MODOS) {
    for (let i = 0; i < qtd; i++) {
      const c = {
        id: modo + '-' + i, modo,
        seedBase: Math.floor(rng() * 0xFFFFFFFF) >>> 0,
        // um terço nas 25 primeiras salas: a estreia e a rampa da D9
        counter: rng() < 1 / 3 ? 1 + Math.floor(rng() * 25) : 1 + Math.floor(rng() * 400),
        modelo: de(modelos), nivel: 1 + Math.floor(rng() * 50), rank: 1 + Math.floor(rng() * 5),
        training: rng() < 0.2,
        donos: []
      }
      const nDonos = Math.floor(rng() * 4)
      for (let k = 0; k < nDonos; k++) c.donos.push(de(modelos))
      // Poder da sala: o do cavalo, às vezes deslocado (o páreo guarda o Poder visto quando abriu)
      c.pr = Math.round(S.powerRating(cavaloDoCaso(c)) * (0.9 + 0.2 * rng()))
      if (modo === 'dev-seed' || modo === 'dev-cond') c.devSeed = Math.floor(rng() * 0xFFFFFFFF) >>> 0
      if (modo === 'dev-cond') {
        c.devCond = { weather: de(climas), surface: de(pisos), distance: 1000 + 100 * Math.floor(rng() * 15), tracado: de(TRACADOS) }
      }
      out.push(c)
    }
  }
  return out
}

// Recorte comparável entre o jogo e o módulo: o que a sala sorteia (seed, pista, nome, nº de corredores, rivais e
// raias). 'J' marca a raia do jogador; seda = índice na lista de sedas dos bots (as do Sprites sem a do jogador).
export function recorteDaSala(L, sedasBots) {
  return {
    seed: L.seed, cond: L.cond, trackName: L.trackName, n: L.n,
    raias: L.racers.map((r) => r.isPlayer ? 'J' : { nome: r.name, horse: r.horse, rating: r.rating, seda: sedasBots.indexOf(r.silks) })
  }
}
