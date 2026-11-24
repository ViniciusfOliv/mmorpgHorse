# Decisões

Formato: **decisão** — motivo. A mais nova fica no topo. O detalhe de cada frente está na spec dela
(`docs/superpowers/specs/`) e o design no `docs/GDD.md`; aqui fica o *quando* e o *porquê*.

## 2026-11-23 — Animação ambiente, amostra (entrega 1)
- **Animação ambiente por código primeiro, PixelLab só onde o código não fica natural** — ciclo de cor (mar, rio, lava,
  brilhos), deformação por pixel inteiro (capim, folhas, placas, torcida) e partículas na paleta custam zero de arte e
  cabem no orçamento; comer e cavar (a cabeça até o chão, a pata no ar) ficam para o piloto pago, que espera confirmação.
- **Um vento cosmético só, com rajadas que atravessam a cena da esquerda para a direita** — capim, coqueiros,
  bandeirolas, biruta, placa e poeira reagem à mesma função, em ordem: o movimento parece um vento, não vários loops.
- **No máximo uma atualização pesada por quadro (agenda) e imagem achatada composta num tique de 12 q/s** — o pico do
  quadro fica no custo de uma só (de 6,8 ms para ≤ 0,8 ms no contêiner); 1–2 quadros de atraso não se veem.
- **Idle do cavalo montado do mapa de papéis do molde** — respiração (barriga 1 px), piscar, cauda, orelha e cabeça
  saem das âncoras e dos papéis, para qualquer pelagem; o olho precisa virar âncora no JSON de cada molde (a busca
  automática não separa o olho das linhas da cara do robusto-folhas).
- **Na Fornalha, o pico da esquerda vira vulcão por código** (cratera, fios de lava, fumaça, bombas) — a arena gerada
  não tem vulcão; dá para desligar e comparar, e o `/v2/vfx` fica de reserva se o Vinicius não gostar.
- **Integração do personagem antes de animar mais coisa** (pedido da coordenação, guia `docs/arte/integracao.md`,
  2026-11-24) — o plano ganhou a etapa 0 com os P1 só de código; as etapas de animação vêm depois.
- **Pelagem em 4 tons por sombreado de código, não pelos crus** (2026-11-24) — medido: os crus dos moldes têm quase só
  2 tons de pelagem (vermelho claro e escuro) e os quadros do idle vêm planos; o sombreado pela silhueta e pela luz de
  cima e da esquerda é o mesmo em todos os quadros, e eles batem entre si.
- **Cata-vento do Planalto: fundo pelo PixelLab, rotor por código** (2026-11-24) — as pás pintadas eram assimétricas
  (6 braços) e não ficariam bonitas girando; o `/inpaint` (1 geração; o Pro custaria 10–20) refez o fundo depois que a
  entrada veio sem as pás (com elas, o modelo as repintava), e o rotor de treliça é rasterizado na grade em 24 ângulos.
- **Sombra de contato feita do próprio chão** (um degrau mais escuro da cor que está sob os cascos, miolo dois degraus,
  borda em pontilhado, 2 px para a direita) — o primeiro passo para o personagem não parecer colado por cima do fundo.
- **"Mais movimento" é a versão do jogo, com a vegetação e a água mexendo sempre** (Vinicius, 2ª rodada, 2026-11-23) —
  substitui a decisão anterior (atual como principal); a anterior fica só na amostra para comparar.
- **No comer do PixelLab, os fiapos de capim soltos da boca são apagados por código** (peças desconectadas do corpo de
  até 60 px) — as refações com outras seeds não resolveram e gastariam além do teto; o corpo é sempre a maior peça.
- **Pré-assar os loops periódicos (coqueiros, copas, capim, bandeiras, torcida) no início da tela** — em tempo real o
  Litoral fica no limite do orçamento (≈ 2 ms no celular médio); com os quadros prontos, o custo vira um `drawImage`.
- **A versão atual é a principal; a "mais movimento" fica como opção para comparar** (Vinicius, 2026-11-23; trocada
  pela de cima na 2ª rodada) — as duas na mesma página com um seletor por cena, ambas no orçamento.
- **Comer e cavar dos cavalos pelo PixelLab, o resto do idle por código** (piloto de 6 gerações, 2026-11-23) — o
  `animate-with-text-v3` a partir do molde em cores de papel baixa a cabeça até o capim e pateia de forma natural, e os
  quadros voltam aos papéis (servem a qualquer pelagem); piscar, cauda, orelha, respiração e aceno o código já faz.
- **Na amostra do Litoral a arquibancada fica mais à direita (168 em vez de 60)** — na largada ela cobre o mar; só na
  amostra, para o mar e o farol aparecerem nas duas versões.

## 2026-11-23 — Tudo na `main` (decisão do Vinicius)
- **AFK, ajustes do lote 1 e build dos testadores integrados e oficiais republicados** ("pode integrar tudo na main e
  republicar") — avanço direto de 29f65fd para 100e438, depois de o `check.sh` completo passar nesse commit.

## 2026-11-23 — Ajustes de interface, lote 1 (pedidos do Vinicius; ramo `claude/ajustes-1`, a partir de `claude/afk`)
- **Câmera da corrida centrada no jogador; afasta só para caber quem está a até 30 m (à frente ou atrás)** — pedido do
  Vinicius ("focar no meu cavalo e afastar quando os outros se distanciam"); a do refino centrava o meio do grupo e o
  jogador andava pela tela. Quem passa de 30 m não força zoom e fica pela seta com os metros (no piso, ~2,5 px/m numa tela
  de 240, os cavalos ainda se separam). Escala de 12 px/m de perto, sem piso fixo: o piso sai do limite.
- **Zoom pelos metros por pixel de arte, não por degraus de `s`** — o buffer segue ampliado por `s` inteiro e os cavalos
  1:1 (guia §2); trocar `s` no meio da corrida mudaria o layout das raias e pediria uma transição que pisca. O pedido
  aceitava as duas formas ("e/ou").
- **Suavização com velocidade mínima** (`CAMERA.vMin`) — a exponencial sozinha deixava o rival de trás 1–2 px cortado
  por segundos; o `ui-test` pegou. Afasta mais rápido (~0,2 s) do que aproxima (~0,6 s): ninguém sai da tela ao se
  afastar e a volta é calma.
- **`CAMERA.cauda` = 62 px** — medido: o rabo do molde robusto fica 62 px atrás do focinho (esguio 49), 2 px à frente.
- **Skills em resumo: `GameData.SKILLS[id].resumo` (sem números, até 30 letras)** — os números mudam com o rank e já
  estão no texto completo; o resumo diz o que a skill faz. Skill de tipo: o resumo é o efeito em pontos; Garra: onde a
  arrancada começa.
- **O nome da skill é o gatilho** (botão com a peça ⓘ depois dele, como o nome dos status) na aba Skills e no resultado;
  na escolha do Cupom o nome já é o botão da ação, então o gatilho é um "ⓘ" ao lado. Mouse (só com `hover: hover`) e
  foco: balão por cima, sem mexer na tela e sem pegar o mouse; toque/clique: abre embaixo (`aria-expanded`), como os ⓘ;
  Esc esconde. O balão fica sempre no DOM, ligado por `aria-describedby`.
- **Símbolo do sexo depois do nome e antes do #N** ("Brasa ♂ #1"), num `span role="img"` com "macho"/"fêmea"; a linha
  do Estábulo diz o sexo no nome acessível. A palavra "Macho"/"Fêmea" continua só na aba Ficha.
- **Cavalos selvagens: só o título num botão `disabled` com o selo "em breve"** — sem retratos (a vitrine animada era o
  que fazia a `final-10-expedicao.png` mudar a cada rodada); a lista `WILD_SHOWCASE` fica no `game.js` porque o wiki a lê.

## 2026-11-23 — Build dos testadores (`dist/jogo-teste.html`, pedido do Vinicius)
- **Terceiro build, só para testes rápidos de outras pessoas, sem o modo DEV**: evolução ×10 (XP da corrida, do ginásio e
  do AFK; as comidas não, porque o texto delas diz o valor), iniciais Raros com genética 22 (nota A) em todos os status,
  rivais da sala Mágicos com um só Raro e Poder entre 90% e 96% do cavalo ativo (o rival acima do alvo perde pontos
  livres e, se preciso, genética). Save próprio (`galope-elemental:teste-rapido`). Bloco `RAPIDO` do `game.js` dentro de
  `@dev` (o build tira da produção; `jogo.html` não muda). Os ginásios seguem como estão.

## 2026-11-23 — AFK: correções da revisão da coordenação e merge da `main`
- **Relógio da vaga (defeito grave corrigido):** "Tirar" + "Começar treino" largava e creditava outra corrida na hora.
  Agora a vaga vazia **guarda o relógio** (`inicioMin`), `Afk.ocupar` usa o maior entre agora, o relógio da vaga de
  destino e o da vaga de onde o cavalo veio, e o `sanear` não zera o relógio da vaga vazia.
- **Chance do offline com a configuração trocada:** `ultima` guarda a `chave` medida; se o cavalo mudou (peça, nível,
  skill) e a medida nova não terminou, o offline usa o **menor** entre a chance antiga e a parcial da medida em curso (0
  sem amostra) — `Afk.chanceOffline`. Um conjunto de peças não vale mais em várias vagas offline.
- **Acerto offline não perde o resto:** o relógio anda só o tempo das corridas contadas (`Afk.relogioAposOffline`); só
  quando o período passa do limite offline ele vem para agora.
- **Vaga assistida com a aba escondida:** ao voltar à aba, a corrida assistida fecha e o tempo dela entra no acerto.
- **Pergaminho de reforja na forja:** aceita os 15 materiais **somados de qualquer ginásio** e o incomum de qualquer um
  (flag `qualquerGinasio`), gastando primeiro do que o jogador tem mais — como a spec diz (decisão da coordenação).
- **Reforja sem Selo pode sortear de novo o mesmo tipo da linha rerrolada**; só não repete o das outras linhas
  (confirmado pela coordenação).
- **Merge da `main` (29f65fd) no `claude/afk`:** a arte da `main` manda no visual (Nunito, painéis azuis, moldura); as
  telas do AFK, da forja e das peças usam as mesmas classes e tokens e se adaptaram sem mudança de regra. Conflitos só em
  `ESTADO.md` (ficaram os dois registros), `dist/` (regenerado) e capturas (regeneradas).
- Números calibrados já registrados: amostra 2.400 e Ouro × 0,15 (bloco A, abaixo e `docs/exemplos.md` §5b); `main`
  0,75 · 1 · 1,25 · 1,75 e `plusStep` 0,2 (bloco B, abaixo e §5b).

## 2026-11-23 — AFK, execução do bloco B (decisões do construtor; o design não muda)
- **Principal das peças recalibrado para o PVE (meta E4):** Comum 0,75 · Mágico 1 · Raro 1,25 · Lendário 1,75, e +0,2 por
  nível de melhoria (eram 2 · 2 · 3 · 4 e +0,5 quando a peça valia no PVP). O status é inteiro, então a soma das peças é
  arredondada. Com isso o nível 45 com 5 Raras +7 vence o líder da Lendária dentro de 40–60% e, sem peças, de 15–35%.
- **Conjunto de 3 peças: +10% em todas as linhas de farm** (o bônus antigo de skill e Sorte saiu: era de PVP); 4 peças:
  clima 1,07; 5: sem penalidade de clima — os dois só no duelo do AFK (`entry.pve`).
- **Peça que caiu no treino ou saiu da forja não tem preço de venda** (só "Descartar"): senão o AFK viraria Ouro por fora
  do teto da E1. Só a peça comprada na loja vende de volta (25%).
- **Sem trava de peça com páreo aberto:** como a peça não entra no Poder, equipar, tirar, melhorar e reforjar ficam
  liberados sempre. As telas do PVP (Correr, largada, cabeça da Montaria, Estábulo) não mostram mais o resumo das peças.
- **A sub-aba se chama "Peças"** (e não "Equipamento"): com 4 sub-abas a palavra não cabia numa linha a 360 px.
- **`GEAR_PVP` (desligado) guarda o caminho antigo** (peças no Poder, na sala e nos bots; Pedra do pódio), em vez de
  apagar o código; `Gear.botGear` e `Gear.ratingPts` saíram.
- **Forja:** todas as receitas usam os materiais do ginásio escolhido na tela (a do Pergaminho "de qualquer ginásio" vale
  em qualquer um); se um dos dois materiais não cobre a metade, o resto sai do outro; o troféu gasto é o que o jogador tem
  mais. Peça pede confirmação (as linhas são sorteadas ao confirmar); Pedra e Pergaminho forjam direto. Seed das linhas:
  `hash2(seedBase, 0x464F0000 + forjaCounter)`.
- **Seed da reforja com dois hashes:** `hash2(hash2(seedBase, 0x52460000 + nº do uid), rerolls)`, no lugar de
  `uid × 1000 + rerolls` do plano (que colidiria depois de 1.000 reforjas e disputaria faixa com outros sais).
- **Reforja sem Selo:** o tipo novo não repete o das outras linhas, mas pode sair o mesmo de antes (como no plano).
- **`ITEMS.selo` entrou já na B3** (a forja da Lendária precisa dele); ícone em código (medalha com fitas), sem créditos.
- **O teste de interface do Selo no resultado troca o sorteio por um que sempre cai** (a regra dos 10% só para o 1º
  lugar está no `sim-test.js`): achar uma sala com vitória e Selo pela seed levaria dezenas de corridas.
- **Um commit só para o bloco B:** as tarefas B1 a B5 mexem nos mesmos arquivos e foram fechadas juntas.

## 2026-11-23 — AFK, execução do bloco A (decisões do construtor; o design não muda)
- **`faseId` usa o id do ginásio do catálogo** (`fogo:2:dificil`, e não `fornalha:2:dificil` como no exemplo do plano):
  é o id que o `GameData.GYMS` e o progresso do save já usam.
- **A vantagem de elemento do AFK é a do ginásio (`GYM.vantagem`, hoje 4%)**, e não um número próprio: a spec diz "nas
  regras do duelo de ginásio" e cita 3%, que era o valor antigo; a corrida AFK chama o mesmo `Ginasio.dueloCfg`.
- **Amostra da chance medida: 2.400 duelos (a spec partia de 400).** Com 400, só 25 de 30 configurações ficam a menos de
  3 p.p. da referência de 5.000 (a conta do desvio de uma proporção dá o mesmo: ±2,5 p.p. perto de 50%); com 1.600, 43
  de 45 no `balance.js` (95,6%, no limite da E3); com 2.400, 44 de 45. São ~1,5 s num computador, feitos em fatias.
- **Ouro do AFK: a tabela de partida × 0,15** (0,3 · 0,45 · 0,6 · 0,75 · 1,2 por vitória, × dificuldade). Com a de
  partida o cavalo típico de nível 50 tirava ~2.440 de Ouro por hora no líder da Lendária com o máximo de +Ouro (teto
  da E1: 450); agora o teto absoluto medido é 367.
- **E2 e E3, como foram medidas** (a spec não fixava): em `docs/exemplos.md` §5b. A segunda parte da E2 ("1 ou 2 degraus
  abaixo em metade dos casos") deu 44% e fica como informação até a B2: os oponentes da Difícil e da Lendária ainda não
  têm as peças que a E4 vai calibrar.
- **Para o Vinicius (não mudei regra):** o XP do AFK por hora é de 2 a 15 vezes o do PVP com os números de partida;
  os oponentes são fracos para um cavalo Raro; o prêmio quase não cresce com a etapa. Números em `docs/exemplos.md` §5b.
- **A medição em fatias soma as durações em décimos de segundo inteiros** (a E5 achou a diferença entre fatias).
- **Relógio do treino na tela (A7):** a corrida ao vivo é gravada ao largar (contador + ganho, antes de aparecer) e a
  vaga só larga a seguinte quando o tempo real do duelo passa; o tempo fora da tela do treino (outra tela do jogo, aba
  escondida, jogo fechado) é sempre acertado pela chance medida. "Assistir" anima a corrida em curso no tempo real do
  duelo; x2 e "Voltar ao treino" não adiantam o treino.
- **Vaga sem a chance medida não rende fora da tela** (a spec diz que o offline usa a última chance completa): a medição
  leva ~10 s com o jogo aberto e o resumo avisa quando isso aconteceu.
- **A Aveia dourada só é gasta quando o período fora passa do limite sem ela** (uma ida rápida a outra tela não a consome).
- **O resumo "Enquanto você estava fora" aparece para paradas de 10 min ou mais**; ao abrir o jogo, ele abre na tela do
  treino. Paradas menores são creditadas no baú sem aviso.
- **Coleta com perda pede um segundo toque** ("Coletar e perder" / "Cancelar"): a spec pede que a tela avise antes.
- **Ícones dos itens do AFK em código** (18 mapas 16×16, `icones-afk.mjs`); os 15 troféus usam uma taça por ginásio.
- **Vaga vazia não tem início** (`inicioMin` 0): o save saneado é o mesmo em qualquer hora; o relógio da vaga começa
  quando um cavalo entra.
- **A vaga guarda a última chance completa** (`ultima`): o offline usa essa enquanto a medida nova (o cavalo mudou) não
  termina, como a spec pede; trocar o cavalo ou a fase da vaga zera as duas.
- **XP de cavalo preso na sala aberta fica no baú** ao coletar (o resto sai), pela regra da sala: nada sobe o Poder do
  cavalo ativo acima do que a sala viu.
- **Bônus de insígnia não entra no AFK** (nem o +3% de Ouro nem o +3% de XP): o AFK tem os bônus dele (peças e
  bestiário).
- **Peça solta (Comum ou Mágica) só cai na Normal**, Rara na Difícil (1%) e na Lendária (2%), Lendária só na Lendária
  (0,2%): a leitura literal da tabela do §5.4. Das soltas, 30% saem Mágicas (número de partida, `drops.peca.normal.magica`).
- **"Drop raro" (bônus das peças e do bestiário) multiplica incomum, Pedra, peça e comida**, como na lista do §5.7; o
  Pergaminho de reforja e o troféu ficam fora (o troféu tem o bônus dele). O teto de 60% do incomum vale antes do bônus.
- **Quantidade com fração (bônus de material e de Ouro):** a parte inteira e mais 1 com chance igual à fração, pela seed
  — o valor esperado fica exato, e +3% de Ouro vale alguma coisa mesmo com 2 de Ouro por vitória.
- **Na derrota, o material é `floor(quantidade × 25%)`**, como a spec manda: na Normal isso é sempre 0 (1 a 3 × 25%), na
  Difícil 0 a 1 e na Lendária 1 a 3.
- **A Pedra Negra que cai não é item da mochila:** vai para o saldo de Pedras que o save já tem (`pedras` no prêmio).
- **Troféus:** `trofeu-<ginásio>-<etapa>`, com o nome "<objeto> do <oponente>" (os 15 objetos em `GameData.AFK.trofeus`).
- **Os itens do AFK entram em `GameData.ITEMS` com `grupo`**; `GameData.ITENS_USO` lista os seis de antes (as telas e os
  testes que enumeravam o catálogo passaram a usar essa lista).
- **Seed da corrida AFK: `hash2(hash2(seedBase, 0x41460000 + vaga), contador)`**; o offline decide a corrida k com a
  mesma seed que a corrida ao vivo de mesmo contador usaria (o contador segue de onde parou).
- **Os oponentes dos ginásios não têm skill de vaga hoje** (são os iniciais): o rank 3 e o rank 5 da Difícil e da
  Lendária ficam prontos, mas só o nível (e, no bloco B, as peças) deixa essas dificuldades mais fortes.

## 2026-11-23 — AFK: revisão do Vinicius (spec e plano atualizados)
- **Treinar pelo ginásio:** Expedição → ginásio → os oponentes já vencidos com "Treinar (AFK)".
- **Drop exclusivo por ginásio pesa de verdade:** a peça Rara (e a Lendária) do conjunto só se forja com o incomum e os
  troféus do ginásio do conjunto.
- **Peças com linhas de farm sorteadas pela seed** (Mágico 1, Raro 2, Lendário 3), no lugar do atributo fixo por slot.
- **Pergaminho de reforja:** rerrola uma linha escolhida; Ouro crescente na mesma peça (100 × 1,5^n), sem voltar a zero.
- **Selo do campeão, só do 1º lugar no PVP valendo (10%):** passa a ser exigido no rank IV → V das skills (muda o custo
  da spec das skills), garante a reforja (mantém o tipo, valor na metade de cima — chamada da coordenação, já que a
  reforja é de uma linha só) e forja a Lendária de conjunto (2 Selos).
- Plano: `docs/superpowers/plans/2026-11-23-afk-drops.md` (blocos A e B, B5 novo).

## 2026-11-23 — Conteúdo PVE: corrida AFK, itens e rancho (decisões do Vinicius, design em andamento)
- **Corrida AFK com drops (estilo Idleon/Taskbar Hero), itens mais variados (raros, bestiário, quantidades por ação) e
  equipamento com status só de PVE** entram em design juntos, porque compartilham os drops — propostas do Vinicius. O
  equipamento suspenso volta valendo só no PVE (AFK e expedição), nunca no PVP, o que mantém o PVP justo.
- **O AFK é para assistir enquanto joga e também para coletar offline** — escolha do Vinicius.
- **O Ouro continua vindo principalmente do PVP**; o AFK rende sobretudo material (proposta da coordenação, para a
  aposta continuar sendo o centro).
- **O rancho (fazenda estilo Stardew/Albion, com comidas, casas e trabalhadores) fica só como ideia por enquanto** —
  escolha do Vinicius; se voltar, começa como tela de gestão.

## 2026-11-22 — Integração da arte, etapa 8 (créditos e limpeza): a direção de arte fecha
- **Créditos no Perfil** (botão "Créditos" na seção "Sobre o jogo"): quem fez o jogo e a arte, a fonte e a paleta, com o
  texto de `docs/arte/creditos.md`; "Licença da fonte" abre o texto inteiro da SIL OFL 1.1 (`window.__OFL`, do
  `OFL-galmuri.txt`) num painel que rola — a licença tem de acompanhar a fonte embutida. Uma vista do Perfil
  (`ui.perfilVer`): o "Voltar" e o voltar do aparelho voltam ao Perfil com o foco no botão. Autor escrito como
  "Vinicius" (o nome para a loja ainda a confirmar). Bloco `creditos` novo no `ui-test`.
- **Saíram do repositório os assets substituídos** (ficam no histórico do git): `assets/icons/` (32×32 e `raw/`),
  `assets/pixellab/treinadores/` (64×64 e `escolhas.json`), `assets/marca/logo.png` (Canva) e `docs/capa.png`. Os testes e
  o wiki leem os finais de `assets/arte/`; `pixellab-treinadores.mjs` e os lotes de ícones do `pixellab-moldes.mjs` avisam
  que foram substituídos; `arte-treinadores.mjs`, `arte-icones*.mjs` dizem como recuperar a referência antiga se for
  preciso gerar de novo. O CLAUDE.md aponta as ferramentas novas.

## 2026-11-22 — Integração da arte, etapa 7 (marca)
- **O logo do Canva saiu**: a tela inicial mostra o logo desenhado na grade (emblema 10 + letreiro em duas linhas,
  125×38) em 2× quando a coluna tem 274 pixels de arte ou mais, senão 1×; o cabeçalho, o letreiro pequeno 1:1.
- **Letreiro pequeno novo para o cabeçalho** (`letreiro-mini.png`, 67×22, letras de 8 px à mão no `arte-letreiro.mjs`,
  sem custo): o de 12 px (32 de altura em duas linhas) não cabia nos 48 px de CSS do cabeçalho com a grade 1,5 e o de
  uma linha (152 de largura) não cabia ao lado do saldo a 360 px. Os outros PNGs da marca não mudaram.
- Ícone 512, destaque 1024×500 e capa são das lojas: ficam em `assets/arte/marca/` para a etapa de lançamento.

## 2026-11-22 — Integração da arte, etapa 6 (cenas das abas e mapas das trilhas)
- **Cena 256×160 no topo de Estábulo, Haras, Loja e Expedição** (`window.__TELAS.cenas`, com as 24 linhas de baixo em
  pontilhado Bayer assado no build), em canvas 1:1 na grade, cortando as laterais numa coluna mais estreita; a placa do
  título sobe 40 pixels de arte por cima da borda, como na prévia aprovada. No Estábulo, o cavalo ativo parado e
  respirando no meio da baia. Correr fica sem cena (a corrida é a cena dela).
- **Mapa 256×384 da trilha antes da lista de etapas** (a lista, com os bustos, continua sendo os botões e o texto
  acessível): caminho tracejado (aceso até a etapa da vez), tablados em ouro nas vencidas, ouro claro na da vez, e o
  oponente de pé (corpo 32×48) em cada parada; tocar numa parada toca no botão do cartão dela. O canvas tem um nome com
  o estado de cada etapa.
- **Limites de altura rebaseados:** o Estábulo ganha a parcela da cena (196 px a 360×780) nos limites das specs 3b §2 e
  itens §8; a trilha agora rola o mínimo até a etapa da vez também quando ela é o líder.

## 2026-11-22 — Integração da arte, etapa 5 (treinadores, bustos e arenas)
- **Cena do desafio sobre a arena do ginásio** (`window.__ARENAS`, 256×160): mostra 256×128 (sem as 32 linhas de cima do
  céu) e, numa coluna mais estreita, corta as laterais por igual (mínimo 160). O oponente no corpo de ~40 px (quadro
  32×48) ao lado do cavalo dele, do outro lado do picadeiro; o seu cavalo na frente; tudo 1:1 na grade. O jogo anota
  `data-arte` e `data-treinador` no canvas (o `ui-test` confere por eles). Sem a arena, fundo liso de painel.
- **Bustos 64×64 nos cartões da trilha** (coluna à esquerda, 1:1). Com eles o cartão do líder cresce e a revanche a
  360×780 passa a rolar 6 px (rebaseado). O cabeçalho do duelo na corrida ficou sem busto (mexeria na altura da cena).
- `window.__TREINADORES` agora é `{ id: { corpo, busto } }`, dos finais em `assets/arte/treinadores/finais/`; a pasta
  antiga `assets/pixellab/treinadores/` sai na limpeza da etapa 8.

## 2026-11-22 — Integração da arte, etapa 4 (ícones) e a `main`
- **Direção de arte (etapas 1 e 2) e skills com ranks juntas na `main`** (pedido do Vinicius): a `main` foi juntada no
  ramo (conflitos no CSS dos ranks, passado para a Galmuri9, no balão/brilho do rank V, levado à paleta, e na memória),
  `check.sh` completo OK e a `main` avançou sem reescrever nada (dc847ef).
- **Ícones finais 1:1 na grade**: o jogo e o wiki usam `assets/arte/icones/` (16×16 de código e 24×24 do Pro), cada um no
  tamanho nativo × `--px`, `pixelated`, sem o halo borrado de antes (`window.__ICONES_TAM` diz o tamanho). A casa do
  ícone das abas tem 24 de altura para os rótulos alinharem. **A pista fica com os 8 × 8 em código** (o RaceFx não recebe
  mais PNG: os de 16/24 não encolhem). A pasta antiga `assets/icons/` (32×32) sai na limpeza da etapa 8.
- **A medalha de raridade (24 px) só na ficha do cavalo e na escolha inicial**; nas listas e tabelas a pílula leva só o
  nome na cor da raridade — com a medalha, cada linha crescia ~30 px. A lista de 6 cavalos cresce 14 px (o ícone de
  elemento a 16 × `--px`), rebaseada no `ui-test`.

## 2026-11-22 — Integração da arte, etapa 2 (corrida: 2.1 a 2.5)
- **A corrida é desenhada num canvas na resolução de arte** (S = 1) e copiada com um `drawImage` ampliado pela mesma `s`
  da interface; cavalos 1:1 (2.1).
- **Texto do canvas só na Galmuri, no tamanho nativo** (2.2): atlas de glifos com alfa binário gerado uma vez no Chromium
  (`fonte-glifos.mjs`), o mesmo no jogo e nos testes. Galmuri7 nos balões, etiquetas, placas e HUD pequeno; Galmuri11
  Bold nas faixas grandes; **a contagem 3-2-1 em Galmuri14** (entrou no atlas: o guia proíbe ampliar a fonte).
- **Cenário da corrida pelas camadas da região** (2.3): a pista sorteada escolhe a região (`regioes.json`, "pistas");
  os ginásios usam a região da arena (Fornalha no Sertão, Remanso no Litoral, Capoeira no Cerrado). Posições e paralaxe
  como na amostra aprovada; a arquibancada é um objeto a cada 2600 px da paralaxe 0,75. O horizonte vai com a névoa da
  distância assada no build. A pista, as cercas e as placas continuam de código, agora na Resurrect 64 (a terra é a da
  amostra). Sem as imagens (Node, ou antes de carregarem), o cenário por código de antes.
- **Câmera a 12 px de arte por metro e galope a 21 quadros do molde por segundo a 17 m/s** (2.4, guia §8a): cabem
  ~22 m de pista na tela de retrato, então quase sempre há cavalos fora; **quem sai da tela vira uma seta de 5 × 9 na
  borda**, na altura da raia e na cor da seda, sem os metros (guia §8). A foto de chegada continua a mesma (câmera parada
  com a linha a 62% da tela); nela o cavalo do jogador pode sair da tela por um instante, como antes.
- **Margem de baixo da pista 22 px de arte** (era 14), tirados do teto do topo (minTop + 62): o capim do primeiro plano
  aparece sem a cena crescer.
- **Clima por troca de paleta** (2.5, guia §3; a conta da amostra): nublado, chuva e névoa trocam as cores das camadas,
  do céu, da faixa de grama, do piso e das cercas, pré-desenhadas na largada (~25 ms). Névoa com véu em pontilhado de
  50%. Com o cenário da região, a natureza do `fx.js` sai **sem véus nem tintas de tela inteira** (chuva, nublado, névoa)
  e **sem os raios de sol translúcidos** (a luz do sol está na paleta, como na amostra); pingos, respingos, folhas,
  poeira e calor em cores sólidas da mestra. Só o relâmpago tem alfa.
- **Efeitos e HUD na mestra:** todas as cores do `fx.js` levadas à Resurrect 64 (misturas feitas na hora passam por
  `naMestra`); painéis do HUD sólidos com bisel (linha em cima, sombra embaixo); a raia do jogador só com os tracejados
  em ouro, sem o véu; a subida com hachura sólida de 1 px. **Ficam com alfa, de propósito:** o esmaecer dos balões e o
  pulso do contorno de skill (são fades no tempo, não véus de cor).
- **Paisagem:** a grade já dá 640 × 360 em 1280 × 720 (s = 2); a cena ocupa a coluna do jogo (560 × 235 ali), com mais
  pista de lado. Não mudou o layout da tela de corrida.

## 2026-11-21 — Skills com 100% e ranks entram na `main`
- **Integrar a `claude/skills-ranks` na `main` e republicar os três artefatos oficiais** — pedido do Vinicius ("integra
  na main e republica os oficiais"), depois de testar o build da branch. A `main` (direção de arte) foi juntada na branch
  antes (conflito só em `ESTADO.md` e `decisoes.md`); no resultado, `./scripts/check.sh` passou inteiro (201 / 129 / 173
  testes, 989 conferências do wiki, 111 metas rápidas, 73 blocos de interface) e a `main` avançou sem reescrever nada
  (merge `97d99df`). O `balance.js` completo (344 metas) tinha passado na branch antes do merge; a `main` só trouxe arte
  e ferramentas, sem número de regra. Oficiais: jogo na versão 13, DEV na 11 e wiki na 10.

## 2026-11-21 — Integração da arte, etapa 1b (paleta e cavalos 1:1 fora da corrida)
- **Cores da interface pelos papéis do guia** (fundo `2e222f`, painéis `313638`/`374e4a`, destaque `165a4c`, linha
  `547e64`, texto `c7dcd0`, ouro `f9c22b`). Os painéis são mais claros que o verde-escuro de antes: Fogo `f79617`, Água
  `8fd3ff`, perda `f68181`, Mítico com texto branco e alguns botões com fundo mais escuro, para passar de 4,5:1.
- **Cor do cavalo trocada pela mais próxima da Resurrect 64 na hora de recolorir** (CIELAB), sem mudar o save; sombra,
  tom 2 da seda e manta nunca caem na cor da base.
- **Cavalo 1:1 em todo retrato** (guia §7): o retrato grande mostra mais baia, não um cavalo maior. **No pódio, o 1º não
  é mais ampliado**: destaque pelo degrau, holofote e ouro.

## 2026-11-21 — Integração da arte, etapa 1a (interface na Galmuri)
- **Ordem nova da etapa 1** (aprovada pelo Vinicius): 1a interface, 1b paleta e cavalos 1:1 fora da corrida; a grade da
  corrida, o texto do canvas e os cavalos 1:1 na corrida vão junto com a etapa 2 (a pista de hoje é da grade grossa).
- **Grade da interface: `s = min(floor(L / 240), floor(A / 300))`** (L e A: largura da coluna e altura da tela em
  pixels do aparelho), no lugar do `round(L / 256)` do guia: a densidade 3 dava 234 px de arte e o rótulo "Expedição"
  não cabia; deitado, a letra ficava grande demais para a altura.
- **Galmuri9 é o texto corrido padrão**; a 11 fica para nomes, botões e títulos, a 7 para legendas (rótulos das abas,
  dono e nível na tabela de chegada, dono no pódio, "Genética"). Com a 11 em tudo, as telas cresciam até 11%.
- **Limites de altura do `ui-test` remedidos com a fonte nova** (Status 1.502, Skills 1.555, Correr 886, linhas da
  chegada a 1280 até 82 px, Status com itens +170): a Galmuri é mais larga que a Jersey; a folga de 4% continua.

## 2026-11-20 — Direção de arte: marca (etapa 7)
- **Letreiro "GALOPE ELEMENTAL" desenhado à mão em código, letra por letra** (`arte-letreiro.mjs`): a IA erra letras.
  Emblema do PixelLab Pro (escolhido o 10) ao lado; ícone do app Pro 128×128 (escolhido o 03) ampliado 4×.
- **Destaque do Play e capa compostos pela própria cena da corrida** (`arte-capa.mjs` captura a amostra no modo
  `?captura=`): ficam no estilo exato do jogo e são refeitos sem custo quando a arte muda. Saem em RGB sem alfa.

## 2026-11-20 — Direção de arte: cenas das abas e mapas das trilhas (etapa 6)
- **Cada aba ganha uma cena 256×160 numa faixa no topo, com a placa do título por cima da borda de baixo** (a lista e os
  botões continuam iguais); no Estábulo, o cavalo ativo parado na cena, 1:1. Escolhas: Estábulo 3, Haras 3, Loja 1,
  Expedição 3.
- **A trilha do ginásio vira mapa visto de cima** (256×384, só o terreno); caminho, paradas e os oponentes de pé (corpo
  32×48 da etapa 5) por código, de baixo para cima. Mapas: Fornalha 9841, Remanso 9852, Capoeira 9862.

## 2026-11-20 — Direção de arte: treinadores (etapa 5)
- **Oponentes dos ginásios em corpo de ~40 px (quadro 32×48) e busto 64×64, pelo Pro do PixelLab com a arte escolhida de
  referência** — a escala dos cavalos 1:1; a altura sai do tamanho do quadro pedido (48 para adultos, 36 para a criança).
- **Ginásios ao ar livre** (o Vinicius: "use cenário aberto nos ginásios"): a cena do desafio passa a 256×160 com uma arena
  aberta por ginásio (uma imagem só, chão e fundo no mesmo ângulo), na paleta da região mais próxima; parede + piso
  separados não casaram. Escolhidas: Fornalha 1, Remanso 0, Capoeira 2. Os tablados de código viram a sombra dos cavalos.
- **00 e 00 para todos** (escolha do Vinicius): poses neutras, de frente, coerentes entre si. Recruta Broto: corpo refeito
  (08, 33 px), porque no quadro de 48 a criança saía mais alta que os adultos.

## 2026-11-20 — Direção de arte: ícones (etapa 4, parte dos assets)
- **Ícones em dois tamanhos: simples em 16×16 desenhados em código; complexos em 24×24 pelo modo Pro do PixelLab** —
  decisão do Vinicius depois do piloto: em 16×16 nem o `/resize` nem o Pixen ficaram bons, e o `/resize` também falhou em
  24×24; o Pro (64 candidatos por 10 gerações, paleta travada, o ícone atual e os de código como referência) acertou.
- **O Pro corta os 64 candidatos de uma folha com a grade fora do lugar: o script remonta a folha e separa os ícones**
  (`separarFolha`) — sem isso cada quadro vinha cortado e com pedaços dos vizinhos.
- **Variações de cor por troca de rampa em código** (ligas, raridades, pódio) — uma geração serve a várias.
- **Raridade tinge o medalhão inteiro, não só os detalhes azuis** — pedido do Vinicius: as cinco pareciam iguais (cavalo
  branco com pontos coloridos). Insígnias dos três elementos têm sempre o anel dourado (a da grama troca o anel por código).

## 2026-11-20 — Direção de arte: regiões de corrida (etapa 3)
- **5 regiões aprovadas pelo Vinicius**: Cerrado, Várzea, Planalto, Sertão e Litoral, cada uma com paleta de 32 cores; a
  interface fica por código ("manter por código").
- **Na Retro Diffusion, pedir sempre a versão sem a remoção de fundo junto** (`return_non_bg_removed`, sem custo a mais)
  — a remoção apagou vegetação três vezes; a mata da várzea veio da versão sem remoção, com o céu tirado por código.
- **Recarga de US$ 5 na Retro Diffusion feita pelo Vinicius** depois de comparar as duas ferramentas; a RD fica para as
  faixas de vegetação e as emendas, o PixelLab para o resto.
- **Correções pedidas pelo Vinicius**: arquibancada do Sertão com torcida e mata da Várzea mais baixa para a lagoa aparecer.

## 2026-11-20 — Direção de arte: amostra aprovada e plano em etapas
- **Amostra da corrida aprovada (versão 2)** — "aprovado, pode fazer o plano em etapas".
- **Plano em 9 etapas** (`docs/superpowers/plans/2026-11-20-direcao-de-arte.md`): ferramentas → fundação no jogo →
  corrida → regiões → interface e ícones → treinadores → cenas e mapas → marca → fechamento. As que tocam
  `prototype/src/` esperam as skills com ranks entrarem na `main`; os assets pagos podem vir antes.
- **Paisagem e Steam na grade de 640 × 360** (guia §2), alinhada à regra da Steam do checklist (2026-11-19).

## 2026-11-20 — Direção de arte: retorno do Vinicius sobre a amostra
- **A interface de hoje fica; o padrão novo só troca pixel, paleta e fonte** — "a interface do anterior me parece
  melhor": a versão 1 da amostra simplificou demais (sem pote, estamina, vento, minimapa, células da ordem, vizinhos e
  horários na narração) e encolheu o texto. Narração e nomes passam para Galmuri11 (guia §6, §8b).
- **Corrida em "velocidade máxima" na tela: câmera a 12 px de arte por metro e galope a 21 quadros/s** — "no 1x parece
  bem lento"; a pista e a distância continuam as mesmas (guia §8a). O resto da amostra foi aprovado.

## 2026-11-20 — Direção de arte: amostra da corrida (execução)
- **Guia aprovado pelo Vinicius; gasto da amostra autorizado (até 200 gerações do PixelLab e a conta da Retro Diffusion,
  US$ 5)** — resposta dele em 2026-11-20. Chave da RD salva pelo formulário seguro da sessão (`X-RD-Token`).
- **Camadas de cenário: a melhor ferramenta por camada + emenda da RD** — no piloto, a RD Core ganhou no cerrado e no
  capim, o PixelLab Pixen nas chapadas, a RD Plus só na emenda nativa; a `seam_tiling` da RD emenda qualquer uma.
- **Chão da pista por código** — as texturas geradas saíram listradas e com ruído.
- **Quadro de estilo (50 gerações) cortado da amostra** — o piloto já fixou o visual; economiza a cota.
- **Arquibancada como objeto espaçado (a cada ~1.000 px de paralaxe), não camada repetida** — o diagnóstico apontou a
  repetição.
- **Galmuri embutida em subconjunto latino (TTF de ~25 KB cada)** — os originais têm 2,6–4,6 MB por causa do coreano.

## 2026-11-20 — Direção de arte: propostas do guia (aprovadas em 2026-11-20)
- **Uma escala de pixel para tudo: 1 pixel do molde do cavalo = 1 pixel de arte = `s` pixels do aparelho (inteiro),
  com a largura de arte perto de 256** — hoje o cavalo sai a 3/4 do pixel da pista; os moldes já pagos ditam a escala.
- **Paleta fechada Resurrect 64, até 32 cores por região** — testada nos treinadores e ícones atuais, que mantêm a leitura.
- **Fonte única Galmuri (11 Bold, 9 e 7; OFL)** — única família verificada com vários tamanhos na mesma grade, Bold e
  português completo com º e ª; saem Press Start 2P, Jersey 10 e a 3×5.
- **Canva sai da arte; logo e capa na grade de pixel (PixelLab + composição por código)** — o logo borrado veio de
  imagem grande reduzida.
- **Camadas de cenário: Retro Diffusion (`tile_x` + paleta) contra PixelLab, decidido num piloto pequeno** — a RD entrega
  a camada sem emenda e na paleta a US$ 0,06; o PixelLab precisa de uma pintura extra por emenda.
- **Efeitos por código, texto fora das raias** (só o "VOCÊ" e até 2 balões nelas) — determinismo e desempenho; o resto
  vai para o céu e para baixo da pista.

## 2026-11-20 — Direção de arte (decisões do Vinicius)
- **Visual com qualidade e desempenho em 100%, sem nada improvisado por ser mais barato; a ferramenta é a melhor para
  cada tipo de asset (PixelLab, outra IA ou software)** — pedido do Vinicius. O diagnóstico da coordenação: escalas de
  pixel misturadas, cenário por código genérico, interface sem identidade (três fontes) e logo borrado.
- **Só IA por enquanto, sem pixel artist contratado** — escolha do Vinicius; o acabamento é por código e a aprovação
  visual é dele.
- **Chat próprio de direção de arte** (`claude/direcao-de-arte`, Opus em esforço alto): pesquisa das ferramentas, guia
  de arte (`docs/arte/guia.md`), estimativa de custo antes de gastar, amostra da tela da corrida refeita no padrão
  final (`prototype/arte/`, artefato novo) e, aprovada a amostra, o plano para o jogo inteiro.

## 2026-11-19 — Marcos menores, Garra sem falhar e faixas rebaseadas (decisões do Vinicius, no chat de implementação)
- **Os três marcos menores** ("usa os três marcos menores") — Saída Rápida 7 s, Chama Final 11 s e Arrancada Final ×1,01
  até a chegada, no rank V (a spec dizia 8 s, 12 s e ×1,02).
- **A Garra também é 100%: a arrancada final sai sempre, e o status decide o quanto** ("Garra deve ser 100% também, com o
  status modificando o quanto ela afeta") — antes era um sorteio de 50% a 72%. Mais Garra: começa antes e empurra mais.
- **A força da Garra varia a cada corrida, pela seed, de 0 a 2× a média do status** (o Vinicius escolheu "Força variável"
  entre quatro opções) — o sorteio da Garra era a maior fonte de incerteza da corrida. Com força fixa, medido: favorito do
  Poder 69,2% (meta 35–55%), um degrau de raridade 97–99%, +10 num status 18 p.p. Com a força variável: favorito 51,1%.
  Números: força média = 0,19 × n(Garra) (era 0,02 + 0,26 × n com a chance; a média esperada ficou parecida), fator
  sorteado uma vez na montagem do corredor (`garraSpread` 1); o evento `garra` traz `forca`. A Arrancada Final deixou de
  dar chance: soma 2,8 p.p. na força (rank I). `RaceSim.VERSION` 4.1.0. Se errado: `garraSpread` menor dá uma Garra mais
  constante e uma corrida mais previsível (0 = força fixa).
- **Faixas rebaseadas ao medido** ("rebaseia as faixas"), todas no `balance.js`, com o valor antigo no comentário:
  bônus de clima do inicial 45–68 → 45–73; M4 um degrau 72–88 → 72–95; M5 ★★★ × ★ 65–75 → 61–75 e ★★ × ★ 55–64 →
  52–64; M9 15,3–18,0 → 15,0–18,3; G2 quatro níveis acima ≥ 70 → ≥ 60 e abaixo ≤ 35 → ≤ 46; G3 com vantagem ≤ 85 → ≤ 87;
  S5 (rank V ÷ rank I) teto 2,2× → 2,4×. Motivo: sem o cara ou coroa da ativação e da Garra, quem é melhor vence um pouco
  mais nos confrontos diretos de um degrau e um pouco menos nos de estrelas e de nível; a escala do rank sozinha passou
  de ~1,6× a ~1,8×. As metas de previsibilidade (P2, M8) e as de justiça entre tipos e status (M1, M9, A1, P1) não
  precisaram de folga além dessas.
- **Faixas de vitória do ginásio: apertada até 4 m e normal até 12 m (eram 1 e 8 m)** (construtor) — com a força da Garra
  variando, as chegadas entre cavalos iguais ficaram mais espalhadas e só ~5% caíam em "apertada"; com 4 e 12 m cada
  faixa volta a ter 15% ou mais (meta G6). A perda de fôlego de cada faixa não mudou.
- **Fôlego de Montanha no rank I: gasta 70% menos (×0,30)** (construtor) — para a razão do rank V caber; do rank IV em
  diante bate no piso de ×0,05.

## 2026-11-19 — Skills com 100% e ranks: o que o construtor decidiu (chat de implementação, `claude/skills-ranks`)
Spec `docs/superpowers/specs/2026-11-19-skills-ranks-design.md`, plano `docs/superpowers/plans/2026-11-19-skills-ranks.md`.
Build de teste desta branch (modo DEV, artefato novo; os oficiais não foram tocados): https://claude.ai/artifact/77SCN1gGcMb9DjMcUXwfkQ
(versão 1, build do commit que fecha o teste de interface; é o `prototype/dist/jogo-dev.html` com outro título).
- **Valores base do rank 1 (recalibração, só a parte de bônus; medição do `balance.js --skills`, 8.000 pares por skill)** —
  Arranque ×1,108 de aceleração · Sprint ×1,04 · Drift +1,3% · Saída Rápida ×1,32 e ×1,045 · Fôlego de Montanha ×0,40 ·
  Segundo Ar 10% e ×1,03 · Arrancada Final +10 p.p. e +2 p.p. · clima +0,04 (×1,03 → ×1,07) · Chama Final ×1,04 · Canto da
  Iara ×1,04 e ×0,80 · Nascente 4,5% · Casco Firme +1,2% · Dado Viciado sem valor base (teto 60 a 100). O rank 1 das 14
  skills fica de 4,7 a 10,4 p.p. (S1: 3 a 13). O Drift e o Arranque ficaram abaixo do de antes (12,7 e 12,4) de propósito:
  com mais base, o rank 5 passava de 20 p.p.
- **(Resolvido no mesmo dia: ver a entrada acima.) Três marcos não fechavam a S5 (rank 5 de 1,4× a 2,2× o rank 1) só com a base** — Saída Rápida
  2,46×, Arrancada Final 2,51× e Chama Final 2,30×, medidos em dois níveis de base cada. O marco de duração multiplica o
  efeito inteiro (8 s contra 6 s; 12 s contra 9,5 s), e o ×1,02 até a chegada vale ~6,6 p.p. sozinho, quase o rank 1 da
  skill. Com Saída Rápida 7 s, Chama Final 11 s e Arrancada Final ×1,01, as 58 metas das skills passam (2,08×, 2,07× e
  2,06×). O código está com os marcos da spec (as três metas falham no `balance.js` completo) até ele escolher.
- **(Resolvido no mesmo dia: ver a entrada acima.) Sete metas antigas do modelo saíram da faixa por pouco no `balance.js` completo** — M4 dois
  degraus no nível 50 (Raro × Comum 93,7% e Mítico × Raro 93,5%; piso 94), M5 ★★ × ★ Mítico 64,4% (teto 64; no modo
  rápido 66,3%), M6 `inc:acel` no nível 11 44,6% (piso 45) e a maior build no nível 50 62,7% (teto 62), M9 no Lendário
  50 (Fogo 18,0% no teto, Grama 15,2%; faixa 15,3 a 18). Causa provável: sem o sorteio, a raridade não dá mais vantagem
  de ativação (antes 35% a 75%), e toda skill pesa sempre. Valor base de skill não resolve; as saídas são rebasear as
  faixas ao medido ou recalibrar o TUNING. Por isso o `check.sh` para na etapa 7 (as três do modo rápido).
- **O Dado Viciado continua isento do S1 e da razão do S5** (rank 1: 0,2 p.p.; rank 5: 1,4 p.p.) — o dado extra só mexe
  na virada do clima; os tetos (20 p.p. e 2× a mediana) valem para ele. A spec pedia recalibrar "inclusive o Dado
  Viciado", mas não há valor base que o leve a 3 p.p. Se errado: o dado extra precisa de outro efeito (regra nova).
- **Marco das skills de clima: nos 15 s depois de o clima mudar, o cavalo segura o multiplicador reforçado inteiro
  (×1,03 + reforço), como se o clima ainda fosse o dele** — a spec dizia "o reforço continua"; só a parte do reforço em
  cima de um clima contrário quase não se sentiria. Se o clima voltar a ser o dele, o prazo acaba.
- **Os oponentes dos ginásios não têm skill de vaga (as bases são os iniciais), então o "rank fixo por etapa" fica
  gravado (`rank` 1, 1, 1, 2, 2) e sem efeito hoje** — vale quando algum oponente ganhar skill.
- **A skill que um dos pais tem, mas que o potro só ganhou no sorteio para completar o mínimo, nasce no rank 1** — é a
  letra da spec (herdada = rank do pai − 1; sorteada = 1).
- **Pergaminho do pódio com a mochila em 99 não entra (o resultado diz "Mochila cheia"); nos ginásios o desafio não abre
  sem espaço, como os outros itens** — o pódio não tem como esperar. O sal do sorteio é `0x50450000 + lugar`, com a seed da sala.
- **O bônus de 3 peças do conjunto virou `setBonus.skillEffect` 0,05 (o fator do rank × 1,05, `entry.skillScale`)** — como
  a spec manda; segue suspenso com o equipamento.
- **O teste do plano que esperava `hillDrainMult × 0,7` no Fôlego de Montanha estava trocado** (o ×0,7 é o marco do Casco
  Firme) — os testes seguem a tabela de marcos da spec.
- **Na tela:** "Ativa sempre: …" no lugar de "Quando: …"; a ficha diz "2 de 3 vagas · rank III, I"; o resultado diz
  "skills rank II" (o rank médio, o mesmo dos bots) no lugar da chance; o balão e a faixa do jogador trazem o rank em
  romano a partir do II e ficam dourados no V. O "skills sempre ativam" do DEV saiu; entrou o rank por skill.
- **`balance.js`: S1, S5 e S6 saem de uma medição própria (`rank`, 8.000 pares; `--skills [N]` roda só ela em ~2 min e
  `--skilltune` troca valores para ajuste)**; a seção 10 passou a conferir que a skill ativa em 100% das corridas.
- **Teste de interface:** seeds fixas trocadas onde o desfecho mudou com a simulação 4.0.0 (resultado: 74 e 9; faixa do
  lugar: 9 e 249); o teto de `fillRect` por quadro foi de 4.500 para 4.700 (mediu 4.523) e a altura de referência da aba
  Skills de 1.426 para 1.551 px (a interface mudou de propósito).

## 2026-11-19 — O jogo também vai para a Steam (decisão do Vinicius)
- **Steam entra no escopo, junto com web e Google Play** — escolha do Vinicius. Caminho recomendado: a mesma base web
  num build Electron + steamworks.js (é o que jogos em JS como Vampire Survivors e CrossCode fazem no PC). Comparação
  com Defold, LÖVE, GameMaker, MonoGame/FNA, Heaps, Godot e Unity em `docs/teste-engine.md` §8: todos exigiriam
  reescrever o cliente e portar o `sim.js`, e nenhum ganharia visual no aparelho medido. Se consoles entrarem no
  escopo, planejar uma versão nativa só do cliente depois do lançamento, como Vampire Survivors fez com a Unity. O que
  a Steam pede da base web (paisagem, controle, overlay, compras pela Steam) ficou no checklist do `docs/cronograma.md`.

## 2026-11-19 — Teste de engine: fica web (o Vinicius pode vetar)
- **A base web continua: não migrar para Godot** — o pior caso do lançamento (12 cavalos com clima, partículas,
  explosões de skill, parallax, câmera com zoom e tremida) rodou no celular do Vinicius, na WebView do app do Claude, a
  119,6 FPS numa tela de 120 Hz. O 1% low foi de 82,4, o p99 de 8,5 ms e o JS de 3,2 ms por quadro. O critério fixado
  antes do teste era ≥ 55 no 1% low. Na resolução nativa e com 20 cavalos o resultado foi o mesmo. O Godot custaria 2 a
  4 meses, o artefato como meio de teste e o risco de a corrida do cliente divergir do `sim.js` do servidor. Relatório
  em `docs/teste-engine.md`.
- **A corrida trava em 60 FPS em tela de 120 Hz, com um acumulador no ritmo da tela** (o do spike v3) — o limitador
  simples (pular a batida que chega antes de 13 ms) gerou quadros de 25 ms e reprovou a fase 2 sem o jogo atrasar nada.
- **Antes do lançamento: uma rodada longa (60 s, travada em 60) no celular e a bateria num Android fraco** — a primeira
  rodada de 60 s teve 4,5% de quadros acima de 20 ms, e a bateria não repetiu isso. Se um aparelho fraco não passar, as
  alavancas, sem reescrita, são: escala 3× ou 2×, menos camadas de clima em tela cheia e um desenhador WebGL2 da pista.
  O Godot só volta se o aparelho-alvo ficar abaixo de 45 no 1% low até em escala 1×.

## 2026-11-19 — Qualidade primeiro, teste de engine e skills com 100% (decisões do Vinicius)
- **A qualidade vem sempre primeiro: se Godot (ou Unity) for melhor em visual, FPS e jogabilidade, migramos** — pedido
  do Vinicius. Unity foi descartada na análise (pesada para 2D pixel art, licença, depende do editor, não dá para
  verificar no contêiner); a comparação é web × Godot 4, decidida por **evidência**: um teste de carga da corrida no
  pior caso visual, medido no celular dele, num chat próprio (`claude/teste-engine`, relatório em `docs/teste-engine.md`).
  O redesenho das skills segue em paralelo porque as regras vão para o servidor em qualquer engine.
- **Skills de vaga passam a ativar sempre (100%) quando o gatilho acontece, e ganham ranks** (ideia do Vinicius, nos
  moldes das fadas do Black Desert) — a skill que falha por sorte tirava valor da estratégia pré-corrida; o rank dá
  progressão clara. Spec em andamento.
- **O rank sobe com Ouro + um item ganho jogando (opção B)** — escolha do Vinicius entre só Ouro (A), Ouro + item (B) e
  uso em corrida (C): obriga a correr valendo e faz o Ouro pesar, sem deixar quem acumula Ouro subir tudo de uma vez.
- **Chats por frente:** este é a coordenação (decisões, specs, planos, revisão, memória); a implementação das skills vai
  para um chat próprio com o Fable 5.2 depois da spec e do plano aprovados; o teste de engine roda num chat com Opus em
  esforço alto.

## 2026-11-18 — Integração da tela de desafio e do Recomeçar do DEV na `main` (decisão do Vinicius)
- **Integrar na `main` e republicar o jogo e o DEV oficiais** ("sim, integra na main e republica") — por fast-forward;
  o código é o mesmo que passou na verificação completa (53e4ced; depois dele só mudou a memória); o wiki não mudou e
  não foi republicado.

## 2026-11-18 — A tela de desafio do ginásio (a "Cena 2", com a arte do PixelLab)
- **Antes de cada duelo de ginásio, uma tela de desafio: o oponente e o cavalo dele em cima, à direita, o seu cavalo
  embaixo, à esquerda, com as placas, o fundo do ginásio e a vantagem de elemento; "Começar duelo" e "Pular tudo"** — o
  Vinicius pediu "imagem do oponente e um cavalo do lado, do tipo dele, 2D, parecido com Pokémon", escolheu a maquete
  "Cena 2" e aprovou o PixelLab ("2 - pixel lab", depois "2 - sim" para o gasto). Os cavalos são os de verdade do duelo
  (os moldes do jogo, parados e respirando); o oponente é uma figura 64×64 por etapa. É só desenho: a tela abre depois de
  pagar (tudo já gravado) e mostra só o que o cartão e a tela do duelo já mostram (Ruling 22).
- **A tela de desafio vem antes de cada duelo, não dentro do cartão entre duelos** (controlador) — a proposta era pôr a
  cena no cartão, mas o cartão tem de caber sem rolar a 360×640 e em paisagem (testado); com a cena ele passaria. Custa um
  toque a mais por duelo (cartão → "Próximo duelo" → desafio → "Começar duelo"). Se errado: o cartão ganha uma cena menor e
  o desafio fica só antes do 1º duelo.
- **A arte: 15 oponentes, 36 gerações do PixelLab no total (piloto da Capitã Labareda, 4; os outros dois líderes, 4 cada;
  os 12 soldados, 2 cada), todos de frente, no mesmo estilo; o Vinicius escolheu a Labareda (a 3ª) e o controlador
  escolheu os outros 14** (pela leitura em tamanho pequeno e pela pose de frente) — a escolha fica em
  `prototype/assets/pixellab/treinadores/escolhas.json` (trocar uma é mudar um número) e o build embute só as escolhidas
  (+33 KB no jogo). Cada ginásio tem o seu tema de roupa (Fornalha: farda vermelha; Remanso: marinheiro azul; Capoeira:
  vaqueiro e guarda verde) e as patentes na roupa (recruta sem divisa, cabo 1, sargento 3, tenente de oficial).
- **A cena: 160×112 pixels de arte em escala inteira (1 a 3, a que cabe sem rolar), os cavalos a 1,5× (o quadro de 36 px
  vira 54) e o oponente a 1×; em paisagem a cena vai à esquerda e o resto à direita** (controlador) — cabe a 360×640, a
  780×360 e no computador; o teste confere a escala, as placas, os textos e que a arte do oponente foi desenhada.

## 2026-11-18 — Recomeçar pela escolha do cavalo também no modo DEV (pedido do Vinicius)
- **No build de teste (DEV), o "Recomeçar com outro inicial" do Perfil passa a fazer o mesmo que no jogo: apaga o perfil
  de teste e volta à escolha do cavalo inicial (Brasa, Maré ou Ipê)** — o Vinicius pediu "opção nos 2 artefatos para
  reiniciar e começar da escolha do cavalo"; no jogo o botão já existia (Perfil → "Recomeçar com outro inicial"), no DEV
  ele voltava direto à Brasa. O "Zerar perfil de teste" da gaveta continua voltando à Brasa (atalho de teste). Uma marca
  em `galope-elemental:dev:escolha` segura a escolha se a página recarregar antes de escolher (sem ela, a abertura do DEV
  criaria a Brasa); o "Escolher" apaga a marca. O teste `fluxo-dev` confere a escolha, o recarregar e o Ouro infinito
  depois da escolha. Se errado: a mudança é só do modo DEV (o jogo de produção sai sem esse código).

## 2026-11-18 — Integração dos pedidos do dia na `main` e os cavalos na curva (decisões do Vinicius)
- **Os cavalos não "fazem a curva": ficam só subindo com o arco da pista** (o Vinicius escolheu a opção 1 de três
  maquetes: só o arco; os cavalos inclinam com a pista; inclinam e fecham para dentro) — o arco já dá a ideia da curva.
  Se mudar de ideia: inclinar cada cavalo pela inclinação do arco sob ele é só desenho.
- **Integrar na `main` a corrida 50% mais longa, as informações da aba Skills e a curva com as pontas mais altas**
  ("3 - sim") — por fast-forward, com a verificação completa rodada na `main` antes do envio; os artefatos oficiais (jogo,
  DEV e wiki) republicados com o build da integração.
- **A arte do oponente e do cavalo dele na tela de desafio do ginásio ("Cena 2") sai do PixelLab** ("2 - pixel lab") —
  começa pelo piloto da Capitã Labareda (até 4 gerações); os outros dois líderes e os 12 soldados só depois de o
  Vinicius aprovar o piloto e confirmar o gasto.

## 2026-11-18 — Curva visível na pista: as pontas mais altas (escolha do Vinicius)
- **Na corrida, a curva aparece como um arco preso à tela: o meio da tela fica onde está e as duas pontas sobem, até 20
  px de arte no centro de uma curva cheia (as arquibancadas sobem 10/6 disso)** — o Vinicius viu duas maquetes (o meio
  mais alto e as pontas mais altas) e escolheu "por enquanto as pontas é o melhor". O arco antigo (6 px, puxando a pista
  inteira para cima) parecia a pista deslocada em curva longa. A intensidade continua a de `FX.curveOffset` (entra e sai
  da curva em rampa de 120 m); a forma nova é `FX.curveOffsetTela(curvas, m, cam)` = −20·k·u², com k a intensidade no
  centro da tela e u a posição na tela (−1 a 1). Cavalos, sombras e caixas de toque sobem junto com a pista. Em paisagem,
  onde quase não sobra céu, o arco encolhe (`lay.arcoK`; ~4 px). É só desenho: a simulação e o resultado não mudam. Se
  errado: muda um número (`FX.CURVA.tela`) ou volta ao arco antigo.
- **O teste `fluxo-curvas` confere a forma, não um número fixo** (controlador) — a pista sobe nas pontas (≥ 60% da
  borda esperada em 80% das colunas), o meio fica no lugar (≤ 1 px), o cavalo do jogador e a etiqueta "VOCÊ" sobem o
  mesmo que a pista sob eles, e a borda mínima é 4 px (a mesma exigência de antes). Se errado: o teste deixa passar um
  arco torto em alguma tela que ele não mede.

## 2026-11-18 — Corrida mais longa na tela (pedido do Vinicius)
- **A corrida na tela ficou 25% mais longa: de 20–34 s para 25–42,5 s em x1, conforme a distância** ("aumente um pouco a
  duração das corridas, estão muito rápidas") — mudou só a velocidade da animação (`TELA_S_MIN` e `TELA_S_MAX` no
  `game.js`); a simulação, o resultado, o balanço e o relógio da corrida no HUD são os mesmos. O "um pouco" virou 25% por
  decisão do controlador; os dois números ajustam a duração sem tocar em mais nada. Um duelo de ginásio passou de 30,5 s
  para 36,1 s em x1 e de 17,9 s para 20,5 s em x2. Com a corrida mais lenta, o teste da narração do bloco `corrida`
  passou a falhar por acaso: em x2 frases a 0,1 s uma da outra caíam no mesmo quadro e a Garra do rival com dono já
  chegava escondida; o teste agora volta a x1 depois da conferência de 2 s em x2 (só na tela que confere essa frase), e a
  verificação completa passou a levar ~11 min. No mesmo dia, um segundo pedido ("adicione um pouco mais de tempo") levou
  a mais +20%: de 25–42,5 s para 30–51 s (50% acima do original); o duelo passou a 42,1 s em x1 e 23,5 s em x2.

## 2026-11-18 — A aba Skills explica quando cada skill ativa (pedido do Vinicius)
- **A aba Skills da montaria mostra a chance de cada skill ativar com a conta (raridade + nível + Sorte, teto 95%), o
  "Quando" de cada skill (o gatilho, com os números da corrida; na arrancada final, o ponto da pista deste cavalo) e um
  quadro da Garra (onde começa, a chance e a força; com a Arrancada Final, os números se ela ativar)** — o Vinicius pediu
  essas informações "de acordo com o cavalo", atualizadas quando ele melhora. Os números saem do `sim.js` (`skillChance` e
  a função nova `garraInfo`, que usa as contas da corrida e a Garra da Maré Alta quando a arrancada começa no terço dela);
  um teste confere em 2.400 corridas que a Garra sai na frequência e no ponto que a tela diz. Se errado: é texto de tela.
- **A base do limite de altura da aba Skills nos testes passou de 1.145 px (antes da 3a) para 1.426 px (a medida com as
  informações novas), com a mesma folga de 4%** (controlador) — as informações pedidas ocupam ~280 px a mais no cavalo do
  teste; os textos foram encurtados antes. Se errado: a aba fica mais comprida no celular; dá para recolher o quadro da
  Garra num "Como funciona".

## 2026-11-18 — Integração dos ginásios da Expedição na `main` (decisão do Vinicius)
- **Integrar a `claude/nifty-newton-e8u133` na `main` antes de jogar** (o Vinicius escolheu a opção 1 de "integrar na
  `main`, abrir um pull request ou manter a branch") — a frente passou pela revisão final e pela verificação completa; a
  lista "A confirmar com o Vinicius (gosto, ginásios)" e as decisões da execução (abaixo) viram ajustes por cima da
  `main`. Feito por fast-forward, com a verificação completa rodada na `main` antes do envio.

## 2026-11-18 — Ginásios da Expedição — decisões da execução (o controlador decidiu sozinho; a confirmar)
Nada aqui foi decidido pelo Vinicius. Cada linha é uma decisão que o controlador tomou durante as 8 tarefas (as "Rulings"
de `.superpowers/sdd/2026-11-17-ginasios/rulings.md`, na ordem): **decisão** — motivo — custo se estiver errada. O que é
gosto e espera a palavra dele está em `ESTADO.md` ("A confirmar com o Vinicius (gosto, ginásios)"); o que mudou em relação
à spec está nas "Notas da execução", no fim dela.
- **(R1) Os testes das regras fixam por número só a forma do catálogo** (3 ginásios, 5 etapas, times de 1, 1, 2, 2 e 3,
  entradas e prêmios); os números da calibração são lidos do catálogo — assim calibrar não mexe em teste. Se errado: um
  número digitado errado no catálogo passa sem um teste apontar.
- **(R2) Os testes de tela chegam ao resumo por um só ajudante** — quando os duelos entraram na tela, só ele mudou. Se
  errado: nada no jogo.
- **(R3) O dia da revanche estragado no save é gravado já consertado ao abrir o jogo**, como na recompensa diária. Se
  errado: uma gravação a mais ao abrir.
- **(R4) A vitrine "Cavalos selvagens" continua na aba Expedição, embaixo dos ginásios.** Se errado: tirar é uma linha.
- **(R5) As faixas do cansaço são fechadas embaixo e abertas em cima** (com os limites finais, exatamente 1 m já é
  "normal" e 8 m já é "folgada") — a spec deixava o número exato do limite sem dono. Se errado: uma vitória exatamente no
  limite cansa 10 pontos a mais ou a menos.
- **(R6) Detalhes da regra do acerto:** ele recebe o dia de hoje e o tamanho do time, e o sorteio de cada duelo tem um sal
  próprio do ginásio. Se errado: nada na tela.
- **(R7) O acerto só paga um desafio que a regra deixaria fazer** (a etapa certa, a revanche livre hoje); em qualquer
  outro caso não dá nem XP — com o progresso velho de outra aba, daria XP em dobro. Se errado: um desafio certo recusado
  apareceria como falha nos testes.
- **(R8) Metas G2 e G3 ajustadas pela medição:** 4 níveis abaixo vence no máximo 35% (era 25%); com o ponto fraco, de 60%
  a 85% (era até 80%); em desvantagem, no máximo 35% (era 25%) — num duelo de 1 contra 1 a sorte de uma corrida pesa mais.
  Se errado: um desafiante 4 níveis abaixo vence o soldado até 1 vez em 3, e não 1 em 4.
- **(R9, trocada pela R11) O time de referência das metas** mudou durante a calibração. Se errado: nada; ver R11.
- **(R10) O que a calibração podia mexer:** os níveis (4, 8, 12, 16 e 20) ficaram os que o Vinicius aprovou; a vantagem
  ficou no menor valor redondo entre 3% e 5% que fecha as metas. Se errado: são números do catálogo.
- **(R11) Todos os cavalos dos soldados e dos líderes são o cavalo inicial do elemento** (Brasa, Maré ou Ipê), mudando só
  o nível, as estrelas e os pontos — os Comuns selvagens têm forças muito diferentes (o Lambari vale uns 7 níveis a menos
  que a Maré) e um ginásio ficava bem mais fácil que outro. Se errado: todos os cavalos de um ginásio têm o mesmo nome e
  desenho (nome e aparência próprios estão na lista de gosto).
- **(R12) Os limites do cansaço foram medidos de novo para cada faixa acontecer pelo menos 15% das vezes.** Se errado: uma
  das faixas aparece pouco.
- **(R13) A vantagem de elemento é de cerca de 4%** e o status continua inteiro (arredondado), então ela anda em degraus de
  1 ponto (cerca de 2 pontos nos cavalos de hoje); o texto para o jogador diz "cerca de 4%". Se errado: 3% e 4% dão o mesmo
  resultado em parte dos níveis.
- **(R14) As faixas do cansaço ficam em 1 m e 8 m** (apertada: menos de 1 m; normal: de 1 a menos de 8 m; folgada: 8 m ou
  mais) — entre cavalos parecidos a chegada é colada ou distante; com 5 m e 20 m a vitória "normal" ficava em só 6% a 7% dos primeiros duelos. Se
  errado: dois números do catálogo; estão na tabela que o Vinicius viu.
- **(R15) Com o save na versão 8, os testes que representam "a versão atual" e "uma versão mais nova" andaram um número**
  (7 → 8 e 8 → 9). Se errado: nada; são valores de teste.
- **(R16) Os três ícones de insígnia saíram da lista de "reservados"** e aparecem no jogo (já estavam pagos desde
  2026-11-12). Se errado: nada; são listas.
- **(R17) Ao abrir a trilha, a tela rola na hora o mínimo para a etapa que se pode tocar aparecer inteira** — com etapas de
  ~127 px, a próxima ficava escondida embaixo. Se errado: o Vinicius prefere ver primeiro o topo; desfazer é tirar uma
  chamada.
- **(R18) O sorteio de skill ao subir de nível num desafio tem um sal próprio** (20.000.000 + contador · 4 + posição no
  time), e cada cavalo do time tem o seu sorteio. Se errado: trocar o sal muda quais skills saem em saves de teste.
- **(R19) O teste "o detalhe da etapa não tem Desafiar" virou "tem exatamente um Desafiar"** — o botão entrou nessa tela
  de propósito. Se errado: nada.
- **(R20) No resumo, distância abaixo de 1 m aparece como "por menos de 1 m", e cada duelo traz "Você venceu" ou "Você
  perdeu"** — com os cavalos do adversário usando o nome do inicial, "Brasa × Brasa — Brasa vence" não diria quem ganhou.
  Se errado: é texto; está na lista de gosto.
- **(R21) Com qualquer sala de corrida aberta (valendo ou treino), o cavalo ativo fica fora do time;** o Ouro reservado
  continua sendo só o da sala valendo — a regra do projeto vale para todo páreo aberto. Se errado: quem tem uma sala de
  treino aberta precisa correr ou fechar o treino antes de usar aquele cavalo no ginásio.
- **(R22) A tela nunca diz quantos duelos o desafio terá** ("Duelo 2", não "Duelo 2 de 3") — num 2 contra 2, "de 3" já diz
  que o desafio foi ao terceiro duelo, e o jogo não mostra resultado antes da hora. Se errado: é um texto.
- **(R23) O "Voltar" do aparelho durante um duelo ou num cartão vale como "Pular tudo"** (vai ao resumo): o desafio já
  está gravado, e o resumo é onde o jogador vê o que ganhou. Se errado: troca-se o destino para a trilha.
- **(R24) Os metros de um duelo na tela são truncados para baixo** (7,6 m aparece como 7 m; abaixo de 1 m, "menos de 1
  m") — arredondando, a tela dizia "Vitória apertada (1 m)", e apertada é menos de 1 m. Se errado: o número mostrado fica
  até 1 m menor; é texto.
- **(R25) Quatro testes de "nada apareceu antes de pagar" ficaram mais fortes:** agora falham também se aparecer um duelo
  ou um cartão. Se errado: nada.
- **(R26) O módulo dos ginásios passou a responder qual é o prêmio de hoje da revanche** (a mesma função que paga), e a
  cópia dessa conta na tela saiu — uma fonte só para o prêmio mostrado e o pago. Se errado: nada; é uma exportação.
- **(R27) Com a insígnia, a trilha rola até a revanche livre de hoje, como rolava até a etapa próxima;** com a revanche de
  hoje feita (nada para tocar), fica no topo. Se errado: nada; é a mesma regra da R17.
- **(R28) O texto "de onde vem" do Torrão, da Rédea nova, do Cupom e do Manual passou a citar os ginásios** (é o texto da
  Mochila, da linha da Rédea na Loja e do wiki) — os quatro são prêmio de alguma etapa ou do rodízio da revanche, e o texto
  antigo dizia que só vinham da loja e da diária. Só texto, nenhuma regra. Se errado: quatro frases do catálogo.
- **(R29) "Corra ou feche a sala primeiro" virou "Corra essa corrida primeiro"** ("Está na sala aberta. Corra essa corrida
  primeiro." e "Seu único cavalo está na sala aberta. Corra essa corrida primeiro.") — o jogo não tem como fechar uma sala
  sem correr; a frase vinha da spec (§5), que ganhou uma nota no fim. Se errado: é texto.
- **(R30) O que a revisão final apontou e fica como está:** prever o resultado pelo console do navegador (a seed está no
  save; vale também para corrida e itens, e só o servidor fecha); adiantar o relógio para ganhar mais revanches (a regra é
  a da diária); um dia de revanche no futuro mostra "Volte amanhã" por muitos dias (só com o relógio mexido); save
  adulterado (o saneamento deixa coerente); o +3% de Ouro incide sobre o prêmio inteiro, com a entrada de volta (está na
  spec; anotado para o servidor); o resumo se perde ao recarregar (a spec manda); as capturas não foram comparadas uma a
  uma. Foram para a lista do Vinicius o balanço do líder (um cavalo sozinho vence o líder em cerca de 2% das vezes) e para
  as pendências do `ESTADO.md` o tempo do toque em "Desafiar" num celular fraco. Se errado: cada item se desfaz sozinho; nenhum cria Ouro nem muda regra.

Além das Rulings, na Tarefa 8 (documentos), decididas por quem a executou:
- **(Tarefa 8) A folha da interface ganhou o cartão de ginásio, a trilha, a linha do time e o cartão entre duelos
  (seções 4.21 a 4.24), e um teste confere que o markup de cada estado na folha é o mesmo que o jogo desenha** — sem isso,
  a folha podia ficar diferente do jogo sem ninguém ver (o teste achou duas diferenças na hora: o "1º" do jogo passa pelo
  desenho do ordinal, e o cavalo ativo leva a plaquinha "Ativa"). Se errado: um teste a mais no bloco `acabamento`.
- **(Tarefa 8) As cinco capturas novas (`final-24` a `final-28`) saem de um bloco próprio do teste de interface,
  `fluxo-capturas-ginasio`, com o jogo de verdade (sem a faixa DEV) e o desafio do Sargento Candeeiro da Tarefa 6** (três
  duelos e vitória); a do duelo é o 1º duelo no meio da corrida, com os dois cavalos na tela. Se errado: trocar a cena é
  mexer só nesse bloco.

## 2026-11-17 — Ginásios da Expedição (decisões do Vinicius)
Conversa de desenho; spec aprovada em `docs/superpowers/specs/2026-11-17-ginasios-design.md` (as decisões do controlador
estão na seção 19 dela e valem com a aprovação).
- **Antes do líder há soldados, cada um mais forte que o anterior, com força fixa** — eles não acompanham o nível do
  jogador: o caminho é uma régua que só se passa evoluindo os cavalos.
- **Trilha por ginásio, de baixo para cima, com o líder no topo** — cabe no celular e não pede arte nova; o mapa da região
  fica para quando houver mais ginásios.
- **Prêmio cheio uma vez; depois da insígnia, 1 revanche por dia com o líder, com prêmio pequeno** — dá motivo para voltar
  sem virar fábrica de Ouro.
- **Duelo de time: quem vence fica, quem perde sai; perde o lado que ficar sem cavalos** — já estava no GDD §8.6.
- **Quem vence chega cansado, e o cansaço depende de quão apertada foi a vitória** (ideia dele): pouca distância na chegada,
  mais cansaço.
- **Três ginásios de uma vez: Fogo, Água e Grama** — com dois, um elemento ficava de fora.
- **Entrada pequena em Ouro por desafio** — a corrida tem sorte; sem custo, dava para insistir até passar.
- **O ginásio tem ponto fraco: o elemento que o vence leva vantagem**, pela vantagem direta no duelo (3% nos status, só nos
  ginásios), com pista própria em cada um — escolhido entre quatro formas depois de ver a medição: com a casa a favor do
  ginásio, um desafiante de outro elemento no mesmo nível vencia só 12% a 22% dos duelos. (A calibração passou a vantagem
  para cerca de 4%: ver as decisões da execução, 2026-11-18.)
- **Aprovou os números de partida e a spec** ("Sim"), incluindo o time do jogador limitado ao tamanho do time do
  adversário. Os números finais saem da calibração e a tabela é mostrada a ele antes das telas. (A tabela dos números
  calibrados foi mostrada a ele em 2026-11-17, antes das telas; é a fonte dos números do GDD §8.6.)

## 2026-11-17 — Teste de interface em paralelo (controlador)
- **Integrado na `main` em 2026-11-17 por decisão do Vinicius** ("Sim, pode integrar na main") — com o `check.sh` em OK
  na árvore integrada. Só o teste em paralelo entrou; o desenho dos ginásios ficou na branch da sessão, esperando a
  aprovação dele.
- **O `check.sh` roda o teste de interface em paralelo: um processo por bloco, 4 por vez, e os blocos que medem tempo
  depois, um por vez** — a verificação levava ~16 min e roda uma vez por tarefa; ficou em ~8. Nenhum teste saiu nem
  ficou mais fraco: os 68 blocos rodados um a um registram as mesmas 1.277 medições da rodada antiga. Se errado: o
  `check.sh` volta ao jeito antigo trocando uma linha.
- **Bloco que falha de vez em quando em paralelo vai para a fase em série; não se afrouxa limite nem se repete o bloco
  sozinho** — repetir esconderia defeito de verdade. Se errado: a fase em série cresce e o ganho diminui.
- **A meta de ~5 min não fechou e ficou assim por ora** — chegar lá pede dividir o bloco `itens` e encurtar os blocos que
  medem tempo; é trabalho à parte. Se errado: 3 minutos a mais por verificação.
- **O implementador foi parado no meio (a interrupção de uma pergunta ao Vinicius parou o agente); o controlador revisou
  o que estava escrito, rodou as provas e commitou** — o código estava completo e a harness não deixa relançar agente sem
  o Vinicius pedir. Se errado: a revisão independente desta mudança não aconteceu; pode ser pedida depois.

## 2026-11-17 — Integração da frente de itens, loja e diária na `main` (decisão do Vinicius)
- **Integrar a `claude/itens-loja-diaria` na `main` antes de jogar** (resposta "1" ao menu de fechamento, com "continue o
  resto") — como nas frentes anteriores: o que ele achar jogando vira ajuste por cima da `main`. Feito por fast-forward
  (`ccc40de` → `3a73b63`), com o `check.sh` em OK na `main` já integrada; os artefatos oficiais foram republicados (jogo
  na versão 8, DEV na 6, wiki na 7). A lista "A confirmar com o Vinicius (gosto, itens)" do `ESTADO.md` continua aberta.
- **Ordem do que vem depois, confirmada por ele:** primeiro acelerar o teste de interface (a verificação completa subiu
  para ~16 min), depois o desenho dos ginásios.

## 2026-11-17 — Itens, mochila, loja e recompensa diária — decisões da execução (controlador)
Tudo abaixo é do controlador (nada foi decidido pelo Vinicius). Plano em `docs/superpowers/plans/2026-11-16-itens-loja-diaria.md`.
O que é gosto e espera a palavra dele está em `ESTADO.md` ("A confirmar com o Vinicius (gosto, itens)"). Cada linha:
decisão — motivo — custo se estiver errada. A decisão dele sobre o ritmo (testes da parte mexida na rodada de correção)
está na seção seguinte.
- **(controlador) Os torrões entram nos pontos para distribuir em todo lugar do jogo que conta esses pontos** — cada tela
  monta o cavalo do seu jeito, e a tarefa de uso conferiu uma por uma. Se errado: o Torrão não daria ponto em alguma tela.
- **(controlador) Dois grupos de testes mudaram o valor esperado, por consequência da spec:** os que fixavam o save na
  versão 6 (agora 7) e os que contam os pontos da barra de abas (agora esperam o ponto do Estábulo quando há prêmio, o caso
  de todo jogo novo). Não é afrouxar teste: são os valores novos. Se errado: nada.
- **(controlador) O teste antigo "o catálogo de itens das versões 1 a 3 não existe" virou dois com a mesma intenção**
  (nenhum item antigo existe; nenhum item novo tem bônus de status nem raridade), porque o catálogo novo usa o mesmo nome
  (`GameData.ITEMS`). Se errado: renomear o catálogo é uma busca e troca.
- **(controlador) O número que separa os sorteios de item dos outros sorteios da seed é `0x49540000`** — o do plano caía em
  cima dos sorteios de aprendizado por nível e de sala. Se errado: nada na tela.
- **(controlador) O wiki descreveu a loja e a diária antes de as telas existirem na branch**; no fim conferi o texto contra o
  jogo pronto e acertei o que faltava. Se errado: o wiki da branch ficou alguns commits à frente do jogo.
- **(controlador) O "pular dias" do modo DEV só existe no save de teste**; o build de produção falha se o nome aparecer no
  jogo. Se errado: nada na tela.
- **(controlador) Num save da versão 7, dado de dia ou de limite estragado nunca libera compra nem resgate:** vale "já
  resgatou hoje" e "limite do dia gasto". O save que vem da versão 6 começa zerado e com a diária liberada — "na dúvida, não
  libera". Se errado: um save estragado espera um dia (7, na Estrela) para comprar e resgatar.
- **(controlador) O limite do dia na loja se lê "Restam N de M hoje"** — "0 de 2 hoje" ao lado de "Limite de hoje" se lia
  como "comprei 0 de 2". Se errado: é um texto.
- **(controlador) A ordem da loja é fixa e vem do catálogo (Torrão, Manual, Cupom, Estrela), não do preço** — mudar um
  preço não pode embaralhar a loja. Se errado: uma lista de ordem a mais no catálogo.
- **(controlador) O botão fica "Mochila cheia" com 99, e a explicação de cada item é a linha de descrição do produto, sem
  botão ⓘ** — menos um toque. Se errado: o ⓘ é um padrão que já existe no jogo.
- **(controlador) O ícone da Rédea nova fica como está e vai para a lista de gosto** — os cinco ícones são desenho em
  código, sem créditos. Se errado: redesenhar um desenho de 16×16.
- **(controlador) A linha de autoria de cada commit é a da sessão que o fez:** os commits dos ajudantes (`90c5a2f`,
  `634173a`, `73954ec`, `76216c0` e o da onda final de correção) levam a linha que a sessão de cada um indica; os do
  controlador levam a dele. O histórico já enviado não é reescrito por isso — reescrever pede um envio forçado. Se errado:
  linhas de autoria diferentes na mesma branch.
- **(controlador) Com um uso de item aberto, o save que chega de outra aba não leva ao Estábulo:** a tela fica, é desenhada
  de novo e confere tudo outra vez — só assim o Confirmar pode recusar com o motivo. Se errado: voltar ao jeito antigo é
  uma linha.
- **(controlador) Os limites de altura do Estábulo com prêmio para resgatar valem em todos os dias do calendário,
  inclusive o 7º com a Estrela;** ficam de fora só o cartão com o resgate travado (mochila em 99 ou 999 Rédeas) e o cartão
  com os 7 dias abertos — são raros ou abertos pelo jogador, e o motivo tem de caber inteiro. Se errado: mais um caso de
  altura para apertar.
- **(controlador) No cartão grande da diária, o "N / 7" abre a linha do prêmio e o prêmio vai só em texto, sem ícone** — a
  360 px o ícone fazia o prêmio mais longo quebrar em 3 linhas e passar do limite de altura. Se errado: é o arranjo de um
  cartão; está na lista de gosto.
- **(controlador) Todas as frases velhas do GDD achadas na revisão final foram corrigidas, e só elas** (o pior caso de 146
  que virou 148 com os torrões; a barra de 5 abas; a parte de peças escondida na Loja; as estrelas que sobem com a Estrela
  de treino; o título e o aviso da seção 8; a 8.3; a fonte da Rédea na 8.5) — o GDD é a fonte da verdade e não podia dizer
  4 abas nem que a Rédea só vem da gaveta DEV. Se errado: frases de documento.
- **(controlador) O dia que vira com o jogo aberto atualiza a tela sem relógio rodando:** ao voltar à aba, ou no primeiro
  toque, se o dia mudou desde o último desenho, a tela é desenhada de novo (e esse toque não vale: o jogador vê a tela do
  dia novo e toca de novo). Nunca na corrida nem no resultado — antes, uma aba aberta de um dia para o outro mostrava o
  cartão de ontem e recusava a compra com um motivo falso. Se errado: um toque perdido na virada do dia; desfazer são
  poucas linhas.
- **(controlador) O relógio para trás é conferido registro a registro** (a diária pelo último resgate, a loja pela última
  compra, a Estrela pela última Estrela), como o plano definiu; em vez de amarrar a loja à diária, a frase dos documentos foi
  acertada — amarrar não fecharia nada que o relógio para a frente já não abra. Se errado: quem volta o relógio entre as
  duas datas compra o que compraria adiantando.
- **(controlador) Um dia ou limite estragado no progresso salvo é gravado já consertado ao abrir o jogo** — assim o
  bloqueio dura um dia, como a decisão do "dado de dia estragado" dizia; antes, ele se renovava a cada abertura até alguma
  ação gravar. Se errado: uma gravação a mais ao abrir um progresso estragado.
- **(controlador) O que a revisão final achou e não quebra regra fica registrado em `bugs.md`, sem conserto nesta frente**
  (o "Voltar" do aparelho com um item aberto pela Mochila, frases e conferências repetidas entre `game.js` e `itens.js`,
  esperas fixas no teste de interface e casos provados certos sem teste) — nenhum perde Ouro nem item. Se errado: cada um é
  um conserto pequeno depois.
- **(controlador) O teste do wiki que fixava "o pior caso fica em 146" passou a exigir 148 com os 10 torrões** — é o
  número que a revisão final mandou corrigir, não um teste afrouxado. Se errado: nada, é o valor novo.
- **(controlador) O que a revisão final viu e deixou de fora, por não ser desta frente, ficou assim:** andar o relógio dia
  a dia e o relógio adiantado por engano viraram frases nas pendências do relógio (`ESTADO.md`); abrir um jogo antigo sobre
  um progresso novo virou aviso no `ESTADO.md`; progresso adulterado e sorteio previsível para quem lê a seed só se fecham
  com o servidor; os números da economia são de partida, para o Vinicius ajustar jogando. Se errado: nada na tela.
- **(controlador) O `CLAUDE.md` ganhou o `itens.js` na lista dos módulos de regra, a regra dos sorteios de item na seção 8
  e os tempos reais da verificação** — são fatos da frente, tirados da spec aprovada; nenhum subagente mexeu no arquivo.
  Se errado: três linhas de instrução para acertar.
- **(controlador) A spec ganhou uma nota no fim da seção 9** dizendo que a tela também se atualiza ao voltar à aba ou no
  primeiro toque depois da virada do dia, e que o relógio para trás é conferido registro a registro — a spec aprovada
  dizia outra coisa nos dois pontos, e quem a ler depois precisa saber o que o jogo faz. Se errado: apagar a nota.
- **(controlador) Desfiz uma linha da onda final de correção em vez de abrir uma segunda onda:** ela passava a gravar
  "0 torrões" no potro logo depois do cruzamento (um campo que já vale 0 sem ela), e o teste antigo do cruzamento, que
  compara o registro do potro com o calculado pelas regras, falhou na verificação completa. Voltar ao que estava revisado
  foi a menor mudança; nenhum teste mudou (commit `fb10d22`). Se errado: o potro fica sem esse campo até o jogo ser
  reaberto, como era antes.

## 2026-11-17 — Ritmo do trabalho (decisão do Vinicius)
Ele perguntou por que às vezes demora. Causas medidas: o `check.sh` passou de ~6 para ~12 min (o teste de interface
cresceu a cada parte) e rodava inteiro em toda rodada de correção; cada tarefa passa por implementador, revisor e
correções; as tarefas rodam uma de cada vez; e a máquina da sessão reiniciou três vezes no dia.
- **Em rodada de correção rodam só os testes da parte mexida; o `check.sh` inteiro roda uma vez por tarefa e no fim da
  frente** — economiza ~12 min por rodada. Se errado: uma regressão de uma correção só aparece no check seguinte.
- **Depois da frente de itens, loja e diária: acelerar o teste de interface** (blocos em paralelo), para o `check.sh`
  voltar a ~5 min — vale para tudo que vier depois.
- **A revisão de cada tarefa continua** — tirar seria o maior ganho e o maior risco.

## 2026-11-16 — Itens, mochila, loja e recompensa diária (decisões do Vinicius)
Spec em `docs/superpowers/specs/2026-11-16-itens-loja-diaria-design.md` (aprovada por ele); branch `claude/itens-loja-diaria`.
- **A primeira entrega junta itens, mochila, loja e recompensa diária; os ginásios vêm depois, em desenho próprio** — um
  ciclo completo (ganha, compra, guarda, usa), e os ginásios usam os itens como prêmio.
- **Entram os cinco itens do GDD §8.2** (Torrão de açúcar, Estrela de treino, Rédea nova, Cupom de troca de skill, Manual
  de doma) — já estavam aprovados desde 2026-11-10.
- **Só Ouro; a Gema e a loja de Gemas ficam para o bloco próprio** — a Gema ainda não existe no jogo.
- **Diária em calendário de 7 dias, prêmios fixos, que não zera ao faltar um dia, resgatada só de abrir o jogo** —
  prende sem frustrar; sem sorteio.
- **Telas: Loja como 5ª aba (Comprar e Mochila), cartão da diária no topo do Estábulo, item também na ficha do cavalo**
  — escolhida entre três esboços.
- **Manual de doma: tentativa na hora, com chance alta** (35% nos números de partida) — resposta imediata; muda a forma
  do GDD, que dizia "aumenta a chance de aprender".
- **Estrela de treino: na loja, cara e 1 por semana; também no 7º dia a cada 4 calendários** — o grande gasto de Ouro.

## 2026-11-16 — Itens, loja e diária: decisões da spec (controlador)
Ficam na seção 17 da spec; o Vinicius as leu na aprovação e pode trocar qualquer uma.
- **Números de partida:** Torrão 120 de Ouro (2 por dia, até 10 por cavalo), Manual 200 (1 por dia), Cupom 250 (1 por
  dia), Estrela 2.000 (1 a cada 7 dias); diária 60 · Torrão · 100 · Manual · 150 · Cupom · 200 + Rédea. Motivo: o Ouro
  quase não entra hoje (o jogador mediano perde 10% da entrada por corrida), então a diária (510 por calendário) é a
  fonte; a primeira Estrela comprada só com ela sai em cerca de 28 dias. Se errado: são números num só lugar do `data.js`.
- **A Rédea nova não vai à loja; vem no 7º dia da diária** — o GDD diz "nunca por Ouro".
- **Com a sala aberta, Cupom e Manual ficam bloqueados no cavalo ativo; Torrão e Estrela não** — os dois primeiros
  mudam as skills, e a corrida já sorteada usa o cavalo como ele está; os outros só dão pontos, que já têm trava.
- **A estrela ganha por item vale para a cruza, e a skill vinda de item vale na herança** — uma estrela é uma estrela;
  não mexe no `breed.js`. Se errado: campo à parte para a estrela de treino.
- **O Cupom troca qualquer skill das vagas** — o save não guarda a origem da skill.
- **O Estábulo de 3 cavalos deixa de caber numa tela** (40 px a mais com a diária resgatada, 110 com prêmio).
- **Relógio do aparelho:** voltar a data não libera resgate; adiantar libera, aceito até existir servidor.
- **Proteção contra save de versão mais nova entra nesta frente** (bloqueio com o botão Recarregar), porque o save sobe
  para a versão 7.
- **Regras num módulo próprio (`itens.js`)**, puro, para ir ao servidor com os outros; **ícones dos itens desenhados em
  código**, sem créditos.

## 2026-11-16 — Galope fica como está (decisão do Vinicius)
- **O galope dos cavalos não muda por enquanto** — ele pediu um teste de pernas mais intensas e abertas, viu a página
  de comparação (https://claude.ai/artifact/JUTm5mf3SwbvgDENeVAEeA) e preferiu seguir para passos mais importantes. O
  teste mostrou ganho moderado com os quadros de hoje; ir além pede quadros novos (2c, com créditos). Medidas e receita em
  `docs/memoria/sistemas/galope.md`.
- **Próximas frentes pedidas por ele no mesmo dia:** recompensa diária, loja, inventário de itens e começo dos ginásios,
  na frente da preparação com relógio e do empacotamento (ordem do GDD §8.7).

## 2026-11-16 — Integração da frente de interface da Visuais 2 na `main` (decisão do Vinicius)
- **A `claude/visuais-2` (3a, 3b e 3c) entrou na `main` antes do teste no artefato** — escolha do Vinicius depois da
  revisão final limpa da 3c e do `check.sh` OK; depois da 3a e da 3b ele tinha preferido manter o branch para jogar antes.
  As listas "A confirmar com o Vinicius (gosto, 3a)", "(gosto, 3b)" e "(gosto, 3c)" do `ESTADO.md` continuam abertas e
  viram ajustes por cima da `main`. Integração por fast-forward, com o `check.sh` OK em cima da `main` já integrada; jogo,
  DEV e wiki republicados com esse build (e9460f4).

## 2026-11-16 — Visuais 2, parte 3c: tela da corrida (decisões do Vinicius)
Spec em `docs/superpowers/specs/2026-11-15-tela-da-corrida-design.md` (aprovada por ele).
- **Faixa de ordem embaixo da pista** — todos os corredores em ordem e o nome de quem está logo à frente e logo atrás; não
  cobre a pista e mostra quem saiu da tela.
- **Dado da Sorte: faixa grande com o resultado na pista e os números na faixa de ordem** — sai a faixa de números a decifrar.
- **Chegada: faixa com o lugar do jogador; resultado numa tela, com as abas Chegada e Momentos.**
- **Pódio: só o 1º lugar maior, no centro** — os três maiores não cabem lado a lado a 360 px.
- Do controlador, na revisão da spec (o revisor mediu o jogo): em tela baixa (< 700 px de altura) a faixa de ordem tem uma
  linha, a narração uma frase em uma linha e o número do Dado toma o lugar da posição; as três frases de enfeite embaixo da
  manchete do resultado saem (fica a que explica o pódio sem prêmio); a tabela "Ordem de chegada" passa a 2 linhas de texto
  por corredor; "resultado numa tela" vale para o caso sem aviso de nível, skill ou Ouro.

## 2026-11-16 — Visuais 2, parte 3c: decisões da execução (controlador)
Tudo abaixo é do controlador (nada foi decidido pelo Vinicius). Plano em `docs/superpowers/plans/2026-11-16-tela-da-corrida.md`.
O que é gosto e espera a palavra dele está em `ESTADO.md` ("A confirmar com o Vinicius (gosto, 3c)").
- **(controlador) A faixa "CLIMA: X" que aparecia depois do Dado saiu** — a faixa nova do Dado já diz o efeito no clima;
  ficam o clarão leve da virada, o clima no painel do topo e o aviso para o leitor de tela. Se errado: sobra uma variável parada no código, que a revisão pega.
- **(controlador) Os itens da faixa de ordem não mostram o nome do cavalo, nem em tela larga** (a spec deixava a escolha) —
  a linha dos vizinhos, logo embaixo, já traz os nomes. Se errado: acrescentar o nome é uma mudança pequena.
- **(controlador) Em paisagem (altura até 500 px) a faixa de ordem fica na linha dos controles** e não soma altura à tela —
  se errado: a faixa fica apertada ao lado dos controles.
- **(controlador) O estouro antigo em paisagem com 7 ou 8 corredores não se corrige na 3c** (os controles saem da janela; já
  era assim antes, e a faixa de ordem não piora) — mexer nisso é mexer no desenho da pista, e a 3c mira o celular em pé.
  Custo: quem joga deitado com sala cheia continua rolando para ver os controles. Fica como pendência no `ESTADO.md`.
- **(controlador) Distância que arredonda a 0 vira "colado"** na linha dos vizinhos ("À frente: Ipê colado") — "+0 m" lia
  como defeito. Se errado: é uma palavra.
- **(controlador) O Dado guarda o suspense até os dados pararem:** enquanto giram, a faixa grande mostra só o dado e "DADO DA
  SORTE", centralizados e grandes, e a faixa de ordem fica sem números; o vencedor, os números, a frase da narração (a do Dado
  e a da virada de clima que ele causa), o clima do painel, o clarão e o aviso para o leitor de tela aparecem juntos, na
  revelação. Com movimento reduzido nada espera. A chuva e a névoa desenhadas na pista também esperam (decisão seguinte) —
  nada na tela pode adiantar o que a pista ainda não mostrou. Custo se errado: por ~1 s a faixa mostra um título no lugar do
  resultado, e a narração do Dado chega ~1 s depois do instante do evento.
- **(controlador) A chuva e a névoa desenhadas na pista também esperam a revelação do Dado** (emenda a anterior, que as deixava
  seguir a simulação): a pista desenha o clima mostrado, o mesmo do painel; a velocidade dos cavalos continua a da simulação,
  que já conta o clima novo — começar a chover com o título "DADO DA SORTE" ainda girando entregava o resultado que a faixa e
  a narração guardam. Custo se errado: durante um Dado, o enfeite do clima atrasa ~1 s em relação à simulação.
- **(controlador) O bloco "menu" do teste de interface fixa o `seedBase` do save novo** — as capturas oficiais 03, 04, 10 e 11
  (saldo e XP depois de uma corrida) saíam de um sorteio a cada rodada, e o CLAUDE.md §4 pede que as capturas oficiais só
  mudem quando a interface muda. Custo se errado: essas quatro capturas ficam presas a uma seed.
- **(controlador) A `final-10-expedicao.png` continua mudando a cada rodada pelos quadros de animação dos retratos** (faíscas
  e "idle" no relógio real); não se congela na 3c — a seed fixa mirava o saldo e o XP, que pararam de mudar, e congelar a
  animação muda a aparência da captura ou pede um gancho novo. Custo se errado: quem regravar as capturas vê essa mudar sem
  a interface ter mudado (anotado nas pendências do `ESTADO.md`).
- **(controlador) A falha intermitente do bloco "resultado" do teste de interface foi corrigida na mesma onda** — um
  `check.sh` que falha de vez em quando deixa de valer como verificação. A causa era o `seedBase` sorteado do perfil DEV
  novo: a skill aprendida ao subir de nível sai dele, e com uma skill a mais a sala da seed 12 mudava; o bloco agora fixa o
  `seedBase` e só larga com a sala da seed armada. Custo se errado: 10 minutos de teste a mais nesta onda.
- **(controlador) A faixa do Dado e a faixa do lugar ficam em cima, logo abaixo do painel; quando ali cobririam o cavalo do
  jogador, vão para o pé da pista** (sobre o gramado e a cerca). A posição é escolhida uma vez por Dado (e na chegada, quando
  o jogador cruza a linha) e não muda enquanto a faixa está na tela, só se a tela for redimensionada; as duas faixas nunca
  se sobrepõem. A faixa pode cobrir o alto de um rival na raia 1, nunca o cavalo do jogador — o cavalo da raia 1 sobe acima
  do próprio painel, então nenhuma posição em cima o livra. Custo: com o jogador nas raias de cima, as faixas aparecem
  embaixo, longe do painel.
- **(controlador) "VOCÊ TIROU N" fica na mesma linha da frase do clima quando cabe** — a faixa ocupa menos pista.
- **(controlador) A faixa do lugar, do 4º para baixo, usa o creme do texto do painel** (a spec dizia "a cor do painel", que é
  a do fundo da faixa). Se errado: é uma cor.
- **(controlador) Na tabela da chegada, a linha de baixo (dono · nível · skills) só quebra entre os pedaços** — "Nv 14" e
  "skills 46%" nunca se partem; a 360 px pode ocupar duas linhas, e a linha da tabela continua com até 70 px. Cortar o nome
  do dono com reticências esconderia dado. Se errado: é uma regra de CSS.
- **(controlador) O fim da corrida espera a faixa do lugar sumir (2,5 s) antes de ir ao resultado; "Pular" continua
  imediato** (proposta do executor, aceita na revisão) — sem isso, quem chega em último via a faixa só ~1,5 s.
- **(controlador) Código:** `FX.stripOrder`, da faixa de números antiga, saiu junto com os testes dele (nada no jogo o usava;
  volta do git se precisar); `FX.nomeEmLinhas` devolve o nome em maiúsculas, porque a fonte desenhada na pista só tem
  maiúsculas (nada muda na tela); o rodapé dos commits do plano é o da sessão.

## 2026-11-15 — Visuais 2, parte 3b: decisões da execução (controlador)
Tudo abaixo é do controlador (nada foi decidido pelo Vinicius).
- **(controlador) Meta do Status: documento ≤ 1.470 px** (medido ~1.455: 1.450 a 1.457 conforme a densidade) (a conversa dizia ~1.100, a spec 1.200) — a cabeça com o retrato grande se
  repete em cima e a spec §2 manda a §5 vencer. Meta nova: com as abas no topo, as 7 linhas de status inteiras visíveis (169–583 px;
  `.app-abas` em 724). O Status caiu de 1.902 para ~1.455 px (−24%).
- **(controlador) "Poder A → B" do rascunho na barra presa, não no topo** — a lista não pula sob o dedo no 1º toque.
- **(controlador) Barra presa:** por ~400 ms ao aparecer não pega toque (o 2º toque rápido cai no +N de baixo, não em
  Desfazer/Confirmar); por ~400 ms depois do 1º toque no Confirmar os botões dela não pegam toque (o toque duplo não grava sem
  ler o aviso). Teclado não é afetado; o foco de teclado nunca fica atrás da barra.
- **(controlador) "Genética" no topo da aba Status**, ao lado dos pontos; o custo "·N" fica embaixo do valor, na mesma linha do grid.
- **(controlador) Estábulo: linha de 3 linhas de texto** (nome / raridade + estrelas / tipo + Poder), ~96 px (a spec dizia ~88);
  selo "Ativa" como plaquinha na borda de cima; a ordem nunca muda.
- **(controlador) `history.scrollRestoration = 'manual'` no jogo todo** — o Voltar devolve o foco e a rolagem à linha do cavalo;
  um reload abre no topo, como o boot já fazia.
- **(controlador) Ficha:** retrato grande na escala 6 (as abas cabem com 97 px de folga); "+N" no canto de baixo à direita (em
  cima cobria a cabeça); "Tornar ativa" some na ativa (o texto "Esta já é a montaria ativa." saiu) e fica dourado nas outras;
  trocar de aba fecha o campo de renomear e a confirmação de liberar, como o rascunho; rótulos "Sexo:", "Cruzas restantes: N",
  "Pais:".
- **(controlador) Pais reconhecidos pelo `uid`** ("(fora do estábulo)" com uid nulo ou fora do estábulo, mesmo com nome igual ao
  de um cavalo presente).
- **(controlador) Motivo no toque:** `aria-disabled` nos 7 botões das telas da 3b; região viva `#motivo-vivo` fora da tela para o
  leitor anunciar; Liberar e Tornar ativa recusam já no clique.
- **(controlador) Ordinal com ".sr º" em todo o jogo, menos na faixa de eventos da corrida** (o .sr ali causava rolagem lateral; o
  anúncio do jogador já vai pelo `#anuncio`) — rever na 3c.
- **(controlador) Pendências para a onda final / depois:** nome acessível da linha do Estábulo sem o "+N"; contorno da plaquinha
  "Ativa" nas cores forçadas; Corcel na linha "Sexo:" e "+N" do retrato grande sem contexto para o leitor de tela.

## 2026-11-15 — Visuais 2, parte 3b: Estábulo e montaria no celular (decisões do Vinicius)
Spec em `docs/superpowers/specs/2026-11-15-estabulo-montaria-celular-design.md` (aprovada por ele).
- **Aba Status em linha única com +1/+5/+10** — um toque soma, como hoje; a aba cai de 1.940 para até 1.200 px a 360 px.
- **Estábulo em lista de linhas; "Tornar ativa" só na ficha** — cerca de 6 cavalos por tela; tocar na linha abre a ficha.
- **Ficha com retrato grande e uma 3ª aba "Ficha"** (ações, porte, marcas, cruzas, pais) — o cavalo em destaque e as abas
  na primeira tela.
- Do controlador, na revisão da spec: meta do Status 1.200 px (não 1.100: a cabeça com o retrato grande se repete); se
  retrato e abas brigarem, as abas vencem; barra do Confirmar = a `.barra-acao` sticky de hoje; o motivo de botão
  indisponível aparece abaixo do grupo dele, um por vez; pais reconhecidos pelo `uid`.

## 2026-11-14 — Visuais 2, parte 3 (interface): divisão e 3a (controlador, sob delegação)
O Vinicius pediu "Decida sozinho a divisão e pode começar". Spec em `docs/superpowers/specs/2026-11-14-interface-acabamento-design.md`.
- **Parte 3 em três: 3a acabamento, 3b estábulo e montaria no celular, 3c tela da corrida** — o acabamento define as peças
  que as outras usam; a 3b mexe nas telas que o 1b reescreveu (as mais compridas); a corrida é a mais independente.
  "Celular" vira regra das três (spec 3a §7), e a 3b é a que corta rolagem.
- **Acabamento em camadas: linhas por sombra do CSS e peças pequenas de pixel (rebites, pregos, veio, ⓘ) por cima** —
  num teste descartável, molduras inteiras por `border-image` mostraram linhas nas emendas na densidade 2,625 (comum em
  Android), mesmo com bordas em múltiplos de 8 px; as camadas ficaram nítidas. Um kit do PixelLab gastaria créditos e
  teria o mesmo problema das emendas.
- **Peças de pixel feitas à mão em mapas de texto, com as cores dos tokens do `game.css`** — sem IA, sem custo, e a paleta
  não diverge.
- **Fontes dentro do jogo (subconjunto latino, OFL), com o Google Fonts de reserva** — o app Android sem rede cairia na
  fonte do sistema.
- **Press Start 2P só em 8, 16 ou 24 px** — 12 regras usavam 11–12 px (e 5 outras o teste achou a mais) e borravam a
  fonte. Destino: foram para **16 px** `.status .valor` (já estava), `.poder b`, o saldo do cabeçalho (`.app-topo .ouro` e
  `.pedras`), `.montaria-cabeca .titulo small`, `.montaria .cavalo-nome small` e `.nota-genetica`; foram para a **Jersey 10**
  (`--t-s`, `--t-m` ou o tamanho em volta) `.nivel`, `.build-topo .pontos-livres`, `.build-nome`, `.build-mais`,
  `.inicial .contador`, `.badge-ativa`, `.tag-voce`, `.levelup b`, `.status dt`, `.selo-nivel`, `.pontos-livres--selo`,
  `.raia--mini` e `.ajuda`. Regra de escolha: número ou letra curta fica em 16 px; frase, rótulo ou selo que quebraria ou
  cobriria o retrato vai para a Jersey.
- **Folha da interface publicada para o Vinicius depois da Tarefa 3, e não antes** — publicada com as telas já mudadas
  (na branch `claude/visuais-2`) e republicada depois da Tarefa 5, sem esperar resposta. Antes da T3 a folha mostraria o
  visual antigo, e a branch ainda não está na `main`. Links: folha https://claude.ai/artifact/YF8h6twHtSK6SRpvnC2UoR
  (versão 3, a final) e build de teste https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch (versão 9, a final). O gosto é dele; se ele quiser
  outro rumo, a execução para.
- **Trabalho na `claude/visuais-2`, avançada até a `main`** — é a branch da frente visual que ele pediu em 2026-11-12.
- **Decisões da execução da 3a (controlador, sob delegação):**
  - **`.chip` sem `clip-path`** — o ⓘ dentro do chip tem alvo de 44 px, maior que o chip; o corte recortaria o alvo de toque (desvio da spec §4.10). O chip fica só com o contorno e o bisel por sombra.
  - **O botão apertado desce 2 px também com movimento reduzido** (saiu o `mov-reduzido` do apertado) — como pede a spec §7: é feedback de toque, não animação.
  - **Mapa do ⓘ redesenhado** — o da Tarefa 1 lia como "H" em 14 px.
  - **Barra de abas com uma coluna por aba** — antes eram 5 colunas fixas para 4 abas (a Loja está suspensa), e com as abas em botão a 5ª aparecia como um buraco.
  - **A velocidade escolhida da corrida (ouro) segue a mesma receita do botão ouro** — apertada desce 2 px e a sombra encolhe; desabilitada fica com o bisel escuro também no topo (o seletor dela vencia `.btn:active` e `.btn:disabled`; corrigido na Tarefa 5, com checagem no `ui-test`).
  - **`.montaria--ativa` no lugar de `.caixa--destaque`** (spec §4.2) — a classe já marca o lugar e evita mexer no markup.
  - **A folha da interface não simula o modo de cores forçadas** — simular repetiria as regras do `@media`; o `ui-test` emula o modo de verdade (`forcedColors`).
  - **Retrato em linha anda 4px para a direita (revisão final):** a moldura de madeira do retrato avança 6px e encostava no rebite do canto (4–10px) no cartão da Montaria ativa e na cabeça da Montaria em tela larga; `.cavalo-cabeca > .retrato` ganhou `margin: 0 -4px 0 4px` (o texto fica onde estava, altura igual) e em tela estreita (coluna) volta a `0`. Correr segue em 834px (limite 834).
  - **Ponto de aviso da aba Correr** a `top: 2px` (ficava no bisel claro). **Teste de altura** ganhou Correr (802, medida na `main` 7fe5124) e Skills da ativa (1145): limite 1,04 vezes cada.
  - **Os estados de demonstração da folha (`.foco-demo`, `.apertado-demo`) entram como seletores extras** nas mesmas regras de `:focus-visible` e `:active`, sem regra copiada.

## 2026-11-14 — Integração dos blocos 1 e 1b na `main` (decisão do Vinicius)
- **A `claude/cavalos-v3` entrou na `main` antes do teste no artefato** — escolha do Vinicius depois da revisão final
  limpa e do `check.sh` OK; o plano era jogar antes. Os pontos de calibração do 1b (spec §15, lista no `ESTADO.md`)
  continuam abertos e viram ajustes por cima da `main`. A `claude/visuais-2` já estava contida e também sai da lista.

## 2026-11-13 — Decisões delegadas pelo Vinicius ("Prossiga, decida sozinho o melhor para o jogo")
- **Spec do bloco 1b (crescimento livre) aprovada como está** — é o próximo passo do roteiro (antes de integrar o bloco 1
  na `main` e antes da parte 3 da Visuais 2, que mexe nas mesmas telas). Ficam valendo as escolhas da spec que estavam
  para a revisão dele: skill de tipo que multiplica os dois status do tipo; Loja e Equipamento escondidos com as peças
  guardadas; Pedra Negra do pódio parada; a ativa não redistribui com páreo aberto; Rédea nova só pela gaveta DEV até os
  ginásios; aviso único da migração; +5/+10 somam exatamente N ou ficam desabilitados.
- **A equilibrada continua a build mais forte (spec 1b §15)** — mudar a regra (custo que para de subir, bônus por
  concentrar) fica para depois de o Vinicius jogar; o bot e o "Distribuir sugerido" são a equilibrada com leve
  inclinação no tipo.
- **O jóquei do jogador continua o mesmo ao "Recomeçar com outro inicial"** — é a identidade do jogador (escolha do
  Perfil), como a opção de animações; entra junto com o bloco 1b, que já mexe no `game.js`.
- **Ícones: selo de liga só onde a liga já aparece; medalhão de raridade nas peças fica para quando o equipamento voltar**
  — com o 1b o equipamento fica suspenso e as telas de peças somem.
- **Parte 2c (animações) espera a confirmação de créditos do Vinicius** — o `CLAUDE.md` exige confirmação explícita para
  geração paga; o 1b não gasta nada.
- **Execução do 1b (controlador, sob delegação; decisões de design; o detalhe está no ledger e na spec):**
  - **Os grupos +1/+5/+10 e o "Distribuir sugerido" somem quando nenhum ponto cabe** (nível 1, ou o que sobra não paga o próximo
    ponto de nenhum status); ficam desabilitados, com o motivo, só quando algum N cabe e outro não — entre um nível e outro o
    estado "tudo cinza" seria o normal, e 18 rótulos "indisponível" atrapalham o leitor de tela. Spec §11 emendada.
  - **O selo do Estábulo mostra o orçamento de pontos** ("sobram X", o mesmo número do topo da aba Status) enquanto algum ponto
    cabe; antes contava pontos de status, número que divergia do topo.
  - **A sala aberta migrada para a v6 mantém seed, mapa, nomes, ordem e sedas, mas os bots podem mudar de nível** — a spec manda
    recalcular o Poder da sala pela regra do retrato (R16); acontece uma vez, só para quem migra com páreo aberto.
  - **A skill de tipo mostra dois números quando os ganhos dos dois status diferem** (por exemplo Velocidade +12, Aceleração +9).
  - **Sala e "Distribuir sugerido" não re-sorteiam nada:** o teste do bloco build continua conferindo os rivais da sala, por ser regra do `CLAUDE.md` §8.
  - **O texto do custo diz "sobe a cada 10 pontos no mesmo status"**, tirado do `costStep` do código (o wiki-test confere), e não "cada ponto custa mais que o anterior".

## 2026-11-13 — Portes (parte 2b): revisão final, decisões do Vinicius
Correções em `prototype/src/sprites.js` (`corBrilho`) e `prototype/tools/moldes-test.mjs` (`formaComAceitos`); specs da 2a (§3, §5) e da 2b (§4, §6) emendadas. A escala dos retratos, também decidida aqui, está na seção abaixo.
- **O brilho das raridades foi corrigido na 2b: a cor se ajusta ao contraste com a crina — decisão do Vinicius** — a cor clareada fixa sumia em 14 combinações do catálogo (a pior, Mágico na crina laranja do Tição, 0,005 de luminância). O brilho é um reflexo claro: a clareada de 35% fica sempre que já muda a luminância da crina em 0,05 no alfa de pico; só onde não muda, vale a clareada ou a escurecida, a de maior diferença, indo até 65% se nenhuma chega a 0,05. As 60 combinações do catálogo ficam ≥ 0,05 (a menor, Lendário na crina da Faísca, 0,052, na clareada): 46 seguem na clareada como na 2a, 13 passam à escurecida e o Mítico no Mandacaru, à clareada de 45%. O matiz continua o da raridade e o rastro do Mítico segue na clareada. (A 1ª versão desta correção usava sempre a de maior diferença, e 46 das 60 viravam faixa escura; ajustada no mesmo dia: o pedido era consertar onde o brilho sumia, não escurecer o que já aparecia.)
- **Meias que se juntam ou se partem (5 de 24 retratos/parados) e a zona da cara que pulsa no galope (5 moldes) ficam para a 2c — decisão do Vinicius** — a 2c refaz as animações de todos os portes; até lá seguem medidas no `moldes-test` (`PENDENTES_2A`), sem afrouxar regra.
- **Aceitos pelo Vinicius: o retrato do robusto-folhas com 3 pernas e as 5 frestas de 1 px entre cauda e anca no parado do robusto-ondas** — escolha dele na revisão final, com o valor medido fixado em `ACEITOS_NA_FOLHA`; as frestas estavam escondidas atrás do "fora da paleta" aceito na folha (o teste da forma só olhava o 1º defeito) e agora o teste revalida com o defeito aceito neutralizado.

## 2026-11-13 — Portes (parte 2b): decisões da execução
Detalhes das gerações em `docs/memoria/assets.md`; spec em `docs/superpowers/specs/2026-11-13-cavalos-portes-design.md`.
- **Mestres aprovados na folha com o esguio parado e o robusto aceitos como estão** — o esguio parado (seed 3101) mostra 2 pernas e o robusto guiado reprova em proporção e forma, mas ambos leem bem na folha; refazer gastaria mais sem ganho visível.
- **Robusto gerado guiado pelo mestre padrão** — pedido sozinho, o robusto saiu quase igual ao padrão (proporções contra o padrão de 0,965 a 1,075 nas tentativas escolhidas das duas rodadas sem guia, seeds 3103 e 4103); partir do padrão aprovado separa o corpo. O robusto aceito é o guiado pelo padrão (refação 2), que pela medida automática saiu 1,056 (altura) e 0,817 (espessura) contra o padrão, reprovado, e foi aceito na folha.
- **Teto do lote subiu de 90 para 130 e depois 170, por decisão do Vinicius** — a refação dos mestres, o piloto e as 7 versões restantes passaram do previsto; cada subida foi confirmada antes de gastar. **Total: 155 gerações.**
- **Versões de padrão e robusto partem do mestre (`init_image`); as do esguio saem sem guia** — no piloto o esguio com guia não manteve o corpo do mestre (focinho 10 a 13 px fora), então o esguio perde a garantia de "mesmo corpo" entre elementos.
- **A classificação das cores foi corrigida offline, sem gastar, em duas rodadas** — seda que pintava o corpo no galope; crina e jóquei do robusto (cores naturais no cru, achadas pela forma); capacete separado por contorno vira seda; canela e focinho do robusto classificados como crina voltam à pelagem-sombra e ao detalhe.
- **A escala dos retratos sai do molde mais alto dos 12 e todos os portes descem juntos — decisão do Vinicius (2026-11-13, na revisão final)** — os 3 portes ficam proporcionais no cartão em qualquer zoom; decidir o passo por molde deixava o robusto (o retrato mais alto) menor que o padrão, e tolerar mais corte cortaria a cabeça do robusto (14% em k = 4). Com zoom de 125% (k = 4), todos ficam um passo menores que antes da 2b, o padrão também; a spec §4 (que pedia o padrão do tamanho de hoje) foi emendada.

## 2026-11-13 — Portes: classificação das cores corrigida sem gastar (tarefa 6a)
Código em `prototype/tools/moldes-lib.mjs` (`corrigirGrupo`, com o diagnóstico nos comentários) e `--manter-escolhas` no `pixellab-portes.mjs`; crus e escolhas de antes no commit 8037a97.
- **A sombra roxa escura da pelagem (314–330°, muito saturada) volta à pelagem quando encosta mais nela do que no jóquei, decidida por cor no grupo de quadros** — a faixa magenta é da sombra da seda; numa pelagem carmim ou castanho-arroxeada ela pintava o corpo com a cor da seda no galope (padrao-ondas, robusto-ondas, robusto-folhas).
- **Cru de cores naturais (grupo sem nenhum pixel da família crina): crina e cauda achadas pela forma (manchas escuras grossas presas no alto do cavalo) e seda que caiu na família da pelagem devolvida ao jóquei** — o robusto guiado pelo padrão com força 35 saiu com cores naturais (crina preta, às vezes da cor do contorno) e as versões herdaram pelo init_image; só cor não separa.
- **`--reprocessar --manter-escolhas`: reprocessa sem trocar o desenho já visto na folha** — com a classificação nova, outras seeds passaram a passar (esguio-folhas, robusto-chamas e robusto-ondas trocariam de parado); a etapa grava a seed que seria escolhida (`mantida`), para o Vinicius decidir.
- **A regra "laranja (25–38°) conta como fora da paleta, máx. 2%" não mudou** — é o que ainda reprova a forma do padrao-ondas e de parte dos robustos (sombra laranja da seda e da manta no cru); mudar é decisão de desenho.

## 2026-11-13 — Visuais 2, parte 2b (portes): desenho
Conversa com o Vinicius. Spec em `docs/superpowers/specs/2026-11-13-cavalos-portes-design.md`, aguardando a revisão dele.
- **O porte é um gene herdado, como as marcas (só aparência)** — escolha do Vinicius; dá mais variedade e não amarra a cara do cavalo ao balanceamento (a outra opção era o porte sair da genética de status).
- **Três portes inspirados em raças brasileiras: esguio, padrão e robusto, iguais nos três elementos** — dito pelo Vinicius; o cruzamento mistura elementos, então o gene precisa valer em qualquer um.
- **O padrão também é gerado de novo (9 desenhos novos, os de hoje saem)** — escolha do Vinicius; os três portes saem com a mesma receita, todos com as 4 pernas separadas (fecha o limite das meias) e cada elemento com a sua crina no galope.
- **Um corpo-mestre por porte, com as versões de Fogo, Água e Grama partindo dele** — escolha do Vinicius; garante o mesmo corpo do porte em qualquer elemento e barateia as refações.
- **Galope: ≥ 2 pernas em todo quadro** (sai o "≥ 3 em todo quadro e 4 em pelo menos 5 dos 9"; retrato e parado seguem com 4) — na vista de lado as pernas se cruzam no galope; os galopes dos mestres parecem bons e reprovavam só por isso; decidido pelo Vinicius na folha dos mestres.

## 2026-11-13 — Visuais 2, parte 2a pronta (marcas, jóquei e raridade)
Regra em `docs/GDD.md` §6; números no wiki (seção "Marcas e jóquei").
- **As zonas de cara e pernas são calculadas pelas regras de `prototype/src/marcas.js` (cara: raio de 0,19 × largura útil a partir do focinho, cortado em `nose.y + 1`; pernas: componentes 4-conexas partidas no vão entre cascos)** — as regras da spec original falhavam nos moldes reais: na cara, a zona derivava no galope e pegava o pescoço; nas pernas, os grupos de colunas juntavam pernas vizinhas.
- **O brilho da crina usa a cor da raridade clareada (a mesma do rastro do Mítico)** — o verde do Mágico sumia na crina verde dos cavalos de Grama (Capim, Mandacaru); a luminância do brilho sobre a crina passou de 0,034–0,041 para 0,061–0,064. (Substituída na 2b: a cor passou a se ajustar ao contraste com a crina.)
- **O limite das 3 e 4 meias (pernas encostadas contam como uma, 2 a 4 pernas por quadro) fica aceito até os moldes da 2b** — não mexer no código das pernas agora; os moldes novos separam as 4 pernas e ganham teste de contagem de meias.
- **Os 15 cavalos do catálogo têm marcas fixas, e o rival da sala usa as do modelo dele** — o mesmo cavalo tem a mesma cara em qualquer corrida; só o jóquei do rival varia, pela seed da sala.
- **Cavalo sem marcas válidas (save antigo, alugado) vale pelas do modelo do catálogo, ou pelas calculadas do identificador** — nunca muda de aparência entre sessões e o save não precisa de versão nova.
- **A raridade é um efeito por cima do cavalo (brilho na crina, faíscas, rastro), não pintura no molde** — não multiplica os moldes recoloridos e liga e desliga com movimento reduzido.
- **A ficha e o Haras mostram "Marcas: …" (só o que existe, ou "Marcas: nenhuma")** — o jogador escolhe reprodutores sabendo o que o potro pode herdar.

## 2026-11-12 — Visuais 2, parte 2 (cavalos): divisão e desenho da 2a
Spec da 2a em `docs/superpowers/specs/2026-11-12-cavalos-marcas-design.md`.
- **Cavalos em três subpartes: 2a em código (marcas, jóquei, raridade), 2b portes no PixelLab, 2c animações** — o que é grátis primeiro; as animações saem uma vez só, para todos os portes.
- **Cada porte novo traz a sua crina e cauda** — crina separada do porte multiplicaria as gerações.
- **Jóquei é do jogador, escolha livre no Perfil, vale para todos os cavalos; bots sorteiam pela seed da sala** — identidade do jogador; a cor da seda continua mostrando a raia.
- **Marcas em três genes (cara, patas, corpo), herdados de um dos pais pela seed, 10% de mutação; só aparência** — muitas combinações com regra simples.
- **Raridade em escada (Mágico brilho na crina → Mítico com rastro), sem usar o contorno da skill** — o contorno já significa skill ativa.
- **Marcas por zonas calculadas no molde, não por máscaras à mão nem pelo PixelLab** — sem créditos e funciona sozinho para os portes da 2b.

## 2026-11-12 — Visuais 2: ícones, cavalos e interface (branch `claude/visuais-2`)
Conversa com o Vinicius. Spec da parte 1 em `docs/superpowers/specs/2026-11-12-icones-design.md`.
- **Três partes, cada uma com spec, plano e execução: ícones, cavalos, interface** — o pedido inteiro era grande demais para uma spec; os ícones são os mais baratos e independentes.
- **Interface por último, depois do bloco 1b implementado** — mexe nas mesmas telas (Status, Skills) que o 1b muda.
- **Branch criada da `claude/cavalos-v3`** — a frente visual entra depois do bloco 1; da `main`, daria conflito no `game.js` e no `fx.js`.
- **Cavalos novos para variedade entre cavalos, raridade visível e animações novas** — escolha do Vinicius; os retratos maiores ficaram de fora.
- **58 ícones com a mesma receita dos 16 de hoje; folha aprovada pelo Vinicius antes de entrar nas telas; teto de 100 gerações da cota** — a receita já foi testada e combina com o que existe.
- **Cada ginásio tem o foco num elemento (Fogo, Água, Grama); as insígnias seguem esse foco** — dito pelo Vinicius; vale para o desenho dos ginásios.
- **Refação dos ícones começa pela descrição (cor por extenso), não pela seed** — o PixelLab ignorava a cor do tema.
- **Estrela vazia em cinza-claro (#a9b5ae), não cinza-escuro** — sumia no painel.

## 2026-11-12 — crescimento livre: rodadas 2 e 3 da calibração (a revisar na spec)
O Vinicius pediu os quatro ajustes sugeridos depois da rodada 1 ("Pode incluir os quatro"). Números e
motivos na spec `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md`.
- **Seis status valendo como foco** — na rodada 1, Aceleração e Garra rendiam pouco (A1 8,6 p.p.) e as builds inclinadas nelas ficavam em 37–49%.
- **Pontos por nível crescentes (2 → 6), com o mesmo total no 50** — com a taxa fixa, dez níveis no topo davam só +16 de status e o M3 40→50 tinha 2 p.p. de folga.
- **Sorte só de nascimento; 2º dado = (Sorte − 40)/40** — ponto na Sorte não valia nada (A1 0,1 p.p.).
- **Corridas mais curtas por uma escala de tempo inteira (×1,067)** — subir só a velocidade base desmontava os iniciais.
- **Skill de tipo multiplica os dois status do tipo** (decisão da calibração, a confirmar) — com efeito próprio, investir no tipo rendia menos e a build "forte no tipo" não passava de 43%.
- **Bot × 1,2 no tipo, não × 1,3** (decisão da calibração) — com 1,3 o M6 do Raro 50 reprovava.
- **Custo continua subindo a cada 10 pontos (rodada 3, pedida pelo Vinicius, testou 12 e 15)** — inclinar perde ~5% dos pontos com qualquer degrau; degrau maior afiou a corrida e piorou o domínio da equilibrada.
- **Equilibrada fica como a build mais forte; metas apertadas = pior caso de 4 seeds + ~1 p.p.** (M6 até 62/64/67%, inclinadas ≥ 45%) — tirar o domínio pede mudar a regra (custo que para de subir ou retorno por concentrar); fica para depois do teste no artefato.

## 2026-11-12 — crescimento livre e ginásios (desenho aprovado; a implementar)
Conversa com o Vinicius; regras em `docs/GDD.md` §8.5 e §8.6. A calibração e a spec vêm depois.
- **Crescimento 100% por pontos (abordagem A)** — liberdade de build; também acaba com o ponto que perdia o efeito quando o crescimento automático alcançava o teto.
- **Custo por faixa: +1 a cada 10 pontos num status, no lugar do limite de 34%** — sonda: sem regra, "tudo em Velocidade" vencia 86%; com "até 10 custa 1, depois sempre 2" ainda vencia 63%; com o custo subindo sempre, cinco builds ficaram entre 47% e 62%.
- **Escala até 150, sem teto por raridade** — o custo crescente já impede chegar ao máximo; com 200 as barras ficariam com dois terços vazios.
- **Raridade define nascimento e pontos por nível; estrelas multiplicam os pontos com valores menores** — se multiplicassem todo o crescimento com 1 / 1,2 / 1,5, três estrelas venceriam quase sempre.
- **Redistribuição: a primeira de cada cavalo é grátis; depois, Rédea nova, ganha jogando ou por Gemas e nunca por Ouro** — vendida pelos dois, a Gema substituiria Ouro (regra do `CLAUDE.md` §8).
- **Equipamento sem status por enquanto, escondido, peças guardadas** — tira uma variável do balanço enquanto o crescimento muda; validar depois, talvez como cosmético.
- **Ginásios: 2 básicos de dificuldade comum na Expedição primeiro; os online (Fogo, Água, Grama e o trono) são extras do bloco 7** — conteúdo offline para o teste fechado.
- **Insígnias com bônus de conta pequenos (% de Ouro, % de XP, % de skill nova)** — não mexem na corrida, então o Poder e o PVP ficam limpos.

## 2026-11-11 — cavalos v3, bloco 1 (status, tipo e pista; implementado)
Spec: `docs/superpowers/specs/2026-11-10-cavalos-v3-status-e-tipo-design.md`. As seis primeiras saíram da calibração por simulação e diferem do que foi dito na conversa (o Vinicius pode vetar).
- **R16: a sala aberta guarda o retrato dos pontos (`pending.alloc`, como já guarda o do equipamento) e o Poder da sala nunca fica abaixo do Poder com que a ativa corre** — tirar peça, distribuir pontos e recarregar subia o Poder da sala e refazia os rivais (re-sorteio de graça); o piso também desfaz o retrato rebaixado à mão. Sala aberta antes disso usa os pontos atuais uma vez.
- **Tabela de raridade nova: nasce de 40–56 (Comum) a 60–76 (Mítico), tetos de 80 a 100** — com os números antigos uma raridade acima vencia de 89% a 96% e não sobrava espaço para a build; agora vence cerca de 84%.
- **Equipamento com cerca de metade dos valores e +0,5 por melhoria** — a distância entre raridades caiu de 8 para 5 pontos; o conjunto Raro +10 continua valendo pouco mais de um degrau.
- **Estrelas valem 1 / 1,2 / 1,5** (na conversa, 1 / 1,25 / 1,5) — recomendação da calibração; com eles três estrelas vencem uma em 71–73% e duas vencem uma em 59–61%.
- **No máximo 34% dos pontos livres num mesmo status** — sem limite, "tudo em Velocidade" ou "tudo em Força" vencia até 72% dos duelos.
- **As três skills de tipo não rendem o mesmo; a meta é o equilíbrio dos tipos (M9)** — Força vale tanto quanto Velocidade; com rendimentos iguais a Grama vencia 20,5% e a Água 14,2% num campo de seis.
- **Pistas sem extremos entram no bloco 1, não no 2** — as metas dos iniciais só fecham com a regra nova de pista.
- **Os bots do jogo usam a genética do catálogo; genética sorteada só nos cavalos sintéticos das medições** — a spec dizia as duas coisas (§2 × §7).
- **Estrelas fora da faixa são presas a 1–3; ausente ou não numérico vale 2** — save adulterado ou antigo nunca quebra a conta.
- **Molde fixo da pista depois de 60 sorteios falhos: reta 15%, curva 30%, reta 10%, subida 30%, reta 15%** — respeita a regra de nenhum tipo passar de metade.
- **O bot para no teto ao encher o status do tipo; ligas 0 / 810 / 910 / 1.010 / 1.110 / 1.220** — ponto acima do teto não rende; o inicial de nível 1 começa na Bronze.
- **Metas 3 e 3c rebaseadas (65–85% e 75–93%)** — a Velocidade pesa menos de propósito, então o especialista vence mais na pista dele; em pista sorteada quem vigia é a M6.
- **Durações aceitas: curta 88–104 s, longa 116–138 s** — em volta dos 96 e 127 s da calibração.
- **No `--quick`, M6, M9, P1, S1 e A1 são só informação; contam como meta no `balance.js` completo** — o `check.sh` fica rápido; mudança de número pede o completo.
- **Sala aberta na migração v4 → v5 sobrevive com a mesma seed e a entrada reservada, mas a pista e os rivais são refeitos pelas regras novas** — o save v4 não guarda a pista; acontece uma vez por save.
- **Montaria cujo modelo saiu do catálogo (Pangaré) fica no save, sem modelo e com a própria paleta; o Neutro converte por `hash2(seedBase, nº do uid) % 3`, em qualquer versão de save** — ninguém perde cavalo, e a conversão não usa a RNG do jogo.
- **Saves v1 e v2 recriam o inicial pelo catálogo novo (Comum ★★)** — esses saves não têm o que migrar.
- **O ícone do Neutro virou o das skills gerais (`el-geral.png`)** — reaproveita a arte, sem geração nova.
- **Na vaga da skill de tipo, a força aparece como "Intensidade ×N"** — "Força" já é o nome de um status.
- **Com páreo aberto, distribuir pontos no cavalo ativo só vale se o Poder não passar do que a sala viu** — a mesma regra das peças: não dá para abrir a sala fraco e ficar forte.

## 2026-11-10 — redesenho dos cavalos e da economia (desenho aprovado, a construir em blocos)
Resumo completo no `docs/GDD.md` §8. Tudo decidido em conversa com o Vinicius, parte por parte.
- **Crescimento híbrido:** automático pela genética e um ponto livre por nível para a build — mantém o forte do cavalo visível e dá escolha ao jogador; só com pontos livres todos iriam para Velocidade.
- **Genética visível (C a S por status) no lugar do "potencial" escondido** — o jogador precisa ver por que um cavalo é melhor que outro.
- **Estrelas multiplicam os pontos livres e sobem com item raro de treino** — é o "cavalo bem cuidado"; um cavalo de uma estrela deixa de ser fraco para sempre.
- **Iniciais passam a Comuns, com o mesmo total de pontos** — a escada fica mais longa e a diferença entre eles vem só do tipo.
- **Skill de tipo para todo cavalo, em vaga própria, sempre ativa no terço da pista que é do tipo** — medição de 6.000 corridas: a Brasa vencia 67% das pistas curtas e 11% das longas, e a skill dela rendia 4,5 pontos contra 8 das outras; ligar a skill a um momento que toda pista tem tira a sorte do terreno.
- **Sai o bônus fixo do tipo (+8) e sai o Neutro, por enquanto** — +8 de Força rendia mais que +8 de Estamina; o Neutro vencia metade do justo.
- **Skill que atrapalha rival fica fora** — o valor dela depende de quantos rivais há e de que tipo, e cada skill nova reabriria o balanço; rever depois do teste fechado.
- **Pistas sem extremos e preparação com relógio de 12 segundos** (ideia do Vinicius, para parecer partida online): trocar de cavalo e de ferradura com um toque, com Poder até o da sala.
- **A Gema compra tempo, espaço, conveniência e aparência; nunca poder nem Ouro** — o Vinicius precisa de receita na loja, e a regra "Gemas nunca viram Ouro" fica de pé.
- **Ouro nunca é vendido por Gemas; mercado entre jogadores só em Ouro, com servidor** — o Vinicius propôs mercado em Gemas com venda de Ouro; como o Ouro é o que se aposta, isso tornaria a ficha de aposta comprável com dinheiro (cassino social, classificação 18 anos, risco pela Lei 14.790/2023 e pelo precedente Big Fish). Ele escolheu manter a regra.
- **Item de Gema tem resultado garantido; a versão sorteada é a ganha jogando ou por Ouro** — item pago com resultado sorteado é caixa de recompensa.
- **Gemas também caem de graça, em pouca quantidade, por missões.**
- **Cruza de 12 a 24 horas, circuito ocioso que rende mais para cavalos de Poder maior, e aluguel de cavalo** — cada cavalo tem um trabalho por vez; estábulo grande e bem cuidado rende mais.
- **Ração (bônus de XP) no lugar de cansaço** — o mesmo gasto recorrente de Ouro, sem punir quem joga muito.
- **Ordem dos blocos:** status e tipo, pista e preparação, empacotamento, itens e gastos de Ouro, tempo e estábulo ativo, loja de Gemas, online — os dois primeiros mudam o save e a sensação da corrida, então vêm antes dos testadores.

## 2026-11-10 — empacotamento (em pausa: volta como bloco 3)
- **O nome do jogo é "Galope Elemental", agora definitivo** (escolha do Vinicius, depois de avaliar nomes em inglês) — a ficha do Play é traduzida por idioma, então a marca fica em português e a descrição vai no idioma de cada loja; o logotipo e a capa já existem. Identificador previsto para o Play: `com.galopeelemental.game` (não pode mudar depois da primeira publicação).
- **Durante o teste fechado o jogo existe só dentro do aplicativo** (escolha do Vinicius) — os arquivos vão dentro do pacote, funciona sem rede desde a primeira abertura e ninguém joga fora do teste.
- **Ordem das frentes** (trocada no mesmo dia pelo redesenho acima): o empacotamento vira o bloco 3; tutorial e som entram junto dele; expedições depois do teste fechado. A pergunta sobre usar o Capacitor ficou sem resposta.

## 2026-11-10 — pente fino
- **Primeira versão do Play: teste fechado com o jogo offline, lançamento público só com PVP** (escolha do Vinicius) — o teste fechado (12 testadores, 14 dias) é exigido antes da produção e o app pode mudar entre um e outro; assim o retorno de jogadores chega cedo e o jogo só estreia ao público com o pilar do design.
- **O protótipo vira o jogo final** (escolha do Vinicius): a mesma base web, empacotada para Android, com os módulos de regra (`sim.js`, `data.js`, `breed.js`, `gear.js`) indo para o servidor — é o caminho mais curto até o teste fechado e aproveita os testes que já existem; reescrever num motor custaria meses.
- **`claude/pente-fino` integrada na `main`** (aprovado pelo Vinicius), levando junto os visuais, a corrida viva e o wiki.
- **Pacote de balanceamento com medição pareada** (velocidade, curva, subida, 10 skills, gatilho de estamina baixa em 30%, skill de clima ×1,08) — o ganho de uma skill ia de 0,05 a 16,2 p.p. de vitória; ficou entre 4,8 e 11,9.
- **Pesos do Poder refeitos** (Velocidade e Força pesam mais; conjunto de 3 peças vale 3 pontos) — o Poder errava até 10,5 p.p. por montaria; agora no máximo 3,8.
- **Metas novas no `balance.js`** (S1 por skill, A1 por status, P1 e P2 do Poder, Em1 de emoção) — vigiam o que antes ninguém media.
- **Entrada da sala aberta fica reservada e sala aberta nunca é trocada antes de correr** — dava para re-sortear a sala gastando o Ouro, ou trocando um treino por sala valendo.
- **Gasto só vale se a gravação der certo** — com o armazenamento cheio, recarregar desfazia a corrida já vista.
- **`jogo.html` de produção sem modo DEV, sem gancho de teste e sem o CSS deles; o build falha se sobrar** — `?dev=1` ligava Ouro infinito no jogo do jogador.
- **Pedra Negra do pódio sorteada por lugar; prêmios com porcentagens inteiras** (4 corredores a 100: 252 + 108) — os lugares saíam amarrados e o ponto flutuante errava 1 de Ouro.
- **Resultado da corrida leva `simVersion` e `tuningHash`** — um servidor poderá auditar corridas antigas depois de um rebalanceamento.
- **Desenho da corrida com hachura, serras e texto guardados prontos, escala de trabalho menor em tela densa e laço parado fora da corrida** — as subidas triplicavam o custo do quadro; o desenho ficou idêntico pixel a pixel.
- **Nada de minificador feito à mão no build** — tirar comentário por expressão regular quebra código em silêncio; fica para o empacotador da tecnologia final.
- **Seed secreta, validação das entradas e seeds por domínio ficam para o servidor** (`docs/cronograma.md`) — no cliente o save é editável de qualquer jeito.
- **Peça Rara e Lendária do mesmo conjunto seguem com o mesmo nome** — é decisão do GDD §7, não erro.
- **149 arquivos sem uso apagados e documentos encurtados; o checklist de lançamento virou `docs/cronograma.md`** — pedido do Vinicius ("não deixe informações demais"). O `comparativo.html` fica enquanto houver arte de molde pendente.
- **Ainda não é hora de publicar no Play** — faltam tecnologia final, empacotamento, documentos legais, conta e teste fechado.

## 2026-11-09 — corrida viva, modo DEV e wiki
- **Wiki gerado do código** (`docs/wiki.md`, `prototype/dist/wiki.html`) — uma chave nova sem tradução quebra o build, para o wiki nunca mentir.
- **Build de teste `jogo-dev.html` liga o modo DEV sozinho** — o artefato do claude.ai não repassa `?dev=1`.
- **Modo DEV com save separado (`galope-elemental:dev`)** — testar sem tocar no save real; Ouro infinito só em memória.
- **Única mudança do DEV na simulação: `config.dev.skillsAlways`** — o determinismo da corrida real não muda.
- **Skills visíveis na pista** (balão preso à raia, contorno na cor do elemento) — dá para ver quem ativou sem ler o rodapé.
- **Dado da Sorte na pista** (um dado por cavalo, o maior brilha, "↻" em quem desempatou) — a faixa ordena por desempate e depois pelo número.
- **Natureza só visual** (vento pela seed, folhas, respingos, calor e poeira por piso) — o vento não entra na regra.
- **Opção "Animações" no Perfil** — respeita o sistema sem deixar a chuva parada.
- **Curvas vizinhas viram uma só no desenho** (a simulação continua por bloco) — duas coladas pareciam um ziguezague falso.
- **Efeitos em segundos reais por um fator `escala`** — em x1 a simulação anda ~4× o tempo real.
- **Galope de corrida de ondas, folhas e lisa guiado pelo quadro de chamas** — crina própria por estilo não passou nos critérios e ficou pendente.
- **O ui-test serve `prototype/dist/` por http local** — em `file://` o localStorage às vezes sumia e o `check.sh` oscilava.

## 2026-11-08 — menu de abas e visuais
- **Menu de abas antes das expedições e dos visuais** (escolha do Vinicius) — a rolagem única não comportava as telas novas.
- **5 abas (Estábulo, Correr, Expedição, Haras, Loja) e Perfil no cabeçalho; Equipamento vira sub-aba da Montaria** — uma tela por assunto.
- **A corrida PVP continua automática; a batalha de expedição terá modo automático e manual** (escolha do Vinicius).
- **Cavalos com moldes do PixelLab recoloridos no jogo** — arte melhor sem gerar um sprite por cavalo.
- **Cores naturais e classificação local, sem paleta forçada** — com `color_image` o PixelLab pintava tudo num tom só.
- **Escala inteira única para todos os estilos** — pixels nítidos e cavalos do mesmo tamanho.
- **Ícones do PixelLab; logotipo e capa do Canva** — marca sem custo avulso.
- **Script de geração com dry-run por padrão e `--teto`** — cota só com confirmação.
- **Bônus de 4 peças do conjunto: ×1,10 → ×1,07** — a skill de clima volta a valer mais que o conjunto.
- **Branches já mescladas não podem ser apagadas pela sessão** (o proxy bloqueia) — fica para o Vinicius no GitHub.

## 2026-11-06 — núcleo v2, cruzamento e equipamentos
- **Redesign em 6 subprojetos** (núcleo → cavalos e cruzamento → equipamentos → expedições → montarias → economia) — a ordem segue as dependências.
- **7 atributos (entram Manobra e Sorte) e 5 raridades** — cada trecho do mapa tem um atributo dono; a raridade define teto, vagas e chance de skill.
- **Tática e "Disposição do dia" removidas** — corrida = status + terreno + RNG; a única sorte é o Dado da Sorte, visível.
- **Elementos agem só pelo clima** (Fogo > Grama > Água > Fogo) — uma regra em vez de três tabelas.
- **Mapa aleatório em blocos, sem pistas fixas** (ideia do Vinicius) — nenhum tipo de montaria fica sem pista.
- **Skills aprendidas por nível** (8% por nível até lotar as vagas) — dá valor ao nível e ao cruzamento.
- **Pacotes de montaria só com moeda ganha jogando; Gemas só para cosméticos e passe** — a Lei 15.211/2025 veda caixa de recompensa paga em jogo de acesso provável por menores, e pacote pago também furaria "Gemas nunca viram Ouro".
- **Grau (★ a ★★★) dentro da raridade** — variação de qualidade sem criar uma 6ª raridade.
- **Status do potro sorteados na faixa do grau, não herdados** (pedido do Vinicius); as chances saturam no nível 30 e a égua pesa 60%.
- **Mítico fora do cruzamento** (só por despertar, depois das expedições).
- **Haras com reprodutores de aluguel e Troca; estábulo com vagas limitadas** — seguram a inflação de cavalos.
- **5 slots de equipamento com status dono; conjuntos por clima com bônus de 3, 4 e 5 peças** — cria a escolha antes da corrida.
- **Melhoria +0 a +10 com queda a partir de +6** (o Vinicius pediu chances menores); sorteio só pela seed.
- **Loja com Ouro; Pedra Negra só no pódio de corrida valendo; Lendário fora da loja até as expedições.**
- **Trava parcial com páreo aberto** — dá para trocar de conjunto pela previsão do clima, não para abrir a sala fraco e equipar forte.
- **Save migrado a cada versão em vez de chave nova** — não perder o Ouro do jogador.
- **`game.js` não será dividido agora** — o que sobrevive para a tecnologia final são os módulos puros (`sim.js`, `breed.js`, `gear.js`, `data.js`).
- **Testes unitários no `check.sh` e snapshot dos 3 potros de exemplo** — qualquer chamada de RNG a mais derruba o teste.

## 2026-11-05 — regras de trabalho
- **Uma conversa principal e uma branch por frente** — a principal integra na `main` e escolhe modelo e esforço por tarefa.
- **Design em `docs/GDD.md`; `CLAUDE.md` enxuto; memória versionada em `docs/memoria/`** — sessões na nuvem rodam em contêiner descartável.
- **`prototype/dist/` versionado** — abre o jogo sem rodar o build.
- **Protótipo sem dependências** (Playwright já instalado para os testes) — nada para instalar.
- **Não reorganizar `prototype/` antes de escolher a tecnologia final.**
- **Prêmios nunca crescentes por colocação; sem Ouro para a entrada, a sala vira treino** — correções do primeiro pente fino.
- **Pilares do GDD §2 aprovados** — corrida automática por seed, duas moedas (Gemas nunca viram Ouro), PVP de 4 a 8 com pote, ligas por Poder.
- **Nome do projeto "MMORPG Horse"; título do jogo "Galope Elemental"** (provisório até 2026-11-10, quando virou definitivo).
- **2026-11-13 · Explicações curtas ("ⓘ") em `GameData.HELP`; `STATS[k].desc` passa a ser o mesmo texto · o jogo e o wiki mostram uma frase só por conceito; no toque o texto abre embaixo do rótulo (`aria-expanded`, `role="note"`), sem re-renderizar a tela.**
- **2026-11-23 · A interface em HTML passa da Galmuri para a Nunito (SemiBold no texto, ExtraBold nos títulos), com os painéis no tom azul da Resurrect 64 · o Vinicius achou a Galmuri com cara de "coisa antiga" e escolheu "Nunito + azul" entre 5 variantes; a Galmuri continua no canvas da corrida (atlas de glifos), onde o pixel 1:1 importa.**
- **2026-11-23 · O ícone de Força passa a 16×16 (redesenhado da versão Pro de 24) · os 7 status no mesmo tamanho; o braço de 24 desalinhava a linha.**
- **2026-11-23 · Cenas das abas num painel com a moldura das caixas; fundo da página em pontilhado discreto (eram tábuas) · a cena solta parecia deslocada do fundo, e as tábuas no azul pareciam azulejo; escolha do Vinicius numa prévia com 3 fundos.**
- **2026-11-23 · Câmera da corrida de 4 a 12 px/m, enquadrando o jogador e os rivais a até 45 m, com a escala e o deslocamento suaves; o cenário rola pelo que a câmera andou (sem salto no zoom) · a 12 px/m fixos os cavalos saíam logo da tela e a disputa sumia. Só apresentação: a simulação não muda.**
- **2026-11-23 · A seta de quem está fora da tela volta a mostrar os metros até o jogador ("+12 m"/"–8 m") · a etapa 2.4 tirou de propósito (guia: "sem metros"), mas sem eles não dava para saber quão longe estava a disputa; pedido do Vinicius.**
- **2026-11-23 · O nome de autor nos créditos fica "Vinicius" · confirmado pelo Vinicius; era o último pendente dos créditos antes de publicar.**

## 2026-11-24 · animação ambiente, etapa 0 (integração visual P1)
- 2026-11-24 · Pelagem em 4 tons calculada na recoloração (`Sprites.sombreiaPelagem`, índices 16–19), sem mudar o formato dos moldes (o plano previa cinza × 17) · os 4 tons saem de sombreado por código de qualquer jeito; evita regerar e re-testar os 12 PNGs.
- 2026-11-24 · LUT de clima por degrau de rampa (`Luz.lutCondicao`), no lugar da mistura com tinta + cor mais próxima · a antiga fundia metade dos tons (nublado 64 → 32 cores, névoa → 22); a nova funde 5 e 14 dentro das rampas.
- 2026-11-24 · Figuras (cavalos) numa LUT mais branda que a do fundo (chuva −1 em vez de −2; névoa não muda) · em −2 o cavalo some na pista escura; a figura fica à frente e ainda escurece junto.
- 2026-11-24 · Rampa oliva com `#313638` entre o contorno e `#4c3e24` · o castanho da Grama tinha a sombra na cor do contorno (3 tons); ganha o 4º.
- 2026-11-24 · Leitura por valor pelo degrau do piso das raias (−1, 0, +1) escolhido por tabela, sem clarear na escada sol → nublado → chuva · é o remédio do guia que serve a todas as pelagens de uma vez; um degrau único para todos os climas piorava o sol na grama.
- 2026-11-24 · Casco sem patinar só na gaveta DEV ("galope casado"); a cadência natural continua · casar exige ~36 q/s (a reprodução é ~2× comprimida); muda o visual do galope, então é decisão do Vinicius.
- 2026-11-24 · Poeira e pousos medidos dos moldes na carga (`passadaDe`), não gravados no JSON · mesmo resultado, sem regerar os JSONs; testado no fx-test.
- 2026-11-24 · Casco: opção C (meio-termo) como padrão do jogo; natural, meio e casada na gaveta DEV · escolha do Vinicius ("Prossiga", pela coordenação).
- 2026-11-24 · Pré-assado por estado quantizado da peça (Deforma.preassado), não por quadros de tempo com vento fixo · quadros por tempo matariam a rajada que atravessa a tela e só os coqueiros passariam de 2 MB; por estado, cada peça segue o seu vento, com teto de memória.
- 2026-11-24 · O motor (ambiente.js) entra no build do jogo só quando o jogo o usar (etapas 2–3) · evita ~60 KB sem uso no jogo.html.
- 2026-11-24 · Olho dos moldes gravado por ferramenta própria (moldes-olho.mjs) sobre os JSONs de hoje · o --reprocessar dos portes precisa dos mestres crus (fora do repositório); o gerador já grava o olho nos próximos.
- 2026-11-24 · Idle do jogo liga por opts.anima ('cena' com os gestos do PixelLab) só nas cenas grandes (Estábulo, desafio, largada) · o retrato pequeno não comporta a cabeça do comer, e os cards ficam leves.

- 2026-11-24 · Etapa 5 antes da 4 · a coordenação mandou adiantar as regiões na corrida enquanto a spec do mapa espera o Vinicius.
- 2026-11-24 · Região viva por região e clima, com as máscaras tiradas das cores do sol e a deformação lendo a camada já na paleta do clima · as mesmas cores da camada parada, sem trocar paleta a cada passo; o que é comum aos climas (geometria dos coqueiros, degraus do mar, rotor) fica guardado uma vez.
- 2026-11-24 · Montagem aos poucos (um passo por tarefa, na contagem da largada); até ficar pronta, a pista usa as camadas paradas · montar tudo na largada custava 170–250 ms num quadro só.
- 2026-11-24 · O mar do Litoral na corrida repete a cada 8 s (48 passos guardados) e os coqueiros usam estados mais grossos (8 fases) · cortou o custo do Litoral de 0,38 para 0,27 ms por quadro; o corte das ondas a cada 8 s coincide com a volta da crista.
- 2026-11-24 · Cenário das corridas na gaveta DEV (persistente, como a cadência) · para o Vinicius ver as 5 regiões e os testes medirem cada uma; só desenho, não entra na sala.
- 2026-11-24 · Mapas das trilhas: a cena desenha direto no buffer do mapa (sem cópia), refaz a imagem num tique de 8 q/s e a correnteza do rio é de riscos esparsos, não o rio inteiro em ciclo de cor · o ciclo no rio todo ficava artificial e custava acima do teto; assim água 0,105, fogo 0,113 e grama 0,286 ms por quadro (teto 0,35).
- 2026-11-24 · A cena do mapa recebe a imagem e a máscara do caminho de quem chama (`{ imagem, caminho }`) · o mapa é da frente 2; com a máscara, peixe, brasas e fumaça nunca nascem em cima da trilha.
