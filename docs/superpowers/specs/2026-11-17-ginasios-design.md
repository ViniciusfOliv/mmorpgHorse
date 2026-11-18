# Ginásios da Expedição — desenho

_Data: 2026-11-17. Estado: **aprovado pelo Vinicius em 2026-11-17**. Fecha o que o GDD §8.6 deixava "a decidir". As
decisões do controlador (seção 19) valem com essa aprovação. Plano: `docs/superpowers/plans/2026-11-17-ginasios.md`._

## 1. Intenção e o porquê

O jogo precisa de algo para fazer **sem internet e sem apostar**, com um objetivo que dure semanas: é o conteúdo do
teste fechado. Os ginásios dão esse objetivo. São um caminho de adversários fixos que o jogador só vence evoluindo os
cavalos, com três chefes (um por elemento) e uma recompensa que fica na conta (a insígnia). Também dão uso ao que já
existe: o Haras (para ter cavalos de mais de um elemento), os itens (como prêmio) e o triângulo dos elementos, que hoje
quase não aparece para o jogador.

**Decisões do Vinicius (2026-11-17), na ordem em que foram tomadas:**

1. Antes do líder há **soldados**, cada um mais forte que o anterior. A força deles é **fixa**: não acompanha o nível
   do jogador.
2. O caminho é uma **trilha por ginásio**, de baixo para cima, com o líder no topo.
3. Cada soldado e o líder dão o prêmio cheio **uma vez**. Depois da insígnia, o líder aceita **1 revanche por dia**,
   com prêmio pequeno.
4. Duelo de time: **quem vence fica, quem perde sai**; perde o lado que ficar sem cavalos (já estava no GDD).
5. Quem vence chega **cansado** na corrida seguinte, e o cansaço depende de **quão apertada foi a vitória**: pouca
   distância na chegada, corrida disputada, mais cansaço.
6. **Três ginásios** nesta entrega: Fogo, Água e Grama.
7. Cada desafio custa uma **entrada pequena em Ouro**.
8. **O ginásio tem ponto fraco:** o elemento que vence o do ginásio leva vantagem (Água no de Fogo, Fogo no de Grama,
   Grama no de Água). A forma, escolhida entre quatro: **vantagem direta no duelo**, com **pista própria** em cada
   ginásio (seção 6). Ficaram de fora: o ponto fraco só pela pista, só pelo clima (chover sempre no ginásio de Fogo) e
   só pelo Dado da Sorte.
9. Aprovou a proposta de números de partida (níveis, prêmios, insígnias, time de até 3 com ordem escolhida, tentar de
   novo na hora). Dois pontos dessa proposta caíram com a decisão 8: o "clima da casa" a favor do ginásio e a pista de
   1.000 m igual para todos.

## 2. Objetivo, fora do escopo e o que não pode acontecer

**Objetivo.** Na aba Expedição, três ginásios jogáveis do começo ao fim: trilha, desafio em duelos, cansaço, vantagem de
elemento, prêmios, insígnias com bônus de conta e revanche diária do líder.

**Fora do escopo.**
- Ginásios online, trono, temporadas (GDD §8.6, bloco 7).
- Mapa da região ligando os ginásios (a trilha pode virar isso depois).
- Captura de cavalos selvagens, biomas, batalhas por turnos (o resto da Expedição). A vitrine "Cavalos selvagens"
  continua na aba, abaixo dos ginásios.
- Arte nova paga. As três insígnias usam os ícones já pagos em 2026-11-12 e guardados (`ins-fogo`, `ins-agua`,
  `ins-grama`). Os soldados e o líder aparecem pelos cavalos deles.
- Mudar a corrida valendo (salas, apostas, ligas): nenhuma regra nova vale fora do ginásio, a não ser os bônus das
  insígnias.

**O que não pode acontecer.**
- Um resultado ser calculado ou mostrado antes de a entrada ser paga, ou um desafio pago poder ser refeito de graça
  para tirar outro resultado.
- Qualquer sorteio fora da seed (nada de `Math.random`), ou o relógio lido fora do `hojeDia()`.
- Prêmio dado duas vezes, ou perdido, com duas abas abertas, recarregando no meio ou com a gravação falhando.
- A revanche ser liberada com o relógio para trás (vale a regra da diária: na dúvida, não libera).
- Um desafio de ginásio mudar o resultado ou o Poder de uma sala de corrida já aberta.
- Gema entrar em qualquer ponto disto. Tudo é Ouro ganho jogando.
- A insígnia mexer na simulação da corrida.

## 3. Abordagens

1. **Cada duelo é uma corrida de verdade** (escolhida). A tela de corrida que existe mostra o duelo, com 2 cavalos, o
   Dado da Sorte e o botão de pular. As regras do ginásio ficam num módulo puro novo (`ginasio.js`); a simulação só
   ganha duas entradas por corredor (fôlego inicial e vantagem de elemento). O desafio inteiro é simulado quando a
   entrada é paga e aplicado na mesma gravação, como a corrida valendo faz hoje.
2. **Desafio resolvido de uma vez, com resumo em texto.** Mais barato, mas tira a graça de assistir e esconde o Dado.
   Fica só como o botão "Pular tudo" da abordagem 1.
3. **Uma corrida só, 3 contra 3, com pontos por colocação.** Mais rápida, mas contradiz as decisões 4 e 5.

## 4. A trilha

Cada ginásio tem **4 soldados e o líder**, sempre com cavalos do elemento do ginásio.

| Etapa | Cavalos | Nível (partida) | Entrada | Prêmio da 1ª vitória |
|---|---|---|---|---|
| Soldado 1 | 1 | 4 | 20 | 80 de Ouro |
| Soldado 2 | 1 | 8 | 30 | 120 de Ouro e 1 Torrão de açúcar |
| Soldado 3 | 2 | 12 | 40 | 160 de Ouro |
| Soldado 4 | 2 | 16 | 50 | 200 de Ouro e 1 Manual de doma |
| Líder | 3 | 20 | 100 | 400 de Ouro, 1 Rédea nova, 1 Cupom de troca de skill e a insígnia |

- As etapas abrem **em ordem**: só dá para desafiar a próxima etapa não vencida. Etapa vencida fica marcada e não se
  repete (a revanche é só do líder, seção 8).
- Os três ginásios têm **os mesmos níveis, entradas e prêmios** ("dificuldade comum"); mudam o elemento, a pista e os
  nomes. O jogador pode fazer as três trilhas em qualquer ordem e alternar entre elas.
- Os cavalos dos soldados são **fixos no catálogo**: todos têm a genética do cavalo inicial do elemento do ginásio, e
  cada um tem o seu nível, as suas estrelas, a distribuição de pontos dos bots e as skills. Nada neles é sorteado e nada
  muda com o jogador. (Nome e aparência próprios para cada cavalo, sem mexer na força, ficam para a lista de gosto.)
- Raridade: Comum nos soldados 1 a 3; o soldado 4 e o líder podem ter um cavalo de raridade acima, se a calibração
  pedir para as metas da seção 12.
- **Nomes** (proposta, gosto do Vinicius): ginásio "da Fornalha" (Fogo, líder Capitã Labareda), "do Remanso" (Água,
  líder Mestre Aguaceiro), "da Capoeira" (Grama, líder Dona Capineira); soldados com patente e apelido do sertão
  (Recruta, Cabo, Sargento, Tenente). Nomes próprios do jogo, sem copiar nenhum outro.

## 5. O desafio

1. **Preparo.** Ao tocar numa etapa aberta, o jogador vê o adversário (cavalos, nível, elemento, Poder), a pista da
   casa, a entrada e o prêmio, e monta o **time**, na **ordem** em que os cavalos vão correr. O time tem **no máximo o
   tamanho do time do adversário**: 1 cavalo contra os soldados 1 e 2, até 2 contra os soldados 3 e 4, até 3 contra o
   líder (pode levar menos). A tela mostra, para cada cavalo escolhido, se ele tem vantagem, desvantagem ou nada contra
   o elemento do ginásio.
2. **Pagar.** "Desafiar" cobra a entrada (respeitando o Ouro reservado da sala aberta) e, **só então**, simula o
   desafio inteiro com a seed.
3. **Duelos.** O 1º cavalo do jogador corre contra o 1º do adversário. Quem perde sai; quem vence fica e enfrenta o
   próximo do outro lado, já cansado (seção 7). Acaba quando um lado fica sem cavalos.
4. **Assistir.** Cada duelo passa na tela de corrida. Entre um duelo e outro, um cartão diz quem saiu, quem entra e o
   fôlego de quem ficou. "Pular" termina o duelo; "Pular tudo" vai ao resumo.
5. **Resumo.** A lista dos duelos (quem venceu, por quantos metros, o cansaço), o Ouro, o XP de cada cavalo, os itens,
   a insígnia e a etapa nova aberta.

**Regras.**
- **Vitória:** prêmio da etapa (só na 1ª vez), etapa marcada, a seguinte abre. **Derrota:** perde a entrada; pode
  tentar de novo na hora, com outro time se quiser.
- **XP:** cada cavalo do jogador ganha XP por duelo que correu: 50 se venceu, 15 se perdeu (partida). Subir de nível
  durante o desafio não muda os cavalos naquele desafio (valem como estavam ao pagar).
- **Sala de corrida aberta:** o cavalo ativo **não entra no time** enquanto houver sala aberta (ganhar XP mudaria o
  Poder que a sala viu); os outros cavalos entram. O motivo aparece na linha do cavalo.
- **Jogador com um cavalo só:** os soldados 1 e 2 são 1 contra 1, então a trilha começa com o cavalo inicial. Se esse
  único cavalo é o ativo de uma sala aberta, não há time: a tela diz para correr ou fechar a sala primeiro.
- **Mochila cheia:** se o prêmio da etapa tem um item e a mochila já está no teto dele (99; Rédea 999), o botão
  "Desafiar" fica apagado com o motivo, antes de pagar.
- **Tudo numa gravação só:** a entrada, o resultado, o Ouro, o XP, os itens, o progresso e o contador do sorteio são
  gravados juntos. Recarregar no meio da animação mostra a trilha já atualizada. Gravação que falha: nada muda e nada
  é mostrado.
- O cansaço e a ordem do time valem só dentro do desafio; ao terminar, todo cavalo volta inteiro.

## 6. O ponto fraco do ginásio

**Vantagem de elemento (regra nova, só nos duelos de ginásio).** O triângulo é Fogo vence Grama, Grama vence Água,
Água vence Fogo. Num duelo, o cavalo cujo elemento vence o do adversário corre com os seis status de corrida **3%
maiores** (partida). Elementos iguais: nada. Como todos os cavalos de um ginásio são do elemento dele, o ponto fraco é
sempre o mesmo: Água no de Fogo, Fogo no de Grama, Grama no de Água — e o elemento que o ginásio vence corre em
desvantagem (o adversário é que leva os 3%).

- Medido na simulação (mesmo cavalo dos dois lados, pista comum, clima neutro): os 3% levam a chance de vitória de 48%
  para 70% no mesmo nível, e de 27% para 40% com o desafiante 4 níveis abaixo. Vale 3 a 4 níveis.
- A tela diz isso **antes de pagar** e em cada duelo: "Vantagem de elemento: Água vence Fogo".
- **Clima:** o duelo começa **Nublado** (neutro), para o triângulo não contar duas vezes na largada. O Dado da Sorte
  continua igual e pode virar o clima para o elemento de quem ganhou a rolagem.
- **Pista da casa:** cada ginásio tem uma pista fixa (distância, blocos e piso), a mesma em todas as etapas, para dar
  identidade. Ela sai da calibração e **não pode anular nem dobrar** o ponto fraco (metas G4 e G5 da seção 12).
- Fora do ginásio nada muda: na corrida valendo o triângulo continua agindo só pelo clima.

## 7. O cansaço

Quem vence um duelo começa o seguinte com **menos fôlego**, e o desconto depende da distância na chegada:

| Vitória | Distância na chegada | Fôlego perdido (partida) |
|---|---|---|
| Folgada | 20 m ou mais | 5% |
| Normal | de 5 a menos de 20 m | 15% |
| Apertada | menos de 5 m | 25% |

- Os descontos **somam** a cada vitória seguida, até o teto de 50%. Vale para os dois lados.
- "Distância na chegada" é quanto faltava para o perdedor quando o vencedor cruzou a linha, em metros. Sai do
  resultado da simulação, sem sorteio novo.
- "Menos fôlego" é o cavalo largar com o tanque de fôlego abaixo de cheio: ele corre igual no começo e cansa mais cedo.
- Medido (duelo entre cavalos iguais, pista de 1.000 m): 21% das vitórias são apertadas, 37% normais e 42% folgadas.
  Os limites de 5 e 20 m e os três descontos são ajustados na calibração (meta G6), mantendo três faixas e a ordem.
- O cartão entre os duelos mostra a faixa e o fôlego: "Vitória apertada (3 m): Brasa larga com 75% do fôlego".

## 8. Prêmios e revanche

- **Primeira vitória:** a tabela da seção 4. Por ginásio: 960 de Ouro, 1 Torrão, 1 Manual, 1 Rédea nova, 1 Cupom e a
  insígnia. Os três ginásios: 2.880 de Ouro e 3 de cada item.
- **Revanche do líder:** depois da insígnia, **1 tentativa por dia em cada ginásio** (vencendo ou perdendo), com
  entrada de 50. O prêmio de cada vitória segue um rodízio fixo, sem sorteio, contado por ginásio:
  100 de Ouro · 1 Torrão · 100 de Ouro · 1 Manual · 100 de Ouro · 1 Cupom, e recomeça.
- O dia é o do jogo (`hojeDia()`), com a regra da diária: relógio para trás não libera; dado de dia estragado conta
  como "já tentou hoje".
- A aba Expedição ganha o **ponto de aviso** quando há revanche disponível.
- A Rédea nova continua sem preço em Ouro: vem da diária e da 1ª vitória sobre cada líder.

## 9. Insígnias

Cada líder dá uma insígnia, para sempre. O bônus é da **conta** e não entra na simulação da corrida:

| Insígnia | Bônus (partida) | Onde entra |
|---|---|---|
| Fogo | +3% de Ouro nos prêmios de corrida valendo | no acerto do prêmio, arredondado para baixo |
| Água | +3% de XP para os cavalos (corridas e duelos) | quando o XP é somado, arredondado |
| Grama | +3 pontos na chance de aprender skill ao subir de nível (8% → 11%) | no sorteio de skill por nível |

- Os bônus valem dali em diante; não mexem em resultado já gravado nem na ordem de chegada de nenhuma corrida.
- As insígnias aparecem na aba Expedição (em cada ginásio) e no Perfil, com o ícone e o texto do bônus.
- Com servidor, o +3% de Ouro sobre o prêmio de outros jogadores cria Ouro do nada: fica anotado para o bloco 7.

## 10. Onde aparece

```
EXPEDIÇÃO                                   EXPEDIÇÃO > Ginásio da Fornalha (Fogo)
+------------------------------+            +------------------------------+
| Ginásio da Fornalha    Fogo  |            |        [ LÍDER ]             |
| 2 de 5 vencidos   ( insíg. ) |            |   Capitã Labareda   Nv 20    |
+------------------------------+            |           |                  |
| Ginásio do Remanso     Água  |            |     ( Tenente )   fechado    |
| 0 de 5                       |            |     ( Sargento )  <- próximo |
+------------------------------+            |     ( Cabo )      vencido    |
| Ginásio da Capoeira   Grama  |            |     ( Recruta )   vencido    |
| insígnia · revanche hoje  *  |            +------------------------------+
+------------------------------+             Ponto fraco: Água vence Fogo
 Cavalos selvagens (vitrine)

DESAFIO: Sargento (Fogo)                    RESUMO
 2 cavalos · Nv 12 · Poder 690               Duelo 1  Maré x Tição     Maré vence por 4 m
 Pista da casa: 1.200 m, subida              Duelo 2  Maré x Carvão    Maré perde
 Entrada 40 · Prêmio 160 de Ouro             Duelo 3  Brasa x Carvão   Brasa vence por 30 m
 Seu time (toque para pôr na ordem):         Vitória! +160 de Ouro
  1 Maré   Água  Nv 11  vantagem             Maré +65 XP · Brasa +50 XP
  2 Brasa  Fogo  Nv 13                       Tenente liberado
  (até 2 cavalos: o Sargento tem 2)
 [ Desafiar (40 de Ouro) ]
```

- **Expedição:** três cartões de ginásio (progresso, insígnia, revanche) e, abaixo, a vitrine que já existe.
- **Trilha:** subtela de cada ginásio, com o ponto fraco escrito.
- **Preparo, entre duelos e resumo:** como na seção 5. A corrida é a tela de corrida de hoje com 2 raias.
- **Perfil:** as insígnias conquistadas.
- A 360 px nada rola de lado; botões de 44 px ou mais; cada cavalo apagado tem o motivo escrito.

## 11. Economia (números de partida, para o Vinicius ajustar jogando)

- Jogador novo: 500 de Ouro. Corrida de 50 de entrada: o 1º ganha 126 (4 cavalos) a 216 (8 cavalos).
- Uma trilha inteira dá 960 de Ouro e custa 240 em entradas se vencida de primeira: equivale a 5 a 8 vitórias em
  corridas de 50.
- Nível: chegar ao 4 custa 300 de XP (3 a 5 corridas); ao 12, 2.200; ao 20, 5.700 (umas 60 a 80 corridas por cavalo).
  O líder é um objetivo de semanas, não de dias; a vantagem de elemento encurta isso em 3 a 4 níveis.
- Revanche: 3 por dia (uma por ginásio), 50 cada; em 6 dias de vitórias em um ginásio, 300 de Ouro e 3 itens por 300
  de entradas.

## 12. Calibração e metas

Os números das seções 4, 6, 7 e a pista de cada ginásio saem de simulação, como nas frentes anteriores. O `balance.js`
ganha um grupo de metas G, e os números finais vão para o wiki.

**O que é fixo e o que a calibração pode mexer.** Fixos: a estrutura (4 soldados e o líder; times de 1, 1, 2, 2 e 3; as
etapas em ordem; a forma dos prêmios; três faixas de cansaço; a vantagem como um percentual nos seis status de corrida).
Ajustáveis para fechar as metas: o nível de cada etapa (até 2 para cima ou para baixo), a raridade, as skills e os
pontos dos cavalos dos soldados, a pista de cada ginásio, o percentual da vantagem (de 2% a 5%), os limites e descontos
do cansaço e o XP por duelo. Se as metas não fecharem dentro disso, o executor para e leva a medição ao controlador,
que decide com o Vinicius. A tabela final é mostrada ao Vinicius antes de as telas serem construídas.

Em todas as metas, "time" é um time **do tamanho do time do adversário** naquela etapa, feito do cavalo inicial daquele
elemento repetido (os Comuns selvagens têm forças bem diferentes entre os elementos, e com eles a comparação entre os
ginásios media o catálogo). Metas (G2 e G3 ajustadas pela medição da calibração, 2026-11-17):

- **G1 — Na medida:** um time de cavalos Comuns do **mesmo elemento do ginásio**, no nível da etapa, com a
  distribuição sugerida, vence a etapa entre 40% e 55% das vezes. Vale para as cinco etapas; na primeira, é o cavalo
  inicial daquele elemento, sozinho, no nível 4.
- **G2 — Nível manda:** o mesmo time 4 níveis acima vence 70% ou mais; 4 níveis abaixo, 35% ou menos. (Era 25%: num
  duelo de 1 contra 1 a sorte de uma corrida só pesa mais; medido, ±4 níveis dão 73–80% e 19–35%.)
- **G3 — Ponto fraco vale:** o time do elemento que vence o ginásio, no nível da etapa, vence de 60% a 85%; o do
  elemento que o ginásio vence, 35% ou menos; e em toda etapa há pelo menos 30 pontos entre as duas taxas. (Era 60–80% e
  25%, pelos mesmos números da G2.)
- **G4 — A pista não anula o ponto fraco:** em cada ginásio, com a vantagem de elemento desligada, nenhum elemento
  fica mais de 8 pontos acima ou abaixo de 50% no duelo de nível igual.
- **G5 — Os três ginásios são parecidos:** as taxas de G1 e G3 dos três ginásios ficam a no máximo 8 pontos uma da
  outra.
- **G6 — As três faixas de cansaço existem:** entre cavalos de nível igual, nenhuma faixa fica com menos de 15% das
  vitórias.
- **G7 — O time importa:** contra o líder, um cavalo sozinho 4 níveis acima vence os três em no máximo 35% das vezes;
  sem o cansaço, a mesma conta tem de dar pelo menos 15 pontos a mais.
- **G8 — Duração:** um duelo dura de 55 a 90 s de corrida.
- **G9 — Determinismo:** a mesma seed e a mesma configuração dão o mesmo desafio, duelo a duelo.

## 13. Regras e módulos

- **`prototype/src/ginasio.js`** (novo, puro, no molde do `itens.js`: sem tela, sem relógio, sem `Math.random`, nunca
  altera a entrada): a vantagem de elemento, a sequência de duelos, o cansaço, o acerto (Ouro, XP, itens, progresso) e
  o estado da revanche. Vai para o servidor com os outros módulos de regra.
- **`data.js`:** `GameData.GYMS` (os três ginásios: elemento, nome, pista, etapas com cavalos, entradas e prêmios,
  insígnia, rodízio da revanche) e os números do cansaço e da vantagem.
- **`sim.js`:** duas entradas novas por corredor — o fôlego inicial e o multiplicador dos status de corrida — e a
  chance de skill por nível aceitando o bônus da insígnia. Sem elas o resultado de toda corrida é idêntico ao de hoje
  (o `balance.js` confere).
- **`game.js`:** telas, save, o dia. **`breed.js`, `gear.js`, `itens.js`:** não mudam.
- **Sorteio:** cada duelo usa a seed do save com um sal próprio do ginásio mais o contador de desafios; o contador sobe
  na mesma gravação que cobra a entrada.

## 14. Save versão 8

- Novo: o progresso de cada ginásio (etapas vencidas, insígnia), a revanche (dia da última tentativa e vitórias, por
  ginásio) e o contador de desafios.
- Migração da versão 7: tudo zerado, nenhuma etapa vencida.
- Campo estragado: progresso volta a zero; insígnia só vale com as 5 etapas vencidas; dia da revanche estragado conta
  como "já tentou hoje" (e é gravado consertado ao abrir, como na diária).
- A proteção contra save de versão mais nova já existe e continua valendo.

## 15. Gaveta DEV

Grupo "Ginásios": escolher a etapa de cada trilha, dar ou tirar insígnia, liberar a revanche, zerar tudo. Só no build
de teste.

## 16. Testes

- **Regras (`sim-test.js`):** a sequência de duelos e quem sai; o cansaço por faixa, a soma e o teto; a vantagem de
  elemento nos três sentidos; o acerto (prêmio só na 1ª vez; rodízio da revanche; mochila cheia); a revanche com o dia
  (uma por dia, relógio para trás, dado estragado); entrada malformada não quebra nem dá prêmio; determinismo.
- **Simulação:** com as entradas novas ausentes, o resultado é idêntico ao de hoje (o hash de referência não muda).
- **Balanço:** as metas G1 a G9.
- **Tela (`ui-test.mjs`, bloco novo):** vencer e perder uma etapa; o time e a ordem; o cavalo ativo com sala aberta
  fora do time; nada calculado antes de pagar; recarregar no meio; gravação falhando; duas abas; aba velha; mochila
  cheia; a revanche e a virada do dia; as insígnias e os três bônus; "Pular" e "Pular tudo"; 360 e 1280 px sem
  rolagem lateral; movimento reduzido.
- **Produção:** o jogo de produção sai sem a gaveta de ginásios.

## 17. Documentos e memória

GDD §8.6 reescrito com o que foi decidido; wiki com a seção de ginásios (trilhas, cansaço, vantagem, prêmios,
insígnias) e a aba Expedição; `ESTADO.md`, `decisoes.md` e a lista "A confirmar com o Vinicius (gosto, ginásios)";
capturas oficiais da Expedição, da trilha, do preparo e do resumo; `assets.md` (uso dos três ícones de insígnia).

## 18. Deixado para o executor

Os nomes dos soldados; a pista de cada ginásio e os números finais (dentro das metas); os nomes das funções; o desenho
fino das telas dentro do que a seção 10 mostra; o sal do sorteio; a ordem das tarefas do plano.

## 19. Decisões

- **Do Vinicius:** as 9 da seção 1.
- **Do controlador (a confirmar na leitura):** 4 soldados por trilha e os tamanhos dos times; o time do jogador
  limitado ao tamanho do time do adversário; o que a calibração pode mexer (seção 12); os três ginásios com a
  mesma dificuldade; os números das tabelas; XP por duelo; o cavalo ativo fora do time com sala aberta; a mochila
  cheia travando o desafio; o desafio inteiro acertado na gravação do pagamento; clima Nublado na largada; revanche
  como 1 tentativa por dia por ginásio e o rodízio do prêmio; qual insígnia dá qual bônus; o ponto de aviso na aba; os
  nomes dos ginásios e dos líderes; as metas G1 a G9.

## 20. Onde o código está hoje (para quem for planejar; os números de linha mudam, procure pelo nome)

- **Simulação (`prototype/src/sim.js`):** `simulate(config)` aceita qualquer número de corredores; cada corredor nasce em
  `buildRacer(entry, …)` com `stamina: 1` e o tanque `pool = 66 + 20·n(est)`. Entradas por corredor que existem:
  `horse`, `name`, `statAdd` (gancho de teste) e `noTypeSkill`. O resultado traz `finishOrder`, `finishTimes`, `conditions`,
  `frames` (com `pos`, `speed`, `stamina` por instante) e não traz distância entre os cavalos. `conditions` aceita
  distância de 1.000 a 2.400 m, blocos, piso e clima dados. O Dado da Sorte rola em 1/3 e 2/3 da pista e pode virar o
  clima. A chance de skill por nível é `T.learnChance = 0,08`, usada em `learnSkill`.
- **Corrida valendo (`prototype/src/game.js`):** `openLobby` cria `state.pending` (a sala aberta) sem cobrar; `settle`
  simula, debita a entrada e dá o prêmio na mesma gravação (`gravaGasto`), e só então a tela `corrida` anima. O XP entra
  por `applyXp`, que também sorteia a skill nova. `createRaceView` e a tela de resultado se adaptam ao número de
  corredores. A troca do cavalo ativo é bloqueada com sala aberta.
- **Escolha de cavalo:** `mountRowHtml(m, isActive, o)` com `o = { acao, fim, motivo }` (a mesma linha do Estábulo, usada
  na escolha do cavalo dos itens). Não existe escolha de vários cavalos.
- **Aba Expedição:** `renderExpedicao` (hoje só a vitrine `WILD_SHOWCASE`); o ponto de aviso das abas é ligado em
  `appAbasHtml`; o `wiki.mjs` descreve cada aba em `descreverAba`.
- **Save:** `SAVE_VERSION = 7`, `newState`, `sanitize` (campo novo só é lido com o save na versão dele), a guarda do save
  mais novo, `hojeDia()`, `state.seedBase` e os contadores de sorteio (o mapa dos sais está no topo do `itens.js`).
- **Catálogo:** 2 cavalos Comuns por elemento entre `STARTERS` e `WILD_HORSES` (Brasa e Faísca, Maré e Lambari, Ipê e
  Capim), mais os de raridade acima; `ECONOMY` (500 de Ouro inicial, entradas 50/100/250, XP por colocação
  100/70/50/…, `xpToLevel = 50 + 25·nível`).
- **Testes:** metas no `balance.js` com `check(id, rótulo, valor, mínimo, máximo)`; blocos do `ui-test.mjs` na lista
  `BLOCOS`; o build de produção proíbe nomes do modo DEV no `jogo.html`.

## 21. Notas da execução

_Acrescentado em 2026-11-18, no fim da execução. As seções acima ficam como foram aprovadas; aqui está onde a execução
decidiu algo que a spec não dizia ou dizia diferente. Cada linha cita a decisão do controlador ("Ruling", em
`.superpowers/sdd/2026-11-17-ginasios/rulings.md`); o porquê está em `docs/memoria/decisoes.md`._

- **Faixas do cansaço com o limite de cima aberto (Ruling 5):** uma distância exatamente no limite cai na faixa de cima
  (com os limites finais, 1 m já é "normal" e 8 m já é "folgada").
- **Metas G2 e G3 ajustadas pela medição (Ruling 8):** já escritas na seção 12.
- **Cavalos dos soldados e dos líderes com a genética do inicial do elemento (Ruling 11):** já escrito nas seções 4 e 12;
  na tela eles aparecem com o nome do inicial ("Brasa, Brasa").
- **Faixas do cansaço em 1 m e 8 m (Rulings 12 e 14):** a tabela da seção 7 dizia 5 m e 20 m. Os descontos (25%, 15%,
  5%) e o teto de 50% não mudaram.
- **Vantagem de elemento de cerca de 4% (Ruling 13, tabela da calibração):** a seção 6 dizia 3%. Cada status continua
  inteiro (arredondado), então a vantagem anda em degraus de 1 ponto; a tela e o wiki dizem "cerca de 4%".
- **A trilha abre rolada até a etapa que se pode tocar (Rulings 17 e 27):** a tela rola o mínimo para a etapa próxima, ou
  a revanche livre de hoje, aparecer inteira; sem nada tocável, fica no topo.
- **Sorteio de skill ao subir de nível num desafio (Ruling 18):** usa um sal próprio do ginásio (20.000.000 + contador ·
  4 + posição no time), separado dos sorteios das corridas e do cruzamento.
- **Resumo (Ruling 20):** distância abaixo de 1 m aparece como "por menos de 1 m", e cada duelo traz "Você venceu" ou
  "Você perdeu" (os dois cavalos podem ter o mesmo nome).
- **Sala aberta (Ruling 21):** o cavalo ativo fica fora do time com qualquer sala aberta, valendo ou treino; o Ouro
  reservado continua sendo só o da sala valendo.
- **"Corra essa corrida primeiro" (Ruling 29):** a seção 5 falava em "correr ou fechar a sala primeiro", mas o jogo não
  tem como fechar uma sala sem correr. A tela diz "Está na sala aberta. Corra essa corrida primeiro." e, quando o único
  cavalo é o da sala, "Seu único cavalo está na sala aberta. Corra essa corrida primeiro.".
- **A tela nunca diz quantos duelos faltam (Ruling 22):** "Duelo 2", e não "Duelo 2 de 3"; tudo o que a tela mostra de um
  duelo sai do resultado gravado.
- **"Voltar" do aparelho durante um duelo ou num cartão (Ruling 23):** vale como "Pular tudo" (vai ao resumo).
- **Metros truncados para baixo (Ruling 24):** no cartão e no resumo, 7,6 m aparece como "7 m", para o número nunca
  contradizer a faixa do cansaço.
- **`Ginasio.revanchePremio` exportada (Ruling 26):** a tela pergunta ao módulo o "Prêmio de hoje" da revanche, a mesma
  função que o acerto usa para pagar; nenhuma regra mudou.
- **Textos que a spec não fixava:** o cavalo do adversário aparece com o nome do dono ("Brasa (Sargento Candeeiro)");
  depois da chegada de um duelo o botão diz "Continuar"; a etapa do líder com a revanche de hoje feita mostra "Feita hoje"
  e "Revanche de hoje feita. Volte amanhã."; a primeira revanche já fica livre no dia da insígnia. Todos estão na lista
  "A confirmar com o Vinicius (gosto, ginásios)" do `docs/memoria/ESTADO.md`.
