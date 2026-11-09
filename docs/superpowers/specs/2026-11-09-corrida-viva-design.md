# Spec — Corrida viva e modo DEV

Status: aprovada; implementada na branch `claude/corrida-viva` · Data: 2026-11-09 · Branch: `claude/corrida-viva` (a partir de `claude/visuais`)

## 1. Objetivo

Deixar a corrida legível e viva sem mudar quem ganha:

- todos os cavalos galopam em velocidade de corrida (hoje três estilos parecem trotar);
- o Dado da Sorte aparece na pista, um dado por cavalo, e o maior resultado brilha;
- a ativação de skills, Garra e cansaço fica visível no próprio cavalo;
- efeitos naturais melhores (sol, chuva, névoa, nublado), com vento e folhas;
- curvas que parecem curvas, no mapa e na pista;
- um modo DEV completo, com save separado, para testar tudo isso.

**Critério de sucesso:** numa corrida comum, sem ler o texto embaixo da pista, o jogador percebe
quem ativou skill, quem ganhou cada Dado e quando a pista está em curva; e consegue montar no modo
DEV qualquer cavalo, item e condição de corrida sem mexer no save real.

**O que o Vinicius pediu (literal):**
- "Alguns cavalos estão trotando ao invés de correr, mantenha o padrão de corrida em todos".
- "quando os dados forem jogados, faça com que apareça um dado girando em cima de cada cavalo
  (cada um com seu dado) e o resultado maior brilha".
- "Movimento na chuva, ventos, adicionar curvas no mapa" — chuva: "os pingos de chuva caindo e
  espirrando, por enquanto só"; vento e curvas **só visuais** (resposta A).
- "verifique a possibilidade de melhorar os efeitos naturais (chuva, sol, vento, folhas voando, etc)".
- Skills "não aparecem de forma visível durante o jogo … ícone de skill? efeitos na corrida do
  cavalo? texto sob o cavalo?".
- "Adicione um modo de DEV para testar o jogo (dinheiro infinito, posso escolher o tipo do cavalo a
  qualquer momento, o level, itens, etc)" — com save separado (resposta A).
- Gasto no PixelLab: "Até 30 gerações".

**Fora do escopo:** mudar regras, balanceamento ou o Dado da Sorte; vento como clima de regra;
respingos/lama nos cavalos; cavalos parados animados; arte de efeitos pelo PixelLab (fica para a
arte final); expedições.

## 2. Regras que continuam valendo

- Corrida determinística: mesma seed + mesma configuração ⇒ mesmo resultado. Efeitos visuais nunca
  alimentam a simulação.
- Nada de `Math.random` em `prototype/src/` (os efeitos usam o tempo e hashes da seed, como a chuva
  de hoje).
- `prototype/src/*.js` em ES5; `prototype/dist/` só pelo `node prototype/build.mjs`.
- Resultado nunca calculado/mostrado antes de a entrada ser paga (também no modo DEV: Ouro infinito
  repõe o saldo, mas a entrada é paga).
- Gemas nunca viram Ouro; Lendário nunca à venda **no jogo real** (no perfil DEV, itens Lendários
  são dados pelo painel, não vendidos).
- Sem o parâmetro DEV, `RaceSim.simulate` devolve exatamente o mesmo objeto de hoje.

## 3. Modo DEV

**Acesso.** `?dev=1`, como hoje. Com ele, o jogo usa o save `galope-elemental:dev` (o real é
`galope-elemental:v1` e não é lido nem gravado nessa sessão). Faixa fixa no topo:
"MODO DEV — save de teste". Sem `?dev=1`, o painel, o perfil de teste e as opções abaixo não existem.
Se o perfil DEV ainda não existe, ele nasce com a Brasa (sem passar pela escolha inicial).

**Painel.** Os 5 botões atuais viram um botão "DEV" fixo que abre uma gaveta (folha que sobe do
rodapé, rolável) com cinco grupos:

1. **Moedas** — "Ouro infinito" (ligado por padrão): depois de qualquer gasto o saldo volta a
   999 999. Campo para definir as Pedras.
2. **Cavalo** — criar ou editar a ativa a qualquer momento: elemento, raridade, sexo, nível
   (1 até o máximo), potencial (0–31 por status, ou "máximo"), skills (qualquer skill do catálogo,
   inclusive exclusivas), cores (pelagem, sombra, crina, detalhe). Atalho: copiar qualquer cavalo
   pronto (iniciais e aluguéis do Haras). O cavalo criado entra no estábulo (o limite de vagas não
   vale no perfil DEV) e vira a ativa.
3. **Itens** — qualquer peça do catálogo (slot, conjunto, raridade, inclusive Lendária) em qualquer
   nível de melhoria; atalho "conjunto completo" de um clima. As peças vão para o inventário.
4. **Próxima corrida** — forçar clima inicial, vento (calmo/brisa/ventania e direção), piso,
   distância, traçado (lista de blocos ou "mais curvas"/"mais subidas") e seed; opção
   "skills sempre ativam". Os campos vazios seguem a sala normal. Os valores valem só para a próxima
   corrida e o painel mostra o que está armado.
5. **Perfil** — "Zerar perfil de teste" (com confirmação) e "Voltar ao jogo real" (abre a página sem
   `?dev=1`).

**Simulação.** A única mudança em `sim.js` é o parâmetro opcional `config.dev = { skillsAlways: true }`:
na tentativa de skill o `r.rng()` continua sendo chamado (a ordem das chamadas não muda) e a skill
ativa mesmo que o número saia acima da chance. Sem `config.dev`, nada muda. Clima, piso, distância,
traçado e seed forçados entram por `config.conditions`/`config.seed`, que a simulação já aceita.

**Módulo.** `prototype/src/dev.js` (`window.Dev`) com as funções puras do painel: montar um cavalo a
partir das escolhas, montar uma peça, montar as condições forçadas, aplicar "Ouro infinito". A gaveta
e os cliques ficam em `game.js`.

## 4. Galope (PixelLab, até 30 gerações)

**O problema.** Os galopes dos estilos `ondas`, `folhas` e `lisa` saíram em meio-galope: corpo alto e
patas recolhidas. O de `chamas` é o padrão desejado: corpo esticado, patas bem abertas.

**Geração** (em `prototype/tools/pixellab-moldes.mjs`, mesmo fluxo, mesmas regras de teto e registro):
1. Novo quadro inicial ("montado") de cada um dos 3 estilos na pose de corrida, com o 1º quadro do
   galope de `chamas` como guia de pose (`init_image`) e o texto definindo a crina e as cores de
   referência do estilo.
2. Animação a partir dele: galope de corrida em velocidade máxima, passada longa, instante com as
   quatro patas fora do chão; 8 quadros pedidos (9 com o inicial), como hoje.
3. O resultado passa pela mesma classificação, limpeza, âncoras e escala dos moldes atuais.

**Aceite (o script mede; o controlador confere a folha):**
- passada: em pelo menos um quadro, a distância horizontal entre o pixel de casco mais à frente e o
  mais atrás (linhas do terço de baixo do contorno) ≥ 80 % da maior passada do galope de `chamas`;
- altura: a altura do contorno em cada quadro ≤ 110 % da altura média do galope de `chamas`;
- quadro reprovado ⇒ nova seed, dentro do teto.

Antes de ligar no jogo, o Vinicius recebe uma folha com os 4 galopes lado a lado.

**Bússola.** Uma geração nova de `aba-expedicao` pedindo agulha vermelha e branca nítida, apontando
para cima. **Teto total desta spec: 30 gerações** da cota do plano (US$ 0). Tudo registrado em
`docs/memoria/assets.md` com o custo real; as imagens antigas ficam em `raw/`.

## 5. Dados na pista

Fonte: o evento `'dado'` da simulação (`t`, `rolls[i] = { dice: [...], best, rerolls }`, `winner`,
`weather`, `changed`). Nada novo na simulação.

- **Câmera lenta:** do instante do Dado até +2 s de tempo real, a corrida anda a ~40 % da velocidade
  atual; "Pular" continua funcionando.
- **Dado girando:** sobre cada cavalo visível, um dado em pixel art gira por 1 s e vira uma plaquinha
  com o número (`best`). Com mais de um dado (Sorte ou Dado Viciado), a plaquinha mostra todos, com
  o melhor em destaque. Quem teve desempate (`rerolls > 0`) gira de novo por mais 0,6 s.
- **Vencedor:** plaquinha dourada, brilho pulsante e faíscas por 2 s; se o clima virou, a faixa de
  clima atual entra em seguida.
- **Cavalos fora da tela:** faixa "DADO DA SORTE" no topo com a cor da raia e o número de cada um,
  em ordem decrescente, o vencedor brilhando; some depois de 3 s.

## 6. Skills visíveis

Fonte: eventos `'skill'` (a skill é achada pelo nome entre as skills do cavalo, como hoje),
`'garra'` e `'cansou'`. Nada novo na simulação.

- **Balão sobre o cavalo:** ícone do tipo de efeito + nome curto da skill na cor do elemento; sobe e
  some em ~1,5 s. Ícones (pixel art por código, no estilo dos ícones de status já usados):
  velocidade (`speedMult`) seta dupla; aceleração (`accelMult`) raio; fôlego (`staminaRestore`,
  `drainMult` < 1) coração; curva (`curveBonus`) seta curva; subida (`hillBonus`, `hillDrainMult`)
  montanha; dado (`extraDice`) dado; clima (`weatherDouble`) ícone do clima; Garra
  (`garraChanceBonus`, `garraBoostBonus`) garra. Skill com mais de um efeito usa o primeiro da lista.
- **Efeito enquanto dura** (duração = `durationS`, ou o tempo para percorrer `distanceM`, ou até o
  fim do bloco; teto 7 s, mínimo 1,5 s): contorno brilhante na cor do elemento e o rastro de elemento
  mais forte; velocidade/aceleração ⇒ linhas de vento atrás; fôlego ⇒ "+" verde subindo; curva ⇒
  faíscas nos cascos.
- **Suas skills:** além do balão, faixa grande no centro ("LABAREDA!") por 1,5 s e o texto no feed.
- **Garra:** balão "GARRA!" com o mesmo tratamento até a chegada. **Cansou:** balão cinza "CANSOU".
- Balões de cavalos diferentes que se sobreporiam empilham para cima (no máximo 3 por cavalo).

## 7. Natureza, vento e opção de animações

**Vento (visual).** `RaceFx.wind(seed)` deriva do hash da seed (fluxo próprio, que não toca nenhum
fluxo da simulação): intensidade `calmo` 35 %, `brisa` 40 %, `ventania` 25 %; direção `→` ou `←`.
O modo DEV pode forçar. Selo "VENTO: BRISA →" ao lado do clima (no layout compacto, ícone só).
Efeitos: inclina a chuva; bandeiras das arquibancadas e grama da borda balançam; nuvens e névoa
andam mais rápido; folhas e poeira atravessam a tela (calmo: nada; brisa: poucas; ventania: muitas).

**Por clima:**
- **Sol:** raios de luz suaves descendo do sol; faixas de calor ondulando sobre a pista; poeira dos
  cascos em piso de terra ou areia (em qualquer clima seco).
- **Chuva:** só pingos e respingos. Pingos mais visíveis e inclinados pelo vento; respingos na faixa
  do chão da pista (não mais espalhados pela tela inteira).
- **Névoa:** duas camadas, uma atrás e uma na frente dos cavalos, andando com o vento.
- **Nublado:** sombras de nuvem atuais, levadas pelo vento.

**Desempenho.** Partículas com teto por tela; nenhum estado sorteado (posição = função de `t`, índice
e seed). Meta: no ui-test (Chromium, desktop 1280), o tempo médio de desenho por quadro com todos os
efeitos ligados fica no máximo 2 ms acima do mesmo cenário com a opção "reduzidas" (o teste falha
acima de 6 ms, margem contra ruído da máquina).

**Opção "Animações" no Perfil:** `Seguir o sistema` (padrão) · `Completas` · `Reduzidas`; gravada no
save (`state.settings.motion`). Reduzidas: a chuva continua caindo, mais devagar e rala; sem
relâmpago, clarões, ondulação de calor, faíscas e giro dos dados; câmera lenta do Dado com 1 s; menos
folhas e poeira. Toda checagem de movimento do jogo passa a usar essa opção (hoje lê só o sistema).

## 8. Curvas

Nada muda na simulação (curvas já existem como blocos e pesam na Manobra).

- **Traçado de cima:** `RaceFx.trackPath(blocks)` gera um caminho a partir dos blocos: retas em linha
  reta; cada curva gira no sentido anti-horário um ângulo proporcional ao comprimento
  (`clamp(comprimento / 150 m × 90°, 45°, 180°)`); subidas marcadas sobre o caminho. O caminho é
  escalado para caber na caixa.
- **Mapa da pista** (Correr e sala): troca a faixa reta colorida pelo traçado, com retas na cor do
  piso, curvas na cor da curva, subidas na cor da subida, largada e chegada marcadas.
- **Minimapa na corrida:** a faixa de progresso do topo vira o traçado, com um ponto por cavalo na
  cor da raia (o seu maior, com contorno). No layout compacto continua o selo "↪CURVA".
- **Pista lateral:** dentro de uma curva, a cerca externa e as linhas das raias curvam suavemente
  (deslocamento vertical em arco, ancorado no mundo), a arquibancada desliza revelando o miolo da
  pista e placas "CURVA" aparecem na cerca. A posição vertical dos cavalos acompanha a raia.

## 9. Arquitetura

- `prototype/src/fx.js` (`window.RaceFx`, ES5, UMD como os outros):
  - puras e testáveis no Node: `wind(seed)`, `timeline(sim, racers)` (lista de efeitos
    `{ t0, t1, kind: 'dado'|'skill'|'garra'|'cansou', racer, ... }`), `trackPath(blocks)`,
    `slowFactor(timeline, simT)` (câmera lenta), `skillIcon(skill)`;
  - desenho: dados, faixa do Dado, balões, contorno/efeitos de skill, natureza por clima, vento,
    folhas, poeira, minimapa, mapa da pista.
- `prototype/src/dev.js` (`window.Dev`): funções puras do painel (seção 3).
- `sprites.js`: `drawTrack` recebe `wind` e a curva atual (cerca, raias, arquibancada, bandeiras);
  `drawWeather` passa para `fx.js` (a assinatura antiga vira um repasse).
- `game.js`: perfil DEV e gaveta; opção Animações; a tela da corrida monta a linha do tempo uma vez,
  aplica a câmera lenta e chama os desenhos do `fx.js`; mapa da pista e minimapa pelo `fx.js`.
- `sim.js`: só `config.dev.skillsAlways` (seção 3).
- `build.mjs`: inclui `fx.js` e `dev.js` na ordem certa.

## 10. Testes

- `sim-test.js`: sem `config.dev`, 20 seeds fixas dão `finishOrder`, `finishTimes` e eventos idênticos
  aos de antes (um hash por seed, gravado no teste a partir do código atual antes de mexer no
  `sim.js`); com
  `skillsAlways`, toda skill cujo gatilho acontece gera evento `'skill'`.
- `fx-test.js` (novo, Node, entra no `check.sh`): `wind` determinístico e com a distribuição
  aproximada (10 000 seeds, ±3 p.p.); `timeline` com um evento por skill/Garra/cansaço/Dado e
  durações dentro dos limites; `trackPath` com o giro total igual à soma dos giros das curvas e as
  curvas nos trechos certos; `slowFactor` só dentro da janela do Dado.
- `ui-test.mjs`:
  - DEV: o save real não muda; Ouro volta a 999 999 depois de pagar a entrada; criar cavalo e item
    funciona; clima e vento forçados aparecem na corrida;
  - corrida com "skills sempre ativam": balões aparecem; no Dado, plaquinhas e faixa aparecem e o
    vencedor é o do evento;
  - opção Animações grava e muda o comportamento (chuva não congelada em "reduzidas");
  - tempo de desenho por quadro dentro do limite da seção 7;
  - sem moldes (`?semmoldes=1`) tudo continua funcionando.
- `moldes-test.mjs`: os galopes novos passam no aceite de passada e altura.
- `./scripts/check.sh` termina em `VERIFICAÇÃO COMPLETA: OK`; capturas oficiais regeneradas no fim.

## 11. Ordem das tarefas

1. Modo DEV (inclui o parâmetro da simulação).
2. Galope e bússola no PixelLab (folha para o Vinicius antes de ligar).
3. Base do `fx.js` + dados na pista.
4. Skills visíveis.
5. Natureza, vento e opção Animações.
6. Curvas (mapa, minimapa, pista).
7. Docs, capturas e memória.

## 12. Histórico de ajustes (implementação)

1. **Modo DEV:** interfaces finais `Dev.horseTemplate(c, n)` e `Dev.conditions(f, base)` (a sala normal é a base opcional; aceita lista de blocos); `L.dev` é `null` sem nada armado; Ouro infinito fica em memória; os 5 botões antigos do painel viraram a gaveta "DEV" (Moedas, Cavalo, Itens, Próxima corrida, Perfil).
2. **Simulação:** única mudança `config.dev.skillsAlways`; sem ele, 20 corridas de referência seguem idênticas (hash de ordem, tempos e eventos).
3. **Galope:** ondas, folhas e lisa guiados pelo 1º quadro do galope de chamas (`init_image_strength` 300), com aceite de passada e altura; a rodada de crina própria (força 150) não passou. Bússola nova (seed 2153). Gasto: 14 de 30 gerações (1939 → 1925), US$ 0.
4. **Escala de tempo:** em x1 a simulação anda ~4× o tempo real; os efeitos usam um fator `escala` para durar segundos reais (câmera lenta do Dado ~2 s, giro ~1 s, desempate até 0,6 s, brilho do vencedor ~2 s, plaquinhas e faixa ~3,6 s).
5. **Desempate do Dado:** a simulação guarda só o número da nova rolagem; a faixa ordena por desempates e depois pelo número (o vencedor sempre em 1º); quem desempatou ganha "↻".
6. **Skills:** balão preso à raia, à frente do focinho (do jogador, depois do "◀VOCÊ"), com borda na cor da seda e número da raia; contorno da silhueta na cor do elemento; nomes curtos (campo opcional `short` em 4 skills); ícone de clima conforme a skill; duas skills do jogador juntas aparecem em sequência na faixa central.
7. **Natureza:** vento sorteado pela seed (35 % calmo, 40 % brisa, 25 % ventania; direção → ou ←); folhas também na chuva quando há vento; no sol, calor e poeira dependem do piso; opção "Animações" no Perfil (seguir o sistema, completas, reduzidas), sem congelar nada em reduzidas (chuva e cenário a 40 %).
8. **Curvas:** mapa da sala desenhado de cima; minimapa no HUD; na pista, cerca, raias, cavalos e etiquetas sobem em arco (6 px de arte; 4 px na paisagem compacta); blocos de curva vizinhos viram uma curva só no desenho (a simulação continua por bloco).
9. **Desempenho:** relevo das subidas ~10× mais barato (123 → 10,6 ms por quadro a 1280 px): a faixa é copiada uma vez para um canvas de rascunho.
10. **Testes:** novo `prototype/tools/fx-test.js` (etapa 2b do `check.sh`); o `check.sh` passou a levar ~5 min porque o ui-test cresceu.
