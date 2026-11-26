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
import { ICONES_NOVOS, RESERVADOS } from './icones-catalogo.mjs'

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
const MK = require('../src/marcas.js')
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
  const game = 'src/game.js', sala = 'src/sala.js', sim = 'src/sim.js', breed = 'src/breed.js', fx = 'src/fx.js'
  const abas = extrair(game, /var ABAS = \[(.*)\];/, 'a lista ABAS')[1]
  // equipamento suspenso (bloco 1b): com GEAR_ON = false a Loja só vende itens (as peças e as Pedras ficam escondidas)
  // GEAR_ON liga as telas do equipamento (que só vale no treino AFK); GEAR_PVP, as peças na corrida valendo (desligado)
  const gearConst = extrair(game, /var GEAR_ON = (true|false), GEAR_PVP = (true|false);/, 'as constantes GEAR_ON e GEAR_PVP')
  const gearOn = gearConst[1] === 'true', gearPvp = gearConst[2] === 'true'
  const ventos = extrair(fx, /a < ([\d.]+) \? 'calmo' : a < ([\d.]+) \? 'brisa' : 'ventania'/, 'a distribuição do vento (RaceFx.wind)')
  const alvo = extrair(sala, /var target = e\.pr \* \(([\d.]+) \+ ([\d.]+) \* rng\(\)\)/, 'a faixa de Poder dos bots')
  return {
    treinoOuro: listaJs(extrair(game, /var TRAINING_GOLD = (\[[^\]]*\]);/, 'TRAINING_GOLD')[1]),
    treinoXpDiv: numDe(game, /xpGain = L\.training \? Math\.round\(xpBase \/ (\d+)\)/, 'a divisão do XP do treino'),
    vitrine: listaJs(extrair(game, /var WILD_SHOWCASE = (\[[^\]]*\]);/, 'WILD_SHOWCASE')[1]),
    abas: [...abas.matchAll(/rotulo: '([^']+)'/g)].map((m) => m[1]),
    gearOn,
    gearPvp,
    pistas: listaJs('[' + extrair(sala, /var NOMES_PISTA = \[([\s\S]*?)\];/, 'NOMES_PISTA')[1] + ']'),
    retrato: extrair(game, /var PORTRAIT_W = (\d+), PORTRAIT_H = (\d+);/, 'o tamanho do retrato').slice(1, 3).map(Number),
    retratoEscala: numDe(game, /var PORTRAIT_SCALE = (\d+);/, 'PORTRAIT_SCALE'),
    botAlvo: [Number(alvo[1]), Number(alvo[2])],
    botFaixa: numDe(sala, /c\.fit\.diff <= target \* ([\d.]+)/, 'a tolerância de Poder dos bots'),
    devVagas: numDe(game, /var DEV_SKILL_VAGAS = (\d+);/, 'DEV_SKILL_VAGAS'),
    botFaixaNivel: extrair(sala, /return \[Math\.max\(1, L0 - (\d+)\), Math\.min\(E\.maxLevel \|\| 50, L0 \+ (\d+)\)\];/, 'a faixa de level dos bots (levelBand)').slice(1, 3).map(Number),
    botReserva: numDe(sala, /\.sort\(function \(x, y\) \{ return x\.fit\.diff - y\.fit\.diff; \}\)\.slice\(0, (\d+)\);/, 'quantos modelos o bot considera sem candidato na faixa'),
    vento: { calmo: Number(ventos[1]), brisa: Number(ventos[2]) - Number(ventos[1]), ventania: 1 - Number(ventos[2]) },
    subidaForca: numDe(sim, /T\.hillDrain \* \(1 - ([\d.]+) \* nf\) \* hillDrainMult/, 'o alívio de Força no gasto da subida'),
    pelotaoMax: numDe(sim, /Math\.min\(neighbors, (\d+)\)/, 'o teto de vizinhos do pelotão'),
    cansouFalta: numDe(sim, /if \(rem > D \* ([\d.]+)\) ev\(t, i, 'cansou'/, 'a folga do evento "cansou"'),
    chegadaFreio: numDe(sim, /r\.v = Math\.max\(0, r\.v - (\d+) \* dt\)/, 'a frenagem depois da chegada'),
    elementoPotro: numDe(breed, /rng\(\) < ([\d.]+) \? ef : em/, 'o sorteio do elemento do potro'),
    sexoPotro: numDe(breed, /var sex = rng\(\) < ([\d.]+) \? 'f' : 'm'/, 'o sorteio do sexo do potro'),
    corcelDois: numDe(breed, /if \(g === 1 && rng\(\) < ([\d.]+)\) g = 2/, 'a chance de 2 skills garantidas do Corcel'),
    potValores: numDe(breed, /potential\[k\] = Math\.floor\(rng\(\) \* (\d+)\);/, 'a faixa do potencial sorteado'),
    potroPai: numDe(breed, /potential\[k\] = potOf\(rng\(\) < ([\d.]+) \? f : m, k\)/, 'a escolha do pai no potencial herdado'),
    notas: extrair(game, /function notaGenetica\(g\) \{ return g >= (\d+) \? 'S' : g >= (\d+) \? 'A' : g >= (\d+) \? 'B' : 'C'; \}/, 'as notas de genética (notaGenetica)').slice(1, 4).map(Number),
    moldePista: extrair(sim, /var c1 = corte\(([\d.]+)\), c2 = corte\(([\d.]+)\), c3 = corte\(([\d.]+)\), c4 = corte\(([\d.]+)\);/, 'o molde fixo da pista').slice(1, 5).map(Number),
    statMin: numDe(sim, /clamp\(Math\.round\(naturalStat\(horse, k\) \+ alloc\[k\]\), (\d+), T\.statMax\)/, 'o piso do status (computeStats)'),
    rankPiso: numDe(sim, /out\[k\] = Math\.max\(([\d.]+), 1 - \(1 - v\) \* f\)/, 'o piso do multiplicador de gasto no rank (skillEffect)'),
    redeasMax: numDe(game, /var REDEAS_MAX = (\d+);/, 'REDEAS_MAX'),
    devDiasMax: numDe(game, /var DEV_DIAS_MAX = (\d+);/, 'DEV_DIAS_MAX'),
    // os rótulos do botão de compra da loja de itens, por motivo (LOJA_ROTULO), na ordem em que o Itens.podeComprar confere
    lojaRotulo: Object.fromEntries([...extrair(game, /var LOJA_ROTULO = \{([^}]*)\};/, 'LOJA_ROTULO')[1].matchAll(/'?([\w-]+)'?: '([^']+)'/g)].map((m) => [m[1], m[2]]))
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
// rank em algarismo romano, como o jogo mostra (I a V hoje; vale até 39)
function romano(n) {
  if (!(Number.isInteger(n) && n >= 1 && n <= 39)) throw new Error('wiki: rank inválido: ' + n)
  return 'X'.repeat(Math.floor(n / 10)) + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n % 10]
}
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
const nomeEl = (id) => { if (id === 'geral') return 'Geral'; if (!G.ELEMENTS[id]) throw new Error(`wiki: elemento desconhecido "${id}"`); return G.ELEMENTS[id].name }
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
    case 'final': return `Começa a arrancada do cavalo (reta final): em ${pct(T.garraZone, 0)} da pista − ${pct(T.garraZoneK, 0)} × (n(GAR) − 0,5), mais cedo com mais Garra`
    case 'dice': return 'Antes do 1º Dado da Sorte (vale para todos os Dados da corrida)'
    default: throw new Error(`wiki: gatilho de skill desconhecido "${trigger}" — descreva-o em descreverGatilho (prototype/tools/wiki.mjs)`)
  }
}

/** Efeito de skill (objeto effect) em português, com os números. Lança erro em chave desconhecida. */
export function descreverEfeito(effect) {
  const partes = [], fim = []
  for (const k of Object.keys(effect || {})) {
    const v = effect[k]
    switch (k) {
      case 'accelMult': partes.push(`aceleração ${mult(v)} (${sinalPct(v - 1, 1)})`); break
      case 'speedMult': partes.push(`velocidade ${mult(v)} (${sinalPct(v - 1, 1)})`); break
      case 'drainMult': partes.push(`gasto de estamina ${mult(v)} (${sinalPct(v - 1, 1)})`); break
      case 'curveBonus': partes.push(`fator da curva ${sinalPct(v, 1)} (somado, teto 1)`); break
      case 'hillBonus': partes.push(`fator da subida ${sinalPct(v, 1)} (somado, teto 1)`); break
      case 'hillDrainMult': partes.push(`gasto extra da subida ${mult(v)} (${sinalPct(v - 1, 1)})`); break
      case 'staminaRestore': partes.push(`recupera ${pct(v, 1)} do tanque na hora`); break
      case 'garraBoostBonus': partes.push(`impulso da Garra ${'+' + pp(v, 1)}`); break
      case 'extraDice': partes.push(`${'+' + num(v)} dado no Dado da Sorte, de 1 a ${num(G.SKILL_RANKS.diceTeto[0])} (até o fim da corrida)`); break
      case 'weatherBonus': partes.push(`bônus do clima do próprio elemento ${multF(T.weatherMult)} → ${multF(T.weatherMult + v, 3)} (até o fim da corrida)`); break
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

/** Como o rank age em cada chave de effect (spec dos ranks §5.2): 'ajuda' 1 + (m − 1)·s; 'gasto' 1 − (1 − m)·s, com piso;
 * 'somado' e 'recupera' b·s; 'clima' b·s somado ao bônus do clima; 'dado' (fora da escala: teto do dado pelo rank);
 * 'fixo' (duração, distância e "em cada bloco" não crescem). Lança erro em chave desconhecida. */
export function formatoRank(k) {
  switch (k) {
    case 'speedMult': case 'accelMult': return 'ajuda'
    case 'drainMult': case 'hillDrainMult': return 'gasto'
    case 'curveBonus': case 'hillBonus': case 'garraBoostBonus': return 'somado'
    case 'staminaRestore': return 'recupera'
    case 'weatherBonus': return 'clima'
    case 'extraDice': return 'dado'
    case 'distanceM': case 'durationS': case 'blockScoped': return 'fixo'
    default: throw new Error(`wiki: chave de effect sem regra de rank "${k}" — classifique-a em formatoRank (prototype/tools/wiki.mjs)`)
  }
}
/** Nome curto de cada chave de effect, para a regra do rank por formato. Lança erro em chave desconhecida. */
export function nomeChaveEfeito(k) {
  switch (k) {
    case 'speedMult': return 'velocidade'
    case 'accelMult': return 'aceleração'
    case 'drainMult': return 'gasto de estamina'
    case 'hillDrainMult': return 'gasto extra da subida'
    case 'curveBonus': return 'fator da curva'
    case 'hillBonus': return 'fator da subida'
    case 'garraBoostBonus': return 'impulso da Garra'
    case 'staminaRestore': return 'recuperação de estamina'
    case 'weatherBonus': return 'reforço de clima'
    case 'extraDice': return 'dado extra'
    case 'distanceM': return 'distância'
    case 'durationS': return 'duração'
    case 'blockScoped': return '"em cada bloco"'
    default: throw new Error(`wiki: chave de effect sem nome "${k}" — nomeie-a em nomeChaveEfeito (prototype/tools/wiki.mjs)`)
  }
}
/** O valor que a regra escrita no wiki dá para uma chave num rank (sem o marco). */
function valorNoRank(k, v, r, piso) {
  const s = S.rankScale(r)
  switch (formatoRank(k)) {
    case 'ajuda': return 1 + (v - 1) * s
    case 'gasto': return Math.max(piso, 1 - (1 - v) * s)
    case 'somado': case 'recupera': case 'clima': return v * s
    default: return v
  }
}
/** Confere a regra escrita no wiki com o RaceSim.skillEffect, em toda skill, chave e rank antes do marco (o último rank
 * soma o marco de SKILLS[id].rank5). Lança erro se o sim.js passar a escalar de outro jeito. */
function conferirRegraDoRank(piso) {
  const K = G.SKILL_RANKS
  for (let r = 1; r <= K.max; r++) if (Math.abs(S.rankScale(r) - (1 + K.step * (r - 1))) > 1e-12) throw new Error(`wiki: RaceSim.rankScale(${r}) não é 1 + step × (r − 1) — atualize a regra do rank em prototype/tools/wiki.mjs`)
  for (const id of Object.keys(G.SKILLS)) {
    const base = G.SKILLS[id].effect || {}
    for (let r = 1; r < K.max; r++) {
      const e = S.skillEffect(id, r)
      for (const k of Object.keys(base)) {
        const esperado = valorNoRank(k, base[k], r, piso)
        const ok = typeof esperado === 'number' ? Math.abs(e[k] - esperado) < 1e-12 : e[k] === esperado
        if (!ok) throw new Error(`wiki: ${id}.${k} no rank ${r} é ${e[k]} no sim.js e ${esperado} pela regra do wiki — atualize formatoRank (prototype/tools/wiki.mjs)`)
      }
      if (base.extraDice && e.diceTeto !== K.diceTeto[r - 1]) throw new Error(`wiki: o teto do dado extra de ${id} no rank ${r} não é SKILL_RANKS.diceTeto`)
    }
  }
}

/** Efeito da skill de tipo (GameData.TYPE_SKILLS[el].effect) com a força P aplicada; el nomeia os dois status
 * do tipo (RaceSim.TYPE_STATS) no statMul. Lança erro em chave desconhecida. */
export function descreverEfeitoTipo(effect, P, el) {
  const partes = []
  for (const k of Object.keys(effect || {})) {
    const v = effect[k] * P
    switch (k) {
      case 'statMul': {
        const ks = S.TYPE_STATS[el]
        partes.push(`${ks ? lista(ks.map(nomeStat)) : 'os dois status do tipo'} ${mult(1 + v, 3)} (+${pct(v, 1)})`); break
      }
      case 'accelMult': partes.push(`aceleração +${pct(v, 0)}`); break
      case 'speedMult': partes.push(`velocidade +${pct(v, 1)}`); break
      case 'forcaAdd': partes.push(`Força efetiva +${num(v * 100, 1)}`); break
      case 'manAdd': partes.push(`Manobra efetiva +${num(v * 100, 1)}`); break
      case 'drainCut': partes.push(`gasto de estamina −${pct(v, 1)}`); break
      case 'staminaRestore': partes.push(`recupera ${pct(v, 1)} do tanque ao entrar no terço`); break
      default: throw new Error(`wiki: chave de efeito da skill de tipo desconhecida "${k}" — descreva-a em descreverEfeitoTipo (prototype/tools/wiki.mjs)`)
    }
  }
  if (!partes.length) throw new Error('wiki: skill de tipo sem efeito conhecido: ' + JSON.stringify(effect))
  return partes.join('; ')
}

/** Bônus especial de equipamento (Gear.resolve().special) em português. Lança erro em chave desconhecida. */
export function descreverEspecial(chave, valor) {
  switch (chave) {
    case 'weatherDoubleClimate': return valor ? `no clima ${nomeClima(valor)}, reforçaria o bônus do elemento dono para ${multF(T.weatherMultDouble)} (não acumula com a skill de clima: vale o maior)` : ''
    case 'ignoreWeatherPenalty': return valor ? `anula a penalidade de clima (${multF(2 - T.weatherMult)} vira ×1)` : ''
    default: throw new Error(`wiki: bônus especial de equipamento desconhecido "${chave}" — descreva-o em descreverEspecial (prototype/tools/wiki.mjs)`)
  }
}

/** Papel de cada status na corrida (fórmula resumida do sim.js). Lança erro em status desconhecido. */
export function papelDoStatus(k, F) {
  const n = (x) => num(x, 3)
  const ac = (x) => 1 / Math.max(T.aInvMin, T.aInv0 - T.aInv1 * x)
  switch (k) {
    case 'vel': return `Velocidade máxima: vMax = ${n(T.vBase)} + ${n(T.vRange)} × n(VEL) m/s (VEL 50 → ${num(T.vBase + T.vRange * 0.5)} m/s; VEL 100 → ${num(T.vBase + T.vRange)} m/s; VEL ${T.statMax} → ${num(T.vBase + T.vRange * T.statMax / 100)} m/s). Ritmo, piso, bloco e boosts multiplicam esse teto.`
    case 'acel': return `Aceleração = 1 / max(${n(T.aInvMin)}, ${n(T.aInv0)} − ${n(T.aInv1)} × n(ACE)) m/s² (ACE 50 → ${num(ac(0.5))}; ACE 100 → ${num(ac(1))}; ACE ${T.statMax} → ${num(ac(T.statMax / 100))}): cada ponto encurta a largada igual. Vale na largada e nas retomadas (saída de curva e de subida). Também encurta a reação à largada: atraso sorteado de até ${num(T.startDelayMax)} s × (1 − ${num(T.startAcelK, 3)} × min(n(ACE), ${num(T.startAcelMax)})).`
    case 'man': return `Fator da curva = min(1, ${n(T.curveBase)} + ${n(T.curveRange)} × n(MAN)): de ${pct(T.curveBase + T.curveRange * 0.5, 1)} (MAN 50) a ${pct(T.curveBase + T.curveRange * T.statMax / 100, 1)} (MAN ${T.statMax}) da velocidade dentro da curva.`
    case 'forca': return `Fator da subida = min(1, ${n(T.hillBase)} + ${n(T.hillRange)} × n(FOR)): de ${pct(T.hillBase + T.hillRange * 0.5, 1)} (FOR 50) a ${pct(T.hillBase + T.hillRange * T.statMax / 100, 1)} (FOR ${T.statMax}). Alivia o piso pesado (${pct(T.forcaSurfRelief, 0)} × n(FOR) da perda), o aperto do pelotão (${pct(T.forcaCrowdRelief, 0)} × n(FOR), até zerar) e o gasto extra da subida (+${pct(T.hillDrain, 0)} × (1 − ${num(F.subidaForca)} × n(FOR))).`
    case 'est': return `Tanque = ${n(T.poolBase)} + ${n(T.poolEst)} × n(EST) (EST 50 → ${num(T.poolBase + T.poolEst * 0.5)}). Também sobe o teto do ritmo: + ${pct(T.pace.midEst, 1)} × (n(EST) − 0,5) no meio e + ${pct(T.pace.spurtEst, 1)} × (n(EST) − 0,5) no sprint final, então rende mesmo com tanque de sobra. O clima não mexe na Estamina.`
    case 'garra': return `A arrancada começa em ${pct(T.garraZone, 0)} − ${pct(T.garraZoneK, 0)} × (n(GAR) − 0,5) da pista (GAR 50 → ${pct(T.garraZone, 0)}; GAR 100 → ${pct(T.garraZone - T.garraZoneK * 0.5, 0)}). Lá ela acontece **sempre**. A força média é F = ${num(T.garraBoostBase, 3)} + ${num(T.garraBoostRange, 3)} × n(GAR); a de cada corrida vai de ${pct(1 - T.garraSpread, 0)} a ${pct(1 + T.garraSpread, 0)} dela, pela seed, e o teto de velocidade vai a ×(1 + força) até a chegada. Mais Garra: começa antes e empurra mais.`
    case 'sorte': return `Vem do nascimento: não recebe pontos. No Dado da Sorte, a chance de rolar um 2º dado é (SOR − ${num(T.sorteDiceLo)}) / ${num(T.sorteDiceFull - T.sorteDiceLo)}, presa entre 0% e 100% (SOR ${num(T.sorteDiceLo)} → 0%; SOR ${num(T.sorteDiceFull)} → 100%). Não entra em mais nada: as skills ativam sempre, sem sorteio.`
    default: throw new Error(`wiki: status desconhecido "${k}" — descreva-o em papelDoStatus (prototype/tools/wiki.mjs)`)
  }
}

/** Fator de velocidade de cada tipo de bloco da pista. Lança erro em tipo desconhecido. */
export function descreverBloco(tipo, F) {
  switch (tipo) {
    case 'reta': return { fator: '1 (sem perda)', gasto: 'normal', mais: `Reta de ${num(T.straightMinM)} m ou mais (fora a da largada) dispara skills de reta.` }
    case 'curva': return { fator: `min(1, ${num(T.curveBase, 3)} + ${num(T.curveRange, 3)} × n(MAN) + bônus de skill) — ${pct(T.curveBase + T.curveRange * 0.5, 1)} (MAN 50) a ${pct(T.curveBase + T.curveRange * T.statMax / 100, 1)} (MAN ${T.statMax})`, gasto: 'normal', mais: 'Ao sair, a velocidade volta pela Aceleração.' }
    case 'subida': return { fator: `min(1, ${num(T.hillBase, 3)} + ${num(T.hillRange, 3)} × n(FOR) + bônus de skill) — ${pct(T.hillBase + T.hillRange * 0.5, 1)} (FOR 50) a ${pct(T.hillBase + T.hillRange * T.statMax / 100, 1)} (FOR ${T.statMax})`, gasto: `×(1 + ${num(T.hillDrain)} × (1 − ${num(F.subidaForca)} × n(FOR))), e o esforço não cai com a velocidade menor`, mais: 'Ao sair, a velocidade volta pela Aceleração.' }
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
    case 'Estábulo': return `o cartão da recompensa do dia, no topo; suas montarias (${BR.stableSlotsStart} vagas no começo, até ${BR.stableSlotsMax}), status, ${F.gearOn ? 'skills (com o rank de cada uma) e equipamento' : 'skills (com o rank de cada uma e o botão Subir rank) e a redistribuição dos pontos'}; escolher a ativa.`
    case 'Correr': return `escolher a entrada (${lista(E.entryTiers.map((t) => num(t)), 'ou')} de Ouro) e procurar corrida; sem Ouro para a menor entrada, treino gratuito.`
    case 'Expedição': {
      const g0 = G.GYMS[G.GYM_ORDER[0]]
      const ap = G.GYM.fadiga.faixas[0]
      return `os ${G.GYM_ORDER.length} ginásios (${lista(G.GYM_ORDER.map((id) => G.GYMS[id].name))}), cada um com quantas etapas já venceu ("N de ${g0.etapas.length} vencidos"), a insígnia conquistada e "Revanche hoje" quando a revanche do líder está livre (o ponto na aba avisa) ou "Revanche amanhã" depois de tentada a de hoje. ` +
        `Em cima, o mapa da ilha com os três ginásios no lugar deles, vivo (água, lava, nuvens, fumaça do vulcão), com névoa sobre o que ainda não tem a insígnia (só visual) e, em cada ginásio, o estandarte do líder, as etapas vencidas, a insígnia e "!" na revanche livre; tocar num ginásio do mapa é o mesmo que tocar no cartão dele, e a ida e a volta são uma viagem curta (aproximação e íris; direta com movimento reduzido). ` +
        `Tocar no ginásio abre a trilha: as ${g0.etapas.length} etapas de baixo para cima (${lista([...g0.etapas.filter((e) => !e.lider).map((e, i) => `Soldado ${i + 1}`), 'o Líder'])}), cada uma vencida, próxima (a única que se toca) ou fechada ("Vença a etapa anterior"), e o ponto fraco escrito ("Ponto fraco: ${G.ELEMENTS[g0.fraco].name} vence ${G.ELEMENTS[g0.element].name}"); ao abrir, a trilha rola o mínimo para a etapa que se pode tocar aparecer inteira. ` +
        `No mapa da trilha, a pista de terra está pintada até a etapa da vez e o seu cavalo ativo espera ao lado dela; depois de uma vitória, ao voltar para a trilha, a pista se pinta até a etapa nova e o cavalo trota até lá. ` +
        `**Preparo:** a etapa próxima mostra os cavalos do adversário (nível, estrelas, elemento e Poder), a pista da casa, a entrada e o prêmio da 1ª vitória; em "Seu time" você toca nos seus cavalos na ordem em que vão correr, até o tamanho do time do adversário (tocar de novo tira). Cada linha diz "Vantagem" ou "Desvantagem" contra o elemento do ginásio; com uma sala de corrida aberta (valendo ou treino), o cavalo ativo fica de fora, com o motivo escrito. ` +
        `**Pagar:** "Desafiar (N de Ouro)" cobra a entrada e só então o desafio é simulado; sem time, sem Ouro (o reservado para a sala aberta não conta) ou com a mochila cheia do item do prêmio, o botão fica apagado com o motivo. ` +
        `**Duelos:** cada duelo passa na tela de corrida, com 2 raias: a placa diz "Duelo N" (nunca quantos serão), e uma linha diz a vantagem de elemento e o fôlego de quem larga cansado; "Pular" termina o duelo (depois da chegada ele diz "Continuar") e "Pular tudo" vai direto ao resumo. Entre um duelo e outro, um cartão diz como foi o seu cavalo e por quantos metros, quem saiu e quem entra, a faixa do cansaço com o fôlego de quem ficou ("Vitória ${ap.name.toLowerCase()} (menos de 1 m): … larga com ${num(Math.round((1 - ap.perde) * 100))}% do fôlego") e a vantagem do próximo duelo, com "Próximo duelo" e "Pular tudo". Os metros são truncados para baixo (7,6 m aparece como 7 m); abaixo de 1 m, "menos de 1 m". ` +
        `**Resumo:** cada duelo com "Você venceu" ou "Você perdeu", os metros e o fôlego de quem seguiu; a entrada, o prêmio e os itens; o XP de cada cavalo (os níveis e as skills que aprendeu, ou "não correu"); a insígnia e a etapa liberada. Perdendo, "Tentar de novo" volta ao preparo com o mesmo time; sempre há "Voltar à trilha". ` +
        `**Revanche:** depois da insígnia, a etapa do líder vira a revanche, uma vez por dia: "Revanche hoje", com a entrada de ${num(G.GYM.revanche.entrada)} de Ouro e o prêmio de hoje do rodízio; tentada a de hoje, a etapa diz "Feita hoje" e "Revanche de hoje feita. Volte amanhã.", e a revanche perdida não tem "Tentar de novo". ` +
        `**Treino AFK:** na trilha, cada oponente já vencido tem "Treinar (AFK)", que abre a escolha do treino (oponente, dificuldade, vaga e cavalo). O cartão "Treino AFK" da aba abre as vagas (o cavalo, o oponente, a chance de vitória medida, a corrida em curso e a última; Assistir, Trocar e Tirar; "Abrir vaga" com o preço) e o baú ("Coletar tudo"); o cartão "Bestiário" abre as páginas dos ginásios (ver Corrida AFK). ` +
        `Embaixo, a vitrine de ${F.vitrine.length} cavalos selvagens (a captura ainda não existe no protótipo).`
    }
    case 'Haras': return 'cruzar com um reprodutor de aluguel ou com outra montaria sua, ou fazer a Troca.'
    case 'Loja': {
      const venda = G.SHOP_ORDER   // a ordem fixa da loja (Ruling 11)
      const itens = `em **Comprar**, os itens de uso (${lista(venda.map((id) => G.ITEMS[id].name))}) com Ouro, um toque por compra, dentro do limite do dia; em **Mochila**, os ${G.ITENS_USO.length} itens, quantos você tem de cada e o botão Usar (o ${G.ITEMS.pergaminho.name} não tem Usar: é gasto ao subir rank, na aba Skills do cavalo) e, embaixo, os itens do treino AFK por grupo (comidas, com o Usar e a escolha do cavalo; materiais; Pergaminho de reforja; troféus)`
      return F.gearOn ? `${itens}; também peças de equipamento (menos as de raridade ${lista([...new Set(Object.keys(G.GEAR).filter((id) => !G.GEAR[id].shop).map((id) => nomeRar(G.GEAR[id].rarity)))])}) e Pedras Negras.` : itens + '.'
    }
    default: throw new Error(`wiki: aba desconhecida "${rotulo}" — descreva-a em descreverAba (prototype/tools/wiki.mjs)`)
  }
}

/** O Perfil (o botão do cabeçalho, fora da barra de abas): o que a tela mostra, na ordem do renderPerfil do game.js. */
export function descreverPerfil() {
  const n = G.GYM_ORDER.length
  return `as estatísticas (corridas, vitórias, pódios e prêmios), o Ouro e quantas montarias você tem; as insígnias dos ginásios ("Insígnias (N de ${n})", as ${n} na ordem ${lista(G.GYM_ORDER.map((id) => G.GYMS[id].insignia.name))}: a conquistada com o ícone, o nome e o bônus; a que falta apagada, com "Vença o líder do …"); o seu jóquei (seda e capacete); as animações; e "Recomeçar com outro inicial".`
}

// ---------------------------------------------------------------------------------------------------------
// Cálculos derivados
// ---------------------------------------------------------------------------------------------------------
// Peso de cada skill no Poder: lido do export do sim.js (RaceSim.skillWeight / SKILL_TRIGGER_WEIGHT).
function pesoSkill(id) { return S.skillWeight(id) }
// teto e piso de cada status (computeStats prende o resultado entre o piso do fonte e TUNING.statMax)
function limitesStatus(F) {
  return { alto: T.statMax, baixo: F.statMin }
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
  const dist = new Map(), nb = new Map(), tipos = {}, pisos = {}, climas = {}, compos = {}, maxShare = {}
  let meio = 0
  for (const k of Object.keys(G.BLOCK_TYPES)) { tipos[k] = 0; compos[k] = 0; maxShare[k] = 0 }
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
    for (const k of Object.keys(compos)) { const x = S.blockShare(c.blocks, k); compos[k] += x / AMOSTRA; if (x > maxShare[k]) maxShare[k] = x }
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
  return { dMin: ds[0], dMax: ds[ds.length - 1], passo, bMin: bs[0], bMax: bs[bs.length - 1], tipos, meio, pisos, climas, primeiraUltima, compos, maxShare }
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
function icone(nome, alt = '', cls = 'ic', px = 16) {
  const src = ICONES[nome]
  return src ? `<img class="${cls}" src="${src}" alt="${esc(alt)}" width="${px}" height="${px}">` : ''
}
// No md o ícone é um link para o PNG da pasta (o md fica em docs/). Sem arquivo: só o nome, sem <img> nem link.
const DIR_ICONES_MD = '../prototype/assets/arte/icones/'
const icMd = (nome) => (ICONES[nome] ? `![](${DIR_ICONES_MD}${nome}.png) ` : '')
// célula "ícone + nome" (md e html); `html` = nome já formatado, se não for texto puro
const comIcone = (nome, txt, html) => ({ md: icMd(nome) + txt, html: icone(nome) + (html != null ? html : esc(txt)) })
const elCel = (id) => ({ md: nomeEl(id), html: `<span class="el el--${id}">${icone('el-' + id)}${esc(nomeEl(id))}</span>` })
const rarCel = (id, mdIcone = false) => ({ md: (mdIcone ? icMd('rar-' + id) : '') + nomeRar(id), html: `<span class="rar rar--${id}">${icone('rar-' + id)}${esc(nomeRar(id))}</span>` })
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
        const cls = (c, i) => (numCol[i] ? ' class="n"' : celMd(c).replace(/!\[\]\([^)]*\) /g, '').replace(/\*\*/g, '').length <= 26 ? ' class="cu"' : ' class="cl"')
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
  const lim = limitesStatus(F)
  const M = E.maxLevel
  // pontos e builds de exemplo (tudo do código: freePoints, costOf, weightedAlloc, botAlloc)
  const cav = (r, st, L, g, el) => { const h = { element: el || 'fogo', rarity: r, grau: st, level: L, potential: {}, skills: [] }; G.STAT_KEYS.forEach((k) => { h.potential[k] = g }); return h }
  const tudoNum = (h, k) => S.computeStats({ ...h, alloc: S.weightedAlloc(h, { [k]: 1 }) })[k]
  // o pior caso tem também o teto de torrões (cada torrão é 1 ponto a mais)
  const piorCaso = tudoNum({ ...cav('mitico', T.starMult.length, M, 31), torroes: G.ITEMS.torrao.cap }, 'vel')
  // de onde os ginásios dão cada item (GameData.GYMS e GYM.revanche): "na 1ª vitória sobre o Soldado 2 de cada ginásio e
  // no rodízio da revanche do líder"; '' se nenhum ginásio dá o item
  const etapaRot = (e, i) => e.lider ? 'o líder' : `o Soldado ${i + 1}`
  // o Pergaminho de técnica não vem em premio.itens: vem em premio.pergaminhos (a quantidade da etapa)
  const PG = G.ITEMS.pergaminho
  if (!PG || !Array.isArray(PG.podio)) throw new Error('wiki: GameData.ITEMS.pergaminho sem as chances do pódio (podio)')
  if (PG.cap !== G.BAG_MAX) throw new Error(`wiki: o teto do Pergaminho (ITEMS.pergaminho.cap = ${PG.cap}) é diferente do teto da mochila que o jogo usa (BAG_MAX = ${G.BAG_MAX})`)
  const pergEtapa = (e) => { const n = e.premio.pergaminhos || 0; if (!(Number.isInteger(n) && n >= 0)) throw new Error(`wiki: premio.pergaminhos inválido na etapa "${e.id}"`); return n }
  const pergTxt = (n) => `${num(n)} ${n === 1 ? PG.name : PG.plural}`
  const fonteGin = (id) => {
    const daEtapa = (e, i) => id === 'pergaminho' ? (pergEtapa(e) ? `${etapaRot(e, i)} (${num(pergEtapa(e))})` : null) : e.premio.itens.includes(id) ? etapaRot(e, i) : null
    const et = [...new Set(G.GYM_ORDER.flatMap((g) => G.GYMS[g].etapas.map(daEtapa).filter(Boolean)))]
    const partes = et.length ? [`na 1ª vitória sobre ${lista(et)} de cada ginásio`] : []
    if (G.GYM.revanche.ciclo.some((c) => c.item === id)) partes.push('no rodízio da revanche do líder')
    return lista(partes)
  }
  // ranks das skills de vaga: tudo de GameData.SKILL_RANKS e do RaceSim (rankScale, skillEffect, skillDesc, skillMarcoDesc)
  const RK = G.SKILL_RANKS
  const rankIds = Array.from({ length: RK.max }, (x, i) => i + 1)
  const rMax = romano(RK.max)
  conferirRegraDoRank(F.rankPiso)
  const custoRank = rankIds.slice(0, -1).map((r) => {
    const c = RK.custo[r]
    if (!c || !(c.ouro >= 0) || !(c.perg >= 0)) throw new Error(`wiki: SKILL_RANKS.custo sem o passo do rank ${r} para o ${r + 1}`)
    return { de: r, ouro: c.ouro, perg: c.perg }
  })
  if (Object.keys(RK.custo).length !== custoRank.length) throw new Error('wiki: SKILL_RANKS.custo tem passo fora de 1..max − 1')
  const custoTotal = custoRank.reduce((a, c) => ({ ouro: a.ouro + c.ouro, perg: a.perg + c.perg }), { ouro: 0, perg: 0 })
  const pergPodio = PG.podio.map((x, i) => `${ordinal(i + 1)} lugar ${pct(x, 0)}`).join(', ')
  // rank das skills dos cavalos de cada etapa de ginásio (fixo; o mesmo para todos os cavalos da etapa)
  const rankEtapa = (e) => {
    const rs = [...new Set(e.cavalos.map((c) => c.rank))]
    if (rs.length !== 1 || !(Number.isInteger(rs[0]) && rs[0] >= 1 && rs[0] <= RK.max)) throw new Error(`wiki: etapa de ginásio "${e.id}" sem rank único e válido nos cavalos`)
    return rs[0]
  }
  const basesGym = [...new Set(G.GYM_ORDER.flatMap((g) => G.GYMS[g].etapas.flatMap((e) => e.cavalos.map((c) => c.base))))]
  const basesComSkill = basesGym.filter((id) => (todasMontarias().find((h) => h.id === id) || { skills: [] }).skills.some((s) => G.SKILLS[s]))
  const insSkill = G.GYM_ORDER.find((g) => G.GYM.insignias[g].tipo === 'skill'), insXp = G.GYM_ORDER.find((g) => G.GYM.insignias[g].tipo === 'xp')

  // 1. Visão geral ---------------------------------------------------------------------------------------
  add('visao', 'Visão geral', 'Visão geral', [
    { t: 'p', txt: `**Galope Elemental** é um jogo de corrida de cavalos automática em pixel art. Você não controla o cavalo durante a corrida: decide antes (${F.gearPvp ? 'montaria, equipamento e entrada' : 'montaria e entrada'}) e assiste. Os cavalos têm tipo (${lista(Object.keys(G.ELEMENTS).map(nomeEl))}), raridade, estrelas, genética, level e skills; nada cresce sozinho: cada level dá pontos para o jogador comprar status.` },
    { t: 'h3', txt: 'Ciclo de uma corrida' },
    { t: 'passos', itens: [
      `**Escolher a montaria.** No começo você escolhe uma das ${G.STARTERS.length} iniciais (${lista(G.STARTERS.map((h) => h.name))}) e recebe ${num(E.startingGold)} de Ouro${F.gearOn ? ` e o equipamento inicial (${lista(EG.startGear.map((id) => G.GEAR[id].name))}, já equipado)` : ''}.`,
      `**Procurar sala.** Na aba Correr você escolhe a entrada (${lista(E.entryTiers.map((t) => num(t)), 'ou')} de Ouro). A sala tem de ${E.minRacers} a ${E.maxRacers} corredores: você e bots com Poder perto do seu. Pista, clima e rivais saem da seed da sala e não mudam até você correr.`,
      '**Pagar a entrada.** Só depois de "Largar!" a corrida é simulada; o resultado nunca é calculado antes.',
      `**Corrida automática.** O jóquei dosa o ritmo pela estamina; skills disparam nos gatilhos; o Dado da Sorte rola em ${lista(T.diceAt.map(fracao))} da pista e pode virar o clima; a Garra decide a reta final.`,
      `**Prêmio e XP.** A casa fica com ${pct(E.houseFee, 0)} do pote e o resto vai para os primeiros colocados. Todos ganham XP pela colocação${F.gearPvp ? ', e o pódio pode dar uma Pedra Negra' : ''}. No pódio de corrida valendo pode cair um ${PG.name} (ver Skills, Rank das skills).`
    ] },
    { t: 'h3', txt: 'Abas do jogo' },
    { t: 'dl', itens: [...F.abas.map((a) => [a, descreverAba(a, F)]), ['Perfil (o botão do cabeçalho)', descreverPerfil()]] },
    { t: 'nota', txt: 'Ainda não existem no protótipo: Gemas, passe, ovos, contas, servidor, as expedições fora os ginásios e a captura. A única moeda é o Ouro; as Pedras Negras são material de melhoria.' },
    { t: 'p', txt: `Versão dos dados: \`${G.version}\`. Este wiki é gerado do código (\`prototype/src/\`) por \`prototype/tools/wiki.mjs\`; não edite à mão.` }
  ])

  const ROTULO_AJUDA = { genetica: 'Nota de genética', estrelas: 'Estrelas', raridade: 'Raridade', skillTipo: 'Skill de tipo', poder: 'Poder', liga: 'Liga', clima: 'Clima', piso: 'Piso', dado: 'Dado da Sorte', custo: 'Custo dos pontos', redea: 'Rédea nova', rank: 'Rank das skills' }
  // 2. Status --------------------------------------------------------------------------------------------
  add('status', 'Status', 'Status', [
    { t: 'p', txt: `Cada montaria tem ${G.STAT_KEYS.length} status na escala de ${lim.baixo} a ${lim.alto}. Na corrida o motor usa n(x) = status / 100, e toda fórmula da corrida rende em linha reta até ${lim.alto}. O valor é arredondado uma vez só, no fim, e preso entre ${lim.baixo} e ${lim.alto}.` },
    { t: 'tabela', rotulo: 'Status', cab: ['Sigla', 'Status', 'Descrição no jogo', 'Na corrida'], linhas: G.STAT_KEYS.map((k) => [N(siglaStat(k)), comIcone('st-' + k, nomeStat(k)), G.HELP[k], papelDoStatus(k, F)]) },
    { t: 'h3', txt: 'Explicações do botão ⓘ' },
    { t: 'p', txt: 'No jogo, o botão ⓘ ao lado de cada rótulo mostra estas frases (no computador, com o mouse; no toque, abrindo e fechando embaixo do rótulo). Os sete status têm a frase na tabela acima.' },
    { t: 'tabela', rotulo: 'Explicações', cab: ['Rótulo', 'Texto'], linhas: Object.keys(G.HELP).filter((k) => G.STAT_KEYS.indexOf(k) < 0).map((k) => [N(ROTULO_AJUDA[k] || k), G.HELP[k]]) },
    { t: 'h3', txt: 'Como o status é calculado' },
    { t: 'formula', txt: `base   = início da faixa da raridade + ${num(T.gBand)} × g / 31      (nada cresce sozinho com o level)
status = base + pontos comprados, arredondado e preso entre ${lim.baixo} e ${lim.alto}
pontos(L) = piso(fator da raridade × fator das estrelas × [(L − 1) × ${num(T.ptsRate0)} + ${num(T.ptsRate1 - T.ptsRate0)} × (L − 1)(L − 2) / ${2 * (M - 2)}]) + torrões
custo do i-ésimo ponto num mesmo status (i = 0, 1, …) = 1 + piso(i / ${T.costStep})` },
    { t: 'lista', itens: [
      `**Genética (g):** de 0 a 31 por status, só do nascimento. Define onde o status nasce dentro da faixa da raridade (${num(T.gBand)} pontos de largura). Nota da genética no jogo: C 0–${F.notas[2] - 1} · B ${F.notas[2]}–${F.notas[1] - 1} · A ${F.notas[1]}–${F.notas[0] - 1} · S ${F.notas[0]}–31.`,
      `**Pontos por level:** a taxa sobe em linha reta de ${num(T.ptsRate0)} pontos no Nv 2 a ${num(T.ptsRate1)} no Nv ${M} (antes dos fatores de raridade e estrelas; ver Level e XP, Raridades e Estrelas). O jogador compra status com eles na aba Status e confirma.`,
      `**Custo por faixa:** os ${T.costStep} primeiros pontos num status custam 1 cada, os ${T.costStep} seguintes 2, depois 3, e assim por diante. A genética não entra no custo. Por isso pôr tudo num status só rende pouco.`,
      `**Torrões:** cada ${G.ITEMS.torrao.name} usado no cavalo é 1 ponto a mais, somado depois do piso; até ${num(G.ITEMS.torrao.cap)} por cavalo (ver Itens).`,
      `**Teto:** base + pontos ≤ ${lim.alto} em cada status. Ninguém chega lá: o pior caso (${nomeRar('mitico')} ${estrelas(T.starMult.length)} no Nv ${M}, genética 31, com os ${num(G.ITEMS.torrao.cap)} torrões e todos os pontos num status) fica em ${piorCaso}.`,
      `**${nomeStat('sorte')}:** só de nascimento, não recebe pontos: fica na base, de ${num(G.RARITIES.comum.baseLo)} (${nomeRar('comum')}, genética 0) a ${num(G.RARITIES.mitico.baseLo + T.gBand)} (${nomeRar('mitico')}, genética 31).`,
      `**Equipamento:** só vale no treino AFK; na corrida valendo e no Poder as peças não mexem nos status (ver Equipamento).`
    ] },
    { t: 'tabela', rotulo: 'Custo por faixa', titulo: 'Custo dos pontos num mesmo status', cab: ['Pontos no status', 'Custo de cada ponto da faixa', 'Custo total até o fim da faixa'], linhas: [0, 1, 2, 3, 4, 5, 6, 7].map((q) => [N(`${q * T.costStep + 1}º a ${(q + 1) * T.costStep}º`), N(String(S.pointCost(q * T.costStep))), N(num(S.costOf((q + 1) * T.costStep)))]) },
    { t: 'p', txt: `O clima também mexe nos status durante a corrida: soma (m − 1) × ${num(T.weatherAdd)} a n(x) de VEL, ACE, MAN, FOR e GAR, com o multiplicador m do clima (ver Elementos e clima), o mesmo efeito em qualquer nível. Não mexe em EST nem em SOR.` }
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
  const niveisEx = [1, 10, 25, E.maxLevel]
  const niveisPts = [2, 5, 11, 20, 30, 40, E.maxLevel]
  // exemplo de build: o primeiro inicial no Nv máximo, com a build dos bots e com tudo no status de maior genética
  const exemploBuild = () => {
    const h = G.STARTERS[0]
    const k = G.STAT_KEYS.reduce((m, x) => (h.potential[x] > h.potential[m] ? x : m), G.STAT_KEYS[0])
    const x = { ...h, level: E.maxLevel }, st = S.computeStats({ ...x, alloc: S.botAlloc(x) })
    const corrida = G.STAT_KEYS.filter((q) => (T.noBuy || []).indexOf(q) < 0)
    return { t: 'p', txt: `Exemplo: ${h.name} (${nomeRar(h.rarity)} ${estrelas(S.starsOf(h))}) no Nv ${E.maxLevel} tem ${S.freePoints(x)} pontos. Com a build dos bots (a mesma do "Distribuir sugerido") fica com ${corrida.map((q) => `${siglaStat(q)} ${st[q]}`).join(', ')}. Pondo tudo em ${nomeStat(k)} (genética ${h.potential[k]}), ela chegaria a ${tudoNum(x, k)}, e os outros ficariam na base.` }
  }
  add('level', 'Level e XP', 'Level e XP', [
    { t: 'p', txt: `Level máximo: **${E.maxLevel}**. ${xpLin ? `Para subir do level L para L + 1 são ${num(xpLin.a)} + ${num(xpLin.b)} × L de XP.` : 'XP por level na tabela.'} Do level 1 ao ${E.maxLevel} são ${num(acum)} de XP no total. No level máximo o XP ainda acumula até ${num(E.xpToLevel(E.maxLevel))} (o valor de um level ${E.maxLevel} → ${E.maxLevel + 1}) e aí trava.` },
    { t: 'h3', txt: 'XP por colocação e treino' },
    { t: 'tabela', rotulo: 'XP por colocação', cab: ['Colocação', 'XP (corrida valendo)', 'XP (treino)', 'Ouro do treino'], linhas: E.xpPerPlace.map((x, i) => [ordinal(i + 1), N(num(x)), N(num(Math.round(x / F.treinoXpDiv))), ouroCel(F.treinoOuro[i] != null ? F.treinoOuro[i] : F.treinoOuro[F.treinoOuro.length - 1])]) },
    { t: 'p', txt: `**Treino gratuito:** aparece quando seu Ouro não cobre a menor entrada (${num(minE)}). Não cobra entrada, rende 1/${F.treinoXpDiv} do XP e de ${num(Math.min(...F.treinoOuro))} a ${num(Math.max(...F.treinoOuro))} de Ouro pela colocação, e não dá Pedra Negra nem ${PG.name}.` },
    { t: 'p', txt: `**Duelos de ginásio:** cada cavalo do time ganha ${num(G.GYM.xp.vence)} de XP por duelo vencido e ${num(G.GYM.xp.perde)} por duelo perdido (ver Ginásios da Expedição). Com a ${G.GYMS[insXp].insignia.name}, todo XP somado a um cavalo (corridas, treino e duelos) ganha +${pct(G.GYM.insignias[insXp].valor, 0)}, arredondado.` },
    { t: 'h3', txt: 'XP necessário por level' },
    { t: 'grade', classe: 'grade--xp', cab: ['Level', 'XP', 'Acumulado'], linhas: xpLinhas },
    { t: 'h3', txt: 'Pontos por level' },
    { t: 'p', txt: `Nenhum status cresce sozinho: cada level dá pontos para comprar status (ver Status). A taxa sobe de ${num(T.ptsRate0)} no Nv 2 a ${num(T.ptsRate1)} no Nv ${E.maxLevel}, vezes o fator da raridade e o das estrelas, então dez levels rendem parecido em qualquer ponto da progressão.` },
    { t: 'tabela', rotulo: 'Pontos por level', titulo: `Pontos acumulados por level (${estrelas(2)})`, cab: ['Level', ...rarIds.map(nomeRar)], linhas: niveisPts.map((l) => [N(`Nv ${l}`), ...rarIds.map((r) => N(String(S.freePoints({ rarity: r, grau: 2, level: l }))))]) },
    { t: 'tabela', rotulo: 'Pontos por estrela', titulo: `Pontos acumulados, ${nomeRar('comum')} / ${nomeRar('mitico')}`, cab: ['Estrelas', ...[11, 30, E.maxLevel].map((l) => `Nv ${l}`)], linhas: T.starMult.map((x, i) => [N(estrelas(i + 1)), ...[11, 30, E.maxLevel].map((l) => N(`${S.freePoints({ rarity: 'comum', grau: i + 1, level: l })} / ${S.freePoints({ rarity: 'mitico', grau: i + 1, level: l })}`))]) },
    exemploBuild(),
    { t: 'h3', txt: 'Aprender skill ao subir de level' },
    { t: 'p', txt: `A cada level ganho há ${pct(T.learnChance, 0)} de chance de aprender uma skill nova (${pct(T.learnChance + G.GYM.insignias[insSkill].valor, 0)} com a ${G.GYMS[insSkill].insignia.name}, ver Ginásios; sorteio pela seed do save). Só entra se houver vaga (vagas da raridade) e a skill sorteada é uma das que a montaria pode ter: geral ou do próprio elemento, nunca repetida. A skill aprendida entra no rank I (ver Skills, Rank das skills).` },
    { t: 'h3', txt: 'Exemplo: as iniciais por level (build dos bots)' },
    { t: 'tabela', rotulo: 'Iniciais por level', cab: ['Montaria', 'Level', ...G.STAT_KEYS.map(siglaStat), 'Poder', 'Liga'], linhas: G.STARTERS.flatMap((h) => niveisEx.map((l) => { const x0 = { ...h, level: l }, x = { ...x0, alloc: S.botAlloc(x0) }; const st = S.computeStats(x), pr = S.powerRating(x); return [h.name, N(String(l)), ...G.STAT_KEYS.map((k) => N(String(st[k]))), N(num(pr)), S.leagueFor(pr).name] })) }
  ])

  // 4. Raridades -----------------------------------------------------------------------------------------
  const contaRar = (r) => todasMontarias().filter((h) => h.rarity === r).length
  add('raridades', 'Raridades', 'Raridades', [
    { t: 'p', txt: `São ${rarIds.length} raridades, da mais comum à mais rara: ${lista(rarIds.map(nomeRar))}. A raridade define a faixa onde o status nasce (pela genética), o fator dos pontos por level, as vagas de skill e a força da skill de tipo (ver Skills). Só muda por cruzamento. O teto é o mesmo para todas: ${T.statMax}.` },
    { t: 'tabela', rotulo: 'Raridades', cab: ['Raridade', 'Cor', 'Status nasce entre', 'Fator dos pontos', `Pontos no Nv ${E.maxLevel} (${estrelas(2)})`, 'Vagas de skill (além da de tipo)', 'Skills do potro (mínimo)', 'Preço da peça', 'Aluguel base', 'Montarias no jogo'], linhas: rarIds.map((r) => {
      const R = G.RARITIES[r]
      return [rarCel(r, true), { md: R.color, html: `<span class="amostra" style="--c:${R.color}"></span><code>${R.color}</code>` }, N(`${num(R.baseLo)}–${num(R.baseLo + T.gBand)}`), N(mult(R.ptsMult, 2)), N(String(S.freePoints({ rarity: r, grau: 2, level: E.maxLevel }))), N(String(R.skillSlots)), N(String(R.bornSkills)),
        EG.price[r] != null ? ouroCel(EG.price[r]) : 'não existe', BR.rentalBase[r] != null ? ouroCel(BR.rentalBase[r]) : 'não se aluga', N(String(contaRar(r)))]
    }) },
    { t: 'p', txt: `Raridade mais alta que nasce de cruzamento: **${nomeRar(B.RARITY_IDS[B.TUNING.maxRarityOrder])}**. ${nomeRar('mitico')} nunca nasce de cruzamento e não se aluga.` },
    { t: 'h3', txt: 'Estrelas' },
    { t: 'p', txt: `Cada montaria tem de ${estrelas(1)} a ${estrelas(T.starMult.length)}. As estrelas multiplicam os pontos ganhos por level e mudam o preço do aluguel; não mexem na genética. O potro recebe as estrelas no nascimento (ver Cruzamento); as iniciais e os selvagens têm as estrelas definidas nos dados. A Estrela de treino sobe 1 estrela (ver Itens e recompensa diária).` },
    { t: 'tabela', rotulo: 'Estrelas', cab: ['Estrelas', 'Fator dos pontos', `Pontos no Nv ${E.maxLevel} (${nomeRar('comum')})`, 'Multiplicador do aluguel'], linhas: T.starMult.map((x, i) => { const h = { rarity: 'comum', level: E.maxLevel, grau: i + 1 }; return [N(estrelas(i + 1)), N(mult(x, 2)), N(String(S.freePoints(h))), N(mult(BR.grauMult[i], 2))] }) },
    { t: 'h3', txt: 'Corcel' },
    { t: 'p', txt: `Uma montaria é **Corcel** quando já tem todas as skills "de linha" da sua raridade. Corcel garante herança de skill no cruzamento (ver Cruzamento).` },
    { t: 'tabela', rotulo: 'Corcel', cab: ['Raridade', 'Skills de linha'], linhas: Object.keys(B.CORCEL_SETS).map((r) => [rarCel(r), B.CORCEL_SETS[r].map(nomeSkill).join(', ')]) }
  ])

  // 5. Elementos e clima ---------------------------------------------------------------------------------
  const elIds = Object.keys(G.ELEMENTS), clIds = Object.keys(G.WEATHERS)
  const penalizadoPor = (el) => clIds.filter((w) => G.WEATHERS[w].penalizes === el)
  const amostraVento = F.vento
  // a skill de clima soma weatherBonus × fator do rank ao bônus do dono (as três têm de dar o mesmo, senão a frase muda)
  const skClima = Object.keys(G.SKILLS).filter((id) => G.SKILLS[id].effect.weatherBonus)
  const climaNoRank = (r) => {
    const vs = [...new Set(skClima.map((id) => S.skillEffect(id, r).weatherBonus))]
    if (vs.length !== 1) throw new Error('wiki: as skills de clima têm reforços diferentes — descreva cada uma em "Multiplicador de clima"')
    return T.weatherMult + vs[0]
  }
  const climaSkillTxt = skClima.length ? `; com a skill de clima ativa (${lista(skClima.map(nomeSkill))}), de ${multF(climaNoRank(1), 3)} no rank I a ${multF(climaNoRank(RK.max), 3)} no rank ${rMax} (ver Skills, Rank das skills)` : ''
  add('elementos', 'Elementos e clima', 'Elementos', [
    { t: 'p', txt: `São ${elIds.length} tipos (elementos). Cada um tem a sua skill de tipo, sempre ativa num terço da pista (ver Skills), e um clima "dono", que o favorece. Cada clima também penaliza um tipo. Fora do clima e da skill, o tipo não mexe nos status.` },
    { t: 'tabela', rotulo: 'Elementos', cab: ['Elemento', 'Clima dono', 'Penalizado por', 'Descrição'], linhas: elIds.map((e) => {
      const el = G.ELEMENTS[e], pen = penalizadoPor(e)
      return [elCel(e), el.weather ? nomeClima(el.weather) : '—', pen.length ? pen.map(nomeClima).join(', ') : '—', el.desc]
    }) },
    { t: 'h3', txt: 'Climas' },
    { t: 'tabela', rotulo: 'Climas', cab: ['Clima', 'Favorece', 'Penaliza', 'Efeito geral', 'Descrição'], linhas: clIds.map((w) => {
      const W = G.WEATHERS[w]
      return [comIcone('cl-' + w, nomeClima(w)), W.element ? elCel(W.element) : '—', W.penalizes ? elCel(W.penalizes) : '—', efeitoGeralClima(w), W.desc]
    }) },
    { t: 'h3', txt: 'Multiplicador de clima (m)' },
    { t: 'p', txt: `Elemento dono do clima: ${multF(T.weatherMult)}${climaSkillTxt}. Elemento penalizado: ${multF(2 - T.weatherMult)}. O resto, e todos no ${nomeClima('nublado')}, ×1. O multiplicador entra somado a n(x): nc(x) = n(x) + (m − 1) × ${num(T.weatherAdd)}, o mesmo efeito em qualquer nível.` },
    { t: 'tabela', rotulo: 'Multiplicador de clima', cab: ['Elemento', ...clIds.map(nomeClima)], linhas: elIds.map((e) => [elCel(e), ...clIds.map((w) => N(multF(S.weatherMult(e, w, false))))]) },
    { t: 'formula', txt: `nc(x)      = n(x) + (m − 1) × ${num(T.weatherAdd)}
vMax       = (${num(T.vBase)} + ${num(T.vRange)} × nc(VEL)) × (1 + ${num(T.weatherVel)} × (m − 1))
aceleração = 1 / max(${num(T.aInvMin, 3)}, ${num(T.aInv0, 3)} − ${num(T.aInv1, 3)} × nc(ACE))
Força, Manobra e Garra efetivas = nc(x)` },
    { t: 'p', txt: `O clima inicial sai da seed da sala. O Dado da Sorte pode virar o clima no meio da corrida (ver Dado da Sorte); quando vira, os números de todos são recalculados (o que já foi gasto não volta).` },
    { t: 'h3', txt: 'Vento (só visual)' },
    { t: 'p', txt: `Cada sala tem um vento sorteado pela seed: ${lista(Object.keys(amostraVento).map((k) => `${k} ${pct(amostraVento[k], 0)}`))}, soprando para a direita ou para a esquerda. Ele só mexe no desenho (bandeirinhas, folhas, nuvens, inclinação da chuva); não entra na simulação.` }
  ])

  // 6. Skills --------------------------------------------------------------------------------------------
  const skIds = Object.keys(G.SKILLS)
  const quemTem = (id) => todasMontarias().filter((h) => h.skills.indexOf(id) >= 0).map((h) => h.name)
  const quemPode = (sk) => sk.element === 'geral' ? 'qualquer tipo' : `só ${nomeEl(sk.element)}`
  const ordemEl = ['geral', ...elIds]
  const tercoTxt = (z) => {
    const nome = z[0] === 0 ? 'primeiro terço' : z[1] === 1 ? 'último terço' : 'terço do meio'
    return `${nome} (${z[0] === 0 ? 'da largada' : 'de ' + fracao(z[0])} ${z[1] === 1 ? 'à chegada' : 'a ' + fracao(z[1])})`
  }
  // o marco do último rank, na frase do RaceSim.skillMarcoDesc (skill com rank5 e sem frase quebra o wiki)
  const marcoSkill = (id) => {
    if (!G.SKILLS[id].rank5) return '—'
    const t = S.skillMarcoDesc(id)
    if (!t) throw new Error(`wiki: a skill "${id}" tem marco (rank5) e o RaceSim.skillMarcoDesc não a descreve`)
    return t
  }
  const descNoRank = (id, r) => { const t = S.skillDesc(id, r); if (!t) throw new Error(`wiki: RaceSim.skillDesc não descreve "${id}" no rank ${r}`); return t }
  // a regra do rank por formato de efeito: só os formatos que alguma skill usa, com as chaves e um exemplo do catálogo
  const chavesDoFormato = (fmt) => [...new Set(skIds.flatMap((id) => Object.keys(G.SKILLS[id].effect).filter((k) => formatoRank(k) === fmt)))]
  const comChaves = (fmt) => lista(chavesDoFormato(fmt).map(nomeChaveEfeito))
  const exemploRank = (fmt, mostra) => {
    // de preferência um par (skill, chave) que não bate no piso no último rank
    const pares = skIds.flatMap((x) => Object.keys(G.SKILLS[x].effect).filter((q) => formatoRank(q) === fmt).map((q) => [x, q]))
    const [id, k] = pares.find(([x, q]) => !noPiso(x, q, RK.max)) || pares[0]
    const v = G.SKILLS[id].effect[k]
    return `Exemplo: ${nomeChaveEfeito(k)} de ${nomeSkill(id)}, ${mostra(v)} no rank I e ${mostra(valorNoRank(k, v, RK.max, F.rankPiso))} no rank ${rMax}`
  }
  // multiplicador de gasto que a escala levaria abaixo do piso (fica no piso)
  const noPiso = (id, k, r) => formatoRank(k) === 'gasto' && 1 - (1 - G.SKILLS[id].effect[k]) * S.rankScale(r) < F.rankPiso
  const batemNoPiso = skIds.flatMap((id) => Object.keys(G.SKILLS[id].effect).filter((k) => formatoRank(k) === 'gasto').map((k) => { const r = rankIds.find((x) => noPiso(id, k, x)); return r ? `${nomeSkill(id)} (${nomeChaveEfeito(k)}) a partir do rank ${romano(r)}` : null }).filter(Boolean))
  const skDado = skIds.filter((id) => G.SKILLS[id].effect.extraDice)
  const regraRank = []
  if (chavesDoFormato('ajuda').length) regraRank.push(`**Multiplicador que ajuda** (${comChaves('ajuda')}), m no rank I: 1 + (m − 1) × s. ${exemploRank('ajuda', (v) => mult(v))}.`)
  if (chavesDoFormato('gasto').length) regraRank.push(`**Multiplicador que reduz gasto** (${comChaves('gasto')}), m no rank I: 1 − (1 − m) × s, nunca abaixo de ${mult(F.rankPiso)}. ${exemploRank('gasto', (v) => mult(v))}. ${batemNoPiso.length ? `Bate no piso: ${lista(batemNoPiso)}.` : 'Hoje nenhuma skill bate no piso.'}`)
  if (chavesDoFormato('somado').length) regraRank.push(`**Bônus somado** (${comChaves('somado')}), b no rank I: b × s. ${exemploRank('somado', (v) => sinalPct(v, 2))}.`)
  if (chavesDoFormato('recupera').length) regraRank.push(`**Recuperação** (${comChaves('recupera')}), x no rank I: x × s. ${exemploRank('recupera', (v) => pct(v, 2))}.`)
  if (skClima.length) regraRank.push(`**Reforço de clima** (${lista(skClima.map(nomeSkill))}), b no rank I: o bônus do dono do clima passa de ${multF(T.weatherMult)} para ×(${num(T.weatherMult)} + b × s): ${rankIds.map((r) => multF(climaNoRank(r), 3)).join(' · ')} do rank I ao ${rMax}.`)
  if (skDado.length) regraRank.push(`**Dado extra** (${lista(skDado.map(nomeSkill))}): fora da escala. O dado extra rola de 1 até o teto do rank: ${RK.diceTeto.map((x) => num(x)).join(' · ')} do rank I ao ${rMax} (ver Dado da Sorte).`)
  regraRank.push(`**Duração e distância** não crescem com o rank, nem o "em cada bloco" das skills de curva e subida (só o marco do rank ${rMax} muda a duração, quando ele diz).`)
  const vagasMax = Math.max(...Object.keys(G.RARITIES).map((r) => G.RARITIES[r].skillSlots))
  const rarVagasMax = Object.keys(G.RARITIES).filter((r) => G.RARITIES[r].skillSlots === vagasMax).map(nomeRar)
  const pergPorGin = G.GYM_ORDER.map((g) => G.GYMS[g].etapas.reduce((a, e) => a + pergEtapa(e), 0))
  const revanchePerg = G.GYM.revanche.ciclo.some((c) => c.item === 'pergaminho')
  const diariaPerg = G.DAILY.dias.some((d) => d.item === 'pergaminho')
  if (PG.price != null) throw new Error('wiki: o Pergaminho de técnica ganhou preço (ITEMS.pergaminho.price): ele nunca é vendido — reveja a regra e o texto do wiki')
  const skillMd = ordemEl.filter((e) => skIds.some((id) => G.SKILLS[id].element === e)).map((e) => {
    const ids = skIds.filter((id) => G.SKILLS[id].element === e)
    return `### ${e === 'geral' ? 'Gerais' : nomeEl(e)} (${ids.length})\n\n` + blocoMd({ t: 'tabela', cab: ['Skill', 'Gatilho', 'Efeito (rank I)', 'Descrição no jogo (rank I)', `Marco do rank ${rMax}`, 'Quem pode ter', 'Começa em', 'Pontos no Poder (rank I; × o fator do rank)', 'Balão'], linhas: ids.map((id) => {
      const sk = G.SKILLS[id], qt = quemTem(id)
      return [{ md: icMd('sk-' + id) + `**${sk.name}**`, html: icone('sk-' + id) + `<strong>${esc(sk.name)}</strong>` }, descreverGatilho(sk.trigger), descreverEfeito(sk.effect), sk.desc, marcoSkill(id), quemPode(sk), qt.length ? qt.join(', ') : '—', N(num(pesoSkill(id) * T.ratingSkillPts)), FX.nomeCurto(sk.name, sk.short)]
    }) })
  }).join('\n\n')
  const skillHtml = ordemEl.filter((e) => skIds.some((id) => G.SKILLS[id].element === e)).map((e) => {
    const ids = skIds.filter((id) => G.SKILLS[id].element === e)
    return `<section class="grupo" data-grupo="skill"><h3 id="skills-${e}">${icone('el-' + e)}${esc(e === 'geral' ? 'Gerais' : nomeEl(e))} <span class="conta">${ids.length}</span></h3><div class="cartoes cartoes--skills">` +
      ids.map((id) => {
        const sk = G.SKILLS[id], qt = quemTem(id)
        return `<article${entradaAttrs({ id: 'skill-' + id, tipo: 'skill', busca: [sk.name, nomeEl(sk.element), 'skill'], el: sk.element })}>` +
          `<header><h4>${icone('sk-' + id)}${esc(sk.name)}</h4>${elCel(sk.element).html}</header>` +
          `<p class="desc">${esc(sk.desc)}</p>` +
          `<dl class="pares pares--skill"><dt>Gatilho</dt><dd>${inlineHtml(descreverGatilho(sk.trigger))}</dd>` +
          `<dt>Efeito (rank I)</dt><dd>${inlineHtml(descreverEfeito(sk.effect))}</dd>` +
          `<dt>Marco do rank ${rMax}</dt><dd>${esc(marcoSkill(id))}</dd>` +
          `<dt>Quem pode ter</dt><dd>${esc(quemPode(sk))}</dd>` +
          `<dt>Começa em</dt><dd>${esc(qt.length ? qt.join(', ') : 'nenhuma montaria pronta')}</dd>` +
          `<dt>Pontos no Poder (rank I)</dt><dd class="num">+${esc(num(pesoSkill(id) * T.ratingSkillPts))} × o fator do rank</dd>` +
          `<dt>Balão</dt><dd><span class="balao">${esc(FX.nomeCurto(sk.name, sk.short))}</span></dd></dl></article>`
      }).join('') + `</div></section>`
  }).join('') + `<p class="vazio" data-vazio="skill" hidden>Nenhuma skill casa com a busca e os filtros.</p>`
  add('skills', 'Skills', 'Skills', [
    { t: 'p', txt: `Toda montaria tem a **skill de tipo** do seu elemento, em vaga própria e sempre ativa (abaixo). Além dela, há ${skIds.length} skills de vaga normal. Cada uma tem um gatilho; quando ele acontece, a skill **ativa sempre**, sem sorteio (uma vez por corrida, ou uma vez por bloco nas skills de curva e subida marcadas "em cada bloco"), e o efeito vale pelo tempo ou pela distância indicados. Raridade, level e ${nomeStat('sorte')} não mudam a ativação. Cada skill de vaga tem um **rank**, de I a ${rMax}, por cavalo, que aumenta o efeito (ver Rank das skills, abaixo).` },
    { t: 'p', txt: `**Skills de largada** disparam no sinal (t = 0), antes do atraso de reação do cavalo (até ${num(T.startDelayMax)} s, menor com ACE alta). A duração conta desde o sinal, então esse atraso consome parte dela.` },
    { t: 'h3', txt: 'Skill de tipo', id: 'skills-tipo' },
    { t: 'p', txt: `Sem sorteio e sem chance: age sempre, no terço da distância que é do tipo (o terço é proporcional à distância da pista). No terço, os **dois status do tipo** valem × (1 + m × P): quem investe neles ganha mais. O m de cada skill está abaixo; P é a força, que varia com o level e a raridade de um jeito próprio de cada tipo. No início do terço aparece o balão da skill.` },
    { t: 'formula', txt: `P = ${num(T.typeBase)} + nívelT × (level − 1) / ${E.maxLevel - 1} + raridadeT × ordem da raridade / 4      (ordem: ${rarIds.map((r) => `${nomeRar(r)} ${G.RARITIES[r].order}`).join(', ')})` },
    { t: 'tabela', rotulo: 'Skills de tipo', cab: ['Skill', 'Tipo', 'Terço', 'Efeito (P = 1)', 'nívelT', 'raridadeT', `${nomeRar('lendario')} Nv ${E.maxLevel}`, 'Balão'], linhas: elIds.filter((e) => G.TYPE_SKILLS[e]).map((e) => {
      const ts = G.TYPE_SKILLS[e], P50 = S.typePower({ element: e, rarity: 'lendario', level: E.maxLevel })
      return [{ md: icMd('sk-tipo-' + e) + `**${ts.name}**`, html: icone('sk-tipo-' + e) + `<strong>${esc(ts.name)}</strong>` }, elCel(e), tercoTxt(ts.zone), descreverEfeitoTipo(ts.effect, 1, e), N(num(T.typeLevel[e], 2)), N(num(T.typeRar[e], 2)), `P = ${num(P50, 3)}: ${descreverEfeitoTipo(ts.effect, P50, e)}`, FX.nomeCurto(ts.name, ts.short)]
    }) },
    { t: 'tabela', rotulo: 'Força da skill de tipo', titulo: `Força P por raridade (Nv 1 → Nv ${E.maxLevel})`, cab: ['Raridade', ...elIds.filter((e) => G.TYPE_SKILLS[e]).map((e) => G.TYPE_SKILLS[e].name)], linhas: rarIds.map((r) => [rarCel(r), ...elIds.filter((e) => G.TYPE_SKILLS[e]).map((e) => N(`${num(S.typePower({ element: e, rarity: r, level: 1 }), 3)} → ${num(S.typePower({ element: e, rarity: r, level: E.maxLevel }), 3)}`))]) },
    { t: 'p', txt: `Exemplo com P = 1: na ${G.TYPE_SKILLS.fogo.name}, ${nomeStat(S.TYPE_STATS.fogo[0])} 60 vale ${num(60 * (1 + G.TYPE_SKILLS.fogo.effect.statMul), 1)} no terço; com 100, vale ${num(100 * (1 + G.TYPE_SKILLS.fogo.effect.statMul), 1)}. A ${G.TYPE_SKILLS.agua.name} multiplica a ${nomeStat('est')} só no teto do ritmo (o tanque não muda). Elemento sem skill de tipo corre sem ela. A skill de tipo não troca, não conta nas vagas e não entra no Poder (lá, level e raridade valem o mesmo para os três tipos).` },
    { t: 'h3', txt: 'Rank das skills', id: 'skills-rank' },
    { t: 'p', txt: `Cada skill de vaga de cada cavalo tem um rank, de I a ${rMax} (a skill de tipo não tem rank). O rank é do cavalo, não da conta: a mesma skill pode estar no rank I num cavalo e no ${rMax} em outro. A skill ativa sempre em qualquer rank; o que muda é a força. O fator do rank r é s(r) = 1 + ${num(RK.step)} × (r − 1), e ele age **só na parte de bônus** do efeito do rank I (tabela "Skills de vaga", abaixo). No rank ${rMax} a skill ganha também o **marco**, um efeito próprio somado ao que já foi escalado.` },
    { t: 'tabela', rotulo: 'Fator do rank', titulo: 'Fator do rank', cab: ['Rank', 'Fator s', 'A mais que o rank I'], linhas: rankIds.map((r) => [N(romano(r)), N(multF(S.rankScale(r))), N(r === 1 ? '—' : sinalPct(S.rankScale(r) - 1, 0))]) },
    { t: 'p', txt: 'Como o fator entra em cada formato de efeito (os exemplos do último rank são antes do marco):' },
    { t: 'lista', itens: regraRank },
    { t: 'h4', txt: 'Custo para subir' },
    { t: 'p', txt: `Sobe-se um rank por vez, na ficha do cavalo, aba Skills, no botão **Subir rank** de cada skill: paga-se Ouro e ${PG.plural}. Não há sorteio: a subida nunca falha, e não tem volta. O Ouro guardado para a entrada do páreo aberto não entra na conta. Com o páreo aberto (valendo ou treino), **o cavalo ativo não sobe rank**, porque o Poder dele não pode passar do que a sala viu; os outros cavalos sobem. O botão apagado diz o motivo: falta Ouro, faltam Pergaminhos, rank máximo ou páreo aberto.` },
    { t: 'tabela', rotulo: 'Custo para subir', titulo: 'Custo para subir o rank de uma skill', cab: ['Passo', 'Ouro', PG.plural], linhas: [
      ...custoRank.map((c) => [N(`${romano(c.de)} → ${romano(c.de + 1)}`), ouroCel(c.ouro), N(num(c.perg))]),
      [{ md: `**Total (I → ${rMax})**`, html: `<strong>Total (I → ${rMax})</strong>` }, ouroCel(custoTotal.ouro), N(num(custoTotal.perg))]
    ] },
    { t: 'p', txt: `Um cavalo ${lista(rarVagasMax, 'ou')} com as ${vagasMax} vagas no rank ${rMax} custa ${num(custoTotal.ouro * vagasMax)} de Ouro e ${num(custoTotal.perg * vagasMax)} ${PG.plural}.` },
    { t: 'h4', txt: PG.name },
    { t: 'p', txt: `${PG.desc} Só se ganha jogando:` },
    { t: 'lista', itens: [
      `**Pódio de corrida valendo** (entrada paga): ${pergPodio}. O sorteio sai da seed da sala, na liquidação do prêmio, e dá no máximo 1 por corrida. O treino não sorteia.`,
      `**Nos ginásios:** junto do prêmio, ${fonteGin('pergaminho')} (o número entre parênteses é quantos vêm): ${lista([...new Set(pergPorGin)].map((n) => num(n)), 'ou')} por ginásio, ${num(pergPorGin.reduce((a, b) => a + b, 0))} nos ${G.GYM_ORDER.length}.${revanchePerg ? '' : ' A revanche do líder não dá Pergaminho.'}`,
      `**Nunca** na loja (não tem preço em Ouro), nunca por Gemas${diariaPerg ? '' : ', e a recompensa diária não dá'}.`,
      `**Mochila:** até ${num(PG.cap)}. No pódio, o Pergaminho que não cabe se perde (o resultado avisa "Mochila cheia"); no ginásio, o desafio não começa enquanto os Pergaminhos do prêmio não couberem.`,
      'Não tem botão Usar: só é gasto ao subir rank.'
    ] },
    { t: 'h4', txt: 'O rank no resto do jogo' },
    { t: 'lista', itens: [
      `**Poder:** cada skill soma ${num(T.ratingSkillPts)} × o peso do gatilho × o fator do rank (o marco não soma à parte). Uma skill no rank ${rMax} vale ${multF(S.rankScale(RK.max))} os pontos dela no rank I (ver Economia, Poder e ligas).`,
      `**Potro:** a skill herdada nasce 1 rank abaixo do pai que a tem (se os dois têm, vale o maior), nunca abaixo do I; a skill sorteada para completar o mínimo nasce no rank I. O rank do potro não usa sorteio (ver Cruzamento).`,
      `**${G.ITEMS.cupom.name}:** a skill nova entra no rank I e o rank da que sai é perdido (a confirmação avisa, por exemplo "Rank IV de ${nomeSkill(skIds[1])} será perdido").`,
      `**${G.ITEMS.manual.name} e aprendizado por level:** a skill aprendida entra no rank I. As chances deles (${pct(G.ITEMS.manual.chance, 0)} e ${pct(T.learnChance, 0)}) são de **aprender**, não de ativar.`,
      `**Bots da sala:** todas as skills de vaga de todos os bots ficam no mesmo rank: a média, arredondada, dos ranks das skills de vaga do seu cavalo (rank I se ele não tem skill de vaga). Sem sorteio; o rank entra no Poder do bot. A sala mostra "skills rank N" nos rivais.`,
      `**Oponentes dos ginásios:** rank fixo por etapa, sem sorteio (coluna "Rank das skills" de cada trilha, em Ginásios da Expedição); a revanche usa o do líder. ${basesComSkill.length ? `Vale para as skills de vaga de ${lista(basesComSkill.map(nomeMontaria))}.` : `Hoje as montarias-base dos ginásios (${lista(basesGym.map(nomeMontaria))}) não têm skill de vaga, então esse rank ainda não muda nada na prática.`}`,
      `**Na pista:** o balão da skill mostra o rank em algarismo romano a partir do II, no fim do nome ("${FX.nomeCurto(G.SKILLS[skIds[0]].name, G.SKILLS[skIds[0]].short)} III"); o rank I não aparece.`
    ] },
    { t: 'tabela', rotulo: 'Skills por rank', titulo: `Skills por rank (o texto do jogo no rank I e no ${rMax}; o do ${rMax} já traz o marco)`, cab: ['Skill', 'Rank I', `Rank ${rMax}`, `Marco do rank ${rMax}`], linhas: skIds.map((id) => [comIcone('sk-' + id, nomeSkill(id)), descNoRank(id, 1), descNoRank(id, RK.max), marcoSkill(id)]) },
    { t: 'h3', txt: 'Skills de vaga' },
    { t: 'p', txt: `**Quem pode ter:** as skills gerais servem para qualquer tipo; as de um tipo, só para aquele tipo. O número de skills é limitado pelas vagas da raridade.` },
    { t: 'p', txt: `**Efeito e descrição:** os números desta lista são os do rank I; o rank multiplica a parte de bônus (ver Rank das skills). **Marco do rank ${rMax}:** o que a skill ganha a mais no último rank. **Pontos no Poder:** cada skill soma ${num(T.ratingSkillPts)} × o peso do gatilho × o fator do rank (gatilhos que nem sempre acontecem valem menos); a lista mostra os pontos no rank I. **Balão:** o texto que aparece na pista quando a skill ativa.` },
    { t: 'custom', md: skillMd, html: skillHtml }
  ])

  // 7. Dado da Sorte -------------------------------------------------------------------------------------
  const ld = limitesDado()
  const dadoViciado = skDado.map(nomeSkill)
  const marcoDado = skDado.length ? marcoSkill(skDado[0]) : 'nenhum'
  add('dado', 'Dado da Sorte', 'Dado da Sorte', [
    { t: 'p', txt: `Quando o líder cruza ${lista(T.diceAt.map(fracao))} da distância, **todos** rolam o Dado da Sorte (até quem já chegou). Ele usa um fluxo de números próprio da seed, então é determinístico.` },
    { t: 'passos', itens: [
      `Cada montaria rola um dado de ${ld.min} a ${ld.max}.`,
      `Com chance (SOR − ${num(T.sorteDiceLo)}) / ${num(T.sorteDiceFull - T.sorteDiceLo)} (presa entre 0% e 100%), rola um 2º dado e fica com o melhor. A ${nomeStat('sorte')} vai de ${num(G.RARITIES.comum.baseLo)} a ${num(G.RARITIES.mitico.baseLo + T.gBand)} (só de nascimento), então a fórmula começa onde a ${nomeStat('sorte')} começa.`,
      `${dadoViciado.length ? lista(dadoViciado) : 'A skill de dado extra'} ativa uma vez por corrida, antes do 1º Dado, e soma um dado extra nos ${T.diceAt.length} Dados: de 1 até o teto do rank (${RK.diceTeto.map((x) => num(x)).join(', ')} do rank I ao ${rMax}); no rank ${rMax}, o marco: ${marcoDado} (no máximo ${ld.maxDados} dados por montaria).`,
      'O maior dado vence. Empate no topo: só os empatados rolam de novo.',
      `O clima vira o do elemento do vencedor. Se já for esse clima, o clima "segura".`
    ] },
    { t: 'tabela', rotulo: 'Vencedor e clima', cab: ['Elemento do vencedor', 'Clima depois do Dado'], linhas: elIds.map((e) => [elCel(e), G.ELEMENTS[e].weather ? nomeClima(G.ELEMENTS[e].weather) : 'não muda']) },
    { t: 'tabela', rotulo: 'Sorte e dados', titulo: 'Chance de rolar o 2º dado', cab: ['SOR', 'Chance do 2º dado'], linhas: [G.RARITIES.comum.baseLo, 50, G.RARITIES.comum.baseLo + T.gBand, 60, 70, G.RARITIES.mitico.baseLo + T.gBand, T.sorteDiceFull].map((s) => [N(String(s)), N(pct(Math.min(1, Math.max(0, (s - T.sorteDiceLo) / (T.sorteDiceFull - T.sorteDiceLo))), 0))]) }
  ])

  // 8. Pista e simulação ---------------------------------------------------------------------------------
  const P = amostraPistas()
  const btIds = Object.keys(G.BLOCK_TYPES)
  add('pista', 'Pista e simulação', 'Pista', [
    { t: 'p', txt: `A pista de cada sala sai da seed: distância de ${num(P.dMin)} a ${num(P.dMax)} m (de ${num(P.passo)} em ${num(P.passo)} m), de ${P.bMin} a ${P.bMax} blocos de tamanhos variados (fronteiras de 10 em 10 m), piso e clima inicial. O primeiro e o último bloco são sempre ${G.BLOCK_TYPES[P.primeiraUltima[0]].name.toLowerCase()}; os do meio são sorteados entre ${lista(btIds.map((b) => G.BLOCK_TYPES[b].name.toLowerCase()))}.` },
    { t: 'p', txt: `**Pista sem extremos:** toda pista tem pelo menos uma curva e uma subida, e nenhum tipo de bloco passa de ${pct(T.trackMaxShare, 0)} da distância. Se o sorteio não cumpre, os blocos são sorteados de novo (na mesma seed); depois de ${T.trackTries} tentativas entra um molde fixo: ${(() => { const c = [0, ...F.moldePista, 1], tp = ['reta', 'curva', 'reta', 'subida', 'reta']; return tp.map((t, i) => `${t} ${pct(c[i + 1] - c[i], 0)}`).join(', ') })()}.` },
    { t: 'tabela', rotulo: 'Frequências da pista', titulo: `Frequência em ${num(AMOSTRA)} seeds`, cab: ['Item', 'Valores'], linhas: [
      ['Composição média (da distância)', btIds.map((b) => `${G.BLOCK_TYPES[b].name} ${pct(P.compos[b], 0)} (no máximo ${pct(P.maxShare[b], 0)})`).join(' · ')],
      ['Piso', Object.keys(G.SURFACES).map((s) => `${G.SURFACES[s].name} ${pct(P.pisos[s] / AMOSTRA, 0)}`).join(' · ')],
      ['Clima inicial', clIds.map((w) => `${nomeClima(w)} ${pct(P.climas[w] / AMOSTRA, 0)}`).join(' · ')]
    ] },
    { t: 'h3', txt: 'Blocos' },
    { t: 'tabela', rotulo: 'Blocos', cab: ['Bloco', 'Fator de velocidade', 'Gasto de estamina', 'Observação'], linhas: btIds.map((b) => { const d = descreverBloco(b, F); return [G.BLOCK_TYPES[b].name, d.fator, d.gasto, d.mais] }) },
    { t: 'h3', txt: 'Pisos' },
    { t: 'tabela', rotulo: 'Pisos', cab: ['Piso', 'Perda de velocidade', 'Gasto de estamina', 'Descrição'], linhas: Object.keys(G.SURFACES).map((s) => { const x = G.SURFACES[s]; return [comIcone('pi-' + s, x.name), N(x.slow ? sinalPct(-x.slow, 0) : '0%'), N(mult(x.drain, 2)), x.desc] }) },
    { t: 'p', txt: `A perda de velocidade do piso é aliviada pela Força: perda × (1 − ${num(T.forcaSurfRelief)} × n(FOR)).` },
    { t: 'p', txt: `Nomes de hipódromo sorteados para a sala (só o nome): ${lista(F.pistas)}.` },
    { t: 'h3', txt: 'Como a corrida é simulada' },
    { t: 'p', txt: `A simulação anda em passos fixos de ${num(T.dt)} s, só com a seed e os status (sem ruído escondido). Mesma seed e mesma configuração dão o mesmo resultado.` },
    { t: 'h4', txt: 'Velocidade-alvo' },
    { t: 'formula', txt: `alvo = ritmo × vMax × piso × pelotão × chuva × fator do bloco × boosts × variação (±${pct(T.tickJitter / 2, 1)})
sobe com a aceleração; desce a ${num(T.decel)} m/s²` },
    { t: 'h4', txt: 'Ritmo do jóquei' },
    { t: 'p', txt: `O jóquei calcula o ritmo constante que o tanque restante aguenta até a chegada e guarda ${pct(T.rationReserve, 0)} de reserva. Ele lê o tanque com um erro sorteado de ${sinalPct(T.jockeyErrMin, 1)} a ${sinalPct(T.jockeyErrMax, 1)} (menor que a reserva: quase nunca cansa). Ritmo: até ${pct(T.pace.mid, 0)} + ${pct(T.pace.midEst, 1)} × (n(EST) − 0,5) da vMax até ${pct(T.pace.spurtStart, 0)} da pista, depois até ${pct(T.pace.spurtCap, 0)} + ${pct(T.pace.spurtEst, 1)} × (n(EST) − 0,5) (sprint final); nunca abaixo de ${pct(T.minPace, 0)} por vontade própria. A estimativa já conta as subidas que faltam.` },
    { t: 'h4', txt: 'Estamina' },
    { t: 'formula', txt: `gasto por segundo = (v / (vMax × boosts × fator da subida))^${T.drainExp} × (${num(T.drainRefDist)} / D)^(${fracao(T.drainDistExp[0] / T.drainDistExp[1])}) × mods / tanque
tanque = ${num(T.poolBase)} + ${num(T.poolEst)} × n(EST)
mods: piso, sol ${mult(T.sunDrain)}, subida, vácuo ${sinalPct(-T.draftSave, 0)}, skills` },
    { t: 'p', txt: 'Boosts (Garra e skills) sobem o teto sem custo extra de estamina. Pistas longas apertam mais o tanque no total.' },
    { t: 'h4', txt: 'Vácuo e pelotão' },
    { t: 'p', txt: `**Vácuo:** quem corre de ${num(T.draftMin)} a ${num(T.draftRange)} m atrás de alguém gasta ${pct(T.draftSave, 0)} menos estamina. **Pelotão:** com vizinhos a até ${num(T.crowdRange)} m, a velocidade cai até ${pct(T.crowdSlow, 0)} (teto com ${F.pelotaoMax} vizinhos); a Força alivia ${pct(T.forcaCrowdRelief, 0)} × n(FOR) disso (até zerar).` },
    { t: 'h4', txt: 'Garra' },
    { t: 'p', txt: `A arrancada de cada montaria começa em ${pct(T.garraZone, 0)} − ${pct(T.garraZoneK, 0)} × (n(GAR) − 0,5) da pista (mais Garra, mais cedo; as skills de reta final disparam no mesmo ponto). Lá a arrancada acontece **sempre** (não há chance de falhar). A força média é F = ${num(T.garraBoostBase, 3)} + ${num(T.garraBoostRange, 3)} × nc(GAR) (+ bônus de skill); a de cada corrida é F × f, com f sorteado pela seed entre ${num(1 - T.garraSpread)} e ${num(1 + T.garraSpread)}, e o teto de velocidade fica ×(1 + F × f) até a chegada. A Garra decide o quando e o quanto, em média; a seed decide se ela veio fraca ou forte naquela corrida.` },
    { t: 'h4', txt: 'Cansaço' },
    { t: 'p', txt: `Estamina zerada: o ritmo cai para ${pct(T.exhaustPace, 0)} até o fim. Se ainda faltar mais de ${pct(F.cansouFalta, 0)} da pista, aparece o aviso "cansou".` },
    { t: 'h4', txt: 'Largada e eventos' },
    { t: 'p', txt: `Cada montaria reage à largada com um atraso sorteado de até ${num(T.startDelayMax)} s × (1 − ${num(T.startAcelK, 3)} × min(n(ACE), ${num(T.startAcelMax)})). Troca de liderança só vira evento depois de ${pct(T.leadMinP, 0)} da pista, confirmada por ${num(T.leadConfirmS)} s e com pelo menos ${num(T.leadMinGapS)} s entre avisos. Depois da chegada o cavalo freia a ${F.chegadaFreio} m/s². A corrida tem teto de ${num(T.maxTime)} s.` },
    { t: 'h4', txt: 'Traçado (desenho)' },
    { t: 'p', txt: `O mapa da pista é desenhado dos blocos: retas e subidas em linha reta, e cada sequência de curvas coladas vira uma curva só, que gira ${FX.CURVA.giroPor150m}° a cada 150 m (entre ${FX.CURVA.giroMin}° e ${FX.CURVA.giroMax}°). É só desenho: a simulação usa os blocos.` }
  ])

  // 9. Montarias -----------------------------------------------------------------------------------------
  add('montarias', 'Montarias', 'Montarias', [
    { t: 'p', txt: `Há ${G.STARTERS.length} montarias iniciais e ${G.WILD_HORSES.length} selvagens. Todas são da espécie cavalo. As selvagens aparecem como bots nas corridas, como reprodutores de aluguel no Haras (menos as de raridade ${nomeRar('mitico')}) e ${F.vitrine.length} delas na vitrine da Expedição. As iniciais também aparecem como bots quando não são suas. Como o level dos bots é escolhido: ver Economia, Rivais da sala.` },
    { t: 'p', txt: `**Genética** (0 a 31 por status, nota C a S) aparece no jogo, na aba Status da montaria. Os status são os da base (sem pontos comprados). Os bots usam a genética do modelo e distribuem os pontos pela build fixa (ver Economia, Poder e ligas).` },
    { t: 'custom', md: montariasMd(F), html: montariasHtml(F) }
  ])

  // 9b. Marcas e jóquei ----------------------------------------------------------------------------------
  const MC = G.MARCAS, JQ = G.JOQUEI
  const caraRot = { nenhuma: 'nenhuma', estrela: 'estrela', listra: 'listra', frente: 'frente branca' }
  const corpoRot = { liso: 'liso', malhado: 'malhado (manchas brancas grandes)', pintado: 'pintado (pintas escuras pequenas)', ruao: 'ruão (pelos brancos salpicados)' }
  const marcaRot = (tab, id) => { if (!(id in tab)) throw new Error(`wiki: valor de marca desconhecido "${id}"`); return tab[id] }
  const brilhoCiclo = numDe('src/sprites.js', /var BRILHO_CICLO = ([\d.]+);/, 'BRILHO_CICLO (ciclo do brilho da crina)')
  const efeitoRar = (id) => {
    if (!(id in MK.N_FAISCAS) || !(id in MK.BRILHO)) throw new Error(`wiki: raridade sem efeito em marcas.js: ${id}`)
    const n = MK.N_FAISCAS[id], b = MK.BRILHO[id], t = []
    if (b > 0) t.push(`brilho na crina (mistura de ${pct(b, 0)} da cor da raridade)`)
    if (n > 0) t.push(`${n} faíscas piscando em volta`)
    if (id === 'mitico') t.push('rastro de luz atrás do cavalo no galope da corrida')
    return t.length ? t.join(' e ') : 'nada'
  }
  const marcasHorse = (h) => {
    const m = h.marcas
    if (!B.marcasValidas(m)) throw new Error(`wiki: ${h.name} sem marcas válidas em data.js`)
    return [h.name, marcaRot(caraRot, m.cara), N(String(m.patas)), marcaRot(corpoRot, m.corpo)]
  }
  add('marcas', 'Marcas e jóquei', 'Marcas e jóquei', [
    { t: 'p', txt: 'Marcas, jóquei e brilho da raridade são só desenho: não entram em status, Poder, preço nem na corrida. Cada cavalo carrega 3 genes de marcas, que o potro herda pela seed do cruzamento.' },
    { t: 'h3', txt: 'Genes de marcas' },
    { t: 'tabela', cab: ['Gene', 'Valores', 'Quantos'], linhas: [
      ['Cara', lista(MC.cara.map((v) => marcaRot(caraRot, v))), N(String(MC.cara.length))],
      ['Patas', `${lista(MC.patas.map((v) => String(v)))} meias brancas`, N(String(MC.patas.length))],
      ['Corpo', lista(MC.corpo.map((v) => marcaRot(corpoRot, v))), N(String(MC.corpo.length))]
    ] },
    { t: 'h3', txt: 'Herança no cruzamento' },
    { t: 'lista', itens: [
      `Cada gene (cara, patas, corpo, nessa ordem) vem de um dos pais, ${pct(0.5, 0)} para cada um (égua ou garanhão), com ${pct(MC.mutacao, 0)} de chance de **mutação**: o gene vira um valor qualquer da lista, com a mesma chance para todos.`,
      'Os sorteios das marcas usam uma sequência própria da seed do cruzamento. O resto do potro (raridade, estrelas, genética, skills) nasce igual a antes de existirem marcas.',
      'Cavalo sem marcas válidas (save antigo) vale pelas marcas do modelo do catálogo ou, na falta dele, por marcas calculadas do identificador dele: o mesmo cavalo tem sempre as mesmas marcas.',
      `${nomeRar('mitico')} nunca nasce de cruzamento, com ou sem marcas. A ficha da montaria e o Haras mostram a linha "Marcas: …".`
    ] },
    { t: 'h3', txt: 'Jóquei do jogador' },
    { t: 'lista', itens: [
      `Na aba Perfil você escolhe o **padrão da seda** (${lista(JQ.padroes.map((p) => p))}) e a **cor do capacete** (${JQ.capacetes.length} cores). O padrão inicial é "${JQ.padrao}" e o capacete inicial é ${JQ.nomes[JQ.capacete]}. Cores de capacete: ${lista(JQ.capacetes.map((c) => JQ.nomes[c]))}.`,
      'A seda continua na cor de sempre (a sua é dourada; a dos rivais é a cor da raia); o padrão vai por cima em um tom mais claro ou mais escuro. A escolha vale para todos os seus cavalos.',
      'O jóquei dos rivais (padrão e capacete) sai da seed da sala.'
    ] },
    { t: 'h3', txt: 'Raridade visível' },
    { t: 'p', txt: `Cada raridade ganha um efeito na cor dela. O brilho da crina corre a cada ${num(brilhoCiclo)} s, na cor da raridade clareada; numa crina em que essa cor quase não aparece, na clareada ou na escurecida, a que mais se destaca. Com movimento reduzido, o brilho fica parado, as faíscas ficam fixas e não há rastro.` },
    { t: 'tabela', cab: ['Raridade', 'Efeito'], linhas: B.RARITY_IDS.map((r) => [nomeRar(r), efeitoRar(r)]) },
    { t: 'h3', txt: 'Marcas dos iniciais e selvagens' },
    { t: 'tabela', cab: ['Cavalo', 'Cara', 'Patas (meias)', 'Corpo'], linhas: G.STARTERS.concat(G.WILD_HORSES).map(marcasHorse) }
  ])

  // 9c. Portes -------------------------------------------------------------------------------------------
  const PT = G.PORTES
  const porteRot = (id) => { if (!(PT.valores.indexOf(id) >= 0) || !PT.nomes[id]) throw new Error(`wiki: porte desconhecido "${id}"`); return PT.nomes[id] }
  const porteHorse = (h) => [h.name, nomeEl(h.element), porteRot(h.porte)]
  add('portes', 'Portes', 'Portes', [
    { t: 'p', txt: 'O porte é o tamanho e a forma do corpo do cavalo. Como as marcas, é só desenho: não entra em status, Poder, preço, aluguel nem na corrida. O mesmo porte tem o mesmo corpo nos três elementos.' },
    { t: 'tabela', cab: ['Porte', 'Como se reconhece de lado'], linhas: [
      [porteRot('esguio'), 'pernas longas e finas, pescoço comprido, cabeça pequena, cauda alta'],
      [porteRot('padrao'), 'meio-termo: corpo equilibrado, perfil de cabeça levemente curvo'],
      [porteRot('robusto'), 'mais baixo e largo, peito e pescoço grossos, pernas curtas e fortes, crina farta']
    ] },
    { t: 'h3', txt: 'Herança no cruzamento' },
    { t: 'lista', itens: [
      `O potro herda o porte de um dos pais (égua ou garanhão), ${pct(0.5, 0)} para cada um, com ${pct(PT.mutacao, 0)} de chance de **mutação**: o porte vira um dos ${PT.valores.length} da lista, com a mesma chance para todos (pode sair o mesmo).`,
      'O sorteio usa uma sequência própria da seed do cruzamento, separada das marcas. O resto do potro nasce igual a antes de existirem portes.',
      `Cavalo sem porte válido (save antigo) vale pelo porte do modelo do catálogo ou, na falta dele, por um porte calculado do identificador dele: o mesmo cavalo tem sempre o mesmo porte. O padrão do jogo é ${porteRot(PT.padrao)}.`,
      `${nomeRar('mitico')} nunca nasce de cruzamento, com ou sem porte.`
    ] },
    { t: 'h3', txt: 'Porte dos iniciais e selvagens' },
    { t: 'tabela', cab: ['Cavalo', 'Elemento', 'Porte'], linhas: G.STARTERS.concat(G.WILD_HORSES).map(porteHorse) }
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
    { t: 'tabela', rotulo: 'Aluguel', titulo: 'Preço do aluguel (base × estrelas)', cab: ['Raridade', ...BR.grauMult.map((w, i) => estrelas(i + 1))], linhas: Object.keys(BR.rentalBase).map((r) => [rarCel(r), ...BR.grauMult.map((w, i) => ouroCel(B.rentalPrice({ rarity: r, grau: i + 1 })))]) },
    { t: 'tabela', rotulo: 'Reprodutores de aluguel', titulo: 'Reprodutores de aluguel', cab: ['Montaria', 'Sexo', 'Elemento', 'Raridade', 'Estrelas', 'Level', 'Aluguel'], linhas: alugaveis.map((h) => [h.name, h.sex === 'f' ? '♀ fêmea' : '♂ macho', elCel(h.element), rarCel(h.rarity), N(estrelas(h.grau)), N(String(h.level)), ouroCel(B.rentalPrice(h))]) },
    { t: 'h3', txt: 'Fator de nível (L)' },
    { t: 'formula', txt: `L = clamp((${num(BR.mareWeight)} × level da égua + ${num(1 - BR.mareWeight)} × level do garanhão) / ${BR.levelSaturation}, 0, 1)` },
    { t: 'p', txt: `L vai de 0 (pior) a 1 (melhor). As chances são interpoladas em linha reta entre a coluna "L = 0" e a "L = 1". Dois pais no level 1 dão L = ${num(B.levelFactor({ level: 1 }, { level: 1 }), 3)}.` },
    { t: 'h3', txt: 'Raridade do potro' },
    { t: 'p', txt: `A base é a **menor** raridade entre os pais. O potro pode nascer 1 abaixo, igual, 1 acima ou 2 acima; pais da mesma raridade usam a linha "igual", pais diferentes a linha "misturada". O resultado nunca passa de ${nomeRar(B.RARITY_IDS[B.TUNING.maxRarityOrder])} (o que passaria soma no limite).` },
    { t: 'tabela', rotulo: 'Chances de raridade (colunas)', cab: ['Linha', 'L', '1 abaixo', 'Igual', '1 acima', '2 acima'], linhas: ['same', 'mixed'].flatMap((k) => [['lv1', 'L = 0'], ['lv30', 'L = 1']].map(([c, rot]) => [k === 'same' ? 'Mesma raridade' : 'Raridades diferentes', rot, ...B.TUNING.rarity[k][c].map((x) => N(num(x, 1) + '%'))])) },
    tabelaPares(0),
    tabelaPares(BR.levelSaturation),
    { t: 'h3', txt: 'Estrelas do potro' },
    { t: 'p', txt: `As estrelas do potro multiplicam os pontos que ele ganha por level (ver Raridades). Estrelas base = arredondar(${num(BR.mareWeight)} × estrelas da égua + ${num(1 - BR.mareWeight)} × estrelas do garanhão). Se a raridade **subiu**, o potro nasce ${estrelas(1)}; se **desceu**, nasce ${estrelas(BR.grauMult.length)}. Se manteve, sorteia desce/mantém/sobe (fora de 1–3 soma em "mantém").` },
    { t: 'tabela', rotulo: 'Estrelas do potro', cab: ['Estrelas base', 'L', ...BR.grauMult.map((w, i) => estrelas(i + 1))], linhas: BR.grauMult.flatMap((w, i) => [0, BR.levelSaturation].map((lv) => { const o = gO(i + 1, lv); return [N(estrelas(i + 1)), lv ? 'L = 1' : 'L = 0', ...BR.grauMult.map((x, j) => N(o[j + 1] > 0 ? pct(o[j + 1], 0) : '—'))] })) },
    { t: 'h3', txt: 'Tipo, sexo e genética' },
    { t: 'lista', itens: [
      `**Tipo:** se os pais têm o mesmo, o potro herda; senão, ${pct(F.elementoPotro, 0)} de chance de cada um. A skill de tipo vem com o tipo.`,
      `**Sexo:** ${pct(F.sexoPotro, 0)} fêmea, ${pct(1 - F.sexoPotro, 0)} macho.`,
      `**Genética:** para cada status, ${pct(B.TUNING.potInherit, 0)} de chance de herdar a de um dos pais (${pct(F.potroPai, 0)} para cada); senão sai de 0 a ${F.potValores - 1}. Os status do potro saem da genética e da raridade; ele nasce no level 1, sem pontos.`,
      `**Nome:** sorteado entre ${G.FOAL_NAMES.length}: ${lista(G.FOAL_NAMES)}.`,
      '**Cores:** mistura das cores dos pais.'
    ] },
    { t: 'h3', txt: 'Skills do potro' },
    { t: 'passos', itens: [
      'Candidatas: as skills de vaga dos pais que servem para o tipo do potro.',
      `Corcel: com 1 pai Corcel, 1 skill garantida (${pct(F.corcelDois, 0)} de chance de 2); com os 2 pais Corcel, 2 garantidas.`,
      `Cada candidata restante passa com ${pct(B.TUNING.skillInherit, 0)} de chance.`,
      'Corte nas vagas da raridade do potro.',
      'Se ficou abaixo das skills ao nascer da raridade, completa com skills sorteadas que servem para o tipo.',
      'Rank: cada skill herdada nasce 1 rank abaixo do pai que a tem (se os dois têm, vale o maior), nunca abaixo do I; a skill sorteada para completar nasce no rank I. O rank não usa sorteio (ver Skills, Rank das skills).'
    ] }
  ])

  // 11. Equipamento (só PVE: treino AFK) ---------------------------------------------------------------
  const gearIds = Object.keys(G.GEAR)
  const gearRar = Object.keys(EG.price)
  const pedras = pedrasEsperadas()
  const setIds = Object.keys(G.GEAR_SETS)
  const FARM_NOME = { material: 'Material do ginásio', xp: 'XP', raro: 'Drop raro (incomum, Pedra Negra, peça, comida)', trofeu: 'Chance de troféu', ouro: 'Ouro do treino' }
  for (const t of Object.keys(EG.faixas)) if (!FARM_NOME[t]) throw new Error(`wiki: linha de farm desconhecida "${t}" — dê um nome em FARM_NOME (prototype/tools/wiki.mjs)`)
  const rarComLinha = gearRar.filter((r) => EG.linhas[r] > 0)
  const bonusTxt = (n) => {
    const partes = [`linhas de farm ${sinalPct(EG.setBonus.farm, 0)} (cada bônus × ${num(1 + EG.setBonus.farm)})`]
    if (n >= EG.setBonus.pieces[1]) partes.push(`no clima do conjunto, o bônus do elemento dono sobe para ${multF(EG.setBonus.clima)} (não acumula com a skill de clima: vale o maior)`)
    if (n >= EG.setBonus.pieces[2]) partes.push(`anula a penalidade de clima (${multF(2 - T.weatherMult)} vira ×1)`)
    return partes.join('; ')
  }
  const peca = (id) => G.GEAR[id]
  const pecasOp = (d) => d.pecas ? `${G.GEAR_SLOTS.length} ${nomeRar(d.pecas.rar)}s +${d.pecas.plus}${d.pecas.doConjunto ? ' do conjunto do ginásio' : ''} (+${num(EG.main[d.pecas.rar] + d.pecas.plus * EG.plusStep, 2)} em cada status principal)` : 'sem peças'
  add('equipamento', 'Equipamento', 'Equipamento', [
    { t: 'nota', txt: '**Só vale no treino AFK (PVE).** O equipamento nunca entra na corrida valendo, na sala, no Poder nem nos duelos de ginásio: lá todo cavalo corre sem peças.' },
    { t: 'p', txt: `Cada montaria tem ${G.GEAR_SLOTS.length} slots. Cada peça soma um **status principal de corrida** (o valor da raridade + a melhoria), definido pelo slot, e tem **linhas de farm** sorteadas pela seed quando a peça nasce. Peças ${lista(gearRar.filter((r) => !gearIds.some((id) => peca(id).rarity === r && peca(id).set)).map(nomeRar))} são soltas; ${lista(gearRar.filter((r) => gearIds.some((id) => peca(id).rarity === r && peca(id).set)).map(nomeRar))} pertencem a um conjunto (${lista(setIds.map(nomeConjunto))}). O status da corrida é inteiro: a soma das peças de um slot é arredondada (${num(EG.main.raro + 5 * EG.plusStep, 2)} vira +${Math.round(EG.main.raro + 5 * EG.plusStep)}).` },
    { t: 'tabela', rotulo: 'Slots', cab: ['Slot', 'Status principal'], linhas: G.GEAR_SLOTS.map((s) => [slotCel(s), nomeStat(G.GEAR_SLOT_INFO[s].main)]) },
    { t: 'tabela', rotulo: 'Peças por raridade', cab: ['Raridade', 'Principal', 'Linhas de farm', 'Preço', 'Venda', 'Na loja'], linhas: gearRar.map((r) => { const id = gearIds.find((x) => peca(x).rarity === r); return [rarCel(r), N('+' + num(EG.main[r], 2)), N(String(EG.linhas[r])), ouroCel(EG.price[r]), ouroCel(GR.sellPrice(id)), peca(id).shop ? 'sim' : '**nunca à venda**'] }) },
    { t: 'p', txt: `Venda devolve ${pct(EG.sellRate, 0)} do preço. Peças ${lista(gearRar.filter((r) => gearIds.some((id) => peca(id).rarity === r && !peca(id).shop)).map(nomeRar))} nunca estão à venda. Equipamento inicial: ${lista(EG.startGear.map((id) => peca(id).name))}.` },
    { t: 'h3', txt: 'Linhas de farm', id: 'linhas-de-farm' },
    { t: 'p', txt: `Cada linha tem um tipo (sem repetir na mesma peça) e um valor inteiro em pontos percentuais, sorteado na faixa da raridade (sorteio uniforme). Os percentuais das peças equipadas somam entre si e multiplicam o ganho do treino AFK daquele cavalo (com o bestiário). A melhoria sobe só o principal.` },
    { t: 'tabela', rotulo: 'Linhas de farm', cab: ['Tipo', ...rarComLinha.map(nomeRar)], linhas: Object.keys(EG.faixas).map((t) => [FARM_NOME[t], ...rarComLinha.map((r) => N(`${EG.faixas[t][r][0]}–${EG.faixas[t][r][1]}%`))]) },
    { t: 'h3', txt: 'Catálogo completo' },
    { t: 'tabela', rotulo: 'Catálogo de peças', classe: 'catalogo', cab: ['Peça', 'Slot', 'Raridade', 'Conjunto', 'Principal', 'Preço', 'Loja'], linhas: gearIds.map((id) => {
      const p = peca(id), info = G.GEAR_SLOT_INFO[p.slot]
      return [{ md: `**${p.name}**`, html: `<strong>${esc(p.name)}</strong>` }, slotCel(p.slot), rarCel(p.rarity), p.set ? nomeConjunto(p.set) : '—', N(`+${num(p.main, 2)} ${siglaStat(info.main)}`), ouroCel(p.price), p.shop ? 'sim' : 'não']
    }), entradas: gearIds.map((id) => {
      const p = peca(id)
      return { id: 'peca-' + id, tipo: 'peca', busca: [p.name, nomeSlot(p.slot), nomeRar(p.rarity), p.set ? 'conjunto ' + nomeConjunto(p.set) : '', p.set && G.WEATHERS[G.GEAR_SETS[p.set].weather].element ? nomeEl(G.WEATHERS[G.GEAR_SETS[p.set].weather].element) : ''], rar: p.rarity, el: p.set ? G.WEATHERS[G.GEAR_SETS[p.set].weather].element : null }
    }), vazio: { tipo: 'peca', txt: 'Nenhuma peça casa com a busca e os filtros.' } },
    { t: 'h3', txt: 'Melhoria (+1 a +' + EG.plusMax + ')', id: 'melhoria' },
    { t: 'p', txt: `Cada tentativa gasta Pedras Negras e tem uma chance de sucesso (sorteio pela seed do save). A partir de +${EG.enhanceDropFrom}, a falha **derruba** a peça 1 nível. Cada + soma ${num(EG.plusStep, 2)} no status principal (uma peça +${EG.plusMax} soma +${num(EG.plusStep * EG.plusMax, 2)}). Pedra Negra: ${num(EG.stonePrice)} de Ouro na loja (pacote de ${EG.stoneBundle} = ${num(EG.stonePrice * EG.stoneBundle)}); também cai no treino AFK e sai da forja.` },
    { t: 'tabela', rotulo: 'Melhoria', cab: ['Passo', 'Chance', 'Custo (pedras)', 'Se falhar', 'Pedras esperadas no passo', 'Pedras esperadas desde +0'], linhas: pedras.map((p) => [`+${p.de} → +${p.de + 1}`, N(pct(p.chance, 0)), N(String(p.custo)), p.cai < p.de ? `cai para +${p.cai}` : `fica em +${p.de}`, N(num(p.esperado, 1)), N(num(p.acumulado, 1))]) },
    { t: 'p', txt: `**Pedra Negra do pódio:** desligada (a corrida valendo dá o ${G.ITEMS.pergaminho.name}); a Pedra vem da loja, do treino AFK e da forja.` },
    { t: 'h3', txt: 'Conjuntos', id: 'conjuntos' },
    { t: 'tabela', rotulo: 'Conjuntos', cab: ['Conjunto', 'Clima', 'Elemento favorecido', 'Peças'], linhas: setIds.map((s) => { const w = G.GEAR_SETS[s].weather; return [nomeConjunto(s), nomeClima(w), G.WEATHERS[w].element ? elCel(G.WEATHERS[w].element) : '—', gearIds.filter((id) => peca(id).set === s).map((id) => `${peca(id).name} (${nomeRar(peca(id).rarity)})`).join(', ')] }) },
    { t: 'tabela', rotulo: 'Bônus de conjunto', titulo: 'Bônus total por número de peças do mesmo conjunto (cada linha já é o total; só no treino AFK)', cab: ['Peças', 'Bônus'], linhas: EG.setBonus.pieces.map((n) => [N(String(n)), bonusTxt(n)]) },
    { t: 'p', txt: `Cada linha é o total daquele patamar, não soma com as de cima. Vale o conjunto com mais peças equipadas (empate: ${lista(setIds.map(nomeConjunto))}, nessa ordem).` },
    { t: 'h3', txt: 'Peças dos oponentes do treino AFK' },
    { t: 'tabela', rotulo: 'Peças dos oponentes', cab: ['Dificuldade', 'Peças do oponente'], linhas: G.AFK.difs.map((d) => [d.name, pecasOp(d)]) },
    { t: 'p', txt: 'Os bots da sala e os oponentes dos ginásios de verdade correm sempre sem peças.' }
  ])

  // 12. Economia -----------------------------------------------------------------------------------------
  const nR = []
  for (let n = E.minRacers; n <= E.maxRacers; n++) nR.push(n)
  const entradaEx = E.entryTiers[1] != null ? E.entryTiers[1] : E.entryTiers[0]
  const pesos = {}
  skIds.forEach((id) => { const t = G.SKILLS[id].trigger.indexOf('weather:') === 0 ? 'weather:*' : G.SKILLS[id].trigger; pesos[t] = pesoSkill(id) })
  add('economia', 'Economia', 'Economia', [
    { t: 'p', txt: `Moeda única hoje: **Ouro**. Começa com ${num(E.startingGold)}. Ganha-se Ouro correndo (prêmios e treino), na recompensa diária (Ouro que entra sem precisar correr; ver Itens), nos prêmios dos ginásios (a 1ª vitória de cada etapa e a revanche do líder; ver Ginásios da Expedição) e vendendo peças; gasta-se em entradas (das corridas e dos ginásios), na subida de rank das skills (junto com ${PG.plural}; ver Skills), na loja de itens, em peças, Pedras Negras, aluguel e registro de cruza, Troca e vagas do estábulo.` },
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
    { t: 'p', txt: 'O **Poder** resume a montaria, sem equipamento: soma ponderada dos status (com os pontos comprados) + skills (com o rank de cada uma) + level e raridade. Os pesos vêm de uma regressão sobre milhares de salas; o tipo não entra (level e raridade valem o mesmo para os três). Ele define a liga e os rivais da sala.' },
    { t: 'formula', txt: `Poder = ${G.STAT_KEYS.map((k) => `${num(T.ratingW[k], 2)}·${siglaStat(k)}`).join(' + ')}
      + ${num(T.ratingSkillPts)} × peso do gatilho × fator do rank, por skill      (fator do rank: ${rankIds.map((r) => `${romano(r)} ${multF(S.rankScale(r))}`).join(', ')})
      + ${num(T.ratingLevel)} × (level − 1) / ${E.maxLevel - 1} + ${num(T.ratingRar)} × ordem da raridade / 4` },
    { t: 'tabela', rotulo: 'Peso do gatilho', titulo: 'Peso do gatilho no Poder', cab: ['Gatilho', 'Peso', 'Pontos por skill (rank I)'], linhas: Object.keys(pesos).map((t) => [t === 'weather:*' ? 'Clima (qualquer)' : descreverGatilho(t), N(num(pesos[t], 2)), N(num(pesos[t] * T.ratingSkillPts))]) },
    { t: 'tabela', rotulo: 'Ligas', cab: ['Liga', 'Poder', 'Cor'], linhas: G.LEAGUES.map((L) => { const f = S.leagueFor(L.min); return [{ md: icMd('liga-' + L.id) + L.name, html: `<span class="liga" style="--c:${L.color}">${icone('liga-' + L.id)}${esc(L.name)}</span>` }, N(f.max == null ? `${num(L.min)} ou mais` : `${num(L.min)}–${num(f.max)}`), { md: L.color, html: `<code>${L.color}</code>` }] }) },
    { t: 'p', txt: `**Rivais da sala:** cada bot mira um Poder entre ${sinalPct(F.botAlvo[0] - 1, 1)} e ${sinalPct(F.botAlvo[0] + F.botAlvo[1] - 1, 1)} do seu (leve viés para cima)${F.gearPvp ? ', com o equipamento da liga desse alvo' : ''}. Para cada modelo (selvagens e iniciais), procura o level mais perto do alvo só na faixa do modelo: de ${F.botFaixaNivel[0]} levels abaixo a ${F.botFaixaNivel[1]} acima do level dele, entre 1 e ${E.maxLevel}. O modelo só entra se ficar a até ${pct(F.botFaixa, 0)} do alvo (prefere modelos ainda não usados na sala). Sem nenhum candidato, usa um dos ${F.botReserva} modelos mais próximos, em qualquer level. Nenhum bot usa o modelo de uma montaria que você tem. As skills de vaga dos bots ficam todas no rank médio (arredondado) das skills de vaga do seu cavalo, e esse rank entra no Poder do bot (ver Skills, Rank das skills).` },
    { t: 'p', txt: `**Build dos bots** (sem sorteio; é também o botão "Distribuir sugerido", que continua do que o jogador já comprou): um ponto por vez no status de menor (pontos + 1) / peso, entre os que ainda aceitam (peso acima de 0, abaixo de ${T.statMax} e com o próximo ponto cabendo no que sobra); empate na ordem ${lista(G.STAT_KEYS.filter((k) => (T.noBuy || []).indexOf(k) < 0).map(siglaStat))}. A ${nomeStat('sorte')} não recebe pontos.` },
    { t: 'tabela', rotulo: 'Pesos da build dos bots', titulo: 'Pesos da build dos bots', cab: ['Tipo', ...G.STAT_KEYS.map(siglaStat)], linhas: elIds.map((e) => [elCel(e), ...G.STAT_KEYS.map((k) => N(T.botW[e] && T.botW[e][k] ? num(T.botW[e][k], 2) : '—'))]) },
    { t: 'tabela', rotulo: 'Poder das iniciais', titulo: 'Poder das iniciais (sem equipamento)', cab: ['Montaria', 'Nv 1', `Nv 25, build dos bots`, `Nv ${E.maxLevel} sem pontos`, `Nv ${E.maxLevel}, build dos bots`], linhas: G.STARTERS.map((h) => { const h25 = { ...h, level: 25 }, h50 = { ...h, level: E.maxLevel }; const c = (x) => { const pr = S.powerRating(x); return N(`${num(pr)} (${S.leagueFor(pr).name})`) }; return [h.name, c(h), c({ ...h25, alloc: S.botAlloc(h25) }), c(h50), c({ ...h50, alloc: S.botAlloc(h50) })] }) }
  ])

  // 12b. Itens e recompensa diária -----------------------------------------------------------------------
  // tudo de GameData.ITEMS / DAILY / BAG_MAX; item novo sem as regras abaixo quebra o wiki
  const IT = G.ITEMS, DY = G.DAILY, itIds = G.ITENS_USO
  const nomeItem = (id) => { if (!IT[id]) throw new Error(`wiki: item desconhecido "${id}"`); return IT[id].name }
  const salaTxt = 'não no cavalo ativo com a sala aberta'
  const limitesItem = {
    torrao: () => `até ${num(IT.torrao.cap)} por cavalo; o potro nasce com 0; os bots não têm`,
    estrela: () => `não em cavalo ${estrelas(T.starMult.length)}`,
    redea: () => 'as travas do Redistribuir: sem pontos distribuídos não redistribui; o ativo não redistribui com a sala aberta; a Rédea só é gasta depois da redistribuição grátis',
    cupom: () => `precisa de skill nas vagas e de candidata; a skill de tipo nunca troca; ${salaTxt}`,
    manual: () => `${pct(IT.manual.chance, 0)} de chance de aprender; precisa de vaga livre e de candidata; ${salaTxt}`,
    pergaminho: () => `não se usa pela mochila: é gasto, com Ouro, ao subir o rank de uma skill (aba Skills do cavalo); o cavalo ativo não sobe rank com a sala aberta`
  }
  const limiteItem = (id) => { if (!limitesItem[id]) throw new Error(`wiki: item "${id}" sem limites no wiki`); return limitesItem[id]() }
  const compraItem = (id) => IT[id].price == null ? '—' : IT[id].everyDays ? `1 a cada ${IT[id].everyDays} dias` : `${IT[id].perDay} por dia`
  const premioTxt = (d) => [d.ouro ? `${num(d.ouro)} de Ouro` : null, d.item ? `1 ${nomeItem(d.item)}` : null].filter(Boolean).join(' e ')
  const ouroCiclo = DY.dias.reduce((a, d) => a + (d.ouro || 0), 0)
  const itensCiclo = DY.dias.filter((d) => d.item && IT[d.item].price != null)
  add('itens', 'Itens e recompensa diária', 'Itens', [
    { t: 'p', txt: `São ${itIds.length} itens. ${itIds.length - 1} são de uso único: cada uso vale para um cavalo, pede confirmação e não tem volta. O ${PG.name} não se usa pela mochila: é gasto, com Ouro, ao subir o rank de uma skill (ver Skills, Rank das skills). A mochila guarda até ${num(G.BAG_MAX)} de cada (a ${nomeItem('redea')} tem o teto dela, ${num(F.redeasMax)}). A loja só aceita Ouro e respeita o Ouro reservado para a entrada da sala aberta.` },
    { t: 'tabela', rotulo: 'Itens', cab: ['Item', 'Para que serve', 'Limites e quando não pode', 'Preço na loja', 'Compra', 'De onde vem'], linhas: itIds.map((id) => [
      { md: `**${IT[id].name}**`, html: `<strong>${esc(IT[id].name)}</strong>` }, IT[id].desc, limiteItem(id), IT[id].price == null ? '**não se vende**' : ouroCel(IT[id].price), N(compraItem(id)), IT[id].origem]) },
    { t: 'p', txt: `**Dos ginásios**, qual etapa dá cada item (ver Ginásios da Expedição): ${itIds.filter((id) => fonteGin(id)).map((id) => `${nomeItem(id)}, ${fonteGin(id)}`).join('; ')}.` },
    { t: 'p', txt: `**Torrão:** os pontos do cavalo passam a ser os do level, da raridade e das estrelas mais os torrões (somados depois do piso; ver Status). O teto de ${T.statMax} por status não muda. Os torrões são do cavalo e saem com ele na Troca do Haras.` },
    { t: 'p', txt: `**Estrela:** só muda as estrelas do cavalo; os pontos a mais aparecem para distribuir. Vale como qualquer estrela, inclusive na cruza (ver Cruzamento).` },
    { t: 'p', txt: `**Cupom e Manual:** as candidatas são as mesmas do aprendizado por level (as skills gerais e as do tipo do cavalo, menos as que ele já tem); no Cupom, a skill que sai não volta no mesmo sorteio e a nova fica na mesma posição. A skill que entra (pelo Cupom ou pelo Manual) fica no rank I; no Cupom, o rank da que sai é perdido, e a confirmação avisa. O sorteio sai da seed do save e de um contador de usos que é gravado junto com o resultado: recarregar a página não muda nada. O aprendizado por level continua com ${pct(T.learnChance, 0)} por level.` },
    { t: 'p', txt: `**Pergaminho:** O ${PG.name} não está à venda: cai no pódio das corridas valendo (${pergPodio}, pela seed da sala; nunca em treino) e vem ${fonteGin('pergaminho')}, entre parênteses quantos. Nunca por Gemas. Custo de cada rank e as regras: ver Skills, Rank das skills.` },
    { t: 'p', txt: `**Onde se usa:** na Loja, parte Mochila, o botão Usar abre a escolha do cavalo (no Cupom, também a da skill que sai) e depois a confirmação. Na ficha do cavalo, só quando a mochila tem o item: ${nomeItem('torrao')} e ${nomeItem('estrela')} na aba Status; ${nomeItem('manual')} e o Trocar de cada skill (Cupom) na aba Skills. A ${nomeItem('redea')} usada pela Mochila leva ao Redistribuir da ficha do cavalo escolhido. O ${PG.name} aparece na Mochila sem o botão Usar; a aba Skills mostra quantos há e o custo de cada subida. O cavalo que não pode receber o item aparece apagado, com o motivo.` },
    { t: 'h3', txt: 'Limites da loja', id: 'loja-limites' },
    { t: 'p', txt: `A loja mostra os itens sempre nesta ordem: ${lista(G.SHOP_ORDER.map(nomeItem))}. Cada produto diz quantos ainda dá para comprar hoje ("Restam 1 de ${IT.torrao.perDay} hoje"; na ${nomeItem('estrela')}, "disponível" ou "de novo em N dias"). Quando não dá, o botão diz por quê, nesta ordem: ${lista(['limite', 'cheia', 'sem-ouro', 'reservado'].map((k) => { if (!F.lojaRotulo[k]) throw new Error(`wiki: rótulo "${k}" fora do LOJA_ROTULO`); return `"${F.lojaRotulo[k]}"` }), 'ou')} (o Ouro que sobra está guardado para a entrada da sala aberta).` },
    { t: 'p', txt: `Os limites por dia voltam a zero quando o dia muda; o da ${nomeItem('estrela')} conta ${IT.estrela.everyDays} dias desde a última compra. Com a mochila cheia (${num(G.BAG_MAX)}) aquele item não se compra. A ${nomeItem('redea')} não está à venda: vem no ${ordinal(DY.dias.length)} dia da recompensa diária${fonteGin('redea') ? ' e ' + fonteGin('redea') : ''}.` },
    { t: 'h3', txt: 'Recompensa diária', id: 'diaria' },
    { t: 'p', txt: `Um calendário de ${DY.dias.length} dias com prêmios fixos, sem sorteio. Resgata-se uma vez por dia, só de abrir o jogo e tocar em Resgatar (não precisa correr). Não zera: quem falta continua de onde parou. Depois do ${ordinal(DY.dias.length)} dia recomeça no 1º, e a cada ${DY.estrelaACada} calendários completos o ${ordinal(DY.dias.length)} dia também dá 1 ${nomeItem('estrela')} (o ${ordinal(DY.dias.length * DY.estrelaACada)} resgate é o primeiro). Um save novo já começa com o dia 1 para resgatar.` },
    { t: 'tabela', rotulo: 'Recompensa diária', cab: ['Dia', 'Prêmio'], linhas: DY.dias.map((d, i) => [N(ordinal(i + 1)), premioTxt(d) + (i === DY.dias.length - 1 ? `; a cada ${DY.estrelaACada} calendários completos, também 1 ${nomeItem('estrela')}` : '')]) },
    { t: 'p', txt: `O Ouro entra direto no saldo; o item vai para a mochila. Se a mochila estiver cheia daquele item (${num(G.BAG_MAX)}, ou ${num(F.redeasMax)} ${IT.redea.plural}), o resgate do dia espera e o cartão diz por quê. Depois do resgate, o cartão vira uma linha com o prêmio de amanhã. Por calendário: ${num(ouroCiclo)} de Ouro e ${lista(itensCiclo.map((d) => nomeItem(d.item)))} (${num(itensCiclo.reduce((a, d) => a + IT[d.item].price, 0))} de Ouro pelo preço da loja), mais a ${nomeItem('redea')}.` },
    { t: 'p', txt: `**O dia** é a data do aparelho, no fuso dele, guardada como número de dias. Cada registro guarda o seu último dia: a diária, o do último resgate; a loja, o da última compra; a ${nomeItem('estrela')}, o da última ${nomeItem('estrela')}; a revanche de cada ginásio, o da última tentativa. Com o relógio para trás, o registro não volta até a data passar de novo do último dia dele; nada se perde. Sem servidor, quem mexe no relógio do aparelho consegue resgates e compras a mais (por exemplo: último resgate no dia 90; pondo o relógio em 91, 92 … 100, são 10 resgates no mesmo dia real); isso só se fecha com o servidor.` }
  ])

  // 12c. Ginásios ----------------------------------------------------------------------------------------
  // tudo de GameData.GYM / GYM_ORDER / GYMS (nenhum número escrito aqui); tipo de insígnia desconhecido quebra o wiki
  const GY = G.GYM, gyIds = G.GYM_ORDER
  const nomeCatalogo = (id) => { const h = G.STARTERS.concat(G.WILD_HORSES).find((x) => x.id === id); if (!h) throw new Error(`wiki: cavalo de ginásio com base desconhecida "${id}"`); return h }
  const cavaloGym = (c) => `${nomeCatalogo(c.base).name} (Nv ${c.level}, ${estrelas(c.grau)}, ${nomeRar(nomeCatalogo(c.base).rarity)})`
  const premioGym = (p) => [p.ouro ? `${num(p.ouro)} de Ouro` : null, ...p.itens.map((id) => `1 ${nomeItem(id)}`), p.pergaminhos ? pergTxt(p.pergaminhos) : null].filter(Boolean).join(', ')
  const pistaGym = (p) => `${num(p.distance)} m, ${G.SURFACES[p.surface].name.toLowerCase()}: ${p.blocks.map((b) => `${G.BLOCK_TYPES[b.type].name.toLowerCase()} ${num(b.to - b.from)} m`).join(', ')}`
  const bonusIns = (id) => {
    const ins = GY.insignias[id]
    switch (ins.tipo) {
      case 'ouro': return `+${pct(ins.valor, 1)} de Ouro nos prêmios das corridas valendo (arredondado para baixo)`
      case 'xp': return `+${pct(ins.valor, 1)} de XP para os cavalos, nas corridas e nos duelos (arredondado)`
      case 'skill': return `+${num(ins.valor * 100, 1)} pontos na chance de aprender skill ao subir de level (${pct(T.learnChance, 0)} → ${pct(T.learnChance + ins.valor, 0)})`
      default: throw new Error(`wiki: insígnia com tipo desconhecido "${ins.tipo}"`)
    }
  }
  const fx = GY.fadiga.faixas
  const faixaTxt = (f, i) => f.ate === null ? `${num(fx[i - 1].ate)} m ou mais` : i === 0 ? `menos de ${num(f.ate)} m` : `de ${num(fx[i - 1].ate)} a menos de ${num(f.ate)} m`
  const cicloTxt = GY.revanche.ciclo.map((c) => c.ouro ? `${num(c.ouro)} de Ouro` : `1 ${nomeItem(c.item)}`)
  add('ginasios', 'Ginásios da Expedição', 'Ginásios', [
    { t: 'p', txt: `São ${gyIds.length} ginásios, um por elemento, cada um com ${G.GYMS[gyIds[0]].etapas.length - 1} soldados e o líder, sempre com cavalos do elemento do ginásio. As etapas abrem em ordem; etapa vencida fica marcada e não se repete. Os cavalos dos soldados são fixos (a montaria-base do catálogo no level e nas estrelas da etapa, com a build dos bots e as skills de vaga dela no rank fixo da etapa, sem sorteio). A aba Expedição mostra os ginásios, a trilha de cada um, o preparo, os duelos e o resumo (ver Visão geral, Abas).` },
    { t: 'tabela', rotulo: 'Ginásios', cab: ['Ginásio', 'Elemento', 'Líder', 'Ponto fraco', 'Pista da casa', 'Insígnia'], linhas: gyIds.map((id) => {
      const g = G.GYMS[id]
      return [{ md: `**${g.name}**`, html: `<strong>${esc(g.name)}</strong>` }, elCel(g.element), g.lider, elCel(g.fraco), pistaGym(g.pista), { md: `${icMd(g.insignia.icone)}${g.insignia.name}: ${bonusIns(id)}`, html: `${icone(g.insignia.icone)}${esc(g.insignia.name)}: ${esc(bonusIns(id))}` }]
    }) },
    ...gyIds.flatMap((id) => {
      const g = G.GYMS[id]
      return [
        { t: 'h3', txt: `Trilha do ${g.name}`, id: 'ginasio-' + id },
        { t: 'tabela', rotulo: `Trilha do ${g.name}`, cab: ['Etapa', 'Adversário', 'Cavalos (na ordem)', 'Rank das skills', 'Entrada', 'Prêmio da 1ª vitória'], linhas: g.etapas.map((e, i) => [
          N(e.lider ? 'Líder' : `Soldado ${i + 1}`), e.nome, e.cavalos.map(cavaloGym).join(' · '), N(romano(rankEtapa(e))), ouroCel(e.entrada), premioGym(e.premio) + (e.lider ? ` e a ${g.insignia.name}` : '')]) }
      ]
    }),
    { t: 'p', txt: `**Rank das skills:** o rank de todas as skills de vaga dos cavalos da etapa (ver Skills, Rank das skills). ${basesComSkill.length ? `Vale para as skills de vaga de ${lista(basesComSkill.map(nomeMontaria))}.` : `Hoje as montarias-base dos ginásios (${lista(basesGym.map(nomeMontaria))}) não têm skill de vaga, então ele ainda não muda nada na prática.`} **${PG.plural}:** vêm só no prêmio da 1ª vitória; com a mochila sem espaço para eles (o máximo é ${num(PG.cap)}), o desafio não começa.` },
    { t: 'h3', txt: 'O desafio', id: 'ginasio-desafio' },
    { t: 'p', txt: `O time do jogador tem no máximo o tamanho do time do adversário (pode levar menos) e corre na ordem escolhida. A entrada é paga antes (só Ouro, respeitando o reservado da sala aberta) e só então o desafio inteiro é simulado com a seed do save. O 1º cavalo corre contra o 1º do adversário; quem perde sai, quem vence fica e enfrenta o próximo do outro lado, já cansado. Acaba quando um lado fica sem cavalos. Cada cavalo do jogador ganha ${num(GY.xp.vence)} de XP por duelo vencido e ${num(GY.xp.perde)} por duelo perdido. Derrota: só se perde a entrada.` },
    { t: 'p', txt: `**Vantagem de elemento** (só nos duelos de ginásio): ${lista(gyIds.map((id) => `${nomeEl(G.GYMS[id].fraco)} vence ${nomeEl(id)}`))}. O cavalo cujo elemento vence o do adversário corre com os seis status de corrida ${pct(GY.vantagem, 0)} maiores (a ${nomeStat('sorte')} não muda; cada status continua inteiro, arredondado, então nos cavalos de hoje a vantagem soma cerca de 2 pontos em cada um); elementos iguais, nada. O duelo começa ${nomeClima('nublado')}, para o triângulo não contar duas vezes; o Dado da Sorte é o de sempre. Na corrida valendo, o triângulo continua agindo só pelo clima.` },
    { t: 'p', txt: `**Cansaço:** quem vence um duelo larga o seguinte com menos fôlego (o tanque de estamina abaixo de cheio: corre igual no começo e cansa mais cedo). O desconto depende da distância na chegada (quanto faltava ao perdedor quando o vencedor cruzou a linha) e soma a cada vitória seguida, até ${pct(GY.fadiga.teto, 0)}. Quem entra descansado larga com o tanque cheio. Vale para os dois lados.` },
    { t: 'tabela', rotulo: 'Cansaço', cab: ['Vitória', 'Distância na chegada', 'Fôlego perdido'], linhas: fx.map((f, i) => [f.name, faixaTxt(f, i), N(pct(f.perde, 0))]) },
    { t: 'p', txt: `**Revanche do líder:** depois da insígnia, 1 tentativa por dia em cada ginásio (vencendo ou perdendo), com entrada de ${num(GY.revanche.entrada)} de Ouro. O prêmio de cada vitória segue um rodízio fixo, sem sorteio, contado por ginásio: ${cicloTxt.join(' · ')}, e recomeça.${revanchePerg ? '' : ` A revanche não dá ${PG.plural}.`} Os cavalos do líder correm com o mesmo rank de skills da etapa dele. Com o relógio para trás não libera; dia estragado no save conta como "já tentou hoje".` },
    { t: 'p', txt: `**Insígnias:** cada líder dá uma, para sempre. O bônus é da conta e não entra na simulação da corrida. ${gyIds.map((id) => `${G.GYMS[id].insignia.name}: ${bonusIns(id)}`).join('; ')}. O Perfil mostra as ${gyIds.length} ("Insígnias (N de ${gyIds.length})"): a conquistada com o bônus, a que falta apagada, com o líder a vencer.` }
  ])

  // 12d. Corrida AFK (spec 2026-11-23-afk-drops §5) ------------------------------------------------------
  // tudo de GameData.AFK e dos itens com `grupo` de GameData.ITEMS
  const AK = G.AFK
  if (!AK || !Array.isArray(AK.difs) || !AK.drops || !AK.materiais) throw new Error('wiki: GameData.AFK incompleto')
  const afkIds = Object.keys(IT).filter((id) => IT[id].grupo)
  const GRUPO_NOME = { material: 'Material do ginásio', incomum: 'Material incomum', comida: 'Comida', reforja: 'Reforja', selo: 'Selo', trofeu: 'Troféu' }
  for (const id of afkIds) if (!GRUPO_NOME[IT[id].grupo]) throw new Error(`wiki: item "${id}" com grupo desconhecido "${IT[id].grupo}"`)
  const difNome = (d) => d.name
  const chanceDif = (base, teto) => AK.difs.map((d) => N(pct(Math.min(teto == null ? 1 : teto, base * d.mult))))
  const pecaTxt = (d) => {
    const P = AK.drops.peca[d.id], partes = []
    if (P.solta) partes.push(`${pct(P.solta)} ${nomeRar('comum')} ou ${nomeRar('magico')} solta`)
    if (P.raro) partes.push(`${pct(P.raro)} ${nomeRar('raro')} do conjunto`)
    if (P.lendario) partes.push(`${pct(P.lendario)} ${nomeRar('lendario')} do conjunto`)
    return partes.join(' · ') || '—'
  }
  const pesosComida = AK.drops.comida.pesos, somaPesos = Object.values(pesosComida).reduce((a, b) => a + b, 0)
  add('afk', 'Corrida AFK', 'AFK', [
    { t: 'p', txt: `Os cavalos treinam sozinhos nas fases dos ginásios: cada corrida AFK é um duelo nas regras do ginásio (vantagem de elemento, largada ${nomeClima('nublado')}, pista da casa, Dado da Sorte), sem cansaço, contra um cavalo da etapa em rodízio fixo. Uma fase só libera depois de a etapa ser vencida no ginásio de verdade. O treino nunca dá insígnia, ${nomeItem('redea')}, os itens da 1ª vitória nem o prêmio da revanche, e nunca dá ${lista(['torrao', 'estrela', 'manual', 'cupom', 'pergaminho'].map(nomeItem))}.` },
    { t: 'tabela', rotulo: 'Dificuldades', cab: ['Dificuldade', 'Nível do oponente', 'Rank das skills do oponente', 'Multiplicador de prêmio', 'Libera com'], linhas: AK.difs.map((d, i) => [
      { md: `**${difNome(d)}**`, html: `<strong>${esc(difNome(d))}</strong>` },
      d.nivel ? `o da etapa + ${num(d.nivel)}${d.nivelMax ? ` (até ${num(d.nivelMax)})` : ''}` : 'o da etapa',
      d.rank == null ? 'o da etapa' : N(romano(d.rank)), N('×' + num(d.mult)),
      i === 0 ? 'a etapa vencida no ginásio' : `${num(AK.liberaApos)} vitórias AFK na ${difNome(AK.difs[i - 1])} da mesma fase`]) },
    { t: 'p', txt: `**Vagas:** até ${num(AK.vagaPreco.length)}; cada cavalo ocupa no máximo uma. Preço em Ouro: ${AK.vagaPreco.map((p, i) => `${i + 1}ª ${p ? num(p) : 'grátis'}`).join(' · ')}. O Ouro reservado para a entrada da sala aberta nunca é gasto.` },
    { t: 'p', txt: `**Ganho por vitória:** XP para o cavalo que correu, ${num(AK.xpBase)} × (1 + ${num(AK.xpPorEtapa, 2)} × etapa) × multiplicador (etapa 0 no Soldado 1, 4 no líder), e Ouro, ${AK.ouro.map((o) => num(o, 2)).join(' · ')} do Soldado 1 ao líder, × multiplicador (a fração vira Ouro inteiro pela seed: 0,3 é 1 de Ouro em 30% das vitórias). **Na derrota:** ${pct(AK.derrota.xp, 0)} do XP e ${pct(AK.derrota.material, 0)} do material do ginásio (arredondado para baixo), sem Ouro e sem os outros drops.` },
    { t: 'tabela', rotulo: 'Drops por vitória', cab: ['Drop', ...AK.difs.map(difNome)], linhas: [
      ['Material do ginásio (metade de cada tipo)', ...AK.difs.map((d) => N(`${num(AK.drops.material.min * d.mult)} a ${num(AK.drops.material.max * d.mult)}`))],
      ['Material incomum do ginásio', ...chanceDif(AK.drops.incomum.chance, AK.drops.incomum.teto)],
      ['Pedra Negra', ...chanceDif(AK.drops.pedra.chance)],
      [`Comida (${Object.keys(pesosComida).map((id) => `${nomeItem(id)} ${pct(pesosComida[id] / somaPesos, 0)}`).join(', ')} do que cai)`, ...chanceDif(AK.drops.comida.chance)],
      ['Peça de equipamento', ...AK.difs.map(pecaTxt)],
      [nomeItem('pergaminho-reforja'), ...chanceDif(AK.drops.reforja.chance)],
      ['Troféu do oponente', ...AK.difs.map((d) => N(pct(AK.drops.trofeu[d.id])))]
    ] },
    { t: 'p', txt: `Todo drop sai da seed da corrida. Os materiais e o incomum de cada ginásio só caem nele; a peça ${nomeRar('raro')} ou ${nomeRar('lendario')} que cai é do conjunto do ginásio (${gyIds.map((g) => `${G.GYMS[g].name}: ${G.GEAR_SETS[AK.materiais[g].conjunto].name}`).join('; ')}).` },
    { t: 'h3', txt: 'Baú, ao vivo e offline', id: 'afk-bau' },
    { t: 'p', txt: `Tudo o que as vagas rendem cai num **baú único**; "Coletar tudo" passa de uma vez (o XP vai para cada cavalo ao coletar; o do cavalo ativo fica no baú enquanto a sala estiver aberta). O que passa do teto da mochila se perde: a tela avisa antes e pede confirmação.` },
    { t: 'p', txt: `**Ao vivo** (com a tela "Treino AFK" aberta): cada vaga corre de verdade, uma corrida atrás da outra, no tempo do duelo; o resultado sai da seed do save (vaga e contador) e é gravado antes de aparecer. "Assistir" mostra a corrida da vaga. **Offline** (outra tela ou jogo fechado): o jogo mede a chance de vitória do cavalo naquela fase com ${num(AK.amostra)} duelos simulados aos poucos, guardados até o cavalo ou a fase mudar; as corridas do tempo fora (minutos ÷ duração média medida) são decididas pela seed contra essa chance, e cada vitória rola os mesmos drops. Limite: ${num(AK.offlineMin / 60)} h, até ${num(AK.offlineTetoMin / 60)} h com a ${nomeItem('aveia-dourada')} e o bestiário. O relógio é o do aparelho; relógio para trás não rende. O cavalo ativo para de treinar enquanto a sala do PVP está aberta.` },
    { t: 'h3', txt: 'Forja', id: 'afk-forja' },
    { t: 'p', txt: `Na aba Expedição. Receitas fixas, **sem chance de falhar**: o jogador escolhe o ginásio (de onde saem os materiais e, na ${nomeRar('raro')} e na ${nomeRar('lendario')}, o conjunto) e o tipo da peça. "Materiais" é a soma dos dois materiais comuns do ginásio, gastos meio a meio; o troféu pode ser de qualquer oponente dele. O ${nomeItem('pergaminho-reforja')} é a exceção: aceita os materiais comuns **somados de qualquer ginásio** e o incomum de qualquer um (gasta primeiro do que há mais). Só as **linhas de farm** da peça são sorteadas, pela seed do save e pelo contador de forjas, depois de confirmar. Peça forjada não tem preço de venda. O Ouro reservado para a entrada da sala aberta nunca é gasto.` },
    { t: 'tabela', rotulo: 'Receitas da forja', cab: ['Forjar', 'Materiais', 'Incomum', 'Troféus', nomeItem('selo'), 'Ouro'], linhas: Object.keys(G.FORJA).map((r) => {
      const R = G.FORJA[r]
      const nome = { comum: `Peça ${nomeRar('comum')} (solta)`, magico: `Peça ${nomeRar('magico')} (solta)`, raro: `Peça ${nomeRar('raro')} do conjunto do ginásio`, lendario: `Peça ${nomeRar('lendario')} do conjunto do ginásio`, pedra: 'Pedra Negra', reforja: nomeItem('pergaminho-reforja') }[r]
      if (!nome) throw new Error(`wiki: receita de forja desconhecida "${r}"`)
      return [{ md: `**${nome}**`, html: `<strong>${esc(nome)}</strong>` }, N(num(R.mat)), N(R.inc ? num(R.inc) : '—'), N(R.trofeu ? num(R.trofeu) : '—'), N(R.selo ? num(R.selo) : '—'), N(num(R.ouro))]
    }) },
    { t: 'h3', txt: 'Bestiário', id: 'afk-bestiario' },
    { t: 'p', txt: `Uma página por ginásio: os oponentes (marcos de ${lista(AK.bestiario.marcos.map((m) => num(m)))} vitórias no treino), os materiais, as peças do conjunto e os troféus (vistos e obtidos). Bônus da conta, só no AFK: ${pct(AK.bestiario.raro.por, 0)} de drop raro por oponente com ${num(AK.bestiario.raro.vitorias)} vitórias (até ${pct(AK.bestiario.raro.teto, 0)}); ${pct(AK.bestiario.xp.por, 0)} de XP por oponente com ${num(AK.bestiario.xp.vitorias)} (até ${pct(AK.bestiario.xp.teto, 0)}); ${pct(AK.bestiario.trofeu.por, 0)} de chance de troféu por troféu (até ${pct(AK.bestiario.trofeu.teto, 0)}); ${num(AK.bestiario.pagina.min / 60)} h de limite offline por página completa (até ${num(AK.bestiario.pagina.tetoMin / 60)} h). "Drop raro" vale para material incomum, Pedra Negra, peça e comida.` },
    { t: 'tabela', rotulo: 'Itens do AFK', cab: ['Item', 'Tipo', 'Para que serve', 'Teto na mochila', 'De onde vem'], linhas: afkIds.map((id) => [
      { md: `**${IT[id].name}**`, html: `<strong>${esc(IT[id].name)}</strong>` }, GRUPO_NOME[IT[id].grupo], IT[id].desc, N(num(IT[id].cap)), IT[id].origem]) }
  ])

  // 13. Ícones reservados --------------------------------------------------------------------------------
  // Os da spec (2.6) ainda sem tela: já existem como arquivo, mas só entram nas telas com recursos que ainda vão chegar
  // (as três insígnias saíram daqui com a aba Expedição dos ginásios).
  const reservados = RESERVADOS.map((id) => {
    const ic = ICONES_NOVOS.find((x) => x.id === id)
    if (!ic) throw new Error(`wiki: reservado "${id}" fora do catálogo de ícones`)
    return [{ md: icMd(id) + `\`${id}\``, html: icone(id, '', 'ic ic32', 32) + `<code>${esc(id)}</code>` }, ic.desc, ic.cor]
  })
  add('icones-reservados', 'Ícones reservados', 'Ícones reservados', [
    { t: 'p', txt: 'Estes dois ícones já estão em `prototype/assets/arte/icones/`, mas ainda não aparecem no jogo: o `moeda-gema` espera a loja de Gemas. A Rédea nova já existe no jogo, mas com o ícone desenhado em código, como os outros itens; o `item-redea` daqui continua guardado. Até lá, só o wiki os mostra. Os ícones das insígnias já aparecem na aba Expedição (ver Ginásios da Expedição).' },
    { t: 'tabela', rotulo: 'Ícones reservados', cab: ['Ícone', 'Descrição', 'Cor'], linhas: reservados.map(([c, d, cor]) => [c, d, { md: `\`${cor}\``, html: `<span class="amostra" style="--c:${cor}"></span><code>${esc(cor)}</code>` }]) }
  ])

  // 14. Modo DEV -----------------------------------------------------------------------------------------
  add('dev', 'Modo DEV', 'Modo DEV', [
    { t: 'p', txt: `Para testar: abra \`prototype/dist/preview.html?dev=1\` ou o build de teste \`prototype/dist/jogo-dev.html\` (liga sozinho; é o que vai para o artefato, que não repassa \`?dev=1\`). O save é separado (\`${DV.SAVE_KEY}\`): o jogo real não é lido nem gravado.` },
    { t: 'dl', itens: [
      ['Moedas', `Ouro infinito (volta a ${num(DV.GOLD_INF)} depois de cada gasto) e Pedras Negras à vontade.`],
      ['Itens e dia', `os itens de uso e o dia do jogo: Definir mochila (quantos de cada um: ${lista(G.ITENS_USO.filter((id) => id !== 'redea').map(nomeItem))}, de 0 a ${num(G.BAG_MAX)}); Avançar 1 dia e Voltar 1 dia (o dia do jogo vai de ${F.devDiasMax} dias antes a ${F.devDiasMax} dias depois do aparelho, só no save de teste); Zerar diária e limites (a recompensa volta ao dia 1 para resgatar e os limites da loja zeram).`],
      ['Ginásios', `quantas etapas de cada trilha estão vencidas (de 0 a ${num(G.GYMS[G.GYM_ORDER[0]].etapas.length)}; com todas, a insígnia, e o bônus dela vale na hora): Definir etapas; Liberar revanche (a de hoje, nos ${G.GYM_ORDER.length} ginásios); Zerar ginásios (nenhuma etapa vencida; o contador de desafios continua, para as seeds dos desafios não se repetirem).`],
      ['Treino AFK', `o relógio do treino (só anda para a frente, só no save de teste): Avançar 2 min, Avançar 2 h e Avançar 9 h; +50 vitórias nas fases liberadas (libera as dificuldades seguintes); +20 de cada item do treino na mochila; Zerar treino AFK (vagas vazias, baú, vitórias e bestiário limpos; os contadores das vagas ficam).`],
      ['Cavalo', `cria ou substitui um cavalo com qualquer tipo, raridade, sexo, estrelas, level (1–${E.maxLevel}), genética (máxima ou por status), pontos distribuídos e até ${F.devVagas} skills (inclusive de outro tipo), cada uma com o seu rank (seletor de I a ${rMax}); copia iniciais e aluguéis; +10 levels; +1 cruza; devolve os pontos da ativa.`],
      ['Itens', 'só peças de equipamento: qualquer peça do catálogo, inclusive Lendária, com qualquer melhoria; conjunto completo de uma vez.'],
      ['Próxima corrida', 'clima inicial, piso, distância, traçado (mais curvas, mais subidas ou lista de blocos), vento e seed. Não há mais a opção de forçar a ativação das skills: toda skill de vaga já ativa quando o gatilho acontece.'],
      ['Perfil', 'zerar o perfil de teste (volta à Brasa).']
    ] }
  ])

  return SEC
}

// ---------------------------------------------------------------------------------------------------------
// Montarias (Markdown e cartões HTML)
// ---------------------------------------------------------------------------------------------------------
function infoMontaria(h, F) {
  const st = S.computeStats(h, null), st1 = S.computeStats({ ...h, level: 1 }, null)
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
  return { st, st1, poder, liga, aluguel, onde, inicial, cruzas: h.breedLeftMax || G.BREED_LEFT[h.sex] }
}
const sexoTxt = (s) => (s === 'f' ? '♀ fêmea' : s === 'm' ? '♂ macho' : (() => { throw new Error(`wiki: sexo desconhecido "${s}"`) })())
function montariasMd(F) {
  const grupos = [['Iniciais', G.STARTERS], ['Selvagens', G.WILD_HORSES]]
  return grupos.map(([tit, lista_]) => `### ${tit} (${lista_.length})\n\n` + lista_.map((h) => {
    const i = infoMontaria(h, F)
    const cab = [`#### ${h.name}${h.title ? ' — ' + h.title : ''}`, '',
      `${nomeEl(h.element)} · ${nomeRar(h.rarity)} · ${estrelas(h.grau || 2)} · ${sexoTxt(h.sex)} · Nv ${h.level} · Poder ${num(i.poder)} (${i.liga.name}) · ${i.cruzas} cruza(s)`, '',
      [h.bio, h.habitat ? `Habitat: ${h.habitat}.` : '', h.lore].filter(Boolean).join(' '), '',
      `Skill de tipo: ${G.TYPE_SKILLS[h.element] ? G.TYPE_SKILLS[h.element].name : 'nenhuma'} · Skills: ${h.skills.length ? h.skills.map(nomeSkill).join(', ') : 'nenhuma'} · Onde aparece: ${i.onde.join(', ')}`, '']
    const tab = blocoMd({ t: 'tabela', cab: ['', ...G.STAT_KEYS.map(siglaStat)], linhas: [
      ['Nv 1', ...G.STAT_KEYS.map((k) => N(String(i.st1[k])))],
      ['Genética', ...G.STAT_KEYS.map((k) => N(String(h.potential[k])))],
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
      `<tr><th scope="row">Nv 1</th>${G.STAT_KEYS.map((k) => `<td class="n">${i.st1[k]}</td>`).join('')}</tr>` +
      `<tr class="oculto"><th scope="row">Genética</th>${G.STAT_KEYS.map((k) => `<td class="n">${h.potential[k]}</td>`).join('')}</tr>` +
      `<tr><th scope="row">No Nv ${h.level}</th>${G.STAT_KEYS.map((k) => `<td class="n">${i.st[k]}</td>`).join('')}</tr></tbody></table></div>` +
      `<dl class="pares pares--mont"><dt>Skill de tipo</dt><dd>${G.TYPE_SKILLS[h.element] ? esc(G.TYPE_SKILLS[h.element].name) : 'nenhuma'}</dd><dt>Skills</dt><dd>${h.skills.length ? h.skills.map((id) => `<a class="skill-chip" href="#skill-${id}">${esc(nomeSkill(id))}</a>`).join(' ') : 'nenhuma'}</dd>` +
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
  --fogo: #ff8a4c; --agua: #62b8ff; --grama: #86d86a; --geral: #cfc8b4;
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
img.ic.ic32 { width: 32px; height: 32px; }
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
.secao h4 img.ic { width: 24px; height: 24px; margin-right: 6px; }
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
.el--fogo { color: var(--fogo); } .el--agua { color: var(--agua); } .el--grama { color: var(--grama); } .el--geral { color: var(--geral); }
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
      `<fieldset class="filtro"><legend>Elemento</legend><div class="chips">${chip('el', '', 'Todos')}${Object.keys(G.ELEMENTS).map((e) => chip('el', e, nomeEl(e), icone('el-' + e))).join('')}${chip('el', 'geral', 'Gerais', icone('el-geral'))}</div></fieldset>` +
      `<fieldset class="filtro"><legend>Raridade</legend><div class="chips">${chip('rar', '', 'Todas')}${Object.keys(G.RARITIES).map((r) => chip('rar', r, nomeRar(r))).join('')}</div></fieldset>` +
      `<p class="filtro-nota">A busca e os filtros valem para skills, montarias e peças. Elemento de peça = o do clima do conjunto; "Gerais" = skills que qualquer tipo aprende; skills não têm raridade.</p>` +
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
