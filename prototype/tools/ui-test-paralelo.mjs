// Teste de interface em paralelo: um processo `node ui-test.mjs` por bloco (UI_SO=<nome>), sem dependências.
//   node tools/ui-test-paralelo.mjs              (é o que o scripts/check.sh roda na etapa 8/8)
//   UI_JOBS=2 node tools/ui-test-paralelo.mjs    -> 2 processos ao mesmo tempo (padrão: 4)
// Os blocos saem de `node ui-test.mjs --blocos` (a lista BLOCOS do ui-test.mjs): roda cada um exatamente uma vez.
// Fase 1: os blocos comuns, numa fila com UI_JOBS trabalhadores, os mais demorados primeiro (DURACOES abaixo; bloco que
// não está lá entra como demorado). Fase 2: os blocos sensíveis a tempo (EM_SERIE), um por vez, sem concorrência.
// Nunca grava em prototype/screens/: usa o SHOTS_DIR recebido ou uma pasta temporária (apagada no fim).
// Sai com 1 e imprime PROBLEMAS: (com a saída de cada bloco que falhou) se algum bloco não terminar com a linha OK:.
// Sem repetição automática: bloco que falha é falha. Bloco que falha de vez em quando em paralelo vai para EM_SERIE.
// O jeito antigo (num processo só, regravando as capturas oficiais) continua: node tools/ui-test.mjs, sem UI_SO.
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const UI = join(AQUI, 'ui-test.mjs')
const OFICIAL = resolve(AQUI, '..', 'screens')

// Blocos com asserção sobre tempo real medido (performance.now(), o relógio do quadro ou um intervalo de timer): com
// outros processos disputando a CPU, eles podem falhar sem o jogo ter piorado. Rodam na fase 2, sozinhos.
const EM_SERIE = {
  corrida: 'a lista da faixa de ordem 300 ms parada (limite de 15 s), reescritas com >= 240 ms de intervalo e atraso <= 320 ms (performance.now()), >= 10 escritas da linha dos vizinhos (timer de 500 ms) e a faixa do lugar 2,4–2,7 s reais na tela',
  'corrida-8': 'a lista da faixa de ordem 300 ms parada (performance.now(), limite de 15 s) e a próxima escrita da linha dos vizinhos',
  'corrida-faixa-lugar': 'a faixa do lugar 2,4–2,7 s reais na tela (relógio do quadro, s.tReal)',
  'corrida-dado-reduzido': 'a faixa do lugar 2,4–2,7 s reais na tela (relógio do quadro, s.tReal)',
  'marcas-corrida': 'ms por quadro com 8 Míticos contra o teto TETO_MS (6 ms)',
  'portes-corrida': 'ms por quadro com 8 Míticos de portes alternados contra o teto TETO_MS (6 ms)',
  'crescimento-jogo': 'abrir a sala custa < 15 ms em média (performance.now())',
  'fluxo-desempenho': 'desenho por quadro a 1280 com chuva e ventania: "Completas" − "Reduzidas" <= 6 ms',
  fluidez: 'o tempo de cada troca de tela (do toque ao 2º quadro, performance.now(), CPU 4× mais lenta) contra o teto de cada troca (90 a 170 ms)',
  'ginasio-corrida': 'três duelos assistidos sem tocar: o duelo em x2 mais curto que em x1 (segundos reais, performance.now()) e a faixa do lugar no fim de cada um'
}

// Duração de cada bloco da fase 1 em segundos (o processo inteiro, com o Chromium), medida com UI_JOBS=4 numa máquina de 4
// núcleos (2026-11-17): só ordena a fila (os mais demorados primeiro). Bloco que não está aqui entra como o mais demorado.
const DURACOES = {
  itens: 89, 'corrida-lugar-dado': 63, 'fluxo-curvas': 45, fluxo: 42, 'fluxo-moldes': 39, skills: 36,
  'fluxo-natureza': 36, 'skills-aba': 8, celular: 34, 'fluxo-desktop': 31, 'fluxo-dado': 25, portes: 23, 'fluxo-pequeno': 21,
  'corrida-faixa-lugar-pular': 21, 'corrida-390': 19, 'corrida-lugar-dado-redimensiona': 19, crescimento: 15,
  'corrida-paisagem-8': 13, 'corrida-girar': 13, 'corrida-faixa-lugar-pular-antes': 12, marcas: 12, build: 12,
  acabamento: 14, redimensiona: 10, resultado: 9, aura: 8, ajuda: 8, icones: 8, 'fluxo-abas': 7, 'corrida-forcado': 7,
  teto: 7, 'fluxo-cruzamento': 7, producao: 6, migracao: 5, 'adulterado-v5': 5, 'corrida-etiquetas-dado': 5,
  escala: 5, 'fluxo-dev': 4, selo: 4, retrato: 3, gravacao2: 3, 'fluxo-capturas-itens': 3, 'selo-teto': 3, reserva: 3,
  areasegura: 3, texto: 3, 'vaga-tipo': 3, gravacao: 4, 'nivel-pontos': 3, 'fluxo-saves': 3, adulterado: 2,
  corrompido: 2, treino: 2, 'fluxo-equipamento': 2, aviso: 2, 'fluxo-sem-icones': 2, 'build-nivel1': 2, inicial: 2,
  'fluxo-build-teste': 2, 'valor-peca': 1, 'fluxo-loja': 1, ginasio: 104, 'ginasio-corrida': 86, 'fluxo-capturas-ginasio': 14, mapa: 15
}

const lista = execFileSync(process.execPath, [UI, '--blocos'], { encoding: 'utf8' }).split('\n').map((x) => x.trim()).filter(Boolean)
if (!lista.length) { console.log('PROBLEMAS:\nui-test.mjs --blocos não devolveu nenhum bloco'); process.exit(1) }
const foraDaLista = Object.keys(EM_SERIE).filter((n) => !lista.includes(n))
if (foraDaLista.length) { console.log('PROBLEMAS:\nEM_SERIE com bloco que não existe no ui-test.mjs: ' + foraDaLista.join(', ')); process.exit(1) }
const JOBS = Math.max(1, Math.floor(Number(process.env.UI_JOBS) || 4))

const pastaPropria = !process.env.SHOTS_DIR
const SHOTS = process.env.SHOTS_DIR || await mkdtemp(join(tmpdir(), 'ui-paralelo-'))
if (resolve(SHOTS) === OFICIAL) { console.log('PROBLEMAS:\no modo paralelo nunca grava em prototype/screens/ (SHOTS_DIR aponta para lá)'); process.exit(1) }

const vivos = new Set()
const encerra = () => { for (const f of vivos) f.kill('SIGTERM') }
process.on('SIGINT', () => { encerra(); process.exit(130) })
process.on('SIGTERM', () => { encerra(); process.exit(143) })

const rodadas = {}   // nome -> { codigo, saida, s, ok }
const seg = (ms) => +(ms / 1000).toFixed(1)
const fmt = (s) => String(s.toFixed(1)).replace('.', ',') + ' s'
const rodaBloco = (nome) => new Promise((ok) => {
  const t0 = Date.now()
  const filho = spawn(process.execPath, [UI], { env: { ...process.env, UI_SO: nome, UI_PARALELO: '1', SHOTS_DIR: SHOTS }, stdio: ['ignore', 'pipe', 'pipe'] })
  vivos.add(filho)
  let saida = ''
  filho.stdout.on('data', (d) => { saida += d })
  filho.stderr.on('data', (d) => { saida += d })
  const fim = (codigo) => {
    vivos.delete(filho)
    const linhas = saida.trimEnd().split('\n')
    const ultima = linhas[linhas.length - 1] || ''
    const r = { codigo, saida, s: seg(Date.now() - t0), ok: codigo === 0 && ultima.startsWith('OK:'), ultima }
    if (rodadas[nome]) rodadas[nome].repetido = true   // não acontece (cada nome entra uma vez na fila); a conferência do fim acusa
    else rodadas[nome] = r
    console.log(`${r.ok ? 'ok   ' : 'FALHA'} ${nome}  ${fmt(r.s)}`)
    ok(r)
  }
  filho.on('error', (e) => { saida += '\n' + e.message; fim(-1) })
  filho.on('close', (codigo) => fim(codigo))
})

const T0 = Date.now()
const peso = (n) => (n in DURACOES ? DURACOES[n] : Infinity)
const fila = lista.filter((n) => !(n in EM_SERIE)).sort((a, b) => peso(b) - peso(a))
const serie = lista.filter((n) => n in EM_SERIE)
console.log(`fase 1: ${fila.length} blocos, ${JOBS} por vez`)
await Promise.all(Array.from({ length: Math.min(JOBS, fila.length) }, async () => {
  while (fila.length) await rodaBloco(fila.shift())
}))
const T1 = Date.now()
console.log(`fase 2 (em série, sensíveis a tempo): ${serie.length} blocos`)
for (const n of serie) await rodaBloco(n)
const T2 = Date.now()
if (pastaPropria) await rm(SHOTS, { recursive: true, force: true })

// confere: cada nome de --blocos rodou exatamente uma vez e terminou com a linha OK:
const falhas = []
for (const n of lista) {
  const r = rodadas[n]
  if (!r) falhas.push(`[bloco ${n}] não rodou`)
  else if (r.repetido) falhas.push(`[bloco ${n}] rodou mais de uma vez`)
  else if (!r.ok) {
    const linhas = r.saida.trimEnd().split('\n')
    const i = linhas.findIndex((l) => l.startsWith('PROBLEMAS:'))
    const trecho = i >= 0 ? linhas.slice(i + 1) : linhas.slice(-40)
    falhas.push(`[bloco ${n}] saiu com ${r.codigo}${i >= 0 ? '' : ' sem a linha OK: (últimas linhas da saída)'}:\n` + trecho.map((l) => '  ' + l).join('\n'))
  }
}
for (const n of Object.keys(rodadas)) if (!lista.includes(n)) falhas.push(`[bloco ${n}] rodou sem estar em --blocos`)

console.log('\ntempo por bloco (s):')
for (const n of [...lista].sort((a, b) => (rodadas[b] ? rodadas[b].s : 0) - (rodadas[a] ? rodadas[a].s : 0))) {
  if (rodadas[n]) console.log(`  ${n.padEnd(34)} ${String(rodadas[n].s).padStart(6)}${n in EM_SERIE ? '  (em série)' : ''}`)
}
const total = `total ${fmt(seg(T2 - T0))} (fase paralela ${fmt(seg(T1 - T0))}, em série ${fmt(seg(T2 - T1))})`
console.log(total)
if (falhas.length) {
  console.log('PROBLEMAS:\n' + falhas.join('\n'))
  process.exit(1)
}
// a nota de desempenho do fluxo (a única que o OK: do ui-test.mjs leva), se algum bloco a deu
const dq = Object.values(rodadas).map((r) => (r.ultima.match(/ \(desenho por quadro[^)]*\)$/) || [])[0]).find(Boolean) || ''
console.log(`OK: ${lista.length} blocos da interface (${JOBS} por vez + ${serie.length} em série) sem erros de console, sem rolagem horizontal e com o cavalo sempre na tela, ${total}${dq}`)
