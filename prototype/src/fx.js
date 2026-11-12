/*
 * MMORPG Horse — efeitos da corrida (protótipo descartável): window.RaceFx.
 *
 * Só apresentação. Nada daqui volta para a simulação (RaceSim): a tela lê o resultado pronto e
 * desenha por cima. Sem Math.random e sem estado sorteado: tudo é função do tempo de simulação
 * (simT; na natureza, o tempo real da tela), do índice (corredor ou partícula) e de hashes fixos da
 * seed. O módulo tem duas partes, nesta ordem:
 *
 * ============================== FUNÇÕES PURAS ===============================
 * Sem DOM e sem canvas; testadas no Node por tools/fx-test.js.
 *
 *   RaceFx.timeline(sim, racers, escala) -> [{ kind, t0, t1, racer, ... }] ordenada por t0 (estável).
 *     Uma lista de efeitos montada UMA vez por corrida a partir de sim.events. Hoje:
 *       'dado' { t0: ev.t, t1: ev.t + 2.4·escala, racer: winner, winner, rolls (cópia), changed,
 *                weather, escala }   — um por evento 'dado'.
 *       'skill' { t0: ev.t, t1, racer, skillId, icon, clima, element, cavalo, nome, nomeCurto, silks, raia,
 *                escala } — um por
 *                evento 'skill'. t1 = t0 + duração do efeito real da simulação (durationS; ou o
 *                tempo para o cavalo andar distanceM pelos frames; ou até sair do bloco se
 *                blockScoped; sem duração, o mínimo), limitada a [1.5, 7]·escala. A skill é achada
 *                pelo trecho ' ativou <Nome>!' do texto do evento entre as skills do cavalo
 *                (racers[i].horse.skills). element = o da skill; no desenho, 'geral' usa o elemento do
 *                cavalo (campo cavalo). clima = 'sol'|'chuva'|'nevoa' (do trigger weather:*) para o ícone.
 *                silks e raia (1..n) vêm de racers e servem ao balão (borda e número na cor da raia).
 *       'skill' com typeSkill: true — um por evento de skill de TIPO (ev.typeSkill, entrada no terço): o
 *              balão (e a faixa central do jogador) dessa entrada. skillId/nome = GameData.TYPE_SKILLS do corredor
 *              (achada pelo id de sim.racerInfo[i].typeSkill; sem id, pelo elemento do cavalo), nomeCurto = o
 *              `short` do catálogo, element = o tipo, icon = 'chama' | 'folha' | 'onda', from/to = o terço (m),
 *              t1 = t0 + 1.5·escala. Corredor sem racerInfo.typeSkill: nenhum item. A tela não usa esse item
 *              para contorno nem rastro: o efeito do terço inteiro é a drawTypeAura (pela typeZone).
 *       'garra' { t0: ev.t, t1: finishTime + 0.6, racer, icon, element, silks, raia, escala }   — um por evento 'garra'.
 *       'cansou' { t0: ev.t, t1: t0 + 1.5·escala, racer, silks, raia, escala }   — um por evento 'cansou'.
 *     Balão, faixa central do jogador e "CANSOU" duram 1.5·escala a partir de t0 (BALAO.dur).
 *     escala (padrão 1) = segundos de simulação por segundo real em x1. As janelas do Dado (2,4 s,
 *     câmera lenta de 0,8 s, giro de 0,4 s, novo giro até 0,64 s) estão em "segundos de
 *     apresentação": com escala 1 são segundos de simulação; a tela passa a sua escala de
 *     reprodução (sim.duration / duração real alvo, ~3,6–4,8). Em segundos reais (x1): câmera lenta
 *     ~2 s, giro ~1 s, novo giro até 0,6 s, brilho do vencedor ~2 s e faixa ~3,6 s (spec §5).
 *
 *   RaceFx.skillIcon(skill) -> 'vel'|'ace'|'folego'|'curva'|'subida'|'dado'|'clima'|'garra' (os itens de skill de
 *     tipo usam 'chama' | 'folha' | 'onda', desenhados como os outros ícones de 8×8)
 *     Primeira chave presente em skill.effect, nesta ordem: speedMult→vel, accelMult→ace,
 *     staminaRestore→folego, drainMult(<1)→folego, curveBonus→curva, hillBonus→subida,
 *     hillDrainMult→subida, extraDice→dado, weatherDouble→clima, garraChanceBonus→garra,
 *     garraBoostBonus→garra; nenhuma (ou sem skill) ⇒ 'vel'.
 *   RaceFx.nomeCurto(nome, short) -> texto do balão: o nome inteiro em maiúsculas se couber em 12
 *     letras; senão o campo opcional `short` do catálogo (data.js), ou, sem ele, o nome cortado
 *     em palavras inteiras seguidas de "." na última que sobrar.
 *   RaceFx.typeZone(typeSkill, pos) -> fração (0..1) já percorrida do terço [from, to) da skill de tipo
 *     (sim.racerInfo[i].typeSkill = { id, name, from, to }, metros fracionários) no metro pos, ou null fora
 *     dele, sem skill de tipo ou com dado torto (from/to não numéricos, to ≤ from, pos inválido).
 *   RaceFx.typeSkillOf(sim, i, horse) -> { el, id, name, short, from, to } | null: a skill de tipo do corredor i,
 *     resolvida como no item da timeline (terço de sim.racerInfo[i].typeSkill; elemento e nome curto do catálogo
 *     pelo id, ou pelo elemento do cavalo). A tela usa o mesmo el para a aura (uma fonte só).
 *   RaceFx.ELEM -> cores claras dos elementos (balão, contorno, aura e terços do minimapa).
 *   RaceFx.iconeDe(item) -> nome do ícone desenhado: item.icon, mas 'clima' vira 'sol'|'gota'|'nevoa'
 *     pelo trigger da skill (weather:sol, weather:chuva, weather:nevoa).
 *
 *   RaceFx.setIconImages(mapa) -> troca o cache de ícones PNG ({ nome: imagem já carregada }); {} esvazia.
 *   RaceFx.iconImage(nome) -> a imagem do cache ou null.
 *   RaceFx.iconNameOf(item) -> nome do ícone PNG de um item de balão: 'sk-tipo-<elemento>' (skill de tipo),
 *     'sk-<skillId>', 'cl-<clima>', ou null (Garra, cansou, sem id: ficam com o ícone em código).
 *   RaceFx.drawIconPng(ctx, nome, x, y, lado, S) -> boolean: desenha o PNG em lado·S px (sem suavização)
 *     só se estiver no cache e lado·S >= 16; senão não desenha nada e devolve false (quem chama usa o
 *     desenho em código de sempre). Só desenho: a simulação não depende disso.
 *
 *   RaceFx.skillBannerLayout(texto, artW, S, temImg, textW) -> { fs, icone, x, w, h, iconX, iconDy, textX, textDy }:
 *     geometria (em px lógicos) da faixa de skill do jogador no centro da pista; textW(str, escala) mede o texto.
 *     fs = 2 se couber (contando o ícone, quando ele vai ser desenhado), senão 1; se nem assim couber com
 *     ícone, o ícone sai. icone = temImg && 8·fs·S >= 16 (mesma guarda do drawIconPng): só então a largura
 *     8·fs + 2 é reservada. Sem ícone é a faixa de sempre (w = textW + 8, h = 5·fs + 6). x é a borda esquerda
 *     da caixa; iconX = x + 4; textX é o centro do texto; iconDy/textDy são os recuos verticais dentro da caixa.
 *
 *   RaceFx.slowFactor(tl, simT, reduced) -> 0.4 dentro de [t0, t0 + 0.8·escala] de cada 'dado'
 *     ([t0, t0 + 0.4·escala] se reduced), senão 1. A tela usa slowK = min(slowK, slowFactor).
 *
 *   RaceFx.diceState(item, simT, reduced, racer) -> { fase, brilho, dourado, tempo, reduced }
 *     racer = índice do corredor (padrão: item.racer, o vencedor). Com d = (simT − t0) / escala:
 *       'gira'   em [0, 0.4)              (pulada se reduced)
 *       'regira' em [0.4, 0.64)           só para rolls[racer].rerolls > 0 (pulada se reduced)
 *       'mostra' até 2.4                   'fim' fora de [t0, t1)
 *     brilho (0..1) só do vencedor: pulsa em [0.64, 2.4] (fixo em 1 se reduced, desde t0);
 *     dourado = o vencedor já foi revelado (plaquinha dourada). tempo = segundos reais desde t0
 *     em x1 (a câmera lenta descontada): é o relógio das animações do dado e das faíscas.
 *
 *   RaceFx.diceLabels(roll) -> { marca, best: '87', outros: ['42'] }  (outros = os demais dados, na
 *     ordem rolada; marca '↻' quando houve desempate: a simulação reescreve dice/best de quem empatou
 *     no topo e o valor empatado não fica no evento, então o número mostrado é o da nova rolagem).
 *   RaceFx.badgeSize(roll)  -> { w, h } em pixels de arte do retângulo da plaquinha (com a pontinha).
 *   RaceFx.stripOrder(item) -> índices da faixa: o vencedor primeiro, depois rerolls decrescente
 *     (quem disputou o desempate empatou no topo) e best decrescente; por fim a raia.
 *   RaceFx.stripLayout(item, racers, lay) -> caixa da faixa "DADO DA SORTE" em pixels de arte
 *     ({ x, y, w, h, linhas, rotulo: {x, y}, entradas: {x, y} }); lay = layout da tela da corrida
 *     ({ artW, hudH, compact }). Uma linha quando cabe; senão o rótulo em cima e os números embaixo.
 *   RaceFx.layoutBadges(rects, W, H, fixos) -> rects (cópias, mesma ordem): cada um preso a
 *     [0, W] × [0, H] e, na ordem do y desejado, deslocado na vertical (para cima no empate) até não
 *     sobrepor os já colocados nem os fixos (obstáculos que não se movem e não voltam, como a
 *     etiqueta "◀VOCÊ"), com 1 px de folga. Sem altura para empilhar, vai para o lado. Unidade livre.
 *
 *   RaceFx.wind(seed) -> { intensity: 'calmo'|'brisa'|'ventania', dir: 1 | -1 }   (vento, só visual)
 *     Hash próprio da seed (sal fixo; não chama nenhum fluxo de números da simulação): calmo 35 %,
 *     brisa 40 %, ventania 25 %; dir (1 = para a direita) por outro hash. O modo DEV pode forçar (L.dev.wind).
 *   RaceFx.rainSlant(wind) -> dx por dy dos pingos (calmo 0,12 · brisa 0,35 · ventania 0,75, com o sinal de dir).
 *   RaceFx.NATUREZA (tetos por tela), RaceFx.RAIN (velocidade, cores), RaceFx.SOMBRA_NUVEM (cor das sombras).
 *
 *   RaceFx.curveRuns(curves) -> [[a, b], …] (cópias): as sequências de curva do DESENHO — junta os intervalos
 *     [a, b] (metros; cond.curves, um por bloco 'curva') em que a é o b do anterior (|Δ| < 1e-6). A simulação
 *     continua por bloco; o mapa, o minimapa, a pista lateral e as placas tratam blocos de curva colados como
 *     uma curva só. Não muta a entrada; null ⇒ [].
 *   RaceFx.trackPath(blocks) -> { pts: [[x, y], …], ms: [metros de cada ponto], giroTotal (graus),
 *                                 segs: [{ type, i0, i1 }], distance, bbox: { x0, y0, x1, y1, w, h } }
 *     O traçado visto de cima, em metros e coordenadas de tela (x para a direita, y para baixo). Um ponto a
 *     cada ~10 m (cada bloco em passos iguais; as pontas dos blocos são pontos). Rumo inicial 0° (para a
 *     direita); reta e subida em linha reta; cada SEQUÊNCIA de blocos 'curva' colados (como curveRuns) gira no
 *     sentido anti-horário (na tela) clamp(comprimento da sequência / 150 × 90, 45, 180) graus, distribuídos
 *     por metro (cada passo de comprimento d gira g·d/L; meio giro antes e meio depois de cada passo).
 *     giroTotal = soma dos giros das sequências. segs: um por bloco, com os índices dos pontos das pontas.
 *   RaceFx.pathAt(path, m) -> [x, y] no metro m (interpolado; preso entre a largada e a chegada).
 *   RaceFx.curveOffset(curves, m) -> px de arte, por SEQUÊNCIA [a, b] (intervalos colados da lista, em ordem,
 *     contam como um só): −6 × sen(π/2 × min(1, (m − a)/R, (b − m)/R)), R = min((b − a)/2, CURVA.rampa = 120 m)
 *     — o mesmo −6·sen(πu) de sempre até 240 m; numa curva mais longa o arco fica inteiro no meio (platô).
 *     0 fora e nas pontas. A pista lateral (Sprites.drawTrack) sobe −round(curveOffset) por coluna; a tela
 *     soma o mesmo no y dos cavalos (as duas recebem curveRuns(cond.curves)).
 *   RaceFx.CURVA = { arco: 6, arquibancada: 10, rampa: 120, … } (pixels de arte no meio da curva; metros da
 *     rampa do arco; giros do traçado).
 *
 * ================================= DESENHO ==================================
 * Canvas 2D em pixel art (x, y em px do canvas; S = px por pixel de arte). Precisa de window.Sprites
 * (fonte 3×5). Nenhuma imagem: dados, plaquinhas e faíscas saem de fillRect.
 *
 *   RaceFx.drawDice(ctx, x, y, S, roll, estado, isWinner, simT, cor) -> texto desenhado ('' no giro)
 *     (x, y) = canto do retângulo de badgeSize. 'gira'/'regira': cubo de 9×9 girando (4 quadros) e
 *     quicando; 'mostra': plaquinha com o best (precedido de "↻" se houve desempate) e, depois de um
 *     traço, os outros dados em cinza; borda na cor da raia (cor). Vencedor revelado: plaquinha dourada, halo pulsando com o brilho e
 *     faíscas em volta (omitidas em reduced).
 *   RaceFx.drawDiceStrip(ctx, item, racers, lay, S, simT, reduced) -> caixa (stripLayout) ou null
 *     Faixa "DADO DA SORTE" abaixo do HUD: chip na cor da raia (com o nº da raia) + número de cada
 *     cavalo ("↻" antes do número de quem desempatou). Enquanto os dados giram: ordem das raias e
 *     números rolando; depois da revelação (d ≥ 0.64, ou já em t0 se reduced): ordem de stripOrder,
 *     vencedor em dourado pulsante.
 *
 *   RaceFx.balloonSize(item, pilha) -> { w, h } em pixels de arte do corpo do balão (altura 11; a pontinha
 *     de 3 px fica à esquerda, fora de w). pilha > 0 é a versão compacta (chip + ícone).
 *   RaceFx.drawBalloon(ctx, x, y, S, item, simT, pilha) -> true se desenhou. (x, y) = canto do corpo.
 *     Preso à raia do cavalo (a tela põe à frente do focinho): borda e pontinha na cor da seda, chip
 *     com o número da raia, ícone de 8×8 (por código, no estilo dos ícones de status) e o nome curto
 *     na cor do elemento; Garra dourada; cansou cinza ("CANSOU"). Entra subindo 2 px, some em
 *     1.5·escala. pilha 0..2: 0 = o mais novo (texto + pontinha); os outros crescem para a frente.
 *   RaceFx.glow(item, simT, reduced) -> { cor, alpha } | null: brilho do contorno da silhueta
 *     (a tela desenha Sprites.drawHorseSilhouette atrás do cavalo, 1 px de arte nas 4 direções).
 *   RaceFx.drawSkillAura(ctx, box, item, simT, reduced) -> true se está ativo. box = { x, y, w, h, S }
 *     em px do canvas. Linhas de vento atrás para vel/ace/Garra; "+" verde para folego; faíscas nos
 *     cascos para curva. Em reduced não desenha nada (são partículas); o contorno vem do glow.
 *
 *   RaceFx.drawTypeAura(ctx, elemento, x, y, escala, t, reduzido) -> true se desenhou (conta em _stats.auras).
 *     Aura da skill de tipo enquanto o cavalo está no terço (a tela chama quando typeZone ≠ null, fora da
 *     contagem, ANTES do anel dourado e do cavalo: nada cobre o cavalo, o jóquei, o número da raia ou os balões).
 *     (x, y) = canto do sprite em px do canvas (o de Sprites.drawHorse), escala = px do canvas por pixel de arte,
 *     t = relógio em segundos de apresentação (a tela passa simT / escala de reprodução + 0,37·raia). Só
 *     fillRect de cor sólida em pixels de arte inteiros; nada de alfa, gradiente, arco, Math.random ou Date
 *     (tremor das chamas pelo hash). Sempre um contorno parado no chão em volta dos cascos: Fogo e Água = anel de
 *     4 retângulos na cor do elemento; Grama = faixa de raiz marrom-escura com 2 realces claros curtos e as pontas
 *     subindo (5 retângulos; o verde sumiria no gramado). Cores da Grama (AURA.grama) escolhidas pelo contraste
 *     com todos os pisos (o fx-test confere). Fora do reduzido, por cima dele: Fogo = 5 chamas que nascem nos cascos e ficam para
 *     trás + 2 brasas; Grama ("Raízes Firmes") = raiz marrom dominante — 3 raízes que se esticam pelo chão
 *     para trás descendo em degrau, com a ponta clara, uma para a frente e 3 que agarram para cima entre as patas — e 4 folhas claras
 *     de 2×2 com sombra escura e um pixel verde, subindo atrás; Água = onda alta atrás
 *     do casco de trás (crista que sobe e desce, espuma), marolas e gotas. No máximo 30 fillRect (AURA.max).
 *     Elemento sem skill de tipo (neutro, geral, desconhecido): false, nada desenhado.
 *   RaceFx.drawNature(ctx, o) — natureza por clima, função de o.t (segundos reais), do índice e da seed
 *     (nada sorteado com estado). o = { weather, wind, t, W, H, P, laneTop, trackBottom, reduced, seed,
 *     cam, camada, lift, surface }: W×H e P em px do canvas; cam = px que a câmera andou (respingos presos ao chão);
 *     surface = piso ('grama'|'terra'|'areia'; tom e alfa do calor por piso, RaceFx.CALOR);
 *     lift(px) = quanto o chão sobe naquela coluna (relevo da subida); camada 'tras' (antes dos cavalos:
 *     calor, respingos, névoa do fundo), 'frente' (depois: véus, sol, pingos, relâmpago, sombras, folhas)
 *     ou omitida (as duas, nessa ordem).
 *       sol: véu quente, brilho em degraus, 3 raios de luz (alfa até 0,15) descendo do sol e faixas de
 *            calor ondulando sobre a pista, traço branco-azulado de miragem (somem em reduced).
 *       chuva: pingos inclinados pelo vento (rainSlant), em dois tons; respingos só em [laneTop,
 *            trackBottom]; relâmpago raro (nunca em reduced). Em reduced: 40 % da velocidade e metade
 *            dos pingos e respingos — anda, nunca congela.
 *       névoa: véu claro e 3 faixas atrás; a camada da frente é drawFogFront. As duas andam com o vento.
 *       nublado: véu, sombras de nuvem e nuvens do topo levadas pelo vento.
 *       folhas (e poeira no tempo seco) no sentido do vento: calmo 0, brisa até 10, ventania até 18 por
 *            tela (metade em reduced, e a 40 % da velocidade). Folha de 3×2 px de arte com 1 px mais
 *            escuro, girando em 4 quadros (RaceFx.FOLHA). Nuvens e névoa: ×0,5 / ×1 / ×2,2.
 *     Tetos por tela em NATUREZA (pingos 240, respingos 48, ~2600 fillRect no pior caso).
 *   RaceFx.drawFogFront(ctx, o) — faixas de névoa na frente dos cavalos (só weather 'nevoa').
 *   RaceFx.drawTrackMap(ctx, path, box, opts) -> { largada: [x, y], chegada: [x, y], enc } (pixels de arte)
 *     Mapa da pista (sala de largada): o traçado em escala única para caber em box = { x, y, w, h, P } (pixels
 *     de arte; P = pixels do canvas por pixel de arte), linha de opts.linha (2 ou 3) pixels de arte em pixels
 *     inteiros; retas na cor opts.piso, curvas e subidas na cor do tipo (GameData.BLOCK_TYPES); largada =
 *     quadrado claro com borda escura, chegada = xadrez com borda; opts.fundo pinta a caixa antes.
 *     opts.tercos = [{ from, to, cor }] (metros): faixa fina por baixo da linha (linha + 2, 1 pixel de arte
 *     para cada lado), na cor de cada trecho.
 *   RaceFx.drawMiniMap(ctx, path, posM, cores, me, box) -> [{ racer, x, y, tam, contorno }] (pixels de arte)
 *     Minimapa do HUD: os três terços das skills de tipo (TYPE_SKILLS.zone × D, Fogo, Grama, Água na ordem da
 *     pista) numa faixa fina na cor de cada tipo por baixo do traçado (linha 2) e um ponto por cavalo no metro
 *     posM[j] na cor cores[j] — 2×2 com borda escura (não some sobre a linha da mesma cor); o seu (me) 3×3 com
 *     contorno claro, por cima. box = { x, y, w, h, P, piso, fundo }. Marca _stats.minimapa e _stats.tercos.
 *   RaceFx.drawHoofDust(ctx, x, y, S, t, surface, reduced) -> nº de nuvenzinhas (0 fora de terra/areia):
 *     (x, y) = âncora rear do cavalo no chão; a nuvenzinha nasce atrás (x − 1 px de arte) e vai até x − 9,
 *     com o alfa cheio até a metade da vida; tom e alfa por piso (RaceFx.POEIRA), na areia com 1 px de
 *     borda mais escura. 3 por cavalo, 1 em reduced. A tela não chama na chuva.
 *
 *   RaceFx._stats = { dados, faixaDado, baloes, particulas, msQuadro, quadros, placas, faixaSkill, caixasBaloes, caixasCavalos,
 *                     natureza, ventoHud, minimapa, auras, tipoAuras, tercos }
 *     auras = auras de skill de tipo desenhadas no quadro (drawTypeAura; não entram em particulas);
 *     tipoAuras = [{ racer, element }] dessas auras (a tela anota); tercos = trechos pintados no minimapa (3).
 *     natureza = { pingos, respingos, relampago, raios, calor, nevoa, nevoaFrente, sombras, folhas, poeiraCascos }
 *     do quadro (não entra em particulas, que é só dos efeitos de skill e do Dado); ventoHud = 'texto' |
 *     'icone' | '' (o selo de vento que a tela desenhou no HUD); minimapa = true se o minimapa foi desenhado.
 *     faixaSkill = texto da faixa central desenhada no quadro ('' se não há); caixasBaloes = [{ racer,
 *     kind, tipo, texto, pilha, x, y, w, h, y0, y1 }] dos balões posicionados (tipo = skill de tipo; texto = o nome
 *     curto no balão de texto, '' nos compactos) (pixels de arte; y0..y1 = faixa vertical da
 *     raia) e caixasCavalos = [{ racer, x, y, w, h }] dos cavalos visíveis. A tela anota os três.
 *     Contadores do quadro atual (zerados por beginFrame) para o ui-test: dados desenhados, faixa
 *     visível, balões, partículas, e placas = [{ racer, numero, vencedor, fase }]
 *     (a tela anota o que desenhou). msQuadro = média do tempo de desenho dos últimos 60 quadros
 *     (endFrame(ms), medido pela tela com performance.now()); quadros = quadros medidos. msQuadro conta só o
 *     JavaScript do desenho (a rasterização do canvas vem depois e costuma custar mais): intervalo =
 *     { med, p95, n } dos intervalos reais entre os últimos 60 quadros (endFrame(ms, agora), agora = o
 *     relógio do requestAnimationFrame; pausas acima de 1 s ficam fora), calculado ao ler.
 *   RaceFx.beginFrame(), RaceFx.endFrame(ms, agora), RaceFx.resetStats(tudo) (tudo: também as médias).
 *
 * UMD: no browser vira window.RaceFx (carregar depois de sprites.js); no Node, module.exports.
 */
(function (root) {
  'use strict';

  // ===========================================================================
  // Constantes (segundos de apresentação; ver escala no topo)
  // ===========================================================================
  var DADO = {
    dur: 2.4,          // plaquinhas e faixa ficam até t0 + 2.4 (brilho do vencedor ~2 s reais)
    lento: 0.4,        // velocidade da corrida na câmera lenta
    janela: 0.8,       // câmera lenta em [t0, t0 + 0.8]
    janelaReduzida: 0.4,
    gira: 0.4,         // cubo girando em [t0, t0 + 0.4)
    regira: 0.64,      // quem teve desempate gira de novo até t0 + 0.64 (e aí o vencedor é revelado)
    pulso: 0.8         // período do brilho do vencedor (segundos reais)
  };
  var BALAO = {
    dur: 1.5,          // balão, faixa central do jogador e "CANSOU": t0 .. t0 + 1.5
    efeitoMin: 1.5,    // contorno/efeito da skill: [1.5, 7]
    efeitoMax: 7,
    garraFim: 0.6,     // a Garra segue até finishTime + 0.6
    sobe: 2            // pixels de arte que o balão sobe ao entrar
  };
  var EPS = 1e-6;
  var PLACA_H = 9, PONTA_H = 2, GAP = 1;
  var MARCA = '\u21bb', MARCA_W = 6;   // "↻" (glifo de 5 colunas na fonte do Sprites) + 1 de espaço

  // paleta (mesmos valores dos tokens de game.css)
  var COR = {
    tinta: '#1a1405', texto: '#f1e9d4', texto3: '#95a99b', painel: '#16271f', sombra: '#060d0a',
    ouro: '#f2c230', ouroClaro: '#ffe27a', ouroEscuro: '#9c7210', palha2: '#6f5526', faisca: '#fff6c8',
    ganho: '#7be07a', cinza: '#8f9893', cinzaClaro: '#c3cac6', fundoCinza: '#2b2f2d'
  };
  // cores dos elementos para o balão e o contorno (versões claras dos tokens do jogo)
  var ELEM = { fogo: '#ff8a4c', agua: '#62b8ff', grama: '#7ed65a', neutro: '#d6d0c0' };

  // ===========================================================================
  // Utilidades
  // ===========================================================================
  function hexRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    var A = hexRgb(a), B = hexRgb(b), o = '#';
    for (var i = 0; i < 3; i++) {
      var v = Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * t)));
      o += (v < 16 ? '0' : '') + v.toString(16);
    }
    return o;
  }
  function rgba(hex, a) { var v = hexRgb(hex); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a.toFixed(3) + ')'; }
  function lum(hex) { var v = hexRgb(hex); return (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) / 255; }
  function frac(x) { return x - Math.floor(x); }
  function mod(a, n) { return ((a % n) + n) % n; }
  function snap(v, P) { return Math.round(v / P) * P; }   // grade de pixels de arte
  // hash inteiro -> [0, 1) (o mesmo misturador do sprites.js): números "rolando" na faixa, vento e natureza
  function hash(n) {
    n = n | 0;
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  }
  // Sprites (fonte pixel): no browser, window.Sprites; no Node, carregado só se alguém pedir
  var spNode = null;
  function sp() {
    if (root && root.Sprites) return root.Sprites;
    if (!spNode && typeof module !== 'undefined' && module.exports) {
      try { spNode = require('./sprites.js'); } catch (e) { spNode = null; }
    }
    return spNode;
  }
  // largura em pixels de arte: dígitos têm sempre 3 colunas (+1 de espaço)
  function numW(s) { return Math.max(0, String(s).length * 4 - 1); }
  function textW(s) { var S = sp(); return S ? S.measureText(s, 1) : numW(s); }

  // ===========================================================================
  // Funções puras
  // ===========================================================================
  function copiaRolls(rolls) {
    var out = [];
    for (var i = 0; i < (rolls || []).length; i++) {
      var r = rolls[i];
      out.push({ racer: r.racer, dice: (r.dice || []).slice(), best: r.best, rerolls: r.rerolls | 0 });
    }
    return out;
  }

  // catálogo de skills: window.GameData no browser; data.js no Node (carregado só se alguém pedir)
  var gdNode = null;
  function gameData() {
    if (root && root.GameData) return root.GameData;
    if (!gdNode && typeof module !== 'undefined' && module.exports) {
      try { gdNode = require('./data.js'); } catch (e) { gdNode = null; }
    }
    return gdNode;
  }
  function skillsCatalogo() { var g = gameData(); return g ? g.SKILLS : {}; }

  // ---- skills ---------------------------------------------------------------------------------
  var ICON_ORDEM = [
    ['speedMult', 'vel'], ['accelMult', 'ace'], ['staminaRestore', 'folego'], ['drainMult', 'folego'],
    ['curveBonus', 'curva'], ['hillBonus', 'subida'], ['hillDrainMult', 'subida'], ['extraDice', 'dado'],
    ['weatherDouble', 'clima'], ['garraChanceBonus', 'garra'], ['garraBoostBonus', 'garra']
  ];
  function skillIcon(skill) {
    var ef = skill && skill.effect;
    if (!ef) return 'vel';
    for (var k = 0; k < ICON_ORDEM.length; k++) {
      var chave = ICON_ORDEM[k][0];
      if (ef[chave] == null) continue;
      if (chave === 'drainMult' && !(ef.drainMult < 1)) continue;   // gastar mais não é fôlego
      return ICON_ORDEM[k][1];
    }
    return 'vel';
  }

  var CURTO_MAX = 12;
  function nomeCurto(nome, short) {
    var n = String(nome || '').toUpperCase();
    if (n.length <= CURTO_MAX) return n;
    if (short) return String(short).toUpperCase();
    var ws = n.split(' '), out = '';
    for (var i = 0; i < ws.length; i++) {      // palavras inteiras; a última que sobra vira abreviatura com "."
      var tent = out ? out + ' ' + ws[i] : ws[i];
      if (tent.length <= CURTO_MAX) { out = tent; continue; }
      var sobra = CURTO_MAX - (out ? out.length + 1 : 0) - 1;
      if (sobra >= 2) out = (out ? out + ' ' : '') + ws[i].slice(0, sobra) + '.';
      break;
    }
    out = out.replace(/ \S{1,2}$/, '');          // não termina em "de", "da"…
    return out || n.slice(0, CURTO_MAX);
  }

  // a skill do evento: o texto é '<rótulo> ativou <Nome>!'; casa só esse trecho (o rótulo pode ter o nome
  // de outra skill, como um cavalo chamado "Sprint"). Em empate de trechos, a de nome mais longo.
  function acharSkill(horse, texto, catalogo) {
    var melhor = null, ids = (horse && horse.skills) || [];
    for (var k = 0; k < ids.length; k++) {
      var s = catalogo && catalogo[ids[k]];
      if (s && String(texto).indexOf(' ativou ' + s.name + '!') >= 0 && (!melhor || s.name.length > melhor.name.length)) melhor = s;
    }
    return melhor;
  }

  function blocoDe(blocks, pos) {
    for (var i = 0; i < (blocks || []).length; i++) if (pos < blocks[i].to) return blocks[i];
    return blocks && blocks.length ? blocks[blocks.length - 1] : null;
  }

  // duração (em segundos de simulação) do efeito real da skill; instantâneo ⇒ 0 (o mínimo vale)
  function duracaoSkill(sim, ev, sk) {
    var ef = (sk && sk.effect) || {};
    if (ef.durationS) return ef.durationS;
    var frames = sim && sim.frames, dt = (sim && sim.dt) || 0.1;
    if (!frames || !frames.length || (!ef.distanceM && !ef.blockScoped)) return 0;
    var i0 = Math.max(0, Math.min(frames.length - 1, Math.round(ev.t / dt)));
    var p0 = frames[i0].pos[ev.racer], alvo;
    if (ef.distanceM) alvo = p0 + ef.distanceM;
    else {
      var b = blocoDe(sim.conditions && sim.conditions.blocks, p0);
      alvo = b ? b.to : p0;
    }
    for (var f = i0; f < frames.length; f++) if (frames[f].pos[ev.racer] >= alvo) return frames[f].t - ev.t;
    var fim = sim.finishTimes && sim.finishTimes[ev.racer];
    return fim != null ? fim - ev.t : BALAO.efeitoMax;
  }

  // ---- skill de tipo ---------------------------------------------------------------------------
  var ICONE_TIPO = { fogo: 'chama', grama: 'folha', agua: 'onda' };
  // a skill de tipo de um corredor: o terço vem da simulação (racerInfo[i].typeSkill) e o nome curto e o
  // elemento, do catálogo (GameData.TYPE_SKILLS, achado pelo id; sem id conhecido, pelo elemento do cavalo)
  function tipoDoCorredor(sim, i, horse) {
    var info = sim && sim.racerInfo && sim.racerInfo[i] && sim.racerInfo[i].typeSkill;
    if (!info) return null;
    var g = gameData(), cat = (g && g.TYPE_SKILLS) || {}, el = null;
    for (var k in cat) if (Object.prototype.hasOwnProperty.call(cat, k) && cat[k].id === info.id) el = k;
    if (!el && horse && cat[horse.element]) el = horse.element;
    if (!el) return null;
    return { el: el, id: cat[el].id, name: info.name || cat[el].name, short: cat[el].short, from: info.from, to: info.to };
  }
  // fração percorrida do terço [from, to) no metro pos, ou null fora dele (ou sem skill de tipo)
  function typeZone(ts, pos) {
    if (!ts) return null;
    var a = ts.from, b = ts.to;
    if (typeof a !== 'number' || typeof b !== 'number' || !isFinite(a) || !isFinite(b) || !(b > a)) return null;
    if (typeof pos !== 'number' || !(pos >= a) || !(pos < b)) return null;
    return (pos - a) / (b - a);
  }

  function timeline(sim, racers, escala) {
    var e = escala > 0 ? escala : 1;
    var out = [];
    var evs = (sim && sim.events) || [];
    var catalogo = skillsCatalogo();
    for (var k = 0; k < evs.length; k++) {
      var ev = evs[k];
      if (ev.type === 'dado') {
        out.push({
          kind: 'dado', t0: ev.t, t1: ev.t + DADO.dur * e, racer: ev.winner, winner: ev.winner,
          rolls: copiaRolls(ev.rolls), changed: !!ev.changed, weather: ev.weather, escala: e
        });
      } else if (ev.type === 'skill' && ev.typeSkill) {
        // skill de tipo: sempre ativa no terço; o item é só o balão (e a faixa do jogador) da entrada. A aura
        // do terço inteiro é a drawTypeAura, que a tela chama pela posição (typeZone).
        var rT = racers && racers[ev.racer], hT = rT && rT.horse;
        var tp = tipoDoCorredor(sim, ev.racer, hT);
        if (!tp) continue;
        out.push({
          kind: 'skill', typeSkill: true, t0: ev.t, t1: ev.t + BALAO.efeitoMin * e, racer: ev.racer, skillId: tp.id,
          icon: ICONE_TIPO[tp.el] || 'vel', clima: '', element: tp.el, cavalo: (hT && hT.element) || tp.el,
          nome: tp.name, nomeCurto: nomeCurto(tp.name, tp.short), from: tp.from, to: tp.to,
          silks: (rT && rT.silks) || null, raia: ev.racer + 1, escala: e
        });
      } else if (ev.type === 'skill') {
        var r = racers && racers[ev.racer], horse = r && r.horse;
        var sk = acharSkill(horse, ev.text, catalogo);
        var dur = Math.max(BALAO.efeitoMin * e, Math.min(BALAO.efeitoMax * e, duracaoSkill(sim, ev, sk)));
        var trig = sk && sk.trigger && String(sk.trigger).indexOf('weather:') === 0 ? String(sk.trigger).slice(8) : '';
        out.push({
          kind: 'skill', t0: ev.t, t1: ev.t + dur, racer: ev.racer, skillId: sk ? sk.id : null, icon: skillIcon(sk), clima: trig,
          element: sk ? sk.element : (horse && horse.element) || 'neutro', cavalo: (horse && horse.element) || 'neutro',
          nome: sk ? sk.name : '', nomeCurto: nomeCurto(sk ? sk.name : '', sk && sk.short),
          silks: (r && r.silks) || null, raia: ev.racer + 1, escala: e
        });
      } else if (ev.type === 'garra') {
        var fim = sim.finishTimes && sim.finishTimes[ev.racer];
        out.push({
          kind: 'garra', t0: ev.t, t1: (fim != null ? fim : ev.t + BALAO.dur * e) + BALAO.garraFim, racer: ev.racer,
          icon: 'garra', element: (racers && racers[ev.racer] && racers[ev.racer].horse.element) || 'neutro',
          silks: (racers && racers[ev.racer] && racers[ev.racer].silks) || null, raia: ev.racer + 1, escala: e
        });
      } else if (ev.type === 'cansou') {
        out.push({ kind: 'cansou', t0: ev.t, t1: ev.t + BALAO.dur * e, racer: ev.racer,
          silks: (racers && racers[ev.racer] && racers[ev.racer].silks) || null, raia: ev.racer + 1, escala: e });
      }
    }
    // ordem por t0, estável (o sort do motor nem sempre é)
    var idx = out.map(function (it, q) { return q; });
    idx.sort(function (a, b) { return (out[a].t0 - out[b].t0) || (a - b); });
    return idx.map(function (q) { return out[q]; });
  }

  function slowFactor(tl, simT, reduced) {
    if (!tl) return 1;
    for (var k = 0; k < tl.length; k++) {
      var it = tl[k];
      if (it.kind !== 'dado') continue;
      var e = it.escala || 1, j = (reduced ? DADO.janelaReduzida : DADO.janela) * e;
      if (simT >= it.t0 - EPS && simT - it.t0 <= j + EPS) return DADO.lento;
    }
    return 1;
  }

  // segundos reais (em x1) desde t0, descontando a câmera lenta
  function tempoReal(d, reduced) {
    var j = reduced ? DADO.janelaReduzida : DADO.janela;
    if (d <= j) return d / DADO.lento;
    return j / DADO.lento + (d - j);
  }

  function diceState(item, simT, reduced, racer) {
    var red = !!reduced;
    var e = item.escala || 1, d = (simT - item.t0) / e;
    var j = racer == null ? item.racer : racer;
    if (d < -EPS || simT >= item.t1 - EPS * e) return { fase: 'fim', brilho: 0, dourado: false, tempo: 0, reduced: red };
    var roll = item.rolls && item.rolls[j];
    var desempate = !!(roll && roll.rerolls > 0);
    var fase;
    if (red) fase = 'mostra';
    else if (d < DADO.gira - EPS) fase = 'gira';
    else if (desempate && d < DADO.regira - EPS) fase = 'regira';
    else fase = 'mostra';
    var tempo = tempoReal(Math.max(0, d), red);
    var brilho = 0, dourado = false;
    if (j === item.winner) {
      if (red) { brilho = 1; dourado = true; }
      else if (d >= DADO.regira - EPS) {
        dourado = true;
        var r0 = tempoReal(DADO.regira, false);
        brilho = 0.5 + 0.5 * Math.cos(2 * Math.PI * (tempo - r0) / DADO.pulso);
        brilho = Math.max(0, Math.min(1, brilho));
      }
    }
    return { fase: fase, brilho: brilho, dourado: dourado, tempo: tempo, reduced: red };
  }

  function diceLabels(roll) {
    var dice = (roll && roll.dice) || [], best = roll ? roll.best : 0, outros = [], tirou = false;
    for (var i = 0; i < dice.length; i++) {
      if (!tirou && dice[i] === best) { tirou = true; continue; }
      outros.push(String(dice[i]));
    }
    return { marca: roll && roll.rerolls > 0 ? MARCA : '', best: String(best), outros: outros };
  }

  // [borda 1][2][↻ 5 + 1 se desempate][best][2]  e, com outros dados: [traço 1][2][o1][2][o2]…[2]  [borda 1]
  function badgeSize(roll) {
    var L = diceLabels(roll), w = numW(L.best) + 6 + (L.marca ? MARCA_W : 0);
    if (L.outros.length) {
      w += 5;
      for (var i = 0; i < L.outros.length; i++) w += numW(L.outros[i]) + (i ? 2 : 0);
    }
    return { w: w, h: PLACA_H + PONTA_H };
  }

  function stripOrder(item) {
    var rolls = item.rolls || [], idx = [];
    for (var i = 0; i < rolls.length; i++) idx.push(i);
    idx.sort(function (a, b) {
      return ((b === item.winner) - (a === item.winner)) || ((rolls[b].rerolls | 0) - (rolls[a].rerolls | 0)) ||
        (rolls[b].best - rolls[a].best) || (a - b);
    });
    return idx;
  }

  // largura de uma entrada da faixa: chip 5 + espaço do número (fixo: os números rolando cabem)
  function slotW(roll) { return (roll && roll.best >= 100 ? 11 : 7) + 2 + (roll && roll.rerolls > 0 ? MARCA_W : 0); }
  function entradaW(roll) { return 5 + slotW(roll); }
  var ROTULO = 'DADO DA SORTE', GAP_E = 2;

  function stripLayout(item, racers, lay) {
    var rolls = item.rolls || [], A = lay.artW;
    var lab = textW(ROTULO), ent = 0;
    for (var i = 0; i < rolls.length; i++) ent += entradaW(rolls[i]) + (i ? GAP_E : 0);
    var y = lay.compact ? lay.hudH + 3 : lay.hudH + 12;   // fora do selo de CURVA/SUBIDA do HUD largo
    var uma = 2 + lab + 4 + ent + 2, L;
    if (uma <= A - 4) {
      var x1 = Math.max(1, Math.round((A - uma) / 2));
      L = { x: x1, y: y, w: uma, h: 7, linhas: 1, rotulo: { x: x1 + 2, y: y + 1 }, entradas: { x: x1 + 2 + lab + 4, y: y } };
    } else {
      var w = Math.min(A - 2, Math.max(lab, ent) + 4), x2 = Math.max(1, Math.round((A - w) / 2));
      L = { x: x2, y: y, w: w, h: 15, linhas: 2, rotulo: { x: x2 + Math.round((w - lab) / 2), y: y + 1 },
        entradas: { x: x2 + Math.max(2, Math.round((w - ent) / 2)), y: y + 8 } };
    }
    L.largura = ent;
    return L;
  }

  function sobrepoe(a, b) {
    return a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;
  }

  function layoutBadges(rects, W, H, fixos) {
    var out = [], i, k;
    for (i = 0; i < rects.length; i++) {
      var c = {}, src = rects[i];
      for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) c[k] = src[k];
      c.x = Math.max(0, Math.min(W - c.w, c.x));
      c.y = Math.max(0, Math.min(H - c.h, c.y));
      out.push(c);
    }
    var ordem = out.map(function (r, q) { return q; });
    ordem.sort(function (a, b) { return (out[a].y - out[b].y) || (out[a].x - out[b].x) || (a - b); });
    var postos = [];
    for (i = 0; fixos && i < fixos.length; i++) {
      var f = fixos[i];
      if (f && f.w > 0 && f.h > 0) postos.push({ x: f.x, y: f.y, w: f.w, h: f.h });
    }
    function livre(x, y, w, h) {
      if (x < 0 || y < 0 || x + w > W || y + h > H) return false;
      var cand = { x: x, y: y, w: w, h: h };
      for (var p = 0; p < postos.length; p++) if (sobrepoe(cand, postos[p])) return false;
      return true;
    }
    for (var o = 0; o < ordem.length; o++) {
      var r = out[ordem[o]], y0 = r.y, x0 = r.x;
      if (!livre(r.x, r.y, r.w, r.h)) {
        // alturas candidatas: logo acima / logo abaixo de cada já colocado, e as bordas
        var ys = [0, H - r.h], xs = [x0], p;
        for (p = 0; p < postos.length; p++) {
          ys.push(postos[p].y - r.h - GAP, postos[p].y + postos[p].h + GAP);
          xs.push(postos[p].x - r.w - GAP, postos[p].x + postos[p].w + GAP);
        }
        var melhor = null;
        // 1) só na vertical
        for (p = 0; p < ys.length; p++) {
          if (!livre(x0, ys[p], r.w, r.h)) continue;
          var dy = Math.abs(ys[p] - y0);
          if (!melhor || dy < melhor.custo || (dy === melhor.custo && ys[p] < melhor.y)) melhor = { x: x0, y: ys[p], custo: dy };
        }
        // 2) sem altura para empilhar: também para o lado (deslocar na horizontal custa o dobro)
        if (!melhor) {
          ys.push(y0);
          for (var a = 0; a < xs.length; a++) for (p = 0; p < ys.length; p++) {
            var xx = Math.max(0, Math.min(W - r.w, xs[a]));
            if (!livre(xx, ys[p], r.w, r.h)) continue;
            var custo = 2 * Math.abs(xx - x0) + Math.abs(ys[p] - y0);
            if (!melhor || custo < melhor.custo) melhor = { x: xx, y: ys[p], custo: custo };
          }
        }
        if (melhor) { r.x = melhor.x; r.y = melhor.y; }
      }
      postos.push(r);
    }
    return out;
  }

  // ---- vento (só visual) -----------------------------------------------------------------------
  // Hash próprio da seed, com sal fixo: não chama nenhum fluxo de números da simulação (RaceSim).
  var SAL_VENTO = 0x5f1e7a, SAL_DIRECAO = 0x51ed270b, SAL_NATUREZA = 0x3a7e11;
  var VENTOS = ['calmo', 'brisa', 'ventania'];
  // por intensidade: inclinação da chuva (dx por dy), fator de velocidade de nuvens e névoa, velocidade
  // das folhas (pixels de arte por segundo)
  var VENTO = {
    calmo:    { chuva: 0.12, nuvem: 0.5, folha: 0 },
    brisa:    { chuva: 0.35, nuvem: 1, folha: 22 },
    ventania: { chuva: 0.75, nuvem: 2.2, folha: 52 }
  };
  function wind(seed) {
    var s = Number(seed), u = isFinite(s) ? s >>> 0 : 0;
    var a = hash(u ^ SAL_VENTO), b = hash(Math.imul(u, 0x2c1b3c6d) ^ SAL_DIRECAO);
    return { intensity: a < 0.35 ? 'calmo' : a < 0.75 ? 'brisa' : 'ventania', dir: b < 0.5 ? 1 : -1 };
  }
  // vento válido (padrão: calmo, para a direita)
  function ventoOk(w) {
    return { intensity: w && VENTOS.indexOf(w.intensity) >= 0 ? w.intensity : 'calmo', dir: w && w.dir < 0 ? -1 : 1 };
  }
  function rainSlant(w) { var v = ventoOk(w); return VENTO[v.intensity].chuva * v.dir; }

  // ---- traçado de cima e curvas na pista (só visual) ----------------------------------------------
  // CURVA.arco: pixels de arte que a cerca e as raias sobem no meio de uma curva (pista lateral);
  // CURVA.arquibancada: quanto a arquibancada sobe no mesmo ponto; CURVA.rampa: metros da entrada (e da
  // saída) até o arco inteiro numa curva longa. giro*: graus por curva (traçado).
  var CURVA = { arco: 6, arquibancada: 10, rampa: 120, giroPor150m: 90, giroMin: 45, giroMax: 180, passoM: 10 };
  function giroCurva(len) { return Math.max(CURVA.giroMin, Math.min(CURVA.giroMax, len / 150 * CURVA.giroPor150m)); }

  // Sequências de curva para o DESENHO: junta os intervalos [a, b] em que a é o b do anterior (|Δ| < EPS).
  // A simulação continua por bloco (cond.curves); o mapa, a pista lateral e as placas usam as sequências.
  function curveRuns(curves) {
    var out = [];
    if (!curves) return out;
    for (var i = 0; i < curves.length; i++) {
      var a = curves[i][0], b = curves[i][1], u = out[out.length - 1];
      if (u && Math.abs(a - u[1]) < EPS) u[1] = b;
      else out.push([a, b]);
    }
    return out;
  }

  // Caminho visto de cima, em metros e em coordenadas de tela (x para a direita, y para baixo): rumo
  // inicial 0° (para a direita); reta e subida seguem em linha reta; cada SEQUÊNCIA de blocos 'curva'
  // colados (como curveRuns) gira no sentido anti-horário (na tela) giroCurva(comprimento da sequência)
  // graus, distribuídos por metro: cada passo de comprimento d gira g·d/L (meio giro antes e meio depois do
  // passo, então os pontos das pontas giram meio passo). Um ponto a cada ~10 m (cada bloco em passos
  // iguais, as pontas dos blocos sempre são pontos); segs continua um por bloco.
  function trackPath(blocks) {
    var lista = blocks || [];
    // 1ª passada: a sequência de curvas de cada bloco 'curva' (comprimento total) e o giro total
    var seqDe = [], atual = null, fimAnt = 0, giro = 0, i, b, a, len;
    for (i = 0; i < lista.length; i++) {
      b = lista[i]; a = b.from != null ? b.from : fimAnt; len = b.to - a;
      seqDe.push(null);
      if (!(len > 0)) continue;
      if (b.type === 'curva') {
        if (!(atual && Math.abs(a - atual.fim) < EPS)) { if (atual) giro += giroCurva(atual.len); atual = { len: 0, fim: a }; }
        atual.len += len; atual.fim = b.to; seqDe[i] = atual;
      } else if (atual) { giro += giroCurva(atual.len); atual = null; }
      fimAnt = b.to;
    }
    if (atual) giro += giroCurva(atual.len);
    var pts = [[0, 0]], ms = [0], segs = [], th = 0, x = 0, y = 0, fim = 0;
    for (i = 0; i < lista.length; i++) {
      b = lista[i]; a = b.from != null ? b.from : fim; len = b.to - a;
      if (!(len > 0)) continue;
      var passos = Math.max(1, Math.round(len / CURVA.passoM)), d = len / passos;
      var sq = seqDe[i], g = sq ? giroCurva(sq.len) * len / sq.len : 0, gp = g / passos, i0 = pts.length - 1;
      for (var k = 0; k < passos; k++) {
        th += gp / 2;
        var r = th * Math.PI / 180;
        x += Math.cos(r) * d; y -= Math.sin(r) * d;
        th += gp / 2;
        pts.push([x, y]); ms.push(k === passos - 1 ? b.to : a + d * (k + 1));
      }
      fim = b.to;
      segs.push({ type: b.type, i0: i0, i1: pts.length - 1 });
    }
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var q = 0; q < pts.length; q++) {
      x0 = Math.min(x0, pts[q][0]); x1 = Math.max(x1, pts[q][0]);
      y0 = Math.min(y0, pts[q][1]); y1 = Math.max(y1, pts[q][1]);
    }
    return { pts: pts, ms: ms, giroTotal: giro, segs: segs, distance: fim, bbox: { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0 } };
  }

  // ponto [x, y] do traçado no metro m (interpolado entre os pontos; preso entre a largada e a chegada)
  function pathAt(path, m) {
    var pts = path.pts, ms = path.ms, n = pts.length;
    if (!(m > ms[0])) return pts[0].slice();
    if (m >= ms[n - 1]) return pts[n - 1].slice();
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var md = (lo + hi) >> 1; if (ms[md] <= m) lo = md; else hi = md; }
    var u = (m - ms[lo]) / (ms[hi] - ms[lo]);
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * u, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * u];
  }

  // deslocamento vertical (pixels de arte, negativo = para cima) da cerca, das raias e dos cavalos no
  // metro m, por SEQUÊNCIA de curva [a, b] (intervalos colados da lista, em ordem, contam como um só, como
  // curveRuns): −6·sen(π/2 · min(1, (m − a)/R, (b − m)/R)), R = min((b − a)/2, CURVA.rampa) — igual a
  // −6·sen(π·u) até 240 m; numa curva longa o arco fica inteiro no meio (platô). 0 fora e nas pontas.
  function curveOffset(curves, m) {
    if (!curves) return 0;
    for (var i = 0; i < curves.length; i++) {
      var a = curves[i][0], b = curves[i][1];
      if (!(m >= a && m <= b)) continue;
      var j = i;
      while (i > 0 && Math.abs(curves[i - 1][1] - a) < EPS) { i--; a = curves[i][0]; }
      while (j + 1 < curves.length && Math.abs(curves[j + 1][0] - b) < EPS) { j++; b = curves[j][1]; }
      if (!(m > a && m < b)) return 0;
      var R = Math.min((b - a) / 2, CURVA.rampa);
      return -CURVA.arco * Math.sin(Math.PI / 2 * Math.min(1, (m - a) / R, (b - m) / R));
    }
    return 0;
  }

  // ===========================================================================
  // Estatísticas do quadro (ui-test e teste de desempenho)
  // ===========================================================================
  // natureza: contadores do quadro (drawNature, drawFogFront, drawHoofDust); NÃO entram em particulas
  // (que conta só os efeitos de skill e do Dado: o ui-test de movimento reduzido exige particulas = 0)
  function novaNatureza() {
    return { pingos: 0, respingos: 0, relampago: 0, raios: 0, calor: 0, nevoa: 0, nevoaFrente: 0, sombras: 0, folhas: 0, poeiraCascos: 0 };
  }
  var stats = { dados: 0, faixaDado: false, baloes: 0, particulas: 0, msQuadro: 0, quadros: 0, placas: [], faixaSkill: '', caixasBaloes: [], caixasCavalos: [],
    natureza: novaNatureza(), ventoHud: '', minimapa: false, auras: 0, tipoAuras: [], tercos: 0 };
  var JANELA_MS = 60, amostras = [], somaMs = 0, intervalos = [], ultimoQuadro = null;
  // intervalo real entre quadros (mediana e p95 da janela), calculado só quando alguém lê
  Object.defineProperty(stats, 'intervalo', { enumerable: true, get: function () {
    if (!intervalos.length) return { med: 0, p95: 0, n: 0 };
    var v = intervalos.slice().sort(function (a, b) { return a - b; }), n = v.length;
    return { med: v[Math.floor(n * 0.5)], p95: v[Math.min(n - 1, Math.floor(n * 0.95))], n: n };
  } });
  function beginFrame() {
    stats.dados = 0; stats.faixaDado = false; stats.baloes = 0; stats.particulas = 0; stats.placas = []; stats.faixaSkill = ''; stats.caixasBaloes = []; stats.caixasCavalos = [];
    stats.natureza = novaNatureza(); stats.ventoHud = ''; stats.minimapa = false; stats.auras = 0; stats.tipoAuras = []; stats.tercos = 0;
  }
  function endFrame(ms, agora) {
    if (agora != null && isFinite(agora)) {
      if (ultimoQuadro != null && agora > ultimoQuadro && agora - ultimoQuadro <= 1000) {
        intervalos.push(agora - ultimoQuadro);
        if (intervalos.length > JANELA_MS) intervalos.shift();
      }
      ultimoQuadro = agora;
    }
    if (!(ms >= 0) || !isFinite(ms)) return;
    amostras.push(ms); somaMs += ms;
    if (amostras.length > JANELA_MS) somaMs -= amostras.shift();
    stats.msQuadro = somaMs / amostras.length;
    stats.quadros++;
  }
  function resetStats(tudo) {
    beginFrame();
    if (tudo) { amostras = []; somaMs = 0; stats.msQuadro = 0; stats.quadros = 0; intervalos = []; ultimoQuadro = null; }
  }

  // ===========================================================================
  // Desenho
  // ===========================================================================
  // Dado de 9×9 em 4 quadros (frente, quina, outra face, quina ao contrário).
  // o contorno · w face clara · h luz · s face na sombra · d base · p pinta · r pinta vermelha
  var CUBO_COR = { o: COR.tinta, w: '#fbf4e2', h: '#ffffff', s: '#cdbf9f', d: '#9b8a6a', p: '#24122e', r: '#d8353b' };
  var CUBO = [
    ['.ooooooo.', 'ohhhhhhho', 'owpwwwpwo', 'owwwwwwwo', 'owwwpwwwo', 'owwwwwwwo', 'owpwwwpwo', 'ossssssso', '.ooooooo.'],
    ['..ooooo..', '.owwwsso.', '.owpwsso.', '.owwwspo.', '.owwwsso.', '.owwwpso.', '.owwwsso.', '.odddddo.', '..ooooo..'],
    ['.ooooooo.', 'ohhhhhhho', 'owwwwwpwo', 'owwwwwwwo', 'owwwrwwwo', 'owwwwwwwo', 'owpwwwwwo', 'ossssssso', '.ooooooo.'],
    ['..ooooo..', '.osswwwo.', '.osswwwo.', '.opswrwo.', '.osswwwo.', '.osswwwo.', '.osswwwo.', '.odddddo.', '..ooooo..']
  ];

  // volatil: números que trocam a cada quadro (o Dado girando), fora do cache de texto do Sprites
  function texto(ctx, s, x, y, S, color, volatil) {
    var SP = sp();
    if (SP) SP.drawText(ctx, s, x, y, { scale: S, color: color, volatil: volatil });
  }

  function drawDice(ctx, x, y, S, roll, estado, isWinner, simT, cor) {
    if (!roll || !estado || estado.fase === 'fim') return '';
    var w = badgeSize(roll).w;
    var tempo = estado.tempo != null ? estado.tempo : (simT || 0);
    function R(dx, dy, ww, hh, col) { ctx.fillStyle = col; ctx.fillRect(x + dx * S, y + dy * S, ww * S, hh * S); }
    stats.dados++;

    if (estado.fase === 'gira' || estado.fase === 'regira') {
      var q = Math.floor(Math.max(0, tempo) * 14) % 4;
      var pulo = Math.round(Math.abs(Math.sin(tempo * Math.PI * 3)) * (estado.fase === 'regira' ? 3 : 2));
      var cx = Math.floor((w - 9) / 2), mapa = CUBO[q];
      R(cx + 2, 9, 5, 1, 'rgba(0,0,0,0.35)');   // sombra no chão
      for (var ry = 0; ry < 9; ry++) for (var rx = 0; rx < 9; rx++) {
        var ch = mapa[ry].charAt(rx);
        if (ch !== '.') R(cx + rx, ry - pulo, 1, 1, CUBO_COR[ch]);
      }
      return '';
    }

    var L = diceLabels(roll);
    var ouro = !!isWinner && (estado.dourado == null ? true : !!estado.dourado);
    var b = ouro ? (estado.brilho != null ? estado.brilho : 1) : 0;
    var borda = ouro ? COR.ouroEscuro : (cor || COR.texto);
    var fundo = ouro ? mix(COR.ouro, COR.ouroClaro, b) : COR.painel;
    var tBest = ouro ? COR.tinta : COR.texto, tOutros = ouro ? COR.palha2 : COR.texto3;
    if (ouro) R(-1, -1, w + 2, PLACA_H + 2, rgba(COR.ouroClaro, 0.3 + 0.55 * b));   // halo
    R(0, 0, w, PLACA_H, borda);
    R(1, 1, w - 2, PLACA_H - 2, fundo);
    var bx = 3;
    if (L.marca) {
      texto(ctx, L.marca, x + bx * S, y + 2 * S, S, ouro ? COR.palha2 : COR.ouroClaro);
      bx += MARCA_W;
    }
    texto(ctx, L.best, x + bx * S, y + 2 * S, S, tBest, true);
    if (L.outros.length) {
      var sx = bx + numW(L.best) + 2;
      R(sx, 1, 1, PLACA_H - 2, borda);
      var ox = sx + 3;
      for (var i = 0; i < L.outros.length; i++) {
        texto(ctx, L.outros[i], x + ox * S, y + 2 * S, S, tOutros, true);
        ox += numW(L.outros[i]) + 2;
      }
    }
    // pontinha para o cavalo
    var mx = Math.floor(w / 2);
    R(mx - 1, PLACA_H, 3, 1, borda);
    R(mx, PLACA_H + 1, 1, 1, borda);
    // faíscas do vencedor (posição = função do tempo e do índice)
    if (ouro && !estado.reduced) {
      var ccx = w / 2, ccy = PLACA_H / 2, rxx = w / 2 + 3, ryy = PLACA_H / 2 + 3;
      for (var k = 0; k < 6; k++) {
        var ph = frac(tempo * 1.8 + k * 0.41);
        if (ph >= 0.7) continue;
        var ang = k * Math.PI / 3 + tempo * 1.4;
        var px = Math.round(ccx + Math.cos(ang) * rxx), py = Math.round(ccy + Math.sin(ang) * ryy);
        if (ph < 0.25) {
          R(px - 1, py, 3, 1, COR.faisca); R(px, py - 1, 1, 3, COR.faisca); R(px, py, 1, 1, '#ffffff');
        } else {
          R(px, py, 1, 1, COR.faisca);
        }
        stats.particulas++;
      }
    }
    return L.best;
  }

  function drawDiceStrip(ctx, item, racers, lay, S, simT, reduced) {
    if (!item || !lay) return null;
    var st = diceState(item, simT, reduced, item.winner);
    if (st.fase === 'fim') return null;
    var L = stripLayout(item, racers, lay);
    var e = item.escala || 1, d = (simT - item.t0) / e;
    var revelado = !!reduced || d >= DADO.regira - EPS;
    function R(ax, ay, w, h, col) { ctx.fillStyle = col; ctx.fillRect(ax * S, ay * S, w * S, h * S); }
    R(L.x - 1, L.y - 1, L.w + 2, L.h + 2, COR.ouro);
    R(L.x, L.y, L.w, L.h, COR.sombra);
    texto(ctx, ROTULO, L.rotulo.x * S, L.rotulo.y * S, S, COR.ouro);
    // dado em PNG logo à esquerda da faixa (fora da caixa: o layout não muda); sem espaço ou sem imagem, nada
    if (L.x >= 10) drawIconPng(ctx, 'ui-dado', (L.x - 10) * S, L.y * S, 8, S);
    var ordem = revelado ? stripOrder(item) : item.rolls.map(function (r, q) { return q; });
    var ex = L.entradas.x, ey = L.entradas.y;
    for (var k = 0; k < ordem.length; k++) {
      var j = ordem[k], roll = item.rolls[j], r = racers && racers[j];
      var silk = (r && r.silks) || COR.texto3;
      R(ex, ey, 5, 7, silk);
      texto(ctx, String(j + 1), (ex + 1) * S, (ey + 1) * S, S, lum(silk) > 0.5 ? COR.tinta : COR.texto);
      var sw = slotW(roll), nx = ex + 5;
      var est = diceState(item, simT, reduced, j);
      var num, cor;
      if (est.fase === 'gira' || est.fase === 'regira') {
        // número "rolando": hash do corredor e do quadro do giro (10..99, cabe no espaço)
        num = String(10 + Math.floor(hash(j * 7919 + Math.floor(est.tempo * 14) * 131 + 17) * 90));
        cor = COR.texto3;
      } else {
        num = String(roll.best);
        cor = r && r.isPlayer ? COR.ouro : COR.texto;
        if (j === item.winner && est.dourado) {
          R(nx, ey, sw, 7, mix(COR.ouro, COR.ouroClaro, est.brilho));
          cor = COR.tinta;
        }
      }
      var marca = est.fase === 'mostra' && roll.rerolls > 0;
      var tx = nx + Math.round((sw - numW(num) - (marca ? MARCA_W : 0)) / 2);
      if (marca) {
        texto(ctx, MARCA, tx * S, (ey + 1) * S, S, cor === COR.tinta ? COR.palha2 : COR.ouroClaro);
        tx += MARCA_W;
      }
      texto(ctx, num, tx * S, (ey + 1) * S, S, cor, true);
      ex += entradaW(roll) + GAP_E;
    }
    stats.faixaDado = true;
    return L;
  }

  // ---------------------------------------------------------------------------
  // Skills: ícones de 8×8 por código (no estilo dos ícones de status do jogo: # = pixel aceso)
  // ---------------------------------------------------------------------------
  var ICONES = {
    vel:    ['........', '#...#...', '.#...#..', '..#...#.', '..#...#.', '.#...#..', '#...#...', '........'],
    ace:    ['....##..', '...##...', '..##....', '.######.', '....##..', '...##...', '..##....', '.#......'],
    folego: ['........', '.##.##..', '#######.', '#######.', '.#####..', '..###...', '...#....', '........'],
    curva:  ['..####..', '.#....#.', '......#.', '....#.#.', '...###..', '....#...', '........', '........'],
    subida: ['........', '...##...', '..####..', '..#.##..', '.#..###.', '.#.#####', '########', '........'],
    dado:   ['.######.', '#......#', '#.#..#.#', '#......#', '#..##..#', '#......#', '#.#..#.#', '.######.'],
    clima:  ['..#..#..', '#..##..#', '.######.', '.######.', '#.####.#', '..####..', '.#....#.', '........'],
    garra:  ['...#..#.', '..#..#..', '..#..#.#', '.#..#..#', '.#..#.#.', '#..#..#.', '#..#.#..', '........'],
    sol:    ['#..#..#.', '.#.##.#.', '..####..', '#.####.#', '#.####.#', '..####..', '.#.##.#.', '#..#..#.'],
    nevoa:  ['........', '.##.##..', '#######.', '........', '.######.', '........', '######..', '........'],
    gota:   ['...#....', '...#....', '..###...', '.#####..', '.#####..', '.#####..', '..###...', '........'],
    // skills de tipo: chama (Labareda), folha (Raízes Firmes), onda (Maré Alta)
    chama:  ['...#....', '..##....', '..###.#.', '.####.#.', '.######.', '########', '.######.', '..####..'],
    folha:  ['.....###', '...#####', '..######', '.######.', '.####.#.', '.##.##..', '.#.#....', '#.......'],
    onda:   ['........', '..###...', '.#...#..', '#..#..#.', '..###..#', '.......#', '##..##..', '..##..##']
  };
  function desenhaIcone(ctx, nome, x, y, S, cor) {
    var rows = ICONES[nome] || ICONES.vel;
    ctx.fillStyle = cor;
    for (var ry = 0; ry < 8; ry++) {
      var rx = 0, linha = rows[ry];
      while (rx < 8) {
        if (linha.charAt(rx) !== '#') { rx++; continue; }
        var r0 = rx;
        while (rx < 8 && linha.charAt(rx) === '#') rx++;
        ctx.fillRect(x + r0 * S, y + ry * S, (rx - r0) * S, S);
      }
    }
  }

  // cor do elemento para desenhar: skill geral (ou elemento sem cor) usa o elemento do cavalo
  function corElemento(item) {
    var el = item.element;
    if (el === 'geral' || !ELEM[el]) el = item.cavalo && ELEM[item.cavalo] ? item.cavalo : 'neutro';
    return ELEM[el] || ELEM.neutro;
  }
  function textoBalao(item) {
    if (item.kind === 'garra') return 'GARRA!';
    if (item.kind === 'cansou') return 'CANSOU';
    return item.nomeCurto || nomeCurto(item.nome);
  }
  // Balão preso à raia do cavalo: à frente do focinho, com chip do número e borda na cor da seda.
  // Altura 11 (cabe duas vezes na raia de 26 px); pilha > 0 vira só o chip + ícone (cresce para a frente).
  var BAL_H = 11, BAL_ICONE_X = 9;
  function iconeDe(item) {
    if (item.kind === 'cansou') return 'gota';
    if (item.icon === 'clima') return item.clima === 'chuva' ? 'gota' : item.clima === 'nevoa' ? 'nevoa' : 'sol';
    return item.icon || 'vel';
  }
  // Ícones PNG (window.__ICONES carregados em Image pelo game.js): cache { nome: imagem }
  var iconImgs = {};
  function setIconImages(mapa) { iconImgs = {}; if (mapa) for (var k in mapa) if (Object.prototype.hasOwnProperty.call(mapa, k) && mapa[k]) iconImgs[k] = mapa[k]; }
  function iconImage(nome) { return nome && Object.prototype.hasOwnProperty.call(iconImgs, nome) ? iconImgs[nome] : null; }
  function iconNameOf(item) {
    if (!item) return null;
    return item.typeSkill ? 'sk-tipo-' + item.element : item.skillId ? 'sk-' + item.skillId : item.clima ? 'cl-' + item.clima : null;
  }
  function drawIconPng(ctx, nome, x, y, lado, S) {
    var img = iconImage(nome);
    if (!img || !(lado * S >= 16) || !ctx.drawImage) return false;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, lado * S, lado * S);
    return true;
  }
  function skillBannerLayout(texto, artW, S, temImg, textW) {
    function medida(fs, comIcone) {
      var skW = comIcone ? 8 * fs + 2 : 0;
      return { fs: fs, icone: comIcone, skW: skW, w: textW(texto, fs) + 8 + skW };
    }
    function icoOk(fs) { return !!temImg && 8 * fs * S >= 16; }
    var m = medida(2, icoOk(2));
    if (m.w > artW - 6) {
      // sem ícone vale a regra de sempre (tw(texto, 2) + 8 <= artW - 6); com ícone ele entra na conta
      m = medida(1, icoOk(1));
      if (m.w > artW - 6 && m.icone) m = medida(1, false);
    }
    var fs = m.fs, h = Math.max(5 * fs + 6, m.icone ? 8 * fs + 2 : 0), x = Math.round(artW / 2 - m.w / 2);
    return {
      fs: fs, icone: m.icone, x: x, w: m.w, h: h,
      iconX: x + 4, iconDy: Math.floor((h - 8 * fs) / 2),
      textX: Math.round(artW / 2) + Math.round(m.skW / 2), textDy: Math.floor((h - 5 * fs) / 2)
    };
  }
  function balloonSize(item, pilha) {
    if (pilha > 0) return { w: BAL_ICONE_X + 8 + 2, h: BAL_H };
    return { w: BAL_ICONE_X + 8 + 2 + textW(textoBalao(item)) + 3, h: BAL_H };
  }

  // (x, y) = canto do corpo do balão em px do canvas; a pontinha (1..2 px à esquerda) aponta para o cavalo
  function drawBalloon(ctx, x, y, S, item, simT, pilha) {
    if (!item) return false;
    var e = item.escala || 1, dur = BALAO.dur * e, age = simT - item.t0;
    if (age < -EPS || age >= dur - EPS * e) return false;
    var d = age / e;                                   // segundos reais em x1
    var sz = balloonSize(item, pilha), w = sz.w;
    var alpha = d > BALAO.dur - 0.4 ? Math.max(0, (BALAO.dur - d) / 0.4) : 1;
    if (pilha > 0) alpha *= 0.9;
    var sobe = Math.round(Math.min(1, d / 0.4) * BALAO.sobe);
    var y0 = y + (BALAO.sobe - sobe) * S;              // entra 2 px mais baixo e sobe até o lugar
    var cansou = item.kind === 'cansou', garra = item.kind === 'garra';
    var seda = item.silks || COR.texto3;
    var cor = cansou ? COR.cinza : garra ? COR.ouro : corElemento(item);
    var fundo = cansou ? COR.fundoCinza : COR.painel;
    var txt = cansou ? COR.cinzaClaro : mix(cor, '#ffffff', 0.35);
    var prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;
    function R(dx, dy, ww, hh, col) { ctx.fillStyle = col; ctx.fillRect(x + dx * S, y0 + dy * S, ww * S, hh * S); }
    R(-1, -1, w + 2, BAL_H + 2, COR.sombra);            // contorno escuro por fora da seda
    R(0, 0, w, BAL_H, seda);
    R(1, 1, w - 2, BAL_H - 2, fundo);
    R(1, 1, 7, BAL_H - 2, seda);                        // chip com o número da raia
    texto(ctx, String(item.raia || ''), x + (item.raia > 9 ? 1 : 3) * S, y0 + 3 * S, S, lum(seda) > 0.5 ? COR.tinta : COR.texto);
    if (!drawIconPng(ctx, iconNameOf(item), x + BAL_ICONE_X * S, y0 + 1 * S, 8, S)) desenhaIcone(ctx, iconeDe(item), x + BAL_ICONE_X * S, y0 + 1 * S, S, txt);
    if (!pilha) texto(ctx, textoBalao(item), x + (BAL_ICONE_X + 10) * S, y0 + 3 * S, S, txt);
    if (!pilha) {                                      // pontinha para o cavalo (na cor da seda)
      R(-3, 4, 3, 3, COR.sombra); R(-2, 4, 2, 3, seda); R(-1, 3, 1, 5, seda); R(-2, 5, 1, 1, seda);
    }
    ctx.globalAlpha = prev;
    stats.baloes++;
    return true;
  }

  // Brilho do contorno da silhueta: { cor, alpha } enquanto a skill/Garra dura, senão null. Quem desenha
  // é a tela (Sprites.drawHorseSilhouette, atrás do cavalo, deslocada 1 px de arte nas 4 direções).
  // Em reduced o brilho fica fixo (sem pulsar).
  function glow(item, simT, reduced) {
    if (!item || (item.kind !== 'skill' && item.kind !== 'garra')) return null;
    var e = item.escala || 1;
    if (simT < item.t0 - EPS || simT >= item.t1 - EPS * e) return null;
    var d = (simT - item.t0) / e, sai = (item.t1 - simT) / e;
    var amp = Math.max(0, Math.min(1, d / 0.15, sai / 0.3));
    var pulso = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(d * 2 * Math.PI / 0.7);
    return { cor: mix(corElemento(item), '#ffffff', 0.25), alpha: amp * (0.55 + 0.4 * pulso) };
  }

  // Efeitos de movimento enquanto a skill (ou a Garra) dura. box = caixa do cavalo em px do canvas + S.
  // O contorno é a silhueta (glow). Em reduced não desenha nada (vento, "+" e faíscas são partículas).
  function drawSkillAura(ctx, box, item, simT, reduced) {
    if (!item || !box || (item.kind !== 'skill' && item.kind !== 'garra')) return false;
    var e = item.escala || 1;
    if (simT < item.t0 - EPS || simT >= item.t1 - EPS * e) return false;
    if (reduced) return true;
    var S = box.S, cor = corElemento(item), claro = mix(cor, '#ffffff', 0.45);
    var d = (simT - item.t0) / e;
    var amp = Math.max(0, Math.min(1, d / 0.15, ((item.t1 - simT) / e) / 0.3));
    var prev = ctx.globalAlpha;
    function R(ax, ay, ww, hh, col, a) {
      ctx.globalAlpha = prev * amp * a; ctx.fillStyle = col; ctx.fillRect(ax * S, ay * S, ww * S, hh * S);
    }
    var bx = Math.round(box.x / S), by = Math.round(box.y / S), bw = Math.round(box.w / S), bh = Math.round(box.h / S);
    var tipo = item.kind === 'garra' ? 'vel' : item.icon, k, ph;
    if (tipo === 'vel' || tipo === 'ace') {            // linhas de vento atrás do cavalo
      for (k = 0; k < 5; k++) {
        ph = frac(d * 1.9 + k * 0.37);
        var ly = by + 4 + Math.round(((k * 7) % 5) / 4 * (bh - 12)), len = 6 + (k % 3) * 3;
        R(bx + 3 - Math.round(ph * 22) - len, ly, len, 1, claro, 0.85 * (1 - ph));
        stats.particulas++;
      }
    } else if (tipo === 'folego') {                    // "+" verdes subindo
      for (k = 0; k < 3; k++) {
        ph = frac(d * 0.9 + k * 0.33);
        var px = bx + Math.round(bw * (0.3 + 0.2 * k)), py = by + Math.round(bh * 0.55) - Math.round(ph * 16);
        R(px - 1, py, 3, 1, COR.ganho, 1 - ph); R(px, py - 1, 1, 3, COR.ganho, 1 - ph);
        stats.particulas++;
      }
    } else if (tipo === 'curva') {                     // faíscas nos cascos
      for (k = 0; k < 6; k++) {
        ph = frac(d * 3 + k * 0.29);
        if (ph > 0.6) continue;
        var sx = bx + Math.round(bw * (0.25 + 0.45 * ((k * 5) % 3) / 2)) - Math.round(ph * 6);
        var sy = by + bh - 4 - Math.round(ph * 7);
        R(sx, sy, 1, 1, COR.faisca, 1 - ph);
        R(sx - 1, sy, 1, 1, '#ffb347', 0.6 * (1 - ph));
        stats.particulas++;
      }
    }
    ctx.globalAlpha = prev;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Skill de tipo: aura do terço inteiro (chamas nos cascos, folhas e raízes por baixo, onda atrás).
  // Pixels de arte relativos ao canto do sprite (0..39 × 0..31, cascos na linha AURA.chao = Sprites.FOOT_Y);
  // a tela desenha ANTES do cavalo e do anel dourado do jogador, então nada cobre o cavalo, o jóquei, o
  // número da raia nem os balões. Só fillRect de cor sólida (nada de alfa, gradiente ou arco).
  // ---------------------------------------------------------------------------
  var AURA = {
    chao: 31, max: 30,
    fogo: { cerne: '#ffe27a', ponta: '#e8492b' },
    // Grama: cores escolhidas pelo contraste contra os pisos (gramado, terra, areia, com as faixas claras e
    // escuras): a raiz escura passa de 3:1 em todos; o realce e a folha são mais claros que o gramado
    grama: { raiz: '#2a1708', raizClara: '#ffe8b0', folha: '#eaff9a', sombra: '#1e3a10' },
    agua: { fundo: '#2f7fd0', espuma: '#eaf7ff', gota: '#bfe6ff' }
  };
  // contorno no chão, em volta dos cascos (o que fica em movimento reduzido), parado: Fogo e Água = anel de
  // 4 retângulos na cor do elemento; Grama = faixa de raiz marrom-escura (2 px) com dois realces claros e as
  // pontas subindo (5 retângulos) — o verde do elemento sumiria no gramado
  function auraContorno(R, elemento) {
    var g = AURA.chao, c = AURA.grama, cor = ELEM[elemento];
    if (elemento === 'grama') {
      R(7, g + 1, 26, 2, c.raiz);
      R(10, g + 1, 4, 1, c.raizClara); R(23, g + 1, 5, 1, c.raizClara);
      R(5, g - 1, 2, 3, c.raiz); R(33, g - 1, 2, 3, c.raiz);
      return;
    }
    R(8, g - 1, 24, 1, cor); R(8, g + 2, 24, 1, cor);
    R(6, g, 2, 2, cor); R(32, g, 2, 2, cor);
  }
  // Fogo: 5 chamas que nascem nos cascos da frente e ficam para trás (até ~16 px atrás do cavalo),
  // encolhendo; cada uma com base larga, ponta estreita, miolo amarelo e uma faísca vermelha; 2 brasas
  function auraFogo(R, t) {
    var g = AURA.chao, c = AURA.fogo, k, ph;
    for (k = 0; k < 5; k++) {
      var u = t * 1.5 + k / 5;
      ph = frac(u);
      var tremor = hash(k * 977 + Math.floor(t * 9) * 131 + Math.floor(u) * 7);
      var x = 28 - Math.round(ph * 44), h = Math.max(3, Math.round((1 - ph) * 7 + 2 + tremor * 2));
      R(x, g - h + 3, 4, h - 2, ELEM.fogo);                   // corpo (base larga)
      R(x + 1, g - h + 1, 2, 2, ELEM.fogo);                   // ponta estreita
      if (h >= 5) R(x + 1, g - h + 4, 2, h - 4, c.cerne);     // miolo
      R(x + (tremor < 0.5 ? 1 : 2), g - h, 1, 1, c.ponta);    // faísca na ponta
    }
    for (k = 0; k < 2; k++) {
      ph = frac(t * 1.1 + k * 0.5);
      if (ph > 0.7) continue;
      R(2 - k * 10 - Math.round(ph * 8), g - 9 - Math.round(ph * 8), 1, 1, c.cerne);
    }
  }
  // Grama ("Raízes Firmes"): a raiz marrom é o desenho dominante. Por cima da faixa do contorno: 3 raízes que
  // saem dos cascos de trás e se esticam pelo chão para trás descendo em degrau (crescem e encolhem, cada uma
  // com a ponta clara), uma
  // para a frente e 3 que agarram para cima entre as patas; e 4 folhas claras de 2×2 com sombra escura
  // embaixo e um pixel verde do elemento, subindo em espiral atrás do cavalo
  function auraGrama(R, t) {
    var g = AURA.chao, c = AURA.grama, k, ph;
    for (k = 0; k < 3; k++) {          // cada raiz desce em degrau (dois trechos) e tem a ponta clara
      var cresce = 0.5 + 0.5 * Math.sin(t * 1.7 + k * 2.1);
      var a = 2 + k + Math.round(cresce * 3), b = 2 + Math.round(cresce * 6), ry = g + 1 + (k === 2 ? 1 : 0);
      R(6 - a, ry, a, 1, c.raiz);
      R(6 - a - b, ry + 1, b + 1, 1, c.raiz);
      R(5 - a - b, ry + 1, 1, 1, c.raizClara);
    }
    R(35, g + 1, 2 + Math.round((0.5 + 0.5 * Math.sin(t * 2.3)) * 4), 1, c.raiz);
    var xs = [13, 18, 24];
    for (k = 0; k < 3; k++) {
      var h = 1 + Math.round((0.5 + 0.5 * Math.sin(t * 2.6 + k * 1.9)) * 3);
      R(xs[k], g - h + 1, 1, h, c.raiz);
    }
    for (k = 0; k < 4; k++) {
      ph = frac(t * 0.8 + k / 4);
      if (ph > 0.85) continue;
      var fx = 3 - k * 3 - Math.round(ph * 12) + Math.round(Math.sin(ph * 2 * Math.PI + k) * 3);
      var fy = g - 4 - Math.round(ph * 18), q = (Math.floor(t * 5) + k) % 2;
      R(fx, fy + 2, 2, 1, c.sombra);
      R(fx, fy, 2, 2, c.folha);
      R(fx + q, fy + 1 - q, 1, 1, ELEM.grama);
    }
  }
  // Água: uma onda alta que corre atrás do casco de trás (crista subindo e descendo e se curvando para o
  // cavalo, espuma), marolas que ficam para trás e 3 gotas
  function auraAgua(R, t) {
    var g = AURA.chao, c = AURA.agua, k, ph;
    var b = Math.round(Math.sin(t * 5)), o = Math.round(frac(t * 1.2) * 4);
    R(-18, g - 2, 24, 3, c.fundo);
    R(-11, g - 5, 14, 3, ELEM.agua);
    R(-6, g - 8 + b, 10, 3, ELEM.agua);
    R(-3, g - 11 + b, 7, 3, ELEM.agua);
    R(1, g - 13 + b, 5, 2, ELEM.agua);                        // a crista se curva para o cavalo
    R(-1, g - 12 + b, 3, 1, c.espuma);
    R(4, g - 14 + b, 3, 1, c.espuma);
    R(-6, g - 9 + b, 3, 1, c.espuma);
    R(-11, g - 6, 4, 1, c.espuma);
    R(-17, g - 3, 4, 1, c.espuma);
    R(-26 - o, g - 1, 6, 2, ELEM.agua);
    R(-33 - o, g, 5, 1, c.fundo);
    for (k = 0; k < 3; k++) {
      ph = frac(t * 1.5 + k / 3);
      if (ph > 0.8) continue;
      R(5 - k * 4 - Math.round(ph * 9), g - 14 + b - Math.round(Math.sin(ph * Math.PI) * 5), 1, 1, c.gota);
    }
  }
  var AURA_DESENHO = { fogo: auraFogo, grama: auraGrama, agua: auraAgua };
  // (x, y) = canto do sprite em px do canvas (o mesmo de Sprites.drawHorse), escala = px do canvas por pixel
  // de arte, t = relógio (segundos de apresentação; a tela soma um deslocamento por raia). Em reduzido, só o
  // contorno. true se desenhou (e conta em _stats.auras); elemento sem skill de tipo: false, nada desenhado.
  function drawTypeAura(ctx, elemento, x, y, escala, t, reduzido) {
    var desenho = AURA_DESENHO[elemento];
    if (!ctx || !desenho || !Object.prototype.hasOwnProperty.call(AURA_DESENHO, elemento)) return false;
    var S = escala > 0 ? escala : 1, tt = isFinite(t) ? t : 0;
    function R(dx, dy, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x + dx * S, y + dy * S, w * S, h * S); }
    auraContorno(R, elemento);
    if (!reduzido) desenho(R, tt);
    stats.auras++;
    return true;
  }

  // ===========================================================================
  // Natureza: sol, chuva, névoa, nublado, vento, folhas e poeira (spec §7)
  // ===========================================================================
  // Tetos por tela: a densidade é em pixels de arte (independe do DPR) e para em telas grandes.
  var NATUREZA = {
    pingosMax: 240, pingoArea: 380,            // 1 pingo a cada 380 px² de arte, no máximo 240
    respingosMax: 48, respingoArea: 240,       // vagas de respingo no chão da pista (cada uma acende ~30 % do tempo)
    respingoVagas: 160,
    folhas: { calmo: 0, brisa: 10, ventania: 18 },  // folhas + poeira no ar (metade em reduced)
    poeiraCasco: 3,                            // nuvenzinhas por cavalo (1 em reduced)
    linhasMax: 50,                             // faixas por raio/brilho (o passo cresce em telas grandes)
    retangulosMax: 2600                        // teto de fillRect por chamada (conferido no fx-test)
  };
  var RAIN = {
    vel: 1.5,                                  // alturas de tela por segundo (× 0,8–1,25 por pingo)
    velReduzida: 0.4,                          // em reduced: 40 % da velocidade e metade dos pingos
    relampago: 11,                             // período do relâmpago (s); nunca em reduced
    corLonge: 'rgba(182,204,240,0.50)', corPerto: 'rgba(222,238,255,0.78)',
    corRespingo: 'rgba(220,235,255,0.70)', corVeu: 'rgba(16,26,52,0.26)', corClarao: 'rgba(230,240,255,0.22)'
  };
  var SOMBRA_NUVEM = 'rgba(10,20,40,0.06)';
  // folha voando: 3×2 px de arte com 1 px mais escuro (talo/sombra), 4 quadros girando por função do tempo
  // ('l' = cor da folha, 'd' = a mesma mais escura); espelhada quando o vento sopra para a esquerda
  var FOLHA = {
    cores:   ['#7cb342', '#c9a227', '#d9772b', '#5e9a3a', '#a4c639'],
    escuras: ['#4b7424', '#836412', '#94461a', '#365e22', '#66801c'],
    quadros: [['ll.', '.ld'], ['.ll', 'dl.'], ['lld', '...'], ['.dl', 'll.']]
  };
  // Tom e alfa por piso, para o sol não sumir no pontilhado claro do piso (contraste medido no navegador):
  // calor = traço da miragem; poeira = miolo (cor, alfa) e, na areia, 1 px de borda mais escura
  // (o creme antigo dava a mesma cor do pontilhado claro do piso: o traço da miragem é branco-azulado)
  var CALOR = { areia: 'rgba(220,238,255,0.50)', terra: 'rgba(220,238,255,0.40)', grama: 'rgba(240,255,224,0.24)' };
  var POEIRA = {
    terra: { cor: [236, 218, 188], a: 0.9, borda: null },
    areia: { cor: [255, 255, 250], a: 0.95, borda: [128, 96, 58] }
  };

  function semente(seed) { var s = Number(seed); return Math.floor(hash((isFinite(s) ? s >>> 0 : 0) ^ SAL_NATUREZA) * 65536); }
  // passo vertical das faixas: base·P, maior em telas grandes (no máximo linhasMax faixas)
  function passo(total, P, base) { return Math.max(base * P, Math.ceil(total / NATUREZA.linhasMax / P) * P); }
  // o mesmo sol do Sprites.drawTrack (canto de cima, à direita)
  function solPos(c) { return { x: Math.round(c.W * 0.82), y: Math.round(Math.max(10 * c.P, (c.top - 22 * c.P) * 0.25)) }; }
  function rgbaN(r, g, b, a) { return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')'; }

  // ---- camada de trás (antes dos cavalos): coisas do chão ----
  // faixas de calor ondulando sobre a pista (sol; nunca em reduced)
  function calor(c) {
    var ctx = c.ctx, P = c.P, alt = c.bot - c.top;
    if (alt < 8 * P) return;
    var seg = Math.max(7 * P, Math.ceil(c.W / 80 / P) * P), faixas = [0.12, 0.38, 0.66];
    ctx.fillStyle = CALOR[c.piso] || CALOR.grama;
    for (var b = 0; b < faixas.length; b++) {
      var y0 = c.top + snap(alt * faixas[b], P), deriva = mod(c.t * (5 + 3 * b) * P, seg);
      for (var x = deriva - seg; x < c.W; x += seg) {
        var dy = Math.round(Math.sin(x / (9 * P) + c.t * 3.2 + b * 1.7) * 1.4) * P - (c.lift ? c.lift(x) : 0);
        ctx.fillRect(snap(x, P), y0 + dy, 5 * P, P);
        stats.natureza.calor++;
      }
    }
  }
  // respingos no chão da pista: só na faixa [laneTop, trackBottom], presos ao chão (cam)
  function respingos(c) {
    var ctx = c.ctx, P = c.P, alt = c.bot - c.top;
    if (alt < 6 * P) return;
    var linhas = Math.max(1, Math.floor((alt - 5 * P) / P));
    var vagas = Math.min(NATUREZA.respingoVagas, Math.round((c.W / P) * (alt / P) / NATUREZA.respingoArea));
    var span = c.W + 20 * P, lento = c.red ? RAIN.velReduzida : 1, n = 0;
    ctx.fillStyle = RAIN.corRespingo;
    for (var j = 0; j < vagas && n < NATUREZA.respingosMax; j++) {
      if (c.red && (j & 1)) continue;
      var per = (0.45 + 0.4 * hash(c.sd + j * 7 + 900)) / lento;
      var u = c.t / per + hash(c.sd + j * 7 + 901), ph = frac(u);
      if (ph >= 0.3) continue;
      var cyc = Math.floor(u);
      var px = snap(mod(hash(c.sd + j * 13 + cyc * 7919) * span - c.cam, span) - 10 * P, P);
      var py = c.top + 4 * P + Math.floor(hash(c.sd + j * 11 + cyc * 104729) * linhas) * P;   // até trackBottom − 2P
      if (c.lift) py -= c.lift(px);                        // no relevo da subida, o chão sobe junto
      if (ph < 0.12) {          // gota batendo: coroa baixa e o anel no chão
        ctx.fillRect(px - P, py - P, P, P); ctx.fillRect(px + P, py - P, P, P);
        ctx.fillRect(px, py - 2 * P, P, P); ctx.fillRect(px - P, py, 3 * P, P);
      } else {                  // gotinhas abrindo
        ctx.fillRect(px - 2 * P, py - P, P, P); ctx.fillRect(px + 2 * P, py - P, P, P);
        ctx.fillRect(px - P, py - 3 * P, P, P); ctx.fillRect(px + P, py - 3 * P, P, P);
      }
      n++;
    }
    stats.natureza.respingos += n;
  }
  // névoa: faixas em "pílula" de degraus, andando com o vento (atrás: alto e no fundo da pista; frente: sobre as raias)
  function nevoa(c, frente) {
    var ctx = c.ctx, P = c.P, W = c.W, alt = c.bot - c.top;
    var v = VENTO[c.w.intensity].nuvem * c.w.dir * (c.red ? 0.4 : 1);
    var linhas = frente ? [c.top + alt * 0.62, c.bot - 3 * P, c.top + alt * 0.22] : [c.top - 30 * P, c.top - 12 * P, c.top + alt * 0.4];
    ctx.fillStyle = frente ? 'rgba(232,238,242,0.15)' : 'rgba(222,230,236,0.20)';
    for (var b = 0; b < linhas.length; b++) {
      var s0 = c.sd + b * 17 + (frente ? 300 : 200);
      var bw = snap(W * (0.45 + 0.3 * hash(s0)), P), span = W + bw;
      var vel = (frente ? 11 + 4 * b : 5 + 2 * b) * P * v;
      var x = snap(mod(hash(s0 + 1) * span + c.t * vel, span) - bw, P), y = snap(linhas[b], P), e = (frente ? 5 : 6) * P;
      ctx.fillRect(x + 4 * P, y - 2 * P, bw - 8 * P, 2 * P);
      ctx.fillRect(x, y, bw, e);
      ctx.fillRect(x + 3 * P, y + e, bw - 6 * P, 2 * P);
      if (frente) stats.natureza.nevoaFrente++; else stats.natureza.nevoa++;
    }
  }

  // ---- camada da frente (depois dos cavalos): véus, ar e luz ----
  function sol(c) {
    var ctx = c.ctx, P = c.P, W = c.W, H = c.H, s = solPos(c), k, y;
    ctx.fillStyle = 'rgba(255,196,110,0.05)'; ctx.fillRect(0, 0, W, H);
    // brilho do sol em 3 degraus de pixel (sem gradiente suave)
    var R0 = Math.max(W, H) * 0.5, degraus = [[1.0, 0.045], [0.62, 0.055], [0.32, 0.07]];
    for (k = 0; k < degraus.length; k++) {
      var rr = snap(R0 * degraus[k][0], P), py = passo(rr, P, 2);
      ctx.fillStyle = 'rgba(255,240,190,' + degraus[k][1] + ')';
      for (var ry = 0; ry < rr; ry += py) {
        var hw = snap(Math.sqrt(Math.max(0, rr * rr - ry * ry)), P);
        ctx.fillRect(s.x - hw, ry, hw * 2, py);
      }
    }
    // raios de luz descendo do sol para a esquerda: faixas em degraus que alargam e somem
    var incl = [0.5, 0.95, 1.5], pY = passo(H - s.y, P, 4);
    for (k = 0; k < incl.length; k++) {
      var pulso = 0.8 + 0.2 * Math.sin(c.t * 0.5 + k * 2.1);
      for (y = s.y + 4 * P; y < H; y += pY) {
        var d = y - s.y, f = d / H, larg = snap((4 + 22 * f) * P, P), xc = s.x - d * incl[k];
        if (xc + larg < 0) break;
        ctx.fillStyle = 'rgba(255,244,200,' + (0.15 * (1 - 0.7 * f) * pulso).toFixed(3) + ')';
        ctx.fillRect(snap(xc - larg / 2, P), y, larg, pY);
      }
      stats.natureza.raios++;
    }
    // reflexos de lente em pixels
    var pl = 0.5 + 0.5 * Math.sin(c.t * 1.3), fl = [[0.62, 0.22, 5, 0.10], [0.48, 0.38, 3, 0.12], [0.3, 0.6, 7, 0.06]];
    for (k = 0; k < fl.length; k++) {
      var fx = W * fl[k][0], fy = H * fl[k][1], fr = fl[k][2] * P;
      ctx.fillStyle = 'rgba(255,250,220,' + (fl[k][3] * (0.7 + 0.3 * pl)).toFixed(3) + ')';
      ctx.fillRect(Math.round(fx - fr), Math.round(fy - fr / 2), Math.round(fr * 2), Math.round(fr));
      ctx.fillRect(Math.round(fx - fr / 2), Math.round(fy - fr), Math.round(fr), Math.round(fr * 2));
    }
  }
  // pingos inclinados pelo vento (dois tons: longe e perto) e relâmpago raro
  function chuva(c) {
    var ctx = c.ctx, P = c.P, W = c.W, H = c.H;
    ctx.fillStyle = RAIN.corVeu; ctx.fillRect(0, 0, W, H);
    var n = Math.min(NATUREZA.pingosMax, Math.round((W / P) * (H / P) / NATUREZA.pingoArea));
    var s = rainSlant(c.w), vel = H * RAIN.vel * (c.red ? RAIN.velReduzida : 1);
    // a tela se repete nas duas direções: o pingo que sai por um lado entra pelo outro, então a folga só
    // precisa cobrir o comprimento do pingo (com folga grande, a maioria cairia fora da tela)
    var topo = 12 * P, spanY = H + 2 * topo, pad = 12 * P * Math.abs(s) + 4 * P, spanX = W + 2 * pad, conta = 0;
    for (var pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? RAIN.corPerto : RAIN.corLonge;
      for (var i = 0; i < n; i++) {
        if (c.red && (i & 1)) continue;
        var perto = hash(c.sd + i * 5 + 9) > 0.68;
        if (perto !== (pass === 1)) continue;
        var sp = (0.8 + 0.45 * hash(c.sd + i * 3 + 2)) * (perto ? 1.15 : 1);
        var y = mod(hash(c.sd + i * 3 + 1) * spanY + c.t * vel * sp, spanY) - topo;
        var x = mod(hash(c.sd + i * 3) * spanX + (y + topo) * s, spanX) - pad;
        var segs = perto ? 5 : 3;
        for (var k = 0; k < segs; k++) ctx.fillRect(snap(x - s * k * 2 * P, P), snap(y - k * 2 * P, P), P, 2 * P);
        conta++;
      }
    }
    stats.natureza.pingos += conta;
    if (!c.red) {
      var lp = mod(c.t + hash(c.sd + 5) * RAIN.relampago, RAIN.relampago);
      if (lp < 0.06 || (lp > 0.14 && lp < 0.2)) { ctx.fillStyle = RAIN.corClarao; ctx.fillRect(0, 0, W, H); stats.natureza.relampago = 1; }
    }
  }
  // nublado: véu, sombras de nuvem e nuvens da frente levadas pelo vento
  function nublado(c) {
    var ctx = c.ctx, P = c.P, W = c.W, H = c.H, v = VENTO[c.w.intensity].nuvem * c.w.dir * (c.red ? 0.4 : 1);
    ctx.fillStyle = 'rgba(70,92,125,0.14)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = SOMBRA_NUVEM;
    for (var s = 0; s < 3; s++) {
      var cw = W * (0.5 + 0.3 * hash(c.sd + s + 5)), span = W + cw;
      var cx = mod(hash(c.sd + s + 1) * span + c.t * (14 + 6 * s) * P * v, span) - cw / 2;
      var cy = H * (0.35 + 0.4 * hash(c.sd + s + 3));
      for (var ring = 0; ring < 2; ring++) {
        var rw = snap(cw * (ring ? 0.3 : 0.5), P), rh = snap(rw * 0.35, P);
        ctx.fillRect(snap(cx, P) - rw, snap(cy, P) - rh, rw * 2, rh * 2);
      }
      stats.natureza.sombras++;
    }
    // nuvens no topo (canvas em cache do Sprites: só no browser)
    var SP = sp();
    if (!SP || !SP.cloudCanvas || typeof document === 'undefined') return;
    var prev = ctx.globalAlpha;
    for (var q = 0; q < 4; q++) {
      var cc = SP.cloudCanvas(10 + q, P * 2, 'nublado'), sp2 = W + cc.width * 2;
      var x = mod(hash(c.sd + q + 77) * sp2 + c.t * (8 + 4 * q) * P * v, sp2) - cc.width;
      ctx.globalAlpha = prev * 0.85;
      ctx.drawImage(cc, Math.round(x), Math.round(-cc.height * 0.35 + hash(c.sd + q + 9) * H * 0.06));
    }
    ctx.globalAlpha = prev;
  }
  // uma folha: as corridas de 'l' na cor da folha e, por último, o px 'd' escuro
  function desenhaFolha(ctx, X, Y, P, q, espelha, clara, escura) {
    var dx = 0, dy = 0, r, k;
    ctx.fillStyle = clara;
    for (r = 0; r < 2; r++) {
      var linha = espelha ? q[r].split('').reverse().join('') : q[r];
      for (k = 0; k < 3; k++) {
        if (linha.charAt(k) === 'd') { dx = k; dy = r; continue; }
        if (linha.charAt(k) !== 'l') continue;
        var k0 = k;
        while (k + 1 < 3 && linha.charAt(k + 1) === 'l') k++;
        ctx.fillRect(X + k0 * P, Y + r * P, (k - k0 + 1) * P, P);
      }
    }
    ctx.fillStyle = escura;
    ctx.fillRect(X + dx * P, Y + dy * P, P, P);
  }
  // folhas (e poeira no tempo seco) atravessando a tela no sentido do vento
  function folhas(c) {
    var cap = NATUREZA.folhas[c.w.intensity] || 0;
    if (c.red) cap = Math.floor(cap / 2);
    if (!cap) return;
    var ctx = c.ctx, P = c.P, W = c.W, H = c.H, lento = c.red ? 0.4 : 1;
    var pad = 6 * P, span = W + 2 * pad, seco = c.clima !== 'chuva', vb = VENTO[c.w.intensity].folha;
    for (var i = 0; i < cap; i++) {
      var s0 = c.sd + i * 23 + 400;
      var h1 = hash(s0), h2 = hash(s0 + 1), h3 = hash(s0 + 2), h4 = hash(s0 + 3);
      var x = mod(h1 * span + c.w.dir * c.t * vb * (0.7 + 0.6 * h2) * P * lento, span) - pad;
      var y = mod(h3 * H + c.t * (4 + 6 * h4) * P * lento, H) + Math.sin(c.t * lento * (1.6 + h4) + h1 * 6.283) * 5 * P;
      if (x < -2 * P || x >= W || y < 0 || y >= H) continue;
      var X = snap(x, P), Y = snap(y, P);
      if (seco && i % 4 === 3) {                       // grão de poeira
        ctx.fillStyle = 'rgba(214,190,140,0.60)'; ctx.fillRect(X, Y, P, P);
      } else {
        var cor = Math.floor(h2 * FOLHA.cores.length);
        desenhaFolha(ctx, X, Y, P, FOLHA.quadros[Math.floor(frac(c.t * lento * (1.5 + 2 * h3) + h1) * 4)], c.w.dir < 0, FOLHA.cores[cor], FOLHA.escuras[cor]);
      }
      stats.natureza.folhas++;
    }
  }

  // o: { weather, wind, t, W, H, P, laneTop, trackBottom, reduced, seed, cam, camada, lift, surface }
  function natureza(o) {
    o = o || {};
    var H = +o.H || 0;
    return {
      W: +o.W || 0, H: H, P: Math.max(1, Math.round(o.P || 1)), t: +o.t || 0, red: !!o.reduced,
      clima: o.weather || 'sol', w: ventoOk(o.wind), sd: semente(o.seed), cam: +o.cam || 0,
      lift: typeof o.lift === 'function' ? o.lift : null, piso: o.surface || 'grama',
      top: o.laneTop != null ? o.laneTop : Math.round(H * 0.35), bot: o.trackBottom != null ? o.trackBottom : H
    };
  }
  function drawNature(ctx, o) {
    var c = natureza(o);
    if (!ctx || !(c.W > 0 && c.H > 0)) return;
    c.ctx = ctx;
    var camada = o && (o.camada === 'tras' || o.camada === 'frente') ? o.camada : 'tudo';
    if (camada !== 'frente') {
      if (c.clima === 'sol' && !c.red) calor(c);
      else if (c.clima === 'chuva') respingos(c);
      else if (c.clima === 'nevoa') nevoa(c, false);
    }
    if (camada !== 'tras') {
      if (c.clima === 'chuva') chuva(c);
      else if (c.clima === 'nublado') nublado(c);
      else if (c.clima === 'nevoa') { ctx.fillStyle = 'rgba(200,212,222,0.10)'; ctx.fillRect(0, 0, c.W, c.H); }
      else sol(c);
      folhas(c);
    }
  }
  function drawFogFront(ctx, o) {
    var c = natureza(o);
    if (!ctx || c.clima !== 'nevoa' || !(c.W > 0 && c.H > 0)) return;
    c.ctx = ctx;
    nevoa(c, true);
  }

  // poeira dos cascos (terra ou areia; a tela não chama na chuva). (x, y) = casco de trás no chão (a tela
  // passa a âncora rear do cavalo). A nuvenzinha nasce atrás do casco (borda direita em x − 1 px de arte),
  // vai até x − 9 subindo e crescendo, com o alfa cheio até a metade da vida e depois some.
  function drawHoofDust(ctx, x, y, S, t, surface, reduced) {
    var pe = POEIRA[surface];
    if (!pe || !ctx) return 0;
    var n = reduced ? 1 : NATUREZA.poeiraCasco, lento = reduced ? 0.4 : 1;
    for (var k = 0; k < n; k++) {
      var ph = frac((t || 0) * 2.4 * lento + k / n);
      var a = pe.a * (ph < 0.5 ? 1 : Math.max(0, (1 - ph) / 0.5));
      var w = ph < 0.3 ? 2 : 3, h = ph < 0.3 || ph >= 0.7 ? 1 : 2;
      var px = Math.round(x - (1 + ph * 8) * S), py = Math.round(y - (1 + ph * 5) * S);   // canto de baixo, à direita
      var bx = px - w * S, by = py - h * S;
      if (pe.borda) {
        ctx.fillStyle = rgbaN(pe.borda[0], pe.borda[1], pe.borda[2], a);
        ctx.fillRect(bx - S, by - S, (w + 2) * S, (h + 2) * S);
      }
      ctx.fillStyle = rgbaN(pe.cor[0], pe.cor[1], pe.cor[2], a);
      ctx.fillRect(bx, by, w * S, h * S);
    }
    stats.natureza.poeiraCascos += n;
    return n;
  }

  // ---- traçado de cima: mapa da pista (sala) e minimapa (HUD da corrida) ---------------------------
  // Cores: reta na cor do piso (opts.piso; sem ele, a cor da reta do catálogo), curva e subida na cor do
  // tipo (GameData.BLOCK_TYPES). Largada: quadrado claro com borda escura; chegada: xadrez com borda.
  var MAPA = { largada: '#f1e9d4', borda: '#060d0a', claro: '#f1e9d4', escuro: '#141218',
    tipo: { reta: '#f6f2ea', curva: '#7ab8ff', subida: '#f2c230' } };
  function corTipo(tipo) {
    var g = gameData(), bt = g && g.BLOCK_TYPES && g.BLOCK_TYPES[tipo];
    return bt ? bt.color : (MAPA.tipo[tipo] || MAPA.tipo.reta);
  }
  function corBloco(tipo, piso) { return tipo === 'reta' && piso ? piso : corTipo(tipo); }
  // escala única (sem distorcer) para o traçado caber na caixa com `folga` pixels de arte de cada lado,
  // centrado: ponto (x, y) em metros -> (ox + x·s, oy + y·s) em pixels de arte
  function encaixe(path, box, folga) {
    var bb = path.bbox, iw = Math.max(1, box.w - 2 * folga), ih = Math.max(1, box.h - 2 * folga);
    var s = Math.min(bb.w > 0 ? iw / bb.w : Infinity, bb.h > 0 ? ih / bb.h : Infinity);
    if (!isFinite(s)) s = 1;
    return { s: s, ox: box.x + folga + (iw - bb.w * s) / 2 - bb.x0 * s, oy: box.y + folga + (ih - bb.h * s) / 2 - bb.y0 * s };
  }
  // linha grossa (t×t pixels de arte) de (ax, ay) a (bx, by), carimbada em pixels inteiros; ult guarda o
  // último carimbo para não repetir o mesmo pixel
  function carimbos(ctx, P, ax, ay, bx, by, t, cor, ult) {
    var dx = bx - ax, dy = by - ay, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    ctx.fillStyle = cor;
    for (var k = ult.x == null ? 0 : 1; k <= n; k++) {
      var cx = Math.round(ax + dx * k / n - t / 2), cy = Math.round(ay + dy * k / n - t / 2);
      if (cx === ult.x && cy === ult.y && cor === ult.cor) continue;
      ult.x = cx; ult.y = cy; ult.cor = cor;
      ctx.fillRect(cx * P, cy * P, t * P, t * P);
    }
  }
  // drawTrackMap(ctx, path, box, opts) -> { largada: [x, y], chegada: [x, y], enc } (pixels de arte)
  //   box = { x, y, w, h, P } em pixels de arte (P = pixels do canvas por pixel de arte);
  //   opts = { piso: cor das retas, linha: 2 | 3 (espessura em pixels de arte; padrão 2), fundo: cor }.
  function drawTrackMap(ctx, path, box, opts) {
    opts = opts || {};
    var P = box.P || 1, t = opts.linha === 3 ? 3 : 2, folga = t + 1;
    if (opts.fundo) { ctx.fillStyle = opts.fundo; ctx.fillRect(box.x * P, box.y * P, box.w * P, box.h * P); }
    var enc = encaixe(path, box, folga), pts = path.pts, ult = {};
    function X(q) { return enc.ox + q[0] * enc.s; }
    function Y(q) { return enc.oy + q[1] * enc.s; }
    // faixa fina por baixo da linha (t + 2: 1 pixel de arte para cada lado), na cor de cada trecho de opts.tercos
    var faixas = opts.tercos || [], ultF = {};
    if (faixas.length && path.ms) {
      for (var f = 0; f + 1 < pts.length; f++) {
        var mm = (path.ms[f] + path.ms[f + 1]) / 2, corF = null;
        for (var z = 0; z < faixas.length; z++) if (mm >= faixas[z].from && mm < faixas[z].to) corF = faixas[z].cor;
        if (corF) carimbos(ctx, P, X(pts[f]), Y(pts[f]), X(pts[f + 1]), Y(pts[f + 1]), t + 2, corF, ultF);
      }
    }
    for (var g = 0; g < path.segs.length; g++) {
      var sg = path.segs[g], cor = corBloco(sg.type, opts.piso);
      for (var k = sg.i0; k < sg.i1; k++) carimbos(ctx, P, X(pts[k]), Y(pts[k]), X(pts[k + 1]), Y(pts[k + 1]), t, cor, ult);
    }
    // largada: quadrado claro (t + 2) com borda escura
    var p0 = pts[0], pn = pts[pts.length - 1];
    var lx = Math.round(X(p0) - (t + 4) / 2), ly = Math.round(Y(p0) - (t + 4) / 2);
    ctx.fillStyle = MAPA.borda; ctx.fillRect(lx * P, ly * P, (t + 4) * P, (t + 4) * P);
    ctx.fillStyle = MAPA.largada; ctx.fillRect((lx + 1) * P, (ly + 1) * P, (t + 2) * P, (t + 2) * P);
    // chegada: xadrez de casas de 2 pixels (4×4 com linha 2; 6×6 com linha 3) com borda escura
    var q = t === 3 ? 6 : 4, cx = Math.round(X(pn) - (q + 2) / 2), cy = Math.round(Y(pn) - (q + 2) / 2);
    ctx.fillStyle = MAPA.borda; ctx.fillRect(cx * P, cy * P, (q + 2) * P, (q + 2) * P);
    for (var a = 0; a < q; a += 2) for (var b = 0; b < q; b += 2) {
      ctx.fillStyle = ((a + b) / 2) % 2 ? MAPA.escuro : MAPA.claro;
      ctx.fillRect((cx + 1 + a) * P, (cy + 1 + b) * P, 2 * P, 2 * P);
    }
    return { largada: [X(p0), Y(p0)], chegada: [X(pn), Y(pn)], enc: enc };
  }
  // drawMiniMap(ctx, path, posM, cores, me, box) -> [{ racer, x, y, tam, contorno }] (pixels de arte)
  //   O traçado (linha 2) e um ponto por cavalo no metro posM[j], na cor da raia (cores[j]): 2×2 com borda
  //   escura de 1 px (não some sobre a linha da mesma cor); o seu (me) é 3×3 com contorno claro e vem por
  //   último. box = { x, y, w, h, P, piso, fundo } como no drawTrackMap. Marca _stats.minimapa.
  // os terços das skills de tipo (GameData.TYPE_SKILLS: zone × D) na cor de cada elemento, na ordem da pista
  function tercosDaPista(D) {
    var g = gameData(), cat = (g && g.TYPE_SKILLS) || {}, out = [];
    if (!(D > 0)) return out;
    for (var el in cat) {
      if (!Object.prototype.hasOwnProperty.call(cat, el) || !ELEM[el] || !cat[el].zone) continue;
      out.push({ from: cat[el].zone[0] * D, to: cat[el].zone[1] * D + (cat[el].zone[1] >= 1 ? EPS : 0), cor: ELEM[el], element: el });
    }
    out.sort(function (a, b) { return a.from - b.from; });
    return out;
  }
  function drawMiniMap(ctx, path, posM, cores, me, box) {
    var P = box.P || 1;
    var tercos = tercosDaPista(path.distance);
    var enc = drawTrackMap(ctx, path, box, { piso: box.piso, fundo: box.fundo, linha: 2, tercos: tercos }).enc;
    stats.tercos = tercos.length;
    var out = [], ordem = [];
    for (var j = 0; j < posM.length; j++) if (j !== me) ordem.push(j);
    if (me >= 0 && me < posM.length) ordem.push(me);
    for (var o = 0; o < ordem.length; o++) {
      var r = ordem[o], meu = r === me, tam = meu ? 5 : 4;
      var pt = pathAt(path, posM[r] || 0);
      var x = Math.round(enc.ox + pt[0] * enc.s - tam / 2), y = Math.round(enc.oy + pt[1] * enc.s - tam / 2);
      x = Math.max(box.x, Math.min(box.x + box.w - tam, x)); y = Math.max(box.y, Math.min(box.y + box.h - tam, y));
      ctx.fillStyle = meu ? MAPA.claro : MAPA.borda; ctx.fillRect(x * P, y * P, tam * P, tam * P);
      ctx.fillStyle = cores[r] || MAPA.claro; ctx.fillRect((x + 1) * P, (y + 1) * P, (tam - 2) * P, (tam - 2) * P);
      out.push({ racer: r, x: x, y: y, tam: tam, contorno: meu });
    }
    stats.minimapa = true;
    return out;
  }

  var RaceFx = {
    DADO: DADO,
    // puras
    timeline: timeline,
    skillIcon: skillIcon,
    nomeCurto: nomeCurto,
    slowFactor: slowFactor,
    diceState: diceState,
    diceLabels: diceLabels,
    badgeSize: badgeSize,
    stripOrder: stripOrder,
    stripLayout: stripLayout,
    layoutBadges: layoutBadges,
    balloonSize: balloonSize,
    iconeDe: iconeDe,
    iconNameOf: iconNameOf,
    setIconImages: setIconImages,
    iconImage: iconImage,
    glow: glow,
    typeZone: typeZone,
    typeSkillOf: tipoDoCorredor,
    ELEM: ELEM,
    BALAO: BALAO,
    wind: wind,
    rainSlant: rainSlant,
    CURVA: CURVA,
    curveRuns: curveRuns,
    trackPath: trackPath,
    pathAt: pathAt,
    curveOffset: curveOffset,
    NATUREZA: NATUREZA,
    RAIN: RAIN,
    SOMBRA_NUVEM: SOMBRA_NUVEM,
    FOLHA: FOLHA,
    CALOR: CALOR,
    POEIRA: POEIRA,
    AURA: AURA,
    // desenho
    drawDice: drawDice,
    drawDiceStrip: drawDiceStrip,
    drawBalloon: drawBalloon,
    drawIconPng: drawIconPng,
    skillBannerLayout: skillBannerLayout,
    drawSkillAura: drawSkillAura,
    drawTypeAura: drawTypeAura,
    drawNature: drawNature,
    drawFogFront: drawFogFront,
    drawHoofDust: drawHoofDust,
    drawTrackMap: drawTrackMap,
    drawMiniMap: drawMiniMap,
    // estatísticas
    _stats: stats,
    beginFrame: beginFrame,
    endFrame: endFrame,
    resetStats: resetStats
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RaceFx;
  else root.RaceFx = RaceFx;
})(typeof self !== 'undefined' ? self : this);
