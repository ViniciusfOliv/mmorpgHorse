# MMORPG Horse — GDD (rascunho v0.1)

> Fonte da verdade do design. Números reais do protótipo: `docs/wiki.md` (gerado do código). Exemplos de corrida e de potros: `docs/exemplos.md`. Decisões com data e motivo: `docs/memoria/decisoes.md`.

Status: **rascunho em construção**. Seções 1–7 escritas e aprovadas (status, tipos, estábulo e equipamentos já na regra do crescimento livre, 2026-11-13) (cada frente tem a spec em `docs/superpowers/specs/`); a seção 8 é o redesenho aprovado, em blocos; as seções 9+ estão pendentes. O caminho até o lançamento e o roteiro de evolução ficam em `docs/cronograma.md`.

## 1. Visão

Jogo em pixel art (web + Play Store) de corrida de cavalos com progressão estilo RPG e elementos estilo "monstros de tipo" (Fogo/Água/Grama). Foco em **PVP**: corridas entre jogadores apostando moeda virtual.

## 2. Pilares decididos

| Tema | Decisão |
|---|---|
| Jogabilidade da corrida | **Automática.** Estratégia acontece antes: escolher a montaria e o equipamento para o mapa e o clima da corrida. Servidor simula com *seed*; cliente só anima. |
| "MMO" | **Hub social**: cidade/estábulo compartilhado (chat, ranking, haras/guildas, mercado). Resto por menus. |
| Obter cavalos | **Cruzamento + Expedições PVE** (núcleo) + **pacotes de montaria** comprados só com moeda ganha jogando (nunca com Gemas: caixa de recompensa paga é vedada no Brasil para menores). |
| Monetização | **Duas moedas**: 🪙 Ouro (só ganho jogando, é apostável) / 💎 Gemas (compradas; compram tempo, espaço, conveniência e aparência, nunca poder nem Ouro). Gemas **nunca** viram Ouro. Evita classificação como jogo de azar. |
| PVP | Corridas de **4–8 jogadores**, entrada igual, pote dividido 1º/2º/3º (menos taxa da casa). Bots completam vagas. **Espectadores apostam** (fase 2; em reavaliação pelo risco de classificação 18+, ver `docs/cronograma.md`). |
| Matchmaking | **Ligas por Rating de Poder do cavalo** + **MMR do jogador** dentro da liga. Modo opcional **Copa Nivelada** (status normalizados). |

## 3. Status (1–150)

Sete atributos. Sem tática pré-corrida: a corrida é decidida por **status + terreno + sorte**. O
modelo existe para o jogador **ver por que um cavalo é melhor que outro**, montar a build e sentir a
progressão de nível, estrelas e raridade. Fórmulas e tabelas completas: `docs/wiki.md` (Status, Level e XP, Raridades).

| Atributo | O que faz |
|---|---|
| Velocidade (VEL) | Velocidade máxima na reta |
| Aceleração (ACE) | Largada e retomada na saída de curva e de subida |
| Manobra (MAN) | Quanto da velocidade segura nas curvas |
| Força (FOR) | Velocidade na subida, piso pesado (terra/areia) e disputa no pelotão |
| Estamina (EST) | Tamanho do tanque de fôlego e ritmo no meio e no sprint |
| Garra (GAR) | Chance e força da arrancada final; com mais Garra ela começa mais cedo |
| Sorte (SOR) | Chance de rolar um segundo dado no Dado da Sorte e de ativar skills; **só de nascimento** |

**Nada cresce sozinho.** O status de um cavalo é a **base** (raridade + genética) mais os **pontos
comprados** pelo jogador, e só isso:
- **Base:** `início da raridade + 16·genética/31`. A genética vai de 0 a 31 por status, à mostra como
  nota (C, B, A, S), e vem só do nascimento. O início da faixa por raridade:

  | Raridade | Base nasce entre | Fator de pontos | Vagas de skill | Chance base de skill |
  |---|---|---|---|---|
  | Comum | 40 e 56 | ×1,00 | 1 + a do tipo | 35% |
  | Mágico | 44 e 60 | ×1,05 | 2 + a do tipo | 45% |
  | Raro | 49 e 65 | ×1,10 | 3 + a do tipo | 55% |
  | Lendário | 54 e 70 | ×1,15 | 4 + a do tipo | 65% |
  | Mítico | 60 e 76 | ×1,20 | 5 + a do tipo | 75% |
- **Pontos por nível:** cada nível dá pontos, e o jogador distribui todos na aba Status e confirma.
  Nível 1 dá 0; a taxa é 2 por nível no nível 2 e sobe em linha reta até 6 no nível 50 (média 4). O total
  até o nível L é multiplicado pelo fator da raridade (tabela) e das **estrelas** (★ ×1 / ★★ ×1,09 /
  ★★★ ×1,22). Exemplos, Comum / Mítico: ★★ nível 11 = 25 / 31, nível 30 = 100 / 120, nível 50 = 213 / 256;
  ★ nível 50 = 196 / 235; ★★★ nível 50 = 239 / 286.
- **Custo por faixa, até 150:** num mesmo status, os 10 primeiros pontos custam 1 cada, do 11º ao 20º
  custam 2, do 21º ao 30º custam 3, e assim por diante (comprar 10 custa 10; 20, 30; 30, 60; 50, 150).
  A genética não entra no custo. O teto é um só, **150 em cada status**, igual para todas as raridades;
  ninguém chega lá (o pior caso, Mítico ★★★ nível 50 com tudo num status, dá 146). Isso substitui o
  limite de 34% e o teto por raridade: o custo crescente é o que impede "tudo em um status" de vencer
  (numa sonda, sem custo ele vencia 86% dos duelos; com custo, cinco builds diferentes ficaram entre 47%
  e 62%).
- **Sorte não recebe pontos:** fica com a base, de 40 a 76.
- **Mudar de ideia:** a primeira redistribuição de cada cavalo é grátis e devolve todos os pontos;
  as seguintes usam a **Rédea nova** (8.2). Com páreo aberto, a montaria ativa não redistribui.

A corrida é linear até 150: cada ponto rende parecido em qualquer status (num Raro nível 20, +10 pontos
valem de 9,6 a 11,0 p.p. de vitória nos seis status de corrida, maior ÷ menor = 1,15), então escolher
onde pôr os pontos é escolha de estilo. A **build equilibrada** é a mais forte; as inclinadas ficam
poucos pontos percentuais abaixo (spec 1b §15).

A chance de uma skill disparar quando o gatilho acontece = base da raridade + 0,5 p.p. por nível + 0,1
p.p. por ponto de Sorte (teto 95%). A cada nível ganho há 8% de chance de aprender uma skill nova, se
houver vaga. Cada montaria também tem **sexo** (macho/fêmea), para o cruzamento.

## 4. Tipos, clima e Dado da Sorte

Três tipos: 🔥 Fogo, 💧 Água e 🌿 Grama. O tipo age só pela **skill de tipo** e pelo clima; ele não
soma pontos de status.

**Skill de tipo.** Todo cavalo tem a do seu tipo, em vaga própria, **sempre ativa** (sem sorteio) no
terço da pista que é do tipo; o terço é proporcional à distância. Ela **multiplica os dois status do
tipo** nesse terço (× (1 + m·P)); a força P cresce com nível e raridade, de forma diferente por tipo
(Comum nível 1 vale 1 nos três). A aba Skills mostra o ganho em pontos para o cavalo. Ela nunca troca.

| Tipo | Skill | Terço | Status multiplicados |
|---|---|---|---|
| 🔥 Fogo | Labareda | primeiro | Velocidade e Aceleração |
| 🌿 Grama | Raízes Firmes | do meio | Força e Manobra |
| 💧 Água | Maré Alta | último | Estamina e Garra |

Como a skill multiplica os status que o jogador comprou, investir no tipo tem sinergia: a build "forte
no tipo" fica em 48–53% contra as outras. A meta que vale é o **equilíbrio dos tipos** num campo misto
(cada tipo vence perto do justo, de 16,3% a 17,2%). As oito skills **gerais** servem a qualquer tipo; as
de um tipo só ele aprende (Fogo 2, Água 3, Grama 2). Skill que atrapalha rival fica fora por enquanto
(rever depois do teste fechado).

O triângulo (Fogo > Grama > Água > Fogo) age **só pelo clima**. O dono do clima tem os status ×1,03 (×1,07 com 4 peças do conjunto do clima; ×1,08 com a skill de clima do elemento); o penalizado, ×0,97.

| Clima | Favorece | Penaliza | Efeito geral |
|---|---|---|---|
| ☀️ Sol | Fogo | Grama | gasto de estamina +4% |
| 🌧️ Chuva | Água | Fogo | todos −1,5% de velocidade |
| 🌫️ Névoa | Grama | Água | — |
| ☁️ Nublado | — | — | ninguém é favorecido |

**Dado da Sorte:** quando o líder cruza 1/3 e 2/3 da pista, todas as montarias rolam um dado de 1 a 100; a chance de rolar um segundo dado e ficar com o melhor é **(Sorte − 40)/40**, de 0 (Sorte 40) a 1 (Sorte 80 ou mais): a Sorte nasce entre 40 e 76, e a conta começa onde ela começa.
O maior dado vence (empate: só os empatados rolam de novo) e o clima vira o do tipo do vencedor; se já for esse, o clima segura.
Tudo sai da seed da corrida: a sorte vicia o dado, não o decide (um Mítico de genética 31 contra sete Comuns de genética 0 vence o Dado em 20,8%; o justo é 12,5%). A Sorte vale pouco na corrida (0,7 p.p. entre os extremos de genética), por desenho.

**Mapa aleatório, sem extremos:** cada corrida sorteia pela seed uma pista de 1.400 a 2.000 m (de 50 em
50) dividida em 5 a 9 blocos de **reta** (Velocidade), **curva** (Manobra) ou **subida** (Força); o
primeiro e o último bloco são sempre reta. Toda pista tem curva e subida, e nenhum tipo de bloco passa
de metade da distância: assim o sorteio da pista não decide a corrida. Também sorteia o piso (grama,
terra ou areia) e o clima inicial.

**Iniciais:** Brasa (Fogo), Maré (Água) e Ipê (Grama) são Comuns de duas estrelas, nível 1, sem skill
de vaga, com a mesma soma de genética e a base de 45 a 52 em cada status. Cada um é forte nos dois status do seu tipo (Brasa em VEL e ACE,
Maré em EST e GAR, Ipê em MAN e FOR) e vence de 30% a 37% contra os outros dois (de 22% a 45% em
cada faixa de distância). No nível 25 caem na Prata (Poder 782–791).

## 5. Protótipo

`prototype/` contém o protótipo web (sprites, simulação e fluxo de aposta). Em 2026-11-10 ficou decidido que ele vira a base do jogo: a mesma base web empacotada para Android, com os módulos de regra indo para o servidor.

**Fluxo de telas.** O jogo tem uma barra de 4 abas (Estábulo, Correr, Expedição, Haras; a Loja de peças está escondida com o equipamento), embaixo no celular e à esquerda no desktop (≥ 900 px), e um cabeçalho com o saldo (Ouro) e o botão Perfil (estatísticas e "Recomeçar"). O Estábulo só lista as montarias; cada uma abre a tela da Montaria, com as sub-abas Status e Skills (a de Equipamento está escondida). Largada, corrida e resultado são telas cheias, sem barra. A corrida PVP continua automática; a aba Expedição é um espaço reservado até o subprojeto 4.

**Arte do protótipo.** Os cavalos usam moldes gerados no PixelLab (retrato, parado e galope de 9 quadros por estilo de crina), recoloridos na hora com a paleta de cada montaria; ícones também do PixelLab, logotipo e capa do Canva; pista, clima e interface por código. Na corrida, o Dado da Sorte, as skills, a Garra e o cansaço aparecem no próprio cavalo, e o clima e o vento (só visual) aparecem na pista. Detalhes: `docs/superpowers/specs/2026-11-08-visuais-design.md` e `docs/superpowers/specs/2026-11-09-corrida-viva-design.md`.

## 6. Estábulo e cruzamento

Spec completa e algoritmo: `docs/superpowers/specs/2026-11-06-cruzamento-design.md` (o código é `prototype/src/breed.js`). Números reais: `docs/wiki.md` (Cruzamento); potros de exemplo em `docs/exemplos.md` §4.

**Estábulo:** começa com 3 vagas; +1 vaga por 300 Ouro, até 8. Cada montaria tem nome, raridade + estrelas, tipo, sexo, nível e cruzamentos restantes (♂ 2 / ♀ 1). O selo da montaria mostra os pontos que ainda dá para distribuir. Uma delas é a ativa (a que corre). Liberar não devolve Ouro; a ativa e a última montaria não podem ser liberadas.

**Estrelas (★/★★/★★★):** saem do cruzamento (regra abaixo) e multiplicam os pontos por nível do potro (§3). O status do potro sai só da genética e da raridade; as estrelas não mexem nele.

**Haras:** o jogador escolhe uma montaria sua e um parceiro de sexo oposto: outra sua ou um reprodutor de aluguel (selvagens não Míticos). Aluguel = base da raridade (Comum 100 · Mágico 250 · Raro 600 · Lendário 1500) × estrelas (★ ×1 / ★★ ×1,25 / ★★★ ×1,5), arredondado. Dois seus: 50 Ouro. **Troca:** dois seus de sexos opostos, 50 Ouro, qualquer número de cruzamentos restantes; os dois pais somem e o potro ocupa a vaga de um deles. A calculadora mostra chances de raridade e de estrelas antes de pagar. Resultado instantâneo (gestação com timer fica para depois).

**Chance de raridade do potro** (L = nível efetivo; interpolação linear entre lv1 e lv30; alvo fora de Comum–Lendário soma no limite):

| Pais | 1 abaixo | igual | 1 acima | 2 acima |
|---|---|---|---|---|
| mesma raridade, lv1 → lv30 | 45% → 30% | 54% → 65% | 1% → 4,5% | 0% → 0,5% |
| raridades diferentes, lv1 → lv30 | 35% → 20% | 50% → 50% | 15% → 29% | 0% → 1% |

A base é a menor raridade entre os pais. **Estrelas do potro:** se a raridade subiu, nasce ★; se desceu, ★★★; se igual, a base é 0,6·estrelas da égua + 0,4·estrelas do garanhão (arredondada) e o sorteio é desce/mantém/sobe = 25% → 10% / 55% → 50% / 20% → 40% (lv1 → lv30).

**Chances saturam no nível 30; a égua pesa 60%:** L = (0,6·nível da égua + 0,4·nível do garanhão) / 30, limitado a 1. **Mítico nunca nasce de cruzamento — só por despertar** (Lendário → Mítico, depois das expedições).

**Tipo, sexo e genética:** pais do mesmo tipo passam o tipo; diferentes, 50/50. Sexo 50/50. A genética é **metade herdada**: por status, 50% de chance de vir de um dos pais (sorteado), senão sai de 0 a 31. O potro nasce no nível 1, sem pontos comprados e com a primeira redistribuição grátis.

**Skills e Corcel:** a skill de tipo vem sempre, com o tipo. O potro herda cada skill de vaga dos pais compatível com o seu tipo com 35% de chance, até as vagas da raridade; completa até o mínimo de nascimento com skills sorteadas. Corcel é a montaria com todas as skills "de linha" da sua raridade; garante herança de skill:

| Raridade | Conjunto do Corcel | Skills garantidas |
|---|---|---|
| Comum | Arranque | dois Corcéis: garante até 2 · um só: até 1, com 50% de virar 2 — sempre limitado às candidatas (skills herdáveis dos pais) e às vagas da raridade do potro |
| Mágico | Arranque, Sprint | idem |
| Raro | + Drift | idem |
| Lendário | + Saída Rápida | idem |
| Mítico | + Arrancada Final | idem |

**Marcas e jóquei (só aparência, 2026-11-13):** spec em `docs/superpowers/specs/2026-11-12-cavalos-marcas-design.md`; números em `docs/wiki.md` (Marcas e jóquei). Cada cavalo tem 3 genes de marcas: cara (nenhuma, estrela, listra, frente branca), patas (0 a 4 meias brancas) e corpo (liso, malhado, pintado, ruão). O potro herda cada gene de um dos pais (égua ou garanhão, 50% cada) com 10% de mutação para um valor qualquer, pela RNG da seed (sequência própria, sem mexer no resto do potro). Marcas não entram em status, Poder, preço, skills nem na corrida. O jóquei é do jogador: padrão da seda (6) e cor do capacete (8), escolhidos no Perfil e valendo para todos os cavalos; o dos rivais sai da seed da sala. A raridade aparece em escada: Comum nada, Mágico brilho na crina, Raro brilho e 3 faíscas, Lendário brilho mais forte e 5 faíscas, Mítico igual ao Lendário e rastro de luz na corrida.

**Portes (só aparência, 2026-11-13):** spec em `docs/superpowers/specs/2026-11-13-cavalos-portes-design.md`; números em `docs/wiki.md` (Portes). Cada cavalo tem um porte, o corpo do desenho: esguio (pernas longas e finas, pescoço comprido), padrão (equilibrado) ou robusto (mais baixo e largo, crina farta), iguais nos três elementos. O potro herda o porte de um dos pais (50% cada) com 10% de mutação para um dos três, pela RNG da seed (sequência própria, separada das marcas). Porte não entra em status, Poder, preço, skills, aluguel nem na corrida. Os iniciais são todos padrão. São 12 moldes (3 portes × 4 estilos de crina).

## 7. Equipamentos

> **Suspenso (bloco 1b, 2026-11-13).** Por enquanto o equipamento não tem efeito: a corrida, o Poder e os
> status ignoram as peças, os bots não ganham peças, a sub-aba Equipamento e a aba Loja ficam escondidas
> (uma constante desliga, `GEAR_ON` no `game.js`) e a Pedra Negra do pódio não cai. O save guarda peças,
> melhorias, o que está equipado e as Pedras, sem mudança e sem venda. Volta a ser validado depois
> (talvez como cosmético). **O texto abaixo descreve o desenho guardado, não o que vale hoje.**

Cada montaria usa um **set de 5 peças** (modelo do equipamento de cavalo do Black Desert). As peças ficam num **inventário compartilhado**, são compradas na **Loja** com Ouro e melhoradas de +0 a +10 com **Pedras Negras**. Os **conjuntos** ligados aos climas criam a escolha pré-corrida: turbinar o dia bom ou se proteger do dia ruim. Sem durabilidade e sem limite de vagas (por enquanto).

**Slots e status:**

| Slot | Principal | Secundário |
|---|---|---|
| Ferraduras | Velocidade | Aceleração |
| Sela | Estamina | Garra |
| Estribos | Manobra | Sorte |
| Testeira | Aceleração | Garra |
| Armadura | Força | Estamina |

**Raridade da peça** (Mítico não tem peça; vem do despertar, no futuro). O principal vale o valor da raridade **mais meio ponto por nível de melhoria** (uma peça +10 soma +5); o secundário é fixo. Comum não tem secundário. Os valores são pequenos porque a distância entre duas raridades é de 5 pontos por status. O preço de Lendário é só referência de venda: **não está à venda**.

| Raridade | Principal | Secundário | Preço | Venda (25%) |
|---|---|---|---|---|
| Comum | +2 | — | 100 | 25 |
| Mágico | +2 | +1 | 250 | 63 |
| Raro | +3 | +2 | 600 | 150 |
| Lendário | +4 | +3 | 1.500 | 375 |

Peças Comum e Mágica são soltas; Raro e Lendário vêm em **conjuntos** (Sol, Chuva, Névoa), com o mesmo nome nas duas raridades. São 40 peças no catálogo; 25 estão à venda. Os bônus entrariam na corrida somando ao status. Um conjunto Raro completo em +10 soma de +8 a +10 nos cinco status principais: pouco mais de um degrau de raridade.

**Melhoria (+0 a +10).** Cada tentativa gasta Pedras Negras e tem chance de sucesso decrescente. A partir de +6, falhar faz a peça **cair um nível**. A pedra é paga e o resultado sorteado pela seed antes de ser mostrado, e o sorteio não se repete ao recarregar.

| De → para | +0→1 | +1→2 | +2→3 | +3→4 | +4→5 | +5→6 | +6→7 | +7→8 | +8→9 | +9→10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Chance | 100% | 90% | 80% | 70% | 60% | 50% | 40% | 35% | 30% | 25% |
| Pedras por tentativa | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 |
| Se falhar | nada | nada | nada | nada | nada | nada | cai p/ +5 | cai p/ +6 | cai p/ +7 | cai p/ +8 |

Custo esperado da cadeia completa, contando as quedas (pedra a 40 Ouro): **+5 ≈ 6 pedras (258 Ouro) · +7 ≈ 16 (658) · +8 ≈ 37 (1.481) · +10 ≈ 264 (10.548)**. O +10 é objetivo de longo prazo de propósito. Uma peça equipada na montaria ativa com páreo aberto não pode ser melhorada.

**Conjuntos.** Conta-se, por montaria, o maior número de peças equipadas do **mesmo** conjunto (raridades misturadas valem; empate entre conjuntos não ativa nada). Os bônus **acumulam**:

| Peças | Bônus |
|---|---|
| 3 | +5 p.p. na chance de todas as skills e +5 de Sorte |
| 4 | O bônus do clima do conjunto sobe de 1,03 para 1,07 quando a montaria é do elemento favorecido por ele. Não acumula com a skill de clima (1,08): vale o maior |
| 5 | A montaria ignora a penalidade de clima, em qualquer clima |

Conjuntos: **Sol** (clima do Fogo), **Chuva** (Água), **Névoa** (Grama). No desenho guardado o conjunto também somava ao Rating de Poder; hoje o Poder não conta peças.

**Loja e venda.** Tela própria, com uma aba por slot (1 Comum, 1 Mágica e 3 Raras, uma de cada conjunto) e uma aba de Pedras (×1 por 40 Ouro, ×5 por 200). Comprar não equipa. Cada cartão mostra a diferença para a peça que a montaria ativa usa no slot. Peça **não equipada** vende de volta por 25% do preço da raridade (ignora a melhoria), com "Desfazer" até sair da tela.

**Pedra Negra no pódio.** Só em corrida **valendo** (nunca em treino): 1º lugar 60% de chance, 2º 40%, 3º 25%, sorteados pela seed na liquidação do prêmio. É a única fonte de pedra fora da Loja e nunca dá peça.

**Pareamento e bots (desenho guardado).** Quando o equipamento voltar, ele volta a entrar no Poder e a trava do páreo aberto passa a valer também para as peças. Os bots equipavam conforme a liga (Bronze nada, Prata 2 Comuns, Ouro 5 Comuns +2, Platina 5 Mágicas +3, Diamante 3 Raras +4 do conjunto e 2 Mágicas +3, Lenda 5 Raras +7 do conjunto); hoje não equipam nada.

**Depois (fora do protótipo):** durabilidade e reparo · limite de vagas no inventário · Lendário na loja (hoje só pelo painel `?dev=1`, até as expedições) · peça Mítica · mercado entre jogadores · cosméticos por Gemas · desmanche · expedições e pacotes como fonte de peças · transferência de peças entre contas.

## 8. Redesenho aprovado em 2026-11-10 (blocos 2 a 7 ainda não implementados)

> Aprovado em conversa com o Vinicius, parte por parte. Entra em blocos, cada um com spec própria em
> `docs/superpowers/specs/`. **O bloco 1 (status, tipo e pistas sem extremos) está implementado desde
> 2026-11-11 e o 1b (crescimento livre) desde 2026-11-13**, e já são a regra das seções 3, 4, 6 e 7. Enquanto um bloco não é implementado, vale o que
> as seções 3 a 7 e o `docs/wiki.md` descrevem. Os números saem de simulação e ficam na spec de cada bloco.

### 8.1 Preparação (bloco 2)
- **Preparação com relógio:** a sala abre, a pista aparece e o jogador tem 12 segundos (ajustável) para
  trocar de cavalo e de ferradura com um toque. No zero a corrida larga sozinha; fechar o jogo não segura a sala.
- **Limite:** o cavalo escolhido não pode ter Poder acima do que a sala viu. Nada é re-sorteado.
- **Ferradura de tração:** família nova, reduz a perda em terra e areia.

### 8.2 Itens de treino e as duas lojas (blocos 4 e 6)
A Gema compra tempo, espaço, conveniência e aparência; nunca poder nem Ouro. Tudo que fortalece o
cavalo existe de graça, jogando. Item comprado com Gema nunca tem resultado sorteado.

| Item | Por Ouro ou jogando | Por Gemas |
|---|---|---|
| Torrão de açúcar (um ponto a mais para distribuir, limite por cavalo) | sim | não |
| Estrela de treino (sobe uma estrela) | sim, rara | não |
| Rédea nova (redistribui os pontos; a primeira de cada cavalo é grátis) | jogando (ginásios, missões; **por enquanto só pela gaveta DEV**), **nunca por Ouro** | sim |
| Cupom de troca de skill | sim, skill sorteada | sim, skill escolhida numa lista |
| Manual de doma | sim, aumenta a chance de aprender | sim, garante aprender |
| Acelerador de cruza · vaga extra de estábulo (até 3) · redefinir cruzas · mudar aparência | não | sim |

Gemas também caem de graça, em pouca quantidade, por missões. A skill de tipo nunca troca.

### 8.3 Ouro, circuito e aluguel (blocos 4 e 5)
- **O Ouro entra devagar** (prêmio de corrida, circuito, aluguel, missões, venda de peça) **e sai por
  muitas portas:** entrada, registro de cruza que cresce com a raridade, taxa por tentativa de melhoria,
  itens de treino, subir estrela, vagas com preço crescente, ração (bônus de XP) e, no futuro, despertar,
  taxa do mercado e inscrição em copas.
- **Cruza demora de 12 a 24 horas;** a égua fica ocupada.
- **Circuito ocioso:** cavalos fora da ativa correm treinos sozinhos com o jogo fechado, até 8 horas
  acumuladas. Rende pouco Ouro, XP e chance de item, mais para cavalos de Poder maior. Sem entrada nem
  pote. O número de cavalos no circuito depende das vagas do estábulo.
- **Aluguel:** o cavalo fica no haras da vila por 4, 8 ou 12 horas e volta com Ouro conforme a
  qualidade. Com servidor, o aluguel passa a ser entre jogadores.
- **Um trabalho por vez:** cada cavalo corre valendo, corre no circuito, fica de aluguel ou cruza.
- Gema nunca acelera o que paga Ouro (circuito e aluguel).

### 8.4 Mercado entre jogadores (bloco 7, com servidor)
Só em Ouro, no modelo do Black Desert: sem troca direta, mercado anônimo, preço dentro de faixa e taxa
da casa. O Ouro nunca é vendido por Gemas: ele é o que se aposta.

### 8.5 Crescimento livre (bloco 1b, implementado em 2026-11-13)
Spec e medições: `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md`; a regra de status está na seção 3.
- **Nada cresce sozinho:** cada nível dá pontos e o jogador distribui todos. A raridade define a base e o
  fator dos pontos por nível; as estrelas também multiplicam.
- **Custo por faixa até 150:** +1 no custo a cada 10 pontos no mesmo status; sem limite de 34% e sem teto
  por raridade. A física da corrida é linear até 150, para que nenhum ponto deixe de render.
- **Sorte só de nascimento** (sem pontos), com o Dado em (Sorte − 40)/40. A **skill de tipo multiplica** os
  dois status do tipo no seu terço.
- **Bots e "Distribuir sugerido":** a mesma build por pesos (seis status de corrida com peso 1 e × 1,2 nos
  dois do tipo). É a mais forte medida contra as inclinadas (51–55% no duelo direto), então distribuir
  melhor não basta para vencer o bot da sua liga. O botão preenche o rascunho com todos os pontos que
  sobram; o jogador ainda confirma. Os grupos +1, +5 e +10 e o botão somem quando nenhum ponto cabe.
- **Poder sem equipamento:** `2,5·VEL + 2,0·ACE + 2,2·MAN + 2,4·FOR + 2,4·EST + 1,5·GAR`, mais 14 por
  peso de gatilho de skill, 20·(nível − 1)/49 e 28·ordem da raridade/4. Ligas: Bronze 0 · Prata 710 · Ouro 800 ·
  Platina 890 · Diamante 980 · Lenda 1070.
- **Redistribuir:** a primeira é grátis em cada cavalo; as seguintes usam a Rédea nova (8.2), que **por
  enquanto só vem da gaveta DEV** (a fonte jogando chega com os ginásios, nunca por Ouro). A ativa não
  redistribui com páreo aberto.
- **Equipamento suspenso** (seção 7).
- **Save v6:** a migração devolve todos os pontos (aviso único no Estábulo), dá a redistribuição grátis a
  cada cavalo, zera as Rédeas e guarda peças e Pedras. A sala aberta continua: mantém seed, mapa, nomes
  e sedas, e o Poder dela segue a regra do retrato; os bots podem mudar de nível.
- **Explicações na tela:** cada status, nota, estrela, raridade, skill de tipo, Poder, liga, clima, piso
  e Dado ganham uma explicação curta (mouse no computador, toque no celular); o texto é o mesmo do wiki.

### 8.6 Ginásios (Expedição; online no bloco 7)
- **Expedição:** começa com 2 ginásios básicos de dificuldade comum. O líder tem até 3 cavalos e o
  jogador leva até 3; cada corrida é um duelo, quem vence continua e quem perde sai; perde quem ficar
  sem cavalos. A vitória dá uma insígnia com bônus de conta pequeno (% de Ouro, % de XP, % de chance de
  skill nova), que não mexe na corrida.
- **A decidir:** o cansaço de quem vence (proposta: começar a próxima com 15% menos fôlego por vitória
  seguida, valendo para os dois lados), quais são os 2 primeiros, entrada e prêmio.
- **Online (extra, bloco 7):** quatro ginásios dominados por jogadores (Fogo, Água, Grama e um acima dos
  três), desafiáveis pelo trono. Riscos a tratar na spec: um jogador segurar o trono para sempre
  (proposta: um conjunto por liga e temporadas) e conluio entre contas.

### 8.7 Ordem dos blocos
1. Status e tipo (implementado) · 1b. Crescimento livre · 2. Preparação · 3. Empacotamento e início do teste fechado · 4. Itens de
treino e gastos de Ouro · 5. Tempo e estábulo ativo (cruza com relógio, circuito, aluguel, missões,
tela de cruza com os dois pais e a faixa do potro) · 6. Loja de Gemas (sem compra real no teste
fechado) · 7. Online.

## 9+. Seções pendentes

Expedições (fora os ginásios, 8.6) · Tecnologia final do servidor e do empacotamento · Anti-trapaça · PVP assíncrono e ranqueada (propostas em `docs/cronograma.md`).
