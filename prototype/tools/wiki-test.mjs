// Teste do wiki (rápido, sem instalar nada).
//   node prototype/tools/wiki-test.mjs                    testes
//   node prototype/tools/wiki-test.mjs --capturas <pasta>  também salva wiki-1280.png e wiki-390.png na pasta
// Confere: geração determinística; cobertura (todo nome de skill, raridade, elemento, clima, montaria, slot,
// conjunto, peça e item aparece no md e no html); chave desconhecida quebra; fragmento de artefato válido; e no
// navegador (390 e 1280 px, dentro do esqueleto que o host usa): sem erro de console, sem rolagem horizontal,
// retratos desenhados, busca filtrando e todo link do índice apontando para uma seção que existe.
import { createRequire } from 'node:module'
import { mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gerarWiki, descreverEfeito, descreverEfeitoTipo, descreverGatilho, descreverEspecial, descreverBloco, efeitoGeralClima, papelDoStatus, formatoRank, nomeChaveEfeito } from './wiki.mjs'

const require = createRequire(import.meta.url)
const G = require('../src/data.js')
const S = require('../src/sim.js')
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
for (const id in G.ITEMS) nomes.push(['item', G.ITEMS[id].name])
const reEscCedo = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
for (const [tipo, nome] of nomes) {
  confere(a.md.includes(nome), `${tipo} "${nome}" não aparece no md`)
  confere(a.html.includes(escHtml(nome)), `${tipo} "${nome}" não aparece no html`)
}
for (const id in G.GEAR) confere(a.html.includes(`id="peca-${id}"`), `peça ${id} sem linha própria no html`)
for (const id in G.SKILLS) confere(a.html.includes(`id="skill-${id}"`), `skill ${id} sem cartão no html`)

// skills com 100% de ativação e ranks (spec 2026-11-19): a chance de ativar sumiu; entram o fator do rank, a regra por
// formato, o custo (com o total), o marco de cada skill, o Pergaminho de técnica e o rank no resto do jogo. Os números
// esperados saem do catálogo (GameData.SKILL_RANKS, SKILLS, ITEMS, GYMS) e do RaceSim, nunca escritos aqui.
{
  const K = G.SKILL_RANKS, ROM = ['', 'I', 'II', 'III', 'IV', 'V']
  const br = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fator = (r) => '×' + (1 + K.step * (r - 1)).toFixed(2).replace('.', ',')
  confere(K.max === 5, 'o teste do wiki conta com 5 ranks (SKILL_RANKS.max): atualize os algarismos romanos do teste')
  const ini = a.md.indexOf('### Rank das skills'), fim = a.md.indexOf('### Skills de vaga')
  const sec = ini >= 0 && fim > ini ? a.md.slice(ini, fim) : ''
  confere(sec.length > 0 && a.html.includes('id="skills-rank"'), 'falta o subtítulo "Rank das skills" (md e html), antes das "Skills de vaga"')
  confere(!/chance de skill|chance de ativ|tenta ativar|tentativa de ativ|skills sempre ativam|skillChance|skillPerLevel|skillPerSorte|Chance de ativar/i.test(a.md + a.html.replace(/<script>[\s\S]*?<\/script>/g, '')), 'o wiki ainda fala da chance de ativar skill (regra antiga)')
  confere(/a skill \*\*ativa sempre\*\*, sem sorteio/.test(a.md), 'seção Skills sem "ativa sempre, sem sorteio"')
  confere(sec.includes(`s(r) = 1 + ${String(K.step).replace('.', ',')} × (r − 1)`) && /só na parte de bônus/.test(sec), 'Rank das skills sem a escala s(r) ou sem "só na parte de bônus"')
  // fator do rank: uma linha por rank, com o fator de RaceSim.rankScale
  for (let r = 1; r <= K.max; r++) {
    confere(Math.abs(S.rankScale(r) - (1 + K.step * (r - 1))) < 1e-12, `RaceSim.rankScale(${r}) não é 1 + step × (r − 1)`)
    confere(sec.includes(`| ${ROM[r]} | ${fator(r)} |`), `tabela "Fator do rank": o rank ${ROM[r]} devia ter ${fator(r)}`)
  }
  // a regra por formato: os formatos que o catálogo usa, o piso do multiplicador de gasto e o teto do dado extra
  for (const [o, re] of [['o multiplicador que ajuda', /\*\*Multiplicador que ajuda\*\*[^\n]*1 \+ \(m − 1\) × s/], ['o multiplicador que reduz gasto', /\*\*Multiplicador que reduz gasto\*\*[^\n]*1 − \(1 − m\) × s, nunca abaixo de ×0,05/],
    ['o bônus somado', /\*\*Bônus somado\*\*[^\n]*b × s/], ['a recuperação', /\*\*Recuperação\*\*[^\n]*x × s/], ['o reforço de clima', /\*\*Reforço de clima\*\*/], ['a duração e a distância', /\*\*Duração e distância\*\* não crescem com o rank/]]) {
    confere(re.test(sec), `Rank das skills sem a regra de ${o}`)
  }
  confere(sec.includes(`até o teto do rank: ${K.diceTeto.join(' · ')} do rank I ao V`), 'Rank das skills sem o teto do dado extra por rank (SKILL_RANKS.diceTeto)')
  const T = S.TUNING, climaIds = Object.keys(G.SKILLS).filter((id) => G.SKILLS[id].effect.weatherBonus)
  const m3 = (x) => '×' + String(Math.round(x * 1000) / 1000).replace('.', ',')
  confere(climaIds.length > 0 && sec.includes([1, 2, 3, 4, 5].map((r) => m3(T.weatherMult + S.skillEffect(climaIds[0], r).weatherBonus)).join(' · ')), 'Rank das skills sem o bônus do clima por rank (weatherBonus × fator)')
  confere(a.md.includes(`com a skill de clima ativa (`) && a.md.includes(`de ${m3(T.weatherMult + S.skillEffect(climaIds[0], 1).weatherBonus)} no rank I a ${m3(T.weatherMult + S.skillEffect(climaIds[0], K.max).weatherBonus)} no rank V`), 'Elementos e clima: o multiplicador com a skill de clima não é o do weatherBonus por rank')
  confere(!/com a skill de clima ativa, ×1,08/.test(a.md), 'Elementos e clima ainda usa o weatherMultDouble como efeito da skill de clima')
  // todo effect do catálogo tem formato de rank e nome; chave inventada quebra
  for (const id in G.SKILLS) for (const k of Object.keys(G.SKILLS[id].effect)) {
    try { formatoRank(k); nomeChaveEfeito(k) } catch (e) { problemas.push(`skill ${id}: ${e.message}`) }
  }
  lanca(() => formatoRank('chaveInventada'), 'formato de rank com chave inventada')
  lanca(() => nomeChaveEfeito('chaveInventada'), 'nome de chave de effect inventada')
  // custo para subir: cada passo e o total, somados do catálogo (3.450 de Ouro e 14 Pergaminhos na spec)
  let ouro = 0, perg = 0
  for (let r = 1; r < K.max; r++) {
    const c = K.custo[r]
    confere(!!c && sec.includes(`| ${ROM[r]} → ${ROM[r + 1]} | ${br(c.ouro)} | ${c.perg} |`), `tabela "Custo para subir": ${ROM[r]} → ${ROM[r + 1]} devia custar ${c && br(c.ouro)} de Ouro e ${c && c.perg} Pergaminhos`)
    ouro += c.ouro; perg += c.perg
  }
  confere(sec.includes(`| **Total (I → V)** | ${br(ouro)} | ${perg} |`), `tabela "Custo para subir" sem a linha do total (${br(ouro)} de Ouro e ${perg} Pergaminhos)`)
  confere(/<strong>Total \(I → V\)<\/strong>/.test(a.html) && a.html.includes(br(ouro)), 'html sem a linha do total do custo de rank')
  confere(/nunca falha/.test(sec) && /não tem volta/.test(sec) && /\*\*o cavalo ativo não sobe rank\*\*/.test(sec), 'Custo para subir: sem "nunca falha", "não tem volta" ou o bloqueio do cavalo ativo com o páreo aberto')
  // skills por rank: uma linha por skill com o texto do rank I, o do V e o marco (RaceSim.skillDesc e skillMarcoDesc)
  for (const id in G.SKILLS) {
    const sk = G.SKILLS[id], d1 = S.skillDesc(id, 1), d5 = S.skillDesc(id, K.max), marco = S.skillMarcoDesc(id)
    confere(!!sk.rank5 && marco.length > 0, `skill ${id} sem marco (rank5) ou sem a frase do marco (RaceSim.skillMarcoDesc)`)
    confere(d1 === sk.desc, `skill ${id}: a descrição do catálogo não é a do rank I (RaceSim.skillDesc)`)
    confere(new RegExp(`\\| (?:!\\[\\]\\([^)]*\\) )?${reEscCedo(sk.name)} \\| ${reEscCedo(d1)} \\| ${reEscCedo(d5)} \\| ${reEscCedo(marco)} \\|`).test(sec), `tabela "Skills por rank": a linha de ${sk.name} não traz o rank I, o rank V e o marco`)
    // o marco também na lista por skill (coluna do md e par dt/dd do cartão html)
    const linha = (a.md.slice(fim).match(new RegExp(`^\\| (?:!\\[\\]\\([^)]*\\) )?\\*\\*${reEscCedo(sk.name)}\\*\\* \\|.*$`, 'm')) || [''])[0]
    confere(linha.includes(`| ${marco} |`), `lista de skills (md): ${sk.name} sem o marco do rank V`)
    const cartao = (a.html.match(new RegExp(`<article id="skill-${id}"[\\s\\S]*?</article>`)) || [''])[0]
    confere(cartao.includes(`<dt>Marco do rank V</dt><dd>${escHtml(marco)}</dd>`), `cartão da skill ${sk.name} (html) sem o marco do rank V`)
    confere(/<dt>Pontos no Poder \(rank I\)<\/dt>/.test(cartao) && /× o fator do rank/.test(cartao), `cartão da skill ${sk.name} (html) sem "Pontos no Poder (rank I)" × o fator do rank`)
    confere(a.html.includes(escHtml(d5)), `html sem o texto do rank V de ${sk.name}`)
  }
  confere(/\| Skill \| Gatilho \| Efeito \(rank I\) \| Descrição no jogo \(rank I\) \| Marco do rank V \|[^\n]*\| Pontos no Poder \(rank I; × o fator do rank\) \|/.test(a.md), 'lista de skills (md) sem as colunas do rank (Efeito (rank I), Marco do rank V, Pontos no Poder (rank I; × o fator do rank))')
  confere(a.md.includes(`+ ${T.ratingSkillPts} × peso do gatilho × fator do rank, por skill`), 'Poder: a fórmula sem o fator do rank na parcela das skills')
  // Pergaminho de técnica: as chances do pódio, os ginásios (premio.pergaminhos), o teto e o que nunca dá
  const PG = G.ITEMS.pergaminho
  const podio = PG.podio.map((x, i) => `${i + 1}º lugar ${Math.round(x * 100)}%`).join(', ')
  confere(sec.includes(`**Pódio de corrida valendo** (entrada paga): ${podio}.`) && /O treino não sorteia/.test(sec), `Pergaminho: sem as chances do pódio (${podio}) ou sem "O treino não sorteia"`)
  confere(a.html.includes(podio), 'html sem as chances do Pergaminho no pódio')
  const g0 = G.GYMS[G.GYM_ORDER[0]], porGin = g0.etapas.reduce((x, e) => x + (e.premio.pergaminhos || 0), 0)
  const etapasPerg = g0.etapas.map((e, i) => e.premio.pergaminhos ? `${e.lider ? 'o líder' : 'o Soldado ' + (i + 1)} (${e.premio.pergaminhos})` : null).filter(Boolean)
  confere(porGin > 0 && etapasPerg.every((t) => sec.includes(t)) && sec.includes(`${porGin} por ginásio, ${porGin * G.GYM_ORDER.length} nos ${G.GYM_ORDER.length}`), `Pergaminho: sem as etapas de ginásio que dão (${etapasPerg.join(', ')}) ou sem o total por ginásio (${porGin})`)
  confere(/A revanche do líder não dá Pergaminho/.test(sec) && /\*\*Nunca\*\* na loja[^\n]*nunca por Gemas/.test(sec) && sec.includes(`**Mochila:** até ${PG.cap}.`), 'Pergaminho: sem a revanche, o "nunca na loja, nunca por Gemas" ou o teto da mochila')
  confere(PG.price == null && !G.SHOP_ORDER.includes('pergaminho') && !G.DAILY.dias.some((d) => d.item === 'pergaminho') && !G.GYM.revanche.ciclo.some((c) => c.item === 'pergaminho'), 'o Pergaminho de técnica ganhou preço, entrou na loja, na diária ou no rodízio da revanche (o wiki diz que não)')
  // o rank no resto do jogo: potro, Cupom, Manual, bots, ginásios e pista
  for (const [o, re] of [['o potro (rank do pai − 1)', /\*\*Potro:\*\* a skill herdada nasce 1 rank abaixo do pai que a tem \(se os dois têm, vale o maior\), nunca abaixo do I/],
    ['o Cupom', new RegExp(`\\*\\*${G.ITEMS.cupom.name}:\\*\\* a skill nova entra no rank I e o rank da que sai é perdido`)],
    ['o Manual e o level', new RegExp(`\\*\\*${G.ITEMS.manual.name} e aprendizado por level:\\*\\* a skill aprendida entra no rank I`)],
    ['os bots da sala', /\*\*Bots da sala:\*\*[^\n]*a média, arredondada, dos ranks das skills de vaga do seu cavalo \(rank I se ele não tem skill de vaga\)/],
    ['os oponentes dos ginásios', /\*\*Oponentes dos ginásios:\*\* rank fixo por etapa, sem sorteio/],
    ['o balão', /\*\*Na pista:\*\* o balão da skill mostra o rank em algarismo romano a partir do II/]]) {
    confere(re.test(sec), `O rank no resto do jogo: sem ${o}`)
  }
  // os bots usam mesmo a média arredondada (RaceSim.botRank), e sem skill de vaga é rank I
  const ids3 = Object.keys(G.SKILLS).slice(0, 3)
  confere(S.botRank({ skills: ids3, skillRanks: { [ids3[0]]: 5, [ids3[1]]: 4, [ids3[2]]: 2 } }) === 4 && S.botRank({ skills: [] }) === 1, 'RaceSim.botRank não é a média arredondada dos ranks (ou não é 1 sem skill de vaga)')
  // ginásios: o rank de cada etapa na trilha e os Pergaminhos no prêmio; a ressalva das montarias-base sem skill de vaga
  const secGin = a.md.slice(a.md.indexOf('## Ginásios da Expedição'), a.md.indexOf('## Ícones reservados'))
  const catalogo = G.STARTERS.concat(G.WILD_HORSES)
  let algumaSkill = false
  for (const id of G.GYM_ORDER) G.GYMS[id].etapas.forEach((e, i) => {
    const rot = e.lider ? 'Líder' : 'Soldado ' + (i + 1), pg = e.premio.pergaminhos || 0
    confere(e.cavalos.every((c) => c.rank === e.cavalos[0].rank), `ginásio ${id}, ${rot}: os cavalos da etapa têm ranks diferentes`)
    const linha = (secGin.match(new RegExp(`^\\| ${rot} \\| ${reEscCedo(e.nome)} \\|.*$`, 'm')) || [''])[0]
    confere(linha.includes(`| ${ROM[e.cavalos[0].rank]} | ${e.entrada} |`), `trilha ${id}: ${rot} sem o rank ${ROM[e.cavalos[0].rank]} das skills`)
    confere(pg ? linha.includes(`${pg} ${pg === 1 ? PG.name : PG.plural}`) : !/Pergaminho/.test(linha), `trilha ${id}: ${rot} devia mostrar ${pg} Pergaminho(s) no prêmio`)
    for (const c of e.cavalos) if ((catalogo.find((h) => h.id === c.base).skills || []).some((s) => G.SKILLS[s])) algumaSkill = true
  })
  confere(algumaSkill !== /não têm skill de vaga, então (?:esse rank|ele) ainda não muda nada na prática/.test(secGin), 'Ginásios: a ressalva "as montarias-base não têm skill de vaga" não confere com o catálogo')
  confere(algumaSkill !== /não têm skill de vaga, então esse rank ainda não muda nada na prática/.test(sec), 'Rank das skills: a ressalva dos oponentes dos ginásios não confere com o catálogo')
  confere(/A revanche não dá Pergaminhos de técnica/.test(secGin), 'Ginásios: a revanche sem "não dá Pergaminhos"')
  // cruzamento, itens, equipamento e DEV
  confere(/Rank: cada skill herdada nasce 1 rank abaixo do pai que a tem/.test(a.md.slice(a.md.indexOf('## Cruzamento'), a.md.indexOf('## Equipamento'))), 'Cruzamento: as skills do potro sem a regra do rank')
  confere(a.md.includes(`+${Math.round(G.ECONOMY.gear.setBonus.skillEffect * 100)}% no efeito das skills`) && !/p\.p\. na chance de (?:todas as )?skills/.test(a.md), 'Equipamento: o bônus de 3 peças devia ser "+5% no efeito das skills" (setBonus.skillEffect)')
  const devCav = (a.md.match(/^- \*\*Cavalo:\*\* (.*)$/m) || [])[1] || ''
  confere(/cada uma com o seu rank \(seletor de I a V\)/.test(devCav), `o Modo DEV no wiki sem o seletor de rank por skill: ${devCav}`)
  confere(G.HELP.rank.includes(`+${Math.round(K.step * 100)}%`), `HELP.rank não diz "+${Math.round(K.step * 100)}%" por passo (SKILL_RANKS.step): ${G.HELP.rank}`)
}

// crescimento livre (cavalos v3, bloco 1b): fórmulas do status, pontos por level, custo por faixa, teto 150, Sorte de
// nascimento, Dado, raridades, estrelas, skill de tipo com statMul, Poder e ligas; nada do modelo do bloco 1
confere(a.md.includes('base   = início da faixa da raridade + 16 × g / 31'), 'seção Status sem a fórmula da base pela genética g')
confere(a.md.includes('status = base + pontos comprados, arredondado e preso entre 1 e 150'), 'seção Status sem o teto 150')
confere(a.md.includes('pontos(L) = piso(fator da raridade × fator das estrelas × [(L − 1) × 2 + 4 × (L − 1)(L − 2) / 96])'), 'seção Status sem a fórmula dos pontos por level')
confere(a.md.includes('custo do i-ésimo ponto num mesmo status (i = 0, 1, …) = 1 + piso(i / 10)'), 'seção Status sem o custo por faixa')
for (const [faixa, custo, total] of [['1º a 10º', 1, 10], ['11º a 20º', 2, 30], ['21º a 30º', 3, 60], ['41º a 50º', 5, 150]]) {
  confere(a.md.includes(`| ${faixa} | ${custo} | ${total} |`), `tabela do custo por faixa: ${faixa} devia custar ${custo} (total ${total})`)
}
// o pior caso conta os torrões (teto de 10 por cavalo): 146 sem eles, 148 com eles (revisão final da frente de itens)
confere(/pior caso[^\n]*10 torrões[^\n]*fica em 148/.test(a.md), 'seção Status sem o pior caso (148, com os 10 torrões) do teto')
confere(a.md.includes('/ 96]) + torrões'), 'seção Status sem os torrões na fórmula dos pontos')
confere(/\*\*Sorte:\*\* só de nascimento, não recebe pontos[^\n]*de 40 \(Comum, genética 0\) a 76 \(Mítico, genética 31\)/.test(a.md), 'seção Status sem a Sorte de nascimento (40 a 76)')
confere(/nota da genética[^\n]*C 0–7 · B 8–15 · A 16–23 · S 24–31/i.test(a.md), 'seção Status sem as notas de genética (C 0–7 … S 24–31)')
// pontos por level da spec §2 (Comum / Mítico nos Nv 11, 30 e 50)
for (const [est, n11, n30, n50] of [['★', '23 / 28', '91 / 110', '196 / 235'], ['★★', '25 / 31', '100 / 120', '213 / 256'], ['★★★', '28 / 34', '112 / 134', '239 / 286']]) {
  confere(a.md.includes(`| ${est} | ${n11} | ${n30} | ${n50} |`), `tabela de pontos por estrela: ${est} devia ter ${n11} / ${n30} / ${n50}`)
}
for (const [rar, lo, hi, fator, n50] of [['Comum', 40, 56, '×1', 213], ['Mágico', 44, 60, '×1,05', 224], ['Raro', 49, 65, '×1,1', 235], ['Lendário', 54, 70, '×1,15', 245], ['Mítico', 60, 76, '×1,2', 256]]) {
  confere(new RegExp(`\\| (?:!\\[\\]\\([^)]*\\) )?${rar} \\|[^\\n]*\\| ${lo}–${hi} \\| ${fator} \\| ${n50} \\|`).test(a.md), `tabela de raridades: ${rar} devia nascer entre ${lo} e ${hi}, fator ${fator}, ${n50} pontos no Nv 50`)
}
for (const [est, m, pts] of [['★', '×1', 196], ['★★', '×1,09', 213], ['★★★', '×1,22', 239]]) {
  confere(new RegExp(`\\| ${est} \\| ${m} \\| ${pts} \\|`).test(a.md), `tabela de estrelas: ${est} devia ter ${m} e ${pts} pontos no Nv 50 (Comum)`)
}
confere(a.md.includes('Com chance (SOR − 40) / 40 (presa entre 0% e 100%), rola um 2º dado'), 'Dado da Sorte sem a chance (SOR − 40)/40')
for (const [sor, ch] of [[40, '0%'], [60, '50%'], [80, '100%']]) confere(a.md.includes(`| ${sor} | ${ch} |`), `tabela do 2º dado: SOR ${sor} devia dar ${ch}`)
confere(a.md.includes('Poder = 2,5·VEL + 2·ACE + 2,2·MAN + 2,4·FOR + 2,4·EST + 1,5·GAR + 0·SOR') && a.md.includes('+ 20 × (level − 1) / 49 + 28 × ordem da raridade / 4'), 'Poder sem os pesos novos ou sem os termos de level e raridade')
for (const [liga, faixa] of [['Bronze', '0–709'], ['Prata', '710–799'], ['Ouro', '800–889'], ['Platina', '890–979'], ['Diamante', '980–1.069'], ['Lenda', '1.070 ou mais']]) {
  confere(new RegExp(`\\) ${liga} \\| ${faixa.replace('.', '\\.')} \\|`).test(a.md), `tabela de ligas: ${liga} devia ser ${faixa}`)
}
confere(!/statCap|freeCapShare|statLimit|limite por status|limite num status|teto da raridade|teto de status|pontos livres distribu|34% dos pontos|ganha sozinho|chega sozinha|Crescimento por level/i.test(a.md), 'md com o modelo do bloco 1 (statCap, limite de 34%, teto da raridade ou crescimento natural)')
confere(/### Skill de tipo/.test(a.md) && a.html.includes('id="skills-tipo"'), 'falta a seção da skill de tipo (md e html)')
confere(a.md.includes('P = 1 + nívelT × (level − 1) / 49 + raridadeT × ordem da raridade / 4'), 'skill de tipo sem a fórmula da força P')
for (const [nome, el, terco, efeito] of [
  ['Labareda', 'Fogo', 'primeiro terço (da largada a 1/3)', 'Velocidade e Aceleração ×1,19 (+19%) | −0,15 | 0,15'],
  ['Raízes Firmes', 'Grama', 'terço do meio (de 1/3 a 2/3)', 'Força e Manobra ×1,15 (+15%) | 0,25 | 0,4'],
  ['Maré Alta', 'Água', 'último terço (de 2/3 à chegada)', 'Estamina e Garra ×1,33 (+33%) | 0 | 0,15']
]) {
  confere(a.md.includes(`| ![](../prototype/assets/arte/icones/sk-tipo-${{ Fogo: 'fogo', Água: 'agua', Grama: 'grama' }[el]}.png) **${nome}** | ${el} | ${terco} | ${efeito} |`), `skill de tipo ${nome}: linha com elemento, terço e efeito (P = 1) não confere`)
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
  const fim = a.md.indexOf('## Portes')
  const sec = ini >= 0 && fim > ini ? a.md.slice(ini, fim) : ''
  confere(sec.length > 0, 'falta a seção "Marcas e jóquei" no md (antes dos Portes)')
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
  confere(sec.includes('na cor da raridade clareada; numa crina em que essa cor quase não aparece, na clareada ou na escurecida, a que mais se destaca'), 'raridade: a cor do brilho que se ajusta à crina (parte 2b)')
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

// 2b'. portes (parte 2b dos cavalos): seção com os 3 portes, a herança e a tabela dos 15 cavalos, sem valores internos
{
  const ini = a.md.indexOf('## Portes')
  const fim = a.md.indexOf('<a id="cruzamento">')
  const sec = ini >= 0 && fim > ini ? a.md.slice(ini, fim) : ''
  confere(sec.length > 0, 'falta a seção "Portes" no md (antes do Cruzamento)')
  confere(/<section class="secao" id="portes"/.test(a.html), 'falta a seção "portes" no html')
  for (const v of G.PORTES.valores) confere(sec.includes(`| ${G.PORTES.nomes[v]} |`), `seção Portes sem o porte "${G.PORTES.nomes[v]}"`)
  confere(sec.includes('50% para cada um'), 'seção Portes sem os 50% de herança')
  confere(sec.includes('10% de chance de **mutação**'), 'seção Portes sem os 10% de mutação')
  confere(!/\bpadrao\b/.test(sec), 'a seção Portes mostra o valor interno "padrao"')
  const catalogo = G.STARTERS.concat(G.WILD_HORSES)
  for (const h of catalogo) {
    confere(new RegExp(`\\| ${h.name} \\| [^|]+ \\| ${G.PORTES.nomes[h.porte]} \\|`).test(sec), `tabela de portes: linha de ${h.name} não confere com o data.js`)
  }
  const linhasTab = sec.slice(sec.indexOf('### Porte dos iniciais e selvagens')).split('\n').filter((l) => /^\| /.test(l)).length - 2
  confere(linhasTab === 15, `tabela de portes devia ter 15 linhas, tem ${linhasTab}`)
}

// 2a. explicações curtas (ⓘ, bloco 1b §11): o wiki usa os mesmos textos de GameData.HELP
{
  const CHAVES = ['vel', 'acel', 'man', 'forca', 'est', 'garra', 'sorte', 'genetica', 'estrelas', 'raridade', 'skillTipo', 'poder', 'liga', 'clima', 'piso', 'dado', 'custo', 'redea', 'rank']
  for (const k of CHAVES) {
    confere(typeof G.HELP[k] === 'string' && G.HELP[k].length > 0, `HELP.${k} não existe`)
    confere(!G.HELP[k] || G.HELP[k].length <= 160, `HELP.${k} passa de 160 caracteres (${(G.HELP[k] || '').length})`)
    confere(!G.HELP[k] || (a.md.includes(G.HELP[k]) && a.html.includes(escHtml(G.HELP[k]))), `o wiki não traz o texto de HELP.${k} (md e html)`)
  }
  // custo dos pontos: o número do texto é o degrau do código (TUNING.costStep) e a regra é "sobe a cada N pontos", não "cada ponto custa mais"
  confere(G.HELP.custo.includes(`sobe a cada ${S.TUNING.costStep} pontos`), `HELP.custo não diz "sobe a cada ${S.TUNING.costStep} pontos" (TUNING.costStep): ${G.HELP.custo}`)
  confere(!/custa mais que o anterior/.test(G.HELP.custo), 'HELP.custo diz que cada ponto custa mais que o anterior (o custo sobe só a cada degrau)')
  for (const k of G.STAT_KEYS) confere(G.STATS[k].desc === G.HELP[k], `STATS.${k}.desc é diferente de HELP.${k}`)
  confere(Object.keys(G.HELP).every((k) => CHAVES.includes(k)), 'HELP tem chave fora da lista conhecida')
}

// 2b. ícones: skill (e skill de tipo), status, clima, piso, liga e raridade que têm arquivo ganham o <img> antes do nome
const DIR_ICONES = resolve(import.meta.dirname, '..', 'assets', 'icons')
const temIcone = (id) => existsSync(join(DIR_ICONES, id + '.png'))
const IMG = '<img class="ic" src="data:image/png;base64,[A-Za-z0-9+/=]+" alt="" width="16" height="16">'
const reEsc = reEscCedo
const comIconeHtml = (nome) => new RegExp(IMG + '(?:<[^>]+>)*' + reEsc(escHtml(nome))).test(a.html)
const comIconeMd = (id, nome) => new RegExp('!\\[\\]\\(\\.\\./prototype/assets/arte/icones/' + id + '\\.png\\) (?:\\*\\*)?' + reEsc(nome)).test(a.md)
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
const linksImg = [...a.md.matchAll(/!\[\]\(\.\.\/prototype\/assets\/arte\/icones\/([a-z0-9-]+)\.png\)/g)].map((m) => m[1])
confere(linksImg.length >= 40, `md com só ${linksImg.length} imagens de ícone`)
for (const id of linksImg) confere(temIcone(id), `link do md para ícone que não existe: ${id}`)
// seção de reservados: os 2 que ainda não têm tela (as insígnias saíram na Tarefa 4 dos ginásios, Ruling 16), em 32 px
// no html e com link no md
confere(a.html.includes('id="icones-reservados"') && /## Ícones reservados/.test(a.md), 'falta a seção "Ícones reservados"')
{
  const ini = a.md.indexOf('## Ícones reservados'), sec = ini >= 0 ? a.md.slice(ini, a.md.indexOf('\n## ', ini + 5)) : ''
  for (const id of ['ins-fogo', 'ins-agua', 'ins-grama']) confere(sec.length > 0 && !sec.includes('`' + id + '`'), `a insígnia ${id} ainda está nos Ícones reservados`)
  confere(/Estes dois ícones/.test(sec) && !/insígnias dos ginásios/.test(sec), 'o texto dos Ícones reservados ainda fala de cinco ícones ou das insígnias')
}
for (const id of ['item-redea', 'moeda-gema']) {
  confere(a.md.includes(`![](../prototype/assets/arte/icones/${id}.png)`) && a.md.includes('`' + id + '`'), `reservado ${id} sem imagem/nome no md`)
  confere(new RegExp('<img class="ic ic32" src="data:image/png;base64,[A-Za-z0-9+/=]+" alt="" width="32" height="32">(?:<[^>]+>)*<code>' + id + '</code>').test(a.html), `reservado ${id} sem <img> de 32 px no html`)
}

// itens e recompensa diária (spec de itens, loja e diária §4, §6, §7): os itens (os cinco de uso e o Pergaminho de técnica, dos ranks), com preço, limite e origem,
// e a tabela dos 7 dias com a Estrela a cada 4 calendários
confere(a.html.includes('id="itens"') && /## Itens e recompensa diária/.test(a.md), 'falta a seção "Itens e recompensa diária"')
confere(Object.keys(G.ITEMS).join() === 'torrao,estrela,redea,cupom,manual,pergaminho', 'catálogo de itens fora da ordem da spec')
for (const [nome, preco, compra] of [['Torrão de açúcar', '120', '2 por dia'], ['Estrela de treino', '2\\.000', '1 a cada 7 dias'], ['Rédea nova', '\\*\\*não se vende\\*\\*', '—'], ['Cupom de troca de skill', '250', '1 por dia'], ['Manual de doma', '200', '1 por dia'], ['Pergaminho de técnica', '\\*\\*não se vende\\*\\*', '—']]) {
  confere(new RegExp(`\\| \\*\\*${nome}\\*\\* \\|[^\\n]*\\| ${preco} \\| ${compra} \\| [^|\\n]+ \\|`).test(a.md), `tabela de itens: ${nome} devia ter preço ${preco.replace(/\\/g, '')} e compra ${compra}`)
}
for (const id in G.ITEMS) confere(a.md.includes(G.ITEMS[id].desc) && a.md.includes(G.ITEMS[id].origem), `item ${id} sem a linha de para que serve ou de onde vem`)
confere(a.md.includes(`São ${Object.keys(G.ITEMS).length} itens. ${Object.keys(G.ITEMS).length - 1} são de uso único`) && /em \*\*Mochila\*\*, os 6 itens[^\n]*o Pergaminho de técnica não tem Usar/.test(a.md), 'Itens: a contagem (6 itens, 5 de uso único) ou a Mochila sem o Pergaminho')
confere(/até 10 por cavalo/.test(a.md) && /35% de chance de aprender/.test(a.md), 'tabela de itens sem o teto do Torrão (10) ou a chance do Manual (35%)')
for (const [dia, premio] of [['1º', '60 de Ouro'], ['2º', '1 Torrão de açúcar'], ['3º', '100 de Ouro'], ['4º', '1 Manual de doma'], ['5º', '150 de Ouro'], ['6º', '1 Cupom de troca de skill'], ['7º', '200 de Ouro e 1 Rédea nova; a cada 4 calendários completos, também 1 Estrela de treino']]) {
  confere(a.md.includes(`| ${dia} | ${premio} |`), `tabela da recompensa diária: ${dia} dia devia dar ${premio}`)
}
confere(!a.md.includes('Ainda não existe item que sobe estrela'), 'seção Raridades ainda diz que não existe item que sobe estrela')
// a loja como o jogo a mostra (Tarefa 6): a ordem fixa, o "Restam N de M hoje" e os rótulos do botão; onde cada item se usa
confere(a.md.includes('nesta ordem: Torrão de açúcar, Manual de doma, Cupom de troca de skill e Estrela de treino'), 'wiki sem a ordem fixa da loja')
confere(a.md.includes('"Restam 1 de 2 hoje"') && ['Limite de hoje', 'Mochila cheia', 'Sem Ouro', 'Reservado'].every((r) => a.md.includes(`"${r}"`)), 'wiki sem o limite do dia ("Restam N de M hoje") ou sem os rótulos do botão de compra')
confere(/\*\*Onde se usa:\*\*[^\n]*aba Status[^\n]*aba Skills/.test(a.md), 'wiki sem onde cada item se usa (Mochila e ficha)')
confere(!/recursos que vão usá-los \(Rédeas/.test(a.md), 'wiki ainda diz que as Rédeas não existem no jogo (Ícones reservados)')

// ginásios da Expedição (Tarefa 1 dos ginásios): a seção lê tudo de GameData.GYM e GYMS; os nomes dos ginásios, dos
// líderes, dos soldados e das insígnias aparecem no md e no html, e as três faixas do cansaço com os números do catálogo
{
  const ini = a.md.indexOf('## Ginásios da Expedição'), fim = a.md.indexOf('## Ícones reservados')
  const sec = ini >= 0 && fim > ini ? a.md.slice(ini, fim) : ''
  confere(sec.length > 0 && a.html.includes('id="ginasios"'), 'falta a seção "Ginásios da Expedição" (antes dos Ícones reservados)')
  // as insígnias com o ícone delas (Ruling 16): link no md e <img> no html, na linha do ginásio
  for (const id of G.GYM_ORDER) {
    const g = G.GYMS[id], ic = g.insignia.icone
    confere(sec.includes(`![](../prototype/assets/arte/icones/${ic}.png) ${g.insignia.name}`), `a insígnia ${g.insignia.name} sem o ícone ${ic} na tabela do md`)
    confere(new RegExp('<img class="ic" src="data:image/png;base64,[A-Za-z0-9+/=]+" alt="" width="16" height="16">' + escHtml(g.insignia.name)).test(a.html), `a insígnia ${g.insignia.name} sem o <img> no html`)
  }
  // a aba Expedição no wiki (Tarefa 4): os ginásios, a trilha e a vitrine, com nomes e números do catálogo
  const exp = (a.md.match(/^- \*\*Expedição:\*\* (.*)$/m) || [])[1] || ''
  for (const id of G.GYM_ORDER) confere(exp.includes(G.GYMS[id].name), `a aba Expedição no wiki sem o ${G.GYMS[id].name}: ${exp}`)
  confere(exp.includes(`${G.GYMS[G.GYM_ORDER[0]].etapas.length} etapas`) && /trilha/.test(exp) && /de baixo para cima/.test(exp), `a aba Expedição no wiki sem a trilha de ${G.GYMS[G.GYM_ORDER[0]].etapas.length} etapas: ${exp}`)
  confere(/Ponto fraco/.test(exp) && /revanche/.test(exp) && /vitrine de 6 cavalos selvagens/.test(exp), `a aba Expedição no wiki sem o ponto fraco, a revanche ou a vitrine: ${exp}`)
  confere(!/Expedições e captura ainda não existem/.test(exp), 'a aba Expedição no wiki ainda é só a vitrine')
  // Tarefa 8: o desafio inteiro na aba (preparo, time, pagamento, duelos na tela de corrida, cartão, resumo e revanche), sem
  // a frase velha "chega nas próximas partes"; o Perfil com as insígnias; a gaveta DEV com o grupo Ginásios
  for (const [o, re] of [['o preparo e o time', /\*\*Preparo:\*\*.*"Seu time".*na ordem em que vão correr.*"Vantagem" ou "Desvantagem"/],
    ['o ativo da sala aberta fora do time', /sala de corrida aberta \(valendo ou treino\), o cavalo ativo fica de fora/],
    ['o pagamento', /\*\*Pagar:\*\* "Desafiar \(N de Ouro\)" cobra a entrada e só então o desafio é simulado/],
    ['os duelos na tela de corrida', /\*\*Duelos:\*\* cada duelo passa na tela de corrida, com 2 raias: a placa diz "Duelo N" \(nunca quantos serão\)/],
    ['Pular e Pular tudo', /"Pular" termina o duelo.*"Pular tudo" vai direto ao resumo/],
    ['o cartão entre duelos', /Entre um duelo e outro, um cartão.*"Próximo duelo" e "Pular tudo"/],
    ['os metros truncados', /truncados para baixo.*"menos de 1 m"/],
    ['o resumo', /\*\*Resumo:\*\* cada duelo com "Você venceu" ou "Você perdeu".*"Tentar de novo" volta ao preparo com o mesmo time/],
    ['a revanche', new RegExp(`\\*\\*Revanche:\\*\\*.*"Revanche hoje", com a entrada de ${G.GYM.revanche.entrada} de Ouro.*"Revanche de hoje feita\\. Volte amanhã\\."`)]]) {
    confere(re.test(exp), `a aba Expedição no wiki sem ${o}: ${exp}`)
  }
  const fx0 = G.GYM.fadiga.faixas[0]
  confere(exp.includes(`Vitória ${fx0.name.toLowerCase()} (menos de 1 m): … larga com ${Math.round((1 - fx0.perde) * 100)}% do fôlego`), 'a aba Expedição no wiki sem o exemplo do cartão com a faixa do catálogo')
  confere(!/próximas partes/.test(a.md) && !/próximas partes/.test(a.html), 'o wiki ainda diz que algo dos ginásios "chega nas próximas partes"')
  const perfil = (a.md.match(/^- \*\*Perfil \(o botão do cabeçalho\):\*\* (.*)$/m) || [])[1] || ''
  confere(perfil.includes(`"Insígnias (N de ${G.GYM_ORDER.length})"`) && G.GYM_ORDER.every((id) => perfil.includes(G.GYMS[id].insignia.name)) && /Vença o líder do/.test(perfil), `o Perfil no wiki sem as insígnias: ${perfil}`)
  // correção 1 da Tarefa 8: o que os ginásios deixaram velho fora da seção deles, com a verdade tirada do catálogo
  //  - todo item que alguma etapa de ginásio dá (ou o rodízio da revanche) tem os ginásios como origem na seção Itens; a Rédea
  //    nova, que não se vende, diz isso também na frase "não está à venda"
  const secItens = a.md.slice(a.md.indexOf('## Itens e recompensa diária'), a.md.indexOf('## Ginásios da Expedição'))
  const dosGin = (secItens.match(/^\*\*Dos ginásios\*\*.*$/m) || [''])[0]
  for (const id of Object.keys(G.ITEMS)) {
    const daGin = G.GYM_ORDER.some((g) => G.GYMS[g].etapas.some((e) => e.premio.itens.includes(id) || (id === 'pergaminho' && e.premio.pergaminhos > 0))) || G.GYM.revanche.ciclo.some((c) => c.item === id)
    confere(daGin === dosGin.includes(G.ITEMS[id].name), `Itens: ${G.ITEMS[id].name} ${daGin ? 'vem dos ginásios e o wiki não diz' : 'aparece como prêmio de ginásio sem ser'}: ${dosGin}`)
    // a coluna "De onde vem" da tabela é o texto origem do catálogo (Ruling 28): cita os ginásios só quando eles dão o item
    const linhaTab = (secItens.match(new RegExp(`^\\| \\*\\*${G.ITEMS[id].name}\\*\\* \\|.*$`, 'm')) || [''])[0]
    const deOnde = linhaTab.split('|').map((x) => x.trim()).filter(Boolean).pop() || ''
    confere(deOnde === G.ITEMS[id].origem && daGin === /ginásio/.test(deOnde), `Itens: a coluna "De onde vem" de ${G.ITEMS[id].name} é "${deOnde}"`)
    if (daGin && G.ITEMS[id].price == null) {
      const venda = (secItens.match(new RegExp(`(?:A|O) ${G.ITEMS[id].name} não está à venda: [^.]*\\.`)) || [''])[0]
      confere(/ginásio/.test(venda), `Itens: a frase "${G.ITEMS[id].name} não está à venda" não fala dos ginásios: ${venda}`)
    }
  }
  //  - a chance de skill por level com a insígnia de tipo 'skill' (a base do sim.js e o bônus do catálogo)
  const insSk = G.GYM_ORDER.find((g) => G.GYM.insignias[g].tipo === 'skill'), lc = S.TUNING.learnChance
  confere(a.md.includes(`A cada level ganho há ${Math.round(lc * 100)}% de chance de aprender uma skill nova (${Math.round((lc + G.GYM.insignias[insSk].valor) * 100)}% com a ${G.GYMS[insSk].insignia.name}`), 'Level e XP: a chance de skill sem o bônus da insígnia')
  //  - o XP dos duelos e o bônus de XP fora da seção dos ginásios; o Ouro dos ginásios; o dia da revanche
  const insXpId = G.GYM_ORDER.find((g) => G.GYM.insignias[g].tipo === 'xp')
  confere(a.md.includes(`ganha ${G.GYM.xp.vence} de XP por duelo vencido e ${G.GYM.xp.perde} por duelo perdido`) && a.md.includes(`Com a ${G.GYMS[insXpId].insignia.name}, todo XP somado`), 'Level e XP: sem o XP dos duelos de ginásio ou o bônus da insígnia de XP')
  confere(/Ganha-se Ouro correndo[^.]*nos prêmios dos ginásios/.test(a.md), 'Economia: o Ouro dos ginásios não aparece entre as fontes de Ouro')
  confere(/\*\*O dia\*\*[^\n]*a revanche de cada ginásio, o da última tentativa/.test(a.md), 'O dia: sem o registro da revanche')
  const devGin = (a.md.match(/^- \*\*Ginásios:\*\* (.*)$/m) || [])[1] || ''
  confere(/Definir etapas/.test(devGin) && /Liberar revanche/.test(devGin) && /Zerar ginásios/.test(devGin), `o Modo DEV no wiki sem o grupo Ginásios: ${devGin}`)
  for (const id of G.GYM_ORDER) {
    const g = G.GYMS[id]
    for (const [tipo, nome] of [['ginásio', g.name], ['líder', g.lider], ['insígnia', g.insignia.name], ...g.etapas.map((e) => ['soldado', e.nome])]) {
      confere(sec.includes(nome), `${tipo} "${nome}" não aparece na seção Ginásios do md`)
      confere(a.html.includes(escHtml(nome)), `${tipo} "${nome}" não aparece no html`)
    }
    confere(a.html.includes(`id="ginasio-${id}"`), `trilha do ginásio ${id} sem âncora no html`)
    g.etapas.forEach((e, i) => confere(new RegExp(`\\| ${e.lider ? 'Líder' : 'Soldado ' + (i + 1)} \\| ${e.nome} \\|[^\\n]*\\| ${e.entrada} \\| ${e.premio.ouro} de Ouro`).test(sec), `trilha ${id}: etapa ${i + 1} sem entrada ${e.entrada} ou prêmio ${e.premio.ouro}`))
  }
  const fx = G.GYM.fadiga.faixas
  confere(sec.includes(`| ${fx[0].name} | menos de ${fx[0].ate} m | ${Math.round(fx[0].perde * 100)}% |`) && sec.includes(`| ${fx[1].name} | de ${fx[0].ate} a menos de ${fx[1].ate} m | ${Math.round(fx[1].perde * 100)}% |`) && sec.includes(`| ${fx[2].name} | ${fx[1].ate} m ou mais | ${Math.round(fx[2].perde * 100)}% |`), 'tabela do cansaço não confere com GameData.GYM.fadiga')
  confere(sec.includes(`até ${Math.round(G.GYM.fadiga.teto * 100)}%`) && sec.includes(`${Math.round(G.GYM.vantagem * 100)}% maiores`), 'seção Ginásios sem o teto do cansaço ou o percentual da vantagem')
  confere(sec.includes(`entrada de ${G.GYM.revanche.entrada} de Ouro`) && sec.includes(`${G.GYM.xp.vence} de XP por duelo vencido e ${G.GYM.xp.perde} por duelo perdido`), 'seção Ginásios sem a revanche ou o XP por duelo')
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
