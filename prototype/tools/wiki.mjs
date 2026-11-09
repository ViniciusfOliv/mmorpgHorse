// Wiki do Galope Elemental, gerado do código do protótipo (sem dependências).
//   node prototype/tools/wiki.mjs           grava docs/wiki.md e prototype/dist/wiki.html
//   node prototype/tools/wiki.mjs --check   não grava; sai com código 1 se algum arquivo estiver desatualizado
// Também exporta gerarWiki() -> Promise<{ md, html }> (o build.mjs chama no fim) e as funções que traduzem
// chaves do código para português (descreverGatilho, descreverEfeito, ...), usadas pelo wiki-test.mjs.
//
// Regras:
//   - Todo número vem do código em tempo de geração (GameData, RaceSim.TUNING, Gear, Breed, RaceFx, Dev e, para
//     o que só existe dentro do game.js/sim.js/breed.js/fx.js, uma leitura do fonte com regex que FALHA se o
//     trecho mudar). Texto explicativo é escrito aqui; os números dentro dele são interpolados.
//   - Nada some em silêncio: chave desconhecida (gatilho, efeito, clima, bloco, status, aba, bônus de conjunto)
//     lança erro com o nome da chave — conteúdo novo quebra o build em vez de ficar fora do wiki.
//   - Saída determinística: sem data/hora, sem Math.random, ordem dos objetos do código.
//   - Só lê prototype/src/ (nunca altera).
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { lerMoldes, lerIcones, lerMarca, jsonJs } from './arte-embutida.mjs'

const require = createRequire(import.meta.url)
const PROTO = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = join(PROTO, '..')
export const SAIDA_MD = join(REPO, 'docs', 'wiki.md')
export const SAIDA_HTML = join(PROTO, 'dist', 'wiki.html')

const G = require('../src/data.js')
const S = require('../src/sim.js')
const GR = require('../src/gear.js')
const B = require('../src/breed.js')
const FX = require('../src/fx.js')
const DV = require('../src/dev.js')
const T = S.TUNING
const E = G.ECONOMY
const EG = E.gear
const BR = E.breeding

// ---------------------------------------------------------------------------------------------------------
// Leitura do fonte (só para o que não é exportado). Falha alto se o trecho não existir mais.
// ---------------------------------------------------------------------------------------------------------
const fontes = {}
function fonte(rel) { return fontes[rel] || (fontes[rel] = readFileSync(join(PROTO, rel), 'utf8')) }
function extrair(rel, re, oQue) {
  const m = fonte(rel).match(re)
  if (!m) throw new Error(`wiki: não achei ${oQue} em prototype/${rel} (o código mudou? atualize prototype/tools/wiki.mjs)`)
  return m
}
const numDe = (rel, re, oQue) => Number(extrair(rel, re, oQue)[1])
const listaJs = (txt) => JSON.parse(txt.replace(/'/g, '"'))

function lerFonte() {
  const game = 'src/game.js', sim = 'src/sim.js', breed = 'src/breed.js', fx = 'src/fx.js'
  const abas = extrair(game, /var ABAS = \[(.*)\];/, 'a lista ABAS')[1]
  const ventos = extrair(fx, /a < ([\d.]+) \? 'calmo' : a < ([\d.]+) \? 'brisa' : 'ventania'/, 'a distribuição do vento (RaceFx.wind)')
  const alvo = extrair(game, /var target = pr \* \(([\d.]+) \+ ([\d.]+) \* rng\(\)\)/, 'a faixa de Poder dos bots')
  return {
    treinoOuro: listaJs(extrair(game, /var TRAINING_GOLD = (\[[^\]]*\]);/, 'TRAINING_GOLD')[1]),
    treinoXpDiv: numDe(game, /xpGain = L\.training \? Math\.round\(xpBase \/ (\d+)\)/, 'a divisão do XP do treino'),
    vitrine: listaJs(extrair(game, /var WILD_SHOWCASE = (\[[^\]]*\]);/, 'WILD_SHOWCASE')[1]),
    abas: [...abas.matchAll(/rotulo: '([^']+)'/g)].map((m) => m[1]),
    pistas: listaJs('[' + extrair(game, /var TRACK_NAMES = \[([\s\S]*?)\];/, 'TRACK_NAMES')[1] + ']'),
    retrato: extrair(game, /var PORTRAIT_W = (\d+), PORTRAIT_H = (\d+);/, 'o tamanho do retrato').slice(1, 3).map(Number),
    retratoEscala: numDe(game, /var PORTRAIT_SCALE = (\d+);/, 'PORTRAIT_SCALE'),
    botAlvo: [Number(alvo[1]), Number(alvo[2])],
    botFaixa: numDe(game, /c\.fit\.diff <= target \* ([\d.]+)/, 'a tolerância de Poder dos bots'),
    devVagas: numDe(game, /var DEV_SKILL_VAGAS = (\d+);/, 'DEV_SKILL_VAGAS'),
    vento: { calmo: Number(ventos[1]), brisa: Number(ventos[2]) - Number(ventos[1]), ventania: 1 - Number(ventos[2]) },
    subidaForca: numDe(sim, /T\.hillDrain \* \(1 - ([\d.]+) \* nf\) \* hillDrainMult/, 'o alívio de Força no gasto da subida'),
    largadaAcel: numDe(sim, /T\.startDelayMax \* \(1 - ([\d.]+) \* clamp\(statsN\.acel/, 'o alívio de Aceleração na largada'),
    pelotaoMax: numDe(sim, /Math\.min\(neighbors, (\d+)\)/, 'o teto de vizinhos do pelotão'),
    cansouFalta: numDe(sim, /if \(rem > D \* ([\d.]+)\) ev\(t, i, 'cansou'/, 'a folga do evento "cansou"'),
    chegadaFreio: numDe(sim, /r\.v = Math\.max\(0, r\.v - (\d+) \* dt\)/, 'a frenagem depois da chegada'),
    elementoPotro: numDe(breed, /rng\(\) < ([\d.]+) \? f\.element : m\.element/, 'o sorteio do elemento do potro'),
    sexoPotro: numDe(breed, /var sex = rng\(\) < ([\d.]+) \? 'f' : 'm'/, 'o sorteio do sexo do potro'),
    corcelDois: numDe(breed, /if \(g === 1 && rng\(\) < ([\d.]+)\) g = 2/, 'a chance de 2 skills garantidas do Corcel'),
    potValores: numDe(breed, /v = Math\.floor\(rng\(\) \* (\d+)\);/, 'a faixa do potencial sorteado'),
    potroPai: numDe(breed, /v = potOf\(rng\(\) < ([\d.]+) \? f : m, k\)/, 'a escolha do pai no potencial herdado')
  }
}

// ---------------------------------------------------------------------------------------------------------
// Formatação (pt-BR, determinística: sem toLocaleString)
// ---------------------------------------------------------------------------------------------------------
function num(x, casas = 2) {
  if (typeof x !== 'number' || !isFinite(x)) throw new Error('wiki: número inválido: ' + x)
  const f = 10 ** casas
  let r = Math.round(x * f) / f
  if (Object.is(r, -0)) r = 0
  const neg = r < 0
  let [int, dec] = Math.abs(r).toFixed(casas).split('.')
  if (dec) dec = dec.replace(/0+$/, '')
  if (int.length > 3) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (neg ? '−' : '') + int + (dec ? ',' + dec : '')
}
const pct = (x, casas = 1) => num(x * 100, casas) + '%'
const pp = (x, casas = 1) => num(x * 100, casas) + ' p.p.'
const mult = (x, casas = 3) => '×' + num(x, casas)
// multiplicador com casas fixas (×1,10), para os do clima
const multF = (x, casas = 2) => '×' + num(x, casas).replace(/^(\d+)$/, '$1,' + '0'.repeat(casas)).replace(/,(\d)$/, ',$10')
const sinalPct = (x, casas = 1) => (x >= 0 ? '+' : '−') + num(Math.abs(x) * 100, casas) + '%'
const ordinal = (i) => i + 'º'
const estrelas = (g) => '★'.repeat(g)
// fração simples (1/3, 2/3) quando houver denominador pequeno; senão porcentagem
function fracao(x) {
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(x * d)
    if (Math.abs(x * d - n) < 1e-9) return d === 1 ? String(n) : `${n}/${d}`
  }
  return pct(x)
}
function lista(itens, e = 'e') {
  if (itens.length <= 1) return itens.join('')
  return itens.slice(0, -1).join(', ') + ' ' + e + ' ' + itens[itens.length - 1]
}
function semAcento(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// ---------------------------------------------------------------------------------------------------------
// Tradutores (lançam erro em chave desconhecida)
// ---------------------------------------------------------------------------------------------------------
const nomeStat = (k) => { if (!G.STATS[k]) throw new Error(`wiki: status desconhecido "${k}"`); return G.STATS[k].name }
const siglaStat = (k) => { if (!G.STATS[k]) throw new Error(`wiki: status desconhecido "${k}"`); return G.STATS[k].short }
const nomeEl = (id) => { if (!G.ELEMENTS[id]) throw new Error(`wiki: elemento desconhecido "${id}"`); return G.ELEMENTS[id].name }
const nomeRar = (id) => { if (!G.RARITIES[id]) throw new Error(`wiki: raridade desconhecida "${id}"`); return G.RARITIES[id].name }
const nomeClima = (id) => { if (!G.WEATHERS[id]) throw new Error(`wiki: clima desconhecido "${id}"`); return G.WEATHERS[id].name }
const nomeSlot = (id) => { if (!G.GEAR_SLOT_INFO[id]) throw new Error(`wiki: slot desconhecido "${id}"`); return G.GEAR_SLOT_INFO[id].name }
const nomeSkill = (id) => { if (!G.SKILLS[id]) throw new Error(`wiki: skill desconhecida "${id}"`); return G.SKILLS[id].name }
const nomeConjunto = (id) => { if (!G.GEAR_SETS[id]) throw new Error(`wiki: conjunto desconhecido "${id}"`); return G.GEAR_SETS[id].name }
const todasMontarias = () => G.STARTERS.concat(G.WILD_HORSES)
const nomeMontaria = (id) => {
  const h = todasMontarias().find((x) => x.id === id)
  if (!h) throw new Error(`wiki: montaria desconhecida "${id}"`)
  return h.name
}

/** Gatilho de skill em português. Lança erro em gatilho desconhecido. */
export function descreverGatilho(trigger) {
  if (typeof trigger === 'string' && trigger.indexOf('weather:') === 0) {
    const w = trigger.slice('weather:'.length)
    if (!G.WEATHERS[w]) throw new Error(`wiki: gatilho de skill com clima desconhecido "${trigger}"`)
    return `Clima ${nomeClima(w)} valendo (checado a cada instante; vale também se o Dado virar o clima)`
  }
  switch (trigger) {
    case 'start': return 'Largada'
    case 'straight': return `Entra numa reta de ${num(T.straightMinM)} m ou mais (a reta da largada não conta)`
    case 'curve': return 'Entra numa curva'
    case 'curveExit': return 'Sai de uma curva'
    case 'hill': return 'Entra numa subida'
    case 'lowStamina': return `Estamina cai a ${pct(T.lowStaminaAt, 0)} ou menos`
    case 'final': return `Cruza ${pct(T.garraZone, 0)} da pista (reta final)`
    case 'dice': return 'Antes de cada Dado da Sorte'
    default: throw new Error(`wiki: gatilho de skill desconhecido "${trigger}" — descreva-o em descreverGatilho (prototype/tools/wiki.mjs)`)
  }
}

/** Efeito de skill (objeto effect) em português, com os números. Lança erro em chave desconhecida. */
export function descreverEfeito(effect) {
  const partes = [], fim = []
  for (const k of Object.keys(effect || {})) {
    const v = effect[k]
    switch (k) {
      case 'accelMult': partes.push(`aceleração ${mult(v)} (${sinalPct(v - 1, 0)})`); break
      case 'speedMult': partes.push(`velocidade ${mult(v)} (${sinalPct(v - 1, 0)})`); break
      case 'drainMult': partes.push(`gasto de estamina ${mult(v)} (${sinalPct(v - 1, 0)})`); break
      case 'curveBonus': partes.push(`fator da curva ${sinalPct(v, 0)} (somado, teto 1)`); break
      case 'hillBonus': partes.push(`fator da subida ${sinalPct(v, 0)} (somado, teto 1)`); break
      case 'hillDrainMult': partes.push(`gasto extra da subida ${mult(v)} (${sinalPct(v - 1, 0)})`); break
      case 'staminaRestore': partes.push(`recupera ${pct(v, 0)} do tanque na hora`); break
      case 'garraChanceBonus': partes.push(`chance de Garra ${'+' + pp(v, 0)}`); break
      case 'garraBoostBonus': partes.push(`impulso da Garra ${'+' + pp(v, 0)}`); break
      case 'extraDice': partes.push(`${'+' + num(v)} dado no Dado da Sorte (até o fim da corrida)`); break
      case 'weatherDouble': partes.push(`bônus do clima do próprio elemento ${multF(T.weatherMult)} → ${multF(T.weatherMultDouble)} (até o fim da corrida)`); break
      case 'distanceM': fim.push(`por ${num(v)} m`); break
      case 'durationS': fim.push(`por ${num(v)} s`); break
      case 'blockScoped': if (v) fim.push('em cada bloco, até o fim dele'); break
      default: throw new Error(`wiki: chave de effect desconhecida "${k}" — descreva-a em descreverEfeito (prototype/tools/wiki.mjs)`)
    }
  }
  const temDuracao = effect && (effect.distanceM || effect.durationS || effect.blockScoped)
  const temContinuo = effect && (effect.speedMult || effect.accelMult || effect.drainMult || effect.curveBonus || effect.hillBonus || effect.hillDrainMult)
  if (temContinuo && !temDuracao) fim.push('até a chegada')
  if (!partes.length) throw new Error('wiki: effect sem efeito conhecido: ' + JSON.stringify(effect))
  return partes.join('; ') + (fim.length ? ', ' + fim.join(', ') : '')
}

/** Bônus especial de equipamento (Gear.resolve().special) em português. Lança erro em chave desconhecida. */
export function descreverEspecial(chave, valor) {
  switch (chave) {
    case 'skillChanceBonus': return valor ? `chance de ativar skills ${'+' + pp(valor, 0)}` : ''
    case 'weatherDoubleClimate': return valor ? `no clima ${nomeClima(valor)}, o bônus do elemento dono sobe de ${multF(T.weatherMult)} para ${multF(T.weatherMultSet)} (não soma com a skill de clima, que dá ${multF(T.weatherMultDouble)})` : ''
    case 'ignoreWeatherPenalty': return valor ? `anula a penalidade de clima (${multF(2 - T.weatherMult)} vira ×1)` : ''
    default: throw new Error(`wiki: bônus especial de equipamento desconhecido "${chave}" — descreva-o em descreverEspecial (prototype/tools/wiki.mjs)`)
  }
}

/** Papel de cada status na corrida (fórmula resumida do sim.js). Lança erro em status desconhecido. */
export function papelDoStatus(k, F) {
  const n = (x) => num(x, 3)
  switch (k) {
    case 'vel': return `Velocidade máxima: vMax = ${n(T.vBase)} + ${n(T.vRange)} × n(VEL) m/s (VEL 50 → ${num(T.vBase + T.vRange * 0.5)} m/s; VEL 100 → ${num(T.vBase + T.vRange)} m/s). Ritmo, piso, bloco e boosts multiplicam esse teto.`
    case 'acel': return `Aceleração = ${n(T.aBase)} + ${n(T.aRange)} × n(ACE) m/s², na largada e nas retomadas (saída de curva e de subida). Também encurta a reação à largada: atraso sorteado de até ${num(T.startDelayMax)} s × (1 − ${num(F.largadaAcel)} × n(ACE)).`
    case 'man': return `Fator da curva = min(1, ${n(T.curveBase)} + ${n(T.curveRange)} × n(MAN)): de ${pct(T.curveBase, 0)} a ${pct(T.curveBase + T.curveRange, 0)} da velocidade dentro da curva.`
    case 'forca': return `Fator da subida = min(1, ${n(T.hillBase)} + ${n(T.hillRange)} × n(FOR)). Alivia o piso pesado (${pct(T.forcaSurfRelief, 0)} × n(FOR) da perda), o aperto do pelotão (${pct(T.forcaCrowdRelief, 0)} × n(FOR)) e o gasto extra da subida (+${pct(T.hillDrain, 0)} × (1 − ${num(F.subidaForca)} × n(FOR))).`
    case 'est': return `Tanque = ${n(T.poolBase)} + ${n(T.poolEst)} × n(EST) (EST 50 → ${num(T.poolBase + T.poolEst * 0.5)}). O clima não mexe no tanque.`
    case 'garra': return `Ao cruzar ${pct(T.garraZone, 0)} da pista: chance = min(${pct(T.garraChanceMax, 0)}, ${pct(T.garraChanceBase, 0)} + ${pct(T.garraChanceRange, 0)} × n(GAR)). Se sair, o teto de velocidade vai a ${mult(1 + T.garraBoostBase, 2)} + ${num(T.garraBoostRange, 3)} × n(GAR) até a chegada.`
    case 'sorte': return `No Dado da Sorte, SOR% é a chance de rolar um 2º dado e ficar com o melhor. Na chance de skill soma ${pp(T.skillPerSorte)} por ponto (SOR 50 → ${'+' + pp(T.skillPerSorte * 50, 0)}).`
    default: throw new Error(`wiki: status desconhecido "${k}" — descreva-o em papelDoStatus (prototype/tools/wiki.mjs)`)
  }
}

/** Fator de velocidade de cada tipo de bloco da pista. Lança erro em tipo desconhecido. */
export function descreverBloco(tipo, F) {
  switch (tipo) {
    case 'reta': return { fator: '1 (sem perda)', gasto: 'normal', mais: `Reta de ${num(T.straightMinM)} m ou mais (fora a da largada) dispara skills de reta.` }
    case 'curva': return { fator: `min(1, ${num(T.curveBase)} + ${num(T.curveRange)} × n(MAN) + bônus de skill) — ${pct(T.curveBase, 0)} a ${pct(T.curveBase + T.curveRange, 0)}`, gasto: 'normal', mais: 'Ao sair, a velocidade volta pela Aceleração.' }
    case 'subida': return { fator: `min(1, ${num(T.hillBase)} + ${num(T.hillRange)} × n(FOR) + bônus de skill) — ${pct(T.hillBase, 0)} a ${pct(T.hillBase + T.hillRange, 0)}`, gasto: `×(1 + ${num(T.hillDrain)} × (1 − ${num(F.subidaForca)} × n(FOR))), e o esforço não cai com a velocidade menor`, mais: 'Ao sair, a velocidade volta pela Aceleração.' }
    default: throw new Error(`wiki: tipo de bloco desconhecido "${tipo}" — descreva-o em descreverBloco (prototype/tools/wiki.mjs)`)
  }
}

/** Efeito geral de cada clima (vale para todos os corredores). Lança erro em clima desconhecido. */
export function efeitoGeralClima(id) {
  switch (id) {
    case 'sol': return `gasto de estamina ${mult(T.sunDrain)} para todos`
    case 'chuva': return `velocidade ${sinalPct(-T.rainSlow)} para todos`
    case 'nevoa': return 'nenhum efeito geral'
    case 'nublado': return 'nenhum efeito geral'
    default: throw new Error(`wiki: clima desconhecido "${id}" — descreva-o em efeitoGeralClima (prototype/tools/wiki.mjs)`)
  }
}

/** O que cada aba do jogo faz hoje. Lança erro em aba desconhecida. */
export function descreverAba(rotulo, F) {
  switch (rotulo) {
    case 'Estábulo': return `suas montarias (${BR.stableSlotsStart} vagas no começo, até ${BR.stableSlotsMax}), status, skills e equipamento; escolher a ativa.`
    case 'Correr': return `escolher a entrada (${lista(E.entryTiers.map((t) => num(t)), 'ou')} de Ouro) e procurar corrida; sem Ouro para a menor entrada, treino gratuito.`
    case 'Expedição': return `vitrine de ${F.vitrine.length} cavalos selvagens. Expedições e captura ainda não existem no protótipo.`
    case 'Haras': return 'cruzar com um reprodutor de aluguel ou com outra montaria sua, ou fazer a Troca.'
    case 'Loja': return `comprar peças de equipamento (menos as de raridade ${lista([...new Set(Object.keys(G.GEAR).filter((id) => !G.GEAR[id].shop).map((id) => nomeRar(G.GEAR[id].rarity)))])}) e Pedras Negras.`
    default: throw new Error(`wiki: aba desconhecida "${rotulo}" — descreva-a em descreverAba (prototype/tools/wiki.mjs)`)
  }
}

// ---------------------------------------------------------------------------------------------------------
// Cálculos derivados
// ---------------------------------------------------------------------------------------------------------
const STAT10 = () => Object.fromEntries(G.STAT_KEYS.map((k) => [k, 10]))
// Peso de cada skill no Poder (o sim.js não exporta SKILL_TRIGGER_WEIGHT): diferença de powerRating num cavalo
// cuja soma ponderada é inteira (todos os status 10, Comum, Neutro, Nv 1, sem potencial).
function pesoSkill(id) {
  const h = (sk) => ({ rarity: 'comum', element: 'neutro', level: 1, base: STAT10(), potential: {}, skills: sk })
  return (S.powerRating(h([id])) - S.powerRating(h([]))) / 20
}
// teto e piso de cada status depois de tudo (computeStats prende o resultado)
function limitesStatus() {
  const k = G.STAT_KEYS[0]
  const alto = S.computeStats({ rarity: 'mitico', element: 'neutro', level: 1, base: { [k]: 1e6 } }, { mods: { [k]: 1e6 } })[k]
  const baixo = S.computeStats({ rarity: 'comum', element: 'neutro', level: 1, base: { [k]: 1 } }, { mods: { [k]: -1e6 } })[k]
  return { alto, baixo }
}
// faixa do dado e nº máximo de dados (rollDice com rng nas pontas)
function limitesDado() {
  const min = S.rollDice(() => 0, 0, 0).best
  const max = S.rollDice(() => 0.9999999999, 0, 0).best
  const maxDados = S.rollDice(() => 0, 100, 99).dice.length
  return { min, max, maxDados }
}
// Amostra de pistas: frequências das condições sorteadas pela seed
const AMOSTRA = 20000
function amostraPistas() {
  const dist = new Map(), nb = new Map(), tipos = {}, pisos = {}, climas = {}
  let meio = 0
  for (const k of Object.keys(G.BLOCK_TYPES)) tipos[k] = 0
  for (const k of Object.keys(G.SURFACES)) pisos[k] = 0
  for (const k of Object.keys(G.WEATHERS)) climas[k] = 0
  for (let s = 0; s < AMOSTRA; s++) {
    const c = S.randomConditions(s)
    dist.set(c.distance, (dist.get(c.distance) || 0) + 1)
    nb.set(c.blocks.length, (nb.get(c.blocks.length) || 0) + 1)
    c.blocks.forEach((b, i) => {
      if (!(b.type in tipos)) throw new Error(`wiki: tipo de bloco desconhecido "${b.type}"`)
      if (i > 0 && i < c.blocks.length - 1) { tipos[b.type]++; meio++ }
    })
    pisos[c.surface]++
    climas[c.weather]++
  }
  const ds = [...dist.keys()].sort((a, b) => a - b)
  const passo = ds.slice(1).reduce((g, d, i) => { const x = d - ds[i]; return g ? Math.min(g, x) : x }, 0)
  const bs = [...nb.keys()].sort((a, b) => a - b)
  const primeiraUltima = (() => {
    const c = S.randomConditions(1)
    return [c.blocks[0].type, c.blocks[c.blocks.length - 1].type]
  })()
  return { dMin: ds[0], dMax: ds[ds.length - 1], passo, bMin: bs[0], bMax: bs[bs.length - 1], tipos, meio, pisos, climas, primeiraUltima }
}
// Pedras esperadas para cada passo da melhoria (falha pode derrubar; ver Gear.enhanceOdds)
function pedrasEsperadas() {
  const passos = []
  for (let k = 0; k < EG.plusMax; k++) {
    const o = GR.enhanceOdds(k)
    let volta = 0
    for (let j = o.dropTo; j < k; j++) volta += passos[j].esperado
    passos.push({ de: k, chance: o.chance, custo: o.cost, cai: o.dropTo, esperado: (o.cost + (1 - o.chance) * volta) / o.chance })
  }
  let acc = 0
  for (const p of passos) { acc += p.esperado; p.acumulado = acc }
  return passos
}
function equipInicial() {
  const equip = {}, items = {}
  EG.startGear.forEach((id, i) => { const uid = 'w' + i; equip[G.GEAR[id].slot] = uid; items[uid] = { uid, id, plus: 0 } })
  return GR.resolve({ equip }, items)
}
function conjunto(setId, n) {
  const equip = {}, items = {}
  G.GEAR_SLOTS.slice(0, n).forEach((slot, i) => { const id = `${slot}-${setId}-raro`; const uid = 'c' + i; equip[slot] = uid; items[uid] = { uid, id, plus: 0 } })
  return GR.resolve({ equip }, items)
}

// ---------------------------------------------------------------------------------------------------------
// Modelo do documento: seções com blocos; cada bloco vira Markdown e HTML.
//   Texto: marcação mínima **negrito** e `código`.
//   Célula: string (texto) | { md, html } | { n: '1,03' } (número alinhado à direita)
// ---------------------------------------------------------------------------------------------------------
function inlineHtml(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}
const celMd = (c) => (typeof c === 'string' ? c : c.md != null ? c.md : c.n).replace(/\|/g, '\\|').replace(/\n/g, ' ')
const celHtml = (c) => (typeof c === 'string' ? inlineHtml(c) : c.html != null ? c.html : esc(c.n))
const celNum = (c) => typeof c === 'object' && c.n != null

let ICONES = {}
function icone(nome, alt = '', cls = 'ic') {
  const src = ICONES[nome]
  return src ? `<img class="${cls}" src="${src}" alt="${esc(alt)}" width="16" height="16">` : ''
}
const elCel = (id) => ({ md: nomeEl(id), html: `<span class="el el--${id}">${icone('el-' + id)}${esc(nomeEl(id))}</span>` })
const rarCel = (id) => ({ md: nomeRar(id), html: `<span class="rar rar--${id}">${esc(nomeRar(id))}</span>` })
const ouroCel = (n) => ({ md: num(n), html: `<span class="ouro">${icone('moeda-ouro')}${esc(num(n))}</span>` })
const slotCel = (s) => ({ md: nomeSlot(s), html: `<span class="slot">${icone('slot-' + s)}${esc(nomeSlot(s))}</span>` })
const N = (x) => ({ n: x })

function blocoMd(b) {
  switch (b.t) {
    case 'p': return b.txt
    case 'h3': return '### ' + b.txt
    case 'h4': return '#### ' + b.txt
    case 'nota': return '> ' + b.txt
    case 'lista': return b.itens.map((x) => '- ' + x).join('\n')
    case 'passos': return b.itens.map((x, i) => `${i + 1}. ${x}`).join('\n')
    case 'formula': return '```text\n' + b.txt + '\n```'
    case 'dl': return b.itens.map(([k, v]) => `- **${k}:** ${v}`).join('\n')
    case 'tabela': {
      const cab = '| ' + b.cab.map(celMd).join(' | ') + ' |'
      const sep = '| ' + b.cab.map((c, i) => (b.linhas.some((l) => celNum(l[i])) ? '---:' : '---')).join(' | ') + ' |'
      return [b.titulo ? `**${b.titulo}**\n` : '', cab, sep, ...b.linhas.map((l) => '| ' + l.map(celMd).join(' | ') + ' |')].filter(Boolean).join('\n')
    }
    case 'grade': return blocoMd({ t: 'tabela', cab: b.cab, linhas: b.linhas })
    case 'custom': return b.md
    default: throw new Error('wiki: bloco desconhecido ' + b.t)
  }
}
function blocoHtml(b) {
  switch (b.t) {
    case 'p': return `<p>${inlineHtml(b.txt)}</p>`
    case 'h3': return `<h3${b.id ? ` id="${b.id}"` : ''}>${inlineHtml(b.txt)}</h3>`
    case 'h4': return `<h4>${inlineHtml(b.txt)}</h4>`
    case 'nota': return `<p class="nota">${inlineHtml(b.txt)}</p>`
    case 'lista': return `<ul>${b.itens.map((x) => `<li>${inlineHtml(x)}</li>`).join('')}</ul>`
    case 'passos': return `<ol class="passos">${b.itens.map((x) => `<li>${inlineHtml(x)}</li>`).join('')}</ol>`
    case 'formula': return `<pre class="formula">${esc(b.txt)}</pre>`
    case 'dl': return `<dl class="pares">${b.itens.map(([k, v]) => `<dt>${inlineHtml(k)}</dt><dd>${inlineHtml(v)}</dd>`).join('')}</dl>`
    case 'tabela': {
      const numCol = b.cab.map((c, i) => b.linhas.some((l) => celNum(l[i])))
      const th = b.cab.map((c, i) => `<th scope="col"${numCol[i] ? ' class="n"' : ''}>${celHtml(c)}</th>`).join('')
      const trs = b.linhas.map((l, li) => {
        const ent = b.entradas ? b.entradas[li] : null
        const attrs = ent ? entradaAttrs(ent) : ''
        // célula curta não quebra linha (no celular a tabela rola dentro do contêiner); longa tem largura mínima
        const cls = (c, i) => (numCol[i] ? ' class="n"' : celMd(c).replace(/\*\*/g, '').length <= 26 ? ' class="cu"' : ' class="cl"')
        return `<tr${attrs}>${l.map((c, i) => (i === 0 ? `<th scope="row"${cls(c, i)}>${celHtml(c)}</th>` : `<td${cls(c, i)}>${celHtml(c)}</td>`)).join('')}</tr>`
      }).join('')
      const vazio = b.vazio ? `<p class="vazio" data-vazio="${b.vazio.tipo}" hidden>${esc(b.vazio.txt)}</p>` : ''
      return `<div class="tabela${b.classe ? ' ' + b.classe : ''}">${b.titulo ? `<p class="tabela-titulo">${inlineHtml(b.titulo)}</p>` : ''}<div class="rolagem" tabindex="0" role="region" aria-label="${esc(b.rotulo || b.titulo || 'Tabela')}"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>${vazio}</div>`
    }
    case 'grade': return `<div class="grade${b.classe ? ' ' + b.classe : ''}">${b.linhas.map((l) => `<div class="grade-item">${l.map((c, i) => `<span class="g${i}">${celHtml(c)}</span>`).join('')}</div>`).join('')}</div>`
    case 'custom': return b.html
    default: throw new Error('wiki: bloco desconhecido ' + b.t)
  }
}
function entradaAttrs(ent) {
  return ` id="${ent.id}" class="entrada" data-entrada="${ent.tipo}" data-busca="${esc(semAcento(ent.busca.join(' ')))}"` +
    (ent.el ? ` data-el="${ent.el}"` : '') + (ent.rar ? ` data-rar="${ent.rar}"` : '')
}

// ---------------------------------------------------------------------------------------------------------
// Seções
// ---------------------------------------------------------------------------------------------------------
function secoes(F, A) {
  const SEC = []
  const add = (id, titulo, curto, blocos) => SEC.push({ id, titulo, curto, blocos })
  const minE = Math.min(...E.entryTiers)
  const lim = limitesStatus()

  // 1. Visão geral ---------------------------------------------------------------------------------------
  add('visao', 'Visão geral', 'Visão geral', [
    { t: 'p', txt: `**Galope Elemental** é um jogo de corrida de cavalos automática em pixel art. Você não controla o cavalo durante a corrida: decide antes (montaria, equipamento e entrada) e assiste. Os cavalos têm elemento (${lista(Object.keys(G.ELEMENTS).filter((e) => G.ELEMENTS[e].weather).map(nomeEl))}, além de ${nomeEl('neutro')}), raridade, level e skills.` },
    { t: 'h3', txt: 'Ciclo de uma corrida' },
    { t: 'passos', itens: [
      `**Escolher a montaria.** No começo você escolhe uma das ${G.STARTERS.length} iniciais (${lista(G.STARTERS.map((h) => h.name))}) e recebe ${num(E.startingGold)} de Ouro e o equipamento inicial (${lista(EG.startGear.map((id) => G.GEAR[id].name))}, já equipado).`,
      `**Procurar sala.** Na aba Correr você escolhe a entrada (${lista(E.entryTiers.map((t) => num(t)), 'ou')} de Ouro). A sala tem de ${E.minRacers} a ${E.maxRacers} corredores: você e bots com Poder perto do seu. Pista, clima e rivais saem da seed da sala e não mudam até você correr.`,
      '**Pagar a entrada.** Só depois de "Largar!" a corrida é simulada; o resultado nunca é calculado antes.',
      `**Corrida automática.** O jóquei dosa o ritmo pela estamina; skills disparam nos gatilhos; o Dado da Sorte rola em ${lista(T.diceAt.map(fracao))} da pista e pode virar o clima; a Garra decide a reta final.`,
      `**Prêmio e XP.** A casa fica com ${pct(E.houseFee, 0)} do pote e o resto vai para os primeiros colocados. Todos ganham XP pela colocação, e o pódio pode dar uma Pedra Negra.`
    ] },
    { t: 'h3', txt: 'Abas do jogo' },
    { t: 'dl', itens: F.abas.map((a) => [a, descreverAba(a, F)]) },
    { t: 'nota', txt: 'Ainda não existem no protótipo: Gemas, passe, ovos, contas, servidor, expedições e captura. A única moeda é o Ouro; as Pedras Negras são material de melhoria.' },
    { t: 'p', txt: `Versão dos dados: \`${G.version}\`. Este wiki é gerado do código (\`prototype/src/\`) por \`prototype/tools/wiki.mjs\`; não edite à mão.` }
  ])

  // 2. Status --------------------------------------------------------------------------------------------
  add('status', 'Status', 'Status', [
    { t: 'p', txt: `Cada montaria tem ${G.STAT_KEYS.length} status na escala de 1 a 100. Na corrida o motor usa n(x) = status / 100. Depois de elemento e equipamento o valor é arredondado e preso entre ${lim.baixo} e ${lim.alto}.` },
    { t: 'tabela', rotulo: 'Status', cab: ['Sigla', 'Status', 'Descrição no jogo', 'Na corrida'], linhas: G.STAT_KEYS.map((k) => [N(siglaStat(k)), nomeStat(k), G.STATS[k].desc, papelDoStatus(k, F)]) },
    { t: 'h3', txt: 'Como o status é calculado' },
    { t: 'formula', txt: `status = base + pot × ${num(T.potFlat)} + (level − 1) × (${num(T.growthBase)} + ${num(T.growthPot)} × pot / 31) × crescimento da raridade
         (preso ao teto da raridade)
       + bônus do elemento (+${num(G.ELEMENTS.fogo.statBonus.amount)} no status do elemento)
       + equipamento
arredondado e preso entre ${lim.baixo} e ${lim.alto}` },
    { t: 'p', txt: 'base = status no level 1; pot = potencial (0 a 31, oculto no jogo). O teto da raridade vale antes do elemento e do equipamento, então eles podem passar do teto.' },
    { t: 'p', txt: `O clima também mexe nos status durante a corrida: o multiplicador m do clima (ver Elementos e clima) entra em VEL, ACE, MAN, FOR e GAR (não em EST nem em SOR).` }
  ])

  // 3. Level e XP ----------------------------------------------------------------------------------------
  const xpLin = (() => {
    const a = E.xpToLevel(0), b = E.xpToLevel(1) - a
    for (let l = 1; l <= E.maxLevel; l++) if (E.xpToLevel(l) !== a + b * l) return null
    return { a, b }
  })()
  let acum = 0
  const xpLinhas = []
  for (let l = 1; l < E.maxLevel; l++) { acum += E.xpToLevel(l); xpLinhas.push([`Nv ${l} → ${l + 1}`, N(num(E.xpToLevel(l))), N(num(acum))]) }
  const nPlaces = E.xpPerPlace.length
  const rarIds = Object.keys(G.RARITIES)
  const crescimento = (r, pot) => (T.growthBase + T.growthPot * pot / 31) * G.RARITIES[r].growth
  const niveisEx = [1, 10, 25, E.maxLevel]
  add('level', 'Level e XP', 'Level e XP', [
    { t: 'p', txt: `Level máximo: **${E.maxLevel}**. ${xpLin ? `Para subir do level L para L + 1 são ${num(xpLin.a)} + ${num(xpLin.b)} × L de XP.` : 'XP por level na tabela.'} Do level 1 ao ${E.maxLevel} são ${num(acum)} de XP no total. No level máximo o XP para de acumular.` },
    { t: 'h3', txt: 'XP por colocação e treino' },
    { t: 'tabela', rotulo: 'XP por colocação', cab: ['Colocação', 'XP (corrida valendo)', 'XP (treino)', 'Ouro do treino'], linhas: E.xpPerPlace.map((x, i) => [ordinal(i + 1), N(num(x)), N(num(Math.round(x / F.treinoXpDiv))), ouroCel(F.treinoOuro[i] != null ? F.treinoOuro[i] : F.treinoOuro[F.treinoOuro.length - 1])]) },
    { t: 'p', txt: `**Treino gratuito:** aparece quando seu Ouro não cobre a menor entrada (${num(minE)}). Não cobra entrada, rende 1/${F.treinoXpDiv} do XP e de ${num(Math.min(...F.treinoOuro))} a ${num(Math.max(...F.treinoOuro))} de Ouro pela colocação, e não dá Pedra Negra.` },
    { t: 'h3', txt: 'XP necessário por level' },
    { t: 'grade', classe: 'grade--xp', cab: ['Level', 'XP', 'Acumulado'], linhas: xpLinhas },
    { t: 'h3', txt: 'Crescimento por level' },
    { t: 'p', txt: `A cada level, cada status ganha (${num(T.growthBase)} + ${num(T.growthPot)} × pot / 31) × crescimento da raridade, até o teto da raridade. O potencial também soma ${num(T.potFlat)} × pot fixo desde o level 1.` },
    { t: 'tabela', rotulo: 'Crescimento por level', cab: ['Raridade', 'Crescimento', 'Ganho/level (pot 0)', 'Ganho/level (pot 31)', `Ganho do Nv 1 ao ${E.maxLevel} (pot 31)`, 'Teto'], linhas: rarIds.map((r) => [rarCel(r), N(mult(G.RARITIES[r].growth, 2)), N(num(crescimento(r, 0), 3)), N(num(crescimento(r, 31), 3)), N(num(crescimento(r, 31) * (E.maxLevel - 1), 1)), N(num(G.RARITIES[r].statCap))]) },
    { t: 'h3', txt: 'Aprender skill ao subir de level' },
    { t: 'p', txt: `A cada level ganho há ${pct(T.learnChance, 0)} de chance de aprender uma skill nova (sorteio pela seed do save). Só entra se houver vaga (vagas da raridade) e a skill sorteada é uma das que a montaria pode ter: ${nomeEl('neutro')} ou do próprio elemento, nunca exclusiva de outra montaria, nunca repetida.` },
    { t: 'h3', txt: 'Exemplo: as iniciais por level (sem equipamento)' },
    { t: 'tabela', rotulo: 'Iniciais por level', cab: ['Montaria', 'Level', ...G.STAT_KEYS.map(siglaStat), 'Poder'], linhas: G.STARTERS.flatMap((h) => niveisEx.map((l) => { const x = { ...h, level: l }; const st = S.computeStats(x, null); return [h.name, N(String(l)), ...G.STAT_KEYS.map((k) => N(String(st[k]))), N(num(S.powerRating(x, null)))] })) }
  ])

  // 4. Raridades -----------------------------------------------------------------------------------------
  const contaRar = (r) => todasMontarias().filter((h) => h.rarity === r).length
  add('raridades', 'Raridades', 'Raridades', [
    { t: 'p', txt: `São ${rarIds.length} raridades, da mais comum à mais rara: ${lista(rarIds.map(nomeRar))}. A raridade define o teto de status, o crescimento, as vagas de skill e a chance de ativar skills.` },
    { t: 'tabela', rotulo: 'Raridades', cab: ['Raridade', 'Cor', 'Teto de status', 'Crescimento', 'Vagas de skill', 'Skills do potro (mínimo)', 'Chance base de skill', 'Status base do potro', 'Preço da peça', 'Aluguel base', 'Montarias no jogo'], linhas: rarIds.map((r) => {
      const R = G.RARITIES[r]
      const w = B.GRAU_WINDOW
      const lo = R.baseLo + Math.min(...w.map((x) => x[0])), hi = R.baseLo + Math.max(...w.map((x) => x[1]))
      return [rarCel(r), { md: R.color, html: `<span class="amostra" style="--c:${R.color}"></span><code>${R.color}</code>` }, N(num(R.statCap)), N(mult(R.growth, 2)), N(String(R.skillSlots)), N(String(R.bornSkills)), N(pct(R.skillChance, 0)), N(`${lo}–${hi}`),
        EG.price[r] != null ? ouroCel(EG.price[r]) : 'não existe', BR.rentalBase[r] != null ? ouroCel(BR.rentalBase[r]) : 'não se aluga', N(String(contaRar(r)))]
    }) },
    { t: 'p', txt: `Raridade mais alta que nasce de cruzamento: **${nomeRar(B.RARITY_IDS[B.TUNING.maxRarityOrder])}**. ${nomeRar('mitico')} nunca nasce de cruzamento e não se aluga.` },
    { t: 'h3', txt: 'Grau (estrelas)' },
    { t: 'p', txt: `Cada montaria tem um grau de ${estrelas(1)} a ${estrelas(B.GRAU_WINDOW.length)}: a qualidade do cruzamento. Ele muda a faixa dos status base do potro, o piso do potencial e o preço do aluguel. As iniciais e os selvagens têm o grau definido nos dados.` },
    { t: 'tabela', rotulo: 'Graus', cab: ['Grau', 'Status base do potro', 'Piso do potencial', 'Multiplicador do aluguel'], linhas: B.GRAU_WINDOW.map((w, i) => [N(estrelas(i + 1)), `base da raridade + ${w[0]} a + ${w[1]}`, N(String(B.GRAU_POT_FLOOR[i])), N(mult(BR.grauMult[i], 2))]) },
    { t: 'h3', txt: 'Corcel' },
    { t: 'p', txt: `Uma montaria é **Corcel** quando já tem todas as skills "de linha" da sua raridade. Corcel garante herança de skill no cruzamento (ver Cruzamento).` },
    { t: 'tabela', rotulo: 'Corcel', cab: ['Raridade', 'Skills de linha'], linhas: Object.keys(B.CORCEL_SETS).map((r) => [rarCel(r), B.CORCEL_SETS[r].map(nomeSkill).join(', ')]) }
  ])

  // 5. Elementos e clima ---------------------------------------------------------------------------------
  const elIds = Object.keys(G.ELEMENTS), clIds = Object.keys(G.WEATHERS)
  const penalizadoPor = (el) => clIds.filter((w) => G.WEATHERS[w].penalizes === el)
  const amostraVento = F.vento
  add('elementos', 'Elementos e clima', 'Elementos', [
    { t: 'p', txt: `Cada elemento dá um bônus fixo num status e tem um clima "dono", que o favorece. Cada clima também penaliza um elemento. ${nomeEl('neutro')} não ganha nem perde.` },
    { t: 'tabela', rotulo: 'Elementos', cab: ['Elemento', 'Bônus de status', 'Clima dono', 'Penalizado por', 'Descrição'], linhas: elIds.map((e) => {
      const el = G.ELEMENTS[e], pen = penalizadoPor(e)
      return [elCel(e), el.statBonus ? `+${el.statBonus.amount} ${nomeStat(el.statBonus.stat)}` : '—', el.weather ? nomeClima(el.weather) : '—', pen.length ? pen.map(nomeClima).join(', ') : '—', el.desc]
    }) },
    { t: 'h3', txt: 'Climas' },
    { t: 'tabela', rotulo: 'Climas', cab: ['Clima', 'Favorece', 'Penaliza', 'Efeito geral', 'Descrição'], linhas: clIds.map((w) => {
      const W = G.WEATHERS[w]
      return [nomeClima(w), W.element ? elCel(W.element) : '—', W.penalizes ? elCel(W.penalizes) : '—', efeitoGeralClima(w), W.desc]
    }) },
    { t: 'h3', txt: 'Multiplicador de clima (m)' },
    { t: 'p', txt: `Elemento dono do clima: ${multF(T.weatherMult)}; com a skill de clima ativa, ${multF(T.weatherMultDouble)}; com ${EG.setBonus.pieces[1]} peças do conjunto daquele clima (sem a skill), ${multF(T.weatherMultSet)}. Elemento penalizado: ${multF(2 - T.weatherMult)} (o equipamento de ${EG.setBonus.pieces[2]} peças anula). O resto, e todos no ${nomeClima('nublado')}, ×1.` },
    { t: 'tabela', rotulo: 'Multiplicador de clima', cab: ['Elemento', ...clIds.map(nomeClima)], linhas: elIds.map((e) => [elCel(e), ...clIds.map((w) => N(multF(S.weatherMult(e, w, false))))]) },
    { t: 'formula', txt: `vMax       = (${num(T.vBase)} + ${num(T.vRange)} × n(VEL) × m) × (1 + ${num(T.weatherVel)} × (m − 1))
aceleração = ${num(T.aBase)} + ${num(T.aRange)} × n(ACE) × m
Força, Manobra e Garra efetivas = n(x) × m` },
    { t: 'p', txt: `O clima inicial sai da seed da sala. O Dado da Sorte pode virar o clima no meio da corrida (ver Dado da Sorte); quando vira, os números de todos são recalculados (o que já foi gasto não volta).` },
    { t: 'h3', txt: 'Vento (só visual)' },
    { t: 'p', txt: `Cada sala tem um vento sorteado pela seed: ${lista(Object.keys(amostraVento).map((k) => `${k} ${pct(amostraVento[k], 0)}`))}, soprando para a direita ou para a esquerda. Ele só mexe no desenho (bandeirinhas, folhas, nuvens, inclinação da chuva); não entra na simulação.` }
  ])

  // 6. Skills --------------------------------------------------------------------------------------------
  const skIds = Object.keys(G.SKILLS)
  const quemTem = (id) => todasMontarias().filter((h) => h.skills.indexOf(id) >= 0).map((h) => h.name)
  const quemPode = (sk) => sk.exclusive ? `só ${nomeMontaria(sk.exclusive)} (exclusiva)` : sk.element === 'neutro' ? 'qualquer elemento' : `só ${nomeEl(sk.element)}`
  const ordemEl = ['neutro', ...elIds.filter((e) => e !== 'neutro')]
  const skillMd = ordemEl.filter((e) => skIds.some((id) => G.SKILLS[id].element === e)).map((e) => {
    const ids = skIds.filter((id) => G.SKILLS[id].element === e)
    return `### ${e === 'neutro' ? 'Neutras' : nomeEl(e)} (${ids.length})\n\n` + blocoMd({ t: 'tabela', cab: ['Skill', 'Gatilho', 'Efeito', 'Descrição no jogo', 'Quem pode ter', 'Começa em', 'Pontos no Poder', 'Balão'], linhas: ids.map((id) => {
      const sk = G.SKILLS[id], qt = quemTem(id)
      return [`**${sk.name}**`, descreverGatilho(sk.trigger), descreverEfeito(sk.effect), sk.desc, quemPode(sk), qt.length ? qt.join(', ') : '—', N(num(pesoSkill(id) * 20)), FX.nomeCurto(sk.name, sk.short)]
    }) })
  }).join('\n\n')
  const skillHtml = ordemEl.filter((e) => skIds.some((id) => G.SKILLS[id].element === e)).map((e) => {
    const ids = skIds.filter((id) => G.SKILLS[id].element === e)
    return `<section class="grupo" data-grupo="skill"><h3 id="skills-${e}">${icone('el-' + e)}${esc(e === 'neutro' ? 'Neutras' : nomeEl(e))} <span class="conta">${ids.length}</span></h3><div class="cartoes cartoes--skills">` +
      ids.map((id) => {
        const sk = G.SKILLS[id], qt = quemTem(id)
        return `<article${entradaAttrs({ id: 'skill-' + id, tipo: 'skill', busca: [sk.name, nomeEl(sk.element), 'skill'], el: sk.element })}>` +
          `<header><h4>${esc(sk.name)}</h4>${elCel(sk.element).html}</header>` +
          `<p class="desc">${esc(sk.desc)}</p>` +
          `<dl class="pares pares--skill"><dt>Gatilho</dt><dd>${inlineHtml(descreverGatilho(sk.trigger))}</dd>` +
          `<dt>Efeito</dt><dd>${inlineHtml(descreverEfeito(sk.effect))}</dd>` +
          `<dt>Quem pode ter</dt><dd>${esc(quemPode(sk))}</dd>` +
          `<dt>Começa em</dt><dd>${esc(qt.length ? qt.join(', ') : 'nenhuma montaria pronta')}</dd>` +
          `<dt>Pontos no Poder</dt><dd class="num">+${esc(num(pesoSkill(id) * 20))}</dd>` +
          `<dt>Balão</dt><dd><span class="balao">${esc(FX.nomeCurto(sk.name, sk.short))}</span></dd></dl></article>`
      }).join('') + `</div></section>`
  }).join('') + `<p class="vazio" data-vazio="skill" hidden>Nenhuma skill casa com a busca e os filtros.</p>`
  const sorteEx = 50
  const lvEx = [1, 25, E.maxLevel]
  add('skills', 'Skills', 'Skills', [
    { t: 'p', txt: `São ${skIds.length} skills. Cada uma tem um gatilho; quando ele acontece, a montaria faz **uma** tentativa contra a chance de skill (uma por corrida, ou uma por bloco nas skills de curva e subida marcadas "em cada bloco"). Se acertar, o efeito vale pelo tempo ou pela distância indicados.` },
    { t: 'formula', txt: `chance de skill = min(${pct(T.skillChanceMax, 0)}, chance base da raridade + ${pp(T.skillPerLevel)} × (level − 1) + ${pp(T.skillPerSorte)} × SOR + bônus de equipamento)` },
    { t: 'tabela', rotulo: 'Chance de skill', titulo: `Chance de ativar com SOR ${sorteEx} (sem equipamento / com ${EG.setBonus.pieces[0]}+ peças de conjunto)`, cab: ['Raridade', ...lvEx.map((l) => `Nv ${l}`)], linhas: rarIds.map((r) => [rarCel(r), ...lvEx.map((l) => N(`${pct(S.skillChance({ rarity: r, level: l }, { sorte: sorteEx }), 1)} / ${pct(S.skillChance({ rarity: r, level: l }, { sorte: sorteEx }, EG.setBonus.skillChance), 1)}`))]) },
    { t: 'p', txt: `**Quem pode ter:** skills ${nomeEl('neutro')} servem para qualquer elemento; as de elemento, só para aquele elemento; as exclusivas, só para a montaria inicial dona (não se aprendem nem se herdam). O número de skills é limitado pelas vagas da raridade.` },
    { t: 'p', txt: `**Pontos no Poder:** cada skill soma 20 × o peso do gatilho no Poder (gatilhos que nem sempre acontecem valem menos). **Balão:** o texto que aparece na pista quando a skill ativa.` },
    { t: 'custom', md: skillMd, html: skillHtml }
  ])

  // 7. Dado da Sorte -------------------------------------------------------------------------------------
  const ld = limitesDado()
  const dadoViciado = skIds.filter((id) => G.SKILLS[id].effect.extraDice).map(nomeSkill)
  add('dado', 'Dado da Sorte', 'Dado da Sorte', [
    { t: 'p', txt: `Quando o líder cruza ${lista(T.diceAt.map(fracao))} da distância, **todos** rolam o Dado da Sorte (até quem já chegou). Ele usa um fluxo de números próprio da seed, então é determinístico.` },
    { t: 'passos', itens: [
      `Cada montaria rola um dado de ${ld.min} a ${ld.max}.`,
      'Com chance igual à sua Sorte (SOR%), rola um 2º dado e fica com o melhor.',
      `${dadoViciado.length ? lista(dadoViciado) : 'A skill de dado extra'} (gatilho "antes de cada Dado da Sorte") soma um dado extra: no máximo ${ld.maxDados} dados.`,
      'O maior dado vence. Empate no topo: só os empatados rolam de novo.',
      `O clima vira o do elemento do vencedor. Se já for esse clima, ou se o vencedor for ${nomeEl('neutro')}, o clima "segura".`
    ] },
    { t: 'tabela', rotulo: 'Vencedor e clima', cab: ['Elemento do vencedor', 'Clima depois do Dado'], linhas: elIds.map((e) => [elCel(e), G.ELEMENTS[e].weather ? nomeClima(G.ELEMENTS[e].weather) : 'não muda']) },
    { t: 'tabela', rotulo: 'Sorte e dados', titulo: 'Chance de rolar o 2º dado', cab: ['SOR', 'Chance do 2º dado'], linhas: [0, 25, 50, 75, 100].map((s) => [N(String(s)), N(pct(s / 100, 0))]) }
  ])

  // 8. Pista e simulação ---------------------------------------------------------------------------------
  const P = amostraPistas()
  const btIds = Object.keys(G.BLOCK_TYPES)
  add('pista', 'Pista e simulação', 'Pista', [
    { t: 'p', txt: `A pista de cada sala sai da seed: distância de ${num(P.dMin)} a ${num(P.dMax)} m (de ${num(P.passo)} em ${num(P.passo)} m), de ${P.bMin} a ${P.bMax} blocos de tamanhos variados (fronteiras de 10 em 10 m), piso e clima inicial. O primeiro e o último bloco são sempre ${G.BLOCK_TYPES[P.primeiraUltima[0]].name.toLowerCase()}; os do meio são sorteados entre ${lista(btIds.map((b) => G.BLOCK_TYPES[b].name.toLowerCase()))}.` },
    { t: 'tabela', rotulo: 'Frequências da pista', titulo: `Frequência em ${num(AMOSTRA)} seeds`, cab: ['Item', 'Valores'], linhas: [
      ['Blocos do meio', btIds.map((b) => `${G.BLOCK_TYPES[b].name} ${pct(P.tipos[b] / P.meio, 0)}`).join(' · ')],
      ['Piso', Object.keys(G.SURFACES).map((s) => `${G.SURFACES[s].name} ${pct(P.pisos[s] / AMOSTRA, 0)}`).join(' · ')],
      ['Clima inicial', clIds.map((w) => `${nomeClima(w)} ${pct(P.climas[w] / AMOSTRA, 0)}`).join(' · ')]
    ] },
    { t: 'h3', txt: 'Blocos' },
    { t: 'tabela', rotulo: 'Blocos', cab: ['Bloco', 'Fator de velocidade', 'Gasto de estamina', 'Observação'], linhas: btIds.map((b) => { const d = descreverBloco(b, F); return [G.BLOCK_TYPES[b].name, d.fator, d.gasto, d.mais] }) },
    { t: 'h3', txt: 'Pisos' },
    { t: 'tabela', rotulo: 'Pisos', cab: ['Piso', 'Perda de velocidade', 'Gasto de estamina', 'Descrição'], linhas: Object.keys(G.SURFACES).map((s) => { const x = G.SURFACES[s]; return [x.name, N(x.slow ? sinalPct(-x.slow, 0) : '0%'), N(mult(x.drain, 2)), x.desc] }) },
    { t: 'p', txt: `A perda de velocidade do piso é aliviada pela Força: perda × (1 − ${num(T.forcaSurfRelief)} × n(FOR)).` },
    { t: 'p', txt: `Nomes de hipódromo sorteados para a sala (só o nome): ${lista(F.pistas)}.` },
    { t: 'h3', txt: 'Como a corrida é simulada' },
    { t: 'p', txt: `A simulação anda em passos fixos de ${num(T.dt)} s, só com a seed e os status (sem ruído escondido). Mesma seed e mesma configuração dão o mesmo resultado.` },
    { t: 'h4', txt: 'Velocidade-alvo' },
    { t: 'formula', txt: `alvo = ritmo × vMax × piso × pelotão × chuva × fator do bloco × boosts × variação (±${pct(T.tickJitter / 2, 1)})
sobe com a aceleração; desce a ${num(T.decel)} m/s²` },
    { t: 'h4', txt: 'Ritmo do jóquei' },
    { t: 'p', txt: `O jóquei calcula o ritmo constante que o tanque restante aguenta até a chegada e guarda ${pct(T.rationReserve, 0)} de reserva. Ele lê o tanque com um erro sorteado de ${sinalPct(T.jockeyErrMin, 0)} a ${sinalPct(T.jockeyErrMax, 0)} (às vezes é otimista demais e cansa no fim). Ritmo: até ${pct(T.pace.mid, 0)} da vMax até ${pct(T.pace.spurtStart, 0)} da pista, depois até ${pct(T.pace.spurtCap, 0)} (sprint final); nunca abaixo de ${pct(T.minPace, 0)} por vontade própria. A estimativa já conta as subidas que faltam.` },
    { t: 'h4', txt: 'Estamina' },
    { t: 'formula', txt: `gasto por segundo = (v / (vMax × boosts × fator da subida))^${T.drainExp} × (${num(T.drainRefDist)} / D)^(${fracao(T.drainDistExp[0] / T.drainDistExp[1])}) × mods / tanque
tanque = ${num(T.poolBase)} + ${num(T.poolEst)} × n(EST)
mods: piso, sol ${mult(T.sunDrain)}, subida, vácuo ${sinalPct(-T.draftSave, 0)}, skills` },
    { t: 'p', txt: 'Boosts (Garra e skills) sobem o teto sem custo extra de estamina. Pistas longas apertam mais o tanque no total.' },
    { t: 'h4', txt: 'Vácuo e pelotão' },
    { t: 'p', txt: `**Vácuo:** quem corre de ${num(T.draftMin)} a ${num(T.draftRange)} m atrás de alguém gasta ${pct(T.draftSave, 0)} menos estamina. **Pelotão:** com vizinhos a até ${num(T.crowdRange)} m, a velocidade cai até ${pct(T.crowdSlow, 0)} (teto com ${F.pelotaoMax} vizinhos); a Força alivia ${pct(T.forcaCrowdRelief, 0)} × n(FOR) disso.` },
    { t: 'h4', txt: 'Garra' },
    { t: 'p', txt: `Ao cruzar ${pct(T.garraZone, 0)} da pista, cada montaria sorteia a Garra uma vez: chance = min(${pct(T.garraChanceMax, 0)}, ${pct(T.garraChanceBase, 0)} + ${pct(T.garraChanceRange, 0)} × n(GAR) × m + bônus de skill). Se sair, o teto de velocidade fica ${mult(1 + T.garraBoostBase, 2)} + ${num(T.garraBoostRange, 3)} × n(GAR) × m (+ bônus de skill) até a chegada.` },
    { t: 'h4', txt: 'Cansaço' },
    { t: 'p', txt: `Estamina zerada: o ritmo cai para ${pct(T.exhaustPace, 0)} até o fim. Se ainda faltar mais de ${pct(F.cansouFalta, 0)} da pista, aparece o aviso "cansou".` },
    { t: 'h4', txt: 'Largada e eventos' },
    { t: 'p', txt: `Cada montaria reage à largada com um atraso sorteado de até ${num(T.startDelayMax)} s (menor com ACE alta). Troca de liderança só vira evento depois de ${pct(T.leadMinP, 0)} da pista, confirmada por ${num(T.leadConfirmS)} s e com pelo menos ${num(T.leadMinGapS)} s entre avisos. Depois da chegada o cavalo freia a ${F.chegadaFreio} m/s². A corrida tem teto de ${num(T.maxTime)} s.` },
    { t: 'h4', txt: 'Traçado (desenho)' },
    { t: 'p', txt: `O mapa da pista é desenhado dos blocos: retas e subidas em linha reta, e cada sequência de curvas coladas vira uma curva só, que gira ${FX.CURVA.giroPor150m}° a cada 150 m (entre ${FX.CURVA.giroMin}° e ${FX.CURVA.giroMax}°). É só desenho: a simulação usa os blocos.` }
  ])

  // 9. Montarias -----------------------------------------------------------------------------------------
  add('montarias', 'Montarias', 'Montarias', [
    { t: 'p', txt: `Há ${G.STARTERS.length} montarias iniciais e ${G.WILD_HORSES.length} selvagens. Todas são da espécie cavalo. As selvagens aparecem como bots nas corridas, como reprodutores de aluguel no Haras (menos as de raridade ${nomeRar('mitico')}) e ${F.vitrine.length} delas na vitrine da Expedição. Bots usam o modelo com level ajustado ao seu Poder.` },
    { t: 'p', txt: `**Potencial** (0 a 31 por status) é **oculto no jogo**; aparece aqui para referência. Os status "no level" são sem equipamento, com o bônus do elemento.` },
    { t: 'custom', md: montariasMd(F), html: montariasHtml(F) }
  ])

  // 10. Cruzamento ---------------------------------------------------------------------------------------
  const breedRar = B.RARITY_IDS.slice(0, B.TUNING.maxRarityOrder + 1)
  const pares = []
  breedRar.forEach((a, i) => breedRar.slice(i).forEach((b) => pares.push([a, b])))
  const tabelaPares = (lv) => ({ t: 'tabela', rotulo: 'Raridade do potro', titulo: lv === 0 ? 'Raridade do potro com L = 0 (piso)' : `Raridade do potro com L = 1 (nível efetivo ${BR.levelSaturation} ou mais)`, cab: ['Pais', ...B.RARITY_IDS.map(nomeRar)], linhas: pares.map(([a, b]) => {
    const o = B.rarityOdds({ rarity: a, level: lv }, { rarity: b, level: lv })
    return [`${nomeRar(a)} × ${nomeRar(b)}`, ...B.RARITY_IDS.map((r) => N(o[r] > 0 ? pct(o[r], 1) : '—'))]
  }) })
  const gO = (gb, lv) => B.grauOdds({ grau: gb, level: lv }, { grau: gb, level: lv })
  const alugaveis = G.WILD_HORSES.filter((h) => B.rentalPrice(h) != null)
  add('cruzamento', 'Cruzamento (Haras)', 'Cruzamento', [
    { t: 'p', txt: 'No Haras uma égua (♀) e um garanhão (♂) geram um potro. O sorteio é determinístico (seed do save e contador de cruzas). O potro nasce na hora, no level 1 (ainda não existe gestação no protótipo).' },
    { t: 'h3', txt: 'Regras e custos' },
    { t: 'lista', itens: [
      `**Cruzar com aluguel:** com um selvagem de sexo oposto; custa o aluguel dele (tabela abaixo). ${nomeRar('mitico')} não se aluga.`,
      `**Cruzar duas suas:** registro de ${num(BR.ownRegistration)} de Ouro; as duas precisam ter cruzas restantes e cada uma gasta 1.`,
      `**Troca:** duas montarias suas de sexos opostos, com qualquer número de cruzas, viram um potro por ${num(BR.exchange)} de Ouro. Os dois pais deixam o estábulo.`,
      `**Cruzas restantes ao nascer:** ${Object.keys(G.BREED_LEFT).map((s) => `${s === 'm' ? 'macho' : 'fêmea'} ${G.BREED_LEFT[s]}`).join(', ')}. Cada cruza gasta 1 da sua montaria.`,
      `**Estábulo:** cruzar exige vaga livre (o potro ocupa uma). Vagas: ${BR.stableSlotsStart} no começo, até ${BR.stableSlotsMax}, a ${num(BR.stableSlotPrice)} de Ouro cada.`,
      'Não dá para cruzar com um páreo aberto (sala paga ou não).'
    ] },
    { t: 'tabela', rotulo: 'Aluguel', titulo: 'Preço do aluguel (base × grau)', cab: ['Raridade', ...B.GRAU_WINDOW.map((w, i) => estrelas(i + 1))], linhas: Object.keys(BR.rentalBase).map((r) => [rarCel(r), ...B.GRAU_WINDOW.map((w, i) => ouroCel(B.rentalPrice({ rarity: r, grau: i + 1 })))]) },
    { t: 'tabela', rotulo: 'Reprodutores de aluguel', titulo: 'Reprodutores de aluguel', cab: ['Montaria', 'Sexo', 'Elemento', 'Raridade', 'Grau', 'Level', 'Aluguel'], linhas: alugaveis.map((h) => [h.name, h.sex === 'f' ? '♀ fêmea' : '♂ macho', elCel(h.element), rarCel(h.rarity), N(estrelas(h.grau)), N(String(h.level)), ouroCel(B.rentalPrice(h))]) },
    { t: 'h3', txt: 'Fator de nível (L)' },
    { t: 'formula', txt: `L = clamp((${num(BR.mareWeight)} × level da égua + ${num(1 - BR.mareWeight)} × level do garanhão) / ${BR.levelSaturation}, 0, 1)` },
    { t: 'p', txt: `L vai de 0 (pior) a 1 (melhor). As chances são interpoladas em linha reta entre a coluna "L = 0" e a "L = 1". Dois pais no level 1 dão L = ${num(B.levelFactor({ level: 1 }, { level: 1 }), 3)}.` },
    { t: 'h3', txt: 'Raridade do potro' },
    { t: 'p', txt: `A base é a **menor** raridade entre os pais. O potro pode nascer 1 abaixo, igual, 1 acima ou 2 acima; pais da mesma raridade usam a linha "igual", pais diferentes a linha "misturada". O resultado nunca passa de ${nomeRar(B.RARITY_IDS[B.TUNING.maxRarityOrder])} (o que passaria soma no limite).` },
    { t: 'tabela', rotulo: 'Chances de raridade (colunas)', cab: ['Linha', 'L', '1 abaixo', 'Igual', '1 acima', '2 acima'], linhas: ['same', 'mixed'].flatMap((k) => [['lv1', 'L = 0'], ['lv30', 'L = 1']].map(([c, rot]) => [k === 'same' ? 'Mesma raridade' : 'Raridades diferentes', rot, ...B.TUNING.rarity[k][c].map((x) => N(num(x, 1) + '%'))])) },
    tabelaPares(0),
    tabelaPares(BR.levelSaturation),
    { t: 'h3', txt: 'Grau do potro' },
    { t: 'p', txt: `Grau base = arredondar(${num(BR.mareWeight)} × grau da égua + ${num(1 - BR.mareWeight)} × grau do garanhão). Se a raridade **subiu**, o potro nasce ${estrelas(1)}; se **desceu**, nasce ${estrelas(B.GRAU_WINDOW.length)}. Se manteve, sorteia desce/mantém/sobe (fora de 1–3 soma em "mantém").` },
    { t: 'tabela', rotulo: 'Grau do potro', cab: ['Grau base', 'L', ...B.GRAU_WINDOW.map((w, i) => estrelas(i + 1))], linhas: B.GRAU_WINDOW.flatMap((w, i) => [0, BR.levelSaturation].map((lv) => { const o = gO(i + 1, lv); return [N(estrelas(i + 1)), lv ? 'L = 1' : 'L = 0', ...B.GRAU_WINDOW.map((x, j) => N(o[j + 1] > 0 ? pct(o[j + 1], 0) : '—'))] })) },
    { t: 'h3', txt: 'Elemento, sexo, status e potencial' },
    { t: 'lista', itens: [
      `**Elemento:** se os pais têm o mesmo, o potro herda; senão, ${pct(F.elementoPotro, 0)} de chance de cada um.`,
      `**Sexo:** ${pct(F.sexoPotro, 0)} fêmea, ${pct(1 - F.sexoPotro, 0)} macho.`,
      '**Status base:** sorteados na faixa da raridade e do grau do potro (tabela abaixo); não herdam dos pais.',
      `**Potencial:** para cada status, ${pct(B.TUNING.potInherit, 0)} de chance de herdar o de um dos pais (${pct(F.potroPai, 0)} para cada); senão sai de 0 a ${F.potValores - 1}. Depois aplica o piso do grau.`,
      `**Nome:** sorteado entre ${G.FOAL_NAMES.length}: ${lista(G.FOAL_NAMES)}.`,
      '**Cores:** mistura das cores dos pais.'
    ] },
    { t: 'tabela', rotulo: 'Status base do potro', titulo: 'Faixa dos status base do potro', cab: ['Raridade', ...B.GRAU_WINDOW.map((w, i) => estrelas(i + 1))], linhas: breedRar.map((r) => [rarCel(r), ...B.GRAU_WINDOW.map((w) => N(`${G.RARITIES[r].baseLo + w[0]}–${G.RARITIES[r].baseLo + w[1]}`))]) },
    { t: 'h3', txt: 'Skills do potro' },
    { t: 'passos', itens: [
      'Candidatas: as skills dos pais que servem para o elemento do potro (exclusivas nunca passam).',
      `Corcel: com 1 pai Corcel, 1 skill garantida (${pct(F.corcelDois, 0)} de chance de 2); com os 2 pais Corcel, 2 garantidas.`,
      `Cada candidata restante passa com ${pct(B.TUNING.skillInherit, 0)} de chance.`,
      'Corte nas vagas da raridade do potro.',
      'Se ficou abaixo das skills ao nascer da raridade, completa com skills sorteadas que servem para o elemento.'
    ] }
  ])

  // 11. Equipamento --------------------------------------------------------------------------------------
  const gearIds = Object.keys(G.GEAR)
  const gearRar = Object.keys(EG.price)
  const pedras = pedrasEsperadas()
  const setIds = Object.keys(G.GEAR_SETS)
  const bonusTxt = (n) => {
    const r = conjunto(setIds[0], n)
    const partes = []
    if (n >= EG.setBonus.pieces[0]) partes.push(`+${EG.setBonus.sorte} ${nomeStat('sorte')}`)
    for (const k of Object.keys(r.special)) {
      const t = descreverEspecial(k, r.special[k])
      if (t) partes.push(t.replace(`clima ${nomeClima(G.GEAR_SETS[setIds[0]].weather)}`, 'clima do conjunto'))
    }
    partes.push(`+${GR.ratingPts(n)} de Poder`)
    return partes.join('; ')
  }
  const peca = (id) => G.GEAR[id]
  add('equipamento', 'Equipamento', 'Equipamento', [
    { t: 'p', txt: `Cada montaria tem ${G.GEAR_SLOTS.length} slots. Cada peça soma um status principal (o valor da raridade + a melhoria) e um secundário, definidos pelo slot. Peças ${lista(gearRar.filter((r) => !gearIds.some((id) => peca(id).rarity === r && peca(id).set)).map(nomeRar))} são soltas; ${lista(gearRar.filter((r) => gearIds.some((id) => peca(id).rarity === r && peca(id).set)).map(nomeRar))} pertencem a um conjunto (${lista(setIds.map(nomeConjunto))}).` },
    { t: 'tabela', rotulo: 'Slots', cab: ['Slot', 'Status principal', 'Status secundário'], linhas: G.GEAR_SLOTS.map((s) => [slotCel(s), nomeStat(G.GEAR_SLOT_INFO[s].main), nomeStat(G.GEAR_SLOT_INFO[s].sub)]) },
    { t: 'tabela', rotulo: 'Peças por raridade', cab: ['Raridade', 'Principal', 'Secundário', 'Preço', 'Venda', 'Na loja'], linhas: gearRar.map((r) => { const id = gearIds.find((x) => peca(x).rarity === r); return [rarCel(r), N('+' + EG.main[r]), N('+' + EG.sub[r]), ouroCel(EG.price[r]), ouroCel(GR.sellPrice(id)), peca(id).shop ? 'sim' : '**nunca à venda**'] }) },
    { t: 'p', txt: `Venda devolve ${pct(EG.sellRate, 0)} do preço. Peças ${lista(gearRar.filter((r) => gearIds.some((id) => peca(id).rarity === r && !peca(id).shop)).map(nomeRar))} nunca estão à venda. Equipamento inicial: ${lista(EG.startGear.map((id) => peca(id).name))}.` },
    { t: 'h3', txt: 'Catálogo completo' },
    { t: 'tabela', rotulo: 'Catálogo de peças', classe: 'catalogo', cab: ['Peça', 'Slot', 'Raridade', 'Conjunto', 'Principal', 'Secundário', 'Preço', 'Loja'], linhas: gearIds.map((id) => {
      const p = peca(id), info = G.GEAR_SLOT_INFO[p.slot]
      return [{ md: `**${p.name}**`, html: `<strong>${esc(p.name)}</strong>` }, slotCel(p.slot), rarCel(p.rarity), p.set ? nomeConjunto(p.set) : '—', N(`+${p.main} ${siglaStat(info.main)}`), N(p.sub ? `+${p.sub} ${siglaStat(info.sub)}` : '—'), ouroCel(p.price), p.shop ? 'sim' : 'não']
    }), entradas: gearIds.map((id) => {
      const p = peca(id)
      return { id: 'peca-' + id, tipo: 'peca', busca: [p.name, nomeSlot(p.slot), nomeRar(p.rarity), p.set ? 'conjunto ' + nomeConjunto(p.set) : '', p.set && G.WEATHERS[G.GEAR_SETS[p.set].weather].element ? nomeEl(G.WEATHERS[G.GEAR_SETS[p.set].weather].element) : ''], rar: p.rarity, el: p.set ? G.WEATHERS[G.GEAR_SETS[p.set].weather].element : null }
    }), vazio: { tipo: 'peca', txt: 'Nenhuma peça casa com a busca e os filtros.' } },
    { t: 'h3', txt: 'Melhoria (+1 a +' + EG.plusMax + ')', id: 'melhoria' },
    { t: 'p', txt: `Cada tentativa gasta Pedras Negras e tem uma chance de sucesso (sorteio pela seed do save). A partir de +${EG.enhanceDropFrom}, a falha **derruba** a peça 1 nível. Cada + soma 1 no status principal. Pedra Negra: ${num(EG.stonePrice)} de Ouro na loja (pacote de ${EG.stoneBundle} = ${num(EG.stonePrice * EG.stoneBundle)}).` },
    { t: 'tabela', rotulo: 'Melhoria', cab: ['Passo', 'Chance', 'Custo (pedras)', 'Se falhar', 'Pedras esperadas no passo', 'Pedras esperadas desde +0'], linhas: pedras.map((p) => [`+${p.de} → +${p.de + 1}`, N(pct(p.chance, 0)), N(String(p.custo)), p.cai < p.de ? `cai para +${p.cai}` : `fica em +${p.de}`, N(num(p.esperado, 1)), N(num(p.acumulado, 1))]) },
    { t: 'p', txt: `**Pedra Negra do pódio:** só em corrida valendo (entrada paga), sorteada pela seed da sala: ${E.xpPerPlace.slice(0, EG.podiumStone.length).map((x, i) => `${ordinal(i + 1)} lugar ${pct(EG.podiumStone[i], 0)}`).join(', ')}.` },
    { t: 'h3', txt: 'Conjuntos', id: 'conjuntos' },
    { t: 'tabela', rotulo: 'Conjuntos', cab: ['Conjunto', 'Clima', 'Elemento favorecido', 'Peças'], linhas: setIds.map((s) => { const w = G.GEAR_SETS[s].weather; return [nomeConjunto(s), nomeClima(w), G.WEATHERS[w].element ? elCel(G.WEATHERS[w].element) : '—', gearIds.filter((id) => peca(id).set === s).map((id) => `${peca(id).name} (${nomeRar(peca(id).rarity)})`).join(', ')] }) },
    { t: 'tabela', rotulo: 'Bônus de conjunto', titulo: 'Bônus por número de peças do mesmo conjunto (acumulam)', cab: ['Peças', 'Bônus'], linhas: EG.setBonus.pieces.map((n) => [N(String(n)), bonusTxt(n)]) },
    { t: 'p', txt: `Vale o conjunto com mais peças equipadas (empate: ${lista(setIds.map(nomeConjunto))}, nessa ordem). O reforço de ${multF(T.weatherMultSet)} só age se o elemento da montaria for o dono do clima do conjunto.` },
    { t: 'h3', txt: 'Equipamento dos bots por liga' },
    { t: 'tabela', rotulo: 'Equipamento dos bots', cab: ['Liga do alvo', 'Peças do bot'], linhas: G.LEAGUES.map((L, i) => { const r = GR.botGear(i, 'fogo', 0); return [L.name, r.pieces.length ? r.pieces.map((p) => `${peca(p.id).name} +${p.plus}`).join(', ') : 'nada'] }) },
    { t: 'p', txt: `O conjunto dos bots é o do clima do elemento deles (nos exemplos acima, ${nomeEl('fogo')}); bot ${nomeEl('neutro')} sorteia o conjunto.` }
  ])

  // 12. Economia -----------------------------------------------------------------------------------------
  const nR = []
  for (let n = E.minRacers; n <= E.maxRacers; n++) nR.push(n)
  const entradaEx = E.entryTiers[1] != null ? E.entryTiers[1] : E.entryTiers[0]
  const pesos = {}
  skIds.forEach((id) => { const t = G.SKILLS[id].trigger.indexOf('weather:') === 0 ? 'weather:*' : G.SKILLS[id].trigger; pesos[t] = pesoSkill(id) })
  const ini = equipInicial()
  add('economia', 'Economia', 'Economia', [
    { t: 'p', txt: `Moeda única hoje: **Ouro**. Começa com ${num(E.startingGold)}. Ganha-se Ouro correndo (prêmios e treino) e vendendo peças; gasta-se em entradas, peças, Pedras Negras, aluguel e registro de cruza, Troca e vagas do estábulo.` },
    { t: 'h3', txt: 'Entradas e prêmios' },
    { t: 'p', txt: `Entradas: ${lista(E.entryTiers.map((t) => num(t)), 'ou')} de Ouro. Todos pagam a mesma entrada; a casa fica com ${pct(E.houseFee, 0)} do pote (arredondado) e o resto é dividido conforme o tamanho do campo. Quem leva prêmio nunca sai no prejuízo.` },
    { t: 'tabela', rotulo: 'Divisão do prêmio', cab: ['Corredores', 'Divisão', ...nR.length ? [`Exemplo com entrada ${num(entradaEx)}: pote / casa / prêmios`] : []], linhas: nR.map((n) => {
      const pay = S.payouts(entradaEx, n, Array.from({ length: n }, (x, i) => i))
      return [N(String(n)), E.payoutSplitFor(n).map((x, i) => `${ordinal(i + 1)} ${pct(x, 0)}`).join(' · '), `${num(pay.pot)} / ${num(pay.fee)} / ${pay.prizes.map((p) => num(p.amount)).join(' + ')}`]
    }) },
    { t: 'p', txt: `Treino (quando o Ouro não cobre ${num(minE)}): sem entrada, ${lista(F.treinoOuro.map((x, i) => `${ordinal(i + 1)} ${x}`))} de Ouro.` },
    { t: 'h3', txt: 'Outros preços' },
    { t: 'dl', itens: [
      ['Vaga extra no estábulo', `${num(BR.stableSlotPrice)} de Ouro (de ${BR.stableSlotsStart} até ${BR.stableSlotsMax} vagas)`],
      ['Pedra Negra', `${num(EG.stonePrice)} de Ouro (pacote de ${EG.stoneBundle}: ${num(EG.stonePrice * EG.stoneBundle)})`],
      ['Peças', `${gearRar.filter((r) => gearIds.some((id) => peca(id).rarity === r && peca(id).shop)).map((r) => `${nomeRar(r)} ${num(EG.price[r])}`).join(' · ')}; venda a ${pct(EG.sellRate, 0)}`],
      ['Cruza', `aluguel ${num(Math.min(...alugaveis.map((h) => B.rentalPrice(h))))} a ${num(Math.max(...alugaveis.map((h) => B.rentalPrice(h))))}; registro ${num(BR.ownRegistration)}; Troca ${num(BR.exchange)}`]
    ] },
    { t: 'h3', txt: 'Poder e ligas', id: 'poder' },
    { t: 'p', txt: 'O **Poder** resume a montaria com o equipamento: soma ponderada dos status efetivos + skills + pontos de conjunto. Ele define a liga e os rivais da sala.' },
    { t: 'formula', txt: `Poder = ${G.STAT_KEYS.map((k) => `${num(T.ratingW[k], 2)}·${siglaStat(k)}`).join(' + ')}
      + 20 × peso do gatilho, por skill
      + ${EG.setBonus.pieces.map((n, i) => `${EG.setBonus.ratingPts[i]} (${n} peças)`).join(' / ')} de conjunto` },
    { t: 'tabela', rotulo: 'Peso do gatilho', titulo: 'Peso do gatilho no Poder', cab: ['Gatilho', 'Peso', 'Pontos por skill'], linhas: Object.keys(pesos).map((t) => [t === 'weather:*' ? 'Clima (qualquer)' : descreverGatilho(t), N(num(pesos[t], 2)), N(num(pesos[t] * 20))]) },
    { t: 'tabela', rotulo: 'Ligas', cab: ['Liga', 'Poder', 'Cor'], linhas: G.LEAGUES.map((L) => { const f = S.leagueFor(L.min); return [{ md: L.name, html: `<span class="liga" style="--c:${L.color}">${esc(L.name)}</span>` }, N(f.max == null ? `${num(L.min)} ou mais` : `${num(L.min)}–${num(f.max)}`), { md: L.color, html: `<code>${L.color}</code>` }] }) },
    { t: 'p', txt: `**Rivais da sala:** cada bot mira um Poder entre ${sinalPct(F.botAlvo[0] - 1, 1)} e ${sinalPct(F.botAlvo[0] + F.botAlvo[1] - 1, 1)} do seu (leve viés para cima) e entra se ficar a até ${pct(F.botFaixa, 0)} do alvo; nenhum bot usa o modelo de uma montaria que você tem.` },
    { t: 'tabela', rotulo: 'Poder das iniciais', titulo: 'Poder das iniciais', cab: ['Montaria', 'Nv 1 sem peças', 'Nv 1 com o equipamento inicial', `Nv ${E.maxLevel} sem peças`], linhas: G.STARTERS.map((h) => [h.name, N(num(S.powerRating(h, null))), N(num(S.powerRating(h, ini))), N(num(S.powerRating({ ...h, level: E.maxLevel }, null)))]) }
  ])

  // 13. Modo DEV -----------------------------------------------------------------------------------------
  add('dev', 'Modo DEV', 'Modo DEV', [
    { t: 'p', txt: `Para testar: abra \`prototype/dist/preview.html?dev=1\` ou o build de teste \`prototype/dist/jogo-dev.html\` (liga sozinho; é o que vai para o artefato, que não repassa \`?dev=1\`). O save é separado (\`${DV.SAVE_KEY}\`): o jogo real não é lido nem gravado.` },
    { t: 'dl', itens: [
      ['Moedas', `Ouro infinito (volta a ${num(DV.GOLD_INF)} depois de cada gasto) e Pedras Negras à vontade.`],
      ['Cavalo', `cria ou substitui um cavalo com qualquer elemento, raridade, sexo, level (1–${E.maxLevel}), potencial e até ${F.devVagas} skills (inclusive exclusivas); copia iniciais e aluguéis; +10 levels; +1 cruza.`],
      ['Itens', 'qualquer peça do catálogo, inclusive Lendária, com qualquer melhoria; conjunto completo de uma vez.'],
      ['Próxima corrida', 'clima inicial, piso, distância, traçado (mais curvas, mais subidas ou lista de blocos), vento, seed e "skills sempre ativam".'],
      ['Perfil', 'zerar o perfil de teste (volta à Brasa).']
    ] }
  ])

  return SEC
}

// ---------------------------------------------------------------------------------------------------------
// Montarias (Markdown e cartões HTML)
// ---------------------------------------------------------------------------------------------------------
function infoMontaria(h, F) {
  const st = S.computeStats(h, null)
  const poder = S.powerRating(h, null)
  const liga = S.leagueFor(poder)
  const aluguel = B.rentalPrice(h)
  const inicial = G.STARTERS.indexOf(h) >= 0
  const onde = []
  if (inicial) onde.push('montaria inicial', 'bot nas corridas (quando não é a sua)')
  else {
    onde.push('bot nas corridas')
    if (aluguel != null) onde.push(`aluguel no Haras (${num(aluguel)} de Ouro)`)
    if (F.vitrine.indexOf(h.id) >= 0) onde.push('vitrine da Expedição')
  }
  return { st, poder, liga, aluguel, onde, inicial, cruzas: h.breedLeftMax || G.BREED_LEFT[h.sex] }
}
const sexoTxt = (s) => (s === 'f' ? '♀ fêmea' : s === 'm' ? '♂ macho' : (() => { throw new Error(`wiki: sexo desconhecido "${s}"`) })())
function montariasMd(F) {
  const grupos = [['Iniciais', G.STARTERS], ['Selvagens', G.WILD_HORSES]]
  return grupos.map(([tit, lista_]) => `### ${tit} (${lista_.length})\n\n` + lista_.map((h) => {
    const i = infoMontaria(h, F)
    const cab = [`#### ${h.name}${h.title ? ' — ' + h.title : ''}`, '',
      `${nomeEl(h.element)} · ${nomeRar(h.rarity)} · ${estrelas(h.grau || 2)} · ${sexoTxt(h.sex)} · Nv ${h.level} · Poder ${num(i.poder)} (${i.liga.name}) · ${i.cruzas} cruza(s)`, '',
      [h.bio, h.habitat ? `Habitat: ${h.habitat}.` : '', h.lore].filter(Boolean).join(' '), '',
      `Skills: ${h.skills.length ? h.skills.map(nomeSkill).join(', ') : 'nenhuma'} · Onde aparece: ${i.onde.join(', ')}`, '']
    const tab = blocoMd({ t: 'tabela', cab: ['', ...G.STAT_KEYS.map(siglaStat)], linhas: [
      ['Base (Nv 1)', ...G.STAT_KEYS.map((k) => N(String(h.base[k])))],
      ['Potencial (oculto no jogo)', ...G.STAT_KEYS.map((k) => N(String(h.potential[k])))],
      [`No Nv ${h.level}`, ...G.STAT_KEYS.map((k) => N(String(i.st[k])))]
    ] })
    return cab.filter((x, j) => x !== '' || j > 0).join('\n') + '\n' + tab
  }).join('\n\n')).join('\n\n')
}
function montariasHtml(F) {
  const grupos = [['iniciais', 'Iniciais', G.STARTERS], ['selvagens', 'Selvagens', G.WILD_HORSES]]
  return grupos.map(([gid, tit, lista_]) => `<section class="grupo" data-grupo="montaria"><h3 id="montarias-${gid}">${tit} <span class="conta">${lista_.length}</span></h3><div class="cartoes cartoes--montarias">` + lista_.map((h) => {
    const i = infoMontaria(h, F)
    const texto = [h.bio, h.habitat ? `Habitat: ${h.habitat}.` : '', h.lore].filter(Boolean).join(' ')
    return `<article${entradaAttrs({ id: 'montaria-' + h.id, tipo: 'montaria', busca: [h.name, nomeEl(h.element), nomeRar(h.rarity), h.title || '', h.habitat || '', 'montaria cavalo'], el: h.element, rar: h.rarity })}>` +
      `<div class="mont-cabeca"><canvas class="retrato" data-montaria="${esc(h.id)}" width="${F.retrato[0] * F.retratoEscala}" height="${F.retrato[1] * F.retratoEscala}" role="img" aria-label="${esc('Retrato de ' + h.name)}"></canvas>` +
      `<div class="mont-info"><h4>${esc(h.name)}</h4>${h.title ? `<p class="mont-titulo">${esc(h.title)}</p>` : ''}` +
      `<p class="selos">${elCel(h.element).html}${rarCel(h.rarity).html}<span class="selo">${estrelas(h.grau || 2)}</span><span class="selo">${sexoTxt(h.sex)}</span><span class="selo">Nv ${h.level}</span></p>` +
      `<p class="mont-poder">Poder <b>${num(i.poder)}</b> <span class="liga" style="--c:${i.liga.color}">${esc(i.liga.name)}</span></p></div></div>` +
      (texto ? `<p class="mont-bio">${esc(texto)}</p>` : '') +
      `<div class="rolagem" tabindex="0" role="region" aria-label="${esc('Status de ' + h.name)}"><table class="mont-status"><thead><tr><th scope="col"><span class="sr">Linha</span></th>${G.STAT_KEYS.map((k) => `<th scope="col" class="n" title="${esc(nomeStat(k))}">${esc(siglaStat(k))}</th>`).join('')}</tr></thead><tbody>` +
      `<tr><th scope="row">Base</th>${G.STAT_KEYS.map((k) => `<td class="n">${h.base[k]}</td>`).join('')}</tr>` +
      `<tr class="oculto"><th scope="row">Potencial <small>oculto no jogo</small></th>${G.STAT_KEYS.map((k) => `<td class="n">${h.potential[k]}</td>`).join('')}</tr>` +
      `<tr><th scope="row">No Nv ${h.level}</th>${G.STAT_KEYS.map((k) => `<td class="n">${i.st[k]}</td>`).join('')}</tr></tbody></table></div>` +
      `<dl class="pares pares--mont"><dt>Skills</dt><dd>${h.skills.length ? h.skills.map((id) => `<a class="skill-chip" href="#skill-${id}">${esc(nomeSkill(id))}</a>`).join(' ') : 'nenhuma'}</dd>` +
      `<dt>Cruzas</dt><dd>${i.cruzas}</dd><dt>Onde aparece</dt><dd>${esc(i.onde.join(', '))}</dd></dl></article>`
  }).join('') + `</div></section>`).join('') + `<p class="vazio" data-vazio="montaria" hidden>Nenhuma montaria casa com a busca e os filtros.</p>`
}

// ---------------------------------------------------------------------------------------------------------
// Página HTML
// ---------------------------------------------------------------------------------------------------------
const CSS = `
:root {
  /* Layout: coluna lateral fixa (busca, filtros e índice) + coluna de leitura; no celular, faixa de atalhos
     presa no topo e busca acima do conteúdo. Identidade do jogo: noite verde-escura, painéis, ouro. */
  color-scheme: dark;
  --noite: #0f1c17; --noite-2: #0b1611; --painel: #16271f; --painel-2: #1e3329; --painel-3: #284438;
  --linha: #335446; --sombra: #060d0a;
  --texto: #f1e9d4; --texto-2: #b3c2b2; --texto-3: #95a99b; --tinta: #1a1405;
  --ouro: #f2c230; --ouro-claro: #ffe27a; --ouro-escuro: #9c7210; --foco: #62e6ff;
  --fogo: #ff8a4c; --agua: #62b8ff; --grama: #86d86a; --neutro: #cfc8b4;
  --tabua: #243a31; --palha: #a5823f; --palha-2: #6f5526; --escuro-25: rgb(0 0 0 / 0.25);
  --fonte-display: 'Press Start 2P', ui-monospace, 'Courier New', monospace;
  --fonte-rotulo: 'Jersey 10', 'Arial Narrow', 'Roboto Condensed', system-ui, sans-serif;
  --fonte-texto: 'Atkinson Hyperlegible', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --fonte-mono: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  --t-texto: 1.0625rem; --t-pequeno: 0.9375rem; --t-rotulo: 1.375rem; --t-num: 1.375rem;
  --gl: max(16px, env(safe-area-inset-left, 0px));
  --gr: max(16px, env(safe-area-inset-right, 0px));
  --topo: env(safe-area-inset-top, 0px);
  RARIDADES
}
* { box-sizing: border-box; }
html { background: var(--noite); }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
body {
  margin: 0; background-color: var(--noite); color: var(--texto);
  background-image: linear-gradient(var(--noite-2) 2px, transparent 2px), linear-gradient(90deg, var(--noite-2) 2px, transparent 2px);
  background-size: 100% 32px, 128px 32px;
  font: 400 var(--t-texto)/1.6 var(--fonte-texto);
  -webkit-font-smoothing: antialiased;
}
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--noite-2); }
[hidden] { display: none !important; }
:focus-visible { outline: 3px solid var(--foco); outline-offset: 2px; }
a { color: var(--ouro-claro); text-underline-offset: 3px; }
code { font-family: var(--fonte-mono); font-size: 0.88em; background: var(--noite-2); border: 1px solid var(--linha); padding: 0 4px; color: var(--texto); overflow-wrap: anywhere; }
strong, b { font-weight: 700; color: var(--texto); }
img.ic { width: 16px; height: 16px; image-rendering: pixelated; vertical-align: -2px; flex: none; }
canvas { image-rendering: pixelated; image-rendering: crisp-edges; display: block; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.wiki { padding-left: var(--gl); padding-right: var(--gr); padding-block: 20px 64px; max-width: 1360px; margin: 0 auto; }
.topo { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; padding-block: 8px 20px; border-bottom: 2px solid var(--linha); margin-bottom: 24px; }
.topo-marca { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.topo h1 { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; font: 400 16px/1.5 var(--fonte-display); color: var(--ouro); text-shadow: 3px 3px 0 var(--sombra); }
.topo h1 img { height: 44px; width: auto; image-rendering: pixelated; max-width: 100%; }
.topo-sub { margin: 0; font-size: var(--t-pequeno); color: var(--texto-2); }
.topo-numeros { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0; padding: 0; list-style: none; font: 400 var(--t-rotulo)/1 var(--fonte-rotulo); color: var(--texto-2); }
.topo-numeros b { font-weight: 400; color: var(--ouro); font-variant-numeric: tabular-nums; }

.corpo { display: grid; grid-template-columns: 268px minmax(0, 1fr); gap: 32px; align-items: start; }
.lateral { position: sticky; top: var(--topo); max-height: calc(100vh - var(--topo)); overflow-y: auto; display: flex; flex-direction: column; gap: 18px; padding-block: 4px 16px; scrollbar-width: thin; }
.ferramentas { display: flex; flex-direction: column; gap: 12px; background: var(--painel); border: 2px solid var(--linha); box-shadow: 4px 4px 0 var(--sombra); padding: 14px; }
.ferramentas label { font: 400 var(--t-rotulo)/1 var(--fonte-rotulo); color: var(--texto-2); }
#busca { width: 100%; font: 400 var(--t-texto)/1.3 var(--fonte-texto); color: var(--texto); background: var(--noite-2); border: 2px solid var(--linha); padding: 8px 10px; border-radius: 0; }
#busca::placeholder { color: var(--texto-3); }
.filtro { display: flex; flex-direction: column; gap: 6px; border: 0; margin: 0; padding: 0; min-width: 0; }
.filtro legend { font: 400 var(--t-rotulo)/1 var(--fonte-rotulo); color: var(--texto-2); padding: 0; margin-bottom: 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font: 400 1.125rem/1 var(--fonte-rotulo); color: var(--texto); background: var(--painel-2); border: 2px solid var(--linha); padding: 5px 8px 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; border-radius: 0; }
.chip:hover { border-color: var(--texto-3); }
.chip[aria-pressed="true"] { background: var(--ouro); border-color: var(--ouro); color: var(--tinta); }
.filtro-nota { margin: 0; font-size: var(--t-pequeno); color: var(--texto-3); line-height: 1.45; }
#busca-resultado { margin: 0; font-size: var(--t-pequeno); color: var(--texto-2); line-height: 1.45; min-height: 1.45em; }
#busca-resultado.sem { color: var(--fogo); }
.indice ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.indice a { display: block; text-decoration: none; color: var(--texto-2); font: 400 var(--t-rotulo)/1.1 var(--fonte-rotulo); padding: 5px 10px; border-left: 3px solid transparent; }
.indice a:hover { color: var(--texto); background: var(--painel); }
.indice a[aria-current="true"] { color: var(--ouro); border-left-color: var(--ouro); background: var(--painel); }

main { min-width: 0; display: flex; flex-direction: column; gap: 56px; }
.secao { scroll-margin-top: calc(var(--topo) + 16px); display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.secao > * { margin: 0; }
.secao h2 { font: 400 18px/1.5 var(--fonte-display); color: var(--ouro); text-shadow: 3px 3px 0 var(--sombra); text-wrap: balance; padding-bottom: 10px; border-bottom: 2px dashed var(--linha); margin-bottom: 4px; }
.secao h3 { font: 400 1.875rem/1.1 var(--fonte-rotulo); color: var(--texto); margin-top: 18px; text-wrap: balance; display: flex; align-items: center; gap: 8px; scroll-margin-top: calc(var(--topo) + 16px); }
.secao h3 img.ic { width: 24px; height: 24px; }
.secao h4 { font: 400 1.5rem/1.1 var(--fonte-rotulo); color: var(--ouro-claro); margin-top: 8px; }
.secao p, .secao li, .secao dd { max-width: 70ch; }
.secao ul, .secao ol { margin: 0; padding-left: 1.4em; display: flex; flex-direction: column; gap: 6px; }
ol.passos li::marker { font-family: var(--fonte-rotulo); font-size: 1.25rem; color: var(--ouro); }
.nota { background: var(--painel); border: 2px dashed var(--ouro-escuro); padding: 10px 14px; color: var(--texto-2); max-width: 70ch; }
.conta { font: 400 1.25rem/1 var(--fonte-rotulo); color: var(--tinta); background: var(--texto-3); padding: 3px 6px 2px; }
pre.formula { font: 400 0.95rem/1.55 var(--fonte-mono); color: var(--ouro-claro); background: var(--noite-2); border: 2px solid var(--linha); padding: 12px 14px; margin: 0; overflow-x: auto; white-space: pre; max-width: 100%; }
dl.pares { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 14px; margin: 0; }
dl.pares dt { font: 400 var(--t-rotulo)/1.15 var(--fonte-rotulo); color: var(--texto-2); }
dl.pares dd { margin: 0; min-width: 0; }

.tabela { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.tabela-titulo { font: 400 var(--t-rotulo)/1.1 var(--fonte-rotulo); color: var(--texto-2); }
.rolagem { overflow-x: auto; max-width: 100%; border: 2px solid var(--linha); background: var(--painel); box-shadow: 4px 4px 0 var(--sombra); }
table { border-collapse: collapse; width: 100%; font-size: var(--t-pequeno); line-height: 1.45; }
thead th { font: 400 1.1875rem/1.1 var(--fonte-rotulo); color: var(--texto-2); text-align: left; background: var(--painel-2); padding: 8px 10px; border-bottom: 2px solid var(--linha); vertical-align: bottom; }
tbody th, tbody td { padding: 7px 10px; border-bottom: 1px solid var(--linha); vertical-align: top; text-align: left; }
tbody th { font-weight: 700; color: var(--texto); }
tbody tr:nth-child(even) { background: var(--painel-2); }
tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
th.n, td.n { text-align: right; white-space: nowrap; }
.cu { white-space: nowrap; }
.cl { min-width: 24ch; }
thead th { white-space: nowrap; }
td.n, tbody th.n { font: 400 var(--t-num)/1.1 var(--fonte-rotulo); font-variant-numeric: tabular-nums; color: var(--texto); }
.catalogo td:nth-child(2), .catalogo td:nth-child(3) { white-space: nowrap; }
.grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.grade-item { display: grid; grid-template-columns: 1fr auto; gap: 0 8px; background: var(--painel); border: 2px solid var(--linha); padding: 6px 10px; font: 400 1.125rem/1.15 var(--fonte-rotulo); }
.grade-item .g0 { grid-column: 1 / -1; color: var(--texto-2); }
.grade-item .g1 { color: var(--ouro); font-size: 1.375rem; font-variant-numeric: tabular-nums; }
.grade-item .g1::after { content: " XP"; font-size: 1rem; color: var(--texto-3); }
.grade-item .g2 { color: var(--texto-3); text-align: right; align-self: end; font-variant-numeric: tabular-nums; }
.grade-item .g2::before { content: "acum. "; }

.el, .rar, .slot, .ouro, .selo, .liga { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.el { font-weight: 700; }
.el--fogo { color: var(--fogo); } .el--agua { color: var(--agua); } .el--grama { color: var(--grama); } .el--neutro { color: var(--neutro); }
.rar { font: 400 1.125rem/1 var(--fonte-rotulo); color: var(--tinta); background: var(--c, var(--texto-3)); padding: 3px 6px 2px; }
.rar--comum { --c: var(--r-comum); } .rar--magico { --c: var(--r-magico); } .rar--raro { --c: var(--r-raro); } .rar--lendario { --c: var(--r-lendario); } .rar--mitico { --c: var(--r-mitico); }
.rar--raro, .rar--mitico, .rar--magico { color: var(--texto); }
.ouro { color: var(--ouro); font-family: var(--fonte-rotulo); font-size: var(--t-num); line-height: 1; }
.amostra { display: inline-block; width: 14px; height: 14px; background: var(--c); border: 2px solid var(--sombra); vertical-align: -2px; margin-right: 6px; }
.liga { font: 400 1.125rem/1 var(--fonte-rotulo); color: var(--c); border: 2px solid var(--c); padding: 2px 6px 1px; }

.grupo { display: flex; flex-direction: column; gap: 12px; }
.cartoes { display: grid; gap: 14px; }
.cartoes--skills { grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); }
.cartoes--montarias { grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr)); }
article.entrada { background: var(--painel); border: 2px solid var(--linha); box-shadow: 4px 4px 0 var(--sombra); padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; scroll-margin-top: calc(var(--topo) + 16px); }
article.entrada:target { border-color: var(--ouro); }
article.entrada header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 10px; }
article.entrada h4 { margin: 0; font: 400 12px/1.6 var(--fonte-display); color: var(--texto); }
.desc { margin: 0; color: var(--texto-2); }
.pares--skill, .pares--mont { font-size: var(--t-pequeno); line-height: 1.45; }
.pares--skill dt, .pares--mont dt { font-size: 1.125rem; }
dd.num { font: 400 var(--t-num)/1 var(--fonte-rotulo); color: var(--ouro); }
.balao { font: 400 9px/1 var(--fonte-display); color: var(--tinta); background: var(--texto); padding: 4px 6px; border: 2px solid var(--sombra); display: inline-block; }
.mont-cabeca { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
.retrato { width: 144px; height: 108px; max-width: 100%; border: 2px solid var(--sombra); background: var(--painel-2); flex: none; }
.mont-info { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1 1 160px; }
.mont-info h4 { margin: 0; }
.mont-titulo { margin: 0; color: var(--ouro-claro); font: 400 1.25rem/1.1 var(--fonte-rotulo); }
.selos { margin: 0; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
.selo { font: 400 1.125rem/1 var(--fonte-rotulo); color: var(--texto-2); }
.mont-poder { margin: 0; font: 400 1.25rem/1 var(--fonte-rotulo); color: var(--texto-2); display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; }
.mont-poder b { font-weight: 400; color: var(--ouro); font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.mont-bio { margin: 0; color: var(--texto-2); font-size: var(--t-pequeno); }
.mont-status { font-size: var(--t-pequeno); }
.mont-status thead th { padding: 6px 7px; }
.mont-status tbody th { font-weight: 400; font-family: var(--fonte-rotulo); font-size: 1.125rem; color: var(--texto-2); white-space: nowrap; padding: 5px 8px; }
.mont-status tbody th small { display: block; font-size: 0.85rem; color: var(--texto-3); }
.mont-status td.n { padding: 5px 7px; font-size: 1.25rem; }
.mont-status tr.oculto td { color: var(--texto-3); }
#busca-resultado a { color: var(--ouro-claro); }
.skill-chip { font: 400 1.125rem/1 var(--fonte-rotulo); color: var(--texto); background: var(--painel-3); border: 2px solid var(--linha); padding: 3px 6px 2px; text-decoration: none; display: inline-block; margin: 0 2px 4px 0; }
.skill-chip:hover { border-color: var(--ouro); }
.vazio { background: var(--painel); border: 2px dashed var(--linha); padding: 12px 14px; color: var(--texto-2); }
.rodape { margin-top: 48px; padding-top: 16px; border-top: 2px solid var(--linha); color: var(--texto-3); font-size: var(--t-pequeno); }

@media (max-width: 900px) {
  .corpo { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .lateral { display: contents; }
  .indice { order: -1; position: sticky; top: var(--topo); z-index: 5; background: var(--noite-2); border-bottom: 2px solid var(--linha); margin-inline: calc(-1 * var(--gl)) calc(-1 * var(--gr)); }
  .indice ol { flex-direction: row; overflow-x: auto; gap: 0; padding-left: var(--gl); padding-right: var(--gr); scrollbar-width: none; }
  .indice a { white-space: nowrap; border-left: 0; border-bottom: 3px solid transparent; padding: 10px 10px 8px; }
  .indice a[aria-current="true"] { border-bottom-color: var(--ouro); }
  .secao, .secao h3, article.entrada { scroll-margin-top: calc(var(--topo) + 60px); }
  main { gap: 44px; }
}
@media (max-width: 480px) {
  .secao h2 { font-size: 14px; }
  .topo h1 { font-size: 13px; }
  .mont-status thead th { padding: 5px 4px; }
  .mont-status td.n { padding: 4px 4px; font-size: 1.125rem; }
  .mont-status tbody th { padding: 4px 6px; }
  dl.pares { grid-template-columns: minmax(0, 1fr); gap: 2px 0; }
  dl.pares dd { margin-bottom: 6px; }
}
`

const JS_PAGINA = `
(function () {
  'use strict';
  // ---- retratos: o motor do jogo (Sprites.drawHorse) numa baia; com moldes do PixelLab quando carregam ----
  var DADOS = window.__WIKI_MONTARIAS || {};
  var PW = DADOS.w, PH = DADOS.h, ESC = DADOS.escala;
  function cor(nome) { return getComputedStyle(document.documentElement).getPropertyValue(nome).trim(); }
  function baia(ctx, k, seed) {
    ctx.fillStyle = cor('--painel-2'); ctx.fillRect(0, 0, PW * k, PH * k);
    ctx.fillStyle = cor('--tabua');
    for (var y = 5; y < 31; y += 6) ctx.fillRect(0, y * k, PW * k, k);
    for (var row = 0; row < 5; row++) {
      var off = (row * 13 + seed * 7) % 17;
      for (var x = off; x < PW; x += 17) ctx.fillRect(x * k, (row * 6 + 6) * k, k, 5 * k);
    }
    ctx.fillStyle = cor('--palha-2'); ctx.fillRect(0, 31 * k, PW * k, (PH - 31) * k);
    ctx.fillStyle = cor('--palha');
    for (var i = 0; i < 26; i++) { var px = (i * 11 + seed * 5) % PW, py = 32 + (i * 7) % (PH - 32); ctx.fillRect(px * k, py * k, 2 * k, k); }
    ctx.fillStyle = cor('--escuro-25'); ctx.fillRect(0, 31 * k, PW * k, k);
  }
  function desenhaRetratos() {
    if (!window.Sprites) return;
    var r = Math.max(1, window.devicePixelRatio || 1), k = Math.max(1, Math.round(ESC * r));
    var cs = document.querySelectorAll('canvas[data-montaria]');
    for (var i = 0; i < cs.length; i++) {
      var cv = cs[i], h = DADOS.lista[cv.getAttribute('data-montaria')];
      if (!h) continue;
      cv.width = PW * k; cv.height = PH * k;
      var ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      var seed = (h.name.charCodeAt(0) || 0) + h.name.length * 3;
      baia(ctx, k, seed);
      try {
        window.Sprites.drawHorse(ctx, 5 * k, 1 * k, { palette: h.palette, element: h.element, idle: true, t: 0.5, scale: k, jockey: false, quadro: { topo: 0, base: PH * k } });
      } catch (e) { /* sem cavalo: fica a baia */ }
    }
  }
  desenhaRetratos();
  if (window.Sprites && window.__MOLDES) window.Sprites.loadMolds(window.__MOLDES, desenhaRetratos);

  // ---- busca e filtros ----
  var entradas = Array.prototype.slice.call(document.querySelectorAll('[data-entrada]'));
  var busca = document.getElementById('busca');
  var saida = document.getElementById('busca-resultado');
  var filtro = { el: '', rar: '' };
  var NOMES = { skill: ['skill', 'skills'], montaria: ['montaria', 'montarias'], peca: ['peça', 'peças'] };
  function norm(s) { return String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim(); }
  function aplica() {
    var q = norm(busca.value), termos = q ? q.split(/\\s+/) : [];
    var conta = {}, total = {};
    entradas.forEach(function (el) {
      var tipo = el.getAttribute('data-entrada'), txt = el.getAttribute('data-busca') || '';
      var ok = termos.every(function (t) { return txt.indexOf(t) >= 0; });
      if (ok && filtro.el) ok = el.getAttribute('data-el') === filtro.el;
      if (ok && filtro.rar && tipo !== 'skill') ok = el.getAttribute('data-rar') === filtro.rar;
      el.hidden = !ok;
      total[tipo] = (total[tipo] || 0) + 1;
      if (ok) conta[tipo] = (conta[tipo] || 0) + 1;
    });
    document.querySelectorAll('.grupo').forEach(function (g) {
      g.hidden = !g.querySelector('[data-entrada]:not([hidden])');
    });
    Object.keys(NOMES).forEach(function (tipo) {
      var v = document.querySelector('[data-vazio="' + tipo + '"]');
      if (v) v.hidden = !!conta[tipo];
    });
    var ativo = termos.length || filtro.el || filtro.rar;
    if (!ativo) { saida.textContent = 'Mostrando tudo.'; saida.classList.remove('sem'); return; }
    var partes = Object.keys(NOMES).filter(function (t) { return conta[t]; }).map(function (t) {
      return conta[t] + ' ' + NOMES[t][conta[t] === 1 ? 0 : 1];
    });
    if (partes.length) {
      saida.textContent = 'Encontrado: ' + partes.join(', ') + '. ';
      saida.classList.remove('sem');
      var vis = entradas.filter(function (e) { return !e.hidden; });
      vis.slice(0, 6).forEach(function (e, i) {
        var a = document.createElement('a'), h = e.querySelector('h4, strong, th');
        a.href = '#' + e.id; a.textContent = h ? h.textContent : e.id;
        if (i) saida.appendChild(document.createTextNode(' · '));
        saida.appendChild(a);
      });
      if (vis.length > 6) saida.appendChild(document.createTextNode(' …'));
    }
    else { saida.textContent = 'Nada encontrado. Tente o nome de uma skill, montaria ou peça, um elemento ou uma raridade.'; saida.classList.add('sem'); }
  }
  busca.addEventListener('input', aplica);
  document.querySelectorAll('[data-filtro]').forEach(function (b) {
    b.addEventListener('click', function () {
      var tipo = b.getAttribute('data-filtro'), val = b.getAttribute('data-valor');
      filtro[tipo] = val;
      document.querySelectorAll('[data-filtro="' + tipo + '"]').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      aplica();
    });
  });
  aplica();

  // ---- índice: marca a seção visível ----
  var links = Array.prototype.slice.call(document.querySelectorAll('.indice a'));
  var secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  var pedido = false;
  function marca() {
    pedido = false;
    var atual = 0;
    for (var i = 0; i < secs.length; i++) if (secs[i] && secs[i].getBoundingClientRect().top < 140) atual = i;
    links.forEach(function (a, i) { if (i === atual) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    var ativo = links[atual];
    var ol = ativo && ativo.parentNode && ativo.parentNode.parentNode;
    if (ol && ol.scrollWidth > ol.clientWidth) {
      var alvo = ativo.offsetLeft - (ol.clientWidth - ativo.offsetWidth) / 2;
      if (Math.abs(ol.scrollLeft - alvo) > 40) ol.scrollLeft = alvo;
    }
  }
  window.addEventListener('scroll', function () { if (!pedido) { pedido = true; requestAnimationFrame(marca); } }, { passive: true });
  window.addEventListener('hashchange', marca);
  marca();
})();
`

function paginaHtml(SEC, A, F) {
  const contagens = [
    [Object.keys(G.SKILLS).length, 'skills'],
    [G.STARTERS.length + G.WILD_HORSES.length, 'montarias'],
    [Object.keys(G.GEAR).length, 'peças'],
    [Object.keys(G.RARITIES).length, 'raridades'],
    [Object.keys(G.ELEMENTS).length, 'elementos']
  ]
  const rarTokens = Object.keys(G.RARITIES).map((r) => `--r-${r}: ${G.RARITIES[r].color};`).join(' ')
  const css = CSS.replace('RARIDADES', rarTokens).trim()
  const chip = (tipo, val, rot, extra = '') => `<button type="button" class="chip" id="filtro-${tipo}-${val || 'todos'}" data-filtro="${tipo}" data-valor="${val}" aria-pressed="${val === '' ? 'true' : 'false'}">${extra}${esc(rot)}</button>`
  const marca = A.marca && A.marca.logo
    ? `<img src="${A.marca.logo}" alt="Galope Elemental"${A.marca.w && A.marca.h ? ` width="${Math.round(A.marca.w * 44 / A.marca.h)}" height="44"` : ''}>`
    : ''
  const dadosMont = {
    w: F.retrato[0], h: F.retrato[1], escala: F.retratoEscala,
    lista: Object.fromEntries(todasMontarias().map((h) => [h.id, { name: h.name, element: h.element, palette: h.palette }]))
  }
  const sprites = fonte('src/sprites.js').trim().replace(/<\/script/gi, '<\\/script')
  return [
    '<title>Wiki do Galope Elemental</title>',
    '<meta name="claude:viewport-fit-sides" content="cover">',
    '<meta name="description" content="Referência do protótipo do Galope Elemental: status, level, raridades, elementos, skills, montarias, cruzamento, equipamento e economia, gerada do código.">',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Jersey+10&family=Press+Start+2P&display=swap">',
    `<style>\n${css}\n</style>`,
    '<div class="wiki">',
    `<header class="topo"><div class="topo-marca"><h1>${marca || 'Galope Elemental'}<span>Wiki</span></h1><p class="topo-sub">Referência do protótipo, gerada do código · dados <code>${esc(G.version)}</code></p></div>` +
      `<ul class="topo-numeros">${contagens.map(([n, r]) => `<li><b>${n}</b> ${r}</li>`).join('')}</ul></header>`,
    '<div class="corpo">',
    '<div class="lateral">',
    `<div class="ferramentas" role="search"><label for="busca">Buscar</label>` +
      `<input id="busca" type="search" placeholder="Skill, montaria ou peça" autocomplete="off" spellcheck="false">` +
      `<fieldset class="filtro"><legend>Elemento</legend><div class="chips">${chip('el', '', 'Todos')}${Object.keys(G.ELEMENTS).map((e) => chip('el', e, nomeEl(e), icone('el-' + e))).join('')}</div></fieldset>` +
      `<fieldset class="filtro"><legend>Raridade</legend><div class="chips">${chip('rar', '', 'Todas')}${Object.keys(G.RARITIES).map((r) => chip('rar', r, nomeRar(r))).join('')}</div></fieldset>` +
      `<p class="filtro-nota">A busca e os filtros valem para skills, montarias e peças. Elemento de peça = o do clima do conjunto; skills não têm raridade.</p>` +
      `<p id="busca-resultado" aria-live="polite"></p></div>`,
    `<nav class="indice" aria-label="Seções"><ol>${SEC.map((s) => `<li><a href="#${s.id}">${esc(s.curto)}</a></li>`).join('')}</ol></nav>`,
    '</div>',
    '<main>',
    ...SEC.map((s) => `<section class="secao" id="${s.id}" aria-labelledby="t-${s.id}"><h2 id="t-${s.id}">${esc(s.titulo)}</h2>\n${s.blocos.map(blocoHtml).join('\n')}\n</section>`),
    `<footer class="rodape"><p>Gerado de <code>prototype/src/</code> por <code>prototype/tools/wiki.mjs</code> (versão dos dados <code>${esc(G.version)}</code>). Para atualizar: <code>node prototype/build.mjs</code>.</p></footer>`,
    '</main>',
    '</div>',
    '</div>',
    `<script>\nwindow.__MOLDES = ${jsonJs(A.moldes)};\nwindow.__WIKI_MONTARIAS = ${jsonJs(dadosMont)};\n</script>`,
    `<script>\n/* src/sprites.js */\n${sprites}\n</script>`,
    `<script>${JS_PAGINA}</script>`,
    ''
  ].join('\n')
}

function paginaMd(SEC) {
  return [
    '# Wiki do Galope Elemental',
    '',
    `> Gerado de \`prototype/src/\` por \`prototype/tools/wiki.mjs\` (dados \`${G.version}\`). Não edite à mão: rode \`node prototype/build.mjs\`. Versão com retratos e busca: \`prototype/dist/wiki.html\`.`,
    '',
    '## Seções',
    '',
    ...SEC.map((s) => `- [${s.titulo}](#${s.id})`),
    '',
    ...SEC.map((s) => `<a id="${s.id}"></a>\n\n## ${s.titulo}\n\n${s.blocos.map(blocoMd).join('\n\n')}\n`),
    ''
  ].join('\n')
}

/** Gera o wiki inteiro. Determinístico: duas chamadas dão o mesmo { md, html }. */
export async function gerarWiki() {
  const F = lerFonte()
  const A = { moldes: await lerMoldes(PROTO, []), icones: await lerIcones(PROTO), marca: await lerMarca(PROTO) }
  ICONES = A.icones
  const SEC = secoes(F, A)
  const html = paginaHtml(SEC, A, F)
  for (const tag of [/<!doctype/i, /<html[\s>]/i, /<head[\s>]/i, /<body[\s>]/i]) {
    if (tag.test(html)) throw new Error(`wiki.html não pode conter ${tag}`)
  }
  return { md: paginaMd(SEC), html }
}

/** Grava os dois arquivos (ou só confere, com check = true). Devolve a lista de arquivos diferentes. */
export async function gravarWiki({ check = false } = {}) {
  const { md, html } = await gerarWiki()
  const difs = []
  for (const [arq, txt] of [[SAIDA_MD, md], [SAIDA_HTML, html]]) {
    const atual = existsSync(arq) ? readFileSync(arq, 'utf8') : null
    if (atual !== txt) difs.push(arq)
    if (!check) { mkdirSync(dirname(arq), { recursive: true }); writeFileSync(arq, txt) }
  }
  return { md, html, difs }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check')
  const { md, html, difs } = await gravarWiki({ check })
  const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB'
  if (check) {
    if (difs.length) { console.log('wiki desatualizado: ' + difs.join(', ') + ' (rode node prototype/tools/wiki.mjs)'); process.exit(1) }
    console.log('wiki em dia')
  } else {
    console.log(`docs/wiki.md          ${kb(md)}`)
    console.log(`dist/wiki.html        ${kb(html)}`)
  }
}
